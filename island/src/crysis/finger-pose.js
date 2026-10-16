// Fingers for held things: each finger of a first-person hand closed onto the item's own surface.
//
// The palm is already placed by its grip (crysis/held-items.js HOLDS, handFrame()); this module
// decides what every finger does there. A hand's rig is read once off the player's own body
// (people/body.js): each finger's three bones, their rest lengths, the axis each curls about,
// and how thick the finger is on its palm side, measured from the skin's own vertices. The item
// is read once as triangles near the hand, in a small grid, so any point can be asked how far it
// is from the surface (negative inside).
//
// A finger is then solved one of three ways:
//   wrap:  closed a little at a time, all three joints together, until a segment touches; the
//          joints beyond it keep closing until they touch too (a grip round a handguard).
//   reach: a point on the finger (the pad, or the crease at the last joint) brought to a target,
//          without sinking into the surface (an index finger on a trigger, a thumb wrapped round
//          the far side, a hook on a bowstring).
//   fixed: given angles (a little finger tucked into a draw hand).
// A pose is four numbers a finger: [spread, base curl, middle curl, tip curl] in radians. Poses
// blend as plain numbers and become bone rotations each frame (fingerQuats), so nothing is made
// per frame. The solve runs when an item comes to hand and is kept (a few milliseconds).

import * as THREE from 'three';

const NAMES = [1, 2, 3, 4, 5];
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// a hand frame (columns a, t, n at the palm; held-items.js handFrame) from rest positions
function restFrame(P, side, out) {
	const H = (n) => P.rest.heads[P.map[n + '.' + side]];
	const w = H('wrist'), k = H('finger3-1'), i = H('finger2-1'), l = H('finger5-1');
	const a = k.clone().sub(w).normalize(), t = i.clone().sub(l);
	t.addScaledVector(a, -t.dot(a)).normalize();
	const n = side === 'R' ? new THREE.Vector3().crossVectors(t, a) : new THREE.Vector3().crossVectors(a, t);
	const o = k.clone().lerp(w, 0.45).addScaledVector(n, 0.012);
	return out.makeBasis(a, t, n).setPosition(o);
}

// ---------- the rig: read once off a body ----------
export function fingerRig(P, side) {
	const map = P.map, heads = P.rest.heads, tails = P.rest.tails;
	if (map['wrist.' + side] == null || map['finger2-1.' + side] == null) return null;
	const rest = restFrame(P, side, new THREE.Matrix4()), restInv = rest.clone().invert();
	const palmN = new THREE.Vector3().setFromMatrixColumn(rest, 2);
	// the axis each finger curls about, as people/motion.js has it
	const w = heads[map['wrist.' + side]];
	const n = heads[map['finger2-1.' + side]].clone().sub(w).cross(heads[map['finger5-1.' + side]].clone().sub(w)).normalize();
	if (n.x * (side === 'R' ? -1 : 1) > 0) n.negate();
	const chains = [], byBone = new Map();
	// the thumb flexes across the palm, toward the little finger's knuckle: each of its joints
	// curls about the axis that carries it there (the body's own curl axis would swing it back)
	const across = heads[map['finger4-1.' + side]].clone().lerp(heads[map['finger5-1.' + side]], 0.5).addScaledVector(palmN, 0.015);
	for (const f of NAMES) {
		const joints = [];
		for (let j = 1; j <= 3; j++) {
			const i = map[`finger${f}-${j}.${side}`];
			if (i == null) return null;
			const head = heads[i], tail = tails[i] || head.clone().addScaledVector(P.rest.dirs[i], 0.02);
			const dir = tail.clone().sub(head).normalize(), axis = f === 1 ? dir.clone().cross(across.clone().sub(head)).normalize() : dir.clone().cross(n).normalize();
			// the side a curl moves the finger toward, and which way that is relative to the palm
			let palmar = new THREE.Vector3().crossVectors(axis, dir).normalize();
			if (f > 1 && palmar.dot(palmN) < 0) { axis.negate(); palmar.negate(); }
			const parent = P.bones.indexOf(P.bones[i].parent);
			const joint = { i, parent, f, j, head: head.clone(), tail: tail.clone(), dir, axis, palmar, len: head.distanceTo(tail), off: head.clone().sub(heads[parent]), rSide: 0, rPad: 0 };
			joints.push(joint); byBone.set(i, joint);
		}
		// (the thumb's spread lifts it off the palm toward what the palm faces, so it can wrap round)
		if (f === 1) { const J = joints[0], q = new THREE.Quaternion().setFromAxisAngle(J.palmar, 0.1); J.spread = J.dir.clone().applyQuaternion(q).dot(palmN) > J.dir.dot(palmN) ? J.palmar.clone() : J.palmar.clone().negate(); }
		// the chain runs head to head; the last segment to its tail
		for (let j = 0; j < 3; j++) joints[j].next = j < 2 ? joints[j + 1].head.clone() : joints[j].tail.clone();
		chains.push(joints);
	}
	measureThickness(P, chains, byBone, palmN);
	// which way a finger's spread brings it in beside the middle finger (fingers close up as they grip)
	const mid = chains[2][0].dir;
	for (const joints of chains) {
		const J = joints[0], q = new THREE.Quaternion().setFromAxisAngle(J.palmar, 0.1);
		J.together = J.f === 3 || J.f === 1 ? 0 : J.dir.clone().applyQuaternion(q).dot(mid) > J.dir.dot(mid) ? 1 : -1;
	}
	const { fingers: skin, palm: palmSkin, heel: heelSkin } = skinSamples(P, side, chains, palmN);
	const scale = (P.height || 1.75) / 1.75;
	// the palm's thickness in front of its bones, sampled over the palm (for its contact)
	const palm = [];
	const H = (nm) => heads[map[nm + '.' + side]];
	const mcp = [2, 3, 4, 5].map((f) => H(`finger${f}-1`)), wr = H('wrist');
	for (const m of mcp) for (const u of [0.15, 0.5, 0.85]) palm.push(wr.clone().lerp(m, u));
	const thenar = H('finger1-2');
	if (thenar) palm.push(thenar.clone().lerp(wr, 0.3));
	return { side, chains, rest, restInv, palmN, palm, palmR: P.handPalmR || 0.013 * scale, scale, skin, palmSkin, heelSkin };
}

