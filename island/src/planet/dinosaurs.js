// Dinosaurs on the wild worlds, brought over from the old app's primal herds: raptors and
// tyrants that walk alone, and herds of ostrich-mimics, duck-bills, horned faces, armoured
// tanks and long-necks. Each species is one skinned, instanced draw per detail level: its
// bones sit in a small float texture, a row per animal, and the vertex shader bends every
// vertex between two bones, so necks and tails curve smoothly. Feet stay planted while they
// carry the weight and swing to the next footfall; heads look about; tails sway. Grazers
// keep together and scatter from you (the horned and the armoured stand and face you);
// hunters wander, and turn to watch or stalk you. None of them go into water or up the steep.
//
// Only a handful near you are drawn: the rest go on living at a slow tick, and those drawn
// dissolve into a coarser body and then out at the edge of sight (world/lodfade.js).

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { addLodFade, NONE_IN } from '../world/lodfade.js';

// the green worlds where things still grow big (a world flight marks as wild counts too)
export const WILD_TYPES = ['TERRAN', 'TROPICAL', 'SHEPHERD'];
export const isWildWorld = (profile) => !!profile && !profile.realm && (!!profile.primal || !!profile.wild || WILD_TYPES.includes(profile.type));

const HALF_PI = Math.PI / 2;
const ONE = new THREE.Vector3(1, 1, 1);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const frac = (x) => x - Math.floor(x);
const e1 = new THREE.Euler(), q1 = new THREE.Quaternion(), m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4();
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), n1 = new THREE.Vector3();

// ---------- the skeleton ----------
// every bone runs along its own +z; a leg is a bone turned to point down
class Rig {
	constructor() { this.bones = []; }
	add(parent, off, rot = [0, 0, 0], len = 0) {
		this.bones.push({ parent, off: V3(...off), rest: rot.slice(), len });
		return this.bones.length - 1;
	}
	// bones end to end, the first at `off` on the parent
	chain(parent, off, lens, rots) {
		const ids = [];
		let p = parent;
		lens.forEach((l, k) => { p = this.add(p, k ? [0, 0, lens[k - 1]] : off, rots[k], l); ids.push(p); });
		return ids;
	}
	restPose() { const r = new Float32Array(this.bones.length * 3); this.bones.forEach((b, i) => r.set(b.rest, i * 3)); return r; }
	fk(pose, mats, upto = this.bones.length) {
		for (let i = 0; i < upto; i++) {
			const b = this.bones[i];
			e1.set(pose[i * 3], pose[i * 3 + 1], pose[i * 3 + 2]);
			m1.compose(b.off, q1.setFromEuler(e1), ONE);
			if (b.parent < 0) mats[i].copy(m1); else mats[i].multiplyMatrices(mats[b.parent], m1);
		}
	}
	// the pitch a bone has from the root (for levelling a head at the end of a neck)
	pitch(i, pose) { let s = 0; for (; i >= 0; i = this.bones[i].parent) s += pose ? pose[i * 3] : this.bones[i].rest[0]; return s; }
}

// A leg of four bones: thigh and shin reach the ankle, the long foot comes down to the ball
// of the foot at P, the toes lie along the body. Worked in the plane of the leg, in the frame
// of the body part it hangs from (which only pitches).
const IA = new THREE.Vector3(), IP = new THREE.Vector3(), IM = new THREE.Matrix4();
function legIK(leg, pose, mats, P, rig) {
	const [u, l, m, t] = leg.b;
	IM.copy(mats[leg.parent]).invert();
	IA.set(P.x, P.y + leg.L3 * Math.cos(leg.beta), P.z - leg.L3 * Math.sin(leg.beta)).applyMatrix4(IM);
	IP.copy(P).applyMatrix4(IM);
	const hy = leg.hip.y, hz = leg.hip.z, L1 = leg.L1, L2 = leg.L2, reach = L1 + L2;
	let dy = IA.y - hy, dz = IA.z - hz, d = Math.hypot(dy, dz);
	if (d < 1e-5) { dy = -1; dz = 0; d = 1; }
	const dc = Math.min(reach * 0.995, Math.max(reach * 0.3, d));
	const ay = hy + dy / d * dc, az = hz + dz / d * dc;
	const phi = Math.atan2(dz, -dy);
	const alpha = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc))));
	const p1 = phi + leg.s * alpha;
	const ky = hy - Math.cos(p1) * L1, kz = hz + Math.sin(p1) * L1;
	const p2 = Math.atan2(az - kz, -(ay - ky));
	const p3 = Math.atan2(IP.z - az, -(IP.y - ay));
	const p4 = HALF_PI + rig.pitch(leg.parent, pose);
	pose[u * 3] = HALF_PI - p1; pose[l * 3] = p1 - p2; pose[m * 3] = p2 - p3; pose[t * 3] = p3 - p4;
	pose[u * 3 + 1] = pose[u * 3 + 2] = 0;
}

