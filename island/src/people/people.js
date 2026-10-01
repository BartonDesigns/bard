// Crysis people in the world. A pool of real bodies (MakeHuman, see body.js) lives
// round the player and is handed out to whoever is near: people walking the city's
// sidewalks round their blocks and crossing at the corners, joggers, pairs stopped to
// talk, people waiting outside shops; villagers on the island's paths. Families too: a
// grown-up or two with their children, who keep close, hold the little ones' hands, stop
// when they stop and sit with them at the table; most after school and at weekends, hardly
// any late. Downtown is busy, the suburbs quiet, and at night the streets empty. Bodies are built a few at a time so
// nothing stutters, and each is re-dressed and re-cast when it is handed to someone new.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA, rng } from './body.js';
import { dressFor, placeAt, climate } from './wardrobe.js';
import { createMotion } from './motion.js';
import { BLOCKS, toGrid, fromGrid, STYLE } from '../bay/styles.js';
import { crowd, zoneOf, ZONE, kidsAbout, KID_SHARE } from './flow.js';
import { fadePerson } from './fade.js';
import { regionalNow } from '../region/here.js';
import { regionalDress } from '../region/dress.js';
import { ancestryFor } from '../region/cultures.js';
import { coldOf } from '../region/climate.js';

const MAX = 26, KIDS = 12, NEAR = 70;
const steps = [];
const TRAIL = new Set(['path', 'track', 'footway', 'cycleway']);                 // hiked, down the middle

// other systems' people you can stop and talk to (region/folk.js): each a function giving
// a list of { P, M, active } like the walkers here
const TALKERS = new Set();
export function addTalkers(fn) { TALKERS.add(fn); return () => TALKERS.delete(fn); }
function talkers() { const out = []; for (const f of TALKERS) { try { for (const p of f()) out.push(p); } catch { /* a system gone */ } } return out; }

