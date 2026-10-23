// Every creature's ragdoll (creatures/rig.js): its pieces read off the rig packed in its model
// (the same meta creatures/models.js gets), one root (the hips), every piece hanging from a
// piece above it, parent first, the legs in before the ears, weights that add up, and nothing
// too light or too heavy for the solver.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ragdollPieces } from '../src/creatures/rig.js';

const dir = new URL('../assets/creatures/', import.meta.url);
function rigOf(file) {
	const d = fs.readFileSync(new URL(file, dir));
	const len = d.readUInt32LE(12), j = JSON.parse(d.subarray(20, 20 + len).toString());
	const meta = j.scenes[0].extras.creature;
	const par = new Map();
	for (const n of j.nodes) for (const c of n.children || []) par.set(j.nodes[c].name, n.name);
	const san = (n) => n.replace(/[\s.[\]:/]/g, '');
	const byS = new Map(meta.bones.map((b) => [san(b), b]));
	const parentOf = (n) => { const p = par.get(san(n)); return p ? byS.get(p) || null : null; };
	return { meta, parentOf };
}
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb'));

test('every creature model yields a ragdoll: one root, a tree of pieces, parent first', () => {
	assert.ok(files.length >= 20);
	for (const f of files) {
		const { meta, parentOf } = rigOf(f);
		for (const max of [14, 22]) {
			const R = ragdollPieces(meta, parentOf, { max });
			assert.ok(R.pieces.length >= 8 && R.pieces.length <= max, `${f} ${max}: ${R.pieces.length} pieces`);
			assert.equal(R.root, 'hips', f);
			const roots = R.pieces.filter((p) => !p.up);
			assert.equal(roots.length, 1, `${f}: roots ${roots.map((p) => p.n)}`);
			const seen = new Set();
			for (const p of R.pieces) {
				if (p.up) assert.ok(seen.has(p.up), `${f}: ${p.n} before its parent ${p.up}`);
				seen.add(p.n);
				assert.ok(p.r > 0 && p.len > 0 && p.m > 0.01 && p.m <= 0.5, `${f}: ${p.n} r ${p.r} len ${p.len} m ${p.m}`);
				assert.ok(!p.hinge || p.up, `${f}: a hinge needs a parent (${p.n})`);
			}
			const sum = R.pieces.reduce((a, p) => a + p.m, 0);
			assert.ok(Math.abs(sum - 1) < 1e-6, `${f}: shares sum to ${sum}`);
			assert.ok(R.mass > 8 && R.mass < 1e5, `${f}: mass ${R.mass}`);
		}
	}
});

test('the hound keeps its legs before its ears and tail, even on a phone, and its knees hinge', () => {
	const { meta, parentOf } = rigOf('ridge-hound.glb');
	const R = ragdollPieces(meta, parentOf, { max: 14 });
	const names = new Set(R.pieces.map((p) => p.n));
	for (const n of ['hips', 'spine', 'chest', 'neck', 'head', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'thigh_L', 'thigh_R', 'shin_L', 'shin_R']) assert.ok(names.has(n), n);
	assert.ok(!names.has('ear_L') && !names.has('toe_L'), 'ears and toes ride their parents');
	for (const n of ['forearm_L', 'shin_R']) assert.equal(R.pieces.find((p) => p.n === n).hinge, 'x', n);
	assert.equal(R.pieces.find((p) => p.n === 'thigh_L').hinge, null);
	assert.equal(R.pieces.find((p) => p.n === 'thigh_L').up, 'hips');
});

test('props stay out of it (the Sexton\'s spade and lantern), and a scaled body weighs more', () => {
	const { meta, parentOf } = rigOf('sexton.glb');
	const R = ragdollPieces(meta, parentOf, { max: 22 });
	assert.ok(!R.pieces.some((p) => p.n === 'spade' || p.n === 'lantern'));
	const big = ragdollPieces(meta, parentOf, { max: 22, scale: 1.1 });
	assert.ok(big.mass > R.mass * 1.25 && big.mass < R.mass * 1.4, `${big.mass} vs ${R.mass}`);
});
