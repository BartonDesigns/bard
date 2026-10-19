// The crew from afar as real people too: one worker's body (people/body.js, the MakeHuman base
// mesh) dressed as the crews dress (crewpeople.js workerStyle: the hi-vis vest, the hard hat,
// boots), posed twice for each part of the work (a stride with each foot forward, with a block
// in front, a bar on the shoulder or a pane at the side; the hammer struck and drawn up; the
// shovel dug in and thrown; the arm up signalling; down on one knee laying), its tool baked in
// with it, then thinned to a couple of thousand points as people/crowd.js does. Each worker
// is an instance of their pose's mesh in their own colours (skin, shirt, vest, trousers, hat),
// blended between the pose's two keys on the GPU as the work goes on. crewfolk.js draws these
// once they are made (a pose a frame), and its old figure until then.

import * as THREE from 'three';
import { buildPerson, personDNA, freeBody, rng } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { ACTIONS } from '../people/actions.js';
import { workerStyle, toolGeometry, toolMatrix, TOOL_OF } from './crewpeople.js';

// each pose's two keys: [action, u]; 'stride+X' a walking stride with the arms of X
export const BAKES = {
	walk: [['stride', 0], ['stride', 1]],
	carry: [['stride+crewCarry', 0], ['stride+crewCarry', 1]],
	shoulder: [['stride+crewShoulder', 0], ['stride+crewShoulder', 1]],
	pane: [['stride+crewPane', 0], ['stride+crewPane', 1]],
	hammer: [['crewHammer', 0], ['crewHammer', 1]],
	shovel: [['crewShovel', 0.2], ['crewShovel', 0.66]],
	guide: [['crewGuide', 0], ['crewGuide', 0.5]],
	pour: [['crewPour', 0], ['crewPour', 0]],
	lay: [['crewLay', 0], ['crewLay', 0.5]],
	talk: [[null, 0], ['crewTalk', 0]],
};
export const BAKE_POSES = Object.keys(BAKES);
// (the poses the site asks for that wear another's: the glazier at the hammer, standing by as talking)
export const BAKE_OF = { idle: 'talk', glazier: 'hammer' };

