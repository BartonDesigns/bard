// How the underground is lit and what its surfaces are made of. There is no sun down
// there: every material here keeps the daylight only as far as it reaches in from a
// mouth or down a sinkhole (measured in the shader from the depth under the ground), and
// is lit instead by what glows: fungus, crystals, lava, lamps and fires. Those are mostly
// not real lights but a short list of glowing places (the nearest few, chosen each frame)
// that every cave surface adds in itself, with a soft falloff.

import * as THREE from 'three';
import { HEIGHT_GLSL } from '../world/terrain.js';
import { addPulse } from '../pulse.js';

export const FAKE = 10;     // glowing places lighting each surface

// ---------- a tiling rock detail texture: normal (rg), height (b), cracks (a) ----------
let detailTex = null;
export function rockDetail() {
	if (detailTex) return detailTex;
	const N = 256, P = 16;
	const hash = (i, j, s) => { let h = Math.imul(i * 374761393 + j * 668265263 + s * 1440662683, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
	// periodic value noise: period p cells over the tile
	const vn = (x, y, p, s) => {
		const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
		const a = hash(((xi % p) + p) % p, ((yi % p) + p) % p, s), b = hash((((xi + 1) % p) + p) % p, ((yi % p) + p) % p, s);
		const c = hash(((xi % p) + p) % p, (((yi + 1) % p) + p) % p, s), d = hash((((xi + 1) % p) + p) % p, (((yi + 1) % p) + p) % p, s);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	};
	const hgt = new Float32Array(N * N), crack = new Float32Array(N * N);
	// fractured rock: a periodic Voronoi of flakes, each a flat face tilted its own way,
	// sharp creases between, and fine grit over all
	const C = 9, pts = [];
	for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push({ x: (i + 0.15 + 0.7 * hash(i, j, 31)) / C, y: (j + 0.15 + 0.7 * hash(i, j, 32)) / C, h: hash(i, j, 33), sx: (hash(i, j, 34) - 0.5) * 2.2, sy: (hash(i, j, 35) - 0.5) * 2.2 });
	const C2 = 23, pts2 = [];
	for (let j = 0; j < C2; j++) for (let i = 0; i < C2; i++) pts2.push({ x: (i + 0.1 + 0.8 * hash(i, j, 41)) / C2, y: (j + 0.1 + 0.8 * hash(i, j, 42)) / C2, h: hash(i, j, 43), sx: (hash(i, j, 44) - 0.5) * 1.6, sy: (hash(i, j, 45) - 0.5) * 1.6 });
	const vor = (u, v, list, n) => {
		const ci = Math.floor(u * n), cj = Math.floor(v * n);
		let d1 = 9, d2 = 9, best = null, bx = 0, by = 0;
		for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
			const ii = ((ci + di) % n + n) % n, jj = ((cj + dj) % n + n) % n, p = list[jj * n + ii];
			const px = p.x + Math.floor((ci + di) / n), py = p.y + Math.floor((cj + dj) / n);
			const dx = u - px, dy = v - py, d = Math.hypot(dx, dy);
			if (d < d1) { d2 = d1; d1 = d; best = p; bx = dx; by = dy; } else if (d < d2) d2 = d;
		}
		return { d1, d2, p: best, dx: bx, dy: by };
	};
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
		const u = i / N, v = j / N;
		let g = 0, amp = 0.5, p = P;
		for (let o = 0; o < 4; o++) { g += vn(u * p, v * p, p, o + 1) * amp; amp *= 0.5; p *= 2; }
		const a = vor(u, v, pts, C), b = vor(u, v, pts2, C2);
		const flake = a.p.h * 0.35 + (a.p.sx * a.dx + a.p.sy * a.dy) * C * 0.22;
		const chip = b.p.h * 0.12 + (b.p.sx * b.dx + b.p.sy * b.dy) * C2 * 0.06;
		hgt[j * N + i] = 0.35 + flake * 0.75 + chip + g * 0.45;
		const e1 = (a.d2 - a.d1) * C, e2 = (b.d2 - b.d1) * C2;
		// not every seam is open: the cracks come and go
		const open = Math.max(0, vn(u * 6, v * 6, 6, 51) * 1.6 - 0.45);
		crack[j * N + i] = Math.min(1, open * (1 - Math.min(1, e1 / 0.025))) * 0.9 + 0.3 * (1 - Math.min(1, e2 / 0.03)) * open;
	}
	const data = new Uint8Array(N * N * 4);
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
		const k = j * N + i, L = hgt[j * N + ((i + N - 1) % N)], R = hgt[j * N + ((i + 1) % N)], D = hgt[((j + N - 1) % N) * N + i], U = hgt[((j + 1) % N) * N + i];
		const s = 5;
		let nx = (L - R) * s, ny = (D - U) * s;
		const l = Math.hypot(nx, ny, 1);
		nx /= l; ny /= l;
		data[k * 4] = Math.round((nx * 0.5 + 0.5) * 255);
		data[k * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
		data[k * 4 + 2] = Math.round(Math.min(1, Math.max(0, hgt[k])) * 255);
		data[k * 4 + 3] = Math.round(Math.min(1, crack[k]) * 255);
	}
	detailTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
	detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
	detailTex.magFilter = THREE.LinearFilter;
	detailTex.minFilter = THREE.LinearMipmapLinearFilter;
	detailTex.generateMipmaps = true;
	detailTex.anisotropy = 4;
	detailTex.needsUpdate = true;
	return detailTex;
}

