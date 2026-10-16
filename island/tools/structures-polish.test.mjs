// The buildings' polish: a wreck reads as one (slabs hanging off their bars, bars out of the
// breaks, rooms behind the holes, a heap of every size of block), a tower with one hole stays
// cheap, a rebuild goes frame then walls then glass, fresh wrecks burn, the landmarks take a
// beating without coming down (unless the world is ending); and the rebuild site: the crews'
// vehicles and cranes in proportion, the site laid out from its street, the trucks in along the
// road to the kerb and away again, the lifts, the scaffold rising and struck, the crew posed.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildShell, fireSpots, standingOf } from '../src/structures/shell.js';
import { truckGeo, TRUCKS } from '../src/structures/crewtrucks.js';
import { craneUpperGeo, hookGeo, HOOK_DROP, towerMastGeo, towerJibGeo } from '../src/structures/crewcranes.js';
import { createCrew, toolOf } from '../src/structures/crewfolk.js';
import { siteFrame, findKerb, roadAt, planSite, workHeights, drivePath, pathAt, speedAt, liftAt } from '../src/structures/crewplan.js';
import { createRebuild, stageTrucks } from '../src/structures/rebuild.js';
import { bid } from '../src/structures/ids.js';
import { createMonuments } from '../src/structures/monuments.js';
import { landmarkRects } from '../src/bay/footprints.js';

const original = globalThis.localStorage;
afterEach(() => { if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original; });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const lot = (o = {}) => ({ x: 100, z: 50, w: 28, d: 36, h: 21.2, a: 0.3, y: -1.2, kind: 3, col: [0.7, 0.68, 0.64], roof: null, ...o });
const finite = (g) => g.attributes.position.array.every(Number.isFinite);

test('a partial collapse: slabs hang off their bars, bars stand out of the breaks, the heap is blocks of every size', () => {
	const o = lot(), rec = { m: [[0, 0, 4, 3], [2, 0, 4, 3]], c: 0.5, s: 4321, hp: 0.3, cause: 'blast' };
	const B = buildShell(o, rec);
	assert.ok(B.hangs > 4, `pieces of slab hanging (${B.hangs})`);
	assert.ok(B.rebars > 40, `rebar showing (${B.rebars})`);
	assert.ok(B.blocks > 30, `a heap of blocks (${B.blocks})`);
	assert.ok(finite(B.geo) && B.geo.attributes.aFac.count === B.verts, 'every vertex has its facade');
	// (the heap spills further the way it fell: the low side of the slant)
	const S = standingOf(o, rec), lo = [-S.dx * (o.w / 2 + 3), -S.dz * (o.d / 2 + 3)], hi = [S.dx * (o.w / 2 + 3), S.dz * (o.d / 2 + 3)];
	assert.ok(B.rubble(lo[0], lo[1]) > B.rubble(hi[0], hi[1]), 'the mound leans the way it fell');
});

test('a tower with one small hole is cheap: the whole walls are big quads, the windows drawn by the material', () => {
	const o = lot({ w: 42, d: 34, h: 117.2, kind: 2 });
	const B = buildShell(o, { m: [[3, 0, 0.9, 0.46]], c: 0, s: 1234, hp: 0.98 });
	assert.ok(B.verts < 20000, `vertices ${B.verts}`);
	const win = [...new Set(Array.from(B.geo.attributes.aFac.array.filter((v, i) => i % 4 === 0)))];
	assert.ok(win.includes(3), 'its curtain wall drawn as such');
	const lite = buildShell(lot(), { m: [[0, 0, 4, 3]], c: 0.5, s: 4321, hp: 0.3 }, null, { lite: true }), full = buildShell(lot(), { m: [[0, 0, 4, 3]], c: 0.5, s: 4321, hp: 0.3 });
	assert.ok(lite.verts < full.verts, 'a phone draws less of it');
});

test('a rebuild: the rubble cleared, the frame up ahead of the walls, glazed from the ground up, whole at the end', () => {
	const o = lot(), rec = { m: [[0, 0, 4, 3]], c: 0.93, s: 999, hp: 0.1 }, H = o.h - 1.2;
	const at = (p) => buildShell(o, rec, p);
	assert.ok(at(null).rubble(0, 0) > 0.5 && at(0.2).rubble(0, 0) === 0, 'cleared by a fifth of the way');
	const mid = at(0.5), late = at(0.8);
	assert.ok(mid.standing(0, o.d / 2) < late.standing(0, o.d / 2), 'the walls rise');
	const glazed = (B) => { const f = B.geo.attributes.aFac.array; let g = 0, raw = 0; for (let i = 0; i < f.length; i += 4) if (f[i] > 0) { if (f[i + 3] === 0) g++; else if (f[i + 3] === 2) raw++; } return { g, raw }; };
	assert.ok(glazed(mid).raw > 0, 'bare openings in the new work');
	assert.equal(at(1).standing(0, o.d / 2), H);
	assert.equal(glazed(at(1)).raw, 0, 'all glazed at the end');
});

