// Life inside a house: who of a household is home at an hour (schedules.js), what they are
// doing there, and where in the house they do it. The places come from the house's own plan
// and furniture (bay/houseplan.js): the beds, the dining table's chairs, the sofa and the
// armchairs in front of the TV, the stove, the sink, the fridge, the desks, a spot to stand
// and talk in the kitchen. Plain data and cheap; nothing here knows about bodies.
//
//   spotsOf(plan)                     every place to be in the house, in the house's frame
//   doingAt(h, plan, member, hour, o) what one of them is doing at home (null: not home)
//   arrange(h, plan, spots, hour, o)  the whole house: [{ member, act, spot }]
//   lineFor(o)                        what someone says when a fight comes in on them
//
// The house's frame: x, z as the plan has them (metres, the main block's own axes), y the
// floor of the storey, heading 0 facing +z. home-life.js turns them into the world's.

import { whereAt } from './schedules.js';

const PUBLIC = new Set(['living', 'family', 'kitchen', 'dining', 'entry', 'hall', 'loft']);
const BEDROOMS = new Set(['master', 'bed']);
const Q = Math.PI / 2;

// a point of an item's own frame (x across it, z out of its front) in the house's frame
function itemPoint(it, px, pz) {
	const a = (it.rot || 0) * Q, c = Math.cos(a), s = Math.sin(a);
	return [it.x + px * c + pz * s, it.z - px * s + pz * c];
}
const itemHeading = (it, turn = 0) => (it.rot || 0) * Q + turn;
// small, stable variety from numbers
function hash(...n) { let h = 2166136261; for (const v of n) { h = Math.imul(h ^ (Math.floor(v * 1000) | 0), 16777619); h ^= h >>> 13; } return ((h >>> 0) % 100000) / 100000; }

