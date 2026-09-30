// The globe's ground, drawn: two rings round you like the Bay's (a fine one out to 6 km, a
// coarse one out to 250 km with a hole where the fine one is), their heights made on the GPU
// from globeheight.js, and a third, flat, for the big lakes' water. Its own material, so the
// Bay's full sampler budget is never touched: 6 textures in the vertex stage, 4 plus the
// shadow map in the fragment.
//
// Near the Bay, in the Bay's frame, it draws only past the survey (3 km out from its edge,
// where the Bay's rings stop) and there blends the Bay's own carried-out ground (beyondH)
// into the globe's over the next 22 km, as bay/terrain.js's groundAt does on the CPU.
//
// The colours are the place's: its two ground colours from the atlas, tree cover and its
// kind by warmth, rock on the steep, snow where the air at that height is cold enough the
// year round, sand at the shore, fields where it is wet enough to farm and flat enough, and
// the towns and cities (grey by day, lit by night) round the atlas's cities near you.

import * as THREE from 'three';
import { radialGrid } from '../world/terrain.js';
import { BAY_GLSL } from '../bay/terrain.js';
import { WC_U, WC_GLSL } from '../bay/watercarve.js';
import { GLOBE_GLSL, OCT } from './globeheight.js';

export const SEAM_A = 3000, SEAM_B = 25000;     // m past the Bay's survey: the Bay's ground stops, the globe's is whole
const CITIES = 12;

const FRAG_GLSL = /* glsl */`
uniform highp sampler2D uGT2, uGT3, uGT4; uniform vec4 uGWin; uniform ivec3 uGI0; uniform vec3 uGF0; uniform vec2 uGSeam; uniform float uGBay, uGNight;
uniform vec4 uGHole; uniform vec4 uGCity[${CITIES}]; uniform float uGIsl, uGDebug;
varying vec3 vGW; varying vec3 vGN; varying vec3 vGP; varying vec4 vGC; varying vec2 vGCC;
float gfH(ivec3 p, uint s){ uint h = (uint(p.x) * 374761393u) ^ (uint(p.y) * 668265263u) ^ (uint(p.z) * 2246822519u) ^ s; h = (h ^ (h >> 13u)) * 1274126177u; h ^= h >> 16u; return float(h >> 8u) / 16777216.0; }
// value noise on the sphere at 8192 / 2^k metres (the same lattice as the relief)
float gfN(int k, uint s){
	float m = float(1 << k); vec3 t = uGF0 * m + vGP * m, ft = floor(t), f = t - ft, u = f * f * (3.0 - 2.0 * f);
	ivec3 i = uGI0 * (1 << k) + ivec3(ft);
	float a = gfH(i, s), b = gfH(i + ivec3(1, 0, 0), s), c = gfH(i + ivec3(0, 1, 0), s), d = gfH(i + ivec3(1, 1, 0), s);
	float e = gfH(i + ivec3(0, 0, 1), s), g = gfH(i + ivec3(1, 0, 1), s), h = gfH(i + ivec3(0, 1, 1), s), q = gfH(i + ivec3(1, 1, 1), s);
	return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, q, u.x), u.y), u.z);
}
// the cell of the lattice a point is in, as a number (fields)
float gfCell(int k, uint s){ float m = float(1 << k); vec3 t = uGF0 * m + vGP * m; return gfH(uGI0 * (1 << k) + ivec3(floor(t)), s); }
vec3 gLin(vec3 c){ return pow(c, vec3(2.2)); }
`;

