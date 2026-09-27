// The mushrooms, and what they do to you. Each world grows the species its profile lists
// (profile.js SHROOMS), each where it would: liberty caps in the short turf of open meadows,
// fly agarics in rings under the trees, button cactus on dry ground, emberfoot cups on ash,
// veilhorns in the shade, glowcaps in the damp dark and on the cave floors. Walk up to a
// troop and a button offers it; eat it and the world changes the way people describe it:
// onset, peak and coming down, pressed into a few minutes of play.
//
// The look is a pass over the finished frame. The scene is drawn into a target exactly as it
// would be drawn to the screen (tone mapped and encoded the same way), so with nothing
// happening the picture is the same picture; then one shader warps, tints, trails and
// patterns it. While sober nothing extra is drawn at all.

import * as THREE from 'three';
import { SHROOMS } from './profile.js';
import { mulberry32, smoothstep, clamp } from '../noise.js';

// seconds of play: onset, peak, coming down
export const TIMES = {
	psilocybe: [50, 150, 120],
	amanita: [60, 140, 120],
	peyote: [60, 200, 150],
	glowcap: [40, 120, 90],
	emberfoot: [40, 100, 90],
	veilhorn: [45, 130, 100],
};
const END_FADE = 10;          // ending early eases out over this long
const REACH = 2.2;            // how near a troop has to be to pick it
const SEEN = { glowcap: 70 }; // metres a troop is drawn to (the rest: 45)
// a little larger than life where life is very small, so a troop can be found at all
const SIZE = { psilocybe: 1.35, glowcap: 1.5, veilhorn: 1.2, emberfoot: 1.2 };

// what each does at its peak (the 5D-ASC's "visionary restructuralisation" in numbers).
// sat/deep/hue: colour; breath/flow: the surfaces moving (1080p pixels); trail/decay: tracers;
// halo/thr: light blooming; lattice/style: the geometry; sharp, light: edges and glare;
// tone, glow, after: the glowcap's phosphor; warm, shimmer, sparks: emberfoot's heat;
// ripple, synth: veilhorn's sound-as-colour; sway, barrel, lids, dream, twitch, soft: the
// fly agaric's heavy dream; dilate: how much slower time seems; wet: reverb on the music
const RECIPES = {
	psilocybe: { sat: 1.0, deep: 0.5, hue: 0.5, iris: 0.45, breath: 7, flow: 3, trail: 0.5, decay: 0.86, halo: 0.85, thr: 0.55, rainbow: 1, lattice: 0.7, style: 0, vig: 0.12, sway: 0.4, light: 0.12, dilate: 0.15, wet: 0.35, drift: 1 },
	amanita: { sat: -0.18, deep: 0.25, hue: 0.04, warm: 0.12, breath: 2.5, flow: 1, trail: 0.3, decay: 0.9, halo: 0.35, thr: 0.68, vig: 0.4, lids: 1, sway: 3.2, barrel: 0.09, dream: 1, twitch: 1, soft: 0.3, dilate: 0.1, wet: 0.18, muffle: 0.5, fov: 1 },
	peyote: { sat: 0.75, deep: 0.35, hue: 0.18, iris: 0.14, warm: 0.08, breath: 3, flow: 2, trail: 0.3, decay: 0.84, halo: 1.0, thr: 0.52, rainbow: 0.5, lattice: 0.6, style: 1, vig: 0.05, sharp: 0.9, light: 0.45, dilate: 0.1, wet: 0.2 },
	glowcap: { sat: 0.35, hue: 0.08, tone: 0.9, breath: 2, flow: 2, trail: 0.35, decay: 0.94, after: 0.8, halo: 0.9, thr: 0.45, lattice: 0.3, style: 2, vig: 0.18, glow: 0.7, dilate: 0.08, wet: 0.3 },
	emberfoot: { sat: 0.45, warm: 0.9, breath: 1.5, shimmer: 1.2, sparks: 1, halo: 0.6, thr: 0.58, trail: 0.15, decay: 0.85, vig: 0.12, dilate: 0.05, wet: 0.1 },
	veilhorn: { sat: 0.8, hue: 0.3, iris: 0.2, breath: 2.5, ripple: 1.2, synth: 1.3, lattice: 0.35, style: 0, trail: 0.3, decay: 0.88, halo: 0.55, thr: 0.58, vig: 0.1, dilate: 0.1, wet: 0.25 },
};

// what people write down, in their words (onset, peak, coming down)
const JOURNAL = {
	psilocybe: [
		['A warmth is spreading out from the middle of you.', 'The edges of things are getting brighter.', 'Something is starting. The grass looks very green.'],
		['Colours seem to hum.', 'The grass is breathing.', 'Time is doing something strange.', 'Everything is connected to everything else. It seems obvious.', 'The patterns were always there. You are only now seeing them.', 'The music is enormous, and very kind.'],
		['Things are settling back into their edges.', 'A quiet, washed-clean feeling.', 'You feel grateful, and a little tired.'],
	],
	amanita: [
		['A heaviness in the arms and legs.', 'The ground feels further away than it should.'],
		['Your hands look enormous. Or very far away.', 'Did you just dream that?', 'Everything is muffled, as if under a blanket.', 'A heavy, dreamy calm.', 'The trees are the wrong size, and it does not matter.'],
		['Drowsy. The world is slowly putting itself back.', 'Like waking from a long nap in the afternoon.'],
	],
	peyote: [
		['A queasy moment passes, and the light sharpens.', 'Every edge is getting crisper.'],
		['Every colour has an edge like cut glass.', 'The light is almost too bright to look at.', 'Patterns crawl over the rocks, and they are beautiful.', 'The sand is made of tiny jewels.', 'Time has stretched out wide and flat, like the desert.'],
		['The colours are cooling.', 'A long, clear, thoughtful feeling.'],
	],
	glowcap: [
		['Your fingertips are faintly glowing. Or are they?', 'The dark is getting softer.'],
		['Everything keeps a little of its light.', 'The shadows are full of blue.', 'Lights leave slow comets behind them.', 'The dark is not empty at all.'],
		['The glow is fading back into the ordinary dark.'],
	],
	emberfoot: [
		['A warmth like standing near a fire.', 'The air is starting to shimmer.'],
		['Sparks drift up from nowhere.', 'The whole world is warm to look at.', 'Heat rises off everything, even the sea.'],
		['The warmth is ebbing, slow as embers.'],
	],
	veilhorn: [
		['The music is getting a colour.', 'A faint ringing, like a glass being touched.'],
		['You can see the bass.', 'The music has a colour, and it keeps changing.', 'Each beat ripples out through the air.', 'Sounds and colours are the same thing now.'],
		['The colours are separating from the sounds again.'],
	],
};
const PHASES = ['coming up', 'peaking', 'coming down'];

// ---------------------------------------------------------------------------------------
// the models: lathed caps and stems, gills, rings, warts, wool, cups and lace, built into
// one indexed geometry per variant with its colour and a part/glow code per vertex
// ---------------------------------------------------------------------------------------
const PART = { stem: 0, cap: 1, gill: 2, wart: 3, lace: 4, ember: 5, gleba: 6 };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ramp = (stops, t) => {
	t = clamp(t, 0, 1) * (stops.length - 1);
	const i = Math.min(stops.length - 2, Math.floor(t));
	return lerp3(stops[i], stops[i + 1], t - i);
};
function lathe(pts, seg) {
	return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0003, r), y)), seg);
}
// move a piece's points (and relight it)
function warp(geo, fn) {
	const p = geo.attributes.position, v = new THREE.Vector3();
	for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
	geo.computeVertexNormals();
	return geo;
}
function kit() {
	const P = [], N = [], U = [], C = [], M = [], I = [];
	const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
	return {
		add(geo, { at = null, color = [1, 1, 1], part = 0, glow = 0 } = {}) {
			const p = geo.attributes.position, nn = geo.attributes.normal, uv = geo.attributes.uv, base = P.length / 3;
			// (a piece built by another kit keeps its own colours and parts)
			const own = color === 'own' ? geo.attributes : null;
			if (at) nm.getNormalMatrix(at);
			for (let i = 0; i < p.count; i++) {
				v.fromBufferAttribute(p, i);
				const u = uv ? uv.getX(i) : 0, w = uv ? uv.getY(i) : 0;
				n.fromBufferAttribute(nn, i);
				if (own) { C.push(own.color.getX(i), own.color.getY(i), own.color.getZ(i)); M.push(own.aMat.getX(i), own.aMat.getY(i)); } else {
					// (colours are written as they look, and lit in linear light)
					const c = typeof color === 'function' ? color(v.x, v.y, v.z, u, w) : color;
					C.push(Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2));
					M.push(part, typeof glow === 'function' ? glow(v.x, v.y, v.z, u, w) : glow);
				}
				if (at) { v.applyMatrix4(at); n.applyMatrix3(nm).normalize(); }
				P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); U.push(u, w);
			}
			if (geo.index) for (const k of geo.index.array) I.push(base + k);
			else for (let i = 0; i < p.count; i++) I.push(base + i);
			geo.dispose();
		},
		// lean the whole thing: every point moved sideways by how high it is
		bend(fn) { for (let i = 0; i < P.length; i += 3) { const [dx, dz] = fn(P[i + 1]); P[i] += dx; P[i + 2] += dz; } },
		build() {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
			g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
			g.setAttribute('aMat', new THREE.Float32BufferAttribute(M, 2));
			g.setIndex(I);
			g.computeBoundingSphere();
			return g;
		},
	};
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
const blob = (r, sy = 1, detail = 0) => { const g = new THREE.IcosahedronGeometry(r, detail); g.scale(1, sy, 1); return g; };
// height of a lathed profile at radius r (the cap's top surface, for warts and wool)
function surfY(pts, r) {
	for (let i = 1; i < pts.length; i++) {
		const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
		if ((r <= r0 && r >= r1) || (r >= r0 && r <= r1)) return y0 + (y1 - y0) * ((r - r0) / ((r1 - r0) || 1));
	}
	return pts[pts.length - 1][1];
}

