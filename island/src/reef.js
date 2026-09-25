// The living reef. Coral heads (bommies) crowd the crater rim, the bay mouth and the
// crests of the seabed ridges: a knobbly base of old coral crusted pink and green, and
// piled on it the reef's own species, each grown from its Crysis genome (branching,
// finger, pillar, table, lettuce, brain corals, whips, sea fans, tube and barrel
// sponges). Which species dominate a head follows its depth, its exposure and the
// community field, so the reef forms stands rather than an even mix. Between the
// heads the sand stays open. Instanced per species, chunked for culling.

import * as THREE from 'three';
import { mulberry32, makeNoise } from './noise.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { communityField } from './crysis/ecology.js';

// build a geometry from a list of tapered tubes: [x0,y0,z0, x1,y1,z1, r0, r1, t0, t1]
function tubes(list, sides) {
	const P = [], T = [], I = [];
	const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3();
	for (const s of list) {
		a.set(s[0], s[1], s[2]); b.set(s[3], s[4], s[5]);
		d.subVectors(b, a).normalize();
		u.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize();
		v.crossVectors(d, u);
		const base = P.length / 3;
		for (let e = 0; e < 2; e++) {
			const c = e ? b : a, rr = e ? s[7] : s[6];
			for (let k = 0; k < sides; k++) {
				const th = k / sides * Math.PI * 2, cs = Math.cos(th) * rr, sn = Math.sin(th) * rr;
				P.push(c.x + u.x * cs + v.x * sn, c.y + u.y * cs + v.y * sn, c.z + u.z * cs + v.z * sn);
				T.push(e ? s[9] : s[8]);
			}
		}
		for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; I.push(base + k, base + k2, base + sides + k, base + k2, base + sides + k2, base + sides + k); }
		// a rounded cap at the tip
		P.push(b.x + d.x * s[7], b.y + d.y * s[7], b.z + d.z * s[7]); T.push(s[9]);
		const tip = P.length / 3 - 1;
		for (let k = 0; k < sides; k++) I.push(base + sides + k, base + sides + (k + 1) % sides, tip);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
	g.setIndex(I);
	g.computeVertexNormals();
	return g;
}

// coral: the instance colour at the base, lightening to pale polyp tips, with a fine
// speckle of polyps; sways a little if asked
function coralMat(shared, key, sway, extra = {}, tipCol = null) {
	const m = new THREE.MeshStandardMaterial({ roughness: 0.75, ...extra });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime; sh.uniforms.uBass = shared.uBass;
		sh.uniforms.uTip = { value: tipCol || new THREE.Color(0, 0, 0) }; sh.uniforms.uHasTip = { value: tipCol ? 1 : 0 };
		sh.vertexShader = 'attribute float aTip; varying float vTip; varying vec3 vRP; uniform float uTime, uBass;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vTip = aTip;
			{
				vec3 ip = vec3(instanceMatrix[3]);
				float sw = ${sway.toFixed(3)} * aTip * aTip;
				transformed.x += sin(uTime * 1.2 + ip.x * 0.37 + ip.z * 0.21) * sw;
				transformed.z += cos(uTime * 0.9 + ip.z * 0.33) * sw * 0.7;
				vRP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
			}`);
		sh.fragmentShader = 'varying float vTip; varying vec3 vRP; uniform vec3 uTip; uniform float uHasTip;\nfloat rh(vec3 p){ p = mod(p, 256.0); return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n'
			+ 'float rn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(rh(i), rh(i + vec3(1,0,0)), f.x), mix(rh(i + vec3(0,1,0)), rh(i + vec3(1,1,0)), f.x), f.y), mix(mix(rh(i + vec3(0,0,1)), rh(i + vec3(1,0,1)), f.x), mix(rh(i + vec3(0,1,1)), rh(i + vec3(1,1,1)), f.x), f.y), f.z); }\n'
			+ 'float rgv(vec3 p){ return smoothstep(0.3, 0.7, rn(p * 4.0 + rn(p * 1.5) * 2.0)); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 base = diffuseColor.rgb;
				vec3 tip = mix(mix(base * 1.3 + 0.05, vec3(0.9, 0.86, 0.76), 0.18), uTip, uHasTip * 0.75);
				diffuseColor.rgb = mix(base * 0.62, tip, smoothstep(0.35, 1.0, vTip));
				// polyps: a fine speckle, lighter on the tips
				float pp = rn(vRP * 16.0);
				diffuseColor.rgb *= 0.86 + 0.28 * pp;
				${key === 'sponge-tube' || key === 'sponge-barrel' ? 'if (!gl_FrontFacing) diffuseColor.rgb *= 0.25;' : ''}
				${key === 'mound' ? `
				// old coral: meandering brain grooves, pocks, and patches of green-brown turf
				float groove = rgv(vRP);
				diffuseColor.rgb *= 0.86 + 0.2 * groove;
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.2, 0.09), smoothstep(0.55, 0.8, rn(vRP * 0.7 + 4.0)) * 0.7);
				diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.2, 0.12), smoothstep(0.6, 0.85, rn(vRP * 1.9 - 2.0)) * 0.5);` : ''}
			}`);
	};
	m.customProgramCacheKey = () => 'coral234' + key;
	return m;
}

