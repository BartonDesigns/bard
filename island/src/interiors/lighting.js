// The light inside buildings, one system for all of them: the city's halls, flats and shops,
// the services, the landmarks, the houses, the walk-in shops and towers, the cottages, the
// realm's houses and the colony's rooms. A builder hands over what it built:
//
//   lightInterior(root, { id, occluders, levels, bounds, roomOf, rooms, litOf, lamps, ... })
//
// and from then on, a slice a frame (lightbake.js does the sums):
//   - every lamp, ceiling light, tube, panel, sign and screen in it is found in its geometry
//     (the materials that glow) and made a light of its own shape, on or off by its room;
//   - the rooms' geometry is cut finer and each vertex given the light of those fixtures
//     (falling off, shaded by walls and furniture), its share of the sky through the windows
//     (the day's skylight scaled by it), and one bounce of each room's light. So pools of
//     light under the fixtures, darker corners and edges, contact shadows under things, a
//     room with its light off dark at night;
//   - the materials get a copy that reads it (onBeforeCompile): the skylight scaled by the
//     sky share, the fixtures' light added, a gleam of them on what is polished (the
//     direction most of their light comes from), the old flat glow of the walls dropped;
//   - the fixtures glow, with a soft halo, a beam of light down through the dust where the
//     air is dusty (a garage, a warehouse, an engine bay), a few broken ones flickering;
//   - a few real lights stand at the brightest fixtures near you (not following you), to
//     light the people and whatever moves; the nearest casts shadows, on a desktop only.
//     The baked rooms take only their shadows (their own light is already in them);
//   - soft dark spots under the people walking about inside.
// A building's bake is kept by its id, so built again it comes back at once.

import * as THREE from 'three';
import { qualityNow } from '../world/governor.js';
import { bake, tessellate, tessellatedCount, findPieces, pieceFixture, quadBoxes, QUALITY, E_RANGE } from './lightbake.js';

const S = {
	isPhone: typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''),
	queue: [], live: new Set(), cache: new Map(), budget: 3, night: 0, hours: 12, time: 0,
	scene: null, lights: [], lastTick: -1, lastPick: 0, movers: [], casters: new Map(), blobs: null,
	stats: { baked: 0, cached: 0, ms: 0, lastMs: 0, verts: 0, bytes: 0, fixtures: 0 },
};
const CACHE_MAX = () => (S.isPhone ? 3 : 8), CACHE_BYTES = () => (S.isPhone ? 12 : 48) * 1048576;
// the materials' names that are fixtures (the house kit's lamps and bulbs, anyone's screens)
const LAMP_NAME = /^(lamp|bulb|screen|sign|neon|glow|panel|led|light|bigscreen)$/i;
// what floors and fittings are made of, nearer the real thing (polished, sealed, matte)
const TUNE = { concrete: { roughness: 0.52 }, tile: { roughness: 0.26 }, floorPat: { roughness: 0.3 }, stone: { roughness: 0.22 }, wood: { roughness: 0.42 }, trim: { roughness: 0.38 }, paint: { roughness: 0.92 }, paintLit: { roughness: 0.92 }, ceiling: { roughness: 0.96 }, ceilingLit: { roughness: 0.96 }, carpet: { roughness: 1 }, fabric: { roughness: 0.98 } };

// tell it the device, the time of day (0 day .. 1 night) and the hour
export function configureLighting({ isPhone } = {}) { if (isPhone != null) S.isPhone = !!isPhone; }
export function lightingClock(night = 0, hours = null) { S.night = night; if (hours != null) S.hours = hours; }
// the people walking about: [{ x, z, footY }]
export function lightingMovers(list) { S.movers = list || []; }
// a thing that moves and stands on the floor (an engine in its bay): a soft shadow under it,
// w across and d long, while you are in a lit building with it
export function lightingShadowCaster(obj, w, d) { if (obj) S.casters.set(obj, [w, d]); return () => S.casters.delete(obj); }

export function lightInterior(root, spec = {}) {
	if (!root) return null;
	for (const H of S.live) if (H.root === root) return H;
	const H = { root, spec, state: 'queued', fixtures: [], variants: new Map(), U: { ibakeK: { value: 1 }, ibakeGlow: { value: 1 }, ibakeNight: { value: 0 } }, k: 1, bounds: null, verts: 0, bytes: 0, ms: 0 };
	// (its clock: the queue moves on whenever anything it lit is drawn)
	const tick = new THREE.Mesh(TICK_GEO, TICK_MAT);
	tick.frustumCulled = false; tick.renderOrder = -1e9; tick.name = 'lighting:tick';
	tick.onBeforeRender = (renderer, scene, camera) => frame(renderer, scene, camera);
	root.add(tick);
	H.tick = tick;
	S.live.add(H);
	S.queue.push(H);
	return H;
}
// let a building's light go now (its builder dropped it)
export function releaseInterior(root) { for (const H of S.live) if (H.root === root) release(H); }

const TICK_GEO = new THREE.BufferGeometry();
TICK_GEO.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
TICK_GEO.userData.shared = true;
const TICK_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });

// ---------------------------------------------------------------------------------
// each frame (once, whatever draws first)
// (called while the frame is drawn: the work waits till it is done, so nothing drawn changes
// under the renderer)
function frame(renderer, scene, camera) {
	const now = performance.now();
	if (now - S.lastTick < 4) return;
	const dt = S.lastTick < 0 ? 0.016 : Math.min(0.1, (now - S.lastTick) / 1000);
	// (how far the lights ease toward their state: by the real time, however slow the frames)
	const ease = Math.min(1, (S.lastTick < 0 ? 0.016 : (now - S.lastTick) / 1000) * 2);
	S.lastTick = now; S.time += dt;
	queueMicrotask(() => step(renderer, scene, camera, dt, ease));
}
function step(renderer, scene, camera, dt, ease) {
	if (scene?.isScene && S.scene !== scene) attach(scene, renderer);
	// the bakes, a few milliseconds a frame
	const t0 = performance.now();
	// (the nearest building first, unless one is under way)
	if (camera && S.queue.length > 1 && !S.queue[0].gen) {
		const d = (H) => H.root.getWorldPosition(tmpP).distanceToSquared(camera.position);
		S.queue.sort((a, b) => d(a) - d(b));
	}
	while (S.queue.length && performance.now() - t0 < S.budget) {
		const H = S.queue[0];
		if (!H.gen) { H.state = 'baking'; H.gen = job(H); }
		let r;
		const t1 = performance.now();
		try { r = H.gen.next(); } catch (e) { console.warn('lighting', e); r = { done: true }; H.state = 'failed'; }
		H.ms += performance.now() - t1;
		if (r.done) { S.queue.shift(); if (H.state !== 'failed') H.state = 'done'; S.stats.lastMs = H.ms; S.stats.ms += H.ms; }
	}
	// a building no longer in the world: let its light go (every second or so)
	if ((S.time % 1) < dt) for (const H of S.live) { let o = H.root; while (o.parent) o = o.parent; if (!o.isScene) release(H); }
	// how lit each is now, the materials kept in step with theirs
	for (const H of S.live) {
		if (H.state !== 'done') continue;
		const sp = H.spec, h = S.hours;
		const open = !sp.hours || (sp.hours[0] < sp.hours[1] ? h >= sp.hours[0] && h < sp.hours[1] : h >= sp.hours[0] || h < sp.hours[1]);
		// (a place that is shut keeps only its night lights on; so does one open all night but
		// for a hospital, once it is dark: the bays and offices at a station while the crew sleeps)
		const always = !sp.hours || sp.hours[1] - sp.hours[0] >= 24;
		// (a home, once its household has gone to bed (spec.bed, the late hour), keeps one lamp on
		// and its screens: a lamp left on in the hall or by the sofa, the television)
		const late = h < 12 ? h + 24 : h, asleep = sp.home && sp.bed != null && late >= sp.bed && late < 30.5 && S.night > 0.3;
		const nightMode = asleep || (!sp.home && !sp.allNight && (!open || (always && S.night > 0.5))) ? 1 : 0;
		const target = !open ? 0.6 : sp.home ? 0.5 + 0.5 * S.night : 1;
		H.k += (target - H.k) * ease;
		H.nk = (H.nk ?? nightMode) + (nightMode - (H.nk ?? nightMode)) * ease;
		// (the same light by night as by day: no lift for the dark, the lamps are what they are)
		H.U.ibakeK.value = H.k * (sp.strength ?? 1);
		H.U.ibakeNight.value = H.nk;
		H.U.ibakeGlow.value = H.k * (0.9 + 0.5 * S.night);
		for (const [src, v] of H.variants.values()) sync(src, v);
		if (H.halo) { const u = H.halo.material.uniforms; u.uK.value = H.k * (0.35 + 0.65 * S.night); u.uNight.value = H.nk; u.uTime.value = S.time; u.uViewH.value = renderer.domElement.height * 0.5 * (camera.projectionMatrix?.elements[5] || 1); }
		if (H.cones) { const u = H.cones.material.uniforms; u.uK.value = H.k * (0.45 + 0.55 * S.night); u.uNight.value = H.nk; u.uTime.value = S.time; }
	}
	if (camera) { place(camera, dt); blobs(camera); }
}

function attach(scene, renderer) {
	S.scene = scene;
	for (const l of S.lights) l.removeFromParent();
	S.lights = [];
	const n = S.isPhone ? 2 : 4;
	for (let i = 0; i < n; i++) {
		const l = new THREE.PointLight(0xffe2c0, 0, 14, 2);
		l.name = 'lighting:fixture';
		// (the nearest throws shadows, on a desktop with shadows on: the people's on the floor)
		if (i === 0 && !S.isPhone && renderer?.shadowMap?.enabled) { l.castShadow = true; l.shadow.mapSize.set(256, 256); l.shadow.camera.near = 0.1; l.shadow.camera.far = 14; l.shadow.bias = -0.004; l.shadow.radius = 3; l.shadow.autoUpdate = false; l.shadow.needsUpdate = true; }
		l.userData.f = null; l.userData.k = 0;
		scene.add(l);
		S.lights.push(l);
	}
	if (S.blobs) S.blobs.removeFromParent();
	S.blobs = blobMesh();
	scene.add(S.blobs);
}

// ---------------------------------------------------------------------------------
// the real lights: at the brightest fixtures near you, in the building you are in
const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3();
function within(H, p) {
	if (!H.bounds || H.state !== 'done' || !H.root.visible) return false;
	tmpM.copy(H.root.matrixWorld).invert();
	tmpV.copy(p).applyMatrix4(tmpM);
	const b = H.bounds;
	return tmpV.x > b[0] - 0.2 && tmpV.x < b[3] + 0.2 && tmpV.y > b[1] - 0.5 && tmpV.y < b[4] + 0.5 && tmpV.z > b[2] - 0.2 && tmpV.z < b[5] + 0.2;
}
function place(camera, dt) {
	if (!S.lights.length) return;
	const p = camera.position;
	if (S.time - S.lastPick > 0.2) {
		S.lastPick = S.time;
		const here = [...S.live].filter((H) => within(H, p));
		const cand = [];
		for (const H of here) {
			for (const f of H.fixtures) {
				if (!f.on || f.screen || (H.nk > 0.5 && f.night === false)) continue;
				const w = tmpV.set(f.p[0], f.p[1], f.p[2]).applyMatrix4(H.root.matrixWorld);
				const d2 = w.distanceToSquared(p);
				if (d2 > 400) continue;
				cand.push({ f, H, w: w.clone(), s: f.I / (d2 + 2) * (Math.abs(w.y - p.y) < 3 ? 1 : 0.2) });
			}
		}
		cand.sort((a, b) => b.s - a.s);
		const top = cand.slice(0, S.lights.length);
		// keep a light where it is if its fixture is still among the brightest
		const free = S.lights.filter((l) => !top.some((c) => c.f === l.userData.f));
		for (const c of top) {
			if (S.lights.some((l) => l.userData.f === c.f)) continue;
			const l = free.shift();
			if (!l) break;
			l.userData.f = c.f; l.userData.H = c.H; l.userData.k = 0;
			l.position.copy(c.w);
			l.color.setRGB(c.f.c[0], c.f.c[1], c.f.c[2]);
		}
		for (const l of free) l.userData.f = null;
	}
	for (const l of S.lights) {
		const f = l.userData.f, want = f ? 1 : 0;
		l.userData.k += (want - l.userData.k) * Math.min(1, dt * 5);
		const H = l.userData.H;
		const fl = f?.flicker ? flick(S.time, f.flicker) : 1;
		l.intensity = f ? f.I * l.userData.k * (H?.k ?? 1) * fl * 1.2 * (f.night === false ? 1 - (H?.nk ?? 0) : 1) : 0;
		if (l.castShadow) l.shadow.autoUpdate = l.intensity > 0.05;
	}
}
const flick = (t, ph) => { const a = Math.sin(Math.floor(t * 9 + ph * 31) * 12.9898) * 43758.5453; return (a - Math.floor(a)) < 0.28 ? 0.15 : 0.85 + 0.15 * Math.sin(t * 40 + ph); };

