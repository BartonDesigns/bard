// Where a round lands on a person, from their real bones: the skull, the neck, the chest (centre
// mass), the gut and pelvis, each shoulder, upper arm and forearm, each thigh and shin. The shapes
// are laid out once on the body's rest pose (its own landmarks: the skull's box, the chest's
// depth, the waist and hips, people/garment.js) and then ride the bones as the body moves, so a
// fighter kneeling, leaning out of cover, hunched over a wound or sitting crippled is hit where
// they are drawn. Each shape says its part (health.js PARTS) and its side.
//
// bodyShapes(P) -> the shapes for targets.js; aimPoint(P) -> the chest, for the lock-on;
// wound(P, shape, point) -> the hit held in its bone's frame (for a hand pressed to it).

import * as THREE from 'three';

const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
const K = new WeakMap();

// the zones in the rest pose: [bone, part, side, a, b, r] (a, b: offsets from the bone's head)
function zones(P) {
	let Z = K.get(P);
	if (Z) return Z;
	const { map, rest } = P, c = P.cut || {}, k = (P.height || 1.75) / 1.75;
	const head = (n) => rest.heads[map[n]];
	const off = (bone, x, y, z) => { const h = head(bone); return { x: x - h.x, y: y - h.y, z: z - h.z }; };
	Z = [];
	const add = (bone, part, side, a, b, r) => { if (map[bone] !== undefined) Z.push({ i: map[bone], part, side, a, b, r }); };
	// the skull: its own box (the face and jaw with it)
	const sk = c.skull && Number.isFinite(c.skull.x0) ? c.skull : null, hd = head('head');
	if (sk) {
		const r = Math.max(0.085 * k, Math.min(sk.x1 - sk.x0, sk.y1 - sk.y0, sk.z1 - sk.z0) * 0.5);
		const cy = (sk.y0 + sk.y1) / 2, cz = (sk.z0 + sk.z1) / 2;
		add('head', 'head', null, off('head', 0, cy - (sk.y1 - sk.y0) * 0.12, cz), off('head', 0, cy + (sk.y1 - sk.y0) * 0.12, cz), r);
	} else add('head', 'head', null, off('head', 0, hd.y + 0.08 * k, hd.z + 0.02), off('head', 0, hd.y + 0.12 * k, hd.z + 0.02), 0.1 * k);
	const nk = head('neck01');
	add('neck01', 'neck', null, { x: 0, y: 0, z: 0.005 }, off('neck01', 0, hd.y, hd.z + 0.01), 0.055 * k);
	// the chest: two capsules side by side, as deep as the chest and as wide as the shoulders
	const front = Number.isFinite(c.frontZ) ? c.frontZ : 0.1 * k, back = Number.isFinite(c.backZ) ? c.backZ : -0.12 * k;
	const cr = Math.max(0.09 * k, (front - back) / 2), cz = (front + back) / 2;
	const shX = c.shoulderX || 0.17 * k, wX = c.waistX || 0.14 * k, hX = c.hipX || 0.17 * k;
	const chestY = Number.isFinite(c.chest) ? c.chest : head('spine01').y, shY = Number.isFinite(c.shoulder) ? c.shoulder : nk.y - 0.05;
	const waistY = Number.isFinite(c.waist) ? c.waist : head('spine04').y, hipY = Number.isFinite(c.hip) ? c.hip : head('root').y;
	const cx = Math.max(0, shX * 0.82 - cr);
	for (const s of [1, -1]) add('spine01', 'chest', null, off('spine01', s * cx, chestY - 0.1 * k, cz), off('spine01', s * cx, shY - cr * 0.5, cz), cr);
	// the gut and pelvis
	const hz = c.hipZ ? (c.hipZ[0] + c.hipZ[1]) / 2 : cz, gr = Math.max(0.085 * k, c.hipZ ? (c.hipZ[1] - c.hipZ[0]) / 2 : cr * 0.9);
	const gx = Math.max(0, wX - gr), px = Math.max(0, hX - gr);
	for (const s of [1, -1]) {
		add('spine04', 'gut', null, off('spine04', s * gx, waistY, hz), off('spine04', s * gx, chestY - 0.1 * k - cr * 0.6, cz), gr);
		add('root', 'gut', null, off('root', s * px, hipY - 0.06 * k, hz), off('root', s * gx, waistY, hz), gr);
	}
	// the limbs, by their joints
	for (const s of ['L', 'R']) {
		const el = head('lowerarm01.' + s), wr = head('wrist.' + s), kn = head('lowerleg01.' + s), an = head('foot.' + s);
		add('upperarm01.' + s, 'shoulder', s, { x: 0, y: 0, z: 0 }, { x: 0, y: 0.01, z: 0 }, 0.075 * k);
		add('upperarm01.' + s, 'arm', s, { x: 0, y: 0, z: 0 }, off('upperarm01.' + s, el.x, el.y, el.z), 0.05 * k);
		add('lowerarm01.' + s, 'arm', s, { x: 0, y: 0, z: 0 }, off('lowerarm01.' + s, wr.x, wr.y, wr.z), 0.042 * k);
		add('upperleg01.' + s, 'leg', s, { x: 0, y: -0.04 * k, z: 0 }, off('upperleg01.' + s, kn.x, kn.y, kn.z), 0.078 * k);
		add('lowerleg01.' + s, 'leg', s, { x: 0, y: 0, z: 0 }, off('lowerleg01.' + s, an.x, an.y, an.z), 0.056 * k);
	}
	K.set(P, Z);
	return Z;
}

const point = (e, o) => ({ x: e[0] * o.x + e[4] * o.y + e[8] * o.z + e[12], y: e[1] * o.x + e[5] * o.y + e[9] * o.z + e[13], z: e[2] * o.x + e[6] * o.y + e[10] * o.z + e[14] });

// the shapes as the body stands now (null without a rig)
export function bodyShapes(P) {
	if (!P?.bones || !P.rest?.heads || !P.map) return null;
	const out = [];
	for (const z of zones(P)) {
		const e = P.bones[z.i].matrixWorld.elements;
		out.push({ type: 'capsule', a: point(e, z.a), b: point(e, z.b), r: z.r, part: z.part, side: z.side, bone: z.i });
	}
	return out;
}
// the middle of the chest, where a lock-on aims
export function aimPoint(P) {
	if (!P?.bones || !P.map || P.map.spine01 === undefined) return null;
	const z = zones(P).find((q) => q.part === 'chest');
	const e = P.bones[P.map.spine01].matrixWorld.elements;
	return z ? point(e, { x: 0, y: (z.a.y + z.b.y) / 2, z: z.a.z }) : point(e, { x: 0, y: 0, z: 0.04 });
}
// a wound held in its bone's frame: { bone, local } so it can be found again as the body moves
export function wound(P, shape, at) {
	if (!P?.bones || shape?.bone === undefined || !at) return null;
	_m.copy(P.bones[shape.bone].matrixWorld).invert();
	_v.set(at.x, at.y, at.z).applyMatrix4(_m);
	return { bone: shape.bone, local: _v.clone(), part: shape.part, side: shape.side };
}
// where a wound is now, in the world
export function woundAt(P, W, out = new THREE.Vector3()) { return out.copy(W.local).applyMatrix4(P.bones[W.bone].matrixWorld); }
