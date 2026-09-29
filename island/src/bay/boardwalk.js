// The Santa Cruz Beach Boardwalk, on Main Beach between the Municipal Wharf and the mouth of
// the San Lorenzo River: California's oldest amusement park (1907). From the west, the
// Casino and its Cocoanut Grove ballroom (Mediterranean revival: arcades of arches, cream
// stucco, red tile, towers with domes), the Looff Carousel's round house, Neptune's Kingdom
// in the old plunge; the midway with its stands and games, the Ferris wheel, the bumper
// cars, the Double Shot tower; the Sky Glider along the beach; and at the east end the Giant
// Dipper's white timber by the river. The promenade runs the length of it above the sand,
// lamps and flags along the seawall, the surf in front and the Municipal Wharf out into the
// bay (wharf.js). Behind it Beach Street and the beach train's line, the big lot across
// from the Casino, and in the river's bend the River Lot; the San Lorenzo (sanlorenzo.js)
// comes down past the east end under the trestle and out across the sand.
//
// Walk up to a ride and a button offers it; aboard, the ride has the camera (drag to look
// round, × or Escape to get off). By day it is full of families; after dark the bulbs come
// on: the coaster's track, the wheel's spokes, the Casino's arches.
//
// The survey's heights here are 120 m apart (the coarse level), so the ground under the park
// is regraded where it loads: the midway level, the beach sloping to the surf, the wharf's
// ghost (the survey saw it as a sandbar) and a spike in the old data taken out; the river
// carves its own channel once that is done. The park is built when you come within two
// kilometres, a piece a frame.

import * as THREE from 'three';
import { H_OFF, H_SCALE } from './geo.js';
import { FRAME, toW, toL, DECK, merger, instancer, bulbs, paint, signBoard, setNight, rng } from './rides/kit.js';
import { createCrowd } from '../people/crowd.js';
import { createSound } from './rides/sound.js';
import { createDipper } from './rides/dipper.js';
import { createWheel } from './rides/wheel.js';
import { createBumper } from './rides/bumper.js';
import { createCarousel } from './rides/carousel.js';
import { createGlider } from './rides/glider.js';
import { createDrop } from './rides/drop.js';
import { createRiver } from './sanlorenzo.js';
import { createWharf } from './wharf.js';
import { createSwings, createTilt, createFlume, buildBackRow } from './rides/scenery.js';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { crowd, ZONE, kidsAbout } from '../people/flow.js';

// the park's extent in its own frame, and how far the ground is reshaped round it
const PARK = { u0: -272, u1: 342, v0: -176, v1: 4 };
const GROUND = { u0: -365, u1: 470, v0: -200, v1: 270 };
const NEAR = 2000, FAR = 2600;
// the shoreline: out from the promenade, narrower toward the wharf
const shoreV = (u) => 118 - 48 * smooth(-247, -442, u) + 6 * Math.sin((u + 97) / 90);
// the San Lorenzo's mouth, just east of the Dipper (sanlorenzo.js carves the river itself)
const RIVER_U = 446;
function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
// the ground as built: the midway level, sand down to the surf, Seabright's low bluff
// across the river
function groundY(u, v) {
	if (v < 4 && u > PARK.u0 && u < PARK.u1) return DECK;
	let y;
	if (v < 4) y = DECK - 0.6;
	else { const s = shoreV(u); y = v < s ? 2.3 - 2.3 * (v - 4) / (s - 4) : -(v - s) * 0.05; }
	y += (8 - y) * smooth(RIVER_U + 50, RIVER_U + 95, u) * smooth(50, 5, v);
	return y;
}
// the parking lots: the big one across Beach Street from the Casino, and the River Lot in
// the river's bend behind the Dipper
const LOTS = [
	[[-250, -201], [-40, -201], [-40, -292], [-250, -292]],
	[[150, -200], [436, -200], [436, -475], [250, -475], [150, -330]],
];
function inPoly(P, u, v) {
	let inside = false;
	for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > v) !== (P[j][1] > v) && u < (P[j][0] - P[i][0]) * (v - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) inside = !inside;
	return inside;
}
// the beach train's line along Beach Street, over the trestle (t0..t1, set once the river
// is carved) and on toward Seabright
const RAIL = { u0: -470, u1: 560, v: -171.5, t0: 405, t1: 495 };
const railY = (u) => DECK + 0.1 + 2.0 * smooth(RAIL.t0 - 40, RAIL.t0, u) * (1 - smooth(RAIL.t1, RAIL.t1 + 40, u));
// inside the park (for the trees the city plants to keep off)
export function inBoardwalk(x, z) { const [u, v] = toL(x, z); return (u > GROUND.u0 && u < GROUND.u1 && v > GROUND.v0 - 12 && v < 60) || LOTS.some((P) => inPoly(P, u, v)); }

// ---------- the survey's heights regraded ----------
function regrade(bay, BU) {
	const L = bay.levels?.[0], tex = BU?.uB0?.value;
	if (!L || !tex?.image?.data || tex.image.width !== L.W) return false;
	const D = tex.image.data;
	const cs = [[GROUND.u0 - 120, GROUND.v0 - 120], [GROUND.u1 + 120, GROUND.v0 - 120], [GROUND.u0 - 120, GROUND.v1 + 120], [GROUND.u1 + 120, GROUND.v1 + 120]].map(([u, v]) => toW(u, v));
	const xs = cs.map((c) => c[0]), zs = cs.map((c) => c[1]);
	const i0 = Math.max(0, Math.floor((Math.min(...xs) - L.x0) / L.step)), i1 = Math.min(L.W - 1, Math.ceil((Math.max(...xs) - L.x0) / L.step));
	const j0 = Math.max(0, Math.floor((Math.min(...zs) - L.zN) / L.step)), j1 = Math.min(L.H - 1, Math.ceil((Math.max(...zs) - L.zN) / L.step));
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
		const [u, v] = toL(L.x0 + i * L.step, L.zN + j * L.step);
		const w = smooth(GROUND.u0 - 100, GROUND.u0, u) * smooth(GROUND.u1 + 100, GROUND.u1, u) * smooth(GROUND.v0 - 90, GROUND.v0, v) * smooth(GROUND.v1 + 140, GROUND.v1, v);
		if (w <= 0) continue;
		const k = j * L.W + i, h0 = L.v[k] / H_SCALE - H_OFF;
		// (under what is built, kept below it; the sea floor shelving off)
		const t = Math.min(groundY(u, v) - 0.7, v > shoreV(u) ? -1 - (v - shoreV(u)) * 0.045 : 99);
		const h = h0 + (t - h0) * w;
		L.v[k] = Math.round((h + H_OFF) * H_SCALE);
		D[k] = THREE.DataUtils.toHalfFloat(h);
	}
	// out past the surf, the survey's sandbar (the old wharf's ghost, a few hundred metres off
	// the beach) let down under the sea
	const ss = [[-600, 60], [660, 60], [-600, 950], [660, 950]].map(([u, v]) => toW(u, v));
	const si0 = Math.max(0, Math.floor((Math.min(...ss.map((c) => c[0])) - L.x0) / L.step)), si1 = Math.min(L.W - 1, Math.ceil((Math.max(...ss.map((c) => c[0])) - L.x0) / L.step));
	const sj0 = Math.max(0, Math.floor((Math.min(...ss.map((c) => c[1])) - L.zN) / L.step)), sj1 = Math.min(L.H - 1, Math.ceil((Math.max(...ss.map((c) => c[1])) - L.zN) / L.step));
	for (let j = sj0; j <= sj1; j++) for (let i = si0; i <= si1; i++) {
		const [u, v] = toL(L.x0 + i * L.step, L.zN + j * L.step), sv = shoreV(u);
		const w = smooth(-600, -540, u) * smooth(660, 600, u) * smooth(sv + 15, sv + 45, v) * smooth(950, 900, v);
		if (w <= 0) continue;
		const k = j * L.W + i, h0 = L.v[k] / H_SCALE - H_OFF, t = -1 - (v - sv) * 0.045;
		if (h0 <= t) continue;
		const h = h0 + (t - h0) * w;
		L.v[k] = Math.round((h + H_OFF) * H_SCALE);
		D[k] = THREE.DataUtils.toHalfFloat(h);
	}
	tex.needsUpdate = true;
	return true;
}

// ---------- textures ----------
function grainTexture(base, speck, n, lines = 0) {
	const cv = document.createElement('canvas'); cv.width = cv.height = 256;
	const g = cv.getContext('2d');
	g.fillStyle = base; g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < n; i++) { g.fillStyle = speck[i % speck.length]; g.globalAlpha = 0.06 + Math.random() * 0.1; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
	g.globalAlpha = 0.5;
	if (lines) { g.strokeStyle = 'rgba(60,55,50,0.55)'; g.lineWidth = 1.5; for (let x = 0; x <= 256; x += 256 / lines) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(256, x); g.stroke(); } }
	const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
function stripeTexture(a, b, n = 8) {
	const cv = document.createElement('canvas'); cv.width = 128; cv.height = 32;
	const g = cv.getContext('2d');
	for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 128 / n, 0, 128 / n, 32); }
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}

// ---------- the ride icons (line drawings on the games' 24-unit grid) ----------
const RIDE_ICONS = {
	coaster: '<path d="M2 20c3-11 6-15 8-15s3 6 5 6 3-4 7-6"/><path d="M4 20V14M8 20V8M12 20v-9M16 20v-6M20 20V8"/><path d="M2 20h20"/>',
	wheel: '<circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="1.3"/><path d="M12 3v14M5 10h14M7 5l10 10M17 5 7 15"/><path d="M8 21l4-9 4 9M6.5 21h11"/>',
	bumper: '<rect x="3" y="10" width="18" height="8" rx="4"/><path d="M8 10V7a2 2 0 0 1 2-2h4"/><path d="M15 3v7"/><path d="M13 3h4"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/>',
	carousel: '<path d="M3 8l9-5 9 5z"/><path d="M4 8h16"/><path d="M6 8v12M12 8v12M18 8v12"/><path d="M9 14c1-1.5 2.5-2 4-1.5l1.5-1.5M9 14l.5 2M13 12.5l-.5 3.5"/><path d="M3 20h18"/>',
	glider: '<path d="M2 6c7 3 13 3 20 0"/><path d="M9 7.5V13M15 7.5V13"/><path d="M6.5 13h5v3h-5zM12.5 13h5v3h-5z"/><path d="M6.5 16v2M17.5 16v2"/>',
	drop: '<path d="M12 2v20"/><path d="M9 21h6"/><path d="M7 8h10v4H7z"/><path d="M8 14l-1 3M16 14l1 3"/><path d="M10 2h4"/>',
};
const rideIcon = (id, size = 20) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:inline-block;vertical-align:middle;flex:none">${RIDE_ICONS[id] || ''}</svg>`;

