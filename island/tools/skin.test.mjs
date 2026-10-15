// The skin layer: its programs (two per device), the shader chunks it is written into, and the
// map hand-surface.js lays on your hands for it (the hand's frame, the finger joints, the nails,
// the shade between the fingers, how far each finger is closed).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { skinMaterial, skinVariant, skinDetail, SKIN_CHUNKS } from '../src/people/skin.js';
import { handFrames, handAttributes, fingerChains, fingerCurls, bakeShade, handLook, refineHandSurface } from '../src/people/hand-surface.js';

// a small rig: forearm, wrist, four metacarpals, five fingers of three bones, both sides (the
// left mirrored); the back of the hand faces +y, the fingers run along +z, the thumb lies
// below the palm (in front of it)
function rig() {
	const bones = [], heads = [], tails = [], map = {};
	const add = (name, h, t, parent) => {
		const b = new T.Bone(); b.name = name; if (parent != null) bones[parent].add(b);
		map[name] = bones.length; bones.push(b); heads.push(new T.Vector3(...h)); tails.push(new T.Vector3(...t));
		return bones.length - 1;
	};
	for (const side of ['R', 'L']) {
		const m = side === 'R' ? 1 : -1, X = (x) => x * m;
		const e1 = add('lowerarm01.' + side, [X(0.3), 0, -0.25], [X(0.3), 0, -0.12]);
		const e2 = add('lowerarm02.' + side, [X(0.3), 0, -0.12], [X(0.3), 0, 0], e1);
		const w = add('wrist.' + side, [X(0.3), 0, 0], [X(0.3), 0, 0.03], e2);
		const xs = [-0.033, -0.011, 0.011, 0.033];
		const meta = xs.map((x, k) => add(`metacarpal${k + 1}.` + side, [X(0.3), 0, 0.03], [X(0.3 + x), 0, 0.1], w));
		for (let f = 2; f <= 5; f++) {
			const x = X(0.3 + xs[f - 2]);
			const a = add(`finger${f}-1.` + side, [x, 0, 0.1], [x, 0, 0.145], meta[f - 2]);
			const b = add(`finger${f}-2.` + side, [x, 0, 0.145], [x, 0, 0.173], a);
			add(`finger${f}-3.` + side, [x, 0, 0.173], [x, 0, 0.195], b);
		}
		const t1 = add('finger1-1.' + side, [X(0.275), -0.01, 0.025], [X(0.255), -0.025, 0.05], w);
		const t2 = add('finger1-2.' + side, [X(0.255), -0.025, 0.05], [X(0.25), -0.032, 0.072], t1);
		add('finger1-3.' + side, [X(0.25), -0.032, 0.072], [X(0.248), -0.036, 0.092], t2);
	}
	const dirs = heads.map((h, i) => tails[i].clone().sub(h).normalize());
	return { bones, map, rest: { heads, tails, dirs }, dna: { male: true, age: 40 } };
}
// one vertex at p (normal n) wholly on a bone
function surface(P, verts) {
	const pos = [], nor = [], si = [], sw = [];
	for (const [bone, p, n] of verts) { pos.push(...p); nor.push(...n); si.push(P.map[bone], 0, 0, 0); sw.push(1, 0, 0, 0); }
	const g = new T.BufferGeometry();
	g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
	g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
	const ix = []; for (let i = 0; i + 2 < verts.length; i++) ix.push(i, i + 1, i + 2);
	g.setIndex(ix);
	return g;
}

test('two skin programs on any device: one for the crowd, one for your hands', () => {
	const keys = new Set();
	for (const phone of [false, true]) {
		const crowd = skinVariant({ phone }), hero = skinVariant({ closeup: true, phone });
		assert.notEqual(crowd.key, hero.key);
		assert.ok(hero.defines.includes('SKIN_HERO') && !crowd.defines.includes('SKIN_HERO'));
		assert.ok(crowd.defines.includes(phone ? 'SKIN_PORES_LITE' : 'SKIN_PORES'));
		assert.equal(hero.defines.includes('SKIN_LITE'), phone);
		keys.add(crowd.key); keys.add(hero.key);
	}
	assert.equal(keys.size, 4);
	// (a quality tier only changes a uniform)
	const a = skinMaterial(null, new T.Color(1, 0.8, 0.7), 30), b = skinMaterial(null, new T.Color(0.5, 0.3, 0.2), 70);
	assert.equal(a.customProgramCacheKey(), b.customProgramCacheKey());
});

