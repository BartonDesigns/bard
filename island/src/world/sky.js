// Sky, sun, moon, clouds, haze and the light rig, all driven by one clock.
// Daylight lasts much longer than night: most visits happen in the sun.

import * as THREE from 'three';
import { NOISE_GLSL } from './terrain.js';
import { STARS_B64, STAR_COUNT } from './starcat.js';
import { today } from '../calendar.js';
import { AIR } from './airfog.js';
import { GRADE, bardLook } from './grade.js';
import { qualityNow } from './governor.js';
import { constellations } from './constellations.js';
import { BAY_LATITUDE, solarLatitude, solarDate, solarTimes, solarDirection, advanceSolarClock, lunarPosition, moonlightShare } from './solar.js';

// The real catalogue follows the observer's latitude and the chosen date. The island
// keeps its Bay Area latitude; the globe supplies the camera's current latitude.
// equatorial (J2000) to galactic
const EQ2GAL = [-0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.4448296300, 0.7469822445, -0.8676661490, -0.1980763734, 0.4559837762];

const C = (r, g, b) => new THREE.Color(r, g, b);
const PAL = {
	dayZen: C(0.03, 0.24, 0.72), dayHor: C(0.50, 0.72, 0.92),
	setZen: C(0.20, 0.24, 0.50), setHor: C(1.00, 0.52, 0.26),
	nightZen: C(0.004, 0.009, 0.028), nightHor: C(0.018, 0.03, 0.065),
	sunDay: C(1.0, 0.90, 0.74), sunSet: C(1.0, 0.52, 0.22), moon: C(0.45, 0.55, 0.8),
};
// a town's own light by night, from overhead (its glow off the low sky) and from below (the
// lit streets and sidewalks): sodium and warm LED, at full in the middle of a city
const CITY_SKY = C(0.30, 0.25, 0.21), CITY_GROUND = C(0.34, 0.27, 0.18);

// the cloud field, shared by the dome and the stars it hides: fair-weather cumulus on a
// plane about 1.5 km up that drifts with the wind (uCloudOff, summed by weather.js) and
// slowly changes shape, heaped up dark over the showers
export const CLOUD_GLSL = /* glsl */`
uniform vec2 uCloudOff; uniform vec4 uShowers[4];
float fbm5(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.02 + 3.1; a *= 0.5; } return s; }
// the showers' hold on a point of the cloud plane (xz metres from you)
float showerAt(vec2 xz){
	float sh = 0.0;
	for (int i = 0; i < 4; i++) { vec4 S = uShowers[i]; sh = max(sh, S.w * (1.0 - smoothstep(S.z * 0.9, S.z * 2.8, length(xz - S.xy)))); }
	return sh;
}
// density (0-1) and the lumpy field under it, for a direction d
float cumulus(vec3 d, float cloud, float time, out float base, out float sh){
	base = 0.0; sh = 0.0;
	if (d.y <= 0.01) return 0.0;
	vec2 cp = d.xz / (d.y + 0.08) * 1.6 + uCloudOff;
	// the shapes boil slowly: the field is warped by a slower field that drifts on its own
	vec2 warp = vec2(fbm5(cp * 0.35 + time * 0.004), fbm5(cp * 0.35 + 7.3 - time * 0.0035)) - 0.5;
	cp += warp * 0.7;
	base = fbm5(cp * 0.9) * 0.6 + fbm5(cp * 0.32 + 11.0) * 0.55;
	sh = showerAt(d.xz / max(d.y, 0.02) * 1500.0);
	base += sh * 0.8;
	float cover = mix(0.8, 0.3, cloud);
	// a storm's deck stays solid down to the horizon, where fair clouds thin out
	return smoothstep(cover, cover + 0.12, base) * mix(smoothstep(0.01, 0.2, d.y), smoothstep(0.0, 0.03, d.y), clamp(sh * 1.6, 0.0, 1.0));
}
// the high veil (altostratus, cirrostratus): a thin sheet some 7 km up that comes in from
// upwind. It lies along the horizon first, a band all round and higher on the side it comes
// from, then spreads over the whole sky (uHighCl.y how thick, .z how far over; uVeil.xy its
// drift, .zw the wind). Seen low it is seen edge-on, through kilometres of it, so a sun
// rising behind it is lost in it. Returns its opacity along d; tex: how thick it is just there.
uniform vec4 uHighCl, uVeil;
float veilAt(vec3 d, out float tex, out vec2 q){
	tex = 0.0; q = vec2(0.0);
	if (uHighCl.y < 0.01) return 0.0;
	float y = max(d.y, 0.0);
	vec2 p = d.xz / (y + 0.02), wd = normalize(uVeil.zw + vec2(1e-4));
	float r = length(p), R = uHighCl.z;
	q = p + uVeil.xy;
	float big = fbm3(q * 0.6 + 21.0);
	// its ragged edge: the front coming in from upwind, and the band round the horizon
	float edge = mix(14.0, -8.0, R) + (big - 0.5) * 7.0;
	float front = smoothstep(edge - 2.5, edge + 2.5, -dot(p, wd));
	float ring = smoothstep(0.0, 4.0, r - mix(16.0, -4.0, R) + (big - 0.5) * 7.0);
	float cov = max(front, ring);
	if (cov < 0.001) return 0.0;
	// thicker and thinner bands through it, streaked along the wind; far off it settles to its mean
	vec2 s = vec2(dot(q, wd) * 0.5, dot(q, vec2(-wd.y, wd.x)) * 2.2);
	float lod = 1.0 / (1.0 + r * 0.12);
	#ifdef SKY_LITE
	tex = mix(0.6, big * 1.1 + vn(s * 1.5 + 5.0) * 0.6 - 0.37, lod);
	#else
	tex = mix(0.6, big * 1.1 + vn(s * 1.5 + 5.0) * 0.45 + vn(s * vec2(3.0, 6.0) + 9.0) * 0.3 - 0.37, lod);
	#endif
	return 1.0 - exp(-uHighCl.y * cov * (0.1 + tex * tex * 1.3) * 0.55 / (y + 0.045));
}
`;

// The same cumulus as a layer of real depth (on desktops at the high tier): a slab from
// 1.4 to 2.8 km up marched through along the view (a few steps, jittered per pixel), each
// heap's dome rising where the field is thickest, its density summed toward you and its light
// read one step toward the sun, so the heaps have sunlit sides, dark bellies and edges that
// thin to wisps; fly up through them and they part round you. The field is the plane's own
// (cover, drift, the showers), anchored to the ground rather than to you. Returns the cover
// (alpha), how lit it is (as the plane's lit), and how far off it begins (m).
const VOL_GLSL = /* glsl */`
uniform vec3 uCamP; uniform float uVolK;
float fbm3c(vec2 p){ return vn(p) * 0.57 + vn(p * 2.03 + 3.1) * 0.29 + vn(p * 4.1 - 5.3) * 0.14; }
float volDen(vec3 p, float cover, float time, float sh){
	vec2 cp = p.xz / 937.0 + uCloudOff;
	cp += (vec2(vn(cp * 0.35 + time * 0.004), vn(cp * 0.35 + 7.3 - time * 0.0035)) - 0.5) * 0.7;
	float base = fbm3c(cp * 0.9) * 0.6 + fbm3c(cp * 0.32 + 11.0) * 0.55 + sh * 0.8;
	float hf = clamp((p.y - 1400.0) / 1400.0, 0.0, 1.0);
	// (the higher in the slab, the thicker the field must be: domes on flat bases)
	return smoothstep(cover, cover + 0.22, base - hf * hf * 0.55) * smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(0.88, 1.0, hf));
}
vec3 volClouds(vec3 d, float cloud, float time, float sh, vec3 sunDir){
	float c = uCamP.y, t0, t1;
	if (c < 1400.0) { if (d.y < 0.012) return vec3(0.0, 0.0, 1e9); t0 = (1400.0 - c) / d.y; t1 = (2800.0 - c) / d.y; }
	else if (c > 2800.0) { if (d.y > -0.012) return vec3(0.0, 0.0, 1e9); t0 = (2800.0 - c) / d.y; t1 = (1400.0 - c) / d.y; }
	else { t0 = 0.0; t1 = d.y > 0.012 ? (2800.0 - c) / d.y : d.y < -0.012 ? (1400.0 - c) / d.y : 9000.0; }
	t1 = min(t1, t0 + 6000.0);
	if (t0 > 60000.0) return vec3(0.0, 0.0, t0);
	float cover = mix(0.8, 0.3, cloud), dt = (t1 - t0) / 10.0;
	// (the steps' offset: a little screen noise breaks up the slices without the grain a
	// full random offset leaves with no frames to average it over)
	float j = 0.5 + (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) * 0.3;
	float Tr = 1.0, lit = 0.0, wsum = 0.0;
	for (int i = 0; i < 10; i++) {
		float t = t0 + (float(i) + j) * dt;
		vec3 p = vec3(uCamP.x, c, uCamP.z) + d * t;
		float den = volDen(p, cover, time, sh);
		if (den < 0.01) continue;
		// the light toward the sun: one step up its way, and the height (bellies are dark)
		float toward = volDen(p + sunDir * 180.0, cover, time, sh);
		float hf = clamp((p.y - 1400.0) / 1400.0, 0.0, 1.0);
		float l = exp(-toward * 2.2) * (0.55 + 0.6 * hf) + 0.12;
		float a = 1.0 - exp(-den * dt * 0.0045);
		lit += Tr * a * l; wsum += Tr * a;
		Tr *= 1.0 - a;
		if (Tr < 0.04) break;
	}
	return vec3(1.0 - Tr, wsum > 1e-4 ? lit / wsum : 0.6, t0);
}
`;

// mare's tails (cirrus uncinus), for the dome: u is the sky in the wind's frame (x down the
// wind, y across it). Lanes across the wind, each cut into cells along it; a cell may hold
// one hook: a tuft of ice at its downwind end and its fall streak trailing back upwind,
// thinning and bending away to one side as the slower air below holds it back. The lanes
// wander (a slow warp that drifts with time), so the rows never read as a grid, and the
// streaks are fibrous along their length.
const TAILS_GLSL = /* glsl */`
float tails(vec2 u, float time){
	u += (vec2(vn(u * 0.21 + 3.0 + time * 0.002), vn(u * 0.21 - 8.0 - time * 0.0017)) - 0.5) * 1.8;
	float lane = floor(u.y);
	float ax = u.x / 3.4 + h21(vec2(lane, 17.0)) * 7.0;
	vec2 id = vec2(floor(ax), lane);
	float lt = fract(ax);                         // 0 the streak's far end .. 1 the hook's head
	if (h21(id + 0.37) < 0.42) return 0.0;
	float bend = (h21(id + 9.1) - 0.5) * 0.5, head = 0.8 + 0.08 * h21(id + 4.0), big = 0.7 + 0.5 * h21(id + 2.3);
	float back = max(head - lt, 0.0) / head;      // 0 at the head .. 1 at the far end
	float y0 = fract(u.y) - 0.5 - bend * back * back - (h21(id + 6.6) - 0.5) * 0.16;
	// the head: a small ragged tuft; the streak: fanning out and fading as it trails back from it
	vec2 hq = vec2((lt - head) * 3.4 / 0.32, y0 / 0.15) / big;
	#ifdef SKY_LITE
	float tuft = (1.0 - smoothstep(0.1, 1.0, length(hq) + (vn(u * 6.0 + id * 3.7) - 0.5) * 1.4)) * 0.8;
	#else
	float rag = fbm3(u * 6.0 + id * 3.7);
	float tuft = (1.0 - smoothstep(0.1, 1.0, length(hq) + (rag - 0.5) * 1.4)) * (0.55 + 0.45 * vn(u * 15.0));
	#endif
	float w = mix(0.05, 0.3, sqrt(back)) * big;
	float streak = exp(-y0 * y0 / (w * w) * 2.5) * (1.0 - smoothstep(0.45, 1.0, back)) * (1.0 - smoothstep(-0.02, 0.04, lt - head));
	// fine fibres along it, following its bend, and its threads coming and going
	float fib = (0.35 + 0.65 * smoothstep(0.2, 0.9, vn(vec2(u.x * 0.35, y0 * 46.0 + lane * 13.0))));
	#ifndef SKY_LITE
	fib *= 0.55 + 0.45 * vn(vec2(u.x * 1.3, y0 * 9.0));
	#endif
	return max(tuft * 0.8, streak * fib * (0.9 - back * 0.5));
}
`;

