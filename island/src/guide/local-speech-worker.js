// Synthesis stays off the render thread. The quantized model is cached by Transformers.js.
let modelPromise, current = 0, pendingAck;
const send = (type, id, extra = {}, transfer = []) => self.postMessage({ type, id, ...extra }, transfer);
async function model(id) {
 if (!modelPromise) modelPromise = (async () => {
  send('status', id, { text: 'Downloading local voices (about 100 MB)…' });
  const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js');
  return KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
   dtype: 'q8', device: 'wasm',
   progress_callback: p => { if (p.status === 'progress' && p.file?.includes('onnx')) send('status', current, { text: `Downloading local voices · ${Math.round(p.progress || 0)}%` }); },
  });
 })().catch(error => { modelPromise = null; throw error; });
 return modelPromise;
}
let chain = Promise.resolve();
self.onmessage = ({ data }) => {
 // fetch and load the model ahead of the first line, without touching what is being said
 if (data.type === 'warm') { model(current).then(() => send('ready', data.id), () => send('cold', data.id)); return; }
 if (data.type === 'ack') { if (data.id === current) { pendingAck?.(); pendingAck = null; } return; }
 current = data.id;
 pendingAck?.(); pendingAck = null;
 if (data.type !== 'speak') return;
 const { id, chunks, voice, speed } = data;
 chain = chain.catch(() => {}).then(async () => {
  if (id !== current) return;
  try {
   const tts = await model(id);
   if (id !== current) return;
   send('status', id, { text: 'Local voices ready' });
   for (let index = 0; index < chunks.length; index++) {
    if (id !== current) return;
    const t0 = performance.now();
    const audio = await tts.generate(chunks[index], { voice, speed });
    const ms = performance.now() - t0;
    if (id !== current) return;
    const samples = new Float32Array(audio.audio);
    const played = new Promise(resolve => { pendingAck = resolve; });
    send('audio', id, { index, samples, sampleRate: audio.sampling_rate, ms }, [samples.buffer]);
    await played;
   }
   if (id === current) send('done', id);
  } catch (error) { if (id === current) send('error', id, { message: String(error.message || error) }); }
 });
};
