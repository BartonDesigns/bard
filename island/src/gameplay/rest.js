// Sitting down and sleeping. Walk up to a seat and E (or its button) sits you in it: a chair at
// the dining table, the sofa, an armchair, a stool at the kitchen island, the edge of a bed, a
// desk's chair, a table in a cafe or a restaurant, a seat at the cinema, a bench on the street or
// in a park, a picnic table. The eye eases down to where a seated one is and turns the way the
// seat faces; look round freely, and a step, a jump, E again or Stand up has you on your feet
// where you stood (player.js keeps you in the seat: s.seat). Nobody's seat is taken from them:
// the people sitting about (people/people.js) and the families at home (people/home-life.js)
// keep theirs, and the one you sit in is kept for you while you are in it.
//
// In a bed of your own home ("Make this my home", share.js) you can sleep: you lie down with
// your head on the pillow, the screen goes dark, and the night passes (the clock runs on to
// 7:00 the next morning, so everything round you lives the night: the families' new day, the
// meals' midnight, the street lamps), and you wake up healed. By day it is a nap of two hours.
// In a room with friends about, the clock is everyone's: there it is a rest without the hours.
//
// The seats are read off what the world has built round you:
//   a home:                   its plan's furniture (people/home-routine.js spotsOf: bay/houseplan.js's
//                             houses, the city's row houses and flats)
//   the city's other buildings: their furnished seats (interiors/furnish.js P.seats)
//   the walk-in shops, cafes, restaurants, bars and cinemas: bay/commercial.js B.seats
//   outdoors:                 the streets' benches (bay/streetlife.js seatsNear), the parks' benches
//                             and picnic tables (bay/parkkit.js seatsNear)

import { spotsOf } from '../people/home-routine.js';
import { wrapHours } from '../world/solar.js';

const EYE = 1.68;
// how near a seat has to be (metres from where you stand to where you would sit), and a bed's
// edge past its middle
const REACH = 1.15, BED_REACH = 0.7;
// the bench's two places, the picnic table's four (their own frames: x along, z out of the front)
const BENCH = [[-0.45, 0.04], [0.45, 0.04]], PICNIC = [[-0.45, 0.62, Math.PI], [0.45, 0.62, Math.PI], [-0.45, -0.62, 0], [0.45, -0.62, 0]];
const LABEL = {
	sofa: '🛋 Sit', armchair: '🛋 Sit', couch: '🛋 Sit', dine: '🪑 Sit', desk: '🪑 Sit', stool: '🪑 Sit', chair: '🪑 Sit', seat: '🪑 Sit',
	bedEdge: '🛏 Sit on the bed', cinema: '🎬 Take a seat', bench: '🪑 Sit on the bench', park: '🪑 Sit on the bench', picnic: '🪑 Sit at the table', bed: '🛏 Sleep',
};

