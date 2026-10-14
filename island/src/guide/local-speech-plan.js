// The rules behind the voices, kept apart from the audio so they can be tested: which voice
// a person has, how a line is cut up, and where each line comes from at the moment it is said.
//
// Sources, best first: a clip made ahead of time (tools/build-voice-clips.mjs, no model in
// memory at all), the local model when it is loaded, and the device's own voice. A line picks
// one source before it starts and keeps it to the end.

// the voices a person can have: the same ones the clips are made in, so a person sounds the
// same from a clip, from the model and (as near as it gets) from the device
export const FEMALE = ['af_heart', 'af_bella', 'bf_emma'];
export const MALE = ['am_michael', 'am_fenrir', 'bm_george'];
export const VOICES = [...FEMALE, ...MALE];

export function localVoice(who = {}) {
 const pool = who.male === false ? FEMALE : MALE;
 return pool[Math.abs(Math.trunc(Number(who.seed) || 0)) % pool.length];
}

export function speechChunks(text) {
 const sentences = String(text || '').replace(/\s+/g, ' ').trim().match(/[^.!?]+(?:[.!?]+["'”’]*|$)/g) || [];
 return sentences.flatMap(sentence => {
  const words = sentence.trim().split(/\s+/), chunks = []; let part = '';
  for (const word of words) { if (part && part.length + word.length > 220) { chunks.push(part); part = ''; } part += (part ? ' ' : '') + word; }
  if (part) chunks.push(part);
  return chunks;
 });
}

// a clip's name: a short hash of the words (one piece of a line, as speechChunks cuts it)
export function clipId(chunk) {
 const s = String(chunk || '').replace(/\s+/g, ' ').trim();
 let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
 for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
 h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
 h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
 return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// a phone, or anything with the memory of one
export function phoneLike({ coarse = false, userAgent = '', deviceMemory = 8 } = {}) {
 return Boolean(coarse) || /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent) || (Number(deviceMemory) || 8) < 6;
}

// the player's choice in the guide's settings (preferences.js): best | device | local
// line: { chunks, hasClip(chunk) }; state: { mode, phone, modelReady, modelAllowed, talk }
// Returns 'clip', 'model', 'device' or 'none' (a remark with nothing to say it: its caption).
export function chooseSource({ chunks = [], hasClip = () => false } = {}, { mode = 'best', phone = false, modelReady = false, modelAllowed = true, talk = false, deviceOk = true } = {}) {
 if (!chunks.length) return 'none';
 if (mode === 'device') return deviceOk ? 'device' : 'none';
 if (chunks.every((c) => hasClip(c))) return 'clip';
 if (modelReady && modelAllowed) return 'model';
 // a conversation on a computer (or a phone told to use the local voices) waits for the
 // model to load, as it always has; anything else is said now, in the device's voice
 if (talk && modelAllowed && (!phone || mode === 'local')) return 'model';
 return deviceOk ? 'device' : 'none';
}

// the device's voice for a person: a voice of their sex where the device has one, chosen by
// their seed, pitched and paced like their own (so falling back is not a jolt)
const FEMALE_NAMES = /female|woman|samantha|victoria|karen|moira|tessa|zira|susan|fiona|allison|\bava\b|serena|\bkate\b|catherine|martha|nicky|libby|sonia|jenny|\baria\b|emma|\bamy\b|joanna|salli|kimberly/i;
const MALE_NAMES = /\bmale\b|daniel|alex\b|fred|david|mark|\btom\b|oliver|aaron|rishi|arthur|gordon|ryan|\bguy\b|george|brian|matthew|joey|justin/i;
export function deviceVoiceFor(who = {}, voices = []) {
 const en = voices.filter((v) => /^en/i.test(v.lang || ''));
 const female = who.male === false;
 const fem = en.filter((v) => FEMALE_NAMES.test(v.name || '')), mal = en.filter((v) => MALE_NAMES.test(v.name || '') && !FEMALE_NAMES.test(v.name || ''));
 const pool = female ? (fem.length ? fem : en) : (mal.length ? mal : en);
 // better voices first where the name says so, then by seed among them
 const good = pool.filter((v) => /natural|premium|enhanced|neural|google/i.test(v.name || ''));
 const from = good.length ? good : pool;
 const voice = from.length ? from[Math.abs(Math.trunc(Number(who.seed) || 0)) % from.length] : null;
 // the voice has no sex we could find: the pitch carries it instead
 const lean = voice && (female ? fem.includes(voice) : mal.includes(voice)) ? 0 : female ? 0.12 : -0.1;
 const pitch = Math.max(0.6, Math.min(1.6, (Number(who.pitch) || 1) + lean));
 const rate = Math.max(0.8, Math.min(1.25, (Number(who.rate) || 1) * 1.02));
 return { voice, pitch, rate };
}

// Loading the model on a phone, a step at a time. It is only tried once the world has been
// calm for a few minutes; a mark is left in storage first and cleared once the model has
// spoken, so a phone whose page was closed by the load (the white flash) is known next time
// and keeps to the clips and the device voice until the player asks again.
export const LOADING_KEY = 'crysis-voice-loading';
export const UNABLE_KEY = 'crysis-voice-unable';
export const CALM_SECONDS = 180;
export function createLoadGuard({ storage = null, calmFor = CALM_SECONDS } = {}) {
 const get = (k) => { try { return storage?.getItem(k) ?? null; } catch { return null; } };
 const set = (k, v) => { try { if (v == null) storage?.removeItem(k); else storage?.setItem(k, v); } catch {} };
 // the last load never finished: the page went with it
 if (get(LOADING_KEY)) { set(UNABLE_KEY, '1'); set(LOADING_KEY, null); }
 let calm = 0, loading = false;
 return {
  unable: () => get(UNABLE_KEY) === '1',
  calm: () => calm,
  // state: { settled, flying, fast, dense, hidden }; true when it is time to load
  tick(dt, state = {}) {
   if (loading || get(UNABLE_KEY) === '1') return false;
   const still = state.settled && !state.flying && !state.fast && !state.dense && !state.hidden;
   calm = still ? calm + dt : 0;
   return calm >= calmFor;
  },
  begin() { loading = true; set(LOADING_KEY, '1'); },
  // loaded and has said a line: the phone can hold it
  spoke() { loading = false; set(LOADING_KEY, null); },
  // let go without a crash (hidden, memory, too slow): the next try waits for calm again
  dropped() { loading = false; calm = 0; set(LOADING_KEY, null); },
  // the player asked for the local voices again
  reset() { loading = false; calm = 0; set(LOADING_KEY, null); set(UNABLE_KEY, null); },
 };
}
