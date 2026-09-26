// The rainbow, from the physics. For each wavelength of sunlight and each size of
// raindrop, the light leaving a drop after one internal reflection (the primary bow) or
// two (the secondary) is worked out with Airy's theory: near the angle of minimum
// deviation the outgoing wavefront is a cubic, and its interference gives the intensity
// Ai(-z)^2 against angle: the bright bow, the supernumerary fringes on its lit side and
// the fast fade on its dark side (so the sky between the two bows, Alexander's dark
// band, gets almost nothing). Fresnel's laws take their share at each surface
// (unpolarised, so the secondary, with one more reflection, is fainter and wider);
// water's refractive index changes with wavelength, which spreads the colours; the
// sun's disc (half a degree) blurs it all; and the spectrum is turned into colour with
// the CIE 1931 observer. Drop size matters: small drops (drizzle) give pale bows with
// clear supernumeraries, big drops (a heavy shower) vivid narrow ones.
//
// The result is a lookup table: angle from the antisolar point (25-60 degrees) across,
// drop size down; the sky shader adds it (light, not paint) where there is sunlit rain.

import * as THREE from 'three';

// the secondary looks fainter than a single Airy integral makes it (seen against the
// brighter sky outside it, its light spread over a wider, partly polarised band):
// weighted to about a fifth of the primary
const SECONDARY = 0.42;
export const BOW = { a0: 25, a1: 60, W: 1024, drops: [0.12, 0.25, 0.5, 1.0] };   // degrees; drop radii in mm, one row each

// Airy's function Ai(x): the power series near zero, the asymptotic forms beyond
function airy(x) {
	if (x > 5) { const z = (2 / 3) * Math.pow(x, 1.5); return Math.exp(-z) / (2 * Math.sqrt(Math.PI) * Math.pow(x, 0.25)) * (1 - 5 / (72 * z)); }
	if (x < -7) {
		const t = -x, z = (2 / 3) * Math.pow(t, 1.5), p = z + Math.PI / 4;
		return (Math.sin(p) - (5 / (72 * z)) * Math.cos(p)) / (Math.sqrt(Math.PI) * Math.pow(t, 0.25));
	}
	const c1 = 0.355028053887817, c2 = 0.258819403792807;
	let f = 1, g = x, tf = 1, tg = x;
	const x3 = x * x * x;
	for (let k = 1; k < 60; k++) {
		tf *= x3 / ((3 * k - 1) * (3 * k));
		tg *= x3 / ((3 * k) * (3 * k + 1));
		f += tf; g += tg;
		if (Math.abs(tf) + Math.abs(tg) < 1e-17 * (Math.abs(f) + Math.abs(g))) break;
	}
	return c1 * f - c2 * g;
}
// Ai(-z)^2 on a table (z from -8 on the dark side to 40 on the lit side), with the
// fringes' mean beyond it, where they are finer than anything can show
const AZ0 = -8, AZ1 = 40, AN = 24000;
let aiTab = null;
function ai2(z) {
	if (!aiTab) { aiTab = new Float64Array(AN + 1); for (let i = 0; i <= AN; i++) { const a = airy(-(AZ0 + (AZ1 - AZ0) * i / AN)); aiTab[i] = a * a; } }
	if (z <= AZ0) return 0;
	if (z >= AZ1) return 1 / (2 * Math.PI * Math.sqrt(z));
	const f = (z - AZ0) / (AZ1 - AZ0) * AN, i = Math.floor(f), t = f - i;
	return aiTab[i] * (1 - t) + aiTab[Math.min(AN, i + 1)] * t;
}

// water's refractive index at wavelength L (nm), 20 C
const nWater = (L) => 1.3199 + 6878 / (L * L) - 1.132e9 / Math.pow(L, 4) + 1.11e14 / Math.pow(L, 6);
// CIE 1931 colour matching functions (Wyman, Sloan and Shirley's fit)
const gg = (L, m, s1, s2) => { const t = (L - m) / (L < m ? s1 : s2); return Math.exp(-0.5 * t * t); };
const cmf = (L) => [
	1.056 * gg(L, 599.8, 37.9, 31.0) + 0.362 * gg(L, 442.0, 16.0, 26.7) - 0.065 * gg(L, 501.1, 20.4, 26.2),
	0.821 * gg(L, 568.8, 46.9, 40.5) + 0.286 * gg(L, 530.9, 16.3, 31.1),
	1.217 * gg(L, 437.0, 11.8, 36.0) + 0.681 * gg(L, 459.0, 26.0, 13.8),
];
// sunlight: a black body at 5778 K
const planck = (L) => { const l = L * 1e-9; return 1 / (Math.pow(l, 5) * (Math.exp(0.014388 / (l * 5778)) - 1)); };
const xyz2rgb = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];

// the geometry of the rainbow ray for order k at index n: angle from the antisolar point
// (degrees, the primary's measured inward, the secondary's outward), and the curvature
// of deviation against impact parameter that sets the Airy scale; Fresnel's share
function rayOf(n, k) {
	const ci = Math.sqrt((n * n - 1) / (k * (k + 2))), i = Math.acos(ci), s0 = Math.sin(i);
	const D = (s) => 2 * (Math.asin(s) - Math.asin(s / n)) + k * (Math.PI - 2 * Math.asin(s / n));
	const h = 1e-4, D2 = (D(s0 + h) - 2 * D(s0) + D(s0 - h)) / (h * h);
	const dev = D(s0);
	const theta = k === 1 ? Math.PI - dev : dev - Math.PI;
	// Fresnel, s and p, at the entry angle (the internal angle's reflectance is the same)
	const r = Math.asin(s0 / n), cr = Math.cos(r);
	const Rs = Math.pow((ci - n * cr) / (ci + n * cr), 2), Rp = Math.pow((cr - n * ci) / (cr + n * ci), 2);
	const F = (Math.pow(1 - Rs, 2) * Math.pow(Rs, k) + Math.pow(1 - Rp, 2) * Math.pow(Rp, k)) / 2;
	return { theta: theta * 180 / Math.PI, D2: Math.abs(D2), F };
}

