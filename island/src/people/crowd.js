// Crowds for far off and by the hundred: the people in the stands, the promenade seen from
// down the beach. A handful of real bodies (body.js), men and women, young and old, slight
// and heavy, each posed twice (sat with hands in the lap and sat cheering with arms up; or a
// stride with the left foot forward and one with the right), baked into still meshes and
// thinned to a couple of thousand vertices. Every person in the crowd is one instance of one
// of them, in their own colours (skin, top, jacket, trousers, shoes, hair, picked by
// wardrobe.js by their generation), blending between the two poses on the GPU: a cheer
// that goes up and down, a walk. One draw call a body shape, whatever the crowd's size.

import * as THREE from 'three';
import { loadPeopleAssets, peopleAssetsNow, buildPerson, personDNA, rng } from './body.js';
import { createMotion } from './motion.js';
import { dressFor } from './wardrobe.js';

const SHAPES = [{ age: 27, male: false }, { age: 35, male: true }, { age: 54, male: true, weight: 0.65 }, { age: 63, male: false, weight: 0.35 }, { age: 19, male: false }, { age: 11, male: true }];
const CELL = 0.035;
const templates = { seat: [], walk: [], stand: [] };

// one shape posed two ways, baked and thinned
function bake(A, k, kind) {
	const q = SHAPES[k];
	let d = null;
	for (let t = 0; t < 30; t++) { d = personDNA((k * 7919 + t * 104729 + 3) >>> 0, { age: q.age, ctx: { place: 'suburb', activity: 'walk', cold: 0.5 } }); if (d.male === q.male) break; }
	if (q.weight !== undefined) d.weight = q.weight;
	// a plain cut that covers most: long sleeves on some, short on others (the colours are the instance's)
	d.style = { gen: 'crowd', top: { kind: 'tee', col: '#888888', pat: 'plain', fit: 'regular', sleeves: k % 2 ? 'long' : 'short' }, outer: k === 1 || k === 3 ? { kind: 'jacket', col: '#666666', pat: 'plain', fit: 'regular', sleeves: 'long', open: true } : null, bottom: { kind: 'jeans', col: '#555555', pat: 'plain', legs: k === 4 ? 'skirt' : 'long', len: 'mini', fit: k === 0 ? 'wide' : 'straight' }, shoes: { kind: 'sneaker', col: '#eeeeee', sole: '#eeeeee' }, acc: [], hair: { buzz: true } };
	d.styleSig = JSON.stringify(d.outfit);
	d.hair = d.hair || 'short02';
	const P = buildPerson(A, d), M = createMotion(P, () => 0);
	M.place(0, 0, 0, 0);
	const pose = (which) => {
		if (kind === 'seat') { M.sit(0.45, true); if (which) M.act('cheer', 0.5); else { M.act(null); M.setPose('lap'); } }
		else if (kind === 'walk') M.act('stride', which);
		else if (which) M.act('cheer', 0.5); else M.act(null);
		for (let i = 0; i < 36; i++) M.update(1 / 20, i / 20, null);
		P.root.updateMatrixWorld(true);
		const out = [];
		for (const [mesh, region] of [[P.skin, 0], [P.cloth, 1]]) {
			if (!mesh) continue;
			mesh.skeleton.update();
			const pa = mesh.geometry.attributes.position, sl = mesh.geometry.attributes.slot, sc = mesh.geometry.attributes.scalp, v = new THREE.Vector3();
			for (let i = 0; i < pa.count; i++) {
				v.fromBufferAttribute(pa, i); mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld);
				out.push(v.x, v.y, v.z, region ? 1 + (sl.getX(i) % 10) : sc && sc.getX(i) > 0.5 ? 5 : 0);
			}
		}
		return out;
	};
	const a = pose(0), b = pose(1);
	// thinned: vertices in the same small cell (and the same colour region) become one
	const idx = [];
	let base = 0;
	for (const mesh of [P.skin, P.cloth]) if (mesh) { const I = mesh.geometry.index.array; for (let i = 0; i < I.length; i++) idx.push(I[i] + base); base += mesh.geometry.attributes.position.count; }
	const n = a.length / 4, cl = new Map(), map = new Int32Array(n);
	const acc = [];
	for (let i = 0; i < n; i++) {
		const key = `${Math.floor(a[i * 4] / CELL)},${Math.floor(a[i * 4 + 1] / CELL)},${Math.floor(a[i * 4 + 2] / CELL)},${a[i * 4 + 3]}`;
		let c = cl.get(key);
		if (c === undefined) { c = acc.length; cl.set(key, c); acc.push({ a: [0, 0, 0], b: [0, 0, 0], n: 0, r: a[i * 4 + 3] }); }
		const C = acc[c];
		for (let j = 0; j < 3; j++) { C.a[j] += a[i * 4 + j]; C.b[j] += b[i * 4 + j]; }
		C.n++; map[i] = c;
	}
	const pos = new Float32Array(acc.length * 3), pos2 = new Float32Array(acc.length * 3), reg = new Float32Array(acc.length);
	acc.forEach((C, i) => { for (let j = 0; j < 3; j++) { pos[i * 3 + j] = C.a[j] / C.n; pos2[i * 3 + j] = C.b[j] / C.n; } reg[i] = C.r; });
	const tri = [];
	for (let i = 0; i < idx.length; i += 3) { const x = map[idx[i]], y = map[idx[i + 1]], z = map[idx[i + 2]]; if (x !== y && y !== z && x !== z) tri.push(x, y, z); }
	const g = new THREE.BufferGeometry();
	g.setIndex(tri);
	g.setAttribute('position', new THREE.BufferAttribute(pos2, 3)); g.computeVertexNormals();
	const n2 = g.attributes.normal.clone();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
	g.setAttribute('position2', new THREE.BufferAttribute(pos2, 3));
	g.setAttribute('normal2', n2);
	g.setAttribute('region', new THREE.BufferAttribute(reg, 1));
	g.computeBoundingSphere();
	g.boundingSphere.radius += 1;
	P.root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
	return g;
}

