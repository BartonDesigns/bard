// Shots and what they do, moved out of combat/combat.js's createCombat: where a shot lands, your
// own shots, projectiles in flight, blasts, knockouts and waking, and fire.
// What it uses from combat.js's createCombat comes from cb: what is set up before it can run, once
// at the top of each call; the rest (lastShotNotice, worldKey) as cb.name at each use, and it sets
// lastShotNotice. A name not yet there needs a getter in createCombat's cb.

import * as THREE from 'three';
import { spreadDir, spreadNow, isBow, bowPower, damageAt } from './weapons.js';
import { revive } from './health.js';
import { rayCapsule } from './targets.js';
import { officerHurt, clearWanted } from './heat.js';
import { FACTIONS, PLAYER } from './factions.js';

export function combatLandShot(cb, hit, from, dir, by, dmg, type = 'ballistic', onward = true) {
	const { boxId, broke, deal, firstHit, fx, heatUp, landShot, ME, spark, W, worldHit } = cb;
	const p = new THREE.Vector3().copy(from).addScaledVector(dir, hit.t);
	if (hit.wall) {
		fx.impact(p, hit.n, hit.surface, type === 'energy');
		const sh = W()?.structures?.hit?.(p, dir, hit, dmg, type);          // structures: a pane cracked or broken, a wall's pock, a heavy round's hole
		hit.through = sh?.through ? sh.dmg : 0;
		if (sh?.broke && by === ME) broke(p);
		if (sh?.through && !hit.pierced && onward) { const q = p.clone().addScaledVector(dir, 0.05), h2 = firstHit(q, dir, 250, by === ME ? ME : by?.T || by); hit.end = hit.t + 250; if (h2) { h2.pierced = true; h2.t += hit.t + 0.05; hit.end = h2.t; return landShot(h2, from, dir, by, sh.dmg, type); } return null; }          // structures: on through one pane, weaker
		if (hit.box && (type === 'energy' || type === 'fire')) heatUp(boxId(hit.box), hit.box, dmg, by === ME);
		return null;
	}
	const T = hit.T;
	if (hit.ward) { spark(T, p, by); return { ward: true }; }
	const blow = { amount: dmg, type, part: hit.part, side: hit.shape?.side || null, shape: hit.shape || null, at: { x: p.x, y: p.y, z: p.z }, src: from.clone ? from.clone() : from, dir: { x: dir.x, y: dir.y, z: dir.z }, by: by === ME ? ME : by?.T || by };
	fx.impact(p, hit.n || { x: -dir.x, y: -dir.y, z: -dir.z }, T.surface || 'stone', type === 'energy');
	// through a person: the spatter on what stands behind them, or the ground beyond
	if (T.surface === 'person' && (type === 'ballistic' || type === 'pierce') && !T.child) {
		const q = p.clone().addScaledVector(dir, 0.35), back = worldHit(q, dir, 3.2);
		fx.spatter(p, dir, back ? { p: q.addScaledVector(dir, back.t), n: back.n } : null, hit.part === 'head' || hit.part === 'neck' ? 1.3 : 1);
	}
	return deal(T, blow, by === ME);
}

