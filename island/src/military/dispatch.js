// The military answering trouble. Gang wars that turn deadly, a boss loose on the land, an
// invasion from another region: the nearest ready base sends what the trouble calls for
// (military/rules.js planDispatch): a convoy of tanks, armoured trucks and jeeps by road
// (military/route.js), helicopters and a jet by air when it is far or big. A patrol is a little
// state while far from you (where along its way it is, when it will be there); within sight it
// is drawn and moves, and on the scene its troops get out (combat's squads, posted where they
// stand), its guns engage the side it came for, the helicopters fly the fight (military/flight.js
// heliTacticStep: orbits, fast low flanks across to the far side, attack runs and hovers), the
// jet makes a pass. After a while, or when the trouble is over, it goes home and the base has its vehicles
// back. An invasion is the same from the other side: an Ironvale Legion column out of another
// region, with the Meridian Guard sent to meet it.
//
// Every vehicle on the move is a target in the combat layer (you can fight either side); a
// destroyed one burns and is left a while as a wreck.
//
// Only the big trouble comes here (law/ladder.js routeTrouble): a boss, an invasion, a riot, a
// gang war at its worst, the wanted level at the very top; anything smaller is passed to the
// police. Going home, the troops walk back to their vehicles and mount up before the column
// pulls out, and the column is let go only once it is out of sight.

import * as THREE from 'three';
import { planDispatch, invasionPlan, nextInvasion, SPEED, toWorld, FORCES } from './rules.js';
import { roadRoute, along, joinRoute, trimToRoad } from './route.js';
import { vehicleMesh, DIMS, SCHEMES } from './models.js';
import { heliAirState, heliTacticStep } from './flight.js';
import { engineSound, oneShot } from './sound.js';
import { routeTrouble } from '../law/ladder.js';
import { stencilVehicle } from '../signage/cars.js';

const SHOW_R = 1800, HIDE_R = 2300, STAY = 150;
const HP = { tank: 900, apc: 420, jeep: 180, truck: 260, heli: 380, jet: 300 };
const _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
// the searchlight's beam: a long cone, its tip at the lamp, open toward the ground, soft at its edge
const BEAM_GEO = new THREE.CylinderGeometry(0.15, 3.2, 1, 16, 1, true).translate(0, 0.5, 0);
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
let seq = 1;

