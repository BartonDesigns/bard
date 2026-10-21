// The packaged rooftop units on the city's flat roofs (bay/lotkit.js rooftopUnit, drawn by the
// thousand by city.js): the faces nothing can see left out, and nothing else changed. Every face
// dropped lies against a solid part (the roof, the curb, the cabinet, a shroud), every face kept
// is the unit's own, and the unit stands just as large. Far off it is drawn plainer (its fans flat
// discs), within the near one's outline, as wide and as deep, and the near copies are exactly the
// far set's units within reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rooftopUnit, rooftopUnitFar, nearCopies } from '../src/bay/lotkit.js';

// the unit as it was, every face
const whole = (seg) => {
	const B = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z).toNonIndexed();
	const C = (r, h, x, y, z) => new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z).toNonIndexed();
	const g = [B(1.25, 0.18, 2.1, 0, 0, 0), B(1.1, 1.0, 1.95, 0, 0.18, 0), C(0.34, 0.12, 0, 1.18, -0.45), C(0.3, 0.02, 0, 1.3, -0.45), C(0.34, 0.12, 0, 1.18, 0.45), C(0.3, 0.02, 0, 1.3, 0.45), B(0.03, 0.62, 1.5, 0.56, 0.4, 0), B(0.4, 0.3, 0.3, 0, 0.18, 1.1)];
	for (const p of g) { p.deleteAttribute('uv'); }
	return mergeGeometries(g);
};
const faces = (g0) => { const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal, out = []; for (let t = 0; t < P.count; t += 3) { const c = [0, 1, 2].map((a) => (P.getComponent(t, a) + P.getComponent(t + 1, a) + P.getComponent(t + 2, a)) / 3); out.push({ c, n: [N.getX(t), N.getY(t), N.getZ(t)], key: c.map((v) => v.toFixed(3)).join(',') + '|' + [0, 1, 2].map((k) => [P.getX(t + k), P.getY(t + k), P.getZ(t + k)].map((v) => (Math.round(v * 1000) / 1000 + 0).toFixed(3)).join(',')).join(';') }); } return out; };
// the solid parts a hidden face can lie against: the roof (below 0), the curb, the cabinet, the shrouds
const solid = (x, y, z) => y < 0 || (Math.abs(x) < 0.625 && y < 0.18 && Math.abs(z) < 1.05) || (Math.abs(x) < 0.55 && y > 0.18 && y < 1.18 && Math.abs(z) < 0.975)
	|| [-0.45, 0.45].some((fz) => Math.hypot(x, z - fz) < 0.3 && y > 1.18 && y < 1.3);

test('the rooftop unit leaves out only faces lying against something solid', () => {
	for (const seg of [6, 14]) {
		const was = faces(whole(seg)), now = faces(rooftopUnit(seg)), kept = new Set(now.map((f) => f.key));
		assert.equal(now.length, was.length - (8 + 4 * seg), `${seg}-sided fans: ${was.length} -> ${now.length}`);
		for (const f of now) assert.ok(was.some((w) => w.key === f.key), 'every face kept is one of the unit\'s own');
		for (const f of was) {
			if (kept.has(f.key)) continue;
			const p = f.c.map((v, a) => v + f.n[a] * 0.002);
			assert.ok(solid(...p), `dropped face at ${f.c.map((v) => v.toFixed(2))} faces open air`);
		}
		const a = new THREE.Box3().setFromBufferAttribute(whole(seg).attributes.position), b = new THREE.Box3().setFromBufferAttribute(rooftopUnit(seg).attributes.position);
		assert.ok(a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6, 'just as large');
	}
	assert.equal(faces(rooftopUnit(6)).length, 112);
});

test('the rooftop unit keeps its colours and normals for every face, its corners shared', () => {
	const g = rooftopUnit(6), flat = g.toNonIndexed();
	for (const k of ['position', 'normal', 'color']) assert.equal(flat.attributes[k].count, 112 * 3, k);
	assert.equal(g.index.count, 112 * 3);
	assert.ok(g.attributes.position.count < 112 * 3 * 0.5, `corners: ${g.attributes.position.count}`);
});

test('the far rooftop unit: a third of the triangles, the near one\'s footprint, no taller', () => {
	const f = rooftopUnitFar(), n = rooftopUnit(6);
	assert.equal(f.index.count / 3, 44);
	const a = new THREE.Box3().setFromBufferAttribute(n.attributes.position), b = new THREE.Box3().setFromBufferAttribute(f.attributes.position);
	for (const k of ['x', 'z']) { assert.ok(Math.abs(a.min[k] - b.min[k]) < 1e-6 && Math.abs(a.max[k] - b.max[k]) < 1e-6, 'as wide and deep: ' + k); }
	assert.ok(b.max.y <= a.max.y && b.max.y > a.max.y - 0.02, 'as tall, within the fans\' 2 cm');
	assert.deepEqual(Object.keys(f.attributes).sort(), Object.keys(n.attributes).sort());
	// seen from above, each fan the same dark: the disc's colour is the mean of the rim and the fan
	const P = f.attributes.position, C = f.attributes.color;
	let top = null; for (let i = 0; i < P.count; i++) if (P.getY(i) > 1.3) top = C.getX(i);
	const rim = (0.34 ** 2 - 0.3 ** 2) / 0.34 ** 2;
	assert.ok(Math.abs(top - (rim * 0.42 + (1 - rim) * 0.16)) < 0.01, `fan disc ${top}`);
});

test('the near rooftop units are the far set\'s within reach, matrices and all', () => {
	const n = 500, src = new Float32Array(n * 16), dst = new Float32Array(100 * 16), m = new THREE.Matrix4();
	const at = [];
	for (let i = 0; i < n; i++) { const x = Math.sin(i * 12.9898) * 600, z = Math.cos(i * 78.233) * 600; at.push([x, z]); m.compose(new THREE.Vector3(x, 10, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(1 + i % 3, 1, 1)); m.toArray(src, i * 16); }
	const k = nearCopies(src, n, dst, 100, 40, -30, 275), want = at.map(([x, z], i) => [i, Math.hypot(x - 40, z + 30)]).filter(([, d]) => d <= 275).map(([i]) => i);
	assert.equal(k, Math.min(100, want.length));
	want.slice(0, k).forEach((i, j) => { for (let e = 0; e < 16; e++) assert.equal(dst[j * 16 + e], src[i * 16 + e]); });
	assert.equal(nearCopies(src, n, dst, 3, 40, -30, 275), 3, 'no more than it holds');
});
