// Skin that is not plastic: the painted maps (body.js) lit as skin is. Light scattered under the
// skin wraps round the terminator warm and red, red the furthest and over the smoother surface
// under the fine detail, most where the flesh is thin (ears, the nose's wings, fingers and their
// webs), and shows through them lit from behind. The shine has two layers: a broad soft one and
// the skin's oil, tighter and brighter, oiliest on the T-zone, the knuckles and the fingertips.
// The sky's light is reflected too, as a soft sheen toward the edges (the world has no
// reflection map). The baked shade of the folds (eye sockets, nostrils, under the chin, armpits,
// between the fingers, the ears' curls) darkens what the sky and the bounce light reach; cheeks,
// nose and ears flush a little; the colour is a little uneven, as real skin is; and close up,
// pores and the skin's coarser grain break the highlight. No textures beyond the skin's own map:
// the baked shading rides a vertex attribute (skinx: ao, thin, oil, flush; face.js).
//
// Your own hands and forearms in first person (closeHandMaterial in people/hand-surface.js) get
// the full layer (SKIN_HERO): creases at every finger joint, the palm's lines, fine crosshatched
// lines on the backs of the hands, tendons, veins, the wrist bone, the forearm's muscle and its
// hair, fingernails of their own (glossy, with the lunula and a paler free edge), redder
// knuckles and fingertips, paler palms, and the shade where the fingers close on a grip, all
// drawn from the map hand-surface.js lays on the refined surface. Everyone else gets the
// lighter layer: the wrap, the two shines, the sky's sheen and the pores (one size on a phone).
// The quality governor (world/governor.js) scales the fine detail through one shared uniform,
// so no tier change compiles anything: two programs on any device, one for the crowd and one
// for your hands.
//
// Phones (SKIN_PHONE) read their value noise from a small shared 3D texture (skinNoiseTexture:
// one fetch in place of eight hashes) and draw fewer octaves of it: 6 fetches a pixel on your
// hands (13 hashed before) and 2 on the crowd (4). The low and minimal tiers turn the noise's
// octaves off through the same uniform (uSkinQ.z), and minimal draws no pores at all; a
// desktop on the high tier draws exactly what it did.

import * as THREE from 'three';
import { INK_GLSL, inkUniforms } from '../tattoo/skinink.js';
import { qualityNow, onQuality } from '../world/governor.js';

const isPhone = typeof navigator !== 'undefined' && (/iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

// the fine detail by quality tier (x), how far off people keep their pores (y, metres; none on
// a phone's minimal tier), and whether the noise's octaves are drawn at all (z: off on the low
// and minimal tiers, where the creases, nails and lines stay but nothing wanders or mottles)
export function skinDetail(tier = 'high', phone = isPhone) {
	const far = phone ? { high: 4, medium: 4, low: 2.5, minimal: 0 } : { high: 8, medium: 8, low: 6, minimal: 4 };
	return { detail: { high: 1, medium: 0.85, low: 0.6, minimal: 0.35 }[tier] ?? 1, far: far[tier] ?? far.high, octaves: tier === 'low' || tier === 'minimal' ? 0 : 1 };
}
const SKIN_Q = { value: new THREE.Vector4(1, 8, 1, 0) };
function tierChanged(t) { const d = skinDetail(t?.name); SKIN_Q.value.set(d.detail, d.far, d.octaves, 0); }
tierChanged(qualityNow());
onQuality(tierChanged);

// which programs a skin compiles to: for your own hands or the crowd, on a phone or not
export function skinVariant({ closeup = false, phone = isPhone } = {}) {
	const defines = closeup ? ['SKIN_HERO', 'SKIN_PORES', ...(phone ? ['SKIN_LITE'] : [])] : [phone ? 'SKIN_PORES_LITE' : 'SKIN_PORES'];
	if (phone) defines.push('SKIN_PHONE');
	return { defines, key: 'crysis-skin-7' + (closeup ? '-hero' : '') + (phone ? '-lo2' : '') };
}

// The phones' value noise: the lattice of random values sn3 would hash, 64 to a side and
// repeating, read with the same smooth interpolation (the fetch lands between the lattice
// points as smoothstep puts it, so a linear filter gives sn3's own curve). 256 KB, made once.
export const SKIN_NOISE_N = 64;
let NOISE3 = null;
export function skinNoiseData(N = SKIN_NOISE_N) {
	const d = new Uint8Array(N * N * N);
	for (let i = 0; i < d.length; i++) { let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); d[i] = (h ^ (h >>> 16)) & 255; }
	return d;
}
export function skinNoiseTexture() {
	if (NOISE3) return NOISE3;
	const t = new THREE.Data3DTexture(skinNoiseData(), SKIN_NOISE_N, SKIN_NOISE_N, SKIN_NOISE_N);
	t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
	t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
	t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
	t.unpackAlignment = 1; t.name = 'skin-noise';
	t.needsUpdate = true;
	NOISE3 = t;
	return t;
}