test('a fresh wreck burns: most of a blast\'s holes and a collapse\'s broken storeys', () => {
	const o = lot();
	assert.ok(fireSpots(o, { m: [[0, 0, 4, 3], [1, 2, 2, 2], [2, 1, 6, 2]], c: 0, s: 7, cause: 'blast' }).length >= 1);
	assert.equal(fireSpots(o, { m: [], c: 0, s: 7 }).length, 0, 'nothing broken, nothing burning');
	const down = fireSpots(o, { m: [], c: 0.93, s: 7 });
	assert.ok(down.length >= 3 && down.every((f) => f.every(Number.isFinite)));
});

test('the crews\' vehicles: in proportion, near and far, wheels and the drum turning in the shader, the company\'s name on the doors', () => {
	for (const kind of ['dump', 'mixer', 'flat', 'van', 'carrier']) {
		const near = truckGeo(kind, 1, kind === 'dump' ? 'full' : kind === 'flat' ? 'blocks' : ''), far = truckGeo(kind, 1, kind === 'dump' ? 'full' : kind === 'flat' ? 'blocks' : '', true);
		assert.ok(finite(near) && finite(far), kind);
		assert.ok(near.attributes.position.count / 3 < 12000, `${kind}: ${near.attributes.position.count / 3} triangles near`);
		const x = near.attributes.aX.array, m = near.attributes.aMat.array, kinds = new Set(), mats = new Set();
		for (let i = 0; i < x.length; i += 4) kinds.add(Math.round(x[i + 3]));
		for (let i = 0; i < m.length; i += 4) mats.add(Math.round(m[i + 2]));
		assert.ok(kinds.has(1), `${kind}: wheels that turn`);
		assert.ok(mats.has(8) && mats.has(1) && mats.has(9), `${kind}: a decal, glass and rubber`);
		if (kind !== 'van' && kind !== 'carrier') assert.ok(mats.has(3), `${kind}: a beacon`);
		// (the wheels stand on the ground: the lowest point of the truck is its tyres' contact)
		near.computeBoundingBox();
		assert.ok(Math.abs(near.boundingBox.min.y - (kind === 'carrier' ? -0.06 : 0)) < 0.03, `${kind}: on the ground (${near.boundingBox.min.y.toFixed(3)})`);
		assert.ok(near.boundingBox.max.z - near.boundingBox.min.z < TRUCKS[kind].L + 0.4 && near.boundingBox.max.x - near.boundingBox.min.x < (kind === 'carrier' ? 6.8 : 3.2), `${kind}: its size`);
	}
	const mx = truckGeo('mixer', 2), x = mx.attributes.aX.array;
	let drum = 0;
	for (let i = 0; i < x.length; i += 4) if (Math.round(x[i + 3]) === 2) drum++;
	assert.ok(drum > 100, 'the mixer\'s drum turns on its own axis');
	assert.equal(truckGeo('mixer', 2), mx, 'built once and shared');
});

test('the cranes: the boom up with its head over the work, the hook\'s cable let out, the tower crane\'s lattice, ties and lights', () => {
	const up = craneUpperGeo(1, 0.9, 26);
	assert.ok(up.head[1] > 20 && finite(up.geo), 'the boom up, its head high');
	assert.ok(craneUpperGeo(1, 0.9, 26, true).geo.attributes.position.count < up.geo.attributes.position.count / 2, 'a far one');
	for (const what of ['', 'bars', 'blocks', 'glass', 'skip', 'bucket']) {
		const g = hookGeo(what, 1), p = g.attributes.position.array, x = g.attributes.aX.array;
		let top = 0;
		for (let i = 0; i < x.length; i += 4) if (Math.round(x[i + 3]) === 3) { top++; assert.ok(p[(i / 4) * 3 + 1] > 0.5, 'only the cable\'s top is let out'); }
		assert.ok(top >= 8, `the hook's cable (${what})`);
		g.computeBoundingBox();
		assert.ok(g.boundingBox.min.y > -(HOOK_DROP[what] + 2.2), `what hangs from it hangs below it (${what})`);
	}
	const mast = towerMastGeo(46, [[16, [3, 0], [3, 3]], [34, [3, 0], [3, 3]]]);
	assert.ok(finite(mast) && mast.attributes.position.count > 3000, 'a lattice mast with its ties');
	const J = towerJibGeo(40, 0);
	assert.equal(J.lights.length, 3, 'red lights on the head, the tip and the tail');
	assert.ok(J.CL >= 10 && J.R === 40);
});

