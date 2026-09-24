// The island listens to the Bard. Live bass/mid/high from the faceplate move
// the wind in the trees, the grass shimmer, the sparkle on the sea and the
// fireflies. Tapping the world plays the faceplate instrument (wood, stone,
// crystal, soft by material) and each note ripples out from where it lands.

import * as THREE from 'three';
import { glow } from './world/textures.js';

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

	// ripples where notes land
	const rippleTex = glow();
	const ripples = [];
	function ripple(point, kind) {
		const col = { wood: 0xffd29a, stone: 0xbfd8ff, crystal: 0xb9fff0, soft: 0xc8ffb0 }[kind] || 0xffffff;
		const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: rippleTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		sp.position.copy(point);
		sp.scale.setScalar(0.4);
		scene.add(sp);
		ripples.push({ sp, t: 0 });
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
				if (realm === 'island' && hit) ripple(hit.point, window.L99TouchMusic175?.material(hit));
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
		for (let i = ripples.length - 1; i >= 0; i--) {
			const r = ripples[i];
			r.t += dt;
			r.sp.scale.setScalar(0.4 + r.t * 9);
			r.sp.material.opacity = Math.max(0, 1 - r.t / 0.9);
			if (r.t > 0.9) { scene.remove(r.sp); r.sp.material.dispose(); ripples.splice(i, 1); }
		}
	}
	return { bands, update, register, hitAt, ripple };
}