// ---------- the places in a house ----------
// each: { id, kind, room, roomType, level, y, x, z, heading, sit (seat height) | lie
// ({ head, len, top, wide }) | stand, pose, tv, kid, item }
export function spotsOf(plan) {
	const out = [], items = plan?.items || [], rooms = plan?.rooms || [];
	const roomType = (id) => rooms[id]?.type || '';
	const add = (o) => { o.id = out.length; out.push(o); return o; };
	const tvs = items.filter((it) => it.type === 'tvConsole');
	const tvRooms = new Set(tvs.map((it) => it.room));
	// a seat faces the TV when the TV is in the room and in front of it
	const facesTv = (it, x, z, heading) => tvs.some((tv) => {
		if (tv.room !== it.room || tv.level !== it.level) return false;
		const dx = tv.x - x, dz = tv.z - z, d = Math.hypot(dx, dz) || 1;
		return (dx * Math.sin(heading) + dz * Math.cos(heading)) / d > 0.55;
	});
	for (const it of items) {
		const base = { room: it.room, roomType: roomType(it.room), level: it.level || 0, y: it.y || 0, item: it };
		if (it.type === 'bed') {
			const wide = it.w >= 1.35, kid = it.w < 1.2 && roomType(it.room) === 'bed';
			const slots = wide ? [-it.w * 0.24, it.w * 0.24] : [0];
			slots.forEach((sx, k) => {
				const [x, z] = itemPoint(it, sx, -it.d / 2 + 0.27);
				add({ ...base, kind: 'bed', side: k, x, z, heading: itemHeading(it), lie: { top: 0.58, len: it.d, wide: wide ? it.w * 0.48 : it.w - 0.12, lump: [sx, -it.d / 2 + 0.45, it.d / 2 - 0.02] }, kid, pair: wide });
			});
			// the edge of the bed: to sit and read a story, or a teen on their phone
			const [ex, ez] = itemPoint(it, it.w / 2 - 0.18, -it.d / 2 + it.d * 0.55);
			add({ ...base, kind: 'bedEdge', x: ex, z: ez, heading: itemHeading(it, Q * 1.5), sit: 0.58, kid });
		} else if (it.type === 'sofa' || it.type === 'armchair') {
			const arm = 0.17, n = it.type === 'armchair' ? 1 : it.w > 1.9 ? 3 : 2, cw = (it.w - 2 * arm) / n;
			for (let i = 0; i < n; i++) {
				const px = -it.w / 2 + arm + (i + 0.5) * cw, [x, z] = itemPoint(it, px, 0.06), heading = itemHeading(it);
				add({ ...base, kind: it.type, x, z, heading, sit: 0.47, tv: facesTv(it, x, z, heading), tvRoom: tvRooms.has(it.room) });
			}
			// a sofa long enough to lie on (for someone without a bed tonight), head at one arm
			if (it.type === 'sofa' && it.w >= 1.9) {
				const [x, z] = itemPoint(it, -it.w / 2 + 0.38, 0.06);
				add({ ...base, kind: 'couch', x, z, heading: itemHeading(it, Q), lie: { top: 0.48, len: it.w, wide: 0.7, lump: null } });
			}
		} else if (it.type === 'diningTable') {
			const n = it.chairs || 4, per = Math.ceil(n / 2), a = (it.rot || 0) * Q;
			for (let row = 0; row < per; row++) for (const side of [1, -1]) {
				if (side < 0 && row >= n - per) continue;
				const lx = -it.w / 2 + it.w * (row + 0.5) / per, lz = side * (it.d / 2 + 0.12);
				add({ ...base, kind: 'dine', x: it.x + lx * Math.cos(a) + lz * Math.sin(a), z: it.z - lx * Math.sin(a) + lz * Math.cos(a), heading: a + (side > 0 ? Math.PI : 0), sit: 0.5 });
			}
		} else if (it.type === 'desk') {
			const [x, z] = itemPoint(it, 0, it.d / 2 + 0.36);
			add({ ...base, kind: 'desk', x, z, heading: itemHeading(it, Math.PI), sit: 0.5, kid: roomType(it.room) === 'bed' });
		} else if (it.type === 'counter' && it.side) {
			// at the stove and at the sink, facing the counter
			const sd = it.side, out = sd.pos + sd.n * (it.d + 0.34);
			const at = (along) => sd.axis === 'x' ? [along, out] : [out, along];
			const heading = sd.axis === 'x' ? (sd.n > 0 ? Math.PI : 0) : (sd.n > 0 ? -Q : Q);
			if (it.range != null) { const [x, z] = at(it.range); add({ ...base, kind: 'stove', x, z, heading, stand: true, pose: 'cook' }); }
			if (it.sink != null) { const [x, z] = at(it.sink); add({ ...base, kind: 'sink', x, z, heading, stand: true, pose: 'cook' }); }
		} else if (it.type === 'fridge') {
			const [x, z] = itemPoint(it, 0, it.d / 2 + 0.42);
			add({ ...base, kind: 'fridge', x, z, heading: itemHeading(it, Math.PI), stand: true });
		} else if (it.type === 'island') {
			// its stools along the back (housekit.js: seat 0.62-0.68, 0.18 out), and the working side
			// to stand at across from them
			const n = it.stools || 2;
			for (let i = 0; i < n; i++) { const [x, z] = itemPoint(it, -it.w / 2 + it.w * (i + 0.5) / n, -it.d / 2 - 0.18); add({ ...base, kind: 'stool', x, z, heading: itemHeading(it), sit: 0.66 }); }
			const [x, z] = itemPoint(it, 0, it.d / 2 + 0.42);
			add({ ...base, kind: 'island', x, z, heading: itemHeading(it, Math.PI), stand: true });
		}
	}
	// a few places to stand in each living room and kitchen, clear of the furniture: in twos,
	// facing each other, for talking
	for (const r of rooms) {
		if (r.skip || !(r.cells?.length || r.x1 > r.x0) || !PUBLIC.has(r.type) || r.type === 'hall' || r.type === 'entry') continue;
		const pts = r.cells?.length ? clearPoints(plan, r, items) : clearInRect(r, items), y = r.y ?? (r.level ? 2.9 : 0);
		for (let k = 0; k + 1 < pts.length && k < 4; k += 2) {
			const [a, b] = [pts[k], pts[k + 1]], h = Math.atan2(b[0] - a[0], b[1] - a[1]);
			add({ room: r.id, roomType: r.type, level: r.level || 0, y, kind: 'stand', x: a[0], z: a[1], heading: h, stand: true, pair: true });
			add({ room: r.id, roomType: r.type, level: r.level || 0, y, kind: 'stand', x: b[0], z: b[1], heading: h + Math.PI, stand: true, pair: true });
		}
	}
	return out;
}
// open floor in a room, at least 0.45 m from any furniture and from the walls: pairs of
// points about a metre apart
function clearPoints(plan, room, items) {
	const { X, Z, nx } = plan, out = [];
	if (!X || !Z) return out;
	const boxes = items.filter((it) => it.room === room.id && it.box).map((it) => it.box);
	const free = (x, z) => {
		if (plan.cellAt(x, z) < 0) return false;
		for (const [dx, dz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) { const c = plan.cellAt(x + dx, z + dz); if (c < 0 || plan.labels?.[room.level || 0]?.[c] !== room.id) return false; }
		return !boxes.some((b) => x > b[0] - 0.45 && x < b[2] + 0.45 && z > b[1] - 0.45 && z < b[3] + 0.45);
	};
	for (const c of room.cells) {
		const i = c % nx, j = Math.floor(c / nx), cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
		for (const [ax, az, bx, bz] of [[cx - 0.5, cz, cx + 0.5, cz], [cx, cz - 0.5, cx, cz + 0.5]]) {
			if (free(ax, az) && free(bx, bz) && !out.some((p) => Math.hypot(p[0] - ax, p[1] - az) < 1.6)) { out.push([ax, az], [bx, bz]); break; }
		}
		if (out.length >= 4) break;
	}
	return out;
}

// the same in a plain rectangle of a room (interiors/plan.js: the city's row houses and flats)
function clearInRect(room, items) {
	const out = [], boxes = items.filter((it) => it.room === room.id && it.box).map((it) => it.box);
	const free = (x, z) => x > room.x0 + 0.45 && x < room.x1 - 0.45 && z > room.z0 + 0.45 && z < room.z1 - 0.45 && !boxes.some((b) => x > b[0] - 0.45 && x < b[2] + 0.45 && z > b[1] - 0.45 && z < b[3] + 0.45);
	for (let z = room.z0 + 0.95; z < room.z1 - 0.9 && out.length < 4; z += 0.8) for (let x = room.x0 + 0.95; x < room.x1 - 0.9 && out.length < 4; x += 0.8) {
		for (const [ax, az, bx, bz] of [[x - 0.5, z, x + 0.5, z], [x, z - 0.5, x, z + 0.5]]) {
			if (free(ax, az) && free(bx, bz) && !out.some((p) => Math.hypot(p[0] - ax, p[1] - az) < 1.6)) { out.push([ax, az], [bx, bz]); break; }
		}
	}
	return out;
}

// ---------- what they are doing ----------
// acts: sleep, story (reading to a little one at bedtime), tucked (in bed, being read to),
// eat, cook, dishes, tv, homework, work (from home), chores, read, phone, chat, snack
export function doingAt(h, plan, m, hour, o = {}) {
	const W = whereAt(plan, m.id, hour);
	if (W.at !== 'home') return null;
	const act = W.act, r = hash(m.seed % 9973, Math.floor(hour * 2), o.day || 0);
	const evening = hour >= Math.min(19.25, (o.sunset ?? 19.5) - 0.5) || hour < 4;
	if (act === 'sleep') return { act: 'sleep' };
	if (act === 'breakfast') return { act: 'eat', meal: 'breakfast' };
	if (act === 'dinner') return { act: 'eat', meal: 'dinner' };
	if (act === 'cooking') return { act: 'cook' };
	if (act === 'homework') return { act: 'homework' };
	if (act === 'bedtime') return { act: 'story' };
	if (act === 'work') return { act: 'work' };
	if (act === 'chores') return { act: 'chores' };
	// a little one whose grown-up is reading them their story is in bed for it
	if (m.age < 9 && h.members.some((q) => q !== m && q.age >= 18 && whereAt(plan, q.id, hour).act === 'bedtime')) return { act: 'tucked' };
	// the rest of the time at home: the evening in front of the TV, the teens up in their rooms,
	// the older ones with a book; by day the kitchen, the sofa, a phone
	if (evening) {
		if (m.stage === 'teen' && r < 0.45) return { act: 'phone', own: true };
		if (m.stage === 'elder' && r < 0.4) return { act: 'read' };
		if (r > 0.9 && m.age >= 18) return { act: 'dishes' };
		return { act: 'tv' };
	}
	if (hour < 9.5 && m.age >= 18) return { act: r < 0.6 ? 'chat' : 'snack' };
	if (m.stage === 'teen') return { act: r < 0.6 ? 'phone' : 'tv', own: r < 0.35 };
	if (m.age < 13) return { act: r < 0.55 ? 'tv' : 'chat' };
	if (r < 0.25) return { act: 'read' };
	if (r < 0.5) return { act: 'chat' };
	if (r < 0.7) return { act: 'phone' };
	if (r < 0.85) return { act: 'chores' };
	return { act: 'tv' };
}

// where each act would like to be, in order: spot kinds, and a test for the room
const WANTS = {
	eat: ['dine', 'stool', 'tv', 'sofa', 'island', 'stand'],
	cook: ['stove', 'sink', 'island', 'stand'],
	dishes: ['sink', 'stove', 'stand'],
	chores: ['sink', 'fridge', 'stand'],
	snack: ['stool', 'island', 'fridge', 'dine', 'stand'],
	chat: ['stand', 'island', 'stool', 'dine', 'sofa'],
	tv: ['tv', 'sofa', 'armchair', 'dine'],
	read: ['armchair', 'sofa', 'dine'],
	phone: ['sofa', 'armchair', 'bedEdge', 'dine'],
	homework: ['kidDesk', 'desk', 'dine', 'stool'],
	work: ['desk', 'dine', 'stool'],
	story: ['bedEdge'],
	tucked: ['bed'],
	sleep: ['bed', 'couch'],
};
const POSE = { eat: 'table', homework: 'read', work: 'type', read: 'read', phone: 'phone', story: 'read', chat: 'rest', snack: 'rest', tv: 'lap', chores: 'cook', dishes: 'cook', cook: 'cook' };

// the whole house at an hour: who is home, doing what, and where. Couples share the big bed,
// the little ones get the small beds, everyone else a bed of their own if there is one (else
// the sofa). o: { day, sunset, minAge (no bodies for babies), max (how many shown), taken (spot
// ids kept for someone else: you, sat in one, gameplay/rest.js) }
export function arrange(h, plan, spots, hour, o = {}) {
	const minAge = o.minAge ?? 2.5;
	const taken = new Set(o.taken || []), out = [];
	const home = [];
	for (const m of h.members) {
		if (m.age < minAge || m.away || m.embodied) continue;
		const d = doingAt(h, plan, m, hour, o);
		if (d) home.push({ m, ...d });
	}
	// the ones whose place is most particular choose first: the sleepers, the story, the cook
	const order = { sleep: 0, tucked: 0, story: 1, cook: 2, eat: 3, homework: 4, work: 4 };
	// (and before them, whoever is carrying on where they were: nobody is moved from a bed or a
	// seat they are still using; o.prev: member id -> { act, spot } from the last time)
	const keeps = (H) => { const q = o.prev?.get(H.m.id); return q && q.act === H.act && spots[q.spot] ? 0 : 1; };
	home.sort((a, b) => keeps(a) - keeps(b) || (order[a.act] ?? 6) - (order[b.act] ?? 6) || b.m.age - a.m.age);
	const kidOnly = new Set();
	let who = null;
	const free = (s) => !taken.has(s.id) && (!kidOnly.has(s.id) || who?.age < 9);
	// (two parents, two grandparents, a couple: the pair of the house; never roommates)
	const COUPLED = new Set(['parent', 'grandparent', 'partner']);
	const partnerOf = (m) => h.kind === 'single-parent' ? null : h.members.find((q) => q !== m && q.age >= 18 && m.age >= 18 && q.role === m.role && COUPLED.has(m.role));
	const bedOf = new Map();
	for (const H of home) {
		const { m, act } = H;
		let spot = null;
		who = m;
		const was = o.prev?.get(m.id);
		if (was && was.act === act && spots[was.spot] && free(spots[was.spot])) spot = spots[was.spot];
		else if (act === 'sleep' || act === 'tucked') {
			// the partner already in the big bed: the other side of it
			const p = partnerOf(m), pb = p && bedOf.get(p.id);
			if (pb) spot = spots.find((s) => free(s) && s.kind === 'bed' && s.item === pb.item);
			const beds = spots.filter((s) => free(s) && s.kind === 'bed');
			const wantKid = m.age < 13;
			spot ||= (p ? beds.find((s) => s.pair && s.roomType === 'master') || beds.find((s) => s.pair) : null)
				|| beds.find((s) => s.kid === wantKid && !s.pair) || beds.find((s) => !s.pair) || beds.find((s) => s.roomType !== 'master' || !p) || beds[0]
				|| spots.find((s) => free(s) && s.kind === 'couch');
		} else if (act === 'story') {
			// the edge of the little one's bed
			const kid = out.find((q) => q.act === 'tucked' && q.spot);
			spot = kid ? spots.find((s) => free(s) && s.kind === 'bedEdge' && s.item === kid.spot.item) : null;
			spot ||= spots.find((s) => free(s) && s.kind === 'bedEdge' && s.kid);
		} else {
			// every place the act could be, best kind first; but together beats the better kind
			// (the family round the island rather than one at it and one on the sofa upstairs), and
			// the first of them picks the room where the most of them fit
			const wants = WANTS[act] || ['stand'], C = [];
			for (const s of spots) {
				if (!free(s)) continue;
				const rank = wants.findIndex((want) => (want === 'tv' ? s.tv : want === 'kidDesk' ? s.kind === 'desk' && s.kid : s.kind === want)
					// (a phone on a bed: their own room's bed, not their parents')
					&& (want !== 'bedEdge' || (H.own && s.kid === (m.age < 18)) || (!H.own && s.roomType !== 'master'))
					&& (want !== 'desk' || act !== 'work' || !s.kid));
				if (rank >= 0) C.push({ s, rank });
			}
			const mates = out.filter((q) => q.spot && q.act === act);
			const room = (s) => C.reduce((n, c) => n + (c.s.room === s.room && c.rank <= 3 ? 1 : 0), 0);
			const score = (c) => c.rank * 2 + (mates.length ? mateD(c.s, mates) : -Math.min(room(c.s), together(act)) * 0.9);
			let best = null, bs = Infinity;
			for (const c of C) { const v = score(c); if (v < bs - 1e-6 || (Math.abs(v - bs) <= 1e-6 && c.s.id < best.s.id)) { bs = v; best = c; } }
			spot = best?.s || null;
		}
		// a bed for two taken by one with nobody to share it: the other side only for a little one
		if (spot?.kind === 'bed') {
			bedOf.set(m.id, spot);
			if (spot.pair && !partnerOf(m)) for (const s of spots) if (s.item === spot.item && s !== spot) kidOnly.add(s.id);
		}
		if (spot) {
			taken.add(spot.id);
			// a sofa is either sat on or lain on
			if (spot.kind === 'couch' || spot.kind === 'sofa') for (const s of spots) if (s.item === spot.item && (spot.kind === 'couch' || s.kind === 'couch')) taken.add(s.id);
		}
		const pose = !spot || spot.lie ? null : act === 'eat' && spot.kind !== 'dine' && spot.kind !== 'stool' ? (spot.sit ? 'lap' : 'rest') : spot.pose || POSE[act] || 'rest';
		out.push({ member: m, act, meal: H.meal, spot, pose });
	}
	return out.filter((q) => q.spot).slice(0, o.max ?? Infinity);
}
// how many of the house are at the act with them, at most
const together = (act) => (act === 'eat' || act === 'tv' ? 5 : act === 'chat' ? 2 : 1);
const mateD = (s, mates) => mates.length ? Math.min(...mates.map((q) => Math.hypot(q.spot.x - s.x, q.spot.z - s.z) + (q.spot.room === s.room ? 0 : 8))) : 0;

// ---------- a fight coming in ----------
// what they say when a fight crashes into the house: by what broke in (a window, a wall,
// shooting, a brawl), what they were doing, the hour and who they are. Seeded, so the same
// moment says the same thing; a different one each time in a house.
const LINES = {
	eat: ["I'm just having dinner!", 'We were EATING!', 'Not during dinner!', 'My lasagna!', 'Can a family not eat in peace?!', 'Everybody grab your plate and GO!'],
	breakfast: ['I have not even had my coffee!', 'It is seven in the morning!', 'My cereal!'],
	tv: ['We were watching that!', 'Is this part of the show?!', 'I was just getting to the good part!', 'Somebody pause it!', 'Who is that?! Is that the finale?!'],
	sleep: ['I was ASLEEP!', "It's the middle of the night!", 'Honey, wake up! Someone is in the house!', 'Wha... what time is it?!', 'Is this a dream?!'],
	cook: ["I've got something on the stove!", 'Not in my kitchen!', 'The sauce is going to burn!', 'Watch the pots!'],
	homework: ['I was doing my homework!', 'Is this going to be on the test?!', 'My essay!'],
	story: ['We were in the middle of a story!', 'It is past their bedtime!', 'And they lived... RUN!'],
	tucked: ['Was that a monster?!', 'Mommy!', 'Daddy!', 'Is this the scary part?'],
	work: ["I'm on a call!", 'Sorry, I have to go, someone just came through my wall!', 'You are on mute, this is real!'],
	read: ['I was reading!', 'I lost my page!'],
	phone: ['I am literally live right now!', 'Oh my god, I am filming this!', 'Mom! MOM!'],
	any: ['Oh my god, what is going on?!', 'This is a family home!', 'Get out of my house!', 'Not again!', 'Kids! Upstairs, NOW!', 'Call somebody!', 'What did we do?!'],
	window: ['My window!', 'That was a NEW window!', 'Who is paying for that window?!', 'We JUST had that fixed!'],
	wall: ['Through the WALL?!', 'That was a load-bearing wall!', 'There is a door, you know!'],
	shots: ['Get down! Everybody down!', 'Was that gunfire?!', 'Away from the windows!'],
	fight: ['Take it outside!', 'Not in the living room!', 'Somebody stop them!'],
	kid: ['Whoa!', 'That was so cool!', 'Mom!', 'Dad!', 'Was that a superhero?'],
	after: ['I am calling the police.', 'Unbelievable.', 'Our insurance is not going to believe this.', 'Every single time.', 'Is everybody okay?', 'And I just vacuumed.'],
};
// o: { why ('window'|'wall'|'shots'|'fight'), act, meal, hour, age, seed, n (how many have
// spoken in this house already), after }
export function lineFor(o) {
	const r = (k) => hash(o.seed || 0, k, o.n || 0);
	if (o.after) return pick(LINES.after, r(1));
	if ((o.age ?? 30) < 12) return pick(o.act === 'tucked' ? LINES.tucked : LINES.kid, r(2));
	const own = o.act === 'eat' && o.meal === 'breakfast' ? LINES.breakfast : LINES[o.act];
	const why = LINES[o.why];
	// the first to speak in a house says what they were doing; the next what came in
	const first = (o.n || 0) === 0;
	const L = first ? (own || why || LINES.any) : (why && r(3) < 0.6 ? why : own && r(4) < 0.5 ? own : LINES.any);
	return pick(L, r(5));
}
const pick = (L, u) => L[Math.min(L.length - 1, Math.floor(u * L.length))];
export { LINES };
