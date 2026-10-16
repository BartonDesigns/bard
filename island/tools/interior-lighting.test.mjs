// The interiors' baked light (src/interiors/lightbake.js, lighting.js): falloff from a
// fixture, a wall's shadow, the sky through an opening, the same answer every time, the
// geometry cut finer without changing its shape, and every interior builder handing its
// rooms to the shared lighting.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bake, tessellate, castRay, occluderGrid, fixtureSamples, findPieces, pieceFixture } from '../src/interiors/lightbake.js';

// a floor of points along x at y = 0, facing up
function strip(xs, z = 0, y = 0) {
	const P = new Float32Array(xs.length * 3), N = new Float32Array(xs.length * 3);
	xs.forEach((x, i) => { P.set([x, y, z], i * 3); N.set([0, 1, 0], i * 3); });
	return { P, N, C: null, count: xs.length };
}
const run = (gen) => { let r = gen.next(); while (!r.done) r = gen.next(); return r.value; };
const lamp = (x, y, z, I = 10) => ({ p: [x, y, z], c: [1, 1, 1], I, shape: 'point' });

test('light falls off with the square of the distance and the cosine', () => {
	const m = strip([0, 1, 2, 4]);
	const [R] = run(bake([m], { fixtures: [lamp(0, 2, 0)], boxes: [], sky: false }));
	const E = [0, 1, 2, 3].map((i) => R.light[i * 4]);
	// straight under: I / d^2 (a little softened)
	assert.ok(Math.abs(E[0] - 10 / (1.97 * 1.97 + 0.06)) < 0.01, 'under the lamp ' + E[0]);
	for (let i = 1; i < 4; i++) assert.ok(E[i] < E[i - 1], 'darker further out');
	// at x = 2: d^2 = 8, cos = 2 / sqrt(8)
	const want = 10 * (1.97 / Math.sqrt(4 + 1.97 * 1.97)) / (4 + 1.97 * 1.97 + 0.06);
	assert.ok(Math.abs(E[2] - want) / want < 0.05, `x=2 ${E[2]} vs ${want}`);
	// most of it from above
	assert.ok(R.dir[1] > 0.99 && R.dir[3] > 0.99, 'the light comes from overhead');
});

test('a wall between the lamp and the floor shades it', () => {
	const m = strip([-2, 2]);
	const wall = [-0.1, -5, 0.1, 5, 0, 3];
	const [open] = run(bake([m], { fixtures: [lamp(-1, 2.5, 0)], boxes: [], sky: false }));
	const [shut] = run(bake([m], { fixtures: [lamp(-1, 2.5, 0)], boxes: [wall], sky: false }));
	assert.ok(open.light[4] > 0.3, 'lit with no wall');
	assert.equal(shut.light[4], 0, 'dark behind the wall');
	assert.ok(Math.abs(shut.light[0] - open.light[0]) < 1e-6, 'the near side unchanged');
});

test('the sky reaches a floor under an opening, not one under a roof', () => {
	const m = strip([0, 8]);
	// a closed room over x < 4, a yard beyond it
	const room = [[-4, -4, 4, 4, 3, 3.2], [-4.2, -4, -4, 4, 0, 3], [4, -4, 4.2, 4, 0, 3], [-4, -4.2, 4, -4, 0, 3], [-4, 4, 4, 4.2, 0, 3]];
	const [R] = run(bake([m], { fixtures: [], boxes: room, bounds: [-5, -5, 12, 5], rays: 16 }));
	assert.ok(R.light[3] < 0.01, 'under the roof: no sky ' + R.light[3]);
	assert.ok(R.light[7] > 0.75, 'in the open: most of the sky ' + R.light[7]);
	// a window in the room's wall lets some in
	const holed = [room[0], room[1], [4, -4, 4.2, -0.6, 0, 3], [4, 0.6, 4.2, 4, 0, 3], [4, -0.6, 4.2, 0.6, 0, 0.8], [4, -0.6, 4.2, 0.6, 2.2, 3], room[3], room[4]];
	const [W] = run(bake([strip([3.5])], { fixtures: [], boxes: holed, bounds: [-5, -5, 12, 5], rays: 24 }));
	assert.ok(W.light[3] > 0.02, 'by the window: some sky ' + W.light[3]);
});

test('the bake gives the same numbers every time', () => {
	const mk = () => strip([0, 0.5, 1, 1.5, 2, 3, 5], 0.3);
	const ctx = () => ({ fixtures: [lamp(0, 2.6, 0, 14), { p: [3, 2.6, 0], c: [1, 0.8, 0.6], I: 20, shape: 'tube', axis: [1, 0, 0], len: 1.2 }], boxes: [[1.2, -1, 1.4, 1, 0, 0.8]], bounds: [-6, -6, 6, 6], slabs: [[0, 2.7]], rays: 8 });
	const a = run(bake([mk()], ctx())), b = run(bake([mk()], ctx()));
	assert.deepEqual([...a[0].light], [...b[0].light]);
	assert.deepEqual([...a[0].dir], [...b[0].dir]);
});