test('the fine detail steps down with the quality tier and comes in nearer on a phone', () => {
	const tiers = ['high', 'medium', 'low', 'minimal'].map((t) => skinDetail(t, false).detail);
	for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] < tiers[i - 1]);
	assert.ok(tiers[3] > 0);
	assert.ok(skinDetail('high', true).far < skinDetail('high', false).far);
});

test('the skin is written into every chunk it needs, the hands\' layer only into theirs', () => {
	const L = T.ShaderLib.physical;
	for (const c of SKIN_CHUNKS.vertex) assert.ok(L.vertexShader.includes(c), c);
	for (const c of SKIN_CHUNKS.fragment) assert.ok(L.fragmentShader.includes(c) || T.ShaderChunk.lights_fragment_begin.includes(c), c);
	for (const closeup of [false, true]) {
		const m = skinMaterial(null, new T.Color(0.8, 0.6, 0.5), 40, { closeup });
		const sh = { vertexShader: L.vertexShader, fragmentShader: L.fragmentShader, uniforms: {} };
		m.onBeforeCompile(sh);
		for (const s of ['RE_Direct_Skin', 'skinEnvBRDF( material.specularColor', 'skinBaseN = normal', 'float ao = vSkin.x * skinCav', 'blotches']) assert.ok(sh.fragmentShader.includes(s), s);
		assert.equal(sh.fragmentShader.includes('void heroSkin('), closeup);
		assert.equal(sh.vertexShader.includes('#define SKIN_HERO'), closeup);
		assert.equal(!!sh.uniforms.uCurl, closeup);
		assert.ok(sh.uniforms.uSkinQ && sh.uniforms.uSkin);
	}
});

test('the hand\'s frame: across the knuckles, along to them, and out of its back away from the thumb', () => {
	const P = rig(), F = handFrames(P);
	for (const side of ['R', 'L']) {
		const f = F[side];
		assert.ok(f.D.y > 0.99, side + ' back of the hand faces +y');
		assert.ok(f.Y.z > 0.99);
		assert.ok(Math.abs(f.L - 0.1) < 1e-6);
		assert.ok(Math.abs(f.span - 0.033) < 1e-6);
		// (the thumb's knuckle sits on the thumb's side, part way along the hand)
		assert.ok(f.thumb[0] < -1 && f.thumb[1] > 0.3 && f.thumb[1] < 0.7, JSON.stringify(f.thumb));
	}
});

test('the map on a hand: which way it faces, the joints, the nail, which finger', () => {
	const P = rig();
	const g = surface(P, [
		['finger2-3.R', [0.267, 0.006, 0.188], [0, 1, 0]],     // the back of the index fingertip
		['finger2-2.R', [0.267, 0.007, 0.145], [0, 1, 0]],     // over its middle joint
		['metacarpal2.R', [0.3, -0.012, 0.06], [0, -1, 0]],    // the palm
		['lowerarm02.R', [0.3, 0.02, -0.1], [0, 1, 0]],        // the forearm
		['finger3-2.L', [-0.289, -0.007, 0.16], [0, -1, 0]],   // the palm side of the left middle finger
	]);
	handAttributes(P, g);
	const A = g.attributes.handA, B = g.attributes.handB, C = g.attributes.handC;
	assert.ok(A.getX(0) > 0.9 && A.getX(2) < 0.1, 'back and palm');
	assert.ok(C.getW(0) >= 0 && C.getW(0) <= 1, 'on the nail: ' + C.getW(0));
	assert.ok(B.getW(0) > 0.5, 'the nail is on the back of the finger');
	assert.ok(Math.abs(C.getY(1)) < 0.001, 'at the middle joint: ' + C.getY(1));
	assert.ok(C.getW(1) > 1.5, 'no nail over the middle joint');
	assert.equal(C.getW(2), 9);
	assert.ok(B.getY(3) < 0, 'the forearm runs back from the wrist');
	assert.ok(B.getY(2) > 0 && B.getY(2) < 1, 'the palm lies between the wrist and the knuckles');
	assert.equal(Math.round(A.getW(0) * 255), 2);
	assert.equal(Math.round(A.getW(2) * 255), 0);
	assert.equal(Math.round(A.getW(3) * 255), 0);
	assert.equal(Math.round(A.getW(4) * 255), 9);
	assert.ok(A.getZ(0) > A.getZ(2), 'a fingertip is thinner than the palm');
	assert.ok(g.userData.handMapped);
});