// The skin itself, for the last word on contact: up to 48 vertices of each finger (with their
// weights on its three bones; any other bone holds still under a finger's own pose) and of the
// palm's gripping side, at rest. A posed finger's vertex is the weighted sum of its bones'
// moves, exactly as the skin draws it.
function skinSamples(P, side, chains, palmN) {
	const g = P.skin?.geometry, fingers = chains.map(() => null);
	if (!g?.attributes.skinIndex) return { fingers, palm: null };
	const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
	const local = new Map();
	chains.forEach((joints, f) => joints.forEach((J, j) => local.set(J.i, [f, j])));
	const meta = new Set(P.bones.map((b, i) => (new RegExp(`^metacarpal\\d\\.${side}$`).test(b.name) ? i : -1)).filter((i) => i >= 0)), wristI = P.map['wrist.' + side];
	const lists = chains.map(() => []), palm = [], heel = [], wr = P.rest.heads[P.map['wrist.' + side]], v = new THREE.Vector3();
	for (let k = 0; k < pos.count; k++) {
		let best = 0, chain = -1, wsum = 0;
		for (let q = 0; q < 4; q++) {
			const b = si.getComponent(k, q), w = sw.getComponent(k, q);
			if (w > sw.getComponent(k, best)) best = q;
			const L = local.get(b);
			if (L && w > 0.05) { if (chain < 0) chain = L[0]; if (chain === L[0]) wsum += w; }
		}
		if (chain >= 0 && wsum > 0.35) {
			const ws = [];
			for (let q = 0; q < 4; q++) { const L = local.get(si.getComponent(k, q)), w = sw.getComponent(k, q); if (L && L[0] === chain && w > 0) ws.push(L[1], w); }
			lists[chain].push([k, ws]);
		} else if (meta.has(si.getComponent(k, best)) && sw.getComponent(k, best) > 0.5) {
			v.fromBufferAttribute(pos, k);
			// (only the palm's gripping side, in front of the wrist)
			if (v.clone().sub(wr).dot(palmN) > 0.004) palm.push(k);
		} else if (si.getComponent(k, best) === wristI && sw.getComponent(k, best) > 0.5) {
			// the heel of the hand, on the palm's side
			v.fromBufferAttribute(pos, k);
			if (v.clone().sub(wr).dot(palmN) > 0.006) heel.push(k);
		}
	}
	const pack = (list, f) => {
		const step = Math.max(1, Math.ceil(list.length / 160)), keep = list.filter((_, i) => i % step === 0);
		const out = { n: keep.length, p: new Float32Array(keep.length * 3), w: [] };
		keep.forEach(([k, ws], i) => { out.p[i * 3] = pos.getX(k); out.p[i * 3 + 1] = pos.getY(k); out.p[i * 3 + 2] = pos.getZ(k); out.w.push(ws); });
		void f;
		return out;
	};
	const pstep = Math.max(1, Math.ceil(palm.length / 64)), pk = palm.filter((_, i) => i % pstep === 0), pp = new Float32Array(pk.length * 3);
	pk.forEach((k, i) => { pp[i * 3] = pos.getX(k); pp[i * 3 + 1] = pos.getY(k); pp[i * 3 + 2] = pos.getZ(k); });
	const hstep = Math.max(1, Math.ceil(heel.length / 48)), hk = heel.filter((_, i) => i % hstep === 0), hp = new Float32Array(hk.length * 3);
	hk.forEach((k, i) => { hp[i * 3] = pos.getX(k); hp[i * 3 + 1] = pos.getY(k); hp[i * 3 + 2] = pos.getZ(k); });
	return { fingers: lists.map(pack), palm: pk.length ? pp : null, heel: hk.length ? hp : null };
}