test('the bake yields to the frame when its time is up', () => {
	const xs = Array.from({ length: 400 }, (_, i) => i * 0.05);
	const gen = bake([strip(xs)], { fixtures: [lamp(5, 2.5, 0)], boxes: [], rays: 6, bounds: [-1, -5, 25, 5], slabs: [[0, 2.7]] }, () => true);
	let n = 0, r = gen.next();
	while (!r.done) { n++; r = gen.next(); }
	assert.ok(n > 5, 'sliced ' + n);
});

test('the bounce lifts a room the fixtures do not reach straight', () => {
	// a floor point hidden from the lamp by a low box, in the same room as a lit one
	const m = strip([0, 3]);
	const ctx = (rooms) => ({ fixtures: [lamp(0, 2.5, 0)], boxes: [[2.4, -1, 3.6, 1, 0.2, 0.4]], sky: false, rooms, roomOf: () => 0 });
	const [one] = run(bake([m], ctx(1)));
	const [none] = run(bake([m], { ...ctx(1), roomOf: () => -1 }));
	assert.equal(none.light[4], 0);
	assert.ok(one.light[4] > 0.05, 'some light comes back ' + one.light[4]);
});

test('a ray finds the nearest box and leaves the grid clean', () => {
	const G = occluderGrid([[2, -1, 3, 1, 0, 3], [5, -1, 6, 1, 0, 3]], [-10, -10, 10, 10]);
	assert.ok(Math.abs(castRay(G, 0, 1, 0, 1, 0, 0, 20, false) - 2) < 1e-6);
	assert.equal(castRay(G, 0, 1, 0, -1, 0, 0, 20, false), -1);
	assert.equal(castRay(G, 0, 4, 0, 1, 0, 0, 20, false), -1, 'over the boxes');
});

test('cutting finer keeps the shape and every attribute', () => {
	// a 6 by 4 quad as two triangles, the way the builder lays them (a b c, a c d)
	const q = [[0, 0, 0], [6, 0, 0], [6, 0, 4], [0, 0, 4]], order = [0, 1, 2, 0, 2, 3];
	const P = new Float32Array(order.flatMap((i) => q[i])), N = new Float32Array(order.flatMap(() => [0, 1, 0])), U = new Float32Array(order.flatMap((i) => [q[i][0], q[i][2]]));
	const T = tessellate({ position: { array: P, size: 3 }, normal: { array: N, size: 3 }, uv: { array: U, size: 2 } }, 6, 1);
	assert.equal(T.count, 6 * 4 * 6, 'a 6 by 4 grid of quads');
	let area = 0;
	const A = T.attrs.position.array;
	for (let a = 0; a < T.count; a += 3) {
		const e1 = [A[a * 3 + 3] - A[a * 3], A[a * 3 + 5] - A[a * 3 + 2]], e2 = [A[a * 3 + 6] - A[a * 3], A[a * 3 + 8] - A[a * 3 + 2]];
		area += Math.abs(e1[0] * e2[1] - e1[1] * e2[0]) / 2;
	}
	assert.ok(Math.abs(area - 24) < 1e-4);
	// the uvs still the positions (they were in metres)
	for (let v = 0; v < T.count; v++) { assert.ok(Math.abs(T.attrs.uv.array[v * 2] - A[v * 3]) < 1e-5); assert.ok(Math.abs(T.attrs.uv.array[v * 2 + 1] - A[v * 3 + 2]) < 1e-5); }
	// wound as before: every triangle turned the same way as the two it came from
	const wind = (X, a) => (X[a * 3 + 5] - X[a * 3 + 2]) * (X[a * 3 + 6] - X[a * 3]) - (X[a * 3 + 3] - X[a * 3]) * (X[a * 3 + 8] - X[a * 3 + 2]);
	const was = Math.sign(wind(P, 0));
	for (let a = 0; a < T.count; a += 3) assert.equal(Math.sign(wind(A, a)), was, 'wound as before');
});

test('lamp geometry becomes fixtures of the right shape', () => {
	// a box's triangles
	const box = (x0, y0, z0, x1, y1, z1) => {
		const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
		const f = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
		return f.flatMap(([a, b, cc, d]) => [a, b, cc, a, cc, d].flatMap((i) => c[i]));
	};
	const P = new Float32Array([...box(-0.6, 2.68, -0.08, 0.6, 2.7, 0.08), ...box(2, 2.66, 2, 2.6, 2.7, 2.6), ...box(-3, 1, 1, -2.98, 1.5, 1.8), ...box(4, 0.8, 4, 4.3, 1.1, 4.3)]);
	const pieces = findPieces([{ P, C: null, count: P.length / 3 }]);
	assert.equal(pieces.length, 4);
	const F = pieces.map((pc) => pieceFixture(pc, { ceilings: [[0, 2.7]], centre: [0, 0] }));
	assert.deepEqual(F.map((f) => f.shape), ['tube', 'panel', 'panel', 'point']);
	assert.deepEqual(F[2].n, [1, 0, 0], 'the screen faces into the room');
	assert.ok(F[0].p[1] < 2.68 && F[1].n[1] === -1, 'the ceiling lights face down');
	assert.ok(fixtureSamples(F[0]).length >= 2 && fixtureSamples(F[1]).length === 4);
});

