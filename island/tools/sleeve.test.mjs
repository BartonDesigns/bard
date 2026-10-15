import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { sleeveSpec, armFrame, armPose, buildGarment, forearmEnvelope, layerStations, garmentMaterial } from '../src/people/sleeve.js';
import { outfitFor } from '../src/combat/outfits.js';

test('outfits give the sleeves, cuffs, cloth and gloves a person really wears', () => {
	const tee = sleeveSpec({ top: { kind: 'tee', col: '#334455', sleeves: 'short' } });
	assert.equal(tee.layers.length, 0); assert.equal(tee.bare, true); assert.equal(tee.glove, null);
	const hoodie = sleeveSpec({ top: { kind: 'hoodie', col: '#7d8086', sleeves: 'long', fit: 'oversized' } }).layers[0];
	assert.equal(hoodie.cuff, 'rib'); assert.equal(hoodie.fab, 'sweat'); assert.equal(hoodie.length, 'long');
	assert.ok(hoodie.ease > 0.012, 'oversized stands further off');
	const shirt = sleeveSpec({ top: { kind: 'shirt', col: '#1c2540', sleeves: 'long' } }).layers[0];
	assert.equal(shirt.cuff, 'button'); assert.equal(shirt.fab, 'shirting');
	// a jacket over a long-sleeved shirt: both hems at the wrist, the shirt's under
	const layered = sleeveSpec({ top: { kind: 'flannel', pat: 'plaid', col: '#7a2a2a', sleeves: 'long' }, outer: { kind: 'denim', pat: 'denim', col: '#4a6189', sleeves: 'long', open: true } });
	assert.equal(layered.layers.length, 2); assert.equal(layered.layers[0].under, true); assert.equal(layered.layers[0].fab, 'flannel');
	assert.equal(layered.layers[1].fab, 'denim'); assert.equal(layered.layers[1].cuff, 'button');
	// a vest adds no sleeve; a shell's storm cuff over a hoodie's rib
	assert.equal(sleeveSpec({ top: { kind: 'tee', sleeves: 'short' }, outer: { kind: 'fleeceVest', sleeves: 'none' } }).layers.length, 0);
	const shell = sleeveSpec({ top: { kind: 'hoodie', sleeves: 'long' }, outer: { kind: 'shell', fab: 'nylon', sleeves: 'long' } }).layers;
	assert.deepEqual(shell.map((L) => L.cuff), ['rib', 'storm']); assert.equal(shell[1].fab, 'nylon');
	// soldiers: ripstop camouflage, a tabbed cuff, tactical gloves; rolled sleeves end at the elbow
	const soldier = outfitFor({ kind: 'military' }, 5);
	soldier.acc.push({ kind: 'gloves', col: '#2a2b2e' });
	const S = sleeveSpec(soldier);
	assert.equal(S.layers.at(-1).pat, 'camo'); assert.equal(S.layers.at(-1).fab, 'twill'); assert.equal(S.layers.at(-1).cuff, 'tab');
	assert.equal(S.glove.kind, 'tactical');
	const rolled = sleeveSpec({ ...soldier, outer: null, top: { ...soldier.top, sleeves: 'elbow', roll: true } });
	assert.equal(rolled.layers.length, 1); assert.equal(rolled.layers[0].length, 'rolled');
	// as third person dresses a soldier who rolls up: the jacket's sleeves rolled over a short-sleeved tee
	const jacketRolled = sleeveSpec({ ...soldier, top: { ...soldier.top, sleeves: 'short' }, outer: { ...soldier.outer, sleeves: 'rolled' } });
	assert.equal(jacketRolled.layers.length, 1); assert.equal(jacketRolled.layers[0].length, 'rolled'); assert.equal(jacketRolled.layers[0].pat, 'camo');
	// the police: a pressed uniform, hardly worn; the tactical team gloved
	const police = outfitFor({ kind: 'police' }, 11); police.top.sleeves = 'long';
	const ps = sleeveSpec(police);
	assert.equal(ps.glove, null); assert.ok(ps.layers[0].wear < 0.3);
	assert.equal(sleeveSpec(outfitFor({ fid: 'swat', kind: 'police' }, 4)).glove.kind, 'tactical');
	// two-colour garments: the sleeves in the second colour, as the body's own clothes paint them
	const block = sleeveSpec({ top: { kind: 'hoodie', pat: 'block', col: '#ff0000', acc: '#0000ff', sleeves: 'long' } }).layers[0];
	assert.equal(block.col, 0x0000ff);
});

