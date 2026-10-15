// Sleeves, cuffs and gloves seen through your own eyes: the first-person cloth over your own
// forearms (the weapon view, crysis/viewmodel.js, and the fists, combat/melee-view.js), cut
// from the outfit you wear (people/wardrobe.js, combat/outfits.js) and tailored to this body.
//
// The shape: each sleeve is laid over the forearm's own cross-section, measured on the body at
// rest and bridged where cloth would bridge it (a convex hull: flatter on the inside, fuller
// over the muscle on the outside), tapering from the elbow to the wrist, standing off the skin
// by the garment's ease (more at the back of the arm than the front), and finished as real
// clothes are: a ribbed knit cuff on a hoodie or sweatshirt, a buttoned band and placket on a
// shirt, a tabbed band on a combat shirt, a bound storm cuff on a shell, a turned hem on a
// long tee, a thick folded band at the elbow on rolled sleeves. Every edge has a thickness: a
// rolled rim and the inside face turned back up the sleeve, so it never reads as paper. A
// jacket over a shirt shows both hems at the wrist; gloves (tactical ones for soldiers and
// police) are shells over the hand's own skin with moulded knuckles and a strapped cuff.
//
// The folds: no cloth simulation. A few numbers for each arm, read off the bones each frame
// (how bent the elbow is, how far the hand is turned against it, how far the arm reaches
// forward, which way is down), drive a displacement in the vertex shader: folds stacked above
// the cuff (deeper when the sleeve rides up as you aim), a fan at the inside of the elbow,
// spiral folds when the hand turns, drag lines when the arm reaches, fullness hanging on the
// down side, and a little remembered creasing everywhere. The same field tilts the normals.
//
// The cloth: procedural detail at the cloth's real scale, faded out before it can shimmer:
// cotton jersey loops, a sweatshirt's heathered face, shirting, ripstop twill, nylon with a
// sheen, denim with its twill and worn crests, canvas, fleece with its fuzz, leather, rib knit,
// suiting and brushed flannel; the colours and prints from the outfit (camouflage at its real
// blotch size, plaid, stripes, a track stripe), seams with their stitching, and on worn clothes
// a grimy cuff edge, faded fold crests and the odd mark. Lit by the same lights as the hands.
//
// The cost: one mesh and one draw for all of it (sleeves, under-layer and gloves), the skin
// hidden under it left out of the hands' mesh. Nothing is made per frame.

import * as THREE from 'three';
import { qualityNow, onQuality } from '../world/governor.js';

// ---------- what a garment is made of, and how its sleeve ends ----------
export const FAB = { jersey: 0, sweat: 1, shirting: 2, twill: 3, nylon: 4, denim: 5, canvas: 6, fleece: 7, leather: 8, knit: 9, wool: 10, flannel: 11 };
export const PAT = { plain: 0, stripe: 1, pinstripe: 2, plaid: 3, check: 4, track: 5, camo: 6, quilt: 7, dots: 8 };
export const CUFF = { hem: 0, rib: 1, button: 2, storm: 3, band: 4, tab: 5 };
// (the parts of the mesh, for the shader)
const PART = { tube: 0, cuff: 1, rim: 2, roll: 3, glove: 4, gloveCuff: 5 };