export function combatYours(cb, T, r, blow, ctx0) {
	const { arms, broke, call, cars, crime, defendNow, eye, forgive, held, hud, hurtOnce, isEarth,
		morality, notice, placeName, relations, squads, wanted, witnesses } = cb;
	if (r.dealt > 0) { hud.hit(!!r.killed, blow.part === 'head' || blow.part === 'neck'); if(T.kind==='person' && !ctx0?.hostileTarget && !blow.moral?.hostileTarget) notice('assault',T.bound,r.killed?'killed a person':'attacked a person'); }
	const ctx = { ...(ctx0 || {}), ...(blow.moral || {}), witnessed: witnesses(T.bound) > 0 };
	ctx.unseen = !ctx.witnessed;
	const fac = T.faction, F = FACTIONS[fac];
	if (T.kind === 'boss') { if (r.killed) morality.record({ kind: 'boss-slain', target: T.name, world: cb.worldKey, place: placeName() }); return; }
	if (T.kind === 'car') { const car = cars.state.get(T.id); if (car) car.lastMine = true; return; }
	if (T.kind === 'prop') { if (r.killed) broke(T.bound); return; }
	// an officer hurt while the police are on your side: two warnings, then they turn on you
	// (an officer killed turns them at once)
	if (isEarth() && wanted.blue && F?.lawful && F.kind !== 'military') {
		const k = r.killed ? 'turn' : officerHurt(wanted, performance.now() / 1000);
		if (k === 'warn' || k === 'same') {
			forgive(T.ref);
			if (k === 'warn') call(wanted.strikes === 1 ? 'Watch your fire! That is an officer!' : 'Last warning! Hit one of us again and you go down with them!', 'Harbour Police');
			return;
		}
		wanted.blue = 0; wanted.strikes = 0;
		call('That is it. Take the shooter down!', 'Harbour Police');
	}
	if (fac && fac !== 'world' && FACTIONS[fac]) relations.attacked(PLAYER, fac, r.killed ? 1 : 0.25);
	const lawful = !!F?.lawful;
	// they opened fire on you first (or struck first): answering them is no crime
	const defence = !lawful && !!(T.ref?.struckFirst || blow.moral?.selfDefence);
	if (defence) { defendNow(T.bound); ctx.defence = true; }
	if (lawful) ctx.lawTarget = true;
	if (F?.kind === 'civilians') ctx.unarmed = true;
	if (r.killed) {
		const kind = ctx.surrendered ? 'kill-surrendered' : 'kill';
		morality.record({ kind, target: T.name || 'someone', faction: fac, place: placeName(), world: cb.worldKey, ctx });
		// fighting off raiders at a village, or beside a side whose enemy this was
		const S = T.ref?.squad;
		if (S?.raid && !ctx.surrendered) { morality.record({ kind: 'defend-village', place: placeName(), world: cb.worldKey, ctx: {} }); relations.helped(PLAYER, 'village', 2); relations.helped('hearthguard', PLAYER, 3); }
		for (const f of Object.keys(FACTIONS)) if (f !== fac && relations.hostile(f, fac) && squads.alive().some((h) => h.fid === f && h.alert && Math.hypot(h.pos.x - eye().x, h.pos.z - eye().z) < 80)) { relations.helped(f, PLAYER, 1.5); if (Math.random() < 0.3) morality.record({ kind: 'help-faction', target: FACTIONS[f].name, world: cb.worldKey, place: placeName() }); break; }
		if (F?.kind === 'civilians' && T.ref?.raid) morality.record({ kind: 'raid-village', place: placeName(), world: cb.worldKey, ctx });
		if (!defence) crime(lawful ? 'downPolice' : F?.kind === 'civilians' ? 'downCivilian' : 'hitCivilian', T.bound, ctx.witnessed || lawful);
		const H = held();
		if (H) arms?.train?.(H.u, 4);
	} else if (!ctx.hostileTarget && !hurtOnce.has(T.id)) {
		hurtOnce.add(T.id);
		morality.record({ kind: 'hurt', target: T.name || 'someone', faction: fac, place: placeName(), world: cb.worldKey, ctx });
		if (!defence) crime(lawful ? 'hitPolice' : 'hitCivilian', T.bound, ctx.witnessed || lawful);
	}
}

