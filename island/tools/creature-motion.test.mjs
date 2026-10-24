// How the creatures stand and go (creatures/motion.js), on their real rigs (the bones packed in
// each model, built here as three builds them, with no mesh): every kind through every pose,
// beat and blow with nothing gone wrong in its bones; the arms brought down from the sheet's
// spread pose to hang as the creature holds them (no T pose); no two of a mob the same, nor in
// step; their pace about 1 on the whole; the feet kept on the ground as they crouch. And what they
// stand on for the shade under them (creatures/contact.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createCreatureMotion, character } from '../src/creatures/motion.js';
import { standOf, footShade } from '../src/creatures/contact.js';

const dir = new URL('../assets/creatures/', import.meta.url);
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb'));
const san = (n) => n.replace(/[\s.[\]:/]/g, '');
// a model's nodes as three's GLTFLoader makes them (bones for the skin's joints, a skinned mesh
// with nothing in it), and its meta
function body(file) {
	const d = fs.readFileSync(new URL(file, dir));
	const len = d.readUInt32LE(12), j = JSON.parse(d.subarray(20, 20 + len).toString());
	const joints = new Set(j.skins?.[0]?.joints || []);
	const objs = j.nodes.map((n, i) => {
		const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D();
		o.name = san(n.name || '');
		if (n.translation) o.position.fromArray(n.translation);
		if (n.rotation) o.quaternion.fromArray(n.rotation);
		if (n.scale) o.scale.fromArray(n.scale);
		return o;
	});
	j.nodes.forEach((n, i) => { for (const c of n.children || []) objs[i].add(objs[c]); });
	const root = new THREE.Group();
	for (const i of j.scenes[0].nodes) root.add(objs[i]);
	const skin = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
	root.add(skin);
	root.updateMatrixWorld(true);
	skin.bind(new THREE.Skeleton([...joints].map((i) => objs[i])));
	return { root, meta: j.scenes[0].extras.creature, byName: new Map([...joints].map((i) => [objs[i].name, objs[i]])) };
}
// (a draw of its own for each seed, well mixed from the first number: mulberry32)
const seeded = (s) => () => {
	s = (s + 0x6d2b79f5) >>> 0;
	let t = Math.imul(s ^ (s >>> 15), 1 | s);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// (each test its own bodies: a motion takes the bones' turns as it finds them for their rest)
const kinds = files.map((f) => ({ f, meta: body(f).meta }));
const fresh = (K) => ({ f: K.f, ...body(K.f) });
// where a bone is in the body's own frame
const _v = new THREE.Vector3();
function at(K, M, n) {
	K.root.updateMatrixWorld(true);
	const p = M.at(n, _v);
	return p ? p.clone() : null;
}
function finite(K) {
	let ok = true;
	K.root.traverse((o) => {
		for (const x of [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w]) if (!Number.isFinite(x)) ok = false;
	});
	return ok;
}

test('every kind stands, menaces, walks, runs, backs off, slides, skids, strikes, reels and dies with its bones whole', () => {
	assert.ok(kinds.length >= 20);
	for (const K0 of kinds) {
		const K = fresh(K0), M = createCreatureMotion(K.root, K.meta);
		assert.ok(M, K.f);
		for (const seed of [1, 7, 99]) {
			M.character(seeded(seed), { tame: K.f === 'moonturned.glb' });
			const run = (sec, o) => { for (let t = 0; t < sec; t += 1 / 30) M.update(1 / 30, o); assert.ok(finite(K), `${K.f} seed ${seed} ${JSON.stringify(o)}`); };
			run(1.5, {});
			run(1.5, { menace: 1 });
			run(1.5, { speed: 1.4 * M.pace() });
			run(1, { speed: 6 });
			run(0.6, { speed: 3, skid: 1 });
			run(1, { speed: -1.2, menace: 1 });
			run(1, { side: 1.3, menace: 1 });
			run(1, { turn: 2.5 });
			run(0.6, { speed: 0.3, look: 1.1, menace: 1 });
			for (const kind of ['chop', 'sweep', 'lunge', 'double', 'pounce', 'bite', 'shake', 'swipe', 'stab', undefined]) { M.strike(undefined, kind); run(1, { menace: 1 }); }
			for (const b of ['twitch', 'tilt', 'crack', 'crouch', 'claws', 'scratch', 'look', 'sway', 'sniff', 'shrug', 'feint', 'taunt', 'hop', 'growl', 'scrape', 'pant', 'stretch', 'snap', 'stalk', 'shake', 'bob', 'tap', 'groom', 'rear']) { M.beat(b); run(0.8, { menace: 0.5 }); }
			M.hit(new THREE.Vector3(0, 0, -1), 2); run(0.6, {});
			M.drain();
			run(0.5, { dormant: 1 });
		}
		M.die(); for (let t = 0; t < 2; t += 1 / 30) M.update(1 / 30, {});
		assert.ok(finite(K), `${K.f} dead`);
		for (const name of ['rest', 'walk', 'run', 'strike', 'hit', 'death', 'skid', 'menace', 'dormant', 'twitch']) { M.pose(name, 0.4); assert.ok(finite(K), `${K.f} pose ${name}`); }
	}
});

test('arms drawn spread on the sheet hang in as the creature holds them, not out in a T', () => {
	for (const f of ['drain-skulker.glb', 'flarepot.glb', 'hollow-king.glb', 'burnt-giant.glb', 'old-drain-king.glb']) {
		const K = fresh({ f }), M = createCreatureMotion(K.root, K.meta);
		const H = K.meta.height;
		// (the sheet's pose: every bone at its rest turn)
		const B0 = body(f), sheet = createCreatureMotion(B0.root, B0.meta);
		// how far out to its side each arm points, shoulder to hand (1 straight out, as in a T; 0
		// hanging, or reaching ahead)
		const out = (Q, MM) => ['L', 'R'].reduce((sum, sd) => {
			const a = at(Q, MM, 'upperarm_' + sd), b = at(Q, MM, 'hand_' + sd);
			return sum + Math.abs(b.x - a.x) / a.distanceTo(b) / 2;
		}, 0);
		const out0 = out(B0, sheet);
		for (const seed of [3, 11, 42, 77]) {
			M.character(seeded(seed));
			for (let t = 0; t < 2; t += 1 / 30) M.update(1 / 30, {});
			const o = out(K, M);
			assert.ok(o < out0 * 0.9, `${f} seed ${seed}: arms ${o.toFixed(2)} out to the side, the sheet's ${out0.toFixed(2)}`);
			assert.ok(o < 0.6, `${f} seed ${seed}: arms ${o.toFixed(2)} out`);
		}
	}
});

test('no two of a mob the same: each its own stance, stride and pace, out of step with the rest', () => {
	const P = Array.from({ length: 12 }, (_, i) => character(seeded(i * 31 + 5)));
	for (const key of ['hunch', 'low', 'cad', 'stride', 'spread', 'phase']) {
		const v = P.map((p) => p[key]);
		assert.ok(Math.max(...v) - Math.min(...v) > (key === 'phase' ? 3 : 0.05), `${key} spread: ${v.map((x) => x.toFixed(2))}`);
	}
	assert.ok(new Set(P.map((p) => p.threat)).size >= 2, 'more than one way of menacing');
	// a tame one (a person still) stands as one: barely hunched, no threat
	const T = character(seeded(9), { tame: true });
	assert.equal(T.threat, null);
	assert.ok(T.hunch <= 0.2 && T.low <= 0.15, `tame hunch ${T.hunch} low ${T.low}`);
	// the same kind at the same speed: each starts its stride at its own moment, and steps at its
	// own rate (so a mob marching together never falls into step)
	const K = { f: 'drain-skulker.glb', meta: body('drain-skulker.glb').meta };
	const start = [], rate = [];
	for (const seed of [2, 3, 4, 5, 6, 7]) {
		const M = createCreatureMotion(body(K.f).root, K.meta);
		M.character(seeded(seed));
		start.push(M.state.phase);
		let turned = 0, last = M.state.phase;
		for (let t = 0; t < 4; t += 1 / 30) {
			M.update(1 / 30, { speed: 1.4 });
			turned += (M.state.phase - last + Math.PI * 3) % (Math.PI * 2) - Math.PI;
			last = M.state.phase;
		}
		rate.push(turned / 4);
	}
	assert.ok(Math.max(...start) - Math.min(...start) > 2, `start phases ${start.map((x) => x.toFixed(2))}`);
	assert.ok(Math.max(...rate) / Math.min(...rate) > 1.08, `stride rates ${rate.map((x) => x.toFixed(2))}`);
	assert.ok(rate.every((r) => r > 0), 'all stepping forward');
});

test('its own pace is about 1 on the whole, never a dead stop for long nor a sprint', () => {
	const K = fresh({ f: 'ridge-hound.glb' }), M = createCreatureMotion(K.root, K.meta);
	let sum = 0, n = 0, lo = 9, hi = 0;
	for (let seed = 1; seed <= 30; seed++) {
		M.character(seeded(seed));
		for (let t = 0; t < 12; t += 1 / 30) {
			const k = M.pace();
			M.update(1 / 30, { speed: 1.5 * k });
			sum += k; n++; lo = Math.min(lo, k); hi = Math.max(hi, k);
		}
	}
	assert.ok(sum / n > 0.82 && sum / n < 1.12, `mean pace ${(sum / n).toFixed(3)}`);
	assert.ok(lo >= 0.08 && hi <= 1.6, `pace ${lo.toFixed(2)}..${hi.toFixed(2)}`);
});

test('standing, crouched or not, a biped keeps its feet on the ground', () => {
	for (const K0 of kinds.filter((k) => k.meta.rig === 'biped' && k.meta.joints?.foot_L)) {
		const K = fresh(K0), M = createCreatureMotion(K.root, K.meta);
		const H = K.meta.height, y0 = K.meta.joints.foot_L[0][1];
		for (const seed of [5, 6, 8, 13]) {
			M.character(seeded(seed));
			// (standing: no beat now, a step or a hop in one lifts a foot as it should)
			M.state.beat = null; M.state.beatT = 1e9;
			for (const menace of [0, 1]) {
				for (let t = 0; t < 2.5; t += 1 / 30) M.update(1 / 30, { menace });
				const y = Math.min(at(K, M, 'foot_L').y, at(K, M, 'foot_R').y);
				assert.ok(Math.abs(y - y0) < H * 0.08, `${K.f} seed ${seed} menace ${menace}: lower foot at ${y.toFixed(3)}, rest ${y0.toFixed(3)} (H ${H})`);
			}
		}
	}
});

test('every kind has feet and a body to lay its shade under, and a lifting foot lets its shade go', () => {
	for (const K of kinds) {
		const S = standOf(K.meta);
		const J = K.meta.joints || {};
		const want = K.meta.rig === 'biped' ? ['foot_L', 'foot_R'].filter((n) => J[n]).length : K.meta.rig === 'quad' ? 4 : 0;
		assert.equal(S.feet.length, want, `${K.f} (${K.meta.rig}) feet ${S.feet.map((f) => f.bone)}`);
		for (const f of S.feet) assert.ok(f.r > 0 && Number.isFinite(f.y0) && Number.isFinite(f.fz), `${K.f} ${f.bone}`);
		const B = S.body;
		assert.ok(B.rx > 0 && B.rz > 0 && Number.isFinite(B.cz) && B.rx <= S.H * 0.6 && B.rz <= S.H * 0.9, `${K.f} body ${JSON.stringify(B)}`);
		assert.ok(S.hipH > 0 && S.hipH < S.H, `${K.f} hips ${S.hipH}`);
	}
	assert.equal(footShade(0, 1), 1);
	assert.equal(footShade(0.2, 1), 0);
	let last = 1;
	for (let l = 0; l <= 0.25; l += 0.01) { const k = footShade(l, 1); assert.ok(k <= last + 1e-9 && k >= 0); last = k; }
});

test('no moment between blows holds an arm out level to the side, as in a T', () => {
	const beats = ['twitch', 'tilt', 'crack', 'crouch', 'claws', 'scratch', 'look', 'sway', 'sniff', 'shrug', 'feint', 'taunt', 'hop'];
	const bad = [];
	for (const K0 of kinds.filter((k) => k.meta.rig === 'biped' && k.meta.joints?.upperarm_L && k.meta.joints?.hand_L)) {
		const K = fresh(K0), M = createCreatureMotion(K.root, K.meta);
		for (const seed of [4, 9, 21]) {
			M.character(seeded(seed));
			for (const name of ['rest', 'menace', 'walk', 'run', ...beats]) for (const t of name === 'rest' || name === 'menace' ? [0] : [0.25, 0.5, 0.75]) {
				M.pose(name, t);
				K.root.updateMatrixWorld(true);
				for (const sd of ['L', 'R']) {
					const a = M.at('upperarm_' + sd, new THREE.Vector3()), b = M.at('hand_' + sd, new THREE.Vector3());
					// (out to its own side; a hand brought in across it, to its face, is not)
					const out = (b.x - a.x) * (sd === 'L' ? 1 : -1) / a.distanceTo(b), up = (b.y - a.y) / a.distanceTo(b);
					if (out > 0.8 && Math.abs(up) < 0.45) bad.push(`${K.f} seed ${seed} ${name} ${t}: arm ${sd} out ${out.toFixed(2)}, up ${up.toFixed(2)}`);
				}
			}
		}
	}
	assert.deepEqual(bad, []);
});
