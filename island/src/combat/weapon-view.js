// The one place the combat rules talk to the weapons' look (ui/gear.js `weapon`, over
// crysis/viewmodel.js in first person and crysis/held-items.js in third, built separately).
// Each call is passed on when the view has it and is a quiet no-op when it does not, so the rules
// work with any version of the view:
//   fire() -> bool                 a shot shown (false: the view is not ready, so no shot)
//   reload(done) -> bool           the view's reload; it calls done() when its animation ends
//   aim(on)                        the sights up or down (touch)
//   muzzle() -> { position, direction, aim: { origin, direction } } | null
//   state() -> { held, third, reloading, aiming, ready }
//   data(id) -> { rate, mag, reload, ... }   the view's numbers for an item
// Without a view, shots go from the eye and reloads take the weapon's own time.

import * as THREE from 'three';
import { createHand } from '../crysis/held-items.js';

const _v = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const call = (o, name, ...a) => { try { return typeof o?.[name] === 'function' ? o[name](...a) : undefined; } catch (e) { console.warn('[combat] view.' + name, e); return undefined; } };

export function createWeaponView({ gear = () => null, camera }) {
	const api = () => gear()?.weapon || null;
	return {
		get ready() { return !!api(); },
		// a shot shown: true, false (refused: not ready) or null (no view to ask)
		fire() { const a = api(); if (!a?.fire) return null; const r = call(a, 'fire'); return r === undefined ? null : !!r; },
		// a reload: true when the view took it and will call done; false when it refused; null without a view
		reload(done) { const a = api(); if (!a?.reload) return null; const r = call(a, 'reload', done); return r === undefined ? null : !!r; },
		aim: (on) => call(api(), 'aim', on),
		state: () => call(api(), 'state') || null,
		data: (id) => call(api(), 'data', id) || null,
		// where the shot starts (for the streak) and the line it is aimed down (for the hit)
		muzzle(range = 60) {
			const m = call(api(), 'muzzle', range);
			if (m?.position && m?.aim?.direction) return m;
			camera.getWorldDirection(_v);
			_r.set(1, 0, 0).applyQuaternion(camera.quaternion); _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
			const position = camera.position.clone().addScaledVector(_v, 0.7).addScaledVector(_r, 0.13).addScaledVector(_u, -0.13);
			return { position, direction: _v.clone(), aim: { origin: camera.position.clone(), direction: _v.clone() } };
		},
	};
}

// an item in someone else's hands (a raider, an officer): the same models friends carry
export function npcHand(scene, id, level = 1, tier = 0) {
	const h = createHand(scene, { lod: 'low' });
	h.set(id, level, tier);
	return h;
}
