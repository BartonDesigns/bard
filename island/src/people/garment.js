// The clothes on a body (body.js): every garment a person wears is cut from the body's own
// cloth cage into one skinned mesh, each triangle knowing which garment it belongs to (the
// top, the layer over it, the bottoms, the shoes), and painted by one shader: the colours,
// the cloth (knit, twill, denim, nylon, fleece), and the pattern (stripes, plaid, colour
// blocks, a print on the chest, a team's number on the back), with the seams, hems and
// pockets drawn in. Silhouettes come from how far each garment stands off the body:
// fitted or oversized, straight, wide or baggy legs, a skirt's flare, a puffer's loft.
// The small things (caps, beanies, glasses, headphones, bags, a hood) are one more
// mesh, each piece riding the bone it sits on. One cloth mesh and one accessory mesh a
// person keeps the draw calls down, and every program is shared.

import * as THREE from 'three';
import { CLOTH_CAPS, clothUniforms, CLOTH_CONTACT_GLSL } from './cloth-collide.js';
import { drapePanels, refineGarmentSurface, finishGarmentEdges, sleeveDistance, armhole } from './garment-tailoring.js';
import { sleeveEase, waistbandEase, armT, isRibbed, isShirted, SLEEVE_POSE_GLSL } from './garment-shape.js';
import { torsoField, clothPoints, necklineRing, hoodGeometry, collarGeometry, carrierGeometry, bootGeometry, beltGeometry, cargoPocketGeometry } from './garment-kit.js';
import { patchKit } from './propkit.js';
import { tierNow } from '../world/governor.js';

// (phone audit: a phone, or a low quality tier, keeps the clothes' own surface: the curved split
// that rounds the shoulders by up to 4 mm is for the folds, which a phone draws none of, and it
// quadrupled every body's upper garments and much of the garbage made as people stream in)
const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const refineCloth = (phone = PHONE, tier = tierNow()) => !phone && tier < 2;

// ---------- the painting ----------
// pattern ids (the shader's)
export const PAT = { plain: 0, hivis: 29, tech: 30, stripe: 1, breton: 1, pinstripe: 2, plaid: 3, check: 4, block: 5, graphic: 6, band: 7, ringer: 8, quilt: 9, fleece: 10, fleeceblock: 11, rib: 12, denim: 13, chambray: 14, cargo: 15, track: 16, jersey: 17, dots: 18, dye: 19, oxford: 20, hem: 21, mail: 22, hazmat: 23, heat: 24, pleat: 25, hoops: 26, sash: 27, camo: 28 };
// cloth: 0 knit, 1 twill, 2 canvas, 3 nylon, 4 fleece, 5 leather, 6 metal, 7 a cooling
// undergarment's knit with its tubing, 8 beta cloth (a space suit's outer layer)
const FAB = { knit: 0, twill: 1, canvas: 2, nylon: 3, fleece: 4, leather: 5, metal: 6, tech: 3, linen: 2, wool: 2, lcvg: 7, beta: 8 };

