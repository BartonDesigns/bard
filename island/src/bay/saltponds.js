// The South Bay's salt ponds and marsh: Eden Landing, the Newark and Fremont ponds of the Don
// Edwards refuge either side of the Dumbarton Bridge, Ravenswood west of it, and the Alviso ponds
// to Mountain View. Each pond lies flat between straight dirt levees, its brine coloured by how
// salty it has grown: green and teal where the bay comes in, then salmon, rose, magenta and
// crimson, and the crystallizers by the Newark works dried to white crust, scraped in stripes.
// Pale salt rims the levees; power lines march across on lattice towers. Round them on the open
// shore, the marsh: glossy mudflats cut by branching channels at the water, cordgrass on the
// low banks, the red-and-green patchwork of pickleweed behind it, saltgrass and gumplant at the
// upland edge. The ponds' outlines are traced from the survey (saltpondmap.js); the ground under
// them is let down to their beds, so nothing shows through.

import * as THREE from 'three';
import { toWorld } from './geo.js';
import { bladeTex } from './edgekit.js';
import { REAL_U } from './realcity.js';
import { today } from '../calendar.js';
import { CHAINS, PONDS } from './saltpondmap.js';

// the marsh's reach: the shore from Eden Landing round to Alviso and back up to Menlo Park
const MARSH = [[37.625, -122.17], [37.625, -122.095], [37.575, -122.079], [37.545, -122.083], [37.53, -122.07], [37.522, -122.058], [37.515, -122.045], [37.512, -122.02], [37.505, -122.002], [37.497, -121.985], [37.488, -121.975], [37.482, -121.96], [37.47, -121.94], [37.455, -121.928], [37.44, -121.935], [37.428, -121.955], [37.418, -121.97], [37.413, -122.0], [37.415, -122.02], [37.42, -122.06], [37.428, -122.09], [37.438, -122.11], [37.452, -122.125], [37.468, -122.125], [37.478, -122.14], [37.482, -122.17], [37.5, -122.185], [37.53, -122.185]];
// the salt works at Newark, where the brine is saltiest
const WORKS = toWorld(37.505, -122.035);
// power lines across the ponds: [lat, lon] at each end
const LINES = [
	[[37.5075, -122.042], [37.4835, -122.134]],
	[[37.532, -122.066], [37.472, -122.026]],
	[[37.603, -122.128], [37.552, -122.094]],
	[[37.468, -121.952], [37.425, -122.012]],
];
// brine by salinity (sRGB): the bay's water, green and teal, then salmon and rust, rose,
// magenta, crimson; and the crust, cream to tan
const BRINE = ['#3f6b5a', '#3d6f7c', '#6f7a4a', '#d9786a', '#a8503a', '#e08a96', '#d0566a', '#c84a6e', '#b8406a', '#a8323f', '#c63c4c'];
const CRUST = ['#efebe4', '#e9dfcc', '#d8c6a4'];

const ih = (i, j) => {
	let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vn = (x, z) => {
	const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
	return (ih(i, j) * (1 - a) + ih(i + 1, j) * a) * (1 - b) + (ih(i, j + 1) * (1 - a) + ih(i + 1, j + 1) * a) * b;
};
function inPoly(P, x, z) {
	let c = false;
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
		const [ax, az] = P[i], [bx, bz] = P[j];
		if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) c = !c;
	}
	return c;
}

// the GLSL both the ponds and the marsh use: a value noise kept to small numbers
const SNOISE = /* glsl */`
float spH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float spN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(spH(i), spH(i + vec2(1, 0)), f.x), mix(spH(i + vec2(0, 1)), spH(i + vec2(1, 1)), f.x), f.y); }
`;

