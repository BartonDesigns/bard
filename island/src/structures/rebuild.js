// The crews. Not long after a building is damaged (a third of an hour of game time) a crew
// arrives: the site fenced along the street (mesh panels on their concrete feet, the works'
// banners on them, barriers at the gate), cones out along the kerb, trucks pulled up: a dump
// truck while the rubble goes, a cement mixer turning and bars on a flatbed while the frame
// rises, blocks while the walls close in, glass on its A-frame and the glazier's van at the
// end; a mobile crane on its outriggers, or a tower crane over the big ones. Scaffolding goes
// up as high as the work (standards, ledgers, boarded lifts with guard rails and braces, the
// street side netted), the crew at it in hard hats and hi-vis: shovelling at the rubble,
// hammering up on the lifts, carrying from the trucks. Two to five game hours by how bad it
// was (shell.js draws the stages: rubble cleared, frame rising, cladding, glazing); a broken
// window alone gets a glazier's van and an hour's work. While a citywide catastrophe is under
// way (cataclysm(true)) nobody comes: the work waits, and resumes once it is over.

import * as THREE from 'three';
import { bid, frameOf, onFace, faceLen, FACES, hash } from './ids.js';
import { parts, cloth, clothMaterial, createCrew, flatbed, dump, mixer, mixerDrum, craneCarrier, craneUpper, van, cone, barrier, pallet, skip, cabin, loo, towerMast, towerJib, COLORS, NET, MESH, BANNER, SAFETY } from './crewkit.js';

// the stages of a rebuild, by how far along it is
const STAGES = ['clearing', 'frame', 'cladding', 'glazing'];
const stageOf = (p) => (p < 0.14 ? 0 : p < 0.48 ? 1 : p < 0.74 ? 2 : 3);
// (a tower crane over the tall or the broad; a mobile crane at the kerb for the rest)
const towerJob = (o) => { const H = o.h - 1.2; return H > 24 || (H > 14 && o.w * o.d > 900); };
const LIVERY = [[0.95, 0.55, 0.12], [0.92, 0.92, 0.9], [0.2, 0.42, 0.75], [0.85, 0.16, 0.12]];

