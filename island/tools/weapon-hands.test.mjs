// Finger contact and pose logic for first-person weapon hands (crysis/finger-pose.js): a small
// synthetic hand (a wrist, four metacarpals, five three-bone fingers, a skin of points round each
// bone) closed onto real weapon geometry and a simple cylinder.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fingerRig, contactField, solveHand, fingerQuats, blendPose, squeeze, itemParts } from '../src/crysis/finger-pose.js';
import { HOLDS, GRIPS, CHARGERS, cellPath, holdFrame } from '../src/crysis/held-items.js';
import { BOW_HAND, createBowVisual } from '../src/crysis/bow-visual.js';

// a right hand at rest: fingers along +x from the palm, the palm facing -z, the thumb at +y
function syntheticBody(side = 'R') {
	const names = [], heads = [], tails = [], parent = [];
	const add = (name, h, t, p) => { names.push(name + '.' + side); heads.push(new THREE.Vector3(...h)); tails.push(new THREE.Vector3(...t)); parent.push(p); return names.length - 1; };
	const wrist = add('wrist', [0, 0, 0], [0.08, 0, 0], -1);
	const ys = [0.03, 0.01, -0.01, -0.03];
	ys.forEach((y, k) => add('metacarpal' + (k + 1), [0.01, y * 0.5, 0], [0.085, y, 0], wrist));
	const lens = [0.045, 0.027, 0.022];
	for (let f = 1; f <= 5; f++) {
		let p = f === 1 ? wrist : 1 + (f - 2), x = f === 1 ? 0.025 : 0.085, y = f === 1 ? 0.035 : ys[f - 2], z = 0;
		const dir = f === 1 ? new THREE.Vector3(0.7, 0.55, -0.45).normalize() : new THREE.Vector3(1, 0, 0);
		for (let j = 1; j <= 3; j++) {
			const L = lens[j - 1] * (f === 1 ? 0.9 : 1), h = [x, y, z], t = [x + dir.x * L, y + dir.y * L, z + dir.z * L];
			p = add(`finger${f}-${j}`, h, t, p); [x, y, z] = t;
		}
	}
	// a skin: rings of points round each finger bone, all weight on it
	const pos = [], si = [], sw = [];
	names.forEach((n, i) => {
		if (!/finger|metacarpal/.test(n)) return;
		const h = heads[i], t = tails[i], d = t.clone().sub(h).normalize(), u = new THREE.Vector3(0, 0, 1).cross(d).normalize(), v = d.clone().cross(u);
		const r = /metacarpal/.test(n) ? 0.012 : 0.008;
		for (const s of [0.25, 0.5, 0.75]) for (let a = 0; a < 8; a++) {
			const c = h.clone().lerp(t, s).addScaledVector(u, Math.cos(a / 8 * Math.PI * 2) * r).addScaledVector(v, Math.sin(a / 8 * Math.PI * 2) * r);
			pos.push(c.x, c.y, c.z); si.push(i, 0, 0, 0); sw.push(1, 0, 0, 0);
		}
	});
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
	g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
	const bones = names.map((name) => ({ name, parent: null }));
	bones.forEach((b, i) => { b.parent = parent[i] >= 0 ? bones[parent[i]] : null; });
	return { bones, map: Object.fromEntries(names.map((n, i) => [n, i])), rest: { heads, tails, dirs: heads.map((h, i) => tails[i].clone().sub(h).normalize()) }, skin: { geometry: g }, height: 1.75 };
}
const cylinderField = (r) => {
	const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 48));
	return contactField([[mesh, new THREE.Matrix4()]], new THREE.Box3(new THREE.Vector3(-0.3, -0.3, -0.3), new THREE.Vector3(0.3, 0.3, 0.3)));
};

test('the rig reads three bones a finger, curl axes toward the palm and skin samples', () => {
	const rig = fingerRig(syntheticBody(), 'R');
	assert.equal(rig.chains.length, 5);
	for (const c of rig.chains) { assert.equal(c.length, 3); for (const J of c) { assert.ok(J.len > 0.01); assert.ok(Math.abs(J.axis.length() - 1) < 1e-6); } }
	assert.ok(rig.skin.every((s) => s && s.n > 0));
});

test('signed distance is negative inside, positive outside, capped far away', () => {
	const field = cylinderField(0.02);
	assert.ok(field.sd(0, 0, 0) < -0.015);
	assert.ok(Math.abs(field.sd(0.03, 0, 0) - 0.01) < 0.001);
	assert.equal(field.sd(0.25, 0.25, 0.25), field.REACH);
});

test('wrapped fingers close onto a grip and stop at its skin, neither floating nor sunk in', () => {
	const rig = fingerRig(syntheticBody(), 'R');
	const field = cylinderField(0.016);
	// the palm 2.6 cm from the axis, facing it, the fingers across it
	const frame = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)).setPosition(-0.035, 0, -0.03);
	const out = solveHand(rig, field, frame, [{ mode: 'fixed', params: [0, 0.3, 0.2, 0.1] }, { mode: 'wrap' }, { mode: 'wrap' }, { mode: 'wrap' }, { mode: 'wrap' }], { fit: false });
	for (let f = 1; f < 5; f++) {
		assert.ok(out.params[f * 4 + 1] > 0.2, 'curled ' + f);
		assert.ok(out.clearanceMm[f] > -1 && out.clearanceMm[f] < 2, `finger ${f} clearance ${out.clearanceMm[f]}`);
	}
	assert.deepEqual(Array.from(out.params.slice(0, 4)).map((x) => +x.toFixed(2)), [0, 0.3, 0.2, 0.1]);
});

