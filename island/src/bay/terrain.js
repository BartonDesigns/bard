// The real Bay Area, at true scale, around the island. Three baked height levels
// (coarse over the nine counties, finer over the core bay, finest round the Golden
// Gate) stream in after the island is up. The ground is drawn by two camera-centred
// rings displaced on the GPU and shaded as California: summer-gold grass, dark oak
// woodland on the north-facing slopes, redwood and fir in the fog belt, chaparral
// on the dry south-facing hills, rock, beaches, and the cities: street grids, roofs,
// parks, and at night the lights. The same heights serve the sea (depth, shallows),
// walking, flying and the boat.

import * as THREE from 'three';
import { radialGrid, NOISE_GLSL } from '../world/terrain.js';
import { LEVELS, LAT0, LON0, KX, KZ, H_OFF, H_SCALE, toWorld } from './geo.js';
import { PLACES } from './places.js';

// ---------- the shared GLSL: height from the finest level that covers a point ----------
export const BAY_GLSL = /* glsl */`
uniform highp sampler2D uB0, uB1, uB2; uniform vec4 uR0, uR1, uR2; uniform float uBayOn;
float bLevel(highp sampler2D t, vec4 r, vec2 w){
	vec2 S = vec2(textureSize(t, 0));
	vec2 f = clamp((w - r.xy) / r.z, vec2(0.0), S - 1.001);
	ivec2 i = ivec2(floor(f)); vec2 u = fract(f);
	float a = texelFetch(t, i, 0).r, b = texelFetch(t, i + ivec2(1, 0), 0).r;
	float c = texelFetch(t, i + ivec2(0, 1), 0).r, d = texelFetch(t, i + ivec2(1, 1), 0).r;
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float bIn(highp sampler2D t, vec4 r, vec2 w, float m){
	vec2 S = vec2(textureSize(t, 0)); vec2 f = (w - r.xy) / r.z; vec2 d = min(f, S - 1.0 - f) * r.z;
	return smoothstep(0.0, 1.0, clamp(min(d.x, d.y) / m, 0.0, 1.0));
}
float bayHeight(vec2 w){
	if (uBayOn < 0.5) return -60.0;
	float h = mix(-400.0, bLevel(uB0, uR0, w), bIn(uB0, uR0, w, 3000.0));
	float k1 = bIn(uB1, uR1, w, 1500.0); if (k1 > 0.0) h = mix(h, bLevel(uB1, uR1, w), k1);
	float k2 = bIn(uB2, uR2, w, 500.0); if (k2 > 0.0) h = mix(h, bLevel(uB2, uR2, w), k2);
	return h;
}
`;

const OFF = new THREE.Vector4(1e9, 1e9, 1, 0);
export function bayUniforms() {
	const blank = () => { const t = new THREE.DataTexture(new Uint16Array([0, 0, 0, 0]), 2, 2, THREE.RedFormat, THREE.HalfFloatType); t.needsUpdate = true; return t; };
	return { uB0: { value: blank() }, uB1: { value: blank() }, uB2: { value: blank() }, uR0: { value: OFF.clone() }, uR1: { value: OFF.clone() }, uR2: { value: OFF.clone() }, uBayOn: { value: 0 } };
}

// the towns: how far each one's streets reach, their street-grid angle, and the
// downtowns where buildings stand tall
const CBD = [[37.7925, -122.399, 1, 1300], [37.7785, -122.395, 0.55, 900], [37.8044, -122.2712, 0.6, 800], [37.3337, -121.8907, 0.5, 900], [37.87, -122.268, 0.25, 500], [37.901, -122.061, 0.25, 500], [37.8313, -122.2852, 0.3, 450], [37.5630, -122.3255, 0.15, 500], [37.4443, -122.1598, 0.15, 400], [38.4404, -122.7141, 0.2, 500], [37.978, -122.031, 0.2, 500], [37.3861, -122.0839, 0.15, 500], [37.3688, -122.0363, 0.15, 500], [37.4852, -122.2364, 0.15, 400]];
// open land inside San Francisco: parks, the Presidio, the hills
const PARKS = [[37.7690, -122.4830, 2600, 450, 0], [37.7989, -122.4662, 1500, 1100, 0.3], [37.7544, -122.4477, 700, 700, 0], [37.7580, -122.4570, 600, 600, 0], [37.7200, -122.4950, 800, 900, 0], [37.7180, -122.4200, 700, 500, 0.5], [37.7850, -122.5050, 500, 400, 0]];
const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

