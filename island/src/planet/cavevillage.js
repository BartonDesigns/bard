// The village in the great cavern. Its people live by lamplight round a fire that never
// goes out: dwellings in a ring facing it (huts of daub and thatch, houses on stilts over
// a black pool, adobe blocks with beams through the walls, igloos of cut snow, iron
// half-barrel bunkers, houses grown from giant mushrooms, glass domes: the world's own
// kind, profile.civ.village), a market of stalls under cloth awnings, lanterns on posts
// along the worn paths, a lamp at every door, and the glow of fire in the doorways.
// A handful of real people (people/body.js) live here: some sit round the fire, some keep
// the stalls, some walk between the houses, two stand talking.
//
// All the building is one merged mesh with one material that knows each surface by a
// number (plaster, thatch, wood, metal, cloth, lit window, snow block, mushroom cap...).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rockDetail, TRI_GLSL } from './cavemat.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';

// surfaces
const PLASTER = 0, THATCH = 1, WOOD = 2, METAL = 3, CLOTH = 4, GLOW = 5, SNOW = 6, CAP = 7, STONE = 9, PANEL = 10;   // (8: a dark void)
const WARM = [1.0, 0.62, 0.3];

// each kind of village: its walls, and what its people wear
const KINDS = {
	hut: { wall: [0.52, 0.40, 0.28], roof: [0.62, 0.50, 0.30], clothes: [[0.62, 0.22, 0.12], [0.20, 0.25, 0.42], [0.30, 0.40, 0.20], [0.80, 0.62, 0.30], [0.45, 0.20, 0.35], [0.18, 0.30, 0.28]] },
	stilt: { wall: [0.46, 0.34, 0.24], roof: [0.58, 0.48, 0.30], clothes: [[0.20, 0.28, 0.45], [0.30, 0.40, 0.55], [0.60, 0.55, 0.45], [0.18, 0.22, 0.30], [0.55, 0.35, 0.25]] },
	adobe: { wall: [0.78, 0.60, 0.44], roof: [0.70, 0.52, 0.36], clothes: [[0.92, 0.90, 0.84], [0.72, 0.20, 0.15], [0.15, 0.30, 0.55], [0.20, 0.45, 0.45], [0.88, 0.58, 0.15]] },
	igloo: { wall: [0.86, 0.90, 0.95], roof: [0.86, 0.90, 0.95], clothes: [[0.85, 0.82, 0.76], [0.45, 0.35, 0.28], [0.30, 0.25, 0.22], [0.65, 0.60, 0.55], [0.20, 0.30, 0.45]], fur: true },
	bunker: { wall: [0.40, 0.42, 0.38], roof: [0.44, 0.45, 0.42], clothes: [[0.32, 0.34, 0.24], [0.40, 0.40, 0.40], [0.25, 0.27, 0.30], [0.55, 0.45, 0.30], [0.60, 0.35, 0.15]] },
	fae: { wall: [0.88, 0.82, 0.72], roof: [0.62, 0.20, 0.55], clothes: [[0.45, 0.25, 0.60], [0.20, 0.55, 0.55], [0.85, 0.45, 0.65], [0.35, 0.30, 0.65], [0.70, 0.70, 0.85]] },
	dome: { wall: [0.80, 0.82, 0.85], roof: [0.55, 0.75, 0.85], clothes: [[0.90, 0.90, 0.92], [0.90, 0.45, 0.15], [0.30, 0.35, 0.40], [0.60, 0.65, 0.70], [0.15, 0.40, 0.60]] },
};