const HEAD = /* glsl */`
uniform vec4 uScalp;
uniform vec4 uBeard;
uniform vec4 uSkin;
uniform vec4 uVit;
uniform vec4 uSkinQ;
varying float vScalp;
varying float vBeard;
varying vec2 vScalpUv;
varying vec4 vSkin;
varying vec3 vBindP;
float sh3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
#ifdef SKIN_PHONE
uniform sampler3D uSkinN;
float sn3(vec3 x) {
	vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return texture(uSkinN, (i + f + 0.5) * (1.0 / 64.0)).r;
}
#else
float sn3(vec3 x) {
	vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(sh3(i), sh3(i + vec3(1, 0, 0)), f.x), mix(sh3(i + vec3(0, 1, 0)), sh3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(sh3(i + vec3(0, 0, 1)), sh3(i + vec3(1, 0, 1)), f.x), mix(sh3(i + vec3(0, 1, 1)), sh3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
#endif
// what the layers below leave for the lighting: the surface before the fine detail (the red of
// the scattered light sees this one), the oil's share of the shine, a nail's gloss, how thin
// the flesh is, the shade of creases and contact, and the height of the fine detail (m)
vec3 skinBaseN = vec3(0.0, 0.0, 1.0);
float skinOil = 0.3;
float skinGloss = 0.0;
float skinThin = 0.0;
float skinCav = 1.0;
float skinH = 0.0;
float skinNail = 0.0;
// the shine's response to a whole sky (Karis's fit), for the sky's sheen
vec3 skinEnvBRDF(vec3 f0, float r, float nv) {
	vec4 q = r * vec4(-1.0, -0.0275, -0.572, 0.022) + vec4(1.0, 0.0425, 1.04, -0.04);
	float a = min(q.x * q.x, exp2(-9.28 * nv)) * q.x + q.y;
	vec2 ab = vec2(-1.04, 1.04) * a + q.zw;
	return f0 * ab.x + ab.y;
}
`;