const GLSL_HEAD = /* glsl */`
uniform vec3 uCol[16];
uniform vec4 uPat[4];
uniform vec4 uCutA;
uniform vec4 uCutB;
uniform vec4 uMisc;
uniform vec4 uHem;
uniform vec4 uNeck;
uniform vec4 uEdge;
uniform vec4 uKind;
uniform vec4 uArm[6];
uniform sampler2D uKnit;
uniform sampler2D uCanvas;
varying vec3 vBind;
varying vec3 vBN;
varying float vTrim;
varying float vCuff;
varying vec2 vFold;
varying float vSleeveT;
flat varying float vSlot;
flat varying float vLimb;
float gRough = 0.9, gMetal = 0.0, gFab = 0.0, gNorm = 0.35, gCollar = 0.0, gWeave = 0.0, gDetail = 0.0, gRefl = 0.0, gGlow = 0.0;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float band(float x, float a, float b, float s) { return smoothstep(a - s, a, x) * (1.0 - smoothstep(b, b + s, x)); }
float line(float x, float w) { return 1.0 - smoothstep(0.0, w, abs(x)); }
// the angle round the arm (for folds, ribs and a cuff's button), about its rest axis: the
// upper arm's above the elbow, the forearm's below, turning between them about the elbow
// (uArm: each side's elbow, upper arm and forearm directions)
float armAngle(vec3 P) {
	int o = P.x >= 0.0 ? 0 : 3;
	vec3 e = uArm[o].xyz, d = normalize(mix(uArm[o + 1].xyz, uArm[o + 2].xyz, smoothstep(0.85, 1.15, vSleeveT)));
	vec3 r = P - e; r -= d * dot(r, d);
	vec3 b1 = normalize(cross(d, vec3(0.0, 0.0, 1.0))), b2 = cross(d, b1);
	return atan(dot(r, b2), dot(r, b1));
}
// a crease's profile: a rounded crest, broad sides (from a sine)
float soft(float s) { float c = 1.0 - sqrt(s * s + 0.04); return c * c; }
// folds: compression folds round the elbows, the backs of the knees and the waist,
// fabric stacked at the ankles, and a slow drape all over (a height, for the bump)
float folds(vec3 P, float limb, int s) {
	float h = (vn(P.xy * 9.0 + P.z * 5.0) - 0.5) * 0.15;
	float wob = vn(vec2(atan(P.x, P.z) * 3.0, P.y * 20.0)) * 1.4;
	float az = atan(P.x, P.z);
	// (a sleeve's creases follow the arm, deeper where the elbow is bent or the arm raised: vFold;
	// and the spare length stacked above a long sleeve's cuff)
	if (limb > 0.5 && limb < 1.5 && vSleeveT > -0.5) {
		float t = vSleeveT;
		h += sin(t * 95.0 + wob * 5.0 + sin(az * 2.0) * 2.0) * (1.5 * exp(-pow((t - 1.0) / 0.12, 2.0)) + 9.0 * vFold.x);
		// the hang: long soft folds down the sleeve and the odd diagonal drag line, fading
		// toward the armhole
		float an = armAngle(P);
		h += (soft(sin(an * 2.0 + t * 1.3 + wob * 0.8)) * 16.0 + soft(sin(an * 3.5 - t * 4.5 + wob)) * 5.0) * smoothstep(0.1, 0.5, t);
		// drag lines spiralling off a bent elbow, up the upper arm and down the forearm
		h += sin(an * 2.0 + abs(t - 1.0) * 26.0 + wob * 3.0) * 10.0 * vFold.y * exp(-pow((t - 1.0) / 0.45, 2.0)) * smoothstep(0.03, 0.15, abs(t - 1.0));
		h += sin(t * 130.0 + wob * 6.0 + armAngle(P) * 1.5) * 1.6 * exp(-pow((vCuff - 0.085) / 0.04, 2.0)) * step(1.5, t);
	}
	else if (limb > 0.5 && limb < 1.5) h += sin(P.y * 300.0 + wob * 5.0 + sin(az * 2.0) * 2.0) * (1.0 - smoothstep(0.015, 0.06, abs(P.y - uCutB.z))) * 0.55;
	if (limb > 1.5) {
		h += sin(P.y * 280.0 + wob * 5.0 + sin(az * 3.0) * 2.5) * (1.0 - smoothstep(0.015, 0.06, abs(P.y - uCutB.x))) * 0.45;
		h += sin(P.y * 240.0 + wob * 6.0) * (1.0 - smoothstep(0.0, 0.09, P.y - uCutB.y - 0.01)) * 0.6 * step(2.0, float(s));
	}
	if (limb < 0.5 && s < 2) h += sin(P.y * 220.0 + wob * 5.0 + az * 3.0) * (1.0 - smoothstep(0.015, 0.06, abs(P.y - uCutA.z - 0.03))) * 0.35;
	return h;
}
// seven segments: a number on a shirt
float seg(vec2 q, int d) {
	int m = d == 0 ? 63 : d == 1 ? 6 : d == 2 ? 91 : d == 3 ? 79 : d == 4 ? 102 : d == 5 ? 109 : d == 6 ? 125 : d == 7 ? 7 : d == 8 ? 127 : 111;
	float t = 0.24, o = 0.0;
	if ((m & 1) != 0) o = max(o, band(q.x, t, 1.0 - t, 0.02) * band(q.y, 2.0 - t, 2.0, 0.02));
	if ((m & 2) != 0) o = max(o, band(q.x, 1.0 - t, 1.0, 0.02) * band(q.y, 1.0, 2.0, 0.02));
	if ((m & 4) != 0) o = max(o, band(q.x, 1.0 - t, 1.0, 0.02) * band(q.y, 0.0, 1.0, 0.02));
	if ((m & 8) != 0) o = max(o, band(q.x, t, 1.0 - t, 0.02) * band(q.y, 0.0, t, 0.02));
	if ((m & 16) != 0) o = max(o, band(q.x, 0.0, t, 0.02) * band(q.y, 0.0, 1.0, 0.02));
	if ((m & 32) != 0) o = max(o, band(q.x, 0.0, t, 0.02) * band(q.y, 1.0, 2.0, 0.02));
	if ((m & 64) != 0) o = max(o, band(q.x, t, 1.0 - t, 0.02) * band(q.y, 1.0 - t * 0.5, 1.0 + t * 0.5, 0.02));
	return o;
}
// a number (1..99) in a box: w wide, from the bottom-left corner
float number(vec2 q, float n, float w) {
	int tens = int(n) / 10, ones = int(n) - tens * 10;
	float h = w * (tens > 0 ? 0.9 : 1.0);
	if (tens > 0) {
		vec2 a = q / vec2(w * 0.45, h * 0.5), b = (q - vec2(w * 0.55, 0.0)) / vec2(w * 0.45, h * 0.5);
		float o = 0.0;
		if (a.x > 0.0 && a.x < 1.0 && a.y > 0.0 && a.y < 2.0) o = seg(a, tens);
		if (b.x > 0.0 && b.x < 1.0 && b.y > 0.0 && b.y < 2.0) o = max(o, seg(b, ones));
		return o;
	}
	vec2 c = (q - vec2(w * 0.2, 0.0)) / vec2(w * 0.6, h * 0.5);
	return c.x > 0.0 && c.x < 1.0 && c.y > 0.0 && c.y < 2.0 ? seg(c, ones) : 0.0;
}
// a print on the chest: shapes and colour, no words and nothing borrowed
vec3 print(vec3 base, vec3 a, vec3 b, vec2 g, float kind, float fade) {
	float r = length(g), an = atan(g.y, g.x), m = 0.0;
	vec3 c = a;
	int k = int(kind);
	if (k == 0) { m = 1.0 - smoothstep(0.42, 0.45, r); float ray = step(0.55, r) * (1.0 - step(0.8, r)) * step(0.5, fract(an * 1.9099)); if (ray > 0.5) { m = 1.0; c = b; } }
	else if (k == 1) { for (int i = 0; i < 3; i++) { float y = g.y + 0.35 - float(i) * 0.35 - sin(g.x * 7.0) * 0.08; if (abs(y) < 0.07 && abs(g.x) < 0.8) { m = 1.0; c = i == 1 ? b : a; } } }
	else if (k == 2) { if (g.y > -0.5 && g.y < 0.25 - abs(g.x + 0.25) * 1.3) { m = 1.0; c = a; } if (g.y > -0.5 && g.y < 0.05 - abs(g.x - 0.35) * 1.2) { m = 1.0; c = b; } if (length(g - vec2(0.35, 0.5)) < 0.2) { m = 1.0; c = mix(a, vec3(1.0, 0.85, 0.4), 0.6); } }
	else if (k == 3) { float pet = 0.35 + 0.22 * cos(an * 6.0); if (r < pet) { m = 1.0; c = r < 0.18 ? b : a; } }
	else if (k == 4) { for (int i = 0; i < 3; i++) { float rr = 0.75 - float(i) * 0.18; if (g.y > -0.2 && abs(r - rr) < 0.08) { m = 1.0; c = i == 0 ? a : i == 1 ? b : mix(a, b, 0.5); } } }
	else if (k == 5) { float st = 0.28 + 0.2 * smoothstep(-1.0, 1.0, cos(an * 5.0 + 1.571)); if (r < st + 0.08) { m = 1.0; c = a; } }
	else if (k == 6) { for (int i = 0; i < 4; i++) { float y = 0.45 - float(i) * 0.3; float w = i == 0 ? 0.75 : 0.35 + h21(vec2(float(i), 3.0)) * 0.4; if (abs(g.y - y) < 0.09 && abs(g.x) < w) { m = 1.0; c = i == 0 ? b : a; } } }
	else if (k == 7) { vec2 hq = vec2(abs(g.x), g.y); float hh = length(hq - vec2(0.25, 0.18)) - 0.3; float tri = hq.y + hq.x * 1.1 + 0.25; if (hh < 0.0 || (tri > 0.0 && g.y < 0.18 && g.y > -0.75 && hq.x < (g.y + 0.75) * 0.95)) { m = 1.0; c = a; } }
	else { float ec = abs(r - 0.55); if (ec < 0.1) { m = 1.0; c = a; } if (r < 0.34) { m = 1.0; c = b; } if (abs(g.y + 0.05) < 0.05 && abs(g.x) < 0.9) { m = 1.0; c = a; } }
	// a little worn: screen print on cotton
	m *= 1.0 - fade * smoothstep(0.35, 0.8, vn(g * 9.0 + 3.1));
	return mix(base, c, m);
}

// the weave up close, at the cloth's real scale: a height for the bump (x) and a tone for
// the colour (y). The threads fade out once a pixel covers more than one or two of them (px:
// metres a pixel spans); the coarser slubs, pile and grain carry further.
vec2 weave(int fab, vec3 P, vec3 N, float px) {
	vec2 q = abs(N.x) > abs(N.z) ? P.zy : P.xy;
	float h = 0.0, fine = 0.0, coarse = 0.0, f = 0.003;
	if (fab == 1) {
		// denim: twill diagonals about 2.5 mm apart, slubs along the weft
		h = sin((q.x + q.y) * 2513.0); f = 0.0025;
		fine = h * 0.07; coarse = (vn(vec2(q.x * 70.0, q.y * 900.0)) - 0.5) * 0.22 + (vn(q * 9.0) - 0.5) * 0.12;
	} else if (fab == 0 || fab == 7) {
		// jersey: columns of V-shaped loops about 3 mm
		vec2 k = q * vec2(330.0, 380.0); float v = abs(fract(k.x) - 0.5) * 2.0;
		h = sin((k.y + v * 0.8) * 6.2832) * (1.0 - v * 0.6); f = 0.003;
		fine = h * 0.06; coarse = (vn(q * 40.0) - 0.5) * 0.08;
		// a cooling undergarment's tubing, a channel every 2.5 cm
		if (fab == 7) { float tube = line(fract(q.x * 40.0) - 0.5, 0.09); h += tube * 2.5; coarse += tube * 0.14 - 0.03; }
	} else if (fab == 2 || fab == 8) {
		// canvas and cotton: a plain weave; beta cloth finer and glassier
		vec2 w = q * (fab == 8 ? 520.0 : 280.0); h = sin(w.x * 6.2832) * sin(w.y * 6.2832); f = fab == 8 ? 0.0019 : 0.0036;
		fine = h * 0.06; coarse = (vn(q * 30.0) - 0.5) * (fab == 8 ? 0.05 : 0.12);
	} else if (fab == 4) {
		// fleece: a soft pile
		h = vn(q * 900.0) * 2.0 - 1.0; f = 0.0011; fine = h * 0.05; coarse = (vn(q * 120.0) - 0.5) * 0.16;
	} else if (fab == 3) {
		// nylon ripstop: a grid every 6 mm
		vec2 g = fract(q * 160.0); h = max(line(g.x - 0.5, 0.07), line(g.y - 0.5, 0.07)); f = 0.006; fine = h * 0.07; coarse = (vn(q * 20.0) - 0.5) * 0.05;
	} else if (fab == 5) {
		// leather: a pebbled grain and long creases
		h = vn(q * 700.0) * 2.0 - 1.0 + (vn(q * vec2(40.0, 8.0)) - 0.5) * 1.5; f = 0.0015; fine = h * 0.05; coarse = (vn(q * 60.0) - 0.5) * 0.2;
	} else return vec2(0.0);
	float near = 1.0 - smoothstep(f * 0.3, f * 1.1, px), far = 1.0 - smoothstep(0.01, 0.05, px);
	return vec2(h * near, (fine * 0.65 * near + coarse * 0.6 * far));
}
// the colour of garment slot s at this point of the body (bind pose, metres)
vec3 garment(int s, vec3 P, vec3 N) {
	vec4 pat = uPat[s];
	int k = int(pat.x + 0.5);
	vec3 base = uCol[s * 4], a = uCol[s * 4 + 1], b = uCol[s * 4 + 2], x = uCol[s * 4 + 3];
	float neck = uCutA.x, chest = uCutA.y, waist = uCutA.z, hip = uCutA.w, knee = uCutB.x, ankle = uCutB.y;
	gFab = pat.w;
	int fab = int(gFab + 0.5);
	gRough = fab == 0 ? 0.92 : fab == 1 ? 0.88 : fab == 2 ? 0.85 : fab == 3 ? 0.48 : fab == 4 ? 0.97 : fab == 5 ? 0.5 : fab == 7 ? 0.8 : fab == 8 ? 0.62 : 0.38;
	gMetal = fab == 6 ? 0.7 : 0.0;
	// flat across the front and back panels, round the side panels only at the very sides (where
	// a side seam would be): a planar coordinate for checks and plaid; a sleeve's wraps round the
	// arm and runs along it, as cloth cut for a sleeve does (no jumps or stretching round it)
	float hz = abs(N.x) > 0.88 ? P.z : P.x;
	vec2 pl = vec2(hz, P.y);
	if (vLimb > 0.5 && vLimb < 1.5 && vSleeveT > -0.5) pl = vec2(armAngle(P) * 0.048, vSleeveT * 0.29);
	// (the body's: round the body from the middle of the front, so the checks run on unbroken
	// round the sides, joined at the middle of the back, where a shirt has its seam)
	else if (vLimb < 0.5) pl = vec2(atan(P.x, P.z - uMisc.y) * 0.14, P.y);
	float side = 1.0 - smoothstep(0.0, 0.07, abs(N.z));
	float arm = step(0.5, vLimb) * (1.0 - step(1.5, vLimb));
	float front = step(uMisc.y, P.z);
	vec3 c = base;
	if (k == 1) c = mix(base, a, step(0.62, fract(P.y * pat.y)));
	else if (k == 2) c = mix(base, a, line(fract(hz * 30.0) - 0.5, 0.05) * 0.8);
	else if (k == 3 || k == 4) {
		float sx = step(0.5, fract(pl.x * pat.y)), sy = step(0.5, fract(pl.y * pat.y));
		if (k == 3) { c = mix(base, a, (sx + sy) * 0.42); c = mix(c, b, line(fract(pl.x * pat.y * 2.0 + 0.25) - 0.5, 0.04) * 0.7); c = mix(c, b, line(fract(pl.y * pat.y * 2.0 + 0.25) - 0.5, 0.04) * 0.7); }
		else c = mix(base, a, (sx + sy) * 0.33);
	}
	else if (k == 5) {
		// colour blocks: the sleeves in one, a yoke across the chest in another
		if (step(uEdge.y + 0.01, abs(P.x)) > 0.5) c = a;
		else if (P.y > chest + 0.03) c = b;
		if (s == 2) c = P.x > 0.0 ? base : a;
	}
	else if (k == 6 || k == 7) {
		if (front > 0.5 && arm < 0.5) {
			float sc = k == 7 ? 0.12 : 0.085;
			c = print(base, a, b, vec2(P.x, P.y - chest + (k == 7 ? 0.06 : 0.02)) / sc, k == 7 ? 7.0 + mod(uMisc.z, 2.0) : uMisc.z, k == 7 ? 0.7 : 0.25);
		}
	}
	else if (k == 8) { if (P.y > neck - 0.035 || (arm > 0.5 && vCuff < 0.03)) c = a; }
	else if (k == 9) {
		// the baffles of a puffer: stitched lines and the loft between them
		float f = fract(P.y * 11.0);
		c = base * (0.82 + 0.22 * sin(f * 3.1416)) * (1.0 - line(f - 0.02, 0.04) * 0.35);
	}
	else if (k == 10 || k == 11) {
		c = base * (0.9 + 0.2 * vn(P.xy * 300.0 + P.z * 170.0));
		if (k == 11 && (P.y > chest + 0.02 || arm > 0.5 && P.y > chest - 0.05)) c = a * (0.9 + 0.2 * vn(P.xy * 300.0));
		if (k == 11 && front > 0.5 && P.x > 0.05 && P.x < 0.12 && P.y > chest - 0.05 && P.y < chest + 0.04 && arm < 0.5) c = mix(c, a, 0.8);
	}
	else if (k == 12) c = base * (0.86 + 0.14 * abs(sin(hz * 280.0)));
	else if (k == 13 || k == 14) {
		// denim: a twill of blue on white, faded on the thighs and the seat, darker in the creases
		float tw = sin((pl.x + pl.y) * 900.0) * 0.5 + 0.5, slub = vn(vec2(pl.x * 60.0, pl.y * 700.0));
		c = base * (0.86 + tw * 0.1 + slub * 0.1);
		if (k == 13 && s == 2) {
			float thigh = band(P.y, knee + 0.08, hip - 0.06, 0.08) * (P.z > 0.0 ? 1.0 : 0.6);
			c = mix(c, c * 1.55 + 0.05, thigh * 0.35 * vn(vec2(P.x * 20.0, P.y * 6.0)));
			c *= 1.0 - band(P.y, knee - 0.03, knee + 0.03, 0.03) * step(P.z, 0.0) * 0.25;
			// the waistband, the stitching down the side, the back pockets
			if (P.y > uHem.z - 0.035) c *= 0.85;
			c = mix(c, vec3(0.78, 0.5, 0.2), side * mix(line(fract(P.y * 330.0) - 0.5, 0.2), 0.3, smoothstep(0.15, 0.8, fwidth(P.y * 330.0))) * 0.35);
			vec2 pk = vec2(abs(P.x) - 0.075, P.y - (hip + 0.02));
			if (P.z < uMisc.w - 0.03 && abs(pk.x) < 0.045 && pk.y > -0.05 && pk.y < 0.06) { float e = min(0.045 - abs(pk.x), min(pk.y + 0.05, 0.06 - pk.y)); c = e < 0.006 ? mix(c, vec3(0.78, 0.5, 0.2), 0.7) : c * 0.94; }
		}
		if (k == 13 && s != 2) c = mix(c, vec3(0.78, 0.5, 0.2), side * 0.5);
	}
	else if (k == 15) {
		// cargo pockets on the outer thigh, with their flaps
		float outer = step(0.55, N.x * sign(P.x));
		float py = P.y - (knee + 0.05);
		if (outer > 0.5 && py > 0.0 && py < 0.2 && abs(P.z - uMisc.w) < 0.06) c = base * (py > 0.16 ? 0.8 : 0.93);
		c = mix(c, c * 0.7, side * 0.5);
	}
	else if (k == 30 && s == 2) {
		// tailored technical trousers (the cargo pockets and the belt are built: garment-kit.js):
		// the waistband and its stitching, the fly's J, slant pocket openings, the side seams
		// and the inseams, the knee shaped by two seams with a panel between, a yoke at the back
		// and back pockets. Mostly in the bump (gDetail), a little in the shade; the cloth a
		// little uneven over a hand's breadth, as heavy twill is
		float leg = step(1.5, vLimb), wtop = waist + 0.02, outer = step(0.0, N.x * sign(P.x));
		c *= 0.97 + 0.06 * vn(P.xy * 7.0 + P.zz * 3.0);
		float wb = band(P.y, wtop - 0.038, wtop, 0.002);
		c *= 1.0 - wb * 0.06;
		gDetail -= (line(P.y - (wtop - 0.038), 0.0018) + line(P.y - (wtop - 0.006), 0.0012)) * 0.9;
		gDetail += wb * 0.25;
		// the fly: a J of stitching right of the middle, down to the crotch
		float fx = 0.026 - 0.022 * smoothstep(hip + 0.02, hip - 0.04, P.y);
		gDetail -= line(P.x - fx, 0.0016) * step(0.3, N.z) * step(hip - 0.05, P.y) * step(P.y, wtop - 0.04) * 0.9;
		gDetail -= line(P.x, 0.0014) * step(0.3, N.z) * step(hip - 0.02, P.y) * step(P.y, wtop - 0.04) * 0.5;
		// slant pockets: an opening from the waistband down to the side
		float ax = abs(P.x), sl = P.y - (wtop - 0.04) + (ax - 0.085) * 1.7;
		float open = line(sl, 0.0028) * step(0.085, ax) * step(ax, 0.17) * step(0.15, N.z);
		c *= 1.0 - open * 0.25; gDetail -= open * 1.4;
		// the side seams and the inseams, down the legs and up to the waist
		float sideSeam = line(N.z, 0.05) * outer, inSeam = line(N.z, 0.05) * (1.0 - outer) * leg;
		gDetail -= sideSeam * 0.8 + inSeam * 0.5; c *= 1.0 - sideSeam * 0.04;
		// the knees: a seam above and below, curving round, the panel between a shade darker
		if (leg > 0.5 && N.z > 0.15) {
			float th = atan(N.x * sign(P.x), N.z), up = knee + 0.075 + 0.02 * cos(th * 1.6), dn = knee - 0.065 - 0.012 * cos(th * 1.6);
			gDetail -= (line(P.y - up, 0.0022) + line(P.y - dn, 0.0022)) * 0.9;
			c *= 1.0 - band(P.y, dn, up, 0.004) * 0.05;
			// (worn there, as the sheet's are: the knees darker and dulled where they have knelt,
			// unevenly, fading out round the sides)
			float wear = band(P.y, dn - 0.03, up + 0.01, 0.035) * smoothstep(0.15, 0.6, N.z) * (0.45 + 0.55 * vn(P.xy * 34.0 + P.zz * 11.0));
			c = mix(c, c * vec3(0.8, 0.77, 0.71), wear * 0.55);
			// (and a dart in from the side above the knee)
			gDetail -= line(P.y - (up + 0.05) + abs(N.x) * 0.06, 0.002) * step(0.6, abs(N.x)) * 0.6;
		}
		// zipped pockets slanting down the front of the thighs (flag bit 2): the zip's teeth, its
		// tape a shade darker, the cloth turned in along it, a pull at the top
		if (pat.z > 1.5 && leg > 0.5) {
			float th = atan(N.x * sign(P.x), N.z), zt = hip - 0.02, zb = hip - 0.19;
			float d = (th - mix(1.2, 0.55, clamp((zt - P.y) / (zt - zb), 0.0, 1.0))) * 0.085, on = step(zb, P.y) * step(P.y, zt);
			float z = line(d, 0.0032) * on;
			c = mix(c, c * 0.5, z * 0.75);
			gDetail += z * (0.5 + 0.5 * sin(P.y * 2400.0)) - line(abs(d) - 0.0045, 0.0012) * on * 0.7;
			float pull = 1.0 - smoothstep(0.0028, 0.0042, length(vec2(d - 0.003, P.y - zt + 0.012)));
			c = mix(c, vec3(0.22, 0.21, 0.2), pull); gDetail += pull * 1.2;
		}
		// the back: a yoke dipping to the middle, and two pockets below it
		if (N.z < -0.25) {
			gDetail -= line(P.y - (hip + 0.045 - 0.25 * max(0.0, 0.12 - ax)), 0.002) * 0.9;
			vec2 bp = vec2(ax - 0.095, P.y - (hip - 0.045));
			float e = min(0.05 - abs(bp.x), min(bp.y + 0.075, 0.055 - bp.y));
			if (e > -0.002) { gDetail -= line(e, 0.0018) * 0.9; gDetail += smoothstep(0.0, 0.004, e) * 0.25; gDetail -= line(bp.y - 0.04, 0.0015) * step(0.0, e) * 0.7; }
		}
	}
	else if (k == 16) {
		// a stripe down the side of the leg (or the sleeve)
		float st = s == 2 || arm > 0.5 ? (1.0 - smoothstep(0.1, 0.16, abs(N.z))) * step(0.0, N.x * sign(P.x)) : 0.0;
		c = mix(base, a, st);
	}
	else if (k == 17 || k == 26 || k == 27) {
		// a team's shirt: hoops or a sash, trim at the collar and cuffs, side panels, the number
		if (k == 26) c = mix(base, a, step(0.5, fract(P.y * 8.0)));
		if (k == 27 && abs(P.y - chest + P.x * 1.2) < 0.06) c = a;
		if (k == 17) c = mix(base, a, side * 0.9);
		if (P.y > neck - 0.03 || (arm > 0.5 && vCuff < 0.025)) c = b;
		if (uMisc.x > 0.5) {
			vec3 inkc = dot(c, vec3(0.3, 0.6, 0.1)) > 0.45 ? a * 0.35 : vec3(0.96);
			if (dot(inkc - c, inkc - c) < 0.05) inkc = b;
			float n = 0.0;
			if (front < 0.5) n = number(vec2(-P.x + 0.11, P.y - chest + 0.17), uMisc.x, 0.22);
			else if (arm < 0.5) n = number(vec2(P.x + 0.04, P.y - chest + 0.02), uMisc.x, 0.08);
			c = mix(c, inkc, n);
		}
	}
	else if (k == 18) { vec2 q = fract(pl * pat.y) - 0.5; c = mix(base, a, 1.0 - smoothstep(0.18, 0.22, length(q))); }
	else if (k == 19) {
		// tie-dye: a spiral of three colours out from the chest
		vec2 q = vec2(P.x, P.y - chest);
		float t = atan(q.y, q.x) / 6.2832 + length(q) * 6.0 + vn(q * 12.0) * 0.4;
		float f = fract(t * 3.0);
		c = f < 0.33 ? base : f < 0.66 ? a : b;
		c = mix(c, vec3(1.0), 0.12);
	}
	else if (k == 20) c = base * (0.92 + 0.08 * h21(floor(pl * 420.0)));
	else if (k == 21) { if ((P.y < uHem.x + 0.045 && P.y > uHem.x + 0.02) || (arm > 0.5 && vCuff < 0.04)) c = a; }
	else if (k == 22) {
		// mail: rows of rings
		vec2 q = vec2(pl.x * 140.0 + step(0.5, fract(pl.y * 70.0)) * 0.5, pl.y * 140.0);
		float ring = abs(length(fract(q) - 0.5) - 0.3);
		c = base * (0.55 + 0.6 * smoothstep(0.14, 0.02, ring));
		gMetal = 0.75; gRough = 0.42;
	}
	else if (k == 23) {
		// a hazmat suit: taped seams at the waist, wrists and ankles, a zip
		if (abs(P.y - waist) < 0.03 || (arm > 0.5 && vCuff < 0.05) || (s == 2 && P.y < ankle + 0.1) || (P.z > 0.0 && abs(P.x) < 0.012 && P.y > waist - 0.2)) c = a;
		c *= 0.92 + 0.08 * vn(P.xy * 40.0);
	}
	else if (k == 24) {
		// a heat suit: silvered, with reflective bands
		c = mix(base, vec3(0.9), 0.3 * (0.5 + 0.5 * sin(P.y * 40.0 + P.x * 10.0)));
		if (band(fract(P.y * 3.0), 0.45, 0.55, 0.02) > 0.5) c = a;
		gMetal = 0.6; gRough = 0.35;
	}
	else if (k == 25) c = base * (0.82 + 0.18 * abs(sin(atan(P.x, P.z) * 18.0)));
	else if (k == 28) {
		// camouflage: three layers of soft-edged blotches over the base, laid in the body's own metres
		float aa = 0.03;
		float n1 = vn(P.xy * 8.0 + vec2(P.z * 6.0, 1.7)) * 0.7 + vn(P.xy * 23.0 + P.z * 9.0) * 0.3;
		float n2 = vn(P.zy * 11.0 + vec2(3.1, P.x * 7.0)) * 0.75 + vn(P.xy * 31.0 + 5.0) * 0.25;
		float n3 = vn(P.xy * 17.0 + vec2(P.z * 13.0, 7.3));
		c = mix(base, a, smoothstep(0.55 - aa, 0.55 + aa, n1));
		c = mix(c, b, smoothstep(0.6 - aa, 0.6 + aa, n2));
		c = mix(c, base * 0.42, smoothstep(0.7 - aa, 0.7 + aa, n3));
		c *= 0.94 + 0.06 * vn(P.xy * 300.0);
	}
	else if (k == 29) {
		// hi-vis: fluorescent cloth with reflective tape, two bands round the body and braces
		// over the shoulders, front and back (a: the tape's silver)
		float y1 = waist + 0.05, y2 = waist + 0.19, w = 0.021;
		float tape = max(band(P.y, y1 - w, y1 + w, 0.002), band(P.y, y2 - w, y2 + w, 0.002));
		if (arm < 0.5 && P.y > y2) tape = max(tape, band(abs(P.x), 0.075 - w, 0.075 + w, 0.002));
		if (arm > 0.5) tape = band(vCuff, 0.05, 0.05 + 2.0 * w, 0.002) * step(1.5, vSleeveT);
		gGlow = 1.0 - tape;
		if (tape > 0.5) { c = a * (0.62 + 0.12 * h21(floor(P.xy * 900.0))); gRefl = 1.0; gRough = 0.35; }
		// (the tape's stitched edges)
		gDetail += tape * 0.4;
	}
	// the open front of a jacket or vest, and a zip down a closed one
	if (s == 1) {
		if (uPat[1].z < 0.5 && front > 0.5 && abs(P.x) < 0.006 && arm < 0.5) c = mix(c, a, 0.6);
		// a collar round the neck
		if (P.y > neck - 0.04 && k != 9) c *= 0.88;
	}
	// hems: a stitched line near the bottom of tops, a turned cuff on joggers
	if (s == 0 && abs(P.y - uHem.x - 0.018) < 0.003 && arm < 0.5) c *= 0.82;
	if (s == 2 && mod(uPat[2].z, 2.0) > 0.5 && P.y < uHem.w + 0.05) c *= 0.88 - 0.1 * abs(sin(atan(P.x, P.z) * 30.0));
	// shoes: soles, a toe cap, laces; socks above the shoe
	if (s == 3) {
		float fy = P.y;
		if (fy > ankle + 0.02) { c = x; gFab = 0.0; gRough = 0.95; }
		else {
			gRough = 0.6;
			if (fy < pat.y) c = a;
			else if (P.z > 0.08 && fy < pat.y + 0.035) c = mix(c, a, 0.4);
			if (N.y > 0.5 && fy > pat.y + 0.03) c = mix(c, b, 0.8);
			else if (abs(N.x) > 0.6 && fy > pat.y + 0.02 && fy < ankle - 0.02 && pat.z > 0.5) c = mix(c, b, 0.85);
		}
	}
	return c;
}
// The make of a top (uKind: x the top, y the layer over it; bits: 1 ribbed knit, 2 a woven
// shirt, 4 a hoodie, 8 a chest pocket, 16 a button placket, 32 a short placket): ribbed
// cuffs, waistband and neck; shirt cuffs with their seam and button, the placket and its
// buttons, a chest pocket, a hoodie's front pouch; the seams at the shoulder, the armhole and
// the sides. Colour in, colour out; the stitched edges go into gDetail for the bump.
vec3 tailor(int s, vec3 P, vec3 N, vec3 c, float px) {
	if (s > 1 || px > 0.012) return c;
	int f = int((s == 0 ? uKind.x : uKind.y) + 0.5);
	float arm = step(0.5, vLimb) * (1.0 - step(1.5, vLimb));
	float hem = s == 0 ? uHem.x : uEdge.x, neck = uCutA.x, chest = uCutA.y;
	float front = step(uMisc.y, P.z), aa = clamp(px * 900.0, 0.0, 1.0);
	float zc = uMisc.y;
	if ((f & 1) != 0) {
		// a knit's rib: fine ridges along the cuff, round the waistband and the neck
		float rib = 0.0;
		if (arm > 0.5 && vCuff < 0.06 && vSleeveT > 1.5) rib = sin(armAngle(P) * 44.0);
		else if (arm < 0.5 && P.y < hem + 0.06) rib = sin(atan(P.x, P.z - zc) * 150.0);
		else if (arm < 0.5 && P.y > neck - 0.025) rib = sin(atan(P.x, P.z - zc) * 110.0) * 0.7;
		rib *= 1.0 - aa;
		c *= 0.95 + 0.06 * rib;
		gDetail += rib * 0.5;
		// where the rib meets the body: a seam
		if (arm > 0.5 && vSleeveT > 1.5) gDetail -= line(vCuff - 0.06, 0.003) * 0.8;
		if (arm < 0.5) gDetail -= line(P.y - hem - 0.06, 0.003) * 0.8;
	}
	if ((f & 2) != 0 && arm > 0.5 && vSleeveT > 1.5) {
		// a shirt cuff: its band, the seam above it, a button on the outside of the wrist
		float seam = line(vCuff - 0.055, 0.0022);
		c *= 1.0 - seam * 0.25; gDetail -= seam * 0.9;
		float da = mod(armAngle(P) - (P.x >= 0.0 ? -0.6 : 0.6 - 3.1416) + 3.1416, 6.2832) - 3.1416, bx = da * 0.035, by = vCuff - 0.026;
		float bt = 1.0 - smoothstep(0.0035, 0.0048, length(vec2(bx, by)));
		c = mix(c, vec3(0.9, 0.88, 0.84), bt * 0.85); gDetail += bt * 1.2;
	}
	if (arm < 0.5 && front > 0.5 && (f & 48) != 0) {
		// the placket: two lines of stitching and the buttons down it
		float top = neck - 0.025, bot = (f & 32) != 0 ? chest - 0.08 : hem + 0.02;
		if (P.y < top && P.y > bot) {
			float st = line(abs(P.x) - 0.016, 0.0012);
			c *= 1.0 - st * 0.22; gDetail += st * 0.6 + band(abs(P.x), 0.0, 0.016, 0.002) * 0.25;
			float yb = mod(top - 0.02 - P.y, 0.085) - 0.0425;
			float bt = 1.0 - smoothstep(0.0042, 0.0056, length(vec2(P.x, yb)));
			c = mix(c, mix(c, vec3(0.92, 0.9, 0.86), 0.6), bt); gDetail += bt * 1.4;
		}
	}
	if ((f & 8) != 0 && arm < 0.5 && front > 0.5) {
		// a chest pocket on the left: its outline stitched, the cloth doubled (an overshirt's
		// higher and further out, clear of its open front, with a buttoned flap)
		vec2 q = s == 1 ? vec2(P.x - 0.108, P.y - chest - 0.025) : vec2(P.x - 0.085, P.y - chest + 0.015);
		float hw = s == 1 ? 0.045 : 0.05, bottom = -0.065 + max(0.0, 0.012 - abs(q.x) * 0.4);
		if (abs(q.x) < hw && q.y < 0.04 && q.y > bottom) {
			float e = min(hw - abs(q.x), min(0.04 - q.y, q.y - bottom));
			c *= 0.965 - line(e - 0.003, 0.001) * 0.18; gDetail += smoothstep(0.0, 0.004, e) * 0.5 - line(e - 0.003, 0.001) * 0.6;
			if (s == 1) {
				float fl = line(q.y - 0.012 + abs(q.x) * 0.12, 0.0016), bt = 1.0 - smoothstep(0.0036, 0.0048, length(vec2(q.x, q.y - 0.02)));
				c *= 1.0 - fl * 0.3; gDetail -= fl * 1.1;
				c = mix(c, vec3(0.17, 0.16, 0.15), bt * 0.9); gDetail += bt * 1.4;
			}
		}
	}
	if ((f & 2) != 0 && s == 1 && uPat[1].z > 0.5 && arm < 0.5 && front > 0.5) {
		// an open shirt's fronts: the placket down each edge and its stitching, the buttons down
		// the left, their holes down the right (the edge as the open front is cut, below)
		float e = abs(P.x) - 0.035 - max(0.0, chest - P.y) * 0.12;
		if (e < 0.03 && P.y < neck - 0.035 && P.y > hem + 0.015) {
			float st = line(e - 0.024, 0.0012);
			c *= 1.0 - st * 0.22; gDetail += st * 0.6 + band(e, 0.0, 0.024, 0.002) * 0.25;
			vec2 bq = vec2(e - 0.012, mod(neck - 0.06 - P.y, 0.085) - 0.0425);
			if (P.x > 0.0) { float bt = 1.0 - smoothstep(0.0042, 0.0056, length(bq)); c = mix(c, vec3(0.17, 0.16, 0.15), bt * 0.9); gDetail += bt * 1.4; }
			else { float hole = (1.0 - smoothstep(0.0009, 0.0016, abs(bq.y))) * step(abs(bq.x), 0.0065); c *= 1.0 - hole * 0.4; gDetail -= hole * 1.2; }
		}
	}
	if ((f & 4) != 0 && arm < 0.5 && front > 0.5) {
		// a hoodie's front pouch, its two slanted openings
		float y0 = hem + 0.07, y1 = hem + 0.22, wx = 0.15 - (P.y - y0) * 0.25;
		if (P.y > y0 && P.y < y1 && abs(P.x) < wx) {
			float side = wx - abs(P.x), e = min(side, min(P.y - y0, y1 - P.y));
			float open = line(side - (P.y - y0) * 0.35 - 0.005, 0.003) * step(0.03, P.y - y0);
			c *= 0.97 - open * 0.25; gDetail += smoothstep(0.0, 0.005, e) * 0.6 - line(e - 0.003, 0.0012) * 0.5 - open * 1.5;
		}
	}
	// seams: round the armhole, down the sides, over the shoulders
	if (arm > 0.5 && vSleeveT > -0.5) gDetail -= line(vSleeveT - 0.07, 0.012) * (1.0 - aa) * 0.9;
	if (arm < 0.5) {
		gDetail -= line(N.z, 0.05) * step(P.y, chest + 0.02) * 0.7 * (1.0 - aa);
		gDetail -= line(P.z - zc + 0.01, 0.0025) * smoothstep(0.4, 0.7, N.y) * 0.7;
	}
	return c;
}
`;

