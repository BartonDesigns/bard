// The sea: rolling waves that come in toward the shore from every side, plus
// wind chop. Waves steepen and break white where the water shallows; colour
// comes from the real depth over sand and reef, so shallows go turquoise over
// lit sand with caustics and the deep goes navy. Sky and sun reflect.
//
// Where it meets the land there is no line. Up close every pixel reads the ground under it
// (the sea's own vertices are metres apart), so the water's depth is known exactly where the
// surface meets the sand or the rock; the water's own colour fades with that depth to nothing
// and the ground shows through (the sand under a hand's depth of water is the sand), only the
// sky's sheen and the foam left on it. On the island's beaches each wave runs up the sand as a
// thin sheet with a frothing, broken front, stalls and drains back (world/shore.js, the same
// sums as the wet sand under it), leaving a line of lace that breaks up and pops; on gentle
// open beaches the swell breaks offshore into white water, on steep or sheltered shores it
// does not, and against rock it bursts white. Posts, hulls and anyone wading ring the water
// with ripples and foam; rain pocks it. By night the lamps along the shore lie in it as
// streaks (world/nightfield.js) and the moon's path glitters.

import * as THREE from 'three';
import { radialGrid, HEIGHT_GLSL, NOISE_GLSL } from './terrain.js';
import { SWASH_GLSL, shoreQuality } from './shore.js';
import { CLOUD_REFLECT_GLSL, cloudReflectU } from './sky.js';
import { BAY_GLSL } from '../bay/terrain.js';
import { GLOBE_U, GLOBE_SEA_GLSL } from '../earth/globeheight.js';
import { NF, NF_N } from './nightfield.js';
import { qualityNow } from './governor.js';
import { SEA_DEPTH_GLSL } from './seadepth.js';
import { GFX_PHONE } from './device.js';
import { ICE_U, ICE_GLSL } from '../region/ice.js';
import { wedgeMeshes } from './gridwedges.js';

const PHONE = GFX_PHONE;
// how many things standing in the water ring it at once (posts, hulls, you)
const TOUCH_N = PHONE ? 4 : 8;
// (the pack ice is Earth's alone: elsewhere the sea has none)
const ICE_NONE = /* glsl */`
const float uIceOn = 0.0, uIceMonth = 0.0;
float iceCoverG(float lat, float lon, float month){ return 0.0; }
vec2 iceLL(vec2 p){ return vec2(0.0); }
vec3 packIce(vec2 p, float aa){ return vec3(0.0); }
float packMean(float cov){ return 0.0; }
vec4 iceField(vec2 p, float hp, float cov){ return vec4(0.0); }`;

// a planet's water colour, normalised to keep the sea's brightness (its streams and lakes too: bay/water.js)
export function waterOf(P) {
	const t = P?.water?.tint;
	if (!t || !P.water.mix) return new THREE.Vector4(1, 1, 1, 0);
	const l = t[0] * 0.299 + t[1] * 0.587 + t[2] * 0.114;
	return new THREE.Vector4(t[0] / l, t[1] / l, t[2] / l, P.water.mix);
}
// what the sea is made of, for its foam: 0 water, 1 a toxic world's scummy sea
export const liquidOf = (P) => (P?.type === 'TOXIC' ? 1 : 0);

