// The edgelands: the in-between places, round you as you go. Dirt and gravel tracks worn
// into the land (fire roads, farm roads, levee tracks, pull-outs, paths across the lots),
// the industrial fringe (yards, fences, containers, tags, litter in drifts), the soft edge
// where town meets open ground, and the odd small camp with its people (edgecamp.js).
// edgeplan.js decides what goes where, tile by tile; this streams the tiles round you, a
// few milliseconds a frame, and draws them: the ground's ribbons and patches draped on the
// terrain with their own shader, the fences, the tags, and every loose thing instanced from
// one pool per kind (edgekit.js), repacked when the tiles change.

import * as THREE from 'three';
import { makeKit, chainTex, slatTex, wireTex, bladeTex, tagAtlas } from './edgekit.js';
import { planTile, createRoadCells, TILE } from './edgeplan.js';
import { createCamps } from './edgecamp.js';
import { REAL_U } from './realcity.js';

const NOISE = /* glsl */`
float eHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float eNoise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
	return mix(mix(eHash(i), eHash(i + vec2(1.0, 0.0)), u.x), mix(eHash(i + vec2(0.0, 1.0)), eHash(i + vec2(1.0, 1.0)), u.x), u.y); }
// the cracks of old asphalt: the edges of a cellular pattern
float eCrack(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
	for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)), o = vec2(eHash(i + g), eHash(i + g + 17.0)); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
	return d2 - d1; }
`;