// ---------- the lighting every underground material shares ----------
export function caveLighting(shared, island, profile) {
	const U = {
		uHeight: { value: shared.heightTex }, uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCvFakeP: { value: Array.from({ length: FAKE }, () => new THREE.Vector4()) },
		uCvFakeC: { value: Array.from({ length: FAKE }, () => new THREE.Vector3()) },
		// the sinkhole's daylight: x, z, radius, strength; its colour
		uCvShaft: { value: new THREE.Vector4() }, uCvShaftY: { value: new THREE.Vector2() }, uCvSunC: { value: new THREE.Color(1, 0.95, 0.85) },
		// the faint light that is always there, so the dark is not a void
		uCvAmb: { value: new THREE.Color(...(profile.caves?.glow || [0.4, 0.8, 0.7])).multiplyScalar(0.02) },
		uCvIn: { value: 0 },
		uTime: shared.uTime, uBass: shared.uBass,
	};
	// the chunks every lit material gets
	const VERT_HEAD = 'varying vec3 vCvW;\n';
	const VERT_BODY = `
		#ifdef USE_INSTANCING
			vCvW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
		#else
			vCvW = (modelMatrix * vec4(transformed, 1.0)).xyz;
		#endif`;
	const FRAG_HEAD = `varying vec3 vCvW;
		uniform vec4 uCvFakeP[${FAKE}]; uniform vec3 uCvFakeC[${FAKE}];
		uniform vec4 uCvShaft; uniform vec2 uCvShaftY; uniform vec3 uCvSunC, uCvAmb; uniform float uCvIn;
		${HEIGHT_GLSL}
		float cvSun = 1.0, cvOcc = 1.0, cvShaftK = 0.0;
		// how much daylight reaches this point: gone a few metres under the ground, except
		// under the sinkhole
		float cvDaylight(vec3 w) {
			float depth = heightAt(w.xz) - w.y;
			float k = 1.0 - smoothstep(0.6, 6.5, depth);
			if (uCvShaft.w > 0.0) {
				float d = length(w.xz - uCvShaft.xy);
				// a cone of light from the hole down to the floor, widening a little as it falls
				float spread = uCvShaft.z * (1.0 + clamp((uCvShaftY.y - w.y) / 40.0, 0.0, 1.0) * 0.5);
				cvShaftK = (1.0 - smoothstep(spread * 0.55, spread * 1.5, d)) * step(uCvShaftY.x - 3.0, w.y) * uCvShaft.w;
				// and a soft bounce through the whole hall beneath it
				k = max(k, cvShaftK);
				k = max(k, (1.0 - smoothstep(uCvShaft.z, uCvShaft.z * 7.0, d)) * 0.16 * uCvShaft.w * step(uCvShaftY.x - 3.0, w.y));
			}
			return k;
		}
		vec3 cvWorldN(vec3 n) { return normalize((vec4(n, 0.0) * viewMatrix).xyz); }`;
	const BEGIN = THREE.ShaderChunk.lights_fragment_begin
		.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= cvSun;')
		.replace('getSunLightInfo( sunLight, directLight );', 'getSunLightInfo( sunLight, directLight );\n\t\tdirectLight.color *= cvSun;');
	const FRAG_LIGHT = `
		#if defined( RE_IndirectDiffuse )
			irradiance *= cvSun;
		#endif
		#if defined( RE_IndirectSpecular )
			radiance *= cvSun;
		#endif
		{
			// the glowing places nearby, and the faint ever-present glow
			vec3 cvN = cvWorldN(normal);
			vec3 add = vec3(0.0), sheen = vec3(0.0);
			vec3 cvV = normalize(cameraPosition - vCvW);
			float cvRough = 1.0;
			#ifdef STANDARD
				cvRough = clamp(roughnessFactor, 0.08, 1.0);
			#endif
			for (int i = 0; i < ${FAKE}; i++) {
				vec4 P = uCvFakeP[i];
				if (P.w <= 0.0) continue;
				vec3 L = P.xyz - vCvW;
				float d = length(L);
				float att = clamp(1.0 - d / P.w, 0.0, 1.0);
				att = att * att / (1.0 + d * d * 0.05);
				float nl = clamp(dot(cvN, L / max(d, 1e-3)) * 0.7 + 0.3, 0.0, 1.0);
				add += uCvFakeC[i] * att * nl;
				// Local glows must also reveal wet stone, ice and crystal facets. Reuse
				// this light's attenuation; a bounded lobe adds no lights or shadows.
				vec3 H = normalize(L / max(d, 1e-3) + cvV);
				float glint = pow(max(dot(cvN, H), 0.0), mix(96.0, 8.0, cvRough));
				sheen += uCvFakeC[i] * att * glint * max(dot(cvN, L / max(d, 1e-3)), 0.0) * (1.0 - cvRough) * 0.18;
			}
			reflectedLight.directDiffuse += diffuseColor.rgb * (add * cvOcc + uCvAmb * (1.0 - cvSun) * (0.4 + 0.6 * cvOcc));
			reflectedLight.directSpecular += sheen * cvOcc;
			// sunlight down the shaft (the sun's own direction is ignored: it falls straight in)
			reflectedLight.directDiffuse += diffuseColor.rgb * uCvSunC * cvShaftK * clamp(cvN.y * 0.6 + 0.5, 0.0, 1.0) * 1.6;
		}`;
	// patch a material: key names the program (the material's own patch, if any, runs first)
	function lit(m, key, extra = null) {
		const prev = m.onBeforeCompile;
		m.onBeforeCompile = (sh, r) => {
			prev?.call(m, sh, r);
			Object.assign(sh.uniforms, U);
			sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>' + VERT_BODY);
			sh.fragmentShader = FRAG_HEAD + '\n' + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tcvSun = cvDaylight(vCvW);')
				.replace('#include <lights_fragment_begin>', BEGIN)
				.replace('#include <lights_fragment_maps>', '#include <lights_fragment_maps>\n' + FRAG_LIGHT);
			extra?.(sh);
		};
		// (a material's own key if it set one, else its own patch's source, as three does)
		const own = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') ? m.customProgramCacheKey.bind(m) : null;
		const prevSrc = prev ? prev.toString() : '';
		m.customProgramCacheKey = () => 'cave|' + key + '|' + (own ? own() : prevSrc);
		return m;
	}
	return { U, lit };
}