// soft dark spots under the people inside
const BLOBS = 32;
function blobMesh() {
	const c = document.createElement('canvas');
	c.width = c.height = 64;
	const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
	gr.addColorStop(0, 'rgb(90,90,90)'); gr.addColorStop(0.55, 'rgb(170,170,170)'); gr.addColorStop(1, 'rgb(255,255,255)');
	g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
	const tex = new THREE.CanvasTexture(c);
	const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, toneMapped: false, fog: false });
	const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const mesh = new THREE.InstancedMesh(geo, m, BLOBS);
	mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'lighting:blobs';
	return mesh;
}
const tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
function blobs(camera) {
	const B = S.blobs;
	if (!B) return;
	const here = [...S.live].filter((H) => within(H, camera.position));
	let n = 0;
	if (here.length) for (const q of S.movers) {
		if (n >= BLOBS) break;
		if (q.footY == null || Math.hypot(q.x - camera.position.x, q.z - camera.position.z) > 30) continue;
		tmpP.set(q.x, q.footY + 0.3, q.z);
		if (!here.some((H) => within(H, tmpP))) continue;
		tmpP.y = q.footY + 0.012;
		B.setMatrixAt(n++, tmpM.compose(tmpP, tmpQ.identity(), tmpS.setScalar(q.r || 0.85)));
	}
	if (here.length) for (const [o, [w, d]] of S.casters) {
		if (n >= BLOBS) break;
		if (!o.parent || !o.visible) continue;
		o.getWorldPosition(tmpP);
		if (tmpP.distanceTo(camera.position) > 40) continue;
		tmpP.y += 0.3;
		if (!here.some((H) => within(H, tmpP))) continue;
		tmpP.y -= 0.288;
		o.getWorldQuaternion(tmpQ);
		B.setMatrixAt(n++, tmpM.compose(tmpP, tmpQ, tmpS.set(w * 1.25, 1, d * 1.15)));
	}
	B.count = n;
	if (n) B.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------------
// one building's bake (a generator, a slice at a time)
function isFixtureMat(m, mesh, spec) {
	if (spec.lamps?.includes(m) || m.userData?.fixture) return true;
	if (LAMP_NAME.test(mesh.name || '')) return true;
	return false;
}
const BAKEABLE = (m) => m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial) && !m.transparent && m.opacity >= 1 && m.visible !== false;

