// Spoken audio is separate from the conversation model. No speech API or GPU host is used.
// Voices play through the Bard's master (soundbus.js voiceBus: ahead of its peak guard, so
// speech and music share one ceiling and one audio context); a context of its own stands in
// before the Bard has made its audio.
//
// Each line is said from the best source there is at that moment (local-speech-plan.js): a
// clip made ahead of time, the local model once it is loaded, or the device's own voice.
import { voiceBus } from '../world/soundbus.js';
import { speechChunks, localVoice, chooseSource, phoneLike, deviceVoiceFor, createLoadGuard } from './local-speech-plan.js';
import { createClipStore } from './local-speech-clips.js';
export { speechChunks, localVoice };
const speedOf = (who) => Math.max(.85, Math.min(1.2, (who.rate || 1) / (who.pitch || 1)));
// a touch screen gets the cheap stereo pan instead of the head-related one (it costs a phone
// a convolution per voice)
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const PHONE = phoneLike({ coarse: COARSE, userAgent: globalThis.navigator?.userAgent || '', deviceMemory: globalThis.navigator?.deviceMemory || 8 });
// lines made once are kept: passers-by repeat a small set of lines, and replaying one costs
// nothing where making it again costs the processor a second or two
const CACHE_MAX = PHONE ? 16 : 48;
export function createLocalSpeech({ onStatus = () => {}, fallback = () => {}, mode = () => 'best', clips = createClipStore() } = {}) {
 let worker, context, source, panner, request = 0, timer, active, unavailable = false, ready = false, warming = false, slowRuns = 0;
 const made = new Map();
 let storage = null;
 try { storage = globalThis.localStorage || null; } catch {}
 // (a device found too slow stays on the clips and the device voice next time, until it is asked to try again)
 const SLOW_KEY = 'crysis-local-voice-slow';
 function remember(slow) { try { if (slow) storage?.setItem(SLOW_KEY, '1'); else storage?.removeItem(SLOW_KEY); } catch {} }
 try { if (COARSE && storage?.getItem(SLOW_KEY)) unavailable = true; } catch {}
 // A phone never loads the model in passing: it is a 100 MB model in WebAssembly, and on top
 // of the world that is more than some phone browsers allow (they close the page: the white
 // flash and back to the faceplate). It is loaded once the world has been calm a while, with
 // a mark left in storage in case the page goes with it (local-speech-plan.js createLoadGuard).
 const guard = createLoadGuard({ storage });
 const modelAllowed = () => !unavailable && !(PHONE && guard.unable());
 // choosing the local voices again: one more try
 function retry() { remember(false); unavailable = false; slowRuns = 0; guard.reset(); }
 const keyOf = (who, chunk) => localVoice(who) + '|' + speedOf(who).toFixed(3) + '|' + chunk;
 function keep(key, samples, sampleRate) {
  made.delete(key); made.set(key, { samples, sampleRate });
  while (made.size > CACHE_MAX) made.delete(made.keys().next().value);
 }
 // a passing remark is quiet about its progress; the guide's line shows how the voice is doing
 const status = text => { if (!active?.remark || /unavailable/.test(text)) onStatus(text); };
 function unlock() {
  clips.load();
  try {
   if (voiceBus()) return true;
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
 // the model is let go: the device's voice and the clips carry on
 function unload() {
  if (!worker) return;
  if (active?.model) cancel();
  worker.terminate(); worker = null; ready = false; warming = false;
  if (PHONE) guard.dropped();
 }
 function fail(reason = 'Local voices unavailable · using device voice') {
  clearTimer(); worker?.terminate(); worker = null; unavailable = true; warming = false; ready = false;
  if (PHONE) guard.dropped();
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
  const remark = active?.remark, device = active?.device; active = null;
  stopSource(); remark?.done?.(false);
  if (device) try { globalThis.speechSynthesis?.cancel(); } catch {}
  worker?.postMessage({ type: 'cancel', id: request });
 }
 const deviceOk = () => 'speechSynthesis' in globalThis;
 const sourceFor = (chunks, who, talk) => chooseSource({ chunks, hasClip: (c) => clips.has(localVoice(who), c) }, { mode: mode(), phone: PHONE, modelReady: ready, modelAllowed: modelAllowed(), talk, deviceOk: deviceOk() });
 function speak(text, who = {}) {
  cancel(); const chunks = speechChunks(text); if (!chunks.length) return;
  clips.load();
  const from = sourceFor(chunks, who, true);
  if (from === 'clip' && unlock()) { request++; fromClips(request, chunks, who, null, () => fallback(text, who)); return; }
  if (from === 'model' && unlock() && globalThis.Worker) { request++; start(request, chunks, who, null); return; }
  status('Using device voice');
  fallback(text, who);
 }
 // a line said in passing, from where the speaker stands: { at() -> {x,y,z}, audible() -> bool,
 // started(seconds), done(played) }. It never cuts into a conversation or another remark.
 function remark(text, who = {}, place = {}) {
  if (active) return false;
  const chunks = speechChunks(text); if (!chunks.length) return false;
  clips.load();
  const C = out()?.ctx, running = C?.state === 'running';
  let from = sourceFor(chunks, who, false);
  // the voices need the audio running (a tap); the device's voice does not
  if ((from === 'clip' || from === 'model') && !running) from = deviceOk() ? 'device' : 'none';
  if (from === 'model' && !globalThis.Worker) from = 'device';
  if (from === 'none') return false;
  if (from === 'device') return deviceRemark(text, who, place);
  request++;
  if (from === 'clip') fromClips(request, chunks, who, place, null);
  else if (chunks.every((c) => made.has(keyOf(who, c)))) replay(request, chunks, who, place);
  else start(request, chunks, who, place);
  return true;
 }
 // where to play: the Bard's voice bus, else our own context
 function out() {
  const V = voiceBus();
  if (V) return { ctx: V.ctx, dest: V.out };
  return context ? { ctx: context, dest: context.destination } : null;
 }
 // where you are listening from (kept), and the speaker placed relative to it: the shared
 // context's listener is left alone, at the origin looking down -z
 let ear = null;
 function relative(q) {
  if (!ear) return q;
  const { p, f } = ear, h = Math.hypot(f.x, f.z) || 1, fx = f.x / h, fz = f.z / h;
  const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
  return { x: dx * -fz + dz * fx, y: dy, z: -(dx * fx + dz * fz) };
 }
 function aim(q, t) {
  if (!panner || !q) return;
  const r = relative(q);
  if (panner.positionX) { panner.positionX.setTargetAtTime(r.x, t, .05); panner.positionY.setTargetAtTime(r.y, t, .05); panner.positionZ.setTargetAtTime(r.z, t, .05); }
  else panner.setPosition(r.x, r.y, r.z);
 }
 // where you are listening from, and where the remark is coming from, once a frame
 function place(p, f) {
  if (!p || !f) return;
  ear = { p: { x: p.x, y: p.y, z: p.z }, f: { x: f.x, y: f.y, z: f.z } };
  if (panner) aim(active?.remark?.at?.(), panner.context.currentTime);
 }
 function start(id, chunks, who, remarkPlace) {
  active = { chunks, who, completed: 0, remark: remarkPlace, model: true };
  try {
   // (a phone told to use the local voices still leaves the mark while they load)
   if (PHONE && !ready && !worker) guard.begin();
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
 // a line from the clips: every piece fetched first, then played straight through. If one
 // cannot be had, nothing of it has been heard yet, so the device's voice can say it instead.
 function fromClips(id, chunks, who, R, instead) {
  active = { chunks, who, completed: 0, remark: R };
  const O = out();
  if (!O) { active = null; if (R) R.done?.(false); else instead?.(); return; }
  clips.line(localVoice(who), chunks, O.ctx).then((buffers) => {
   if (id !== request || !active) return;
   const next = (i) => {
    if (id !== request || !active) return;
    if (i >= buffers.length) { const D = active.remark; active = null; D?.done?.(true); return; }
    if (R?.audible && !R.audible()) { cancel(); return; }
    play(buffers[i], 0, R, () => { if (active) active.completed = i + 1; next(i + 1); });
   };
   next(0);
  }, () => {
   if (id !== request || !active) return;
   active = null;
   if (R) { if (!deviceRemark(chunks.join(' '), who, R)) R.done?.(false); }
   else instead?.();
  });
 }
 // a remark in the device's voice: the nearest it has to the person's own, as loud as they
 // are near (it cannot be placed in space)
 function deviceRemark(text, who, R) {
  const S = globalThis.speechSynthesis;
  if (!S || S.speaking || S.pending) return false;
  try {
   const u = new SpeechSynthesisUtterance(text), d = deviceVoiceFor(who, S.getVoices());
   if (d.voice) u.voice = d.voice;
   u.pitch = d.pitch; u.rate = d.rate;
   const q = R?.at?.(), dist = q && ear ? Math.hypot(q.x - ear.p.x, q.y - ear.p.y, q.z - ear.p.z) : 3;
   u.volume = Math.max(0.15, Math.min(1, 2.4 / Math.max(dist, 1)));
   const id = ++request;
   active = { chunks: [text], who, completed: 0, remark: R, device: true };
   const end = () => { if (id !== request || !active) return; const D = active.remark; active = null; D?.done?.(true); };
   u.onend = u.onerror = end;
   S.speak(u);
   const seconds = (0.6 + text.length * 0.065) / d.rate;
   R?.started?.(seconds);
   // (some devices never say they have finished)
   setTimeout(end, seconds * 2000 + 3000);
   return true;
  } catch { active = null; return false; }
 }
 // one piece of a line through the speakers: from where the speaker stands for a remark
 // (samples and their rate from the model, or an AudioBuffer from a clip)
 function play(samples, sampleRate, R, ended) {
  const O = out();
  if (!O) { ended(); return; }
  const C = O.ctx;
  let buffer = samples;
  if (!(typeof AudioBuffer !== 'undefined' && samples instanceof AudioBuffer)) { buffer = C.createBuffer(1, samples.length, sampleRate); buffer.copyToChannel(samples, 0); }
  source = C.createBufferSource(); source.buffer = buffer;
  // the person's own pitch; the rate given to the model already keeps the pace natural
  source.playbackRate.value = active.who.pitch || 1;
  if (R) {
   panner = C.createPanner();
   Object.assign(panner, { panningModel: COARSE ? 'equalpower' : 'HRTF', distanceModel: 'inverse', refDistance: 2.2, rolloffFactor: 1.15, maxDistance: 40 });
   source.connect(panner).connect(O.dest);
   const q = R.at?.(); if (q) { const r = relative(q); if (panner.positionX) { panner.positionX.value = r.x; panner.positionY.value = r.y; panner.positionZ.value = r.z; } else panner.setPosition(r.x, r.y, r.z); }
   R.started?.(buffer.duration / source.playbackRate.value);
  } else source.connect(O.dest);
  source.onended = () => { source?.disconnect(); source = null; panner?.disconnect(); panner = null; ended(); };
  source.start();
 }
 // load the voices in the background so the first remark in passing is not a long wait (a
 // computer only: a phone loads them through tick, when the world is calm)
 function warm() {
  if (PHONE || ready || warming || !modelAllowed() || mode() === 'device' || !globalThis.Worker) return;
  load(false);
 }
 function load(probe) {
  warming = true;
  try { ensure(); worker.postMessage({ type: 'warm', id: -1, probe }); } catch { warming = false; }
 }
 // A phone, once a frame (people/chatter.js): state { settled, flying, fast, dense }. After a
 // few calm minutes the model loads with a mark left first; it is let go again when the page
 // is hidden or memory runs short.
 function tick(dt, state = {}) {
  if (!PHONE) return;
  const hidden = globalThis.document?.visibilityState === 'hidden';
  if (worker && (hidden || short())) { unload(); return; }
  if (ready || warming || !modelAllowed() || mode() === 'device' || !globalThis.Worker) return;
  if (guard.tick(dt, { ...state, hidden })) { guard.begin(); load(true); }
 }
 // the browser says the page is near its memory limit (only some browsers can tell)
 function short() {
  const M = globalThis.performance?.memory;
  return !!(M && M.jsHeapSizeLimit && M.usedJSHeapSize / M.jsHeapSizeLimit > 0.85);
 }
 if (PHONE && typeof addEventListener === 'function') {
  addEventListener('visibilitychange', () => { if (globalThis.document?.visibilityState === 'hidden') unload(); });
  // leaving the page on purpose is not a crash: the mark goes with it
  addEventListener('pagehide', () => { if (!ready) guard.dropped(); });
 }
 function ensure() {
   if (!worker) {
    worker = new Worker(new URL('./local-speech-worker.js?v=20261014', import.meta.url), { type: 'module' });
    worker.onerror = () => fail();
    worker.onmessage = ({ data }) => {
     // loaded (on a phone, loaded and has made a line): the mark is cleared
     if (data.type === 'ready') { ready = true; warming = false; if (PHONE) guard.spoke(); return; }
     if (data.type === 'cold') { warming = false; if (PHONE) guard.dropped(); return; }
     if (data.type === 'audio') { ready = true; if (PHONE) guard.spoke(); }
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
     // running, on a touch screen, the voices go and the clips and the device voice take
     // over. A phone that falls behind like this is also starving the world it is drawing.
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
      if (out()?.ctx.state !== 'running') status('Tap the speaker to enable audio');
     } catch { fail(); }
    };
   }
 }
 function dispose() { cancel(); worker?.terminate(); worker = null; context?.close().catch(() => {}); context = null; }
 return { speak, remark, place, warm, tick, retry, cancel, unlock, unload, dispose, busy: () => !!active, ready: () => ready, cached: () => made.size, phone: PHONE, clips };
}
