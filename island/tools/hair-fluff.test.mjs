// Fluffy hair (people/hair-fluff.js): every cut but the round ones (locs, box braids,
// cornrows) is grown as tufts in locks, not as textured sheets. On a test head: sound
// geometry for every cut, on the scalp and not in it, its levels of detail nested, its skin
// weights whole; long hair as long as the cut, hair under a hat only below it, fewer tufts on
// a phone, the same head grown the same each time; and people wear it, not the old sheets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { skullOf } from '../src/people/hair.js';
import { FLUFFY, buildFluff } from '../src/people/hair-fluff.js';

// a head: skin on a sphere of radius 0.09 round (0, 1.6, 0), the neck and shoulders below it
function head() {
	const pos = [], body = [];
	for (let j = 0; j <= 16; j++) {
		const el = -0.3 + (Math.PI / 2 + 0.3) * j / 16, n = j === 16 ? 1 : Math.max(3, Math.round(32 * Math.cos(el)));
		for (let i = 0; i < n; i++) { const az = i / n * Math.PI * 2; body.push(pos.length / 3, 0); pos.push(Math.cos(el) * Math.sin(az) * 0.09, 1.6 + Math.sin(el) * 0.09, Math.cos(el) * Math.cos(az) * 0.09); }
	}
	const n = pos.length / 3, ids = new Uint16Array(n * 4), weights = new Uint16Array(n * 4);
	for (let v = 0; v < n; v++) weights[v * 4] = 1000;
	const A = { bones: [{ name: 'head' }], ids, weights, body: Uint16Array.from(body) };
	const P = { map: { head: 0, neck01: 1, spine01: 2 }, rest: { heads: [new THREE.Vector3(0, 1.5, 0)] }, eyeAt: [new THREE.Vector3(-0.03, 1.6, 0.08), new THREE.Vector3(0.03, 1.6, 0.08)], cut: { neck: 1.5, shoulder: 1.42, backZ: -0.1, frontZ: 0.1, shoulderX: 0.19 } };
	const p = Float32Array.from(pos);
	return { A, P, p, K: skullOf(A, p, P) };
}
const seeded = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const grow = (cut, opts = {}) => { const { A, P, p, K } = head(); return { K, g: buildFluff(A, P, p, cut, { skull: K, rnd: seeded(7), low: false, ...opts }) }; };

test('every fluffy cut grows sound tufts on the scalp, its levels of detail nested', () => {
	assert.ok(FLUFFY.size >= 16 && !FLUFFY.has('locs') && !FLUFFY.has('braids') && !FLUFFY.has('cornrows'), 'the round ones stay round');
	for (const cut of FLUFFY) {
		const { K, g } = grow(cut);
		const pos = g.attributes.position, idx = g.index.array, n = pos.count, tris = idx.length / 3;
		assert.ok(tris > 1500 && tris < 40000, `${cut}: ${tris} triangles`);
		for (let i = 0; i < idx.length; i++) if (idx[i] >= n) assert.fail(`${cut}: index ${idx[i]} past ${n} vertices`);
		const [far, mid, all] = g.userData.lod;
		assert.ok(far > 0 && far % 3 === 0 && far < mid && mid <= all && all === idx.length, `${cut}: lod ${g.userData.lod}`);
		const d = new THREE.Vector3(), wt = g.attributes.skinWeight.array;
		let inside = 0;
		for (let v = 0; v < n; v++) {
			d.set(pos.getX(v), pos.getY(v), pos.getZ(v));
			assert.ok(Number.isFinite(d.x + d.y + d.z), `${cut}: a vertex at ${d.toArray()}`);
			assert.equal(wt[v * 4] + wt[v * 4 + 1] + wt[v * 4 + 2] + wt[v * 4 + 3], 255, `${cut}: skin weights whole`);
			if (d.y < K.c.y - 0.05) continue;
			d.sub(K.c);
			const r = d.length();
			if (r < K.radius(d.divideScalar(r)) - 0.005) inside++;
		}
		assert.ok(inside < n * 0.002, `${cut}: ${inside} of ${n} vertices inside the head`);
	}
});

test('long hair falls as far as the cut; under a hat only what shows below it; fewer tufts on a phone', () => {
	const low = (g) => { let y = 9; const a = g.attributes.position; for (let v = 0; v < a.count; v++) y = Math.min(y, a.getY(v)); return y; };
	const high = (g) => { let y = -9; const a = g.attributes.position; for (let v = 0; v < a.count; v++) y = Math.max(y, a.getY(v)); return y; };
	const long = grow('long'), crop = grow('crop');
	assert.ok(low(long.g) < long.K.eyeY - 0.2, `long hair to ${(low(long.g) - long.K.eyeY).toFixed(3)} below the eyes`);
	assert.ok(low(crop.g) > crop.K.eyeY - 0.1, 'a crop stays short');
	const capped = grow('short', { capY: 0.05 });
	assert.ok(high(capped.g) < capped.K.eyeY + 0.05 + 0.03, `under a cap: up to ${(high(capped.g) - capped.K.eyeY).toFixed(3)} above the eyes`);
	assert.ok(high(grow('short').g) > high(capped.g) + 0.02, 'bare, it grows over the crown');
	const phone = grow('long', { low: true });
	assert.ok(phone.g.index.count < long.g.index.count * 0.6, 'a phone draws fewer');
	assert.equal(grow('bob').g.attributes.position.count, grow('bob').g.attributes.position.count, 'the same head the same each time');
});

