// The multiplayer rooms' wire format, shared by the game and the rooms server
// (server/multiplayer). Messages are small JSON objects with a type `t`. Everything a client
// sends is cleaned here, on both sides: only these fields, bounded, ever travel. Nothing from
// a conversation with a townsperson is part of any of them.

export const VERSION = 1;
export const MAX_PLAYERS = 8;
// one message's size, in characters
export const MAX_BYTES = 3072;
// messages a second each player may send, and the burst allowed over it
export const RATE = 20, BURST = 40;
// silence (no message and no ping) that counts as gone
export const STALE_MS = 30000;
// an empty room is kept this long for a reconnect, then forgotten
export const EMPTY_MS = 30 * 60 * 1000;
export const EVENTS_MAX = 30;
export const ANIMS = ['idle', 'walk', 'run', 'fly', 'drive', 'swim'];
export const VEHICLES = ['', 'car', 'boat'];
// room codes: six letters and digits, none that read alike (no 0/O, 1/I/L)
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;

const num = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n) : '');

export function newCode(rand = Math.random) {
	let s = '';
	for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(rand() * ALPHA.length) % ALPHA.length];
	return s;
}
export const cleanCode = (c) => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return CODE_RE.test(s) ? s : ''; };
export const cleanName = (n) => str(n, 24) || 'Friend';
// what a player looks like: the seed of their MakeHuman body (people/avatar.js)
export const cleanLook = (l) => ({ seed: num(+l?.seed, 4294967295) ? (+l.seed >>> 0) || 1 : 1 });

// a pose: where (metres, eye height), facing, how moving, in what, on which world
export function cleanPose(p) {
	if (!p || typeof p !== 'object' || !Array.isArray(p.p) || p.p.length !== 3 || !p.p.every((v) => num(v, 5e7))) return null;
	const o = { p: p.p.map(r2), y: num(p.y, 1e4) ? r3(p.y) : 0, a: ANIMS.includes(p.a) ? p.a : 'idle' };
	if (VEHICLES.includes(p.v) && p.v) o.v = p.v;
	if (num(p.s, 1e5)) o.s = r2(p.s);
	o.w = str(p.w, 48);
	// the item in their hand, if any (a game catalogue id, gameplay/arms.js), with its level
	// (1-10) and quality tier (0-4), which friends see as its trim and glow
	if (ITEM_RE.test(p.h || '')) {
		o.h = p.h;
		if (Number.isInteger(p.hl) && p.hl >= 1 && p.hl <= 10) o.hl = p.hl;
		if (Number.isInteger(p.ht) && p.ht >= 0 && p.ht <= 4) o.ht = p.ht;
	}
	return o;
}

