// Cars with real proportions and smooth bodies. Each body is lofted: a cross-section
// (the floor tucked in, a side that bulges to its widest halfway up and swells over the
// wheels, a rounded shoulder, the glass leaning in to a crowned roof) swept along the
// car's length, its height following the hood, windshield, roof, rear glass and deck, its
// width rounding off in plan at the nose and tail. The shader paints the glass and its
// pillars, lamps, grille, plates, black trim and chrome, the bumpers' and doors' split
// lines and handles, and cuts the wheel arches, from where each point sits on the body;
// the paint is a clear coat that reflects the live sky. Close by a body also has its
// mirrors, liners in the wheel wells, built rims, and a cabin you see into through the
// glass and sit in when you drive: seats with bolsters, a dash with its gauges and a
// screen, the steering wheel, the console, the mirror on the glass.
//
// The close cars, the sports car, the crossover, the delivery van and the bus, are real
// models (vehicles/models.js); these lofts stand in for them further off and until they
// have loaded, and are every other kind at every distance.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CLOUD_REFLECT_GLSL, cloudReflectU } from '../world/sky.js';

// L length, W width, H height, belt (base of the glass), ws (windshield foot, from the
// centre toward the front), rf/rr (roof front and rear), rb (rear glass foot), wz (axle),
// nose (how far the hood drops to the nose), bed (a pickup's load bed behind the cab),
// clear (ground clearance), wr (tyre radius), hip (the seat's height), doors (front door's
// leading edge, the B pillar, the rear door's trailing edge; null where there is none),
// panel (no glass behind this: a van's load space), box (a truck's box starts behind this,
// boxH high), plan (how square the nose and tail are in plan), tumble (how far the glass
// leans in: 1 upright), cp (the side glass ends this far behind the roof: the C pillar)
export const SPEC = {
	sedan: { L: 4.75, W: 1.84, H: 1.45, belt: 0.93, ws: 0.95, rf: 0.1, rr: -0.95, rb: -1.55, wz: 1.42, nose: 0.2, clad: 0.14, hip: 0.55, cp: 0.3, doors: [0.86, -0.18, -1.2] },
	hatch: { L: 4.1, W: 1.77, H: 1.47, belt: 0.92, ws: 0.95, rf: 0.2, rr: -1.5, rb: -1.98, wz: 1.28, nose: 0.2, clad: 0.14, hip: 0.56, doors: [0.85, -0.12, -1.05] },
	suv: { L: 4.7, W: 1.9, H: 1.72, belt: 1.08, ws: 1.1, rf: 0.45, rr: -2.1, rb: -2.3, wz: 1.42, nose: 0.14, clad: 0.26, clear: 0.36, wr: 0.38, hip: 0.72, doors: [1.0, 0.0, -1.08] },
	pickup: { L: 5.6, W: 2.0, H: 1.88, belt: 1.12, ws: 1.25, rf: 0.6, rr: -0.5, rb: -0.62, wz: 1.8, nose: 0.1, clad: 0.24, bed: -0.72, clear: 0.4, wr: 0.4, hip: 0.8, doors: [1.15, 0.28, -0.6] },
	van: { L: 5.1, W: 1.97, H: 1.78, belt: 1.02, ws: 1.7, rf: 0.95, rr: -2.35, rb: -2.5, wz: 1.52, nose: 0.2, clad: 0.18, hip: 0.68, doors: [1.55, 0.62, -0.62] },
	crossover: { L: 4.6, W: 1.9, H: 1.63, belt: 1.0, ws: 1.02, rf: 0.3, rr: -1.2, rb: -2.0, wz: 1.46, nose: 0.16, clad: 0.22, clear: 0.33, wr: 0.37, hip: 0.66, doors: [0.92, -0.1, -1.1] },
	sports: { L: 4.45, W: 2.0, H: 1.17, belt: 0.78, ws: 0.72, rf: -0.12, rr: -0.8, rb: -1.85, wz: 1.42, nose: 0.24, clad: 0.08, clear: 0.2, wr: 0.36, hip: 0.36, doors: [0.62, -0.62, null], tumble: 0.66 },
	delivery: { L: 5.4, W: 2.05, H: 2.5, belt: 1.2, ws: 1.95, rf: 1.55, rr: -2.6, rb: -2.68, wz: 1.72, nose: 0.28, clad: 0.2, clear: 0.34, wr: 0.39, hip: 0.95, doors: [1.88, 0.95, -0.5], panel: 0.9, plan: 9, tumble: 0.94 },
	bus: { L: 11.2, W: 2.55, H: 3.0, belt: 1.2, ws: 5.3, rf: 5.1, rr: -5.35, rb: -5.5, wz: 2.9, nose: 0.02, clad: 0.3, clear: 0.34, wr: 0.49, hip: 1.25, doors: null, plan: 16, tumble: 0.97 },
	truck: { L: 7.0, W: 2.4, H: 3.3, belt: 1.5, ws: 3.1, rf: 2.65, rr: -3.4, rb: -3.48, wz: 2.3, nose: 0.1, clad: 0.3, clear: 0.45, wr: 0.49, hip: 1.35, doors: [3.0, 2.2, null], panel: 2.12, box: 2.05, cabH: 2.75, plan: 12, tumble: 0.95 },
};
export const KINDS = Object.keys(SPEC);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// the windshield's and the rear glass's rise, 0 at the foot to 1 at the roof: nearly
// straight, bowed a little, easing in at the foot and meeting the roof at an edge
const glassRise = (t) => { t = Math.min(1, Math.max(0, t)); return 0.55 * t + 0.45 * (1 - (1 - t) * (1 - t)) - 0.24 * t * (1 - t) * (1 - t); };
const def = (S) => Object.assign({ clear: 0.3, wr: 0.34, tw: 0.23, plan: 5, tumble: 0.72, panel: -1e9, cp: 0.12 }, S);
// the lamps and grille: 0 a car's swept lamps, 1 the tall cars' square ones behind a chrome
// grille, 2 the vans' and trucks' upright ones
const STYLE = { sedan: 0, hatch: 0, sports: 0, crossover: 1, suv: 1, pickup: 1, van: 2, delivery: 2, truck: 2, bus: 2 };
// a kind's measurements, the defaults filled in
export const specOf = (kind) => def(SPEC[kind] || SPEC.sedan);