export function createBoardwalk(scene, bay, shared, { isPhone = false, mount, hint, camera, player } = {}) {
	const group = new THREE.Group();
	group.name = 'boardwalk';
	group.position.set(FRAME.x, 0, FRAME.z);
	group.rotation.y = FRAME.a;
	group.visible = false;
	scene.add(group);
	group.updateMatrixWorld(true);
	const sound = createSound();
	const river = createRiver(scene, bay, shared, { isPhone, sound });
	const B = { town: [], built: false, standSigns: [], queue: null, rides: [], scen: [], solids: [], rounds: [], lamps: null, pools: null, winMats: [], signs: [], flags: null, crowd: null, beach: null, wharf: null };
	let regraded = false, hintSeen = false, hintWharf = false, hintRiver = false, sinceGrade = 0;
	const uTime = { value: 0 };

	// ---------- the pieces, built one a frame ----------
	function plan() {
		const Q = [];
		// where the railroad meets the river: the trestle's ends
		const [rx, rz] = toW(RAIL.u0, RAIL.v), [ex, ez] = toW(RAIL.u0 + 1, RAIL.v), cr = river.crossing(rx, rz, ex - rx, ez - rz);
		if (cr) { const uc = RAIL.u0 + cr.t; RAIL.t0 = uc - cr.w - 14; RAIL.t1 = uc + cr.w + 20; }
		Q.push(buildGround, buildSeawall, buildCasino, buildCasinoSigns, buildNeptune, buildStands, ...[0, 8, 16].map((k) => () => buildStandSigns(k, k + 8)), buildLamps, buildBeach, buildBackdrop, ...[false, true].flatMap((e) => [() => buildTown(e, -214, -850), () => buildTown(e, -850, -1500)]));
		B.wharf = createWharf({ group, bay, sound, isPhone, signs: B.signs, winMats: B.winMats });
		Q.push(...B.wharf.steps);
		const add = (make) => Q.push(() => { const r = make(); B.rides.push(r); if (r.later) B.queue.unshift(...r.later); for (const s of r.solid || []) B.solids.push([...s, 30]); for (const c of r.round || []) B.rounds.push(c); });
		add(() => createCarousel({ group, sound, isPhone, at: [-128, -34] }));
		add(() => createWheel({ group, sound, isPhone, at: [22, -66] }));
		add(() => createBumper({ group, sound, isPhone, at: [78, -58] }));
		add(() => createDrop({ group, sound, isPhone, at: [138, -60] }));
		add(() => createGlider({ group, sound, isPhone, from: [-46, 11.5], to: [186] }));
		add(() => createDipper({ group, sound, isPhone }));
		// the rest of the midway: to look at and listen to
		const see = (id, make) => Q.push(() => { const r = make(); r.id = id; B.scen.push(r); for (const q of r.solid || []) B.solids.push([...q, 30]); for (const c of r.round || []) B.rounds.push(c); });
		see('swings', () => createSwings({ group, isPhone, at: [-24, -104] }));
		see('tilt', () => createTilt({ group, isPhone, at: [55, -112] }));
		see('flume', () => createFlume({ group, isPhone, sound }));
		Q.push(() => { const bk = buildBackRow({ group, isPhone }); for (const q of bk.solid) B.solids.push([...q, 30]); B.signs.push(...bk.signs); B.foodSeats = bk.seats; }, buildLot, buildTrain);
		Q.push(buildCrowd, () => { B.built = true; group.visible = true; });
		return Q;
	}

	// the midway's level: one slab, paved, with the promenade's warmer band along the front
	function buildGround() {
		const tex = grainTexture('#b8b0a2', ['#8f887d', '#d6cfc2', '#6d665c'], 2600, 2);
		tex.repeat.set((PARK.u1 - PARK.u0) / 4, (PARK.v1 - PARK.v0) / 4);
		const slab = new THREE.Mesh(new THREE.BoxGeometry(PARK.u1 - PARK.u0, 1.4, PARK.v1 - PARK.v0), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
		slab.position.set((PARK.u0 + PARK.u1) / 2, DECK - 0.7, (PARK.v0 + PARK.v1) / 2);
		slab.receiveShadow = true;
		group.add(slab);
		// the promenade: a band of warmer concrete, scored every metre and a half
		const pt = grainTexture('#cbbfa8', ['#a89a82', '#e2d8c4'], 1800, 4);
		pt.repeat.set((PARK.u1 - PARK.u0) / 6, 2);
		const prom = new THREE.Mesh(new THREE.PlaneGeometry(PARK.u1 - PARK.u0, 11), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 }));
		prom.rotation.x = -Math.PI / 2; prom.position.set((PARK.u0 + PARK.u1) / 2, DECK + 0.015, -1.5);
		prom.receiveShadow = true;
		group.add(prom);
		// Beach Street behind, from the wharf to the levee
		const Mg = merger();
		const road = grainTexture('#3f3f41', ['#2a2a2b', '#59595b'], 2400);
		road.repeat.set(200, 3);
		const st = [];
		for (let u = -520; u <= 400; u += 10) st.push(u);
		const pos = [], uv = [], idx = [];
		st.forEach((u, i) => {
			for (const [k, v] of [[0, -178], [1, -192]]) { const [x, z] = toW(u, v); const y = Math.max(DECK - 0.4, bay.heightAt(x, z)) + 0.12; pos.push(u, y, v); uv.push(u / 10, k); }
			if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
		});
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
		const rm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: road, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }));
		rm.receiveShadow = true;
		group.add(rm);
		// the railroad along it (the beach train's line), up onto the trestle over the river
		// and on to the far bank
		const RL = RAIL;
		const ties = instancer(new THREE.BoxGeometry(0.25, 0.15, 2.6), paint('darkwood'));
		for (let u = RL.u0; u < RL.u1; u += 0.7) ties.at(u, railY(u) + 0.07, RL.v);
		ties.done(group);
		for (let u = RL.u0; u < RL.u1; u += 8) for (const dv of [-0.72, 0.72]) Mg.rod([u, railY(u) + 0.2, RL.v + dv], [u + 8, railY(u + 8) + 0.2, RL.v + dv], 0.06, 'steel', 4);
		// (a bank of ballast up to the trestle's ends)
		for (let u = RL.t0 - 44; u < RL.t1 + 44; u += 4) { if (u > RL.t0 && u < RL.t1) continue; const y = railY(u); if (y > DECK + 0.3) Mg.box(4.2, y - DECK + 0.4, 3.6, 'concrete', u + 2, (y + DECK) / 2 - 0.2, RL.v); }
		// the trestle: timber bents in the water, the deck, the steel spans' sides, the
		// footwalk along its seaward side
		for (let u = RL.t0; u <= RL.t1; u += 5) {
			const [x, z] = toW(u, RL.v), gy = Math.min(bay.heightAt(x, z), 1) - 1, top = railY(u) - 0.3;
			for (const dv of [-2.6, -0.9, 0.9, 2.6]) Mg.box(0.42, top - gy, 0.42, 'darkwood', u, (top + gy) / 2, RL.v + dv);
			Mg.box(0.4, 0.4, 6.6, 'darkwood', u, top - 0.2, RL.v);
			Mg.rod([u, gy + 1, RL.v - 2.6], [u, top - 0.5, RL.v + 2.6], 0.1, 'darkwood').rod([u, gy + 1, RL.v + 2.6], [u, top - 0.5, RL.v - 2.6], 0.1, 'darkwood');
		}
		const tm = (RL.t0 + RL.t1) / 2, tl = RL.t1 - RL.t0 + 4;
		Mg.box(tl, 0.5, 3.4, 'darkwood', tm, railY(tm) - 0.05, RL.v);
		for (const dv of [-1.9, 1.9]) Mg.box(tl, 1.4, 0.3, 'darksteel', tm, railY(tm) - 0.4, RL.v + dv);
		Mg.box(tl, 0.12, 2.2, 'plank', tm, railY(tm) + 0.1, RL.v + 3.3);
		for (let u = RL.t0 - 2; u <= RL.t1 + 2; u += 2.5) Mg.box(0.08, 1.1, 0.08, 'darksteel', u, railY(tm) + 0.65, RL.v + 4.35);
		Mg.box(tl, 0.06, 0.08, 'darksteel', tm, railY(tm) + 1.2, RL.v + 4.35);
		Mg.done(group, { shadow: !isPhone });
	}
	// the seawall between the promenade and the sand: its face, the rail, steps down at intervals
	function buildSeawall() {
		const Mg = merger();
		Mg.box(PARK.u1 - PARK.u0, 1.6, 0.6, 'concrete', (PARK.u0 + PARK.u1) / 2, DECK - 0.5, 4.3);
		for (let u = PARK.u0 + 20; u < PARK.u1 - 10; u += 58) {
			for (let k = 0; k < 4; k++) Mg.box(4, 0.18 * (4 - k), 0.35, 'concrete', u, DECK - 0.1 - k * 0.18, 4.75 + k * 0.35);
		}
		// the rail: posts and two runs, gaps at the steps
		for (let u = PARK.u0 + 1; u < PARK.u1; u += 2.5) {
			if (Math.abs(((u - PARK.u0 - 20) % 58 + 58) % 58) < 2.6 || Math.abs(((u - PARK.u0 - 20) % 58 + 58) % 58 - 58) < 2.6) continue;
			Mg.box(0.08, 1.05, 0.08, 'white', u, DECK + 0.52, 3.9);
		}
		Mg.box(PARK.u1 - PARK.u0, 0.07, 0.1, 'white', (PARK.u0 + PARK.u1) / 2, DECK + 1.05, 3.9).box(PARK.u1 - PARK.u0, 0.05, 0.06, 'white', (PARK.u0 + PARK.u1) / 2, DECK + 0.55, 3.9);
		Mg.done(group, { shadow: false });
		for (let u = PARK.u0 + 12; u < PARK.u1; u += 29) B.solids.push([u - 0.95, 2.1, u + 0.95, 2.8, 0.6]);
		// benches facing the sea
		const Bn = merger();
		for (let u = PARK.u0 + 12; u < PARK.u1; u += 29) { Bn.box(1.8, 0.08, 0.5, 'plank', u, DECK + 0.46, 2.5).box(1.8, 0.45, 0.06, 'plank', u, DECK + 0.72, 2.25); for (const d of [-0.8, 0.8]) Bn.box(0.08, 0.46, 0.5, 'darksteel', u + d, DECK + 0.23, 2.5); }
		Bn.done(group, { shadow: !isPhone });
	}

	// ---------- the Casino and the Cocoanut Grove ----------
	// a wall with a run of round-headed arches cut through it, standing in the u-y plane
	function archWall(len, h, thick, n, aw, ah, sill) {
		const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(len, 0), new THREE.Vector2(len, h), new THREE.Vector2(0, h)]);
		const pitch = len / n, r = aw / 2;
		for (let i = 0; i < n; i++) {
			const xc = pitch * (i + 0.5), p = new THREE.Path();
			p.moveTo(xc - r, sill); p.lineTo(xc + r, sill); p.lineTo(xc + r, sill + ah - r); p.absarc(xc, sill + ah - r, r, 0, Math.PI, false); p.lineTo(xc - r, sill);
			s.holes.push(p);
		}
		return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 10 });
	}
	const glow = (col, k = 0) => { const m = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.15, metalness: 0.3, emissive: col, emissiveIntensity: k }); B.winMats.push(m); return m; };
	// a tower with its dome and lantern
	function tower(Mg, u, v, w, h, domeKey = 'tile') {
		Mg.box(w, h, w, 'stucco', u, DECK + h / 2, v);
		Mg.box(w + 0.5, 0.5, w + 0.5, 'trim', u, DECK + h + 0.25, v);
		Mg.geo(new THREE.CylinderGeometry(w * 0.42, w * 0.46, 1.6, 8), 'stucco', u, DECK + h + 1.3, v);
		Mg.geo(new THREE.SphereGeometry(w * 0.46, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeKey, u, DECK + h + 2.1, v);
		Mg.cyl(0.25, 0.3, 1.2, 'trim', u, DECK + h + 2.1 + w * 0.46 + 0.5, v, 8);
		Mg.cyl(0.03, 0.03, 3, 'darksteel', u, DECK + h + 4.4, v, 4);
		for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; Mg.geo(archWall(w * 0.5, 2.2, 0.2, 1, w * 0.3, 1.8, 0.2), 'stucco', u + Math.sin(a) * (w / 2 + 0.01) - Math.cos(a) * w * 0.25, DECK + h - 3, v + Math.cos(a) * (w / 2 + 0.01) + Math.sin(a) * w * 0.25, 0, a); }
	}
	function buildCasino() {
		const Mg = merger(), lights = bulbs();
		const u0 = -266, u1 = -150, front = -4.5, back = -64;
		// the loggia along the beach: two tiers of arches, the shops and arcade behind
		const n = 26, len = u1 - u0;
		Mg.geo(archWall(len, 5.6, 0.7, n, 3.0, 4.2, 0), 'stucco', u0, DECK, front - 0.7);
		Mg.geo(archWall(len, 5.2, 0.5, n, 2.0, 3.0, 1.0), 'stucco', u0, DECK + 5.6, front - 3.2);
		Mg.box(len, 0.4, 3.4, 'trim', (u0 + u1) / 2, DECK + 5.6, front - 1.9);
		Mg.box(len + 1, 0.6, 1.0, 'trim', (u0 + u1) / 2, DECK + 5.9, front - 0.3);
		// the balcony rail over the loggia
		for (let u = u0 + 0.5; u < u1; u += 0.5) Mg.box(0.08, 0.8, 0.08, 'trim', u, DECK + 6.6, front - 0.2);
		Mg.box(len, 0.12, 0.2, 'trim', (u0 + u1) / 2, DECK + 7.0, front - 0.2);
		// the body of the building behind, its roof of red tile
		Mg.box(len, 10.8, back - (front - 3.5), 'stucco', (u0 + u1) / 2, DECK + 5.4, (back + front - 3.5) / 2);
		const roofW = front - 3.5 - back;
		for (const sg of [-1, 1]) Mg.box(len, 0.3, roofW / 2 / Math.cos(0.13) + 0.8, 'tile', (u0 + u1) / 2, DECK + 11.0 + Math.tan(0.13) * roofW / 4, (back + front - 3.5) / 2 + sg * roofW / 4, sg * -0.13, 0, 0);
		// the parapet along the front, hiding the roof's foot
		Mg.box(len, 1.3, 0.5, 'stucco', (u0 + u1) / 2, DECK + 11.4, front - 3.6);
		// the Cocoanut Grove's Sun Room: its glass roof over the ballroom at the west end
		Mg.box(34, 2.4, 20, 'white', -236, DECK + 12.2, -32);
		const glass = new THREE.Mesh(new THREE.BoxGeometry(33, 0.3, 19), glow(0xffe4b0));
		glass.position.set(-236, DECK + 13.5, -32);
		group.add(glass);
		// the towers: the corners and the middle, each under its dome
		tower(Mg, u0 + 3.5, front - 4, 7, 15);
		tower(Mg, -206, front - 4, 6, 13.5, 'teal');
		tower(Mg, u1 - 3.5, front - 4, 7, 15);
		// the back wall of the loggia: doors and shop windows, lit at night
		const win = new THREE.Mesh(new THREE.PlaneGeometry(len - 2, 3.4), glow(0xffd9a0));
		win.position.set((u0 + u1) / 2, DECK + 1.9, front - 3.45);
		group.add(win);
		const win2 = new THREE.Mesh(new THREE.PlaneGeometry(len - 2, 2.9), glow(0xffe8c0));
		win2.position.set((u0 + u1) / 2, DECK + 7.5, front - 3.75);
		group.add(win2);
		Mg.box(len, 0.2, 3.2, 'concrete', (u0 + u1) / 2, DECK + 0.02, front - 2);
		// the arches in bulbs, the roofline too
		const pitch = len / n;
		for (let i = 0; i < n; i++) { const xc = u0 + pitch * (i + 0.5); for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; lights.add(xc + Math.cos(a) * 1.65, DECK + 2.7 + Math.sin(a) * 1.65, front + 0.08); } }
		for (let u = u0; u <= u1; u += 0.7) lights.add(u, DECK + 7.15, front + 0.05);
		for (let u = u0; u <= u1; u += 0.7) lights.add(u, DECK + 10.9, front - 3.6);
		Mg.done(group, { shadow: !isPhone });
		lights.done(group, 0.9);
		B.solids.push([u0, back, u1, front - 3.4, 30], [u0, front - 4.2, u0 + 7, front, 30], [u1 - 7, front - 4.2, u1, front, 30]);
		// the loggia's piers
		for (let i = 0; i <= n; i++) B.solids.push([u0 + i * pitch - 0.45, front - 0.75, u0 + i * pitch + 0.45, front, 5]);
	}
	// its signs (a piece of their own: drawing them takes a while)
	function buildCasinoSigns() {
		const front = -4.5;
		const s1 = signBoard('COCOANUT GROVE', 13, 1.5, { bg: '#1f5c4a', fg: '#fff3d0', border: '#d4a93a', glow: 0.25 });
		s1.position.set(-236, DECK + 9.1, front - 3.4);
		const s2 = signBoard('CASINO', 7, 1.4, { bg: '#b3202a', fg: '#fff3d0', border: '#f2c230', glow: 0.25 });
		s2.position.set(-178, DECK + 9.1, front - 3.4);
		const s3 = signBoard('SANTA CRUZ BEACH BOARDWALK', 26, 2.2, { w: 2048, h: 180, bg: '#fff6dc', fg: '#b3202a', border: '#b3202a', font: 'bold 150px Georgia, serif', glow: 0.3 });
		s3.position.set(-194, DECK + 13.4, front - 3.2);
		group.add(s1, s2, s3);
		B.signs.push(s1, s2, s3);
	}
	// Neptune's Kingdom: the old plunge, a vaulted hall with one great arched window to the sea
	function buildNeptune() {
		const Mg = merger();
		const u0 = -108, u1 = -60, v0 = -62, v1 = -7, w = u1 - u0;
		Mg.box(w, 9, v1 - v0, 'stuccoPink', (u0 + u1) / 2, DECK + 4.5, (v0 + v1) / 2);
		const vault = new THREE.CylinderGeometry(w / 2, w / 2, v1 - v0, 24, 1, false, -Math.PI / 2, Math.PI);
		vault.rotateX(Math.PI / 2); vault.rotateZ(0); vault.scale(1, 0.32, 1);
		Mg.geo(vault, 'tile', (u0 + u1) / 2, DECK + 9, (v0 + v1) / 2);
		Mg.geo(archWall(w, 9, 0.6, 1, 22, 8.2, 0.4), 'trim', u0, DECK, v1);
		Mg.geo(archWall(w * 0.8, 3.2, 0.5, 5, 3, 2.6, 0.3), 'stuccoPink', u0 + w * 0.1, DECK + 9, v1 - 0.2);
		Mg.done(group, { shadow: !isPhone });
		const win = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), glow(0x9fd8ff));
		win.position.set((u0 + u1) / 2, DECK + 4.4, v1 + 0.2);
		group.add(win);
		const s = signBoard('NEPTUNE\'S KINGDOM', 16, 1.6, { bg: '#1e3c8c', fg: '#ffe9a0', border: '#8fd0e0', glow: 0.25 });
		s.position.set((u0 + u1) / 2, DECK + 10.7, v1 + 0.7);
		group.add(s); B.signs.push(s);
		B.solids.push([u0, v0, u1, v1 + 0.6, 30]);
	}
	// the midway's stands along the back of the promenade: food, games, prizes
	function buildStands() {
		const Mg = merger(), lights = bulbs();
		const FOOD = ['CORN DOGS', 'SALT WATER TAFFY', 'CHURROS', 'GARLIC FRIES', 'LEMONADE', 'COTTON CANDY', 'FUNNEL CAKES', 'ICE CREAM', 'CLAM CHOWDER', 'DEEP FRIED ARTICHOKES', 'PIZZA', 'KETTLE CORN'];
		const GAMES = ['RING TOSS', 'WATER RACE', 'BALLOON DARTS', 'SKEE ROLL', 'HOOP SHOT', 'DUCK POND'];
		const AW = [['#c8323a', '#f4f1ea'], ['#2656a8', '#f4f1ea'], ['#e8a030', '#f4f1ea'], ['#2e8b57', '#f4f1ea'], ['#7a3c9a', '#f4f1ea']];
		const awMats = AW.map(([a, b]) => new THREE.MeshStandardMaterial({ map: stripeTexture(a, b), roughness: 0.8, side: THREE.DoubleSide }));
		const r = rng(77);
		let fi = 0, gi = 0;
		// (between the rides' gates, in runs)
		const runs = [[-44, -12], [-6, 14], [32, 60], [98, 124], [150, 196]];
		const prizes = instancer(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
		const pc = [0xe85aa0, 0x2a64c8, 0xf2c230, 0x8a3cc0, 0x2e9b57, 0xd8262e, 0xffffff];
		for (const [a, b] of runs) for (let u = a + 3; u + 3 <= b; u += 7) {
			const food = r() < 0.55, name = food ? FOOD[fi++ % FOOD.length] : GAMES[gi++ % GAMES.length];
			const v = -16, w = 6, d = 4.2, h = 3.2;
			Mg.box(w, h, d, food ? 'cream' : 'white', u, DECK + h / 2, v - d / 2);
			Mg.box(w - 0.6, 1.0, 0.3, food ? 'plank' : 'red', u, DECK + 0.5, v + 0.15);
			// the awning, striped, over the counter
			const aw = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, 1.6), awMats[Math.floor(r() * awMats.length)]);
			aw.position.set(u, DECK + h - 0.35, v + 0.7); aw.rotation.x = -1.0;
			group.add(aw);
			B.standSigns.push([name, food, u, v, w, h]);
			for (let k = 0; k <= 12; k++) lights.add(u - w / 2 + k * w / 12, DECK + h + 1.0, v + 0.1);
			if (!food) for (let k = 0; k < 14; k++) prizes.at(u - w / 2 + 0.5 + (k % 7) * 0.8, DECK + 1.9 + Math.floor(k / 7) * 0.5, v - 0.35, 1, 1, 1, 0, new THREE.Color(pc[Math.floor(r() * pc.length)]));
			B.solids.push([u - w / 2, v - d, u + w / 2, v + 0.35, h]);
		}
		// the midway's walk: a band of red brick between the stands and the rides
		{
			const cv = document.createElement('canvas'); cv.width = cv.height = 128;
			const g = cv.getContext('2d');
			g.fillStyle = '#7d3a2c'; g.fillRect(0, 0, 128, 128);
			for (let y = 0; y < 128; y += 16) for (let x = (y / 16) % 2 * 16; x < 160; x += 32) { g.fillStyle = `hsl(${8 + Math.random() * 10},${40 + Math.random() * 15}%,${30 + Math.random() * 10}%)`; g.fillRect(x - 16 + 1, y + 1, 30, 14); }
			const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(250 / 2, 8 / 2); t.colorSpace = THREE.SRGBColorSpace;
			const walk = new THREE.Mesh(new THREE.PlaneGeometry(250, 8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
			walk.rotation.x = -Math.PI / 2; walk.position.set(72, DECK + 0.02, -31); walk.receiveShadow = true;
			group.add(walk);
		}
		// carts under umbrellas out on the plaza, planters, bins
		const um = instancer(new THREE.ConeGeometry(1.5, 0.6, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
		for (const [u, v] of [[-36, -26], [4, -38], [40, -24], [112, -36], [168, -26], [-230, -12], [-190, -12], [150, -40], [190, -44]]) {
			Mg.box(1.8, 1.0, 1.0, r() < 0.5 ? 'red' : 'blue', u, DECK + 0.6, v).box(1.9, 0.08, 1.1, 'white', u, DECK + 1.12, v).cyl(0.03, 0.03, 2.4, 'white', u, DECK + 1.9, v, 5);
			for (const d of [-0.6, 0.6]) Mg.cyl(0.18, 0.18, 0.06, 'black', u + d, DECK + 0.18, v + 0.52, 8, Math.PI / 2);
			um.at(u, DECK + 3.1, v, 1, 1, 1, 0, new THREE.Color([0xd8262e, 0xf2c230, 0x2a64c8, 0x2e9b57][Math.floor(r() * 4)]));
			B.solids.push([u - 1, v - 0.6, u + 1, v + 0.6, 2]);
		}
		um.done(group);
		for (let u = -40; u < 196; u += 26) {
			Mg.cyl(0.9, 1.0, 0.6, 'concrete', u + 8, DECK + 0.3, -21.5, 12).cyl(0.85, 0.85, 0.1, 'darkwood', u + 8, DECK + 0.62, -21.5, 12);
			Mg.cyl(0.28, 0.28, 0.9, 'green', u + 14, DECK + 0.45, -19.5, 10);
			B.rounds.push([u + 8, -21.5, 1.0]);
		}
		Mg.done(group, { shadow: !isPhone });
		prizes.done(group);
		lights.done(group, 0.8);
		// bushes in the planters
		const bush = instancer(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x3f6a2c, roughness: 0.9, flatShading: true }));
		for (let u = -40; u < 196; u += 26) bush.at(u + 8, DECK + 1.15, -21.5, 1, 0.8, 1);
		bush.done(group);
		// flagpoles along the seawall and on the towers, the flags waving
		const flagM = new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.8, side: THREE.DoubleSide });
		flagM.onBeforeCompile = (sh) => {
			sh.uniforms.uT = uTime;
			sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fw = uv.x; transformed.z += sin(uv.x * 7.0 - uT * 6.0 + position.y * 0.3 + instanceMatrix[3].x * 0.7) * 0.14 * fw; transformed.y -= fw * fw * 0.08;');
		};
		const flagG = new THREE.PlaneGeometry(1.5, 0.95, 8, 2); flagG.translate(0.75, 0, 0);
		const fl = instancer(flagG, flagM), poles = merger();
		for (let u = PARK.u0 + 6; u < PARK.u1; u += 21) { poles.cyl(0.05, 0.06, 7, 'white', u, DECK + 3.5, 3.6, 6); fl.at(u + 0.05, DECK + 6.4, 3.6, 1, 1, 1, 0.25); }
		for (const u of [-262.5, -206, -153.5]) fl.at(u, DECK + 21.5 - (u === -206 ? 1.5 : 0), -8.5, 1.2, 1.2, 1, 0.25);
		poles.done(group, { shadow: false });
		B.flags = fl.done(group);
	}
	// the stands' signs, some at a time (each one drawn on its own canvas)
	function buildStandSigns(a, b) {
		for (const [name, food, u, v, w, h] of B.standSigns.slice(a, b)) {
			const s = signBoard(name, w - 0.4, 0.8, { w: 768, h: 128, bg: food ? '#fff6dc' : '#1e3c8c', fg: food ? '#b3202a' : '#ffe066', border: food ? '#b3202a' : '#ffffff', font: 'bold 84px Georgia, serif', glow: 0.35 });
			s.position.set(u, DECK + h + 0.5, v + 0.05);
			group.add(s); B.signs.push(s);
		}
	}
	function flagTexture() {
		// the stars and stripes, and the Boardwalk's own pennant
		const cv = document.createElement('canvas'); cv.width = 190; cv.height = 100;
		const g = cv.getContext('2d');
		for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, i * 100 / 13, 190, 100 / 13 + 1); }
		g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 76, 54);
		g.fillStyle = '#fff'; for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) g.fillRect(5 + i * 12 + (j % 2) * 6, 5 + j * 10, 2, 2);
		const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
		return t;
	}
	// lamps along the promenade: iron posts, a pair of globes; at night a pool of light under each
	function buildLamps() {
		const Mg = merger();
		const L = [];
		for (let u = PARK.u0 + 4; u < PARK.u1; u += 14.5) L.push([u, 2.6]);
		for (let u = -40; u < 200; u += 19) L.push([u, -19.5]);
		for (const [u, v] of L) {
			Mg.cyl(0.07, 0.11, 4.2, 'black', u, DECK + 2.1, v, 8);
			Mg.box(1.1, 0.06, 0.06, 'black', u, DECK + 4.1, v);
		}
		Mg.done(group, { shadow: false });
		const gm = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe2a8, emissiveIntensity: 0.1, roughness: 0.3 });
		B.globe = gm;
		const globes = instancer(new THREE.SphereGeometry(0.2, 10, 8), gm);
		for (const [u, v] of L) { globes.at(u - 0.5, DECK + 4.35, v); globes.at(u + 0.5, DECK + 4.35, v); }
		globes.done(group);
		// the pools: a soft disc on the ground under each lamp, drawn only at night
		const cv = document.createElement('canvas'); cv.width = cv.height = 64;
		const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.6, 'rgba(255,190,120,0.3)'); gr.addColorStop(1, 'rgba(255,180,110,0)');
		g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
		const pm = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
		const pools = instancer(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), pm);
		for (const [u, v] of L) pools.at(u, DECK + 0.03, v);
		B.pools = pools.done(group);
		B.poolMat = pm;
	}
	// the sand as built: the beach, but the river's channel where it runs out across it
	function beachY(u, v, x, z, th = bay.heightAt(x, z)) {
		const y = Math.max(groundY(u, v), th + 0.1);
		return y + (th + 0.08 - y) * river.influence(x, z);
	}
	// the beach: sand from the seawall to the surf and on under it, the river running out
	// across it, the umbrellas and towels, the lifeguard tower, the volleyball nets
	function buildBeach() {
		const NU = isPhone ? 90 : 140, NV = isPhone ? 50 : 80;
		const pos = [], col = [], uv = [], idx = [];
		const dry = new THREE.Color(0xd8c7a0), wet = new THREE.Color(0x9c8a6a), deep = new THREE.Color(0x6d6048), c = new THREE.Color();
		for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
			const u = GROUND.u0 + (GROUND.u1 - GROUND.u0) * i / NU, v = GROUND.v0 + (GROUND.v1 - GROUND.v0) * j / NV;
			const [x, z] = toW(u, v), th = bay.heightAt(x, z);
			// (at its edges it comes down onto the survey's ground)
			const edge = Math.max(1 - Math.min(i, NU - i) / 5, 1 - Math.min(j, NV - j) / 5, 0);
			let y = beachY(u, v, x, z, th);
			if (v < 4 && u > PARK.u0 + 2 && u < PARK.u1 - 2) y = DECK - 0.6;
			y += (th + 0.05 - y) * Math.min(1, edge * edge);
			pos.push(u, y, v); uv.push(u / 3, v / 3);
			const k = smooth(0.2, 1.4, y);
			c.copy(deep).lerp(wet, smooth(-1.2, 0.3, y)).lerp(dry, k);
			col.push(c.r, c.g, c.b);
		}
		for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i; idx.push(a, a + NU + 1, a + 1, a + 1, a + NU + 1, a + NU + 2); }
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		g.setIndex(idx); g.computeVertexNormals();
		const tex = grainTexture('#ffffff', ['#8a7a60', '#fff8e8', '#6a5a40'], 5000);
		const sand = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }));
		sand.receiveShadow = true;
		group.add(sand);
		B.sand = { NU, NV, pos };
		// umbrellas, towels, and the people on them
		const r = rng(1907), Mg = merger();
		const umb = instancer(new THREE.ConeGeometry(1.2, 0.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }));
		const stick = instancer(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 5), paint('white'));
		const towel = instancer(new THREE.BoxGeometry(0.9, 0.02, 1.8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
		const UC = [0xd8262e, 0x2a64c8, 0xf2c230, 0x2e9b57, 0xf4f1ea, 0xe8742a, 0x1bb5b5], TC = [0xe85aa0, 0x2a64c8, 0xf2c230, 0x2e9b57, 0xffffff, 0xe8742a, 0x8a3cc0];
		const spots = [];
		for (let k = 0; k < (isPhone ? 90 : 160); k++) {
			const u = -250 + r() * 560, v = 14 + r() * (shoreV(u) - 40);
			const [tx, tz] = toW(u, v);
			if (river.influence(tx, tz) > 0.02) continue;
			const y = groundY(u, v);
			if (r() < 0.45) { umb.at(u, y + 2.1, v, 1, 1, 1, 0, new THREE.Color(UC[Math.floor(r() * UC.length)])); stick.at(u, y + 1.1, v); }
			towel.at(u + 1.2, y + 0.02, v + 0.3, 1, 1, 1, r() * 0.6 - 0.3, new THREE.Color(TC[Math.floor(r() * TC.length)]));
			spots.push([u + 1.2, y, v + 0.3]);
		}
		umb.done(group); stick.done(group); towel.done(group);
		B.towels = spots;
		// the lifeguard tower: a little house on legs, its ramp, the flag
		for (const [u, v] of [[-120, 60], [120, 70], [280, 78]]) {
			const y = groundY(u, v);
			for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Mg.box(0.2, 2.4, 0.2, 'white', u + a * 1.3, y + 1.2, v + b * 1.3);
			Mg.box(3.4, 2.2, 3.4, 'white', u, y + 3.5, v).box(3.8, 0.2, 3.8, 'blue', u, y + 4.7, v).box(3.2, 0.1, 1.2, 'glass', u, y + 3.8, v + 1.71);
			Mg.box(1.0, 0.12, 5, 'plank', u, y + 1.25, v - 4.2, 0.5);
		}
		// volleyball nets on the sand toward the wharf
		for (let k = 0; k < 6; k++) {
			const u = -300 + k * 24, v = 40, y = groundY(u, v);
			Mg.box(0.08, 2.6, 0.08, 'white', u - 4.5, y + 1.3, v).box(0.08, 2.6, 0.08, 'white', u + 4.5, y + 1.3, v).box(9, 0.9, 0.02, 'black', u, y + 2.0, v);
		}
		Mg.done(group, { shadow: !isPhone });
	}
	// the parking: the lot behind the Casino, the big one across Beach Street from it, the
	// River Lot in the bend (the rows by the park full, its far end mostly empty)
	function buildLot() {
		const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
		const g = cv.getContext('2d');
		g.fillStyle = '#48484a'; g.fillRect(0, 0, 256, 256);
		for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(30,30,32,0.3)' : 'rgba(110,110,112,0.2)'; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2); }
		g.fillStyle = '#e8e6de';
		for (let x = 0; x < 256; x += 256 / 8) { g.fillRect(x, 0, 3, 90); g.fillRect(x, 166, 3, 90); }
		const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
		const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
		const r = rng(8), CC = [0xf4f1ea, 0x222222, 0x8a9096, 0xb3202a, 0x2656a8, 0x3a3f45, 0xd9d4c8, 0x5a6e50];
		const body = instancer(new THREE.BoxGeometry(1.8, 0.8, 4.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 }));
		const cab = instancer(new THREE.BoxGeometry(1.6, 0.6, 2.3), new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.1, metalness: 0.5 }));
		// behind the Casino, on the park's level
		{
			const u0 = -262, u1 = -150, v0 = -170, v1 = -72;
			const lot = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0), mat.clone());
			lot.material.map = t.clone(); lot.material.map.repeat.set((u1 - u0) / 20, (v1 - v0) / 16); lot.material.map.needsUpdate = true;
			lot.rotation.x = -Math.PI / 2; lot.position.set((u0 + u1) / 2, DECK + 0.02, (v0 + v1) / 2); lot.receiveShadow = true;
			group.add(lot);
			for (let v = v0 + 4; v < v1 - 3; v += 8) for (let u = u0 + 1.25; u < u1; u += 2.5) {
				if (r() < 0.3) continue;
				body.at(u, DECK + 0.62, v, 1, 1, 1, 0, new THREE.Color(CC[Math.floor(r() * CC.length)])); cab.at(u, DECK + 1.3, v - 0.2);
			}
			B.solids.push([u0 + 1, v0 + 2, u1 - 1, v1 - 2, 2]);
		}
		// the open lots: a sheet on the ground over each, 4 m cells, kept off the river's banks
		const C = 4, pos = [], uv = [], idx = [];
		const lotY = (u, v) => { const [x, z] = toW(u, v); return bay.heightAt(x, z) + 0.06; };
		LOTS.forEach((P, li) => {
			const us = P.map((q) => q[0]), vs = P.map((q) => q[1]);
			const U0 = Math.min(...us), V0 = Math.min(...vs), NI = Math.ceil((Math.max(...us) - U0) / C), NJ = Math.ceil((Math.max(...vs) - V0) / C);
			// (up to the levee's foot: the river's reach runs a little past it)
			const ok = (u, v) => { const [x, z] = toW(u, v); return inPoly(P, u, v) && river.influence(x, z) < 0.35; };
			const base = pos.length / 3, at = new Map();
			const vert = (i, j) => { const k = j * (NI + 1) + i; if (!at.has(k)) { const u = U0 + i * C, v = V0 + j * C; at.set(k, base + at.size); pos.push(u, lotY(u, v), v); uv.push(u / 20, v / 16); } return at.get(k); };
			for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
				const u = U0 + i * C, v = V0 + j * C;
				if (!ok(u, v) || !ok(u + C, v) || !ok(u, v + C) || !ok(u + C, v + C)) continue;
				const a = vert(i, j), b2 = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
				idx.push(a, c, b2, b2, c, d);
			}
			// the cars: the rows nearest the Boardwalk fullest
			for (let v = V0 + 4; v < V0 + NJ * C - 3; v += 8) for (let u = U0 + 1.25; u < U0 + NI * C; u += 2.5) {
				const full = li === 0 ? 0.75 : 0.85 * Math.exp(-(-200 - v) / 110);
				if (r() > full || !ok(u - 2, v - 3) || !ok(u + 2, v + 3)) continue;
				const y = lotY(u, v);
				body.at(u, y + 0.56, v, 1, 1, 1, 0, new THREE.Color(CC[Math.floor(r() * CC.length)])); cab.at(u, y + 1.24, v - 0.2);
			}
		});
		const lg = new THREE.BufferGeometry();
		lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setIndex(idx); lg.computeVertexNormals();
		const lots = new THREE.Mesh(lg, mat);
		lots.receiveShadow = true;
		group.add(lots);
		// the River Lot's lamps
		const Lm = merger(), bl = bulbs();
		for (let v = -230; v > -470; v -= 40) for (let u = 180; u < 436; u += 40) { const [x, z] = toW(u, v); if (!inPoly(LOTS[1], u, v) || river.influence(x, z) > 0.01) continue; const y = lotY(u, v); Lm.cyl(0.08, 0.12, 8, 'darksteel', u, y + 4, v, 6); bl.add(u, y + 8.1, v); }
		Lm.done(group, { shadow: false });
		bl.done(group, 1.6);
		body.done(group); cab.done(group);
	}
	// the town round the river: the Beach Flats and the blocks up San Lorenzo Boulevard and
	// East Cliff, houses a lot apart along streets; downtown west of the levee (north of
	// Laurel Street) two and three storeys of shops and offices. Kept off the lots, the
	// river's banks and levees. (In four pieces: each bank, near and far.)
	function buildTown(east, va, vb) {
		const Mg = merger(), r = rng((east ? 23 : 17) + va);
		const HK = ['stucco', 'white', 'cream', 'stuccoPink', 'white', 'cream'], RK = ['tile', 'darksteel', 'darkwood', 'tile'];
		for (let v = va; v > vb; v -= 34) for (let u = -520; u < 820; u += 17) {
			// (a street every sixth lot along, every block across)
			if (Math.floor((u + 520) / 17) % 6 === 5) continue;
			const pu = u + (r() - 0.5) * 3, pv = v + (r() - 0.5) * 4, [x, z] = toW(pu, pv);
			if (east !== river.side(x, z) > 0) continue;
			if (river.influence(x, z) > 0 || river.influence(...toW(pu + 10, pv)) > 0 || river.influence(...toW(pu - 10, pv)) > 0 || river.influence(...toW(pu, pv + 14)) > 0 || river.influence(...toW(pu, pv - 14)) > 0) continue;
			if (LOTS.some((P) => inPoly(P, pu, pv) || inPoly(P, pu + 10, pv) || inPoly(P, pu - 10, pv) || inPoly(P, pu, pv + 14))) continue;
			if (pv > -300 && pu < 0) continue;                     // (Beach Hill: the backdrop's own houses)
			const y = bay.heightAt(x, z);
			if (y < 1.5 || r() < 0.12) continue;
			const down = !east && pv < -760 && pu < -150 && pu > -600;
			const w = down ? 15 : 9 + r() * 4, d = down ? 26 : 10 + r() * 6, h = down ? 7 + r() * 6 : 4 + r() * 3.5, a = (r() - 0.5) * 0.08;
			B.town.push([pu - w / 2, pv - d / 2, pu + w / 2, pv + d / 2, y + h + 0.5]);
			Mg.box(w, h + 1, d, down ? ['cream', 'white', 'stucco', 'stuccoPink', 'concrete'][Math.floor(r() * 5)] : HK[Math.floor(r() * HK.length)], pu, y + h / 2 - 0.5, pv, 0, a);
			if (down) Mg.box(w + 0.3, 0.5, d + 0.3, 'darksteel', pu, y + h + 0.25, pv, 0, a);
			else Mg.geo(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.2, 4, 1).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)), RK[Math.floor(r() * RK.length)], pu, y + h + 1.1, pv, 0, a);
		}
		Mg.done(group, { shadow: false });
	}
	// Beach Hill to the west and the Beach Flats' houses, the motels along Beach Street
	// facing the park, the town rising behind; none in the lots, the river or its banks
	function buildBackdrop() {
		const Mg = merger(), r = rng(5);
		const clear = (u, v, x, z) => LOTS.some((P) => inPoly(P, u, v) || inPoly(P, u + 8, v) || inPoly(P, u - 8, v) || inPoly(P, u, v + 8) || inPoly(P, u, v - 8)) || river.influence(x, z) > 0.001 || (u < -470 && v > -60);
		for (let k = 0; k < (isPhone ? 110 : 170); k++) {
			const u = -560 + r() * 960, v = -205 - r() * (u < -250 ? 260 : 330);
			const [x, z] = toW(u, v), y = bay.heightAt(x, z);
			if (y < 1.5 || clear(u, v, x, z)) continue;
			const w = 8 + r() * 10, d = 8 + r() * 12, h = 4 + r() * (v > -240 ? 7 : 4), key = ['stucco', 'white', 'cream', 'stuccoPink'][Math.floor(r() * 4)];
			B.town.push([u - w / 2, v - d / 2, u + w / 2, v + d / 2, y + h + 0.5]);
			Mg.box(w, h + 1, d, key, u, y + h / 2 - 0.5, v, 0, (r() - 0.5) * 0.2);
			Mg.box(w + 0.5, 0.35, d + 0.5, r() < 0.6 ? 'tile' : 'darksteel', u, y + h + 0.1, v, 0, (r() - 0.5) * 0.2);
		}
		// the motels and shops along Beach Street between the lots, two storeys, facing the park
		for (let u = -34; u < 146; u += 16 + r() * 6) {
			const [x, z] = toW(u, -210), y = Math.max(DECK - 0.4, bay.heightAt(x, z)), h = 6 + r() * 2, key = ['white', 'cream', 'stuccoPink', 'teal'][Math.floor(r() * 4)];
			B.town.push([u - 7, -216, u + 7, -204, y + h]);
			Mg.box(14, h, 12, key, u, y + h / 2, -210).box(14.4, 0.4, 12.4, 'darksteel', u, y + h + 0.2, -210).box(14, 0.15, 2, 'concrete', u, y + 3.2, -203.2);
		}
		Mg.done(group, { shadow: false });
	}

	// ---------- the beach train: down Beach Street, over the trestle, and back ----------
	function buildTrain() {
		const T = new THREE.Group();
		const Mg = merger(), L = bulbs();
		// the locomotive: black boiler, red cab, a tall stack, the cowcatcher (facing +u)
		Mg.cyl(0.75, 0.75, 5.2, 'black', 1.2, 2.25, 0, 14, 0, 0, Math.PI / 2).cyl(0.28, 0.4, 1.3, 'black', 3.2, 3.4, 0, 10).cyl(0.35, 0.35, 0.5, 'brass', 1.8, 3.1, 0, 10);
		Mg.box(2.4, 2.6, 2.6, 'red', -2.2, 2.6, 0).box(2.8, 0.2, 3.0, 'black', -2.2, 4.0, 0).box(8.4, 0.5, 2.4, 'black', 0, 1.1, 0);
		Mg.geo(new THREE.ConeGeometry(1.1, 1.2, 4, 1).rotateZ(-Math.PI / 2), 'red', 4.6, 0.9, 0);
		for (const x of [-2.4, -0.6, 1.2, 3.0]) for (const sd of [-1.05, 1.05]) Mg.cyl(0.55, 0.55, 0.12, x < 0 ? 'red' : 'black', x, 0.62, sd, 12, Math.PI / 2);
		L.add(4.2, 2.8, 0);
		// the open excursion cars: yellow, red roofs, benches
		for (let k = 0; k < 3; k++) {
			const x0 = -9.6 - k * 11.4;
			Mg.box(10.4, 0.5, 2.8, 'yellow', x0, 1.3, 0).box(10.6, 0.2, 3.1, 'red', x0, 3.9, 0);
			for (const x of [-4.8, -1.6, 1.6, 4.8]) for (const sd of [-1.3, 1.3]) Mg.box(0.12, 2.4, 0.12, 'yellow', x0 + x, 2.7, sd);
			for (let b = -4; b <= 4; b += 1.6) Mg.box(0.5, 0.45, 2.4, 'plank', x0 + b, 1.8, 0);
			for (const x of [-3.5, 3.5]) for (const sd of [-1.05, 1.05]) Mg.cyl(0.4, 0.4, 0.12, 'black', x0 + x, 0.55, sd, 10, Math.PI / 2);
		}
		Mg.done(T, { shadow: !isPhone });
		L.done(T, 1.4);
		group.add(T);
		B.train = { T, u: RAIL.u0 + 40, dir: 1, wait: 20 };
	}
	function trainStep(dt, lu, lv) {
		const R = B.train;
		if (!R) return;
		if (R.wait > 0) R.wait -= dt;
		else {
			const end = R.dir > 0 ? RAIL.t1 + 30 : RAIL.u0 + 40;
			// (slow over the trestle and through the park, a walking pace)
			R.u += R.dir * dt * (R.u > PARK.u0 && R.u < RAIL.t1 ? 3.2 : 6);
			if ((R.u - end) * R.dir > 0) { R.u = end; R.dir *= -1; R.wait = 45; }
			// the bell as it comes by
			if (Math.random() < dt * 0.4 && Math.hypot(R.u - lu, RAIL.v - lv) < 150) for (let k = 0; k < 2; k++) sound.pipe(1180, k * 0.5, 0.45, 0.02 * Math.max(0, 1 - Math.hypot(R.u - lu, RAIL.v - lv) / 150), 'bell');
		}
		// (locomotive first going out; home, it backs its cars)
		R.T.position.set(R.u, railY(R.u) + 0.2, RAIL.v);
		R.T.rotation.set(0, 0, Math.atan2(railY(R.u + 3) - railY(R.u - 3), 6));
	}

	// ---------- the far crowd: figures on the promenade, the midway and the sand ----------
	function buildCrowd() {
		const n = isPhone ? 140 : 300;
		// real bodies, baked and instanced (people/crowd.js), in summer Boardwalk clothes
		const im = createCrowd(n, { kind: 'walk', place: 'boardwalk', seed: 42, cold: 0.25 });
		const r = rng(42);
		const F = [];
		for (let i = 0; i < n; i++) {
			const z = r(), zone = z < 0.4 ? 'prom' : z < 0.72 ? 'mid' : 'sand';
			const u = zone === 'mid' ? -45 + r() * 235 : -255 + r() * 580;
			const v = zone === 'prom' ? -7 + r() * 9.5 : zone === 'mid' ? -45 + r() * 26 : 12 + r() * 90;
			const kid = r() < 0.3;
			F.push({ u, v, u0: u, dir: r() < 0.5 ? 1 : -1, sp: (zone === 'sand' ? 0.3 : 1.1) + r() * 0.35, s: kid ? 0.6 + r() * 0.15 : 0.95 + r() * 0.12, still: zone === 'sand' ? r() < 0.7 : r() < 0.25, zone, ph: r() * 6 });
		}
		group.add(im.group);
		B.crowd = { im, F };
	}
	function crowdStep(dt, t, lu, lv, busy) {
		const C = B.crowd;
		if (!C) return;
		const n = C.F.length, on = Math.round(n * busy);
		for (let i = 0; i < n; i++) {
			const f = C.F[i];
			if (!f.still) { f.u += f.dir * f.sp * dt; if (Math.abs(f.u - f.u0) > 60) f.dir *= -1; }
			const y = f.zone === 'sand' ? groundY(f.u, f.v) : DECK;
			const d = Math.hypot(f.u - lu, f.v - lv);
			// near you the real people take over; far off, only the day's share are out
			const k = i < on && d > 55 ? f.s : 0;
			const bob = f.still ? 0 : Math.abs(Math.sin(t * 5 * f.sp + f.ph)) * 0.04;
			C.im.place(i, f.u, y + bob * k * 0.3, f.v, f.still ? f.ph : f.dir > 0 ? Math.PI / 2 : -Math.PI / 2, k);
		}
		C.im.update(t);
	}

	// ---------- the riders in the seats and the operators: real people, near you ----------
	const RP = { A: null, loading: false, pool: [], t: 0, max: isPhone ? 8 : 16 };
	const riderGroup = new THREE.Group();
	riderGroup.name = 'boardwalk-riders';
	group.add(riderGroup);
	const tm = new THREE.Matrix4();
	function riderStep(dt, t, lu, lv, ly) {
		if (!RP.A) { if (!RP.loading) { RP.loading = true; loadPeopleAssets().then((A) => { RP.A = A; }).catch(() => { /* no people: empty seats */ }); } return; }
		// grow the pool a body at a time
		if (RP.pool.length < RP.max) {
			const seed = (RP.pool.length * 2654435761 + 99) >>> 0;
			const ctx = { place: 'boardwalk', activity: RP.pool.length < 6 ? 'work' : 'ride', cold: 0.3 };
			const d = personDNA(seed, RP.pool.length % 3 === 2 ? { age: 7 + (seed % 7), ctx } : { ctx });
			const P = buildPerson(RP.A, d);
			P.root.traverse((q) => { q.castShadow = false; });
			const holder = new THREE.Group();
			holder.matrixAutoUpdate = false;
			holder.add(P.root);
			riderGroup.add(holder);
			const M = createMotion(P, () => 0);
			M.place(0, 0, 0, 0);
			RP.pool.push({ P, M, holder, slot: null });
		}
		// every half second: the seats nearest you, filled
		RP.t -= dt;
		if (RP.t <= 0) {
			RP.t = 0.5;
			const cand = [];
			for (const R of [...B.rides, ...B.scen]) {
				const rr = R.riders;
				if (!rr) continue;
				for (let i = 0; i < rr.count; i++) {
					const m = rr.at(i, tm);
					if (!m) continue;
					const e = m.elements, d = Math.hypot(e[12] - lu, e[13] - ly, e[14] - lv);
					if (d < 90) cand.push({ R, i, d });
				}
			}
			for (const O of OPS) { const d = Math.hypot(O[0] - lu, O[1] - lv); if (d < 70) cand.push({ op: O, d }); }
			cand.sort((a, b) => a.d - b.d);
			const want = cand.slice(0, RP.max), key = (c) => c.op ? 'op' + c.op[0] : c.R.id + c.i;
			const keep = new Set(want.map(key));
			for (const p of RP.pool) if (p.slot && !keep.has(key(p.slot))) p.slot = null;
			const taken = new Set(RP.pool.filter((p) => p.slot).map((p) => key(p.slot)));
			for (const c of want) {
				if (taken.has(key(c))) continue;
				const p = RP.pool.find((q) => !q.slot && (c.op ? !q.P.dna.child : true));
				if (!p) break;
				p.slot = c;
				if (c.op) { p.M.stand(); p.M.S.sitK.v = 0; p.M.setPose('behind'); if (!p.staff) { p.staff = true; p.P.redress({ ...STAFF, hair: p.P.dna.style?.hair }); } }
				else if (p.staff) { p.staff = false; p.P.redress(p.P.dna.style); } else { p.M.sit(c.R.riders.sit, true); p.M.setPose(c.R.riders.pose); }
			}
		}
		for (const p of RP.pool) {
			const c = p.slot;
			let ok = false;
			if (c?.op) { p.holder.matrix.makeRotationY(c.op[2]).setPosition(c.op[0], DECK, c.op[1]); ok = true; }
			else if (c) ok = !!c.R.riders.at(c.i, p.holder.matrix);
			// on the coaster: arms up on the drops (most people; some keep hold of the bar)
			if (c && !c.op && c.R.riders.thrill) p.M.act('coaster', p.P.dna.temper.outgoing > 0.3 ? c.R.riders.thrill(c.i) : 0);
			else if (p.M.S.act.name) p.M.act(null);
			p.holder.visible = ok;
			if (!ok) continue;
			p.holder.matrixWorldNeedsUpdate = true;
			p.M.S.pos.set(0, 0, 0); p.M.want.speed = 0; p.M.want.heading = 0;
			p.M.update(dt, t, null);
		}
	}
	// what the ride crews wear: the park's red polo, khaki shorts, a cap
	const STAFF = { gen: 'staff', top: { kind: 'polo', col: '#b3162b', acc: '#f3f2ee', pat: 'ringer', fit: 'regular', sleeves: 'short', collar: true, tuck: true }, outer: null, bottom: { kind: 'shorts', col: '#a89a74', pat: 'plain', legs: 'bermuda', fit: 'regular' }, shoes: { kind: 'walker', col: '#1b1b1d', acc: '#565c63', sole: '#f3f2ee' }, acc: [{ kind: 'cap', col: '#b3162b', acc: '#f3f2ee' }] };
	// the operators: one at each ride's gate, facing the queue [u, v, facing]
	const OPS = [[208, -13.5, Math.PI * 0.25], [19.2, -61.2, 0], [80.5, -45.5, 0], [141, -52.5, 0], [-48.5, 15.5, Math.PI], [-121, -23, Math.PI]];

	// ---------- walking: the floors, the walls ----------
	function floor(x, z, y) {
		const rf = river.floor(x, z, y);
		if (!B.built) return rf;
		const [u, v] = toL(x, z);
		// the wharf's deck, the trestle's
		const wf = B.wharf?.built ? B.wharf.floor(u, v, y) : null;
		if (wf !== null) return Math.max(wf, rf);
		if (u > RAIL.t0 - 44 && u < RAIL.t1 + 44 && Math.abs(v - RAIL.v) < 4.4) { const fy = railY(u) + 0.25; if (y > fy - 1.4 && fy > DECK + 0.4) return fy; }
		if (u < GROUND.u0 - 5 || u > GROUND.u1 + 5 || v < GROUND.v0 - 5 || v > GROUND.v1) return rf;
		if (u > PARK.u0 && u < PARK.u1 && v > PARK.v0 && v < PARK.v1 + 0.1) return DECK;
		if (v >= PARK.v1 && u > GROUND.u0 + 10 && u < GROUND.u1 - 10 && v < GROUND.v1 - 10) return Math.max(rf, beachY(u, v, x, z));
		return rf;
	}
	function push(p, footY) {
		river.push(p, footY);
		if (!B.built) return;
		let [u, v] = toL(p.x, p.z);
		const q = B.wharf?.built ? B.wharf.push(u, v, footY) : null;
		if (q) { [u, v] = q; const [x, z] = toW(u, v); p.x = x; p.z = z; }
		// the town's houses, motels and shops round the park: walls, not air
		if (v < -150) {
			let hit = false;
			for (const s of B.town) {
				if (footY > s[4] || u < s[0] - 0.3 || u > s[2] + 0.3 || v < s[1] - 0.3 || v > s[3] + 0.3) continue;
				const pen = [u - (s[0] - 0.3), s[2] + 0.3 - u, v - (s[1] - 0.3), s[3] + 0.3 - v], m = Math.min(...pen), k = pen.indexOf(m);
				if (k === 0) u = s[0] - 0.3; else if (k === 1) u = s[2] + 0.3; else if (k === 2) v = s[1] - 0.3; else v = s[3] + 0.3;
				hit = true;
			}
			if (hit) { const [x, z] = toW(u, v); p.x = x; p.z = z; }
			return;
		}
		if (u < PARK.u0 - 20 || u > PARK.u1 + 20 || v < PARK.v0 - 5 || v > 30) return;
		const R = 0.3, y = footY - DECK;
		let moved = false;
		for (const s of B.solids) {
			if (y > (s[4] ?? 30)) continue;
			if (u < s[0] - R || u > s[2] + R || v < s[1] - R || v > s[3] + R) continue;
			const pen = [u - (s[0] - R), s[2] + R - u, v - (s[1] - R), s[3] + R - v], m = Math.min(...pen), k = pen.indexOf(m);
			if (k === 0) u = s[0] - R; else if (k === 1) u = s[2] + R; else if (k === 2) v = s[1] - R; else v = s[3] + R;
			moved = true;
		}
		for (const [cu, cv, cr] of B.rounds) { const du = u - cu, dv = v - cv, d = Math.hypot(du, dv); if (d < cr + R && d > 1e-4) { u = cu + du / d * (cr + R); v = cv + dv / d * (cr + R); moved = true; } }
		if (moved) { const [x, z] = toW(u, v); p.x = x; p.z = z; }
	}
	const blocked = (u, v) => B.solids.some((s) => u > s[0] - 0.5 && u < s[2] + 0.5 && v > s[1] - 0.5 && v < s[3] + 0.5) || B.rounds.some(([cu, cv, cr]) => Math.hypot(u - cu, v - cv) < cr + 0.5);
	// the day's visitors: families along the promenade and the midway, lines at the rides
	const QUEUE = [];
	function queues() {
		if (QUEUE.length) return QUEUE;
		for (const R of B.rides) {
			const b = R.board;
			for (let k = 0; k < 6; k++) { const [x, z] = toW(b.u - 2 + (k % 3) * 0.9, b.v + 1.4 + Math.floor(k / 3) * 0.9); QUEUE.push({ x, z, y: DECK, h: 0, sit: false, heading: FRAME.a + Math.PI, taken: false }); }
		}
		for (let u = PARK.u0 + 12; u < PARK.u1; u += 29) for (const d of [-0.45, 0.45]) { const [x, z] = toW(u + d, 2.55); QUEUE.push({ x, z, y: DECK, h: 0.46, sit: true, heading: FRAME.a, taken: false }); }
		for (const q of B.foodSeats || []) { const [x, z] = toW(q.u, q.v); QUEUE.push({ x, z, y: DECK, h: 0.45, sit: true, table: true, heading: q.heading + FRAME.a, taken: false }); }
		return QUEUE;
	}
	function venue(cam, hours) {
		if (!B.built) return null;
		const [u, v] = toL(cam.x, cam.z);
		// out on the wharf: its own visitors
		const WV = B.wharf?.venue(u, v, cam.y, Math.max(crowd(ZONE.beach, hours).k, busyAt(hours)) * (hours < 7 || hours > 22.5 ? 0.3 : 1));
		if (WV) return WV;
		if (u < PARK.u0 - 10 || u > PARK.u1 + 10 || v < PARK.v0 || v > 120 || cam.y > 60) return null;
		const k = Math.max(crowd(ZONE.beach, hours).k, busyAt(hours));
		const pick = (u0, u1, v0, v1, yf) => (rr) => { for (let i = 0; i < 8; i++) { const pu = u0 + rr() * (u1 - u0), pv = v0 + rr() * (v1 - v0); if (!blocked(pu, pv)) { const [x, z] = toW(pu, pv); return { x, z, y: yf ? yf(pu, pv) : DECK }; } } const [x, z] = toW(u0, v0); return { x, z }; };
		const areas = [
			{ w: 0.4, pick: pick(Math.max(PARK.u0 + 5, u - 60), Math.min(PARK.u1 - 5, u + 60), -7, 2) },
			{ w: 0.35, pick: pick(-45, 195, -46, -20) },
			{ w: 0.25, pick: pick(Math.max(-250, u - 70), Math.min(300, u + 70), 8, 50, groundY) },
		];
		// some go to the benches and into the lines
		if (Math.random() < 0.3) areas.push({ w: 0.3, seats: queues() });
		return { n: Math.round(26 * k), kids: 0.45 * Math.max(0.4, kidsAbout(hours)), areas };
	}
	const busyAt = (h) => Math.max(0.08, Math.min(1, Math.exp(-(((h - 15) / 4.2) ** 2)) + Math.exp(-(((h - 19.5) / 2.2) ** 2)) * 0.8)) * (h < 10 || h > 23 ? 0.25 : 1);

	// ---------- the ride button and the rider's seat ----------
	const style = 'position:absolute;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(8,20,26,.78);color:#eafaf6;font:600 14px system-ui;cursor:pointer;z-index:5;';
	const btn = document.createElement('button');
	btn.style.cssText = style + 'left:50%;transform:translateX(-50%);bottom:calc(128px + env(safe-area-inset-bottom));padding:10px 22px 10px 16px;border-radius:24px;display:none;align-items:center;gap:8px;white-space:nowrap;';
	for (const ev of ['pointerdown', 'touchstart', 'keydown']) btn.addEventListener(ev, (e) => e.stopPropagation());
	mount?.appendChild(btn);
	let offer = null;
	btn.onclick = (e) => { e.stopPropagation(); btn.blur(); if (offer) board(offer); };
	const onKey = (e) => {
		if (document.activeElement?.tagName === 'INPUT' || mount?.style.display === 'none') return;
		if ((e.key === 'e' || e.key === 'E') && offer && !Ride.cur && !e.repeat) { e.preventDefault(); board(offer); }
		else if (e.key === 'Escape' && Ride.cur) { e.preventDefault(); leave(); }
		else if (Ride.cur?.action && e.key === Ride.cur.action.key && !e.repeat) { e.preventDefault(); act(); }
	};
	addEventListener('keydown', onKey);
	// the seat: a layer over everything, the title and status, the × to get off, an action
	// button where the ride has one, a stick where you drive
	const PANEL = 'background:rgba(8,20,26,.78);border:1px solid rgba(255,255,255,.18);color:#eafaf6;border-radius:16px;font:13px system-ui,sans-serif;';
	const layer = document.createElement('div');
	layer.style.cssText = 'position:absolute;inset:0;z-index:7;display:none;touch-action:none;user-select:none;-webkit-user-select:none;';
	const vign = document.createElement('div');
	vign.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 62%,rgba(0,0,0,.28) 100%);';
	const top = document.createElement('div');
	top.style.cssText = PANEL + 'position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);max-width:min(460px,calc(100vw - 110px));padding:8px 16px;text-align:center;pointer-events:none;';
	const x0 = document.createElement('button');
	x0.textContent = '×'; x0.setAttribute('aria-label', 'Get off the ride');
	x0.style.cssText = PANEL + 'position:absolute;right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));width:44px;height:44px;border-radius:22px;font:600 24px system-ui;line-height:1;cursor:pointer;';
	const actB = document.createElement('button');
	actB.style.cssText = style + 'left:50%;transform:translateX(-50%);bottom:calc(40px + env(safe-area-inset-bottom));padding:12px 26px;border-radius:26px;display:none;font:700 15px system-ui;';
	const joy = document.createElement('div');
	joy.style.cssText = 'position:absolute;width:120px;height:120px;border-radius:50%;border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06);left:calc(28px + env(safe-area-inset-left));bottom:calc(36px + env(safe-area-inset-bottom));display:none;pointer-events:none;';
	const knob = document.createElement('div');
	knob.style.cssText = 'position:absolute;left:38px;top:38px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.5);';
	joy.appendChild(knob);
	layer.append(vign, top, x0, actB, joy);
	mount?.appendChild(layer);
	for (const el of [x0, actB]) for (const ev of ['pointerdown', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation());
	x0.addEventListener('click', (e) => { e.stopPropagation(); leave(); });
	actB.addEventListener('click', (e) => { e.stopPropagation(); act(); });
	// drag to look round; on the bumper cars, the left of the screen is the stick
	const look = { yaw: 0, pitch: 0, ptrs: new Map(), stick: null };
	const ctl = { x: 0, y: 0, keys: new Set() };
	layer.addEventListener('pointerdown', (e) => {
		e.preventDefault(); e.stopPropagation();
		layer.setPointerCapture?.(e.pointerId);
		if (Ride.cur?.drive && e.clientX < innerWidth * 0.45 && !look.stick) { look.stick = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
		look.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
	});
	layer.addEventListener('pointermove', (e) => {
		e.stopPropagation();
		if (look.stick && e.pointerId === look.stick.id) {
			const dx = e.clientX - look.stick.x, dy = e.clientY - look.stick.y, l = Math.hypot(dx, dy), m = Math.min(1, l / 50);
			ctl.x = l ? dx / l * m : 0; ctl.y = l ? -dy / l * m : 0;
			knob.style.transform = `translate(${ctl.x * 40}px,${-ctl.y * 40}px)`;
			return;
		}
		const p = look.ptrs.get(e.pointerId);
		if (!p) return;
		look.yaw -= (e.clientX - p.x) * 0.005; look.pitch -= (e.clientY - p.y) * 0.005;
		look.yaw = Math.max(-2.4, Math.min(2.4, look.yaw)); look.pitch = Math.max(-1.1, Math.min(1.0, look.pitch));
		p.x = e.clientX; p.y = e.clientY;
	});
	for (const ev of ['pointerup', 'pointercancel']) layer.addEventListener(ev, (e) => {
		e.stopPropagation();
		if (look.stick && e.pointerId === look.stick.id) { look.stick = null; ctl.x = ctl.y = 0; knob.style.transform = ''; }
		look.ptrs.delete(e.pointerId);
	});
	for (const ev of ['touchstart', 'touchmove', 'touchend', 'wheel', 'click', 'mousedown']) layer.addEventListener(ev, (e) => e.stopPropagation());
	const keyDown = (e) => { if (Ride.cur) ctl.keys.add(e.key.toLowerCase()); }, keyUp = (e) => ctl.keys.delete(e.key.toLowerCase());
	addEventListener('keydown', keyDown);
	addEventListener('keyup', keyUp);
	function keysCtl() {
		const K = ctl.keys;
		let x = 0, y = 0;
		if (K.has('w') || K.has('arrowup')) y += 1;
		if (K.has('s') || K.has('arrowdown')) y -= 1;
		if (K.has('a') || K.has('arrowleft')) x -= 1;
		if (K.has('d') || K.has('arrowright')) x += 1;
		return look.stick ? ctl : { x: x || ctl.x, y: y || ctl.y };
	}

	const Ride = { cur: null, saved: null, out: { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 70 }, fov0: 70, pending: null };
	function board(R) {
		const P = player?.();
		if (!P || Ride.cur) return;
		if (!R.begin()) return;
		Ride.cur = R;
		Ride.saved = { pos: P.pos.clone(), yaw: P.yaw, pitch: P.pitch, flying: P.flying };
		Ride.fov0 = camera.fov;
		look.yaw = 0; look.pitch = 0; ctl.x = ctl.y = 0;
		layer.style.display = 'block'; btn.style.display = 'none';
		joy.style.display = R.drive && isPhone ? 'block' : 'none';
		actB.style.display = 'none';
		top.innerHTML = `<div style="font:700 14px system-ui;color:#ffd166;display:flex;gap:8px;align-items:center;justify-content:center">${rideIcon(R.icon, 18)}<span>${R.name}</span></div><div data-s style="margin-top:2px;white-space:pre-line;opacity:.9"></div><div style="margin-top:3px;font-size:11px;opacity:.6">${R.drive ? (isPhone ? 'Left thumb drives · drag to look' : 'Arrow keys or WASD drive · drag to look') : 'Drag to look round'} · × to get off</div>`;
	}
	function leave() {
		const R = Ride.cur;
		if (!R) return;
		R.end();
		Ride.cur = null;
		layer.style.display = 'none'; joy.style.display = 'none';
		camera.fov = Ride.fov0; camera.updateProjectionMatrix();
		const P = player?.();
		if (P && Ride.saved) {
			// off at the ride's exit, facing out
			const e = R.exit, [x, z] = toW(e.u, e.v);
			P.flying = false; P.vel?.set(0, 0, 0);
			P.pos.set(x, DECK + 1.7, z);
			P.yaw = e.yaw + FRAME.a; P.pitch = 0;
			camera.position.copy(P.pos);
			camera.rotation.set(0, P.yaw, 0, 'YXZ');
		}
		Ride.saved = null;
	}
	function act() {
		const R = Ride.cur;
		if (!R?.action) return;
		const msg = R.action.run();
		if (msg) hint(msg, 2500, 2);
	}
	const WQ = new THREE.Quaternion(), LQ = new THREE.Quaternion(), EU = new THREE.Euler();
	// riding: the ride steps and says where the rider's eye is; true while aboard
	function ride(dt, t) {
		const R = Ride.cur;
		if (!R) return false;
		const P = player?.();
		// taken somewhere else while aboard (the places menu): off without ceremony
		if (!P || P.pos.distanceTo(Ride.saved.pos) > 3) { R.end(); Ride.cur = null; layer.style.display = 'none'; camera.fov = Ride.fov0; camera.updateProjectionMatrix(); return false; }
		const O = Ride.out;
		const going = R.pose(dt, t, O, keysCtl());
		// from the park's frame to the world's, then the rider's own look on top
		O.pos.applyMatrix4(group.matrixWorld);
		WQ.setFromRotationMatrix(group.matrixWorld).multiply(O.quat);
		if (!look.ptrs.size) { look.yaw *= Math.max(0, 1 - dt * 0.25); look.pitch *= Math.max(0, 1 - dt * 0.25); }
		LQ.setFromEuler(EU.set(look.pitch, look.yaw, 0, 'YXZ'));
		camera.position.copy(O.pos);
		camera.quaternion.copy(WQ).multiply(LQ);
		if (Math.abs(camera.fov - O.fov) > 0.05) { camera.fov += (O.fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
		const s = top.querySelector('[data-s]');
		if (s) s.textContent = R.status?.() || '';
		if (R.action) { const ready = R.action.ready(); actB.style.display = ready ? '' : 'none'; if (ready) actB.textContent = R.action.label + (isPhone ? '' : ' (Space)'); }
		if (!going) { leave(); hint(`${R.name}: that was the ride.`, 2500); }
		return true;
	}

	// ---------- each frame ----------
	let lastNight = -1, scanT = 0;
	const babble = sound.loop('bandpass', 700, 0.5);
	function update(dt, t, cam, night, hours) {
		if (!regraded && bay.levels?.[0]) regraded = regrade(bay, shared?.bayU);
		const d = Math.hypot(cam.position.x - FRAME.x, cam.position.z - FRAME.z);
		if (!regraded) return;
		// the river carves its channel once the regraded survey has gone up to the GPU
		if (++sinceGrade > 30) river.update(dt, t, cam, night);
		// in range (and the river carved): build a piece a frame; well out of range: let it all go
		if (!B.built && d < NEAR && bay.loaded() && river.settled()) {
			if (!B.queue) { B.queue = plan(); B.nq = B.queue.length; }
			const t0 = performance.now();
			while (B.queue.length && performance.now() - t0 < 12) { const f = B.queue.shift(), t1 = performance.now(); try { f(); } catch (e) { console.warn('[boardwalk]', e); } const ms = performance.now() - t1; const nm = '#' + (B.nq - B.queue.length); if (ms > 40) (B.over ||= []).push(nm + ' ' + Math.round(ms)); if (ms > (B.slow || 0)) { B.slow = ms; B.slowName = nm; } }
		}
		if ((B.built || B.queue) && d > FAR && !Ride.cur) dispose();
		if (!B.built) return;
		uTime.value = t;
		const [lu, lv] = toL(cam.position.x, cam.position.z), ly = cam.position.y;
		const info = { night, near: Math.hypot(lu, lv), local: { x: lu, z: lv }, dist: (u, v) => Math.hypot(u - lu, v - lv) };
		for (const R of B.rides) {
			if (R === Ride.cur) continue;
			info.near = R.root ? Math.hypot(lu - R.root.position.x - (R.id === 'dipper' ? 260 : 0), lv - R.root.position.z - (R.id === 'dipper' ? -90 : 0)) : d;
			try { R.update(dt, t, info); } catch (e) { console.warn('[boardwalk]', R.id, e); }
		}
		if (Ride.cur) { info.near = 0; Ride.cur.update?.(0, t, info); }
		for (const S of B.scen) { info.near = Math.hypot(lu - (S.root?.position.x || 170), lv - (S.root?.position.z || -120)); if (info.near < 700) S.update(dt, t, info); }
		// night: the bulbs, the lamps and their pools, the lit windows and signs
		if (Math.abs(night - lastNight) > 0.01) {
			lastNight = night;
			setNight(night);
			if (B.globe) B.globe.emissiveIntensity = 0.1 + night * 2.2;
			if (B.poolMat) B.poolMat.opacity = night * 0.55;
			for (const m of B.winMats) m.emissiveIntensity = night * 1.1 + 0.05;
			for (const s of B.signs) if (s.userData.sign) s.userData.sign.emissiveIntensity = 0.15 + night * 0.7;
		}
		const busy = busyAt(hours);
		if (d < 1600) crowdStep(dt, t, lu, lv, busy);
		trainStep(dt, lu, lv);
		B.wharf?.update(dt, t, lu, lv, ly, night);
		// the midway's own sound: the crowd's murmur, a game booth's bell now and then
		const mid = Math.max(0, 1 - Math.hypot(Math.max(0, Math.abs(lu - 30) - 230), Math.max(0, Math.abs(lv + 30) - 40), Math.max(0, ly - DECK - 3)) / 120) * (Ride.cur ? 0.5 : 1);
		babble.set(mid * busy * 0.09 * (0.75 + 0.25 * Math.sin(t * 2.3) * Math.sin(t * 3.7)), 600 + 150 * Math.sin(t * 1.3));
		if (mid > 0.2 && Math.random() < dt * 0.25 * busy) { const f = 1320 + Math.floor(Math.random() * 3) * 330; for (let k = 0; k < 3; k++) sound.pipe(f, k * 0.12, 0.3, 0.02 * mid, 'bell'); }
		if (d < 400) riderStep(dt, t, lu, lv, ly); else for (const p of RP.pool) p.holder.visible = false;
		// the ride here, offered
		scanT -= dt;
		if (scanT <= 0) {
			scanT = 0.25;
			const P = player?.();
			let o = null;
			if (P && !P.flying && !Ride.cur && Math.abs(ly - DECK - 1.7) < 3) for (const R of B.rides) if (Math.hypot(R.board.u - lu, R.board.v - lv) < R.board.r) o = R;
			if (o !== offer) {
				offer = o;
				if (o) btn.innerHTML = `${rideIcon(o.icon, 20)}<span>Ride the ${o.name}${isPhone ? '' : ' (E)'}</span>`;
			}
			btn.style.display = offer ? 'flex' : 'none';
			// arriving: what this is
			if (!hintSeen && lu > PARK.u0 && lu < PARK.u1 && lv > PARK.v0 && lv < 60 && ly < DECK + 40) { hintSeen = true; hint('Santa Cruz Beach Boardwalk\nSince 1907: the Giant Dipper, the Looff Carousel and the midway. Walk up to a ride to get on.', 7000, 1); }
			if (!hintWharf && B.wharf?.built && B.wharf.floor(lu, lv, ly - 1.7) !== null && ly < 20) { hintWharf = true; hint('Santa Cruz Municipal Wharf\nSince 1914: fish markets, chowder and saltwater taffy half a mile out over the bay. Look down through the viewing holes at the end for the sea lions.', 7000, 1); }
			if (!hintRiver && river.levelAt(cam.position.x, cam.position.z) !== null && ly < 30) { hintRiver = true; hint('San Lorenzo River\nDown from the Santa Cruz Mountains through Henry Cowell\'s redwoods and the town, into the bay by the Boardwalk.', 6000, 1); }
			// a ride asked for from the console, now that it is built
			if (Ride.pending) { const R = B.rides.find((q) => q.id === Ride.pending); Ride.pending = null; if (R) board(R); }
		}
	}
	function dispose() {
		if (Ride.cur) leave();
		babble.set(0);
		for (const R of B.rides) R.dispose?.();
		B.scen = [];
		const seen = new Set();
		for (const o of [...group.children]) {
			if (o === riderGroup) continue;
			o.traverse((q) => { if (q.geometry && !seen.has(q.geometry)) { seen.add(q.geometry); q.geometry.dispose(); } });
			group.remove(o);
		}
		for (const p of RP.pool) p.slot = null;
		Object.assign(B, { built: false, standSigns: [], queue: null, rides: [], solids: [], rounds: [], crowd: null, wharf: null, train: null, winMats: [], signs: [], pools: null, globe: null, poolMat: null });
		QUEUE.length = 0;
		group.visible = false; btn.style.display = 'none'; offer = null;
	}
	// the console: where it stands, and a ride by name (taking you to it first)
	function info() {
		return { built: B.built, pieces: B.queue?.length ?? 0, slowestPieceMs: Math.round(B.slow || 0), slowestPiece: B.slowName || '', overPieces: B.over || [], rides: B.rides.map((R) => R.id), offer: offer?.id || null, riding: Ride.cur?.id || null, status: Ride.cur?.status?.() || '', regraded, river: river.info(), wharf: B.wharf?.info() || null };
	}
	function rideNow(id) {
		const P = player?.();
		const R = B.rides.find((q) => q.id === id || q.name.toLowerCase().includes(String(id).toLowerCase()));
		// (off whatever ride this is first)
		if (R && B.built) { if (Ride.cur !== R) leave(); board(R); return Ride.cur === R ? `Riding the ${R.name}` : `The ${R.name} is not ready yet.`; }
		// not built yet: to its gate, and aboard once it is up
		const ids = { dipper: [212, -12], wheel: [22, -61.4], bumper: [78, -44], carousel: [-128, -22], glider: [-48, 15.5], drop: [138, -53] };
		const key = Object.keys(ids).find((k) => k === id || String(id).toLowerCase().includes(k)) || 'dipper';
		if (P) { const [x, z] = toW(...ids[key]); P.flying = false; P.pos.set(x, DECK + 1.7, z); }
		Ride.pending = key;
		return 'On the way to the Boardwalk: the ride starts once it is built.';
	}
	// (run the ride on by some seconds without drawing: for trying it from the console)
	const step = (sec) => { let t = 0; for (; t < sec && Ride.cur; t += 1 / 30) ride(1 / 30, performance.now() / 1000 + t); return info(); };
	// the world is going: everything of ours with it
	function destroy() {
		dispose();
		river.destroy();
		babble.stop();
		btn.remove(); layer.remove();
		removeEventListener('keydown', onKey); removeEventListener('keydown', keyDown); removeEventListener('keyup', keyUp);
		scene.remove(group);
	}
	return { group, update, ride, destroy, riding: () => !!Ride.cur, leave, floor, push, venue, info, rideNow, step, inside: (x, z) => inBoardwalk(x, z), waterAt: (x, z) => river.levelAt(x, z), river, get cur() { return Ride.cur; } };
}