// the table, rows by drop size, as linear RGB (white sunlight = 1, 1, 1 per unit)
export function bowTable() {
	const { a0, a1, W, drops } = BOW;
	const LS = [];
	for (let L = 380; L <= 720; L += 5) LS.push(L);
	// white balance: sunlight itself comes out white
	const white = [0, 0, 0];
	for (const L of LS) { const c = cmf(L), p = planck(L); for (let j = 0; j < 3; j++) white[j] += c[j] * p; }
	const wRGB = xyz2rgb(white);
	const spec = LS.map((L) => ({ L, n: nWater(L), c: cmf(L), p: planck(L) }));
	for (const s of spec) { s.r1 = rayOf(s.n, 1); s.r2 = rayOf(s.n, 2); }
	const rows = [];
	const step = (a1 - a0) / W;
	// the sun's disc, 0.53 degrees across, limb-darkened, as a blur along the angle
	const disc = [];
	for (let k = -8; k <= 8; k++) { const x = k / 8; disc.push(Math.pow(Math.max(0, 1 - x * x), 0.5) * (0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - x * x)))); }
	const dsum = disc.reduce((p, q) => p + q, 0);
	for (const a of drops) {
		// a spread of sizes round each (a real shower is never one size)
		const sizes = [0.7, 0.85, 1, 1.18, 1.4].map((f, i) => [a * f, [0.5, 0.9, 1, 0.9, 0.5][i]]);
		const xyz = new Float64Array(W * 3);
		for (let bi = 0; bi < W; bi++) {
			for (let sub = 0; sub < 3; sub++) {
				const th = a0 + (bi + (sub + 0.5) / 3) * step;
				for (const s of spec) {
					let I = 0;
					for (const [am, wgt] of sizes) {
						const aM = am * 1e-3, lam = s.L * 1e-9, k = 2 * Math.PI / lam;
						for (const [ray, sign, gain] of [[s.r1, 1, 1], [s.r2, -1, SECONDARY]]) {
							const phi = sign * (ray.theta - th) * Math.PI / 180;             // toward the lit side: positive
							const z = phi * Math.pow(k, 2 / 3) * Math.pow(2 * aM * aM / ray.D2, 1 / 3);
							I += gain * wgt * ray.F * ai2(z) * Math.pow(aM / 1e-3, 7 / 3) * Math.pow(s.L / 550, -1 / 3);
						}
					}
					const e = I * s.p;
					for (let j = 0; j < 3; j++) xyz[bi * 3 + j] += s.c[j] * e / 3;
				}
			}
		}
		// the disc blur
		const blur = new Float64Array(W * 3), sr = 0.265 / step / 8;
		for (let bi = 0; bi < W; bi++) for (let q = 0; q < disc.length; q++) {
			const bj = Math.min(W - 1, Math.max(0, Math.round(bi + (q - 8) * sr)));
			for (let j = 0; j < 3; j++) blur[bi * 3 + j] += xyz[bj * 3 + j] * disc[q] / dsum;
		}
		const rgb = new Float32Array(W * 3);
		let peak = 0;
		for (let bi = 0; bi < W; bi++) {
			const c = xyz2rgb([blur[bi * 3], blur[bi * 3 + 1], blur[bi * 3 + 2]]);
			for (let j = 0; j < 3; j++) rgb[bi * 3 + j] = Math.max(0, c[j] / wRGB[j]);
			peak = Math.max(peak, blur[bi * 3 + 1]);
		}
		// scaled so the primary's peak brightness is 1 whatever the drop size (the shader
		// sets the bow's real strength from the rain and the sun)
		const Ypeak = peak / (white[1] / 1);
		for (let i = 0; i < rgb.length; i++) rgb[i] /= Ypeak * 1;
		rows.push(rgb);
	}
	return rows;
}

// the baked table (tools/bake-rainbow.mjs), loaded; computing it takes seconds
export function loadBowTexture() {
	const t = new THREE.TextureLoader().load(new URL('../assets/rainbow.png', import.meta.url).href);
	t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
	t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.NoColorSpace;
	return t;
}

// as a texture: sqrt-encoded bytes (more steps where the light is faint), rows by drop size
export function bowTexture() {
	const rows = bowTable(), { W } = BOW, H = rows.length;
	let mx = 0;
	for (const r of rows) for (const v of r) mx = Math.max(mx, v);
	const d = new Uint8Array(W * H * 4);
	rows.forEach((r, y) => { for (let x = 0; x < W; x++) for (let j = 0; j < 3; j++) d[(y * W + x) * 4 + j] = Math.round(Math.sqrt(r[x * 3 + j] / mx) * 255); d.fill(255, (y * W) * 4 + 3, (y * W) * 4 + 4); });
	for (let i = 3; i < d.length; i += 4) d[i] = 255;
	const t = new THREE.DataTexture(d, W, H);
	t.magFilter = t.minFilter = THREE.LinearFilter;
	t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
	t.needsUpdate = true;
	t.userData.scale = mx;
	return t;
}
