// The room seen through a scope: which building's window is under the reticle, which of its
// rooms is behind that window, and whether a shot at that point goes on into the room. Pure
// geometry over the city's lots (bay/city.js lotsNear) and an interior's plan (plan.js), kept
// apart from interiors/index.js, which builds the room, and city.js, whose glass clears onto it.
//
import * as THREE from 'three';

// the one room seen through a scope (interiors/index.js), for the city's glass (city.js
// buildingMaterial): a: its building's drawn centre (x, z), on, the face looked at; b: the span
// along that face and the height band (metres from the block's foot) whose glass clears onto
// the room built behind it, at any distance; k: how clear it is now (0..1, eased in)
export const SCOPE_ROOM = { a: { value: new THREE.Vector4(0, 0, 0, 0) }, b: { value: new THREE.Vector4(0, 0, 0, 0) }, k: { value: 0 } };

// A lot's frame: x across it, z toward its front (+z), y up from its foot (o.y); faces 0 front
// (+z), 1 back (-z), 2 the +x side, 3 the -x side.

// the box a lot is drawn as (city.js draws it at its fitted size where it overlapped a neighbour)
export function drawnBox(o) {
	const F = o.fit;
	return F ? { x: F[0], z: F[1], w: F[2], d: F[3] } : { x: o.x, z: o.z, w: o.w, d: o.d };
}

// where the ray from e along the unit d first meets a lot's walls: { t, face, lx, ly, lz } in the
// lot's own frame (lx, lz from its drawn centre), or null (missed, or met on its roof)
export function rayLot(o, e, d, max = Infinity) {
	const b = drawnBox(o), ca = Math.cos(o.a), sa = Math.sin(o.a);
	const px = e.x - b.x, pz = e.z - b.z;
	const lo = [ca * px + sa * pz, e.y - (o.y + o.h / 2), -sa * px + ca * pz];
	const ld = [ca * d.x + sa * d.z, d.y, -sa * d.x + ca * d.z];
	const h = [b.w / 2, o.h / 2, b.d / 2];
	let t0 = -Infinity, t1 = Infinity, axis = -1;
	for (let i = 0; i < 3; i++) {
		if (Math.abs(ld[i]) < 1e-9) { if (Math.abs(lo[i]) > h[i]) return null; continue; }
		let a = (-h[i] - lo[i]) / ld[i], c = (h[i] - lo[i]) / ld[i];
		if (a > c) { const k = a; a = c; c = k; }
		if (a > t0) { t0 = a; axis = i; }
		if (c < t1) t1 = c;
		if (t0 > t1) return null;
	}
	// (from outside only: a ray begun inside it is no look through its window)
	if (t0 < 0 || t0 > max || axis === 1 || axis < 0) return null;
	const face = axis === 2 ? (ld[2] < 0 ? 0 : 1) : (ld[0] < 0 ? 2 : 3);
	return { t: t0, exit: t1, face, lx: lo[0] + ld[0] * t0, ly: lo[1] + ld[1] * t0 + o.h / 2, lz: lo[2] + ld[2] * t0 };
}

// the first lot the ray meets within R, and nothing of the ground in front of it:
// { o, t, exit, face, lx, ly, lz } or null. lotsNear(x, z, r) as city.js's; heightAt(x, z) the ground
export function aimedLot(lotsNear, e, d, R, heightAt = null, step = 20) {
	const seen = new Set();
	let best = null;
	for (let s = 0; s <= R + step; s += step) {
		const k = Math.min(s, R);
		for (const o of lotsNear(e.x + d.x * k, e.z + d.z * k, step + 4)) {
			if (seen.has(o)) continue;
			seen.add(o);
			if (!(o.h > 2) || !o.w || !o.d || o.wrecked) continue;
			const h = rayLot(o, e, d, best ? best.t : R);
			if (h && (!best || h.t < best.t)) best = { o, ...h };
		}
		if (best && best.t < s - step - 4) break;
	}
	if (!best || !heightAt) return best;
	// (a hill between you and it: no window seen)
	for (let t = 6; t < best.t - 2; t += 8) if (heightAt(e.x + d.x * t, e.z + d.z * t) > e.y + d.y * t) return null;
	return best;
}

// along a face, the room of level k behind the point at u (metres across the face, in the plan's
// frame): the one whose span holds u and lies nearest that face, else the nearest along it.
// { room, u0, u1 } or null
export function roomBehind(rooms, k, face, u) {
	const front = face < 2;
	let best = null, bs = Infinity;
	for (const r of rooms) {
		if (r.k !== k) continue;
		const a = front ? r.x0 : r.z0, b = front ? r.x1 : r.z1;
		const off = u < a ? a - u : u > b ? u - b : 0;
		// (how far in from the face: the front room before the one behind it)
		const deep = face === 0 ? -r.z1 : face === 1 ? r.z0 : face === 2 ? -r.x1 : r.x0;
		const s = off * 1000 + deep;
		if (s < bs) { bs = s; best = { room: r, u0: a, u1: b }; }
	}
	return best && bs < 1500 ? best : null;
}

// a shot from e along d that meets the box of lot o at t: on into the room if it meets the
// window band of the room opened in o (open: { o, face, u0, u1, y0, y1 } in the drawn box's
// frame, as given to city.js); the far side of the box then (where it stops if nothing within
// stops it first), else -1
export function seeInto(open, o, e, d) {
	if (!open || !o) return -1;
	const A = open.o;
	if (A !== o && A.src !== o && Math.hypot(A.x - o.x, A.z - o.z) > 0.6) return -1;
	const h = rayLot(A, e, d);
	if (!h || h.face !== open.face) return -1;
	const u = h.face < 2 ? h.lx : h.lz;
	if (u < open.u0 - 0.1 || u > open.u1 + 0.1 || h.ly < open.y0 - 0.1 || h.ly > open.y1 + 0.1) return -1;
	return h.exit;
}
