// The Shard Mite's legs: eight of them, each two long faceted crystals (amethyst, lit a little
// from within), grown here on the rig's leg bones, since a leg that thin and that clean cannot
// be carved from a painted sheet (tools/monsters/build.py leaves those bones as bare rig: 'ghost'
// in the mite's spec). The upper crystal rises from the body to the knee, the lower one runs
// down from the knee to a point in the ground, so each turns with its bone and the gait in
// creatures/motion.js walks them.
//
// Its back is grown the same way: the painted body is only the core, and over it rows of crystal
// plates stand up and lean back like a pine cone's scales, a crest along the top and a fan of
// long ones at the tail, as on its sheet.
//
// When the mite dies it does not fall: it shatters (shatter(), which hides the body and leaves
// the shards to combat/fx.js).

import * as THREE from 'three';
import { GFX_PHONE } from '../world/device.js';

// one crystal along +y from 0 to 1: a five-sided prism, thick near its root, cut to a point at
// its far end and bevelled at its near one
export function crystalGeometry() {
	const n = 5, rings = [[0, 0.55], [0.12, 1], [0.7, 0.85], [1, 0]];
	const pos = [];
	const ring = (y, r, a0) => Array.from({ length: n }, (_, i) => { const a = a0 + i * Math.PI * 2 / n; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
	const R = rings.map(([y, r], k) => ring(y, r, k * 0.21));
	for (let k = 0; k < R.length - 1; k++) {
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n, a = R[k][i], b = R[k][j], c = R[k + 1][j], d = R[k + 1][i];
			pos.push(...a, ...c, ...b, ...a, ...d, ...c);
		}
	}
	// (its root capped)
	for (let i = 0; i < n; i++) pos.push(0, 0, 0, ...R[0][i], ...R[0][(i + 1) % n]);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
}
let kit = null;
function shared() {
	if (kit) return kit;
	kit = {
		geo: crystalGeometry(),
		mat: new THREE.MeshStandardMaterial({ color: 0xb59ae8, roughness: 0.18, metalness: 0.05, emissive: 0x4a1f8c, emissiveIntensity: 0.55, flatShading: true }),
		crest: new THREE.MeshStandardMaterial({ color: 0x7b4ccc, roughness: 0.14, metalness: 0.08, emissive: 0x3c0f8a, emissiveIntensity: 0.65, flatShading: true }),
	};
	return kit;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0);

const _n = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _w = new THREE.Matrix4();

// the plates on its back: rows from behind the head to the tail, each row a fan round the top of
// the body, each plate standing on the body's surface (found from its own vertices) and leaning
// back; on the chest or the hips bone, whichever it sits over, so they ride the gait
function crest(c, K, bones, rootInv) {
	const v = [];
	c.root.traverse((o) => {
		if (!o.isSkinnedMesh) return;
		// (where each vertex is drawn, skinned: a packed model's are quantised, undone by its bones)
		const P = o.geometry.attributes.position, M = new THREE.Matrix4().copy(rootInv).multiply(o.matrixWorld);
		for (let i = 0; i < P.count; i += 2) v.push(o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(M));
	});
	const chest = bones.get('chest'), hips = bones.get('hips');
	if (!v.length || !chest || !hips) return;
	const J = c.meta.joints, H = c.meta.height || 0.5;
	let zmin = Infinity;
	for (const p of v) zmin = Math.min(zmin, p.z);
	const z0 = J.chest ? J.chest[1][2] - 0.04 * H : 0, zs = J.chest ? J.chest[0][2] : 0;
	let seed = 7;
	const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
	const list = [];
	// the body's top at z in direction a (0 up, + its left), and the centre of its section there
	function surface(z, a) {
		const band = v.filter((p) => Math.abs(p.z - z) < 0.025 * H / 0.56 + 0.01);
		if (!band.length) return null;
		let lo = Infinity, hi = -Infinity;
		for (const p of band) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
		const yc = (lo + hi) / 2;
		_d.set(Math.sin(a), Math.cos(a), 0);
		let best = null, bd = -Infinity;
		for (const p of band) { const d = p.x * _d.x + (p.y - yc) * _d.y; if (d > bd) { bd = d; best = p; } }
		return best ? { p: best, yc } : null;
	}
	const rows = 7;
	for (let r = 0; r < rows; r++) {
		const u = r / (rows - 1), z = z0 + (zmin + 0.06 * H - z0) * u;
		const big = 0.55 + 0.55 * Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.75);
		for (let i = -3; i <= 3; i++) {
			const a = (i + (r % 2 ? 0.5 : 0)) * 0.42;
			if (Math.abs(a) > 1.45) continue;
			const f = surface(z, a);
			if (!f) continue;
			_n.set(f.p.x, f.p.y - f.yc, 0).normalize();
			const len = 0.2 * H * big * (1 - Math.abs(a) * 0.3) * (0.8 + rand() * 0.4);
			_d.copy(_n).multiplyScalar(0.75).add(_s.set((rand() - 0.5) * 0.25, 0.15, -0.85)).normalize();
			list.push({ at: f.p.clone().addScaledVector(_n, -0.012 * H), dir: _d.clone(), len, w: len * (0.2 + rand() * 0.08) });
		}
	}
	// the fan of long ones at its tail
	const tail = surface(zmin + 0.05 * H, 0);
	if (tail) {
		for (let i = 0; i < 7; i++) {
			const a = (i - 3) * 0.32;
			_d.set(Math.sin(a) * 0.55, 0.3 + Math.cos(a) * 0.2 - Math.abs(a) * 0.25, -1).normalize();
			const len = 0.28 * H * (1 - Math.abs(a) * 0.25) * (0.85 + rand() * 0.3);
			list.push({ at: new THREE.Vector3(Math.sin(a) * 0.04 * H, tail.yc + 0.02 * H, zmin + 0.06 * H), dir: _d.clone(), len, w: len * 0.18 });
		}
	}
	for (const [bone, mine] of [[chest, (p) => p.z > zs], [hips, (p) => p.z <= zs]]) {
		const some = list.filter((x) => mine(x.at));
		if (!some.length) continue;
		const mesh = new THREE.InstancedMesh(K.geo, K.crest, some.length);
		mesh.castShadow = true; mesh.frustumCulled = false;
		const inv = new THREE.Matrix4().copy(rootInv).multiply(bone.matrixWorld).invert();
		some.forEach((x, i) => {
			_q.setFromUnitVectors(_up, x.dir);
			_w.compose(x.at, _q, _s.set(x.w, x.len, x.w));
			mesh.setMatrixAt(i, _w.premultiply(inv));
		});
		bone.add(mesh);
	}
}

