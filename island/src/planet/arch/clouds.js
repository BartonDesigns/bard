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
`;
// the sky's light on it: sunlit above, cooler beneath, dark by night with the windows warm in it
const SHADE = /* glsl */`
vec3 mistC(float up, float n, float glow){
	vec3 c = mix(uHor * 0.6, uSunC * 0.9 + uHor * 0.35, (0.3 + 0.7 * up) * uLit) * (0.55 + 0.7 * n * (0.4 + 0.6 * up));
	c = mix(c, uHor * 0.1 + vec3(0.015, 0.02, 0.035), uNight * 0.88);
	return c + uWarm * glow * uDusk * (1.4 - up * 0.6);
}
`;

const DECK_V = /* glsl */`
attribute float aL;
varying vec3 vW;
varying float vL;
#include <fog_pars_vertex>
void main(){
	vec4 w = modelMatrix * vec4(position, 1.0);
	vW = w.xyz; vL = aL;
	vec4 mvPosition = viewMatrix * w;
	gl_Position = projectionMatrix * mvPosition;
	#include <fog_vertex>
}`;
const DECK_F = /* glsl */`
${COMMON}
uniform sampler2D uHeight;
varying vec3 vW;
varying float vL;
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
		glow += o.w * exp(-r / (R * 2.2));
	}
	float n = mF((q - uOff) * 0.0055 + vL * 1.7);
	float mid = 1.0 - abs(vL * 2.0 - 1.0);
	float cov = smoothstep(uCov, uCov + 0.16, n + mid * 0.14 - 0.05 - (1.0 - mid) * 0.08);
	float g = texture2D(uHeight, (p + uHalf) / (2.0 * uHalf)).r;
	float lift = glow * uDusk;
	float a = min(1.0, cov * (1.0 + lift * 0.9) + lift * 0.12) * hole * smoothstep(0.0, 9.0, vW.y - g) * (1.0 - smoothstep(uC.z * 0.6, uC.z, length(p - uC.xy)));
	a *= smoothstep(0.5, 8.0, abs(cameraPosition.y - vW.y)) * uK * 0.5;
	if (a < 0.004) discard;
	gl_FragColor = vec4(mistC(vL, n, glow), a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
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
	float R = aT.z, L = R * 9.0;
	float s = mod(aW.y + uFlow * (0.8 + 0.4 * fract(aT.w)), 2.0 * L) - L;
	float e = exp(-s * s / (R * R * 5.0));
	float bb = sign(aW.x) * sqrt(aW.x * aW.x + R * R * e * 1.2);
	vec3 c = vec3(aT.x, aW.z, aT.y) + vec3(uWd.x, 0.0, uWd.y) * s + vec3(ac.x, 0.0, ac.y) * bb;
	c.y += sin(uTime * 0.25 + aT.w * 6.0 + s * 0.04) * 2.5;
	vec4 mvPosition = viewMatrix * vec4(c, 1.0);
	mvPosition.xy += position.xy * aW.w * (0.85 + 0.5 * e);
	vUv = position.xy * 2.0; vS = aT.w; vUp = clamp((aW.z - uBand.x) / (uBand.y - uBand.x), 0.0, 1.0);
	vA = (1.0 - smoothstep(0.55, 1.0, abs(s) / L)) * smoothstep(6.0, 40.0, -mvPosition.z);
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
	gl_FragColor = vec4(mistC(vUp, n, 0.6), a);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`;

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

// M: the plan's mist { base, top, cover, x, z, rad }; obs: [{ x, z, r, light, tower }]
export function createMist(scene, shared, M, obs, { isPhone = false, seed = 1, glow = [1.0, 0.45, 0.65] } = {}) {
	const group = new THREE.Group();
	group.name = 'arch:mist';
	const wd = shared.uWindDir?.value || new THREE.Vector2(1, 0);
	const U = {
		uOff: { value: new THREE.Vector2() }, uWd: { value: new THREE.Vector2(wd.x, wd.y) },
		uObs: { value: Array.from({ length: 12 }, (_, i) => { const o = obs[i]; return o ? new THREE.Vector4(o.x, o.z, o.r, o.light) : new THREE.Vector4(); }) },
		uC: { value: new THREE.Vector3(M.x, M.z, M.rad) }, uBand: { value: new THREE.Vector2(M.base, M.top) }, uSunC: { value: new THREE.Color(1, 1, 1) }, uHor: { value: new THREE.Color(0.7, 0.75, 0.8) },
		uWarm: { value: new THREE.Color(...glow) }, uDusk: { value: 0 }, uCov: { value: M.cover }, uHalf: { value: shared.biHalf || 1300 },
		uNight: { value: 0 }, uTime: shared.uTime, uK: { value: 1 }, uLit: { value: 1 }, uFlow: { value: 0 },
		uHeight: { value: shared.heightTex },
	};
	const fogU = THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
	const mat = (v, f) => new THREE.ShaderMaterial({ uniforms: { ...fogU, ...U }, vertexShader: v, fragmentShader: f, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide });
	// the deck: thin layers through the band's depth, one draw
	const nL = isPhone ? 4 : 7, geos = [];
	for (let i = 0; i < nL; i++) {
		const t = (i + 0.5) / nL, g = new THREE.CircleGeometry(M.rad, 56).rotateX(-Math.PI / 2).translate(M.x, M.base + (M.top - M.base) * t, M.z);
		g.setAttribute('aL', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(t), 1));
		geos.push(g);
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
		deckGeo.setAttribute('aL', new THREE.Float32BufferAttribute(al, 1));
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
	function update(dt, camera, night) {
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
		// in the band: the veil, as thick as the cloud is here
		const inK = sm(M.base - 2, M.base + 5, p.y) * (1 - sm(M.top - 5, M.top + 3, p.y)) * (1 - sm(M.rad * 0.55, M.rad * 0.9, d));
		if (inK > 0.01) {
			const qx = (p.x - U.uOff.value.x) * 0.0055 + 0.85, qz = (p.z - U.uOff.value.y) * 0.0055 + 0.85;
			const cov = sm(M.cover, M.cover + 0.26, mF(qx, qz) + 0.08);
			veilMat.opacity = inK * (0.25 + 0.6 * cov);
			tc.copy(sun).multiplyScalar(0.9).add(tc2.copy(hor).multiplyScalar(0.3));
			cc.copy(hor).multiplyScalar(0.72).lerp(tc, 0.6 * U.uLit.value);
			cc.lerp(tc.copy(hor).multiplyScalar(0.1), night * 0.88);
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
