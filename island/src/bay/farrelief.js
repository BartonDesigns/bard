// The far ring's relief, drawn once into a texture. The far ring's grid is a few hundred
// metres across 10-15 km out (Mt Diablo from San Ramon: 300 m), so the slope taken at its
// vertices drew a mountain as big flat facets, its gullies and spurs gone, and at a low sun
// each facet lit or dark as a whole. Reading the survey for the slope in every pixel of it
// took four more textures than a phone's ground shader has room for (16 at most, Apple's),
// so the slope and the fold of the land are drawn here instead, from the same surveys as the
// ground (the three finest in the slots, bay/terrain.js pickSlots, over the whole Bay's), into
// one map 40 km a side round you (32 on a phone), and the far ring reads that: one texture.
// Drawn again when you have gone a sixth of the way to its edge, or the slots or the surveys
// change (a lake filled, bay/levelrows.js). Each texel: the slope east and south (a square
// root's scale, so the gentle slopes the low sun picks out keep their fine steps in 8 bits)
// and the fold at the woods' 18 m scale, as the vertex takes it (vCurv.x).

import * as THREE from 'three';

// the map, its centre (x, z), 1 / its size, on (0 or 1): shared by the far ring's material
export const FAR_RELIEF_U = { uFRel: { value: null }, uFRelR: { value: new THREE.Vector4(0, 0, 1, 0) } };
// (the slope's range in the map: 3, about 72 degrees)
export const FAR_RELIEF_SLOPE = 3;

// The far ring's side: the slope and the fold from the map, eased into the vertex's own over
// the map's last 6% so its edge never shows. Derivatives taken before any branch.
export const FAR_RELIEF_GLSL = /* glsl */`
#define BAY_FAR_RELIEF
uniform sampler2D uFRel; uniform vec4 uFRelR;
vec3 bCurv = vec3(0.0), farN = vec3(0.0, 1.0, 0.0); float farK = 0.0;
void farRelief(){
	vec2 uv = (vBW - uFRelR.xy) * uFRelR.z + 0.5;
	vec2 gx = dFdx(uv), gy = dFdy(uv);
	if (vBOut > 0.0 || uFRelR.w < 0.5) return;
	vec2 e = min(uv, 1.0 - uv);
	float k = smoothstep(0.0, 0.06, min(e.x, e.y));
	if (k <= 0.0) return;
	vec3 r = textureGrad(uFRel, uv, gx, gy).rgb;
	vec2 s = r.xy * 2.0 - 1.0, g = sign(s) * s * s * ${FAR_RELIEF_SLOPE.toFixed(1)};
	farN = normalize(mix(normalize(vBN), normalize(vec3(-g.x, 1.0, -g.y)), k));
	farK = 1.0;
	bCurv.x = mix(bCurv.x, (r.z - 0.5) * 4.0, k);
}
`;

const BAKE_V = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const BAKE_F = /* glsl */`
precision highp float;
uniform highp sampler2D uB0, uBa, uBb, uBc; uniform vec4 uR0, uRa, uRb, uRc; uniform vec4 uWin; uniform int uN5;
varying vec2 vUv;
// (the surveys read filtered, as a pixel of the far ring would see them between its vertices)
float lv(highp sampler2D t, vec4 r, vec2 w){ vec2 S = vec2(textureSize(t, 0)); return textureLod(t, ((w - r.xy) / r.z + 0.5) / S, 0.0).r; }
float inL(highp sampler2D t, vec4 r, vec2 w, float m){ vec2 S = vec2(textureSize(t, 0)); vec2 f = (w - r.xy) / r.z; vec2 d = min(f, S - 1.0 - f) * r.z; return smoothstep(0.0, 1.0, clamp(min(d.x, d.y) / m, 0.0, 1.0)); }
float hAt(vec2 w){
	float h = lv(uB0, uR0, w);
	if (uRa.w > 0.0) { float k = inL(uBa, uRa, w, uRa.w); if (k > 0.0) h = mix(h, lv(uBa, uRa, w), k); }
	if (uRb.w > 0.0) { float k = inL(uBb, uRb, w, uRb.w); if (k > 0.0) h = mix(h, lv(uBb, uRb, w), k); }
	if (uRc.w > 0.0) { float k = inL(uBc, uRc, w, uRc.w); if (k > 0.0) h = mix(h, lv(uBc, uRc, w), k); }
	return h;
}
float enc(float g){ return 0.5 + 0.5 * sign(g) * sqrt(min(abs(g), ${FAR_RELIEF_SLOPE.toFixed(1)}) / ${FAR_RELIEF_SLOPE.toFixed(1)}); }
void main(){
	vec2 w = uWin.xy + (vUv - 0.5) * uWin.z;
	float e = uWin.w;
	const vec2 OFF[5] = vec2[5](vec2(0.0), vec2(-1.0, 0.0), vec2(1.0, 0.0), vec2(0.0, -1.0), vec2(0.0, 1.0));
	float hs[5];
	// (in a loop the compiler cannot unroll, so the height code is there once)
	for (int i = 0; i < uN5; i++) hs[i] = hAt(w + OFF[i] * e);
	vec2 g = vec2(hs[2] - hs[1], hs[4] - hs[3]) / (2.0 * e);
	float fold = (hs[1] + hs[2] + hs[3] + hs[4] - 4.0 * hs[0]) * (324.0 / (e * e)) / 6.0;
	gl_FragColor = vec4(enc(g.x), enc(g.y), 0.5 + clamp(fold, -2.0, 2.0) * 0.25, 1.0);
}
`;

