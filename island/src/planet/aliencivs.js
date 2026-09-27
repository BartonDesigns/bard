// The builders of other worlds (alien.js places their works). Each kind of world had its
// own people and they built in their own way:
//
//   the Choir (mystical worlds): crystal cathedrals, faceted prism spires, shards held
//     in the air by light;
//   the Lensing (the world by the dark star): obsidian rings standing on edge, a black
//     sphere hung in each, arches bent toward it as if by its weight;
//   the Brood (toxic worlds): ribbed chitin towers on bent legs, hive domes, tubes and
//     sacs of glowing bile;
//   the Sunwrights (deserts): stepped ziggurats, ringed stelae, wind-traps and fields of
//     sun mirrors;
//   the Glassmakers (ice worlds): twisted lattice towers of steel and ice-glass,
//     geodesic frost domes, aurora masts;
//   the Forgewrights (volcanic worlds): citadels of basalt columns, obsidian blades cut
//     out into the air, light running in channels;
//   the Growers (green, ocean and ringed worlds): shells, ribs and stalks grown rather
//     than built, living-stone amphitheatres, tidal pylons on stilts;
//   the Tetherers (the moon of a gas giant): needle towers in low gravity, rings hung in
//     the air, platforms on tethers, dishes turned to the giant.
//
// A builder gets a site (x, z, y the level it stands on, yaw, r, h) and X: the kit's
// buckets (X.K), a random stream (X.r), the ground (X.H), the colliders (X.col), light
// shafts (X.beam), aurorae (X.aurora) and the detail level (X.det, lower on phones).

import * as THREE from 'three';
import { lathe, prism, shard, box, cbox, ring, strut, sweep, geodesic, geoPanes, blob, line, frame } from './alienkit.js';

const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// a point in a frame by radius, height and bearing (bearing 0 is the frame's +z)
const rad = (F, r, y, th) => F.p(r * Math.sin(th), y, r * Math.cos(th));
// a shape stood at radius r and bearing th, leaning outward by a
const leanOut = (F, g, r, y, th, a) => F.put(g, r * Math.sin(th), y, r * Math.cos(th), th - Math.PI / 2, 0, -a);

// a blade: a flat outline extruded t thick, its edges bevelled, standing in the frame's
// radial plane at bearing th (outline x runs outward, y up)
function fin(F, pts, t, th, bev = 0.3, curve = 0) {
	const s = new THREE.Shape();
	s.moveTo(pts[0][0], pts[0][1]);
	for (let i = 1; i < pts.length; i++) {
		if (curve && i === pts.length - 1) s.quadraticCurveTo(pts[0][0] + (pts[1][0] - pts[0][0]) * curve, pts[i][1] * 0.22, pts[i][0], pts[i][1]);
		else s.lineTo(pts[i][0], pts[i][1]);
	}
	s.closePath();
	const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 10 });
	g.translate(0, 0, -t / 2);
	const out = g.index ? g.toNonIndexed() : g;
	if (out !== g) g.dispose();
	out.deleteAttribute('uv');
	out.computeVertexNormals();
	return F.put(out, 0, 0, 0, th - Math.PI / 2);
}
// light lines up a turned shape's edges (its profile [r, y] turned with sides at phase phi)
function edgeLines(X, F, prof, sides, phi, w, every = 1) {
	for (let k = 0; k < sides; k += every) {
		const th = phi + k / sides * TAU;
		for (let i = 0; i < prof.length - 1; i++) {
			const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
			if (Math.abs(y1 - y0) < 0.3) continue;
			X.K.add('glow', line(rad(F, r0 + w * 0.4, y0, th), rad(F, r1 + w * 0.4, y1, th), w), { tint: [1.2, 1.2, 1.2] });
		}
	}
}
// a flat loop of light round a frame's upright at height y
function glowRing(X, F, R, y, w = 0.35, o = {}) {
	X.K.add('glow', F.put(ring(R, w, w, Math.max(12, Math.round(R * 2 * X.det)), true), 0, y, 0), o);
}
// a causeway's wedge: w wide, running along z from z0 (top y0) to z1 (top y1), its foot at yb
function wedge(w, z0, z1, y0, y1, yb) {
	const g = new THREE.BoxGeometry(w, 1, z1 - z0).toNonIndexed(), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const t = (p.getZ(i) + (z1 - z0) / 2) / (z1 - z0);
		p.setY(i, p.getY(i) > 0 ? y0 + (y1 - y0) * t : yb);
		p.setZ(i, z0 + t * (z1 - z0));
	}
	for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
	g.computeVertexNormals();
	return g;
}

// ---------- foundations and ramps ----------
// A work's platform: its sides, radius and where a causeway may come up to it (a
// people's own defaults for its landmark and complex, overridden by the builder)
export function baseOf(C, S, o = {}) {
	const b = { ...((S.kind !== 'small' && C.base?.[S.type]) || {}), ...o };
	const sides = b.sides || C.sides, r = b.r || S.r * (b.k || 1), step = b.step ?? 2.6;
	const rise = Math.max(0.6, S.y - S.g0), steps = rise < 3 ? 1 : Math.min(3, Math.ceil(rise / 4));
	return { ...b, sides, r, step, rise, steps, d: rise / steps, ri: r * (1 + Math.cos(Math.PI / sides)) / 2, out: r + (steps - 1) * step, phi: b.phi ?? Math.PI / sides, rampW: b.rampW || (S.kind === 'landmark' ? 8 : 6) };
}
// the causeway: along the bearing (of those allowed) where the ground comes up nearest
// to the platform; none if the ground is within a stride of its top somewhere
export function findRamp(Hf, S, B) {
	if (B.noRamp) return null;
	const slope = 0.36, r0 = B.ri * 0.82, c = Math.cos(S.yaw), s = Math.sin(S.yaw);
	const H = (rr, th) => { const lx = rr * Math.sin(th), lz = rr * Math.cos(th); return Hf(S.x + lx * c + lz * s, S.z - lx * s + lz * c) - S.y; };
	const bearings = B.rampAt || Array.from({ length: 12 }, (_, i) => i / 12 * TAU);
	let best = null;
	for (const th of bearings) {
		if (H(B.out + 2, th) > -1.1) return null;
		for (let rr = B.out + 2; rr < B.out + 90; rr += 2) {
			if (-(rr - r0) * slope <= H(rr, th) + 0.2) { if (!best || rr < best.rr) best = { th, rr }; break; }
		}
	}
	if (!best) return null;
	let low = 0;
	for (let q = r0; q <= best.rr; q += 3) low = Math.min(low, H(q, best.th));
	return { ...best, r0, slope, low };
}
// Every work stands on its own ground: a platform cut level at the site's height, its
// sides going down past the lowest ground under it, stepped back in terraces where the
// slope is steep, and a causeway up to it if the step is more than a stride.
export function foundation(X, S, o = {}) {
	const F = frame(S.x, S.y, S.z, S.yaw), B = baseOf(X.C, S, o), { r, sides, steps, d, step: out, phi } = B;
	const yb = -B.rise - 5, ch = Math.min(0.5, d * 0.2), prof = [[0, yb]];
	for (let k = steps - 1; k >= 0; k--) {
		const rk = r + k * out, yk = -k * d;
		prof.push([rk, k === steps - 1 ? yb : -(k + 1) * d], [rk, yk - ch], [rk - ch, yk]);
	}
	prof.push([0, 0]);
	X.K.add(B.mat || 'trim', F.put(lathe(prof, sides, !B.smooth, phi)), { glow: B.glyph ? 1 : 0 });
	// a line of light along the top edge
	if (B.edge !== false) X.K.add('glow', F.put(lathe([[r - 0.25, -0.05], [r + 0.08, -0.05], [r + 0.08, 0.06], [r - 0.25, 0.06]], sides, true, phi)), {});
	for (let k = 0; k < steps; k++) X.col.disc(S.x, S.z, B.ri + k * out, S.y - k * d, { site: S.id });
	const rp = findRamp(X.H, S, B);
	if (rp) ramp(X, S, F, rp, B.rampW);
	return F;
}
// up from the ground to a platform: a causeway with kerbs, light along them
function ramp(X, S, F, rp, w) {
	const { th, rr, r0, slope, low } = rp, y1 = -(rr - r0) * slope;
	const G = F.sub(0, 0, 0, th);
	X.K.add('trim', wedge(w, r0, rr + 1.5, 0, y1 - 1.5 * slope, low - 3).applyMatrix4(new THREE.Matrix4().makeRotationY(G.yaw).setPosition(G.x, G.y, G.z)), {});
	for (const sx of [-1, 1]) {
		const a = G.p(sx * (w / 2 - 0.3), 0.35, r0), b = G.p(sx * (w / 2 - 0.3), y1 + 0.35, rr);
		X.K.add('body', strut(a, b, 0.6, 0.7, true), {});
		X.K.add('glow', line(G.p(sx * (w / 2 - 0.3), 0.74, r0), G.p(sx * (w / 2 - 0.3), y1 + 0.74, rr), 0.12), {});
	}
	X.col.ramp(G.x, G.z, G.yaw, w / 2, r0, rr + 1.5, S.y, S.y + y1 - 1.5 * slope, S.id);
}

// ---------- the civilisations ----------
// a name in the builders' own sounds
export function nameFor(C, r) {
	const s = C.syl, n = 2 + (r() < 0.4 ? 1 : 0);
	let w = '';
	for (let i = 0; i < n; i++) w += s[Math.floor(r() * s.length)];
	return w[0].toUpperCase() + w.slice(1);
}

