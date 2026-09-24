// One draw call of ground: a camera-centred grid, dense underfoot and sparse
// at the horizon, displaced on the GPU from the island height map and shaded
// by what it is: dry and wet sand, meadow, rock, worn dirt paths.

import * as THREE from 'three';

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
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm3(vec2 p){ return vn(p) * 0.55 + vn(p * 2.03 + 7.1) * 0.3 + vn(p * 4.1 - 3.7) * 0.15; }`;

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
	const geo = radialGrid(255, 2200, 2.3);
	const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
	const uniforms = {
		uHeight: { value: shared.heightTex }, uMasks: { value: shared.maskTex },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCenter: { value: new THREE.Vector2() }, uTime: shared.uTime, uWet: { value: 0 },
	};
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uniforms);
		sh.vertexShader = 'uniform vec2 uCenter;\nvarying vec3 vW;\n' + HEIGHT_GLSL + '\n' + sh.vertexShader
			.replace('#include <beginnormal_vertex>', `
				vec2 wxz = position.xz + uCenter;
				float e = uCell;
				float hL = heightAt(wxz - vec2(e, 0.0)), hR = heightAt(wxz + vec2(e, 0.0));
				float hD = heightAt(wxz - vec2(0.0, e)), hU = heightAt(wxz + vec2(0.0, e));
				vec3 objectNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));`)
			.replace('#include <begin_vertex>', `
				vec3 transformed = vec3(wxz.x, heightAt(wxz), wxz.y);
				vW = transformed;`);
		sh.fragmentShader = 'uniform sampler2D uMasks; uniform float uHalf, uTime, uWet;\nvarying vec3 vW;\n' + NOISE_GLSL + '\n' + sh.fragmentShader
			.replace('#include <map_fragment>', `
				vec2 muv = (vW.xz + uHalf) / (uHalf * 2.0);
				vec4 mk = texture2D(uMasks, muv);
				float n1 = fbm3(vW.xz * 0.06), n2 = vn(vW.xz * 0.9), n3 = vn(vW.xz * 7.0);
				vec3 wn = normalize(cross(dFdx(vW), dFdy(vW)));
				float slope = 1.0 - clamp(wn.y, 0.0, 1.0);
				float h = vW.y;
				// sand: pale and dry above the tide line, darker and glossy at the wash
				vec3 sandDry = mix(vec3(0.83, 0.74, 0.57), vec3(0.90, 0.82, 0.66), n2) * (0.93 + 0.1 * n3);
				vec3 sandWet = vec3(0.58, 0.50, 0.38) * (0.9 + 0.12 * n2);
				float wet = 1.0 - smoothstep(0.15, 0.9 + 0.3 * n1, h);
				vec3 sand = mix(sandDry, sandWet, wet);
				// meadow: several greens, sun-bleached patches, darker under growth
				vec3 g1 = vec3(0.20, 0.34, 0.09), g2 = vec3(0.34, 0.44, 0.13), g3 = vec3(0.47, 0.46, 0.20);
				vec3 grass = mix(g1, g2, smoothstep(0.35, 0.7, n1));
				grass = mix(grass, g3, smoothstep(0.62, 0.8, fbm3(vW.xz * 0.013 + 3.0)) * 0.7);
				grass *= 0.82 + 0.3 * n3;
				grass = mix(grass, grass * 0.72, mk.a * 0.45);
				vec3 rock = mix(vec3(0.36, 0.34, 0.31), vec3(0.52, 0.49, 0.44), n2) * (0.85 + 0.25 * n3);
				vec3 dirt = mix(vec3(0.46, 0.35, 0.23), vec3(0.60, 0.48, 0.33), n2) * (0.88 + 0.2 * n3);
				float grassW = smoothstep(1.2 + n1 * 1.6, 2.6 + n1 * 1.8, h);
				vec3 col = mix(sand, grass, grassW);
				col = mix(col, rock, smoothstep(0.42, 0.62, slope + (n1 - 0.5) * 0.2) * step(0.9, h));
				col = mix(col, dirt, smoothstep(0.25, 0.75, mk.r) * step(0.5, h));
				// under the sea: bleached sand going blue-green with depth
				col = mix(col, vec3(0.78, 0.74, 0.60), smoothstep(0.0, -1.0, h));
				col = mix(col, col * vec3(0.55, 0.62, 0.55), mk.b);
				diffuseColor.rgb = col * col;   // authored in display space, lit in linear
				float rough = mix(0.97, 0.42, wet * (1.0 - grassW));`)
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rough;')
			.replace('#include <normal_fragment_maps>', `
				// fine relief so the ground has give: tufts on the meadow, grain in the sand
				normal = normalize(normal + (vec3(n3 - 0.5, 0.0, n2 - 0.5)) * (0.18 * grassW + 0.08));`);
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