// where the wheels are: [x, y, z] front left, front right, rear left, rear right (left is +x)
export function wheelHubs(kind) {
	const S = def(SPEC[kind]), x = S.W / 2 - S.tw / 2 - 0.02;
	return [[x, S.wr, S.wz], [-x, S.wr, S.wz], [x, S.wr, -S.wz], [-x, S.wr, -S.wz]];
}
// where people sit, in the car's frame: the driver (on the left), the front passenger,
// the two outer seats behind (if there is a back seat), and the steering wheel; each a
// seat's front edge [x, y, z] (y the seat's height), for people/motion.js to sit on
export function seatsOf(kind) {
	const S = def(SPEC[kind]), d = S.doors, front = d ? d[1] + (kind === 'sports' ? 0.35 : 0.3) : S.ws - 0.9;
	const x = Math.min(0.38, S.W * 0.2), seats = [[x, S.hip, front], [-x, S.hip, front]];
	if (d && d[2] !== null && kind !== 'pickup' && kind !== 'delivery') seats.push([x, S.hip + 0.03, front - 0.85], [-x, S.hip + 0.03, front - 0.85]);
	if (kind === 'pickup') seats.push([x, S.hip, front - 0.8], [-x, S.hip, front - 0.8]);
	// (the eye: over the hip, leaning back, well behind the top of the windshield)
	return { seats, wheel: [x, S.hip + 0.36, front + 0.42], eye: [x, S.hip + 0.7, Math.min(front - 0.38, S.rf - 0.3)] };
}

// NS: sections along the body, WS: sides round each tyre (cars in the distance use fewer
// of both; they are many). opts: wheels (built in, or left for the caller to turn), cabin
// (mirrors, wheel-well liners, seats, dash and wheel: the close ones), glass (the glass as
// a second group, for a see-through material)
export function carGeometry(kind, NS = 48, WS = 20, opts = {}) {
	const { wheels = true, cabin = false, glass = false } = opts;
	const S = def(SPEC[kind]), L2 = S.L / 2;
	const bottom = (s) => S.clear + 0.1 * sm(L2 - 0.55, L2, Math.abs(s));
	// the belt line: the hood falls to the nose, the deck is level, and both roll over at the ends
	const belt = (s) => S.belt - (s > S.ws ? S.nose * Math.pow(sm(S.ws, L2, s), 1.3) : 0) - (s < S.rb ? 0.04 * sm(S.rb, -L2, s) : 0) - 0.05 * sm(L2 - 0.3, L2, Math.abs(s));
	// the roof line: up the windshield, across the roof, down the rear glass
	const top = (s) => {
		const b = belt(s);
		if (S.bed !== undefined && s < S.bed) return b;                                      // a pickup's bed is open
		if (S.box !== undefined) {
			// a box truck: the cab, then the box standing taller behind it
			if (s < S.box) return S.H - 0.02 * sm(-L2 + 0.2, -L2, s);
			return s > S.rf ? b + (S.cabH - b) * sm(S.ws, S.rf, s) : S.cabH;
		}
		if (s > S.rf) return b + (S.H - b) * glassRise((S.ws - s) / (S.ws - S.rf));
		if (s < S.rr) return b + (S.H - b) * glassRise((s - S.rb) / (S.rr - S.rb));
		return S.H + 0.02 * Math.sin((s - S.rr) / (S.rf - S.rr) * Math.PI);
	};
	// half width in plan, rounded off at the nose and tail
	const halfW = (s) => { const u = Math.abs(s) / L2, e = S.plan; return S.W / 2 * Math.pow(Math.max(0, 1 - Math.pow(u, s > 0 ? e : e + 1)), 1 / e) * (1 - 0.02 * Math.max(0, s / L2)); };
	// the fenders swell a little over each wheel
	const flare = (s) => kind === 'bus' ? 0 : 1 - sm(S.wr + 0.12, S.wr + 0.5, Math.min(Math.abs(s - S.wz), Math.abs(s + S.wz)));
	const P = [], E = [];
	const ring = [];
	for (let k = 0; k <= NS; k++) {
		const u = -1 + 2 * k / NS, s = L2 * Math.sin(u * Math.PI / 2);
		const b0 = bottom(s), bl = belt(s), tp = top(s), wb = halfW(s), h = bl - b0, f = 1 + 0.028 * flare(s);
		const g = Math.min(1, Math.max(0, (tp - bl - 0.02) / Math.max(0.3, (S.box !== undefined ? S.cabH : S.H) - S.belt)));
		const inBox = S.box !== undefined && s < S.box;
		const glassHere = g > 0.15 && s > S.panel && !inBox ? 1 : 0;
		const roofHere = S.box !== undefined ? tp > S.H - 0.05 || tp > S.cabH - 0.05 : s < S.rf + 0.01 && s > S.rr - 0.01;
		const bed = S.bed !== undefined && s < S.bed ? 1 : 0;
		// the half section, from under the car round the side to the centre of the top: the
		// floor tucked in, the side bulging to its widest halfway up, a rounded shoulder, then
		// the glass leaning in (tumblehome) to a crowned roof, or the hood's and deck's crown
		const half = [[0, b0], [wb * 0.74, b0], [wb * 0.9, b0 + h * 0.03], [wb * 0.965 * f, b0 + h * 0.1], [wb * 0.99 * f, b0 + h * 0.24], [wb * f, b0 + h * 0.5],
			[wb * 0.99 * f, b0 + h * 0.76], [wb * 0.972 * (1 + (f - 1) * 0.4), b0 + h * 0.92], [wb * 0.952, b0 + h * 0.975], [wb * 0.925, bl]];
		const deck = [[wb * 0.915, bl + 0.006], [wb * 0.88, bl + 0.02], [wb * 0.78, bl + 0.034], [wb * 0.6, bl + 0.045], [wb * 0.4, bl + 0.051], [wb * 0.2, bl + 0.054], [0, bl + 0.055]];
		const tum = inBox ? 0.99 : S.tumble;
		const wg = wb * (0.86 + (tum - 0.72) * 0.45), wr = wb * tum;
		const house = [[wg, bl + 0.025], [wg + (wr - wg) * 0.3 + wb * 0.012, bl + (tp - bl) * 0.4], [wg + (wr - wg) * 0.72 + wb * 0.006, bl + (tp - bl) * 0.78], [wr, tp - 0.075], [wr * 0.955, tp - 0.028], [wr * 0.75, tp - 0.006], [0, tp + 0.02]];
		for (let n = 0; n < 7; n++) half.push([deck[n][0] + (house[n][0] - deck[n][0]) * g, deck[n][1] + (house[n][1] - deck[n][1]) * g]);
		// part per point: 0 paint, 1 the side glass (it ends at the C pillar), 1.3 the glass
		// across the top (windshield and rear glass; between the two, the pillars), 4 the bed
		const side = glassHere && s > S.rr - S.cp ? 1 : 0, over = glassHere && !roofHere ? 1.3 : 0;
		const part = half.map((_, n) => n < 10 ? 0 : bed && n > 10 ? 4 : n <= 13 ? side : over);
		const full = [...half.map((p, n) => [p[0], p[1], part[n]]), ...half.slice(1, -1).reverse().map((p, n) => [-p[0], p[1], part[half.length - 2 - n]])];
		const start = P.length / 3;
		for (const [x, y, pt] of full) {
			P.push(x, y, s);
			E.push(s / L2, (y - b0) / Math.max(0.1, bl - b0), wb > 0.01 ? Math.abs(x) / wb : 0, pt);
		}
		ring.push({ start, n: full.length });
	}
	const idx = [];
	for (let k = 0; k < NS; k++) {
		const a = ring[k], b = ring[k + 1], n = a.n;
		for (let i = 0; i < n; i++) {
			const i2 = (i + 1) % n;
			idx.push(a.start + i, a.start + i2, b.start + i, a.start + i2, b.start + i2, b.start + i);
		}
	}
	const body = new THREE.BufferGeometry();
	body.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	body.setAttribute('aE', new THREE.Float32BufferAttribute(E, 4));
	body.setIndex(idx);
	body.computeVertexNormals();
	const parts = [body.toNonIndexed()];
	if (wheels) for (const [x, y, z] of wheelHubs(kind)) parts.push(wheelGeometry(kind, WS).applyMatrix4(new THREE.Matrix4().makeScale(Math.sign(x), 1, 1).setPosition(x, y, z)));
	if (cabin) {
		// the mirrors, on stalks at the foot of the A pillars
		const ms = S.ws - 0.14, mb = belt(ms), mw = halfW(ms);
		for (const sx of [-1, 1]) {
			const cap = new THREE.SphereGeometry(1, 10, 7).scale(0.075, 0.068, 0.12).translate(sx * (mw + 0.12), mb + 0.1, ms);
			const stalk = new THREE.CylinderGeometry(0.018, 0.022, 0.14, 5).rotateZ(Math.PI / 2).translate(sx * (mw + 0.05), mb + 0.07, ms + 0.02);
			parts.push(tag(cap, 0, (p, i, a) => { a[i * 4] = ms / L2; a[i * 4 + 1] = 0.9; }), tag(stalk, 7));
			// the glass in the mirror, facing back
			parts.push(tag(new THREE.CircleGeometry(1, 10).scale(0.06, 0.05, 1).rotateY(Math.PI).translate(sx * (mw + 0.12), mb + 0.1, ms - 0.1), 9));
		}
		// liners in the wheel wells, so the arches show a dark well and not the car's inside
		for (const [x, y, z] of wheelHubs(kind)) {
			const r = S.wr + 0.1, sx = Math.sign(x), x0 = Math.abs(x) - S.tw / 2 - 0.06;
			const liner = new THREE.CylinderGeometry(r, r, S.W / 2 - x0 + 0.04, 14, 1, true, 0.08 * Math.PI, 0.84 * Math.PI).rotateZ(Math.PI / 2);
			liner.translate(sx * (x0 + (S.W / 2 - x0) / 2), y, z);
			parts.push(tag(liner, 8));
			parts.push(tag(new THREE.CircleGeometry(r, 14, 0, Math.PI).rotateY(Math.PI / 2).translate(sx * x0, y, z), 8));
		}
		parts.push(...cabinGeometry(kind, S, belt, top, halfW));
	}
	const g = mergeGeometries(parts);
	// per point, for the shader: the axle's distance from the centre, the tyre's radius, the
	// windshield's foot and the rear glass's (aW); where the door seams run (aD); the half
	// length and half width, the kind's style of lamps and grille, and whether its arches
	// are clad in black (aS)
	const n = g.attributes.position.count, aw = new Float32Array(n * 4), ad = new Float32Array(n * 3), as = new Float32Array(n * 4);
	const D = S.doors || [9, 9, 9], st = STYLE[kind] ?? 0, cl = S.clad >= 0.2 ? 1 : 0;
	for (let i = 0; i < n; i++) {
		aw.set([S.wz, S.wr, S.ws, S.rb], i * 4);
		ad.set([D[0] ?? 9, D[1] ?? 9, D[2] ?? 9], i * 3);
		as.set([L2, S.W / 2, st, cl], i * 4);
	}
	g.setAttribute('aW', new THREE.BufferAttribute(aw, 4));
	g.setAttribute('aD', new THREE.BufferAttribute(ad, 3));
	g.setAttribute('aS', new THREE.BufferAttribute(as, 4));
	if (glass) splitGlass(g);
	g.computeBoundingSphere();
	return g;
}