// how thick each finger is round its bone, and on the side that grips (its pad), from the skin
function measureThickness(P, chains, byBone, palmN) {
	const g = P.skin?.geometry, scale = (P.height || 1.75) / 1.75;
	const DEF = [[0.0105, 0.0095, 0.0085], [0.0095, 0.0085, 0.0075], [0.0098, 0.0088, 0.0078], [0.0094, 0.0084, 0.0074], [0.0085, 0.0076, 0.0068]];
	const lists = new Map();
	if (g?.attributes.skinIndex && g.attributes.position) {
		const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, v = new THREE.Vector3(), c = new THREE.Vector3();
		for (let k = 0; k < pos.count; k++) {
			let best = 0; for (let q = 1; q < 4; q++) if (sw.getComponent(k, q) > sw.getComponent(k, best)) best = q;
			if (sw.getComponent(k, best) < 0.6) continue;
			const J = byBone.get(si.getComponent(k, best));
			if (!J) continue;
			v.fromBufferAttribute(pos, k);
			const u = clamp(v.clone().sub(J.head).dot(J.dir) / J.len, 0, 1);
			if (u < 0.2 || u > 0.8) continue;
			c.copy(J.head).addScaledVector(J.dir, u * J.len);
			const d = v.clone().sub(c), r = d.length();
			let L = lists.get(J); if (!L) lists.set(J, L = { all: [], pad: [] });
			L.all.push(r); if (d.dot(J.palmar) > r * 0.7) L.pad.push(r);
		}
	}
	const pct = (a, q) => { if (a.length < 4) return 0; a.sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; };
	for (const joints of chains) for (const J of joints) {
		const L = lists.get(J), d = DEF[J.f - 1][J.j - 1] * scale;
		J.rSide = clamp((L && pct(L.all, 0.6)) || d, d * 0.6, d * 1.5);
		J.rPad = clamp((L && pct(L.pad, 0.75)) || J.rSide, J.rSide * 0.8, J.rSide * 1.6);
	}
	void palmN;
}

