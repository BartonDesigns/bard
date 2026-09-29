// Cars with real proportions and smooth bodies. Each body is lofted: a cross-section
// (a rounded sill, a side that bulges slightly, the shoulder, the glass leaning in to
// the roof) swept along the car's length, its height following the hood, windshield,
// roof, rear glass and deck, its width rounding off in plan at the nose and tail. The
// shader paints glass, lamps, grille, lower trim, door seams and handles and the wheel
// arches from where each point sits on the body; the paint is a clear coat that reflects
// the sky. Close by a body also has its mirrors, liners in the wheel wells, and a cabin
// you can see into through the glass: seats, the dash, the steering wheel.
//
// The close cars, the sports car, the crossover, the delivery van and the bus, are real
// models (vehicles/models.js); these lofts stand in for them further off and until they
// have loaded, and are every other kind at every distance.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// L length, W width, H height, belt (base of the glass), ws (windshield foot, from the
// centre toward the front), rf/rr (roof front and rear), rb (rear glass foot), wz (axle),
// nose (how far the hood drops to the nose), bed (a pickup's load bed behind the cab),
// clear (ground clearance), wr (tyre radius), hip (the seat's height), doors (front door's
// leading edge, the B pillar, the rear door's trailing edge; null where there is none),
// panel (no glass behind this: a van's load space), box (a truck's box starts behind this,
// boxH high), plan (how square the nose and tail are in plan), tumble (how far the glass
// leans in: 1 upright)
export const SPEC = {
	sedan: { L: 4.75, W: 1.84, H: 1.45, belt: 0.93, ws: 0.95, rf: 0.1, rr: -0.95, rb: -1.55, wz: 1.42, nose: 0.2, clad: 0.14, hip: 0.55, doors: [0.86, -0.18, -1.2] },
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
const def = (S) => Object.assign({ clear: 0.3, wr: 0.34, tw: 0.23, plan: 5, tumble: 0.72, panel: -1e9 }, S);
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
	return { seats, wheel: [x, S.hip + 0.36, front + 0.42], eye: [x, S.hip + 0.72, front - 0.12] };
}