function* job(H) {
	// (a phone, or any device the governor has turned down: the coarse bake)
	const { root, spec } = H, Q = S.isPhone || qualityNow()?.shadows === false ? QUALITY.phone : QUALITY.desktop;
	const t0 = () => { const s = performance.now(); return () => performance.now() - s > S.budget; };
	root.updateMatrixWorld(true);
	const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
	// what is in it: the meshes to light, the lamps among them
	const bakeList = [], lampList = [];
	root.traverse((o) => {
		if (!o.isMesh || o === H.tick || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.geometry?.attributes?.position || o.userData.noBake) return;
		const g = o.geometry, m = o.material;
		if (g.morphAttributes?.position) return;
		const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
		const fixture = isFixtureMat(m, o, spec) || (spec.glowAttr && g.attributes[spec.glowAttr.name]);
		if (fixture) lampList.push({ o, rel, glowOnly: !isFixtureMat(m, o, spec) });
		if (!fixture || spec.glowAttr) {
			if (!BAKEABLE(m) || g.userData?.shared || g.userData?.keep || !g.attributes.normal) return;
			if (spec.exclude && (spec.exclude.includes?.(m) || spec.exclude.includes?.(o.name))) return;
			bakeList.push({ o, rel });
		}
	});
	const sig = bakeList.map((q) => (q.o.name || '') + q.o.geometry.attributes.position.count).join('|') + '#' + lampList.length;
	yield;
	// the plan: its bounds, its levels (floor and ceiling heights)
	const box = new THREE.Box3(), tb = new THREE.Box3();
	for (const q of bakeList) { if (!q.o.geometry.boundingBox) q.o.geometry.computeBoundingBox(); tb.copy(q.o.geometry.boundingBox).applyMatrix4(q.rel); box.union(tb); }
	if (box.isEmpty()) { H.bounds = null; return; }
	H.bounds = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
	const bounds = spec.bounds || [box.min.x, box.min.z, box.max.x, box.max.z];
	const levels = spec.levels || [[box.min.y, box.max.y]];
	const centre = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];

	// ---- the fixtures: given, and found in the lamps' geometry
	const fixtures = (spec.fixtures || []).map((f) => ({ on: true, ...f }));
	const pieceMeshes = [];
	for (const q of lampList) {
		const g = q.o.geometry.index ? q.o.geometry.toNonIndexed() : q.o.geometry, P = rootSpace(g.attributes.position.array, q.rel, false);
		let C = g.attributes.color ? g.attributes.color : null;
		if (C) { const s = C.itemSize, c = new Float32Array(C.count * 3); for (let i = 0; i < C.count; i++) c.set([C.array[i * s], C.array[i * s + 1], C.array[i * s + 2]], i * 3); C = c; }
		// (a glow attribute marks the lamps in a mesh of everything: keep its glowing triangles)
		let keep = null;
		if (spec.glowAttr) { const A = g.attributes[spec.glowAttr.name]; if (A) keep = (v) => spec.glowAttr.values.includes(Math.round(A.array[v])); }
		if (keep) {
			const idx = [];
			for (let a = 0; a + 2 < g.attributes.position.count; a += 3) if (keep(a)) idx.push(a);
			if (!idx.length) continue;
			const p2 = new Float32Array(idx.length * 9), c2 = C ? new Float32Array(idx.length * 9) : null;
			idx.forEach((a, i) => { p2.set(P.subarray(a * 3, a * 3 + 9), i * 9); if (c2) c2.set(C.subarray(a * 3, a * 3 + 9), i * 9); });
			pieceMeshes.push({ P: p2, C: c2, count: idx.length * 3, q, map: idx });
		} else pieceMeshes.push({ P, C, count: g.attributes.position.count, q });
		if (g !== q.o.geometry) g.dispose();
	}
	const pieces = findPieces(pieceMeshes);
	for (const pc of pieces) {
		const m = pc.mesh.q.o.material, em = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05 ? m.emissive : m.color || new THREE.Color(1, 1, 1);
		const mx = Math.max(em.r, em.g, em.b, 1e-3);
		const f = pieceFixture(pc, { ceilings: levels, centre, glow: [em.r / mx, em.g / mx, em.b / mx], strength: spec.lampStrength ?? 1 });
		if (!f) continue;
		if (fixtures.some((g) => !g.piece && Math.hypot(g.p[0] - f.p[0], g.p[1] - f.p[1], g.p[2] - f.p[2]) < 0.5)) continue;
		fixtures.push(f);
	}
	// on or off by its room; dusty air; a few broken
	const rnd = hash(spec.id || 'b');
	for (const f of fixtures) {
		const rm = spec.roomOf ? spec.roomOf(f.p[0], f.p[1] - 0.3, f.p[2]) : -1;
		if (spec.litOf && rm >= 0 && !spec.litOf(rm)) f.on = false;
		f.dust = typeof spec.dust === 'function' ? !!spec.dust(f.p[0], f.p[1] - 0.5, f.p[2], rm) : !!spec.dust;
		const r = rnd(f.p[0] * 3.1 + f.p[2] * 7.7 + f.p[1]);
		if (f.flicker == null) f.flicker = !f.screen && f.on && r < (f.dust ? 0.07 : 0.015) ? 1 + r * 100 : 0;
	}
	// no room brighter than a well lit one on the whole: where its fixtures are many (an engine
	// bay's rows of tubes), each gives less (about 250 lux across the floor at most)
	const area0 = Math.max(4, (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]));
	const flux = new Map();
	for (const f of fixtures) if (f.on && !f.screen) { const rm = spec.roomOf ? spec.roomOf(f.p[0], f.p[1] - 0.3, f.p[2]) : -1; f.rm = rm; flux.set(rm, (flux.get(rm) || 0) + f.I); }
	for (const f of fixtures) {
		if (!f.on || f.screen) continue;
		const area = (f.rm >= 0 && spec.roomArea?.(f.rm)) || area0;
		f.I *= Math.min(1, 1.5 * area / (1.9 * flux.get(f.rm)));
	}
	// the night lights: what stays on after hours (a closed shop, an office, a station's bay
	// while the crew sleeps): in each room about one fixture in every 12 m square, the screens
	// and signs; a home's and a hospital's lamps are all night lights (they are on or off by
	// their rooms, or always lit)
	nightLights(fixtures, spec);
	H.fixtures = fixtures;
	S.stats.fixtures += fixtures.length;
	yield;

	// ---- kept from before? the same building built again
	const cached = spec.id && S.cache.get(spec.id);
	let results = null, geos = null;
	if (cached && cached.sig === sig) { results = cached.results; geos = cached.geos; S.stats.cached++; }
	else {
		// cut finer, keeping within the budget of vertices
		let est = 0;
		for (const q of bakeList) { const g = q.o.geometry; if (!g.index) est += tessellatedCount(g.attributes.position.array, g.attributes.position.count, Q.cell); else est += g.index.count * 2; }
		const cell = Q.cell * (est > Q.maxVerts ? Math.sqrt(est / Q.maxVerts) : 1);
		geos = [];
		let budget = t0();
		for (const q of bakeList) {
			const g0 = q.o.geometry.index ? q.o.geometry.toNonIndexed() : q.o.geometry;
			const attrs = {};
			for (const k of Object.keys(g0.attributes)) { const A = g0.attributes[k]; if (A.isInterleavedBufferAttribute) continue; attrs[k] = { array: A.array instanceof Float32Array ? A.array : Float32Array.from(A.array), size: A.itemSize, normalized: A.normalized, type: A.array.constructor }; }
			const T = tessellate(attrs, g0.attributes.position.count, cell);
			for (const k of Object.keys(T.attrs)) { T.attrs[k].type = attrs[k].type; T.attrs[k].normalized = attrs[k].normalized; }
			if (g0 !== q.o.geometry) g0.dispose();
			geos.push(T);
			if (budget()) { yield; budget = t0(); }
		}
		// the solid boxes: given, and the big flat faces of what is built
		const boxes = [...(spec.occluders || [])];
		for (const q of bakeList) {
			const g = q.o.geometry.index ? q.o.geometry.toNonIndexed() : q.o.geometry;
			quadBoxes(rootSpace(g.attributes.position.array, q.rel, false), rootSpace(g.attributes.normal.array, q.rel, true), g.attributes.position.count, 0.25, boxes);
			if (g !== q.o.geometry) g.dispose();
		}
		yield;
		const meshes = geos.map((T, i) => {
			const q = bakeList[i], m = q.o.material, c = m.color || new THREE.Color(0.7, 0.7, 0.7);
			const C = T.attrs.color ? squeeze(T.attrs.color.array, T.attrs.color.size) : null;
			return { P: rootSpace(T.attrs.position.array, q.rel, false), N: rootSpace(T.attrs.normal.array, q.rel, true), C, base: [c.r, c.g, c.b], count: T.count };
		});
		const gen = bake(meshes, { fixtures, boxes, bounds, slabs: levels, roomOf: spec.roomOf, rooms: spec.rooms || 0, rays: Q.rays, sky: spec.sky }, () => budget());
		budget = t0();
		let r = gen.next();
		while (!r.done) { yield; budget = t0(); r = gen.next(); }
		results = r.value.map((R) => ({ light: packLight(R.light), dir: packDir(R.dir), night: packNight(R.night) }));
		S.stats.baked++;
		if (spec.id) {
			let bytes = 0;
			for (const T of geos) for (const A of Object.values(T.attrs)) bytes += A.array.byteLength;
			for (const R of results) bytes += R.light.array.byteLength + R.dir.array.byteLength + R.night.array.byteLength;
			S.cache.delete(spec.id);
			S.cache.set(spec.id, { sig, results, geos, bytes });
			// (the oldest let go past the device's share)
			let sum = 0;
			for (const c of S.cache.values()) sum += c.bytes;
			while (S.cache.size > 1 && (S.cache.size > CACHE_MAX() || sum > CACHE_BYTES())) { const k = S.cache.keys().next().value; sum -= S.cache.get(k).bytes; S.cache.delete(k); }
		}
	}
	yield;
	// ---- onto the meshes
	for (let i = 0; i < bakeList.length; i++) {
		const { o } = bakeList[i], T = geos[i], R = results[i];
		const g = new THREE.BufferGeometry();
		for (const k of Object.keys(T.attrs)) {
			const A = T.attrs[k];
			g.setAttribute(k, new THREE.BufferAttribute(A.type && A.type !== Float32Array ? A.type.from(A.array) : A.array, A.size, !!A.normalized));
		}
		g.setAttribute('ilight', R.light);
		g.setAttribute('idir', R.dir);
		g.setAttribute('inight', R.night);
		g.computeBoundingSphere(); g.computeBoundingBox();
		const old = o.geometry;
		o.geometry = g;
		old.dispose();
		o.material = variant(H, o.material, false, o.name);
		// (the sun reaches a room only where the building lets it in: the shell's and the walls'
		// shadows fall on it, so by day the floor is not lit through the roof)
		o.receiveShadow = true;
		H.verts += T.count;
		for (const a of Object.values(g.attributes)) H.bytes += a.array.byteLength;
	}
	// the lamps: glowing by their fixture's state
	for (const pm of pieceMeshes) {
		const o = pm.q.o, m = o.material;
		if (pm.q.glowOnly && spec.glowAttr) continue;
		if (!m.isMeshStandardMaterial && !m.isMeshLambertMaterial && !m.isMeshPhongMaterial) continue;
		const n = o.geometry.attributes.position.count, L = new Float32Array(n * 4).fill(0), Nn = new Float32Array(n).fill(1);
		for (let v = 0; v < n; v++) L[v * 4 + 3] = 1;
		for (const f of fixtures) if (f.piece?.mesh === pm) for (const a of f.piece.tri) { const v0 = pm.map ? pm.map[a / 3] : a; for (let q = 0; q < 3; q++) { L[(v0 + q) * 4 + 3] = f.on ? 1 : 0.03; Nn[v0 + q] = f.night === false ? 0 : 1; } }
		if (o.geometry.index) o.geometry = o.geometry.toNonIndexed();
		o.geometry.setAttribute('ilight', packLight(L));
		o.geometry.setAttribute('idir', packDir(new Float32Array(n * 4)));
		o.geometry.setAttribute('inight', packNight(Nn));
		o.material = variant(H, m, true, o.name);
	}
	// the glow round them, the beams where the air is dusty
	makeHalos(H);
	makeCones(H, levels);
	S.stats.verts = [...S.live].reduce((s, q) => s + q.verts, 0);
	S.stats.bytes = [...S.live].reduce((s, q) => s + q.bytes, 0);
}
// positions (or normals) into the building's frame
function rootSpace(A, rel, normal) {
	const e = rel.elements;
	// (a mesh in the building's own frame, to rounding: as it is)
	const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
	if (e.every((v, i) => Math.abs(v - I[i]) < 1e-5)) return A;
	const out = new Float32Array(A.length), v = new THREE.Vector3(), nm = normal ? new THREE.Matrix3().getNormalMatrix(rel) : null;
	for (let i = 0; i < A.length; i += 3) {
		v.set(A[i], A[i + 1], A[i + 2]);
		if (normal) v.applyMatrix3(nm).normalize(); else v.applyMatrix4(rel);
		out[i] = v.x; out[i + 1] = v.y; out[i + 2] = v.z;
	}
	return out;
}
const squeeze = (A, s) => { if (s === 3) return A; const n = A.length / s, o = new Float32Array(n * 3); for (let i = 0; i < n; i++) { o[i * 3] = A[i * s]; o[i * 3 + 1] = A[i * s + 1]; o[i * 3 + 2] = A[i * s + 2]; } return o; };
function packLight(L) {
	const n = L.length / 4, o = new Uint16Array(n * 4);
	for (let i = 0; i < n; i++) {
		for (let k = 0; k < 3; k++) o[i * 4 + k] = Math.min(65535, Math.round(L[i * 4 + k] / E_RANGE * 65535));
		o[i * 4 + 3] = Math.min(65535, Math.round(Math.max(0, L[i * 4 + 3]) * 65535));
	}
	return new THREE.BufferAttribute(o, 4, true);
}
function packNight(A) {
	const o = new Uint8Array(A.length);
	for (let i = 0; i < A.length; i++) o[i] = Math.max(0, Math.min(255, Math.round(A[i] * 255)));
	return new THREE.BufferAttribute(o, 1, true);
}
// which fixtures stay on at night (see job): a shut place's one in each 12 m square and its
// screens; a hospital's all; a home's one lamp (after bedtime) and its screens
export function nightLights(fixtures, spec = {}) {
	// (a home: one lamp kept after bedtime, a table lamp if it has one, else its brightest light)
	if (spec.home) {
		let keep = null;
		for (const f of fixtures) if (f.on && !f.screen && (!keep || (f.shape === 'point') > (keep.shape === 'point') || ((f.shape === 'point') === (keep.shape === 'point') && f.I > keep.I))) keep = f;
		for (const f of fixtures) f.night = f === keep || !!f.screen || !f.on;
		return fixtures;
	}
	const all = !!spec.allNight;
	const taken = new Set();
	const order = fixtures.map((f, i) => i).sort((a, b) => fixtures[a].p[0] - fixtures[b].p[0] || fixtures[a].p[2] - fixtures[b].p[2] || fixtures[a].p[1] - fixtures[b].p[1]);
	for (const i of order) {
		const f = fixtures[i];
		if (all || f.screen || !f.on) { f.night = true; continue; }
		const rm = f.rm ?? -1, key = rm + ':' + Math.floor(f.p[0] / 12) + ':' + Math.floor(f.p[2] / 12) + ':' + Math.floor(f.p[1] / 3);
		f.night = !taken.has(key);
		taken.add(key);
	}
	return fixtures;
}
function packDir(D) {
	const n = D.length / 4, o = new Int8Array(n * 4);
	for (let i = 0; i < n * 4; i++) o[i] = Math.max(-127, Math.min(127, Math.round(D[i] * 127)));
	return new THREE.BufferAttribute(o, 4, true);
}
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (x) => { const a = Math.sin(x * 12.9898 + (h >>> 8) * 0.001) * 43758.5453; return a - Math.floor(a); }; };