// ---------- the body, as one mesh bound to the skeleton ----------
const INK = { claw: [0.2, 0.18, 0.15], horn: [0.3, 0.27, 0.22], eye: [0.04, 0.03, 0.02], tooth: [0.9, 0.87, 0.78], mouth: [0.42, 0.2, 0.18] };
class Shape {
	constructor(rig, restW, fine, pal) {
		this.rig = rig; this.W = restW; this.fine = fine; this.pal = pal;
		this.p = []; this.n = []; this.c = []; this.s = []; this.i = []; this.coatTris = [];
	}
	colour(col, ny) {
		if (col === 'skin') { const k = smooth(-0.45, 0.35, ny), A = this.pal.belly, B = this.pal.back; return [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k)]; }
		return typeof col === 'string' ? (this.pal[col] || INK[col]) : col;
	}
	// a vertex given in a bone's frame (at rest), bent by that bone and, by w, a second one
	vert(b, lp, ln, col, b1 = -1, w = 0) {
		v1.copy(lp).applyMatrix4(this.W[b]);
		n1.copy(ln).transformDirection(this.W[b]);
		return this.raw(v1, n1, this.colour(col, n1.y), b, b1 < 0 ? b : b1, w, col === 'skin' ? smooth(-0.3, 0.7, n1.y) : 0);
	}
	raw(p, n, c, b0, b1, w, pat) {
		// colours are authored in display space; the shader lights in linear
		this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.c.push(c[0] ** 2.2, c[1] ** 2.2, c[2] ** 2.2); this.s.push(b0, b1, w, pat);
		return this.p.length / 3 - 1;
	}
	// a triangle, turned to face the way its vertex normals point
	tri(a, b, c) {
		const P = this.p, N = this.n;
		const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
		const wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
		const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
		const sx = N[a * 3] + N[b * 3] + N[c * 3], sy = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], sz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
		if (fx * sx + fy * sy + fz * sz < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
	}
	quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
	// an ellipsoid on a bone; o.blend = [bone, z0, z1, w]: toward z0 it bends with that bone too
	ellipsoid(b, c, r, col, o = {}) {
		const rows = this.fine ? (o.rows || 10) : 5, cols = this.fine ? (o.cols || 14) : 7, ids = [], t0 = this.i.length;
		const rot = o.rot ? new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...o.rot)) : null;
		for (let j = 0; j <= rows; j++) {
			const ph = j / rows * Math.PI, row = [];
			for (let i = 0; i <= cols; i++) {
				const th = i / cols * Math.PI * 2, ux = Math.sin(ph) * Math.cos(th), uy = Math.cos(ph), uz = Math.sin(ph) * Math.sin(th);
				const lp = V3(ux * r[0], uy * r[1], uz * r[2]), ln = V3(ux / r[0], uy / r[1], uz / r[2]).normalize();
				if (rot) { lp.applyMatrix4(rot); ln.applyMatrix4(rot); }
				lp.add(V3(...c));
				let b1 = -1, w = 0;
				if (o.blend) { b1 = o.blend[0]; w = (o.blend[3] ?? 0.5) * (1 - smooth(o.blend[1], o.blend[2], lp.z)); }
				row.push(this.vert(b, lp, ln, col, b1, w));
			}
			ids.push(row);
		}
		for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) this.quad(ids[j][i], ids[j + 1][i], ids[j + 1][i + 1], ids[j][i + 1]);
		if (o.coat) this.coatTris.push([t0, this.i.length, o.coat]);
	}
	// one smooth tube down a chain of bones; each joint ring is shared by the two bones there
	tube(bones, radii, col, o = {}) {
		const seg = this.fine ? (o.seg || 12) : 6, sub = this.fine ? 3 : 2, rings = [], t0 = this.i.length;
		const tall = o.tall || 1, wide = o.wide || 1;
		const ring = (b, z, r, b1, w) => {
			const ids = [];
			for (let k = 0; k < seg; k++) {
				const a = k / seg * Math.PI * 2, cx = Math.cos(a), sy = Math.sin(a);
				ids.push(this.vert(b, V3(cx * r * wide, sy * r * tall, z), V3(cx / wide, sy / tall, 0).normalize(), col, b1, w));
			}
			rings.push(ids);
		};
		bones.forEach((b, k) => {
			const L = this.rig.bones[b].len;
			for (let s = 0; s < sub; s++) {
				const t = s / sub, r = lerp(radii[k], radii[k + 1], t);
				if (s === 0 && k > 0) ring(b, 0, r, bones[k - 1], 0.5);
				else if (s === 0 && o.root !== undefined) ring(b, 0, r, o.root, 0.5);
				else ring(b, t * L, r, -1, 0);
			}
		});
		const last = bones[bones.length - 1], LL = this.rig.bones[last].len, rEnd = radii[bones.length];
		ring(last, LL, rEnd, -1, 0);
		for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < seg; k++) this.quad(rings[j][k], rings[j + 1][k], rings[j + 1][(k + 1) % seg], rings[j][(k + 1) % seg]);
		// the end: drawn out to a point (tails) or closed round
		const tip = this.vert(last, V3(0, 0, LL + rEnd * (o.point ? 3 : 0.8)), V3(0, 0, 1), col);
		const R = rings[rings.length - 1];
		for (let k = 0; k < seg; k++) this.tri(R[k], R[(k + 1) % seg], tip);
		if (o.coat) this.coatTris.push([t0, this.i.length, o.coat]);
	}
	// a horn, claw or tooth
	cone(b, base, dir, len, r, col) {
		const seg = this.fine ? 7 : 4, d = V3(...dir).normalize(), s = Math.abs(d.y) > 0.9 ? V3(1, 0, 0) : V3(0, 1, 0).cross(d).normalize(), u = d.clone().cross(s), B = V3(...base), ids = [];
		for (let k = 0; k < seg; k++) {
			const a = k / seg * Math.PI * 2, rad = s.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a));
			ids.push(this.vert(b, B.clone().addScaledVector(rad, r), rad.clone().addScaledVector(d, r / len).normalize(), col));
		}
		const tip = this.vert(b, B.clone().addScaledVector(d, len), d, col);
		for (let k = 0; k < seg; k++) this.tri(ids[k], ids[(k + 1) % seg], tip);
	}
	// a long feather: a tapered blade, seen from both sides
	feather(b, base, dir, len, width, col) {
		const d = V3(...dir).normalize(), s = V3(0, 1, 0).cross(d);
		if (s.lengthSq() < 1e-4) s.set(1, 0, 0);
		s.normalize();
		const nrm = d.clone().cross(s).normalize(), B = V3(...base);
		const c2 = this.colour(col, 1).map((x) => x * 1.15);
		const a = this.vert(b, B.clone().addScaledVector(s, width * 0.25), nrm, col), c = this.vert(b, B.clone().addScaledVector(s, -width * 0.25), nrm, col);
		const m0 = this.vert(b, B.clone().addScaledVector(d, len * 0.55).addScaledVector(s, width * 0.5), nrm, col), m3 = this.vert(b, B.clone().addScaledVector(d, len * 0.55).addScaledVector(s, -width * 0.5), nrm, col);
		const tp = this.vert(b, B.clone().addScaledVector(d, len), nrm, c2);
		this.quad(a, m0, m3, c); this.tri(m0, tp, m3);
	}
	// down: little combed tufts over the parts marked for it, as the old coat builder made them
	coat(count, len, rnd) {
		const P = this.p, N = this.n, S = this.s, areas = [], tris = [];
		let total = 0;
		for (const [t0, t1, k] of this.coatTris) for (let i = t0; i < t1; i += 3) {
			const a = this.i[i], b = this.i[i + 1], c = this.i[i + 2];
			v1.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
			v2.set(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]);
			total += v1.cross(v2).length() * 0.5 * k;
			areas.push(total); tris.push(i);
		}
		if (!total) return;
		const A = this.pal.coat, Bc = this.pal.coatTip, p = V3(0, 0, 0), n = V3(0, 0, 0), flow = V3(0, 0, 0), side = V3(0, 0, 0), q = V3(0, 0, 0);
		for (let j = 0; j < count; j++) {
			const target = (j + rnd()) / count * total;
			let lo = 0, hi = areas.length - 1;
			while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < target) lo = mid + 1; else hi = mid; }
			const ti = tris[lo], ids = [this.i[ti], this.i[ti + 1], this.i[ti + 2]];
			const s = Math.sqrt(rnd()), v = rnd(), wts = [1 - s, s * (1 - v), s * v];
			p.set(0, 0, 0); n.set(0, 0, 0);
			for (let k = 0; k < 3; k++) { const id = ids[k]; p.x += P[id * 3] * wts[k]; p.y += P[id * 3 + 1] * wts[k]; p.z += P[id * 3 + 2] * wts[k]; n.x += N[id * 3] * wts[k]; n.y += N[id * 3 + 1] * wts[k]; n.z += N[id * 3 + 2] * wts[k]; }
			n.normalize();
			// combed back and a little down, lying along the skin
			flow.set(0, -0.25, -1).addScaledVector(n, -flow.set(0, -0.25, -1).dot(n));
			if (flow.lengthSq() < 1e-6) flow.set(1, 0, 0);
			flow.normalize();
			side.crossVectors(flow, n).normalize();
			const L = len * (0.6 + rnd() * 0.7), W = L * 0.32, k = rnd(), sh = 0.85 + rnd() * 0.25;
			const col = [lerp(A[0], Bc[0], k) * sh, lerp(A[1], Bc[1], k) * sh, lerp(A[2], Bc[2], k) * sh];
			const id0 = ids[0], b0 = S[id0 * 4], b1 = S[id0 * 4 + 1], w = S[id0 * 4 + 2];
			const a = this.raw(q.copy(p).addScaledVector(side, W).addScaledVector(n, -L * 0.05), n, col, b0, b1, w, 0);
			const c = this.raw(q.copy(p).addScaledVector(side, -W).addScaledVector(n, -L * 0.05), n, col, b0, b1, w, 0);
			const tip = this.raw(q.copy(p).addScaledVector(flow, L * 0.8).addScaledVector(n, L * 0.35), n, col.map((x) => x * 1.08), b0, b1, w, 0);
			this.i.push(a, c, tip);
		}
	}
	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
		g.setAttribute('aSkin', new THREE.Float32BufferAttribute(this.s, 4));
		g.setIndex(this.i);
		g.computeBoundingBox();
		g.computeBoundingSphere();
		g.boundingSphere.radius *= 1.25;
		return g;
	}
}

// ---------- body plans ----------
// A runner on two legs (raptors, tyrants, ostrich-mimics) or a walker on four. Measures in
// metres; the animal faces +z with the ground at y = 0 under its hips.
function planRig(o) {
	const R = new Rig(), h = o.hip, quad = !!o.front;
	const pel = R.add(-1, [0, h, 0]);
	const chest = R.add(pel, [0, o.chestUp, o.chestZ], [o.chestTilt, 0, 0]);
	const neck = R.chain(chest, o.neckAt, o.neck, o.neck.map((_, k) => [k ? o.neckBend : -o.neckUp, 0, 0]));
	const nl = neck[neck.length - 1];
	const head = R.add(nl, [0, 0, o.neck[o.neck.length - 1]], [0, 0, 0], o.headL);
	R.bones[head].rest[0] = -R.pitch(nl) + (o.headTilt || 0);
	const jaw = R.add(head, o.jawAt, [0.05, 0, 0]);
	const tail = R.chain(pel, o.tailAt, o.tail, o.tail.map((_, k) => (k ? [o.tailDroop, 0, 0] : [o.tailLift, Math.PI, 0])));
	const legs = [], arms = [];
	const leg = (parent, side, L, s, phase) => {
		const u = R.add(parent, [side * L.w, L.drop, L.z || 0], [1.2, 0, 0], L.L1);
		const l = R.add(u, [0, 0, L.L1], [0, 0, 0], L.L2);
		const m = R.add(l, [0, 0, L.L2], [0, 0, 0], L.L3);
		const t = R.add(m, [0, 0, L.L3], [0, 0, 0], L.toe);
		legs.push({ b: [u, l, m, t], parent, L1: L.L1, L2: L.L2, L3: L.L3, beta: L.beta, s, side, hip: R.bones[u].off, phase, cfg: L, neutral: V3() });
	};
	// hind legs, then (on four) the front: phases for a walk; `trot` pairs the diagonals
	leg(pel, -1, o.hind, 1, 0); leg(pel, 1, o.hind, 1, 0.5);
	if (quad) { leg(chest, -1, o.front, -1, 0.25); leg(chest, 1, o.front, -1, 0.75); }
	if (o.arm) for (const side of [-1, 1]) {
		const a = o.arm, s = R.add(chest, [side * a.w, a.at[0], a.at[1]], [HALF_PI - 0.5, 0, -side * 0.12], a.L[0]);
		const f = R.add(s, [0, 0, a.L[0]], [-1.35, 0, 0], a.L[1]);
		const hd = R.add(f, [0, 0, a.L[1]], [0.45, 0, 0], a.L[2]);
		arms.push([s, f, hd]);
	}
	// stand it: the feet under the hips, the legs bent to reach them
	const mats = R.bones.map(() => new THREE.Matrix4()), pose = R.restPose();
	R.fk(pose, mats);
	for (const L of legs) {
		v1.copy(L.hip).applyMatrix4(mats[L.parent]);
		L.neutral.set(v1.x, L.cfg.footY, v1.z + L.cfg.footZ);
		legIK(L, pose, mats, L.neutral, R);
		for (const b of L.b) R.bones[b].rest[0] = pose[b * 3];
	}
	R.fk(R.restPose(), mats);
	const inv = mats.map((m) => m.clone().invert());
	const headPos = V3().setFromMatrixPosition(mats[head]);
	return { rig: R, restW: mats, inv, pel, chest, neck, head, jaw, tail, legs, arms, quad, headPos, trot: quad ? [0, 0.5, 0.5, 0] : [0, 0.5] };
}

