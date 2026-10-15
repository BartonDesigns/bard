// The cranes. The all-terrain crane's upper works (crewtrucks.js has its carrier): the
// superstructure on its slewing ring, the operator's cab beside the boom's foot, the
// counterweight slabs behind, the hoist drum, a telescopic boom of four box sections narrowing
// to the head and its sheaves, raised on its luffing ram. The tower crane: a footing with its
// fixing angles, a lattice mast of square sections (corner chords, a zigzag of diagonals on every
// face, a ladder up inside), tied back to the building every 18 m when it stands tall; the
// slewing unit with the operator's cab, an A-frame tower head with pendants out to a
// triangular lattice jib and back to the counter-jib with its walkway, hoist and ballast and the
// company's banner on its rail; red aviation lights on the head, the jib's tip and the tail.
// The hook block hangs on two falls of cable from the boom's head or the trolley, and what it
// lifts hangs from it on slings; the cable is let out in the shader (crewkit's uStretch), so
// raising and lowering it costs nothing.

import * as THREE from 'three';
import { parts, COLORS as C, COMPANIES, rect } from './crewkit.js';
import { barsBundle, blocksPallet, glassFrame } from './crewtrucks.js';

// ---------- the all-terrain crane's upper works ----------
// a: the boom's angle up from level; len: its length. Returns the geometry and the head (local).
export const BOOM_FOOT = [0, 1.75, -0.9];
export function craneUpperGeo(coIndex, a, len, far = false) {
	const co = COMPANIES[coIndex % COMPANIES.length], paint = co.crane;
	const K = parts({ far }), V = K.at(0, 0, 0);
	// the superstructure, the cab, the counterweight, the hoist drum
	V.m('paint', 0.5);
	V.rbox(0, 0.32, -0.6, 2.5, 0.5, 5.0, paint, 0.06);
	V.rbox(-0.62, 1.0, -1.7, 1.2, 0.9, 2.2, paint, 0.06);
	V.m('plastic'); if (!far) for (let k = 0; k < 6; k++) V.mid(-1.23, 1.0, -2.4 + k * 0.28, 0.02, 0.6, 0.1, C.black);
	V.m('paint', 0.45); V.rbox(1.05, 1.32, 1.05, 0.9, 1.55, 1.9, paint, 0.08);
	V.m('glass');
	V.mid(1.05, 1.5, 2.01, 0.76, 1.1, 0.02, C.glass, 0, -0.14, 0);
	V.mid(1.51, 1.45, 1.05, 0.02, 1.0, 1.6, C.glass);
	V.mid(1.05, 2.1, 1.6, 0.7, 0.02, 0.7, C.glass, 0, -0.3, 0);
	V.m('worn', 0.8);
	for (let k = 0; k < 4; k++) V.rbox(0, 0.78 + k * 0.42, -3.05, 2.6, 0.38, 1.1, k % 2 ? [0.25, 0.26, 0.27] : C.dark, 0.04);
	V.m('paint', 0.4); V.rbox(0, 2.5, -3.05, 2.62, 0.08, 1.12, paint, 0.03);
	V.m('reflect'); for (let k = 0; k < 6; k++) V.mid(-1.25 + k * 0.5, 1.4, -3.61, 0.25, 0.25, 0.01, k % 2 ? C.white : C.red);
	V.m('worn'); V.cyl(0, 1.25, -1.6, 0.35, 1.2, 'x', C.dark, 14);
	V.m('steel', 0.6); if (!far) V.cyl(0, 1.25, -1.6, 0.37, 0.9, 'x', [0.3, 0.3, 0.32], 14);
	// the boom's foot, its sections narrowing, the head with its sheaves
	const ca = Math.cos(a), sa = Math.sin(a), [fx, fy, fz] = BOOM_FOOT;
	const along = (s, up = 0) => [fx, fy + sa * s + ca * up, fz + ca * s - sa * up];
	V.m('paint', 0.45);
	V.mid(fx, fy - 0.2, fz, 1.1, 0.8, 0.9, paint);
	const N = 4, over = 0.9;
	for (let k = 0; k < N; k++) {
		const L = len / N + over, s0 = k * len / N - (k ? over : 0), w = 0.95 - k * 0.12, h = 1.15 - k * 0.14, [x, y, z] = along(s0 + L / 2);
		V.m('paint', 0.4 + k * 0.05);
		V.rbox(x, y, z, w, h, L, paint, 0.08, 0, -a, 0);
		// (the edge of each section where the next comes out of it)
		if (!far && k) { V.m('worn'); const [x2, y2, z2] = along(s0 + 0.06); V.mid(x2, y2, z2, w + 0.06, h + 0.06, 0.1, C.dark, 0, -a, 0); }
	}
	V.m('decal'); { const [x, y, z] = along(len * 0.16); for (const s of [-1, 1]) V.decal(x + s * 0.49, y, z, Math.min(4.2, len * 0.2), 0.6, rect('boom' + (coIndex % 4)), paint, s * Math.PI / 2, 0, -s * a); }
	V.m('paint', 0.5);
	const head = along(len + 0.3);
	V.mid(head[0], head[1], head[2], 0.62, 0.7, 0.8, paint, 0, -a, 0);
	V.m('worn'); for (const o of [-0.16, 0.16]) V.cyl(head[0] + o, head[1] + 0.1, head[2] + 0.35, 0.32, 0.07, 'x', C.dark, 14);
	// the luffing ram: its barrel from the superstructure, its rod into the boom's underside
	const ramTop = along(len * 0.32, -0.58), ramFoot = [0, 0.6, 1.25];
	const mid = [(ramTop[0] + ramFoot[0]) / 2, (ramTop[1] + ramFoot[1]) / 2, (ramTop[2] + ramFoot[2]) / 2];
	V.m('paint', 0.5); V.tube(ramFoot, mid, 0.24, paint, 12);
	V.m('chrome'); V.tube(mid, ramTop, 0.14, C.chrome, 12);
	// the beacon on the cab's roof
	V.m('beacon'); V.cyl(1.05, 2.18, 0.6, 0.09, 0.12, 'y', C.amber, 10, 0.07);
	// the hoist rope up the boom from the drum to the head
	V.m('worn', 0); V.tube([0, 1.6, -1.6], [head[0], head[1] + 0.42, head[2] + 0.35], 0.018, C.dark, 4);
	return { geo: K.merge(), head: [head[0], head[1] + 0.1 - 0.32, head[2] + 0.35] };
}