const RIB_KINDS = /^(hoodie|sweat|knit|track|bomber|puffer|halfzip|fleece|rash)$/;
const BUTTON_KINDS = /^(shirt|flannel|oxford|denim|chore|utility|jacket|blazer|trench|quilted)$/;
// the cloth a garment is cut from, by its kind and its own say
function fabricOf(g) {
	if (g.fab === 'fleece') return 'fleece';
	if (g.fab === 'leather' || g.kind === 'leather') return 'leather';
	if (g.pat === 'denim' || g.kind === 'denim') return 'denim';
	if (g.pat === 'chambray') return 'shirting';
	if (g.pat === 'camo') return g.kind === 'hoodie' ? 'sweat' : 'twill';
	if (g.fab === 'nylon' || g.fab === 'tech' || /^(shell|puffer|quilted|bomber|track|pufferVest|suit|rash|jersey)$/.test(g.kind)) return 'nylon';
	if (g.kind === 'flannel' || g.pat === 'plaid') return 'flannel';
	if (g.fab === 'canvas' || g.fab === 'linen' || /^(chore|utility|jacket|carpenter|trench)$/.test(g.kind)) return 'canvas';
	if (g.fab === 'wool' || /^(blazer|tunic)$/.test(g.kind)) return 'wool';
	if (/^(hoodie|sweat|halfzip)$/.test(g.kind)) return 'sweat';
	if (g.kind === 'knit' || g.pat === 'rib') return 'knit';
	if (/^(shirt|oxford|coverup)$/.test(g.kind)) return 'shirting';
	return 'jersey';
}
function patternOf(g) {
	const p = g.pat;
	if (p === 'camo') return 'camo';
	if (p === 'stripe' || p === 'breton') return 'stripe';
	if (p === 'pinstripe') return 'pinstripe';
	if (p === 'plaid') return 'plaid';
	if (p === 'check') return 'check';
	if (p === 'track') return 'track';
	if (p === 'quilt') return 'quilt';
	if (p === 'dots') return 'dots';
	return 'plain';
}
function cuffOf(g, fab) {
	if (g.pat === 'camo' && g.kind !== 'hoodie') return 'tab';
	if (g.kind === 'shell') return 'storm';
	if (RIB_KINDS.test(g.kind)) return 'rib';
	if (BUTTON_KINDS.test(g.kind) || fab === 'shirting') return g.kind === 'blazer' || g.kind === 'leather' ? 'band' : 'button';
	if (g.kind === 'leather' || g.kind === 'coverup' || g.kind === 'tunic' || g.kind === 'suit') return 'band';
	return 'hem';
}
// how far a garment stands off what is under it, and how thick it is (metres)
const EASE = { jersey: 0.006, sweat: 0.012, shirting: 0.009, twill: 0.01, nylon: 0.016, denim: 0.013, canvas: 0.014, fleece: 0.014, leather: 0.012, knit: 0.011, wool: 0.012, flannel: 0.011 };
const WALL = { jersey: 0.0012, sweat: 0.0028, shirting: 0.0008, twill: 0.0011, nylon: 0.0009, denim: 0.0017, canvas: 0.0018, fleece: 0.0035, leather: 0.0016, knit: 0.0034, wool: 0.0016, flannel: 0.0016 };
// how stiff (big, few folds) or soft (small, many folds) it is
const STIFF = { jersey: 0.15, sweat: 0.45, shirting: 0.45, twill: 0.6, nylon: 0.7, denim: 0.85, canvas: 0.9, fleece: 0.55, leather: 0.8, knit: 0.35, wool: 0.6, flannel: 0.45 };
const FIT = { tight: 0.45, fitted: 0.75, regular: 1, oversized: 1.4, baggy: 1.4 };
const hex = (c, d) => { try { return c ? new THREE.Color(c).getHex() : d; } catch { return d; } };
// a small hash of an outfit, so the same clothes always wear the same way
function hashOf(...xs) { let h = 2166136261; for (const x of xs) for (const ch of String(x ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; }

// one garment's sleeve, as the shader and the cutter need it
function layerOf(g, slot, o) {
	const fab = fabricOf(g), pat = patternOf(g);
	let length = g.sleeves || 'short';
	if (length === 'long' || length === 'elbow') length = g.roll ? 'rolled' : length === 'elbow' ? 'short' : 'long';
	if (length === 'cap' || length === 'none') length = 'none';
	const fit = FIT[g.fit] ?? 1, cuff = cuffOf(g, fab);
	// a garment in two colours: the sleeves in the second (garment.js paints 'block' the same)
	let col = hex(g.col, 0x6a6e72), acc = hex(g.acc, col), acc2 = hex(g.acc2, acc);
	if (g.pat === 'block') [col, acc] = [acc, col];
	const camo = pat === 'camo';
	const uniform = camo || o.acc?.some((q) => q.police || q.kind === 'peaked' || q.kind === 'carrier');
	// worn: street clothes a little, fighters' kit more, a pressed uniform hardly at all
	const wear = Math.min(1, (o.gen === 'alien' ? (uniform && !camo ? 0.12 : 0.42) : 0.22) + hashOf(g.kind, g.col) * 0.15);
	// the thread: tonal, or the gold of denim
	const thread = fab === 'denim' ? 0xc8862c : new THREE.Color(col).multiplyScalar(0.72).getHex();
	// the cuff band's colour: a ringer's or a team shirt's trim, else the garment's own
	const cuffCol = g.pat === 'ringer' || g.pat === 'jersey' ? acc : g.pat === 'hazmat' ? acc : col;
	return {
		slot, kind: g.kind, fab, pat, length, cuff, col, acc, acc2, thread, cuffCol,
		ease: EASE[fab] * fit * (g.kind === 'puffer' ? 1.8 : 1), wall: WALL[fab] * (g.kind === 'puffer' ? 4 : 1), stiff: STIFF[fab],
		wear, seed: hashOf(g.kind, g.col, g.acc) * 6.283, uniform: !!uniform,
		// how far the cuff rides up the forearm as the arm reaches and aims
		ride: cuff === 'rib' ? 0.007 : cuff === 'storm' ? 0.012 : fab === 'jersey' ? 0.012 : 0.018,
	};
}

// What the outfit puts over your forearms: the layers of sleeve (the top's, then a jacket's
// over it) and the gloves. o: an outfit (wardrobe.js: { top, outer, acc: [...] }).
export function sleeveSpec(o = {}) {
	const T = o?.top, J = o?.outer, layers = [];
	const inner = T ? layerOf(T, 0, o) : null;
	const outer = J && J.sleeves && J.sleeves !== 'none' ? layerOf(J, 1, o) : null;
	if (outer && outer.length === 'rolled') outer.length = 'long';
	if (outer && outer.length === 'long') {
		// a jacket's sleeve, with the top's cuff showing under it when the top has long sleeves
		if (inner && inner.length === 'long') layers.push({ ...inner, under: true });
		layers.push(outer);
	} else if (inner && (inner.length === 'long' || inner.length === 'rolled')) layers.push(inner);
	const G = o?.acc?.find?.((q) => q.kind === 'gloves');
	let glove = null;
	if (G) {
		const tactical = T?.pat === 'camo' || o.acc.some((q) => q.kind === 'carrier' || q.kind === 'helmet' || q.kind === 'peaked' || q.police);
		const col = hex(G.col, 0x2a2b2e);
		glove = { kind: tactical ? 'tactical' : 'knit', col, palm: tactical ? new THREE.Color(col).lerp(new THREE.Color(0x6b5a44), 0.25).getHex() : col, knuckle: new THREE.Color(col).multiplyScalar(0.6).getHex(), wear: tactical ? 0.35 : 0.2 };
	}
	return { layers, glove, bare: !layers.length };
}

// ---------- the arm at rest ----------
const _m = new THREE.Matrix4();
const bindAt = (P, i) => new THREE.Vector3().setFromMatrixPosition(_m.copy(P.skeleton.boneInverses[i]).invert());
// the forearm's frame on this body at rest: the wrist, the axis up to the elbow, the palm's
// side (U) and the other way round (V = A x U), and where round the arm the inside of the
// elbow, the seam and a shirt's placket fall
export function armFrame(P, side) {
	const m = P.map, iE = m['lowerarm01.' + side], iT = m['lowerarm02.' + side], iW = m['wrist.' + side], iS = m['upperarm01.' + side];
	if (iE == null || iW == null) return null;
	const E = bindAt(P, iE), W = bindAt(P, iW), S = iS != null ? bindAt(P, iS) : E.clone().add(new THREE.Vector3(side === 'L' ? -0.16 : 0.16, 0.18, 0));
	const A = E.clone().sub(W), Lf = A.length(); A.normalize();
	const Lu = S.distanceTo(E);
	const f2 = m['finger2-1.' + side] != null ? bindAt(P, m['finger2-1.' + side]) : W.clone().addScaledVector(A, -0.08);
	const f5 = m['finger5-1.' + side] != null ? bindAt(P, m['finger5-1.' + side]) : W.clone().addScaledVector(A, -0.07).add(new THREE.Vector3(0, -0.03, 0));
	const n = f2.clone().sub(W).cross(f5.clone().sub(W)).normalize();
	if (n.x * (side === 'R' ? -1 : 1) > 0) n.negate();
	const perp = (v) => v.clone().addScaledVector(A, -v.dot(A)).normalize();
	const U = perp(n), V = new THREE.Vector3().crossVectors(A, U);
	const angle = (d) => Math.atan2(d.dot(V), d.dot(U));
	const up = E.clone().sub(S).normalize(), fore = A.clone().negate();
	const inner = perp(up.clone().negate().addScaledVector(fore, up.dot(fore)).lengthSq() > 1e-6 ? up.clone().negate().addScaledVector(fore, up.dot(fore)) : new THREE.Vector3(0, 0, 1));
	const ulnar = perp(f5.clone().sub(f2));
	const fingers = [2, 3, 4, 5].map((k) => m[`finger${k}-1.${side}`]).filter((i) => i != null).map((i) => bindAt(P, i));
	return {
		side, sign: side === 'L' ? 0 : 1, W, E, S, A, U, V, Lf, Lu, iE, iT: iT ?? iE, iW, iS,
		inner: angle(inner), seam: angle(inner.clone().add(ulnar).normalize()), placket: angle(ulnar.clone().addScaledVector(U, -0.9).normalize()),
		fingers, palm: U.clone(),
	};
}

// The forearm's cross-section along its length, measured on the body at rest (its own shaped
// vertices, P._p, the body's 13380 without the fitting helpers) and bridged as cloth bridges
// it. Returns r(s, theta): metres from the axis at s metres up from the wrist.
const BODY_VERTS = 13380, NT = 32, DS = 0.01, S0 = -0.01;
export function forearmEnvelope(P, F) {
	const p = P._p, n = Math.min(BODY_VERTS, (p?.length || 0) / 3), smax = F.Lf + 0.02;
	const NS = Math.ceil((smax - S0) / DS) + 1, grid = new Float32Array(NS * NT);
	const d = new THREE.Vector3(), q = new THREE.Vector3();
	for (let v = 0; v < n; v++) {
		d.set(p[v * 3] - F.W.x, p[v * 3 + 1] - F.W.y, p[v * 3 + 2] - F.W.z);
		const s = d.dot(F.A);
		if (s < S0 - 0.004 || s > smax + 0.004) continue;
		q.copy(d).addScaledVector(F.A, -s);
		const r = q.length();
		if (r > 0.085) continue;
		const th = Math.atan2(q.dot(F.V), q.dot(F.U));
		const i = Math.max(0, Math.min(NS - 1, Math.round((s - S0) / DS))), j = ((Math.round(th / (Math.PI * 2) * NT) % NT) + NT) % NT;
		grid[i * NT + j] = Math.max(grid[i * NT + j], r);
	}
	// rings with nothing measured (a body without its vertices): a plain forearm
	const fallback = (s) => 0.026 + 0.016 * Math.min(1, Math.max(0, s / F.Lf)) * (P.height || 1.75) / 1.75;
	for (let i = 0; i < NS; i++) {
		const row = grid.subarray(i * NT, i * NT + NT);
		let any = 0; for (const r of row) any += r > 0 ? 1 : 0;
		if (any < 4) { row.fill(fallback(S0 + i * DS)); continue; }
		// gaps round the ring filled from the nearest measured on either side
		const src = Float32Array.from(row);
		for (let j = 0; j < NT; j++) if (!src[j]) {
			let a = 1, b = 1;
			while (!src[(j - a + NT) % NT]) a++;
			while (!src[(j + b) % NT]) b++;
			row[j] = (src[(j - a + NT) % NT] * b + src[(j + b) % NT] * a) / (a + b);
		}
		// cloth spans the hollows: the hull of the section (each angle as far out as any chord across it)
		const hull = Float32Array.from(row);
		for (let j = 0; j < NT; j++) for (let k = 1; k <= 7; k++) {
			const r1 = row[(j - k + NT) % NT], r2 = row[(j + k) % NT], a = k / NT * Math.PI * 2;
			hull[j] = Math.max(hull[j], 2 * r1 * r2 * Math.cos(a) / (r1 + r2));
		}
		row.set(hull);
	}
	// along the arm: a little smoothing, never inward of what was measured
	const out = new Float32Array(grid.length);
	for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
		const a = grid[Math.max(0, i - 1) * NT + j], b = grid[i * NT + j], c = grid[Math.min(NS - 1, i + 1) * NT + j];
		out[i * NT + j] = Math.max(b, (a + 2 * b + c) / 4, Math.max(a, c) * 0.94) + 0.0018;
	}
	const at = (s, th) => {
		let k = 1;
		if (s > smax) { k = 1 + Math.min(0.35, (s - smax) * 1.6); s = smax; }
		const x = Math.max(0, Math.min(NS - 1.001, (s - S0) / DS)), i = Math.floor(x), fx = x - i;
		const y = (((th / (Math.PI * 2)) * NT) % NT + NT) % NT, j = Math.floor(y), fy = y - j, j2 = (j + 1) % NT;
		const r0 = out[i * NT + j] * (1 - fy) + out[i * NT + j2] * fy, r1 = out[(i + 1) * NT + j] * (1 - fy) + out[(i + 1) * NT + j2] * fy;
		return (r0 * (1 - fx) + r1 * fx) * k;
	};
	at.grid = out; at.NS = NS;
	return at;
}

// ---------- the cut: where each part of a sleeve lies along the arm ----------
// Each layer is a list of stations, from far up the arm down to its hem, round its rim and back
// up inside: { s (metres up from the wrist), off (metres off the forearm), face (+1 outside,
// -1 inside, a rim between), part, fold (how much it folds), sh (metres up from the hem) }.
const CUFF_LEN = { rib: 0.066, button: 0.052, tab: 0.046, storm: 0.012, hem: 0, band: 0 };
const HEM_DEPTH = { rib: 0.066, button: 0.052, tab: 0.046, storm: 0.014, hem: 0.022, band: 0.02 };
// where a long sleeve ends: metres up from the wrist joint (the knob of the wrist bone)
function hemAt(L) { return L.cuff === 'rib' ? 0.003 : L.cuff === 'storm' ? -0.004 : L.cuff === 'hem' ? 0.008 : 0.009; }
export function layerStations(L, F, { far, lite = false, under = null, glove = false } = {}) {
	const st = [], k = lite ? 1.7 : 1;
	const push = (s, off, face, part, fold, sh) => st.push({ s, off, face, part, fold, sh });
	if (L.length === 'rolled') {
		// sleeves rolled: the sleeve up the arm, a thick band of three folds just over the elbow,
		// curled under at its lower edge, and the bare forearm below
		const lo = F.Lf - 0.014, hi = F.Lf + 0.062, ease = L.ease * 0.8;
		for (let s = far; s > hi + 0.02; s -= (s > hi + 0.12 ? 0.12 : 0.03 * k)) push(s, ease, 1, PART.tube, 0.6, s - lo);
		push(hi + 0.012, ease * 0.9, 1, PART.tube, 0.3, hi + 0.012 - lo);
		const n = lite ? 12 : 21;
		for (let i = 0; i <= n; i++) {
			const u = 1 - i / n, s = lo + (hi - lo) * u, f = (u * 3) % 1, ki = Math.min(2, Math.floor(u * 3));
			const bump = 0.0058 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, f))), 0.55) + (ki === 0 ? 0.0018 : 0);
			push(s, 0.0045 + bump + 0.0028 * (1 - u), 1, PART.roll, 0.25, 1 + u);
		}
		const R = 0.0042;
		for (let i = 1; i <= (lite ? 3 : 5); i++) { const a = i / (lite ? 3 : 5) * Math.PI; push(lo - Math.sin(a) * R, 0.0045 + 0.0018 + 0.0028 + R * (Math.cos(a) - 1), Math.cos(a), PART.rim, 0, 1); }
		push(lo + 0.008, 0.0016, -1, PART.rim, 0, 1); push(lo + 0.018, 0.0013, -1, PART.rim, 0, 1);
		return { stations: st, hem: lo, offAt: () => 0.012 };
	}
	if (L.length !== 'long') return null;
	const cuff = L.cuff, len = CUFF_LEN[cuff], wall = Math.max(0.0008, L.wall);
	// a layer over another stands off that one, not the skin
	const base = (s) => under ? under.offAt(s) + under.wall + 0.0025 : glove && s < 0.045 ? 0.0045 : 0;
	const hem = L.under ? hemAt(L) - 0.002 : under ? under.hem + 0.013 : hemAt(L) + (glove && cuff !== 'rib' ? 0.004 : 0);
	const cuffOff = { rib: 0.0034, button: 0.0062, tab: 0.0068, storm: 0.0058, hem: L.ease * 0.82, band: L.ease * 0.9 }[cuff] + wall;
	const offAt = (s) => {
		const sh = s - hem;
		let o;
		if (sh <= len) o = cuffOff;
		else if (cuff === 'rib') o = L.ease * (1 + 0.28 * Math.exp(-Math.pow((sh - len - 0.014) / 0.012, 2)));
		else if (cuff === 'storm') o = cuffOff + (L.ease - cuffOff) * Math.min(1, (sh - len) / 0.04);
		else o = sh < len + 0.006 ? cuffOff + (L.ease * 0.85 - cuffOff) * (sh - len) / 0.006 : L.ease;
		return Math.max(o, base(s) + wall + 0.0012);
	};
	// up the arm, densest where it shows: the cuff and the forearm
	const sTop = L.under ? hem + 0.075 : far;
	const steps = [];
	// (past the elbow the sleeve only has to run on out of view)
	for (let s = sTop; s > F.Lf + 0.15; s -= 0.12) steps.push(s);
	for (let s = Math.min(sTop, F.Lf + 0.15); s > hem + len + 0.11; s -= (s > F.Lf ? 0.035 : 0.016) * k) steps.push(s);
	for (let s = Math.min(sTop, hem + len + 0.11); s > hem + len + 0.02; s -= 0.008 * k) steps.push(s);
	for (let s = Math.min(sTop, hem + len + 0.02); s > hem + len; s -= 0.004 * k) steps.push(s);
	// the cuff's edges sharp, its middle plain
	if (len > 0) { steps.push(hem + len, hem + len - 0.003); if (!lite) steps.push(hem + len * 0.5); steps.push(hem + 0.003); }
	steps.push(hem);
	const seen = new Set();
	for (const s of steps.sort((a, b) => b - a)) {
		const key = Math.round(s * 1e4); if (seen.has(key)) continue; seen.add(key);
		const sh = s - hem, inCuff = sh <= len + 1e-4 && len > 0;
		const fold = inCuff ? 0 : Math.min(1, (sh - len) / 0.012);
		push(s, offAt(s), 1, inCuff ? PART.cuff : PART.tube, fold, sh);
	}
	// the rim, rolled round the cloth's own thickness, then the inside face turned back up
	const R = Math.max(0.0007, wall * 0.5), o0 = offAt(hem), n = lite ? 2 : 4;
	for (let i = 1; i <= n; i++) { const a = i / n * Math.PI; push(hem - Math.sin(a) * R, o0 - R + Math.cos(a) * R, Math.cos(a), PART.rim, 0, 0); }
	const depth = HEM_DEPTH[cuff];
	for (const t of lite ? [1] : [0.45, 1]) push(hem + depth * t, Math.max(offAt(hem + depth * t) - wall, base(hem + depth * t) + 0.001), -1, PART.rim, 0, depth * t);
	return { stations: st, hem, offAt, wall };
}

