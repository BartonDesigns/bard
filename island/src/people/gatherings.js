// Gatherings: a concert, picnic, party or meet-up a resident organises at a place and a
// time. The saved state is the appointment itself (appointments.js) carrying a small
// `gathering` record of plain data, so a future multiplayer sync can share it. Who is
// where, and when, is worked out from that record and the game clock alone.

// game hours: the crowd drifts in over ARRIVE before the hour, stays HOURS, and is gone LEAVE after
export const ARRIVE = 0.6, HOURS = 1, LEAVE = 0.3;
export const KINDS = {
	concert: { title: 'Concert', few: 14, many: 25, phone: 14 },
	party: { title: 'Party', few: 10, many: 18, phone: 10 },
	picnic: { title: 'Picnic', few: 8, many: 12, phone: 8 },
	meetup: { title: 'Meet-up', few: 8, many: 10, phone: 6 },
	// a few people at a window for something in the sky (the Moon colony's earthrise)
	watch: { title: 'Earthrise watch', few: 5, many: 6, phone: 4 },
};
const OPEN = /\b(park|plaza|square|beach|field|green|common|meadow|lawn|garden|gardens|stadium|pier|village|commons)\b/i;

function hash(n) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
export function seededRandom(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- recognising the request ----------
const ASK = /\b(gather|rally|round up|bring (?:some |a few |the |together )?(?:people|folks|everyone|friends|neighbou?rs|the (?:town|village))|get (?:some )?(?:people|everyone|folks|the (?:town|village)) together|(?:throw|host|organi[sz]e|plan|put on|set up|hold|start|have|run|do) (?:us |me )?(?:a |an |some )?(?:little |big |small )?(?:concert|party|picnic|gig|show|meet-?up|gathering|get-together|jam|dance|block party|cookout|barbecue|bbq))\b/i;
/** The kind of gathering asked for, or null when the words do not ask for one. */
export function gatherRequest(text) {
	const q = String(text || '').toLowerCase().replace(/[’]/g, "'");
	if (!ASK.test(q) || /\b(don't|do not|never|shouldn't|what if|imagine)\b/.test(q)) return null;
	const kind = /\b(concert|gig|show|music|band|jam|perform|sing|song)/.test(q) ? 'concert'
		: /\b(picnic|cookout|barbecue|bbq|lunch)\b/.test(q) ? 'picnic'
			: /\b(party|dance|celebrat|birthday)/.test(q) ? 'party' : 'meetup';
	return { kind };
}
/** A sensible time when none was named: this evening, or an hour from now when it is late. */
export function defaultGatherTime(now) {
	const h = ((now % 24) + 24) % 24;
	if (h >= 5 && h < 17.5) return { delta: 19 - h, hours: 19, tomorrow: false };
	const at = Math.ceil((h + 1) * 2) / 2;
	return { delta: at - h, hours: at % 24, tomorrow: false };
}
/** How many come: more in open public places, fewer on a phone. */
export function crowdSize(kind, placeName, phone = false, seed = 1) {
	const K = KINDS[kind] || KINDS.meetup, open = OPEN.test(String(placeName || ''));
	const n = open ? K.many - Math.floor(hash(seed) * 3) : K.few + Math.floor(hash(seed) * 3);
	return Math.max(6, Math.min(phone ? K.phone : K.many, n));
}
export function makeGathering({ kind, placeName, phone = false, seed = 1 }) {
	const k = KINDS[kind] ? kind : 'meetup';
	return { kind: k, title: KINDS[k].title, size: crowdSize(k, placeName, phone, seed), seed: seed >>> 0 };
}
export function validGathering(g) {
	return !!g && typeof g === 'object' && !!KINDS[g.kind] && Number.isInteger(g.size) && g.size > 0 && g.size <= 30 && Number.isFinite(g.seed);
}

// ---------- the timetable ----------
/** 'before' | 'arriving' | 'on' | 'dispersing' | 'over' at absolute game time t. */
export function gatheringStage(a, t) {
	if (t < a.due - ARRIVE) return 'before';
	if (t < a.due) return 'arriving';
	if (t < a.due + HOURS) return 'on';
	if (t < a.due + HOURS + LEAVE) return 'dispersing';
	return 'over';
}
/** When member i turns up (game hours): spread over the arrival window, some a little late. */
export function memberCome(a, i) { const g = a.gathering; return a.due - ARRIVE + ARRIVE * 1.15 * ((i + hash(g.seed + i * 7)) / g.size); }
/** When member i walks away. */
export function memberGo(a, i) { return a.due + HOURS + LEAVE * 0.8 * hash(a.gathering.seed * 3 + i * 13); }
/** 0 away, 1 here, 2 gone, for member i at time t. */
export function memberWant(a, i, t) { return t < memberCome(a, i) ? 0 : t < memberGo(a, i) ? 1 : 2; }

// ---------- where they stand ----------
/**
 * Spots round the focal point (0,0) in the gathering's own frame: a loose crowd in front
 * of a concert's stage (+z away from it), a ring round a picnic, a cluster at a party, small
 * groups at a meet-up. Each spot faces the focus, or its neighbour for a chat.
 * @returns {Float32Array} x, z, yaw for each member
 */
export function crowdLayout(kind, n, seed = 1) {
	const r = seededRandom(seed ^ 0x9e37), out = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		let x, z;
		if (kind === 'concert') {
			const row = Math.floor(i / 7), a = (r() - 0.5) * (1.6 - row * 0.15);
			const d = 6 + row * 1.6 + r() * 1.2;
			x = Math.sin(a) * d; z = Math.cos(a) * d;
		} else if (kind === 'picnic') {
			const a = (i / n) * Math.PI * 2 + r() * 0.3, d = 2.6 + r() * 1.4 + (i % 2) * 0.8;
			x = Math.sin(a) * d; z = Math.cos(a) * d;
		} else if (kind === 'watch') {
			const a = r() * Math.PI * 2, d = 0.4 + Math.sqrt(r()) * 0.9;
			x = Math.sin(a) * d; z = Math.cos(a) * d;
		} else if (kind === 'party') {
			const a = r() * Math.PI * 2, d = 1.8 + Math.sqrt(r()) * 6;
			x = Math.sin(a) * d; z = Math.cos(a) * d;
		} else {
			const g = Math.floor(i / 3), ga = g * 2.4, gd = 2 + g * 1.5, a = r() * Math.PI * 2;
			x = Math.sin(ga) * gd + Math.sin(a) * 0.9; z = Math.cos(ga) * gd + Math.cos(a) * 0.9;
		}
		// facing the focus, or (at the smaller gatherings) turned to talk with the one before
		let yaw = Math.atan2(-x, -z) + (r() - 0.5) * 0.4;
		if (kind !== 'concert' && i % 2 === 1) yaw = Math.atan2(out[(i - 1) * 3] - x, out[(i - 1) * 3 + 1] - z);
		out[i * 3] = x; out[i * 3 + 1] = z; out[i * 3 + 2] = yaw;
	}
	// nobody on top of anybody: push close pairs apart a few times
	for (let k = 0; k < 4; k++) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
		const dx = out[j * 3] - out[i * 3], dz = out[j * 3 + 1] - out[i * 3 + 1], d = Math.hypot(dx, dz);
		if (d < 0.75) { const p = (0.75 - d) / 2 / (d || 1), ux = d ? dx : 0.5, uz = d ? dz : 0.5; out[i * 3] -= ux * p; out[i * 3 + 1] -= uz * p; out[j * 3] += ux * p; out[j * 3 + 1] += uz * p; }
	}
	return out;
}