// a part's aE (e: fills it from the positions), its uvs dropped so that the parts merge
function tag(geo, pt, e = null) {
	const g = geo.index ? geo.toNonIndexed() : geo;
	g.deleteAttribute('uv');
	const n = g.attributes.position.count, a = new Float32Array(n * 4);
	for (let i = 0; i < n; i++) { if (e) e(g.attributes.position, i, a); a[i * 4 + 3] = pt; }
	g.setAttribute('aE', new THREE.BufferAttribute(a, 4));
	return g;
}

// the glass's triangles last, as their own group: [everything else, glass]
function splitGlass(g) {
	const E = g.attributes.aE, n = g.attributes.position.count / 3, order = [], tail = [];
	const isGlass = (i) => { const w = E.getW(i); return w > 0.9 && w < 1.4; };
	for (let t = 0; t < n; t++) (isGlass(t * 3) && isGlass(t * 3 + 1) && isGlass(t * 3 + 2) ? tail : order).push(t);
	const all = order.concat(tail);
	for (const name of Object.keys(g.attributes)) {
		const a = g.attributes[name], k = a.itemSize, src = a.array.slice(), dst = a.array;
		all.forEach((t, j) => dst.set(src.subarray(t * 3 * k, t * 3 * k + 3 * k), j * 3 * k));
	}
	g.clearGroups();
	g.addGroup(0, order.length * 3, 0);
	g.addGroup(order.length * 3, tail.length * 3, 1);
}

