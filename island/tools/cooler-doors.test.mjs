// The coolers' doors (bay/cooler-doors.js): each a run of the kit's vertices of its own, kept
// through the light bake's finer copy (interiors/lightbake.js tessellate marks), swinging open
// on its hinge out into the shop when you take something cold from it (office-perks.js) and
// swinging shut again, every other vertex left where it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommercial } from '../src/bay/commercial.js';
import { tessellate } from '../src/interiors/lightbake.js';
import { lightInterior, bakeNow } from '../src/interiors/lighting.js';

const mart = (o) => { const b = { x: 40, z: 8, w: 16, d: 12, a: 0.4, wallH: 4.6, kind: 6, h: 4.6, door: 0.5, store: 'corner', ...o }; b.grp = [b]; b.grp.biz = true; return b; };
function built(b) {
	const C = createCommercial({ add() {} }, { heightAt: () => 0 }, null, { procBiz: () => [b], setNear() {} }, {});
	const cam = { position: { x: b.x, y: 2, z: b.z } };
	let frames = 0;
	while (!C.count() && frames < 200) { C.update(cam, 0.016, 12, 0); frames++; }
	return { C, cam, root: C.group.children[0] };
}
const posOf = (root, name) => { let m = null; root.traverse((o) => { if (o.isMesh && o.name === name) m = o; }); return m; };

test('tessellate keeps each marked run of triangles together, and says where it went', () => {
	// two quads, the second its own run: cut finer, the runs still in order, each where it was
	const quad = (x0, x1) => [x0, 0, 0, x1, 0, 0, x1, 1, 0, x0, 0, 0, x1, 1, 0, x0, 1, 0];
	const P = new Float32Array([...quad(0, 1), ...quad(2, 3)]), N = new Float32Array(36).map((_, i) => (i % 3 === 2 ? 1 : 0));
	const T = tessellate({ position: { array: P, size: 3 }, normal: { array: N, size: 3 } }, 12, 0.25, -1, [6, 12]);
	assert.deepEqual(T.marks.length, 2);
	assert.equal(T.marks[1], T.count);
	const A = T.attrs.position.array;
	for (let v = 0; v < T.count; v++) assert.ok(v < T.marks[0] ? A[v * 3] <= 1 + 1e-6 : A[v * 3] >= 2 - 1e-6, `vertex ${v} in its own run`);
	assert.ok(T.marks[0] > 6 && T.count - T.marks[0] > 6, 'both cut finer');
});

test('a cooler door swings open on its hinge and shut again, before and after the bake', () => {
	const b = mart();
	const { C, cam, root } = built(b);
	const near = C.amenities({ x: b.x, y: 1.6, z: b.z }, 30).filter((q) => q.door);
	assert.ok(near.length >= 8, `the coolers' doors are yours to take from (${near.length})`);
	assert.ok(near.some((q) => q.kind === 'colddrink') && near.some((q) => q.kind === 'coldbeer') && near.some((q) => q.kind === 'milk'), 'drinks, beer and milk');
	const H = lightInterior(root);
	for (const baked of [false, true]) {
		if (baked) bakeNow(root, H.spec);
		else H.state = 'done';
		const gloss = posOf(root, 'gloss'), before = gloss.geometry.attributes.position.array.slice();
		assert.ok(gloss.geometry.userData.marks?.length >= near.length, "the doors' runs marked in the mesh");
		const q = near[3];
		assert.ok(C.swing(q.x, q.z, 1.5), 'a door there');
		for (let i = 0; i < 10; i++) C.update(cam, 0.1, 12, 0);
		const A = gloss.geometry.attributes.position.array;
		let moved = 0, far = 0;
		for (let i = 0; i < A.length; i += 3) {
			const d = Math.hypot(A[i] - before[i], A[i + 2] - before[i + 2]);
			if (d > 1e-4) { moved++; far = Math.max(far, d); }
		}
		// (one door's frame only: its free edge out a door's width and more into the shop)
		assert.ok(moved > 0 && moved < 2000, `${baked ? 'baked' : 'built'}: one door's vertices moved (${moved})`);
		assert.ok(far > 0.6 && far < 1.2, `its free edge swung out (${far.toFixed(2)} m)`);
		// out into the shop: the door's vertices nearer the place you stand than they were
		for (let i = 0; i < 30; i++) C.update(cam, 0.1, 12, 0);
		const back = gloss.geometry.attributes.position.array;
		let off = 0;
		for (let i = 0; i < back.length; i++) off = Math.max(off, Math.abs(back[i] - before[i]));
		assert.ok(off < 1e-4, `${baked ? 'baked' : 'built'}: shut again, every vertex back (${off})`);
	}
});

test('a door swings out toward you, not into the cooler', () => {
	const b = mart({ a: 0 });
	const { C, cam, root } = built(b);
	lightInterior(root).state = 'done';
	const q = C.amenities({ x: b.x, y: 1.6, z: b.z }, 30).find((p) => p.door);
	const glass = posOf(root, 'glass'), before = glass.geometry.attributes.position.array.slice();
	C.swing(q.x, q.z, 3);
	for (let i = 0; i < 10; i++) C.update(cam, 0.1, 12, 0);
	const A = glass.geometry.attributes.position.array;
	// (the back wall's coolers face +z: an open door's glass stands out in front of them)
	let out = -1e9;
	for (let i = 0; i < A.length; i += 3) if (Math.abs(A[i] - before[i]) + Math.abs(A[i + 2] - before[i + 2]) > 1e-4) out = Math.max(out, A[i + 2] - before[i + 2]);
	assert.ok(out > 0.5, `the glass swung out into the shop (${out.toFixed(2)})`);
});
