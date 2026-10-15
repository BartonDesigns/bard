// How a crew lays out its site, worked out once when the site is first seen, in plain numbers
// (no scene): where the kerb is and which way the traffic runs past it (the nearest drivable
// road's own line and width, when the surveyed roads are loaded, else a pavement's width out
// from the front), the fence line (keeping a pavement for people where there is room, taking it
// where there is not), how far the fence can return down the sides before a neighbour, which
// faces can take scaffolding, where the gate goes, where the tower crane can stand, and where
// each thing on site can go without standing in a neighbour, the road, the scaffold, the gate or
// the walk along the scaffold, or on another thing. Then the trucks' places along the kerb,
// the way they drive in (in the lane, pulling in to the kerb, or past and backing in) and out,
// and the cranes' lifting cycles.
//
// The site's own coordinates: u along the front (left to right seen from the street), v out
// from the front face toward the street; the building is v < 0, |u| < L/2.

import { frameOf, onFace, FACES, faceLen } from './ids.js';

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- the frame ----------
export function siteFrame(o, f, ground = () => 0) {
	const F = frameOf(o), [fx, fz] = onFace(o, f, 0), [nx, nz] = FACES[f], L = faceLen(o, f), D = f < 2 ? o.d : o.w;
	const [wnx, wnz] = F.dir(nx, nz), [wtx, wtz] = F.dir(nz, -nx);
	const w = (u, v) => F.w(fx + nx * v + nz * u, fz + nz * v - nx * u);
	return {
		F, f, L, D, H: o.h - 1.2, foot: o.y + 1.2, yawF: Math.atan2(wnx, wnz), n: [wnx, wnz], t: [wtx, wtz],
		w,
		at: (u, v) => { const [x, z] = w(u, v); return [x, ground(x, z), z]; },
		uv: (x, z) => { const [lx, lz] = F.l(x, z), dx = lx - fx, dz = lz - fz; return [dx * nz - dz * nx, dx * nx + dz * nz]; },
		// (the same into a list of one's own, for the frame)
		atTo: (u, v, out) => { const lx = fx + nx * v + nz * u, lz = fz + nz * v - nx * u, x = o.x + F.c * lx - F.s * lz, z = o.z + F.s * lx + F.c * lz; out[0] = x; out[1] = ground(x, z); out[2] = z; return out; },
		uvTo: (x, z, out) => { const ex = x - o.x, ez = z - o.z, dx = F.c * ex + F.s * ez - fx, dz = -F.s * ex + F.c * ez - fz; out[0] = dx * nz - dz * nx; out[1] = dx * nx + dz * nz; return out; },
	};
}

