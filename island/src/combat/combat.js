// The fight, put together: your arms in use (combat/weapons.js rules, the view's look through
// combat/weapon-view.js), shots cast into the combat layer (combat/targets.js) and against the
// ground and buildings, projectiles, blasts, your health and the HUD, the townsfolk's reactions,
// the squads and their wars (combat/ai-squads.js, factions.js), cars, props, fire and arson,
// the wanted level on Earth, the bosses, friends in a room, and the morality compass that
// weighs it all. main.js makes one and calls update() each frame.
//
// Input: left mouse (or the Fire button) fires, R reloads, Z changes fire mode, right mouse aims
// (the view's own), Y throws a signal flare (it sets things alight), K opens the compass. Aiming
// at someone close holds them up.

import * as THREE from 'three';
import { WEAPONS, weaponStats, createWeaponState, trigger, cancelTrigger, cancelReload, completeReload, isBow, bowPower, stepWeapon, startReload, nextMode, modeOf, spreadNow, spreadDir, damageAt, reserveOf, drawRounds } from './weapons.js';
import { createBowArrow } from '../crysis/bow-visual.js';
import { kitMaterial } from '../crysis/held-items.js';
import { createHealth, applyDamage, tickHealth, revive } from './health.js';
import { createLayer, canHit, warded, strike, rayBox, rayCapsule, personShapes } from './targets.js';
import { createWanted, offend, tickWanted, clearWanted, responseFor } from './heat.js';
import { createFx } from './fx.js';
import { createHud } from './hud.js';
import { createWeaponView } from './weapon-view.js';
import { createCivilians } from './civilians.js';
import { createSquads } from './ai-squads.js';
import { createLootView } from './loot-view.js';
import { createProps } from './props.js';
import { createCars } from './cars.js';
import { createFireField } from './fire.js';
import { createBoss } from './bosses.js';
import { BOSSES } from './boss-defs.js';
import { createRelations, FACTIONS, PLAYER } from './factions.js';
import { createMorality } from './morality.js';
import { createCompass } from './compass.js';
import { soundBus } from '../world/soundbus.js';

const EYE = 1.68;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private */ } } };
const load = (k, d) => { try { return JSON.parse(store.get(k)) ?? d; } catch { return d; } };
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
// what people say of the Spark, now and then, when it turns harm aside
const SPARK_LINES = ['The Spark! It turned it aside!', 'Thank the stars for the Spark.', 'You cannot hurt the young. Everyone knows that.', 'The Spark keeps them until they come of age.'];