// the program is shared by every body; each body's material holds its own uniforms
export function garmentMaterial(A, o, cut, number = 0) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, normalMap: A.fabric.twill, normalScale: new THREE.Vector2(0.045, 0.045), side: THREE.DoubleSide });
	const U = {
		uCol: { value: Array.from({ length: 16 }, () => new THREE.Color()) },
		uPat: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
		uCutA: { value: new THREE.Vector4(cut.neck, cut.chest, cut.waist, cut.hip) },
		uCutB: { value: new THREE.Vector4(cut.knee, cut.ankle, cut.elbow, cut.wrist) },
		uMisc: { value: new THREE.Vector4(number, (cut.backZ + cut.frontZ) / 2, 0, (cut.hipZ[0] + cut.hipZ[1]) / 2) },
		uHem: { value: new THREE.Vector4(cut.waist, cut.wrist, cut.waist, cut.ankle) },
		uNeck: { value: new THREE.Vector4(cut.neck, cut.neck, 0, 0) },
		uEdge: { value: new THREE.Vector4(0, cut.shoulderX, 0, 0) },
		uClothMove: { value: new THREE.Vector4() },
		// the make of the top and the layer over it (tailor), each forearm's rest axis, and
		// how much the sleeves fold and hang with the pose (1 near, 0 far off or on a phone)
		uKind: { value: new THREE.Vector4() },
		uArm: { value: ['L', 'R'].flatMap((sd) => { const a = cut.arm?.[sd]; if (!a) return [new THREE.Vector4(), new THREE.Vector4(0, -1, 0, 0), new THREE.Vector4(0, -1, 0, 0)]; const s = new THREE.Vector3(...a.s), e = new THREE.Vector3(...a.e), w = new THREE.Vector3(...a.w), u = e.clone().sub(s).normalize(), f = w.clone().sub(e).normalize(); return [new THREE.Vector4(e.x, e.y, e.z, 0), new THREE.Vector4(u.x, u.y, u.z, 0), new THREE.Vector4(f.x, f.y, f.z, 0)]; }) },
		uPoseK: { value: new THREE.Vector4(1, 0, 0, 0) },
		...clothUniforms(),
		uKnit: { value: A.fabric.knit }, uCanvas: { value: A.fabric.canvas },
	};
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader
			.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n'+SLEEVE_POSE_GLSL+CLOTH_CONTACT_GLSL)
			.replace('#include <common>', `attribute float clothInset; uniform vec4 uClothA[${CLOTH_CAPS}]; uniform vec3 uClothB[${CLOTH_CAPS}];\n`+'#include <common>\nattribute float slot;\nattribute vec2 sleeve;\nuniform vec4 uPoseK;\nvarying vec2 vFold;\nvarying float vSleeveT;\nattribute float drape;\nattribute float trim;\nattribute float cuff;\nvarying float vCuff;\nvarying float vTrim;\nuniform vec4 uClothMove;\nvarying vec3 vBind;\nvarying vec3 vBN;\nflat varying float vSlot;\nflat varying float vLimb;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position; vBN = normal; vTrim = trim; vCuff = cuff; vSlot = mod(slot, 10.0); vLimb = floor(slot / 10.0 + 0.01); float flutter = sin(uClothMove.x * 2.8 + position.y * 15.0 + position.x * 8.0); transformed += normal * (1.0 + flutter) * drape * 0.002 * min(uClothMove.y, 2.0); transformed.x += sin(uClothMove.z * 6.283 + position.y * 4.0) * drape * 0.003 * min(uClothMove.y, 1.0);');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\n' + GLSL_HEAD)
			.replace('#include <color_fragment>', '#include <color_fragment>\n{ int s = int(vSlot + 0.5); vec3 N = normalize(vBN); float gPx = length(fwidth(vBind));\n\n if (vTrim < 0.1 && s == 0 && vLimb < 0.5 && vBind.y < uHem.x + 0.012) discard;\n if (vTrim < 0.1 && s == 2 && vLimb > 1.5 && uHem.w < 5.0 && vBind.y < uHem.w + 0.012) discard;\n float tail = (int(uKind.y + 0.5) & 2) != 0 ? 0.035 * smoothstep(0.08, 0.16, abs(vBind.x)) : 0.0;\n if (vTrim < 0.1 && s == 1 && vLimb < 0.5 && vBind.y < uEdge.x + tail + 0.012) discard;\n if (uEdge.z > 0.5 && s == 1 && (vLimb > 1.5 || (vLimb > 0.5 && vBind.y < uCutA.y - 0.03) || abs(vBind.x) > uEdge.y - 0.03 + max(0.0, uCutA.y - 0.07 - vBind.y) * 1.5)) discard;\n if ((s == 0 || s == 1) && vLimb < 0.5) { float fr = smoothstep(-0.04, -0.005, vBind.z); float ny = (s == 0 ? uNeck.x - uNeck.z * fr : uNeck.y) + 0.035 * smoothstep(0.0, 0.09, abs(vBind.x)) - 0.004 * fr; if (vTrim < 0.1 && vBind.y > ny) discard; gCollar = 1.0 - smoothstep(0.004, 0.011, ny - vBind.y); }\n if (s == 1 && uPat[1].z > 0.5 && vBind.z > uMisc.y && vBind.y > uCutA.z - 0.3) { float e = abs(vBind.x) - 0.035 - max(0.0, uCutA.y - vBind.y) * 0.12; if (e < 0.0) discard; gCollar = max(gCollar, 1.0 - smoothstep(0.003, 0.008, e)); }\n diffuseColor.rgb *= tailor(s, vBind, N, garment(s, vBind, N), gPx) * (1.0 - gCollar * 0.08 - vTrim * 0.045); vec2 wv = weave(int(gFab + 0.5), vBind, N, gPx); diffuseColor.rgb *= 1.0 + wv.y;\n // where one layer hangs over another: a soft shadow just under its hem, no hard seam\n float hd = s == 2 && vLimb < 1.5 ? uHem.x - vBind.y : s == 0 && uEdge.w > 0.5 ? uEdge.x + tail - vBind.y : -1.0; if (hd >= 0.0) diffuseColor.rgb *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.04, hd)); gRough = clamp(gRough - wv.y * 0.5, 0.2, 1.0); gWeave = wv.x; }')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = gRough; metalnessFactor = gMetal;')
			.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'int fb = int(gFab + 0.5);\n\tvec3 mapN = (fb == 0 || fb == 4 || fb == 7 ? texture2D( uKnit, vNormalMapUv ) : fb == 1 ? texture2D( normalMap, vNormalMapUv ) : texture2D( uCanvas, vNormalMapUv )).xyz * 2.0 - 1.0;\n\tmapN.xy *= fb == 3 || fb == 5 || fb == 6 ? 0.3 : fb == 4 ? 1.6 : 1.0;')
			.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ float fh = (folds(vBind, vLimb, int(vSlot + 0.5)) * 0.00025 + gDetail * 0.0003) * (1.0 - smoothstep(4.0, 12.0, length(vViewPosition))) + gWeave * 0.00004; vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition); vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1); normal = normalize(abs(det) * normal - sign(det) * (dFdx(fh) * r1 + dFdy(fh) * r2)); }')
			.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n{ int fb = int(gFab + 0.5); float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0); reflectedLight.indirectDiffuse += diffuseColor.rgb * rim * (fb == 0 || fb == 4 ? 0.5 : fb == 1 ? 0.15 : fb == 3 || fb == 8 ? 0.35 : 0.25);\n // hi-vis: the fluorescent dye gives back more than it is lit by, the tape shines back at the eye\n reflectedLight.indirectDiffuse += diffuseColor.rgb * gGlow * 0.45 + diffuseColor.rgb * gRefl * 0.9 * pow(saturate(dot(normal, normalize(vViewPosition))), 2.0); }');
	};
	m.customProgramCacheKey = () => 'crysis-garment-9';
	paint(m, o);
	return m;
}