function kitMaterial(L) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
	const U = { uDetail: { value: rockDetail() } };
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = 'attribute float aMat;\nvarying float vMat;\nvarying vec2 vKUv;\nvarying vec3 vKN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat;\nvKUv = uv;\nvKN = normalize(mat3(modelMatrix) * normal);');
		sh.fragmentShader = `uniform sampler2D uDetail; uniform float uTime;
			varying float vMat; varying vec2 vKUv; varying vec3 vKN;
			${TRI_GLSL}
			float kGlow = 0.0, kRough = 0.9, kMetal = 0.0;
			vec3 kGlowC = vec3(1.0, 0.62, 0.3);
			// a stripe that fades out where it would be finer than a pixel
			float aaSin(float p) { return sin(p) * (1.0 - smoothstep(0.6, 1.6, fwidth(p))); }
			` + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				{
					int id = int(vMat + 0.5);
					vec3 kn = normalize(vKN);
					float h, ck;
					vec3 d = rTri(vCvW, kn, 0.6, h, ck);
					vec3 col = diffuseColor.rgb;
					vec2 uv = vKUv;
					if (id == 0) { col *= 0.85 + 0.2 * h; col *= 1.0 - ck * 0.15; kRough = 0.95; }
					else if (id == 1) {
						// thatch: bundles of straw running down the slope
						float s = texture2D(uDetail, vec2(uv.x * 14.0, uv.y * 1.2)).b;
						float st = texture2D(uDetail, vec2(uv.x * 60.0, uv.y * 3.0)).b;
						col *= 0.55 + 0.5 * s * (0.6 + 0.6 * st);
						col *= 0.8 + 0.2 * aaSin(uv.y * 60.0);
						kRough = 1.0;
					}
					else if (id == 2) {
						// wood: grain along the plank, seams between
						float g = texture2D(uDetail, vec2(uv.x * 0.6, uv.y * 8.0)).b;
						col *= 0.7 + 0.45 * g;
						col *= 0.75 + 0.25 * smoothstep(0.0, 0.06, abs(fract(uv.x * 4.0) - 0.5));
						kRough = 0.8;
					}
					else if (id == 3) {
						// corrugated iron, streaked with rust
						col *= 0.85 + 0.2 * aaSin(uv.x * 180.0);
						col = mix(col, vec3(0.35, 0.16, 0.07), smoothstep(0.55, 0.8, h) * 0.6);
						kRough = 0.55; kMetal = 0.6;
					}
					else if (id == 4) { col *= 0.85 + 0.15 * aaSin(uv.x * 300.0) * aaSin(uv.y * 300.0); kRough = 0.95; }
					else if (id == 5) {
						// firelight in a window or a doorway: brightest low down, where the hearth is
						kGlow = (0.8 + 0.2 * sin(uTime * 7.0 + vCvW.x * 3.0) * sin(uTime * 3.1 + vCvW.z * 2.0)) * (0.55 + 0.6 * (1.0 - uv.y));
						kGlowC = diffuseColor.rgb;
						col = vec3(0.05);
					}
					else if (id == 6) {
						// cut snow blocks in courses, lit warm from inside toward the bottom
						vec2 b = vec2(uv.x * 22.0 + floor(uv.y * 9.0) * 0.5, uv.y * 9.0);
						vec2 e = abs(fract(b) - 0.5);
						col *= 0.82 + 0.18 * smoothstep(0.5, 0.42, max(e.x, e.y));
						kGlow = 0.12 * smoothstep(0.6, 0.0, uv.y);
						kRough = 0.6;
					}
					else if (id == 7) {
						// a mushroom cap: pale spots on top, glowing gills beneath
						vec2 sp = fract(uv * vec2(9.0, 5.0)) - 0.5;
						float spot = smoothstep(0.22, 0.15, length(sp)) * step(0.3, rH(vec3(floor(uv * vec2(9.0, 5.0)), 1.0)));
						col = mix(col, vec3(0.95, 0.92, 0.85), spot * step(0.0, kn.y));
						if (kn.y < -0.2) { col = vec3(0.3, 0.25, 0.3); kGlow = 0.35 * (0.5 + 0.5 * aaSin(uv.x * 200.0)); }
						kRough = 0.5;
					}
					else if (id == 8) { col = vec3(0.01); }
					else if (id == 9) { col *= 0.7 + 0.4 * h; col *= 1.0 - ck * 0.5; }
					else if (id == 10) {
						// glass panels in a frame: the frame metal, the panes lit faintly from within
						float edge = min(min(uv.x, uv.y), 1.0 - uv.x - uv.y);
						float fr = 1.0 - smoothstep(0.03, 0.06, edge);
						col = mix(col * 0.5, vec3(0.5, 0.52, 0.55), fr);
						kGlow = (1.0 - fr) * 0.18;
						kRough = mix(0.15, 0.5, fr); kMetal = fr * 0.8;
					}
					if (id != 5 && id != 8) col *= 0.9 + 0.2 * h;
					diffuseColor.rgb = col;
				}`)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = kRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = kMetal;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += kGlowC * kGlow;');
	};
	m.customProgramCacheKey = () => 'cavekit';
	return L.lit(m, 'kit');
}

// flames: crossed cards with a moving fire shader
function flameMaterial(shared) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime },
		vertexShader: 'varying vec2 vU; varying float vS; attribute float aS; void main(){ vU = uv; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime; varying vec2 vU; varying float vS;
			float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
			void main(){
				vec2 p = vU;
				float t = uTime * 1.6 + vS * 10.0;
				float turb = n(vec2(p.x * 5.0, p.y * 4.0 - t * 1.8)) * 0.6 + n(vec2(p.x * 11.0, p.y * 9.0 - t * 3.0)) * 0.4;
				float w = (0.42 - p.y * 0.34) * (0.7 + 0.5 * turb);
				float body = smoothstep(w, w * 0.35, abs(p.x - 0.5 + (turb - 0.5) * 0.25 * p.y));
				body *= smoothstep(1.0, 0.45, p.y + turb * 0.25) * smoothstep(0.0, 0.08, p.y);
				vec3 c = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.8, 0.35), body * body);
				c = mix(c, vec3(1.0, 0.95, 0.8), pow(body, 4.0));
				gl_FragColor = vec4(c * body * 2.2, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}

export function* createCaveVillage(ctx) {
	const { chamber: c, group, L, civ, rng: r, rockFloor, addGlow, props, isPhone, camera, shared, plan } = ctx;
	const kind = civ.village in KINDS ? civ.village : 'hut';
	const K = KINDS[kind];
	const pieces = [];
	const Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
	const tmpC = new THREE.Color();
	// the chamber's frame
	const W = (u, v) => ({ x: c.x + u * c.cos - v * c.sin, z: c.z + u * c.sin + v * c.cos });
	const floorAt = (x, z) => rockFloor(x, z, c.fy + 3) ?? c.fy;
	// a piece into the one mesh (geometry in a local frame, then placed by the given matrix)
	function add(geo, mat, colour, local, world) {
		let g = geo.index ? geo.toNonIndexed() : geo.clone();
		for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
		if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
		if (!g.attributes.normal) g.computeVertexNormals();
		if (local) g.applyMatrix4(local);
		if (world) g.applyMatrix4(world);
		const n = g.attributes.position.count, v = 0.9 + r() * 0.2;
		tmpC.setRGB(colour[0] * v, colour[1] * v, colour[2] * v);
		const col = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) { col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b; }
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.setAttribute('aMat', new THREE.BufferAttribute(new Float32Array(n).fill(mat), 1));
		pieces.push(g);
	}
	const at = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
	const box = (w, h, d, rad = 0.04) => new RoundedBoxGeometry(w, h, d, 1, Math.min(rad, w / 3, h / 3, d / 3));
	const cyl = (r0, r1, h, seg = 8, open = false) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg, 1, open); g.translate(0, h / 2, 0); return g; };
	const WOODC = [0.36, 0.25, 0.16], DARKWOOD = [0.22, 0.15, 0.1], IRON = [0.25, 0.25, 0.26], STONEC = [0.38, 0.36, 0.33];
	const glowSpots = [];
	// a lantern: a little frame round a flame; its light is one of the glowing places
	function lantern(x, y, z, big = 1, hang = false) {
		const w = at(x, y, z);
		add(box(0.2 * big, 0.28 * big, 0.2 * big, 0.02), GLOW, [1.0, 0.42, 0.1], null, w);
		for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(box(0.025, 0.36 * big, 0.025, 0.005), METAL, IRON, at(cx * 0.11 * big, 0, cz * 0.11 * big), w);
		add(box(0.32 * big, 0.05, 0.32 * big, 0.01), METAL, IRON, at(0, 0.19 * big, 0), w);
		add(box(0.3 * big, 0.04, 0.3 * big, 0.01), METAL, IRON, at(0, -0.19 * big, 0), w);
		if (hang) add(cyl(0.01, 0.01, 0.5, 4), METAL, IRON, at(0, 0.2 * big, 0), w);
		glowSpots.push(addGlow(x, y, z, 9 * big, WARM, 1.2 * big, 0.15));
	}
	function post(x, z) {
		const y = floorAt(x, z);
		add(cyl(0.07, 0.09, 2.5, 6), WOOD, DARKWOOD, null, at(x, y - 0.1, z));
		add(box(0.7, 0.07, 0.07), WOOD, DARKWOOD, null, at(x + 0.25, y + 2.35, z));
		lantern(x + 0.5, y + 1.95, z, 0.9, true);
		props.push({ x, z, r: 0.15, y0: y, y1: y + 2.5 });
	}

	// ---------- the dwellings ----------
	// facing the fire at the middle; built round (0,0) facing +z, placed by the matrix
	function dwelling(wm, s, over) {
		if (kind === 'hut' || (kind === 'stilt' && !over)) {
			const rr = 2.3 * s, wh = 2.2 * s;
			const wall = cyl(rr, rr * 1.04, wh, 28, true);
			add(wall, PLASTER, K.wall, null, wm);
			// the roof: a cone of thatch, its edge ragged, a topknot
			const roof = new THREE.ConeGeometry(rr * 1.42, 2.5 * s, 28, 5, true);
			{ const p = roof.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -1.2 * s) { p.setY(i, y - r() * 0.22); p.setX(i, p.getX(i) * (1 + r() * 0.05)); p.setZ(i, p.getZ(i) * (1 + r() * 0.05)); } } roof.computeVertexNormals(); }
			add(roof, THATCH, K.roof, at(0, wh + 1.05 * s, 0), wm);
			add(cyl(0.18, 0.28, 0.5, 8), THATCH, K.roof, at(0, wh + 2.2 * s, 0), wm);
			// a door lit from inside, its frame; a small window
			add(new THREE.PlaneGeometry(0.9, 1.75), GLOW, [1.0, 0.55, 0.22], at(0, 0.88, rr + 0.03), wm);
			for (const sx of [-0.5, 0.5]) add(box(0.1, 1.9, 0.1), WOOD, DARKWOOD, at(sx, 0.95, rr + 0.05), wm);
			add(box(1.15, 0.12, 0.12), WOOD, DARKWOOD, at(0, 1.9, rr + 0.05), wm);
			add(new THREE.PlaneGeometry(0.45, 0.4), GLOW, [1.0, 0.55, 0.22], at(rr * 0.72, 1.35, rr * 0.72, Math.PI / 4), wm);
			return { r: rr + 0.3, door: [0, rr + 0.9], lamp: [0.75, 1.9, rr + 0.25] };
		}
		if (kind === 'stilt') {
			// a plank house on stilts over the water, a gable roof, a deck in front
			const w = 4 * s, d = 3.2 * s, lift = 1.7;
			for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2 + 1.2], [w / 2, d / 2 + 1.2], [0, -d / 2], [0, d / 2 + 1.2]]) add(cyl(0.1, 0.12, lift + 1.4, 6), WOOD, DARKWOOD, at(px, -1.4, pz), wm);
			add(box(w + 0.4, 0.16, d + 1.6), WOOD, WOODC, at(0, lift, 0.6), wm);
			add(box(w, 2.3, d), WOOD, K.wall, at(0, lift + 1.23, 0), wm);
			for (const sd of [-1, 1]) add(box(w + 0.8, 0.1, d * 0.62), THATCH, K.roof, at(0, lift + 2.95, sd * d * 0.26, 0, sd * 0.62), wm);
			add(new THREE.PlaneGeometry(0.9, 1.7), GLOW, [1.0, 0.55, 0.22], at(0, lift + 0.95, d / 2 + 0.03), wm);
			add(new THREE.PlaneGeometry(0.6, 0.5), GLOW, [1.0, 0.55, 0.22], at(w * 0.3, lift + 1.5, d / 2 + 0.03), wm);
			return { r: Math.max(w, d) * 0.6, door: [0, d / 2 + 1.3], lamp: [0.7, lift + 1.9, d / 2 + 0.2], deck: { w: w + 0.4, d: d + 1.6, y: lift + 0.08, cz: 0.6 } };
		}
		if (kind === 'adobe') {
			const w = (3.6 + r() * 1.6) * s, d = (3.2 + r()) * s, h = 2.8 * s;
			add(new RoundedBoxGeometry(w, h, d, 3, 0.25), PLASTER, K.wall, at(0, h / 2 - 0.1, 0), wm);
			const two = r() < 0.45;
			if (two) {
				add(new RoundedBoxGeometry(w * 0.6, h * 0.8, d * 0.7, 3, 0.2), PLASTER, K.wall, at(-w * 0.15, h + h * 0.4 - 0.15, -d * 0.1), wm);
				add(new THREE.PlaneGeometry(0.5, 0.5), GLOW, [1.0, 0.55, 0.22], at(-w * 0.15, h * 1.45, d * 0.25 + 0.02), wm);
				// a ladder to the roof
				for (const lx of [w * 0.28, w * 0.28 + 0.45]) add(cyl(0.04, 0.04, h + 0.8, 5), WOOD, WOODC, at(lx, 0, d / 2 + 0.35, 0, -0.18), wm);
				for (let k = 1; k < 8; k++) add(cyl(0.025, 0.025, 0.45, 4), WOOD, WOODC, at(w * 0.28, k * 0.38, d / 2 + 0.35 - k * 0.07, 0, 0, Math.PI / 2), wm);
			}
			// beams through the wall, a door, windows with sills
			for (let k = 0; k < 5; k++) add(cyl(0.08, 0.08, 0.6, 6), WOOD, DARKWOOD, at(-w / 2 + 0.5 + k * (w - 1) / 4, h - 0.45, d / 2 - 0.2, 0, Math.PI / 2), wm);
			add(new THREE.PlaneGeometry(0.95, 1.9), GLOW, [1.0, 0.55, 0.22], at(-w * 0.18, 0.95, d / 2 + 0.02), wm);
			add(box(1.2, 0.14, 0.2), WOOD, DARKWOOD, at(-w * 0.18, 1.95, d / 2 + 0.05), wm);
			add(new THREE.PlaneGeometry(0.6, 0.55), GLOW, [1.0, 0.55, 0.22], at(w * 0.22, 1.5, d / 2 + 0.02), wm);
			add(box(0.8, 0.08, 0.2), WOOD, DARKWOOD, at(w * 0.22, 1.18, d / 2 + 0.08), wm);
			return { r: Math.max(w, d) * 0.62, door: [-w * 0.18, d / 2 + 0.9], lamp: [-w * 0.18 + 0.8, 2.0, d / 2 + 0.2] };
		}
		if (kind === 'igloo') {
			const rr = 2.4 * s;
			const dome = new THREE.SphereGeometry(rr, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
			add(dome, SNOW, K.wall, null, wm);
			const tun = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16, 1, true, -Math.PI / 2, Math.PI);
			tun.rotateX(Math.PI / 2);
			add(tun, SNOW, K.wall, at(0, 0, rr + 0.4), wm);
			const door = new THREE.CircleGeometry(0.8, 16, 0, Math.PI);
			add(door, GLOW, [1.0, 0.55, 0.22], at(0, 0.02, rr + 1.28), wm);
			return { r: rr + 0.3, door: [0, rr + 2.1], lamp: [1.05, 1.1, rr + 1.2] };
		}
		if (kind === 'bunker') {
			// a half-barrel of corrugated iron, its end wall toward the fire
			const rr = 2.2 * s, len = 5.5 * s;
			const shell = new THREE.CylinderGeometry(rr, rr, len, 24, 1, true, -Math.PI / 2, Math.PI);
			shell.rotateX(Math.PI / 2);
			add(shell, METAL, K.wall, null, wm);
			const end = new THREE.CircleGeometry(rr, 24, 0, Math.PI);
			add(end, PLASTER, [0.36, 0.36, 0.34], at(0, 0, len / 2), wm);
			add(end, PLASTER, [0.36, 0.36, 0.34], at(0, 0, -len / 2, Math.PI), wm);
			add(new THREE.PlaneGeometry(1.0, 1.9), GLOW, [1.0, 0.55, 0.22], at(0, 0.95, len / 2 + 0.02), wm);
			add(box(1.3, 2.1, 0.08), METAL, IRON, at(0, 1.05, len / 2 + 0.01), wm);
			add(new THREE.CircleGeometry(0.28, 16), GLOW, [1.0, 0.55, 0.22], at(1.2, 1.3, len / 2 + 0.03), wm);
			for (const sd of [-1, 1]) add(cyl(0.08, 0.08, len, 8), METAL, IRON, at(sd * (rr + 0.12), 0.3, -len / 2, 0, Math.PI / 2), wm);
			return { r: Math.max(rr, len / 2) + 0.2, door: [0, len / 2 + 0.9], lamp: [0, 2.3, len / 2 + 0.3] };
		}
		if (kind === 'fae') {
			// a house grown in a giant mushroom: a fat stalk with round door and windows, a spotted cap
			const hh = 3.2 * s;
			const stalk = new THREE.LatheGeometry([[0, 0], [1.9, 0], [2.05, 0.4], [2.0, 1.4], [1.7, 2.4], [1.4, hh]].map(([a, b]) => new THREE.Vector2(a * s, b)), 28);
			add(stalk, PLASTER, K.wall, null, wm);
			const capR = 3.4 * s;
			const cap = new THREE.LatheGeometry([[0.2, -0.2], [capR * 0.7, -0.15], [capR, 0.2], [capR * 0.95, 0.8], [capR * 0.7, 1.5], [capR * 0.35, 1.95], [0, 2.05]].map(([a, b]) => new THREE.Vector2(a, b)), 36);
			const cc = [K.roof, [0.75, 0.18, 0.12], [0.25, 0.45, 0.75]][Math.floor(r() * 3)];
			add(cap, CAP, cc, at(0, hh - 0.1, 0), wm);
			add(new THREE.CircleGeometry(0.55, 20), GLOW, [1.0, 0.55, 0.22], at(0, 0.9, 2.0 * s + 0.03, 0, 0, 0, 1, 1.6, 1), wm);
			for (const a of [0.9, -1.1]) add(new THREE.CircleGeometry(0.3, 16), GLOW, [1.0, 0.55, 0.22], at(Math.sin(a) * 1.85 * s, 1.9, Math.cos(a) * 1.85 * s, a), wm);
			return { r: 2.2 * s, door: [0, 2.0 * s + 0.9], lamp: [0.8, 1.8, 2.1 * s], capR };
		}
		// dome: a geodesic shell of lit panels on an iron ring, an airlock door
		const rr = 3.0 * s;
		const ico = new THREE.IcosahedronGeometry(rr, 2).toNonIndexed();
		const p = ico.attributes.position, keep = [], uvs = [];
		for (let i = 0; i < p.count; i += 3) {
			if (Math.min(p.getY(i), p.getY(i + 1), p.getY(i + 2)) < -0.05) continue;
			for (let k = 0; k < 3; k++) keep.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
			uvs.push(1, 0, 0, 1, 0, 0);
		}
		const hemi = new THREE.BufferGeometry();
		hemi.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
		hemi.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
		hemi.computeVertexNormals();
		add(hemi, PANEL, K.roof, null, wm);
		add(new THREE.TorusGeometry(rr, 0.12, 6, 40), METAL, IRON, at(0, 0.05, 0, 0, Math.PI / 2), wm);
		add(box(1.6, 2.3, 1.4, 0.2), METAL, K.wall, at(0, 1.15, rr - 0.1), wm);
		add(new THREE.PlaneGeometry(0.9, 1.8), GLOW, [1.0, 0.55, 0.22], at(0, 1.0, rr + 0.62), wm);
		return { r: rr + 0.2, door: [0, rr + 1.4], lamp: [0.95, 2.2, rr + 0.7] };
	}

	// ---------- where things go ----------
	const plaza = { u: (r() - 0.5) * c.rx * 0.1, v: (r() - 0.5) * c.rz * 0.1 };
	const pool = c.pools.find((p) => p.kind === 'water');
	const lava = c.pools.find((p) => p.kind === 'lava');
	const keep = [];      // circles in (u, v) already taken
	const toUV = (x, z) => { const dx = x - c.x, dz = z - c.z; return { u: dx * c.cos + dz * c.sin, v: -dx * c.sin + dz * c.cos }; };
	for (const p of c.pools) { const q = toUV(p.x, p.z); keep.push({ u: q.u, v: q.v, r: p.r * 1.05, pool: p }); }
	// the ways in: tunnel ends inside the chamber stay open
	const ways = [];
	for (const t of plan.tunnels) for (const end of [t.pts[0], t.pts[t.pts.length - 1]]) if (Math.hypot(end.x - c.x, end.z - c.z) < Math.max(c.rx, c.rz)) ways.push(toUV(end.x, end.z));
	const free = (u, v, rad) => keep.every((k) => Math.hypot(k.u - u, k.v - v) > k.r + rad) && ways.every((w) => {
		// keep a lane from each way in to the plaza
		const dx = plaza.u - w.u, dv = plaza.v - w.v, l = Math.hypot(dx, dv) || 1, t = Math.max(0, Math.min(1, ((u - w.u) * dx + (v - w.v) * dv) / (l * l)));
		return Math.hypot(u - w.u - dx * t, v - w.v - dv * t) > rad + 1.8;
	});
	keep.push({ u: plaza.u, v: plaza.v, r: 5.5 });
	const houses = [];
	const nH = isPhone ? 6 : 8;
	for (let i = 0, tries = 0; houses.length < nH && tries < 200; tries++, i++) {
		const a = (i / nH) * Math.PI * 2 + (r() - 0.5) * 0.5 + Math.floor(tries / nH) * 0.37;
		const q = 0.5 + r() * 0.2, s = 0.9 + r() * 0.25;
		let u = plaza.u + Math.cos(a) * c.rx * q, v = plaza.v + Math.sin(a) * c.rz * q;
		// on a stilt world, some stand out over the pool
		let over = false;
		if (kind === 'stilt' && pool && houses.filter((h) => h.over).length < 3 && r() < 0.6) {
			const pq = toUV(pool.x, pool.z), b = r() * 6.283;
			u = pq.u + Math.cos(b) * pool.r * 0.55; v = pq.v + Math.sin(b) * pool.r * 0.55;
			over = keep.filter((k) => !k.pool).every((k) => Math.hypot(k.u - u, k.v - v) > k.r + 3.5 * s);
			if (!over) continue;
		} else if (!free(u, v, 3.2 * s)) continue;
		const wp = W(u, v);
		const y = over ? pool.y : floorAt(wp.x, wp.z) - 0.12;
		const face = Math.atan2(W(plaza.u, plaza.v).x - wp.x, W(plaza.u, plaza.v).z - wp.z);
		const wm = at(wp.x, y, wp.z, face);
		const info = dwelling(wm, s, over);
		keep.push({ u, v, r: info.r + 1.2 });
		props.push({ x: wp.x, z: wp.z, r: info.r, y0: y - 1, y1: y + 6 });
		const dp = new THREE.Vector3(info.door[0], 0, info.door[1]).applyMatrix4(wm);
		const lp = new THREE.Vector3(...info.lamp).applyMatrix4(wm);
		lantern(lp.x, lp.y, lp.z, 0.8);
		houses.push({ x: wp.x, z: wp.z, y, face, door: { x: dp.x, z: dp.z }, over, info, u, v });
		yield;
		// a deck to walk on, and planks to the shore
		if (info.deck) {
			const dk = info.deck;
			props.push({ floor: (x, z, fy) => { const lx = (x - wp.x) * Math.cos(face) - (z - wp.z) * Math.sin(face), lz = (x - wp.x) * Math.sin(face) + (z - wp.z) * Math.cos(face); return Math.abs(lx) < dk.w / 2 && lz > dk.cz - dk.d / 2 && lz < dk.cz + dk.d / 2 + 6 && fy > y + dk.y - 1.3 ? y + dk.y : null; } });
			for (let k = 0; k < 10; k++) add(box(1.3, 0.07, 0.55), WOOD, WOODC, at(0, dk.y, dk.cz + dk.d / 2 + 0.3 + k * 0.62, (r() - 0.5) * 0.06), wm);
			for (let k = 0; k < 5; k++) for (const sx of [-0.6, 0.6]) add(cyl(0.07, 0.08, 3, 5), WOOD, DARKWOOD, at(sx, dk.y - 2.6, dk.cz + dk.d / 2 + 0.5 + k * 1.3), wm);
		}
	}

	yield;
	// ---------- the fire, its ring of stones, the log benches ----------
	const fp = W(plaza.u, plaza.v), fy = floorAt(fp.x, fp.z);
	for (let i = 0; i < 11; i++) {
		const a = i / 11 * Math.PI * 2, st = new THREE.IcosahedronGeometry(0.22 + r() * 0.08, 1);
		add(st, STONE, STONEC, at(Math.cos(a) * 0.95, 0.08, Math.sin(a) * 0.95, r() * 3, r() * 3, 0, 1.3, 0.8, 1), at(fp.x, fy, fp.z));
	}
	for (let i = 0; i < 4; i++) add(cyl(0.09, 0.1, 1.3, 7), WOOD, [0.12, 0.08, 0.06], at(0, 0.15, 0, i * 0.8, Math.PI / 2 - 0.35, 0), at(fp.x, fy, fp.z));
	props.push({ x: fp.x, z: fp.z, r: 1.25, y0: fy - 1, y1: fy + 2 });
	const seats = [];
	for (let i = 0; i < 3; i++) {
		const a = i / 3 * Math.PI * 2 + 0.4, bx = fp.x + Math.cos(a) * 3.1, bz = fp.z + Math.sin(a) * 3.1, by = floorAt(bx, bz);
		add(cyl(0.24, 0.26, 2.4, 10), WOOD, WOODC, at(0, 0, -1.2, 0, Math.PI / 2, 0), at(bx, by + 0.22, bz, -a));
		props.push({ x: bx, z: bz, r: 0.6, y0: by, y1: by + 0.5 });
		for (const off of [-0.55, 0.55]) seats.push({ x: bx + Math.cos(a + Math.PI / 2) * off - Math.cos(a) * 0.45, z: bz + Math.sin(a + Math.PI / 2) * off - Math.sin(a) * 0.45, y: by, face: Math.atan2(fp.x - bx, fp.z - bz) });
	}
	const flames = [];
	{
		const g = new THREE.PlaneGeometry(1.2, 1.9);
		g.translate(0, 0.95, 0);
		const P2 = [], U2 = [], S2 = [], I2 = [];
		for (let k = 0; k < 4; k++) {
			const gg = g.clone();
			gg.rotateY(k * Math.PI / 4);
			const base = P2.length / 3;
			P2.push(...gg.attributes.position.array); U2.push(...gg.attributes.uv.array);
			for (let i = 0; i < 4; i++) S2.push(k * 0.37);
			I2.push(...Array.from(gg.index.array, (i) => i + base));
		}
		const fg = new THREE.BufferGeometry();
		fg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
		fg.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
		fg.setAttribute('aS', new THREE.Float32BufferAttribute(S2, 1));
		fg.setIndex(I2);
		const fm = new THREE.Mesh(fg, flameMaterial(shared));
		fm.position.set(fp.x, fy + 0.05, fp.z);
		fm.renderOrder = 9;
		group.add(fm);
		flames.push(fm);
	}
	const fire = addGlow(fp.x, fy + 1.1, fp.z, 26, [1.0, 0.55, 0.22], 3.6, 0.35, true);
	// embers rising from it
	const emb = [], er = [];
	for (let i = 0; i < 60; i++) { emb.push(fp.x + (r() - 0.5) * 0.8, fy + 0.5 + r() * 4, fp.z + (r() - 0.5) * 0.8); er.push(r()); }
	const eg = new THREE.BufferGeometry();
	eg.setAttribute('position', new THREE.Float32BufferAttribute(emb, 3));
	eg.setAttribute('aR', new THREE.Float32BufferAttribute(er, 1));
	const emMat = new THREE.ShaderMaterial({
		uniforms: { uTime: shared.uTime },
		vertexShader: `uniform float uTime; attribute float aR; varying float vA;
			void main(){
				float t = fract(uTime * (0.12 + aR * 0.1) + aR);
				vec3 p = position;
				p.x += sin(t * 9.0 + aR * 30.0) * 0.35 * t; p.z += cos(t * 7.0 + aR * 20.0) * 0.35 * t;
				vec4 mv = modelViewMatrix * vec4(p.x, ${fy.toFixed(2)} + 0.4 + t * 5.0, p.z, 1.0);
				gl_Position = projectionMatrix * mv;
				gl_PointSize = clamp(90.0 / -mv.z, 1.0, 6.0);
				vA = (1.0 - t) * (0.5 + 0.5 * sin(uTime * 13.0 + aR * 50.0));
			}`,
		fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * smoothstep(0.5, 0.0, r) * vA * 2.0, 1.0); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const embers = new THREE.Points(eg, emMat);
	embers.frustumCulled = false;
	group.add(embers);

	yield;
	// ---------- the market ----------
	const stalls = [];
	const cloths = [[0.75, 0.2, 0.15], [0.85, 0.6, 0.15], [0.2, 0.45, 0.6], [0.35, 0.55, 0.25], [0.55, 0.25, 0.55]];
	for (let i = 0, tries = 0; stalls.length < 3 && tries < 40; tries++, i++) {
		const a = r() * 6.283, d = 7.5 + r() * 2;
		const u = plaza.u + Math.cos(a) * d, v = plaza.v + Math.sin(a) * d;
		if (!free(u, v, 1.8) || stalls.some((s) => Math.hypot(s.u - u, s.v - v) < 4.5)) continue;
		const wp = W(u, v), y = floorAt(wp.x, wp.z);
		const face = Math.atan2(fp.x - wp.x, fp.z - wp.z);
		const wm = at(wp.x, y, wp.z, face);
		for (const [px, pz] of [[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]]) add(cyl(0.05, 0.06, 2.3 + (pz < 0 ? 0.3 : 0), 6), WOOD, DARKWOOD, at(px, 0, pz), wm);
		add(box(2.3, 0.08, 1.0), WOOD, WOODC, at(0, 0.95, 0.25), wm);
		add(box(2.2, 0.9, 0.06), WOOD, DARKWOOD, at(0, 0.5, 0.72), wm);
		// the awning: cloth sagging between the poles
		const aw = new THREE.PlaneGeometry(2.6, 1.8, 8, 4);
		{ const p = aw.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), yy = p.getY(k); p.setZ(k, -Math.sin((x / 2.6 + 0.5) * Math.PI) * 0.12 - (yy / 1.8 + 0.5) * 0.0); } aw.computeVertexNormals(); }
		add(aw, CLOTH, cloths[Math.floor(r() * cloths.length)], at(0, 2.45, 0, 0, -Math.PI / 2 + 0.17), wm);
		// wares: pots, baskets, heaps of something
		for (let k = 0; k < 7; k++) {
			const wx = -0.9 + k * 0.3 + (r() - 0.5) * 0.1, wz = 0.1 + (r() - 0.5) * 0.4;
			const kindW = r();
			if (kindW < 0.4) add(new THREE.SphereGeometry(0.12 + r() * 0.06, 10, 8), STONE, [0.55 + r() * 0.3, 0.3 + r() * 0.3, 0.15 + r() * 0.2], at(wx, 1.1, wz, 0, 0, 0, 1, 1.1, 1), wm);
			else if (kindW < 0.7) add(new THREE.CylinderGeometry(0.1, 0.13, 0.25, 10), STONE, [0.5, 0.3, 0.2], at(wx, 1.12, wz), wm);
			else add(new THREE.CylinderGeometry(0.16, 0.12, 0.14, 10), THATCH, [0.55, 0.45, 0.28], at(wx, 1.06, wz), wm);
		}
		lantern(wp.x + Math.sin(face) * 0.2, y + 2.05, wp.z + Math.cos(face) * 0.2, 0.8, true);
		props.push({ x: wp.x, z: wp.z, r: 1.3, y0: y, y1: y + 2.5 });
		keep.push({ u, v, r: 2.2 });
		// where the stall keeper stands (behind the counter) and a buyer (in front)
		stalls.push({ u, v, x: wp.x, z: wp.z, y, face, keeper: { x: wp.x - Math.sin(face) * 0.45, z: wp.z - Math.cos(face) * 0.45 }, front: { x: wp.x + Math.sin(face) * 1.6, z: wp.z + Math.cos(face) * 1.6 } });
	}

	yield;
	// ---------- paths: from the plaza to every door and every way in, lamp posts along them ----------
	const pathLines = [];
	for (const h of houses) if (!h.over) pathLines.push([{ x: fp.x, z: fp.z }, h.door]);
	for (const h of houses) if (h.over) {
		// the planks meet the shore: the path goes to their end
		const e = { x: h.door.x + Math.sin(h.face) * 5.5, z: h.door.z + Math.cos(h.face) * 5.5 };
		pathLines.push([{ x: fp.x, z: fp.z }, e]);
	}
	for (const w of ways) pathLines.push([{ x: fp.x, z: fp.z }, W(w.u, w.v)]);
	{
		const Pp = [], Iu = [], Uv = [];
		for (const [a, b] of pathLines) {
			const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.ceil(len / 1.2)), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
			const base = Pp.length / 3;
			for (let i = 0; i <= n; i++) {
				const t = i / n, wob = Math.sin(t * 6 + a.x) * 0.3;
				const cx = a.x + (b.x - a.x) * t - dz * wob, cz = a.z + (b.z - a.z) * t + dx * wob;
				for (const s of [-1, 1]) {
					const x = cx - dz * s * 0.85, z = cz + dx * s * 0.85;
					Pp.push(x, floorAt(x, z) + 0.05, z);
					Uv.push(s * 0.5 + 0.5, t * len);
				}
				if (i < n) Iu.push(base + i * 2, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 3);
			}
			// a lamp post half way along the longer ones
			if (len > 9) { const t = 0.55, px = a.x + (b.x - a.x) * t - dz * 1.4, pz = a.z + (b.z - a.z) * t + dx * 1.4; post(px, pz); }
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(Uv, 2));
		g.setIndex(Iu);
		g.computeVertexNormals();
		const pm = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
		pm.defines = { USE_UV: '' };
		pm.onBeforeCompile = (sh) => {
			sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
				{
					// trodden earth with small stones pressed in, feathered at the edges
					vec2 cell = floor(vCvW.xz * 5.0);
					float n = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
					float stone = step(0.86, n) * (1.0 - smoothstep(0.2, 0.42, length(fract(vCvW.xz * 5.0) - 0.5)));
					diffuseColor.rgb *= 0.8 + 0.25 * fract(n * 7.3);
					diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.43, 0.4), stone * 0.6);
					diffuseColor.a = 0.9 * (1.0 - smoothstep(0.3, 0.5, abs(vUv.x - 0.5) + n * 0.08));
				}`);
		};
		const pathMesh = new THREE.Mesh(g, L.lit(pm, 'vpath'));
		pathMesh.renderOrder = 2;
		group.add(pathMesh);
	}
	// firewood stacks, pots and baskets by the doors
	for (const h of houses) {
		if (h.over) continue;
		const side = r() < 0.5 ? -1 : 1, hx = h.door.x + Math.cos(h.face) * side * 1.6 - Math.sin(h.face) * 0.5, hz = h.door.z - Math.sin(h.face) * side * 1.6 - Math.cos(h.face) * 0.5, hy = floorAt(hx, hz);
		if (r() < 0.5) for (let k = 0; k < 6; k++) add(cyl(0.07, 0.07, 0.9, 6), WOOD, WOODC, at(0, 0.08 + Math.floor(k / 3) * 0.14, -0.45, 0, Math.PI / 2, 0), at(hx + (k % 3) * 0.15 - 0.15, hy, hz, h.face + Math.PI / 2));
		else add(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 12), STONE, [0.5, 0.28, 0.18], null, at(hx, hy + 0.25, hz));
	}
	// on a volcanic world the village works the lava: a stone rim round the pit
	if (lava) {
		for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, x = lava.x + Math.cos(a) * (lava.r * 1.05), z = lava.z + Math.sin(a) * (lava.r * 1.05); add(box(0.9, 0.5, 0.5, 0.08), STONE, [0.2, 0.18, 0.17], null, at(x, floorAt(x, z) + 0.2, z, -a)); }
	}

	// ---------- the mesh ----------
	yield;
	const geo = mergeGeometries(pieces, false);
	geo.computeBoundingSphere();
	const kit = new THREE.Mesh(geo, kitMaterial(L));
	kit.userData.material175 = 'wood';
	group.add(kit);

	// ---------- the people ----------
	const folk = [];
	let building = false, built = false, A = null;
	const centre = new THREE.Vector3(fp.x, fy, fp.z);
	const ground = (x, z) => floorAt(x, z);
	const route = [];
	for (const h of houses) route.push(h.over ? { x: h.door.x + Math.sin(h.face) * 5, z: h.door.z + Math.cos(h.face) * 5 } : { x: h.door.x, z: h.door.z });
	for (const s of stalls) route.push(s.front);
	for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; route.push({ x: fp.x + Math.cos(a) * 5, z: fp.z + Math.sin(a) * 5 }); }
	const litPerson = (Pp, tag) => {
		Pp.root.traverse((o) => {
			if (!o.material) return;
			// (the eyes' material is shared with everyone above ground: these get their own)
			if (Pp.eyes?.includes(o)) o.material = o.material.clone();
			L.lit(o.material, 'folk-' + tag + '-' + (o === Pp.skin ? 'skin' : o === Pp.hair ? 'hair' : Pp.eyes?.includes(o) ? 'eye' : 'cloth'));
			o.castShadow = false;
		});
	};
	async function makeFolk() {
		building = true;
		try {
			A = A || await loadPeopleAssets();
			const n = Math.min(isPhone ? 6 : 9, 3 + seats.length + stalls.length);
			const roles = [];
			for (let i = 0; i < Math.min(3, seats.length); i++) roles.push({ role: 'sit', seat: seats[i * 2 % seats.length] });
			for (const s of stalls) roles.push({ role: 'keep', stall: s });
			roles.push({ role: 'walk' }, { role: 'walk' });
			if (houses.length > 1) { roles.push({ role: 'talk', pair: 0 }, { role: 'talk', pair: 1 }); }
			roles.push({ role: 'walk', child: true });
			const talkSpot = houses[1] ? { x: (houses[1].door.x * 2 + fp.x) / 3, z: (houses[1].door.z * 2 + fp.z) / 3 } : { x: fp.x + 4, z: fp.z };
			for (let i = 0; i < Math.min(n, roles.length); i++) {
				const R = roles[i];
				const d = personDNA(((c.x * 1000) ^ (i * 7919 + 131)) >>> 0, R.child ? { age: 6 + r() * 5 } : { age: 18 + r() * 55 });
				// the clothes of this place
				const pal = K.clothes;
				d.outfit.top = pal[Math.floor(r() * pal.length)];
				d.outfit.bottom = pal[Math.floor(r() * pal.length)].map((v) => v * 0.7);
				d.outfit.shoes = [0.2, 0.15, 0.1];
				d.outfit.jacket = K.fur ? pal[Math.floor(r() * 3)] : r() < 0.25 ? pal[Math.floor(r() * pal.length)].map((v) => v * 0.8) : null;
				if (d.outfit.jacket) d.outfit.sleeves = 'long';
				if (d.outfit.legs === 'shorts') d.outfit.legs = 'long';
				const Pp = buildPerson(A, d);
				litPerson(Pp, kind);
				let M = null;
				M = createMotion(Pp, (x, z) => ground(x, z));
				const p = { P: Pp, M, role: R.role, R, t: r() * 5, target: null, idle: 0 };
				if (R.role === 'sit') {
					const s = R.seat;
					M.place(s.x, s.y, s.z, s.face);
					M.sit(0.46, true); M.setPose('lap');
				} else if (R.role === 'keep') {
					const s = R.stall;
					M.place(s.keeper.x, ground(s.keeper.x, s.keeper.z), s.keeper.z, s.face);
					M.setPose(r() < 0.5 ? 'rest' : 'crossed');
				} else if (R.role === 'talk') {
					const x = talkSpot.x + (R.pair ? 0.55 : -0.55), z = talkSpot.z;
					M.place(x, ground(x, z), z, R.pair ? -Math.PI / 2 : Math.PI / 2);
					M.setPose(R.pair ? 'hip' : 'listen');
				} else {
					const s = route[Math.floor(r() * route.length)];
					M.place(s.x, ground(s.x, s.z), s.z, r() * 6.283);
					p.target = route[Math.floor(r() * route.length)];
				}
				group.add(Pp.root);
				folk.push(p);
				// one at a time: building a body takes a moment
				await new Promise((ok) => setTimeout(ok, 30));
			}
			built = true;
		} catch (e) { console.warn('[underworld] villagers', e); }
		building = false;
	}

	const look = new THREE.Vector3();
	function update(dt, t, player) {
		const cam = camera.position;
		const d = cam.distanceTo(centre);
		for (const f of flames) f.visible = d < 200;
		if (d < 120 && !built && !building) makeFolk();
		const on = d < 140;
		for (const p of folk) p.P.root.visible = on;
		if (!on) return;
		look.copy(cam);
		for (const p of folk) {
			const M = p.M, Sx = M.S.pos;
			p.t -= dt;
			const pd = Math.hypot(cam.x - Sx.x, cam.z - Sx.z);
			// everyone turns to look at a stranger who comes close
			M.S.look.target = pd < 5 && player ? look : null;
			if (p.role === 'walk') {
				if (p.idle > 0) {
					p.idle -= dt; M.want.speed = 0;
					if (p.idle <= 0) p.target = route[Math.floor(Math.random() * route.length)];
				} else if (p.target) {
					const dx = p.target.x - Sx.x, dz = p.target.z - Sx.z, dd = Math.hypot(dx, dz);
					M.want.heading = Math.atan2(dx, dz);
					M.want.speed = dd < 0.5 ? 0 : (p.R.child ? 1.3 : 1.05) * Math.min(1, dd);
					// a stranger in the way: step round them
					if (pd < 1.4) M.want.heading += 0.8;
					if (dd < 0.5) { p.idle = 3 + Math.random() * 7; M.want.speed = 0; }
				}
			} else if (p.role === 'keep') {
				M.want.speed = 0;
				if (pd < 6 && p.t < 0) { p.t = 4 + Math.random() * 4; M.gesture(['explain', 'point', 'wave', 'open'][Math.floor(Math.random() * 4)]); M.want.heading = Math.atan2(cam.x - Sx.x, cam.z - Sx.z); }
				else if (p.t < 0) { p.t = 6 + Math.random() * 8; M.want.heading = p.R.stall.face + (Math.random() - 0.5) * 0.8; }
			} else if (p.role === 'talk') {
				M.want.speed = 0;
				if (p.t < 0) { p.t = 2.5 + Math.random() * 4; M.gesture(['explain', 'nod', 'laugh', 'shrug', 'emphatic', 'think'][Math.floor(Math.random() * 6)]); M.S.talk = Math.random() < 0.5 ? 1 : 0; }
			} else if (p.role === 'sit') {
				M.want.speed = 0;
				if (p.t < 0) { p.t = 5 + Math.random() * 9; M.gesture(['nod', 'laugh', 'explain', 'think'][Math.floor(Math.random() * 4)]); }
			}
			M.update(dt, t, cam);
		}
		// the fire breathes
		fire.k = 3.6 * (0.85 + 0.15 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1));
	}
	function dispose() {
		for (const p of folk) p.P.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
		folk.length = 0;
	}
	return { update, dispose, folk, houses, stalls, centre, glows: glowSpots };
}