// ---------- the kerb ----------
// roads: [{ pts: [x0, z0, x1, z1, ...], w, drive, cls }]. Returns the kerb's distance out from the
// front (kerbV), the road's half width, its line through the site (a polyline walked by s from
// the point opposite the front's middle), the way the near lane runs (kerb on its right) and
// whether it came from a real road
// gap: how far out from the front the buildings across the street stand (a gridded town with no
// surveyed roads: the street is taken to run down the middle of the gap, pavements either side)
export function findKerb(G, roads = [], gap = 0) {
	const [cx, cz] = G.w(0, 0);
	let best = null;
	for (const r of roads) {
		if (!r || r.drive === false || r.cls === 'service' || !r.pts || r.pts.length < 4) continue;
		const p = r.pts;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz;
			if (l2 < 1e-6) continue;
			const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / l2)), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(qx - cx, qz - cz);
			// (it must lie out in front, not behind the building or off past a side)
			const [, v] = G.uv(qx, qz);
			if (v < 1 || (best && d >= best.d)) continue;
			best = { r, i, t, d, qx, qz };
		}
	}
	if (best) {
		const hw = (best.r.w || 7) / 2, kerbV = best.d - hw;
		if (kerbV > 1.2 && kerbV < 24) {
			const p = best.r.pts, i = best.i, l = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), tx = (p[i + 2] - p[i]) / l, tz = (p[i + 3] - p[i + 1]) / l;
			// (toward the building from the road's middle; the near lane runs with the kerb on its right)
			const bx = (G.w(0, 0)[0] - best.qx) / best.d, bz = (G.w(0, 0)[1] - best.qz) / best.d;
			const dir = -tz * bx + tx * bz > 0 ? 1 : -1;
			return { real: true, kerbV, hw, pts: p, seg: i, segT: best.t, dir, b: [bx, bz], lane: Math.max(0.6, hw - 3.9) };
		}
	}
	// (no road known: the middle of the gap to the buildings across, else a pavement's width out
	// from the front, the road straight along it)
	const mid = gap >= 12 && gap <= 70 ? gap / 2 : 0, hw = mid ? Math.max(3, Math.min(7, mid - 3.2)) : 4.5, kerbV = mid ? mid - hw : 6;
	const [x0, z0] = G.w(-200, kerbV + hw), [x1, z1] = G.w(200, kerbV + hw);
	const tx = G.t[0], tz = G.t[1], bx = -G.n[0], bz = -G.n[1];
	return { real: false, kerbV, hw, pts: [x0, z0, x1, z1], seg: 0, segT: 0.5, dir: -tz * bx + tx * bz > 0 ? 1 : -1, b: [bx, bz], lane: Math.max(0.6, hw - 3.9) };
}
// a point along the kerb's road: s along the near lane's way from the point opposite the site,
// lat out from the road's middle toward the building. out: [x, z, tx, tz] (tx, tz its way)
export function roadAt(K, s, lat, out = [0, 0, 0, 0]) {
	const p = K.pts, n = p.length / 2 - 1;
	// (from the foot of the site's point on its segment, walked along the polyline either way,
	// carried straight on past either end)
	let i = K.seg / 2, q = K.segT * Math.hypot(p[K.seg + 2] - p[K.seg], p[K.seg + 3] - p[K.seg + 1]) + s * K.dir;
	for (let guard = 0; guard < 256; guard++) {
		const l = Math.hypot(p[i * 2 + 2] - p[i * 2], p[i * 2 + 3] - p[i * 2 + 1]) || 1;
		if (q > l && i < n - 1) { q -= l; i++; continue; }
		if (q < 0 && i > 0) { i--; q += Math.hypot(p[i * 2 + 2] - p[i * 2], p[i * 2 + 3] - p[i * 2 + 1]) || 1; continue; }
		const ax = p[i * 2], az = p[i * 2 + 1], tx = (p[i * 2 + 2] - ax) / l, tz = (p[i * 2 + 3] - az) / l;
		const hx = tx * K.dir, hz = tz * K.dir;
		out[0] = ax + tx * q - hz * lat; out[1] = az + tz * q + hx * lat; out[2] = hx; out[3] = hz;
		return out;
	}
	return out;
}