// your own hands, close up: everything drawn from the map on the refined surface (hand-surface.js)
const HERO = /* glsl */`
varying vec4 vHandA;
varying vec4 vHandB;
varying vec4 vHandC;
varying vec2 vHandK;
uniform vec4 uHand;
uniform vec4 uHair;
uniform vec4 uThumb;
float skRough = 0.0;
float skOil = 0.0;
// thin lines at the whole numbers of f (half width w, in periods), flattened to their mean as
// they go finer than a pixel, so they never shimmer
float aaLine(float f, float w) {
	float fw = fwidth(f), d = abs(fract(f + 0.5) - 0.5);
	return mix(1.0 - smoothstep(w - fw, w + fw, d), 2.0 * w, smoothstep(0.3, 0.8, fw));
}
// a groove (or a ridge) of half width w at distance d (m), widened to a pixel px and kept to
// the same depth over all
float groove(float d, float w, float px) { float ww = max(w, px); return exp(-d * d / (ww * ww)) * w / ww; }
float segD(vec2 p, vec2 a, vec2 b, out float t) { vec2 pa = p - a, ba = b - a; t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * t); }
void heroSkin(inout vec3 col) {
	float Lh = uHand.x, S = uHand.y, q = uSkinQ.x, t = 0.0;
	// across and along the hand in metres; one pixel's width on the skin
	vec2 hp = vec2(vHandB.x * S, vHandB.y * Lh), u = vHandB.xy;
	float px = max(length(fwidth(vBindP)), 1e-5);
	float back = smoothstep(0.52, 0.8, vHandA.x), palm = smoothstep(0.48, 0.2, vHandA.x);
	float fing = vHandA.w, thumb = vHandK.y, curl = vHandK.x;
	float fore = smoothstep(-0.03, -0.3, u.y), hand = (1.0 - fing) * (1.0 - fore);
	float lum = dot(col, vec3(0.2126, 0.7152, 0.0722)), dark = 1.0 - smoothstep(0.04, 0.3, lum);
	float a = vHandB.z, up = vHandB.w, a2 = a * a, wrapA = smoothstep(1.2, 0.6, abs(a));
	vec3 s = vHandC.xyz;
	float h = 0.0, cav = 0.0, plate0 = smoothstep(0.9, 0.7, abs(a)) * smoothstep(-0.1, 0.0, vHandC.w) * smoothstep(1.05, 0.95, vHandC.w) * smoothstep(0.0, 0.1, up) * fing;

	// ---- the finger joints ----
	// on the palm side, deep folds: the knuckle's at the finger's base past the joint (the
	// thumb's at it), two at the middle joint (one at the thumb's), one at the last
	float pc = groove(s.x - mix(0.016 * Lh / 0.1, 0.0, thumb), 0.00055, px)
		+ mix(groove(s.y - 0.0011, 0.00045, px) + groove(s.y + 0.0011, 0.00045, px), groove(s.y, 0.0006, px) * 1.3, thumb)
		+ groove(s.z, 0.00045, px) * 0.85;
	pc *= palm * wrapA * fing * (0.75 + 0.5 * curl);
	// on the back, loose wrinkles bowed round each joint, stretched flatter as the finger closes
	float n1 = 0.5;
	if (uSkinQ.z > 0.5) n1 = sn3(vBindP * 2600.0);
	float wp = aaLine((s.y + 0.0011 * a2 * sign(s.y)) / 0.0012 + n1 * 0.35, 0.15) * (1.0 - smoothstep(0.0018, 0.0064, abs(s.y)));
	float wd = aaLine((s.z + 0.0008 * a2 * sign(s.z)) / 0.001 + n1 * 0.35, 0.15) * (1.0 - smoothstep(0.0012, 0.0044, abs(s.z)));
	float wm = aaLine((s.x + 0.0013 * a2 * sign(s.x)) / 0.0017 + n1 * 0.4, 0.12) * (1.0 - smoothstep(0.002, 0.007, abs(s.x))) * 0.55;
	float wr = (wp + wd * 0.7 + wm) * back * wrapA * fing * (1.0 - 0.6 * curl);
	// the knuckles: the domes over the hand's ends of the bones, plainer in a fist
	float dome = 0.0;
	float dv = (u.y - 1.0) * Lh;
	for (int k = 0; k < 4; k++) { float du = (u.x + 1.0 - float(k) * 0.6667) * S; dome += exp(-(du * du + dv * dv) / (0.0078 * 0.0078)); }
	dome *= back * (1.0 - fore) * smoothstep(1.45, 1.1, abs(u.x)) * (1.0 - thumb);
	float kn = clamp(dome + ((1.0 - smoothstep(0.0, 0.0075, abs(s.y))) + (1.0 - smoothstep(0.0, 0.006, abs(s.z))) * 0.6) * back * wrapA * fing, 0.0, 1.0);
	h += -pc * 0.00008 - wr * 0.000035 + dome * 0.00045 * (0.5 + 0.5 * curl);
	cav += pc * 0.5 + wr * 0.22;

	// ---- the palm's lines: the heart line, the head line, the life line round the thumb's
	// mound, and the bracelets at the wrist ----
	float heartV = 0.8 - 0.09 * u.x + 0.03 * u.x * u.x + 0.07 * smoothstep(0.2, -0.4, u.x);
	float headV = 0.555 - 0.1 * u.x + 0.02 * u.x * u.x;
	float pl = groove((u.y - heartV) * Lh, 0.00045, px) * smoothstep(-0.5, -0.25, u.x) * smoothstep(1.2, 0.95, u.x)
		+ groove((u.y - headV) * Lh, 0.0004, px) * smoothstep(-1.2, -0.95, u.x) * smoothstep(0.7, 0.4, u.x);
	vec2 lc = vec2(-1.25 * S, 0.25 * Lh), lp = hp - lc;
	pl += groove(length(lp) - length(vec2(0.2 * S, 0.41 * Lh)), 0.00045, px) * smoothstep(-0.002, 0.002, lp.x) * smoothstep(0.02, 0.1, u.y) * smoothstep(0.74, 0.6, u.y);
	pl *= hand;
	pl += (groove(hp.y + 0.0012, 0.0004, px) + groove(hp.y + 0.0058, 0.00035, px) * 0.7) * smoothstep(1.0, 0.6, abs(u.x)) * (1.0 - fing);
	pl *= palm;
#ifndef SKIN_LITE
	// and the fine ones between them
	pl += smoothstep(0.035, 0.0, abs(sn3(vBindP * 210.0) - 0.5)) * 0.3 * palm * (1.0 - fore) * (1.0 - smoothstep(0.0004, 0.001, px));
#endif
	h -= pl * 0.00007;
	cav += pl * 0.4;

	// ---- tendons on the back of the hand: one from the wrist to each knuckle, standing as the
	// fingers open; the thumb's long one ----
	float tn = 0.0;
	for (int k = 0; k < 4; k++) {
		float fk = float(k), d = segD(hp, vec2((-0.15 + 0.1 * fk) * S, 0.05 * Lh), vec2((-1.0 + fk * 0.6667) * S, 0.97 * Lh), t);
		tn += exp(-d * d / (0.0021 * 0.0021)) * smoothstep(0.0, 0.3, t) * smoothstep(1.0, 0.8, t) * (k == 0 ? 0.8 : k == 3 ? 0.6 : 1.0);
	}
	tn *= back * hand * (1.0 - 0.55 * curl);
	float d = segD(hp, vec2(-0.85 * S, -0.08 * Lh), uThumb.xy * vec2(S, Lh), t);
	tn += exp(-d * d / (0.0024 * 0.0024)) * smoothstep(0.0, 0.25, t) * smoothstep(1.0, 0.75, t) * 0.8 * smoothstep(0.4, 0.7, vHandA.x) * (1.0 - fore);
	h += tn * 0.00045;

	// ---- veins: the arch across the back of the hand, those down to it from between the
	// knuckles and the two that leave it for the wrist; meandering ones up the forearm ----
	vec2 wv = hp;
	if (uSkinQ.z > 0.5) {
#ifdef SKIN_PHONE
		wv += (vec2(sn3(vBindP * 45.0), sn3(vBindP * 45.0 + 9.0)) - 0.5) * 0.0075;
#else
		wv += (vec2(sn3(vBindP * 45.0), sn3(vBindP * 45.0 + 9.0)) - 0.5) * 0.007 + (vec2(sn3(vBindP * 130.0), sn3(vBindP * 130.0 + 5.0)) - 0.5) * 0.0015;
#endif
	}
	vec2 uw = wv / vec2(S, Lh);
	float vd = abs(uw.y - (0.42 + 0.1 * uw.x * uw.x)) * Lh + smoothstep(0.8, 1.0, abs(uw.x)) * 0.01;
	for (int k = 0; k < 3; k++) { float uk = -0.66 + 0.66 * float(k); vd = min(vd, segD(wv, vec2(uk * S, 0.93 * Lh), vec2(uk * 0.7 * S, (0.42 + 0.049 * uk * uk) * Lh), t) + 0.0006); }
	vd = min(vd, segD(wv, vec2(-0.85 * S, 0.5 * Lh), vec2(-1.05 * S, -0.35 * Lh), t));
	vd = min(vd, segD(wv, vec2(0.85 * S, 0.5 * Lh), vec2(0.9 * S, -0.35 * Lh), t));
	float vein = exp(-vd * vd / (0.0019 * 0.0019)) * back * (1.0 - fing) * smoothstep(-0.45, -0.15, uw.y);
#ifndef SKIN_LITE
	float fv = sn3(vec3(hp.x * 50.0, hp.y * 12.0, vHandA.x * 2.5));
	float fvd = abs(fv - 0.5) / max(0.02, length(fwidth(fv)) / px * 0.0024);
	vein = max(vein, exp(-fvd * fvd) * fore * smoothstep(-3.2, -0.5, u.y) * mix(0.45, 1.0, palm) * 0.7);
#endif
	vein *= uHand.w;
	h += vein * 0.00017;

	// ---- the wrist and the forearm: the head of the ulna on the back of the wrist (the little
	// finger's side) and the end of the radius on the thumb's; the tendons on the palm side of
	// the wrist, standing as the hand grips; the long swells of the muscles ----
	vec2 ub = hp - vec2(0.95 * S, -0.14 * Lh), rb = hp - vec2(-0.95 * S, -0.12 * Lh);
	h += exp(-dot(ub, ub) / (0.0062 * 0.0062)) * smoothstep(0.45, 0.75, vHandA.x) * 0.0014;
	h += exp(-dot(rb, rb) / (0.007 * 0.007)) * smoothstep(0.35, 0.65, vHandA.x) * 0.0006;
	float w1 = hp.x + 0.22 * S, w2 = hp.x - 0.06 * S;
	float wt = (exp(-w1 * w1 / 4.0e-6) + exp(-w2 * w2 / 3.0e-6) * 0.8) * smoothstep(-1.0 * Lh, -0.45 * Lh, hp.y) * smoothstep(0.02 * Lh, -0.08 * Lh, hp.y) * palm;
	h += wt * 0.0005 * (0.6 + 0.6 * curl);
	// the ulna's edge down the back of the forearm, and the muscles' swell on the thumb's side
	// toward the elbow, so the forearm is no smooth tube
	float ue = hp.x - 0.75 * S, br = hp.x + 0.55 * S;
	h += exp(-ue * ue / 1.6e-5) * smoothstep(0.35, 0.7, vHandA.x) * fore * smoothstep(-3.2, -1.2, u.y) * 0.0006;
	h += exp(-br * br / 1.4e-4) * smoothstep(-0.9, -2.3, u.y) * fore * 0.0022;
#ifndef SKIN_LITE
	h += (sn3(vec3(hp.x * 40.0, hp.y * 7.0, vHandA.x * 2.0)) - 0.5) * 0.0024 * fore;
	// fine lines crosshatched on the backs of the hands and the forearms
	vec2 xq = hp / 0.0011 + (vec2(sn3(vBindP * 500.0), sn3(vBindP * 500.0 + 2.0)) - 0.5) * 0.3;
	float xh = (aaLine(xq.x * 0.8 + xq.y * 0.6, 0.08) + aaLine(xq.x * 0.8 - xq.y * 0.6, 0.08)) * mix(0.3, 1.0, back) * (1.0 - plate0);
	h -= xh * 0.000007 * q;
	cav += xh * 0.03 * q;
#endif

	// ---- the nails: the plate square at its free edge and curved at the cuticle, pink over its
	// bed, the pale half moon at its root and the paler free edge, the fold of skin round it ----
	float ny = vHandC.w, na = abs(a), cut = 1.0 - 0.28 * a2;
	float plate = smoothstep(0.86, 0.72, na) * smoothstep(-0.06, 0.02, ny) * smoothstep(cut + 0.03, cut - 0.03, ny) * smoothstep(0.05, 0.3, up) * fing;
	float lunula = plate * smoothstep(-0.02, 0.03, ny - (cut - 0.2 * max(0.0, 1.0 - 1.4 * a2)));
	float edge = plate * smoothstep(0.14, 0.03, ny);
	float fold = ((1.0 - smoothstep(0.0, max(0.035, fwidth(ny)), abs(ny - cut))) * smoothstep(0.92, 0.6, na)
		+ (1.0 - smoothstep(0.0, max(0.05, fwidth(na)), abs(na - 0.8))) * smoothstep(-0.05, 0.1, ny) * smoothstep(cut + 0.05, cut - 0.05, ny)) * smoothstep(0.0, 0.3, up) * fing;
	vec3 bed = mix(col * vec3(1.06, 0.84, 0.84), vec3(0.6, 0.4, 0.38), 0.4 + 0.15 * dark);
	bed = mix(bed, vec3(0.74, 0.62, 0.58), lunula * 0.55);
	bed = mix(bed, vec3(0.8, 0.74, 0.66), edge * 0.75);
	col = mix(col, bed, plate);
	col *= 1.0 - fold * 0.3;
	h += plate * 0.00016 - fold * 0.00006;
#ifndef SKIN_PHONE
	h += plate * (sn3(vec3(a * 40.0, ny * 2.0, 0.0)) - 0.5) * 0.000006;
#endif
	skinNail = plate;
	skinGloss = plate * (1.0 - edge * 0.6);

	// ---- the body's hair on the forearm and the back of the hand: a follicle and a fine hair
	// in each cell (1.7 mm), lying toward the hand and the little finger's side; past a pixel,
	// only their tint ----
#ifndef SKIN_LITE
	{
		vec2 hc = hp / 0.0017, cell = floor(hc), f = fract(hc);
		float r1 = sh3(vec3(cell, 1.3)), r2 = sh3(vec3(cell, 2.7)), r3 = sh3(vec3(cell, 4.1));
		vec2 dir = normalize(vec2(0.3 + r3 * 0.35, 1.0)), rel = (f - (vec2(r1, r2) * 0.6 + 0.2)) * 0.0017;
		float along = clamp(dot(rel, dir), 0.0, 0.0014 * (0.5 + r1 * 0.5)), wid = 0.00003 + 0.00002 * r2;
		float strand = (1.0 - smoothstep(0.0, max(px * 0.7, wid), length(rel - dir * along))) * clamp(wid / px, 0.0, 1.0);
		float fol = (1.0 - smoothstep(0.0, max(px * 0.7, 0.00011), length(rel))) * clamp(0.00011 / px, 0.0, 1.0);
		float dens = uHand.z * (fore * mix(0.4, 0.9, back) + hand * back * 0.25);
		float hairs = max(strand, fol * 0.6) * step(r3, dens);
		hairs = mix(hairs, dens * 0.08, smoothstep(0.0004, 0.001, px));
		col = mix(col, mix(col, uHair.rgb, 0.8) * 0.75, clamp(hairs * 1.4, 0.0, 1.0) * uHair.a * (1.0 - dark * 0.5));
	}
#endif

	// ---- colour: redder knuckles and fingertips (darker, on dark skin), paler palms (much
	// paler on dark skin) and inner forearms, a blue cast over the veins on fair skin, and the
	// sun's touch on the backs of the hands ----
	float tip = fing * (1.0 - smoothstep(-0.4, 1.8, ny));
	float red = clamp(kn * 0.8 + tip * 0.9 + palm * fing * 0.25, 0.0, 1.0) * (1.0 - plate);
	col *= mix(vec3(1.0), mix(vec3(1.0, 0.85, 0.83), vec3(0.88, 0.8, 0.8), dark), red * 0.55);
	vec3 pale = mix(col * vec3(1.05, 0.98, 0.97), vec3(0.46, 0.29, 0.22), 0.45 * dark);
	col = mix(col, pale, palm * (1.0 - plate) * (hand + fing * 0.8 + fore * 0.3) * 0.8);
	col *= mix(vec3(1.0), vec3(0.86, 0.93, 1.04), vein * (1.0 - dark) * 0.85);
	col *= mix(1.0, 0.94, vein * dark);
	col *= mix(vec3(1.0), vec3(0.97, 0.95, 0.92), back * (1.0 - plate) * 0.8);

	// ---- shine: oily and smooth on the knuckles and fingertips, matte on the backs of the
	// hands, dry in the creases; glossy nails ----
	skRough = mix(0.05 * back - 0.14 * kn - 0.16 * tip - 0.02 * palm + 0.12 * clamp(cav, 0.0, 1.0), -0.44, plate);
	skOil = kn * 0.45 + tip * 0.5 + palm * 0.15 - back * 0.1;
	skinThin = max(vSkin.y, max(vHandA.z, edge));
	// the shade: the folds between the fingers (baked), the creases, and where the closing
	// fingers and the palm meet the grip or each other
	float contact = curl * palm * (1.0 - fore) * mix(smoothstep(0.2, 0.6, u.y), 1.0, fing);
	skinCav = vHandA.y * (1.0 - clamp(cav, 0.0, 0.8)) * (1.0 - contact * 0.35);
	skinH = h * mix(0.6, 1.0, q);
}
`;

