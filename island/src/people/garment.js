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
import { patchKit, kitAtlas } from './propkit.js';
import { KIT_MODEL, kitModelsNow } from './kit-models.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CAMO } from '../combat/outfits.js';
import { tierNow } from '../world/governor.js';
import { GFX_PHONE } from '../world/device.js';

// (phone audit: a phone, or a low quality tier, keeps the clothes' own surface: the curved split
// that rounds the shoulders by up to 4 mm is for the folds, which a phone draws none of, and it
// quadrupled every body's upper garments and much of the garbage made as people stream in)
const PHONE = GFX_PHONE;
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
			// (a tall boot built over the foot, the heroes': to mid-calf; a riding boot's to the knee)
			const top = F.kind === 'boot' ? (F.tall ? (F.built ? cut.ankle + 0.17 : cut.knee - 0.05) : cut.ankle + 0.09) : F.kind === 'trail' ? cut.ankle + 0.01 : cut.ankle - 0.02;
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
	// (under a real boot model the shoe is only a sock, so it never shows through it)
	if (o.shoes?.combat && A.kit?.parts.boot) off.shoes = 0.003;
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
	const out = { pos: [], nor: [], col: [], si: [], sw: [], kit: [], wr: [], uvs: [], idx: [], sync: 0 };
	const colour = new THREE.Color();
	// (bone: a name, [[name, weight], ...] shared between bones, a function of the height giving
	// either, or { skin }: each point weighted as the skin nearest it is, for what must move with
	// the skin rather than ride one bone)
	const pushBone = (b, x, y, z) => {
		if (typeof b === 'string') { out.si.push(map[b] ?? 0, 0, 0, 0); out.sw.push(1, 0, 0, 0); return; }
		if (b?.skin) { const w = b.skin(x, y, z); out.si.push(...w.ids); out.sw.push(...w.w); return; }
		let sum = 0; for (const [, w] of b) sum += w;
		for (let q = 0; q < 4; q++) { out.si.push(map[b[q]?.[0]] ?? 0); out.sw.push(b[q] ? b[q][1] / (sum || 1) : 0); }
	};
	// (kept indexed: each piece's shared corners skinned once, not once a triangle; what is
	// written as loose triangles, three corners each, is indexed in its turn, in order)
	const flushLoose = () => { const n = out.pos.length / 3; for (let i = out.sync; i < n; i++) out.idx.push(i); out.sync = n; };
	const put = (geo, bone, c, gloss = 0, fab = 0) => {
		flushLoose();
		geo.computeVertexNormals();
		const pa = geo.attributes.position, na = geo.attributes.normal, wa = geo.attributes.wear, fn = typeof bone === 'function', base = out.pos.length / 3;
		if (geo.index) for (const k of geo.index.array) out.idx.push(base + k);
		else for (let i = 0; i < pa.count; i++) out.idx.push(base + i);
		colour.set(c);
		for (let i = 0; i < pa.count; i++) {
			const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
			out.pos.push(x, y, z); out.nor.push(na.getX(i), na.getY(i), na.getZ(i));
			out.col.push(colour.r, colour.g, colour.b); pushBone(fn ? bone(y) : bone, x, y, z); out.kit.push(gloss, fab, 0);
			out.wr.push(wa ? wa.getX(i) : 0, wa ? wa.getY(i) : 0);
		}
		out.sync = out.pos.length / 3;
	};
	// a real model (people/kit-models.js) fitted to this head: scaled from the reference head
	// to this one's width, depth and height over the eyes, about its middle at eye height;
	// its painted parts in col
	const putModel = (name, col) => {
		const K = A.kit, g = K?.parts[name];
		if (!g) return;
		const R = K.ref, sx = rx / R.rx, sy = (top - eyeY) / R.top, sz = rz / R.rz;
		// (kept indexed, as the model is: each corner once)
		flushLoose();
		const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ix = g.index, n = pa.count;
		const start = out.pos.length / 3, uv = new Float32Array(n * 2);
		colour.set(col);
		for (let i = 0; i < n; i++) {
			out.pos.push(cx + pa.getX(i) * sx, eyeY + pa.getY(i) * sy, cz + pa.getZ(i) * sz);
			const nx = na.getX(i) / sx, ny = na.getY(i) / sy, nz = na.getZ(i) / sz, l = Math.hypot(nx, ny, nz) || 1;
			out.nor.push(nx / l, ny / l, nz / l); out.col.push(colour.r, colour.g, colour.b);
			pushBone('head'); out.kit.push(KIT_MODEL, 0, 0); out.wr.push(0, 0);
			uv[i * 2] = ua.getX(i); uv[i * 2 + 1] = ua.getY(i);
		}
		if (ix) for (let k = 0; k < ix.count; k++) out.idx.push(start + ix.getX(k)); else for (let i = 0; i < n; i++) out.idx.push(start + i);
		out.sync = out.pos.length / 3;
		out.uvs.push([start, uv]);
	};
	// a piece of the carrier's kit as a real model (people/kit-models.js), laid on what it is
	// fixed to: M places its frame (its back on the surface, +z out, +y up), s scales it; its
	// painted parts in col, a colour or a colour by place (camouflage). False if not loaded
	const putPart = (name, M, bone, col, s = null) => {
		const g = A.kit?.parts[name];
		if (!g) return false;
		const T = s ? M.clone().multiply(new THREE.Matrix4().makeScale(s[0], s[1], s[2])) : M, Nm = new THREE.Matrix3().getNormalMatrix(T);
		// (kept indexed, as the model is: each corner once)
		flushLoose();
		const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ix = g.index, n = pa.count;
		const start = out.pos.length / 3, uv = new Float32Array(n * 2), v = new THREE.Vector3(), nv = new THREE.Vector3(), fn = typeof col === 'function';
		if (!fn) colour.set(col);
		for (let i = 0; i < n; i++) {
			v.fromBufferAttribute(pa, i).applyMatrix4(T); nv.fromBufferAttribute(na, i).applyMatrix3(Nm).normalize();
			const cc = fn ? col(v.x, v.y, v.z) : colour;
			out.pos.push(v.x, v.y, v.z); out.nor.push(nv.x, nv.y, nv.z); out.col.push(cc.r, cc.g, cc.b);
			pushBone(typeof bone === 'function' ? bone(v.y) : bone, v.x, v.y, v.z); out.kit.push(KIT_MODEL, 0, 0); out.wr.push(0, 0);
			uv[i * 2] = ua.getX(i); uv[i * 2 + 1] = ua.getY(i);
		}
		if (ix) for (let k = 0; k < ix.count; k++) out.idx.push(start + ix.getX(k)); else for (let i = 0; i < n; i++) out.idx.push(start + i);
		out.sync = out.pos.length / 3;
		out.uvs.push([start, uv]);
		return true;
	};
	// a section swept along a path: path [{ p, n, bone }] (n the way out, the normal of what it
	// lies on), prof [[across, out], ...] its outline, anticlockwise; a strap, a rolled edge, a
	// cable laid along what it is on, its ends capped unless the path closes on itself. wear:
	// how rubbed its outer face is (its polish, propkit.js)
	const sweep = (path, prof, col, gloss = 3, fab = 0, wear = 0, closed = false) => {
		const m = path.length, np = prof.length, C = new THREE.Color(col);
		if (m < 2) return;
		const fr = path.map((q, i) => {
			const a = path[closed ? (i - 1 + m) % m : Math.max(0, i - 1)].p, b = path[closed ? (i + 1) % m : Math.min(m - 1, i + 1)].p;
			const T = b.clone().sub(a).normalize(), N = q.n.clone().projectOnPlane(T).normalize();
			return { T, N, S: new THREE.Vector3().crossVectors(N, T) };
		});
		// (the outline's normals, each point's two sides averaged)
		const pn = prof.map((_, k) => { const a = prof[(k - 1 + np) % np], b = prof[(k + 1) % np], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
		const vtx = (i, k) => {
			const q = path[i % m], f = fr[i % m], [u, v] = prof[k % np], [nu, nv] = pn[k % np];
			return { p: [q.p.x + f.S.x * u + f.N.x * v, q.p.y + f.S.y * u + f.N.y * v, q.p.z + f.S.z * u + f.N.z * v], n: [f.S.x * nu + f.N.x * nv, f.S.y * nu + f.N.y * nv, f.S.z * nu + f.N.z * nv], b: q.bone, w: wear * Math.max(0, nv) };
		};
		const emitV = (V) => { out.pos.push(...V.p); out.nor.push(...V.n); out.col.push(C.r, C.g, C.b); pushBone(V.b); out.kit.push(gloss, fab, 0); out.wr.push(V.w, 0); };
		// (wound to face the way its normals do)
		const tri = (A, B, D) => {
			const e1 = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]], e2 = [D.p[0] - A.p[0], D.p[1] - A.p[1], D.p[2] - A.p[2]];
			const fx = e1[1] * e2[2] - e1[2] * e2[1], fy = e1[2] * e2[0] - e1[0] * e2[2], fz = e1[0] * e2[1] - e1[1] * e2[0];
			const s = fx * (A.n[0] + B.n[0] + D.n[0]) + fy * (A.n[1] + B.n[1] + D.n[1]) + fz * (A.n[2] + B.n[2] + D.n[2]);
			if (s >= 0) { emitV(A); emitV(B); emitV(D); } else { emitV(A); emitV(D); emitV(B); }
		};
		for (let i = 0; i < (closed ? m : m - 1); i++) for (let k = 0; k < np; k++) { const a = vtx(i, k), b = vtx(i, k + 1), c = vtx(i + 1, k + 1), d = vtx(i + 1, k); tri(a, b, c); tri(a, c, d); }
		if (!closed) for (const [i, sg] of [[0, -1], [m - 1, 1]]) {
			const f = fr[i], q = path[i], n = [f.T.x * sg, f.T.y * sg, f.T.z * sg], mid = { p: [q.p.x, q.p.y, q.p.z], n, b: q.bone, w: 0 };
			for (let k = 0; k < np; k++) { const a = vtx(i, k), b = vtx(i, k + 1); a.n = n; b.n = n; tri(mid, a, b); }
		}
	};
	// outlines for sweep: a round bead (r), and a flat strap (w wide, h thick, its corners eased)
	const roundProf = (r, n = 8) => Array.from({ length: n }, (_, k) => [Math.cos((k / n) * Math.PI * 2) * r, Math.sin((k / n) * Math.PI * 2) * r]);
	const strapProf = (w, h, base = 0) => [[-w / 2, base], [w / 2, base], [w / 2 + h * 0.15, base + h * 0.55], [w / 2 - h * 0.2, base + h], [-w / 2 + h * 0.2, base + h], [-w / 2 - h * 0.15, base + h * 0.55]];
	// a rivet or a boss on a surface (S from a fitTube's at()): a low dome, its head worn bright
	const rivet = (S, r = 0.0042, col = '#5d6066', h = 0.5, gloss = 3) => {
		const g = P0.lo ? new THREE.SphereGeometry(r, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
		g.scale(1, h, 1); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), S.n)); g.translate(S.p.x, S.p.y, S.p.z);
		g.setAttribute('wear', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2).map((_, i) => (i % 2 ? 0 : 0.8)), 2));
		put(g, S.bone, col, gloss);
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
	// ---------- armour and combat gear (people/armor-looks.js) ----------
	// (armour steel: kit gloss 3, polished but lit by the sky the world has, propkit.js)
	// (the other materials, propkit.js: painted shell, leather, nylon, rubber, lens glass, moulded
	// polymer, wool)
	const PAINT = 4, LEATHER = 5, NYLON = 6, RUBBER = 7, GLASS = 8, POLY = 9, WOOL = 10;
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
	// (knuckle: { col, gloss, rise }, a guard over the knuckles, the shell raised and coloured there;
	// real: a glove's table from the kit, { faces, uv, lift }: these faces of the body, not the
	// cuff's, the atlas at their corners, its detail baked, and how much further each corner
	// stands off where a gauntlet's plates are)
	const gloveShell = (sd, proud, cuff, c, gloss = 0, fab = 0, knuckle = null, plate = null, real = null) => {
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
		const tris = [], tn = [], nor = new Map(), ctr = V3(0, 0, 0), a = V3(0, 0, 0), b = V3(0, 0, 0), e = V3(0, 0, 0);
		const nf = real ? real.faces.length : faces.length / 6;
		for (let k = 0; k < nf; k++) {
			const i = (real ? real.faces[k] : k) * 6;
			const t = [faces[i], faces[i + 2], faces[i + 4]];
			if (real ? !t.every((v) => v * 3 < nSkin) : !t.every(keep)) continue;
			tris.push(t); tn.push(k);
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
		let K = null, nb = null, hd = null;
		const k2 = heads[map['finger2-1.' + sd]], k5 = heads[map['finger5-1.' + sd]];
		if ((knuckle || plate) && k2 && k5) {
			K = k2.clone().add(k5).multiplyScalar(0.5); hd = K.clone().sub(w).normalize();
			nb = V3(0, 0, 0).crossVectors(P0.rest.dirs[wi], k5.clone().sub(k2)).normalize(); if (nb.x * sx < 0) nb.negate();
		}
		// (a gauntlet: the back of the hand and of the fingers in steel, in lames across the hand,
		// each with a dark lap where it ends)
		const plC = plate ? new THREE.Color(plate.col) : null;
		const kc = new THREE.Color(knuckle?.col || c), base = new THREE.Color(c);
		// (the body's winding turned if need be; a real glove's atlas follows its corners)
		const ord = flip > 0 ? [0, 1, 2] : [0, 2, 1], start = out.pos.length / 3, kuv = real ? new Float32Array(tris.length * 6) : null;
		for (let ti = 0; ti < tris.length; ti++) for (let cn = 0; cn < 3; cn++) {
			const v = tris[ti][ord[cn]], n = nor.get(v);
			if (real) {
				const q = (tn[ti] * 3 + ord[cn]) * 2, o2 = (ti * 3 + cn) * 2;
				kuv[o2] = real.uv[q] / 65535; kuv[o2 + 1] = real.uv[q + 1] / 65535;
				const off = proud + (real.lift ? real.lift[q >> 1] * 0.00005 : 0);
				out.pos.push(skinP[v * 3] + n.x * off, skinP[v * 3 + 1] + n.y * off, skinP[v * 3 + 2] + n.z * off); out.nor.push(n.x, n.y, n.z);
				out.col.push(base.r, base.g, base.b); out.kit.push(KIT_MODEL, 0, 0); out.wr.push(0, 0);
				let sum = 0; for (let w4 = 0; w4 < 4; w4++) sum += A.weights[v * 4 + w4];
				for (let w4 = 0; w4 < 4; w4++) { out.si.push(A.ids[v * 4 + w4]); out.sw.push(A.weights[v * 4 + w4] / (sum || 1)); }
				continue;
			}
			let k = 0;
			if (K && knuckle) {
				const d = Math.hypot(skinP[v * 3] - K.x, skinP[v * 3 + 1] - K.y, skinP[v * 3 + 2] - K.z);
				k = Math.max(0, 1 - d / (knuckle?.reach || 0.034)) * Math.max(0, Math.min(1, (n.dot(nb) - 0.2) / 0.4));
				k = k > 0.25 ? Math.min(1, k * 1.6) : 0;
			}
			const pl = plC && nb && n.dot(nb) > 0.1 ? 1 : 0, sAlong = pl ? (skinP[v * 3] - w.x) * hd.x + (skinP[v * 3 + 1] - w.y) * hd.y + (skinP[v * 3 + 2] - w.z) * hd.z : 0;
			const lap = pl && sAlong > 0 && (sAlong / 0.017) % 1 > 0.84;
			const lift = proud + k * (knuckle?.rise || 0) + pl * 0.0016;
			colour.copy(base).lerp(kc, k > 0 ? 1 : 0);
			if (pl) colour.copy(plC).multiplyScalar(lap ? 0.45 : 1);
			out.pos.push(skinP[v * 3] + n.x * lift, skinP[v * 3 + 1] + n.y * lift, skinP[v * 3 + 2] + n.z * lift); out.nor.push(n.x, n.y, n.z);
			out.col.push(colour.r, colour.g, colour.b); out.kit.push(pl ? ARMOUR : k > 0 && knuckle?.gloss != null ? knuckle.gloss : gloss, pl || (k > 0 && knuckle?.gloss === ARMOUR) ? 0 : fab, 0); out.wr.push(pl ? (lap ? 0 : 0.35) : k > 0 ? 0.6 : 0, lap ? 0.5 : 0);
			let sum = 0; for (let q = 0; q < 4; q++) sum += A.weights[v * 4 + q];
			for (let q = 0; q < 4; q++) { out.si.push(A.ids[v * 4 + q]); out.sw.push(A.weights[v * 4 + q] / (sum || 1)); }
		}
		if (real) out.uvs.push([start, kuv]);
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
	const fitTube = ({ o, axis, t0, t1, dt = 0.016, seg = 32, arc = null, span = null, floor = null, thick = null, skin, cloth = null, wall = 0.008, cover = null, lift = null, bone, closeA = 0, closeB = 0, smooth = 12, give = 0.008, rim = 0.0035, edge = null, wear = 0.38, rimCol = null, col, paint = null, stain = null, fab = 0, gloss = ARMOUR, ref = V3(0, 0, 1), minR = 0.02, rows = 0, draw = true }) => {
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
		// edges follow the cut and do not step (rows: how many across it, when the span is much
		// narrower than t0..t1, a band of a fauld cut from a tall measure)
		const nr = span && rows ? Math.max(2, rows) : ns, W = seg + 1, NV = nr * W;
		const thOf = (j) => (arc ? arc[0] + ((arc[1] - arc[0]) * j) / seg : (j / seg) * Math.PI * 2 - (j / seg > 0.5 ? Math.PI * 2 : 0));
		const tOf = (i, j) => { if (!span) return t0 + i * step; const [A, Bt] = span(thOf(j)); return A + ((Bt - A) * i) / (nr - 1); };
		const dirAt = (th, d) => { const c = Math.cos(th), s = Math.sin(th); return d.set(f.x * c + sv.x * s, f.y * c + sv.y * s, f.z * c + sv.z * s); };
		const D3 = V3(0, 0, 0);
		// (a point on the curve, stood off by the wall, and out by h more)
		const point = (t, th, h = 0, to = V3(0, 0, 0)) => { const r = reach(t, th), rr = r > 1e-4 ? Math.max(r, floor ? floor(t, th) : 0) + wall + h : 0; dirAt(th, D3); return to.set(o.x + a.x * t + D3.x * rr, o.y + a.y * t + D3.y * rr, o.z + a.z * t + D3.z * rr); };
		// (which quads are kept, and so how far each point lies in from an edge)
		const onV = new Uint8Array(NV);
		for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) { const t = tOf(i, j), th = thOf(j % W); onV[i * W + j] = !cover || cover(t, th, point(t, th, 0, PT)) ? 1 : 0; }
		const quad = (i, j) => i >= 0 && i < nr - 1 && j >= 0 && j < seg && onV[i * W + j] && onV[(i + 1) * W + j] && onV[i * W + j + 1] && onV[(i + 1) * W + j + 1];
		const D = new Uint8Array(NV).fill(255), Q = [];
		const wrapQ = (i, j) => quad(i, arc ? j : (j + seg) % seg);
		for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) {
			const inner = wrapQ(i, j) && wrapQ(i - 1, j) && wrapQ(i, j - 1) && wrapQ(i - 1, j - 1);
			if (!inner && !(i === 0 && closeA) && !(i === nr - 1 && closeB)) { D[i * W + j] = 0; Q.push(i * W + j); }
		}
		for (let h = 0; h < Q.length; h++) {
			const k = Q[h], i = Math.floor(k / W), j = k % W, d = D[k] + 1; if (d > 6) continue;
			for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const ii = i + di; let jj = j + dj; if (ii < 0 || ii >= nr) continue;
				if (arc) { if (jj < 0 || jj > seg) continue; } else if (jj < 0) jj = seg - 1; else if (jj > seg) jj = 1;
				const kk = ii * W + jj; if (D[kk] > d) { D[kk] = d; Q.push(kk); if (!arc && (jj === 0 || jj === seg)) { const tw = ii * W + (jj ? 0 : seg); if (D[tw] > d) { D[tw] = d; Q.push(tw); } } }
			}
		}
		if (thick == null) thick = gloss === ARMOUR ? 0.0035 : 0;
		const steel = stain ?? gloss === ARMOUR, baseC = new THREE.Color(col), wornC = rimCol ? new THREE.Color(rimCol) : null;
		const V = new Float32Array(NV * 3), Cc = new Float32Array(NV * 3), Wy = new Float32Array(NV), B = [], tint = new THREE.Color(), seamC = new THREE.Color('#141517');
		for (let i = 0; i < nr; i++) for (let j = 0; j <= seg; j++) {
			const k = i * W + j, t = tOf(i, j), th = thOf(j), p = point(t, th);
			const L = lift ? lift(t, th, p) : null, d = D[k];
			const e = edge ? edge(d) : d === 0 ? rim : d === 1 ? rim * 0.45 : 0;
			point(t, th, (L?.lift || 0) + e, D3);
			V[k * 3] = D3.x; V[k * 3 + 1] = D3.y; V[k * 3 + 2] = D3.z;
			tint.copy((paint && paint(t, th, p)) || baseC);
			if (d === 0) { if (wornC) tint.copy(wornC); else if (steel) tint.lerp(new THREE.Color('#c8ccd2'), wear); }
			if (steel) {
				// (use: the steel dulled and stained in patches, rust brown in the worst of them,
				// a little darker toward its lower edge)
				const X = V[k * 3], Y = V[k * 3 + 1], Z = V[k * 3 + 2];
				const s1 = Math.sin(X * 23 + Y * 7) * Math.sin(Y * 19 - Z * 11) * Math.sin(Z * 17 + X * 13), s2 = Math.sin(X * 41 - Z * 29) * Math.sin(Y * 37 + X * 17);
				tint.multiplyScalar(0.84 + 0.16 * s1 * s1 + 0.08 * (i / Math.max(1, nr - 1)) * (a.y > 0.5 ? 1 : 0));
				if (s2 > 0.55 && d > 0) tint.lerp(STAINC, (s2 - 0.55) * 0.9);
			}
			if (L?.seam) tint.lerp(seamC, Math.min(1, L.seam));
			if (L?.tone) tint.multiplyScalar(L.tone);
			Wy[k] = Math.min(1, (L?.seam || 0) * 0.4 + (L?.dirt || 0));
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
		// (the clothes under it, test(x, y, z, slot, limb), pressed in under its inside and the shift
		// kept so the shader does not push them back out, cloth-collide.js)
		const press = (test, clear = 0.003) => {
			const cp2 = P0.cloth?.attributes.position, ci = P0.cloth?.attributes.clothInset, sl2 = P0.cloth?.attributes.slot, inset = (thick ?? (gloss === ARMOUR ? 0.0035 : 0)) + clear;
			if (!cp2) return;
			for (let i = 0; i < cp2.count; i++) {
				const x = cp2.getX(i), y = cp2.getY(i), z = cp2.getZ(i), sn = sl2 ? sl2.getX(i) : 0;
				if (!test(x, y, z, sn % 10, Math.floor(sn / 10 + 0.01))) continue;
				const dx = x - o.x, dy = y - o.y, dz = z - o.z, t = dx * a.x + dy * a.y + dz * a.z;
				if (t < t0 || t > t1) continue;
				const px = dx - a.x * t, py = dy - a.y * t, pz = dz - a.z * t, r = Math.hypot(px, py, pz);
				const th = Math.atan2(px * sv.x + py * sv.y + pz * sv.z, px * f.x + py * f.y + pz * f.z);
				if (arc && (((th - arc[0]) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) > arc[1] - arc[0]) continue;
				if (span) { const [A0, B0] = span(th); if (t < A0 || t > B0) continue; }
				const inner = rad(t, th) - inset; if (inner <= 0 || r <= inner) continue;
				const k = inner / r;
				cp2.setXYZ(i, o.x + a.x * t + px * k, o.y + a.y * t + py * k, o.z + a.z * t + pz * k);
				if (ci) ci.setX(i, ci.getX(i) + (r - inner));
			}
		};
		if (!draw) return { at, rad, press };
		const I = [];
		for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) if (quad(i, j)) { const p = i * W + j, q = p + W; I.push(p, p + 1, q, p + 1, q + 1, q); }
		if (!I.length) return null;
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals();
		const na = g.attributes.normal;
		// (round a closed tube, the first and last sectors are the same points: one normal for both,
		// or a crease shows down the front)
		if (!arc) for (let i = 0; i < nr; i++) {
			const k0 = i * W, k1 = i * W + seg, x = na.getX(k0) + na.getX(k1), y = na.getY(k0) + na.getY(k1), z = na.getZ(k0) + na.getZ(k1), l = Math.hypot(x, y, z) || 1;
			na.setXYZ(k0, x / l, y / l, z / l); na.setXYZ(k1, x / l, y / l, z / l);
		}
		// (how worn each point is: its edges rubbed, its seams and laps holding dirt)
		const wearX = (k) => (D[k] === 0 ? 1 : D[k] === 1 ? 0.55 : D[k] === 2 ? 0.2 : 0);
		const emit = (k, nx, ny, nz, ox, oy, oz, wx, wy) => {
			out.pos.push(V[k * 3] + ox, V[k * 3 + 1] + oy, V[k * 3 + 2] + oz); out.nor.push(nx, ny, nz); out.col.push(Cc[k * 3], Cc[k * 3 + 1], Cc[k * 3 + 2]);
			const b = B[k]; let sum = 0; for (const [, w] of b) sum += w;
			for (let q = 0; q < 4; q++) { out.si.push(b[q]?.[0] ?? 0); out.sw.push(b[q] ? b[q][1] / (sum || 1) : 0); }
			out.kit.push(gloss, fab, 0); out.wr.push(wx, wy);
		};
		for (const k of I) emit(k, na.getX(k), na.getY(k), na.getZ(k), 0, 0, 0, wearX(k), Wy[k]);
		// a plate has a thickness: its inside, and a wall round every edge where the two meet
		const th2 = P0.lo ? 0 : thick;
		if (th2 > 0) {
			// (in toward the axis: the normals follow the grid's winding, which may face either way)
			const k0 = I[0], rx0 = V[k0 * 3] - o.x, ry0 = V[k0 * 3 + 1] - o.y, rz0 = V[k0 * 3 + 2] - o.z, al0 = rx0 * a.x + ry0 * a.y + rz0 * a.z;
			const sg = (rx0 - a.x * al0) * na.getX(k0) + (ry0 - a.y * al0) * na.getY(k0) + (rz0 - a.z * al0) * na.getZ(k0) >= 0 ? th2 : -th2;
			const inn = (k) => [-na.getX(k) * sg, -na.getY(k) * sg, -na.getZ(k) * sg];
			// (a rigid shell's inside only near its edges, where it is seen past the rim; further in,
			// the body fills it and the material's other side stands in for it)
			const band = gloss === ARMOUR || gloss === PAINT || gloss === POLY ? 3 : 255;
			for (let f = 0; f < I.length; f += 3) {
				if (Math.min(D[I[f]], D[I[f + 1]], D[I[f + 2]]) > band) continue;
				for (const k of [I[f], I[f + 2], I[f + 1]]) { const o2 = inn(k); emit(k, -na.getX(k), -na.getY(k), -na.getZ(k), o2[0], o2[1], o2[2], 0, 0.3); }
			}
			// (a wall along the edge k0-k1 of the kept quad (qi, qj), facing away from it)
			const wall = (k0, k1, qi, qj) => {
				const P = (k, o2) => [V[k * 3] + (o2 ? o2[0] : 0), V[k * 3 + 1] + (o2 ? o2[1] : 0), V[k * 3 + 2] + (o2 ? o2[2] : 0)];
				const a0 = inn(k0), a1 = inn(k1), q0 = qi * W + qj, C = [0, 1, 2].map((c) => (V[q0 * 3 + c] + V[(q0 + 1) * 3 + c] + V[(q0 + W) * 3 + c] + V[(q0 + W + 1) * 3 + c]) / 4);
				const A0 = P(k0), A1 = P(k1), e = [A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]], n0 = [na.getX(k0) + na.getX(k1), na.getY(k0) + na.getY(k1), na.getZ(k0) + na.getZ(k1)];
				let sv2 = [e[1] * n0[2] - e[2] * n0[1], e[2] * n0[0] - e[0] * n0[2], e[0] * n0[1] - e[1] * n0[0]];
				const l = Math.hypot(...sv2) || 1; sv2 = sv2.map((x) => x / l);
				if (((A0[0] + A1[0]) / 2 - C[0]) * sv2[0] + ((A0[1] + A1[1]) / 2 - C[1]) * sv2[1] + ((A0[2] + A1[2]) / 2 - C[2]) * sv2[2] < 0) sv2 = sv2.map((x) => -x);
				// (two triangles, wound to face the way the wall does)
				const B1 = P(k1, a1), tri = [[k0, null], [k1, null], [k1, a1], [k0, null], [k1, a1], [k0, a0]];
				const cr = [e[1] * (B1[2] - A0[2]) - e[2] * (B1[1] - A0[1]), e[2] * (B1[0] - A0[0]) - e[0] * (B1[2] - A0[2]), e[0] * (B1[1] - A0[1]) - e[1] * (B1[0] - A0[0])];
				const order = cr[0] * sv2[0] + cr[1] * sv2[1] + cr[2] * sv2[2] >= 0 ? tri : [tri[0], tri[2], tri[1], tri[3], tri[5], tri[4]];
				for (const [k, o2] of order) emit(k, sv2[0], sv2[1], sv2[2], o2 ? o2[0] : 0, o2 ? o2[1] : 0, o2 ? o2[2] : 0, 1, 0);
			};
			const kept = (i, j) => (arc ? quad(i, j) : quad(i, (j + seg) % seg));
			for (let i = 0; i < nr - 1; i++) for (let j = 0; j < seg; j++) {
				if (!quad(i, j)) continue;
				const p = i * W + j;
				if (!kept(i - 1, j) && !(i === 0 && closeA)) wall(p, p + 1, i, j);
				if (!kept(i + 1, j) && !(i + 1 === nr - 1 && closeB)) wall(p + W, p + W + 1, i, j);
				if (!kept(i, j - 1)) wall(p, p + W, i, j);
				if (!kept(i, j + 1)) wall(p + 1, p + W + 1, i, j);
			}
		}
		g.dispose();
		return { at, rad, press };
	};
	// the angle round an axis (as fitTube measures it) that faces the way w does
	const thetaOf = (axis, w, ref = V3(0, 0, 1)) => { const a = axis.clone().normalize(), f = ref.clone().projectOnPlane(a).normalize(), s = V3(0, 0, 0).crossVectors(a, f); return Math.atan2(w.dot(s), w.dot(f)); };
	const angGap = (x, y) => Math.abs(((x - y + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
	// how far along a bone the skin point v lies
	// (kept for the armour pieces still to come: unused by the ones made so far)
	// eslint-disable-next-line no-unused-vars
	const alongBone = (v, from, to) => { const d = to.clone().sub(from), L = d.length(); return ((skinP[v * 3] - from.x) * d.x + (skinP[v * 3 + 1] - from.y) * d.y + (skinP[v * 3 + 2] - from.z) * d.z) / (L || 1); };
	// laminated plate along a run (t: how far along, in metres): each lame a step out over the
	// next (up: the first lame outermost), swelling toward its free edge, which is worn bright,
	// and a dark seam where one ends
	// (kept for the armour pieces still to come)
	// eslint-disable-next-line no-unused-vars
	const lames = (t, width, step = 0.0045, up = true, saw = 0.0025) => {
		const k = Math.floor(t / width), f = t / width - k, free = up ? f : 1 - f;
		return { lift: Math.max(0, up ? 3 - k : k) * step + saw * free * free, seam: f > 0.88 ? (f - 0.88) / 0.12 : f < 0.05 ? 1 - f / 0.05 : 0, tone: free > 0.66 && free < 0.86 ? 1.22 : 1 };
	};
	// a headset: a cup over each ear and a boom mic to the mouth (band: over the top, for a cap)
	// a headset: a cup over each ear (a rounded shell, its outer cap stood proud), a boom mic to
	// the mouth with its windscreen; on a cap a band over the top, on a helmet an arm up to each
	// rail (on: the helmet's shell and where its rim lies)
	// where each ear is (s: 1 its left, -1 its right): the middle of the skin furthest out at the
	// side of the head between the brow and the jaw
	let earsAt = null;
	const ear = (s) => {
		if (!earsAt) {
			earsAt = {};
			for (const k of [-1, 1]) {
				let x = 0, y = 0, z = 0, n = 0;
				for (let i = 0, v = 0; i < nSkin; i += 3, v++) {
					if (P0.part && P0.part[v] !== 0) continue;
					const px = skinP[i], py = skinP[i + 1], pz = skinP[i + 2];
					if (py < eyeY - 0.075 || py > eyeY + 0.005 || (px - cx) * k < rx - 0.012 || Math.abs(pz - cz) > 0.06) continue;
					x += px; y += py; z += pz; n++;
				}
				earsAt[k] = n ? V3(x / n, y / n, z / n) : V3(cx + k * rx, eyeY - 0.03, cz);
			}
		}
		return earsAt[s];
	};
	// a headset over the ears: on each a moulded cup sealed to the head round the ear by its
	// cushion, two knobs on it; hung from the helmet's rails on a jointed arm (on: the shell and
	// its tAt) or from a band over the head; a boom from the right cup to the mouth
	const headset = (col, band, on = null) => {
		const dark = new THREE.Color(col).multiplyScalar(0.62).getHex(), up = Math.PI / 2;
		const cupG = new THREE.LatheGeometry([[0, 1.06], [0.5, 1.04], [0.8, 0.96], [0.95, 0.78], [1, 0.5], [1, 0]].map(([r, h]) => new THREE.Vector2(r, h)), P0.lo ? 12 : 24);
		for (const s of [-1, 1]) {
			const E = ear(s), x0 = cx + s * (rx - 0.003), y = E.y + 0.004, z = E.z - 0.002;
			// (the cushion pressed on the head round the ear, the cup over it)
			put(new THREE.TorusGeometry(0.027, 0.0085, 8, 24).rotateY(up).scale(1, 1.18, 1).translate(x0 - s * 0.003, y, z), 'head', '#141413', LEATHER);
			put(cupG.clone().scale(0.036, 0.026, 0.031).rotateZ(-s * up).translate(x0 + s * 0.004, y, z), 'head', col, POLY);
			// (the cup's seam, and its two knobs)
			put(new THREE.TorusGeometry(0.0305, 0.0012, 4, 24).rotateY(up).scale(1, 1.16, 1).translate(x0 + s * 0.016, y, z), 'head', dark, POLY);
			for (const [dy, dz, r] of [[-0.022, 0.016, 0.0055]]) put(new THREE.CylinderGeometry(r, r, 0.009, 12).rotateZ(up).translate(x0 + s * 0.031, y + dy, z + dz), 'head', '#121211', RUBBER);
			const top = V3(x0 + s * 0.016, y + 0.039, z);
			put(new THREE.CylinderGeometry(0.0055, 0.0055, 0.016, 12).rotateX(up).translate(top.x, top.y, top.z), 'head', dark, POLY);
			if (on) {
				// (an arm from the rail's adapter, outward round the rim and down to the pivot on the cup)
				const th = s * (up + 0.05), R = on.shell.at(on.tAt(th, 0.0195), th, 0.006);
				const mid = V3((R.p.x + top.x) / 2 + s * 0.006, (R.p.y + top.y) / 2, (R.p.z + top.z) / 2);
				const nn = V3(s, 0, 0);
				put(mount2(new RoundedBoxGeometry(0.024, 0.016, 0.01, 2, 0.003), R), 'head', dark, POLY);
				sweep([{ p: R.p.clone().addScaledVector(R.n, 0.004), n: R.n, bone: 'head' }, { p: mid, n: nn, bone: 'head' }, { p: top.clone().add(V3(0, 0.006, 0)), n: nn, bone: 'head' }], strapProf(0.011, 0.0042, -0.0021), dark, POLY, 0, 0.4);
			}
		}
		const E1 = ear(-1), bx = cx - rx - 0.012;
		const boom = new THREE.CatmullRomCurve3([V3(bx, E1.y - 0.016, E1.z + 0.026), V3(cx - rx * 0.9, eyeY - 0.098, cz + rz * 0.62), V3(cx - 0.03, eyeY - 0.106, sk.z1 + 0.012)]);
		put(new THREE.TubeGeometry(boom, 12, 0.0028, 6, false), 'head', '#1a1b19', RUBBER);
		const mic = new THREE.CapsuleGeometry(0.0075, 0.012, 4, 10); mic.rotateZ(up); mic.translate(cx - 0.024, eyeY - 0.106, sk.z1 + 0.014); put(mic, 'head', '#151514', NYLON);
		if (band) {
			const E = ear(1), b = new THREE.TorusGeometry(1, 0.03, 5, 24, Math.PI);
			b.scale(rx + 0.03, top - E.y + 0.03, 0.3); b.translate(cx, E.y + 0.035, E.z); put(b, 'head', col, POLY);
		}
	};
	const mount2 = (geo, S, up = V3(0, 1, 0)) => { const z = S.n.clone(), y = up.clone().projectOnPlane(z).normalize(), x = V3(0, 0, 0).crossVectors(y, z); geo.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(S.p)); return geo; };
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
		const g = geo.index ? geo.toNonIndexed() : geo, pa = g.attributes.position, na = g.attributes.normal, wa = g.attributes.wear;
		for (let i = 0; i < pa.count; i++) {
			const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), cc = colourAt(x, y, z);
			out.pos.push(x, y, z); out.nor.push(na.getX(i), na.getY(i), na.getZ(i)); out.col.push(cc.r, cc.g, cc.b);
			out.si.push(typeof bone === 'function' ? map[bone(y)] ?? 0 : map[bone] ?? 0, 0, 0, 0); out.sw.push(1, 0, 0, 0); out.kit.push(gloss, fab, 0);
			out.wr.push(wa ? wa.getX(i) : 0, wa ? wa.getY(i) : 0);
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
	// (kept for the armour pieces still to come)
	// eslint-disable-next-line no-unused-vars
	const ringTube = (rings, seg = 32) => {
		const V = [], I = [];
		for (const R of rings) for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; V.push(R.x + Math.sin(a) * R.rx, R.y, R.z + Math.cos(a) * R.rz); }
		for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < seg; i++) { const p = r * (seg + 1) + i, q = p + seg + 1; I.push(p, q, p + 1, p + 1, q, q + 1); }
		const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I);
		return g;
	};
	// a closed helm of the old kingdoms' knights, in three pieces as one is made: a skull drawn
	// to an egg with a comb down its crown and its tail turned in under the head; a visor brought
	// forward to a beak, its upper edge flared over the sight and breaths cut in its right cheek,
	// pivoting on a boss at each temple; a bevor closing the chin and throat under it. Behind the
	// sight and the breaths a dark padded lining.
	function closeHelm(q, c) {
		const yc = eyeY + 0.01, yNape = cut.neck + 0.018, yBrow = eyeY + 0.014, ySight = eyeY + 0.004, yChin = eyeY - 0.08, yThroat = cut.neck + 0.02;
		const UP = V3(0, 1, 0), O = V3(cx, cut.neck - 0.01, cz), head = () => 'head', hk = (th) => Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
		const Mh = fitTube({ o: O, axis: UP, t0: 0, t1: top + 0.02 - O.y, dt: 0.008, seg: 48, smooth: 4, give: 0, wall: 0, bone: head, draw: false, skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.01 && Math.hypot(x - cx, z - cz) < 0.16 });
		const Ms = fitTube({ o: O, axis: UP, t0: 0, t1: top + 0.02 - O.y, dt: 0.008, seg: 48, smooth: 14, give: 0, wall: 0, bone: head, draw: false, skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.01 && Math.hypot(x - cx, z - cz) < 0.16 });
		if (!Mh || !Ms) return;
		const hr = (y, th, M = Mh) => M.rad(Math.max(0, Math.min(top + 0.02 - O.y, y - O.y)), th);
		// (close over the head, as on a statue: a skull a finger's width off it, not a bucket)
		const ax = rx + 0.002, azF = rz + 0.004, azB = rz + 0.006, ay = top - yc + 0.006;
		const ell = (th) => { const c0 = Math.cos(th), s0 = Math.sin(th), az = c0 > 0 ? azF : azB; return 1 / Math.sqrt((c0 / az) ** 2 + (s0 / ax) ** 2); };
		const TH = 0.003;
		// (the skull: its sides and back down to the nape, the front only to the brow)
		// hard moulding, not a round shell: each level's section drawn as the planes laid on it
		// (six, their creases down the middle front and back and at the cheeks), the corners
		// eased a hair; outside what it is laid on everywhere, as the planes only touch it
		const FAC = [-5, -3, -1, 1, 3, 5].map((k) => (k * Math.PI) / 6);
		const facet = (base, ease = 900) => {
			const cache = new Map();
			return (y, th) => {
				const key = Math.round(y * 1e4);
				let R = cache.get(key);
				if (!R) {
					R = FAC.map((c) => { let m = 0; for (let i = 0; i < 40; i++) { const a = c - 1.2 + (2.4 * i) / 39; m = Math.max(m, base(y, a) * Math.cos(a - c)); } return m; });
					cache.set(key, R);
				}
				let sum = 0;
				for (let j = 0; j < FAC.length; j++) { const d = Math.cos(th - FAC[j]); if (d > 0.05) sum += Math.exp(-ease * (R[j] / d)); }
				return sum > 0 ? -Math.log(sum) / ease : base(y, th);
			};
		};
		// (under the planes: an egg drawn tight over the head, its crown brought up to a point)
		const skullBase = (y, th) => {
			const k = y >= yc ? Math.pow(Math.max(0, 1 - ((y - yc) / ay) ** 2), 0.62) : 1 - 0.16 * ((yc - y) / (yc - yNape)) ** 2 * (1 - Math.max(0, Math.cos(th)));
			return Math.max(ell(th) * k, y < top - 0.01 ? hr(y, th, Ms) + 0.0065 : 0);
		};
		const skullF = facet(skullBase);
		const skullR = (y, th) => {
			let r = skullF(y, th);
			const x = Math.abs(r * Math.sin(th)), xb = Math.abs(r * Math.sin(th - Math.PI));
			// (a keel stood up along the crease front and back over the crown, and a heavy brow
			// jutting over the sight)
			const up = Math.max(0, Math.min(1, (y - yBrow - 0.012) / 0.03));
			r += 0.0045 * Math.max(0, 1 - x / 0.007) * up * (Math.cos(th) > 0 ? 1 : 0) + 0.0035 * Math.max(0, 1 - xb / 0.007) * (y > yc ? 1 : 0);
			r += 0.006 * Math.max(0, Math.cos(th)) ** 3 * (1 - Math.max(0, Math.min(1, (y - yBrow) / 0.026)));
			return Math.max(r, y < top - 0.01 ? hr(y, th) + 0.004 : 0);
		};
		const skullLo = (th) => { const f = hk(th), u = Math.max(0, Math.min(1, (f - 0.9) / 0.55)); return yBrow + (yNape - yBrow) * u * u * (3 - 2 * u); };
		const yPole = yc + ay;
		const skull = fitTube({ o: O, axis: UP, t0: yNape - O.y, t1: yPole - O.y, dt: 0.007, seg: 64, span: (th) => [skullLo(th) - O.y, yPole - O.y], floor: (t, th) => skullR(O.y + t, th), skin: () => false, smooth: 0, wall: 0, minR: 0.0004, closeB: 0.001, col: c, thick: TH, rim: 0.0014, bone: head });
		// (the brow over the sight, its edge rolled; the skull's lower edge rolled behind)
		if (skull) {
			const pts = []; for (let i = 0; i <= 64; i++) { const th = -Math.PI + (i / 64) * Math.PI * 2; pts.push(skull.at(skullLo(th) - O.y + 0.003, th, 0.0012)); }
			pts.pop(); sweep(pts, roundProf(0.0038, 8), c, ARMOUR, 0, 1, true);
		}
		// (the visor: wider than the skull, so its sides lie over it, drawn out to a beak below the
		// sight; its lower edge sweeping up to the pivots)
		// (the face's reach forward at each height, the nose and the chin taken in one smooth curve)
		const faceD = (y) => { let m = 0; for (let k = -3; k <= 3; k++) m = Math.max(m, hr(y + k * 0.01, 0, Ms)); return m; };
		const W = 1.52, prow = (y) => 0.003 + 0.024 * Math.pow(Math.sin(Math.PI * Math.max(0, Math.min(1, (ySight + 0.004 - y) / (ySight - yChin + 0.02)))), 0.75);
		const visorR0 = (y, th) => {
			const k = y >= yc ? 1 : 1 - 0.13 * ((yc - y) / (yc - yChin)) ** 2, c0 = Math.cos(th), s0 = Math.sin(th);
			const a = ax * k + 0.0055, b = c0 > 0 ? Math.max(azF * k + 0.0055, faceD(y) + 0.0105) : azB + 0.0055, n = 2.2;
			let r = Math.pow(Math.pow(Math.abs(c0 / b), n) + Math.pow(Math.abs(s0 / a), n), -1 / n);
			const x = Math.abs(r * s0);
			if (c0 > 0) r += prow(y) * Math.max(0, 1 - x / 0.058) * c0;
			return Math.max(r, hr(y, th, Ms) + 0.016);
		};
		// (the visor in planes too, its beak a crease)
		const visorR = facet(visorR0);
		const visLo = (th) => yChin + (ySight - 0.028 - yChin) * Math.pow(Math.abs(th) / W, 2.2), visHi = (th) => ySight - 0.004 * (th / W) ** 2;
				const visor = fitTube({
			o: O, axis: UP, t0: yChin - O.y, t1: ySight - O.y, dt: 0.0045, seg: 72, arc: [-W, W], span: (th) => [visLo(th) - O.y, visHi(th) - O.y],
			floor: (t, th) => visorR(O.y + t, th), skin: () => false, smooth: 0, wall: 0, minR: 0.0004, col: c, thick: TH, rim: 0.0012, bone: head,
		});
		if (visor) {
			// (its upper edge turned out in a lip over the sight)
			const lip = []; for (let i = 0; i <= 48; i++) { const th = -W + 0.04 + (i / 48) * (W * 2 - 0.08); lip.push(visor.at(visHi(th) - O.y - 0.002, th, 0.0015)); }
			sweep(lip, [[-0.003, -0.001], [0.003, -0.001], [0.003, 0.004], [-0.002, 0.005]], c, ARMOUR, 0, 1);
			// (the breaths: slots punched in the right cheek, dark behind)
			for (let r = 0; r < 5; r++) {
				const y = eyeY - 0.06 + r * 0.0105, pts = [];
				for (let i = 0; i <= 10; i++) pts.push(visor.at(y - O.y, -1.1 + i * 0.058, 0.0003));
				sweep(pts, [[-0.0022, 0], [0.0022, 0], [0.0022, 0.0004], [-0.0022, 0.0004]], '#0b0a09', 0.02, 0, 0);
			}
			for (const s of [1, -1]) { const B = visor.at(ySight - 0.024 - O.y, s * (W - 0.06), 0.0005); rivet(B, 0.0085, c, 0.45); rivet({ p: B.p.clone().addScaledVector(B.n, 0.0035), n: B.n, bone: B.bone }, 0.003, c, 0.8); }
		}
		// (the bevor: from under the visor's lower edge to the throat, the beak's line carried down)
		const bevLo = (th) => yThroat + 0.012 * (th / 1.6) ** 2, bevHi = (th) => yChin + 0.022 + (ySight - 0.045 - yChin - 0.022) * Math.pow(Math.abs(th) / 1.6, 2.2);
		fitTube({
			o: O, axis: UP, t0: yThroat - O.y, t1: ySight - O.y, dt: 0.006, seg: 64, arc: [-1.6, 1.6], span: (th) => [bevLo(th) - O.y, bevHi(th) - O.y],
			floor: (t, th) => {
				const y = O.y + t, u = Math.max(0, Math.min(1, (y - yThroat) / (yChin + 0.02 - yThroat)));
				let r = Math.max(hr(y, th, Ms) + 0.013, visorR(Math.min(y, yChin + 0.02), th) * u + (hr(y, th, Ms) + 0.018) * (1 - u) - 0.0055);
				r += 0.006 * Math.max(0, 1 - Math.abs(r * Math.sin(th)) / 0.05) * Math.max(0, Math.cos(th));
				// (tucked under the visor where they lap)
				return y > visLo(th) - 0.003 ? Math.min(r, visorR(y, th) - TH - 0.0025) : r;
			},
			skin: () => false, smooth: 0, wall: 0, minR: 0.0004, col: c, thick: TH, rim: 0.0016, bone: head,
		});
		// (the padded lining and collar, seen through the sight and the breaths and between the helm
		// and the gorget)
		fitTube({
			o: O, axis: UP, t0: cut.neck - 0.035 - O.y, t1: eyeY + 0.03 - O.y, dt: 0.012, seg: 32, wall: 0.005, smooth: 6, col: '#17140f', gloss: WOOL, thick: 0, edge: () => 0, stain: false,
			skin: (v, x, y, z) => P0.part[v] === 0 && y > cut.neck - 0.05 && y < eyeY + 0.05 && Math.hypot(x - cx, z - cz) < 0.16, bone: (t) => (O.y + t > cut.neck + 0.02 ? 'head' : 'neck01'),
		});
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
			if (q.kind === 'helmet' && q.combat && A.kit) {
				// the helmet, its night vision and its headset as real models
				// (people/kit-models.js); the battery pouch in the pack's colour if it has one
				putModel('helmet', c);
				if (q.nvg) putModel('nvg', q.pack || c);
				if (q.comms) putModel('headset', '#2b2d2a');
			} else if (q.kind === 'helmet' && q.combat) {
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
					o: V3(cx, yo, cz), axis: V3(0, 1, 0), t0: 0, t1: tTop - 0.004, dt: 0.008, seg: 64, wall: 0.026, smooth: 18, give: 0.006, closeB: 0.065, thick: 0.007,
					span: (th) => [rimY(th) - yo, tTop - 0.004], col: c, gloss: POLY, stain: false,
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
					// (the rails: a polymer channel along each side above the cut, bolted through)
					for (const s of [-1, 1]) {
						const pts = []; for (let i = 0; i <= 16; i++) { const th = s * (Math.PI / 2 + 0.85 - (1.7 * i) / 16); pts.push(shell.at(tAt(th, 0.0195), th, -0.001)); }
						sweep(pts, strapProf(0.021, 0.0065), rail, POLY, 0, 0.5);
						for (const th of [s * (Math.PI / 2 - 0.55), s * (Math.PI / 2 + 0.55)]) rivet(shell.at(tAt(th, 0.0195), th, 0.0055), 0.0034, '#3b3c38', 0.45, PAINT);
						for (const th of [s * (Math.PI / 2 - 0.27), s * (Math.PI / 2 + 0.27)]) { const S = shell.at(tAt(th, 0.0195), th, 0.0052), g = new THREE.BoxGeometry(0.014, 0.0045, 0.0012); put(mount(g, S), 'head', '#0f0f0e', POLY); }
					}
					// (the shroud at the brow: a plate on three bolts, the socket the mount locks into)
					const shroudS = shell.at(tAt(0, 0.022), 0), Lm = (g) => mount(g, shroudS), dark = '#1d1e1b';
					put(Lm(new RoundedBoxGeometry(0.058, 0.038, 0.006, 2, 0.0025).translate(0, 0, 0.0015)), 'head', '#22231f', PAINT);
					for (const [x, y] of [[-0.021, 0.012], [0.021, 0.012], [0, -0.013]]) put(Lm(new THREE.CylinderGeometry(0.0032, 0.0032, 0.003, 10).rotateX(Math.PI / 2).translate(x, y, 0.0058)), 'head', '#5a5c55', PAINT);
					put(Lm(new RoundedBoxGeometry(0.03, 0.015, 0.008, 2, 0.002).translate(0, 0.001, 0.008)), 'head', '#121211', PAINT);
					if (q.nvg) {
						// the night vision turned up out of the way: an arm down from the socket to a
						// hinge with a knob at each end; on it the binocular swung up, its bridge with
						// the battery in it, two housings looking up and back at the sky, each with a
						// ribbed focus ring and its objective lens set back in the barrel, the rubber
						// eyecups facing out; a battery pack behind to balance it, its cable along the
						// side, and a strobe
						const Q = new THREE.Quaternion(), ns = P0.lo ? 10 : 22, rings = P0.lo ? 1 : 4;
						put(Lm(new RoundedBoxGeometry(0.022, 0.032, 0.012, 2, 0.003).translate(0, 0.017, 0.017)), 'head', dark, PAINT);
						put(Lm(new THREE.CylinderGeometry(0.0075, 0.0075, 0.046, 16).rotateZ(Math.PI / 2).translate(0, 0.031, 0.026)), 'head', '#2a2b28', PAINT);
						for (const s of [-1, 1]) put(Lm(new THREE.CylinderGeometry(0.0088, 0.0088, 0.006, 14).rotateZ(Math.PI / 2).translate(s * 0.026, 0.031, 0.026)), 'head', '#121211', RUBBER);
						const B0 = V3(0, 0.047, 0.036), dir = V3(0, 0.94, -0.34).normalize();
						Q.setFromUnitVectors(V3(0, 1, 0), dir);
						const along = (g, t, x) => { g.applyQuaternion(Q); g.translate(x + dir.x * t, B0.y - 0.004 + dir.y * t, B0.z + 0.004 + dir.z * t); return Lm(g); };
						put(Lm(new RoundedBoxGeometry(0.086, 0.021, 0.024, 3, 0.008).translate(B0.x, B0.y, B0.z)), 'head', dark, POLY);
						put(Lm(new THREE.CylinderGeometry(0.0088, 0.0088, 0.03, 16).rotateZ(Math.PI / 2).translate(0.012, B0.y + 0.009, B0.z + 0.006)), 'head', '#262723', POLY);
						put(Lm(new THREE.CylinderGeometry(0.0098, 0.0098, 0.007, 16).rotateZ(Math.PI / 2).translate(0.03, B0.y + 0.009, B0.z + 0.006)), 'head', '#121211', RUBBER);
						put(Lm(new THREE.CylinderGeometry(0.0052, 0.0052, 0.011, 12).rotateX(Math.PI / 2).translate(-0.011, B0.y - 0.004, B0.z + 0.015)), 'head', '#2b2c28', POLY);
						for (const s of [-1, 1]) {
							const x = s * 0.031;
							put(along(new THREE.CylinderGeometry(0.0156, 0.0156, 0.047, ns).translate(0, 0.0235, 0), 0, x), 'head', '#242622', POLY);
							put(along(new THREE.CylinderGeometry(0.0146, 0.0178, 0.013, ns, 1, true).translate(0, -0.0065, 0), 0, x), 'head', '#121211', RUBBER);
							put(along(new THREE.CylinderGeometry(0.0104, 0.0104, 0.002, ns).translate(0, -0.004, 0), 0, x), 'head', '#0c1512', GLASS);
							for (let k = 0; k < rings; k++) put(along(new THREE.TorusGeometry(0.0154, 0.0013, 5, ns).rotateX(Math.PI / 2).translate(0, 0.05 + k * 0.0042, 0), 0, x), 'head', '#161715', RUBBER);
							put(along(new THREE.CylinderGeometry(0.0146, 0.015, 0.024, ns, 1, true).translate(0, 0.058, 0), 0, x), 'head', '#1f201d', POLY);
							put(along(new THREE.CylinderGeometry(0.0135, 0.0135, 0.009, ns, 1, true).translate(0, 0.0655, 0), 0, x), 'head', '#090909', POLY);
							put(along(new THREE.TorusGeometry(0.0142, 0.0012, 5, ns).rotateX(Math.PI / 2).translate(0, 0.07, 0), 0, x), 'head', '#2a2b27', POLY);
							put(along(new THREE.CylinderGeometry(0.0131, 0.0131, 0.0015, ns).translate(0, 0.0615, 0), 0, x), 'head', '#1c3a2f', GLASS);
						}
						const bp = shell.at(tAt(Math.PI, 0.05), Math.PI);
						put(mount(new RoundedBoxGeometry(0.085, 0.05, 0.026, 2, 0.008).translate(0, 0, 0.012), bp), 'head', q.pack || '#2c2d29', 0.15, 3);
						const pts = [bp.p.clone().addScaledVector(bp.n, 0.014).add(V3(-0.03, 0.02, 0))];
						for (const [th, h] of [[-(Math.PI - 0.55), 0.07], [-(Math.PI / 2 + 0.35), 0.05], [-(Math.PI / 2 - 0.35), 0.048], [-0.6, 0.045]]) pts.push(shell.at(tAt(th, h), th, 0.005).p);
						const end = Lm(new THREE.BufferGeometry().setFromPoints([V3(-0.02, 0.034, 0.02)])).attributes.position;
						pts.push(V3(end.getX(0), end.getY(0), end.getZ(0)));
						put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0032, 6, false), 'head', '#141413', RUBBER);
						for (const th of [-(Math.PI / 2 + 0.35), -0.6]) { const S = shell.at(tAt(th, th < -1 ? 0.05 : 0.045), th, 0.006); put(mount(new RoundedBoxGeometry(0.012, 0.01, 0.006, 1, 0.002), S), 'head', '#20211e', POLY); }
						const strobe = shell.at(tTop * 0.86, Math.PI * 0.82);
						put(mount(new RoundedBoxGeometry(0.03, 0.03, 0.018, 2, 0.005).translate(0, 0, 0.009), strobe), 'head', '#1b1c1a', POLY);
						put(mount(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 12).rotateX(Math.PI / 2).translate(0, 0, 0.019), strobe), 'head', '#3a4a3f', GLASS);
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
				// (a combat glove from the kit: its knuckle guard, pads, strap and seams baked)
				const real = !steel && !q.bracers && (q.combat || q.knuckle) ? A.kit?.glove?.[s] : null;
				if (real && gloveShell(s, A.kit.glove.proud, 0, c, 0, 0, null, null, real)) continue;
				// (a gauntlet from the kit: its plates, scales and rivets baked, the leather in its colour)
				const gaunt = steel ? A.kit?.gauntlet?.[s] : null;
				if (!(gaunt && gloveShell(s, A.kit.gauntlet.proud, 0, q.leather || '#2b211a', 0, 0, null, null, gaunt))) gloveShell(s, steel ? 0.0045 : 0.0032, steel ? 0.03 : q.bracers ? 0.012 : 0.02, steel ? q.leather || '#2b211a' : c, steel ? LEATHER : 0, steel ? 0 : 3, kn, steel ? { col: c } : null);
				const len = heads[map[wb]].distanceTo(heads[map['lowerarm01.' + s]]);
				const g0 = limbGirth('lowerarm01.' + s, 2, len - 0.13, len - 0.02);
				if (steel) {
					// (the vambrace closed round the forearm, its cuff flaring over the gauntlet, and a
					// couter cupping the elbow)
					const E = heads[map['lowerarm01.' + s]], Wr = heads[map[wb]], af = Wr.clone().sub(E).normalize(), back = thetaOf(af, V3(0, 0, -1));
					const mine = (x) => Math.sign(x) === sx;
					// (sized to the forearm itself, the mail sleeve pressed flat under it)
					const fa = fitTube({ o: E, axis: af, t0: 0.03, t1: len - 0.01, dt: 0.01, seg: 28, smooth: 14, give: 0, wall: 0, draw: false, skin: (v, x) => P0.part[v] === 2 && mine(x), bone: () => 'lowerarm01.' + s });
					const faR = (t, th) => fa.rad(Math.max(0.03, Math.min(len - 0.01, t)), th), sleeve = (x, y, z, slot, limb) => limb === 1 && mine(x);
					const vamb = fitTube({
						o: E, axis: af, t0: 0.05, t1: len - 0.045, dt: 0.01, col: c, seg: 32, skin: () => false, smooth: 0, wall: 0, minR: 0.001, thick: 0.0035,
						floor: (t, th) => faR(t, th) + 0.011 + 0.004 * Math.max(0, 1 - angGap(th, back) / 0.35),
						bone: () => 'lowerarm01.' + s,
					});
					vamb?.press(sleeve);
					// (the gauntlet's cuff: a bell of steel over the wrist, going with the hand)
					const cuff = fitTube({
						o: E, axis: af, t0: len - 0.07, t1: len + 0.012, dt: 0.008, col: c, seg: 32, skin: () => false, smooth: 0, wall: 0, minR: 0.001, thick: 0.003,
						floor: (t, th) => Math.max(faR(t, th), faR(len - 0.06, th)) + 0.017 + 0.4 * Math.max(0, t - (len - 0.07)) ** 1.4,
						lift: (t) => ({ seam: Math.abs(t - (len - 0.03)) < 0.003 ? 0.6 : 0 }),
						bone: () => wb,
					});
					cuff?.press(sleeve);
					fitTube({
						o: E, axis: af, t0: -0.06, t1: 0.06, col: c, wall: 0.014, seg: 28,
						skin: (v, x) => (P0.part[v] === 1 || P0.part[v] === 2) && mine(x), cloth: (x, y, z, slot, limb) => limb === 1 && mine(x),
						cover: (t, th) => angGap(th, back) < 1.5,
						lift: (t, th) => ({ lift: 0.012 * Math.max(0, 1 - (t / 0.06) ** 2) * Math.max(0, Math.cos(angGap(th, back))) }),
						// (the couter turns half as far as the elbow bends, so it stays over the point of it)
						bone: () => [['upperarm01.' + s, 0.5], ['lowerarm01.' + s, 0.5]],
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
	// ---------- the knight's harness ----------
	// Plate drawn to its own form, then kept clear of the body and what is worn under it: each
	// piece's shape is designed (a breastplate swelling to a keel and drawn in at the waist, lames
	// that lap and flare, a pauldron domed round the shoulder joint) and only sized by measuring
	// the body, never shrink-wrapped to it (fitTube's floor over a measure of the body). How it is
	// put together shows: rolled edges, rivets, straps and buckles, the mail where it must bend.
	const harness = (q, c) => {
		const part = P0.part, tz = (cut.frontZ + cut.backZ) / 2, armpit = cut.chest - 0.02, yN = cut.neck;
		const knee = heads[map['lowerleg01.L']], legL = heads[map['upperleg01.L']];
		if (!part || !knee || !legL) return;
		const yo = knee.y + 0.02, sL = Math.sign(legL.x) || 1;
		const inArm = (x) => Math.abs(x) > cut.shoulderX * 0.78;
		const O = V3(0, yo, tz), UP = V3(0, 1, 0), fOf = (th) => Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
		// (the body measured round the trunk, the thighs below the hip: the plate is sized to the
		// body itself, and what is worn under it pressed in under the plate, as the plate would)
		const M = fitTube({
			o: O, axis: UP, t0: 0, t1: yN - yo, dt: 0.01, seg: 48, smooth: 3, give: 0, wall: 0, bone: () => 'spine01', draw: false,
			skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && !(y > armpit && inArm(x)),
		});
		if (!M) return;
		// (and the same broadly smoothed, for cloth hung over it)
		const M2 = fitTube({
			o: O, axis: UP, t0: 0, t1: yN - yo, dt: 0.01, seg: 48, smooth: 24, give: 0, wall: 0, bone: () => 'spine01', draw: false,
			skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && !(y > armpit && inArm(x)),
			cloth: (x, y, z, slot, limb) => limb !== 1 && !(y > armpit && inArm(x)),
		});
		const NY = Math.round((yN - yo) / 0.01) + 1, X = new Float32Array(NY), F = new Float32Array(NY), Bk = new Float32Array(NY);
		for (let i = 0; i < NY; i++) for (let j = 0; j < 96; j++) {
			const th = (j / 96) * Math.PI * 2, r = M.rad(Math.min(yN - yo, i * 0.01), th);
			X[i] = Math.max(X[i], r * Math.abs(Math.sin(th)));
			if (Math.cos(th) > 0) F[i] = Math.max(F[i], r * Math.cos(th)); else Bk[i] = Math.max(Bk[i], -r * Math.cos(th));
		}
		const sm = (A) => { for (let p = 0; p < 3; p++) { const C = A.slice(); for (let i = 0; i < NY; i++) A[i] = (C[Math.max(0, i - 2)] + C[Math.max(0, i - 1)] * 2 + C[i] * 2 + C[Math.min(NY - 1, i + 1)] * 2 + C[Math.min(NY - 1, i + 2)]) / 8; } };
		sm(X); sm(F); sm(Bk);
		const at1 = (A, y) => { const f = Math.max(0, Math.min(NY - 1.001, (y - yo) / 0.01)), i = Math.floor(f), u = f - i; return A[i] * (1 - u) + A[i + 1] * u; };
		const cl = 0.022, yP = cut.chest - 0.035, yW = cut.waist;
		const ss = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
		// (the breast at its fullest a little under the chest, drawn in from there to the waist and
		// toward the neck in one curve; the back flatter; the waist taken in)
		let fP = 0; for (let y = yP - 0.04; y <= yP + 0.04; y += 0.01) fP = Math.max(fP, at1(F, y));
		fP += cl + 0.014;
		const kDown = Math.max(0, (fP - at1(F, yW) - cl) / (yP - yW) ** 2);
		const front = (y) => Math.max(at1(F, y) + cl, fP - kDown * (y < yP ? 1 : 0.85) * (y - yP) ** 2);
		// (close at the sides under the arms, where they hang against it)
		const side = (y) => at1(X, y) + cl - 0.016 * ss((armpit + 0.03 - y) / 0.05), back = (y) => at1(Bk, y) + cl;
		const keel = (y) => 0.011 * Math.max(0, Math.min(1, (yN - 0.03 - y) / 0.1));
		const shape = (y, th) => {
			const c0 = Math.cos(th), s0 = Math.sin(th), a = side(y), b = c0 > 0 ? front(y) : back(y), n = c0 > 0 ? 2.15 : 2.6;
			let r = Math.pow(Math.pow(Math.abs(c0 / b), n) + Math.pow(Math.abs(s0 / a), n), -1 / n);
			if (c0 > 0) r += keel(y) * Math.max(0, 1 - Math.abs(r * s0) / 0.075) * c0;
			return r;
		};
		// (never closer to the body than a finger's width: measured broadly smoothed, so where the
		// shape runs close, under the arms, the plate does not take up the body's every bump)
		const Ms = fitTube({ o: O, axis: UP, t0: 0, t1: yN - yo, dt: 0.01, seg: 48, smooth: 18, give: 0, wall: 0, bone: () => 'spine01', draw: false, skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && !(y > armpit && inArm(x)) });
		const shell = (y, th) => Math.max(shape(y, th), Ms.rad(Math.max(0, Math.min(yN - yo, y - yo)), th) + 0.009);
		// the breastplate and backplate: cut high round the neck, scooped deep for the arms (mail shows
		// in the armpit, where the arm lies against the body), the breast
		// coming to a shallow point at the waist; the back's edges under the breast's at the sides
		const bell = (f) => { const d = Math.abs(f - Math.PI / 2); return d < 1.0 ? Math.pow(Math.cos((d / 1.0) * Math.PI / 2), 0.55) : 0; };
		const yTop = (th) => { const f = fOf(th), base = yN - 0.045 + 0.012 * (1 - Math.cos(f)) / 2 - 0.016 * Math.exp(-((f / 0.4) ** 2)); return base - bell(f) * (base - armpit + 0.03); };
		const yBot = (th) => { const f = fOf(th), u = (1 - Math.cos(f)) / 2; return (yW - 0.03 - 0.024 * Math.exp(-((f / 0.35) ** 2))) * (1 - u) + (yW - 0.005) * u; };
		const plateBone = (t) => { const u = Math.max(0, Math.min(1, (cut.chest - yo - t) / 0.2)); return [['spine01', 1 - u * 0.45], ['spine02', u * 0.45]]; };
		const T0 = yW - 0.06 - yo, T1 = yN - 0.02 - yo, TH = 0.0035;
		// (the plackart: a second plate over the belly, its top rising to a point under the tabard
		// and sweeping down toward the sides, lapped over the breastplate's lower edge; the
		// breastplate stops a hand's width under that edge, so the two read as two plates and the
		// belly can bend between them)
		const ym = (yP + yW) / 2, PG = TH + 0.0015, OVL = 0.028;
		const plTop = (th) => { const f = fOf(th); return ym - 0.032 + 0.11 * Math.exp(-((f / 0.6) ** 2)) - 0.01 * Math.max(0, (f - 1.2) / 0.6); };
		// (the plackart wraps only the front: under the arms, where they hang against the body, the
		// breastplate alone runs down to the waist)
		const PA = 1.38, brBot = (th) => { const u = 1 - plUnder(th); return (plTop(th) - OVL) * (1 - u) + yBot(th) * u; };
		// (the breastplate drawn in under the plackart's edge, and the plackart's edge turned out over
		// it, so the step between them throws a shadow)
		const plUnder = (th) => 1 - ss((fOf(th) - PA + 0.12) / 0.2);
		const tuck = (y, th) => 0.006 * plUnder(th) * ss((plTop(th) + 0.004 - y) / 0.02), flare = (y, th) => 0.005 * ss((y - plTop(th) + 0.016) / 0.016);
		const breast = fitTube({ o: O, axis: UP, t0: ym - 0.09 - yo, t1: T1, dt: 0.011, seg: 64, arc: [-1.78, 1.78], span: (th) => [brBot(th) - yo, yTop(th) - yo], floor: (t, th) => shell(yo + t, th) - tuck(yo + t, th), skin: () => false, smooth: 0, wall: 0.001, minR: 0.001, col: c, rim: 0.0012, thick: TH, bone: plateBone });
		const backP = fitTube({ o: O, axis: UP, t0: T0, t1: T1, dt: 0.011, seg: 56, arc: [1.42, Math.PI * 2 - 1.42], span: (th) => [yBot(th) - yo, yTop(th) - yo], floor: (t, th) => shell(yo + t, th) - TH - 0.0015, skin: () => false, smooth: 0, wall: 0.001, minR: 0.001, col: c, rim: 0.0012, thick: TH, bone: plateBone });
		// (their edges rolled: a round bead along the neck and the arm holes)
		const edgeRun = (P, a0, a1, tAt, n, off = 0) => { const pts = []; for (let i = 0; i <= n; i++) { const th = a0 + ((a1 - a0) * i) / n, S = P.at(tAt(th), th, off); pts.push(S); } return pts; };
		const bead = (pts, r = 0.0042) => sweep(pts.map((S) => ({ p: S.p.clone().addScaledVector(S.n, r * 0.35), n: S.n, bone: S.bone })), roundProf(r, 8), c, ARMOUR, 0, 1);
		if (breast) bead(edgeRun(breast, -1.74, 1.74, (th) => yTop(th) - yo - 0.003, 56));
		const plack = fitTube({ o: O, axis: UP, t0: T0, t1: ym + 0.06 - yo, dt: 0.011, seg: 52, arc: [-PA, PA], span: (th) => [yBot(th) - yo, plTop(th) - yo], floor: (t, th) => shell(yo + t, th) + PG + flare(yo + t, th), skin: () => false, smooth: 0, wall: 0.001, minR: 0.001, col: c, rim: 0.0012, thick: TH, bone: plateBone });
		// (its top edge turned out in a roll, and riveted to the breastplate under it at the sides)
		if (plack) {
			// (only beside the tabard: under it the roll would show through the cloth)
			for (const s of [1, -1]) bead(edgeRun(plack, s * 0.36, s * (PA - 0.03), (th) => plTop(th) - yo - 0.003, 24), 0.005);
			for (const th of [-1.2, -0.75, 0.75, 1.2]) rivet(plack.at(plTop(th) - yo - 0.014, th, 0.0005), 0.0036);
		}
		if (backP) bead(edgeRun(backP, 1.46, Math.PI * 2 - 1.46, (th) => yTop(th) - yo - 0.003, 48));
		// (leather straps buckling the back to the breast under each arm, set behind where the arm
		// hangs so it does not lie on them: from the breast's edge across onto the backplate)
		const strapC = q.acc || '#3a2a1e', buckleC = '#4a4842';
		if (breast && backP) for (const s of [1, -1]) {
			const y0 = armpit - 0.05, on = (y, a, h) => (Math.abs(a) <= 1.76 ? breast.at(y, a, h) : backP.at(y, a, h + TH + 0.0015));
			const pts = []; for (let i = 0; i <= 6; i++) pts.push(on(y0 - yo - i * 0.012, s * (1.66 + i * 0.045), TH + 0.002));
			sweep(pts, strapProf(0.02, 0.0025), strapC, LEATHER, 0, 0.5);
			const B0 = on(y0 - yo - 0.024, s * 1.72, TH + 0.004), fr = new THREE.TorusGeometry(0.011, 0.002, 4, 4);
			fr.rotateZ(Math.PI / 4); fr.lookAt(B0.n); fr.translate(B0.p.x, B0.p.y, B0.p.z); put(fr, B0.bone, buckleC, ARMOUR);
		}
		// the fauld: lames hung from the breastplate's lower edge to the hips, each flaring a little
		// and lapping over the one below, riveted at the sides
		const nL = P0.lo ? 3 : 4, yF = cut.hip - 0.035, hL = ((yBot(0) + yBot(Math.PI)) / 2 - yF) / nL;
		const fauldTop = (k, th) => yBot(th) + 0.012 - k * hL, FL = 0.15, OV = 0.014;
		// (lame k's outside at y: tucked in under the plate above it where they lap, a gap's width
		// inside that plate's inside, flaring out only below its edge, so no lame cuts through
		// the one over it)
		const lameR = (k, y, th) => {
			const tp = fauldTop(k, th), above = k ? lameR(k - 1, tp, th) : shell(tp, th) + 0.001 + (Math.abs(th) > 1.42 ? -(TH + 0.0015) : Math.abs(th) <= PA ? PG : 0);
			return above - TH - 0.0015 + shell(y, th) - shell(tp, th) + FL * Math.max(0, tp - OV - y);
		};
		const fauldR = (y, th) => {
			let r = 0;
			for (let k = 0; k < nL; k++) { const tp = fauldTop(k, th); if (y <= tp && y >= tp - hL - 0.012) r = Math.max(r, lameR(k, y, th)); }
			return r;
		};
		// (the inside of the innermost plate at each height and way round, for what is under it)
		const plateIn = (y, th) => {
			let r = y >= yBot(th) ? shell(y, th) + 0.001 - TH - tuck(y, th) - (Math.abs(th) > 1.42 ? TH + 0.0015 : 0) : Infinity;
			for (let k = 0; k < nL; k++) { const tp = fauldTop(k, th); if (y <= tp && y >= tp - hL - 0.012) r = Math.min(r, lameR(k, y, th) - TH); }
			return r === Infinity ? 0 : r;
		};
		const lameBone = (k) => (k === 0 ? [['spine02', 0.5], ['spine04', 0.5]] : k === nL - 1 ? [['spine04', 0.3], ['root', 0.7]] : [['spine04', 0.7], ['root', 0.3]]);
		for (let k = 0; k < nL; k++) {
			const L = fitTube({
				o: O, axis: UP, t0: yF - hL - 0.04 - yo, t1: yBot(Math.PI) + 0.02 - yo, dt: 0.008, seg: 72, span: (th) => [fauldTop(k, th) - hL - 0.012 - yo, fauldTop(k, th) - yo], rows: Math.ceil((hL + 0.012) / 0.008) + 1,
				floor: (t, th) => lameR(k, yo + t, th), skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH, bone: () => lameBone(k),
			});
			if (L) for (const th of [1.32, -1.32, Math.PI - 0.5, 0.5 - Math.PI]) rivet(L.at(fauldTop(k, th) - hL * 0.45 - yo, th, 0.0005), 0.0038);
		}
		if (plack) for (const th of [-1.2, -0.65, 0.65, 1.2]) rivet(plack.at(yBot(th) - yo + 0.008, th, 0.0005), 0.0036);
		// (the outermost plate at each height and way round, for what is worn over it)
		const armR = (y, th) => Math.max(y >= yBot(th) - 0.002 ? shell(y, th) + TH + (y <= plTop(th) + 0.002 && Math.abs(th) <= PA ? PG + flare(y, th) : 0) : 0, fauldR(y, th));
		// (the mail and cloth under the plate pressed in under it, the shift in how the clothes
		// meet the body moved with them, cloth-collide.js)
		const cp = P0.cloth?.attributes.position, ci = P0.cloth?.attributes.clothInset, slot = P0.cloth?.attributes.slot;
		if (cp) for (let i = 0; i < cp.count; i++) {
			const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), dz = z - tz, r = Math.hypot(x, dz);
			if (y > yN || y < yF - hL || (slot && slot.getX(i) % 10 === 1) || r < 1e-4 || (y > armpit - 0.03 && inArm(x))) continue;
			const th = Math.atan2(x, dz), inner = plateIn(y, th) - 0.003;
			if (y > yTop(th) + 0.01 || inner <= 0 || r <= inner) continue;
			const k = inner / r;
			cp.setXYZ(i, x * k, y, tz + dz * k);
			if (ci) ci.setX(i, ci.getX(i) + (r - inner));
		}
		// the tasset: a plate of two lames over the front of each thigh, strapped to the lowest lame
		for (const sd of ['L', 'R']) {
			const ub = 'upperleg01.' + sd, U = heads[map[ub]], Lk = heads[map['lowerleg01.' + sd]]; if (!U || !Lk) continue;
			const sx = Math.sign(U.x) || 1, au = Lk.clone().sub(U).normalize(), out0 = thetaOf(au, V3(sx, 0, 0)), mine = (x) => Math.sign(x) === sx;
			const tA = U.y - yF + 0.015, tL = 0.075;
			const thM = fitTube({ o: U, axis: au, t0: 0.0, t1: 0.3, dt: 0.012, seg: 32, smooth: 20, give: 0, wall: 0, draw: false, skin: (v, x) => part[v] === 4 && mine(x), cloth: (x, y, z, slot, limb) => limb === 2 && mine(x), bone: () => ub });
			if (!thM) continue;
			const thR = (t, th) => thM.rad(Math.max(0, Math.min(0.3, t)), th);
			for (let k = 0; k < 2; k++) {
				const a0 = tA + k * (tL - 0.012);
				fitTube({
					o: U, axis: au, t0: a0, t1: a0 + tL, dt: 0.008, seg: 30, arc: out0 > 0 ? [-0.6, out0 + 0.2] : [out0 - 0.2, 0.6], skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH,
					span: (th) => [a0 + 0.008 * Math.cos(th), a0 + tL - 0.012 * Math.cos(th)],
					floor: (t, th) => thR(t, th) + 0.02 + k * 0.0065 + 0.06 * (t - a0), bone: () => [[ub, 0.8], ['root', 0.2]],
				});
			}
		}
		// the tabard: front and back panels from the neck, over the plate, gathered at the belt and
		// falling in heavy folds below it to a worn, ragged hem at the knee; the order's device on the
		// breast and the skirt, in the weave
		const yBelt = yW - 0.04, beltH = 0.042, tabTop = yN - 0.06;
		let tabR = null;
		if (q.tabard) {
			const cloth = new THREE.Color(q.tabard), trim = new THREE.Color(q.trim || '#8c7a4e'), yc = cut.chest - 0.03;
			const under = (y, th) => Math.max(armR(y, th), M2.rad(Math.max(0, Math.min(yN - yo, y - yo)), th) + 0.014);
			// (below the belt the cloth falls straight from whatever stands furthest out above it)
			const drape = (y, th) => { let r = 0; for (let yy = y; yy < yBelt - beltH / 2; yy += 0.012) r = Math.max(r, under(yy, th)); return Math.max(r, under(yBelt - beltH / 2, th)); };
			const hash = (x) => { const h = Math.sin(x * 127.1) * 43758.5453; return h - Math.floor(h); };
			const hem = (th) => yo + 0.04 + 0.008 * hash(Math.round(th * 26)) + 0.012 * Math.sin(th * 11.3 + 0.7) + 0.007 * Math.sin(th * 29.1) + 0.045 * Math.max(0, Math.sin(th * 6.1 + 0.4) - 0.88) / 0.12;
			const fold = (th) => 0.5 + 0.5 * Math.sin(th * 21 + 1.3 * Math.sin(th * 5.3));
			tabR = (y, th) => {
				const b = y - yBelt;
				// (pressed flat under the belt, puffed a little either side of it, easing out to hang)
				const pinch = armR(yBelt, th) + 0.0015, e = Math.abs(b) - beltH / 2, u = Math.max(0, Math.min(1, (e + 0.004) / 0.03)), w = u * u * (3 - 2 * u);
				const puff = 0.005 * Math.exp(-(((e - 0.01) / 0.01) ** 2));
				if (b > 0) return pinch + (under(y, th) + 0.003 - pinch) * w + puff;
				const g = Math.min(1, Math.max(0, e) / 0.2);
				return pinch + (drape(y, th) + 0.003 - pinch) * w + puff + 0.016 * g * fold(th);
			};
			const w0 = 0.42, w1 = 0.74, lift = (t, th) => { const y = yo + t; if (y > yBelt - beltH / 2) return null; const g = Math.min(1, (yBelt - beltH / 2 - y) / 0.2), f = fold(th); return { tone: 1 - g * (1 - f) * 0.28, dirt: g * (1 - f) * 0.5 }; };
			const paint = (mid) => (t, th, p) => {
				if (mid || Math.abs(th) > 0.5) return null;
				// the order's device, a sword point down on the breast, its cross on the skirt
				const dx = Math.abs(p.x), dy = p.y - yc;
				if ((dx < 0.012 && dy > -0.11 && dy < 0.06) || (dx < 0.055 && Math.abs(dy - 0.045) < 0.01) || Math.hypot(dx, dy - 0.08) < 0.015) return trim;
				const ys = yBelt - 0.16;
				if ((dx < 0.012 && Math.abs(p.y - ys) < 0.06) || (dx < 0.045 && Math.abs(p.y - ys - 0.015) < 0.011)) return trim;
				return null;
			};
			const tabBone = (t, th) => {
				const y = yo + t;
				if (y > cut.hip) return y > cut.chest - 0.08 ? 'spine01' : y > yBelt ? [['spine01', 0.5], ['spine02', 0.5]] : [['spine02', 0.4], ['spine04', 0.6]];
				const u = Math.min(1, (cut.hip - y) / 0.2), wl = Math.max(0, Math.min(1, 0.5 + Math.sin(th) * sL * 1.4));
				return [['spine04', 1 - u * 0.85], ['upperleg01.L', u * 0.85 * wl], ['upperleg01.R', u * 0.85 * (1 - wl)]];
			};
			const cloth0 = { skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: q.tabard, gloss: WOOL, fab: 0, thick: 0.004, stain: false, edge: () => 0, rimCol: cloth.clone().multiplyScalar(0.62), lift, bone: tabBone, floor: (t, th) => tabR(yo + t, th) };
			for (const mid of [0, Math.PI]) {
				// (the breast panel, its top under the gorget; the skirt, its top under the belt)
				fitTube({ ...cloth0, o: O, axis: UP, t0: yBelt - 0.015 - yo, t1: tabTop - yo, dt: 0.013, seg: 24, arc: [mid - w0, mid + w0], paint: paint(mid) });
				fitTube({ ...cloth0, o: O, axis: UP, t0: 0, t1: yBelt + 0.012 - yo, dt: 0.013, seg: 48, arc: [mid - w1, mid + w1], span: (th) => [hem(th) - yo, yBelt + 0.012 - yo], paint: paint(mid) });
			}
		}
		// the belt, buckled at the front, its tongue hanging
		// (round everything under its whole width, the plate's edges and the tabard's sides, then
		// eased round the waist so it never steps where what is under it does)
		const NB = 96, BR = [];
		for (let i = 0; i < NB; i++) {
			const th = (i / NB) * Math.PI * 2;
			let r = 0; for (let k = -2; k <= 2; k++) r = Math.max(r, armR(yBelt + (k * beltH) / 4, th));
			if (tabR && Math.abs(Math.sin(th)) < 0.72) r = Math.max(r, tabR(yBelt, th) + 0.004);
			BR.push(r + 0.001);
		}
		for (let it = 0; it < 5; it++) { const c0 = BR.slice(); for (let i = 0; i < NB; i++) BR[i] = Math.max(c0[i], (c0[(i + NB - 1) % NB] + c0[i] * 2 + c0[(i + 1) % NB]) / 4); }
		const beltR = (th) => { const f = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * NB, i = Math.floor(f) % NB, u = f - Math.floor(f); return BR[i] * (1 - u) + BR[(i + 1) % NB] * u; };
		const beltBone = [['spine02', 0.4], ['spine04', 0.6]], dirR = (th) => V3(Math.sin(th), 0, Math.cos(th));
		const beltPts = []; for (let i = 0; i < 96; i++) { const th = (i / 96) * Math.PI * 2, d = dirR(th); beltPts.push({ p: V3(d.x * beltR(th), yBelt, tz + d.z * beltR(th)), n: d, bone: beltBone }); }
		sweep(beltPts, strapProf(beltH, 0.005), q.belt || '#2e2219', LEATHER, 0, 0.6, true);
		{
			const r0 = beltR(0) + 0.006, fr = new THREE.TorusGeometry(0.026, 0.0048, 6, 4);
			fr.rotateZ(Math.PI / 4); fr.scale(1, 1.2, 1); fr.translate(0, yBelt, tz + r0); put(fr, beltBone, '#4b4944', ARMOUR);
			const tongue = new THREE.CylinderGeometry(0.0028, 0.0028, 0.034, 6); tongue.translate(0, yBelt, tz + r0 + 0.001); put(tongue, beltBone, '#4b4944', ARMOUR);
			const tip = []; for (let i = 0; i <= 8; i++) { const th = 0.1 + i * 0.004, y = yBelt - 0.005 - i * 0.012, d = dirR(th), r = beltR(th) + 0.006 + i * 0.0006; tip.push({ p: V3(d.x * r, y, tz + d.z * r), n: d, bone: beltBone }); }
			sweep(tip, strapProf(0.034, 0.005), q.belt || '#2e2219', LEATHER, 0, 0.6);
		}
		// the gorget: three lames round the neck, each lapping the one below, the lowest over the
		// breastplate's collar and the tabard's top
		{
			const gTop = cut.neck + 0.035, gBot = yN - 0.078, hG = (gTop - gBot) / 3;
			const Mn = fitTube({ o: O, axis: UP, t0: gBot - yo - 0.03, t1: gTop - yo + 0.03, dt: 0.008, seg: 48, smooth: 12, give: 0, wall: 0, bone: () => 'neck01', draw: false, skin: (v, x, y) => part[v] === 0 && y > gBot - 0.04 && y < gTop + 0.04 && Math.abs(x) < 0.085 });
			const plateR = (y, th) => (y >= yBot(th) && y <= yTop(th) + 0.008 ? shell(y, th) + TH + 0.0075 : 0);
			const tabTopR = (y, th) => (tabR && y < tabTop + 0.006 && (fOf(th) < 0.47 || fOf(th) > Math.PI - 0.47) ? tabR(y, th) + 0.007 : 0);
			// (each lame's reach round the neck, never under what it laps over below it, smoothed
			// round so it runs clean)
			const NT = 96, reachK = (k) => {
				const tp = gTop - k * hG, R = new Float32Array(NT);
				for (let j = 0; j < NT; j++) {
					const th = (j / NT) * Math.PI * 2;
					let r = Mn.rad(Math.max(gBot - yo - 0.03, Math.min(gTop - yo + 0.03, tp - hG / 2 - yo)), th) + 0.012 + k * 0.008;
					for (let y = tp - hG - 0.012; y <= tp; y += 0.004) r = Math.max(r, plateR(y, th), tabTopR(y, th));
					R[j] = r;
				}
				for (let p = 0; p < 6; p++) { const C = R.slice(); for (let j = 0; j < NT; j++) R[j] = Math.max(C[j] - 0.002, (C[(j + NT - 1) % NT] + C[j] * 2 + C[(j + 1) % NT]) / 4); }
				return (th) => { const f = ((((th / (Math.PI * 2)) % 1) + 1) % 1) * NT, j = Math.floor(f) % NT, u = f - Math.floor(f); return R[j] * (1 - u) + R[(j + 1) % NT] * u; };
			};
			if (Mn) for (let k = 0; k < 3; k++) {
				const tp = gTop - k * hG, rk = reachK(k);
				const L = fitTube({
					o: O, axis: UP, t0: tp - hG - 0.012 - yo, t1: tp - yo, dt: 0.006, seg: 56, skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH,
					floor: (t, th) => rk(th) + 0.2 * (tp - yo - t) - 0.002,
					bone: () => (k === 0 ? 'neck01' : k === 1 ? [['neck01', 0.5], ['spine01', 0.5]] : 'spine01'),
				});
				if (L && k === 2) for (const th of [0.9, -0.9]) rivet(L.at(tp - hG * 0.5 - yo, th, 0.0004), 0.0038);
			}
		}
		// the pauldrons: a dome round each shoulder joint, its rim rolled, and three lames lapping
		// down the arm under it, each riveted at its ends; plate down the upper arm below them
		for (const sd of ['L', 'R']) {
			const ub = 'upperarm01.' + sd, S = heads[map[ub]], E = heads[map['lowerarm01.' + sd]]; if (!S || !E) continue;
			const sx = Math.sign(S.x) || 1, len = S.distanceTo(E), ax = E.clone().sub(S).normalize(), outA = thetaOf(ax, V3(sx, 0, 0));
			const mine = (x) => x * sx > Math.abs(S.x) * 0.5;
			// (the cap: an ellipsoid over the joint, flatter than it is wide and longer front to back
			// than across, grown until it holds every bit of the shoulder under it, then stood off it)
			const C = S.clone().add(V3(-sx * 0.012, -0.012, 0)), d = V3(sx * 0.5, 0.86, 0).normalize();
			const f0 = V3(0, 0, 1).projectOnPlane(d).normalize(), s0 = V3(0, 0, 0).crossVectors(d, f0), fb = 1.16;
			let e = 0;
			for (let i = 0, v = 0; i < nSkin; i += 3, v++) {
				if ((part[v] !== 0 && part[v] !== 1) || !mine(skinP[i])) continue;
				const px = skinP[i] - C.x, py = skinP[i + 1] - C.y, pz = skinP[i + 2] - C.z;
				if (px * px + py * py + pz * pz > 0.095 * 0.095 || px * sx < -0.02) continue;
				const t = px * d.x + py * d.y + pz * d.z; if (t < -0.015) continue;
				const a = px * f0.x + py * f0.y + pz * f0.z, b = px * s0.x + py * s0.y + pz * s0.z;
				e = Math.max(e, Math.sqrt((t / 0.75) ** 2 + (a / fb) ** 2 + b * b));
			}
			const Rp = Math.min(0.085 * kH, Math.max(0.05, e)) + 0.022, Rd = Rp * 0.75;
			const inA = thetaOf(d, V3(-sx, 0, 0));
			const capLo = (th) => -Rd * 0.55 + Rd * 0.62 * Math.max(0, Math.cos(angGap(th, inA))) ** 2;
			const cap = fitTube({
				o: C, axis: d, t0: -Rd * 0.6, t1: Rd, dt: 0.0065, seg: 56, span: (th) => [capLo(th), Rd],
				floor: (t, th) => { const k = Math.sqrt(Math.max(0, 1 - (t / Rd) ** 2)), c0 = Math.cos(th), s1 = Math.sin(th); return k / Math.sqrt((c0 / (Rp * fb)) ** 2 + (s1 / Rp) ** 2); },
				skin: () => false, smooth: 0, wall: 0, minR: 0.0003, closeB: 0.001, col: c, thick: TH, rim: 0.0015,
				// (its inner side, toward the neck, rides the collarbone more than the arm, so it does not
				// swing into the backplate as the arm swings)
				bone: (t, th) => { const m = Math.max(0, Math.cos(angGap(th, inA))) ** 2; return [['shoulder01.' + sd, 0.4 + 0.45 * m], [ub, 0.6 - 0.45 * m]]; },
			});
			if (cap) { const pts = edgeRun(cap, 0, Math.PI * 2, (th) => capLo(th) + 0.003, 56); pts.pop(); sweep(pts.map((S2) => ({ p: S2.p.clone().addScaledVector(S2.n, 0.0016), n: S2.n, bone: S2.bone })), roundProf(0.0045, 8), c, ARMOUR, 0, 1, true); }
			// (the lames, measured round the arm, each lapping over the next)
			const gA = limbGirth(ub, 1, 0.08, 0.16).skinR;
			for (let k = 0; k < 3; k++) {
				const tk = 0.035 + k * 0.032, w = 1.5 - k * 0.12;
				const L = fitTube({
					o: S, axis: ax, t0: tk - 0.01, t1: tk + 0.05, dt: 0.0065, seg: 40, arc: [outA - w, outA + w], skin: () => false, smooth: 0, wall: 0, minR: 0.001,
					span: (th) => { const u = (angGap(th, outA) / w) ** 2; return [tk + 0.006 * u, tk + 0.042 - 0.012 * u]; },
					floor: (t) => gA + 0.034 - k * 0.0065 + 0.08 * (t - tk), col: c, thick: TH, bone: () => [['shoulder01.' + sd, 0.3 - k * 0.1], [ub, 0.7 + k * 0.1]],
				});
				if (L) for (const s2 of [1, -1]) rivet(L.at(tk + 0.02, outA + s2 * (w - 0.16), 0.0004), 0.0034);
			}
			// (the rerebrace: a tube round the arm's own flesh, measured from the arm alone so the
			// armpit and the side of the body under it are not taken in (they swell it into a flap
			// that swings into the breastplate when the arm hangs), close on the side toward the
			// body and a little fuller outside, the sleeve pressed in under it)
			const nearArm = (x, y, z) => { const dx = x - S.x, dy = y - S.y, dz = z - S.z, t = dx * ax.x + dy * ax.y + dz * ax.z; return Math.hypot(dx - ax.x * t, dy - ax.y * t, dz - ax.z * t) < 0.075 * kH; };
			const uaM = fitTube({ o: S, axis: ax, t0: 0.1, t1: len - 0.02, dt: 0.01, seg: 28, smooth: 10, give: 0, wall: 0, draw: false, bone: () => ub, skin: (v, x, y, z) => part[v] === 1 && Math.sign(x) === sx && nearArm(x, y, z) });
			const rere = uaM && fitTube({
				o: S, axis: ax, t0: 0.12, t1: len - 0.04, dt: 0.01, col: c, seg: 28, thick: TH, skin: () => false, smooth: 0, wall: 0, minR: 0.001,
				floor: (t, th) => uaM.rad(t, th) + 0.005 + 0.009 * Math.max(0, Math.cos(angGap(th, outA))) + 0.006 * Math.max(0, (t - (len - 0.1)) / 0.06),
				lift: (t) => ({ seam: Math.abs(t - (len - 0.1)) < 0.003 ? 0.7 : 0 }),
				bone: () => ub,
			});
			rere?.press((x, y, z, slot, limb) => limb === 1 && Math.sign(x) === sx);
		}
		return armR;
	};
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
		// (the heroes' own compact carrier, made to their concept, below: people/hero.js)
		} else if (q.kind === 'carrier' && !q.police && !q.compact && P0.part) {
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
			const kit = (geo, bone, col, gloss = 0.05, fab = 2) => (q.camo && typeof col !== 'string' ? putShade(geo, bone, col, gloss, fab) : put(geo, bone, typeof col === 'string' ? col : c, gloss, fab));
			const solid = (k) => (q.camo ? k : null);
			// (the frame of what is fixed at S: its back on the surface, +z out, +y up)
			const frame = (S) => { const z = S.n.clone(), y = UP.clone().projectOnPlane(z).normalize(), x = V3(0, 0, 0).crossVectors(y, z); return new THREE.Matrix4().makeBasis(x, y, z).setPosition(S.p); };
			const tie = (geo, S) => geo.applyMatrix4(frame(S));
			// (the pouches, the radio and the rest as real models once they are in, people/kit-models.js)
			const real = !!A.kit?.parts.magpouch;
			// (a sewn box of nylon, its bound edges scuffed and holding grime in the seams, propkit.js)
			const box = (w, h, d, r = 0.006, n = 3) => {
				const g = new RoundedBoxGeometry(w, h, d, n, r), pa = g.attributes.position, wr = new Float32Array(pa.count * 2);
				for (let i = 0; i < pa.count; i++) {
					const e = (Math.abs(pa.getX(i)) > w / 2 - r * 1.01 ? 1 : 0) + (Math.abs(pa.getY(i)) > h / 2 - r * 1.01 ? 1 : 0) + (Math.abs(pa.getZ(i)) > d / 2 - r * 1.01 ? 1 : 0);
					wr[i * 2] = e >= 2 ? 0.8 : 0; wr[i * 2 + 1] = e >= 2 ? 0.45 : 0;
				}
				g.setAttribute('wear', new THREE.BufferAttribute(wr, 2));
				return g;
			};
			const shade = (c0, k) => new THREE.Color(c0).multiplyScalar(k).getHex();
			// (a magazine pouch, its back on the surface at S: open at the top, a band of elastic
			// across its front, the magazine standing well out of it with its base plate up and a
			// bungee over that to a pull tab on the front)
			const magPouch = (S, bone, w = 0.066, h = 0.11, d = 0.036) => {
				const body = solid(pouchCol) || a2;
				if (real) { putPart('magpouch', frame(S), bone, body, [w / 0.066, h / 0.11, d / 0.036]); putPart('mag', frame(S), bone, q.mags || '#2a2b28', [w / 0.066, 1, d / 0.036]); return; }
				kit(tie(box(w, h, d, 0.0065).translate(0, -h / 2, d / 2), S), bone, body, NYLON, 0);
				put(tie(new THREE.BoxGeometry(w - 0.01, 0.003, d - 0.01).translate(0, 0.0004, d / 2), S), bone, '#0a0a09', NYLON);
				put(tie(box(w + 0.002, 0.016, 0.004, 0.0015, 1).translate(0, -h * 0.58, d + 0.0005), S), bone, shade(a2, 0.68), NYLON);
				const mc = q.mags || '#2a2b28';
				put(tie(box(0.026, 0.05, d * 0.64, 0.003, 2).translate(0, 0.008, d / 2), S), bone, mc, POLY);
				put(tie(box(0.03, 0.009, d * 0.72, 0.003, 2).translate(0, 0.036, d / 2), S), bone, shade(mc, 0.7), POLY);
				put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, 0.03, 0.004), V3(0, 0.0435, d * 0.35), V3(0, 0.043, d * 0.8), V3(0, 0.026, d + 0.002), V3(0, 0.002, d + 0.003)].map((v) => tie(new THREE.BufferGeometry().setFromPoints([v]), S).attributes.position).map((a) => V3(a.getX(0), a.getY(0), a.getZ(0)))), 12, 0.0017, 5, false), bone, '#111110', RUBBER);
				put(tie(box(0.015, 0.022, 0.004, 0.0015, 1).translate(0, -0.008, d + 0.003), S), bone, '#1b1b19', RUBBER);
			};
			const frontAt = (tube, y, x, off = 0) => tube.at(y - yo, Math.atan2(x, Math.max(0.05, tube.rad(y - yo, 0) - 0.01)), off);
			let front = null, back = null;
			if (!q.rig) {
				// (each bag a slab holding its plate, measured to the body and pressed onto it, the
				// shirt flattened under it; its edges eased round)
				const shirt = (x, y, z, slot, limb) => limb === 0 && slot !== 2;
				front = fitTube({
					o: O, axis: UP, t0: yPB - 0.01 - yo, t1: yPT - yo, dt: 0.008, arc: [-thF, thF], seg: 30, wall: 0.034, smooth: 90, give: 0.03, thick: 0.024,
					span: (th) => { const f = Math.abs(th) / thF; return [yPB - yo + 0.014 * sm(0.7, 1, f), yPT - yo - 0.07 * sm(0.38, 1, f)]; },
					col: c, paint: pcol, gloss: NYLON, stain: false, edge: (d) => -0.006 * Math.max(0, 1 - d / 2) ** 2, skin: skinT, bone: bodyBone,
				});
				back = fitTube({
					o: O, axis: UP, t0: yPB - 0.01 - yo, t1: yPT - yo + 0.02, dt: 0.008, arc: [Math.PI - thB, Math.PI + thB], seg: 30, wall: 0.032, smooth: 90, give: 0.03, thick: 0.022,
					span: (th) => { const f = Math.abs(th - Math.PI) / thB; return [yPB - yo + 0.014 * sm(0.7, 1, f), yPT - yo + 0.02 - 0.06 * sm(0.42, 1, f)]; },
					col: c, paint: pcol, gloss: NYLON, stain: false, edge: (d) => -0.006 * Math.max(0, 1 - d / 2) ** 2, skin: skinT, bone: bodyBone,
				});
				front?.press(shirt, 0.002); back?.press(shirt, 0.002);
				// (rows of webbing to hang pouches on, stitched down at each column)
				const webbing = (P, a0, a1, y0, n, y1) => {
					if (!P) return;
					for (let r = 0; r < n; r++) {
						const y = y0 + r * 0.038; if (y > y1) break;
						const n2 = P0.lo ? 8 : 18, pts = []; for (let i = 0; i <= n2; i++) { const th = a0 + ((a1 - a0) * i) / n2; pts.push(P.at(y - yo, th, -0.0004)); }
						sweep(pts, strapProf(0.025, 0.0016), shade(q.camo ? (CAMO[q.camo] || CAMO.multicam)[0] : c, 0.9), NYLON, 0, 0.6);
						if (!P0.lo) for (let i = 1; i < 18; i += 3) { const th = a0 + ((a1 - a0) * i) / 18, S = P.at(y - yo, th, 0.0014); put(tie(new THREE.BoxGeometry(0.0022, 0.022, 0.0008), S), bodyBone(y - yo), '#20201c', NYLON); }
					}
				};
				webbing(front, -thF * 0.9, thF * 0.9, yPB + 0.016, 4, yPT - 0.075);
				webbing(back, Math.PI - thB * 0.9, Math.PI + thB * 0.9, yPB + 0.016, 5, yPT - 0.06);
				// (the cummerbund, each side from under the front plate round to under the back,
				// pulled snug over the shirt)
				for (const sd of [1, -1]) {
					const A = sd * thF * 0.8, Bt = sd * (Math.PI - thB * 0.8);
					const cb = fitTube({
						o: O, axis: UP, t0: yPB - 0.012 - yo, t1: yPB + 0.15 - yo, dt: 0.008, arc: sd > 0 ? [A, Bt] : [Bt, A], seg: 28, wall: 0.016, smooth: 14, give: 0.012, thick: 0.008,
						col: c, paint: pcol, gloss: NYLON, stain: false, edge: (d) => -0.006 * Math.max(0, 1 - d / 2), skin: skinT, bone: bodyBone,
					});
					cb?.press(shirt, 0.002);
					webbing(cb, sd > 0 ? A + 0.25 : Bt + 0.2, sd > 0 ? Bt - 0.2 : A - 0.25, yPB + 0.02, 3, yPB + 0.13);
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
			// (the straps over the shoulders: padded, each laid over the top of its shoulder from
			// under the front bag's top to under the back's, bridging the hollows, the shirt pressed
			// flat under it)
			for (const sd of [1, -1]) {
				const xs = sd * Math.min(0.1, cut.shoulderX * 0.5), C = V3(xs, yPT - 0.075, tz), ax = V3(sd, 0, 0);
				const strap = fitTube({
					o: C, axis: ax, t0: -0.027, t1: 0.027, dt: 0.009, seg: 40, arc: sd > 0 ? [-Math.PI - 0.2, 0.2] : [-0.2, Math.PI + 0.2], wall: 0.004, smooth: 30, give: 0, thick: 0.009,
					col: c, paint: pcol, gloss: NYLON, stain: false, edge: (d) => -0.004 * Math.max(0, 1 - d / 2), bone: () => 'spine01',
					skin: (v, x, y) => part[v] === 0 && y > yPT - 0.12 && y < cut.neck + 0.03 && Math.abs(x - xs) < 0.04, cloth: (x, y, z, slot, limb) => limb === 0 && y > yPT - 0.12 && y < cut.neck + 0.03 && Math.abs(x - xs) < 0.04,
				});
				strap?.press((x, y, z, slot, limb) => limb === 0, 0.003);
				// (the buckle that adjusts it, at the front)
				if (strap) { const S = strap.at(0, sd > 0 ? -0.55 : 0.55, 0.004); if (!(real && putPart('buckle', frame(S), 'spine01', '#1a1b18'))) put(tie(box(0.05, 0.016, 0.006, 0.002, 1), S), 'spine01', '#1a1b18', POLY); }
			}
			if (front) {
				const fb = (y) => torso(y);
				if (!q.rig) {
					// the shingle of magazine pouches
					const yTopM = yPB + 0.122;
					for (const i of [-1, 0, 1]) magPouch(frontAt(front, yTopM, i * 0.071, 0.002), fb(yTopM - 0.05));
					// the admin pouch, its loop patch and its zip
					const yA = Math.min(yPT - 0.07, yPB + 0.225), A0 = frontAt(front, yA, 0, 0.002);
					if (real) putPart('admin', frame(A0), fb(yA), solid(pouchCol) || a2);
					else {
					kit(tie(box(0.17, 0.09, 0.024, 0.008).translate(0, 0, 0.012), A0), fb(yA), solid(pouchCol) || a2, NYLON, 0);
					put(tie(box(0.084, 0.05, 0.003, 0.0015, 1).translate(-0.03, 0.004, 0.0245), A0), fb(yA), shade(a2, 0.7), NYLON);
					put(tie(box(0.05, 0.03, 0.002, 0.001, 1).translate(-0.03, 0.004, 0.0265), A0), fb(yA), '#5d5b4f', NYLON);
					put(tie(new THREE.BoxGeometry(0.15, 0.004, 0.003).translate(0, 0.04, 0.0235), A0), fb(yA), '#121211', POLY);
					put(tie(box(0.008, 0.018, 0.004, 0.0015, 1).translate(0.06, 0.029, 0.026), A0), fb(yA), '#1a1a18', RUBBER);
					}
					// the dangler under the plate
					const probe = fitTube({ o: O, axis: UP, t0: yo - 0.08 - yo, t1: yPB - yo + 0.02, dt: 0.01, seg: 32, wall: 0.03, skin: (v, x, y) => (part[v] === 0 || part[v] === 4) && y > yo - 0.1 && y < yPB + 0.05, cloth: (x, y, z, slot, limb) => limb !== 1 && y > yo - 0.1 && y < yPB + 0.05, col: c, draw: false, bone: bodyBone });
					const Dn = probe.at(yPB - 0.046 - yo, 0, 0.004);
					if (!(real && putPart('dangler', frame(Dn), torso(yPB), solid(pouchCol) || a2))) {
						kit(tie(box(0.2, 0.08, 0.044, 0.016).translate(0, 0, 0.022), Dn), torso(yPB), solid(pouchCol) || a2, NYLON, 0);
						put(tie(new THREE.BoxGeometry(0.17, 0.004, 0.003).translate(0, 0.034, 0.043), Dn), torso(yPB), '#121211', POLY);
						put(tie(box(0.008, 0.02, 0.004, 0.0015, 1).translate(0.075, 0.024, 0.045), Dn), torso(yPB), '#1a1a18', RUBBER);
					}
				} else {
					const yTopM = yPB + 0.13;
					for (const i of [-1.5, -0.5, 0.5, 1.5]) magPouch(frontAt(front, yTopM, i * 0.066, 0.002), fb(yTopM - 0.05), 0.062, 0.12, 0.034);
				}
				// the radio on the left, its antenna, the cable up to the talk switch on the strap
				const sideAt = (y, th, off) => (q.rig ? front.at(y - yo, th, off) : null);
				const rTh = Math.PI / 2 + 0.2, rY = yPB + 0.075;
				const probeS = fitTube({ o: O, axis: UP, t0: yo - yo, t1: yPT - yo, dt: 0.012, seg: 40, wall: q.rig ? 0.012 : 0.02, skin: skinT, cloth: clothT, col: c, draw: false, bone: bodyBone });
				const Rr = sideAt(rY, rTh, 0) || probeS.at(rY - yo, rTh, 0.002);
				if (!(real && putPart('radio', frame(Rr), torso(rY), solid(pouchCol) || a2))) {
					kit(tie(box(0.066, 0.12, 0.04, 0.007).translate(0, 0, 0.02), Rr), torso(rY), solid(pouchCol) || a2, NYLON, 0);
					put(tie(box(0.056, 0.05, 0.03, 0.005).translate(0, 0.062, 0.02), Rr), torso(rY), '#232421', POLY);
					for (const [x, r] of [[-0.012, 0.0065], [0.012, 0.005]]) put(tie(new THREE.CylinderGeometry(r, r, 0.012, 12).translate(x, 0.093, 0.02), Rr), torso(rY), '#121211', RUBBER);
				}
				const top0 = V3(0, 0.09, 0.024).applyMatrix4(new THREE.Matrix4().makeBasis(V3(0, 0, 0).crossVectors(UP.clone().projectOnPlane(Rr.n).normalize(), Rr.n), UP.clone().projectOnPlane(Rr.n).normalize(), Rr.n).setPosition(Rr.p));
				const ant = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top0, top0.clone().add(V3(0.004, 0.09, -0.012)), top0.clone().add(V3(0.006, 0.19, -0.04))]), 8, 0.0035, 6, false);
				put(ant, torso(rY), '#161614', 0.2);
				const ptt = front.at(Math.min(yPT - 0.06, yPB + 0.2) - yo, thF * 0.82, q.rig ? 0.02 : 0.004);
				if (!(real && putPart('ptt', frame(ptt), torso(ptt.p.y), '#1b1c1a'))) put(tie(new RoundedBoxGeometry(0.034, 0.04, 0.018, 2, 0.006).translate(0, 0, 0.009), ptt), torso(ptt.p.y), '#1b1c1a', 0.3);
				const mid = probeS.at(yPB + 0.16 - yo, (rTh + thF) / 2, 0.012).p;
				put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top0.clone().add(V3(-0.01, -0.012, 0.004)), mid, ptt.p.clone().addScaledVector(ptt.n, 0.008).add(V3(0, -0.02, 0))]), 16, 0.003, 5, false), 'spine02', '#141413', 0.2);
				// the medical pouch on the right, its red pull tab; a tourniquet on the front
				const mTh = -(Math.PI / 2 + 0.2), Mr = sideAt(rY, mTh, 0) || probeS.at(rY - yo, mTh, 0.002);
				if (!(real && putPart('med', frame(Mr), torso(rY), solid(pouchCol) || a2))) {
					kit(tie(box(0.095, 0.11, 0.05, 0.012).translate(0, 0, 0.025), Mr), torso(rY), solid(pouchCol) || a2, NYLON, 0);
					// (its flap folded over the top, its edge proud of the front)
					kit(tie(box(0.099, 0.042, 0.012, 0.005).translate(0, 0.038, 0.046), Mr), torso(rY), solid(pouchCol) || shade(a2, 0.92), NYLON, 0);
					put(tie(box(0.03, 0.026, 0.005, 0.002, 1).translate(0, 0.06, 0.05), Mr), torso(rY), '#8a2a22', RUBBER);
				}
				const tq = probeS.at(yPB + 0.075 - yo, -(thF + 0.32), q.rig ? 0.01 : 0.022);
				if (!(real && putPart('tq', frame(tq), torso(tq.p.y), '#121212'))) {
					const tqG = new THREE.CylinderGeometry(0.013, 0.013, 0.1, 10); put(tie(tqG.translate(0, 0, 0.012), tq), torso(tq.p.y), '#121212', 0.2, 2);
					put(tie(new RoundedBoxGeometry(0.02, 0.016, 0.006, 1, 0.002).translate(0, 0.055, 0.016), tq), torso(tq.p.y), '#9a2b22', 0.1, 3);
				}
			}
			if (back) {
				// the zip-on panel and the drag handle
				const yM = (yPB + yPT) / 2, Bk = back.at(yM - yo, Math.PI, 0.002);
				if (!(real && putPart('back', frame(Bk).multiply(new THREE.Matrix4().makeTranslation(0, -0.01, 0)), torso(yM), solid(pouchCol) || a2, [(hw * 1.75) / 0.21, ((yPT - yPB) * 0.8) / 0.28, 1]))) {
					kit(tie(box(hw * 1.75, (yPT - yPB) * 0.8, 0.034, 0.014).translate(0, -0.01, 0.017), Bk), torso(yM), solid(pouchCol) || a2, NYLON, 0);
					put(tie(new THREE.BoxGeometry(0.004, (yPT - yPB) * 0.72, 0.004).translate(hw * 0.84, -0.01, 0.03), Bk), torso(yM), '#151513', 0.3);
					put(tie(new THREE.BoxGeometry(0.004, (yPT - yPB) * 0.72, 0.004).translate(-hw * 0.84, -0.01, 0.03), Bk), torso(yM), '#151513', 0.3);
				}
				const Hd = back.at(yPT - 0.01 - yo, Math.PI, 0.004), hd = new THREE.TorusGeometry(0.03, 0.007, 5, 10, Math.PI);
				if (!(real && putPart('handle', frame(Hd), 'spine01', '#22231f'))) put(tie(hd.scale(1, 0.9, 1.6).translate(0, 0.004, 0.004), Hd), 'spine01', '#22231f', 0.1, 2);
			}
		} else if (q.kind === 'carrier') {
			// front and back plates made to the chest and back, a cummerbund round the waist,
			// straps over the shoulders, pouches on the plate (a police vest: a radio, a badge
			// and a reflective band) (garment-kit.js)
			const pieces = carrierGeometry(cut, kitField(), { police: !!q.police, lo: !!P0.lo, compact: !!q.compact });
			const flap = new THREE.Color(a2).multiplyScalar(0.82).getHex(), web = new THREE.Color(a2).multiplyScalar(0.9).getHex(), patch = new THREE.Color(a2).multiplyScalar(0.72).getHex();
			// (webbing in nylon, the patch in a loop pile; the rest cordura) (a chest rig: the
			// pouches on their harness, no plates and no cummerbund)
			for (const { geo, part: pc } of pieces) if (!(q.rig && (pc === 'plate' || pc === 'tape' || pc === 'band'))) put(geo, pc === 'strap' ? 'spine01' : torso, pc === 'band' || pc === 'pouch' ? a2 : pc === 'flap' ? flap : pc === 'tape' ? '#80868d' : pc === 'web' ? web : pc === 'patch' ? patch : c, pc === 'tape' ? 0.5 : pc === 'web' ? 0.08 : 0, pc === 'tape' ? 0 : pc === 'web' ? 1 : pc === 'patch' ? 6 : 2);
			if (q.police) {
				const w = Math.min(0.33, cut.shoulderX * 1.6), y = cut.chest + 0.06, x = w * 0.26;
				const bd = new THREE.CylinderGeometry(0.02, 0.02, 0.005, 6); bd.rotateX(Math.PI / 2); bd.translate(x, y, kitField().front(x, y) + 0.012 + 0.024 + 0.002); put(bd, 'spine01', q.badge || '#d9c46a', 2);
			}
		} else if (q.kind === 'cuirass') {
			harness(q, c);
		} else if (q.kind === 'greaves') {
			// plate made to the legs, each piece drawn to its form over a broad measure of the leg and
			// what is worn on it: a cuisse over the front and outside of the thigh, ridged, its top
			// edge rolled; a poleyn, a cop domed over the knee with a cupped fan on the outside and a
			// lame above and below it; a greave closed round the shin, ridged down the front, rolled
			// at the top and flaring over the foot, hinged on the outside
			const part = P0.part, TH = 0.0035;
			for (const sd of ['L', 'R']) {
				const ub = 'upperleg01.' + sd, lb = 'lowerleg01.' + sd, U = heads[map[ub]], L = heads[map[lb]], F = heads[map['foot.' + sd]]; if (!U || !L || !F) continue;
				const sx = Math.sign(U.x) || 1, lu = U.distanceTo(L), ll = L.distanceTo(F), mine = (x) => Math.sign(x) === sx;
				const au = L.clone().sub(U).normalize(), al = F.clone().sub(L).normalize(), outU = thetaOf(au, V3(sx, 0, 0)), outL = thetaOf(al, V3(sx, 0, 0));
				const ridge = (th, r, h, w) => h * Math.max(0, 1 - Math.abs(r * Math.sin(th)) / w) * Math.max(0, Math.cos(th));
				const legCloth = (x, y, z, slot, limb) => limb === 2 && mine(x);
				const thigh = fitTube({ o: U, axis: au, t0: 0.08, t1: lu + 0.02, dt: 0.012, seg: 32, smooth: 20, give: 0, wall: 0, draw: false, skin: (v, x) => part[v] === 4 && mine(x), cloth: legCloth, bone: () => ub });
				const shin = fitTube({ o: L, axis: al, t0: -0.09, t1: ll - 0.01, dt: 0.012, seg: 32, smooth: 20, give: 0, wall: 0, draw: false, skin: (v, x) => (part[v] === 5 || part[v] === 4) && mine(x), cloth: legCloth, bone: () => lb });
				if (!thigh || !shin) continue;
				const tR = (t, th) => thigh.rad(Math.max(0.08, Math.min(lu + 0.02, t)), th), sR = (t, th) => shin.rad(Math.max(-0.09, Math.min(ll - 0.01, t)), th);
				const plate = { skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: TH };
				// the cuisse
				const c0 = 0.2, c1 = lu - 0.055, arcU = outU > 0 ? [-0.95, outU + 0.55] : [outU - 0.55, 0.95];
				const cuisse = fitTube({ ...plate, o: U, axis: au, t0: c0, t1: c1, dt: 0.012, seg: 36, arc: arcU, span: (th) => [c0 + 0.012 * Math.cos(th), c1], floor: (t, th) => { const r = tR(t, th) + 0.016; return r + ridge(th, r, 0.007, 0.03); }, bone: () => ub });
				if (cuisse) { const pts = []; for (let i = 0; i <= 24; i++) { const th = arcU[0] + 0.04 + ((arcU[1] - arcU[0] - 0.08) * i) / 24; pts.push(cuisse.at(c0 + 0.012 * Math.cos(th) + 0.003, th, 0.0014)); } sweep(pts, roundProf(0.004, 8), c, ARMOUR, 0, 1); }
				// the poleyn: its cop, the fan, a lame above and below
				const lens = (a, b, w) => (th) => { const u = (th / w) ** 2; return [a + 0.018 * u, b - 0.018 * u]; };
				// (the cop and fan ride half with the thigh, half with the shin, so they turn half as far as
				// the knee bends and stay over it; the lames above and below lean to their own bone)
				const knee = [[ub, 0.5], [lb, 0.5]];
				fitTube({ ...plate, o: L, axis: al, t0: -0.05, t1: 0.05, dt: 0.006, seg: 40, arc: [-1.35, 1.35], span: lens(-0.048, 0.046, 1.35), floor: (t, th) => sR(t, th) + 0.024 + 0.014 * Math.sqrt(Math.max(0, 1 - (t / 0.048) ** 2 - (th / 1.25) ** 2)) + ridge(th, 0.06, 0.003, 0.012), bone: () => knee });
				const fanA = outL + (outL > 0 ? 0.12 : -0.12);
				fitTube({ ...plate, o: L, axis: al, t0: -0.042, t1: 0.044, dt: 0.006, seg: 28, arc: [fanA - 0.62, fanA + 0.62], span: (th) => { const u = ((th - fanA) / 0.62) ** 2; return [-0.04 + 0.03 * u, 0.042 - 0.03 * u]; }, floor: (t, th) => sR(t, th) + 0.034 + 0.012 * ((th - fanA) / 0.62) ** 2 - 0.006 * Math.abs(th - fanA) / 0.62, bone: () => knee });
				for (const [a, b, bn] of [[-0.082, -0.042, [[ub, 0.8], [lb, 0.2]]], [0.042, 0.08, [[lb, 0.8], [ub, 0.2]]]]) fitTube({ ...plate, o: L, axis: al, t0: a, t1: b, dt: 0.006, seg: 36, arc: [-1.25, 1.25], span: lens(a, b, 1.25), floor: (t, th) => sR(t, th) + 0.02, bone: () => bn });
				// the greave
				const g0 = 0.075, g1 = ll - 0.025;
				const greave = fitTube({ ...plate, o: L, axis: al, t0: g0, t1: g1, dt: 0.012, seg: 40, floor: (t, th) => { const r = sR(t, th) + 0.013; return r + ridge(th, r, 0.006, 0.026) + 0.014 * Math.max(0, (t - (g1 - 0.07)) / 0.07) ** 2; }, bone: () => lb });
				if (greave) {
					const pts = []; for (let i = 0; i < 40; i++) pts.push(greave.at(g0 + 0.003, (i / 40) * Math.PI * 2, 0.0014));
					sweep(pts, roundProf(0.0042, 8), c, ARMOUR, 0, 1, true);
					for (const t of [g0 + 0.03, g1 - 0.05]) rivet(greave.at(t, outL, 0.0004), 0.0045);
				}
			}
		} else if (q.kind === 'kneepads' && P0.part) {
			// a hard pad over each knee made to it (fitTube): a padded sleeve front with a moulded
			// cap over the kneecap, strapped behind above and below the knee
			for (const sd of ['L', 'R']) {
				const lb = 'lowerleg01.' + sd, U = heads[map['upperleg01.' + sd]], L = heads[map[lb]], F = heads[map['foot.' + sd]]; if (!U || !L || !F) continue;
				const sx = Math.sign(U.x) || 1, mine = (x) => Math.sign(x) === sx, al = F.clone().sub(L).normalize(), ub = 'upperleg01.' + sd;
				// (the pad shared between thigh and shin as the skin round the knee is, so it bends
				// with it; its cap, rigid, rides between them)
				const kneeW = (t) => { const w = Math.max(0, Math.min(0.7, 0.35 - t * 4.5)); return [[ub, w], [lb, 1 - w]]; };
				const skin = (v, x) => (P0.part[v] === 4 || P0.part[v] === 5) && mine(x), cloth = (x, y, z, slot, limb) => limb === 2 && mine(x);
				const capCol = new THREE.Color(c).multiplyScalar(0.62);
				// (the pad: padded nylon round the knee, the hard cap moulded over it)
				fitTube({
					o: L, axis: al, t0: -0.07, t1: 0.075, dt: 0.007, arc: [-1.2, 1.2], seg: 26, wall: 0.016, smooth: 14, give: 0.006, col: c, gloss: NYLON, stain: false, thick: 0.008,
					span: (th) => { const f = Math.abs(th) / 1.2; return [-0.07 + 0.025 * f * f, 0.075 - 0.02 * f * f]; },
					edge: (d) => -0.01 * Math.max(0, 1 - d / 3) ** 2, skin, cloth,
					bone: (t) => kneeW(t),
				});
				fitTube({
					o: L, axis: al, t0: -0.052, t1: 0.052, dt: 0.006, arc: [-0.8, 0.8], seg: 22, wall: 0.017, smooth: 14, give: 0.006, col: capCol, gloss: POLY, stain: false, thick: 0.004,
					span: (th) => { const f = Math.min(1, Math.abs(th) / 0.8); const h = 0.05 * Math.sqrt(1 - f * f * 0.9); return [-h, h]; },
					lift: (t, th) => { const e = (t / 0.05) ** 2 + (th / 0.78) ** 2; return { lift: 0.008 * Math.sqrt(Math.max(0, 1 - e)) }; },
					edge: () => 0, skin, cloth, bone: () => [[ub, 0.35], [lb, 0.65]],
				});
				// (the straps behind, cinched round the leg: the trousers pressed in under them)
				for (const [ta, tb] of [[-0.085, -0.066], [0.07, 0.089]]) fitTube({
					o: L, axis: al, t0: ta, t1: tb, dt: 0.006, seg: 32, wall: 0.004, smooth: 8, col: '#1f1f1c', gloss: NYLON, stain: false, edge: () => 0, thick: 0.003, skin, bone: () => (ta < 0 ? [[ub, 0.8], [lb, 0.2]] : lb),
				})?.press(cloth, 0.001);
			}
		} else if (q.kind === 'sabatons') {
			// laminated steel over each foot and what is worn on it: lames from the instep to the toe,
			// each lapping the one in front, and a rounded cap over the toes
			for (const sd of ['L', 'R']) {
				const fi = map['foot.' + sd], A0 = heads[fi], dir = P0.rest.dirs[fi]; if (!A0 || !dir) continue;
				const sx = Math.sign(A0.x) || 1, fwd = V3(dir.x, 0, dir.z).normalize(), mine = (x) => Math.sign(x) === sx, o2 = V3(A0.x, 0.02, A0.z), tE = 0.22 * kH;
				const foot = fitTube({ o: o2, axis: fwd, t0: -0.06, t1: tE, dt: 0.01, seg: 28, ref: V3(0, 1, 0), smooth: 16, give: 0, wall: 0, draw: false, skin: (v, x, y) => P0.part[v] === 6 && mine(x) && y > 0.015, cloth: (x, y, z, slot) => slot === 3 && mine(x) && y > 0.015, bone: () => 'foot.' + sd });
				if (!foot) continue;
				const fR = (t, th) => foot.rad(Math.max(-0.06, Math.min(tE, t)), th), n = 5, step = (tE - 0.05 + 0.02) / (n + 1);
				for (let k = 0; k <= n; k++) {
					const a = -0.02 + k * step, b = k === n ? tE : a + step + 0.006;
					fitTube({ o: o2, axis: fwd, t0: a, t1: b, dt: 0.006, seg: 28, ref: V3(0, 1, 0), arc: [-1.55, 1.55], closeB: k === n ? 0.035 : 0, skin: () => false, smooth: 0, wall: 0, minR: 0.001, col: c, thick: 0.003,
						floor: (t, th) => fR(t, th) + 0.008 + k * 0.0022 + 0.06 * (t - a) * (k === n ? 0 : 1), bone: () => 'foot.' + sd });
				}
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
	// combat boots as a real model (people/kit-models.js), made to each foot: the reference
	// boot (a left one, mirrored for the right) stretched to this foot's length behind and in
	// front of the ankle, its width to each side and its depth under the ankle, its shaft to
	// the shin's girth; each point riding the bones of the skin nearest it, so it bends as the
	// foot and ankle do. It stands over the shoe drawn on the skin, which it hides
	const putBoot = (sd, col) => {
		const K = A.kit, g = K?.parts.boot, R = K?.foot, part = P0.part;
		const fi = map['foot.' + sd], F = heads[fi], dir = P0.rest.dirs[fi];
		if (!g || !R || !part || !nSkin || !A.ids || !F || !dir) return false;
		const sx = Math.sign(F.x) || 1, fz = V3(dir.x, 0, dir.z).normalize(), fx = V3(fz.z, 0, -fz.x);
		// (this foot measured as the reference was: in the foot's frame, out to the side +x)
		let heel = 0, toe = 0, med = 0, lat = 0, sole = 0, sc = 0, scx = 0, scz = 0, shin = 0;
		const near = [], q = V3(0, 0, 0);
		for (let v = 0; v * 3 < nSkin; v++) {
			const k = part[v];
			if ((k !== 5 && k !== 6) || Math.sign(skinP[v * 3]) !== sx) continue;
			q.set(skinP[v * 3] - F.x, skinP[v * 3 + 1] - F.y, skinP[v * 3 + 2] - F.z);
			const x = q.dot(fx) * sx, y = q.y, z = q.dot(fz);
			if (y > 0.22) continue;
			near.push(v);
			if (y < 0) { heel = Math.min(heel, z); toe = Math.max(toe, z); med = Math.min(med, x); lat = Math.max(lat, x); sole = Math.min(sole, y); }
			else if (y > 0.06 && y < 0.1) { sc++; scx += x; scz += z; }
		}
		if (!sc || heel >= 0 || toe <= 0 || sole >= 0) return false;
		scx /= sc; scz /= sc;
		for (const v of near) {
			q.set(skinP[v * 3] - F.x, skinP[v * 3 + 1] - F.y, skinP[v * 3 + 2] - F.z);
			if (q.y > 0.06 && q.y < 0.1) shin += Math.hypot(q.dot(fx) * sx - scx, q.dot(fz) - scz);
		}
		shin /= sc;
		const kx0 = med / R.medial, kx1 = lat / R.lateral, kz0 = heel / R.heel, kz1 = toe / R.toe, ky = sole / R.sole, ks = shin / R.shin[2];
		const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv, ix = g.index, n = ix ? ix.count : pa.count;
		// (where each of the model's points goes, its normal, and the skin it rides, once a point)
		const P = new Float32Array(pa.count * 3), N = new Float32Array(pa.count * 3), B = new Int32Array(pa.count);
		for (let i = 0; i < pa.count; i++) {
			const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), w = Math.max(0, Math.min(1, y / 0.05)), u = w * w * (3 - 2 * w);
			const ax = (x < 0 ? kx0 : kx1) * (1 - u) + ks * u, az = (z < 0 ? kz0 : kz1) * (1 - u) + ks * u, ay = y < 0 ? ky : 1;
			const X = x * (1 - u) * (x < 0 ? kx0 : kx1) + (scx + (x - R.shin[0]) * ks) * u, Z = z * (1 - u) * (z < 0 ? kz0 : kz1) + (scz + (z - R.shin[1]) * ks) * u, Y = y * ay;
			P[i * 3] = F.x + fx.x * X * sx + fz.x * Z; P[i * 3 + 1] = F.y + Y; P[i * 3 + 2] = F.z + fx.z * X * sx + fz.z * Z;
			const mx = na.getX(i) / ax * sx, my = na.getY(i) / ay, mz = na.getZ(i) / az, l = Math.hypot(mx, my, mz) || 1;
			N[i * 3] = (fx.x * mx + fz.x * mz) / l; N[i * 3 + 1] = my / l; N[i * 3 + 2] = (fx.z * mx + fz.z * mz) / l;
			let best = 1e9, bv = near[0];
			for (const v of near) {
				const dx = skinP[v * 3] - P[i * 3], dy = skinP[v * 3 + 1] - P[i * 3 + 1], dz = skinP[v * 3 + 2] - P[i * 3 + 2], d = dx * dx + dy * dy + dz * dz;
				if (d < best) { best = d; bv = v; }
			}
			B[i] = bv;
		}
		const start = out.pos.length / 3, uv = new Float32Array(n * 2);
		colour.set(col);
		for (let k = 0; k < n; k++) {
			// (the right boot is the left mirrored: its corners taken the other way round)
			const kk = sx > 0 ? k : k - (k % 3) + [0, 2, 1][k % 3], i = ix ? ix.getX(kk) : kk;
			out.pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); out.nor.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); out.col.push(colour.r, colour.g, colour.b);
			const v = B[i]; let sum = 0;
			for (let c = 0; c < 4; c++) sum += A.weights[v * 4 + c];
			for (let c = 0; c < 4; c++) { out.si.push(A.ids[v * 4 + c]); out.sw.push(A.weights[v * 4 + c] / (sum || 1)); }
			out.kit.push(KIT_MODEL, 0, 0); out.wr.push(0, 0);
			uv[k * 2] = ua.getX(i); uv[k * 2 + 1] = ua.getY(i);
		}
		out.uvs.push([start, uv]);
		return true;
	};
	if (o.shoes?.combat && A.kit) for (const sd of ['L', 'R']) putBoot(sd, o.shoes.col || '#8a7556');
	if (!out.pos.length) return null;
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
	g.setAttribute('kit', new THREE.Float32BufferAttribute(out.kit, 3));
	flushLoose();
	g.setAttribute('wear', new THREE.Float32BufferAttribute(out.wr, 2));
	// (the real models' place in their atlas; only where there are any)
	if (out.uvs.length) {
		const kuv = new Float32Array(out.pos.length / 3 * 2);
		for (const [start, uv] of out.uvs) kuv.set(uv, start * 2);
		g.setAttribute('kuv', new THREE.BufferAttribute(kuv, 2));
	}
	g.setAttribute('skinIndex', new THREE.BufferAttribute(Uint16Array.from(out.si), 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(Float32Array.from(out.sw), 4));
	g.setIndex(out.idx);
	g.computeBoundingSphere();
	return g;
}
// one material for every accessory of every person (the bags' own, propkit.js, in white)
let accMat = null;
export function accessoryMaterial() {
	if (!accMat) {
		accMat = patchKit(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
		accMat.userData.shared = true;
	}
	// (the real models' maps, once they are in)
	const K = kitModelsNow();
	if (K && !accMat.userData.atlas) kitAtlas(accMat, K.tex);
	return accMat;
}