// Liberty cap: a small pointed bell on a long thin wavy stem, dark gills, blue at the foot
function psilocybe(rnd, v) {
	const K = kit();
	const L = 0.095 + v * 0.025 + rnd() * 0.02, rs = 0.0023, R = 0.015 + rnd() * 0.004 + v * 0.002, H = 0.028 + rnd() * 0.008;
	const STEM = [0.8, 0.72, 0.56], BLUE = [0.42, 0.52, 0.6];
	K.add(lathe([[rs * 1.3, -0.012], [rs * 1.2, 0], [rs * 1.05, L * 0.25], [rs, L * 0.6], [rs * 0.92, L + 0.002]], 8), { color: (x, y) => lerp3(BLUE, STEM, smoothstep(0, L * 0.22, y)) });
	// hygrophanous: dark and wet at the nipple, drying to straw at the rim, with striations
	const dry = v === 2 ? 0.35 : 0;
	const cap = [[R * 0.88, -0.002], [R, 0.001], [R * 0.95, H * 0.22], [R * 0.8, H * 0.46], [R * 0.58, H * 0.68], [R * 0.35, H * 0.85], [R * 0.16, H * 0.96], [R * 0.08, H * 1.03], [0.0004, H * 1.08]];
	const capAt = at(0, L - H * 0.28, 0);
	K.add(lathe(cap, 18), { at: capAt, part: PART.cap, color: (x, y, z, u) => {
		const c = ramp([[0.74, 0.64, 0.46], [0.6, 0.47, 0.28], [0.44, 0.31, 0.16], [0.3, 0.2, 0.1]], y / H);
		const stria = 1 - 0.14 * Math.pow(Math.abs(Math.sin(u * Math.PI * 22)), 6) * (1 - smoothstep(0.1, 0.5, y / H));
		return lerp3(c, [0.8, 0.72, 0.55], dry).map((q) => q * stria);
	} });
	K.add(lathe([[R * 0.88, -0.002], [R * 0.55, H * 0.12], [rs * 1.3, H * 0.3]], 18), { at: capAt, part: PART.gill, color: [0.28, 0.2, 0.19] });
	// the stem wanders: a lean and a little S
	const a = rnd() * 6.28, lean = 0.012 + rnd() * 0.016, wig = 0.004 * rnd();
	K.bend((y) => { const t = Math.max(0, y) / L; const d = lean * t * t + wig * Math.sin(t * 5); return [Math.cos(a) * d, Math.sin(a) * d]; });
	return K.build();
}

// Fly agaric: red cap with white warts, white gills, a white stem with a skirt and a bulb
function amanita(rnd, v) {
	const K = kit();
	const button = v === 0;
	const L = button ? 0.07 + rnd() * 0.02 : 0.14 + rnd() * 0.04, R = button ? 0.036 + rnd() * 0.008 : 0.055 + rnd() * 0.02, H = button ? 0.042 : v === 2 ? 0.018 : 0.032;
	const WHITE = [0.94, 0.92, 0.86];
	const b = button ? 0.9 : 1;
	K.add(lathe([[0.019 * b, -0.02], [0.023 * b, 0], [0.022 * b, 0.011], [0.017 * b, 0.02], [0.019 * b, 0.024], [0.0145, 0.031], [0.0135, 0.036], [0.013, 0.05], [0.0115, L * 0.8], [0.0105, L + 0.002]], 14), { color: (x, y) => lerp3([0.82, 0.78, 0.68], WHITE, smoothstep(0, 0.04, y)) });
	const capAt = at(0, L - H * 0.3, 0);
	const cap = button
		? [[R * 0.8, -0.006], [R * 0.95, 0.0], [R, H * 0.3], [R * 0.9, H * 0.62], [R * 0.66, H * 0.88], [R * 0.34, H * 1.0], [0.0004, H * 1.03]]
		: [[R * 0.96, -0.004], [R, 0.002], [R * 0.97, H * 0.35], [R * 0.86, H * 0.7], [R * 0.62, H * 0.93], [R * 0.3, H * 1.0], [0.0004, H * 1.02]];
	K.add(lathe(cap, 28), { at: capAt, part: PART.cap, color: (x, y, z, u) => {
		const r = Math.hypot(x, z) / R;
		const c = ramp([[0.42, 0.02, 0.015], [0.62, 0.03, 0.015], [0.78, 0.09, 0.03], [0.86, 0.22, 0.06]], r);
		return c.map((q) => q * (1 - 0.1 * Math.pow(Math.abs(Math.sin(u * Math.PI * 40)), 8) * smoothstep(0.8, 1, r)));
	} });
	K.add(lathe([[cap[0][0], cap[0][1]], [R * 0.55, H * 0.1], [0.012, H * 0.2]], 28), { at: capAt, part: PART.gill, color: WHITE });
	if (!button) {
		// the ring: a hanging skirt with a yellowish edge and a soft hem
		const y0 = L * 0.8;
		const skirt = warp(lathe([[0.024, y0 - 0.013], [0.021, y0 - 0.008], [0.016, y0 - 0.003], [0.0108, y0]], 20), (q) => { q.y += 0.0018 * Math.sin(Math.atan2(q.x, q.z) * 7) * smoothstep(0.012, 0.024, Math.hypot(q.x, q.z)); });
		K.add(skirt, { color: (x, y) => lerp3([0.93, 0.88, 0.62], WHITE, smoothstep(y0 - 0.013, y0 - 0.006, y)) });
	}
	// the warts: flakes of the veil, thick at the centre, fewer at the rim
	const n = button ? 46 : 26 + Math.floor(rnd() * 16);
	for (let i = 0; i < n; i++) {
		const r = R * 0.9 * Math.sqrt(rnd()) * (button ? 0.95 : 1), a = rnd() * 6.283;
		const s = (0.0042 + rnd() * 0.004) * (button ? 1.1 : 1) * (1.15 - r / R * 0.5);
		const y = surfY(cap.slice(1), r) + L - H * 0.3;
		K.add(blob(s, 0.5), { at: at(Math.sin(a) * r, y + s * 0.15, Math.cos(a) * r, (r / R) * 0.9 * Math.cos(a), rnd() * 3, -(r / R) * 0.9 * Math.sin(a)), part: PART.wart, color: [0.95, 0.92, 0.8] });
	}
	const a = rnd() * 6.28, lean = 0.006 + rnd() * 0.01;
	K.bend((y) => { const t = Math.max(0, y) / L; return [Math.cos(a) * lean * t * t, Math.sin(a) * lean * t * t]; });
	return K.build();
}