// ---------- the hook block, its cable and what hangs from it ----------
// the block's top at y 0; the cable from there up 1 m, its top let out by uStretch; the load
// on slings below. what: 'bars', 'blocks', 'glass', 'skip', 'bucket' or ''. part 'load': the load
// alone, where it waits for the hook or was set down
const hookCache = new Map();
export function hookGeo(what = '', coIndex = 0, tower = false, far = false, part = 'all') {
	const key = what + ':' + coIndex + ':' + tower + ':' + far + ':' + part;
	if (hookCache.has(key)) return hookCache.get(key);
	const co = COMPANIES[coIndex % COMPANIES.length];
	const K = parts({ far }), V = K.at(0, 0, 0), all = part !== 'load';
	if (all) {
		// (two falls of rope, their tops let out)
		V.m('worn', 0);
		for (const o of [-0.1, 0.1]) { const g = V.tube([o, -0.05, 0], [o, 1, 0], 0.014, C.dark, 4); const p = g.attributes.position.array, x = g.attributes.aX.array; for (let i = 0; i < p.length / 3; i++) if (p[i * 3 + 1] > 0.5) x[i * 4 + 3] = 3; }
		// the block: its cheeks over the sheaves, the weight, the swivel and the hook
		V.m('paint', 0.6);
		V.rbox(0, -0.35, 0, 0.42, 0.7, 0.3, tower ? C.yellow : co.crane, 0.05);
		V.m('worn'); V.cyl(0, -0.2, 0, 0.17, 0.32, 'x', C.dark, 12);
		V.m('reflect'); if (!far) for (const s of [-1, 1]) V.mid(0, -0.45, s * 0.152, 0.38, 0.12, 0.005, C.red);
		V.m('steel', 0.4);
		V.cyl(0, -0.78, 0, 0.06, 0.16, 'y', C.steel, 8);
		const hook = new THREE.TorusGeometry(0.13, 0.035, far ? 4 : 6, far ? 8 : 14, Math.PI * 1.4);
		hook.rotateZ(-Math.PI * 0.2); hook.translate(0.0, -1.0, 0);
		V.geo(hook, C.steel);
		V.m('paint', 0.3); V.mid(0.11, -0.93, 0, 0.03, 0.08, 0.04, C.yellow);
	}
	// what it lifts, on four slings from the hook
	const top = -1.1, drop = 1.6;
	const slings = (pts) => { if (!all) return; V.m('plastic', 0.2); for (const p of pts) V.tube([0, top, 0], p, 0.012, [0.95, 0.75, 0.1], 3); };
	if (what === 'bars') { slings([[-0.18, top - drop, -1.8], [0.18, top - drop, 1.8]]); barsBundle(V, 0, top - drop - 0.25, 0, 0, 5.2); }
	else if (what === 'blocks') { const y = top - drop - 1.06; slings([[-0.55, y + 1.05, -0.5], [0.55, y + 1.05, -0.5], [-0.55, y + 1.05, 0.5], [0.55, y + 1.05, 0.5]]); blocksPallet(V, 0, y, 0, 0); }
	else if (what === 'glass') { const y = top - drop - 1.9; slings([[-0.5, y + 1.85, -1.4], [0.5, y + 1.85, 1.4]]); glassFrame(V, 0, y, 0, 0, 3.0); }
	else if (what === 'skip' || what === 'bucket') {
		// a concrete bucket while the frame rises, a skip of rubble while it is cleared
		const y = top - drop - 1.2;
		slings([[-0.5, y + 1.15, 0], [0.5, y + 1.15, 0]]);
		V.m('paintWorn', 0.9);
		if (what === 'bucket') { V.lathe([[0.12, 0], [0.3, 0.1], [0.62, 0.7], [0.65, 1.15], [0.6, 1.16]], 0, y, 0, 'y', [0.9, 0.55, 0.1], 14); V.m('worn'); V.mid(0, y + 1.18, 0, 1.36, 0.08, 0.08, C.dark); }
		else { V.mid(0, y + 0.5, 0, 1.4, 1.0, 1.9, C.yellow); V.m('rubble'); V.heap(0, y + 0.95, 0, 1.3, 1.8, 0.3, [C.rubble, C.concrete, [0.45, 0.42, 0.4]], 3, 6); }
	}
	const g = K.merge();
	g.userData.shared = true;
	hookCache.set(key, g);
	return g;
}
export const HOOK_DROP = { bars: 2.95, blocks: 3.76, glass: 4.6, skip: 3.9, bucket: 3.9, '': 1.1 };