// the clouds as water shows them: the cumulus above (same field, same drift, same cover),
// cheaper (three octaves, no showers), over the sky's own gradient and in the world's air.
// Its own copy of the noise, so it drops into any shader. uCloudR: the cloud plane's
// offset, cover, on (0: the plain sky); uCloudR2: night, time, gloom, cirrus; uCloudR3: the
// cirrus' offset, the wind
export const CLOUD_REFLECT_GLSL = /* glsl */`
uniform vec4 uCloudR, uCloudR2, uCloudR3, uCloudR4, uAirR;
float crH(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float crN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(crH(i), crH(i + vec2(1, 0)), f.x), mix(crH(i + vec2(0, 1)), crH(i + vec2(1, 1)), f.x), f.y); }
// (three of fbm5's five octaves, scaled to its mean)
float crF(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * crN(p); p = p * 2.02 + 3.1; a *= 0.5; } return s * 1.107; }
vec3 skyReflect(vec3 r, vec3 zen, vec3 hor, vec3 sunC){
	vec3 sky = mix(hor, zen, pow(clamp(r.y, 0.0, 1.0), 0.5));
	if (uCloudR.w > 0.5 && r.y > 0.01) {
		vec2 cp = r.xz / (r.y + 0.08) * 1.6 + uCloudR.xy;
		cp += (vec2(crF(cp * 0.35 + uCloudR2.y * 0.004), crF(cp * 0.35 + 7.3 - uCloudR2.y * 0.0035)) - 0.5) * 0.7;
		float base = crF(cp * 0.9) * 0.6 + crF(cp * 0.32 + 11.0) * 0.55;
		float cover = mix(0.8, 0.3, uCloudR.z);
		float dens = smoothstep(cover, cover + 0.12, base) * smoothstep(0.01, 0.2, r.y);
		// (lit as the dome lights them: sunlit tops, grey-blue bases, dark shapes by night)
		vec3 cloud = mix(vec3(0.46, 0.52, 0.64), vec3(1.08), 0.55 + 0.4 * smoothstep(cover, cover + 0.35, base)) * mix(vec3(1.0), sunC * 0.9, 0.35) * (1.0 - uCloudR2.x * 0.975) * (1.0 - uCloudR2.z * 0.45) + hor * 0.12;
		// the cirrus far above, combed out along the wind (uCloudR3: its offset, the wind)
		if (uCloudR2.w > 0.01) {
			vec2 cc = r.xz / (r.y + 0.03) * 0.55 + uCloudR3.xy, wd = normalize(uCloudR3.zw + vec2(1e-4));
			vec2 q = vec2(dot(cc, wd) * 0.16, dot(cc, vec2(-wd.y, wd.x)));
			float ci = smoothstep(0.55, 0.85, crF(q * 3.0) * 0.7 + crN(q * vec2(2.0, 11.0) + 3.0) * 0.3) * uCloudR2.w * smoothstep(0.0, 0.18, r.y) * (1.0 - uCloudR2.z * 0.7);
			sky = mix(sky, mix(vec3(1.02), sunC * 1.35, 0.4) * (1.0 - uCloudR2.x * 0.93) + hor * 0.15, ci * 0.55 * (1.0 - dens));
		}
		// the high veil (uCloudR4: its drift, how thick, how far over), smooth, as the dome lays it out
		if (uCloudR4.z > 0.01) {
			vec2 p = r.xz / (r.y + 0.02), wd = normalize(uCloudR3.zw + vec2(1e-4));
			float big = crF((p + uCloudR4.xy) * 0.6 + 21.0) * 0.9;
			float cov = max(smoothstep(-2.5, 2.5, -dot(p, wd) - mix(14.0, -8.0, uCloudR4.w) - (big - 0.5) * 7.0), smoothstep(0.0, 4.0, length(p) - mix(16.0, -4.0, uCloudR4.w) + (big - 0.5) * 7.0));
			float vt = mix(0.6, big * 1.2, 1.0 / (1.0 + length(p) * 0.12));
			float va = 1.0 - exp(-uCloudR4.z * cov * (0.1 + vt * vt * 1.3) * 0.55 / (r.y + 0.045));
			vec3 vcol = mix(vec3(0.95, 0.96, 1.0), vec3(0.6, 0.64, 0.72), smoothstep(0.4, 1.1, big) * uCloudR4.z * 0.75) * mix(vec3(1.0), sunC, 0.4) * (1.0 - uCloudR2.x * 0.96) * (1.0 - uCloudR2.z * 0.4);
			sky = mix(sky, vcol, va * 0.97 * (1.0 - dens));
		}
		sky = mix(sky, cloud, dens * 0.9);
	}
	return mix(sky, dot(sky, vec3(0.299, 0.587, 0.114)) * uAirR.rgb, uAirR.a);
}`;
// its uniforms, shared through `shared` (sky.update keeps them current)
export function cloudReflectU(shared) {
	shared.uCloudR ||= { value: new THREE.Vector4(0, 0, 0.62, 1) };
	shared.uCloudR2 ||= { value: new THREE.Vector4() };
	shared.uCloudR3 ||= { value: new THREE.Vector4(0, 0, 1, 0) };
	shared.uCloudR4 ||= { value: new THREE.Vector4() };
	shared.uAirR ||= { value: airOf(shared.planet) };
	return { uCloudR: shared.uCloudR, uCloudR2: shared.uCloudR2, uCloudR3: shared.uCloudR3, uCloudR4: shared.uCloudR4, uAirR: shared.uAirR };
}

// three.js's AgX tone mapping (tonemapping_pars_fragment, with Bard's look) on the CPU, for one colour:
// linear in, linear out. (The matrices are GLSL's, column by column.)
const AGX_M = [
	[0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956],
	[0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859],
	[1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
	[1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187],
];
const mat3x = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[3 + r] * v[1] + m[6 + r] * v[2]);
// a low sun's gold (as the dome's shader mixes it)
const GOLD = new THREE.Color(1.0, 0.8, 0.42), PEACH = new THREE.Color(1.0, 0.56, 0.34);
// how much of the sky a leaf's waxy face gives back whatever way it turns (world/vegetation.js
// swayMaterial, and the far crowns' impostors in bay/city.js). A dielectric gives back about
// 0.05 over the hemisphere, but the sky light on things here runs well under the drawn dome
// (hemi 0.25 at dusk), so that much turns a tree grey: a fifth of it by day, when the sky is
// bright and the shade side would go blue, and twice that once the sun is down, when the
// crowns go a saturated near-black against the sky without it (Josh's 5th recording)
const LEAF_SHEEN_DAY = 0.011, LEAF_SHEEN_DUSK = 0.022;
// how much a low light is opened up against the look's darker shade (world/grade.js), and how
// much of that the full night gives back (dusk wants the most; the night was tuned darker)
const LOW_OPEN = 0.5, NIGHT_TRIM = 0.12;
function agx(c, exposure, out) {
	exposure *= GRADE.exposure;
	let v = mat3x(AGX_M[1], mat3x(AGX_M[0], [c.r * exposure, c.g * exposure, c.b * exposure]));
	v = v.map((x) => {
		x = Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) + 12.47393) / (4.026069 + 12.47393)));
		const x2 = x * x, x4 = x2 * x2;
		return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
	});
	// (and the look laid on it, world/grade.js)
	v = bardLook(v);
	v = mat3x(AGX_M[3], mat3x(AGX_M[2], v).map((x) => Math.pow(Math.max(0, x), 2.2)));
	return out.setRGB(...v.map((x) => Math.min(1, Math.max(0, x))));
}