test('people wear fluffy hair: no textured sheets fetched for it, grown and skinned in its place', () => {
	const src = fs.readFileSync(new URL('../src/people/body.js', import.meta.url), 'utf8');
	assert.match(src, /style: showHair && \(H\.style \|\| !FLUFFY\.has\(cutName\)\) \? styleFor\(/, 'the sheets only for a style asked for by name');
	assert.match(src, /else if \(W\.cut && FLUFFY\.has\(W\.cut\)\) \{[\s\S]{0,400}buildFluff\(/, 'grown for the cut');
	assert.match(src, /skinned\(g, fluffMaterial\(/, 'skinned, so long hair follows the neck and the back');
	assert.match(src, /userData\.lod[\s\S]{0,200}setDrawRange/, 'fewer tufts far off');
});

test('hair lies over the ears, not out round them: the head without its ears, each ear its own', () => {
	// the test head, and an ear on it: skin standing 2 cm out of the side a little below the eyes,
	// the vertices the face's 'ear-out' target moves
	const { A, P, p } = head();
	const pos = Array.from(p), body = Array.from(A.body), ids = [];
	for (let i = 0; i < 6; i++) for (let j = 0; j < 8; j++) for (let k = 0; k < 4; k++) {
		ids.push(pos.length / 3); body.push(pos.length / 3, 0);
		pos.push(0.088 + k * 0.006, 1.6 - 0.058 + j * 0.007, -0.014 + i * 0.0056);
	}
	const n = pos.length / 3, A2 = { ...A, onSkin: undefined, onEar: undefined, ids: new Uint16Array(n * 4), weights: new Uint16Array(n * 4), body: Uint16Array.from(body), faces: { axes: [{ n: 'ear-out', lo: null, hi: { idx: Uint16Array.from(ids), d: Float32Array.from(ids.flatMap(() => [0.004, 0, 0])) } }] } };
	for (let v = 0; v < n; v++) A2.weights[v * 4] = 1000;
	const p2 = Float32Array.from(pos), K = skullOf(A2, p2, P);
	assert.equal(K.ears.length, 1, 'the ear found');
	const E = K.ears[0];
	assert.ok(E.c.x > 0.095 && E.c.x < 0.11 && E.r.y > 0.02 && E.r.y < 0.03, `the ear's own place and size: ${E.c.toArray().map((x) => x.toFixed(3))} ${E.r.toArray().map((x) => x.toFixed(3))}`);
	const side = new THREE.Vector3(1, -0.33, 0).normalize();
	assert.ok(K.radius(side) > K.hairRadius(side) + 0.01, 'the hair measures the head without the ear');
	const g = buildFluff(A2, P, p2, 'swept', { skull: K, rnd: seeded(5), low: false });
	const a = g.attributes.position, q = new THREE.Vector3();
	let inEar = 0, flared = 0;
	for (let v = 0; v < a.count; v++) {
		q.set(a.getX(v), a.getY(v), a.getZ(v));
		const ex = (q.x - E.c.x) / E.r.x, ey = (q.y - E.c.y) / E.r.y, ez = (q.z - E.c.z) / E.r.z;
		if (ex * ex + ey * ey + ez * ez < 0.7) inEar++;
		// (just over the ear, round the head: no fan standing off it)
		const d = q.clone().sub(K.c), r = d.length();
		if (q.y > E.c.y + E.r.y + 0.004 && q.y < E.c.y + E.r.y + 0.02 && Math.abs(q.z - E.c.z) < 0.02 && q.x > 0 && r > K.hairRadius(d.normalize()) + 0.03) flared++;
	}
	assert.ok(inEar < a.count * 0.002, `${inEar} vertices inside the ear`);
	assert.ok(flared < 20, `${flared} vertices fanned out over the ear`);
});

test('long hair falls over the shoulders as the head turns, not through them', () => {
	const fluff = fs.readFileSync(new URL('../src/people/hair-fluff.js', import.meta.url), 'utf8');
	const body = fs.readFileSync(new URL('../src/people/body.js', import.meta.url), 'utf8');
	assert.match(fluff, /const PUSH = `if \(position\.y < uCapY\) for \(int pass = 0; pass < 2; pass\+\+\)/, 'pushed out of the capsules, what hangs below the head');
	assert.match(fluff, /\.replace\('#include <skinning_vertex>', '#include <skinning_vertex>\\n' \+ PUSH\)/, 'after the skinning: where the body is now');
	assert.match(body, /skinned\(g, fluffMaterial\(root, tip\)\);[\s\S]{0,400}hairCapsules\(P, o, [\s\S]{0,300}poseCapsules\(P, caps, hair\.material\.userData\.U, hair\)/, 'the capsules posed with the body each frame');
	assert.match(fluff, /if \(r && !ms\) \{ msaa = false; m\.alphaToCoverage = false; \}/, 'no alpha to coverage where nothing is multisampled');
});