export function createRebuild(ctx) {
	const { scene, isPhone, store, sounds } = ctx;
	const SITE_R = isPhone ? 200 : 360;
	const group = new THREE.Group();
	group.name = 'structures-crews';
	scene.add(group);
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
	let clothMat = null;
	const clothOf = () => clothMat || (clothMat = clothMaterial());
	const crew = createCrew(group, isPhone ? 16 : 48);
	let cataclysm = false, tickAt = -1e9;
	const sites = new Map();          // id -> { rec, o, root, scaffold, net, drum, upper, crane, jib, workers, key, stage }
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
		const city = ctx.city();
		const near = city?.lotsNear?.(rec.x, rec.z, 2) || [];
		return near.find((o) => bid(o) === id) || null;
	}
	// the site's frame: the front (the street side), along it, and out from it
	function frame(o) {
		const F = frameOf(o), f = ctx.frontOf?.(o) ?? 0, [fx, fz] = onFace(o, f, 0), [nx, nz] = FACES[f], L = faceLen(o, f);
		const [wnx, wnz] = F.dir(nx, nz), yawF = Math.atan2(wnx, wnz);
		// (a point u along the front, v out from it, in the world; and its ground)
		const at = (u, v) => { const [x, z] = F.w(fx + nx * v + nz * u, fz + nz * v - nx * u); return [x, ctx.ground(x, z), z]; };
		return { F, f, L, nx, nz, yawF, at };
	}
	// the trucks, the fence and what stands inside it, by the stage
	function build(S, stage) {
		const { o, rec } = S, H = o.h - 1.2, gl = glassOnly(rec), G = frame(o), { L, yawF, at } = G;
		const K = parts(), CL = cloth();
		const along = yawF + Math.PI / 2;
		const liv = LIVERY[Math.floor(hash(rec.x, rec.z + 1) * LIVERY.length)];
		const put = (u, v, ry = along) => { const [x, y, z] = at(u, v); return K.at(x, y, z, ry); };
		S.drum = S.upper = null;
		if (gl) {
			van(put(-1, 6.5));
			for (let i = 0; i < 4; i++) { const [x, y, z] = at(-L * 0.3 + i * L * 0.2, 2.4); cone(K.at(x, y, z), 0, 0); }
			pallet(put(L * 0.25, 1.6), 0, 0, 0, 'glass');
		} else {
			// the trucks at the kerb, side on to the front
			const big = H > 14 || o.w * o.d > 600, kerb = 8.5;
			const first = stage === 0 ? 'dump' : stage === 1 ? 'mixer' : 'flat';
			const t1 = put(-Math.min(L * 0.3, 7), kerb);
			if (first === 'dump') dump(t1, liv, true);
			else if (first === 'mixer') { mixer(t1, liv); S.drum = { at: at(-Math.min(L * 0.3, 7), kerb), yaw: along }; }
			else flatbed(t1, liv, stage === 3 ? 'glass' : 'blocks');
			const t2 = put(Math.min(L * 0.3, 7) + 3, kerb);
			if (stage === 1) flatbed(t2, COLORS.white, 'bars');
			else if (stage === 3) van(t2);
			else if (!big) flatbed(t2, COLORS.white, stage === 0 ? 'none' : 'blocks');
			// a mobile crane on its outriggers for the middling jobs (the tower crane takes the big ones)
			if (!towerJob(o)) {
				const u = L / 2 + 8, [x, y, z] = at(u, kerb - 1);
				craneCarrier(K.at(x, y, z, along), COLORS.yellow);
				S.upper = { at: [x, y, z], yaw: along, a: 0.75 + hash(rec.s || 1, 4) * 0.25, len: Math.max(14, Math.min(26, H + 8)) };
			}
			// cones along the kerb, barriers either side of the gate
			for (let i = 0; i < 8; i++) { const [x, y, z] = at(-L / 2 - 6 + i * (L + 12) / 7, kerb - 2.4); cone(K.at(x, y, z), 0, 0); }
			const gate = 0;
			for (const s of [-1, 1]) { const [x, y, z] = at(gate + s * 4.2, 4.2); barrier(K.at(x, y, z), 0, 0, along, s > 0); }
			// the fence: mesh panels on concrete feet, posts and rails, banners every other panel
			const fv = 3.4, pw = 3.4, gap = 3.6;
			const fenceRun = (u0, v0, u1, v1) => {
				const len = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(len / pw));
				for (let k = 0; k < n; k++) {
					const a = k / n, b = (k + 1) / n, ua = u0 + (u1 - u0) * a, va = v0 + (v1 - v0) * a, ub = u0 + (u1 - u0) * b, vb = v0 + (v1 - v0) * b;
					if (v0 === v1 && Math.abs((ua + ub) / 2 - gate) < gap) continue;
					const A = at(ua, va), B = at(ub, vb), y0 = Math.min(A[1], B[1]);
					const V = K.at(0, 0, 0);
					V.box(A[0], A[1], A[2], 0.22, 0.14, 0.62, COLORS.concrete, Math.atan2(B[0] - A[0], B[2] - A[2]));
					V.tube([A[0], y0 + 0.1, A[2]], [A[0], y0 + 2.05, A[2]], 0.025, COLORS.steel);
					V.tube([A[0], y0 + 2.0, A[2]], [B[0], y0 + 2.0, B[2]], 0.02, COLORS.steel);
					V.tube([A[0], y0 + 0.15, A[2]], [B[0], y0 + 0.15, B[2]], 0.02, COLORS.steel);
					CL.quad([A[0], y0 + 0.15, A[2]], [B[0], y0 + 0.15, B[2]], [B[0], y0 + 2.0, B[2]], [A[0], y0 + 2.0, A[2]], MESH, len / n / 1.2, 1.6);
					if (k % 2 === 0) {
						// (the banner on the street side, a hand off the mesh)
						const ox = (B[2] - A[2]) / len * 0.03 * n, oz = -(B[0] - A[0]) / len * 0.03 * n, cl = k % 4 ? SAFETY : BANNER;
						CL.quad([A[0] + ox, y0 + 0.6, A[2] + oz], [B[0] + ox, y0 + 0.6, B[2] + oz], [B[0] + ox, y0 + 1.6, B[2] + oz], [A[0] + ox, y0 + 1.6, A[2] + oz], cl, 1, 1);
					}
				}
			};
			fenceRun(-L / 2 - 2, fv, L / 2 + 2, fv);
			fenceRun(-L / 2 - 2, 0.5, -L / 2 - 2, fv);
			fenceRun(L / 2 + 2, fv, L / 2 + 2, 0.5);
			// inside, and off to the sides: the skip, pallets, bars, the cabin and the loo
			const side = (u, v) => { const [x, y, z] = at(u, v); return K.at(x, y, z, 0); };
			skip(side(-L / 2 - 4.5, 3.2), 0, 0, along + Math.PI / 2, stage === 0);
			for (let i = 0; i < 3; i++) pallet(side(L / 2 + 3.6 + (i % 2) * 1.5, 1.2 + i * 1.3), 0, 0, along + i * 0.3, stage === 1 && i === 2 ? 'bars' : stage === 3 ? 'glass' : 'blocks');
			cabin(side(-L / 2 - 9, 2.5), 0, 0, along + Math.PI / 2);
			loo(side(-L / 2 - 9, 7.2), 0, 0, along);
		}
		const root = new THREE.Mesh(K.merge(), mat);
		root.castShadow = true; root.receiveShadow = true;
		group.add(root);
		S.root = root;
		const cg = CL.geo();
		if (cg) { S.fence = new THREE.Mesh(cg, clothOf()); S.fence.renderOrder = 1; group.add(S.fence); }
		// the turning parts: the drum, the crane's upper works
		if (S.drum) {
			const m = new THREE.Mesh(mixerDrum(liv), mat);
			const [x, y, z] = S.drum.at, cy = Math.cos(S.drum.yaw), sy = Math.sin(S.drum.yaw);
			m.position.set(x + sy * -1.5, y + 2.45, z + cy * -1.5);
			m.rotation.order = 'YXZ'; m.rotation.set(0.18, S.drum.yaw, 0);
			m.castShadow = true; group.add(m); S.drum.mesh = m;
		}
		if (S.upper) {
			const U = craneUpper(COLORS.yellow, S.upper.a, S.upper.len);
			const m = new THREE.Mesh(U.geo, mat);
			const [x, y, z] = S.upper.at, cy = Math.cos(S.upper.yaw), sy = Math.sin(S.upper.yaw);
			m.position.set(x + sy * -1.2, y + 1.75, z + cy * -1.2);
			// (slewed round toward the building)
			S.upper.base = Math.atan2(o.x - m.position.x, o.z - m.position.z);
			m.rotation.y = S.upper.base;
			m.castShadow = true; group.add(m); S.upper.mesh = m;
		}
	}
	function clear(S) {
		for (const k of ['root', 'fence']) if (S[k]) { group.remove(S[k]); S[k].geometry.dispose(); S[k] = null; }
		if (S.drum?.mesh) { group.remove(S.drum.mesh); S.drum.mesh.geometry.dispose(); }
		if (S.upper?.mesh) { group.remove(S.upper.mesh); S.upper.mesh.geometry.dispose(); }
		S.drum = S.upper = null;
	}
	function site(id, rec, o) {
		const H = o.h - 1.2, gl = glassOnly(rec), L = faceLen(o, ctx.frontOf?.(o) ?? 0);
		const S = { id, rec, o, root: null, fence: null, scaffold: null, net: null, crane: null, jib: null, drum: null, upper: null, workers: [], key: '', stage: -1, t: Math.random() * 10, beat: 0 };
		// the crew: how many, and each one's place along the front and their part in it
		const n = gl ? 2 : Math.min(isPhone ? 4 : 7, 3 + Math.floor(H / 10));
		for (let i = 0; i < n; i++) S.workers.push({ u0: (hash(i, rec.s || 1) - 0.5) * L * 0.8, beat: 1 + hash(rec.s || 1, i) * 4, role: i % 3, phase: hash(i * 7, 3) * 6 });
		// a tower crane over the big ones
		if (!gl && towerJob(o)) {
			const G = frame(o), h = H + 14, [x, y, z] = G.at(-(G.L / 2 + 4), 10);
			const K = parts(), V = K.at(0, 0, 0);
			towerMast(V, h);
			const crane = new THREE.Mesh(K.merge(), mat);
			crane.position.set(x, y, z);
			const jib = new THREE.Mesh(towerJib(Math.max(22, Math.hypot(o.w, o.d) * 0.9)), mat);
			jib.position.y = h;
			crane.add(jib);
			crane.castShadow = true; jib.castShadow = true;
			group.add(crane);
			S.crane = crane; S.jib = jib;
		}
		return S;
	}
	// the scaffolding as high as the work, struck at the end: standards, ledgers, boarded lifts
	// with their guard rails and toe boards, braces, a ladder; the street side netted
	function scaffold(S, p) {
		const o = S.o, H = o.h - 1.2, lift = 2;
		const up = p === null || p < 0.1 || p > 0.93 || glassOnly(S.rec) ? 0 : Math.min(H + 1.2, lift * 2 + (H + 1.2) * Math.min(1, (p - 0.1) / 0.3));
		const key = Math.round(up / lift) + ':' + stageOf(p ?? 0);
		if (key === S.key) return;
		S.key = key;
		const stage = stageOf(p ?? 0);
		if (stage !== S.stage) { clear(S); S.stage = stage; build(S, stage); }
		for (const k of ['scaffold', 'net']) if (S[k]) { group.remove(S[k]); S[k].geometry.dispose(); S[k] = null; }
		if (up <= 0) return;
		const K = parts(), CL = cloth(), F = frameOf(o), foot = o.y + 1.2, front = ctx.frontOf?.(o) ?? 0;
		const V = K.at(0, 0, 0), lite = isPhone;
		for (let f = 0; f < 4; f++) {
			const L = faceLen(o, f), [nx, nz] = FACES[f], bays = Math.max(1, Math.round((L + 1.2) / 2.1)), bw = (L + 1.2) / bays;
			const W = (u, off, y) => { const [lx, lz] = onFace(o, f, u), [x, z] = F.w(lx + nx * off, lz + nz * off); return [x, foot + y, z]; };
			for (let b = 0; b <= bays; b++) {
				const u = -L / 2 - 0.6 + b * bw;
				for (const off of [0.5, 1.5]) { V.tube(W(u, off, -0.2), W(u, off, up + 1), 0.024, COLORS.steel); V.box(...W(u, off, -0.22), 0.15, 0.02, 0.15, COLORS.dark); }
			}
			for (let y = lift; y <= up + 0.01; y += lift) {
				const u0 = -L / 2 - 0.6, u1 = L / 2 + 0.6;
				for (const off of [0.5, 1.5]) V.tube(W(u0, off, y), W(u1, off, y), 0.022, COLORS.steel);
				// (the boards of the lift, the toe board and the guard rail on the outside)
				if (!lite || (y / lift) % 2 === 0) for (let k = 0; k < 4; k++) V.tube(W(u0, 0.62 + k * 0.25, y + 0.04), W(u1, 0.62 + k * 0.25, y + 0.04), k === 0 || k === 3 ? 0.11 : 0.1, COLORS.wood);
				V.tube(W(u0, 1.52, y + 0.15), W(u1, 1.52, y + 0.15), 0.07, COLORS.wood);
				V.tube(W(u0, 1.5, y + 1.0), W(u1, 1.5, y + 1.0), 0.02, COLORS.steel);
				// (braces across every few bays, a lift at a time)
				if (!lite) for (let b = 0; b + 1 <= bays; b += 3) V.tube(W(-L / 2 - 0.6 + b * bw, 1.5, y - lift), W(-L / 2 - 0.6 + (b + 1) * bw, 1.5, y), 0.018, COLORS.steel);
				if (f === front) CL.quad(W(u0, 1.62, y - lift), W(u1, 1.62, y - lift), W(u1, 1.62, y + 0.1), W(u0, 1.62, y + 0.1), NET, (u1 - u0) / 2.5, 1);
			}
			// a ladder up the end of the front
			if (f === front) for (let y = 0; y < up; y += lift) {
				const u = L / 2 + 0.2;
				V.tube(W(u - 0.2, 1.0, y), W(u - 0.2, 1.0, y + lift + 1), 0.02, COLORS.yellow); V.tube(W(u + 0.2, 1.0, y), W(u + 0.2, 1.0, y + lift + 1), 0.02, COLORS.yellow);
				for (let r = 0.3; r < lift + 1; r += 0.3) V.tube(W(u - 0.2, 1.0, y + r), W(u + 0.2, 1.0, y + r), 0.012, COLORS.yellow);
			}
		}
		S.scaffold = new THREE.Mesh(K.merge(), mat);
		S.scaffold.castShadow = true;
		group.add(S.scaffold);
		const ng = CL.geo();
		if (ng) { S.net = new THREE.Mesh(ng, clothOf()); S.net.renderOrder = 1; group.add(S.net); }
		S.up = up;
	}
	function drop(S) {
		clear(S);
		for (const k of ['scaffold', 'net']) if (S[k]) { group.remove(S[k]); S[k].geometry.dispose(); }
		if (S.crane) { group.remove(S.crane); S.crane.geometry.dispose(); S.jib.geometry.dispose(); }
		sites.delete(S.id);
	}
	function update(cam, dt) {
		// (twice a second by the clock on the wall, however slowly the frames come)
		if (performance.now() - tickAt > 500 || store.now() - (lastNow ?? 0) > 0.05) { tickAt = performance.now(); const now = store.now(); schedule(Math.max(0, now - (lastNow ?? now))); lastNow = now; }
		const x = cam.position.x, z = cam.position.z;
		const live = new Set();
		crew.begin();
		if (!cataclysm) store.each((id, rec) => {
			if (rec.r0 == null || Math.hypot(rec.x - x, rec.z - z) > SITE_R) return;
			const o = lotFor(id, rec);
			if (!o) return;
			live.add(id);
			let S = sites.get(id);
			if (!S || S.o !== o) { if (S) drop(S); S = site(id, rec, o); sites.set(id, S); sounds.beep({ x: rec.x, y: o.y + 2, z: rec.z }); }
			S.rec = rec;
			const p = progress(rec), stage = stageOf(p ?? 0);
			scaffold(S, p);
			S.t += dt;
			// the crew at it: shovelling at the rubble, up on the lifts with the work, or carrying from the trucks
			const G = frame(o), foot = o.y + 1.2, H = o.h - 1.2, gl = glassOnly(rec);
			const work = Math.max(0, Math.min((S.up || 0) - 2, Math.floor(H * Math.min(1, Math.max(0, (p - 0.18) / 0.6)) / 2) * 2));
			for (const w of S.workers) {
				const k = S.t / w.beat + w.phase;
				let u = w.u0, v = 1.1, y = null, pose = 'talk', face = 0;
				if (gl) { u = w.u0 * 0.4 + Math.sin(k * 0.6) * 1.2; v = 1.2; pose = w.role ? 'carry' : 'hammer'; face = w.role ? 0 : 1; }
				else if (stage === 0) {
					if (w.role === 0) { v = 1.6 + hash(w.u0, 1) * 1.2; pose = 'shovel'; face = 1; }
					else if (w.role === 1) { u = w.u0 + Math.sin(k) * Math.min(6, G.L * 0.35); v = 2.6; pose = 'walk'; face = Math.cos(k) > 0 ? 2 : 3; }
					else { u = 0; v = 4.6; pose = 'talk'; face = 0; }
				} else if (w.role === 0 && S.up > 2) { v = 1.0; y = foot + Math.max(2, work); pose = 'hammer'; face = 1; }
				else if (w.role === 1) { u = w.u0 + Math.sin(k) * Math.min(6, G.L * 0.35); v = 2.6; pose = stage >= 2 ? 'carry' : 'walk'; face = Math.cos(k) > 0 ? 2 : 3; }
				else { v = stage === 1 ? 6.2 : 2.2; u = stage === 1 ? -Math.min(G.L * 0.3, 7) + 3.5 : w.u0; pose = stage === 1 ? 'talk' : 'hammer'; face = stage === 1 ? 0 : 1; }
				const [wx, gy, wz] = G.at(u, v);
				// (facing: the street, the wall, or the way they walk along it)
				const yaw = face === 1 ? G.yawF + Math.PI : face === 2 ? G.yawF - Math.PI / 2 : face === 3 ? G.yawF + Math.PI / 2 : G.yawF;
				crew.set(wx, y ?? gy, wz, yaw, pose, S.t + w.phase);
				w.pos = { x: wx, y: (y ?? gy) + 1.5, z: wz };
			}
			if (S.jib) S.jib.rotation.y = Math.sin(S.t * 0.07 + (rec.s || 0)) * 1.4;
			if (S.drum?.mesh) S.drum.mesh.rotation.z += dt * 1.8;
			if (S.upper?.mesh) S.upper.mesh.rotation.y = S.upper.base + Math.sin(S.t * 0.12 + (rec.s || 0)) * 0.45;
			// the sounds of the work
			S.beat -= dt;
			if (S.beat <= 0 && p > 0.05 && p < 0.97) { S.beat = 0.35 + Math.random() * 1.1; const w = S.workers[Math.floor(Math.random() * S.workers.length)]; if (w?.pos) (Math.random() < 0.08 ? sounds.grind : sounds.hammer)(w.pos); }
		});
		crew.end();
		for (const S of [...sites.values()]) if (!live.has(S.id)) drop(S);
	}
	let lastNow = null;
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
	function info() {
		const out = [];
		store.each((id, rec) => { if (rec.r0 != null) { const p = progress(rec), S = sites.get(id); out.push({ id, x: rec.x, z: rec.z, progress: +p.toFixed(3), stage: glassOnly(rec) ? 'glazier' : STAGES[stageOf(p)], hours: +(rec.rd || 0).toFixed(2), left: +((1 - p) * (rec.rd || 0)).toFixed(2), glass: glassOnly(rec), crane: !!S?.crane, mobileCrane: !!S?.upper, mixer: !!S?.drum, workers: S?.workers.length || 0, verts: S ? (S.root?.geometry.attributes.position.count || 0) + (S.scaffold?.geometry.attributes.position.count || 0) : 0, here: !!S }); } });
		return out;
	}
	return { group, update, progress, cataclysm: (on) => (on === undefined ? cataclysm : setCataclysm(on)), info, sites, crew };
}
