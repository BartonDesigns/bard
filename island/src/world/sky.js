// Sky, sun, moon, clouds, haze and the light rig, all driven by one clock.
// Daylight lasts much longer than night: most visits happen in the sun.

import * as THREE from 'three';
import { NOISE_GLSL } from './terrain.js';
import { STARS_B64, STAR_COUNT } from './starcat.js';
import { today } from '../calendar.js';
import { constellations } from './constellations.js';
import { BAY_LATITUDE, solarLatitude, solarDate, solarTimes, solarDirection, advanceSolarClock } from './solar.js';

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

// the cloud field, shared by the dome and the stars it hides: fair-weather cumulus on a
// plane about 1.5 km up that drifts with the wind (uCloudOff, summed by weather.js) and
// slowly changes shape, heaped up dark over the showers
const CLOUD_GLSL = /* glsl */`
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
`;

// the clouds as water shows them: the cumulus above (same field, same drift, same cover),
// cheaper (three octaves, no showers), over the sky's own gradient and in the world's air.
// Its own copy of the noise, so it drops into any shader. uCloudR: the cloud plane's
// offset, cover, on (0: the plain sky); uCloudR2: night, time, gloom, cirrus; uCloudR3: the
// cirrus' offset, the wind
export const CLOUD_REFLECT_GLSL = /* glsl */`
uniform vec4 uCloudR, uCloudR2, uCloudR3, uAirR;
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
		sky = mix(sky, cloud, dens * 0.9);
	}
	return mix(sky, dot(sky, vec3(0.299, 0.587, 0.114)) * uAirR.rgb, uAirR.a);
}`;
// its uniforms, shared through `shared` (sky.update keeps them current)
export function cloudReflectU(shared) {
	shared.uCloudR ||= { value: new THREE.Vector4(0, 0, 0.62, 1) };
	shared.uCloudR2 ||= { value: new THREE.Vector4() };
	shared.uCloudR3 ||= { value: new THREE.Vector4(0, 0, 1, 0) };
	shared.uAirR ||= { value: airOf(shared.planet) };
	return { uCloudR: shared.uCloudR, uCloudR2: shared.uCloudR2, uCloudR3: shared.uCloudR3, uAirR: shared.uAirR };
}