// ===== the Choir =====
const CHOIR = {
	key: 'choir', people: 'the Choir', sides: 6,
	base: { landmark: { sides: 6, rampAt: [0, 1, 2, 3, 4, 5].map((k) => k / 6 * TAU) }, complex: { sides: 6, rampAt: [0] } },
	syl: ['ael', 'veth', 'ith', 'sor', 'ya', 'lune', 'ca', 'rin', 'thae', 'el'],
	nouns: { landmark: 'Spire', complex: 'Cathedral', marker: 'Chime', gate: 'Choir Gate', beacon: 'Lantern', platform: 'Choir Balcony', bridge: 'Crystal Span' },
	glow: [0.55, 0.78, 1.0], beam: [0.55, 0.6, 1.0],
	mats: {
		body: { color: [0.74, 0.72, 0.84], rough: 0.3, metal: 0.1, iridescence: 0.5, seam: 3, seamK: 0.25, rim: 0.25, rimC: [0.6, 0.5, 1.0] },
		trim: { color: [0.36, 0.26, 0.56], rough: 0.18, metal: 0.35, clearcoat: 1, seam: 0, seamK: 0.35 },
		glass: { color: [0.62, 0.5, 0.95], rough: 0.06, metal: 0.1, iridescence: 1, opacity: 0.82, seam: 3, seamK: 0.6, rim: 1.4, rimC: [0.55, 0.7, 1.0] },
	},
	landmark(X, S) {
		const F = foundation(X, S, { glyph: true }), K = X.K, H = S.h, r = X.r;
		// the spire: a hexagonal shaft, waisted, swelling at its crystal crown, then a long point
		const prof = [[0, 0], [15, 0], [15, 2.5], [12.5, 5], [11, 0.26 * H], [12.8, 0.4 * H], [12.8, 0.43 * H], [11, 0.47 * H], [7.5, 0.68 * H], [3.2, 0.86 * H], [0, H]];
		K.add('body', F.put(lathe(prof, 6, true, 0)), { glow: 1 });
		edgeLines(X, F, prof.slice(1), 6, 0, 0.4);
		// flying buttresses from the platform's edge up its faces, a line of light on each
		for (let k = 0; k < 6; k++) {
			const th = (k + 0.5) / 6 * TAU, top = 0.34 * H, out = S.r * 0.98;
			K.add('trim', fin(F, [[8, 0], [out, 0], [9, top]], 2.4, th, 0.35, 0.1), {});
			const q = new THREE.QuadraticBezierCurve(new THREE.Vector2(out, 0), new THREE.Vector2(8 + (out - 8) * 0.1, top * 0.22), new THREE.Vector2(9, top));
			const pts = q.getPoints(10);
			for (let i = 0; i < pts.length - 1; i++) K.add('glow', line(rad(F, pts[i].x + 0.3, pts[i].y + 0.35, th), rad(F, pts[i + 1].x + 0.3, pts[i + 1].y + 0.35, th), 0.3), {});
			X.col.seg(rad(F, 9, 0, th), rad(F, out, 0, th), 1.6, S.y + top, S.id);
		}
		// crystals breaking out where it swells
		for (let k = 0; k < 6; k++) K.add('glass', leanOut(F, shard(2.6, 26 + r() * 10, 6, r), 12.3, 0.39 * H, k / 6 * TAU, 0.42), { glow: 2 });
		for (let k = 0; k < 6; k++) K.add('glass', leanOut(F, shard(1.5, 12 + r() * 6, 5, r), 12.8, 0.43 * H, (k + 0.5) / 6 * TAU, 0.75), {});
		// the crown: shards held in the air round the point, turning, and a halo under them
		const cy = 0.8 * H, cp = F.p(0, cy, 0), spin = [cp.x, cp.y, cp.z, 0.05];
		for (let k = 0; k < 9; k++) {
			const th = k / 9 * TAU, up = k % 2 ? 1 : -1, g = shard(2.2, 14 + r() * 8, 5, r);
			K.add('glass', F.put(g, 21 * Math.sin(th), cy + up * 5, 21 * Math.cos(th), th, up < 0 ? Math.PI : 0, 0.3 * up), { spin, glow: 2 });
		}
		K.add('trim', F.put(ring(27, 2.2, 1.4, 36), 0, cy - 12, 0), { spin: [cp.x, cp.y - 12, cp.z, -0.03] });
		K.add('glow', F.put(ring(25.2, 0.5, 0.4, 48), 0, cy - 11.6, 0), { spin: [cp.x, cp.y - 12, cp.z, -0.03] });
		// teeth of crystal round the platform's edge
		for (let k = 0; k < 12; k++) K.add('glass', leanOut(F, shard(1.3, 6 + r() * 4, 5, r), S.r * 0.9, 0, (k + 0.5) / 12 * TAU, 0.2), { near: true });
		X.beam(F.p(0, H, 0), 900, 2.5, 22, 1, CHOIR.beam);
		X.col.disc(S.x, S.z, 15, S.y + H, { site: S.id, floor: false });
	},
	complex(X, S) {
		const F = foundation(X, S), K = X.K, r = X.r;
		const L = 60, W = 24, legs = 8, n = 7;
		// the nave: pointed arches of crystal ribs, glass between them, a spine along the ridge
		for (let i = 0; i < n; i++) {
			const z = -L / 2 + i * L / (n - 1), pts = [];
			for (const sx of [-1, 1]) {
				const side = [F.p(sx * W / 2, 0, z), F.p(sx * W / 2, legs * 0.5, z), F.p(sx * W / 2, legs, z)];
				for (let a = 0; a <= 6; a++) { const t = Math.PI - a / 6 * Math.PI / 3; side.push(F.p(-sx * (W / 2 + W * Math.cos(t)), legs + W * Math.sin(t) + (a === 6 ? 0.01 : 0), z)); }
				pts.push(side);
			}
			for (const side of pts) K.add('body', sweep(side, (t) => 1.3 - t * 0.45, 6, { sx: 1, sy: 1.7, flat: true, step: 1.6 }), { glow: 1 });
			K.add('glass', F.put(shard(0.9, 7, 5, r), 0, legs + W * 0.866 - 0.6, z), { glow: 2 });
			// the walls: a low course, glass above it
			if (i < n - 1) {
				const z1 = z + L / (n - 1);
				for (const sx of [-1, 1]) {
					K.add('trim', F.put(cbox(1.2, 3, z1 - z - 2.4, 0.2), sx * W / 2, 1.5, (z + z1) / 2), {});
					K.add('glass', F.put(cbox(0.3, legs - 3, z1 - z - 3, 0.1), sx * W / 2, 3 + (legs - 3) / 2, (z + z1) / 2), {});
					X.col.seg(F.p(sx * W / 2, 0, z), F.p(sx * W / 2, 0, z1), 0.8, S.y + legs, S.id);
				}
			}
		}
		K.add('trim', strut(F.p(0, legs + W * 0.866, -L / 2 - 2), F.p(0, legs + W * 0.866, L / 2 + 2), 0.9, 0.9, true), {});
		for (const sx of [-1, 1]) K.add('glow', line(F.p(sx * W * 0.25, legs + W * 0.66, -L / 2), F.p(sx * W * 0.25, legs + W * 0.66, L / 2), 0.2), {});
		// the apse: a rose of spokes in a ring, glass behind, three great shards
		const ap = legs + 9;
		K.add('trim', F.put(ring(9, 1.2, 1.2, 24), 0, ap, -L / 2 - 0.6, 0, Math.PI / 2), {});
		for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; K.add('trim', strut(F.p(0, ap, -L / 2), F.p(Math.cos(a) * 8.5, ap + Math.sin(a) * 8.5, -L / 2), 0.35, 0.5), {}); }
		K.add('glass', F.put(lathe([[0, 0], [8.6, 0], [8.6, 0.3], [0, 0.3]], 24, true), 0, ap, -L / 2 - 1.2, 0, Math.PI / 2), { glow: 2 });
		K.add('glow', F.put(ring(3, 0.4, 0.4, 16), 0, ap, -L / 2 + 0.2, 0, Math.PI / 2), {});
		for (const [x, h, a] of [[0, 46, 0], [-8, 34, 0.18], [8, 32, -0.2]]) K.add('glass', F.put(shard(3.2, h, 6, r), x, 0, -L / 2 - 5, 0, 0.1, a), { glow: 2 });
		X.col.seg(F.p(-W / 2, 0, -L / 2), F.p(W / 2, 0, -L / 2), 1, S.y + legs, S.id);
		X.col.disc(F.p(0, 0, -L / 2 - 5).x, F.p(0, 0, -L / 2 - 5).z, 4, S.y + 40, { site: S.id, floor: false });
		// twin towers at the door
		for (const sx of [-1, 1]) {
			const tp = [[0, 0], [4.6, 0], [4.6, 3], [3.6, 5], [3.6, 34], [4.2, 38], [2.2, 44], [0, 56]];
			K.add('body', F.put(lathe(tp, 6, true, 0), sx * 16, 0, L / 2 + 1), { glow: 1 });
			edgeLines(X, F.sub(sx * 16, 0, L / 2 + 1), tp.slice(1), 6, 0, 0.25, 2);
			const q = F.p(sx * 16, 0, L / 2 + 1);
			X.col.disc(q.x, q.z, 4.4, S.y + 56, { site: S.id, floor: false });
		}
		// the altar: a shard hung over a pedestal, a shaft of light down onto it
		const alt = F.p(0, 0, -L / 2 + 10);
		K.add('trim', F.put(prism(6, 2, 1.6, 1.2), 0, 0, -L / 2 + 10), {});
		K.add('glass', F.put(shard(1.2, 5, 6, r), 0, 3, -L / 2 + 10), { spin: [alt.x, alt.y + 5, alt.z, 0.4], glow: 2 });
		X.beam(F.p(0, legs + W * 0.85, -L / 2 + 10), legs + W * 0.85 - 1, 0.6, 3, -1, [0.45, 0.5, 1.0]);
		X.col.disc(alt.x, alt.z, 2.1, S.y + 1.2, { site: S.id });
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3.4, noRamp: true }), K = X.K, r = X.r, h = 14 + r() * 10;
		const p = [[0, 0], [1.9, 0], [1.9, 0.6], [1.5, 1.2], [1.2, h], [0, h + 3]];
		K.add('body', F.put(lathe(p, 6, true, 0)), { glow: 1 });
		edgeLines(X, F, p.slice(1), 6, 0, 0.12, 2);
		const cp = F.p(0, h + 7, 0);
		K.add('glass', F.put(shard(1.1, 4.5, 6, r), 0, h + 5, 0), { spin: [cp.x, cp.y, cp.z, 0.35], glow: 2 });
		X.col.disc(S.x, S.z, 1.9, S.y + h, { site: S.id, floor: false });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 7, sides: 6, noRamp: true }), K = X.K, r = X.r, h = 16 + r() * 5;
		for (const sx of [-1, 1]) {
			K.add('trim', F.put(shard(1.6, h, 6, r), sx * 4.6, -0.5, 0, 0, 0, sx * 0.09), { glow: 1 });
			const q = F.p(sx * 4.8, 0, 0);
			X.col.disc(q.x, q.z, 1.6, S.y + h, { site: S.id, floor: false });
		}
		const lp = F.p(0, h + 2.2, 0);
		K.add('glass', F.put(prism(6, 0.9, 0.9, 13, 0, 0.2), -6.5, h + 2.2, 0, 0, 0, -Math.PI / 2), { spin: [lp.x, lp.y, lp.z, 1e-6], glow: 2 });
		K.add('glow', F.put(ring(2.2, 0.25, 0.25, 24), 0, h * 0.62, 0, 0, Math.PI / 2), { spin: [lp.x, S.y + h * 0.62, lp.z, 0.5] });
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 5, noRamp: true }), K = X.K, r = X.r, h = 12;
		for (let k = 0; k < 3; k++) K.add('trim', leanOut(F, shard(0.9, h + 1.5, 5, r), 4.6, -0.3, k / 3 * TAU, -0.33), {});
		const cp = F.p(0, h + 2.5, 0);
		K.add('glow', F.put(new THREE.OctahedronGeometry(1.4, 0), 0, h + 2.5, 0), { spin: [cp.x, cp.y, cp.z, 0.6], tint: [1.4, 1.4, 1.4] });
		X.beam(cp, 400, 0.8, 5, 1, CHOIR.beam);
		X.col.disc(S.x, S.z, 3.5, S.y + 4, { site: S.id, floor: false });
	},
	post(X, F, x, y, z, h) { X.K.add('glass', F.put(shard(0.35, h, 5, X.r), x, y, z), { glow: 2, near: true }); },
};