// ---------- the item as a field: triangles near a hand, in a grid ----------
const CELL = 0.008, REACH = 0.02;
// objects: [mesh, matrix (mesh to item space)]; box: the item-space region worth reading
export function contactField(objects, box) {
	const tris = [], grid = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), lo = box.min, hi = box.max;
	for (const [mesh, m] of objects) {
		const g = mesh.geometry, p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count;
		for (let i = 0; i < n; i += 3) {
			a.fromBufferAttribute(p, ix ? ix.getX(i) : i).applyMatrix4(m); b.fromBufferAttribute(p, ix ? ix.getX(i + 1) : i + 1).applyMatrix4(m); c.fromBufferAttribute(p, ix ? ix.getX(i + 2) : i + 2).applyMatrix4(m);
			const x0 = Math.min(a.x, b.x, c.x) - REACH, x1 = Math.max(a.x, b.x, c.x) + REACH, y0 = Math.min(a.y, b.y, c.y) - REACH, y1 = Math.max(a.y, b.y, c.y) + REACH, z0 = Math.min(a.z, b.z, c.z) - REACH, z1 = Math.max(a.z, b.z, c.z) + REACH;
			if (x1 < lo.x || x0 > hi.x || y1 < lo.y || y0 > hi.y || z1 < lo.z || z0 > hi.z) continue;
			// (slivers and degenerate faces have no normal worth a sign)
			const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z, e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
			const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, nl = Math.hypot(nx, ny, nz);
			if (nl < 1e-12) continue;
			const t = tris.length / 12;
			tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, nx / nl, ny / nl, nz / nl);
			for (let X = Math.floor(Math.max(x0, lo.x) / CELL); X <= Math.floor(Math.min(x1, hi.x) / CELL); X++)
				for (let Y = Math.floor(Math.max(y0, lo.y) / CELL); Y <= Math.floor(Math.min(y1, hi.y) / CELL); Y++)
					for (let Z = Math.floor(Math.max(z0, lo.z) / CELL); Z <= Math.floor(Math.min(z1, hi.z) / CELL); Z++) {
						const k = (X * 73856093) ^ (Y * 19349663) ^ (Z * 83492791);
						let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(t);
					}
		}
	}
	const T = new Float64Array(tris);
	// the signed distance from (x, y, z) to the surface, or REACH where nothing is near
	function sd(x, y, z) {
		const list = grid.get((Math.floor(x / CELL) * 73856093) ^ (Math.floor(y / CELL) * 19349663) ^ (Math.floor(z / CELL) * 83492791));
		if (!list) return REACH;
		let best = REACH * REACH, sign = 1;
		for (let q = 0; q < list.length; q++) {
			const o = list[q] * 12;
			const [cx, cy, cz] = closest(x, y, z, T, o);
			const dx = x - cx, dy = y - cy, dz = z - cz, d = dx * dx + dy * dy + dz * dz;
			if (d < best) { best = d; sign = dx * T[o + 9] + dy * T[o + 10] + dz * T[o + 11] < 0 ? -1 : 1; }
		}
		return Math.sqrt(best) * sign;
	}
	return { sd, triangles: T.length / 12, REACH };
}
// the closest point on triangle o of T to p (Ericson, Real-Time Collision Detection 5.1.5)
const _cp = [0, 0, 0];
function closest(px, py, pz, T, o) {
	const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
	const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
	const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
	if (d1 <= 0 && d2 <= 0) { _cp[0] = ax; _cp[1] = ay; _cp[2] = az; return _cp; }
	const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
	if (d3 >= 0 && d4 <= d3) { _cp[0] = bx; _cp[1] = by; _cp[2] = bz; return _cp; }
	const vc = d1 * d4 - d3 * d2;
	if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); _cp[0] = ax + abx * v; _cp[1] = ay + aby * v; _cp[2] = az + abz * v; return _cp; }
	const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
	if (d6 >= 0 && d5 <= d6) { _cp[0] = cx; _cp[1] = cy; _cp[2] = cz; return _cp; }
	const vb = d5 * d2 - d1 * d6;
	if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); _cp[0] = ax + acx * w; _cp[1] = ay + acy * w; _cp[2] = az + acz * w; return _cp; }
	const va = d3 * d6 - d5 * d4;
	if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); _cp[0] = bx + (cx - bx) * w; _cp[1] = by + (cy - by) * w; _cp[2] = bz + (cz - bz) * w; return _cp; }
	const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
	_cp[0] = ax + abx * v + acx * w; _cp[1] = ay + aby * v + acy * w; _cp[2] = az + abz * v + acz * w;
	return _cp;
}
// an item's meshes in item space (glass and motes left out), for contactField
export function itemParts(model, only = null) {
	const out = [];
	model.updateMatrix();
	const inv = new THREE.Matrix4().copy(model.matrix).invert();
	model.updateMatrixWorld(true);
	model.traverse((o) => {
		if (!o.isMesh || o.name === 'glass' || (only && !only.includes(o.name))) return;
		out.push([o, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)]);
	});
	return out;
}