export function createSaltPonds(scene, bay, shared, { isPhone = false } = {}) {
	const root = new THREE.Group();
	root.name = 'saltponds';
	root.visible = false;
	scene.add(root);
	const S = { built: false, ponds: [], levees: [], grid: null, plants: 0 };
	const uTime = shared.uTime || { value: 0 }, uSkyHor = shared.uSkyHor || { value: new THREE.Color(0.6, 0.7, 0.8) };
	const uMarsh = { value: new THREE.Vector2() };          // x: pickleweed's autumn red, y: cordgrass gone to straw
	const marsh = MARSH.map(([a, b]) => { const p = toWorld(a, b); return [p.x, p.z]; });
	const B0 = toWorld(37.625, -122.19), B1 = toWorld(37.405, -121.92);
	const X0 = B0.x, Z0 = B0.z, X1 = B1.x, Z1 = B1.z, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;

	// ---------- the ponds' outlines ----------
	const pts = CHAINS.map((c) => {
		const out = [];
		let a = 0, b = 0;
		for (let k = 0; k < c.length; k += 2) {
			a += c[k]; b += c[k + 1];
			const p = toWorld(37.4 + a * 1e-5, -122.2 + b * 1e-5);
			out.push({ x: p.x, z: p.z, key: a * 100000 + b });
		}
		return out;
	});
	// a pond's rings, its chains joined end to end (the largest is its outline, any others islands)
	function ringsOf(refs) {
		const left = refs.map((r) => pts[r]), rings = [];
		while (left.length) {
			const ring = left.shift().slice();
			for (let guard = 0; guard < 400 && ring[ring.length - 1].key !== ring[0].key; guard++) {
				const end = ring[ring.length - 1].key;
				const k = left.findIndex((c) => c[0].key === end || c[c.length - 1].key === end);
				if (k < 0) break;
				const c = left.splice(k, 1)[0];
				ring.push(...(c[0].key === end ? c : c.slice().reverse()).slice(1));
			}
			if (ring[ring.length - 1].key === ring[0].key) ring.pop();
			if (ring.length >= 3) rings.push(ring);
		}
		const area = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j].x - r[i].x) * (r[j].z + r[i].z); return s / 2; };
		rings.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
		return rings.map((r) => ({ r, a: area(r) }));
	}
	for (let i = 0; i < PONDS.length; i++) {
		const [lvl, ...refs] = PONDS[i], rings = ringsOf(refs);
		if (!rings.length) continue;
		let cx = 0, cz = 0;
		for (const p of rings[0].r) { cx += p.x; cz += p.z; }
		cx /= rings[0].r.length; cz /= rings[0].r.length;
		S.ponds.push({ id: i, level: Math.max(1.2, lvl / 100), rings, cx, cz, area: Math.abs(rings[0].a) });
	}

	// which pond holds a point: a 20 m raster over the whole reach (0 for none)
	const GS = 20, GW = Math.ceil((X1 - X0) / GS), GH = Math.ceil((Z1 - Z0) / GS), grid = new Uint8Array(GW * GH);
	for (const P of S.ponds) {
		const all = P.rings.map((q) => q.r);
		let z0 = 1e9, z1 = -1e9;
		for (const p of all[0]) { z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
		for (let j = Math.max(0, Math.floor((z0 - Z0) / GS)); j <= Math.min(GH - 1, Math.ceil((z1 - Z0) / GS)); j++) {
			const z = Z0 + (j + 0.5) * GS, xs = [];
			for (const r of all) for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
				const a = r[i], b = r[k];
				if ((a.z > z) !== (b.z > z)) xs.push(a.x + (b.x - a.x) * (z - a.z) / (b.z - a.z));
			}
			xs.sort((a, b) => a - b);
			for (let c = 0; c + 1 < xs.length; c += 2) {
				for (let i = Math.max(0, Math.ceil((xs[c] - X0) / GS - 0.5)); i <= Math.min(GW - 1, Math.floor((xs[c + 1] - X0) / GS - 0.5)); i++) grid[j * GW + i] = P.id + 1;
			}
		}
	}
	const pondAt = (x, z) => {
		const i = Math.floor((x - X0) / GS), j = Math.floor((z - Z0) / GS);
		if (i < 0 || j < 0 || i >= GW || j >= GH) return null;
		const k = grid[j * GW + i];
		return k ? PONDS_BY[k - 1] : null;
	};
	const PONDS_BY = [];
	for (const P of S.ponds) PONDS_BY[P.id] = P;

	// each pond's brine: saltier toward the works, and by chance
	for (const P of S.ponds) {
		const d = Math.hypot(P.cx - WORKS.x, P.cz - WORKS.z), r = ih(P.id, 7), r2 = ih(P.id, 13);
		const sal = Math.min(1, Math.max(0, 0.35 + 0.55 * Math.exp(-d / 6000) + (r - 0.5) * 0.7));
		P.crust = (d < 6000 && P.area < 900000 && r2 > 0.45) || (sal > 0.7 && r2 > 0.75);
		const pick = P.crust ? CRUST[Math.floor(r2 * 7) % 3] : BRINE[Math.min(BRINE.length - 1, Math.floor(sal * BRINE.length))];
		P.col = new THREE.Color().setStyle(pick, THREE.SRGBColorSpace);
		P.angle = ih(P.id, 3) * Math.PI;
	}

	// ---------- the ground under them let down to their beds ----------
	function regrade() {
		for (const Lv of bay.levels) {
			const tex = Lv?.tex, D = tex?.image?.data;
			if (!Lv || !D || Lv.step > 130) continue;
			const st = Lv.step, rows = new Set();
			const i0 = Math.max(0, Math.floor((X0 - Lv.x0) / st)), i1 = Math.min(Lv.W - 1, Math.ceil((X1 - Lv.x0) / st));
			const j0 = Math.max(0, Math.floor((Z0 - Lv.zN) / st)), j1 = Math.min(Lv.H - 1, Math.ceil((Z1 - Lv.zN) / st));
			for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
				const x = Lv.x0 + i * st, z = Lv.zN + j * st;
				let P = pondAt(x, z), t;
				if (P) t = Math.max(0.05, P.level - 2.5);
				else {
					// (just outside a pond: under its brine, so the ground between doesn't show through it)
					let lo = 1e9;
					for (let a = 0; a < 8; a++) { const Q = pondAt(x + Math.cos(a * 0.785) * st, z + Math.sin(a * 0.785) * st); if (Q) lo = Math.min(lo, Q.level - 0.4); }
					if (lo > 1e8) continue;
					t = lo;
				}
				const q = j * Lv.W + i;
				if (t < Lv.v[q] / 20 - 1000) { Lv.v[q] = Math.round((t + 1000) * 20); D[q] = THREE.DataUtils.toHalfFloat(t); rows.add(j); }
			}
			// (the whole map sent again: a map not yet on the GPU sent as only these rows would
			// leave the rest of it empty, the seabed at the surface)
			if (rows.size) { tex.clearUpdateRanges(); tex.needsUpdate = true; }
		}
	}

	// ---------- materials ----------
	// the brine: its own colour, a drift of paler water across it, ripples catching the sun,
	// the sky in it low down; or dry crust, scraped in stripes. Pale salt along the levees.
	function pondMaterial(rim) {
		// (the rim drawn over the brine; the brine itself held well above the ground, not pushed back,
		// which at a low angle would put it behind)
		const m = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, envMapIntensity: 0.12, polygonOffset: rim, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, { uTime, uSkyHor });
			sh.vertexShader = 'attribute vec3 aCol; attribute vec4 aPond; varying vec3 vSC; varying vec4 vSP; varying vec2 vSW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSC = aCol; vSP = aPond; vSW = (modelMatrix * vec4(position, 1.0)).xz;');
			sh.fragmentShader = 'uniform float uTime; uniform vec3 uSkyHor; varying vec3 vSC; varying vec4 vSP; varying vec2 vSW;\n' + SNOISE + sh.fragmentShader
				.replace('#include <color_fragment>', `
					vec2 sw = mod(vSW, 4096.0);
					float n1 = spN(sw / 256.0 + vSP.y * 13.0), n2 = spN(sw / 64.0 + vSP.y * 7.0), n3 = spN(sw / 8.0);
					vec3 sc = vSC * (0.8 + 0.24 * n1 + 0.08 * n2);
					sc = mix(sc, sc * 0.6 + vec3(0.32, 0.24, 0.25), smoothstep(0.6, 0.85, n1 * 0.7 + n2 * 0.3) * 0.35);
					if (vSP.x > 0.5) {
						float st = sin(dot(sw, vec2(cos(vSP.z), sin(vSP.z))) * 0.9);
						sc = mix(vSC, vec3(0.86, 0.83, 0.77), n2 * 0.4) * (0.92 + 0.04 * st + 0.08 * n3);
					}
					sc = mix(sc, vec3(0.86, 0.84, 0.8), smoothstep(0.4, 0.95, vSP.w + (n3 - 0.5) * 0.35));
					diffuseColor.rgb = sc;`)
				.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.42, 0.95, max(vSP.x, vSP.w * 0.6));')
				.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
					if (vSP.x < 0.5) {
						float ra = spN(sw * 0.5 + vec2(uTime * 0.5, uTime * 0.3)), rb = spN(sw * 0.5 + vec2(17.0 - uTime * 0.35, 5.0 + uTime * 0.45));
						normal = normalize(normal + (viewMatrix * vec4(ra - 0.5, 0.0, rb - 0.5, 0.0)).xyz * 0.5);
					}`)
				.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
					{ float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);
					  totalEmissiveRadiance += uSkyHor * fr * 0.12 * (1.0 - vSP.x) * (1.0 - vSP.w); }`);
		};
		m.customProgramCacheKey = () => 'saltpond';
		return m;
	}
	const pondM = pondMaterial(false), rimM = pondMaterial(true);
	const leveeM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
	// the marsh laid over the ground: by its height above the bay, mud and channels at the
	// water, cordgrass, pickleweed, then saltgrass and gumplant; ragged where it ends
	const marshM = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
	marshM.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, { uTime, uSkyHor, uMarsh, uSeason: REAL_U.uSeason });
		sh.vertexShader = 'attribute vec2 aMarsh; varying vec2 vMa; varying vec2 vMW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMa = aMarsh; vMW = (modelMatrix * vec4(position, 1.0)).xz;');
		sh.fragmentShader = 'uniform float uTime, uSeason; uniform vec3 uSkyHor; uniform vec2 uMarsh; varying vec2 vMa; varying vec2 vMW;\n' + SNOISE + sh.fragmentShader
			.replace('#include <color_fragment>', `
				vec2 mw = mod(vMW, 4096.0);
				float m1 = spN(mw / 64.0), m2 = spN(mw / 16.0), m3 = spN(mw / 4.0), m4 = spN(mw);
				if (vMa.y < 0.2 + 0.6 * spN(mw / 128.0 + 3.0)) discard;
				float mh = vMa.x + (m1 - 0.5) * 0.24 + (m2 - 0.5) * 0.08;
				// the channels: branching lines of wet mud and water through the flats
				float ch = 1.0 - abs(2.0 * spN(mw / 32.0 + vec2(m2, m1) * 1.5) - 1.0);
				mh -= smoothstep(0.88, 0.97, ch) * 0.4;
				vec3 mud = mix(vec3(0.12, 0.1, 0.08), vec3(0.19, 0.16, 0.12), m2) * (0.85 + 0.25 * m4);
				mud = mix(mud, vec3(0.24, 0.22, 0.09), smoothstep(0.5, 0.8, m1) * 0.35);
				vec3 water = mix(vec3(0.05, 0.1, 0.12), vec3(0.07, 0.12, 0.13), m2);
				vec3 cord = mix(vec3(0.08, 0.16, 0.035), vec3(0.12, 0.22, 0.05), m3) * (0.8 + 0.3 * m4);
				cord = mix(cord, mix(vec3(0.4, 0.33, 0.16), vec3(0.5, 0.42, 0.22), m3), uMarsh.y);
				float red = smoothstep(0.45, 0.65, spN(mw / 96.0 + 9.0) * 0.6 + m1 * 0.25 + m3 * 0.15) * (0.2 + 0.6 * uMarsh.x);
				vec3 pick = mix(mix(vec3(0.11, 0.15, 0.045), vec3(0.16, 0.19, 0.06), m4), mix(vec3(0.2, 0.06, 0.045), vec3(0.28, 0.09, 0.06), m4), red);
				vec3 up = mix(vec3(0.28, 0.32, 0.17), vec3(0.42, 0.38, 0.22), uSeason * 0.7) * (0.85 + 0.3 * m3);
				up = mix(up, vec3(0.1, 0.16, 0.06), smoothstep(0.7, 0.8, m3 * 0.6 + m4 * 0.4) * 0.8);
				up = mix(up, vec3(0.75, 0.6, 0.06), smoothstep(0.86, 0.9, m4) * smoothstep(0.6, 0.75, m3) * (1.0 - uSeason * 0.5));
				float wetK = 1.0 - smoothstep(-0.04, 0.04, mh);
				vec3 mc = mix(water, mud, smoothstep(-0.06, 0.0, mh));
				mc = mix(mc, cord, smoothstep(0.14, 0.2, mh));
				mc = mix(mc, pick, smoothstep(0.3, 0.38, mh));
				mc = mix(mc, up, smoothstep(1.2, 1.35, mh));
				float mudK = 1.0 - smoothstep(0.12, 0.2, mh);
				diffuseColor.rgb = mc;`)
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.9, mix(0.32, 0.12, wetK), mudK);')
			.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
				{ float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);
				  totalEmissiveRadiance += uSkyHor * fr * mudK * mix(0.25, 0.5, wetK); }`);
	};
	marshM.customProgramCacheKey = () => 'saltmarsh';

	// ---------- building it all ----------
	const tiles = new Map();         // 4 km tiles, so what's off screen isn't drawn
	const TILE = 4096;
	function bucket(name, x, z) {
		const k = name + ':' + Math.floor(x / TILE) + ',' + Math.floor(z / TILE);
		let b = tiles.get(k);
		if (!b) { b = { name, P: [], N: [], C: [], A: [], I: [] }; tiles.set(k, b); }
		return b;
	}
	function finish(b, mat, attrs) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
		if (b.N.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
		for (const [name, n, src] of attrs) g.setAttribute(name, new THREE.Float32BufferAttribute(b[src], n));
		g.setIndex(b.I);
		if (!b.N.length) g.computeVertexNormals();
		g.computeBoundingSphere();
		const m = new THREE.Mesh(g, mat);
		m.matrixAutoUpdate = false;
		m.receiveShadow = !isPhone;
		root.add(m);
		return m;
	}

	function buildPonds() {
		const RIM = 20;
		for (const P of S.ponds) {
			const b = bucket('pond', P.cx, P.cz), r = bucket('rim', P.cx, P.cz), y = P.level;
			const contour = P.rings[0].r.map((p) => new THREE.Vector2(p.x, p.z)), holes = P.rings.slice(1).map((q) => q.r.map((p) => new THREE.Vector2(p.x, p.z)));
			const tri = THREE.ShapeUtils.triangulateShape(contour, holes), all = [...contour, ...holes.flat()], o = b.P.length / 3;
			const seed = ih(P.id, 21);
			for (const v of all) { b.P.push(v.x, y, v.y); b.N.push(0, 1, 0); b.C.push(P.col.r, P.col.g, P.col.b); b.A.push(P.crust ? 1 : 0, seed, P.angle, 0); }
			for (const [i, j, k] of tri) {
				const a = all[i], c = all[j], d = all[k];
				// (facing up)
				if ((c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x) > 0) b.I.push(o + i, o + k, o + j); else b.I.push(o + i, o + j, o + k);
			}
			// the salt rim: a band in from each edge, white at the levee to the brine's own colour
			for (const q of P.rings) {
				const R = q.r, inward = (q === P.rings[0]) === (q.a > 0) ? 1 : -1;
				for (let i = 0; i < R.length; i++) {
					const A = R[i], C = R[(i + 1) % R.length], dx = C.x - A.x, dz = C.z - A.z, L = Math.hypot(dx, dz);
					if (L < 1) continue;
					const nx = dz / L * inward, nz = -dx / L * inward, w = Math.min(RIM, L * 0.6), ro = r.P.length / 3;
					r.P.push(A.x, y, A.z, C.x, y, C.z, A.x + nx * w, y, A.z + nz * w, C.x + nx * w, y, C.z + nz * w);
					for (let k = 0; k < 4; k++) { r.N.push(0, 1, 0); r.C.push(P.col.r, P.col.g, P.col.b); r.A.push(P.crust ? 1 : 0, seed, P.angle, k < 2 ? 1 : 0); }
					// (wound to face up, whichever side is in)
					if (dx * nz - dz * nx > 0) r.I.push(ro, ro + 2, ro + 1, ro + 1, ro + 2, ro + 3); else r.I.push(ro, ro + 1, ro + 2, ro + 1, ro + 3, ro + 2);
				}
			}
		}
		for (const b of tiles.values()) {
			if (b.name !== 'pond' && b.name !== 'rim') continue;
			finish(b, b.name === 'pond' ? pondM : rimM, [['aCol', 3, 'C'], ['aPond', 4, 'A']]);
		}
	}

	// the levees: a track along the top, sloping banks down to the brine, white with salt at the foot
	const leveeSeg = new Map();          // 200 m cells: the segments, to walk on
	function buildLevees() {
		const c = new THREE.Color();
		const PROF = [[-8.5, -1, 0.82, 0.8, 0.76], [-6.5, -0.75, 0.55, 0.5, 0.44], [-2.6, 0, 0.62, 0.58, 0.5], [-1.1, 0, 0.5, 0.46, 0.4], [0, 0, 0.68, 0.64, 0.57],
			[1.1, 0, 0.5, 0.46, 0.4], [2.6, 0, 0.62, 0.58, 0.5], [6.5, -0.75, 0.55, 0.5, 0.44], [8.5, -1, 0.82, 0.8, 0.76]];
		const ends = new Map();
		for (let ci = 0; ci < pts.length; ci++) {
			const L = pts[ci];
			if (L.length < 2) continue;
			// the ponds either side, and the top above the higher
			const m = Math.floor(L.length / 2) - 1, A = L[Math.max(0, m)], B = L[m + 1], dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz) || 1;
			const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2, nx = dz / len, nz = -dx / len;
			const Pl = pondAt(mx - nx * 14, mz - nz * 14), Pr = pondAt(mx + nx * 14, mz + nz * 14);
			if (!Pl && !Pr) continue;
			const top = Math.max(Pl?.level ?? 0, Pr?.level ?? 0) + 0.9, lowL = Pl ? Pl.level - 0.3 : top - 2.4, lowR = Pr ? Pr.level - 0.3 : top - 2.4;
			const b = bucket('levee', A.x, A.z), o = b.P.length / 3, NP = PROF.length;
			for (let i = 0; i < L.length; i++) {
				// (the normal at a corner: the two edges' averaged, held to its width)
				const p = L[i], a = L[Math.max(0, i - 1)], q = L[Math.min(L.length - 1, i + 1)];
				let tx = q.x - a.x, tz = q.z - a.z;
				const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
				let k = 1;
				if (i > 0 && i < L.length - 1) {
					const ux = (p.x - a.x) / (Math.hypot(p.x - a.x, p.z - a.z) || 1), uz = (p.z - a.z) / (Math.hypot(p.x - a.x, p.z - a.z) || 1);
					k = Math.min(2, 1 / Math.max(0.5, tz * uz + tx * ux));
				}
				const shade = 0.9 + 0.2 * ih(ci * 31 + i, 5);
				for (const [u, dy, r, g, bb] of PROF) {
					const y = dy < 0 ? top + (u < 0 ? lowL - top : lowR - top) * -dy : top;
					b.P.push(p.x + tz * u * k, y, p.z - tx * u * k);
					c.setRGB(r * shade, g * shade, bb * shade, THREE.SRGBColorSpace);
					b.C.push(c.r, c.g, c.b);
				}
				if (i > 0) {
					const s0 = o + (i - 1) * NP, s1 = o + i * NP;
					for (let j = 0; j < NP - 1; j++) b.I.push(s0 + j, s1 + j, s0 + j + 1, s0 + j + 1, s1 + j, s1 + j + 1);
					const k2 = Math.floor(p.x / 200) + ',' + Math.floor(p.z / 200), seg = [L[i - 1].x, L[i - 1].z, p.x, p.z, top];
					for (const kk of new Set([k2, Math.floor(L[i - 1].x / 200) + ',' + Math.floor(L[i - 1].z / 200)])) { if (!leveeSeg.has(kk)) leveeSeg.set(kk, []); leveeSeg.get(kk).push(seg); }
				}
			}
			for (const e of [L[0], L[L.length - 1]]) ends.set(e.key, { x: e.x, z: e.z, top: Math.max(ends.get(e.key)?.top ?? 0, top) });
		}
		// where levees meet, a mound joining them
		const cap = new THREE.CylinderGeometry(2.6, 8.5, 1, 10, 1, true), cp = cap.attributes.position;
		for (const e of ends.values()) {
			const b = bucket('levee', e.x, e.z), o = b.P.length / 3;
			for (let i = 0; i < cp.count; i++) {
				const yv = cp.getY(i), up = yv > 0;
				b.P.push(e.x + cp.getX(i), up ? e.top + 0.02 : e.top - 2.4, e.z + cp.getZ(i));
				c.setRGB(up ? 0.62 : 0.8, up ? 0.58 : 0.78, up ? 0.5 : 0.74, THREE.SRGBColorSpace);
				b.C.push(c.r, c.g, c.b);
			}
			const ix = cap.index.array;
			for (let i = 0; i < ix.length; i++) b.I.push(o + ix[i]);
			const t0 = b.P.length / 3;
			b.P.push(e.x, e.top + 0.02, e.z);
			c.setRGB(0.64, 0.6, 0.53, THREE.SRGBColorSpace); b.C.push(c.r, c.g, c.b);
			for (let s = 0; s < 10; s++) b.I.push(t0, o + s, o + s + 1);
		}
		cap.dispose();
		for (const b of tiles.values()) if (b.name === 'levee') { const m = finish(b, leveeM, [['color', 3, 'C']]); m.castShadow = !isPhone; }
	}

	// the marsh over the open shore: a grid at the survey's own 60 m, where the ground is between the bay and the upland
	function* buildMarsh() {
		const st = 60, nx = Math.ceil((X1 - X0) / st) + 1, nz = Math.ceil((Z1 - Z0) / st) + 1;
		const H = new Float32Array(nx * nz), E = new Float32Array(nx * nz);
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
			if (i === 0 && j % 60 === 0) yield;
			const x = X0 + i * st, z = Z0 + j * st, h = bay.heightAt(x, z), k = j * nx + i;
			H[k] = h;
			const inside = inPoly(marsh, x, z) && !pondAt(x, z);
			// (strongest mid-marsh, fading out above the upland edge and into the bay)
			E[k] = inside ? Math.min(1, Math.max(0, (h + 0.12) / 0.2)) * Math.min(1, Math.max(0, (1.9 - h) / 0.5)) : 0;
		}
		for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
			const k = j * nx + i, e = [k, k + 1, k + nx, k + nx + 1];
			if (Math.max(E[e[0]], E[e[1]], E[e[2]], E[e[3]]) <= 0) continue;
			const b = bucket('marsh', X0 + i * st, Z0 + j * st), o = b.P.length / 3;
			for (const q of e) {
				const x = X0 + (q % nx) * st, z = Z0 + Math.floor(q / nx) * st;
				b.P.push(x, Math.max(H[q], -0.2) + 0.1, z);
				b.A.push(H[q], E[q]);
			}
			b.I.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
		}
		for (const b of tiles.values()) if (b.name === 'marsh') finish(b, marshM, [['aMarsh', 2, 'A']]);
		S.marshH = { H, nx, nz, st };
	}
	// the marsh's height above the bay and how much marsh there is, as the drape has it
	function marshAt(x, z) {
		const M = S.marshH;
		if (!M) return null;
		const fx = (x - X0) / M.st, fz = (z - Z0) / M.st, i = Math.floor(fx), j = Math.floor(fz);
		if (i < 0 || j < 0 || i >= M.nx - 1 || j >= M.nz - 1) return null;
		const u = fx - i, v = fz - j, k = j * M.nx + i, H = M.H;
		return H[k] * (1 - u) * (1 - v) + H[k + 1] * u * (1 - v) + H[k + M.nx] * (1 - u) * v + H[k + M.nx + 1] * u * v;
	}

	// ---------- the power lines ----------
	function buildPylons() {
		// a lattice tower: four legs leaning in, cross-arms for three wires, a little bracing
		const parts = [], add = (g) => parts.push(g.toNonIndexed());
		for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
			const leg = new THREE.CylinderGeometry(0.12, 0.2, 34, 4, 1, true);
			leg.rotateZ(sx * 0.07); leg.rotateX(-sz * 0.07); leg.translate(sx * 1.6, 17, sz * 1.6);
			add(leg);
		}
		for (let k = 0; k < 6; k++) {
			const y = 4 + k * 5.2, w = 3.5 - y * 0.075;
			add(new THREE.BoxGeometry(w * 2, 0.16, 0.16).translate(0, y, w));
			add(new THREE.BoxGeometry(w * 2, 0.16, 0.16).translate(0, y, -w));
			add(new THREE.BoxGeometry(0.16, 0.16, w * 2).translate(w, y, 0));
			add(new THREE.BoxGeometry(0.16, 0.16, w * 2).translate(-w, y, 0));
		}
		add(new THREE.BoxGeometry(16, 0.5, 0.6).translate(0, 26, 0));
		add(new THREE.BoxGeometry(11, 0.5, 0.6).translate(0, 31, 0));
		add(new THREE.ConeGeometry(1.3, 4, 4).translate(0, 36, 0));
		add(new THREE.BoxGeometry(5, 1.2, 5).translate(0, 0.2, 0));
		const tower = mergeAll(parts);
		const at = [], wires = [];
		for (const [[a0, b0], [a1, b1]] of LINES) {
			const p = toWorld(a0, b0), q = toWorld(a1, b1), L = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(2, Math.round(L / 320)), yaw = Math.atan2(q.x - p.x, q.z - p.z);
			let prev = null;
			for (let i = 0; i <= n; i++) {
				const x = p.x + (q.x - p.x) * i / n, z = p.z + (q.z - p.z) * i / n, Pd = pondAt(x, z);
				const y = Pd ? Pd.level - 0.3 : Math.max(0, bay.heightAt(x, z)) - 0.3;
				at.push([x, y, z, yaw]);
				if (prev) for (const [ox, oy] of [[-7.6, 25.7], [7.6, 25.7], [-5.1, 30.7], [5.1, 30.7]]) {
					const ca = Math.cos(yaw), sa = Math.sin(yaw);
					const ax = prev[0] + ox * ca, az = prev[2] - ox * sa, bx = x + ox * ca, bz = z - ox * sa;
					for (let s = 0; s < 8; s++) {
						const t0 = s / 8, t1 = (s + 1) / 8, sag = (t) => 4 * t * (1 - t) * 6;
						wires.push(ax + (bx - ax) * t0, prev[1] + oy + (y - prev[1]) * t0 - sag(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, prev[1] + oy + (y - prev[1]) * t1 - sag(t1), az + (bz - az) * t1);
					}
				}
				prev = [x, y, z];
			}
		}
		const im = new THREE.InstancedMesh(tower, new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.55, metalness: 0.6 }), at.length);
		const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
		at.forEach(([x, y, z, yaw], i) => im.setMatrixAt(i, m4.compose(pv.set(x, y, z), qq.setFromAxisAngle(up, yaw), one)));
		im.computeBoundingSphere();
		im.castShadow = !isPhone;
		root.add(im);
		const wg = new THREE.BufferGeometry();
		wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
		root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x77797c })));
		S.pylons = at.length;
	}
	function mergeAll(parts) {
		let n = 0;
		for (const g of parts) n += g.attributes.position.count;
		const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
		let o = 0;
		for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(P, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
		return g;
	}

	// ---------- the plants, near you ----------
	// cordgrass in tall clumps, pickleweed in low mats, saltgrass tufts and gumplant bushes
	const blade = bladeTex();
	const tuftG = (() => {
		const g = [];
		for (let k = 0; k < 3; k++) g.push(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(k * Math.PI / 3).toNonIndexed());
		let n = 0;
		for (const p of g) n += p.attributes.position.count;
		const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
		let o = 0;
		for (const p of g) { P.set(p.attributes.position.array, o * 3); U.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; p.dispose(); }
		for (let i = 0; i < n; i++) N[i * 3 + 1] = 1;
		const out = new THREE.BufferGeometry();
		out.setAttribute('position', new THREE.BufferAttribute(P, 3));
		out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
		out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
		return out;
	})();
	const tuftM = new THREE.MeshStandardMaterial({ map: blade, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.9 });
	const matG = new THREE.IcosahedronGeometry(1, 1).scale(1, 0.35, 1).translate(0, 0.12, 0);
	const bushG = (() => {
		const parts = [new THREE.IcosahedronGeometry(0.55, 1).translate(0, 0.45, 0).toNonIndexed()];
		const cols = [];
		for (let i = 0; i < parts[0].attributes.position.count; i++) cols.push(0.2, 0.3, 0.12);
		for (let k = 0; k < 9; k++) {
			const a = ih(k, 2) * 6.283, r = 0.35 + ih(k, 3) * 0.2, f = new THREE.OctahedronGeometry(0.07, 0).translate(Math.cos(a) * r, 0.75 + ih(k, 4) * 0.2, Math.sin(a) * r);
			parts.push(f);
			for (let i = 0; i < f.attributes.position.count; i++) cols.push(0.95, 0.72, 0.05);
		}
		const g = mergeAll(parts);
		g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
		return g;
	})();
	const plantM = new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true });
	const CAP = isPhone ? [1600, 1400, 220, 900] : [4200, 3600, 600, 2400];
	const kinds = [tuftG, matG, bushG, tuftG].map((g, i) => {
		const m = new THREE.InstancedMesh(g, i === 1 ? new THREE.MeshStandardMaterial({ roughness: 0.75 }) : i === 2 ? plantM : tuftM, CAP[i]);
		m.count = 0; m.frustumCulled = false;
		m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP[i] * 3).fill(1), 3);
		root.add(m);
		return m;
	});
	let plantAt = null, job = null;
	function* plant(cx, cz) {
		const R = isPhone ? 90 : 140, sp = isPhone ? 2.6 : 2, n = [0, 0, 0, 0], col = new THREE.Color();
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
		const red = uMarsh.value.x, straw = uMarsh.value.y, dry = REAL_U.uSeason.value;
		const put = (k, x, y, z, sx, sy, r, g, b) => {
			if (n[k] >= CAP[k]) return;
			e.set(0, ih(x * 7, z * 3) * 6.283, 0);
			kinds[k].setMatrixAt(n[k], m4.compose(p.set(x, y, z), q.setFromEuler(e), s.set(sx, sy, sx)));
			kinds[k].instanceColor.setXYZ(n[k], r, g, b);
			n[k]++;
		};
		let t0 = performance.now();
		const i0 = Math.floor((cx - R) / sp), i1 = Math.ceil((cx + R) / sp), j0 = Math.floor((cz - R) / sp), j1 = Math.ceil((cz + R) / sp);
		for (let j = j0; j <= j1; j++) {
			if (performance.now() - t0 > 6) { show(n); yield; t0 = performance.now(); }
			for (let i = i0; i <= i1; i++) {
				const r1 = ih(i, j), r2 = ih(i + 7, j - 3), x = (i + r1) * sp, z = (j + r2) * sp;
				const d2 = (x - cx) ** 2 + (z - cz) ** 2;
				// (thinner further off, so the ring is filled to its edge)
				if (d2 > R * R || (d2 > 2500 && r2 < (Math.sqrt(d2) - 50) / (R - 40))) continue;
				const h0 = marshAt(x, z);
				if (h0 === null || h0 < 0.0 || h0 > 1.9 || pondAt(x, z) || !inPoly(marsh, x, z)) continue;
				const mh = h0 + (vn(x / 64, z / 64) - 0.5) * 0.24 + (vn(x / 16, z / 16) - 0.5) * 0.08, y = bay.heightAt(x, z) + 0.05;
				if (mh > 0.17 && mh < 0.34) {
					// cordgrass: dense, bright green, to a metre and more; straw in winter
					const g = 0.75 + r1 * 0.4;
					col.setRGB(0.32 + 0.5 * straw, 0.62 - 0.1 * straw, 0.12 + 0.18 * straw);
					put(0, x, y - 0.05, z, 0.8 + r2 * 0.5, 0.8 + r1 * 0.5, col.r * g, col.g * g, col.b * g);
				} else if (mh >= 0.34 && mh < 1.25 && r1 < 0.7) {
					// pickleweed: green, the tips red in late summer and fall, in patches
					const rk = (vn(x / 96 + 9, z / 96) * 0.6 + vn(x / 64, z / 64) * 0.25 + vn(x / 4, z / 4) * 0.15 > 0.55 ? 1 : 0) * (0.2 + 0.6 * red);
					col.setRGB(0.22 + 0.4 * rk, 0.3 - 0.2 * rk, 0.08 + 0.02 * rk);
					put(1, x, y - 0.06, z, 0.6 + r2 * 0.5, 0.7 + r1 * 0.6, col.r, col.g, col.b);
				} else if (mh >= 1.25) {
					// the upland edge: gumplant here and there, saltgrass between
					if (r1 > 0.93) put(2, x, y - 0.05, z, 0.8 + r2 * 0.5, 0.8 + r2 * 0.4, 1, 1, 1);
					else if (r1 < 0.7) { const k = 0.8 + r2 * 0.3; put(3, x, y - 0.03, z, 0.45, 0.25 + r2 * 0.15, (0.55 + 0.2 * dry) * k, (0.62 + 0.05 * dry) * k, (0.38 + 0.05 * dry) * k); }
				}
			}
		}
		show(n);
	}
	// (what is laid so far, shown)
	function show(n) {
		for (let k = 0; k < 4; k++) { kinds[k].count = n[k]; kinds[k].instanceMatrix.needsUpdate = true; kinds[k].instanceColor.needsUpdate = true; }
		S.plants = n.reduce((a, b) => a + b, 0);
	}

	// ---------- walking on the levees ----------
	function floor(x, z, y) {
		const L = leveeSeg.get(Math.floor(x / 200) + ',' + Math.floor(z / 200));
		if (!L) return -1e9;
		let best = -1e9;
		for (const [ax, az, bx, bz, top] of L) {
			const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
			const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
			if (d > 6.5) continue;
			const h = d < 2.6 ? top : top - (d - 2.6) * 0.25;
			if (h > best && y > h - 1.2) best = h;
		}
		return best;
	}
	// the nearest levee top (for a look from one)
	function leveeNear(x, z) {
		let best = null, bd = 1e18;
		for (const L of leveeSeg.values()) for (const [ax, az, bx, bz, top] of L) {
			const d = Math.hypot((ax + bx) / 2 - x, (az + bz) / 2 - z);
			if (d < bd) { bd = d; best = { x: (ax + bx) / 2, z: (az + bz) / 2, y: top, yaw: Math.atan2(bx - ax, bz - az) }; }
		}
		return best;
	}

	// ---------- each frame ----------
	bay.ready?.then(() => { S.ready = bay.loaded(); });
	let tSeason = 0, builder = null;
	function update(dt, t, camera) {
		if (!S.built) {
			if (!S.ready) return;
			// (a piece a frame)
			builder = builder || (function* () { regrade(); yield; buildPonds(); yield; buildLevees(); yield; yield* buildMarsh(); buildPylons(); S.built = true; })();
			builder.next();
			return;
		}
		const c = camera.position, far = Math.hypot(c.x - CX, c.z - CZ) - 16000;
		root.visible = far < 30000 + c.y * 4;
		if (!root.visible) return;
		tSeason -= dt;
		if (tSeason <= 0) {
			tSeason = 5;
			// pickleweed reddens August to November; cordgrass is straw December to March
			const mo = today().getMonth(), red = [0, 0, 0, 0, 0, 0, 0.3, 0.8, 1, 1, 0.7, 0.2][mo], straw = [0.9, 0.8, 0.5, 0.15, 0, 0, 0, 0, 0, 0.15, 0.5, 0.85][mo];
			if (Math.abs(red - uMarsh.value.x) > 0.01 || Math.abs(straw - uMarsh.value.y) > 0.01) { uMarsh.value.set(red, straw); plantAt = null; }
		}
		// the plants round you on the ground, laid again as you go
		const low = c.y - Math.max(0, marshAt(c.x, c.z) ?? 0) < 220;
		for (const k of kinds) k.visible = low;
		if (low && (!plantAt || Math.hypot(c.x - plantAt.x, c.z - plantAt.z) > 35)) { plantAt = { x: c.x, z: c.z }; job = plant(c.x, c.z); }
		if (job && job.next().done) job = null;
	}

	return {
		group: root, update, floor, leveeNear, pondAt,
		info: () => ({ built: S.built, ponds: S.ponds.length, crust: S.ponds.filter((P) => P.crust).length, meshes: root.children.length, plants: S.plants, pylons: S.pylons, visible: root.visible }),
	};
}
