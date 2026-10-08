// Cars in a fight: the street's traffic and the parked cars near you are boxes in the combat
// layer, each tyre a small box of its own. Damage shows in stages: a few hits and steam from
// the bonnet, more and black smoke, then fire, then a blast (not graphic: a fireball and a
// shudder) that leaves a burnt shell where the car stood. A shot tyre goes flat and the car
// limps to a stop. Whoever was driving gets out and runs. A burning car can set its neighbours
// (and the building beside it) alight (combat/fire.js).

import * as THREE from 'three';
import { specOf, wheelHubs, carGeometry } from '../bay/cars.js';
import { createHealth, applyDamage } from './health.js';

const _m = new THREE.Matrix4();
const shells = new Map();
const shellMat = new THREE.MeshStandardMaterial({ color: 0x1a1715, roughness: 0.95, metalness: 0.2 });
const shellGeo = (kind) => { if (!shells.has(kind)) { try { shells.set(kind, carGeometry(kind, 18, 8, { wheels: false })); } catch { shells.set(kind, new THREE.BoxGeometry(1.8, 1.4, 4.4).translate(0, 0.7, 0)); } } return shells.get(kind); };

export function createCars(ctx) {
	const { layer, fx } = ctx;
	const group = new THREE.Group(); group.name = 'combat-cars';
	const state = new Map();          // car id -> { H, stage, flat, burnT, x, z, yaw, kind, ref, T }
	const wrecks = [];
	let scanT = 0;

	const idOf = (c) => 'car:' + (c.id ?? `${Math.round(c.x)},${Math.round(c.z)}`);
	function shapes(S) {
		const sp = specOf(S.kind), c = Math.cos(S.yaw), s = Math.sin(S.yaw), out = [{ type: 'box', c: { x: S.x, y: S.y + sp.H / 2, z: S.z }, h: [sp.W / 2, sp.H / 2, sp.L / 2], yaw: S.yaw, part: 'body' }];
		for (const [hx, hy, hz] of wheelHubs(S.kind)) out.push({ type: 'box', c: { x: S.x + hx * c + hz * s, y: S.y + hy, z: S.z - hx * s + hz * c }, h: [0.14, hy, hy], yaw: S.yaw, part: 'wheel' });
		return out;
	}
	function track(c, traffic) {
		const id = idOf(c);
		let S = state.get(id);
		const x = traffic ? c.px : c.x, z = traffic ? c.pz : c.z;
		if (!S) {
			S = { id, kind: c.kind, H: createHealth({ max: 260, resist: { pierce: 0.3, energy: 1.2, blast: 1.5 } }), stage: 0, flat: 0, burnT: 0, ref: c, traffic, x, y: 0, z, yaw: c.yaw || 0, emit: 0 };
			S.T = { id, kind: 'car', faction: 'world', surface: 'metal', name: 'a car', bound: { x, y: 0, z, r: 3 }, shapes: () => shapes(S), onHit: (blow) => hit(S, blow) };
			state.set(id, S);
		}
		S.ref = c; S.x = x; S.z = z; S.yaw = c.yaw || 0; S.y = traffic ? c.py ?? ctx.ground(x, z, 0) : c.y ?? ctx.ground(x, z, 0);
		S.T.bound.x = x; S.T.bound.y = S.y + 0.8; S.T.bound.z = z;
		if (S.stage < 4 && !layer.get(id)) { S.T.removed = false; layer.add(S.T); }
		return S;
	}
	function hit(S, blow) {
		if (S.stage >= 4) return null;
		if (blow.part === 'wheel') {
			if (S.flat < 4) { S.flat++; fx.dust({ x: S.x, y: S.y + 0.3, z: S.z }, 3, 0.4, 0.4, 0.4, 0.3); if (S.traffic) S.ref.vmax = Math.max(0, (S.ref.vmax || 10) * 0.35); }
			return { dealt: 0 };
		}
		const r = applyDamage(S.H, blow);
		// the driver gets out and runs at the first trouble
		if (S.traffic && !S.fled) {
			S.fled = true; S.ref.held = true;
			const life = ctx.world()?.vehicles?.life, b = life?.pull?.(S.ref);
			if (b) { const from = blow.src || ctx.eye(); life.flee(b, S.x + Math.cos(S.yaw) * 1.8, S.z - Math.sin(S.yaw) * 1.8, from); }
		}
		if (blow.type === 'fire' || blow.type === 'blast') S.H.hp = Math.max(0, S.H.hp - blow.amount * 0.5);
		stage(S);
		return r;
	}
	function stage(S) {
		const f = S.H.hp / S.H.max;
		const st = S.H.state !== 'ok' || f <= 0 ? 3 : f < 0.3 ? 2 : f < 0.65 ? 1 : 0;
		if (st > S.stage) {
			S.stage = st;
			if (st === 3) { S.burnT = 6 + Math.random() * 3; ctx.ignite?.(S.id, S.x, S.z, 1, true); }
		}
	}
	// set alight (fire.js): it burns down to the blast
	function burn(id) { const S = state.get(id); if (S && S.stage < 3) { S.H.hp = 0; S.H.state = 'dead'; stage(S); } }
	function explode(S) {
		S.stage = 4;
		layer.remove(S.id);
		const p = new THREE.Vector3(S.x, S.y + 0.8, S.z);
		fx.explosion(p, 4);
		ctx.blast(p, 6, 90, S.lastBy || null, S.T);
		ctx.shake?.(0.6, p);
		// the shell where it stood; the street's own car taken away
		const St = ctx.world()?.street;
		if (S.traffic) St?.remove(S.ref); else if (S.ref.id !== undefined) St?.hide(S.ref.id, true);
		const m = new THREE.Mesh(shellGeo(S.kind), shellMat);
		if (St?.carMatrix) St.carMatrix(_m, S.kind, S.x, S.z, S.yaw); else _m.makeRotationY(S.yaw).setPosition(S.x, S.y, S.z);
		m.matrixAutoUpdate = false; m.matrix.copy(_m);
		group.add(m);
		wrecks.push({ m, x: S.x, z: S.z, smoke: 40, id: S.id });
		while (wrecks.length > 6) { const w = wrecks.shift(); group.remove(w.m); }
		ctx.onDestroyed?.(S);
	}

	function update(dt, me) {
		scanT -= dt;
		const W = ctx.world(), St = W?.street;
		if (scanT <= 0 && St) {
			scanT = 0.25;
			for (const c of St.cars) if (c.px !== undefined && Math.abs(c.px - me.x) < 80 && Math.abs(c.pz - me.z) < 80) track(c, true);
			for (const c of St.parkedNear(me.x, me.z, 60)) track(c, false);
			// forget what is far and whole
			for (const [id, S] of state) if (Math.hypot(S.x - me.x, S.z - me.z) > 140 && S.stage < 3) { layer.remove(id); state.delete(id); }
		}
		for (const S of state.values()) {
			if (S.stage === 0 || S.stage >= 4) continue;
			if (S.traffic) { S.x = S.ref.px ?? S.x; S.z = S.ref.pz ?? S.z; }
			S.emit -= dt;
			if (S.emit > 0) continue;
			const sp = specOf(S.kind), fx2 = Math.sin(S.yaw) * sp.L * 0.32, fz = Math.cos(S.yaw) * sp.L * 0.32;
			const bonnet = { x: S.x + fx2, y: S.y + sp.H * 0.8, z: S.z + fz };
			if (S.stage === 1) { S.emit = 0.25; fx.smokePuff(bonnet, 0.75, 0.5, 1.6); }
			else if (S.stage === 2) { S.emit = 0.12; fx.smokePuff(bonnet, 0.12, 0.9, 2.6); }
			else if (S.stage === 3) {
				S.emit = 0.04;
				fx.flame(bonnet, 1.2); fx.flame({ x: S.x, y: S.y + sp.H * 0.7, z: S.z }, 1);
				if (Math.random() < 0.3) fx.smokePuff({ x: S.x, y: S.y + sp.H + 0.5, z: S.z }, 0.08, 1.4, 3);
				S.burnT -= 0.04;
				if (S.burnT <= 0) explode(S);
			}
		}
		for (const w of wrecks) if (w.smoke > 0) { w.smoke -= dt; if (Math.random() < dt * 4) fx.smokePuff({ x: w.x, y: ctx.ground(w.x, w.z, 0) + 1.3, z: w.z }, 0.1, 1, 3); }
	}
	// fire's neighbours: cars that can burn near (x, z)
	const flammable = (x, z, r) => [...state.values()].filter((S) => S.stage < 3 && Math.hypot(S.x - x, S.z - z) < r).map((S) => ({ id: S.id, x: S.x, z: S.z, fuel: 0.9 }));
	function clear() { for (const id of state.keys()) layer.remove(id); state.clear(); for (const w of wrecks) group.remove(w.m); wrecks.length = 0; }
	const info = () => ({ tracked: state.size, damaged: [...state.values()].filter((S) => S.stage > 0).map((S) => [S.id, S.stage, Math.round(S.H.hp), S.flat]), wrecks: wrecks.length });
	return { group, update, burn, flammable, clear, info, state };
}