// ---------- the seats, read off what is built ----------
// a home's seats and beds in the world (house: bay/houses.js's, or a dwelling of home-life.js),
// on the floor your feet are on; used: the spots its household has (home-life.js inUse)
const SPOTS = new WeakMap();
export function homeSeats(house, feet, used = null) {
	const plan = house?.plan;
	if (!plan?.items || !house.root || !Number.isFinite(house.floorY)) return [];
	let spots = SPOTS.get(plan);
	if (!spots) SPOTS.set(plan, (spots = spotsOf(plan)));
	const yaw = house.root.rotation.y, c = Math.cos(yaw), sn = Math.sin(yaw), ox = house.ox ?? house.cx, oz = house.oz ?? house.cz;
	const at = (lx, lz) => [ox + lx * c + lz * sn, oz - lx * sn + lz * c];
	const out = [];
	for (const sp of spots) {
		if (!(sp.sit || sp.lie) || used?.has(sp.id)) continue;
		const y = house.floorY + (sp.y || 0);
		if (Math.abs(y - feet) > 1.2) continue;
		const [x, z] = at(sp.x, sp.z);
		const seat = { x, z, y, h: sp.sit || 0, face: sp.heading + yaw, kind: sp.kind, id: sp.id, house, item: sp.item };
		// (a bed or the sofa to lie on: its pillow at x, z; reached from anywhere round it)
		if (sp.lie) { const it = sp.item, [mx, mz] = at(it.x, it.z); seat.lie = { top: sp.lie.top, mx, mz, r: Math.max(it.w, it.d) / 2 }; }
		out.push(seat);
	}
	return out;
}
// a city building's seats on a level (interiors/: B.P.seats in the lot's frame F, and B.spots,
// the same seats in the world, taken while someone sits there)
export function buildingSeats(B, level, F) {
	const P = B?.P, L = P?.levels?.[level];
	if (!P?.seats || !L || !F) return [];
	const out = [];
	for (let i = 0; i < P.seats.length; i++) {
		const s = P.seats[i], spot = B.spots?.[i] || null;
		if (!s.sit || Math.abs(s.y - L.y) > 0.5 || spot?.taken) continue;
		const [x, z] = F.w(s.x, s.z), fx = F.ca * s.fx - F.sa * s.fz, fz = F.sa * s.fx + F.ca * s.fz;
		out.push({ x, z, y: P.f0 + s.y, h: s.h || 0.47, face: Math.atan2(fx, fz), kind: s.table ? 'chair' : 'seat', spot });
	}
	return out;
}
// a walk-in place's seats (bay/commercial.js: [x, z, yaw, sitting, floor, seat height] in its frame;
// B.spots the level ones in the world, taken while someone sits there)
const SPOT_AT = new WeakMap();
const at2 = (x, z) => `${Math.round(x * 20)}:${Math.round(z * 20)}`;
export function venueSeats(B) {
	if (!B?.seats || !B.b) return [];
	let byAt = SPOT_AT.get(B);
	if (B.spots && !byAt) SPOT_AT.set(B, (byAt = new Map(B.spots.map((s) => [at2(s.x, s.z), s]))));
	const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a), out = [];
	for (const q of B.seats) {
		const [lx, lz, yaw, sit, y0 = 0, h = 0.46] = q;
		if (!sit) continue;
		const x = B.b.x + ca * lx - sa * lz, z = B.b.z + sa * lx + ca * lz, spot = byAt?.get(at2(x, z)) || null;
		if (spot?.taken) continue;
		// (a seat's yaw turns -z, the way its sitter faces, in the building's frame)
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
		out.push({ x, z, y: B.floorY + y0, h, face: Math.atan2(fx * ca - fz * sa, fx * sa + fz * ca), kind: B.type === 'cinema' ? 'cinema' : 'chair', spot });
	}
	return out;
}
// the places on the benches and picnic tables about ({ kind, x, y, z, heading }: the way a bench
// faces, a table's long side)
export function outdoorSeats(list) {
	const out = [];
	for (const b of list || []) {
		if (!Number.isFinite(b?.x) || !Number.isFinite(b.z)) continue;
		const h = b.heading || 0, c = Math.cos(h), s = Math.sin(h), picnic = b.kind === 'picnic';
		for (const [lx, lz, turn = 0] of picnic ? PICNIC : BENCH) out.push({ x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, y: b.y ?? 0, h: picnic ? 0.46 : 0.48, face: h + turn, kind: picnic ? 'picnic' : b.kind === 'park' ? 'park' : 'bench' });
	}
	return out;
}
// the one to offer: the nearest within reach on your level, the one you face first. me: { x, z,
// feet, fx, fz (the way you look) }
export function pickSeat(seats, me, reach = REACH) {
	let best = null, bs = Infinity;
	for (const s of seats) {
		if (Math.abs(s.y - me.feet) > 0.7) continue;
		const cx = s.lie ? s.lie.mx : s.x, cz = s.lie ? s.lie.mz : s.z, r = s.lie ? s.lie.r + BED_REACH : reach;
		const dx = cx - me.x, dz = cz - me.z, d = Math.hypot(dx, dz);
		if (d > r) continue;
		const ahead = d > 1e-3 ? (dx * me.fx + dz * me.fz) / d : 1;
		// (the two sides of a double bed: the nearer pillow; a bed nobody is in before one that is)
		const score = d / r - 0.3 * ahead + 0.02 * Math.hypot(s.x - me.x, s.z - me.z) + (s.busy ? 0.6 : 0);
		if (score < bs) { bs = score; best = s; }
	}
	return best;
}
// what a sleep is at an hour: until 7:00 from the evening on (and through the small hours), else a
// nap of two hours; with friends about, a rest without the hours. { hours to pass, wake, heal (of
// what is hurt), kind }
export function sleepPlan(h, shared = false) {
	const night = h >= 19 || h < 7;
	if (shared) return { hours: 0, wake: wrapHours(h), heal: night ? 1 : 0.5, kind: 'rest' };
	if (night) return { hours: wrapHours(7 - h), wake: 7, heal: 1, kind: 'night' };
	return { hours: 2, wake: wrapHours(h + 2), heal: 0.5, kind: 'nap' };
}
const clock = (h) => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

