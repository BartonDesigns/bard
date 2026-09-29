// Many cars drawn at once, in levels of detail by distance. Close by: the real model where
// the kind has one and it has loaded (vehicles/models.js), otherwise the finest lofted body
// with its cabin behind see-through glass; either way the wheels are their own instances,
// so they turn and steer. Further off the lofts get coarser, then drop out of the shadow
// pass. Cars too far for a person to be made out still show someone at the wheel: a dark
// head and shoulders where the driver sits.
//
//   const F = createFleet(group, { cap, isPhone, night });
//   F.begin(); F.add(kind, matrix, colour, dist2, { spin, steer, riders }); F.end();

import * as THREE from 'three';
import { carGeometry, carMaterial, carGlassMaterial, wheelGeometry, wheelHubs, seatsOf, SPEC } from '../bay/cars.js';
import { MODEL_KINDS, modelKit, wantModel, modelNight } from './models.js';

// the reach of each level (metres): the real model or finest loft, the middle, the far lofts
export const REACH = [40, 120, 320];
const LOFT = [[64, 24, true], [28, 12, false], [14, 8, false], [8, 6, false]];
const geos = {};
function loftGeo(kind, t, wheels) {
	const k = kind + t + (wheels ? 'w' : '');
	if (!geos[k]) { const [ns, ws, cabin] = LOFT[t]; geos[k] = carGeometry(kind, ns, ws, { wheels, cabin, glass: cabin }); }
	return geos[k];
}
const wgeo = {};
const wheelGeo = (kind) => wgeo[kind] || (wgeo[kind] = wheelGeometry(kind, 18));
// someone in a far car: head and shoulders, dark against the glass
const riderGeo = (() => { const h = new THREE.SphereGeometry(0.11, 8, 6).translate(0, 0.62, -0.02), b = new THREE.SphereGeometry(1, 8, 6).scale(0.2, 0.28, 0.13).translate(0, 0.3, 0); const g = new THREE.BufferGeometry(); const m = [h, b].map((q) => q.toNonIndexed()); const pos = new Float32Array(m.reduce((a, q) => a + q.attributes.position.array.length, 0)); let o = 0; for (const q of m) { pos.set(q.attributes.position.array, o); o += q.attributes.position.array.length; } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; })();

export function createFleet(group, { cap = 200, isPhone = false, night = { value: 0 }, shadows = true } = {}) {
	const carMat = carMaterial(night), glassMat = carGlassMaterial();
	const riderMat = new THREE.MeshStandardMaterial({ color: 0x2a221d, roughness: 0.9 });
	const near2 = (isPhone ? 28 : REACH[0]) ** 2, mid2 = REACH[1] ** 2, far2 = REACH[2] ** 2;
	// a set: meshes sharing one list of instances (the parts of a model, or a loft and its glass)
	const sets = new Map();
	function set(key, parts, colored, size, cast) {
		let S = sets.get(key);
		if (S) return S;
		const n = size, matrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16), color = colored ? new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3) : null;
		const meshes = parts.map(([geo, mat, paint]) => {
			const im = new THREE.InstancedMesh(geo, mat, n);
			im.instanceMatrix = matrix; im.count = 0; im.frustumCulled = true;
			if (paint && color) im.instanceColor = color;
			im.castShadow = shadows && cast; im.receiveShadow = true;
			group.add(im);
			return im;
		});
		S = { meshes, matrix, color, n: 0, cap: n };
		sets.set(key, S);
		return S;
	}
	const w4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), mir = new THREE.Vector3(-1, 1, 1);
	function put(S, M, c) {
		if (S.n >= S.cap) return;
		M.toArray(S.matrix.array, S.n * 16);
		if (S.color && c) c.toArray(S.color.array, S.n * 3);
		S.n++;
	}
	function begin() { for (const S of sets.values()) S.n = 0; }
	function end() {
		for (const S of sets.values()) {
			for (const im of S.meshes) { im.count = S.n; im.visible = S.n > 0; }
			if (!S.n) continue;
			S.matrix.clearUpdateRanges(); S.matrix.addUpdateRange(0, S.n * 16); S.matrix.needsUpdate = true;
			if (S.color) { S.color.clearUpdateRanges(); S.color.addUpdateRange(0, S.n * 3); S.color.needsUpdate = true; }
			for (const im of S.meshes) im.computeBoundingSphere();
		}
	}
	// the wheels of one car, turned by spin (radians rolled) and the front ones by steer
	function wheels(kind, M, spin, steer, K, cast) {
		const hubs = K ? K.hubs : wheelHubs(kind);
		hubs.forEach((h, i) => {
			const right = h[0] < 0, front = i < 2;
			e.set(spin, front ? steer : 0, 0, 'YXZ');
			q.setFromEuler(e);
			w4.compose(v.fromArray(h), q, K || !right ? one : mir);
			w4.premultiply(M);
			if (K) { const parts = K.wheels[right ? 'R' : 'L']; if (parts.length) put(set(kind + 'mw' + (right ? 'R' : 'L'), parts.map((p) => [p.geo, p.mat, false]), false, cap * 2, cast), w4); }
			else put(set(kind + 'lw', [[wheelGeo(kind), carMat, false]], false, cap * 4, cast), w4);
		});
	}
	function riders(kind, M, n) {
		const C = seatsOf(kind), S = set('riders', [[riderGeo, riderMat, false]], false, cap * 2, false);
		for (let i = 0; i < n && i < C.seats.length; i++) { const s = C.seats[i]; w4.makeTranslation(s[0], s[1] - 0.05, s[2] - 0.3).premultiply(M); put(S, w4); }
	}
	// o: { spin, steer, riders (how many to show as silhouettes), still (a parked car: its
	// wheels part of the body where that is cheaper) }
	function add(kind, M, c, d2, o = {}) {
		if (!SPEC[kind]) kind = 'sedan';
		const t = d2 < near2 ? 0 : d2 < mid2 ? 1 : d2 < far2 ? 2 : 3;
		const cast = t < 2;
		if (t <= 1 && MODEL_KINDS[kind]) {
			const K = t === 0 ? wantModel(kind, 'near') && modelKit(kind, 'near') : (wantModel(kind, 'mid'), modelKit(kind, 'mid'));
			if (K) {
				put(set(kind + 'm' + t, K.parts.map((p) => [p.geo, p.mat, p.role === 'paint']), true, t ? cap : cap / 2, cast), M, c);
				if (t === 0 && K.hubs.length === 4) wheels(kind, M, o.spin || 0, o.steer || 0, K, cast);
				if (o.riders && t === 1) riders(kind, M, o.riders);
				return t;
			}
		}
		if (t === 0) {
			put(set(kind + 'l0', [[loftGeo(kind, 0, false), [carMat, glassMat], true]], true, cap / 2, cast), M, c);
			wheels(kind, M, o.spin || 0, o.steer || 0, null, cast);
		} else {
			put(set(kind + 'l' + t, [[loftGeo(kind, t, true), carMat, true]], true, cap, cast), M, c);
			if (o.riders && t === 1) riders(kind, M, o.riders);
		}
		return t;
	}
	function setNight(k) { night.value = k; modelNight.value = k; carMat.envMapIntensity = 0.9 * (1 - k * 0.9); }
	const stats = () => { let draws = 0, inst = 0; for (const S of sets.values()) if (S.n) { draws += S.meshes.length; inst += S.n; } return { draws, instances: inst, sets: sets.size }; };
	function dispose() { for (const S of sets.values()) for (const im of S.meshes) { im.removeFromParent(); im.dispose(); } sets.clear(); }
	return { begin, add, end, setNight, stats, dispose, carMat };
}
