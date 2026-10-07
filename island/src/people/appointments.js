// Meetings people actually keep. When a resident and the player agree a place and a time,
// it becomes a saved appointment: shown in the journal with its game time and the real
// time that equals, walked to by the resident ahead of time, and marked kept or missed
// only by what happens in the game. Saved positions use the social format (lat/lon on
// the globe, x/z elsewhere), so a rebased Earth frame never moves a meeting.
import { advanceSolarClock } from '../world/solar.js';
import { socialDistance } from './social-state.js';

export const APPOINTMENT_KEY = 'crysis-appointments-v1';
// The resident turns up a little early and waits a while past the hour.
export const EARLY = 0.25, GRACE = 1.5;
const STATUS = new Set(['proposed', 'agreed', 'kept', 'missed', 'cancelled']);
const finite = Number.isFinite;
const copy = v => JSON.parse(JSON.stringify(v));
const savedPos = p => p && (finite(p.lat) && finite(p.lon) ? { lat: p.lat, lon: p.lon, y: finite(p.y) ? p.y : 0 } : finite(p.x) && finite(p.z) ? { x: p.x, z: p.z, y: finite(p.y) ? p.y : 0 } : null);
const wrap = h => ((h % 24) + 24) % 24;

// ---------- reading a time out of what someone said ----------
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, half: 0.5, a: 1, an: 1 };
/**
 * A spoken time ("six pm", "at 7:30", "sunset", "tomorrow at noon", "in an hour") becomes
 * game hours from now. Returns null when no time is named.
 * @param {string} text
 * @param {number} now game hours, 0–24
 * @param {{ rise?: number, set?: number }} [sun]
 * @returns {{ delta: number, hours: number, tomorrow: boolean } | null}
 */