// the flesh on a plan, with each family's own features
function planShape(S, sp, P, fine, rnd) {
	const o = sp.o, coat = sp.coat ? 1 : 0, bodyCoat = coat ? { coat: 1 } : {};
	S.ellipsoid(P.pel, o.pelC, o.pelR, 'skin', { ...bodyCoat, rows: 12, cols: 16 });
	S.ellipsoid(P.chest, o.chestC, o.chestR, 'skin', { ...bodyCoat, rows: 12, cols: 16, blend: [P.pel, -o.chestR[2] * 0.9, o.chestC[2], 0.5] });
	if (o.bellyR) S.ellipsoid(P.chest, o.bellyC, o.bellyR, 'skin', { blend: [P.pel, -o.bellyR[2], o.bellyC[2], 0.5] });
	S.tube(P.neck, o.neckR, 'skin', { root: P.chest, tall: o.neckTall || 1.1, coat: coat ? 1 : 0 });
	S.tube(P.tail, o.tailR, 'skin', { root: P.pel, tall: o.tailTall || 1.2, point: true, coat: coat ? 1 : 0 });
	// the head
	const H = o.head;
	S.ellipsoid(P.head, H.skull[0], H.skull[1], 'skin', { rows: 9, cols: 12, blend: [P.neck[P.neck.length - 1], -H.skull[1][2], 0, 0.45] });
	if (H.snout) S.ellipsoid(P.head, H.snout[0], H.snout[1], 'skin', { rows: 8, cols: 12 });
	S.ellipsoid(P.jaw, H.jaw[0], H.jaw[1], 'skin', { rows: 6, cols: 10 });
	for (const side of [-1, 1]) S.ellipsoid(P.head, [side * H.eye[0], H.eye[1], H.eye[2]], [H.eye[3], H.eye[3], H.eye[3]], 'eye', { rows: 5, cols: 6 });
	if (H.beak) S.cone(P.head, H.beak[0], H.beak[1], H.beak[2], H.beak[3], 'horn');
	if (fine && H.teeth) { const [x, y, z0, z1, len] = H.teeth; for (let z = z0; z <= z1; z += len * 0.9) for (const side of [-1, 1]) S.cone(P.head, [side * x * (1 - (z - z0) / (z1 - z0) * 0.3), y, z], [0, -1, 0.1], len, len * 0.3, 'tooth'); }
	if (H.horns) for (const [b, d, len, r] of H.horns) S.cone(P.head, b, d, len, r, 'horn');
	if (H.crest) S.cone(P.head, H.crest[0], H.crest[1], H.crest[2], H.crest[3], 'crest');
	if (H.frill) {
		const [c, r, tilt] = H.frill;
		S.ellipsoid(P.head, c, r, 'frill', { rot: [tilt, 0, 0], rows: 6, cols: 16 });
		if (fine) for (let k = 0; k <= 10; k++) {
			const a = Math.PI * (0.05 + 0.9 * k / 10), lx = Math.cos(a) * r[0] * 0.98, ly = Math.sin(a) * r[1] * 0.98;
			const p = V3(lx, ly, 0).applyEuler(new THREE.Euler(tilt, 0, 0)).add(V3(...c)), d = V3(lx, ly, 0).normalize().applyEuler(new THREE.Euler(tilt, 0, 0));
			S.cone(P.head, p.toArray(), d.toArray(), 0.14, 0.05, 'horn');
		}
	}
	// the legs: a thigh of muscle, one tube down to the foot, toes and claws
	for (const L of P.legs) {
		const c = L.cfg, [u, l, m, t] = L.b;
		S.ellipsoid(u, [0, 0, L.L1 * 0.34], [c.thigh, c.thigh * 1.25, L.L1 * 0.66], 'skin', { blend: [L.parent, 0, L.L1 * 0.3, 0.5], coat: coat && !L.cfg.bare ? 1 : 0 });
		S.tube([u, l, m], c.R, 'skin', { root: L.parent });
		if (c.pad) S.ellipsoid(t, [0, c.pad[1] * 0.2, c.pad[2] * 0.3], c.pad, 'skin', { rows: 5, cols: 10 });
		const toes = c.toes || 3;
		for (let k = 0; k < toes; k++) {
			const sx = toes === 1 ? 0 : (k / (toes - 1) - 0.5) * 2, dir = [sx * 0.35, -0.08, 1], len = L.cfg.toe * (1 - Math.abs(sx) * 0.2);
			S.cone(t, [sx * c.R[3] * 0.6, c.R[3] * 0.3, -c.R[3] * 0.3], dir, len + c.R[3] * 0.6, c.R[3] * 0.55, 'skin');
			if (fine) { const dn = V3(...dir).normalize(); S.cone(t, [sx * c.R[3] * 0.6 + dn.x * len, c.R[3] * 0.3 + dn.y * len, -c.R[3] * 0.3 + dn.z * len], dir, c.R[3] * 0.9, c.R[3] * 0.3, 'claw'); }
		}
		// a raptor's killing claw, held up off the ground
		if (fine && c.sickle) S.cone(t, [-L.side * c.R[3] * 0.7, c.R[3] * 0.9, c.R[3] * 0.2], [-L.side * 0.1, 0.7, 0.7], c.sickle, c.R[3] * 0.4, 'claw');
	}
	// arms: small, folded, clawed (and feathered on a raptor)
	for (const [s, f, hd] of P.arms) {
		const a = o.arm;
		S.tube([s, f, hd], a.R, 'skin', { root: P.chest, coat: coat });
		if (fine) for (let k = 0; k < 3; k++) S.cone(hd, [(k - 1) * a.R[3] * 0.8, 0, a.L[2]], [(k - 1) * 0.2, -0.6, 1], a.claw, a.R[3] * 0.5, 'claw');
		if (fine && a.wing) for (let k = 0; k < 6; k++) S.feather(f, [0, -a.R[2] * 0.5, a.L[1] * (0.1 + k * 0.17)], [0, -1, -0.6 + k * 0.08], a.wing * (0.7 + k * 0.08), a.wing * 0.25, 'coat');
	}
	// a raptor's tail fan
	if (fine && o.tailFan) P.tail.forEach((b, k) => {
		if (k < 2) return;
		const L = sp.P.rig.bones[b].len;
		for (const side of [-1, 1]) S.feather(b, [side * o.tailR[k] * 0.6, 0, L * 0.3], [side, 0.05, 0.9], o.tailFan * (0.6 + k * 0.08), o.tailFan * 0.22, 'coat');
	});
	// armour: rows of bony studs down the back, spikes out of the flanks, a club on the tail
	if (o.armour) for (const [b, C, R] of [[P.pel, o.pelC, o.pelR], [P.chest, o.chestC, o.chestR]]) {
		for (let i = 0; i < (fine ? 6 : 3); i++) for (let j = 0; j < (fine ? 7 : 3); j++) {
			const u = (j / ((fine ? 7 : 3) - 1) - 0.5) * 2.2, v = (i / ((fine ? 6 : 3) - 1) - 0.5) * 1.6;
			const n = V3(Math.sin(u), Math.cos(u) * Math.cos(v), Math.sin(v)).normalize();
			const p = V3(C[0] + n.x * R[0], C[1] + n.y * R[1], C[2] + n.z * R[2]);
			const edge = Math.abs(u) > 0.95;
			S.cone(b, p.toArray(), n.toArray(), edge ? 0.28 : 0.1 + rnd() * 0.05, edge ? 0.07 : 0.06, edge ? 'horn' : 'stud');
		}
	}
	if (o.club) {
		const b = P.tail[P.tail.length - 1], L = sp.P.rig.bones[b].len;
		S.ellipsoid(b, [0, 0, L + o.club[2] * 0.5], o.club, 'stud', { rows: 7, cols: 10 });
	}
	// down over the body
	if (coat && fine) S.coat(sp.coatN, sp.coatLen, rnd);
}

