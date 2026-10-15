// What comes off a wall: flakes and lumps of gypsum, splinters, tufts of batt, bits of stucco,
// whole bricks and brick ends, concrete grit. One instanced mesh and a fixed pool of plain
// arrays (no physics engine): each piece flies, tumbles, bounces on the floor under where it
// came off, slides to a stop and lies there flat; the floor collects them until the pool needs
// the oldest back or the wall is repaired, when they shrink away. Nothing is made per frame.

import * as THREE from 'three';

const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), C3 = new THREE.Color();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

// a lump: an octahedron pushed about, so no two orientations read alike
function lumpGeometry() {
	const g = new THREE.OctahedronGeometry(0.5, 1), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) { const k = 0.75 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
	g.computeVertexNormals();
	return g;
}

// the kinds: size (x, y, z as a share of the given size), bounce, drag, colour
export const CHIP = Object.freeze({
	gypsum: { s: [1, 0.25, 0.8], bounce: 0.2, drag: 0.6, col: [0.93, 0.92, 0.88] },
	plaster: { s: [1, 0.3, 0.8], bounce: 0.2, drag: 0.5, col: [0.86, 0.84, 0.78] },
	paper: { s: [1, 0.04, 0.7], bounce: 0.1, drag: 3.5, col: [0.92, 0.9, 0.86] },
	splinter: { s: [0.15, 0.12, 1], bounce: 0.3, drag: 0.4, col: [0.78, 0.6, 0.38] },
	tuft: { s: [1, 0.7, 0.9], bounce: 0.05, drag: 4, col: [1, 0.62, 0.66] },
	stucco: { s: [1, 0.35, 0.8], bounce: 0.25, drag: 0.3, col: [0.66, 0.64, 0.6] },
	brick: { s: [1, 0.3, 0.47], bounce: 0.2, drag: 0.15, col: [0.58, 0.26, 0.18] },
	block: { s: [1, 0.5, 0.5], bounce: 0.15, drag: 0.15, col: [0.62, 0.61, 0.58] },
	concrete: { s: [1, 0.6, 0.8], bounce: 0.2, drag: 0.2, col: [0.6, 0.59, 0.56] },
	glass: { s: [1, 0.03, 0.8], bounce: 0.3, drag: 0.3, col: [0.75, 0.85, 0.88] },
});

