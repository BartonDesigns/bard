// The streets of the towns out past the Bay's map, laid on the ground. In the Bay the ground
// shader paints every street from the road maps round you (bay/realcity.js, bay/terrain.js),
// and the gridded towns' streets from the town map; a few kilometres past the Bay's survey the
// globe's ground takes over (earth/globeterrain.js), and it paints none. So the towns grown out
// there (crysis/civgen.js) and the gridded ones round the Bay's edge (bay/gridstreets.js) were
// driven, parked on and lined with houses, but their streets were never seen: houses standing
// on bare ground. Here each street is drawn as the highways and the lanes are (globeroads.js,
// globelanes.js): a ribbon on the graded ground, vertex by vertex,
//
//   the street     asphalt, its years in patches along it; where it is walked (realcity.js
//                  WALKED) a concrete gutter pan and kerb each side and the sidewalk beyond,
//                  slab by slab; a double yellow line down the collectors and arterials, white
//                  edge lines where there is no kerb; none of it into a junction
//   the freeway    a town's own (civgen.js): pale concrete carriageways, dashed lanes, a solid
//                  white line by the right shoulder and a yellow one by the left
//   the corners    a disc of asphalt at each end (a junction's corners filled, its kerbs
//                  rounded) and a cul-de-sac's turning circle with its sidewalk round it
//   the lots       each house's driveway and front walk, a shop's forecourt
//
// in two layers, the concrete under the asphalt, so where streets cross the asphalt of each
// runs over the sidewalks of the other and the corners come out square. A town is built once,
// a few milliseconds a frame, when it arrives, and let go with it; where the Bay's own ground
// paints a street (painted(x, z)) it is left to it.

import * as THREE from 'three';
import { BERM_U, BERM_GLSL } from '../bay/berms.js';

const STEP = 8;                 // m between a street's stations
const SW = 1.7;                 // a sidewalk's width (realcity.js paints hw + 1.7)
const WALKED = new Set(['secondary', 'tertiary', 'residential', 'unclassified', 'living_street']);
const SKIP = /^(path|track|steps|pedestrian|cycleway|bridleway)$/;
// what runs down the middle: 0 nothing, 1 a double yellow line, 2 that and white edge lines
const LINES = { secondary: 1, tertiary: 1, unclassified: 1, primary: 2, trunk: 2 };
// the kinds of surface (the shader's vSt.y)
const K = { street: 0, sidewalk: 1, concrete: 2, disc: 3, slab: 4, freeway: 5 };

const VERT = /* glsl */`
	attribute vec3 aRoad; attribute vec4 aSt; attribute vec2 aSide;
	uniform float uTSPx;
	varying vec3 vRoad; varying vec4 vSt; varying float vFar; varying vec2 vW;
	${BERM_GLSL}
`;
const FRAG = /* glsl */`
	varying vec3 vRoad; varying vec4 vSt; varying float vFar; varying vec2 vW;
	float tsH(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }      // (wrapped first: sin() of a world-sized number is noise on a GPU)
	// a line of half-width w at d, faded rather than shimmering once it is under a pixel
	float tsLine(float d, float at, float w, float fw) { return (1.0 - smoothstep(w, w + fw, abs(d - at))) * clamp(w * 2.0 / max(fw, 1e-4), 0.0, 1.0); }
`;

