// The small life you meet on foot in the Bay Area's open country, each in its habitat and
// its hours (nature/fieldguide.js): California ground squirrels sitting up by their
// burrows in the grass and bolting for them when you come; a flock of wild turkeys
// pecking along the oak woodland's edge; a covey of quail running in a line into the
// brush; a fence lizard doing push-ups on the warm tread; banana slugs on the redwood
// trail; butterflies over the flowers and the brush. Placed round you as you walk (from
// the same reckoning of the land as the plants: wildground.js habitat), animated here.

import * as THREE from 'three';
import { groundSquirrel, turkey, quail, lizard, bananaSlug, butterflyWing } from '../world/creatures.js';
import { habitat } from './wildground.js';

// butterflies by month: [id, colour]
const FLIES = [
	['tiger_swallowtail', [0.95, 0.8, 0.25]], ['california_sister', [0.18, 0.16, 0.16]], ['mourning_cloak', [0.3, 0.16, 0.12]],
	['painted_lady', [0.9, 0.5, 0.25]], ['cabbage_white', [0.95, 0.95, 0.9]],
];

export function createSmallLife(group, bay, { real, isPhone = false, about, spot, seen }) {
	const g = (x, z) => bay.heightAt(x, z);
	const land = habitat(bay, real, g);
	const mat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 });
	const mk = (geo, n, m = mat()) => { const im = new THREE.InstancedMesh(geo, m, n); im.count = 0; im.frustumCulled = false; im.castShadow = !isPhone; group.add(im); return im; };
	const sq = mk(groundSquirrel(), 10), tk = mk(turkey(), 14), ql = mk(quail(), 16), lz = mk(lizard(), 4), sl = mk(bananaSlug(), 8);
	const wingM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
	const wing = butterflyWing(), wL = mk(wing, 10, wingM), wR = mk(wing, 10, wingM);
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), hinge = new THREE.Matrix4();
	let seed = 1;
	const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
	let at = null, lastH = -1;
	const S = { sq: [], tk: [], ql: [], lz: [], sl: [], bf: [] };

	// who is about near here now: a few probes round you, each put where its habitat is
	function place(cx, cz, h, month) {
		at = { x: cx, z: cz }; lastH = h;
		seed = (Math.floor(cx / 150) * 7919 + Math.floor(cz / 150) * 104729 + 31) >>> 0 || 1;
		for (const k in S) S[k] = [];
		const probe = (r0, r1) => { const a = rnd() * 6.283, d = r0 + rnd() * (r1 - r0), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; return { x, z, E: land(x, z) }; };
		for (let k = 0; k < 24; k++) {
			const P = probe(25, 90), E = P.E;
			if (!E || E.slope > 0.6) continue;
			// a squirrel colony in the open grass
			if (!S.sq.length && E.open > 0.6 && about('ground_squirrel', h, month) && rnd() < 0.6) {
				const n = 3 + Math.floor(rnd() * 5);
				for (let i = 0; i < n; i++) { const x = P.x + (rnd() - 0.5) * 18, z = P.z + (rnd() - 0.5) * 18; S.sq.push({ x, z, hx: x + (rnd() - 0.5) * 3, hz: z + (rnd() - 0.5) * 3, yaw: rnd() * 6.28, ph: rnd() * 9, run: 0, gone: 0 }); }
			}
			// turkeys at the woodland's edge
			else if (!S.tk.length && E.wood > 0.15 && E.wood < 0.7 && E.redwood < 0.2 && about('wild_turkey', h, month) && rnd() < 0.35) {
				const n = 5 + Math.floor(rnd() * 8), yaw = rnd() * 6.28;
				for (let i = 0; i < n; i++) S.tk.push({ x: P.x + (rnd() - 0.5) * 14, z: P.z + (rnd() - 0.5) * 14, yaw: yaw + (rnd() - 0.5) * 1.2, ph: rnd() * 9, flee: 0, sp: 0.3 + rnd() * 0.25 });
			}
			// a covey of quail at the brush's edge, mornings and evenings
			else if (!S.ql.length && (E.chaparral > 0.2 || E.scrub > 0.2) && (about('california_quail', h, month) || (h > 16 && h < 19.5)) && rnd() < 0.45) {
				const n = 8 + Math.floor(rnd() * 8), yaw = rnd() * 6.28;
				for (let i = 0; i < n; i++) S.ql.push({ x: P.x + (rnd() - 0.5) * 6, z: P.z + (rnd() - 0.5) * 6, yaw: yaw + (rnd() - 0.5), ph: rnd() * 9, flee: 0, hide: 0, i });
			}
		}
		// close by: a lizard on the warm ground, slugs on the redwood floor, butterflies
		for (let k = 0; k < 16; k++) {
			const P = probe(4, 22), E = P.E;
			if (!E) continue;
			if (S.lz.length < 2 && E.redwood < 0.2 && (E.chaparral > 0.1 || E.wood > 0.2 || E.rockK > 0.2 || E.open > 0.5) && about('fence_lizard', h, month) && rnd() < 0.4) S.lz.push({ x: P.x, z: P.z, yaw: rnd() * 6.28, ph: rnd() * 9, dart: 0 });
			if (S.sl.length < 6 && E.redwood > 0.3 && (month >= 10 || month <= 5 || rnd() < 0.3)) S.sl.push({ x: P.x, z: P.z, yaw: rnd() * 6.28 });
		}
		const flies = FLIES.filter(([id]) => id === 'cabbage_white' ? month >= 3 && month <= 10 && h > 9 && h < 18 : about(id, h, month));
		if (flies.length) for (let k = 0; k < 20 && S.bf.length < (isPhone ? 5 : 9); k++) {
			const P = probe(3, 30), E = P.E;
			if (!E || E.redwood > 0.4) continue;
			if (rnd() > E.open * 0.6 + E.scrub * 0.8 + E.wood * 0.3) continue;
			const [, c] = flies[Math.floor(rnd() * flies.length)];
			S.bf.push({ x: P.x, z: P.z, cx: P.x, cz: P.z, y: 0.6 + rnd() * 1.2, ph: rnd() * 99, c, sp: 0.8 + rnd() * 0.8 });
		}
	}

	function update(dt, t, cam, h, month) {
		const px = cam.position.x, pz = cam.position.z;
		if (!at || Math.hypot(px - at.x, pz - at.z) > 120 || Math.abs(h - lastH) > 0.5) place(px, pz, h, month);
		// squirrels: sit up and look about; closer than 14 m, a dash for the burrow and gone
		let n = 0;
		for (const A of S.sq) {
			const d = Math.hypot(A.x - px, A.z - pz);
			if (d < 14 && !A.run && !A.gone) A.run = 1;
			if (A.run) {
				const dx = A.hx - A.x, dz = A.hz - A.z, l = Math.hypot(dx, dz);
				if (l < 0.3) { A.run = 0; A.gone = 25; } else { A.x += dx / l * 5 * dt; A.z += dz / l * 5 * dt; A.yaw = Math.atan2(dx, dz); }
			}
			if (A.gone > 0) { if (d > 30) A.gone -= dt; continue; }
			const up = A.run ? 0.55 : 0.8 + 0.25 * Math.max(0, Math.sin(t * 0.7 + A.ph));
			if (!A.run) A.yaw += Math.sin(t * 0.3 + A.ph) * dt * 0.8;
			e.set(A.run ? 1.1 : 0, A.yaw, 0); q.setFromEuler(e);
			sq.setMatrixAt(n++, m4.compose(p.set(A.x, g(A.x, A.z) + (A.run ? Math.abs(Math.sin(t * 16)) * 0.06 : 0), A.z), q, sc.set(1, up, 1)));
			if (n === 1 && d < 50 && seen(cam, A.x, g(A.x, A.z) + 0.2, A.z, 50)) spot('ground_squirrel');
		}
		sq.count = n; sq.instanceMatrix.needsUpdate = true;
		// turkeys: a slow walk, heads bobbing to peck; closer than 18 m they walk off, quicker
		n = 0;
		for (const A of S.tk) {
			const d = Math.hypot(A.x - px, A.z - pz);
			if (d < 18) { A.flee = 3; A.yaw += (Math.atan2(A.x - px, A.z - pz) - A.yaw) * Math.min(1, dt * 2); }
			const peck = Math.sin(t * 2.2 + A.ph) > 0.4 && !A.flee;
			const v = A.flee > 0 ? 2.2 : peck ? 0 : A.sp;
			A.flee = Math.max(0, A.flee - dt);
			A.x += Math.sin(A.yaw) * v * dt; A.z += Math.cos(A.yaw) * v * dt;
			if (!A.flee) A.yaw += Math.sin(t * 0.2 + A.ph) * dt * 0.4;
			e.set(peck ? 0.35 : 0, A.yaw, Math.sin(t * 6 + A.ph) * 0.03 * v); q.setFromEuler(e);
			tk.setMatrixAt(n++, m4.compose(p.set(A.x, g(A.x, A.z), A.z), q, s1));
			if (n === 1 && seen(cam, A.x, g(A.x, A.z) + 0.5, A.z, 70)) spot('wild_turkey');
		}
		tk.count = n; tk.instanceMatrix.needsUpdate = true;
		// quail: scratching about; closer than 12 m, the covey runs off in a line and is gone
		n = 0;
		for (const A of S.ql) {
			const d = Math.hypot(A.x - px, A.z - pz);
			if (d < 12 && !A.flee && !A.hide) { A.flee = 2.5 + A.i * 0.08; A.yaw = Math.atan2(A.x - px, A.z - pz) + (Math.random() - 0.5) * 0.3; }
			if (A.hide) { if (d > 40) A.hide = 0; continue; }
			if (A.flee > 0) { A.flee -= dt; A.x += Math.sin(A.yaw) * 4.5 * dt; A.z += Math.cos(A.yaw) * 4.5 * dt; if (A.flee <= 0) A.hide = 1; }
			else if (Math.sin(t * 1.3 + A.ph) > 0.6) { A.x += Math.sin(A.yaw) * 0.6 * dt; A.z += Math.cos(A.yaw) * 0.6 * dt; A.yaw += (Math.random() - 0.5) * dt * 3; }
			e.set(A.flee > 0 ? 0 : Math.max(0, Math.sin(t * 3 + A.ph)) * 0.4, A.yaw, 0); q.setFromEuler(e);
			ql.setMatrixAt(n++, m4.compose(p.set(A.x, g(A.x, A.z) + (A.flee > 0 ? Math.abs(Math.sin(t * 20 + A.i)) * 0.03 : 0), A.z), q, s1));
			if (n === 1 && seen(cam, A.x, g(A.x, A.z) + 0.1, A.z, 35)) spot('california_quail');
		}
		ql.count = n; ql.instanceMatrix.needsUpdate = true;
		// a fence lizard: push-ups in the sun, a dart away when you are nearly on it
		n = 0;
		for (const A of S.lz) {
			const d = Math.hypot(A.x - px, A.z - pz);
			if (d < 2.5 && A.dart <= 0) { A.dart = 0.6; A.yaw = Math.atan2(A.x - px, A.z - pz); }
			if (A.dart > 0) { A.dart -= dt; A.x += Math.sin(A.yaw) * 3 * dt; A.z += Math.cos(A.yaw) * 3 * dt; }
			const push = Math.max(0, Math.sin(t * 5 + A.ph)) * (Math.sin(t * 0.5 + A.ph) > 0.5 ? 0.012 : 0);
			q.setFromAxisAngle(p.set(0, 1, 0), A.yaw);
			lz.setMatrixAt(n++, m4.compose(p.set(A.x, g(A.x, A.z) + push, A.z), q, sc.set(1.4, 1.4, 1.4)));
			if (d < 8 && seen(cam, A.x, g(A.x, A.z), A.z, 8)) spot('fence_lizard');
		}
		lz.count = n; lz.instanceMatrix.needsUpdate = true;
		// banana slugs, creeping
		n = 0;
		for (const A of S.sl) {
			A.x += Math.sin(A.yaw) * 0.004 * dt; A.z += Math.cos(A.yaw) * 0.004 * dt;
			q.setFromAxisAngle(p.set(0, 1, 0), A.yaw);
			sl.setMatrixAt(n++, m4.compose(p.set(A.x, g(A.x, A.z), A.z), q, s1));
			if (Math.hypot(A.x - px, A.z - pz) < 6 && seen(cam, A.x, g(A.x, A.z), A.z, 6)) spot('banana_slug');
		}
		sl.count = n; sl.instanceMatrix.needsUpdate = true;
		// butterflies: a wandering, bobbing flight about a patch, wings flapping
		n = 0;
		for (const A of S.bf) {
			const u = t * A.sp + A.ph;
			const x = A.cx + Math.sin(u * 0.37) * 3 + Math.sin(u * 1.3) * 0.6, z = A.cz + Math.cos(u * 0.29) * 3 + Math.cos(u * 1.1) * 0.6;
			const y = g(x, z) + A.y + Math.sin(u * 2.3) * 0.25 + Math.sin(u * 7) * 0.05;
			const yaw = Math.atan2(Math.cos(u * 0.37) * 1.1 + Math.cos(u * 1.3) * 0.8, -Math.sin(u * 0.29) * 0.87 - Math.sin(u * 1.1) * 0.66);
			const flap = Math.sin(t * 22 + A.ph) * 1.1 + 0.3;
			q.setFromAxisAngle(p.set(0, 1, 0), yaw);
			m4.compose(p.set(x, y, z), q, sc.set(2.2, 2.2, 2.2));
			col.setRGB(A.c[0], A.c[1], A.c[2]);
			hinge.makeRotationZ(flap);
			wR.setMatrixAt(n, m4.clone().multiply(hinge)); wR.setColorAt(n, col);
			hinge.makeRotationZ(Math.PI - flap);
			wL.setMatrixAt(n, m4.clone().multiply(hinge)); wL.setColorAt(n, col);
			n++;
		}
		for (const w of [wL, wR]) { w.count = n; w.instanceMatrix.needsUpdate = true; if (w.instanceColor) w.instanceColor.needsUpdate = true; }
	}
	return { update, state: () => Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.length])) };
}
