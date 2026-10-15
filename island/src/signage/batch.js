// A batch: every decal of one material and one layer in a region, one instanced draw. The
// instance's matrix carries where it is, which way it faces and its size; aCell the graphic's
// place in the atlas; aFx its back, seed, wear and a flag. Filled at a region's rebuild (or,
// for the cars, every frame) with no allocation: put() writes straight into the arrays.

import * as THREE from 'three';
import { signMaterial } from './materials.js';

export function createBatch(group, kind, layer, map, cap, { phone = false, name = '' } = {}) {
	// (its own quad: a disposed geometry takes its buffers with it)
	const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1, kind === 'cloth' ? 8 : 1, kind === 'cloth' ? 3 : 1));
	const cell = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), fx = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
	cell.setUsage(THREE.DynamicDrawUsage); fx.setUsage(THREE.DynamicDrawUsage);
	geo.setAttribute('aCell', cell); geo.setAttribute('aFx', fx);
	const mat = signMaterial(kind, layer, map, { phone });
	const mesh = new THREE.InstancedMesh(geo, mat, cap);
	mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
	mesh.renderOrder = mat.userData.renderOrder; mesh.visible = false;
	mesh.name = `signage-${name || kind}-${layer}`;
	group.add(mesh);
	const M = mesh.instanceMatrix.array, C = cell.array, F = fx.array, lift = mat.userData.lift;
	let n = 0;
	const B = {
		mesh, kind, layer, cap, lift,
		get n() { return n; },
		clear() { n = 0; },
		// a decal at p facing n (unit), its right along t (unit, perpendicular to n), w x h metres;
		// c the atlas cell [u, v, du, dv]; back, seed, wear, extra into aFx
		put(px, py, pz, nx, ny, nz, tx, ty, tz, w, h, c, back, seed, wear, extra) {
			if (n >= cap) return false;
			// up: n x t  (so that t x up = n)
			const ux = ny * tz - nz * ty, uy = nz * tx - nx * tz, uz = nx * ty - ny * tx;
			const o = n * 16;
			M[o] = tx * w; M[o + 1] = ty * w; M[o + 2] = tz * w; M[o + 3] = 0;
			M[o + 4] = ux * h; M[o + 5] = uy * h; M[o + 6] = uz * h; M[o + 7] = 0;
			M[o + 8] = nx; M[o + 9] = ny; M[o + 10] = nz; M[o + 11] = 0;
			M[o + 12] = px + nx * lift; M[o + 13] = py + ny * lift; M[o + 14] = pz + nz * lift; M[o + 15] = 1;
			const q = n * 4;
			if (c) { C[q] = c[0]; C[q + 1] = c[1]; C[q + 2] = c[2]; C[q + 3] = c[3]; } else { C[q] = 0; C[q + 1] = 0; C[q + 2] = 1; C[q + 3] = 1; }
			F[q] = back; F[q + 1] = seed; F[q + 2] = wear; F[q + 3] = extra;
			n++;
			return true;
		},
		// a decal by a full matrix (a car's frame times a local one), then its size
		putMatrix(m4e, c, back, seed, wear, extra) {
			if (n >= cap) return false;
			const o = n * 16;
			for (let i = 0; i < 16; i++) M[o + i] = m4e[i];
			const q = n * 4;
			C[q] = c[0]; C[q + 1] = c[1]; C[q + 2] = c[2]; C[q + 3] = c[3];
			F[q] = back; F[q + 1] = seed; F[q + 2] = wear; F[q + 3] = extra;
			n++;
			return true;
		},
		commit() {
			mesh.count = n; mesh.visible = n > 0;
			if (!n) return;
			mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, n * 16); mesh.instanceMatrix.needsUpdate = true;
			cell.clearUpdateRanges(); cell.addUpdateRange(0, n * 4); cell.needsUpdate = true;
			fx.clearUpdateRanges(); fx.addUpdateRange(0, n * 4); fx.needsUpdate = true;
		},
		dispose() { group.remove(mesh); geo.dispose(); mesh.dispose(); },
	};
	return B;
}