// triplanar detail from rockDetail(): the slope to add to a normal, the height and the cracks
export const TRI_GLSL = /* glsl */`
float rH(vec3 p){ p = mod(p, 289.0); return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 rTri(vec3 p, vec3 n, float s, out float h, out float ck) {
	// triplanar: the detail texture on the three planes, blended by the normal
	vec3 b = pow(abs(n), vec3(4.0)); b /= b.x + b.y + b.z;
	vec4 tx = texture2D(uDetail, p.zy * s), ty = texture2D(uDetail, p.xz * s), tz = texture2D(uDetail, p.xy * s);
	h = tx.b * b.x + ty.b * b.y + tz.b * b.z;
	ck = tx.a * b.x + ty.a * b.y + tz.a * b.z;
	vec2 nx = tx.rg * 2.0 - 1.0, ny = ty.rg * 2.0 - 1.0, nz = tz.rg * 2.0 - 1.0;
	// whiteout blend of the three planes' slopes onto the surface normal
	vec3 wn = vec3(0.0, nx.y, nx.x) * b.x + vec3(ny.x, 0.0, ny.y) * b.y + vec3(nz.x, nz.y, 0.0) * b.z;
	return wn;
}
`;

// ---------- the rock ----------
// banded and stained, lumpy at two scales, cracked; wet and glossy low down in wet caves,
// glazed with ice on an ice world, hot-veined on a volcanic one; specks of living light
// in colonies on the vaults. The ground at a cave mouth wears the colours of the land.
export function rockMaterial(L, profile, opts = {}) {
	const cw = profile.caves || {};
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
	const rock = new THREE.Color(...(cw.rock || [0.3, 0.28, 0.26]));
	const glow = new THREE.Color(...(cw.glow || [0.4, 0.9, 0.7]));
	const g = profile.ground || {};
	// (the land's colours are authored for the screen, as the terrain takes them)
	const soil = new THREE.Color().setRGB(...(g.soil || [0.3, 0.24, 0.15]), THREE.SRGBColorSpace), grnd = new THREE.Color().setRGB(...(g.rock || [0.4, 0.4, 0.4]), THREE.SRGBColorSpace);
	soil.multiplyScalar(1.5); grnd.multiplyScalar(1.5);
	const grass = new THREE.Color().setRGB(...(g.grass || [0.34, 0.48, 0.1]), THREE.SRGBColorSpace).multiplyScalar(1.3);
	const U = {
		uRock: { value: rock }, uGlowC: { value: glow }, uSoil: { value: soil }, uGround: { value: grnd }, uGrass: { value: grass }, uGrassK: { value: Math.min(1, profile.grass ?? 1) },
		uDetail: { value: rockDetail() },
		uWetK: { value: Math.min(1, cw.water || 0) }, uIceK: { value: cw.ice || 0 }, uLavaK: { value: cw.lava || 0 }, uCrystK: { value: cw.crystals || 0 },
		uGlowK: { value: opts.glowK ?? 1 },
	};
	const phone = !!opts.isPhone;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = 'attribute vec2 aInfo;\nvarying vec2 vInfo;\nvarying vec3 vRN;\n' + sh.vertexShader
			.replace('#include <begin_vertex>', `#include <begin_vertex>
				vInfo = aInfo;
				#ifdef USE_INSTANCING
					vRN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
				#else
					vRN = normalize(mat3(modelMatrix) * normal);
				#endif`);
		sh.fragmentShader = `uniform vec3 uRock, uGlowC, uSoil, uGround, uGrass; uniform float uGrassK; uniform sampler2D uDetail; uniform float uWetK, uIceK, uLavaK, uCrystK, uGlowK, uTime, uBass;
			varying vec2 vInfo; varying vec3 vRN;
			${TRI_GLSL}
			` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				vec3 rn = normalize(vRN);
				float h1, c1, h2, c2;
				vec3 d1 = rTri(vCvW, rn, 0.21, h1, c1);
				${phone ? 'vec3 d2 = vec3(0.0); h2 = 0.5; c2 = 0.0;' : 'vec3 d2 = rTri(vCvW + 3.1, rn, 0.9, h2, c2);'}
				// the floors are silt and dust over the rock: the fractures show less there
				float silt = smoothstep(0.6, 0.9, rn.y);
				vec3 rnD = normalize(rn + (d1 * 0.9 + d2 * 0.55) * (1.0 - silt * 0.75));
				c1 *= 1.0 - silt * 0.8; c2 *= 1.0 - silt * 0.6;
				// flowstone: where water has run down a steep wall for ages, pale ribbed drapery
				vec2 tang = normalize(vec2(-rn.z, rn.x) + 1e-4);
				float along = dot(vCvW.xz, tang);
				float flowK = smoothstep(0.58, 0.75, texture2D(uDetail, vec2(along * 0.015, vCvW.y * 0.01 + 0.3)).b) * (1.0 - smoothstep(0.35, 0.7, abs(rn.y))) * (1.0 - uLavaK) * max(uWetK, 0.4);
				// (fine ribs and bands fade out where they would be finer than a pixel)
				float ribPh = along * 7.0 + h1 * 4.0 + sin(vCvW.y * 1.3) * 0.8;
				float rib = sin(ribPh) * (1.0 - smoothstep(0.6, 1.6, fwidth(ribPh)));
				rnD = normalize(rnD + vec3(tang.x, 0.0, tang.y) * rib * 0.18 * flowK);
				float up = rnD.y, kind = vInfo.y, ao = vInfo.x;
				// strata: layers of old sediment, warped, each a slightly different stone
				float warp = h1 * 3.0 + sin(vCvW.x * 0.05 + vCvW.z * 0.04) * 2.0;
				float b1 = vCvW.y * 1.3 + warp, b2 = vCvW.y * 4.7 + warp * 2.0;
				float band = 0.5 + 0.5 * sin(b1) * (1.0 - smoothstep(0.6, 1.6, fwidth(b1)));
				float band2 = 0.5 + 0.5 * sin(b2) * (1.0 - smoothstep(0.6, 1.6, fwidth(b2)));
				vec3 col = uRock * (0.78 + 0.28 * band + 0.12 * band2 - 0.1);
				col *= 0.75 + 0.5 * h2 * (0.6 + 0.4 * h1);
				// mineral stains: iron rust in streaks running down, pale calcite on the vaults
				float streak = texture2D(uDetail, vec2(vCvW.x * 0.07 + vCvW.z * 0.05, vCvW.y * 0.012)).b;
				col = mix(col, col * vec3(1.25, 0.82, 0.55), smoothstep(0.55, 0.8, streak) * 0.55 * (1.0 - uIceK));
				col = mix(col, vec3(0.78, 0.76, 0.7) * (0.7 + 0.3 * h1), smoothstep(0.62, 0.9, h1 + streak * 0.3) * clamp(-up, 0.0, 1.0) * 0.5 * (1.0 - uLavaK));
				col = mix(col, vec3(0.74, 0.66, 0.54) * (0.8 + 0.25 * rib) * mix(vec3(1.0), uRock / max(0.01, dot(uRock, vec3(0.333))), 0.35), flowK * 0.85);
				// an ice world: the walls glazed in patches of clear blue ice
				float iceK = uIceK * smoothstep(0.35, 0.6, texture2D(uDetail, vCvW.xz * 0.02 + vCvW.y * 0.015).b + 0.25 * (1.0 - abs(up)));
				col = mix(col, vec3(0.55, 0.75, 0.92) * (0.75 + 0.3 * h2), iceK * 0.85);
				// cracks and crevices hold the dark
				col *= 1.0 - (c1 * 0.3 + c2 * 0.3);
				// floors: dust and silt, darker, finer; the ground at a mouth takes the land's colours
				float floorK = smoothstep(0.55, 0.85, up);
				col = mix(col, mix(uRock, uSoil, 0.5) * (0.62 + 0.25 * h2), floorK * 0.7);
				// out in the daylight (the ledges and boulders of a mouth) it is the land's own rock
				col = mix(col, uGround * (0.7 + 0.45 * h1) * (1.0 - c1 * 0.3), cvSun * 0.7);
				if (kind > 0.5 && kind < 1.5) {
					// the ground at a mouth: the land's turf on the flat going to trodden earth, rock where steep
					vec3 turf = mix(uSoil, uGrass, uGrassK * smoothstep(0.35, 0.65, h2) * 0.8);
					col = mix(turf, uGround, smoothstep(0.35, 0.75, 1.0 - up)) * (0.75 + 0.35 * h1);
				}
				diffuseColor.rgb = col * (0.35 + 0.65 * ao);
				cvOcc = 0.3 + 0.7 * ao;`)
			.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
				{
					// wet low down and on the floors of the wet caves; glazed ice on an ice world
					float wet = uWetK * (smoothstep(0.4, 0.95, up) * 0.35 + smoothstep(0.6, 0.75, h1) * 0.2) + flowK * 0.6;
					roughnessFactor = mix(0.92, 0.28, wet);
					roughnessFactor = mix(roughnessFactor, 0.08, iceK);
					diffuseColor.rgb *= 1.0 - wet * 0.35;
				}`)
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				normal = normalize((viewMatrix * vec4(rnD, 0.0)).xyz);`)
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				{
					float dark = 1.0 - cvSun;
					// living light: colonies of tiny glowing specks, thickest on the vaults, breathing
					vec3 cell = floor(vCvW * 7.0);
					float colony = smoothstep(0.62, 0.85, texture2D(uDetail, vCvW.xz * 0.011 + vCvW.y * 0.004).b * 0.7 + 0.3 * h1 + 0.2 * (1.0 - up));
					float speck = step(0.93, rH(cell)) * (1.0 - smoothstep(0.03, 0.11, length(fract(vCvW * 7.0) - 0.5)));
					float breathe = 0.6 + 0.4 * sin(uTime * (0.4 + rH(cell + 3.0)) + rH(cell + 9.0) * 6.28) + uBass * 0.3;
					totalEmissiveRadiance += uGlowC * speck * colony * breathe * dark * uGlowK * 0.9 * (0.4 + 0.6 * (1.0 - smoothstep(-0.8, -0.2, up)));
					// a faint haze of the same glow where the colonies are thick
					totalEmissiveRadiance += uGlowC * colony * dark * uGlowK * 0.008;
					// hot veins in the rock of a volcanic world
					float vein = pow(clamp(c1 * 1.15, 0.0, 1.0), 3.0) * uLavaK;
					totalEmissiveRadiance += vec3(1.0, 0.32, 0.06) * vein * (0.5 + 0.5 * sin(uTime * 0.7 + h1 * 12.0)) * 1.4 * dark;
					// ice: light seems to come from inside it
					totalEmissiveRadiance += iceK * vec3(0.15, 0.4, 0.7) * (0.03 + 0.12 * pow(1.0 - abs(dot(cvWorldN(normal), normalize(cameraPosition - vCvW))), 2.0)) * dark;
				}`);
	};
	m.customProgramCacheKey = () => 'caverock-uw' + (phone ? 'p' : '');
	return L.lit(m, 'rock' + (phone ? 'p' : ''));
}