// Glowcap: a tuft of tiny bells on hair-thin stems, splayed from one point, glowing
function glowcap(rnd) {
	const K = kit();
	const n = 5 + Math.floor(rnd() * 5);
	for (let i = 0; i < n; i++) {
		const L = 0.035 + rnd() * 0.06, R = 0.006 + rnd() * 0.005, H = R * (1.1 + rnd() * 0.3), rs = 0.0011;
		const a = rnd() * 6.283, tilt = 0.12 + rnd() * 0.45, off = rnd() * 0.012;
		const m = at(Math.cos(a) * off, 0, Math.sin(a) * off, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
		const sub = kit();
		sub.add(lathe([[rs * 1.4, -0.006], [rs * 1.2, 0], [rs, L + 0.001]], 6), { color: [0.52, 0.6, 0.58], glow: (x, y) => 0.12 + 0.25 * smoothstep(0, L, y) });
		const cap = [[R * 0.92, -0.0006], [R, 0.0004], [R * 0.92, H * 0.4], [R * 0.66, H * 0.78], [R * 0.3, H * 0.97], [0.0003, H]];
		sub.add(lathe(cap, 12), { at: at(0, L - H * 0.2, 0), part: PART.cap, color: (x, y) => lerp3([0.62, 0.82, 0.78], [0.48, 0.66, 0.62], y / H), glow: (x, y) => 0.55 + 0.45 * (1 - y / H) });
		sub.add(lathe([[R * 0.92, -0.0006], [R * 0.5, H * 0.12], [rs, H * 0.3]], 12), { at: at(0, L - H * 0.2, 0), part: PART.gill, color: [0.7, 0.92, 0.88], glow: 1.6 });
		// (each stem arcs back up toward the light)
		sub.bend((y) => { const t = Math.max(0, y) / L; return [-Math.cos(a) * 0.006 * t * t, -Math.sin(a) * 0.006 * t * t]; });
		K.add(sub.build(), { at: m, color: 'own' });
	}
	return K.build();
}

// Button cactus: a low ribbed dome, blue-green, with tufts of wool, now and then a flower
function peyote(rnd, v) {
	const K = kit();
	const ribs = 8 + Math.floor(rnd() * 4), R = 0.042 + rnd() * 0.02, H = R * (0.5 + rnd() * 0.12), twist = (rnd() - 0.5) * 0.8;
	const prof = [[R * 0.9, -0.014], [R, -0.002], [R * 0.99, H * 0.3], [R * 0.86, H * 0.7], [R * 0.56, H * 0.96], [R * 0.24, H * 0.94], [0.0004, H * 0.86]];
	const ribAt = (x, y, z) => Math.pow(Math.abs(Math.cos((Math.atan2(x, z) + twist * y / H) * ribs / 2)), 0.7);
	const body = warp(lathe(prof, ribs * 6), (q) => {
		const f = ribAt(q.x, q.y, q.z), r = Math.hypot(q.x, q.z), k = 1 - 0.14 * (1 - f) * smoothstep(0.05 * R, 0.4 * R, r);
		q.x *= k; q.z *= k; q.y -= 0.004 * (1 - f) * smoothstep(0.2 * R, 0.8 * R, r);
	});
	K.add(body, { color: (x, y, z) => {
		const f = ribAt(x, y, z);
		return lerp3([0.28, 0.4, 0.38], [0.46, 0.6, 0.55], f * 0.8 + smoothstep(0, H, y) * 0.2);
	} });
	// wool at the areoles along each rib's crest
	for (let i = 0; i < ribs; i++) {
		for (const rf of [0.3, 0.58, 0.84]) {
			if (rnd() < 0.2) continue;
			const r = R * rf * 0.98, a = i / ribs * Math.PI * 2 - twist * surfY(prof.slice(1), r) / H, y = surfY(prof.slice(1), r) - 0.001;
			K.add(blob(0.0028 + rnd() * 0.0018, 0.7, 1), { at: at(Math.sin(a) * r, y, Math.cos(a) * r), part: PART.wart, color: [0.9, 0.88, 0.82] });
		}
	}
	K.add(blob(0.0075, 0.55, 1), { at: at(0, H * 0.88, 0), part: PART.wart, color: [0.92, 0.9, 0.84] });
	if (v === 1) {
		// a pale pink flower in the wool at the crown
		for (let i = 0; i < 11; i++) {
			const a = i / 11 * 6.283;
			const g = new THREE.SphereGeometry(0.008, 6, 4);
			g.scale(0.38, 0.12, 1); g.translate(0, 0, 0.008);
			K.add(g, { at: at(0, H * 0.95, 0, -0.55, a, 0), part: PART.cap, color: (x, y, z) => lerp3([0.96, 0.9, 0.86], [0.92, 0.55, 0.7], smoothstep(0.004, 0.016, Math.hypot(x, z))) });
		}
		K.add(blob(0.003, 0.6, 1), { at: at(0, H * 0.98, 0), part: PART.wart, color: [0.95, 0.85, 0.35] });
	}
	return K.build();
}

// Emberfoot: little black cups on short stalks, their insides lit like coals
function emberfoot(rnd) {
	const K = kit();
	const R = 0.018 + rnd() * 0.012, D = R * (0.75 + rnd() * 0.3), seed = rnd() * 9;
	const prof = [[0.0035, -0.006], [0.0048, 0.003], [R * 0.42, D * 0.3], [R * 0.78, D * 0.66], [R * 0.97, D * 0.93], [R * 1.02, D * 1.02], [R * 0.93, D * 1.0], [R * 0.72, D * 0.66], [R * 0.4, D * 0.3], [0.0004, D * 0.14]];
	const cup = warp(lathe(prof, 32), (q) => { const r = Math.hypot(q.x, q.z); q.y += 0.0014 * Math.sin(Math.atan2(q.x, q.z) * 5 + seed) * smoothstep(R * 0.6, R, r); });
	const lip = 5 / (prof.length - 1);
	// charcoal outside, coal-red inside, brightest where the rim curls over
	K.add(cup, { part: PART.ember, color: (x, y, z, u, w) => w < lip - 0.06 ? [0.1, 0.085, 0.08] : ramp([[0.9, 0.34, 0.06], [0.66, 0.13, 0.03], [0.34, 0.06, 0.02]], (w - lip) / (1 - lip)),
		glow: (x, y, z, u, w) => w < lip - 0.06 ? 0 : 0.5 - (w - lip) / (1 - lip) * 0.35 });
	return K.build();
}

// Veilhorn: a tall spongy white stem, a dark slimy cone, and a lace veil down to the ground
function veilhorn(rnd) {
	const K = kit();
	const L = 0.15 + rnd() * 0.05, W = 0.05 + rnd() * 0.015;
	K.add(lathe([[0.012, -0.01], [0.0115, 0], [0.0105, L * 0.4], [0.0095, L * 0.8], [0.0085, L + 0.002]], 12), { color: [0.95, 0.94, 0.89], glow: 0.12 });
	const capAt = at(0, L - 0.004, 0);
	K.add(lathe([[0.015, -0.002], [0.019, 0.001], [0.0185, 0.012], [0.015, 0.027], [0.009, 0.037], [0.0048, 0.041], [0.0042, 0.043], [0.0035, 0.038]], 18), { at: capAt, part: PART.gleba, color: (x, y) => y > 0.039 ? [0.93, 0.92, 0.86] : [0.26, 0.24, 0.12] });
	const veil = warp(lathe([[W, L * 0.18], [W * 0.8, L * 0.38], [W * 0.58, L * 0.6], [0.02, L * 0.86], [0.0158, L]], 44), (q) => {
		const t = 1 - q.y / L, a = Math.atan2(q.x, q.z), s = 1 + 0.07 * Math.sin(a * 9) * t;
		q.x *= s; q.z *= s; q.y += 0.006 * Math.sin(a * 13 + 1) * t * t;
	});
	K.add(veil, { part: PART.lace, color: [0.97, 0.96, 0.92], glow: 0.35 });
	const a = rnd() * 6.28, lean = 0.01 * rnd();
	K.bend((y) => { const t = Math.max(0, y) / L; return [Math.cos(a) * lean * t * t, Math.sin(a) * lean * t * t]; });
	return K.build();
}

// variants per species (the builder, how many)
const MODELS = {
	psilocybe: [psilocybe, 3], amanita: [amanita, 3], glowcap: [glowcap, 3], peyote: [peyote, 2], emberfoot: [emberfoot, 3], veilhorn: [veilhorn, 2],
};

// ---------------------------------------------------------------------------------------
// the material: vertex colours, a little grain, gills and lace and slime from the part
// code, a glow that breathes, and a fade out past the distance it is drawn to
// ---------------------------------------------------------------------------------------
function shroomMaterial(kind, shared, glowCol) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'psilocybe' ? 0.45 : kind === 'peyote' ? 0.75 : 0.62, side: THREE.DoubleSide });
	const U = { uGlowCol: { value: new THREE.Color(...glowCol) }, uGlowK: { value: 1 }, uPulse: { value: kind === 'emberfoot' ? 1 : kind === 'glowcap' ? 0.35 : 0.15 }, uFar: { value: SEEN[kind] || 45 }, uT: shared.uTime };
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = 'attribute vec2 aMat;\nuniform float uFar;\nvarying vec2 vMat;\nvarying vec2 vLUv;\nvarying vec3 vLoc;\nvarying float vSeed;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vMat = aMat; vLUv = uv; vLoc = position;
			#ifdef USE_INSTANCING
			vec3 ip = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
			#else
			vec3 ip = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
			#endif
			vSeed = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
			transformed *= 1.0 - smoothstep(uFar * 0.75, uFar, distance(ip, cameraPosition));`);
		sh.fragmentShader = `uniform vec3 uGlowCol;
			uniform float uGlowK, uPulse, uT;
			varying vec2 vMat;
			varying vec2 vLUv;
			varying vec3 vLoc;
			varying float vSeed;
			float sh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
			float sn3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
				return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
					mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + 1.0), f.x), f.y), f.z); }
			float hexD(vec2 p) { p = abs(p); return max(dot(p, vec2(0.866025, 0.5)), p.y); }
			vec2 hexLocal(vec2 p) {
				vec2 s = vec2(1.0, 1.7320508);
				vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
				vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
				return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
			}
			` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				float part = vMat.x;
				// grain: the flesh is never one flat colour
				diffuseColor.rgb *= 0.9 + 0.2 * sn3(vLoc * 260.0 + vSeed * 40.0);
				if (part > 1.5 && part < 2.5) {
					// gills: fine radial plates, pale at their edges
					float st = abs(sin(vLUv.x * 3.14159 * 60.0));
					diffuseColor.rgb *= 0.5 + 0.5 * smoothstep(0.0, 0.7, st);
				}
				if (part > 3.5 && part < 4.5) {
					// the veil: an open net of rounded holes, finer toward the top
					vec2 q = hexLocal(vLUv * vec2(46.0, 16.0));
					if (hexD(q) < 0.36 * smoothstep(0.98, 0.8, vLUv.y)) discard;
				}
				if (part > 5.5) {
					// the slime cap: pitted like a honeycomb, glossy
					vec2 q = hexLocal(vLUv * vec2(26.0, 9.0));
					diffuseColor.rgb *= 0.55 + 0.6 * smoothstep(0.2, 0.46, hexD(q));
				}
				if (part > 2.5 && part < 3.5) diffuseColor.rgb *= 0.92 + 0.12 * sn3(vLoc * 900.0);`)
			.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
				if (vMat.x > 5.5) roughnessFactor = 0.22;
				if (vMat.x > 2.5 && vMat.x < 3.5) roughnessFactor = 0.95;`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				float flick = 0.7 + 0.3 * sin(uT * (0.9 + vSeed * 0.8) + vSeed * 30.0 + vLoc.y * 20.0);
				totalEmissiveRadiance += uGlowCol * vMat.y * uGlowK * mix(1.0, flick, uPulse);`);
	};
	m.customProgramCacheKey = () => 'shroom1';
	return m;
}