// ---------- the families ----------
// o: the plan; pal: back, belly and details; pat: pattern [scale, strength, spots 0..1];
// beh: diet, walk and run speeds (m/s), how near you may come, what they do then
const SPECIES = {
	raptor: {
		name: 'Dakotaraptor', coat: true, coatN: 1500, coatLen: 0.07,
		pal: { back: [0.33, 0.24, 0.15], belly: [0.80, 0.72, 0.58], coat: [0.28, 0.20, 0.13], coatTip: [0.66, 0.53, 0.36] },
		pat: [5, 0.45, 0], graze: [0.4, 0.3, 0.2, 0.3], hunt: true,
		beh: { diet: 'meat', walk: 1.7, run: 8.5, notice: 45, react: 'stalk', keep: 12, turn: 2.6, count: [2, 4] },
		o: {
			hip: 1.0, chestUp: 0.02, chestZ: 0.3, chestTilt: -0.1, pelC: [0, 0.05, -0.05], pelR: [0.21, 0.25, 0.4], chestC: [0, -0.02, 0.12], chestR: [0.19, 0.24, 0.35],
			neckAt: [0, 0.08, 0.38], neck: [0.15, 0.14, 0.13], neckUp: 1.05, neckBend: 0.38, neckR: [0.12, 0.1, 0.085, 0.075],
			headL: 0.42, jawAt: [0, -0.045, 0.04],
			head: { skull: [[0, 0.03, 0.08], [0.085, 0.09, 0.13]], snout: [[0, 0, 0.25], [0.06, 0.062, 0.17]], jaw: [[0, -0.015, 0.17], [0.05, 0.025, 0.16]], eye: [0.075, 0.05, 0.1, 0.022], teeth: [0.042, -0.05, 0.16, 0.36, 0.028] },
			tailAt: [0, 0.06, -0.4], tail: [0.3, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2], tailLift: 0.06, tailDroop: 0.025, tailR: [0.15, 0.13, 0.11, 0.09, 0.07, 0.05, 0.035, 0.02], tailFan: 0.26,
			hind: { w: 0.15, drop: -0.02, L1: 0.4, L2: 0.44, L3: 0.26, toe: 0.12, beta: 0.5, footZ: 0.12, footY: 0.03, thigh: 0.1, R: [0.075, 0.055, 0.04, 0.03], sickle: 0.09, bare: true },
			arm: { w: 0.13, at: [-0.02, 0.28], L: [0.16, 0.15, 0.08], R: [0.04, 0.03, 0.022, 0.018], claw: 0.05, wing: 0.2 },
		},
	},
	tyrant: {
		name: 'Tyrannosaurus', pal: { back: [0.30, 0.27, 0.20], belly: [0.66, 0.60, 0.47] }, pat: [1.6, 0.35, 1], graze: [0.3, 0.3, 0.2], hunt: true,
		beh: { diet: 'meat', walk: 1.8, run: 5.5, notice: 70, react: 'watch', keep: 28, turn: 0.9, count: [1, 2] },
		o: {
			hip: 2.7, chestUp: 0.05, chestZ: 0.75, chestTilt: -0.12, pelC: [0, 0.1, -0.1], pelR: [0.55, 0.65, 0.95], chestC: [0, -0.05, 0.25], chestR: [0.58, 0.75, 0.9], bellyC: [0, -0.35, 0.1], bellyR: [0.45, 0.4, 0.8],
			neckAt: [0, 0.25, 0.8], neck: [0.36, 0.34], neckUp: 0.75, neckBend: 0.45, neckR: [0.44, 0.4, 0.36],
			headL: 1.4, jawAt: [0, -0.18, 0.1],
			head: { skull: [[0, 0.1, 0.25], [0.36, 0.4, 0.5]], snout: [[0, -0.02, 0.8], [0.3, 0.3, 0.5]], jaw: [[0, -0.06, 0.55], [0.27, 0.14, 0.55]], eye: [0.3, 0.25, 0.35, 0.06], teeth: [0.24, -0.22, 0.45, 1.15, 0.1], horns: [[[0.2, 0.34, 0.3], [0.3, 1, 0.2], 0.12, 0.07], [[-0.2, 0.34, 0.3], [-0.3, 1, 0.2], 0.12, 0.07]] },
			tailAt: [0, 0.12, -0.8], tail: [0.9, 0.85, 0.8, 0.72, 0.64, 0.55, 0.46, 0.38], tailLift: 0.06, tailDroop: 0.045, tailR: [0.52, 0.45, 0.38, 0.31, 0.24, 0.18, 0.12, 0.07, 0.03],
			hind: { w: 0.44, drop: -0.05, L1: 1.05, L2: 1.1, L3: 0.6, toe: 0.35, beta: 0.45, footZ: 0.25, footY: 0.1, thigh: 0.42, R: [0.36, 0.25, 0.17, 0.12] },
			arm: { w: 0.4, at: [-0.2, 0.55], L: [0.3, 0.25, 0.12], R: [0.08, 0.06, 0.05, 0.04], claw: 0.08 },
		},
	},
	mimic: {
		name: 'Gallimimus', coat: true, coatN: 1100, coatLen: 0.05,
		pal: { back: [0.52, 0.44, 0.33], belly: [0.9, 0.85, 0.74], coat: [0.48, 0.40, 0.30], coatTip: [0.86, 0.80, 0.70] },
		pat: [3, 0.25, 1], graze: [0.55, 0.35, 0.25, 0.2, 0.2],
		beh: { diet: 'plant', walk: 1.8, run: 11, alarm: 40, react: 'flee', turn: 2.2, herd: [5, 8] },
		o: {
			hip: 1.5, chestUp: 0.02, chestZ: 0.28, chestTilt: -0.25, pelC: [0, 0.05, -0.05], pelR: [0.24, 0.28, 0.38], chestC: [0, -0.02, 0.1], chestR: [0.22, 0.27, 0.34],
			neckAt: [0, 0.1, 0.3], neck: [0.2, 0.2, 0.2, 0.19], neckUp: 1.25, neckBend: 0.22, neckR: [0.1, 0.08, 0.065, 0.055, 0.05],
			headL: 0.3, jawAt: [0, -0.03, 0.03],
			head: { skull: [[0, 0.02, 0.05], [0.07, 0.075, 0.1]], jaw: [[0, -0.01, 0.1], [0.04, 0.02, 0.1]], eye: [0.06, 0.035, 0.06, 0.02], beak: [[0, -0.01, 0.1], [0, -0.15, 1], 0.2, 0.045] },
			tailAt: [0, 0.06, -0.36], tail: [0.3, 0.29, 0.27, 0.25, 0.23, 0.21, 0.19], tailLift: 0.02, tailDroop: 0.03, tailR: [0.13, 0.11, 0.09, 0.07, 0.055, 0.04, 0.03, 0.02],
			hind: { w: 0.16, drop: -0.02, L1: 0.5, L2: 0.62, L3: 0.42, toe: 0.14, beta: 0.35, footZ: 0.12, footY: 0.03, thigh: 0.12, R: [0.08, 0.055, 0.04, 0.03], bare: true },
			arm: { w: 0.14, at: [-0.03, 0.24], L: [0.22, 0.2, 0.12], R: [0.035, 0.028, 0.02, 0.016], claw: 0.06 },
		},
	},
	duckbill: {
		name: 'Parasaurolophus', pal: { back: [0.36, 0.40, 0.28], belly: [0.82, 0.78, 0.62], crest: [0.62, 0.32, 0.2] }, pat: [2.5, 0.4, 0], graze: [0.45, 0.35, 0.3, 0.35],
		beh: { diet: 'plant', walk: 1.3, run: 5.5, alarm: 32, react: 'flee', turn: 1.3, herd: [4, 7] },
		o: {
			hip: 2.0, chestUp: -0.1, chestZ: 0.95, chestTilt: 0.15, pelC: [0, 0.08, -0.1], pelR: [0.55, 0.62, 0.85], chestC: [0, -0.05, 0.2], chestR: [0.52, 0.58, 0.8],
			neckAt: [0, 0.2, 0.75], neck: [0.32, 0.3, 0.28], neckUp: 0.75, neckBend: 0.3, neckR: [0.3, 0.24, 0.2, 0.18], neckTall: 1.2,
			headL: 0.9, jawAt: [0, -0.1, 0.05],
			head: { skull: [[0, 0.05, 0.12], [0.18, 0.2, 0.26]], snout: [[0, -0.06, 0.45], [0.16, 0.08, 0.3]], jaw: [[0, -0.03, 0.3], [0.12, 0.06, 0.24]], eye: [0.16, 0.1, 0.14, 0.04], crest: [[0, 0.16, 0.02], [0, 0.5, -1], 1.0, 0.07] },
			tailAt: [0, 0.1, -0.85], tail: [0.6, 0.58, 0.55, 0.5, 0.45, 0.4, 0.35], tailLift: 0.1, tailDroop: 0.03, tailR: [0.4, 0.34, 0.28, 0.22, 0.16, 0.11, 0.07, 0.03], tailTall: 1.5,
			hind: { w: 0.38, drop: -0.05, L1: 0.8, L2: 0.78, L3: 0.45, toe: 0.2, beta: 0.45, footZ: 0.15, footY: 0.06, thigh: 0.3, R: [0.24, 0.16, 0.11, 0.09] },
			front: { w: 0.3, drop: -0.25, z: 0.45, L1: 0.66, L2: 0.62, L3: 0.3, toe: 0.1, beta: 0.1, footZ: 0.05, footY: 0.05, thigh: 0.14, R: [0.12, 0.09, 0.07, 0.06] },
		},
	},
	horned: {
		name: 'Triceratops', pal: { back: [0.46, 0.37, 0.27], belly: [0.80, 0.72, 0.58], frill: [0.60, 0.33, 0.2] }, pat: [2.2, 0.3, 1], graze: [0.35, 0.45],
		beh: { diet: 'plant', walk: 1.1, run: 4.5, alarm: 28, react: 'face', turn: 0.9, herd: [3, 6] },
		o: {
			hip: 1.5, chestUp: -0.02, chestZ: 0.9, chestTilt: 0.06, pelC: [0, 0.05, -0.1], pelR: [0.62, 0.58, 0.85], chestC: [0, -0.02, 0.15], chestR: [0.64, 0.62, 0.85],
			neckAt: [0, 0.05, 0.7], neck: [0.3], neckUp: 0.25, neckBend: 0, neckR: [0.42, 0.38],
			headL: 1.1, jawAt: [0, -0.18, 0.05], headTilt: 0.1,
			head: { skull: [[0, 0.05, 0.25], [0.34, 0.36, 0.5]], jaw: [[0, -0.05, 0.35], [0.26, 0.14, 0.35]], eye: [0.3, 0.18, 0.32, 0.05], beak: [[0, -0.05, 0.62], [0, -0.3, 1], 0.35, 0.15],
				horns: [[[0.17, 0.3, 0.35], [0.1, 0.6, 1], 0.75, 0.08], [[-0.17, 0.3, 0.35], [-0.1, 0.6, 1], 0.75, 0.08], [[0, 0.12, 0.62], [0, 1, 0.35], 0.22, 0.06]], frill: [[0, 0.42, -0.2], [0.8, 0.65, 0.08], -1.0] },
			tailAt: [0, 0.05, -0.72], tail: [0.36, 0.33, 0.3, 0.26, 0.22], tailLift: -0.08, tailDroop: 0.07, tailR: [0.32, 0.24, 0.17, 0.11, 0.06, 0.025], tailTall: 1.3,
			hind: { w: 0.45, drop: -0.05, L1: 0.62, L2: 0.58, L3: 0.3, toe: 0.12, beta: 0.35, footZ: 0.1, footY: 0.06, thigh: 0.3, R: [0.26, 0.2, 0.14, 0.12] },
			front: { w: 0.45, drop: -0.2, z: 0.35, L1: 0.55, L2: 0.5, L3: 0.2, toe: 0.1, beta: 0.1, footZ: 0.08, footY: 0.06, thigh: 0.22, R: [0.2, 0.16, 0.12, 0.1] },
		},
	},
	armoured: {
		name: 'Ankylosaurus', pal: { back: [0.40, 0.36, 0.28], belly: [0.72, 0.66, 0.52], stud: [0.52, 0.47, 0.37] }, pat: [3, 0.25, 1], graze: [0.2, 0.3],
		beh: { diet: 'plant', walk: 0.8, run: 2.2, alarm: 18, react: 'face', turn: 0.8, herd: [2, 4] },
		o: {
			hip: 1.1, chestUp: -0.05, chestZ: 0.9, chestTilt: 0.05, pelC: [0, 0.05, -0.1], pelR: [0.75, 0.45, 0.9], chestC: [0, -0.02, 0.15], chestR: [0.72, 0.45, 0.85], armour: true,
			neckAt: [0, 0, 0.75], neck: [0.25], neckUp: 0.1, neckBend: 0, neckR: [0.3, 0.26],
			headL: 0.5, jawAt: [0, -0.08, 0.05],
			head: { skull: [[0, 0.02, 0.15], [0.28, 0.2, 0.3]], jaw: [[0, -0.02, 0.2], [0.2, 0.08, 0.2]], eye: [0.24, 0.07, 0.2, 0.035], beak: [[0, -0.04, 0.38], [0, -0.2, 1], 0.14, 0.12],
				horns: [[[0.24, 0.1, 0], [1, 0.2, -0.6], 0.16, 0.05], [[-0.24, 0.1, 0], [-1, 0.2, -0.6], 0.16, 0.05]] },
			tailAt: [0, 0.05, -0.9], tail: [0.45, 0.45, 0.42, 0.4, 0.38, 0.35], tailLift: -0.02, tailDroop: 0.02, tailR: [0.3, 0.22, 0.16, 0.12, 0.09, 0.07, 0.06], club: [0.32, 0.2, 0.38],
			hind: { w: 0.5, drop: -0.1, L1: 0.42, L2: 0.4, L3: 0.18, toe: 0.1, beta: 0.2, footZ: 0.08, footY: 0.06, thigh: 0.24, R: [0.2, 0.16, 0.12, 0.1] },
			front: { w: 0.48, drop: -0.12, z: 0.35, L1: 0.4, L2: 0.37, L3: 0.12, toe: 0.08, beta: 0.05, footZ: 0.06, footY: 0.05, thigh: 0.2, R: [0.18, 0.14, 0.11, 0.09] },
		},
	},
	longneck: {
		name: 'Alamosaurus', pal: { back: [0.34, 0.32, 0.28], belly: [0.62, 0.57, 0.48] }, pat: [1.2, 0.4, 1], graze: [0.12, 0.1, 0.1, 0.1, 0.1, 0.1, 0.3],
		beh: { diet: 'plant', walk: 1.2, run: 2.6, alarm: 25, react: 'flee', turn: 0.45, herd: [3, 5] },
		o: {
			hip: 3.5, chestUp: 0.1, chestZ: 1.8, chestTilt: -0.04, pelC: [0, 0.1, -0.2], pelR: [0.95, 1.05, 1.3], chestC: [0, -0.05, 0.3], chestR: [1.0, 1.15, 1.4], bellyC: [0, -0.5, -0.3], bellyR: [0.85, 0.7, 1.4],
			neckAt: [0, 0.35, 1.3], neck: [0.95, 0.95, 0.95, 0.95, 0.95, 0.95], neckUp: 0.8, neckBend: 0.08, neckR: [0.6, 0.5, 0.42, 0.35, 0.29, 0.24, 0.2], neckTall: 1.25,
			headL: 0.6, jawAt: [0, -0.08, 0.05],
			head: { skull: [[0, 0.03, 0.12], [0.2, 0.2, 0.28]], snout: [[0, -0.03, 0.35], [0.15, 0.13, 0.22]], jaw: [[0, -0.02, 0.25], [0.12, 0.06, 0.2]], eye: [0.17, 0.08, 0.14, 0.04] },
			tailAt: [0, 0.15, -1.3], tail: [1.1, 1.05, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7], tailLift: 0.05, tailDroop: 0.03, tailR: [0.65, 0.55, 0.45, 0.36, 0.28, 0.2, 0.13, 0.08, 0.05, 0.02],
			hind: { w: 0.6, drop: -0.1, L1: 1.5, L2: 1.4, L3: 0.5, toe: 0.15, beta: 0.12, footZ: 0.1, footY: 0.1, thigh: 0.5, R: [0.42, 0.34, 0.3, 0.3], pad: [0.32, 0.14, 0.36], toes: 3 },
			front: { w: 0.62, drop: -0.4, z: 0.8, L1: 1.42, L2: 1.35, L3: 0.45, toe: 0.12, beta: 0.05, footZ: 0.08, footY: 0.1, thigh: 0.38, R: [0.36, 0.3, 0.26, 0.26], pad: [0.28, 0.12, 0.3], toes: 1 },
		},
	},
};
export const DINOSAUR_KINDS = Object.keys(SPECIES);