// ---------- growth forms: each species' shape is grown from its genome ----------
function growForm(g, seed) {
	const rr = mulberry32(seed);
	switch (g.form) {
		case 'branching': {
			// staghorn and bottlebrush: antlers forking up and out
			const L = [], th = 0.055 * g.thick;
			const grow = (x, y, z, dx, dy, dz, len, rad, t, depth) => {
				const x2 = x + dx * len, y2 = y + dy * len, z2 = z + dz * len, t2 = Math.min(1, t + 1 / (g.branchDepth + 1));
				L.push([x, y, z, x2, y2, z2, rad, rad * 0.75, t, t2]);
				if (depth >= g.branchDepth) return;
				const nb = depth === 0 ? g.forks + 2 : g.forks;
				for (let k = 0; k < nb; k++) {
					const a = (k / nb) * Math.PI * 2 + rr() * 1.2 + depth;
					const spread = (depth === 0 ? 1.4 : 0.9) * g.branchAngle;
					let ndx = dx + Math.cos(a) * spread, ndy = dy + 0.25, ndz = dz + Math.sin(a) * spread;
					const l = Math.hypot(ndx, ndy, ndz); ndx /= l; ndy /= l; ndz /= l;
					grow(x2, y2, z2, ndx, ndy, ndz, len * (0.72 + rr() * 0.2), rad * 0.74, t2, depth + 1);
				}
			};
			grow(0, -0.05, 0, 0, 1, 0, 0.3, th, 0, 0);
			return tubes(L, 5);
		}
		case 'digitate': {
			// finger coral: a clump of stubby upright fingers
			const L = [];
			for (let k = 0; k < g.count + 4; k++) {
				const a = rr() * 6.28, d = rr() * 0.3, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.2 + rr() * 0.3 * g.thick;
				L.push([x, -0.05, z, x + Math.cos(a) * 0.08, h, z + Math.sin(a) * 0.08, 0.05 * g.thick, 0.045 * g.thick, 0, 1]);
			}
			return tubes(L, 5);
		}
		case 'pillar': {
			// pillar coral: tall fat columns
			const L = [];
			for (let k = 0; k < 3 + (g.count % 4); k++) {
				const a = rr() * 6.28, d = k ? 0.12 + rr() * 0.15 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.5 + rr() * 0.6;
				L.push([x, -0.05, z, x * 1.1, h, z * 1.1, 0.09, 0.075, 0, 1]);
			}
			return tubes(L, 7);
		}
		case 'whip': {
			// sea whips: a tuft of long thin rods that sway
			const L = [];
			for (let k = 0; k < Math.min(10, g.count); k++) {
				const a = rr() * 6.28, lean = 0.1 + rr() * 0.25, h = 0.7 + rr() * 0.7;
				const mx = Math.cos(a) * lean * 0.4, mz = Math.sin(a) * lean * 0.4;
				L.push([0, -0.05, 0, mx, h * 0.5, mz, 0.025, 0.018, 0, 0.5]);
				L.push([mx, h * 0.5, mz, Math.cos(a) * lean, h, Math.sin(a) * lean, 0.018, 0.01, 0.5, 1]);
			}
			return tubes(L, 4);
		}
		case 'fan': {
			// a gorgonian: a flat branching lattice standing across the current
			const L = [];
			const grow = (x, y, a, len, rad, t, depth) => {
				const x2 = x + Math.sin(a) * len, y2 = y + Math.cos(a) * len, t2 = Math.min(1, t + 0.18);
				L.push([x, y, 0, x2, y2, 0, rad, rad * 0.8, t, t2]);
				if (depth >= 5) return;
				for (const sd of [-1, 1]) grow(x2, y2, a + sd * (0.3 + rr() * 0.25), len * (0.78 + rr() * 0.15), rad * 0.8, t2, depth + 1);
			};
			grow(0, -0.05, 0, 0.22, 0.03, 0, 0);
			return tubes(L, 3);
		}
		case 'tabular': {
			// table coral: a stalk under wide, thin, lobed plates, one or two tiers
			const P = [], T = [], I = [], SEG = 20, RINGS = 3;
			const plate = (y, R) => {
				const b = P.length / 3;
				P.push(0, y + 0.03, 0); T.push(0.2);
				for (let ring = 1; ring <= RINGS; ring++) for (let s = 0; s < SEG; s++) {
					const th = s / SEG * Math.PI * 2, f = ring / RINGS;
					const lobe = 1 + 0.12 * Math.sin(th * g.lobes + 1) + 0.06 * Math.sin(th * 11);
					P.push(Math.cos(th) * R * f * lobe, y + 0.03 - f * f * 0.06 + (ring === RINGS ? 0.03 : 0), Math.sin(th) * R * f * lobe); T.push(0.2 + f * 0.8);
				}
				for (let s = 0; s < SEG; s++) I.push(b, b + 1 + (s + 1) % SEG, b + 1 + s);
				for (let ring = 1; ring < RINGS; ring++) for (let s = 0; s < SEG; s++) {
					const a = b + 1 + (ring - 1) * SEG + s, a2 = b + 1 + (ring - 1) * SEG + (s + 1) % SEG, c = a + SEG, c2 = a2 + SEG;
					I.push(a, a2, c, a2, c2, c);
				}
			};
			plate(0.35, 0.8);
			if (g.tiers > 1) plate(0.18, 0.45);
			return withStalk(P, T, I, tubes([[0, -0.05, 0, 0, 0.36, 0, 0.09, 0.06, 0, 0.2]], 6));
		}
		case 'foliose': {
			// lettuce coral: thin curled plates rising in a rosette
			const P = [], T = [], I = [];
			const n = 5 + (g.count % 5);
			for (let k = 0; k < n; k++) {
				const a = k / n * 6.28 + rr() * 0.5, W = 0.22 + rr() * 0.12, Hh = 0.25 + rr() * 0.2, b = P.length / 3;
				const cx = Math.cos(a) * 0.12, cz = Math.sin(a) * 0.12, tx = -Math.sin(a), tz = Math.cos(a);
				for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) {
					const u = i / 4 - 0.5, v = j / 4, curl = Math.sin(u * 3.14 + g.curl * 3) * 0.06 * v + v * v * 0.1;
					P.push(cx + tx * u * W + Math.cos(a) * curl, v * Hh - 0.03 + Math.sin(u * 9 + k) * 0.015 * v, cz + tz * u * W + Math.sin(a) * curl);
					T.push(v);
				}
				for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const q = b + j * 5 + i; I.push(q, q + 1, q + 5, q + 1, q + 6, q + 5); }
			}
			return plain(P, T, I);
		}
		case 'massive': {
			// brain and boulder coral: a lumpy dome
			const geo = mergeVertices(new THREE.IcosahedronGeometry(0.5, 3).deleteAttribute('normal').deleteAttribute('uv')), p = geo.attributes.position, T = [];
			const nz = makeNoise(seed);
			for (let i = 0; i < p.count; i++) {
				const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
				const k = 0.85 + nz.fbm(x * 3 + 3, z * 3 + y * 2, 3) * 0.3;
				p.setXYZ(i, x * k, Math.max(y, -0.1) * k * (0.6 + g.curl * 0.5), z * k);
				T.push(Math.max(0, y) * 1.2);
			}
			geo.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
			geo.computeVertexNormals();
			return geo;
		}
		case 'sponge-tube': {
			// tube sponges: a cluster of open tubes, dark inside
			const P = [], T = [], I = [], SIDES = 8;
			for (let k = 0; k < 3 + (g.count % 4); k++) {
				const a = k / 5 * 6.28 + rr(), d = k ? 0.1 + rr() * 0.08 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d;
				const h = 0.35 + rr() * 0.5, rad = (0.05 + rr() * 0.035) * g.thick, lean = 0.08;
				const b = P.length / 3;
				for (let e = 0; e <= 3; e++) {
					const f = e / 3, y = f * h - 0.05, rr2 = rad * (0.85 + f * 0.3);
					for (let s = 0; s < SIDES; s++) { const th = s / SIDES * 6.28; P.push(x + Math.cos(a) * lean * f + Math.cos(th) * rr2, y, z + Math.sin(a) * lean * f + Math.sin(th) * rr2); T.push(f); }
				}
				for (let e = 0; e < 3; e++) for (let s = 0; s < SIDES; s++) { const i0 = b + e * SIDES + s, i1 = b + e * SIDES + (s + 1) % SIDES; I.push(i0, i1, i0 + SIDES, i1, i1 + SIDES, i0 + SIDES); }
			}
			return plain(P, T, I);
		}
		default: {
			// barrel sponge: a big ribbed vase, open at the top
			const prof = [];
			for (let i = 0; i <= 8; i++) { const f = i / 8; prof.push(new THREE.Vector2(0.18 + Math.sin(f * 2.4) * 0.28 - (i === 8 ? 0.04 : 0), f * 0.75 - 0.05)); }
			prof.push(new THREE.Vector2(0.3, 0.68), new THREE.Vector2(0.26, 0.4));
			const geo = new THREE.LatheGeometry(prof, 22), p = geo.attributes.position, T = [];
			for (let i = 0; i < p.count; i++) {
				const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(z, x), k = 1 + 0.07 * Math.max(0, Math.sin(th * 11));
				p.setXYZ(i, x * k, y, z * k); T.push(Math.min(1, (y + 0.05) / 0.75));
			}
			geo.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
			geo.computeVertexNormals();
			return geo;
		}
	}
}
function plain(P, T, I) {
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
	g.setIndex(I); g.computeVertexNormals();
	return g;
}
function withStalk(P, T, I, stalk) {
	const off = P.length / 3;
	return plain([...P, ...stalk.attributes.position.array], [...T, ...stalk.attributes.aTip.array], [...I, ...Array.from(stalk.index.array, (i) => i + off)]);
}
const SWAY = { whip: 0.18, fan: 0.1, branching: 0.012, 'sponge-tube': 0.03 };
const DOUBLE = { tabular: 1, foliose: 1, 'sponge-tube': 1, 'sponge-barrel': 1, fan: 1 };

