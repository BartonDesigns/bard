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
import { torsoField, clothPoints, necklineRing, hoodGeometry, collarGeometry, carrierGeometry } from './garment-kit.js';
import { patchKit } from './propkit.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CAMO } from '../combat/outfits.js';
import { tierNow } from '../world/governor.js';

// (phone audit: a phone, or a low quality tier, keeps the clothes' own surface: the curved split
// that rounds the shoulders by up to 4 mm is for the folds, which a phone draws none of, and it
// quadrupled every body's upper garments and much of the garbage made as people stream in)
const PHONE = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const refineCloth = (phone = PHONE, tier = tierNow()) => !phone && tier < 2;

// ---------- the painting ----------
// pattern ids (the shader's)
export const PAT = { plain: 0, hivis: 29, stripe: 1, breton: 1, pinstripe: 2, plaid: 3, check: 4, block: 5, graphic: 6, band: 7, ringer: 8, quilt: 9, fleece: 10, fleeceblock: 11, rib: 12, denim: 13, chambray: 14, cargo: 15, track: 16, jersey: 17, dots: 18, dye: 19, oxford: 20, hem: 21, mail: 22, hazmat: 23, heat: 24, pleat: 25, hoops: 26, sash: 27, camo: 28 };
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
	// flat across the front and back, round the sides: a planar coordinate for checks and plaid
	float hz = abs(N.z) > abs(N.x) ? P.x : P.z;
	vec2 pl = vec2(hz, P.y);
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
		float n1 = vn(P.xy * vec2(13.0, 9.0) + vec2(P.z * 10.0, 1.7)) * 0.7 + vn(P.xy * 37.0 + P.z * 14.0) * 0.3;
		float n2 = vn(P.zy * vec2(18.0, 12.0) + vec2(3.1, P.x * 11.0)) * 0.75 + vn(P.xy * 49.0 + 5.0) * 0.25;
		float n3 = vn(P.xy * vec2(30.0, 22.0) + vec2(P.z * 21.0, 7.3)) * 0.8 + vn(P.xy * 70.0 + 2.0) * 0.2;
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
	if (s == 2 && uPat[2].z > 0.5 && P.y < uHem.w + 0.05) c *= 0.88 - 0.1 * abs(sin(atan(P.x, P.z) * 30.0));
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
		// a chest pocket on the left: its outline stitched, the cloth doubled
		vec2 q = vec2(P.x - 0.085, P.y - chest + 0.015);
		float bottom = -0.065 + max(0.0, 0.012 - abs(q.x) * 0.4);
		if (abs(q.x) < 0.05 && q.y < 0.04 && q.y > bottom) {
			float e = min(0.05 - abs(q.x), min(0.04 - q.y, q.y - bottom));
			c *= 0.965 - line(e - 0.003, 0.001) * 0.18; gDetail += smoothstep(0.0, 0.004, e) * 0.5 - line(e - 0.003, 0.001) * 0.6;
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
			.replace('#include <color_fragment>', '#include <color_fragment>\n{ int s = int(vSlot + 0.5); vec3 N = normalize(vBN); float gPx = length(fwidth(vBind));\n\n if (vTrim < 0.1 && s == 0 && vLimb < 0.5 && vBind.y < uHem.x + 0.012) discard;\n if (vTrim < 0.1 && s == 2 && vLimb > 1.5 && uHem.w < 5.0 && vBind.y < uHem.w + 0.012) discard;\n if (vTrim < 0.1 && s == 1 && vLimb < 0.5 && vBind.y < uEdge.x + 0.012) discard;\n if (uEdge.z > 0.5 && s == 1 && (vLimb > 1.5 || (vLimb > 0.5 && vBind.y < uCutA.y - 0.03) || abs(vBind.x) > uEdge.y - 0.03 + max(0.0, uCutA.y - 0.07 - vBind.y) * 1.5)) discard;\n if ((s == 0 || s == 1) && vLimb < 0.5) { float fr = smoothstep(-0.04, -0.005, vBind.z); float ny = (s == 0 ? uNeck.x - uNeck.z * fr : uNeck.y) + 0.035 * smoothstep(0.0, 0.09, abs(vBind.x)) - 0.004 * fr; if (vTrim < 0.1 && vBind.y > ny) discard; gCollar = 1.0 - smoothstep(0.004, 0.011, ny - vBind.y); }\n if (s == 1 && uPat[1].z > 0.5 && vBind.z > uMisc.y && vBind.y > uCutA.z - 0.3) { float e = abs(vBind.x) - 0.035 - max(0.0, uCutA.y - vBind.y) * 0.12; if (e < 0.0) discard; gCollar = max(gCollar, 1.0 - smoothstep(0.003, 0.008, e)); }\n diffuseColor.rgb *= tailor(s, vBind, N, garment(s, vBind, N), gPx) * (1.0 - gCollar * 0.08 - vTrim * 0.045); vec2 wv = weave(int(gFab + 0.5), vBind, N, gPx); diffuseColor.rgb *= 1.0 + wv.y;\n // where one layer hangs over another: a soft shadow just under its hem, no hard seam\n float hd = s == 2 && vLimb < 1.5 ? uHem.x - vBind.y : s == 0 && uEdge.w > 0.5 ? uEdge.x - vBind.y : -1.0; if (hd >= 0.0) diffuseColor.rgb *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.04, hd)); gRough = clamp(gRough - wv.y * 0.5, 0.2, 1.0); gWeave = wv.x; }')
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
		let scale = g.pat === 'breton' ? 14 : g.pat === 'stripe' ? (g.kind === 'boardshorts' ? 6 : 12) : g.pat === 'plaid' ? 7 : g.pat === 'check' ? 16 : g.pat === 'dots' ? 11 : 10;
		let flag = 0;
		if (s === 1) flag = g.open ? 1 : 0;
		if (s === 2) flag = g.cuff ? 1 : 0;
		if (s === 3) { scale = g.kind === 'chunky' ? 0.045 : g.kind === 'boot' ? 0.03 : g.kind === 'trail' ? 0.035 : 0.022; flag = g.kind === 'runner' || g.kind === 'trail' || g.kind === 'chunky' ? 1 : 0; }
		if (g.pat === 'denim' && s !== 2) pat = PAT.denim;
		const fab = FAB[g.fab] ?? (s === 3 ? FAB.leather : g.pat === 'denim' || g.pat === 'chambray' || g.kind === 'chinos' || g.kind === 'khakis' || g.kind === 'trousers' || g.kind === 'slacks' || g.kind === 'cargo' ? FAB.twill : g.kind === 'jersey' || g.kind === 'tech' || g.kind === 'runshorts' || g.kind === 'leggings' || g.kind === 'swim' || g.kind === 'bikini' ? FAB.nylon : s === 1 ? FAB.canvas : FAB.knit);
		U.uPat.value[s].set(pat, scale, flag, fab);
	});
	U.uMisc.value.x = o.top?.number || 0;
	U.uMisc.value.z = (o.printKind ?? 0) % PRINTS;
	// how each top is made (tailor): ribbed knit, woven shirt, hoodie, chest pocket, placket
	const make = (g, s) => !g ? 0 : (isRibbed(g) ? 1 : 0) | (isShirted(g) ? 2 : 0) | (g.kind === 'hoodie' ? 4 : 0) | (isShirted(g) && s === 0 && g.pocket !== false ? 8 : 0) | (isShirted(g) ? 16 : 0) | (/^(polo|henley)$/.test(g.kind || '') ? 32 : 0);
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
	const legEnd = B ? ({ long: cut.ankle + (B.fit === 'wide' || B.fit === 'baggy' ? 0.005 : 0.02), capri: cut.knee - 0.17, bermuda: cut.knee - 0.03, jorts: cut.knee - 0.04, board: cut.knee + 0.01, shorts: cut.knee + 0.1, short: cut.knee + 0.2, bike: cut.knee + 0.07, knicker: cut.knee - 0.1, skirt: B.len === 'mini' ? cut.knee + 0.18 : 1e9, brief: cut.hip - 0.06 })[B.legs || 'long'] ?? cut.ankle : 0;
	const rise = B && (B.fit === 'wide' || B.kind === 'skirt' || B.fit === 'baggy') ? 0.05 : 0.02;
	const R = {
		topHem, outHem, legEnd,
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
			const top = F.kind === 'boot' ? (F.tall ? cut.knee - 0.05 : cut.ankle + 0.09) : F.kind === 'trail' ? cut.ankle + 0.01 : cut.ankle - 0.02;
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
	return { top, outer: J ? Math.max(top, fitOff(J)) + 0.008 + puffy : 0, bottom: fitOff(B), shoes: F?.kind === 'chunky' ? 0.02 : F?.kind === 'boot' ? 0.014 : F?.kind === 'sandal' ? 0.004 : 0.012 };
}

