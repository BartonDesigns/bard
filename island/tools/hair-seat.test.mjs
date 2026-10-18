// Hair sits on the scalp (people/hair.js skullOf, people/hairkit.js styleChunk): the head is
// measured on its skin alone, never on the base mesh's hair-fitting helper (a shell a centimetre
// or so outside the scalp), and the narrow directions near the crown are filled from their
// measured neighbours, never left at a guess.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { skullOf, skinMask } from '../src/people/hair.js';

// a head: skin on a sphere of radius r0 round (0, 1.6, 0), a helper shell at r1, both all head;
// points by latitude rings, sparse near the pole as a real mesh's are
function head(r0, r1, rings = 14, around = 28) {
	const pos = [], skin = [];
	const ring = (r, mark) => {
		for (let j = 0; j <= rings; j++) {
			const el = -0.3 + (Math.PI / 2 + 0.3) * j / rings, n = j === rings ? 1 : Math.max(3, Math.round(around * Math.cos(el)));
			for (let i = 0; i < n; i++) { const az = i / n * Math.PI * 2; pos.push(Math.cos(el) * Math.sin(az) * r, 1.6 + Math.sin(el) * r, Math.cos(el) * Math.cos(az) * r); skin.push(mark); }
		}
	};
	ring(r0, 1); ring(r1, 0);
	const n = pos.length / 3, ids = new Uint16Array(n * 4), weights = new Uint16Array(n * 4);
	for (let v = 0; v < n; v++) weights[v * 4] = 1000;
	const body = [];
	for (let v = 0; v < n; v++) if (skin[v]) body.push(v, 0);
	const A = { bones: [{ name: 'head' }], ids, weights, body: Uint16Array.from(body) };
	const P = { map: { head: 0 }, rest: { heads: [new THREE.Vector3(0, 1.5, 0)] }, eyeAt: [new THREE.Vector3(-0.03, 1.6, 0.08), new THREE.Vector3(0.03, 1.6, 0.08)] };
	return { A, P, p: Float32Array.from(pos) };
}

test('the head is measured on its skin, not on the hair helper: hair sits on the scalp', () => {
	const { A, P, p } = head(0.09, 0.102);
	assert.equal(skinMask(A).reduce((a, b) => a + b, 0), A.body.length / 2, 'the skin, vertex by vertex');
	const K = skullOf(A, p, P);
	for (const d of [[0, 1, 0], [0, 0.6, 0.8], [0.8, 0.6, 0], [0, 0.6, -0.8], [0.7, 0.3, 0.6]]) {
		const dir = new THREE.Vector3(...d).normalize(), want = 0.09 - (K.c.clone().sub(new THREE.Vector3(0, 1.6, 0)).dot(dir));
		assert.ok(Math.abs(K.radius(dir) - want) < 0.004, `the scalp each way: ${K.radius(dir).toFixed(4)} for ${want.toFixed(4)}`);
		assert.ok(K.shell(dir) > K.radius(dir) + 0.008, "the helper's shell, kept apart for gear worn over the hair");
	}
});

test('the narrow directions round the crown are filled from what was measured, never a guess', () => {
	// (a big head, so a guess of 8 cm anywhere would show)
	const { A, P, p } = head(0.11, 0.12, 10, 18);
	const K = skullOf(A, p, P), up = K.radius(new THREE.Vector3(0, 1, 0)), want = 0.11 - (K.c.y - 1.6);
	assert.ok(Math.abs(up - want) < 0.005, `the crown: ${up.toFixed(4)} for ${want.toFixed(4)}`);
	// (how far the sphere's surface is from the skull's middle along d)
	const O = new THREE.Vector3(0, 1.6, 0), m = K.c.clone().sub(O);
	const along = (d) => { const b = d.dot(m); return -b + Math.sqrt(b * b - (m.lengthSq() - 0.11 * 0.11)); };
	for (let a = 0; a < 6.28; a += 0.4) {
		const d = new THREE.Vector3(Math.sin(a) * 0.15, 0.99, Math.cos(a) * 0.15).normalize();
		assert.ok(Math.abs(K.radius(d) - along(d)) < 0.004, `near the crown, every way: ${K.radius(d).toFixed(4)} for ${along(d).toFixed(4)}`);
	}
});

test('styles tied to the hair helper are brought down onto the scalp, every kind of hair', () => {
	const kit = fs.readFileSync(new URL('../src/people/hairkit.js', import.meta.url), 'utf8');
	assert.match(kit, /if \(kind === 0 && !skin\[refs\[v \* 3\]\]\)/, 'a tie on the helper found');
	assert.match(kit, /const lift = Math\.max\(0, ra - K\.radius\(d\)\)/, 'brought in by how far the tie stands off the skin');
	const groom = fs.readFileSync(new URL('../src/people/long-groom.js', import.meta.url), 'utf8');
	assert.match(groom, /K\.radius\(dir\)\+\(\.006\+layer\*\.008\)\*scale/, "a long groom's first layer close over the scalp");
	const suit = fs.readFileSync(new URL('../src/planet/colony/suit.js', import.meta.url), 'utf8');
	assert.match(suit, /\(sk\.shell \|\| sk\.radius\)/, 'a cap or helmet still clears the hair');
});