// ---------- the skin and its bones, in the shader ----------
const SKIN_HEAD = `
uniform sampler2D uBones;
attribute vec4 aSkin;
vec4 dinoRow(float b, int r) { return texelFetch(uBones, ivec2(int(b + 0.5) * 3 + r, gl_InstanceID), 0); }
vec3 dinoPt(float b, vec4 p) { return vec3(dot(dinoRow(b, 0), p), dot(dinoRow(b, 1), p), dot(dinoRow(b, 2), p)); }
vec3 dinoDir(float b, vec3 n) { return vec3(dot(dinoRow(b, 0).xyz, n), dot(dinoRow(b, 1).xyz, n), dot(dinoRow(b, 2).xyz, n)); }
`;
const SKIN_POS = 'vec3 transformed = mix(dinoPt(aSkin.x, vec4(position, 1.0)), dinoPt(aSkin.y, vec4(position, 1.0)), aSkin.z);';
function skinMaterial(mat, uniforms, withPattern) {
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uniforms);
		let vs = SKIN_HEAD + (withPattern ? 'varying vec3 vRest;\nvarying float vPat;\n' : '') + sh.vertexShader;
		vs = vs.replace('#include <begin_vertex>', SKIN_POS + (withPattern ? '\nvRest = position; vPat = aSkin.w;' : ''));
		if (vs.includes('#include <beginnormal_vertex>')) vs = vs.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(dinoDir(aSkin.x, normal), dinoDir(aSkin.y, normal), aSkin.z));');
		sh.vertexShader = vs;
		if (withPattern) {
			sh.fragmentShader = `varying vec3 vRest;
varying float vPat;
uniform vec4 uPat;
float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(dHash(i), dHash(i + vec3(1, 0, 0)), f.x), mix(dHash(i + vec3(0, 1, 0)), dHash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(dHash(i + vec3(0, 0, 1)), dHash(i + vec3(1, 0, 1)), f.x), mix(dHash(i + vec3(0, 1, 1)), dHash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
	{
		// the hide: bands or blotches over the back, fading down the flanks, and a fine grain of scales
		float nA = dNoise(vRest * uPat.x + uPat.w), nB = dNoise(vRest * uPat.x * 9.0);
		float band = smoothstep(0.3, 0.7, 0.5 + 0.5 * sin(vRest.z * uPat.x * 2.6 + nA * 4.0));
		float spot = smoothstep(0.55, 0.7, nA);
		diffuseColor.rgb *= 1.0 - vPat * uPat.y * mix(band, spot, uPat.z) - 0.1 * (nB - 0.5) * step(0.001, vPat);
	}`);
		}
	};
	mat.customProgramCacheKey = () => 'dino-skin' + (withPattern ? '-pat' : '');
	return mat;
}

