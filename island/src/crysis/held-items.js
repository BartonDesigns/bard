// The gear catalogue's items as small stylised models (gameplay/arms.js ids), for the hand:
// yours (in view, or on your body in third person) and your friends'. Each is a few boxes and
// cylinders in flat colours, made once and shared, origin at the grip, hanging from it. Toy-like
// on purpose: nothing here models a real tool's working parts.

import * as THREE from 'three';

// an icon for each item, for the gear screen
export const ITEM_ICONS = {
	'aurora-trail-rifle': '🎯', 'mossback-scout-rifle': '🌲', 'warden-spark-carbine': '🛡️', 'reedline-hunting-bow': '🏹',
	'hunting-net': '🥅', 'trail-scent-kit': '🌿', 'door-brace': '🚪', 'lantern-alarm': '🔔', 'field-medkit': '🩹',
	'camp-lantern': '🏮', 'repair-roll': '🧰', 'station-signal-flare': '🎆',
};
export const iconOf = (id) => ITEM_ICONS[id] || '📦';

const mats = {};
function mat(hex, glow = 0) {
	const k = hex + ':' + glow;
	return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.05, emissive: glow ? hex : 0x000000, emissiveIntensity: glow }));
}
const box = (w, h, d, hex, x = 0, y = 0, z = 0, glow = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, glow)); m.position.set(x, y, z); return m; };
const cyl = (r, h, hex, x = 0, y = 0, z = 0, glow = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat(hex, glow)); m.position.set(x, y, z); return m; };
const ring = (r, t, hex, arc = Math.PI * 2) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 18, arc), mat(hex));

function lantern(glass, top) {
	const g = new THREE.Group();
	const handle = ring(0.05, 0.006, 0x2b2b2b, Math.PI); handle.position.y = -0.02;
	g.add(handle, cyl(0.065, 0.02, top, 0, -0.04), cyl(0.055, 0.12, glass, 0, -0.11, 0, 0.9), cyl(0.07, 0.025, 0x2b2b2b, 0, -0.18));
	return g;
}
// a long item carried upright at the side, held at its middle
function staff(body, band, len = 0.9) {
	const g = new THREE.Group();
	g.add(box(0.05, len, 0.07, body, 0, 0.05), box(0.055, 0.08, 0.075, band, 0, 0.3, 0, 0.35), box(0.04, 0.12, 0.09, body, 0, -0.08, 0.06));
	return g;
}
const BUILD = {
	'aurora-trail-rifle': () => staff(0x8a6a44, 0x38d6b0),
	'mossback-scout-rifle': () => staff(0x5d6b3e, 0xb9e07a, 0.8),
	'warden-spark-carbine': () => staff(0x3d4a5c, 0xffb347, 0.7),
	'reedline-hunting-bow': () => {
		const g = new THREE.Group(), arc = ring(0.45, 0.014, 0x9a6b3c, Math.PI * 0.7);
		arc.rotation.set(0, Math.PI / 2, Math.PI * 0.65);
		arc.position.z = -0.38;
		const string = cyl(0.003, 0.8, 0xf0ead8, 0, 0, 0.0);
		g.add(arc, string, box(0.035, 0.1, 0.035, 0x5a3b20));
		return g;
	},
	'hunting-net': () => { const g = new THREE.Group(), hoop = ring(0.16, 0.01, 0x6f7f86); hoop.position.y = 0.55; g.add(cyl(0.015, 0.75, 0x9a7b55, 0, 0.18), hoop, cyl(0.13, 0.02, 0xd8e2d0, 0, 0.55)); g.children[2].rotation.x = Math.PI / 2; return g; },
	'trail-scent-kit': () => { const g = new THREE.Group(); g.add(box(0.1, 0.12, 0.05, 0x7a5a3a, 0, -0.08), box(0.02, 0.04, 0.02, 0x3c5a2c, 0, -0.01)); return g; },
	'door-brace': () => { const g = new THREE.Group(); g.add(box(0.07, 0.8, 0.03, 0xa47e4f), box(0.09, 0.05, 0.05, 0x555555, 0, -0.38)); return g; },
	'lantern-alarm': () => { const g = lantern(0xff9a3c, 0xc0392b); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0xe8c040))); g.children.at(-1).position.y = -0.005; return g; },
	'field-medkit': () => { const g = new THREE.Group(); g.add(box(0.22, 0.15, 0.08, 0xf2f2ee, 0, -0.1), box(0.06, 0.02, 0.02, 0x333333, 0, -0.015), box(0.08, 0.025, 0.002, 0x2fae5c, 0, -0.1, 0.041), box(0.025, 0.08, 0.002, 0x2fae5c, 0, -0.1, 0.041)); return g; },
	'camp-lantern': () => lantern(0xffd27a, 0x2f6b4f),
	'repair-roll': () => { const g = new THREE.Group(); g.add(box(0.3, 0.12, 0.12, 0xc0392b, 0, -0.09), box(0.18, 0.02, 0.03, 0x333333, 0, -0.02), box(0.31, 0.02, 0.125, 0x8e2a20, 0, -0.06)); return g; },
	'station-signal-flare': () => { const g = new THREE.Group(); g.add(cyl(0.025, 0.2, 0xd8432f, 0, -0.02), cyl(0.027, 0.04, 0xffb030, 0, 0.1, 0, 0.8)); return g; },
};
const cache = new Map();
// a fresh copy (sharing geometry and materials) of an item's model, or null
export function itemModel(id) {
	const make = BUILD[id];
	if (!make) return null;
	if (!cache.has(id)) cache.set(id, make());
	const m = cache.get(id).clone();
	m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
	m.name = 'held:' + id;
	return m;
}

const tmp = new THREE.Vector3();
// what one body holds: kept at its right wrist, upright, turned with the body
export function createHand(scene) {
	let id = null, model = null;
	function set(next) {
		if (next === id) return;
		if (model) model.parent?.remove(model);
		id = next || null; model = id ? itemModel(id) : null;
		if (model) scene.add(model);
	}
	// P: a people/body.js person; heading: which way the body faces
	function follow(P, heading, visible = true) {
		if (!model) return;
		if (model.parent !== scene) scene.add(model);
		const i = P?.map?.['wrist.R'];
		model.visible = visible && i != null && P.root.visible;
		if (!model.visible) return;
		P.bones[i].getWorldPosition(tmp);
		model.position.copy(tmp);
		model.rotation.set(0, heading, 0);
	}
	// in first person: low on the right of the view
	function view(camera, visible = true) {
		if (!model) return;
		if (model.parent !== scene) scene.add(model);
		model.visible = visible;
		if (!visible) return;
		model.position.set(0.24, -0.26, -0.55).applyQuaternion(camera.quaternion).add(camera.position);
		model.quaternion.copy(camera.quaternion);
		model.rotateY(-0.5); model.rotateZ(0.12);
	}
	function dispose() { set(null); }
	return { set, follow, view, dispose, get id() { return id; } };
}
