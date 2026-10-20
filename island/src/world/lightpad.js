// three builds every lit material's shader for a number of point lights. When that number
// changes (the volcano's glow hidden as you walk off, a house's lamps switched on, a family's
// dinner lamp staged in a window) every lit material in view is built again: right after Enter
// that was 3 lights, then 1, then 3, about 70 shaders in the first second, and each family
// lamp coming in was another full set. A phone does not survive that. This keeps the number
// steady: dark stand-ins (intensity 0, out of reach) fill in for the lights that are out of the
// picture, up to `keep`; with `cap` (phones) only the `keep` lights that matter most are drawn
// (lit ones first, then the nearest), so the count never rises past it either.
//   createLightPad(scene, { keep, cap })   { update(now, camera, rescan), info() }
// (the world build calls update with rescan before it warms the shaders, so they are warmed
// for the count that is then drawn)
import * as THREE from 'three';

const RESCAN = 3000;

export function createLightPad(scene, { keep = 3, cap = false } = {}) {
	const pad = [];
	for (let i = 0; i < keep; i++) {
		const l = new THREE.PointLight(0x000000, 0, 0.01, 2);
		l.name = 'lightpad';
		l.position.set(0, -1e6, 0);
		l.visible = false;
		scene.add(l);
		pad.push(l);
	}
	const lights = [], held = new Set(), live = [], at = new THREE.Vector3();
	let scanAt = -Infinity, lit = 0, capped = 0;
	// drawn this frame: visible all the way up to the scene
	const counted = (o) => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; } return false; };
	function update(now, camera = null, rescan = false) {
		if (rescan || now - scanAt > RESCAN) {
			scanAt = now;
			lights.length = 0;
			scene.traverse((o) => { if (o.isPointLight && o.name !== 'lightpad') lights.push(o); });
		}
		// the lights held back last frame are theirs again before they are counted
		for (const l of held) l.visible = true;
		held.clear();
		live.length = 0;
		for (const l of lights) if (counted(l)) live.push(l);
		capped = 0;
		if (cap && live.length > keep) {
			const cam = camera?.position;
			for (const l of live) l.userData.padRank = (l.intensity > 0 ? 0 : 1e9) + (cam ? l.getWorldPosition(at).distanceToSquared(cam) : 0);
			live.sort((a, b) => a.userData.padRank - b.userData.padRank);
			for (const l of live.splice(keep)) { l.visible = false; held.add(l); capped++; }
		}
		lit = live.length;
		for (let i = 0; i < keep; i++) pad[i].visible = i < keep - lit;
	}
	return { update, info: () => ({ lit, padded: Math.max(0, keep - lit), capped, keep }) };
}
