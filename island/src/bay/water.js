// Fresh water, drawn from whatever says where it is: the real Bay Area's rivers, creeks,
// canals, lakes and reservoirs (bay/watersrc.js, baked from OpenStreetMap by
// tools/bake-water.py), the generated land's streams and lakes (crysis/rivers.js), the
// generated towns' park ponds, or a planet's (planet/waters.js). A source lists its lakes
// ({ rings, level, kind, name, dams }) and gives the lines of each 2 km tile (each point
// [x, z, level, width], running the way the water flows).
//
// The lakes lie flat at their level; round you the ground under them is let down and their
// shores wet (the carving, watercarve.js), their water clear in the shallows and dark and
// sky-bright further out; a reservoir's earth dam rises where the ground falls away below
// it. The rivers are ribbons laid down their channels, the channels carved round you on a
// 2 m grid: a bed, gravel at the water, banks cut back to the land; in town a flood channel
// is poured concrete. The water flows the way the stream does: wide or in town slow, dark
// and glassy with sand and mud at its edges; a country creek shallow and clear over its
// cobbles, gravel at its edges, broken white where it falls and round the rocks and snags
// in its bed. Willows, alders and sycamores line the wild banks (redwoods in the fog belt).
// Where a road crosses, a deck carries it over. Small intermittent creeks run low by late
// summer. On other worlds the water may be ice, or lava, or tinted as the world's sea is.
//
// Everything is streamed: 2 km tiles built and let go as you move, the carving done a
// slice a frame, so nothing stalls a frame for long.

import * as THREE from 'three';
import { BAY_GLSL } from './terrain.js';
import { NOISE_GLSL, HEIGHT_GLSL } from '../world/terrain.js';
import { WC_U, WC_GLSL, WT, WN, createCarveAtlas, setWaterHooks, grewTrees, waterDelta } from './watercarve.js';
import { REAL_U } from './realcity.js';
import { underBuildings } from './berms.js';
import { DEEP, crossings, edgeDist, bounds } from './watersrc.js';
import { waterfowl } from '../world/creatures.js';
import { waterOf } from '../world/ocean.js';
import { CLOUD_REFLECT_GLSL, cloudReflectU } from '../world/sky.js';

const W1 = WN + 1, TILE = 2048;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const h01 = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// inside a lake's rings (holes are islands)?
function inRings(R, x, z) {
	let c = false;
	for (const r of R) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
		const az = r[i + 1], bz = r[j + 1];
		if ((az > z) !== (bz > z) && x < (r[j] - r[i]) * (z - az) / (bz - az) + r[i]) c = !c;
	}
	return c;
}
// a ring's points kept to draw it within tol metres (Douglas-Peucker), as indices
function simplify(r, tol) {
	const n = r.length / 2;
	if (n < 8) return [...Array(n).keys()];
	const keep = new Uint8Array(n), st = [0, n - 1], t2 = tol * tol;
	keep[0] = keep[n - 1] = 1;
	while (st.length) {
		const b = st.pop(), a = st.pop(), ax = r[a * 2], az = r[a * 2 + 1], dx = r[b * 2] - ax, dz = r[b * 2 + 1] - az, l2 = dx * dx + dz * dz || 1;
		let far = -1, fd = t2;
		for (let k = a + 1; k < b; k++) {
			const t = Math.max(0, Math.min(1, ((r[k * 2] - ax) * dx + (r[k * 2 + 1] - az) * dz) / l2)), ex = r[k * 2] - ax - dx * t, ez = r[k * 2 + 1] - az - dz * t, d = ex * ex + ez * ez;
			if (d > fd) { fd = d; far = k; }
		}
		if (far >= 0) { keep[far] = 1; st.push(a, far, far, b); }
	}
	const out = [];
	for (let k = 0; k < n; k++) if (keep[k]) out.push(k);
	return out;
}
const KIND_NAME = ['Lake', 'Reservoir', 'Basin', 'Pond', 'Pool'];
// a stream's depth at the middle, by its width
const depthOf = (w) => (w < 3 ? 0.28 + w * 0.1 : w < 15 ? 0.45 + w * 0.06 : Math.min(5, 1.1 + w * 0.02));

