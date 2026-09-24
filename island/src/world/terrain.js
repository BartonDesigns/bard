// One draw call of ground: a camera-centred grid, dense underfoot and sparse
// at the horizon, displaced on the GPU from the island height map and shaded
// by what it is: dry and wet sand, meadow, rock, worn dirt paths.

import * as THREE from 'three';
import { groundDetail } from './textures.js';

export function radialGrid(segments, radius, power) {
	// a square grid whose spacing grows with distance from the centre
	const g = new THREE.BufferGeometry();
	const n = segments + 1, pos = new Float32Array(n * n * 3), idx = [];
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		const u = i / segments * 2 - 1, v = j / segments * 2 - 1;
		const k = (j * n + i) * 3;
		pos[k] = Math.sign(u) * Math.pow(Math.abs(u), power) * radius;
		pos[k + 1] = 0;
		pos[k + 2] = Math.sign(v) * Math.pow(Math.abs(v), power) * radius;
	}
	for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
		const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
		idx.push(a, c, b, b, c, d);
	}
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setIndex(idx);
	g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
	return g;
}

export const HEIGHT_GLSL = /* glsl */`
uniform sampler2D uHeight; uniform float uHalf, uCell, uN;
float heightAt(vec2 w){
	vec2 f = clamp((w + uHalf) / uCell, vec2(0.0), vec2(uN - 1.001));
	vec2 i = floor(f), u = f - i, t = (i + 0.5) / uN; float px = 1.0 / uN;
	float a = texture2D(uHeight, t).r, b = texture2D(uHeight, t + vec2(px, 0.0)).r;
	float c = texture2D(uHeight, t + vec2(0.0, px)).r, d = texture2D(uHeight, t + vec2(px, px)).r;
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`;

export const NOISE_GLSL = /* glsl */`
// a fine-grain hash that stays random at island-scale coordinates: wrap the cell index
// first so float precision never runs out, then scramble
float gh(vec2 c){ c = mod(c, 1024.0); vec3 p3 = fract(vec3(c.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm3(vec2 p){ return vn(p) * 0.55 + vn(p * 2.03 + 7.1) * 0.3 + vn(p * 4.1 - 3.7) * 0.15; }`;

// ground occupancy near the player: r = bare shaded earth, g = soil mound around a stem
export const OCC_GLSL = /* glsl */`
uniform sampler2D uOcc; uniform vec3 uOccO;
vec2 occAt(vec2 w){
	vec2 u = (w - uOccO.xy) / uOccO.z;
	return texture2D(uOcc, u).rg * (1.0 - smoothstep(0.4, 0.49, max(abs(u.x - 0.5), abs(u.y - 0.5))));
}
float moundAt(vec2 w){ vec2 o = occAt(w); return o.g * 0.24 + o.r * 0.06; }`;

// The swash: each wave runs up the beach fast as a thinning sheet and drains back
// slowly. Two trains with different periods and a phase that wanders along the shore
// keep it from ever looking like one sheet of water breathing up and down.
// Returns the water's reach (a ground height) at w and time t; runMax is the
// highest reach there, the top of the wet band.
export const SWASH_GLSL = /* glsl */`
float swashRunMax(vec2 w, float wave){ return (0.42 + 0.32 * vn(w * 0.031 + 4.0)) * (0.55 + 0.45 * wave); }
float swashTrain(vec2 w, float t, float T, float off, float runMax){
	float ph = vn(w * 0.014 + off) * 2.4 + vn(w * 0.06 - off) * 0.35;
	float s = fract(t / T + ph);
	float up = s < 0.24 ? sin(s / 0.24 * 1.5708) : 1.0 - smoothstep(0.24, 1.0, s);   // quick rush, slow drain
	float k = 0.55 + 0.45 * vn(vec2(floor(t / T + ph) * 3.7, off));                   // some waves run further
	return mix(-0.3, runMax * k, up);
}
float swashLevel(vec2 w, float t, float wave){
	float rm = swashRunMax(w, wave);
	return max(swashTrain(w, t, 8.3, 1.7, rm), swashTrain(w, t, 11.9, 6.1, rm * 0.85));
}`;

export function makeHeightTexture(island) {
	const tex = new THREE.DataTexture(island.height, island.N, island.N, THREE.RedFormat, THREE.FloatType);
	tex.magFilter = tex.minFilter = THREE.NearestFilter;
	tex.needsUpdate = true;
	return tex;
}
export function makeMaskTexture(island) {
	const tex = new THREE.DataTexture(island.masks, island.N, island.N, THREE.RGBAFormat, THREE.UnsignedByteType);
	tex.magFilter = tex.minFilter = THREE.LinearFilter;
	tex.needsUpdate = true;
	return tex;
}

