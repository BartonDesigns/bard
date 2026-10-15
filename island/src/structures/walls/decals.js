// The marks a fight leaves on a wall's face, before (and round) any hole: knuckle dents, a
// star of cracks, a round's small hole going in and its torn blow-out coming out, chipped
// stucco, brick and concrete, a spray of dust. One instanced mesh over its own atlas
// (textures.js marksAtlas), a fixed pool (the oldest goes first), each mark kept by the wall
// it is on, so it goes when the hole under it opens or the wall is repaired.

import * as THREE from 'three';
import { marksAtlas } from './textures.js';

const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), N3 = new THREE.Vector3(), Z3 = new THREE.Vector3(0, 0, 1), EU = new THREE.Euler();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

export function createDecals(scene, { cap = 300 } = {}) {
	const geo = new THREE.PlaneGeometry(1, 1);
	const aCell = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
	geo.setAttribute('aCell', aCell);
	const mat = new THREE.MeshStandardMaterial({ map: marksAtlas(), transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	mat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell;').replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvMapUv = vMapUv * 0.25 + aCell;');
	};
	mat.customProgramCacheKey = () => 'wall-marks';
	const mesh = new THREE.InstancedMesh(geo, mat, cap);
	mesh.count = cap; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.receiveShadow = true; mesh.name = 'wall-marks';
	for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, HIDE);
	scene.add(mesh);
	const slots = Array.from({ length: cap }, () => ({ wall: null, pi: -1, u: 0, y: 0, side: 0, kind: -1, s: 0 }));
	let next = 0;
	// a mark of kind k at world point p facing n (world, out of the face), size s; on wall W's
	// piece pi at (u, y) of side (0 low a, 1 high a)
	function add(k, p, n, s, wall = null, pi = -1, u = 0, y = 0, side = 0, spin = Math.random() * 6.28) {
		const i = next;
		next = (next + 1) % cap;
		N3.set(n.x, n.y ?? 0, n.z).normalize();
		QT.setFromUnitVectors(Z3, N3);
		QT.multiply(Q2.setFromEuler(EU.set(0, 0, spin)));
		mesh.setMatrixAt(i, M4.compose(P3.set(p.x + N3.x * 0.002, p.y + N3.y * 0.002, p.z + N3.z * 0.002), QT, S3.set(s, s, 1)));
		aCell.setXY(i, (k % 4) * 0.25, 0.75 - Math.floor(k / 4) * 0.25);
		Object.assign(slots[i], { wall, pi, u, y, side, kind: k, s });
		mesh.instanceMatrix.needsUpdate = true; aCell.needsUpdate = true;
		return i;
	}
	// the marks of a wall whose test says they now lie over a hole (or all of a wall's)
	function drop(wall, test = null) {
		let any = false;
		for (let i = 0; i < cap; i++) {
			const q = slots[i];
			if (q.wall !== wall || (test && !test(q))) continue;
			q.wall = null; q.kind = -1; mesh.setMatrixAt(i, HIDE); any = true;
		}
		if (any) mesh.instanceMatrix.needsUpdate = true;
	}
	const count = () => slots.filter((q) => q.kind >= 0).length;
	const of = (wall) => slots.filter((q) => q.wall === wall);
	return { mesh, add, drop, count, of, cap };
}
