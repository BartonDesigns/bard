// The mist band a cliff settlement stands in: a deck of low cloud at a fixed height, a few
// thin layers through its depth, drifting on the world's wind (shared.uWindDir, uWind) and
// parting round the towers and the houses' struts as a stream parts round stones: the noise
// is read where each parcel came from upwind, so it squeezes past them, closes behind and
// meanders off in a wake. Wisps torn from it stream round each tower. It thins where it meets
// the ground (it lies in the gorges rather than cutting through the rock), thins as you come
// level with a layer (no razor edge seen side on), and flying into it closes a veil round you.
// Lit by the sky; by night it takes the windows' light near the works.

import * as THREE from 'three';

const NOISE = /* glsl */`
float mH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float mN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mH(i), mH(i + vec2(1.0, 0.0)), f.x), mix(mH(i + vec2(0.0, 1.0)), mH(i + vec2(1.0, 1.0)), f.x), f.y); }
float mF(vec2 p){ return mN(p) * 0.53 + mN(p * 2.07 + 3.1) * 0.27 + mN(p * 4.3 - 1.7) * 0.13 + mN(p * 8.9 + 5.3) * 0.07; }
`;
const COMMON = /* glsl */`
uniform vec2 uOff, uWd;
uniform vec4 uObs[12];
uniform vec3 uC, uSunC, uHor, uWarm;
uniform vec2 uBand;
uniform float uCov, uHalf, uNight, uTime, uK, uLit, uDusk;
uniform vec4 uSkyDusk;
`;
// the sky's light on it: sunlit above, cooler beneath, dark by night with the windows warm in it
const SHADE = /* glsl */`
vec3 mistC(float up, float n, float glow){
	vec3 c = mix(uHor * 0.85, uSunC * 0.9 + uHor * 0.35, (0.3 + 0.7 * up) * uLit) * (0.6 + 0.65 * n * (0.4 + 0.6 * up));
	c = mix(c, uHor * 0.18 + vec3(0.02, 0.025, 0.045), uNight * 0.75);
	c = mix(c, uWarm * dot(c, vec3(0.3, 0.5, 0.2)) * 1.2, 0.22 * uDusk);
	// under the world's own dusk sky (sky.js uDusk): violet, pinker on the tops
	c = mix(c, mix(vec3(0.035, 0.01, 0.09), vec3(0.34, 0.07, 0.3), up * up) * uSkyDusk.y * (0.5 + 0.9 * n), uSkyDusk.x * 0.92);
	// lit from below, pink, deepest under the tops
	c += uWarm * (1.0 - up) * 0.12 * uSkyDusk.x * n;
	// and white-pink billows where the towers' light catches them
	c += vec3(1.0, 0.78, 0.9) * min(1.0, glow) * glow * 0.55 * uSkyDusk.x * (0.4 + 0.6 * n);
	return c + uWarm * glow * (uDusk + uSkyDusk.x * 0.8) * (3.4 - up * 1.8);
}
`;

const DECK_V = /* glsl */`
uniform vec2 uOff;
uniform vec4 uObs[12];
attribute vec3 aL;
varying vec3 vW;
varying float vL;
varying float vB;
#include <fog_pars_vertex>
${NOISE}
void main(){
	vec4 w = modelMatrix * vec4(position, 1.0);
	// billows: the upper layers heaped and hollowed, drifting with the band
	vec2 bq = w.xz - uOff;
	float bl = mN(bq * 0.012) * 0.6 + mN(bq * 0.031 + 4.0) * 0.4;
	w.y += (bl - 0.42) * aL.z * (0.25 + 0.75 * aL.x);
	// heaped up round the towers' feet, rolling higher the nearer
	float heap = 0.0;
	for (int i = 0; i < 12; i++) { vec4 o = uObs[i]; if (o.z <= 0.0) continue; float r = length(w.xz - o.xy) / (o.z * 4.5); heap += o.w * exp(-r * r); }
	w.y += min(1.6, heap) * aL.z * (0.5 + 0.9 * aL.x) * (0.75 + 0.5 * bl);
	vW = w.xyz; vL = aL.x; vB = aL.y;
	vec4 mvPosition = viewMatrix * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const DECK_F = /* glsl */`