// ---------- the plan ----------
// o: the lot; G its frame; K the kerb; blocked(x, z, pad): whether a neighbour or a landmark stands
// there; opts: { tower, glassOnly, lite }
export function planSite(o, G, K, blocked = () => false, opts = {}) {
	const L = G.L, D = G.D, H = G.H;
	const free = (u, v, pad = 0.15) => { const [x, z] = G.w(u, v); return !blocked(x, z, pad); };
	// the fence: a pavement kept where there is room for one, else up to the kerb
	const kv = K.kerbV;
	let fenceV = kv >= 4.1 ? Math.min(5.6, Math.max(2.3, kv - 1.8)) : Math.max(1.75, kv - 0.4);
	// how far the fence can return down each side before a neighbour
	const gap = (sd) => { let g = 0; for (let x = 0.4; x <= 7; x += 0.3) { let ok = true; for (let v = -Math.min(D, 6); v <= fenceV + 0.3; v += 0.8) if (!free(sd * (L / 2 + x), v, 0.1)) { ok = false; break; } if (!ok) break; g = x; } return g; };
	const gL = gap(-1), gR = gap(1);
	const sideScaf = [gL >= 2.3, gR >= 2.3];
	// a tower crane stands in a side yard if one is wide enough (that side goes without scaffolding;
	// the mast is tied to it instead)
	const craneSide = opts.tower ? (Math.max(gL, gR) >= 5.75 ? (gR > gL ? 1 : -1) : 0) : 0;
	if (craneSide) sideScaf[craneSide > 0 ? 1 : 0] = false;
	const sideX = [sideScaf[0] ? Math.min(6, gL - 0.35) : Math.max(0, Math.min(1.2, gL - 0.3)), sideScaf[1] ? Math.min(6, gR - 0.35) : Math.max(0, Math.min(1.2, gR - 0.3))];
	if (craneSide) sideX[craneSide > 0 ? 1 : 0] = Math.min(6.2, (craneSide > 0 ? gR : gL) - 0.3);
	const uL = -(L / 2 + sideX[0]), uR = L / 2 + sideX[1];
	const vBack = [sideX[0] >= 1.9 ? -Math.min(D, 7) : 0, sideX[1] >= 1.9 ? -Math.min(D, 7) : 0];
	// faces with room for scaffolding (the front always, the back if clear)
	const faceFree = (f) => {
		if (f === 0) return true;
		if (f === 2 || f === 3) return f === 2 ? sideScaf[1] : sideScaf[0];
		for (let u = -L / 2 - 1.4; u <= L / 2 + 1.4; u += 1.2) if (!free(u, -D - 1.7, 0.1)) return false;
		return true;
	};
	// (faces in the frame's order: 0 front, 1 back, 2 right, 3 left, seen from the street)
	const faces = [faceFree(0), faceFree(1), faceFree(2), faceFree(3)];
	if (opts.glassOnly) faces.fill(false);
	// the gate: in the middle, the walk along the scaffold behind the fence
	const gateU = Math.max(uL + 2.4, Math.min(uR - 2.4, 0));
	const keep = [];
	const scafV = faces[0] ? 1.55 : 0.2;
	keep.push([-L / 2 - (faces[3] ? 1.6 : 0.3), L / 2 + (faces[2] ? 1.6 : 0.3), -D - 0.2, scafV + 0.65]);
	if (faces[3]) keep.push([-L / 2 - 1.6, -L / 2 + 0.1, -D - 1.7, scafV]);
	if (faces[2]) keep.push([L / 2 - 0.1, L / 2 + 1.6, -D - 1.7, scafV]);
	keep.push([gateU - 2.0, gateU + 2.0, scafV, fenceV + 0.1]);
	const placed = [];
	// a spot for something w along by d out: the first that fits, nearest the wish
	const zones = [[uL + 0.25, uR - 0.25, vBack[0] < 0 || vBack[1] < 0 ? Math.min(vBack[0], vBack[1]) + 0.25 : 0.2, fenceV - 0.3]];
	function spot(w0, d0, wish = [0, fenceV], who = '', pad = 0.25, turn = true) {
		let best = null, bd = 1e9;
		for (const [w, d, turned] of turn && w0 !== d0 ? [[w0, d0, false], [d0, w0, true]] : [[w0, d0, false]]) for (const [u0, u1, v0, v1] of zones) {
			for (let u = u0 + w / 2; u <= u1 - w / 2 + 1e-6; u += 0.5) for (let v = v0 + d / 2; v <= v1 - d / 2 + 1e-6; v += 0.5) {
				const r = [u - w / 2 - pad, u + w / 2 + pad, v - d / 2 - pad, v + d / 2 + pad];
				const hit = (q) => r[0] < q[1] && r[1] > q[0] && r[2] < q[3] && r[3] > q[2];
				if (keep.some(hit) || placed.some((p) => hit(p.r))) continue;
				// (not past a side where the fence does not go back)
				if (v < 0 && ((u < 0 && (vBack[0] >= 0 || u > -L / 2)) || (u >= 0 && (vBack[1] >= 0 || u < L / 2)))) continue;
				if (!free(u - w / 2, v - d / 2) || !free(u + w / 2, v - d / 2) || !free(u - w / 2, v + d / 2) || !free(u + w / 2, v + d / 2) || !free(u, v)) continue;
				const dd = Math.hypot(u - wish[0], v - wish[1]) + (turned ? 0.5 : 0);
				if (dd < bd) { bd = dd; best = { u, v, w, d, who, turned, r: [u - w / 2, u + w / 2, v - d / 2, v + d / 2] }; }
			}
		}
		if (best) placed.push(best);
		return best;
	}
	// the tower crane: in a side yard, else in the front strip, else inside the footprint at the back
	let crane = null;
	if (craneSide) {
		const u = craneSide * (L / 2 + 2.75), v = Math.max(-Math.min(D, 7) + 2.8, Math.min(fenceV - 2.9, -1.5));
		crane = { u, v, inside: false, side: craneSide };
		placed.push({ u, v, w: 5.4, d: 5.4, who: 'crane', r: [u - 2.7, u + 2.7, v - 2.7, v + 2.7] });
	} else if (opts.tower) {
		const c = spot(5.4, 5.4, [0, fenceV], 'crane', 0.1, false);
		if (c) crane = { u: c.u, v: c.v, inside: false };
		else crane = { u: -L * 0.15, v: -D * 0.55, inside: true };
	}
	// the things that stay all through: the office, the toilet, a light tower or two
	// (the light towers first, out in front of the facade where they can light it)
	const lights = [];
	if (!opts.glassOnly) for (let k = 0; k < (opts.lite || L < 18 ? 1 : 2); k++) { const s = spot(1.6, 2.7, [(k ? 1 : -1) * L / 3, fenceV - 1], 'light', 0.1); if (s) lights.push(s); }
	const fixed = {
		cabin: opts.glassOnly ? null : spot(6.0, 3.3, [uL, fenceV], 'cabin', 0.1),
		loo: opts.glassOnly ? null : spot(1.3, 1.3, [uL + 1, fenceV], 'loo'),
		lights,
	};
	const base = placed.length;
	// what each stage brings, placed on what stays (the same every time for the same stage)
	const stages = [];
	const WANT = [
		[['box', 2.6, 6.0], ['barrow', 0.8, 1.6], ['generator', 1.0, 1.6]],
		[['bars', 1.4, 5.6], ['lumber', 1.2, 3.8], ['boards', 1.1, 4.0], ['cement', 1.3, 1.1], ['barrow', 0.8, 1.6]],
		[['blocks', 1.3, 1.1], ['blocks', 1.3, 1.1], ['blocks', 1.3, 1.1], ['cement', 1.3, 1.1], ['sand', 2.8, 2.4], ['barrow', 0.8, 1.6], ['boards', 1.1, 4.0]],
		[['glass', 1.5, 2.8], ['glass', 1.5, 2.8], ['pallet', 1.3, 1.1], ['boards', 1.1, 4.0]],
	];
	for (let s = 0; s < 4; s++) {
		placed.length = base;
		const out = [];
		if (!opts.glassOnly) for (const [what, w, d] of WANT[s]) {
			// (long things lie along the front; a spot nearer the gate for what is carried in)
			const p = spot(w, d, [gateU + (out.length % 2 ? 4 : -4), fenceV - 1], what, 0.12);
			if (p) out.push({ what, u: p.u, v: p.v, turned: p.turned });
		}
		stages.push(out);
	}
	placed.length = base;
	return { L, D, H, kerbV: kv, fenceV, uL, uR, vBack, sideX, sideScaf, faces, gateU, crane, fixed, stages, scafV };
}