export function createGlobeTerrain({ scene, data, BU, isPhone }) {
	const group = new THREE.Group();
	group.name = 'globe';
	scene.add(group);
	const U = data.U;
	const common = {
		uGSeam: { value: new THREE.Vector2(SEAM_A, SEAM_B) }, uGBay: { value: 1 }, uGF: { value: new THREE.Vector2() },
		uGIsl: { value: 1400 }, uGNight: { value: 0 }, uGDebug: { value: 0 }, uGCity: { value: Array.from({ length: CITIES }, () => new THREE.Vector4(0, 0, 0, 0)) },
	};
	function material(grid, oct, hole) {
		const m = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
		const own = { uGGrid: { value: new THREE.Vector3(...grid) }, uGOct: { value: oct }, uGHole: { value: new THREE.Vector4(0, 0, hole ? 1 : 0, 0) }, uGOff: { value: new THREE.Vector2() } };
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, BU, WC_U, U, common, own, { uGT3: { value: data.tex[3] }, uGT4: { value: data.tex[4] } });
			sh.uniforms.uGT0 = { get value() { return data.tex[0]; } }; sh.uniforms.uGT1 = { get value() { return data.tex[1]; } }; sh.uniforms.uGT2 = { get value() { return data.tex[2]; } };
			sh.vertexShader = 'uniform vec2 uGSeam, uGF; uniform float uGBay, uGOct; uniform vec3 uGGrid;\nvarying vec3 vGW; varying vec3 vGN; varying vec3 vGP; varying vec4 vGC; varying vec2 vGCC;\n' + BAY_GLSL + WC_GLSL + GLOBE_GLSL + `
				vec3 gDP;
				float gOut(vec2 w){ if (uGBay < 0.5) return 1e9; vec2 S0 = vec2(textureSize(uB0, 0)), q0 = (w - uR0.xy) / uR0.z; return length(max(vec2(0.0), max(-q0, q0 - (S0 - 1.0)))) * uR0.z; }
				float gGround(vec2 d, float oct){
					float g = globeHeight(d, oct);
					if (uGBay > 0.5) { float o = gOut(d), k = smoothstep(uGSeam.x, uGSeam.y, o); if (k < 1.0) g = mix(beyondH(d, bLevel(uB0, uR0, d), o), g, k); }
					return g;
				}
			` + sh.vertexShader
				.replace('#include <beginnormal_vertex>', `
					vec2 gd = position.xz + uGOff;
					float gr = max(abs(position.x), abs(position.z));
					float gsp = max(0.3, 2.0 * uGGrid.y * uGGrid.x * pow(max(1e-4, pow(gr / uGGrid.x, 1.0 / uGGrid.y)), uGGrid.y - 1.0) / uGGrid.z);
					float goct = clamp(log2(${8192}.0 / (2.5 * gsp)) + 1.0, 1.0, uGOct);
					float ge = max(2.0, gsp);
					float gx = gGround(gd + vec2(ge, 0.0), goct), gz = gGround(gd + vec2(0.0, ge), goct);
					float gh = gGround(gd, goct);
					vGC = vec4(gCoast, gLake, gLevel, gOut(gd));
					vGP = ${'vec3(0.0)'};
					{
						// (the sphere's metres again, for the fragment's patches: cheap, the angles only)
						float dph = -gd.y * uGDeg.y * ${Math.PI / 180}, dla = gd.x * uGDeg.x * ${Math.PI / 180};
						float hp = sin(dph * 0.5), hl = sin(dla * 0.5), sp = sin(dph), sl = sin(dla);
						float dcp = -2.0 * hp * hp * uGAnc.y - sp * uGAnc.x, dsp = -2.0 * hp * hp * uGAnc.x + sp * uGAnc.y;
						float dcl = -2.0 * hl * hl * uGAnc.w - sl * uGAnc.z, dsl = -2.0 * hl * hl * uGAnc.z + sl * uGAnc.w;
						vGP = ${6371000}.0 * vec3(dcp * (uGAnc.w + dcl) + uGAnc.y * dcl, dcp * (uGAnc.z + dsl) + uGAnc.y * dsl, dsp) / ${8192}.0;
					}
					vec2 gw = gd + uGF;
					float gwc = wcAt(gw).r * wcK(gw);
					gh += gwc;
					vec3 objectNormal = normalize(vec3(gh - gwc - gx, ge, gh - gwc - gz));
					vGN = objectNormal;
					vGCC = uGWin.xy + gd * uGWin.zw;
				`)
				.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, gh, position.z); vGW = vec3(gd.x, gh, gd.y);');
			sh.fragmentShader = FRAG_GLSL + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
					if (uGBay > 0.5 && (vGC.w < uGSeam.x || max(abs(vGW.x), abs(vGW.z)) < uGIsl)) discard;          // the Bay's own ground is there
					if (uGHole.z > 0.5 && max(abs(vGW.x - uGHole.x), abs(vGW.z - uGHole.y)) < uGHole.w) discard;    // the fine ring draws here`)
				.replace('#include <color_fragment>', `#include <color_fragment>
				{
					vec3 n = normalize(vGN); float slope = 1.0 - n.y, h = vGW.y;
					vec2 uv = (vGCC + 0.5) / vec2(textureSize(uGT3, 0));
					vec4 t2 = texture(uGT2, uv), t3 = texture(uGT3, uv), t4 = texture(uGT4, uv);
					float temp = t3.a * 255.0 / 4.0 - 30.0, rainS = t4.a * 255.0 / 4.0, rain = rainS * rainS, trees = t2.a;
					float dist = length(vViewPosition);
					// patches on the sphere: 2 km, 512 m and 128 m (the finest fades out far off)
					float pB = gfN(2, 11u), pM = gfN(4, 23u), pS = mix(0.5, gfN(6, 37u), 1.0 - smoothstep(1500.0, 5000.0, dist));
					vec3 gA = gLin(t3.rgb), gB = gLin(t4.rgb);
					vec3 c = mix(gA, gB, smoothstep(0.3, 0.7, pB * 0.55 + pM * 0.3 + pS * 0.15));
					// the grass greener where it rains, straw where it doesn't
					c = mix(c, c * vec3(0.8, 1.02, 0.7), smoothstep(500.0, 1300.0, rain) * 0.5);
					// the air up here: the atlas's warmth is the place's lived-in ground (taken as 800 m up)
					// cooled 6.5 C a km above it. Trees up to the tree line, not on cliffs
					float air = temp - 6.5 * max(0.0, h - 800.0) / 1000.0;
					float forest = smoothstep(0.3, 0.7, trees + (pM - 0.5) * 0.7 + (pS - 0.5) * 0.25) * smoothstep(-4.5, -2.0, air) * (1.0 - smoothstep(0.55, 0.85, slope));
					vec3 wood = mix(vec3(0.028, 0.05, 0.03), vec3(0.045, 0.075, 0.025), smoothstep(4.0, 14.0, temp));
					wood = mix(wood, vec3(0.035, 0.085, 0.02), smoothstep(20.0, 26.0, temp));
					// fields where it is wet and warm enough, and gentle: a patchwork, not woods
					float farm = (1.0 - forest) * smoothstep(350.0, 650.0, rain) * smoothstep(3.0, 9.0, temp) * (1.0 - smoothstep(0.08, 0.2, slope)) * (1.0 - smoothstep(1200.0, 2200.0, h)) * smoothstep(0.2, 0.45, 1.0 - trees);
					float fid = gfCell(4, 51u), fid2 = gfCell(5, 53u);
					vec3 crop = fid < 0.3 ? vec3(0.07, 0.12, 0.03) : fid < 0.55 ? vec3(0.3, 0.25, 0.1) : fid < 0.75 ? vec3(0.13, 0.09, 0.05) : mix(gA, vec3(0.1, 0.13, 0.05), 0.4);
					crop *= 0.85 + 0.3 * fid2;
					c = mix(c, crop, farm * smoothstep(0.3, 0.6, pB + 0.25) * (1.0 - smoothstep(8000.0, 30000.0, dist) * 0.6));
					c = mix(c, wood, forest);
					// rock on the steep ground, and above the plants
					float rockK = max(smoothstep(0.42, 0.7, slope + (pS - 0.5) * 0.15), (1.0 - smoothstep(-5.0, -3.0, air)) * 0.7);
					c = mix(c, mix(vec3(0.3, 0.29, 0.27), gA * 0.8, 0.35), rockK);
					// snow where the air up here stays cold enough to keep it through the summer, off the cliffs
					float snowK = (1.0 - smoothstep(-8.5, -5.5, air + (pM - 0.5) * 3.0)) * (1.0 - smoothstep(0.6, 0.9, slope));
					c = mix(c, vec3(0.86, 0.88, 0.92), snowK);
					// the shore: sand on the gentle ground just above the water
					float shore = (1.0 - smoothstep(0.0, 0.035, vGC.x)) * (1.0 - smoothstep(vGC.z + 2.0, vGC.z + 6.0, h)) * (1.0 - smoothstep(0.12, 0.3, slope));
					c = mix(c, mix(vec3(0.62, 0.56, 0.42), gA, 0.3), shore * step(0.0, vGC.x - 0.0));
					// under water: the bed darkens
					c = mix(c, c * vec3(0.5, 0.6, 0.6), (1.0 - smoothstep(vGC.z - 6.0, vGC.z, h)));
					// the towns and cities round you: built ground, and their lights after dark
					float urb = 0.0;
					for (int i = 0; i < ${CITIES}; i++) {
						vec4 C = uGCity[i];
						if (C.z <= 0.0) continue;
						float dd = length(vGW.xz - C.xy) / C.z;
						urb = max(urb, exp(-dd * dd * dd * 1.2) * C.w);
					}
					urb *= (1.0 - smoothstep(0.25, 0.45, slope)) * step(0.0, vGC.x);
					if (urb > 0.01) {
						float blk = gfCell(7, 71u), street = 1.0 - smoothstep(0.02, 0.06, min(fract(vGW.x / 110.0), fract(vGW.z / 110.0)));
						vec3 built = mix(vec3(0.22, 0.21, 0.2), vec3(0.4, 0.37, 0.33), blk) * (1.0 - street * 0.45);
						c = mix(c, built, smoothstep(0.08, 0.5, urb) * (1.0 - smoothstep(20000.0, 60000.0, dist) * 0.5));
						gCityGlow = vec3(1.0, 0.72, 0.4) * uGNight * smoothstep(0.1, 0.6, urb) * (0.25 + 0.75 * step(0.55, blk + street * 0.5)) * 0.35;
					}
					diffuseColor.rgb = c;
					if (uGDebug > 0.5) diffuseColor.rgb = uGDebug < 1.5 ? t3.rgb : uGDebug < 2.5 ? vec3(t3.a, t4.a, t2.a) : vec3(fract(h / 500.0), snowK, forest);
				}`)
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gCityGlow;');
			sh.fragmentShader = 'vec3 gCityGlow = vec3(0.0);\n' + sh.fragmentShader;
		};
		m.customProgramCacheKey = () => 'globeground1';
		m.userData.own = own;
		return m;
	}
	// the rings: n segments, the reach, how fast the spacing grows
	const NEAR = isPhone ? [160, 6000, 2.2] : [256, 6000, 2.2], FARG = isPhone ? [128, 250000, 2.8] : [192, 250000, 2.7];
	const nearMat = material(NEAR, isPhone ? 8 : OCT, false), farMat = material(FARG, isPhone ? 7 : 9, true);
	const near = new THREE.Mesh(radialGrid(...NEAR), nearMat), far = new THREE.Mesh(radialGrid(...FARG), farMat);
	for (const m of [near, far]) { m.frustumCulled = false; m.receiveShadow = true; m.userData.material175 = 'stone'; group.add(m); }
	near.visible = far.visible = false;

	// the big lakes' water: flat at each lake's level, only where the lake is
	const lakeMat = new THREE.MeshStandardMaterial({ color: 0x1d4a5c, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 });
	const lakeOff = { value: new THREE.Vector2() };
	lakeMat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U, common, { uGOff: lakeOff });
		sh.uniforms.uGT0 = { get value() { return data.tex[0]; } }; sh.uniforms.uGT1 = { get value() { return data.tex[1]; } }; sh.uniforms.uGT2 = { get value() { return data.tex[2]; } };
		sh.vertexShader = 'uniform float uGBay; varying float vLk; varying vec2 vLd;\n' + GLOBE_GLSL + sh.vertexShader
			.replace('#include <begin_vertex>', `vec2 gd = position.xz + uGOff; float gh = globeHeight(gd, 5.0); vLk = gLake * step(gh, gLevel - 0.3) * step(1.0, gLevel); vLd = gd;
				vec3 transformed = vec3(position.x, gLevel, position.z);`);
		sh.fragmentShader = 'varying float vLk; varying vec2 vLd; uniform float uGIsl;\n' + sh.fragmentShader
			.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vLk < 0.5) discard;');
	};
	lakeMat.customProgramCacheKey = () => 'globelake1';
	const lakes = new THREE.Mesh(radialGrid(isPhone ? 96 : 160, 60000, 2.4), lakeMat);
	lakes.frustumCulled = false; lakes.visible = false; lakes.renderOrder = 1;
	group.add(lakes);

	// place the rings round the camera; bayOut: how far past the Bay's survey the camera is (m)
	function update(cam, F, { bay, bayOut, night, cities, on: may = true }) {
		const on = data.win.ready && may;
		const x = cam.position.x, z = cam.position.z;
		// (in the Bay's frame the fine ring is only wanted near the survey's edge and past it)
		near.visible = on && (!bay || bayOut > SEAM_A - 7000);
		far.visible = lakes.visible = on;
		if (!on) return;
		common.uGBay.value = bay ? 1 : 0;
		common.uGF.value.set(F.fx, F.fz);
		common.uGNight.value = night;
		const nx = Math.round(x / 32) * 32, nz = Math.round(z / 32) * 32, fx = Math.round(x / 512) * 512, fz = Math.round(z / 512) * 512;
		near.position.set(nx, 0, nz); far.position.set(fx, 0, fz); lakes.position.set(fx, 0, fz);
		// each ring's offset from the anchor (the GPU adds its own few km to it)
		nearMat.userData.own.uGOff.value.set(nx - F.fx, nz - F.fz); farMat.userData.own.uGOff.value.set(fx - F.fx, fz - F.fz); lakeOff.value.set(fx - F.fx, fz - F.fz);
		farMat.userData.own.uGHole.value.set(nx - F.fx, nz - F.fz, near.visible ? 1 : 0, NEAR[1] * 0.97);
		// the cities round you (anchor-relative: x, z, reach, how built up)
		for (let i = 0; i < CITIES; i++) { const c = cities[i]; if (c) common.uGCity.value[i].set(c.x - F.fx, c.z - F.fz, c.r, c.k); else common.uGCity.value[i].set(0, 0, 0, 0); }
	}
	return { group, update, near, far, lakes, materials: [nearMat, farMat, lakeMat], debug: (v) => { common.uGDebug.value = v; } };
}
