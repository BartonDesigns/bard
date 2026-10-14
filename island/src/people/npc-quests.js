// Quests people do for each other, with or without you (the rules in npc-quests-core.js).
// Near you they play out where you can see them: a bag set down and forgotten on the
// sidewalk, noticed by whoever passes; a favour you turned down taken up by someone else; a
// business's errand walked by one of the people about. Each walks the quest's steps with
// the thing in hand, and how it ends is their own disposition's: handed back with thanks
// and a little money, or pocketed and off down the street. A theft you see is yours to
// answer (errands.js theft): let them go, take it off them, give it back or keep it.
//
// Far from you the same quests resolve in a single tick among the region's residents, so
// the region's tally and its people's standing move while you are elsewhere (and for the
// time you were away, a little, when you come back). Everything is cheap: one bag at a
// time, one or two scenes, a look round every second or two.
//
// Money goes through people/npc-money.js (the bank's adapter): rewards from the giver's
// pocket, loot to the thief, and a balance that makes the hard-up more tempted.
//
// It runs wherever the shared people pool has people (people/people.js): the Bay's towns,
// the globe's towns, the island village, other worlds' settlements; the region is worked
// out for each (people/moral-regions.js). Anyone in the pool knocked down (a thief brought
// down, a fight, a car) is told to onHurt listeners, so a hospital can come for them.

import * as THREE from 'three';
import { favourProp } from './favour-props.js';
import { disposition, temperOf } from './disposition.js';
import { createSources, favourQuest, bagQuest, decide, settle, farQuest, playFar, residentSeed, sceneLine } from './npc-quests-core.js';
import { bayRegionOf, globeRegionOf, globeCell, situationOf } from './moral-regions.js';
import { lineFor } from './errands-core.js';
import { toLatLon } from '../bay/geo.js';
import { zoneOf } from './flow.js';
import { regionalNow } from '../region/here.js';
import { createPlaces, restOn, standAt } from './bag-spots.js';
import { citiesNear } from '../earth/atlas.js';

const NOTICE = 7, OWNER_BACK = 45, VISIBLE = 95, REACH = 1.4, STEP_MAX = 45, MEMORY = 600;

