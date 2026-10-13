// Spoken audio is separate from the conversation model. No speech API or GPU host is used.
const FEMALE = ['af_heart', 'af_bella', 'af_nicole', 'af_sarah', 'af_aoede', 'af_kore', 'bf_emma'];
const MALE = ['am_michael', 'am_fenrir', 'am_puck', 'bm_george', 'bm_fable'];
export function speechChunks(text) {
 const sentences = String(text || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+(?:[.!?]+["'”’]*|$)/g) || [];
 return sentences.flatMap(sentence => {
  const words = sentence.trim().split(/\s+/), chunks = []; let part = '';
  for (const word of words) { if (part && part.length + word.length > 220) { chunks.push(part); part = ''; } part += (part ? ' ' : '') + word; }
  if (part) chunks.push(part);
  return chunks;
 });
}
const speedOf = (who) => Math.max(.85, Math.min(1.2, (who.rate || 1) / (who.pitch || 1)));
export function localVoice(who = {}) {
 const pool = who.male === false ? FEMALE : MALE;
 return pool[Math.abs(Math.trunc(Number(who.seed) || 0)) % pool.length];
}
// a touch screen gets the cheap stereo pan instead of the head-related one (it costs a phone
// a convolution per voice)
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
// lines made once are kept: passers-by repeat a small set of lines, and replaying one costs
// nothing where making it again costs the processor a second or two
const CACHE_MAX = 48;
export function createLocalSpeech({ onStatus = () => {}, fallback = () => {} } = {}) {
 let worker, context, source, panner, request = 0, timer, active, unavailable = false, ready = false, warming = false, slowRuns = 0;
 const made = new Map();
 // (a device found too slow stays on the device voice next time, until it is asked to try again)
 const SLOW_KEY = 'crysis-local-voice-slow';
 function remember(slow) { try { if (slow) localStorage.setItem(SLOW_KEY, '1'); else localStorage.removeItem(SLOW_KEY); } catch {} }
 try { if (COARSE && localStorage.getItem(SLOW_KEY)) unavailable = true; } catch {}
 // choosing the local voices again: one more try
 function retry() { remember(false); unavailable = false; slowRuns = 0; }
 const keyOf = (who, chunk) => localVoice(who) + '|' + speedOf(who).toFixed(3) + '|' + chunk;
 function keep(key, samples, sampleRate) {
  made.delete(key); made.set(key, { samples, sampleRate });
  while (made.size > CACHE_MAX) made.delete(made.keys().next().value);
 }
 // a passing remark is quiet about its progress; the guide's line shows how the voice is doing
 const status = text => { if (!active?.remark || /unavailable/.test(text)) onStatus(text); };
 function unlock() {
  try {
   const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
   if (!context && AC) context = new AC();
   if (context?.state === 'suspended') context.resume().catch(() => {});
   return Boolean(context);
  } catch { return false; }
 }
 function clearTimer() { clearTimeout(timer); }
 function stopSource() {
  if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); source = null; }
  panner?.disconnect(); panner = null;
 }
 function fail(reason = 'Local voices unavailable · using device voice') {
  clearTimer(); worker?.terminate(); worker = null; unavailable = true; warming = false;
  stopSource();
  const remaining = active?.chunks.slice(active.completed).join(' ');
  const who = active?.who, remark = active?.remark; active = null;
  onStatus(reason);
  if (remark) remark.done?.(false);
  else if (remaining) fallback(remaining, who);
 }
 function arm() { clearTimer(); timer = setTimeout(fail, 240000); }
 function cancel() {
  clearTimer(); request++; if (active) status('');
  const remark = active?.remark; active = null;
  stopSource(); remark?.done?.(false);
  worker?.postMessage({ type: 'cancel', id: request });
 }
 function speak(text, who = {}) {
  cancel(); const chunks = speechChunks(text); if (!chunks.length) return;
  if (unavailable || !unlock() || !globalThis.Worker) { status('Using device voice'); fallback(text, who); return; }
  request++; start(request, chunks, who, null);
 }
 // a line said in passing, from where the speaker stands: { at() -> {x,y,z}, audible() -> bool,
 // started(seconds), done(played) }. It never cuts into a conversation or another remark.
 function remark(text, who = {}, place = {}) {
  if (!ready || active || unavailable || !context || context.state !== 'running' || !globalThis.Worker) return false;
  const chunks = speechChunks(text); if (!chunks.length) return false;
  request++;
  if (chunks.every((c) => made.has(keyOf(who, c)))) replay(request, chunks, who, place);
  else start(request, chunks, who, place);
  return true;
 }
 // where you are listening from, and where the remark is coming from, once a frame
 function place(p, f) {
  if (!context || !p || !f) return;
  const L = context.listener, t = context.currentTime;
  if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, .05); L.positionY.setTargetAtTime(p.y, t, .05); L.positionZ.setTargetAtTime(p.z, t, .05); L.forwardX.setTargetAtTime(f.x, t, .05); L.forwardY.setTargetAtTime(f.y, t, .05); L.forwardZ.setTargetAtTime(f.z, t, .05); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
  else { L.setPosition?.(p.x, p.y, p.z); L.setOrientation?.(f.x, f.y, f.z, 0, 1, 0); }
  const q = panner && active?.remark?.at?.();
  if (q) { if (panner.positionX) { panner.positionX.setTargetAtTime(q.x, t, .05); panner.positionY.setTargetAtTime(q.y, t, .05); panner.positionZ.setTargetAtTime(q.z, t, .05); } else panner.setPosition(q.x, q.y, q.z); }
 }
 function start(id, chunks, who, remarkPlace) {
  active = { chunks, who, completed: 0, remark: remarkPlace };
  try {
   ensure();
   status('Preparing local voice…'); arm();
   worker.postMessage({ type: 'speak', id, chunks, voice: localVoice(who), speed: speedOf(who) });
  } catch { fail(); }
 }
 // a remark made before: played straight from memory, piece by piece, no worker involved
 function replay(id, chunks, who, R) {
  active = { chunks, who, completed: 0, remark: R };
  const next = (i) => {
   if (id !== request || !active) return;
   if (i >= chunks.length) { const D = active.remark; active = null; D?.done?.(true); return; }
   if (R?.audible && !R.audible()) { cancel(); return; }
   const m = made.get(keyOf(who, chunks[i]));
   if (!m) { cancel(); return; }
   play(m.samples, m.sampleRate, R, () => { if (active) active.completed = i + 1; next(i + 1); });
  };
  next(0);
 }
 // one piece of a line through the speakers: from where the speaker stands for a remark
 function play(samples, sampleRate, R, ended) {
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  source = context.createBufferSource(); source.buffer = buffer;
  // the person's own pitch; the rate given to the model already keeps the pace natural
  source.playbackRate.value = active.who.pitch || 1;
  if (R) {
   panner = context.createPanner();
   Object.assign(panner, { panningModel: COARSE ? 'equalpower' : 'HRTF', distanceModel: 'inverse', refDistance: 2.2, rolloffFactor: 1.15, maxDistance: 40 });
   source.connect(panner).connect(context.destination);
   const q = R.at?.(); if (q) { if (panner.positionX) { panner.positionX.value = q.x; panner.positionY.value = q.y; panner.positionZ.value = q.z; } else panner.setPosition(q.x, q.y, q.z); }
   R.started?.(buffer.duration / source.playbackRate.value);
  } else source.connect(context.destination);
  source.onended = () => { source?.disconnect(); source = null; panner?.disconnect(); panner = null; ended(); };
  source.start();
 }
 // load the voices in the background so the first remark in passing is not a long wait
 function warm() {
  if (ready || warming || unavailable || !globalThis.Worker) return;
  warming = true;
  try { ensure(); worker.postMessage({ type: 'warm', id: -1 }); } catch { warming = false; }
 }
 function ensure() {
   if (!worker) {
    worker = new Worker(new URL('./local-speech-worker.js?v=20261013', import.meta.url), { type: 'module' });
    worker.onerror = () => fail();
    worker.onmessage = ({ data }) => {
     if (data.type === 'ready') { ready = true; return; }
     if (data.type === 'cold') { warming = false; return; }
     if (data.type === 'audio') ready = true;
     if (data.id !== request || !active) return;
     const messageId = data.id;
     if (data.type === 'status') { status(data.text); return; }
     if (data.type === 'error') { fail(); return; }
     if (data.type === 'done') { clearTimer(); const R = active.remark; active = null; R?.done?.(true); return; }
     if (data.type !== 'audio') return;
     clearTimer();
     const R = active.remark;
     // walked out of earshot while the voice was being made: let it go unsaid
     if (R?.audible && !R.audible()) { cancel(); return; }
     // Too slow for this device: when making a line takes much longer than saying it, twice
     // running, on a touch screen, the voices go and the device voice takes over. A phone
     // that falls behind like this is also starving the world it is drawing.
     if (COARSE && Number.isFinite(data.ms)) {
      slowRuns = data.ms > (data.samples.length / data.sampleRate) * 1000 * 1.6 ? slowRuns + 1 : 0;
      if (slowRuns >= 2) { remember(true); fail('Local voices are too slow on this device · using device voice'); return; }
     }
     try {
      if (R) keep(keyOf(active.who, active.chunks[data.index]), data.samples, data.sampleRate);
      play(data.samples, data.sampleRate, R, () => {
       if (messageId !== request || !active) return;
       active.completed = data.index + 1; arm();
       worker?.postMessage({ type: 'ack', id: messageId });
      });
      if (context.state !== 'running') status('Tap the speaker to enable audio');
     } catch { fail(); }
    };
   }
 }
 function dispose() { cancel(); worker?.terminate(); worker = null; context?.close().catch(() => {}); context = null; }
 return { speak, remark, place, warm, retry, cancel, unlock, dispose, busy: () => !!active, ready: () => ready, cached: () => made.size };
}
