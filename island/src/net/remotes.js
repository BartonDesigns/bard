// Friends in the room, drawn: each one a MakeHuman body from their own seed (the same body
// they see as themselves, people/avatar.js), walked by the same motion rig as everyone
// else's. Poses arrive about ten times a second and are played back about 150 ms late, so
// there are always two to move between. A name tag floats over each. Far away, or past the
// phone's few, a friend is only their tag.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { carGeometry } from '../bay/cars.js';

const EYE = 1.68, DELAY = 0.15, KEEP = 1.2;

// where a buffer of timed poses puts someone at time t (seconds): between the two either side,
// or a little past the last one, then held
export function sample(buf, t, out = {}) {
	if (!buf.length) return null;
	let a = buf[0], b = null;
	for (let i = 1; i < buf.length; i++) { if (buf[i].t > t) { b = buf[i]; break; } a = buf[i]; }
	if (!b) {
		// past the newest: carry on at its speed for a moment, then stop
		const prev = buf.length > 1 ? buf[buf.length - 2] : null, dt = prev ? a.t - prev.t : 0;
		const over = Math.max(0, Math.min(0.25, t - a.t));
		for (let k = 0; k < 3; k++) out[k] = a.p[k] + (prev && dt > 0 ? (a.p[k] - prev.p[k]) / dt * over : 0);
		out.y = a.y; out.a = a.a; out.v = a.v; out.speed = prev && dt > 0 ? Math.hypot(a.p[0] - prev.p[0], a.p[2] - prev.p[2]) / dt : 0;
		if (over >= 0.25) out.speed = 0;
		return out;
	}
	if (t <= a.t) { for (let k = 0; k < 3; k++) out[k] = a.p[k]; out.y = a.y; out.a = a.a; out.v = a.v; out.speed = 0; return out; }
	const u = (t - a.t) / (b.t - a.t || 1);
	for (let k = 0; k < 3; k++) out[k] = a.p[k] + (b.p[k] - a.p[k]) * u;
	const dy = Math.atan2(Math.sin(b.y - a.y), Math.cos(b.y - a.y));
	out.y = a.y + dy * u; out.a = u < 0.5 ? a.a : b.a; out.v = u < 0.5 ? a.v : b.v;
	out.speed = Math.hypot(b.p[0] - a.p[0], b.p[2] - a.p[2]) / Math.max(0.01, b.t - a.t);
	return out;
}