// ===== the Lensing =====
const LENS = {
	key: 'lens', people: 'the Lensing', sides: 24,
	base: { landmark: {}, complex: {} },
	syl: ['vor', 'aath', 'kel', 'nul', 'or', 'um', 'shae', 'dra', 'xa', 'on'],
	nouns: { landmark: 'Event Ring', complex: 'Bent Arcade', marker: 'Monolith', gate: 'Ring Gate', beacon: 'Well', platform: 'Horizon Ledge', bridge: 'Null Span' },
	glow: [1.0, 0.58, 0.28], beam: [0.9, 0.5, 1.0],
	mats: {
		body: { color: [0.035, 0.034, 0.042], rough: 0.1, metal: 0.85, clearcoat: 1, ccRough: 0.05, seam: 0, seamK: 0.18 },
		trim: { color: [0.1, 0.09, 0.12], rough: 0.22, metal: 0.9, iridescence: 0.3, seam: 0, seamK: 0.4 },
		glass: { color: [0.01, 0.01, 0.012], rough: 0.02, metal: 1, clearcoat: 1, seam: 3, seamK: 0.1, rim: 1.2, rimC: [0.8, 0.45, 1.0] },
	},
	landmark(X, S) {
		const F = foundation(X, S), K = X.K, H = S.h, Rc = 0.42 * H, cy = Rc + 3;
		// the ring on edge, square in section, a loop of light inside it
		K.add('body', F.put(ring(Rc, 10, 8, Math.round(96 * X.det), true), 0, cy, -4, 0, Math.PI / 2), { glow: 1 });
		K.add('glow', F.put(ring(Rc - 5.1, 0.5, 1.2, Math.round(96 * X.det), true), 0, cy, -0.6, 0, Math.PI / 2), { tint: [1.3, 1.3, 1.3] });
		K.add('glow', F.put(ring(Rc + 5.1, 0.3, 0.8, Math.round(96 * X.det), true), 0, cy, -0.4, 0, Math.PI / 2), {});
		// the cradle it stands in
		for (const sx of [-1, 1]) {
			K.add('trim', F.put(cbox(12, 16, 16, 1.2), sx * 12, 5, 0, 0, 0, sx * 0.35), {});
			const q = F.p(sx * 12, 0, 0);
			X.col.box(q.x, q.z, F.yaw, 7, 8, S.y + 14, { site: S.id });
		}
		// the singularity: a black ball, its bright disc, rings turning about it
		const cp = F.p(0, cy, 0);
		K.add('glass', F.put(blob(0.12 * Rc, 0.12 * Rc, 0.12 * Rc, 16), 0, cy, 0), { spin: [cp.x, cp.y, cp.z, 0.02] });
		K.add('glow', F.put(ring(0.24 * Rc, 0.12 * Rc, 0.15, 64), 0, cy, 0, 0, 0.35, 0.1), { spin: [cp.x, cp.y, cp.z, 0.22], tint: [1.5, 1.3, 1.1] });
		K.add('glow', F.put(ring(0.17 * Rc, 0.02 * Rc, 0.1, 64), 0, cy, 0, 0, 0.35, 0.1), { spin: [cp.x, cp.y, cp.z, 0.3], tint: [2, 1.8, 1.6] });
		for (const [k, rr, tx, tz, w] of [[0, 0.62, 1.1, 0.2, 0.05], [1, 0.48, -0.5, 0.9, -0.07], [2, 0.36, 0.25, -1.2, 0.11]]) {
			K.add('trim', F.put(ring(rr * Rc, 1.4 + k * 0.2, 1.2, 64), 0, cy, 0, 0, tx, tz), { spin: [cp.x, cp.y, cp.z, w] });
		}
		// the pylons, leaning toward the ring as if its weight bent them
		for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			const px = sx * S.r * 0.72, pz = sz * S.r * 0.55;
			const pts = [F.p(px, -1, pz), F.p(px * 0.97, 18, pz * 0.95), F.p(px * 0.8, 36, pz * 0.7), F.p(px * 0.52, 50, pz * 0.4), F.p(px * 0.3, 57, pz * 0.18)];
			K.add('body', sweep(pts, (t) => 1.6 * (1 - 0.8 * t), 4, { sx: 2.2, sy: 1.2, flat: true, step: 2 }), { glow: 1 });
			const q = F.p(px, 0, pz);
			X.col.disc(q.x, q.z, 3, S.y + 30, { site: S.id, floor: false });
		}
		X.beam(cp, cy - 0.12 * Rc, 1.5, 9, -1, [1.0, 0.6, 0.35]);
		X.beam(F.p(0, cy + 0.12 * Rc, 0), 600, 1.2, 10, 1, LENS.beam);
	},
	complex(X, S) {
		const F = foundation(X, S), K = X.K, R = S.r * 0.62, n = 7;
		// the arcade: arches round the court, each bent in toward the lens at its middle
		for (let i = 0; i < n; i++) {
			const a0 = (i + 0.08) / n * TAU + 0.2, a1 = (i + 0.92) / n * TAU + 0.2, am = (a0 + a1) / 2;
			const pts = [rad(F, R, -1, a0), rad(F, R * 0.96, 9, a0 + 0.04), rad(F, R * 0.72, 17, am - 0.05), rad(F, R * 0.62, 19.5, am), rad(F, R * 0.72, 17, am + 0.05), rad(F, R * 0.96, 9, a1 - 0.04), rad(F, R, -1, a1)];
			K.add('body', sweep(pts, 1.1, 4, { sx: 1.1, sy: 2.2, flat: true, step: 1.5 }), { glow: 1 });
			for (const a of [a0, a1]) { const q = rad(F, R, 0, a); X.col.disc(q.x, q.z, 1.6, S.y + 9, { site: S.id, floor: false }); }
		}
		// the lens: a black disc turning over the court, a ball over it, a shaft down
		const cp = F.p(0, 11, 0);
		K.add('trim', F.put(ring(8, 7, 0.7, 48), 0, 11, 0), { spin: [cp.x, cp.y, cp.z, 0.08] });
		K.add('glow', F.put(ring(11.6, 0.3, 0.9, 48), 0, 10.9, 0), { spin: [cp.x, cp.y, cp.z, 0.08] });
		K.add('glass', F.put(blob(3.2, 3.2, 3.2, 14), 0, 16, 0), { spin: [cp.x, cp.y + 5, cp.z, 0.05] });
		K.add('glow', F.put(ring(5.2, 1.8, 0.1, 40), 0, 16, 0, 0, 0.4), { spin: [cp.x, cp.y + 5, cp.z, 0.4], tint: [1.4, 1.2, 1] });
		X.beam(F.p(0, 12.8, 0), 12.8, 1, 5, -1, [1, 0.6, 0.3]);
		// a pool of dark glass under it, ringed with light
		K.add('glass', F.put(lathe([[0, 0.05], [6, 0.05], [6.6, 0], [0, 0]], 32, true)), {});
		glowRing(X, F, 6.8, 0.06, 0.3);
		// two monoliths at the way in
		for (const sx of [-1, 1]) { K.add('body', F.put(cbox(3, 16, 0.9, 0.2), sx * 7, 8, S.r * 0.75, 0, 0, sx * 0.05), { glow: 1 }); const q = F.p(sx * 7, 0, S.r * 0.75); X.col.box(q.x, q.z, F.yaw, 1.6, 0.6, S.y + 16, { site: S.id }); }
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3.2, noRamp: true, sides: 4 }), K = X.K, h = 12 + X.r() * 8;
		K.add('body', F.put(cbox(3.6, h, 1, 0.15), 0, h / 2, 0, 0, 0, 0.06), {});
		for (const sz of [-1, 1]) K.add('glow', F.put(box(0.12, h * 0.8, 0.05), 0, h * 0.5, sz * 0.53, 0, 0, 0.06), {});
		X.col.box(S.x, S.z, S.yaw, 1.9, 0.6, S.y + h, { site: S.id });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 7, sides: 24, noRamp: true }), K = X.K, R = 7.5;
		K.add('body', F.put(ring(R, 1.6, 1.4, 48), 0, R + 1, -0.7, 0, Math.PI / 2), { glow: 1 });
		K.add('glow', F.put(ring(R - 0.85, 0.12, 1.0, 48), 0, R + 1, -0.5, 0, Math.PI / 2), {});
		K.add('trim', F.put(cbox(6, 3, 3, 0.4), 0, 1, 0), {});
		const cp = F.p(0, R + 1, 0);
		K.add('glass', F.put(blob(1.1, 1.1, 1.1, 10), 0, R + 1, 0), { spin: [cp.x, cp.y, cp.z, 0.1] });
		for (const sx of [-1, 1]) { const q = F.p(sx * R, 0, 0); X.col.disc(q.x, q.z, 1.2, S.y + 2 * R, { site: S.id, floor: false }); }
		X.col.box(S.x, S.z, S.yaw, 3, 1.5, S.y + 2.5, { site: S.id });
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 4, noRamp: true }), K = X.K, h = 11, cp = F.p(0, h, 0);
		K.add('glass', F.put(blob(1.6, 1.6, 1.6, 12), 0, h, 0), { spin: [cp.x, cp.y, cp.z, 0.1] });
		K.add('trim', F.put(ring(3.4, 0.5, 0.4, 32), 0, h, 0, 0, 0.5), { spin: [cp.x, cp.y, cp.z, 0.5] });
		K.add('glow', F.put(ring(2.6, 1, 0.08, 32), 0, h, 0, 0, 0.5), { spin: [cp.x, cp.y, cp.z, 0.9], tint: [1.4, 1.2, 1] });
		for (let k = 0; k < 3; k++) K.add('body', F.put(cbox(0.8, 6, 0.8, 0.15), 3.2 * Math.sin(k / 3 * TAU), 2.6, 3.2 * Math.cos(k / 3 * TAU), k / 3 * TAU, 0.25, 0), {});
		X.beam(cp, h, 0.6, 2.5, -1, [1, 0.6, 0.3]);
		X.col.disc(S.x, S.z, 3.8, S.y + 5, { site: S.id, floor: false });
	},
	post(X, F, x, y, z, h) { X.K.add('body', F.put(cbox(0.5, h, 0.3, 0.08), x, y + h / 2, z), { near: true }); },
};

// ===== the Brood =====
const rib = (t, H, every) => 1 + 0.13 * Math.pow(0.5 + 0.5 * Math.cos(t * H / every * TAU), 10);
const BROOD = {
	key: 'brood', people: 'the Brood', sides: 14,
	base: { landmark: { k: 0.85 }, complex: { rampAt: [0] } },
	syl: ['kh', 'zz', 'ix', 'ak', 'ul', 'thrr', 'ez', 'og', 'vex', 'sh'],
	nouns: { landmark: 'Hive Spire', complex: 'Hive', marker: 'Brood Sac', gate: 'Rib Gate', beacon: 'Vent', platform: 'Chitin Shelf', bridge: 'Spine Bridge' },
	glow: [0.62, 1.0, 0.22], beam: [0.5, 1.0, 0.25],
	mats: {
		body: { color: [0.13, 0.12, 0.085], rough: 0.42, metal: 0.1, clearcoat: 0.7, ccRough: 0.3, seam: 2, seamK: 0.8, envK: 0.5 },
		trim: { color: [0.62, 0.58, 0.46], rough: 0.55, metal: 0, seam: 2, seamK: 1.6 },
		glass: { color: [0.45, 0.8, 0.12], rough: 0.25, metal: 0, clearcoat: 1, opacity: 0.85, seam: 2, seamK: 0.4, rim: 1.1, rimC: [0.7, 1.0, 0.3] },
	},
	landmark(X, S) {
		const F = foundation(X, S, { smooth: true, mat: 'body' }), K = X.K, H = S.h, r = X.r;
		const spine = [F.p(0, -2, 0), F.p(2.5, 0.22 * H, 1.5), F.p(-1.5, 0.48 * H, -2.5), F.p(3, 0.74 * H, 0.5), F.p(0.5, 0.92 * H, 4), F.p(-1, H, 6)];
		const R = (t) => (19 * Math.pow(1 - t, 1.25) + 1.2) * rib(t, H, 7);
		K.add('body', sweep(spine, R, Math.round(18 * X.det), { step: 1.1 }), {});
		const curve = new THREE.CatmullRomCurve3(spine, false, 'centripetal');
		// bent legs, like a crouching thing's, from the ground into its flank
		for (let k = 0; k < 3; k++) {
			const th = k / 3 * TAU + 0.5, Rr = S.r * 1.05;
			const pts = [rad(F, Rr, -4, th), rad(F, Rr * 1.04, 0.1 * H, th + 0.08), rad(F, Rr * 0.82, 0.22 * H, th + 0.14), rad(F, Rr * 0.4, 0.3 * H, th + 0.1), rad(F, 6, 0.34 * H, th)];
			K.add('body', sweep(pts, (t) => (3.4 - t * 1.4) * rib(t, 80, 4), 12, { step: 1.2 }), {});
			const q = rad(F, Rr, 0, th);
			X.col.disc(q.x, q.z, 3.6, S.y + 0.15 * H, { site: S.id, floor: false });
		}
		// tubes of bile spiralling up it
		for (const ph of [0, Math.PI]) {
			const pts = [];
			for (let i = 0; i <= 30; i++) {
				const t = i / 30 * 0.8, c = curve.getPointAt(t), a = ph + t * 9;
				const rr = R(t) / rib(t, H, 7) + 1.6;
				pts.push(V3(c.x + Math.cos(a) * rr, c.y, c.z + Math.sin(a) * rr));
			}
			K.add('glass', sweep(pts, 0.9, 8, { step: 2 }), { glow: 2 });
		}
		// sacs hanging in clusters, and the horns at the top
		for (const t of [0.3, 0.52, 0.66]) {
			const c = curve.getPointAt(t);
			for (let j = 0; j < 5; j++) {
				const a = r() * TAU, rr = R(t) / rib(t, H, 7) + 1.5, s = 1.6 + r() * 1.6;
				K.add('glass', blob(s, s * 1.6, s, 10).translate(c.x + Math.cos(a) * rr, c.y - s * 1.2 - r() * 3, c.z + Math.sin(a) * rr), { glow: 2 });
			}
		}
		const top = curve.getPointAt(0.97);
		for (let k = 0; k < 5; k++) {
			const a = k / 5 * TAU, cx = Math.cos(a), cz = Math.sin(a);
			const pts = [top.clone(), V3(top.x + cx * 5, top.y + 8, top.z + cz * 5), V3(top.x + cx * 11, top.y + 18, top.z + cz * 11), V3(top.x + cx * 11, top.y + 30, top.z + cz * 11), V3(top.x + cx * 7, top.y + 38, top.z + cz * 7)];
			K.add('body', sweep(pts, (t) => 1.8 * (1 - t) + 0.05, 8, { step: 1.5 }), {});
		}
		K.add('glow', blob(3, 3, 3, 10).translate(top.x, top.y + 6, top.z), { tint: [1.3, 1.3, 1.3] });
		X.beam(V3(top.x, top.y + 6, top.z), 700, 2, 16, 1, BROOD.beam);
		X.col.disc(S.x, S.z, 17, S.y + H * 0.7, { site: S.id, floor: false });
	},
	complex(X, S) {
		const F = foundation(X, S, { smooth: true, mat: 'body' }), K = X.K, r = X.r;
		// the great dome, open at the front, its ribs of bone outside
		const R = 16, Hh = 13, gap = 0.62, seg = Math.round(40 * X.det);
		const shellP = [];
		for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; shellP.push([R * Math.cos(a) * rib(i / 12, 30, 5), Hh * Math.sin(a)]); }
		const inner = shellP.map(([x, y]) => [x - 0.8, y - 0.8]).reverse();
		const ph = gap / 2, len = TAU - gap;
		K.add('body', F.put(lathe(shellP, seg, false, ph, len)), {});
		K.add('body', F.put(lathe(inner, seg, false, ph, len)), {});
		for (let k = 0; k < 10; k++) {
			const th = ph + k / 9 * len, pts = [];
			for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(rad(F, (R + 0.6) * Math.cos(a), (Hh + 0.6) * Math.sin(a) - 0.5, th)); }
			K.add('trim', sweep(pts, (t) => 0.9 - t * 0.4, 8, { step: 1 }), {});
		}
		// its door: two tusks of bone curving over
		for (const sx of [-1, 1]) {
			const th = sx * gap / 2;
			K.add('trim', sweep([rad(F, R + 1, -1, th), rad(F, R + 2.5, 5, th), rad(F, R + 1.5, 10, th * 0.4), rad(F, R, 12.5, 0)], (t) => 1.2 - t * 0.9, 10, { step: 1 }), {});
		}
		// the walls you meet from inside and out
		const N = 16;
		for (let i = 0; i < N; i++) {
			const a0 = ph + i / N * len, a1 = ph + (i + 1) / N * len;
			X.col.seg(rad(F, R, 0, a0), rad(F, R, 0, a1), 0.8, S.y + Hh, S.id);
		}
		// sacs glowing under the vault, a floor of chitin plates
		for (let j = 0; j < 7; j++) { const a = r() * TAU, rr = r() * 9, s = 0.9 + r(); K.add('glass', F.put(blob(s, s * 1.8, s, 10), rr * Math.sin(a), Hh - 2 - s * 1.5 - r() * 2 * (1 - rr / 12), rr * Math.cos(a)), { glow: 2 }); }
		// lesser domes, tubes between
		for (let k = 0; k < 3; k++) {
			const th = Math.PI + (k - 1) * 0.9, d = R + 13 + r() * 4, rr = 6 + r() * 4, q = rad(F, d, 0, th), sub = frame(q.x, S.y, q.z, 0);
			K.add('body', sub.put(lathe(Array.from({ length: 9 }, (_, i) => { const a = i / 8 * Math.PI / 2; return [rr * Math.cos(a) * rib(i / 8, 20, 4), rr * 0.9 * Math.sin(a) + 0.01 * i]; }), 24, false)), {});
			K.add('glass', sub.put(lathe([[0, 0], [1.6, 0], [1.2, 3], [0, 3.4]], 12, false), 0, rr * 0.9 - 0.4, 0), { glow: 2 });
			const a = rad(F, R * 0.9, 3, th), b = V3(q.x, S.y + 3, q.z), m = a.clone().lerp(b, 0.5); m.y += 3;
			K.add('trim', sweep([a, m, b], (t) => 1.5 * rib(t, 20, 2.5), 10, { step: 0.8 }), {});
			X.col.disc(q.x, q.z, rr, S.y + rr * 0.9, { site: S.id, floor: false });
		}
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3, sides: 10, smooth: true, mat: 'body', noRamp: true, edge: false }), K = X.K, r = X.r, h = 9 + r() * 6;
		K.add('body', sweep([F.p(0, -1, 0), F.p(0.6, h * 0.4, 0.3), F.p(-0.4, h * 0.8, -0.2), F.p(0.3, h, 0)], (t) => (1.3 - t * 0.7) * rib(t, 30, 2), 10, { step: 0.5 }), {});
		for (let j = 0; j < 5; j++) { const a = j / 5 * TAU + r(), s = 1 + r() * 0.8; K.add('glass', F.put(blob(s, s * 1.5, s, 10), Math.cos(a) * 1.7, h - 1 - r() * 3, Math.sin(a) * 1.7), { glow: 2 }); }
		X.col.disc(S.x, S.z, 1.8, S.y + h, { site: S.id, floor: false });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 5, sides: 10, smooth: true, mat: 'body', noRamp: true, edge: false }), K = X.K;
		// a ribcage over the way: tusks from each side nearly meeting overhead
		for (let i = 0; i < 4; i++) {
			const z = -4.5 + i * 3;
			for (const sx of [-1, 1]) {
				K.add('trim', sweep([F.p(sx * 5, -1, z), F.p(sx * 6, 5, z), F.p(sx * 4.5, 10, z), F.p(sx * 1.2, 12.5, z + 0.4)], (t) => 0.8 * (1 - t) + 0.08, 8, { step: 0.8 }), {});
				const q = F.p(sx * 5.2, 0, z);
				X.col.disc(q.x, q.z, 0.9, S.y + 8, { site: S.id, floor: false });
			}
		}
		K.add('body', sweep([F.p(0, 12.8, -6), F.p(0, 13.4, 0), F.p(0, 12.8, 6)], (t) => 0.6 * rib(t, 12, 1.2), 10, { step: 0.4 }), {});
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 3.4, sides: 10, smooth: true, mat: 'body', noRamp: true, edge: false }), K = X.K, h = 16;
		K.add('body', sweep([F.p(0, -1, 0), F.p(0.5, h * 0.5, 0), F.p(0, h, 0)], (t) => (1.8 - t * 0.5) * rib(t, h, 1.4), 12, { step: 0.4 }), {});
		for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; K.add('trim', sweep([F.p(0, h - 1, 0), F.p(Math.cos(a) * 2.5, h + 1.5, Math.sin(a) * 2.5), F.p(Math.cos(a) * 3, h + 4, Math.sin(a) * 3)], (t) => 0.5 - t * 0.4, 6, { step: 0.5 }), {}); }
		K.add('glow', F.put(blob(1.2, 0.8, 1.2, 8), 0, h + 0.4, 0), { tint: [1.4, 1.4, 1.4] });
		X.beam(F.p(0, h + 0.8, 0), 300, 1, 5, 1, BROOD.beam);
		X.col.disc(S.x, S.z, 2, S.y + h, { site: S.id, floor: false });
	},
	post(X, F, x, y, z, h) { X.K.add('trim', sweep([F.p(x, y - 0.2, z), F.p(x * 1.05, y + h * 0.6, z), F.p(x * 0.97, y + h, z + 0.3)], (t) => 0.25 - t * 0.18, 6, { seg: 6 }), { near: true }); },
};