// set a body's garment colours and patterns (no rebuilding: the uniforms only)
const PRINTS = 9;
export function paint(m, o) {
	const U = m.userData.U;
	const slots = [o.top, o.outer, o.bottom, o.shoes];
	slots.forEach((g, s) => {
		if (!g) return;
		const c = U.uCol.value;
		c[s * 4].set(g.col || '#888888');
		c[s * 4 + 1].set(g.acc || g.col || '#888888');
		c[s * 4 + 2].set(g.acc2 || g.acc || g.col || '#888888');
		c[s * 4 + 3].set(s === 3 ? (g.socks || o.bottom?.socks || g.col || '#888888') : s === 2 && g.socks ? g.socks : '#000000');
		let pat = PAT[g.pat] ?? 0;
		let scale = g.scale ?? (g.pat === 'breton' ? 14 : g.pat === 'stripe' ? (g.kind === 'boardshorts' ? 6 : 12) : g.pat === 'plaid' ? 7 : g.pat === 'check' ? 16 : g.pat === 'dots' ? 11 : 10);
		let flag = 0;
		if (s === 1) flag = g.open ? 1 : 0;
		if (s === 2) flag = (g.cuff ? 1 : 0) + (g.zips ? 2 : 0);
		if (s === 3) { scale = g.kind === 'chunky' ? 0.045 : g.kind === 'boot' ? 0.03 : g.kind === 'trail' ? 0.035 : 0.022; flag = g.kind === 'runner' || g.kind === 'trail' || g.kind === 'chunky' ? 1 : 0; }
		if (g.pat === 'denim' && s !== 2) pat = PAT.denim;
		const fab = FAB[g.fab] ?? (s === 3 ? FAB.leather : g.pat === 'denim' || g.pat === 'chambray' || g.kind === 'chinos' || g.kind === 'khakis' || g.kind === 'trousers' || g.kind === 'slacks' || g.kind === 'cargo' ? FAB.twill : g.kind === 'jersey' || g.kind === 'tech' || g.kind === 'runshorts' || g.kind === 'leggings' || g.kind === 'swim' || g.kind === 'bikini' ? FAB.nylon : s === 1 ? FAB.canvas : FAB.knit);
		U.uPat.value[s].set(pat, scale, flag, fab);
	});
	U.uMisc.value.x = o.top?.number || 0;
	U.uMisc.value.z = (o.printKind ?? 0) % PRINTS;
	// how each top is made (tailor): ribbed knit, woven shirt, hoodie, chest pocket, placket
	const make = (g, s) => !g ? 0 : (isRibbed(g) ? 1 : 0) | (isShirted(g) ? 2 : 0) | (g.kind === 'hoodie' ? 4 : 0) | (isShirted(g) && (s === 0 || g.pocket) && g.pocket !== false ? 8 : 0) | (isShirted(g) ? 16 : 0) | (/^(polo|henley)$/.test(g.kind || '') ? 32 : 0);
	U.uKind.value.set(make(o.top, 0), make(o.outer, 1), 0, 0);
}

// ---------- the cut: which garment each cage triangle belongs to ----------
// the body's landmarks: joint heights, the girth of the hips, the skull
export function landmarks(A, p, heads, map, height) {
	const Y = (n) => heads[map[n]].y;
	const cut = { neck: Y('neck01') - 0.02, chest: Y('spine01'), waist: Y('spine04') + 0.02, hip: Y('upperleg01.L'), elbow: Y('lowerarm01.L'), wrist: Y('wrist.L') + 0.03, knee: Y('lowerleg01.L'), ankle: Y('foot.L') + 0.02, shoulder: Y('upperarm01.L'), shoulderX: Math.abs(heads[map['upperarm01.L']].x), height };
 cut.sleevePlanes={};
 for(const side of ['L','R']){
  const shoulder=heads[map['upperarm01.'+side]],elbow=heads[map['lowerarm01.'+side]],wrist=heads[map['wrist.'+side]];
  const plane=(a,b,t)=>{const n=b.clone().sub(a).normalize(),at=a.clone().lerp(b,t);return [n.x,n.y,n.z,n.dot(at)];};
  cut.sleevePlanes[side]={none:plane(shoulder,elbow,0),cap:plane(shoulder,elbow,.25),short:plane(shoulder,elbow,.6),elbow:plane(shoulder,elbow,1),rolled:plane(elbow,wrist,.3),long:plane(elbow,wrist,.9)};
  // the arm's joints at rest, for measuring how far along a sleeve a point lies
  cut.arm=cut.arm||{};cut.arm[side]={s:shoulder.toArray(),e:elbow.toArray(),w:wrist.toArray()};
  // and the leg's: hip, knee, ankle (the middle of each section of a trouser leg, trouserHull)
  cut.leg=cut.leg||{};cut.leg[side]=['upperleg01.','lowerleg01.','foot.'].map((b)=>heads[map[b+side]].toArray());
 }
	// the skull and the torso's front and back, from the vertices the head and spine carry
	const n = A.ids.length / 4, hb = map.head;
	const sk = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
	let drapeFront = -1e9, drapeBack = 1e9;
	let backZ = 1e9, frontZ = -1e9, hipX = 0, hipZ0 = 1e9, hipZ1 = -1e9, waistX = 0;
	const part = partOf(A);
	for (let v = 0; v < n; v++) {
		let sum = 0, hw = 0;
		for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; sum += w; if (A.ids[v * 4 + q] === hb) hw += w; }
		const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
		if (sum && hw / sum > 0.85) { sk.x0 = Math.min(sk.x0, x); sk.x1 = Math.max(sk.x1, x); sk.y0 = Math.min(sk.y0, y); sk.y1 = Math.max(sk.y1, y); sk.z0 = Math.min(sk.z0, z); sk.z1 = Math.max(sk.z1, z); }
		if (part[v] !== 0) continue;
		if(y>cut.waist && y<cut.shoulder && Math.abs(x)<cut.shoulderX*.85){drapeFront=Math.max(drapeFront,z);drapeBack=Math.min(drapeBack,z);}
		if (Math.abs(y - cut.chest) < 0.03 && Math.abs(x) < 0.08) { backZ = Math.min(backZ, z); frontZ = Math.max(frontZ, z); }
		if (Math.abs(y - (cut.hip - 0.04)) < 0.03) { hipX = Math.max(hipX, Math.abs(x)); hipZ0 = Math.min(hipZ0, z); hipZ1 = Math.max(hipZ1, z); }
		if (Math.abs(y - cut.waist) < 0.03) waistX = Math.max(waistX, Math.abs(x));
	}
	cut.drapeFront = Number.isFinite(drapeFront) ? drapeFront : frontZ; cut.drapeBack = Number.isFinite(drapeBack) ? drapeBack : backZ;
	cut.skull = sk; cut.backZ = backZ; cut.frontZ = frontZ; cut.hipX = hipX; cut.hipZ = [hipZ0, hipZ1]; cut.waistX = waistX;
	return cut;
}

// body parts by dominant bone: 0 torso/head, 1 upper arm, 2 forearm, 3 hand, 4 thigh, 5 shin, 6 foot
let partCache = null;
export function partOf(A) {
	if (partCache) return partCache;
	const kind = A.bones.map((b) => /^(upperarm|shoulder|clavicle)/.test(b.name) ? (b.name.startsWith('upperarm') ? 1 : 0) : /^lowerarm/.test(b.name) ? 2 : /^(wrist|metacarpal|finger)/.test(b.name) ? 3 : /^upperleg/.test(b.name) ? 4 : /^lowerleg/.test(b.name) ? 5 : /^foot/.test(b.name) ? 6 : 0);
	const n = A.ids.length / 4, out = new Uint8Array(n);
	for (let v = 0; v < n; v++) { let best = 0, bw = -1; for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; if (w > bw) { bw = w; best = A.ids[v * 4 + q]; } } out[v] = kind[best] || 0; }
	partCache = out;
	return out;
}