function release(H) {
	S.live.delete(H);
	const i = S.queue.indexOf(H);
	if (i >= 0) S.queue.splice(i, 1);
	for (const [, v] of H.variants.values()) v.dispose();
	H.variants.clear();
	for (const o of [H.halo, H.cones, H.tick]) if (o) { o.removeFromParent(); if (o !== H.tick) { o.geometry.dispose(); o.material.dispose(); } }
	for (const l of S.lights) if (l.userData.H === H) { l.userData.f = null; l.userData.H = null; }
	H.state = 'released';
}

// ---------------------------------------------------------------------------------
// the materials: a copy of each that reads the bake (one set per building, so each has its
// own switch); the program is shared by every copy of a material
function variant(H, src, fixture, name) {
	const key = src.uuid + (fixture ? ':f' : '');
	const had = H.variants.get(key);
	if (had) return had[1];
	const ud = src.userData;
	src.userData = {};
	const v = new src.constructor();
	v.copy(src);
	src.userData = ud;
	v.userData = ud;
	const spec = !S.isPhone && !!src.isMeshStandardMaterial;
	v.defines = { ...(v.defines || {}), IBAKE: '' };
	if (spec) v.defines.IBAKE_SPEC = '';
	if (fixture) v.defines.IBAKE_FIX = '';
	// (a world whose rooms glow rather than take light: the bake added as glow)
	const em = !!H.spec.emissive;
	if (em) v.defines.IBAKE_EM = '';
	else if (v.emissive) v.emissive.setRGB(0, 0, 0);
	if (fixture) v.emissiveIntensity = 1;
	const t = !fixture && TUNE[name];
	if (t) Object.assign(v, t);
	v.userData.tuned = !!t;
	const U = H.U;
	v.onBeforeCompile = (sh, r) => { src.onBeforeCompile(sh, r); patch(sh, U); };
	v.customProgramCacheKey = () => src.customProgramCacheKey() + '|ibake' + (fixture ? 'F' : '') + (spec ? 'S' : '') + (em ? 'E' : '');
	v.name = (src.name || name || '') + ':lit';
	H.variants.set(key, [src, v]);
	return v;
}
// kept in step with the material it copies (photographs arriving, the night's glow)
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'envMap', 'bumpMap'];
function sync(src, v) {
	let again = false;
	for (const k of MAPS) if (src[k] !== v[k] && k in src) { if (!src[k] !== !v[k]) again = true; v[k] = src[k]; }
	if (src.color && !src.color.equals(v.color)) v.color.copy(src.color);
	if (!v.userData.tuned && src.roughness !== undefined) v.roughness = src.roughness;
	if (src.metalness !== undefined) v.metalness = src.metalness;
	if (src.envMapIntensity !== undefined) v.envMapIntensity = src.envMapIntensity;
	if (src.normalScale) v.normalScale.copy(src.normalScale);
	// (a lamp glows whenever its fixture is on, brighter where its own material says so)
	if (v.defines.IBAKE_FIX && src.emissive) { v.emissive.copy(src.emissive); if (src.emissive.r + src.emissive.g + src.emissive.b < 0.05) v.emissive.copy(src.color); v.emissiveIntensity = Math.max(1, src.emissiveIntensity); }
	if (again) v.needsUpdate = true;
}
// the shader: the skylight by the sky share, the fixtures' light, their gleam; the baked
// rooms take no light of the real lamps but their shadows
const LFB = (() => {
	const c = THREE.ShaderChunk.lights_fragment_begin, i0 = c.indexOf('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )'), i1 = c.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )');
	if (i0 < 0 || i1 < 0) return null;
	const mid = c.slice(i0, i1)
		.replace('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tibC0 = directLight.color;')
		.replace(/RE_Direct\( directLight[^;]*;/, '{ float ib0 = dot( ibC0, vec3( 0.333 ) ); ibLoss += ( ib0 - dot( directLight.color, vec3( 0.333 ) ) ) * saturate( dot( geometryNormal, directLight.direction ) ); }');
	// (and the sun, in a room, only as much as the windows let in: a floor by a window takes it, the
	// middle of a deep hall little; the shell's shadow, where there is one, does the rest)
	return (c.slice(0, i0) + 'float ibLoss = 0.0;\nvec3 ibC0 = vec3( 0.0 );\n' + mid + c.slice(i1))
		.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= clamp( vIl.a * 1.6, 0.0, 1.0 );');
})();
function patch(sh, U) {
	sh.uniforms.ibakeK = U.ibakeK;
	sh.uniforms.ibakeGlow = U.ibakeGlow;
	sh.uniforms.ibakeNight = U.ibakeNight;
	// (the direction scaled by how much of the light comes from it: one varying, not two)
	// (by night, where a place keeps only its night lights on, the light is their share of it)
	sh.vertexShader = 'attribute vec4 ilight;\nattribute vec4 idir;\nattribute float inight;\nuniform float ibakeNight;\nvarying vec4 vIl;\nvarying vec3 vIdir;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n\tfloat ibN = mix( 1.0, inight, ibakeNight );\n\tvIl = vec4( ilight.rgb * ibN, ilight.a );\n\tvIdir = mat3( modelViewMatrix ) * idir.xyz * idir.w;\n\t#ifdef IBAKE_FIX\n\tvIl.a *= ibN;\n\t#endif');
	let f = sh.fragmentShader;
	f = 'varying vec4 vIl;\nvarying vec3 vIdir;\nuniform float ibakeK;\nuniform float ibakeGlow;\n' + f;
	if (LFB) f = '#ifndef IBAKE_FIX\n#define IBAKE_LOSS\n#endif\n' + f.replace('#include <lights_fragment_begin>', '#ifdef IBAKE_FIX\n#include <lights_fragment_begin>\n#else\n' + LFB + '\n#endif');
	f = f.replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
	#if defined( RE_IndirectDiffuse ) && !defined( IBAKE_FIX ) && !defined( IBAKE_EM )
	{
		vec3 ibE = vIl.rgb * ( ${E_RANGE.toFixed(1)} * ibakeK );
		float ibL = dot( ibE, vec3( 0.333 ) );
		#if ( NUM_POINT_LIGHTS > 0 ) && defined( IBAKE_LOSS )
		// (on what faces up only: a floor, a table; a light's own housing would black out the ceiling)
		float ibUp = smoothstep( 0.4, 0.85, dot( geometryNormal, normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
		ibE *= mix( 1.0, clamp( 1.0 - ibLoss / max( ibL, 1e-3 ), 0.45, 1.0 ), ibUp );
		#endif
		// the day's skylight: as much of it as the windows let in here
		irradiance = irradiance * max( vIl.a, 0.08 ) + ibE;
		#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV ) && defined( STANDARD )
		iblIrradiance *= vIl.a;
		#endif
		#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
		radiance *= clamp( vIl.a + ibL * 0.12, 0.08, 1.0 );
		#endif
		#if defined( IBAKE_SPEC ) && defined( STANDARD )
		// the fixtures' gleam: from where most of their light comes
		// (its own GGX: the lights' energy terms are not set up when the room has no lights)
		float ibW = length( vIdir );
		vec3 ibD = vIdir / max( ibW, 1e-4 ), ibH = normalize( ibD + geometryViewDir );
		float ibNL = saturate( dot( geometryNormal, ibD ) ), ibNV = saturate( dot( geometryNormal, geometryViewDir ) ), ibNH = saturate( dot( geometryNormal, ibH ) );
		float ibA = max( pow2( material.roughness ), 0.03 ), ibA2 = ibA * ibA, ibDn = ibNH * ibNH * ( ibA2 - 1.0 ) + 1.0;
		float ibV = 0.5 / max( ibNL * sqrt( ibNV * ibNV * ( 1.0 - ibA2 ) + ibA2 ) + ibNV * sqrt( ibNL * ibNL * ( 1.0 - ibA2 ) + ibA2 ), 1e-3 );
		vec3 ibF = material.specularColor + ( 1.0 - material.specularColor ) * pow( 1.0 - saturate( dot( geometryViewDir, ibH ) ), 5.0 );
		reflectedLight.directSpecular += 0.5 * ibE * ibW * step( 1e-3, ibNL ) * ibF * ( ibA2 / ( PI * ibDn * ibDn ) ) * ibV;
		#endif
	}
	#endif`);
	f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\t#ifdef IBAKE_EM\n\ttotalEmissiveRadiance += diffuseColor.rgb * vIl.rgb * ( ' + (E_RANGE / Math.PI).toFixed(4) + ' * ibakeK );\n\t#endif\n\t#ifdef IBAKE_FIX\n\ttotalEmissiveRadiance *= ibakeGlow * vIl.a;\n\t#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n\ttotalEmissiveRadiance *= min( vec3( 1.2 ), vColor.rgb * 1.2 );\n\t#endif\n\t#endif');
	sh.fragmentShader = f;
}

// ---------------------------------------------------------------------------------
// the glow round each lit fixture: a soft disc toward you, brighter after dark
function makeHalos(H) {
	const list = H.fixtures.filter((f) => f.on);
	if (!list.length) return;
	const n = list.length, P = new Float32Array(n * 3), C = new Float32Array(n * 3), Z = new Float32Array(n), F = new Float32Array(n), Nt = new Float32Array(n);
	list.forEach((f, i) => {
		const down = f.shape === 'down' || f.shape === 'tube' || (f.shape === 'panel' && f.n?.[1] < -0.5);
		P.set([f.p[0] + (f.n?.[0] || 0) * 0.08, f.p[1] - (down ? 0.1 : 0), f.p[2] + (f.n?.[2] || 0) * 0.08], i * 3);
		const k = Math.min(1.4, 0.35 + f.I / 30);
		C.set([f.c[0] * k, f.c[1] * k, f.c[2] * k], i * 3);
		Z[i] = f.screen ? 0.5 + (f.w || 0.4) : f.shape === 'tube' ? 0.9 + (f.len || 1) * 0.6 : f.shape === 'panel' ? 1.1 + (f.w || 0.6) : f.shape === 'point' ? 0.9 : 1.0;
		F[i] = f.flicker || 0;
		Nt[i] = f.night === false ? 0 : 1;
	});
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(P, 3));
	g.setAttribute('color', new THREE.BufferAttribute(C, 3));
	g.setAttribute('aSize', new THREE.BufferAttribute(Z, 1));
	g.setAttribute('aFlick', new THREE.BufferAttribute(F, 1));
	g.setAttribute('aNight', new THREE.BufferAttribute(Nt, 1));
	const m = new THREE.ShaderMaterial({
		uniforms: { uK: { value: 0.5 }, uTime: { value: 0 }, uViewH: { value: 500 }, uNight: { value: 0 } },
		vertexShader: `attribute float aSize; attribute float aFlick; attribute float aNight; attribute vec3 color; uniform float uK, uTime, uViewH, uNight; varying vec3 vC;
			void main() {
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				float fl = 1.0;
				if (aFlick > 0.0) { float a = fract(sin(floor(uTime * 9.0 + aFlick * 31.0) * 12.9898) * 43758.5453); fl = a < 0.28 ? 0.1 : 0.85 + 0.15 * sin(uTime * 40.0 + aFlick); }
				vC = color * uK * fl * mix(1.0, aNight, uNight);
				gl_Position = projectionMatrix * mv;
				gl_PointSize = clamp(aSize * uViewH / max(0.2, -mv.z), 0.0, 512.0);
			}`,
		fragmentShader: `varying vec3 vC;
			void main() {
				vec2 d = gl_PointCoord - 0.5;
				float r2 = dot(d, d) * 4.0;
				if (r2 > 1.0) discard;
				float a = exp(-r2 * 5.0) * 0.55 + exp(-r2 * 40.0) * 0.6;
				gl_FragColor = vec4(vC * a, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
	});
	const pts = new THREE.Points(g, m);
	pts.name = 'lighting:halos'; pts.frustumCulled = false; pts.renderOrder = 5;
	H.root.add(pts);
	H.halo = pts;
}
// the beams down from the lights where the air is dusty: an open cone, faint, fading down
function makeCones(H, levels) {
	const list = H.fixtures.filter((f) => f.on && f.dust && !f.screen && (f.shape === 'down' || f.shape === 'tube' || f.shape === 'panel' || f.shape === 'spot'));
	if (!list.length) return;
	const pos = [], tt = [], nor = [], col = [], nt = [], seg = S.isPhone ? 8 : 14;
	for (const f of list) {
		const lv = levels.find(([y0, y1]) => f.p[1] > y0 && f.p[1] <= y1 + 0.3) || levels[0], floor = lv[0];
		const h = Math.max(0.5, f.p[1] - floor), r0 = f.shape === 'tube' ? 0.35 : f.shape === 'panel' ? Math.max(0.3, (f.w || 0.6) * 0.5) : 0.18, r1 = r0 + h * 0.42;
		for (let i = 0; i < seg; i++) {
			const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
			const q = [[a0, 0], [a1, 0], [a1, 1], [a0, 0], [a1, 1], [a0, 1]];
			for (const [a, t] of q) {
				const r = r0 + (r1 - r0) * t;
				pos.push(f.p[0] + Math.cos(a) * r, f.p[1] - h * t, f.p[2] + Math.sin(a) * r);
				nor.push(Math.cos(a), 0.4, Math.sin(a));
				tt.push(t);
				nt.push(f.night === false ? 0 : 1);
				col.push(f.c[0], f.c[1], f.c[2]);
			}
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
	g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	g.setAttribute('aNight', new THREE.Float32BufferAttribute(nt, 1));
	const m = new THREE.ShaderMaterial({
		uniforms: { uK: { value: 0.5 }, uTime: { value: 0 }, uNight: { value: 0 } },
		vertexShader: `attribute float aT; attribute float aNight; attribute vec3 color; uniform float uNight; varying float vT; varying vec3 vC; varying vec3 vN; varying vec3 vV; varying vec3 vW;
			void main() { vT = aT; vC = color * mix(1.0, aNight, uNight); vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = position; gl_Position = projectionMatrix * mv; }`,
		fragmentShader: `uniform float uK, uTime; varying float vT; varying vec3 vC; varying vec3 vN; varying vec3 vV; varying vec3 vW;
			void main() {
				float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
				float motes = 0.85 + 0.15 * sin(vW.x * 7.0 + vW.y * 5.0 + uTime * 0.7) * sin(vW.z * 6.0 - uTime * 0.5);
				float a = uK * 0.05 * pow(1.0 - vT, 1.6) * edge * motes;
				gl_FragColor = vec4(vC * a, 1.0);
			}`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
	});
	const mesh = new THREE.Mesh(g, m);
	mesh.name = 'lighting:beams'; mesh.renderOrder = 4;
	H.root.add(mesh);
	H.cones = mesh;
}

// ---------------------------------------------------------------------------------
// for tests and looking round: window.L99Lighting.info(), .budget(ms)
function info() {
	const L = [...S.live];
	return {
		live: L.length, queued: S.queue.length, done: L.filter((H) => H.state === 'done').length,
		verts: S.stats.verts, MB: +(S.stats.bytes / 1048576).toFixed(2), cache: S.cache.size,
		baked: S.stats.baked, cached: S.stats.cached, lastMs: +S.stats.lastMs.toFixed(1), totalMs: +S.stats.ms.toFixed(1),
		lights: S.lights.map((l) => +l.intensity.toFixed(2)),
		list: L.map((H) => ({ id: H.spec.id, state: H.state, fixtures: H.fixtures.length, on: H.fixtures.filter((f) => f.on).length, dust: H.fixtures.filter((f) => f.dust).length, verts: H.verts, ms: +H.ms.toFixed(1), k: +H.k.toFixed(2) })),
	};
}
export const lightingInfo = info;
// the whole of one building's bake at once, here and now (for tests and tools)
export function bakeNow(root, spec = {}) {
	const H = lightInterior(root, spec);
	S.queue.splice(S.queue.indexOf(H), 1);
	H.state = 'baking';
	const t = performance.now(), gen = job(H);
	while (!gen.next().done);
	H.ms = performance.now() - t;
	H.state = 'done';
	return H;
}
if (typeof window !== 'undefined') window.L99Lighting = { info, budget: (ms) => { S.budget = ms; }, state: S };