// NS: sections along the body, WS: sides round each tyre (cars in the distance use fewer
// of both; they are many). opts: wheels (built in, or left for the caller to turn), cabin
// (mirrors, wheel-well liners, seats, dash and wheel: the close ones), glass (the glass as
// a second group, for a see-through material)
export function carGeometry(kind, NS = 48, WS = 20, opts = {}) {
	const { wheels = true, cabin = false, glass = false } = opts;
	const S = def(SPEC[kind]), L2 = S.L / 2;
	const bottom = (s) => S.clear + 0.1 * sm(L2 - 0.55, L2, Math.abs(s));
	// the belt line: the hood falls to the nose, the deck is level
	const belt = (s) => S.belt - (s > S.ws ? S.nose * Math.pow(sm(S.ws, L2, s), 1.3) : 0) - (s < S.rb ? 0.04 * sm(S.rb, -L2, s) : 0);
	// the roof line: up the windshield, across the roof, down the rear glass
	const top = (s) => {
		const b = belt(s);
		if (S.bed !== undefined && s < S.bed) return b;                                      // a pickup's bed is open
		if (S.box !== undefined) {
			// a box truck: the cab, then the box standing taller behind it
			if (s < S.box) return S.H - 0.02 * sm(-L2 + 0.2, -L2, s);
			return s > S.rf ? b + (S.cabH - b) * sm(S.ws, S.rf, s) : S.cabH;
		}
		if (s > S.rf) return b + (S.H - b) * sm(S.ws, S.rf, s);
		if (s < S.rr) return b + (S.H - b) * sm(S.rb, S.rr, s);
		return S.H + 0.02 * Math.sin((s - S.rr) / (S.rf - S.rr) * Math.PI);
	};
	// half width in plan, rounded off at the nose and tail
	const halfW = (s) => { const u = Math.abs(s) / L2, e = S.plan; return S.W / 2 * Math.pow(Math.max(0, 1 - Math.pow(u, s > 0 ? e : e + 1)), 1 / e) * (1 - 0.02 * Math.max(0, s / L2)); };
	const P = [], E = [];
	const ring = [];
	for (let k = 0; k <= NS; k++) {
		const u = -1 + 2 * k / NS, s = L2 * Math.sin(u * Math.PI / 2);
		const b0 = bottom(s), bl = belt(s), tp = top(s), wb = halfW(s);
		const g = Math.min(1, Math.max(0, (tp - bl - 0.02) / Math.max(0.3, (S.box !== undefined ? S.cabH : S.H) - S.belt)));
		const inBox = S.box !== undefined && s < S.box;
		const glassHere = g > 0.3 && s > S.panel && !inBox ? 1 : 0, roofHere = tp > S.H - 0.05 || (S.box !== undefined && tp > S.cabH - 0.05) ? 1 : 0;
		const bed = S.bed !== undefined && s < S.bed ? 1 : 0;
		// the half section, from under the car round the side to the centre of the top
		const deck = [[wb * 0.9, bl + 0.02], [wb * 0.78, bl + 0.035], [wb * 0.6, bl + 0.045], [wb * 0.34, bl + 0.05], [0, bl + 0.05]];
		const tum = inBox ? 0.99 : S.tumble;
		const wg = wb * (0.86 + (tum - 0.72) * 0.45), wr = wb * tum;
		const house = [[wg, bl + 0.03], [wg * 0.93 + wr * 0.07, bl + (tp - bl) * 0.55], [wr, tp - 0.05], [wr * 0.78, tp], [0, tp + 0.02]];
		const half = [[0, b0], [wb * 0.7, b0], [wb * 0.95, b0 + 0.06], [wb, b0 + 0.22], [wb * 1.01, (b0 + bl) / 2], [wb * 0.985, bl - 0.1], [wb * 0.94, bl]];
		for (let n = 0; n < 5; n++) half.push([deck[n][0] + (house[n][0] - deck[n][0]) * g, deck[n][1] + (house[n][1] - deck[n][1]) * g]);
		// part per point: 0 paint, 1 glass, 4 the bed
		const part = half.map((_, n) => n < 7 ? 0 : bed && n > 7 ? 4 : n <= 9 ? glassHere : glassHere && !roofHere ? 1 : 0);
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
	const tag = (geo, pt, e = null) => {
		const g = geo.index ? geo.toNonIndexed() : geo;
		g.deleteAttribute('uv');
		const n = g.attributes.position.count, a = new Float32Array(n * 4);
		for (let i = 0; i < n; i++) { if (e) e(g.attributes.position, i, a); a[i * 4 + 3] = pt; }
		g.setAttribute('aE', new THREE.BufferAttribute(a, 4));
		return g;
	};
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
			const liner = new THREE.CylinderGeometry(r, r, S.W / 2 - x0 + 0.02, 14, 1, true, 0.08 * Math.PI, 0.84 * Math.PI).rotateZ(Math.PI / 2);
			liner.translate(sx * (x0 + (S.W / 2 - x0) / 2), y, z);
			parts.push(tag(liner, 8));
			parts.push(tag(new THREE.CircleGeometry(r, 14, 0, Math.PI).rotateY(Math.PI / 2).translate(sx * x0, y, z), 8));
		}
		parts.push(...cabinGeometry(kind, S, belt, halfW, tag));
	}
	const g = mergeGeometries(parts);
	// the axle's distance from the centre and the tyre's radius (for the wheel arches in
	// the shader), and where the door seams run
	const n = g.attributes.position.count, aw = new Float32Array(n * 2), ad = new Float32Array(n * 3);
	const D = S.doors || [9, 9, 9];
	for (let i = 0; i < n; i++) { aw[i * 2] = S.wz; aw[i * 2 + 1] = S.wr; ad[i * 3] = D[0] ?? 9; ad[i * 3 + 1] = D[1] ?? 9; ad[i * 3 + 2] = D[2] ?? 9; }
	g.setAttribute('aW', new THREE.BufferAttribute(aw, 2));
	g.setAttribute('aD', new THREE.BufferAttribute(ad, 3));
	if (glass) splitGlass(g);
	g.computeBoundingSphere();
	return g;
}