export function createTownStreets({ scene, groundAt, isPhone = false, painted = () => false }) {
	const group = new THREE.Group();
	group.name = 'town streets';
	scene.add(group);
	const stats = { sets: 0, verts: 0, buildMs: 0, roads: 0 };
	const U = { uTSPx: { value: 0.0016 } };

	// ---------- the look ----------
	function material(offset) {
		const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -offset, polygonOffsetUnits: -offset * 2 });
		m.onBeforeCompile = (sh) => {
			Object.assign(sh.uniforms, BERM_U, U);
			sh.vertexShader = VERT + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
				vRoad = aRoad; vSt = aSt; vW = position.xz;
				float dist = distance(cameraPosition, position);
				// (far off a street is held to about a pixel and a half wide rather than thinning to
				// nothing and shimmering: uTSPx is a pixel's size per metre away; its sidewalks, drives
				// and walks hardly at all, so from the air a street is its asphalt, not a pale band)
				float hw = max(length(aSide), 0.5), g0 = 0.9 * dist * uTSPx / hw;
				bool paving = abs(aSt.y - 1.0) < 0.5 || abs(aSt.y - 2.0) < 0.5 || abs(aSt.y - 4.0) < 0.5;
				float grow = clamp(g0, 1.0, paving ? 1.4 : 4.0);
				vFar = smoothstep(1.0, 2.5, g0);
				transformed.xz += aSide * (grow - 1.0);
				transformed.y += bermDelta(position.xz) + dist * 4e-4;`);
			sh.fragmentShader = FRAG + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
				{
					float k = vSt.y, W = vSt.x, a = abs(vRoad.x), d = a * W, along = vRoad.y;
					float fw = fwidth(d) * 1.2, fa = fwidth(along);
					// (the grain and the patches by where on the ground, so two streets overlapping in a
					// junction are the same asphalt there and neither shows through the other)
					float n = tsH(floor(vW * 2.5));
					vec3 c;
					// (the markings and slab joints fade as they shrink under a pixel)
					float fine = 1.0 - smoothstep(0.08, 0.3, max(fw, fa));
					float clearJ = step(W + 3.0, min(vRoad.y, vRoad.z)), open = step(W, min(vRoad.y, vRoad.z));
					if (k < 0.5 || (k > 2.5 && k < 3.5)) {
						// asphalt, its years in patches along the street
						c = vec3(0.17, 0.17, 0.18) * (0.88 + 0.22 * n) * (0.9 + 0.18 * tsH(floor(vW / 31.0)));
						// the wheel paths, a little darker and smoother (none across a junction: open, where
						// the crossing street's asphalt runs on through)
						c *= 1.0 - 0.07 * (1.0 - smoothstep(0.4, 0.9, abs(abs(d - W * 0.5) - 0.9))) * step(k, 0.5) * open;
						if (vSt.w > 0.5) {
							// walked: the concrete gutter pan along each kerb, the kerb's shadowed face
							c = mix(c, vec3(0.46, 0.45, 0.42) * (0.92 + 0.12 * n), smoothstep(W - 0.62 - fw, W - 0.58, d) * open);
							c *= 1.0 - 0.35 * smoothstep(W - 0.1 - fw, W - 0.02, d) * open;
						}
						if (k < 0.5) {
							c = mix(c, vec3(0.8, 0.63, 0.17), tsLine(d, 0.16, 0.055, fw) * step(0.5, vSt.z) * clearJ * fine * 0.85);
							c = mix(c, vec3(0.78, 0.78, 0.74), tsLine(d, W - 0.45, 0.07, fw) * step(1.5, vSt.z) * (1.0 - step(0.5, vSt.w)) * fine * 0.85);
						}
					} else if (k < 1.5) {
						// the sidewalk: slabs every 1.5 m, the kerb's top pale along the street side (across 0)
						c = vec3(0.6, 0.59, 0.56) * (0.9 + 0.14 * n);
						float joint = 1.0 - smoothstep(0.015, 0.015 + fa, 0.75 - abs(fract(along / 1.5) - 0.5) * 1.5);
						c *= 1.0 - 0.22 * joint * fine;
						c = mix(c, vec3(0.7, 0.69, 0.66), (1.0 - smoothstep(0.12, 0.12 + fw, vRoad.x * W)) * 0.8);
					} else if (k < 2.5 || (k > 3.5 && k < 4.5)) {
						// a drive, a walk, a forecourt: plain concrete, joints every 3 m
						c = vec3(0.57, 0.555, 0.52) * (0.9 + 0.14 * n);
						float joint = 1.0 - smoothstep(0.02, 0.02 + fa, 1.5 - abs(fract(along / 3.0) - 0.5) * 3.0);
						c *= 1.0 - 0.18 * joint * fine * step(k, 2.5);
					} else {
						// a freeway's carriageway: pale concrete, worn darker down each lane's wheel paths,
						// dashed white between the lanes, solid white by the right shoulder, yellow by the left
						float lanes = max(1.0, floor(W * 2.0 / 3.6 + 0.5)), lw = W * 2.0 / lanes, x = vRoad.x * W + W;
						c = vec3(0.6, 0.58, 0.54) * (0.9 + 0.14 * n);
						float inL = fract(x / lw) * lw;
						c *= 1.0 - 0.1 * (1.0 - smoothstep(0.3, 0.7, abs(abs(inL - lw * 0.5) - 0.9)));
						float dash = step(fract(along / 14.66), 3.66 / 14.66), lane = 0.0;
						for (float q = 1.0; q < 6.0; q += 1.0) if (q < lanes) lane = max(lane, tsLine(x, q * lw, 0.07, fw) * dash);
						c = mix(c, vec3(0.88, 0.88, 0.84), lane * fine);
						c = mix(c, vec3(0.88, 0.88, 0.84), tsLine(vRoad.x * W, W - 0.3, 0.08, fw) * fine);
						c = mix(c, vec3(0.85, 0.66, 0.16), tsLine(vRoad.x * W, -W + 0.3, 0.08, fw) * fine);
					}
					// (far off, held wide, a street is a softer line: lines a pixel wide all bending together
					// read as a pattern, not a town)
					c = mix(c, vec3(0.3, 0.3, 0.29), vFar * ((k > 0.5 && k < 2.5) || (k > 3.5 && k < 4.5) ? 0.7 : 0.35));
					diffuseColor.rgb = c;
				}`);
		};
		m.customProgramCacheKey = () => 'townstreets3';
		return m;
	}
	// the concrete under, the asphalt over (and both just over the ground)
	const matUnder = material(2), matOver = material(3);

	// ---------- one town's streets, as geometry ----------
	const builder = () => ({ pos: [], road: [], st: [], side: [], idx: [] });
	// the stations along a polyline, no more than STEP apart, with how far along each is
	function stations(pts) {
		const S = [pts[0], pts[1]], A = [0];
		for (let k = 2; k < pts.length; k += 2) {
			const ax = pts[k - 2], az = pts[k - 1], bx = pts[k], bz = pts[k + 1], L = Math.hypot(bx - ax, bz - az);
			if (L < 0.01) continue;
			const m = Math.max(1, Math.ceil(L / STEP));
			for (let q = 1; q <= m; q++) { S.push(ax + (bx - ax) * q / m, az + (bz - az) * q / m); A.push(A[A.length - 1] + L / m); }
		}
		return { S, A, total: A[A.length - 1] };
	}
	// a band along the stations: a vertex at each offset (m, + to the right of the way it runs),
	// each with its own across value for the shader
	function band(B, st, offs, us, kind, w, lines, walked, lift) {
		const { S, A, total } = st, m = S.length / 2, na = offs.length, v0 = B.pos.length / 3;
		if (m < 2) return;
		for (let i = 0; i < m; i++) {
			const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
			let dx = S[b * 2] - S[a * 2], dz = S[b * 2 + 1] - S[a * 2 + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
			for (let k = 0; k < na; k++) {
				const o = offs[k], x = S[i * 2] - dz * o, z = S[i * 2 + 1] + dx * o;
				B.pos.push(x, groundAt(x, z) + lift, z);
				B.side.push(-dz * o, dx * o);
				B.road.push(us[k], A[i], total - A[i]);
				B.st.push(w, kind, lines, walked);
			}
			if (i) for (let c = 0; c + 1 < na; c++) { const p = v0 + (i - 1) * na + c, q = p + na; B.idx.push(p, p + 1, q, p + 1, q + 1, q); }
		}
	}
	// a disc on the ground (a junction's corner, a turning circle)
	function disc(B, x, z, R, kind, walked, lift, n = 12) {
		const v0 = B.pos.length / 3;
		B.pos.push(x, groundAt(x, z) + lift, z); B.side.push(0, 0); B.road.push(0, 999, 999); B.st.push(R, kind, 0, walked);
		for (let k = 0; k <= n; k++) {
			const t = k / n * Math.PI * 2, px = x + Math.cos(t) * R, pz = z + Math.sin(t) * R;
			B.pos.push(px, groundAt(px, pz) + lift, pz); B.side.push(Math.cos(t) * R, Math.sin(t) * R); B.road.push(1, 999, 999); B.st.push(R, kind, 0, walked);
			if (k) B.idx.push(v0, v0 + k + 1, v0 + k);
		}
	}
	function* buildSet(set) {
		const t0 = performance.now();
		let s0 = t0, work = 0;
		const under = builder(), over = builder();
		const tick = function* () { if (performance.now() - s0 > (isPhone ? 2 : 3)) { work += performance.now() - s0; yield; s0 = performance.now(); } };
		let count = 0;
		for (const r of set.roads || []) {
			if (!r?.pts || r.pts.length < 4 || r.bridge || SKIP.test(r.cls || '') || r.hand) continue;
			const p = r.pts, mx = p[p.length >> 1 & ~1], mz = p[(p.length >> 1 & ~1) + 1];
			if (painted(mx, mz) && painted(p[0], p[1])) continue;
			const st = stations(p), hw = (r.w || 6) / 2;
			count++;
			if (r.cls === 'footway') { band(under, st, [-hw, hw], [-1, 1], K.concrete, hw, 0, 0, 0.04); yield* tick(); continue; }
			if (r.cls === 'motorway' && !r.link) {
				band(over, st, [-hw - 0.5, 0, hw + 0.5], [-(hw + 0.5) / hw, 0, (hw + 0.5) / hw], K.freeway, hw, 0, 0, 0.08);
				yield* tick(); continue;
			}
			const walked = (r.walked ?? WALKED.has(r.cls)) && r.cls !== 'service' ? 1 : 0, lines = r.link ? 0 : LINES[r.cls] ?? 0;
			const sw = r.sw || SW;
			if (walked) {
				// the sidewalks, each side, from just under the asphalt's edge out
				band(under, st, [-hw - sw, -hw + 0.3], [(sw) / sw, -0.3 / sw], K.sidewalk, sw, 0, 1, 0.05);
				band(under, st, [hw - 0.3, hw + sw], [-0.3 / sw, 1], K.sidewalk, sw, 0, 1, 0.05);
			}
			const wide = hw >= 4.5;
			band(over, st, wide ? [-hw, 0, hw] : [-hw, hw], wide ? [-1, 0, 1] : [-1, 1], K.street, hw, lines, walked, 0.08);
			// the ends: a turning circle at a cul-de-sac, a disc to round a junction's corners
			for (const [end, k] of [[r.end0, 0], [r.end1, p.length - 2]]) {
				if (end) { disc(under, p[k], p[k + 1], 12.5 + sw, K.slab, 0, 0.05, 18); disc(over, p[k], p[k + 1], 12.5, K.disc, walked, 0.08, 18); }
				else if (!r.grid) { if (walked) disc(under, p[k], p[k + 1], hw + sw, K.slab, 0, 0.05, 10); disc(over, p[k], p[k + 1], hw, K.disc, 0, 0.08, 10); }
			}
			yield* tick();
		}
		// the drives and walks to the doors, and the forecourts
		for (const q of set.paths || []) {
			if (!Number.isFinite(q.ax) || painted(q.ax, q.az)) continue;
			const hw = Math.max(0.6, (q.w || 3) / 2), st = stations([q.ax, q.az, q.bx, q.bz]);
			band(under, st, [-hw, hw], [-1, 1], hw >= 4 ? K.slab : K.concrete, hw, 0, 0, 0.045);
			yield* tick();
		}
		for (const g of set.ground || []) {
			const [ax, az, bx, bz, hw, k] = g;
			if (k === 2 || painted(ax, az)) continue;
			const st = stations([ax, az, bx, bz]);
			if (k) band(under, st, [-hw, hw], [-1, 1], K.slab, hw, 0, 0, 0.045);
			else band(over, st, [-hw, hw], [-1, 1], K.disc, hw, 0, 0, 0.07);
			yield* tick();
		}
		work += performance.now() - s0;
		stats.buildMs = Math.max(stats.buildMs, Math.round(work));
		return { under: meshOf(under, matUnder, 0), over: meshOf(over, matOver, 1), roads: count };
	}
	function meshOf(B, mat, order) {
		if (!B.idx.length) return null;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
		g.setAttribute('aRoad', new THREE.Float32BufferAttribute(B.road, 3));
		g.setAttribute('aSt', new THREE.Float32BufferAttribute(B.st, 4));
		g.setAttribute('aSide', new THREE.Float32BufferAttribute(B.side, 2));
		g.setIndex(B.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(B.idx, 1) : new THREE.Uint16BufferAttribute(B.idx, 1));
		g.computeVertexNormals();
		g.computeBoundingSphere();
		g.boundingSphere.radius += 40;
		const M = new THREE.Mesh(g, mat);
		M.receiveShadow = true;
		M.renderOrder = order;
		M.name = 'town streets';
		group.add(M);
		stats.verts += B.pos.length / 3;
		return M;
	}
	function freeMesh(M) { if (!M) return; stats.verts -= M.geometry.attributes.position.count; M.geometry.dispose(); group.remove(M); }

	// ---------- the towns standing ----------
	const built = new Map();         // set key -> { under, over, roads }
	let job = null;
	// sets: [{ key, roads, paths, ground }] — what should be drawn now
	function update(cam, on, sets) {
		group.visible = on;
		if (cam?.fov) U.uTSPx.value = 2 * Math.tan(cam.fov * Math.PI / 360) / Math.max(300, typeof innerHeight === 'number' ? innerHeight : 800);
		const want = new Map();
		for (const s of sets) if (s?.key != null) want.set(s.key, s);
		for (const [k, E] of built) if (!want.has(k)) { freeMesh(E.under); freeMesh(E.over); built.delete(k); }
		if (job && !want.has(job.key)) job = null;
		if (!on) return;
		if (!job) {
			// the nearest town not yet drawn
			let best = null, bd = Infinity;
			for (const s of want.values()) {
				if (built.has(s.key)) continue;
				const d = cam ? Math.hypot((s.x ?? cam.position.x) - cam.position.x, (s.z ?? cam.position.z) - cam.position.z) : 0;
				if (d < bd) { bd = d; best = s; }
			}
			if (best) job = { key: best.key, it: buildSet(best) };
		}
		if (job) {
			const t0 = performance.now();
			while (performance.now() - t0 < (isPhone ? 2.5 : 4)) {
				const r = job.it.next();
				if (r.done) { built.set(job.key, r.value); job = null; break; }
			}
		}
		stats.sets = built.size;
		stats.roads = [...built.values()].reduce((a, E) => a + E.roads, 0);
	}
	// everything wanted, at once (tests, and a jump)
	function settle(sets) {
		for (const s of sets) {
			if (built.has(s.key)) continue;
			const it = buildSet(s);
			let r = it.next();
			while (!r.done) r = it.next();
			built.set(s.key, r.value);
		}
		if (job && built.has(job.key)) job = null;
	}
	function clear() { for (const E of built.values()) { freeMesh(E.under); freeMesh(E.over); } built.clear(); job = null; }
	function dispose() { clear(); scene.remove(group); matUnder.dispose(); matOver.dispose(); }
	const info = () => ({ ...stats, building: job ? String(job.key).slice(0, 40) : null });
	return { update, settle, clear, dispose, info, group };
}