// ---------- the build ----------
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
// the skin's weights near the wrist, carried over to cloth lying on it; up the forearm,
// the forearm's own two bones by how far along it is
function weightsFor(F, s, th, pos, near) {
	const W = new Map();
	const add = (b, w) => { if (w > 1e-4) W.set(b, (W.get(b) || 0) + w); };
	const x = Math.max(0, s / F.Lf), w02 = 0.52 * (1 - smooth(0.09, 0.8, x));
	const t = near.length ? smooth(0.03, 0.052, s) : 1;
	if (t < 1) {
		// the nearest skin, weighted by nearness
		let best = [];
		for (const q of near) {
			const ds = q.s - s, da = Math.atan2(Math.sin(q.th - th), Math.cos(q.th - th)) * 0.03;
			const d2 = ds * ds + da * da;
			if (best.length < 6) { best.push([d2, q]); best.sort((a, b) => a[0] - b[0]); } else if (d2 < best[5][0]) { best[5] = [d2, q]; best.sort((a, b) => a[0] - b[0]); }
		}
		let sum = 0; for (const [d2] of best) sum += 1 / (d2 + 1e-6);
		for (const [d2, q] of best) for (let k = 0; k < 4; k++) add(q.si[k], q.sw[k] * (1 - t) / (d2 + 1e-6) / sum);
	}
	add(F.iE, (1 - w02) * t); add(F.iT, w02 * t);
	const top = [...W].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((a, b) => a + b[1], 0) || 1;
	return [0, 1, 2, 3].map((k) => top[k] ? [top[k][0], top[k][1] / tot] : [0, 0]);
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The garment over one body's forearms: one geometry for all its layers and gloves, skinned to
// the body's own bones (the same indices as the hands' skin), and which of the hands' skin
// triangles it hides. skinGeo: the hands' own (refined) skin geometry, in the body's bind space.
export function buildGarment(P, spec, skinGeo, { sides = ['L', 'R'], lite = false, far = null } = {}) {
	const pos = [], nor = [], si = [], sw = [], ga = [], gb = [], idx = [];
	const frames = {}, hide = new Set();
	const sp = skinGeo.attributes.position, sn = skinGeo.attributes.normal, ssi = skinGeo.attributes.skinIndex, ssw = skinGeo.attributes.skinWeight, six = skinGeo.index.array;
	const sideOf = P.bones.map((b) => b.name.endsWith('.L') ? 'L' : b.name.endsWith('.R') ? 'R' : '');
	const topBone = (v) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) if (ssw.getComponent(v, k) > w) { w = ssw.getComponent(v, k); b = ssi.getComponent(v, k); } return b; };
	for (const side of sides) {
		const F = armFrame(P, side);
		if (!F) continue;
		frames[side] = F;
		const env = forearmEnvelope(P, F);
		// this side's skin, in the forearm's terms
		const sOf = new Float32Array(sp.count), mine = new Uint8Array(sp.count), near = [];
		for (let v = 0; v < sp.count; v++) {
			if (sideOf[topBone(v)] !== side) continue;
			mine[v] = 1;
			_d.fromBufferAttribute(sp, v).sub(F.W); const s = _d.dot(F.A); sOf[v] = s;
			if (s > -0.012 && s < 0.065) { _v.copy(_d).addScaledVector(F.A, -s); near.push({ s, th: Math.atan2(_v.dot(F.V), _v.dot(F.U)), si: [0, 1, 2, 3].map((k) => ssi.getComponent(v, k)), sw: [0, 1, 2, 3].map((k) => ssw.getComponent(v, k)) }); }
		}
		const N = lite ? 10 : 16, farS = far ?? F.Lf + 0.9;
		// a surface of revolution round the forearm, from stations, onto the cloth's arrays
		const lathe = (stations, slot, ease, fold0) => {
			const base = pos.length / 3, rows = stations.length, cols = N + 1, P3 = [];
			for (let i = 0; i < rows; i++) {
				const S = stations[i];
				for (let j = 0; j < cols; j++) {
					const th = F.seam + j / N * Math.PI * 2;
					// bands are stiff: rounder than the arm under them
					const circ = S.part === PART.cuff || S.part === PART.gloveCuff ? 0.45 : S.part === PART.roll || S.part === PART.rim ? 0.3 : 0;
					let r = env(Math.max(-0.006, S.s), th);
					if (circ) { let mean = 0; for (let q = 0; q < 8; q++) mean += env(Math.max(-0.006, S.s), q / 8 * Math.PI * 2); mean /= 8; r = Math.max(r, r + (mean * 1.02 - r) * circ); }
					// more room at the back of the arm than the front
					const back = S.part === PART.tube ? 1 + 0.22 * Math.cos(th - F.inner - Math.PI) * S.fold : 1;
					const R = r + S.off * back;
					_d.copy(F.U).multiplyScalar(Math.cos(th)).addScaledVector(F.V, Math.sin(th));
					const p = F.W.clone().addScaledVector(F.A, S.s).addScaledVector(_d, R);
					P3.push(p); pos.push(p.x, p.y, p.z);
					const W4 = weightsFor(F, S.s, th, p, near);
					for (const [b, w] of W4) { si.push(b); sw.push(w); }
					ga.push(S.s, th, S.sh, R);
					gb.push(F.sign + 2 * slot, S.part, S.fold * fold0, ease);
				}
			}
			// normals from the surface itself, turned the way each station faces
			for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
				const jj = j === N ? 0 : j;
				const a = P3[i * cols + (jj + 1) % N], b = P3[i * cols + (jj - 1 + N) % N], c = P3[Math.min(rows - 1, i + 1) * cols + j], d = P3[Math.max(0, i - 1) * cols + j];
				const n = new THREE.Vector3().subVectors(a, b).cross(_v.subVectors(c, d));
				if (n.lengthSq() < 1e-14) n.copy(F.A);
				n.normalize();
				const th = F.seam + j / N * Math.PI * 2, face = stations[i].face;
				_d.copy(F.U).multiplyScalar(Math.cos(th)).addScaledVector(F.V, Math.sin(th)).multiplyScalar(face).addScaledVector(F.A, -Math.sqrt(Math.max(0, 1 - face * face)));
				if (n.dot(_d) < 0) n.negate();
				nor.push(n.x, n.y, n.z);
			}
			for (let i = 0; i < rows - 1; i++) for (let j = 0; j < N; j++) {
				const a = base + i * cols + j, b = a + 1, c = a + cols, d = c + 1;
				for (const [x, y, z] of [[a, c, b], [b, c, d]]) {
					// wound to face the way the normals do
					const px = P3[x - base], e1 = _v.subVectors(P3[y - base], px), e2 = _d.subVectors(P3[z - base], px), fn = e1.cross(e2);
					const vn = nor[x * 3] + nor[y * 3] + nor[z * 3], vy = nor[x * 3 + 1] + nor[y * 3 + 1] + nor[z * 3 + 1], vz = nor[x * 3 + 2] + nor[y * 3 + 2] + nor[z * 3 + 2];
					if (fn.x * vn + fn.y * vy + fn.z * vz < 0) idx.push(x, z, y); else idx.push(x, y, z);
				}
			}
			return rows;
		};
		// the sleeves, innermost first
		let under = null, lowest = Infinity, rolled = false;
		for (const L of spec.layers) {
			const cut = layerStations(L, F, { far: farS, lite, under: L.under ? null : under, glove: !!spec.glove });
			if (!cut) continue;
			lathe(cut.stations, L.slot, L.ease, 1);
			if (L.length === 'rolled') rolled = true;
			else lowest = Math.min(lowest, cut.hem);
			if (L.under || !under) under = { ...cut, wall: L.wall };
		}
		// the gloves: a shell over the hand's own skin, moulded knuckles, a strapped cuff
		if (spec.glove) {
			const remap = new Map(), stop = 0.012;
			const knuckle = (p) => { let k = 0; for (const f of F.fingers) k = Math.max(k, Math.exp(-p.distanceToSquared(f) / (0.011 * 0.011))); return k; };
			const n = new THREE.Vector3();
			for (let t = 0; t < six.length; t += 3) {
				const a = six[t], b = six[t + 1], c = six[t + 2];
				if (!mine[a] || !mine[b] || !mine[c] || sOf[a] > stop || sOf[b] > stop || sOf[c] > stop) continue;
				hide.add(t / 3);
				for (const v of [a, b, c]) {
					if (!remap.has(v)) {
						remap.set(v, pos.length / 3);
						_v.fromBufferAttribute(sp, v); n.fromBufferAttribute(sn, v).normalize();
						const palm = n.dot(F.palm), kn = palm < -0.15 ? knuckle(_v) * smooth(-0.15, -0.5, palm) : 0;
						const off = 0.0011 + Math.max(0, -palm) * 0.0005 + kn * 0.0032;
						pos.push(_v.x + n.x * off, _v.y + n.y * off, _v.z + n.z * off); nor.push(n.x, n.y, n.z);
						for (let k = 0; k < 4; k++) { si.push(ssi.getComponent(v, k)); sw.push(ssw.getComponent(v, k)); }
						ga.push(sOf[v], palm, kn, 0); gb.push(F.sign + 4, PART.glove, 0, 0.002);
					}
					idx.push(remap.get(v));
				}
			}
			// the cuff: neoprene round the wrist over the shell's edge, with a strap
			const cs = [];
			const R = 0.0016;
			cs.push({ s: 0.03, off: 0.0016, face: -1, part: PART.gloveCuff, fold: 0, sh: 0.03 });
			cs.push({ s: 0.037, off: 0.0016, face: -1, part: PART.gloveCuff, fold: 0, sh: 0.037 });
			for (let i = 0; i <= 3; i++) { const a = (1 - i / 3) * Math.PI; cs.push({ s: 0.042 + Math.sin(a) * R, off: 0.0032 + Math.cos(a) * R, face: Math.cos(a), part: PART.gloveCuff, fold: 0, sh: 0.042 }); }
			for (const s of lite ? [0.03, 0.012, 0.0] : [0.036, 0.028, 0.018, 0.01, 0.004, 0.0]) cs.push({ s, off: s < 0.008 ? 0.0014 + 0.0034 * s / 0.008 : 0.0048, face: 1, part: PART.gloveCuff, fold: 0, sh: s });
			lathe(cs, 2, 0.002, 0);
		}
		// the skin a long sleeve or a glove's cuff hides, left out of the hands' mesh
		const ride = Math.max(0.012, ...spec.layers.map((L) => L.ride));
		const cullFrom = lowest + ride + 0.012;
		if (isFinite(cullFrom) && !rolled) for (let t = 0; t < six.length; t += 3) {
			const a = six[t], b = six[t + 1], c = six[t + 2];
			if (mine[a] && mine[b] && mine[c] && sOf[a] > cullFrom && sOf[b] > cullFrom && sOf[c] > cullFrom) hide.add(t / 3);
		}
		// (and under a glove's cuff)
		if (spec.glove) for (let t = 0; t < six.length; t += 3) {
			const a = six[t], b = six[t + 1], c = six[t + 2];
			if (mine[a] && mine[b] && mine[c] && sOf[a] > 0.014 && sOf[b] > 0.014 && sOf[c] > 0.014 && sOf[a] < 0.036 && sOf[b] < 0.036 && sOf[c] < 0.036) hide.add(t / 3);
		}
	}
	if (!idx.length) return { geometry: null, hide, frames };
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
	g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
	g.setAttribute('garA', new THREE.Float32BufferAttribute(ga, 4));
	g.setAttribute('garB', new THREE.Float32BufferAttribute(gb, 4));
	g.setIndex(idx); g.computeBoundingSphere();
	return { geometry: g, hide, frames };
}