// the glass's triangles last, as their own group: [everything else, glass]
function splitGlass(g) {
	const E = g.attributes.aE, n = g.attributes.position.count / 3, order = [], tail = [];
	for (let t = 0; t < n; t++) { const gl = E.getW(t * 3) === 1 && E.getW(t * 3 + 1) === 1 && E.getW(t * 3 + 2) === 1; (gl ? tail : order).push(t); }
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
// toward +x (mirror it for the right side). aE.xy: the point's place round the hub, for
// the spokes
export function wheelGeometry(kind, WS = 20) {
	const S = def(SPEC[kind]), r = S.wr, w = S.tw;
	// the tyre's section: bead, sidewall, a rounded shoulder, the tread, and back
	const rb = r * 0.64, sh = 0.05, prof = [new THREE.Vector2(rb, -w / 2 + 0.02), new THREE.Vector2(r - sh, -w / 2)];
	for (let i = 1; i < 4; i++) { const a = Math.PI / 2 * i / 4; prof.push(new THREE.Vector2(r - sh + Math.sin(a) * sh, -w / 2 + sh - Math.cos(a) * sh)); }
	prof.push(new THREE.Vector2(r, -w / 2 + sh), new THREE.Vector2(r, w / 2 - sh));
	for (let i = 1; i < 4; i++) { const a = Math.PI / 2 * i / 4; prof.push(new THREE.Vector2(r - sh + Math.cos(a) * sh, w / 2 - sh + Math.sin(a) * sh)); }
	prof.push(new THREE.Vector2(r - sh, w / 2), new THREE.Vector2(rb, w / 2 - 0.02));
	const tyre = new THREE.LatheGeometry(prof, WS).rotateZ(-Math.PI / 2);
	// the rim: a shallow dish, its face just inside the sidewall
	const rim = new THREE.CylinderGeometry(rb * 1.02, rb * 0.92, 0.05, WS, 1).rotateZ(Math.PI / 2).translate(w / 2 - 0.05, 0, 0);
	const hub = new THREE.CylinderGeometry(rb * 0.25, rb * 0.3, 0.04, 8).rotateZ(Math.PI / 2).translate(w / 2 - 0.02, 0, 0);
	const out = [];
	for (const [geo, pt] of [[tyre, 2], [rim, 5], [hub, 5]]) {
		const g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv');
		const p = g.attributes.position, e = new Float32Array(p.count * 4);
		for (let i = 0; i < p.count; i++) { e[i * 4] = p.getY(i); e[i * 4 + 1] = p.getZ(i); e[i * 4 + 2] = r; e[i * 4 + 3] = pt; }
		g.setAttribute('aE', new THREE.BufferAttribute(e, 4));
		out.push(g);
	}
	return mergeGeometries(out);
}

// the cabin: a floor, front seats (and a back seat), the dash, the steering wheel
function cabinGeometry(kind, S, belt, halfW, tag) {
	const out = [], L2 = S.L / 2, C = seatsOf(kind);
	const blob = (sx, sy, sz, x, y, z, tilt, pt) => out.push(tag(new THREE.SphereGeometry(1, 10, 7).scale(sx, sy, sz).rotateX(tilt).translate(x, y, z), pt));
	const fl = S.clear + 0.1;
	// the floor, from the footwells back
	out.push(tag(new THREE.PlaneGeometry(S.W * 0.8, Math.max(1, S.ws - (S.bed ?? S.rr ?? -L2))).rotateX(-Math.PI / 2).translate(0, fl + 0.02, (S.ws + (S.bed ?? S.rr)) / 2), 6));
	C.seats.forEach(([x, y, z]) => {
		// cushion, back (leaning back), head rest
		blob(0.24, 0.075, 0.25, x, y - 0.03, z - 0.2, 0, 6);
		blob(0.23, 0.3, 0.075, x, y + 0.3, z - 0.46, -0.24, 6);
		blob(0.13, 0.09, 0.06, x, y + 0.66, z - 0.55, -0.24, 6);
		// the seat's base down to the floor
		if (y - fl > 0.25) out.push(tag(new THREE.CylinderGeometry(0.16, 0.2, y - fl - 0.05, 6).translate(x, (y + fl) / 2 - 0.05, z - 0.2), 7));
	});
	// the dash, under the windshield, and the console between the front seats
	const dz = Math.min(S.ws - 0.18, C.wheel[2] + 0.28), db = belt(dz);
	blob(halfW(dz) * 0.92, 0.13, 0.26, 0, db - 0.1, dz, 0, 7);
	blob(0.1, 0.12, 0.45, 0, C.seats[0][1] - 0.02, C.seats[0][2] + 0.05, 0, 7);
	// the steering wheel, tilted toward the driver, on its column
	const [wx, wy, wz] = C.wheel;
	const rim = new THREE.TorusGeometry(kind === 'bus' || kind === 'truck' ? 0.24 : 0.185, 0.02, 6, 18).rotateX(-0.45).translate(wx, wy, wz);
	out.push(tag(rim, 7));
	out.push(tag(new THREE.CylinderGeometry(0.03, 0.035, 0.34, 6).rotateX(Math.PI / 2 - 0.45).translate(wx, wy - 0.06, wz + 0.16), 7));
	blob(0.06, 0.06, 0.03, wx, wy, wz + 0.01, -0.45, 7);
	return out;
}

// a sky to reflect: blue overhead, a bright hazy horizon, the dark street below
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

const VERT = (sh) => 'attribute vec4 aE; attribute vec2 aW; attribute vec3 aD; varying vec4 vE; varying vec3 vLP; varying vec2 vW; varying vec3 vD;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvE = aE; vLP = position; vW = aW; vD = aD;');
const HEAD = 'uniform float uNightS; varying vec4 vE; varying vec3 vLP; varying vec2 vW; varying vec3 vD;\n';