// light through the skin: the wrap's warm, red terminator, light from behind through thin
// flesh, and two layers of shine. Highlights and the warm glow need strong direct light: the
// sun's leak into shade (sky.js keeps a fifth of it) and the moon leave the skin matte
const SSS = /* glsl */`
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 L = directLight.direction, N = geometryNormal, V = geometryViewDir;
	float k = smoothstep( 0.35, 2.2, dot( directLight.color, vec3( 0.2126, 0.7152, 0.0722 ) ) );
	float nl = dot( N, L );
	// (the red channel sees mostly the surface under the fine detail, so pores and lines
	// soften to a red edge, as they do in living skin)
	vec3 w = vec3( 0.36, 0.15, 0.1 ) * ( 0.65 + skinThin * 0.4 ) * uSkin.x * ( 0.45 + 0.55 * k );
	vec3 c = clamp( ( vec3( mix( nl, dot( skinBaseN, L ), 0.65 ), nl, nl ) + w ) / ( 1.0 + w ), 0.0, 1.0 );
	vec3 dif = pow( c, vec3( 1.0 ) + w );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, saturate( dot( V, normalize( L + V ) ) ) );
	reflectedLight.directDiffuse += dif * directLight.color * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
	float back = pow( saturate( dot( V, -normalize( L + N * 0.35 ) ) ), 4.0 ) * skinThin;
	reflectedLight.directDiffuse += k * back * directLight.color * sqrt( material.diffuseContribution ) * vec3( 1.0, 0.35, 0.18 ) * uSkin.x * 0.5;
	// the broad shine and the oil's, tighter (a nail's tighter still)
	PhysicalMaterial oily = material;
	oily.roughness = max( 0.12, material.roughness * mix( 0.6, 0.3, skinGloss ) );
	vec3 spec = BRDF_GGX( L, V, N, material ) * ( 1.0 - 0.2 * skinOil ) + BRDF_GGX( L, V, N, oily ) * ( skinOil * 0.22 + skinGloss * 1.2 );
	reflectedLight.directSpecular += min( saturate( nl ) * directLight.color * spec * material.multiScatteringCompensation * ( 0.25 + 0.75 * k ), directLight.color * 0.3 );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin
`;