export function createRemotes({ scene, camera, world, isPhone }) {
	const group = new THREE.Group(); group.name = 'friends';
	const bodies = isPhone ? 3 : 7, near = isPhone ? 140 : 260;
	const list = new Map();
	let assets = null, carGeo = null;
	const carMat = new THREE.MeshStandardMaterial({ color: 0x3a6f8f, roughness: 0.45, metalness: 0.3 });
	const boatMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.7 });
	const boatGeo = new THREE.BoxGeometry(1.6, 0.6, 4.2);
	const ground = (x, z) => world()?.island?.heightAt(x, z) ?? 0;

	function tag(name) {
		const c = document.createElement('canvas'), g = c.getContext('2d');
		c.width = 256; c.height = 64;
		g.font = '600 26px system-ui';
		const label = name.length > 16 ? name.slice(0, 15) + '…' : name, w = Math.min(240, g.measureText(label).width + 40);
		g.fillStyle = 'rgba(8,20,26,.7)';
		g.beginPath(); g.roundRect?.((256 - w) / 2, 8, w, 46, 23); g.fill();
		g.fillStyle = '#9ff0d8'; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.fillText(label, 128, 32);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false, toneMapped: false }));
		sp.scale.set(0.16, 0.04, 1);
		sp.renderOrder = 9;
		return sp;
	}

	function add(p) {
		if (list.has(p.id)) { const r = list.get(p.id); if (r.name !== p.name) rename(r, p.name); return r; }
		const r = { id: p.id, name: p.name, seed: p.look?.seed || 1, buf: [], at: {}, tag: tag(p.name), body: null, building: false, vehicle: null, shown: false, d: Infinity, pose: null };
		group.add(r.tag);
		list.set(p.id, r);
		if (p.pose) push(p.id, p.pose);
		return r;
	}
	function rename(r, name) { r.name = name; group.remove(r.tag); r.tag.material.map.dispose(); r.tag.material.dispose(); r.tag = tag(name); group.add(r.tag); }
	function remove(id) {
		const r = list.get(id);
		if (!r) return;
		group.remove(r.tag); r.tag.material.map.dispose(); r.tag.material.dispose();
		if (r.body) group.remove(r.body.P.root);
		if (r.vehicle) group.remove(r.vehicle);
		list.delete(id);
	}
	function clear() { for (const id of [...list.keys()]) remove(id); }
	// a pose heard from the room
	function push(id, pose) {
		const r = list.get(id);
		if (!r) return;
		const t = performance.now() / 1000;
		r.pose = pose;
		r.buf.push({ t, p: pose.p, y: pose.y, a: pose.a, v: pose.v || '' });
		while (r.buf.length > 2 && r.buf[1].t < t - KEEP) r.buf.shift();
	}

	async function build(r) {
		r.building = true;
		try {
			assets = assets || await loadPeopleAssets();
			const P = buildPerson(assets, personDNA(r.seed, { age: 30 }));
			const M = createMotion(P, (x, z) => ground(x, z));
			P.root.visible = false;
			r.body = { P, M, placed: false };
			if (list.get(r.id) === r) group.add(P.root);
		} catch (e) { console.warn('[friends] body', e); }
		r.building = false;
	}
	function vehicleFor(r, kind) {
		if (r.vehicleKind === kind) return r.vehicle;
		if (r.vehicle) group.remove(r.vehicle);
		r.vehicle = null; r.vehicleKind = kind;
		if (kind === 'car') { carGeo = carGeo || carGeometry('sedan'); r.vehicle = new THREE.Mesh(carGeo, carMat); }
		else if (kind === 'boat') { r.vehicle = new THREE.Mesh(boatGeo, boatMat); }
		if (r.vehicle) group.add(r.vehicle);
		return r.vehicle;
	}

	const tmp = new THREE.Vector3();
	// sameWorld(pose) says whether a friend is on this world
	function update(dt, time, sameWorld) {
		if (group.parent !== scene) scene.add(group);
		const t = performance.now() / 1000 - DELAY, cam = camera.position;
		// the nearest few get bodies
		const ranked = [...list.values()].filter((r) => r.buf.length && sameWorld(r.pose));
		for (const r of list.values()) r.d = Infinity;
		for (const r of ranked) { const a = sample(r.buf, t, r.at); r.d = Math.hypot(a[0] - cam.x, a[2] - cam.z); }
		ranked.sort((a, b) => a.d - b.d);
		const bodied = new Set(ranked.slice(0, bodies).filter((r) => r.d < near));
		for (const r of list.values()) {
			const a = r.at, here = r.d < Infinity;
			r.tag.visible = here;
			const want = here && bodied.has(r);
			if (want && !r.body && !r.building) build(r);
			const B = r.body;
			if (B) B.P.root.visible = want;
			const veh = here ? vehicleFor(r, a.v || '') : vehicleFor(r, '');
			if (!here) continue;
			const feet = a[1] - EYE, heading = Math.atan2(-Math.sin(a.y), -Math.cos(a.y));
			if (veh) {
				veh.visible = r.d < near * 2;
				veh.position.set(a[0], a.v === 'boat' ? Math.max(a[1] - 2.2, 0) : ground(a[0], a[2]), a[2]);
				veh.rotation.set(0, heading, 0);
			}
			let top = a[1] + 0.55;
			if (want && B) {
				const M = B.M;
				if (!B.placed) { M.place(a[0], feet, a[2], heading); B.placed = true; }
				M.want.heading = heading;
				M.want.speed = a.a === 'fly' || a.a === 'drive' || a.v ? 0 : Math.min(12, a.speed);
				M.want.run = a.a === 'run' ? 1 : 0;
				if (a.a === 'drive' || a.v) M.sit(0.5); else M.stand();
				M.update(Math.min(dt, 0.05), time, cam);
				M.S.pos.set(a[0], feet, a[2]);
				if (a.a === 'drive' || a.v === 'car') M.S.pos.y = (veh ? veh.position.y : feet) + 0.15;
				B.P.root.position.copy(M.S.pos);
				// flying and swimming: laid out along the way they go
				if (a.a === 'fly') { B.P.root.position.y = a[1] - 1.0; B.P.root.rotation.set(1.25, heading, 0, 'YXZ'); top = a[1] + 0.2; }
				else if (a.a === 'swim') { B.P.root.position.y = a[1] - 1.9; B.P.root.rotation.set(1.3, heading, 0, 'YXZ'); top = a[1] - 0.9; }
				B.P.lod?.(r.d);
			}
			r.tag.position.set(a[0], top + 0.35, a[2]);
		}
	}
	// a friend's tag on the screen near (px, py), for tapping
	function pick(px, py, w, h, cam) {
		let best = null, bd = 48;
		for (const r of list.values()) {
			if (!r.tag.visible) continue;
			tmp.copy(r.tag.position).project(cam);
			if (tmp.z > 1) continue;
			const sx = (tmp.x + 1) / 2 * w, sy = (1 - tmp.y) / 2 * h, d = Math.hypot(sx - px, sy - py);
			if (d < bd) { bd = d; best = r; }
		}
		return best;
	}
	function detach() { group.parent?.remove(group); for (const r of list.values()) if (r.body) r.body.placed = false; }
	return { add, remove, clear, push, update, pick, detach, list, group, where: (id) => list.get(id)?.at };
}
