// The underground of another world. A few cave mouths open on the hillsides, each a dark
// arch in a ledge of rock with boulders round it and a worn path to it; beyond, a tunnel
// winds down into the dark to a network of chambers 20-60 m under the ground. There are
// teeth of rock above and below, glow worms on the vaults and colonies of living light
// on the walls, crystals, still black pools, on a volcanic world channels of lava, on an
// ice world walls of ice; a sinkhole lets a shaft of daylight fall on the ruins of those
// who lived here before, and in the greatest cavern people still live, by lamplight.
//
// The rock is one field (cavenet.js), meshed a cube at a time as you come near it.

import * as THREE from 'three';
import { mulberry32, smoothstep, clamp } from '../noise.js';
import { planCaves, meshChunk, chunkKeys } from './cavenet.js';
import { caveLighting, rockMaterial, crystalMaterial, waterMaterial, lavaMaterial, shaftMaterial, glowPointsMaterial, FAKE } from './cavemat.js';
import { buildRuins } from './caveruins.js';
import { createCaveVillage } from './cavevillage.js';
import { soundBus, noise } from '../world/soundbus.js';
import { createDinosaurs } from './dinosaurs.js';

const EYE = 1.68;
const CHUNK = 24;

// the names a world gives its caves
const NAMES = {
	stone: ['The Old Mouth', 'Echo Cave', 'The Long Dark', 'Drip Hollow'],
	coral: ['Shell Grotto', 'The Tide Door', 'Pearl Hollow', 'The Blue Throat'],
	sandstone: ['The Sand Gate', 'Wind Cave', 'The Red Throat', 'Dune Hollow'],
	ice: ['The Frost Door', 'Blue Hollow', 'The Ice Throat', 'Rime Cave'],
	basalt: ['The Ember Gate', 'Cinder Mouth', 'The Hot Dark', 'Ash Hollow'],
	rust: ['The Rust Gate', 'Spore Hollow', 'The Green Throat', 'Old Drain'],
	crystal: ['The Glimmer Door', 'Moon Hollow', 'The Singing Cave', 'Star Throat'],
	metal: ['The Iron Door', 'Echo Shaft', 'The Cold Hollow', 'Signal Cave'],
};