// a tyre with a rounded shoulder and an alloy rim set into it, on its hub, the rim's face
// toward +x (mirror it for the right side). Close by (WS 16 and up) the rim is built: a dark
// barrel and brake disc behind, spokes dished in from the lip to a hub; further off it is
// a flat dish with the spokes painted on. aE.xy: the point's place round the hub
export function wheelGeometry(kind, WS = 20) {
	const S = def(SPEC[kind]), r = S.wr, w = S.tw;
	// the tyre's section: bead, sidewall, a rounded shoulder, the tread, and back
	const rb = r * 0.64, sh = 0.05, prof = [new THREE.Vector2(rb, -w / 2 + 0.02), new THREE.Vector2(r - sh, -w / 2)];
	for (let i = 1; i < 4; i++) { const a = Math.PI / 2 * i / 4; prof.push(new THREE.Vector2(r - sh + Math.sin(a) * sh, -w / 2 + sh - Math.cos(a) * sh)); }
	prof.push(new THREE.Vector2(r, -w / 2 + sh), new THREE.Vector2(r, w / 2 - sh));
	for (let i = 1; i < 4; i++) { const a = Math.PI / 2 * i / 4; prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, w / 2 - sh + Math.sin(a) * sh)); }
	prof.push(new THREE.Vector2(r - sh, w / 2), new THREE.Vector2(rb, w / 2 - 0.02));
	const parts = [[new THREE.LatheGeometry(prof, WS).rotateZ(-Math.PI / 2), 2]];
	if (WS >= 16) {
		const face = w / 2 - 0.03;
		parts.push(
			[new THREE.CylinderGeometry(rb * 0.97, rb * 0.97, w - 0.06, WS, 1, true).rotateZ(Math.PI / 2), 13],
			[new THREE.CircleGeometry(rb * 0.97, WS).rotateY(Math.PI / 2).translate(-w / 2 + 0.05, 0, 0), 13],
			[new THREE.TorusGeometry(rb * 0.975, 0.013, 4, WS).rotateY(Math.PI / 2).translate(face, 0, 0), 12],
			[new THREE.CylinderGeometry(rb * 0.8, rb * 0.8, 0.025, WS, 1).rotateZ(Math.PI / 2).translate(face - 0.075, 0, 0), 13],
			[new THREE.CylinderGeometry(rb * 0.19, rb * 0.24, 0.05, 10).rotateZ(Math.PI / 2).translate(face + 0.004, 0, 0), 12],
		);
		// the spokes: five on a car, more on the big wheels, split pairs on the sports car
		const twin = kind === 'sports', n = twin ? 10 : kind === 'bus' || kind === 'truck' ? 8 : kind === 'van' || kind === 'delivery' || kind === 'pickup' ? 6 : 5;
		const r0 = rb * 0.17, len = rb * 0.96 - r0;
		for (let i = 0; i < n; i++) {
			const sp = new THREE.BoxGeometry(0.024, 1, 1, 1, 2, 1), p = sp.attributes.position;
			for (let k = 0; k < p.count; k++) {
				const t = p.getY(k) + 0.5;
				p.setXYZ(k, p.getX(k) - 0.028 * t + 0.008, r0 + t * len, p.getZ(k) * (twin ? 0.024 + 0.008 * t : 0.045 + 0.03 * t));
			}
			sp.computeVertexNormals();
			parts.push([sp.rotateX(i * 2 * Math.PI / n + (twin ? (i % 2 ? 0.1 : -0.1) : 0)).translate(face, 0, 0), 12]);
		}
	} else {
		// the rim: a shallow dish, its face just inside the sidewall
		parts.push([new THREE.CylinderGeometry(rb * 1.02, rb * 0.92, 0.05, WS, 1).rotateZ(Math.PI / 2).translate(w / 2 - 0.05, 0, 0), 5],
			[new THREE.CylinderGeometry(rb * 0.25, rb * 0.3, 0.04, 8).rotateZ(Math.PI / 2).translate(w / 2 - 0.02, 0, 0), 5]);
	}
	return mergeGeometries(parts.map(([geo, pt]) => tag(geo, pt, (p, i, a) => { a[i * 4] = p.getY(i); a[i * 4 + 1] = p.getZ(i); a[i * 4 + 2] = r; })));
}

