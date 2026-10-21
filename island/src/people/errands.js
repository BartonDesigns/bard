// Favours in passing (the words and rules in errands-core.js): someone you walk by asks for
// help, you say yes with the talk control, and the errand plays out right there. The people in
// it are held in the world until it ends; the pin shows the way; the reward is credits in your
// inventory and a good deed on the compass. One errand at a time.
// A lost dog (dog.js) is about only while its favour is: wandering and whimpering where it
// ran to, following you once won over, home with its person, then gone when out of sight.
// A bag someone else stole in front of you (people/npc-quests.js) comes here too, as a
// snatch: let them go, or catch them and take it (neutral), then give it back (the good
// deed) or walk off with it (keeping stolen goods). A favour you turn down is offered to the
// people about instead (handoff). Groceries carried to someone's car (they walk behind you),
// a flat battery jumped (stand by the car while they try it), the way pointed out, and
// someone who has fallen helped up (people/npc-quests.js calls helped) are favours too.
// What they pay comes out of their own account, through the bank's adapter (money). A pothole
// down the street is reported by standing by it (or driving over it), and the city's crew
// comes to fill it (potholes: bay/streets.js).
import * as THREE from 'three';
import { offerFor, lineFor, rewardFor, step, milestone, relativeDir } from './errands-core.js';
import { LOCAL_TASKS, localOffer } from './local-tasks.js';
import { rememberIncident } from './world-awareness.js';
import { promoted } from '../gameplay/ranks.js';
import { favourProp } from './favour-props.js';
import { createDog, dogSpec } from './dog.js';
import { createDogVoice } from './dog-voice.js';
import { wallKeeper } from './walls.js';

const OFFER_FOR = 15, OFFER_REACH = 12, PICK = 1.4, HAND = 2.3, AWAY = 220;
const LIMIT = { search: 360, bring: 360, lead: 420, chase: 150, carry: 300, fix: 480, haul: 240, jump: 240, tell: 30, report: 300 };
// a dog: won over within this (walking, not running at it); home within this of its person
const PET_REACH = 3, PET_HOME = 4, RUSH = 3.6;
const STORE = 'crysis-favours-v1';
const _v = new THREE.Vector3();

