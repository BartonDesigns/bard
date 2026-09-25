// Crysis people in the world. A pool of real bodies (MakeHuman, see body.js) lives
// round the player and is handed out to whoever is near: people walking the city's
// sidewalks round their blocks and crossing at the corners, joggers, pairs stopped to
// talk, people waiting outside shops; villagers on the island's paths. Downtown is busy,
// the suburbs quiet, and at night the streets empty. Bodies are built a few at a time so
// nothing stutters, and each is re-dressed and re-cast when it is handed to someone new.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA, rng } from './body.js';
import { createMotion } from './motion.js';
import { BLOCKS, toGrid, fromGrid, STYLE } from '../bay/styles.js';

const MAX = 26, NEAR = 70;
const steps = [];

export function createPeople(scene, world) {
	const group = new THREE.Group();
	group.name = 'people';
	scene.add(group);
	let A = null, failed = false;
	const pool = [];                  // { P, M, role, route, ... }
	let seedN = 1;
	const ground = (x, z) => world().island.heightAt(x, z);

	async function ensure() {
		if (A || failed) return;
		try { A = await loadPeopleAssets(); } catch (e) { failed = true; console.warn('[people]', e); }
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
		const onIsland = Math.max(Math.abs(cam.x), Math.abs(cam.z)) < W.island.half;
		if (onIsland) {
			const v = W.island.village, d = Math.hypot(cam.x - v.x, cam.z - v.z);
			return { n: d < 260 ? Math.round(8 * (1 - night * 0.7)) : 0, island: true };
		}
		const U = W.bayArea?.urbanAt(cam.x, cam.z);
		if (!U || U.u < 0.2 || cam.y - ground(cam.x, cam.z) > 90) return { n: 0 };
		const busy = U.s === STYLE.sf || U.d > 0.2 ? 1 : U.s === STYLE.retail ? 0.8 : U.s === STYLE.older ? 0.55 : U.s === STYLE.office ? 0.45 : 0.35;
		return { n: Math.round(MAX * busy * (1 - night * 0.75)), island: false };
	}

	// the real city's sidewalks: a point beside a street, on one side, at distance s along it
	function roadLen(r) { if (r.len) return r.len; let L = 0; for (let i = 2; i < r.pts.length; i += 2) L += Math.hypot(r.pts[i] - r.pts[i - 2], r.pts[i + 1] - r.pts[i - 1]); return (r.len = L); }
	function curbPoint(r, s, side) {
		const p = r.pts;
		let acc = 0;
		for (let i = 2; i < p.length; i += 2) {
			const ax = p[i - 2], az = p[i - 1], bx = p[i], bz = p[i + 1], L = Math.hypot(bx - ax, bz - az);
			if (acc + L >= s || i === p.length - 2) {
				const t = L ? Math.min(1, Math.max(0, (s - acc) / L)) : 0, off = (r.w / 2 + 0.9) * side;
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
		const roads = real.near('roads', x, z, 60).filter((q) => q.walked && !q.bridge);
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

	function cast(p, cam, island) {
		const r = rng(seedN * 7919 + 13);
		const W = world();
		p.role = r() < 0.12 && !island ? 'jog' : r() < 0.25 ? 'chat' : r() < 0.35 ? 'wait' : 'walk';
		p.talking = false; p.partner = null; p.timer = 5 + r() * 20;
		const M = p.M;
		M.S.talk = 0; M.S.look.target = null;
		// somewhere near but not in your face, and ideally out of sight
		for (let k = 0; k < 20; k++) {
			const a = r() * Math.PI * 2, d = 18 + r() * (NEAR - 25);
			const x = cam.x + Math.cos(a) * d, z = cam.z + Math.sin(a) * d;
			if (island) {
				const pts = (W.island.paths || []).flatMap((q) => q.points);
				const v = W.island.village;
				const q = pts.length ? pts[Math.floor(r() * pts.length)] : { x: v.x + (r() - 0.5) * 80, z: v.z + (r() - 0.5) * 80 };
				if (ground(q.x, q.z) < 0.6) continue;
				p.route = { kind: 'wander', home: new THREE.Vector3(v.x, 0, v.z), goal: new THREE.Vector3(q.x, 0, q.z) };
				M.place(q.x, ground(q.x, q.z), q.z, r() * 6.28);
				return true;
			}
			const st = streetRoute(x, z, r);
			if (st) {
				const q = curbPoint(st.road, st.s, st.side), q2 = curbPoint(st.road, st.s + st.dir, st.side);
				if (ground(q.x, q.z) < 0.6) continue;
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
			if (ground(px, pz) < 0.6) continue;
			const dir = r() < 0.5 ? 1 : -1;
			p.route = { kind: 'loop', loop, side, dir, next: dir > 0 ? (side + 1) % 4 : side };
			M.place(px, ground(px, pz), pz, Math.atan2(a1.x - a0.x, a1.z - a0.z) * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : Math.PI));
			return true;
		}
		return false;
	}

	function steer(p, dt, cam) {
		const M = p.M, S = M.S, R = p.route;
		p.timer -= dt;
		const pace = p.P.dna.gait.pace;
		if (p.role === 'chat') {
			// find someone close to talk to, or wait for them to come
			if (!p.partner) {
				for (const o of pool) if (o !== p && o.active && !o.partner && o.role !== 'jog' && o.M.S.pos.distanceTo(S.pos) < 12) { p.partner = o; o.partner = p; o.role = 'chat'; break; }
			}
			if (p.partner) {
				const o = p.partner.M.S.pos, d = o.distanceTo(S.pos);
				M.want.heading = Math.atan2(o.x - S.pos.x, o.z - S.pos.z);
				M.want.speed = d > 1.4 ? 0.9 : 0;
				S.look.target = new THREE.Vector3(o.x, o.y + p.partner.P.height * 0.93, o.z);
				// take turns talking
				S.talk = d < 1.6 && Math.sin(performance.now() / 1000 * 0.35 + p.P.dna.seed) > 0 ? 1 : 0;
				if (p.timer < 0) { p.role = 'walk'; p.partner.role = 'walk'; p.partner.partner = null; p.partner = null; S.talk = 0; S.look.target = null; }
				return;
			}
			if (p.timer < 0) p.role = 'walk';
		}
		if (p.role === 'wait') { M.want.speed = 0; if (p.timer < 0) p.role = 'walk'; return; }
		const run = p.role === 'jog';
		M.want.run = run ? 1 : 0;
		const speed = run ? 2.6 + (p.P.dna.seed % 7) * 0.08 : pace;
		if (R.kind === 'wander') {
			const d = Math.hypot(R.goal.x - S.pos.x, R.goal.z - S.pos.z);
			if (d < 1.5) { const W = world(), pts = (W.island.paths || []).flatMap((q) => q.points); const q = pts.length ? pts[Math.floor(Math.random() * pts.length)] : { x: R.home.x + (Math.random() - 0.5) * 60, z: R.home.z + (Math.random() - 0.5) * 60 }; R.goal.set(q.x, 0, q.z); if (Math.random() < 0.3) { p.role = 'wait'; p.timer = 3 + Math.random() * 6; } }
			M.want.heading = Math.atan2(R.goal.x - S.pos.x, R.goal.z - S.pos.z);
			M.want.speed = speed * 0.85;
			return;
		}
		if (R.kind === 'street') {
			// along the sidewalk; at the end of the street, on into the one that joins it, or back
			let tgt = curbPoint(R.road, R.s, R.side);
			if (Math.hypot(tgt.x - S.pos.x, tgt.z - S.pos.z) < 2.2) {
				R.s += R.dir * 2.5;
				const L = roadLen(R.road);
				if (R.s < 0 || R.s > L) {
					const ex = R.road.pts[R.s < 0 ? 0 : R.road.pts.length - 2], ez = R.road.pts[R.s < 0 ? 1 : R.road.pts.length - 1];
					const next = world().real.near('roads', ex, ez, 30).filter((q) => q !== R.road && q.walked && !q.bridge && (Math.hypot(q.pts[0] - ex, q.pts[1] - ez) < 16 || Math.hypot(q.pts[q.pts.length - 2] - ex, q.pts[q.pts.length - 1] - ez) < 16));
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
			let v = speed;
			const dc = Math.hypot(cam.x - S.pos.x, cam.z - S.pos.z);
			if (dc < 1.5) { v *= 0.3; M.want.heading += 0.6; }
			M.want.speed = v;
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
		const dc = Math.hypot(cam.x - S.pos.x, cam.z - S.pos.z);
		if (dc < 1.5) { v *= 0.3; M.want.heading += 0.6; }
		M.want.speed = v;
	}

	// ---------- the loop ----------
	let building = false;
	async function grow(cam, island) {
		if (building || !A || pool.length >= MAX) return;
		building = true;
		try {
			const seed = (seedN++ * 2654435761) >>> 0;
			const d = personDNA(seed, { jogger: false });
			const P = buildPerson(A, d);
			const M = createMotion(P, ground);
			const p = { P, M, active: false, role: 'walk' };
			// each footfall, for the street sound
			M.S.onStep = (at, sp) => { if (p.active && steps.length < 64) steps.push({ x: at.x, z: at.z, k: Math.min(1.5, 0.5 + sp * 0.5) }); };
			pool.push(p);
			group.add(P.root);
			P.root.visible = false;
		} finally { building = false; }
	}

	let acc = 0;
	function update(dt, t, cam, night, enabled = true) {
		group.visible = enabled;
		if (!enabled) return;
		const need = demand(cam, night);
		if (need.n > 0 && !A && !failed) ensure();
		if (need.n > pool.filter((p) => p.active).length && pool.length < Math.min(MAX, need.n + 2)) grow(cam, need.island);
		let active = 0;
		for (const p of pool) {
			const S = p.M.S;
			if (p.active && p.demo === undefined) {
				const d = Math.hypot(S.pos.x - cam.x, S.pos.z - cam.z);
				if (d > NEAR * 1.25 || active >= need.n) { p.active = false; p.P.root.visible = false; if (p.partner) { p.partner.partner = null; p.partner = null; } continue; }
				active++;
				steer(p, dt, cam);
				p.M.update(dt, t, cam);
			}
		}
		// fill up: one new arrival a frame at most
		acc += dt;
		if (active < need.n && acc > 0.15) {
			acc = 0;
			const idle = pool.find((p) => !p.active && p.demo === undefined);
			if (idle) { seedN++; if (cast(idle, cam, need.island)) { idle.active = true; idle.P.root.visible = true; } }
		}
	}

	// a line-up in front of you: for looking at the bodies and the gait
	async function lineup(cam, heading, n = 8, walk = true) {
		await ensure();
		if (!A) return 'assets failed';
		for (let k = 0; k < n; k++) {
			let p = pool[k];
			if (!p) { const d = personDNA((k * 7919 + 17) >>> 0, {}); const P = buildPerson(A, d); p = { P, M: createMotion(P, ground), active: false, role: 'walk' }; pool.push(p); group.add(P.root); }
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
	return { update, lineup, demo, pool, group, sidewalk, steps, ready: () => !!A };
}