// the cabin, for the close cars and for you at the wheel: the floor, seats with bolsters
// and head rests, the dash with its gauges under a hood and a screen in the middle, the
// steering wheel on its column, the console, arm rests on the doors, the mirror on the glass
const M4 = (x, y, z, rx = 0) => new THREE.Matrix4().makeRotationX(rx).setPosition(x, y, z);
const rbox = (w, h, d, r, pt, M) => tag(new RoundedBoxGeometry(w, h, d, 1, r).applyMatrix4(M), pt);
function screen(w, h, type, M) {
	const g = new THREE.PlaneGeometry(w, h).toNonIndexed(), p = g.attributes.position, a = new Float32Array(p.count * 4);
	g.deleteAttribute('uv');
	for (let i = 0; i < p.count; i++) a.set([p.getX(i) / w + 0.5, p.getY(i) / h + 0.5, type, 11], i * 4);
	g.setAttribute('aE', new THREE.BufferAttribute(a, 4));
	return g.applyMatrix4(M);
}
function cabinGeometry(kind, S, belt, top, halfW) {
	const out = [], L2 = S.L / 2, C = seatsOf(kind), big = kind === 'bus' || kind === 'truck';
	const fl = S.clear + 0.1;
	// the floor, from the footwells back
	out.push(tag(new THREE.PlaneGeometry(S.W * 0.8, Math.max(1, S.ws - (S.bed ?? S.rr ?? -L2))).rotateX(-Math.PI / 2).translate(0, fl + 0.02, (S.ws + (S.bed ?? S.rr)) / 2), 6));
	C.seats.forEach(([x, y, z]) => {
		// the cushion between its bolsters, then the back (leaning back from its hinge) with its
		// own bolsters, and the head rest on two posts
		out.push(rbox(0.44, 0.1, 0.46, 0.035, 6, M4(x, y - 0.045, z - 0.25)));
		for (const sx of [-1, 1]) out.push(rbox(0.08, 0.08, 0.42, 0.03, 7, M4(x + sx * 0.2, y, z - 0.26)));
		const H = M4(x, y, z - 0.5, -0.25), at = (lx, ly, lz) => H.clone().multiply(new THREE.Matrix4().makeTranslation(lx, ly, lz));
		out.push(rbox(0.44, 0.56, 0.1, 0.035, 6, at(0, 0.3, -0.02)));
		for (const sx of [-1, 1]) out.push(rbox(0.08, 0.48, 0.15, 0.03, 7, at(sx * 0.2, 0.28, 0.02)));
		out.push(rbox(0.25, 0.16, 0.08, 0.03, 6, at(0, 0.7, -0.02)));
		for (const sx of [-1, 1]) out.push(tag(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 5).applyMatrix4(at(sx * 0.07, 0.6, -0.02)), 16));
		// the seat's base down to the floor
		if (y - fl > 0.25) out.push(tag(new THREE.CylinderGeometry(0.16, 0.2, y - fl - 0.05, 6).translate(x, (y + fl) / 2 - 0.05, z - 0.2), 7));
	});
	// the dash: a pad from the windshield's foot back to its rolled edge, the face dropping to
	// the knees, then under to the bulkhead, swept across the car
	const [wx, wy, wz] = C.wheel;
	const zb = wz + 0.2, zf = Math.max(zb + 0.18, S.ws - 0.04), b = belt(zb) - 0.01;
	const pro = new THREE.Shape();
	pro.moveTo(zf, belt(zf) - 0.01);
	pro.lineTo(zb + 0.1, b + 0.015);
	pro.quadraticCurveTo(zb - 0.01, b + 0.02, zb, b - 0.07);
	pro.lineTo(zb + 0.05, b - 0.28);
	pro.quadraticCurveTo(zb + 0.07, b - 0.35, zb + 0.16, Math.max(fl + 0.28, b - 0.37));
	pro.lineTo(zf, fl + 0.25);
	pro.closePath();
	const dw = 2 * (halfW(zb) * 0.86 - 0.04);
	const dash = new THREE.ExtrudeGeometry(pro, { depth: dw, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.012, bevelSegments: 2, curveSegments: 5 });
	out.push(tag(dash.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -dw / 2, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1)), 7));
	// the gauges under their hood, facing you over the wheel
	out.push(tag(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.75, 1).translate(wx, b + 0.02, zb + 0.12), 7));
	out.push(tag(new THREE.CircleGeometry(0.16, 12, 0, Math.PI).scale(1, 0.75, 1).translate(wx, b + 0.02, zb + 0.2), 7));
	out.push(screen(0.28, 0.095, 0, M4(wx, b + 0.075, zb + 0.17, 0.3).multiply(new THREE.Matrix4().makeRotationY(Math.PI))));
	// the vents across its face, and a bright strip under them
	const faceZ = (y) => zb + (b - 0.07 - y) / 0.21 * 0.05 - 0.014;
	for (const vx of [-(dw / 2 - 0.13), -0.19, 0.19, dw / 2 - 0.13]) out.push(rbox(0.15, 0.05, 0.02, 0.008, 13, M4(vx, b - 0.1, faceZ(b - 0.1))));
	out.push(rbox(dw - 0.08, 0.012, 0.01, 0.004, 16, M4(0, b - 0.145, faceZ(b - 0.145))));
	// the screen in the middle, standing on the dash
	if (!big) out.push(screen(0.24, 0.14, 1, M4(0, b + 0.075, zb + 0.14, 0.18).multiply(new THREE.Matrix4().makeRotationY(Math.PI))), rbox(0.26, 0.16, 0.025, 0.008, 7, M4(0, b + 0.075, zb + 0.155, 0.18)));
	// the console between the front seats, down from the dash, and the gear selector
	if (!big) {
		const [, sy0, sz0] = C.seats[0];
		out.push(rbox(0.2, sy0 - fl, 0.7, 0.04, 7, M4(0, (sy0 + fl) / 2, sz0 - 0.05)));
		out.push(rbox(0.22, b - 0.22 - fl, 0.3, 0.03, 7, M4(0, (b - 0.22 + fl) / 2, zb + 0.18)));
		out.push(tag(new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.3, 1.4).translate(0, sy0 + 0.04, sz0 + 0.18), 16));
		// arm rests along the doors
		for (const s of [-1, 1]) out.push(rbox(0.07, 0.05, 0.7, 0.02, 7, M4(s * (halfW(sz0) * 0.9 - 0.05), sy0 + 0.2, sz0 - 0.05)));
	}
	// the steering wheel, tilted toward you: its rim, three spokes to the hub, the column
	const R = big ? 0.24 : 0.185, W = [];
	W.push([new THREE.TorusGeometry(R, 0.022, 8, 28), 7]);
	W.push([new RoundedBoxGeometry(0.13, 0.1, 0.05, 1, 0.02).translate(0, -0.005, -0.02), 7]);
	for (const s of [-1, 1]) W.push([new THREE.BoxGeometry(R - 0.07, 0.036, 0.016).translate(s * (0.065 + (R - 0.07) / 2), -0.012, -0.008), 16]);
	W.push([new THREE.BoxGeometry(0.038, R - 0.055, 0.016).translate(0, -(0.05 + (R - 0.055) / 2), -0.008), 7]);
	for (const [geo, pt] of W) out.push(tag(geo.rotateX(-0.45).translate(wx, wy, wz), pt));
	out.push(tag(new THREE.CylinderGeometry(0.03, 0.045, 0.34, 8).rotateX(Math.PI / 2 - 0.45).translate(wx, wy - 0.07, wz + 0.16), 7));
	// the mirror, hung from the glass just ahead of the roof
	if (!big && S.box === undefined) {
		const zm = Math.min(S.rf + 0.14, S.ws - 0.1), ym = top(zm) - 0.1;
		out.push(rbox(0.23, 0.066, 0.03, 0.012, 7, M4(0, ym, zm)));
		out.push(tag(new THREE.PlaneGeometry(0.21, 0.05).rotateY(Math.PI).translate(0, ym, zm - 0.016), 9));
		out.push(tag(new THREE.CylinderGeometry(0.01, 0.014, 0.09, 5).translate(0, ym + 0.06, zm + 0.02), 7));
	}
	return out;
}

// a sky to reflect: blue overhead, a bright hazy horizon, the dark street below (the real
// models' trim and chrome still use it; the paint and glass reflect the live sky, below)
let sky = null;
function skyEnv() {
	if (sky) return sky;
	const W = 64, H = 32, d = new Uint8Array(W * H * 4);
	for (let y = 0; y < H; y++) {
		const v = 1 - y / (H - 1), el = (v - 0.5) * Math.PI;                       // +pi/2 straight up
		let c;
		if (el > 0) { const t = Math.pow(1 - el / (Math.PI / 2), 3); c = [110 + 120 * t, 150 + 90 * t, 205 + 40 * t]; }
		else { const t = Math.min(1, -el * 5); c = [200 - 150 * t, 200 - 150 * t, 196 - 144 * t]; }
		for (let x = 0; x < W; x++) d.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
	}
	const t = new THREE.DataTexture(d, W, H);
	t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
	return (sky = t);
}
export { skyEnv };

