import { bindLookDrag } from './look-drag.js';
// The fight, put together: your arms in use (combat/weapons.js rules, the view's look through
// combat/weapon-view.js), shots cast into the combat layer (combat/targets.js) and against the
// ground and buildings, projectiles, blasts, your health and the HUD, the townsfolk's reactions,
// the squads and their wars (combat/ai-squads.js, factions.js), cars, props, fire and arson,
// the wanted level on Earth, the bosses, friends in a room, and the morality compass that
// weighs it all. main.js makes one and calls update() each frame.
//
// Unarmed, the same button (or Q, or Punch on a touch screen) throws punches (combat/melee.js).
// The military and the police (military/) plug in through api.hooks: where stationed sides
// may stand, trespass on a base, the events they answer, the police's cruisers. The law
// (law/index.js) plugs in there too: a crime goes to it (hooks.crime) to be witnessed and
// called in rather than counting at once, and it says when officers hold their fire, who
// ignores whom, what cover a parked cruiser gives, and whether being downed is an arrest.
//
// Input: left mouse (or the Fire button) fires, R reloads, Z changes fire mode, right mouse aims
// (the view's own), Y throws a signal flare (it sets things alight), K opens the compass. Aiming
// at someone close holds them up.

import * as THREE from 'three';
import { WEAPONS, weaponStats, createWeaponState, trigger, cancelTrigger, cancelReload, completeReload, isBow, stepWeapon, startReload, nextMode, modeOf, spreadNow, reserveOf, drawRounds } from './weapons.js';
import { createBowArrow } from '../crysis/bow-visual.js';
import { kitMaterial, weaponOf } from '../crysis/held-items.js';
import { playCue } from '../crysis/weapon-sound.js';
import { createHealth, applyDamage, tickHealth, revive } from './health.js';
import { createLayer, canHit, warded, strike, rayBox, personShapes } from './targets.js';
import { createWanted, offend, tickWanted, clearWanted, sighted, defend, tickDefence } from './heat.js';
import { pushOut, hiddenSpot } from '../law/tactics.js';
import { sweepOut, worldPush, clearSpot } from '../people/walls.js';
import { createDamageLog, smashed } from '../law/ladder.js';
import { createFx } from './fx.js';
import { createHud } from './hud.js';
import { createWeaponView } from './weapon-view.js';
import { createCivilians } from './civilians.js';
import { createSquads } from './ai-squads.js';
import { createLootView } from './loot-view.js';
import { createContracts } from './contracts-view.js';
import { createFieldAudio } from './field-audio.js';
import { createProps } from './props.js';
import { createCars } from './cars.js';
import { createFireField } from './fire.js';
import { createRelations, FACTIONS, PLAYER, raidWobble } from './factions.js';
import { rememberIncident } from '../people/world-awareness.js';
import { createMorality } from './morality.js';
import { pvpOpen } from './honor.js';
import { PVP_FEATURE } from '../net/protocol.js';
import { createCompass } from './compass.js';
import { soundBus } from '../world/soundbus.js';
import { createTargetFocus } from './target-focus.js';
import { createMelee } from './melee.js';
import { mayStation, militiaCamps } from '../military/rules.js';
import { SPECIES, SPECIES_IDS } from '../creatures/catalog.js';
import { combatLandShot, combatYours, combatFireShot, combatProjectile, combatStepProjectiles, combatBlast, combatKnockout, combatWake, combatIgnite, combatStepFire } from './combat-shots.js';
import { combatSpawnBoss, combatDirector, combatCreatures, combatHoldUps } from './combat-director.js';

const EYE = 1.68;
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private */ } } };
const load = (k, d) => { try { return JSON.parse(store.get(k)) ?? d; } catch { return d; } };
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
// what people say of the Spark, now and then, when it turns harm aside
const SPARK_LINES = ['The Spark! It turned it aside!', 'Thank the stars for the Spark.', 'You cannot hurt the young. Everyone knows that.', 'The Spark keeps them until they come of age.'];

