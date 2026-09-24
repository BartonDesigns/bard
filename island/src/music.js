// The island listens to the Bard. Live bass/mid/high from the faceplate move
// the wind in the trees, the grass shimmer, the sparkle on the sea and the
// fireflies. Tapping the world plays the faceplate instrument (wood, stone,
// crystal, soft by material) and each note ripples out from where it lands.

import * as THREE from 'three';
import { strikePulse, PULSE } from './pulse.js';

export function createMusic(shared, scene, camera, canvas, pickables, active) {
	const bands = { bass: 0, mid: 0, high: 0 };
	const ray = new THREE.Raycaster();
	ray.far = 90;
	const v2 = new THREE.Vector2();

	function hitAt(ndcX, ndcY) {
		v2.set(ndcX, ndcY);
		ray.setFromCamera(v2, camera);
		const hits = ray.intersectObjects(pickables(), false);
		return hits.length ? hits[0] : null;
	}

	// where a note lands, the struck object rings: a pulse radiates from the contact
	// across that object (see pulse.js), tinted by what it is made of
	const box = new THREE.Box3(), m4 = new THREE.Matrix4(), origin = new THREE.Vector3();
	function ripple(hit, kind) {
		const col = { wood: 0xffc98a, stone: 0xa8c8ff, crystal: 0x9ffff0, soft: 0xbfff9a }[kind] || 0xffffff;
		let reach = 6, org = null;
		const o = hit.object;
		if (o && o.isInstancedMesh && hit.instanceId !== undefined) {
			o.getMatrixAt(hit.instanceId, m4);
			org = origin.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld);
			if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
			box.copy(o.geometry.boundingBox);
			const sc = Math.cbrt(Math.abs(m4.determinant()));
			reach = Math.max(1.5, box.getSize(origin.clone()).length() * sc);
		} else reach = 7;
		strikePulse(hit.point, org, reach, col, shared.uTime.value);
		shared.uPulse.value = Math.min(1.5, shared.uPulse.value + 0.6);
	}

	let registered = false;
	function register() {
		if (registered) return;
		const TM = window.L99TouchMusic175;
		if (TM) {
			TM.register('island', { T: THREE, canvas: () => canvas, ray: hitAt, active });
			registered = true;
		}
		// the shared discovery hook tells us when a strike landed in our world
		const EX = window.L99Explore175;
		if (EX && !EX.__island) {
			EX.__island = true;
			const prev = EX.struck ? EX.struck.bind(EX) : null;
			EX.struck = function (realm, hit, d) {
				if (realm === 'island' && hit) ripple(hit, window.L99TouchMusic175?.material(hit));
				return prev ? prev(realm, hit, d) : undefined;
			};
		}
	}

	function update(dt) {
		const src = window.L99Continuity?.bands;
		const k = Math.min(1, dt * 9);
		for (const b of ['bass', 'mid', 'high']) {
			const v = src && Number.isFinite(src[b]) ? Math.max(0, Math.min(1, src[b])) : 0;
			bands[b] += (v - bands[b]) * k;
		}
		shared.uBass.value = bands.bass;
		shared.uMid.value = bands.mid;
		shared.uHigh.value = bands.high;
		shared.uPulse.value *= Math.exp(-dt * 2.5);
		PULSE.uPulseNow.value = shared.uTime.value;
	}
	return { bands, update, register, hitAt, ripple };
}