// The live sky in the paint and the glass, worked out in the shader (no texture): the sky's
// own colours and clouds, trees and roofs dark along the horizon, the street below; blurred
// as the surface roughens. bindCarSky(shared) ties it to the sky (world/sky.js keeps these
// current); until then it is a fair day.
export const carSky = {
	uSkyZen: { value: new THREE.Color(0.22, 0.4, 0.75) }, uSkyHor: { value: new THREE.Color(0.68, 0.76, 0.85) }, uSunColor: { value: new THREE.Color(1, 0.95, 0.86) },
	uCloudR: { value: new THREE.Vector4(0, 0, 0.62, 0) }, uCloudR2: { value: new THREE.Vector4() }, uCloudR3: { value: new THREE.Vector4(0, 0, 1, 0) }, uAirR: { value: new THREE.Vector4() },
};
export function bindCarSky(shared) {
	const U = { uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor, uSunColor: shared.uSunColor, ...cloudReflectU(shared) };
	for (const k of Object.keys(carSky)) if (U[k]) carSky[k].value = U[k].value;
}
const SKY_GLSL = CLOUD_REFLECT_GLSL + `
uniform vec3 uSkyZen, uSkyHor, uSunColor;
vec3 carSky(vec3 d, float r) {
	d = normalize(d);
	vec3 sky = mix(uSkyHor, uSkyZen, pow(clamp(d.y, 0.0, 1.0), 0.5));
#ifndef CAR_CHEAP
	if (r < 0.3) sky = skyReflect(d, uSkyZen, uSkyHor, uSunColor);
#endif
	sky = mix(sky, mix(uSkyHor, uSkyZen, 0.45), smoothstep(0.25, 0.9, r));
	float a = atan(d.z, d.x);
	float sil = 0.02 + 0.09 * crN(vec2(a * 5.0, 0.5)) * crN(vec2(a * 17.0, 3.5)) + 0.025 * crN(vec2(a * 40.0, 7.0));
	float bl = 0.008 + r * 0.25;
	vec3 land = mix(uSkyHor * vec3(0.13, 0.14, 0.13), uSkyHor * vec3(0.26, 0.27, 0.26), smoothstep(-0.3, 0.0, d.y));
	return mix(land, sky, smoothstep(sil - bl, sil + bl, d.y));
}
`;
// (added to the light from the surroundings, the base layer and the clear coat each by its
// own roughness; carEnv 0 for what is inside the car)
const SKY_MAPS = `#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular )
if (carEnv > 0.0) {
	radiance += carSky((vec4(reflect(-geometryViewDir, geometryNormal), 0.0) * viewMatrix).xyz, material.roughness) * carEnv;
	#ifdef USE_CLEARCOAT
	if (material.clearcoat > 0.0) clearcoatRadiance += carSky((vec4(reflect(-geometryViewDir, geometryClearcoatNormal), 0.0) * viewMatrix).xyz, material.clearcoatRoughness) * carEnv;
	#endif
}
#endif`;
// the live sky for another material's shader (the real models' paint)
export function withCarSky(sh) {
	Object.assign(sh.uniforms, carSky);
	sh.fragmentShader = SKY_GLSL + 'float carEnv = 1.0;\n' + sh.fragmentShader.replace('#include <lights_fragment_maps>', SKY_MAPS);
}

const VERT = (sh) => 'attribute vec4 aE; attribute vec4 aW; attribute vec3 aD; attribute vec4 aS; varying vec4 vE; varying vec3 vLP; varying vec4 vW; varying vec3 vD; varying vec4 vS;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvE = aE; vLP = position; vW = aW; vD = aD; vS = aS;');
const HEAD = `uniform float uNightS; varying vec4 vE; varying vec3 vLP; varying vec4 vW; varying vec3 vD; varying vec4 vS;
float band(float x, float a, float b, float w) { return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }
` + SKY_GLSL;