test('the map goes into the blank slots a refined surface is made with', () => {
	const P = rig();
	const src = surface(P, [['finger2-3.R', [0.267, 0.006, 0.188], [0, 1, 0]], ['finger2-2.R', [0.267, 0.007, 0.15], [0, 1, 0]], ['finger2-2.R', [0.272, 0.006, 0.16], [0, 1, 0]]]);
	const g = refineHandSurface(src, [0, 1, 2], 1), slot = g.attributes.handA, n = g.attributes.position.count;
	assert.equal(slot.count, n);
	for (let v = 0; v < n; v++) assert.equal(g.attributes.handC.getW(v), 9);
	handAttributes(P, g);
	assert.equal(g.attributes.handA, slot, 'the same attribute, its data sent again');
	assert.ok(slot.version > 0);
	assert.ok(g.attributes.handC.getW(0) < 9);
});

test('how far each finger is closed, from the bones, without allocating', () => {
	const P = rig(), chains = fingerChains(P), out = new Float32Array(12);
	assert.equal(chains.length, 10);
	const bones = P.bones.map(() => ({ matrixWorld: new T.Matrix4() }));
	fingerCurls(chains, bones, out);
	assert.ok(out.every((x) => x < 1e-6), 'open at rest');
	// the right middle finger curled 80 degrees at each of its three joints
	const turn = (deg) => new T.Matrix4().makeRotationX(-deg * Math.PI / 180);
	bones[P.map['finger3-1.R']].matrixWorld = turn(80); bones[P.map['finger3-2.R']].matrixWorld = turn(160); bones[P.map['finger3-3.R']].matrixWorld = turn(240);
	fingerCurls(chains, bones, out);
	assert.ok(out[3] > 0.9, 'a fist: ' + out[3]);
	assert.ok(Math.abs(out[0] - out[3] / 4) < 1e-6, 'the palm takes the mean of the four');
	assert.ok(out[9] < 1e-6, 'the left hand is still open');
});

test('the shade between fingers: the sides facing each other darker than the sides facing out', () => {
	const a = new T.CylinderGeometry(0.008, 0.008, 0.06, 24, 20), g = mergeGeometries([a, a.clone().translate(0.02, 0, 0)]);
	const ao = bakeShade(g.attributes.position, g.attributes.normal, g.index), pos = g.attributes.position, nor = g.attributes.normal;
	let facing = 0, away = 0, nf = 0, na = 0;
	for (let v = 0; v < pos.count; v++) {
		if (Math.abs(pos.getY(v)) > 0.02 || pos.getX(v) > 0.01) continue;
		if (nor.getX(v) > 0.9) { facing += ao[v]; nf++; } else if (nor.getX(v) < -0.9) { away += ao[v]; na++; }
	}
	assert.ok(nf && na);
	assert.ok(facing / nf < 0.6 && away / na > 0.95, `${facing / nf} ${away / na}`);
});

test('body hair and veins by the body', () => {
	const [manHair, manVeins] = handLook({ male: true, age: 45, weight: 0.4, muscle: 0.6 }), [womanHair, womanVeins] = handLook({ male: false, age: 25, weight: 0.6, muscle: 0.4 });
	assert.ok(manHair > womanHair * 2);
	assert.ok(manVeins > womanVeins);
	for (const x of [manHair, manVeins, womanHair, womanVeins]) assert.ok(x >= 0 && x <= 1);
});