test('the site\'s plan: the kerb from the road, a pavement kept or taken, the neighbours respected, nothing on anything else', () => {
	const o = lot({ x: 0, z: 0, a: 0, w: 26, d: 20, h: 23.2, y: -1.2 }), G = siteFrame(o, 0);
	const road = (z, w = 10) => [{ drive: true, w, pts: [-300, z, 300, z] }];
	const K = findKerb(G, road(10 + 6 + 5));
	assert.ok(K.real && Math.abs(K.kerbV - 6) < 1e-6, 'the kerb six metres out');
	// (the near lane runs with the kerb on its right: its right is toward the building)
	const q = roadAt(K, 0, K.hw - 1.45);
	assert.ok(Math.abs(q[1] - 17.45) < 1e-6, 'a truck\'s middle a little out from the kerb');
	const KG = findKerb(G, [], 26);
	assert.ok(!KG.real && Math.abs(KG.kerbV - 6) < 1e-6 && KG.hw === 7, 'no surveyed road: the street down the middle of the gap to the buildings across');
	const right = [-q[3], q[2]];
	assert.ok(right[1] < 0, 'the building on the near lane\'s right');
	const open = planSite(o, G, K, () => false, {});
	assert.ok(open.fenceV <= K.kerbV - 1.7 && open.fenceV >= 2.3, `a pavement kept (${open.fenceV})`);
	assert.ok(open.faces.every(Boolean), 'scaffolding on every face');
	const narrow = planSite(o, G, findKerb(G, road(10 + 2.6 + 5)), () => false, {});
	assert.ok(narrow.fenceV > narrow.kerbV - 0.5 && narrow.fenceV < narrow.kerbV, 'a narrow pavement taken up to the kerb');
	// a neighbour hard against the right: no return there, no scaffold on that face
	const tight = planSite(o, G, K, (x) => x > 13.6, {});
	assert.ok(!tight.faces[2] && tight.uR < 13 + 1.25, 'the right side shut in');
	// nothing stands on anything else, on the scaffold, in the gate or out past the fence
	for (let s = 0; s < 4; s++) {
		const things = [...open.stages[s].map((t) => ({ ...t, w: 1, d: 1 })), ...[open.fixed.cabin, open.fixed.loo, ...open.fixed.lights].filter(Boolean)];
		for (const t of things) {
			assert.ok(t.v < open.fenceV && t.u > open.uL && t.u < open.uR, `${t.what || t.who} inside the fence`);
			assert.ok(!(t.v < open.scafV && Math.abs(t.u) < open.L / 2 + 1.6), `${t.what || t.who} off the scaffold`);
			assert.ok(Math.abs(t.u - open.gateU) > 1.5 || t.v < open.scafV, `${t.what || t.who} clear of the gate`);
		}
	}
	assert.ok(open.stages[0].some((t) => t.what === 'box') && open.stages[2].filter((t) => t.what === 'blocks').length === 3, 'what each stage brings');
	// a tower crane in a side yard, tied to the building, no scaffold on that side
	const tall = lot({ x: 0, z: 0, a: 0, w: 26, d: 20, h: 41.2, y: -1.2 }), GT = siteFrame(tall, 0), T = planSite(tall, GT, K, (x) => Math.abs(x) > 19, { tower: true });
	assert.ok(T.crane && !T.crane.inside && Math.abs(T.crane.u) > 13 + 2.6, 'the tower crane beside the building');
	assert.ok(!T.faces[T.crane.u > 0 ? 2 : 3], 'that side left without scaffolding');
});