// parts (aE.w): 0 paint, 1 glass, 2 tyre, 4 a pickup's bed, 5 a far wheel's rim, 6 seats and
// carpet, 7 dash and trim, 8 a wheel well, 9 a mirror, 10 chrome, 11 a screen, 12 alloy,
// 13 dark metal, 16 satin metal
const PAINT = /* glsl */`
{
	float yN = vE.y, xN = vE.z, P = floor(vE.w + 0.5);
	float z = vLP.z, L2 = vS.x, xa = abs(vLP.x) / max(vS.y, 0.1);
	if (!gl_FrontFacing && P < 1.5) {
		// the body's inside: the headliner overhead, below the glass the door cards, a rest
		// for the arm along them
		carEnv = 0.0; carCoat = 0.0; carRough = 0.95;
		diffuseColor.rgb = yN > 1.03 ? vec3(0.16, 0.155, 0.145) : yN > 0.86 ? vec3(0.045) : abs(yN - 0.7) < 0.035 ? vec3(0.06, 0.057, 0.053) : vec3(0.028);
	}
	else if (P > 15.5) { diffuseColor.rgb = vec3(0.42, 0.43, 0.44); carRough = 0.35; carMetal = 0.9; carCoat = 0.0; }
	else if (P > 12.5) { diffuseColor.rgb = vec3(0.045, 0.045, 0.048); carRough = 0.45; carMetal = 0.7; carCoat = 0.0; }
	else if (P > 11.5) {
		// alloy, a dark cap at the centre
		float rr = length(vE.xy) / max(vE.z, 0.01);
		diffuseColor.rgb = mix(vec3(0.6, 0.61, 0.63), vec3(0.05), step(rr, 0.07)); carRough = 0.25; carMetal = 0.9; carCoat = 0.0;
	}
	else if (P > 10.5) {
		// the screens: the gauges (two dials, a small display between) or the map in the middle
		vec2 q = vE.xy; vec3 c = vec3(0.0);
		if (vE.z < 0.5) {
			for (int k = 0; k < 2; k++) {
				float cx = k == 0 ? 0.25 : 0.75, na = k == 0 ? -0.9 : -1.7;
				vec2 p = vec2((q.x - cx) * 3.2, q.y - 0.5);
				float r = length(p), a = atan(p.x, p.y), arc = step(abs(a), 2.4);
				c += vec3(0.45, 0.5, 0.55) * band(r, 0.39, 0.42, 0.012) * arc;
				c += vec3(0.6) * step(fract(a / 0.3), 0.18) * band(r, 0.32, 0.39, 0.01) * arc;
				vec2 nd = vec2(sin(na), cos(na));
				c += vec3(1.0, 0.3, 0.08) * (1.0 - smoothstep(0.01, 0.025, abs(p.x * nd.y - p.y * nd.x))) * step(0.0, dot(p, nd)) * step(r, 0.36);
			}
			c += vec3(0.07, 0.11, 0.15) * band(q.x, 0.43, 0.57, 0.01) * band(q.y, 0.22, 0.78, 0.02);
		} else {
			vec2 g = fract(q * vec2(4.0, 2.6) + vec2(0.3, 0.1));
			float road = max(1.0 - smoothstep(0.02, 0.05, abs(g.x - 0.5)), 1.0 - smoothstep(0.03, 0.07, abs(g.y - 0.5)));
			c = mix(vec3(0.03, 0.04, 0.05), vec3(0.13, 0.14, 0.15), road);
			c = mix(c, vec3(0.1, 0.35, 0.95), (1.0 - smoothstep(0.012, 0.03, abs(q.x - 0.4 - 0.25 * q.y))) * step(q.y, 0.84));
			c = mix(c, vec3(0.06, 0.065, 0.07), step(0.84, q.y));
		}
		diffuseColor.rgb = vec3(0.004); carRough = 0.15; carCoat = 0.0; carEnv = 0.4;
		carGlow = c * (0.6 + 0.8 * uNightS);
	}
	else if (P > 9.5) { diffuseColor.rgb = vec3(0.9); carRough = 0.07; carMetal = 1.0; carCoat = 0.0; }
	else if (P > 8.5) { diffuseColor.rgb = vec3(0.75); carRough = 0.02; carMetal = 1.0; carCoat = 0.0; }
	else if (P > 7.5) { diffuseColor.rgb = vec3(0.012); carRough = 0.95; carCoat = 0.0; carEnv = 0.0; }
	else if (P > 6.5) { diffuseColor.rgb = vec3(0.03); carRough = 0.6; carCoat = 0.0; carEnv = 0.3; }
	else if (P > 5.5) { diffuseColor.rgb = vec3(0.055, 0.052, 0.05); carRough = 0.95; carCoat = 0.0; carEnv = 0.15; }
	else if (P > 4.5) {
		// a far wheel's rim: five spokes painted on, dark between them and at the hub
		float a = atan(vE.x, vE.y), rr = length(vE.xy) / max(vE.z, 0.01);
		float gap = smoothstep(0.55, 0.75, abs(cos(a * 2.5))) * step(0.22, rr) * step(rr, 0.56);
		diffuseColor.rgb = mix(vec3(0.58, 0.59, 0.61), vec3(0.03), max(gap, step(rr, 0.1)));
		carRough = 0.28; carMetal = 0.8; carCoat = 0.0;
	}
	else if (P > 3.5) { diffuseColor.rgb = vec3(0.05); carRough = 0.8; carCoat = 0.0; }
	else if (P > 1.5) {
		// the tyre: the tread darker, cut by its grooves; a band of raised lettering round
		// the sidewall
		float rr = length(vE.xy) / max(vE.z, 0.01), a = atan(vE.x, vE.y);
		float tread = step(0.93, rr), groove = tread * max(1.0 - smoothstep(0.004, 0.009, abs(abs(vLP.x) - 0.045)), step(0.8, fract(a * 9.55)) * 0.5);
		float letters = (1.0 - tread) * band(rr, 0.8, 0.88, 0.005) * step(0.45, fract(a * 6.0)) * step(0.3, fract(a * 47.0));
		diffuseColor.rgb = vec3(mix(0.028, 0.018, tread) + letters * 0.018) * (1.0 - groove * 0.6);
		carRough = mix(0.72, 0.9, tread); carCoat = 0.0; carEnv = 0.5;
	}
	else if (P > 0.5) { diffuseColor.rgb = vec3(0.012, 0.015, 0.018); carRough = 0.04; }         // glass (seen dark)
	else {
		carFlop = 1.0;
		float st = vS.z, clad = vS.w;
		float aU = fwidth(xa) + 1e-4, aV = fwidth(yN) + 1e-4;
		// the wheel arches: cut out of the body, so the tyre shows through with the dark well
		// behind it; round the cut a black arch on the tall cars, a rolled lip on the rest
		float ad = length(vec2(abs(z) - vW.x, vLP.y - vW.y));
		if (step(0.7, xN) * step(ad, vW.y + 0.09) > 0.5) discard;
		float arch = step(0.7, xN) * (1.0 - smoothstep(vW.y + 0.1, vW.y + (clad > 0.5 ? 0.16 : 0.115), ad));
		float black = max(1.0 - smoothstep(0.0, aV, yN - (clad > 0.5 ? 0.17 : 0.06)), clad * arch);
		// the lamps, the grille and the plate at the nose, the tail lamps (a reversing lamp
		// at their inner end) at the back: each kind's style (st 0 a car's swept lamps, 1 the
		// tall cars' square ones and chrome grille, 2 the vans' and trucks' upright ones)
		float fr = smoothstep(L2 - 0.55, L2 - 0.45, z) * (1.0 - step(1.0, yN)), bk = smoothstep(-L2 + 0.55, -L2 + 0.45, z) * (1.0 - step(1.0, yN));
		float lamp = 0.0, grille = 0.0, chrome = 0.0, plate = 0.0, tl = 0.0, rev = 0.0;
		if (fr > 0.0) {
			if (st < 0.5) {
				float t = clamp((xa - 0.5) / 0.45, 0.0, 1.0);
				lamp = band(xa, 0.5, 0.95, aU) * band(yN, 0.64 + 0.12 * t, 0.8 + 0.1 * t, aV);
				grille = max(band(xa, -1.0, 0.36, aU) * band(yN, 0.56, 0.7, aV), band(xa, -1.0, 0.62, aU) * band(yN, 0.16, 0.42, aV) * (0.85 + 0.15 * step(0.5, fract(xa * 30.0))));
			} else if (st < 1.5) {
				lamp = band(xa, 0.56, 0.95, aU) * band(yN, 0.66, 0.86, aV);
				grille = band(xa, -1.0, 0.5, aU) * band(yN, 0.38, 0.84, aV);
				chrome = grille * (1.0 - band(xa, -1.0, 0.465, aU) * band(yN, 0.41, 0.81, aV));
				grille *= 0.7 + 0.3 * step(0.5, fract(yN * 26.0));
			} else {
				lamp = band(xa, 0.64, 0.94, aU) * band(yN, 0.58, 0.82, aV);
				grille = band(xa, -1.0, 0.58, aU) * band(yN, 0.4, 0.72, aV) * (0.7 + 0.3 * step(0.5, fract(yN * 22.0)));
			}
			plate = band(xa, -1.0, 0.16, aU) * band(yN, 0.2, 0.34, aV);
			lamp *= fr; grille *= fr; chrome *= fr; plate *= fr;
		}
		if (bk > 0.0) {
			float x0 = st < 0.5 ? 0.5 : st < 1.5 ? 0.66 : 0.8;
			tl = band(xa, x0, 0.97, aU) * band(yN, st < 0.5 ? 0.7 : st < 1.5 ? 0.55 : 0.3, st < 0.5 ? 0.9 : st < 1.5 ? 0.92 : 0.85, aV) * bk;
			rev = tl * band(xa, x0, x0 + 0.07, aU);
			plate = band(xa, -1.0, 0.18, aU) * band(yN, st < 1.5 ? 0.42 : 0.3, st < 1.5 ? 0.58 : 0.46, aV) * bk;
			black = max(black, clad * (1.0 - smoothstep(0.3, 0.3 + aV, yN)) * bk);
		}
		// the split lines: the bumpers round the nose and tail from arch to arch, the hood's and
		// the boot's along the top, the doors down the side, with a handle toward each door's
		// back edge; a bright strip along the foot of the side glass
		float lw = aV * 1.5, w = max(fwidth(z) * 1.2, 0.004), side = step(0.93, xN) * step(0.2, yN) * step(yN, 1.02);
		float seam = step(0.5, xN) * max(step(vW.x + vW.y + 0.12, z) * (1.0 - smoothstep(0.0, lw, abs(yN - 0.55))), step(z, -vW.x - vW.y - 0.12) * (1.0 - smoothstep(0.0, lw, abs(yN - 0.64))));
		seam = max(seam, step(1.0, yN) * step(yN, 1.2) * (1.0 - smoothstep(0.0, fwidth(xN) * 1.5 + 0.002, abs(xN - 0.84))) * max(step(vW.z + 0.05, z), step(st, 0.5) * step(z, vW.w - 0.05)));
		seam = max(seam, side * max(max(1.0 - smoothstep(0.0, w, abs(z - vD.x)), 1.0 - smoothstep(0.0, w, abs(z - vD.y))), 1.0 - smoothstep(0.0, w, abs(z - vD.z))));
		seam = max(seam, step(0.93, xN) * step(vD.z, z) * step(z, vD.x) * (1.0 - smoothstep(0.0, 0.012, abs(yN - 0.2))));
		float hz = z - vD.y, hz2 = z - vD.z;
		float handle = step(0.93, xN) * step(abs(yN - 0.8), 0.03) * max(step(abs(hz - 0.2), 0.08) * step(vD.y, 8.0), step(abs(hz2 - 0.2), 0.08) * step(vD.z, 8.0));
		chrome = max(chrome, step(vD.x, 8.0) * band(yN, 0.972, 1.004, 0.002) * step(0.86, xN) * step(z, vD.x) * step(vD.z < 8.0 ? vD.z : vD.y - 0.9, z));
		vec3 col = diffuseColor.rgb;
		col = mix(col, col * 0.4, arch * (1.0 - clad));
		col = mix(col, vec3(0.035), black);
		col = mix(col, vec3(0.018), grille);
		col = mix(col, vec3(0.75, 0.76, 0.74), plate);
		col = mix(col, col * 0.25, seam);
		col = mix(col, col * 0.55 + 0.05, handle);
		col = mix(col, vec3(0.7, 0.72, 0.74), lamp);
		col = mix(col, vec3(0.42, 0.02, 0.02), tl);
		col = mix(col, vec3(0.8), rev);
		col = mix(col, vec3(0.9), chrome);
		diffuseColor.rgb = col;
		if (black + grille > 0.5) { carRough = 0.65; carCoat = 0.0; carFlop = 0.0; }
		if (plate > 0.5) { carRough = 0.5; carCoat = 0.0; carFlop = 0.0; }
		if (lamp + tl > 0.5) { carRough = 0.05; carFlop = 0.0; }
		if (chrome > 0.5) { carRough = 0.07; carMetal = 1.0; carCoat = 0.0; carFlop = 0.0; }
		carGlow = (lamp * vec3(1.0, 0.93, 0.8) * 2.5 + (tl - rev) * vec3(1.0, 0.05, 0.02) * 1.8) * uNightS;
	}
}`;

