// The road maps round you (bay/realcity.js): built a slice at a time over frames into a twin of
// the targets and swapped in whole, drawn in pieces on a phone. Each target's picture is taken
// here as what was drawn into it since it was last cleared, a multiset of triangles: the layers
// are blended by maximum, so the order they came in, and how they were split, changes nothing.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRealCity, REAL_U } from '../src/bay/realcity.js';

const cities = [], now = performance.now.bind(performance);
afterEach(() => { for (const c of cities.splice(0)) c.dispose(); performance.now = now; });

// a renderer that keeps each target's picture (the triangles since its last clear, as hashes)
function recorder() {
	let cur = null;
	const pics = new Map(), f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer), stats = { renders: 0, most: 0 };
	const fresh = () => pics.set(cur, new Map());
	const R = {
		autoClear: true, pics, stats,
		getRenderTarget: () => cur, setRenderTarget(t) { cur = t; }, getClearColor: (c) => c, getClearAlpha: () => 1, setClearColor() {},
		clear: fresh,
		render(scene) {
			stats.renders++;
			if (R.autoClear) fresh();
			const pic = pics.get(cur);
			for (const m of scene.children) {
				const P = m.geometry.attributes.position.array, C = m.geometry.attributes.color.array;
				stats.most = Math.max(stats.most, P.length / 3);
				for (let t = 0; t < P.length / 9; t++) {
					let h = 2166136261;
					for (let k = 0; k < 9; k++) { f32[0] = P[t * 9 + k]; h = Math.imul(h ^ u32[0], 16777619); }
					for (let k = 0; k < 12; k++) { f32[0] = C[t * 12 + k]; h = Math.imul(h ^ u32[0], 16777619); }
					pic.set(h, (pic.get(h) || 0) + 1);
				}
			}
		},
	};
	return R;
}
const same = (a, b) => a.size === b.size && [...a].every(([h, n]) => b.get(h) === n);
// a grown town's streets: a grid, built up (land use 7 everywhere: sidewalks and crossings)
function town(c) {
	const roads = [], N = 20, S = 80, x0 = -N * S / 2;
	for (let k = 0; k <= N; k++) {
		const cls = k % 4 === 0 ? 'secondary' : 'residential', w = cls === 'secondary' ? 12 : 9;
		const ave = [], st = [];
		for (let j = 0; j <= N; j++) { ave.push(x0 + k * S, x0 + j * S); st.push(x0 + j * S, x0 + k * S); }
		roads.push({ cls, w, name: 'Ave ' + k, pts: new Float32Array(ave) }, { cls, w, name: 'St ' + k, pts: new Float32Array(st) });
	}
	const px = new Uint8Array(64 * 64 * 4);
	for (let i = 1; i < px.length; i += 4) px[i] = 112;
	return c.addRegion({ name: 'grid', bounds: [-900, -900, 900, 900], roads, boxes: [], paths: [], pools: [], trees: [], map: { px, w: 64, h: 64, step: 30, x0: -960, z0: -960 } });
}
const cam = (x, z) => ({ position: { x, y: 10, z } });
// time in steps of 2 ms each look, so a build goes a slice a frame however fast it runs
const slow = () => { let t = 0; performance.now = () => (t += 2); };

for (const isPhone of [true, false]) test(`a road map built in slices is the map built at once (${isPhone ? 'phone' : 'computer'})`, () => {
	const R = recorder(), c = createRealCity(R, { isPhone });
	cities.push(c);
	town(c);
	c.update(cam(0, 0)); c.update(cam(0, 0));
	const fine = REAL_U.uRoadMap.value, paint = REAL_U.uPaintMap.value, whole = new Map(R.pics), shown = REAL_U.uRoadR.value.clone(), crossings = c.crossings();
	assert.equal(shown.w, 1);
	assert.ok(crossings.length > 20);
	// the same place again, slowly: the old map shown, the crossings kept, till the new is whole
	slow();
	c.R.repaint();
	let frames = 0;
	for (; frames < 5000 && REAL_U.uRoadMap.value === fine; frames++) {
		c.update(cam(0, 0));
		if (REAL_U.uRoadMap.value !== fine) break;
		assert.deepEqual(REAL_U.uRoadR.value.toArray(), shown.toArray());
		assert.equal(c.crossings(), crossings);
	}
	assert.ok(frames > 2, `${frames} frames`);
	assert.notEqual(REAL_U.uRoadMap.value, fine);
	assert.ok(same(R.pics.get(REAL_U.uRoadMap.value.renderTarget), whole.get(fine.renderTarget)));
	assert.notEqual(REAL_U.uPaintMap.value, paint);
	assert.ok(same(R.pics.get(REAL_U.uPaintMap.value.renderTarget), whole.get(paint.renderTarget)));
	assert.deepEqual(c.crossings(), crossings);
	// a phone's pieces stay small; a computer's (multisampled) map is drawn whole
	if (isPhone) assert.ok(R.stats.most <= 3 * 32768);
	// the coarse map's turn comes after, and it too is the same
	const coarse = REAL_U.uRoadMap2.value;
	c.R.repaint();
	for (let k = 0; k < 20000 && REAL_U.uRoadMap2.value === coarse; k++) c.update(cam(0, 0));
	assert.ok(same(R.pics.get(REAL_U.uRoadMap2.value.renderTarget), whole.get(coarse.renderTarget)));
});

test('a road map asked for again while it is built begins again, and nothing half made is shown', () => {
	const R = recorder(), c = createRealCity(R, { isPhone: true });
	cities.push(c);
	town(c);
	c.update(cam(0, 0)); c.update(cam(0, 0));
	const fine = REAL_U.uRoadMap.value, whole = R.pics.get(fine.renderTarget);
	slow();
	c.R.repaint();
	for (let k = 0; k < 5; k++) c.update(cam(0, 0));
	assert.equal(REAL_U.uRoadMap.value, fine);
	// (the regions changed, say: the build so far is stale)
	c.R.repaint();
	for (let k = 0; k < 5000 && REAL_U.uRoadMap.value === fine; k++) c.update(cam(0, 0));
	assert.ok(same(R.pics.get(REAL_U.uRoadMap.value.renderTarget), whole));
});

test('gone far past the map shown, the next is built at once', () => {
	const R = recorder(), c = createRealCity(R, { isPhone: true });
	cities.push(c);
	town(c);
	c.update(cam(0, 0)); c.update(cam(0, 0));
	slow();
	c.update(cam(400, 0));
	assert.equal(REAL_U.uRoadR.value.x, 400 - 256);
});