// ---------- crystals: faceted, glowing from within ----------
export function crystalMaterial(L, color) {
	const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...color).multiplyScalar(0.4), roughness: 0.08, metalness: 0.1, emissive: new THREE.Color(...color), emissiveIntensity: 0.9, transparent: true, opacity: 0.88 });
	m.onBeforeCompile = (sh) => {
		// first, so the ring of a struck note rides on top of the glow
		addPulse(sh);
		sh.uniforms.uTime = L.U.uTime;
		sh.vertexShader = 'varying float vCy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCy = position.y;');
		sh.fragmentShader = 'uniform float uTime; varying float vCy;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
			{
				// brightest at the core and the tips, a slow pulse moving up each crystal
				vec3 V = normalize(cameraPosition - vCvW);
				float fr = pow(1.0 - abs(dot(cvWorldN(normal), V)), 2.0);
				float pulse = 0.65 + 0.35 * sin(uTime * 1.3 - vCy * 3.0 + vCvW.x * 0.7);
				totalEmissiveRadiance *= (0.35 + 0.9 * (1.0 - fr) * smoothstep(0.0, 1.0, vCy) + fr * 0.4) * pulse;
			}`);
	};
	m.customProgramCacheKey = () => 'cavecrystal';
	return L.lit(m, 'crystal');
}

// ---------- water: still, black, a mirror for every glow ----------
export function waterMaterial(L, tint, ice) {
	const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(...tint), roughness: ice ? 0.2 : 0.04, metalness: ice ? 0 : 0.6, transparent: true, opacity: ice ? 0.95 : 0.82 });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = L.U.uTime;
		sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader
			.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				{
					// rings spreading from drips, and a slow shiver
					vec2 p = vCvW.xz;
					float r1 = length(fract(p * 0.18) - 0.5), r2 = length(fract(p * 0.27 + 0.3) - 0.5);
					float w = sin(r1 * 40.0 - uTime * 3.0) * exp(-r1 * 6.0) * 0.5 + sin(r2 * 50.0 - uTime * 2.3 + 1.7) * exp(-r2 * 7.0) * 0.4;
					vec3 wn = normalize(vec3(sin(p.x * 1.3 + uTime * 0.6) * 0.03 + w * 0.08 * ${ice ? '0.0' : '1.0'}, 1.0, cos(p.y * 1.1 - uTime * 0.5) * 0.03 + w * 0.08 * ${ice ? '0.0' : '1.0'}));
					normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
				}`)
			.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
				{
					// what the water mirrors: the glowing places above it, as soft smears
					vec3 V = normalize(cameraPosition - vCvW), N = cvWorldN(normal), Rf = reflect(-V, N);
					vec3 acc = vec3(0.0);
					for (int i = 0; i < ${FAKE}; i++) {
						vec4 P = uCvFakeP[i];
						if (P.w <= 0.0) continue;
						vec3 Lp = normalize(P.xyz - vCvW);
						acc += uCvFakeC[i] * pow(max(dot(Rf, Lp), 0.0), 60.0) * 0.6;
					}
					float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
					reflectedLight.directSpecular += acc * (0.3 + fres);
				}`);
	};
	m.customProgramCacheKey = () => 'cavewater' + (ice ? 'i' : '');
	return L.lit(m, 'water' + (ice ? 'i' : ''));
}

// ---------- lava: a crust breaking over a molten glow, slowly moving ----------
export function lavaMaterial(shared) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime },
		vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
		fragmentShader: `uniform float uTime; varying vec3 vW;
			float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
			void main(){
				vec2 p = vW.xz * 0.35 + vec2(uTime * 0.05, uTime * 0.03);
				float a = n(p) * 0.6 + n(p * 2.3 + 4.0) * 0.3 + n(p * 5.1 - uTime * 0.2) * 0.1;
				// the crust: dark plates with glowing seams between
				float seam = 1.0 - smoothstep(0.02, 0.12, abs(a - 0.5));
				float hot = smoothstep(0.35, 0.75, n(vW.xz * 0.12 - uTime * 0.04));
				vec3 c = mix(vec3(0.04, 0.015, 0.01), vec3(0.75, 0.16, 0.02), max(seam, hot * 0.7));
				c += vec3(0.9, 0.35, 0.05) * pow(seam, 3.0) * (0.7 + 0.3 * sin(uTime * 2.0 + a * 20.0));
				gl_FragColor = vec4(c, 1.0);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`,
	});
}

// ---------- the shaft of daylight: a soft beam with motes in it ----------
export function shaftMaterial(L) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: L.U.uTime, uSunC: L.U.uCvSunC, uK: { value: 1 } },
		vertexShader: 'varying vec2 vU; varying vec3 vW; varying vec3 vN; void main(){ vU = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
		fragmentShader: `uniform float uTime, uK; uniform vec3 uSunC; varying vec2 vU; varying vec3 vW; varying vec3 vN;
			void main(){
				// brighter toward the beam's core as seen from here, rays shifting slowly
				vec3 V = normalize(cameraPosition - vW);
				float ray = 0.65 + 0.35 * sin(vU.x * 31.4 + uTime * 0.3) * sin(vU.x * 12.6 - uTime * 0.17);
				float a = smoothstep(0.0, 0.25, vU.y) * (1.0 - smoothstep(0.85, 1.0, vU.y)) * ray * uK * 0.05 * pow(abs(dot(normalize(vN), V)), 2.0);
				gl_FragColor = vec4(uSunC * a, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}

// ---------- points of glow: glow worms, spores, motes, embers ----------
export function glowPointsMaterial(shared, color, size, opts = {}) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime, uC: { value: new THREE.Color(...color) }, uSize: { value: size }, uDrift: { value: opts.drift || 0 }, uPx: { value: 1 } },
		vertexShader: `uniform float uTime, uSize, uDrift, uPx; attribute float aR; varying float vA; varying float vR;
			void main(){
				vec3 p = position;
				// motes drift and swirl; glow worms hang still
				p += uDrift * vec3(sin(uTime * 0.21 + aR * 40.0), sin(uTime * 0.13 + aR * 17.0) * 0.6, cos(uTime * 0.17 + aR * 29.0)) * (0.6 + aR);
				vec4 mv = modelViewMatrix * vec4(p, 1.0);
				gl_Position = projectionMatrix * mv;
				float d = -mv.z;
				gl_PointSize = clamp(uSize * uPx * 300.0 / d, 1.0, 24.0);
				vA = (0.55 + 0.45 * sin(uTime * (0.6 + aR) + aR * 60.0)) * (1.0 - smoothstep(30.0, 90.0, d));
				vR = aR;
			}`,
		fragmentShader: `uniform vec3 uC; varying float vA; varying float vR;
			void main(){
				float r = length(gl_PointCoord - 0.5);
				float a = (1.0 - smoothstep(0.0, 0.5, r));
				a = a * a * vA;
				gl_FragColor = vec4(uC * a * (1.5 + vR), 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
}