// ---------- the tower crane ----------
// the mast: h high to its top (the slewing unit's seat), ties at the heights given, each a
// collar and two struts back to anchors on the facade (tie: [height, [ax, az], [bx, bz]] local)
export const MAST_W = 1.8;
export function towerMastGeo(h, ties = [], far = false) {
	const K = parts({ far }), V = K.at(0, 0, 0), w = MAST_W / 2;
	// the footing, its fixing angles, the base section
	V.m('concrete', 0.6); V.box(0, -0.4, 0, 5.2, 0.62, 5.2, C.concrete);
	V.m('worn', 0.8);
	for (const [a, b] of [[-w, -w], [w, -w], [w, w], [-w, w]]) { V.box(a, 0.2, b, 0.5, 0.06, 0.5, C.dark); V.box(a, 0.2, b, 0.24, 0.7, 0.24, C.dark); }
	// the chords up the corners, the diagonals' zigzag on each face, a strut at every panel
	V.m('paint', 0.45);
	for (const [a, b] of [[-w, -w], [w, -w], [w, w], [-w, w]]) V.box(a, 0.4, b, 0.13, h - 0.4, 0.13, C.yellow);
	const P = 2.0, face = [[[-w, -w], [w, -w]], [[w, -w], [w, w]], [[w, w], [-w, w]], [[-w, w], [-w, -w]]];
	for (let y = 0.4, k = 0; y < h - 0.5; y += P, k++) {
		const y1 = Math.min(h, y + P);
		for (const [[ax, az], [bx, bz]] of face) {
			V.bar([ax, y, az], [bx, y, bz], 0.04, C.yellow);
			if (!far || k % 2 === 0) { if (k % 2) V.bar([ax, y, az], [bx, y1, bz], 0.03, C.yellow); else V.bar([bx, y, bz], [ax, y1, az], 0.03, C.yellow); }
		}
		// (the ladder up inside, a landing every few sections)
		if (!far) { V.m('galv'); V.bar([w - 0.25, y, -w + 0.15], [w - 0.25, y1, -w + 0.15], 0.015, C.galv); V.bar([w - 0.65, y, -w + 0.15], [w - 0.65, y1, -w + 0.15], 0.015, C.galv); for (let r = 0.3; r < P; r += 0.3) V.bar([w - 0.65, y + r, -w + 0.15], [w - 0.25, y + r, -w + 0.15], 0.01, C.galv); if (k % 3 === 2) V.box(0.1, y1 - 0.04, 0.1, MAST_W - 0.3, 0.04, MAST_W - 0.3, C.galv); V.m('paint', 0.45); }
	}
	// the ties back to the building: a collar round the mast, two struts to the anchors
	V.m('paint', 0.5);
	for (const [y, A, B] of ties) {
		for (const [[ax, az], [bx, bz]] of face) V.bar([ax * 1.12, y, az * 1.12], [bx * 1.12, y, bz * 1.12], 0.07, C.yellow);
		const near = (p) => [[-w, -w], [w, -w], [w, w], [-w, w]].map(([a, b]) => [a * 1.12, b * 1.12]).sort((m, n) => Math.hypot(m[0] - p[0], m[1] - p[1]) - Math.hypot(n[0] - p[0], n[1] - p[1]))[0];
		for (const p of [A, B]) { const c = near(p); V.tube([c[0], y, c[1]], [p[0], y, p[1]], 0.07, C.yellow, 8); V.m('worn'); V.mid(p[0], y, p[1], 0.3, 0.45, 0.3, C.dark); V.m('paint', 0.5); }
	}
	return K.merge();
}
// the top: everything that slews, at the mast's top. R: the jib's reach; returns the geometry,
// the reach and where the lights are (for their glow)
export function towerJibGeo(R, coIndex, far = false) {
	const co = COMPANIES[coIndex % COMPANIES.length], jibC = co.crane;
	const K = parts({ far }), V = K.at(0, 0, 0), w = MAST_W / 2;
	// the slewing ring and its platform
	V.m('worn', 0.6); V.cyl(0, 0.25, 0, 1.25, 0.5, 'y', C.dark, 20);
	V.m('paint', 0.45); V.rbox(0, 0.85, 0, 2.6, 0.7, 2.6, jibC, 0.05);
	// the operator's cab on its side, glass to the front and under the feet
	V.rbox(1.75, 0.95, 1.1, 1.3, 2.0, 1.7, jibC, 0.08);
	V.m('glass');
	V.mid(1.75, 1.05, 1.96, 1.1, 1.6, 0.02, C.glass, 0, -0.1, 0);
	V.mid(2.41, 1.05, 1.1, 0.02, 1.4, 1.4, C.glass);
	V.mid(1.75, -0.06, 1.4, 1.0, 0.02, 0.8, C.glass);
	// the tower head: an A-frame of four legs to the apex
	V.m('paint', 0.45);
	const apex = [0, 7.5, 0];
	for (const [a, b] of [[-w, -w], [w, -w], [w, w], [-w, w]]) V.bar([a, 1.2, b], [a * 0.25, apex[1], b * 0.25], 0.08, jibC);
	for (let y = 2.5; y < apex[1] - 0.5; y += 1.8) { const k = 1 - (y - 1.2) / (apex[1] - 1.2) * 0.75; V.bar([-w * k, y, -w * k], [w * k, y, -w * k], 0.035, jibC); V.bar([-w * k, y, w * k], [w * k, y, w * k], 0.035, jibC); V.bar([-w * k, y, -w * k], [-w * k, y, w * k], 0.035, jibC); V.bar([w * k, y, -w * k], [w * k, y, w * k], 0.035, jibC); }
	// the jib: two bottom chords, one top chord, the diagonals between, tapering at the tip
	const jw = 0.8, jh = 1.55, bot = 1.2;
	const jib = (s) => { const t = Math.max(0, (s - (R - 6)) / 6); return { x: jw * (1 - t * 0.5), y: jh * (1 - t * 0.55) }; };
	for (const sd of [-1, 1]) V.bar([sd * jw, bot, w], [sd * jw * 0.5, bot, R], 0.06, jibC);
	V.bar([0, bot + jh, w], [0, bot + jh * 0.45, R], 0.06, jibC);
	const step = far ? 4 : 2;
	for (let s = w; s < R - 0.1; s += step) {
		const a = jib(s), b = jib(Math.min(R, s + step / 2)), c = jib(Math.min(R, s + step));
		for (const sd of [-1, 1]) { V.bar([sd * a.x, bot, s], [0, bot + b.y, s + step / 2], 0.028, jibC); V.bar([0, bot + b.y, s + step / 2], [sd * c.x, bot, Math.min(R, s + step)], 0.028, jibC); }
		V.bar([-a.x, bot, s], [a.x, bot, s], 0.028, jibC);
		if (!far) { V.m('galv'); V.mid(0, bot + 0.02, s + step / 2, a.x * 1.4, 0.02, step - 0.1, C.galv); V.m('paint', 0.45); }
	}
	V.mid(0, bot + 0.4, R, 0.5, 0.8, 0.3, jibC);
	// the counter-jib: its frame, the walkway and rails, the hoist and cabinet, the ballast
	const CL = Math.max(10, R * 0.34);
	for (const sd of [-1, 1]) V.bar([sd * 0.9, bot + 0.1, -w], [sd * 0.9, bot + 0.1, -CL], 0.09, jibC);
	for (let s = w + 1; s < CL; s += 2) V.bar([-0.9, bot + 0.1, -s], [0.9, bot + 0.1, -s], 0.04, jibC);
	V.m('galv'); V.mid(0, bot + 0.2, -CL / 2 - w / 2, 1.9, 0.03, CL - w, C.galv);
	for (const sd of [-1, 1]) { V.bar([sd * 1.0, bot + 1.25, -w], [sd * 1.0, bot + 1.25, -CL + 0.3], 0.02, C.galv); if (!far) for (let s = w + 1; s < CL; s += 2) V.bar([sd * 1.0, bot + 0.2, -s], [sd * 1.0, bot + 1.25, -s], 0.018, C.galv); }
	V.m('decal'); for (const sd of [-1, 1]) V.decal(sd * 1.02, bot + 0.75, -CL * 0.5, Math.min(7, CL * 0.55), 1.0, rect('cjib' + co.i), [0.9, 0.9, 0.9], sd * Math.PI / 2);
	V.m('paint', 0.5); V.rbox(0.3, bot + 0.75, -w - 2.4, 1.4, 1.1, 1.6, [0.82, 0.83, 0.8], 0.04);
	V.m('worn'); V.cyl(-0.35, bot + 0.75, -w - 2.4, 0.4, 1.0, 'x', C.dark, 12);
	V.m('concrete', 0.6);
	for (let k = 0; k < 4; k++) V.rbox(0, bot - 0.9, -CL + 0.6 + k * 0.62, 2.1, 2.2, 0.56, C.concrete, 0.03);
	// the pendants from the apex out to the jib and back to the tail
	V.m('worn', 0);
	V.tube(apex, [0, bot + jh, R * 0.45], 0.03, C.dark, 4); V.tube(apex, [0, bot + jh * 0.8, R * 0.8], 0.03, C.dark, 4);
	for (const sd of [-1, 1]) V.tube(apex, [sd * 0.9, bot + 0.3, -CL + 0.4], 0.03, C.dark, 4);
	// red lights on the apex, the jib's tip and the tail
	V.m('aviation');
	const lights = [[apex[0], apex[1] + 0.25, apex[2]], [0, bot + 0.95, R + 0.05], [0, bot + 1.35, -CL + 0.1]];
	for (const [x, y, z] of lights) V.cyl(x, y, z, 0.09, 0.16, 'y', [0.9, 0.08, 0.05], 10, 0.07);
	return { geo: K.merge(), R, CL, lights, bot };
}
// the trolley that runs out along the jib, the hook below it hangs on hookGeo
export function trolleyGeo(far = false) {
	const K = parts({ far }), V = K.at(0, 0, 0);
	V.m('paint', 0.5);
	V.rbox(0, -0.15, 0, 1.8, 0.3, 1.1, C.yellow, 0.04);
	V.m('worn'); for (const sd of [-1, 1]) for (const z of [-0.4, 0.4]) V.cyl(sd * 0.8, 0.05, z, 0.12, 0.1, 'x', C.dark, 10);
	V.m('worn'); for (const o of [-0.1, 0.1]) V.cyl(o, -0.35, 0, 0.16, 0.06, 'x', C.dark, 12);
	return K.merge();
}