// ---------- the herds ----------
export function createDinosaurs(island, shared, scene, camera, profile, opts = {}) {
	if (!isWildWorld(profile) && !opts.force) return null;
	const isPhone = !!opts.isPhone;
	const H = (x, z) => island.heightAt(x, z);
	const sea = island.sea ?? 0;
	const rnd = mulberry32((island.seed >>> 0) ^ 0xd1705a);
	const group = new THREE.Group();
	group.name = 'dinosaurs';
	scene.add(group);
	const NEAR = 58, FAR = isPhone ? 170 : 290, IK_R = 75;
	const village = island.village || { x: 1e9, z: 1e9 };

	// where an animal may stand: dry, not steep, not in the village, the fields or a cave mouth
	function ok(x, z) {
		if (Math.max(Math.abs(x), Math.abs(z)) > island.half - 40) return false;
		const h = H(x, z);
		if (h < sea + 0.9) return false;
		if (island.inWater?.(x, z)) return false;
		if (island.normalAt(x, z).y < 0.8) return false;
		if (Math.hypot(x - village.x, z - village.z) < 95) return false;
		if (island.noPlant?.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 4)) return false;
		return true;
	}
	const find = (cx, cz, r0, r1, tries, extra) => {
		for (let k = 0; k < tries; k++) {
			const a = rnd() * Math.PI * 2, d = r0 + rnd() * (r1 - r0), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
			if (ok(x, z) && (!extra || extra(x, z))) return { x, z };
		}
		return null;
	};

	// which of them live here: grazers of two or three kinds, one or two kinds of hunter
	const grazers = ['mimic', 'duckbill', 'horned', 'armoured', 'longneck'].sort(() => rnd() - 0.5).slice(0, isPhone ? 2 : 3);
	const hunters = ['raptor', 'tyrant'].filter(() => rnd() < 0.75);
	if (!hunters.length) hunters.push(rnd() < 0.5 ? 'raptor' : 'tyrant');
	if (isPhone) hunters.length = 1;
	const kinds = [...grazers, ...hunters];

	// each kind: a drawn body near and far, sharing one texture of bones
	const species = kinds.map((key) => {
		const def = SPECIES[key], slots = def.beh.diet === 'meat' ? (isPhone ? 2 : 3) : (isPhone ? 4 : 8);
		const place = new THREE.BufferGeometry();
		place.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
		place.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
		place.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
		place.setAttribute('aSkin', new THREE.Float32BufferAttribute(new Array(12).fill(0), 4));
		const uni = { uBones: { value: null }, uPat: { value: new THREE.Vector4(def.pat[0], def.pat[1], def.pat[2], rnd() * 50) } };
		const hiMat = skinMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide }), uni, true);
		const loMat = skinMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 }), uni, true);
		addLodFade(hiMat, 'uniform', [NONE_IN[0], NONE_IN[1], NEAR, NEAR + 14]);
		addLodFade(loMat, 'uniform', [NEAR, NEAR + 14, FAR - 45, FAR]);
		const depth = skinMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uni, false);
		addLodFade(depth, 'uniform', [NONE_IN[0], NONE_IN[1], NEAR, NEAR + 14]);
		const hi = new THREE.InstancedMesh(place, hiMat, slots), lo = new THREE.InstancedMesh(place, loMat, slots);
		lo.instanceMatrix = hi.instanceMatrix;
		for (let i = 0; i < slots; i++) hi.setColorAt(i, new THREE.Color(1, 1, 1));
		lo.instanceColor = hi.instanceColor;
		for (const im of [hi, lo]) { im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.userData.material175 = 'soft'; im.userData.dinosaur = key; group.add(im); }
		hi.castShadow = !isPhone;
		hi.customDepthMaterial = depth;
		return { key, def, beh: def.beh, slots, hi, lo, uni, built: false, P: null, drawn: [], tex: null, data: null, mats: null };
	});

	function build(sp) {
		const P = sp.P = planRig(sp.def.o), r = mulberry32((island.seed >>> 0) ^ sp.key.length * 7919);
		const make = (fine) => { const S = new Shape(P.rig, P.restW, fine, sp.def.pal); planShape(S, { ...sp.def, P, coatN: Math.round(sp.def.coatN * (isPhone ? 0.45 : 1)) }, P, fine, r); return S.geometry(); };
		sp.hi.geometry = make(true);
		sp.lo.geometry = make(false);
		const B = P.rig.bones.length;
		sp.data = new Float32Array(B * 3 * 4 * sp.slots);
		sp.tex = new THREE.DataTexture(sp.data, B * 3, sp.slots, THREE.RGBAFormat, THREE.FloatType);
		sp.tex.magFilter = sp.tex.minFilter = THREE.NearestFilter;
		sp.tex.needsUpdate = true;
		sp.uni.uBones.value = sp.tex;
		sp.mats = P.rig.bones.map(() => new THREE.Matrix4());
		sp.rest = P.rig.restPose();
		sp.built = true;
	}

	// ---------- the animals ----------
	const agents = [], herds = [];
	const newAgent = (sp, x, z, scale, herd) => {
		const a = {
			sp, herd, x, z, y: H(x, z), yaw: rnd() * Math.PI * 2, want: 0, speed: 0, spd: 0, s: scale,
			state: 'graze', t: rnd() * 8, gp: rnd(), ph: rnd() * 6.28, hy: 0, hp: 0, gz: 0, gzT: 0, jaw: 0, turn: 0,
			look: null, glance: { x, y: 0, z, t: 0 }, goal: null, steerT: 0, cool: 0, interest: 0, roar: 0,
			feet: null, pose: null, M: new THREE.Matrix4(), Minv: new THREE.Matrix4(), tint: new THREE.Color(), slow: 0, pitch: 0, roll: 0, near: false,
		};
		const k = 0.9 + rnd() * 0.2;
		a.tint.setRGB(k * (0.95 + rnd() * 0.1), k, k * (0.95 + rnd() * 0.1));
		agents.push(a);
		return a;
	};
	const claimed = [];
	const spaced = (x, z) => claimed.every((c) => Math.hypot(x - c.x, z - c.z) > 160);
	const spawn = island.spawn || { x: 0, z: 0 };
	for (const sp of species) {
		const B = sp.beh, R = island.half * 0.8;
		if (B.diet === 'plant') {
			for (let h = 0; h < (isPhone ? 1 : 2); h++) {
				const c = find(0, 0, 60, R, 80, (x, z) => spaced(x, z) && H(x, z) < 110);
				if (!c) continue;
				claimed.push(c);
				const herd = { sp, cx: c.x, cz: c.z, gx: c.x, gz: c.z, r: 10 + sp.def.o.hip * 5, t: 30 + rnd() * 60, members: [] };
				herds.push(herd);
				const n = B.herd[0] + Math.floor(rnd() * (B.herd[1] - B.herd[0] + 1));
				for (let i = 0; i < n; i++) {
					const p = find(c.x, c.z, 0, herd.r, 20) || c;
					// a young one or two among them
					const young = i > 1 && rnd() < 0.25;
					herd.members.push(newAgent(sp, p.x, p.z, young ? 0.55 + rnd() * 0.15 : 0.9 + rnd() * 0.2, herd));
				}
			}
		} else {
			const n = B.count[0] + Math.floor(rnd() * (B.count[1] - B.count[0] + 1));
			for (let i = 0; i < n; i++) {
				const c = find(0, 0, 80, R, 80, (x, z) => Math.hypot(x - spawn.x, z - spawn.z) > 170);
				if (c) { const a = newAgent(sp, c.x, c.z, 0.9 + rnd() * 0.2, null); a.state = 'roam'; }
			}
		}
	}
	const hunterAgents = agents.filter((a) => a.sp.beh.diet === 'meat');

	// ---------- thinking ----------
	// the free way nearest the way it wants to go
	const TRY = [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.2, -2.2, Math.PI];
	function steer(a) {
		const look = (3 + a.speed * 1.4) * a.s + a.sp.def.o.hip;
		for (const off of TRY) {
			const h = a.want + off;
			if (ok(a.x + Math.sin(h) * look, a.z + Math.cos(h) * look)) return h;
		}
		return a.yaw + Math.PI;
	}
	function think(a, dt, cam, camLow) {
		const B = a.sp.beh, hip = a.sp.def.o.hip * a.s;
		const dxp = cam.x - a.x, dzp = cam.z - a.z, dp = Math.hypot(dxp, dzp);
		a.t -= dt; a.cool -= dt;
		let spd = 0, graze = 0, look = null;
		if (B.diet === 'plant') {
			// the threat: you on foot, or a hunter close by
			let tx = 0, tz = 0, td = 1e9;
			if (camLow && dp < B.alarm) { tx = cam.x; tz = cam.z; td = dp; }
			for (const h of hunterAgents) { const d = Math.hypot(h.x - a.x, h.z - a.z); if (d < Math.min(td, 22 + hip * 4)) { tx = h.x; tz = h.z; td = d; } }
			if (td < 1e9) {
				if (B.react === 'face' && td > B.alarm * 0.3) {
					// stand and face it, head low, horns out
					a.state = 'face'; a.t = 4;
					a.want = Math.atan2(tx - a.x, tz - a.z);
					look = { x: tx, y: H(tx, tz) + 1.5, z: tz };
					graze = 0.35 + 0.25 * Math.sin(a.ph + performance.now() * 0.004);
				} else {
					a.state = 'flee'; a.t = 3 + Math.random() * 2;
					const h = a.herd, awayX = a.x - tx, awayZ = a.z - tz, l = Math.hypot(awayX, awayZ) || 1;
					let wx = awayX / l, wz = awayZ / l;
					if (h) { const cx = h.cx - a.x, cz = h.cz - a.z, cl = Math.hypot(cx, cz) || 1; wx += cx / cl * 0.3; wz += cz / cl * 0.3; }
					a.want = Math.atan2(wx, wz);
					spd = B.run * (0.8 + a.s * 0.2);
				}
			} else if (a.state === 'flee' && a.t > 0) spd = B.run * 0.7;
			else if (a.state === 'face' && a.t > 0) { look = { x: cam.x, y: cam.y, z: cam.z }; }
			else if (a.state === 'walk') {
				spd = B.walk;
				if (!a.goal || Math.hypot(a.goal.x - a.x, a.goal.z - a.z) < 1.5 + hip || a.t <= 0) { a.state = 'graze'; a.t = 6 + Math.random() * 14; }
				else a.want = Math.atan2(a.goal.x - a.x, a.goal.z - a.z);
			} else {
				// grazing: head down, now and then up to look about, then a few steps on
				if (a.state !== 'graze') { a.state = 'graze'; a.t = 4 + Math.random() * 8; }
				a.gzT -= dt;
				if (a.gzT <= 0) a.gzT = 2 + Math.random() * 6;
				graze = a.gzT > 1.4 ? 1 : 0;
				if (a.t <= 0) {
					const h = a.herd;
					a.goal = h ? find(h.gx, h.gz, 0, h.r, 8) : null;
					if (a.goal) { a.state = 'walk'; a.t = 25; } else a.t = 3;
				}
			}
			// keep a body's length from the others
			if (a.herd && spd < B.run * 0.5) for (const b of a.herd.members) {
				if (b === a) continue;
				const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), room = (a.sp.def.o.hip * 1.6 + 0.8) * Math.max(a.s, b.s);
				if (d < room && d > 1e-3) { a.x += dx / d * (room - d) * Math.min(1, dt * 2); a.z += dz / d * (room - d) * Math.min(1, dt * 2); }
			}
		} else {
			// a hunter: roams from place to place, and turns to you when you are near
			if (camLow && dp < B.notice && a.cool <= 0) {
				if (a.state !== 'stalk') { a.state = 'stalk'; a.interest = 18 + Math.random() * 14; a.roar = 1.5; }
				a.interest -= dt;
				look = { x: cam.x, y: cam.y, z: cam.z };
				const toP = Math.atan2(dxp, dzp);
				if (B.react === 'stalk') {
					// close in, then circle at a distance
					if (dp > B.keep + 5) { a.want = toP; spd = B.walk * 1.8; } else if (dp < B.keep - 3) { a.want = toP + Math.PI; spd = B.walk * 1.5; } else { a.want = toP + (a.ph > 3.14 ? 1.4 : -1.4); spd = B.walk; }
				} else {
					a.want = toP;
					spd = dp > B.keep ? B.walk * 0.8 : 0;
				}
				if (a.interest <= 0) { a.cool = 40; a.state = 'roam'; a.goal = null; }
			} else if (a.state === 'idle') {
				graze = Math.sin(a.t * 0.9) > 0.3 ? 0.7 : 0;
				if (a.t <= 0) { a.state = 'roam'; a.goal = null; }
			} else {
				a.state = 'roam';
				if (!a.goal) { a.goal = find(a.x, a.z, 50, 180, 12) || find(0, 0, 60, island.half * 0.7, 12); a.t = 90; }
				if (!a.goal || Math.hypot(a.goal.x - a.x, a.goal.z - a.z) < 3 + hip || a.t <= 0) { a.state = 'idle'; a.t = 5 + Math.random() * 9; a.goal = null; }
				else { a.want = Math.atan2(a.goal.x - a.x, a.goal.z - a.z); spd = B.walk; }
			}
		}
		a.spd = spd;
		a.gzT2 = graze;
		a.look = look;
	}
	// moving on the ground: turning, speed, stopping short of water and cliffs
	function move(a, dt) {
		const B = a.sp.beh;
		a.steerT -= dt;
		if (a.steerT <= 0) { a.head = a.spd > 0 ? steer(a) : a.want; a.steerT = 0.25; }
		const wantYaw = a.spd > 0 ? a.head : (a.state === 'face' || a.state === 'stalk' ? a.want : a.yaw);
		const dy = wrap(wantYaw - a.yaw), turn = Math.max(-B.turn * dt, Math.min(B.turn * dt, dy));
		a.yaw += turn;
		a.turn = lerp(a.turn, turn / Math.max(dt, 1e-3), Math.min(1, dt * 3));
		// turning on the spot is a shuffle; a sharp turn slows the walk
		const target = a.spd * Math.max(0.25, Math.cos(Math.min(1.5, Math.abs(dy))));
		a.speed = lerp(a.speed, target, Math.min(1, dt * (target > a.speed ? 1.6 : 2.5)));
		if (a.speed > 0.01) {
			const nx = a.x + Math.sin(a.yaw) * a.speed * dt, nz = a.z + Math.cos(a.yaw) * a.speed * dt;
			if (H(nx, nz) > sea + 0.6 && !island.inWater?.(nx, nz)) { a.x = nx; a.z = nz; } else { a.speed = 0; a.steerT = 0; a.want += Math.PI * 0.5; }
		}
		// the herd's grazing ground moves on now and then, and gathers them after a scare
		const h = a.herd;
		if (h && h.members[0] === a) {
			h.t -= dt;
			let mx = 0, mz = 0;
			for (const b of h.members) { mx += b.x; mz += b.z; }
			h.cx = mx / h.members.length; h.cz = mz / h.members.length;
			if (h.t <= 0 || h.members.some((b) => b.state === 'flee')) {
				const g = h.t <= 0 ? find(h.cx, h.cz, 30, 90, 10) : null;
				if (g) { h.gx = g.x; h.gz = g.z; } else { h.gx = h.cx; h.gz = h.cz; }
				h.t = 60 + Math.random() * 60;
			}
		}
	}

	// ---------- moving the bones ----------
	const tmpP = V3(), tmpW = V3(), eR = new THREE.Euler(0, 0, 0, 'YXZ'), qR = new THREE.Quaternion(), sR = V3();
	function pose(a, dt, t, near) {
		const sp = a.sp, P = sp.P, o = sp.def.o, rig = P.rig, B = sp.beh;
		if (!a.pose) a.pose = new Float32Array(sp.rest.length);
		const q = a.pose, nB = rig.bones.length;
		q.set(sp.rest);
		const hip = o.hip * a.s;
		// how fast: a walk, a trot, a run
		const runK = smooth(B.walk * 1.3, B.run * 0.75, a.speed);
		const stride = hip * (1.1 + 1.9 * runK) * (P.quad ? 1.2 : 1);
		const duty = lerp(0.64, 0.38, runK);
		let rate = a.speed / stride;
		// standing: finish any step in the air, and step again when a foot is left behind
		if (a.speed < 0.08 && a.feet) {
			let need = false;
			for (let i = 0; i < a.feet.length; i++) { const f = a.feet[i]; if (f.sw || Math.hypot(f.x - f.nx, f.z - f.nz) > hip * 0.28) need = true; }
			rate = need ? Math.max(rate, 0.9 / Math.sqrt(hip)) : rate;
		}
		a.gp += dt * rate;
		const bobK = Math.min(1, a.speed / Math.max(0.5, B.walk));
		// the body's place: on the ground, pitched to the slope, bobbing with the stride
		const ground = H(a.x, a.z), bl = (o.chestZ + o.pelR[2]) * a.s * 0.8;
		const fy = H(a.x + Math.sin(a.yaw) * bl, a.z + Math.cos(a.yaw) * bl), by = H(a.x - Math.sin(a.yaw) * bl, a.z - Math.cos(a.yaw) * bl);
		const pitchT = Math.max(-0.3, Math.min(0.3, -Math.atan2(fy - by, bl * 2))) + runK * (P.quad ? 0.02 : 0.1);
		a.pitch = lerp(a.pitch, pitchT, Math.min(1, dt * 4));
		const bob = (P.quad ? 0.015 : 0.03) * hip * Math.cos(a.gp * Math.PI * 4) * bobK;
		a.y = lerp(a.y, Math.min(ground, (fy + by) / 2 + 0.05 * hip) - (runK * 0.06 + (a.gz > 0.5 ? 0.02 : 0)) * hip + bob, Math.min(1, dt * 8));
		a.roll = lerp(a.roll, -a.turn * a.speed * 0.02, Math.min(1, dt * 3));
		eR.set(a.pitch, a.yaw, a.roll);
		a.M.compose(tmpP.set(a.x, a.y, a.z), qR.setFromEuler(eR), sR.setScalar(a.s));
		a.Minv.copy(a.M).invert();

		// the chest and hips rock a little with each step; breathing
		q[P.chest * 3] += Math.sin(t * 1.3 + a.ph) * 0.012;
		q[P.pel * 3 + 2] += Math.sin(a.gp * Math.PI * 2) * 0.03 * bobK;
		q[P.chest * 3 + 1] += -Math.sin(a.gp * Math.PI * 2) * 0.04 * bobK;
		// head and neck: grazing down, looking about, looking at what matters
		a.gz = lerp(a.gz, a.gzT2 || 0, Math.min(1, dt * 1.6));
		a.glance.t -= dt;
		let L = a.look;
		if (!L) {
			if (a.glance.t <= 0) {
				const g = a.yaw + (Math.random() - 0.5) * 2.4, d = 6 + Math.random() * 14;
				a.glance.x = a.x + Math.sin(g) * d; a.glance.z = a.z + Math.cos(g) * d; a.glance.y = H(a.glance.x, a.glance.z) + hip * (0.5 + Math.random());
				a.glance.t = 1.5 + Math.random() * 4;
			}
			L = a.glance;
		}
		v1.set(L.x, L.y, L.z).applyMatrix4(a.Minv).sub(P.headPos);
		const yawT = Math.max(-1.1, Math.min(1.1, Math.atan2(v1.x, v1.z))) * (v1.z > -1 ? 1 : 0.3), pitT = Math.max(-0.6, Math.min(0.5, Math.atan2(v1.y, Math.hypot(v1.x, v1.z))));
		a.hy = lerp(a.hy, yawT * (1 - a.gz * 0.6), Math.min(1, dt * 2.5));
		a.hp = lerp(a.hp, pitT * (1 - a.gz), Math.min(1, dt * 2.5));
		const nN = P.neck.length, gr = sp.def.graze, bass = shared.uBass?.value || 0;
		for (let i = 0; i < nN; i++) {
			const b = P.neck[i] * 3;
			q[b] += (gr[i] || 0) * a.gz - a.hp * 0.45 / nN + Math.sin(a.gp * Math.PI * 4 + i * 0.6) * 0.025 * bobK + bass * 0.05 * (1 - bobK) / nN;
			q[b + 1] += a.hy * 0.6 / nN;
		}
		q[P.head * 3] += (gr[nN] || 0.2) * a.gz - a.hp * 0.55;
		q[P.head * 3 + 1] += a.hy * 0.4;
		// the jaw: chewing while grazing, open to call, a hunter's roar when it first sees you
		a.roar = Math.max(0, a.roar - dt);
		const jawT = (a.gz > 0.6 ? 0.06 + 0.06 * Math.sin(t * 7 + a.ph) : 0.02) + (a.roar > 0 ? Math.sin(Math.min(1, a.roar) * Math.PI) * 0.55 : 0) + (a.state === 'flee' ? 0.12 : 0);
		a.jaw = lerp(a.jaw, jawT, Math.min(1, dt * 8));
		q[P.jaw * 3] += a.jaw;
		// the tail: a slow sway along its length, swung out against a turn, lifted when running
		const nT = P.tail.length;
		for (let i = 0; i < nT; i++) {
			const b = P.tail[i] * 3, k = (i + 1) / nT;
			q[b + 1] += Math.sin(t * (0.9 + runK) + a.ph - i * 0.55) * (0.04 + 0.05 * k) * (1 - runK * 0.5) + a.turn * 0.12 * k + Math.sin(a.gp * Math.PI * 2 - i * 0.4) * 0.03 * bobK;
			q[b] += -runK * 0.03 + Math.sin(a.gp * Math.PI * 4 - i * 0.5) * 0.012 * bobK;
		}
		// arms
		for (const [s, f] of P.arms) { q[s * 3] += Math.sin(a.gp * Math.PI * 2 + a.ph) * 0.12 * bobK; q[f * 3] += Math.sin(t * 0.7 + a.ph) * 0.05; }

		// the legs
		const offs = P.quad && runK > 0.5 ? P.trot : null;
		if (near) {
			rig.fk(q, sp.mats, Math.max(P.pel, P.chest) + 1);
			if (!a.feet) {
				a.feet = P.legs.map((Lg) => { tmpW.copy(Lg.neutral).applyMatrix4(a.M); return { x: tmpW.x, y: H(tmpW.x, tmpW.z), z: tmpW.z, sw: false, lx: 0, ly: 0, lz: 0, nx: tmpW.x, nz: tmpW.z, cx: 0, cy: 0, cz: 0 }; });
			}
			const T = rate > 1e-4 ? 1 / rate : 1;
			const vx = Math.sin(a.yaw) * a.speed, vz = Math.cos(a.yaw) * a.speed;
			P.legs.forEach((Lg, li) => {
				const f = a.feet[li], ph = frac(a.gp + (offs ? offs[li] : Lg.phase));
				tmpW.copy(Lg.neutral).applyMatrix4(a.M);
				f.nx = tmpW.x; f.nz = tmpW.z;
				const footY = Lg.cfg.footY * a.s;
				let wx, wy, wz;
				if (ph < duty) {
					if (f.sw) { f.sw = false; f.x = f.tx; f.z = f.tz; f.y = H(f.x, f.z); }
					wx = f.x; wy = f.y + footY; wz = f.z;
				} else {
					const s = (ph - duty) / (1 - duty);
					if (!f.sw) { f.sw = true; f.lx = f.x; f.ly = f.y; f.lz = f.z; }
					f.tx = f.nx + vx * duty * T * 0.5; f.tz = f.nz + vz * duty * T * 0.5;
					const e = s * s * (3 - 2 * s);
					wx = lerp(f.lx, f.tx, e); wz = lerp(f.lz, f.tz, e);
					wy = lerp(f.ly, H(f.tx, f.tz), e) + footY + Math.sin(s * Math.PI) * hip * (0.07 + 0.1 * runK);
				}
				tmpW.set(wx, wy, wz).applyMatrix4(a.Minv);
				legIK(Lg, q, sp.mats, tmpW, rig);
			});
		} else {
			a.feet = null;
			// far off: a plain swing of the legs is enough
			const amp = 0.3 + 0.35 * runK;
			P.legs.forEach((Lg, li) => {
				const s = Math.sin((a.gp + (offs ? offs[li] : Lg.phase)) * Math.PI * 2) * bobK, [u, l, m] = Lg.b;
				q[u * 3] += s * amp * Lg.s; q[l * 3] += Math.max(0, -s) * 0.5 * Lg.s; q[m * 3] -= Math.max(0, -s) * 0.3 * Lg.s;
			});
		}
		rig.fk(q, sp.mats);
		return nB;
	}
	// write an animal's bones into its row of the texture
	function upload(sp, a, row) {
		const B = sp.P.rig.bones.length, d = sp.data, inv = sp.P.inv;
		let o = row * B * 12;
		for (let i = 0; i < B; i++) {
			m2.multiplyMatrices(sp.mats[i], inv[i]);
			const e = m2.elements;
			d[o] = e[0]; d[o + 1] = e[4]; d[o + 2] = e[8]; d[o + 3] = e[12];
			d[o + 4] = e[1]; d[o + 5] = e[5]; d[o + 6] = e[9]; d[o + 7] = e[13];
			d[o + 8] = e[2]; d[o + 9] = e[6]; d[o + 10] = e[10]; d[o + 11] = e[14];
			o += 12;
		}
	}

	// ---------- each frame ----------
	let sortT = 0, farT = 0, calm = false;
	const cam = V3();
	function update(dt, t) {
		dt = Math.min(dt, 0.05);
		cam.copy(camera.position);
		const camLow = !calm && cam.y - H(cam.x, cam.z) < 25;
		// the bodies are made one kind a frame, the nearest kind first
		const pending = species.filter((s) => !s.built);
		if (pending.length) {
			let best = null, bd = 1e9;
			for (const s of pending) for (const a of agents) if (a.sp === s) { const d = Math.hypot(a.x - cam.x, a.z - cam.z); if (d < bd) { bd = d; best = s; } }
			build(best || pending[0]);
		}
		// who is drawn: the nearest few of each kind, within sight
		sortT -= dt;
		if (sortT <= 0) {
			sortT = 0.3;
			for (const a of agents) a.d = Math.hypot(a.x - cam.x, a.z - cam.z);
			for (const sp of species) {
				const list = agents.filter((a) => a.sp === sp && a.d < FAR + 10).sort((p, q) => p.d - q.d).slice(0, sp.slots);
				sp.drawn = list;
				list.forEach((a, i) => sp.hi.setColorAt(i, a.tint));
				if (sp.hi.instanceColor) sp.hi.instanceColor.needsUpdate = true;
			}
		}
		// the ones in sight live every frame; the rest a couple of times a second
		farT += dt;
		const slowTick = farT > 0.5;
		for (const a of agents) {
			const shown = a.sp.drawn.includes(a);
			if (shown) { think(a, dt, cam, camLow); move(a, dt); } else if (slowTick) { think(a, farT, cam, camLow); move(a, farT); a.y = H(a.x, a.z); }
		}
		if (slowTick) farT = 0;
		for (const sp of species) {
			if (!sp.built) continue;
			sp.drawn.forEach((a, i) => {
				const near = Math.hypot(a.x - cam.x, a.z - cam.z) < IK_R;
				pose(a, dt, t, near);
				upload(sp, a, i);
				sp.hi.setMatrixAt(i, a.M);
			});
			sp.hi.count = sp.lo.count = sp.drawn.length;
			sp.hi.instanceMatrix.needsUpdate = true;
			sp.hi.boundingSphere = sp.lo.boundingSphere = null;
			sp.tex.needsUpdate = true;
		}
	}

	function dispose() {
		scene.remove(group);
		for (const sp of species) {
			sp.hi.geometry.dispose(); sp.lo.geometry.dispose(); sp.tex?.dispose();
			sp.hi.material.dispose(); sp.lo.material.dispose(); sp.hi.customDepthMaterial.dispose();
		}
	}

	return {
		update, dispose, group, agents, herds,
		kinds: () => species.map((s) => ({ key: s.key, name: s.def.name, count: agents.filter((a) => a.sp === s).length, drawn: s.drawn.length, built: s.built })),
		pickables: species.flatMap((s) => [s.hi, s.lo]),
		// the nearest of a kind (or of any), for looking at them
		nearest(key, from = camera.position) {
			let best = null, bd = 1e9;
			for (const a of agents) if (!key || a.sp.key === key) { const d = Math.hypot(a.x - from.x, a.z - from.z); if (d < bd) { bd = d; best = a; } }
			return best && { key: best.sp.key, name: best.sp.def.name, x: best.x, y: best.y, z: best.z, yaw: best.yaw, d: bd, state: best.state, hip: best.sp.def.o.hip * best.s };
		},
		// let them ignore you (for looking at them)
		calm: (on = true) => { calm = !!on; },
		// build every body now (for looking at them in tests)
		buildAll: () => { for (const s of species) if (!s.built) build(s); return species.length; },
		stats: () => ({ agents: agents.length, herds: herds.length, drawn: species.reduce((n, s) => n + s.drawn.length, 0), drawCalls: species.reduce((n, s) => n + (s.drawn.length ? 2 : 0), 0), verts: species.map((s) => s.built ? [s.key, s.hi.geometry.attributes.position.count, s.lo.geometry.attributes.position.count] : [s.key, 0, 0]) }),
	};
}