// a small stand-in body: an arm at rest down and out to each side, its forearm a slightly
// flattened cylinder of skin, a hand of a few triangles
function body() {
	const names = [], heads = [];
	const add = (n, p) => { names.push(n); heads.push(new T.Vector3(...p)); };
	for (const [s, x] of [['L', 1], ['R', -1]]) {
		add('upperarm01.' + s, [0.165 * x, 1.349, 0.028]); add('lowerarm01.' + s, [0.328 * x, 1.172, 0.033]);
		add('lowerarm02.' + s, [0.387 * x, 1.11, 0.109]); add('wrist.' + s, [0.446 * x, 1.048, 0.186]);
		add('finger2-1.' + s, [0.472 * x, 1.008, 0.276]); add('finger5-1.' + s, [0.497 * x, 0.982, 0.223]);
		for (let k = 3; k <= 4; k++) add(`finger${k}-1.` + s, [(0.48 + k * 0.004) * x, 0.995, 0.26]);
	}
	const bones = names.map((n, i) => { const b = new T.Bone(); b.name = n; b.position.copy(heads[i]); b.updateMatrixWorld(true); return b; });
	const skeleton = new T.Skeleton(bones);
	const map = Object.fromEntries(names.map((n, i) => [n, i]));
	// the forearm's skin, as the body's vertices and as the hands' mesh
	const p = [], pos = [], nor = [], si = [], sw = [], ix = [];
	for (const s of ['L', 'R']) {
		const W = heads[map['wrist.' + s]], E = heads[map['lowerarm01.' + s]], A = E.clone().sub(W), L = A.length(); A.normalize();
		const U = new T.Vector3(0, 0, 1).cross(A).normalize(), V = new T.Vector3().crossVectors(A, U);
		const rows = 14, cols = 16, base = pos.length / 3;
		for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
			const t = i / rows, sAlong = -0.05 + t * (L + 0.05), th = j / cols * Math.PI * 2;
			const r = (0.026 + 0.014 * Math.max(0, sAlong) / L) * (1 + 0.15 * Math.cos(th));
			const d = U.clone().multiplyScalar(Math.cos(th)).addScaledVector(V, Math.sin(th));
			const v = W.clone().addScaledVector(A, sAlong).addScaledVector(d, r);
			p.push(v.x, v.y, v.z); pos.push(v.x, v.y, v.z); nor.push(d.x, d.y, d.z);
			const hand = sAlong < 0, b = hand ? map['wrist.' + s] : sAlong < L * 0.5 ? map['lowerarm02.' + s] : map['lowerarm01.' + s];
			si.push(b, 0, 0, 0); sw.push(1, 0, 0, 0);
		}
		for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = base + i * cols + j, b = base + i * cols + (j + 1) % cols, c = a + cols, d = b + cols; ix.push(a, c, b, b, c, d); }
	}
	const g = new T.BufferGeometry();
	g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
	g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4)); g.setIndex(ix);
	return { P: { bones, skeleton, map, _p: Float32Array.from(p), height: 1.75, rest: { heads } }, skin: g };
}

test('a sleeve is cut over the forearm, never inside it, skinned and within its triangle budget', () => {
	const { P, skin } = body();
	for (const top of [{ kind: 'hoodie', sleeves: 'long' }, { kind: 'shirt', sleeves: 'long' }, { kind: 'tee', sleeves: 'long' }]) {
		const spec = sleeveSpec({ top });
		const { geometry, hide, frames } = buildGarment(P, spec, skin, {});
		assert.ok(geometry, top.kind);
		const pos = geometry.attributes.position, sw = geometry.attributes.skinWeight, ga = geometry.attributes.garA, gb = geometry.attributes.garB;
		const v = new T.Vector3();
		for (let i = 0; i < pos.count; i++) {
			let sum = 0; for (let k = 0; k < 4; k++) sum += sw.getComponent(i, k);
			assert.ok(Math.abs(sum - 1) < 1e-4, 'weights sum to one');
			const F = frames[gb.getX(i) % 2 < 0.5 ? 'L' : 'R'], s = ga.getX(i);
			if (s < 0 || s > F.Lf) continue;
			// the skin's own radius here, at its fullest (the cylinder above)
			v.fromBufferAttribute(pos, i).sub(F.W); const r = v.addScaledVector(F.A, -v.dot(F.A)).length();
			const skinR = (0.026 + 0.014 * s / F.Lf) * 1.15;
			assert.ok(r > skinR + 0.0005, `${top.kind}: cloth at s=${s.toFixed(3)} r=${r.toFixed(4)} inside the skin ${skinR.toFixed(4)}`);
		}
		assert.ok(geometry.index.count / 3 < 4800, `${top.kind}: ${geometry.index.count / 3} triangles for two sleeves`);
		// the skin under the sleeve, above its cuff, is left out
		assert.ok(hide.size > 0);
	}
});