export function createDispatch({ world, combat, military, kit, group, hint, isPhone }) {
	const W = () => world();
	const patrols = [];
	let invT = nextInvasion(), time = 0;
	const near = () => { const w = W(); return w?.real?.loaded?.() ? (x, z, r) => w.real.near('roads', x, z, r) : null; };
	const eye = () => W()?.player?.state?.pos;
	const ground = (x, z, y = 1e4) => { const I = W().island; return Math.max(I.heightAt(x, z), I.extraFloor ? I.extraFloor(x, z, y) : -1e9); };

	// ---------- trouble reported (combat's hooks.event) ----------
	function event(e) {
		if (!W()?.bayArea) return null;
		const route = routeTrouble(e);
		if (route !== 'military') return military.police?.event?.(e, { swat: route === 'swat' }) || null;
		if (patrols.filter((p) => p.side === 'guard' && p.state !== 'done').length >= 3) return null;
		// (one patrol to a place at a time)
		if (patrols.some((p) => p.side === 'guard' && p.state !== 'done' && Math.hypot(p.to.x - e.x, p.to.z - e.z) < 600)) return null;
		// (no base sited within reach: the nearest waiting ones are sited now)
		const reach = FORCES[e.kind]?.reach || 15000;
		if (!military.basesState().some((S) => Math.hypot(S.x - e.x, S.z - e.z) <= reach && (S.busyUntil || 0) <= time)) military.siteNear?.(e.x, e.z, reach);
		const bases = military.basesState();
		const plan = planDispatch({ ...e, t: time }, bases.map((S) => ({ id: S.id, name: S.name, x: S.x, z: S.z, units: S.units, busyUntil: S.busyUntil })));
		if (!plan) return null;
		const S = bases.find((q) => q.id === plan.base);
		S.busyUntil = time + plan.cool;
		for (const u of plan.units) S.units[u] = Math.max(0, (S.units[u] || 0) - 1);
		const [gx, gz] = toWorld(S, S.layout.gate.x, S.layout.gate.z + 20);
		const p = launch({ side: 'guard', why: e.kind, base: S, from: { x: gx, z: gz }, to: { x: e.x, z: e.z }, units: plan.units, troops: plan.troops, mode: plan.mode });
		hint(`Meridian Guard: ${plan.mode === 'road' ? 'a convoy' : 'air support'} from ${S.name} is on the way (${Math.max(1, Math.round(plan.eta / 60))} min).`, 4000, 1);
		return p;
	}
	// a patrol under way: road units follow the route, air units fly straight
	function launch({ side, why, base = null, from, to, units, troops, mode }) {
		const roadUnits = units.filter((u) => u !== 'heli' && u !== 'jet'), airUnits = units.filter((u) => u === 'heli' || u === 'jet');
		const route = roadUnits.length ? trimToRoad(roadRoute(near(), from, to)) : null;
		const p = {
			id: 'p' + seq++, side, why, base, from, to, mode, troops, route, t: 0, s: 0, state: 'enroute', shown: false, deployed: false, stayT: STAY, quietT: 0,
			units: [...roadUnits.map((k, i) => unit(k, side, i, false)), ...airUnits.map((k, i) => unit(k, side, i, true))],
			eta: Math.round((route ? route.length / SPEED.road : Math.hypot(to.x - from.x, to.z - from.z) / SPEED.heli)),
		};
		for (const u of p.units) u.p = p;
		patrols.push(p);
		return p;
	}
	function unit(kind, side, i, air) {
		return { kind, side, i, air, hp: HP[kind], mesh: null, T: null, pos: new THREE.Vector3(), yaw: 0, s: -i * 26, fireT: 1 + Math.random() * 2, dead: 0, engine: null, flyS: -i * 120, fly: null, at: null, pitch: 0, roll: 0 };
	}

	// ---------- drawn and in the fight ----------
	function show(u) {
		u.mesh = stencilVehicle(vehicleMesh(u.kind, kit, u.side === 'police' ? SCHEMES.police : u.side === 'guard' ? (u.air ? SCHEMES.grey : SCHEMES.woodland) : SCHEMES.invader, { phone: isPhone }), u.kind, { side: u.side === 'ironvale' ? 'ironvale' : 'guard', n: u.i + (u.p?.id?.length || 0), grey: u.air, police: u.side === 'police' });
		u.last = null;
		group.add(u.mesh);
		const D = DIMS[u.kind];
		u.T = {
			id: 'mv' + seq++, kind: 'vehicle', faction: u.side, surface: 'metal', name: u.side === 'police' ? 'the police helicopter' : u.side === 'guard' ? `a Meridian Guard ${u.kind === 'apc' ? 'armoured truck' : u.kind === 'heli' ? 'helicopter' : u.kind}` : `an Ironvale ${u.kind}`,
			bound: { x: 0, y: 0, z: 0, r: Math.max(D.L, D.W) * 0.6 },
			shapes: () => [{ type: 'box', c: { x: u.pos.x, y: u.pos.y + D.H / 2, z: u.pos.z }, h: [D.W / 2, D.H / 2, D.L / 2], yaw: -u.yaw, part: 'body' }],
			// (where a lock-on and a seeking spell aim: the middle of the body; combat/target-focus.js)
			aim: () => ({ x: u.pos.x, y: u.pos.y + D.H * 0.5, z: u.pos.z }),
			onHit: (blow) => hurt(u, blow),
			moral: () => ({ hostileTarget: u.side === 'ironvale' || (u.side === 'guard' && combat.wantedLevel() >= 5), lawTarget: u.side !== 'ironvale' }),
		};
		combat.layer.add(u.T);
		// the police helicopter's searchlight: a beam down to where it is looking, after dark
		if (u.side === 'police') {
			u.beam = new THREE.Mesh(BEAM_GEO, BEAM_MAT); u.beam.visible = false; u.beam.renderOrder = 3; u.beam.name = 'police-searchlight';
			group.add(u.beam);
		}
	}
	function hide(u) {
		if (u.mesh) { u.mesh.removeFromParent(); u.mesh.userData.dispose?.(); u.mesh = null; }
		if (u.beam) { u.beam.removeFromParent(); u.beam = null; }
		if (u.T) { combat.layer.remove(u.T.id); u.T = null; }
		u.engine?.stop(); u.engine = null;
	}
	function hurt(u, blow) {
		if (u.dead) return { dealt: 0 };
		const k = blow.type === 'blast' ? 1.4 : blow.type === 'energy' ? 0.8 : 0.35;
		const dealt = (blow.amount || 0) * k;
		u.hp -= dealt;
		if (u.hp <= 0) { u.dead = 0.001; combat.fx.explosion(u.pos.clone().add(_v.set(0, 1.5, 0)), u.air ? 4 : 3.5); oneShot('crash', 0.8); if (u.T) combat.layer.remove(u.T.id); u.T = null; u.engine?.stop(); return { dealt, killed: true }; }
		return { dealt };
	}
	// whom a unit fires at: the other side's fighters, vehicles and (for the Legion, or once you
	// have fired on the Guard) you
	function targetFor(u, range) {
		const enemyOf = (fid) => (u.side === 'guard' ? combat.relations.hostile('guard', fid) : fid !== 'ironvale' && fid !== 'world');
		let best = null, bd = range;
		for (const h of combat.squads.alive()) {
			if (h.surrendered || !enemyOf(h.fid)) continue;
			const d = Math.hypot(h.pos.x - u.pos.x, h.pos.z - u.pos.z);
			if (d < bd) { bd = d; best = { pos: new THREE.Vector3(h.pos.x, h.pos.y + 1.2, h.pos.z), T: h.T }; }
		}
		for (const p of patrols) for (const o of p.units) {
			if (o.side === u.side || o.dead || !o.T || (o.side !== 'ironvale' && u.side !== 'ironvale')) continue;
			const d = o.pos.distanceTo(u.pos);
			if (d < bd) { bd = d; best = { pos: o.pos.clone().add(_v.set(0, 1.2, 0)), T: o.T }; }
		}
		for (const T of combat.layer.map.values()) {
			if (T.kind !== 'boss' || u.side !== 'guard') continue;
			const d = Math.hypot(T.bound.x - u.pos.x, T.bound.z - u.pos.z);
			if (d < bd + 100) { bd = d; best = { pos: new THREE.Vector3(T.bound.x, T.bound.y, T.bound.z), T }; }
		}
		const e = eye();
		const hatesYou = u.side !== 'guard' || combat.wantedLevel() >= 5;
		if (e && hatesYou && Math.hypot(e.x - u.pos.x, e.z - u.pos.z) < bd) best = { pos: e.clone().add(_v.set(0, -0.4, 0)), me: true };
		return best;
	}
	const by = (u) => ({ id: u.T?.id || 'mv', kind: 'hostile', faction: u.side });
	function engage(u, dt) {
		const p = u.p;
		if (u.side === 'police') return;
		u.fireT -= dt;
		if (u.fireT > 0 || u.dead) return;
		const tank = u.kind === 'tank', range = tank ? 320 : u.air ? 260 : 170;
		const tg = targetFor(u, range);
		// (the helicopter remembers whom it fights, for its runs and hovers: place())
		if (u.air) u.at = tg ? { x: tg.pos.x, z: tg.pos.z, t: p.t } : null;
		if (!tg) { u.fireT = 0.8; return; }
		const from = u.pos.clone().add(_v.set(0, DIMS[u.kind].H + (u.air ? -1.5 : 0.2), 0)), dir = tg.pos.clone().sub(from).normalize();
		if (tank) {
			// the turret swings to it, and the gun speaks
			if (u.mesh?.userData.turret) u.mesh.userData.turret.rotation.y = Math.atan2(dir.x, dir.z) - u.yaw;
			const miss = new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6);
			const at = tg.pos.clone().add(miss);
			combat.fx.tracer(from, at, 3, 1600); combat.fx.muzzle(from, dir, 2);
			setTimeout(() => { if (!W()) return; combat.blast(at, 6, 180, by(u)); combat.fx.explosion(at, 2.6); }, 350);
			oneShot('cannon', distK(u));
			u.fireT = 5 + Math.random() * 3;
			return;
		}
		// a burst from the roof gun or the helicopter's
		const n = 4;
		for (let i = 0; i < n; i++) {
			const d = dir.clone().add(_v.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05)).normalize();
			const hit = combat.firstHit(from, d, range + 20, by(u));
			const end = hit ? from.clone().addScaledVector(d, hit.t) : from.clone().addScaledVector(d, range);
			if (tg.me && Math.random() < 0.25) combat.hurtPlayer({ amount: 6, type: 'ballistic', part: 'torso', src: from, by: by(u) });
			else if (hit && !hit.wall) combat.landShot(hit, from, d, by(u), 22, 'ballistic');
			combat.fx.tracer(from, end, 1, 800);
		}
		combat.fx.muzzle(from, dir, 0);
		oneShot('gun', distK(u) * 0.8);
		// (on an attack run the guns hardly pause)
		u.fireT = (u.air ? (u.fly?.mode === 'run' ? 0.22 : 0.5) : 0.7) + Math.random() * 0.6;
	}
	const distK = (u) => { const e = eye(); return e ? Math.max(0, 1 - Math.hypot(e.x - u.pos.x, e.z - u.pos.z) / 600) : 0; };

	// ---------- moving ----------
	function step(p, dt) {
		p.t += dt;
		const e = eye();
		// where the leader is: along the road at convoy speed, or the air units straight in
		if (p.state === 'enroute') {
			p.s += SPEED.road * dt;
			const roadDone = !p.route || p.s >= p.route.length - 20;
			const airAll = p.units.filter((u) => u.air && !u.dead);
			for (const u of airAll) u.flyS += (u.kind === 'jet' ? SPEED.jet * 0.6 : SPEED.heli) * dt;
			const flyLen = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
			if (roadDone && airAll.every((u) => u.kind === 'jet' || u.flyS >= flyLen - 60)) arrive(p);
		} else if (p.state === 'onscene' && p.side === 'police') {
			// the police helicopter: over where you were last seen, until the level comes down
			const L = combat.lastSeen?.() || e;
			if (L) { const k = Math.min(1, dt * 0.35); p.to.x += (L.x - p.to.x) * k; p.to.z += (L.z - p.to.z) * k; }
			if (combat.wantedLevel() < 4 || p.t > 600) leave(p);
		} else if (p.state === 'onscene') {
			p.stayT -= dt;
			// quiet: nobody left to fight near it
			const anyone = p.units.some((u) => !u.dead && targetFor(u, 250));
			p.quietT = anyone ? 0 : p.quietT + dt;
			if (p.stayT <= 0 || p.quietT > 40) leave(p);
		} else if (p.state === 'boarding') {
			// the troops back at the vehicles (or out of your sight a while), then off
			const out = (p.members || []).filter((h) => !h.dead);
			const back = out.every((h) => p.units.some((u) => !u.dead && !u.air && Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z) < 5));
			if ((back && p.t - p.boardAt > 2) || p.t - p.boardAt > 30) pullOut(p);
		} else if (p.state === 'leaving') {
			p.s -= SPEED.road * dt;
			for (const u of p.units) if (u.air) u.flyS -= SPEED.heli * dt;
			if ((!p.shown && p.t > p.leaveAt + 20) || p.t > p.leaveAt + 300) finish(p);
		}
		// each unit: placed, drawn when in sight, fighting on the scene
		const lead = p.route ? along(p.route, p.s) : null;
		const shownNow = e && (lead ? Math.hypot(lead.x - e.x, lead.z - e.z) : Math.hypot(p.to.x - e.x, p.to.z - e.z)) < (p.shown ? HIDE_R : SHOW_R);
		// coming into sight: the roads round here are loaded now (the survey's, the globe's, a grown
		// town's), so find the way on by them from where the column is; the stretch behind it kept
		if (shownNow && !p.shown && p.route && p.state === 'enroute' && !p.rerouted) {
			p.rerouted = true;
			const R = trimToRoad(roadRoute(near(), { x: lead.x, z: lead.z }, p.to));
			if (R.pts.length > 4) {
				const back = [];
				for (let s = Math.max(0, p.s - 220); s < p.s - 1; s += 20) { const q = along(p.route, s); back.push(q.x, q.z); }
				const J = joinRoute(back, R);
				p.s = J.length - R.length; p.route = J;
			}
		}
		for (const u of p.units) {
			if (u.dead) {
				u.dead += dt;
				if (u.mesh) {
					if (!u.burnt) { u.burnt = true; u.mesh.userData.burn?.(); }
					if (Math.random() < dt * 4) combat.fx.smokePuff(u.pos.clone().add(_v.set(0, 2, 0)), 0.1, 3, 6);
					// a downed aircraft falls: the helicopter spinning on its way down, and bursts where it hits
					if (u.air && !u.down) {
						const g = ground(u.pos.x, u.pos.z);
						u.fallV = (u.fallV || 0) + 7 * dt;
						u.pos.y -= u.fallV * dt; u.pos.x += Math.sin(u.yaw) * 9 * dt; u.pos.z += Math.cos(u.yaw) * 9 * dt;
						if (u.kind === 'heli') { u.yaw += dt * 2.4; u.roll = Math.min(0.6, (u.roll || 0) + dt * 0.25); u.pitch = Math.min(0.5, (u.pitch || 0) + dt * 0.2); u.mesh.userData.pose?.({ spin: 0.5, dt }); }
						if (u.pos.y <= g + 0.5) { u.pos.y = g + 0.5; u.down = true; combat.fx.explosion(u.pos.clone().add(_v.set(0, 1.5, 0)), u.kind === 'heli' ? 4.5 : 5); oneShot('crash', 1); combat.blast?.(u.pos.clone(), 8, 120, by(u)); }
						u.mesh.position.copy(u.pos); u.mesh.rotation.set(u.pitch || 0, u.yaw, u.roll || 0, 'YXZ');
					}
				}
				if (u.dead > 40) hide(u);
				continue;
			}
			place(p, u, dt);
			if (shownNow && !u.mesh) show(u);
			else if (!shownNow && u.mesh) hide(u);
			if (u.mesh) {
				u.mesh.position.copy(u.pos); u.mesh.rotation.set(u.pitch || u.bank || 0, u.yaw, u.roll || 0, 'YXZ');
				const U = u.mesh.userData;
				// its moving parts: the rotors turning, the jet clean, tracks and wheels running with the ground covered
				const run = u.last ? Math.hypot(u.pos.x - u.last.x, u.pos.z - u.last.z) : 0;
				u.last = { x: u.pos.x, z: u.pos.z };
				if (u.kind === 'heli') U.pose?.({ spin: 1, dt });
				else if (u.kind === 'jet') U.pose?.({ gear: u.air ? 0 : 1, throttle: 0.8, surf: { pitch: 0, roll: -(u.bank || 0), yaw: 0, flap: 0 }, dt });
				else if (u.kind === 'tank') U.pose?.({ track: [run, run] });
				else U.pose?.({ roll: run });
				if (u.T) { u.T.bound.x = u.pos.x; u.T.bound.y = u.pos.y + DIMS[u.kind].H / 2; u.T.bound.z = u.pos.z; }
				if (!u.engine && distK(u) > 0.05 && patrols.reduce((a, q) => a + q.units.filter((o) => o.engine).length, 0) < 3) u.engine = engineSound(u.kind);
				u.engine?.set(0.6, 0.6, distK(u), 10, u.pos);
				if (p.state === 'onscene' || (u.air && p.state === 'enroute' && u.flyS > Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z) - 400)) engage(u, dt);
				if (u.beam) {
					// (from under its nose to the ground at the scene, a little ahead of where it looks)
					const on = kit.night.value > 0.25 && p.state === 'onscene', gx = p.to.x, gz = p.to.z, gy = ground(gx, gz);
					u.beam.visible = on;
					if (on) { _v.set(gx - u.pos.x, gy - u.pos.y + 1, gz - u.pos.z); const L = _v.length(); u.beam.position.set(u.pos.x, u.pos.y - 1, u.pos.z); u.beam.quaternion.setFromUnitVectors(_up, _v.normalize()); u.beam.scale.set(1, L, 1); }
				}
			}
		}
		p.shown = !!shownNow;
		// the troops get out once you are near enough to see it
		if (p.state === 'onscene' && !p.deployed && e && Math.hypot(p.to.x - e.x, p.to.z - e.z) < 260) deploy(p);
	}
	function place(p, u, dt) {
		if (u.air) {
			const dx = p.to.x - p.from.x, dz = p.to.z - p.from.z, L = Math.hypot(dx, dz) || 1;
			if (u.kind === 'jet') {
				// a pass straight over the scene and on, then round again
				const s = u.flyS % (L + 3000), x = p.from.x + dx / L * s, z = p.from.z + dz / L * s;
				u.pos.set(x, ground(x, z) + 160, z); u.yaw = Math.atan2(dx, dz); u.bank = 0;
				return;
			}
			if (p.state === 'onscene' || p.state === 'boarding' || p.state === 'leaving') {
				// flying the fight (flight.js heliTacticStep): round the scene, or whom it fights
				// when it has someone in its sights; the police tight, low and nose-in. Leaving, it
				// turns for home and goes.
				const cop = p.side === 'police';
				if (!u.fly) u.fly = heliAirState(u.pos.x, u.pos.y, u.pos.z, u.yaw);
				const at = u.at && p.t - u.at.t < 4 && !cop ? u.at : p.to;
				heliTacticStep(u.fly, at, Math.min(dt, 0.1), ground, { tight: cop, i: u.i, depart: p.state === 'leaving' ? p.from : null });
				u.pos.copy(u.fly.pos); u.yaw = u.fly.yaw; u.pitch = u.fly.pitch; u.roll = u.fly.roll; u.bank = 0;
				return;
			}
			const s = Math.max(0, Math.min(L, u.flyS)), x = p.from.x + dx / L * s, z = p.from.z + dz / L * s;
			u.pos.set(x, ground(x, z) + Math.min(80, 10 + s * 0.4), z); u.yaw = Math.atan2(dx, dz); u.bank = 0; u.pitch = 0.14; u.roll = 0;
			return;
		}
		if (!p.route) return;
		if (p.state === 'onscene' || p.state === 'boarding' || (p.state === 'enroute' && p.s + u.s >= p.route.length - 20)) {
			// pulled up nose to tail along the road at the scene (not across the block), facing it
			const q = along(p.route, Math.max(0, p.route.length - 6 - u.i * (DIMS[u.kind].L + 6)));
			const x = q.x, z = q.z;
			u.pos.x += (x - u.pos.x) * Math.min(1, dt * 0.8); u.pos.z += (z - u.pos.z) * Math.min(1, dt * 0.8);
			u.pos.y = ground(u.pos.x, u.pos.z, u.pos.y + 2);
			u.yaw += Math.atan2(Math.sin(Math.atan2(p.to.x - u.pos.x, p.to.z - u.pos.z) - u.yaw), Math.cos(Math.atan2(p.to.x - u.pos.x, p.to.z - u.pos.z) - u.yaw)) * Math.min(1, dt);
			return;
		}
		const q = along(p.route, Math.max(0, p.s + u.s));
		u.pos.set(q.x, ground(q.x, q.z, u.pos.y + 3 || 1e4), q.z);
		const want = Math.atan2(q.dx, q.dz) + (p.state === 'leaving' ? Math.PI : 0);
		u.yaw += Math.atan2(Math.sin(want - u.yaw), Math.cos(want - u.yaw)) * Math.min(1, dt * 3);
		if (u.mesh && Math.random() < dt * 3) combat.fx.dust({ x: u.pos.x - Math.sin(u.yaw) * DIMS[u.kind].L / 2, y: u.pos.y + 0.3, z: u.pos.z - Math.cos(u.yaw) * DIMS[u.kind].L / 2 }, 2, 0.58, 0.53, 0.45, 1, 0.4);
	}
	function arrive(p) {
		p.state = 'onscene'; p.stayT = STAY;
		const e = eye();
		if (e && Math.hypot(p.to.x - e.x, p.to.z - e.z) < 1500) hint(p.side === 'police' ? 'The police helicopter is overhead.' : p.side === 'guard' ? 'Meridian Guard on the scene.' : 'The Ironvale column is here!', 2500, 1);
	}
	function deploy(p) {
		p.deployed = true;
		if (!p.troops) return;
		military.deployments.push({ x: p.to.x, z: p.to.z, r: 160, id: p.id });
		const fid = p.side === 'guard' ? 'guard' : 'ironvale', n = isPhone ? Math.min(3, p.troops) : Math.min(6, p.troops);
		const a = Math.atan2(p.from.x - p.to.x, p.from.z - p.to.z), x = p.to.x + Math.sin(a) * 18, z = p.to.z + Math.cos(a) * 18;
		p.members = [];
		p.squad = combat.squads.squad(fid, x, z, n, { post: { kind: 'deploy', x: p.to.x, z: p.to.z, r: 140 }, alert: p.side !== 'guard', tag: p.id, y: ground(x, z) + 0.6 });
		p.squad.then((s) => { p.members = s?.members || []; });
	}
	function leave(p) {
		p.state = 'boarding'; p.boardAt = p.t;
		const i = military.deployments.findIndex((d) => d.id === p.id);
		if (i >= 0) military.deployments.splice(i, 1);
		// each soldier back to the nearest vehicle
		const wheels = p.units.filter((u) => !u.dead && !u.air);
		for (const h of p.members || []) {
			if (h.dead) continue;
			let best = null, bd = 1e9;
			for (const u of wheels) { const d = Math.hypot(u.pos.x - h.pos.x, u.pos.z - h.pos.z); if (d < bd) { bd = d; best = u; } }
			h.recall = true; h.alert = 0; h.target = null; h.goal = null; h.leg = undefined;
			h.post = best ? { kind: 'board', x: best.pos.x - Math.sin(best.yaw) * (DIMS[best.kind].L / 2 + 1), z: best.pos.z - Math.cos(best.yaw) * (DIMS[best.kind].L / 2 + 1), r: 8 } : h.post;
		}
		if (!wheels.length || !(p.members || []).length) pullOut(p);
	}
	function pullOut(p) {
		p.state = 'leaving'; p.leaveAt = p.t;
		for (const h of [...(p.members || [])]) if (!h.dead) combat.squads.release(h);
		p.members = [];
		if (p.route) p.s = Math.min(p.s, p.route.length - 20);
	}
	function finish(p) {
		p.state = 'done';
		for (const u of p.units) hide(u);
		// home: the vehicles that came back are the base's again
		if (p.base) for (const u of p.units) if (!u.dead) p.base.units[u.kind] = (p.base.units[u.kind] || 0) + 1;
	}

	// the police helicopter at the top of the ladder (law/, the wanted level at five): the air
	// unit's own model in the police's navy, over where you were last seen, a searchlight on the
	// scene after dark; it does not fire, and goes home when the level comes down
	function policeAir(at) {
		const e = eye();
		if (!e || !W()?.bayArea || patrols.some((p) => p.side === 'police' && p.state !== 'done')) return null;
		const a = Math.random() * Math.PI * 2, from = { x: at.x + Math.cos(a) * 1400, z: at.z + Math.sin(a) * 1400 };
		const p = launch({ side: 'police', why: 'wanted', from, to: { x: at.x, z: at.z }, units: ['heli'], troops: 0, mode: 'air' });
		combat.call?.('Air One is up. We will have eyes on the suspect shortly.', 'Harbour Police');
		return p;
	}

	// ---------- invasions ----------
	function invade(at = null) {
		const e = eye(), w = W();
		if (!e || !w?.bayArea) return 'Earth only.';
		if (patrols.some((p) => p.side === 'ironvale' && p.state !== 'done')) return 'An invasion is already under way.';
		const target = at || { x: e.x + 180, z: e.z + 120 };
		// from land (another region over the hills), or the sea if that is all there is
		let plan = null;
		for (let k = 0; k < 12 && !plan; k++) { const q = invasionPlan(target, Math.random, k * 0.52); if (w.island.heightAt(q.from.x, q.from.z) > 1) plan = q; }
		plan ||= invasionPlan(target);
		const dir = Math.round(((Math.atan2(plan.from.x - target.x, -(plan.from.z - target.z)) * 180 / Math.PI) + 360) % 360);
		const p = launch({ side: 'ironvale', why: 'invasion', from: plan.from, to: target, units: plan.vehicles, troops: plan.squads.reduce((a, b) => a + b, 0), mode: 'road' });
		hint(`An Ironvale Legion column has crossed into the region from the ${['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(dir / 45) % 8]}!`, 5000, 2);
		combat.call?.('Air raid sirens wail across the town.', '');
		// the Guard is sent to meet it
		setTimeout(() => event({ kind: 'invasion', x: target.x, z: target.z, severity: 3 }), 1500);
		return { id: p.id, eta: p.eta, from: plan.from };
	}

	function update(dt) {
		time += dt;
		const w = W();
		if (!w?.bayArea) return;
		for (const p of patrols) if (p.state !== 'done') step(p, dt);
		for (let i = patrols.length - 1; i >= 0; i--) if (patrols[i].state === 'done') patrols.splice(i, 1);
		// now and then, an invasion (not while you fly or are in the Deep)
		invT -= dt;
		if (invT <= 0) { invT = nextInvasion(); const p = w.player?.state; if (p && !p.flying && military.basesState().length) invade(); }
	}
	function clear() { for (const p of patrols) { for (const u of p.units) hide(u); } patrols.length = 0; }
	const info = () => patrols.map((p) => { const e = eye(), lead = p.route ? along(p.route, p.s) : p.to; return { id: p.id, side: p.side, why: p.why, from: p.base?.name || 'another region', mode: p.mode, state: p.state, units: p.units.filter((u) => !u.dead).map((u) => u.kind), lost: p.units.filter((u) => u.dead).length, eta: p.state === 'enroute' ? Math.max(0, Math.round(p.eta - p.t)) : 0, km: e ? +(Math.hypot(lead.x - e.x, lead.z - e.z) / 1000).toFixed(2) : null, shown: p.shown, deployed: p.deployed }; });
	return { event, invade, policeAir, update, clear, info, patrols, launch };
}