export function combatFireShot(cb, w, charge = 1) {
	const { camera, civilians, crime, defendNow, eye, firstHit, fx, isEarth, landShot, me, ME, net,
		notice, projectile, squads, threatened, view, W, witnesses } = cb;
	const S = w.S, ads = view.state()?.aiming ? 1 : 0;
	const m = view.muzzle(S.range);
	const o = m.aim.origin, aim = m.aim.direction;
	const d0 = spreadDir([aim.x, aim.y, aim.z], spreadNow(w, ads, Math.min(1, me.speed / 5)));
	const dir = new THREE.Vector3(d0[0], d0[1], d0[2]);
	const from = m.position;
	me.firing = 1.5;
	if (S.projectile) {
		const to = new THREE.Vector3().copy(o).addScaledVector(dir, Math.min(S.range, 80));
		const power = isBow(w) ? bowPower(charge) : { speed: 1, damage: 1 };
		projectile({ from, to, direction: isBow(w) ? dir : null, speed: S.projectile.speed * power.speed, drop: S.projectile.drop, dmg: S.dmg * power.damage, type: S.type, owner: ME, style: S.tracer, splash: S.projectile.splash, life: S.projectile.life, arrow: isBow(w) });
		net.fx(from, to, S.tracer, 0);
	} else {
		const hit = firstHit(o, dir, S.range);
		if (hit) landShot(hit, o, dir, ME, damageAt(S, hit.t), S.type);
		const end = hit ? new THREE.Vector3().copy(o).addScaledVector(dir, Math.min(S.range, hit.end ?? hit.t)) : new THREE.Vector3().copy(o).addScaledVector(dir, S.range);
		fx.tracer(from, end, S.tracer);
		net.fx(from, end, S.tracer, hit ? 1 : 0);
		// the spent case out of the breech, a hand's length back from the muzzle
		if (S.type !== 'energy') fx.wisp(from, dir);
		if (S.type !== 'energy') fx.casing({ x: from.x - dir.x * 0.32, y: from.y - dir.y * 0.32 + 0.03, z: from.z - dir.z * 0.32 }, dir);
	}
	const at = eye();
	if(Date.now()-cb.lastShotNotice>4000) {cb.lastShotNotice=Date.now();notice('shots',at,'fired a weapon nearby');}
	civilians.alarm(at.x, at.z, 30);
	squads.hear(at.x, at.z, 70);
	if (!isBow(w)) W()?.flush?.noise(at, S.type === 'energy' ? 0.35 : 0.6, camera.position);
	if (isEarth() && threatened()) defendNow(at);
	else crime('shots', at, witnesses(at) > 0);
}

export function combatProjectile(cb, o) {
	const { arrowMesh, endProjectile, fx, placeArrow, projectiles } = cb;
	const from = o.from.clone ? o.from.clone() : new THREE.Vector3(o.from.x, o.from.y, o.from.z);
	const to = o.to.clone ? o.to.clone() : new THREE.Vector3(o.to.x, o.to.y, o.to.z);
	const dist = from.distanceTo(to) || 1, tof = dist / o.speed;
	// Arrows leave along the sight direction and drop naturally. Other projectiles
	// retain their existing trajectory compensation.
	const vel = o.direction ? o.direction.clone().normalize().multiplyScalar(o.speed) : to.clone().sub(from).divideScalar(tof);
	if (!o.arrow) vel.y += 0.5 * (o.drop || 0) * tof;
	const mesh = o.arrow ? arrowMesh() : null;
	const p = { ...o, pos: from, vel, life: o.life || 4, arrowMesh: mesh, streak: mesh ? null : fx.held(o.style ?? 0, o.arrow ? 0.02 : o.missile ? 0.18 : o.style === 2 ? 0.07 : 0.06), len: o.arrow ? 0.8 : o.missile ? 1.4 : 1.2 };
	if (mesh) placeArrow(p);
	projectiles.push(p);
	if (projectiles.length > 60) endProjectile(projectiles[0], null);
	return p;
}