let mat = null;
const U = { uTime: { value: 0 } };
function material() {
	if (mat) return mat;
	mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
	mat.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = U.uTime;
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', `#include <common>
attribute vec3 position2; attribute vec3 normal2; attribute float region;
attribute vec3 iSkin; attribute vec3 iTop; attribute vec3 iOuter; attribute vec3 iBottom; attribute vec3 iShoes; attribute vec3 iHair; attribute vec3 iAnim;
uniform float uTime; varying vec3 vCrowd; float cw;`)
			.replace('#include <beginnormal_vertex>', `// the pose between the two: a cheer that rises and falls, or the walk's stride
cw = iAnim.z > 0.5 ? 0.5 + 0.5 * sin(uTime * iAnim.y + iAnim.x) : iAnim.y * smoothstep(0.2, 1.0, 0.5 + 0.5 * sin(uTime * 3.0 + iAnim.x));
vec3 objectNormal = normalize(mix(normal, normal2, cw));
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
			.replace('#include <begin_vertex>', `vec3 transformed = mix(position, position2, cw);
int rg = int(region + 0.5);
vCrowd = rg == 0 ? iSkin : rg == 1 ? iTop : rg == 2 ? iOuter : rg == 3 ? iBottom : rg == 4 ? iShoes : iHair;`);
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCrowd;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vCrowd;');
	};
	mat.customProgramCacheKey = () => 'crysis-crowd-1';
	return mat;
}