// ===== the Sunwrights =====
const SQ = Math.SQRT2;
const SUN = {
	key: 'sun', people: 'the Sunwrights', sides: 4,
	base: { landmark: { noRamp: true }, complex: { phi: Math.PI / 4, k: 0.8 * SQ, rampAt: [0] } },
	syl: ['ra', 'khet', 'am', 'su', 'nekh', 'ta', 'ish', 'mer', 'ut', 'zar'],
	nouns: { landmark: 'Sun Stele', complex: 'Wind Court', marker: 'Stele', gate: 'Sun Gate', beacon: 'Mirror', platform: 'Sun Terrace', bridge: 'Causeway' },
	glow: [1.0, 0.68, 0.3], beam: [1.0, 0.72, 0.4],
	mats: {
		body: { color: [0.8, 0.62, 0.44], rough: 0.88, metal: 0, seam: 1, seamK: 0.62 },
		trim: { color: [0.86, 0.64, 0.32], rough: 0.24, metal: 1, seam: 0, seamK: 0.6 },
		glass: { color: [0.92, 0.88, 0.8], rough: 0.04, metal: 1, seam: 0, seamK: 0.3, rim: 0.3, rimC: [1, 0.8, 0.5] },
	},
	landmark(X, S) {
		const K = X.K, H = S.h;
		// the ziggurat: five tiers, battered, and a stair up its face
		const a0 = S.r * 0.9, tiers = 5, th = 7.5, aTop = 13;
		const F = foundation(X, S, { sides: 4, phi: Math.PI / 4, r: (a0 + 2) * SQ, mat: 'body', noRamp: true, edge: false, step: 3 * SQ });
		const prof = [[0, 0]];
		for (let k = 0; k < tiers; k++) {
			const a = a0 + (aTop - a0) * k / (tiers - 1), y = k * th;
			prof.push([a * SQ, y], [a * 0.93 * SQ, y + th - 0.8], [a * 0.93 * SQ + 0.5, y + th - 0.6], [a * 0.93 * SQ + 0.5, y + th - 0.2], [a * 0.93 * SQ, y + th]);
			const ai = a * 0.93;
			X.col.box(S.x, S.z, S.yaw, ai, ai, S.y + y + th, { site: S.id });
		}
		prof.push([0, tiers * th]);
		K.add('body', F.put(lathe(prof, 4, true, Math.PI / 4)), { glow: 1 });
		for (let k = 0; k < tiers; k++) { const a = (a0 + (aTop - a0) * k / (tiers - 1)) * 0.93 + 0.5; K.add('glow', F.put(lathe([[a * SQ, 0], [a * SQ + 0.1, 0], [a * SQ + 0.1, 0.45], [a * SQ, 0.45]], 4, true, Math.PI / 4), 0, k * th + th - 0.5, 0), {}); }
		const top = tiers * th, run = top / 1.05, z0 = aTop, z1 = aTop + run;
		// the stair: steps you can see, a slope you walk
		const nSt = Math.round(top / 0.7);
		for (let i = 0; i < nSt; i++) { const y = (i + 1) * top / nSt, z = z1 - (i + 1) * run / nSt; K.add('body', F.put(box(7, y - Math.max(0, y - 3), run / nSt + 0.02), 0, y - Math.min(y, 3) / 2, z + run / nSt / 2), {}); }
		K.add('body', wedge(7.2, z0 - 1, z1, top - 1.2, -3, S.g0 - S.y - 3).applyMatrix4(new THREE.Matrix4().makeRotationY(F.yaw).setPosition(F.x, F.y, F.z)), {});
		for (const sx of [-1, 1]) {
			K.add('trim', strut(F.p(sx * 4, top + 0.8, z0), F.p(sx * 4, 0.8, z1), 1, 1.6, true), {});
			K.add('glow', line(F.p(sx * 4, top + 1.65, z0), F.p(sx * 4, 1.65, z1), 0.14), {});
		}
		X.col.ramp(F.x, F.z, F.yaw, 3.5, z0 - 2, z1 + 0.5, S.y + top, S.y - 0.3, S.id, true);
		// the stele: a tapered shaft, bronze rings round it, a gold cap
		const hs = H - top;
		const sp = [[0, 0], [9 * SQ, 0], [9 * SQ, 2.5], [7.6 * SQ, 4], [3.6 * SQ, hs - 10], [0, hs]];
		K.add('body', F.put(lathe(sp, 4, true, Math.PI / 4), 0, top, 0), { glow: 1 });
		K.add('trim', F.put(lathe([[3.62 * SQ, 0], [0, 10]], 4, true, Math.PI / 4), 0, top + hs - 10, 0), {});
		for (const t of [0.22, 0.44, 0.63, 0.78]) {
			const w = 7.6 + (3.6 - 7.6) * t;
			K.add('trim', F.put(ring((w + 1.4) * SQ, 2.8, 3, 4), 0, top + 3 + t * (hs - 13), 0, Math.PI / 4), {});
			K.add('glow', F.put(ring((w + 2.85) * SQ, 0.12, 0.8, 4), 0, top + 4.1 + t * (hs - 13), 0, Math.PI / 4), {});
		}
		edgeLines(X, F.sub(0, top, 0), sp.slice(3, 5), 4, Math.PI / 4, 0.2);
		X.col.box(S.x, S.z, S.yaw, 9, 9, S.y + H, { site: S.id, floor: false });
		// four sun dishes at the corners of the top
		for (let k = 0; k < 4; k++) {
			const a = Math.PI / 4 + k / 4 * TAU, q = rad(F, aTop * 0.8 * SQ, top, a);
			K.add('trim', prism(6, 0.4, 0.3, 3.5).translate(q.x, q.y, q.z), {});
			K.add('glass', dish(3.4, 0.9).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.5).premultiply(new THREE.Matrix4().makeRotationY(F.yaw + a)).setPosition(q.x, q.y + 4.2, q.z)), {});
		}
		X.beam(F.p(0, H, 0), 700, 1.6, 14, 1, SUN.beam);
	},
	complex(X, S) {
		const F = foundation(X, S, { mat: 'body' }), K = X.K, a = S.r * 0.62;
		// four wind-traps: battered shafts rising to hoods turned out to the wind, their
		// mouths glowing, bronze running up their arrises
		for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			const T = F.sub(sx * a, 0, sz * a), h = 44, w0 = 5.5, w1 = 3.2, out = Math.atan2(sx, sz);
			K.add('body', T.put(lathe([[0, 0], [w0 * SQ, 0], [w1 * SQ, h], [0, h]], 4, true, Math.PI / 4)), { glow: 1 });
			for (let k = 0; k < 4; k++) { const c = Math.PI / 4 + k / 4 * TAU; K.add('trim', strut(rad(T, w0 * SQ + 0.2, 0, c), rad(T, w1 * SQ + 0.2, h, c), 0.7, 0.7, true), {}); }
			K.add('body', fin(T.sub(0, h - 3, 0), [[-4.5, 0], [9, 7], [9.5, 10.5], [-4.5, 5]], 6.4, out, 0.4), {});
			K.add('glow', T.put(box(5.4, 2.6, 0.3), 8.4 * Math.sin(out), h + 3.6, 8.4 * Math.cos(out), out), { tint: [1.4, 1.2, 1] });
			const q = T.p(0, 0, 0);
			X.col.box(q.x, q.z, F.yaw, w0, w0, S.y + h, { site: S.id });
		}
		// the mirrors: a spiral of heliostats, each turned to throw the noon sun onto the receiver
		const rc = F.p(0, 20, 0), sun = V3(0.15, 1, 0.3).normalize();
		K.add('body', F.put(prism(4, 2.4 * SQ, 1.6 * SQ, 18, 0, 0.3), 0, 0, 0, Math.PI / 4), { glow: 1 });
		K.add('glow', F.put(lathe([[0, 0], [1.6, 0], [2.2, 2.6], [0, 2.6]], 8, true), 0, 18, 0), { tint: [1.6, 1.4, 1.2] });
		X.col.disc(rc.x, rc.z, 2.6, S.y + 20, { site: S.id, floor: false });
		const nM = Math.round(14 * X.det);
		for (let i = 0; i < nM; i++) {
			const t = i / nM, ang = t * TAU * 1.5, rr = 9 + t * 13, q = rad(F, rr, 0, ang);
			if (Math.abs(rr * Math.sin(ang)) > a - 7 && Math.abs(rr * Math.cos(ang)) > a - 7) continue;
			K.add('trim', prism(6, 0.5, 0.35, 1.3).translate(q.x, q.y, q.z), {});
			const n = rc.clone().sub(V3(q.x, q.y + 1.8, q.z)).normalize().add(sun).normalize();
			const mm = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n)).setPosition(q.x, q.y + 1.8, q.z);
			K.add('glass', cbox(4.6, 0.16, 3.2, 0.06).applyMatrix4(mm), {});
			K.add('trim', cbox(4.9, 0.14, 3.5, 0.05).translate(0, -0.15, 0).applyMatrix4(mm), {});
			X.col.disc(q.x, q.z, 1.6, S.y + 2.4, { site: S.id, floor: false });
		}
		X.beam(F.p(0, 20.6, 0), 180, 1.2, 4, 1, SUN.beam);
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3 * SQ, sides: 4, phi: Math.PI / 4, noRamp: true, mat: 'body' }), K = X.K, h = 14 + X.r() * 8;
		const sp = [[0, 0], [1.8 * SQ, 0], [1.2 * SQ, h - 2.4], [0, h]];
		K.add('body', F.put(lathe(sp, 4, true, Math.PI / 4)), { glow: 1 });
		K.add('trim', F.put(lathe([[1.23 * SQ, 0], [0, 2.4]], 4, true, Math.PI / 4), 0, h - 2.4, 0), {});
		for (const t of [0.35, 0.62]) K.add('trim', F.put(ring((1.8 - 0.6 * t + 0.5) * SQ, 1, 1, 4), 0, t * h, 0, Math.PI / 4), {});
		X.col.box(S.x, S.z, S.yaw, 1.8, 1.8, S.y + h, { site: S.id, floor: false });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 9, sides: 4, phi: Math.PI / 4, noRamp: true, mat: 'body' }), K = X.K, h = 15;
		for (const sx of [-1, 1]) {
			K.add('body', F.put(lathe([[0, 0], [2.6 * SQ, 0], [1.8 * SQ, h], [0, h]], 4, true, Math.PI / 4), sx * 5.2, 0, 0), { glow: 1 });
			const q = F.p(sx * 5.2, 0, 0);
			X.col.box(q.x, q.z, S.yaw, 2.4, 2.4, S.y + h, { site: S.id, floor: false });
		}
		K.add('trim', F.put(cbox(15, 1.8, 3.4, 0.3), 0, h + 0.9, 0), {});
		K.add('trim', F.put(ring(2.6, 0.7, 0.6, 32), 0, h + 4.4, -0.3, 0, Math.PI / 2), {});
		K.add('glow', F.put(lathe([[0, 0], [2.2, 0], [2.2, 0.2], [0, 0.2]], 32, true), 0, h + 4.4, -0.2, 0, Math.PI / 2), { tint: [1.3, 1.2, 1] });
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 4 * SQ, sides: 4, phi: Math.PI / 4, noRamp: true, mat: 'body' }), K = X.K, h = 9;
		for (let k = 0; k < 3; k++) K.add('trim', leanOut(F, prism(6, 0.3, 0.25, h + 0.6), 3, 0, k / 3 * TAU, -0.3), {});
		K.add('glass', dish(4, 1.1).translate(0, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(0.25)).applyMatrix4(new THREE.Matrix4().makeRotationY(S.yaw).setPosition(S.x, S.y + h, S.z)), {});
		K.add('glow', F.put(blob(0.5, 0.5, 0.5, 6), 0, h + 3.4, 0), { tint: [1.6, 1.5, 1.2] });
		X.beam(F.p(0, h + 3.4, 0), 250, 0.5, 3, 1, SUN.beam);
		X.col.disc(S.x, S.z, 3, S.y + 3, { site: S.id, floor: false });
	},
	post(X, F, x, y, z, h) { X.K.add('body', F.put(lathe([[0, 0], [0.35 * SQ, 0], [0.22 * SQ, h], [0, h + 0.4]], 4, true, Math.PI / 4), x, y, z), { near: true }); },
};
// a shallow dish of mirror, rim r, depth d (its face up, thickness given by a back)
function dish(r, d, sides = 24) {
	const P = [];
	for (let i = 0; i <= 6; i++) { const t = i / 6; P.push([r * t, d * t * t]); }
	for (let i = 6; i >= 0; i--) { const t = i / 6; P.push([r * t * 0.98, d * t * t - 0.18 - (1 - t) * 0.2]); }
	return lathe(P.reverse(), sides, false);
}