// ---------- the look of the water ----------
// uLook: x 0 water, 1 ice, 2 lava; y how much more of the world's water tint than its sea
// takes (uWaterT, as world/ocean.js tints the sea: rgb over its brightness, a how much)
const COMMON = /* glsl */`
// (value noise on the wrapped hash: the stream's own coordinates run to kilometres)
float gvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }
// how near the edge of the water: 0 out in it, 1 at the ground (set before worldLook)
float gEdge = 0.0;
uniform float uTime, uNight, uSeason; uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor; uniform vec4 uLook, uWaterT;
vec3 skyIn(vec3 r, vec2 p){
	// (the clouds overhead in it too: world/sky.js)
	vec3 sky = skyReflect(r, uSkyZen, uSkyHor, uSunColor);
	// low down, the dark line of the hills and trees round the shore
	return mix(vec3(0.035, 0.05, 0.035) * (1.0 - uNight * 0.8), sky, smoothstep(0.03, 0.22, r.y + (vn(p * 0.02) - 0.5) * 0.1));
}
// the world's own water: frozen (the whole world's, or this stretch's), molten, or tinted as its sea is
vec4 worldLook(vec3 col, float a, vec2 p, float flow, float fres, float frozen){
	if (uLook.x > 1.5) {
		// lava, as the volcano's (world/terrain.js, the eruption): plates of dark cooling crust
		// drifting downstream, broken by cracks of melt, white-yellow deep in them and red where
		// it crusts over; the crust thin and the glow wide at the edges, where it meets the ground
		vec2 q = p * 0.32 + vec2(uTime * flow * 0.025, 0.0) + vec2(gvn(p * 0.05), gvn(p * 0.05 + 7.0)) * 2.5;
		vec2 qi = floor(q);
		float f1 = 9.0, f2 = 9.0;
		for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
			vec2 c = qi + vec2(float(x), float(y));
			vec2 o = 0.5 + 0.4 * sin(uTime * 0.05 + 6.28 * vec2(gh(c), gh(c + 31.0)));
			float d = length(q - c - o);
			if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
		}
		float heat = clamp(gvn(p * 0.09 - uTime * 0.02) * 0.7 + gEdge * 0.6, 0.0, 1.0);
		float crack = 1.0 - smoothstep(0.02, 0.1 + heat * 0.16, f2 - f1);
		float melt = gvn(p * 0.6 + vec2(uTime * 0.25, -uTime * 0.1));
		vec3 hot = mix(vec3(0.9, 0.18, 0.02), vec3(2.6, 1.3, 0.3), smoothstep(0.35, 0.85, melt * 0.6 + heat * 0.5)) * (1.0 + uNight * 0.6);
		// (the crust: near black, faintly red where it is thin, its plates' own relief)
		vec3 crust = mix(vec3(0.012, 0.009, 0.008), vec3(0.08, 0.02, 0.006), smoothstep(0.3, 0.9, heat)) * (0.7 + 0.5 * smoothstep(0.0, 0.5, f1));
		vec3 c = mix(crust, hot, max(crack, smoothstep(0.75, 1.0, gEdge) * 0.8));
		// (far off, where the cracks are finer than a pixel, their glowing average)
		float far = clamp(length(fwidth(q)) * 1.2 - 0.25, 0.0, 1.0);
		c = mix(c, mix(crust, hot, 0.22 + heat * 0.25), far);
		// (a soft edge where it laps the ground)
		return vec4(c, 1.0 - smoothstep(0.9, 1.0, gEdge));
	}
	if (uLook.x > 0.5 || frozen > 0.5) {
		// ice: pale and opaque, milky where it is thick, cracked, the sky faint in it
		float ck = smoothstep(0.02, 0.0, abs(vn(p * 0.25) - 0.5)) * 0.5 + smoothstep(0.015, 0.0, abs(vn(p * 0.9 + 3.0) - 0.5)) * 0.3;
		vec3 ice = mix(vec3(0.62, 0.74, 0.8), vec3(0.82, 0.9, 0.95), vn(p * 0.08)) * (1.0 - ck * 0.35);
		return vec4(mix(ice, col, fres * 0.35) * (1.0 - uNight * 0.8), 1.0);
	}
	col = mix(col, dot(col, vec3(0.299, 0.587, 0.114)) * uWaterT.rgb, min(0.8, uWaterT.a * uLook.y));
	return vec4(col, a);
}
`;
// the rocks in a creek: one in some cells of CELL metres (along, across), found the same way
// here and in the shader (a permutation that stays exact in single-precision floats)
const ROCK_CELL = [6, 2.5], ROCK_P = 0.2;
const pm = (x) => ((34 * x + 1) * x) % 289;
function rockAt(ca, cb) {
	const k1 = pm(pm(((ca % 289) + 289) % 289) + ((cb % 289) + 289) % 289);
	if (k1 >= 289 * ROCK_P) return null;
	const k2 = pm(k1 + 7), k3 = pm(k2 + 13), k4 = pm(k3 + 3);
	return { a: (ca + 0.2 + 0.6 * k2 / 289) * ROCK_CELL[0], c: (cb + 0.2 + 0.6 * k3 / 289) * ROCK_CELL[1], r: 0.22 + 0.4 * k4 / 289 };
}
const RIVER_VERT = /* glsl */`
attribute vec4 aC; attribute vec4 aF; attribute vec3 aT; attribute vec3 aR;
uniform float uSeason;
varying vec3 vW; varying vec2 vUv; varying vec4 vF; varying vec3 vT; varying vec3 vR; varying float vDist;
#include <fog_pars_vertex>
void main(){
	vec3 p = position;
	// (the small creeks that dry up run narrow by late summer)
	float low = aF.z * smoothstep(0.55, 0.95, uSeason) * 0.6;
	p.xz = mix(p.xz, aC.xy, low);
	vec4 w = modelMatrix * vec4(p, 1.0);
	// far off it rides up a little over the coarser ground drawn there
	float d = length(cameraPosition.xz - w.xz);
	w.y += 0.03 + clamp(d * 0.0024 - 0.1, 0.0, 5.0);
	vW = w.xyz; vUv = aC.zw; vF = aF; vT = aT; vR = aR; vDist = d;
	vec4 mvPosition = viewMatrix * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
// vF: speed, white water (by the fall), drying, width; vR: the ribbon's half-width, how built
// up the banks are, how rocky the bed is
const RIVER_FRAG = /* glsl */`
varying vec3 vW; varying vec2 vUv; varying vec4 vF; varying vec3 vT; varying vec3 vR; varying float vDist;
#include <fog_pars_fragment>
float pm(float x){ return mod((34.0 * x + 1.0) * x, 289.0); }
// the rock in a cell (as water.js places them): along, across, radius; z 0 if none
vec3 rockAt(vec2 c){
	float k1 = pm(pm(mod(c.x, 289.0)) + mod(c.y, 289.0));
	if (k1 >= 289.0 * ${ROCK_P}) return vec3(0.0);
	float k2 = pm(k1 + 7.0), k3 = pm(k2 + 13.0), k4 = pm(k3 + 3.0);
	return vec3((c + vec2(0.2 + 0.6 * k2 / 289.0, 0.2 + 0.6 * k3 / 289.0)) * vec2(${ROCK_CELL[0]}.0, ${ROCK_CELL[1]}), 0.22 + 0.4 * k4 / 289.0);
}
// the surface's ripples: streaks drawn out along the flow and two sets of small waves
// crossing it at an angle, each at its own scale and pace (no one of them a regular band)
float ripH(vec2 u, float t){
	vec2 a = vec2(u.x * 0.3 - t * 0.4, u.y * 0.9);
	vec2 b = vec2((u.x * 0.87 + u.y * 0.5) * 1.1 - t * 0.8, (u.y * 0.87 - u.x * 0.5) * 2.1 + 3.7);
	vec2 c = vec2((u.x * 0.8 - u.y * 0.6) * 2.3 - t * 1.1, (u.y * 0.8 + u.x * 0.6) * 4.1 - 5.3);
	return gvn(a) * 0.3 + gvn(b) * 0.4 + gvn(c) * 0.3;
}
void main(){
	vec2 T = normalize(vT.xy + vec2(1e-5, 0.0)), N = vec2(-T.y, T.x);
	// (along and across in metres from the middle: world x, z are too big for float noise this fine)
	float along = vUv.y, across = vUv.x * vR.x;
	vec2 u = vec2(along, across);
	float w = vF.w, foamK = vF.y, town = vR.y, rocky = vR.z;
	// the look by the reach: wide or in town, slow, dark and glassy; narrow in the country,
	// shallow and clear over its cobbles
	float wide = smoothstep(7.0, 26.0, w);
	float calm = clamp(max(wide, town * 0.85) * (1.0 - foamK), 0.0, 1.0);
	float clear = (1.0 - wide) * (1.0 - town * 0.75);
	float speed = vF.x * mix(1.0, 0.45, calm), t = uTime * speed;
	float e = 0.12, h0 = ripH(u, t), ha = ripH(u + vec2(e, 0.0), t), hc = ripH(u + vec2(0.0, e), t);
	// (gentle: steeper facets throw the bright sky back in big smears)
	float k = mix(0.13, 0.05, calm) + foamK * 0.25;
	vec2 g = vec2(ha - h0, hc - h0) / e * k;
	vec3 n = normalize(vec3(-(g.x * T.x + g.y * N.x), 1.0, -(g.x * T.y + g.y * N.y)));
	n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(150.0, 900.0, vDist)));
	vec3 v = normalize(cameraPosition - vW), r = reflect(-v, n);
	float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
	fres = mix(fres, min(1.0, fres * 1.25 + 0.06), calm);
	float depth = vW.y - groundUnder(vW.xz);
	float nearK = 1.0 - smoothstep(700.0, 1100.0, vDist);
	float deepK = mix(0.8, smoothstep(0.05, 1.4, depth), nearK);
	// the water's own colour: tea-dark and silty in town, green over the gravel out of it
	vec3 deep = mix(mix(vec3(0.03, 0.055, 0.045), vec3(0.045, 0.04, 0.03), town), vec3(0.05, 0.06, 0.035), foamK) * (1.0 - uNight * 0.85);
	// the bed seen through the shallows: rounded cobbles, the light fading with depth
	float px = length(fwidth(u));
	// (not out at the sides: there the water clears over the wet bank itself)
	float bedK = clear * nearK * (1.0 - smoothstep(0.1, 0.3, px)) * exp(-max(depth, 0.0) * 1.3) * (1.0 - smoothstep(0.55, 0.9, abs(vUv.x)));
	vec3 bed = vec3(0.34, 0.31, 0.25);
	if (bedK > 0.01) {
		vec2 bp = u * 3.1, bi = floor(bp);
		float f1 = 9.0, id = 0.0;
		for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
			vec2 c = bi + vec2(float(x), float(y)), o = vec2(gh(c), gh(c + 17.0)) * 0.8 + 0.1;
			float d = length(bp - c - o);
			if (d < f1) { f1 = d; id = gh(c + 41.0); }
		}
		vec3 stone = mix(mix(vec3(0.22, 0.2, 0.17), vec3(0.46, 0.42, 0.35), id), vec3(0.4, 0.3, 0.2), step(0.8, id) * 0.6);
		bed = mix(bed, stone * (0.55 + 0.45 * smoothstep(0.75, 0.25, f1)), 1.0 - smoothstep(0.1, 0.3, px));
	}
	vec3 seen = bed * exp(-max(depth, 0.0) * vec3(2.2, 1.2, 1.1)) * (1.0 - uNight * 0.85);
	vec3 body = mix(deep, seen, bedK);
	// the hills and trees round it darker in the still water's reflection
	vec3 sky = skyIn(r, vW.xz) * mix(vec3(0.8, 0.9, 0.85), vec3(0.62, 0.7, 0.64), calm);
	vec3 col = mix(body, sky, fres);
	col += uSunColor * min(1.5, pow(max(dot(r, uSunDir), 0.0), mix(300.0, 900.0, calm)) * mix(4.0, 7.0, calm)) * (1.0 - uNight);
	// white water: broken patches where it falls fast, streaked along the flow
	float fo = 0.0;
	if (foamK > 0.01) {
		float streak = gvn(vec2(along * 0.45 - t * 0.7, across * 1.9)) * 0.6 + gvn(vec2(along * 1.4 - t * 1.2, across * 4.3) + 9.0) * 0.4;
		float blot = smoothstep(0.45, 0.75, gvn(vec2(along * 0.07, across * 0.35) + 4.0) + foamK * 0.25);
		fo = foamK * blot * smoothstep(0.5, 0.78, streak) * mix(1.0, smoothstep(0.45, 0.75, gvn(u * vec2(2.5, 7.0) + 21.0)), 1.0 - smoothstep(20.0, 80.0, vDist)) * 0.85;
	}
	// riffles round the rocks, trailing downstream
	if (rocky > 0.02 && vDist < 450.0) {
		vec2 cp = floor(u / vec2(${ROCK_CELL[0]}.0, ${ROCK_CELL[1]}));
		float rf = 0.0, sc = clamp(w / 6.0, 0.5, 1.0);
		for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
			vec3 R = rockAt(cp + vec2(float(x), float(y)));
			if (R.z < 0.01) continue;
			vec2 rel = u - R.xy; float rr = R.z * sc * 1.3;
			float dd = length(vec2(rel.x > 0.0 ? rel.x / (2.5 + speed) : rel.x, rel.y));
			// (the wake behind it stronger than the pillow in front)
			rf = max(rf, smoothstep(rr * 1.8, rr * 1.2, dd) * smoothstep(rr * 0.7, rr * 1.1, dd) * (rel.x > 0.0 ? 1.0 : 0.45));
		}
		// (broken up, and only over the shallow stones that come near the top)
		rf *= smoothstep(0.42, 0.72, gvn(vec2(along * 1.3 - uTime * speed * 1.4, across * 5.1)) * 0.6 + gvn(u * 3.7 + 2.0) * 0.4 + 0.1) * rocky * nearK * (1.0 - smoothstep(0.45, 0.9, depth));
		// (as flecks and threads of white on the dark water, not sheets of it)
		float fleck = smoothstep(0.55, 0.8, gvn(vec2(along * 3.5 - uTime * speed * 2.0, across * 9.0) + 13.0));
		fo = max(fo, rf * fleck * 0.55);
	}
	// a soft line of foam where a quick creek laps its banks (none on the still town water)
	float side = nearK * smoothstep(0.5, 0.8, abs(vUv.x));
	float lap = smoothstep(0.0, 0.03, depth) * (1.0 - smoothstep(0.04, 0.14, depth)) * side * (1.0 - calm) * smoothstep(0.4, 0.75, gvn(u * vec2(1.4, 4.0) - vec2(uTime * speed, 0.0)));
	fo = max(fo, lap * 0.45);
	col = mix(col, vec3(0.85, 0.88, 0.86) * (1.0 - uNight * 0.8), clamp(fo, 0.0, 0.9));
	float a = clamp(0.3 + deepK * 0.62 + fres * 0.25 + fo, 0.0, 0.96);
	a = mix(a, 0.94, bedK);
	gEdge = max(smoothstep(0.55, 1.0, abs(vUv.x)), 1.0 - smoothstep(0.0, 0.3, depth) * nearK - (1.0 - nearK));
	gl_FragColor = worldLook(col, a, u, speed, fres, vT.z);
	// (the shallows along the sides clear to nothing over the wet bank, so no seam shows
	// where the water meets the ground; the foam stays a little longer)
	gl_FragColor.a *= mix(1.0, max(smoothstep(0.0, 0.2, depth), min(fo, 1.0) * smoothstep(0.0, 0.02, depth)), side);
	gl_FragColor.a *= 1.0 - smoothstep(0.82, 1.0, abs(vUv.x));
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;
const LAKE_VERT = /* glsl */`
varying vec3 vW; varying vec2 vL; varying float vDist;
#include <fog_pars_vertex>
void main(){
	vec4 w = modelMatrix * vec4(position, 1.0);
	vW = w.xyz; vL = position.xz; vDist = length(cameraPosition.xz - w.xz);
	vec4 mvPosition = viewMatrix * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const LAKE_FRAG = /* glsl */`
uniform vec3 uTint; uniform float uLevel, uIce;
varying vec3 vW; varying vec2 vL; varying float vDist;
#include <fog_pars_fragment>
float wave(vec2 p){ return vn(p * 0.35 + uTime * vec2(0.05, 0.03)) * 0.6 + vn(p * 1.1 - uTime * vec2(0.04, 0.07)) * 0.3 + vn(p * 3.3 + uTime * vec2(0.11, -0.05)) * 0.1; }
void main(){
	// (the ripples on the lake's own coordinates: the world's are too big for noise this fine)
	vec2 p = vW.xz, pl = vL; float e = 0.15;
	// wind on the water: patches of ripple and of calm
	float wind = 0.5 + 0.5 * smoothstep(0.3, 0.7, vn(p * 0.004 + uTime * 0.01));
	vec3 n = normalize(vec3(wave(pl - vec2(e, 0.0)) - wave(pl + vec2(e, 0.0)), 2.0 * e / (0.08 * wind), wave(pl - vec2(0.0, e)) - wave(pl + vec2(0.0, e))));
	n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(300.0, 2500.0, vDist)));
	vec3 v = normalize(cameraPosition - vW), r = reflect(-v, n);
	float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
	float depth = uLevel - groundUnder(p);
	float nearK = 1.0 - smoothstep(700.0, 1100.0, vDist);
	float deepK = mix(1.0, smoothstep(0.0, 2.2, depth), nearK);
	vec3 deep = uTint * (1.0 - uNight * 0.85);
	vec3 col = mix(deep, skyIn(r, p) * mix(vec3(0.62, 0.86, 0.7), vec3(0.78, 0.88, 0.92), uTint.b * 4.0), fres);
	col += uSunColor * (pow(max(dot(r, uSunDir), 0.0), 600.0) * 6.0 + pow(max(dot(r, uSunDir), 0.0), 40.0) * 0.12) * (1.0 - uNight);
	// a lace of foam where the water laps the shore, thinning to nothing at the line itself
	float lace = smoothstep(0.0, 0.03, depth) * (1.0 - smoothstep(0.05, 0.2, depth)) * smoothstep(0.45, 0.75, vn(pl * 1.7 + uTime * 0.2)) * nearK;
	col = mix(col, vec3(0.82, 0.84, 0.8) * (1.0 - uNight * 0.8), lace * 0.5);
	float a = clamp(0.3 + deepK * 0.66 + fres * 0.2 + lace * 0.4, 0.0, 0.97);
	gEdge = (1.0 - smoothstep(0.0, 0.5, depth)) * nearK;
	gl_FragColor = worldLook(col, a, pl, 0.2, fres, uIce);
	// (the shallows clear to nothing over the wet shore, so no seam shows at the water's edge)
	gl_FragColor.a *= mix(1.0, max(smoothstep(0.0, 0.25, depth), lace * smoothstep(0.0, 0.02, depth)), nearK * (1.0 - uIce));
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;