// ---------- the shader ----------
// the folds, shared by the vertex shader (the cloth moved) and the fragment shader (its shading)
const FOLD_GLSL = /* glsl */`
uniform vec4 uArm[2];
uniform vec3 uDown[2];
uniform vec4 uGeo[2];
uniform vec4 uLay[3];
uniform vec4 uLayB[3];
float garHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float garNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(garHash(i), garHash(i + vec2(1, 0)), f.x), mix(garHash(i + vec2(0, 1)), garHash(i + vec2(1, 1)), f.x), f.y); }
float garAng(float a) { return atan(sin(a), cos(a)); }
// a fold's profile: broad round crests, tight creases between
float garRidge(float x) { return pow(abs(sin(x * 0.5)), 0.7) - 0.55; }
// the folds of the cloth at s metres up the forearm, theta round it, sh up from its hem (in units of the ease)
float garFold(float s, float th, float sh, int side, int slot) {
	vec4 arm = uArm[side], geo = uGeo[side], lay = uLay[slot], lb = uLayB[slot];
	float stiff = lay.w, seed = lb.w, Lf = geo.x, c0 = lb.y;
	float bend = arm.x, twist = arm.y, reach = arm.z, ride = arm.w;
	vec3 dn = uDown[side];
	float h = 0.0;
	// folds stacked above the cuff: deeper as it rides up, as the wrist bends, as the hand hangs
	float lam = mix(0.02, 0.034, stiff);
	float ph = 1.8 * sin(th * 2.0 + seed) + 0.9 * sin(th * 3.0 + seed * 1.7);
	float env = smoothstep(c0, c0 + 0.012, sh) * (1.0 - smoothstep(0.045, 0.11 + 0.05 * stiff, sh - c0));
	h += env * min(1.1, 0.38 + 0.9 * ride + 0.3 * bend + 0.4 * max(0.0, -dn.x)) * garRidge((sh - c0 + ride * lb.z * 0.6) / lam * 6.2832 + ph);
	// the hand turned against the elbow: folds spiralling along the forearm
	float tw = clamp(abs(twist) / 1.3, 0.0, 1.0);
	float span = smoothstep(c0 + 0.01, c0 + 0.05, sh) * (1.0 - smoothstep(Lf * 0.75, Lf * 1.0, s));
	h += 1.1 * tw * span * garRidge(th * 2.0 * sign(twist + 1e-4) + s / mix(0.05, 0.075, stiff) * 6.2832 + seed);
	// the inside of the elbow: a fan of folds as it bends
	float de = garAng(th - geo.y);
	h += 1.3 * bend * exp(-pow((s - Lf) / 0.075, 2.0)) * exp(-de * de * 1.3) * garRidge((s - Lf) / 0.02 * 6.2832 + abs(de) * 4.0);
	// reaching forward: long drag lines down the back of the forearm
	h += 0.8 * reach * span * garRidge(th * 4.0 + s * 22.0 + seed * 2.0) * (0.6 - 0.4 * cos(th - geo.y));
	// the cloth's weight: fullness hanging on the down side, and soft folds in it
	float sg = max(0.0, cos(th) * dn.y + sin(th) * dn.z);
	h += smoothstep(c0 + 0.004, c0 + 0.04, sh) * (0.95 * sg * sg + 0.3 * sg * garRidge(th * 8.0 + s * 12.0 + seed));
	// creases it remembers
	h += 0.45 * (garNoise(vec2(s * 30.0, th * 2.0 + seed)) - 0.5) + 0.1 * (garNoise(vec2(s * 80.0 + 7.0, th * 4.0 + seed)) - 0.5);
	return h;
}
`;
const VERT_HEAD = /* glsl */`
attribute vec4 garA;
attribute vec4 garB;
uniform vec3 uAxis[2];
varying vec4 vGarA;
varying vec4 vGarB;
varying float vFold;
varying vec3 vGarP;
float gH = 0.0;
` + FOLD_GLSL;
const VERT_NORMAL = /* glsl */`
vGarA = garA; vGarB = garB; vGarP = position;
int gSide = int(mod(garB.x, 2.0) + 0.5), gSlot = int(floor(garB.x / 2.0 + 0.01));
if (garB.z > 0.001) {
	float r = max(garA.w, 0.01);
	float h0 = garFold(garA.x, garA.y, garA.z, gSide, gSlot);
#ifdef GAR_LITE
	float hs = garFold(garA.x + 0.003, garA.y, garA.z + 0.003, gSide, gSlot), ht = garFold(garA.x, garA.y + 0.003 / r, garA.z, gSide, gSlot);
#endif
	gH = max(h0 * garB.z, -0.5) * garB.w;
#ifdef GAR_LITE
	// (on the cheaper tier the folds tilt the normals here; otherwise the fragments do it, finer)
	vec3 ax = uAxis[gSide], tt = normalize(cross(ax, objectNormal));
	objectNormal = normalize(objectNormal - ax * (hs - h0) / 0.003 * garB.z * garB.w - tt * (ht - h0) / 0.003 * garB.z * garB.w);
#endif
}
vFold = gH / max(garB.w, 0.002);
`;
const VERT_POS = /* glsl */`
transformed += normal * gH;
// a sleeve riding up the arm as it reaches and aims, most at the hem
if (gSlot < 2 && garB.y < 2.5) transformed += uAxis[gSide] * uArm[gSide].w * uLayB[gSlot].z * (1.0 - smoothstep(0.0, 0.12, garA.z));
`;
const FRAG_HEAD = FOLD_GLSL + /* glsl */`
uniform vec3 uCol[15];
varying vec4 vGarA;
varying vec4 vGarB;
varying float vFold;
varying vec3 vGarP;
float gRough = 0.85, gBump = 0.0, gSheenR = 0.8, gSpec = 0.4, gAO = 1.0;
// the folds' slope round the arm and along it (metres a metre), and the cloth's coordinates for them
vec2 gFoldGrad = vec2(0.0), gUV = vec2(0.0);
vec3 gSheen = vec3(0.0);
float gH21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gH21(i), gH21(i + vec2(1, 0)), f.x), mix(gH21(i + vec2(0, 1)), gH21(i + vec2(1, 1)), f.x), f.y); }
float gLine(float x, float w) { return 1.0 - smoothstep(0.0, w, abs(x)); }
float gAng(float a) { return atan(sin(a), cos(a)); }
// how much of a detail repeating every period metres can show when a pixel spans px (gone before it aliases)
float gFade(float period, float px) { return 1.0 - smoothstep(period * 0.25, period * 0.6, px); }
// a row of stitches across x at x0, running along y: dashes pitch metres apart, faded far off
float gStitch(float x, float x0, float y, float pitch, float px) {
	float far = smoothstep(0.0005, 0.0018, px);
	float dash = smoothstep(0.18, 0.3, fract(y / pitch)) * (1.0 - smoothstep(0.7, 0.82, fract(y / pitch)));
	return gLine(x - x0, max(0.00045, px * 0.7)) * mix(dash, 0.55, far);
}
// the cloth up close at its real scale (uv in metres): a height for the bump (metres), a tone
float gWeave(int fab, vec2 uv, float px, out float tone) {
	float h = 0.0, f = 0.003, fine = 0.0, coarse = 0.0;
	if (fab == 0 || fab == 1) {
		// jersey: columns of loops; a sweatshirt's heavier, heathered face
		vec2 k = uv * vec2(fab == 1 ? 900.0 : 1150.0, fab == 1 ? 1050.0 : 1300.0); float v = abs(fract(k.x) - 0.5) * 2.0;
		h = sin((k.y + v * 0.8) * 6.2832) * (1.0 - v * 0.6); f = fab == 1 ? 0.0011 : 0.0009;
		h *= 0.35; fine = h * 0.04; coarse = (gN(uv * vec2(260.0, 40.0)) - 0.5) * (fab == 1 ? 0.12 : 0.06) * gFade(0.004, px) + (gN(uv * 900.0) - 0.5) * 0.05 * gFade(0.0011, px);
	} else if (fab == 2 || fab == 10) {
		// shirting and suiting: a fine plain weave or twill, a little slub
		vec2 w = uv * (fab == 2 ? 1500.0 : 1100.0); h = fab == 2 ? sin(w.x * 6.2832) * sin(w.y * 6.2832) : sin((w.x + w.y) * 6.2832); f = 0.0007;
		fine = h * 0.04; coarse = (gN(vec2(uv.x * 30.0, uv.y * 500.0)) - 0.5) * 0.06;
	} else if (fab == 3) {
		// ripstop twill: diagonals and a grid of heavier threads every 5 mm
		h = sin((uv.x + uv.y) * 4500.0) * 0.6; vec2 g = fract(uv * 200.0); h += max(gLine(g.x - 0.5, 0.06), gLine(g.y - 0.5, 0.06)) * 1.2; f = 0.0012;
		fine = h * 0.04; coarse = (gN(uv * 60.0) - 0.5) * 0.08;
	} else if (fab == 4) {
		// nylon: smooth, a ripstop grid every 4 mm
		vec2 g = fract(uv * 250.0); h = max(gLine(g.x - 0.5, 0.06), gLine(g.y - 0.5, 0.06)); f = 0.002; fine = h * 0.05; coarse = (gN(uv * 25.0) - 0.5) * 0.04;
	} else if (fab == 5) {
		// denim: a twill about 1.2 mm, slubs along the warp
		h = sin((uv.x * 0.6 + uv.y) * 5200.0); f = 0.0012;
		fine = h * 0.06; coarse = (gN(vec2(uv.x * 900.0, uv.y * 40.0)) - 0.5) * 0.22 + (gN(uv * 18.0) - 0.5) * 0.1;
	} else if (fab == 6) {
		// canvas: a heavy plain weave
		vec2 w = uv * 850.0; h = sin(w.x * 6.2832) * sin(w.y * 6.2832); f = 0.0013; fine = h * 0.06; coarse = (gN(uv * 40.0) - 0.5) * 0.12;
	} else if (fab == 7 || fab == 11) {
		// fleece and brushed flannel: a soft pile
		h = gN(uv * 2600.0) * 2.0 - 1.0; f = 0.0006; fine = h * 0.04; coarse = (gN(uv * 160.0) - 0.5) * (fab == 7 ? 0.16 : 0.08);
	} else if (fab == 8) {
		// leather: a pebbled grain and long creases
		h = gN(uv * 1800.0) * 2.0 - 1.0 + (gN(uv * vec2(30.0, 140.0)) - 0.5) * 1.5; f = 0.0008; fine = h * 0.05; coarse = (gN(uv * 50.0) - 0.5) * 0.15;
	} else if (fab == 9) {
		// rib knit: raised wales along the arm, loops in them
		h = abs(sin(uv.x * 1100.0)) * 1.4 - 0.7 + sin(uv.y * 2400.0) * 0.3; f = 0.0018; fine = h * 0.07; coarse = (gN(uv * 120.0) - 0.5) * 0.08;
	}
	float near = 1.0 - smoothstep(f * 0.1, f * 0.35, px), farK = 1.0 - smoothstep(0.004, 0.03, px);
	tone = fine * 0.65 * near + coarse * 0.6 * farK;
	return h * near * 0.00004;
}
// camouflage at its printed size: three layers of soft blotches, about 5 to 12 cm across
vec3 gCamo(vec2 uv, vec3 base, vec3 a, vec3 b) {
	float n1 = gN(uv * 9.0 + 1.7) * 0.7 + gN(uv * 25.0) * 0.3;
	float n2 = gN(uv * 12.0 + vec2(3.1, 9.4)) * 0.75 + gN(uv * 33.0 + 5.0) * 0.25;
	float n3 = gN(uv * 18.0 + vec2(7.3, 2.2));
	vec3 c = mix(base, a, smoothstep(0.53, 0.57, n1));
	c = mix(c, b, smoothstep(0.58, 0.62, n2));
	return mix(c, base * 0.42, smoothstep(0.68, 0.72, n3));
}
void garSurface(inout vec3 col, bool front) {
	int slot = int(floor(vGarB.x / 2.0 + 0.01)), part = int(vGarB.y + 0.5), side = int(mod(vGarB.x, 2.0) + 0.5);
	vec4 lay = uLay[slot], lb = uLayB[slot], geo = uGeo[side];
	int fab = int(lay.x + 0.5), pat = int(lay.y + 0.5), cuff = int(lb.x + 0.5);
	vec3 base = uCol[slot * 5], acc = uCol[slot * 5 + 1], acc2 = uCol[slot * 5 + 2], thread = uCol[slot * 5 + 3], cuffC = uCol[slot * 5 + 4];
	float wear = lay.z;
	float tone = 0.0;
	if (part >= 4) {
		// a glove: stretch cloth on the back, synthetic suede on the palm, rubber over the knuckles
		float palm = vGarA.y, kn = vGarA.z;
		vec2 uv = vec2(vGarP.x + vGarP.z, vGarP.y);
		float px = length(fwidth(uv));
		float pf = smoothstep(-0.12, 0.12, palm);
		col = mix(base, acc, pf);
		gBump = gWeave(pf > 0.5 ? 7 : 4, uv, px, tone);
		col *= 1.0 + tone;
		gRough = mix(0.62, 0.92, pf); gSpec = mix(0.6, 0.3, pf);
		// the seam where palm meets back, and its stitching
		float seam = gLine(palm, 0.05);
		col = mix(col, col * 0.6, seam * 0.6); gBump -= seam * 0.0004;
		// knuckle armour: moulded rubber with ridges
		float k = smoothstep(0.25, 0.5, kn);
		col = mix(col, cuffC, k); gRough = mix(gRough, 0.45, k); gSpec = mix(gSpec, 0.8, k);
		gBump += k * (sin(kn * 40.0) * 0.0003);
		if (part == 5) {
			// the cuff: neoprene, a hook-and-loop strap across the back of the wrist
			col = base * 0.9; gRough = 0.7;
			float th = vGarA.y, strap = gLine(gAng(th - geo.w), 0.55) * gLine(vGarA.x - 0.022, 0.012);
			col = mix(col, acc * 0.8 * (0.85 + 0.3 * gN(uv * 3000.0)), smoothstep(0.0, 0.25, strap));
			gBump += strap * 0.0006;
		}
		col *= 1.0 - wear * 0.2 * smoothstep(0.6, 0.8, gN(uv * 30.0));
		gSheen = vec3(0.04); gSheenR = 0.6;
		return;
	}
	float s = vGarA.x, th = vGarA.y, sh = vGarA.z, r = vGarA.w;
	// the cloth's own coordinates, metres round from the seam and up the arm
	float around = mod(th - geo.z, 6.2831853);
	vec2 uv = vec2(around * r, s);
	float px = length(fwidth(uv));
	col = base;
	if (pat == 1) col = mix(base, acc, step(0.62, fract(s * 22.0)));
	else if (pat == 2) col = mix(base, acc, gLine(fract(uv.x * 80.0) - 0.5, 0.06) * 0.8);
	else if (pat == 3 || pat == 4) {
		float f = pat == 3 ? 11.0 : 16.0, sx = step(0.5, fract(uv.x * f)), sy = step(0.5, fract(uv.y * f));
		col = mix(base, acc, (sx + sy) * (pat == 3 ? 0.42 : 0.33));
		if (pat == 3) { col = mix(col, acc2, gLine(fract(uv.x * f * 2.0 + 0.25) - 0.5, 0.05) * 0.7); col = mix(col, acc2, gLine(fract(uv.y * f * 2.0 + 0.25) - 0.5, 0.05) * 0.7); }
	}
	else if (pat == 5) { float d = abs(gAng(th - geo.y - 3.14159)); col = mix(base, acc, gLine(d - 0.16, 0.05) + gLine(d - 0.32, 0.05)); }
	else if (pat == 6) col = gCamo(uv, base, acc, acc2);
	else if (pat == 7) { float f = fract(s * 11.0); col = base * (0.84 + 0.2 * sin(f * 3.1416)) * (1.0 - gLine(f - 0.02, 0.04) * 0.35); }
	else if (pat == 8) { vec2 q = fract(uv * 45.0) - 0.5; col = mix(base, acc, 1.0 - smoothstep(0.18, 0.22, length(q))); }
	int f2 = fab;
	if (part == 1 && cuff == 1) f2 = 9;
	gBump = gWeave(f2, uv, px, tone);
	// the folds, shaded per pixel from the same field that moved the cloth
#ifdef GAR_LITE
	float fold = vFold;
#else
	float fold = 0.0;
	gUV = vec2((th - geo.z) * r, s);
	if (vGarB.z > 0.001) {
		// the slope from the field itself, so the creases stay crisp and smooth at any distance
		float e = 0.0015, k = vGarB.z * vGarB.w;
		float h0 = garFold(s, th, sh, side, slot);
		gFoldGrad = vec2(garFold(s, th + e / r, sh, side, slot) - h0, garFold(s + e, th, sh + e, side, slot) - h0) / e * k * step(-0.5, h0 * vGarB.z);
		fold = max(h0 * vGarB.z, -0.5);
	}
#endif
	gSpec = fab == 4 ? 1.0 : fab == 8 ? 0.9 : fab == 2 ? 0.5 : fab == 3 || fab == 10 ? 0.4 : fab == 7 ? 0.15 : fab == 1 || fab == 9 || fab == 11 ? 0.25 : 0.35;
	gRough = fab == 0 ? 0.88 : fab == 1 ? 0.93 : fab == 2 ? 0.7 : fab == 3 ? 0.84 : fab == 4 ? 0.4 : fab == 5 ? 0.86 : fab == 6 ? 0.86 : fab == 7 ? 0.98 : fab == 8 ? 0.46 : fab == 9 ? 0.93 : fab == 10 ? 0.8 : 0.95;
	// a sweatshirt's and a tee's heather, denim's blue and white
	if (fab == 5) {
		// indigo warp streaked along the arm, the white weft showing through
		float warp = mix(0.5, gN(vec2(uv.x * 600.0, uv.y * 25.0)), gFade(0.0017, px));
		col = mix(col, col * 0.7, warp * 0.6);
		col = mix(col, vec3(0.62, 0.64, 0.66), 0.1 + 0.08 * mix(0.5, gN(uv * 1500.0), gFade(0.0007, px)));
	}
	col *= 1.0 + tone;
	// the cuff: a rib, a band with a button and its placket, a combat shirt's tab, a binding
	float len = lb.y;
	if (part == 1) {
		col = cuff == 1 ? cuffC * (0.95 + 0.1 * (abs(sin(uv.x * 1100.0)) - 0.5) * gFade(0.0029, px)) : cuffC * (1.0 + tone);
		if (cuff == 1) { gBump = (abs(sin(uv.x * 1100.0)) - 0.5) * 0.00025 * gFade(0.0029, px); gRough = 0.93; }
		float edge = min(sh, len - sh);
		if (cuff == 2 || cuff == 5 || cuff == 3) {
			col = mix(col, thread, gStitch(sh, 0.0028, uv.x, 0.003, px) + gStitch(sh, len - 0.0028, uv.x, 0.003, px));
			gBump -= gLine(edge, 0.0012) * 0.0003;
		}
		float dp = gAng(th - geo.w) * r;
		if (cuff == 2) {
			// the button: a disc with four holes, its own rim, a little raised
			vec2 q = vec2(dp, sh - len * 0.5); float d = length(q);
			float btn = 1.0 - smoothstep(0.0052, 0.0058, d);
			vec3 bc = lay.y > 5.5 ? acc2 * 0.5 : mix(base, vec3(0.92, 0.9, 0.85), 0.75);
			if (btn > 0.0) {
				float holes = 0.0; for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 0 || i == 3 ? 0.0013 : -0.0013, i < 2 ? 0.0013 : -0.0013); holes = max(holes, 1.0 - smoothstep(0.0005, 0.0007, length(q - o))); }
				col = mix(col, bc * (1.0 - 0.25 * gLine(d - 0.0048, 0.0006)) * (1.0 - 0.6 * holes), btn);
				gBump += btn * (0.0006 - d * 0.05) ; gRough = mix(gRough, 0.35, btn);
			}
		}
		if (cuff == 5) {
			// the tab: a strip of hook-and-loop held by a stitched box
			float tab = gLine(dp, 0.012) * gLine(sh - len * 0.5, len * 0.42);
			float box = max(gLine(abs(dp) - 0.011, 0.0006), gLine(abs(sh - len * 0.5) - len * 0.4, 0.0006)) * step(abs(dp), 0.0115) * step(abs(sh - len * 0.5), len * 0.41);
			col = mix(col, col * (0.75 + 0.2 * gN(uv * 3500.0)), smoothstep(0.0, 0.3, tab));
			col = mix(col, thread, box * 0.8);
			gBump += smoothstep(0.0, 0.3, tab) * 0.0005;
		}
		if (cuff == 3) col = mix(col, acc * 0.7, gLine(sh, 0.004));
	} else if (part == 0) {
		// the seam down the underside, and its stitching
		float du = gAng(th - geo.z) * r;
		gBump -= gLine(du, 0.0012) * 0.0004;
		col *= 1.0 - gLine(du, 0.0009) * 0.1;
		if (fab == 5 || fab == 6 || fab == 3) col = mix(col, thread, gStitch(du, 0.004, s, 0.0032, px) + gStitch(du, 0.0095, s, 0.0032, px));
		else if (fab == 2 || fab == 10 || fab == 11 || fab == 8) col = mix(col, thread, gStitch(du, 0.0035, s, 0.0028, px) * 0.8);
		// a tee's coverstitched hem
		if (cuff == 0) col = mix(col, thread, gStitch(sh, 0.013, uv.x, 0.0026, px) + gStitch(sh, 0.019, uv.x, 0.0026, px));
		// a shirt's placket running up from the cuff, and its little button
		if (cuff == 2 && sh < len + 0.09) {
			float dp = gAng(th - geo.w) * r;
			float pl = step(abs(dp), 0.009) * (1.0 - smoothstep(len + 0.085, len + 0.09, sh));
			col = mix(col, thread, (gStitch(dp, 0.008, sh, 0.003, px) + gStitch(dp, -0.008, sh, 0.003, px)) * (1.0 - step(len + 0.088, sh)));
			gBump += pl * 0.00025;
			float d = length(vec2(dp, sh - len - 0.05)), btn = 1.0 - smoothstep(0.0038, 0.0043, d);
			col = mix(col, mix(base, vec3(0.92, 0.9, 0.85), 0.75), btn); gBump += btn * 0.0004;
		}
		// the rib cuff's join: the sleeve gathered into it
		if (cuff == 1) col *= 1.0 - gLine(sh - len, 0.0015) * 0.25;
	} else if (part == 3) {
		// rolled: each fold shows the cloth's other face, paler and the print faint
		float u = clamp(sh - 1.0, 0.0, 1.0), k = floor(u * 3.0), f = fract(u * 3.0);
		vec3 inside = mix(col, vec3(dot(col, vec3(0.33))), 0.45) * 1.12;
		col = mod(k, 2.0) < 0.5 ? col : inside;
		col *= 1.0 - gLine(f, 0.12) * 0.35;
	} else if (part == 2) {
		col = (cuff == 1 && sh < len + 0.001 ? cuffC : col) * 0.62;
	}
	// worn: a grimy edge, crests rubbed pale, the odd mark, a little pilling
	float edgeW = 1.0 - smoothstep(0.0, 0.022, sh);
	col *= 1.0 - wear * 0.22 * edgeW * (0.6 + 0.4 * mix(0.5, gN(uv * 400.0), gFade(0.0025, px)));
	if (fab == 5 || fab == 3 || fab == 6 || fab == 8) col = mix(col, col * 1.35 + 0.03, wear * 0.55 * smoothstep(0.1, 0.5, fold));
	float stain = smoothstep(0.74, 0.8, gN(uv * 14.0 + lb.w * 3.0)) * mix(0.6, smoothstep(0.4, 0.9, gN(uv * 50.0)), gFade(0.02, px));
	col = mix(col, col * vec3(0.78, 0.72, 0.62), wear * 0.35 * stain);
	if (fab == 0 || fab == 1 || fab == 7 || fab == 9) col *= 1.0 + wear * 0.15 * step(0.985, gH21(floor(uv * 900.0))) * gFade(0.0022, px);
	// the creases in shade
	float crease = smoothstep(0.05, -0.45, fold);
	col *= 1.0 - 0.28 * crease; gSpec *= 1.0 - 0.6 * crease; gAO = 1.0 - 0.45 * crease;
	// the inside of the sleeve
	if (!front) { col *= mix(0.35, 0.85, smoothstep(0.06, 0.16, sh)); gSpec *= 0.3; }
	// fuzz on fleece and sweats, a sheen on nylon and suede-like softness elsewhere
	gSheen = fab == 7 || fab == 1 || fab == 11 || fab == 9 ? col * 0.35 : fab == 4 ? vec3(0.12) : fab == 0 ? col * 0.18 : fab == 5 ? vec3(0.05) : vec3(0.03);
	gSheenR = fab == 4 ? 0.32 : fab == 8 ? 0.4 : 0.85;
}
`;