// trading between two players (gameplay/trade.js): addressed to one, passed on to that one only
export const TRADE_OPS = ['propose', 'seen', 'update', 'accept', 'commit', 'done', 'cancel', 'fail'];
const ITEM_RE = /^[a-z0-9-]{1,40}$/;
const TRADE_ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const KEY_RE = /^\d{1,6}\.\d{1,6}$/;
const int = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
// one side of an offer: credits and up to 12 item instances, each { u: its id, i: the item,
// l: level 1-10, t: tier 0-4 (Common to Legendary), x: experience }, no id twice
const UID_RE = /^[a-z0-9~-]{4,24}$/;
export function cleanTradeSide(s) {
	if (!s || typeof s !== 'object' || !int(s.credits ?? 0, 1e6)) return null;
	const raw = s.items ?? [];
	if (!Array.isArray(raw) || raw.length > 12) return null;
	const items = [], seen = new Set();
	for (const x of raw) {
		if (!x || typeof x !== 'object' || !UID_RE.test(x.u || '') || !ITEM_RE.test(x.i || '') || seen.has(x.u)) return null;
		if (!Number.isInteger(x.l) || x.l < 1 || x.l > 10 || !int(x.t, 4) || !int(x.x ?? 0, 1e6)) return null;
		seen.add(x.u);
		items.push({ u: x.u, i: x.i, l: x.l, t: x.t, x: x.x ?? 0 });
	}
	return { credits: s.credits ?? 0, items };
}
export function cleanTrade(m) {
	if (!m || typeof m !== 'object' || !TRADE_OPS.includes(m.op) || !TRADE_ID_RE.test(m.id || '')) return null;
	const o = { op: m.op, id: m.id };
	if (m.to !== undefined) { if (!ID_RE.test(m.to)) return null; o.to = m.to; }
	if (m.key !== undefined) { if (!KEY_RE.test(m.key)) return null; o.key = m.key; }
	if (m.v !== undefined) { if (!int(m.v, 1e6)) return null; o.v = m.v; }
	if (m.side !== undefined) { const s = cleanTradeSide(m.side); if (!s) return null; o.side = s; }
	if (m.sides !== undefined) {
		const a = cleanTradeSide(m.sides?.a), b = cleanTradeSide(m.sides?.b);
		if (!a || !b) return null;
		o.sides = { a, b };
	}
	if (m.why !== undefined) o.why = str(m.why, 20);
	return o;
}
// a spot code (share.js pack): base64url, bounded
export const cleanSpot = (c) => (typeof c === 'string' && c.length <= 1200 && /^[A-Za-z0-9_-]+$/.test(c) ? c : '');

// the host's world: the hour, how fast it runs, and the weather
export function cleanState(s) {
	if (!s || typeof s !== 'object') return null;
	const o = { hours: num(s.hours, 48) ? ((r3(s.hours) % 24) + 24) % 24 : 12, speed: num(s.speed, 1000) ? r3(s.speed) : 1, real: !!s.real };
	const w = s.weather;
	// the host's game clock in hours since its first day (people/appointments.js clock()),
	// which the events' times are on
	if (num(s.clock, 1e8)) o.clock = r3(s.clock);
	o.weather = { mode: ['auto', 'clear', 'fair', 'showers', 'storm'].includes(w?.mode) ? w.mode : 'auto', day: num(w?.day, 1e6) ? Math.round(w.day) : 0 };
	return o;
}

// a meeting or gathering the host made, as plain public data: who (the resident's name),
// where, when (on the host's game clock, see cleanState), and a gathering's kind, size and seed. No words said.
const KINDS = ['concert', 'party', 'picnic', 'meetup'];
const STATUS = ['agreed', 'cancelled', 'kept', 'missed'];
export function cleanEvent(e) {
	if (!e || typeof e !== 'object' || !/^[A-Za-z0-9_:-]{1,60}$/.test(e.id || '')) return null;
	const q = e.place?.pos;
	if (!q || typeof q !== 'object') return null;
	const pos = {};
	for (const k of ['x', 'y', 'z', 'lat', 'lon']) if (num(q[k], 5e7)) pos[k] = k === 'lat' || k === 'lon' ? Math.round(q[k] * 1e7) / 1e7 : r2(q[k]);
	if (!(num(pos.x, 5e7) && num(pos.z, 5e7)) && !(num(pos.lat, 90) && num(pos.lon, 180))) return null;
	if (!num(e.due, 1e8)) return null;
	const o = {
		id: e.id, kind: e.gathering ? 'gathering' : 'meeting', status: STATUS.includes(e.status) ? e.status : 'agreed',
		npcName: str(e.npcName, 60) || 'Someone', due: r3(e.due),
		place: { name: str(e.place.name, 80) || 'here', pos, radius: num(e.place.radius, 100) ? Math.max(4, e.place.radius) : 12 },
	};
	const g = e.gathering;
	if (g) {
		if (!KINDS.includes(g.kind) || !Number.isInteger(g.size) || g.size < 1 || g.size > 30 || !num(g.seed, 4294967295)) return null;
		o.gathering = { kind: g.kind, title: str(g.title, 30) || g.kind, size: g.size, seed: g.seed >>> 0 };
	}
	return o;
}