// a held action of a stride's legs and another's arms (for a walker carrying something)
function composite(name, u) {
	const [, arms] = name.split('+'), S = ACTIONS.stride.keys[u > 0.5 ? 1 : 0][1], X = ACTIONS[arms].keys[0][1];
	ACTIONS.__crewBake = { loop: false, keys: [[0, { ...S, L: X.L || S.L, R: X.R || S.R, sp: X.sp, hd: X.hd }]] };
	return '__crewBake';
}
const V = new THREE.Vector3(), TM = new THREE.Matrix4();
// one worker, built once for the bake and let go after (A: the people assets)
export function bakeBody(A) {
	const d = personDNA(0x5eedc4e3, { age: 36, style: workerStyle(7, rng(0xc4e3)) });
	d.male = true; d.sex = 0.88; d.height = 1.76; d.weight = 0.25; d.muscle = 0.35;
	const P = buildPerson(A, d), M = createMotion(P, () => 0);
	M.S.hand = 'R';
	M.place(0, 0, 0, 0);
	return { P, M, done: () => freeBody(P) };
}
// a pose's two keys baked into one thinned geometry: position and normal the first key,
// position2 (w: the colour region) and normal2 the second, color what the tool and the gloves
// are made of. Regions: 0 skin, 1 shirt, 2 vest, 3 trousers, 4 boots, 5 the hair's shade, 6
// the hat, 7 its own colour
export function bakePose(B, pose, CELL = 0.03) {
	const { P, M } = B;
	const neck = P.height * 0.84;
	const capture = ([name, u]) => {
		M.place(0, 0, 0, 0);
		M.act(name && name.includes('+') ? composite(name, u) : name, name ? u : undefined);
		if (!name) M.act(null);
		M.setPose('rest'); M.want.speed = 0; M.S.gestures.length = 0;
		for (let i = 0; i < 40; i++) M.update(1 / 20, i / 20, null);
		P.root.updateMatrixWorld(true);
		const out = [], col = [];
		for (const [mesh, kind] of [[P.skin, 0], [P.cloth, 1], [P.acc, 2]]) {
			if (!mesh) continue;
			mesh.skeleton.update();
			const g = mesh.geometry, pa = g.attributes.position, sl = g.attributes.slot, sc = g.attributes.scalp, ca = g.attributes.color;
			for (let i = 0; i < pa.count; i++) {
				V.fromBufferAttribute(pa, i); mesh.applyBoneTransform(i, V); V.applyMatrix4(mesh.matrixWorld);
				let r = 0;
				if (kind === 0) r = sc && sc.getX(i) > 0.5 ? 5 : 0;
				else if (kind === 1) r = [1, 2, 3, 4][Math.min(3, sl.getX(i) % 10)];
				else r = V.y > neck ? 6 : 7;
				out.push(V.x, V.y, V.z, r);
				col.push(ca ? ca.getX(i) : 1, ca ? ca.getY(i) : 1, ca ? ca.getZ(i) : 1);
			}
		}
		// the tool where it is held
		const tk = TOOL_OF[pose];
		if (tk && tk !== 'pane' && toolMatrix(P, M.S, tk, name === 'crewHammer' ? u : name === 'crewShovel' ? u : 0, TM)) {
			const g = toolGeometry(tk), pa = g.attributes.position, ca = g.attributes.color;
			for (let i = 0; i < pa.count; i++) { V.fromBufferAttribute(pa, i).applyMatrix4(TM); out.push(V.x, V.y, V.z, 7); col.push(ca.getX(i), ca.getY(i), ca.getZ(i)); }
		}
		return { out, col };
	};
	const [K0, K1] = BAKES[pose];
	const a = capture(K0), b = capture(K1);
	M.act(null);
	// the triangles: each mesh's own, then the tool's (in threes)
	const idx = [];
	let base = 0;
	for (const mesh of [P.skin, P.cloth, P.acc]) if (mesh) { const I = mesh.geometry.index.array; for (let i = 0; i < I.length; i++) idx.push(I[i] + base); base += mesh.geometry.attributes.position.count; }
	for (let i = base; i < a.out.length / 4; i++) idx.push(i);
	// thinned: points in the same small cell (and region) become one
	const n = a.out.length / 4, cl = new Map(), map = new Int32Array(n), acc = [];
	for (let i = 0; i < n; i++) {
		const A = a.out, r = A[i * 4 + 3], c = r === 7 ? CELL * 0.5 : CELL;
		const key = `${Math.floor(A[i * 4] / c)},${Math.floor(A[i * 4 + 1] / c)},${Math.floor(A[i * 4 + 2] / c)},${r}`;
		let k = cl.get(key);
		if (k === undefined) { k = acc.length; cl.set(key, k); acc.push({ a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0], n: 0, r }); }
		const C = acc[k];
		for (let j = 0; j < 3; j++) { C.a[j] += A[i * 4 + j]; C.b[j] += b.out[i * 4 + j]; C.c[j] += a.col[i * 3 + j]; }
		C.n++; map[i] = k;
	}
	const pos = new Float32Array(acc.length * 3), p2 = new Float32Array(acc.length * 4), pos2 = new Float32Array(acc.length * 3), colr = new Float32Array(acc.length * 3);
	acc.forEach((C, i) => { for (let j = 0; j < 3; j++) { pos[i * 3 + j] = C.a[j] / C.n; pos2[i * 3 + j] = p2[i * 4 + j] = C.b[j] / C.n; colr[i * 3 + j] = C.c[j] / C.n; } p2[i * 4 + 3] = C.r; });
	const tri = [];
	for (let i = 0; i < idx.length; i += 3) { const x = map[idx[i]], y = map[idx[i + 1]], z = map[idx[i + 2]]; if (x !== y && y !== z && x !== z) tri.push(x, y, z); }
	const g = new THREE.BufferGeometry();
	g.setIndex(tri);
	g.setAttribute('position', new THREE.BufferAttribute(pos2, 3)); g.computeVertexNormals();
	const n2 = g.attributes.normal.clone();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
	g.setAttribute('position2', new THREE.BufferAttribute(p2, 4));
	g.setAttribute('normal2', n2);
	g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
	g.computeBoundingSphere();
	g.boundingSphere.radius += 1.5;
	return g;
}

// how far between a pose's two keys a worker is (t the task's clock, t2 their own)
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export function bakeBlend(pose, t, t2) {
	const TAU = Math.PI * 2;
	if (pose === 'walk' || pose === 'carry' || pose === 'shoulder' || pose === 'pane') return 0.5 + 0.5 * Math.sin(TAU * t);
	if (pose === 'hammer' || pose === 'glazier') { const f = (t * 1.4) % 1; return f < 0.72 ? smooth(f / 0.72) : 1 - smooth((f - 0.72) / 0.08); }
	if (pose === 'shovel') return 0.5 - 0.5 * Math.cos(TAU * ((t * 0.42) % 1));
	if (pose === 'guide') return 0.5 - 0.5 * Math.cos(TAU * t);
	if (pose === 'lay') return 0.5 - 0.5 * Math.cos(TAU * t * 0.3);
	if (pose === 'talk') return smooth((Math.sin(t2 * 0.45) - 0.3) / 0.3);
	return 0;
}
