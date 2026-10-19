// The police: the Harbour Police in their cruisers, answering crime (a fight in the street, a
// gang's gunfire, shots fired) and the wanted level (combat/heat.js; how many come and how
// they work is the escalation ladder, law/ladder.js, run by law/index.js).
// A cruiser drives in by road (military/route.js) from the nearest police station when there is
// one (stationAt, the stations' own module) or from a road out of your sight, its light bar
// flashing red and blue and its siren wailing through the world's sound bus. It goes where you
// were last seen, not wherever you are now; it pulls up, two officers get out and do their work
// (combat's squads: taking cover behind the car, closing in to arrest, searching round the
// spot), and when it is over they walk back, get in and drive off the way they came. At the
// third level a roadblock: two cars parked across the road ahead of you, officers behind them.
// At the fourth the tactical team in its van from the police quarters. Above that the military
// (military/dispatch.js) is asked for backup.
//
// Far from you a unit is moved along faster than it would drive (nobody sees it), and nothing
// is made or let go where you can see it happen. A parked cruiser is solid, cover for the
// officers, and can be taken like any car.
//
// The cruisers are the town's own sedan (vehicles/fleet.js) in navy, with white doors and the
// light bar drawn over them; the tactical van is the town's van in charcoal. All instanced: a
// handful of draws for all of them.

import * as THREE from 'three';
import { createFleet } from '../vehicles/fleet.js';
import { STATIC_CARS } from '../vehicles/registry.js';
import { specOf } from '../bay/cars.js';
import { roadRoute, along, trimToRoad } from './route.js';
import { policePlan } from './rules.js';
import { sirenSound } from './sound.js';
import { blockSlots, inCone, offscreenPace } from '../law/tactics.js';
import { searchLoop } from '../law/ladder.js';

const NAVY = new THREE.Color('#141a2c'), CHAR = new THREE.Color('#25282e');
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0), _o = new THREE.Matrix4(), _t = new THREE.Matrix4();
let seq = 1;