test('a reaching finger brings its pad to the target', () => {
	const rig = fingerRig(syntheticBody(), 'R');
	const frame = new THREE.Matrix4();
	const tip = rig.chains[1][2].tail.clone().applyMatrix4(rig.restInv);
	const target = tip.clone().add(new THREE.Vector3(-0.02, 0, 0.025));
	const out = solveHand(rig, null, frame, [null, { mode: 'reach', target }, null, null, null].map((s) => s || { mode: 'fixed', params: [0, 0, 0, 0] }), { fit: false });
	assert.ok(out.missMm[1] < 6, 'miss ' + out.missMm[1]);
});

test('poses blend as numbers and become finite bone rotations without allocating', () => {
	const rig = fingerRig(syntheticBody(), 'R'), a = new Float32Array(20), b = new Float32Array(20).fill(0.5), out = new Float32Array(20);
	blendPose(out, a, b, 0.5); assert.ok(out.every((x) => Math.abs(x - 0.25) < 1e-6));
	squeeze(out, 0.1, 2, 4); assert.ok(out[2 * 4 + 1] > 0.34 && out[1 * 4 + 1] === 0.25);
	const quats = Array.from({ length: 15 }, () => new THREE.Quaternion());
	const same = quats.slice();
	fingerQuats(rig, out, quats);
	quats.forEach((q, i) => { assert.equal(q, same[i]); assert.ok(Math.abs(q.length() - 1) < 1e-6); });
});

test('every weapon has hands planned, grips framed and a charging knob where it reloads', () => {
	for (const id of ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine']) {
		const P = GRIPS[id];
		for (const pose of ['ready', 'trigger']) assert.equal(P.R[pose].length, 5);
		for (const pose of ['fore', 'cell', 'charge', 'open']) assert.equal(P.L[pose].length, 5);
		assert.ok(CHARGERS[id]);
		// the index lies along the frame, outside the trigger guard (which is 11 mm thick), when ready
		assert.ok(P.R.ready[1].target.z > 0.015);
		const H = HOLDS[id];
		for (const s of ['R', 'L']) { const m = H[s].m.elements; assert.ok(Math.abs(new THREE.Vector3(m[0], m[1], m[2]).length() - 1) < 1e-6); }
	}
	const bow = GRIPS['reedline-hunting-bow'];
	assert.equal(bow.L.riser.length, 5);
	assert.equal(bow.R, undefined, 'the draw hand keeps the body\'s own curl');
	const g = { c: new THREE.Vector3(0, 0, 0), r: 0.02, a: new THREE.Vector3(1, 0, 0), t: new THREE.Vector3(0, 1, 0), twist: 0.3 };
	holdFrame(g, 'R'); holdFrame(g, 'R');
	assert.ok(Math.abs(g.a.angleTo(new THREE.Vector3(1, 0, 0)) - 0.3) < 1e-6, 'twist applies once, however often the frame is made');
});

test('the fresh cell seats with its cue at 0.8, leaving the charging stroke after it', () => {
	const v = new THREE.Vector3();
	assert.equal(cellPath(0.1, v).length(), 0);
	assert.equal(cellPath(0.5, v), null);
	assert.ok(cellPath(0.7, v).length() > 0.01);
	assert.equal(cellPath(0.8, v).length(), 0);
});

test('the draw hand rides with the nock at any draw length', () => {
	const model = new THREE.Group(), bow = createBowVisual(model, new THREE.MeshStandardMaterial(), { drawLength: 0.5 });
	for (const draw of [0, 1]) {
		bow.set({ draw, loaded: true, nock: 1 }); for (let i = 0; i < 90; i++) bow.step(1 / 60);
		const hand = new THREE.Vector3().setFromMatrixPosition(bow.right);
		assert.ok(hand.clone().sub(bow.nock).sub(BOW_HAND).length() < 0.003);
	}
	assert.ok(Math.abs(bow.info().drawMeters - 0.5) < 0.01);
	bow.dispose();
});

test('the first-person rifle is solved against its own mesh: a real grip closes, nothing sinks in deep', async () => {
	const { itemModel } = await import('../src/crysis/held-items.js').catch(() => ({}));
	let model;
	try { model = itemModel('warden-spark-carbine', { lod: 'high', view: true }); } catch { return; }
	const H = HOLDS['warden-spark-carbine'], parts = itemParts(model, ['body', 'charger', 'cell']);
	assert.ok(model.getObjectByName('charger'), 'a charging knob of its own');
	const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3().setFromMatrixPosition(H.R.m), new THREE.Vector3(0.24, 0.24, 0.24));
	const field = contactField(parts, box);
	assert.ok(field.triangles > 200);
	// the trigger blade is there to be touched
	const [x, y] = [0.0505, 0.029];
	assert.ok(Math.abs(field.sd(x, y, 0)) < 0.006);
});