test('the trucks: in along the road, pulled in at the kerb on its right side, backing in beeping, out and away', () => {
	const o = lot({ x: 0, z: 0, a: 0, w: 26, d: 20, h: 23.2, y: -1.2 }), G = siteFrame(o, 0), K = findKerb(G, [{ drive: true, w: 10, pts: [-300, 21, 300, 21] }]);
	const end = roadAt(K, -1.5, K.hw - 1.45), out = [0, 0, 0, 1, 0];
	for (const mode of ['in', 'back']) {
		const P = drivePath(K, -1.5, mode, 9.7);
		pathAt(P, P.length, out);
		assert.ok(Math.hypot(out[0] - end[0], out[1] - end[1]) < 0.05, `${mode}: it stops in its place`);
		assert.ok(Math.abs(out[2] - end[2]) < 0.05 && Math.abs(out[3] - end[3]) < 0.05, `${mode}: facing the near lane's way`);
		// (always on the road: between its middle and the kerb)
		for (let d = 0; d <= P.length; d += 2) { pathAt(P, d, out); assert.ok(out[1] > 16 && out[1] < 21.5, `${mode}: on the road at ${d.toFixed(0)} (${out[1].toFixed(2)})`); }
		assert.ok(speedAt(P, P.length - 0.01) < 1 && speedAt(P, P.length / 2) > 1, `${mode}: slowing to a stop`);
	}
	const B = drivePath(K, -1.5, 'back', 9.7);
	pathAt(B, B.length - 1, out);
	assert.equal(out[4], 1, 'backing in at the end');
	const O = drivePath(K, -1.5, 'out', 9.7);
	pathAt(O, 0, out);
	assert.ok(Math.hypot(out[0] - end[0], out[1] - end[1]) < 0.05, 'driving off from its place');
	pathAt(O, O.length, out);
	assert.ok(Math.hypot(out[0] - end[0], out[1] - end[1]) > 60, 'and away along the road');
});

test('the lift: picked up, slewed round, set down, back again; the scaffold rises with the work and comes down at the end', () => {
	const c = { a0: 0, a1: 2, r0: 20, r1: 20, y0: 3, y1: 25, top: 29, slew: 0.1, hoist: 0.8 }, st = { a: 0, r: 0, y: 0, loaded: false, phase: 0, moving: false };
	let loadedUp = 0, maxY = 0, prevA = null, jump = 0;
	for (let t = 0; t < 200; t += 0.25) {
		liftAt(c, t, st);
		if (st.loaded && st.y > 20) loadedUp++;
		maxY = Math.max(maxY, st.y);
		if (prevA != null) jump = Math.max(jump, Math.abs(st.a - prevA));
		prevA = st.a;
		assert.ok(st.y >= Math.min(c.y0, c.y1) - 1e-6 && st.y <= c.top + 1e-6);
	}
	assert.ok(loadedUp > 10 && Math.abs(maxY - c.top) < 1e-6, 'the load lifted up to the top');
	assert.ok(jump < 0.06, 'it slews smoothly');
	let prev = 0;
	for (const p of [0.13, 0.16, 0.2, 0.3, 0.45, 0.6, 0.7]) { const h = workHeights(p, 22).scaf; assert.ok(h >= prev - 1e-6, `rising at ${p}`); prev = h; }
	assert.equal(workHeights(0.1, 22).scaf, 0); assert.equal(workHeights(0.99, 22).scaf, 0);
	assert.ok(workHeights(0.94, 22).scaf < workHeights(0.91, 22).scaf, 'struck from the top');
});

test('the crew: one instanced figure for every worker, posed in the shader, each task with its tool', () => {
	const scene = new THREE.Scene(), crew = createCrew(scene, 8);
	crew.begin();
	for (const pose of ['walk', 'hammer', 'shovel', 'carry', 'shoulder', 'guide', 'pour', 'lay']) crew.set(0, 0, 0, 0, pose, 1.3, 7);
	crew.end();
	assert.equal(crew.count(), 8);
	assert.equal(crew.mesh.count, 8);
	assert.ok(crew.verts / 3 < 2000, `a figure of ${crew.verts / 3} triangles`);
	const pose = crew.mesh.geometry.attributes.iPose;
	assert.equal(pose.getW(1), toolOf('hammer')); assert.equal(pose.getW(2), toolOf('shovel')); assert.equal(pose.getW(3), toolOf('carry'));
	assert.ok(scene.children.filter((m) => m.isInstancedMesh).length === 1, 'one draw for the lot');
	assert.equal(stageTrucks(1, false, false)[0][0], 'mixer');
	assert.equal(stageTrucks(3, true, false)[0][0], 'van');
});

