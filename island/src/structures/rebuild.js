// The crews. Not long after a building is damaged (a third of an hour of game time) a crew
// arrives, every truck of it in one company's colours with the name on its doors. The site is
// laid out from the street it is on (crewplan.js): the kerb found from the nearest road's own
// line and width, the fence (mesh panels on rubber feet, clamped, stayed, the company's banners
// and the safety signs on them, a gate swung open) kept off the pavement where there is room
// for one, returned down the sides as far as the neighbours allow; the office, the toilet and a
// light tower or two inside it; cones out along the kerb in a taper ahead of the trucks. The
// trucks drive in along the road and pull in to the kerb (the dump truck and the mixer go past
// and back in, beeping), and drive off again when their part is done: a dump truck while the
// rubble goes, the mixer turning and a boom truck of bars while the frame rises, blocks while
// the walls close in, glass on its A-frame and the glazier's van at the end. A mobile crane on
// its outriggers (cribbed level on timber), or a tower crane over the big ones (tied back to the
// building when it stands tall, red lights on it by night), lifts the stage's loads from the
// site up onto the work on its hook, slewing round and back. Scaffolding rises lift by lift
// with the work (bays, boards, toe boards, rails, ladders, ties into the facade, braces,
// netting that sags a little between its ties) on every face with room for it, and comes down
// at the end top first. The crew (crewfolk.js) shovel the rubble, hammer and lay blocks up on
// the lifts, carry from the trucks through the gate, guide the loads in, hold the mixer's chute.
// At night the light towers light the work (two real lights for the nearest site, the rest by
// their glow), the beacons flash and the reflective strips catch the light. Two to five game
// hours by how bad it was (shell.js draws the building's own stages); a broken window alone
// gets the glazier's van and an hour's work. While a citywide catastrophe is under way
// (cataclysm(true)) nobody comes: the work waits, and resumes once it is over.

import * as THREE from 'three';
import { bid, frameOf, onFace, faceLen, FACES, hash } from './ids.js';
import { isBuilding } from './overlap.js';
import { parts, cloth, clothMaterial, kitMesh, kitShared, COMPANIES, COLORS as C, rect } from './crewkit.js';
import { truckGeo, TRUCKS } from './crewtrucks.js';
import { craneUpperGeo, hookGeo, HOOK_DROP, towerMastGeo, towerJibGeo, trolleyGeo, BOOM_FOOT } from './crewcranes.js';
import { herasPanel, gate, barrier, cone, debrisBox, cabin, toilet, lightTower, sandHeap, wheelbarrow, generator, stock } from './crewsite.js';
import { createCrew } from './crewfolk.js';
import { siteFrame, findKerb, roadAt, planSite, workHeights, kerbSlots, drivePath, pathAt, speedAt, liftAt } from './crewplan.js';
import { tierNow, qualityNow } from '../world/governor.js';

// the stages of a rebuild, by how far along it is
const STAGES = ['clearing', 'frame', 'cladding', 'glazing'];
export const stageOf = (p) => (p < 0.14 ? 0 : p < 0.48 ? 1 : p < 0.74 ? 2 : 3);
// (a tower crane over the tall or the broad; a mobile crane at the kerb for the rest)
export const towerJob = (o) => { const H = o.h - 1.2; return H > 24 || (H > 14 && o.w * o.d > 900); };
// the lot's faces at either end of a face (seen from outside): the one at its -u end, at its +u end
const MINUS_END = [3, 2, 0, 1], PLUS_END = [2, 3, 1, 0];
// what the crew brings to the kerb by the stage: [kind, load] for the first and second places
export function stageTrucks(stage, glassOnly, big) {
	if (glassOnly) return [['van', '']];
	if (stage === 0) return big ? [['dump', 'full']] : [['dump', 'full'], ['flat', 'none']];
	if (stage === 1) return [['mixer', ''], ['flat', 'bars']];
	if (stage === 2) return big ? [['flat', 'blocks'], ['flat', 'blocks']] : [['flat', 'blocks']];
	return [['flat', 'glass'], ['van', '']];
}
const LOAD = ['skip', 'bars', 'blocks', 'glass'];
const LOD_KIT = 110, LOD_TRUCK = 90, LOD_CRANE = 230, CREW_R = 170, FADE = 2.2;