export function skinMaterial(map, tint, age, { closeup = false } = {}) {
	const m = new THREE.MeshPhysicalMaterial({ map, color: tint, roughness: 0.6, metalness: 0, ior: 1.4, specularIntensity: 1 });
	// a close crop of hair painted on the scalp (a buzz cut, or what shows under a cap)
	const scalpU = { value: new THREE.Vector4(0, 0, 0, 0) };
	// the shadow of a beard shaved or under a beard: its colour and how heavy
	const beardU = { value: new THREE.Vector4(0, 0, 0, 0) };
	// x: how much light goes through (0 for the far worlds' painted skins), y: pore depth by
	// age, z: how shiny the T-zone, w: the flush
	const skinU = { value: new THREE.Vector4(1, 0.6 + Math.min(1, Math.max(0, (age - 25) / 50)) * 0.8, 1, 1) };
	// vitiligo (a person in a hundred): x on, yzw where their patches fall
	const vitU = { value: new THREE.Vector4(0, 0, 0, 0) };
	m.userData.scalp = scalpU;
	m.userData.beard = beardU;
	m.userData.skin = skinU;
	m.userData.vit = vitU;
	// tattoos: none until someone's are laid on (tattoo/skinink.js)
	const inkU = inkUniforms();
	m.userData.ink = inkU;
	// your hands' measures, body hair and veins (x: the hand's length, y: half its knuckles' span,
	// z: hair, w: veins), the hair's colour, the thumb's knuckle and base, and how far each
	// finger is closed (closeHandMaterial in hand-surface.js fills them)
	const handU = closeup ? { uHand: { value: new THREE.Vector4(0.1, 0.033, 0.5, 0.6) }, uHair: { value: new THREE.Vector4(0.2, 0.15, 0.1, 0) }, uThumb: { value: new THREE.Vector4(-1.2, 0.5, -0.9, 0.1) }, uCurl: { value: new Float32Array(12) } } : null;
	m.userData.hand = handU;
	const V = skinVariant({ closeup });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uScalp = scalpU;
		sh.uniforms.uBeard = beardU;
		sh.uniforms.uSkin = skinU;
		sh.uniforms.uVit = vitU;
		sh.uniforms.uSkinQ = SKIN_Q;
		if (V.defines.includes('SKIN_PHONE')) sh.uniforms.uSkinN = { value: skinNoiseTexture() };
		Object.assign(sh.uniforms, inkU);
		if (handU) Object.assign(sh.uniforms, handU);
		const defs = V.defines.map((d) => '#define ' + d + '\n').join('');
		sh.vertexShader = defs + sh.vertexShader.replace('#include <common>', `#include <common>
attribute float scalp;
attribute float beard;
attribute vec4 skinx;
varying float vScalp;
varying float vBeard;
varying vec2 vScalpUv;
varying vec4 vSkin;
varying vec3 vBindP;
#ifdef SKIN_HERO
attribute vec4 handA;
attribute vec4 handB;
attribute vec4 handC;
uniform float uCurl[ 12 ];
varying vec4 vHandA;
varying vec4 vHandB;
varying vec4 vHandC;
varying vec2 vHandK;
#endif`)
			.replace('#include <begin_vertex>', `#include <begin_vertex>
vScalp = scalp;
vBeard = beard;
vScalpUv = uv;
vSkin = skinx;
vBindP = position;
#ifdef SKIN_HERO
{
	// (which finger: side * 6 + finger, 0 the palm and forearm)
	float code = floor( handA.w * 255.0 + 0.5 ), fi = mod( code, 6.0 );
	vHandA = vec4( handA.xyz, step( 0.5, fi ) );
	vHandB = handB;
	vHandC = handC;
	vHandK = vec2( uCurl[ int( code ) ], step( 0.5, fi ) * step( fi, 1.5 ) );
}
#endif`);
		sh.fragmentShader = defs + sh.fragmentShader.replace('#include <common>', '#include <common>\n' + HEAD + (handU ? HERO : '') + INK_GLSL)
			.replace('#include <lights_physical_pars_fragment>', '#include <lights_physical_pars_fragment>\n' + SSS)
			.replace('#include <color_fragment>', `#include <color_fragment>
// tattoos: ink in the skin, a multiply of its own colour (tattoo/skinink.js)
diffuseColor.rgb *= inkAt(vBindP);
// stubble: the cut hairs just under and through the skin, a fine grain, soft-edged
// (far off, just its shade: no grain to shimmer)
if (uBeard.w > 0.0) {
	vec2 bq = vScalpUv * 1400.0;
	float bg = mix(fract(sin(dot(floor(bq), vec2(12.9898, 78.233))) * 43758.5453), 0.5, smoothstep(0.3, 1.0, length(fwidth(bq))));
	diffuseColor.rgb = mix(diffuseColor.rgb, uBeard.rgb, vBeard * uBeard.w * (0.45 + 0.55 * bg) * 0.6);
}
diffuseColor.rgb = mix(diffuseColor.rgb, uScalp.rgb * (0.8 + 0.4 * fract(sin(dot(floor(vScalpUv * 900.0), vec2(12.9898, 78.233))) * 43758.5453)), smoothstep(0.2, 0.8, vScalp) * uScalp.w);
// the flush: blood near the surface of the cheeks, the nose, the ears, the lips; faint, a
// multiply of the skin's own colour, so it never reads as a patch
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.02, 0.94, 0.93), vSkin.w * uSkin.w * (1.0 - uScalp.w * smoothstep(0.2, 0.8, vScalp)));
// freckles (uVit.x 2, y the eyes' height): small warm dots in a band across the nose's bridge
// and the upper cheeks (where the skin flushes, between the eyes' height and a little below,
// not out to the temples), a few millimetres each, sparse, of uneven strength and light enough
// never to read as dirt; near only, where they read as freckles
if (uVit.x > 1.5 && length(vViewPosition) < 6.0) {
	float fk = sn3(vBindP * 360.0 + vec3(uVit.z, uVit.w, uVit.z * 0.7)) * 0.75 + sn3(vBindP * 820.0 + vec3(uVit.w, uVit.z, 1.3)) * 0.25;
	float fm = smoothstep(0.15, 0.5, vSkin.w) * (1.0 - smoothstep(0.2, 0.8, vScalp));
	fm *= smoothstep(uVit.y - 0.074, uVit.y - 0.062, vBindP.y) * (1.0 - smoothstep(uVit.y - 0.006, uVit.y + 0.006, vBindP.y)) * (1.0 - smoothstep(0.045, 0.062, abs(vBindP.x)));
	diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.74, 0.65), smoothstep(0.64, 0.73, fk) * fm * (0.55 + 0.45 * fract(fk * 7.13)));
}
// vitiligo: soft-edged pale patches where the pigment has gone, for the few who have it
if (uVit.x > 0.5 && uVit.x < 1.5) {
	float v = sn3(vBindP * 9.0 + uVit.yzw) * 0.7 + sn3(vBindP * 23.0 + uVit.zwy) * 0.3;
	float t = mix(0.6, 0.54, smoothstep(1.4, 1.52, vBindP.y));        // (most often on the face)
	diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.54, 0.46), smoothstep(t, t + 0.04, v) * (1.0 - smoothstep(0.2, 0.8, vScalp)));
}
// blotches: real skin's colour is a little uneven, redder here and sallower there, a few
// centimetres across (gone far off, where it would only shimmer)
float blotchD = length(vViewPosition);
if (blotchD < 12.0 && uSkinQ.z > 0.5) {
#ifdef SKIN_PHONE
	float mo = sn3(vBindP * 38.0) - 0.5;
#else
	float mo = sn3(vBindP * 38.0) * 0.65 + sn3(vBindP * 97.0 + 3.1) * 0.35 - 0.5;
#endif
	diffuseColor.rgb *= 1.0 + mo * vec3(0.1, 0.13, 0.12) * (1.0 - smoothstep(4.0, 12.0, blotchD)) * uSkin.x;
}
skinThin = vSkin.y;
#ifdef SKIN_HERO
heroSkin(diffuseColor.rgb);
#endif`)
			.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
// a slightly oilier T-zone and lips, matte cheeks: a broad soft sheen, never a patch (on dark
// skin a bright patch reads as lost pigment); a faint grain, gone before it could shimmer
float oilT = smoothstep( 0.2, 0.9, vSkin.z ) * uSkin.z;
roughnessFactor = mix( 0.62, 0.54, oilT );
#ifndef SKIN_PHONE
float rq = length( fwidth( vBindP * 120.0 ) );
roughnessFactor += ( sn3( vBindP * 120.0 ) - 0.5 ) * 0.03 * ( 1.0 - smoothstep( 0.2, 0.6, rq ) );
#endif
skinOil = 0.25 + 0.6 * oilT;
#ifdef SKIN_HERO
roughnessFactor = clamp( roughnessFactor + skRough, 0.12, 0.85 );
skinOil = clamp( skinOil + skOil, 0.0, 1.0 );
#endif`)
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
skinBaseN = normal;
{
	// pores and fine lines (0.7 mm) and the skin's coarser grain (2.5 mm, which still shows at
	// a few metres) as a bump, with the fine detail drawn above; each fades out as it nears a
	// pixel, and none is worked out past the tier's reach
	float h = skinH, pxB = length( fwidth( vBindP ) ), dist = length( vViewPosition );
	if ( dist < uSkinQ.y ) {
		float near = ( 1.0 - smoothstep( uSkinQ.y * 0.6, uSkinQ.y, dist ) ) * uSkinQ.x * uSkin.y * ( 1.0 - skinNail );
#if defined( SKIN_PORES ) || defined( SKIN_PORES_LITE )
		h += ( sn3( vBindP * 420.0 ) - 0.5 ) * 0.00005 * near * ( 1.0 - smoothstep( 0.35, 0.9, pxB * 420.0 ) );
#endif
#ifdef SKIN_PORES
		float fine = 1.0 - smoothstep( 0.35, 0.9, pxB * 1400.0 );
		if ( fine > 0.0 ) {
			vec3 q = vBindP * 1400.0;
#ifdef SKIN_PHONE
			float hp = smoothstep( 0.25, 0.75, sn3( q ) ) - 0.5;
#else
			float hp = sn3( q ) * 0.6 + sn3( q * 2.3 + 7.0 ) * 0.4;
			hp = smoothstep( 0.25, 0.75, hp ) - 0.5;
			hp += ( sn3( vec3( vBindP.x * 90.0, vBindP.y * 900.0, vBindP.z * 90.0 ) ) - 0.5 ) * 0.6 * ( uSkin.y - 0.6 );
#endif
			h += hp * 0.00004 * near * fine;
		}
#endif
	}
	vec3 sx = dFdx( -vViewPosition ), sy = dFdy( -vViewPosition );
	vec3 r1 = cross( sy, normal ), r2 = cross( normal, sx );
	float det = dot( sx, r1 );
	vec2 dh = vec2( dFdx( h ), dFdy( h ) );
	normal = normalize( abs( det ) * normal - sign( det ) * ( dh.x * r1 + dh.y * r2 ) );
}`)
			.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
#if ! defined( USE_ENVMAP ) && NUM_HEMI_LIGHTS > 0
{
	// the sky's sheen: the hemisphere's sky and ground seen in the skin, both shines, a soft
	// gleam toward the edges (there is no reflection map in the world)
	vec3 R = reflect( - geometryViewDir, geometryNormal ), sky = vec3( 0.0 );
	float nv = saturate( dot( geometryNormal, geometryViewDir ) );
	for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) sky += mix( hemisphereLights[ i ].groundColor, hemisphereLights[ i ].skyColor, smoothstep( -0.6, 0.6, dot( R, hemisphereLights[ i ].direction ) ) );
	float r2 = max( 0.12, material.roughness * mix( 0.6, 0.3, skinGloss ) );
	reflectedLight.indirectSpecular += sky * RECIPROCAL_PI * ( skinEnvBRDF( material.specularColor, material.roughness, nv ) * ( 0.6 - 0.2 * skinOil ) + skinEnvBRDF( material.specularColor, r2, nv ) * ( skinOil * 0.22 + skinGloss * 1.2 ) );
}
#endif`)
			.replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
	// the folds' baked shade, the creases and contact: the sky and bounce light most, the sun a little
	float ao = vSkin.x * skinCav;
	reflectedLight.indirectDiffuse *= mix(1.0, ao, 0.8);
	reflectedLight.indirectSpecular *= ao * ao;
	reflectedLight.directDiffuse *= mix(1.0, ao, 0.3);
	reflectedLight.directSpecular *= mix(1.0, ao, 0.7);
}`);
	};
	m.customProgramCacheKey = () => V.key;
	return m;
}

// the chunks the skin is written into, for checks (tools/skin.test.mjs)
export const SKIN_CHUNKS = { vertex: ['#include <common>', '#include <begin_vertex>'], fragment: ['#include <common>', '#include <lights_physical_pars_fragment>', '#include <color_fragment>', '#include <roughnessmap_fragment>', '#include <normal_fragment_maps>', '#include <lights_fragment_end>', '#include <aomap_fragment>'] };