// the regions of an outfit, as tests on a triangle (its centre c, what it is on k, a margin m)
export function regions(o, cut) {
	const T = o.top, J = o.outer, B = o.bottom, F = o.shoes;
	const sleeveOK = (s, c, k, m) => {
		// Keep triangles crossing a cut in the cloth cage; coverage tests still inset skin.
		if (m === 0) m = -.05;
		if (k.fore) return (s === 'long' || s === 'rolled') && sleeveDistance(c,s,cut)>m;
		// (sleeveless: the shoulder's cage triangles are the arm's, so the armhole's own curve
		// decides, not the bone they ride)
		if (k.arm) return s === 'none' ? armhole(c, cut) > m && c[1] > cut.chest - .02 + m : sleeveDistance(c,s,cut)>m;
		return true;
	};
	const hemOf = (g, outer) => !g ? 0 : g.crop ? cut.waist + 0.07 : g.kind === 'bikini' ? cut.chest - 0.085 : g.kind === 'tunic' ? cut.knee + 0.12 : g.long || g.kind === 'coverup' ? cut.knee + (g.long ? 0.02 : 0.2) : g.kind === 'puffer' && o.gen === 'z' ? cut.waist + 0.01 : g.tuck ? cut.waist - 0.02 : g.fit === 'oversized' || g.kind === 'hoodie' || g.kind === 'suit' ? cut.hip - 0.02 : cut.waist - (outer ? 0.07 : 0.04);
	const topHem = hemOf(T, false), outHem = hemOf(J, true);
	const inTorsoGarment = (g, hem, c, k, m) => {
		if (!g || k.hand || k.foot || k.shin) return false;
		if (g.kind === 'bikini') return !k.arm && !k.fore && !k.thigh && c[1] > cut.chest - 0.085 + m && c[1] < cut.chest + 0.05 - m;
		if (g.onepiece) return !k.arm && !k.fore && !k.thigh && c[1] < cut.chest + 0.06 - m && c[1] > cut.hip - 0.1 + m;
		if (!sleeveOK(g.sleeves || 'short', c, k, m)) return false;
		if (k.thigh) return hem < cut.hip + 0.12 && c[1] > hem + (m > 0 ? m : -.06);
		const scoop = (g.kind === 'tank' ? .045 : g.kind === 'crop' ? .025 : 0) * (c[2] > 0.02 ? 1 : 0);
		const neckline = cut.neck + (m > 0 ? -.005 : .045) + .035 * Math.min(1, Math.abs(c[0]) / .09) - scoop;
		return c[1] > hem + (m > 0 ? m : -.06) && c[1] < neckline - m && !(g.sleeves === 'none' && Math.abs(c[0]) > cut.shoulderX - 0.02 && c[1] > cut.chest);
	};
	// (trousers bloused into tall boots end at the boots' tops: tuck)
	// (into boots built over the feet: just under their collars, which close over the hem)
	const legEnd = B ? ({ long: B.tuck ? cut.ankle + (F?.built ? (F.tall ? 0.12 : 0.045) : 0.14) : cut.ankle + (B.fit === 'wide' || B.fit === 'baggy' ? 0.005 : 0.02), capri: cut.knee - 0.17, bermuda: cut.knee - 0.03, jorts: cut.knee - 0.04, board: cut.knee + 0.01, shorts: cut.knee + 0.1, short: cut.knee + 0.2, bike: cut.knee + 0.07, knicker: cut.knee - 0.1, skirt: B.len === 'mini' ? cut.knee + 0.18 : 1e9, brief: cut.hip - 0.06 })[B.legs || 'long'] ?? cut.ankle : 0;
	const rise = B && (B.fit === 'wide' || B.kind === 'skirt' || B.fit === 'baggy') ? 0.05 : 0.02;
	const R = {
		topHem, outHem, legEnd, rise,
		top: (c, tri, k, m = 0) => inTorsoGarment(T, topHem, c, k, m),
		outer: (c, tri, k, m = 0) => inTorsoGarment(J, outHem, c, k, m),
		bottom: (c, tri, k, m = 0) => {
			if (!B || k.arm || k.fore || k.hand || k.foot) return false;
			if (B.legs === 'brief') return (k.thigh ? c[1] > cut.hip - 0.07 + m : c[1] < cut.hip + 0.06 - m) && !k.shin;
			if (k.shin) return c[1] > legEnd + m;
			if (k.thigh) return c[1] > legEnd + m;
			return c[1] < cut.waist + rise - m;
		},
		// (socks on the shins under shorts, as part of the shoe)
		shoes: (c, tri, k, m = 0) => {
			if (!F || F.kind === 'barefoot') return false;
			if (F.kind === 'sandal') return k.foot > 1 && c[1] < 0.022 - m;
			const socks = F.socks || B?.socks;
			if (socks && k.shin && c[1] < cut.knee - 0.06 - m && (B?.legs !== 'long')) return true;
			const top = F.kind === 'boot' ? cut.ankle + (F.tall ? 0.17 : 0.09) : F.kind === 'trail' ? cut.ankle + 0.01 : cut.ankle - 0.02;
			return k.foot > 1 || c[1] < top - m;
		},
	};
	R.skirtShell = B && B.legs === 'skirt' && B.len !== 'mini';
	return R;
}

// how far each garment stands off the skin
export function offsets(o) {
	const T = o.top, J = o.outer, B = o.bottom, F = o.shoes;
	// Real ease in the pattern, with distinct everyday, tailored and oversized fits; only a
	// real puffer stands well off
	const fitOff = (g) => !g ? 0.006 : g.fit === 'tight' ? 0.004 : g.fit === 'fitted' || g.fit === 'slim' ? 0.012 : g.fit === 'straight' ? 0.022 : g.fit === 'oversized' ? 0.047 : g.fit === 'baggy' ? 0.042 : g.fit === 'wide' ? 0.032 : 0.028;
	const top = fitOff(T) + (T?.kind === 'knit' || T?.kind === 'hoodie' || T?.kind === 'sweat' ? 0.003 : 0);
	const puffy = J && J.pat === 'quilt' && /puffer|quilted/i.test(J.kind) ? (J.kind === 'puffer' ? 0.02 : 0.01) : J?.fab === 'fleece' ? 0.004 : 0;
	return { top, outer: J ? Math.max(top, fitOff(J)) + 0.008 + puffy : 0, bottom: fitOff(B), shoes: F?.kind === 'chunky' || F?.tall ? 0.02 : F?.kind === 'boot' ? 0.014 : F?.kind === 'sandal' ? 0.004 : 0.012 };
}

// ---------- the cloth mesh ----------
// Tailored trousers (a bottom with hull: { taper, shin, seat, ease, knee, room }): each leg's cloth laid over the
// leg's own cross-sections, height by height, bridged where cloth bridges (round the back of
// the knee, over the hollow above the ankle: the support of the section, which is its convex
// hull), and hung from above: the cloth comes in quickly off the seat (seat: metres of radius
// it may lose per metre down there), then narrows only as the cut tapers it down the thigh
// (taper) and below the knee (shin), with room round the knee (room) and more at its front to
// bend into (knee). Never past the body's middle at the crotch. Returns, for each
// cloth vertex of a trouser leg, how far it should stand off the skin (else -1).
export function trouserHull(P, SL, src, cut, hull, centre = null) {
	const DY = 0.01, NA = 32, top = cut.hip - 0.03, NY = Math.ceil(top / DY) + 2;
	const taper = hull.taper ?? 0.07, shin = hull.shin ?? taper * 0.6, seat = hull.seat ?? 0.3, ease = hull.ease ?? 0.006, knee = hull.knee ?? 0.006, room = hull.room ?? 0;
	const legs = [0, 1].map(() => ({ cx: new Float64Array(NY), cz: new Float64Array(NY), n: new Float64Array(NY), R: new Float32Array(NY * NA) }));
	const out = new Float32Array(P.count).fill(-1);
	const isLeg = (i) => src[i] >= 0 && SL[i] % 10 === 2 && SL[i] >= 20 && P.getY(i) < top;
	const bin = (y) => Math.max(0, Math.min(NY - 1, Math.round(y / DY)));
	// (the leg's middle at each height: the middle of the skin's own section there, centre(side,
	// y); else on the line through its joints, hip, knee and ankle (the bones lie off the middle,
	// the femur behind it, the tibia in front); else the mean of the cloth's points there,
	// smoothed down the leg, which a coarse cage with few points to a height pulls off the middle)
	for (let i = 0; i < P.count; i++) if (isLeg(i)) { const L = legs[P.getX(i) < 0 ? 1 : 0], b = bin(P.getY(i)); L.cx[b] += P.getX(i); L.cz[b] += P.getZ(i); L.n[b]++; }
	for (const [side, L] of legs.entries()) {
		const J = cut.leg ? (side === 0 ? (cut.leg.L[0][0] >= 0 ? cut.leg.L : cut.leg.R) : (cut.leg.L[0][0] < 0 ? cut.leg.L : cut.leg.R)) : null;
		if (J) {
			for (let b = 0; b < NY; b++) {
				const y = b * DY, own = centre?.(side, y);
				if (own) { L.cx[b] = own[0]; L.cz[b] = own[1]; continue; }
				const [a, c] = y > J[1][1] ? [J[0], J[1]] : [J[1], J[2]], t = Math.max(0, Math.min(1, (y - a[1]) / ((c[1] - a[1]) || 1)));
				L.cx[b] = a[0] + (c[0] - a[0]) * t; L.cz[b] = a[2] + (c[2] - a[2]) * t;
			}
			const sx = Float64Array.from(L.cx), sz = Float64Array.from(L.cz);
			for (let b = 0; b < NY; b++) { let x = 0, z = 0, w = 0; for (let d = -2; d <= 2; d++) { const q = Math.max(0, Math.min(NY - 1, b + d)); x += sx[q]; z += sz[q]; w++; } L.cx[b] = x / w; L.cz[b] = z / w; }
			continue;
		}
		let lx = 0, lz = 0, any = false;
		for (let b = NY - 1; b >= 0; b--) { if (L.n[b]) { L.cx[b] /= L.n[b]; L.cz[b] /= L.n[b]; lx = L.cx[b]; lz = L.cz[b]; any = true; } else if (any) { L.cx[b] = lx; L.cz[b] = lz; } }
		for (let b = 0; b < NY; b++) if (!L.n[b]) { for (let d = 1; d < NY; d++) { const q = b + d < NY && L.n[b + d] ? b + d : b - d >= 0 && L.n[b - d] ? b - d : -1; if (q >= 0) { L.cx[b] = L.cx[q]; L.cz[b] = L.cz[q]; break; } } }
		const sx = Float64Array.from(L.cx), sz = Float64Array.from(L.cz);
		for (let b = 0; b < NY; b++) { let x = 0, z = 0, w = 0; for (let d = -3; d <= 3; d++) { const q = Math.max(0, Math.min(NY - 1, b + d)); x += sx[q]; z += sz[q]; w++; } L.cx[b] = x / w; L.cz[b] = z / w; }
	}
	const polar = (L, i) => { const b = bin(P.getY(i)), dx = P.getX(i) - L.cx[b], dz = P.getZ(i) - L.cz[b]; return { b, r: Math.hypot(dx, dz), a: Math.round(((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI)) * NA) % NA }; };
	// the leg's radius each way at each height
	for (let i = 0; i < P.count; i++) if (isLeg(i)) { const L = legs[P.getX(i) < 0 ? 1 : 0], q = polar(L, i), k = q.b * NA + q.a; if (q.r > L.R[k]) L.R[k] = q.r; }
	for (const [side, L] of legs.entries()) {
		const H = new Float32Array(NY * NA);
		for (let b = 0; b < NY; b++) {
			// (gaps in a section: from its neighbours round)
			const row = L.R.subarray(b * NA, b * NA + NA);
			for (let pass = 0; pass < 2; pass++) for (let a = 0; a < NA; a++) if (!row[a]) row[a] = Math.max(row[(a + 1) % NA], row[(a + NA - 1) % NA]) * 0.98;
			// the section's support: bridged as cloth bridges it
			for (let a = 0; a < NA; a++) {
				let m = 0;
				for (let c = 0; c < NA; c++) { const d = Math.cos(((a - c) / NA) * 2 * Math.PI); if (d > 0) m = Math.max(m, row[c] * d); }
				H[b * NA + a] = m;
			}
		}
		// hung from above: off the seat the cloth comes in quickly to the thigh (the fold under the
		// seat bridged, not hung from), then tapers slowly down the thigh, more slowly below the knee
		for (let b = NY - 2; b >= 0; b--) {
			const y = b * DY, tp = y > cut.hip - 0.15 ? seat : y > cut.knee ? taper : shin;
			for (let a = 0; a < NA; a++) { const k = b * NA + a; H[k] = Math.max(H[k], H[k + NA] - tp * DY); }
		}
		// (the room at the knee's front, and never past the middle of the body)
		for (let b = 0; b < NY; b++) for (let a = 0; a < NA; a++) {
			const th = (a / NA) * 2 * Math.PI - Math.PI, dx = Math.cos(th), dz = Math.sin(th), k = b * NA + a;
			H[k] += knee * Math.exp(-(((b * DY - cut.knee) / 0.07) ** 2)) * Math.max(0, dz) + room * Math.exp(-(((b * DY - cut.knee) / 0.14) ** 2));
			const inward = (side === 0 ? -dx : dx);
			if (inward > 0.05) H[k] = Math.min(H[k], (Math.abs(L.cx[b]) - 0.004) / inward);
		}
		L.H = H;
	}
	for (let i = 0; i < P.count; i++) if (isLeg(i)) { const L = legs[P.getX(i) < 0 ? 1 : 0], q = polar(L, i); out[i] = Math.max(0, L.H[q.b * NA + q.a] - q.r) + ease; }
	return out;
}

// The middle of each leg's skin at each height (side 0: x >= 0), from where the edges of the
// skin's own triangles of thigh and shin cross the height: (side, y) => [x, z], or null where
// there is no section (above the thigh, below the shin, or too little of one)
function legCentres(A, p, part, cut) {
	const DY = 0.01, NY = Math.ceil((cut.hip + 0.05) / DY) + 2, F = A.body;
	const box = [0, 1].map(() => Array.from({ length: NY }, () => [Infinity, -Infinity, Infinity, -Infinity]));
	if (!F) return () => null;
	for (let t = 0; t < F.length; t += 6) for (let e = 0; e < 3; e++) {
		let a = F[t + e * 2], b = F[t + ((e + 1) % 3) * 2];
		if (part[a] < 4 || part[a] > 5 || part[b] < 4 || part[b] > 5) continue;
		if (p[a * 3 + 1] > p[b * 3 + 1]) [a, b] = [b, a];
		const ya = p[a * 3 + 1], yb = p[b * 3 + 1];
		for (let k = Math.max(0, Math.ceil(ya / DY)); k * DY <= yb && k < NY; k++) {
			const u = (k * DY - ya) / ((yb - ya) || 1), x = p[a * 3] + (p[b * 3] - p[a * 3]) * u, z = p[a * 3 + 2] + (p[b * 3 + 2] - p[a * 3 + 2]) * u;
			const q = box[x < 0 ? 1 : 0][k];
			q[0] = Math.min(q[0], x); q[1] = Math.max(q[1], x); q[2] = Math.min(q[2], z); q[3] = Math.max(q[3], z);
		}
	}
	return (side, y) => { const q = box[side]?.[Math.round(y / DY)]; return q && q[1] - q[0] > 0.03 && q[3] - q[2] > 0.03 ? [(q[0] + q[1]) / 2, (q[2] + q[3]) / 2] : null; };
}