// ===== the Glassmakers =====
const GLASS = {
	key: 'glass', people: 'the Glassmakers', sides: 8,
	base: { landmark: {}, complex: { rampAt: [0] } },
	syl: ['iss', 'ka', 'vael', 'fro', 'ny', 'saa', 'ri', 'hel', 'mi', 'tor'],
	nouns: { landmark: 'Lattice Tower', complex: 'Frost Domes', marker: 'Aurora Mast', gate: 'Glass Gate', beacon: 'Lamp Prism', platform: 'Glass Ledge', bridge: 'Glass Span' },
	glow: [0.35, 1.0, 0.85], beam: [0.4, 0.9, 1.0],
	mats: {
		body: { color: [0.8, 0.88, 0.95], rough: 0.22, metal: 0.05, clearcoat: 1, seam: 0, seamK: 0.45, rim: 0.4, rimC: [0.5, 0.8, 1.0] },
		trim: { color: [0.62, 0.68, 0.74], rough: 0.28, metal: 0.9, seam: 0, seamK: 1.2 },
		glass: { color: [0.62, 0.82, 0.95], rough: 0.05, metal: 0, iridescence: 0.6, opacity: 0.38, seam: 3, seamK: 0.4, rim: 1.2, rimC: [0.5, 0.9, 1.0] },
	},
	landmark(X, S) {
		const F = foundation(X, S, { glyph: true }), K = X.K, H = S.h, n = Math.round(14 * Math.max(0.75, X.det)), Ht = H * 0.84;
		// a twisted crystal: hexagonal rings turning hard as they rise, their ribs spiralling,
		// every other facet glazed with ice-glass so the glazing winds up it in bands
		const P = [], rAt = (t) => 30 * Math.pow(1 - t, 0.7) * (1 + 0.18 * Math.sin(Math.PI * t * 1.4)) + 3;
		for (let k = 0; k <= n; k++) {
			const t = k / n, y = Ht * t, tw = k * 0.36, row = [];
			for (let i = 0; i < 6; i++) row.push(rad(F, rAt(t), y, tw + i / 6 * TAU));
			P.push(row);
		}
		const pane = [];
		for (let k = 0; k <= n; k++) for (let i = 0; i < 6; i++) {
			const a = P[k][i], b = P[k][(i + 1) % 6];
			K.add('body', strut(a, b, 1.1, 1.4, true), {});
			if (k < n) {
				K.add('trim', strut(a, P[k + 1][i], 1.8, 1.8, true), {});
				if ((i + k) % 3 === 0) { const c = P[k + 1][(i + 1) % 6], d = P[k + 1][i]; pane.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); }
			}
		}
		const pg = new THREE.BufferGeometry();
		pg.setAttribute('position', new THREE.Float32BufferAttribute(pane, 3));
		pg.computeVertexNormals();
		K.add('glass', pg, {});
		for (let k = 0; k <= n; k += 2) glowRing(X, F, rAt(k / n) * 0.87, Ht * k / n + 0.8, 0.22);
		// ice shards breaking out of its foot and a crown of blades round its head
		for (let k = 0; k < 9; k++) K.add('glass', leanOut(F, shard(2.2 + X.r() * 1.5, 14 + X.r() * 16, 6, X.r), 26 + X.r() * 6, -1, (k + X.r() * 0.5) / 9 * TAU, 0.25 + X.r() * 0.3), { glow: 2 });
		for (let k = 0; k < 6; k++) K.add('glass', leanOut(F, shard(1.4, 26 + X.r() * 10, 6, X.r), rAt(1) + 1, Ht - 4, n * 0.36 + k / 6 * TAU, 0.35), {});
		// the core: a column of ice-glass, a light rising in it
		const cp = [[0, 0], [8, 0], [6.5, Ht * 0.5], [3.4, Ht], [1, H], [0, H + 2]];
		K.add('glass', F.put(lathe(cp, 6, true)), {});
		K.add('glow', F.put(lathe([[0, 0], [2, 0], [1.5, Ht * 0.6], [0.6, Ht], [0, H]], 6, true)), { tint: [0.8, 0.9, 1.0] });
		// antennae off the top, and the aurora they hold
		for (let k = 0; k < 3; k++) {
			const th = k / 3 * TAU + 0.3, a = rad(F, 3, Ht, th), b = rad(F, 12, H + 30, th);
			K.add('trim', strut(a, b, 0.5, 0.5, true), {});
			K.add('glow', blob(0.7, 0.7, 0.7, 6).translate(b.x, b.y, b.z), {});
		}
		X.aurora(F.p(0, Ht - 20, 0), 64, 0, TAU * 0.8, 190);
		X.beam(F.p(0, H, 0), 700, 1.5, 12, 1, GLASS.beam);
		X.col.disc(S.x, S.z, 8, S.y + H, { site: S.id, floor: false });
		for (let i = 0; i < 6; i++) { const q = P[0][i]; X.col.disc(q.x, q.z, 1.4, S.y + 20, { site: S.id, floor: false }); }
	},
	complex(X, S) {
		const F = foundation(X, S), K = X.K, R = 17, det = X.det > 0.8 ? 2 : 1;
		const domeAt = (lx, lz, R, door) => {
			const G = F.sub(lx, 0, lz), skip = door ? (a, b) => (a.z + b.z) / 2 > R * 0.55 && (a.y + b.y) / 2 < R * 0.5 : null;
			K.add('trim', G.put(geodesicCut(R, det, 0.35, skip)), {});
			K.add('glass', G.put(geoPanesCut(R, det, skip)), {});
			K.add('body', G.put(ring(R, 1.4, 1.2, 40)), {});
			glowRing(X, G, R + 0.75, 1.1, 0.2);
			return G;
		};
		const G = domeAt(0, 0, R, true);
		// the door, where the panes are left out; a column of light inside
		const dp = [];
		for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; dp.push(G.p(Math.cos(a) * 5.4, Math.sin(a) * 7.5, R * 0.9)); }
		K.add('body', sweep(dp, 0.5, 6, { step: 0.8 }), {});
		K.add('glow', F.put(lathe([[0, 0], [1.4, 0], [1.1, 7], [0, 7.5]], 6, true)), { tint: [0.7, 0.8, 1] });
		X.col.disc(S.x, S.z, 1.5, S.y + 7, { site: S.id, floor: false });
		const N = 18;
		for (let i = 0; i < N; i++) {
			const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2;
			if (Math.cos(am) > 0.93) continue;
			X.col.seg(rad(F, R, 0, a0), rad(F, R, 0, a1), 0.6, S.y + R * 0.6, S.id);
		}
		for (const [lx, lz, rr] of [[-S.r * 0.62, -S.r * 0.3, 9], [S.r * 0.6, -S.r * 0.35, 7.5]]) {
			domeAt(lx, lz, rr, false);
			const q = F.p(lx, 0, lz);
			X.col.disc(q.x, q.z, rr, S.y + rr, { site: S.id, floor: false });
		}
		// aurora masts
		for (const sx of [-1, 1]) {
			const q = F.sub(sx * S.r * 0.55, 0, S.r * 0.45);
			GLASS.mast(X, q, 22);
			X.col.disc(q.x, q.z, 1, S.y + 22, { site: S.id, floor: false });
		}
	},
	mast(X, F, h) {
		const K = X.K;
		K.add('trim', F.put(prism(6, 0.6, 0.25, h, 1.5)), {});
		for (const t of [0.4, 0.62, 0.8]) { K.add('trim', F.put(ring(2.4 - t * 1.4, 0.3, 0.3, 6), 0, h * t, 0), {}); K.add('glow', F.put(ring(2.4 - t * 1.4, 0.1, 0.34, 6), 0, h * t + 0.05, 0), {}); }
		K.add('glow', F.put(blob(0.5, 0.5, 0.5, 6), 0, h + 1.5, 0), { tint: [1.4, 1.4, 1.4] });
		X.aurora(F.p(0, h * 0.6, 0), 7, 0, TAU * 0.7, 26);
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3, sides: 8, noRamp: true }), h = 16 + X.r() * 6;
		GLASS.mast(X, F, h);
		X.col.disc(S.x, S.z, 1, S.y + h, { site: S.id, floor: false });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 7, sides: 8, noRamp: true }), K = X.K, h = 14;
		for (const sx of [-1, 1]) {
			const G = F.sub(sx * 5, 0, 0), P = [];
			for (let k = 0; k <= 5; k++) { const row = []; for (let i = 0; i < 3; i++) row.push(rad(G, 1.6, k * h / 5, k * 0.5 + i / 3 * TAU)); P.push(row); }
			for (let k = 0; k <= 5; k++) for (let i = 0; i < 3; i++) { K.add('trim', strut(P[k][i], P[k][(i + 1) % 3], 0.3), {}); if (k < 5) { K.add('trim', strut(P[k][i], P[k + 1][i], 0.4), {}); K.add('trim', strut(P[k][i], P[k + 1][(i + 1) % 3], 0.2), {}); } }
			K.add('glass', G.put(prism(6, 0.9, 0.7, h)), {});
			X.col.disc(G.x, G.z, 1.8, S.y + h, { site: S.id, floor: false });
		}
		K.add('glass', F.put(cbox(13.5, 1.6, 2.4, 0.3), 0, h + 0.8, 0), {});
		K.add('glow', F.put(box(12, 0.12, 0.12), 0, h + 0.2, 0), {});
		X.aurora(F.p(0, h + 2, 0), 6, Math.PI * 0.1, Math.PI * 0.9, 16);
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 3.2, sides: 8, noRamp: true }), K = X.K, h = 8;
		K.add('glass', F.put(lathe([[0, 0], [1.8, 0], [2.2, h * 0.7], [0, h]], 8, true)), {});
		K.add('glow', F.put(lathe([[0, 0], [0.7, 0], [0.8, h * 0.7], [0, h * 0.95]], 8, true)), { tint: [1.2, 1.3, 1.4] });
		X.beam(F.p(0, h, 0), 260, 0.6, 4, 1, GLASS.beam);
		X.col.disc(S.x, S.z, 2, S.y + h, { site: S.id, floor: false });
	},
	post(X, F, x, y, z, h) { X.K.add('glass', F.put(prism(4, 0.3, 0.22, h, 0.4), x, y, z), { near: true }); },
};
// a geodesic dome's struts or panes, with an opening where skip says
function geodesicCut(R, detail, w, skip) {
	if (!skip) return geodesic(R, detail, w);
	const g = geodesic(R, detail, w), p = g.attributes.position, keep = [];
	// struts are 36 vertices each: keep those whose middle is not in the opening
	const A = new THREE.Vector3(), B = new THREE.Vector3();
	for (let i = 0; i < p.count; i += 36) {
		A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 35);
		if (!skip(A, B)) keep.push(i);
	}
	const P = new Float32Array(keep.length * 108), N = new Float32Array(keep.length * 108), n = g.attributes.normal;
	keep.forEach((s, j) => { P.set(p.array.subarray(s * 3, s * 3 + 108), j * 108); N.set(n.array.subarray(s * 3, s * 3 + 108), j * 108); });
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.BufferAttribute(P, 3));
	out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
	g.dispose();
	return out;
}
function geoPanesCut(R, detail, skip) {
	const g = geoPanes(R, detail);
	if (!skip) return g;
	const p = g.attributes.position, P = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
	for (let i = 0; i < p.count; i += 3) {
		A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
		if (skip(A, B) || skip(B, C)) continue;
		P.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z);
	}
	const out = new THREE.BufferGeometry();
	out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	out.computeVertexNormals();
	g.dispose();
	return out;
}