// three.js's AgX tone mapping (tonemapping_pars_fragment) on the CPU, for one colour:
// linear in, linear out. (The matrices are GLSL's, column by column.)
const AGX_M = [
	[0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956],
	[0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591, 0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859],
	[1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272, -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
	[1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187],
];
const mat3x = (m, v) => [0, 1, 2].map((r) => m[r] * v[0] + m[3 + r] * v[1] + m[6 + r] * v[2]);
function agx(c, exposure, out) {
	let v = mat3x(AGX_M[1], mat3x(AGX_M[0], [c.r * exposure, c.g * exposure, c.b * exposure]));
	v = v.map((x) => {
		x = Math.min(1, Math.max(0, (Math.log2(Math.max(x, 1e-10)) + 12.47393) / (4.026069 + 12.47393)));
		const x2 = x * x, x4 = x2 * x2;
		return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
	});
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
export function createSky(scene, shared, renderer, { isPhone = false, latitude = () => BAY_LATITUDE } = {}) {
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
		uShowers: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) }, uRainHere: { value: 0 }, uGloom: { value: 0 },
		uFlash: { value: 0 }, uBolt: { value: new THREE.Vector4(0, 0, 0, 99) },
		uFogCol: { value: new THREE.Color() },
		// another world's air: its sky and haze take this colour (rgb), this much (a)
		uAir: cloudReflectU(shared).uAirR,
		// a gas giant over its moon (xyz: where, w: its size); a ringed world's rings (on/off)
		uGiant: { value: new THREE.Vector4(0.42, 0.33, -0.84, shared.planet?.sky?.giant ? 0.2 : 0) }, uRings: { value: shared.planet?.sky?.rings ? 1 : 0 },
		uMeteor: { value: 0 },           // 1 on the nights of the great showers
		uBow: { value: null }, uBowK: { value: 0 }, uBowDrop: { value: 0.5 }, uMoonBowK: { value: 0 }, uBowScale: { value: 1.614 },
	};
	const dome = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), new THREE.ShaderMaterial({
		uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
		vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
		fragmentShader: /* glsl */`
			uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor; uniform float uTime, uNight, uCloud, uHigh, uGlow; uniform mat3 uW2E, uE2G;
			uniform vec2 uCirrusOff, uWindDir; uniform vec3 uFogCol; uniform vec4 uAir, uGiant; uniform float uRings; uniform float uMeteor, uCirrus, uRainHere, uGloom, uFlash, uBowK, uBowDrop, uMoonBowK, uBowScale; uniform vec4 uBolt; uniform sampler2D uBow;
			varying vec3 vDir;
			${NOISE_GLSL}
			${CLOUD_GLSL}
			// the rainbow table (rainbow.js): angle from the antisolar point, 25 to 60 degrees
			vec3 bowAt(float ang){
				vec3 b = texture2D(uBow, vec2(clamp((ang - 25.0) / 35.0, 0.0, 1.0), uBowDrop)).rgb;
				return b * b * uBowScale * smoothstep(64.0, 60.0, ang) * smoothstep(8.0, 25.0, ang);
			}
			void main(){
				vec3 d = normalize(vDir);
				float h = max(d.y, 0.0);
				vec3 col = mix(uSkyHor, uSkyZen, pow(h, 0.5));
				float sd = max(dot(d, uSunDir), 0.0);
				col += uSunColor * (pow(sd, 12.0) * 0.18 + pow(sd, 3.0) * 0.06) * (1.0 - uNight);
				col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 18.0 * (1.0 - uNight);
				// a low sun: the air toward it fills with warm, bright haze (forward scattering),
				// strongest along the horizon under it, and the eye sees a starburst round it
				float lowK = (1.0 - smoothstep(0.04, 0.4, uSunDir.y)) * step(-0.02, uSunDir.y) * (1.0 - uNight);
				vec2 sh2d = normalize(uSunDir.xz + 1e-5), dh2d = normalize(d.xz + 1e-5);
				float toward = pow(max(dot(sh2d, dh2d), 0.0), 5.0);
				// (golden hour is yellow-gold toward the sun under a sky still blue overhead)
				vec3 gold = mix(uSunColor, vec3(1.0, 0.8, 0.42), 0.6);
				col += gold * (pow(sd, 6.0) * 0.8 + pow(sd, 40.0) * 0.8 + toward * (1.0 - smoothstep(0.0, 0.3, d.y)) * 0.9) * lowK * (1.0 - uCloud * 0.35);
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
				if (uGiant.w > 0.0 && d.y > -0.05){
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
				if (uNight > 0.01 && d.y > 0.0){
					// the moon, opposite the sun
					float md = max(dot(d, -uSunDir), 0.0);
					col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9994, 0.9997, md) * 2.5 + pow(md, 60.0) * 0.08) * uNight;
				}
				// cirrus: thin, fibrous, far above, combed out along the wind; it catches the
				// colour of a low sun and keeps it after sunset
				if (d.y > 0.0 && uCirrus > 0.01){
					vec2 cc = d.xz / (d.y + 0.03) * 0.55 + uCirrusOff;
					vec2 wd = normalize(uWindDir + vec2(1e-4));
					vec2 q = vec2(dot(cc, wd) * 0.16, dot(cc, vec2(-wd.y, wd.x)));
					float f = fbm5(q * 3.0) * 0.7 + fbm5(q * vec2(2.0, 11.0) + 3.0) * 0.35;
					float ci = smoothstep(0.55, 0.85, f) * uCirrus * smoothstep(0.0, 0.18, d.y) * (1.0 - uGloom * 0.7);
					vec3 cirCol = mix(vec3(1.02), uSunColor * 1.35, 0.35 + 0.4 * (1.0 - smoothstep(0.1, 0.5, uSunDir.y))) * (1.0 - uNight * 0.93);
					col = mix(col, cirCol + uSkyHor * 0.15, ci * 0.55);
				}
				// cumulus on a plane above you, lit from the sun's side; dark and heaped over showers
				float base, sh;
				float dens = cumulus(d, uCloud, uTime, base, sh);
				if (dens > 0.0){
					// lit from the sun's side: denser toward the sun means this side is in shade
					float toward, sh2;
					cumulus(normalize(d + vec3(uSunDir.x, 0.0, uSunDir.z) * 0.035), uCloud, uTime, toward, sh2);
					float lit = clamp(0.62 + (base - toward) * 4.0, 0.0, 1.2);
					float cover = mix(0.8, 0.3, uCloud);
					// bright sunlit tops, cool grey-blue bases: a cloud with volume, not a smear
					vec3 shade = mix(vec3(0.46, 0.52, 0.64), vec3(1.08), smoothstep(0.1, 1.0, lit)) * (0.85 + 0.25 * smoothstep(cover, cover + 0.35, base));
					// rain clouds: slate grey and heavy, darker and lighter masses through the deck
					float heavy = mix(0.38, 0.14, smoothstep(0.5, 1.1, base - sh * 0.4));
					shade *= mix(1.0, heavy, clamp(sh * 1.4, 0.0, 1.0)) * (1.0 - uGloom * 0.45);
					// at night the clouds are dark shapes against the stars, rimmed faintly by moonlight
					vec3 cloud = shade * mix(vec3(1.0), uSunColor * 0.9, 0.35) * (1.0 - uNight * 0.975) + uSkyHor * 0.12;
					cloud += uSunColor * pow(sd, 6.0) * 0.5 * (1.0 - uNight) * (1.0 - sh);
					// lightning lights the cloud from inside
					cloud += vec3(0.75, 0.8, 1.0) * uFlash * (0.5 + sh * 1.5);
					col = mix(col, cloud, dens * 0.95);
				}
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
						float shafts = 0.35 + 0.65 * vn(vec2(azS * 55.0 + S.x * 0.001, 3.0)) * (0.65 + 0.35 * vn(vec2(azS * 190.0, 7.0)));
						float side = 1.0 - smoothstep(0.7, 1.0, pd / sr);
						float ragged = top * (0.85 + 0.25 * vn(vec2(azS * 90.0, 11.0)));
						// down to the ground, its foot frayed where the last drops dry out
						float fall = smoothstep(ragged * 1.08, ragged * 0.7, tanE) * smoothstep(-0.02, 0.012 * (0.6 + 0.8 * vn(vec2(azS * 120.0, 5.0))), tanE);
						// fine streaks, long and upright, drifting slowly down
						float streak = 0.72 + 0.28 * vn(vec2(azS * 1400.0, tanE * 6.0 + uTime * 0.6)) * vn(vec2(azS * 520.0, tanE * 2.0 - uTime * 0.25));
						float dens = thick * fall * side * (0.6 + 0.4 * mix(shafts, 1.0, core * 0.6)) * (0.7 + 0.3 * core);
						float veil = dens * streak * smoothstep(42000.0, 7000.0, tin);
						// blue-grey, the sky behind showing through where it is thin; low down it melts
						// into the haze the far land stands in
						vec3 veilC = mix(vec3(0.18, 0.2, 0.25), uSkyHor * 0.7, 0.18 * (1.0 - core)) * (1.0 - uNight * 0.95) * (0.85 + 0.3 * streak);
						veilC = mix(veilC, uFogCol, (1.0 - smoothstep(0.0, 0.05, tanE)) * 0.55);
						col = mix(col, veilC + vec3(0.6, 0.65, 0.75) * uFlash, clamp(veil * 2.1, 0.0, 0.9));
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
				col = mix(col, mix(uSkyHor, vec3(0.5, 0.53, 0.57), 0.5) * (1.0 - uNight * 0.9), uRainHere * 0.45 * smoothstep(-0.1, 0.4, d.y));
				// in weather the sky meets the land in the same haze the land is fogged with, so
				// there is no line where the one ends and the other begins
				col = mix(col, uFogCol, (1.0 - smoothstep(0.0, 0.14, d.y)) * clamp(uGloom * 1.5 + uRainHere, 0.0, 1.0) * 0.85);
				// below the horizon (seen past the land's far edge from high up) the sky is the same
				// haze the land fades into, so no bright line runs along where the land ends
				col = mix(col, mix(uSkyHor, uFogCol, 0.7), smoothstep(0.02, -0.12, d.y));
				col = mix(col, uFogCol, smoothstep(0.012, -0.03, d.y) * 0.9);
				col = mix(col, dot(col, vec3(0.299, 0.587, 0.114)) * uAir.rgb, uAir.a);
				gl_FragColor = vec4(col, 1.0);
				#include <tonemapping_fragment>
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
			uniforms: { uNight: uniforms.uNight, uTime: shared.uTime, uPx: { value: renderer.getPixelRatio() }, uGlow: uniforms.uGlow, uCloud: uniforms.uCloud, uCloudOff: uniforms.uCloudOff, uShowers: uniforms.uShowers },
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
	scene.add(sun, sun.target);
	const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.9);
	scene.add(hemi);
	scene.fog = new THREE.FogExp2(0xa9c4dc, 0.00026);

	const state = { hours: shared.startHours ?? 10.5, speed: 1, real: false };
	const tmpA = new THREE.Color(), tmpB = new THREE.Color(), tmpC = new THREE.Color();
	// the weather drives the clouds, rain, bows and lightning in the sky (weather.js)
	let weather = null;
	function attach(w) {
		weather = w;
		// (the dome and the stars read the weather's own uniforms, by name)
		for (const k of ['uCloudOff', 'uCirrusOff', 'uCirrus', 'uShowers', 'uRainHere', 'uGloom', 'uFlash', 'uBolt', 'uBow', 'uBowK', 'uBowDrop', 'uMoonBowK']) uniforms[k] = w.uniforms[k];
		stars.material.uniforms.uCloudOff = w.uniforms.uCloudOff; stars.material.uniforms.uShowers = w.uniforms.uShowers;
	}

	let SUN = solarDate(today());
	Object.assign(SUN, solarTimes(latitude(), SUN.dec, SUN.noon));
	state.sun = SUN;
	function update(dt, focus) {
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
		if (gl > 0) {
			const lz = (tmpA.r + tmpA.g + tmpA.b) / 3, lh = (tmpB.r + tmpB.g + tmpB.b) / 3;
			tmpA.lerp(tmpC.setRGB(lz * 0.95, lz, lz * 1.05).multiplyScalar(0.8 + 0.4 * (1 - night)), gl * 0.75);
			tmpB.lerp(tmpC.setRGB(lh * 0.97, lh, lh * 1.02).multiplyScalar(0.85), gl * 0.65);
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
		sun.shadow.intensity = 0.78 * (0.12 + 0.88 * sunVis);
		if (night < 0.5) {
			sun.color.copy(sunCol);
			sun.intensity = (3.4 * dayK + 0.4 * setK) * (0.25 + 0.75 * sunVis);
			sun.position.copy(sd).multiplyScalar(SUN_D).add(focus);
		} else {
			sun.color.copy(PAL.moon);
			sun.intensity = 0.5 * night;
			sun.position.copy(sd).multiplyScalar(-SUN_D).add(focus);
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
		hemi.intensity = (0.25 + 0.9 * dayK) * (1 - gl * 0.3) * (1 + overcast * 0.35 * dayK) + (W?.flash || 0) * 2.5;
		shared.uAmbient.value.copy(hemi.color).multiplyScalar(0.35 * hemi.intensity + 0.02);
		// haze: blue by day so far land stacks up in layers
		const haze = uniforms.uFogCol.value.copy(tmpB).lerp(tmpA, 0.12);
		if (W) haze.lerp(tmpC.setRGB(0.5, 0.53, 0.57).multiplyScalar(1 - night * 0.9), Math.min(1, W.rainHere * 0.6 + gl * 0.3));
		const air = uniforms.uAir.value;
		if (air.w > 0) haze.lerp(tmpC.setRGB(air.x, air.y, air.z).multiplyScalar(haze.r * 0.299 + haze.g * 0.587 + haze.b * 0.114), air.w);
		renderer.toneMappingExposure = 1.15 + night * 0.15;
		// The sky is tone mapped, but three.js mixes the fog in after the tone mapping, so a
		// fully fogged hill came out the raw haze colour: a pale cyan much brighter than the
		// sky's own horizon just above it, which drew a bright band where the far land and
		// sea meet the sky. The fog gets the haze as the sky shows it instead.
		if (renderer.toneMapping === THREE.AgXToneMapping) agx(haze, renderer.toneMappingExposure, scene.fog.color);
		else scene.fog.color.copy(haze);
		// (the water's reflections: shared.cloudReflect false keeps them to the plain sky)
		shared.uCloudR.value.set(uniforms.uCloudOff.value.x, uniforms.uCloudOff.value.y, uniforms.uCloud.value, shared.cloudReflect === false ? 0 : 1);
		shared.uCloudR2.value.set(night, shared.uTime.value, uniforms.uGloom.value, uniforms.uCirrus.value);
		shared.uCloudR3.value.set(uniforms.uCirrusOff.value.x, uniforms.uCirrusOff.value.y, uniforms.uWindDir?.value?.x ?? 1, uniforms.uWindDir?.value?.y ?? 0);
		dome.position.copy(focus);
		sats.position.copy(focus);
		sats.userData.step(dt, elev);
		orientSky();
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
	return { dome, sun, hemi, state, update, uniforms, attach, reflect, celestial, dark, lines };
}