// one material for every garment; each holds its own colours and the arms' numbers
export function garmentMaterial(spec, frames, { lite = false } = {}) {
	const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, sheen: lite ? 0 : 1, sheenRoughness: 0.8, sheenColor: 0xffffff, side: THREE.DoubleSide, specularIntensity: 0.6 });
	const U = {
		uArm: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uDown: { value: [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -1, 0)] },
		uGeo: { value: [new THREE.Vector4(0.23, 0, 0, 0), new THREE.Vector4(0.23, 0, 0, 0)] }, uAxis: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
		uLay: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, uLayB: { value: [0, 1, 2].map(() => new THREE.Vector4()) },
		uCol: { value: Array.from({ length: 15 }, () => new THREE.Color()) },
	};
	for (const side of ['L', 'R']) {
		const F = frames[side]; if (!F) continue;
		U.uGeo.value[F.sign].set(F.Lf, F.inner, F.seam, F.placket); U.uAxis.value[F.sign].copy(F.A);
	}
	for (const L of spec.layers) {
		const k = L.under ? 0 : L.slot;
		U.uLay.value[k].set(FAB[L.fab], PAT[L.pat], L.wear, L.stiff);
		U.uLayB.value[k].set(CUFF[L.cuff], L.length === 'rolled' ? 0 : CUFF_LEN[L.cuff], L.ride, L.seed);
		[L.col, L.acc, L.acc2, L.thread, L.cuffCol].forEach((c, i) => U.uCol.value[k * 5 + i].set(c));
	}
	if (spec.glove) {
		const G = spec.glove;
		U.uLay.value[2].set(4, 0, G.wear, 0.5); U.uLayB.value[2].set(6, 0, 0, 0);
		[G.col, G.palm, G.knuckle, G.knuckle, G.knuckle].forEach((c, i) => U.uCol.value[10 + i].set(c));
	}
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_HEAD)
			.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + VERT_NORMAL)
			.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_POS);
		sh.vertexShader = (lite ? '#define GAR_LITE\n' : '') + sh.vertexShader;
		sh.fragmentShader = (lite ? '#define GAR_LITE\n' : '') + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
			.replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 gc = vec3(1.0); garSurface(gc, gl_FrontFacing); diffuseColor.rgb *= gc; }')
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;')
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifndef GAR_LITE
{
	// the weave, stitches and ribs as a bump (heights in metres, so at their true size)
	vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
	vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
	float det = dot(sx, r1);
	vec2 dh = vec2(dFdx(gBump), dFdy(gBump));
	normal = normalize(abs(det) * normal - sign(det) * (dh.x * r1 + dh.y * r2));
	// the folds: their slope laid on the cloth's own directions round and along the arm
	vec2 st0 = dFdx(gUV), st1 = dFdy(gUV);
	vec3 T = r1 * st0.x + r2 * st1.x, B = r1 * st0.y + r2 * st1.y;
	if (abs(det) > 1e-20) normal = normalize(normal - (T * gFoldGrad.x + B * gFoldGrad.y) / det);
}
#endif`)
			.replace('#include <aomap_fragment>', `#include <aomap_fragment>
// the cloth's own shade in its creases, for the sky's light and reflections
reflectedLight.indirectDiffuse *= 0.8 * gAO;
reflectedLight.indirectSpecular *= gAO * gAO;`)
			.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.specularColor *= gSpec;