// ===== the Forgewrights =====
const FORGE = {
	key: 'forge', people: 'the Forgewrights', sides: 6,
	base: { landmark: { rampAt: [0, 1, 2, 3, 4, 5].map((k) => (k + 0.5) / 6 * TAU) }, complex: { phi: 0, rampAt: [0] } },
	syl: ['durn', 'ka', 'gor', 'mak', 'thul', 'az', 'rok', 'bar', 'ek', 'vul'],
	nouns: { landmark: 'Forge Spire', complex: 'Forge Citadel', marker: 'Blade', gate: 'Blade Gate', beacon: 'Heat Vent', platform: 'Forge Ledge', bridge: 'Basalt Span' },
	glow: [1.0, 0.4, 0.1], beam: [1.0, 0.45, 0.15],
	mats: {
		body: { color: [0.12, 0.11, 0.105], rough: 0.78, metal: 0.05, seam: 3, seamK: 0.35, rim: 0.12, rimC: [1.0, 0.35, 0.1] },
		trim: { color: [0.03, 0.028, 0.03], rough: 0.06, metal: 0.55, clearcoat: 1, ccRough: 0.04, seam: 3, seamK: 0.15, rim: 0.2, rimC: [1.0, 0.4, 0.15] },
		glass: { color: [0.05, 0.04, 0.04], rough: 0.05, metal: 0.4, clearcoat: 1, seam: 3, seamK: 0.3, rim: 0.6, rimC: [1.0, 0.35, 0.1] },
	},
	// a basalt column: hexagonal, its head broken off to a point as the rock cleaves,
	// lava light running up two of its faces and a band of it under the head
	column(X, F, x, z, r, h, glyph, tip = r * 0.9) {
		const K = X.K, p = [[0, 0], [r, 0], [r, h], [0, h + tip]], G = F.sub(x, 0, z);
		K.add('body', G.put(lathe(p, 6, true, 0)), { glow: glyph ? 1 : 0 });
		for (const th of [Math.PI / 6, Math.PI * 7 / 6]) K.add('glow', line(rad(G, r * 0.87 + 0.08, 0.3, th), rad(G, r * 0.87 + 0.08, h - 1.5, th), Math.max(0.35, r * 0.1)), { tint: [1.3, 1.1, 1] });
		K.add('glow', G.put(lathe([[r + 0.06, 0], [r + 0.12, 0], [r + 0.12, 0.7], [r + 0.06, 0.7]], 6, true, 0), 0, h - 2.6, 0), {});
		X.col.disc(G.x, G.z, r * 0.93, F.y + h, { site: F.site, floor: true });
	},
	landmark(X, S) {
		const F = foundation(X, S, { mat: 'body', glyph: true }), K = X.K, H = S.h, r = X.r;
		F.site = S.id;
		// a crowd of basalt columns, the tallest in the middle, their heads cleaved to points
		const cols = [[0, 0, 8, H * 0.94, H * 0.06]];
		for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; cols.push([Math.sin(a) * 13.5, Math.cos(a) * 13.5, 6.4, H * (0.48 + r() * 0.3), 6 + r() * 10]); }
		for (let k = 0; k < 7; k++) { const a = (k + 0.4) / 7 * TAU; cols.push([Math.sin(a) * 24, Math.cos(a) * 24, 4.8, H * (0.14 + r() * 0.22), 3 + r() * 6]); }
		cols.forEach(([x, z, rr, h, tip], i) => FORGE.column(X, F, x, z, rr, h, i > 6, tip));
		// obsidian blades cut out into the air from the upper columns, rising as they reach
		for (let k = 0; k < 6; k++) {
			const [x, z, , h] = cols[1 + k], th = Math.atan2(x, z) + (r() - 0.5) * 0.4, len = 42 + r() * 26, y = h - 10 - r() * 10, up = 10 + r() * 16;
			const G = F.sub(x, y, z);
			K.add('trim', fin(G, [[-5, -3], [len, up], [len - 4, up + 1.4], [-5, 7]], 2, th, 0.3), {});
			K.add('glow', line(rad(G, 0, 1.8, th), rad(G, len - 5, up + 0.3, th), 0.3), {});
		}
		// the head: a crucible of obsidian, glowing, heat going up out of it
		K.add('trim', F.put(lathe([[3, 0], [9.5, 0], [11, 6], [8, 6], [3, 1]], 6, true), 0, H * 0.94 - 1, 0), {});
		K.add('glow', F.put(lathe([[0, 0], [8.4, 0], [8.4, 0.3], [0, 0.3]], 6, true), 0, H * 0.94 + 3.5, 0), { tint: [1.6, 1.2, 0.9] });
		X.beam(F.p(0, H * 0.94 + 4, 0), 500, 6, 20, 1, FORGE.beam);
		// channels of light in the platform, running out from the foot
		for (let k = 0; k < 6; k++) { const th = (k + 0.5) / 6 * TAU; K.add('glow', line(rad(F, 27, 0.05, th), rad(F, S.r * 0.95, 0.05, th), 0.8), {}); }
	},
	complex(X, S) {
		const F = foundation(X, S, { mat: 'body' }), K = X.K, R = S.r * 0.78, r = X.r;
		F.site = S.id;
		// six bastions of clustered columns, battered walls between them bristling with
		// obsidian spines, a gate under a blade in the front wall
		const B = [];
		for (let k = 0; k < 6; k++) B.push([Math.sin(k / 6 * TAU + Math.PI / 6) * R, Math.cos(k / 6 * TAU + Math.PI / 6) * R]);
		for (let k = 0; k < 6; k++) {
			const [x, z] = B[k], [x1, z1] = B[(k + 1) % 6], bo = Math.atan2(x, z);
			for (const [dr, da, rr, h] of [[0, 0, 3.4, 24 + r() * 6], [2.6, 1.9, 2.6, 15 + r() * 5], [2.6, -1.9, 2.4, 11 + r() * 5]]) {
				const q = [x + Math.sin(bo + da) * dr, z + Math.cos(bo + da) * dr];
				FORGE.column(X, F, q[0], q[1], rr, h, dr === 0, 2 + r() * 4);
			}
			const G0 = F.sub(x, 20, z);
			for (const da of [-0.7, 0, 0.7]) K.add('trim', fin(G0, [[0, -2], [9, 7], [8, 8.5], [0, 3]], 0.8, bo + da, 0.15), {});
			const a = V3(x, 0, z), b = V3(x1, 0, z1), len = a.distanceTo(b), ang = Math.atan2(x1 - x, z1 - z), mx = (x + x1) / 2, mz = (z + z1) / 2, out = Math.atan2(mx, mz);
			const front = Math.abs(ang - Math.PI / 2) < 0.1 || Math.abs(ang + Math.PI / 2) < 0.1 ? mz > 0 : false;
			const parts = front ? [[-len / 2 + 4, -5], [5, len / 2 - 4]] : [[-len / 2 + 4, len / 2 - 4]];
			for (const [u0, u1] of parts) {
				const G = F.sub(mx, 0, mz, ang), wl = u1 - u0;
				K.add('body', wedge(3.4, u0, u1, 11, 11, -1).applyMatrix4(new THREE.Matrix4().makeRotationY(G.yaw).setPosition(G.x, G.y, G.z)), {});
				K.add('body', G.put(cbox(4.6, 3, wl, 0.4), 0, 1.5, (u0 + u1) / 2), { glow: 1 });
				K.add('glow', G.put(box(0.3, 0.5, wl - 1), 0, 9.6, (u0 + u1) / 2).translate(Math.sin(out + F.yaw) * 1.75, 0, Math.cos(out + F.yaw) * 1.75), {});
				for (let i = 0; i < Math.floor(wl / 3.2); i++) { const q = G.p(0, 11, u0 + 1.6 + i * 3.2); K.add('trim', fin(frame(q.x, q.y, q.z, 0), [[-0.5, -1], [1.5, -1], [4.5, 4 + (i % 2) * 2]], 0.5, out + F.yaw, 0.08), {}); }
				X.col.seg(G.p(0, 0, u0), G.p(0, 0, u1), 1.8, S.y + 11, S.id);
			}
			if (front) {
				const G = F.sub(mx, 0, mz, ang);
				K.add('trim', fin(G.sub(0, 12, 0), [[-9, -1], [9, -1], [11, 4], [0, 9], [-11, 4]], 2.4, 0, 0.3), {});
				K.add('glow', G.put(box(0.4, 0.4, 10), 0, 11.2, 0), { tint: [1.4, 1.2, 1] });
			}
		}
		// the forge in the court: a truncated pyramid, its crucible glowing, blades round it
		K.add('body', F.put(prism(6, 10, 6.5, 9, 0, 0.5)), { glow: 1 });
		K.add('glow', F.put(lathe([[0, 0], [5.8, 0], [5.8, 0.3], [0, 0.3]], 6, true), 0, 9, 0), { tint: [1.6, 1.2, 0.9] });
		for (let k = 0; k < 6; k++) K.add('trim', fin(F.sub(0, 6, 0), [[5, 0], [12, 10], [11, 11.5], [4.5, 4]], 0.7, k / 6 * TAU, 0.12), {});
		X.beam(F.p(0, 9.3, 0), 160, 3, 8, 1, FORGE.beam);
		X.col.disc(S.x, S.z, 9.5, S.y + 9, { site: S.id });
		for (let k = 0; k < 6; k++) { const th = k / 6 * TAU; K.add('glow', line(rad(F, 10.5, 0.05, th), rad(F, R - 5, 0.05, th), 0.6), {}); }
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3.5, mat: 'body', noRamp: true }), K = X.K, h = 12 + X.r() * 8;
		K.add('trim', fin(F, [[-1.6, -1], [1.6, -1], [0.4, h]], 0.9, 0, 0.2), {});
		for (const sx of [-1, 1]) K.add('glow', line(F.p(sx * 0.62, 0.5, 0), F.p(sx * 0.62, h - 2, 0.35), 0.16), {});
		X.col.box(S.x, S.z, S.yaw, 0.7, 1.7, S.y + h, { site: S.id, floor: false });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 8, mat: 'body', noRamp: true }), K = X.K;
		F.site = S.id;
		for (const sx of [-1, 1]) FORGE.column(X, F, sx * 5.5, 0, 2.6, 14 + sx, true);
		K.add('trim', fin(F.sub(0, 13, 0), [[-10, 0], [10, 0.6], [11, 2.2], [-9, 3]], 1.6, Math.PI / 2, 0.2), {});
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 4, mat: 'body', noRamp: true }), K = X.K, h = 10;
		K.add('body', F.put(prism(6, 3, 2.2, h, 0, 0.3)), { glow: 1 });
		K.add('glow', F.put(lathe([[0, 0], [1.7, 0], [1.7, 0.3], [0, 0.3]], 6, true), 0, h, 0), { tint: [1.6, 1.2, 0.9] });
		X.beam(F.p(0, h + 0.3, 0), 200, 1.5, 6, 1, FORGE.beam);
		X.col.disc(S.x, S.z, 3, S.y + h, { site: S.id, floor: true });
	},
	post(X, F, x, y, z, h) { X.K.add('trim', F.put(fin(frame(0, 0, 0, 0), [[-0.4, 0], [0.4, 0], [0.1, h]], 0.3, 0, 0.05), x, y, z), { near: true }); },
};