// ---------- the scaffold's height and the work's ----------
// how high the scaffold stands at progress p (0 before and after), the frame's and the walls' tops
export function workHeights(p, H, storey = 3.2, out = { scaf: 0, frame: 0, clad: 0, glaze: 0 }) {
	if (p == null) { out.scaf = out.frame = out.clad = out.glaze = 0; return out; }
	const snap = (y) => (y >= H - 0.01 ? H : Math.floor(y / storey + 1e-6) * storey);
	const frame = snap(H * smooth(0.18, 0.66, p) + storey * 0.999), clad = snap(H * smooth(0.3, 0.82, p)), glaze = snap(H * smooth(0.5, 0.97, p));
	let scaf = 0;
	if (p >= 0.13 && p < 0.9) scaf = p < 0.16 ? 4 * (p - 0.13) / 0.03 : Math.min(H + 1.2, Math.max(4, Math.min(frame, H) + 2));
	else if (p >= 0.9 && p < 0.985) scaf = (H + 1.2) * (1 - smooth(0.9, 0.98, p));
	out.scaf = scaf; out.frame = frame; out.clad = clad; out.glaze = glaze;
	return out;
}

// ---------- the trucks along the kerb ----------
// each slot's middle s along the near lane's way from opposite the site; the crane's beyond the
// site downstream, the first truck at the gate, the second behind it
export function kerbSlots(L, gateU = 0) {
	return { a: gateU - 1.5, b: gateU - 1.5 - 14, crane: Math.max(13.5, L / 2 + 6.5), box: gateU - 1.5 - 27 };
}
// the way a truck comes in or goes: a list of points (x, z) along it and its length; where the
// truck is at distance d along it, its way, and whether it is backing. mode: 'in', 'back', 'out'
// (away: out into the lane, or across into the far one to get round a crane standing in the near one)
export function drivePath(K, s, mode, len = 10, away = null) {
	const kerbLat = K.hw - 1.45, lane = K.lane, far = 70, pts = [];
	const push = (s1, lat, rev) => { const q = roadAt(K, s1, lat); pts.push([q[0], q[1], rev ? 1 : 0]); };
	const ease = (a, b, k) => a + (b - a) * smooth(0, 1, k);
	if (mode === 'in') {
		for (let k = 0; k <= 60; k++) { const s1 = s - far + far * k / 60; push(s1, ease(lane, kerbLat, (s1 - (s - 19)) / 15), false); }
	} else if (mode === 'back') {
		// (up in the lane past the place, then back in to the kerb, the beeper going)
		for (let k = 0; k <= 24; k++) { const s1 = s - far + (far + len + 4) * k / 24; push(s1, ease(lane, lane + (kerbLat - lane) * 0.25, (s1 - (s + 2)) / (len + 2)), false); }
		for (let k = 1; k <= 12; k++) { const s1 = s + len + 4 - (len + 4) * k / 12; push(s1, ease(lane + (kerbLat - lane) * 0.25, kerbLat, k / 12), true); }
	} else {
		for (let k = 0; k <= 40; k++) { const s1 = s + far * k / 40; push(s1, ease(kerbLat, away ?? lane, (s1 - s) / 14), false); }
	}
	const acc = [0];
	for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
	return { pts, acc, length: acc[acc.length - 1], mode };
}
// where along a path at distance d: out [x, z, hx, hz, reversing]
export function pathAt(P, d, out = [0, 0, 0, 1, 0]) {
	const { pts, acc } = P;
	d = Math.max(0, Math.min(P.length, d));
	let i = 1;
	while (i < acc.length - 1 && acc[i] < d) i++;
	const a = pts[i - 1], b = pts[i], l = acc[i] - acc[i - 1] || 1, k = (d - acc[i - 1]) / l;
	out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k;
	const rev = b[2] > 0.5;
	// (the way it faces: along the path, or against it while it backs)
	const hx = (b[0] - a[0]) / l, hz = (b[1] - a[1]) / l;
	out[2] = rev ? -hx : hx; out[3] = rev ? -hz : hz; out[4] = rev ? 1 : 0;
	return out;
}
// the speed for distance d along a path of length L: up to cruising, slowing to stop at the end
// (and to a stop where it changes to backing)
export function speedAt(P, d, cruise = 7) {
	const left = P.length - d;
	let v = Math.min(cruise, Math.sqrt(2 * 1.1 * Math.max(0, left)) + 0.4, 1.2 + d * 0.8);
	if (P.mode === 'back') {
		// (where the backing starts)
		let turn = P.length;
		for (let i = 1; i < P.pts.length; i++) if (P.pts[i][2] > 0.5) { turn = P.acc[i - 1]; break; }
		if (d < turn) v = Math.min(v, Math.sqrt(2 * 1.1 * Math.max(0, turn - d)) + 0.35);
		else v = Math.min(v, 1.6);
	}
	if (P.mode === 'out') v = Math.min(cruise, 0.8 + d * 0.5);
	return Math.max(0.3, v);
}

