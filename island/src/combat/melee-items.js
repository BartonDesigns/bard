// Things picked up for a fight, as models: a bat, a length of pipe, a bottle held by its neck, a
// hunting knife and a machete. Each is built with the middle of its grip at the origin and runs
// up +y out of the thumb's side of a closed hand (a hammer grip); userData.r is the grip's
// radius, which the hands close on (combat/anatomical-hand.js through crysis/finger-pose.js).
// First person (combat/melee-view.js) and the brawlers' hands and dropped items (combat/melee.js)
// use the same shapes. The knife and the machete are plain field tools: a handle, a guard, a
// flat blade with its edge forward; nothing more.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MELEE_ITEMS = ['bat', 'pipe', 'bottle', 'knife', 'machete'];
// held in one hand (the other stays up in a guard)
export const ONE_HANDED = new Set(['bottle', 'knife', 'machete']);

export function meleeMaterials() {
	return {
		wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.55 }),
		steel: new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.4, metalness: 0.35 }),
		glass: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }),
		blade: new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.28, metalness: 0.85 }),
		handle: new THREE.MeshStandardMaterial({ color: 0x23211e, roughness: 0.82, metalness: 0 }),
	};
}

// a flat blade along +y from y0 to its tip, the edge toward -z (where the knuckles point), the
// spine toward +z; profile: [[y, spine z, edge z] ...]
function blade(profile, thick) {
	const s = new THREE.Shape(), top = profile.map(([y, sp]) => [sp, y]), bottom = profile.map(([y, , ed]) => [ed, y]).reverse();
	[...top, ...bottom].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
	s.closePath();
	const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 2 });
	// the shape's x is the item's z, its y the item's y, the extrusion across the flat (x)
	return g.translate(0, 0, -thick / 2).rotateY(-Math.PI / 2);
}
const grip = (r, y0, y1, seg) => new THREE.CylinderGeometry(r * 0.94, r, y1 - y0, seg).translate(0, (y0 + y1) / 2, 0);
const flat = (g) => (g.index ? g.toNonIndexed() : g);
function group(kind, r, parts) {
	const g = new THREE.Group();
	for (const [geo, mat] of parts) g.add(new THREE.Mesh(geo, mat));
	g.name = kind; g.userData.r = r;
	return g;
}

export function meleeItem(kind, M) {
	if (kind === 'bat') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.0165, 0.84, 12).translate(0, 0.37, 0), M.wood); m.name = kind; m.userData.r = 0.0175; return m; }
	if (kind === 'pipe') { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 10).translate(0, 0.34, 0), M.steel); m.name = kind; m.userData.r = 0.018; return m; }
	if (kind === 'bottle') {
		// held by the neck, the body out past the thumb
		const m = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.036, 0.16], [0.016, 0.22], [0.012, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 12).rotateX(Math.PI).translate(0, 0.27, 0), M.glass);
		m.name = kind; m.userData.r = 0.0135; return m;
	}
	if (kind === 'knife') {
		const guard = new THREE.BoxGeometry(0.008, 0.007, 0.034).translate(0, 0.059, 0.002);
		return group(kind, 0.0135, [
			[mergeGeometries([flat(grip(0.0135, -0.055, 0.055, 12)), flat(new THREE.CylinderGeometry(0.012, 0.0135, 0.008, 12).translate(0, -0.059, 0))]), M.handle],
			[mergeGeometries([flat(guard), flat(blade([[0.062, 0.006, -0.014], [0.13, 0.0065, -0.016], [0.175, 0.005, -0.009], [0.2, 0.002, 0.001]], 0.0028))]), M.blade],
		]);
	}
	if (kind === 'machete') {
		const guard = new THREE.BoxGeometry(0.009, 0.008, 0.03).translate(0, 0.073, -0.004);
		return group(kind, 0.0155, [
			[mergeGeometries([flat(grip(0.0155, -0.06, 0.07, 12)), flat(new THREE.CylinderGeometry(0.014, 0.0155, 0.01, 12).translate(0, -0.065, 0))]), M.handle],
			[mergeGeometries([flat(guard), flat(blade([[0.076, 0.008, -0.024], [0.2, 0.009, -0.034], [0.38, 0.008, -0.045], [0.46, 0.004, -0.04], [0.5, -0.002, -0.022]], 0.0024))]), M.blade],
		]);
	}
	return null;
}