export function carMaterial(night) {
	const m = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.06, envMap: skyEnv(), envMapIntensity: 0.9, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightS = night;
		sh.vertexShader = VERT(sh);
		sh.fragmentShader = HEAD + 'vec3 carGlow = vec3(0.0); float carRough = -1.0; float carCoat = 1.0;\n' + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				{
					float e = vE.x, yN = vE.y, xN = vE.z, part = vE.w;
					if (!gl_FrontFacing && part < 5.5) { diffuseColor.rgb = vec3(0.015); carRough = 1.0; carCoat = 0.0; }             // inside the body
					else if (part > 8.5) { diffuseColor.rgb = vec3(0.3, 0.33, 0.36); carRough = 0.02; carCoat = 0.0; }                     // a mirror's glass
					else if (part > 7.5) { diffuseColor.rgb = vec3(0.012); carRough = 0.95; carCoat = 0.0; }                              // a wheel well
					else if (part > 6.5) { diffuseColor.rgb = vec3(0.028); carRough = 0.6; carCoat = 0.0; }                               // dash, wheel, trim
					else if (part > 5.5) { diffuseColor.rgb = vec3(0.07, 0.068, 0.066); carRough = 0.9; carCoat = 0.0; }                  // seats, floor
					else if (part > 4.5) {
						// alloy rims: five spokes, dark between them and at the hub
						float a = atan(vE.x, vE.y), rr = length(vE.xy) / max(vE.z, 0.01);
						float gap = smoothstep(0.55, 0.75, abs(cos(a * 2.5))) * step(0.22, rr) * step(rr, 0.56);
						diffuseColor.rgb = mix(vec3(0.58, 0.59, 0.61), vec3(0.03), max(gap, step(rr, 0.1)));
						carRough = 0.28; carCoat = 0.0;
					}
					else if (part > 3.5) { diffuseColor.rgb = vec3(0.05); carRough = 0.8; carCoat = 0.0; }                             // the bed
					else if (part > 1.5) {
						// tyres: the tread darker than the sidewall
						float rr = length(vE.xy) / max(vE.z, 0.01);
						diffuseColor.rgb = vec3(mix(0.035, 0.02, step(0.93, rr))); carRough = 0.85; carCoat = 0.0;
					}
					else if (part > 0.5) { diffuseColor.rgb = vec3(0.02, 0.025, 0.03); carRough = 0.04; }                             // glass (seen dark)
					else {
						// lower trim and sills in black plastic
						float clad = step(yN, 0.16);
						// the wheel arches: cut out of the body, so the tyre shows through with the
						// dark well behind it
						float ad = length(vec2(abs(vLP.z) - vW.x, vLP.y - vW.y));
						if (step(0.7, xN) * step(ad, vW.y + 0.09) > 0.5) discard;
						float arch = step(0.7, xN) * step(ad, vW.y + 0.13);
						// the grille and the lamps at the nose, tail lamps at the back
						float nose = step(0.955, e), tail = step(e, -0.955);
						float head = nose * step(0.62, yN) * step(yN, 0.9) * step(0.5, xN);
						float grille = nose * step(0.3, yN) * step(yN, 0.62) * step(xN, 0.6);
						float tl = tail * step(0.6, yN) * step(yN, 0.92) * step(0.45, xN);
						// the doors: their seams down the side, a handle toward each door's back edge
						float side = step(0.93, xN) * step(0.2, yN) * step(yN, 1.02);
						float w = max(fwidth(vLP.z) * 1.2, 0.004);
						float seam = side * max(max(1.0 - smoothstep(0.0, w, abs(vLP.z - vD.x)), 1.0 - smoothstep(0.0, w, abs(vLP.z - vD.y))), 1.0 - smoothstep(0.0, w, abs(vLP.z - vD.z)));
						seam = max(seam, step(0.93, xN) * step(vD.z, vLP.z) * step(vLP.z, vD.x) * (1.0 - smoothstep(0.0, 0.012, abs(yN - 0.2))));
						float hz = vLP.z - vD.y, hz2 = vLP.z - vD.z;
						float handle = step(0.93, xN) * step(abs(yN - 0.8), 0.035) * max(step(abs(hz - 0.2), 0.08) * step(vD.y, 8.0), step(abs(hz2 - 0.2), 0.08) * step(vD.z, 8.0));
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04), max(clad, grille * 0.9));
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.03), arch);                          // the arch lip
						diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.25, seam);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.1), handle * 0.7);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.86, 0.84), head);
						diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.03, 0.03), tl);
						if (clad + arch > 0.5) { carRough = 0.7; carCoat = 0.0; }
						if (head + tl > 0.5) carRough = 0.1;
						carGlow = (head * vec3(1.0, 0.93, 0.8) * 2.5 + tl * vec3(1.0, 0.05, 0.02) * 1.8) * uNightS;
					}
				}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (carRough >= 0.0) roughnessFactor = carRough;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += carGlow;')
			.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.clearcoat *= carCoat;');
	};
	m.customProgramCacheKey = () => 'baycar3';
	return m;
}

// the glass of the close cars, which you see into: tinted, the sky in it, the pillars
// between the windows black
export function carGlassMaterial() {
	const m = new THREE.MeshPhysicalMaterial({ color: 0x0d1418, roughness: 0.04, metalness: 0, envMap: skyEnv(), envMapIntensity: 1.1, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNightS = { value: 0 };
		sh.vertexShader = VERT(sh);
		sh.fragmentShader = HEAD + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			diffuseColor.rgb = vec3(0.05, 0.07, 0.08);
			// (the B pillar between the side windows)
			if (abs(vLP.z - vD.y) < 0.05 && vD.y < 8.0 && vE.z > 0.5) { diffuseColor.rgb = vec3(0.015); diffuseColor.a = 1.0; }`);
	};
	m.customProgramCacheKey = () => 'bayglass1';
	return m;
}