// a planet's air colour, normalised to keep the sky's brightness
function airOf(P) {
	const t = P?.air?.tint;
	if (!t || !P.air.mix) return new THREE.Vector4(1, 1, 1, 0);
	// an airless world: the sky is dark even by day (the tint is not brightened)
	if (P.airless) return new THREE.Vector4(t[0], t[1], t[2], P.air.mix);
	const l = t[0] * 0.299 + t[1] * 0.587 + t[2] * 0.114;
	return new THREE.Vector4(t[0] / l, t[1] / l, t[2] / l, P.air.mix);
}
export function createSky(scene, shared, renderer, { isPhone = false, earth = true, latitude = () => BAY_LATITUDE } = {}) {
	// The air uniform is made once per page; an airless world darkens it, and the next world
	// with air gets the neutral value back.
	const airR = cloudReflectU(shared).uAirR;
	if (shared.planet?.airless) { airR.value.copy(airOf(shared.planet)); airR.dark = true; } else if (airR.dark) { airR.value.set(1, 1, 1, 0); airR.dark = false; }
	const uniforms = {
		uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor,
		uTime: shared.uTime, uNight: { value: 0 }, uCloud: { value: 0.62 }, uHigh: shared.uHigh,
		uW2E: { value: new THREE.Matrix3() }, uE2G: { value: new THREE.Matrix3().set(...EQ2GAL) }, uGlow: shared.uSkyGlow || (shared.uSkyGlow = { value: 0 }),
		// the weather's (weather.js hands its own in with attach())
		uCloudOff: { value: new THREE.Vector2() }, uCirrusOff: { value: new THREE.Vector2() }, uCirrus: { value: 0.25 }, uWindDir: shared.uWindDir,
		// the high cloud: mare's tails, the veil (thick, how far over) and the veil's drift and wind
		uHighCl: { value: new THREE.Vector4() }, uVeil: { value: new THREE.Vector4(0, 0, 1, 0) },
		uShowers: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) }, uRainHere: { value: 0 }, uGloom: { value: 0 },
		uFlash: { value: 0 }, uBolt: { value: new THREE.Vector4(0, 0, 0, 99) },
		uFogCol: { value: new THREE.Color() },
		// the haze looking into the sun (raw, as uFogCol is) and how much of it there is
		uFogSunCol: { value: new THREE.Color() }, uFogSunK: { value: 0 },
		// the clouds with depth (VOL_GLSL): on, and where the eye is
		uVolK: { value: 0 }, uCamP: { value: new THREE.Vector3() },
		// another world's air: its sky and haze take this colour (rgb), this much (a)
		uAir: cloudReflectU(shared).uAirR,
		// a gas giant over its moon (xyz: where, w: its size); a ringed world's rings (on/off)
		uGiant: { value: shared.planet?.sky?.earth ? new THREE.Vector4(0.35, 0.62, -0.7, 0.05) : new THREE.Vector4(0.42, 0.33, -0.84, shared.planet?.sky?.giant ? 0.2 : 0) }, uRings: { value: shared.planet?.sky?.rings ? 1 : 0 }, uEarthSky: { value: shared.planet?.sky?.earth ? 1 : 0 },
		uMeteor: { value: 0 },           // 1 on the nights of the great showers
		// a world's own dusk (planet/arch/: x how much, y how bright) and its crescent moon (xyz where, w on)
		uDusk: shared.uDuskSky || (shared.uDuskSky = { value: new THREE.Vector4(0, 1, 0, 0) }), uDuskMoon: shared.uDuskMoon || (shared.uDuskMoon = { value: new THREE.Vector4(0, 0.5, -0.85, 0) }),
		uBow: { value: null }, uBowK: { value: 0 }, uBowDrop: { value: 0.5 }, uMoonBowK: { value: 0 }, uBowScale: { value: 1.614 },
		// the Moon tonight (xyz where, w how much of it is lit: solar.js lunarPosition), shared for
		// whatever shows it or its light (the sea's glitter, wet sand) to read
		uMoon: shared.uMoonDir || (shared.uMoonDir = { value: new THREE.Vector4(0, 0.5, -0.85, 1) }),
		// the cities' glow on the sky (xz which way it lies, y how lopsided: 0 all round .. 1 one side)
		uGlowDir: shared.uSkyGlowDir || (shared.uSkyGlowDir = { value: new THREE.Vector3(0, 0, 1) }),
	};
	const dome = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), new THREE.ShaderMaterial({
		uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
		// (off phones a second, finer row of mare's tails and the veil's dapples and finer fibres;
		// phones draw the cheaper sky: about half the noise per pixel of the high cloud)
		defines: isPhone ? { SKY_LITE: 1 } : { SKY_RICH: 1 },
		vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
		fragmentShader: /* glsl */`
			uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor; uniform float uTime, uNight, uCloud, uHigh, uGlow; uniform mat3 uW2E, uE2G;
			uniform vec2 uCirrusOff, uWindDir; uniform vec3 uFogCol, uFogSunCol; uniform vec4 uAir, uGiant; uniform float uFogSunK; uniform float uRings, uEarthSky; uniform float uMeteor, uCirrus, uRainHere, uGloom, uFlash, uBowK, uBowDrop, uMoonBowK, uBowScale; uniform vec4 uBolt, uDusk, uDuskMoon, uMoon; uniform vec3 uGlowDir; uniform sampler2D uBow;
			varying vec3 vDir;
			${NOISE_GLSL}
			${CLOUD_GLSL}
			${VOL_GLSL}
			${TAILS_GLSL}
			// the light of a sun a little under the horizon (or just up) on whatever hangs in the
			// sky: through so much air it comes red and orange, gold right over where the sun is,
			// and it lights the undersides of the clouds. Strongest toward the sun and low down,
			// reaching higher up the sky on the sun's side; redder the deeper the sun. dawnK: how
			// much of it there is now (0 by day and by night)
			float dawnK(){ return smoothstep(-0.17, -0.04, uSunDir.y) * (1.0 - smoothstep(0.03, 0.22, uSunDir.y)) * (1.0 - uDusk.x); }
			vec3 dawnLight(vec3 d, float k){
				if (k <= 0.0) return vec3(0.0);
				float a = dot(normalize(uSunDir.xz + 1e-5), normalize(d.xz + 1e-5)) * 0.5 + 0.5;
				float t = pow(a, 5.0), core = pow(a, 30.0) * exp(-max(d.y, 0.0) * 9.0), red = smoothstep(0.02, -0.12, uSunDir.y);
				// (saturated beyond what it looks: the tone mapping takes the colour out of bright light)
				vec3 c = mix(vec3(0.9, 0.1, 0.14), vec3(1.0, 0.22, 0.02), t);
				c = mix(c, vec3(1.0, 0.6, 0.08), core * (1.0 - red) * 0.75);
				c = mix(c, vec3(0.75, 0.05, 0.18), red * (1.0 - core) * 0.5);
				return c * k * (0.15 + 1.35 * t + 1.2 * core) * exp(-max(d.y, 0.0) / (0.06 + 0.3 * t));
			}
			// the rainbow table (rainbow.js): angle from the antisolar point, 25 to 60 degrees
			vec3 bowAt(float ang){
				vec3 b = texture2D(uBow, vec2(clamp((ang - 25.0) / 35.0, 0.0, 1.0), uBowDrop)).rgb;
				return b * b * uBowScale * smoothstep(64.0, 60.0, ang) * smoothstep(8.0, 25.0, ang);
			}
			void main(){
				vec3 d = normalize(vDir);
				float h = max(d.y, 0.0);
				vec3 col = mix(uSkyHor, uSkyZen, pow(h, 0.5));
				// a world's own dusk: magenta at the horizon, violet, deep indigo overhead
				if (uDusk.x > 0.0) col = mix(col, mix(mix(vec3(1.0, 0.12, 0.42), vec3(0.3, 0.04, 0.46), smoothstep(0.0, 0.16, h)), vec3(0.008, 0.01, 0.06), smoothstep(0.1, 0.5, h)) * uDusk.y, uDusk.x);
				float sd = max(dot(d, uSunDir), 0.0);
				col += uSunColor * (pow(sd, 12.0) * 0.18 + pow(sd, 3.0) * 0.06) * (1.0 - uNight);
				// (the disc itself goes on after the clouds, as much of it as they let through)
				float sunDisc = smoothstep(0.9993, 0.9997, sd) * 18.0 * (1.0 - uNight);
				float sunT = 1.0;
				// a low sun: the air toward it fills with warm, bright haze (forward scattering),
				// strongest along the horizon under it, and the eye sees a starburst round it
				float lowK = (1.0 - smoothstep(0.04, 0.4, uSunDir.y)) * step(-0.02, uSunDir.y) * (1.0 - uNight);
				vec2 sh2d = normalize(uSunDir.xz + 1e-5), dh2d = normalize(d.xz + 1e-5);
				float toward = pow(max(dot(sh2d, dh2d), 0.0), 5.0);
				// the haze the land stands in, as it is this way: lit looking toward the sun (the
				// same glow world/airfog.js gives the fog), plain away from it
				float fogMu = max(dot(sh2d, dh2d), 0.0);
				vec3 fogC = mix(uFogCol, uFogSunCol, clamp((fogMu * fogMu * fogMu * 0.4 + pow(fogMu, 12.0) * 0.6) * uFogSunK, 0.0, 1.0));
				// (golden hour is yellow-gold toward the sun under a sky still blue overhead)
				vec3 gold = mix(uSunColor, vec3(1.0, 0.8, 0.42), 0.6);
				col += gold * (pow(sd, 6.0) * 0.8 + pow(sd, 40.0) * 0.8 + toward * (1.0 - smoothstep(0.0, 0.3, d.y)) * 0.9) * lowK * (1.0 - uCloud * 0.35);
				// (and before sunrise, after sunset, the band of glow along the horizon under the sun)
				float dk = dawnK();
				vec3 dawnL = dawnLight(d, dk);
				float dawnW = clamp(max(dawnL.r, max(dawnL.g, dawnL.b)), 0.0, 1.0);
				col = col * (1.0 - dawnW * 0.35 * (1.0 - smoothstep(0.0, 0.3, d.y))) + dawnL * 0.35 * (1.0 - smoothstep(0.0, 0.3, d.y));
				{
					vec3 axis = abs(uSunDir.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
					vec3 t1 = normalize(cross(uSunDir, axis)), t2 = cross(t1, uSunDir);
					vec2 q = vec2(dot(d, t1), dot(d, t2));
					float r = length(q), a = atan(q.y, q.x);
					float rays = pow(abs(cos(a * 3.0)), 60.0) + 0.6 * pow(abs(cos(a * 4.0 + 0.5)), 90.0) + 0.3 * pow(abs(cos(a * 9.0 + 1.3)), 30.0);
					col += mix(uSunColor, vec3(1.0, 0.9, 0.6), 0.5) * rays * exp(-r * 9.0) * step(0.0, dot(d, uSunDir)) * (0.6 + lowK * 1.6) * (1.0 - uNight) * (1.0 - uCloud * 0.6);
				}
				// the Milky Way: the galaxy's disc seen edge-on, from its real place in the sky.
				// Galactic longitude l, latitude b: a band along b = 0, the bulge swelling toward
				// Sagittarius (l = 0), bright star clouds, and the Great Rift's dark dust splitting
				// it from Cygnus down to the centre. Light-polluted skies wash it out.
				if (uNight > 0.01 && d.y > -0.05){
					vec3 eq = uW2E * d, g = uE2G * eq;
					float l = atan(g.y, g.x), b = asin(clamp(g.z, -1.0, 1.0));
					float core = exp(-l * l / 0.55);
					float width = 0.09 + 0.16 * core + 0.03 * exp(-pow(l - 1.4, 2.0) / 0.2);
					float band = exp(-b * b / (width * width));
					vec2 gp = vec2(l * 9.0, b * 20.0);
					float clouds = fbm5(gp * 0.8 + 3.0) * 0.9 + fbm5(gp * 2.3 - 5.0) * 0.5;
					float bright = band * (0.28 + 0.9 * core + 0.35 * exp(-pow(l - 1.4, 2.0) / 0.25) + 0.15 * exp(-pow(abs(l) - 2.6, 2.0) / 0.3)) * (0.5 + clouds);
					// dust lanes: the Rift along the plane from Cygnus (l ~ 80 deg) to the core, and dark knots
					float rift = exp(-pow((b - 0.02 - 0.03 * sin(l * 3.0) - 0.02 * (fbm5(gp * 0.6) - 0.5)) / (0.035 + 0.03 * core), 2.0)) * smoothstep(1.7, 0.9, l) * smoothstep(-0.7, -0.1, l);
					float knots = smoothstep(0.5, 0.85, fbm5(gp * 1.4 + 11.0)) * band;
					bright *= 1.0 - 0.6 * rift - 0.35 * knots;
					bright *= 0.75 + 0.5 * fbm5(gp * 3.1 + 7.0);                              // mottled, never smooth
					vec3 mw = mix(vec3(0.55, 0.62, 0.82), vec3(1.0, 0.8, 0.58), core * 0.85);
					// the unresolved glow of countless faint stars: fine grain on the band
					float grain = step(0.985, h21(floor(d.xz * 900.0 / (abs(d.y) + 0.3)) + floor(d.y * 700.0))) * band;
					float horizon = smoothstep(0.0, 0.25, d.y);
					col += (mw * bright * 0.04 + vec3(0.9, 0.9, 1.0) * grain * 0.1) * uNight * horizon * (1.0 - uGlow * 0.85);
					// Andromeda: a faint elongated smudge at RA 0h42m, Dec +41 deg
					vec3 m31 = vec3(0.7336, 0.1368, 0.6597);
					float am = dot(eq, m31);
					if (am > 0.99){
						vec3 ax = normalize(cross(m31, vec3(0.0, 0.0, 1.0))), ay = cross(ax, m31);
						vec2 q = vec2(dot(eq, ax), dot(eq, ay));
						vec2 qr = mat2(0.8, -0.6, 0.6, 0.8) * q;
						float e2 = qr.x * qr.x / 0.0009 + qr.y * qr.y / 0.00008;
						col += vec3(0.85, 0.82, 0.78) * (exp(-e2) * 0.025 + exp(-e2 * 30.0) * 0.05) * uNight * horizon * (1.0 - uGlow);
					}
					// now and then a meteor (every couple of seconds on the nights of the showers)
					float mper = mix(7.0, 2.3, uMeteor);
					float mt = floor(uTime / mper), mf = fract(uTime / mper) * mper / 7.0;
					if (h21(vec2(mt, 3.0)) > mix(0.55, 0.1, uMeteor) && mf < 0.12){
						vec3 m0 = normalize(vec3(h21(vec2(mt, 1.0)) - 0.5, 0.55 + h21(vec2(mt, 2.0)) * 0.4, h21(vec2(mt, 4.0)) - 0.5));
						vec3 mdir = normalize(cross(m0, vec3(0.3, 1.0, 0.2)));
						vec3 head = normalize(m0 + mdir * mf * 1.6);
						vec3 tail = normalize(m0 + mdir * max(0.0, mf * 1.6 - 0.12));
						vec3 seg = head - tail; float tt = clamp(dot(d - tail, seg) / dot(seg, seg), 0.0, 1.0);
						float md = length(d - (tail + seg * tt));
						col += vec3(0.9, 0.95, 1.0) * smoothstep(0.0025, 0.0, md) * tt * (1.0 - mf / 0.12) * uNight * 1.5;
					}
				}
				// the gas giant: a banded ball lit on the sun's side, its night side faintly lit by its moons
				if (uGiant.w > 0.0 && uEarthSky < 0.5 && d.y > -0.05){
					vec3 gc = normalize(uGiant.xyz);
					float gd = acos(clamp(dot(d, gc), -1.0, 1.0)) / uGiant.w;
					if (gd < 1.0){
						vec3 gu = normalize(cross(gc, vec3(0.2, 1.0, 0.1))), gv = cross(gu, gc);
						vec2 q = vec2(dot(d - gc, gu), dot(d - gc, gv)) / sin(uGiant.w);
						vec3 gn = normalize(q.x * gu + q.y * gv - sqrt(max(0.0, 1.0 - dot(q, q))) * gc);
						float lat = q.y * 0.94 + q.x * 0.34;
						float bands = sin(lat * 19.0 + sin(q.x * 6.0 + uTime * 0.01) * 0.6) * 0.5 + 0.5;
						vec3 gcol = mix(vec3(0.78, 0.60, 0.42), vec3(0.95, 0.88, 0.74), bands);
						gcol = mix(gcol, vec3(0.62, 0.36, 0.24), smoothstep(0.78, 0.9, 1.0 - length(q - vec2(0.25, -0.3)) * 3.5) * 0.8);
						float lit = clamp(dot(-gn, uSunDir) * 1.1 + 0.05, 0.0, 1.0);
						vec3 disk = gcol * (lit * 1.25 + 0.03) * (1.0 - smoothstep(0.9, 1.0, gd) * 0.35);
						float a = smoothstep(1.0, 0.985, gd) * mix(0.55, 1.0, max(uNight, 1.0 - clamp(uSunDir.y * 2.0, 0.0, 1.0) * 0.4));
						col = mix(col, disk, a);
					}
				}
				// a ringed world: its rings arc across the sky, bands of pale ice and gaps
				if (uRings > 0.5 && d.y > 0.0){
					vec3 rn = normalize(vec3(0.25, 0.35, 0.9));
					float rb = dot(d, rn);
					vec3 rp = normalize(d - rn * rb);
					float r = abs(rb) * 7.0 + 0.2 + rp.x * 0.05;
					float band = smoothstep(0.02, 0.0, abs(rb) - 0.075) * (0.55 + 0.45 * sin(r * 40.0)) * step(0.2, fract(r * 3.1));
					float shadowed = smoothstep(-0.05, 0.1, dot(rp, uSunDir) + 0.3);
					col += vec3(0.92, 0.88, 0.8) * band * 0.45 * smoothstep(0.0, 0.15, d.y) * mix(0.6, 1.4, uNight) * shadowed;
				}
				// the cities' glow on a clear night: the sodium and LED light of the towns scattered
				// in the air low over them, brightest toward them, washing out the stars there
				if (uNight > 0.01 && uGlow > 0.01 && d.y > -0.05){
					vec2 gdir = normalize(uGlowDir.xz + 1e-5);
					float side = mix(1.0, 0.55 + 0.45 * dot(normalize(d.xz + 1e-5), gdir), uGlowDir.y);
					col += vec3(1.0, 0.6, 0.34) * uGlow * uNight * side * (exp(-max(d.y, 0.0) * 9.0) * 0.03 + exp(-max(d.y, 0.0) * 2.5) * 0.006);
				}
				if (d.y > -0.02 && uDuskMoon.w < 0.5){
					// the moon where it really is tonight, lit on the sun's side (its phase), with a
					// faint earthshine on the dark side and the seas darker; pale by day
					vec3 mo = uMoon.xyz;
					float md = dot(d, mo);
					float up = smoothstep(-0.02, 0.03, mo.y);
					if (md > 0.9998){
						const float R = 0.0105;
						vec3 t1 = normalize(cross(mo, vec3(0.0, 1.0, 0.0) + vec3(1e-4, 0.0, 0.0))), t2 = cross(t1, mo);
						vec2 q = vec2(dot(d, t1), dot(d, t2)) / R;
						float r = length(q);
						if (r < 1.0){
							vec3 n = q.x * t1 + q.y * t2 - sqrt(max(0.0, 1.0 - r * r)) * mo;
							float lit = smoothstep(-0.04, 0.08, dot(n, uSunDir));
							float seas = smoothstep(0.42, 0.68, fbm5(q * 2.2 + 7.0)) * 0.42;
							float limb = 0.82 + 0.18 * sqrt(max(0.0, 1.0 - r * r));
							vec3 disc = vec3(0.95, 0.94, 0.9) * (lit * 2.4 * (1.0 - seas) * limb + 0.012);
							float aa = smoothstep(1.0, 0.9, r) * up;
							col = mix(col, max(col, disc), aa * mix(0.28, 1.0, uNight) * (1.0 - uDuskMoon.w));
						}
					}
					// the glow round it in the air, as bright as the moon is
					float glow = pow(max(md, 0.0), 900.0) * 0.12 + pow(max(md, 0.0), 60.0) * 0.05;
					col += vec3(0.8, 0.86, 1.0) * glow * pow(uMoon.w, 2.4) * uNight * up;
				}
				// the dusk's crescent: a lit disc less the same disc a little higher, and its glow
				if (uDuskMoon.w > 0.0){
					vec3 mo = normalize(uDuskMoon.xyz);
					float c1 = smoothstep(0.99985, 0.99991, dot(d, mo)), c2 = smoothstep(0.99983, 0.99989, dot(d, normalize(mo + vec3(0.0, 0.0075, 0.0))));
					col += vec3(0.9, 0.88, 1.0) * (c1 * (1.0 - c2) * 3.0 + pow(max(dot(d, mo), 0.0), 900.0) * 0.12) * uDuskMoon.w;
				}
				// cirrus: thin, fibrous, far above, combed out along the wind; it catches the
				// colour of a low sun and keeps it after sunset
				if (d.y > 0.0 && uCirrus > 0.01){
					vec2 cc = d.xz / (d.y + 0.03) * 0.55 + uCirrusOff;
					vec2 wd = normalize(uWindDir + vec2(1e-4));
					vec2 q = vec2(dot(cc, wd) * 0.16, dot(cc, vec2(-wd.y, wd.x)));
					float f = fbm5(q * 3.0) * 0.7 + fbm5(q * vec2(2.0, 11.0) + 3.0) * 0.35;
					float ci = smoothstep(0.55, 0.85, f) * uCirrus * smoothstep(0.0, 0.18, d.y) * (1.0 - uGloom * 0.7);
					vec3 cirCol = mix(vec3(1.02), uSunColor * 1.35, 0.35 + 0.4 * (1.0 - smoothstep(0.1, 0.5, uSunDir.y))) * (1.0 - uNight * 0.93) + dawnL * 0.8;
					col = mix(col, cirCol + uSkyHor * 0.15, ci * 0.55);
					sunT *= 1.0 - ci * 0.55;
				}
				// mare's tails: hooked tufts of ice up near the cirrus, each trailing a fall streak that
				// the wind combs out and bends behind it; they come in rows, here and there over the sky
				if (d.y > 0.0 && uHighCl.x > 0.01){
					vec2 cc = d.xz / (d.y + 0.03) * 0.55 + uCirrusOff * 1.15;
					vec2 wd = normalize(uWindDir + vec2(1e-4));
					vec2 u = vec2(dot(cc, wd), dot(cc, vec2(-wd.y, wd.x))) * 4.2;
					float rows = smoothstep(0.4, 0.66, fbm3(u * vec2(0.05, 0.13) + 31.0));
					float ta = rows > 0.0 ? tails(u, uTime) : 0.0;
					#ifdef SKY_RICH
					if (rows > 0.0) ta = max(ta, tails(u * 1.7 + vec2(13.0, 5.0), uTime) * 0.7);
					#endif
					ta *= rows * uHighCl.x * smoothstep(0.0, 0.2, d.y) * (1.0 - uGloom * 0.7);
					vec3 tCol = mix(vec3(1.04), uSunColor * 1.4, 0.3 + 0.45 * (1.0 - smoothstep(0.1, 0.5, uSunDir.y))) * (1.0 - uNight * 0.93) + dawnL * 0.8;
					col = mix(col, tCol + uSkyHor * 0.12, clamp(ta, 0.0, 1.0) * 0.62);
					sunT *= 1.0 - clamp(ta, 0.0, 1.0) * 0.62;
				}
				// the high veil (CLOUD_GLSL veilAt): milk-white where it is thin and lit, grey where it
				// is thick; the sun through it a pale disc in a bright glow, ringed by a faint halo
				// where the sheet is ice. A low sun lights it gold from beneath, and before sunrise and
				// after sunset it glows rose; by night it hides the stars and the moon wears a corona
				{
					float vtex; vec2 vq;
					float va = veilAt(d, vtex, vq);
					if (va > 0.002){
						float thick = smoothstep(0.4, 1.1, vtex) * uHighCl.y;
						// here and there, a patch of small heaps under it (altocumulus), dark against the glow
						#ifdef SKY_LITE
						float dap = 0.0;
						#else
						float dap = smoothstep(0.42, 0.75, vn(vq * 24.0) * 0.75 + vn(vq * 61.0) * 0.25) * smoothstep(0.45, 0.66, fbm3(vq * 0.9 - 9.0)) / (1.0 + length(vq - uVeil.xy) * 0.7) * smoothstep(0.0, 0.25, va);
						#endif
						// (a low sun leaves its underside in shade: grey-blue, darker where it is thick)
						float hiSun = smoothstep(0.02, 0.45, uSunDir.y);
						vec3 vcol = mix(vec3(0.97, 0.97, 1.0), vec3(0.42, 0.46, 0.56), clamp(thick * (1.0 - hiSun * 0.35) + dap * 0.65, 0.0, 1.0));
						vcol *= mix(vec3(1.0), uSunColor, 0.4) * (1.0 - uGloom * 0.4) * (0.72 + 0.28 * hiSun);
						vcol += uSunColor * (pow(sd, 24.0) * 0.9 + pow(sd, 5.0) * 0.3) * (1.0 - thick * 0.6) * (1.0 - uNight);
						vcol += gold * toward * lowK * 0.8 * (1.0 - smoothstep(0.0, 0.5, d.y));
						// (seen edge-on far off it melts into the glow along the horizon)
						vcol = mix(vcol, uSkyHor * 1.05 + gold * toward * lowK * 0.6, (1.0 - smoothstep(0.0, 0.07, d.y)) * 0.6);
						// (at dawn and dusk: grey-violet, its underside lit red and orange toward the sun)
						// (the glow takes the place of the sheet's own grey rather than going on top: added
						// to it, the colour came out a pale peach)
						vcol = mix(vcol, vcol * vec3(0.36, 0.37, 0.5), dk * 0.75) * (1.0 - dawnW * 0.85) + dawnL * (0.55 + 0.9 * vtex) * (1.0 - thick * 0.3);
						if (sd > 0.85){
							float ang = acos(min(sd, 1.0));
							vcol += vec3(1.0, 0.95, 0.88) * exp(-pow((ang - 0.384) / 0.011, 2.0)) * 0.16 * (1.0 - thick) * smoothstep(0.03, 0.2, uSunDir.y);
						}
						vcol *= 1.0 - uNight * 0.96;
						vcol += vec3(1.0, 0.62, 0.38) * uGlow * uNight * 0.035;
						vcol += vec3(0.8, 0.86, 1.0) * pow(max(dot(d, uMoon.xyz), 0.0), 80.0) * 0.3 * uMoon.w * uNight * (1.0 - thick);
						float vk = clamp(va + dap * 0.7 * uHighCl.y, 0.0, 1.0);
						// (the sun's own disc is far brighter than the sky round it: the sheet that only
						// dims the sky all but puts it out, leaving the pale disc seen through cloud)
						if (sd > 0.9990) { vk = 1.0 - pow(1.0 - vk, 3.0); vcol += uSunColor * smoothstep(0.9993, 0.9997, sd) * 1.6 * (1.0 - thick * 0.7) * (1.0 - uNight); }
						col = mix(col, vcol, vk * 0.97);
						sunT *= 1.0 - vk * 0.97;
					}
				}
				// cumulus on a plane above you, lit from the sun's side; dark and heaped over showers
				float base, sh;
				float dens = cumulus(d, uCloud, uTime, base, sh);
				// (with depth, near: the marched layer in place of the plane, which keeps the far sky)
				float volLit = -1.0, volMix = 0.0;
				if (uVolK > 0.5) {
					vec3 vc = volClouds(d, uCloud, uTime, sh, uSunDir);
					float farK = smoothstep(26000.0, 52000.0, vc.z);
					// (the shapes stay the plane's own: a few marched steps with no frames to average
					// them over drew the clouds in slices. The march gives their light: sunlit tops and
					// shaded bellies where the slab is thick, the plane's flat look where it is thin)
					float volA = smoothstep(0.05, 0.45, vc.x) * (1.0 - farK);
					if (volA > 0.0) volLit = clamp(vc.y * 1.15, 0.0, 1.2);
					volMix = volA * 0.7;
				}
				if (dens > 0.0){
					// lit from the sun's side: denser toward the sun means this side is in shade
					float toward, sh2;
					cumulus(normalize(d + vec3(uSunDir.x, 0.0, uSunDir.z) * 0.035), uCloud, uTime, toward, sh2);
					float lit = clamp(0.62 + (base - toward) * 4.0, 0.0, 1.2);
					if (volLit >= 0.0) lit = mix(lit, volLit, volMix);
					float cover = mix(0.8, 0.3, uCloud);
					// bright sunlit tops, cool grey-blue bases: a cloud with volume, not a smear
					vec3 shade = mix(vec3(0.46, 0.52, 0.64), vec3(1.08), smoothstep(0.1, 1.0, lit)) * (0.85 + 0.25 * smoothstep(cover, cover + 0.35, base));
					// rain clouds: slate grey and heavy, darker and lighter masses through the deck
					float heavy = mix(0.38, 0.14, smoothstep(0.5, 1.1, base - sh * 0.4));
					shade *= mix(1.0, heavy, clamp(sh * 1.4, 0.0, 1.0)) * (1.0 - uGloom * 0.45);
					// a solid overcast is a stratocumulus deck, not heaped cumulus: flat blue-grey and low
					// in contrast, in soft rolls drawn out along the wind, paler where it is thin, and
					// toward a low sun it pales to cream (Josh's photos over the Bay hills)
					float deckK = smoothstep(0.6, 0.92, uCloud) * (1.0 - clamp(sh * 1.4, 0.0, 1.0));
					if (deckK > 0.0){
						vec2 cpd = d.xz / (d.y + 0.08) * 1.6 + uCloudOff, wdk = normalize(uWindDir + vec2(1e-4));
						vec2 rq = vec2(dot(cpd, wdk) * 0.14, dot(cpd, vec2(-wdk.y, wdk.x)) * 0.55);
						float roll = vn(rq + 3.0) * 0.65 + vn(rq * 2.7 + 9.0) * 0.35;
						// (its lobes: the thick parts of the field hang lower and darker, the thin parts pale)
						float lobe = smoothstep(cover + 0.05, cover + 0.45, base);
						float thin = 1.0 - smoothstep(cover, cover + 0.2, base);
						float sunSide = pow(max(dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)), 0.0), 2.0) * (1.0 - smoothstep(0.0, 0.45, d.y)) * smoothstep(-0.02, 0.1, uSunDir.y);
						float mottle = vn(cpd * 2.3 + 17.0);
						vec3 deck = mix(vec3(0.22, 0.26, 0.33), vec3(0.56, 0.59, 0.63), clamp(roll * 1.3 - lobe * 0.5 + thin * 0.55 + mottle * 0.2 - 0.15, 0.0, 1.0));
						deck = mix(deck, vec3(0.90, 0.85, 0.68), sunSide * (0.35 + 0.55 * thin) * (1.0 - lobe * 0.5));
						shade = mix(shade, deck * (1.0 - uGloom * 0.2), deckK);
					}
					// at night the clouds are dark shapes against the stars, rimmed faintly by moonlight
					vec3 cloud = shade * mix(vec3(1.0), uSunColor * 0.9, 0.35) * (1.0 - uNight * 0.975) + uSkyHor * 0.12;
					// at dawn and dusk the heaps go grey-violet, their bellies lit red and orange from
					// under the horizon (most where they are shaded from above, least in a shower's deck)
					float dw = dawnW * (1.0 - sh * 0.7) * (1.0 - uGloom * 0.5);
					cloud = mix(cloud, cloud * vec3(0.36, 0.37, 0.5), dk * 0.75) * (1.0 - dw * 0.85) + dawnL * (1.3 - smoothstep(0.6, 1.2, lit) * 0.4) * (0.6 + 0.6 * smoothstep(cover, cover + 0.4, base)) * (1.0 - sh * 0.7) * (1.0 - uGloom * 0.5);
					// over the towns at night their glow on the clouds' undersides: a low overcast
					// over a city reads orange-grey, lit from below, brightest toward it
					if (uGlow > 0.01){
						vec2 gdir = normalize(uGlowDir.xz + 1e-5);
						float side = mix(1.0, 0.6 + 0.4 * dot(normalize(d.xz + 1e-5), gdir), uGlowDir.y);
						cloud += vec3(1.0, 0.62, 0.38) * uGlow * uNight * side * (0.012 + 0.05 * uCloud * uCloud) * (1.0 - 0.5 * smoothstep(0.0, 0.6, d.y));
					}
					cloud += uSunColor * pow(sd, 6.0) * 0.5 * (1.0 - uNight) * (1.0 - sh) * (1.0 - deckK * 0.6);
					// at a world's dusk the heaps are lit pink from below, violet in their tops
					cloud = mix(cloud, mix(vec3(1.0, 0.4, 0.62), vec3(0.2, 0.13, 0.34), smoothstep(0.2, 1.0, lit)) * uDusk.y, uDusk.x * 0.9);
					// lightning lights the cloud from inside
					cloud += vec3(0.75, 0.8, 1.0) * uFlash * (0.5 + sh * 1.5);
					// (at a world's dusk the thin cloud thins away: heaps in a clear sky)
					col = mix(col, cloud, dens * 0.95 * (1.0 - uDusk.x * 0.6 * (1.0 - smoothstep(0.35, 0.85, dens))));
				}
				// crepuscular rays: under a broken overcast the air below the deck is lit in slanting
				// fans where the sun comes through its gaps, converging on the sun behind it. Along the
				// line over the deck from here to the sun, how much of it is gap (a coarse read of the
				// same field) is how much lit air lies along this line of sight
				float rayK = smoothstep(0.5, 0.75, uCloud) * smoothstep(0.02, 0.1, uSunDir.y) * (1.0 - uNight) * (1.0 - uGloom * 0.5) * (1.0 - uDusk.x);
				if (rayK > 0.0 && sd > 0.1 && d.y > -0.02){
					vec2 cp0 = d.xz / (max(d.y, 0.0) + 0.08) * 1.6 + uCloudOff, cs = uSunDir.xz / (uSunDir.y + 0.08) * 1.6 + uCloudOff;
					float rcover = mix(0.8, 0.3, uCloud), gap = 0.0;
					#ifdef SKY_LITE
					const int RN = 4;
					#else
					const int RN = 7;
					#endif
					for (int i = 0; i < RN; i++){
						vec2 p = mix(cp0, cs, (float(i) + 0.5) / float(RN));
						float g = (vn(p * 0.9) * 0.5 + vn(p * 1.818 + 3.1) * 0.25) * 0.78 + (vn(p * 0.32 + 11.0) * 0.5 + vn(p * 0.646 + 14.1) * 0.25) * 0.71;
						gap += 1.0 - smoothstep(rcover - 0.08, rcover + 0.08, g);
					}
					gap /= float(RN);
					float fan = (0.25 + 0.75 * pow(sd, 2.0)) * smoothstep(0.1, 0.35, sd) * (1.0 - smoothstep(0.08, 0.55, d.y)) * smoothstep(-0.02, 0.03, d.y);
					col += uSunColor * vec3(1.0, 0.96, 0.84) * gap * fan * rayK * 2.4;
				}
				// the sun: a hard disc in a clear sky, a pale one through thin cloud; through a deck too
				// thick to see it by, no disc at all, only a soft bright patch of cloud where it is
				sunT *= exp(-dens * 7.0) * (1.0 - smoothstep(0.65, 0.95, uCloud)) * (1.0 - uGloom * 0.8);
				col += uSunColor * sunDisc * sunT;
				if (sd > 0.9) col += uSunColor * (pow(sd, 300.0) * 0.45 + pow(sd, 40.0) * 0.16) * (1.0 - sunT) * (1.0 - uNight) * (1.0 - uGloom * 0.6) * smoothstep(-0.02, 0.06, uSunDir.y);
				// showers far off: curtains of rain hanging under their clouds; the rain the
				// rainbow needs (how much of it lies along this line of sight)
				float rainLine = uRainHere * 2.0;
				vec2 hd = d.xz / max(length(d.xz), 1e-4);
				float tanE = d.y / max(length(d.xz), 1e-4);
				for (int i = 0; i < 4; i++){
					vec4 S = uShowers[i];
					if (S.w < 0.01) continue;
					float tc = dot(S.xy, hd), pd = length(S.xy - hd * tc);
					// the whole stretch of sky toward a far storm goes dark, well past its rain:
					// deepest low down under its cloud, fading up the sky and off to either side
					float topG = 1500.0 / max(tc - S.z * 0.5, 300.0);
					float gloomB = S.w * (1.0 - smoothstep(S.z * 0.6, S.z * 3.4, pd)) * smoothstep(0.0, S.z, tc) * smoothstep(60000.0, 9000.0, tc)
						* smoothstep(-0.03, 0.0, tanE) * (1.0 - smoothstep(topG * 0.8, topG * 3.0, tanE));
					col = mix(col, vec3(0.24, 0.27, 0.32) * (1.0 - uNight * 0.95), gloomB * 0.5);
					float sr = S.z * 1.35;                                      // its veil spreads past the cell
					if (pd >= sr || tc + sr < 0.0) continue;
					float half_ = sqrt(sr * sr - pd * pd), tin = max(tc - half_, 30.0), tout = tc + half_;
					if (tout < 30.0) continue;
					float top = 1500.0 / tin;                                      // the cloud base, seen from here
					float below = smoothstep(top * 1.08, top * 0.8, tanE) * smoothstep(-0.03, 0.0, tanE);
					float thick = clamp((tout - tin) / 1200.0, 0.0, 1.0) * S.w;
					// standing in it, the rain round you is the streaks and the grey (below); the
					// curtain is for showers seen from outside
					bool inside = tc - half_ < 0.0;
					if (!inside) {
						float az = atan(hd.y, hd.x);
						// it leans downwind: the foot has drifted further along than the top, by as much
						// as the wind crosses the line of sight (some 600 m at the ground)
						vec2 wd = normalize(uWindDir + vec2(1e-4));
						float crossW = wd.y * hd.x - wd.x * hd.y;
						float h01 = clamp(tanE / max(top, 1e-4), 0.0, 1.0);
						float azS = az + crossW * (1.0 - h01) * 600.0 / tin;
						// no box: a heavy core and lighter veils beside it (broad cells), the shafts
						// thickening and thinning within, fraying at its sides; its top the ragged
						// underside of the cloud, which it melts into
						float core = smoothstep(0.25, 0.85, vn(vec2(azS * 9.0 + S.x * 0.0007, 1.3)));
						// (broad, soft shafts: finer ones, a few pixels apart on a phone, read as scratches
						// on the sky; and up under the cloud they melt into its base)
						float shafts = 0.4 + 0.6 * vn(vec2(azS * 36.0 + S.x * 0.001, 3.0)) * (0.75 + 0.25 * vn(vec2(azS * 90.0, 7.0)));
						float side = 1.0 - smoothstep(0.7, 1.0, pd / sr);
						// (its top ragged in broad lobes: cut finer, the cut ran up the sky as stripes)
						float ragged = top * (0.85 + 0.2 * vn(vec2(azS * 14.0, 11.0)) + 0.05 * vn(vec2(azS * 40.0, 13.0)));
						// down to the ground, its foot frayed where the last drops dry out
						float fall = smoothstep(ragged * 1.1, ragged * 0.6, tanE) * smoothstep(-0.02, 0.012 * (0.6 + 0.8 * vn(vec2(azS * 120.0, 5.0))), tanE);
						shafts = mix(shafts, 0.7, smoothstep(0.45, 0.95, h01));
						// faint streaks, long and upright, drifting slowly down: only in a shower close by,
						// and gone up near the cloud (the old ones, finer than a pixel, flickered into lines)
						float streak = 1.0 - 0.16 * smoothstep(9000.0, 3000.0, tin) * (1.0 - smoothstep(0.3, 0.8, h01)) * vn(vec2(azS * 240.0, tanE * 2.0 - uTime * 0.25));
						float dens = thick * fall * side * (0.6 + 0.4 * mix(shafts, 1.0, core * 0.6)) * (0.7 + 0.3 * core);
						float veil = dens * streak * smoothstep(42000.0, 7000.0, tin);
						// blue-grey, the sky behind showing through where it is thin; low down it melts
						// into the haze the far land stands in
						vec3 veilC = mix(vec3(0.18, 0.2, 0.25), uSkyHor * 0.7, 0.18 * (1.0 - core)) * (1.0 - uNight * 0.95) * (0.92 + 0.15 * streak);
						veilC = mix(veilC, fogC, (1.0 - smoothstep(0.0, 0.05, tanE)) * 0.55);
						col = mix(col, veilC + vec3(0.6, 0.65, 0.75) * uFlash, clamp(veil * 1.75, 0.0, 0.9));
					}
					rainLine += thick * below * 2.2;
				}
				// the rainbow: round the antisolar point, where sunlit rain lies along the line
				// of sight; added as light. By the full moon (opposite the sun here), a moonbow,
				// too faint for the eye's colour vision: nearly white
				float bowRain = 1.0 - exp(-rainLine);
				if (bowRain > 0.003 && d.y > -0.02){
					if (uBowK > 0.001) {
						float ang = degrees(acos(clamp(dot(d, -uSunDir), -1.0, 1.0)));
						col += bowAt(ang) * uSunColor * uBowK * bowRain * 0.3 * (1.0 - uNight);
					}
					if (uMoonBowK > 0.001) {
						float angM = degrees(acos(clamp(dot(d, uSunDir), -1.0, 1.0)));
						vec3 mb = bowAt(angM);
						col += mix(mb, vec3(dot(mb, vec3(0.3, 0.55, 0.15))), 0.75) * vec3(0.8, 0.88, 1.0) * uMoonBowK * bowRain * 0.035 * uNight;
					}
				}
				// the lightning bolt, down from the cloud base toward its cell
				if (uBolt.w < 0.9){
					float az = atan(d.z, d.x), daz = mod(az - uBolt.x + 3.14159, 6.28318) - 3.14159;
					float el = atan(d.y, length(d.xz)), top = atan(1500.0, uBolt.y);
					if (el > -0.01 && el < top){
						float t = el / top, sc = 1.0 / max(uBolt.y, 400.0);
						float off = ((vn(vec2(t * 9.0, uBolt.z)) - 0.5) * 380.0 + (vn(vec2(t * 37.0, uBolt.z + 3.0)) - 0.5) * 110.0) * sc;
						float w = 4.0 * sc + 0.0008;
						float life = exp(-uBolt.w * 12.0) + 0.7 * exp(-pow((uBolt.w - 0.18) * 30.0, 2.0)) + 0.4 * exp(-pow((uBolt.w - 0.4) * 30.0, 2.0));
						col += vec3(0.85, 0.9, 1.0) * (smoothstep(w, 0.0, abs(daz - off)) * 5.0 + smoothstep(w * 8.0, 0.0, abs(daz - off)) * 0.4) * life;
					}
				}
				// the whole sky a shade lighter in a flash; greyer in rain close by
				col += vec3(0.5, 0.55, 0.7) * uFlash * 0.25;
				// (at dawn and dusk the rain's grey goes lavender: the red light under the deck
				// scattered through it, Josh's photos of a rainy sunrise over the freeway)
				vec3 rainGrey = mix(uSkyHor, vec3(0.5, 0.53, 0.57), 0.5);
				rainGrey = mix(rainGrey, rainGrey * vec3(1.1, 0.96, 1.2), dk);
				col = mix(col, rainGrey * (1.0 - uNight * 0.9), uRainHere * (0.45 + 0.2 * dk * smoothstep(0.15, 0.5, d.y)) * smoothstep(-0.1, 0.4, d.y));
				// and through the rain and the overcast the sunrise still shows: not the clear sky's
				// crimson, a soft peach glow spread low along the horizon toward the sun, the
				// tree line standing against it, dimming up the sky and off to the sides
				float wetDawn = dk * clamp(uRainHere * 1.2 + uGloom * 0.6, 0.0, 1.0);
				if (wetDawn > 0.001){
					float ta = pow(fogMu * 0.5 + 0.5, 4.0);
					col += vec3(1.0, 0.58, 0.36) * wetDawn * (0.1 + 0.9 * ta) * exp(-max(d.y, 0.0) / (0.05 + 0.17 * ta)) * (1.0 - uNight * 0.5);
				}
				// in weather the sky meets the land in the same haze the land is fogged with, so
				// there is no line where the one ends and the other begins
				col = mix(col, fogC, (1.0 - smoothstep(0.0, 0.14, d.y)) * clamp(uGloom * 1.5 + uRainHere, 0.0, 1.0) * 0.85);
				// below the horizon (seen past the land's far edge from high up) the sky is the same
				// haze the land fades into, so no bright line runs along where the land ends
				col = mix(col, mix(uSkyHor, fogC, 0.7), smoothstep(0.02, -0.12, d.y));
				col = mix(col, fogC, smoothstep(0.012, -0.03, d.y) * 0.9);
				// (not under a world's own dusk, whose colours are its own)
				col = mix(col, dot(col, vec3(0.299, 0.587, 0.114)) * uAir.rgb, uAir.a * (1.0 - uDusk.x));
				// no air: a black sky, the sun a hard white disc
				if (uEarthSky > 0.5) col = vec3(0.003, 0.004, 0.007) + uSunColor * (smoothstep(0.9993, 0.9997, dot(d, uSunDir)) * 18.0 + pow(max(0.0, dot(d, uSunDir)), 400.0) * 0.4);
				// Earth over the Moon: blue oceans, brown-green land, white cloud, lit on the sun's side
				// (drawn after the airless darkening, so it keeps its colour in the black sky)
				if (uEarthSky > 0.5){
					vec3 ec = normalize(uGiant.xyz);
					float ed = acos(clamp(dot(d, ec), -1.0, 1.0)) / uGiant.w;
					if (ed < 1.0){
						vec3 eu = normalize(cross(ec, vec3(0.2, 1.0, 0.1))), ev = cross(eu, ec);
						vec2 q = vec2(dot(d - ec, eu), dot(d - ec, ev)) / sin(uGiant.w);
						vec3 en = normalize(q.x * eu + q.y * ev - sqrt(max(0.0, 1.0 - dot(q, q))) * ec);
						float land = smoothstep(0.55, 0.62, 0.5 + 0.25 * sin(q.x * 7.0 + 1.3) * sin(q.y * 5.0 + 0.4) + 0.25 * sin(q.x * 13.0 - q.y * 11.0));
						float cloud = smoothstep(0.6, 0.8, 0.5 + 0.5 * sin(q.y * 17.0 + sin(q.x * 9.0) * 2.0) * sin(q.x * 6.0 + q.y * 3.0));
						vec3 ecol = mix(mix(vec3(0.04, 0.12, 0.38), vec3(0.32, 0.36, 0.2), land), vec3(0.92, 0.94, 0.97), cloud);
						float lit = clamp(dot(-en, uSunDir) * 1.2 + 0.08, 0.0, 1.0);
						col = mix(col, ecol * (lit * 1.3 + 0.02) + vec3(0.1, 0.25, 0.6) * pow(ed, 6.0) * 0.4, smoothstep(1.0, 0.97, ed));
					}
				}
				gl_FragColor = vec4(col, 1.0);
				#include <tonemapping_fragment>
				// (the tone mapping greys out bright colour; the glow of a dawn or a dusk gets its fire back)
				float dawnG = dawnW * smoothstep(0.0, 0.03, d.y) * (1.0 - uEarthSky);
				if (dawnG > 0.0) gl_FragColor.rgb = max(mix(vec3(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722))), gl_FragColor.rgb, 1.0 + dawnG * 1.2), 0.0);
				#include <colorspace_fragment>
			}`,
	}));
	dome.frustumCulled = false;
	// drawn after the land, the city and everything else solid: it sits at the far plane
	// and writes no depth, so the depth test then leaves its clouds (dozens of noise lookups
	// a pixel) uncomputed wherever the ground or a building already covers the sky; drawn
	// first, every pixel of the screen paid for them. It still comes before anything
	// see-through (the sea, the stars, rain), which is drawn over it as before.
	dome.renderOrder = 1000;
	scene.add(dome);

	// ---------- the stars: every naked-eye star in its real place ----------
	const stars = (() => {
		const raw = Uint8Array.from(atob(STARS_B64), (c) => c.charCodeAt(0));
		const S = new Float32Array(raw.buffer);
		const pos = new Float32Array(STAR_COUNT * 3), mag = new Float32Array(STAR_COUNT), col = new Float32Array(STAR_COUNT * 3);
		const bv2rgb = (bv) => {
			// B-V colour to a star's tint: blue-white hot stars to orange cool giants
			const t = THREE.MathUtils.clamp((bv + 0.3) / 2.0, 0, 1);
			return [1.0 - Math.max(0, 0.25 - t) * 1.2 + 0.0, 0.82 + 0.18 * (1 - Math.abs(t - 0.3) * 1.6), 1.0 - t * 0.75];
		};
		for (let i = 0; i < STAR_COUNT; i++) {
			const ra = S[i * 4] / 12 * Math.PI, dec = S[i * 4 + 1] * Math.PI / 180;
			pos.set([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], i * 3);
			mag[i] = S[i * 4 + 2];
			col.set(bv2rgb(S[i * 4 + 3]), i * 3);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
		g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
		const m = new THREE.ShaderMaterial({
			uniforms: { uNight: uniforms.uNight, uTime: shared.uTime, uPx: { value: renderer.getPixelRatio() }, uGlow: uniforms.uGlow, uCloud: uniforms.uCloud, uCloudOff: uniforms.uCloudOff, uShowers: uniforms.uShowers, uHighCl: uniforms.uHighCl, uVeil: uniforms.uVeil },
			vertexShader: `attribute float aMag; attribute vec3 aCol; uniform float uNight, uTime, uPx, uGlow, uCloud; varying vec3 vCol; varying float vA;
				${NOISE_GLSL}
				${CLOUD_GLSL}
				void main(){
					vec3 w = normalize(mat3(modelMatrix) * position);
					vec4 p = viewMatrix * vec4(cameraPosition + w * 11000.0, 1.0);
					gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99998;
					// brightness from magnitude; the faint ones drown in city glow and horizon haze
					float limit = 6.2 - uGlow * 3.2;
					float flux = pow(10.0, -0.4 * (aMag - 1.0));
					float alt = w.y;
					float ext = smoothstep(-0.02, 0.2, alt);
					float tw = 1.0 + (0.25 + 0.5 * (1.0 - smoothstep(0.0, 0.5, alt))) * sin(uTime * (7.0 + fract(aMag * 13.1) * 9.0) + aMag * 40.0);
					// hidden behind the clouds (the dome's own cloud field)
					float cb, csh;
					float cover = clamp(cumulus(w, uCloud, uTime, cb, csh) * 1.3, 0.0, 1.0);
					// (and behind the high veil)
					float vt; vec2 vq;
					cover = max(cover, veilAt(w, vt, vq));
					vA = clamp(sqrt(flux) * 0.55 + 0.25, 0.0, 1.0) * smoothstep(limit, limit - 1.2, aMag) * ext * uNight * tw * (1.0 - cover);
					gl_PointSize = clamp(1.3 + sqrt(flux) * 2.2, 1.2, 7.0) * uPx;
					vCol = aCol;
				}`,
			fragmentShader: `varying vec3 vCol; varying float vA;
				void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = (smoothstep(0.5, 0.0, r) * 0.5 + smoothstep(0.18, 0.0, r)) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a * 1.4, 1.0); }`,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
		});
		const pts = new THREE.Points(g, m);
		pts.frustumCulled = false;
		pts.renderOrder = -9;
		pts.matrixAutoUpdate = false;
		scene.add(pts);
		return pts;
	})();

	// ---------- the planets, where they really are tonight ----------
	// Keplerian elements (JPL, J2000 and their rates per century) for today's date: each
	// planet where it truly is among the stars (Venus an evening or a morning star).
	const planets = (() => {
		const EL = {
			mercury: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, 3.7e-7, 1.906e-5, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
			venus: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, 3.9e-6, -4.107e-5, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
			earth: [1.00000261, 0.01671123, -1.531e-5, 100.46457166, 102.93768193, 0, 5.62e-6, -4.392e-5, -0.01294668, 35999.37244981, 0.32327364, 0],
			mars: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, 1.847e-5, 7.882e-5, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
			jupiter: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -1.1607e-4, -1.3253e-4, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
			saturn: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -0.0012506, -5.0991e-4, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
		};
		const T = (Date.now() / 86400000 + 2440587.5 - 2451545) / 36525, R = Math.PI / 180;
		const helio = (k) => {
			const e0 = EL[k], [a, e, I, L, wb, O] = e0.slice(0, 6).map((v, i) => v + e0[i + 6] * T);
			const w = (wb - O) * R, M = ((L - wb) % 360) * R;
			let E = M;
			for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
			const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
			const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O * R), sO = Math.sin(O * R), cI = Math.cos(I * R), sI = Math.sin(I * R);
			return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, sw * sI * xp + cw * sI * yp];
		};
		const eps = 23.4393 * R, earth = helio('earth');
		const radec = (v) => { const x = v[0], y = v[1] * Math.cos(eps) - v[2] * Math.sin(eps), z = v[1] * Math.sin(eps) + v[2] * Math.cos(eps); const r = Math.hypot(x, y, z); return [Math.atan2(y, x), Math.asin(z / r)]; };
		const LIST = [['mercury', -0.2, [1, 0.92, 0.85]], ['venus', -4.3, [1, 1, 0.94]], ['mars', 0.6, [1, 0.62, 0.42]], ['jupiter', -2.3, [1, 0.95, 0.85]], ['saturn', 0.6, [1, 0.93, 0.72]]];
		const pos = new Float32Array(LIST.length * 3), mag = new Float32Array(LIST.length), col = new Float32Array(LIST.length * 3);
		LIST.forEach(([k, m2, c], i) => {
			const h = helio(k), [ra, dec] = radec([h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]]);
			pos.set([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], i * 3);
			mag[i] = m2; col.set(c, i * 3);
		});
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
		g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
		const p = new THREE.Points(g, stars.material);
		p.frustumCulled = false; p.renderOrder = -9; p.matrixAutoUpdate = false;
		scene.add(p);
		return p;
	})();

	// ---------- satellites: sunlit specks crossing the sky in the hours after dusk ----------
	const sats = (() => {
		const K = 7, pos = new Float32Array(K * 3), mag = new Float32Array(K).fill(20), col = new Float32Array(K * 3).fill(1);
		const orb = [...Array(K)].map((_, i) => {
			const n = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize();
			const u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(n, u);
			return { u, v, ph: Math.random() * 6.28, w: (0.012 + Math.random() * 0.01) * (Math.random() < 0.5 ? 1 : -1), m: i === 0 ? -1.5 : 2.2 + Math.random() * 1.5 };
		});
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
		g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
		const p = new THREE.Points(g, stars.material);
		p.frustumCulled = false; p.renderOrder = -9;
		scene.add(p);
		const d = new THREE.Vector3();
		p.userData.step = (dt, sunY) => {
			// high up they are still in sunlight an hour or two after sunset (and before dawn)
			const lit = THREE.MathUtils.smoothstep(sunY, -0.5, -0.3) * (1 - THREE.MathUtils.smoothstep(sunY, -0.12, -0.05));
			orb.forEach((o, i) => {
				o.ph += o.w * dt;
				d.copy(o.u).multiplyScalar(Math.cos(o.ph)).addScaledVector(o.v, Math.sin(o.ph));
				pos.set([d.x, d.y, d.z], i * 3);
				mag[i] = lit > 0.05 && d.y > 0.05 ? o.m + (1 - lit) * 3 : 20;
			});
			g.attributes.position.needsUpdate = true; g.attributes.aMag.needsUpdate = true;
		};
		return p;
	})();
	// ---------- the constellations' lines: faint, only when asked for (the real sky has none) ----------
	const uCon = { value: 0 };
	const conLines = (() => {
		const pos = [];
		const u = (ra, de) => { const a = ra / 12 * Math.PI, d = de * Math.PI / 180; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };
		for (const C of constellations()) for (const [a, b] of C.lines) pos.push(...u(C.stars[a][0], C.stars[a][1]), ...u(C.stars[b][0], C.stars[b][1]));
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		const m = new THREE.ShaderMaterial({
			uniforms: { uNight: uniforms.uNight, uCon },
			vertexShader: `uniform float uNight, uCon; varying float vA;
				void main(){
					vec3 w = normalize(mat3(modelMatrix) * position);
					gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + w * 10990.0, 1.0); gl_Position.z = gl_Position.w * 0.99997;
					vA = uCon * uNight * smoothstep(-0.02, 0.15, w.y);
				}`,
			fragmentShader: 'varying float vA; void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(vec3(0.55, 0.7, 1.0) * vA * 0.45, 1.0); }',
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
		});
		const L = new THREE.LineSegments(g, m);
		L.frustumCulled = false; L.renderOrder = -9; L.matrixAutoUpdate = false;
		scene.add(L);
		return L;
	})();

	const eqM = new THREE.Matrix4(), rz = new THREE.Matrix4(), w2e = new THREE.Matrix3();
	// the celestial sphere turns with the clock: local sidereal time from solar time
	function orientSky() {
		const lst = ((state.hours + SUN.ra - SUN.noon) % 24 + 24) % 24 / 12 * Math.PI;
		const lat = SUN.lat * Math.PI / 180, sf = Math.sin(lat), cf = Math.cos(lat);
		rz.set(Math.cos(lst), Math.sin(lst), 0, 0, -Math.sin(lst), Math.cos(lst), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
		eqM.set(0, 1, 0, 0, cf, 0, sf, 0, sf, 0, -cf, 0, 0, 0, 0, 1).multiply(rz);
		stars.matrix.copy(eqM); stars.matrixWorld.copy(eqM);
		planets.matrix.copy(eqM); planets.matrixWorld.copy(eqM);
		conLines.matrix.copy(eqM); conLines.matrixWorld.copy(eqM);
		w2e.setFromMatrix4(eqM).transpose();
		uniforms.uW2E.value.copy(w2e);
	}

	const sun = new THREE.DirectionalLight(0xffffff, 3);
	sun.castShadow = true;
	sun.shadow.mapSize.set(isPhone ? 1024 : 2048, isPhone ? 1024 : 2048);
	const sc = sun.shadow.camera;
	sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400;
	// the box the shadows are drawn in, for whoever wants to leave out what cannot be in it:
	// half its width, and how far it reaches either side of you along the light (the light
	// stands SUN_D back from you, and the box runs 400 m from it)
	const SUN_D = 200;
	shared.shadowBox = { half: sc.right, reach: SUN_D };
	sun.shadow.bias = -0.0004;
	sun.shadow.normalBias = 0.04;
	// soft-edged, and never black: skylight still reaches into shade
	sun.shadow.radius = 4;
	sun.shadow.intensity = 0.78;
	// no air: nothing scatters light into the shade, so shadows are hard-edged and near black
	const vacuum = !!shared.planet?.airless;
	if (vacuum) sun.shadow.radius = 1;
	scene.add(sun, sun.target);
	const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.9);
	scene.add(hemi);
	scene.fog = new THREE.FogExp2(0xa9c4dc, 0.00026);

	const state = { hours: shared.startHours ?? 10.5, speed: 1, real: false };
	const tmpA = new THREE.Color(), tmpB = new THREE.Color(), tmpC = new THREE.Color(), tmpD = new THREE.Color(), tmpE = new THREE.Color();
	// the weather drives the clouds, rain, bows and lightning in the sky (weather.js)
	let weather = null;
	function attach(w) {
		weather = w;
		// (the dome and the stars read the weather's own uniforms, by name)
		for (const k of ['uCloudOff', 'uCirrusOff', 'uCirrus', 'uHighCl', 'uVeil', 'uShowers', 'uRainHere', 'uGloom', 'uFlash', 'uBolt', 'uBow', 'uBowK', 'uBowDrop', 'uMoonBowK']) uniforms[k] = w.uniforms[k];
		stars.material.uniforms.uCloudOff = w.uniforms.uCloudOff; stars.material.uniforms.uShowers = w.uniforms.uShowers; stars.material.uniforms.uHighCl = w.uniforms.uHighCl; stars.material.uniforms.uVeil = w.uniforms.uVeil;
	}

	// the Moon: where it is tonight and how much of it is lit (on another world, the old moon
	// opposite the sun, always full)
	const MOON = { ra: 0, dec: 0, lit: 1, waxing: true, age: 15 }, moonDir = new THREE.Vector3(), moonLight = new THREE.Vector3();
	let SUN = solarDate(today());
	Object.assign(SUN, solarTimes(latitude(), SUN.dec, SUN.noon));
	state.sun = SUN;
	function update(dt, focus) {
		// (the clouds with depth: a desktop at the high tier, a world with air)
		uniforms.uVolK.value = !isPhone && !shared.planet?.airless && qualityNow().name === 'high' ? 1 : 0;
		if (focus) uniforms.uCamP.value.copy(focus);
		const d = today(), lat = solarLatitude(latitude());
		if (d.getDate() !== SUN.date || d.getMonth() !== SUN.month || d.getFullYear() !== SUN.year) { SUN = solarDate(d); state.sun = SUN; }
		if (lat !== SUN.lat) Object.assign(SUN, solarTimes(lat, SUN.dec, SUN.noon));
		// daylight hours pass slowly (~9 real minutes), night quickly (~2.5)
		// (real time: one game hour to the real hour, day or night)
		state.hours = state.real ? (state.hours + dt / 3600) % 24 : advanceSolarClock(state.hours, dt, state.speed, SUN);
		// where the sun is: east is +x, north -z, up +y
		const sd = solarDirection(SUN.lat, SUN.dec, state.hours, SUN.noon, shared.uSunDir.value);
		const elev = sd.y;
		const dayK = THREE.MathUtils.smoothstep(elev, -0.05, 0.25);
		const setK = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.02, 0.3);
		const night = 1 - THREE.MathUtils.smoothstep(elev, -0.18, 0.02);
		uniforms.uNight.value = night;
		// (the sky's own sunset colours come only in the last few degrees; before that the
		// sky stays blue and the gold is the light toward the sun, in the dome's shader)
		const skySet = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.0, 0.1);
		tmpA.copy(PAL.dayZen).lerp(PAL.setZen, skySet * 0.8).lerp(PAL.nightZen, night);
		tmpB.copy(PAL.dayHor).lerp(PAL.setHor, skySet * 0.85).lerp(PAL.nightHor, night);
		// overcast and rain: a greyer, lower-contrast sky
		const W = weather?.state, gl = W?.gloom || 0;
		// (round sunrise and sunset the grey goes lavender overhead and warm at the horizon,
		// as a rainy dawn does, the red light under the deck scattered through it)
		const dawnC = THREE.MathUtils.smoothstep(elev, -0.2, -0.05) * (1 - THREE.MathUtils.smoothstep(elev, 0.03, 0.22));
		if (gl > 0) {
			const lz = (tmpA.r + tmpA.g + tmpA.b) / 3, lh = (tmpB.r + tmpB.g + tmpB.b) / 3;
			tmpA.lerp(tmpC.setRGB(lz * (0.95 + 0.14 * dawnC), lz * (1 - 0.05 * dawnC), lz * (1.05 + 0.12 * dawnC)).multiplyScalar(0.8 + 0.4 * (1 - night)), gl * 0.75);
			tmpB.lerp(tmpC.setRGB(lh * (0.97 + 0.12 * dawnC), lh * (1 - 0.02 * dawnC), lh * (1.02 + 0.04 * dawnC)).multiplyScalar(0.85), gl * 0.65);
		}
		shared.uSkyZen.value.copy(tmpA);
		shared.uSkyHor.value.copy(tmpB);
		const sunCol = shared.uSunColor.value.copy(PAL.sunDay).lerp(PAL.sunSet, setK);
		// light: the sun by day, the moon by night
		// cloud over the sun (a shower's, or overcast) takes the direct light and softens the shadows
		// (and a sky closing over, whatever is over the sun just now: under a full overcast
		// there is no direct sun at all, only the grey light from everywhere)
		const overcast = W ? THREE.MathUtils.smoothstep(W.cover ?? 0, 0.6, 0.95) : 0;
		const sunVis = Math.min(W ? W.sunVis : 1, 1 - overcast * 0.85);
		orientSky();
		if (earth) { lunarPosition(d, state.hours, SUN.noon, MOON); celestial(MOON.ra, MOON.dec * 180 / Math.PI, moonDir); }
		else { moonDir.copy(sd).negate(); MOON.lit = 1; }
		uniforms.uMoon.value.set(moonDir.x, moonDir.y, moonDir.z, MOON.lit);
		sun.shadow.intensity = vacuum ? 0.96 : 0.78 * (0.12 + 0.88 * sunVis);
		if (night < 0.5) {
			sun.color.copy(sunCol);
			sun.intensity = (3.4 * dayK + 0.4 * setK) * (0.25 + 0.75 * sunVis);
			sun.position.copy(sd).multiplyScalar(SUN_D).add(focus);
		} else {
			sun.color.copy(PAL.moon);
			// (moonlight: enough to read the shapes of things by, little enough that the lamps
			// and lit windows are what the eye goes to; as the moon is, full or a sliver, and from
			// where it is, its shadows long when it is low; with it down or new, only the faint
			// light of the night sky from overhead)
			const up = THREE.MathUtils.smoothstep(moonDir.y, -0.03, 0.1);
			const k = up * moonlightShare(MOON.lit) * (1 - overcast * 0.8);
			sun.intensity = 0.36 * night * (0.08 + 0.92 * k);
			moonLight.set(0.15, 1, 0.25).normalize().lerp(moonDir, up).normalize();
			sun.position.copy(moonLight).multiplyScalar(SUN_D).add(focus);
			sun.shadow.intensity *= 0.25 + 0.75 * k;
		}
		sun.target.position.copy(focus);
		// the shadow box follows the player in whole texels so edges do not crawl
		const texel = 110 / 2048;
		sun.target.position.x = Math.round(focus.x / texel) * texel;
		sun.target.position.z = Math.round(focus.z / texel) * texel;
		sun.position.x += sun.target.position.x - focus.x;
		sun.position.z += sun.target.position.z - focus.z;
		hemi.color.copy(tmpB).lerp(tmpA, 0.5).multiplyScalar(1.0);
		// light bounced off warm sand and sunlit leaves fills the shade with gold, not grey
		hemi.groundColor.setRGB(0.46, 0.36, 0.18).multiplyScalar(0.3 + 0.7 * dayK);
		// (a rainy or overcast dawn is lit by the whole grey sky, not by a sun still under the
		// hills: the shade is open enough to read the trees and the road by, as a camera has it)
		hemi.intensity = (0.25 + 0.9 * dayK) * (1 - gl * 0.3) * (1 + overcast * 0.35 * dayK) * (1 + dawnC * 1.0 * Math.max(gl, overcast)) + (W?.flash || 0) * 2.5;
		// (in vacuum only the grey ground's bounce fills the shade)
		if (vacuum) { hemi.groundColor.setRGB(0.4, 0.4, 0.4); hemi.intensity *= 0.3; }
		// a town by night is never as dark as open country: its lamps light the streets and the
		// low sky, and that light comes back into every shade, so a wall turned from the moon and
		// the lamps is still there to see, warm grey, not black. How much is how built up the
		// ground round you is (uCityLight, island-frame.js). Everything in town takes it alike:
		// the far painted blocks and the buildings built up close have the same night
		const cityK = night * (shared.uCityLight?.value || 0) * (vacuum ? 0 : 1);
		if (cityK > 0.001) {
			hemi.color.r += CITY_SKY.r * cityK; hemi.color.g += CITY_SKY.g * cityK; hemi.color.b += CITY_SKY.b * cityK;
			hemi.groundColor.r += CITY_GROUND.r * cityK; hemi.groundColor.g += CITY_GROUND.g * cityK; hemi.groundColor.b += CITY_GROUND.b * cityK;
		}
		shared.uAmbient.value.copy(hemi.color).multiplyScalar(0.35 * hemi.intensity + 0.02);
		// (the sky off the leaves' waxy faces, world/vegetation.js swayMaterial: none without a sky)
		(shared.uLeafSheen ||= { value: 0 }).value = vacuum ? 0 : LEAF_SHEEN_DAY + (LEAF_SHEEN_DUSK - LEAF_SHEEN_DAY) * (1 - dayK);
		// haze: blue by day so far land stacks up in layers
		const haze = uniforms.uFogCol.value.copy(tmpB).lerp(tmpA, 0.12);
		const rainK = W ? Math.min(1, W.rainHere * 0.6 + gl * 0.3) : 0;
		if (W) haze.lerp(tmpC.setRGB(0.5 + 0.08 * dawnC, 0.53 - 0.01 * dawnC, 0.57 + 0.06 * dawnC).multiplyScalar(1 - night * 0.9), rainK);
		const dk = uniforms.uDusk.value;
		if (dk.x > 0) haze.lerp(tmpC.setRGB(0.24, 0.07, 0.26).multiplyScalar(dk.y), dk.x * 0.85);
		const air = uniforms.uAir.value;
		if (air.w > 0) haze.lerp(tmpC.setRGB(air.x, air.y, air.z).multiplyScalar(haze.r * 0.299 + haze.g * 0.587 + haze.b * 0.114), air.w * (1 - dk.x));
		// (the same exposure by night: the night is dark, lit where real lights are. The look
		// takes the day a touch under and deepens the shade (world/grade.js); as the light goes
		// that is opened back up, as an eye adapts, so a dusk street is not crushed to black and
		// the town's light and the moon's stay as they were tuned)
		renderer.toneMappingExposure = 1.15 * (1 + LOW_OPEN * (1 - dayK) - NIGHT_TRIM * night);
		// The sky is tone mapped, but three.js mixes the fog in after the tone mapping, so a
		// fully fogged hill came out the raw haze colour: a pale cyan much brighter than the
		// sky's own horizon just above it, which drew a bright band where the far land and
		// sea meet the sky. The fog gets the haze as the sky shows it instead.
		if (renderer.toneMapping === THREE.AgXToneMapping) agx(haze, renderer.toneMappingExposure, scene.fog.color);
		else scene.fog.color.copy(haze);
		// the haze looking into the sun, as the dome glows that way (world/airfog.js): a little
		// of the sun's colour by day, and the gold of a low sun along the horizon under it
		{
			const lowK = (1 - THREE.MathUtils.smoothstep(elev, 0.04, 0.4)) * (elev > -0.02 ? 1 : 0) * (1 - night);
			const into = tmpD.copy(sunCol).multiplyScalar(0.32 * (1 - overcast * 0.7)).add(tmpE.copy(sunCol).lerp(GOLD, 0.6).multiplyScalar(1.5 * lowK * (1 - uniforms.uCloud.value * 0.35))).add(haze);
			// (before sunrise and after sunset the haze toward the sun glows peach, most in the
			// thick haze of rain and overcast, where the far land is all haze and the glow is the sky)
			into.add(tmpE.copy(PEACH).multiplyScalar(0.7 * dawnC * (0.35 + 0.65 * Math.min(1, rainK * 1.6 + overcast * 0.5))));
			if (dk.x > 0) into.lerp(haze, dk.x);
			// (the dome's low sky and the wet roads take the same colour, raw as uFogCol is)
			uniforms.uFogSunCol.value.copy(into);
			shared.uSkySun?.value.copy(into);
			if (air.w > 0) into.lerp(tmpC.setRGB(air.x, air.y, air.z).multiplyScalar(into.r * 0.299 + into.g * 0.587 + into.b * 0.114), air.w * (1 - dk.x));
			if (renderer.toneMapping === THREE.AgXToneMapping) agx(into, renderer.toneMappingExposure, tmpE); else tmpE.copy(into);
			AIR.sunCol.x = tmpE.r; AIR.sunCol.y = tmpE.g; AIR.sunCol.z = tmpE.b;
			AIR.sun.x = sd.x; AIR.sun.y = sd.y; AIR.sun.z = sd.z;
			AIR.sun.w = vacuum ? 0 : Math.max((1 - night) * (0.3 + 0.7 * sunVis), dawnC * 0.75 * (1 - night * 0.3));
			uniforms.uFogSunK.value = AIR.sun.w;
			if (shared.uSkySunK) shared.uSkySunK.value = AIR.sun.w;
		}
		// (the water's reflections: shared.cloudReflect false keeps them to the plain sky)
		shared.uCloudR.value.set(uniforms.uCloudOff.value.x, uniforms.uCloudOff.value.y, uniforms.uCloud.value, shared.cloudReflect === false ? 0 : 1);
		shared.uCloudR2.value.set(night, shared.uTime.value, uniforms.uGloom.value, uniforms.uCirrus.value);
		shared.uCloudR3.value.set(uniforms.uCirrusOff.value.x, uniforms.uCirrusOff.value.y, uniforms.uWindDir?.value?.x ?? 1, uniforms.uWindDir?.value?.y ?? 0);
		// (the veil in the water: not on phones, where every pixel of sea would pay for it)
		shared.uCloudR4.value.set(uniforms.uVeil.value.x, uniforms.uVeil.value.y, isPhone ? 0 : uniforms.uHighCl.value.y, uniforms.uHighCl.value.z);
		dome.position.copy(focus);
		sats.position.copy(focus);
		sats.userData.step(dt, elev);
		return { night, dayK, setK };
	}
	// (the clouds in the water on or off, as the quality setting does)
	const reflect = (on) => { shared.cloudReflect = on; };
	// a place on the celestial sphere (right ascension, hours; declination, degrees) as a direction
	// in the world tonight; is it dark enough to see the stars (the sun an hour and more down);
	// the constellations' lines on or off
	const celestial = (ra, de, out = new THREE.Vector3()) => { const a = ra / 12 * Math.PI, d = de * Math.PI / 180; return out.set(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)).applyMatrix4(eqM).normalize(); };
	const dark = () => solarDirection(SUN.lat, SUN.dec, state.hours, SUN.noon).y < Math.sin(-12 * Math.PI / 180);
	const lines = (on) => { if (on !== undefined) uCon.value = on ? 1 : 0; return uCon.value > 0; };
	// which way the cities' glow lies (main.js: the urban land round you, weighted by where it is)
	const glowToward = (gx, gz, dt) => {
		const l = Math.hypot(gx, gz), G = uniforms.uGlowDir.value, k = Math.min(1, dt);
		const tot = Math.max(1e-3, shared.uSkyGlow.value * 4 * 15000);
		G.x += ((l > 1 ? gx / l : 0) - G.x) * k; G.z += ((l > 1 ? gz / l : 1) - G.z) * k;
		G.y += (Math.min(1, l / tot) - G.y) * k;
	};
	// the Moon now: where (a direction) and its phase
	const moon = () => ({ dir: moonDir.toArray().map((v) => +v.toFixed(3)), lit: +MOON.lit.toFixed(3), waxing: MOON.waxing, age: +MOON.age.toFixed(1), alt: +(Math.asin(moonDir.y) * 180 / Math.PI).toFixed(1) });
	return { dome, sun, hemi, state, update, uniforms, attach, reflect, celestial, dark, lines, glowToward, moon };
}