// every builder of rooms, anywhere, hands them to the shared lighting
test('every interior builder registers its rooms and fixtures with the lighting', () => {
	const src = new URL('../src/', import.meta.url);
	const builders = ['interiors/index.js', 'interiors/cottage.js', 'interiors/medieval.js', 'interiors/alien.js', 'bay/houses.js', 'bay/commercial.js', 'bay/towers.js', 'planet/colony/interiors.js', 'planet/arch/interiors.js'];
	for (const f of builders) {
		const text = fs.readFileSync(new URL(f, src), 'utf8');
		assert.match(text, /from '[./]*(interiors\/)?lighting\.js'/, f + ' imports the lighting');
		assert.match(text, /lightInterior\(/, f + ' lights its rooms');
	}
	// the services and landmarks are built by interiors/index.js (addSite) and so lit there
	const idx = fs.readFileSync(new URL('interiors/index.js', src), 'utf8');
	assert.match(idx, /lightInterior\([^)]*Lb\.root/, 'each full level of a planned building');
	// and no builder keeps a lamp of its own following you about
	for (const f of ['interiors/index.js', 'bay/houses.js']) assert.doesNotMatch(fs.readFileSync(new URL(f, src), 'utf8'), /new THREE\.PointLight/, f);
});

// a planned hall, built and lit the way the game does it (headless: no renderer needed)
test('a built hall finds its ceiling lights and carries their light, pooled under them', async () => {
	const THREE = await import('three');
	const { planHall, rng } = await import('../src/interiors/plan.js');
	const { furnish } = await import('../src/interiors/furnish.js');
	const { prepare, buildLevel } = await import('../src/interiors/build.js');
	const { bakeNow, configureLighting } = await import('../src/interiors/lighting.js');
	configureLighting({ isPhone: true });
	const mats = new Proxy({}, { get: (t, k) => t[k] || (t[k] = Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true }), k === 'lamp' ? { emissive: new THREE.Color(1, 0.85, 0.6) } : {})) });
	const W = 14, D = 18, P = planHall({ use: 'warehouse', W, D, h: 5, doorX: 0, rnd: rng(7), style: 'plain' });
	P.f0 = 0; furnish(P, 0);
	const gen = buildLevel(P, mats, prepare(P, {}), 0, true);
	let r = gen.next();
	while (!r.done) r = gen.next();
	const Lb = r.value, L = P.levels[0];
	const H = bakeNow(Lb.root, { id: 'test-hall', occluders: Lb.occ, levels: [[L.y, L.y + L.h]], bounds: [-W / 2, -D / 2, W / 2, D / 2] });
	assert.ok(H.fixtures.length >= 2, 'its ceiling lights found: ' + H.fixtures.length);
	assert.ok(H.fixtures.every((f) => f.I > 0 && f.p[1] > 2), 'up at the ceiling, giving light');
	let lit = 0;
	const floorE = [];
	Lb.root.traverse((o) => {
		if (!o.isMesh || !o.geometry.attributes.ilight) return;
		lit++;
		assert.ok('IBAKE' in o.material.defines, o.name + ' reads the bake');
		if (o.name !== 'concrete') return;
		const A = o.geometry.attributes.ilight, Pp = o.geometry.attributes.position;
		for (let i = 0; i < A.count; i++) if (Math.abs(Pp.getY(i) - L.y) < 0.01) floorE.push([Pp.getX(i), Pp.getZ(i), A.getX(i)]);
	});
	assert.ok(lit > 3, 'its meshes carry the light');
	// the floor right under a fixture brighter than at the walls' feet in the corners
	const f = H.fixtures.find((q) => q.shape !== 'point') || H.fixtures[0];
	const near = floorE.filter((q) => Math.hypot(q[0] - f.p[0], q[1] - f.p[2]) < 1.2), edge = floorE.filter((q) => Math.abs(q[0]) > W / 2 - 0.6 && Math.abs(q[1]) > D / 2 - 0.6);
	const mean = (l) => l.reduce((s, q) => s + q[2], 0) / Math.max(1, l.length);
	assert.ok(near.length && edge.length, `floor samples ${near.length} ${edge.length}`);
	assert.ok(mean(near) > mean(edge) * 1.3, `a pool under the light (${mean(near).toFixed(3)}) and darker corners (${mean(edge).toFixed(3)})`);
});