export function createRebuild(ctx) {
	const { scene, isPhone, store, sounds } = ctx;
	const SITE_R = isPhone ? 200 : 360;
	const group = new THREE.Group();
	group.name = 'structures-crews';
	scene.add(group);
	const lite = () => isPhone || tierNow() >= 2;
	const crew = createCrew(group, isPhone ? 16 : 48);
	const glow = createGlow(group, isPhone ? 48 : 128);
	// two real lights for the nearest site's light towers at night (none on a phone)
	// (floodlights: spot lights aimed down at the work, so the light falls where the lamps point)
	const lamps = [];
	if (!isPhone) for (let i = 0; i < 2; i++) { const l = new THREE.SpotLight(0xfff1dc, 0, 60, 0.58, 0.6, 1.3); l.position.set(0, -1000, 0); l.target.position.set(0, -1001, 0); group.add(l, l.target); lamps.push(l); }
	let cataclysm = false, tickAt = -1e9, lastNow = null, nightK = 0;
	const sites = new Map(), list = [];          // id -> site; the same sites as a list for the frame
	// how far along a rebuild is (0..1), or null before the crew has started
	const progress = (rec) => (rec?.r0 == null ? null : Math.min(1, Math.max(0, (store.now() - rec.r0) / (rec.rd || 3))));
	const needs = (rec) => !!rec && ((rec.m && rec.m.length) || rec.c > 0 || (rec.g && rec.g.length));
	const glassOnly = (rec) => !((rec.m && rec.m.length) || rec.c > 0);
	function schedule(dtH) {
		const now = store.now();
		store.each((id, rec) => {
			if (!needs(rec)) { store.drop(id); return; }
			if (cataclysm) {
				// (nobody comes; work under way holds where it is)
				if (rec.r0 != null) { rec.r0 += dtH; store.touch(); }
				return;
			}
			if (rec.r0 == null) {
				const wait = glassOnly(rec) ? 0.2 : 0.35;
				if (now - (rec.t0 ?? now) >= wait) {
					rec.r0 = now;
					const sev = Math.min(1, (1 - (rec.hp ?? 1)) * 1.3 + (rec.c || 0) * 0.8 + (rec.m?.length || 0) * 0.04);
					rec.rd = glassOnly(rec) ? 0.6 + hash(rec.x, rec.z) * 0.6 : 2 + 3 * sev;
					store.put(id, rec);
				}
				return;
			}
			if (progress(rec) >= 1) { store.drop(id); ctx.repaired?.(id, rec); }
		});
	}
	// ---------- a site near you ----------
	function lotFor(id, rec) {
		const near = ctx.city()?.lotsNear?.(rec.x, rec.z, 2) || [];
		return near.find((o) => bid(o) === id) || null;
	}
	// whether a neighbour (any other building) stands at a point
	function blockedBy(o) {
		const city = ctx.city(), near = (city?.lotsNear?.(o.x, o.z, Math.max(o.w, o.d) / 2 + 30) || []).filter((q) => q !== o && isBuilding(q) && bid(q) !== bid(o));
		const F = near.map((q) => ({ q, F: frameOf(q) }));
		return (x, z, pad = 0.15) => {
			for (const { q, F: f } of F) { const [lx, lz] = f.l(x, z); if (Math.abs(lx) < q.w / 2 + pad && Math.abs(lz) < q.d / 2 + pad) return true; }
			return !!ctx.landmarks?.()?.inside?.(x, z);
		};
	}
	function roadsNear(G) {
		const [x, z] = G.w(0, 0), real = ctx.real?.();
		try { return real?.near ? real.near('roads', x, z, 40) : []; } catch { return []; }
	}
	// how far out from the front the buildings across the street stand (the middle of three looks)
	function gapAcross(G, blocked) {
		const d = [];
		for (const u of [-G.L / 3, 0, G.L / 3]) { let v = 1; for (; v <= 70; v += 1) { const [x, z] = G.w(u, v); if (blocked(x, z, 0)) break; } d.push(v); }
		d.sort((a, b) => a - b);
		return d[1];
	}
	function site(id, rec, o) {
		const gl = glassOnly(rec), f = ctx.frontOf?.(o) ?? 0, G = siteFrame(o, f, ctx.ground);
		const blocked = blockedBy(o), K = findKerb(G, roadsNear(G), gapAcross(G, blocked));
		const tower = !gl && towerJob(o), P = planSite(o, G, K, blocked, { tower, glassOnly: gl, lite: lite() });
		const co = Math.floor(hash(rec.x * 0.37, rec.z * 0.37 + 11) * COMPANIES.length);
		const [ox, oy, oz] = G.at(0, 0);
		const S = {
			id, rec, o, G, K, P, co, gl, tower, big: (o.h - 1.2) > 14 || o.w * o.d > 600, origin: [ox, oy, oz], blocked,
			root: new THREE.Group(), kit: null, old: null, scaf: null, clip: 0, crane: null, mobile: null, vehicles: [], workers: [], heads: [], aims: [],
			stage: -1, t: Math.random() * 10, beat: 0, fade: 0, leaving: false, loops: {}, anchors: [], slots: kerbSlots(G.L, P.gateU), seen: false,
		};
		S.root.position.set(ox, oy, oz);
		group.add(S.root);
		buildScaffold(S);
		if (tower) buildTower(S);
		else if (!gl) buildMobile(S);
		// the crew: how many, and each one's part
		// (fewer of them where the quality governor has the crowds thinned)
		const H = o.h - 1.2, n = gl ? 2 : Math.max(3, Math.round(Math.min(isPhone ? 4 : 7, 3 + Math.floor(H / 10)) * Math.min(1, 0.4 + (qualityNow()?.people ?? 1) * 0.6)));
		for (let i = 0; i < n; i++) S.workers.push({ i, u0: (hash(i, rec.s || 1) - 0.5) * G.L * 0.7, phase: hash(i * 7, 3) * 6, look: Math.floor(hash(i * 3 + 1, (rec.s || 1) * 0.1) * 997), d: 0, leg: 0, wait: 0, x: 0, y: 0, z: 0, pose: 'talk', yaw: 0, path: null, stroke: 0 });
		return S;
	}
	// site coordinates (u along the front, v out from it) to the site's own frame (its origin)
	const L3 = [0, 0, 0];
	function sp(S, u, v, out = L3) { const [x, y, z] = S.G.at(u, v); out[0] = x - S.origin[0]; out[1] = y - S.origin[1]; out[2] = z - S.origin[2]; return out; }
	function rp(S, s, lat, out = L3) { const q = roadAt(S.K, s, lat, R4); out[0] = q[0] - S.origin[0]; out[2] = q[1] - S.origin[2]; out[1] = ctx.ground(q[0], q[1]) - S.origin[1]; return out; }
	const R4 = [0, 0, 0, 0];

	// ---------- the kit for a stage: fence, signs, cones, the office, what the stage brings ----------
	function buildKit(S, stage, far) {
		const { P, G, K: kerb } = S, K = parts({ far }), V = K.at(0, 0, 0), CL = cloth(), co = { ...COMPANIES[S.co], i: S.co };
		const along = G.yawF + Math.PI / 2, n = [G.n[0], G.n[1]], anchors = [];
		if (!S.gl) {
			// the fence: the front with its gate, the returns down the sides; banners and signs on it
			const run = (u0, v0, u1, v1, nn, front) => {
				const len = Math.hypot(u1 - u0, v1 - v0), m = Math.max(1, Math.round(len / 3.5));
				for (let k = 0; k < m; k++) {
					const a = k / m, b = (k + 1) / m, ua = u0 + (u1 - u0) * a, va = v0 + (v1 - v0) * a, ub = u0 + (u1 - u0) * b, vb = v0 + (v1 - v0) * b;
					if (front && Math.abs((ua + ub) / 2 - P.gateU) < 1.9) continue;
					const A = [...sp(S, ua, va)], B = [...sp(S, ub, vb)];
					const ban = front ? (k % 3 === 1 ? rect('banner' + S.co) : null) : null;
					herasPanel(V, CL, A, B, nn, ban, true, !far && k % 3 === 0);
					if (ban) { const [x, y, z] = G.at((ua + ub) / 2, va + 0.05); anchors.push({ kind: 'banner', company: COMPANIES[S.co].name, x, y: y + 1.17, z, nx: nn[0], nz: nn[1], w: Math.hypot(B[0] - A[0], B[2] - A[2]) - 0.25, h: 0.62 }); }
				}
			};
			const vEndL = P.vBack[0] < 0 ? P.vBack[0] : (P.faces[0] ? 1.65 : 0.1), vEndR = P.vBack[1] < 0 ? P.vBack[1] : (P.faces[0] ? 1.65 : 0.1);
			run(P.uL, P.fenceV, P.uR, P.fenceV, n, true);
			const tl = [-G.t[0], -G.t[1]], tr = [G.t[0], G.t[1]];
			if (P.fenceV - vEndL > 0.6) run(P.uL, vEndL, P.uL, P.fenceV, tl, false);
			if (P.fenceV - vEndR > 0.6) run(P.uR, P.fenceV, P.uR, vEndR, tr, false);
			gate(V, CL, [...sp(S, P.gateU - 1.8, P.fenceV)], [...sp(S, P.gateU + 1.8, P.fenceV)], [-n[0], -n[1]]);
			// (the signs on the panels either side of the gate)
			if (!far) {
				V.m('banner');
				const sign = (u, r, w, h) => { const [x, y, z] = sp(S, u, P.fenceV + 0.05); V.decal(x, y + 1.45, z, w, h, rect(r), C.white, G.yawF); };
				sign(P.gateU - 3.0, 'hardhat', 0.5, 0.44); sign(P.gateU + 3.0, 'danger', 0.5, 0.44); sign(P.gateU - 4.6, 'ppe', 0.6, 0.35);
			}
			// barriers either side of the gate on the pavement, if there is pavement
			if (P.kerbV - P.fenceV > 1.3) for (const s of [-1, 1]) { const [x, y, z] = sp(S, P.gateU + s * 2.9, P.fenceV + 0.55); barrier(V, x, y, z, along, s > 0, s > 0 && !far); }
			// the office, the toilet, the light towers
			const F = P.fixed;
			// (its door to the site: toward the building in the front strip, away from it in a side yard)
			// (its body to one side of its place, the steps in the rest of it)
			if (F.cabin) { const c = F.cabin, tu = c.turned ? (c.u < 0 ? 0.43 : -0.43) : 0, tv = c.turned ? 0 : 0.43, [x, y, z] = sp(S, c.u + tu, c.v + tv); cabin(V, x, y, z, c.turned ? G.yawF : along, c.turned ? (c.u < 0 ? -1 : 1) : 1); }
			else {
				// (no room inside: in the street at the kerb, past the crane's place)
				const s = S.slots.crane + (S.tower ? 0 : 11), [x, y, z] = rp(S, s, kerb.hw + 1.6);
				const yaw = Math.atan2(R4[2], R4[3]);
				cabin(V, x, y, z, yaw, 1);
			}
			if (F.loo) { const [x, y, z] = sp(S, F.loo.u, F.loo.v); toilet(V, x, y, z, G.yawF + Math.PI); }
			S.heads.length = 0; S.aims.length = 0;
			for (const L of F.lights) {
				const [x, y, z] = sp(S, L.u, L.v), [bx, by, bz] = sp(S, Math.max(-G.L / 2.5, Math.min(G.L / 2.5, L.v > 0 ? L.u * 0.4 : -L.u * 0.15)), -0.4), aim = Math.atan2(bx - x, bz - z);
				const heads = lightTower(V, x, y, z, L.turned ? along : G.yawF, aim);
				for (const h of heads) S.heads.push([h[0] + S.origin[0], h[1] + S.origin[1], h[2] + S.origin[2]]);
				S.aims.push([bx + S.origin[0], by + S.origin[1] + Math.max(5, (S.o.h - 1.2) * 0.45), bz + S.origin[2]]);
			}
			// what the stage brings
			for (const it of P.stages[stage]) {
				const [x, y, z] = sp(S, it.u, it.v), ry = it.turned ? G.yawF : along;
				if (it.what === 'box') debrisBox(V, x, y, z, ry + (it.turned ? 0 : 0) + Math.PI / 2 * (it.turned ? 0 : 1), stage === 0, co);
				else if (it.what === 'barrow') wheelbarrow(V, x, y, z, ry + 0.4);
				else if (it.what === 'generator') generator(V, x, y, z, ry);
				else if (it.what === 'sand') sandHeap(V, x, y, z, ry);
				else stock(V, x, y, z, it.turned ? ry : ry + Math.PI / 2, it.what);
			}
			// (no room for the debris box inside while clearing: in the street behind the trucks)
			if (stage === 0 && !P.stages[0].some((q) => q.what === 'box')) { const [x, y, z] = rp(S, S.slots.box, kerb.hw - 1.4); debrisBox(V, x, y, z, Math.atan2(R4[2], R4[3]), true, co); }
		}
		// cones: a taper in from the lane ahead of the trucks, then along their road side
		{
			const kl = kerb.hw - 1.45, first = S.gl ? S.slots.a - 4 : Math.min(S.slots.b, S.slots.a) - 7;
			for (let k = 0; k < 5; k++) { const [x, y, z] = rp(S, first - 12 + k * 3, kerb.hw - 0.3 - k * 0.55); cone(V, x, y, z); }
			const last = S.gl ? S.slots.a + 4 : S.mobile ? S.slots.crane + 7 : S.slots.a + 7;
			for (let s = first - 0.5; s < last; s += 4.5) { const [x, y, z] = rp(S, s, kl - 1.75); cone(V, x, y, z); }
			if (S.gl) for (let k = -1; k <= 1; k += 2) { const [x, y, z] = sp(S, k * 2.5, 1.6); cone(V, x, y, z); }
		}
		// the mobile crane's cribbing under its pads: timber, as thick as the ground falls away
		if (S.mobile) for (const p of S.mobile.pads) {
			const [x, y0, z] = [p[0] - S.origin[0], p[1] - S.origin[1], p[2] - S.origin[2]], top = S.mobile.padY - S.origin[1];
			V.m('wood', 0.7);
			const layers = Math.max(1, Math.min(4, Math.round((top - y0) / 0.1)));
			for (let k = 0; k < layers; k++) { const t = (top - y0) / layers, ry = S.mobile.yaw + (k % 2 ? 0 : Math.PI / 2), c = Math.cos(ry), s = Math.sin(ry); for (let j = -2; j <= 2; j++) V.box(x + c * j * 0.26, y0 + k * t, z - s * j * 0.26, 0.24, t - 0.005, 1.3, (j + k) % 2 ? C.wood : [0.55, 0.42, 0.28], ry); }
		}
		// the scaffold's netting (held to the scaffold's height) goes in the same cloth
		if (S.net) for (const q of S.net) CL.sheet(...q);
		const geo = K.merge(), cg = CL.geo();
		if (!far) S.anchors = anchors;
		return { geo, cg };
	}
	function setKit(S, stage, fadeIn) {
		const near = buildKit(S, stage, lite()), far = lite() ? near : buildKit(S, stage, true);
		const mesh = kitMesh(near.geo);
		mesh.userData.near = near.geo; mesh.userData.far = far.geo;
		const cl = near.cg ? new THREE.Mesh(near.cg, clothMaterial()) : null;
		if (cl) { cl.renderOrder = 1; cl.userData.near = near.cg; cl.userData.far = far.cg; }
		if (far !== near && far.cg && !cl) far.cg.dispose();
		S.root.add(mesh); if (cl) S.root.add(cl);
		// (the old kit fades out as the new fades in, pixel for pixel)
		if (S.kit) { dropKit(S.old); S.old = { ...S.kit, t: 0 }; }
		S.kit = { mesh, cl, t: fadeIn ? 0 : FADE };
	}
	function dropKit(k) {
		if (!k) return;
		for (const m of [k.mesh, k.cl]) {
			if (!m) continue;
			m.parent?.remove(m);
			const a = m.userData.near, b = m.userData.far;
			a?.dispose(); if (b && b !== a) b.dispose();
			m.material.userData.depth?.dispose(); m.material.dispose();
		}
	}

	// ---------- the scaffold: built to its full height once, shown up to how far it has risen ----------
	function buildScaffold(S) {
		const { o, P, rec } = S;
		S.net = [];
		if (S.gl) return;
		const H = o.h - 1.2, top = H + 1.2, f0 = S.G.f, back = f0 ^ 1;
		// the lot's faces that have scaffolding (the plan's roles: front, back, right, left)
		const has = [false, false, false, false];
		has[f0] = P.faces[0]; has[back] = P.faces[1]; has[PLUS_END[f0]] = P.faces[2]; has[MINUS_END[f0]] = P.faces[3];
		const lw = lite();
		const make = (far, nets) => {
			const K = parts({ far }), V = K.at(0, 0, 0), F = frameOf(o), lifts = [];
			for (let y = 2; y <= H + 0.2; y += 2) lifts.push(y);
			for (let f = 0; f < 4; f++) {
				if (!has[f]) continue;
				const Lf = faceLen(o, f), [nx, nz] = FACES[f], ends = f === f0 || f === back;
				// (front and back run out over the corners where the sides have scaffolding; the sides stop at their inner line)
				const eM = ends ? (has[MINUS_END[f]] ? 1.45 : (P.sideX[f === f0 ? 0 : 1] < 0.6 ? -0.1 : 0.3)) : 0.35;
				const eP = ends ? (has[PLUS_END[f]] ? 1.45 : (P.sideX[f === f0 ? 1 : 0] < 0.6 ? -0.1 : 0.3)) : 0.35;
				const uA = -Lf / 2 - eM, uB = Lf / 2 + eP, bays = Math.max(1, Math.round((uB - uA) / 2.1)), bw = (uB - uA) / bays;
				const W = (u, off, y) => { const [lx, lz] = onFace(o, f, u), [x, z] = F.w(lx + nx * off, lz + nz * off); return [x - S.origin[0], o.y + 1.2 + y - S.origin[1], z - S.origin[2]]; };
				const I = 0.35, O = 1.45;
				// standards on their base plates and sole boards
				for (let b = 0; b <= bays; b++) {
					const u = uA + b * bw;
					V.m('galv', 0.55);
					for (const off of [I, O]) V.tube(W(u, off, 0.02), W(u, off, top + 1.0), 0.024, C.galv, 5);
					if (!far) { V.m('steel', 0.6); for (const off of [I, O]) V.mid(...W(u, off, 0.01), 0.15, 0.012, 0.15, C.dark); V.m('wood', 0.7); V.bar(W(u, I - 0.25, -0.0), W(u, O + 0.25, -0.0), 0.11, [0.55, 0.43, 0.3], 0.025); }
				}
				lifts.forEach((y, li) => {
					V.m('galv', 0.55);
					for (const off of [I, O]) V.tube(W(uA, off, y), W(uB, off, y), 0.022, C.galv, 5);
					if (!far) for (let b = 0; b <= bays; b++) V.tube(W(uA + b * bw, I - 0.15, y + 0.05), W(uA + b * bw, O + 0.1, y + 0.05), 0.02, C.galv, 4);
					// the boards (five abreast), the toe board, the guard rails
					V.m('wood', 0.65);
					if (far) V.bar(W(uA, (I + O) / 2, y + 0.08), W(uB, (I + O) / 2, y + 0.08), 0.02, C.ply, 0.54);
					else for (let k = 0; k < 5; k++) V.bar(W(uA + 0.05, I + 0.11 + k * 0.22, y + 0.09), W(uB - 0.05, I + 0.11 + k * 0.22, y + 0.09), 0.019, (k + li) % 3 ? C.wood : [0.6, 0.47, 0.31], 0.106);
					if (!far) {
						V.bar(W(uA, O - 0.02, y + 0.18), W(uB, O - 0.02, y + 0.18), 0.075, [0.62, 0.5, 0.33], 0.016);
						V.m('galv', 0.55);
						for (const h of [0.5, 1.0]) V.tube(W(uA, O + 0.05, y + h), W(uB, O + 0.05, y + h), 0.02, C.galv, 4);
						// (a rail across each open end)
						if (!(ends && has[MINUS_END[f]])) for (const h of [0.5, 1.0]) V.tube(W(uA - 0.05, I, y + h), W(uA - 0.05, O, y + h), 0.02, C.galv, 4);
						if (!(ends && has[PLUS_END[f]])) for (const h of [0.5, 1.0]) V.tube(W(uB + 0.05, I, y + h), W(uB + 0.05, O, y + h), 0.02, C.galv, 4);
						// ties into the facade every other lift, every third bay
						if (li % 2 === 0) for (let b = 1; b < bays; b += 3) { V.tube(W(uA + b * bw + 0.1, -0.02, y + 0.35), W(uA + b * bw + 0.1, I + 0.08, y + 0.35), 0.021, C.galv, 4); V.m('steel'); V.mid(...W(uA + b * bw + 0.1, 0.01, y + 0.35), 0.14, 0.14, 0.02, C.dark, Math.atan2(nx, nz)); V.m('galv', 0.55); }
						// face braces: a zigzag up the outside every fourth bay
						for (let b = li % 2; b + 1 <= bays; b += 4) V.tube(W(uA + b * bw, O + 0.07, y - 2 + 0.1), W(uA + (b + 1) * bw, O + 0.07, y - 0.1), 0.019, C.galv, 4);
					}
				});
				// ladders up the end bay of the front, from each lift to the next, turn about
				if (f === f0 && !far) {
					V.m('paint', 0.5);
					for (let y = 0, k = 0; y < lifts[lifts.length - 1]; y += 2, k++) {
						const u = uB - bw * (k % 2 ? 0.3 : 0.7), off = 0.9;
						for (const s of [-0.21, 0.21]) V.tube(W(u + s, off - 0.25, y + 0.1), W(u + s, off + 0.12, y + 3.0), 0.022, C.yellow, 4);
						for (let r = 0.35; r < 2.9; r += 0.3) { const t = r / 2.9; V.tube(W(u - 0.21, off - 0.25 + 0.37 * t, y + 0.1 + r), W(u + 0.21, off - 0.25 + 0.37 * t, y + 0.1 + r), 0.015, C.yellow, 4); }
					}
				}
				// the netting on the outside, a sheet a lift high, its middles sagging between the ties
				if (nets) for (let li = 0; li <= lifts.length; li++) {
					const y0 = li ? lifts[li - 1] + 0.12 : 0.15, y1 = li < lifts.length ? lifts[li] + 0.12 : top + 1.0;
					if (y1 - y0 < 0.4) continue;
					const a = W(uA, O + 0.12, y0), e1 = W(uB, O + 0.12, y0), e2 = W(uA, O + 0.12, y1);
					const [wnx, wnz] = F.dir(nx, nz);
					S.net.push([a, [e1[0] - a[0], e1[1] - a[1], e1[2] - a[2]], [e2[0] - a[0], e2[1] - a[1], e2[2] - a[2]], [wnx, 0, wnz], bays * 2, 1, [0, 0], (uB - uA) / 0.9, (y1 - y0) / 0.9, 0.06, 1]);
				}
			}
			return K.merge();
		};
		const near = make(lw, true), far = lw ? near : make(true, false);
		const mesh = kitMesh(near);
		mesh.userData.near = near; mesh.userData.far = far;
		mesh.material.userData.u.uClipY.value = -1e9;
		mesh.material.userData.u.uBeacon.value = 0;
		S.root.add(mesh);
		S.scaf = mesh;
		void rec;
	}

	// ---------- the cranes ----------
	function buildTower(S) {
		const { P, G, o } = S, H = o.h - 1.2;
		const [x, y, z] = G.at(P.crane.u, P.crane.v), h = H + 12;
		// ties back to the nearest face every 18 m when it stands beside the building, tall
		const ties = [];
		if (!P.crane.inside && h > 28) {
			const F = frameOf(o);
			let best = null;
			for (let f = 0; f < 4; f++) { const [lx, lz] = onFace(o, f, 0), [cx, cz] = F.l(x, z), [nx, nz] = FACES[f], d = (cx - lx) * nx + (cz - lz) * nz; if (d > 0 && (!best || d < best.d)) best = { f, d }; }
			if (best) for (let ty = 16; ty < Math.min(h - 8, H - 2); ty += 18) {
				const [cx, cz] = F.l(x, z), [nx, nz] = FACES[best.f], u = nz * cx - nx * cz, Lf = faceLen(o, best.f);
				const anchor = (du) => { const uu = Math.max(-Lf / 2 + 0.5, Math.min(Lf / 2 - 0.5, u + du)), [lx, lz] = onFace(o, best.f, uu), [wx, wz] = F.w(lx + nx * 0.05, lz + nz * 0.05); return [wx - x, wz - z]; };
				ties.push([ty, anchor(-1.6), anchor(1.6)]);
			}
		}
		const lw = lite();
		const mastG = towerMastGeo(h, ties, lw), mastF = lw ? mastG : towerMastGeo(h, ties, true);
		const mast = kitMesh(mastG);
		mast.userData.near = mastG; mast.userData.far = mastF;
		mast.position.set(x - S.origin[0], y - S.origin[1], z - S.origin[2]);
		// the reach: over the farthest corner of the building and the gate
		let R = 24;
		for (const [u, v] of [[-G.L / 2, -G.D], [G.L / 2, -G.D], [-G.L / 2, 0], [G.L / 2, 0], [P.gateU, P.fenceV]]) { const [cx, cz] = G.w(u, v); R = Math.max(R, Math.hypot(cx - x, cz - z) + 3); }
		R = Math.min(60, R);
		const J = towerJibGeo(R, S.co, lw), JF = lw ? J : towerJibGeo(R, S.co, true);
		const jib = kitMesh(J.geo);
		jib.userData.near = J.geo; jib.userData.far = JF.geo;
		jib.position.y = h; mast.add(jib);
		const trolley = kitMesh(trolleyGeo(false)); trolley.position.set(0, J.bot - 0.05, R * 0.5); jib.add(trolley);
		const hook = kitMesh(hookGeo('', S.co, true)); hook.position.set(0, -10, 0); trolley.add(hook);
		for (const m of [mast, jib, trolley, hook]) m.material.userData.u.uBeacon.value = 0;
		S.root.add(mast);
		// the lift: from the site near the gate up onto the work
		const [px, , pz] = G.at(P.gateU + 1.5, (P.scafV + P.fenceV) / 2 + 0.3), [dx, , dz] = G.at(0, -Math.min(G.D * 0.5, 6));
		S.crane = { mast, jib, trolley, hook, J, h, R, x, y, z, lift: { a0: Math.atan2(px - x, pz - z), a1: Math.atan2(dx - x, dz - z), r0: Math.min(R - 1, Math.max(4, Math.hypot(px - x, pz - z))), r1: Math.min(R - 1, Math.max(4, Math.hypot(dx - x, dz - z))), y0: 0, y1: 0, top: 0, slew: 0.09, hoist: 0.9, trolley: 0.8 }, pickY: ctx.ground(px, pz), what: '', state: { a: 0, r: 0, y: 0, loaded: false, phase: 0, moving: false } };
	}
	function buildMobile(S) {
		const { G, K, o } = S, H = o.h - 1.2, T = TRUCKS.carrier;
		const s = S.slots.crane, q = roadAt(K, s, K.hw - 1.6, [0, 0, 0, 0]), yaw = Math.atan2(q[2], q[3]);
		const c = Math.cos(yaw), sn = Math.sin(yaw);
		const W = (lx, lz) => [q[0] + c * lx + sn * lz, q[1] - sn * lx + c * lz];
		// level on its outriggers, a hand over the highest pad's ground
		const pads = [];
		for (const lz of [5.35, -5.55]) for (const lx of [-3, 3]) { const [px, pz] = W(lx, lz); pads.push([px, ctx.ground(px, pz), pz]); }
		const padY = Math.max(...pads.map((p) => p[1])) + 0.1;
		const carrier = kitMesh(truckGeo('carrier', S.co, '', lite()));
		carrier.userData.near = truckGeo('carrier', S.co, '', lite()); carrier.userData.far = truckGeo('carrier', S.co, '', true); carrier.userData.shared = true;
		carrier.position.set(q[0] - S.origin[0], padY + 0.06 - S.origin[1], q[1] - S.origin[2]);
		carrier.rotation.y = yaw;
		S.root.add(carrier);
		// the boom to reach over the front of the building, its head well above the top
		const [sx, sz] = W(0, T.slew[2]), slewY = padY + 0.06 + T.slew[1];
		const uC = G.uv(sx, sz)[0], [dx, dz] = G.w(Math.max(-G.L / 2 + 3, Math.min(G.L / 2 - 3, uC * 0.3)), -Math.min(8, G.D * 0.5));
		const R0 = Math.hypot(dx - sx, dz - sz), hy = o.y + 1.2 + H + 6.5 - slewY - BOOM_FOOT[1];
		const hz = R0 - BOOM_FOOT[2] - 0.35;
		const a = Math.max(0.55, Math.min(1.25, Math.atan2(hy, hz))), len = Math.max(14, Math.min(46, Math.hypot(hy, hz)));
		const lw = lite(), U = craneUpperGeo(S.co, a, len, lw), UF = lw ? U : craneUpperGeo(S.co, a, len, true);
		const upper = kitMesh(U.geo);
		upper.userData.near = U.geo; upper.userData.far = UF.geo;
		upper.position.set(sx - S.origin[0], slewY - S.origin[1], sz - S.origin[2]);
		S.root.add(upper);
		const hook = kitMesh(hookGeo('', S.co, false)); S.root.add(hook);
		const rHead = Math.hypot(U.head[0], U.head[2]), headY = slewY + U.head[1];
		// where the hook can pick from: the site's ground near the gate on its circle, else the trucks
		let best = null;
		for (let k = 0; k < 180; k++) {
			const ang = k / 180 * Math.PI * 2, px = sx + Math.sin(ang) * rHead, pz = sz + Math.cos(ang) * rHead, [u, v] = G.uv(px, pz);
			let sc = -Math.abs(u - S.P.gateU) * 0.2;
			if (v > S.P.scafV + 0.3 && v < S.P.fenceV - 0.3 && u > S.P.uL && u < S.P.uR) sc += 6;
			else if (v < 0 && Math.abs(u) < G.L / 2 - 1) sc += 1;
			else sc -= 4;
			if (!best || sc > best.sc) best = { sc, ang, px, pz };
		}
		const da = Math.atan2(dx - sx, dz - sz);
		S.mobile = { carrier, upper, hook, yaw, pads, padY, slew: [sx, slewY, sz], head: U.head, rHead, headY, lift: { a0: best.ang, a1: da, r0: rHead, r1: rHead, y0: 0, y1: 0, top: 0, slew: 0.1, hoist: 0.8 }, pickY: ctx.ground(best.px, best.pz), what: '', state: { a: 0, r: 0, y: 0, loaded: false, phase: 0, moving: false } };
		upper.rotation.y = da;
		void hash;
	}
	// what the hook carries at the stage; the heights it works between
	function liftFor(S, Cr, stage, heights) {
		const what = S.gl ? '' : LOAD[stage];
		if (Cr.what !== what) {
			Cr.what = what;
			Cr.hook.geometry = hookGeo(what, S.co, !!Cr.trolley);
			Cr.hookEmpty = hookGeo('', S.co, !!Cr.trolley);
			Cr.hookFull = Cr.hook.geometry;
			// (the next load waiting for the hook, or the last one where it was set down)
			if (!Cr.load) { Cr.load = kitMesh(hookGeo(what, S.co, !!Cr.trolley, false, 'load')); Cr.load.material.userData.u.uBeacon.value = 0; S.root.add(Cr.load); }
			else Cr.load.geometry = hookGeo(what, S.co, !!Cr.trolley, false, 'load');
		}
		const drop = HOOK_DROP[what] ?? 1.1;
		const workTop = S.o.y + 1.2 + Math.max(heights.frame, heights.clad, 0.5) + 0.15;
		Cr.lift.y0 = Cr.pickY + drop + 0.05;
		Cr.lift.y1 = workTop + drop;
		const ceil = Cr.trolley ? S.crane.mast.position.y + S.origin[1] + S.crane.h + S.crane.J.bot - 1.5 : Cr.headY - 2.4;
		Cr.lift.top = Math.min(ceil, Math.max(Cr.lift.y0, Cr.lift.y1) + 4);
		Cr.lift.y1 = Math.min(Cr.lift.y1, ceil);
	}

	// ---------- the trucks ----------
	function truck(S, kind, load, slot, mode) {
		const lw = lite(), near = truckGeo(kind, S.co, load, lw), far = truckGeo(kind, S.co, load, true);
		const mesh = kitMesh(near);
		mesh.userData.near = near; mesh.userData.far = far; mesh.userData.shared = true;
		mesh.rotation.order = 'YXZ';
		S.root.add(mesh);
		const T = TRUCKS[kind], s = slot === 'a' ? S.slots.a : S.slots.b;
		const v = { kind, load, slot, s, mesh, T, state: 'park', path: null, d: 0, spin: 0, drum: 0, fade: 1, beeper: null, x: 0, z: 0, hx: 0, hz: 1, rev: false };
		const q = roadAt(S.K, s, S.K.hw - 1.45, [0, 0, 0, 0]);
		v.px = q[0]; v.pz = q[1]; v.phx = q[2]; v.phz = q[3];
		if (mode) { v.state = 'in'; v.path = drivePath(S.K, s, mode === 'back' ? 'back' : 'in', T.L); v.d = 0; v.fade = 0; }
		place(S, v, v.px, v.pz, v.phx, v.phz);
		return v;
	}
	// a truck on the ground: its height and its pitch and roll from the ground under its wheels
	function place(S, v, x, z, hx, hz) {
		const T = v.T, yaw = Math.atan2(hx, hz), c = Math.cos(yaw), s = Math.sin(yaw), tw = T.W * 0.4;
		const g = (lx, lz) => ctx.ground(x + c * lx + s * lz, z - s * lx + c * lz);
		const zf = T.axles[0], zr = T.axles[T.axles.length - 1], fl = g(tw, zf), fr = g(-tw, zf), rl = g(tw, zr), rr = g(-tw, zr);
		const y = (fl + fr + rl + rr) / 4;
		v.mesh.position.set(x - S.origin[0], y - S.origin[1], z - S.origin[2]);
		v.mesh.rotation.set(Math.atan2((rl + rr) / 2 - (fl + fr) / 2, zf - zr), yaw, Math.atan2((fl + rl) / 2 - (fr + rr) / 2, tw * 2));
		v.x = x; v.z = z; v.hx = hx; v.hz = hz;
	}
	function setTrucks(S, stage, seen) {
		const want = stageTrucks(stage, S.gl, S.big || S.tower);
		const slots = ['a', 'b'];
		// those whose place now wants something else drive off
		for (const v of S.vehicles) {
			if (v.state === 'out') continue;
			const w = want[slots.indexOf(v.slot)];
			// (round the crane in the far lane if it stands in the near one ahead)
			if (!w || w[0] !== v.kind || w[1] !== v.load) { v.state = 'out'; v.path = drivePath(S.K, v.s, 'out', v.T.L, S.mobile ? -Math.min(1.9, S.K.hw * 0.4) : null); v.d = 0; }
		}
		want.forEach(([kind, load], i) => {
			const slot = slots[i];
			for (const q of S.vehicles) if (q.slot === slot && q.state !== 'out') return;
			// (past and backing in where the road ahead of the place is clear, else straight in)
			const v = truck(S, kind, load, slot, seen ? (TRUCKS[kind].backs && slot === 'a' && !S.mobile ? 'back' : 'in') : null);
			// (wait for whoever is leaving that place to be clear of it)
			v.wait = seen && S.vehicles.some((q) => q.slot === slot && q.state === 'out') ? 6 : 0;
			if (v.wait) v.mesh.visible = false;
			S.vehicles.push(v);
		});
	}
	function dropTruck(S, v) {
		S.root.remove(v.mesh);
		v.mesh.material.userData.depth?.dispose(); v.mesh.material.dispose();
		v.beeper?.stop(); v.beeper = null;
	}

	// ---------- the stage ----------
	function setStage(S, stage, seen) {
		const first = S.stage < 0;
		S.stage = stage;
		setKit(S, stage, seen && !first ? true : seen);
		setTrucks(S, stage, seen);
		if (seen && first) S.fade = 0;
	}
	function drop(S) {
		dropKit(S.kit); dropKit(S.old); S.kit = S.old = null;
		for (const v of S.vehicles) dropTruck(S, v);
		S.vehicles.length = 0;
		// (every geometry of its own let go; the shared trucks, hooks and loads kept)
		S.root.traverse((m) => { if (m.isMesh) { for (const g of new Set([m.geometry, m.userData.near, m.userData.far])) if (g && !g.userData?.shared) g.dispose(); m.material.userData?.depth?.dispose(); m.material.dispose(); } });
		group.remove(S.root);
		for (const k in S.loops) S.loops[k]?.stop();
		sites.delete(S.id);
		const i = list.indexOf(S); if (i >= 0) list.splice(i, 1);
	}

	// ---------- each frame ----------
	const camP = new THREE.Vector3(), tmpV = new THREE.Vector3(), PA = [0, 0, 0, 1, 0];
	let liveTag = 0;
	let lotCheck = false;
	function visit(id, rec) {
		if (rec.r0 == null || Math.hypot(rec.x - camP.x, rec.z - camP.z) > SITE_R) return;
		let S = sites.get(id);
		// (the lot looked up again twice a second: the city's lots are made afresh as you go)
		if (S && !lotCheck && !S.leaving) { S.rec = rec; S.tag = liveTag; return; }
		const o = lotFor(id, rec);
		if (!o) return;
		if (!S || S.o !== o) {
			if (S) drop(S);
			S = site(id, rec, o); sites.set(id, S); list.push(S);
			sounds.beep({ x: rec.x, y: o.y + 2, z: rec.z });
		}
		S.rec = rec; S.tag = liveTag; S.leaving = false;
	}
	function update(cam, dt, night = 0) {
		nightK = night;
		kitShared.uNight.value = night;
		kitShared.uTime.value += dt;
		// (twice a second by the clock on the wall, however slowly the frames come)
		lotCheck = false;
		if (performance.now() - tickAt > 500 || store.now() - (lastNow ?? 0) > 0.05) { tickAt = performance.now(); const now = store.now(); schedule(Math.max(0, now - (lastNow ?? now))); lastNow = now; lotCheck = true; }
		camP.copy(cam.position);
		liveTag++;
		crew.begin(); glow.begin();
		if (!cataclysm) store.each(visit);
		let lampSite = null, lampD = 140;
		for (let i = list.length - 1; i >= 0; i--) {
			const S = list[i];
			const d = Math.hypot(S.origin[0] - camP.x, S.origin[2] - camP.z);
			if (S.tag !== liveTag) {
				// (the work done, or the site out of reach: in view, the crew pack up and the trucks drive
				// off, the rest fades; out of view it simply goes)
				if (d > 260 || cataclysm || !leave(S, dt)) { drop(S); continue; }
				continue;
			}
			tick(S, dt, d);
			if (S.heads.length && d < lampD && night > 0.05) { lampD = d; lampSite = S; }
		}
		crew.end(); glow.end();
		// the work lights: the nearest lit site's light towers, real light on the work by night
		const on = lampSite && tierNow() < 2;
		for (let i = 0; i < lamps.length; i++) {
			const L = lamps[i], h = on ? lampSite.heads[i * 4 + 1] : null, a = on ? lampSite.aims[i] : null;
			if (!h || !a) { L.intensity = 0; continue; }
			L.position.set(h[0], h[1], h[2]); L.target.position.set(a[0], a[1], a[2]);
			L.intensity = night * 260;
		}
	}
	// a finished site in view: the trucks away down the road, everything else faded out; false when gone
	function leave(S, dt) {
		if (!S.leaving) {
			S.leaving = true;
			for (const v of S.vehicles) if (v.state !== 'out') { v.state = 'out'; v.wait = 0; v.mesh.visible = true; v.path = drivePath(S.K, v.s, 'out', v.T.L, S.mobile ? -Math.min(1.9, S.K.hw * 0.4) : null); v.d = 0; }
			for (const k in S.loops) { S.loops[k]?.stop(); S.loops[k] = null; }
		}
		S.fade = Math.max(0, S.fade - dt / 3);
		const f = S.fade;
		if (S.kit) setFade(S.kit, f);
		if (S.scaf) S.scaf.material.userData.u.uFade.value = f;
		for (const Cr of [S.crane, S.mobile]) if (Cr) { for (const m of [Cr.mast, Cr.jib, Cr.trolley, Cr.hook, Cr.load, Cr.carrier, Cr.upper]) if (m) m.material.userData.u.uFade.value = f; }
		for (let i = S.vehicles.length - 1; i >= 0; i--) {
			const v = S.vehicles[i], sp2 = speedAt(v.path, v.d);
			v.d = Math.min(v.path.length, v.d + sp2 * dt);
			pathAt(v.path, v.d, PA); place(S, v, PA[0], PA[1], PA[2], PA[3]);
			v.spin += sp2 * dt / v.T.r;
			const u = v.mesh.material.userData.u;
			u.uSpin.value = v.spin; u.uLamps.value = 1; u.uFade.value = Math.min(1, (v.path.length - v.d) / 14);
			if (v.d >= v.path.length - 0.01) { dropTruck(S, v); S.vehicles.splice(i, 1); }
		}
		return f > 0 || S.vehicles.length > 0;
	}
	const lodOf = (m, d, at) => { const g = d > at ? m.userData.far : m.userData.near; if (g && m.geometry !== g) m.geometry = g; };
	// (scratch for the frame: nothing is made while the world runs)
	const HTS = { scaf: 0, frame: 0, clad: 0, glaze: 0 }, AT = [0, 0, 0], UV = [0, 0], SND = { x: 0, y: 0, z: 0 }, MUTE = { x: 0, y: -1e4, z: 0 };
	const snd = (x, y, z) => { SND.x = x; SND.y = y; SND.z = z; return SND; };
	function tick(S, dt, dist) {
		const { rec, o } = S, p = progress(rec), stage = stageOf(p ?? 0), H = o.h - 1.2;
		S.t += dt;
		const seen = dist < 260;
		if (stage !== S.stage) setStage(S, stage, seen && S.seen);
		S.seen = true;
		// fading in a new site, and the kit's crossfade
		if (S.fade < 1) S.fade = Math.min(1, S.fade + dt / FADE);
		if (S.kit) { S.kit.t = Math.min(FADE, S.kit.t + dt); setFade(S.kit, Math.min(S.fade, S.kit.t / FADE)); }
		if (S.old) { S.old.t += dt; setFade(S.old, -Math.min(1, S.old.t / FADE)); if (S.old.t >= FADE) { dropKit(S.old); S.old = null; } }
		const sf = S.fade;
		// the scaffold up as far as the work, rising and struck a lift at a time
		const hts = workHeights(p, H, 3.2, HTS);
		const target = hts.scaf > 0 ? Math.ceil(hts.scaf / 2 - 0.01) * 2 + 1.05 : -1;
		S.clip += Math.max(-dt * 1.2, Math.min(dt * 1.2, target - S.clip));
		if (S.scaf) {
			const y = S.clip < 0 ? -1e9 : o.y + 1.2 + S.clip, u = S.scaf.material.userData.u;
			u.uClipY.value = y; u.uFade.value = sf;
			if (S.kit && S.kit.cl) S.kit.cl.material.userData.u.uClipY.value = y;
			if (S.old && S.old.cl) S.old.cl.material.userData.u.uClipY.value = y;
			lodOf(S.scaf, dist, LOD_KIT + 20);
			S.scaf.visible = S.clip > 0;
		}
		if (S.kit) { lodOf(S.kit.mesh, dist, LOD_KIT); if (S.kit.cl) lodOf(S.kit.cl, dist, LOD_KIT); }
		// the cranes at their lifts
		if (S.crane) craneAt(S, S.crane, stage, hts, dist, seen, sf);
		if (S.mobile) craneAt(S, S.mobile, stage, hts, dist, seen, sf);
		// the trucks: coming in, standing, going
		let beep = null, mixing = null;
		for (let i = S.vehicles.length - 1; i >= 0; i--) {
			const v = S.vehicles[i];
			if (v.wait > 0) { v.wait -= dt; if (v.wait <= 0) v.mesh.visible = true; else continue; }
			const u = v.mesh.material.userData.u;
			if (v.state === 'in' || v.state === 'out') {
				const sp2 = speedAt(v.path, v.d);
				v.d = Math.min(v.path.length, v.d + sp2 * dt);
				pathAt(v.path, v.d, PA);
				place(S, v, PA[0], PA[1], PA[2], PA[3]);
				v.spin += (PA[4] ? -1 : 1) * sp2 * dt / v.T.r;
				v.rev = !!PA[4];
				if (v.state === 'in') { v.fade = Math.min(1, v.d / 10); if (v.d >= v.path.length - 0.01) { v.state = 'park'; v.rev = false; place(S, v, v.px, v.pz, v.phx, v.phz); } }
				else { v.fade = Math.min(1, (v.path.length - v.d) / 14); if (v.d >= v.path.length - 0.01) { dropTruck(S, v); S.vehicles.splice(i, 1); continue; } }
				u.uLamps.value = 1;
			} else { v.rev = false; u.uLamps.value = 0; }
			u.uSpin.value = v.spin;
			if (v.kind === 'mixer') { v.drum += dt * 1.6; u.uDrum.value = v.drum; if (v.state === 'park') mixing = v; }
			u.uFade.value = Math.min(sf, v.fade);
			lodOf(v.mesh, dist, LOD_TRUCK);
			if (v.rev) beep = v;
			if (dist < CREW_R) { const B = v.T.beacons; for (let k = 0; k < B.length; k++) { tmpV.set(B[k][0], B[k][1], B[k][2]); v.mesh.localToWorld(tmpV); glow.add(tmpV.x, tmpV.y, tmpV.z, 1, 0.5 * v.fade); } }
		}
		if (mixing && seen && dist < 100) { const L = S.loops.drum || (S.loops.drum = sounds.loop?.('drum')); if (L) L.set(snd(mixing.x, S.origin[1] + 2, mixing.z), 1); }
		else if (S.loops.drum) S.loops.drum.set(MUTE, 0);
		if (beep && seen) { const L = S.loops.beeper || (S.loops.beeper = sounds.loop?.('beeper')); if (L) L.set(snd(beep.x, S.origin[1] + 1.5, beep.z), 1); }
		else if (S.loops.beeper) S.loops.beeper.set(MUTE, 0);
		// the light towers' glow by night
		if (nightK > 0.05) for (let k = 0; k < S.heads.length; k++) glow.add(S.heads[k][0], S.heads[k][1], S.heads[k][2], 2, 1);
		// the crew at it
		if (dist < CREW_R) crewAt(S, stage, hts, dt);
		// the sounds of the work (the odd grinder; the hammers are heard as they land)
		S.beat -= dt;
		if (S.beat <= 0 && p > 0.05 && p < 0.97) { S.beat = 0.6 + Math.random() * 1.6; if (Math.random() < 0.12) { const w = S.workers[Math.floor(Math.random() * S.workers.length)]; if (w) sounds.grind(snd(w.x, w.y + 1.5, w.z)); } }
	}
	function craneAt(S, Cr, stage, hts, dist, seen, sf) {
		liftFor(S, Cr, stage, hts);
		const st = liftAt(Cr.lift, S.t + ((S.rec.s || 0) % 60), Cr.state);
		if (Cr === S.crane) {
			const jib = Cr.jib;
			jib.rotation.y = st.a; Cr.trolley.position.z = st.r;
			// (the hook hangs below the trolley: the cable let out to where it is)
			const ty = Cr.mast.position.y + S.origin[1] + Cr.h + Cr.trolley.position.y, cableLen = Math.max(1.1, ty - st.y);
			Cr.hook.position.y = -cableLen;
			Cr.hook.material.userData.u.uStretch.value = cableLen - 1;
			lodOf(Cr.mast, dist, LOD_CRANE); lodOf(jib, dist, LOD_CRANE);
			// red lights on it by night
			jib.updateMatrixWorld();
			const Lt = Cr.J.lights;
			for (let k = 0; k < Lt.length; k++) { tmpV.set(Lt[k][0], Lt[k][1], Lt[k][2]); jib.localToWorld(tmpV); glow.add(tmpV.x, tmpV.y, tmpV.z, 3, 1.4); }
		} else {
			Cr.upper.rotation.y = st.a;
			const hx = Cr.slew[0] + Math.sin(st.a) * st.r, hz = Cr.slew[2] + Math.cos(st.a) * st.r, cableLen = Math.max(1.1, Cr.headY - st.y);
			Cr.hook.position.set(hx - S.origin[0], Cr.headY - cableLen - S.origin[1], hz - S.origin[2]);
			Cr.hook.material.userData.u.uStretch.value = cableLen - 1;
			lodOf(Cr.upper, dist, LOD_CRANE);
			lodOf(Cr.carrier, dist, LOD_TRUCK);
			const B = TRUCKS.carrier.beacons;
			for (let k = 0; k < B.length; k++) { tmpV.set(B[k][0], B[k][1], B[k][2]); Cr.carrier.localToWorld(tmpV); glow.add(tmpV.x, tmpV.y, tmpV.z, 1, 0.5); }
		}
		const g = st.phase >= 5 || st.phase === 0 ? Cr.hookEmpty : Cr.hookFull;
		if (g && Cr.hook.geometry !== g) Cr.hook.geometry = g;
		Cr.hook.material.userData.u.uFade.value = sf;
		// the load on the ground by the hook at the pick (it is the same place as the hook's own as
		// it is picked up, so nothing jumps); set down on the work after the drop, then taken off
		if (Cr.load) {
			const cx = Cr === S.crane ? Cr.x : Cr.slew[0], cz = Cr === S.crane ? Cr.z : Cr.slew[2], L = Cr.lift, ph = st.phase;
			const atDrop = ph === 5 || ph === 6, a = atDrop ? L.a1 : L.a0, r = atDrop ? L.r1 : L.r0;
			Cr.load.visible = ph === 0 || ph >= 5;
			Cr.load.position.set(cx + Math.sin(a) * r - S.origin[0], (atDrop ? L.y1 : L.y0) - S.origin[1], cz + Math.cos(a) * r - S.origin[2]);
			Cr.load.material.userData.u.uFade.value = Math.min(sf, ph === 6 ? 1 - st.k : ph === 7 ? st.k : 1);
		}
		if (seen && dist < 150) { const L = S.loops.crane || (S.loops.crane = sounds.loop?.('crane')); if (L) L.set(snd(S.origin[0], S.origin[1] + 4, S.origin[2]), st.moving ? 1 : 0.35); }
	}
	function setFade(k, f) { k.mesh.material.userData.u.uFade.value = f; if (k.cl) k.cl.material.userData.u.uFade.value = f; }

	// ---------- the crew's parts ----------
	// a worker's beat: walkers carry from the truck to the scaffold's foot through the gate and go
	// back empty; the rest work where the stage has them
	const ROLES = [
		['shovel', 'guide', 'shovel', 'talk', 'shovel', 'carry', 'shovel'],
		['guide', 'shoulder', 'scaf', 'pour', 'scaf', 'shoulder', 'scaf'],
		['guide', 'carry', 'lay', 'scaf', 'lay', 'carry', 'scaf'],
		['guide', 'carry', 'scaf', 'scaf', 'carry', 'scaf', 'talk'],
	];
	function roleOf(S, i, stage, scafOK) {
		let r = ROLES[stage][i] || (stage ? 'scaf' : 'shovel');
		if (r === 'guide' && !(S.crane || S.mobile)) r = stage ? 'talk' : 'carry';
		if ((r === 'scaf' || r === 'lay') && !scafOK) r = 'talk';
		return r;
	}
	function parked(S, kind, slot) { for (let k = 0; k < S.vehicles.length; k++) { const v = S.vehicles[k]; if (v.state === 'park' && (!kind || v.kind === kind) && (!slot || v.slot === slot) && !(v.wait > 0)) return v; } return null; }
	function crewAt(S, stage, hts, dt) {
		const { P, G, o } = S, foot = o.y + 1.2, gl = S.gl;
		// (the lift they work from: at the frame's top while it rises, the walls' as they close in, the glazing's)
		const top = stage === 1 ? hts.frame : stage === 2 ? hts.clad : hts.glaze;
		const lift = Math.max(2, Math.min(Math.floor((S.clip - 1.0) / 2) * 2, Math.floor(top / 2) * 2));
		const scafOK = S.clip > 3;
		const truckA = parked(S, null, 'a');
		for (let wi = 0; wi < S.workers.length; wi++) {
			const w = S.workers[wi];
			const role = gl ? (w.i ? 'carry' : 'glazier') : roleOf(S, w.i, stage, scafOK);
			let pose = 'talk', u = w.u0, v = P.scafV + 0.4, y = null, face = 0, t = S.t * 0.8 + w.phase;
			if (role === 'carry' || role === 'shoulder') {
				// (the walk: inside the gate, out through it, across the pavement and along the kerb to
				// the truck's side, and back; never out into the road)
				if (!w.path || w.pathStage !== stage || w.pathTruck !== truckA) {
					w.pathStage = stage; w.pathTruck = truckA;
					const tu = truckA ? G.uvTo(truckA.x, truckA.z, UV)[0] : P.gateU, kv = Math.max(P.fenceV + 0.4, P.kerbV - 0.55);
					w.path = gl ? [[w.u0 * 0.3, 1.2], [w.u0 * 0.3, 2.0], [tu + 1.5, P.kerbV - 0.55]] : [[w.u0 * 0.5, P.scafV + 0.35], [P.gateU, P.scafV + 0.45], [P.gateU, P.fenceV + 0.4], [P.gateU, kv], [tu + (w.i % 2 ? -1 : 1) * 1.5, kv]];
					w.lens = []; let L = 0; for (let k = 1; k < w.path.length; k++) { L += Math.hypot(w.path[k][0] - w.path[k - 1][0], w.path[k][1] - w.path[k - 1][1]); w.lens.push(L); }
					w.total = L; w.d = (w.phase * 3) % L; w.dir = 1; w.wait = 0;
				}
				if (!truckA) { pose = 'talk'; u = P.gateU + 1.2; v = P.fenceV - 0.6; face = -0.5; }
				else {
					if (w.wait > 0) w.wait -= dt;
					else { w.d += w.dir * 1.25 * dt; if (w.d >= w.total) { w.d = w.total; w.dir = -1; w.wait = 3; } else if (w.d <= 0) { w.d = 0; w.dir = 1; w.wait = 2.5; } }
					let k = 0; while (k < w.lens.length - 1 && w.lens[k] < w.d) k++;
					const a = w.path[k], b = w.path[k + 1], l0 = k ? w.lens[k - 1] : 0, seg = w.lens[k] - l0 || 1, f = Math.min(1, Math.max(0, (w.d - l0) / seg));
					u = a[0] + (b[0] - a[0]) * f; v = a[1] + (b[1] - a[1]) * f;
					const loaded = w.dir < 0;
					pose = loaded ? (role === 'shoulder' ? 'shoulder' : stage === 3 || gl ? 'pane' : 'carry') : w.wait > 0 ? 'idle' : 'walk';
					face = Math.atan2((b[0] - a[0]) * w.dir, (b[1] - a[1]) * w.dir);
					if (w.wait > 0) face = loaded ? Math.PI : 0;
					t = w.wait > 0 ? 0 : w.d / 1.45;
				}
			} else if (role === 'shovel') { pose = 'shovel'; v = 1.0 + hash(w.i, 2) * 1.2; u = w.u0; face = Math.PI + (hash(w.i, 5) - 0.5) * 0.6; }
			else if (role === 'guide') {
				const Cr = S.crane || S.mobile, st = Cr.state, cx = Cr === S.crane ? Cr.x : Cr.slew[0], cz = Cr === S.crane ? Cr.z : Cr.slew[2], pa = Cr.lift.a0;
				// (by where the load comes down, to one side of it, looking up at it)
				G.uvTo(cx + Math.sin(pa) * Cr.lift.r0, cz + Math.cos(pa) * Cr.lift.r0, UV);
				u = UV[0] + 2.2; v = Math.max(P.scafV + 0.4, Math.min(P.fenceV - 0.5, UV[1]));
				pose = st.phase === 0 || st.phase === 1 || st.phase === 7 || st.phase === 3 ? 'guide' : 'talk';
				face = Math.atan2(UV[0] - u, UV[1] - v);
			} else if (role === 'pour') {
				const m = parked(S, 'mixer', null);
				if (m) {
					// (on the pavement at the chute, facing it)
					const cx = m.x - m.hx * 5.7, cz = m.z - m.hz * 5.7;
					G.uvTo(cx, cz, UV); const cu = UV[0], cv = UV[1];
					u = cu; v = Math.min(P.kerbV - 0.45, Math.max(P.fenceV + 0.35, cv + 2.0)); pose = 'pour'; face = Math.atan2(cu - u, cv - v);
				} else { pose = 'talk'; u = P.gateU + 1; v = P.fenceV - 0.5; }
			} else if (role === 'scaf' || role === 'lay') {
				// (up on the boards at the working lift, at the wall)
				const ly = role === 'lay' ? lift : Math.max(2, lift - (w.i % 2) * 2);
				u = Math.max(-G.L / 2 + 0.6, Math.min(G.L / 2 - 0.6, w.u0)); v = 0.62; y = foot + ly + 0.13; pose = role === 'lay' ? 'lay' : 'hammer'; face = Math.PI;
			} else if (role === 'glazier') { u = w.u0 * 0.3; v = 1.0; pose = 'hammer'; face = Math.PI; }
			else { pose = 'talk'; u = P.gateU - 1.4 + (w.i % 2) * 2.8; v = P.fenceV - 0.7; face = w.i % 2 ? 0.6 + Math.PI : -0.6 + Math.PI; }
			G.atTo(u, v, AT);
			const wy = y ?? AT[1];
			crew.set(AT[0], wy, AT[2], G.yawF + face, pose, t, w.look, S.t + w.phase);
			w.x = AT[0]; w.y = wy; w.z = AT[2];
			// (a hammer's blow heard as it lands)
			if (pose === 'hammer') { const st = (t * 1.4) % 1; if (w.stroke < 0.76 && st >= 0.76) sounds.hammer(snd(AT[0], wy + 1.2, AT[2])); w.stroke = st; }
		}
	}

	function setCataclysm(on) {
		on = !!on;
		if (on === cataclysm) return cataclysm;
		cataclysm = on;
		if (!on) {
			// (over: those waiting are seen to a little after, the work under way picks up again)
			const now = store.now();
			store.records((rec) => { if (rec.r0 == null) rec.t0 = Math.max(rec.t0 ?? now, now); else rec.r0 += 0.25; });
			store.touch();
		}
		return cataclysm;
	}
	// what one site costs to draw: its meshes and their triangles as they stand
	function costOf(S) {
		let draws = 0, tris = 0;
		S.root.traverse((m) => { if ((m.isMesh) && m.visible) { draws++; tris += m.geometry.attributes.position.count / 3; } });
		return { draws, tris: Math.round(tris) };
	}
	function info() {
		const out = [];
		store.each((id, rec) => {
			if (rec.r0 == null) return;
			const p = progress(rec), S = sites.get(id);
			out.push({
				id, x: rec.x, z: rec.z, progress: +p.toFixed(3), stage: glassOnly(rec) ? 'glazier' : STAGES[stageOf(p)], hours: +(rec.rd || 0).toFixed(2), left: +((1 - p) * (rec.rd || 0)).toFixed(2), glass: glassOnly(rec),
				crane: !!S?.crane, mobileCrane: !!S?.mobile, mixer: !!S?.vehicles.some((v) => v.kind === 'mixer'), workers: S?.workers.length || 0,
				verts: S ? (S.kit?.mesh.geometry.attributes.position.count || 0) + (S.scaf?.geometry.attributes.position.count || 0) : 0, here: !!S,
				company: S ? COMPANIES[S.co].name : null, trucks: S ? S.vehicles.map((v) => v.kind + (v.load ? ':' + v.load : '') + '@' + v.state) : [], kerb: S ? +S.K.kerbV.toFixed(2) : null, kerbReal: S ? S.K.real : null,
				fence: S ? +S.P.fenceV.toFixed(2) : null, faces: S ? S.P.faces : null, scaffold: S ? +S.clip.toFixed(2) : 0, cost: S ? costOf(S) : null,
			});
		});
		return out;
	}
	// surfaces the environmental graphics can dress later: the banners on the fences (world, with
	// their normal and size), and each truck's door and side panels (in the truck's own frame)
	function anchors() {
		const out = [];
		for (const S of list) {
			for (const a of S.anchors) out.push({ site: S.id, ...a });
			for (const v of S.vehicles) out.push({ site: S.id, kind: 'livery', vehicle: v.kind, company: COMPANIES[S.co].name, object: v.mesh, panels: [{ at: [1.16, 1.68, 1.8], n: [1, 0, 0], w: 1.05, h: 0.66 }, { at: [-1.16, 1.68, 1.8], n: [-1, 0, 0], w: 1.05, h: 0.66 }] });
		}
		return out;
	}
	return { group, update, progress, cataclysm: (on) => (on === undefined ? cataclysm : setCataclysm(on)), info, anchors, sites, crew, cost: () => list.map(costOf) };
}