export function createTerrain(island, shared) {
	const geo = radialGrid(320, 2200, 2.3);
	const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
	const uniforms = {
		uHeight: { value: shared.heightTex }, uMasks: { value: shared.maskTex },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCenter: { value: new THREE.Vector2() }, uTime: shared.uTime, uWet: { value: 0 }, uWave: shared.uWave,
		uPrints: shared.uPrints, uPrintsO: shared.uPrintsO, uSunDir2: shared.uSunDir,
		uDetail: { value: groundDetail() }, uOcc: shared.uOcc, uOccO: shared.uOccO,
	};
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uniforms);
		sh.vertexShader = 'uniform vec2 uCenter;\nvarying vec3 vW;\nvarying vec3 vWN;\n' + HEIGHT_GLSL + '\n' + sh.vertexShader
			.replace('#include <beginnormal_vertex>', `
				vec2 wxz = position.xz + uCenter;
				float e = uCell;
				float hL = heightAt(wxz - vec2(e, 0.0)), hR = heightAt(wxz + vec2(e, 0.0));
				float hD = heightAt(wxz - vec2(0.0, e)), hU = heightAt(wxz + vec2(0.0, e));
				vec3 objectNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
				vWN = objectNormal;`)
			.replace('#include <begin_vertex>', `
				vec3 transformed = vec3(wxz.x, heightAt(wxz), wxz.y);
				vW = transformed;`);
		sh.fragmentShader = 'uniform sampler2D uMasks, uDetail, uPrints; uniform vec3 uPrintsO, uSunDir2; float gMoonGlint = 0.0; float gSparkle = 0.0; uniform float uHalf, uTime, uWet, uWave;\nvarying vec3 vW;\nvarying vec3 vWN;\nfloat gDetailH;\n' + OCC_GLSL + '\n' + NOISE_GLSL + '\n' + SWASH_GLSL + '\n' + sh.fragmentShader
			.replace('#include <map_fragment>', `
				vec2 muv = (vW.xz + uHalf) / (uHalf * 2.0);
				vec4 mk = texture2D(uMasks, muv);
				float n1 = fbm3(vW.xz * 0.06), n2 = vn(vW.xz * 0.9), n3 = vn(vW.xz * 7.0);
				// the slope from the smooth, interpolated normal (not each triangle's own facet)
				vec3 wn = normalize(vWN);
				float slope = 1.0 - clamp(wn.y, 0.0, 1.0);
				float h = vW.y;
				// sand: pale and dry above the tide line, darker and glossy at the wash
				vec3 sandDry = mix(vec3(0.86, 0.75, 0.55), vec3(0.93, 0.83, 0.64), n2) * (0.95 + 0.07 * n3);
				vec3 sandWet = vec3(0.56, 0.48, 0.36) * (0.9 + 0.12 * n2);
				// wet up to where the waves have been reaching, soaked where they are now,
				// drying (lighter, duller) toward the top of the band
				float swL = swashLevel(vW.xz, uTime, uWave), runM = swashRunMax(vW.xz, uWave);
				float band = 1.0 - smoothstep(runM - 0.06, runM + 0.1 + 0.05 * n2, h);
				float soak = 1.0 - smoothstep(swL - 0.02, swL + 0.12, h);
				float wet = max(band * 0.75, soak) * step(-2.0, h);
				// footprints in soft sand, smoothed away where the sea has been
				vec2 puv = (vW.xz - uPrintsO.xy) / uPrintsO.z;
				float print = texture2D(uPrints, puv).r * step(abs(puv.x - 0.5), 0.49) * step(abs(puv.y - 0.5), 0.49) * (1.0 - band * 0.8);
				vec3 sand = mix(sandDry, sandWet, wet);
				// meadow: several greens, sun-bleached patches, darker under growth
				vec3 g1 = vec3(0.26, 0.42, 0.08), g2 = vec3(0.42, 0.54, 0.12), g3 = vec3(0.56, 0.52, 0.20);
				vec3 grass = mix(g1, g2, smoothstep(0.35, 0.7, n1));
				grass = mix(grass, g3, smoothstep(0.62, 0.8, fbm3(vW.xz * 0.013 + 3.0)) * 0.7);
				grass *= 0.82 + 0.3 * n3;
				// forest floor: shaded, leaf-littered, a deep moss-brown under the canopy
				grass = mix(grass, vec3(0.20, 0.24, 0.10) * (0.85 + 0.3 * n2), smoothstep(0.2, 0.8, mk.a) * 0.8);
				vec3 rock = mix(vec3(0.36, 0.34, 0.31), vec3(0.52, 0.49, 0.44), n2) * (0.85 + 0.25 * n3);
				vec3 dirt = mix(vec3(0.46, 0.35, 0.23), vec3(0.60, 0.48, 0.33), n2) * (0.88 + 0.2 * n3);
				// the beach keeps its width, but its edge only wanders a little, so sand never
				// breaks out in patches up inside the meadow
				float grassW = smoothstep(1.4 + n1 * 0.5, 2.3 + n1 * 0.6, h);
				// close-up relief: two scales of the painted detail so it never reads as a tile
				float camD = length(cameraPosition - vW);
				float near = 1.0 - smoothstep(18.0, 70.0, camD);
				vec4 d1 = texture2D(uDetail, vW.xz * 0.42);
				vec4 d2 = texture2D(uDetail, vW.xz * 0.11 + 0.37);
				vec4 dd = mix(d2, d1 * 0.65 + d2 * 0.35, near);
				// sand ripples: wide and soft on the dry beach, tightening as the sand goes
				// under water (the waves pack them closer), with a gentle wander in spacing
				float under = smoothstep(0.2, -2.5, h);
				vec2 rq = vW.xz + vec2(vn(vW.xz * 0.05) * 3.0, 0.0);
				float rA = texture2D(uDetail, rq * 0.19).r, rB = texture2D(uDetail, rq * 0.42 + 0.21).r;
				dd.r = mix(rA, rB, under) * (0.8 + 0.4 * vn(vW.xz * 0.08 + 13.0));
				// sand and rock take the relief as grain; wet sand is smoothed by the wash
				sand *= 0.9 + 0.18 * dd.r * (1.0 - wet * 0.7);
				// grains: a fine speckle of darker mineral and pale shell fragments, only up close
				// round, soft grains about 8 mm across, fading out before they could alias
				vec2 gq = vW.xz * 120.0, gi = floor(gq), gf = fract(gq) - 0.5;
				float gA = gh(gi), gB = gh(gi + 17.0), gDot = 1.0 - smoothstep(0.18, 0.42, length(gf));
				float grainNear = 1.0 - smoothstep(1.5, 6.0, camD);
				sand *= 1.0 - step(0.955, gA) * gDot * 0.22 * grainNear;
				sand = mix(sand, vec3(0.98, 0.93, 0.88), step(0.985, gB) * gDot * 0.45 * grainNear);
				sand *= 0.96 + 0.08 * vn(vW.xz * 22.0);
				rock *= 0.78 + 0.36 * dd.a;
				// earth under the meadow: soil and litter show between the blades
				vec3 soil = mix(vec3(0.24, 0.19, 0.12), vec3(0.36, 0.30, 0.19), dd.b);
				vec3 meadowGround = mix(soil, grass, smoothstep(0.25, 0.7, mk.a * 0.4 + n1 * 0.6 + dd.b * 0.2) * 0.75 + 0.1);
				grass = mix(grass, meadowGround, near * 0.3);
				// paths: packed earth with gravel that catches the light
				dirt *= 0.88 + 0.22 * dd.g;
				dirt = mix(dirt, vec3(0.58, 0.54, 0.47), smoothstep(0.7, 0.95, dd.g) * 0.18);
				// sand -> sandy soil -> meadow, never a bright beige patch inside the grass
				vec3 sandySoil = mix(sandDry * vec3(0.78, 0.74, 0.62), meadowGround * 1.1, 0.35);
				vec3 col = mix(sand, sandySoil, smoothstep(0.0, 0.45, grassW));
				col = mix(col, grass, smoothstep(0.35, 1.0, grassW));
				float rockW = smoothstep(0.42, 0.62, slope + (n1 - 0.5) * 0.2) * step(0.9, h);
				col = mix(col, rock, rockW);
				float pathW = smoothstep(0.25, 0.75, mk.r + (dd.g - 0.5) * 0.25) * step(0.5, h);
				col = mix(col, dirt, pathW);
				// the height the bump reads, per ground type, in metres
				// ripples belong to open sand only, not to the meadow's edge
				float gs = 1.0 - smoothstep(0.0, 0.3, grassW);
				gDetailH = (dd.r * mix(0.016, 0.01, under) * gs * (1.0 - wet * 0.6) + dd.b * 0.03 * grassW) * (1.0 - rockW) * (1.0 - pathW)
					+ dd.a * 0.035 * rockW + dd.g * 0.012 * pathW;
				gDetailH *= near;
				// each footprint is a shallow dish in the sand
				gDetailH -= print * 0.05 * (1.0 - grassW);
				// under the sea: bleached sand going blue-green with depth
				col = mix(col, vec3(0.78, 0.74, 0.60), smoothstep(0.0, -1.0, h));
				col = mix(col, col * vec3(0.55, 0.62, 0.55), mk.b);
				// sunlight focused by the swell dances on the seabed
				float cA = 1.0 - abs(vn(vW.xz * 0.55 + vec2(uTime * 0.35, uTime * 0.2)) * 2.0 - 1.0);
				float cB = 1.0 - abs(vn(vW.xz * 0.7 - vec2(uTime * 0.28, -uTime * 0.31)) * 2.0 - 1.0);
				col += vec3(0.5, 0.6, 0.55) * pow(min(cA, cB), 6.0) * smoothstep(0.0, -0.8, h) * (1.0 - smoothstep(-2.0, -14.0, h)) * 1.6 * smoothstep(-0.02, 0.25, uSunDir2.y);
				// rooted: the earth under trees and shrubs is shaded, bare, damp and warm
				vec2 oc = occAt(vW.xz);
				float occ = oc.r;
				vec3 humus = mix(vec3(0.36, 0.28, 0.18), vec3(0.46, 0.38, 0.26), dd.b) * mix(1.0, 1.35, 1.0 - grassW);
				col = mix(col, humus, occ * 0.55 * step(0.4, h));
				col *= 1.0 - occ * 0.36;
				// damp, darker soil where a plant's roots hold it
				col *= 1.0 - oc.g * 0.1 * grassW;
				diffuseColor.rgb = col * col;   // authored in display space, lit in linear
				// soaked sand is a mirror for a moment (sun, moon); drying sand goes dull
				float rough = mix(0.97, mix(0.5, 0.14, soak), wet * (1.0 - grassW));
				diffuseColor.rgb *= 1.0 - print * 0.12;
				// moonlight catching the wet sand
				gMoonGlint = wet * (1.0 - grassW) * smoothstep(0.02, -0.15, uSunDir2.y);
				gSparkle = (1.0 - grassW) * (1.0 - pathW) * (1.0 - rockW) * step(0.0, h) * (1.0 - smoothstep(3.0, 14.0, camD)) * step(0.55, gh(floor(vW.xz * 70.0) + 3.0));`)
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rough;')
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				{
					vec3 Vv = normalize(cameraPosition - vW), md = normalize(-uSunDir2 + vec3(0.0, 0.35, 0.0));
					vec3 Rr = reflect(-Vv, normalize(vWN + vec3(0.0, 0.0, 0.0)));
					totalEmissiveRadiance += vec3(0.7, 0.78, 1.0) * gMoonGlint * (pow(max(dot(Rr, md), 0.0), 60.0) * 1.6 + pow(max(dot(Rr, md), 0.0), 8.0) * 0.08);
					// quartz grains glint: each grain a tiny mirror at its own angle
					vec2 gc = floor(vW.xz * 70.0);
					vec3 gn = normalize(vec3(gh(gc) - 0.5, 0.55, gh(gc + 7.0) - 0.5));
					vec3 gr = reflect(-Vv, gn);
					float sunG = pow(max(dot(gr, uSunDir2), 0.0), 700.0) * smoothstep(0.0, 0.15, uSunDir2.y);
					float moonG = pow(max(dot(gr, md), 0.0), 500.0) * smoothstep(0.02, -0.15, uSunDir2.y) * 0.5;
					totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * (sunG + moonG) * gSparkle * 14.0;
				
				}`)
			.replace('#include <normal_fragment_maps>', `
				// screen-space bump from the detail height (Mikkelsen)
				{
					vec3 sp = -vViewPosition;
					vec3 vSx = dFdx(sp), vSy = dFdy(sp);
					vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
					float fDet = dot(vSx, R1) * faceDirection;
					vec2 dH = vec2(dFdx(gDetailH), dFdy(gDetailH));
					vec3 vGrad = sign(fDet) * (dH.x * R1 + dH.y * R2);
					normal = normalize(abs(fDet) * normal - vGrad);
				}
				// the soil swells into a low mound around every stem: shade it as one
				{
					float e = 0.35;
					float mx = moundAt(vW.xz + vec2(e, 0.0)) - moundAt(vW.xz - vec2(e, 0.0));
					float mz = moundAt(vW.xz + vec2(0.0, e)) - moundAt(vW.xz - vec2(0.0, e));
					vec3 tilt = vec3(-mx, 0.0, -mz) / (2.0 * e);
					normal = normalize(normal + (viewMatrix * vec4(tilt, 0.0)).xyz);
				}`);
	};
	mat.customProgramCacheKey = () => 'island-terrain';
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.receiveShadow = true;
	mesh.name = 'terrain';
	mesh.userData.material175 = 'stone';
	mesh.userData.update = (cam) => {
		const snap = 4;
		uniforms.uCenter.value.set(Math.round(cam.position.x / snap) * snap, Math.round(cam.position.z / snap) * snap);
	};
	return mesh;
}