// grow the legs on a creature body (creatures/models.js makeCreature, its root at rest); returns
// { shatter(fx), reset() }
export function crystalLegs(c) {
	const K = shared();
	const J = c.meta.joints || {};
	const bones = new Map();
	c.root.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
	c.root.updateMatrixWorld(true);
	const rootInv = new THREE.Matrix4().copy(c.root.matrixWorld).invert();
	const legs = [];
	for (const name of c.meta.bones || []) {
		const m = /^leg\d([ab])_/.exec(name);
		const b = bones.get(name), j = J[name];
		if (!m || !b || !j) continue;
		// the joint's two ends into the bone's own frame
		_m.copy(rootInv).multiply(b.matrixWorld).invert();
		_a.fromArray(j[0]).applyMatrix4(_m);
		_b.fromArray(j[1]).applyMatrix4(_m);
		const len = _a.distanceTo(_b);
		if (len < 1e-4) continue;
		const mesh = new THREE.Mesh(K.geo, K.mat);
		mesh.position.copy(_a);
		mesh.quaternion.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
		// (the upper crystal stout, the lower long and fine, its point the foot)
		const r = (m[1] === 'a' ? 0.12 : 0.05) * len + 0.008 * (c.meta.height || 0.5);
		mesh.scale.set(r, len * (m[1] === 'a' ? 1.25 : 1), r);
		// (sixteen of them a mite: their shadows only off a phone)
		mesh.castShadow = !GFX_PHONE;
		b.add(mesh);
		legs.push(mesh);
	}
	crest(c, K, bones, rootInv);
	return {
		// it bursts into shards where it stands and is gone
		shatter(fx) {
			if (!c.root.visible) return;
			c.root.updateMatrixWorld(true);
			const p = c.root.getWorldPosition(new THREE.Vector3());
			p.y += (c.meta.height || 0.5) * 0.55 * (c.size || 1);
			fx?.glass(p, 18, 3.2, 0.14);
			fx?.sparks(p, 14, null, 0.75, 0.55, 1, 5);
			c.root.visible = false;
		},
		reset() { c.root.visible = true; },
	};
}
