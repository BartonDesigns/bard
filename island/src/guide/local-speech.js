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
export function localVoice(who = {}) {
 const pool = who.male === false ? FEMALE : MALE;
 return pool[Math.abs(Math.trunc(Number(who.seed) || 0)) % pool.length];
}
export function createLocalSpeech({ onStatus = () => {}, fallback = () => {} } = {}) {
 let worker, context, source, panner, request = 0, timer, active, unavailable = false, ready = false, warming = false;
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
 function fail() {
  clearTimer(); worker?.terminate(); worker = null; unavailable = true; warming = false;
  stopSource();
  const remaining = active?.chunks.slice(active.completed).join(' ');
  const who = active?.who, remark = active?.remark; active = null;
  onStatus('Local voices unavailable · using device voice');
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
  request++; start(request, chunks, who, place); return true;
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
   worker.postMessage({ type: 'speak', id, chunks, voice: localVoice(who), speed: Math.max(.85, Math.min(1.2, (who.rate || 1) / (who.pitch || 1))) });
  } catch { fail(); }
 }
 // load the voices in the background so the first remark in passing is not a long wait
 function warm() {
  if (ready || warming || unavailable || !globalThis.Worker) return;
  warming = true;
  try { ensure(); worker.postMessage({ type: 'warm', id: -1 }); } catch { warming = false; }
 }
 function ensure() {
   if (!worker) {
    worker = new Worker(new URL('./local-speech-worker.js?v=20261012c', import.meta.url), { type: 'module' });
    worker.onerror = fail;
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
     try {
      const buffer = context.createBuffer(1, data.samples.length, data.sampleRate);
      buffer.copyToChannel(data.samples, 0);
      source = context.createBufferSource(); source.buffer = buffer;
      // the person's own pitch; the rate given to the model already keeps the pace natural
      source.playbackRate.value = active.who.pitch || 1;
      if (R) {
       panner = context.createPanner();
       Object.assign(panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 2.2, rolloffFactor: 1.15, maxDistance: 40 });
       source.connect(panner).connect(context.destination);
       const q = R.at?.(); if (q) { if (panner.positionX) { panner.positionX.value = q.x; panner.positionY.value = q.y; panner.positionZ.value = q.z; } else panner.setPosition(q.x, q.y, q.z); }
       R.started?.(buffer.duration / source.playbackRate.value);
      } else source.connect(context.destination);
      source.onended = () => {
       source?.disconnect(); source = null; panner?.disconnect(); panner = null;
       if (messageId !== request || !active) return;
       active.completed = data.index + 1; arm();
       worker?.postMessage({ type: 'ack', id: messageId });
      };
      source.start();
      if (context.state !== 'running') status('Tap the speaker to enable audio');
     } catch { fail(); }
    };
   }
 }
 function dispose() { cancel(); worker?.terminate(); worker = null; context?.close().catch(() => {}); context = null; }
 return { speak, remark, place, warm, cancel, unlock, dispose, busy: () => !!active, ready: () => ready };
}
