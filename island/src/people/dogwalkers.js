// Dogs out for their walk: now and then someone walking the streets or a park near you has
// their dog along on a lead, at heel and trotting to keep up, sitting when they stop. A few
// at most (each dog is its own skinned mesh, dog.js), made as they come near and let go as
// they leave; the lead a slack line from the hand to the collar.

import * as THREE from 'three';
import { createDog } from './dog.js';

const NEAR = 55, DROP = 90;

export function createDogWalkers({ scene, people, world, isPhone = false }) {
	const MAX = isPhone ? 1 : 3, walks = new Map();
	const leadMat = new THREE.LineBasicMaterial({ color: 0x2a2320 });
	const ground = (x, z) => world()?.island?.heightAt?.(x, z) ?? 0;
	// who walks a dog: about one in six of the grown-ups out walking the streets, round a
	// block or about a park, decided once each
	const owns = new WeakMap(), ROUTES = new Set(['street', 'loop', 'wander']);
	const walker = (p) => {
		if (!owns.has(p)) owns.set(p, Math.random() < 0.17 && !p.P?.dna?.child);
		return owns.get(p) && p.active && (p.role === 'walk' || p.role === 'wait') && ROUTES.has(p.route?.kind);
	};
	function update(dt, cam) {
		const pool = people.pool || [], cx = cam.position.x, cz = cam.position.z;
		// let go of the ones gone out of reach (or no longer out walking)
		for (const [p, w] of walks) {
			const q = p.M?.S?.pos;
			if (!walker(p) || !q || Math.hypot(q.x - cx, q.z - cz) > DROP) { w.dog.dispose(); w.lead.removeFromParent(); w.lead.geometry.dispose(); walks.delete(p); }
		}
		// a new one near you, if there's room
		if (walks.size < MAX) for (const p of pool) {
			if (walks.has(p) || !walker(p)) continue;
			const q = p.M?.S?.pos;
			if (!q || Math.hypot(q.x - cx, q.z - cz) > NEAR) continue;
			const dog = createDog({ seed: Math.floor(q.x * 13 + q.z * 7), isPhone }), h = p.M.S.heading || 0;
			scene.add(dog.root);
			dog.place(q.x - Math.sin(h) * 1.4, ground(q.x, q.z), q.z - Math.cos(h) * 1.4, h);
			const lead = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9 * 3), 3)), leadMat);
			lead.frustumCulled = false;
			scene.add(lead);
			walks.set(p, { dog, lead });
			break;
		}
		// at heel, and the lead between them sagging a little
		for (const [p, w] of walks) {
			const q = p.M.S.pos, h = p.M.S.heading || 0, foot = q.y;
			const hand = { x: q.x + Math.cos(h) * 0.28, y: foot + 0.85, z: q.z - Math.sin(h) * 0.28 };
			w.dog.update(dt, { mode: 'home', owner: hand, ground });
			const d = w.dog.pos, collar = { x: d.x, y: d.y + w.dog.size * 0.95, z: d.z };
			const a = w.lead.geometry.attributes.position, sag = Math.max(0, 0.35 - Math.hypot(hand.x - collar.x, hand.z - collar.z) * 0.12);
			for (let k = 0; k < 9; k++) { const t = k / 8; a.setXYZ(k, hand.x + (collar.x - hand.x) * t, hand.y + (collar.y - hand.y) * t - Math.sin(t * Math.PI) * sag, hand.z + (collar.z - hand.z) * t); }
			a.needsUpdate = true;
		}
	}
	return { update, count: () => walks.size };
}
