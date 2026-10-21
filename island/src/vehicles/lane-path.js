// The way a car drives off from the kerb, or comes back to it: along the street it is parked on,
// in its lane (right of the middle, as the traffic keeps: bay/streetlife.js), and on round the
// corner into the next street where this one ends, never straight on through whatever stands at
// the end of the block. Pure: the roads are handed in, near(x, z, r) -> [{ pts: [x, z, ...], w,
// drive, cls }] (world.real's).

const NOT_DRIVEN = /footway|path|steps|cycleway|pedestrian|track/;
const driven = (r) => r?.pts?.length >= 4 && r.drive !== false && !NOT_DRIVEN.test(r.cls || '');

// the street under a car at (x, z) heading (fx, fz): the road nearest it that runs the way it
// faces, where it stands along it and which way along it is forward; null where there is none
export function streetUnder(near, x, z, fx, fz, reach = 22) {
	let best = null;
	for (const r of near(x, z, reach) || []) {
		if (!driven(r)) continue;
		const P = r.pts;
		for (let i = 0; i + 3 < P.length; i += 2) {
			const ax = P[i], az = P[i + 1], bx = P[i + 2], bz = P[i + 3], L = Math.hypot(bx - ax, bz - az);
			if (L < 0.1) continue;
			const ux = (bx - ax) / L, uz = (bz - az) / L, dot = ux * fx + uz * fz;
			if (Math.abs(dot) < 0.55) continue;
			const t = Math.max(0, Math.min(L, (x - ax) * ux + (z - az) * uz)), px = ax + ux * t, pz = az + uz * t, d = Math.hypot(x - px, z - pz);
			if (d > reach || (best && d >= best.d)) continue;
			best = { r, i, t, L, d, dir: dot > 0 ? 1 : -1, x: px, z: pz };
		}
	}
	return best;
}

// the middle of the street from where a car stands, len metres on the way it faces: [x, z, ...]
// (on into the next street at a corner; the street's end where it goes nowhere)
export function streetLine(near, x, z, fx, fz, len) {
	const at = streetUnder(near, x, z, fx, fz);
	if (!at) return null;
	const out = [at.x, at.z];
	let r = at.r, dir = at.dir, k = dir > 0 ? at.i + 2 : at.i, run = 0, hx = fx, hz = fz;
	const used = new Set([r]);
	for (let guard = 0; guard < 400 && run < len; guard++) {
		const P = r.pts;
		if (k >= 0 && k + 1 < P.length) {
			const lx = out[out.length - 2], lz = out[out.length - 1], d = Math.hypot(P[k] - lx, P[k + 1] - lz);
			if (d > 0.05) { hx = (P[k] - lx) / d; hz = (P[k + 1] - lz) / d; out.push(P[k], P[k + 1]); run += d; }
			k += 2 * dir;
			continue;
		}
		// the end of this street: on into the one that goes on most nearly straight
		const ex = out[out.length - 2], ez = out[out.length - 1];
		let next = null;
		for (const q of near(ex, ez, 6) || []) {
			if (used.has(q) || !driven(q)) continue;
			const Q = q.pts;
			for (let j = 0; j + 1 < Q.length; j += 2) {
				if (Math.hypot(Q[j] - ex, Q[j + 1] - ez) > 3) continue;
				for (const dj of [1, -1]) {
					const m = j + 2 * dj;
					if (m < 0 || m + 1 >= Q.length) continue;
					const dx = Q[m] - Q[j], dz = Q[m + 1] - Q[j + 1], l = Math.hypot(dx, dz) || 1, turn = (dx * hx + dz * hz) / l;
					// (no turning back the way it came, and no hairpin)
					if (turn < -0.3) continue;
					if (!next || turn > next.turn) next = { q, k: m, dir: dj, turn };
				}
			}
		}
		if (!next) break;
		r = next.q; dir = next.dir; k = next.k; used.add(r);
	}
	return out.length >= 4 ? { pts: out, w: at.r.w || 7 } : null;
}

// a line [x, z, ...] moved off to the right of the way it runs by off metres (each corner by the
// mean of its two sides' directions)
export function rightOf(pts, off) {
	const n = pts.length / 2, out = new Array(pts.length);
	for (let i = 0; i < n; i++) {
		const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
		let dx = pts[b * 2] - pts[a * 2], dz = pts[b * 2 + 1] - pts[a * 2 + 1];
		const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
		// (right of a heading (dx, dz) is (-dz, dx): bay/streetlife.js lanes)
		out[i * 2] = pts[i * 2] - dz * off; out[i * 2 + 1] = pts[i * 2 + 1] + dx * off;
	}
	return out;
}
// how far off the middle a lane runs on a street of width w (bay/streetlife.js's)
export const laneOff = (w) => Math.min(1.8, (w || 7) / 2 * 0.4);

// the lane a car leaving its space drives along (from beside it, on ahead), and the one a car
// coming to it drives in by (from len metres back up the street, to beside the space)
export function laneAway(near, x, z, fx, fz, len = 400) {
	const S = streetLine(near, x, z, fx, fz, len);
	return S ? rightOf(S.pts, laneOff(S.w)) : null;
}
export function laneIn(near, x, z, fx, fz, len = 110) {
	const S = streetLine(near, x, z, -fx, -fz, len);
	if (!S) return null;
	const back = [];
	for (let i = S.pts.length - 2; i >= 0; i -= 2) back.push(S.pts[i], S.pts[i + 1]);
	return rightOf(back, laneOff(S.w));
}
