// What the Hollow King's sheet shows that his carved body cannot carry: his greatsword, a long
// straight blade of old dark steel, notched and chipped along both edges, a ridge down its middle,
// a plain bar of a crossguard, a long leather-wrapped grip and a wedge of a pommel, in his right
// hand, held low and forward, so it swings with his arm (creatures/motion.js); and the iron crown
// on his helm, a band of tall uneven points. Made here: a blade that thin and points that sharp
// cannot be carved from a painted sheet.
//
// hollowKing(c) -> { sword, tip(out) }

import * as THREE from 'three';

// the blade along +y from 0 (the guard) to len, a flat diamond in section, its edges bitten into
function bladeGeometry(len, w, t) {
	const pos = [], n = 28;
	let s = 11;
	const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	// (each edge's notches: where the steel was bitten away)
	const notch = (i) => (i > 1 && i < n - 2 && rnd() < 0.3 ? 0.55 + rnd() * 0.3 : 1);
	const L = [], R = [];
	for (let i = 0; i <= n; i++) {
		const u = i / n, taper = u < 0.86 ? 1 - u * 0.12 : (1 - u) / 0.14 * 0.88;
		L.push(w * taper * notch(i)); R.push(w * taper * notch(i));
	}
	for (let i = 0; i < n; i++) {
		const y0 = (i / n) * len, y1 = ((i + 1) / n) * len;
		const t0 = t * (1 - (i / n) * 0.4), t1 = t * (1 - ((i + 1) / n) * 0.4);
		// four faces: front-left, front-right, back-left, back-right; the ridge down the middle
		for (const fz of [1, -1]) {
			pos.push(0, y0, fz * t0, -L[i], y0, 0, -L[i + 1], y1, 0);
			pos.push(0, y0, fz * t0, -L[i + 1], y1, 0, 0, y1, fz * t1);
			pos.push(0, y0, fz * t0, R[i + 1], y1, 0, R[i], y0, 0);
			pos.push(0, y0, fz * t0, 0, y1, fz * t1, R[i + 1], y1, 0);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
}

let kit = null;
function shared(H) {
	if (kit) return kit;
	const steel = new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: 0.42, metalness: 0.85, flatShading: true, side: THREE.DoubleSide });
	const dark = new THREE.MeshStandardMaterial({ color: 0x2c2b2a, roughness: 0.55, metalness: 0.7, flatShading: true });
	const leather = new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 0.85, metalness: 0 });
	// sized for a king four metres tall, scaled to his own height
	const k = H / 4;
	const blade = bladeGeometry(2.1 * k, 0.13 * k, 0.03 * k);
	const guard = new THREE.BoxGeometry(0.62 * k, 0.07 * k, 0.09 * k);
	const grip = new THREE.CylinderGeometry(0.035 * k, 0.04 * k, 0.5 * k, 8);
	const pommel = new THREE.OctahedronGeometry(0.075 * k, 0);
	kit = { steel, dark, leather, blade, guard, grip, pommel, k };
	return kit;
}

// the crown: a band round the top of the helm and points rising from it, the front one tallest
function crown(c, K) {
	let head = null;
	c.root.traverse((o) => { if (!head && o.isBone && o.name === 'head') head = o; });
	const J = c.meta.joints?.head;
	if (!head || !J) return;
	const r = (c.meta.radii?.head || 0.2) * 0.95, k = K.k;
	const top = new THREE.Vector3(...J[1]), at = new THREE.Vector3(...J[0]).lerp(top, 0.66);
	const g = new THREE.Group();
	const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.07 * k, 14, 1, true), K.dark);
	g.add(band);
	const spike = new THREE.ConeGeometry(0.03 * k, 1, 4);
	for (let i = 0; i < 9; i++) {
		const a = (i / 9) * Math.PI * 2, front = Math.cos(a);
		const h = (0.1 + 0.06 * Math.max(0, front) + (i % 2) * 0.05) * k;
		const m = new THREE.Mesh(spike, K.dark);
		m.scale.y = h;
		m.position.set(Math.sin(a) * r, 0.035 * k + h / 2, Math.cos(a) * r);
		m.rotation.set(Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12);
		g.add(m);
	}
	c.root.updateMatrixWorld(true);
	const toBone = new THREE.Matrix4().copy(c.root.matrixWorld).invert().multiply(head.matrixWorld).invert();
	new THREE.Matrix4().makeTranslation(at.x, at.y, at.z).premultiply(toBone).decompose(g.position, g.quaternion, g.scale);
	g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	head.add(g);
}

export function hollowKing(c, hand = 'hand_R') {
	const H = c.meta.height || 4, K = shared(H), k = K.k;
	const sword = new THREE.Group();
	const blade = new THREE.Mesh(K.blade, K.steel);
	blade.position.y = 0.04 * k;
	const guard = new THREE.Mesh(K.guard, K.dark);
	const grip = new THREE.Mesh(K.grip, K.leather);
	grip.position.y = -0.25 * k;
	// (the wrap's rings)
	for (let i = 0; i < 5; i++) {
		const r = new THREE.Mesh(new THREE.TorusGeometry(0.042 * k, 0.008 * k, 4, 10), K.dark);
		r.rotation.x = Math.PI / 2; r.position.y = (-0.06 - i * 0.1) * k;
		sword.add(r);
	}
	const pommel = new THREE.Mesh(K.pommel, K.dark);
	pommel.scale.set(1, 1.3, 0.6); pommel.position.y = -0.54 * k;
	sword.add(blade, guard, grip, pommel);
	sword.traverse((o) => { if (o.isMesh) o.castShadow = true; });
	// into the hand: the grip through the fist, the blade forward and down
	let b = null;
	c.root.traverse((o) => { if (!b && o.isBone && o.name === hand) b = o; });
	const J = c.meta.joints?.[hand];
	if (b && J) {
		c.root.updateMatrixWorld(true);
		const toModel = new THREE.Matrix4().copy(c.root.matrixWorld).invert().multiply(b.matrixWorld);
		const fist = new THREE.Vector3(...J[0]).lerp(new THREE.Vector3(...J[1]), 0.45);
		const dir = new THREE.Vector3(0, -0.5, 1).normalize();
		// (the edge leading, the flat to the side)
		const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
		const m = new THREE.Matrix4().compose(fist, q, new THREE.Vector3(1, 1, 1)).premultiply(toModel.clone().invert());
		m.decompose(sword.position, sword.quaternion, sword.scale);
		b.add(sword);
	} else c.root.add(sword);
	crown(c, K);
	const tipLocal = new THREE.Vector3(0, 2.1 * k, 0);
	return { sword, tip: (out) => sword.localToWorld(out.copy(tipLocal)) };
}