export function createPolice({ world, combat, group, isPhone, night, backup = null }) {
	const W = () => world();
	const MAX = isPhone ? 4 : 7;
	const fleet = createFleet(group, { cap: MAX + 2, isPhone, night });
	const cruisers = [];
	let stationAt = null, calmT = 0;
	// law/index.js fills these in: last() where you were last seen, view() the eye and the way
	// it looks (so nothing is made or dropped in plain sight), lethal() whether officers draw
	const law = { last: null, view: null };
	// the light bar's base, its red and blue lamps (flashing), and the white doors: instanced
	const inst = (geo, mat, n = MAX + 2) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; group.add(m); return m; };
	const red = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }), blue = new THREE.MeshBasicMaterial({ color: 0x2a50ff, toneMapped: false });
	const SED = specOf('sedan');
	const barBase = inst(new THREE.BoxGeometry(1.25, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.4, metalness: 0.5 }));
	const lampR = inst(new THREE.BoxGeometry(0.52, 0.1, 0.24), red), lampB = inst(new THREE.BoxGeometry(0.52, 0.1, 0.24), blue);
	const doors = inst(new THREE.BoxGeometry(SED.W + 0.03, 0.42, 1.95), new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.35, metalness: 0.1 }));
	const near = () => { const w = W(); return w?.real?.loaded?.() ? (x, z, r) => w.real.near('roads', x, z, r) : null; };
	const ground = (x, z, y = 1e4) => { const I = W().island; return Math.max(I.heightAt(x, z), I.extraFloor ? I.extraFloor(x, z, y) : -1e9); };
	const eye = () => W()?.player?.state?.pos;
	const live = () => cruisers.filter((c) => c.state === 'responding' || c.state === 'arrived');
	// can you see it from where you stand (in front of you and near enough)?
	function visible(x, z, r = 230) {
		const v = law.view?.(), e = v?.eye || eye();
		if (!e) return false;
		const d = Math.hypot(x - e.x, z - e.z);
		if (d > r) return false;
		return v ? inCone(e, v.dir, x, z, 1.0) || d < 25 : d < 150;
	}

	// where a unit comes from: the station near the trouble, or a road out of your sight
	function origin(to) {
		const st = stationAt?.(to.x, to.z);
		if (st && Math.hypot(st.x - to.x, st.z - to.z) < 3000) return { x: st.x, z: st.z, station: st.name || 'the station' };
		const e = eye() || to, R = near()?.(to.x, to.z, 340) || [];
		let best = null, bs = -1e9;
		for (const r of R) {
			if (/footway|path|steps|cycleway|pedestrian|track/.test(r.cls || '')) continue;
			for (let i = 0; i < r.pts.length; i += 4) {
				const x = r.pts[i], z = r.pts[i + 1], d = Math.hypot(x - to.x, z - to.z), de = Math.hypot(x - e.x, z - e.z);
				if (d < 200 || d > 340 || de < 180) continue;
				const s = (visible(x, z, 400) ? -200 : 0) + de * 0.2 - Math.abs(d - 260) * 0.3;
				if (s > bs) { bs = s; best = { x, z }; }
			}
		}
		if (best) return best;
		// (no roads loaded: behind you, out of sight)
		const P = W().player.state, a = (P ? P.yaw : 0) + (Math.random() - 0.5) * 1.2, d = 240 + Math.random() * 80;
		return { x: e.x + Math.sin(a) * d, z: e.z + Math.cos(a) * d };
	}
	function send(to, why, officers = 2, alert = false, o = {}) {
		if (cruisers.filter((c) => c.state !== 'leaving').length >= MAX) return null;
		const from = origin(to), route = trimToRoad(roadRoute(near(), from, to, { maxSteps: 20 }));
		const kind = o.kind || 'sedan', c = { id: 'pc' + seq++, why, kind, S: specOf(kind), fid: o.fid || 'police', col: kind === 'van' ? CHAR : NAVY, to: { ...to }, route, s: 0, pos: new THREE.Vector3(from.x, ground(from.x, from.z), from.z), yaw: 0, state: 'responding', officers, alert, t: 0, siren: null, spin: 0, quiet: 0, station: from.station || null };
		const q0 = along(route, 0.5);
		c.yaw = Math.atan2(q0.dx, q0.dz);
		cruisers.push(c);
		return c;
	}
	// the wanted level without the ladder (law/ not attached): the old plain answer
	function respond(stars, R, have) {
		const e = eye();
		if (!e || !W()?.bayArea) return false;
		const plan = policePlan(stars, R.officers, have + live().length * 2);
		for (let i = 0; i < Math.min(2, plan.cruisers); i++) send({ x: e.x, z: e.z }, 'wanted', 2, true);
		if (plan.cruisers && Math.random() < 0.6) combat.call?.(stars >= 3 ? 'Dispatch: all units, suspect is armed and dangerous.' : 'Dispatch: units responding.', 'Harbour Police');
		if (plan.backup) backup?.({ kind: 'wanted', x: e.x, z: e.z, severity: plan.backup === 'air' ? 3 : 2 });
		return true;
	}
	// the ladder's plan (law/ladder.js responsePlan) against what is out: more cars to where you
	// were last seen, one at a time; the tactical van when the plan has it
	function need(plan, at) {
		if (!W()?.bayArea || !at) return 0;
		const mine = live().filter((c) => c.why === 'wanted');
		let sent = 0;
		if (mine.length < plan.cars && send({ x: at.x, z: at.z }, 'wanted', plan.officers || 2, true)) sent++;
		if (plan.swat && !cruisers.some((c) => c.why === 'swat' && c.state !== 'leaving') && send({ x: at.x, z: at.z }, 'swat', plan.swatSize || 4, true, { kind: 'van', fid: 'swat' })) {
			sent++;
			combat.call?.('Dispatch: tactical team rolling from the quarters.', 'Harbour Police');
		}
		return sent;
	}
	// trouble reported (a brawl, a gang's gunfire, shots fired): a unit to the scene
	function event(e, o = {}) {
		if (cruisers.some((c) => c.state !== 'leaving' && c.why !== 'block' && Math.hypot(c.to.x - e.x, c.to.z - e.z) < 120 && (!o.swat || c.why === 'swat'))) return null;
		const swat = !!o.swat;
		const c = send({ x: e.x, z: e.z }, swat ? 'swat' : e.kind, swat ? (isPhone ? 3 : 4) : e.kind === 'gang' ? 3 : 2, e.kind === 'gang' || e.kind === 'defence', swat ? { kind: 'van', fid: 'swat' } : {});
		if (c) combat.call?.(swat ? 'Dispatch: shots fired, tactical team responding.' : e.kind === 'defence' ? 'Dispatch: a citizen under fire, units responding to back them up.' : e.kind === 'gang' || e.kind === 'shots' ? 'Dispatch: shots fired, units responding.' : e.kind === 'disaster' ? 'Dispatch: all units, disaster response. Keep the roads clear.' : 'Dispatch: a fight reported, a unit is on the way.', 'Harbour Police');
		return c;
	}

	// ---------- roadblocks ----------
	// two cars across the road at spot (law/tactics.js roadblockSpot), officers behind them
	function block(spot, from, alert = false) {
		if (cruisers.some((c) => c.why === 'block' && c.state === 'blocking' && Math.hypot(c.pos.x - spot.x, c.pos.z - spot.z) < 120)) return null;
		if (cruisers.filter((c) => c.state !== 'leaving').length + 2 > MAX || visible(spot.x, spot.z, 260)) return null;
		const { cars, post } = blockSlots(spot, from, 2);
		const made = [];
		for (const q of cars) {
			const c = { id: 'pc' + seq++, why: 'block', kind: 'sedan', S: SED, fid: 'police', col: NAVY, to: { x: spot.x, z: spot.z }, route: null, s: 0, pos: new THREE.Vector3(q.x, ground(q.x, q.z), q.z), yaw: q.yaw, state: 'blocking', officers: 0, alert, t: 0, siren: null, spin: 0, road: { tx: spot.tx, tz: spot.tz } };
			c.car = { kind: 'sedan', x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, id: c.id, col: NAVY.toArray() };
			STATIC_CARS.add(c.car);
			cruisers.push(c); made.push(c);
		}
		const face = Math.atan2(from.x - post.x, from.z - post.z);
		const sq = combat.squads.squad('police', post.x, post.z, isPhone ? 1 : 2, { post: { kind: 'roadblock', x: post.x, z: post.z, yaw: face, r: 70 }, alert, tag: made[0].id, y: ground(post.x, post.z) + 0.6, spread: 2 });
		made[0].squad = sq; made[0].members = [];
		sq.then((s) => { made[0].members = s?.members || []; });
		combat.call?.('Dispatch: roadblock is up ahead of the suspect.', 'Harbour Police');
		return made;
	}
	function clearBlocks() { for (const c of cruisers) if (c.why === 'block' && c.state === 'blocking') leave(c); }

	function arrive(c) {
		c.state = 'arrived'; c.t = 0;
		const S = c.S, sx = c.pos.x + Math.cos(c.yaw) * (S.W / 2 + 1), sz = c.pos.z - Math.sin(c.yaw) * (S.W / 2 + 1);
		const n = isPhone ? Math.min(c.fid === 'swat' ? 3 : 2, c.officers) : c.officers;
		// on a wanted call they search round where you were last seen until they see you
		const post = { kind: 'scene', x: c.to.x, z: c.to.z, r: 80 };
		if (c.why === 'wanted' || c.why === 'swat' || c.why === 'shots') post.loop = searchLoop(c.to, c.fid === 'swat' ? 14 : 20, 4, seq);
		c.members = [];
		c.squad = combat.squads.squad(c.fid, sx, sz, n, { post, alert: c.alert, tag: c.id, y: c.pos.y + 0.6, spread: 2 });
		c.squad.then((s) => { c.members = s?.members || []; });
		// a parked cruiser is a car like the others: solid, and yours to take
		c.car = { kind: c.kind, x: c.pos.x, y: c.pos.y, z: c.pos.z, yaw: c.yaw, id: c.id, col: c.col.toArray() };
		STATIC_CARS.add(c.car);
		if (c.why === 'brawl') combat.melee?.calm?.(c.to.x, c.to.z, 40);
	}
	// over: the officers walk back to the car and get in, then it drives off
	function leave(c) {
		if (c.state === 'boarding' || c.state === 'leaving') return;
		c.state = 'boarding'; c.t = 0;
		const door = { kind: 'board', x: c.pos.x + Math.cos(c.yaw) * (c.S.W / 2 + 0.8), z: c.pos.z - Math.sin(c.yaw) * (c.S.W / 2 + 0.8), yaw: c.yaw, r: 6 };
		(c.members || []).forEach((h, i) => { if (h.dead) return; h.recall = true; h.alert = 0; h.target = null; h.goal = null; h.leg = undefined; h.post = door; h.slot = i; });
		if (!c.members?.length) depart(c);
	}
	function depart(c) {
		c.state = 'leaving'; c.t = 0;
		for (const h of [...(c.members || [])]) if (!h.dead) combat.squads.release(h);
		c.members = [];
		// (any still being made when it left)
		c.squad?.then((s) => { for (const h of [...(s?.members || [])]) if (!h.dead && c.state === 'leaving') combat.squads.release(h); });
		if (c.car) { STATIC_CARS.delete(c.car); c.car = null; }
		// a parked car (a roadblock) leaves along the road, away from you
		if (!c.route || c.s <= 0) {
			const e = eye() || c.pos, tx = c.road?.tx ?? Math.sin(c.yaw), tz = c.road?.tz ?? Math.cos(c.yaw);
			const dir = (c.pos.x - e.x) * tx + (c.pos.z - e.z) * tz >= 0 ? 1 : -1;
			c.route = roadRoute(null, { x: c.pos.x + tx * dir * 600, z: c.pos.z + tz * dir * 600 }, { x: c.pos.x, z: c.pos.z });
			c.s = c.route.length;
		}
	}
	function drop(c) {
		c.siren?.stop(); c.siren = null;
		if (c.car) STATIC_CARS.delete(c.car);
		const i = cruisers.indexOf(c);
		if (i >= 0) cruisers.splice(i, 1);
	}
	// everyone home: the matter is closed (an arrest, the level gone)
	function standDown(why = null) { for (const c of [...cruisers]) if (!why || c.why === why) { if (c.state === 'responding') { c.state = 'leaving'; c.t = 0; } else leave(c); } }

	let flash = 0;
	function update(dt) {
		const w = W();
		if (!w?.bayArea) { if (cruisers.length) clear(); return; }
		flash += dt;
		const e = eye(), stars = combat.wantedLevel();
		calmT = stars > 0 ? 0 : calmT + dt;
		for (let i = cruisers.length - 1; i >= 0; i--) {
			const c = cruisers[i];
			c.t += dt;
			const dEye = e ? Math.hypot(c.pos.x - e.x, c.pos.z - e.z) : 0;
			if (c.state === 'responding') {
				// on to where you were last seen (the ladder's), every few seconds
				if ((c.why === 'wanted' || c.why === 'swat') && c.t % 4 < dt) {
					const at = law.last?.() || (law.last ? null : e);
					if (at && Math.hypot(at.x - c.to.x, at.z - c.to.z) > 50) { c.to = { x: at.x, z: at.z }; c.route = trimToRoad(roadRoute(near(), { x: c.pos.x, z: c.pos.z }, c.to, { maxSteps: 20 })); c.s = 0; }
				}
				const left = c.route.length - c.s;
				const v = left < 40 ? Math.max(3, left * 0.25) : offscreenPace(dEye, 18);
				c.s += v * dt;
				const q = along(c.route, c.s);
				c.pos.set(q.x, ground(q.x, q.z, c.pos.y + 2), q.z);
				c.yaw += Math.atan2(Math.sin(Math.atan2(q.dx, q.dz) - c.yaw), Math.cos(Math.atan2(q.dx, q.dz) - c.yaw)) * Math.min(1, dt * 4);
				c.spin += v * dt / c.S.wr;
				const there = left < 8 || ((c.why === 'wanted' || c.why === 'swat') && e && Math.hypot(c.pos.x - e.x, c.pos.z - e.z) < 18 && left < 60);
				// (stuck on the way: brought on to the end where nobody sees it)
				if (!there && c.t > 200 && !visible(c.pos.x, c.pos.z)) c.s = Math.max(c.s, c.route.length - 30);
				if (there) arrive(c);
			} else if (c.state === 'arrived' || c.state === 'blocking') {
				// over: the wanted level gone a while, the scene quiet
				const done = c.why === 'wanted' || c.why === 'swat' || c.why === 'block' ? calmT > 25 : c.t > 70;
				if (done || c.t > 300 || (c.why !== 'block' && dEye > 600)) leave(c);
			} else if (c.state === 'boarding') {
				// in when they are all at the door, or after a while out of your sight
				const all = (c.members || []).filter((h) => !h.dead).every((h) => Math.hypot(h.pos.x - c.pos.x, h.pos.z - c.pos.z) < 3.4);
				if ((all && c.t > 1.5) || c.t > 25 || (c.t > 6 && !visible(c.pos.x, c.pos.z))) depart(c);
			} else {
				const v = offscreenPace(dEye, 14);
				c.s -= v * dt; const q = along(c.route, Math.max(0, c.s));
				c.pos.set(q.x, ground(q.x, q.z, c.pos.y + 2), q.z); c.yaw = Math.atan2(-q.dx, -q.dz); c.spin += v * dt / c.S.wr;
				const hidden = !visible(c.pos.x, c.pos.z, 260);
				if (((c.s <= 0 || c.t > 60) && hidden) || dEye > 420) drop(c);
			}
		}
		// sirens: the two nearest on their way
		let l1 = null, l2 = null, d1 = Infinity, d2 = Infinity;
		if (e) for (const c of cruisers) {
			if (c.state !== 'responding') continue;
			const d = c.pos.distanceTo(e);
			if (d < d1) { l2 = l1; d2 = d1; l1 = c; d1 = d; } else if (d < d2) { l2 = c; d2 = d; }
		}
		for (const c of cruisers) {
			if (c === l1 || c === l2) { c.siren ||= sirenSound(); const d = c === l1 ? d1 : d2; c.siren.set(Math.max(0, 1 - d / 500), d < 40); }
			else if (c.siren) { c.siren.stop(); c.siren = null; }
		}
		// drawn: the sedan in navy with white doors, the van in charcoal, the light bars flashing
		fleet.begin();
		let n = 0, nd = 0;
		const on = Math.floor(flash * 6) % 2;
		red.color.setRGB(on ? 1.6 : 0.15, 0.02, 0.02); blue.color.setRGB(0.05, 0.15, on ? 0.2 : 1.8);
		for (const c of cruisers) {
			const S = c.S;
			_m.compose(_p.copy(c.pos), _q.setFromAxisAngle(_y, c.yaw), _s);
			fleet.add(c.kind, _m, c.col, e ? c.pos.distanceToSquared(e) : 0, { spin: c.spin, steer: 0, riders: c.state === 'arrived' || c.state === 'blocking' || c.state === 'boarding' ? 0 : 2, livery: c.kind === 'sedan' ? 'police' : c.kind === 'van' ? (c.fid === 'swat' ? 'swat' : 'van') : null, seed: c.id });
			barBase.setMatrixAt(n, _o.multiplyMatrices(_m, _t.makeTranslation(0, S.H + 0.04, -0.15)));
			lampR.setMatrixAt(n, _o.multiplyMatrices(_m, _t.makeTranslation(0.32, S.H + 0.13, -0.15)));
			lampB.setMatrixAt(n, _o.multiplyMatrices(_m, _t.makeTranslation(-0.32, S.H + 0.13, -0.15)));
			if (c.kind === 'sedan') doors.setMatrixAt(nd++, _o.multiplyMatrices(_m, _t.makeTranslation(0, 0.78, -0.18)));
			n++;
		}
		fleet.end();
		for (const im of [barBase, lampR, lampB]) { im.count = n; im.instanceMatrix.needsUpdate = true; }
		doors.count = nd; doors.instanceMatrix.needsUpdate = true;
	}
	function clear() { for (const c of [...cruisers]) { for (const h of [...(c.members || [])]) if (!h.dead) combat.squads.release(h); drop(c); } }
	// a parked unit near (x, z) to take cover behind
	function cover(x, z, r) {
		let best = null, bd = r;
		for (const c of cruisers) {
			if (c.state !== 'arrived' && c.state !== 'blocking') continue;
			const d = Math.hypot(c.pos.x - x, c.pos.z - z);
			if (d < bd) { bd = d; best = { x: c.pos.x, z: c.pos.z, r: c.S.L * 0.35 }; }
		}
		return best;
	}
	const info = () => cruisers.map((c) => ({ id: c.id, why: c.why, kind: c.kind, state: c.state, km: eye() ? +(c.pos.distanceTo(eye()) / 1000).toFixed(2) : null, siren: !!c.siren, from: c.station }));
	return { respond, need, event, block, clearBlocks, standDown, update, clear, info, cover, cruisers, law, visible, setStations(fn) { stationAt = typeof fn === 'function' ? fn : null; return !!stationAt; }, stationsPush: () => [] };
}