${COMMON}
uniform sampler2D uHeight;
varying vec3 vW;
varying float vL;
varying float vB;
#include <fog_pars_fragment>
${NOISE}
${SHADE}
void main(){
	vec2 ac = vec2(-uWd.y, uWd.x), p = vW.xz, q = p;
	float hole = 1.0, glow = 0.0;
	for (int i = 0; i < 12; i++) {
		vec4 o = uObs[i];
		if (o.z <= 0.0) continue;
		vec2 d = p - o.xy;
		float s = dot(d, uWd), b = dot(d, ac), R = o.z, r = length(d);
		if (r > R * 14.0) continue;
		// where this parcel was before it was turned aside, and the meander in the lee
		float e = exp(-s * s / (R * R * 5.0));
		float b0 = sign(b) * sqrt(max(0.0, b * b - R * R * e * 1.2));
		b0 += sin(s / R * 0.9 - uTime * 0.5 + o.x) * R * 0.55 * step(0.0, s) * exp(-s / (R * 7.0)) * exp(-b * b / (R * R * 2.5));
		q += ac * (b0 - b);
		hole *= smoothstep(R * 0.98, R * 1.35, r);
		// (close round the foot: a gaussian, so the far deck keeps its own dark)
		float gr = r / (R * 2.6);
		glow += o.w * (exp(-gr * gr) + 0.12 * exp(-r / (R * 7.0)));
	}
	glow *= 1.0 - vB * 0.6;
	vec2 nq = (q - uOff) * 0.0055 + vL * 1.7 + vB * 9.0;
	float n = mF(nq), n2 = mF(nq + vec2(0.035, 0.05));
	float mid = 1.0 - abs(vL * 2.0 - 1.0), cv = uCov + vB * 0.13;
	// breaks in it, wide lanes where the ground and the towers show through
	float brk = smoothstep(0.27, 0.45, mN((q - uOff) * 0.0016 + vB * 5.0 + 11.0));
	float cov = smoothstep(cv, cv + 0.16, n + mid * 0.14 - 0.05 - (1.0 - mid) * 0.08) * brk;
	// the ground under it, read between the height map's texels (it is stored unfiltered)
	vec2 hs = vec2(textureSize(uHeight, 0)), hu = (p + uHalf) / (2.0 * uHalf) * (hs - 1.0), hf = fract(hu), h0 = (floor(hu) + 0.5) / hs;
	float g = mix(mix(texture2D(uHeight, h0).r, texture2D(uHeight, h0 + vec2(1.0, 0.0) / hs).r, hf.x), mix(texture2D(uHeight, h0 + vec2(0.0, 1.0) / hs).r, texture2D(uHeight, h0 + 1.0 / hs).r, hf.x), hf.y);
	float lift = glow * uDusk;
	float a = min(1.0, cov * (1.0 + lift * 1.2) + lift * 0.3) * hole * smoothstep(0.0, 9.0, vW.y - g) * (1.0 - smoothstep(uC.z * 0.6, uC.z, length(p - uC.xy)));
	a *= smoothstep(0.5, 8.0, abs(cameraPosition.y - vW.y)) * uK * 0.34;
	if (a < 0.004) discard;
	// rolling tops: lit where the billow faces up out of the deck, shadowed in its folds
	float relief = clamp((n - n2) * 7.0 + 0.5, 0.0, 1.0);
	vec3 col = mistC(vL, n, glow) * (0.5 + 0.95 * relief * (0.3 + 0.7 * vL)) * (0.75 + 0.35 * smoothstep(cv, cv + 0.3, n));
	gl_FragColor = vec4(col, a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	vec3 preFog = gl_FragColor.rgb;
	#include <fog_fragment>
	// (the haze takes less of it: its own colours carry to the distance)
	gl_FragColor.rgb = mix(preFog, gl_FragColor.rgb, 0.45);
}`;

const WISP_V = /* glsl */`
${COMMON}
uniform float uFlow;
attribute vec4 aW;
attribute vec4 aT;
varying vec2 vUv;
varying float vA;
varying float vS;
varying float vUp;
#include <fog_pars_vertex>
void main(){
	vec2 ac = vec2(-uWd.y, uWd.x);
	vec4 mvPosition;
	if (aT.z < 0.0) {
		// a wisp rising off the deck, drifting downwind, swelling and thinning away
		float t = fract(uTime * 0.016 * (0.6 + fract(aT.w * 7.0)) + aW.y);
		vec3 c = vec3(aT.x, aW.z - aT.z * t, aT.y) + vec3(uWd.x, 0.0, uWd.y) * t * 30.0;
		mvPosition = viewMatrix * vec4(c, 1.0);
		mvPosition.xy += position.xy * aW.w * (0.55 + t * 0.9);
		vA = sin(t * 3.14159) * smoothstep(6.0, 40.0, -mvPosition.z);
		vUp = 0.9;
	} else {
		float R = aT.z, L = R * 9.0;
		float s = mod(aW.y + uFlow * (0.8 + 0.4 * fract(aT.w)), 2.0 * L) - L;
		float e = exp(-s * s / (R * R * 5.0));
		float bb = sign(aW.x) * sqrt(aW.x * aW.x + R * R * e * 1.2);
		vec3 c = vec3(aT.x, aW.z, aT.y) + vec3(uWd.x, 0.0, uWd.y) * s + vec3(ac.x, 0.0, ac.y) * bb;
		c.y += sin(uTime * 0.25 + aT.w * 6.0 + s * 0.04) * 2.5;
		mvPosition = viewMatrix * vec4(c, 1.0);
		mvPosition.xy += position.xy * aW.w * (0.85 + 0.5 * e);
		vA = (1.0 - smoothstep(0.55, 1.0, abs(s) / L)) * smoothstep(6.0, 40.0, -mvPosition.z);
		vUp = clamp((aW.z - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);
	}
	vUv = position.xy * 2.0; vS = aT.w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const WISP_F = /* glsl */`
${COMMON}
varying vec2 vUv;
varying float vA;
varying float vS;
varying float vUp;
#include <fog_pars_fragment>
${NOISE}
${SHADE}
void main(){
	float n = mF(vUv * 1.3 + vS * 31.0 + uTime * 0.03);
	float a = smoothstep(1.0, 0.15, length(vUv)) * smoothstep(0.25, 0.75, n) * vA * uK * 0.5;
	if (a < 0.004) discard;
	gl_FragColor = vec4(mistC(vUp, n, vUp < 0.85 ? 0.5 * (1.0 - vUp) : 0.05), a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	vec3 preFog = gl_FragColor.rgb;
	#include <fog_fragment>
	// (the haze takes less of it: its own colours carry to the distance)
	gl_FragColor.rgb = mix(preFog, gl_FragColor.rgb, 0.45);
}`;

// heaped cumulus far off round the settlement, standing over the horizon: billboards turned to
// you about their upright, lobes of cloud on a flat base, lit pink from below at dusk, violet
// and dark in their tops; only while the world's own dusk is on
const HERO_V = /* glsl */`
attribute vec4 aC;
attribute vec4 aS;
varying vec2 vUv;
varying vec4 vS;
void main(){
	vec3 to = aC.xyz - cameraPosition;
	vec3 right = normalize(vec3(-to.z, 0.0, to.x));
	vec3 p = aC.xyz + right * position.x * aC.w + vec3(0.0, position.y * aC.w * 0.62, 0.0);
	vUv = position.xy * 2.0; vS = aS;
	gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const HERO_F = /* glsl */`
uniform vec4 uSkyDusk;
uniform float uTime;
uniform vec3 uHor;
varying vec2 vUv;
varying vec4 vS;
${NOISE}
void main(){
	vec2 q = vUv;
	float d = 0.0, sd = vS.x * 37.0;
	for (int i = 0; i < 7; i++) {
		float fi = float(i), hx = mH(vec2(sd, fi)), hy = mH(vec2(fi, sd));
		vec2 c = vec2((hx - 0.5) * 1.3, -0.55 + hy * 0.55 * (1.0 - abs(hx - 0.5) * 1.4) + (i == 0 ? 0.45 : 0.0));
		float r = 0.26 + mH(vec2(sd + 3.0, fi)) * 0.22 + (i == 0 ? 0.12 : 0.0);
		d = max(d, smoothstep(r, r * 0.45, length((q - c) * vec2(1.0, 1.15))));
	}
	float n = mF(q * 3.2 + vS.x * 11.0 + uTime * 0.004);
	d *= smoothstep(0.25, 0.6, d + n * 0.45 - 0.2) * smoothstep(-0.78, -0.62, q.y);
	float a = d * uSkyDusk.x * vS.y;
	if (a < 0.01) discard;
	float v = clamp((q.y + 0.7) / 1.5, 0.0, 1.0);
	// the underside lit hot pink by the sun gone down, the heaped tops in violet shade
	vec3 c = mix(vec3(1.0, 0.5, 0.68) * 1.15, vec3(0.2, 0.11, 0.32), smoothstep(0.08, 0.85, v - n * 0.25));
	c = mix(c, uHor * 0.5, 0.15) * uSkyDusk.y;
	gl_FragColor = vec4(c, a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
export function createHeroes(scene, shared, centre, { isPhone = false, seed = 1, sea = 0 } = {}) {
	let s = (seed ^ 0x77c1) >>> 0;
	const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	const n = isPhone ? 4 : 7, C = [], S = [];
	for (let i = 0; i < n; i++) {
		const a = (i + rnd() * 0.6) / n * Math.PI * 2, d = 4200 + rnd() * 2600, w = 1500 + rnd() * 1300;
		C.push(centre.x + Math.sin(a) * d, sea + 260 + rnd() * 380 + w * 0.3, centre.z + Math.cos(a) * d, w);
		S.push(rnd(), 0.75 + rnd() * 0.25, 0, 0);
	}
	const g = new THREE.InstancedBufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
	g.setIndex([0, 1, 2, 0, 2, 3]);
	g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(C), 4));
	g.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(S), 4));
	g.instanceCount = n;
	const U = { uSkyDusk: shared.uDuskSky || (shared.uDuskSky = { value: new THREE.Vector4(0, 1, 0, 0) }), uTime: shared.uTime, uHor: shared.uSkyHor || { value: new THREE.Color(0.5, 0.4, 0.6) } };
	const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: HERO_V, fragmentShader: HERO_F, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
	m.frustumCulled = false; m.renderOrder = 2; m.name = 'arch:heroes';
	scene.add(m);
	return { mesh: m, dispose() { g.dispose(); m.material.dispose(); scene.remove(m); } };
}

// the same noise on the CPU, for the veil when you fly into it
const fr = (v) => v - Math.floor(v);
const mH = (x, y) => fr(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const mN = (x, y) => {
	const ix = Math.floor(x), iy = Math.floor(y);
	let fx = x - ix, fy = y - iy;
	fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
	const a = mH(ix, iy), b = mH(ix + 1, iy), c = mH(ix, iy + 1), d = mH(ix + 1, iy + 1);
	return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const mF = (x, y) => mN(x, y) * 0.53 + mN(x * 2.07 + 3.1, y * 2.07 + 3.1) * 0.27 + mN(x * 4.3 - 1.7, y * 4.3 - 1.7) * 0.13 + mN(x * 8.9 + 5.3, y * 8.9 + 5.3) * 0.07;
const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// M: the plan's mist { bands: [{ base, top, cover }], x, z, rad } (the first band the main
// one); obs: [{ x, z, r, light, tower }]; banks: far mist round other things, of rising wisps
// [{ x, z, r, y, rise, n, size }]
export function createMist(scene, shared, M, obs, { isPhone = false, seed = 1, glow = [1.0, 0.45, 0.65], banks = [], heightAt = () => -1e9 } = {}) {
	const group = new THREE.Group();
	group.name = 'arch:mist';
	const wd = shared.uWindDir?.value || new THREE.Vector2(1, 0);
	const U = {
		uOff: { value: new THREE.Vector2() }, uWd: { value: new THREE.Vector2(wd.x, wd.y) },
		uObs: { value: Array.from({ length: 12 }, (_, i) => { const o = obs[i]; return o ? new THREE.Vector4(o.x, o.z, o.r, o.light) : new THREE.Vector4(); }) },
		uC: { value: new THREE.Vector3(M.x, M.z, M.rad) }, uBand: { value: new THREE.Vector2(M.base, M.top) }, uSunC: { value: new THREE.Color(1, 1, 1) }, uHor: { value: new THREE.Color(0.7, 0.75, 0.8) },
		uWarm: { value: new THREE.Color(...glow) }, uDusk: { value: 0 }, uCov: { value: M.cover }, uHalf: { value: shared.biHalf || 1300 },
		uNight: { value: 0 }, uTime: shared.uTime, uK: { value: 1 }, uLit: { value: 1 }, uFlow: { value: 0 },
		uHeight: { value: shared.heightTex }, uSkyDusk: shared.uDuskSky || (shared.uDuskSky = { value: new THREE.Vector4(0, 1, 0, 0) }),
	};
	const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
	const mat = (v, f) => new THREE.ShaderMaterial({ uniforms: { ...fogU, ...U }, vertexShader: v, fragmentShader: f, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide });
	// the decks: thin layers through each band's depth (fewer in the upper), one draw
	const geos = [], seg = isPhone ? 30 : 52;
	let nL = 0;
	for (const [b, B] of M.bands.entries()) {
		const n = Math.max(2, Math.round((isPhone ? 4 : 7) * (b ? 0.6 : 1)));
		for (let i = 0; i < n; i++, nL++) {
			const t = (i + 0.5) / n, g = new THREE.PlaneGeometry(M.rad * 2, M.rad * 2, seg, seg).rotateX(-Math.PI / 2).translate(M.x, B.base + (B.top - B.base) * t, M.z);
			const a = new Float32Array(g.attributes.position.count * 3);
			for (let k = 0; k < a.length; k += 3) { a[k] = t; a[k + 1] = b; a[k + 2] = (B.top - B.base) * 0.6; }
			g.setAttribute('aL', new THREE.Float32BufferAttribute(a, 3));
			geos.push(g);
		}
	}
	const deckGeo = new THREE.BufferGeometry();
	{
		const pos = [], al = [], idx = [];
		let off = 0;
		for (const g of geos) {
			pos.push(...g.attributes.position.array); al.push(...g.attributes.aL.array);
			for (const k of g.index.array) idx.push(k + off);
			off += g.attributes.position.count;
			g.dispose();
		}
		deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		deckGeo.setAttribute('aL', new THREE.Float32BufferAttribute(al, 3));
		deckGeo.setIndex(idx);
	}
	const deckMat = mat(DECK_V, DECK_F);
	const deck = new THREE.Mesh(deckGeo, deckMat);
	deck.renderOrder = 4; deck.frustumCulled = false; deck.name = 'arch:mistdeck';
	group.add(deck);
	// the wisps streaming round the towers (and the struts in the band)
	const rnd = (() => { let s = (seed ^ 0x3157) >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
	const per = isPhone ? 7 : 14, W = [], T = [];
	for (const o of obs) {
		const n = o.tower ? per : Math.ceil(per / 3);
		for (let k = 0; k < n; k++) {
			const L = o.r * 9;
			W.push((rnd() < 0.5 ? -1 : 1) * o.r * (0.3 + rnd() * 1.6), rnd() * 2 * L, M.base + (M.top - M.base) * (0.25 + rnd() * 0.9), o.r * (1.4 + rnd() * 1.6));
			T.push(o.x, o.z, o.r, rnd());
		}
	}
	// wisps rising off the deck where it lies over low ground, and the far banks
	const H = heightAt;
	for (let k = 0, n = 0; k < 400 && n < (isPhone ? 14 : 34); k++) {
		const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * M.rad * 0.6, x = M.x + Math.sin(a) * d, z = M.z + Math.cos(a) * d;
		if (H(x, z) > M.top - 6) continue;
		n++;
		W.push(0, rnd(), M.top - 5 - rnd() * 6, 14 + rnd() * 16);
		T.push(x, z, -(18 + rnd() * 22), rnd());
	}
	for (const b of banks) for (let k = 0; k < (isPhone ? Math.ceil(b.n / 2) : b.n); k++) {
		const a = rnd() * Math.PI * 2, d = b.r * (0.75 + rnd() * 0.5);
		W.push(0, rnd(), b.y + (rnd() - 0.5) * b.size * 0.3, b.size * (0.7 + rnd() * 0.6));
		T.push(b.x + Math.sin(a) * d, b.z + Math.cos(a) * d, -b.rise * (0.5 + rnd() * 0.5), rnd());
	}
	let wisps = null;
	if (W.length) {
		const g = new THREE.InstancedBufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
		g.setIndex([0, 1, 2, 0, 2, 3]);
		g.setAttribute('aW', new THREE.InstancedBufferAttribute(new Float32Array(W), 4));
		g.setAttribute('aT', new THREE.InstancedBufferAttribute(new Float32Array(T), 4));
		g.instanceCount = W.length / 4;
		wisps = new THREE.Mesh(g, mat(WISP_V, WISP_F));
		wisps.renderOrder = 5; wisps.frustumCulled = false; wisps.name = 'arch:wisps';
		group.add(wisps);
	}
	// the veil: inside the band, the world goes white round you
	const veilMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
	const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat);
	veilMat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition = vec4(position, 1.0); gl_Position = vec4(position.xy, 0.0, 1.0);'); };
	veil.frustumCulled = false; veil.renderOrder = 999; veil.visible = false; veil.name = 'arch:veil';
	group.add(veil);
	scene.add(group);

	const sun = new THREE.Color(), hor = new THREE.Color(), cc = new THREE.Color(), tc = new THREE.Color(), tc2 = new THREE.Color();
	function update(dt, camera, night, indoors = false) {
		const w = shared.uWindDir?.value;
		if (w) U.uWd.value.copy(w).normalize();
		// the band drifts slower than the cloud aloft: a few metres a second
		const v = 2.5 + (shared.uWind?.value || 0.5) * 7;
		U.uOff.value.addScaledVector(U.uWd.value, v * dt);
		U.uFlow.value += v * dt;
		U.uNight.value = night;
		// the works' light in it from dusk on
		U.uDusk.value = Math.min(1, 0.25 + night * 1.2);
		if (shared.uSunColor) sun.copy(shared.uSunColor.value);
		if (shared.uSkyHor) hor.copy(shared.uSkyHor.value);
		U.uSunC.value.copy(sun); U.uHor.value.copy(hor);
		U.uLit.value = Math.max(0.15, Math.min(1, (shared.uSunDir?.value.y ?? 0.5) * 2 + 0.3));
		const p = camera.position, d = Math.hypot(p.x - M.x, p.z - M.z);
		group.visible = d < M.rad + 2500;
		// in a band: the veil, as thick as the cloud is here
		let inK = 0;
		for (const B of M.bands) inK = Math.max(inK, sm(B.base - 2, B.base + 5, p.y) * (1 - sm(B.top - 5, B.top + 3, p.y)) * (1 - sm(M.rad * 0.55, M.rad * 0.9, d)));
		// (not indoors: the rooms' glass keeps it out)
		if (indoors) inK = 0;
		if (inK > 0.01) {
			const qx = (p.x - U.uOff.value.x) * 0.0055 + 0.85, qz = (p.z - U.uOff.value.y) * 0.0055 + 0.85;
			const cov = sm(M.cover, M.cover + 0.26, mF(qx, qz) + 0.08);
			veilMat.opacity = inK * (0.25 + 0.6 * cov);
			tc.copy(sun).multiplyScalar(0.9).add(tc2.copy(hor).multiplyScalar(0.3));
			cc.copy(hor).multiplyScalar(0.72).lerp(tc, 0.6 * U.uLit.value);
			cc.lerp(tc.copy(hor).multiplyScalar(0.1), night * 0.88);
			const sk = U.uSkyDusk.value;
			cc.lerp(tc.setRGB(0.42, 0.28, 0.5).multiplyScalar(sk.y), sk.x * 0.85);
			veilMat.color.copy(cc);
			veil.visible = true;
		} else veil.visible = false;
		return inK;
	}
	function dispose() {
		deckGeo.dispose(); deckMat.dispose();
		if (wisps) { wisps.geometry.dispose(); wisps.material.dispose(); }
		veil.geometry.dispose(); veilMat.dispose();
		scene.remove(group);
	}
	return { update, dispose, group, U, layers: nL, wisps: W.length / 4 };
}
