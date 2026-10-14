// The police: the Harbour Police in their cruisers, answering crime (a fight in the street, a
// gang's gunfire) and the wanted level (combat/heat.js; how many come is rules.policePlan).
// A cruiser drives in by road (military/route.js) from the nearest police station when there is
// one (stationAt, from the stations' own module once it is merged) or from out of sight up the
// road, its light bar flashing red and blue and its siren wailing through the world's sound bus;
// it pulls up, two officers get out and do their work (combat's squads), and when it is over
// they drive off. A parked cruiser is solid, and can be taken like any car. At four stars and
// more they call the military (military/dispatch.js) for backup.
//
// The cruisers are the town's own sedan (vehicles/fleet.js) in navy, with white doors and the
// light bar drawn over them, instanced: a handful of draws for all of them.

import * as THREE from 'three';
import { createFleet } from '../vehicles/fleet.js';
import { STATIC_CARS } from '../vehicles/registry.js';
import { specOf } from '../bay/cars.js';
import { roadRoute, along } from './route.js';
import { policePlan } from './rules.js';
import { sirenSound } from './sound.js';

const MAX = 4, NAVY = new THREE.Color('#141a2c');
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0), _o = new THREE.Matrix4();
let seq = 1;

export function createPolice({ world, combat, group, isPhone, night, backup = null }) {
	const W = () => world();
	const fleet = createFleet(group, { cap: MAX + 2, isPhone, night });
	const S = specOf('sedan');
	const cruisers = [];
	let stationAt = null, calmT = 0;
	// the light bar's base, its red and blue lamps (flashing), and the white doors: instanced
	const inst = (geo, mat, n = MAX + 2) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; group.add(m); return m; };
	const red = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }), blue = new THREE.MeshBasicMaterial({ color: 0x2a50ff, toneMapped: false });
	const barBase = inst(new THREE.BoxGeometry(1.25, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.5 }));
	const lampR = inst(new THREE.BoxGeometry(0.52, 0.1, 0.24), red), lampB = inst(new THREE.BoxGeometry(0.52, 0.1, 0.24), blue);
	const doors = inst(new THREE.BoxGeometry(S.W + 0.03, 0.42, 1.95), new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.35, metalness: 0.1 }));
	const near = () => { const w = W(); return w?.real?.loaded?.() ? (x, z, r) => w.real.near('roads', x, z, r) : null; };
	const ground = (x, z, y = 1e4) => { const I = W().island; return Math.max(I.heightAt(x, z), I.extraFloor ? I.extraFloor(x, z, y) : -1e9); };
	const eye = () => W()?.player?.state?.pos;

	// where a cruiser comes from: the station near the trouble, or a road out of sight of it
	function origin(to) {
		const st = stationAt?.(to.x, to.z);
		if (st && Math.hypot(st.x - to.x, st.z - to.z) < 3000) return { x: st.x, z: st.z, station: st.name || 'the station' };
		const e = eye(), P = W().player.state, back = P ? P.yaw : 0;
		const a = back + (Math.random() - 0.5) * 1.2, d = 200 + Math.random() * 80;
		let x = to.x + Math.sin(a) * d, z = to.z + Math.cos(a) * d;
		// (onto a road there, if one is near)
		const R = near()?.(x, z, 120) || [];
		let bd = 1e9;
		for (const r of R) for (let i = 0; i < r.pts.length; i += 2) { const q = Math.hypot(r.pts[i] - x, r.pts[i + 1] - z); if (q < bd && Math.hypot(r.pts[i] - (e?.x ?? to.x), r.pts[i + 1] - (e?.z ?? to.z)) > 150) { bd = q; x = r.pts[i]; z = r.pts[i + 1]; } }
		return { x, z };
	}
	function send(to, why, officers = 2, alert = false) {
		if (cruisers.filter((c) => c.state !== 'leaving').length >= MAX) return null;
		const from = origin(to), route = roadRoute(near(), from, to, { maxSteps: 20 });
		const c = { id: 'pc' + seq++, why, to: { ...to }, route, s: 0, pos: new THREE.Vector3(from.x, ground(from.x, from.z), from.z), yaw: 0, state: 'responding', officers, alert, t: 0, siren: null, spin: 0, quiet: 0 };
		cruisers.push(c);
		return c;
	}
	// the wanted level (combat's hooks.police): true when the police took the call
	function respond(stars, R, have) {
		const e = eye();
		if (!e || !W()?.bayArea) return false;
		const plan = policePlan(stars, R.officers, have + cruisers.filter((c) => c.state !== 'leaving').length * 2);
		for (let i = 0; i < Math.min(2, plan.cruisers); i++) send({ x: e.x, z: e.z }, 'wanted', 2, true);
		if (plan.cruisers && Math.random() < 0.6) combat.call?.(stars >= 3 ? 'Dispatch: all units, suspect is armed and dangerous.' : 'Dispatch: units responding.', 'Harbour Police');
		if (plan.backup) backup?.({ kind: 'wanted', x: e.x, z: e.z, severity: plan.backup === 'air' ? 3 : 2 });
		return true;
	}
	// trouble reported (a brawl, a gang's gunfire): one cruiser to the scene
	function event(e) {
		if (cruisers.some((c) => c.state !== 'leaving' && Math.hypot(c.to.x - e.x, c.to.z - e.z) < 120)) return null;
		const c = send({ x: e.x, z: e.z }, e.kind, e.kind === 'gang' ? 3 : 2, e.kind === 'gang');
		if (c) combat.call?.(e.kind === 'gang' ? 'Dispatch: shots fired, units responding.' : 'Dispatch: a fight reported, a unit is on the way.', 'Harbour Police');
		return c;
	}

	function arrive(c) {
		c.state = 'arrived'; c.t = 0;
		const sx = c.pos.x + Math.cos(c.yaw) * (S.W / 2 + 1), sz = c.pos.z - Math.sin(c.yaw) * (S.W / 2 + 1);
		c.squad = combat.squads.squad('police', sx, sz, isPhone ? Math.min(2, c.officers) : c.officers, { post: { kind: 'scene', x: c.to.x, z: c.to.z, r: 80 }, alert: c.alert, tag: c.id, y: c.pos.y + 0.6, spread: 2 });
		// a parked cruiser is a car like the others: solid, and yours to take
		c.car = { kind: 'sedan', x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, id: c.id, col: NAVY.toArray() };
		STATIC_CARS.add(c.car);
		if (c.why === 'brawl') combat.melee?.calm?.(c.to.x, c.to.z, 40);
	}
	function leave(c) {
		c.state = 'leaving'; c.t = 0;
		c.squad?.then((s) => { for (const h of [...(s?.members || [])]) if (!h.dead) combat.squads.release(h); });
		if (c.car) { STATIC_CARS.delete(c.car); c.car = null; }
	}
	function drop(c) {
		c.siren?.stop(); c.siren = null;
		if (c.car) STATIC_CARS.delete(c.car);
		cruisers.splice(cruisers.indexOf(c), 1);
	}

	let flash = 0;
	function update(dt) {
		const w = W();
		if (!w?.bayArea) { if (cruisers.length) clear(); return; }
		flash += dt;
		const e = eye(), stars = combat.wantedLevel();
		calmT = stars > 0 ? 0 : calmT + dt;
		for (const c of [...cruisers]) {
			c.t += dt;
			if (c.state === 'responding') {
				// on to where the trouble is now (you, if it is you they want)
				if (c.why === 'wanted' && e && c.t % 4 < dt) { c.to = { x: e.x, z: e.z }; }
				const left = c.route.length - c.s;
				const v = left < 40 ? Math.max(3, left * 0.25) : 18;
				c.s += v * dt;
				const q = along(c.route, c.s);
				c.pos.set(q.x, ground(q.x, q.z, c.pos.y + 2), q.z);
				c.yaw += Math.atan2(Math.sin(Math.atan2(q.dx, q.dz) - c.yaw), Math.cos(Math.atan2(q.dx, q.dz) - c.yaw)) * Math.min(1, dt * 4);
				c.spin += v * dt / S.wr;
				if (left < 8 || (e && c.why === 'wanted' && Math.hypot(c.pos.x - e.x, c.pos.z - e.z) < 16) || c.t > 120) arrive(c);
			} else if (c.state === 'arrived') {
				// over: the wanted level gone, the scene quiet
				const done = c.why === 'wanted' ? calmT > 25 : c.t > 70;
				if (done || c.t > 240) leave(c);
			} else {
				c.s -= 14 * dt; const q = along(c.route, Math.max(0, c.s));
				c.pos.set(q.x, ground(q.x, q.z, c.pos.y + 2), q.z); c.yaw = Math.atan2(-q.dx, -q.dz); c.spin += 14 * dt / S.wr;
				if (c.s <= 0 || c.t > 45 || (e && Math.hypot(c.pos.x - e.x, c.pos.z - e.z) > 400)) drop(c);
			}
		}
		// sirens: the two nearest on their way
		const loud = cruisers.filter((c) => c.state === 'responding' && e).sort((a, b) => a.pos.distanceTo(e) - b.pos.distanceTo(e)).slice(0, 2);
		for (const c of cruisers) {
			if (loud.includes(c)) { c.siren ||= sirenSound(); const d = c.pos.distanceTo(e); c.siren.set(Math.max(0, 1 - d / 500), d < 40); }
			else if (c.siren) { c.siren.stop(); c.siren = null; }
		}
		// drawn: the sedan in navy, the white doors, the light bar flashing
		fleet.begin();
		let n = 0;
		const on = Math.floor(flash * 6) % 2;
		red.color.setRGB(on ? 1.6 : 0.15, 0.02, 0.02); blue.color.setRGB(0.05, 0.15, on ? 0.2 : 1.8);
		for (const c of cruisers) {
			_m.compose(_p.copy(c.pos), _q.setFromAxisAngle(_y, c.yaw), _s);
			fleet.add('sedan', _m, NAVY, e ? c.pos.distanceToSquared(e) : 0, { spin: c.spin, steer: 0, riders: c.state === 'arrived' ? 0 : 2 });
			barBase.setMatrixAt(n, _o.multiplyMatrices(_m, new THREE.Matrix4().makeTranslation(0, S.H + 0.04, -0.15)));
			lampR.setMatrixAt(n, _o.multiplyMatrices(_m, new THREE.Matrix4().makeTranslation(0.32, S.H + 0.13, -0.15)));
			lampB.setMatrixAt(n, _o.multiplyMatrices(_m, new THREE.Matrix4().makeTranslation(-0.32, S.H + 0.13, -0.15)));
			doors.setMatrixAt(n, _o.multiplyMatrices(_m, new THREE.Matrix4().makeTranslation(0, 0.78, -0.18)));
			n++;
		}
		fleet.end();
		for (const im of [barBase, lampR, lampB, doors]) { im.count = n; im.instanceMatrix.needsUpdate = true; }
	}
	function clear() { for (const c of [...cruisers]) { leave(c); drop(c); } }
	const info = () => cruisers.map((c) => ({ id: c.id, why: c.why, state: c.state, km: eye() ? +(c.pos.distanceTo(eye()) / 1000).toFixed(2) : null, siren: !!c.siren }));
	return { respond, event, update, clear, info, cruisers, setStations(fn) { stationAt = typeof fn === 'function' ? fn : null; return !!stationAt; }, stationsPush: () => [] };
}