// ---------- a finger's joints for a pose (rest space) ----------
const _q = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const _v = new THREE.Vector3();
// the local rotation of joint J for a finger's numbers (spread only at the base)
function jointQuat(J, p, out) {
	const curl = p[J.j];
	out.setFromAxisAngle(J.axis, curl);
	if (J.j === 1 && p[0]) out.premultiply(_qb.setFromAxisAngle(J.spread || J.palmar, p[0]));
	return out;
}
// positions (rest space) of each joint, the tip, and each segment's palm side, into out
function forward(chain, p, out) {
	_qa.identity();
	let px = chain[0].head.x, py = chain[0].head.y, pz = chain[0].head.z;
	for (let j = 0; j < 3; j++) {
		const J = chain[j], q = jointQuat(J, p, _q[j]);
		_qa.multiply(q);
		const s = out.seg[j];
		s.a.set(px, py, pz);
		_v.copy(J.next).sub(J.head).applyQuaternion(_qa);
		s.b.set(px + _v.x, py + _v.y, pz + _v.z);
		s.palmar.copy(J.palmar).applyQuaternion(_qa);
		s.q.copy(_qa);
		s.r = J.rSide; s.pad = J.rPad;
		px = s.b.x; py = s.b.y; pz = s.b.z;
	}
	return out;
}
const scratch = () => ({ seg: [0, 1, 2].map(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), palmar: new THREE.Vector3(), q: new THREE.Quaternion(), r: 0, pad: 0 })) });
// the nearest the posed finger's own skin comes to the surface (negative: sunk in), or null
const _t = new THREE.Vector3(), _u = new THREE.Vector3();
function skinClear(rig, f, fk, M, field) {
	const S = rig.skin?.[f], chain = rig.chains[f];
	if (!S || !S.n) return null;
	let worst = Infinity;
	for (let i = 0; i < S.n; i++) {
		const vx = S.p[i * 3], vy = S.p[i * 3 + 1], vz = S.p[i * 3 + 2], ws = S.w[i];
		let x = 0, y = 0, z = 0, sum = 0;
		for (let k = 0; k < ws.length; k += 2) {
			const J = chain[ws[k]], sg = fk.seg[ws[k]], w = ws[k + 1];
			_t.set(vx - J.head.x, vy - J.head.y, vz - J.head.z).applyQuaternion(sg.q).add(sg.a);
			x += _t.x * w; y += _t.y * w; z += _t.z * w; sum += w;
		}
		_u.set(x + vx * (1 - sum), y + vy * (1 - sum), z + vz * (1 - sum)).applyMatrix4(M);
		worst = Math.min(worst, field.sd(_u.x, _u.y, _u.z));
	}
	return worst;
}