export function combatStepProjectiles(cb, dt) {
	const { _d, _v, endProjectile, eye, EYE, firstHit, flareLands, fx, hurtPlayer, landShot, me, ME,
		placeArrow, projectiles, spark } = cb;
	for (const p of [...projectiles]) {
		p.life -= dt;
		if (p.life <= 0) { endProjectile(p, null); continue; }
		if (p.missile) {
			// homing, gently, on you
			const want = _v.subVectors(eye(), p.pos).normalize().multiplyScalar(p.speed);
			p.vel.lerp(want, Math.min(1, dt * 0.9));
			if (Math.random() < 0.6) fx.smokePuff(p.pos, 0.6, 0.3, 0.8);
		}
		p.vel.y -= (p.drop || 0) * dt;
		const step = p.vel.length() * dt, dir = _d.copy(p.vel).normalize().clone();
		let hit = firstHit(p.pos, dir, step, p.owner === ME ? ME : p.owner);
		// a hostile shot meets you
		if (p.hostile && !me.ko) {
			const e = eye(), t = rayCapsule(p.pos, dir, { x: e.x, y: e.y - EYE + 0.3, z: e.z }, { x: e.x, y: e.y - 0.1, z: e.z }, 0.4);
			if (t <= step && (!hit || t < hit.t)) hit = { me: true, t };
		}
		if (hit) {
			const at = p.pos.clone().addScaledVector(dir, hit.t);
			if (hit.me) { hurtPlayer({ amount: p.dmg, type: p.type, part: 'torso', src: p.from || p.pos.clone(), by: p.owner }); fx.impact(at, null, 'energy', true); }
			else if (hit.ward) { spark(hit.T, at, p.owner); }
			else if (p.flare) { flareLands(at, hit); }
			else landShot(hit, p.pos, dir, p.owner, p.dmg, p.type, false);
			if (hit.through && !p.pierced) { p.pierced = true; p.dmg = hit.through; p.pos.addScaledVector(dir, hit.t + 0.05); continue; }          // structures: through one pane, flying on
			endProjectile(p, hit.ward ? null : at);
			continue;
		}
		p.pos.addScaledVector(p.vel, dt);
		if (p.T) { p.T.bound.x = p.pos.x; p.T.bound.y = p.pos.y; p.T.bound.z = p.pos.z; }
		if (p.arrowMesh) placeArrow(p);
		else fx.place(p.streak, p.pos.x - dir.x * p.len, p.pos.y - dir.y * p.len, p.pos.z - dir.z * p.len, dir.x, dir.y, dir.z, p.len);
		if (p.flare && Math.random() < 0.8) fx.flame(p.pos, 0.3);
	}
}

export function combatBlast(cb, at, r, dmg, by, source = null, type = 'blast') {
	const { camera, civilians, deal, eye, EYE, hurtPlayer, ignite, layer, me, ME, morality, neighbours,
		placeName, rules, shakeIt, sound, spark, squads, W } = cb;
	const c = at.clone ? at : new THREE.Vector3(at.x, at.y, at.z);
	const wards = [];
	const mine = by === ME;
	for (const x of layer.within(c, r, mine ? ME : by, rules, wards)) {
		if (x.T === source) continue;
		const k = 1 - x.d / r;
		const blow = { amount: dmg * (0.3 + 0.7 * k), type, part: 'body', src: c, dir: { x: x.T.bound.x - c.x, y: 0.3, z: x.T.bound.z - c.z }, by: mine ? ME : by };
		const before = x.T.moral?.();
		const res = deal(x.T, blow, mine);
		if (mine && res?.dealt && x.T.faction === 'civ' && squads.alive().some((h) => h.alert)) morality.record({ kind: 'collateral', place: placeName(), world: cb.worldKey, ctx: before || {} });
	}
	for (const T of wards) spark(T, { x: T.bound.x, y: T.bound.y, z: T.bound.z }, mine ? ME : null);
	const e = eye(), d = Math.hypot(e.x - c.x, e.y - EYE * 0.5 - c.y, e.z - c.z);
	if (d < r && !me.ko) hurtPlayer({ amount: dmg * (1 - d / r) * (mine ? 0.5 : 1), type, part: 'torso', src: c, by });
	if (d < r * 4) shakeIt(0.5 * (1 - d / (r * 4)));
	civilians.alarm(c.x, c.z, 35); squads.hear(c.x, c.z, 90);
	W()?.flush?.noise(c, 1, camera.position);
	sound('boom', c);
	W()?.structures?.blast?.(c, r, dmg);          // structures: the panes round it, the walls it reaches
	// a big one sets cars and buildings near it alight
	if (dmg >= 60) { for (const n of neighbours(c.x, c.z, r)) if (Math.random() < 0.5) ignite(n.id, n.x, n.z, n.fuel, mine); }
}