// o.cheap (phones): the plain sky in the reflections, not its clouds
export function carMaterial(night, o = {}) {
	const m = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
	if (o.cheap) m.defines = { CAR_CHEAP: '' };
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, carSky, { uNightS: night });
		sh.vertexShader = VERT(sh);
		sh.fragmentShader = HEAD + 'vec3 carGlow = vec3(0.0); float carRough = -1.0, carMetal = -1.0, carCoat = 1.0, carEnv = 1.0, carFlop = 0.0;\n' + sh.fragmentShader
			.replace('#include <color_fragment>', '#include <color_fragment>\n' + PAINT)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (carRough >= 0.0) roughnessFactor = carRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (carMetal >= 0.0) metalnessFactor = carMetal;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += carGlow;')
			// (the paint darkens a little toward its edges, so the body's curves read)
			.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= carCoat;\nmaterial.diffuseColor *= mix(1.0, 0.6 + 0.4 * pow(saturate(dot(normal, normalize(vViewPosition))), 0.5), carFlop);')
			.replace('#include <lights_fragment_maps>', SKY_MAPS);
	};
	m.customProgramCacheKey = () => 'baycar4' + (o.cheap ? 'c' : '');
	return m;
}

// glass you see into: at a glance straight in, the cabin through a light tint; toward the
// edges and at a slant, more and more the sky (Fresnel). Seen from inside, clear. The
// pillars between the panes are black: where the side glass meets the windshield and the
// rear glass, and the B pillar between the doors. (For the real models too: they have none
// of the attributes, so no pillars.)
export function carGlassMaterial(o = {}) {
	const m = new THREE.MeshPhysicalMaterial({ color: 0x0d1418, roughness: 0.04, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide });
	if (o.cheap) m.defines = { CAR_CHEAP: '' };
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, carSky, { uNightS: { value: 0 } });
		sh.vertexShader = VERT(sh);
		sh.fragmentShader = HEAD + 'float carPil = 0.0;\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				diffuseColor.rgb = vec3(0.02, 0.026, 0.03);
				if ((vE.w > 1.04 && vE.w < 1.26) || (abs(vLP.z - vD.y) < 0.05 && vD.y < 8.0 && vE.z > 0.5)) { diffuseColor.rgb = vec3(0.012); carPil = 1.0; }`)
			.replace('#include <opaque_fragment>', `#include <opaque_fragment>
				if (carPil < 0.5) {
					float F = 0.04 + 0.96 * pow(1.0 - saturate(dot(normal, geometryViewDir)), 5.0);
					vec3 refl = carSky((vec4(reflect(-geometryViewDir, normal), 0.0) * viewMatrix).xyz, 0.03);
					float T = 0.62;
					if (!gl_FrontFacing) { F *= 0.25; refl *= 0.1; T = 0.84; }
					float a = 1.0 - T * (1.0 - F);
					gl_FragColor = vec4((refl * F + outgoingLight) / a, a);
				} else gl_FragColor.a = 1.0;`);
	};
	m.customProgramCacheKey = () => 'bayglass2' + (o.cheap ? 'c' : '');
	return m;
}