// ---------- solving ----------
// Anatomical ranges, radians, each in the bone's own frame: [spread, base, middle, tip], a
// positive curl always toward the palm. Fingers: abduction about 17 degrees either way, the
// knuckle 0 to 90 with 10 of hyperextension, the middle joint 0 to 110, the last 0 to 80. Thumb:
// the saddle joint lifts the thumb off the palm (up to 57) and flexes it across (up to 52, back
// 12), the knuckle 0 to 60 (never back), the last joint 0 to 80 (back 3 at most). Nothing bends past these,
// after any solve or blend (limitPose).
export const LIMITS = {
	finger: [[-0.3, 0.3], [-0.17, 1.57], [0, 1.92], [0, 1.4]],
	thumb: [[-0.35, 1.0], [-0.2, 0.9], [0, 1.05], [-0.05, 1.4]],
};
// a pose (four numbers a finger) held inside the ranges, in place
export function limitPose(params) {
	for (let f = 0; f < 5; f++) { const L = LIMITS[f ? 'finger' : 'thumb']; for (let j = 0; j < 4; j++) params[f * 4 + j] = clamp(params[f * 4 + j], L[j][0], L[j][1]); }
	return params;
}
// a spec's own range, kept inside the anatomical one
const rangeOf = (spec, thumb) => { const L = LIMITS[thumb ? 'thumb' : 'finger']; return spec.limits ? spec.limits.map(([a, b], j) => [Math.max(a, L[j][0]), Math.min(b, L[j][1])]) : L; };
// how far (negative: how deep) a posed finger is from the surface, over its segments from..to
const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3();
function clearance(fk, M, field, from = 0, to = 2) {
	let worst = Infinity;
	for (let j = from; j <= to; j++) {
		const s = fk.seg[j];
		for (let u = 0.2; u < 1; u += 0.35) {
			_s1.copy(s.a).lerp(s.b, u);
			_s2.copy(_s1).addScaledVector(s.palmar, s.pad - s.r).applyMatrix4(M);
			_s1.applyMatrix4(M);
			worst = Math.min(worst, field.sd(_s1.x, _s1.y, _s1.z) - s.r, field.sd(_s2.x, _s2.y, _s2.z) - s.r);
		}
	}
	return worst;
}
// close a finger until it touches, all joints together; then the joints beyond the segment that
// touched close on until they touch as well (or reach their limit)
function wrap(chain, M, field, spec, fk) {
	const thumb = chain[0].f === 1, lim = LIMITS[thumb ? 'thumb' : 'finger'];
	const k = spec.ratio || (thumb ? [0.7, 0.8, 0.9] : [1, 1.12, 0.78]), relax = spec.relax || 0;
	const p = [spec.spread ?? (chain[0].together || 0) * [0, 0.1, 0, 0.06, 0.14][chain[0].f - 1], 0, 0, 0];
	p.touched = false;
	const set = (s, from) => { for (let j = from; j <= 3; j++) p[j] = clamp(s * k[j - 1] * 1.45, lim[j][0], lim[j][1]); };
	const gap = (from, to = 2) => clearance(forward(chain, p, fk), M, field, from, to);
	let from = 1;
	while (from <= 3) {
		let lo = 0, hi = -1;
		for (let s = 0.02; s <= 1.001; s += 0.02) { set(s, from); if (gap(from - 1) <= 0) { hi = s; break; } lo = s; }
		// nothing to close on: a loose, natural curl
		if (hi < 0) { set(spec.free ?? 0.7, from); break; }
		p.touched = true;
		// already touching when open: leave it open
		if (lo === 0 && gap(from - 1) <= 0) { set(0, from); break; }
		for (let it = 0; it < 7; it++) { const m = (lo + hi) / 2; set(m, from); if (gap(from - 1) <= 0) hi = m; else lo = m; }
		set(hi, from);
		let touched = 2;
		for (let j = from - 1; j <= 2; j++) if (gap(j, j) <= 0) { touched = j; break; }
		set(lo, from);
		from = touched + 2;
	}
	if (relax) for (let j = 1; j <= 3; j++) p[j] = Math.max(lim[j][0], p[j] - relax);
	return p;
}
// bring a point of a finger to a target without sinking in: a coarse search, then descent
function reach(chain, M, Minv, field, spec, fk, rig = null) {
	const thumb = chain[0].f === 1, lim = rangeOf(spec, thumb);
	// (ahead: the target this far in front of the finger's own knuckle along the item, wherever
	// the hand has settled: a finger laid straight along a frame)
	const goal = spec.target.clone();
	if (spec.ahead != null) goal.x = chain[0].head.clone().applyMatrix4(M).x + spec.ahead;
	const target = goal.applyMatrix4(Minv);
	const natural = spec.natural || (thumb ? [0.2, 0.4, 0.3, 0.2] : [0, 0.4, 0.5, 0.35]);
	const lockTip = spec.tip != null, P = new THREE.Vector3();
	const point = (fk) => {
		const s = fk.seg[spec.at === 'dip' ? 1 : 2];
		if (spec.at === 'dip') return P.copy(s.b).addScaledVector(fk.seg[2].palmar, s.pad);
		return P.copy(s.a).lerp(s.b, spec.along ?? 0.62).addScaledVector(s.palmar, s.pad);
	};
	const cost = (p) => {
		if (lockTip) p[3] = spec.tip;
		for (let j = 0; j < 4; j++) p[j] = clamp(p[j], lim[j][0], lim[j][1]);
		forward(chain, p, fk);
		const d = point(fk).distanceToSquared(target);
		// (a pressing thumb is judged by its own skin, which the capsules overstate round its base)
		let pen = (spec.soft && rig ? skinClear(rig, chain[0].f - 1, fk, M, field) : clearance(fk, M, field, spec.skipBase ? 1 : 0)) + (spec.soft || 0); pen = pen < 0 ? pen * pen : 0;
		let reg = 0; for (let j = 0; j < 4; j++) reg += (p[j] - natural[j]) ** 2;
		return d + (spec.press ?? 2500) * pen + 2e-5 * reg;
	};
	// coarse: spread, base and middle curl over their range; then a descent from the few best
	const S = thumb ? [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2] : [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45];
	const starts = [[cost(natural), natural.slice()]];
	for (const sp of S) for (let a = lim[1][0]; a <= lim[1][1]; a += 0.2) for (let b = lim[2][0]; b <= lim[2][1]; b += 0.2) for (const k of [0.5, 1]) {
		const p = [sp, a, b, lockTip ? spec.tip : b * k];
		starts.push([cost(p), p]);
	}
	starts.sort((x, y) => x[0] - y[0]);
	let best = starts[0][1], bestC = starts[0][0];
	for (const [c0, p0] of starts.slice(0, 6)) {
		let cur = p0.slice(), curC = c0;
		for (let step = 0.12; step > 0.003; step *= 0.5) {
			let moved = true;
			while (moved) {
				moved = false;
				for (let j = 0; j < 4; j++) for (const dir of [-1, 1]) {
					if (lockTip && j === 3) continue;
					const p = cur.slice(); p[j] = clamp(p[j] + dir * step, lim[j][0], lim[j][1]);
					const c = cost(p);
					if (c < curC - 1e-12) { curC = c; cur = p; moved = true; }
				}
			}
		}
		if (curC < bestC) { bestC = curC; best = cur; }
	}
	if (lockTip) best[3] = spec.tip;
	forward(chain, best, fk);
	best.miss = point(fk).distanceTo(target);
	return best;
}