export function combatKnockout(cb, blow) {
	const { cancelInput, hint, hooks, isEarth, me, multiplayer, P, pvp, squads, wanted } = cb;
	cancelInput();
	// downed by a friend in a PvP fight: they are told, for their honor (combat/honor.js)
	const by = blow?.by?.kind === 'remote' ? String(blow.by.id || '').replace(/^rp:/, '') : '';
	if (by && pvp.server) multiplayer?.send?.({ t: 'down', by, r: hooks.honorRank?.() || 0 });
	me.ko = 6;
	const p = P();
	if (p) p.locked = true;
	// with the police after you and officers near, downed is an arrest (law/: booked on waking)
	me.custody = isEarth() && !!hooks.arrest?.({ downed: true });
	if (!me.custody) clearWanted(wanted);
	// the fight forgets you while you are down
	for (const h of squads.alive()) { if (h.target?.id === 'me') h.target = null; h.provoked = false; }
	if (!me.custody) hint('You were knocked out. You come to somewhere safer.', 5000, 2);
}

export function combatWake(cb) {
	const { hooks, me, P, services, squads } = cb;
	const p = P();
	me.ko = 0;
	revive(me.H, 0.7);
	if (!p) return;
	// in custody: you come to at the station, booked
	if (me.custody) {
		me.custody = false;
		const at = hooks.booked?.();
		if (at) { p.pos.set(at.x, at.y, at.z); p.vel?.set?.(0, 0, 0); if (Number.isFinite(at.yaw)) p.yaw = at.yaw; p.locked = false; return; }
	}
	// brought round at the nearest hospital, when there is one (services/index.js)
	const care = services()?.revive?.(p.pos);
	if (care) { revive(me.H, care.k); p.pos.set(care.x, care.y, care.z); p.vel?.set?.(0, 0, 0); p.locked = false; return; }
	// back along your own way, out of the fight
	const e = p.pos, threat = squads.alive().find((h) => h.alert && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 80);
	let spot = null;
	for (let i = me.crumbs.length - 1; i >= 0; i--) { const c = me.crumbs[i]; if (Math.hypot(c.x - e.x, c.z - e.z) > 45 && (!threat || Math.hypot(c.x - threat.pos.x, c.z - threat.pos.z) > 60)) { spot = c; break; } }
	if (spot) { p.pos.set(spot.x, spot.y, spot.z); p.vel?.set?.(0, 0, 0); }
	p.locked = false;
}

export function combatIgnite(cb, id, x, z, fuel = 1, mine = false, box = null) {
	const { boxesNear, boxId, cars, civilians, crime, fireField, fireMeta, ground, morality, notice,
		placeName, witnesses } = cb;
	if (!fireField.ignite(id, x, z, { fuel })) return false;
	const kind = id.startsWith('car:') ? 'car' : id.startsWith('b:') ? 'building' : id.startsWith('pr') ? 'prop' : 'ground';
	const b = box || (kind === 'building' ? boxesNear(x, z, 12).find((q) => boxId(q) === id) : null);
	const occupied = kind === 'building' && (witnesses({ x, z }) > 1 || ((b?.x * 7 + b?.z * 13) % 10 + 10) % 10 < 5);
	fireMeta.set(id, { kind, x, z, b, occupied, t: 0, crew: false, mine, emit: 0 });
	if (kind === 'car') cars.burn(id);
	if (mine && kind !== 'ground') {
		notice('arson',{x,y:ground(x,z),z},'set a fire');
		morality.record({ kind: 'arson', target: kind === 'building' ? (occupied ? 'an occupied building' : 'an empty building') : kind === 'car' ? 'a car' : 'some stores', place: placeName(), world: cb.worldKey, ctx: { occupied, empty: !occupied, witnessed: witnesses({ x, z }) > 0 } });
		crime('car', { x, z }, true);
	}
	civilians.alarm(x, z, 30);
	return true;
}

