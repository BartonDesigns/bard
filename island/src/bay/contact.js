// Where things meet the ground round you: a soft shade on the ground at the foot of each
// building, under the trees and shrubs, and under the parked cars, so they sit in the ground
// rather than on it. The light about the sky is half hidden there, by day and by night alike,
// so the shade multiplies whatever the ground already is (its own small material: the
// ground's shader is left as it is). Each patch is laid on the ground as walked, its heights
// read once and kept; the lot is merged into one draw, rebuilt as you move.

import * as THREE from 'three';

const EMPTY = { P: [], D: [], T: [], x: 0, z: 0 };
const SEG = 8, RING = [...Array(SEG)].map((_, i) => [Math.cos(i / SEG * Math.PI * 2), Math.sin(i / SEG * Math.PI * 2)]);

// ground(x, z): the ground as walked; city: lotsNear, treesAt; street: parkedNear
export function createContact(scene, { ground, city, street = null, isPhone = false }) {
	const R = isPhone ? 70 : 120, CAP = isPhone ? 24000 : 60000, NEW = isPhone ? 60 : 160, LIFT = 0.05;
	const pos = new Float32Array(CAP * 3), colr = new Float32Array(CAP * 3), idx = new Uint32Array(CAP * 3);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('color', new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setIndex(new THREE.BufferAttribute(idx, 1).setUsage(THREE.DynamicDrawUsage));
	geo.setDrawRange(0, 0);
	const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, fog: false, toneMapped: false });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.name = 'ground-contact'; mesh.frustumCulled = false; mesh.renderOrder = -1;
	scene.add(mesh);

	// a patch: its points (x, y, z), how dark each is (0 none .. 1 the darkest), its triangles
	const cache = new Map();
	const H = (x, z) => ground(x, z) + LIFT;
	// a ring round a footprint (centre, half sizes, turned by a), out m wide, dark k at the wall
	function ring(cx, cz, a, hw, hd, out, k) {
		const ca = Math.cos(a), sa = Math.sin(a), P = [], D = [], T = [];
		const w = (lx, lz) => [cx + ca * lx + sa * lz, cz - sa * lx + ca * lz];
		const C = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
		const inner = [], outer = [];
		for (let e = 0; e < 4; e++) {
			const [ax, az] = C[e], [bx, bz] = C[(e + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
			const nx = Math.sign(az + bz) === 0 ? Math.sign(ax) : 0, nz = nx ? 0 : Math.sign(az);
			for (let i = 0; i < n; i++) {
				const t = i / n, lx = ax + (bx - ax) * t, lz = az + (bz - az) * t;
				inner.push([lx, lz]);
				// (at a corner, out along both sides)
				outer.push(i === 0 ? [lx + Math.sign(lx) * out, lz + Math.sign(lz) * out] : [lx + nx * out, lz + nz * out]);
			}
		}
		const n = inner.length;
		for (let i = 0; i < n; i++) {
			for (const [q, d] of [[inner[i], k], [outer[i], 0]]) { const [x, z] = w(q[0], q[1]); P.push(x, H(x, z), z); D.push(d); }
			const j = (i + 1) % n;
			T.push(i * 2, j * 2, i * 2 + 1, j * 2, j * 2 + 1, i * 2 + 1);
		}
		return { P, D, T, x: cx, z: cz };
	}
	// a soft disc under a tree or shrub: darkest at the stem
	function disc(cx, cz, r, k) {
		const P = [cx, H(cx, cz), cz], D = [k], T = [];
		for (const [f, d] of [[0.45, k * 0.6], [1, 0]]) for (const [c, s] of RING) { const x = cx + c * r * f, z = cz + s * r * f; P.push(x, H(x, z), z); D.push(d); }
		for (let i = 0; i < SEG; i++) {
			const j = (i + 1) % SEG;
			T.push(0, 1 + j, 1 + i, 1 + i, 1 + j, 1 + SEG + i, 1 + j, 1 + SEG + j, 1 + SEG + i);
		}
		return { P, D, T, x: cx, z: cz };
	}
	// a car: dark under it, fading out past its sides
	function car(cx, cz, yaw) {
		const p = ring(cx, cz, yaw + Math.PI, 0.75, 1.95, 0.6, 0.55);
		// (and the dark between the wheels, filled)
		const b = p.P.length / 3, c = Math.cos(yaw), s = Math.sin(yaw);
		for (const [lx, lz] of [[-0.75, -1.95], [0.75, -1.95], [0.75, 1.95], [-0.75, 1.95]]) { const x = cx + c * lx + s * lz, z = cz - s * lx + c * lz; p.P.push(x, H(x, z), z); p.D.push(0.55); }
		p.T.push(b, b + 2, b + 1, b, b + 3, b + 2);
		return p;
	}

	let lastX = 1e9, lastZ = 1e9, pending = false, n0 = 0, i0 = 0;
	function patch(key, make) {
		let p = cache.get(key);
		if (!p) { if (made >= NEW) { pending = true; return null; } made++; p = make(); cache.set(key, p); }
		p.seen = stamp;
		return p;
	}
	let made = 0, stamp = 0;
	function rebuild(cx, cz) {
		made = 0; pending = false; stamp++;
		const list = [];
		for (const o of city.lotsNear(cx, cz, R)) {
			if (o.h < 2 || Math.hypot(o.x - cx, o.z - cz) > R + 20) continue;
			// (a lot is turned by -a; nothing for what stands up on a roof or a deck)
			const p = patch(o, () => (o.y > ground(o.x, o.z) + 0.6 ? EMPTY : ring(o.x, o.z, -(o.a || 0), o.w / 2, o.d / 2, Math.min(2.2, 1 + o.h * 0.05), 0.42)));
			if (p) list.push(p);
		}
		for (const t of city.treesAt?.(cx, cz, R) || []) {
			const p = patch(t, () => (t.shrub ? disc(t.x, t.z, Math.max(0.6, t.h * 0.7), 0.35) : disc(t.x, t.z, Math.min(4.5, Math.max(1.4, t.h * 0.2)), t.cone ? 0.42 : 0.5)));
			if (p) list.push(p);
		}
		for (const c of street?.parkedNear(cx, cz, R * 0.8) || []) {
			const p = patch(c.id + ':' + Math.round(c.x * 4) + ',' + Math.round(c.z * 4), () => car(c.x, c.z, c.yaw));
			if (p) list.push(p);
		}
		// (let go what is out of reach)
		if (cache.size > 6000) for (const [k, p] of cache) if (p.seen !== stamp) cache.delete(k);
		let nv = 0, ni = 0;
		for (const p of list) {
			const v = p.D.length;
			if (nv + v > CAP || ni + p.T.length > CAP * 3) break;
			// (faded out toward the edge of the reach)
			const f = 1 - Math.min(1, Math.max(0, (Math.hypot(p.x - cx, p.z - cz) - R * 0.7) / (R * 0.3)));
			pos.set(p.P, nv * 3);
			for (let i = 0; i < v; i++) { const c = 1 - p.D[i] * f; colr[(nv + i) * 3] = colr[(nv + i) * 3 + 1] = colr[(nv + i) * 3 + 2] = c; }
			for (let i = 0; i < p.T.length; i++) idx[ni + i] = p.T[i] + nv;
			nv += v; ni += p.T.length;
		}
		for (const [a, m] of [[geo.attributes.position, Math.max(nv, n0) * 3], [geo.attributes.color, Math.max(nv, n0) * 3], [geo.index, Math.max(ni, i0)]]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, m)); a.needsUpdate = true; }
		n0 = nv; i0 = ni;
		geo.setDrawRange(0, ni);
	}
	let t = 0;
	function update(cam, dt = 0.016) {
		const x = cam.position.x, z = cam.position.z;
		t += dt;
		// (high over the land the shades are too small to matter)
		const high = cam.position.y - ground(x, z) > 160;
		mesh.visible = !high;
		if (high) return;
		if (pending || Math.hypot(x - lastX, z - lastZ) > 10 || t > 3) { t = 0; lastX = x; lastZ = z; rebuild(x, z); }
	}
	return { update, mesh, info: () => ({ patches: cache.size, tris: geo.drawRange.count / 3 }) };
}