material.specularF90 *= gSpec;
#ifdef USE_SHEEN
material.sheenColor = gSheen;
material.sheenRoughness = gSheenR;
#endif`);
	};
	m.customProgramCacheKey = () => 'bard-garment-3' + (lite ? '-lite' : '');
	return m;
}

// ---------- reading the arm's pose ----------
const T = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(), g: new THREE.Vector3(), m: new THREE.Matrix4(), n: new THREE.Matrix4(), q: new THREE.Matrix3() };
// The numbers the folds follow, for one arm: bend (0 straight .. 1 folded), twist (radians the
// hand is turned against the elbow's hinge, from rest), reach (0 .. 1 forward), and down (which
// way is down, in the forearm's frame at rest: along the arm, the palm's side, the other).
// Pure vector maths on the elbow, wrist, shoulder and palm where they are now.
export function armPose(F, elbow, wrist, shoulder, palm, forward, down, out = { bend: 0, twist: 0, reach: 0, down: new THREE.Vector3() }, rot = null) {
	const fe = T.a.subVectors(wrist, elbow), se = T.b.subVectors(shoulder, elbow);
	const lf = fe.length() || 1, ls = se.length() || 1;
	const cosA = Math.max(-1, Math.min(1, fe.dot(se) / (lf * ls))), ang = Math.acos(cosA);
	out.bend = Math.max(0, Math.min(1, (Math.PI - ang) / (Math.PI * 0.75)));
	// the hand's turn: the palm against the hinge's axis, round the forearm, less the same at rest
	const ax = T.c.copy(fe).divideScalar(lf), hinge = T.d.crossVectors(se, fe);
	const hs = hinge.length();
	const twistNow = (ax2, hinge2, palm2) => {
		const p = T.e.copy(palm2).addScaledVector(ax2, -palm2.dot(ax2)), h = T.f.copy(hinge2).addScaledVector(ax2, -hinge2.dot(ax2));
		return Math.atan2(T.g.crossVectors(h, p).dot(ax2), h.dot(p));
	};
	let tw = hs > 1e-6 ? twistNow(ax, hinge.divideScalar(hs), palm) : 0;
	if (F.restTwist == null) {
		const fa = new THREE.Vector3().subVectors(F.W, F.E), sa = new THREE.Vector3().subVectors(F.S, F.E), h2 = new THREE.Vector3().crossVectors(sa, fa).normalize();
		F.restTwist = twistNow(fa.normalize(), h2, F.palm);
	}
	tw = Math.atan2(Math.sin(tw - F.restTwist), Math.cos(tw - F.restTwist));
	out.twist = tw * Math.min(1, hs / (lf * ls) * 3);
	out.reach = Math.max(0, Math.min(1, ax.dot(forward) * 1.25 - 0.15));
	// down in the forearm's frame at rest (rot: the forearm's turn from rest to now)
	const dl = T.e.copy(down);
	if (rot) dl.applyMatrix3(T.q.copy(rot).transpose());
	dl.normalize();
	out.down.set(dl.dot(F.A), dl.dot(F.U), dl.dot(F.V));
	return out;
}