export function createErrands({ pacing = null, scene, camera, world, people, chatter, persona, arms, morality, hint, driving, isPhone, worldKey = () => world()?.body?.key || 'here', placeName = () => '', note = () => {}, handoff = () => null, money = () => null, potholes = () => null }) {
	let E = null, n = 0, cool = 40, prop = null, gT = 0, clock = 0, snatchCool = 120, snatchLook = 0, pet = null, voice = null;
	let tally = { done: 0, kept: 0 };
	try { tally = { ...tally, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { /* private mode */ }
	const save = () => { try { localStorage.setItem(STORE, JSON.stringify(tally)); } catch { /* private mode */ } };

	// ---------- the people in it, held ----------
	function hold(p, mode) {
		p.held = true;
		const mine = (q, dt, cam) => {
			if (mode === 'walk') return false;            // a friend walking on: their own way, kept about
			// walking behind you (groceries to their car)
			if (mode === 'follow') { const S = q.M.S, dx = cam.x - S.pos.x, dz = cam.z - S.pos.z, d = Math.hypot(dx, dz); if (d > 1.8) { q.M.want.heading = Math.atan2(dx, dz); q.M.want.speed = Math.min(1.8, d); } else q.M.want.speed = 0; return true; }
			const S = q.M.S, dx = cam.x - S.pos.x, dz = cam.z - S.pos.z, d = Math.hypot(dx, dz);
			if (q.route?.kind === 'seat') return false;   // sitting: stays sat
			q.M.want.speed = 0;
			if (d < 16) { q.M.want.heading = Math.atan2(dx, dz); if (!S.remark) S.look.target = cam; }
			else if (!S.remark) S.look.target = null;
			q.M.setPose(q.idlePose || 'rest');
			return true;
		};
		p.override = mine; p.heldBy = mine;
	}
	// a thief running off: away from you, turning aside from water and walls of nothing (one
	// walking off quickly breaks into a run when you come close)
	function flee(p, speed) {
		p.held = true; p.fleeBend = (Math.random() - 0.5) * 0.8;
		const mine = (q, dt, cam) => {
			const S = q.M.S, close = Math.hypot(S.pos.x - cam.x, S.pos.z - cam.z) < 14;
			let h = Math.atan2(S.pos.x - cam.x, S.pos.z - cam.z) + q.fleeBend;
			if (groundAt(S.pos.x + Math.sin(h) * 3, S.pos.z + Math.cos(h) * 3) === null) { q.fleeBend += dt * 2.5; h += dt * 2.5; }
			q.M.want.heading = h; q.M.want.speed = close ? Math.max(speed, 5) : speed; q.M.want.run = speed > 3 || close ? 1 : 0; S.look.target = null;
			return true;
		};
		p.override = mine; p.heldBy = mine;
	}
	function release(p) {
		if (!p) return;
		if (p.override === p.heldBy) p.override = null;
		p.held = false; p.heldBy = null;
	}
	const lost = (p) => !p || !p.active || p.override !== p.heldBy || p.P?.ragdoll;
	const pos = (p) => p.M.S.pos;
	// whoever it goes back to: the person, or the place (a business) when there is no one
	const ownerAt = () => (E.giver ? pos(E.giver) : E.home);
	const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
	const you = () => { const P = world()?.player?.state; return P && !P.flying ? P.pos : camera.position; };
	// (a lost pet kept off the walls as it runs: people/walls.js)
	const keepWalls = wallKeeper(world);
	const feet = () => { const q = you(); return { x: q.x, y: q.y - (q === camera.position ? 1.7 : 0), z: q.z }; };

	// ---------- the ground, for a dropped thing ----------
	function groundAt(x, z) {
		const W = world(), h = W?.island?.heightAt?.(x, z);
		if (!Number.isFinite(h) || h < 0.6) return null;
		const L = W.real?.landAt?.(x, z);
		if (L && L.roof > 0.5) return null;                      // not on a roof, not inside
		const f = W.player?.floorAt?.(x, z, h);
		return Number.isFinite(f) ? f : h;
	}
	function dropSpot(from, near = 12, far = 38) {
		for (let k = 0; k < 24; k++) {
			const a = Math.random() * Math.PI * 2, d = near + Math.random() * (far - near);
			let x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
			const sw = people.sidewalk?.(x, z);
			if (sw && Math.hypot(sw[0] - x, sw[1] - z) < 9) { x = sw[0]; z = sw[1]; }
			const y = groundAt(x, z);
			if (y === null || Math.abs(y - from.y) > 5) continue;
			return { x, y, z };
		}
		return null;
	}

	// ---------- the thing on the ground: small, with a glint so it can be found ----------
	let glintTex = null;
	function glint() {
		if (glintTex) return glintTex;
		const c = document.createElement('canvas'); c.width = c.height = 64;
		const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,246,214,.75)'); r.addColorStop(1, 'rgba(255,240,200,0)');
		g.fillStyle = r; g.fillRect(0, 0, 64, 64);
		g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(30, 2, 4, 60); g.fillRect(2, 30, 60, 4);
		return (glintTex = new THREE.CanvasTexture(c));
	}
	function placeProp(shape, at) {
		const g = new THREE.Group(), f = favourProp(shape), m = new THREE.Mesh(f.geo, f.mat);
		m.position.y = f.lift; m.castShadow = true; g.add(m);
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glint(), color: 0xfff3cf, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		s.position.y = 0.12; s.scale.setScalar(0.5); g.add(s);
		g.position.set(at.x, at.y + 0.005, at.z); g.rotation.y = Math.random() * 6.28;
		scene.add(g);
		return { g, s };
	}
	function clearProp() {
		if (!prop) return;
		prop.g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.material && !o.material.userData.shared) o.material.dispose(); });
		prop.g.removeFromParent(); prop = null;
	}

	// ---------- asking ----------
	// chatter asks whether this passer-by wants a favour instead of a word in passing
	function maybeAsk(p, { afraid = false, force = false, talking = false, want = null } = {}) {
		if (E || (cool > 0 && !force) || afraid || !p || p.leaving || p.P.dna.child || p.P.dna.minor || p.role === 'jog' || (!talking && (p.engaged || p.override)) || p.held) return null;
		if (!talking && (driving() || world()?.player?.state?.flying)) return null;
		if (!force && !talking && pacing && !pacing.ready('favour')) return null;
		if (!force && Math.random() > (tally.done < 2 ? 0.3 : 0.18)) return null;
		const W = world(); if (!W) return null;
		const me = pos(p), cam = camera.position, f = camera.getWorldDirection(_v);
		// someone to be the friend: walking off (catch), or waiting about (pass)
		const others = people.pool.filter((q) => q !== p && q.active && !q.leaving && !q.P.dna.child && !q.P.dna.minor && !q.engaged && !q.override && !q.held && q.demo === undefined);
		const walking = others.filter((q) => q.role === 'walk' && (q.route?.kind === 'street' || q.route?.kind === 'loop' || q.route?.kind === 'wander') && flat(pos(q), me) > 16 && flat(pos(q), me) < 60);
		const waiting = others.filter((q) => (q.route?.kind === 'seat' || q.role === 'wait' || q.role === 'chat') && flat(pos(q), me) > 20 && flat(pos(q), me) < 75);
		const kinds = ['lost', 'escort', 'survey', 'cleanup'], who = persona(p);
		if (walking.length) kinds.push('catch');
		if (waiting.length) kinds.push('pass');
		const neighbours = others.filter((q) => flat(pos(q), me) > 12 && flat(pos(q), me) < 75);
		if (neighbours.length) kinds.push('firstaid', 'courier', 'checkin');
		// a parked car of theirs close by that will not start
		const car = (W.street?.parkedNear?.(me.x, me.z, 25) || []).filter((c) => c.id && !String(c.id).startsWith('tr') && Math.hypot(c.x - me.x, c.z - me.z) > 3).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
		if (car) kinds.push('repair', 'jumpstart', 'groceries');
		// or they are not from round here, and want the way (one in five or so)
		if ((p.P.dna.seed >>> 0) % 5 === 2 || want === 'directions') kinds.push('directions');
		// a pothole down the street that nearly had their wheel (one not yet reported)
		const hole = potholes()?.nearest?.(me.x, me.z, 110) || null;
		if (hole && hole.d > 0) kinds.push('pothole');
		// their dog, run off somewhere 30 to 90 m away (one dog at a time)
		const spot = !pet && (want === 'pet' || Math.random() < 0.6) ? dropSpot(me, 30, 90) : null;
		if (spot) kinds.push('pet');
		const kind = want && kinds.includes(want) ? want : pacing ? pacing.choose(kinds, force || talking) : kinds[Math.abs(n + (p.P.dna.seed | 0)) % kinds.length];
		if (!kind) return null;
		const spec = kind === 'pet' ? dogSpec(((p.P.dna.seed | 0) * 31 + n * 7) >>> 0) : null;
		const friend = kind === 'catch' ? walking[(n * 7) % walking.length] : kind === 'pass' ? waiting[(n * 5) % waiting.length] : ['firstaid', 'courier', 'checkin'].includes(kind) ? neighbours[n % neighbours.length] : null;
		const dir = friend ? relativeDir(pos(friend).x - cam.x, pos(friend).z - cam.z, f.x, f.z) : 'over there';
		const offer = LOCAL_TASKS[kind] ? localOffer(kind, who, friend ? persona(friend) : null) : offerFor({ who: { first: who.first, seed: p.P.dna.seed }, n, kinds: [kind], friend: friend ? { first: persona(friend).first } : null, dir: spec ? relativeDir(spot.x - cam.x, spot.z - cam.z, f.x, f.z) : kind === 'pothole' ? relativeDir(hole.x - cam.x, hole.z - cam.z, f.x, f.z) : dir, car: !!car, pet: spec, pothole: kind === 'pothole' ? { street: hole.street } : null });
		if (!offer) return null;
		let drop = null, route = null;
		if (['escort', 'survey', 'cleanup'].includes(kind)) {
			route = [];
			for (let i = 0; i < (kind === 'escort' ? 1 : 3); i++) {
				let point = null;
				for (let j = 0; j < 8; j++) { const at = dropSpot(me, 15, kind === 'escort' ? 55 : 40); if (at && route.every((r) => flat(r, at) > 8)) { point = at; break; } }
				if (!point) return null; route.push(point);
			}
			drop = route[0];
		}
		if (offer.kind === 'lost') { drop = dropSpot(me); if (!drop) return null; }
		if (offer.kind === 'pet') drop = spot;
		if (offer.kind === 'groceries') drop = { x: car.x, y: car.y ?? me.y, z: car.z };
		if (offer.kind === 'pothole') drop = { x: hole.x, y: world()?.island?.heightAt?.(hole.x, hole.z) ?? me.y, z: hole.z };
		n++;
		E = { ...offer, route, elapsed: 0, checkpoint: 0, hole: offer.kind === 'pothole' ? hole : null, car: kind === 'repair' || kind === 'jumpstart' || kind === 'groceries' ? { x: car.x, y: car.y ?? me.y, z: car.z } : null, talking, stage: 'offered', giver: p, giverName: who.first, friendP: friend, drop, t: 0, from: { x: me.x, z: me.z }, centre: drop && { x: drop.x + (Math.random() - 0.5) * 9, y: drop.y, z: drop.z + (Math.random() - 0.5) * 9 } };
		pacing?.record(kind);
		hold(p, 'stand');
		if (friend) hold(friend, kind === 'catch' ? 'walk' : 'stand');
		if (tally.done < 2) hint(isPhone ? `${who.first} is asking for help. Walk up and tap Help to say yes.` : `${who.first} is asking for help. Walk up and press Enter to say yes.`, 5000);
		return { text: offer.ask, gesture: offer.kind === 'lost' ? 'open' : 'point', feel: { surprise: 0.3, sad: offer.kind === 'lost' ? 0.3 : offer.kind === 'pet' ? 0.7 : 0 } };
	}

	// ---------- moving it on ----------
	let lastEnd = '';
	function go(ev) {
		const r = step(E, ev);
		if (!r.out) return;
		lastEnd = `${E.stage} > ${ev}`;
		E = { ...r.E, giver: E.giver, friendP: E.friendP, t: 0 };
		const o = r.out;
		if (o.say === 'checked' && E.friendP?.active) chatter.say(E.friendP, { text: lineFor('checked'), gesture: 'nod', feel: { joy: 0.5 } }, null);
		if (o.say === 'accept' && E.giver.active) chatter.say(E.giver, { text: lineFor('accept', { kind: E.kind, n }), gesture: 'nod', feel: { joy: 0.5 } }, null);
		if (o.say === 'accept' && (E.kind === 'groceries' || E.kind === 'escort') && E.giver.active) hold(E.giver, 'follow');
		if (o.thief) dropBag();
		if (o.say === 'found') { clearProp(); hint(`Found ${E.item.the}. Bring ${E.item.id === 'keys' || E.item.id === 'glasses' ? 'them' : 'it'} back to ${E.giverName}.`, 3500); }
		const her = E.item.pet?.she === false ? 'him' : 'her', She = E.item.pet?.she === false ? 'He' : 'She';
		if (o.say === 'befriended' && pet) { pet.phase = 'follow'; voice?.play('yip', pet.dog.pos, pet.dog.size); hint(`${E.item.name} trusts you. ${She} will follow you: bring ${her} back to ${E.giverName}.`, 4500); }
		if (o.say === 'strayed' && pet) { pet.phase = 'lost'; pet.home = { ...pet.dog.pos }; E.centre = { ...pet.home }; hint(`${E.item.name} lost sight of you. Go back for ${her}.`, 3500); }
		if (o.done) finish(o.say);
		else if (o.failed && E.kind === 'snatch') { const t = E.friendP; end(lineFor('escaped', { n }), 0); if (t) release(t); }
		else if (o.kept) keep(o.cash);
		else if (o.failed) end(o.say ? lineFor(o.say, {}) : null);
		else if (o.declined) { const was = E; end(null); handoff()?.(was); }
	}
	function finish(say) {
		const to = ['catch', 'pass', 'courier', 'firstaid'].includes(E.kind) ? E.friendP : E.giver;
		const metres = LOCAL_TASKS[E.kind] ? (E.route ? E.route.reduce((total, r, i) => total + flat(r, E.route[i - 1] || E.from), 0) : flat(pos(to), E.from)) : E.kind === 'repair' || E.kind === 'jumpstart' ? 120 : E.kind === 'directions' ? 0 : E.kind === 'groceries' || E.kind === 'pothole' ? flat(E.drop, E.from) : E.kind === 'lost' || E.kind === 'snatch' || E.kind === 'pet' ? flat(E.drop, E.from) * 2 : flat(pos(to), E.from);
		// the dog home: it runs to them (the reunion plays on after the favour is done)
		if (E.kind === 'pet' && pet) { pet.phase = 'reunion'; pet.t = 0; pet.owner = E.giver; }
		const credits = rewardFor(E.kind, metres);
		if (to?.active) {
			chatter.say(to, { text: lineFor(say, { kind: E.kind, item: E.item, friend: E.giverName, n }), gesture: say === 'caught' || say === 'reunited' ? 'laugh' : 'wave', feel: { joy: 1, surprise: say === 'caught' || say === 'reunited' ? 0.6 : 0.2 } }, null);
			to.M.S.feel.joy = 1;
		}
		const paid = credits ? arms()?.apply?.({ id: `favour:${E.giverName}:${Date.now()}`, kind: 'trade', peer: 'favour', give: { credits: 0, items: [] }, get: { credits, items: [] } }) : { ok: false };
		// (out of their own pocket, through the bank's adapter)
		if (credits && E.giver?.P?.dna) money()?.spend?.(`npc:${E.giver.P.dna.seed >>> 0}`, credits, 'reward', 'player');
		morality()?.record?.({ kind: E.kind === 'snatch' ? 'return-stolen' : E.kind === 'directions' ? 'give-directions' : 'favour', target: E.giverName, world: worldKey(), place: placeName() });
		tally.done++; save(); note('favour', { kind: E.kind });
		const up = promoted('favours', tally.done - 1, tally.done);
		const m = (up ? `You are now known as: ${up}.` : '') || milestone(tally.done);
		hint(`${paid?.ok === false ? 'Favour done' : `+${credits} credits`}: ${E.title}.${m ? ' ' + m : ''}`, m ? 6000 : 3500);
		end(null, 7);
	}
	function keep(cash) {
		if (cash) arms()?.apply?.({ id: `kept:${E.giverName}:${Date.now()}`, kind: 'trade', peer: 'found', give: { credits: 0, items: [] }, get: { credits: cash, items: [] } });
		const stolen = E.kind === 'snatch', groceries = E.kind === 'groceries';
		if (cash && E.giver?.P?.dna) money()?.spend?.(`npc:${E.giver.P.dna.seed >>> 0}`, cash, 'theft', 'player');
		morality()?.record?.({ kind: stolen ? 'keep-stolen' : groceries ? 'betray-errand' : 'kept-wallet', target: E.giverName, world: worldKey(), place: placeName() });
		tally.kept++; save();
		hint(stolen ? `You kept ${E.giverName}'s ${E.item.name}. They never got it back.` : groceries ? `You walked off with ${E.giverName}'s groceries.` : `You kept the wallet: ${cash} credits. ${E.giverName} is still looking for it.`, 5000);
		end(null);
	}
	// over: the people go back to their day (after a moment, if they are speaking)
	let releaseAt = [];
	function end(say, after = 0) {
		const g = E?.giver, f = E?.friendP;
		if (say && g?.active) chatter.say(g, { text: say, gesture: 'shrug', feel: { sad: 0.3 } }, null);
		for (const p of [g, f]) if (p) releaseAt.push([p, clock + (after || (say ? 4 : 0))]);
		clearProp();
		// a dog not brought home wanders off out of sight
		if (pet && pet.phase !== 'reunion') { pet.phase = 'leave'; pet.t = 0; }
		try { E?.onEnd?.(lastEnd); } catch { /* theirs */ }
		E = null; cool = isPhone ? 90 : 60;
	}

	// ---------- the dog ----------
	function spawnPet() {
		const spec = E.item.pet, dog = createDog({ seed: spec.seed, breed: spec.breed, isPhone });
		const at = E.drop;
		dog.place(at.x, at.y, at.z, Math.random() * 6.28); dog.pose('sad');
		voice = voice || createDogVoice(camera);
		dog.onSound = (k, p) => voice.play(k, p, dog.size);
		scene.add(dog.root);
		pet = { dog, phase: 'lost', home: { x: at.x, z: at.z }, t: 0, speed: 0, last: null, near: 0, owner: null };
	}
	function dropPet() { if (!pet) return; pet.dog.dispose(); pet = null; }
	function petUpdate(dt) {
		if (!pet) return;
		const me = feet(), d = pet.dog, at = d.pos;
		// how fast you are coming (a run frightens it)
		const sp = pet.last ? Math.hypot(me.x - pet.last.x, me.z - pet.last.z) / Math.max(dt, 1e-3) : 0;
		pet.last = { x: me.x, z: me.z }; pet.speed += (Math.min(sp, 30) - pet.speed) * Math.min(1, dt * 4); pet.t += dt;
		const ctx = { ground: groundAt, walls: keepWalls, you: me, home: pet.home, mode: 'lost' };
		if (pet.phase === 'lost') { ctx.mode = flat(me, at) < 12 ? 'wary' : 'lost'; ctx.rushing = pet.speed > RUSH || driving(); }
		else if (pet.phase === 'follow') { ctx.mode = 'follow'; ctx.keep = 2.8; }
		else if (pet.phase === 'reunion' || pet.phase === 'home') {
			ctx.mode = pet.phase; ctx.owner = pet.owner?.active ? pos(pet.owner) : me;
			if (pet.phase === 'reunion' && pet.t > 7) { pet.phase = 'home'; pet.t = 0; }
		}
		d.update(dt, ctx);
		voice?.pant(dt, d.panting(), at, d.size);
		// gone once nobody is watching: home with its person, or off on its own
		const far = flat(me, at) > 45;
		if ((pet.phase === 'home' && (pet.t > 40 || far || !pet.owner?.active)) || (pet.phase === 'leave' && (far || pet.t > 25))) dropPet();
	}

	// ---------- the talk control says Help while someone is asking ----------
	const asking = (p) => !!E && E.stage === 'offered' && E.giver === p;
	function accept() { if (E?.stage === 'offered') go('accept'); }

	function update(dt) {
		cool = Math.max(0, cool - dt); clock += dt;
		if (releaseAt.length) releaseAt = releaseAt.filter(([p, t]) => { if (clock < t) return true; release(p); return false; });
		if (prop) { gT += dt; prop.s.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(gT * 3.1)); prop.s.scale.setScalar(0.35 + 0.2 * Math.max(0, Math.sin(gT * 3.1 + 1))); }
		snatchCool = Math.max(0, snatchCool - dt);
		petUpdate(dt);
		if (!E) { if (cool <= 0 && snatchCool <= 0 && (snatchLook -= dt) < 0) { snatchLook = 5; if (Math.random() < 0.08) snatch(); } return; }
		E.t += dt;
		if (E.stage !== 'offered') E.elapsed = (E.elapsed || 0) + dt;
		if (E.deadline && E.elapsed > E.deadline) { end('The delivery window has passed. No reward was paid.'); return; }
		const me = feet(), g = E.giver, f = E.friendP;
		// the people in it carried off by something else (a fight, a crowd thinning): it ends
		if ((g || !E.home) && lost(g) && E.stage !== 'chase' && E.stage !== 'carry') { go('lost-them'); return; }
		if (f && lost(f) && (E.stage === 'chase' || E.stage === 'carry' || E.stage === 'offered' || ['aid', 'courier', 'visit'].includes(E.stage))) { go('lost-them'); return; }
		if (E.stage === 'offered') {
			if (E.t > (E.talking ? 90 : OFFER_FOR) || flat(me, pos(g)) > OFFER_REACH + 4) go('decline');
			return;
		}
		if (E.stage === 'thief') {
			const t = E.friendP;
			// (brought down some other way, they drop it all the same; gone from the world, it is gone)
			if (t?.P?.ragdoll) { go('catch-thief'); return; }
			if (lost(t)) { go('escaped'); return; }
			if (flat(me, pos(t)) < 2.1) go('catch-thief');
			else if (E.t > 50 || flat(me, pos(t)) > 170) go('escaped');
			return;
		}
		if (E.t > (LIMIT[E.stage] || 300)) { go('timeout'); return; }
		if (LOCAL_TASKS[E.kind]) {
			const near = (at, r) => flat(me, at) < r && Math.abs(me.y - (at.y ?? me.y)) < 2.2 && !driving();
			if (E.stage === 'escort') { if (near(E.drop, 3.5) && flat(pos(g), E.drop) < 4.5) go('reach'); }
			else if (['aid', 'courier', 'visit'].includes(E.stage)) {
				if (near(pos(f), HAND)) { E.near = (E.near || 0) + dt; if (E.near >= (E.stage === 'aid' ? 2 : E.stage === 'visit' ? 1 : 0)) go(E.stage === 'visit' ? 'visited' : 'reach'); } else E.near = 0;
			} else if (E.stage === 'tour') {
				const at = E.route[E.checkpoint];
				if (E.kind === 'cleanup' && !prop) prop = placeProp(E.item.shape, at);
				if (near(at, E.kind === 'cleanup' ? PICK : 3)) E.near = (E.near || 0) + dt; else E.near = 0;
				if (E.near >= (E.kind === 'cleanup' ? 0.05 : 2)) { clearProp(); go('checkpoint'); hint(E.stage === 'reportback' ? `All three done. Return to ${E.giverName}.` : `${E.checkpoint} of 3 done. Follow the next marker.`, 2400); }
			} else if (E.stage === 'reportback' && near(pos(g), HAND)) go('reach');
			if (E && flat(me, E.from) > AWAY) go('away');
			return;
		}
		if (E.stage === 'search' && E.kind === 'pet') {
			if (!pet) spawnPet();
			const d = flat(me, pet.dog.pos), calm = pet.speed < RUSH && !driving();
			pet.near = d < 5 && calm ? pet.near + dt : 0;
			if (d < PET_REACH && pet.near > 0.8) go('befriend');
			else if (flat(me, E.from) > AWAY && d > 60) go('away');
			else if (!E.told && d < 12 && !calm) { E.told = true; hint(`${E.item.name} shies away when you run. Walk up slowly.`, 3500); }
			return;
		}
		if (E.stage === 'lead') {
			if (!pet) { go('lost-them'); return; }
			if (flat(pet.dog.pos, pos(g)) < PET_HOME) go('reach');
			else if (flat(me, pet.dog.pos) > 40) go('strayed');
			else if (flat(me, E.from) > AWAY) go('away');
			return;
		}
		if (E.stage === 'search') {
			if (!prop) prop = placeProp(E.item.shape, E.drop);
			if (flat(me, E.drop) < PICK && Math.abs(me.y - E.drop.y) < 2.2 && !driving()) go('pickup');
			else if (flat(me, E.from) > AWAY) go('away');
			return;
		}
		// groceries: to the car, with them walking behind; off down the street with them, kept
		if (E.stage === 'haul') {
			if (flat(me, E.drop) < 2.6) go('reach');
			else if (flat(me, E.drop) > 60 && flat(me, pos(g)) > 30) go('away');
			return;
		}
		// a flat battery: stand by the car a moment while they try it
		if (E.stage === 'jump') {
			if (flat(me, E.car) > AWAY) { go('away'); return; }
			if (flat(me, E.car) < 4.5) { E.near = (E.near || 0) + dt; if (!E.told) { E.told = true; hint(`Stand by the car while ${E.giverName} tries it.`, 3000); } }
			if (E.near > 3.5) go('jumped');
			return;
		}
		// the way: pointed out, and they thank you
		if (E.stage === 'tell') { if (E.t > 1.2) go('told'); return; }
		// a pothole: stand by it a moment (or drive right over it) and the report goes in
		if (E.stage === 'report') {
			if (flat(me, E.from) > AWAY && flat(me, E.drop) > 60) { go('away'); return; }
			const d = flat(me, E.drop);
			if (d < (driving() ? 2.2 : 3.2)) { E.near = (E.near || 0) + dt; if (!E.told && !driving()) { E.told = true; hint('Reporting the pothole...', 1600); } }
			else E.near = 0;
			if (E.near > (driving() ? 0.05 : 1.5)) { potholes()?.report?.(E.hole); go('reported'); hint('Reported. The city is sending a road crew to fill it.', 4000); }
			return;
		}
		if (E.stage === 'fix') {
			if (flat(me, E.car) > AWAY) { go('away'); return; }
			// beside the car with a repair roll in the bag: it comes to hand, ready to use
			if (!E.handed && flat(me, E.car) < 4.5) {
				E.handed = true;
				const A = arms(), st = A?.state?.(), held = A?.held?.(), roll = st && Object.values(st.instances || {}).find((x) => x.i === 'repair-roll');
				if (held?.i === 'repair-roll') hint(isPhone ? 'Tap Use to fix the car.' : 'Press U to fix the car.', 3000);
				else if (roll) { A.hold?.(roll.u); hint(isPhone ? 'Your Repair Roll is in hand. Tap Use to fix the car.' : 'Your Repair Roll is in hand. Press U to fix the car.', 3500); }
				else { E.handed = false; if (!E.told) { E.told = true; hint('You need a Repair Roll for this. Outfitters, traders and supermarkets sell them.', 4500); } }
			}
			return;
		}
		if (E.stage === 'bring') {
			if (flat(me, ownerAt()) < (g ? HAND : 3.5)) go('reach');
			else if (flat(me, E.from) > AWAY) go('away');
			return;
		}
		if (E.stage === 'chase' || E.stage === 'carry') {
			if (flat(me, pos(f)) < HAND && Math.abs(me.y - pos(f).y) < 2.5) {
				// the friend stops to take it
				hold(f, 'stand');
				go('reach');
			} else if (flat(me, pos(f)) > AWAY + 30) go('away');
		}
	}

	// the pin and the chip (guide.js asks every second)
	function mark() {
		if (!E || E.stage === 'offered' || E.stage === 'tell') return null;
		if (LOCAL_TASKS[E.kind]) {
			const at = E.stage === 'escort' ? E.drop : E.stage === 'tour' ? E.route[E.checkpoint] : E.stage === 'reportback' ? pos(E.giver) : pos(E.friendP);
			const detail = E.stage === 'escort' ? 'walk with them; wait if they fall behind' : E.stage === 'tour' ? `${E.checkpoint + 1} of 3 · ${E.kind === 'cleanup' ? 'collect the litter' : 'inspect for 2 seconds'}` : E.stage === 'reportback' ? 'return to report' : E.stage === 'aid' ? 'stay beside them for 2 seconds' : E.stage === 'visit' ? 'check in, then return' : 'hand over the parcel';
			return { ...at, radius: 2, title: E.title, detail: detail + (E.deadline ? ` · ${Math.max(0, Math.ceil(E.deadline - E.elapsed))}s left` : '') };
		}
		if (E.stage === 'haul') return { ...E.drop, radius: 2.5, title: `Carry ${E.giverName}'s groceries to the car`, detail: 'they are right behind you' };
		if (E.stage === 'jump') return { ...E.car, radius: 3, title: E.title, detail: 'stand by the car while they try it' };
		if (E.stage === 'report') return { ...E.drop, radius: 2.5, title: E.title, detail: 'stand by it to report it' };
		if (E.stage === 'fix') return { ...E.car, radius: 3, title: E.title, detail: 'use a Repair Roll beside it' };
		if (E.stage === 'thief') { const q = pos(E.friendP); return { x: q.x, y: q.y, z: q.z, radius: 2, title: 'Catch the thief', detail: `${E.giverName}'s ${E.item.name}, or let them go` }; }
		if (E.stage === 'search' && E.kind === 'snatch') return { ...E.drop, radius: 2, title: `Pick up ${E.giverName}'s ${E.item.name}`, detail: 'they dropped it' };
		if (E.stage === 'search' && E.kind === 'pet') {
			const d = pet?.dog.pos;
			if (d && flat(feet(), d) < 25) return { x: d.x, y: d.y, z: d.z, radius: 3, title: `There is ${E.item.name}`, detail: 'walk up slowly' };
			return { ...E.centre, radius: 16, title: E.title, detail: 'last seen around here' };
		}
		if (E.stage === 'lead') { const q = pos(E.giver); return { x: q.x, y: q.y, z: q.z, radius: 2, title: `Bring ${E.item.name} back to ${E.giverName}`, detail: `${E.item.pet?.she === false ? 'he' : 'she'} is following you` }; }
		if (E.stage === 'search') return { ...E.centre, radius: 9, title: E.title, detail: 'search the marked patch' };
		if (E.stage === 'bring') { const q = ownerAt(); return { x: q.x, y: q.y ?? feet().y, z: q.z, radius: 2, title: `Bring ${E.item.the} back to ${E.giverName}`, detail: E.item.cash || E.kind === 'snatch' ? 'or keep it' : 'they are waiting' }; }
		const q = pos(E.friendP);
		return { x: q.x, y: q.y, z: q.z, radius: 2, title: E.title, detail: E.stage === 'chase' ? 'catch up with them' : `from ${E.giverName}` };
	}
	// what a person in an errand knows, for a conversation with them
	function factFor(p) {
		if (!E || (p !== E.giver && p !== E.friendP)) return null;
		if (p === E.giver && E.kind === 'pet') return E.stage === 'offered' ? `Just asked the player for help: ${E.ask}` : E.stage === 'lead' ? `The player found their dog ${E.item.name} and is bringing the dog back. Relieved.` : `Worried sick: their dog ${E.item.name} ran off, and the player is looking for the dog.`;
		if (p === E.giver && E.kind === 'pothole') return E.stage === 'offered' ? `Just asked the player for help: ${E.ask}` : `The player is off to report the pothole that nearly took their wheel. Hopeful the city will fill it at last.`;
		if (p === E.giver && (E.kind === 'groceries' || E.kind === 'jumpstart' || E.kind === 'directions')) return E.stage === 'offered' ? `Just asked the player for help: ${E.ask}` : `The player is helping: ${E.title.toLowerCase()}. Grateful.`;
		if (p === E.giver) return E.stage === 'offered' ? `Just asked the player for help: ${E.ask}` : E.stage === 'search' ? `Waiting while the player searches for ${E.item.mine || E.item.the}.` : E.stage === 'bring' ? `The player found ${E.item.the} and has not given it back yet.` : `Asked the player to take ${E.item.the} to ${E.friend}.`;
		return E.stage === 'chase' ? `Walking on, unaware they left ${E.item.the} with ${E.giverName}.` : `Waiting here; ${E.giverName} sent something over with the player.`;
	}
	// (for the console and the tests: the nearest grown-up asks now; their words go through chatter)
	function askNearest(want = null) {
		const c = camera.position, q = people.pool.filter((p) => p.active && !p.P.dna.child && !p.P.dna.minor).sort((a, b) => flat(pos(a), c) - flat(pos(b), c))[0];
		const line = q && maybeAsk(q, { force: true, want });
		if (line) chatter.say(q, line, null);
		return line ? E.title : 'nobody near to ask';
	}
	// a bag snatched near you: one grown-up the victim, another runs off with it
	function snatch(force = false) {
		if (E || driving() || world()?.player?.state?.flying || (!force && pacing && !pacing.ready('snatch'))) return 'busy';
		const c = feet(), ok = (q) => q.active && !q.leaving && !q.P.dna.child && !q.P.dna.minor && !q.engaged && !q.override && !q.held && q.demo === undefined && q.route?.kind !== 'seat' && !q.workSpot;
		const near = people.pool.filter((q) => ok(q) && flat(pos(q), c) > 10 && flat(pos(q), c) < 40);
		if (near.length < 2) return 'not enough people about';
		const victim = near[0], thief = near.slice(1).sort((a, b) => flat(pos(a), pos(victim)) - flat(pos(b), pos(victim)))[0];
		if (!force && flat(pos(thief), pos(victim)) > 25) return 'nobody close enough';
		// the thief takes it: they are at the victim's side, then off
		const v = pos(victim), side = Math.random() * 6.28;
		thief.M.place(v.x + Math.cos(side) * 1.2, v.y, v.z + Math.sin(side) * 1.2, side);
		const who = persona(victim);
		E = { kind: 'snatch', stage: 'thief', giver: victim, giverName: who.first, friendP: thief, item: { name: 'bag', the: 'the bag', shape: 'bag' }, title: `Get ${who.first}'s bag back`, t: 0, from: { x: v.x, z: v.z } };
		pacing?.record('snatch');
		hold(victim, 'stand'); flee(thief, 5.4);
		chatter.say(victim, { text: lineFor('snatched', { n: n++ }), gesture: 'point', feel: { surprise: 1, anger: 0.6 } }, null);
		victim.M.S.feel.surprise = 1;
		// everyone near saw it: they are shaken, and say so (world-awareness.js)
		const key = world()?.body?.key, ev = { id: 'snatch:' + Date.now(), at: Date.now(), bodyKey: key, actorId: 'npc', actorName: 'a bag thief', kind: 'robbery', line: `snatched ${who.first}'s bag` };
		if (key) for (const q of people.pool) if (q.active && q !== thief && flat(pos(q), v) < 40) rememberIncident(q, ev);
		snatchCool = isPhone ? 300 : 240;
		hint(`Someone just grabbed ${who.first}'s bag! Catch the thief.`, 4000);
		return E.title;
	}
	function dropBag() {
		const t = E.friendP, q = pos(t);
		const y = groundAt(q.x, q.z) ?? q.y;
		E.drop = { x: q.x, y, z: q.z };
		prop = placeProp('bag', E.drop);
		chatter.say(t, { text: lineFor('dropped', { n: n++ }), gesture: 'shrug', feel: { surprise: 1 } }, null);
		flee(t, 6);
		releaseAt.push([t, clock + 8]);
		// taking it off them is neither good nor bad: giving it back is what counts
		morality()?.record?.({ kind: 'take-from-thief', target: E.giverName, world: worldKey(), place: placeName() });
		note('thief', {});
		try { E.onDrop?.(); } catch { /* theirs */ }
	}
	// someone else's theft in front of you (people/npc-quests.js): the thief has it already and
	// walks off quickly. victim: the person robbed, or none and home: { x, y, z } (a business)
	// with owner its name; item: { name, the, shape }; onDrop, onEnd: told when it changes hands.
	// lead: when it was taken, for a thief tracked down later (npc-leads.js): no outcry then
	function theft({ victim = null, home = null, owner = '', thief, item = null, speed = 2.6, onDrop = null, onEnd = null, lead = null } = {}) {
		if (E || !thief || (!victim && !home) || driving() || world()?.player?.state?.flying) return false;
		const it = { name: 'bag', the: 'the bag', shape: 'bag', ...(item || {}) };
		it.the = item?.the || `the ${it.name}`;
		const who = victim ? persona(victim).first : owner || 'the owner', at = victim ? pos(victim) : home;
		E = { kind: 'snatch', stage: 'thief', giver: victim, home: victim ? null : { x: home.x, y: home.y ?? feet().y, z: home.z }, giverName: who, friendP: thief, item: it, title: `Get ${who}'s ${it.name} back`, t: 0, from: { x: at.x, z: at.z }, onDrop, onEnd };
		if (victim) hold(victim, 'stand');
		if (victim && !lead) {
			chatter.say(victim, { text: lineFor('snatched', { n: n++, item: it }), gesture: 'point', feel: { surprise: 1, anger: 0.6 } }, null);
			victim.M.S.feel.surprise = 1;
		}
		flee(thief, speed);
		const key = world()?.body?.key, ev = { id: 'theft:' + Date.now(), at: Date.now(), bodyKey: key, actorId: 'npc', actorName: 'a thief', kind: 'robbery', line: `took ${who}'s ${it.name}` };
		if (key) for (const q of people.pool) if (q.active && q !== thief && flat(pos(q), at) < 40) rememberIncident(q, ev);
		snatchCool = Math.max(snatchCool, isPhone ? 200 : 150);
		hint(lead ? `That looks like the one who took ${who}'s ${it.name} ${lead}. Catch them and take it, or let them go.` : `Someone just walked off with ${who}'s ${it.name}. Catch them and take it, or let them go.`, 4500);
		return E.title;
	}
	// asked in a conversation whether they need anything: a favour of their own, or nothing
	function offerTo(p) { const line = maybeAsk(p, { force: true, talking: true }); return line ? { text: line.text, title: E.title } : null; }
	// an item used where a favour needs it (gameplay/item-use.js asks first): true if it did
	function useHere(itemId) {
		if (!needs(itemId)) return false;
		go('fixed');
		return true;
	}
	function needs(itemId) { return E?.stage === 'fix' && itemId === 'repair-roll' && flat(feet(), E.car) < 4.5; }
	function cancel() { if (E) go(E.stage === 'offered' ? 'decline' : 'timeout'); }
	// someone who fell, helped to their feet by you (people/npc-quests.js): the deed, their thanks
	function helped({ kind = 'fall', p = null, name = '' } = {}) {
		if (E) return false;
		morality()?.record?.({ kind: 'help-fallen', target: name || 'someone', world: worldKey(), place: placeName() });
		tally.done++; save(); note('favour', { kind });
		if (p?.active) chatter.say(p, { text: lineFor('helpedUp', { n: n++ }), gesture: 'nod', feel: { joy: 0.6 } }, null);
		hint(`You helped ${name || 'them'} up. ${milestone(tally.done) || ''}`.trim(), 3500);
		return true;
	}
	function dispose() { if (E) { for (const p of [E.giver, E.friendP]) release(p); E = null; } for (const [p] of releaseAt) release(p); releaseAt = []; clearProp(); dropPet(); voice?.dispose(); voice = null; glintTex?.dispose(); glintTex = null; }
	function info() {
		const r = (v) => Math.round(v * 10) / 10;
		return { errand: E && { kind: E.kind, stage: E.stage, title: E.title, giver: E.giverName, friend: E.friend || null, t: Math.round(E.t), drop: E.drop && [E.drop.x, E.drop.y, E.drop.z].map(r) }, pet: pet && { phase: pet.phase, mood: pet.dog.mood(), breed: pet.dog.breed.id, name: pet.dog.name, at: [r(pet.dog.pos.x), r(pet.dog.pos.z)] }, cool: Math.round(cool), pacing: pacing?.info(), last: lastEnd, ...tally };
	}
	return { maybeAsk, offerTo, useHere, needs, askNearest, petNow: () => askNearest('pet'), snatch: () => snatch(true), theft, helped, busy: () => !!E, asking, accept, update, mark, factFor, cancel, dispose, info, active: () => !!E && E.stage !== 'offered' };
}