// The skin has the last word: a finger sunk into the surface opens (its curl scaled down) until
// it is clear; one that should touch and does not closes on until it does.
function settle(rig, f, p, M, field, fk, close) {
	const chain = rig.chains[f], lim = LIMITS[f === 0 ? 'thumb' : 'finger'], q = p.slice();
	const at = (s) => { for (let j = 1; j <= 3; j++) q[j] = clamp(p[j] * s, lim[j][0], lim[j][1]); return skinClear(rig, f, forward(chain, q, fk), M, field); };
	const c = at(1);
	if (c == null || field.triangles === 0) return p;
	let lo, hi;
	if (c < -0.0003) { lo = 0.4; hi = 1; if (at(lo) < 0) return p; for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (at(m) < 0) hi = m; else lo = m; } at(lo); }
	else if (close && c > 0.0006) { lo = 1; hi = close === 'rest' ? 1.9 : 1.4; if (at(hi) > 0.0003) return p; for (let i = 0; i < 9; i++) { const m = (lo + hi) / 2; if (at(m) > 0.0003) lo = m; else hi = m; } at(hi); }
	else return p;
	return q;
}

// A finger laid along the item (spec.lay: the index straight along the frame) brought onto it:
// its spread and its knuckle tried a little either way, within its range, for the pose whose skin
// rests on the surface (a fraction of a millimetre off, never in), nearest the pose it had; its
// tip kept at the height it had (drop: metres; curl: how much the last joints may close), so it
// lies straight along the side of the frame and never falls onto or into the trigger guard.
const _tip = new THREE.Vector3();
function lay(rig, f, p, M, field, fk, lim, drop = 0.001, curl = 0) {
	const chain = rig.chains[f], q = p.slice();
	const c0 = skinClear(rig, f, forward(chain, q, fk), M, field), floorY = _tip.copy(fk.seg[2].b).applyMatrix4(M).y - drop;
	if (c0 == null || field.triangles === 0 || (c0 > -0.0003 && c0 < 0.0009)) return p;
	let best = null, bs = Infinity;
	for (let a = -0.3; a <= 0.3001; a += 0.05) for (let b = -0.3; b <= 0.3001; b += 0.05) for (let m = 0; m <= curl + 1e-4; m += 0.1) {
		q[0] = clamp(p[0] + a, lim[0][0], lim[0][1]); q[1] = clamp(p[1] + b, lim[1][0], lim[1][1]); q[2] = clamp(p[2] + m, lim[2][0], lim[2][1]); q[3] = clamp(p[3] + m * 0.5, lim[3][0], lim[3][1]);
		const c = skinClear(rig, f, forward(chain, q, fk), M, field);
		if (c == null || c < -0.0003 || _tip.copy(fk.seg[2].b).applyMatrix4(M).y < floorY) continue;
		const sc = Math.abs(c - 0.0003) * 1000 + (Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2])) * 0.8;
		if (sc < bs) { bs = sc; best = q.slice(); }
	}
	if (!best || bs >= Math.abs(c0 - 0.0003) * 1000) return p;
	best.miss = p.miss;
	return best;
}