// round lava: the heat's glow thrown on the ground, laid over it (the ground's height read
// in the vertex shader), fading out from the edge
const HALO_VERT = /* glsl */`
attribute float aK;
varying float vK; varying vec2 vP;
void main(){
	vec4 w = modelMatrix * vec4(position, 1.0);
	w.y = groundUnder(w.xz) + 0.15;
	vK = aK; vP = w.xz;
	gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HALO_FRAG = /* glsl */`
varying float vK; varying vec2 vP;
void main(){
	float g = pow(1.0 - vK, 2.2) * (0.7 + 0.3 * gvn(vP * 0.08 + uTime * 0.15));
	gl_FragColor = vec4(vec3(1.0, 0.3, 0.05) * g * (0.6 + uNight * 0.9), 1.0);
}`;

// opts: heightAt (the ground as walked, CPU), ground (the road's level for a deck, as walked),
// mode 'bay' (the Bay Area's survey, carved round you) or 'island' (a planet's height map,
// carved already), sources, real (the mapped roads, for decks), roads (x, z, r) otherwise,
// townK (x, z) 0 wild .. 1 built up, trees (plant the banks), look { kind, tint, mix },
// island (for its height map uniforms), skip (x, z): no bank trees there
export function createWater(scene, shared, opts = {}) {
	const { isPhone = false, heightAt, ground = null, real = null, sources = [], mode = 'bay', trees = mode === 'bay', look = null, island = null } = opts;
	const townK = opts.townK || (() => 0);
	const carve = mode === 'bay';
	const root = new THREE.Group();
	root.name = 'water';
	scene.add(root);
	const RANGE = isPhone ? { data: 4600, near: 1800, far: 6500, carve: 720, slots: 49, budget: 3.5 } : { data: 7200, near: 2600, far: 9500, carve: 1100, slots: 100, budget: 5 };
	const S = { lakes: [], lakeGrid: new Map(), tiles: new Map(), ready: false, jobs: [], plannedAt: -1e9, px: 1e9, pz: 1e9, srcV: '', stats: { longest: 0, slowest: 0, carved: 0, built: 0, spikes: {} } };
	const atlas = carve ? createCarveAtlas(RANGE.slots) : null;
	const lookU = { value: new THREE.Vector4(look?.kind === 'lava' ? 2 : look?.kind === 'ice' ? 1 : 0, look ? 1.6 : 0, 0, 0) }, tintU = { value: waterOf(shared.planet) };
	const uNight = { value: 0 };
	// the ground under the water, as it is drawn
	const GROUND = carve ? BAY_GLSL + WC_GLSL + 'float groundUnder(vec2 w){ return bayHeight(w) + wcAt(w).r * wcK(w); }\n' : HEIGHT_GLSL + 'float groundUnder(vec2 w){ return heightAt(w); }\n';
	const groundU = carve ? { ...shared.bayU, ...WC_U } : { uHeight: { value: shared.heightTex }, uHalf: { value: island?.half || 1300 }, uCell: { value: island?.cell || 1 }, uN: { value: island?.N || 2 } };
	const uniforms = () => ({ ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...groundU, uTime: shared.uTime, uNight, uSeason: REAL_U.uSeason, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor, uLook: lookU, uWaterT: tintU, ...cloudReflectU(shared) });
	const FRAG_HEAD = GROUND + NOISE_GLSL + CLOUD_REFLECT_GLSL + COMMON;
	const riverMat = new THREE.ShaderMaterial({ uniforms: uniforms(), vertexShader: RIVER_VERT, fragmentShader: FRAG_HEAD + RIVER_FRAG, fog: true, transparent: look?.kind !== 'ice', depthWrite: false });
	const haloMat = look?.kind === 'lava' ? new THREE.ShaderMaterial({ uniforms: uniforms(), vertexShader: GROUND + HALO_VERT, fragmentShader: NOISE_GLSL + CLOUD_REFLECT_GLSL + COMMON + HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }) : null;
	// a band of the glow along a line of points (x, z pairs), out to one side by `out` metres from `off`
	const HALO_K = [0, 0.2, 0.45, 1];
	function haloBand(pos, ak, idx, P, off, out, sd, closed) {
		const n = P.length / 2, base = pos.length / 3;
		for (let k = 0; k < n; k++) {
			const a = closed ? (k - 1 + n) % n : Math.max(0, k - 1), b = closed ? (k + 1) % n : Math.min(n - 1, k + 1);
			let tx = P[b * 2] - P[a * 2], tz = P[b * 2 + 1] - P[a * 2 + 1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
			const o = typeof off === 'number' ? off : off[k];
			for (const f of HALO_K) { const d = o + f * out; pos.push(P[k * 2] + tz * d * sd, 0, P[k * 2 + 1] - tx * d * sd); ak.push(f); }
		}
		const R = HALO_K.length;
		for (let k = 0; k + 1 < (closed ? n + 1 : n); k++) for (let r = 0; r + 1 < R; r++) {
			const p = base + k * R + r, q = base + ((k + 1) % n) * R + r;
			idx.push(p, q, p + 1, p + 1, q, q + 1, p, p + 1, q, p + 1, q + 1, q);
		}
	}
	function haloMesh(pos, ak, idx, x, z) {
		if (!idx.length) return null;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('aK', new THREE.Float32BufferAttribute(ak, 1));
		g.setIndex(idx);
		g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2500);
		const m = new THREE.Mesh(g, haloMat);
		m.position.set(x, 0, z); m.renderOrder = 3;
		root.add(m);
		return m;
	}
	const lakeMats = new Map();
	const TINTS = [[0.012, 0.045, 0.04], [0.01, 0.04, 0.05], [0.03, 0.05, 0.03], [0.02, 0.05, 0.03], [0.02, 0.06, 0.07]];
	function lakeMat(L) {
		const m = new THREE.ShaderMaterial({ uniforms: { ...uniforms(), uTint: { value: new THREE.Vector3(...TINTS[L.kind]) }, uLevel: { value: L.level }, uIce: { value: L.ice ? 1 : 0 } }, vertexShader: LAKE_VERT, fragmentShader: FRAG_HEAD + LAKE_FRAG, fog: true, transparent: riverMat.transparent, depthWrite: true });
		lakeMats.set(L, m);
		return m;
	}

	// ---------- the lakes of every source, by 1 km cell ----------
	const LCELL = 1024, lkey = (i, j) => i * 100003 + j;
	// (only the sources that changed are looked at again: there are thousands of lakes)
	const had = new Map();
	let lakeIds = 0;
	const cellsOf = (L, fn) => { for (let gi = Math.floor(L.x0 / LCELL); gi <= Math.floor(L.x1 / LCELL); gi++) for (let gj = Math.floor(L.z0 / LCELL); gj <= Math.floor(L.z1 / LCELL); gj++) fn(lkey(gi, gj)); };
	// (the new ones are put in a few milliseconds' worth a frame: the Bay's thousands come at once)
	const addQ = [], live = (L) => { for (const set of had.values()) if (set.has(L)) return true; return false; };
	function regrid(changed) {
		let gone = false;
		for (const src of changed) {
			const now = new Set(src.lakes), old = had.get(src) || new Set();
			for (const L of old) {
				if (now.has(L) || !L.gridded) continue;
				// (one gone: its water, its birds and its carving)
				cellsOf(L, (k) => { const g = S.lakeGrid.get(k), q = g ? g.indexOf(L) : -1; if (q >= 0) g.splice(q, 1); });
				dropLake(L); dropFlock(L); L.gridded = false; gone = true;
				recarve(L);
			}
			for (const L of now) if (!old.has(L)) addQ.push(L);
			had.set(src, now);
		}
		if (gone) { S.lakes = S.lakes.filter(live); S.noCarve.clear(); }
	}
	// (the squares carved round a lake that came or went, carved again)
	function recarve(L) { if (atlas) for (const t of [...atlas.tiles()]) if (L.x1 > t.i * WT - 12 && L.x0 < (t.i + 1) * WT + 12 && L.z1 > t.j * WT - 12 && L.z0 < (t.j + 1) * WT + 12) atlas.drop(t.i, t.j); }
	function putLakes(ms) {
		if (!addQ.length) return;
		const t0 = performance.now();
		while (addQ.length && performance.now() - t0 < ms) {
			for (let n = 0; n < 50 && addQ.length; n++) {
				const L = addQ.pop();
				if (L.gridded || !live(L)) continue;
				if (L.area === undefined) bounds(L);
				if (L.id === undefined) L.id = lakeIds++;
				cellsOf(L, (k) => { let g = S.lakeGrid.get(k); if (!g) S.lakeGrid.set(k, g = []); g.push(L); });
				L.gridded = true;
				S.lakes.push(L);
				recarve(L);
			}
		}
		if (!addQ.length) { S.noCarve.clear(); S.plannedAt = -1e9; }
	}
	const lakesNear = (x0, z0, x1, z1) => {
		const out = new Set();
		for (let gi = Math.floor(x0 / LCELL); gi <= Math.floor(x1 / LCELL); gi++) for (let gj = Math.floor(z0 / LCELL); gj <= Math.floor(z1 / LCELL); gj++) for (const L of S.lakeGrid.get(lkey(gi, gj)) || []) if (L.x1 >= x0 && L.x0 <= x1 && L.z1 >= z0 && L.z0 <= z1) out.add(L);
		return out;
	};
	function lakeAt(x, z) {
		for (const L of S.lakeGrid.get(lkey(Math.floor(x / LCELL), Math.floor(z / LCELL))) || []) if (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1 && inRings(L.rings, x, z)) return L;
		return null;
	}

	// ---------- the rivers, a 2 km tile at a time ----------
	const tkey = (i, j) => i + ',' + j;
	function* loadTile(T) {
		for (const src of sources) {
			const lines = yield* src.tile(T.i, T.j);
			for (const q of lines || []) addLine(T, q.cls, q.int, q.name, q.P);
		}
	}
	function addLine(T, cls, int, name, P) {
		const n = P.length, x = new Float64Array(n), z = new Float64Array(n), lv = new Float32Array(n), w = new Float32Array(n), s = new Float32Array(n), ice = new Uint8Array(n);
		let x0 = 1e18, z0 = 1e18, x1 = -1e18, z1 = -1e18, wm = 0;
		P.forEach((q, k) => { ice[k] = q[4] ? 1 : 0; x[k] = q[0]; z[k] = q[1]; lv[k] = q[2]; w[k] = Math.max(0.8, q[3]); wm = Math.max(wm, w[k]); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); if (k) s[k] = s[k - 1] + Math.hypot(q[0] - P[k - 1][0], q[1] - P[k - 1][1]); });
		const mid = P[n >> 1], town = townK(mid[0], mid[1]);
		// a flood channel in town is poured concrete, its water a shallow sheet 2 m below the
		// street; a natural creek in town runs a little deeper between its banks
		const conc = carve && (cls === 'drain' || cls === 'canal') && town > 0.5;
		if (carve) {
			for (let k = 0; k < n; k++) lv[k] -= conc ? 2.0 : 0.15 + 0.9 * townK(x[k], z[k]) * Math.min(1, w[k] / 4);
			for (let k = 1; k < n; k++) lv[k] = Math.min(lv[k], lv[k - 1]);
		}
		// (the country's creeks and rivers have rocks and snags in them; a world's lava or ice none)
		const rocky = !conc && (cls === 'stream' || cls === 'river') && lookU.value.x < 0.5;
		const L = { cls, int, name, n, x, z, lv, w, s, ice, conc, town, rocky, x0, z0, x1, z1, reach: wm / 2 + (conc ? 12 : 26) };
		const id = T.lines.push(L) - 1;
		// the segments by 64 m cell, for finding the water at a point
		for (let k = 0; k + 1 < n; k++) {
			const r = w[k] / 2 + 4;
			for (let gi = Math.floor((Math.min(x[k], x[k + 1]) - r) / 64); gi <= Math.floor((Math.max(x[k], x[k + 1]) + r) / 64); gi++) for (let gj = Math.floor((Math.min(z[k], z[k + 1]) - r) / 64); gj <= Math.floor((Math.max(z[k], z[k + 1]) + r) / 64); gj++) {
				const gk = gi * 100003 + gj; let g = T.grid.get(gk); if (!g) T.grid.set(gk, g = []); g.push(id, k);
			}
		}
	}
	// ---------- the rocks and fallen logs in a country creek's bed ----------
	const rockyAt = (L, k) => (L.rocky && !L.ice[k] && L.w[k] >= 1.5 && L.w[k] <= 22 && townK(L.x[k], L.z[k]) < 0.3 ? 1 : 0);
	// the bed under a point of the stream, as it is carved (or lower, where the ground is)
	const bedAt = (x, z, lv, w, c) => Math.min(heightAt(x, z), lv - 0.06 - (carve ? depthOf(w) : 0.3 + w * 0.06) * Math.pow(Math.max(0, 1 - (2 * c / w) ** 2), 0.6));
	function strewBed(L, rocks, logs) {
		const [CA, CB] = ROCK_CELL;
		for (let k = 0; k + 1 < L.n; k++) {
			const s0 = L.s[k], s1 = L.s[k + 1], len = s1 - s0;
			if (len < 0.5 || !rockyAt(L, k) && !rockyAt(L, k + 1)) continue;
			const ux = (L.x[k + 1] - L.x[k]) / len, uz = (L.z[k + 1] - L.z[k]) / len, nx = -uz, nz = ux;
			const wm = Math.max(L.w[k], L.w[k + 1]), J = Math.ceil(wm / 2 / CB) + 1;
			for (let ca = Math.floor(s0 / CA); ca <= Math.floor(s1 / CA); ca++) for (let cb = -J; cb <= J; cb++) {
				const R = rockAt(ca, cb);
				if (!R || R.a < s0 || R.a >= s1) continue;
				const f = (R.a - s0) / len;
				// (as the shader sees it: rocky by the nearer end)
				if (!rockyAt(L, f < 0.5 ? k : k + 1)) continue;
				const w = L.w[k] + (L.w[k + 1] - L.w[k]) * f, r = R.r * Math.min(1, Math.max(0.5, w / 6));
				if (Math.abs(R.c) > w / 2 - r * 0.6) continue;
				const x = L.x[k] + ux * (R.a - s0) + nx * R.c, z = L.z[k] + uz * (R.a - s0) + nz * R.c, lv = L.lv[k] + (L.lv[k + 1] - L.lv[k]) * f;
				rocks.push(x, bedAt(x, z, lv, w, R.c) + r * 0.45, z, r, h01(x, z));
			}
			// now and then a fallen trunk from the bank, lying out into the stream downstream
			for (let ca = Math.floor(s0 / 70); ca <= Math.floor(s1 / 70); ca++) {
				const hh = h01(ca * 0.37, L.x[0] * 0.01 + L.z[0] * 0.013), a = (ca + 0.5) * 70;
				if (hh > 0.3 || a < s0 || a >= s1) continue;
				const f = (a - s0) / len, w = L.w[k] + (L.w[k + 1] - L.w[k]) * f;
				if (w < 2.5 || w > 20 || !rockyAt(L, f < 0.5 ? k : k + 1)) continue;
				const sd = hh < 0.15 ? 1 : -1, th = 0.5 + hh * 1.6, lg = Math.min(w * 0.75 + 1, 3 + hh * 18), lv = L.lv[k] + (L.lv[k + 1] - L.lv[k]) * f;
				const dx = ux * Math.cos(th) - nx * sd * Math.sin(th), dz = uz * Math.cos(th) - nz * sd * Math.sin(th);
				const bx = L.x[k] + ux * (a - s0) + nx * sd * (w / 2 + 0.8), bz = L.z[k] + uz * (a - s0) + nz * sd * (w / 2 + 0.8);
				logs.push(bx + dx * lg / 2, lv + 0.02, bz + dz * lg / 2, lg, 0.16 + hh * 0.4, Math.atan2(-dz, dx), -Math.atan2(0.35, lg));
			}
		}
	}
	const rockG = new THREE.IcosahedronGeometry(1, 1), logG = new THREE.CylinderGeometry(1, 1, 1, 7, 1).rotateZ(Math.PI / 2);
	const bedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
	function bedMesh(rocks, logs, cx, cz) {
		const out = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
		const make = (geo, n) => { const im = new THREE.InstancedMesh(geo.clone(), bedMat, n); im.position.set(cx, 0, cz); im.receiveShadow = true; im.visible = false; root.add(im); out.push(im); return im; };
		if (rocks.length) {
			const im = make(rockG, rocks.length / 5);
			for (let i = 0; i < rocks.length; i += 5) {
				const r = rocks[i + 3], hh = rocks[i + 4];
				e.set(hh * 3, hh * 17, hh * 7); q.setFromEuler(e); p.set(rocks[i] - cx, rocks[i + 1], rocks[i + 2] - cz); sc.set(r * 1.3, r, r * 1.15);
				im.setMatrixAt(i / 5, m.compose(p, q, sc));
				// (grey and brown, dark where wet; in linear light)
				c.setRGB(0.045 + hh * 0.05, 0.042 + hh * 0.04, 0.035 + hh * 0.03); im.setColorAt(i / 5, c);
			}
		}
		if (logs.length) {
			const im = make(logG, logs.length / 7);
			for (let i = 0; i < logs.length; i += 7) {
				e.set(0, logs[i + 5], logs[i + 6], 'YZX'); q.setFromEuler(e); p.set(logs[i] - cx, logs[i + 1], logs[i + 2] - cz); sc.set(logs[i + 3], logs[i + 4], logs[i + 4]);
				im.setMatrixAt(i / 7, m.compose(p, q, sc));
				c.setRGB(0.04, 0.028, 0.018); im.setColorAt(i / 7, c);
			}
		}
		for (const im of out) im.computeBoundingSphere();
		return out;
	}
	// the water's half-width (as it runs now) at a point of a line
	const lowK = (L) => (L.int && L.w[0] < 6 ? sm(0.55, 0.95, REAL_U.uSeason.value) * 0.6 : 0);
	const hwOf = (L, w) => (L.conc ? Math.max(0.7, w * 0.26) : w / 2) * (1 - lowK(L));
	// the nearest stream's water at a point: { L, k, t, d, level, hw } or null
	function riverAt(x, z, pad = 0) {
		const T = S.tiles.get(tkey(Math.floor(x / TILE), Math.floor(z / TILE)));
		if (!T?.lines.length) return null;
		const g = T.grid.get(Math.floor(x / 64) * 100003 + Math.floor(z / 64));
		if (!g) return null;
		let best = null;
		for (let q = 0; q < g.length; q += 2) {
			const L = T.lines[g[q]], k = g[q + 1];
			const ax = L.x[k], az = L.z[k], dx = L.x[k + 1] - ax, dz = L.z[k + 1] - az, l2 = dx * dx + dz * dz || 1;
			const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
			const hw = hwOf(L, L.w[k] + (L.w[k + 1] - L.w[k]) * t);
			if (d < hw + pad && (!best || d - hw < best.d - best.hw)) best = { L, k, t, d, hw, level: L.lv[k] + (L.lv[k + 1] - L.lv[k]) * t };
		}
		return best;
	}
	// the water's surface at a point (null on dry land, in lava or on ice)
	function waterAt(x, z) {
		if (!S.ready || lookU.value.x > 0.5) return null;
		const L = lakeAt(x, z);
		if (L) return L.ice ? null : L.level;
		const r = riverAt(x, z);
		return r && !r.L.ice[r.k] ? r.level : null;
	}
	function inWater(x, z) { return !!lakeAt(x, z) || !!riverAt(x, z, 1.2); }
	// where a stream falls: a steep step in its bed (a cascade, a chute), or its last drop
	// into a lake below; each { x, y, z } at its foot, { lx, ly, lz } at its lip (world/spray.js)
	function fallsOf(T) {
		if (T.falls) return T.falls;
		const out = [];
		for (const L of T.lines) {
			if (L.conc) continue;
			let last = -1e9;
			for (let k = 0; k + 1 < L.n; k++) {
				let j = k + 1;
				while (j + 1 < L.n && L.s[j] - L.s[k] < 10) j++;
				const run = Math.max(1, L.s[j] - L.s[k]), drop = L.lv[k] - L.lv[j];
				if (drop < 0.8 || drop / run < 0.09 || L.s[j] - last < 30 || L.ice[j]) continue;
				last = L.s[j];
				out.push({ x: L.x[j], y: L.lv[j], z: L.z[j], lx: L.x[k], ly: L.lv[k], lz: L.z[k], drop, w: L.w[j] });
				k = j;
			}
			const e = L.n - 1, M = e > 0 ? lakeAt(L.x[e], L.z[e]) : null;
			if (M && !M.ice && L.lv[e - 1] - M.level > 0.8) out.push({ x: L.x[e], y: M.level, z: L.z[e], lx: L.x[e - 1], ly: L.lv[e - 1], lz: L.z[e - 1], drop: L.lv[e - 1] - M.level, w: L.w[e] });
		}
		if (T.built) T.falls = out;
		return out;
	}
	function falls(x, z, r) {
		if (!S.ready || lookU.value.x > 0.5) return [];
		const out = [];
		for (const T of S.tiles.values()) {
			if (Math.max(Math.abs((T.i + 0.5) * TILE - x), Math.abs((T.j + 0.5) * TILE - z)) > TILE / 2 + r) continue;
			for (const f of fallsOf(T)) if (Math.hypot(f.x - x, f.z - z) < r) out.push(f);
		}
		return out;
	}

	// ---------- a tile's ribbons of water, and the trees along its banks ----------
	function* buildTile(T) {
		yield* loadTile(T);
		const cx = (T.i + 0.5) * TILE, cz = (T.j + 0.5) * TILE;
		const lines = [...T.lines.keys()].sort((a, b) => T.lines[b].w[0] - T.lines[a].w[0]);
		const pos = [], aC = [], aF = [], aT = [], aR = [], idx = [], rocks = [], logs = [];
		let wide = 0, t0 = performance.now();
		// (where a stream rises or sinks away its water narrows to a point, not a square end;
		// not where it runs on into another, a lake, the sea or the next tile)
		const joined = (L, k) => {
			const x = L.x[k], z = L.z[k], r = L.w[k] + 2;
			if (L.lv[k] < 1 || lakeAt(x, z) || Math.min(x - T.i * TILE, (T.i + 1) * TILE - x, z - T.j * TILE, (T.j + 1) * TILE - z) < 3) return true;
			const g = T.grid.get(Math.floor(x / 64) * 100003 + Math.floor(z / 64)) || [];
			for (let q = 0; q < g.length; q += 2) {
				const M = T.lines[g[q]], m = g[q + 1];
				if (M === L) continue;
				const ax = M.x[m], az = M.z[m], dx = M.x[m + 1] - ax, dz = M.z[m + 1] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
				if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r + M.w[m] / 2) return true;
			}
			return false;
		};
		for (const id of lines) {
			const L = T.lines[id], n = L.n, base = pos.length / 3;
			const dry = L.int && L.w[0] < 6 ? 1 : 0;
			const tip0 = L.conc || joined(L, 0) ? 1 : 0.3, tip1 = L.conc || joined(L, n - 1) ? 1 : 0.3;
			for (let k = 0; k < n; k++) {
				const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
				let tx = L.x[b] - L.x[a], tz = L.z[b] - L.z[a]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
				// (the mitre at a bend, not too long)
				let mk = 1;
				if (k > 0 && k < n - 1) { const ux = L.x[k] - L.x[k - 1], uz = L.z[k] - L.z[k - 1], ul = Math.hypot(ux, uz) || 1; mk = 1 / Math.max(0.5, (ux / ul) * tx + (uz / ul) * tz); }
				const w = L.w[k], hw = (L.conc ? Math.max(0.7, w * 0.26) + 0.25 : w / 2 + 0.3 + 0.07 * w) * mk * (k === 0 ? tip0 : k === n - 1 ? tip1 : 1);
				const y = L.lv[k];
				const seg = k < n - 1 ? k : k - 1, sl = Math.max(0, (L.lv[seg] - L.lv[seg + 1]) / Math.max(1, L.s[seg + 1] - L.s[seg]));
				const speed = L.conc ? 0.9 : Math.min(2.4, 0.25 + Math.sqrt(sl) * 9), foam = L.conc ? 0.05 : sm(0.03, 0.1, sl) * (1 - sm(10, 30, w) * 0.6);
				const tk = L.conc ? 1 : townK(L.x[k], L.z[k]), rk = rockyAt(L, k);
				for (const sd of [-1, 0, 1]) {
					pos.push(L.x[k] - tz * hw * sd - cx, y, L.z[k] + tx * hw * sd - cz);
					aC.push(L.x[k] - cx, L.z[k] - cz, sd, L.s[k]);
					aF.push(speed, foam, dry, w);
					aT.push(tx, tz, L.ice[k]);
					aR.push(hw, tk, rk);
				}
			}
			if (L.rocky) strewBed(L, rocks, logs);
			// (wound counter-clockwise seen from above)
			for (let k = 0; k + 1 < n; k++) { const p = base + k * 3, q = p + 3; idx.push(p, p + 1, q, p + 1, q + 1, q, p + 1, p + 2, q + 1, p + 2, q + 2, q + 1); }
			if (L.w[0] >= 5) wide = idx.length;
			if (performance.now() - t0 > 3) { yield; t0 = performance.now(); }
		}
		if (S.tiles.get(tkey(T.i, T.j)) !== T) return;
		if (idx.length) {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 4));
			g.setAttribute('aF', new THREE.Float32BufferAttribute(aF, 4));
			g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 3));
			g.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 3));
			g.setIndex(pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
			g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, pos[1], 0), 1600);
			const m = new THREE.Mesh(g, riverMat);
			m.position.set(cx, 0, cz);
			m.renderOrder = 2;
			root.add(m);
			T.mesh = m; T.wideIdx = wide; T.allIdx = idx.length;
		}
		if (haloMat) {
			const hp = [], ak = [], hi = [];
			for (const L of T.lines) {
				const P = [];
				for (let k = 0; k < L.n; k++) P.push(L.x[k] - cx, L.z[k] - cz);
				const off = [...L.w].map((w) => w / 2);
				for (const sd of [-1, 1]) haloBand(hp, ak, hi, P, off, 7 + L.w[0] * 0.4, sd, false);
			}
			T.halo = haloMesh(hp, ak, hi, cx, cz);
		}
		yield;
		if ((rocks.length || logs.length) && S.tiles.get(tkey(T.i, T.j)) === T) T.bed = bedMesh(rocks, logs, cx, cz);
		if (trees) yield* plantBanks(T);
		T.built = true;
		S.stats.built++;
	}
	// willows and alders at the water, sycamores in the inland valleys, bay laurel, and in the
	// fog belt's canyons redwoods; only on wild banks (not in town, not in a lake)
	function* plantBanks(T) {
		let t0 = performance.now();
		for (const L of T.lines) {
			if (performance.now() - t0 > 3) { yield; t0 = performance.now(); }
			if (L.conc || L.cls === 'ditch' || L.cls === 'tidal' || L.w[0] > 60) continue;
			for (let k = 0; k + 1 < L.n; k++) {
				const ax = L.x[k], az = L.z[k], dx = L.x[k + 1] - ax, dz = L.z[k + 1] - az, len = Math.hypot(dx, dz);
				if (len < 1) continue;
				const nx = -dz / len, nz = dx / len;
				for (let s = h01(ax, az) * 8; s < len; s += 7 + h01(s, ax) * 5) {
					for (const sd of [-1, 1]) {
						const r = h01(ax + s * 1.3 + sd, az - s * 0.7);
						if (r > (L.w[k] < 12 ? 0.78 : 0.62)) continue;
						const f = s / len, bx = ax + dx * f, bz = az + dz * f, w = L.w[k] + (L.w[k + 1] - L.w[k]) * f, lv = L.lv[k] + (L.lv[k + 1] - L.lv[k]) * f;
						// on the land at the top of the bank (where the channel's cut ends)
						const g0 = heightAt(bx + nx * sd * (w / 2 + 3), bz + nz * sd * (w / 2 + 3));
						// (the bank is cut back at its slope as carveTile cuts it, out to its reach)
						const top = Math.min(24, Math.max(0, g0 - lv) / (w < 6 ? 0.95 : 0.6));
						// (a narrow creek's willows and alders close over it)
						const off = w / 2 + (w < 12 ? 1.1 + h01(r, s) * 3 : 1.6 + h01(r, s) * 5) + top;
						const x = bx + nx * sd * off, z = bz + nz * sd * off;
						if (townK(x, z) > 0.2 || lakeAt(x, z) || opts.skip?.(x, z)) continue;
						const fog = 1 - sm(22000, 58000, x), hh = h01(x * 0.13, z * 0.17);
						let t;
						if (fog > 0.6 && lv < 450 && hh < 0.5) t = { h: 30 + hh * 40, cone: true, sp: 2, col: [0.12, 0.19, 0.09] };                 // redwood
						else if (off < w / 2 + 4 + top && hh < 0.55) t = { h: 5 + hh * 5, sp: 0, col: [0.34, 0.42, 0.22] };                          // arroyo willow
						else if (hh < 0.8) t = { h: 11 + hh * 9, sp: 0, col: fog > 0.5 ? [0.16, 0.26, 0.1] : [0.2, 0.28, 0.12] };                   // white alder
						else if (fog < 0.5) t = { h: 13 + hh * 9, sp: 0, col: [0.36, 0.4, 0.24] };                                                      // western sycamore
						else t = { h: 9 + hh * 7, sp: 1, col: [0.14, 0.21, 0.09] };                                                                        // California bay
						const j = 0.9 + h01(z, x) * 0.2;
						t.col = t.col.map((c) => c * j);
						T.trees.push({ x, z, ...t });
					}
				}
			}
		}
		if (T.trees.length) grew = true;
	}
	let grew = false, grewAt = 0, carvedSince = false;
	function treesNear(x, z, r) {
		const out = [];
		for (const T of S.tiles.values()) {
			if (!T.trees.length || Math.abs((T.i + 0.5) * TILE - x) > r + 1024 || Math.abs((T.j + 0.5) * TILE - z) > r + 1024) continue;
			for (const t of T.trees) if (Math.abs(t.x - x) < r && Math.abs(t.z - z) < r && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r) out.push({ ...t, y: heightAt(t.x, t.z) - 0.3 });
		}
		return out;
	}

	// ---------- the ground carved round you: a 256 m square at a time ----------
	// the lines that may reach into a square (from the tiles round it)
	function linesNear(x0, z0, x1, z1) {
		const out = [];
		for (let i = Math.floor((x0 - 60) / TILE); i <= Math.floor((x1 + 60) / TILE); i++) for (let j = Math.floor((z0 - 60) / TILE); j <= Math.floor((z1 + 60) / TILE); j++) {
			const T = S.tiles.get(tkey(i, j));
			if (!T?.built) return null;                        // (not in yet: wait)
			for (const L of T.lines) if (L.x1 + L.reach >= x0 && L.x0 - L.reach <= x1 && L.z1 + L.reach >= z0 && L.z0 - L.reach <= z1) out.push(L);
		}
		return out;
	}
	const roadsNear = (x, z, r) => (real?.near ? real.near('roads', x, z, r) : opts.roads ? opts.roads(x, z, r) : []);
	const decks = new Map();
	let decksDirty = false;
	for (const src of sources) for (const D of src.decks || []) { decks.set(Math.round(D.x) + ',' + Math.round(D.z), { ...D, own: true, walk: true }); decksDirty = true; }
	function* carveTile(ci, cj, lines, lakes) {
		const X0 = ci * WT, Z0 = cj * WT, ts = WT / WN;
		// the ground as it stands without this carving (on an 8 m grid; the survey is coarser)
		const G = WN / 4 + 1, base = new Float32Array(G * G);
		let t0 = performance.now();
		for (let b = 0; b < G; b++) {
			for (let a = 0; a < G; a++) { const x = X0 + a * 8, z = Z0 + b * 8; base[b * G + a] = heightAt(x, z) - waterDelta(x, z); }
			if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
		}
		yield;
		const B = (a, b) => { const fa = a / 4, fb = b / 4, i = Math.min(G - 2, Math.floor(fa)), j = Math.min(G - 2, Math.floor(fb)), u = fa - i, v = fb - j, k = j * G + i; return (base[k] * (1 - u) + base[k + 1] * u) * (1 - v) + (base[k + G] * (1 - u) + base[k + G + 1] * u) * v; };
		const N = W1 * W1, lo = new Float32Array(N), hi = new Float32Array(N), kind = new Float32Array(N), dam = new Float32Array(N).fill(-1e9);
		t0 = performance.now();
		// the streams: a bed under the water, banks cut back at a slope to the land, or a
		// low lip where the land lies under the water's level; in town a concrete trapezoid
		for (const L of lines) {
			for (let k = 0; k + 1 < L.n; k++) {
				const ax = L.x[k], az = L.z[k], dx = L.x[k + 1] - ax, dz = L.z[k + 1] - az, l2 = dx * dx + dz * dz || 1;
				const R = Math.max(L.w[k], L.w[k + 1]) / 2 + (L.conc ? 12 : 26);
				const a0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - R - X0) / ts)), a1 = Math.min(WN, Math.ceil((Math.max(ax, ax + dx) + R - X0) / ts));
				const b0 = Math.max(0, Math.floor((Math.min(az, az + dz) - R - Z0) / ts)), b1 = Math.min(WN, Math.ceil((Math.max(az, az + dz) + R - Z0) / ts));
				if (a0 > a1 || b0 > b1) continue;
				for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
					const x = X0 + a * ts, z = Z0 + b * ts, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
					const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
					if (d > R) continue;
					const w = L.w[k] + (L.w[k + 1] - L.w[k]) * t, lv = L.lv[k] + (L.lv[k + 1] - L.lv[k]) * t, g = B(a, b), q = b * W1 + a;
					if (L.conc) {
						const bh = Math.max(1, w * 0.32), bed = lv - 0.15, tg = d < bh ? bed : bed + (d - bh) * 1.6;
						if (tg < g) { const v = (tg - g) * (1 - sm(R - 3, R, d)); if (v < lo[q]) lo[q] = v; if (tg < g - 0.05) kind[q] = Math.max(kind[q], 2); }
						continue;
					}
					const hw = w / 2, D = depthOf(w);
					if (d < hw) {
						const tg = lv - 0.06 - D * Math.pow(Math.max(0, 1 - (d / hw) ** 2), 0.6);
						if (tg < g) { const v = tg - g; if (v < lo[q]) lo[q] = v; }
					} else {
						const tg = lv - 0.06 + (d - hw) * (w < 6 ? 0.95 : 0.6);
						if (tg < g) { const v = (tg - g) * (1 - sm(R - 8, R, d)); if (v < lo[q]) lo[q] = v; }
						else { const v = Math.max(0, lv + 0.05 + (d - hw) * 0.5 - g) * (1 - sm(hw + 1.5, hw + 5, d)); if (v > hi[q]) hi[q] = v; }
					}
					// (the wet band: wide where the bank lies low, narrow up a steep cut bank)
					const up = d < hw ? 0 : Math.min(g, lv - 0.06 + (d - hw) * (w < 6 ? 0.95 : 0.6)) - lv;
					kind[q] = Math.max(kind[q], (1 - sm(hw + 0.3, hw + 4, d)) * (1 - sm(0.2, 0.9, up)));
				}
				if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
			}
		}
		// the lakes: the bed falling away from the shore, a lip where the land outside lies
		// under the water, the wet band, and the dams
		for (const L of lakes) {
			const [Dmax, sl] = DEEP[L.kind] || DEEP[0];
			const M = 12, bx0 = X0 - M, bz0 = Z0 - M, bx1 = X0 + WT + M, bz1 = Z0 + WT + M;
			// (only the edges near this square count for the distance to the shore)
			const E = [];
			for (const r of L.rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
				if (Math.max(r[i], r[j]) < bx0 - 60 || Math.min(r[i], r[j]) > bx1 + 60 || Math.max(r[i + 1], r[j + 1]) < bz0 - 60 || Math.min(r[i + 1], r[j + 1]) > bz1 + 60) continue;
				E.push(r[j], r[j + 1], r[i], r[i + 1]);
			}
			const near = (x, z) => { let m = 1e18; for (let e = 0; e < E.length; e += 4) { const ax = E[e], az = E[e + 1], dx = E[e + 2] - ax, dz = E[e + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez; if (d < m) m = d; } return Math.sqrt(m); };
			for (let b = 0; b <= WN; b++) {
				const z = Z0 + b * ts, xs = crossings(L.rings, z);
				let c = 0;
				for (let a = 0; a <= WN; a++) {
					const x = X0 + a * ts;
					while (c < xs.length && xs[c] < x) c++;
					const inside = c % 2 === 1, d = E.length ? near(x, z) : 1e9, q = b * W1 + a, g = B(a, b);
					if (inside) {
						// (shallow at the shore, so the water thins over its bed there)
						const v = Math.min(0, L.level - Math.min(Dmax, 0.08 + d * sl) - g);
						if (v < lo[q]) lo[q] = v;
						kind[q] = Math.max(kind[q], 1);
					} else if (d < 10) {
						// the land brought to the water: raised where it lies under it, cut back a
						// little where it stands just above it (a steep shore is left as it is)
						let v = (L.level + 0.1 + d * (L.lip ?? 0.3) - g) * (1 - sm(4, 10, d));
						if (v < 0) v *= 1 - sm(1.5, 3, -v);
						if (v > hi[q]) hi[q] = v;
						if (v < lo[q]) lo[q] = v;
						const up = g + v - L.level;
						kind[q] = Math.max(kind[q], (1 - sm(0.3, 5, d)) * (1 - sm(0.5, 2, up)));
					}
				}
				if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
			}
			// an earth dam: a crest road 1.5 m over the water, its faces falling at 1 in 2.2
			for (const dm of L.dams || []) {
				const crest = L.level + 1.5;
				for (let e = 0; e + 3 < dm.length; e += 2) {
					const ax = dm[e], az = dm[e + 1], dx = dm[e + 2] - ax, dz = dm[e + 3] - az, l2 = dx * dx + dz * dz || 1, R = 80;
					const a0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - R - X0) / ts)), a1 = Math.min(WN, Math.ceil((Math.max(ax, ax + dx) + R - X0) / ts));
					const b0 = Math.max(0, Math.floor((Math.min(az, az + dz) - R - Z0) / ts)), b1 = Math.min(WN, Math.ceil((Math.max(az, az + dz) + R - Z0) / ts));
					for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
						const x = X0 + a * ts, z = Z0 + b * ts, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
						// (a crest 7 m across on the shore line, the faces falling either side of it)
						const tg = crest - Math.max(0, d - 3.5) / 2.2, q = b * W1 + a;
						if (tg > dam[q]) dam[q] = tg;
					}
				}
			}
		}
		// the bridges: where a road crosses, the ground as walked and driven stays at the road
		const walkZero = new Uint8Array(N);
		if (lines.length) {
			for (const r of roadsNear(X0 + WT / 2, Z0 + WT / 2, WT * 0.75)) {
				if (r.cls === 'track' || r.cls === 'steps') continue;
				if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
				const p = r.pts;
				for (let e = 0; e + 3 < p.length; e += 2) {
					const rx = p[e], rz = p[e + 1], ex = p[e + 2] - rx, ez = p[e + 3] - rz, el = Math.hypot(ex, ez);
					if (el < 0.5) continue;
					for (const L of lines) {
						if (Math.max(rx, rx + ex) < L.x0 - 5 || Math.min(rx, rx + ex) > L.x1 + 5 || Math.max(rz, rz + ez) < L.z0 - 5 || Math.min(rz, rz + ez) > L.z1 + 5) continue;
						for (let k = 0; k + 1 < L.n; k++) {
							const sx = L.x[k], sz = L.z[k], fx = L.x[k + 1] - sx, fz = L.z[k + 1] - sz, den = ex * fz - ez * fx;
							if (Math.abs(den) < 1e-6) continue;
							const u = ((sx - rx) * fz - (sz - rz) * fx) / den, v = ((sx - rx) * ez - (sz - rz) * ex) / den;
							if (u < 0 || u > 1 || v < 0 || v > 1) continue;
							const X = rx + ex * u, Z = rz + ez * u, w = L.w[k] + (L.w[k + 1] - L.w[k]) * v;
							const sin = Math.abs(den) / (el * Math.hypot(fx, fz)), hwR = r.w / 2 + 1.2;
							// (a footbridge only just clears the stream: a trail runs on the ground either side)
							const foot = r.cls === 'footway' || r.cls === 'path' || r.cls === 'cycleway' || r.cls === 'pedestrian';
							const span = Math.min(foot ? 16 : 70, (w / 2 + (L.conc ? 4 : foot ? 2.5 : 7)) / Math.max(0.35, sin));
							const dk = Math.round(X) + ',' + Math.round(Z), ux = ex / el, uz = ez / el;
							if (!decks.has(dk)) { decks.set(dk, { x: X, z: Z, ux, uz, span, hw: hwR, foot, own: !r.bridge, y: B(Math.max(0, Math.min(WN, (X - X0) / ts)), Math.max(0, Math.min(WN, (Z - Z0) / ts))) }); decksDirty = true; }
							const R = span + hwR + 2;
							const a0 = Math.max(0, Math.floor((X - R - X0) / ts)), a1 = Math.min(WN, Math.ceil((X + R - X0) / ts)), b0 = Math.max(0, Math.floor((Z - R - Z0) / ts)), b1 = Math.min(WN, Math.ceil((Z + R - Z0) / ts));
							for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
								const qx = X0 + a * ts - X, qz = Z0 + b * ts - Z, al = qx * ux + qz * uz, ac = -qx * uz + qz * ux;
								if (Math.abs(al) < span + 1 && Math.abs(ac) < hwR + 1) walkZero[b * W1 + a] = 1;
							}
						}
					}
				}
			}
		}
		// (nor under the buildings: berms.js)
		const under = new Float32Array(N);
		if (real?.near) underBuildings(real.near('boxes', X0 + WT / 2, Z0 + WT / 2, WT * 0.75), X0, Z0, ts, W1, under);
		const draw = new Float32Array(N * 2), walk = new Float32Array(N);
		let any = false;
		for (let q = 0; q < N; q++) {
			let v = lo[q] < -0.001 ? lo[q] : hi[q];
			if (dam[q] > -1e8) { const b = Math.floor(q / W1), a = q - b * W1, g = B(a, b); if (dam[q] > g + v) v = dam[q] - g; }
			v *= 1 - under[q];
			draw[q * 2] = v; draw[q * 2 + 1] = kind[q];
			walk[q] = walkZero[q] && v < 0 ? 0 : v;
			if (v !== 0 || kind[q] > 0) any = true;
		}
		if (!any) return false;
		return { draw, walk };
	}
	// the decks: a concrete slab carrying the road over the channel, rails on both sides
	const deckMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
	let deckMesh = null;
	const deckTop = (D) => (D.walk ? D.y : ground ? ground(D.x, D.z) : D.y) + 0.08;
	function buildDecks(cx, cz) {
		decksDirty = false;
		if (deckMesh) { root.remove(deckMesh); deckMesh.geometry.dispose(); deckMesh = null; }
		const pos = [], col = [], idx = [];
		const quad = (p, c) => { const b = pos.length / 3; for (const q of p) pos.push(q[0] - cx, q[1], q[2] - cz); for (let k = 0; k < 4; k++) col.push(...c); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
		const box = (D, a0, a1, c0, c1, y0, y1, top, side) => {
			const P = (al, ac, y) => [D.x + D.ux * al - D.uz * ac, y, D.z + D.uz * al + D.ux * ac];
			quad([P(a0, c0, y1), P(a0, c1, y1), P(a1, c1, y1), P(a1, c0, y1)], top);
			quad([P(a0, c0, y0), P(a1, c0, y0), P(a1, c0, y1), P(a0, c0, y1)], side);
			quad([P(a1, c1, y0), P(a0, c1, y0), P(a0, c1, y1), P(a1, c1, y1)], side);
			quad([P(a0, c1, y0), P(a0, c0, y0), P(a0, c0, y1), P(a0, c1, y1)], side);
			quad([P(a1, c0, y0), P(a1, c1, y0), P(a1, c1, y1), P(a1, c0, y1)], side);
			quad([P(a0, c1, y0), P(a1, c1, y0), P(a1, c0, y0), P(a0, c0, y0)], side);
		};
		// a footbridge's planks follow the ground from bank to bank, set into it at the ends,
		// rather than one flat slab held at the crossing's height
		const strip = (D, c0, c1, lo, hi, y, c) => {
			const n = Math.max(2, Math.ceil(D.span / 1.5)), P = (al, ac, yy) => [D.x + D.ux * al - D.uz * ac, yy, D.z + D.uz * al + D.ux * ac];
			for (let k = 0; k < n; k++) {
				const a0 = -D.span + 2 * D.span * k / n, a1 = -D.span + 2 * D.span * (k + 1) / n, y0 = y(a0), y1 = y(a1);
				quad([P(a0, c0, y0 + hi), P(a0, c1, y0 + hi), P(a1, c1, y1 + hi), P(a1, c0, y1 + hi)], c);
				quad([P(a0, c0, y0 + lo), P(a1, c0, y1 + lo), P(a1, c0, y1 + hi), P(a0, c0, y0 + hi)], c);
				quad([P(a1, c1, y1 + lo), P(a0, c1, y0 + lo), P(a0, c1, y0 + hi), P(a1, c1, y1 + hi)], c);
			}
		};
		for (const D of decks.values()) {
			if (!D.own || Math.hypot(D.x - cx, D.z - cz) > 2500) continue;
			if (D.foot && !D.walk && !D.wood) {
				const at = (al) => { const x = D.x + D.ux * al, z = D.z + D.uz * al; return (ground ? ground(x, z) : heightAt(x, z)) ?? D.y; };
				// (over the water it rides at the crossing's own level, easing down to the banks)
				const mid = deckTop(D) - 0.08, y = (al) => Math.max(at(al), mid - Math.abs(al) * 0.3) + 0.1, rail = [0.36, 0.28, 0.2];
				strip(D, -D.hw, D.hw, -0.4, 0, y, [0.42, 0.34, 0.24]);
				for (const sd of [-1, 1]) {
					const c0 = sd > 0 ? D.hw : -D.hw - 0.12, c1 = sd > 0 ? D.hw + 0.12 : -D.hw;
					strip(D, c0, c1, 0.85, 0.97, y, rail);
					for (let al = -D.span + 0.1; al < D.span; al += 2.4) box(D, al - 0.06, al + 0.06, c0, c1, y(al) - 0.3, y(al) + 0.97, rail, rail);
				}
				continue;
			}
			const top = deckTop(D), asph = D.foot || D.wood ? [0.42, 0.34, 0.24] : [0.16, 0.16, 0.17], conc = D.wood ? [0.36, 0.28, 0.2] : [0.55, 0.54, 0.5];
			box(D, -D.span, D.span, -D.hw, D.hw, top - (D.foot ? 0.35 : 0.9), top, asph, conc);
			for (const sd of [-1, 1]) box(D, -D.span, D.span, sd > 0 ? D.hw : -D.hw - 0.3, sd > 0 ? D.hw + 0.3 : -D.hw, top - 0.2, top + (D.foot ? 1.05 : 0.85), conc, conc);
		}
		if (!idx.length) return;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(col.map((c) => Math.pow(c, 2.2)), 3));
		g.setIndex(idx); g.computeVertexNormals();
		deckMesh = new THREE.Mesh(g, deckMat);
		deckMesh.position.set(cx, 0, cz); deckMesh.castShadow = deckMesh.receiveShadow = true;
		root.add(deckMesh);
	}
	// a deck is a floor where the ground under it is not held level (a planet's)
	function floor(x, z, y) {
		let best = -Infinity;
		for (const D of decks.values()) {
			if (!D.walk || Math.abs(x - D.x) > D.span + D.hw + 2 || Math.abs(z - D.z) > D.span + D.hw + 2) continue;
			const qx = x - D.x, qz = z - D.z, al = qx * D.ux + qz * D.uz, ac = -qx * D.uz + qz * D.ux, top = deckTop(D);
			if (Math.abs(al) < D.span && Math.abs(ac) < D.hw && y > top - 1.5) best = Math.max(best, top);
		}
		return best;
	}

	// ---------- a lake's water ----------
	// (its shore drawn to within a few tens of centimetres, a big lake a little coarser:
	// the mapped shores are dense, and cutting the water into triangles is done all at once)
	function* buildLake(L) {
		const tol = L.area > 1e6 ? 1.2 : L.area > 5e4 ? 0.6 : 0.25;
		const toV = (r) => { const v = []; for (const k of simplify(r, tol)) v.push(new THREE.Vector2(r[k * 2] - L.cx, r[k * 2 + 1] - L.cz)); return v; };
		const outer = toV(L.rings[0]), holes = [];
		yield;
		for (const r of L.rings.slice(1)) { const h = toV(r); if (h.length >= 3) holes.push(h); }
		yield;
		if (outer.length < 3 || !S.lakes.includes(L) || L.mesh) return;
		if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
		for (const h of holes) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
		const tris = THREE.ShapeUtils.triangulateShape(outer, holes), all = outer.concat(...holes);
		const pos = new Float32Array(all.length * 3), idx = [];
		all.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 2] = p.y; });
		// (wound to face up)
		for (const t of tris) idx.push(t[0], t[2], t[1]);
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(all.length * 3).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
		g.setIndex(all.length > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
		g.computeBoundingSphere();
		const m = new THREE.Mesh(g, lakeMat(L));
		m.position.set(L.cx, L.level, L.cz);
		m.renderOrder = 1;
		root.add(m);
		L.mesh = m;
		if (haloMat) {
			const P = [], hp = [], ak = [], hi = [];
			for (const v of outer) P.push(v.x, v.y);
			haloBand(hp, ak, hi, P, 0, 12, 1, true);
			L.halo = haloMesh(hp, ak, hi, L.cx, L.cz);
		}
	}
	function dropLake(L) {
		if (!L.mesh) return;
		gone.push(lakeMats.get(L), L.mesh); lakeMats.delete(L); L.mesh = null;
		if (L.halo) { gone.push(L.halo); L.halo = null; }
	}
	// (what is let go is taken down a millisecond's worth a frame: a long way flown lets go of a lot)
	const gone = [];
	function takeDown(ms) {
		const t0 = performance.now();
		while (gone.length && performance.now() - t0 < ms) { const o = gone.pop(); if (o?.isMesh) { root.remove(o); o.geometry.dispose(); } else o?.dispose(); }
	}
	const lakeRange = (L) => (L.area > 1e6 ? 32000 : L.area > 5e4 ? 14000 : L.area > 8000 ? 5000 : 2600) * (isPhone ? 0.65 : 1);

	// ---------- ducks and geese on the lakes near you ----------
	const fowlG = { duck: waterfowl('mallard'), goose: waterfowl('goose') }, fowlM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75 });
	const flock = [];
	function flockFor(L) {
		if (L.birds || L.kind === 4 || L.area < 1500 || L.ice || lookU.value.x > 0.5) return;
		L.birds = [];
		const n = Math.min(isPhone ? 4 : 8, 2 + Math.floor(Math.sqrt(L.area) / 40));
		for (let k = 0; k < n; k++) {
			for (let tries = 0; tries < 30; tries++) {
				const x = L.x0 + h01(L.id + k, tries) * (L.x1 - L.x0), z = L.z0 + h01(tries, L.id * 3 + k) * (L.z1 - L.z0);
				if (!inRings(L.rings, x, z)) continue;
				const d = edgeDist(L.rings, x, z);
				if (d < 3 || d > 40) continue;
				const kind = k % 3 === 2 ? 'goose' : 'duck', b = new THREE.Group(), m = new THREE.Mesh(fowlG[kind], fowlM);
				m.rotation.y = Math.PI / 2; m.position.y = -0.04; m.castShadow = true; b.add(m);
				b.position.set(x, L.level, z); root.add(b);
				const B = { b, x, z, h: h01(k, L.id) * 6.28, v: 0.3, turn: 0, ph: k * 2.1, L };
				L.birds.push(B); flock.push(B);
				break;
			}
		}
	}
	function dropFlock(L) {
		if (!L.birds) return;
		for (const B of L.birds) { root.remove(B.b); flock.splice(flock.indexOf(B), 1); }
		L.birds = null;
	}

	// ---------- each frame: plan what is near, then work through it a slice at a time ----------
	const carveQ = new Set();
	S.noCarve = new Set();
	// (loading: each source's own work, then every lake it has put in the grid, before anything is carved)
	let job = (function* () {
		for (const src of sources) if (src.job) yield* src.job();
		S.srcV = sources.map((q) => q.version()).join(',');
		regrid(sources);
		while (addQ.length) { putLakes(3); yield; }
	})(), cur = null, lastDecks = { x: 1e9, z: 1e9 };
	function plan(cx, cz) {
		S.px = cx; S.pz = cz;
		const tasks = [];
		// the tiles to build, nearest first
		const R = RANGE.data, want = new Set();
		for (let i = Math.floor((cx - R) / TILE); i <= Math.floor((cx + R) / TILE); i++) for (let j = Math.floor((cz - R) / TILE); j <= Math.floor((cz + R) / TILE); j++) {
			const d = Math.hypot(Math.max(0, Math.abs((i + 0.5) * TILE - cx) - TILE / 2), Math.max(0, Math.abs((j + 0.5) * TILE - cz) - TILE / 2));
			if (d > R) continue;
			want.add(tkey(i, j));
			if (!S.tiles.has(tkey(i, j))) tasks.push({ d, kind: 'tile', i, j });
		}
		// let go of the far ones
		for (const [k, T] of S.tiles) if (!want.has(k) && Math.hypot((T.i + 0.5) * TILE - cx, (T.j + 0.5) * TILE - cz) > RANGE.data + 3000) { if (T.mesh) gone.push(T.mesh); if (T.halo) gone.push(T.halo); if (T.bed) gone.push(...T.bed); S.tiles.delete(k); }
		// the squares to carve
		if (atlas) {
			const C = RANGE.carve;
			for (const t of [...atlas.tiles()]) if (Math.hypot((t.i + 0.5) * WT - cx, (t.j + 0.5) * WT - cz) > C * 1.35 + WT) atlas.drop(t.i, t.j);
			for (let i = Math.floor((cx - C) / WT); i <= Math.floor((cx + C) / WT); i++) for (let j = Math.floor((cz - C) / WT); j <= Math.floor((cz + C) / WT); j++) {
				const d = Math.hypot(Math.max(0, Math.abs((i + 0.5) * WT - cx) - WT / 2), Math.max(0, Math.abs((j + 0.5) * WT - cz) - WT / 2));
				if (d > C || atlas.has(i, j) || carveQ.has(i * 100003 + j) || S.noCarve.has(i * 100003 + j)) continue;
				tasks.push({ d: d * 0.8, kind: 'carve', i, j });
			}
		}
		tasks.sort((a, b) => a.d - b.d);
		S.jobs = tasks;
		// the lakes' water
		for (const L of S.lakes) {
			// (a lake drawn by its own module, lake.js: only its ground carved here)
			if (L.own) continue;
			const d = Math.hypot(Math.max(0, L.x0 - cx, cx - L.x1), Math.max(0, L.z0 - cz, cz - L.z1));
			if (d < lakeRange(L)) { if (!L.mesh) S.jobs.push({ d, kind: 'lake', L }); } else if (d > lakeRange(L) * 1.2) dropLake(L);
			if (d < (isPhone ? 300 : 450)) flockFor(L); else if (d > 900) dropFlock(L);
		}
		for (const src of sources) src.trim?.(cx, cz, RANGE.data + 12000);
	}
	function nextJob() {
		while (S.jobs.length) {
			const t = S.jobs.shift();
			if (t.kind === 'tile') {
				if (S.tiles.has(tkey(t.i, t.j))) continue;
				// (one a source isn't ready to give yet is asked for again on the next plan)
				if (sources.some((q) => q.wait?.(t.i, t.j))) continue;
				const T = { i: t.i, j: t.j, lines: [], grid: new Map(), trees: [], mesh: null, wideIdx: 0, allIdx: 0, built: false };
				S.tiles.set(tkey(t.i, t.j), T);
				return Object.assign(buildTile(T), { what: 'tile' });
			}
			if (t.kind === 'lake') { if (!t.L.mesh && S.lakes.includes(t.L)) return Object.assign(buildLake(t.L), { what: 'lake' }); continue; }
			if (t.kind === 'carve') {
				const X0 = t.i * WT, Z0 = t.j * WT, k = t.i * 100003 + t.j;
				if (atlas.has(t.i, t.j) || carveQ.has(k)) continue;
				const lines = linesNear(X0, Z0, X0 + WT, Z0 + WT);
				if (!lines) continue;
				const lakes = [...lakesNear(X0 - 12, Z0 - 12, X0 + WT + 12, Z0 + WT + 12)].filter((L) => L.area > 60);
				if (!lines.length && !lakes.length) { S.noCarve.add(k); continue; }
				if (atlas.full()) continue;
				carveQ.add(k);
				return Object.assign((function* () {
					const r = yield* carveTile(t.i, t.j, lines, lakes);
					carveQ.delete(k);
					if (r) { atlas.put(t.i, t.j, r.draw, r.walk); S.stats.carved++; carvedSince = true; } else S.noCarve.add(k);
				})(), { what: 'carve' });
			}
		}
		return null;
	}

	let realN = 0;
	// (what took longest, for a look at a slow frame)
	const spike = (what, s0) => { const d = performance.now() - s0; if (d > (S.stats.spikes[what] || 0)) S.stats.spikes[what] = Math.round(d * 10) / 10; };
	function update(dt, t, cam, night = 0) {
		const f0 = performance.now();
		uNight.value = night;
		const x = cam.position.x, z = cam.position.z;
		if (job) {
			// (a longer slice while loading: nothing else of the water's runs yet)
			while (job && performance.now() - f0 < RANGE.budget * 2.5) { const s0 = performance.now(); if (job.next().done) job = null; spike('load', s0); }
			if (job) return;
			S.ready = true;
			if (trees) { setWaterHooks({ water: inWater, trees: treesNear }); grewTrees(); }
		}
		// the sources' lakes, as they change
		const vs = sources.map((q) => q.version()), sv = vs.join(',');
		if (sv !== S.srcV) { const was = S.srcV.split(','); S.srcV = sv; regrid(sources.filter((q, i) => String(vs[i]) !== was[i])); S.plannedAt = -1e9; spike('regrid', f0); }
		putLakes(2);
		takeDown(1);
		if (S.noCarve.size > 5000) S.noCarve.clear();
		// a mapped region came in: its roads cross the creeks, so carve its squares again
		const rn = real?.R?.regions?.length || 0;
		if (atlas && rn !== realN) { realN = rn; for (const q of [...atlas.tiles()]) atlas.drop(q.i, q.j); S.noCarve.clear(); for (const [k, D] of decks) if (!D.walk) decks.delete(k); decksDirty = true; S.plannedAt = -1e9; }
		if (Math.hypot(x - S.px, z - S.pz) > 120 || t - S.plannedAt > 1.5) { const p0 = performance.now(); S.plannedAt = t; plan(x, z); spike('plan', p0); }
		const t0 = performance.now();
		while (performance.now() - t0 < RANGE.budget) {
			if (!cur) cur = nextJob();
			if (!cur) break;
			const s0 = performance.now();
			const what = cur.what;
			try { if (cur.next().done) cur = null; } catch (e) { console.warn('water', e); cur = null; }
			S.stats.slowest = Math.max(S.stats.slowest, performance.now() - s0);
			spike(what || 'job', s0);
		}
		atlas?.centre(x, z, RANGE.carve);
		// the ribbons: the whole of a near tile, only the wider water further off
		for (const T of S.tiles.values()) {
			const d = Math.hypot(Math.max(0, Math.abs((T.i + 0.5) * TILE - x) - TILE / 2), Math.max(0, Math.abs((T.j + 0.5) * TILE - z) - TILE / 2));
			// (the rocks and logs only close by)
			if (T.bed) for (const im of T.bed) im.visible = d < (isPhone ? 250 : 500);
			if (!T.mesh) continue;
			T.mesh.visible = d < RANGE.far && cam.position.y < 9000 && (d < RANGE.near || T.wideIdx > 0);
			T.mesh.geometry.setDrawRange(0, d < RANGE.near ? T.allIdx : T.wideIdx);
		}
		if (decksDirty || Math.hypot(x - lastDecks.x, z - lastDecks.z) > 800) { const d0 = performance.now(); lastDecks = { x, z }; buildDecks(Math.round(x / 64) * 64, Math.round(z / 64) * 64); spike('decks', d0); }
		// (the ground under the trees moved where a channel was cut: once the carving round you
		// is done, the trees are stood on it again)
		if (carvedSince && !cur && !S.jobs.some((q) => q.kind === 'carve')) { carvedSince = false; grew = true; }
		if (grew && t - grewAt > 4) { grew = false; grewAt = t; grewTrees(); }
		// the birds paddle about, steering off the shore and clear of you
		for (const B of flock) {
			B.ph += dt;
			if (Math.random() < dt * 0.15) B.turn = (Math.random() - 0.5) * 0.8;
			const ax = B.x + Math.cos(B.h) * 4, az = B.z + Math.sin(B.h) * 4;
			if (!inRings(B.L.rings, ax, az) || edgeDist(B.L.rings, ax, az) < 2.5) B.h += dt * 1.5; else B.h += B.turn * dt;
			B.x += Math.cos(B.h) * B.v * dt; B.z += Math.sin(B.h) * B.v * dt;
			const dc = Math.hypot(B.x - x, B.z - z);
			if (dc < 6) { B.h = Math.atan2(B.z - z, B.x - x); B.v = 0.9; } else B.v += (0.3 - B.v) * dt * 0.3;
			const dab = Math.max(0, Math.sin(B.ph * 0.4) - 0.93) * 12;
			B.b.position.set(B.x, B.L.level + Math.sin(B.ph * 2) * 0.012, B.z);
			B.b.rotation.set(0, -B.h, dab * 1.2);
		}
		S.stats.longest = Math.max(S.stats.longest, performance.now() - f0);
	}

	// ---------- what the rest of the world asks ----------
	// the named water at a point: { name, kind } (for the place labels)
	function nameAt(x, z) {
		if (!S.ready) return null;
		const L = lakeAt(x, z);
		if (L) return L.name ? { name: L.name, kind: /lagoon/i.test(L.name) ? 'Lagoon' : KIND_NAME[L.kind] } : null;
		const r = riverAt(x, z, 12);
		if (r?.L.name) return { name: r.L.name, kind: r.L.conc ? 'Flood channel' : r.L.cls === 'river' || /river/i.test(r.L.name) ? 'River' : /slough/i.test(r.L.name) ? 'Slough' : r.L.cls === 'canal' ? 'Canal' : 'Creek' };
		return null;
	}
	// what water is here, for fishing: 'lake', 'river' or null
	function kindAt(x, z) {
		if (!S.ready || lookU.value.x > 0.5) return null;
		const L = lakeAt(x, z);
		if (L) return L.ice ? null : 'lake';
		const r = riverAt(x, z);
		return r && !r.L.conc && !r.L.ice[r.k] && r.hw > 0.9 ? 'river' : null;
	}
	function info() {
		return { ready: S.ready, lakes: S.lakes.length, lakeMeshes: S.lakes.filter((L) => L.mesh).length, tiles: S.tiles.size, built: S.stats.built, carved: atlas ? atlas.count() : 0, decks: decks.size, birds: flock.length, queue: S.jobs.length + (cur ? 1 : 0), longestMs: Math.round(S.stats.longest * 10) / 10, slowestStepMs: Math.round(S.stats.slowest * 10) / 10, spikes: S.stats.spikes, sources: sources.map((q) => q.name) };
	}
	return {
		group: root, update, waterAt, inWater, nameAt, kindAt, floor, info, falls, ready: () => S.ready,
		riverAt: (x, z) => { const r = riverAt(x, z, 2); return r ? { name: r.L.name, level: r.level, width: r.hw * 2 } : null; },
		hasRiver: (x, z) => !!riverAt(x, z, 2),
		decks: () => [...decks.values()].map((D) => ({ x: D.x, z: D.z, own: D.own, span: D.span })),
		// a stretch of stream near a point, for a look at it: { x, z, ux, uz, w, name }
		streamNear(x, z, r = 800) { let best = null; for (const T of S.tiles.values()) for (const L of T.lines) for (let k = 0; k + 1 < L.n; k++) { const d = Math.hypot(L.x[k] - x, L.z[k] - z); if (d < r && L.w[k] > 2 && (!best || d < best.d)) { const l = Math.hypot(L.x[k + 1] - L.x[k], L.z[k + 1] - L.z[k]) || 1; best = { d, x: L.x[k], z: L.z[k], ux: (L.x[k + 1] - L.x[k]) / l, uz: (L.z[k + 1] - L.z[k]) / l, w: L.w[k], name: L.name, level: L.lv[k] }; } } return best; },
		lakeAt: (x, z) => { const L = lakeAt(x, z); return L ? { name: L.name, level: L.level, kind: KIND_NAME[L.kind] } : null; },
		// (for a look at why a square is or isn't carved)
		carveDebug(x, z) { const i = Math.floor(x / WT), j = Math.floor(z / WT), k = i * 100003 + j, ln = linesNear(i * WT, j * WT, (i + 1) * WT, (j + 1) * WT); return { has: atlas?.has(i, j), no: S.noCarve.has(k), q: carveQ.has(k), lines: ln ? ln.length : null, lakes: lakesNear(i * WT, j * WT, (i + 1) * WT, (j + 1) * WT).size, full: atlas?.full(), delta: waterDelta(x, z), jobs: S.jobs.length, tiles: [...S.tiles.values()].filter((T) => !T.built).length }; },
		budget: (ms) => { RANGE.budget = ms; }, resetStats: () => { S.stats.longest = 0; S.stats.slowest = 0; S.stats.spikes = {}; },
		attribution: () => sources.map((q) => q.attribution?.()).filter(Boolean).join(' · '),
	};
}
