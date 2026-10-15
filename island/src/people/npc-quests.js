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
// the globe's towns, the island village, other worlds' settlements. People out with their
// families (family-life.js) and the residents you know (social-actors.js) can be takers too:
// a parent walking the kids hands a bag back, a knot of teens spots one and says so (children
// and teens never take, steal or lose anything here; the grown-ups with them may). The region is worked
// out for each (people/moral-regions.js). Anyone in the pool knocked down (a thief brought
// down, a fight, a car) is told to onHurt listeners, so a hospital can come for them.

import * as THREE from 'three';
import { favourProp } from './favour-props.js';
import { createDog, dogSpec } from './dog.js';
import { disposition, temperOf } from './disposition.js';
import { createSources, favourQuest, bagQuest, decide, settle, farQuest, playFar, residentSeed, sceneLine } from './npc-quests-core.js';
import { bayRegionOf, globeRegionOf, globeCell, situationOf } from './moral-regions.js';
import { lineFor } from './errands-core.js';
import { toLatLon } from '../bay/geo.js';
import { zoneOf } from './flow.js';
import { regionalNow } from '../region/here.js';
import { createPlaces, restOn, standAt } from './bag-spots.js';
import { createLeads, leadFrom, leadLine, leadNote, leadFact } from './npc-leads.js';
import { citiesNear } from '../earth/atlas.js';

const NOTICE = 7, OWNER_BACK = 45, VISIBLE = 95, REACH = 1.4, STEP_MAX = 45, MEMORY = 600;