// ---------- dressing a pair of first-person arms ----------
// P: the body; skin: the hands' SkinnedMesh (its geometry in the body's bind space, its bones the
// body's by index). Builds the garment for the body's outfit, binds it to the same skeleton and
// leaves the skin it hides out of skin's index. Returns null when nothing covers the forearms
// (a tee, bare arms), else { mesh, tris, spec, pose(dt, aim, toBones, downCam), dispose() }.
// SHOULDER: where your shoulders are in the view's frame (metres; scaled to the body).
const SHOULDER = { L: new THREE.Vector3(-0.19, -0.23, 0.05), R: new THREE.Vector3(0.19, -0.23, 0.05) };
export function dressArms(P, skin, { sides = ['L', 'R'], isPhone = false, far = null, outfit = null } = {}) {
	const spec = sleeveSpec(outfit || P.outfit || P.dna?.style || {});
	if (spec.bare && !spec.glove) return null;
	const tier = qualityNow();
	const lite = isPhone || tier.name === 'low' || tier.name === 'minimal';
	const built = buildGarment(P, spec, skin.geometry, { sides, lite, far });
	if (!built.geometry) return null;
	// the skin under the cloth, left out of the hands' mesh
	if (built.hide.size) {
		const ix = skin.geometry.index.array, keep = [];
		for (let t = 0; t < ix.length; t += 3) if (!built.hide.has(t / 3)) keep.push(ix[t], ix[t + 1], ix[t + 2]);
		skin.geometry.setIndex(keep);
	}
	let material = garmentMaterial(spec, built.frames, { lite });
	const mesh = new THREE.SkinnedMesh(built.geometry, material);
	mesh.name = 'garment-arms'; mesh.bindMode = 'detached'; mesh.bind(skin.skeleton, new THREE.Matrix4()); mesh.frustumCulled = false;
	mesh.renderOrder = skin.renderOrder;
	// a step down the quality tiers: the cheaper shading (the cut stays as built)
	const offQ = onQuality((t) => {
		const l = isPhone || t.name === 'low' || t.name === 'minimal';
		if (l === material.userData.lite) return;
		const next = garmentMaterial(spec, built.frames, { lite: l }); next.userData.lite = l;
		material.dispose(); mesh.material = material = next;
	});
	material.userData.lite = lite;
	const scale = (P.height || 1.75) / 1.75, ride = spec.layers.length ? 1 : 0;
	const S = { L: { bend: 0, twist: 0, reach: 0, down: new THREE.Vector3() }, R: { bend: 0, twist: 0, reach: 0, down: new THREE.Vector3() } };
	const W = { e: new THREE.Vector3(), w: new THREE.Vector3(), s: new THREE.Vector3(), p: new THREE.Vector3(), f: new THREE.Vector3(), d: new THREE.Vector3(), m: new THREE.Matrix4(), r: new THREE.Matrix3(), inv: new THREE.Matrix4() };
	const bones = skin.skeleton.bones, inverses = skin.skeleton.boneInverses;
	// dt: seconds; aim: 0..1 to the sights; toBones: the view's frame to the bones' (null: the same);
	// downCam: which way is down in the view's frame
	function pose(dt, aim = 0, toBones = null, downCam = null) {
		const U = material.userData.U, k = Math.min(1, dt * 9);
		for (const side of sides) {
			const F = built.frames[side]; if (!F) continue;
			const sk = W.m.multiplyMatrices(bones[F.iE].matrixWorld, inverses[F.iE]);
			W.e.copy(F.E).applyMatrix4(sk);
			W.w.copy(F.W).applyMatrix4(W.inv.multiplyMatrices(bones[F.iW].matrixWorld, inverses[F.iW]));
			W.p.copy(F.palm).transformDirection(W.inv);
			W.r.setFromMatrix4(sk);
			W.s.copy(SHOULDER[side]).multiplyScalar(scale); W.f.set(0, 0, -1); W.d.copy(downCam || W.d.set(0, -1, 0));
			if (toBones) { W.s.applyMatrix4(toBones); W.f.transformDirection(toBones); W.d.transformDirection(toBones); }
			const o = armPose(F, W.e, W.w, W.s, W.p, W.f, W.d, T.out || (T.out = { bend: 0, twist: 0, reach: 0, down: new THREE.Vector3() }), W.r);
			const s = S[side];
			s.bend += (o.bend - s.bend) * k; s.twist += (o.twist - s.twist) * k; s.reach += (o.reach - s.reach) * k; s.down.lerp(o.down, k);
			const rideK = Math.min(1, aim * 0.85 + s.reach * 0.45) * ride;
			U.uArm.value[F.sign].set(s.bend, s.twist, s.reach, rideK); U.uDown.value[F.sign].copy(s.down);
		}
	}
	return {
		mesh, spec, frames: built.frames, pose,
		get tris() { return built.geometry.index.count / 3; },
		dispose() { offQ(); built.geometry.dispose(); material.dispose(); mesh.removeFromParent(); },
	};
}