// ---------- the glow of the beacons, the light towers and the aviation lights ----------
// a pool of points, filled each frame: kind 1 a flashing amber beacon, 2 a work light, 3 a red
// aviation light; additive, sized with distance, brighter by night
function createGlow(parent, cap) {
	const pos = new Float32Array(cap * 3), info = new Float32Array(cap * 2);
	const g = new THREE.BufferGeometry();
	const pa = new THREE.BufferAttribute(pos, 3), ia = new THREE.BufferAttribute(info, 2);
	pa.setUsage(THREE.DynamicDrawUsage); ia.setUsage(THREE.DynamicDrawUsage);
	g.setAttribute('position', pa); g.setAttribute('aInfo', ia);
	g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
	const m = new THREE.ShaderMaterial({
		uniforms: { uNight: kitShared.uNight, uTime: kitShared.uTime, uScale: { value: 600 } },
		vertexShader: `attribute vec2 aInfo; uniform float uNight, uTime, uScale; varying vec3 vC; varying float vA;
			void main() {
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				float k = floor(aInfo.x + 0.5), a = aInfo.y, s = 0.6;
				vec3 c = vec3(1.0, 0.55, 0.08);
				if (k == 1.0) { float ph = fract(sin(dot(floor(position * 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.283; float f = pow(max(0.0, sin(uTime * 6.5 + ph)), 6.0) + 0.6 * pow(max(0.0, sin(uTime * 6.5 + ph + 0.9)), 10.0); a *= f * (0.35 + 0.65 * uNight); s = 0.9; }
				else if (k == 2.0) { c = vec3(1.0, 0.95, 0.85); a *= uNight; s = 1.6; }
				else { c = vec3(1.0, 0.08, 0.04); a *= uNight * (0.85 + 0.15 * sin(uTime * 2.0)); s = 0.9; }
				vC = c; vA = a;
				gl_Position = projectionMatrix * mv;
				gl_PointSize = a > 0.003 ? clamp(s * uScale / max(1.0, -mv.z), 2.0, 96.0) : 0.0;
			}`,
		fragmentShader: `varying vec3 vC; varying float vA;
			void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float f = exp(-r * r * 5.0) + 0.5 * exp(-r * r * 40.0); if (f * vA < 0.004) discard; gl_FragColor = vec4(vC * f * vA * 1.6, 1.0); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const pts = new THREE.Points(g, m);
	pts.frustumCulled = false; pts.renderOrder = 2; pts.name = 'structures-crew-glow';
	parent.add(pts);
	let n = 0;
	return {
		begin() { n = 0; },
		add(x, y, z, kind, a = 1) { if (n >= cap) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; info[n * 2] = kind; info[n * 2 + 1] = a; n++; },
		end() { g.setDrawRange(0, n); pts.visible = n > 0; pa.needsUpdate = true; ia.needsUpdate = true; },
	};
}