export function clothGeometry(A, p, o, cut, R) {
	const part = partOf(A), faces = A.cage;
 // Keep shoulder/arm influences across the armhole. Only the legs must stop pulling
 // an untucked torso panel; stripping arm weights left a rigid shoulder above it.
 const torsoRide = A.bones.map(b => !/^(upperleg|lowerleg|foot|toe)/.test(b.name));
	const V = [], T = [], SI = [], SW = [], SL = [], I = [], key = new Map(), src = [];
	const kinds = (tri) => { const k = { arm: 0, fore: 0, hand: 0, thigh: 0, shin: 0, foot: 0 }; for (const v of tri) { const q = part[v]; if (q === 1) k.arm++; else if (q === 2) k.fore++; else if (q === 3) k.hand++; else if (q === 4) k.thigh++; else if (q === 5) k.shin++; else if (q === 6) k.foot++; } return k; };
	const tests = [R.top, R.outer, R.bottom, R.shoes];
	const hideTop = !!o.outer && !o.outer.open;
	const c = [0, 0, 0];
	for (let i = 0; i < faces.length; i += 6) {
		const tri = [faces[i], faces[i + 2], faces[i + 4]];
		for (let ax = 0; ax < 3; ax++) c[ax] = (p[tri[0] * 3 + ax] + p[tri[1] * 3 + ax] + p[tri[2] * 3 + ax]) / 3;
		const k = kinds(tri);
		for (let s = 0; s < 4; s++) {
			if (!tests[s](c, tri, k)) continue;
			// (a boot built over the foot is the shoe: no cloth sock under it, garment-kit.js)
			if (s === 3 && o.shoes?.built) continue;
			// (what a closed layer over it hides wholly is left out: nothing under it to poke through)
			if (s === 0 && hideTop && R.outer(c, tri, k, 0.04)) continue;
			// Keep trousers beneath tops. A centroid coverage test can remove a triangle
			// extending below the hem and leave a visible gap; layer offsets separate them.
			for (let j = 0; j < 6; j += 2) {
				const id = faces[i + j], u = faces[i + j + 1], k0 = (s * 32768 + id) * 32768 + u;
				let q = key.get(k0);
				if (q === undefined) {
					q = V.length / 3; key.set(k0, q); src.push(s * 32768 + id);
					V.push(p[id * 3], p[id * 3 + 1], p[id * 3 + 2]);
					T.push((Math.atan2(p[id * 3], p[id * 3 + 2]) + Math.PI) * 1.6, p[id * 3 + 1] * 20);
					const looseTorso = s < 2 && part[id] === 0 && [o.top,o.outer][s]?.fit !== 'tight';
     const weights = Array.from({length:4}, (_,w) => A.weights[id*4+w] * (!looseTorso || torsoRide[A.ids[id*4+w]] ? 1 : 0));
     let sum = weights.reduce((a,b)=>a+b,0);
     if(!sum){ for(let w=0;w<4;w++)weights[w]=A.weights[id*4+w]; sum=weights.reduce((a,b)=>a+b,0); }
     for (let w = 0; w < 4; w++) { SI.push(A.ids[id * 4 + w]); SW.push(weights[w] / (sum || 1)); }
					SL.push(s + 10 * (part[id] >= 1 && part[id] <= 3 ? 1 : part[id] >= 4 ? 2 : 0));
				}
				I.push(q);
			}
		}
	}
	// a skirt below the knee: a flared shell hung from the hips (the legs swing inside it)
	if (R.skirtShell) {
		const B = o.bottom, hem = B.len === 'maxi' ? cut.ankle + 0.03 : (cut.knee + cut.ankle) / 2 + 0.02, flare = B.len === 'maxi' ? 1.55 : 1.4;
		const hx = cut.hipX + 0.02, hz = (cut.hipZ[1] - cut.hipZ[0]) / 2 + 0.025, zc = (cut.hipZ[0] + cut.hipZ[1]) / 2;
		const prof = [[0.9, cut.waist + 0.03], [1.02, cut.hip + 0.02], [1.12, cut.hip - 0.1], [(1.12 + flare) / 2, (cut.hip - 0.1 + hem) / 2], [flare, hem]];
		const seg = 20, base = V.length / 3, rootI = A.bones.findIndex((b) => b.name === 'root');
		for (let j = 0; j < prof.length; j++) for (let a = 0; a <= seg; a++) {
			const t = a / seg * Math.PI * 2, [r, y] = prof[j];
			V.push(Math.sin(t) * r * hx, y, zc + Math.cos(t) * r * hz);
			T.push(t * 1.6, y * 20);
			SI.push(rootI, 0, 0, 0); SW.push(1, 0, 0, 0); SL.push(22); src.push(-1 - (base + j * (seg + 1) + a));
		}
		for (let j = 0; j < prof.length - 1; j++) for (let a = 0; a < seg; a++) { const q = base + j * (seg + 1) + a, n = q + seg + 1; I.push(q, n, q + 1, q + 1, n, n + 1); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
	g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
	g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
	g.setAttribute('slot', new THREE.Float32BufferAttribute(SL, 1));
	g.setIndex(I);
	g.computeVertexNormals();
	// smooth normals across UV seams: averaged by source vertex (within a garment)
	const n = g.attributes.normal, acc = new Map();
	for (let i = 0; i < src.length; i++) { if (src[i] < 0) continue; const a = acc.get(src[i]) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(src[i], a); }
	for (let i = 0; i < src.length; i++) { if (src[i] < 0) continue; const a = acc.get(src[i]), l = Math.hypot(...a) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
	// then each garment stood off the skin: fitted or loose; wide and baggy legs flare
	// evenly from the hip to the hem
	const off = offsets(o), P = g.attributes.position, B = o.bottom;
	const legFlare = B?.fit === 'wide' ? 0.045 : B?.fit === 'baggy' ? 0.04 : B?.legs === 'board' ? 0.02 : 0;
	// rugged trousers hang straight down from the thigh instead of following the knee and the
	// calf (hang: how far out at the shin), and bloused into boots, gather over their tops
	const legHang = B?.hang || 0;
	const flareTop = cut.hip - 0.06, flareLen = Math.max(0.2, flareTop - cut.ankle);
	// (tailored trousers: laid over the leg's sections and hung, trouserHull)
	const hullK = B?.hull ? trouserHull(P, SL, src, cut, B.hull, legCentres(A, p, part, cut)) : null;
	const tuck = o.top?.tuck, K = new Float32Array(P.count);
	for (let i = 0; i < P.count; i++) {
		if (src[i] < 0) continue;
		const s = SL[i] % 10, y = P.getY(i);
		let k = s === 0 ? off.top : s === 1 ? off.outer : s === 2 ? off.bottom : off.shoes;
		if (s === 2) {
			if (tuck && y > cut.waist - 0.06) k = Math.max(k, off.top + 0.004);
			if (legFlare && y < flareTop && SL[i] >= 20) { const t = Math.min(1, (flareTop - y) / flareLen); k += legFlare * t * (0.6 + 0.4 * t); }
			if (legHang && y < flareTop && SL[i] >= 20) { const t = Math.min(1, (flareTop - y) / (flareLen * 0.55)); k += legHang * t * t * (3 - 2 * t); }
			if (hullK && hullK[i] >= 0) { const blend = Math.min(1, Math.max(0, (cut.hip - 0.03 - y) / 0.06)); k = k * (1 - blend) + hullK[i] * blend; }
			// (tucked into a boot built over the foot: a little fuller just above its collar, then
			// in under it, inside the shaft; else gathered in over the boot's top so the hem meets it)
			if (B?.tuck && SL[i] >= 20 && o.shoes?.built) {
				const bt = cut.ankle + (o.shoes.tall ? 0.17 : 0.09);
				if (y < bt + 0.004) k = 0.008;
				else if (y < bt + 0.05) {
					// (bloused over a tall boot's collar; into a lower one's, narrowing to it)
					const t = Math.min(1, (bt + 0.05 - y) / 0.046), w = t * t * (3 - 2 * t);
					k = k * (1 - w) + (o.shoes.tall ? Math.max(Math.min(k, off.shoes + 0.016), off.shoes + 0.008) : Math.min(k, off.shoes + 0.002)) * w;
				}
			} else if (B?.tuck && SL[i] >= 20) { const gth = Math.max(0, Math.min(1, (R.legEnd + 0.06 - y) / 0.06)); k = k * (1 - gth) + 0.024 * gth; }
			if (B?.legs === 'skirt') k = 0.015 + Math.max(0, 0.6 - y) * 0.1;
		}
		if (s === 3 && (o.shoes?.kind === 'chunky' || (o.shoes?.tall && !o.shoes?.built)) && y < 0.04) k += 0.012;
		// (a tall boot's shaft stands round the calf; any other hugs the ankle)
		if (s === 3 && y > cut.ankle + 0.02) k = o.shoes?.tall ? 0.016 : 0.003;
  const garment=[o.top,o.outer,o.bottom,o.shoes][s], limb=Math.floor(SL[i]/10);
  if(s<2 && limb===1 && garment) {
   // a sleeve: cut with room at the bicep, narrowing to its cuff (garment-shape.js)
   const v=[P.getX(i),y,P.getZ(i)];
   k=sleeveEase(garment,armT(v,cut),sleeveDistance(v,garment.sleeves,cut),s===1)+(s===1&&garment.pat==='quilt'?.012:0);
  } else if(s<3 && garment?.fit!=='tight') {
   const x=P.getX(i), z=P.getZ(i), a=Math.atan2(x,z-(cut.frontZ+cut.backZ)/2);
   const hem=s===0?R.topHem:s===1?R.outHem:R.legEnd;
   const nearHem=Math.exp(-Math.pow((y-hem-.035)/.065,2));
   const compression=s===2?Math.exp(-Math.pow((y-cut.knee)/.09,2)):limb===1?Math.exp(-Math.pow((y-cut.elbow)/.07,2)):Math.exp(-Math.pow((y-cut.waist)/.09,2));
   // (bunching at the knee, the elbow, the waist; less of it in a slim leg)
   k += (.5+.5*Math.sin(y*72+a*3.2))*compression*.008*(s===2&&garment.fit==='slim'?.5:1) + (1+Math.sin(a*9+y*4))*.004*nearHem;
   // A sleeve has ease, but a light shirt is not padded at the deltoid.
   if(s<2 && limb===1 && garment.kind!=='puffer')k*=.6+.4*Math.max(0,Math.min(1,(cut.shoulder-y)/.22));
   if(s<2 && limb===0) {
    const shoulder=Math.max(0,Math.min(1,(cut.neck-y)/.12)), sh0=garment.shoulderEase??.25;
    k *= sh0+(1-sh0)*shoulder;
    if(!garment.tuck && y<cut.chest && y>hem) {
     const zc=(cut.drapeFront+cut.drapeBack)/2, rx=Math.max(cut.waistX,cut.shoulderX*.9), rz=(cut.drapeFront-cut.drapeBack)/2;
     const ell=Math.hypot(x/rx,(z-zc)/rz), hang=Math.min(1,(cut.shoulder-.04-y)/.12);
     // (a ribbed waistband draws the hang back in to the hips)
     const band=isRibbed(garment)?Math.min(1,Math.max(0,(y-hem-.05)/.06)):1;
     // (how much it hangs: a fitted shirt or an open overshirt hangs less than a loose one)
     if(ell>0 && ell<1) k+=Math.min(.1,(1-ell)*Math.max(rx,rz))*hang*band*(garment.drape??1);
    }
    k*=waistbandEase(garment,y-hem);
   }
  }
		K[i] = k;
	}
	// the offsets smoothed over the neighbours (a few passes): no steps where one allowance
	// meets another
	const nb = new Map(), I2 = g.index.array;
	const link = (a, b) => { let L = nb.get(a); if (!L) nb.set(a, L = []); L.push(b); };
	for (let t = 0; t < I2.length; t += 3) for (let j = 0; j < 3; j++) { const a = I2[t + j], b = I2[t + (j + 1) % 3]; if (src[a] >= 0 && src[b] >= 0 && SL[a] % 10 === SL[b] % 10) { link(a, b); link(b, a); } }
	// (vertices split at UV seams move as one)
	const same = new Map();
	for (let i = 0; i < P.count; i++) if (src[i] >= 0) { const L = same.get(src[i]); if (L) L.push(i); else same.set(src[i], [i]); }
	for (let pass = 0; pass < 3; pass++) {
		const K2 = Float32Array.from(K);
		for (const [i, L] of nb) { let sum = 0; for (const j of L) sum += K[j]; K2[i] = K[i] * 0.4 + sum / L.length * 0.6; }
		K.set(K2);
	}
	for (const L of same.values()) { let k = 0; for (const i of L) k += K[i]; k /= L.length; for (const i of L) K[i] = k; }
	// (inside a boot built over the foot the trousers stay inside it, whatever the smoothing
	// brought down from the blousing above: none of the hem standing out through the shaft)
	if (B?.tuck && o.shoes?.built) { const bt = cut.ankle + (o.shoes.tall ? 0.17 : 0.09); for (let i = 0; i < P.count; i++) if (src[i] >= 0 && SL[i] % 10 === 2 && SL[i] >= 20 && P.getY(i) < bt + 0.006) K[i] = Math.min(K[i], 0.008); }
	// the layers in order where they lie over the same skin, each a little outside the one
	// under it: trousers, then the top over them (or under them, tucked in), then the jacket
	const order = tuck ? [0, 2, 1] : [2, 0, 1], layer = new Map();
	for (let i = 0; i < P.count; i++) if (src[i] >= 0) { const id = src[i] % 32768, s = Math.floor(src[i] / 32768); if (s < 3) { let L = layer.get(id); if (!L) layer.set(id, L = [-1, -1, -1]); L[s] = Math.max(L[s], K[i]); } }
	for (const L of layer.values()) { let below = -1; for (const s of order) { if (L[s] < 0) continue; if (below >= 0 && L[s] < below + 0.004) L[s] = below + 0.004; below = L[s]; } }
	for (let i = 0; i < P.count; i++) if (src[i] >= 0) { const s = Math.floor(src[i] / 32768); if (s < 3) K[i] = Math.max(K[i], layer.get(src[i] % 32768)[s]); }
	// (a sleeve stands off all round its arm; the body's cloth less up and down, so hems keep their line)
	for (let i = 0; i < P.count; i++) if (src[i] >= 0) P.setXYZ(i, P.getX(i) + n.getX(i) * K[i], P.getY(i) + n.getY(i) * K[i] * (SL[i] % 10 < 2 && SL[i] >= 10 && SL[i] < 20 ? 1 : 0.3), P.getZ(i) + n.getZ(i) * K[i]);
 drapePanels(g, o, cut, R);
	g.computeVertexNormals();
	// smooth normals across the seams again, after the move
	acc.clear();
	for (let i = 0; i < src.length; i++) { if (src[i] < 0) continue; const a = acc.get(src[i]) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(src[i], a); }
	for (let i = 0; i < src.length; i++) { if (src[i] < 0) continue; const a = acc.get(src[i]), l = Math.hypot(...a) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
 const drape=new Float32Array(P.count);
 for(let i=0;i<P.count;i++) {
  const s=SL[i]%10, garment=[o.top,o.outer,o.bottom,o.shoes][s], y=P.getY(i);
  if(s<3 && garment?.fit!=='tight') { const hem=s===0?R.topHem:s===1?R.outHem:R.legEnd; drape[i]=Math.max(0,1-Math.abs(y-hem)/.22)*(garment?.tuck ? .5 : 1); }
 }
 g.setAttribute('drape',new THREE.BufferAttribute(drape,1));
 const cuff=new Float32Array(P.count), sleeve=new Float32Array(P.count*2);
 for(let i=0;i<P.count;i++){
  const s=SL[i]%10,item=[o.top,o.outer][s],v=[P.getX(i),P.getY(i),P.getZ(i)];
  cuff[i]=s<2&&item?sleeveDistance(v,item.sleeves,cut):1;
  // where a sleeve point lies along the arm, and the slack it has to hang and fold with
  const arm=s<2&&item&&SL[i]>=10&&SL[i]<20;
  sleeve[i*2]=arm?armT(v,cut):-1; sleeve[i*2+1]=arm?Math.max(0,K[i]-.003):0;
 }
 g.setAttribute('cuff',new THREE.BufferAttribute(cuff,1));
 g.setAttribute('sleeve',new THREE.BufferAttribute(sleeve,2));
 const out = finishGarmentEdges(refineCloth() ? refineGarmentSurface(g) : g, o, cut, R);
 // (the sleeve's place and slack kept in two bytes a vertex: t from -1 to 2.2, slack to 35 mm)
 const sa = out.attributes.sleeve, packed = new Uint8Array(sa.count * 2);
 for (let i = 0; i < sa.count; i++) { packed[i * 2] = Math.round(Math.max(0, Math.min(1, (sa.getX(i) + 1) / 3.2)) * 255); packed[i * 2 + 1] = Math.round(Math.max(0, Math.min(1, sa.getY(i) / 0.035)) * 255); }
 out.setAttribute('sleeve', new THREE.BufferAttribute(packed, 2, true));
 return out;
}

// ---------- the small things: caps, glasses, headphones, bags, watches, earrings, a chain ----------
// one geometry for all of them, each vertex bound whole to the bone it rides
export function accessoryGeometry(A, P0, o, cut, hairCol) {
	const { map, heads, eyes } = P0;
	const out = { pos: [], nor: [], col: [], si: [], sw: [], kit: [], idx: [] };
	const colour = new THREE.Color();
	// (bone: a name, or a function of the height for a strap that runs down the body)
	// (bone: a bone's name, a function of the height giving one, or { skin }: each point weighted
	// as the skin nearest it is, for what must move with the skin rather than ride one bone)
	// (kept indexed: each piece's shared corners skinned once, not once a triangle)
	const put = (geo, bone, c, gloss = 0, fab = 0) => {
		geo.computeVertexNormals();
		const pa = geo.attributes.position, na = geo.attributes.normal, near = bone?.skin, bi = near || typeof bone === 'function' ? null : map[bone] ?? 0, base = out.pos.length / 3;
		if (geo.index) for (const k of geo.index.array) out.idx.push(base + k);
		else for (let i = 0; i < pa.count; i++) out.idx.push(base + i);
		colour.set(c);
		for (let i = 0; i < pa.count; i++) {
			out.pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); out.nor.push(na.getX(i), na.getY(i), na.getZ(i));
			out.col.push(colour.r, colour.g, colour.b); out.kit.push(gloss, fab, 0);
			if (near) { const w = near(pa.getX(i), pa.getY(i), pa.getZ(i)); out.si.push(...w.ids); out.sw.push(...w.w); }
			else { out.si.push(bi ?? map[bone(pa.getY(i))] ?? 0, 0, 0, 0); out.sw.push(1, 0, 0, 0); }
		}
	};
	// the straps of the bags they carry (bags.js fitted them to this body)
	for (const f of P0.bags || []) for (const s of f.straps) put(s.geo, s.bone, s.col, s.gloss || 0, s.fab || 0);
	const sk = cut.skull, cx = (sk.x0 + sk.x1) / 2, cz = (sk.z0 + sk.z1) / 2 - 0.005, rx = (sk.x1 - sk.x0) / 2, rz = (sk.z1 - sk.z0) / 2, top = sk.y1;
	const eyeY = eyes ? (eyes[0].y + eyes[1].y) / 2 : top - 0.1, eyeZ = eyes ? Math.max(eyes[0].z, eyes[1].z) : sk.z1 - 0.03;
	// a dome over the skull: from `from` (0 crown .. 1 the rim) down `deep` metres, a little proud of the hair
	const dome = (deep, grow, seg = 16, cutFront = 0) => {
		const prof = [];
		for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.0005, Math.sin(a)), top + grow - deep + Math.cos(a) * deep)); }
		const g = new THREE.LatheGeometry(prof, seg, cutFront ? cutFront : 0, cutFront ? Math.PI * 2 - cutFront * 2 : Math.PI * 2);
		g.scale(rx + grow, 1, rz + grow); g.translate(cx, 0, cz);
		return g;
	};
	// (a body's points of one part, on one side: for what is built over the legs and feet; the
	// skin's own, not the cloth cage's or the helpers' the base mesh carries with it)
	const Lx = Math.sign(heads[map['foot.L']]?.x || 1) || 1;
	const onBody = new Uint8Array(P0.p ? P0.p.length / 3 : 0);
	if (A.body) for (let i = 0; i < A.body.length; i += 2) onBody[A.body[i]] = 1;
	const ptsIdx = (want, sd) => { const a = []; if (P0.part && P0.p) for (let v = 0; v < P0.part.length; v++) if (onBody[v] && P0.part[v] === want && Math.sign(P0.p[v * 3]) === sd) a.push(v); return a; };
	const flat = (ids) => { const a = []; for (const v of ids) a.push(P0.p[v * 3], P0.p[v * 3 + 1], P0.p[v * 3 + 2]); return a; };
	const pts = (want, sd) => flat(ptsIdx(want, sd));
	// (the bone weights of the skin nearest a point, among ids)
	const skinNear = (ids) => {
		const memo = new Map();
		return { skin: (x, y, z) => {
			const key = Math.round(x * 4e3) + ',' + Math.round(y * 4e3) + ',' + Math.round(z * 4e3);
			let r = memo.get(key);
			if (!r) {
				let best = ids[0], bd = Infinity;
				for (const v of ids) { const dx = P0.p[v * 3] - x, dy = P0.p[v * 3 + 1] - y, dz = P0.p[v * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = v; } }
				let sum = 0;
				for (let w = 0; w < 4; w++) sum += A.weights[best * 4 + w];
				r = { ids: [0, 1, 2, 3].map((w) => A.ids[best * 4 + w]), w: [0, 1, 2, 3].map((w) => A.weights[best * 4 + w] / (sum || 1)) };
				memo.set(key, r);
			}
			return r;
		} };
	};
	for (const q of o.acc || []) {
		const c = q.col || '#333333', a2 = q.acc || c;
		if (q.kind === 'cap' || q.kind === 'visor') {
			const rim = eyeY + 0.045;
			if (q.kind === 'cap') put(dome(top + 0.012 - rim, 0.012), 'head', c);
			else { const band = new THREE.CylinderGeometry(1, 1, 0.035, 18, 1, true); band.scale(rx + 0.012, 1, rz + 0.012); band.translate(cx, rim + 0.02, cz); put(band, 'head', c); }
			// the bill, out over the eyes (on a few worn backwards)
			const bill = new THREE.CylinderGeometry(0.1, 0.1, 0.008, 14, 1, false, -Math.PI / 2, Math.PI);
			bill.scale(0.95, 1, 0.75); bill.rotateX(-0.12); bill.translate(cx, rim + 0.008, cz + rz * 0.72);
			put(bill, 'head', q.faded ? new THREE.Color(a2).lerp(new THREE.Color(c), 0.5).getHex() : q.kind === 'visor' ? a2 : c);
		} else if (q.kind === 'beanie' || q.kind === 'hood' || q.kind === 'helmet' || q.kind === 'hazhood') {
			const deep = q.kind === 'beanie' ? top - eyeY - 0.03 : q.kind === 'helmet' ? top - eyeY + 0.03 : top - eyeY + 0.08;
			const grow = q.kind === 'beanie' ? 0.016 : q.kind === 'helmet' ? 0.03 : 0.035;
			if (q.kind === 'helmet' && q.combat) {
				// a combat helmet: its brow above the eyebrows, cut over the ears, down to the nape
				// behind; a cloth cover, a lip round the edge
				const seg = 24, rows = 8, pos = [], idx = [], crown = top + grow + 0.008;
				const rim = (a) => eyeY + 0.048 * Math.max(0, Math.cos(a)) ** 1.5 + 0.004 - 0.032 * Math.max(0, -Math.cos(a)) ** 1.2;
				for (let j = 0; j <= seg; j++) {
					const a = j / seg * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a), r0 = rim(a);
					const px = Math.sign(sa) * Math.abs(sa) ** 0.85, pz = Math.sign(ca) * Math.abs(ca) ** 0.85;
					for (let i = 0; i <= rows + 1; i++) {
						const t = Math.min(i, rows) / rows, e = t * Math.PI / 2, r = Math.sin(e) * (i > rows ? 1.04 : 1), y = i > rows ? r0 - 0.003 : r0 + Math.cos(e) * (crown - r0);
						pos.push(cx + px * r * (rx + grow), y, cz + pz * r * (rz + grow + 0.006));
					}
				}
				const n = rows + 2;
				for (let j = 0; j < seg; j++) for (let i = 0; i < n - 1; i++) { const p0 = j * n + i, p1 = p0 + n; idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1); }
				const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setIndex(idx);
				put(hg, 'head', c, 0.12, 2);
			} else put(dome(deep, grow, 18, q.kind === 'hood' || q.kind === 'hazhood' ? 0.62 : 0), 'head', c, q.kind === 'helmet' ? 0.7 : 0);
			if (q.kind === 'beanie') { const cuff = new THREE.CylinderGeometry(1, 1.02, 0.05, 18, 1, true); cuff.scale(rx + 0.024, 1, rz + 0.024); cuff.translate(cx, eyeY + 0.055, cz); put(cuff, 'head', c); }
			if (q.kind === 'helmet' && q.cage) for (let k = 0; k < 3; k++) { const bar = new THREE.CylinderGeometry(0.006, 0.006, rx * 1.6, 6); bar.rotateZ(Math.PI / 2); bar.translate(cx, eyeY - 0.05 - k * 0.035, sk.z1 + 0.045); put(bar, 'head', '#d8d8d8', 0.6); }
			if (q.kind === 'helmet' && q.visor) { const v = new THREE.SphereGeometry(1, 16, 8, -0.9, 1.8, 1.2, 0.6); v.scale(rx + 0.035, 0.12, rz + 0.035); v.translate(cx, eyeY + 0.01, cz); put(v, 'head', q.visor, 1); }
			if (q.kind === 'hazhood') { const v = new THREE.SphereGeometry(1, 14, 8, -0.7, 1.4, 1.1, 0.75); v.scale(rx + 0.04, 0.2, rz + 0.04); v.translate(cx, eyeY - 0.01, cz); put(v, 'head', a2, 1); }
		} else if (q.kind === 'bucket' || q.kind === 'sunhat') {
			const rim = eyeY + 0.055;
			put(dome(top + 0.015 - rim, 0.016), 'head', c);
			const w = q.kind === 'sunhat' ? 0.1 : 0.05;
			const brim = new THREE.CylinderGeometry(1, 1 + w * 12, w * 0.5, 20, 1, true);
			brim.scale(rx + 0.018, 1, rz + 0.018); brim.translate(cx, rim - w * 0.25, cz);
			put(brim, 'head', c);
			if (q.kind === 'sunhat') { const b = new THREE.CylinderGeometry(1, 1, 0.018, 20, 1, true); b.scale(rx + 0.019, 1, rz + 0.019); b.translate(cx, rim + 0.012, cz); put(b, 'head', a2); }
		} else if (q.kind === 'glasses' || q.kind === 'sunglasses') {
			if (!eyes) continue;
			// frames: a closed rim round each lens (rounded rectangles, or round), fine wire
			// or thicker acetate, the bridge between, the arms back to the ears
			const sun = q.kind === 'sunglasses', round = q.shape === 'round', wire = !!q.wire;
			const w = round ? 0.0205 : sun ? 0.026 : 0.0245, h = round ? 0.0195 : sun ? 0.021 : 0.0165, tube = wire ? 0.0009 : q.slim ? 0.0016 : 0.0022, pw = round ? 2 : 4;
			const gl = wire ? 2 : 0.6, p = P0.p, nb = Math.min(p ? p.length : 0, 13380 * 3);
			// fitted to this face: the frame just clear of the furthest-forward skin behind
			// each lens (brow, lids, cheek) and of the bridge of the nose; the arms clear of
			// the temples back to just in front of the ears
			const most = (test, pick) => { let m = -1e9; for (let i = 0; i < nb; i += 3) if (test(p[i], p[i + 1], p[i + 2])) m = Math.max(m, pick(p[i], p[i + 1], p[i + 2])); return m; };
			let z = p ? eyeZ + 0.008 : eyeZ + 0.017;
			if (p) for (const e of eyes) {
				const ex = e.x + Math.sign(e.x) * 0.003;
				z = Math.max(z, most((x, y, zz) => Math.abs(x - ex) < w * 0.85 && Math.abs(x) > 0.016 && Math.abs(y - e.y) < h + tube && zz > eyeZ - 0.02, (x, y, zz) => zz) + 0.002 + tube);
			}
			const zb = p ? Math.max(z, most((x, y, zz) => Math.abs(x) < 0.008 && Math.abs(y - eyes[0].y - h * 0.4) < 0.006 && zz > eyeZ - 0.02, (x, y, zz) => zz) + 0.002 + tube) : z;
			const rim = (ex, ey) => { const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); pts.push(new THREE.Vector3(ex + Math.sign(c) * Math.pow(Math.abs(c), 2 / pw) * w, ey + Math.sign(s2) * Math.pow(Math.abs(s2), 2 / pw) * h * (s2 < 0 && !round ? 0.92 : 1), z - Math.abs(c) * 0.002)); } return pts; };
			for (const e of eyes) {
				const sx = Math.sign(e.x), ex = e.x + sx * 0.003, ey = e.y + 0.001, pts = rim(ex, ey);
				put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 28, tube, 5, true), 'head', q.col || c, gl);
				if (sun) { const sh = new THREE.Shape(pts.map((p2) => new THREE.Vector2(p2.x, p2.y))); const lens = new THREE.ShapeGeometry(sh); lens.translate(0, 0, z - 0.001); put(lens, 'head', '#16181c', 1); }
				// the arm back to the ear, over the temple
				const x0 = ex + sx * (w + tube), ya = ey + h * 0.4, lobe = P0.lobes?.[e.x > 0 ? 0 : 1];
				const zEar = lobe ? lobe.z + 0.012 : z - 0.1;
				const side = (za, zc) => p ? most((x, y, zz) => x * sx > 0.02 && Math.abs(y - ya) < 0.012 && zz > za && zz < zc, (x) => Math.abs(x)) : Math.abs(x0);
				const xt = Math.max(Math.abs(x0) + 0.002, side(z - 0.05, z - 0.005) + 0.004), xe = Math.max(xt - 0.004, side(zEar - 0.02, zEar + 0.02) + 0.004);
				const path = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, ya, z - 0.002), new THREE.Vector3(sx * xt, ya, z - 0.03), new THREE.Vector3(sx * xe, ya - 0.004, zEar)]);
				put(new THREE.TubeGeometry(path, 10, wire ? 0.0009 : 0.0018, 4, false), 'head', q.col || c, gl);
			}
			const b0 = eyes[0].x + Math.sign(eyes[0].x) * 0.003, b1 = eyes[1].x + Math.sign(eyes[1].x) * 0.003, bx0 = Math.min(b0, b1) + w, bx1 = Math.max(b0, b1) - w;
			const bridge = new THREE.CatmullRomCurve3([new THREE.Vector3(bx0, eyes[0].y + h * 0.3, z), new THREE.Vector3((bx0 + bx1) / 2, eyes[0].y + h * 0.5, Math.max(z, zb) + 0.001), new THREE.Vector3(bx1, eyes[0].y + h * 0.3, z)]);
			put(new THREE.TubeGeometry(bridge, 6, tube, 5, false), 'head', q.col || c, gl);
		} else if (q.kind === 'watch') {
			// on the left wrist, the face on the back of it
			const w = heads[map['wrist.L']], arm = map['lowerarm02.L'] !== undefined ? 'lowerarm02.L' : 'lowerarm01.L', dir = w.clone().sub(heads[map['lowerarm01.L']]).normalize();
			const k = cut.height / 1.7, r = 0.027 * k, at = w.clone().addScaledVector(dir, -0.03 * k);
			const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
			const band = new THREE.CylinderGeometry(r, r, 0.018 * k, 16, 1, true); band.applyQuaternion(qn); band.translate(at.x, at.y, at.z); put(band, arm, q.metal ? q.acc : c, q.metal ? 2 : 0.2);
			const out2 = new THREE.Vector3(1, 0, 0).addScaledVector(dir, -dir.x).normalize();
			const face = new THREE.CylinderGeometry(0.017 * k, 0.017 * k, 0.007, 20); face.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out2));
			face.translate(at.x + out2.x * (r + 0.003), at.y + out2.y * (r + 0.003), at.z + out2.z * (r + 0.003)); put(face, arm, q.acc || '#c9ccd0', 2);
		} else if (q.kind === 'earrings') {
			for (const L of P0.lobes || []) {
				if (!L) continue;
				const sx = Math.sign(L.x);
				if (q.hoop) { const hp = new THREE.TorusGeometry(0.009, 0.0011, 5, 18); hp.rotateY(Math.PI / 2); hp.translate(L.x + sx * 0.001, L.y - 0.008, L.z); put(hp, 'head', c, 2); }
				else { const st = new THREE.SphereGeometry(0.0026, 8, 6); st.translate(L.x + sx * 0.002, L.y + 0.002, L.z + 0.001); put(st, 'head', c, 2); }
			}
		} else if (q.kind === 'chain') {
			// a fine chain round the neck, lower at the front
			const ch = new THREE.TorusGeometry(1, 0.022, 4, 40); ch.rotateX(Math.PI / 2 - 0.5); ch.scale(0.068, 0.068, 0.072);
			ch.translate(0, cut.neck - 0.035, (cut.backZ + cut.frontZ) / 2 + 0.012); put(ch, 'spine01', c, 2);
		} else if (q.kind === 'headphones') {
			const band = new THREE.TorusGeometry(1, 0.035, 6, 20, Math.PI); band.scale(rx + 0.03, top - eyeY + 0.06, 0.35); band.translate(cx, eyeY - 0.02, cz - 0.01);
			put(band, 'head', c, 0.4);
			for (const s of [-1, 1]) { const cup = new THREE.CylinderGeometry(0.038, 0.038, 0.03, 16); cup.rotateZ(Math.PI / 2); cup.translate(cx + s * (rx + 0.018), eyeY - 0.03, cz - 0.01); put(cup, 'head', c, 0.4); }
		} else if (q.kind === 'gloves' || q.kind === 'mitt') {
			for (const s of q.kind === 'mitt' ? ['L'] : ['L', 'R']) {
				const wi = map['wrist.' + s], w = heads[wi], dir = P0.rest.dirs[wi];
				const big = q.kind === 'mitt' ? 1.35 : 1.1;
				const box = new THREE.BoxGeometry(0.085 * big, 0.2 * big, 0.045 * big, 1, 2, 1);
				box.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
				const cen = w.clone().addScaledVector(dir, 0.085 * big);
				box.translate(cen.x, cen.y, cen.z);
				put(box, 'wrist.' + s, c);
				if (q.kind === 'gloves') { const cuff = new THREE.CylinderGeometry(0.042, 0.045, 0.05, 10); cuff.translate(w.x, w.y + 0.01, w.z); put(cuff, 'wrist.' + s, q.acc || c); }
			}
		}
	}
	// the kit of the armed sides (combat/outfits.js): a bandana, a plate carrier, a trucker
	// cap, a police cap, a beret
	const part = (deep, grow, phi0, phiLen) => {
		const prof = [];
		for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.0005, Math.sin(a)), top + grow - deep + Math.cos(a) * deep)); }
		const g = new THREE.LatheGeometry(prof, 12, phi0, phiLen);
		g.scale(rx + grow, 1, rz + grow); g.translate(cx, 0, cz);
		return g;
	};
	const torso = (y) => (y > cut.chest ? 'spine01' : y > (cut.chest + cut.waist) / 2 ? 'spine02' : 'spine03');
	// the dressed torso's surface and the top's neckline, measured once when first wanted
	let field = null, ring = null;
	const kitField = () => field || (field = torsoField(cut, clothPoints(P0.cloth, P0.p, P0.part)));
	const kitRing = () => ring || (ring = necklineRing(P0.cloth, cut));
	for (const q of o.acc || []) {
		const c = q.col || '#333333', a2 = q.acc || c;
		if (q.kind === 'belt') {
			// a belt round the trousers' waistband, their loops over it, a buckle (garment-kit.js)
			for (const { geo, part: pc } of beltGeometry(cut, kitField(), { y: cut.waist + 0.001, lo: !!P0.lo })) put(geo, 'root', pc === 'buckle' ? (q.buckle || '#8c877d') : pc === 'loop' ? (q.loop || o.bottom?.col || c) : c, pc === 'buckle' ? 2 : 0.1, pc === 'loop' ? 2 : pc === 'buckle' ? 0 : 1);
			continue;
		}
		if (q.kind === 'cargo') {
			// bellows pockets on the outer thighs, flapped (garment-kit.js)
			for (const sd of [1, -1]) for (const { geo, part: pc } of cargoPocketGeometry(pts(4, sd), sd, { y: cut.knee + 0.17, lo: !!P0.lo })) put(geo, 'upperleg01.' + (sd === Lx ? 'L' : 'R'), pc === 'flap' ? new THREE.Color(c).multiplyScalar(0.92).getHex() : c, 0, 2);
			continue;
		}
		if (q.kind === 'bandana') {
			// over the nose and mouth, a point hanging at the throat, knotted behind
			const y0 = eyeY - 0.035, y1 = cut.neck - 0.02, h = y0 - y1;
			const g = new THREE.CylinderGeometry(1, 1.25, h, 14, 2, true, -1.75, 3.5);
			g.scale(rx + 0.014, 1, rz + 0.02); g.translate(cx, (y0 + y1) / 2, cz + 0.006);
			put(g, 'head', c);
			const tip = new THREE.ConeGeometry(0.05, 0.07, 3); tip.rotateX(Math.PI); tip.scale(1.4, 1, 0.35); tip.translate(cx, y1 - 0.03, sk.z1 + 0.02);
			put(tip, 'head', c);
			const knot = new THREE.SphereGeometry(0.018, 6, 5); knot.translate(cx, y0 - 0.01, sk.z0 - 0.004); put(knot, 'head', a2);
		} else if (q.kind === 'carrier') {
			// front and back plates made to the chest and back, a cummerbund round the waist,
			// straps over the shoulders, pouches on the plate (a police vest: a radio, a badge
			// and a reflective band) (garment-kit.js)
			const pieces = carrierGeometry(cut, kitField(), { police: !!q.police, lo: !!P0.lo, compact: !!q.compact });
			const flap = new THREE.Color(a2).multiplyScalar(0.82).getHex(), web = new THREE.Color(a2).multiplyScalar(0.9).getHex(), patch = new THREE.Color(a2).multiplyScalar(0.72).getHex();
			// (webbing in nylon, the patch in a loop pile; the rest cordura)
			for (const { geo, part: pc } of pieces) put(geo, pc === 'strap' ? 'spine01' : torso, pc === 'band' || pc === 'pouch' ? a2 : pc === 'flap' ? flap : pc === 'tape' ? '#80868d' : pc === 'web' ? web : pc === 'patch' ? patch : c, pc === 'tape' ? 0.5 : pc === 'web' ? 0.08 : 0, pc === 'tape' ? 0 : pc === 'web' ? 1 : pc === 'patch' ? 6 : 2);
			if (q.police) {
				const w = Math.min(0.33, cut.shoulderX * 1.6), y = cut.chest + 0.06, x = w * 0.26;
				const bd = new THREE.CylinderGeometry(0.02, 0.02, 0.005, 6); bd.rotateX(Math.PI / 2); bd.translate(x, y, kitField().front(x, y) + 0.012 + 0.024 + 0.002); put(bd, 'spine01', q.badge || '#d9c46a', 2);
			}
		} else if (q.kind === 'trucker') {
			// a camouflage front panel on a pale mesh back, the bill in the front's colour
			const rim = eyeY + 0.045, deep = top + 0.012 - rim;
			put(part(deep, 0.013, Math.PI * 0.32, Math.PI * 1.36), 'head', a2);
			put(part(deep, 0.016, -Math.PI * 0.34, Math.PI * 0.68), 'head', c);
			const bill = new THREE.CylinderGeometry(0.1, 0.1, 0.008, 14, 1, false, -Math.PI / 2, Math.PI);
			bill.scale(0.95, 1, 0.78); bill.rotateX(-0.1); bill.translate(cx, rim + 0.008, cz + rz * 0.72); put(bill, 'head', c);
		} else if (q.kind === 'peaked') {
			// a police cap: the crown wider than the band, a black peak, the cap badge
			const rim = eyeY + 0.05;
			const band = new THREE.CylinderGeometry(1, 1, 0.045, 20, 1, true); band.scale(rx + 0.016, 1, rz + 0.016); band.translate(cx, rim + 0.022, cz); put(band, 'head', q.band || a2);
			const crown = new THREE.CylinderGeometry(1.18, 1.02, 0.055, 20, 1, false); crown.scale(rx + 0.016, 1, rz + 0.02); crown.translate(cx, rim + 0.07, cz - 0.005); put(crown, 'head', c);
			const peak = new THREE.CylinderGeometry(0.1, 0.1, 0.006, 14, 1, false, -Math.PI / 2, Math.PI); peak.scale(0.9, 1, 0.62); peak.rotateX(-0.42); peak.translate(cx, rim + 0.005, cz + rz * 0.78); put(peak, 'head', a2, 1);
			const bd = new THREE.SphereGeometry(0.012, 6, 5); bd.scale(1, 1.2, 0.4); bd.translate(cx, rim + 0.055, cz + rz + 0.02); put(bd, 'head', q.band || '#d9c46a', 2);
		} else if (q.kind === 'beret') {
			const g = new THREE.SphereGeometry(1, 16, 8); g.scale(rx + 0.03, 0.035, rz + 0.03); g.rotateZ(-0.2); g.translate(cx - 0.012, top - 0.005, cz); put(g, 'head', c);
		}
	}
	// boots built over the feet: the upper lofted round the skin, soles, a toe cap and a heel
	// counter, a tongue, laces, a collar (garment-kit.js), every point moving as the skin
	// nearest it does (so the boot bends a little at the ankle, as one does)
	const F = o.shoes;
	if (F?.built && P0.part && P0.p) {
		const offS = offsets(o).shoes, top = cut.ankle + (F.tall ? 0.17 : 0.09);
		for (const sd of [1, -1]) {
			const footI = ptsIdx(6, sd), shinI = ptsIdx(5, sd).filter((v) => P0.p[v * 3 + 1] < top + 0.04), near = skinNear(footI.concat(shinI));
			for (const { geo, part: pc } of bootGeometry(flat(footI), flat(shinI), { top, ankle: cut.ankle, off: offS, lo: !!P0.lo })) {
				const metal = pc === 'eyelet' || pc === 'hook', rubber = pc === 'sole' || pc === 'mid', panel = pc === 'cap' || pc === 'counter';
				const col = pc === 'sole' ? (F.sole || '#1d1b19') : pc === 'mid' ? (F.mid || '#4a3c2e') : pc === 'lace' ? (F.lace || '#2b2420') : metal ? '#8f8a80' : pc === 'collar' || panel ? new THREE.Color(F.col).multiplyScalar(pc === 'collar' ? 0.78 : 0.86).getHex() : F.col;
				put(geo, near, col, metal ? 2 : rubber ? 0.12 : pc === 'lace' ? 0.05 : panel ? 0.38 : 0.3, metal ? 0 : rubber ? 5 : pc === 'lace' ? 1 : 4);
			}
		}
	}
	// a hoodie's hood lying in folds on the shoulders and down the back, and its drawstrings
	if (o.top?.kind === 'hoodie' && !(o.outer && o.outer.sleeves !== 'none' && !o.outer.open)) {
		const { hood, roll, strings } = hoodGeometry(cut, kitField(), kitRing(), { lo: !!P0.lo });
		put(hood, (y) => (y > cut.neck - 0.02 ? 'spine01' : 'spine02'), o.top.col, 0, o.top.fab === 'fleece' ? 4 : 0);
		put(roll, 'spine01', o.top.col, 0, o.top.fab === 'fleece' ? 4 : 0);
		const cord = o.top.acc && o.top.acc !== o.top.col && o.top.pat !== 'block' ? o.top.acc : '#efede6';
		for (const g of strings) put(g, 'spine01', cord);
	}
	// a shirt's or a polo's collar, where nothing closed is worn over it
	const T0 = o.top;
	if (T0 && (isShirted(T0) || T0.kind === 'polo' || T0.collar) && !(o.outer && !o.outer.open && o.outer.sleeves !== 'none')) {
		put(collarGeometry(cut, kitRing(), { polo: T0.kind === 'polo', lo: !!P0.lo }), 'spine01', T0.pat === 'ringer' && T0.acc ? T0.acc : T0.col, 0, 0);
	}
	// an open overshirt's own collar, over whatever is under it (the plaid's main colour)
	const O0 = o.outer;
	if (O0 && O0.open && (isShirted(O0) || O0.collar) && !(T0 && (isShirted(T0) || T0.collar))) {
		const off = offsets(o);
		put(collarGeometry(cut, kitRing(), { lo: !!P0.lo, out: Math.max(0, off.outer - off.top), open: true }), 'spine01', O0.pat === 'plaid' || O0.pat === 'check' ? new THREE.Color(O0.col).multiplyScalar(0.8).getHex() : O0.col, 0, O0.fab === 'canvas' ? 2 : 0);
	}
	// the bun of hair worn up, and a headscarf
	if (o.hair?.bun && hairCol) { const bun = new THREE.SphereGeometry(0.05, 12, 8); bun.translate(cx, top - 0.02, sk.z0 + 0.01); put(bun, 'head', hairCol); }
	if (o.hair?.scarf) {
		put(dome(top - eyeY + 0.2, 0.018, 18, 0.72), 'head', o.hair.scarf);
		const drape = new THREE.CylinderGeometry(0.075, 0.13, 0.12, 18, 1, true); drape.translate(0, cut.neck + 0.01, (cut.backZ + cut.frontZ) / 2); put(drape, 'spine01', o.hair.scarf);
	}
	if (!out.pos.length) return null;
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
	g.setAttribute('kit', new THREE.Float32BufferAttribute(out.kit, 3));
	g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(out.si), 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(out.sw), 4));
	g.setIndex(out.idx);
	g.computeBoundingSphere();
	return g;
}
// one material for every accessory of every person (the bags' own, propkit.js, in white)
let accMat = null;
export function accessoryMaterial() {
	if (accMat) return accMat;
	accMat = patchKit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
	accMat.userData.shared = true;
	return accMat;
}