test('cuffs end at the wrist, a jacket stands over the shirt and shows its hem above it, rolled sleeves leave the forearm bare', () => {
	const { P } = body();
	const F = armFrame(P, 'L');
	const [inner, outer] = sleeveSpec({ top: { kind: 'shirt', sleeves: 'long' }, outer: { kind: 'denim', pat: 'denim', sleeves: 'long' } }).layers;
	const a = layerStations(inner, F, { far: 0.5 }), b = layerStations(outer, F, { far: 0.5, under: { ...a, wall: inner.wall } });
	assert.ok(a.hem > -0.01 && a.hem < 0.02, 'the shirt cuff at the wrist');
	assert.ok(b.hem > a.hem + 0.008, 'the jacket ends above the shirt cuff');
	for (const s of [0.03, 0.06, 0.12]) assert.ok(b.offAt(s) > a.offAt(s) + inner.wall, 'the jacket over the shirt at ' + s);
	const rolled = sleeveSpec({ top: { kind: 'longsleeve', pat: 'camo', sleeves: 'elbow', roll: true } }).layers[0];
	const r = layerStations(rolled, F, { far: 0.5 });
	assert.ok(Math.min(...r.stations.map((x) => x.s)) > F.Lf * 0.85, 'the rolled band sits at the elbow');
	const { P: P2, skin } = body();
	const { hide } = buildGarment(P2, sleeveSpec({ top: { kind: 'longsleeve', sleeves: 'elbow', roll: true } }), skin, {});
	assert.equal(hide.size, 0, 'nothing of the bare forearm is hidden');
});

test('gloves are shells over the hand that replace its skin triangle for triangle', () => {
	const { P, skin } = body();
	const { geometry, hide } = buildGarment(P, sleeveSpec({ top: { kind: 'tee', sleeves: 'short' }, acc: [{ kind: 'gloves', col: '#222222' }, { kind: 'helmet' }] }), skin, {});
	assert.ok(geometry); assert.ok(hide.size > 0);
	const gb = geometry.attributes.garB; let shell = 0;
	for (let i = 0; i < gb.count; i++) if (gb.getY(i) === 4) shell++;
	assert.ok(shell > 0);
});

test('the folds read the arm: bend, reach and which way is down', () => {
	const { P } = body();
	const F = armFrame(P, 'R');
	const out = { bend: 0, twist: 0, reach: 0, down: new T.Vector3() };
	const fwd = new T.Vector3(0, 0, -1), down = new T.Vector3(0, -1, 0);
	// straight out ahead from the shoulder: no bend, all reach
	armPose(F, new T.Vector3(0.2, -0.2, -0.3), new T.Vector3(0.2, -0.2, -0.55), new T.Vector3(0.2, -0.2, 0), F.palm, fwd, down, out);
	assert.ok(out.bend < 0.02); assert.ok(out.reach > 0.95);
	// a right angle at the elbow
	armPose(F, new T.Vector3(0.2, -0.5, 0), new T.Vector3(0.2, -0.5, -0.25), new T.Vector3(0.2, -0.2, 0), F.palm, fwd, down, out);
	assert.ok(Math.abs(out.bend - 2 / 3) < 0.02, String(out.bend));
	// down, in the forearm's frame at rest (no turn): along the arm and across it as at rest
	assert.ok(Math.abs(out.down.length() - 1) < 1e-6);
	assert.ok(Math.abs(out.down.x - down.dot(F.A)) < 1e-6);
	// the envelope never comes back inside the measured skin
	const env = forearmEnvelope(P, F);
	assert.ok(env(0.1, 0) > 0.026);
});

test('the shader finds every chunk it extends, and reads each vertex layer and side robustly', () => {
	const { P, skin } = body();
	const spec = sleeveSpec({ top: { kind: 'flannel', pat: 'plaid', sleeves: 'long' }, outer: { kind: 'leather', fab: 'leather', sleeves: 'long' }, acc: [{ kind: 'gloves' }, { kind: 'helmet' }] });
	const { geometry, frames } = buildGarment(P, spec, skin, {});
	// every vertex's layer-and-side id is a whole number in range (the shader rounds it before use)
	const gb = geometry.attributes.garB;
	for (let i = 0; i < gb.count; i++) { const x = gb.getX(i); assert.ok(Number.isInteger(x) && x >= 0 && x <= 5, String(x)); }
	for (const lite of [false, true]) {
		const m = garmentMaterial(spec, frames, { lite });
		const sh = { uniforms: {}, vertexShader: T.ShaderLib.physical.vertexShader, fragmentShader: T.ShaderLib.physical.fragmentShader };
		m.onBeforeCompile(sh);
		for (const k of ['garFold', 'transformed += normal * gH']) assert.ok(sh.vertexShader.includes(k), k);
		for (const k of ['garSurface(gc', 'roughnessFactor = gRough', 'material.specularColor *= gSpec', 'gAO']) assert.ok(sh.fragmentShader.includes(k), k);
		// an interpolated 1.9999 must not index past the per-side arrays (it read garbage per pixel: glitter)
		assert.ok(!/mod\(v?[gG]arB\.x/.test(sh.vertexShader + sh.fragmentShader));
		assert.ok(sh.fragmentShader.includes('int(vGarB.x + 0.5)'));
		// where the normal varies faster than a pixel, a broader highlight instead of glints
		assert.ok(sh.fragmentShader.includes('fwidth(normal)'));
	}
});