export function createPeople(scene, world, camera = null) {
	const group = new THREE.Group();
	group.name = 'people';
	scene.add(group);
	let A = null, failed = false;
	const pool = [];                  // { P, M, role, route, ... }
	let seedN = 1;
	// the ground, or a floor people walk on near it (a museum hall, a shop, a porch)
	// (y: where the person is now, so one on a tower's twentieth floor stands on that floor)
	// (on the ground as drawn: out on a hillside the mesh is coarser than the survey)
	const ground = (x, z, y) => { const W = world(), g = (W.island.drawnAt ?? W.island.heightAt)(x, z), f = W.island.extraFloor?.(x, z, y === undefined ? g + 1.2 : y + 1.0) ?? -1e9; return f > g && (y !== undefined || f < g + 2.5) ? f : g; };
	// in plain sight: in the camera's view and near enough to be made out. Nobody is made or
	// let go where you can see it happen: they arrive out of sight (behind you, round the
	// corner, far off) and fade in, and go when out of sight again (or fade, if you keep
	// watching them)
	const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
	let frustumT = -1;
	const seen = (x, y, z, d = 0) => {
		if (!camera) return d < 60;
		if (frustumT !== performance.now()) { frustumT = performance.now(); camera.updateMatrixWorld(); pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv); }
		sphere.center.set(x, y + 0.9, z); sphere.radius = 1.3;
		return frustum.intersectsSphere(sphere);
	};
	const hiddenSpot = (x, z, cam) => { const d = Math.hypot(x - cam.x, z - cam.z); return d > 75 || !seen(x, ground(x, z), z, d); };
	const motionFor = (P) => { let M = null; M = createMotion(P, (x, z) => ground(x, z, M ? M.S.pos.y : undefined)); return M; };

	async function ensure() {
		if (A || failed) return;
		try { A = await loadPeopleAssets(); } catch (e) { failed = true; console.warn('[people]', e); }
	}

	// what someone does with their hands while they wait: the young look at their phones,
	// the guarded fold their arms, the old clasp their hands behind them
	function idlePoseFor(d, r) {
		const T = d.temper || { outgoing: 0.5, confident: 0.5, warmth: 0.5 }, x = r();
		if (d.age < 35 && x < 0.45) return 'phone';
		if (d.age > 62 && x < 0.5) return 'behind';
		if (d.child) return x < 0.7 ? 'rest' : 'behind';
		if (T.warmth < 0.35 && x < 0.6) return 'crossed';
		if (T.confident > 0.7 && x < 0.35) return 'hip';
		return x < 0.7 ? 'pockets' : 'rest';
	}

	// ---------- routes ----------
	// the sidewalk round a city block: its four corners, 8 m in from the street centre
	function blockLoop(x, z) {
		const bay = world().bayArea;
		if (!bay?.loaded()) return null;
		const U = bay.urbanAt(x, z);
		if (U.u < 0.3 || U.s === STYLE.industry) return null;
		const [BX, BZ, ST] = BLOCKS[U.s];
		const [gx, gz] = toGrid(x, z, U.a, U.s);
		const i = Math.floor(gx / BX), j = Math.floor(gz / BZ);
		// the middle of the pavement, 1.25 m in from each street edge
		const c = [[i * BX + ST + 1.25, j * BZ + ST + 1.25], [(i + 1) * BX - 1.25, j * BZ + ST + 1.25], [(i + 1) * BX - 1.25, (j + 1) * BZ - 1.25], [i * BX + ST + 1.25, (j + 1) * BZ - 1.25]];
		const pts = c.map(([a, b]) => { const [wx, wz] = fromGrid(a, b, U.a, U.s); return new THREE.Vector3(wx, 0, wz); });
		return { pts, u: U, block: [i, j] };
	}

	// who should be about here, now
	function demand(cam, night) {
		const W = world();
		if (!W) return { n: 0 };
		const hours = W.sky?.state?.hours ?? (night > 0.5 ? 23 : 12);
		const onIsland = Math.max(Math.abs(cam.x), Math.abs(cam.z)) < W.island.half;
		if (onIsland) {
			const v = W.island.village, d = Math.hypot(cam.x - v.x, cam.z - v.z);
			return { n: d < 260 ? Math.round(8 * (1 - night * 0.7)) : 0, kids: 0.3 * kidsAbout(hours), island: true, zone: 'island' };
		}
		// a place with its own visitors (the Discovery Museum): families, and where they go
		// (the museum, a shop, restaurant or office you are in or at, a tower's floor)
		let V = null, vz = null;
		for (const [src, z] of [[W.towers, 'office'], [W.commercial, null], [W.discovery, null], [W.boardwalk, 'boardwalk']]) { V = src?.venue?.(cam, hours); if (V) { vz = z; break; } }
		if (V) return { n: V.n, kids: V.kids, venue: V, island: false, C: { jog: 0, chat: 0.12, wait: 0.2 }, zone: vz || zoneOf(W.bayArea?.urbanAt(cam.x, cam.z)), sit: true };
		const U = W.bayArea?.urbanAt(cam.x, cam.z);
		// out on the trails: a few hikers by day
		const real = W.real;
		if (real?.loaded() && real.inside(cam.x, cam.z) && (!U || U.u < 0.2) && cam.y - ground(cam.x, cam.z) < 90) {
			const trails = real.near('roads', cam.x, cam.z, 120).some((q) => TRAIL.has(q.cls));
			const C = crowd(ZONE.trail, hours);
			return { n: trails ? Math.round(6 * C.k) : 0, kids: KID_SHARE.trail * kidsAbout(hours), island: false, C, zone: 'trail' };
		}
		// a beach or a park's grounds (bay/beaches.js, bay/parkkit.js): its own crowd, the quiet
		// beaches kept quiet
		const bc = W.beaches?.beachAt?.(cam.x, cam.z), pk = W.parks?.parkAt?.(cam.x, cam.z);
		if ((bc || pk) && cam.y - ground(cam.x, cam.z) < 90 && real?.loaded() && real.inside(cam.x, cam.z)) {
			const C = crowd(bc ? (bc.quiet ? ZONE.quiet : ZONE.beach) : ZONE.trail, hours);
			const roads = real.near('roads', cam.x, cam.z, 150).length;
			if (roads) return { n: Math.round((bc ? (bc.quiet ? 3 : 10) : 12) * C.k), kids: (bc?.quiet ? 0.1 : 0.32) * kidsAbout(hours), island: false, C, zone: bc ? 'beach' : 'trail' };
		}
		if (!U || U.u < 0.2 || cam.y - ground(cam.x, cam.z) > 90) return { n: 0 };
		// how busy, by what kind of place and the hour (flow.js)
		const zone = zoneOf(U), C = crowd(zone, hours);
		const busy = zone === ZONE.downtown ? 1 : zone === ZONE.retail || zone === ZONE.dining ? 0.8 : zone === ZONE.office ? 0.7 : zone === ZONE.industrial ? 0.4 : 0.35;
		return { n: Math.round(MAX * busy * C.k), kids: (KID_SHARE[zone] || 0) * kidsAbout(hours), island: false, C, zone };
	}

	// the real city's sidewalks: a point beside a street, on one side, at distance s along it
	function roadLen(r) { if (r.len) return r.len; let L = 0; for (let i = 2; i < r.pts.length; i += 2) L += Math.hypot(r.pts[i] - r.pts[i - 2], r.pts[i + 1] - r.pts[i - 1]); return (r.len = L); }
	function curbPoint(r, s, side) {
		const p = r.pts;
		let acc = 0;
		for (let i = 2; i < p.length; i += 2) {
			const ax = p[i - 2], az = p[i - 1], bx = p[i], bz = p[i + 1], L = Math.hypot(bx - ax, bz - az);
			if (acc + L >= s || i === p.length - 2) {
				const t = L ? Math.min(1, Math.max(0, (s - acc) / L)) : 0, off = TRAIL.has(r.cls) ? 0.35 * side : (r.w / 2 + 0.9) * side;
				const nx = L ? -(bz - az) / L : 0, nz = L ? (bx - ax) / L : 0;
				return new THREE.Vector3(ax + (bx - ax) * t + nx * off, 0, az + (bz - az) * t + nz * off);
			}
			acc += L;
		}
		return new THREE.Vector3(p[0], 0, p[1]);
	}
	function streetRoute(x, z, r) {
		const real = world().real;
		if (!real?.loaded() || !real.inside(x, z)) return null;
		const roads = real.near('roads', x, z, 60).filter((q) => (q.walked || TRAIL.has(q.cls)) && !q.bridge);
		if (!roads.length) return null;
		// the streets that really pass close to the chosen spot (the index hands back whole cells)
		const close = [];
		for (const road of roads) {
			let best = 0, bd = 1e9, acc = 0;
			const P = road.pts;
			for (let i = 2; i < P.length; i += 2) {
				const ax = P[i - 2], az = P[i - 1], dx = P[i] - ax, dz = P[i + 1] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(ax + dx * t - x, az + dz * t - z);
				if (d < bd) { bd = d; best = acc + t * Math.sqrt(l2); }
				acc += Math.sqrt(l2);
			}
			if (bd < 40 && acc > 20) close.push([road, best, acc]);
		}
		if (!close.length) return null;
		const [road, best, L] = close[Math.floor(r() * close.length)];
		return { kind: 'street', road, side: r() < 0.5 ? 1 : -1, s: Math.max(0, Math.min(L, best + (r() - 0.5) * 20)), dir: r() < 0.5 ? 1 : -1 };
	}

	function cast(p, cam, island, mood = null, venue = null) {
		const r = rng(seedN * 7919 + 13);
		const W = world();
		const C = mood || { jog: 0.12, chat: 0.14, wait: 0.12 };
		const x = r();
		p.role = island ? (x < 0.25 ? 'chat' : x < 0.35 ? 'wait' : 'walk') : x < C.jog ? 'jog' : x < C.jog + C.chat ? 'chat' : x < C.jog + C.chat + C.wait ? 'wait' : 'walk';
		p.talking = false; p.partner = null; p.timer = 5 + r() * 20;
		// if children come along: how many, and whether a second grown-up does too
		p.kids = 0; p.spouse = null; p.fam = null; p.famWant = r() < 0.45 ? 1 : r() < 0.75 ? 2 : 3; p.spouseWant = r() < 0.45;
		const M = p.M;
		M.S.talk = 0; M.S.look.target = null;
		p.engaged = false; p.persona = null;
		p.idlePose = idlePoseFor(p.P.dna, r);
		M.setPose(p.role === 'wait' ? p.idlePose : r() < 0.08 ? 'phone' : r() < 0.06 ? 'pockets' : 'rest');
		// at a venue: into one of its rooms or yards, within sight of here
		if (venue) {
			if (p.role === 'jog') p.role = 'walk';
			// a seat, or a place to stand (behind the counter, at the bar), free and in sight
			const seated = venue.areas.filter((q) => q.seats);
			if (seated.length) {
				const free = seated.flatMap((q) => q.seats.filter((st) => !st.taken && Math.hypot(st.x - cam.x, st.z - cam.z) < NEAR && Math.hypot(st.x - cam.x, st.z - cam.z) > 1.2 && !seen(st.x, st.y, st.z)));
				if (!free.length) return false;
				const st = free[Math.floor(r() * free.length)];
				st.taken = true;
				p.route = { kind: 'seat', seat: st, seats: seated.flatMap((q) => q.seats) };
				p.role = 'wait'; p.timer = 1e9;
				M.place(st.x, st.y, st.z, st.heading);
				if (st.sit) { M.sit(st.h, true); M.setPose(st.table ? 'table' : 'lap'); } else if (st.rail) { M.stand(); M.setPose('fish'); rodFor(p).visible = true; } else { M.stand(); M.setPose(p.idlePose); }
				return true;
			}
			for (let k = 0; k < 12; k++) {
				let u = r() * venue.areas.reduce((a, q) => a + q.w, 0), area = venue.areas[0];
				for (const q of venue.areas) { if ((u -= q.w) <= 0) { area = q; break; } }
				if (!area) return false;
				const q = area.pick(r), d = Math.hypot(q.x - cam.x, q.z - cam.z);
				if (d > NEAR || d < 3 || !hiddenSpot(q.x, q.z, cam)) continue;
				p.route = { kind: 'venue', area, goal: new THREE.Vector3(q.x, 0, q.z) };
				const q2 = area.pick(r);
				p.route.goal.set(q2.x, 0, q2.z);
				M.place(q.x, q.y ?? ground(q.x, q.z), q.z, r() * 6.28);
				return true;
			}
			return false;
		}
		// somewhere near but not in your face, and ideally out of sight
		for (let k = 0; k < 20; k++) {
			const a = r() * Math.PI * 2, d = 18 + r() * (NEAR - 25);
			const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
			if (island) {
				const pts = (W.island.paths || []).flatMap((q) => q.points);
				const v = W.island.village;
				const q = pts.length ? pts[Math.floor(r() * pts.length)] : { x: v.x + (r() - 0.5) * 80, z: v.z + (r() - 0.5) * 80 };
				if (ground(q.x, q.z) < 0.6 || !hiddenSpot(q.x, q.z, cam)) continue;
				p.route = { kind: 'wander', home: new THREE.Vector3(v.x, 0, v.z), goal: new THREE.Vector3(q.x, 0, q.z) };
				M.place(q.x, ground(q.x, q.z), q.z, r() * 6.28);
				return true;
			}
			const st = streetRoute(x, z, r);
			if (st) {
				const q = curbPoint(st.road, st.s, st.side), q2 = curbPoint(st.road, st.s + st.dir, st.side);
				if (ground(q.x, q.z) < 0.6 || !hiddenSpot(q.x, q.z, cam)) continue;
				p.route = st;
				M.place(q.x, ground(q.x, q.z), q.z, Math.atan2(q2.x - q.x, q2.z - q.z));
				return true;
			}
			if (world().real?.inside(x, z)) continue;
			const loop = blockLoop(x, z);
			if (!loop) continue;
			const side = Math.floor(r() * 4), t = r();
			const a0 = loop.pts[side], a1 = loop.pts[(side + 1) % 4];
			const px = a0.x + (a1.x - a0.x) * t, pz = a0.z + (a1.z - a0.z) * t;
			if (ground(px, pz) < 0.6 || !hiddenSpot(px, pz, cam)) continue;
			const dir = r() < 0.5 ? 1 : -1;
			p.route = { kind: 'loop', loop, side, dir, next: dir > 0 ? (side + 1) % 4 : side };
			M.place(px, ground(px, pz), pz, Math.atan2(a1.x - a0.x, a1.z - a0.z) * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : Math.PI));
			return true;
		}
		return false;
	}

	// a family: a child joins a grown-up already about (one already with children who want
	// another, or a new one), at their side holding hands if small, the third running on
	// ahead; or sits with them at their table. A second grown-up can join them too.
	const headOk = (o, cam) => o.active && !o.leaving && !seen(o.M.S.pos.x, o.M.S.pos.y, o.M.S.pos.z) && !o.P.dna.child && !o.engaged && !o.fam && o.role !== 'jog' && o.M.S.pos.distanceTo(cam) < NEAR && (o.route?.kind !== 'seat' || !!seatNear(o.route));
	// the free seat nearest a family's own (the same table, or the next one)
	function seatNear(R) {
		let best = null, bd = 1.7;
		for (const st of R.seats || []) { const d = Math.hypot(st.x - R.seat.x, st.z - R.seat.z); if (!st.taken && d < bd && Math.abs(st.y - R.seat.y) < 0.3) { bd = d; best = st; } }
		return best;
	}
	function seatBeside(p, F) {
		const st = seatNear(F.route);
		if (!st) return false;
		st.taken = true;
		p.route = { kind: 'seat', seat: st, seats: F.route.seats };
		p.role = 'wait'; p.timer = 1e9;
		p.M.place(st.x, st.y, st.z, st.heading);
		if (st.sit) { p.M.sit(st.h, true); p.M.setPose(st.table ? 'table' : 'lap'); } else { p.M.stand(); p.M.setPose('rest'); }
		return true;
	}
	function joinFamily(p, F, lead, side, back, hold) {
		p.fam = F; p.partner = null; p.engaged = false; p.persona = null; p.timer = 3 + Math.random() * 6;
		p.M.S.talk = 0; p.M.S.look.target = null; p.M.setPose('rest');
		if (F.route?.kind === 'seat') return seatBeside(p, F);
		p.role = 'follow';
		p.route = { kind: 'follow', parent: lead, side, back, hold, mine: side > 0 ? 'R' : 'L', theirs: side > 0 ? 'L' : 'R', roam: new THREE.Vector3(), roaming: 0 };
		const P = lead.M.S, h = P.heading, x = P.pos.x + Math.cos(h) * side - Math.sin(h) * back, z = P.pos.z - Math.sin(h) * side - Math.cos(h) * back;
		p.M.place(x, ground(x, z), z, h);
		return true;
	}
	function castChild(p, cam) {
		const r = rng(seedN * 104729 + 7);
		let heads = pool.filter((o) => headOk(o, cam) && o.kids > 0 && o.kids < o.famWant);
		if (!heads.length) heads = pool.filter((o) => headOk(o, cam) && !o.kids && o.role !== 'chat');
		if (!heads.length) return false;
		const F = heads[Math.floor(r() * heads.length)], i = F.kids || 0;
		p.idlePose = idlePoseFor(p.P.dna, r);
		// the first by the hand on one side, the second on the other (by the other grown-up's
		// hand if there are two), the third a little ahead
		let lead = F, side = 0.44, back = 0.05, hold = p.P.dna.age < 9 && r() < 0.85;
		if (i === 1) { side = -0.44; if (F.spouse?.active) lead = F.spouse; }
		if (i >= 2) { side = 0.2 + r() * 0.3; back = -1.1 - r() * 0.6; hold = false; }
		if (!hold && i < 2) side *= 1.7;
		if (!joinFamily(p, F, lead, side, back, hold)) return false;
		F.kids = i + 1;
		return true;
	}
	function castCompanion(p, F) {
		const r = rng(seedN * 7907 + 3);
		p.kids = 0; p.spouse = null; p.famWant = 0; p.spouseWant = false;
		p.idlePose = idlePoseFor(p.P.dna, r);
		// beside the other grown-up, outside a child holding their hand
		const kidR = pool.some((o) => o.active && o.fam === F && o.route?.parent === F && o.route.side < 0);
		if (!joinFamily(p, F, F, kidR ? -1.2 : -0.75, 0, false)) return false;
		F.spouse = p;
		return true;
	}
	// keeping up: the grown-up's own pace, closing the gap to their place at the side; a child
	// wanders off a little to look at something when the grown-up stands still
	function followParent(p, dt) {
		const M = p.M, S = M.S, R = p.route, par = R.parent, P = par.M.S, kid = p.P.dna.child;
		const h = P.heading, sx = Math.cos(h), sz = -Math.sin(h), fx = Math.sin(h), fz = Math.cos(h);
		const still = par.M.want.speed < 0.2 && P.speed.v < 0.3;
		p.timer -= dt;
		if (p.timer < 0) { p.timer = 3 + Math.random() * 7; R.roaming = kid && still && Math.random() < 0.5 ? 2 + Math.random() * 3 : 0; if (R.roaming) { const a = Math.random() * 6.283, d = 1.2 + Math.random() * 2.2; R.roam.set(P.pos.x + Math.cos(a) * d, 0, P.pos.z + Math.sin(a) * d); } }
		if (R.roaming > 0) { R.roaming -= dt; if (!still) R.roaming = 0; }
		const roam = R.roaming > 0;
		const tx = roam ? R.roam.x : P.pos.x + sx * R.side - fx * R.back, tz = roam ? R.roam.z : P.pos.z + sz * R.side - fz * R.back;
		const ex = tx - S.pos.x, ez = tz - S.pos.z, d = Math.hypot(ex, ez);
		const pv = roam ? 0 : Math.max(0, P.speed.v);
		let vx = fx * pv + ex * 1.2, vz = fz * pv + ez * 1.2;
		const v = Math.hypot(vx, vz), cap = kid ? (d > 3.5 ? 3 : 2.1) : 2;
		if (v > cap) { vx *= cap / v; vz *= cap / v; }
		if (v < 0.3 && d < 0.4) { M.want.speed = 0; M.want.heading = roam ? S.heading : h; }
		else { M.want.speed = Math.min(v, cap); M.want.heading = Math.atan2(vx, vz); }
		M.want.run = kid && d > 3.5 ? 1 : 0;
		// hand in hand while close
		const holding = R.hold && !roam && d < 0.8;
		M.hold(R.mine, holding); par.M.hold(R.theirs, holding);
		const t = performance.now() / 1000;
		if (kid) {
			// look up at the grown-up now and then
			S.look.target = Math.sin(t * 0.4 + p.P.dna.seed) > 0.7 ? new THREE.Vector3(P.pos.x, P.pos.y + par.P.height * 0.93, P.pos.z) : null;
		} else {
			// the two grown-ups talk as they go
			const talk = Math.sin(t * 0.3 + p.P.dna.seed) > 0.2;
			S.talk = talk && Math.sin(t * 0.9) > 0 ? 1 : 0;
			S.look.target = talk ? new THREE.Vector3(P.pos.x, P.pos.y + par.P.height * 0.93, P.pos.z) : null;
			if (!par.engaged && par.role !== 'chat') { par.M.S.look.target = talk ? new THREE.Vector3(S.pos.x, S.pos.y + p.P.height * 0.93, S.pos.z) : null; if (!par.speakUntil) par.M.S.talk = talk && !S.talk ? 1 : 0; }
		}
	}
	function venueWander(p) {
		const M = p.M, S = M.S, R = p.route;
		const d = Math.hypot(R.goal.x - S.pos.x, R.goal.z - S.pos.z);
		if (d < 1.2) {
			const q = R.area.pick(Math.random);
			R.goal.set(q.x, 0, q.z);
			// stop to look at the exhibits, or to watch the children play
			if (Math.random() < 0.55) { p.role = 'wait'; p.timer = 4 + Math.random() * 12; }
		}
		M.want.heading = Math.atan2(R.goal.x - S.pos.x, R.goal.z - S.pos.z);
		M.want.speed = p.P.dna.gait.pace * 0.7;
	}

	function steer(p, dt, cam) {
		const M = p.M, S = M.S, R = p.route;
		p.timer -= dt;
		const pace = p.P.dna.gait.pace;
		if (p.engaged) {
			// talking with you: stop, turn to face you, listen; speak while there is speech
			const dx = cam.x - S.pos.x, dz = cam.z - S.pos.z, d = Math.hypot(dx, dz);
			M.want.heading = Math.atan2(dx, dz);
			M.want.speed = d > 2.4 ? 0.8 : 0;
			S.look.target = cam;
			const speaking = performance.now() < (p.speakUntil || 0);
			S.talk = speaking ? 1 : 0;
			M.setPose(speaking ? 'rest' : 'listen');
			// while you are talking to them, they nod along now and then
			p.nodT = (p.nodT || 0) - dt;
			if (!speaking && p.nodT < 0) { p.nodT = 3 + Math.random() * 5; if (Math.random() < 0.5) M.gesture('nod'); }
			return;
		}
		if (p.role === 'chat') {
			// find someone close to talk to, or wait for them to come
			if (!p.partner) {
				for (const o of pool) if (o !== p && o.active && !o.P.dna.child && o.route?.kind !== 'seat' && o.route?.kind !== 'follow' && !o.partner && o.role !== 'jog' && o.M.S.pos.distanceTo(S.pos) < 12) { p.partner = o; o.partner = p; o.role = 'chat'; break; }
			}
			if (p.partner) {
				const o = p.partner.M.S.pos, d = o.distanceTo(S.pos);
				M.want.heading = Math.atan2(o.x - S.pos.x, o.z - S.pos.z);
				M.want.speed = d > 1.4 ? 0.9 : 0;
				S.look.target = new THREE.Vector3(o.x, o.y + p.partner.P.height * 0.93, o.z);
				// take turns talking
				S.talk = d < 1.6 && Math.sin(performance.now() / 1000 * 0.35 + p.P.dna.seed) > 0 ? 1 : 0;
				// the speaker talks with their hands; the listener nods, laughs, shrugs
				p.gT = (p.gT || 0) - dt;
				if (d < 1.8 && p.gT < 0) {
					const T = p.P.dna.temper || { outgoing: 0.5 };
					p.gT = 1.5 + Math.random() * (5 - T.outgoing * 3);
					const bank = S.talk ? ['explain', 'explain', 'open', 'emphatic', 'shrug', 'point', 'think'] : ['nod', 'nod', 'laugh', 'shrug', 'think'];
					if (Math.random() < 0.4 + T.outgoing * 0.5) M.gesture(bank[Math.floor(Math.random() * bank.length)]);
				}
				M.setPose(S.talk ? 'rest' : 'listen');
				if (p.timer < 0) { p.role = 'walk'; p.partner.role = 'walk'; p.partner.partner = null; p.partner = null; S.talk = 0; S.look.target = null; }
				return;
			}
			if (p.timer < 0) p.role = 'walk';
		}
		if (R.kind === 'follow') { followParent(p, dt); return; }
		if (R.kind === 'visit') { visit(p, dt, cam); return; }
		if (R.kind === 'seat') {
			// in their seat: facing the table, now and then a word and a gesture to whoever is across
			M.want.speed = 0; M.want.heading = R.seat.heading;
			p.gT = (p.gT || Math.random() * 6) - dt;
			if (p.gT < 0) { p.gT = 3 + Math.random() * 8; if (Math.random() < 0.6) M.gesture(['nod', 'explain', 'laugh', 'shrug', 'think'][Math.floor(Math.random() * 5)]); }
			S.talk = Math.sin(performance.now() / 1000 * 0.3 + p.P.dna.seed) > 0.4 ? 1 : 0;
			return;
		}
		if (p.role === 'wait') { M.want.speed = 0; M.setPose(p.idlePose || 'rest'); if (p.timer < 0) { p.role = 'walk'; M.setPose('rest'); } return; }
		const run = p.role === 'jog';
		M.want.run = run ? 1 : 0;
		const speed = run ? 2.6 + (p.P.dna.seed % 7) * 0.08 : pace;
		if (R.kind === 'venue') { venueWander(p); return; }
		if (R.kind === 'wander') {
			const d = Math.hypot(R.goal.x - S.pos.x, R.goal.z - S.pos.z);
			if (d < 1.5) { const W = world(), pts = (W.island.paths || []).flatMap((q) => q.points); const q = pts.length ? pts[Math.floor(Math.random() * pts.length)] : { x: R.home.x + (Math.random() - 0.5) * 60, z: R.home.z + (Math.random() - 0.5) * 60 }; R.goal.set(q.x, 0, q.z); if (Math.random() < 0.3) { p.role = 'wait'; p.timer = 3 + Math.random() * 6; } }
			M.want.heading = Math.atan2(R.goal.x - S.pos.x, R.goal.z - S.pos.z);
			M.want.speed = giveWay(p, speed * 0.85, cam);
			return;
		}
		if (R.kind === 'street' && maybeVisit(p, dt)) return;
		if (R.kind === 'street') {
			// along the sidewalk; at the end of the street, on into the one that joins it, or back
			let tgt = curbPoint(R.road, R.s, R.side);
			if (Math.hypot(tgt.x - S.pos.x, tgt.z - S.pos.z) < 2.2) {
				R.s += R.dir * 2.5;
				const L = roadLen(R.road);
				if (R.s < 0 || R.s > L) {
					const ex = R.road.pts[R.s < 0 ? 0 : R.road.pts.length - 2], ez = R.road.pts[R.s < 0 ? 1 : R.road.pts.length - 1];
					const next = world().real.near('roads', ex, ez, 30).filter((q) => q !== R.road && (q.walked || TRAIL.has(q.cls)) && !q.bridge && (Math.hypot(q.pts[0] - ex, q.pts[1] - ez) < 16 || Math.hypot(q.pts[q.pts.length - 2] - ex, q.pts[q.pts.length - 1] - ez) < 16));
					if (next.length && Math.random() < 0.85) {
						const q = next[Math.floor(Math.random() * next.length)], atStart = Math.hypot(q.pts[0] - ex, q.pts[1] - ez) < 16;
						R.road = q; R.dir = atStart ? 1 : -1; R.s = atStart ? 1 : roadLen(q) - 1;
						// keep to the same hand of the street as we turn
						R.side = Math.random() < 0.8 ? R.side : -R.side;
					} else { R.dir = -R.dir; R.s = Math.min(L, Math.max(0, R.s)); }
				}
				if (Math.random() < 0.02) { p.role = 'wait'; p.timer = 2 + Math.random() * 5; }
				tgt = curbPoint(R.road, R.s, R.side);
			}
			M.want.heading = Math.atan2(tgt.x - S.pos.x, tgt.z - S.pos.z);
			M.want.speed = giveWay(p, speed, cam);
			return;
		}
		// round the block; at a corner, sometimes cross to the next block
		const tgt = R.loop.pts[R.next];
		const d = Math.hypot(tgt.x - S.pos.x, tgt.z - S.pos.z);
		if (d < 1.2) {
			if (Math.random() < 0.3) {
				// cross the street: over to the corner of the neighbouring block, then round it
				const out = new THREE.Vector3().subVectors(tgt, new THREE.Vector3().addVectors(R.loop.pts[0], R.loop.pts[2]).multiplyScalar(0.5)).normalize();
				const far = tgt.clone().addScaledVector(out, 18);
				const nl = blockLoop(far.x, far.z);
				if (nl) { R.loop = nl; let best = 0; for (let k = 1; k < 4; k++) if (nl.pts[k].distanceTo(tgt) < nl.pts[best].distanceTo(tgt)) best = k; R.next = best; R.crossing = true; }
				else R.next = (R.next + R.dir + 4) % 4;
			} else R.next = (R.next + R.dir + 4) % 4;
			if (Math.random() < 0.08) { p.role = 'wait'; p.timer = 2 + Math.random() * 5; }
		}
		M.want.heading = Math.atan2(tgt.x - S.pos.x, tgt.z - S.pos.z);
		// slow for the corner, and give way to people in the way
		let v = speed * (d < 3 ? 0.75 : 1);
		for (const o of pool) {
			if (o === p || !o.active) continue;
			const dx = o.M.S.pos.x - S.pos.x, dz = o.M.S.pos.z - S.pos.z, dd = Math.hypot(dx, dz);
			if (dd < 1.6) {
				const ahead = (dx * Math.sin(S.heading) + dz * Math.cos(S.heading)) / dd;
				if (ahead > 0.6) { v *= 0.5; M.want.heading += 0.4; }
			}
		}
		M.want.speed = giveWay(p, v, cam);
	}
	// in through a door: now and then someone passing a public building (a shop, the summit's
	// museum, a park's restroom) goes in by its door, which opens for them (interiors/index.js
	// walkers), looks about a while, and comes out again to carry on
	function maybeVisit(p, dt) {
		p.visitT = (p.visitT ?? 8 + Math.random() * 20) - dt;
		if (p.visitT > 0 || p.P.dna.child || p.fam || p.partner) return false;
		p.visitT = 15 + Math.random() * 30;
		const I = world().interiors, S = p.M.S;
		if (!I?.doorsNear || Math.random() > 0.35) return false;
		const ds = I.doorsNear(S.pos.x, S.pos.z, 25);
		if (!ds.length) return false;
		const D = ds[Math.floor(Math.random() * ds.length)];
		p.route = { kind: 'visit', back: p.route, door: D, stage: 0, t: 0 };
		return true;
	}
	function visit(p, dt, cam) {
		const R = p.route, M = p.M, S = M.S, D = R.door;
		R.t += dt;
		const tgt = R.stage === 0 || R.stage === 2 ? D.outside : D.inside;
		const d = Math.hypot(tgt.x - S.pos.x, tgt.z - S.pos.z);
		if (R.stage === 1 && d < 0.8) { R.stage = 3; R.wait = 4 + Math.random() * 10; }
		if (R.stage === 3) {
			M.want.speed = 0; M.setPose('rest');
			R.wait -= dt;
			if (R.wait < 0) R.stage = 2;
			return;
		}
		if (d < 0.8) { if (R.stage === 0) R.stage = 1; else if (R.stage === 2) { p.route = R.back; return; } }
		// (given up if it takes too long: the way in was not there after all)
		if (R.t > 90) { p.route = R.back; return; }
		M.want.heading = Math.atan2(tgt.x - S.pos.x, tgt.z - S.pos.z);
		M.want.speed = giveWay(p, p.P.dna.gait.pace * (d < 2 ? 0.6 : 1), cam);
	}
	// solid: people keep out of walls, parked cars and the rocks (the same pushes you get)
	// and out of your own space; walked into a wall for a while, they turn back
	const PP = new THREE.Vector3(), walkers = [];
	function solid(p, dt, cam) {
		const S = p.M.S, W = world(), I = W.island;
		const x0 = S.pos.x, z0 = S.pos.z;
		if (I.extraPush) { PP.set(S.pos.x, S.pos.y + 1.6, S.pos.z); I.extraPush(PP, S.pos.y); S.pos.x = PP.x; S.pos.z = PP.z; }
		const Y = you(cam), dx = S.pos.x - Y.x, dz = S.pos.z - Y.z, d = Math.hypot(dx, dz), R = 0.62;
		if (d < R && Math.abs(S.pos.y - (Y.y - 1.68)) < 1.4) { const k = d > 1e-3 ? R / d : 0; S.pos.x = Y.x + (d > 1e-3 ? dx * k : R); S.pos.z = Y.z + (d > 1e-3 ? dz * k : 0); }
		const pushed = Math.hypot(S.pos.x - x0, S.pos.z - z0);
		p.stuckT = pushed > 0.004 && p.M.want.speed > 0.3 && d > 1.2 ? (p.stuckT || 0) + dt : Math.max(0, (p.stuckT || 0) - dt);
		if (p.stuckT > 2) {
			p.stuckT = 0;
			const R2 = p.route;
			if (R2?.kind === 'street') { R2.dir = -R2.dir; R2.s += R2.dir * 5; }
			else if (R2?.kind === 'wander') R2.goal.set(R2.home.x + (Math.random() - 0.5) * 40, 0, R2.home.z + (Math.random() - 0.5) * 40);
			else if (R2?.loop) R2.next = (R2.next - R2.dir + 8) % 4;
		}
	}
	// you, where you stand (not the camera, which in third person hangs behind you)
	function you(cam) { const P = world().player?.state; return P && !P.flying ? P.pos : cam; }
	// making room: someone coming your way (or anyone's) eases to their right from a few
	// metres off and slows as they pass, as people do on a trail; returns the speed
	function giveWay(p, v, cam) {
		const M = p.M, S = M.S, hx = Math.sin(S.heading), hz = Math.cos(S.heading);
		const dodge = (x, z, reach, k) => {
			const dx = x - S.pos.x, dz = z - S.pos.z, d = Math.hypot(dx, dz);
			if (d > reach || d < 1e-3) return;
			const ahead = (dx * hx + dz * hz) / d;
			if (ahead < 0.2) return;
			// to the right of them, unless the other is already on that side
			const side = dx * hz - dz * hx > 0.4 * d ? -1 : 1;
			const near = 1 - d / reach;
			M.want.heading += side * near * ahead * 0.9 * k;
			v *= 1 - near * ahead * 0.55 * k;
		};
		const Y = you(cam);
		dodge(Y.x, Y.z, 4.5, 1);
		for (const o of pool) if (o !== p && o.active && o.partner !== p && o.route?.parent !== p && p.route?.parent !== o) dodge(o.M.S.pos.x, o.M.S.pos.z, 2.2, 0.6);
		return v;
	}

	// a rod for someone fishing off the pier's rail: held out ahead of them, the line down
	const rodGeo = new THREE.CylinderGeometry(0.006, 0.014, 2.4, 5).translate(0, 1.2, 0), rodMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4 });
	function rodFor(p) {
		if (!p.rod) { p.rod = new THREE.Mesh(rodGeo, rodMat); p.rod.position.set(-0.08, p.P.height * 0.55, 0.3); p.rod.rotation.x = 0.9; p.P.root.add(p.rod); }
		return p.rod;
	}

	// ---------- what they wear ----------
	// dressed for the place and what they are doing there (wardrobe.js): the same person in
	// the same place and doing the same thing always dressed the same way; re-dressed only
	// when a body is handed on to somewhere, or something, new
	let lastNeed = null;
	function wearCtx(cam, need, activity) {
		const W = world(), place = placeAt(cam.x, cam.z, need?.zone);
		const hours = W?.sky?.state?.hours ?? 13, night = hours >= 20 || hours < 4;
		const cl = climate({ hours, place, rain: W?.weather?.state?.rainHere || 0, cover: W?.weather?.state?.cover ?? 0.4 });
		// out in the world: the place's own weather and ways (region/)
		const H = regionalNow();
		if (H?.kit) { const cold = coldOf(H.climate); return { place, activity, cold, wet: cl.wet, night, H, key: H.culture?.key + '|' + H.kit.id + '|' + activity + '|' + Math.round(cold * 3) + (night ? 'n' : '') }; }
		return { place, activity, cold: cl.cold, wet: cl.wet, night, key: place + '|' + activity + '|' + Math.round(cl.cold * 3) + (cl.wet ? 'w' : '') + (night ? 'n' : '') };
	}
	// an outfit for the context: the wardrobe's, or the region's own out in the world
	function outfitFor(r, d, c) {
		if (!c.H) return dressFor(r, d, c);
		const { outfit, head } = regionalDress(r, d, c.H.kit, c.H.culture, { cold: c.cold, role: c.activity === 'sit' ? 'sit' : 'walk', id: c.H.regionId });
		outfit.gen = outfit.gen || 'x'; outfit.headScarf = head.scarf;
		return outfit;
	}
	function wear(p, cam, need) {
		const act = p.role === 'jog' ? 'jog' : p.route?.kind === 'seat' ? (need?.zone === 'office' ? 'work' : 'sit') : 'walk';
		const c = wearCtx(cam, need, act);
		if (p.dressKey === c.key) return;
		const d = p.P.dna, keep = d.style;
		let h = 0; for (const ch of c.key) h = (h * 31 + ch.charCodeAt(0)) | 0;
		const o = outfitFor(rng(d.seed ^ h), d, c);
		o.hair = keep?.hair; o.printKind = keep?.printKind;
		if (o.hair) o.hair = { ...o.hair, scarf: o.headScarf || (c.H ? null : o.hair.scarf) };
		d.style = o; d.styleSig = JSON.stringify(d.outfit);
		p.P.redress(o);
		p.dressKey = c.key;
	}

	// ---------- the loop ----------
	let building = false;
	async function grow(kid = false) {
		if (building || !A) return;
		building = true;
		try {
			const seed = (seedN++ * 2654435761) >>> 0;
			const r = rng(seed ^ 0xc41d);
			const c = wearCtx(lastCam, lastNeed, 'walk');
			const anc = c.H ? ancestryFor(c.H.culture, rng(seed ^ 0xa11), c.H.kit.build?.dense ? 0.15 : 0.06) : undefined;
			const d = personDNA(seed, kid ? { age: 3 + r() * 8, ctx: c, ancestry: anc } : { ctx: c, ancestry: anc });
			if (c.H && !kid) { const o = outfitFor(rng(seed ^ 0x57a1e), d, c); o.hair = d.style.hair; o.printKind = d.style.printKind; if (o.headScarf) o.hair = { ...o.hair, scarf: o.headScarf }; d.style = o; d.styleSig = JSON.stringify(d.outfit); }
			const P = buildPerson(A, d);
			const M = motionFor(P);
			const p = { P, M, active: false, role: 'walk', dressKey: c.key };
			// each footfall, for the street sound
			M.S.onStep = (at, sp) => { if (p.active && steps.length < 64) steps.push({ x: at.x, z: at.z, k: Math.min(1.5, 0.5 + sp * 0.5) }); };
			pool.push(p);
			group.add(P.root);
			P.root.visible = false;
		} finally { building = false; }
	}

	let acc = 0, turn = false;
	const lastCam = new THREE.Vector3();
	function update(dt, t, cam, night, enabled = true) {
		group.visible = enabled;
		if (!enabled) return;
		const need = demand(cam, night);
		lastNeed = need; lastCam.copy(cam);
		if (need.n > 0 && !A && !failed) ensure();
		// grown-ups, and (where families go) children with them
		const nk = Math.min(KIDS, Math.round(need.n * (need.kids || 0))), na = need.n - nk;
		const kidPool = pool.filter((p) => p.P.dna.child), adultPool = pool.filter((p) => !p.P.dna.child && p.demo === undefined);
		// build the families together: a child's body whenever the children lag the grown-ups
		const wantA = na > 0 && adultPool.length < Math.min(MAX, na + 2) && adultPool.filter((p) => p.active).length < na;
		const wantK = nk > 0 && kidPool.length < Math.min(KIDS, nk + 1) && kidPool.length / nk < Math.max(0.3, adultPool.length / Math.max(1, na));
		if (wantK && adultPool.length) grow(true); else if (wantA) grow(false);
		let active = 0, kids = 0;
		const drop = (p) => {
			if (p.rod) p.rod.visible = false;
			p.active = false; p.P.root.visible = false; p.leaving = false; p.fade = 0;
			// out of the family: the grown-up lets go of the hand
			if (p.fam) { const F = p.fam; if (p.P.dna.child) F.kids = Math.max(0, (F.kids || 1) - 1); else if (F.spouse === p) F.spouse = null; if (p.route?.kind === 'follow') p.route.parent.M.hold(p.route.theirs, false); p.fam = null; }
			p.M.hold('L', false); p.M.hold('R', false);
			if (p.route?.kind === 'seat') { p.route.seat.taken = false; p.M.stand(); p.M.S.sitK.v = 0; p.route = null; }
			if (p.partner) { p.partner.partner = null; p.partner = null; }
		};
		for (const p of pool) {
			const S = p.M.S;
			if (p.active && p.demo === undefined) {
				const d = Math.hypot(S.pos.x - cam.x, S.pos.z - cam.z), kid = p.P.dna.child;
				// family members go when their family does
				const F = p.fam;
				const go = F ? !F.active || (p.route?.kind === 'follow' && !p.route.parent.active) || (kid ? kids >= nk : active >= na) : kid || (!p.engaged && (d > NEAR * 1.25 || active >= na));
				if (go && !p.leaving) { p.leaving = true; p.leaveT = 0; }
				if (p.leaving) {
					// going: gone once out of sight (or far off); faded out if you keep watching
					p.leaveT += dt;
					if (d > NEAR * 1.7 || !seen(S.pos.x, S.pos.y, S.pos.z, d)) { drop(p); continue; }
					if (p.leaveT > 6) { p.fade = Math.max(0, (p.fade ?? 1) - dt * 1.2); if (p.fade <= 0) { drop(p); continue; } }
				} else if (kid) kids++; else active++;
				p.P.lod?.(d);
				// arriving: fading in
				if (!p.leaving && (p.fade ?? 1) < 1) p.fade = Math.min(1, (p.fade ?? 0) + dt * 1.25);
				fadePerson(p.P, p.fade ?? 1);
				steer(p, dt, cam);
				p.M.update(dt, t, cam);
				if (d < 150 && p.route?.kind !== 'seat') solid(p, dt, cam);
			}
		}
		// the doors of public buildings open for the people coming to them (interiors/index.js)
		const I = world().interiors;
		if (I?.walkers) { walkers.length = 0; for (const p of pool) if (p.active) walkers.push({ x: p.M.S.pos.x, z: p.M.S.pos.z, footY: p.M.S.pos.y }); I.walkers(walkers); }
		// fill up: one new arrival a frame at most
		acc += dt;
		if (acc > 0.15 && (active < na || kids < nk)) {
			acc = 0;
			// grown-ups and children by turns, so families form as the place fills
			turn = !turn;
			if (active < na && (kids >= nk || turn || !active)) {
				const idle = pool.find((p) => !p.active && p.demo === undefined && !p.P.dna.child);
				// a second grown-up for a family, or someone new
				const F = pool.find((o) => o.active && !o.leaving && o.kids > 0 && o.spouseWant && !o.spouse && !o.engaged && o.M.S.pos.distanceTo(cam) < NEAR && !seen(o.M.S.pos.x, o.M.S.pos.y, o.M.S.pos.z));
				if (idle && F) { seedN++; if (castCompanion(idle, F)) { wear(idle, cam, need); idle.active = true; idle.fade = 0; fadePerson(idle.P, 0.02); } else F.spouseWant = false; }
				else if (idle) { seedN++; if (cast(idle, cam, need.island, need.C, need.venue)) { wear(idle, cam, need); idle.active = true; idle.fade = 0; fadePerson(idle.P, 0.02); } }
			} else {
				const idle = kidPool.find((p) => !p.active);
				if (idle) { seedN++; if (castChild(idle, cam)) { wear(idle, cam, need); idle.active = true; idle.fade = 0; fadePerson(idle.P, 0.02); } }
			}
		}
	}


	// a line-up in front of you: for looking at the bodies and the gait
	async function lineup(cam, heading, n = 8, walk = true) {
		await ensure();
		if (!A) return 'assets failed';
		for (let k = 0; k < n; k++) {
			let p = pool[k];
			if (!p) { const d = personDNA((k * 7919 + 17) >>> 0, {}); const P = buildPerson(A, d); p = { P, M: motionFor(P), active: false, role: 'walk' }; pool.push(p); group.add(P.root); }
			const side = (k - (n - 1) / 2) * 0.95;
			const x = cam.x + Math.sin(heading) * 4.2 + Math.cos(heading) * side, z = cam.z + Math.cos(heading) * 4.2 - Math.sin(heading) * side;
			p.M.place(x, ground(x, z), z, heading + Math.PI);
			p.P.root.visible = true; p.active = false; p.demo = walk;
			p.M.want.speed = 0;
		}
		return pool.length;
	}
	function demo(dt, t, cam) {
		for (const p of pool) if (p.demo !== undefined && p.P.root.visible && !p.active) { p.M.want.speed = p.demo ? 1.3 : 0; p.M.update(dt, t, cam); }
		for (const p of shown) { p.M.want.speed = p.walk ? 1.3 : 0; p.M.update(dt, t, cam); }
	}
	// a line of people dressed for a place and a thing to do, for looking at the clothes:
	// specs [{ age, male, place, activity, seed }] (or clear it with an empty list)
	const shown = [];
	async function showcase(cam, heading, specs = [], { gap = 0.9, dist = 4.2, walk = false } = {}) {
		await ensure();
		if (!A) return 'assets failed';
		for (const p of shown.splice(0)) { p.P.root.removeFromParent(); p.P.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
		specs.forEach((q, k) => {
			let d = null;
			for (let tries = 0; tries < 40; tries++) {
				const seed = ((q.seed ?? k * 7919 + 17) + tries * 104729) >>> 0;
				d = personDNA(seed, { age: q.age, ctx: { place: q.place, activity: q.activity, hours: q.hours ?? 13, cold: q.cold } });
				if (q.male === undefined || d.male === q.male) break;
			}
			const P = buildPerson(A, d), M = motionFor(P);
			const side = (k - (specs.length - 1) / 2) * gap;
			const x = cam.x + Math.sin(heading) * dist + Math.cos(heading) * side, z = cam.z + Math.cos(heading) * dist - Math.sin(heading) * side;
			M.place(x, ground(x, z), z, heading + Math.PI);
			if (q.pose) M.setPose(q.pose);
			group.add(P.root);
			shown.push({ P, M, walk });
		});
		return shown.map((p) => { const o = p.P.outfit; return `${Math.round(p.P.dna.age)}${p.P.dna.male ? 'm' : 'f'} ${o.gen} ${o.top?.kind || '-'} ${o.outer?.kind || ''} ${o.bottom?.kind || '-'} ${o.shoes?.kind || '-'} [${(o.acc || []).map((a) => a.kind).join(',')}]`; }).join(' | ');
	}
	// the nearest pavement to a point: [x, z, heading along it]
	function sidewalk(x, z) {
		const real = world().real;
		if (real?.loaded() && real.inside(x, z)) return real.sidewalk(x, z);
		const L = blockLoop(x, z); if (!L) return null;
		let best = null, bd = 1e9;
		for (let k = 0; k < 4; k++) { const a = L.pts[k], b = L.pts[(k + 1) % 4]; for (let t = 0; t <= 1; t += 0.05) { const px = a.x + (b.x - a.x) * t, pz = a.z + (b.z - a.z) * t, d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = [px, pz, Math.atan2(b.x - a.x, b.z - a.z)]; } } }
		return best;
	}
	// the person just ahead of you, close enough to talk to (the walkers here, and anyone
	// another system has out: addTalkers)
	function facing(cam, yaw, maxD = 3.4) {
		let best = null, bs = 1e9;
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
		for (const p of [...pool, ...talkers()]) {
			if (!p.active || p.demo !== undefined) continue;
			const S = p.M.S, dx = S.pos.x - cam.x, dz = S.pos.z - cam.z, d = Math.hypot(dx, dz);
			if (d > maxD || Math.abs(S.pos.y + 1.6 - cam.y) > 2.5) continue;
			const ahead = (dx * fx + dz * fz) / (d || 1);
			if (ahead < 0.55) continue;
			const sc = d * (1.6 - ahead);
			if (sc < bs) { bs = sc; best = p; }
		}
		return best;
	}
	function engage(p) { p.engaged = true; p.role = 'wait'; if (p.partner) { p.partner.partner = null; p.partner = null; } p.M.S.gestures.length = 0; }
	function release(p) { if (!p) return; p.engaged = false; p.speakUntil = 0; p.M.S.talk = 0; p.M.S.look.target = null; p.timer = 1 + Math.random() * 2; }
	return { update, lineup, showcase, demo, pool, group, sidewalk, steps, facing, engage, release, ready: () => !!A };
}