// a crowd of n: kind 'seat' (in the stands), 'walk' (going along), 'stand'
export function createCrowd(n, { kind = 'seat', place: where = 'suburb', seed = 1, cold = 0.4 } = {}) {
	const group = new THREE.Group();
	group.name = 'crowd';
	const meshes = [], slots = [];
	const who = [];
	const r = rng(seed);
	// who is in it: an age, a body shape, colours for their generation and the place
	for (let i = 0; i < n; i++) {
		const age = r() < 0.2 ? 6 + r() * 10 : 17 + Math.pow(r(), 1.2) * 60;
		const shape = age < 15 ? 5 : age > 58 ? (r() < 0.5 ? 3 : 2) : age < 24 ? (r() < 0.5 ? 4 : 1) : Math.floor(r() * 3);
		who.push({ age, shape, seed: (seed * 7919 + i * 131) >>> 0 });
	}
	let A = peopleAssetsNow(), made = 0, dead = false;
	if (!A) loadPeopleAssets().then((a) => { A = a; }).catch(() => { dead = true; });
	const tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), ts = new THREE.Vector3(), tp = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
	const place = [];
	// build a shape a frame, then the instanced mesh for it
	function grow() {
		if (!A || dead || made >= SHAPES.length) return;
		const T = templates[kind];
		if (!T[made]) T[made] = bake(A, made, kind);
		const mine = who.map((w, i) => [w, i]).filter(([w]) => w.shape === made);
		if (mine.length) {
			// (the shape's geometry is shared by every crowd: each crowd's own attributes go on a copy)
			const geo = T[made].clone();
			const im = new THREE.InstancedMesh(geo, material(), mine.length);
			im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true;
			const attrs = {};
			for (const k of ['iSkin', 'iTop', 'iOuter', 'iBottom', 'iShoes', 'iHair', 'iAnim']) attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(mine.length * 3), 3);
			const c = new THREE.Color();
			mine.forEach(([w, i], j) => {
				const rr = rng(w.seed), d = personDNA(w.seed, { age: w.age });
				const o = dressFor(rr, d, { place: where, activity: kind === 'seat' ? 'sit' : 'walk', cold });
				const tone = d.ancestry[0] * 0.55 + d.ancestry[1] * 0.12;
				c.setRGB(0.72 * (1 - tone * 0.62), 0.52 * (1 - tone * 0.7), 0.4 * (1 - tone * 0.75)); attrs.iSkin.setXYZ(j, c.r, c.g, c.b);
				const set = (a, col) => { c.set(col || '#777777'); attrs[a].setXYZ(j, c.r, c.g, c.b); };
				set('iTop', o.top?.col || o.outer?.col); set('iOuter', o.outer?.col || o.top?.col); set('iBottom', o.bottom?.col); set('iShoes', o.shoes?.kind === 'barefoot' ? '#b08560' : o.shoes?.col);
				c.setRGB(...d.hairColour); attrs.iHair.setXYZ(j, c.r, c.g, c.b);
				attrs.iAnim.setXYZ(j, rr() * 6.28, kind === 'walk' ? 5 + rr() : 0, kind === 'walk' ? 1 : 0);
				slots[i] = { im, j };
			});
			for (const [k, a] of Object.entries(attrs)) geo.setAttribute(k, a);
			group.add(im);
			meshes.push(im);
			for (const [, i] of mine) if (place[i]) put(i);
		}
		made++;
	}
	function put(i) {
		const s = slots[i], p = place[i];
		if (!s || !p) return;
		tq.setFromAxisAngle(UP, p[3]);
		tm.compose(tp.set(p[0], p[1], p[2]), tq, ts.setScalar(p[4]));
		s.im.setMatrixAt(s.j, tm);
		s.im.instanceMatrix.needsUpdate = true;
	}
	return {
		group,
		get count() { return n; },
		ready: () => made >= SHAPES.length,
		// where one sits or walks: position, facing (the body's +z), scale (0 hides it)
		place(i, x, y, z, yaw, scale = 1) { place[i] = [x, y, z, yaw, scale]; put(i); },
		// how much they cheer (0 sat still .. 1 on their feet): the same for all, each in their own time
		cheer(k) { for (const m of meshes) { const a = m.geometry.attributes.iAnim; for (let j = 0; j < a.count; j++) if (a.getZ(j) < 0.5) a.setY(j, k * (0.4 + ((j * 37) % 10) / 16)); a.needsUpdate = true; } },
		update(t) { U.uTime.value = t; grow(); },
		dispose() { for (const m of meshes) { m.geometry.dispose(); m.dispose(); } group.removeFromParent(); },
	};
}