export function createCombat({ scene, camera, mount, world, people, ragdolls, arms, gear, multiplayer = null, hint = () => {}, isPhone = false, shared = {}, drive = null, menu = null, busy = () => false }) {
	const W = () => world();
	const P = () => W()?.player?.state || null;
	const touch = isPhone || !!matchMedia?.('(pointer: coarse)')?.matches;

	// ---------- the ground, walls and sight ----------
	function ground(x, z, y = camera.position.y) {
		const w = W();
		if (!w) return 0;
		if (w.deep?.active?.()) { const f = w.deep.floor(x, z, y); return Number.isFinite(f) ? f : y - EYE; }
		const I = w.island;
		let g = I.heightAt(x, z);
		if (I.extraFloor) { const e = I.extraFloor(x, z, y + 1.5); if (Number.isFinite(e) && e > g && e < y + 2.5) g = e; }
		return g;
	}
	const boxesNear = (x, z, r) => { const w = W(); return w?.real?.loaded?.() ? w.real.near('boxes', x, z, r) : []; };
	const boxId = (b) => `b:${Math.round(b.x)},${Math.round(b.z)}`;
	// the first wall or ground a ray meets within max: { t, n, surface, box }
	function worldHit(o, d, max) {
		let best = null;
		const w = W();
		if (!w) return null;
		// buildings (Earth): boxes round the ray's middle
		if (!w.deep?.active?.()) {
			const mx = o.x + d.x * max / 2, mz = o.z + d.z * max / 2;
			for (const b of boxesNear(mx, mz, Math.min(130, max / 2 + 20))) {
				if (!(b.w > 0.5)) continue;
				const g = w.island.heightAt(b.x, b.z), H = (b.wallH || 6) + (b.roofH || 0) * 0.5;
				const h = rayBox(o, d, { x: b.x, y: g + H / 2 - 0.5, z: b.z }, [b.w / 2, H / 2 + 0.5, b.d / 2], -(b.a || 0));
				if (h && h.t < (best?.t ?? max)) best = { t: h.t, n: h.n, surface: 'stone', box: b };
			}
		}
		// the ground: marched, then refined
		const lim = best?.t ?? max;
		let t = 0.3, prev = 0;
		const above = (s) => o.y + d.y * s - ground(o.x + d.x * s, o.z + d.z * s, o.y + d.y * s);
		while (t < lim) {
			const a = above(t);
			if (a < 0) {
				let lo = prev, hi = t;
				for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2; if (above(m) < 0) hi = m; else lo = m; }
				const px = o.x + d.x * hi, pz = o.z + d.z * hi, e = 0.4, y0 = ground(px, pz, o.y + d.y * hi);
				const n = new THREE.Vector3(ground(px - e, pz, y0 + 1) - ground(px + e, pz, y0 + 1), 2 * e, ground(px, pz - e, y0 + 1) - ground(px, pz + e, y0 + 1)).normalize();
				return { t: hi, n, surface: w.deep?.active?.() ? 'crystal' : 'ground' };
			}
			prev = t;
			t += Math.max(0.4, Math.min(8, a * 0.6));
		}
		return best;
	}
	function blocked(a, b) {
		_d.subVectors(b, a);
		const L = _d.length();
		if (L < 0.5) return false;
		_d.multiplyScalar(1 / L);
		const h = worldHit(a, _d, L - 0.6);
		return !!h;
	}

	// ---------- the pieces ----------
	const fx = createFx({ isPhone, ground: (x, z) => ground(x, z) });
	const layer = createLayer();
	const relations = createRelations(load('l99-factions', null));
	const morality = createMorality({ store });
	const wanted = createWanted(arms?.state?.()?.heat || 0);
	const hud = createHud({ mount, touch });
	const view = createWeaponView({ gear, camera });
	const settings = { ambient: load('l99-combat-ambient', true) !== false, save() { store.set('l99-combat-ambient', JSON.stringify(this.ambient)); } };
	const group = new THREE.Group(); group.name = 'combat';
	group.add(fx.group);
	const me = { H: createHealth({ max: 100, regen: 9, delay: 5, down: true }), ko: 0, koText: '', lastPos: null, vel: new THREE.Vector3(), speed: 0, firing: 0, crumbs: [] };
	const ME = { id: 'me', kind: 'player', faction: PLAYER };
	const rules = { pvp: false };
	const fireField = createFireField({ maxBurning: isPhone ? 3 : 5, maxChain: 3, radius: 14, life: 75 });
	const fireMeta = new Map();
	const bosses = new Map();
	const projectiles = [];
	// Share the held arrow's lit geometry. The bounded pool never allocates per frame.
	let arrowTemplate = null;
	const arrowPool = [], arrowAxis = new THREE.Vector3(1, 0, 0), arrowDir = new THREE.Vector3();
	function arrowMesh() {
		const free = arrowPool.find((m) => !m.visible);
		if (free) { free.visible = true; return free; }
		if (arrowPool.length >= (isPhone ? 8 : 16)) return null;
		arrowTemplate ||= createBowArrow(kitMaterial(), isPhone);
		const m = arrowTemplate.clone(); m.name = 'flight-arrow'; m.frustumCulled = false;
		group.add(m); arrowPool.push(m); return m;
	}
	function placeArrow(p) {
		arrowDir.copy(p.vel).normalize();
		p.arrowMesh.position.copy(p.pos).addScaledVector(arrowDir, -0.745);
		p.arrowMesh.quaternion.setFromUnitVectors(arrowAxis, arrowDir);
	}
	let journal = load('l99-combat-journal', []);
	let worldKey = '', worldT = 0, directorT = 25, bountyT = 200, policeT = 0, wardMarkT = 0, sparkLineT = 0, shake = 0;

	const eye = () => P()?.pos || camera.position;
	const placeName = () => { const w = W(), p = eye(); try { const L = w?.labels?.where?.(p.x, p.z, p.y, false); if (L?.name) return L.name; } catch { /* no labels */ } return w?.deep?.active?.() ? 'the Deep' : w?.bayArea ? 'the Bay' : (shared.planet?.name ? `this ${shared.planet.name}` : 'this place'); };
	const isEarth = () => !!W()?.bayArea;
	const host = () => !multiplayer?.live?.() || multiplayer.isHost();
	function call(text, who) { hud.call(who && who !== 'boss' && who !== 'bystander' ? `${who}: ${text}` : text); }

	// ---------- your weapon ----------
	const ammo = load('l99-combat-ammo', { mags: {}, loose: {}, starter: {} });
	const saveAmmo = () => { if (Wp) ammo.mags[Wp.uid] = Wp.mag; store.set('l99-combat-ammo', JSON.stringify(ammo)); };
	let Wp = null;
	function held() { const H = arms?.held?.(); return H && WEAPONS[H.i] ? H : null; }
	function weaponNow() {
		const H = held();
		if (!H) { if (Wp) { cancelInput(); ammo.mags[Wp.uid] = Wp.mag; saveAmmo(); } Wp = null; return null; }
		if (!Wp || Wp.uid !== H.u || Wp.S.k !== weaponStats(H).k) {
			if (Wp) { cancelInput(); ammo.mags[Wp.uid] = Wp.mag; }
			const data = view.data(H.i);
			Wp = createWeaponState(H, ammo.mags[H.u] ?? null, data);
			// two magazines to start with, once for each kind of weapon
			if (!ammo.starter[H.i]) { ammo.starter[H.i] = 1; ammo.loose[H.i] = (ammo.loose[H.i] || 0) + Wp.S.mag * 2; }
			saveAmmo();
		}
		return Wp;
	}
	const boxes = (id) => arms?.state?.()?.items?.[WEAPONS[id]?.box] || 0;
	const reserve = (w) => reserveOf(ammo.loose[w.S.id] || 0, boxes(w.S.id), w.S);
	function reload() {
		if (!active()) return false;
		const w = weaponNow();
		if (!w || w.reloading > 0 || me.ko) return false;
		const R = reserve(w);
		if (R <= 0 || w.mag >= w.S.mag) { if (R <= 0) hint('No ammo for this. Ammo boxes are sold at shops and outfitters.', 3000); return false; }
		if (!startReload(w, R)) return false;
		const serial = w.reloadSerial;
		const viewTook = view.reload(() => { if (Wp === w && !isBow(w)) completeReload(w, serial); });
		if (viewTook && !isBow(w) && w.reloading > 1e-6) w.reloadDur = w.reloading = w.S.reload + 1.5;
		syncBow(w);
		return true;
	}
	function syncBow(w) {
		if (!isBow(w)) return;
		view.bow({ draw: w.draw, loaded: w.mag > 0, nock: w.reloading > 0 ? Math.max(0, Math.min(1, 1 - w.reloading / w.reloadDur)) : w.mag > 0 ? 1 : 0 });
	}
	// the rounds loaded came off the loose ones, opening boxes as needed
	function took(w, n) {
		const id = w.S.id, d = drawRounds(ammo.loose[id] || 0, boxes(id), n, w.S);
		for (let i = 0; i < d.open; i++) arms?.apply?.({ id: `ammo-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`, kind: 'use', itemId: w.S.box, quantity: 1, activity: 'hunting' });
		ammo.loose[id] = d.loose;
		saveAmmo();
	}

	// ---------- input ----------
	let mouseDown = false, touchFire = false;
	function cancelInput() {
		mouseDown = touchFire = false;
		if (Wp) { cancelTrigger(Wp); cancelReload(Wp); }
		view.cancel();
		if (Wp) syncBow(Wp);
		hud.btns.Fire?.classList.remove('on');
	}
	const canvas = mount.querySelector('canvas');
	const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || window._KEYS_PLAY_ON;
	addEventListener('pointerdown', (e) => { if (e.button === 0 && e.pointerType === 'mouse' && (!canvas || e.target === canvas) && active()) mouseDown = true; });
	addEventListener('pointerup', (e) => { if (e.button === 0) { if (!active() || me.ko) cancelInput(); else mouseDown = false; } });
	addEventListener('pointercancel', cancelInput);
	addEventListener('blur', cancelInput);
	document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInput(); });
	canvas?.addEventListener('pointerleave', () => { if (mouseDown) cancelInput(); });
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || typing() || !active()) return;
		const k = e.key.toLowerCase();
		if (k === 'r') { if (reload()) e.preventDefault(); }
		else if (k === 'z') { const w = weaponNow(); if (w && w.S.modes.length > 1) { hint(`Fire mode: ${nextMode(w)}`, 1200, 1); e.preventDefault(); } }
		else if (k === 'y') { if (throwFlare()) e.preventDefault(); }
	});
	const B = hud.btns;
	if (B.Fire) {
		B.Fire.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (!active() || me.ko) return; touchFire = true; B.Fire.classList.add('on'); });
		B.Fire.addEventListener('pointerup', () => { if (!active() || me.ko) cancelInput(); else { touchFire = false; B.Fire.classList.remove('on'); } });
		for (const ev of ['pointercancel', 'pointerleave']) B.Fire.addEventListener(ev, cancelInput);
		B.Reload.addEventListener('pointerdown', (e) => { e.stopPropagation(); reload(); });
		B.Mode.addEventListener('pointerdown', (e) => { e.stopPropagation(); const w = weaponNow(); if (w) nextMode(w); });
		for (const b of Object.values(B)) b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
	}
	function active() {
		const p = P();
		return !!p && !typing() && !document.hidden && !gear?.()?.busy?.() && !arms?.locked?.() && !busy() && !drive?.active?.() && !p.swimming && !W()?.orbit?.active?.() && mount.style.display !== 'none' && !(menu && menu.style.display && menu.style.display !== 'none');
	}

	// ---------- shots ----------
	// the first thing a ray meets: a target in the layer or a wall: { T?, t, n, surface, part, ward }
	function firstHit(o, d, max, shooterT = ME) {
		const a = layer.cast(o, d, max, shooterT, rules), b = worldHit(o, d, a ? a.t : max);
		if (b && (!a || b.t < a.t)) return { ...b, wall: true };
		return a;
	}
	// a shot or blow landing on what it met (shooter: ME, a squad member, a boss)
	function landShot(hit, from, dir, by, dmg, type = 'ballistic') {
		const p = new THREE.Vector3().copy(from).addScaledVector(dir, hit.t);
		if (hit.wall) {
			fx.impact(p, hit.n, hit.surface, type === 'energy');
			if (hit.box && (type === 'energy' || type === 'fire')) heatUp(boxId(hit.box), hit.box, dmg, by === ME);
			return null;
		}
		const T = hit.T;
		if (hit.ward) { spark(T, p, by); return { ward: true }; }
		const blow = { amount: dmg, type, part: hit.part, src: from.clone ? from.clone() : from, dir: { x: dir.x, y: dir.y, z: dir.z }, by: by === ME ? ME : by?.T || by };
		fx.impact(p, hit.n || { x: -dir.x, y: -dir.y, z: -dir.z }, T.surface || 'stone', type === 'energy');
		return deal(T, blow, by === ME);
	}
	// harm to a target, by its rules: shared things on a guest go to the host
	function deal(T, blow, mine) {
		if (warded(T)) return { ward: true, dealt: 0 };
		if (!canHit(T, blow.by || null, rules)) return { ignored: true, dealt: 0 };
		const before = T.moral?.();
		let r;
		if (T.shared && !host()) { net.hit(T.id, blow); r = { dealt: blow.amount, remote: true }; }
		else if (T.kind === 'remote') { net.hit('me', blow, T.peer); r = { dealt: blow.amount }; }
		else r = strike(T, blow, blow.by || null, rules);
		if (!r || r.ignored) return r;
		if (mine) yours(T, r, blow, before);
		else if (blow.by?.faction && T.faction && blow.by.faction !== T.faction && T.faction !== 'world') relations.attacked(blow.by.faction, T.faction, r.killed ? 0.4 : 0.05);
		return r;
	}
	// the Spark turning a shot aside
	function spark(T, at, by) {
		const B0 = T.bound;
		fx.ward({ x: B0.x, y: B0.y, z: B0.z }, (B0.r || 1) * 0.9, at);
		sound('chime', at);
		if (by === ME) {
			if (wardMarkT <= 0) { wardMarkT = 4; morality.record({ kind: 'ward', target: T.name || 'a young person', place: placeName(), world: worldKey, ctx: { witnessed: true } }); if (isEarth()) offend(wanted, 'hitCivilian'); }
			if (sparkLineT <= 0) { sparkLineT = 12; call(SPARK_LINES[Math.floor(Math.random() * SPARK_LINES.length)], 'bystander'); }
		}
		civilians.alarm(at.x, at.z, 20);
	}

	// your deed, weighed (the morality compass), and how the world takes it
	const hurtOnce = new Set();
	function yours(T, r, blow, ctx0) {
		if (r.dealt > 0) hud.hit(!!r.killed);
		const ctx = { ...(ctx0 || {}), witnessed: witnesses(T.bound) > 0 };
		ctx.unseen = !ctx.witnessed;
		const fac = T.faction, F = FACTIONS[fac];
		if (T.kind === 'boss') { if (r.killed) morality.record({ kind: 'boss-slain', target: T.name, world: worldKey, place: placeName() }); return; }
		if (T.kind === 'car') { const car = cars.state.get(T.id); if (car) car.lastMine = true; return; }
		if (T.kind === 'prop') { if (r.killed && isEarth()) offend(wanted, 'prop', ctx.witnessed); return; }
		if (fac && fac !== 'world' && FACTIONS[fac]) relations.attacked(PLAYER, fac, r.killed ? 1 : 0.25);
		const lawful = !!F?.lawful;
		if (lawful) ctx.lawTarget = true;
		if (F?.kind === 'civilians') ctx.unarmed = true;
		if (r.killed) {
			const kind = ctx.surrendered ? 'kill-surrendered' : 'kill';
			morality.record({ kind, target: T.name || 'someone', faction: fac, place: placeName(), world: worldKey, ctx });
			// fighting off raiders at a village, or beside a side whose enemy this was
			const S = T.ref?.squad;
			if (S?.raid && !ctx.surrendered) { morality.record({ kind: 'defend-village', place: placeName(), world: worldKey, ctx: {} }); relations.helped(PLAYER, 'village', 2); relations.helped('hearthguard', PLAYER, 3); }
			for (const f of Object.keys(FACTIONS)) if (f !== fac && relations.hostile(f, fac) && squads.alive().some((h) => h.fid === f && h.alert && Math.hypot(h.pos.x - eye().x, h.pos.z - eye().z) < 80)) { relations.helped(f, PLAYER, 1.5); if (Math.random() < 0.3) morality.record({ kind: 'help-faction', target: FACTIONS[f].name, world: worldKey, place: placeName() }); break; }
			if (F?.kind === 'civilians' && T.ref?.raid) morality.record({ kind: 'raid-village', place: placeName(), world: worldKey, ctx });
			if (isEarth()) offend(wanted, lawful ? 'downPolice' : F?.kind === 'civilians' ? 'downCivilian' : 'hitCivilian', ctx.witnessed || lawful);
			const H = held();
			if (H) arms?.train?.(H.u, 4);
		} else if (!ctx.hostileTarget && !hurtOnce.has(T.id)) {
			hurtOnce.add(T.id);
			morality.record({ kind: 'hurt', target: T.name || 'someone', faction: fac, place: placeName(), world: worldKey, ctx });
			if (isEarth()) offend(wanted, lawful ? 'hitPolice' : 'hitCivilian', ctx.witnessed || lawful);
		}
	}
	function witnesses(at) {
		if (!at) return 0;
		let n = 0;
		for (const p of people?.()?.pool || []) if (p.active && p.P.root.visible && !p.P.ragdoll && Math.hypot(p.M.S.pos.x - at.x, p.M.S.pos.z - at.z) < 40) n++;
		for (const h of squads.alive()) if (FACTIONS[h.fid]?.lawful && Math.hypot(h.pos.x - at.x, h.pos.z - at.z) < 60) n += 3;
		return n;
	}

	function fireShot(w, charge = 1) {
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
			const end = hit ? new THREE.Vector3().copy(o).addScaledVector(dir, hit.t) : new THREE.Vector3().copy(o).addScaledVector(dir, S.range);
			if (hit) landShot(hit, o, dir, ME, damageAt(S, hit.t), S.type);
			fx.tracer(from, end, S.tracer);
			net.fx(from, end, S.tracer, hit ? 1 : 0);
		}
		const at = eye();
		civilians.alarm(at.x, at.z, 30);
		squads.hear(at.x, at.z, 70);
		if (isEarth()) offend(wanted, 'shots', witnesses(at) > 0);
	}

	// ---------- projectiles: arrows, energy bolts, spit, missiles, flares ----------
	function projectile(o) {
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
	function endProjectile(p, at) {
		const i = projectiles.indexOf(p);
		if (i >= 0) projectiles.splice(i, 1);
		if (p.arrowMesh) p.arrowMesh.visible = false;
		if (p.streak != null) fx.free(p.streak);
		if (p.T) layer.remove(p.T.id);
		if (at && p.splash > 0) blast(at, p.splash, p.dmg * 0.6, p.owner, null, p.type);
	}
	function stepProjectiles(dt) {
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
				else landShot(hit, p.pos, dir, p.owner, p.dmg, p.type);
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
	// a gunship's missile: slow, homing, and it can be shot down
	function missile(B0, from) {
		const p = projectile({ from, to: eye().clone(), speed: 24, drop: 0, dmg: 18, type: 'blast', owner: B0.T, style: 4, splash: 3, hostile: true, missile: true, life: 7 });
		p.T = { id: 'ms' + Math.random().toString(36).slice(2, 8), kind: 'missile', faction: 'boss', surface: 'metal', bound: { x: from.x, y: from.y, z: from.z, r: 1 }, shapes: () => [{ type: 'sphere', c: p.pos, r: 0.7, part: 'body' }], onHit: () => { fx.explosion(p.pos.clone(), 2); endProjectile(p, null); return { dealt: 1, killed: true }; } };
		layer.add(p.T);
	}

	// ---------- blasts ----------
	function blast(at, r, dmg, by, source = null, type = 'blast') {
		const c = at.clone ? at : new THREE.Vector3(at.x, at.y, at.z);
		const wards = [];
		const mine = by === ME;
		for (const x of layer.within(c, r, mine ? ME : by, rules, wards)) {
			if (x.T === source) continue;
			const k = 1 - x.d / r;
			const blow = { amount: dmg * (0.3 + 0.7 * k), type, part: 'body', src: c, dir: { x: x.T.bound.x - c.x, y: 0.3, z: x.T.bound.z - c.z }, by: mine ? ME : by };
			const before = x.T.moral?.();
			const res = deal(x.T, blow, mine);
			if (mine && res?.dealt && x.T.faction === 'civ' && squads.alive().some((h) => h.alert)) morality.record({ kind: 'collateral', place: placeName(), world: worldKey, ctx: before || {} });
		}
		for (const T of wards) spark(T, { x: T.bound.x, y: T.bound.y, z: T.bound.z }, mine ? ME : null);
		const e = eye(), d = Math.hypot(e.x - c.x, e.y - EYE * 0.5 - c.y, e.z - c.z);
		if (d < r && !me.ko) hurtPlayer({ amount: dmg * (1 - d / r) * (mine ? 0.5 : 1), type, part: 'torso', src: c, by });
		if (d < r * 4) shakeIt(0.5 * (1 - d / (r * 4)));
		civilians.alarm(c.x, c.z, 35); squads.hear(c.x, c.z, 90);
		sound('boom', c);
		// a big one sets cars and buildings near it alight
		if (dmg >= 60) { for (const n of neighbours(c.x, c.z, r)) if (Math.random() < 0.5) ignite(n.id, n.x, n.z, n.fuel, mine); }
	}

	// ---------- you, hurt ----------
	function hurtPlayer(blow) {
		if (me.ko || !P()) return;
		if (blow.by?.kind === 'remote' && !rules.pvp) return;
		const r = applyDamage(me.H, blow);
		if (!r.dealt && !r.absorbed) return;
		const s = blow.src;
		if (s && !blow.quiet) {
			const e = eye(), yaw = P().yaw, a = Math.atan2(s.x - e.x, s.z - e.z);
			hud.hurt(-(a - yaw) + Math.PI, Math.min(1, r.dealt / 25));
		}
		if (!blow.quiet) shakeIt(Math.min(0.4, r.dealt / 50));
		if (r.downed) knockout(blow);
	}
	function knockout() {
		cancelInput();
		me.ko = 6;
		const p = P();
		if (p) p.locked = true;
		clearWanted(wanted);
		// the fight forgets you while you are down
		for (const h of squads.alive()) { if (h.target?.id === 'me') h.target = null; h.provoked = false; }
		hint('You were knocked out. You come to somewhere safer.', 5000, 2);
	}
	function wake() {
		const p = P();
		me.ko = 0;
		revive(me.H, 0.7);
		if (!p) return;
		// back along your own way, out of the fight
		const e = p.pos, threat = squads.alive().find((h) => h.alert && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 80);
		let spot = null;
		for (let i = me.crumbs.length - 1; i >= 0; i--) { const c = me.crumbs[i]; if (Math.hypot(c.x - e.x, c.z - e.z) > 45 && (!threat || Math.hypot(c.x - threat.pos.x, c.z - threat.pos.z) > 60)) { spot = c; break; } }
		if (spot) { p.pos.set(spot.x, spot.y, spot.z); p.vel?.set?.(0, 0, 0); }
		p.locked = false;
	}

	// ---------- fire ----------
	const heatMap = new Map();
	function heatUp(id, box, amount, mine) {
		const h = (heatMap.get(id) || 0) + amount;
		heatMap.set(id, h);
		if (h > 160) { heatMap.delete(id); ignite(id, box.x, box.z, 1, mine, box); }
	}
	function neighbours(x, z, r) {
		const out = [...cars.flammable(x, z, r), ...props.flammable(x, z, r)];
		for (const b of boxesNear(x, z, r + 10)) if (b.w > 3 && b.d > 3) out.push({ id: boxId(b), x: b.x, z: b.z, fuel: 1, box: b });
		return out;
	}
	function ignite(id, x, z, fuel = 1, mine = false, box = null) {
		if (!fireField.ignite(id, x, z, { fuel })) return false;
		const kind = id.startsWith('car:') ? 'car' : id.startsWith('b:') ? 'building' : id.startsWith('pr') ? 'prop' : 'ground';
		const b = box || (kind === 'building' ? boxesNear(x, z, 12).find((q) => boxId(q) === id) : null);
		const occupied = kind === 'building' && (witnesses({ x, z }) > 1 || ((b?.x * 7 + b?.z * 13) % 10 + 10) % 10 < 5);
		fireMeta.set(id, { kind, x, z, b, occupied, t: 0, crew: false, mine, emit: 0 });
		if (kind === 'car') cars.burn(id);
		if (mine && kind !== 'ground') {
			morality.record({ kind: 'arson', target: kind === 'building' ? (occupied ? 'an occupied building' : 'an empty building') : kind === 'car' ? 'a car' : 'some stores', place: placeName(), world: worldKey, ctx: { occupied, empty: !occupied, witnessed: witnesses({ x, z }) > 0 } });
			if (isEarth()) offend(wanted, 'car', true);
		}
		civilians.alarm(x, z, 30);
		return true;
	}
	function stepFire(dt) {
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
			// a crew comes on Earth
			if (isEarth() && !M.crew && M.t > 10 && (M.kind === 'building' || M.kind === 'car')) { M.crew = true; const a = Math.random() * 6.283; squads.squad('fire', F.x + Math.cos(a) * 40, F.z + Math.sin(a) * 40, 2, { task: F.id }); call('Fire crew on the way!', 'bystander'); }
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
	function ignite2(id, F, mine) {
		const kind = id.startsWith('car:') ? 'car' : id.startsWith('b:') ? 'building' : id.startsWith('pr') ? 'prop' : 'ground';
		const b = kind === 'building' ? boxesNear(F.x, F.z, 12).find((q) => boxId(q) === id) : null;
		fireMeta.set(id, { kind, x: F.x, z: F.z, b, occupied: false, t: 0, crew: false, mine, emit: 0 });
		if (kind === 'car') cars.burn(id);
		if (mine && kind === 'building') morality.record({ kind: 'collateral', target: 'a building', place: placeName(), world: worldKey, ctx: {} });
	}
	function scorch(b) {
		const g = ground(b.x, b.z), c = Math.cos(b.a || 0), s = Math.sin(b.a || 0), H = b.wallH || 6;
		for (let i = 0; i < 8; i++) {
			const side = i % 4, u = Math.random() - 0.5;
			const lx = side < 2 ? u * b.w * 0.8 : (side === 2 ? 1 : -1) * (b.w / 2 + 0.02), lz = side < 2 ? (side ? 1 : -1) * (b.d / 2 + 0.02) : u * b.d * 0.8;
			const nlx = side < 2 ? 0 : side === 2 ? 1 : -1, nlz = side < 2 ? (side ? 1 : -1) : 0;
			fx.decal({ x: b.x + lx * c + lz * s, y: g + H * (0.3 + Math.random() * 0.5), z: b.z - lx * s + lz * c }, { x: nlx * c + nlz * s, y: 0, z: -nlx * s + nlz * c }, 2.5 + Math.random() * 2, 1);
		}
	}
	// a signal flare thrown (Y): it lights what it lands on
	function throwFlare() {
		if (!arms?.state?.()?.items?.['station-signal-flare']) { hint('You need a Station Signal Flare (shops sell them) to set a fire.', 2500, 1); return false; }
		const r = arms.apply({ id: `flare-${Date.now().toString(36)}`, kind: 'use', itemId: 'station-signal-flare', quantity: 1, activity: 'hunting' });
		if (!r?.ok) return false;
		camera.getWorldDirection(_v);
		const from = camera.position.clone().addScaledVector(_v, 0.5);
		projectile({ from, to: from.clone().addScaledVector(_v, 18).add(new THREE.Vector3(0, 2, 0)), speed: 16, drop: 9.8, dmg: 5, type: 'fire', owner: ME, style: 4, flare: true, life: 5 });
		return true;
	}
	function flareLands(at, hit) {
		fx.sparks(at, 20, null, 1, 0.5, 0.2, 5);
		if (hit.box) return ignite(boxId(hit.box), hit.box.x, hit.box.z, 1, true, hit.box);
		if (hit.T?.kind === 'car') return ignite(hit.T.id, at.x, at.z, 0.9, true);
		if (hit.T?.kind === 'prop') return ignite(hit.T.id, at.x, at.z, 0.6, true);
		const n = neighbours(at.x, at.z, 3)[0];
		if (n) return ignite(n.id, n.x, n.z, n.fuel, true, n.box);
		return ignite(`g:${Math.round(at.x)},${Math.round(at.z)}`, at.x, at.z, 0.25, true);
	}

	// ---------- the townsfolk, the squads, cars, props ----------
	const recovery = createLootView({ group, mount, arms, camera, eye, blocked, ground, active: () => active() && !me.ko && !P()?.flying && !P()?.locked, hint, sound, touch });
	const ctx = {
		layer, fx, isPhone, relations, ragdolls, people, world: W, ground, eye, blocked, call, hud,
		me: () => ({ speed: me.speed, grounded: !!P()?.grounded || !!W()?.deep?.active?.(), vel: me.vel }),
		projectile, firstHit, landShot, hurtPlayer, blast, missile, ignite: (id, x, z, f, mine) => ignite(id, x, z, f, !!mine), shake: (k) => shakeIt(k),
		strikeNpc: (T, blow, at) => { if (at) fx.impact(at, null, T.surface, blow.type === 'energy'); return deal(T, blow, false); },
		whiz: () => sound('whiz'), heard: (from) => civilians.alarm(from.x, from.z, 25), sound: (k, p) => sound(k, p),
		wanted: () => wanted.stars, bounty: () => morality.reactions().bounty, playerDown: () => me.ko > 0,
		civilians: () => [...layer.map.values()].filter((T) => T.kind === 'person' && !T.child),
		coverNear: (x, z, r) => props.coverNear(x, z, r) || buildingCover(x, z, r),
		coverK: () => (P()?.crouch ? 0.7 : 1),
		fireAt: (id) => fireField.fires.get(id) || null, douse: (id, dt) => fireField.douse(id, dt * 3),
		heat: (id, x, z, fuel, amount) => { if (fuel) { const h = (heatMap.get(id) || 0) + amount; heatMap.set(id, h); if (h > 60) ignite(id, x, z, fuel, true); } },
		friendsNear: () => (multiplayer?.bodies?.() || []).filter((r) => Math.hypot(r.at[0] - eye().x, r.at[2] - eye().z) < 40).length,
		spawnSquad: (fid, x, z, n, o) => squads.squad(fid, x, z, n, o),
		onSurrender: (h) => { if (Math.hypot(h.pos.x - eye().x, h.pos.z - eye().z) < 60) hint(`${h.F.name}: one of them throws down their weapon and surrenders. They are out of the fight.`, 4000, 1); },
		onDeath: (h) => recovery.add(h),
		onSpared: (h, d) => { if (d < 50) morality.record({ kind: 'spare', target: h.T.name, faction: h.fid, place: placeName(), world: worldKey }); },
		onPhase: (B0) => net.boss(B0, true),
		onBossDown: (B0) => bossDown(B0),
		onDestroyed: (S) => { if (S.lastMine) { morality.record({ kind: 'arson', target: 'a car', place: placeName(), world: worldKey, ctx: { occupied: !!S.fled } }); if (isEarth()) offend(wanted, 'car', true); } },
	};
	function buildingCover(x, z, r) { const b = boxesNear(x, z, r).find((q) => q.w > 2); return b ? { x: b.x, z: b.z, r: Math.max(b.w, b.d) / 2 } : null; }
	const civilians = createCivilians(ctx);
	const squads = createSquads(ctx);
	const props = createProps(ctx);
	const cars = createCars(ctx);
	group.add(squads.group, props.group, cars.group);
	// a car you shot: yours when it goes up
	const carHit = cars.state;
	ctx.markCar = (id) => { const S = carHit.get(id); if (S) S.lastMine = true; };

	// ---------- bosses ----------
	function spawnBoss(kind, at = null, id = null) {
		if (!BOSSES[kind]) return null;
		const e = eye();
		const c = at || (() => { camera.getWorldDirection(_v); _v.y = 0; _v.normalize(); const d = kind === 'walker' ? 70 : kind === 'leviathan' ? 14 : 30; const x = e.x + _v.x * d, z = e.z + _v.z * d; return { x, y: ground(x, z, e.y), z }; })();
		const bid = id || 'boss:' + kind;
		if (bosses.has(bid)) return bosses.get(bid);
		const B0 = createBoss(ctx, kind, c, { id: bid });
		group.add(B0.group);
		bosses.set(bid, B0);
		if (kind === 'walker' || kind === 'gunship') props.camp(e.x, e.z, 'arena', (x, z) => ground(x, z, e.y));
		hud.phase(B0.def.phases[0].name);
		call(`${B0.def.name} — ${B0.def.where}`, 'boss');
		net.boss(B0, true, c);
		return B0;
	}
	function bossDown(B0) {
		const D = B0.def, R = D.reward;
		call(`${D.name} is down.`, 'boss');
		const inst = { u: `bs${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20), i: R.item, l: R.level, t: 4, x: 0 };
		const res = arms?.apply?.({ id: `boss-${B0.kind}-${Date.now().toString(36)}`, kind: 'trade', peer: B0.kind, give: { credits: 0, items: [] }, get: { credits: R.credits, items: [inst] } });
		const name = WEAPONS[R.item]?.name || R.item;
		hint(res?.ok ? `${D.name} defeated. Reward: Legendary ${name} (level ${R.level}) and ${R.credits.toLocaleString()} credits.` : `${D.name} defeated.`, 7000, 2);
		journal.push({ t: Date.now(), boss: B0.kind, name: D.name, where: placeName(), line: `Brought down ${D.name} in ${D.where}.` });
		store.set('l99-combat-journal', JSON.stringify(journal.slice(-50)));
		morality.record({ kind: 'boss-slain', target: D.name, place: placeName(), world: worldKey });
		seen[B0.kind] = Date.now();
		net.boss(B0, true);
	}
	const seen = {};
	function bossDirector() {
		if (!host() || bosses.size) return;
		const w = W(), type = shared.planet?.type, p = P();
		if (!p || p.flying || drive?.active?.()) return;
		const recent = (k) => seen[k] && Date.now() - seen[k] < 20 * 60 * 1000;
		if (w?.deep?.active?.() && /crystal/i.test(w.deep.info?.().band || '') && !recent('leviathan')) { seen.leviathan = Date.now(); hint('The crystal sings. Something vast is moving through the rock.', 4000, 2); spawnBoss('leviathan'); return; }
		if (!isEarth() && (type === 'MAGMA' || type === 'TOXIC') && worldT > 70 && !recent('walker') && !w?.deep?.active?.()) { seen.walker = Date.now(); hint('The ground shudders. Something huge is walking the ash plains.', 4000, 2); spawnBoss('walker'); return; }
		if (!isEarth() && (type === 'GAS' || (w?.arch && worldT > 60)) && worldT > 80 && !recent('gunship') && !w?.deep?.active?.()) { seen.gunship = Date.now(); hint('Engines in the clouds. A gunship is circling the cliffs.', 4000, 2); spawnBoss('gunship'); }
	}

	// ---------- the world's own fights ----------
	function zone() {
		const w = W(), e = eye();
		if (w?.deep?.active?.()) return 'deep';
		if (isEarth()) {
			if (boxesNear(e.x, e.z, 70).length > 6) return 'earth-urban';
			return w.island.heightAt(e.x, e.z) < 6 ? 'earth-coast' : 'earth-rural';
		}
		const vf = w?.village?.footprints?.find((f) => !f.fence);
		if (vf && Math.hypot(vf.x - e.x, vf.z - e.z) < 160 && !shared.planet?.noVillage) return 'village';
		return shared.planet?.type === 'ARID' ? 'arid' : 'wild';
	}
	function spotAhead(dmin, dmax) {
		const e = eye();
		for (let k = 0; k < 8; k++) {
			const a = P().yaw + Math.PI + rnd(-1.2, 1.2), d = rnd(dmin, dmax);
			const x = e.x - Math.sin(a + Math.PI) * d, z = e.z - Math.cos(a + Math.PI) * d;
			const g = ground(x, z, e.y);
			if (!W()?.deep?.active?.() && g < 0.6) continue;
			if (Math.abs(g - (e.y - EYE)) > 25) continue;
			return { x, z, y: g };
		}
		return null;
	}
	function director(dt) {
		directorT -= dt; bountyT -= dt; policeT -= dt;
		const p = P();
		if (!p || p.flying || p.swimming || drive?.active?.() || me.ko) return;
		// the patrol answering a wanted level
		if (isEarth() && wanted.stars > 0 && policeT <= 0) {
			policeT = 8;
			const R = responseFor(wanted.stars), have = squads.alive().filter((h) => h.fid === 'patrol').length;
			if (have < R.officers) { const s = spotAhead(40, 60); if (s) squads.squad('patrol', s.x, s.z, Math.min(2, R.officers - have), { alert: true, armour: R.armour }); call('Dispatch: units responding.', 'Bay Patrol'); }
		}
		// contract hunters, for a bounty
		if (bountyT <= 0) { bountyT = rnd(240, 400); const b = morality.reactions().bounty; if (b > 0 && settings.ambient) { const s = spotAhead(50, 80); if (s) { squads.squad('halcyon', s.x, s.z, 1 + b, { alert: true }); call('Halcyon Contractors: Target located. Collecting the bounty.', ''); } } }
		if (!settings.ambient || directorT > 0) return;
		directorT = rnd(70, 130);
		if (squads.info().squads.length >= (isPhone ? 2 : 3)) return;
		const z = zone(), s = spotAhead(z === 'deep' ? 18 : 70, z === 'deep' ? 30 : 110);
		if (!s) return;
		const two = (a, b, n = 3) => { squads.squad(a, s.x - 9, s.z, n, {}); squads.squad(b, s.x + 9, s.z + 4, n, {}).then((sq) => { for (const h of sq.members) { h.target = null; } }); call(`Gunfire ahead: ${FACTIONS[a].name} and ${FACTIONS[b].name}.`, ''); };
		const roll = Math.random();
		if (z === 'deep') squads.squad('gloom', s.x, s.z, 3, {});
		else if (z === 'earth-urban') roll < 0.5 ? two('copperline', 'glasshouse') : squads.squad(roll < 0.75 ? 'copperline' : 'glasshouse', s.x, s.z, 3, {});
		else if (z === 'earth-coast') roll < 0.5 ? two('saltjack', 'patrol', 2) : squads.squad('saltjack', s.x, s.z, 3, {});
		else if (z === 'earth-rural') squads.squad(roll < 0.5 ? 'ridgeback' : 'rangers', s.x, s.z, 3, {});
		else if (z === 'village') {
			// a raid: raiders come for the houses, the Hearthguard turn out
			const vf = W().village.footprints.find((f) => !f.fence);
			const raiders = shared.planet?.type === 'ARID' && roll < 0.5 ? 'dunecutters' : 'ashfang';
			squads.squad(raiders, s.x, s.z, isPhone ? 3 : 4, { raid: true, dest: { x: vf.x, z: vf.z } });
			squads.squad('hearthguard', vf.x, vf.z, isPhone ? 2 : 3, {});
			call(`${FACTIONS[raiders].name} are raiding the village!`, '');
		} else if (z === 'arid') roll < 0.5 ? two('ashfang', 'dunecutters') : roll < 0.8 ? camp('ashfang', s) : squads.squad('rogue', s.x, s.z, 2, {});
		else roll < 0.45 ? camp('ashfang', s) : roll < 0.7 ? squads.squad('rogue', s.x, s.z, 2, {}) : two('ridgeback', 'ashfang');
	}
	function camp(fid, s) { props.clearTag('camp'); props.camp(s.x, s.z, 'camp', (x, z) => ground(x, z, s.y + 2)); squads.squad(fid, s.x, s.z, isPhone ? 3 : 4, {}); }

	// ---------- hold-ups ----------
	let aimT = 0, aimAt = null;
	function holdUps(dt) {
		if (!active() || me.ko || !view.state()?.aiming || !held()) { aimT = 0; aimAt = null; return; }
		camera.getWorldDirection(_v);
		const hit = layer.cast(camera.position, _v, 10, ME, rules);
		const T = hit && !hit.ward && hit.T.kind === 'person' ? hit.T : null;
		if (T !== aimAt) { aimAt = T; aimT = 0; }
		if (!T) return;
		aimT += dt;
		if (aimT < 1) return;
		aimT = -999;
		const p = (people?.()?.pool || []).find((q) => q.P === T.P);
		const r = p && civilians.holdUp(p);
		if (!r) return;
		if (r.first && r.credits) {
			arms?.apply?.({ id: `rob-${Date.now().toString(36)}`, kind: 'trade', peer: 'held-up', give: { credits: 0, items: [] }, get: { credits: r.credits, items: [] } });
			hint(`They raise their hands and hand over ${r.credits} credits.`, 2500, 1);
			morality.record({ kind: 'robbery', target: T.name, place: placeName(), world: worldKey, ctx: { rich: r.rich, poor: !r.rich, witnessed: witnesses(T.bound) > 1, ...T.moral?.() } });
			if (isEarth()) offend(wanted, 'hitCivilian', witnesses(T.bound) > 1);
		}
	}

	// ---------- friends in a room ----------
	const remotes = new Map();
	const net = {
		out: [], outT: 0, hits: new Map(), csT: 0,
		fx(a, b, style, impact) { if (!multiplayer?.live?.()) return; this.out.push([a.x, a.y, a.z, b.x, b.y, b.z, style | 0, impact ? 1 : 0]); },
		hit(id, blow, to = null) {
			if (!multiplayer?.live?.()) return;
			const k = (to || '') + '|' + id + '|' + blow.part;
			const h = this.hits.get(k) || { id, to, p: blow.part, d: 0, k: blow.type, w: held()?.i };
			h.d += blow.amount; this.hits.set(k, h);
		},
		boss(B0, now = false, at = null) { if (!multiplayer?.live?.() || !host()) return; if (now) this.csT = 0; if (at) this.bossAt = { id: B0.id, kind: B0.kind, x: at.x, y: at.y, z: at.z, w: worldKey }; },
		update(dt) {
			if (!multiplayer?.live?.()) { this.out.length = 0; this.hits.clear(); return; }
			this.outT -= dt; this.csT -= dt;
			if (this.outT <= 0 && (this.out.length || this.hits.size)) {
				this.outT = 0.15;
				if (this.out.length) multiplayer.send({ t: 'fx', s: this.out.splice(0, 8) });
				let n = 0;
				for (const [k, h] of this.hits) { if (n++ >= 3) break; this.hits.delete(k); multiplayer.send({ t: 'hit', id: h.id, d: Math.min(500, Math.round(h.d * 100) / 100), p: h.p, k: h.k, w: h.w, ...(h.to ? { to: h.to } : {}) }); }
			}
			// the host's word on bosses, four times a second
			if (host() && this.csT <= 0 && bosses.size) {
				this.csT = 0.25;
				const e = [...bosses.values()].map((B0) => [B0.id, Math.round(B0.mc.M.hp), B0.mc.M.phase, B0.dead ? 1 : 0]);
				const B0 = [...bosses.values()][0];
				multiplayer.send({ t: 'cs', e, b: { id: B0.id, kind: B0.kind, x: B0.center.x, y: B0.center.y, z: B0.center.z, w: worldKey } });
			}
		},
	};
	function heard(t, v) {
		if (t === 'closed' || (t === 'status' && v.status !== 'on')) { rules.pvp = false; net.out.length = 0; net.hits.clear(); return; }
		if (t === 'welcome') { Object.assign(rules, v.rules || { pvp: false }); return; }
		if (t === 'rules') { Object.assign(rules, v); hint(`PvP is ${rules.pvp ? 'on' : 'off'} in this room.`, 2500, 1); return; }
		if (t === 'fx') { for (const q of v.s) { const a = { x: q[0], y: q[1], z: q[2] }, b = { x: q[3], y: q[4], z: q[5] }; fx.tracer(a, b, q[6]); fx.muzzle(a, _v.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize(), q[6]); if (q[7]) fx.impact(b, null, 'stone'); } return; }
		if (t === 'hit') {
			// on you (PvP), or a guest's hit on something shared, for the host to decide
			if (v.id === 'me') { if (rules.pvp) { const r = remotes.get(v.from); hurtPlayer({ amount: v.d, type: v.k || 'ballistic', part: v.p, src: r ? { x: r.at[0], y: r.at[1], z: r.at[2] } : null, by: { id: 'rp:' + v.from, kind: 'remote' } }); } return; }
			if (!host()) return;
			const T = layer.get(v.id);
			if (T) strike(T, { amount: v.d, type: v.k || 'ballistic', part: v.p, by: { id: 'rp:' + v.from, kind: 'remote', faction: PLAYER } }, { id: 'rp:' + v.from, kind: 'remote', faction: PLAYER }, rules);
			return;
		}
		if (t === 'cs') {
			if (host()) return;
			if (v.b && !bosses.has(v.b.id) && (!v.b.w || v.b.w === worldKey)) spawnBoss(v.b.kind, v.b, v.b.id);
			for (const [id, hp, phase, dead] of v.e) bosses.get(id)?.sync(hp, phase, dead);
		}
	}
	multiplayer?.linkCombat?.({ heard, rules: () => ({ ...rules }), setRules: (r) => { if (!multiplayer.isHost()) return; Object.assign(rules, { pvp: !!r.pvp }); multiplayer.send({ t: 'rules', r: { pvp: !!r.pvp } }); } });
	// friends' bodies in the layer while PvP is on
	function stepRemotes() {
		const list = rules.pvp ? multiplayer?.bodies?.() || [] : [];
		const ids = new Set(list.map((r) => 'rp:' + r.id));
		for (const id of remotes.keys()) if (!ids.has('rp:' + id)) { layer.remove('rp:' + id); remotes.delete(id); }
		for (const r of list) {
			remotes.set(r.id, r);
			let T = layer.get('rp:' + r.id);
			if (!T) T = layer.add({ id: 'rp:' + r.id, peer: r.id, kind: 'remote', faction: 'friend:' + r.id, surface: 'person', name: r.name, bound: { x: 0, y: 0, z: 0, r: 1.2 }, shapes: () => personShapes(T.bound.x, T.bound.y - 0.9, T.bound.z, 1.75), onHit: () => ({ dealt: 0 }) });
			T.bound.x = r.at[0]; T.bound.y = r.at[1] - EYE + 0.9; T.bound.z = r.at[2];
		}
	}

	// ---------- sound: a few small synthesised cues ----------
	const sounding = new Set();
	function sound(kind, at = null) {
		try {
			if (at && Math.hypot(at.x - eye().x, at.z - eye().z) > 120) return;
			const bus = soundBus(); if (!bus) return;
			const AC = bus.ctx;
			const t = AC.currentTime, g = AC.createGain(), o = AC.createOscillator();
			g.connect(bus.out);
			sounding.add(o);
			o.onended = () => { sounding.delete(o); o.disconnect(); g.disconnect(); };
			const far = at ? Math.max(0.15, 1 - Math.hypot(at.x - eye().x, at.z - eye().z) / 120) : 1;
			if (kind === 'chime') { o.type = 'sine'; o.frequency.setValueAtTime(1318, t); o.frequency.setValueAtTime(1760, t + 0.09); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * far, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); }
			else if (kind === 'boom') { o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6); g.gain.setValueAtTime(0.5 * far, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); }
			else if (kind === 'glass') { o.type = 'triangle'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.25); g.gain.setValueAtTime(0.12 * far, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); }
			else { o.type = 'square'; o.frequency.setValueAtTime(kind === 'whiz' ? 1800 : 220, t); o.frequency.exponentialRampToValueAtTime(kind === 'whiz' ? 600 : 60, t + 0.12); g.gain.setValueAtTime(0.05 * far, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); }
			o.connect(g); o.start(t); o.stop(t + 1);
		} catch { /* no audio */ }
	}

	function shakeIt(k) { shake = Math.min(1, shake + k); }

	// ---------- each frame ----------
	let lastWorld = null, saveT = 0;
	function reset() {
		saveAmmo();
		cancelInput();
		view.aim(false);
		for (const p of [...projectiles]) endProjectile(p, null);
		for (const m of arrowPool) m.removeFromParent();
		arrowPool.length = 0; arrowTemplate?.geometry.dispose(); arrowTemplate = null;
		squads.clear(); recovery.clear(); props.clearTag(); cars.clear(); civilians.clear(); fireField.clear(); fireMeta.clear(); heatMap.clear(); fx.clear();
		for (const B0 of bosses.values()) B0.dispose();
		bosses.clear(); projectiles.length = 0; me.crumbs.length = 0; me.lastPos = null;
		net.out.length = 0; net.hits.clear(); remotes.clear(); hurtOnce.clear(); layer.clear();
		for (const node of sounding) { try { node.stop(); } catch { /* already ended */ } }
		sounding.clear();
		if (me.ko) { if (P()) P().locked = false; me.ko = 0; revive(me.H, 0.7); }
		group.removeFromParent(); lastWorld = null;
		hud.update(0, { show: false, stars: 0 });
	}
	function update(dt) {
		const w = W(), p = P();
		if (!w || !p) { if (lastWorld) reset(); return; }
		// a new world: start clean
		if (w !== lastWorld) {
			reset(); lastWorld = w; worldT = 0; directorT = 30;
			worldKey = multiplayer?.worldKey?.() || `${shared.planet?.type || 'EARTH'}:${w.body?.key || w.seed || ''}`;
			if (!isEarth()) clearWanted(wanted);
		}
		if (group.parent !== scene) scene.add(group);
		worldT += dt; wardMarkT -= dt; sparkLineT -= dt;
		fx.resize(innerHeight, camera.fov / (camera.zoom || 1));
		// you: speed, and a trail of safe spots to wake at
		const pos = p.pos;
		if (me.lastPos) { me.vel.subVectors(pos, me.lastPos).divideScalar(Math.max(dt, 1e-3)); me.speed = Math.hypot(me.vel.x, me.vel.z); } else me.lastPos = new THREE.Vector3();
		me.lastPos.copy(pos);
		const lc = me.crumbs[me.crumbs.length - 1];
		if (!me.ko && !p.flying && (!lc || Math.hypot(lc.x - pos.x, lc.z - pos.z) > 4)) { me.crumbs.push({ x: pos.x, y: pos.y, z: pos.z }); if (me.crumbs.length > 150) me.crumbs.shift(); }
		me.firing = Math.max(0, me.firing - dt);
		if (me.ko > 0) { me.ko -= dt; if (me.ko <= 0) wake(); } else tickHealth(me.H, dt);
		// your weapon
		const wpn = active() && !me.ko ? weaponNow() : null;
		if (wpn) {
			trigger(wpn, mouseDown || touchFire);
			syncBow(wpn);
			const ads = view.state()?.aiming ? 1 : 0;
			const before = wpn.mag;
			const r = stepWeapon(wpn, dt, { reserve: reserve(wpn), ads, accept: () => view.fire() !== false });
			if (r.loaded) took(wpn, r.loaded);
			for (let i = 0; i < r.fired; i++) {
				fireShot(wpn, r.charge);
				// the aim climbs with each shot and settles back (the view kicks the weapon itself)
				p.pitch = Math.min(1.35, p.pitch + r.kick[0] / Math.max(1, r.fired)); p.yaw += r.kick[1] / Math.max(1, r.fired);
			}
			if (r.empty && before === 0 && (mouseDown || touchFire)) { if (reserve(wpn) > 0) reload(); mouseDown = touchFire = false; }
			if (isBow(wpn) && r.fired && reserve(wpn) > 0) reload();
			syncBow(wpn);
			if (r.fired || r.loaded) saveAmmo();
		} else { cancelInput(); }
		if (shake > 0) { shake = Math.max(0, shake - dt * 2); camera.rotation.x += (Math.random() - 0.5) * shake * 0.02; camera.rotation.y += (Math.random() - 0.5) * shake * 0.02; }
		holdUps(dt);
		const cam = camera.position;
		civilians.update(dt, cam);
		squads.update(dt);
		recovery.update(dt);
		cars.update(dt, pos);
		stepProjectiles(dt);
		stepFire(dt);
		for (const [id, B0] of bosses) if (!B0.update(dt)) { B0.dispose(); bosses.delete(id); }
		bossDirector();
		director(dt);
		stepRemotes();
		net.update(dt);
		relations.drift(dt);
		if (isEarth()) tickWanted(wanted, dt, squads.alive().some((h) => h.fid === 'patrol' && h.los && h.target?.id === 'me'));
		fx.update(dt);
		saveT -= dt;
		if (saveT <= 0) { saveT = 10; store.set('l99-factions', JSON.stringify(relations.save())); }
		// the HUD
		const boss = [...bosses.values()].find((b) => !b.dead || b.deadT < 3);
		const fovPx = innerHeight / 2 / Math.tan((camera.fov * Math.PI) / 360) * (camera.zoom || 1);
		hud.update(dt, {
			show: true, ko: me.ko > 0, koText: me.ko > 0 ? `Coming to in ${Math.ceil(me.ko)}…` : '',
			aiming: !!view.state()?.aiming,
			spread: wpn ? Math.tan(spreadNow(wpn, view.state()?.aiming ? 1 : 0, Math.min(1, me.speed / 5))) * fovPx : 6,
			health: me.H,
			weapon: wpn && { name: wpn.S.name, mag: wpn.mag, max: wpn.S.mag, reserve: reserve(wpn), mode: modeOf(wpn), modes: wpn.S.modes.length, reloading: wpn.reloading > 0, bow: isBow(wpn), draw: wpn.draw, drawing: wpn.drawing },
			boss: boss && { name: boss.def.name, phase: boss.mc.M.phaseName, frac: boss.mc.frac(), notches: boss.def.phases.slice(1).map((q) => q.at) },
			stars: isEarth() ? wanted.stars : 0,
		});
	}

	const compass = createCompass({ mount, menu, morality, relations, worldKey: () => worldKey, settings });
	morality.on((e) => { if (e.place && (e.delta.protect + e.delta.mercy) < -15) { const m = morality.remembers(e.place); if (m) hint(m, 4000, 1); } });

	// ---------- for the console and the tests ----------
	const api = {
		update, reset, heard, group, layer, fx, morality, relations, compass, recovery,
		// a young person a car would have struck: the Spark's shimmer
		ward: (p) => { const q = p.M.S.pos; fx.ward({ x: q.x, y: q.y + 0.7, z: q.z }, 1, { x: q.x, y: q.y + 0.9, z: q.z }); sound('chime', q); },
		info: () => ({ me: { hp: Math.round(me.H.hp), max: me.H.max, state: me.H.state, ko: +me.ko.toFixed(1) }, weapon: Wp && { id: Wp.S.id, mag: Wp.mag, reserve: reserve(Wp), mode: modeOf(Wp), reloading: Wp.reloading > 0, dmg: Wp.S.dmg, draw: Wp.draw, drawing: Wp.drawing, shots: Wp.shots, cooldown: Wp.cool }, layer: layer.size, wanted: { stars: wanted.stars, points: Math.round(wanted.points) }, zone: W() ? zone() : null, squads: squads.info(), civilians: civilians.info(), props: props.info(), cars: cars.info(), fires: [...fireField.fires.values()].map((F) => ({ id: F.id, heat: +F.heat.toFixed(2), chain: F.chain })), burnt: fireField.burnt.size, bosses: [...bosses.values()].map((B0) => B0.info()), projectiles: projectiles.length, rules: { ...rules }, ambient: settings.ambient, morality: morality.info(worldKey), journal: journal.slice(-5) }),
		// Crysis.combat.spawn('ashfang', 3, { raid }) / ('rogue') / ('gloom') / ('patrol') / ('fire')
		spawn: (fid = 'ashfang', n = 3, o = {}) => { const s = spotAhead(o.d ?? 25, (o.d ?? 25) + 10) || { x: eye().x + 20, z: eye().z }; return squads.squad(fid, s.x, s.z, n, o).then((sq) => sq.id); },
		fight: (a = 'ashfang', b = 'dunecutters', n = 3, d = 30) => { const s = spotAhead(d, d + 5); if (!s) return null; squads.squad(a, s.x - 8, s.z, n, {}); squads.squad(b, s.x + 8, s.z + 3, n, {}); return 'fight'; },
		raid: () => { const vf = W()?.village?.footprints?.find((f) => !f.fence); if (!vf) return 'no village here'; const a = Math.random() * 6.283; squads.squad('ashfang', vf.x + Math.cos(a) * 45, vf.z + Math.sin(a) * 45, 4, { raid: true, dest: { x: vf.x, z: vf.z } }); squads.squad('hearthguard', vf.x, vf.z, 3, {}); return 'raid'; },
		boss: (kind = 'leviathan') => spawnBoss(kind)?.info() || 'unknown boss',
		bossHit: (part = 'body', n = 500) => { const B0 = [...bosses.values()][0]; return B0 ? (B0.damage({ amount: n, part }), B0.info()) : null; },
		camp: () => { const s = spotAhead(20, 25); if (s) props.camp(s.x, s.z, 'camp', (x, z) => ground(x, z, s.y + 2)); return props.info(); },
		fronts: () => { props.fronts(boxesNear(eye().x, eye().z, 40), eye(), (x, z) => ground(x, z), 'fronts'); return props.info(); },
		ignite: (what = 'nearest') => { const n = neighbours(eye().x, eye().z, 40).sort((a, b) => Math.hypot(a.x - eye().x, a.z - eye().z) - Math.hypot(b.x - eye().x, b.z - eye().z)); const t = what === 'nearest' ? n[0] : n.find((q) => q.id.startsWith(what)); return t ? ignite(t.id, t.x, t.z, t.fuel, true, t.box) && t.id : null; },
		hurt: (n = 20) => { hurtPlayer({ amount: n, type: 'ballistic', part: 'torso', src: { x: eye().x + 5, y: eye().y, z: eye().z } }); return me.H.hp; },
		heal: () => { revive(me.H, 1); return me.H.hp; },
		wanted: (stars) => { if (stars !== undefined) { wanted.points = [0, 10, 35, 70, 120, 190][stars] || 0; wanted.stars = stars; } return wanted.stars; },
		ammo: (n = 200) => { const w = weaponNow(); if (w) { ammo.loose[w.S.id] = n; saveAmmo(); } return w && reserve(w); },
		ambient: (on) => { if (on !== undefined) { settings.ambient = !!on; settings.save(); } return settings.ambient; },
		// a shot fired from the eye along the view, for the tests: what it struck
		shoot: (dmg = 30) => { camera.getWorldDirection(_v); const o = camera.position.clone(), d = _v.clone(); const h = firstHit(o, d, 300); const end = h ? o.clone().addScaledVector(d, h.t) : o.clone().addScaledVector(d, 300); fx.tracer(o.clone().add(new THREE.Vector3(0, -0.15, 0)), end, 0); const r = h ? landShot(h, o, d, ME, dmg) : null; return h ? { id: h.T?.id || 'wall', kind: h.T?.kind || h.surface, ward: !!h.ward, t: +h.t.toFixed(2), res: r && { dealt: +(r.dealt || 0).toFixed(1), killed: !!r.killed, ward: !!r.ward } } : null; },
		aimAt: (id) => { const T = layer.get(id); if (!T) return false; const p = P(), e = eye(); const dx = T.bound.x - e.x, dz = T.bound.z - e.z, dy = T.bound.y + 0.3 - e.y; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); _e.set(p.pitch, p.yaw, 0); camera.quaternion.setFromEuler(_e); return true; },
		targets: () => [...layer.map.values()].map((T) => ({ id: T.id, kind: T.kind, faction: T.faction, child: !!T.child, d: Math.round(Math.hypot(T.bound.x - eye().x, T.bound.z - eye().z)) })),
		compassOpen: (on = true) => compass.toggle(on),
		// for the tests: a weapon in hand (owned and held)
		arm: (id = 'warden-spark-carbine', l = 5, t = 2) => { const u = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20); arms?.apply?.({ id: `give-${u}`, kind: 'trade', peer: 'test', give: { credits: 0, items: [] }, get: { credits: 0, items: [{ u, i: id, l, t, x: 0 }] } }); arms?.hold?.(u); return arms?.held?.(); },
		clear: () => { squads.clear(); recovery.clear(); props.clearTag(); for (const B0 of bosses.values()) B0.dispose(); bosses.clear(); return 'cleared'; },
		lore: 'The young carry the Spark until they come of age: no harm reaches them. Bullets turn aside in a shimmer, fire and wheels part round them.',
	};
	return api;
}
