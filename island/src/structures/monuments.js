// The landmarks (bay/landmarks.js: the Ferry Building, City Hall, the Campanile, the stadiums
// and the rest, on the ground bay/footprints.js keeps for them) stand up to what breaks the
// city round them: a shot leaves a pock, a heavy round a chip of the stone knocked out, a
// blast its scorch, and they never come down. Unless the world is ending (a cataclysm,
// structures.cataclysm(true)): then enough of a beating brings one down like any other,
// the stone cut away above a ragged line, its stubs over a mound of rubble, a great cloud.
//
// The marks are drawn by the landmarks' own materials (patched once, the first time one is
// struck): the scorch and chips nearest you as a short list of spheres, the fallen ones as
// boxes cut away. Where a shot meets them is found on a height grid of their geometry, made
// a slice at a time the first time a landmark is near. Kept in this browser: the marks fade
// after eight game hours, a fallen one is put back three hours after the cataclysm.

import * as THREE from 'three';
import { landmarkRects } from '../bay/footprints.js';
import { buildShell, shellMaterial } from './shell.js';
import { POCK } from './marks.js';

const KEY = 'l99.structures.landmarks.v1';
const NM = 24, NC = 4, CELL = 2;
const ckey = (ix, iz) => ix + iz * 100003;

export function createMonuments(ctx) {
	const { scene, debris, sounds, marks, store, isPhone } = ctx;
	const rects = landmarkRects.map((L, i) => ({ ...L, i }));
	let data = {};
	try { const s = localStorage.getItem(KEY); if (s) data = JSON.parse(s) || {}; } catch { /* blocked: start clean */ }
	let dirty = false, saveAt = 0;
	const save = () => { dirty = false; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* full: kept for this visit */ } };
	const recOf = (L) => data[L.i] || (data[L.i] = { hp: 1, t: store.now(), mk: [], cut: 0 });
	// (the rects' frame, as footprints.js tests them)
	const inRect = (L, x, z, m = 0) => { const dx = x - L.x, dz = z - L.z; return Math.abs(L.c * dx - L.s * dz) < L.hw + m && Math.abs(L.s * dx + L.c * dz) < L.hd + m; };
	const rectAt = (x, z, m = 0) => rects.find((L) => Math.abs(x - L.x) < L.r + m && Math.abs(z - L.z) < L.r + m && inRect(L, x, z, m)) || null;

	// ---------- the height grid: the landmarks' tops, 2 m cells, made a slice at a time ----------
	const tops = new Map();
	let scan = null, ready = false;
	function startScan() {
		const G = ctx.landmarks()?.group;
		if (!G || scan) return;
		G.updateMatrixWorld(true);
		const meshes = [];
		G.traverse((m) => { if (m.isMesh && m.geometry?.attributes?.position) meshes.push(m); });
		scan = { meshes, mi: 0, vi: 0, v: new THREE.Vector3() };
	}
	function stepScan(budget) {
		if (!scan || ready) return;
		let n = 0;
		while (n < budget && scan.mi < scan.meshes.length) {
			const m = scan.meshes[scan.mi], p = m.geometry.attributes.position;
			for (; scan.vi < p.count && n < budget; scan.vi++, n++) {
				scan.v.fromBufferAttribute(p, scan.vi).applyMatrix4(m.matrixWorld);
				const L = rectAt(scan.v.x, scan.v.z);
				if (!L) continue;
				const k = ckey(Math.floor(scan.v.x / CELL), Math.floor(scan.v.z / CELL)), t = tops.get(k);
				if (t === undefined || scan.v.y > t) tops.set(k, scan.v.y);
				if (!(L.top > scan.v.y)) L.top = scan.v.y;
			}
			if (scan.vi >= p.count) { scan.mi++; scan.vi = 0; }
		}
		if (scan.mi >= scan.meshes.length) ready = true;
	}
	// where a ray meets a landmark before max: { t, n, L }
	function ray(o, d, max) {
		if (!ready) return null;
		let best = null;
		for (const L of rects) {
			// (the ray's nearest pass by the rect's middle)
			const t0 = Math.max(0, Math.min(max, (L.x - o.x) * d.x + (L.z - o.z) * d.z)), px = o.x + d.x * t0 - L.x, pz = o.z + d.z * t0 - L.z;
			if (px * px + pz * pz > L.r * L.r) continue;
			const cut = cutOf(L), hz = Math.sqrt(Math.max(0, L.r * L.r - px * px - pz * pz)) / Math.max(0.2, Math.hypot(d.x, d.z));
			let prev = null;
			for (let t = Math.max(0, t0 - hz); t < Math.min(max, t0 + hz, best?.t ?? 1e9); t += 0.8) {
				const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, ix = Math.floor(x / CELL), iz = Math.floor(z / CELL), top = tops.get(ckey(ix, iz));
				if (top !== undefined && inRect(L, x, z) && y < Math.min(top, cut) && y > ctx.ground(x, z) - 0.5) {
					// (the face it came through: the cell edge crossed, or the top)
					const n = prev && (prev[0] !== ix || prev[1] !== iz) && prev[2] >= y - 0.3 ? (prev[0] !== ix ? new THREE.Vector3(-Math.sign(d.x), 0, 0) : new THREE.Vector3(0, 0, -Math.sign(d.z))) : new THREE.Vector3(0, 1, 0);
					best = { t, n, L };
					break;
				}
				prev = [ix, iz, top === undefined ? -1e9 : top];
			}
		}
		return best;
	}

	// ---------- the marks on them, and the fallen ones cut away: their materials patched ----------
	const U = {
		uLmMk: { value: Array.from({ length: NM }, () => new THREE.Vector4()) },
		uLmCutA: { value: Array.from({ length: NC }, () => new THREE.Vector4()) },
		uLmCutB: { value: Array.from({ length: NC }, () => new THREE.Vector4()) },
	};
	const patched = new WeakSet();
	const NOISE = 'float lmH(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\nfloat lmN(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(lmH(i), lmH(i + vec3(1,0,0)), f.x), mix(lmH(i + vec3(0,1,0)), lmH(i + vec3(1,1,0)), f.x), f.y), mix(mix(lmH(i + vec3(0,0,1)), lmH(i + vec3(1,0,1)), f.x), mix(lmH(i + vec3(0,1,1)), lmH(i + vec3(1,1,1)), f.x), f.y), f.z); }';
	const CUT = `for (int i = 0; i < ${NC}; i++) { vec4 a = uLmCutA[i], b = uLmCutB[i]; if (b.w < 0.5) continue; vec2 q = vLmW.xz - a.xy; if (abs(a.z * q.x - a.w * q.y) < b.x && abs(a.w * q.x + a.z * q.y) < b.y && vLmW.y > b.z + (lmN(vec3(q.x, vLmW.y - b.z, q.y) * 0.35) - 0.5) * 5.0) discard; }`;
	const VERT = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLmW;').replace('#include <project_vertex>', '#include <project_vertex>\n\t{ vec4 lw = vec4(transformed, 1.0);\n\t#ifdef USE_INSTANCING\n\tlw = instanceMatrix * lw;\n\t#endif\n\tvLmW = (modelMatrix * lw).xyz; }');
	};
	function patch(m) {
		const mats = Array.isArray(m.material) ? m.material : [m.material];
		for (const mt of mats) {
			if (!mt || patched.has(mt) || !mt.isMeshStandardMaterial) continue;
			patched.add(mt);
			const prev = mt.onBeforeCompile, prevKey = mt.customProgramCacheKey.bind(mt), prevSrc = prev ? String(prev) : '';
			mt.onBeforeCompile = (sh, r) => {
				prev?.call(mt, sh, r);
				VERT(sh);
				sh.fragmentShader = sh.fragmentShader
					.replace('#include <common>', `#include <common>\nvarying vec3 vLmW; uniform vec4 uLmMk[${NM}]; uniform vec4 uLmCutA[${NC}]; uniform vec4 uLmCutB[${NC}];\n${NOISE}`)
					.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n\t${CUT}`)
					.replace('#include <color_fragment>', `#include <color_fragment>
	for (int i = 0; i < ${NM}; i++) {
		vec4 m = uLmMk[i];
		if (m.w == 0.0) continue;
		float r = abs(m.w), d = distance(vLmW, m.xyz) / r;
		if (d > 1.0) continue;
		vec3 q = vLmW - m.xyz;          // (near the mark: the world is too far out for the noise)
		float n2 = lmN(q * 7.0 + 3.0);
		if (m.w > 0.0) {
			// a scorch: soot thick at its heart, thinning out to a ragged edge
			float n1 = lmN(q * 0.8 + 5.0);          // (a soft, broad edge: fine noise reads as squares at a distance)
			float k = 1.0 - smoothstep(0.15, 1.0, d + (n1 - 0.5) * 0.45);
			diffuseColor.rgb *= 1.0 - 0.85 * k * k;
		} else {
			// a chip: the stone knocked out, paler and rough inside, dark at the very heart
			float k = 1.0 - smoothstep(0.5, 0.8, d + (n2 - 0.5) * 0.45);
			diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.53, 0.5) * (0.65 + 0.5 * n2), k);
			diffuseColor.rgb *= 1.0 - 0.7 * (1.0 - smoothstep(0.0, 0.3, d));
			diffuseColor.rgb *= 1.0 - 0.35 * (1.0 - smoothstep(0.7, 1.0, d)) * smoothstep(0.55, 0.75, d);
		}
	}`);
			};
			mt.customProgramCacheKey = () => prevKey() + prevSrc + ':lm';
			mt.needsUpdate = true;
		}
		// (its shadow cut away with it)
		if (!m.customDepthMaterial && m.castShadow) {
			const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
			dm.onBeforeCompile = (sh) => { VERT(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vLmW; uniform vec4 uLmCutA[${NC}]; uniform vec4 uLmCutB[${NC}];\n${NOISE}`).replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n\t${CUT}`); };
			m.customDepthMaterial = dm;
		}
	}
	let patchedAll = false;
	function patchAll() {
		const G = ctx.landmarks()?.group;
		if (!G) return;
		G.traverse((m) => { if (m.isMesh) patch(m); });
		patchedAll = true;
	}

	// ---------- struck ----------
	const cutOf = (L) => { const r = data[L.i]; return r?.cut ? r.cut : 1e9; };
	// a shot, a heavy round or a blast on landmark L at p (world), its damage and kind, the
	// face's normal n: marked, a little weaker; in a cataclysm, brought down at the last
	function strike(L, p, dir, dmg, type, n = null) {
		if (!patchedAll) patchAll();
		const rec = recOf(L), heavy = type === 'blast' || dmg >= 40, nn = n || { x: -dir.x, y: 0, z: -dir.z };
		const wild = !!ctx.cataclysm?.();
		if (!heavy) { marks?.add(POCK, p, nn, 0.16 + Math.random() * 0.05, 'L' + L.i); return rec; }
		const r = type === 'blast' ? Math.min(6, 1.2 + dmg / 55) : 0.3 + dmg / 220;
		rec.mk.push([+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +(type === 'blast' ? r : -r).toFixed(2)]);
		if (rec.mk.length > 32) rec.mk.shift();
		rec.t = store.now();
		// (stone that has stood a century: a twentieth of what a block of flats would take, but
		// with the world ending, all of it)
		const area = Math.max(400, L.hw * L.hd * 4);
		rec.hp = Math.max(0, rec.hp - (type === 'blast' ? dmg * r * r : dmg) / area * (wild ? 0.9 : 0.05));
		if (!wild) rec.hp = Math.max(0.5, rec.hp);
		dirty = true; saveAt = 3;
		// grit and dust off the stone
		const col = [0.62, 0.6, 0.56];
		for (let i = 0, k = type === 'blast' ? (isPhone ? 5 : 12) : 2; i < k; i++) {
			const s = type === 'blast' ? 0.15 + Math.random() * 0.5 : 0.06 + Math.random() * 0.12;
			debris.chunk(p.x + nn.x * 0.3, p.y, p.z + nn.z * 0.3, nn.x * (2 + Math.random() * 4) + (Math.random() - 0.5) * 3, 1 + Math.random() * 3, nn.z * (2 + Math.random() * 4) + (Math.random() - 0.5) * 3, [s, s * 0.7, s], col);
		}
		debris.puff(p.x + nn.x * 0.5, p.y, p.z + nn.z * 0.5, type === 'blast' ? 12 : 3, r * 0.5, 0.4 + r * 0.25);
		if (type === 'blast') sounds.crumble(p, Math.min(2, r * 0.5));
		if (wild && rec.hp < 0.2 && !rec.cut) bringDown(L, rec);
		pick(true);
		return rec;
	}
	// a blast at p of radius r: the landmarks it reaches
	function blast(p, r, dmg) {
		if (dmg * r < 25 || !ready) return 0;
		let n = 0;
		for (const L of rects) {
			if (Math.hypot(L.x - p.x, L.z - p.z) > L.r + r) continue;
			// (the nearest point of its ground, at the blast's height or its top)
			const dx = p.x - L.x, dz = p.z - L.z, lx = Math.max(-L.hw, Math.min(L.hw, L.c * dx - L.s * dz)), lz = Math.max(-L.hd, Math.min(L.hd, L.s * dx + L.c * dz));
			let wx = L.x + L.c * lx + L.s * lz, wz = L.z - L.s * lx + L.c * lz, top = tops.get(ckey(Math.floor(wx / CELL), Math.floor(wz / CELL)));
			// (its ground is a little wider than it: the nearest of it that stands, within a few metres)
			for (let k = 1; top === undefined && k <= 4; k++) for (let a = 0; a < 8 && top === undefined; a++) {
				const qx = wx + Math.cos(a * Math.PI / 4) * k * CELL, qz = wz + Math.sin(a * Math.PI / 4) * k * CELL, t = tops.get(ckey(Math.floor(qx / CELL), Math.floor(qz / CELL)));
				if (t !== undefined) { top = t; wx = qx; wz = qz; }
			}
			if (top === undefined) continue;
			const y = Math.min(top - 0.3, Math.max(ctx.ground(wx, wz) + 0.5, p.y)), d = Math.hypot(wx - p.x, y - p.y, wz - p.z);
			if (d > r) continue;
			strike(L, { x: wx, y, z: wz }, { x: wx - p.x, y: 0, z: wz - p.z }, dmg * (1 - d / r * 0.6), 'blast', { x: p.x - wx, y: 0, z: p.z - wz });
			n++;
		}
		return n;
	}
	// down (in a cataclysm only): cut away above a ragged line, the rubble heaped, the cloud
	const fallen = new Map();          // i -> mesh
	const shellMat = shellMaterial();
	function bringDown(L, rec) {
		const g = ctx.ground(L.x, L.z), top = Math.max(g + 8, L.top ?? g + 20);
		rec.cut = +(g + 2.5 + Math.random() * 3.5).toFixed(1);          // (down to stubs, as any building brought all down)
		rec.down = store.now();
		dirty = true; saveAt = 1;
		const R = Math.max(L.hw, L.hd), lost = top - rec.cut;
		for (let i = 0; i < (isPhone ? 8 : 18); i++) {
			const a = Math.random() * 6.28, rr = Math.random() * R * 0.8, s = 0.8 + Math.random() * 3.2;
			debris.chunk(L.x + Math.cos(a) * rr, rec.cut + Math.random() * lost * 0.6, L.z + Math.sin(a) * rr, (Math.random() - 0.5) * 4, -1, (Math.random() - 0.5) * 4, [s, s * 0.35, s * 0.8], [0.62, 0.6, 0.56]);
		}
		debris.puff(L.x, g + 1, L.z, isPhone ? 50 : 120, R * 0.6, 3, 0.72, { life: 30 });
		debris.puff(L.x, g + 0.4, L.z, isPhone ? 30 : 80, R * 0.6, 3.2, 0.7, { roll: 7, life: 40 });
		debris.haze(L.x, g + 2, L.z, R * 0.6, 120);
		sounds.collapse({ x: L.x, y: g, z: L.z }, 2);
		ctx.shake?.(0.8);
		show(L, rec);
		pick(true);
	}
	// its stubs and mound: a shell over its ground (shell.js), as of a building brought all down
	function show(L, rec) {
		if (fallen.has(L.i)) return;
		const g = ctx.ground(L.x, L.z), o = { x: L.x, z: L.z, w: L.hw * 1.7, d: L.hd * 1.7, a: Math.atan2(-L.s, L.c), y: g - 1.2, h: Math.min(40, Math.max(8, (L.top ?? g + 20) - g)) + 1.2, kind: 3, col: [0.78, 0.75, 0.68] };
		const B = buildShell(o, { s: L.i * 97 + 13, c: 0.93, m: [], hp: 0 }, null, { lite: isPhone });
		const m = new THREE.Mesh(B.geo, shellMat);
		m.position.set(o.x, g, o.z); m.rotation.y = -o.a; m.castShadow = m.receiveShadow = true;
		scene.add(m);
		fallen.set(L.i, m);
	}
	function putBack(i) {
		const m = fallen.get(i);
		if (m) { scene.remove(m); m.geometry.dispose(); fallen.delete(i); }
	}
	// the uniforms: the marks nearest you, the fallen ones near
	let pickAt = 0, camX = 0, camZ = 0;
	function pick(force = false) {
		if (!force && Math.hypot(ctx.camera.position.x - camX, ctx.camera.position.z - camZ) < 20) return;
		camX = ctx.camera.position.x; camZ = ctx.camera.position.z;
		const all = [];
		for (const k in data) for (const m of data[k].mk) all.push(m);
		all.sort((a, b) => Math.hypot(a[0] - camX, a[2] - camZ) - Math.hypot(b[0] - camX, b[2] - camZ));
		for (let i = 0; i < NM; i++) { const m = all[i]; U.uLmMk.value[i].set(m ? m[0] : 0, m ? m[1] : 0, m ? m[2] : 0, m ? m[3] : 0); }
		const cuts = rects.filter((L) => data[L.i]?.cut).sort((a, b) => Math.hypot(a.x - camX, a.z - camZ) - Math.hypot(b.x - camX, b.z - camZ));
		for (let i = 0; i < NC; i++) {
			const L = cuts[i];
			U.uLmCutA.value[i].set(L ? L.x : 0, L ? L.z : 0, L ? L.c : 1, L ? L.s : 0);
			U.uLmCutB.value[i].set(L ? L.hw + 1 : 0, L ? L.hd + 1 : 0, L ? data[L.i].cut : 0, L ? 1 : 0);
		}
	}
	function update(dt) {
		const lm = ctx.landmarks();
		if (!lm) return;
		const c = ctx.camera.position;
		// (the grid is made once a landmark is within a kilometre)
		if (!scan && rects.some((L) => Math.hypot(L.x - c.x, L.z - c.z) < 1000)) startScan();
		stepScan(isPhone ? 20000 : 60000);
		if (!patchedAll && Object.keys(data).length) patchAll();
		// marks fade after eight game hours; a fallen one is put back three hours after the end
		pickAt -= dt;
		if (pickAt <= 0) {
			pickAt = 1;
			const now = store.now(), wild = !!ctx.cataclysm?.();
			for (const k in data) {
				const r = data[k];
				if (r.cut && !wild) { r.calm = r.calm ?? now; if (now - r.calm > 3) { r.cut = 0; r.hp = 1; r.mk = []; putBack(+k); dirty = true; } }
				else if (r.cut) r.calm = null;
				if (!r.cut && now - r.t > 8 && !wild) { delete data[k]; marks?.clear('L' + k); dirty = true; }
			}
			for (const L of rects) if (data[L.i]?.cut && !fallen.has(L.i) && Math.hypot(L.x - c.x, L.z - c.z) < 600) show(L, data[L.i]);
			pick(dirty);
		}
		if (dirty && (saveAt -= dt) <= 0) save();
	}
	const info = () => ({ ready, cells: tops.size, struck: Object.keys(data).length, fallen: fallen.size, marks: Object.values(data).reduce((a, r) => a + r.mk.length, 0) });
	const state = (x, z) => { const L = rectAt(x, z, 4); return L ? { i: L.i, top: L.top ? +L.top.toFixed(1) : null, ...(data[L.i] || { hp: 1, mk: [], cut: 0 }) } : null; };
	return { ray, strike, blast, update, info, rectAt, state, ready: () => ready };
}