// ---------- the cranes' cycles ----------
// a lift: down at the pick, up, slewed round, down at the drop, let go, up, back, down again.
// c: { a0, a1 (slew angles at pick and drop), r0, r1 (radii), y0, y1 (hook heights at pick
// and drop), top (the height it travels at), slew (rad/s), hoist (m/s), trolley (m/s) }; t
// seconds. out: { a, r, y, loaded, phase, moving }
export function liftAt(c, t, out = { a: 0, r: 0, y: 0, loaded: false, phase: 0, moving: false }) {
	let da = c.a1 - c.a0;
	while (da > Math.PI) da -= Math.PI * 2;
	while (da < -Math.PI) da += Math.PI * 2;
	const ts = Math.max(Math.abs(da) / c.slew, Math.abs(c.r1 - c.r0) / (c.trolley || 1e9)), up0 = Math.abs(c.top - c.y0) / c.hoist, up1 = Math.abs(c.top - c.y1) / c.hoist, hold = 9;
	const seq = [hold, up0, ts, up1, hold, up1, ts, up0];
	const T = seq.reduce((a, b) => a + b, 0);
	let f = ((t % T) + T) % T, ph = 0;
	while (ph < 7 && f > seq[ph]) { f -= seq[ph]; ph++; }
	const k = smooth(0, 1, f / Math.max(0.01, seq[ph]));
	let a = c.a0, r = c.r0, y = c.y0;
	if (ph === 0) { a = c.a0; r = c.r0; y = c.y0; }
	else if (ph === 1) { y = c.y0 + (c.top - c.y0) * k; }
	else if (ph === 2) { a = c.a0 + da * k; r = c.r0 + (c.r1 - c.r0) * k; y = c.top; }
	else if (ph === 3) { a = c.a0 + da; r = c.r1; y = c.top + (c.y1 - c.top) * k; }
	else if (ph === 4) { a = c.a0 + da; r = c.r1; y = c.y1; }
	else if (ph === 5) { a = c.a0 + da; r = c.r1; y = c.y1 + (c.top - c.y1) * k; }
	else if (ph === 6) { a = c.a0 + da * (1 - k); r = c.r1 + (c.r0 - c.r1) * k; y = c.top; }
	else { y = c.top + (c.y0 - c.top) * k; }
	out.a = a; out.r = r; out.y = y; out.phase = ph; out.k = f / Math.max(0.01, seq[ph]); out.loaded = ph >= 1 && ph <= 4; out.moving = ph !== 0 && ph !== 4;
	return out;
}