export function createReef(island, shared, scene, keepClear = [], eco = null) {
	const bay = island.village.bay;
	const group = new THREE.Group();
	group.name = 'reef';
	scene.add(group);
	if (!bay || !eco) return { group, bommies: [], update() {} };
	const r = mulberry32(island.seed ^ 0x2eef);
	const nz = makeNoise(island.seed + 234);
	const H = (x, z) => island.heightAt(x, z);
	const clear = (x, z, pad) => keepClear.some((q) => Math.hypot(q.x - x, q.z - z) < pad);
	const community = communityField(island.seed);

	// ---------- where the heads grow ----------
	// on the crater rim and walls, across the bay mouth, and on ridge crests (where the
	// ground stands above its surroundings): in water deep enough to stay covered
	const bommies = [];
	for (let i = 0; i < 16000 && bommies.length < 200; i++) {
		const a = r() * 6.283, t = 0.28 + r() * 1.0;
		const x = bay.x + Math.cos(a) * t * bay.r, z = bay.z + Math.sin(a) * t * bay.r, h = H(x, z);
		if (h > -1.6 || h < -16 || clear(x, z, 7)) continue;
		if (bommies.some((b) => Math.hypot(b.x - x, b.z - z) < 5.5)) continue;
		const crest = h - (H(x + 6, z) + H(x - 6, z) + H(x, z + 6) + H(x, z - 6)) / 4;
		const rim = Math.exp(-Math.pow((t - 0.5) / 0.12, 2));
		const clump = nz.fbm(x * 0.03 + 1, z * 0.03 - 4, 3);
		if (r() > rim * 0.7 + Math.max(0, crest) * 0.35 + (clump - 0.4) * 0.8) continue;
		bommies.push({ x, z, h, R: 2.5 + r() * 2.5 });
	}

	// ---------- who grows where ----------
	// fitness from depth (light) and exposure (current on crests); then the community
	// field ranks the fit species differently region by region, so each head is
	// dominated by two or three species with a few accents
	const coral = eco.coral;
	const fitness = (g, depth, exposed) => {
		const [d0, d1] = g.depth;
		const inBand = depth < d0 ? Math.max(0, 1 - (d0 - depth) / 2) : depth > d1 ? Math.max(0, 1 - (depth - d1) / 4) : 1;
		const light = 1 - Math.abs(g.lightNeed - Math.max(0, 1 - depth / 16)) * 0.8;
		return inBand * light * (1 + (exposed ? g.currentLove : 0));
	};
	const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
	const lists = coral.map(() => []);
	const mounds = [];
	const MOUND = [[0.95, 0.3, 0.36], [0.22, 0.3, 0.28], [0.1, 0.4, 0.34], [0.12, 0.3, 0.4], [0.05, 0.3, 0.3]];
	const jit = (c, k = 0.06) => new THREE.Color().setHSL((c[0] + (r() - 0.5) * 0.03 + 1) % 1, c[1] * (1 + (r() - 0.5) * k * 3), c[2] * (1 + (r() - 0.5) * k * 2));
	for (const b of bommies) {
		// the base: a pile of two to four knobbly mounds of old coral
		const base = [];
		const nm = 2 + Math.floor(r() * 3);
		for (let j = 0; j < nm; j++) {
			const a = r() * 6.283, d = j ? r() * b.R * 0.6 : 0;
			const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, s = (j ? 0.6 + r() * 0.8 : 1.1 + r() * 0.9) * b.R * 0.34;
			const sy = s * (0.6 + r() * 0.6);
			const g = H(x, z), top = Math.min(sy, -1.2 - g);           // never proud of the water
			if (top < 0.3) continue;
			base.push({ x, z, s, sy: top, g });
			mounds.push({ x, y: g - s * 0.15, z, s, sy: top, rot: r() * 6.28, c: jit(MOUND[(r() * MOUND.length) | 0]) });
		}
		const surf = (x, z) => {
			let y = H(x, z);
			for (const m of base) { const d = Math.hypot(x - m.x, z - m.z) / m.s; if (d < 1) y = Math.max(y, m.g - m.s * 0.15 + m.sy * Math.sqrt(1 - d * d)); }
			return y;
		};
		// this head's community
		const cf = community(b.x, b.z), exposed = b.h > H(b.x + 8, b.z) + 0.5;
		const cell = Math.floor(cf.primary * 7), accent = Math.floor(cf.secondary * 5);
		const score = coral.map((g, i) => fitness(g, -b.h, exposed) * (0.15 + hash(i, cell) + 0.4 * hash(i + 40, accent)));
		const order = score.map((s, i) => i).sort((a, c) => score[c] - score[a]);
		const weights = coral.map(() => 0);
		order.forEach((i, rank) => { weights[i] = (rank < 3 ? score[i] * (3 - rank) : rank < 6 ? score[i] * 0.25 : 0) * coral[i].abundance; });
		const total = weights.reduce((s, w) => s + w, 0) || 1;
		const pickSpecies = () => { let t = r() * total; for (let i = 0; i < weights.length; i++) { t -= weights[i]; if (t <= 0) return i; } return order[0]; };
		const n = 30 + Math.floor(r() * 26);
		for (let j = 0; j < n; j++) {
			const a = r() * 6.283, d = Math.sqrt(r()) * b.R * 0.95;
			const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, y = surf(x, z);
			if (y > -1.5 || clear(x, z, 4)) continue;
			const i = pickSpecies(), g = coral[i];
			let s = g.size * (0.75 + r() * 0.6);
			s = Math.min(s, (-1.3 - y) * 0.8);                            // how much water above
			if (s < 0.2) continue;
			const tilt = g.form === 'tabular' ? 0.08 : 0.25;
			lists[i].push({ x, y: y - 0.05, z, s, rot: g.form === 'fan' ? Math.atan2(bay.z - z, bay.x - x) + (r() - 0.5) * 0.5 : r() * 6.28, tx: (r() - 0.5) * tilt, tz: (r() - 0.5) * tilt, c: jit(g.colour) });
		}
		// a fringe on the sand around the head: whips, fans and fingers
		for (let j = 0; j < 6; j++) {
			const a = r() * 6.283, d = b.R * (1.1 + r() * 0.8), x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, y = H(x, z);
			if (y > -1.8 || clear(x, z, 4)) continue;
			const cand = coral.map((g, i) => i).filter((i) => ['whip', 'fan', 'digitate', 'sponge-tube'].includes(coral[i].form));
			const i = cand[Math.floor(r() * cand.length)], g = coral[i];
			lists[i].push({ x, y: y - 0.05, z, s: Math.min(g.size * (0.5 + r() * 0.5), (-1.3 - y) * 0.8), rot: r() * 6.28, tx: 0, tz: 0, c: jit(g.colour) });
		}
	}

	// ---------- the shapes and skins, one per species ----------
	const moundGeo = (() => {
		const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute('normal').deleteAttribute('uv')), p = g.attributes.position, T = [];
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
			const k = 0.82 + nz.fbm(x * 1.8 + 3, z * 1.8 + y * 1.4, 3) * 0.35 + 0.06 * Math.sin(x * 11) * Math.sin(z * 11) * Math.sin(y * 9);
			p.setXYZ(i, x * k, Math.max(y, -0.2) * k, z * k);
			T.push(Math.max(0, y) * 0.5);
		}
		g.setAttribute('aTip', new THREE.Float32BufferAttribute(T, 1));
		g.computeVertexNormals();
		return g;
	})();
	const kinds = [{ geo: moundGeo, mat: coralMat(shared, 'mound', 0, { roughness: 0.95 }), list: mounds, mound: true }];
	coral.forEach((g, i) => {
		const tip = g.tip ? new THREE.Color().setHSL(g.tip[0], g.tip[1], g.tip[2]) : null;
		kinds.push({ g, geo: growForm(g, (island.seed ^ (i * 7919 + 13)) >>> 0), mat: coralMat(shared, g.form, SWAY[g.form] || 0, DOUBLE[g.form] ? { side: THREE.DoubleSide } : {}, tip), list: lists[i] });
	});

	// split into chunks so what is behind you, or lost in the blue, is not drawn
	const CH = 48, chunks = new Map();
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
	let count = 0;
	kinds.forEach((k, ki) => {
		for (const o of k.list) {
			const key = Math.floor(o.x / CH) + ',' + Math.floor(o.z / CH);
			if (!chunks.has(key)) chunks.set(key, { cx: (Math.floor(o.x / CH) + 0.5) * CH, cz: (Math.floor(o.z / CH) + 0.5) * CH, lists: new Map(), group: new THREE.Group() });
			const c = chunks.get(key);
			if (!c.lists.has(ki)) c.lists.set(ki, []);
			c.lists.get(ki).push(o);
		}
	});
	for (const c of chunks.values()) {
		for (const [ki, L] of c.lists) {
			const k = kinds[ki];
			const im = new THREE.InstancedMesh(k.geo, k.mat, L.length);
			L.forEach((o, i) => {
				e.set(o.tx || 0, o.rot, o.tz || 0); q.setFromEuler(e);
				if (k.mound) sc.set(o.s, o.sy, o.s * (0.8 + (i % 5) * 0.08)); else sc.setScalar(o.s);
				p.set(o.x, o.y, o.z);
				im.setMatrixAt(i, m4.compose(p, q, sc));
				im.setColorAt(i, o.c);
			});
			im.computeBoundingSphere();
			im.receiveShadow = true;
			im.castShadow = !!k.mound || k.g?.form === 'tabular' || k.g?.form === 'massive';
			im.userData.material175 = k.mound ? 'stone' : 'crystal';
			c.group.add(im);
			count += L.length;
		}
		group.add(c.group);
	}

	function update(active, cam) {
		group.visible = active;
		if (!active) return;
		for (const c of chunks.values()) c.group.visible = Math.hypot(c.cx - cam.x, c.cz - cam.z) < 110;
	}
	return { group, bommies, count, update, perSpecies: coral.map((g, i) => ({ genus: g.genus, common: g.common, n: lists[i].length })) };
}