export function createBayArea(shared, scene, island, BU) {
	const levels = [];                       // CPU copies: { x0, zN, step, W, H, v: Uint16Array }
	const group = new THREE.Group();
	group.name = 'bayarea';
	scene.add(group);

	// ---------- the urban map (250 m cells): R density, G street angle, B downtown ----------
	const U = { x0: 0, zN: 0, cell: 250, W: 0, H: 0, data: null, tex: null };
	const cityPts = PLACES.filter((p) => p[4] > 0).map((p) => { const w = toWorld(p[1], p[2]); return { ...w, r: 380 * Math.pow(p[4], 0.45), ang: p[0] === 'San Francisco' ? 0 : hashStr(p[0]) * Math.PI / 2, name: p[0] }; });
	const cbds = CBD.map((c) => ({ ...toWorld(c[0], c[1]), s: c[2], r: c[3] }));
	const parks = PARKS.map((c) => ({ ...toWorld(c[0], c[1]), rx: c[2], rz: c[3], keep: c[4] }));

	function buildUrban() {
		const L = levels[0];
		U.x0 = L.x0; U.zN = L.zN;
		U.W = Math.ceil((L.W - 1) * L.step / U.cell); U.H = Math.ceil((L.H - 1) * L.step / U.cell);
		const dens = new Float32Array(U.W * U.H), best = new Float32Array(U.W * U.H), ang = new Float32Array(U.W * U.H);
		for (const c of cityPts) {
			const R = c.r * 1.8, i0 = Math.max(0, Math.floor((c.x - R - U.x0) / U.cell)), i1 = Math.min(U.W - 1, Math.ceil((c.x + R - U.x0) / U.cell));
			const j0 = Math.max(0, Math.floor((c.z - R - U.zN) / U.cell)), j1 = Math.min(U.H - 1, Math.ceil((c.z + R - U.zN) / U.cell));
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const x = U.x0 + (i + 0.5) * U.cell, z = U.zN + (j + 0.5) * U.cell;
				const d = Math.hypot(x - c.x, z - c.z) / c.r, v = Math.exp(-d * d * 1.2);
				const k = j * U.W + i;
				dens[k] = Math.max(dens[k], v) + v * 0.15;
				if (v > best[k]) { best[k] = v; ang[k] = c.ang; }
			}
		}
		const data = new Uint8Array(U.W * U.H * 4);
		for (let j = 0; j < U.H; j++) for (let i = 0; i < U.W; i++) {
			const x = U.x0 + (i + 0.5) * U.cell, z = U.zN + (j + 0.5) * U.cell, k = j * U.W + i;
			const h = heightAt(x, z), hx = heightAt(x + 120, z), hz = heightAt(x, z + 120);
			const slope = Math.hypot(hx - h, hz - h) / 120;
			// towns climb gentle ground, not the mountains, cliffs or the water
			let u = Math.min(1, dens[k] * 1.1) * (h > 0.6 ? 1 : 0) * (1 - smooth(0.12, 0.3, slope)) * (1 - smooth(220, 360, h));
			for (const p of parks) { const dx = (x - p.x) / p.rx, dz = (z - p.z) / p.rz; if (dx * dx + dz * dz < 1) u *= p.keep; }
			let down = 0;
			for (const c of cbds) { const d = Math.hypot(x - c.x, z - c.z) / c.r; down = Math.max(down, c.s * Math.exp(-d * d)); }
			data[k * 4] = Math.round(u * 255); data[k * 4 + 1] = Math.round(ang[k] / (Math.PI / 2) * 255); data[k * 4 + 2] = Math.round(Math.min(1, down) * 255 * (u > 0.1 ? 1 : 0)); data[k * 4 + 3] = 255;
		}
		U.data = data;
		U.tex = new THREE.DataTexture(data, U.W, U.H, THREE.RGBAFormat, THREE.UnsignedByteType);
		U.tex.magFilter = THREE.LinearFilter; U.tex.minFilter = THREE.LinearFilter;
		U.tex.needsUpdate = true;
		uUrban.value = U.tex;
		uUR.value.set(U.x0, U.zN, U.cell, 0);
	}
	const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	function urbanAt(x, z) {
		if (!U.data) return { u: 0, a: 0, d: 0 };
		const i = Math.floor((x - U.x0) / U.cell), j = Math.floor((z - U.zN) / U.cell);
		if (i < 0 || j < 0 || i >= U.W || j >= U.H) return { u: 0, a: 0, d: 0 };
		const k = (j * U.W + i) * 4;
		return { u: U.data[k] / 255, a: U.data[k + 1] / 255 * Math.PI / 2, d: U.data[k + 2] / 255 };
	}

	// ---------- heights on the CPU ----------
	function levelH(L, x, z) {
		let fx = (x - L.x0) / L.step, fz = (z - L.zN) / L.step;
		fx = Math.min(Math.max(fx, 0), L.W - 1.001); fz = Math.min(Math.max(fz, 0), L.H - 1.001);
		const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * L.W + i, V = L.v;
		const a = V[k], b = V[k + 1], c = V[k + L.W], d = V[k + L.W + 1];
		return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) / H_SCALE - H_OFF;
	}
	function levelIn(L, x, z, m) {
		const fx = (x - L.x0) / L.step, fz = (z - L.zN) / L.step;
		const d = Math.min(fx, L.W - 1 - fx, fz, L.H - 1 - fz) * L.step;
		return smooth(0, 1, Math.min(1, Math.max(0, d / m)));
	}
	function heightAt(x, z) {
		if (!levels[0]) return -60;
		let h = -400 + (levelH(levels[0], x, z) + 400) * levelIn(levels[0], x, z, 3000);
		if (levels[1]) { const k = levelIn(levels[1], x, z, 1500); if (k > 0) h += (levelH(levels[1], x, z) - h) * k; }
		if (levels[2]) { const k = levelIn(levels[2], x, z, 500); if (k > 0) h += (levelH(levels[2], x, z) - h) * k; }
		return h;
	}

	// ---------- loading ----------
	async function loadLevel(i) {
		const L = LEVELS[i];
		const url = new URL(`../assets/bayarea/${L.name}.png`, import.meta.url);
		const blob = await (await fetch(url)).blob();
		const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
		const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
		const cx = cv.getContext('2d', { willReadFrequently: true });
		cx.drawImage(bmp, 0, 0);
		const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;
		const W = bmp.width, H = bmp.height, v = new Uint16Array(W * H), half = new Uint16Array(W * H);
		for (let k = 0; k < W * H; k++) { v[k] = px[k * 4] * 256 + px[k * 4 + 1]; half[k] = THREE.DataUtils.toHalfFloat(v[k] / H_SCALE - H_OFF); }
		const x0 = (L.lon[0] - LON0) * KX, zN = -(L.lat[1] - LAT0) * KZ;
		levels[i] = { x0, zN, step: L.step, W, H, v };
		const tex = new THREE.DataTexture(half, W, H, THREE.RedFormat, THREE.HalfFloatType);
		tex.minFilter = tex.magFilter = THREE.NearestFilter;
		tex.needsUpdate = true;
		BU['uB' + i].value = tex;
		BU['uR' + i].value.set(x0, zN, L.step, 0);
		if (i === 0) { BU.uBayOn.value = 1; buildUrban(); }
	}
	const ready = (async () => { for (let i = 0; i < LEVELS.length; i++) { try { await loadLevel(i); } catch (e) { console.warn('bay level', i, e); } } })();

	// ---------- the ground ----------
	const uUrban = { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) }, uUR = { value: new THREE.Vector4(0, 0, 1, 0) };
	uUrban.value.needsUpdate = true;
	const uNightB = { value: 0 };
	function groundMaterial(hole) {
		const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
		const U2 = { uC: { value: new THREE.Vector2() }, uHoleC: { value: new THREE.Vector2() }, uHole: { value: hole ? 1 : 0 }, uIslHalf: { value: island.half - 10 } };
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, BU, U2, { uUrban, uUR, uNightB, uTime: shared.uTime });
			sh.vertexShader = 'uniform vec2 uC;\nvarying vec2 vBW; varying float vBH; varying vec3 vBN;\n' + BAY_GLSL + sh.vertexShader
				.replace('#include <beginnormal_vertex>', `
					vec2 bw = position.xz + uC;
					float bh = bayHeight(bw);
					float be = max(6.0, length(position.xz) * 0.006);
					vec3 objectNormal = normalize(vec3(bayHeight(bw - vec2(be, 0.0)) - bayHeight(bw + vec2(be, 0.0)), 2.0 * be, bayHeight(bw - vec2(0.0, be)) - bayHeight(bw + vec2(0.0, be))));
					vBN = objectNormal;`)
				.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, bh, position.z); vBW = bw; vBH = bh;');
			sh.fragmentShader = 'uniform sampler2D uUrban; uniform vec4 uUR; uniform float uNightB, uIslHalf, uHole, uTime; uniform vec2 uHoleC;\nvarying vec2 vBW; varying float vBH; varying vec3 vBN;\nvec3 cityGlow = vec3(0.0);\n' + NOISE_GLSL + '\n' + sh.fragmentShader
				.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
					if (max(abs(vBW.x), abs(vBW.y)) < uIslHalf) discard;                           // the island draws itself
					if (uHole > 0.5 && max(abs(vBW.x - uHoleC.x), abs(vBW.y - uHoleC.y)) < 3900.0) discard;   // the near ring draws here`)
				.replace('#include <color_fragment>', `#include <color_fragment>
				{
					vec3 n = normalize(vBN); float slope = 1.0 - n.y, h = vBH;
					float n1 = fbm3(vBW * 0.0025), n2 = fbm3(vBW * 0.021), n3 = vn(vBW * 0.23);
					// the fog belt: the coast ranges and the west-facing hills stay green and wooded
					float fogbelt = 1.0 - smoothstep(22000.0, 58000.0, vBW.x);
					float north = clamp(-n.z * 2.2, 0.0, 1.0) * smoothstep(0.04, 0.25, slope);
					float south = clamp(n.z * 2.2, 0.0, 1.0) * smoothstep(0.08, 0.3, slope);
					vec3 gold = mix(vec3(0.6, 0.48, 0.27), vec3(0.75, 0.63, 0.37), n2);
					vec3 c = gold;
					float chap = south * smoothstep(0.2, 0.5, n1 + slope * 0.6) * (1.0 - fogbelt * 0.4);
					c = mix(c, mix(vec3(0.27, 0.28, 0.18), vec3(0.35, 0.34, 0.22), n3), chap * 0.85);
					float oak = smoothstep(0.42, 0.68, n1 + north * 0.4 + fogbelt * 0.12 - south * 0.15 + (n2 - 0.5) * 0.3);
					c = mix(c, mix(vec3(0.12, 0.16, 0.07), vec3(0.19, 0.23, 0.11), n3), oak * 0.88);
					float forest = smoothstep(0.55, 0.78, n1 * 0.55 + north * 0.45 + fogbelt * 0.45) * smoothstep(40.0, 180.0, h);
					c = mix(c, mix(vec3(0.05, 0.1, 0.05), vec3(0.08, 0.14, 0.07), n3), forest * 0.92);
					c = mix(c, mix(vec3(0.4, 0.38, 0.34), vec3(0.52, 0.49, 0.44), n2), smoothstep(0.55, 0.85, slope));
					// sand at the water's edge, mud and sand under water
					float beach = (1.0 - smoothstep(1.2, 5.0, h)) * (1.0 - smoothstep(0.08, 0.25, slope)) * step(-0.5, h);
					c = mix(c, vec3(0.8, 0.74, 0.6), beach);
					c = mix(c, vec3(0.4, 0.38, 0.31), smoothstep(0.3, -1.5, h));
					// the towns: a street grid at the town's own angle, roofs, trees, parks
					vec2 uu = (vBW - uUR.xy) / uUR.z;
					vec2 US = vec2(textureSize(uUrban, 0));
					vec4 T = texture2D(uUrban, uu / US);
					float urban = T.r * (1.0 - smoothstep(0.25, 0.4, slope)) * smoothstep(0.4, 1.5, h);
					float dist = length(cameraPosition - vec3(vBW.x, vBH, vBW.y));
					if (urban > 0.02){
						float a = texelFetch(uUrban, ivec2(clamp(uu, vec2(0.0), US - 1.0)), 0).g * 1.5708;
						vec2 g = mat2(cos(a), -sin(a), sin(a), cos(a)) * vBW;
						vec2 B = vec2(110.0, 135.0), f = fract(g / B), cid = floor(g / B);
						float st = 14.0 / B.x;
						float street = 1.0 - step(st, f.x) * step(st * B.x / B.y, f.y);
						float lh = h21(floor(g / 17.0) + cid * 7.0);
						vec3 roof = mix(vec3(0.55, 0.54, 0.52), vec3(0.74, 0.69, 0.61), lh);
						roof = mix(roof, vec3(0.58, 0.33, 0.24), step(0.82, lh) * 0.9);
						float park = step(0.94, h21(cid + 3.1)) * (1.0 - T.b);
						float tree = step(0.72, h21(floor(g / 6.0) + 11.0)) * (1.0 - street) * (1.0 - T.b) * 0.8;
						vec3 cityC = mix(roof, vec3(0.16, 0.24, 0.1), max(park, tree));
						cityC = mix(cityC, vec3(0.2, 0.2, 0.21), street);
						// far off the grid melts into the town's average colour
						cityC = mix(cityC, vec3(0.45, 0.44, 0.42), smoothstep(1500.0, 6000.0, dist));
						c = mix(c, cityC, smoothstep(0.08, 0.35, urban));
						// night: street lamps along the grid, windows in the blocks; far away,
						// the town is a carpet of light
						float lamps = street * step(0.55, fract((g.x + g.y) / 32.0)) * step(0.9, h21(floor(g / 16.0)));
						float wins = (1.0 - street) * step(0.86, h21(floor(g / 9.0) + 5.0)) * (0.5 + T.b);
						float nearL = (lamps * 1.6 + wins) * (1.0 - smoothstep(900.0, 3500.0, dist));
						// far off, points of light: streetlights and windows as a scatter of sparks,
						// thicker downtown, sized to stay about a pixel at any distance
						float cellL = max(18.0, dist * 0.004);
						vec2 lc = floor(vBW / cellL);
						float spark = step(0.86 - T.b * 0.2, h21(lc)) * smoothstep(0.35, 0.05, length(fract(vBW / cellL) - 0.5));
						float farL = spark * (1.2 + T.b) * smoothstep(600.0, 3500.0, dist);
						cityGlow = mix(vec3(1.0, 0.62, 0.28), vec3(0.95, 0.9, 0.8), h21(lc + 3.0) * 0.5) * (nearL + farL) * smoothstep(0.08, 0.35, urban) * uNightB * 2.2;
					}
					diffuseColor.rgb = c * (0.88 + 0.24 * n3);
				}`)
				.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
				{
					// fine relief the survey cannot see: gullies, knolls and grain, as a bump
					float dist2 = length(cameraPosition - vec3(vBW.x, vBH, vBW.y));
					float bh = (fbm3(vBW * 0.045) * 2.2 + fbm3(vBW * 0.22) * 0.5 + vn(vBW * 1.3) * 0.08) * (1.0 - smoothstep(1500.0, 6000.0, dist2)) * step(0.0, vBH);
					vec3 sp = -vViewPosition, vSx = dFdx(sp), vSy = dFdy(sp);
					vec3 R1 = cross(vSy, normal), R2 = cross(normal, vSx);
					float fDet = dot(vSx, R1);
					vec2 dH = vec2(dFdx(bh), dFdy(bh));
					normal = normalize(abs(fDet) * normal - sign(fDet) * (dH.x * R1 + dH.y * R2));
				}`)
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cityGlow;');
		};
		m.customProgramCacheKey = () => 'bayground' + (hole ? 'far' : 'near');
		m.userData.U2 = U2;
		return m;
	}
	const nearMat = groundMaterial(false), farMat = groundMaterial(true);
	const near = new THREE.Mesh(radialGrid(300, 4000, 2.0), nearMat), far = new THREE.Mesh(radialGrid(256, 95000, 2.6), farMat);
	for (const m of [near, far]) { m.frustumCulled = false; m.receiveShadow = true; m.userData.material175 = 'stone'; group.add(m); }
	near.visible = far.visible = false;

	function update(cam, night) {
		const on = BU.uBayOn.value > 0.5;
		near.visible = far.visible = on;
		if (!on) return;
		uNightB.value = night;
		const nx = Math.round(cam.position.x / 32) * 32, nz = Math.round(cam.position.z / 32) * 32;
		const fx = Math.round(cam.position.x / 512) * 512, fz = Math.round(cam.position.z / 512) * 512;
		near.position.set(nx, 0, nz); nearMat.userData.U2.uC.value.set(nx, nz);
		far.position.set(fx, 0, fz); farMat.userData.U2.uC.value.set(fx, fz); farMat.userData.U2.uHoleC.value.set(nx, nz);
	}
	return { group, update, heightAt, urbanAt, ready, loaded: () => BU.uBayOn.value > 0.5, levels };
}