// ===== the Growers =====
const GROWN = {
	key: 'grown', people: 'the Growers', sides: 20,
	base: { landmark: { sides: 24 }, complex: { sides: 24, rampAt: [0] } },
	syl: ['lo', 'wen', 'ma', 'hul', 'ae', 'syl', 'oru', 'ne', 'ta', 'ven'],
	nouns: { landmark: 'Grown Spire', complex: 'Amphitheatre', marker: 'Seed Pod', gate: 'Shell Arch', beacon: 'Bloom', platform: 'Lily Ledge', bridge: 'Root Bridge', stilt: 'Tidal Pylon' },
	glow: [0.35, 1.0, 0.82], beam: [0.4, 1.0, 0.85],
	mats: {
		body: { color: [0.88, 0.86, 0.8], rough: 0.4, metal: 0.05, iridescence: 0.7, clearcoat: 0.4, seam: 2, seamK: 1.4 },
		trim: { color: [0.44, 0.48, 0.42], rough: 0.85, metal: 0, seam: 1, seamK: 0.4 },
		glass: { color: [0.82, 0.95, 0.9], rough: 0.2, metal: 0, iridescence: 1, opacity: 0.55, seam: 2, seamK: 0.6, rim: 1.0, rimC: [0.4, 1.0, 0.85] },
	},
	landmark(X, S) {
		const F = foundation(X, S, { mat: 'trim', smooth: true }), K = X.K, H = S.h, n = 7;
		// ribs grown up in a twist from a wide root, drawn in to a waist, flaring out again
		// into a bloom whose tips curl back; pearl membranes stretched between them up top
		const ribR = (t) => t < 0.42 ? THREE.MathUtils.lerp(S.r * 0.9, 9, Math.sin(t / 0.42 * Math.PI / 2)) : 9 + (S.r * 0.95 - 9) * Math.sin(Math.min(1, (t - 0.42) / 0.5) * Math.PI / 2) - (t > 0.92 ? (t - 0.92) * 90 : 0);
		const ribs = [];
		for (let k = 0; k < n; k++) {
			const pts = [];
			for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(rad(F, ribR(t), t * H - (i === 0 ? 3 : 0), k / n * TAU + t * 1.3)); }
			ribs.push(pts);
			K.add('body', sweep(pts, (t) => 2.4 * (1 - 0.45 * t), 8, { sx: 0.9, sy: 2.4, step: 2 }), { glow: 1 });
			X.col.disc(pts[0].x, pts[0].z, 3.4, S.y + 20, { site: S.id, floor: false });
		}
		const mem = [];
		for (let k = 0; k < n; k++) for (let i = 9; i < 15; i++) {
			const a = ribs[k][i], b = ribs[(k + 1) % n][i], c = ribs[(k + 1) % n][i + 1], d = ribs[k][i + 1];
			mem.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
		}
		const mg = new THREE.BufferGeometry();
		mg.setAttribute('position', new THREE.Float32BufferAttribute(mem, 3));
		mg.computeVertexNormals();
		K.add('glass', mg, { glow: 2 });
		// the stalk up the middle, a seed of light held in the bloom
		K.add('body', F.put(lathe([[0, 0], [7, 0], [5.2, 6], [4, 0.3 * H], [3, 0.62 * H], [0, 0.7 * H]], 24, false)), {});
		K.add('glass', F.put(blob(6, 9, 6, 14), 0, 0.72 * H, 0), { glow: 2 });
		for (const t of [0.2, 0.42]) glowRing(X, F, ribR(t) * 0.99, t * H, 0.3);
		// the crown: a ring hung over the top
		const cp = F.p(0, H + 8, 0);
		K.add('body', F.put(ring(8, 1.6, 1.6, 32, false), 0, H + 7, 0, 0, 0.3), { spin: [cp.x, cp.y, cp.z, 0.08] });
		K.add('glow', F.put(ring(8, 0.4, 1.9, 32), 0, H + 6.85, 0, 0, 0.3), { spin: [cp.x, cp.y, cp.z, 0.08] });
		if (X.rings) {
			const hp = F.p(0, 0.45 * H, 0);
			K.add('trim', F.put(ring(S.r * 1.25, 3, 0.5, 64), 0, 0.45 * H, 0, 0, 0.22, 0.1), { spin: [hp.x, hp.y, hp.z, 0.02] });
			K.add('glow', F.put(ring(S.r * 1.25 + 1.7, 0.3, 0.55, 64), 0, 0.45 * H, 0, 0, 0.22, 0.1), { spin: [hp.x, hp.y, hp.z, 0.02] });
		}
		X.beam(F.p(0, H, 0), 700, 1.5, 12, 1, GROWN.beam);
		X.col.disc(S.x, S.z, 7, S.y + H, { site: S.id, floor: false });
	},
	complex(X, S) {
		const F = foundation(X, S, { mat: 'trim', smooth: true }), K = X.K, span = TAU * 0.62, ph = Math.PI - span / 2;
		// terraces of living stone in a horseshoe round a stage
		for (let k = 0; k < 5; k++) {
			const r0 = 13 + k * 4, r1 = r0 + 4, y = 0.8 * (k + 1);
			K.add('trim', F.put(lathe([[r1, -1], [r1, y - 0.15], [r1 - 0.15, y], [r0, y], [r0, -1]], 40, true, ph, span)), { glow: k === 4 ? 1 : 0 });
			K.add('glow', F.put(lathe([[r0 + 0.02, y - 0.3], [r0 - 0.06, y - 0.3], [r0 - 0.06, y - 0.2], [r0 + 0.02, y - 0.2]], 40, true, ph, span)), {});
			X.col.ring(S.x, S.z, r0, r1, S.y + y, F.yaw + ph, span, S.id);
		}
		X.col.seg(rad(F, 33, 0, ph), rad(F, 33, 0, ph + span * 0.5), 1, S.y + 4, S.id);
		X.col.seg(rad(F, 33, 0, ph + span * 0.5), rad(F, 33, 0, ph + span), 1, S.y + 4, S.id);
		K.add('body', F.put(lathe([[0, 0.5], [9.5, 0.5], [10, 0.2], [10, -1], [0, -1]], 40, false)), {});
		glowRing(X, F, 9.8, 0.35, 0.2);
		X.col.disc(S.x, S.z, 10, S.y + 0.5, { site: S.id, solid: false });
		// three shells arching over the stage from the back of the terraces
		for (let k = 0; k < 5; k++) {
			const a0 = ph + span * (0.06 + k * 0.08), a1 = a0 + Math.PI * 0.7 + k * 0.12, pts = [];
			for (let i = 0; i <= 10; i++) {
				const t = i / 10, a = a0 + (a1 - a0) * t, rr = 34 - Math.sin(Math.PI * t) * (20 - k * 3);
				pts.push(rad(F, rr, Math.sin(Math.PI * t) * (26 - k * 2.5) - 1, a));
			}
			K.add('body', sweep(pts, (t) => 1.1 + Math.sin(Math.PI * t) * 0.5, 8, { sx: 1.3, sy: 0.8, step: 1.5 }), { glow: 1 });
			for (const t of [0.3, 0.5, 0.7]) { const q = pts[Math.round(t * 10)]; K.add('glass', blob(0.9, 1.5, 0.9, 10).translate(q.x, q.y - 2, q.z), { glow: 2 }); }
			for (const q of [pts[0], pts[10]]) X.col.disc(q.x, q.z, 2.4, S.y + 8, { site: S.id, floor: false });
		}
		// pods of light along the rim
		for (let k = 0; k < 7; k++) { const q = rad(F, 35.5, 4, ph + span * (k + 0.5) / 7); K.add('glass', blob(0.9, 1.6, 0.9, 10).translate(q.x, q.y, q.z), { glow: 2 }); }
	},
	marker(X, S) {
		const F = foundation(X, S, { r: 3, sides: 16, mat: 'trim', smooth: true, noRamp: true }), K = X.K, h = 9 + X.r() * 5;
		K.add('body', F.put(lathe([[0, 0], [1.6, 0], [2.2, h * 0.3], [1.9, h * 0.65], [0.7, h * 0.93], [0, h]], 18, false)), { glow: 1 });
		K.add('glow', F.put(box(0.12, h * 0.5, 0.12), 0, h * 0.45, 2.12, 0, 0.12, 0), {});
		X.col.disc(S.x, S.z, 2, S.y + h, { site: S.id, floor: false });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 7, sides: 16, mat: 'trim', smooth: true, noRamp: true }), K = X.K, pts = [];
		for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(F.p(-6.5 + 13 * t, Math.sin(Math.PI * t) * 15 - 0.5, Math.sin(TAU * t) * 1.5)); }
		K.add('body', sweep(pts, (t) => 1.2 + 0.5 * Math.cos(TAU * t), 8, { sx: 0.6, sy: 2.4, step: 0.8 }), { glow: 1 });
		for (const sx of [-1, 1]) { const q = F.p(sx * 6.5, 0, 0); X.col.disc(q.x, q.z, 1.8, S.y + 6, { site: S.id, floor: false }); }
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 3, sides: 16, mat: 'trim', smooth: true, noRamp: true }), K = X.K, h = 11;
		K.add('body', sweep([F.p(0, -0.5, 0), F.p(0.8, h * 0.5, 0.4), F.p(-0.2, h, 1.4)], (t) => 0.8 - t * 0.4, 10, { step: 0.5 }), {});
		const q = F.p(-0.2, h + 1.6, 1.4);
		K.add('glass', blob(1.5, 2.1, 1.5, 12).translate(q.x, q.y, q.z), { glow: 2 });
		for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; K.add('body', sweep([F.p(-0.2, h + 0.2, 1.4), F.p(-0.2 + Math.cos(a) * 1.8, h + 0.8, 1.4 + Math.sin(a) * 1.8), F.p(-0.2 + Math.cos(a) * 2.2, h + 2.6, 1.4 + Math.sin(a) * 2.2)], (t) => 0.3 - t * 0.2, 6, { seg: 6, sy: 2.4 }), {}); }
		X.beam(q, 260, 0.6, 4, 1, GROWN.beam);
		X.col.disc(S.x, S.z, 1.2, S.y + h, { site: S.id, floor: false });
	},
	// a pylon on stilts in the shallows, lit at the head
	stilt(X, S) {
		const F = frame(S.x, S.y, S.z, S.yaw), K = X.K, h = 18, deck = 5;
		for (let k = 0; k < 3; k++) {
			const th = k / 3 * TAU;
			const pts = [rad(F, 6, S.g0 - S.y - 2, th), rad(F, 5, (S.g0 - S.y) * 0.4, th + 0.15), rad(F, 2.5, deck, th + 0.3)];
			K.add('body', sweep(pts, (t) => 0.8 - t * 0.3, 8, { step: 1 }), {});
			const q = rad(F, 6, 0, th);
			X.col.disc(q.x, q.z, 0.9, S.y + deck, { site: S.id, floor: false });
		}
		K.add('body', F.put(lathe([[0, 0], [3.4, 0.2], [3.6, 1], [2, 1.4], [1.6, h * 0.7], [0.4, h], [0, h + 1]], 20, false), 0, deck, 0), { glow: 1 });
		K.add('glass', F.put(blob(1.3, 2, 1.3, 10), 0, deck + h * 0.75, 0), { glow: 2 });
		glowRing(X, F, 3.2, deck + 1.05, 0.2);
		X.beam(F.p(0, deck + h + 1, 0), 200, 0.5, 3, 1, GROWN.beam);
		X.col.disc(S.x, S.z, 3.4, S.y + deck + 1, { site: S.id });
	},
	post(X, F, x, y, z, h) { X.K.add('body', F.put(lathe([[0, 0], [0.3, 0], [0.18, h * 0.8], [0.3, h * 0.92], [0, h]], 8, false), x, y, z), { near: true }); },
};
const GROWN_OCEAN = { ...GROWN, glow: [0.3, 0.85, 1.0], beam: [0.35, 0.8, 1.0], mats: { ...GROWN.mats, body: { ...GROWN.mats.body, color: [0.92, 0.8, 0.78] }, trim: { ...GROWN.mats.trim, color: [0.5, 0.52, 0.5] } } };
const GROWN_RING = { ...GROWN, glow: [1.0, 0.75, 0.4], beam: [1.0, 0.75, 0.45], mats: { ...GROWN.mats, body: { ...GROWN.mats.body, color: [0.78, 0.66, 0.46], metal: 0.5, rough: 0.3 }, trim: { ...GROWN.mats.trim, color: [0.36, 0.34, 0.3] } } };