export function parseGameTime(text, now, sun = {}) {
	const q = ' ' + String(text || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ') + ' ';
	const tomorrow = /\btomorrow\b/.test(q);
	const rel = q.match(/\bin (?:about |around )?(an?|half an?|\d+(?:\.\d+)?|one|two|three|four|five|six) (hours?|minutes?|mins?)\b/);
	if (rel) {
		const n = /^half/.test(rel[1]) ? 0.5 : WORDS[rel[1]] ?? Number(rel[1]);
		const delta = /^h/.test(rel[2]) ? n : n / 60;
		if (finite(delta) && delta > 0 && delta <= 48) return { delta, hours: wrap(now + delta), tomorrow: false };
	}
	const pm = /\b(tonight|this evening|evening|afternoon|dinner)\b/.test(q), am = /\b(morning|breakfast)\b/.test(q);
	let h = null;
	const clock = q.match(/(?:\bat |\bby |\baround |\babout |@ ?| )(\d{1,2})(?:[:.](\d{2}))? ?(a\.?m\.?|p\.?m\.?|o'?clock)?(?=[\s,.!?])/g);
	for (const m of clock || []) {
		const [, hh, mm, suffix] = m.match(/(\d{1,2})(?:[:.](\d{2}))? ?(a\.?m\.?|p\.?m\.?|o'?clock)?/);
		const prefixed = /^(?: ?at | ?by | ?around | ?about |@)/.test(m);
		if (!suffix && !prefixed) continue; // a bare number is not a time
		let v = Number(hh) + (mm ? Number(mm) / 60 : 0);
		if (v > 24 || (mm && Number(mm) > 59)) continue;
		if (/^p/.test(suffix || '') && v < 12) v += 12;
		if (/^a/.test(suffix || '') && v >= 12) v -= 12;
		if (!suffix || /o'?clock/.test(suffix)) { if (pm && v < 12) v += 12; else if (!am && v < 12 && v <= 6) v += 12; }
		h = v; break;
	}
	if (h === null) {
		const word = q.match(/\b(?:at |by |around )(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?: o'?clock)?\b/);
		if (word) { h = WORDS[word[1]]; if ((pm || h <= 6) && h < 12) h += 12; }
	}
	if (h === null) {
		if (/\bnoon\b|\bmidday\b|\blunch\b/.test(q)) h = 12;
		else if (/\bmidnight\b/.test(q)) h = 0;
		else if (/\b(sunset|dusk|sundown)\b/.test(q)) h = finite(sun.set) ? sun.set : 19;
		else if (/\b(sunrise|dawn|daybreak)\b/.test(q)) h = finite(sun.rise) ? sun.rise : 6.5;
		else if (/\bbreakfast\b/.test(q)) h = 8;
		else if (/\bdinner\b/.test(q)) h = 19;
		else if (/\btonight\b/.test(q)) h = 20;
		else if (/\bthis evening\b|\bin the evening\b/.test(q)) h = 19;
		else if (/\bthis afternoon\b|\bin the afternoon\b/.test(q)) h = 15;
		else if (/\b(this|tomorrow|in the) morning\b/.test(q)) h = 9;
	}
	if (h === null) return null;
	h = wrap(h);
	let delta = wrap(h - now);
	if (delta < 0.05) delta += 24; // "at six" said at six means the next one
	if (tomorrow && (now + delta) < 24) delta += 24;
	return { delta, hours: h, tomorrow };
}

/** How many real seconds the sky's clock takes to advance by `gameHours`. */
export function realSecondsFor(gameHours, from, sky) {
	const S = sky || {}, speed = S.speed ?? 1;
	if (!(gameHours > 0)) return 0;
	if (S.real) return gameHours * 3600;
	if (!(speed > 0) || !S.sun) return Infinity;
	// The clock runs slower by day than by night: step it rather than guess a rate.
	let h = from, gone = 0, t = 0;
	const dt = 2 / Math.max(speed, 0.05);
	while (gone < gameHours && t < 200000) {
		const next = advanceSolarClock(h, dt, speed, S.sun);
		gone += wrap(next - h); h = next; t += dt;
	}
	return t;
}

export function formatClock(h) {
	const m = Math.round(wrap(h) * 60) % 1440, hh = Math.floor(m / 60), mm = m % 60;
	if (m === 720) return 'noon'; if (m === 0) return 'midnight';
	return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`;
}
export function formatReal(seconds) {
	if (!finite(seconds)) return 'clock paused';
	if (seconds < 50) return 'under a minute';
	const m = Math.round(seconds / 60);
	if (m < 60) return `about ${m} real minute${m === 1 ? '' : 's'}`;
	const h = Math.floor(m / 60), r = m % 60;
	return `about ${h} h${r ? ` ${r} min` : ''} real time`;
}

// ---------- the saved book of meetings ----------
function validSave(d) {
	if (!d || d.version !== 1 || !finite(d.day) || !Array.isArray(d.list) || d.list.length > 40) return false;
	return d.list.every(a => a && typeof a.id === 'string' && typeof a.bodyKey === 'string' && typeof a.npcId === 'string' && STATUS.has(a.status) && finite(a.due) && a.place && savedPos(a.place.pos));
}

export function createAppointments({ storage, now = Date.now } = {}) {
	if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
	let data = { version: 1, day: 0, hours: null, seq: 0, list: [] }, error = null;
	try { const raw = storage?.getItem(APPOINTMENT_KEY); if (raw) { const d = JSON.parse(raw); if (validSave(d)) data = d; } }
	catch { error = 'Saved meetings could not be read.'; }
	function save() {
		try { storage?.setItem(APPOINTMENT_KEY, JSON.stringify(data)); error = null; return true; }
		catch { error = 'Meetings are kept for this session, but this browser could not save them.'; return false; }
	}
	/** The game's absolute time, in hours: days counted since the first meeting was made. */
	const clock = (hours = data.hours ?? 0) => data.day * 24 + hours;
	function setHours(hours) {
		if (!finite(hours)) return;
		const before = data.hours;
		// Past midnight (or a clock dragged back by over half a day): a new day begins.
		if (before !== null && hours < before - 12) { data.day++; save(); }
		data.hours = hours;
	}
	function make({ bodyKey, npcId, npcName, place, hours, delta, by = 'player', status = by === 'player' ? 'agreed' : 'proposed' }) {
		const pos = savedPos(place?.pos);
		if (!bodyKey || !npcId || !pos || !finite(delta) || !STATUS.has(status)) return { ok: false, error: 'That meeting has no place or time.' };
		setHours(hours ?? data.hours ?? 0);
		// One standing arrangement per person: a new plan replaces the old one.
		for (const a of data.list) if (a.npcId === npcId && a.bodyKey === bodyKey && ['proposed', 'agreed'].includes(a.status)) { a.status = 'cancelled'; a.endedAt = now(); }
		while (data.list.length >= 40) { const i = data.list.findIndex(a => !['proposed', 'agreed'].includes(a.status)); if (i < 0) return { ok: false, error: 'Too many meetings are planned.' }; data.list.splice(i, 1); }
		const a = { id: `meet-${++data.seq}`, bodyKey, npcId, npcName: String(npcName || 'Someone').slice(0, 80), by, status,
			place: { name: String(place.name || 'here').slice(0, 100), pos, radius: Math.max(6, Math.min(40, place.radius || 12)) },
			due: clock() + delta, madeAt: now(), endedAt: null, npcArrived: false };
		data.list.push(a); save();
		return { ok: true, appointment: copy(a) };
	}
	function set(id, status) {
		const a = data.list.find(a => a.id === id);
		if (!a || !['proposed', 'agreed'].includes(a.status)) return { ok: false, error: 'That meeting is no longer open.' };
		a.status = status; if (status !== 'agreed') a.endedAt = now(); save();
		return { ok: true, appointment: copy(a) };
	}
	const open = a => a.status === 'agreed' || a.status === 'proposed';
	const list = bodyKey => copy(data.list.filter(a => !bodyKey || a.bodyKey === bodyKey));
	const pendingFrom = (npcId, bodyKey) => copy(data.list.filter(a => a.status === 'proposed' && a.npcId === npcId && a.bodyKey === bodyKey).at(-1) || null);
	const agreedWith = (npcId, bodyKey) => copy(data.list.filter(a => a.status === 'agreed' && a.npcId === npcId && a.bodyKey === bodyKey).at(-1) || null);
	/**
	 * Advance the meetings by the game clock and the player's position (saved format).
	 * Returns what changed: { type: 'go'|'due'|'kept'|'missed'|'expired', appointment }.
	 */
	function tick({ hours, bodyKey, player, lead = 0.5 } = {}) {
		setHours(hours);
		const t = clock(), out = [];
		let dirty = false;
		for (const a of data.list) {
			if (!open(a) || a.bodyKey !== bodyKey) continue;
			if (a.status === 'proposed') { if (t > a.due) { a.status = 'cancelled'; a.endedAt = now(); dirty = true; out.push({ type: 'expired', appointment: copy(a) }); } continue; }
			if (!a.npcGoing && t >= a.due - EARLY - lead) { a.npcGoing = true; dirty = true; out.push({ type: 'go', appointment: copy(a) }); }
			if (!a.npcArrived && t >= a.due - EARLY) { a.npcArrived = true; dirty = true; out.push({ type: 'due', appointment: copy(a) }); }
			const here = player && socialDistance(player, a.place.pos) <= a.place.radius;
			if (here && t >= a.due - EARLY && t <= a.due + GRACE) { a.status = 'kept'; a.endedAt = now(); dirty = true; out.push({ type: 'kept', appointment: copy(a) }); }
			else if (t > a.due + GRACE) { a.status = 'missed'; a.endedAt = now(); dirty = true; out.push({ type: 'missed', appointment: copy(a) }); }
		}
		if (dirty) save();
		return out;
	}
	return { make, agree: id => set(id, 'agreed'), cancel: id => set(id, 'cancelled'), list, pendingFrom, agreedWith, tick, clock, setHours,
		status: () => ({ error, day: data.day, open: data.list.filter(open).length }) };
}

// ---------- recognising an arrangement in conversation ----------
const MEET_RE = /\b(meet(?:\s+(?:me|up|you|us))?|see you|catch up|hang out|get together|come find me|find me|i'?ll be (?:at|by|waiting)|join me)\b/i;
export const MEET_TAG_RE = /\[\[\s*meet\s*:\s*([^\]@]+?)\s*@\s*([^\]]+?)\s*\]\]/gi;
/** True when a line is about arranging to meet (not a time or place by itself). */
export function talksOfMeeting(text) {
	const q = String(text || '');
	if (!MEET_RE.test(q)) return false;
	return !/\b(nice to meet you|pleased to meet you|good to meet you|meet new people|never met|have we met|met before|see you around|see you later|see ya)\b/i.test(q) || /\b(at|by|around)\s+\d|\b(noon|sunset|sunrise|dawn|dusk|tonight|tomorrow|midnight)\b/i.test(q);
}
/** Candidate place phrases after "at/by/near/outside", longest first, for the game to resolve. */
export function placePhrases(text, speaker = 'player') {
	const q = String(text || '').replace(/[’]/g, "'");
	const out = [];
	for (const m of q.matchAll(/\b(?:at|by|near|outside|in front of|over at|down at|up at|in)\s+((?:the\s+)?[\p{L}][\p{L}\p{N}' .-]{1,60})/giu)) {
		let s = m[1].split(/[,.!?;]| (?:at|around|by|tomorrow|tonight|this|in|when|and|then|so|if|before|after)\b/i)[0].trim();
		s = s.replace(/\b(sunset|sunrise|dawn|dusk|noon|midnight|tonight|tomorrow|morning|afternoon|evening|o'?clock|\d.*)$/i, '').trim();
		if (s.length > 1 && !/^(the )?(time|moment|least|all|once|first|last|some point|night|day|hour|minute)$/i.test(s)) out.push(s);
	}
	if (/\b(right here|this spot|here)\b/i.test(q)) out.push('here');
	// "your place" from the player and "my place" from the resident both mean the resident's home.
	if (new RegExp(`\\b${speaker === 'npc' ? 'my' : 'your'} (place|house|home|spot)\\b`, 'i').test(q)) out.unshift('npc-home');
	return [...new Set(out)];
}