export function createChips(scene, { cap = 300, floorAt = () => 0 } = {}) {
	const geo = lumpGeometry();
	const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
	const mesh = new THREE.InstancedMesh(geo, mat, cap);
	mesh.count = cap; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'wall-chips';
	mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
	for (let i = 0; i < cap; i++) mesh.setMatrixAt(i, HIDE);
	scene.add(mesh);
	// state, one row a piece: x y z, vx vy vz, rx ry rz, wx wy wz, sx sy sz, floor, bounce, drag, age, mode (0 free, 1 flying, 2 lying, 3 going)
	const F = 20, S = new Float32Array(cap * F), owner = new Array(cap).fill(null);
	let next = 0, flying = 0, dirty = false, life = 180;
	// a piece of kind k at (x, y, z) thrown with (vx, vy, vz), about size big, belonging to a wall (id)
	function add(kind, x, y, z, vx, vy, vz, size, id = null, col = null) {
		const K = CHIP[kind] || CHIP.gypsum, i = next;
		next = (next + 1) % cap;
		const o = i * F;
		if (S[o + 19] === 1 || S[o + 19] === 3) flying--;
		S[o] = x; S[o + 1] = y; S[o + 2] = z; S[o + 3] = vx; S[o + 4] = vy; S[o + 5] = vz;
		S[o + 6] = Math.random() * 6.3; S[o + 7] = Math.random() * 6.3; S[o + 8] = Math.random() * 6.3;
		const spin = 6 + Math.random() * 14;
		S[o + 9] = (Math.random() - 0.5) * spin; S[o + 10] = (Math.random() - 0.5) * spin; S[o + 11] = (Math.random() - 0.5) * spin;
		const k = size * (0.6 + Math.random() * 0.8);
		S[o + 12] = k * K.s[0] * (0.8 + Math.random() * 0.4); S[o + 13] = k * K.s[1] * (0.8 + Math.random() * 0.4); S[o + 14] = k * K.s[2] * (0.8 + Math.random() * 0.4);
		S[o + 15] = floorAt(x, z, y);
		S[o + 16] = K.bounce; S[o + 17] = K.drag; S[o + 18] = 0; S[o + 19] = 1;
		const c = col || K.col, v = 0.85 + Math.random() * 0.25;
		C3.setRGB(c[0] * v, c[1] * v, c[2] * v, THREE.SRGBColorSpace);
		mesh.instanceColor.setXYZ(i, C3.r, C3.g, C3.b);
		mesh.instanceColor.needsUpdate = true;
		owner[i] = id;
		flying++;
		dirty = true;
	}
	function place(i) {
		const o = i * F;
		Q.setFromEuler(E.set(S[o + 6], S[o + 7], S[o + 8]));
		const g = S[o + 19] === 3 ? Math.max(0, 1 - S[o + 18]) : 1;
		mesh.setMatrixAt(i, M4.compose(P3.set(S[o], S[o + 1], S[o + 2]), Q, S3.set(S[o + 12] * g, S[o + 13] * g, S[o + 14] * g)));
	}
	function update(dt) {
		if (!flying && !dirty) return;
		dirty = false;
		const h = Math.min(dt, 1 / 20);
		let n = 0;
		for (let i = 0; i < cap; i++) {
			const o = i * F, mode = S[o + 19];
			if (mode === 0 || mode === 2) continue;
			if (mode === 3) {
				// (shrinking away)
				S[o + 18] += dt * 0.8;
				if (S[o + 18] >= 1) { S[o + 19] = 0; mesh.setMatrixAt(i, HIDE); owner[i] = null; }
				else { place(i); n++; }
				continue;
			}
			const drag = Math.exp(-S[o + 17] * h);
			S[o + 3] *= drag; S[o + 5] *= drag;
			S[o + 4] = S[o + 4] * (S[o + 17] > 2 ? drag : 1) - 9.8 * h * (S[o + 17] > 2 ? 0.35 : 1);
			S[o] += S[o + 3] * h; S[o + 1] += S[o + 4] * h; S[o + 2] += S[o + 5] * h;
			S[o + 6] += S[o + 9] * h; S[o + 7] += S[o + 10] * h; S[o + 8] += S[o + 11] * h;
			const rest = S[o + 15] + S[o + 13] * 0.5;
			if (S[o + 1] < rest) {
				S[o + 1] = rest;
				if (S[o + 4] < -0.6) {
					S[o + 4] = -S[o + 4] * S[o + 16];
					S[o + 3] *= 0.55; S[o + 5] *= 0.55;
					S[o + 9] *= 0.5; S[o + 10] *= 0.5; S[o + 11] *= 0.5;
				} else {
					// (lying: slid to a stop, laid flat on its broad side)
					S[o + 4] = 0; S[o + 3] *= 0.3; S[o + 5] *= 0.3;
					if (Math.hypot(S[o + 3], S[o + 5]) < 0.15) { S[o + 19] = 2; S[o + 6] = (Math.random() - 0.5) * 0.3; S[o + 8] = (Math.random() - 0.5) * 0.3; S[o + 18] = 0; flying--; }
				}
			}
			S[o + 18] += dt;
			place(i);
			n++;
		}
		if (n) mesh.instanceMatrix.needsUpdate = true;
	}
	// a wall repaired (or a building gone): its pieces shrink away
	function clear(id) {
		let any = false;
		for (let i = 0; i < cap; i++) {
			if (owner[i] !== id || S[i * F + 19] === 0) continue;
			if (S[i * F + 19] === 1) flying--;
			S[i * F + 19] = 3; S[i * F + 18] = 0; flying++; any = true;
		}
		if (any) dirty = true;
		return any;
	}
	// the oldest lying pieces go when they have lain long enough (checked now and then, not per frame)
	function tidy() {
		for (let i = 0; i < cap; i++) { const o = i * F; if (S[o + 19] === 2 && (S[o + 18] += 5) > life) { S[o + 19] = 3; S[o + 18] = 0; flying++; dirty = true; } }
	}
	const counts = () => { let fly = 0, lie = 0; for (let i = 0; i < cap; i++) { const m = S[i * F + 19]; if (m === 1 || m === 3) fly++; else if (m === 2) lie++; } return { flying: fly, lying: lie, cap }; };
	return { mesh, add, update, clear, tidy, counts, setLife: (s) => { life = s; } };
}