export function combatStepFire(cb, dt) {
	const { call, eye, fireField, fireMeta, fx, ground, hurtPlayer, ignite2, isEarth, isPhone, neighbours,
		props, rnd, scorch, services, squads } = cb;
	for (const e of fireField.tick(dt, neighbours)) {
		if (e.type === 'spread') { const F = fireField.fires.get(e.to); const src = fireMeta.get(e.from); if (F) ignite2(e.to, F, src?.mine); }
		if (e.type === 'out') {
			const M = fireMeta.get(e.id);
			if (M?.kind === 'prop') props.burnOut(e.id);
			if (M?.kind === 'building' && M.b) scorch(M.b);
			fireMeta.delete(e.id);
		}
	}
	const e = eye();
	for (const F of fireField.fires.values()) {
		const M = fireMeta.get(F.id);
		if (!M) continue;
		M.t += dt; M.emit -= dt;
		// the smoke over it, seen from across the land while it burns and long after
		{ const big = M.kind === 'building' && M.b, g = ground(F.x, F.z); fx.column('fire:' + F.id, { x: F.x, y: g + (big ? (M.b.wallH || 6) : 1), z: F.z, h: big ? 120 + F.heat * 90 : M.kind === 'car' ? 80 : 45, r: big ? Math.max(3, Math.max(M.b.w, M.b.d) * 0.22) : 2, spread: big ? 5 : 6, shade: 0.07, k: 0.3 + 0.7 * F.heat, life: 1.5, fade: big ? 120 : 70 }); }
		// a crew comes on Earth
		// (an engine from the nearest station when there is one: services/index.js; else they walk in)
		if (isEarth() && !M.crew && M.t > 10 && (M.kind === 'building' || M.kind === 'car')) {
			M.crew = true;
			const crew = (x, z) => squads.squad('fire', x, z, 2, { task: F.id });
			if (services()?.dispatchFire?.(F, crew)) call('Engine on the way from the station!', 'bystander');
			else { const a = Math.random() * 6.283; crew(F.x + Math.cos(a) * 40, F.z + Math.sin(a) * 40); call('Fire crew on the way!', 'bystander'); }
		}
		if (M.kind === 'building' && M.b) {
			const b = M.b, H = b.wallH || 6, g = ground(b.x, b.z);
			const dist = Math.hypot(e.x - b.x, e.z - b.z);
			if (dist < 140 && M.emit <= 0) {
				M.emit = isPhone ? 0.08 : 0.04;
				const n = Math.ceil(F.heat * 3);
				for (let i = 0; i < n; i++) {
					const side = Math.floor(Math.random() * 4), u = Math.random() - 0.5, c = Math.cos(b.a || 0), s = Math.sin(b.a || 0);
					const lx = side < 2 ? u * b.w : (side === 2 ? 1 : -1) * b.w / 2, lz = side < 2 ? (side ? 1 : -1) * b.d / 2 : u * b.d;
					const y = g + Math.random() * H * Math.min(1, F.heat * 1.3);
					fx.flame({ x: b.x + lx * c + lz * s, y, z: b.z - lx * s + lz * c }, 1 + F.heat);
				}
				if (Math.random() < 0.5) fx.smokePuff({ x: b.x + rnd(-b.w / 3, b.w / 3), y: g + H + 1, z: b.z + rnd(-b.d / 3, b.d / 3) }, 0.1, 2.2 + F.heat * 2, 5);
			}
			if (dist < Math.max(b.w, b.d) / 2 + 2.5 && F.heat > 0.3) hurtPlayer({ amount: 6 * dt * F.heat, type: 'fire', part: 'torso', src: { x: b.x, y: g, z: b.z }, quiet: true });
		} else if (M.kind === 'prop' || M.kind === 'ground') {
			if (M.emit <= 0) { M.emit = 0.06; fx.flame({ x: F.x, y: ground(F.x, F.z) + 0.3, z: F.z }, 0.8 * F.heat + 0.3); if (Math.random() < 0.3) fx.smokePuff({ x: F.x, y: ground(F.x, F.z) + 1.5, z: F.z }, 0.15, 1, 3); }
			if (Math.hypot(e.x - F.x, e.z - F.z) < 1.8) hurtPlayer({ amount: 8 * dt, type: 'fire', part: 'torso', src: { x: F.x, y: e.y, z: F.z }, quiet: true });
		}
	}
}