test('a site in a scene: laid out from its street, the trucks parked on the road at the kerb, the crew inside the fence, a few draws', () => {
	globalThis.localStorage = memory();
	const o = lot({ x: 0, z: 0, a: 0, w: 26, d: 20, h: 23.2, y: -1.2, kind: 3 }), id = bid(o);
	let now = 0;
	const recs = new Map([[id, { x: 0, z: 0, m: [[0, 0, 4, 3]], c: 0.6, s: 4321, hp: 0.3, r0: 0, rd: 4, t0: -1 }]]);
	const store = { now: () => now, each: (f) => { for (const [k, v] of recs) f(k, v); }, records: (f) => { for (const v of recs.values()) f(v); }, put: (k, r) => recs.set(k, r), drop: () => {}, touch: () => {} };
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	camera.position.set(30, 10, 40);
	const road = { drive: true, w: 10, pts: [-300, 21, 300, 21] };
	const R = createRebuild({ scene, isPhone: false, store, sounds: { beep() {}, hammer() {}, grind() {} }, camera, city: () => ({ lotsNear: () => [o] }), real: () => ({ near: () => [road] }), frontOf: () => 0, ground: (x, z) => (z > 16 ? 0 : 0.12), repaired() {} });
	for (const p of [0.05, 0.3, 0.6, 0.85]) {
		now = p * 4;
		for (let i = 0; i < 400; i++) R.update(camera, 0.25, 0);
		const I = R.info()[0];
		assert.ok(I.here && I.company && I.kerbReal, `the site at ${p}`);
		assert.ok(I.trucks.length >= 1 && I.trucks.every((t) => t.endsWith('@park')), `parked at ${p}: ${I.trucks}`);
		assert.ok(I.cost.draws <= 12, `${I.cost.draws} draws at ${p}`);
		const S = [...R.sites.values()][0];
		for (const v of S.vehicles) assert.ok(v.z > 16.05 && v.z < 21, `a truck on the road at the kerb (${v.z.toFixed(2)})`);
		// (the crew inside the fence or on the pavement, never in the road)
		const M = new THREE.Matrix4(), P3 = new THREE.Vector3();
		for (let k = 0; k < R.crew.count(); k++) { R.crew.mesh.getMatrixAt(k, M); P3.setFromMatrixPosition(M); assert.ok(P3.z < 16, `a worker off the road (${P3.z.toFixed(2)})`); }
	}
	assert.ok(R.anchors().some((a) => a.kind === 'banner') && R.anchors().some((a) => a.kind === 'livery'), 'surfaces left for the signage');
	// the work done in view: the trucks drive off and the rest fades before the site is gone
	recs.clear();
	for (let i = 0; i < 4; i++) R.update(camera, 0.25, 0);
	const S = R.sites.get(id);
	assert.ok(S && S.leaving && S.vehicles.every((v) => v.state === 'out'), 'packing up');
	for (let i = 0; i < 400; i++) R.update(camera, 0.25, 0);
	assert.equal(R.sites.size, 0, 'gone once the trucks are away');
});

test('the landmarks: scorched and chipped but standing; in a cataclysm, down', () => {
	globalThis.localStorage = memory();
	let wild = false, now = 0;
	const stub = { chunk() {}, puff() {}, haze() {} };
	const ctx = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), debris: stub, sounds: { crumble() {}, collapse() {} }, marks: null, isPhone: false, store: { now: () => now }, ground: () => 0, landmarks: () => null, cataclysm: () => wild, shake() {} };
	const M = createMonuments(ctx);
	const L = { ...landmarkRects[2], i: 2, top: 40 };
	for (let i = 0; i < 200; i++) M.strike(L, { x: L.x, y: 5, z: L.z }, { x: 1, y: 0, z: 0 }, 260, 'blast');
	let s = M.state(L.x, L.z);
	assert.ok(s.hp >= 0.5 && !s.cut, `standing (hp ${s.hp})`);
	assert.ok(s.mk.length > 0 && s.mk.length <= 32, 'the scorch marks kept, a few dozen at most');
	wild = true;
	for (let i = 0; i < 60 && !M.state(L.x, L.z).cut; i++) M.strike(L, { x: L.x, y: 5, z: L.z }, { x: 1, y: 0, z: 0 }, 260, 'blast');
	s = M.state(L.x, L.z);
	assert.ok(s.cut > 0, 'brought down with the world ending');
	assert.equal(M.info().fallen, 1, 'its stubs and mound shown');
});
