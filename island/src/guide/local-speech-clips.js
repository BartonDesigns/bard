// Lines made ahead of time in the local voices (assets/voices, made by
// tools/build-voice-clips.mjs). Each piece of a line is its own small file, fetched the first
// time someone says it and kept by the browser after that (the Cache API), so the common
// lines sound like the local voices on any device with no model in memory at all.
import { clipId } from './local-speech-plan.js';

const CACHE = 'l99-voices-v1';
// decoded pieces kept for a replay: a few, since each is a second or two at the output rate
const KEEP = 8;

// manifest.json: { version, format, voices: { <voice>: [<clip id>, ...] } }
export function readManifest(json) {
 const voices = new Map();
 if (!json || typeof json !== 'object' || !json.voices || typeof json.voices !== 'object') return { format: 'mp3', voices };
 for (const [voice, ids] of Object.entries(json.voices)) if (/^[a-z]{2}_[a-z]+$/.test(voice) && Array.isArray(ids)) voices.set(voice, new Set(ids.filter((x) => typeof x === 'string')));
 return { format: /^(mp3|ogg|webm|m4a)$/.test(json.format) ? json.format : 'mp3', voices };
}

export function createClipStore({ base = new URL('../assets/voices/', import.meta.url).href, fetchFn = (...a) => globalThis.fetch(...a), cacheStorage = () => globalThis.caches } = {}) {
 let manifest = null, loading = null;
 const decoded = new Map();
 // read the list of clips once, the first time it is wanted
 function load() {
  if (manifest) return Promise.resolve(manifest);
  if (!loading) loading = Promise.resolve().then(() => fetchFn(base + 'manifest.json')).then((r) => (r?.ok ? r.json() : null)).catch(() => null).then((json) => (manifest = readManifest(json)));
  return loading;
 }
 const has = (voice, chunk) => !!manifest?.voices.get(voice)?.has(clipId(chunk));
 const urlOf = (voice, chunk) => `${base}${voice}/${clipId(chunk)}.${manifest?.format || 'mp3'}`;
 async function bytes(url) {
  let store = null;
  try { store = await cacheStorage()?.open(CACHE); const hit = await store?.match(url); if (hit) return await hit.arrayBuffer(); } catch { store = null; }
  const r = await fetchFn(url);
  if (!r?.ok) throw new Error('clip ' + (r?.status || 'failed'));
  const data = await r.arrayBuffer();
  try { await store?.put(url, new Response(data.slice(0), { headers: { 'content-type': r.headers?.get?.('content-type') || 'audio/mpeg' } })); } catch {}
  return data;
 }
 function decode(ctx, data) {
  // the callback form too: older Safari has no promise from decodeAudioData
  return new Promise((resolve, reject) => { const p = ctx.decodeAudioData(data, resolve, reject); if (p?.then) p.then(resolve, reject); });
 }
 // every piece of a line, decoded for this audio context, or a refusal (then nothing is played)
 async function line(voice, chunks, ctx) {
  return Promise.all(chunks.map(async (chunk) => {
   const url = urlOf(voice, chunk);
   const kept = decoded.get(url);
   if (kept && kept.sampleRate === ctx.sampleRate) { decoded.delete(url); decoded.set(url, kept); return kept; }
   const buffer = await decode(ctx, await bytes(url));
   decoded.set(url, buffer);
   while (decoded.size > KEEP) decoded.delete(decoded.keys().next().value);
   return buffer;
  }));
 }
 return { load, has, line, ready: () => !!manifest, count: (voice) => manifest?.voices.get(voice)?.size || 0 };
}