export function createCombat({ scene, camera, mount, world, services = () => null, people, ragdolls, arms, gear, multiplayer = null, hint = () => {}, isPhone = false, shared = {}, drive = null, menu = null, busy = () => false }) {
	// The fight's shared state for the modules its shots and its director moved to (combat-shots.js,
	// combat-director.js). Each getter and setter reaches the binding of that name here.
	const cb = {
		get _d() { return _d; }, get _v() { return _v; }, get active() { return active; },
		get aimAt() { return aimAt; }, set aimAt(next) { aimAt = next; },
		get aimT() { return aimT; }, set aimT(next) { aimT = next; }, get arms() { return arms; },
		get arrowMesh() { return arrowMesh; }, get bosses() { return bosses; },
		get bountyT() { return bountyT; }, set bountyT(next) { bountyT = next; },
		get boxesNear() { return boxesNear; }, get boxId() { return boxId; }, get broke() { return broke; },
		get call() { return call; }, get camera() { return camera; }, get camp() { return camp; },
		get campsNear() { return campsNear; }, get cancelInput() { return cancelInput; },
		get cars() { return cars; }, get civilians() { return civilians; }, get contracts() { return contracts; },
		get creatureSeen() { return creatureSeen; }, set creatureSeen(next) { creatureSeen = next; },
		get creatureT() { return creatureT; }, set creatureT(next) { creatureT = next; },
		get crime() { return crime; }, get ctx() { return ctx; }, get deal() { return deal; },
		get defendNow() { return defendNow; },
		get directorT() { return directorT; }, set directorT(next) { directorT = next; },
		get drive() { return drive; }, get endProjectile() { return endProjectile; }, get eye() { return eye; },
		get EYE() { return EYE; }, get fireField() { return fireField; }, get fireMeta() { return fireMeta; },
		get firstHit() { return firstHit; }, get flareLands() { return flareLands; },
		get fogMotherSpot() { return fogMotherSpot; }, get forgive() { return forgive; }, get fx() { return fx; },
		get ground() { return ground; }, get group() { return group; }, get hatesMe() { return hatesMe; },
		get heatUp() { return heatUp; }, get held() { return held; }, get hint() { return hint; },
		get hooks() { return hooks; }, get hud() { return hud; }, get hurtOnce() { return hurtOnce; },
		get hurtPlayer() { return hurtPlayer; }, get ignite() { return ignite; }, get ignite2() { return ignite2; },
		get isEarth() { return isEarth; }, get isPhone() { return isPhone; }, get landShot() { return landShot; },
		get attacked() { return attacked; },
		get lastAttackT() { return lastAttackT; }, set lastAttackT(next) { lastAttackT = next; },
		get lastShotNotice() { return lastShotNotice; }, set lastShotNotice(next) { lastShotNotice = next; },
		get layer() { return layer; }, get me() { return me; }, get ME() { return ME; },
		get morality() { return morality; }, get multiplayer() { return multiplayer; },
		get neighbours() { return neighbours; }, get net() { return net; }, get notice() { return notice; },
		get P() { return P; }, get people() { return people; }, get placeArrow() { return placeArrow; },
		get placeName() { return placeName; }, get playT() { return playT; }, set playT(next) { playT = next; },
		get policeT() { return policeT; }, set policeT(next) { policeT = next; },
		get populated() { return populated; }, get projectile() { return projectile; },
		get projectiles() { return projectiles; }, get props() { return props; }, get pvp() { return pvp; },
		get relations() { return relations; }, get rnd() { return rnd; }, get rules() { return rules; },
		get scorch() { return scorch; }, get services() { return services; }, get settings() { return settings; },
		get shakeIt() { return shakeIt; }, get shared() { return shared; }, get sound() { return sound; },
		get spark() { return spark; }, get spotAhead() { return spotAhead; },
		get spotForest() { return spotForest; }, get spotHidden() { return spotHidden; },
		get squads() { return squads; }, get threatened() { return threatened; }, get view() { return view; },
		get wobble() { return wobble; },
		get W() { return W; }, get wanted() { return wanted; }, get witnesses() { return witnesses; },
		get worldHit() { return worldHit; }, get worldKey() { return worldKey; }, get zone() { return zone; },
	};
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
			const sg = w.structures?.ray?.(o, d, best?.t ?? max, best, max);          // structures: a pane, a wall built near you (in place of its box) in the way
			if (sg) best = sg.none ? null : sg;
		}
		// the ground: marched, then refined
		const lim = best?.t ?? max;
		let t = 0.3, prev = 0;
		const above = (s) => o.y + d.y * s - ground(o.x + d.x * s, o.z + d.z * s, o.y + d.y * s);
		// the sea: a round fired from above it stops at its face where the ground beneath is under it
		const sea = w.island.hasOcean !== false && o.y > 0.2 && d.y < 0 && !w.deep?.active?.() && !w.island.far;
		while (t < lim) {
			const a = above(t);
			if (sea && o.y + d.y * t < 0) {
				const ts = -o.y / d.y;
				if (ground(o.x + d.x * ts, o.z + d.z * ts, 0) < -0.05) return { t: ts, n: new THREE.Vector3(0, 1, 0), surface: 'water' };
			}
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

	let incidentSeq=0, lastShotNotice=0;
	function notice(kind, at, line, actorId='player', actorName=null) {
		if(!W()?.body?.key || !at) return;
		const event={id:`incident-${Date.now()}-${++incidentSeq}`,at:Date.now(),bodyKey:W().body.key,kind,line,actorId,actorName};
		for(const p of people?.()?.pool || []) {
			const q=p.M?.S?.pos;
			if(!p.active || !q || Math.hypot(q.x-at.x,q.z-at.z)>45 || Math.abs(q.y-(at.y??q.y))>6) continue;
			// Sound carries locally; witnessing an assault also requires a clear sightline.
			if(kind!=='shots' && blocked({x:q.x,y:q.y+1.5,z:q.z},{x:at.x,y:(at.y??q.y)+1,z:at.z})) continue;
			rememberIncident(p,event);
		}
		multiplayer?.reportIncident?.(event,at);
	}

	// ---------- the pieces ----------
	const fx = createFx({ isPhone, ground: (x, z) => ground(x, z), plumes: () => W()?.plumes });
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
	// PvP is chosen twice: the host allows it in the room (rules.pvp), and you raise your own
	// flag (combat/honor.js pvpOpen). server: the room's server weighs flags (PVP_FEATURE), so
	// friends' flags are known; hitAt: when you last hit each friend, for a win they report
	const pvp = { flag: false, server: false, hitAt: new Map() };
	const pvpNow = () => pvpOpen(rules, pvp.flag);
	// military/ fills these in: posts() the stationed posts [{ x, z, r, fid? }], trespass(h),
	// event(e) for trouble the military or police answer, police(stars, response, have) for
	// cruisers answering the wanted level (true when it took the call). law/ fills in crime(kind,
	// at, witnessed), holdFire(h), ignore(h, other), cover(x, z, r), arrest({ downed }) and
	// booked() (true: downed is an arrest, and where you come to), death(h), ambient(zone, spot,
	// roll) (true when it made the world's own trouble itself) and campOk(camp)
	// (magic/: shield takes a blow aimed at you and returns what gets through, or null; cloak
	// says whether you are hidden from those hunting you; power(T, blow) reshapes a blow your
	// weapons deal, for your skills; honorRank() your honor's rank and pvpWin({ from, r, name })
	// a friend beaten in a PvP fight, for your honor: combat/honor.js)
	const hooks = { posts: null, trespass: null, event: null, police: null, crime: null, holdFire: null, ignore: null, cover: null, arrest: null, booked: null, death: null, ambient: null, campOk: null, shield: null, cloak: null, power: null, casting: null, remoteSpell: null, honorRank: null, pvpWin: null, guild: null, quarry: null };
	// an offence on Earth: to the law to be witnessed and called in, or (no law) at once
	function crime(kind, at, witnessed = true) {
		if (!isEarth()) return wanted.stars;
		const where = at || eye();
		if (hooks.crime) return hooks.crime(kind, where, witnessed);
		const s = offend(wanted, kind, witnessed);
		if (witnessed) sighted(wanted, where);
		return s;
	}
	// things of other people's you broke: one is nobody's business, a spree is vandalism
	// (law/ladder.js smashed); none of it counts in the thick of a fight
	const damageLog = createDamageLog();
	function broke(at) {
		if (!at || !isEarth()) return;
		if (squads.alive().some((h) => h.alert && !FACTIONS[h.fid]?.lawful && FACTIONS[h.fid]?.kind !== 'civilians' && Math.hypot(h.pos.x - at.x, h.pos.z - at.z) < 80)) return;
		const kind = smashed(damageLog, at, performance.now() / 1000);
		if (kind) crime(kind, at, witnesses(at) > 0);
	}
	// somewhere people live or work: buildings about, or people near. Out in the empty country
	// nobody hears the gunfire, and no contract hunters or police come out to fight there.
	function populated(at, r = 200) {
		if (!at) return false;
		if (boxesNear(at.x, at.z, r).length > 3) return true;
		for (const p of people?.()?.pool || []) { const q = p.active && p.M?.S?.pos; if (q && Math.abs(q.x - at.x) < r && Math.abs(q.z - at.z) < r) return true; }
		return false;
	}
	// self-defence (combat/heat.js defend): someone not of the law who opened fire on you first,
	// still about and after you
	function threatened() {
		const e = eye();
		if (!e) return false;
		for (const h of squads.alive()) if (h.struckFirst && h.alert && !h.surrendered && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 150) return true;
		return false;
	}
	// you answered fire: no crime, a blue star, and the police called to your side
	function defendNow(at) {
		if (!isEarth() || !at || !defend(wanted)) return;
		call('You were fired on first: self-defence. The police are on your side.', '');
		hooks.event?.({ kind: 'defence', x: at.x, z: at.z, severity: 1 });
	}
	// an officer you hurt while they are on your side: their squad lets it go (a warning)
	function forgive(h) {
		for (const m of h?.squad?.members || (h ? [h] : [])) { m.provoked = false; if (m.target?.id === 'me') { m.target = null; m.targetT = 0; } }
	}
	// attacks on you paced as events (factions.js ATTACK): play time, and when the last one came
	let playT = 0, lastAttackT = 0, wobble = raidWobble();
	const attacked = () => { lastAttackT = playT; wobble = raidWobble(); };
	const hatesMe = (fid) => relations.hostile(fid, PLAYER) || (FACTIONS[fid]?.kind === 'mercs' && morality.reactions().bounty > 0);
	let gangDeaths = [];
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
	let mouseDown = false, touchFire = false, padFire = false;
	// Capture edges in the event handler: a down/up between two frames is still a shot.
	function fireInput(source, down) {
		if (!active() || me.ko || recovery.busy) { cancelInput(); return false; }
		const w = weaponNow();
		if (source === 'mouse') mouseDown = down; else if (source === 'pad') padFire = down; else touchFire = down;
		if (w) { trigger(w, mouseDown || touchFire || padFire); syncBow(w); }
		return true;
	}
	function cancelInput() {
		mouseDown = touchFire = padFire = false;
		if (Wp) { cancelTrigger(Wp); cancelReload(Wp); }
		view.cancel();
		if (Wp) syncBow(Wp);
		hud.btns.Fire?.classList.remove('on');
	}
	const canvas = mount.querySelector('canvas');
	const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable || window._KEYS_PLAY_ON;
	addEventListener('pointerdown', (e) => { if (!e.defaultPrevented && e.button === 0 && e.pointerType === 'mouse' && (!canvas || e.target === canvas) && active() && (!canvas?.requestPointerLock || document.pointerLockElement === canvas)) fireInput('mouse', true); });
	addEventListener('pointerup', (e) => { if (e.button === 0) { if (!active() || me.ko) cancelInput(); else fireInput('mouse', false); } });
	addEventListener('pointercancel', cancelInput);
	addEventListener('blur', cancelInput);
	document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) cancelInput(); });
	document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInput(); });
	canvas?.addEventListener('pointerleave', () => { if (mouseDown && document.pointerLockElement !== canvas) cancelInput(); });
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || typing() || !active()) return;
		const k = e.key.toLowerCase();
		if (k === 'r') { if (reload()) e.preventDefault(); }
		else if (k === 'z') { const w = weaponNow(); if (w && w.S.modes.length > 1) { hint(`Fire mode: ${nextMode(w)}`, 1200, 1); e.preventDefault(); } }
		else if (k === 'y') { if (throwFlare()) e.preventDefault(); }
	});
	const B = hud.btns;
	if (B.Fire) {
		bindLookDrag(B.Fire, mount, { start: () => { if (!fireInput('touch', true)) return false; B.Fire.classList.add('on'); }, end: () => { fireInput('touch', false); B.Fire.classList.remove('on'); }, cancel: cancelInput });
		B.Reload.addEventListener('pointerdown', (e) => { e.stopPropagation(); reload(); });
		B.Mode.addEventListener('pointerdown', (e) => { e.stopPropagation(); const w = weaponNow(); if (w) nextMode(w); });
		for (const b of Object.values(B)) b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
	}
	function active() {
		const p = P();
		return !!p && !typing() && !document.hidden && !mount.inert && !mount.classList.contains('l99-tools-open') && !gear?.()?.busy?.() && !arms?.locked?.() && !busy() && !drive?.active?.() && !p.swimming && !W()?.orbit?.active?.() && mount.style.display !== 'none' && !(menu && menu.style.display && menu.style.display !== 'none');
	}

	// ---------- shots ----------
	// the first thing a ray meets: a target in the layer or a wall: { T?, t, n, surface, part, ward }
	// (assist: a forgiving weapon's, layer.cast)
	function firstHit(o, d, max, shooterT = ME, assist = null) {
		const a = layer.cast(o, d, max, shooterT, rules, assist), b = worldHit(o, d, a ? a.t : max);
		// (a wall built near you keeps its own record under wall: structures/walls/ needs it)
		if (b && (!a || b.t < a.t)) return { ...b, wall: b.wall || true };
		return a;
	}
	// a shot or blow landing on what it met (shooter: ME, a squad member, a boss)
	function landShot(...args) { return combatLandShot(cb, ...args); }
	// harm to a target, by its rules: shared things on a guest go to the host
	function deal(T, blow, mine) {
		if (warded(T)) return { ward: true, dealt: 0 };
		if (!canHit(T, blow.by || null, rules)) return { ignored: true, dealt: 0 };
		// (your weapons' blows, as your skills shape them: magic/skills.js)
		if (mine && !blow.spell && hooks.power) blow = hooks.power(T, blow) || blow;
		const before = T.moral?.();
		let r;
		if (T.shared && !host()) { net.hit(T.id, blow); r = { dealt: blow.amount, remote: true }; }
		else if (T.kind === 'remote') { net.hit('me', blow, T.peer); pvp.hitAt.set(T.peer, performance.now()); r = { dealt: blow.amount }; }
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
			if (wardMarkT <= 0) { wardMarkT = 4; morality.record({ kind: 'ward', target: T.name || 'a young person', place: placeName(), world: worldKey, ctx: { witnessed: true } }); crime('hitCivilian', T.bound, true); }
			if (sparkLineT <= 0) { sparkLineT = 12; call(SPARK_LINES[Math.floor(Math.random() * SPARK_LINES.length)], 'bystander'); }
		}
		civilians.alarm(at.x, at.z, 20);
	}

	// your deed, weighed (the morality compass), and how the world takes it
	const hurtOnce = new Set();
	function yours(T, r, blow, ctx0) { return combatYours(cb, T, r, blow, ctx0); }
	function witnesses(at) {
		if (!at) return 0;
		let n = 0;
		for (const p of people?.()?.pool || []) if (p.active && p.P.root.visible && !p.P.ragdoll && Math.hypot(p.M.S.pos.x - at.x, p.M.S.pos.z - at.z) < 40) n++;
		for (const h of squads.alive()) if (FACTIONS[h.fid]?.lawful && Math.hypot(h.pos.x - at.x, h.pos.z - at.z) < 60) n += 3;
		return n;
	}

	function fireShot(...args) { return combatFireShot(cb, ...args); }

	// ---------- projectiles: arrows, energy bolts, spit, missiles, flares ----------
	function projectile(o) { return combatProjectile(cb, o); }
	function endProjectile(p, at) {
		const i = projectiles.indexOf(p);
		if (i >= 0) projectiles.splice(i, 1);
		if (p.arrowMesh) p.arrowMesh.visible = false;
		if (p.streak != null) fx.free(p.streak);
		if (p.T) layer.remove(p.T.id);
		if (at && p.splash > 0) blast(at, p.splash, p.dmg * 0.6, p.owner, null, p.type);
	}
	function stepProjectiles(dt) { return combatStepProjectiles(cb, dt); }
	// a gunship's missile: slow, homing, and it can be shot down
	function missile(B0, from) {
		const p = projectile({ from, to: eye().clone(), speed: 24, drop: 0, dmg: 18, type: 'blast', owner: B0.T, style: 4, splash: 3, hostile: true, missile: true, life: 7 });
		p.T = { id: 'ms' + Math.random().toString(36).slice(2, 8), kind: 'missile', faction: 'boss', surface: 'metal', bound: { x: from.x, y: from.y, z: from.z, r: 1 }, shapes: () => [{ type: 'sphere', c: p.pos, r: 0.7, part: 'body' }], onHit: () => { fx.explosion(p.pos.clone(), 2); endProjectile(p, null); return { dealt: 1, killed: true }; } };
		layer.add(p.T);
	}

	// ---------- blasts ----------
	function blast(...args) { return combatBlast(cb, ...args); }

	// ---------- you, hurt ----------
	function hurtPlayer(blow) {
		if (me.ko || !P()) return;
		if (blow.by?.kind === 'remote' && !pvpNow()) return;
		if (hooks.shield) { blow = hooks.shield(blow); if (!blow) return; }
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
	function knockout(blow) { return combatKnockout(cb, blow); }
	function wake() { return combatWake(cb); }

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
	function ignite(...args) { return combatIgnite(cb, ...args); }
	function stepFire(dt) { return combatStepFire(cb, dt); }
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
	const fieldAudio = createFieldAudio();
	const fieldActive = () => active() && !me.ko && !P()?.flying && !P()?.locked;
	const recovery = createLootView({ group, mount, arms, camera, eye, blocked, ground, active: fieldActive, hint, sound: fieldAudio.play, touch,
		onPickup: () => { cancelInput(); gear?.()?.weapon?.pickup?.(); }, onCollected: (source) => contracts.recovered(source) });
	const ctx = {
		layer, fx, isPhone, relations, ragdolls, people, world: W, ground, eye, blocked, call, hud,
		yaw: () => P()?.yaw ?? 0,
		me: () => ({ speed: me.speed, grounded: !!P()?.grounded || !!W()?.deep?.active?.(), vel: me.vel }),
		projectile, firstHit, landShot, hurtPlayer, blast, missile, ignite: (id, x, z, f, mine) => ignite(id, x, z, f, !!mine), shake: (k) => shakeIt(k),
		strikeNpc: (T, blow, at) => { if (at) fx.impact(at, null, T.surface, blow.type === 'energy'); return deal(T, blow, false); },
		whiz: () => { sound('whiz'); hud.suppress(0.3); }, heard: (from) => civilians.alarm(from.x, from.z, 25), sound: (k, p) => sound(k, p), gunshot: (at, gun) => gunshot(at, gun),
		wanted: () => wanted.stars, bounty: () => morality.reactions().bounty, playerDown: () => me.ko > 0,
		defending: () => isEarth() && wanted.blue > 0,
		civilians: () => [...layer.map.values()].filter((T) => T.kind === 'person' && !T.child),
		coverNear: (x, z, r) => hooks.cover?.(x, z, r) || props.coverNear(x, z, r) || buildingCover(x, z, r),
		holdFire: (h) => !!hooks.holdFire?.(h),
		cloaked: () => !!hooks.cloak?.(),
		ignore: (h, o) => !!hooks.ignore?.(h, o),
		keepOut: (pos, from) => keepOut(pos, from),
		clearSpot: (from, want, footY) => clearSpot(worldPush(W()), from, want, footY),
		coverK: () => (P()?.crouch ? 0.7 : 1),
		fireAt: (id) => fireField.fires.get(id) || null, douse: (id, dt) => fireField.douse(id, dt * 3),
		heat: (id, x, z, fuel, amount) => { if (fuel) { const h = (heatMap.get(id) || 0) + amount; heatMap.set(id, h); if (h > 60) ignite(id, x, z, fuel, true); } },
		friendsNear: () => (multiplayer?.bodies?.() || []).filter((r) => Math.hypot(r.at[0] - eye().x, r.at[2] - eye().z) < 40).length,
		spawnSquad: (fid, x, z, n, o) => squads.squad(fid, x, z, n, o),
		// a stationed side only at a post: the bases' and checkpoints' (military/), or a militia compound
		mayStation: (fid, x, z) => mayStation({ ...FACTIONS[fid], id: fid }, x, z, [...(hooks.posts?.() || []), ...campsNear(x, z)]),
		trespass: (h) => !!hooks.trespass?.(h),
		onSurrender: (h) => { if (Math.hypot(h.pos.x - eye().x, h.pos.z - eye().z) < 60) hint(`${h.F.name}: one of them throws down their weapon and surrenders. They are out of the fight.`, 4000, 1); },
		// (one of your guild's struck down is carried off to rest, guild/companions.js; what others
		// fell teaches them, and you)
		onDeath: (h, blow) => { if (h.ally) { hooks.guild?.down?.(h, blow); feedDeath(h, blow); return; } recovery.add(h); gangDeath(h); hooks.death?.(h); feedDeath(h, blow); hooks.guild?.kill?.(h, blow); },
		allyCast: (h, dt) => hooks.guild?.cast?.(h, dt),
		onSpared: (h, d) => { if (d < 50) morality.record({ kind: 'spare', target: h.T.name, faction: h.fid, place: placeName(), world: worldKey }); },
		onPhase: (B0) => net.boss(B0, true),
		onBossDown: (B0) => bossDown(B0),
		onDestroyed: (S) => { if (S.lastMine) { morality.record({ kind: 'arson', target: 'a car', place: placeName(), world: worldKey, ctx: { occupied: !!S.fled } }); crime('car', S.pos || eye(), true); } },
	};
	// the kill feed: who fell to whom within sight of the fight (yours always), and with what
	const plainName = (n) => String(n || 'someone').replace(/^an? /i, '').replace(/^\w/, (c) => c.toUpperCase());
	function feedDeath(h, blow) {
		const mine = blow?.by === ME, e = eye();
		if (!mine && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) > 150) return;
		const by = blow?.by, killer = mine ? 'You' : by?.name ? plainName(by.name) : by?.faction && FACTIONS[by.faction] ? FACTIONS[by.faction].name : null;
		if (!killer) return;
		const how = blow?.melee ? 'hands' : blow?.type === 'blast' ? 'blast' : blow?.type === 'fire' ? 'fire' : mine && Wp ? Wp.S.name : '';
		hud.feed(killer, plainName(h.T?.name), how, { mine, head: blow?.part === 'head' });
	}
	function buildingCover(x, z, r) { const b = boxesNear(x, z, r).find((q) => q.w > 2); return b ? { x: b.x, z: b.z, r: Math.max(b.w, b.d) / 2 } : null; }
	// the fighters kept out of walls and buildings: each step swept against the same pushes that
	// keep you out (people/walls.js: house walls, closed doors, the city's blocks, fences, cars);
	// then the mapped buildings' boxes round each cell of the street, looked up a few times a
	// second rather than every step of every body
	const boxCells = new Map();
	function keepOut(pos, from = null) {
		sweepOut(worldPush(W()), from, pos, from ? from.y : pos.y);
		if (!isEarth() || W()?.deep?.active?.()) return;
		const k = (Math.floor(pos.x / 24) * 73856093) ^ Math.floor(pos.z / 24);
		let c = boxCells.get(k);
		if (!c || worldT - c.t > 2) {
			if (!c) { if (boxCells.size > 48) boxCells.clear(); c = { t: 0, list: null }; boxCells.set(k, c); }
			c.t = worldT; c.list = boxesNear(Math.floor(pos.x / 24) * 24 + 12, Math.floor(pos.z / 24) * 24 + 12, 40);
		}
		if (c.list.length) pushOut(c.list, pos, 0.35);
	}
	const civilians = createCivilians(ctx);
	const squads = createSquads(ctx);
	const contracts = createContracts({ group, mount, arms, squads, recovery, eye, camera, ground, hint, audio: fieldAudio, store, active: fieldActive, down: () => me.ko > 0,
		eligible: () => !W()?.deep?.active?.() && (isEarth() ? zone() === 'earth-rural' : ['TERRAN', 'ARID'].includes(shared.planet?.type || 'TERRAN')),
		site: () => {
			for (let k = 0; k < 8; k++) {
				const s = spotAhead(35, 60); if (!s || boxesNear(s.x, s.z, 16).length) continue;
				if ([[-10, 0], [10, 0], [0, -10], [0, 10]].some(([x, z]) => Math.abs(ground(s.x + x, s.z + z, s.y + 2) - s.y) > 2.5)) continue;
				return s;
			} return null;
		} });
	const props = createProps(ctx);
	const cars = createCars(ctx);
	group.add(squads.group, props.group, cars.group);
	// a car you shot: yours when it goes up
	const carHit = cars.state;
	ctx.markCar = (id) => { const S = carHit.get(id); if (S) S.lastMine = true; };

	// ---------- fists ----------
	const melee = createMelee({
		camera, mount, touch, scene, group, layer, people, ragdolls, civilians, fx, hint, eye, ground, hurtPlayer, call, isPhone,
		deal: (T, blow, mine) => deal(T, blow, mine),
		// (a body knocked down gets up short of any wall it slid against, people/walls.js)
		clearSpot: (from, want, footY) => clearSpot(worldPush(W()), from, want, footY),
		// (fists are quieter than gunfire: the nearest run, those further off stop and watch)
		heard: (at) => civilians.alarm(at.x, at.z, 7),
		focusTarget: () => focus.current(), blocked,
		player: P, input: () => W()?.player?.input?.(), speed: () => me.speed, squads: () => squads,
		deed: (kind, target, c = {}) => morality.record({ kind, target, place: placeName(), world: worldKey, ctx: c }),
		active: () => active() && !me.ko && !P()?.flying && !P()?.swimming && !recovery.busy,
		armed: () => !!held(), down: () => me.ko > 0, driving: () => !!drive?.active?.(),
		// (a spell leaving your hand: the fists stand down for it, magic/hands.js)
		casting: () => !!hooks.casting?.(),
		isEarth, zone: () => zone(), event: (e) => hooks.event?.(e),
		ward: (T) => spark(T, { x: T.bound.x, y: T.bound.y, z: T.bound.z }, ME),
		realmArmed: () => !!W()?.medieval,
		// structures: a fist or a swing at a wall (walls built near you break, layer by layer)
		wallBlow: (m) => { const e = eye(), d = camera.getWorldDirection(new THREE.Vector3()); const r = W()?.structures?.blow?.(e, d, m.reach + 0.35, m); if (r) { if (r.broke) broke(r.at || e); return r; } const h = worldHit(e, d, m.reach + 0.25); return h && h.surface !== 'ground' ? { material: h.surface, hard: true, at: e.clone().addScaledVector(d, h.t) } : null; },
	});

	const focus = createTargetFocus({ layer, camera, mount, blocked, shooter: ME, rules, vector: () => new THREE.Vector3(), hint,
		active: () => active() && !me.ko && !P()?.flying && !recovery.busy,
		hostile: (T) => !!(T.P && melee.foes.has(T.P)) || !!T.moral?.()?.hostileTarget,
	});
	const assist = (dt) => focus.assist(P(), dt);

	// ---------- bosses ----------
	function spawnBoss(...args) { return combatSpawnBoss(cb, ...args); }
	// where the Fog Mother rises: in the strait beside the Golden Gate, abreast of you on the deck
	// (or, away from it, out in front of you)
	function fogMotherSpot() {
		const B = W()?.bridge, e = eye();
		if (!B || Math.hypot(e.x - B.centre.x, e.z - B.centre.z) > B.length / 2 + 900) { camera.getWorldDirection(_v); _v.y = 0; _v.normalize(); return { x: e.x + _v.x * 160, y: 0, z: e.z + _v.z * 160 }; }
		const half = B.length / 2 - 200, s = Math.max(-half, Math.min(half, (e.x - B.centre.x) * B.axis.x + (e.z - B.centre.z) * B.axis.y));
		const side = ((e.x - B.centre.x) * -B.axis.y + (e.z - B.centre.z) * B.axis.x) > 0 ? 1 : -1, t = side * 80;
		return { x: B.centre.x + B.axis.x * s - B.axis.y * t, y: 0, z: B.centre.z + B.axis.y * s + B.axis.x * t };
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
		// (the Golden Gate after dark: she comes up out of the fog)
		const B = w?.bridge, e = eye();
		if (isEarth() && B && (w?.sky?.uniforms?.uNight?.value ?? 0) > 0.6 && Math.hypot(e.x - B.centre.x, e.z - B.centre.z) < B.length / 2 + 300 && !recent('fogmother')) { seen.fogmother = Date.now(); hint('The fog is thickening over the Gate. Something in it is standing up.', 5000, 2); spawnBoss('fogmother'); return; }
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
	// somewhere about you that you cannot see right now (round a corner, behind you): for people
	// who arrive rather than appear
	function spotHidden(dmin, dmax) {
		const e = eye(), p = P();
		if (!p) return null;
		const dir = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) }, cands = [];
		for (let k = 0; k < 10; k++) {
			const a = Math.random() * Math.PI * 2, d = rnd(dmin, dmax), x = e.x + Math.sin(a) * d, z = e.z + Math.cos(a) * d, g = ground(x, z, e.y);
			if (!Number.isFinite(g) || (!W()?.deep?.active?.() && g < 0.6) || Math.abs(g - (e.y - EYE)) > 25) continue;
			cands.push({ x, z, y: g });
		}
		return hiddenSpot(cands, e, dir, (x, z) => blocked(e, _v.set(x, ground(x, z, e.y) + 1.5, z)));
	}
	// somewhere among tall trees (for one that stands as a tree, waiting): the most wooded of a
	// few spots round you, in plain sight or not, or none where there is no wood
	function spotForest(dmin, dmax) {
		const e = eye(), city = W()?.city;
		if (!city?.treesNear) return null;
		let best = null, bn = 3;
		for (let k = 0; k < 12; k++) {
			const a = Math.random() * Math.PI * 2, d = rnd(dmin, dmax), x = e.x + Math.sin(a) * d, z = e.z + Math.cos(a) * d, g = ground(x, z, e.y);
			if (!Number.isFinite(g) || g < 0.6 || Math.abs(g - (e.y - EYE)) > 25) continue;
			const n = city.treesNear(x, z, 18).filter((t) => !t.shrub && !t.fern && t.h > 7).length;
			if (n > bn) { bn = n; best = { x, z, y: g }; }
		}
		return best;
	}
	function spotAhead(dmin, dmax) {
		const e = eye();
		for (let k = 0; k < 8; k++) {
			const a = P().yaw + Math.PI + rnd(-1.2, 1.2), d = rnd(dmin, dmax);
			const x = e.x - Math.sin(a + Math.PI) * d, z = e.z - Math.cos(a + Math.PI) * d;
			const g = ground(x, z, e.y);
			if (!Number.isFinite(g)) continue;
			if (!W()?.deep?.active?.() && g < 0.6) continue;
			if (Math.abs(g - (e.y - EYE)) > 25) continue;
			return { x, z, y: g };
		}
		return null;
	}
	function director(dt) { return combatDirector(cb, dt); }
	// ---------- the creatures (creatures/catalog.js) ----------
	// The night's monsters come out after dark (the Fog Wight on open ground and shores, the
	// Sexton by the towns and the fields, Drain Skulkers in packs through the streets), the
	// Deep's own foes below: one of them now and then, out of sight about you, a few at most.
	let creatureT = 30, creatureSeen = false;
	function creatures(dt) { return combatCreatures(cb, dt); }
	// one of them ahead of you, for trying them out (the places menu's Creatures list, and
	// Crysis.combat.creature): awake and coming for you
	function creatureAhead(id, n = 1, d = 14) {
		const S = SPECIES[id];
		if (!S) return null;
		const s = spotAhead(d, d + 4) || { x: eye().x - Math.sin(P()?.yaw || 0) * d, z: eye().z - Math.cos(P()?.yaw || 0) * d };
		// (one that lurks stands there as it would in a wood: walk up to it, or wake it)
		return squads.squad(S.faction, s.x, s.z, n, { species: id, spread: 2, alert: !S.lurk }).then((sq) => sq.id);
	}
	if (menu) {
		// a way to meet each one, in the places menu (with Skills and magic, and Test mode)
		const css = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px var(--bard-body,system-ui,sans-serif);min-height:36px;cursor:pointer;';
		const stop = (el) => { for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) el.addEventListener(ev, (x) => x.stopPropagation()); };
		const btn = document.createElement('button');
		btn.type = 'button'; btn.textContent = '☠ Creatures'; btn.title = 'Meet one of the creatures, just ahead of you'; btn.style.cssText = css;
		const list = document.createElement('div');
		list.style.cssText = 'display:none;flex-direction:column;gap:4px;padding-left:12px;flex:none;';
		for (const id of SPECIES_IDS) {
			const b = document.createElement('button');
			b.type = 'button'; b.textContent = SPECIES[id].name; b.style.cssText = css;
			stop(b);
			b.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; list.style.display = 'none'; creatureAhead(id); hint(SPECIES[id].lurk ? `${SPECIES[id].name}, just ahead: still as a tree until you disturb it.` : `${SPECIES[id].name}, just ahead.`, 2400); });
			list.appendChild(b);
		}
		// (and the Fog Mother, who rises beside the Golden Gate: a boss, not a creature among others)
		{
			const b = document.createElement('button');
			b.type = 'button'; b.textContent = 'The Fog Mother'; b.style.cssText = css;
			stop(b);
			b.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; list.style.display = 'none'; if (!bosses.size) spawnBoss('fogmother'); hint(W()?.bridge ? 'The Fog Mother rises in the strait beside the Golden Gate.' : 'The Fog Mother rises out there ahead of you. She belongs to the Golden Gate at night.', 4000, 1); });
			list.appendChild(b);
		}
		stop(btn);
		btn.addEventListener('click', (e) => { e.stopPropagation(); list.style.display = list.style.display === 'none' ? 'flex' : 'none'; });
		menu.insertBefore(list, menu.firstChild);
		menu.insertBefore(btn, list);
	}
	// militia compounds round a point: fixed per world (military/rules.js)
	function campsNear(x, z) {
		const w = W();
		if (!w || w.deep?.active?.()) return [];
		const seed = (w.seed | 0) ^ (isEarth() ? 0x5ea : 0);
		return militiaCamps(x, z, seed, 400).filter((c) => { const g = w.island.heightAt(c.x, c.z); return g > 1 && boxesNear(c.x, c.z, 60).length === 0 && (!hooks.campOk || hooks.campOk(c)); });
	}
	// gang members falling one after another: the trouble is bigger than the police
	function gangDeath(h) {
		if (FACTIONS[h.fid]?.kind !== 'gang' || !isEarth()) return;
		const now = worldT;
		gangDeaths = gangDeaths.filter((t) => now - t < 90);
		gangDeaths.push(now);
		if (gangDeaths.length === 3) hooks.event?.({ kind: 'gang', x: h.pos.x, z: h.pos.z, severity: 2 });
	}
	function camp(fid, s) { props.clearTag('camp'); props.camp(s.x, s.z, 'camp', (x, z) => ground(x, z, s.y + 2)); squads.squad(fid, s.x, s.z, isPhone ? 3 : 4, {}); }

	// ---------- hold-ups ----------
	let aimT = 0, aimAt = null;
	function holdUps(dt) { return combatHoldUps(cb, dt); }

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
		if (t === 'closed' || (t === 'status' && v.status !== 'on')) { rules.pvp = false; pvp.server = false; pvp.hitAt.clear(); net.out.length = 0; net.hits.clear(); return; }
		if (t === 'welcome') { Object.assign(rules, v.rules || { pvp: false }); pvp.server = !!v.features?.includes(PVP_FEATURE); return; }
		// a friend you fought went down: yours, if you hit them a moment ago (the server checks too)
		if (t === 'down') {
			const at = pvp.hitAt.get(v.from);
			if (!pvpNow() || !at || performance.now() - at > 20000) return;
			pvp.hitAt.delete(v.from);
			const name = multiplayer?.friend?.(v.from)?.name || 'a friend';
			hud.feed('You', name, '', { mine: true });
			hooks.pvpWin?.({ from: v.from, r: v.r | 0, name });
			return;
		}
		if (t === 'rules') { Object.assign(rules, v); hint(`PvP is ${rules.pvp ? 'on' : 'off'} in this room.`, 2500, 1); return; }
		if(t==='reputation') {
			const e=v.e, at=multiplayer?.reputationPosition?.(e);
			if(!v.live || !at || e.actor===multiplayer?.me?.() || e.kind==='quest-complete' || e.kind==='shots')return;
			notice(e.kind,at,e.kind==='vehicle-impact'?'drove a vehicle into a person':e.kind==='robbery'?'held someone up at gunpoint':e.kind==='arson'?'set a fire':'attacked a person',e.actor,e.name);
			civilians.alarm(at.x,at.z,35,at.y);return;
		}
		if (t === 'fx') { const q=v.s?.[0]; if(q) notice('shots',{x:q[0],y:q[1],z:q[2]},'fired a weapon nearby',v.id || 'remote',multiplayer?.friend?.(v.id)?.name || 'another player'); for (const q of v.s) { const a = { x: q[0], y: q[1], z: q[2] }, b = { x: q[3], y: q[4], z: q[5] }; if (q[6] === 7) { hooks.remoteSpell?.(a, b, q[7], v.id); continue; } fx.tracer(a, b, q[6]); fx.muzzle(a, _v.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize(), q[6]); if (q[7]) fx.impact(b, null, 'stone'); } return; }
		if (t === 'hit') {
			// on you (PvP), or a guest's hit on something shared, for the host to decide
			if (v.id === 'me') { if (pvpNow()) { const r = remotes.get(v.from); hurtPlayer({ amount: v.d, type: v.k || 'ballistic', part: v.p, src: r ? { x: r.at[0], y: r.at[1], z: r.at[2] } : null, by: { id: 'rp:' + v.from, kind: 'remote' } }); } return; }
			if (!host()) return;
			const T = layer.get(v.id);
			if (T?.kind==='person' && T.faction==='civ') notice('assault',T.bound,'attacked a civilian',v.from || 'remote','another player');
			if (T) strike(T, { amount: v.d, type: v.k || 'ballistic', part: v.p, by: { id: 'rp:' + v.from, kind: 'remote', faction: PLAYER } }, { id: 'rp:' + v.from, kind: 'remote', faction: PLAYER }, rules);
			return;
		}
		if (t === 'cs') {
			if (host()) return;
			if (v.b && !bosses.has(v.b.id) && (!v.b.w || v.b.w === worldKey)) spawnBoss(v.b.kind, v.b, v.b.id);
			for (const [id, hp, phase, dead] of v.e) bosses.get(id)?.sync(hp, phase, dead);
		}
	}
	function setFlag(on) {
		pvp.flag = !!on;
		if (!pvp.flag) pvp.hitAt.clear();
		const why = !multiplayer?.live?.() ? 'PvP flag raised: it counts once you are in a room with friends.' : rules.pvp ? 'PvP flag raised: friends with theirs up can fight you, and you them.' : 'PvP flag raised. The host has PvP off in this room for now.';
		hint(pvp.flag ? why : 'PvP flag lowered: no friend can hurt you.', 3000, 1);
		return pvp.flag;
	}
	multiplayer?.linkCombat?.({ heard, rules: () => ({ ...rules }), setRules: (r) => { if (!multiplayer.isHost()) return; Object.assign(rules, { pvp: !!r.pvp }); multiplayer.send({ t: 'rules', r: { pvp: !!r.pvp } }); }, flag: () => pvp.flag, setFlag });
	// friends' bodies in the layer while PvP is open to you: those with their own flag up (an
	// older server cannot tell: then everyone, as before)
	function stepRemotes() {
		const list = pvpNow() ? (multiplayer?.bodies?.() || []).filter((r) => !pvp.server || r.pk) : [];
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
			// (a blast carries much further than the small cues, and arrives late: sound's own speed)
			const dist = at ? Math.hypot(at.x - eye().x, at.z - eye().z) : 0, reach = kind === 'boom' ? 900 : 120;
			if (dist > reach) return;
			const bus = soundBus(); if (!bus) return;
			const AC = bus.ctx;
			const t = AC.currentTime + (kind === 'boom' ? dist / 343 : 0), g = AC.createGain(), o = AC.createOscillator();
			g.connect(bus.out);
			sounding.add(o);
			o.onended = () => { sounding.delete(o); o.disconnect(); g.disconnect(); };
			const far = at ? (kind === 'boom' ? Math.max(0.08, Math.pow(40 / (40 + dist), 0.6)) : Math.max(0.15, 1 - dist / 120)) : 1;
			if (kind === 'chime') { o.type = 'sine'; o.frequency.setValueAtTime(1318, t); o.frequency.setValueAtTime(1760, t + 0.09); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * far, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); }
			else if (kind === 'boom') { o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.6); g.gain.setValueAtTime(0.5 * far, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8); }
			else if (kind === 'glass') { o.type = 'triangle'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.25); g.gain.setValueAtTime(0.12 * far, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); }
			else { o.type = 'square'; o.frequency.setValueAtTime(kind === 'whiz' ? 1800 : 220, t); o.frequency.exponentialRampToValueAtTime(kind === 'whiz' ? 600 : 60, t + 0.12); g.gain.setValueAtTime(0.05 * far, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); }
			o.connect(g); o.start(t); o.stop(t + 1);
			if (kind === 'boom' && dist > 30) playCue('marksman', { distance: dist, delay: dist / 343, gain: 0.9, loud: true });
		} catch { /* no audio */ }
	}

	// another's gunshot, heard where you are: the report comes late by its distance (a round that
	// cracks past you is heard before the shot that sent it), dull and echoing from far off.
	// A heavy firefight is thinned so it never piles up voices.
	let shotGate = 0;
	function gunshot(at, gun) {
		const e = eye(), d = Math.hypot(at.x - e.x, at.y - e.y, at.z - e.z);
		if (d > 900 || document.hidden) return;
		const now = performance.now(), gap = d < 80 ? 35 : d < 300 ? 90 : 160;
		if (now < shotGate) return;
		shotGate = now + gap;
		try { playCue(weaponOf(gun)?.sounds.fire || 'scout', { distance: d, delay: d / 343, loud: true }); } catch { /* no audio */ }
		// (and the birds near it take off: world/flush.js)
		W()?.flush?.noise(at, 0.5, e);
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
		focus.clear();
		contracts.clear(); squads.clear(); recovery.clear(); fieldAudio.clear(); props.clearTag(); cars.clear(); melee.clear(); civilians.clear(); fireField.clear(); fireMeta.clear(); heatMap.clear(); fx.clear();
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
		// Refresh hit bounds from the latest body positions before consuming input.
		civilians.update(dt, camera.position);
		// your weapon
		const wpn = active() && !me.ko && !recovery.busy ? weaponNow() : null;
		if (wpn) {
			trigger(wpn, mouseDown || touchFire || padFire);
			syncBow(wpn);
			const ads = view.state()?.aiming ? 1 : 0;
			const before = wpn.mag;
			const r = stepWeapon(wpn, dt, { reserve: reserve(wpn), ads, accept: () => view.fire() !== false });
			if (r.loaded) took(wpn, r.loaded);
			for (let i = 0; i < r.fired; i++) {
				fireShot(wpn, r.charge);
				// the aim climbs with each shot and settles back (the view kicks the weapon itself)
				p.pitch = Math.min(1.35, p.pitch + r.kick[0] / Math.max(1, r.fired)); p.yaw += r.kick[1] / Math.max(1, r.fired);
				focus.kick(r.kick[0] / Math.max(1, r.fired), r.kick[1] / Math.max(1, r.fired));
			}
			if (r.empty && before === 0 && (mouseDown || touchFire || padFire)) { if (reserve(wpn) > 0) reload(); mouseDown = touchFire = padFire = false; }
			if (isBow(wpn) && r.fired && reserve(wpn) > 0) reload();
			syncBow(wpn);
			if (r.fired || r.loaded) saveAmmo();
		} else { cancelInput(); }
		if (shake > 0) { shake = Math.max(0, shake - dt * 2); camera.rotation.x += (Math.random() - 0.5) * shake * 0.02; camera.rotation.y += (Math.random() - 0.5) * shake * 0.02; }
		holdUps(dt);
		if (p.aimAssist !== assist) p.aimAssist = assist;
		focus.update(dt);
		melee.update(dt);
		squads.update(dt);
		recovery.update(dt);
		contracts.update(dt);
		cars.update(dt, pos);
		stepProjectiles(dt);
		stepFire(dt);
		for (const [id, B0] of bosses) if (!B0.update(dt)) { B0.dispose(); bosses.delete(id); }
		bossDirector();
		director(dt);
		creatures(dt);
		stepRemotes();
		net.update(dt);
		relations.drift(dt);
		if (isEarth()) tickWanted(wanted, dt, squads.alive().some((h) => FACTIONS[h.fid]?.lawful && h.F.kind !== 'military' && h.los && h.target?.id === 'me'), eye());
		if (isEarth() && wanted.blue) tickDefence(wanted, dt, threatened());
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
			blue: isEarth() && wanted.blue > 0,
		});
	}

	const compass = createCompass({ mount, menu, morality, relations, worldKey: () => worldKey, settings });
	morality.on((e) => { if (e.place && (e.delta.protect + e.delta.mercy) < -15) { const m = morality.remembers(e.place); if (m) hint(m, 4000, 1); } });

	// ---------- for the console and the tests ----------
	const api = {
		// a game controller's trigger (ui/gamepad.js), held as the mouse button is
		trigger: (down) => fireInput('pad', !!down),
		update, reset, heard, group, layer, fx, hud, morality, relations, compass, recovery, contracts, fieldAudio, melee, focus, hooks, squads,
		projectile, blast, firstHit, landShot, ground, eye, sound: (k, at) => sound(k, at), deal: (T, blow, mine) => deal(T, blow, mine), hurtPlayer, wantedLevel: () => wanted.stars, isEarth, zone: () => (W() ? zone() : null),
		// harm done by your vehicle's guns (military/): yours, weighed like a shot
		strikeAs: (T, blow) => deal(T, { ...blow, by: ME }, true),
		call: (text, who) => call(text, who),
		// you, as a shooter (military/drive-mil.js fires as you)
		me: ME,
		perception: p => { const q=p?.M?.S?.pos, e=eye(); let aimedAt=false; if(q && view.state()?.aiming) { camera.getWorldDirection(_v); const dx=q.x-e.x,dz=q.z-e.z,d=Math.hypot(dx,dz); aimedAt=d<15 && d>.1 && (dx*_v.x+dz*_v.z)/d>.86; } return {cleanseTimes:multiplayer?.cleanseTimes?.() || {},standing:morality.reactions(),cleansedAt:morality.info().cleansedAt,nearbyStanding:multiplayer?.nearbyStanding?.(p) || [],...multiplayer?.reputationContext?.(p),events:p?.awarenessEvents || [],bodyKey:W()?.body?.key,aimedAt,wanted:isEarth()?wanted.stars:0,injured:me.H.hp<me.H.max*.45,running:me.speed>3}; },
		vehicleImpact: p => { notice('vehicle-impact',p.M.S.pos,'drove a vehicle into a person'); morality.record({kind:'hurt',target:'a pedestrian struck by your vehicle',world:worldKey,place:placeName(),ctx:{unarmed:true,witnessed:true}}); crime('hitCivilian',p.M.S.pos,true); civilians.alarm(p.M.S.pos.x,p.M.S.pos.z,35,p.M.S.pos.y); },
		// for the law (law/index.js): a crime counted now (seen by an officer, or called in), where
		// you were last seen, whether you hold a weapon, how fast you move, a sight line
		report: (kind, at) => { const s = offend(wanted, kind, true); sighted(wanted, at || eye()); return s; },
		lastSeen: () => wanted.last, sighted: (at) => sighted(wanted, at), armed: () => !!held(), speed: () => me.speed, blocked: (a, b) => blocked(a, b), down: () => me.ko > 0, spotHidden: (a, b) => spotHidden(a, b),
		clearWanted: () => clearWanted(wanted), wantedState: () => ({ stars: wanted.stars, points: wanted.points, peak: wanted.peak, quiet: wanted.quiet, seen: wanted.seen, last: wanted.last, blue: wanted.blue, strikes: wanted.strikes }), populated: (at) => populated(at || eye()),
		// a young person a car would have struck: the Spark's shimmer
		ward: (p) => { const q = p.M.S.pos; fx.ward({ x: q.x, y: q.y + 0.7, z: q.z }, 1, { x: q.x, y: q.y + 0.9, z: q.z }); sound('chime', q); },
		worldKey: () => worldKey, placeName,
		// your PvP flag (the room panel's button): raised, friends with theirs up can fight you
		pvpFlag: () => pvp.flag, setPvpFlag: (on) => setFlag(on), pvpOpen: () => pvpNow(),
		// a medkit's work (gameplay/item-use.js): you, or the hurt near you
		mend: (n) => { const before = me.H.hp; if (me.ko > 0 || me.H.state !== 'ok') return 0; me.H.hp = Math.min(me.H.max, me.H.hp + Math.max(0, n)); return me.H.hp - before; },
		hurt0: () => me.H.max - me.H.hp,
		// a spell of yours for friends in the room to see (magic/index.js: style 7 is a spell)
		sendFx: (a, b, style, impact) => net.fx(a, b, style, impact),
		// your health as it stands (magic/: a death ward, a rewind)
		vitals: () => ({ hp: me.H.hp, max: me.H.max, ko: me.ko > 0, state: me.H.state }),
		// the top of your life (magic/stats.js: Vigour); you keep the share of it you had
		setLifeMax: (n) => {
			n = Math.max(1, Math.round(+n || 100));
			if (n === me.H.max) return n;
			const f = me.H.hp / Math.max(1, me.H.max);
			me.H.max = n;
			if (me.H.state === 'ok') me.H.hp = Math.max(1, Math.min(n, n * f));
			return n;
		},
		woundedNear: (x, z, r) => civilians.woundedNear(x, z, r),
		tend: (p) => civilians.tend(p),
		info: () => ({ me: { hp: Math.round(me.H.hp), max: me.H.max, state: me.H.state, ko: +me.ko.toFixed(1) }, weapon: Wp && { id: Wp.S.id, mag: Wp.mag, reserve: reserve(Wp), mode: modeOf(Wp), reloading: Wp.reloading > 0, dmg: Wp.S.dmg, draw: Wp.draw, drawing: Wp.drawing, shots: Wp.shots, cooldown: Wp.cool }, layer: layer.size, wanted: { stars: wanted.stars, points: Math.round(wanted.points), blue: wanted.blue, strikes: wanted.strikes }, attacks: { play: Math.round(playT), last: Math.round(lastAttackT) }, zone: W() ? zone() : null, squads: squads.info(), civilians: civilians.info(), props: props.info(), cars: cars.info(), fires: [...fireField.fires.values()].map((F) => ({ id: F.id, heat: +F.heat.toFixed(2), chain: F.chain })), burnt: fireField.burnt.size, bosses: [...bosses.values()].map((B0) => B0.info()), projectiles: projectiles.length, rules: { ...rules }, pvp: { flag: pvp.flag, server: pvp.server, open: pvpNow() }, ambient: settings.ambient, morality: morality.info(worldKey), journal: journal.slice(-5) }),
		// Crysis.combat.spawn('ashfang', 3, { raid }) / ('rogue') / ('gloom') / ('patrol') / ('fire')
		spawn: (fid = 'ashfang', n = 3, o = {}) => { const s = spotAhead(o.d ?? 25, (o.d ?? 25) + 10) || { x: eye().x + 20, z: eye().z }; return squads.squad(fid, s.x, s.z, n, o).then((sq) => sq.id); },
		fight: (a = 'ashfang', b = 'dunecutters', n = 3, d = 30) => { const s = spotAhead(d, d + 5); if (!s) return null; squads.squad(a, s.x - 8, s.z, n, {}); squads.squad(b, s.x + 8, s.z + 3, n, {}); return 'fight'; },
		raid: () => { const vf = W()?.village?.footprints?.find((f) => !f.fence); if (!vf) return 'no village here'; const a = Math.random() * 6.283; squads.squad('ashfang', vf.x + Math.cos(a) * 45, vf.z + Math.sin(a) * 45, 4, { raid: true, dest: { x: vf.x, z: vf.z } }); squads.squad('hearthguard', vf.x, vf.z, 3, {}); return 'raid'; },
		boss: (kind = 'leviathan') => spawnBoss(kind)?.info() || 'unknown boss',
		// Crysis.combat.creature('fog-wight', 1, 14): one of the creatures ahead (creatures/catalog.js)
		creature: (id = 'fog-wight', n = 1, d = 14) => creatureAhead(id, n, d),
		// for checks: the first boss's fight run on for s seconds without drawing, its states as they
		// change and your health with them (headless frames are far too slow to watch a fight)
		bossStep: (sec = 1, dt = 0.05) => {
			const B0 = [...bosses.values()][0];
			if (!B0) return null;
			const log = [];
			let was = '';
			for (let t = 0; t < sec; t += dt) {
				B0.update(dt);
				const i = B0.info(), k = `${i.phase}:${i.state}:${i.attack || ''}`;
				if (k !== was) { was = k; log.push({ t: +t.toFixed(2), phase: i.phase, state: i.state, attack: i.attack, me: Math.round(me.H.hp) }); }
			}
			return { log, info: B0.info(), me: Math.round(me.H.hp), slam: B0.lastSlam || null, burst: B0.lastBurst || null };
		},
		bossHit: (part = 'body', n = 500) => { const B0 = [...bosses.values()][0]; return B0 ? (B0.damage({ amount: n, part }), B0.info()) : null; },
		camp: () => { const s = spotAhead(20, 25); if (s) props.camp(s.x, s.z, 'camp', (x, z) => ground(x, z, s.y + 2)); return props.info(); },
		fronts: () => { props.fronts(boxesNear(eye().x, eye().z, 40), eye(), (x, z) => ground(x, z), 'fronts'); return props.info(); },
		// a fire set by something else (cataclysm/: a quake's gas main, a wildfire reaching a house):
		// the nearest building or car to (x, z) within r, not yours; its id, or null
		igniteAt: (x, z, r = 12) => { const n = neighbours(x, z, r).filter((q) => q.box || q.id.startsWith('car:')).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]; return n && ignite(n.id, n.x, n.z, n.fuel, false, n.box) ? n.id : null; },
		firesNear: (x, z, r = 60) => { const out = []; for (const F of fireField.fires.values()) if (Math.hypot(F.x - x, F.z - z) <= r) out.push({ id: F.id, x: F.x, z: F.z, heat: F.heat }); return out; },
		douse: (id, k) => fireField.douse(id, k),
		ignite: (what = 'nearest') => { const n = neighbours(eye().x, eye().z, 40).sort((a, b) => Math.hypot(a.x - eye().x, a.z - eye().z) - Math.hypot(b.x - eye().x, b.z - eye().z)); const t = what === 'nearest' ? n[0] : n.find((q) => q.id.startsWith(what)); return t ? ignite(t.id, t.x, t.z, t.fuel, true, t.box) && t.id : null; },
		hurt: (n = 20) => { hurtPlayer({ amount: n, type: 'ballistic', part: 'torso', src: { x: eye().x + 5, y: eye().y, z: eye().z } }); return me.H.hp; },
		heal: () => { revive(me.H, 1); return me.H.hp; },
		wanted: (stars) => { if (stars !== undefined) { wanted.points = [0, 10, 35, 70, 120, 190][stars] || 0; wanted.stars = stars; } return wanted.stars; },
		ammo: (n = 200) => { const w = weaponNow(); if (w) { ammo.loose[w.S.id] = n; saveAmmo(); } return w && reserve(w); },
		ambient: (on) => { if (on !== undefined) { settings.ambient = !!on; settings.save(); } return settings.ambient; },
		// a shot fired from the eye along the view, for the tests: what it struck
		shoot: (dmg = 30) => { camera.getWorldDirection(_v); const o = camera.position.clone(), d = _v.clone(); const h = firstHit(o, d, 300); const end = h ? o.clone().addScaledVector(d, h.t) : o.clone().addScaledVector(d, 300); fx.tracer(o.clone().add(new THREE.Vector3(0, -0.15, 0)), end, 0); const r = h ? landShot(h, o, d, ME, dmg) : null; return h ? { id: h.T?.id || 'wall', kind: h.T?.kind || h.surface, part: h.part || null, ward: !!h.ward, t: +h.t.toFixed(2), res: r && { dealt: +(r.dealt || 0).toFixed(1), killed: !!r.killed, ward: !!r.ward } } : null; },
		aimAt: (id) => { const T = layer.get(id); if (!T) return false; const p = P(), e = eye(); const dx = T.bound.x - e.x, dz = T.bound.z - e.z, dy = T.bound.y + 0.3 - e.y; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); _e.set(p.pitch, p.yaw, 0); camera.quaternion.setFromEuler(_e); return true; },
		targets: () => [...layer.map.values()].map((T) => ({ id: T.id, kind: T.kind, faction: T.faction, child: !!T.child, d: Math.round(Math.hypot(T.bound.x - eye().x, T.bound.z - eye().z)) })),
		compassOpen: (on = true) => compass.toggle(on),
		// for the tests: a weapon in hand (owned and held)
		arm: (id = 'warden-spark-carbine', l = 5, t = 2) => { const u = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20); arms?.apply?.({ id: `give-${u}`, kind: 'trade', peer: 'test', give: { credits: 0, items: [] }, get: { credits: 0, items: [{ u, i: id, l, t, x: 0 }] } }); arms?.hold?.(u); return arms?.held?.(); },
		clear: () => { contracts.clear(); squads.clear(); recovery.clear(); fieldAudio.clear(); props.clearTag(); for (const B0 of bosses.values()) B0.dispose(); bosses.clear(); return 'cleared'; },
		lore: 'The young carry the Spark until they come of age: no harm reaches them. Bullets turn aside in a shimmer, fire and wheels part round them.',
	};
	return api;
}