// ---------- the cloth mesh ----------
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
	const flareTop = cut.hip - 0.06, flareLen = Math.max(0.2, flareTop - cut.ankle);
	const tuck = o.top?.tuck, K = new Float32Array(P.count);
	for (let i = 0; i < P.count; i++) {
		if (src[i] < 0) continue;
		const s = SL[i] % 10, y = P.getY(i);
		let k = s === 0 ? off.top : s === 1 ? off.outer : s === 2 ? off.bottom : off.shoes;
		if (s === 2) {
			if (tuck && y > cut.waist - 0.06) k = Math.max(k, off.top + 0.004);
			if (legFlare && y < flareTop && SL[i] >= 20) { const t = Math.min(1, (flareTop - y) / flareLen); k += legFlare * t * (0.6 + 0.4 * t); }
			if (B?.legs === 'skirt') k = 0.015 + Math.max(0, 0.6 - y) * 0.1;
		}
		if (s === 3 && o.shoes?.kind === 'chunky' && y < 0.04) k += 0.012;
		if (s === 3 && y > cut.ankle + 0.02) k = 0.003;
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
   k += (.5+.5*Math.sin(y*72+a*3.2))*compression*.008 + (1+Math.sin(a*9+y*4))*.004*nearHem;
   // A sleeve has ease, but a light shirt is not padded at the deltoid.
   if(s<2 && limb===1 && garment.kind!=='puffer')k*=.6+.4*Math.max(0,Math.min(1,(cut.shoulder-y)/.22));
   if(s<2 && limb===0) {
    const shoulder=Math.max(0,Math.min(1,(cut.neck-y)/.12));
    k *= .25+.75*shoulder;
    if(!garment.tuck && y<cut.chest && y>hem) {
     const zc=(cut.drapeFront+cut.drapeBack)/2, rx=Math.max(cut.waistX,cut.shoulderX*.9), rz=(cut.drapeFront-cut.drapeBack)/2;
     const ell=Math.hypot(x/rx,(z-zc)/rz), hang=Math.min(1,(cut.shoulder-.04-y)/.12);
     // (a ribbed waistband draws the hang back in to the hips)
     const band=isRibbed(garment)?Math.min(1,Math.max(0,(y-hem-.05)/.06)):1;
     if(ell>0 && ell<1) k+=Math.min(.1,(1-ell)*Math.max(rx,rz))*hang*band;
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
	const out = { pos: [], nor: [], col: [], si: [], sw: [], kit: [] };
	const colour = new THREE.Color();
	// (bone: a name, or a function of the height for a strap that runs down the body)
	const put = (geo, bone, c, gloss = 0, fab = 0) => {
		geo.computeVertexNormals();
		const g = geo.index ? geo.toNonIndexed() : geo;
		const pa = g.attributes.position, na = g.attributes.normal, bi = typeof bone === 'function' ? null : map[bone] ?? 0;
		colour.set(c);
		for (let i = 0; i < pa.count; i++) {
			out.pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); out.nor.push(na.getX(i), na.getY(i), na.getZ(i));
			out.col.push(colour.r, colour.g, colour.b); out.si.push(bi ?? map[bone(pa.getY(i))] ?? 0, 0, 0, 0); out.sw.push(1, 0, 0, 0); out.kit.push(gloss, fab, 0);
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
	// ---------- armour and combat gear (people/armor-looks.js) ----------
	// (armour steel: kit gloss 3, polished but lit by the sky the world has, propkit.js)
	const ARMOUR = 3, V3 = (x, y, z) => new THREE.Vector3(x, y, z), kH = cut.height / 1.7;
	const skinP = P0.p, nSkin = skinP ? Math.min(skinP.length, 13380 * 3) : 0;
	// the skin round a limb along its bone (sd: its side; kind: the body part, partOf), from t0
	// to t1 metres down the bone: the axis's point at the middle, the bone's way, how far out
	// (way: the limb's way when the bone's own is not it; over: reach over that garment there too,
	// 0 the top .. 2 the bottom)
	const limbGirth = (bone, kind, t0, t1, way = null, over = false) => {
		const bi = map[bone], h = heads[bi], dir = way || P0.rest.dirs[bi], sx = Math.sign(h?.x || 1), part = P0.part;
		if (!h || !dir || !part) return { o: h || V3(0, 0, 0), dir: dir || V3(0, -1, 0), r: 0.045 * kH };
		// (two passes: the flesh's own middle, which the bone runs near but not through, then how
		// far out it reaches from there)
		const pts = [], mid = V3(0, 0, 0);
		for (let i = 0, v = 0; i < nSkin; i += 3, v++) {
			if (part[v] !== kind || Math.sign(skinP[i]) !== sx) continue;
			const dx = skinP[i] - h.x, dy = skinP[i + 1] - h.y, dz = skinP[i + 2] - h.z, t = dx * dir.x + dy * dir.y + dz * dir.z;
			if (t < t0 || t > t1) continue;
			const px = dx - dir.x * t, py = dy - dir.y * t, pz = dz - dir.z * t;
			pts.push(px, py, pz); mid.x += px; mid.y += py; mid.z += pz;
		}
		const n = pts.length / 3;
		if (!n) return { o: h.clone().addScaledVector(dir, (t0 + t1) / 2), dir, r: 0.045 * kH };
		mid.multiplyScalar(1 / n);
		let r = 0;
		for (let i = 0; i < pts.length; i += 3) r = Math.max(r, Math.hypot(pts[i] - mid.x, pts[i + 1] - mid.y, pts[i + 2] - mid.z));
		const cp = over !== false && P0.cloth?.attributes.position, sl = P0.cloth?.attributes.slot, near = r * 1.4 + 0.02, skinR = r;
		if (cp && sl) for (let i = 0; i < cp.count; i++) {
			const x = cp.getX(i); if (Math.sign(x) !== sx || sl.getX(i) % 10 !== over) continue;
			const dx = x - h.x, dy = cp.getY(i) - h.y, dz = cp.getZ(i) - h.z, t = dx * dir.x + dy * dir.y + dz * dir.z;
			if (t < t0 || t > t1) continue;
			const d = Math.hypot(dx - dir.x * t - mid.x, dy - dir.y * t - mid.y, dz - dir.z * t - mid.z);
			if (d < near) r = Math.max(r, d);
		}
		return { o: h.clone().addScaledVector(dir, (t0 + t1) / 2).add(mid), dir, r, skinR };
	};
	// a band round a limb (cover: how much of the way round, centred on the outside), its
	// axis along the bone
	// (mid: where round the cover is centred, 0 the front; the outside when not given)
	const limbBand = (g0, h, r0, r1, cover, sx, bone, c, gloss = ARMOUR, along = 0, mid = sx > 0 ? Math.PI / 2 : -Math.PI / 2) => {
		const g = new THREE.CylinderGeometry(r1, r0, h, 18, 1, true, mid - cover / 2, cover);
		g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), g0.dir));
		const at = g0.o.clone().addScaledVector(g0.dir, along); g.translate(at.x, at.y, at.z);
		put(g, bone, c, gloss);
	};
	// a glove made to the hand: the hand's own skin a few millimetres proud, bound to the bones
	// as the skin is so it bends with every finger, up the forearm `cuff` metres past the wrist
	// (knuckle: { col, gloss, rise }, a guard over the knuckles, the shell raised and coloured there)
	const gloveShell = (sd, proud, cuff, c, gloss = 0, fab = 0, knuckle = null) => {
		const part = P0.part, faces = A.body, wi = map['wrist.' + sd], w = heads[wi], fore = P0.rest.dirs[map['lowerarm01.' + sd]];
		if (!part || !faces || !w || !fore) return false;
		const sx = Math.sign(w.x) || 1;
		const keep = (v) => {
			if (v * 3 >= nSkin || Math.sign(skinP[v * 3]) !== sx) return false;
			if (part[v] === 3) return true;
			if (part[v] !== 2) return false;
			const t = (w.x - skinP[v * 3]) * fore.x + (w.y - skinP[v * 3 + 1]) * fore.y + (w.z - skinP[v * 3 + 2]) * fore.z;
			return t < cuff;
		};
		const tris = [], nor = new Map(), ctr = V3(0, 0, 0), a = V3(0, 0, 0), b = V3(0, 0, 0), e = V3(0, 0, 0);
		for (let i = 0; i < faces.length; i += 6) {
			const t = [faces[i], faces[i + 2], faces[i + 4]];
			if (!t.every(keep)) continue;
			tris.push(t);
			a.set(skinP[t[1] * 3] - skinP[t[0] * 3], skinP[t[1] * 3 + 1] - skinP[t[0] * 3 + 1], skinP[t[1] * 3 + 2] - skinP[t[0] * 3 + 2]);
			b.set(skinP[t[2] * 3] - skinP[t[0] * 3], skinP[t[2] * 3 + 1] - skinP[t[0] * 3 + 1], skinP[t[2] * 3 + 2] - skinP[t[0] * 3 + 2]);
			e.crossVectors(a, b);
			for (const v of t) { if (!nor.has(v)) { nor.set(v, V3(0, 0, 0)); ctr.x += skinP[v * 3]; ctr.y += skinP[v * 3 + 1]; ctr.z += skinP[v * 3 + 2]; } nor.get(v).add(e); }
		}
		if (!tris.length) return false;
		ctr.multiplyScalar(1 / nor.size);
		// (the body's winding, read from the shell itself: its normals point away from its middle)
		let out1 = 0; for (const [v, n] of nor) out1 += n.x * (skinP[v * 3] - ctr.x) + n.y * (skinP[v * 3 + 1] - ctr.y) + n.z * (skinP[v * 3 + 2] - ctr.z);
		const flip = out1 < 0 ? -1 : 1;
		for (const n of nor.values()) n.normalize().multiplyScalar(flip);
		// (the knuckles: midway between the first finger's and the little finger's, on the back of
		// the hand, which faces out from the body in the rest pose)
		let K = null, nb = null;
		const k2 = heads[map['finger2-1.' + sd]], k5 = heads[map['finger5-1.' + sd]];
		if (knuckle && k2 && k5) {
			K = k2.clone().add(k5).multiplyScalar(0.5);
			nb = V3(0, 0, 0).crossVectors(P0.rest.dirs[wi], k5.clone().sub(k2)).normalize(); if (nb.x * sx < 0) nb.negate();
		}
		const kc = new THREE.Color(knuckle?.col || c), base = new THREE.Color(c);
		for (const t of flip > 0 ? tris : tris.map((q) => [q[0], q[2], q[1]])) for (const v of t) {
			const n = nor.get(v);
			let k = 0;
			if (K) {
				const d = Math.hypot(skinP[v * 3] - K.x, skinP[v * 3 + 1] - K.y, skinP[v * 3 + 2] - K.z);
				k = Math.max(0, 1 - d / (knuckle?.reach || 0.034)) * Math.max(0, Math.min(1, (n.dot(nb) - 0.2) / 0.4));
				k = k > 0.25 ? Math.min(1, k * 1.6) : 0;
			}
			const lift = proud + k * (knuckle?.rise || 0);
			colour.copy(base).lerp(kc, k > 0 ? 1 : 0);
			out.pos.push(skinP[v * 3] + n.x * lift, skinP[v * 3 + 1] + n.y * lift, skinP[v * 3 + 2] + n.z * lift); out.nor.push(n.x, n.y, n.z);
			out.col.push(colour.r, colour.g, colour.b); out.kit.push(k > 0 && knuckle?.gloss != null ? knuckle.gloss : gloss, k > 0 && knuckle?.gloss === ARMOUR ? 0 : fab, 0);
			let sum = 0; for (let q = 0; q < 4; q++) sum += A.weights[v * 4 + q];
			for (let q = 0; q < 4; q++) { out.si.push(A.ids[v * 4 + q]); out.sw.push(A.weights[v * 4 + q] / (sum || 1)); }
		}
		return true;
	};
	// ---------- plate made to the body ----------
	// Plate as a smooth shell round an axis (a bone, the torso, the head): the body and what is
	// worn over it measured in rings along the axis (seg sectors round each), each ring's reach
	// smoothed into broad curves that never sink under the clothes, then stood off by the wall.
	// Its edges are rings and the borders of cover(t, θ, p) (θ 0 at ref, the front; p the point
	// on the curve), so they run clean; lift(t, θ, p) gives { lift, seam, tone } for lames,
	// ridges and slits; edge(d) how far a point d rows in from an edge stands out (a rolled rim,
	// a padded bag's rounded border); paint(t, θ, p) a colour in place of col (camouflage, a
	// device on a tabard). closeA/closeB: the first or last metres drawn in to a dome. bone(t, θ):
	// the bone a ring rides, or [[bone, weight], ...] for cloth shared between two. Made of cloth
	// (fab) or steel (gloss 3, dulled and stained with use). floor(t, θ): a reach it never sinks
	// under (the rad of what it is worn over, on the same axis). Returns the finished surface,
	// at(t, θ, off) → { p, n, bone }, for what is fixed on it (pouches, a buckle), and rad(t, θ),
	// how far out it stands; or null.
	const PT = V3(0, 0, 0), STAINC = new THREE.Color('#3b2b20');
	const fitTube = ({ o, axis, t0, t1, dt = 0.016, seg = 32, arc = null, span = null, floor = null, skin, cloth = null, wall = 0.008, cover = null, lift = null, bone, closeA = 0, closeB = 0, smooth = 12, give = 0.008, rim = 0.0035, edge = null, wear = 0.38, rimCol = null, col, paint = null, stain = null, fab = 0, gloss = ARMOUR, ref = V3(0, 0, 1), minR = 0.02, draw = true }) => {
		const a = axis.clone().normalize(), f = ref.clone().projectOnPlane(a);
		if (f.lengthSq() < 1e-6) f.set(1, 0, 0).projectOnPlane(a);
		f.normalize();
		const sv = V3(0, 0, 0).crossVectors(a, f), ns = Math.max(2, Math.round((t1 - t0) / dt)) + 1, step = (t1 - t0) / (ns - 1);
		if (P0.lo) seg = Math.max(16, seg >> 1);
		const R = new Float32Array(ns * seg), got = new Uint8Array(ns * seg);
		const take = (x, y, z) => {
			const dx = x - o.x, dy = y - o.y, dz = z - o.z, t = dx * a.x + dy * a.y + dz * a.z;
			if (t < t0 - step || t > t1 + step) return;
			const i = Math.max(0, Math.min(ns - 1, Math.round((t - t0) / step)));
			const px = dx - a.x * t, py = dy - a.y * t, pz = dz - a.z * t, r = Math.hypot(px, py, pz);
			const th = Math.atan2(px * sv.x + py * sv.y + pz * sv.z, px * f.x + py * f.y + pz * f.z);
			const j = ((Math.round(th / (Math.PI * 2) * seg) % seg) + seg) % seg, k = i * seg + j;
			if (r > R[k]) R[k] = r; got[k] = 1;
		};
		for (let i = 0, v = 0; i < nSkin; i += 3, v++) if (skin(v, skinP[i], skinP[i + 1], skinP[i + 2])) take(skinP[i], skinP[i + 1], skinP[i + 2]);
		const cp = P0.cloth?.attributes.position, sl = P0.cloth?.attributes.slot;
		if (cloth && cp && sl) for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), s = sl.getX(i); if (cloth(x, y, z, s % 10, Math.floor(s / 10 + 0.01))) take(x, y, z); }
		// (empty sectors: from their ring's nearest; an empty ring: from the ring beside it)
		for (let i = 0; i < ns; i++) {
			if (![...got.subarray(i * seg, i * seg + seg)].some(Boolean)) continue;
			for (let j = 0; j < seg; j++) {
				const k = i * seg + j; if (got[k]) continue;
				for (let d = 1; d < seg; d++) { const l = i * seg + ((j - d + seg) % seg), r = i * seg + ((j + d) % seg); if (got[l] || got[r]) { R[k] = Math.max(got[l] ? R[l] : 0, got[r] ? R[r] : 0); break; } }
			}
			for (let j = 0; j < seg; j++) got[i * seg + j] = 1;
		}
		for (let pass = 0; pass < 2; pass++) for (let i0 = 0; i0 < ns; i0++) {
			const i = pass ? ns - 1 - i0 : i0, n = pass ? i + 1 : i - 1;
			if (got[i * seg] || n < 0 || n >= ns || !got[n * seg]) continue;
			for (let j = 0; j < seg; j++) { R[i * seg + j] = R[n * seg + j]; got[i * seg + j] = 1; }
		}
		for (let k = 0; k < R.length; k++) R[k] = Math.max(R[k], minR);
		const raw = R.slice(), S = R.slice();
		for (let it = 0; it < smooth; it++) for (let i = 0; i < ns; i++) for (let j = 0; j < seg; j++) {
			const k = i * seg + j, l = i * seg + ((j + seg - 1) % seg), r = i * seg + ((j + 1) % seg);
			let s = S[l] + S[r] + S[k] * 2, w = 4;
			if (i > 0) { s += S[k - seg]; w++; } if (i < ns - 1) { s += S[k + seg]; w++; }
			// (a fold of cloth may stand a little proud of the curve: the wall covers it)
			S[k] = Math.max(raw[k] - give, s / w);
		}
		// (the domed ends)
		const domed = (t, r) => {
			if (closeA && t < t0 + closeA) { const u = (t0 + closeA - t) / closeA; return r * Math.sqrt(Math.max(0, 1 - u * u)); }
			if (closeB && t > t1 - closeB) { const u = (t - (t1 - closeB)) / closeB; return r * Math.sqrt(Math.max(0, 1 - u * u)); }
			return r;
		};
		// (the smoothed reach anywhere on the grid; a domed end takes it from where the dome starts)
		const reach = (t, th) => {
			const tc = Math.min(t1 - closeB, Math.max(t0 + closeA, t)), fi = Math.max(0, Math.min(ns - 1, (tc - t0) / step)), i = Math.min(ns - 2, Math.floor(fi)), u = fi - i;
			const fj = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * seg, j = Math.floor(fj) % seg, w = fj - Math.floor(fj), j1 = (j + 1) % seg;
			const r = (S[i * seg + j] * (1 - w) + S[i * seg + j1] * w) * (1 - u) + (S[(i + 1) * seg + j] * (1 - w) + S[(i + 1) * seg + j1] * w) * u;
			return domed(t, r);
		};
		// arc: only the sectors between two angles; span(θ): the rows run between two places
		// along the axis that differ round it (a helmet's rim cut high over the ears), so the
		// edges follow the cut and do not step
		const W = seg + 1, NV = ns * W;
		const thOf = (j) => (arc ? arc[0] + ((arc[1] - arc[0]) * j) / seg : (j / seg) * Math.PI * 2 - (j / seg > 0.5 ? Math.PI * 2 : 0));
		const tOf = (i, j) => { if (!span) return t0 + i * step; const [A, Bt] = span(thOf(j)); return A + ((Bt - A) * i) / (ns - 1); };
		const dirAt = (th, d) => { const c = Math.cos(th), s = Math.sin(th); return d.set(f.x * c + sv.x * s, f.y * c + sv.y * s, f.z * c + sv.z * s); };
		const D3 = V3(0, 0, 0);
		// (a point on the curve, stood off by the wall, and out by h more)
		const point = (t, th, h = 0, to = V3(0, 0, 0)) => { const r = reach(t, th), rr = r > 1e-4 ? Math.max(r, floor ? floor(t, th) : 0) + wall + h : 0; dirAt(th, D3); return to.set(o.x + a.x * t + D3.x * rr, o.y + a.y * t + D3.y * rr, o.z + a.z * t + D3.z * rr); };
		// (which quads are kept, and so how far each point lies in from an edge)
		const onV = new Uint8Array(NV);
		for (let i = 0; i < ns; i++) for (let j = 0; j <= seg; j++) { const t = tOf(i, j), th = thOf(j % W); onV[i * W + j] = !cover || cover(t, th, point(t, th, 0, PT)) ? 1 : 0; }
		const quad = (i, j) => i >= 0 && i < ns - 1 && j >= 0 && j < seg && onV[i * W + j] && onV[(i + 1) * W + j] && onV[i * W + j + 1] && onV[(i + 1) * W + j + 1];
		const D = new Uint8Array(NV).fill(255), Q = [];
		const wrapQ = (i, j) => quad(i, arc ? j : (j + seg) % seg);
		for (let i = 0; i < ns; i++) for (let j = 0; j <= seg; j++) {
			const inner = wrapQ(i, j) && wrapQ(i - 1, j) && wrapQ(i, j - 1) && wrapQ(i - 1, j - 1);
			if (!inner && !(i === 0 && closeA) && !(i === ns - 1 && closeB)) { D[i * W + j] = 0; Q.push(i * W + j); }
		}
		for (let h = 0; h < Q.length; h++) {
			const k = Q[h], i = Math.floor(k / W), j = k % W, d = D[k] + 1; if (d > 6) continue;
			for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const ii = i + di; let jj = j + dj; if (ii < 0 || ii >= ns) continue;
				if (arc) { if (jj < 0 || jj > seg) continue; } else if (jj < 0) jj = seg - 1; else if (jj > seg) jj = 1;
				const kk = ii * W + jj; if (D[kk] > d) { D[kk] = d; Q.push(kk); if (!arc && (jj === 0 || jj === seg)) { const tw = ii * W + (jj ? 0 : seg); if (D[tw] > d) { D[tw] = d; Q.push(tw); } } }
			}
		}
		const steel = stain ?? gloss === ARMOUR, baseC = new THREE.Color(col), wornC = rimCol ? new THREE.Color(rimCol) : null;
		const V = new Float32Array(NV * 3), Cc = new Float32Array(NV * 3), B = [], tint = new THREE.Color(), seamC = new THREE.Color('#141517');
		for (let i = 0; i < ns; i++) for (let j = 0; j <= seg; j++) {
			const k = i * W + j, t = tOf(i, j), th = thOf(j), p = point(t, th);
			const L = lift ? lift(t, th, p) : null, d = D[k];
			const e = edge ? edge(d) : d === 0 ? rim : 0;
			point(t, th, (L?.lift || 0) + e, D3);
			V[k * 3] = D3.x; V[k * 3 + 1] = D3.y; V[k * 3 + 2] = D3.z;
			tint.copy((paint && paint(t, th, p)) || baseC);
			if (d === 0) { if (wornC) tint.copy(wornC); else if (steel) tint.lerp(new THREE.Color('#c8ccd2'), wear); }
			if (steel) {
				// (use: the steel dulled and stained in patches, rust brown in the worst of them,
				// a little darker toward its lower edge)
				const X = V[k * 3], Y = V[k * 3 + 1], Z = V[k * 3 + 2];
				const s1 = Math.sin(X * 23 + Y * 7) * Math.sin(Y * 19 - Z * 11) * Math.sin(Z * 17 + X * 13), s2 = Math.sin(X * 41 - Z * 29) * Math.sin(Y * 37 + X * 17);
				tint.multiplyScalar(0.84 + 0.16 * s1 * s1 + 0.08 * (i / Math.max(1, ns - 1)) * (a.y > 0.5 ? 1 : 0));
				if (s2 > 0.55 && d > 0) tint.lerp(STAINC, (s2 - 0.55) * 0.9);
			}
			if (L?.seam) tint.lerp(seamC, Math.min(1, L.seam));
			if (L?.tone) tint.multiplyScalar(L.tone);
			Cc[k * 3] = tint.r; Cc[k * 3 + 1] = tint.g; Cc[k * 3 + 2] = tint.b;
			const b = bone(t, th);
			B.push(typeof b === 'string' ? [[map[b] ?? 0, 1]] : b.map(([n, w]) => [map[n] ?? 0, w]));
		}
		// the finished surface, for what is fixed on it
		const surf = (t, th, to) => point(t, th, lift ? lift(t, th, point(t, th))?.lift || 0 : 0, to);
		const at = (t, th, off = 0) => {
			const p = surf(t, th, V3(0, 0, 0)), dT = surf(t + 0.004, th, V3(0, 0, 0)).sub(surf(t - 0.004, th, V3(0, 0, 0))), dS = surf(t, th + 0.02, V3(0, 0, 0)).sub(surf(t, th - 0.02, V3(0, 0, 0)));
			const n = V3(0, 0, 0).crossVectors(dT, dS).normalize();
			if (n.dot(dirAt(th, V3(0, 0, 0))) < 0) n.negate();
			return { p: p.addScaledVector(n, off), n, bone: bone(t, th) };
		};
		// (how far out the finished surface stands, for what is worn over it: floor)
		const rad = (t, th) => (t < t0 || t > t1 ? 0 : Math.max(reach(t, th), floor ? floor(t, th) : 0) + wall + (lift ? lift(t, th, point(t, th))?.lift || 0 : 0));
		if (!draw) return { at, rad };
		const I = [];
		for (let i = 0; i < ns - 1; i++) for (let j = 0; j < seg; j++) if (quad(i, j)) { const p = i * W + j, q = p + W; I.push(p, p + 1, q, p + 1, q + 1, q); }
		if (!I.length) return null;
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals();
		const na = g.attributes.normal;
		for (const k of I) {
			out.pos.push(V[k * 3], V[k * 3 + 1], V[k * 3 + 2]); out.nor.push(na.getX(k), na.getY(k), na.getZ(k)); out.col.push(Cc[k * 3], Cc[k * 3 + 1], Cc[k * 3 + 2]);
			const b = B[k]; let sum = 0; for (const [, w] of b) sum += w;
			for (let q = 0; q < 4; q++) { out.si.push(b[q]?.[0] ?? 0); out.sw.push(b[q] ? b[q][1] / (sum || 1) : 0); }
			out.kit.push(gloss, fab, 0);
		}
		g.dispose();
		return { at, rad };
	};
	// the angle round an axis (as fitTube measures it) that faces the way w does
	const thetaOf = (axis, w, ref = V3(0, 0, 1)) => { const a = axis.clone().normalize(), f = ref.clone().projectOnPlane(a).normalize(), s = V3(0, 0, 0).crossVectors(a, f); return Math.atan2(w.dot(s), w.dot(f)); };
	const angGap = (x, y) => Math.abs(((x - y + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
	// how far along a bone the skin point v lies
	const alongBone = (v, from, to) => { const d = to.clone().sub(from), L = d.length(); return ((skinP[v * 3] - from.x) * d.x + (skinP[v * 3 + 1] - from.y) * d.y + (skinP[v * 3 + 2] - from.z) * d.z) / (L || 1); };
	// laminated plate along a run (t: how far along, in metres): each lame a step out over the
	// next (up: the first lame outermost), swelling toward its free edge, which is worn bright,
	// and a dark seam where one ends
	const lames = (t, width, step = 0.0045, up = true, saw = 0.0025) => {
		const k = Math.floor(t / width), f = t / width - k, free = up ? f : 1 - f;
		return { lift: Math.max(0, up ? 3 - k : k) * step + saw * free * free, seam: f > 0.88 ? (f - 0.88) / 0.12 : f < 0.05 ? 1 - f / 0.05 : 0, tone: free > 0.66 && free < 0.86 ? 1.22 : 1 };
	};
	// a headset: a cup over each ear and a boom mic to the mouth (band: over the top, for a cap)
	// a headset: a cup over each ear (a rounded shell, its outer cap stood proud), a boom mic to
	// the mouth with its windscreen; on a cap a band over the top, on a helmet an arm up to each
	// rail (on: the helmet's shell and where its rim lies)
	const headset = (col, band, on = null) => {
		const dark = new THREE.Color(col).multiplyScalar(0.7).getHex();
		for (const s of [-1, 1]) {
			const x = cx + s * (rx + 0.03), y = eyeY - 0.034, z = cz - 0.006;
			const cup = new RoundedBoxGeometry(0.032, 0.076, 0.062, 3, 0.015); cup.translate(x, y, z); put(cup, 'head', col, 0.25, 3);
			const cap = new RoundedBoxGeometry(0.01, 0.052, 0.042, 2, 0.006); cap.translate(x + s * 0.018, y + 0.004, z - 0.002); put(cap, 'head', dark, 0.3);
			const knob = new THREE.CylinderGeometry(0.007, 0.007, 0.01, 10); knob.rotateZ(Math.PI / 2); knob.translate(x + s * 0.026, y - 0.02, z + 0.016); put(knob, 'head', '#141413', 0.4);
			if (on) {
				const S = on.shell.at(on.tAt(s * Math.PI / 2, 0.019), s * Math.PI / 2, 0.006);
				const arm = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(x + s * 0.004, y + 0.04, z), V3((x + S.p.x) / 2 + s * 0.006, (y + 0.04 + S.p.y) / 2, z), S.p]), 6, 0.0045, 6, false);
				put(arm, 'head', '#1c1d1a', 0.3);
			}
		}
		const boom = new THREE.CatmullRomCurve3([V3(cx + rx + 0.036, eyeY - 0.055, cz + 0.022), V3(cx + rx * 0.88, eyeY - 0.098, cz + rz * 0.62), V3(cx + 0.032, eyeY - 0.106, sk.z1 + 0.016)]);
		put(new THREE.TubeGeometry(boom, 10, 0.0032, 6, false), 'head', '#1a1b19', 0.3);
		const mic = new THREE.SphereGeometry(0.009, 10, 8); mic.scale(1.3, 1, 1); mic.translate(cx + 0.024, eyeY - 0.106, sk.z1 + 0.018); put(mic, 'head', '#1a1a18', 0, 4);
		if (band) { const b = new THREE.TorusGeometry(1, 0.03, 5, 20, Math.PI); b.scale(rx + 0.034, top - eyeY + 0.07, 0.3); b.translate(cx, eyeY - 0.03, cz - 0.01); put(b, 'head', col, 0.3); }
	};
	// a steel helm of the old kingdoms: a kettle hat with its wide brim, or a great helm closed
	// to the chin with a slit to see by
	const steelHelm = (q, c) => {
		if (q.form === 'kettle') {
			const rim = eyeY + 0.045;
			put(dome(top + 0.03 - rim, 0.03), 'head', c, ARMOUR);
			const brim = new THREE.LatheGeometry([new THREE.Vector2(1.0, rim + 0.002), new THREE.Vector2(1.62, rim - 0.03)], 24);
			brim.scale(rx + 0.03, 1, rz + 0.03); brim.translate(cx, 0, cz); put(brim, 'head', c, ARMOUR);
			const comb = new THREE.BoxGeometry(0.008, 0.02, (rz + 0.03) * 1.7); comb.translate(cx, top + 0.035, cz); put(comb, 'head', c, ARMOUR);
			return;
		}
		closeHelm(q, c);
	};
	// a vertex-coloured piece: colourAt(x, y, z) gives each point its colour (bone: as put)
	const putShade = (geo, bone, colourAt, gloss = ARMOUR, fab = 0) => {
		geo.computeVertexNormals();
		const g = geo.index ? geo.toNonIndexed() : geo, pa = g.attributes.position, na = g.attributes.normal;
		for (let i = 0; i < pa.count; i++) {
			const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), cc = colourAt(x, y, z);
			out.pos.push(x, y, z); out.nor.push(na.getX(i), na.getY(i), na.getZ(i)); out.col.push(cc.r, cc.g, cc.b);
			out.si.push(typeof bone === 'function' ? map[bone(y)] ?? 0 : map[bone] ?? 0, 0, 0, 0); out.sw.push(1, 0, 0, 0); out.kit.push(gloss, fab, 0);
		}
	};
	// camouflage printed on kit (a scheme from combat/outfits.js), laid in the body's own metres:
	// soft blotches of its three colours over the base, the darkest in small broken shapes
	const hash3 = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
	const vn3 = (x, y, z) => {
		const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
		const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz), L = (a, b, t) => a + (b - a) * t;
		const h = (a, b, c) => hash3(ix + a, iy + b, iz + c);
		return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
	};
	const camoPaint = (name, base = null) => {
		const P = (CAMO[name] || CAMO.multicam).map((h) => new THREE.Color(h)), B0 = base ? new THREE.Color(base) : P[0];
		return (x, y, z) => {
			const n1 = vn3(x * 15 + 3.1, y * 10, z * 15) * 0.7 + vn3(x * 43, y * 31, z * 43) * 0.3;
			const n2 = vn3(z * 13 + 7.7, y * 9 + 1.3, x * 13) * 0.75 + vn3(x * 51 + 2, y * 47, z * 51) * 0.25;
			const n3 = vn3(x * 26 + 11.3, y * 21, z * 26 + 5.1);
			let c = B0;
			if (n1 > 0.56) c = P[1];
			if (n2 > 0.6) c = P[2];
			if (n3 > 0.69) c = P[3];
			return c;
		};
	};
	// rings joined into a tube: [{ y, rx, rz, x, z }] top to bottom
	const ringTube = (rings, seg = 32) => {
		const V = [], I = [];
		for (const R of rings) for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; V.push(R.x + Math.sin(a) * R.rx, R.y, R.z + Math.cos(a) * R.rz); }
		for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < seg; i++) { const p = r * (seg + 1) + i, q = p + seg + 1; I.push(p, q, p + 1, p + 1, q, q + 1); }
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I);
		return g;
	};
	// a closed knight's helm, the kind the old kingdoms' knights fought in: an egg of steel shut to
	// the chin, its visor drawn to a blunt prow with a narrow sight above it and breaths cut low on
	// one cheek, a comb along the crown, and a gorget of two lames from the chin to the collar
	function closeHelm(q, c) {
		const base = new THREE.Color(c), worn = base.clone().lerp(new THREE.Color('#c8ccd2'), 0.35);
		const yo = eyeY - 0.135, cy = eyeY - 0.004, Ry = top + 0.03 - cy;
		// made to the head (fitTube): its broad smoothing draws the nose and brow out into the
		// visor's prow; the sight a dark slit with a lip over it, breaths on the right cheek, the
		// visor's hinge line, a comb from brow to nape, the rim flared over the gorget
		const R = (x, z) => Math.hypot(x - cx, z - cz);
		fitTube({
			o: V3(cx, yo, cz), axis: V3(0, 1, 0), t0: 0, t1: top + 0.022 - yo, dt: 0.01, seg: 48, col: c, wall: 0.017, smooth: 16, give: 0.012, closeB: 0.045, rim: 0.003,
			skin: (v, x, y, z) => P0.part[v] === 0 && y > yo - 0.01 && R(x, z) < 0.16,
			lift: (t, th) => {
				const y = yo + t, f = Math.abs(th), front = f < 1.2;
				let lift = 0.016 * Math.exp(-((th / 0.42) ** 2)) * Math.max(0, Math.min(1, (eyeY + 0.01 - y) / 0.03)) + (t < 0.02 ? (0.02 - t) * 0.5 : 0);
				lift += 0.006 * (Math.exp(-((th / 0.07) ** 2)) + Math.exp(-(((f - Math.PI) / 0.07) ** 2))) * Math.max(0, Math.min(1, (y - eyeY - 0.04) / 0.02));
				if (front && y > eyeY - 0.006 && y < eyeY + 0.01) return { lift: lift - 0.006, seam: 1, tone: 0.5 };
				if (front && y >= eyeY + 0.01 && y < eyeY + 0.024) lift += 0.004;
				const breath = th < -0.35 && th > -1.05 && y > eyeY - 0.085 && y < eyeY - 0.035 && Math.sin(th * 46) > 0.35;
				const hinge = f < 1.7 && Math.abs(y - (eyeY + 0.03)) < 0.0025;
				return { lift, seam: breath ? 1 : hinge ? 0.75 : 0, tone: 0.9 + 0.14 * Math.max(0, (y - cy) / Ry) };
			},
			bone: () => 'head',
		});
		// the gorget, its upper lame round the throat and the lower over the collar
		let n = 0, nx = 0, nz = 0, rn = 0;
		for (let i = 0, v = 0; i < nSkin; i += 3, v++) if (P0.part?.[v] === 0 && skinP[i + 1] > cut.neck + 0.01 && skinP[i + 1] < cut.neck + 0.06 && Math.abs(skinP[i]) < 0.09) { nx += skinP[i]; nz += skinP[i + 2]; n++; }
		if (n) { nx /= n; nz /= n; for (let i = 0, v = 0; i < nSkin; i += 3, v++) if (P0.part?.[v] === 0 && skinP[i + 1] > cut.neck + 0.01 && skinP[i + 1] < cut.neck + 0.06 && Math.abs(skinP[i]) < 0.09) rn = Math.max(rn, Math.hypot(skinP[i] - nx, skinP[i + 2] - nz)); }
		rn = rn || 0.06; const tz = (cut.frontZ + cut.backZ) / 2, dz = (cut.frontZ - cut.backZ) / 2;
		const gor = ringTube([
			{ y: yo + 0.02, rx: rn + 0.024, rz: rn + 0.028, x: nx, z: nz },
			{ y: cut.neck + 0.012, rx: rn + 0.022, rz: rn + 0.026, x: nx, z: nz },
			{ y: cut.neck - 0.012, rx: rn + 0.038, rz: rn + 0.042, x: nx, z: (nz + tz) / 2 },
			{ y: cut.neck - 0.02, rx: rn + 0.046, rz: rn + 0.05, x: 0, z: (nz + tz) / 2 },
			{ y: cut.neck - 0.062, rx: rn + 0.068, rz: Math.min(dz * 0.92, rn + 0.07), x: 0, z: tz },
		], P0.lo ? 20 : 32);
		putShade(gor, (y) => (y > cut.neck - 0.005 ? 'head' : 'spine01'), (x, y) => (Math.abs(y - (cut.neck - 0.014)) < 0.004 ? worn : y < cut.neck - 0.056 ? worn : base));
	}
	for (const q of o.acc || []) {
		const c = q.col || '#333333', a2 = q.acc || c;
		if (q.kind === 'helmet' && q.form) { steelHelm(q, c); continue; }
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
				// a high-cut combat helmet made to the head (fitTube): the shell stood off the skull
				// on its pads, its brow above the eyebrows, cut high over the ears and down to the
				// nape behind, a rubber trim round the edge; rails along the sides, loop patches on
				// the crown, a shroud at the brow; night vision (dual tubes, stowed up on their mount)
				// with a battery pack behind and its cable over the crown, a strobe; a headset on
				// the rails
				const yo = eyeY - 0.05, tTop = top + 0.038 - yo, rail = '#2a2b27';
				const knots = [[0, 0.04], [0.7, 0.036], [1.1, 0.026], [1.35, 0.048], [1.95, 0.046], [2.4, 0.004], [Math.PI, -0.026]];
				const rimY = (th) => {
					const f = Math.min(Math.PI, Math.abs(th)); let k = 1; while (k < knots.length - 1 && knots[k][0] < f) k++;
					const [a0, y0] = knots[k - 1], [a1, y1] = knots[k], u = Math.max(0, Math.min(1, (f - a0) / (a1 - a0)));
					return eyeY + y0 + (y1 - y0) * u * u * (3 - 2 * u);
				};
				const side = (th) => Math.min(Math.abs(Math.abs(th) - Math.PI / 2), 9);
				const R = (x, z) => Math.hypot(x - cx, z - cz);
				const shell = fitTube({
					o: V3(cx, yo, cz), axis: V3(0, 1, 0), t0: 0, t1: tTop, dt: 0.008, seg: 64, wall: 0.03, smooth: 18, give: 0.006, closeB: 0.065,
					span: (th) => [rimY(th) - yo, tTop], col: c, gloss: 0.14, fab: 3, stain: false,
					skin: (v, x, y, z) => P0.part[v] === 0 && y > yo - 0.01 && R(x, z) < 0.16,
					edge: (d) => (d === 0 ? 0.0045 : d === 1 ? 0.002 : 0), rimCol: '#262622',
					lift: (t, th) => {
						const h = yo + t - rimY(th);
						// (the rails, one along each side above the cut)
						if (side(th) < 0.95 && h > 0.008 && h < 0.03) return { lift: 0.0055, tone: 1 };
						return null;
					},
					paint: (t, th) => {
						const h = yo + t - rimY(th);
						if (side(th) < 0.95 && h > 0.008 && h < 0.03) return new THREE.Color(rail);
						// (loop patches on the crown and the back)
						if ((Math.abs(th) < 0.42 && h > 0.06 && h < 0.1) || (Math.abs(Math.abs(th) - Math.PI) < 0.5 && h > 0.05 && h < 0.09)) return new THREE.Color(c).multiplyScalar(0.8);
						return null;
					},
					bone: () => 'head',
				});
				if (shell) {
					const mount = (geo, S, up = V3(0, 1, 0)) => { const z = S.n.clone(), y = up.clone().projectOnPlane(z).normalize(), x = V3(0, 0, 0).crossVectors(y, z); geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(S.p)); return geo; };
					const tAt = (th, h) => rimY(th) + h - yo;
					// (the shroud at the brow)
					const shroudS = shell.at(tAt(0, 0.022), 0);
					put(mount(new RoundedBoxGeometry(0.05, 0.034, 0.012, 2, 0.004).translate(0, 0, 0.005), shroudS), 'head', '#1f201d', 0.3);
					if (q.nvg) {
						// the night vision turned up: an arm from the shroud, a bridge, two tubes
						// looking up and out, the lenses, the eyecups; its battery pack behind
						const P = shroudS.p.clone().addScaledVector(shroudS.n, 0.012), dark = '#1d1e1b';
						const arm = new RoundedBoxGeometry(0.024, 0.036, 0.016, 2, 0.004); arm.rotateX(-0.35); arm.translate(P.x, P.y + 0.014, P.z + 0.01); put(arm, 'head', dark, 0.3);
						const bridge = new RoundedBoxGeometry(0.084, 0.024, 0.03, 2, 0.008); bridge.rotateX(-0.3); bridge.translate(P.x, P.y + 0.034, P.z + 0.03); put(bridge, 'head', dark, 0.3);
						for (const s of [-1, 1]) {
							const T = (g, k) => { g.rotateX(-0.22); g.translate(P.x + s * 0.03, P.y + 0.034 + k * 0.975, P.z + 0.034 - k * 0.22); return g; };
							put(T(new THREE.CylinderGeometry(0.0145, 0.0155, 0.058, 16), 0.034), 'head', '#232521', 0.4);
							put(T(new THREE.CylinderGeometry(0.017, 0.0165, 0.012, 16), -0.004), 'head', '#141413', 0.1, 3);
							put(T(new THREE.CylinderGeometry(0.0125, 0.0125, 0.003, 16), 0.0635), 'head', '#2e5444', 1);
						}
						const bp = shell.at(tAt(Math.PI, 0.05), Math.PI);
						put(mount(new RoundedBoxGeometry(0.085, 0.05, 0.026, 2, 0.008).translate(0, 0, 0.012), bp), 'head', q.pack || '#2c2d29', 0.15, 3);
						// (its cable from the pack over the crown to the mount)
						const pts = [bp.p.clone().addScaledVector(bp.n, 0.014).add(V3(0, 0.026, 0))];
						for (const [th, k] of [[Math.PI, 0.55], [Math.PI, 0.8], [0, 0.9], [0, 0.7], [0, 0.45]]) pts.push(shell.at(tAt(th, 0) + (tTop - tAt(th, 0)) * k, th, 0.004).p);
						pts.push(P.clone().add(V3(0, 0.02, -0.004)));
						put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0028, 5, false), 'head', '#161614', 0.2);
						const strobe = shell.at(tTop * 0.86, Math.PI * 0.82);
						put(mount(new RoundedBoxGeometry(0.03, 0.03, 0.018, 2, 0.005).translate(0, 0, 0.009), strobe), 'head', '#1b1c1a', 0.3);
					}
					if (q.comms) headset('#2b2d2a', false, { shell, tAt });
				}
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
		} else if (q.kind === 'gloves' && P0.part && A.body) {
			// gloves made to the hands (gloveShell): a gauntlet in steel with a flared cuff and a
			// ridge over the knuckles; bracers, a long laced cuff over a thin glove; a combat
			// glove with a hard knuckle guard and a strap at the wrist
			for (const s of ['L', 'R']) {
				const steel = !!q.steel, wb = 'wrist.' + s, sx = Math.sign(heads[map[wb]]?.x || (s === 'L' ? 1 : -1));
				// (over the knuckles: a steel ridge, or a combat glove's moulded guard)
				// (a gauntlet: a glove of dark leather, the back of the hand and the knuckles in steel)
				const kn = steel ? null : q.knuckle ? { col: q.acc || c, gloss: 0.3, rise: 0.005 } : null;
				gloveShell(s, steel ? 0.0045 : 0.0032, steel ? 0.03 : q.bracers ? 0.012 : 0.02, steel ? q.leather || '#2b211a' : c, steel ? 0.2 : 0, 3, kn);
				const len = heads[map[wb]].distanceTo(heads[map['lowerarm01.' + s]]);
				const g0 = limbGirth('lowerarm01.' + s, 2, len - 0.13, len - 0.02);
				if (steel) {
					// (the vambrace closed round the forearm, its cuff flaring over the gauntlet, and a
					// couter cupping the elbow)
					const E = heads[map['lowerarm01.' + s]], Wr = heads[map[wb]], af = Wr.clone().sub(E).normalize(), back = thetaOf(af, V3(0, 0, -1));
					const mine = (x) => Math.sign(x) === sx;
					fitTube({
						o: E, axis: af, t0: 0.05, t1: len - 0.01, col: c, wall: 0.008, seg: 28,
						skin: (v, x) => P0.part[v] === 2 && mine(x), cloth: (x, y, z, slot, limb) => limb === 1 && mine(x),
						lift: (t) => ({ lift: t > len - 0.06 ? (t - len + 0.06) * 0.25 : 0, seam: Math.abs(t - (len - 0.06)) < 0.003 ? 0.8 : 0 }),
						bone: () => 'lowerarm01.' + s,
					});
					// (the back of the hand in lames of steel from the wrist to the knuckles)
					const k2 = heads[map['finger2-1.' + s]], k5 = heads[map['finger5-1.' + s]];
					if (k2 && k5) {
						const K = k2.clone().add(k5).multiplyScalar(0.5), ah = K.clone().sub(Wr), lh = ah.length(), hb = thetaOf(ah, V3(sx, 0, 0));
						// (not the thumb: the skin the thumb's bones carry)
						const thumb = new Set(['finger1-1.', 'finger1-2.', 'finger1-3.', 'metacarpal1.'].map((n) => map[n + s]));
						const onThumb = (v) => { let w = 0; for (let k = 0; k < 4; k++) if (thumb.has(A.ids[v * 4 + k])) w += A.weights[v * 4 + k]; return w > 0.25; };
						fitTube({
							o: Wr, axis: ah, t0: 0.005, t1: lh + 0.014, dt: 0.006, col: c, wall: 0.006, seg: 32, smooth: 8, give: 0.004,
							skin: (v, x) => P0.part[v] === 3 && mine(x) && alongBone(v, Wr, K) < lh + 0.02 && !onThumb(v),
							cover: (t, th) => angGap(th, hb) < 1.2,
							lift: (t) => lames(t, 0.02, 0.0012, true, 0.0025),
							bone: () => wb,
						});
					}
					fitTube({
						o: E, axis: af, t0: -0.06, t1: 0.06, col: c, wall: 0.014, seg: 28,
						skin: (v, x) => (P0.part[v] === 1 || P0.part[v] === 2) && mine(x), cloth: (x, y, z, slot, limb) => limb === 1 && mine(x),
						cover: (t, th) => angGap(th, back) < 1.5,
						lift: (t, th) => ({ lift: 0.012 * Math.max(0, 1 - (t / 0.06) ** 2) * Math.max(0, Math.cos(angGap(th, back))) }),
						bone: () => 'lowerarm01.' + s,
					});
				} else if (q.bracers) {
					const g1 = limbGirth('lowerarm01.' + s, 2, len * 0.35, len - 0.02);
					limbBand(g1, len * 0.62, g1.r + 0.008, g1.r + 0.016, Math.PI * 2, sx, 'lowerarm01.' + s, c, 0, 0);
					for (const k of [-0.32, 0, 0.32]) limbBand(g1, 0.008, g1.r + 0.017, g1.r + 0.017, Math.PI * 2, sx, 'lowerarm01.' + s, q.acc || c, 0, k * len * 0.6);
				} else limbBand(g0, 0.035, g0.r + 0.006, g0.r + 0.008, Math.PI * 2, sx, 'lowerarm01.' + s, q.acc || c, 0, 0.05);
			}
		} else if (q.kind === 'gloves' || q.kind === 'mitt') {
			for (const s of q.kind === 'mitt' ? ['L'] : ['L', 'R']) {
				const wi = map['wrist.' + s], w = heads[wi], dir = P0.rest.dirs[wi];
				const big = q.kind === 'mitt' ? 1.35 : 1.1;
				const box = new THREE.BoxGeometry(0.085 * big, 0.2 * big, 0.045 * big, 1, 2, 1);
				box.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
				const cen = w.clone().addScaledVector(dir, 0.085 * big);
				box.translate(cen.x, cen.y, cen.z);
				put(box, 'wrist.' + s, c, 0);
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
		if (q.kind === 'bandana') {
			// over the nose and mouth, a point hanging at the throat, knotted behind
			const y0 = eyeY - 0.035, y1 = cut.neck - 0.02, h = y0 - y1;
			const g = new THREE.CylinderGeometry(1, 1.25, h, 14, 2, true, -1.75, 3.5);
			g.scale(rx + 0.014, 1, rz + 0.02); g.translate(cx, (y0 + y1) / 2, cz + 0.006);
			put(g, 'head', c);
			const tip = new THREE.ConeGeometry(0.05, 0.07, 3); tip.rotateX(Math.PI); tip.scale(1.4, 1, 0.35); tip.translate(cx, y1 - 0.03, sk.z1 + 0.02);
			put(tip, 'head', c);
			const knot = new THREE.SphereGeometry(0.018, 6, 5); knot.translate(cx, y0 - 0.01, sk.z0 - 0.004); put(knot, 'head', a2);
		} else if (q.kind === 'carrier' && !q.police && P0.part) {
			// a plate carrier made to the body (fitTube), or a chest rig (q.rig): padded plate bags
			// front and back with the swimmer's cut at the top corners and rows of webbing, a
			// cummerbund round the sides, straps over the shoulders. On the front a shingle of
			// three magazine pouches with the magazines in them, an admin pouch above with a loop
			// patch, a dangler pouch below the plate; a radio on the left with its antenna and the
			// cable up to the talk switch on the strap, a medical pouch on the right, a tourniquet;
			// a zip-on panel and a drag handle behind. A chest rig: four magazine pouches on a
			// panel, its harness and a strap round the waist. In camouflage where it is printed
			const part = P0.part, tz = (cut.frontZ + cut.backZ) / 2, armpit = cut.chest - 0.02, inArm = (x) => Math.abs(x) > cut.shoulderX * 0.78;
			const yPB = cut.waist + (q.rig ? 0.03 : 0.005), yPT = Math.min(cut.chest + 0.12, cut.neck - 0.045), yo = yPB - 0.08, O = V3(0, yo, tz), UP = V3(0, 1, 0);
			const hw = Math.min(0.13, cut.shoulderX * 0.64), thF = Math.atan2(hw, (cut.frontZ - tz) * 0.92), thB = Math.atan2(hw, (tz - cut.backZ) * 0.92);
			const skinT = (v, x, y) => part[v] === 0 && y > yo - 0.03 && y < yPT + 0.04 && !(y > armpit && inArm(x));
			const clothT = (x, y, z, slot, limb) => limb !== 1 && y > yo - 0.03 && y < yPT + 0.04 && !(y > armpit && inArm(x));
			const bodyBone = (t) => torso(yo + t), sm = (e0, e1, x) => { const u = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
			const pcol = q.camo ? camoPaint(q.camo) : null, pouchCol = q.camo ? camoPaint(q.camo, a2) : null;
			// (rows of webbing to hang pouches on, a stitched bar tack at each column)
			const molle = (y0) => (t, th, p) => {
				const u = (yo + t - y0) / 0.038; if (u < 0) return null;
				const f = u - Math.floor(u); if (f > 0.66) return null;
				return { lift: 0.0022, tone: Math.abs(((p.x / 0.038) % 1 + 1) % 1 - 0.5) > 0.44 ? 0.72 : 0.9 };
			};
			const bag = (d) => -0.02 * Math.max(0, 1 - d / 3) ** 2;
			const kit = (geo, bone, col, gloss = 0.05, fab = 2) => (q.camo && typeof col !== 'string' ? putShade(geo, bone, col, gloss, fab) : put(geo, bone, typeof col === 'string' ? col : c, gloss, fab));
			const solid = (k) => (q.camo ? k : null);
			const tie = (geo, S) => { const z = S.n.clone(), y = UP.clone().projectOnPlane(z).normalize(), x = V3(0, 0, 0).crossVectors(y, z); return geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(S.p)); };
			// (a pouch, its back on the surface at S: the body, a flap or the magazine in it)
			const magPouch = (S, bone, w = 0.066, h = 0.11, d = 0.036) => {
				kit(tie(new RoundedBoxGeometry(w, h, d, 2, 0.007).translate(0, -h / 2, d / 2), S), bone, solid(pouchCol) || a2);
				// (the magazine, narrow across and deep, its top showing; the bungee over it to a
				// pull tab hanging on the front)
				const mag = new RoundedBoxGeometry(0.028, 0.056, d * 0.78, 2, 0.004).translate(0, 0.004, d / 2);
				put(tie(mag, S), bone, q.mags || '#2a2b28', 0.25, 3);
				put(tie(new THREE.BoxGeometry(0.0035, 0.0035, d * 0.9).translate(0, 0.034, d / 2), S), bone, '#141413', 0, 0);
				put(tie(new RoundedBoxGeometry(0.014, 0.02, 0.004, 1, 0.0015).translate(0, 0.024, d + 0.002), S), bone, '#1d1d1b', 0.1, 3);
				put(tie(new THREE.BoxGeometry(w * 1.02, 0.008, 0.003).translate(0, -h * 0.55, d + 0.0012), S), bone, '#1d1d1b', 0, 2);
			};
			const frontAt = (tube, y, x, off = 0) => tube.at(y - yo, Math.atan2(x, Math.max(0.05, tube.rad(y - yo, 0) - 0.01)), off);
			let front = null, back = null;
			if (!q.rig) {
				front = fitTube({
					o: O, axis: UP, t0: yPB - 0.01 - yo, t1: yPT - yo, dt: 0.008, arc: [-thF, thF], seg: 26, wall: 0.03, smooth: 90, give: 0.03,
					span: (th) => { const f = Math.abs(th) / thF; return [yPB - yo + 0.014 * sm(0.7, 1, f), yPT - yo - 0.07 * sm(0.38, 1, f)]; },
					col: c, paint: pcol, gloss: 0.05, fab: 2, stain: false, edge: bag, skin: skinT, cloth: clothT, lift: molle(yPB + 0.01), bone: bodyBone,
				});
				back = fitTube({
					o: O, axis: UP, t0: yPB - 0.01 - yo, t1: yPT - yo + 0.02, dt: 0.008, arc: [Math.PI - thB, Math.PI + thB], seg: 26, wall: 0.028, smooth: 90, give: 0.03,
					span: (th) => { const f = Math.abs(th - Math.PI) / thB; return [yPB - yo + 0.014 * sm(0.7, 1, f), yPT - yo + 0.02 - 0.06 * sm(0.42, 1, f)]; },
					col: c, paint: pcol, gloss: 0.05, fab: 2, stain: false, edge: bag, skin: skinT, cloth: clothT, lift: molle(yPB + 0.01), bone: bodyBone,
				});
				// (the cummerbund, each side from under the front plate round to under the back)
				for (const sd of [1, -1]) {
					const A = sd * thF * 0.8, Bt = sd * (Math.PI - thB * 0.8);
					fitTube({
						o: O, axis: UP, t0: yPB - 0.012 - yo, t1: yPB + 0.15 - yo, dt: 0.008, arc: sd > 0 ? [A, Bt] : [Bt, A], seg: 28, wall: 0.017, smooth: 14, give: 0.012,
						col: c, paint: pcol, gloss: 0.05, fab: 2, stain: false, edge: (d) => -0.008 * Math.max(0, 1 - d / 2), skin: skinT, cloth: clothT, lift: molle(yPB), bone: bodyBone,
					});
				}
			} else {
				// (a chest rig's panel)
				front = fitTube({
					o: O, axis: UP, t0: yPB - 0.04 - yo, t1: yPB + 0.15 - yo, dt: 0.008, arc: [-thF * 1.05, thF * 1.05], seg: 28, wall: 0.02, smooth: 14, give: 0.012,
					col: c, paint: pcol, gloss: 0.05, fab: 2, stain: false, edge: (d) => -0.01 * Math.max(0, 1 - d / 3) ** 2, skin: skinT, cloth: clothT, bone: bodyBone,
				});
				// (the strap round the waist)
				fitTube({
					o: O, axis: UP, t0: yPB - 0.04 - yo, t1: yPB - 0.012 - yo, dt: 0.007, seg: 40, wall: 0.012, skin: skinT, cloth: clothT,
					col: '#262621', gloss: 0.05, fab: 2, stain: false, edge: () => 0, bone: bodyBone,
				});
			}
			// (the straps over the shoulders, from the old cut: garment-kit.js)
			for (const { geo, part: pc } of carrierGeometry(cut, kitField(), { lo: !!P0.lo })) if (pc === 'strap') kit(geo, 'spine01', solid(pcol) || c);
			if (front) {
				const fb = (y) => torso(y);
				if (!q.rig) {
					// the shingle of magazine pouches
					const yTopM = yPB + 0.122;
					for (const i of [-1, 0, 1]) magPouch(frontAt(front, yTopM, i * 0.071, 0.002), fb(yTopM - 0.05));
					// the admin pouch, its loop patch and its zip
					const yA = Math.min(yPT - 0.07, yPB + 0.225), A0 = frontAt(front, yA, 0, 0.002);
					kit(tie(new RoundedBoxGeometry(0.17, 0.09, 0.022, 2, 0.006).translate(0, 0, 0.011), A0), fb(yA), solid(pouchCol) || a2);
					put(tie(new RoundedBoxGeometry(0.08, 0.048, 0.004, 1, 0.002).translate(-0.03, 0.006, 0.0225), A0), fb(yA), new THREE.Color(a2).multiplyScalar(0.72).getHex(), 0, 3);
					put(tie(new THREE.BoxGeometry(0.15, 0.004, 0.004).translate(0, 0.041, 0.019), A0), fb(yA), '#151513', 0.3);
					put(tie(new RoundedBoxGeometry(0.01, 0.02, 0.004, 1, 0.0015).translate(0.06, 0.03, 0.023), A0), fb(yA), '#1a1a18', 0.3);
					// the dangler under the plate
					const probe = fitTube({ o: O, axis: UP, t0: yo - 0.08 - yo, t1: yPB - yo + 0.02, dt: 0.01, seg: 32, wall: 0.03, skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && y > yo - 0.1 && y < yPB + 0.05, cloth: (x, y, z, slot, limb) => limb !== 1 && y > yo - 0.1 && y < yPB + 0.05, col: c, draw: false, bone: bodyBone });
					const Dn = probe.at(yPB - 0.046 - yo, 0, 0.004);
					kit(tie(new RoundedBoxGeometry(0.2, 0.08, 0.044, 3, 0.016).translate(0, 0, 0.022), Dn), torso(yPB), solid(pouchCol) || a2);
					put(tie(new THREE.BoxGeometry(0.17, 0.004, 0.004).translate(0, 0.034, 0.042), Dn), torso(yPB), '#151513', 0.3);
				} else {
					const yTopM = yPB + 0.13;
					for (const i of [-1.5, -0.5, 0.5, 1.5]) magPouch(frontAt(front, yTopM, i * 0.066, 0.002), fb(yTopM - 0.05), 0.062, 0.12, 0.034);
				}
				// the radio on the left, its antenna, the cable up to the talk switch on the strap
				const sideAt = (y, th, off) => (q.rig ? front.at(y - yo, th, off) : null);
				const rTh = Math.PI / 2 + 0.2, rY = yPB + 0.075;
				const probeS = fitTube({ o: O, axis: UP, t0: yo - yo, t1: yPT - yo, dt: 0.012, seg: 40, wall: q.rig ? 0.012 : 0.02, skin: skinT, cloth: clothT, col: c, draw: false, bone: bodyBone });
				const Rr = sideAt(rY, rTh, 0) || probeS.at(rY - yo, rTh, 0.002);
				kit(tie(new RoundedBoxGeometry(0.066, 0.12, 0.04, 2, 0.007).translate(0, 0, 0.02), Rr), torso(rY), solid(pouchCol) || a2);
				const radio = tie(new RoundedBoxGeometry(0.056, 0.035, 0.03, 2, 0.005).translate(0, 0.07, 0.02), Rr); put(radio, torso(rY), '#232421', 0.3, 3);
				const top0 = V3(0, 0.09, 0.024).applyMatrix4(new THREE.Matrix4().makeBasis(V3(0, 0, 0).crossVectors(UP.clone().projectOnPlane(Rr.n).normalize(), Rr.n), UP.clone().projectOnPlane(Rr.n).normalize(), Rr.n).setPosition(Rr.p));
				const ant = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top0, top0.clone().add(V3(0.004, 0.09, -0.012)), top0.clone().add(V3(0.006, 0.19, -0.04))]), 8, 0.0035, 6, false);
				put(ant, torso(rY), '#161614', 0.2);
				const ptt = front.at(Math.min(yPT - 0.06, yPB + 0.2) - yo, thF * 0.82, q.rig ? 0.02 : 0.004);
				put(tie(new RoundedBoxGeometry(0.034, 0.04, 0.018, 2, 0.006).translate(0, 0, 0.009), ptt), torso(ptt.p.y), '#1b1c1a', 0.3);
				const mid = probeS.at(yPB + 0.16 - yo, (rTh + thF) / 2, 0.012).p;
				put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top0.clone().add(V3(-0.01, -0.012, 0.004)), mid, ptt.p.clone().addScaledVector(ptt.n, 0.008).add(V3(0, -0.02, 0))]), 16, 0.003, 5, false), 'spine02', '#141413', 0.2);
				// the medical pouch on the right, its red pull tab; a tourniquet on the front
				const mTh = -(Math.PI / 2 + 0.2), Mr = sideAt(rY, mTh, 0) || probeS.at(rY - yo, mTh, 0.002);
				kit(tie(new RoundedBoxGeometry(0.095, 0.11, 0.05, 3, 0.012).translate(0, 0, 0.025), Mr), torso(rY), solid(pouchCol) || a2);
				put(tie(new RoundedBoxGeometry(0.03, 0.026, 0.005, 1, 0.002).translate(0, 0.06, 0.03), Mr), torso(rY), '#8a2a22', 0.1, 3);
				const tq = probeS.at(yPB + 0.075 - yo, -(thF + 0.32), q.rig ? 0.01 : 0.022);
				const tqG = new THREE.CylinderGeometry(0.013, 0.013, 0.1, 10); put(tie(tqG.translate(0, 0, 0.012), tq), torso(tq.p.y), '#121212', 0.2, 2);
				put(tie(new RoundedBoxGeometry(0.02, 0.016, 0.006, 1, 0.002).translate(0, 0.055, 0.016), tq), torso(tq.p.y), '#9a2b22', 0.1, 3);
			}
			if (back) {
				// the zip-on panel and the drag handle
				const yM = (yPB + yPT) / 2, Bk = back.at(yM - yo, Math.PI, 0.002);
				kit(tie(new RoundedBoxGeometry(hw * 1.75, (yPT - yPB) * 0.8, 0.034, 3, 0.014).translate(0, -0.01, 0.017), Bk), torso(yM), solid(pouchCol) || a2);
				put(tie(new THREE.BoxGeometry(0.004, (yPT - yPB) * 0.72, 0.004).translate(hw * 0.84, -0.01, 0.03), Bk), torso(yM), '#151513', 0.3);
				put(tie(new THREE.BoxGeometry(0.004, (yPT - yPB) * 0.72, 0.004).translate(-hw * 0.84, -0.01, 0.03), Bk), torso(yM), '#151513', 0.3);
				const Hd = back.at(yPT - 0.01 - yo, Math.PI, 0.004), hd = new THREE.TorusGeometry(0.03, 0.007, 5, 10, Math.PI);
				put(tie(hd.scale(1, 0.9, 1.6).translate(0, 0.004, 0.004), Hd), 'spine01', '#22231f', 0.1, 2);
			}
		} else if (q.kind === 'carrier') {
			// front and back plates made to the chest and back, a cummerbund round the waist,
			// straps over the shoulders, pouches on the plate (a police vest: a radio, a badge
			// and a reflective band) (garment-kit.js)
			const pieces = carrierGeometry(cut, kitField(), { police: !!q.police, lo: !!P0.lo });
			const flap = new THREE.Color(a2).multiplyScalar(0.82).getHex();
			// (a chest rig: the pouches on their harness, no plates and no cummerbund)
			for (const { geo, part: pc } of pieces) if (!(q.rig && (pc === 'plate' || pc === 'tape' || pc === 'band'))) put(geo, pc === 'strap' ? 'spine01' : torso, pc === 'band' || pc === 'pouch' ? a2 : pc === 'flap' ? flap : pc === 'tape' ? '#80868d' : c, pc === 'tape' ? 0.5 : 0, pc === 'tape' ? 0 : 2);
			if (q.police) {
				const w = Math.min(0.33, cut.shoulderX * 1.6), y = cut.chest + 0.06, x = w * 0.26;
				const bd = new THREE.CylinderGeometry(0.02, 0.02, 0.005, 6); bd.rotateX(Math.PI / 2); bd.translate(x, y, kitField().front(x, y) + 0.012 + 0.024 + 0.002); put(bd, 'spine01', q.badge || '#d9c46a', 2);
			}
		} else if (q.kind === 'cuirass') {
			// a cuirass made to the body (fitTube): breast and back plate with a ridge down the breast,
			// cut away for the arms, the gorget over its top; below the waist a fauld of lames, each
			// stepping out over the one above; a pauldron domed over each shoulder, its lames lapping
			// down the arm; plate down the upper arm. Over it a tabard (q.tabard): a narrow panel down
			// the breast and back with the order's device on it, widening below the belt into a
			// skirt to the knee, its hem torn; a belt of dark leather with an iron buckle at the waist
			const part = P0.part, tz = (cut.frontZ + cut.backZ) / 2, armpit = cut.chest - 0.02, yTop = cut.neck - 0.035;
			const yo = cut.hip - 0.085, inArm = (x) => Math.abs(x) > cut.shoulderX * 0.78, fauld = cut.waist - 0.015;
			const bodySkin = (v, x, y) => (part[v] === 0 || (part[v] === 4 && y > yo)) && !(y > armpit && inArm(x));
			const bodyCloth = (x, y, z, slot, limb) => limb !== 1 && !(y > armpit && inArm(x)) && y > yo - 0.02;
			// (how far the plate stands out at each height: the ridge down the breast, the fauld's lames)
			const plate = (y, th) => {
				if (y < fauld) return lames(fauld - y, 0.042, 0.0065, false, 0.003);
				return { lift: Math.abs(th) < 0.5 ? 0.008 * Math.exp(-((th / 0.16) ** 2)) * Math.min(1, (y - cut.waist) / 0.08) : 0, tone: 0.92 + 0.12 * Math.cos(th) };
			};
			const plateT = fitTube({
				o: V3(0, yo, tz), axis: V3(0, 1, 0), t0: 0, t1: yTop - yo, seg: 40, col: c, wall: 0.009,
				skin: bodySkin, cloth: bodyCloth,
				cover: (t, th) => {
					const y = yo + t, f = Math.abs(th), side = Math.min(f, Math.PI - f);
					return !(y > armpit && side > 0.98);
				},
				lift: (t, th) => plate(yo + t, th),
				bone: (t) => torso(yo + t),
			});
			const legL = heads[map['upperleg01.L']], legR = heads[map['upperleg01.R']], knee = heads[map['lowerleg01.L']];
			let tabT = null;
			if (q.tabard && plateT && legL && legR && knee) {
				const cloth = new THREE.Color(q.tabard), trim = new THREE.Color(q.trim || '#8c7a4e'), yBot = knee.y + 0.07, yT = cut.chest + 0.07, sL = Math.sign(legL.x) || 1;
				const yc = cut.chest - 0.03;
				// (over the plate, hanging from the fauld and flaring a little below it; torn: the hem
				// ragged, a few deep rents)
				const hem = (th) => 0.03 * (0.5 + 0.5 * Math.sin(th * 23 + 1.3) * Math.sin(th * 9.7)) + (Math.sin(th * 5.3 + 0.4) > 0.9 ? 0.06 : 0);
				tabT = fitTube({
					o: V3(0, yBot, tz), axis: V3(0, 1, 0), t0: 0, t1: yT - yBot, dt: 0.01, seg: 72, smooth: 20, give: 0.02, wall: 0.004, floor: (t, th) => { const tp = t + yBot - yo; return plateT.rad(Math.max(0.001, tp), th) + Math.max(0, -tp) * 0.12; }, col: q.tabard, gloss: 0, fab: 2, stain: false, edge: () => 0, rimCol: cloth.clone().multiplyScalar(0.55),
					skin: (v, x, y) => bodySkin(v, x, y) || part[v] === 4, cloth: (x, y, z, slot, limb) => limb !== 1 && !(y > armpit && inArm(x)) && y > yBot - 0.02,
					cover: (t, th) => {
						const y = yBot + t, f = Math.abs(th), w = y > cut.waist ? 0.4 : 0.66;
						return (f < w || Math.PI - f < w) && t > hem(th);
					},
					paint: (t, th, p) => {
						if (Math.abs(th) > 0.6) return null;
						// the order's device, a sword point down: blade, guard, pommel
						const dx = Math.abs(p.x), dy = p.y - yc;
						if ((dx < 0.011 && dy > -0.1 && dy < 0.06) || (dx < 0.05 && Math.abs(dy - 0.045) < 0.009) || Math.hypot(dx, dy - 0.08) < 0.014) return trim;
						return null;
					},
					bone: (t, th) => {
						const y = yBot + t;
						if (y > cut.hip) return torso(y);
						// (below the hip the skirt goes with the thighs, each side with its own)
						const u = Math.min(1, (cut.hip - y) / 0.2), wl = Math.max(0, Math.min(1, 0.5 + Math.sin(th) * sL * 1.4));
						return [[torso(cut.hip), 1 - u * 0.85], ['upperleg01.L', u * 0.85 * wl], ['upperleg01.R', u * 0.85 * (1 - wl)]];
					},
				});
			}
			// (the belt, its buckle at the front)
			const belt = fitTube({
				o: V3(0, fauld - 0.03, tz), axis: V3(0, 1, 0), t0: 0, t1: 0.045, dt: 0.009, seg: 48, col: q.belt || '#2e2219', gloss: 0.25, fab: 3, stain: false, rim: 0.002, rimCol: '#1d1610',
				skin: bodySkin, cloth: bodyCloth, wall: 0.005,
				floor: (t, th) => Math.max(plateT ? plateT.rad(t + fauld - 0.03 - yo, th) : 0, tabT ? tabT.rad(t + fauld - 0.03 - (knee.y + 0.07), th) : 0),
				bone: (t) => torso(fauld - 0.03 + t),
			});
			if (belt) {
				const B0 = belt.at(0.0225, 0, 0.004), frame = new THREE.TorusGeometry(0.022, 0.0042, 4, 4);
				frame.rotateZ(Math.PI / 4); frame.scale(1, 1.15, 1);
				frame.lookAt(B0.n); frame.translate(B0.p.x, B0.p.y, B0.p.z); put(frame, B0.bone, '#3d3c39', ARMOUR);
				const tongue = new THREE.BoxGeometry(0.004, 0.03, 0.004); tongue.lookAt(B0.n); tongue.translate(B0.p.x, B0.p.y, B0.p.z); put(tongue, B0.bone, '#3d3c39', ARMOUR);
			}
			for (const sd of ['L', 'R']) {
				const ub = 'upperarm01.' + sd, S = heads[map[ub]], E = heads[map['lowerarm01.' + sd]]; if (!S || !E) continue;
				const sx = Math.sign(S.x) || 1, len = S.distanceTo(E), ax = E.clone().sub(S).normalize(), outside = thetaOf(ax, V3(sx, 0, 0));
				const mine = (x) => x * sx > Math.abs(S.x) * 0.55;
				// (the pauldron: a dome and lapping lames, a rolled ridge at its top edge)
				fitTube({
					o: S, axis: ax, t0: -0.075, t1: 0.15 * kH, col: c, wall: 0.016, closeA: 0.06, seg: 36,
					skin: (v, x) => (part[v] === 1 || part[v] === 0) && mine(x), cloth: (x, y, z, slot, limb) => mine(x) && limb !== 2,
					cover: (t, th) => angGap(th, outside) < 1.95, minR: 0.05, rim: 0.005,
					lift: (t, th) => (t > 0 ? lames(t, 0.042, 0.006, true, 0.003) : { lift: 3 * 0.006 + 0.003 * Math.max(0, Math.cos(angGap(th, outside) * 1.4)), tone: 0.95 + 0.1 * Math.cos(angGap(th, outside)) }),
					bone: () => ub,
				});
				// (the rerebrace)
				fitTube({
					o: S, axis: ax, t0: 0.15 * kH - 0.02, t1: len - 0.035, col: c, wall: 0.006, seg: 28,
					skin: (v, x) => part[v] === 1 && Math.sign(x) === sx, cloth: (x, y, z, slot, limb) => limb === 1 && Math.sign(x) === sx,
					lift: (t) => ({ seam: Math.abs(t - (len - 0.1)) < 0.003 ? 0.7 : 0 }),
					bone: () => ub,
				});
			}
		} else if (q.kind === 'greaves') {
			// plate made to the legs (fitTube): cuisses down the thighs with lames at the hip, a
			// poleyn swelling over each knee, greaves closed round the shins with a ridge down the shin
			const part = P0.part;
			for (const sd of ['L', 'R']) {
				const ub = 'upperleg01.' + sd, lb = 'lowerleg01.' + sd, U = heads[map[ub]], L = heads[map[lb]], F = heads[map['foot.' + sd]]; if (!U || !L || !F) continue;
				const sx = Math.sign(U.x) || 1, lu = U.distanceTo(L), ll = L.distanceTo(F), mine = (x) => Math.sign(x) === sx;
				const au = L.clone().sub(U).normalize(), al = F.clone().sub(L).normalize(), inner = thetaOf(au, V3(-sx, 0, 0));
				fitTube({
					o: U, axis: au, t0: 0.06, t1: lu - 0.03, col: c, wall: 0.01, seg: 32, give: 0.003,
					skin: (v, x) => part[v] === 4 && mine(x), cloth: (x, y, z, slot, limb) => limb === 2 && slot === 2 && mine(x),
					cover: (t, th) => t > 0.15 || angGap(th, inner) > 1.1,
					lift: (t) => (t < 0.15 ? lames(t, 0.045, 0.004, true, 0.003) : null),
					bone: () => ub,
				});
				fitTube({
					o: L, axis: al, t0: -0.055, t1: 0.05, col: c, wall: 0.012, seg: 32,
					skin: (v, x) => (part[v] === 4 || part[v] === 5) && mine(x), cloth: (x, y, z, slot, limb) => limb === 2 && mine(x),
					cover: (t, th) => Math.abs(th) < 1.45,
					lift: (t, th) => ({ lift: 0.012 * Math.max(0, 1 - (t / 0.055) ** 2) * Math.max(0, Math.cos(th)), seam: Math.abs(t - 0.022) < 0.004 ? 0.7 : 0 }),
					bone: () => lb,
				});
				fitTube({
					o: L, axis: al, t0: 0.055, t1: ll - 0.035, col: c, wall: 0.01, seg: 32, give: 0.003,
					skin: (v, x) => part[v] === 5 && mine(x), cloth: (x, y, z, slot, limb) => limb === 2 && slot === 2 && mine(x),
					lift: (t, th) => ({ lift: 0.004 * Math.exp(-((th / 0.2) ** 2)), tone: 0.92 + 0.1 * Math.cos(th) }),
					bone: () => lb,
				});
			}
		} else if (q.kind === 'kneepads' && P0.part) {
			// a hard pad over each knee made to it (fitTube): a padded sleeve front with a moulded
			// cap over the kneecap, strapped behind above and below the knee
			for (const sd of ['L', 'R']) {
				const lb = 'lowerleg01.' + sd, U = heads[map['upperleg01.' + sd]], L = heads[map[lb]], F = heads[map['foot.' + sd]]; if (!U || !L || !F) continue;
				const sx = Math.sign(U.x) || 1, mine = (x) => Math.sign(x) === sx, al = F.clone().sub(L).normalize();
				const skin = (v, x) => (P0.part[v] === 4 || P0.part[v] === 5) && mine(x), cloth = (x, y, z, slot, limb) => limb === 2 && mine(x);
				const capCol = new THREE.Color(c).multiplyScalar(0.62);
				fitTube({
					o: L, axis: al, t0: -0.07, t1: 0.075, dt: 0.007, arc: [-1.2, 1.2], seg: 26, wall: 0.016, smooth: 14, give: 0.006, col: c, gloss: 0.08, fab: 2, stain: false,
					span: (th) => { const f = Math.abs(th) / 1.2; return [-0.07 + 0.025 * f * f, 0.075 - 0.02 * f * f]; },
					edge: (d) => -0.01 * Math.max(0, 1 - d / 3) ** 2, skin, cloth,
					lift: (t, th) => { const e = (t / 0.05) ** 2 + (th / 0.75) ** 2; return e < 1 ? { lift: 0.009 * Math.sqrt(1 - e), tone: 1 } : null; },
					paint: (t, th) => ((t / 0.05) ** 2 + (th / 0.75) ** 2 < 1 ? capCol : null),
					bone: () => lb,
				});
				for (const [ta, tb] of [[-0.085, -0.066], [0.07, 0.089]]) fitTube({
					o: L, axis: al, t0: ta, t1: tb, dt: 0.006, seg: 32, wall: 0.006, smooth: 8, col: '#1f1f1c', gloss: 0.05, fab: 2, stain: false, edge: () => 0, skin, cloth, bone: () => lb,
				});
			}
		} else if (q.kind === 'sabatons') {
			// laminated steel over each foot and whatever is worn on it, its lames stepping down
			// across the instep to the toe
			for (const sd of ['L', 'R']) {
				const fi = map['foot.' + sd], A0 = heads[fi], dir = P0.rest.dirs[fi]; if (!A0 || !dir) continue;
				const sx = Math.sign(A0.x) || 1, fwd = V3(dir.x, 0, dir.z).normalize(), mine = (x) => Math.sign(x) === sx;
				fitTube({
					o: V3(A0.x, 0.02, A0.z), axis: fwd, t0: -0.05, t1: 0.22 * kH, col: c, wall: 0.008, seg: 28, ref: V3(0, 1, 0), closeB: 0.04,
					skin: (v, x, y) => P0.part[v] === 6 && mine(x) && y > 0.015, cloth: (x, y, z, slot) => slot === 3 && mine(x) && y > 0.015,
					cover: (t, th) => Math.abs(th) < 1.6, lift: (t) => lames(t + 0.05, 0.03, 0.0006, false, 0.0035),
					bone: () => 'foot.' + sd,
				});
			}
		} else if (q.kind === 'comms') {
			headset(c, true);
		} else if (q.kind === 'circlet') {
			const band = new THREE.CylinderGeometry(1, 1, 0.011, 32, 1, true); band.scale(rx + 0.013, 1, rz + 0.015); band.translate(cx, eyeY + 0.055, cz); put(band, 'head', c, 2);
			const gem = new THREE.OctahedronGeometry(0.011); gem.scale(1, 1.3, 0.6); gem.translate(cx, eyeY + 0.058, cz + rz + 0.017); put(gem, 'head', a2, 1);
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
	g.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(out.si), 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(out.sw), 4));
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
