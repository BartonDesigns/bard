// Spoken audio is separate from the conversation model. No speech API or GPU host is used.
const FEMALE = ['af_heart', 'af_bella', 'af_nicole', 'af_sarah'];
const MALE = ['am_michael', 'am_fenrir', 'am_puck', 'bm_george'];
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
 let worker, context, source, request = 0, timer, active, unavailable = false;
 const status = text => onStatus(text);
 function unlock() {
  try {
   const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
   if (!context && AC) context = new AC();
   if (context?.state === 'suspended') context.resume().catch(() => {});
   return Boolean(context);
  } catch { return false; }
 }
 function clearTimer() { clearTimeout(timer); }
 function fail() {
  clearTimer(); worker?.terminate(); worker = null; unavailable = true;
  if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); source = null; }
  const remaining = active?.chunks.slice(active.completed).join(' ');
  const who = active?.who; active = null;
  status('Local voices unavailable · using device voice');
  if (remaining) fallback(remaining, who);
 }
 function arm() { clearTimer(); timer = setTimeout(fail, 240000); }
 function cancel() {
  clearTimer(); request++; if (active) status(''); active = null;
  if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); source = null; }
  worker?.postMessage({ type: 'cancel', id: request });
 }
 function speak(text, who = {}) {
  cancel(); const chunks = speechChunks(text); if (!chunks.length) return;
  if (unavailable || !unlock() || !globalThis.Worker) { status('Using device voice'); fallback(text, who); return; }
  const id = request; active = { chunks, who, completed: 0 };
  try {
   if (!worker) {
    worker = new Worker(new URL('./local-speech-worker.js?v=20261012', import.meta.url), { type: 'module' });
    worker.onerror = fail;
    worker.onmessage = ({ data }) => {
     if (data.id !== request || !active) return;
     const messageId = data.id;
     if (data.type === 'status') { status(data.text); return; }
     if (data.type === 'error') { fail(); return; }
     if (data.type === 'done') { clearTimer(); active = null; return; }
     if (data.type !== 'audio') return;
     clearTimer();
     try {
      const buffer = context.createBuffer(1, data.samples.length, data.sampleRate);
      buffer.copyToChannel(data.samples, 0);
      source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
      source.onended = () => {
       source?.disconnect(); source = null;
       if (messageId !== request || !active) return;
       active.completed = data.index + 1; arm();
       worker?.postMessage({ type: 'ack', id: messageId });
      };
      source.start();
      if (context.state !== 'running') status('Tap the speaker to enable audio');
     } catch { fail(); }
    };
   }
   status('Preparing local voice…'); arm();
   worker.postMessage({ type: 'speak', id, chunks, voice: localVoice(who), speed: Math.max(.85, Math.min(1.15, who.rate || 1)) });
  } catch { fail(); }
 }
 function dispose() { cancel(); worker?.terminate(); worker = null; context?.close().catch(() => {}); context = null; }
 return { speak, cancel, unlock, dispose };
}