// world(): the world; homes(): the families' homes (people/home-life.js: homeAt, inUse, claim);
// share: mine() the saved home you are in; combat: vitals, mend, hurt0, wantedLevel;
// multiplayer: friends(); button: main.js's; others(): another prompt has E (a door, the
// kitchen, a perk: the seat's prompt shows without it); busy(): no sitting now (driving,
// loading, the arcade)
export function createRest({ world, camera, mount, button, hint = () => {}, isPhone = false, homes = () => null, share = null, combat = null, multiplayer = null, others = () => false, busy = () => false }) {
	// (timed by the clock, not the world's frames: a slow phone's world runs slow, the dark of a
	// night's sleep and the prompt keep to real time)
	let here = null, hereT = 0, lastT = 0, took = null, Z = null, lastHp = null, hurtAt = -1e9;
	const act = button('🪑 Sit', 'Sit down (E)', 'display:none;', 'prompt 59');
	mount?.appendChild(act);
	for (const ev of ['pointerdown', 'touchstart']) act.addEventListener(ev, (e) => e.stopPropagation());
	// the dark of a night's sleep, over everything
	const dark = document.createElement('div');
	dark.style.cssText = 'position:absolute;inset:0;z-index:25;background:#000;opacity:0;display:none;align-items:center;justify-content:center;pointer-events:auto;color:rgba(234,250,246,.8);font:600 20px var(--bard-display,system-ui,sans-serif);letter-spacing:.12em;';
	mount?.appendChild(dark);
	const P = () => world()?.player?.state || null;
	const now = () => performance.now() / 1000;

	// ---------- what is round you ----------
	function seatsNear(p) {
		const W = world(), feet = p.pos.y - EYE, out = [];
		const H = homes?.();
		let home = null;
		try { home = H?.homeAt?.(p.pos) || null; } catch { home = null; }
		// (a city flat's own plan is made once its rooms are furnished: people/home-life.js)
		if (home?.house && !home.house.plan) home.house.ready?.();
		if (home?.house?.plan) {
			const used = H.inUse?.(home.house) || null, all = homeSeats(home.house, feet, used);
			// your own home: its beds are for sleeping in (the sofa, if it has none), yours even where
			// the household lies (they get up for somewhere else: the whole bed is kept for you,
			// home-life claim); anyone else's: a seat on the edge of one at most
			if (share?.mine?.()) {
				const every = homeSeats(home.house, feet), beds = every.filter((s) => s.kind === 'bed'), lie = beds.length ? beds : every.filter((s) => s.kind === 'couch');
				for (const s of all) if (!s.lie && s.kind !== 'bedEdge') out.push(s);
				for (const s of lie) {
					const ids = every.filter((q) => q.item === s.item).map((q) => q.id);
					out.push({ ...s, kind: 'bed', ids, busy: ids.some((id) => used?.has(id)) });
				}
			} else for (const s of all) if (!s.lie) out.push(s);
			return out;
		}
		const I = W?.interiors?.inside?.(p.pos);
		if (I) { try { out.push(...buildingSeats(I.B, I.level, W.interiors.frame?.(I.B.o))); } catch { /* not furnished yet */ } return out; }
		const C = W?.commercial?.inside?.(p.pos);
		if (C) { out.push(...venueSeats(C)); return out; }
		if (W?.houses?.inside?.(p.pos)) return out;
		try { out.push(...outdoorSeats(W?.street?.seatsNear?.(p.pos.x, p.pos.z, 4))); } catch { /* no street here */ }
		try { out.push(...outdoorSeats(W?.parks?.seatsNear?.(p.pos.x, p.pos.z, 4))); } catch { /* no park here */ }
		return out;
	}
	function find(p) {
		if (!p || p.flying || p.swimming || p.locked || p.seat || !p.grounded || Math.hypot(p.vel.x, p.vel.z) > 2.2) return null;
		const s = pickSeat(seatsNear(p), { x: p.pos.x, z: p.pos.z, feet: p.pos.y - EYE, fx: -Math.sin(p.yaw), fz: -Math.cos(p.yaw) });
		// (how far it is: a kitchen counter nearer than the seat keeps E, main.js)
		if (s) s.d = Math.hypot((s.lie ? s.lie.mx : s.x) - p.pos.x, (s.lie ? s.lie.mz : s.z) - p.pos.z);
		return s;
	}

	// ---------- in and out of a seat ----------
	// (kept for you: a building's seat marked taken, a home's spot claimed from its household)
	function mark(seat, on) {
		if (!seat) return;
		if (seat.spot) seat.spot.taken = on;
		if (seat.house && seat.id != null) { try { homes?.()?.claim?.(on ? seat.house : null, seat.ids || seat.id); } catch { /* the house is gone */ } }
	}
	function take(seat, o = {}) {
		const p = P();
		if (!p || p.seat || !seat || p.locked) return false;
		p.seat = { x: seat.x, z: seat.z, y: seat.y, h: seat.h, face: seat.face, yaw: seat.face + Math.PI, kind: seat.kind, lie: !!o.lie, top: seat.lie?.top ?? 0, pitch: o.lie ? 0.95 : null, hold: !!o.hold };
		p.onStand = onStand;
		mark(seat, true);
		took = seat;
		lastHp = combat?.vitals?.()?.hp ?? null;
		here = null; hereT = 0;
		return true;
	}
	function onStand(S, why) {
		mark(took, false);
		took = null;
		if (Z && why === 'moved') finishSleep(true);
	}
	// up out of it (player.js eases you up where you stood)
	function stand() {
		const S = P()?.seat;
		if (!S || Z) return false;
		S.hold = false;
		if (S.up == null) S.up = 0;
		return true;
	}

	// ---------- sleep ----------
	function sleep(bed) {
		const W = world(), p = P(), sky = W?.sky;
		if (!p || !sky || Z) return false;
		if ((combat?.wantedLevel?.() || 0) > 0) { hint('You can\'t sleep with the police after you.', 2600); return false; }
		if (now() - hurtAt < 20) { hint('Not with a fight on. Get clear of it first.', 2400); return false; }
		const friends = (multiplayer?.friends?.() || []).filter((f) => f.here).length;
		const plan = sleepPlan(sky.state.hours, friends > 0);
		if (!take(bed, { lie: true, hold: true })) return false;
		Z = { t: 0, phase: 'down', plan, passed: 0 };
		p.inputBlocked = true;
		dark.textContent = ''; dark.style.opacity = '0'; dark.style.display = 'flex';
		return true;
	}
	// the dark, the hours passing, the morning
	function sleepStep(dt) {
		const sky = world()?.sky, p = P();
		if (!sky || !p) { finishSleep(true); return; }
		Z.t += dt;
		if (Z.phase === 'down') {
			dark.style.opacity = String(Math.min(1, Z.t / 1.1));
			if (Z.t >= 1.1) { Z.phase = 'dark'; Z.t = 0; dark.textContent = 'Z z z'; }
		} else if (Z.phase === 'dark') {
			// the clock runs on through the night in a couple of seconds (everything that keeps to the
			// hour sees each one go by)
			const left = Z.plan.hours - Z.passed;
			if (left > 1e-4) {
				const step = Math.min(left, Math.max(Z.plan.hours / 2.4, 0.5) * dt);
				Z.passed += step;
				sky.setLocalHours?.(sky.state.hours + step);
			} else if (Z.t >= 1.4) {
				if (Z.plan.hours > 0) sky.setLocalHours?.(Z.plan.wake);
				const hurt = combat?.hurt0?.() || 0;
				Z.healed = hurt > 0.5 ? combat?.mend?.(hurt * Z.plan.heal) || 0 : 0;
				Z.phase = 'up'; Z.t = 0;
				dark.textContent = Z.plan.kind === 'rest' ? '' : clock(sky.state.hours);
			}
		} else if (Z.phase === 'up') {
			dark.style.opacity = String(Math.max(0, 1 - Z.t / 1.4));
			if (Z.t >= 1.4) finishSleep(false);
		}
	}
	function finishSleep(cut) {
		const z = Z;
		Z = null;
		dark.style.display = 'none'; dark.style.opacity = '0'; dark.textContent = '';
		const p = P();
		if (p) { p.inputBlocked = false; if (p.seat) p.seat.hold = false; }
		if (cut || !z) return;
		const healed = z.healed > 0.5 ? ` (+${Math.round(z.healed)} health)` : '';
		const line = z.plan.kind === 'night' ? `Good morning. You slept until ${clock(z.plan.wake)} and woke up rested${healed}.`
			: z.plan.kind === 'nap' ? `You nap for a couple of hours${healed}.`
			: `You rest a while${healed}. With friends about, the clock keeps going for everyone.`;
		hint(line, 4200);
	}

	// ---------- the prompt ----------
	const key = isPhone ? '' : ' (E)';
	function show(text, title) {
		const d = text ? '' : 'none';
		if (act.style.display !== d) act.style.display = d;
		if (text && act.textContent !== text) { act.textContent = text; act.title = title; act.setAttribute('aria-label', title); }
	}
	function use() {
		const p = P();
		if (p?.seat) { stand(); return; }
		if (!here) return;
		if (here.kind === 'bed') sleep(here); else take(here);
	}
	// E: up out of the seat you are in, or into the one on offer when no other prompt has it
	const ownsE = () => !Z && (!!P()?.seat || (!!here && !others()));
	act.addEventListener('click', (e) => { e.stopPropagation(); use(); });
	addEventListener('keydown', (e) => {
		if ((e.key !== 'e' && e.key !== 'E') || e.repeat || e.metaKey || e.ctrlKey) return;
		if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || window._KEYS_PLAY_ON || !ownsE()) return;
		e.preventDefault(); use();
	});
	function update() {
		const t = now(), dt = Math.min(0.25, Math.max(0, t - (lastT || t)));
		lastT = t;
		const p = P();
		// (a blow taken: no sleeping for a while, and up out of a seat)
		const hp = combat?.vitals?.()?.hp;
		if (Number.isFinite(hp) && Number.isFinite(lastHp) && hp < lastHp - 0.5) { hurtAt = now(); if (p?.seat && !Z) stand(); }
		lastHp = Number.isFinite(hp) ? hp : null;
		if (Z) sleepStep(dt);
		if (!p) { show(null); return; }
		const S = p.seat;
		if (S) {
			// taken over by a car, a boat, a knock-down, a flight: out of the seat where you are
			if (p.locked || p.flying || p.swimming || busy()) { p.seat = null; onStand(S, 'moved'); show(null); return; }
			if (Z || S.up != null) show(null);
			else show(S.lie ? `⬆ Get up${key}` : `⬆ Stand up${key}`, S.lie ? 'Get up (E)' : 'Stand up (E)');
			return;
		}
		hereT -= dt;
		if (hereT > 0) return;
		hereT = 0.2;
		here = busy() ? null : find(p);
		if (!here) { show(null); return; }
		show(`${LABEL[here.kind] || '🪑 Sit'}${others() ? '' : key}`, here.kind === 'bed' ? 'Sleep in your bed (E)' : 'Sit down (E)');
	}
	function info() {
		const S = P()?.seat;
		return {
			seated: S ? { kind: S.kind, lie: S.lie, h: S.h, up: S.up ?? null, hold: !!S.hold, eye: +(camera.position.y - S.y).toFixed(2) } : null,
			near: here ? { kind: here.kind, d: +here.d.toFixed(2) } : null,
			asleep: Z ? { phase: Z.phase, passed: +Z.passed.toFixed(2), plan: Z.plan } : null,
		};
	}
	return {
		update, stand, info, sleep, take, ownsE,
		seated: () => !!P()?.seat, asleep: () => !!Z, near: () => here,
		// (for a look: the seats round you, and sitting in the one on offer, or sleeping in it)
		seats: () => { const p = P(); return p ? seatsNear(p) : []; },
		sitHere: () => { const p = P(), s = p && find(p); return s ? (s.kind === 'bed' ? sleep(s) : take(s)) : false; },
	};
}