export function createOcean(island, shared) {
	// out to the Bay Area's horizons: dense underfoot, sparse tens of kilometres out
	const geo = radialGrid(300, 70000, 3.3);
	const bay = island.village?.bay;
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
		uHeight: { value: shared.heightTex }, uMasks: { value: shared.maskTex },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCenter: { value: new THREE.Vector2() },
		uWave: { value: 1 },
		uWaterT: { value: waterOf(shared.planet) },
		uLiquid: { value: liquidOf(shared.planet) },
		// the island's drowned crater, sheltered from the swell: x, z, radius, 1 if there is one
		uBayIs: { value: bay ? new THREE.Vector4(bay.x, bay.z, bay.r, 1) : new THREE.Vector4() },
		// how far out each pixel reads the ground under it, and how much fine detail the foam carries
		uShoreQ: { value: new THREE.Vector2(520, 1) },
		uRain: { value: 0 },
	}]);
	// (live objects, not copies)
	uniforms.uTouch = { value: [...Array(TOUCH_N)].map(() => new THREE.Vector4()) };
	// where streams run out into the sea near you: x, z, and the way it flows times its width
	uniforms.uMouth = { value: [...Array(4)].map(() => new THREE.Vector4()) };
	Object.assign(uniforms, NF);
	// the real Bay Area's depths beyond the island (live objects, filled as they load)
	if (shared.bayU) Object.assign(uniforms, shared.bayU, GLOBE_U, ICE_U);          // (and the globe's coasts past the survey: earth/globeheight.js)
	uniforms.uUnder = shared.uUnder;
	// the land, the village and the boats mirrored in the water, when drawn (world/seamirror.js)
	Object.assign(uniforms, shared.mirrorU || { uRefl: { value: null }, uReflM: { value: new THREE.Matrix4() }, uReflOn: { value: 0 } });
	// the posts, hulls, rocks and coral standing in it, by their depth, when drawn (world/seadepth.js)
	Object.assign(uniforms, shared.seaDepthU || { uSeaDepth: { value: null }, uSeaDepthNF: { value: new THREE.Vector2(0.25, 16000) }, uSeaDepthPx: { value: new THREE.Vector2(1, 1) }, uSeaDepthOn: { value: 0 } });
	uniforms.uWave = shared.uWave || uniforms.uWave;
	// shared, live objects (not copies)
	Object.assign(uniforms, {
		uTime: shared.uTime, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor,
		uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor, uAmbient: shared.uAmbient,
		uMid: shared.uMid, uHigh: shared.uHigh, ...cloudReflectU(shared),
	});
	uniforms.uHeight.value = shared.heightTex;
	uniforms.uMasks.value = shared.maskTex;

	// The sea's shape is a spectrum of waves spread round the wind: long swell, then shorter
	// and shorter wind waves, each about as steep as the last. The mesh carries only the
	// waves long enough for its vertices to follow (its spacing grows with distance); every
	// pixel then shades the whole spectrum, each wave faded out where it would be finer than
	// the pixel. So nothing aliases: no smearing, no crawling as you move, no stretched or
	// pinched patches, and no visible tiling (the wavelengths share no common repeat).
	const WAVES = /* glsl */`
	uniform float uTime, uWave; uniform vec2 uCenter;
	const int NW = 14;
	// angle from the wind (rad), wavelength (m), height ratio, steepness
	const vec4 SPEC[NW] = vec4[NW](
		vec4(-0.18, 38.0, 1.0, 0.35), vec4(0.42, 26.0, 0.95, 0.4), vec4(-0.63, 18.5, 0.9, 0.45),
		vec4(0.21, 13.1, 0.85, 0.5), vec4(0.95, 9.7, 0.8, 0.5), vec4(-0.4, 7.3, 0.75, 0.55),
		vec4(0.62, 5.4, 0.7, 0.55), vec4(-0.9, 4.1, 0.66, 0.55), vec4(0.08, 3.05, 0.62, 0.6),
		vec4(1.2, 2.3, 0.58, 0.6), vec4(-0.55, 1.7, 0.54, 0.6), vec4(0.35, 1.25, 0.5, 0.6),
		vec4(-1.15, 0.92, 0.46, 0.6), vec4(0.8, 0.66, 0.42, 0.6));
	const float WIND = 0.61;
	// the crests bend and break: every wave is read at a slowly wandering position
	float wh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float wn1(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh1(i), wh1(i + vec2(1, 0)), f.x), mix(wh1(i + vec2(0, 1)), wh1(i + vec2(1, 1)), f.x), f.y); }
	vec2 bend(vec2 p){ vec2 q = p * 0.018 + uTime * 0.01; return p + (vec2(wn1(q), wn1(q + 17.3)) - 0.5) * 7.0 + (vec2(wn1(q * 3.1 + 5.0), wn1(q * 3.1 - 9.0)) - 0.5) * 1.6; }
	vec2 wdir(int i){ float a = WIND + SPEC[i].x; return vec2(cos(a), sin(a)); }
	float wamp(int i){ return SPEC[i].y * 0.0115 * SPEC[i].z; }
	// wave groups: each train swells and fades in patches a few wavelengths across
	float group(int i, vec2 p){ float L = SPEC[i].y; return 0.5 + 1.0 * wn1(p / (L * 5.0) + vec2(float(i) * 13.1, float(i) * 7.7) + uTime * 0.02); }
	// one Gerstner train: direction d, wavelength L, amplitude A, steepness Q
	void train(vec2 p, vec2 d, float L, float A, float Q, float speed, inout vec3 disp, inout vec3 dx, inout vec3 dz){
		float k = 6.28318 / L, c = sqrt(9.8 / k) * speed, f = k * (dot(d, p) - c * uTime);
		float s = sin(f), co = cos(f), wa = k * A;
		disp += vec3(Q * A * d.x * co, A * s, Q * A * d.y * co);
		dx += vec3(-Q * d.x * d.x * wa * s, d.x * wa * co, -Q * d.x * d.y * wa * s);
		dz += vec3(-Q * d.x * d.y * wa * s, d.y * wa * co, -Q * d.y * d.y * wa * s);
	}
	// how much of a wave of length L survives a sampling step h (vertex spacing or pixel size)
	float keep(float L, float h){ return 1.0 - smoothstep(L * 0.035, L * 0.09, h); }
	// the slope of the spectrum at p, each wave filtered for the step h, scaled by a; z how
	// much the waves crowd the water together there (the Gerstner trains' pinch, the trace of
	// their sideways stretch): where it runs high the crests are folding over and break white
	vec3 slopes(vec2 p, float h, float a){
		vec2 g = vec2(0.0), pb = bend(p); float pinch = 0.0;
		for (int i = 0; i < NW; i++) {
			float L = SPEC[i].y, w = keep(L, h);
			if (w <= 0.0) continue;
			vec2 d = wdir(i); float k = 6.28318 / L;
			float f = k * (dot(d, pb) - sqrt(9.8 / k) * uTime);
			float kA = k * wamp(i) * group(i, p) * w;
			g += d * (kA * cos(f));
			pinch += SPEC[i].w * kA * sin(f);
		}
		return vec3(g, pinch) * a;
	}`;
	// the island's own sea floor eased into the real one across a wide, wavy band (switching at
	// the island map's edge drew a square in the water's colour), out where the island's floor
	// is already deep: its beaches and shallows are its own (the survey has open sea some 13 m
	// down under the island, and eased in across the beaches it made them read 5 to 8 m deep:
	// the shallows all one turquoise to the waterline, the full swell breaking on the sand);
	// seaGround: the vertices' (the survey, then the globe past it), bayHeight the pixels' (the
	// globe's coasts are read at the vertices: its sums are long, and its relief coarse)
	const GROUND = (sea) => /* glsl */`
	float groundAt(vec2 p){
		float e = max(abs(p.x), abs(p.y)) + (sin(p.x * 0.0021 + 1.3) * sin(p.y * 0.0017 + 0.4) + sin((p.x + p.y) * 0.0009)) * 180.0;
		float k = smoothstep(uHalf - 1400.0, uHalf - 60.0, e);
		if (k <= 0.0) return heightAt(p);
		float hi = heightAt(p), edge = max(abs(p.x), abs(p.y));
		k *= max(smoothstep(-3.0, -9.0, hi), smoothstep(uHalf - 120.0, uHalf - 20.0, edge));
		if (k <= 0.0) return hi;
		float b = ${sea}(p);
		return k >= 1.0 || edge >= uHalf - 20.0 ? b : mix(hi, b, k);
	}`;
	const VARY = /* glsl */`
	varying vec3 vW; varying float vCrest; varying float vRoll; varying vec2 vInward; varying vec2 vAmp; varying vec2 vP0;
	// the open sea's level here (before the beach's sheet), the bed under the vertex, how much the
	// waves break here, the bed's slope, and where the swash runs (1 on the island's beaches), at
	// what reach and pace (world/shore.js swashBay)
	varying float vWave; varying float vGround; varying float vBreak; varying float vSlope; varying float vShore; varying vec2 vSwK;`;

	const mat = new THREE.ShaderMaterial({
		uniforms, fog: true, transparent: true, side: THREE.DoubleSide,
		defines: { NF_N, TOUCH_N },
		vertexShader: /* glsl */`
			${HEIGHT_GLSL}
			${BAY_GLSL}
			${shared.bayU ? GLOBE_SEA_GLSL : 'float seaGround(vec2 p){ return bayHeight(p); }'}
			${GROUND('seaGround')}
			${WAVES}
			${NOISE_GLSL}
			${SWASH_GLSL}
			${shared.bayU ? ICE_GLSL : ICE_NONE}
			uniform vec4 uBayIs;
			${VARY}
			#include <fog_pars_vertex>
			void main(){
				vec2 p = position.xz + uCenter;
				float ground = groundAt(p);
				float depth = max(0.0, -ground);
				float open = smoothstep(0.4, 7.0, depth);
				vec3 disp = vec3(0.0), dx = vec3(1.0, 0.0, 0.0), dz = vec3(0.0, 0.0, 1.0);
				// open-water swell from two directions; near the island it turns into
				// rollers that run in toward the beach (so no rings show offshore)
				float r = length(p) + 1e-3; vec2 inward = -p / r;
				// off the island the rollers turn toward the nearest real shore (uphill)
				if (r > 3000.0 && uBayOn > 0.5){
					vec2 gr = vec2(groundAt(p + vec2(90.0, 0.0)) - groundAt(p - vec2(90.0, 0.0)), groundAt(p + vec2(0.0, 90.0)) - groundAt(p - vec2(0.0, 90.0)));
					if (length(gr) > 0.05) inward = normalize(mix(inward, normalize(gr), smoothstep(3000.0, 6000.0, r)));
				}
				float nearShore = 1.0 - smoothstep(4.0, 16.0, depth);
				// the mesh's own vertex spacing here (see radialGrid): the waves it can carry
				float m = max(abs(position.x), abs(position.z)) + 0.5;
				float hv = 3.3 * 70000.0 * pow(m / 70000.0, 2.3 / 3.3) * 2.0 / 300.0;
				// the bed's slope over a few metres near the shore: where the waves break
				float sl = 0.0;
				if (ground > -9.0 && hv < 40.0) {
					float e = max(2.5, hv * 0.5);
					sl = length(vec2(groundAt(p + vec2(e, 0.0)) - groundAt(p - vec2(e, 0.0)), groundAt(p + vec2(0.0, e)) - groundAt(p - vec2(0.0, e)))) / (2.0 * e);
				}
				// sheltered from the swell: inside the island's drowned crater, inside the Golden Gate
				float shelter = max(uBayIs.w * (1.0 - smoothstep(0.45, 0.62, length(p - uBayIs.xy) / max(uBayIs.z, 1.0))), smoothstep(9000.0, 12500.0, p.x) * step(3000.0, r));
				float brk = breakOn(sl, shelter);
				// (under the pack ice the swell is damped to a slow heave: region/ice.js)
				vec2 llI = uIceOn > 0.5 ? iceLL(p) : vec2(0.0);
				float calmIce = uIceOn > 0.5 ? 1.0 - 0.65 * iceCoverG(llI.x, llI.y, uIceMonth) : 1.0;
				float swellA = uWave * open * calmIce;
				vec2 pb = bend(p);
				for (int i = 0; i < NW; i++) {
					float kv = keep(SPEC[i].y, hv);
					if (kv > 0.0) train(pb, wdir(i), SPEC[i].y, wamp(i) * swellA * kv * group(i, p), SPEC[i].w, 1.0, disp, dx, dz);
				}
				float amp = uWave * mix(0.16, 0.5, open) * nearShore * mix(1.0, 0.45, shelter) * calmIce;
				// over a gentle beach the roller shoals, steepens, and its crest pitches forward as it breaks
				float zone = brk * smoothstep(0.3, 0.8, depth) * (1.0 - smoothstep(1.5, 3.2, depth));
				float k16 = 6.28318 / 16.0, fR = k16 * (dot(inward, p) - sqrt(9.8 / k16) * uTime);
				train(p, inward, 16.0, amp * keep(16.0, hv) * (1.0 + 0.35 * zone), mix(1.1, 0.6, open), 1.0, disp, dx, dz);
				float crest = pow(max(0.0, sin(fR)), 3.0) * keep(16.0, hv);
				disp.xz += inward * amp * 1.3 * zone * crest * smoothstep(-0.6, 0.6, -cos(fR));
				disp.y += amp * 0.3 * zone * crest;
				vInward = inward; vAmp = vec2(swellA, amp); vP0 = p;
				vec3 w = vec3(p.x, 0.0, p.y) + disp;
				vWave = w.y;
				// on the beach the sea is the swash: a sheet that thins to nothing as it runs up
				// (the island's beaches; and the Bay Area's sand beaches near you, at the bay's own
				// reach and pace, but not its broad flat shelves of mud, where its fronts would sweep
				// hundreds of metres of shallows in rings: world/shore.js)
				float shore = r < 3000.0 && max(abs(p.x), abs(p.y)) < uHalf - 30.0 ? 1.0 : 0.0;
				vec2 swK = vec2(1.0);
				if (shore < 0.5 && uBayOn > 0.5) { shore = swashBayOn(sl, length(p - cameraPosition.xz)); swK = swashBay(p); }
				float swl = swashStateK(p, uTime, uWave, swK).x;
				if (ground > -0.5 && shore > 0.0) w.y = mix(w.y, max(min(w.y, swl), min(swl, ground + max(0.0, swl - ground) * 0.35 + 0.012)), smoothstep(-0.5, -0.1, ground) * shore);
				// near by, over the beach up to the top of the run, the surface is laid just clear of
				// the sand (its highest point round the vertex), so the sheet and the foam (worked out
				// for every pixel) always have a surface to be drawn on; the pixels drop the rest
				if (shore > 0.0 && (r > 3000.0 ? hv < 24.0 && sl < 0.22 : hv < 12.0 && sl < 0.15) && ground > -0.9 && ground < swashRunMax(p, uWave) * swK.x + 0.35) {
					float e = max(0.5, hv * 0.55);
					float gm = max(max(max(groundAt(p + vec2(e, 0.0)), groundAt(p - vec2(e, 0.0))), max(groundAt(p + vec2(0.0, e)), groundAt(p - vec2(0.0, e)))), ground);
					w.y = max(w.y, gm + 0.04);
				}
				vW = w; vGround = ground; vSlope = sl; vBreak = brk; vShore = shore; vSwK = swK;
				vCrest = disp.y / max(0.05, amp + swellA * 0.45 + 0.15);
				vRoll = fR;
				vec4 mvPosition = viewMatrix * vec4(w, 1.0);
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: /* glsl */`
			uniform sampler2D uMasks; uniform float uMid, uHigh, uLiquid, uRain; uniform vec4 uWaterT; uniform vec2 uShoreQ;
			uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor, uAmbient; uniform float uUnder;
			uniform vec4 uTouch[TOUCH_N]; uniform vec4 uMouth[4];
			uniform sampler2D uRefl; uniform mat4 uReflM; uniform float uReflOn;
			${SEA_DEPTH_GLSL}
			uniform vec4 uNFP[NF_N]; uniform vec4 uNFC[NF_N]; uniform int uNFn;
			${CLOUD_REFLECT_GLSL}
			${HEIGHT_GLSL}
			${shared.bayU ? BAY_GLSL : 'float bayHeight(vec2 p){ return -60.0; }'}
			${GROUND('bayHeight')}
			${shared.bayU ? `uniform float uGOn, uGBay; uniform vec2 uGSeam;
			// past the survey the globe's coast takes over: the vertices' ground is used there
			bool pastSurvey(vec2 p){
				if (uGOn < 0.5) return false;
				if (uGBay < 0.5) return true;
				vec2 S0 = vec2(textureSize(uB0, 0)), q0 = (p - uR0.xy) / uR0.z;
				return length(max(vec2(0.0), max(-q0, q0 - (S0 - 1.0)))) * uR0.z > uGSeam.x;
			}` : 'bool pastSurvey(vec2 p){ return false; }'}
			${VARY}
			${NOISE_GLSL}
			${WAVES}
			${SWASH_GLSL}
			${shared.bayU ? ICE_GLSL : ICE_NONE}
			#include <fog_pars_fragment>
			// foam's froth: cells of bubbles with holes between, settling to their average where
			// they would be finer than the pixel (or on a device that draws little detail)
			float froth(vec2 p, float hp){
				vec2 q = p * 3.1 + vec2(uTime * 0.21, -uTime * 0.13);
				float c = vn(q) * 0.55 + vn(q * 2.37 + 5.1) * 0.3 + vn(q * 5.3 - 2.7) * 0.15;
				return mix(0.5, c, (1.0 - smoothstep(0.05, 0.3, hp)) * (0.4 + 0.6 * uShoreQ.y));
			}
			// foam drawn as foam: a density laid over a lace of bubbles, cells whose walls thicken
			// as the foam does, with patches and holes, never a smooth white blob (settling to its
			// average where finer than the pixel, or on a device that draws little detail)
			float laceNet(vec2 p){
				vec2 i = floor(p), f = fract(p);
				float f1 = 9.0, f2 = 9.0;
				for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
					vec2 c = vec2(float(x), float(y)), q = i + c;
					vec2 o = 0.5 + 0.4 * sin(uTime * 0.5 + 6.2832 * vec2(h21(q), h21(q + 19.7)));
					float d = length(c + o - f);
					if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
				}
				return f2 - f1;
			}
			float foamOf(float D, vec2 p, float hp){
				if (D <= 0.002) return 0.0;
				float k = (1.0 - smoothstep(0.02, 0.12, hp)) * uShoreQ.y, t = D * 0.7;
				if (k > 0.01) {
					// (the cells wander in size and shape: read through a slow warp, at two scales)
					// (thin foam is scattered clots and bubbles; only denser foam joins up into a lace)
					vec2 wq = p * 3.2 + (vec2(vn(p * 0.9 + 4.0), vn(p * 0.9 - 7.0)) - 0.5) * 2.4;
					float net = 1.0 - smoothstep(0.06 + D * 0.12, 0.16 + D * 0.4, min(laceNet(wq), uShoreQ.y > 0.8 ? laceNet(wq * 1.9 + 11.0) * 1.3 : 9.0));
					float f = vn(p * 7.3 + vec2(uTime * 0.11, 0.0)) * 0.6 + vn(p * 17.0 - uTime * 0.07) * 0.4;
					float clots = smoothstep(0.95 - D * 0.7, 1.2 - D * 0.6, f);
					float holes = smoothstep(0.25, 0.6, vn(p * 1.3 + 2.0) + D * 0.35);
					// (bubbly inside, never one flat white)
					float grain = 0.72 + 0.28 * vn(p * 26.0 + uTime * 0.2);
					t = mix(t, clamp(max(net * smoothstep(0.3, 0.65, D) * holes, clots) * (0.55 + 0.35 * D) * grain, 0.0, 0.85), k);
				}
				return t;
			}
			void main(){
				vec3 V = normalize(cameraPosition - vW);
				// ripples on top of the swell, fading with distance so the far sea stays calm
				float dist = length(cameraPosition - vW);
				float near = 1.0 - smoothstep(60.0, 900.0, dist);
				// the pixel's footprint on the water: waves finer than it are left out
				// (the worse of the two screen axes: at a low angle the water is foreshortened, and a
				// wave kept across the view aliases into moiré along it)
				float hp = max(max(length(dFdx(vP0)), length(dFdy(vP0))) * 1.4, 0.002);
				float rw = fwidth(vRoll);
				// the ground under this very pixel (the sea's vertices are metres apart: their ground,
				// drawn between them, cut the water along straight lines), read out to the reach
				float pk = (1.0 - smoothstep(uShoreQ.x * 0.7, uShoreQ.x, dist)) * step(-14.0, vGround);
				float g = vGround;
				if (pk > 0.0 && (max(abs(vW.x), abs(vW.z)) < uHalf - 1500.0 || !pastSurvey(vW.xz))) g = mix(vGround, groundAt(vW.xz), pk);
				// the water's level over it: the open sea's, or on a beach the swash's sheet
				vec4 S = vec4(-9.0, -9.0, -99.0, 0.0);
				float shoreK = 0.0, lvl = vWave;
				if (vShore > 0.001 && g > -0.6) {
					S = swashStateK(vW.xz, uTime, uWave, vSwK);
					shoreK = smoothstep(-0.5, -0.1, g) * vShore;
					lvl = mix(vWave, swashSheet(vWave, S.x, g), shoreK);
				}
				float film = lvl - g;
				// the line of lace the last wave left at the top of its run, lying on the sand after
				// the water has drained, breaking up and popping as it goes
				float strand = 0.0;
				if (shoreK > 0.0 && S.z > 0.0 && uShoreQ.y > 0.0 && (gl_FrontFacing || uUnder < 0.5)) {
					float below = S.y - g, age = S.z;
					float line = smoothstep(-0.004, 0.006, below) * (1.0 - smoothstep(0.012, 0.05 + 0.025 * vn(vW.xz * 0.7), below));
					float lace = vn(vW.xz * 5.3 + 3.0) * 0.6 + vn(vW.xz * 13.0 - 1.0) * 0.4;
					strand = line * smoothstep(0.28 + age * 0.06, 0.46 + age * 0.06, lace) * exp(-age * 0.22) * (1.0 - smoothstep(0.1, 0.5, hp)) * shoreK;
				}
				// never draw the water over dry land, nor its underside through dry land or caves
				if (film <= 0.0 && strand < 0.01) discard;
				// the surface's slope: the whole spectrum per pixel, the short wind waves lying down
				// in the slicks along the wind, gusty patches rougher, so the sea is never one even texture
				vec2 sw = mat2(0.82, 0.57, -0.57, 0.82) * vW.xz;
				float slick = smoothstep(0.6, 0.8, vn(vec2(sw.x * 0.004, sw.y * 0.05) + vec2(uTime * 0.004, 0.0)));
				float gust = 0.85 + 0.3 * vn(vW.xz * 0.004 + uTime * 0.01);
				// (the ripples at the water's own place, not where the swell has carried it: the
				// swell's sideways shift is only known at the mesh's vertices, far apart out there,
				// and reading the ripples through it bends their phase into rings)
				vec3 spec3 = slopes(vP0, hp, vAmp.x * gust);
				vec2 gL = spec3.xy;
				// the rollers toward the shore
				float kr = 6.28318 / 16.0;
				gL += vInward * (kr * vAmp.y * cos(kr * (dot(vInward, vP0) - sqrt(9.8 / kr) * uTime)) * keep(16.0, hp));
				// rings spreading from what stands in the water (posts, a hull, you wading)
				float touchF = 0.0;
				if (dist < 160.0) {
					for (int i = 0; i < TOUCH_N; i++) {
						vec4 c = uTouch[i];
						if (c.w <= 0.0) continue;
						vec2 dv = vW.xz - c.xy; float dd = length(dv), e = dd - c.z;
						if (e > 7.0) continue;
						gL += dv / max(dd, 1e-3) * cos(e * 9.0 - uTime * 6.5 + c.x) * 0.1 * c.w * exp(-e * 0.7) * smoothstep(-0.05, 0.1, e) * (1.0 - smoothstep(0.05, 0.4, hp));
						touchF = max(touchF, (1.0 - smoothstep(0.0, 0.2 + 0.4 * c.w, e)) * step(-0.05, e) * min(c.w, 1.0));
					}
				}
				// rain pocking the water: a drop now and then in each cell, its ring spreading and fading
				if (uRain > 0.01 && dist < 45.0) {
					for (int j = 0; j < 2; j++) {
						vec2 q = vW.xz * (1.7 + float(j) * 0.9) + float(j) * 17.3, ci = floor(q), f = fract(q) - 0.5;
						float hs = h21(ci + 11.0), ph = fract(uTime * (0.7 + hs * 0.8) + hs * 13.0);
						vec2 dv = f - (vec2(h21(ci + 3.7), h21(ci + 9.1)) - 0.5) * 0.5;
						float rr = length(dv), R = ph * 0.42;
						float ring = sin((rr - R) * 45.0) * (1.0 - smoothstep(0.0, 0.07, abs(rr - R))) * (1.0 - ph) * step(hs, uRain);
						gL += dv / max(rr, 1e-3) * ring * 0.4 * (1.0 - smoothstep(18.0, 45.0, dist)) * (1.0 - smoothstep(0.03, 0.2, hp));
					}
				}
				// a stream running out into the sea: a plume of silty water spreading off its mouth, the
				// ripples laid down in it, and a ragged current line of foam and scum along its edge
				float plume = 0.0, plumeEdge = 0.0;
				for (int i = 0; i < 4; i++) {
					vec4 M = uMouth[i];
					float mw = length(M.zw);
					if (mw < 0.5) continue;
					vec2 md = M.zw / mw, rel = vW.xz - M.xy;
					float al = dot(rel, md), ac = dot(rel, vec2(-md.y, md.x)), Lp = clamp(mw * 28.0, 60.0, 700.0);
					if (al < -mw * 2.0 || al > Lp) continue;
					// (a cloud of silt carried out and eddying, its edge ragged at every scale: never a wedge)
					float spread = mw * 0.8 + max(al, 0.0) * 0.28;
					vec2 fq2 = rel / max(mw, 1.0) * 0.35 - md * uTime * 0.04;
					float wob = (fbm3(fq2 * 0.5 + 3.0) - 0.5) * 1.6 + (vn(vW.xz * 0.15 - uTime * 0.03) - 0.5) * 0.5;
					float k = (1.0 - smoothstep(0.35, 1.0, abs(ac) / spread + wob)) * (1.0 - smoothstep(0.3, 1.0, al / Lp + (vn(fq2 + 9.0) - 0.5) * 0.5)) * smoothstep(-mw * 2.0, 0.0, al);
					plume = max(plume, k);
				}
				plumeEdge = smoothstep(0.12, 0.3, plume) * (1.0 - smoothstep(0.38, 0.62, plume));
				gL *= 1.0 - 0.45 * plume;
				// thin water running over sand is never glassy: churned as it rushes up the beach,
				// combed into streaks as it drains back down
				if (shoreK > 0.0 && hp < 0.3) {
					float up = 1.0 - step(0.0, S.z);
					vec2 mq = vW.xz * vec2(2.3, 2.3) - vInward * uTime * mix(-0.7, 1.6, up);
					float m0 = vn(mq), mx = vn(mq + vec2(0.2, 0.0)), mz = vn(mq + vec2(0.0, 0.2));
					float m1 = vn(mq * 2.7 + 3.1), m1x = vn(mq * 2.7 + 3.1 + vec2(0.2, 0.0)), m1z = vn(mq * 2.7 + 3.1 + vec2(0.0, 0.2));
					gL += (vec2(mx - m0, mz - m0) * 0.35 + vec2(m1x - m1, m1z - m1) * 0.2) * mix(0.45, 0.9, up) * shoreK * (1.0 - smoothstep(0.05, 0.3, hp));
				}
				// what the fine waves cannot show becomes roughness: a wider, softer sun glint
				// at a grazing look the reflection swings from sky to horizon within a pixel or
				// two: there the ripples are laid down, so they cannot beat into moiré
				float graze = smoothstep(0.02, 0.22, abs(V.y));
				gL *= mix(0.3, 1.0, graze);
				float rough = smoothstep(0.3, 6.0, hp) * (1.0 - 0.5 * slick);
				vec3 N = normalize(vec3(-gL.x, 1.0, -gL.y) * vec3(1.0 - 0.5 * slick, 1.0, 1.0 - 0.5 * slick));
				float r0 = 0.5 + 0.5 * clamp((gL.x + gL.y) * 3.0, -1.0, 1.0);
				// (seen from above, a fold of the surface turned away is still the top of the water)
				if (!gl_FrontFacing && uUnder > 0.5) {
					// from below. Inside Snell's window (about 49 degrees round straight up) the whole
					// sky is squeezed into a circle, its horizon at the rim, the sun's disc in it;
					// outside it the surface is a mirror of the dim water below. The ripples bend the
					// window's edge, and further off, through more water, it all fades into the blue.
					vec3 lightU = uAmbient * 2.0 + uSunColor * max(0.0, uSunDir.y);
					vec3 deepU = vec3(0.02, 0.15, 0.19) * lightU;
					vec3 I = -V, Nd = -N;
					vec3 T = refract(I, Nd, 1.333);
					vec3 col = deepU * (0.75 + 0.4 * r0);
					if (dot(T, T) > 0.0) {
						vec3 skyC = skyReflect(T, uSkyZen, uSkyHor, uSunColor) * 1.05;
						skyC += uSunColor * (pow(max(dot(T, uSunDir), 0.0), 400.0) * 8.0 + pow(max(dot(T, uSunDir), 0.0), 14.0) * 0.35) * smoothstep(-0.05, 0.1, uSunDir.y);
						// the light let through falls away toward the rim (most of it is reflected there)
						float cosI = abs(dot(Nd, I));
						col = mix(col, skyC, smoothstep(0.662, 0.74, cosI));
						// a thin bright ring where the window meets the mirror
						col += mix(uSkyHor, uSkyZen, 0.3) * 0.25 * (1.0 - smoothstep(0.0, 0.03, abs(cosI - 0.675)));
					}
					col = mix(col, deepU, smoothstep(6.0, 55.0, dist));
					gl_FragColor = vec4(col, 1.0);
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>
					return;
				}
				float ndv = max(0.0, dot(N, V));
				float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
				// how deep the water is just here
				float d = max(film, 0.0);
				// the bottom you see through the water: sand, reef, caustics
				vec2 muv = (vW.xz + uHalf) / (uHalf * 2.0);
				// how far into the cold open sea: round, not the island map's square, its edge
				// wandering with broad noise, and the island's own reef and sand fading out
				// before the map ends
				float warmR = length(vW.xz) + (vn(vW.xz * 0.00045) - 0.5) * 3200.0 + (vn(vW.xz * 0.0017 + 7.0) - 0.5) * 900.0;
				float cold = smoothstep(1900.0, 4300.0, warmR);
				float inMap = 1.0 - smoothstep(0.86, 0.98, max(abs(muv.x - 0.5), abs(muv.y - 0.5)) * 2.0);
				float reef = texture2D(uMasks, clamp(muv, 0.0, 1.0)).b * inMap;
				// (the sand at the very edge is the wet sand the ground draws there, paler further in)
				vec3 sand = mix(vec3(0.56, 0.48, 0.36), vec3(0.84, 0.78, 0.62), smoothstep(0.05, 1.6, d));
				vec3 bottom = mix(sand, vec3(0.20, 0.24, 0.16), reef * 0.85);
				// off the island this is the cold North Pacific and the bay: grey-green, murky
				reef *= 1.0 - cold;
				// inside the Golden Gate, the bay: silty, a murkier grey-green than the open Pacific
				float bayK = cold * smoothstep(9000.0, 12500.0, vW.x);
				bottom = mix(bottom, mix(vec3(0.34, 0.33, 0.27), vec3(0.3, 0.29, 0.22), bayK), cold);
				// the bed through moving water wobbles with the surface's slope, more the deeper it is
				vec2 cq = (vW.xz + gL * min(d, 3.0) * 0.5) * 0.55;
				float c1 = 1.0 - abs(vn(cq + vec2(uTime * 0.35, uTime * 0.2)) * 2.0 - 1.0);
				float c2 = 1.0 - abs(vn(cq * 1.3 - vec2(uTime * 0.28, -uTime * 0.31)) * 2.0 - 1.0);
				// (gone where a pixel spans a caustic cell: they would alias; and in the first few
				// centimetres, where the ground's own caustics show through)
				float caust = pow(min(c1, c2), 6.0) * 2.4 * smoothstep(0.03, 0.4, d) * (1.0 - smoothstep(0.5, 9.0, d)) * (1.0 - 0.7 * cold) * (1.0 - smoothstep(0.08, 0.35, hp)) * (0.3 + 0.7 * uShoreQ.y);
				float sunUp = clamp(uSunDir.y * 3.0, 0.0, 1.0);
				bottom *= (0.55 + caust * sunUp) ;
				vec3 sig = mix(vec3(0.45, 0.085, 0.06), mix(vec3(0.55, 0.3, 0.3), vec3(0.7, 0.45, 0.55), bayK), cold);
				// the light's path through the water to the bed and back up to you: down, then out
				// along the look bent by the surface (longer the lower you look, at most half again)
				float cosT = sqrt(1.0 - (1.0 - ndv * ndv) / 1.777);
				float de = d * (1.0 + 1.0 / max(cosT, 0.66)) * 0.5;
				// a post, a hull, a rock or the coral nearer under the surface than the bed: the light
				// comes back through only that much water (so a post's foot shows a metre down as it
				// is, not tinted as if it stood on the bed), and where it breaks the surface, foam
				float behind = seaDepthBehind(vW);
				if (behind > -0.02) de = min(de, max(behind, 0.0));
				vec3 trans = exp(-sig * de * 2.0);
				vec3 deep = mix(vec3(0.0, 0.06, 0.19), mix(vec3(0.016, 0.038, 0.052), vec3(0.03, 0.045, 0.038), bayK), cold);
				// light scattering in shallow tropical water: turquoise over sand, fading with depth
				vec3 scat = deep * (1.0 - trans) + mix(vec3(0.026, 0.55, 0.52), mix(vec3(0.03, 0.06, 0.06), vec3(0.05, 0.07, 0.045), bayK), cold) * (1.0 - exp(-0.55 * de)) * exp(-0.09 * de) * (1.0 - reef * 0.6);
				vec3 light = uAmbient + uSunColor * max(0.0, uSunDir.y) * 0.9;
				// The bed itself is the ground drawn under the water (the wet sand, the reef): the
				// water lays its own colour over it by its cover aB, which is nothing at the edge.
				// What the bed should look like through d metres (bed x trans + scattered light) is
				// then had from that cover and the bed as estimated here: the water's red-first
				// absorption tints the real ground turquoise, with no step where the two meet.
				float murk = clamp(cold * 0.55 + bayK * 0.45 + plume * 0.6, 0.0, 1.0);
				float aB = waterBody(de * 2.0, sig.r, murk);
				vec3 body = max(vec3(0.0), (scat * light + bottom * light * (trans - (1.0 - aB))) / max(aB, 1e-4));
				// light through the wave faces: slopes tilted toward the sun glow, those turned away
				// darken, so you see the waves even looking straight down into the water
				vec2 sunH = normalize(uSunDir.xz + 1e-4);
				float dayS = smoothstep(-0.05, 0.1, uSunDir.y);
				body *= 1.0 + clamp(dot(-gL, sunH) * 2.2, -0.35, 0.45) * (1.0 - rough);
				// AgX is calm and a little grey; give the sea back its turquoise
				// (the cold water stays the cold North Pacific's slate and the bay's grey-green)
				float bl = dot(body, vec3(0.2126, 0.7152, 0.0722));
				body = max(vec3(0.0), mix(vec3(bl), body, mix(1.0, mix(1.35, 0.85, cold), graze)));
				// the sun shining through the thin tops of the waves when you look toward it: a
				// turquoise glow in the crests (a slate green in the cold sea), strongest with a low sun
				vec2 vH = normalize(-V.xz + 1e-4);
				float back = pow(max(0.0, dot(vH, sunH)), 3.0) * smoothstep(0.15, 0.9, vCrest) * smoothstep(1.0, 4.0, d);
				body += uSunColor * mix(vec3(0.04, 0.4, 0.33), vec3(0.06, 0.13, 0.11), cold) * back * dayS * (1.0 - 0.6 * clamp(uSunDir.y, 0.0, 1.0)) * (1.0 - plume);
				// (the plume: brown-green silt, the bed lost in it)
				body = mix(body, vec3(0.16, 0.15, 0.09) * light, plume * 0.7);
				// reflection of the sky and the sun
				vec3 R = reflect(-V, N);
				// (the clouds overhead in it, world/sky.js: clear on a slick, broken up on a rough sea)
				vec3 sky = mix(skyReflect(R, uSkyZen, uSkyHor, uSunColor), mix(uSkyHor, uSkyZen, pow(clamp(R.y, 0.0, 1.0), 0.35)), rough * 0.6) * (0.92 + 0.08 * slick * near);
				// the land, the trees, the village and the boats standing in it (world/seamirror.js): the
				// mirror's picture at this point of the water, bent by the ripples, softer where it is
				// rough; where nothing was drawn the sky stays
				if (uReflOn > 0.5) {
					vec4 rq = uReflM * vec4(vW.x, 0.0, vW.z, 1.0);
					vec2 ruv = rq.xy / max(rq.w, 1e-4) + gL * 0.05 * (1.0 - 0.6 * rough);
					vec4 rf = texture2D(uRefl, clamp(ruv, 0.001, 0.999));
					float edgeK = smoothstep(0.0, 0.04, ruv.x) * smoothstep(0.0, 0.04, 1.0 - ruv.x) * smoothstep(0.0, 0.04, ruv.y) * smoothstep(0.0, 0.04, 1.0 - ruv.y);
					sky = mix(sky, rf.rgb, clamp(rf.a, 0.0, 1.0) * edgeK * (1.0 - 0.45 * rough) * step(0.0, rq.w));
				}
				float spec = pow(max(dot(R, uSunDir), 0.0), mix(500.0, 60.0, rough)) * mix(14.0, 2.0, rough) * (0.25 + 0.75 * near) + pow(max(dot(R, uSunDir), 0.0), mix(60.0, 12.0, rough)) * 0.8;
				// at night the moon (opposite the sun) lays a glittering path across the water
				float nightK = smoothstep(0.02, -0.15, uSunDir.y);
				vec3 moonDir = normalize(-uSunDir + vec3(0.0, 0.35, 0.0));
				float glade = (pow(max(dot(R, moonDir), 0.0), 160.0) * 9.0 + pow(max(dot(R, moonDir), 0.0), 14.0) * 0.35) * nightK;
				// ripples scatter the path into glitter, broken up (never the long-crested trains'
				// regular bright bands)
				glade *= (0.35 + 1.3 * smoothstep(0.55, 0.8, r0)) * mix(1.0, 1.7 * smoothstep(0.38, 0.72, vn(vP0 * 1.9 + vec2(uTime * 0.4, -uTime * 0.3))), 1.0 - smoothstep(0.1, 0.6, hp));
				// the lamps along the shore in the water: a point on a calm patch, drawn out into a
				// streak toward you by the ripples (the few nearest, world/nightfield.js)
				vec3 lamps = vec3(0.0);
				for (int i = 0; i < NF_N; i++) {
					if (i >= uNFn) break;
					vec3 L = uNFP[i].xyz - vW; float dl = length(L);
					float c = max(dot(R, L / dl), 0.0);
					lamps += uNFC[i].rgb * (pow(c, mix(1400.0, 160.0, rough)) * 2.5 + pow(c, 60.0) * 0.06) / (1.0 + dl * 0.15);
				}
				// the sky's sheen grows in over the first couple of centimetres of water: no bright
				// rim where the sheet meets the sand
				float Fe = F * 0.95 * smoothstep(0.0, 0.02, film);
				vec3 shine = uSunColor * spec * (0.8 + uHigh * 0.6) * dayS + vec3(0.75, 0.82, 1.0) * glade + lamps;
				shine *= smoothstep(0.0, 0.01, film);
				// (the water's cover, the sky's sheen and the glints over the ground drawn under it)
				float a = max(1.0 - (1.0 - aB) * (1.0 - Fe), clamp(dot(shine, vec3(0.3, 0.5, 0.2)), 0.0, 1.0));
				vec3 col = (body * aB * (1.0 - Fe) + sky * Fe + shine) / max(a, 1e-4);
				// another world's sea: acid green, black glass, violet
				col = mix(col, dot(col, vec3(0.299, 0.587, 0.114)) * uWaterT.rgb, uWaterT.a);
				// ---- foam ----
				float fq = froth(vW.xz, hp);
				// breakers, on gentle open beaches only: the roller's crest pitches over white and
				// rolls in behind as a bore of white water, patchy as it spreads (the bands softened by
				// how fast they pass under the pixel; finer than it, scattered froth, never a milky stripe)
				float cyc = fract(vRoll / 6.28318 - 0.25);
				float whiteW = mix(smoothstep(0.8 - rw * 0.1, 0.98, cyc) + (1.0 - smoothstep(0.0, 0.18 + rw * 0.1, cyc)) * 0.8 * smoothstep(0.4, 0.68, fq), mix(0.05, 0.3, smoothstep(0.42, 0.75, fq)), smoothstep(0.6, 2.0, rw));
				float surfZ = smoothstep(0.25, 0.6, d) * (1.0 - smoothstep(1.2, 2.4, d)) * vBreak;
				// (each wave breaks in sections along its crest, a different stretch every wave, never
				// one white line the length of the beach: the wave's count changes mid-cycle, between
				// one bore and the next crest)
				float waveN = floor(vRoll / 6.28318 + 0.25);
				float section = mix(0.25, 1.0, smoothstep(0.3, 0.7, vn(vec2(dot(vW.xz, vec2(-vInward.y, vInward.x)) * 0.07, waveN * 1.73))));
				float breaker = whiteW * surfZ * section * smoothstep(0.32, 0.6, fq + 0.12) * (1.0 - 0.6 * smoothstep(0.4, 2.0, hp));
				// the white water spent in the inner surf, broken into patches
				float inner = smoothstep(0.06, 0.25, d) * (1.0 - smoothstep(0.5, 1.1, d)) * vBreak * smoothstep(0.5, 0.74, fq) * (0.35 + 0.65 * smoothstep(0.2, 1.0, cyc)) * (1.0 - shoreK * 0.5);
				// whitecaps out on open water: where the waves crowd together and their crests fold
				// (a rare fleck in a calm, scattered caps in a breeze, white everywhere in a gale: the
				// pinch grows with the waves' height), broken up by the froth, strongest in the gusts;
				// anywhere past the surf (a lagoon a few metres deep whitens in a blow as the sea does)
				float cap = smoothstep(0.1, 0.2, spec3.z) * smoothstep(0.3, 0.6, fq) * smoothstep(1.5, 4.0, d) * (0.6 + 0.4 * smoothstep(0.75, 1.1, vCrest + 0.4));
				// further off the short waves that fold are finer than the pixel and left out: there the
				// caps, each smaller than the pixel too, are a faint whitening by how hard it blows,
				// stronger along the gusty lanes (never drawn as blobs of white at that size)
				float capFar = smoothstep(0.8, 2.0, vAmp.x * gust) * 0.4 * mix(0.35, 1.0, vn(vP0 * 0.015 + uTime * vec2(0.004, 0.002)));
				cap = max(cap, capFar * smoothstep(0.04, 0.25, hp) * smoothstep(1.5, 4.0, d));
				// the swash: a bore of froth at its front as it rushes up, clear thin water behind;
				// stalled and draining, the front runs thin and clear, the foam it carried breaks into
				// lace going down the beach, and bubbles pop in the backwash
				float swF = 0.0;
				if (shoreK > 0.0) {
					float rising = 1.0 - step(0.0, S.z), age = max(S.z, 0.0);
					float fw = mix(0.006, 0.02, rising);
					float edge = smoothstep(0.0, 0.0015, film) * (1.0 - smoothstep(fw * 0.5, fw * 1.7, film));
					float bore = edge * smoothstep(0.3, 0.55, fq + 0.15 * rising) * mix(0.45, 0.85, rising);
					vec2 lq = vW.xz * 1.9 + vInward * age * 0.9;
					float lace = mix(0.5, vn(lq) * 0.6 + vn(lq * 2.6 + 4.0) * 0.4, 1.0 - smoothstep(0.1, 0.5, hp));
					float back = step(0.0, S.z) * smoothstep(0.002, 0.01, film) * (1.0 - smoothstep(0.03, 0.09, film)) * smoothstep(0.5 + age * 0.03, 0.62 + age * 0.03, lace) * exp(-age * 0.15);
					float bub = 0.0;
					if (hp < 0.05 && uShoreQ.y > 0.3) {
						vec2 bq = vW.xz * 22.0, bi = floor(bq), bf = fract(bq) - 0.5;
						float bh = h21(bi + 5.0), life = fract(uTime * (0.35 + bh * 0.6) + bh * 9.0);
						float br = length(bf - (vec2(h21(bi + 1.0), h21(bi + 2.0)) - 0.5) * 0.4);
						bub = step(0.78, bh) * (1.0 - smoothstep(0.04 + life * 0.14, 0.08 + life * 0.16, br)) * (1.0 - life) * step(0.0, S.z) * (1.0 - smoothstep(0.03, 0.07, film)) * (1.0 - smoothstep(0.02, 0.05, hp));
					}
					swF = max(max(bore, back), max(bub * 0.75, strand)) * shoreK;
				}
				// lapping foam where the open sea meets a shore with no swash (the Bay Area's coasts):
				// a lace that comes and goes with each roller, thinning to nothing at the line itself
				float lap = smoothstep(0.0, 0.03, film) * (1.0 - smoothstep(0.08, 0.3 + 0.15 * sin(vRoll), film)) * smoothstep(0.42, 0.7, fq + 0.2 * sin(vRoll + 1.2)) * (1.0 - shoreK) * pk;
				// against rock the swell bursts white and pours off in streams
				float rocky = smoothstep(0.12, 0.3, vSlope);
				float rockF = rocky * (1.0 - smoothstep(0.0, 1.4, film)) * smoothstep(0.3, 0.7, fq + 0.35 * sin(vRoll + 0.4)) * smoothstep(0.0, 0.02, film);
				// a line of foam where a post, a hull or a rock meets the water, sloshing with the swell
				float contact = behind > -0.02 ? (1.0 - smoothstep(0.03, 0.35 + 0.1 * sin(vRoll + vW.x * 0.7), behind)) * smoothstep(0.3, 0.6, fq + 0.2) * smoothstep(0.0, 0.02, film) : 0.0;
				float current = plumeEdge * smoothstep(0.5, 0.75, fq + 0.25 * vn(vW.xz * 0.2 + uTime * 0.05)) * 0.45;
				float foam = foamOf(clamp(max(max(breaker, max(inner, current)), max(cap * 0.9, max(swF, max(lap * 0.7, max(max(rockF * 0.85, contact * 0.8), touchF * smoothstep(0.35, 0.6, fq + 0.2)))))), 0.0, 1.0), vW.xz, hp);
				// lit by the sun by day, the moon and sky by night (never glowing in the dark)
				vec3 foamC = vec3(0.92, 0.95, 0.96) * (uAmbient * 0.9 + uSunColor * max(0.0, uSunDir.y) * 0.9 + vec3(0.06, 0.07, 0.09) * nightK);
				// a toxic sea's foam is a yellow-green scum
				foamC = mix(foamC, foamC * vec3(0.8, 0.95, 0.42), uLiquid);
				foamC *= 0.82 + 0.18 * fq;
				float A = foam + a * (1.0 - foam);
				col = (foamC * foam + col * a * (1.0 - foam)) / max(A, 1e-4);
				// ---- the pack ice ----
				// the floes region/ice.js stands round you, drawn on the sea itself from the same
				// lattice and hashes, and under them out to the horizon the cracked field they make
				if (uIceOn > 0.5) {
					vec3 pk = packIce(vP0, hp);
					if (pk.z > 0.0) {
						float deepK = smoothstep(-0.6, -1.5, vGround), far = smoothstep(2.0, 24.0, hp);
						vec3 lit = uAmbient * 0.9 + uSunColor * max(0.0, uSunDir.y) * 0.9 + vec3(0.06, 0.07, 0.09) * nightK;
						// the field the pack makes, plates and leads and cracks, from close by to the horizon (thin
						// enough that the swell's ripples and the sky still show through), and on it close by the
						// floes themselves, until they are finer than the pixel
						vec4 fld = iceField(vP0, hp, pk.z);
						// (close by, between the floes you can stand on, it is the new ice: bluer and thinner)
						fld.rgb = mix(mix(fld.rgb, vec3(0.5, 0.64, 0.75), 0.3), fld.rgb, far); fld.a *= mix(0.75, 1.0, far);
						float floeA = pk.x * 0.92 * (1.0 - far);
						vec3 floeC = mix(vec3(0.9, 0.93, 0.96) * (0.95 + 0.05 * vn(vW.xz * 0.11)), vec3(0.62, 0.78, 0.86), pk.y * 0.8);
						float iA = (floeA + fld.a * (1.0 - floeA)) * deepK;
						vec3 iC = (floeC * floeA + fld.rgb * fld.a * (1.0 - floeA)) / max(floeA + fld.a * (1.0 - floeA), 1e-4);
						// (the sea's own glints and sky reflected through the ice: it lies on the water)
						iC = iC * lit + shine * 0.2;
						float Af = iA + A * (1.0 - iA);
						col = (iC * iA + col * A * (1.0 - iA)) / max(Af, 1e-4); A = Af;
					}
				}
				if (A < 0.003) discard;
				gl_FragColor = vec4(col, A);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
				#include <fog_fragment>
			}`,
	});
	// (drawn as a middle and eight wedges round it, a wedge out of the view not drawn: a phone
	// sees a tenth of the circle, and the rest went through the waves' sums every frame for
	// nothing, world/gridwedges.js. The shader centres the grid on uCenter itself; its waves move a
	// vertex at most about 2.3 m sideways and 2.9 m up or down a unit of uWave (the trains' Q A
	// and A summed at their highest groups, plus the roller and its pitching crest), and the
	// beach's sheet is laid at most about a metre over the sand: tested with room to spare)
	const reach = () => Math.max(0, uniforms.uWave.value);
	const W = wedgeMeshes(geo, mat, { mid: 64, y: () => [-(3 * reach() + 2), 3 * reach() + 4], pad: () => 2.5 * reach() + 1, at: uniforms.uCenter.value });
	// the middle is the sea itself (what the frame sets on it, the wedges follow: shown, drawn in
	// its order)
	const mesh = W.meshes.find((m) => !m.frustumCulled);
	mesh.removeFromParent();
	for (const m of W.meshes) {
		if (m === mesh) continue;
		m.name = 'ocean-wedge';
		Object.defineProperty(m, 'renderOrder', { get: () => mesh.renderOrder, set() {} });
		mesh.add(m);
	}
	mesh.name = 'ocean';
	mesh.renderOrder = 1;
	mesh.userData.update = (cam) => {
		const snap = 8;
		uniforms.uCenter.value.set(Math.round(cam.position.x / snap) * snap, Math.round(cam.position.z / snap) * snap);
	};
	mesh.userData.uniforms = uniforms;
	// what touches the water, each frame: the pier's posts, the boat, you wading; the rain on it;
	// the governor's tier (no allocation: the candidates are kept in a fixed pool)
	const pool = [...Array(48)].map(() => ({ x: 0, z: 0, r: 0, k: 0, d: 0 }));
	let posts = null, postsOf = null;
	const lastPos = new THREE.Vector3();
	let speed = 0, n = 0, camX = 0, camZ = 0;
	const shoreQ = { reach: 520, detail: 1 };
	const mouthBuf = new Float32Array(20);
	let mouthT = 0;
	function add(x, z, r, k) {
		if (n >= pool.length) return;
		const d = Math.hypot(x - camX, z - camZ);
		if (d > 160) return;
		const o = pool[n++]; o.x = x; o.z = z; o.r = r; o.k = k; o.d = d;
	}
	mesh.userData.tick = (dt, W, camera, rain = 0) => {
		const Q = shoreQuality(qualityNow(), PHONE, shoreQ);
		uniforms.uShoreQ.value.set(Q.reach, Q.detail);
		uniforms.uRain.value = rain;
		camX = camera.position.x; camZ = camera.position.z; n = 0;
		// the pier's posts standing in the water (worked out once per village)
		const P = W?.village?.pier;
		if (P && postsOf !== P) {
			postsOf = P; posts = [];
			const sd = island.village?.seaDir;
			if (sd) for (let s = 0; s <= P.len + 4; s += 4) for (const sx of [-1, 1]) {
				const off = s > P.len ? 3.8 : 1.2, x = P.x + sd.x * s - sd.z * sx * off, z = P.z + sd.z * s + sd.x * sx * off;
				if (island.heightAt(x, z) < -0.15) posts.push(x, z);
			}
		}
		if (posts) for (let i = 0; i < posts.length; i += 2) add(posts[i], posts[i + 1], 0.17, 0.8);
		// the boat's hull, bow and stern
		const B = W?.boat?.state;
		if (B && island.heightAt(B.x, B.z) < -0.3) {
			const fx = -Math.sin(B.heading), fz = -Math.cos(B.heading), k = 0.6 + Math.min(1, Math.abs(B.speed || 0) * 0.15);
			add(B.x + fx * 2.6, B.z + fz * 2.6, 1.0, k); add(B.x - fx * 2.4, B.z - fz * 2.4, 1.2, k);
		}
		// you, wading: rings as you move, a wash of foam round your legs
		const pl = W?.player?.state?.pos;
		if (pl && dt > 0) {
			speed += (Math.hypot(pl.x - lastPos.x, pl.z - lastPos.z) / dt - speed) * Math.min(1, dt * 4);
			lastPos.copy(pl);
			const g = island.heightAt(pl.x, pl.z), feet = pl.y - 1.68;
			if (g < -0.05 && feet < 0.3 && feet > g - 0.5 && !W.player.state.flying) add(pl.x, pl.z, 0.22, Math.min(1.2, 0.35 + speed * 0.25));
		}
		// the streams' mouths near you (a look round every second)
		mouthT -= dt;
		if (mouthT <= 0) {
			mouthT = 1;
			const m = W?.water?.mouths?.(camX, camZ, 1500, mouthBuf, 4) || 0, MU = uniforms.uMouth.value;
			for (let i = 0; i < 4; i++) { if (i < m) MU[i].set(mouthBuf[i * 5], mouthBuf[i * 5 + 1], mouthBuf[i * 5 + 2] * mouthBuf[i * 5 + 4], mouthBuf[i * 5 + 3] * mouthBuf[i * 5 + 4]); else MU[i].set(0, 0, 0, 0); }
		}
		// the nearest few
		for (let i = 1; i < n; i++) { const o = pool[i]; let j = i - 1; while (j >= 0 && pool[j].d > o.d) { pool[j + 1] = pool[j]; j--; } pool[j + 1] = o; }
		const T = uniforms.uTouch.value;
		for (let i = 0; i < TOUCH_N; i++) { if (i < n) T[i].set(pool[i].x, pool[i].z, pool[i].r, pool[i].k); else T[i].set(0, 0, 0, 0); }
	};
	// Where the swell bursts on rock near you, for the spray (world/spray.js): the steep
	// shores round you found from the ground's heights (looked for again as you move on), each
	// with the way the waves come at it; out: [x, y, z, strength] for the two bursting hardest
	// just now, strength 0..1 rising as a roller's crest hits and dying away.
	const rocks = new Float32Array(24 * 5);
	let nRocks = 0;
	const scanAt = { x: 1e9, z: 1e9 };
	function scanRocks(cx, cz) {
		nRocks = 0;
		const H = (x, z) => island.heightAt(x, z), step = 7;
		for (let j = -18; j <= 18 && nRocks < 24; j++) for (let i = -18; i <= 18 && nRocks < 24; i++) {
			const x = Math.round(cx / step) * step + i * step, z = Math.round(cz / step) * step + j * step, h = H(x, z);
			if (h < -0.4 || h > 0.5) continue;
			const gx = (H(x + 3, z) - H(x - 3, z)) / 6, gz = (H(x, z + 3) - H(x, z - 3)) / 6, sl = Math.hypot(gx, gz);
			if (sl < 0.28) continue;
			// the sea must be just off it, a metre deep or more
			if (H(x - gx / sl * 6, z - gz / sl * 6) > -0.8) continue;
			let near = false;
			for (let k = 0; k < nRocks && !near; k++) near = Math.hypot(rocks[k * 5] - x, rocks[k * 5 + 1] - z) < 12;
			if (near) continue;
			const o = nRocks++ * 5;
			rocks[o] = x; rocks[o + 1] = z; rocks[o + 2] = gx / sl; rocks[o + 3] = gz / sl; rocks[o + 4] = ((x * 0.37 + z * 0.61) % 6.283 + 6.283) % 6.283;
		}
	}
	const k16 = 6.28318 / 16, c16 = Math.sqrt(9.8 / k16);
	mesh.userData.splashes = (cam, t, out, count = 2) => {
		for (let i = 0; i < count * 4; i++) out[i] = 0;
		if (island.hasOcean === false || !mesh.visible) return out;
		if (Math.hypot(cam.x - scanAt.x, cam.z - scanAt.z) > 60) { scanAt.x = cam.x; scanAt.z = cam.z; scanRocks(cam.x, cam.z); }
		const wave = uniforms.uWave.value;
		for (let k = 0; k < nRocks; k++) {
			const o = k * 5, x = rocks[o], z = rocks[o + 1], d = Math.hypot(x - cam.x, z - cam.z);
			if (d > 110) continue;
			// the roller's crest arriving (as the shader's: running uphill onto the rock), every
			// wave a little different
			const f = k16 * (rocks[o + 2] * x + rocks[o + 3] * z - c16 * t);
			const hit = Math.pow(Math.max(0, Math.sin(f + 0.4)), 6) * (0.55 + 0.45 * Math.sin(t * 0.37 + rocks[o + 4])) * Math.min(1.5, wave);
			keepSplash(out, count, x, z, hit * (1 - Math.max(0, (d - 70) / 40)));
		}
		// the pier's posts in the surf: a smaller slap and throw as each roller passes
		if (posts) for (let i = 0; i < posts.length; i += 2) {
			const x = posts[i], z = posts[i + 1], d = Math.hypot(x - cam.x, z - cam.z), r = Math.hypot(x, z) || 1;
			if (d > 60 || island.heightAt(x, z) < -2.5) continue;
			const f = k16 * (-(x * x + z * z) / r - c16 * t);
			keepSplash(out, count, x, z, Math.pow(Math.max(0, Math.sin(f + 0.4)), 8) * 0.45 * Math.min(1.5, wave) * (1 - Math.max(0, (d - 35) / 25)));
		}
		return out;
	};
	// keep the strongest few in out (a short insertion, nothing made)
	function keepSplash(out, count, x, z, v) {
		for (let s = 0; s < count; s++) {
			if (v <= out[s * 4 + 3]) continue;
			for (let q = count - 1; q > s; q--) for (let c = 0; c < 4; c++) out[q * 4 + c] = out[(q - 1) * 4 + c];
			out[s * 4] = x; out[s * 4 + 1] = 0.15; out[s * 4 + 2] = z; out[s * 4 + 3] = v;
			return;
		}
	}
	return mesh;
}

// CPU mirror of the sea's height so swimmers and boats ride the same sea as the shader
// (the spectrum's vertical part, and the rollers toward the shore)
const SPEC = [[-0.18, 38, 1], [0.42, 26, 0.95], [-0.63, 18.5, 0.9], [0.21, 13.1, 0.85], [0.95, 9.7, 0.8], [-0.4, 7.3, 0.75], [0.62, 5.4, 0.7], [-0.9, 4.1, 0.66], [0.08, 3.05, 0.62]];
export function waveHeight(island, x, z, t, wave = 1) {
	const depth = Math.max(0, -island.heightAt(x, z));
	const open = Math.min(1, Math.max(0, (depth - 0.4) / 6.6)), sm = open * open * (3 - 2 * open);
	let h = 0;
	for (const [da, L, ra] of SPEC) {
		const a = 0.61 + da, k = 6.28318 / L;
		h += L * 0.0115 * ra * wave * sm * Math.sin(k * (Math.cos(a) * x + Math.sin(a) * z - Math.sqrt(9.8 / k) * t));
	}
	const r = Math.hypot(x, z) + 1e-3, ix = -x / r, iz = -z / r;
	const d = Math.min(1, Math.max(0, (depth - 4) / 12)), nearShore = 1 - d * d * (3 - 2 * d);
	const amp = wave * (0.16 + (0.5 - 0.16) * sm) * nearShore, k = 6.28318 / 16;
	return h + amp * Math.sin(k * ((ix * x + iz * z) - Math.sqrt(9.8 / k) * t));
}