export function createNpcQuests({ scene, camera, world, people, chatter, persona, errands = () => null, commons, money, isPhone = false, worldKey = () => 'here', placeName = () => '', places = null }) {
	const FAR_EVERY = isPhone ? 40 : 25, SCENES = isPhone ? 1 : 2, BAG_EVERY = isPhone ? [150, 240] : [70, 140], FAVOUR_EVERY = isPhone ? [150, 260] : [80, 160];
	const sources = createSources();
	// the benches, shelters, park seats, cafe tables and doorsteps about (people/bag-spots.js)
	const spots = places || createPlaces({ world });
	const scenes = [], memory = new Map(), cache = new Map(), considered = new Map(), open = [], pending = [];
	const taken = new Set(), hurtFns = [], downed = new WeakSet();
	let clock = 0, farT = 8, lookT = 0, saveT = 15, whereT = 0, farN = 0, n = 0, bag = null;
	const span = ([a, b]) => a + Math.random() * (b - a);
	let bagT = span(BAG_EVERY) * 0.4, favT = span(FAVOUR_EVERY) * 0.5;
	let here = { region: { id: 'here', name: 'here' }, situation: situationOf({}), town: null };
	const cellNames = new Map();

	// ---------- who and where ----------
	const pos = (p) => p.M.S.pos;
	const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
	const cam = () => camera.position;
	const idOf = (p) => `npc:${p.P.dna.seed >>> 0}`;
	const nameOf = (p) => { try { return persona(p)?.first || ''; } catch { return ''; } };
	// grown-ups only: children and teens are never thieves, victims or go-betweens here
	const adult = (p) => !!p && p.active && !p.leaving && !p.P?.ragdoll && !p.P?.dna?.child && !p.P?.dna?.minor && !p.P?.dna?.teen;
	const free = (p) => adult(p) && !p.engaged && !p.override && !p.held && p.demo === undefined && !p.workSpot && p.role !== 'jog' && p.route?.kind !== 'seat' && p.route?.kind !== 'follow';

	function whereNow() {
		const W = world(), c = cam(), H = regionalNow();
		if (H) {
			const { cy, cx } = globeCell(H.lat, H.lon), ck = `${H.regionId}#${cy}.${cx}`;
			let cities = cellNames.get(ck);
			if (!cities) { try { cities = citiesNear(H.lat, H.lon, 160, 80); } catch { cities = []; } if (cities.length) cellNames.set(ck, cities); }
			const R = globeRegionOf({ regionId: H.regionId, regionName: H.regionName, lat: H.lat, lon: H.lon, cities });
			return { region: R, situation: situationOf({ name: H.town?.name || R.name, cls: Math.min(5, H.town?.pop ?? 1), zone: (H.town?.pop ?? 0) >= 3 ? 'downtown' : 'neighbourhood' }), town: H.town?.name || R.town };
		}
		// (the island's village, not the whole heightfield the Bay is laid on)
		const key = worldKey(), v = W?.island?.village, onIsland = !!v && Math.hypot(c.x - v.x, c.z - v.z) < 2000;
		if (W?.bayArea && !onIsland) {
			const { lat, lon } = toLatLon(c.x, c.z), R = bayRegionOf(lat, lon);
			let U = null; try { U = W.bayArea.urbanAt?.(c.x, c.z); } catch { /* not loaded */ }
			return { region: { id: R.id, name: R.name, code: R.code }, situation: situationOf({ name: R.town?.name, pop: R.town?.pop || 0, zone: zoneOf(U) }), town: R.town?.name || null };
		}
		if (onIsland) return { region: { id: `${key}:island`, name: 'the island' }, situation: situationOf({ name: `${key}:island`, zone: 'island' }), town: null };
		return { region: { id: `world:${key}`, name: placeName() || key }, situation: situationOf({ name: key }), town: null };
	}
	const regionNow = () => here.region;

	// someone's disposition, leaned on by their region, the world, their town, their deeds, their pocket
	function dispoOf(seed, id = `npc:${seed >>> 0}`, region = here.region.id) {
		const k = id + '|' + region, c = cache.get(k);
		if (c && clock - c.t < 8) return c.d;
		const d = disposition(seed >>> 0, { region: commons.region(region), world: commons.world(worldKey()), situation: region === here.region.id ? here.situation : null, standing: commons.known(id) ? commons.actor(id) : null, wealth: money.wealth(id) });
		if (cache.size > 300) cache.clear();
		cache.set(k, { d, t: clock });
		return d;
	}
	const regionNames = new Map();
	const ctx = (name, region = here.region.id) => ({ money, commons, world: worldKey(), place: region === here.region.id ? placeName() : '', regionName: regionNames.get(region) || commons.region(region).name || region, name });
	function remember(p, kind) { if (p?.P?.dna) memory.set(p.P.dna.seed >>> 0, { kind, t: clock }); if (memory.size > 200) memory.delete(memory.keys().next().value); }
	function witnesses(at, kind, except = []) { for (const q of people.pool) if (adult(q) && !except.includes(q) && flat(pos(q), at) < 15) remember(q, kind); }
	function say(p, text, gesture = 'nod', feel = {}) { if (text && p?.active && flat(pos(p), cam()) < 30) chatter.say(p, { text, gesture, feel }, null); }

	// someone knocked down: { npcId, name, at, why, region, child, inQuest }
	function hurt(p, why = 'knocked down') {
		if (!p?.P?.dna) return null;
		const S = pos(p), e = { npcId: idOf(p), name: nameOf(p), at: { x: S.x, y: S.y, z: S.z }, why, region: here.region.id, child: !!p.P.dna.child, inQuest: scenes.some((R) => R.p === p) };
		for (const f of hurtFns) { try { f(e, p); } catch { /* a listener gone */ } }
		return e;
	}
	function watchHurt() {
		for (const p of people.pool) {
			if (!p.active || !p.P) continue;
			if (p.P.ragdoll && !downed.has(p.P)) { downed.add(p.P); hurt(p, scenes.some((R) => R.p === p) ? 'brought down during a quest' : 'knocked down'); }
			else if (!p.P.ragdoll && downed.has(p.P)) downed.delete(p.P);
		}
	}

	// ---------- holding people in a scene ----------
	function steer(p, fn) { const mine = (q, dt, c) => fn(q, dt, c); mine.npcq = true; p.held = true; p.override = mine; p.heldBy = mine; }
	function letGo(p) { if (!p?.heldBy?.npcq) return; if (p.override === p.heldBy) p.override = null; p.held = false; p.heldBy = null; }
	// kept in the world without being stopped (an owner walking on, unaware)
	function keep(p) { if (p && !p.held) { p.held = true; p.keptBy = 'npcq'; } }
	function unkeep(p) { if (p?.keptBy === 'npcq') { if (!p.heldBy) p.held = false; p.keptBy = null; } }
	function standStill(p, face) {
		steer(p, (q) => { const S = q.M.S, f = typeof face === 'function' ? face() : face; q.M.want.speed = 0; if (f) q.M.want.heading = Math.atan2(f.x - S.pos.x, f.z - S.pos.z); q.M.setPose?.(q.idlePose || 'rest'); return true; });
	}

	// ---------- props: on the ground, and in the hand ----------
	function propFor(shape) {
		if (!shape) return null;
		const f = favourProp(shape), g = new THREE.Group(), m = new THREE.Mesh(f.geo, f.mat);
		m.castShadow = true; g.add(m); g.userData.lift = f.lift; scene.add(g);
		return g;
	}
	const dropProp = (g) => { g?.removeFromParent(); };
	function onGround(g, at) { g.children[0].position.y = g.userData.lift; g.position.set(at.x, at.y + 0.005, at.z); }
	function inHand(g, p) {
		const S = p.M.S, h = S.heading || 0;
		g.children[0].position.y = 0;
		g.position.set(S.pos.x + Math.cos(h) * 0.26, S.pos.y + 0.8, S.pos.z - Math.sin(h) * 0.26);
		g.rotation.y = h;
	}

	// ---------- a scene: someone walking a quest's steps ----------
	function targetOf(s) { const w = s?.at?.who; return w && w.active ? pos(w) : s?.at && Number.isFinite(s.at.x) ? s.at : null; }
	function start(q, p, d, outcome, extra = {}) {
		const R = { q, p, d, outcome, i: 0, t: 0, stepT: 0, phase: 'step', prop: null, still: [], settled: null, id: idOf(p), name: nameOf(p), ...extra };
		taken.add(q.id);
		drive(R);
		scenes.push(R);
		return R;
	}
	// their feet: to the step's place, stopped while they pause, off and away with it when they keep it
	function drive(R) {
		const q = R.q, speed = Math.max(1, (R.p.P.dna.gait?.pace || 1.3) * R.d.pace);
		steer(R.p, (who) => {
			const S = who.M.S;
			if (R.phase === 'flee') { const f = R.fleeFrom || cam(); who.M.want.heading = Math.atan2(S.pos.x - f.x, S.pos.z - f.z); who.M.want.speed = speed * 1.6; who.M.want.run = 0; return true; }
			const T = R.phase === 'step' ? targetOf(q.steps[R.i]) : null;
			if (!T || flat(S.pos, T) < REACH * 0.8) { who.M.want.speed = 0; if (R.face) who.M.want.heading = Math.atan2(R.face.x - S.pos.x, R.face.z - S.pos.z); return true; }
			const chase = q.steps[R.i].do === 'chase';
			who.M.want.heading = Math.atan2(T.x - S.pos.x, T.z - S.pos.z); who.M.want.speed = chase ? Math.max(3, speed * 2) : speed; who.M.want.run = chase ? 1 : 0; S.look.target = null;
			return true;
		});
	}
	function pause(R, s, face) { R.phase = 'pause'; R.stepT = 0; R.pauseFor = s; R.face = face || null; }
	function next(R) {
		R.i++; R.stepT = 0; R.phase = 'step'; R.face = null;
		// the unreliable drift off halfway, leaving it be
		if (R.outcome === 'abandon' && R.i >= Math.ceil(R.q.steps.length / 2)) return end(R, 'abandon');
		if (R.i >= R.q.steps.length) end(R, R.own ? 'own' : 'done');
	}
	function arrive(R) {
		const s = R.q.steps[R.i], T = targetOf(s), w = s.at?.who;
		if (s.do === 'go' || s.do === 'chase') return next(R);
		if (s.do === 'pickup') {
			if (R.ground) { dropProp(R.ground.prop); R.ground.prop = null; R.ground.phase = 'taken'; }
			R.prop = propFor(s.item?.shape || R.q.item?.shape);
			if (R.outcome === 'betray') return betray(R);
			if (R.own) say(R.p, sceneLine('back', n++), 'nod', { joy: 0.4 });
			// a bag's owner is called back, and waits
			const ow = R.q.kind === 'bag' && !R.own ? R.q.steps.findLast((x) => x.do === 'deliver')?.at?.who : null;
			if (ow && ow.active && ow !== R.p && !ow.heldBy) { standStill(ow, () => pos(R.p)); R.still.push(ow); say(R.p, sceneLine('call', n++), 'wave', { surprise: 0.2 }); }
			// a favour's giver hands it over and waits
			if (w && w !== R.p) say(w, R.q.kind === 'favour.pass' ? 'Thank you, really.' : '', 'nod', { joy: 0.4 });
			return pause(R, 0.8, T);
		}
		if (s.do === 'deliver' || s.do === 'talk') {
			if (w && w.active && w !== R.p) {
				if (!w.heldBy) { standStill(w, () => pos(R.p)); R.still.push(w); }
				const bagBack = R.q.kind === 'bag';
				say(R.p, bagBack ? sceneLine('hand', n++) : sceneLine(s.do === 'talk' ? 'fixed' : 'deliver', n++), 'open', { joy: 0.4 });
				// (their answer a moment later)
				R.reply = { p: w, at: 1.6, text: bagBack ? sceneLine('thank', n++) : lineFor(R.q.kind === 'favour.pass' ? 'passed' : R.q.kind === 'favour.catch' ? 'caught' : R.q.kind === 'favour.repair' ? 'fixed' : 'returned', { kind: R.q.kind.slice(7), item: { ...R.q.item, the: `the ${R.q.item?.name || 'thing'}` }, friend: R.q.giver.name, n: n++ }) };
			}
			if (R.prop) { dropProp(R.prop); R.prop = null; }
			return pause(R, 3, T);
		}
		if (s.do === 'wait') return pause(R, 3, T);
		if (s.do === 'fix') { R.p.M.setPose?.('rest'); return pause(R, 4, T); }
		next(R);
	}
	// took it and went: the bad deed now, and you may answer it
	function betray(R) {
		const q = R.q;
		R.settled = settle(q, 'betray', { ...ctx(R.name, q.region), actorId: R.id });
		remember(R.p, 'stole');
		const owner = q.steps.findLast((s) => s.do === 'deliver')?.at, ob = owner?.who;
		witnesses(pos(R.p), 'saw-theft', [R.p]);
		if (ob && adult(ob)) { remember(ob, 'robbed'); unkeep(ob); }
		const E = errands();
		const near = flat(pos(R.p), cam()) < 60;
		if (near && E?.theft && !E.busy?.()) {
			letGo(R.p);
			const victim = ob && adult(ob) && !ob.held && flat(pos(ob), pos(R.p)) < 80 ? ob : null;
			const home = victim ? null : { x: owner?.x ?? q.giver.x, z: owner?.z ?? q.giver.z };
			const ok = E.theft({ victim, home, owner: q.giver.name || 'the owner', thief: R.p, item: q.item || { name: 'bag', shape: 'bag' }, speed: 2.4,
				onDrop: () => { dropProp(R.prop); R.prop = null; },
				onEnd: () => { dropProp(R.prop); R.prop = null; R.phase = 'over'; } });
			if (ok) { R.phase = 'handed'; end(R, 'handed'); return; }
			drive(R);
		}
		if (ob) say(ob, sceneLine('cry', n++), 'point', { surprise: 1, anger: 0.6 });
		R.phase = 'flee'; R.stepT = 0; R.fleeFrom = ob?.active ? pos(ob) : targetOf(q.steps[0]) || cam();
	}
	// over: settle what is not settled yet, let everyone go
	function end(R, how) {
		if (R.ended) return;
		R.ended = true;
		const q = R.q;
		if (how === 'own') remember(R.p, 'got-back');
		else if (how === 'done') {
			R.settled = settle(q, 'done', { ...ctx(R.name, q.region), actorId: R.id });
			remember(R.p, 'returned');
			const w = q.steps.findLast((s) => s.do === 'deliver' || s.do === 'talk')?.at?.who;
			if (w) remember(w, q.kind === 'bag' ? 'got-back' : 'helped');
			witnesses(pos(R.p), 'saw-return', [R.p, w]);
			sources.complete(q, R.id, 'done');
		} else if (how === 'far' && !R.settled) {
			// out of sight: it ends the way it was going to
			R.settled = R.outcome === 'abandon' ? { outcome: 'abandon' } : settle(q, R.outcome, { ...ctx(R.name, q.region), actorId: R.id });
			sources.complete(q, R.id, R.outcome);
		} else if (how === 'abandon') sources.complete(q, R.id, 'abandon');
		else if (R.settled && !R.completed) sources.complete(q, R.id, 'betray');
		R.completed = true;
		if (R.phase !== 'handed') letGo(R.p);
		for (const w of R.still) letGo(w);
		for (const s of q.steps) unkeep(s.at?.who);
		if (R.phase !== 'handed') { dropProp(R.prop); R.prop = null; }
		taken.delete(q.id);
		if (R.ground && bag === R.ground) clearBag();
		R.phase = R.phase === 'handed' ? 'handed' : 'over';
	}
	function sceneUpdate(R, dt) {
		R.t += dt; R.stepT += dt;
		if (R.phase === 'handed') { if (R.prop && R.p.active) inHand(R.prop, R.p); else { dropProp(R.prop); R.prop = null; } if (!R.prop || R.t > 120) R.phase = 'over'; return; }
		if (R.phase === 'over') return;
		const p = R.p;
		if (!p.active || p.P?.ragdoll || (p.heldBy && !p.heldBy.npcq)) return end(R, 'far');
		if (R.prop) inHand(R.prop, p);
		if (flat(pos(p), cam()) > VISIBLE) return end(R, 'far');
		if (R.phase === 'flee') { if (R.stepT > 20) end(R, 'gone'); return; }
		if (R.phase === 'pause') {
			if (R.reply && R.stepT >= R.reply.at) { say(R.reply.p, R.reply.text, 'wave', { joy: 1 }); R.reply = null; }
			if (R.stepT > R.pauseFor) next(R);
			return;
		}
		const s = R.q.steps[R.i], T = targetOf(s);
		if (!T || R.stepT > STEP_MAX) return end(R, 'far');
		if (flat(pos(p), T) < (s.do === 'chase' ? 1.8 : REACH)) arrive(R);
	}

	// ---------- a bag left alone ----------
	function clearBag() { if (!bag) return; dropProp(bag.prop); if (bag.walk && bag.owner?.heldBy === bag.walk) letGo(bag.owner); unkeep(bag.owner); bag = null; }
	// someone sets their bag down: on a bench, at a shelter, on a cafe table or a doorstep, in a
	// park (people/bag-spots.js); on the sidewalk when there is nothing like that about. They
	// walk to it with the bag in hand, set it down, and walk on without it.
	const SEAT_UP = { bench: 0.48, park: 0.48, picnic: 0.76 };
	function spawnBag({ force = false } = {}) {
		if (bag) return 'a bag is already out';
		const c = cam();
		let spot = null;
		try { spot = spots.pick(c.x, c.z, { min: force ? 3 : 12, max: 50 }); } catch { /* nothing built here */ }
		const walkers = people.pool.filter((p) => free(p) && p.role === 'walk' && flat(pos(p), c) > (force ? 3 : 8) && flat(pos(p), c) < 70);
		const owners = spot ? walkers.filter((p) => flat(pos(p), spot) < (force ? 70 : 35)).sort((a, b) => flat(pos(a), spot) - flat(pos(b), spot)) : [];
		if (!owners.length) return sidewalkBag(force);
		const owner = owners[0], o = pos(owner);
		const at = restOn(spot), stand = standAt(spot), via = spot.door ? [spot.door.outside, spot.door.inside] : [];
		const q = bagQuest({ owner: { id: idOf(owner), name: nameOf(owner), x: o.x, z: o.z, ref: owner }, at, region: here.region.id, where: spot, via, cash: 15 + (owner.P.dna.seed % 45) });
		q.steps.at(-1).at.who = owner;
		bag = { q, owner, at, prop: propFor('bag'), t: 0, seen: new Set(), phase: 'arriving', spot, path: [...via, stand], out: via.slice().reverse(), k: 0, walk: null };
		// (the console's bag: set down at once, its owner beside it)
		if (force) {
			const y = spot.kind === 'table' ? at.y - (spot.h ?? 0.46) : at.y - (SEAT_UP[spot.kind] || 0);
			owner.M.place?.(stand.x, y, stand.z, spot.heading || 0);
			bag.k = bag.path.length;
			setDown(bag);
		} else walkTo(bag);
		return q.title;
	}
	// (with nothing to set it on: dropped beside them as they walk)
	function sidewalkBag(force) {
		const c = cam(), owners = people.pool.filter((p) => free(p) && p.role === 'walk' && flat(pos(p), c) > (force ? 3 : 12) && flat(pos(p), c) < 50);
		if (!owners.length) return 'nobody about to leave one';
		const owner = owners[Math.floor(Math.random() * owners.length)], o = pos(owner), h = owner.M.S.heading || 0;
		const at = { x: o.x - Math.sin(h) * 0.7, y: o.y, z: o.z - Math.cos(h) * 0.7 };
		const q = bagQuest({ owner: { id: idOf(owner), name: nameOf(owner), x: o.x, z: o.z, ref: owner }, at, region: here.region.id, where: 'sidewalk', cash: 15 + (owner.P.dna.seed % 45) });
		q.steps.at(-1).at.who = owner;
		const prop = propFor('bag'); onGround(prop, at);
		keep(owner);
		bag = { q, owner, at, prop, t: 0, seen: new Set(), phase: 'left', spot: { kind: 'sidewalk' }, path: [], out: [], k: 0, walk: null };
		return q.title;
	}
	// the owner on their way to the spot (through the door, for a table inside) and back out
	function walkTo(B) {
		const speed = Math.max(1, B.owner.P.dna.gait?.pace || 1.3);
		B.walk = (who) => {
			const S = who.M.S, T = B.path[B.k] || B.out[B.k - B.path.length];
			if (!T || B.phase === 'setting') { who.M.want.speed = 0; return true; }
			who.M.want.heading = Math.atan2(T.x - S.pos.x, T.z - S.pos.z); who.M.want.speed = speed;
			return true;
		};
		B.walk.npcq = true;
		B.owner.held = true; B.owner.override = B.walk; B.owner.heldBy = B.walk;
	}
	function setDown(B) {
		onGround(B.prop, B.at);
		B.phase = 'left'; B.t = 0;
		// out of the cafe first, if that is where they left it; then on their way, unaware
		if (B.out.length) { if (!B.walk) walkTo(B); B.leaving = true; }
		else { if (B.walk && B.owner.heldBy === B.walk) letGo(B.owner); keep(B.owner); }
	}
	function bagWalk(dt) {
		const B = bag, o = B.owner;
		if (B.phase === 'arriving' || B.phase === 'setting') {
			if (!o.active || o.P?.ragdoll || o.override !== B.walk) { clearBag(); return; }
			inHand(B.prop, o);
			if (B.phase === 'setting') { if ((B.setT -= dt) <= 0) setDown(B); return; }
			const T = B.path[B.k];
			if (T && flat(pos(o), T) < REACH) B.k++;
			if (B.k >= B.path.length) { B.phase = 'setting'; B.setT = 1.6; o.M.setPose?.('rest'); }
			else if (B.t > 40) clearBag();
			return;
		}
		if (!B.leaving) return;
		if (!o.active || o.override !== B.walk) { B.leaving = false; return; }
		const T = B.out[B.k - B.path.length];
		if (T && flat(pos(o), T) < REACH) B.k++;
		if (B.k >= B.path.length + B.out.length || B.t > 30) { B.leaving = false; letGo(o); keep(o); }
	}
	function bagLook(force = null) {
		const B = bag;
		if (B.phase !== 'left') return;
		const c = cam();
		// you walked away: it ends the way it would have, among the people still there
		if (flat(B.at, c) > VISIBLE) { const r = playFar(B.q, { dispoOf, ...ctx('', B.q.region) }); if (r.taker) remember(B.owner, r.outcome === 'betray' ? 'robbed' : 'got-back'); clearBag(); return; }
		// (the console's forced bag takes anyone standing about, not only those walking by)
		const can = force ? (p) => adult(p) && !p.engaged && !p.override && !p.held && p.route?.kind !== 'seat' && p.route?.kind !== 'follow' : free;
		const reach = force ? 40 : B.spot?.kind === 'table' || B.spot?.kind === 'doorstep' ? NOTICE + 2 : NOTICE;
		const near = people.pool.filter((p) => can(p) && p !== B.owner && !B.seen.has(p) && flat(pos(p), B.at) < reach).sort((a, b) => flat(pos(a), B.at) - flat(pos(b), B.at));
		for (const p of near) {
			B.seen.add(p);
			const d = dispoOf(p.P.dna.seed);
			const choice = force ? { take: true, outcome: force === 'steal' ? 'betray' : 'done' } : decide(d, B.q);
			if (!choice.take) continue;
			if (force) { const h = Math.random() * 6.28, st = B.spot && B.spot.kind !== 'sidewalk' ? standAt(B.spot) : B.at; p.M.place?.(st.x + Math.cos(h) * 1.6, pos(p).y, st.z + Math.sin(h) * 1.6, h); }
			start(B.q, p, d, choice.outcome, { ground: B });
			B.phase = 'taken';
			return;
		}
		// nobody bothered: the owner remembers and comes back for it
		if (B.t > OWNER_BACK) {
			const o = B.owner;
			if (o.active && !o.heldBy && !o.override) {
				unkeep(o);
				B.phase = 'taken';
				const go = (p) => ({ do: 'go', at: { x: p.x, z: p.z } });
				const back = { ...B.q, kind: 'bag.own', steps: [...B.out.slice().reverse().map(go), { do: 'pickup', at: { x: B.at.x, z: B.at.z }, item: B.q.item }, ...B.out.map(go)], deeds: { done: 'favour' } };
				say(o, sceneLine('gone', n++), 'open', { surprise: 0.6 });
				const R = start(back, o, dispoOf(o.P.dna.seed), 'own', { ground: B });
				R.own = true;
			} else clearBag();
		}
	}

	// ---------- favours among the people about (the favours source) ----------
	// open favours stand here until someone takes them (or a minute goes by)
	const favours = {
		id: 'favours',
		near: (x, z, r) => open.filter((F) => clock < F.until && Math.hypot(F.q.giver.x - x, F.q.giver.z - z) < r).map((F) => F.q),
		take: (id) => { const F = open.find((f) => f.q.id === id); if (!F) return false; F.taken = true; return true; },
		complete: (id) => { const i = open.findIndex((f) => f.q.id === id); if (i >= 0) { const F = open[i]; letGo(F.giver); unkeep(F.giver); letGo(F.friend); unkeep(F.friend); open.splice(i, 1); } },
	};
	sources.add(favours);
	function openFavour(kind, giver, { friend = null, drop = null, car = null, item = null } = {}) {
		if (!giver || !adult(giver)) return null;
		const g = pos(giver), who = (p) => p && { id: idOf(p), name: nameOf(p), x: pos(p).x, z: pos(p).z, ref: p };
		const q = favourQuest(kind, { giver: who(giver), friend: who(friend), drop: drop && { ...drop }, car: car && { ...car, name: 'their car' }, region: here.region.id, seed: giver.P.dna.seed, n: n++, item });
		if (!q) return null;
		q.id = `${q.id}:${giver.P.dna.seed}:${n}`;
		// the giver waits where they are; a friend to be caught walks on, kept in the world
		if (!giver.held) standStill(giver, () => { const R = scenes.find((s) => s.q.id === q.id); return R ? pos(R.p) : null; });
		if (friend) { if (kind === 'pass' && !friend.held) standStill(friend, null); else keep(friend); }
		open.push({ q, giver, friend, until: clock + 60, x: g.x, z: g.z });
		return q;
	}
	function spawnFavour() {
		const c = cam(), pool = people.pool.filter(free);
		const giver = pool.find((p) => flat(pos(p), c) > 15 && flat(pos(p), c) < 60);
		if (!giver) return 'nobody about to ask';
		const g = pos(giver), others = pool.filter((p) => p !== giver);
		const kinds = ['lost'];
		const friend = others.find((p) => flat(pos(p), g) > 10 && flat(pos(p), g) < 40);
		if (friend) kinds.push('pass', friend.role === 'walk' ? 'catch' : 'pass');
		let car = null;
		try { car = (world()?.street?.parkedNear?.(g.x, g.z, 25) || []).find((k) => k.id && !String(k.id).startsWith('tr')); } catch { /* no street */ }
		if (car) kinds.push('repair');
		const kind = kinds[Math.floor(Math.random() * kinds.length)];
		const a = Math.random() * 6.28, drop = { x: g.x + Math.cos(a) * 8, y: g.y, z: g.z + Math.sin(a) * 8 };
		const q = openFavour(kind, giver, { friend: kind === 'pass' || kind === 'catch' ? friend : null, drop, car: car && { x: car.x, z: car.z } });
		return q ? q.title : 'no favour';
	}
	// a favour you turned down (errands.js): someone else about may take it up
	function handoff(E) {
		if (!E?.giver || !['lost', 'catch', 'pass', 'repair'].includes(E.kind)) return;
		pending.push({ at: clock + 1.2, E });
	}
	function fromHandoff(E) {
		if (!adult(E.giver) || E.giver.held) return;
		const friend = E.friendP && adult(E.friendP) && !E.friendP.held ? E.friendP : null;
		if ((E.kind === 'pass' || E.kind === 'catch') && !friend) return;
		const item = E.kind === 'lost' && E.item ? { name: E.item.name, shape: E.item.shape || E.item.id, cash: E.item.cash || 0 } : null;
		openFavour(E.kind, E.giver, { friend, drop: E.drop, car: E.car, item });
	}

	// ---------- matching open quests (every source) with the people near them ----------
	function match() {
		if (scenes.filter((R) => R.phase !== 'over' && R.phase !== 'handed').length >= SCENES) return;
		const c = cam();
		for (const q of sources.near(c.x, c.z, 90)) {
			if (taken.has(q.id)) continue;
			const T = targetOf(q.steps[0]);
			if (!T || flat(T, c) > 75) continue;
			const seen = considered.get(q.id) || new Set();
			considered.set(q.id, seen);
			if (seen.size >= 4) continue;
			const near = people.pool.filter((p) => free(p) && !seen.has(p) && !q.steps.some((s) => s.at?.who === p) && flat(pos(p), T) < 25);
			for (const p of near) {
				seen.add(p);
				const d = dispoOf(p.P.dna.seed), ch = decide(d, q);
				if (!ch.take || !sources.take(q, idOf(p))) continue;
				start(q, p, d, ch.outcome);
				return;
			}
		}
		if (considered.size > 60) considered.clear();
	}

	// ---------- far away ----------
	function farEvent(region) {
		const q = farQuest(region, farN++);
		const r = playFar(q, { dispoOf: (seed, id) => dispoOf(seed, id, region), ...ctx('', region) });
		return r;
	}
	// other sources' quests out of your sight (a business's courier run across town)
	function farSources() {
		const c = cam();
		for (const q of sources.near(c.x, c.z, 4000)) {
			if (q.source === 'favours' || taken.has(q.id) || flat(targetOf(q.steps[0]) || q.giver, c) < 150 || Math.random() > 0.5) continue;
			const region = q.region || here.region.id;
			for (let i = 0; i < 3; i++) {
				const seed = residentSeed(region, (farN++ * 7919) >>> 0), id = `npc:${seed}`, d = dispoOf(seed, id, region), ch = decide(d, q);
				if (!ch.take) continue;
				if (!sources.take(q, id)) break;
				const s = ch.outcome === 'abandon' ? { outcome: 'abandon' } : settle({ ...q, region }, ch.outcome, { ...ctx('', region), actorId: id });
				sources.complete(q, id, s.outcome);
				break;
			}
			return;
		}
	}
	function farTick(k = 1) {
		const out = [];
		for (let i = 0; i < k; i++) {
			out.push(farEvent(here.region.id));
			// now and then somewhere else you have been
			if (farN % 3 === 0) { const others = commons.regions().filter((r) => r !== here.region.id); if (others.length) out.push(farEvent(others[Math.floor(Math.random() * others.length)])); }
			farSources();
		}
		return out.map((r) => r.outcome);
	}
	// the time you were away: a little of it, for the regions you know
	(function catchUp() {
		const away = Date.now() - commons.savedAt(), known = commons.regions();
		if (!known.length || away < 300000) return;
		const k = Math.min(24, Math.floor(away / 300000));
		for (let i = 0; i < k; i++) farEvent(known[i % known.length]);
	})();

	// ---------- each frame ----------
	function update(dt) {
		clock += dt;
		if ((whereT -= dt) <= 0) { whereT = 2; try { here = whereNow(); regionNames.set(here.region.id, here.region.name); } catch { /* keep the last */ } }
		for (const R of scenes) sceneUpdate(R, dt);
		for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].phase === 'over') scenes.splice(i, 1);
		if (bag) { bag.t += dt; bagWalk(dt); }
		if ((lookT -= dt) <= 0) {
			lookT = 1;
			if (hurtFns.length) watchHurt();
			if (bag?.phase === 'left') bagLook();
			for (let i = pending.length - 1; i >= 0; i--) if (clock >= pending[i].at) { fromHandoff(pending[i].E); pending.splice(i, 1); }
			for (let i = open.length - 1; i >= 0; i--) { const F = open[i]; if (!F.taken && (clock > F.until || !F.giver.active || flat(F, cam()) > VISIBLE)) { letGo(F.giver); unkeep(F.giver); if (F.friend) { letGo(F.friend); unkeep(F.friend); } open.splice(i, 1); } }
			if (Math.floor(clock) % 2 === 0) match();
		}
		const busy = errands()?.busy?.() || scenes.length >= SCENES;
		if ((bagT -= dt) <= 0) { bagT = span(BAG_EVERY); if (!busy) spawnBag(); }
		if ((favT -= dt) <= 0) { favT = span(FAVOUR_EVERY); if (!busy && !open.length) spawnFavour(); }
		if ((farT -= dt) <= 0) { farT = FAR_EVERY; farTick(1); }
		if ((saveT -= dt) <= 0) { saveT = 15; commons.save(); }
	}

	// ---------- for the debug view and chatter ----------
	const r2 = (v) => Math.round(v * 100) / 100;
	function info() {
		const c = cam(), near = people.pool.filter((p) => adult(p) && flat(pos(p), c) < 40).sort((a, b) => flat(pos(a), c) - flat(pos(b), c)).slice(0, 6);
		return {
			region: { ...here.region, tally: commons.region(here.region.id) }, world: commons.world(worldKey()), situation: here.situation, town: here.town,
			nearby: near.map((p) => {
				const id = idOf(p), d = dispoOf(p.P.dna.seed), A = commons.known(id) ? commons.actor(id) : null, cash = money.balance(id);
				return { name: nameOf(p), id, temper: temperOf(d), mercy: d.mercy, law: d.law, protect: d.protect, honest: d.honest, greed: d.greed, money: `${cash} (${money.wealth(id)})`, deeds: A ? A.deeds : 0, last: A?.last || '', saw: memoryOf(p.P.dna.seed) || '' };
			}),
			scenes: scenes.map((R) => ({ quest: R.q.title, kind: R.q.kind, who: R.name, step: R.q.steps[R.i]?.do || '', outcome: R.outcome, phase: R.phase, t: r2(R.t) })),
			bag: bag && { phase: bag.phase, owner: bag.q.giver.name, where: bag.spot?.kind || 'sidewalk', title: bag.q.title, t: Math.round(bag.t), at: [r2(bag.at.x), r2(bag.at.z)] },
			open: open.map((F) => F.q.title), sources: sources.list().map((s) => s.id), far: farN,
			recent: commons.log(8).map((e) => `${e.name || 'someone'} (${e.actor}): ${e.line}${e.region ? ' in ' + e.region : ''}`),
		};
	}
	// what they know, for a conversation (guide.js): what they did or saw, and their money talk
	const FACT = { returned: 'Lately handed a lost bag back to the person who left it.', 'got-back': 'Left their bag behind earlier and a stranger brought it back; still a little amazed.', helped: 'A stranger did them a favour a little while ago.', robbed: 'Someone walked off with their bag a few minutes ago; upset about it.', 'saw-theft': 'Saw someone walk off with a bag that was not theirs a few minutes ago.', 'saw-return': 'Saw someone hand a lost bag back to its owner a little while ago.' };
	function factsFor(p) {
		if (!p?.P?.dna) return [];
		const out = [], m = memoryOf(p.P.dna.seed);
		if (m && FACT[m]) out.push(FACT[m]);
		const talk = money.talk(idOf(p));
		for (const t of [].concat(talk || []).slice(0, 2)) if (typeof t === 'string' && t) out.push(t);
		return out;
	}
	// a money fact to voice in passing (the bank's moneyTalk; none until it is attached)
	function moneyLine(seed) { const t = [].concat(money.talk(`npc:${seed >>> 0}`) || []).find((x) => typeof x === 'string' && x); return t || null; }
	function memoryOf(seed) { const M = memory.get(seed >>> 0); return M && clock - M.t < MEMORY ? M.kind : null; }
	function dispose() {
		for (const R of scenes) end(R, 'far');
		scenes.length = 0; clearBag();
		for (const F of open) { letGo(F.giver); unkeep(F.giver); letGo(F.friend); unkeep(F.friend); }
		open.length = 0; commons.save();
	}
	return {
		update, info, handoff, dispose, farTick, memoryOf, factsFor, moneyLine, regionNow, addSource: sources.add, sources: () => sources.list().map((s) => s.id),
		// (a hospital listens here; hurt(p, why) tells of someone hurt some other way)
		onHurt: (f) => { hurtFns.push(f); return () => { const i = hurtFns.indexOf(f); if (i >= 0) hurtFns.splice(i, 1); }; }, hurt,
		// (for the console and the tests) a bag left now near you; mode 'return' or 'steal' makes the
		// nearest passer-by do that, whoever they are
		bag(mode = 'auto') { const t = spawnBag({ force: true }); if (bag?.phase === 'left' && mode !== 'auto') { bagLook(mode === 'steal' ? 'steal' : 'return'); } return t; },
		// the places a bag could be left near you; and the establishment registry to read the
		// cafes and restaurants from ((x, z, r) -> [{ id, kind, name, door, tables }])
		spots: () => { const c = cam(); try { return spots.near(c.x, c.z, 50).map((x) => ({ kind: x.kind, at: [r2(x.x), r2(x.z)], place: x.place || x.venue || '' })); } catch { return []; } },
		establishments: (fn) => spots.use?.(fn),
		favour: () => spawnFavour(),
		// (the console, on a slow machine: run the scenes on by seconds of game time, moving the
		// people in them by their own steering, as people.js would)
		fastForward(seconds = 10, dt = 0.1) {
			for (let t = 0; t < seconds; t += dt) {
				for (const R of scenes) for (const p of [R.p, ...R.still]) {
					if (!p?.active || !p.override) continue;
					p.override(p, dt, cam());
					const S = p.M.S, v = p.M.want.speed || 0, h = p.M.want.heading ?? S.heading;
					S.pos.x += Math.sin(h) * v * dt; S.pos.z += Math.cos(h) * v * dt;
				}
				update(dt);
				errands()?.update?.(dt);
			}
			return info().scenes;
		},
		disposition: (seed) => dispoOf(seed),
		where: () => ({ ...here }),
	};
}