export function createNpcQuests({ scene, camera, world, people, chatter, persona, errands = () => null, commons, money, isPhone = false, worldKey = () => 'here', placeName = () => '', places = null, hint = () => {}, store = null, others = () => [] }) {
	const FAR_EVERY = isPhone ? 40 : 25, SCENES = isPhone ? 1 : 2, BAG_EVERY = isPhone ? [150, 240] : [70, 140], FAVOUR_EVERY = isPhone ? [150, 260] : [80, 160];
	const sources = createSources();
	// the benches, shelters, park seats, cafe tables and doorsteps about (people/bag-spots.js)
	const spots = places || createPlaces({ world });
	// thefts out of your sight, kept for you to follow up (people/npc-leads.js)
	const leads = createLeads({ store: store || { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } } });
	const LEAD_CHANCE = 0.35;
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
	// (and not sat down, at work, in a line or minding a stall: family-life.js's roles)
	const BUSY_ROLES = new Set(['jog', 'guard', 'volunteer', 'diner', 'line', 'lineup', 'child', 'teen']);
	const free = (p) => adult(p) && !p.engaged && !p.override && !p.held && p.demo === undefined && !p.workSpot && !p.sit && !BUSY_ROLES.has(p.role) && p.route?.kind !== 'seat' && p.route?.kind !== 'follow';
	const minor = (p) => !!(p?.P?.dna?.child || p?.P?.dna?.minor || p?.P?.dna?.teen);
	// everyone about: the walking pool, and the families and residents out among them
	const everyone = () => { let o = null; try { o = others(); } catch { /* a system gone */ } return o?.length ? [...people.pool, ...o] : people.pool; };
	// a grown-up out with children of their own: a child holding their hand or at their side
	const withKids = (p, all) => all.some((q) => q.follow === p && minor(q) && q.active);

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
	function witnesses(at, kind, except = []) { for (const q of everyone()) if (adult(q) && !except.includes(q) && flat(pos(q), at) < 15) remember(q, kind); }
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
			if (R.phase === 'flee') { const f = R.fleeFrom || cam(); who.M.want.heading = Math.atan2(S.pos.x - f.x, S.pos.z - f.z); who.M.want.speed = speed * (R.slow ? 1 : 1.6); who.M.want.run = 0; return true; }
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
	// what the one helped says when it is done, by the kind of favour (errands-core.js lineFor)
	const REPLY = { 'favour.pass': 'passed', 'favour.catch': 'caught', 'favour.repair': 'fixed', 'favour.jumpstart': 'jumped', 'favour.groceries': 'carried', 'favour.directions': 'told', 'favour.fall': 'helpedUp', 'favour.pet': 'reunited' };
	// what the helper says as they hand it over or finish
	const HAND = { 'favour.directions': 'directions', 'favour.repair': 'fixed', 'favour.jumpstart': 'cables', 'favour.fall': 'helpUp' };
	function arrive(R) {
		const s = R.q.steps[R.i], T = targetOf(s), w = s.at?.who, kind = R.q.kind;
		if (s.do === 'go' || s.do === 'chase') return next(R);
		// the moment a betrayal happens when it is not a pickup: the wrong way, the money, the pockets
		if (s.turn && R.outcome === 'betray') return betray(R);
		if (s.do === 'pickup') {
			if (R.ground) { dropProp(R.ground.prop); R.ground.prop = null; R.ground.phase = 'taken'; }
			R.prop = propFor(s.item?.shape || R.q.item?.shape);
			if (R.outcome === 'betray') return betray(R);
			if (R.own) say(R.p, sceneLine('back', n++), 'nod', { joy: 0.4 });
			else if (R.kids) say(R.p, sceneLine('withKids', n++), 'nod', { joy: 0.3 });
			else if (kind === 'favour.groceries') say(R.p, sceneLine('carry', n++), 'nod', { joy: 0.3 });
			// a bag's owner is called back, and waits
			const ow = kind === 'bag' && !R.own ? R.q.steps.findLast((x) => x.do === 'deliver')?.at?.who : null;
			if (ow && ow.active && ow !== R.p && !ow.heldBy) { standStill(ow, () => pos(R.p)); R.still.push(ow); say(R.p, sceneLine('call', n++), 'wave', { surprise: 0.2 }); }
			// groceries: their owner walks to the car beside the one carrying them
			if (kind === 'favour.groceries' && w && w !== R.p) { walkWith(w, R.p); R.still.push(w); }
			// a favour's giver hands it over and waits
			else if (w && w !== R.p) say(w, kind === 'favour.pass' ? 'Thank you, really.' : '', 'nod', { joy: 0.4 });
			return pause(R, 0.8, T);
		}
		if (s.do === 'deliver' || s.do === 'talk') {
			if (w && w.active && w !== R.p) {
				if (!w.heldBy) { standStill(w, () => pos(R.p)); R.still.push(w); }
				const bagBack = kind === 'bag';
				say(R.p, bagBack ? sceneLine('hand', n++) : sceneLine(HAND[kind] || (s.do === 'talk' ? 'fixed' : 'deliver'), n++), kind === 'favour.directions' ? 'point' : 'open', { joy: 0.4 });
				// (their answer a moment later)
				R.reply = { p: w, at: 1.6, text: bagBack ? sceneLine('thank', n++) : lineFor(REPLY[kind] || 'returned', { kind: kind.slice(7), item: { ...R.q.item, the: `the ${R.q.item?.name || 'thing'}` }, friend: R.q.giver.name, n: n++ }) };
			}
			if (kind === 'favour.pet') petHome(R);
			if (R.prop) { dropProp(R.prop); R.prop = null; }
			return pause(R, 3, T);
		}
		if (s.do === 'wait') {
			// a lost dog won over, now following; someone fallen, helped to their feet
			if (kind === 'favour.pet') petFollow(R);
			if (kind === 'favour.fall' && w) { say(R.p, sceneLine('helpUp', n++), 'open', {}); getUp(w); }
			return pause(R, 3, T);
		}
		if (s.do === 'fix') { R.p.M.setPose?.('rest'); return pause(R, 4, T); }
		next(R);
	}
	// took it and went: the bad deed now, and you may answer it
	function betray(R) {
		const q = R.q;
		R.settled = settle(q, 'betray', { ...ctx(R.name, q.region), actorId: R.id });
		R.takenAt = { x: pos(R.p).x, z: pos(R.p).z };
		remember(R.p, 'stole');
		const owner = q.steps.findLast((s) => s.do === 'deliver')?.at || q.steps.findLast((s) => s.at?.who)?.at, ob = owner?.who;
		// nothing carried off (the wrong way pointed out, money talked out of them): they just
		// walk away, and the one cheated may not even know it yet
		if (!R.settled.followUp) {
			if (q.kind === 'favour.directions') { say(R.p, sceneLine('mislead', n++), 'point', {}); R.reply = { p: ob, at: 1.6, text: lineFor('told', { n: n++ }), gesture: 'wave', feel: { joy: 0.6 } }; }
			else { say(R.p, sceneLine('upfront', n++), 'shrug', {}); if (ob && adult(ob)) { remember(ob, 'cheated'); R.reply = { p: ob, at: 4, text: sceneLine('cheated', n++) }; } }
			R.phase = 'flee'; R.slow = true; R.stepT = 0; R.fleeFrom = ob?.active ? pos(ob) : cam();
			return;
		}
		if (!R.prop && q.item?.shape) R.prop = propFor(q.item.shape);
		if (ob && q.kind === 'favour.fall') { getUp(ob); letGo(ob); }
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
		// a theft that got away out of your sight: a lead, where it happened
		if ((how === 'far' || how === 'gone') && R.phase !== 'handed' && R.settled?.followUp) leadOf(q, { ...R.settled, taker: R.id }, q.region, R.takenAt || pos(R.p));
		R.completed = true;
		if (R.phase !== 'handed') letGo(R.p);
		for (const w of R.still) letGo(w);
		for (const s of q.steps) unkeep(s.at?.who);
		if (R.phase !== 'handed') { dropProp(R.prop); R.prop = null; }
		taken.delete(q.id);
		if (R.ground && bag === R.ground) clearBag();
		const D = dogs.get(q.id);
		if (D && D.phase !== 'reunion' && D.phase !== 'home') dropDog(q.id);
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
		if (R.phase === 'flee') { if (R.reply && R.stepT >= R.reply.at) { say(R.reply.p, R.reply.text, R.reply.gesture || 'shake', R.reply.feel || { anger: 0.5 }); R.reply = null; } if (R.stepT > (R.slow ? 8 : 20)) end(R, 'gone'); return; }
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
		if (flat(B.at, c) > VISIBLE) { const r = playFar(B.q, { dispoOf, ...ctx('', B.q.region) }); if (r.taker) remember(B.owner, r.outcome === 'betray' ? 'robbed' : 'got-back'); if (Math.random() < LEAD_CHANCE * 2) leadOf(B.q, r, B.q.region, B.at); clearBag(); return; }
		// (the console's forced bag takes anyone standing about, not only those walking by)
		const can = force ? (p) => adult(p) && !p.engaged && !p.override && !p.held && p.route?.kind !== 'seat' && p.route?.kind !== 'follow' : free;
		const reach = force ? 40 : B.spot?.kind === 'table' || B.spot?.kind === 'doorstep' ? NOTICE + 2 : NOTICE;
		const all = everyone();
		// children and teens who see it say so (they never take it); the grown-ups with them,
		// or close by, have been told, and are watched
		for (const k of all) {
			if (!k.active || !minor(k) || B.seen.has(k) || flat(pos(k), B.at) > NOTICE + 2) continue;
			B.seen.add(k);
			if (B.pointed) continue;
			B.pointed = k;
			say(k, sceneLine(k.P.dna.teen ? 'teenSee' : 'kidSee', n++), 'point', { surprise: 0.5 });
			remember(k, 'saw-bag');
		}
		const told = B.pointed?.follow;
		const near = all.filter((p) => can(p) && p !== B.owner && !B.seen.has(p) && (flat(pos(p), B.at) < reach || (p === told && flat(pos(p), B.at) < 16))).sort((a, b) => (b === told) - (a === told) || flat(pos(a), B.at) - flat(pos(b), B.at));
		for (const p of near) {
			B.seen.add(p);
			const d = dispoOf(p.P.dna.seed);
			// not in front of the kids: their own, or the ones who pointed it out
			const kids = withKids(p, all), watched = !!B.pointed && (p === told || flat(pos(p), pos(B.pointed)) < 10);
			const q = kids || watched ? { ...B.q, tempt: B.q.tempt * (kids ? 0.4 : 0.6) } : B.q;
			const choice = force ? { take: true, outcome: force === 'steal' ? 'betray' : 'done' } : decide(d, q);
			if (!choice.take) continue;
			if (force) { const h = Math.random() * 6.28, st = B.spot && B.spot.kind !== 'sidewalk' ? standAt(B.spot) : B.at; p.M.place?.(st.x + Math.cos(h) * 1.6, pos(p).y, st.z + Math.sin(h) * 1.6, h); }
			const R = start(B.q, p, d, choice.outcome, { ground: B });
			if (kids && choice.outcome !== 'betray') R.kids = true;
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
		complete: (id) => { const i = open.findIndex((f) => f.q.id === id); if (i >= 0) closeFavour(open[i]); },
	};
	sources.add(favours);
	function closeFavour(F) {
		const i = open.indexOf(F);
		if (i >= 0) open.splice(i, 1);
		if (F.giver?.fallen) getUp(F.giver);
		letGo(F.giver); unkeep(F.giver); letGo(F.friend); unkeep(F.friend);
		// a dog nobody went for wanders off out of sight
		const D = dogs.get(F.q.id);
		if (D && D.phase === 'lost') dropDog(F.q.id);
	}
	// someone who has fallen stays down until helped (or gets up by themselves, in the end)
	function downOnGround(p) { steer(p, (q) => { q.M.want.speed = 0; return true; }); p.fallen = true; p.M.sit?.(0.12); p.M.setPose?.('lap'); }
	function getUp(p) { if (!p) return; p.fallen = false; p.M.stand?.(); p.M.setPose?.(p.idlePose || 'rest'); }
	// beside someone as they walk (groceries to the car)
	function walkWith(p, leader) {
		steer(p, (q) => {
			const S = q.M.S, L = pos(leader), d = flat(S.pos, L);
			if (d > 1.6) { q.M.want.heading = Math.atan2(L.x - S.pos.x, L.z - S.pos.z); q.M.want.speed = Math.min(1.7, d); } else q.M.want.speed = 0;
			return true;
		});
	}
	// ---------- a lost dog, for a pet favour near you (dog.js) ----------
	const dogs = new Map();
	function spawnDog(q, at, spec) {
		let dog = null;
		try { dog = createDog({ seed: spec.seed, breed: spec.breed, isPhone }); } catch { return null; }
		dog.place(at.x, groundY(at.x, at.z), at.z, Math.random() * 6.28); dog.pose('sad');
		scene.add(dog.root);
		// (stands in for a body as a step's place: the dog itself, wherever it has wandered)
		const proxy = { active: true, M: { S: { pos: new THREE.Vector3(at.x, 0, at.z) } } };
		const D = { dog, phase: 'lost', home: { x: at.x, z: at.z }, you: null, owner: null, t: 0, proxy };
		dogs.set(q.id, D);
		return D;
	}
	function dropDog(id) { const D = dogs.get(id); if (!D) return; D.proxy.active = false; D.dog.dispose(); dogs.delete(id); }
	function petFollow(R) { const D = dogs.get(R.q.id); if (D) { D.phase = 'follow'; D.you = R.p; } }
	function petHome(R) { const D = dogs.get(R.q.id); if (D) { D.phase = 'reunion'; D.t = 0; D.owner = R.q.steps.at(-1).at?.who || null; } }
	function dogsUpdate(dt) {
		for (const [id, D] of dogs) {
			D.t += dt;
			const you = D.you?.active ? pos(D.you) : cam(), owner = D.owner?.active ? pos(D.owner) : you;
			try { D.dog.update(dt, { ground: groundY, home: D.home, mode: D.phase, you, owner, keep: 1.8 }); } catch { dropDog(id); continue; }
			const p = D.dog.pos; D.proxy.M.S.pos.set(p.x, p.y, p.z);
			if (D.phase === 'reunion' && D.t > 7) { D.phase = 'home'; D.t = 0; }
			if ((D.phase === 'home' && D.t > 20) || flat(p, cam()) > VISIBLE + 20) dropDog(id);
		}
	}
	function openFavour(kind, giver, { friend = null, drop = null, car = null, item = null, dest = null } = {}) {
		if (!giver || !adult(giver)) return null;
		const g = pos(giver), who = (p) => p && { id: idOf(p), name: nameOf(p), x: pos(p).x, z: pos(p).z, ref: p };
		const pet = kind === 'pet' ? dogSpec(((giver.P.dna.seed | 0) * 31 + n * 7) >>> 0) : null;
		const q = favourQuest(kind, { giver: who(giver), friend: who(friend), drop: drop && { ...drop }, car: car && { ...car, name: 'their car' }, region: here.region.id, seed: giver.P.dna.seed, n: n++, item, dest, pet });
		if (!q) return null;
		q.id = `${q.id}:${giver.P.dna.seed}:${n}`;
		// their dog, run off a little way: found where it has wandered to
		if (pet && drop) { const D = spawnDog(q, drop, pet); if (D) { q.steps[0].at.who = D.proxy; q.steps[1].at.who = D.proxy; } }
		// someone falls: down where they are until helped up
		if (kind === 'fall') {
			downOnGround(giver);
			say(giver, sceneLine('fallen', n++), 'shake', { surprise: 0.8, sad: 0.4 });
			if (flat(g, cam()) < 35 && !errands()?.busy?.()) hint(`${q.giver.name || 'Someone'} has fallen over. Walk up to them to help them up.`, 4000);
		}
		// the giver waits where they are; a friend to be caught walks on, kept in the world
		else if (!giver.held) standStill(giver, () => { const R = scenes.find((s) => s.q.id === q.id); return R ? pos(R.p) : null; });
		if (kind === 'directions') say(giver, `Excuse me, does anyone know the way to ${q.dest}?`, 'open', { surprise: 0.2 });
		if (friend) { if (kind === 'pass' && !friend.held) standStill(friend, null); else keep(friend); }
		open.push({ q, giver, friend, until: clock + (kind === 'fall' ? 45 : 60), x: g.x, z: g.z, kind });
		return q;
	}
	// a favour near you: what it is follows who is about (a friend to catch, a car that will not
	// start, a dog run off); want: one kind, for the console
	function spawnFavour(want = null) {
		const c = cam(), pool = people.pool.filter(free);
		const giver = pool.find((p) => flat(pos(p), c) > (want ? 4 : 15) && flat(pos(p), c) < 60);
		if (!giver) return 'nobody about to ask';
		const g = pos(giver), others = pool.filter((p) => p !== giver);
		const kinds = ['lost', 'directions', 'fall', 'groceries', 'pet'];
		const friend = others.find((p) => flat(pos(p), g) > 10 && flat(pos(p), g) < 40);
		if (friend) kinds.push('pass', friend.role === 'walk' ? 'catch' : 'pass');
		let car = null;
		try { car = (world()?.street?.parkedNear?.(g.x, g.z, 25) || []).find((k) => k.id && !String(k.id).startsWith('tr')); } catch { /* no street */ }
		if (car) kinds.push('repair', 'jumpstart', 'groceries');
		const kind = want && kinds.includes(want) ? want : kinds[Math.floor(Math.random() * kinds.length)];
		const a = Math.random() * 6.28, d = kind === 'pet' ? 22 : kind === 'groceries' ? 14 : 8, drop = { x: g.x + Math.cos(a) * d, y: g.y, z: g.z + Math.sin(a) * d };
		const q = openFavour(kind, giver, { friend: kind === 'pass' || kind === 'catch' ? friend : null, drop, car: car && { x: car.x, z: car.z } });
		return q ? q.title : 'no favour';
	}
	// someone fallen near you, not yet helped: walk up and you help them up (errands.js helped)
	function helpLook() {
		const E = errands(), c = cam();
		for (const F of open) {
			if (F.kind !== 'fall' || F.taken || !F.giver.active || flat(pos(F.giver), c) > 2.6 || !E?.helped || E.busy?.()) continue;
			F.taken = true;
			getUp(F.giver);
			if (E.helped({ kind: 'fall', p: F.giver, name: F.q.giver.name })) remember(F.giver, 'helped');
			closeFavour(F);
			return;
		}
	}
	// a favour you turned down (errands.js): someone else about may take it up
	function handoff(E) {
		if (!E?.giver || !['lost', 'catch', 'pass', 'repair', 'groceries', 'jumpstart', 'directions'].includes(E.kind)) return;
		pending.push({ at: clock + 1.2, E });
	}
	function fromHandoff(E) {
		if (!adult(E.giver) || E.giver.held) return;
		const friend = E.friendP && adult(E.friendP) && !E.friendP.held ? E.friendP : null;
		if ((E.kind === 'pass' || E.kind === 'catch') && !friend) return;
		const item = E.kind === 'lost' && E.item ? { name: E.item.name, shape: E.item.shape || E.item.id, cash: E.item.cash || 0 } : null;
		openFavour(E.kind, E.giver, { friend, drop: E.drop, car: E.car, item, dest: E.dest });
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
			const near = everyone().filter((p) => free(p) && !seen.has(p) && !q.steps.some((s) => s.at?.who === p) && flat(pos(p), T) < 25);
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

	// ---------- leads: thefts out of your sight, to be followed up ----------
	// (people talk about them, the guide's story notes them, a marker shows where; the thief
	// may still be about with it, and found, it is a theft like any other: errands.js theft)
	const hours = () => world()?.sky?.state?.hours ?? 12;
	const groundY = (x, z) => { const W = world(), h = W?.island?.heightAt?.(x, z); const f = Number.isFinite(h) ? W?.player?.floorAt?.(x, z, h) : null; return Number.isFinite(f) ? f : Number.isFinite(h) ? h : cam().y - 1.7; };
	const carried = [];
	let cast = null, castT = 2;
	function leadOf(q, r, region = q.region || here.region.id, at = null) {
		if (r?.outcome !== 'betray' || !r.followUp) return null;
		return leads.add(leadFrom(q, r, { region, regionName: regionNames.get(region) || commons.region(region).name || '', town: region === here.region.id ? here.town || '' : '', hours: hours(), at }));
	}
	// where it happened, once you are in its region: a bench or a doorstep a little way off, or
	// a stretch of sidewalk
	function leadSpot(L) {
		const c = cam();
		let s = null;
		try { const all = spots.near(c.x, c.z, 300).filter((x) => { const d = flat(x, c); return d > 90 && d < 300; }); s = all.find((x) => x.kind === L.spot?.kind) || all[0] || null; } catch { /* nothing built here */ }
		if (s) return s;
		const a = Math.random() * 6.28, d = 120 + Math.random() * 100;
		let x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
		try { const sw = people.sidewalk?.(x, z); if (sw) { x = sw[0]; z = sw[1]; } } catch { /* no streets */ }
		return { x, z, kind: 'sidewalk' };
	}
	function uncast() { if (!cast) return; dropProp(cast.prop); unkeep(cast.p); cast = null; }
	function leadTick() {
		const open = leads.open(here.region.id), c = cam();
		for (const L of open) if (!L.at) leads.place(L.id, leadSpot(L));
		const L = cast ? leads.get(cast.id) : open.filter((x) => x.at).sort((a, b) => flat(a.at, c) - flat(b.at, c))[0];
		if (!L || L.state !== 'open') { uncast(); return; }
		const E = errands();
		if (cast) {
			const p = cast.p;
			if (!p.active || p.P?.ragdoll || flat(pos(p), c) > 130) { uncast(); return; }
			if (flat(pos(p), c) < 10 && E?.theft && !E.busy?.()) confront(L);
			return;
		}
		if (flat(L.at, c) > 90 || E?.busy?.() || (castT -= 1) > 0) return;
		castT = 3;
		if (Math.random() > 0.35) return;
		// a walker about now has it: the thief, still in the neighbourhood
		const p = people.pool.filter((q) => free(q) && q.role === 'walk' && flat(pos(q), c) > 15 && flat(pos(q), c) < 60).sort((a, b) => flat(pos(a), L.at) - flat(pos(b), L.at))[0];
		if (!p) return;
		cast = { id: L.id, p, prop: propFor(L.item.shape || 'bag') };
		keep(p);
		hint(`Someone over there is carrying a ${L.item.name} like ${L.owner.name}'s. It could be the one who took it.`, 4500);
	}
	// close enough: they see you coming and walk off quickly with it
	function confront(L) {
		const E = errands(), { p, prop } = cast, held = { p, prop };
		unkeep(p);
		const home = { x: L.at.x, y: groundY(L.at.x, L.at.z), z: L.at.z };
		const ok = E.theft({ home, owner: L.owner.name, thief: p, item: { name: L.item.name, shape: L.item.shape }, speed: 2.4, lead: L.when,
			onDrop: () => { dropProp(prop); held.prop = null; },
			onEnd: (how) => { dropProp(prop); held.prop = null; endLead(L, how); } });
		if (!ok) { keep(p); return; }
		carried.push(held);
		cast = null;
	}
	// the end of it: back with its owner (their money goes back to them), kept, or got away
	function endLead(L, how = '') {
		const back = /reach/.test(how), kept = /away/.test(how) && /bring/.test(how);
		leads.close(L.id, back ? 'returned' : kept ? 'kept' : /escaped/.test(how) ? 'got-away' : 'cold');
		if (back && L.loot) money.earn(L.owner.id, L.loot, 'recovered', 'player');
	}
	// what a passer-by in the lead's region says, now and then (only some have heard)
	function leadFor(seed) {
		const open = leads.open(here.region.id);
		if (!open.length) return null;
		const L = open[(seed >>> 0) % open.length];
		return ((Math.imul(seed >>> 0, 2654435761) ^ (L.t | 0)) >>> 0) % 100 < 35 ? L : null;
	}
	function leadLineFor(seed) { const L = leadFor(seed); return L ? leadLine(L, seed) : null; }
	// the marker: the thief if you have spotted them, or roughly where it happened
	function leadMark() {
		if (errands()?.busy?.()) return null;
		const c = cam();
		if (cast?.p.active) { const L = leads.get(cast.id), q = pos(cast.p); return L && { x: q.x, y: q.y, z: q.z, radius: 2, title: `The one who took ${L.owner.name}'s ${L.item.name}?`, detail: 'walk up to them' }; }
		const L = leads.open(here.region.id).filter((x) => x.at).sort((a, b) => flat(a.at, c) - flat(b.at, c))[0];
		return L ? { x: L.at.x, y: groundY(L.at.x, L.at.z), z: L.at.z, radius: 25, title: `Where ${L.owner.name}'s ${L.item.name} was taken`, detail: `${L.when}; the thief may still be about` } : null;
	}

	// ---------- far away ----------
	function farEvent(region) {
		const q = farQuest(region, farN++);
		const r = playFar(q, { dispoOf: (seed, id) => dispoOf(seed, id, region), ...ctx('', region) });
		if (r.outcome === 'betray' && Math.random() < LEAD_CHANCE) leadOf(q, r, region);
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
		if (cast) { if (cast.p.active) inHand(cast.prop, cast.p); }
		if (dogs.size) dogsUpdate(dt);
		for (let i = carried.length - 1; i >= 0; i--) { const H = carried[i]; if (H.prop && H.p.active) inHand(H.prop, H.p); else { dropProp(H.prop); carried.splice(i, 1); } }
		if ((lookT -= dt) <= 0) {
			lookT = 1;
			if (hurtFns.length) watchHurt();
			if (bag?.phase === 'left') bagLook();
			leadTick();
			helpLook();
			for (let i = pending.length - 1; i >= 0; i--) if (clock >= pending[i].at) { fromHandoff(pending[i].E); pending.splice(i, 1); }
			for (let i = open.length - 1; i >= 0; i--) { const F = open[i]; if (!F.taken && (clock > F.until || !F.giver.active || flat(F, cam()) > VISIBLE)) closeFavour(F); }
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
			leads: leads.open().map((L) => ({ note: leadNote(L), here: L.region === here.region.id, at: L.at && [r2(L.at.x), r2(L.at.z)], spotted: cast?.id === L.id })),
			recent: commons.log(8).map((e) => `${e.name || 'someone'} (${e.actor}): ${e.line}${e.region ? ' in ' + e.region : ''}`),
		};
	}
	// what they know, for a conversation (guide.js): what they did or saw, and their money talk
	const FACT = { returned: 'Lately handed a lost bag back to the person who left it.', 'got-back': 'Left their bag behind earlier and a stranger brought it back; still a little amazed.', helped: 'A stranger did them a favour a little while ago.', robbed: 'Someone walked off with their bag a few minutes ago; upset about it.', 'saw-theft': 'Saw someone walk off with a bag that was not theirs a few minutes ago.', 'saw-return': 'Saw someone hand a lost bag back to its owner a little while ago.', 'saw-bag': 'Spotted a bag someone had left behind a little while ago, and said so.', cheated: 'Someone offered to help with their car a little while ago, took their money up front and walked off.' };
	function factsFor(p) {
		if (!p?.P?.dna) return [];
		const out = [], m = memoryOf(p.P.dna.seed);
		if (m && FACT[m]) out.push(FACT[m]);
		const L = leadFor(p.P.dna.seed);
		if (L) out.push(leadFact(L));
		const talk = money.talk(idOf(p));
		for (const t of [].concat(talk || []).slice(0, 2)) if (typeof t === 'string' && t) out.push(t);
		return out;
	}
	// a money fact to voice in passing (the bank's moneyTalk; none until it is attached)
	function moneyLine(seed) { const t = [].concat(money.talk(`npc:${seed >>> 0}`) || []).find((x) => typeof x === 'string' && x); return t || null; }
	function memoryOf(seed) { const M = memory.get(seed >>> 0); return M && clock - M.t < MEMORY ? M.kind : null; }
	function dispose() {
		for (const R of scenes) end(R, 'far');
		scenes.length = 0; clearBag(); uncast();
		for (const H of carried) dropProp(H.prop);
		carried.length = 0;
		for (const F of open.slice()) closeFavour(F);
		open.length = 0;
		for (const id of [...dogs.keys()]) dropDog(id);
		commons.save();
	}
	return {
		update, info, handoff, dispose, farTick, memoryOf, factsFor, moneyLine, regionNow, situation: () => here.situation, addSource: sources.add, sources: () => sources.list().map((s) => s.id),
		// leads: a line for chatter, the marker and the guide's story (open leads, everywhere)
		leadLine: leadLineFor, mark: leadMark,
		leads: () => leads.open().map((L) => ({ id: L.id, note: leadNote(L), here: L.region === here.region.id, region: L.regionName || L.region, when: L.when })),
		// (the console and the tests: a theft just out of sight near you, left as a lead)
		lead(kind = 'bag') {
			const q = farQuest(here.region.id, farN++, 0, kind === 'snatch' || kind === 'fall' ? kind : 'bag'), seed = residentSeed(here.region.id, farN * 13);
			const r = { taker: `npc:${seed}`, ...settle(q, 'betray', { ...ctx('', here.region.id), actorId: `npc:${seed}` }) };
			const L = leads.add(leadFrom(q, r, { region: here.region.id, regionName: here.region.name, town: here.town || '', hours: hours() }), { force: true });
			if (L) { leads.place(L.id, leadSpot(L)); castT = 0; }
			return L ? leadNote(L) : 'no lead';
		},
		// (a hospital listens here; hurt(p, why) tells of someone hurt some other way)
		onHurt: (f) => { hurtFns.push(f); return () => { const i = hurtFns.indexOf(f); if (i >= 0) hurtFns.splice(i, 1); }; }, hurt,
		// (for the console and the tests) a bag left now near you; mode 'return' or 'steal' makes the
		// nearest passer-by do that, whoever they are
		bag(mode = 'auto') { const t = spawnBag({ force: true }); if (bag?.phase === 'left' && mode !== 'auto') { bagLook(mode === 'steal' ? 'steal' : 'return'); } return t; },
		// the places a bag could be left near you; and the establishment registry to read the
		// cafes and restaurants from ((x, z, r) -> [{ id, kind, name, door, tables }])
		spots: () => { const c = cam(); try { return spots.near(c.x, c.z, 50).map((x) => ({ kind: x.kind, at: [r2(x.x), r2(x.z)], place: x.place || x.venue || '' })); } catch { return []; } },
		establishments: (fn) => spots.use?.(fn),
		favour: (kind) => spawnFavour(kind || null),
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