// ===== the Tetherers =====
const TETHER = {
	key: 'tether', people: 'the Tetherers', sides: 12,
	base: { landmark: {}, complex: { rampAt: [0] } },
	syl: ['ki', 'ren', 'ol', 'tae', 'sy', 'qua', 'lir', 'un', 'pe', 'zo'],
	nouns: { landmark: 'Needle', complex: 'Listening Array', marker: 'Tether', gate: 'Hung Ring', beacon: 'Signal Dish', platform: 'Tether Ledge', bridge: 'Cable Span' },
	glow: [1.0, 0.42, 0.25], beam: [1.0, 0.6, 0.45],
	mats: {
		body: { color: [0.86, 0.85, 0.82], rough: 0.42, metal: 0.05, clearcoat: 0.5, seam: 0, seamK: 0.9 },
		trim: { color: [0.2, 0.21, 0.23], rough: 0.32, metal: 0.9, seam: 0, seamK: 0.5 },
		glass: { color: [0.9, 0.58, 0.25], rough: 0.1, metal: 0.2, clearcoat: 1, opacity: 0.7, seam: 3, seamK: 0.3, rim: 0.8, rimC: [1, 0.6, 0.3] },
	},
	landmark(X, S) {
		const F = foundation(X, S), K = X.K, H = S.h, hub = 0.2 * H;
		// three legs up to the hub, the needle over it
		for (let k = 0; k < 3; k++) {
			const th = k / 3 * TAU, a = rad(F, S.r * 0.92, -1, th), b = rad(F, 3, hub, th);
			K.add('body', strut(a, b, 2.4, 1.6, true), {});
			K.add('glow', line(rad(F, S.r * 0.92, 0, th).setY(a.y + 1.2), rad(F, 3.4, hub, th), 0.2), {});
			X.col.disc(a.x, a.z, 2.2, S.y + 10, { site: S.id, floor: false });
		}
		// the needle: solid to the hub, then in pieces held apart in the thin air, light
		// in the gaps between them
		K.add('body', F.put(lathe([[0, 0], [2.6, 0], [3.6, 3], [3.6, hub], [3.2, hub + 2], [3.1, hub + 8], [0, hub + 8]], 12, true)), {});
		const nr = (y) => 3.1 - 2.2 * (y - hub) / (H - hub), segs = 7, gap = 3;
		for (let i = 0; i < segs; i++) {
			const y0 = hub + 8 + gap + i * (H - hub - 8) / segs, y1 = hub + 8 + (i + 1) * (H - hub - 8) / segs, c = F.p(0, (y0 + y1) / 2, 0);
			const last = i === segs - 1;
			K.add('body', F.put(lathe([[0, 0], [nr(y0) - 0.3, 0], [nr(y0), 0.4], [nr(y1), y1 - y0 - (last ? 0 : 0.4)], [last ? 0.3 : nr(y1) - 0.3, y1 - y0 + (last ? 20 : 0)], [0, y1 - y0 + (last ? 22 : 0)]], 12, true), 0, y0, 0), { spin: [c.x, c.y, c.z, 1e-6] });
			K.add('glow', F.put(lathe([[0, 0], [nr(y0) * 0.8, 0], [nr(y0) * 0.8, 0.5], [0, 0.5]], 12, true), 0, y0 - gap / 2 - 0.25, 0), { tint: [1.4, 1.3, 1.2] });
		}
		K.add('trim', F.put(lathe([[3.4, 0], [6.5, 1.5], [6.5, 4], [3.4, 6]], 12, true), 0, hub - 3, 0), {});
		glowRing(X, F, 6.6, hub - 0.2, 0.3);
		// rings hung in the air round it on cables, floating
		for (const [t, rr] of [[0.36, 26], [0.52, 20], [0.66, 15], [0.8, 10]]) {
			const y = t * H, c = F.p(0, y, 0), spin = [c.x, c.y, c.z, 1e-6], shaftR = 3.4 - t * 2;
			K.add('trim', F.put(ring(rr, 2.4, 1.2, 48), 0, y, 0), { spin });
			K.add('glow', F.put(ring(rr + 1.25, 0.2, 0.8, 48), 0, y + 0.2, 0), { spin });
			for (let k = 0; k < 3; k++) { const th = k / 3 * TAU + t * 4; K.add('trim', strut(rad(F, shaftR, y + 14, th), rad(F, rr - 1, y + 1, th), 0.12), { spin }); }
		}
		K.add('glow', F.put(blob(0.9, 0.9, 0.9, 8), 0, H + 24, 0), { tint: [1.6, 1.4, 1.4] });
		X.beam(F.p(0, H + 24, 0), 800, 0.8, 10, 1, TETHER.beam);
		X.col.disc(S.x, S.z, 3.8, S.y + H, { site: S.id, floor: false });
	},
	dish(X, p, R, dir) {
		// a bowl turned to the giant: its mount, the bowl, the feed at its focus
		const K = X.K, q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir), M = new THREE.Matrix4().compose(p, q, V3(1, 1, 1));
		K.add('body', dish(R, R * 0.28, Math.round(32 * X.det)).applyMatrix4(M), {});
		K.add('trim', ring(R, 0.6, 0.6, 32).translate(0, R * 0.28 - 0.3, 0).applyMatrix4(M), {});
		const f = V3(0, R * 0.62, 0).applyMatrix4(M);
		for (let k = 0; k < 3; k++) { const a = k / 3 * TAU, e = V3(Math.cos(a) * R * 0.95, R * 0.27, Math.sin(a) * R * 0.95).applyMatrix4(M); K.add('trim', strut(e, f, 0.18), {}); }
		K.add('glow', blob(0.5, 0.9, 0.5, 8).applyMatrix4(M.clone().setPosition(f)), { tint: [1.5, 1.3, 1.3] });
	},
	complex(X, S) {
		const F = foundation(X, S), K = X.K, dir = V3(0.42, 0.33, -0.84).normalize();
		for (let k = 0; k < 3; k++) {
			const th = k / 3 * TAU + Math.PI / 3, q = rad(F, S.r * 0.6, 0, th), R = 15 - k * 2.5, hp = R * 0.75 + 2;
			K.add('trim', prism(8, 2.6, 1.8, hp, 0, 0.3).translate(q.x, q.y, q.z), {});
			K.add('trim', cbox(R * 0.8, 1.2, 1.6, 0.2).translate(q.x, q.y + hp, q.z), {});
			TETHER.dish(X, V3(q.x, q.y + hp + 1, q.z), R, dir);
			X.col.disc(q.x, q.z, 2.8, S.y + hp, { site: S.id, floor: false });
		}
		// the pavilion: a raised ring deck, slender posts, a roof floating over them
		const Rd = 9;
		K.add('body', F.put(lathe([[0, 0], [Rd, 0], [Rd, 1.4], [Rd - 0.3, 1.6], [0, 1.6]], 24, true)), {});
		for (let k = 0; k < 8; k++) { const th = k / 8 * TAU; K.add('trim', strut(rad(F, Rd - 0.8, 1.6, th), rad(F, Rd - 1.4, 8, th), 0.3), {}); }
		const cp = F.p(0, 9.5, 0);
		K.add('body', F.put(lathe([[0, 0], [Rd + 3, -0.2], [Rd + 3.4, 0.4], [0, 1.4]], 24, true), 0, 9, 0), { spin: [cp.x, cp.y, cp.z, 1e-6] });
		K.add('glow', F.put(ring(Rd + 3.3, 0.2, 0.3, 48), 0, 9.1, 0), { spin: [cp.x, cp.y, cp.z, 1e-6] });
		glowRing(X, F, Rd + 0.05, 1.5, 0.15);
		X.col.disc(S.x, S.z, Rd, S.y + 1.6, { site: S.id });
	},
	marker(X, S) {
		// a platform held up in the air on its tethers (walkable, for those who fly)
		const F = foundation(X, S, { r: 3, noRamp: true }), K = X.K, h = 26 + X.r() * 12, cp = F.p(0, h, 0);
		K.add('body', F.put(lathe([[0, -1.8], [4, -0.8], [7, 0], [7, 0.6], [0, 0.6]], 6, true), 0, h, 0), {});
		glowRing(X, F, 6.6, h + 0.3, 0.2);
		for (let k = 0; k < 3; k++) { const th = k / 3 * TAU; K.add('trim', strut(rad(F, 1.2, 1, th), rad(F, 5.5, h, th), 0.1), {}); }
		K.add('trim', F.put(prism(6, 1.8, 1.2, 1.6)), {});
		K.add('glow', F.put(blob(0.5, 0.5, 0.5, 6), 0, h + 3, 0), { spin: [cp.x, cp.y + 3, cp.z, 0.4], tint: [1.6, 1.4, 1.4] });
		X.col.disc(S.x, S.z, 7, S.y + h + 0.6, { site: S.id, solid: false });
		X.col.disc(S.x, S.z, 1.8, S.y + 1.6, { site: S.id });
	},
	gate(X, S) {
		const F = foundation(X, S, { r: 7, noRamp: true }), K = X.K, h = 22;
		for (const sx of [-1, 1]) {
			K.add('body', F.put(prism(8, 0.9, 0.3, h, 3), sx * 7, 0, 0), {});
			const q = F.p(sx * 7, 0, 0);
			X.col.disc(q.x, q.z, 1, S.y + h, { site: S.id, floor: false });
		}
		const c = F.p(0, h * 0.55, 0), spin = [c.x, c.y, c.z, 1e-6];
		K.add('trim', F.put(ring(4.5, 1, 0.8, 40), 0, h * 0.55, 0, 0, Math.PI / 2), { spin });
		K.add('glow', F.put(ring(4, 0.12, 0.9, 40), 0, h * 0.55, -0.05, 0, Math.PI / 2), { spin });
		for (const sx of [-1, 1]) K.add('trim', strut(F.p(sx * 6.4, h * 0.8, 0), F.p(sx * 3, h * 0.55 + 3, 0), 0.08), { spin });
	},
	beacon(X, S) {
		const F = foundation(X, S, { r: 3, noRamp: true }), h = 7;
		X.K.add('trim', F.put(prism(8, 0.7, 0.5, h)), {});
		TETHER.dish(X, F.p(0, h, 0), 3.5, V3(0.42, 0.33, -0.84).normalize());
		X.col.disc(S.x, S.z, 1, S.y + h, { site: S.id, floor: false });
	},
	post(X, F, x, y, z, h) { X.K.add('trim', F.put(prism(6, 0.12, 0.08, h, 0.2), x, y, z), { near: true }); },
};

// ---------- works every people built in its own way ----------
// a ledge cut out over a cliff: a deck from the edge out into the air, a strut under it
export function platform(X, S) {
	const C = X.C, F = frame(S.x, S.y, S.z, S.yaw), K = X.K, L = 16, W = 9;
	K.add('trim', F.put(cbox(W, 1.4, L + 5, 0.3), 0, -0.7, L / 2 - 2.5), { glow: 1 });
	K.add('body', F.put(cbox(W + 1, 5, 5, 0.4), 0, -3, -4.5), {});
	K.add('trim', strut(F.p(0, -1.2, L - 2), F.p(0, -14, -1.5), 2.2, 1.6, true), {});
	for (const sx of [-1, 1]) {
		K.add('glow', line(F.p(sx * (W / 2 - 0.1), 0.05, -4.5), F.p(sx * (W / 2 - 0.1), 0.05, L + 2.4), 0.14), {});
		for (let i = 0; i < 5; i++) C.post(X, F, sx * (W / 2 - 0.5), 0, i * (L / 4), 1.6);
		X.col.seg(F.p(sx * (W / 2 - 0.5), 0, 0), F.p(sx * (W / 2 - 0.5), 0, L), 0.3, S.y + 1.2, S.id);
	}
	for (let i = 0; i < 3; i++) C.post(X, F, -W / 2 + 1.5 + i * (W - 3) / 2, 0, L + 1.8, 1.6);
	X.col.seg(F.p(-W / 2, 0, L + 1.8), F.p(W / 2, 0, L + 1.8), 0.3, S.y + 1.2, S.id);
	X.col.box(F.p(0, 0, L / 2 - 2.5).x, F.p(0, 0, L / 2 - 2.5).z, S.yaw, W / 2, L / 2 + 2.5, S.y, { site: S.id, solid: false });
}
// a span across a gorge from a to b (S.a, S.b), its deck arched a little
export function bridge(X, S) {
	const C = X.C, K = X.K, a = S.a, b = S.b, yaw = Math.atan2(b.x - a.x, b.z - a.z), len = Math.hypot(b.x - a.x, b.z - a.z);
	const y0 = S.y, rise = Math.min(4, len * 0.05), F = frame(a.x, y0, a.z, yaw), W = 6, n = Math.max(6, Math.round(len / 6));
	const at = (t) => rise * Math.sin(Math.PI * t);
	for (let i = 0; i < n; i++) {
		const t0 = i / n, t1 = (i + 1) / n;
		K.add('trim', strut(F.p(0, at(t0) - 0.6, t0 * len - 0.1), F.p(0, at(t1) - 0.6, t1 * len + 0.1), W, 1.2), {});
		for (const sx of [-1, 1]) K.add('glow', line(F.p(sx * (W / 2 - 0.15), at(t0) + 0.02, t0 * len), F.p(sx * (W / 2 - 0.15), at(t1) + 0.02, t1 * len), 0.12), {});
	}
	for (let i = 0; i <= n; i += 1) for (const sx of [-1, 1]) C.post(X, F, sx * (W / 2 - 0.4), at(i / n), i / n * len, 1.4);
	// the arch that carries it, springing from the gorge's sides
	const pts = [];
	let low = 0;
	for (let i = 0; i <= 12; i++) { const t = i / 12, q = F.p(0, 0, t * len); low = Math.min(low, X.H(q.x, q.z) - y0); }
	const drop = Math.max(6, Math.min(-low * 0.7, len * 0.35));
	for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(F.p(0, at(t) - 1.4 - drop * (1 - Math.sin(Math.PI * t)), t * len)); }
	for (const sx of [-1, 1]) K.add('body', sweep(pts.map((p) => p.clone().add(V3(Math.cos(yaw) * sx * (W / 2 - 1), 0, -Math.sin(yaw) * sx * (W / 2 - 1)))), (t) => 1.1 + Math.abs(t - 0.5) * 1.6, 6, { sx: 1.4, sy: 0.8, flat: true, step: 2 }), { glow: 1 });
	for (const [t, e] of [[0, -1], [1, 1]]) { const q = F.p(0, 0, t * len + e * 3); K.add('body', frame(q.x, y0, q.z, yaw).put(cbox(W + 2, 8, 6, 0.4), 0, -4.4, 0), {}); }
	// its deck: two ramps up to the middle
	for (const [t0, t1] of [[0, 0.5], [0.5, 1]]) X.col.ramp(F.x, F.z, yaw, W / 2, t0 * len - (t0 === 0 ? 4 : 0), t1 * len + (t1 === 1 ? 4 : 0), y0 + at(t0), y0 + at(t1), S.id, false);
	for (const sx of [-1, 1]) X.col.seg(F.p(sx * (W / 2 - 0.4), 0, 0), F.p(sx * (W / 2 - 0.4), 0, len), 0.3, y0 + rise + 1.2, S.id, y0 - 2);
}

export const CIVS = { choir: CHOIR, lens: LENS, brood: BROOD, sun: SUN, glass: GLASS, forge: FORGE, grown: GROWN, grownOcean: GROWN_OCEAN, grownRing: GROWN_RING, tether: TETHER };
export const CIV_OF = { MYSTICAL: 'choir', SINGULARITY: 'lens', TOXIC: 'brood', ARID: 'sun', ICE: 'glass', MAGMA: 'forge', TERRAN: 'grown', TROPICAL: 'grown', OCEAN: 'grownOcean', SHEPHERD: 'grownRing', GAS: 'tether', BARREN: 'tether', GAS_GIANT: 'tether' };