export function createUnderworld(island, shared, scene, camera, profile, opts = {}) {
	const isPhone = !!opts.isPhone;
	shared.uHoles ||= { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] };
	shared.uCave ||= { value: 0 };
	for (const v of shared.uHoles.value) v.set(0, 0, 0, 0);
	// (the plan may have been made earlier, to keep the plants out of the mouths: planCaves)
	const plan = opts.plan || planCaves(island, profile);
	// the wild worlds' dinosaurs walk the ground above (planet/dinosaurs.js): made with the underworld,
	// which every other world gets, so they share its frame, its tap list and its clearing up
	const dinos = createDinosaurs(island, shared, scene, camera, profile, { isPhone });
	const none = { update: (dt, t) => dinos?.update(dt, t), floor: () => null, push() {}, inside: () => 0, fog: () => [0.02, 0.022, 0.026], entrances: [], spots: [], go: () => 'no caves on this world', dispose: () => dinos?.dispose(), plan: null, pickables: dinos?.pickables || [], dinosaurs: dinos };
	if (!plan || !plan.entrances.length) return none;
	const { field, chambers, tunnels, entrances, shaft } = plan;
	const H = island.heightAt;
	const r = mulberry32((island.seed >>> 0) ^ 0x0ddba11);
	const cw = profile.caves || {};
	const civ = profile.civ || { ruin: 'stone', village: 'hut' };
	const glowC = cw.glow || [0.4, 0.9, 0.7];
	const group = new THREE.Group();
	group.name = 'underworld';
	scene.add(group);
	const L = caveLighting(shared, island, profile);

	// the ground opens at each mouth (and over the sinkhole), once the rock there is made
	// (four slots in the ground's shader: with more openings than that, as when a realm
	// digs its own stairs down (shared.moreHoles), the four nearest the camera are open)
	const holes = plan.holes;
	const openHoles = () => {
		const cam = camera.position, all = [];
		for (const h of holes) all.push({ h, ready: chunks.every((c) => c.state === 2 || !c.mouth || Math.hypot(c.x - h.x, c.z - h.z) > 30) });
		for (const h of shared.moreHoles || []) all.push({ h, ready: true });
		if (all.length > 4) all.sort((a, b) => Math.hypot(a.h.x - cam.x, a.h.z - cam.z) - Math.hypot(b.h.x - cam.x, b.h.z - cam.z));
		for (let i = 0; i < 4; i++) { const o = all[i]; if (o) shared.uHoles.value[i].set(o.h.x, o.h.z, o.ready ? o.h.r : 0, 0); else shared.uHoles.value[i].set(0, 0, 0, 0); }
	};
	if (shaft) L.U.uCvShaft.value.set(shaft.x, shaft.z, shaft.r, 1);

	// ---------- the rock, a cube at a time ----------
	const rockMat = rockMaterial(L, profile, { isPhone });
	const V = isPhone ? 1.0 : 0.8;
	const chunks = chunkKeys(field, plan.boulders, CHUNK).map((k) => ({ ...k, state: 0, mesh: null, gen: null, d: 0, mouth: false }));
	const mouthPts = [...entrances.map((e) => ({ x: e.x, z: e.z, y: e.y })), ...(shaft ? [{ x: shaft.x, z: shaft.z, y: shaft.top }] : [])];
	for (const c of chunks) {
		c.mouth = mouthPts.some((m) => Math.hypot(c.x - m.x, c.z - m.z) < 52 && Math.abs(c.y - m.y) < 40);
	}
	function finish(c, m) {
		c.state = 2; c.gen = null;
		if (!m) return;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
		g.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
		g.setAttribute('aInfo', new THREE.BufferAttribute(m.info, 2));
		g.setIndex(new THREE.BufferAttribute(m.idx, 1));
		g.computeBoundingSphere();
		const mesh = new THREE.Mesh(g, rockMat);
		mesh.matrixAutoUpdate = false;
		mesh.userData.material175 = 'stone';
		group.add(mesh);
		c.mesh = mesh;
	}
	function buildNow(c) {
		const gen = c.gen || meshChunk(field, c.i * CHUNK, c.j * CHUNK, c.k * CHUNK, CHUNK, V);
		let s;
		while (!(s = gen.next()).done);
		finish(c, s.value);
	}
	// the mouths come first: until their rock is made the ground stays closed over them
	for (const c of chunks) c.mouth = c.mouth && mouthPts.some((m) => Math.hypot(c.x - m.x, c.z - m.z) < 30) ? 2 : c.mouth ? 1 : 0;
	let queue = [], queueT = 0, lastDeep = null;
	const lastCam = new THREE.Vector3(1e9, 0, 0);
	function stream(dt, deep) {
		const cam = camera.position;
		queueT -= dt;
		// (at once after a jump, or on going down or up)
		if (queueT <= 0 || cam.distanceTo(lastCam) > 12 || deep !== lastDeep) {
			lastCam.copy(cam); lastDeep = deep;
			queueT = 0.4;
			for (const c of chunks) c.d = Math.hypot(c.x - cam.x, (c.y - cam.y) * 1.3, c.z - cam.z);
			const reach = deep ? (isPhone ? 110 : 150) : 0;
			queue = chunks.filter((c) => c.state < 2 && (c.d < reach || (c.mouth && c.d < 260) || (c.mouth === 2 && c.d < 700))).sort((a, b) => (a.mouth === 2 ? a.d - 1000 : a.d) - (b.mouth === 2 ? b.d - 1000 : b.d));
			openHoles();
			// what is drawn: all near when down here; up top only round the mouths
			for (const c of chunks) if (c.mesh) c.mesh.visible = deep ? c.d < (isPhone ? 100 : 135) : c.mouth && c.d < 420;
		}
		const t0 = performance.now(), budget = isPhone ? 3 : 5;
		while (queue.length && performance.now() - t0 < budget) {
			const c = queue[0];
			c.gen ||= meshChunk(field, c.i * CHUNK, c.j * CHUNK, c.k * CHUNK, CHUNK, V);
			c.state = 1;
			const s = c.gen.next();
			if (s.done) { finish(c, s.value); queue.shift(); if (c.mesh) c.mesh.visible = true; }
		}
	}

	// ---------- finding things in the rock ----------
	// the floor under a point (the field alone), marching down from a little above it
	function rockFloor(x, z, y) {
		let y0 = y, f = field.solid(x, y0, z);
		if (f >= 0) {
			let k = 0;
			while (f >= 0 && k++ < 5) { y0 += 0.4; f = field.solid(x, y0, z); }
			if (f >= 0) return null;
		}
		let yA = y0, fA = f;
		for (let i = 0; i < 160; i++) {
			const yB = yA - clamp(-fA * 0.7, 0.08, 1.5), fB = field.solid(x, yB, z);
			if (fB >= 0) {
				let lo = yB, hi = yA;
				for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (field.solid(x, m, z) >= 0) lo = m; else hi = m; }
				return (lo + hi) / 2;
			}
			yA = yB; fA = fB;
			if (y0 - yA > 90) return null;
		}
		return null;
	}
	// the roof over a point in the open: marching up
	function rockRoof(x, z, y, max = 60) {
		let yA = y, fA = field.cave(x, yA, z);
		if (fA >= 0) return null;
		for (let i = 0; i < 120; i++) {
			const yB = yA + clamp(-fA * 0.7, 0.08, 1.5), fB = field.cave(x, yB, z);
			if (fB >= 0) {
				let lo = yA, hi = yB;
				for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (field.cave(x, m, z) >= 0) hi = m; else lo = m; }
				return (lo + hi) / 2;
			}
			yA = yB; fA = fB;
			if (yA - y > max) return null;
		}
		return null;
	}
	// the surface's outward normal at a point near it
	function rockNormal(x, y, z) {
		const e = 0.3;
		const gx = field.solid(x + e, y, z) - field.solid(x - e, y, z), gy = field.solid(x, y + e, z) - field.solid(x, y - e, z), gz = field.solid(x, y, z + e) - field.solid(x, y, z - e);
		const l = Math.hypot(gx, gy, gz) || 1;
		return new THREE.Vector3(-gx / l, -gy / l, -gz / l);
	}
	// things built in the caves that are walked on or bumped into
	const props = [];

	// ---------- glowing places (lighting each surface) and the few real lights ----------
	const glows = [];
	const addGlow = (x, y, z, range, color, k, flick = 0, key = false) => { const g = { x, y, z, r: range, c: new THREE.Color(...color), k, flick, key, seed: r() * 100 }; glows.push(g); return g; };
	const headlamp = new THREE.PointLight(0xffe4c4, 0, 13, 1.5);
	const keyLight = new THREE.PointLight(0xffa050, 0, 26, 1.4);
	group.add(headlamp, keyLight);

	// ---------- teeth of rock: stalactites, stalagmites, columns; icicles on an ice world ----------
	const spikes = [], columns = [];
	const iceWorld = (cw.ice || 0) > 0.6;
	const clearOf = (x, z, pad) => !props.some((p) => p.keepClear && Math.hypot(p.x - x, p.z - z) < p.r + pad);
	const vill = chambers.find((c) => c.kind === 'village'), ruinsC = chambers.find((c) => c.kind === 'ruins');
	// the village and the ruins keep their floors clear
	if (vill) props.push({ keepClear: true, x: vill.x, z: vill.z, r: Math.max(vill.rx, vill.rz) * 0.9 });
	if (ruinsC) props.push({ keepClear: true, x: ruinsC.x, z: ruinsC.z, r: Math.max(ruinsC.rx, ruinsC.rz) * 0.8 });
	const inPool = (x, z, pad = 0) => chambers.some((c) => c.pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + pad));
	for (const c of chambers) {
		const n = Math.round(c.rx * c.rz / (isPhone ? 9 : 6));
		for (let i = 0; i < n; i++) {
			const a = r() * 6.283, q = Math.sqrt(r()) * 0.9;
			const lx = Math.cos(a) * q * c.rx, lz = Math.sin(a) * q * c.rz;
			const x = c.x + lx * c.cos - lz * c.sin, z = c.z + lx * c.sin + lz * c.cos;
			const fl = rockFloor(x, z, c.fy + 3);
			if (fl == null) continue;
			const roof = rockRoof(x, z, fl + 1.5, c.h + 8);
			if (roof == null) continue;
			const gap = roof - fl;
			// from the vault: many, some long
			const len = Math.min(gap * 0.45, 0.4 + Math.pow(r(), 2) * (c.h * 0.35 + 1));
			spikes.push({ x, y: roof + 0.4, z, len, rad: 0.1 + len * (0.07 + r() * 0.05), down: true });
			// from the floor, where the drips land (the villagers have long since cleared theirs)
			if (c.kind !== 'village' && r() < 0.45 && clearOf(x, z, 1) && !inPool(x, z, 0.5)) {
				if (gap < 5.5 && r() < 0.5) columns.push({ x, y: fl - 0.3, z, len: gap + 0.7, rad: 0.35 + r() * 0.5 });
				else spikes.push({ x, y: fl - 0.2, z, len: Math.min(gap * 0.4, 0.3 + Math.pow(r(), 1.5) * 3), rad: 0.2 + r() * 0.35, down: false });
			}
		}
	}
	for (const t of tunnels) {
		for (let i = 2; i < t.pts.length - 2; i += 2) {
			const p = t.pts[i];
			for (let j = 0; j < 3; j++) {
				const ox = (r() - 0.5) * p.w * 1.3, oz = (r() - 0.5) * p.w * 1.3, x = p.x + ox, z = p.z + oz;
				const roof = rockRoof(x, z, p.y + 1.2, 10);
				if (roof == null) continue;
				const len = 0.2 + Math.pow(r(), 2.5) * 1.6;
				spikes.push({ x, y: roof + 0.3, z, len, rad: 0.06 + len * 0.1, down: true });
				if (r() < 0.25 && Math.hypot(ox, oz) > p.w * 0.45) { const fl = rockFloor(x, z, p.y + 1); if (fl != null) spikes.push({ x, y: fl - 0.15, z, len: 0.2 + r() * 0.9, rad: 0.12 + r() * 0.15, down: false }); }
			}
		}
	}
	// the shape of one: a lathe of drip rings, a little bent, pointed
	function spikeGeo(segs, rings) {
		const pts = [];
		for (let i = 0; i <= rings; i++) {
			const t = i / rings;
			const rad = Math.pow(1 - t, 1.3) * (1 + 0.12 * Math.sin(t * 23)) + (t > 0.97 ? 0 : 0.02);
			pts.push(new THREE.Vector2(Math.max(0.001, rad), t));
		}
		const g = new THREE.LatheGeometry(pts, segs);
		const p = g.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const y = p.getY(i);
			p.setX(i, p.getX(i) * (1 + 0.15 * Math.sin(i * 1.7)) + y * y * 0.12);
		}
		g.computeVertexNormals();
		g.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(p.count * 2).fill(0.75).map((v, i) => (i % 2 ? 0 : v)), 2));
		return g;
	}
	const spikeMat = iceWorld ? crystalMaterial(L, [0.55, 0.8, 1.0]) : rockMaterial(L, profile, { isPhone, instanced: true });
	if (iceWorld) { spikeMat.emissiveIntensity = 0.25; spikeMat.opacity = 0.8; }
	const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3();
	function instanced(geo, mat, list, place) {
		if (!list.length) return null;
		const im = new THREE.InstancedMesh(geo, mat, list.length);
		list.forEach((o, i) => { place(o, i); im.setMatrixAt(i, m4.compose(p4, q4, s4)); });
		im.computeBoundingSphere();
		im.userData.material175 = 'stone';
		group.add(im);
		return im;
	}
	instanced(spikeGeo(isPhone ? 7 : 9, 10), spikeMat, spikes, (o) => {
		e4.set(o.down ? Math.PI + (r() - 0.5) * 0.12 : (r() - 0.5) * 0.12, r() * 6.283, (r() - 0.5) * 0.12);
		q4.setFromEuler(e4); s4.set(o.rad, o.len, o.rad); p4.set(o.x, o.y, o.z);
	});
	// columns: where a stalactite met its stalagmite, a waisted pillar
	const colGeo = (() => {
		const pts = [];
		for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.55 + 0.45 * Math.pow(Math.abs(t - 0.5) * 2, 1.6) + 0.06 * Math.sin(t * 31), t)); }
		const g = new THREE.LatheGeometry(pts, 10);
		g.computeVertexNormals();
		g.setAttribute('aInfo', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2).map((v, i) => (i % 2 ? 0 : 0.7)), 2));
		return g;
	})();
	instanced(colGeo, spikeMat, columns, (o) => { q4.setFromEuler(e4.set(0, r() * 6.283, 0)); s4.set(o.rad, o.len, o.rad); p4.set(o.x, o.y, o.z); });
	for (const c of columns) props.push({ x: c.x, z: c.z, r: c.rad * 0.9 + 0.1, y0: c.y, y1: c.y + c.len });

	// ---------- crystals ----------
	const crystals = [];
	const crystalC = { TERRAN: [0.6, 0.9, 0.8], ARID: [1.0, 0.7, 0.3], ICE: [0.5, 0.8, 1.0], MAGMA: [1.0, 0.35, 0.15], TOXIC: [0.6, 1.0, 0.3], MYSTICAL: [0.75, 0.45, 1.0], GAS: [0.45, 0.9, 1.0] }[profile.type] || glowC;
	const crystK = cw.crystals || 0;
	if (crystK > 0) {
		const nc = Math.round(crystK * (isPhone ? 26 : 40));
		for (let i = 0; i < nc; i++) {
			// on the floor at the foot of a wall, or up on the wall
			const c = chambers[Math.floor(r() * chambers.length)];
			const a = r() * 6.283, q = 0.55 + r() * 0.3;
			const lx = Math.cos(a) * q * c.rx, lz = Math.sin(a) * q * c.rz;
			const x = c.x + lx * c.cos - lz * c.sin, z = c.z + lx * c.sin + lz * c.cos;
			if (!clearOf(x, z, 1.5)) continue;
			const fl = rockFloor(x, z, c.fy + 3);
			if (fl == null) continue;
			const nrm = rockNormal(x, fl, z);
			const big = r() < 0.15;
			const k = big ? 5 + Math.floor(r() * 4) : 4 + Math.floor(r() * 6);
			for (let j = 0; j < k; j++) {
				const dir = new THREE.Vector3((r() - 0.5) * 1.3, 0, (r() - 0.5) * 1.3).add(nrm).normalize();
				const len = (big ? 1.8 + r() * 3.5 : 0.35 + Math.pow(r(), 1.5) * 1.3) * (j === 0 ? 1.3 : 1);
				crystals.push({ x: x + (r() - 0.5) * 0.6, y: fl - 0.15, z: z + (r() - 0.5) * 0.6, dir, len, rad: len * (0.12 + r() * 0.06) });
			}
			addGlow(x + nrm.x, fl + (big ? 1.8 : 0.8), z + nrm.z, big ? 14 : 8, crystalC, big ? 2.2 : 1.1, 0, big);
		}
		// a few in the tunnels too
		for (const t of tunnels) for (let i = 6; i < t.pts.length - 4; i += 9) {
			if (r() > crystK) continue;
			const p = t.pts[i], side = r() < 0.5 ? -1 : 1, nx = t.pts[i + 1].z - p.z, nz = -(t.pts[i + 1].x - p.x), l = Math.hypot(nx, nz) || 1;
			const x = p.x + nx / l * side * p.w * 0.7, z = p.z + nz / l * side * p.w * 0.7;
			const fl = rockFloor(x, z, p.y + 1.5);
			if (fl == null) continue;
			const nrm = rockNormal(x, fl + 0.2, z);
			for (let j = 0; j < 5; j++) {
				const dir = new THREE.Vector3((r() - 0.5), 0.3, (r() - 0.5)).add(nrm).normalize(), len = 0.3 + r() * 0.8;
				crystals.push({ x, y: fl - 0.1, z, dir, len, rad: len * 0.14, dirOk: true });
			}
			addGlow(x, fl + 0.7, z, 7, crystalC, 0.9);
		}
	}
	const crystalGeo = (() => {
		// a six-sided prism with a faceted point
		const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
		g.translate(0, 0.5, 0);
		const tip = new THREE.ConeGeometry(1, 0.35, 6, 1);
		tip.translate(0, 1.175, 0);
		const pos = [...g.toNonIndexed().attributes.position.array, ...tip.toNonIndexed().attributes.position.array];
		const out = new THREE.BufferGeometry();
		out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		out.computeVertexNormals();
		out.scale(1, 1 / 1.35, 1);
		return out;
	})();
	const up = new THREE.Vector3(0, 1, 0);
	// the crystals ring when struck, like glass (music.js picks them)
	const crystalIM = instanced(crystalGeo, crystalMaterial(L, crystalC), crystals, (o) => {
		q4.setFromUnitVectors(up, o.dir); s4.set(o.rad, o.len, o.rad); p4.set(o.x, o.y, o.z);
	});
	if (crystalIM) crystalIM.userData.material175 = 'crystal';

	// ---------- pools and lava ----------
	const waterTint = [0.02, 0.03, 0.035];
	const poolGeo = [], lavaGeo = [], iceGeo = [];
	for (const c of chambers) for (const p of c.pools) {
		const g = new THREE.CircleGeometry(p.r * 1.25, 40);
		g.rotateX(-Math.PI / 2);
		g.translate(p.x, p.y, p.z);
		(p.kind === 'lava' ? lavaGeo : p.kind === 'ice' ? iceGeo : poolGeo).push(g);
		if (p.kind === 'lava') {
			addGlow(p.x, p.y + 1.2, p.z, p.r * 4 + 10, [1.0, 0.38, 0.1], 3.2, 0.3, true);
			props.push({ x: p.x, z: p.z, r: p.r * 0.95, y0: p.y - 3, y1: p.y + 2, lava: true });
		}
	}
	const merge = (list) => {
		const P = [];
		for (const g of list) P.push(...g.toNonIndexed().attributes.position.array);
		const out = new THREE.BufferGeometry();
		out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		out.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(P.length).map((v, i) => (i % 3 === 1 ? 1 : 0)), 3));
		out.computeBoundingSphere();
		return out;
	};
	if (poolGeo.length) group.add(new THREE.Mesh(merge(poolGeo), waterMaterial(L, waterTint, false)));
	if (iceGeo.length) group.add(new THREE.Mesh(merge(iceGeo), waterMaterial(L, [0.35, 0.5, 0.6], true)));
	if (lavaGeo.length) group.add(new THREE.Mesh(merge(lavaGeo), lavaMaterial(shared)));

	// ---------- a stream down the floor of one passage, on a wet world ----------
	if ((cw.water || 0) > 0.5 && !iceWorld) {
		const t = tunnels.filter((q) => !q.mouth).sort((a, b) => b.pts.length - a.pts.length)[0] || tunnels[0];
		const P = [], I = [];
		const pts = t.pts;
		// it runs downhill along the passage, keeping to one side
		for (let i = 2; i < pts.length - 2; i++) {
			const a = pts[i - 1], b = pts[i + 1], p = pts[i], tl = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / tl, nz = (b.x - a.x) / tl;
			const off = p.w * 0.3 * Math.sin(i * 0.3), w = 0.35 + 0.2 * Math.sin(i * 0.7);
			for (const sd of [-1, 1]) {
				const x = p.x + nx * (off + sd * w), z = p.z + nz * (off + sd * w);
				P.push(x, (rockFloor(x, z, p.y + 1) ?? p.y) + 0.03, z);
			}
			if (i < pts.length - 3) { const k = (i - 2) * 2; I.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setIndex(I);
		g.computeVertexNormals();
		const sm = new THREE.Mesh(g, waterMaterial(L, waterTint, false));
		sm.renderOrder = 3;
		group.add(sm);
	}

	// ---------- glow worms: threads of silk from the vaults, each with a bead of light ----------
	const worms = [], threads = [];
	const nw = Math.round((isPhone ? 900 : 2200) * (cw.water > 0 || profile.type === 'MYSTICAL' ? 1 : 0.5));
	for (let i = 0, tries = 0; i < nw && tries < nw * 3; tries++) {
		// mostly in the tunnels and small halls, where the vault is low
		let x, z, y0;
		if (r() < 0.6) {
			const t = tunnels[Math.floor(r() * tunnels.length)], p = t.pts[2 + Math.floor(r() * (t.pts.length - 4))];
			if (!p) continue;
			x = p.x + (r() - 0.5) * p.w * 1.6; z = p.z + (r() - 0.5) * p.w * 1.6; y0 = p.y + 1.5;
		} else {
			const c = chambers[Math.floor(r() * chambers.length)], a = r() * 6.283, q = Math.sqrt(r()) * 0.85;
			x = c.x + Math.cos(a) * q * c.rx; z = c.z + Math.sin(a) * q * c.rz; y0 = c.fy + 2;
		}
		const roof = rockRoof(x, z, y0, 30);
		if (roof == null) continue;
		// several from the same spot of the vault
		const k = 2 + Math.floor(r() * 5);
		for (let j = 0; j < k && i < nw; j++, i++) {
			const px = x + (r() - 0.5) * 1.2, pz = z + (r() - 0.5) * 1.2, top = roof - 0.05, len = 0.08 + Math.pow(r(), 2) * 0.45;
			worms.push(px, top - len, pz);
			threads.push(px, top + 0.3, pz, px, top - len, pz);
		}
	}
	let wormPts = null;
	if (worms.length) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(worms, 3));
		g.setAttribute('aR', new THREE.Float32BufferAttribute(Array.from({ length: worms.length / 3 }, () => r()), 1));
		const wc = profile.type === 'MAGMA' ? [1.0, 0.55, 0.2] : glowC;
		wormPts = new THREE.Points(g, glowPointsMaterial(shared, wc, 0.05));
		wormPts.frustumCulled = false;
		group.add(wormPts);
		const tg = new THREE.BufferGeometry();
		tg.setAttribute('position', new THREE.Float32BufferAttribute(threads, 3));
		const tl = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(...wc).multiplyScalar(0.25), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
		tl.frustumCulled = false;
		group.add(tl);
	}

	// ---------- the sinkhole's shaft of daylight, and motes turning in it ----------
	let shaftMesh = null, motes = null;
	if (shaft) {
		const bottom = ruinsC ? ruinsC.fy : shaft.bottom - 10;
		L.U.uCvShaftY.value.set(bottom, shaft.top);
		const len = shaft.top - bottom;
		const g = new THREE.CylinderGeometry(shaft.r * 0.8, shaft.r * 1.35, len, 24, 1, true);
		shaftMesh = new THREE.Mesh(g, shaftMaterial(L));
		shaftMesh.position.set(shaft.x, bottom + len / 2, shaft.z);
		shaftMesh.renderOrder = 8;
		group.add(shaftMesh);
		const mp = [], ma = [];
		for (let i = 0; i < (isPhone ? 160 : 400); i++) {
			const a = r() * 6.283, d = Math.sqrt(r()) * shaft.r * 1.1;
			mp.push(shaft.x + Math.cos(a) * d, bottom + 0.5 + r() * Math.min(len, 30), shaft.z + Math.sin(a) * d);
			ma.push(r());
		}
		const mg = new THREE.BufferGeometry();
		mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
		mg.setAttribute('aR', new THREE.Float32BufferAttribute(ma, 1));
		motes = new THREE.Points(mg, glowPointsMaterial(shared, [1.0, 0.92, 0.75], 0.018, { drift: 0.8 }));
		motes.frustumCulled = false;
		group.add(motes);
	}

	// ---------- roots hanging through the roof of each mouth, on a world with plants ----------
	if ((profile.grass ?? 1) > 0.3 && (profile.trees ?? 1) > 0.3) {
		const roots = [];
		for (const e of entrances) {
			const pts = e.tunnel.pts;
			for (let k = 0; k < 60; k++) {
				const p = pts[1 + Math.floor(r() * 4)], px = -e.dir.z, pz = e.dir.x, s = (r() - 0.5) * p.w * 1.6;
				const x = p.x + px * s, z = p.z + pz * s;
				const roof = rockRoof(x, z, p.y + 1.2, 8);
				if (roof == null || roof > H(x, z) + 0.5) continue;
				roots.push({ x, y: roof + 0.3, z, len: 0.5 + Math.pow(r(), 1.5) * 2.8, rad: 0.006 + r() * 0.012 });
			}
		}
		const rg = new THREE.CylinderGeometry(1, 0.15, 1, 4, 8, true);
		rg.translate(0, -0.5, 0);
		{ const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 7) * 6 * y * y); p.setZ(i, p.getZ(i) + Math.cos(y * 5) * 4 * y * y); } rg.computeVertexNormals(); }
		const rm = L.lit(new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95 }), 'roots');
		instanced(rg, rm, roots, (o) => { q4.setFromEuler(e4.set((r() - 0.5) * 0.3, r() * 6.283, (r() - 0.5) * 0.3)); s4.set(o.rad, o.len, o.rad); p4.set(o.x, o.y, o.z); });
	}

	// ---------- the worn path up to each mouth ----------
	{
		const P = [], I = [], UV = [];
		for (const e of entrances) {
			const base = P.length / 3;
			const n = 12;
			for (let i = 0; i <= n; i++) {
				// out from the mouth, down the slope, wandering a little
				const t = i / n, d = -2 + t * 22;
				const wob = Math.sin(t * 5 + e.x) * 1.5 * t;
				const cx = e.x - e.dir.x * d - e.dir.z * wob, cz = e.z - e.dir.z * d + e.dir.x * wob;
				const w = 1.3 - t * 0.4;
				for (const s of [-1, 1]) {
					const x = cx - e.dir.z * s * w, z = cz + e.dir.x * s * w;
					const hy = field.inHole(x, z, 0.3) ? (rockFloor(x, z, H(x, z) + 1) ?? H(x, z)) : H(x, z);
					P.push(x, hy + 0.06, z);
					UV.push(s * 0.5 + 0.5, t);
				}
				if (i < n) I.push(base + i * 2, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 3);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
		g.setIndex(I);
		g.computeVertexNormals();
		const soil = profile.ground?.soil || [0.3, 0.24, 0.15];
		const pm = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...soil, THREE.SRGBColorSpace).multiplyScalar(0.8), roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
		pm.onBeforeCompile = (sh) => {
			sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
				{
					// worn in the middle, feathered at the edges and far end
					float n = 0.5 + 0.5 * sin(vCvW.x * 3.1 + sin(vCvW.z * 2.3)) * sin(vCvW.z * 2.7 + sin(vCvW.x * 1.9));
					float edge = 1.0 - smoothstep(0.25, 0.5, abs(vUv.x - 0.5) + n * 0.12);
					diffuseColor.a = edge * smoothstep(1.0, 0.6, vUv.y) * 0.85;
					diffuseColor.rgb *= 0.85 + n * 0.3;
				}`);
		};
		pm.defines = { USE_UV: '' };
		const pathMesh = new THREE.Mesh(g, L.lit(pm, 'path'));
		pathMesh.renderOrder = 2;
		group.add(pathMesh);
	}

	// ---------- the ruins and the village ----------
	const ctx = { group, L, profile, civ, field, shared, camera, rng: r, isPhone, rockFloor, rockRoof, rockNormal, addGlow, props, scene, glowC, crystalC, H, plan };
	// (built as you come near, a little each frame)
	let ruins = null, village = null;
	const lazy = [];
	if (ruinsC) lazy.push({ c: ruinsC, gen: null, make: () => buildRuins({ ...ctx, chamber: ruinsC, shaft }), done: (o) => { ruins = o; } });
	if (vill) lazy.push({ c: vill, gen: null, make: () => createCaveVillage({ ...ctx, chamber: vill }), done: (o) => { village = o; } });
	function growLazy(all = false) {
		const cam = camera.position, t0 = performance.now();
		for (const L2 of lazy) {
			if (L2.built || (!all && Math.hypot(L2.c.x - cam.x, L2.c.z - cam.z) > 260)) continue;
			L2.gen ||= L2.make();
			while (all || performance.now() - t0 < (isPhone ? 4 : 6)) {
				const s = L2.gen.next();
				if (s.done) { L2.built = true; L2.done(s.value); break; }
			}
			if (!all) return;
		}
	}

	// ---------- where mushrooms may grow ----------
	const spots = [];
	{
		const near = (x, z, list, d) => list.some((o) => Math.hypot(o.x - x, o.z - z) < d);
		const glowSpots = glows.filter((g) => !g.flick);
		const add = (x, z, yGuess) => {
			if (!clearOf(x, z, 0.5) || inPool(x, z, 0.6)) return;
			const y = rockFloor(x, z, yGuess);
			if (y == null) return;
			const n = rockNormal(x, y + 0.1, z);
			if (n.y < 0.75) return;
			const kind = near(x, z, glowSpots, 6) ? 'glow' : (inPool(x, z, 4) || (cw.water > 0.6 && r() < 0.4)) ? 'damp' : 'dark';
			spots.push({ x, y, z, kind });
		};
		for (const t of tunnels) for (let i = 4; i < t.pts.length - 2; i += 3) {
			const p = t.pts[i], s = r() < 0.5 ? -1 : 1, a = Math.atan2(t.pts[i + 1].z - p.z, t.pts[i + 1].x - p.x) + Math.PI / 2;
			add(p.x + Math.cos(a) * s * p.w * 0.55, p.z + Math.sin(a) * s * p.w * 0.55, p.y + 1.2);
		}
		for (const c of chambers) for (let i = 0; i < 14; i++) {
			const a = r() * 6.283, q = 0.5 + r() * 0.4;
			add(c.x + Math.cos(a) * q * c.rx, c.z + Math.sin(a) * q * c.rz, c.fy + 3);
		}
	}

	// ---------- the entrances as the world lists them ----------
	const names = NAMES[civ.ruin] || NAMES.stone;
	const list = entrances.map((e, i) => ({ x: e.x, z: e.z, y: e.y, yaw: e.yaw, name: names[i % names.length] }));

	// ---------- sound: a low room tone, and drips falling in the dark ----------
	let snd = null;
	function sound(k, dt) {
		const S = soundBus();
		if (!S) return;
		if (!snd || snd.ctx !== S.ctx) {
			if (k < 0.05) return;
			const ctx = S.ctx, out = ctx.createGain();
			out.gain.value = 0;
			out.connect(S.out);
			// the room: a deep brown hush
			const room = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), rg = ctx.createGain();
			room.buffer = noise(ctx, 'brown'); room.loop = true;
			lp.type = 'lowpass'; lp.frequency.value = 260; rg.gain.value = 0.05;
			room.connect(lp).connect(rg).connect(out); room.start();
			// the echo of a hall
			const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain(), dlp = ctx.createBiquadFilter();
			dl.delayTime.value = 0.23; fb.gain.value = 0.42; wet.gain.value = 0.5; dlp.type = 'lowpass'; dlp.frequency.value = 2400;
			dl.connect(dlp).connect(fb).connect(dl); dlp.connect(wet).connect(out);
			snd = { ctx, out, dl, room, next: 1 };
		}
		const ctx = snd.ctx;
		snd.out.gain.setTargetAtTime(k * 0.6, ctx.currentTime, 0.6);
		snd.next -= dt;
		if (k > 0.2 && snd.next < 0 && (cw.water > 0 || cw.ice > 0)) {
			snd.next = 0.25 + Math.random() * 2.2;
			// a drop: a short falling blip, now near, now far
			const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), f = 900 + Math.random() * 1400, lv = (0.004 + Math.random() * 0.012) * k;
			o.type = 'sine';
			o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.05);
			g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(lv, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
			o.connect(g); g.connect(snd.out); g.connect(snd.dl);
			o.start(t); o.stop(t + 0.14);
		}
	}

	// ---------- each frame ----------
	let inK = 0, snapK = false;
	const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
	const fogC = new THREE.Color(...glowC).multiplyScalar(0.035).lerp(new THREE.Color(0.012, 0.012, 0.014), 0.5);
	function update(dt, t) {
		dinos?.update(dt, t);
		const cam = camera.position;
		// how far underground the camera is
		let target = 0;
		if (field.near(cam.x, cam.z)) {
			const c = field.cave(cam.x, cam.y, cam.z);
			if (c < 1.5) target = smoothstep(0.5, 8, H(cam.x, cam.z) - cam.y);
		}
		// (others underground, as a realm's dungeons, say how far in the camera is too)
		if (api.extraInside) target = Math.max(target, api.extraInside());
		inK += (target - inK) * (snapK ? 1 : Math.min(1, dt * 2.5));
		snapK = false;
		if (inK < 1e-3) inK = 0;
		shared.uCave.value = inK;
		L.U.uCvIn.value = inK;
		// the cube-by-cube rock: near the mouths from afar, everything near once down here
		const nearAny = mouthPts.some((m) => Math.hypot(m.x - cam.x, m.z - cam.z) < 260) || inK > 0.02;
		stream(dt, inK > 0.02 || chambers.some((c) => Math.hypot(c.x - cam.x, c.z - cam.z) < 80 && cam.y < c.fy + c.h + 20));
		group.visible = nearAny || inK > 0;
		if (!group.visible) { headlamp.intensity = 0; keyLight.intensity = 0; sound(0, dt); return; }
		// daylight down the shaft follows the sun
		const sunUp = smoothstep(-0.05, 0.3, shared.uSunDir.value.y);
		L.U.uCvSunC.value.copy(shared.uSunColor.value).multiplyScalar(sunUp * 1.4);
		if (shaftMesh) shaftMesh.material.uniforms.uK.value = sunUp;
		// the nearest glowing places light the rock
		const scored = [];
		for (const g of glows) { const d = Math.hypot(g.x - cam.x, g.y - cam.y, g.z - cam.z) - g.r; if (d < 60) scored.push([d, g]); }
		scored.sort((a, b) => a[0] - b[0]);
		const P = L.U.uCvFakeP.value, C = L.U.uCvFakeC.value;
		let key = null;
		for (let i = 0; i < FAKE; i++) {
			const g = scored[i]?.[1];
			if (!g) { P[i].set(0, 0, 0, 0); continue; }
			const fl = g.flick ? 1 - g.flick * (0.5 + 0.5 * Math.sin(t * 7.3 + g.seed) * Math.sin(t * 3.1 + g.seed * 2)) : 1;
			P[i].set(g.x, g.y, g.z, g.r);
			C[i].set(g.c.r, g.c.g, g.c.b).multiplyScalar(g.k * fl);
			if (g.key && !key) key = g;
		}
		// one real light at the strongest near source (a fire, the lava), and your lamp
		if (key) {
			keyLight.position.set(key.x, key.y, key.z);
			keyLight.color.copy(key.c);
			const d = Math.hypot(key.x - cam.x, key.y - cam.y, key.z - cam.z);
			keyLight.distance = key.r * 1.4;
			keyLight.intensity = key.k * 6 * clamp(1.2 - d / (key.r * 2.5), 0, 1) * (key.flick ? 0.85 + 0.15 * Math.sin(t * 9.1 + key.seed) : 1);
		} else keyLight.intensity = 0;
		camera.getWorldDirection(fwd);
		headlamp.position.copy(cam).addScaledVector(fwd, 0.4).add(tmp.set(0, 0.15, 0));
		headlamp.intensity = smoothstep(0.3, 0.7, inK) * 5.5;
		growLazy();
		ruins?.update(dt, t);
		village?.update(dt, t, opts.player?.());
		if (wormPts) wormPts.material.uniforms.uPx.value = 1;
		sound(inK, dt);
		// a word as you step in
		if (inK > 0.35 && !update.named) {
			update.named = true;
			let best = null, bd = 1e9;
			for (const e of list) { const d = Math.hypot(e.x - cam.x, e.z - cam.z); if (d < bd) { bd = d; best = e; } }
			if (best && bd < 80) opts.hint?.(`${best.name}\nIt is dark in here: your lamp comes on.`, 4000);
		}
		if (inK < 0.05) update.named = false;
	}

	// ---------- walking ----------
	// the floor under (x, z) when (x, y, z) is in the caves (or at a mouth), else null
	function floor(x, z, y) {
		if (!field.near(x, z)) return null;
		const hole = field.inHole(x, z, 1.5);
		let y0 = y + 0.6;
		if (field.cave(x, y0, z) >= 0 && !hole) {
			// the head may be in the open while the feet are in a bump
			if (field.cave(x, y0 + 1.1, z) >= 0) return null;
			y0 += 1.1;
		}
		let g = rockFloor(x, z, y0);
		if (g == null) return null;
		for (const p of props) if (p.floor) { const f = p.floor(x, z, y); if (f != null && f > g) g = f; }
		return g;
	}
	// keep a body (eye at p) out of the rock and the things built in it
	function push(p, footY) {
		if (!field.near(p.x, p.z)) return;
		const inCave = field.cave(p.x, footY + 1, p.z) < 1.5 || field.inHole(p.x, p.z, 3);
		if (!inCave) return;
		for (const hy of [0.95, 1.55]) {
			const y = footY + hy, f = field.solid(p.x, y, p.z), R = 0.35;
			if (f <= -R) continue;
			const e = 0.25, gx = (field.solid(p.x + e, y, p.z) - field.solid(p.x - e, y, p.z)) / (2 * e), gz = (field.solid(p.x, y, p.z + e) - field.solid(p.x, y, p.z - e)) / (2 * e);
			const gl = Math.hypot(gx, gz);
			if (gl < 0.25) continue;
			const m = Math.min(0.5, (f + R) / gl);
			p.x -= gx / gl * m; p.z -= gz / gl * m;
		}
		for (const o of props) {
			if (o.push) { o.push(p, footY); continue; }
			if (o.r == null || o.keepClear || footY > o.y1 || footY + 1.7 < o.y0) continue;
			const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + 0.35;
			if (d < min && d > 1e-4) { p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; }
		}
	}
	// to the entrance, just inside, looking in
	function go(i = 0) {
		const e = entrances[((i % entrances.length) + entrances.length) % entrances.length];
		const P = opts.player?.();
		if (!e || !P) return 'no entrance';
		const pts = e.tunnel.pts, a = pts[Math.min(3, pts.length - 1)], b = pts[Math.min(6, pts.length - 1)];
		const fl = floor(a.x, a.z, a.y + 1) ?? a.y;
		P.flying = false; P.diving = false; P.swimming = false;
		P.vel.set(0, 0, 0);
		P.pos.set(a.x, fl + EYE, a.z);
		P.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
		P.pitch = -0.08;
		camera.position.copy(P.pos);
		snapK = true;
		// make the way in ready at once
		for (const c of chunks) if (c.state < 2 && Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z) < 60) buildNow(c);
		openHoles();
		return list[entrances.indexOf(e)].name;
	}
	function dispose() {
		dinos?.dispose();
		scene.remove(group);
		group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
		village?.dispose();
		for (const v of shared.uHoles.value) v.set(0, 0, 0, 0);
		shared.uCave.value = 0;
		if (snd) { try { snd.out.disconnect(); snd.room.stop(); } catch { /* already stopped */ } snd = null; }
	}
	const api = {
		update, floor, push, go, dispose, entrances: list, spots,
		pickables: [...(crystalIM ? [crystalIM] : []), ...(dinos?.pickables || [])],
		dinosaurs: dinos,
		inside: () => inK,
		// for others building underground: a glowing place to light the rock, and the lighting
		addGlow, lighting: L, openHoles,
		fog: () => [fogC.r, fogC.g, fogC.b],
		plan, group,
		// build everything at once (for looking around in tests)
		buildAll: () => { for (const c of chunks) if (c.state < 2) buildNow(c); growLazy(true); openHoles(); return chunks.length; },
		village: () => village, ruins: () => ruins,
		// after moving the camera by hand: take the new depth at once
		settle: () => { snapK = true; },
		// what it costs, for looking into it
		stats: () => ({ chunks: chunks.length, built: chunks.filter((c) => c.state === 2).length, meshes: chunks.filter((c) => c.mesh).length, visible: chunks.filter((c) => c.mesh?.visible).length, tris: chunks.reduce((s, c) => s + (c.mesh?.visible ? c.mesh.geometry.index.count / 3 : 0), 0), spikes: spikes.length, crystals: crystals.length, worms: worms.length / 3, glows: glows.length, spots: spots.length }),
		extraInside: null,
	};
	return api;
}