// A hand's pose on an item. frame: the palm's frame in the field's space (HOLDS' m); specs: one
// per finger ({ mode: 'wrap' | 'reach' | 'fixed', ... }); fit: move the palm along its normal so
// it rests on the surface. Returns the four numbers per finger, how far the palm was moved, and
// each finger's clearance (metres; negative is sunk in).
const EMPTY = { sd: () => REACH, REACH, triangles: 0 };
// (firm: the whole palm and its heel rest on the surface, none of it pressing in, as a relaxed
// bow hand does on a riser rather than a fist round a grip)
export function solveHand(rig, field, frame, specs, { fit = true, firm = false } = {}) {
	const fk = scratch(), M = new THREE.Matrix4(), F = frame.clone();
	field ||= EMPTY;
	let shift = 0;
	if (fit) {
		const P = new THREE.Vector3(), skin = rig.palmSkin;
		for (let it = 0; it < 5; it++) {
			M.multiplyMatrices(F, rig.restInv);
			let worst = Infinity;
			// (the palm is soft: a few of its points may press in, as the heel of a hand does round
			// a grip; the rest rest on the surface)
			if (skin) {
				const d = [];
				for (const list of firm && rig.heelSkin ? [skin, rig.heelSkin] : [skin]) for (let i = 0; i < list.length; i += 3) { P.set(list[i], list[i + 1], list[i + 2]).applyMatrix4(M); d.push(field.sd(P.x, P.y, P.z)); }
				d.sort((x, y) => x - y);
				worst = firm ? d[0] - 0.0004 : d[Math.min(d.length - 1, Math.floor(d.length * 0.06))] + 0.0015;
			}
			else for (const q of rig.palm) { P.copy(q).addScaledVector(rig.palmN, rig.palmR).applyMatrix4(M); worst = Math.min(worst, field.sd(P.x, P.y, P.z)); }
			if (!Number.isFinite(worst) || worst >= field.REACH * 0.95) break;
			const d = clamp(worst, -0.02 - shift, 0.016 - shift);
			if (Math.abs(d) < 1e-4) break;
			shift += d; F.multiply(new THREE.Matrix4().makeTranslation(0, 0, d));
		}
	}
	const params = new Float32Array(20), miss = [null, null, null, null, null];
	let report = [];
	// (a knuckle that no curl can bring clear moves the palm off a little, up to 6 mm, and the
	// fingers are closed again)
	for (let round = 0; round < 3; round++) {
		M.multiplyMatrices(F, rig.restInv);
		const Minv = M.clone().invert();
		report = [];
		let worst = 0;
		miss.fill(null);
		for (let f = 0; f < 5; f++) {
			const spec = specs[f] || { mode: 'wrap' }, chain = rig.chains[f];
			let p;
			if (spec.mode === 'fixed') p = spec.params.slice();
			else if (spec.mode === 'reach') p = reach(chain, M, Minv, field, spec, fk, rig);
			else p = wrap(chain, M, field, spec, fk);
			// (rest: a curled finger beside the item closes on until it rests against it, if it is near)
			if (spec.mode !== 'fixed') p = settle(rig, f, p, M, field, fk, spec.mode === 'wrap' && (p.touched || (spec.rest && 'rest')));
			if (spec.lay && spec.mode === 'reach') p = lay(rig, f, p, M, field, fk, rangeOf(spec, f === 0));
			params.set(p, f * 4);
			const skin = skinClear(rig, f, forward(chain, p, fk), M, field) ?? clearance(fk, M, field);
			report.push(+(skin * 1000).toFixed(1));
			miss[f] = p.miss != null ? +(p.miss * 1000).toFixed(1) : null;
			if (spec.mode === 'wrap' && f > 0) worst = Math.min(worst, skin);
		}
		if (!fit || worst > -0.0008 || shift < -0.022 || round === 2) break;
		const d = Math.max(worst, -0.006);
		shift += d; F.multiply(new THREE.Matrix4().makeTranslation(0, 0, d));
	}
	limitPose(params);
	return { params, shift, frame: F, clearanceMm: report, missMm: miss };
}

// ---------- each frame ----------
// the rotations of the fifteen finger bones for a pose (four numbers a finger), into quats
export function fingerQuats(rig, params, quats) {
	for (let f = 0; f < 5; f++) {
		const chain = rig.chains[f], o = f * 4;
		_p4[0] = params[o]; _p4[1] = params[o + 1]; _p4[2] = params[o + 2]; _p4[3] = params[o + 3];
		for (let j = 0; j < 3; j++) jointQuat(chain[j], _p4, quats[f * 3 + j]);
	}
	return quats;
}
const _p4 = [0, 0, 0, 0];
// out = a + (b - a) * k, for poses
export function blendPose(out, a, b, k) { for (let i = 0; i < 20; i++) out[i] = a[i] + (b[i] - a[i]) * k; return out; }
// add a curl to fingers (from: the first finger, 0 the thumb) at each joint, for a squeeze
export function squeeze(out, k, from = 1, to = 4) { for (let f = from; f <= to; f++) { out[f * 4 + 1] += k; out[f * 4 + 2] += k * 1.2; out[f * 4 + 3] += k * 0.6; } return out; }
// where a finger's joints and tip are for a pose (four numbers), in the space of a palm frame
// (for checks and tools)
export function fingerPoints(rig, f, p, frame = new THREE.Matrix4()) {
	const fk = forward(rig.chains[f], p, scratch()), M = new THREE.Matrix4().multiplyMatrices(frame, rig.restInv);
	return [fk.seg[0].a, fk.seg[1].a, fk.seg[2].a, fk.seg[2].b].map((v) => v.clone().applyMatrix4(M));
}