// ---------------------------------------------------------------------------------------
// the look: two passes over the finished frame. The first keeps a trail of past frames
// (with local contrast in alpha, mipmapped so its blur is the halo and the texture mask);
// the second warps, colours and patterns the frame onto the screen.
// ---------------------------------------------------------------------------------------
const QUAD_VS = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const COMMON = `
	varying vec2 vUv;
	vec3 s2l(vec3 c) { return sRGBTransferEOTF(vec4(c, 1.0)).rgb; }
	float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
	float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
	float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
	float vn3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
		return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
			mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + 1.0), f.x), f.y), f.z); }
`;
const TRAIL_FS = COMMON + `
	uniform sampler2D tScene, tPrev;
	uniform vec2 uTexel;
	uniform float uDecay, uDrift, uTime;
	void main() {
		vec3 cur = s2l(texture2D(tScene, vUv).rgb);
		// local contrast: where there is texture (leaves, grass, rock) and where there is not (sky)
		float gx = lum(texture2D(tScene, vUv + vec2(uTexel.x * 2.0, 0.0)).rgb) - lum(texture2D(tScene, vUv - vec2(uTexel.x * 2.0, 0.0)).rgb);
		float gy = lum(texture2D(tScene, vUv + vec2(0.0, uTexel.y * 2.0)).rgb) - lum(texture2D(tScene, vUv - vec2(0.0, uTexel.y * 2.0)).rgb);
		float det = clamp(length(vec2(gx, gy)) * 5.0, 0.0, 1.0);
		// the past drifts a little as it fades, so trails melt rather than stamp
		vec2 dr = (vec2(vn3(vec3(vUv * 3.0, uTime * 0.1)), vn3(vec3(vUv * 3.0 + 7.0, uTime * 0.1))) - 0.5) * uDrift;
		vec4 prev = texture2D(tPrev, vUv + dr);
		gl_FragColor = vec4(mix(cur, prev.rgb, uDecay), mix(det, prev.a, uDecay * 0.6));
	}
`;
const COPY_FS = 'varying vec2 vUv;\nuniform sampler2D tSrc;\nvoid main() { gl_FragColor = texture2D(tSrc, vUv); }';
const COMP_FS = COMMON + `
	uniform sampler2D tScene, tTrail, tHold;
	uniform vec2 uRes;
	uniform float uTime, uAspect;
	uniform mat3 uCamRot;
	uniform mat4 uProjInv;
	uniform float uIris, uSat, uDeep, uHue, uWarm, uTone, uLight, uBreath, uFlow, uTrail, uHalo, uThr, uRainbow, uLattice, uStyle, uVig, uLids;
	uniform float uSharp, uGlow, uAfter, uShimmer, uSparks, uRipple, uSynth, uBarrel, uDream, uSoft, uBeat;
	uniform vec2 uTwitch;
	uniform vec3 uSound, uGlowCol;

	vec3 viewDir(vec2 uv) { vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, 1.0, 1.0); return normalize(uCamRot * (v.xyz / v.w)); }
	vec3 hueRot(vec3 c, float a) { const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
	vec3 pal(float t) { return 0.5 + 0.5 * cos(6.2831853 * (t + vec3(0.0, 0.33, 0.67))); }
	float hexD(vec2 p) { p = abs(p); return max(dot(p, vec2(0.866025, 0.5)), p.y); }
	vec4 hexCell(vec2 p) {
		vec2 s = vec2(1.0, 1.7320508);
		vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
		vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
		return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
	}

	// the geometry that surfaces out of textures: 0 honeycomb and paisley, 1 stepped
	// diamonds, 2 glowing veins. p: coordinates fixed to directions in the world
	float lattice(vec2 p, vec3 d, float fw, out vec3 col) {
		if (uStyle < 0.5) {
			vec4 h = hexCell(p);
			vec2 g = h.xy;
			float id = h21(h.zw), r = length(g), a = atan(g.y, g.x);
			float edge = 1.0 - smoothstep(0.0, fw * 1.5 + 0.035, 0.5 - hexD(g));
			// a six-fold kaleidoscope in each cell: petals and a curling line
			float af = abs(mod(a + uTime * 0.05 * (id - 0.5), 1.0471976) - 0.5235988);
			float petal = 1.0 - smoothstep(0.0, fw * 2.0 + 0.02, abs(r - 0.16 - 0.1 * cos(af * 6.0 + uTime * 0.3)));
			float curl = 1.0 - smoothstep(0.0, fw * 2.0 + 0.03, abs(fract(r * 5.0 + af * 0.8 - uTime * 0.12) - 0.5) - 0.38);
			col = pal(id * 0.6 + r * 0.8 + uTime * 0.03);
			return max(max(edge, 0.22), max(petal, curl * 0.6 * smoothstep(0.42, 0.2, r)));
		} else if (uStyle < 1.5) {
			vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p * 1.3;
			vec2 cid = floor(q), f = fract(q) - 0.5;
			float dm = abs(f.x) + abs(f.y);
			float ring = floor(dm * 5.0 - uTime * 0.2);
			float band = abs(fract(dm * 5.0 - uTime * 0.2) - 0.5);
			col = pal(h21(cid) * 0.5 + ring * 0.17 + 0.1);
			return max(1.0 - smoothstep(0.04, 0.04 + fw * 8.0, band), 0.12);
		}
		float v = 1.0 - abs(vn3(d * 7.0 + uTime * 0.03) * 2.0 - 1.0);
		float w = 1.0 - abs(vn3(d * 17.0 - uTime * 0.02) * 2.0 - 1.0);
		col = mix(uGlowCol, vec3(0.65, 0.45, 1.0), w);
		return smoothstep(0.9, 0.985, v) + smoothstep(0.93, 0.99, w) * 0.6;
	}

	void main() {
		vec2 uv = vUv;
		vec2 px = vec2(1.0 / (1080.0 * uAspect), 1.0 / 1080.0);   // one 1080p pixel, in uv
		vec2 cc = (uv - 0.5) * vec2(uAspect, 1.0);
		float r = length(cc);
		// the size of things: the middle of the view swells and shrinks
		cc *= 1.0 + uBarrel * (r * r - 0.2);
		uv = cc / vec2(uAspect, 1.0) + 0.5 + uTwitch;
		// the beat, rippling out from the middle
		uv += normalize(cc + 1e-5) * sin(r * 34.0 - uTime * 5.0) * exp(-r * 1.6) * uRipple * (0.35 + uBeat) * px.y * 6.0;
		vec3 d = viewDir(uv);
		float detail = textureLod(tTrail, uv, 3.0).a;
		float tex = mix(0.3, 1.0, smoothstep(0.05, 0.35, detail));
		// breathing: a slow swell and ebb, and a finer crawl, fixed to the world's directions
		float breathe = sin(uTime * 0.97);
		vec2 wb = vec2(vn3(d * 3.0 + uTime * 0.04), vn3(d * 3.0 + vec3(5.2, 1.3, 7.1) + uTime * 0.04)) * 2.0 - 1.0;
		vec2 wf = vec2(vn3(d * 11.0 + vec3(0.0, uTime * 0.15, 0.0)), vn3(d * 11.0 + vec3(3.1, uTime * 0.15, 8.0))) * 2.0 - 1.0;
		uv += (wb * breathe * uBreath + wf * uFlow) * px * tex;
		// heat haze: rising, near the ground
		if (uShimmer > 0.001) {
			float sm = uShimmer * smoothstep(0.8, 0.2, vUv.y);
			uv.x += sin(vUv.y * 190.0 - uTime * 6.0 + vn3(vec3(vUv * vec2(9.0, 30.0), uTime * 0.8)) * 5.0) * sm * px.x * 2.2;
			uv.y += (vn3(vec3(vUv * vec2(12.0, 26.0) - vec2(0.0, uTime * 1.2), uTime * 0.3)) - 0.5) * sm * px.y * 4.0;
		}
		// (past the edge: the picture mirrored, so nothing smears)
		uv = clamp(1.0 - abs(1.0 - abs(uv)), vec2(0.001), vec2(0.999));

		vec3 c = s2l(texture2D(tScene, uv).rgb);
		vec4 T = texture2D(tTrail, uv);
		vec3 soft = textureLod(tTrail, uv, 1.0).rgb;
		// edges cut like glass (peyote); a dreamy softness (the fly agaric)
		c = max(c + (c - soft) * uSharp, 0.0);
		c = mix(c, soft, uSoft);
		// tracers: what moved leaves itself behind
		float moved = smoothstep(0.02, 0.18, abs(lum(T.rgb) - lum(c)));
		c = mix(c, T.rgb, uTrail * moved);
		c = max(c, T.rgb * uAfter * 0.92);
		// a moment ago, laid over now
		c = mix(c, texture2D(tHold, uv).rgb, uDream);
		// halos round lights, with rainbow fringes
		vec3 b = vec3(textureLod(tTrail, uv, 5.4).r, textureLod(tTrail, uv, 4.9).g, textureLod(tTrail, uv, 4.4).b);
		vec3 b2 = textureLod(tTrail, uv, 3.0).rgb;
		vec3 halo = max(b - uThr, 0.0) * 1.3 + max(b2 - uThr - 0.1, 0.0) * 0.8;
		halo = mix(vec3(lum(halo)), halo, 1.0 + uRainbow * 1.5);
		c += max(halo, 0.0) * uHalo;

		float l = lum(c);
		// colour: deeper, richer, the hues wandering slowly across the view
		c = max(vec3(l) + (c - l) * (1.0 + uSat), 0.0);
		c = hueRot(c, uHue * sin(dot(d, vec3(1.3, 2.1, 0.7)) * 1.4 + uTime * 0.17));
		// an iridescence drifting over everything: even pale things take on colour
		vec3 ir = pal(dot(d, vec3(0.8, 1.3, 0.5)) * 0.7 + uTime * 0.025);
		c = mix(c, c * ir / max(0.25, lum(ir)), uIris * mix(0.5, 1.0, tex));
		c = pow(max(c, 0.0), vec3(1.0 + uDeep * 0.22));
		c *= mix(vec3(1.0), vec3(1.1, 0.98, 0.8), uWarm);
		c = mix(c, c * mix(vec3(0.82, 0.72, 1.28), vec3(0.78, 1.12, 1.16), smoothstep(0.08, 0.6, l)), uTone);
		c += c * c * uLight;
		// the phosphor glow of the dark (glowcap)
		c += uGlowCol * smoothstep(0.03, 0.4, textureLod(tTrail, uv, 2.0).a) * uGlow * 0.12 * (1.0 - smoothstep(0.0, 0.45, l)) * (0.8 + 0.2 * sin(uTime * 0.7 + d.x * 9.0));

		vec2 sp = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0))) / 6.2831853 * 36.0;
		float pole = smoothstep(0.35, 0.7, sqrt(max(0.0, 1.0 - d.y * d.y)));
		// sound as colour (veilhorn): the music's balance tints the textured world
		if (uSynth > 0.001) {
			vec3 sc = uSound.x * vec3(0.95, 0.2, 0.55) + uSound.y * vec3(0.35, 0.95, 0.45) + uSound.z * vec3(0.3, 0.6, 1.0);
			sc /= max(0.001, max(sc.r, max(sc.g, sc.b)));
			float rings = 0.5 + 0.5 * sin(r * 34.0 - uTime * 5.0);
			c = mix(c, c * (0.5 + sc * 1.2), uSynth * (0.35 + 0.4 * uBeat) * tex * (0.6 + 0.4 * rings));
		}
		// the lattice, only where there is texture to grow out of, in drifting patches
		if (uLattice > 0.001) {
			vec3 pc;
			float fw = min(0.2, length(fwidth(sp)));
			float m = lattice(sp, d, fw, pc);
			float patchy = smoothstep(0.35, 0.7, vn3(d * 2.2 + uTime * 0.02));
			float mask = m * uLattice * patchy * smoothstep(0.04, 0.25, detail) * smoothstep(0.02, 0.15, l) * (1.0 - smoothstep(0.9, 1.0, l)) * pole;
			c = mix(c, c * (0.35 + 1.9 * pc), mask);
			c += pc * mask * 0.06;
		}
		// embers rising (emberfoot)
		if (uSparks > 0.001) {
			for (int i = 0; i < 2; i++) {
				float fi = float(i);
				vec2 q = sp * (1.2 + fi * 0.7) - vec2(0.0, uTime * (0.35 + fi * 0.15));
				vec2 cid = floor(q), f = fract(q) - 0.5;
				float hh = h21(cid + fi * 7.1);
				if (hh < 0.14) {
					vec2 o = (vec2(h21(cid + 3.3), h21(cid + 9.7)) - 0.5) * 0.6;
					o.x += 0.18 * sin(uTime * 1.3 + hh * 40.0);
					float s = exp(-dot(f - o, f - o) * 700.0) * (0.6 + 0.4 * sin(uTime * 3.0 + hh * 90.0));
					c += vec3(1.0, 0.45, 0.12) * s * uSparks * 1.4;
				}
			}
		}
		// the edges close in; heavy eyelids
		c *= 1.0 - uVig * smoothstep(0.35, 1.05, length((vUv - 0.5) * vec2(uAspect, 1.0)));
		float lid = 0.52 - uLids * 0.3;
		c *= 1.0 - smoothstep(lid, lid + 0.16, abs(vUv.y - 0.5)) * 0.85 * step(0.001, uLids);
		gl_FragColor = vec4(c, 1.0);
		#include <colorspace_fragment>
	}
`;