// BU: the Bay's height uniforms (shared.bayU)
export function createFarRelief({ renderer, BU, isPhone = false }) {
	const N = isPhone ? 1024 : 2048, SPAN = isPhone ? 32000 : 40000;
	const rt = new THREE.WebGLRenderTarget(N, N, {
		type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
		minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true,
		wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
	});
	// (seen edge on, most of it: the map read along the slope as well as across)
	rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
	const uWin = { value: new THREE.Vector4() };
	const mat = new THREE.ShaderMaterial({
		uniforms: { uB0: BU.uB0, uBa: BU.uBa, uBb: BU.uBb, uBc: BU.uBc, uR0: BU.uR0, uRa: BU.uRa, uRb: BU.uRb, uRc: BU.uRc, uWin, uN5: { value: 5 } },
		vertexShader: BAKE_V, fragmentShader: BAKE_F, depthTest: false, depthWrite: false, toneMapped: false,
	});
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false;
	const bakeScene = new THREE.Scene(), bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	bakeScene.add(quad);
	let at = null, sig = -1, ready = false, warming = false, bakes = 0, bakedAt = 0, disposed = false;
	// what the map was drawn from: the slots' surveys, where they lie, and their versions
	const SL = ['0', 'a', 'b', 'c'];
	function signature() {
		let s = 0;
		for (let i = 0; i < 4; i++) {
			const t = BU['uB' + SL[i]].value, r = BU['uR' + SL[i]].value;
			if (i && !(r.w > 0)) continue;
			s += (i + 1) * ((t?.id || 0) * 7919 + (t?.version || 0)) + r.x * 1e-3 + r.y * 2e-3;
		}
		return s;
	}
	function bake(x, z) {
		// (on a 1 km grid, so a map drawn twice over the same ground is the same map)
		const cx = Math.round(x / 1000) * 1000, cz = Math.round(z / 1000) * 1000;
		uWin.value.set(cx, cz, SPAN, SPAN / N);
		const prev = renderer.getRenderTarget(), xr = renderer.xr.enabled;
		renderer.xr.enabled = false;
		renderer.setRenderTarget(rt);
		renderer.render(bakeScene, bakeCam);
		renderer.setRenderTarget(prev);
		renderer.xr.enabled = xr;
		FAR_RELIEF_U.uFRel.value = rt.texture;
		FAR_RELIEF_U.uFRelR.value.set(cx, cz, 1 / SPAN, 1);
		at = [cx, cz]; bakes++;
	}
	// pos: where you are; on: the Bay's ground drawn (its surveys in)
	function update(pos, on) {
		if (disposed) return;
		if (!on) return;
		if (!ready) {
			// (its shader built off the frame first, where the graphics can: no stall to draw it)
			if (!warming) {
				warming = true;
				const done = () => { ready = true; };
				if (renderer.compileAsync) renderer.compileAsync(quad, bakeCam, bakeScene).then(done, done); else done();
			}
			return;
		}
		const s = signature(), now = performance.now();
		// (a survey's rows edited as its lakes and creeks come in: drawn again once they settle,
		// two seconds apart at most)
		if (!at || Math.hypot(pos.x - at[0], pos.z - at[1]) > SPAN / 6 || (s !== sig && now - bakedAt > 2000)) {
			sig = s; bakedAt = now;
			bake(pos.x, pos.z);
		}
	}
	function dispose() {
		if (disposed) return;
		disposed = true;
		FAR_RELIEF_U.uFRelR.value.w = 0;
		FAR_RELIEF_U.uFRel.value = null;
		rt.dispose(); mat.dispose(); quad.geometry.dispose();
	}
	// (for checking from the console: the slope east and south and the fold the map holds at x, z)
	const px = new Uint8Array(4);
	function probe(x, z) {
		if (!at) return null;
		const i = Math.floor(((x - at[0]) / SPAN + 0.5) * N), j = Math.floor(((z - at[1]) / SPAN + 0.5) * N);
		if (i < 0 || j < 0 || i >= N || j >= N) return null;
		renderer.readRenderTargetPixels(rt, i, j, 1, 1, px);
		const dec = (v) => { const s = v / 255 * 2 - 1; return Math.sign(s) * s * s * FAR_RELIEF_SLOPE; };
		return [dec(px[0]), dec(px[1]), (px[2] / 255 - 0.5) * 4];
	}
	return { update, dispose, probe, info: () => ({ at, bakes, N, SPAN, ready }) };
}