export function createEdgelands(scene, { bay, real, city, world, shared, isPhone = false }) {
	const group = new THREE.Group();
	group.name = 'edgelands';
	scene.add(group);
	const W = () => world();
	const H = (x, z) => W()?.island?.heightAt(x, z) ?? bay.heightAt(x, z);
	const wet = (x, z) => bay.heightAt(x, z) < 0.3 || W()?.island?.waterAt?.(x, z) != null || !!W()?.water?.inWater?.(x, z);
	const C = { bay, real, city, H, wet, water: () => W()?.water, parks: () => W()?.parks, beaches: () => W()?.beaches, boardwalk: () => W()?.boardwalk };
	const roads = createRoadCells(C);
	const RANGE = isPhone ? 430 : 620, DROP = RANGE + 260, BUDGET = isPhone ? 3 : 4;

	// ---------- materials ----------
	const uSeason = REAL_U.uSeason, uWet = shared.uWet || { value: 0 }, uTime = shared.uTime || { value: 0 }, uWind = shared.uWind || { value: 0.5 };
	const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 });
	const softMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
	const wireMat = new THREE.MeshStandardMaterial({ map: wireTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 });
	const tuftMat = new THREE.MeshStandardMaterial({ map: bladeTex(), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95 });
	tuftMat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, { uSeason, uTime, uWind });
		sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			#ifdef USE_INSTANCING
			{ vec2 at = instanceMatrix[3].xz; float k = uv.y * uv.y * (0.04 + uWind * 0.08); transformed.x += sin(uTime * 1.7 + at.x * 0.4 + at.y * 0.3) * k; transformed.z += sin(uTime * 1.3 + at.y * 0.5) * k * 0.6; }
			#endif`);
		sh.fragmentShader = 'uniform float uSeason;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
			#if defined( USE_INSTANCING_COLOR ) || defined( USE_COLOR )
			{ float dry = clamp(vColor.r + uSeason * 0.65, 0.0, 1.0);
			  vec3 g = mix(vec3(0.26, 0.4, 0.13), vec3(0.7, 0.6, 0.36), dry) * vColor.g;
			  diffuseColor.rgb *= g * (0.5 + 0.6 * vUv.y); }
			#endif`);
	};
	tuftMat.customProgramCacheKey = () => 'edgetuft';
	const fenceMat = new THREE.MeshStandardMaterial({ map: chainTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.45 });
	const slatMat = new THREE.MeshStandardMaterial({ map: slatTex(), vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 });
	const tagMat = new THREE.MeshStandardMaterial({ map: tagAtlas(), vertexColors: true, alphaTest: 0.3, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
	const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
	// the ground: tracks, paths, shoulders, ballast, ditches, old asphalt, dry lots
	const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
	groundMat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, { uSeason, uWet });
		sh.vertexShader = 'attribute vec4 aG; attribute vec2 aE; varying vec4 vG; varying vec2 vE; varying vec2 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvG = aG; vE = aE; vWp = (modelMatrix * vec4(position, 1.0)).xz;');
		sh.fragmentShader = 'uniform float uSeason, uWet; varying vec4 vG; varying vec2 vE; varying vec2 vWp; float eRough = 0.95;\n' + NOISE + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float kind = vG.z, u = vG.x, along = vG.y;
				float n1 = eNoise(vWp * 0.9), n2 = eNoise(vWp * 3.3), n3 = eNoise(vWp * 0.21), n4 = eNoise(vWp * 17.0);
				// a ragged edge, eaten into by the grass
				float rag = n1 * 0.7 + n2 * 0.45, e = min(vE.x, vE.y), ew = kind > 1.5 && kind < 2.5 ? 0.22 : kind > 5.5 ? 2.2 : 0.75;
				if (e < rag * ew - 0.04) discard;
				vec3 grass = mix(vec3(0.3, 0.4, 0.16), vec3(0.64, 0.55, 0.33), uSeason) * (0.8 + 0.35 * n2);
				vec3 dust = mix(vec3(0.46, 0.38, 0.29), vec3(0.58, 0.48, 0.36), n3) * (0.8 + 0.3 * n2) * (0.9 + 0.15 * n4);
				vec3 c = dust; float rut = 0.0, pud = 0.0;
				if (kind < 0.5) {
					// two wheel ruts, grass down the crown between them and at the sides
					rut = exp(-pow((abs(u - 0.5) - 0.22) / 0.075, 2.0));
					float streak = eNoise(vec2(u * 60.0, along * 0.25));
					c = mix(c, c * (0.8 + 0.1 * streak), rut);
					float med = (1.0 - smoothstep(0.05, 0.13, abs(u - 0.5))) * smoothstep(0.3, 0.62, n2 + n1 * 0.35);
					float side = smoothstep(0.36, 0.48, abs(u - 0.5)) * smoothstep(0.25, 0.6, n2);
					c = mix(c, grass, clamp(med + side, 0.0, 1.0));
				} else if (kind < 1.5) {
					// gravel: a speckle of stones, the wheel paths a little darker
					rut = exp(-pow((abs(u - 0.5) - 0.2) / 0.1, 2.0)) * 0.5;
					c = mix(vec3(0.55, 0.52, 0.47), vec3(0.64, 0.6, 0.54), n3) * (0.8 + 0.4 * step(0.55, n4)) * (0.9 + 0.1 * n2);
					c *= 1.0 - rut * 0.12;
					c = mix(c, grass, smoothstep(0.62, 0.85, n1 * 0.7 + n2 * 0.5) * 0.7);
				} else if (kind < 2.5) {
					// a path worn by feet: packed and darker down the middle
					c = dust * (0.86 - 0.08 * (1.0 - abs(u - 0.5) * 2.0));
					rut = 0.5;
				} else if (kind < 3.5) {
					// bare dirt and weeds: a shoulder, a verge, the dust under an overpass
					c = mix(dust * 0.93, grass * 0.9, smoothstep(0.42, 0.75, n1 * 0.8 + n2 * 0.4) * 0.8);
				} else if (kind < 4.5) {
					// ballast and the ties across it, rust from the rails
					c = mix(vec3(0.4, 0.38, 0.36), vec3(0.52, 0.5, 0.47), n4) * (0.85 + 0.25 * n2);
					float tie = step(fract(along / 0.62), 0.36) * step(abs(u - 0.5), 0.34);
					c = mix(c, vec3(0.27, 0.22, 0.18) * (0.8 + 0.3 * n2), tie);
					c = mix(c, vec3(0.4, 0.24, 0.14), exp(-pow((abs(u - 0.5) - 0.2) / 0.03, 2.0)) * 0.6);
					c = mix(c, grass, smoothstep(0.4, 0.5, abs(u - 0.5)) * smoothstep(0.4, 0.7, n2) * 0.8);
				} else if (kind < 5.5) {
					// a ditch: damp dark banks, a thread of water down the bottom, reeds
					float mid = 1.0 - smoothstep(0.05, 0.14, abs(u - 0.5));
					c = mix(vec3(0.3, 0.27, 0.2), grass * 0.8, smoothstep(0.2, 0.45, abs(u - 0.5)) * 0.8) * (0.8 + 0.3 * n2);
					pud = mid * smoothstep(0.3, 0.55, n1 + uWet * 0.5);
				} else if (kind < 6.5) {
					// old asphalt, cracked, weeds up the cracks, oil stains, a dirt drift at the edges
					c = vec3(0.34, 0.34, 0.35) * (0.82 + 0.3 * n3) * (0.94 + 0.1 * n4);
					float cr = 1.0 - smoothstep(0.02, 0.06, eCrack(vWp * 0.45));
					float cr2 = 1.0 - smoothstep(0.015, 0.04, eCrack(vWp * 1.3 + 7.0));
					c = mix(c, vec3(0.16, 0.16, 0.16), max(cr, cr2 * 0.6));
					c = mix(c, grass * 0.85, cr * smoothstep(0.35, 0.6, n2));
					c *= 1.0 - smoothstep(0.7, 0.9, eNoise(vWp * 0.5 + 3.0)) * 0.35;
					c = mix(c, dust, (1.0 - smoothstep(1.0, 4.0, e)) * 0.7);
					eRough = 0.85;
				} else {
					// a lot gone to dry grass, bare dirt showing through
					vec3 straw = mix(vec3(0.42, 0.4, 0.2), vec3(0.56, 0.47, 0.28), uSeason) * (0.7 + 0.45 * n2) * (0.85 + 0.25 * n4);
					c = mix(straw, dust * 0.8, smoothstep(0.55, 0.8, n1 * 0.7 + n3 * 0.5));
					c = mix(c, straw * 0.6, smoothstep(0.6, 0.85, eNoise(vWp * 0.35 + 9.0)) * 0.6);
				}
				// puddles in the low spots of the ruts, after rain the more
				if (kind < 2.5) pud = rut * smoothstep(0.35, 0.62, vG.w * (0.45 + 0.9 * n1) + uWet * 0.4);
				c = mix(c, c * 0.72, smoothstep(0.0, 0.3, pud) * (1.0 - smoothstep(0.3, 0.6, pud)));
				c = mix(c, vec3(0.1, 0.11, 0.12), smoothstep(0.45, 0.6, pud));
				eRough = mix(eRough, 0.06, smoothstep(0.45, 0.6, pud));
				// the damp after rain
				c *= 1.0 - uWet * 0.25;
				diffuseColor.rgb = c;
			}`)
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = eRough;');
	};
	groundMat.customProgramCacheKey = () => 'edgeground';

	// ---------- the pools: one instanced mesh per kind of thing ----------
	const KIT = makeKit(), pools = {};
	const MAT = { soft: softMat, wire: wireMat, tuft: tuftMat };
	for (const [k, K] of Object.entries(KIT)) {
		const max = Math.ceil(K.max * (isPhone ? 0.6 : 1));
		const m = new THREE.InstancedMesh(K.geo, MAT[K.mat] || propMat, max);
		m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
		m.count = 0; m.frustumCulled = false; m.castShadow = !!K.shadow; m.receiveShadow = k !== 'weed';
		m.name = 'edge-' + k;
		group.add(m);
		pools[k] = { m, max };
	}

	// ---------- a tile's meshes ----------
	const tiles = new Map();
	const key = (i, j) => i + ',' + j;
	const lengths = new WeakMap();
	function along(p) {
		let s = lengths.get(p);
		if (s) return s;
		s = new Float32Array(p.length / 2);
		for (let i = 1; i < s.length; i++) s[i] = s[i - 1] + Math.hypot(p[i * 2] - p[i * 2 - 2], p[i * 2 + 1] - p[i * 2 - 1]);
		lengths.set(p, s);
		return s;
	}
	function* buildTile(T) {
		const P = T.plan, x0 = T.i * TILE, z0 = T.j * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
		const own = (ax, az, bx, bz) => { const mx = (ax + bx) / 2, mz = (az + bz) / 2; return mx >= x0 && mx < x1 && mz >= z0 && mz < z1; };
		// the ground: ribbons (cut to this tile by their segments) and patches
		const G = { P: [], A: [], E: [], I: [] };
		const vert = (x, y, z, u, s, kind, low, e0, e1) => { G.P.push(x, y, z); G.A.push(u, s, kind, low); G.E.push(e0, e1); return G.P.length / 3 - 1; };
		const lift = (id) => 0.06 + ((id.length * 7 + id.charCodeAt(id.length - 1)) % 5) * 0.006;
		let n = 0;
		for (const R of [...P.ground, ...P.rails.map((q) => ({ id: q.id, pts: q.pts, w: 3.4, kind: 4 }))]) {
			{ const kk = R.id.startsWith('rr') ? 'rr' : R.id[0]; T.kinds[kk] = (T.kinds[kk] || 0) + 1; }
			const p = R.pts, S = along(p), Ltot = S[S.length - 1], hw = R.w / 2, ACROSS = R.w > 3 ? [-1, -0.5, 0, 0.5, 1] : [-1, 0, 1], yo = lift(R.id);
			let run = null;
			const flush = () => {
				if (!run || run.length < 2) { run = null; return; }
				const base = G.P.length / 3, na = ACROSS.length;
				for (const i of run) {
					const a = Math.max(0, i - 1), b = Math.min(S.length - 1, i + 1), dx = p[b * 2] - p[a * 2], dz = p[b * 2 + 1] - p[a * 2 + 1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
					const x = p[i * 2], z = p[i * 2 + 1], h = H(x, z);
					let low = 0;
					if (R.puddles) { const k0 = Math.max(0, i - 3), k1 = Math.min(S.length - 1, i + 3); low = Math.max(0, Math.min(1, ((H(p[k0 * 2], p[k0 * 2 + 1]) + H(p[k1 * 2], p[k1 * 2 + 1])) / 2 - h) * 5 + 0.15)); }
					const endD = R.kind === 4 ? 99 : Math.min(S[i], Ltot - S[i]) + 0.3;
					for (const t of ACROSS) { const px = x + nx * hw * t, pz = z + nz * hw * t; vert(px, Math.max(H(px, pz), h - 0.3) + yo, pz, (t + 1) / 2, S[i], R.kind, low, (1 - Math.abs(t)) * hw + 0.05, endD); }
				}
				for (let k = 0; k + 1 < run.length; k++) for (let q = 0; q + 1 < na; q++) { const a = base + k * na + q, b = a + na; G.I.push(a, b, a + 1, a + 1, b, b + 1); }
				run = null;
			};
			for (let i = 0; i + 1 < S.length; i++) {
				if (own(p[i * 2], p[i * 2 + 1], p[i * 2 + 2], p[i * 2 + 3])) { if (!run) run = [i]; run.push(i + 1); } else flush();
			}
			flush();
			if (++n % 6 === 0) yield;
		}
		for (const D of P.decals) {
			const nx = Math.max(2, Math.ceil(D.w / 4)), nz = Math.max(2, Math.ceil(D.d / 4)), ca = Math.cos(D.a), sa = Math.sin(D.a), base = G.P.length / 3;
			for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
				const lx = (i / nx - 0.5) * D.w, lz = (j / nz - 0.5) * D.d, x = D.x + ca * lx - sa * lz, z = D.z + sa * lx + ca * lz;
				vert(x, H(x, z) + 0.05, z, i / nx, lz, D.kind, 0, Math.min(D.w / 2 - Math.abs(lx), D.d / 2 - Math.abs(lz)) + 0.05, 99);
			}
			for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + nx + 1; G.I.push(a, b, a + 1, a + 1, b, b + 1); }
		}
		yield;
		if (G.I.length) {
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3));
			g.setAttribute('aG', new THREE.Float32BufferAttribute(G.A, 4));
			g.setAttribute('aE', new THREE.Float32BufferAttribute(G.E, 2));
			g.setIndex(G.I);
			g.computeVertexNormals();
			const m = new THREE.Mesh(g, groundMat);
			m.receiveShadow = true; m.renderOrder = -1; m.frustumCulled = true;
			g.computeBoundingSphere();
			T.meshes.push(m);
		}
		// the fences: chain link, slats, the top rail and posts; wire strands; the rails
		const F = { P: [], U: [] }, SL = { P: [], U: [], C: [] }, SO = { P: [], C: [] };
		const props = T.props;
		const post = (x, z, y, h, r = 0.03, col = [0.58, 0.59, 0.6]) => { const L = props.post || (props.post = []); L.push(x, y - 0.1, z, 0, 0, 0, r, h + 0.1, r, col[0], col[1], col[2]); };
		// a thin square tube from a to b, into the solid mesh
		const tube = (ax, ay, az, bx, by, bz, r, col) => {
			const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * r, nz = dx / L * r, cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
			for (let k = 0; k < 4; k++) {
				const [s0, t0] = cs[k], [s1, t1] = cs[(k + 1) % 4];
				SO.P.push(ax + nx * s0, ay + r * t0, az + nz * s0, bx + nx * s0, by + r * t0, bz + nz * s0, bx + nx * s1, by + r * t1, bz + nz * s1, ax + nx * s0, ay + r * t0, az + nz * s0, bx + nx * s1, by + r * t1, bz + nz * s1, ax + nx * s1, ay + r * t1, az + nz * s1);
				for (let v = 0; v < 6; v++) SO.C.push(col[0], col[1], col[2]);
			}
		};
		const SLAT = [[0.2, 0.34, 0.22], [0.86, 0.86, 0.84], [0.4, 0.3, 0.22]];
		for (const f of P.fences) {
			const p = f.pts, slat = f.slats ? SLAT[f.slats - 1] : null;
			let u = 0;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], bx = p[i + 2], bz = p[i + 3];
				if (!own(ax, az, bx, bz)) { u += Math.hypot(bx - ax, bz - az); continue; }
				const ya = H(ax, az), yb = H(bx, bz), L = Math.hypot(bx - ax, bz - az), du = L / 0.8;
				F.P.push(ax, ya + 0.04, az, bx, yb + 0.04, bz, bx, yb + f.h, bz, ax, ya + 0.04, az, bx, yb + f.h, bz, ax, ya + f.h, az);
				F.U.push(u / 0.8, 0, u / 0.8 + du, 0, u / 0.8 + du, f.h / 0.8, u / 0.8, 0, u / 0.8 + du, f.h / 0.8, u / 0.8, f.h / 0.8);
				if (slat) {
					const us = u / 2.4, du2 = L / 2.4, o = 0.02, nx = -(bz - az) / L * o, nz = (bx - ax) / L * o;
					SL.P.push(ax + nx, ya + 0.08, az + nz, bx + nx, yb + 0.08, bz + nz, bx + nx, yb + f.h - 0.05, bz + nz, ax + nx, ya + 0.08, az + nz, bx + nx, yb + f.h - 0.05, bz + nz, ax + nx, ya + f.h - 0.05, az + nz);
					SL.U.push(us, 0, us + du2, 0, us + du2, 1, us, 0, us + du2, 1, us, 1);
					for (let v = 0; v < 6; v++) SL.C.push(slat[0], slat[1], slat[2]);
				}
				tube(ax, ya + f.h, az, bx, yb + f.h, bz, 0.022, [0.6, 0.61, 0.62]);
				if (f.barbed) for (const k of [0.14, 0.26, 0.38]) tube(ax, ya + f.h + k, az, bx, yb + f.h + k, bz, 0.004, [0.45, 0.45, 0.45]);
				if (Math.floor(u / 3) !== Math.floor((u + L) / 3) || i === 0) post(ax, az, ya, f.h + (f.barbed ? 0.42 : 0.05), 0.032);
				u += L;
			}
			const n2 = p.length - 2;
			if (own(p[n2 - 2], p[n2 - 1], p[n2], p[n2 + 1])) post(p[n2], p[n2 + 1], H(p[n2], p[n2 + 1]), f.h + 0.05, 0.04);
		}
		// the farm fences' three wires
		for (const Ln of P.lines) {
			const p = Ln.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				if (!own(p[i], p[i + 1], p[i + 2], p[i + 3])) continue;
				const ya = H(p[i], p[i + 1]), yb = H(p[i + 2], p[i + 3]);
				for (const k of [0.45, 0.75, 1.05]) tube(p[i], ya + k, p[i + 1], p[i + 2], yb + k, p[i + 3], 0.005, [0.4, 0.38, 0.36]);
			}
		}
		// the rails: two steel lines on the ties, the standard gauge apart
		for (const R of P.rails) {
			const p = R.pts;
			for (let i = 0; i + 3 < p.length; i += 2) {
				if (!own(p[i], p[i + 1], p[i + 2], p[i + 3])) continue;
				const L = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) || 1, nx = -(p[i + 3] - p[i + 1]) / L, nz = (p[i + 2] - p[i]) / L;
				for (const s of [-0.7175, 0.7175]) {
					const ax = p[i] + nx * s, az = p[i + 1] + nz * s, bx = p[i + 2] + nx * s, bz = p[i + 3] + nz * s;
					tube(ax, H(ax, az) + 0.14, az, bx, H(bx, bz) + 0.14, bz, 0.04, [0.36, 0.26, 0.2]);
					tube(ax, H(ax, az) + 0.19, az, bx, H(bx, bz) + 0.19, bz, 0.022, [0.62, 0.6, 0.58]);
				}
			}
		}
		yield;
		const mk = (P2, attrs, mat, shadow) => {
			if (!P2.length) return;
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
			for (const [k, v, s] of attrs) g.setAttribute(k, new THREE.Float32BufferAttribute(v, s));
			g.computeVertexNormals(); g.computeBoundingSphere();
			const m = new THREE.Mesh(g, mat);
			m.castShadow = shadow; m.receiveShadow = true;
			T.meshes.push(m);
		};
		mk(F.P, [['uv', F.U, 2]], fenceMat, false);
		mk(SL.P, [['uv', SL.U, 2], ['color', SL.C, 3]], slatMat, true);
		mk(SO.P, [['color', SO.C, 3]], solidMat, false);
		// the tags: one quad each, cut from the atlas
		if (P.tags.length) {
			const TP = [], TU = [], TC = [];
			for (const t of P.tags) {
				const ca = Math.cos(t.yaw), sa = Math.sin(t.yaw), ux = ca * t.w / 2, uz = -sa * t.w / 2;
				const u0 = (t.t % 4) / 4, v0 = Math.floor(t.t / 4) / 2, u1 = u0 + 0.25, v1 = v0 + 0.5, k = 0.8 + ((t.x * 7.3) % 1 + 1) % 1 * 0.25;
				const A = [t.x - ux, t.y, t.z - uz], B = [t.x + ux, t.y, t.z + uz], Cc = [t.x + ux, t.y + t.h, t.z + uz], D = [t.x - ux, t.y + t.h, t.z - uz];
				TP.push(...A, ...B, ...Cc, ...A, ...Cc, ...D);
				TU.push(u0, 1 - v1, u1, 1 - v1, u1, 1 - v0, u0, 1 - v1, u1, 1 - v0, u0, 1 - v0);
				for (let v = 0; v < 6; v++) TC.push(k, k, k);
			}
			mk(TP, [['uv', TU, 2], ['color', TC, 3]], tagMat, false);
		}
		for (const m of T.meshes) group.add(m);
	}
	function dropTile(T) {
		for (const m of T.meshes) { group.remove(m); m.geometry.dispose(); }
		T.meshes = [];
		tiles.delete(T.k);
		camps.drop(T.k);
	}

	// ---------- repacking the pools from the tiles, nearest first ----------
	const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), V = new THREE.Vector3(), S = new THREE.Vector3(), COL = new THREE.Color();
	let dirty = false, sinceRepack = 0;
	function repack(cx, cz) {
		const list = [...tiles.values()].filter((T) => T.state === 'done').sort((a, b) => a.d - b.d);
		const n = {};
		for (const k in pools) n[k] = 0;
		for (const T of list) for (const [k, L] of Object.entries(T.props)) {
			const Pl = pools[k];
			if (!Pl) continue;
			for (let i = 0; i < L.length && n[k] < Pl.max; i += 12) {
				E.set(L[i + 4], L[i + 3], L[i + 5]);
				M4.compose(V.set(L[i], L[i + 1], L[i + 2]), Q.setFromEuler(E), S.set(L[i + 6], L[i + 7], L[i + 8]));
				Pl.m.setMatrixAt(n[k], M4);
				Pl.m.setColorAt(n[k], COL.setRGB(L[i + 9], L[i + 10], L[i + 11]));
				n[k]++;
			}
		}
		for (const k in pools) { const m = pools[k].m; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
		dirty = false; sinceRepack = 0;
		stats.instances = Object.values(n).reduce((a, b) => a + b, 0);
		stats.at = [Math.round(cx), Math.round(cz)];
	}

	// ---------- the stream ----------
	const camps = createCamps(scene, { world, shared, isPhone, H });
	const stats = { tiles: 0, planned: 0, longest: 0, instances: 0, lastMs: 0, at: null, wanted: 1, slowStep: ['', 0] };
	let cur = null, levelsN = -1, visible = true;
	function update(dt, time, camera, night) {
		const x = camera.position.x, z = camera.position.z;
		const on = bay.loaded() && real?.loaded?.() && Math.max(Math.abs(x), Math.abs(z)) > (W()?.island?.half || 0) + 50;
		const agl = camera.position.y - H(x, z);
		visible = on && agl < 900;
		group.visible = visible;
		if (!on) return;
		// finer heights arriving: lay everything again
		const nl = bay.levels.filter(Boolean).length;
		if (nl !== levelsN) { if (levelsN >= 0) { for (const T of [...tiles.values()]) dropTile(T); roads.reset(); cur = null; dirty = true; } levelsN = nl; }
		// the tiles wanted round here
		const want = [];
		const R = agl > 300 ? RANGE * 0.7 : RANGE;
		for (let j = Math.floor((z - R) / TILE); j <= Math.floor((z + R) / TILE); j++) for (let i = Math.floor((x - R) / TILE); i <= Math.floor((x + R) / TILE); i++) {
			const d = Math.hypot(Math.max(0, i * TILE - x, x - (i + 1) * TILE), Math.max(0, j * TILE - z, z - (j + 1) * TILE));
			if (d < R) want.push({ i, j, d });
		}
		want.sort((a, b) => a.d - b.d);
		stats.wanted = want.filter((w) => tiles.get(key(w.i, w.j))?.state !== 'done').length;
		for (const T of [...tiles.values()]) {
			T.d = Math.hypot(Math.max(0, T.i * TILE - x, x - (T.i + 1) * TILE), Math.max(0, T.j * TILE - z, z - (T.j + 1) * TILE));
			if (T.d > DROP) { if (cur === T) cur = null; dropTile(T); dirty = true; }
		}
		// work on the nearest unfinished tile, a few milliseconds
		const t0 = performance.now();
		if (!cur || cur.state === 'done' || !tiles.has(cur.k)) {
			cur = null;
			for (const w of want) {
				const k = key(w.i, w.j);
				let T = tiles.get(k);
				if (!T) tiles.set(k, T = { k, i: w.i, j: w.j, d: w.d, state: 'roads', meshes: [], props: {}, kinds: {} });
				if (T.state !== 'done') { cur = T; break; }
			}
		}
		if (cur) {
			const T = cur, x0 = T.i * TILE, z0 = T.j * TILE;
			while (performance.now() - t0 < BUDGET) {
				if (T.state === 'roads') {
					// (the rivers round here known first, for the levees and the banks; not waited on for ever)
					const Wt = W()?.water;
					T.t0 = T.t0 || performance.now();
					if (Wt?.info && performance.now() - T.t0 < 8000 && !(Wt.ready() && Wt.info().queue === 0)) break;
					const f = roads.near(x0, z0, x0 + TILE, z0 + TILE, BUDGET - (performance.now() - t0));
					if (!f) break;
					T.roads = f; T.state = 'plan'; T.it = planTile(C, T.i, T.j, f);
				} else if (T.state === 'plan') {
					const q0 = performance.now(), s = T.it.next(), q1 = performance.now() - q0;
					if (q1 > stats.slowStep[1]) stats.slowStep = [s.value && typeof s.value === 'string' ? s.value : 'end', +q1.toFixed(1)];
					if (s.done) { T.plan = s.value; T.props = s.value.props; T.state = 'build'; T.it = buildTile(T); stats.planned++; }
				} else if (T.state === 'build') {
					const q0 = performance.now(), s = T.it.next(), q1 = performance.now() - q0;
					if (q1 > stats.slowStep[1]) stats.slowStep = ['build', +q1.toFixed(1)];
					if (s.done) { T.state = 'done'; T.it = null; camps.add(T.k, T.plan.camps); T.plan.ground = T.plan.decals = null; dirty = true; break; }
				}
			}
		}
		const spent = performance.now() - t0;
		stats.lastMs = spent; stats.longest = Math.max(stats.longest, spent);
		sinceRepack += dt;
		if (dirty && (sinceRepack > 0.3 || !cur)) repack(x, z);
		stats.tiles = tiles.size;
		camps.update(dt, time, camera, night, visible && agl < 200);
	}

	// the yard things are solid: containers and dumpsters stand in your way
	const SOLID = { cont20: [3.03, 1.22, 2.6], cont40: [6.1, 1.22, 2.6], dumpster: [1.0, 0.8, 1.6], jersey: [1.5, 0.3, 0.8] };
	function push(p, footY) {
		if (!visible) return;
		for (const [k, [hx, hz, hy]] of Object.entries(SOLID)) {
			const m = pools[k].m, a = m.instanceMatrix.array;
			for (let i = 0; i < m.count; i++) {
				const o = i * 16, tx = a[o + 12], tz = a[o + 14];
				if (Math.abs(tx - p.x) > 8 || Math.abs(tz - p.z) > 8) continue;
				const ty = a[o + 13];
				if (footY > ty + hy - 0.3 || footY < ty - 1.5) continue;
				// in the box's own frame (x along its length)
				const ux = a[o], uz = a[o + 2], ul = Math.hypot(ux, uz) || 1, cx = ux / ul, cz = uz / ul;
				const dx = p.x - tx, dz = p.z - tz, lx = dx * cx + dz * cz, lz = -dx * cz + dz * cx, r = 0.3;
				const ox = hx + r - Math.abs(lx), oz = hz + r - Math.abs(lz);
				if (ox <= 0 || oz <= 0) continue;
				if (ox < oz) { const s = Math.sign(lx) * ox; p.x += cx * s; p.z += cz * s; } else { const s = Math.sign(lz) * oz; p.x += -cz * s; p.z += cx * s; }
			}
		}
	}
	// the top of a container, to stand on
	function floor(x, z, y) {
		if (!visible) return -1e9;
		let best = -1e9;
		for (const k of ['cont20', 'cont40']) {
			const m = pools[k].m, a = m.instanceMatrix.array, hx = k === 'cont40' ? 6.1 : 3.03;
			for (let i = 0; i < m.count; i++) {
				const o = i * 16, tx = a[o + 12], tz = a[o + 14];
				if (Math.abs(tx - x) > 7 || Math.abs(tz - z) > 7) continue;
				const ux = a[o], uz = a[o + 2], ul = Math.hypot(ux, uz) || 1, cx = ux / ul, cz = uz / ul, dx = x - tx, dz = z - tz;
				if (Math.abs(dx * cx + dz * cz) > hx || Math.abs(-dx * cz + dz * cx) > 1.22) continue;
				const top = a[o + 13] + 2.59;
				if (y > top - 1.2 && top > best) best = top;
			}
		}
		return best;
	}

	// for tests: what is where, and a look at it
	function info() {
		const n = {};
		for (const [k, P] of Object.entries(pools)) if (P.m.count) n[k] = P.m.count;
		// ground by kind: f fire road, r farm road, l levee, t mapped track, h shoulder, b bank path, m freeway margin, u under an overpass, p worn path, d ditch, v verge, rr rail
		const g = {};
		for (const T of tiles.values()) for (const [k, v] of Object.entries(T.kinds)) g[k] = (g[k] || 0) + v;
		return { ...stats, longest: +stats.longest.toFixed(1), lastMs: +stats.lastMs.toFixed(1), counts: n, ground: g, camps: camps.info(), pending: [...tiles.values()].filter((T) => T.state !== 'done').length };
	}
	return { group, update, push, floor, info, camps, tiles, flush: (camera, ms = 20000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { update(0, 0, camera, 0); if (!stats.wanted && !cur) break; } update(0, 0, camera, 0); } };
}