// ---------------------------------------------------------------------------------------

export function createMushrooms(island, shared, scene, camera, profile, opts = {}) {
	const { isPhone = false, hint = () => {}, mount = document.body } = opts;
	const kinds = (profile?.shrooms || ['psilocybe']).filter((k) => SHROOMS[k]);
	const rnd = mulberry32(((island.seed >>> 0) ^ 0x5b0073) >>> 0);
	const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;
	const glowCol = profile?.caves?.glow || [0.3, 1.0, 0.8];
	const GLOW = { glowcap: glowCol.map((c) => c * 0.75), emberfoot: [1.0, 0.26, 0.03], veilhorn: [0.55, 0.9, 0.7] };

	// ---------- where they grow ----------
	const trees = [];
	const V = opts.vegetation;
	if (V?.cells && V.species) {
		const keys = V.species.filter((q) => q.tree).map((q) => q.key);
		for (const c of V.cells.values()) for (const k of keys) for (const it of c.items[k] || []) trees.push(it);
	}
	const hAt = (x, z) => island.heightAt(x, z);
	const slope = (x, z) => 1 - island.normalAt(x, z).y;
	const mask = (x, z, ch) => island.maskAt(x, z, ch);
	const arid = profile?.type === 'ARID';
	// how good a place is for each kind (0: not at all); relax widens the net where few fit
	function habitat(kind, x, z, relax) {
		const h = hAt(x, z);
		if (h < 0.4 || Math.abs(x) > island.half * 0.97 || Math.abs(z) > island.half * 0.97) return 0;
		// not up in the snow and bare rock of the heights
		if (h > island.peak.h * ((profile?.snow || 0) > 0.05 ? 0.55 : 0.8)) return 0;
		const sl = slope(x, z), path = mask(x, z, 0), vil = mask(x, z, 1), tall = mask(x, z, 2), wood = mask(x, z, 3);
		if (path > 0.25 + relax * 0.2 || vil > 0.3 + relax * 0.2) return 0;
		const G = SHROOMS[kind].grows;
		if (G === 'grass') return h > 2.6 && sl < 0.2 + relax * 0.1 && wood < 0.35 + relax * 0.2 ? (1 - wood) * (1 - 0.6 * tall) : 0;
		if (G === 'trees' || G === 'shade') return h > 2.5 && sl < 0.35 + relax * 0.1 && wood > 0.55 - relax * 0.2 ? wood : 0;
		if (G === 'sand') return arid ? (sl < 0.28 + relax * 0.1 && wood < 0.3 + relax * 0.3 ? 1 - sl : 0) : (h < 2.2 + relax && sl < 0.2 ? 1 : 0);
		if (G === 'ash') return h > 0.8 && sl < 0.35 + relax * 0.15 ? 1 - sl : 0;
		// the damp dark: deep woods, hollows under rock
		return h > 1.2 && sl < 0.5 && wood > 0.65 - relax * 0.3 ? wood : relax > 1 && sl > 0.2 && sl < 0.55 ? 0.3 : 0;
	}
	const WANT = { psilocybe: 14, amanita: 11, glowcap: 9, peyote: 13, emberfoot: 14, veilhorn: 10 };
	const clusters = [];
	const tooClose = (x, z, d) => clusters.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < d * d);
	for (const kind of kinds) {
		const want = Math.round(WANT[kind] * (isPhone ? 0.8 : 1));
		let got = 0;
		for (let relax = 0; relax < 3 && got < want * 0.6; relax++) {
			const cand = [];
			if ((kind === 'amanita' || SHROOMS[kind].grows === 'shade') && trees.length) {
				// at the foot of a tree, a pace or two out from the trunk
				for (let i = 0; i < 900 && trees.length; i++) {
					const t = trees[Math.floor(rnd() * trees.length)], a = rnd() * 6.283, d = 1.6 + rnd() * 2;
					const x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
					if (hAt(x, z) > 2.5 && slope(x, z) < 0.35 + relax * 0.1 && mask(x, z, 0) < 0.3) cand.push({ x, z, s: 0.6 + rnd(), tree: t });
				}
			} else {
				const R = island.R * 1.1;
				for (let i = 0; i < 3000; i++) {
					const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R, s = habitat(kind, x, z, relax);
					if (s > 0) cand.push({ x, z, s: s * (0.5 + rnd()) });
				}
			}
			cand.sort((a, b) => b.s - a.s);
			for (const c of cand) {
				if (got >= want) break;
				if (tooClose(c.x, c.z, 22)) continue;
				clusters.push({ kind, x: c.x, z: c.z, y: hAt(c.x, c.z), tree: c.tree || null, members: [], eaten: false });
				got++;
			}
		}
	}

	// ---------- the troops: rings, arcs and tufts, each member one instance ----------
	const up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), eu = new THREE.Euler();
	function member(c, x, z, y, s, variants, onGround = true) {
		let tilt = q0.identity();
		if (onGround) {
			const n = island.normalAt(x, z);
			nv.set(n.x, n.y, n.z).lerp(up, 0.4).normalize();
			tilt = q0.setFromUnitVectors(up, nv);
		}
		q1.setFromEuler(eu.set((rnd() - 0.5) * 0.16, rnd() * 6.283, (rnd() - 0.5) * 0.16));
		s *= SIZE[c.kind] || 1;
		const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tilt.clone().multiply(q1), new THREE.Vector3(s, s, s));
		c.members.push({ v: Math.floor(rnd() * variants), m });
	}
	function populate(c, onGround = true) {
		const n = { psilocybe: 7 + rnd() * 8, amanita: 4 + rnd() * 5, glowcap: 2 + rnd() * 3, peyote: 1 + rnd() * 4, emberfoot: 6 + rnd() * 9, veilhorn: 1 + rnd() * 2.5 }[c.kind] | 0;
		const variants = MODELS[c.kind][1];
		const ground = (x, z) => (onGround ? hAt(x, z) : c.y);
		if (c.kind === 'amanita') {
			// an arc of a fairy ring round the tree
			const cx = c.tree ? c.tree.x : c.x, cz = c.tree ? c.tree.z : c.z;
			const a0 = Math.atan2(c.z - cz, c.x - cx), R = Math.hypot(c.x - cx, c.z - cz) || 2, span = 0.8 + rnd() * 1.6;
			for (let i = 0; i < n; i++) {
				const a = a0 + (i / Math.max(1, n - 1) - 0.5) * span + (rnd() - 0.5) * 0.15, r = R + (rnd() - 0.5) * 0.5;
				const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
				member(c, x, z, ground(x, z) - 0.01, 0.8 + rnd() * 0.45, variants, onGround);
			}
			return;
		}
		const spread = { psilocybe: 0.7, glowcap: 0.25, peyote: 0.22, emberfoot: 0.45, veilhorn: 0.5 }[c.kind];
		for (let i = 0; i < n; i++) {
			const a = rnd() * 6.283, r = spread * Math.sqrt(rnd());
			const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
			const sink = c.kind === 'peyote' ? 0.006 : 0.004;
			member(c, x, z, ground(x, z) - sink, 0.8 + rnd() * 0.4, variants, onGround);
		}
	}
	for (const c of clusters) populate(c);
	// the grass grows thin and short where a troop stands (as it does round a house), so
	// the caps show above it; any plant standing right there makes way
	if (opts.vegetation?.addContacts) {
		const spots = [];
		for (const c of clusters) {
			if (c.kind === 'amanita') for (const mb of c.members) spots.push({ x: mb.m.elements[12], z: mb.m.elements[14], w: 0.45, d: 0.45, face: 0 });
			else spots.push({ x: c.x, z: c.z, w: c.kind === 'psilocybe' ? 1.1 : 0.8, d: 0.8, face: 0 });
		}
		opts.vegetation.addContacts(spots);
	}

	// ---------- the meshes ----------
	const group = new THREE.Group();
	group.name = 'mushrooms';
	scene.add(group);
	const meshes = {}, mats = {};
	const CAVE_ROOM = 16 * 5;
	for (const kind of kinds) {
		const [make, nv2] = MODELS[kind];
		mats[kind] = shroomMaterial(kind, shared, GLOW[kind] || [0, 0, 0]);
		meshes[kind] = [];
		for (let v = 0; v < nv2; v++) {
			const g = make(mulberry32(((island.seed >>> 0) + v * 977 + kind.length * 31) >>> 0), v);
			const cap = clusters.filter((c) => c.kind === kind).reduce((s, c) => s + c.members.length, 0) + (kind === 'glowcap' ? CAVE_ROOM : 0);
			const im = new THREE.InstancedMesh(g, mats[kind], Math.max(1, cap));
			im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = false;
			im.name = 'shroom-' + kind;
			group.add(im);
			meshes[kind].push(im);
		}
	}
	// only the troops near you are drawn: rewritten a few times a second
	let streamT = 0;
	const camP = new THREE.Vector3();
	function stream() {
		camP.copy(camera.position);
		const fill = {};
		for (const kind of kinds) fill[kind] = meshes[kind].map(() => 0);
		for (const c of clusters) {
			if (c.eaten || !meshes[c.kind]) continue;
			const far = (SEEN[c.kind] || 45) + 4;
			if ((c.x - camP.x) ** 2 + (c.z - camP.z) ** 2 + (c.y - camP.y) ** 2 > far * far) continue;
			for (const mb of c.members) {
				const im = meshes[c.kind][mb.v], i = fill[c.kind][mb.v]++;
				if (i < im.instanceMatrix.count) im.setMatrixAt(i, mb.m);
			}
		}
		for (const kind of kinds) meshes[kind].forEach((im, v) => {
			const n = Math.min(fill[kind][v], im.instanceMatrix.count);
			if (n || im.count) { im.count = n; im.instanceMatrix.needsUpdate = true; }
			im.visible = n > 0;
		});
	}

	// glowcaps on the cave floors, once the underworld has made them
	let spotsSeen = 0, spotsT = 0;
	function pollSpots() {
		if (!kinds.includes('glowcap')) return;
		const S = opts.spots?.() || [];
		if (!S.length || S.length === spotsSeen) return;
		const r2 = mulberry32(((island.seed >>> 0) ^ 0xc4e) + S.length);
		const pick = S.slice(spotsSeen).filter(() => r2() < 0.45).slice(0, 16 - clusters.filter((c) => c.cave).length);
		spotsSeen = S.length;
		for (const s of pick) {
			if (clusters.some((c) => c.cave && Math.hypot(c.x - s.x, c.z - s.z) < 6)) continue;
			const c = { kind: 'glowcap', x: s.x, z: s.z, y: s.y, cave: true, members: [], eaten: false };
			populate(c, false);
			if (c.members.length) clusters.push(c);
		}
		streamT = 0;
	}

	// ---------- picking ----------
	const btnStyle = 'position:absolute;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(8,20,26,.78);color:#eafaf6;font:600 14px system-ui;cursor:pointer;z-index:5;';
	const prompt = document.createElement('button');
	prompt.type = 'button';
	prompt.style.cssText = btnStyle + 'left:50%;transform:translateX(-50%);bottom:calc(178px + env(safe-area-inset-bottom));padding:10px 20px;border-radius:24px;display:none;text-align:center;max-width:86vw;';
	const chip = document.createElement('div');
	chip.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;padding:5px 6px 5px 12px;border-radius:16px;background:rgba(8,20,26,.55);border:1px solid rgba(255,255,255,.14);color:#eafaf6;font:12px system-ui;z-index:5;transition:opacity 1.2s;pointer-events:auto;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
	const chipText = document.createElement('span');
	const chipX = document.createElement('button');
	chipX.type = 'button'; chipX.textContent = '×'; chipX.title = 'Let it pass'; chipX.setAttribute('aria-label', 'End the experience');
	chipX.style.cssText = 'width:24px;height:24px;border-radius:12px;border:0;background:rgba(255,255,255,.1);color:#eafaf6;font:600 14px system-ui;cursor:pointer;line-height:1;padding:0;';
	chip.append(chipText, chipX);
	for (const el of [prompt, chip]) { for (const ev of ['pointerdown', 'touchstart', 'keydown', 'mousedown']) el.addEventListener(ev, (e) => e.stopPropagation()); mount.appendChild(el); }
	let near = null, scanT = 0;
	prompt.onclick = (e) => { e.stopPropagation(); prompt.blur(); if (near) pick(near); };
	chipX.onclick = (e) => { e.stopPropagation(); chipX.blur(); end(); };
	const onKey = (e) => {
		if ((e.key === 'e' || e.key === 'E') && near && !e.repeat && prompt.style.display !== 'none' && !e.target.closest?.('input,textarea,[contenteditable]')) { e.preventDefault(); pick(near); }
	};
	addEventListener('keydown', onKey);
	function pick(c) {
		if (trip && !trip.ending) { hint('Better let this one pass first.', 2500); return; }
		c.eaten = true;
		near = null; prompt.style.display = 'none';
		streamT = 0;
		eat(c.kind);
	}
	function scan() {
		const P = opts.player?.();
		near = null;
		if (P && !P.flying && !P.diving) {
			const fx = P.pos.x, fy = P.pos.y - 1.68, fz = P.pos.z;
			let best = REACH * REACH;
			for (const c of clusters) {
				if (c.eaten || Math.abs(c.y - fy) > 2.5) continue;
				const d = (c.x - fx) ** 2 + (c.z - fz) ** 2;
				if (d < best) { best = d; near = c; }
			}
		}
		if (near) {
			const S = SHROOMS[near.kind];
			const html = `🍄 ${S.name} — eat?${isPhone ? '' : ' <span style="opacity:.55;font-weight:400">(E)</span>'}<div style="font:400 11px system-ui;opacity:.62;margin-top:3px"><i>${S.latin}</i> · ${S.look}</div>`;
			if (prompt.innerHTML !== html) prompt.innerHTML = html;
		}
		const d = near ? 'block' : 'none';
		if (prompt.style.display !== d) prompt.style.display = d;
	}

	// ---------- the experience ----------
	let trip = null;
	const E = { k: 0, fov: 1, time: 1, muffle: 0 };
	const smoother = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
	function eat(kind, o = {}) {
		if (!SHROOMS[kind]) return `unknown: ${kind} (${Object.keys(SHROOMS).join(', ')})`;
		const [on, pk, dn] = TIMES[kind];
		trip = { kind, t: +o.at || 0, on, pk, dn, fade: 1, ending: false, freeze: !!o.freeze, phase: -1, note: 18 + Math.random() * 10, said: new Set(), flash: 20, flashT: -1, twitch: 8, tw: [0, 0], twv: [0, 0], beat: 0, quiet: 0, fresh: true };
		if (!o.at) hint(`You eat the ${SHROOMS[kind].name.toLowerCase()}${kind === 'peyote' ? '. Bitter, and a little sour.' : '. Earthy, a little bitter.'}`, 4000);
		return state();
	}
	function end() { if (trip && !trip.ending) { trip.ending = true; hint('You let it ease away.', 2500); } }
	function curve(T) {
		const { t, on, pk, dn } = T;
		// it creeps up, then comes on in a rush
		if (t < on) return smoother(t / on) * Math.pow(t / on, 0.8);
		if (t < on + pk) return 1 - 0.1 * Math.pow(Math.sin(Math.PI * 3 * (t - on) / pk), 2);
		return 1 - smoother((t - on - pk) / dn);
	}
	function say(T, which) {
		const L = JOURNAL[T.kind][which].filter((s) => !T.said.has(s));
		if (!L.length) return;
		const s = L[Math.floor(Math.random() * L.length)];
		T.said.add(s);
		hint(`“${s}”`, 5500);
	}

	// ---------- the music ----------
	let A = null;
	function audio(wet) {
		const out = window._masterClip || window.leadBus227, c = out?.context;
		if (!c || c.state !== 'running') return;
		if (!A || A.c !== c) {
			if (wet < 0.002) return;
			try {
				// a long soft room, and one side of it a moment late: wider, deeper
				const len = Math.floor(c.sampleRate * 3.2), ir = c.createBuffer(2, len, c.sampleRate);
				for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1); }
				const send = c.createGain(), conv = c.createConvolver(), split = c.createChannelSplitter(2), merge = c.createChannelMerger(2), late = c.createDelay(0.05), gain = c.createGain();
				send.gain.value = 1; conv.buffer = ir; late.delayTime.value = 0.017; gain.gain.value = 0;
				out.connect(send); send.connect(conv); conv.connect(split);
				split.connect(merge, 0, 0); split.connect(late, 1); late.connect(merge, 0, 1);
				merge.connect(gain); gain.connect(c.destination);
				A = { c, out, send, gain };
			} catch { A = null; return; }
		}
		A.gain.gain.setTargetAtTime(wet, A.c.currentTime, 0.4);
	}
	function audioOff() {
		if (!A) return;
		try { A.out.disconnect(A.send); A.gain.disconnect(); } catch { /* already gone */ }
		A = null;
	}

	// ---------- the passes ----------
	const U = {
		tScene: { value: null }, tTrail: { value: null }, tHold: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uAspect: { value: 1 },
		uCamRot: { value: new THREE.Matrix3() }, uProjInv: { value: new THREE.Matrix4() }, uTwitch: { value: new THREE.Vector2() }, uSound: { value: new THREE.Vector3() }, uGlowCol: { value: new THREE.Color(...glowCol) },
	};
	const CH = ['uIris', 'uSat', 'uDeep', 'uHue', 'uWarm', 'uTone', 'uLight', 'uBreath', 'uFlow', 'uTrail', 'uHalo', 'uThr', 'uRainbow', 'uLattice', 'uStyle', 'uVig', 'uLids', 'uSharp', 'uGlow', 'uAfter', 'uShimmer', 'uSparks', 'uRipple', 'uSynth', 'uBarrel', 'uDream', 'uSoft', 'uBeat'];
	for (const n of CH) U[n] = { value: 0 };
	const TU = { tScene: U.tScene, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uDecay: { value: 0 }, uDrift: { value: 0 }, uTime: U.uTime };
	const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
	quad.frustumCulled = false;
	quadScene.add(quad);
	const compMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: QUAD_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false, toneMapped: false });
	const trailMat = new THREE.ShaderMaterial({ uniforms: TU, vertexShader: QUAD_VS, fragmentShader: TRAIL_FS, depthTest: false, depthWrite: false, toneMapped: false });
	const copyMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: QUAD_VS, fragmentShader: COPY_FS, depthTest: false, depthWrite: false, toneMapped: false });
	let rtScene = null, trails = null, hold = null, flip = 0;
	const size = new THREE.Vector2();
	function targets(renderer) {
		renderer.getDrawingBufferSize(size);
		const w = Math.max(1, size.x | 0), h = Math.max(1, size.y | 0);
		if (rtScene && rtScene.width === w && rtScene.height === h) return;
		disposeTargets();
		// the scene drawn as if to the screen: flagged like an XR target, three tone maps and
		// encodes into it exactly as it does to the canvas (same shaders, nothing recompiles),
		// and blending happens in the same space. Stored as plain bytes, as the canvas is.
		rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, samples: 4, depthBuffer: true });
		rtScene.texture.internalFormat = 'RGBA8';
		rtScene.isXRRenderTarget = true;
		const ts = isPhone ? 0.5 : 1, tw = Math.max(1, Math.round(w * ts)), th = Math.max(1, Math.round(h * ts));
		const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
		const mk = () => new THREE.WebGLRenderTarget(tw, th, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
		trails = [mk(), mk()];
		hold = new THREE.WebGLRenderTarget(tw, th, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false });
		if (trip) trip.fresh = true;
	}
	function disposeTargets() {
		for (const t of [rtScene, hold, ...(trails || [])]) t?.dispose();
		rtScene = hold = trails = null;
	}
	function pass(renderer, mat, target) {
		quad.material = mat;
		renderer.setRenderTarget(target);
		renderer.render(quadScene, quadCam);
	}

	// ---------- per frame ----------
	let lastT = 0, dtR = 0;
	function update(dt, t) {
		dtR = dt;
		lastT = t;
		const now = performance.now();
		if (now > streamT) { streamT = now + 300; stream(); }
		if (now > spotsT) { spotsT = now + 2000; pollSpots(); }
		if (now > scanT) { scanT = now + 250; scan(); }
		for (const kind of kinds) mats[kind].userData.U.uGlowK.value = kind === 'glowcap' && trip?.kind === 'glowcap' ? 1 + E.k * 0.8 : 1;
		if (!trip) { E.k = 0; E.fov = 1; E.time = 1; E.muffle = 0; return; }
		const T = trip, R = RECIPES[T.kind];
		if (!T.freeze) T.t += dt;
		if (T.ending) T.fade = Math.max(0, T.fade - dt / END_FADE);
		const total = T.on + T.pk + T.dn;
		if (T.t >= total || T.fade <= 0) {
			if (!T.ending) hint('The world is ordinary again. Mostly.', 4500);
			trip = null; E.k = 0; E.fov = 1; E.time = 1; E.muffle = 0;
			chip.style.display = 'none'; audio(0); setTimeout(() => { if (!trip) audioOff(); }, 3000);
			return;
		}
		const k = clamp(curve(T) * T.fade, 0, 1);
		E.k = k;
		const ph = T.t < T.on ? 0 : T.t < T.on + T.pk ? 1 : 2;
		if (ph !== T.phase) { T.phase = ph; T.phaseAt = now; }
		// the chip: bright when the phase turns, then quiet
		chipText.textContent = `🍄 ${SHROOMS[T.kind].name} · ${T.ending ? 'fading' : PHASES[ph]}`;
		if (chip.style.display !== 'flex') chip.style.display = 'flex';
		const op = now - T.phaseAt < 6000 ? '0.92' : '0.42';
		if (chip.style.opacity !== op) chip.style.opacity = op;
		// what goes through your head
		T.note -= dt;
		if (T.note < 0 && !T.freeze && !T.ending) { T.note = 32 + Math.random() * 26; say(T, ph); }
		// the channels: colour follows k, motion comes on later, the geometry only near the peak
		const col = k, mot = Math.pow(k, 1.4) * calm, fine = smoothstep(0.5, 0.95, k), tr = Math.pow(k, 1.6);
		const g = (n) => R[n] || 0;
		U.uIris.value = g('iris') * col; U.uSat.value = g('sat') * col; U.uDeep.value = g('deep') * col; U.uHue.value = g('hue') * col; U.uWarm.value = g('warm') * col;
		U.uTone.value = g('tone') * col; U.uLight.value = g('light') * col; U.uGlow.value = g('glow') * col; U.uAfter.value = g('after') * tr;
		U.uBreath.value = g('breath') * mot * (0.6 + 0.4 * fine); U.uFlow.value = g('flow') * mot * fine;
		U.uTrail.value = g('trail') * tr; U.uHalo.value = g('halo') * col; U.uThr.value = g('thr') || 0.6; U.uRainbow.value = g('rainbow');
		U.uLattice.value = g('lattice') * fine; U.uStyle.value = g('style'); U.uVig.value = g('vig') * col; U.uSharp.value = g('sharp') * col; U.uSoft.value = g('soft') * col;
		U.uShimmer.value = g('shimmer') * mot; U.uSparks.value = g('sparks') * fine; U.uRipple.value = g('ripple') * mot; U.uSynth.value = g('synth') * col; U.uBarrel.value = g('barrel') * mot * Math.sin(t * 0.21);
		TU.uDecay.value = 0; TU.uDrift.value = g('drift') * 0.004 * mot;
		// heavy eyelids: drooping, lifting, never closing
		U.uLids.value = g('lids') * col * (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.33), 3));
		// the beat, from the music (or, without it, a slow heartbeat)
		const bass = shared.uBass?.value || 0, mid = shared.uMid?.value || 0, high = shared.uHigh?.value || 0;
		T.quiet = bass + mid + high > 0.02 ? 0 : T.quiet + dt;
		const beat = T.quiet > 2 ? Math.pow(0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 1.05), 10) : clamp(bass * 1.3 + (shared.uPulse?.value || 0) * 0.5, 0, 1.5);
		T.beat += (beat - T.beat) * (beat > T.beat ? Math.min(1, dt * 20) : Math.min(1, dt * 4));
		U.uBeat.value = T.beat;
		if (T.quiet > 2) U.uSound.value.set(0.5 + 0.5 * Math.sin(t * 0.4), 0.5 + 0.5 * Math.sin(t * 0.31 + 2), 0.5 + 0.5 * Math.sin(t * 0.23 + 4));
		else U.uSound.value.lerp(new THREE.Vector3(bass, mid, high), Math.min(1, dt * 3));
		// dream flashes: now and then a moment of a few seconds ago lies over the present
		T.flash -= dt;
		if (g('dream') && T.flash < 0 && fine > 0.5) { T.flash = 16 + Math.random() * 14; T.flashT = 0; T.snap = true; }
		if (T.flashT >= 0) {
			T.flashT += dt;
			const x = T.flashT / 4.5;
			U.uDream.value = x < 1 ? Math.pow(Math.sin(Math.PI * x), 2) * 0.42 * fine : 0;
			if (x >= 1) T.flashT = -1;
		} else U.uDream.value = 0;
		// twitches: a small jolt, sprung back
		T.twitch -= dt;
		if (g('twitch') && T.twitch < 0 && fine > 0.4) {
			T.twitch = 5 + Math.random() * 9;
			const a = Math.random() * 6.283, m = (3 + Math.random() * 3) / 1080 * calm;
			T.twv[0] += Math.cos(a) * m * 26; T.twv[1] += Math.sin(a) * m * 26;
		}
		for (let i = 0; i < 2; i++) { T.twv[i] += (-T.tw[i] * 160 - T.twv[i] * 14) * Math.min(dt, 0.05); T.tw[i] += T.twv[i] * Math.min(dt, 0.05); }
		U.uTwitch.value.set(T.tw[0], T.tw[1]);
		// sizes swell and shrink; time slows
		E.fov = g('fov') ? 1 + calm * mot * (0.225 * Math.sin(t * 2 * Math.PI / 23) + 0.025 * Math.sin(t * 0.9)) : 1;
		E.time = 1 - g('dilate') * fine;
		E.muffle = g('muffle') * col;
		audio(g('wet') * col);
	}

	const qSave = new THREE.Quaternion(), roll = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), xAxis = new THREE.Vector3(1, 0, 0);
	function render(renderer, sc, cam) {
		if (!trip || E.k < 0.001) {
			if (rtScene && !trip) disposeTargets();
			return false;
		}
		targets(renderer);
		const R = RECIPES[trip.kind], mot = Math.pow(E.k, 1.4) * calm;
		// the view sways, heavy and slow
		qSave.copy(cam.quaternion);
		const sway = (R.sway || 0) * mot * Math.PI / 180;
		if (sway) {
			cam.quaternion.multiply(roll.setFromAxisAngle(zAxis, sway * (0.7 * Math.sin(lastT * 0.37) + 0.3 * Math.sin(lastT * 0.23 + 1))));
			cam.quaternion.multiply(roll.setFromAxisAngle(xAxis, sway * 0.35 * Math.sin(lastT * 0.29 + 2)));
		}
		cam.updateMatrixWorld();
		const prevTarget = renderer.getRenderTarget();
		renderer.setRenderTarget(rtScene);
		renderer.render(sc, cam);
		U.uCamRot.value.setFromMatrix4(cam.matrixWorld);
		U.uProjInv.value.copy(cam.projectionMatrixInverse);
		cam.quaternion.copy(qSave);
		cam.updateMatrixWorld();
		// the trail
		const a = trails[flip], b = trails[1 - flip];
		flip = 1 - flip;
		U.tScene.value = rtScene.texture;
		TU.tPrev.value = b.texture;
		TU.uTexel.value.set(1 / rtScene.width, 1 / rtScene.height);
		TU.uDecay.value = trip.fresh ? 0 : Math.pow(R.decay || 0.85, Math.min(3, dtR * 60)) * Math.min(1, Math.pow(E.k, 1.6) * 1.5);
		trip.fresh = false;
		pass(renderer, trailMat, a);
		if (trip.snap) { trip.snap = false; copyMat.uniforms.tSrc.value = a.texture; pass(renderer, copyMat, hold); }
		// onto the screen
		U.tTrail.value = a.texture; U.tHold.value = hold.texture;
		U.uRes.value.set(rtScene.width, rtScene.height);
		U.uAspect.value = rtScene.width / rtScene.height;
		U.uTime.value = lastT;
		pass(renderer, compMat, prevTarget);
		return true;
	}

	function state() { return trip ? { kind: trip.kind, phase: trip.ending ? 'fading' : PHASES[Math.max(0, trip.phase)], k: +E.k.toFixed(3), t: +trip.t.toFixed(1) } : { kind: null, phase: 'sober', k: 0, t: 0 }; }
	function dispose() {
		removeEventListener('keydown', onKey);
		prompt.remove(); chip.remove();
		disposeTargets();
		audioOff();
		for (const m of [compMat, trailMat, copyMat, ...Object.values(mats)]) m.dispose();
		quad.geometry.dispose();
		for (const kind of kinds) for (const im of meshes[kind]) { im.geometry.dispose(); im.dispose(); }
		scene.remove(group);
		trip = null;
	}
	return {
		update, render, eat, end, state, dispose,
		timeScale: () => E.time,
		fov: () => E.fov,
		// how muffled hearing is (0..1), for the host's low-pass
		muffle: () => E.muffle,
		// for looking into them: every troop, where, and whether it is still there
		clusters: () => clusters.map((c) => ({ kind: c.kind, x: +c.x.toFixed(1), y: +c.y.toFixed(2), z: +c.z.toFixed(1), n: c.members.length, cave: !!c.cave, eaten: c.eaten })),
		group,
	};
}
