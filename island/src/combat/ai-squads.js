// The armed people of the world and the things that hunt in it, in squads (combat/factions.js
// says who they are and whom they hate): gangs on the city's streets, militias and rangers in
// the hills, raiders on the desert worlds, smugglers on the coasts, contract hunters sent after
// a bounty, a village's own Hearthguard, the patrol answering a wanted level, rogue drones and
// the Deep's gloomcrawlers. They fight each other as readily as you: a raid on a village, two
// gangs over a corner, raiders against raiders. Each squad has a little sense: they hear
// gunfire and call it out, take cover by crates and rocks, one pins a target down while others
// flank, they reload, fall back when hurt, and a beaten fighter may throw down their weapon and
// surrender, after which they are protected and can leave the fight.
//
// Few at once (fewer on a phone); bodies are pooled and reused. A person struck down goes limp
// (people/ragdoll.js) and fades; a drone drops and bursts; a crawler curls up and sinks away.
// A fire crew (on Earth) walks to a fire and puts it out.
//
// A squad may hold a post (military/: a base's gate, a watchtower, a patrol loop inside the
// fence, a checkpoint, a militia compound): it stands or walks its beat there, answers what it
// sees, and is pulled back to the post when the fight strays too far from it. Sides that are
// stationed are never made away from a post (ctx.mayStation). Each side dresses by its own
// look (combat/outfits.js).
//
// The law's hooks (law/index.js through combat.hooks): officers hold their fire and close in to
// arrest while the ladder says so (ctx.holdFire), a crew on a street corner minds its own
// business with a patrol about (ctx.ignore), anyone called back to a car or a vehicle (recall)
// stops fighting and walks to it, bodies are kept out of buildings (ctx.keepOut) and sidestep
// when they make no headway, and a fallen fighter waiting for the ambulance stays where they
// fell until it has been (awaitMedic, collected).

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA, freeBody } from '../people/body.js';
import { peopleCap } from '../world/governor.js';
import { createMotion } from '../people/motion.js';
import { fadePerson } from '../people/fade.js';
import { createHealth, applyDamage, tickHealth } from './health.js';
import { personShapes } from './targets.js';
import { npcHand } from './weapon-view.js';
import { FACTIONS, PLAYER, shouldSurrender } from './factions.js';
import { FIELD_ROLES } from './field-contracts.js';
import { outfitFor, kitArmour } from './outfits.js';
import { bodyShapes, aimPoint } from './hitzones.js';
import { createWounds, react, pace } from './wounds.js';
import { applyClutch } from '../crysis/held-items.js';
import { createClimber, climbBody } from './npc-climb.js';
import { SPECIES } from '../creatures/catalog.js';
import { makeCreature } from '../creatures/models.js';
import { createCreatureVoice } from '../creatures/voice.js';
import { facetLook } from '../creatures/facets.js';
import { crystalLegs } from '../creatures/crystal-legs.js';
import { hollowKing } from '../creatures/hollow-king.js';

// the bodies: people (dressed by faction), and those that are not (a creature's own are made
// from its kind: creatures/catalog.js)
const BODY = {
	drone: { speed: 7, sight: 65, range: 55, dmg: 9, burst: [1, 2], gap: [1.4, 2.2], rate: 0.35, surface: 'machine', resist: { ballistic: 0.85, energy: 1.35 } },
	crawler: { speed: 6.5, sight: 40, range: 18, dmg: 12, burst: [1, 1], gap: [3, 5], rate: 1, surface: 'creature', resist: { fire: 1.4 } },
	person: { speed: 3.9, sight: 60, range: 70, dmg: 7, burst: [2, 5], gap: [1.0, 2.2], rate: 0.15, surface: 'person' },
};
const CALL = {
	default: { contact: ['Contact!', 'There!', 'We have company!'], flank: ['Flanking left!', 'Going round!', 'Moving up!'], reload: ['Reloading!', 'Changing cells!'], down: ['Man down!', 'We lost one!'], hit: ['I\'m hit!', 'Agh! I\'m hit!', 'Hit! I\'m hit!'], pin: ['Keep them pinned!', 'Covering fire!'], give: ['Enough! I yield!', 'Don\'t shoot! I\'m done!'] },
	law: { contact: ['Patrol! Drop your weapon!', 'Suspect sighted!', 'Hold it right there!'], flank: ['Moving to flank!', 'Cutting them off!'], reload: ['Reloading!'], down: ['Officer down!'], pin: ['Suppressing!', 'Stay in cover!'], give: ['I\'m down, I\'m down!'] },
	villagers: { contact: ['Raiders! Protect the houses!', 'To the walls!'], flank: ['Round the back of the barn!'], reload: ['Arrows!'], down: ['They got Tam!'], pin: ['Keep their heads down!'], give: ['Mercy!'] },
	police: { contact: ['Police! Drop it!', 'Show me your hands!', 'Suspect in sight!'], flank: ['Cover the back!', 'Cutting across!'], reload: ['Reloading!'], down: ['Officer down! Officer down!'], pin: ['Stay behind the car!', 'Hold them there!'], give: ['Okay! Okay! I\'m down!'] },
	military: { contact: ['Contact front!', 'Hostiles, on me!', 'Halt! Halt!'], flank: ['Bounding left!', 'Second team, flank!'], reload: ['Changing mag!'], down: ['Man down! Medic!'], pin: ['Suppress, suppress!', 'Keep fire on them!'], give: ['Cease fire, I yield!'] },
	invaders: { contact: ['Forward! Take the town!', 'Defenders ahead!'], flank: ['Round their side!'], reload: ['Reloading!'], down: ['We lost one!'], pin: ['Pin them down!'], give: ['Enough! We yield!'] },
	// your own guild's people (guild/companions.js)
	guild: { contact: ['With you! I see them!', 'Contact, on your side!', 'Here they come!', 'I\'ve got your back!'], flank: ['Going round them!', 'Taking the flank!'], reload: ['Reloading, cover me!', 'Changing mags!'], down: ['They got one of ours!', 'We lost one! Keep going!'], hit: ['I\'m hit!', 'Ah! Still standing!', 'Hit, I\'m okay!'], pin: ['Keep their heads down!', 'Covering you!'], give: ['Falling back!'] },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// where one fighter's round lands on another (they are not aimed shot by shot): mostly centre
// mass, now and then a limb, rarely the head
const npcPart = () => { const u = Math.random(); return u < 0.08 ? 'head' : u < 0.52 ? 'chest' : u < 0.72 ? 'gut' : u < 0.87 ? 'leg' : 'shoulder'; };
const rnd = (a, b) => a + Math.random() * (b - a);
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
// (where a body without legs of its own stood before this frame's step: ctx.keepOut sweeps from it)
const _was = new THREE.Vector3();
// your guild's people fight what is within this of you, and catch you up past this
const ALLY_LEASH = 70, ALLY_CATCH = 60;

// a faction's look (combat/outfits.js), from the fighter's own seed
function styleOf(fid, seed) {
	const F = FACTIONS[fid] || {};
	return outfitFor({ fid, kind: F.kind, colors: F.colors, masked: !!F.masked }, seed);
}

let K = null;
function kit() {
	if (K) return K;
	K = {
		metal: new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.45, metalness: 0.7 }),
		dark: new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.6, metalness: 0.4 }),
		eye: new THREE.MeshBasicMaterial({ color: 0xff4a2a, toneMapped: false }),
		mask: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.25, metalness: 0.6 }),
		slit: new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }),
		chitin: new THREE.MeshStandardMaterial({ color: 0xb9c2c8, roughness: 0.5, metalness: 0.05 }),
		glowG: new THREE.MeshBasicMaterial({ color: 0x7affc8, toneMapped: false }),
		sphere: new THREE.SphereGeometry(1, 16, 12),
		cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
		ring: new THREE.TorusGeometry(1, 0.08, 6, 20).rotateX(Math.PI / 2),
	};
	return K;
}
function droneMesh() {
	const k = kit(), g = new THREE.Group();
	const body = new THREE.Mesh(k.sphere, k.metal); body.scale.set(0.42, 0.24, 0.5); g.add(body);
	const eye = new THREE.Mesh(k.sphere, k.eye.clone()); eye.scale.setScalar(0.09); eye.position.set(0, -0.04, 0.44); g.add(eye);
	const rotors = [];
	for (const [x, z] of [[0.55, 0.45], [-0.55, 0.45], [0.55, -0.45], [-0.55, -0.45]]) {
		const arm = new THREE.Mesh(k.cyl, k.dark); arm.scale.set(0.03, Math.hypot(x, z), 0.03); arm.position.set(x / 2, 0.05, z / 2); arm.rotation.set(Math.PI / 2, 0, Math.atan2(x, z)); g.add(arm);
		const ring = new THREE.Mesh(k.ring, k.dark); ring.scale.setScalar(0.26); ring.position.set(x, 0.08, z); g.add(ring);
		const blade = new THREE.Mesh(k.cyl, k.metal); blade.scale.set(0.24, 0.01, 0.03); blade.rotation.z = Math.PI / 2; blade.position.set(x, 0.09, z); g.add(blade); rotors.push(blade);
	}
	g.userData.rotors = rotors; g.userData.eye = eye;
	return g;
}
function crawlerMesh() {
	const k = kit(), g = new THREE.Group();
	const abd = new THREE.Mesh(k.sphere, k.chitin); abd.scale.set(0.42, 0.3, 0.6); abd.position.set(0, 0.55, -0.45); g.add(abd);
	const tho = new THREE.Mesh(k.sphere, k.chitin); tho.scale.set(0.32, 0.26, 0.36); tho.position.set(0, 0.6, 0.15); g.add(tho);
	const head = new THREE.Mesh(k.sphere, k.chitin); head.scale.set(0.22, 0.18, 0.24); head.position.set(0, 0.62, 0.55); g.add(head);
	for (const s of [-1, 1]) { const e = new THREE.Mesh(k.sphere, k.glowG); e.scale.setScalar(0.045); e.position.set(0.1 * s, 0.68, 0.74); g.add(e); }
	for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(k.sphere, k.glowG); sp.scale.setScalar(0.05); sp.position.set((i % 2 ? 0.18 : -0.18), 0.8, -0.2 - i * 0.15); g.add(sp); }
	const legs = [];
	for (let i = 0; i < 6; i++) {
		const s = i % 2 ? 1 : -1, row = Math.floor(i / 2);
		const pivot = new THREE.Group(); pivot.position.set(0.22 * s, 0.6, 0.3 - row * 0.3);
		const up = new THREE.Mesh(k.cyl, k.chitin); up.scale.set(0.035, 0.55, 0.035); up.position.set(0.25 * s, 0.08, 0); up.rotation.z = -1.1 * s; pivot.add(up);
		const lo = new THREE.Mesh(k.cyl, k.chitin); lo.scale.set(0.028, 0.7, 0.028); lo.position.set(0.55 * s, -0.25, 0); lo.rotation.z = 0.35 * s; pivot.add(lo);
		g.add(pivot); legs.push({ pivot, s, ph: row * 2.1 + (s > 0 ? Math.PI : 0) });
	}
	g.userData.legs = legs;
	return g;
}
// a sealed mask over a person's face, on their head bone
function maskOn(P, glow) {
	const k = kit(), hb = P.bones[P.map.head];
	if (!hb) return;
	P.root.position.set(0, 0, 0); P.root.rotation.set(0, 0, 0); P.root.updateMatrixWorld(true);
	const wp = hb.getWorldPosition(new THREE.Vector3()), inv = new THREE.Matrix4().copy(hb.matrixWorld).invert();
	const m = new THREE.Group();
	const shell = new THREE.Mesh(k.sphere, k.mask); shell.scale.set(0.105, 0.12, 0.085); m.add(shell);
	const slit = new THREE.Mesh(k.sphere, new THREE.MeshBasicMaterial({ color: glow, toneMapped: false })); slit.scale.set(0.075, 0.012, 0.02); slit.position.set(0, 0.03, 0.075); m.add(slit);
	m.position.copy(wp.clone().add(new THREE.Vector3(0, 0.035, 0.055)).applyMatrix4(inv));
	const q = new THREE.Quaternion(); hb.getWorldQuaternion(q); m.quaternion.copy(q.invert());
	const s = new THREE.Vector3(); hb.getWorldScale(s); m.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
	hb.add(m);
}

export function createSquads(ctx) {
	const { layer, fx, isPhone, relations } = ctx;
	const group = new THREE.Group(); group.name = 'combat-squads';
	// (as many as the quality tier's people share allows: world/governor.js; at least a squad of three)
	const MAX0 = isPhone ? 6 : 14, maxNow = () => peopleCap(MAX0, 3);
	const list = [];
	const pools = { person: [], drone: [], crawler: [], creature: [] };
	const squads = new Map();
	let A = null, loading = null, nextId = 1, epoch = 0;
	const pending = new Set();
	// the creatures' growls, snarls and the rest, from where they stand (creatures/voice.js)
	const voice = createCreatureVoice({ eye: ctx.eye, yaw: () => ctx.yaw?.() ?? 0, isPhone });
	const assets = () => { if (A) return Promise.resolve(A); if (!loading) loading = loadPeopleAssets().then((a) => (A = a)); return loading; };

	// people are made one a frame, in the background, and kept for the next squad of their side
	const queue = [];
	// (one of your guild's townsfolk comes as themselves: their own body, dna, and their own
	// hand, gun or none, kept for them by their key)
	function personBody(fid, seed, dna = null, gun) {
		const key = dna ? `dna:${dna.seed}` : null;
		const free = pools.person.find((b) => !b.used && b.fid === fid && (b.key || null) === key);
		if (free) { free.used = true; return Promise.resolve(free); }
		return new Promise((res) => {
			const job = () => {
			const F = FACTIONS[fid] || {};
			const d = dna ? structuredClone(dna) : personDNA(seed, { age: 22 + (seed % 30), style: styleOf(fid, seed) });
			const P = buildPerson(A, d), g = gun !== undefined ? gun : F.gun;
			if (F.masked) maskOn(P, F.colors?.[0] || '#ff7a2a');
			// (over a fence or up a ledge, combat/npc-climb.js: the climb's own floor while it lasts)
			const b = { P, M: createMotion(P, (x, z) => (b.climbY != null ? b.climbY : ctx.ground(x, z, P.root.position.y + 1.2)), { constrain: (pos, from) => b.climbY == null && ctx.keepOut?.(pos, from) }), climbY: null, fid, key, used: true, hand: g ? npcHand(group, g, 2 + (seed % 4), seed % 3) : null };
			group.add(P.root);
			pools.person.push(b);
			res(b);
			};
			job.cancel = () => res(null);
			queue.push(job);
		});
	}

	// one at (x, z) of a faction, in a squad
	async function spawn(fid, x, z, squad, opts = {}) {
		// (your guild's people come over and above it on a computer: guild/companions.js keeps their
		// own count; on a phone they share it, so no fight ever draws more bodies than it did before)
		if ((!opts.ally || isPhone) && alive().length + pending.size >= maxNow()) return null;
		// (a stationed side only at a post: a base, a checkpoint, a compound)
		if (FACTIONS[fid]?.stationed && ctx.mayStation && !ctx.mayStation(fid, x, z)) return null;
		const generation = epoch, reservation = {};
		pending.add(reservation);
		try {
			// (the Deep's gloomcrawlers are the Gloomcrawler kind now, a creature like the others)
			const species = opts.species ?? (fid === 'gloom' ? 'gloomcrawler' : null);
			const Sp = SPECIES[species];
			const kind = Sp ? 'creature' : fid === 'rogue' ? 'drone' : fid === 'gloom' ? 'crawler' : 'person';
			const specialty = kind === 'person' ? FIELD_ROLES[opts.specialty] : null;
			const F = { ...(FACTIONS[fid] || {}), ...(specialty ? { gun: specialty.gun, hp: specialty.hp, armour: specialty.armour, acc: specialty.acc } : {}), ...(Sp ? { hp: Sp.hp, armour: Sp.armour, gun: null } : {}), ...(opts.F || {}) };
			const B = Sp ? { speed: Sp.run, sight: Sp.sight, range: Sp.reach, dmg: Sp.dmg, surface: Sp.surface, resist: Sp.resist } : { ...BODY[kind], ...(specialty || {}), ...(opts.B || {}) };
			const id = opts.id || `h${fid.slice(0, 2)}${nextId++}`;
			const h = {
				id, fid, F, kind, B, squad, specialty, crew: fid === 'fire', Sp, cr: null, strikeT: -1,
				H: createHealth({ max: (F.hp || 100) * (opts.hpK || 1), armour: opts.armour ?? F.armour ?? 0, soak: 0.5, resist: B.resist || {} }),
				pos: new THREE.Vector3(x, 0, z), yaw: opts.yaw || 0, alert: 0, role: 'assault', goal: null, goalT: 0, fireT: rnd(0.6, 1.2), burst: 0, mag: 12,
				losT: 0, los: false, target: null, targetT: 0, deadT: 0, hover: rnd(4, 7), ph: Math.random() * 10, home: { x, z }, body: null, mesh: null, leap: 0, spitT: rnd(2, 4),
				provoked: false, shotAtPlayer: 0, struckFirst: false, surrendered: 0, task: opts.task || null, post: opts.post || squad?.post || null, slot: squad ? squad.members.length : 0,
				W: createWounds(), react: null, climb: null, lowK: Math.random(),
				// one of your guild's townsfolk (their record in guild/guild-rules.js), and a while
				// they have fired on the law (only then does the law fire back on them)
				ally: opts.ally || null, hitLaw: 0, castT: rnd(1, 2),
			};
			// (a mage of yours carries no gun: spells only)
			if (h.ally && !F.gun) h.noGun = true;
			h.pos.y = ctx.ground(x, z, opts.y ?? ctx.eye().y);
			if (kind === 'person') {
				await assets();
				if (generation !== epoch) return null;
				const b = await personBody(fid, (Math.random() * 1e9) >>> 0, opts.dna || null, opts.ally ? (F.gun || null) : undefined);
				if (!b) return null;
				if (h.gone || generation !== epoch) { b.used = false; b.P.root.visible = false; b.hand?.hide(); return null; }
				h.body = b;
				// what they wear turns blows too: plates more than a rig, a helmet some (outfits.js)
				if (opts.armour == null && b.P.dna?.style) { const k = kitArmour(b.P.dna.style); h.H.armour = h.H.armourMax = Math.round(h.H.armourMax * k); }
				// Pooled bodies may have served another role: always restore this spawn's kit.
				if (b.hand && F.gun) b.hand.set(F.gun, opts.level || 2 + (b.P.dna.seed % 4 || 0), opts.tier ?? (specialty ? 1 : b.P.dna.seed % 3 || 0));
				// Preserve the exact weapon represented by this pooled body's hand model.
				const held = b.hand?.model?.userData;
				h.loadout = held ? { i: F.gun, l: held.level, t: held.tier, x: 0 } : null;
				if (b.P.ragdoll) ctx.ragdolls.release(b.P);
				b.P.root.visible = true; fadePerson(b.P, 1);
				b.M.act(null); b.M.place(x, h.pos.y, z, h.yaw);
				b.M.S.limp.side = 0; b.M.S.limp.k = 0; b.M.S.clutch = null; b.M.want.low = 0; b.climbY = null;
			} else if (kind === 'creature') {
				// (one that is a person first, the Moonturned: the person's body now, the beast's kept for the change)
				const c = await creatureBody(Sp.human ?? Sp.model ?? species, species, Sp.human ? null : Sp.look ?? null);
				const beast = c && Sp.human ? await creatureBody(Sp.model ?? species, species, Sp.look ?? null) : null;
				if (!c || (Sp.human && !beast) || h.gone || generation !== epoch) {
					for (const q of [c, beast]) if (q) { q.used = false; q.root.visible = false; }
					return null;
				}
				h.cr = c; h.beast = beast; h.turn = beast ? -1 : 1;
				// no two alike: each its own size, build and colour (creatures/models.js); a person's
				// skin barely turns
				c.size = c.vary(Math.random, { hue: Sp.human ? 0.15 : 1 });
				if (beast) { beast.size = beast.vary(); beast.root.visible = false; }
				// one that waits, still among the trees, for you to come too close (the Burnt Giant)
				h.dormant = Sp.lurk && !opts.alert ? 1 : 0; h.waking = -1;
				if (h.dormant) h.yaw = Math.random() * 6.283;
				c.root.visible = true; c.root.position.copy(h.pos); c.root.rotation.set(0, h.yaw, 0);
				c.motion.state.death = -1; c.motion.state.strike = -1; c.motion.state.hit = -1;
				c.motion.state.beat = null; c.motion.state.menace = 0; c.motion.drain();
				c.facets?.reset();
				c.motion.update(0, { speed: 0, dormant: h.dormant });
			} else {
				const pool = pools[kind];
				let m = pool.find((q) => !q.userData.used);
				if (!m) { m = kind === 'drone' ? droneMesh() : crawlerMesh(); pool.push(m); group.add(m); }
				m.userData.used = true; m.visible = true; m.scale.setScalar(1); m.rotation.set(0, h.yaw, 0);
				h.mesh = m;
				if (kind === 'drone') h.pos.y += h.hover;
			}
			h.T = {
				id, kind: 'hostile', faction: fid, bound: { x, y: h.pos.y + 1, z, r: Sp ? Math.max(1, Sp.height * 0.55) : 1.4 }, name: Sp ? (/^the /i.test(Sp.name) ? Sp.name : `${/^[aeiou]/i.test(Sp.name) ? 'an' : 'a'} ${Sp.name}`) : F.name ? `${/^[aeiou]/i.test(F.name) ? 'an' : 'a'} ${F.name.replace(/s$/, '')} fighter` : 'a fighter',
				get surrendered() { return h.surrendered > 0 || h.fleeing; },
				surface: B.surface, shapes: () => shapesOf(h), ref: h,
				aim: () => (h.body ? aimPoint(h.body.P) : null),
				onHit: (blow) => hit(h, blow),
				moral: () => ({ hostileTarget: h.alert > 0 && !h.surrendered && (h.provoked || relations.hostile(fid, PLAYER) || (h.target?.id === 'me')), selfDefence: h.shotAtPlayer > 0 || h.struckFirst, surrendered: h.surrendered > 0, fleeing: h.role === 'fallback', lawTarget: !!F.lawful, unarmed: h.crew }),
			};
			if (h.crew) { h.T.faction = 'civ'; h.T.name = 'a firefighter'; }
			// (yours: on your side of every shot, never in your sights, called by their own name)
			else if (h.ally) { h.T.kind = 'ally'; h.T.faction = PLAYER; h.T.name = h.ally.name; }
			else if (specialty) h.T.name = `${F.name} ${specialty.name.toLowerCase()}`;
			layer.add(h.T);
			list.push(h);
			if (squad) squad.members.push(h);
			return h;
		} finally { pending.delete(reservation); }
	}
	// the feel for what is ahead, with the walking's own tests (player.js floorAt, pushOut), per world
	let climb0 = null, climbW = null;
	function climber() {
		const w = ctx.world?.(), pl = w?.player;
		if (!pl?.floorAt || !pl.pushOut) return null;
		if (climbW !== w) { climb0 = createClimber({ floorAt: pl.floorAt, pushOut: pl.pushOut }); climbW = w; }
		return climb0;
	}
	function shapesOf(h) {
		const p = h.pos;
		if (h.kind === 'creature') return h.cr.shapes();
		if (h.kind === 'drone') return [{ type: 'sphere', c: { x: p.x, y: p.y, z: p.z }, r: 0.5, part: 'body' }, { type: 'sphere', c: { x: p.x + Math.sin(h.yaw) * 0.45, y: p.y - 0.04, z: p.z + Math.cos(h.yaw) * 0.45 }, r: 0.12, part: 'weak' }];
		if (h.kind === 'crawler') {
			const a = Math.sin(h.yaw), c = Math.cos(h.yaw);
			return [{ type: 'capsule', a: { x: p.x - a * 0.8, y: p.y + 0.55, z: p.z - c * 0.8 }, b: { x: p.x + a * 0.3, y: p.y + 0.6, z: p.z + c * 0.3 }, r: 0.38, part: 'body' }, { type: 'sphere', c: { x: p.x + a * 0.58, y: p.y + 0.62, z: p.z + c * 0.58 }, r: 0.22, part: 'head' }];
		}
		return (h.body && bodyShapes(h.body.P)) || personShapes(p.x, p.y, p.z, h.body?.P.height || 1.75, h.crouch || (h.surrendered ? 0.5 : 0));
	}
	const alive = () => list.filter((h) => !h.dead);

	function hit(h, blow) {
		if (h.dead || h.surrendered || h.fleeing || h.restrained) return null;
		// (the Facet Wraith's shell turns most of a blow until it opens)
		if (h.cr?.facets) blow = { ...blow, amount: blow.amount * h.cr.facets.exposure() };
		const r = applyDamage(h.H, blow);
		if (h.dormant && h.waking < 0) h.waking = 0;
		h.standT = 0;
		const by = blow.by;
		if (by) {
			// the one who struck them is their enemy now, whatever the old feelings
			h.provoked = h.provoked || by.id === 'me';
			if (by.ref) h.lastHitBy = by.ref;
			if (!h.surrendered) { h.target = by; h.targetT = 6; }
			for (const m of h.squad?.members || []) if (!m.dead && !m.surrendered) { if (by.id === 'me') m.provoked = true; if (!m.target) { m.target = by; m.targetT = 6; } }
		}
		if (!h.alert) alertSquad(h, blow.src);
		h.hurtT = 0.25;
		// a round that lands knocks them: the chest and head snap back or round with it, a beat
		// held as it lands, the aim thrown off; one behind cover ducks back down
		if (!r.killed && !blow.melee && h.body && !h.body.P.ragdoll && r.dealt > 0) {
			const d = blow.dir || { x: h.pos.x - (blow.src?.x ?? h.pos.x), z: h.pos.z - (blow.src?.z ?? h.pos.z) }, l = Math.hypot(d.x, d.z) || 1;
			const k = Math.min(2.2, 0.55 + r.dealt / Math.max(1, h.H.max) * 3.5) * (blow.type === 'blast' ? 1.8 : 1) * (blow.part === 'head' ? 1.4 : 1);
			h.body.M.jolt?.(d.x / l, d.z / l, k, blow.part === 'head' ? (Math.random() - 0.5) * 1.6 : (Math.random() - 0.5) * 0.5, k > 1.2 ? 0.06 : 0.03);
			h.fireT = Math.max(h.fireT, rnd(0.35, 0.7));
			if (h.inCover && h.peek) { h.peek = false; h.peekT = rnd(0.9, 1.8); }
			// how it shows, by where it went in (combat/wounds.js): a hand to it, a stagger, a limp
			const R = react(h.W, h.body.M, h.body.P, blow, r, { max: h.H.max, armed: !!h.body.hand?.model && !h.noGun });
			if (R) {
				h.react = { t: R.name ? R.dur : 0.4, age: 0, push: R.stagger, ax: d.x / l, az: d.z / l };
				h.fireT = Math.max(h.fireT, R.hold);
				if (R.crippled) { h.goal = null; say(h, 'hit', true); }
				else if (R.part === 'head' || R.part === 'neck' || R.part === 'chest') { if (Math.random() < 0.5) say(h, 'hit'); }
			}
		}
		// a creature reels the way the blow went (and a heavy one breaks off its strike)
		if (!r.killed && h.cr && r.dealt > 0) {
			if (h.beast && h.turn < 0) h.turn = 0;
			const d = blow.dir || { x: h.pos.x - (blow.src?.x ?? h.pos.x), z: h.pos.z - (blow.src?.z ?? h.pos.z) }, l = Math.hypot(d.x, d.z) || 1;
			// (the blow's way in the creature's own frame: x to its left, z ahead)
			const c = Math.cos(h.yaw), s = Math.sin(h.yaw), wx = d.x / l, wz = d.z / l;
			h.cr.motion.hit(_v.set(wx * c - wz * s, 0, wx * s + wz * c));
			if (r.dealt > h.H.max * 0.12 && h.strikeT >= 0 && h.strikeT < 0.4) { h.strikeT = -1; h.cr.motion.state.strike = -1; h.fireT = rnd(0.5, 0.9); }
		}
		if (r.killed) die(h, blow);
		else if (!h.surrendered && h.kind === 'person' && !h.crew && !h.ally) {
			const allies = (h.squad?.members || []).filter((m) => m !== h && !m.dead && !m.surrendered).length;
			if (shouldSurrender({ hpFrac: h.H.hp / h.H.max, allies, enemies: 1 + (by?.id === 'me' ? ctx.friendsNear?.() || 0 : 1), aggression: h.F.aggression, kind: h.F.kind })) surrender(h);
			else if (h.H.hp < h.H.max * 0.35 && h.role !== 'fallback') { h.role = 'fallback'; h.goalT = 0; }
		}
		return r;
	}
	// weapon down, on their knees, hands up: out of the fight, until they slip away
	function surrender(h) {
		h.surrendered = 25; h.target = null; h.role = 'yield'; h.alert = 1;
		h.body?.hand?.hide(); h.noGun = true;
		h.body?.M.act('crouch', 0);
		say(h, 'give', true);
		ctx.onSurrender?.(h);
	}
	function die(h, blow) {
		h.dead = true; h.deadT = 0;
		layer.remove(h.id);
		const rest = (h.squad?.members || []).filter((m) => !m.dead && !m.surrendered);
		if (rest.length) say(rest[0], 'down');
		const d = blow?.dir || { x: 0, z: 0 };
		if (h.body) {
			const p = h.pos;
			h.body.M.act(null);
			// (a blast throws them, a blow shoves them, a bullet barely moves them: they drop)
			ctx.ragdolls.hit(h.body.P, { vel: new THREE.Vector3(d.x, 0.1, d.z).normalize().multiplyScalar(blow?.type === 'blast' ? 7 : 3.5), mass: blow?.type === 'blast' ? 400 : blow?.melee ? 90 : 30, point: new THREE.Vector3(p.x, p.y + 1.2, p.z), lift: 0.06, limp: 1 });
			h.body.hand?.hide();
		} else if (h.kind === 'drone') { fx.explosion(h.pos, 1.2, false); h.vy = 0; }
		else if (h.cr) h.cr.motion.die();
		else fx.dust(h.pos, 6, 0.5, 0.55, 0.5, 0.8, 0.5);
		ctx.onDeath?.(h, blow);
	}
	function release(h) {
		const i = list.indexOf(h);
		if (i >= 0) list.splice(i, 1);
		layer.remove(h.id);
		h.gone = true;
		if (h.body) { if (h.body.P.ragdoll) ctx.ragdolls.release(h.body.P); h.body.P.root.visible = false; h.body.hand?.hide(); h.body.M.act(null); h.body.used = false; h.body.M.want.speed = 0; }
		if (h.mesh) { h.mesh.visible = false; h.mesh.userData.used = false; }
		for (const q of [h.cr, h.beast]) if (q) { q.root.visible = false; q.used = false; q.root.position.y = -1e4; }
		if (h.squad) { const k = h.squad.members.indexOf(h); if (k >= 0) h.squad.members.splice(k, 1); if (!h.squad.members.length) squads.delete(h.squad.id); }
	}

	function say(h, what, force = false) {
		const lines = (CALL[h.F.kind] || CALL.default)[what] || CALL.default[what];
		if (!lines || (h.saidT > 0 && !force)) return;
		const d = Math.hypot(h.pos.x - ctx.eye().x, h.pos.z - ctx.eye().z);
		if (d > 50) return;
		h.saidT = 4;
		ctx.call?.(pick(lines), h.ally?.first || h.F.name || 'someone');
	}
	function alertSquad(h, src) {
		const mem = h.squad ? h.squad.members : [h];
		let k = 0;
		for (const m of mem) {
			if (m.dead || m.alert || m.crew || m.dormant) continue;
			m.alert = 1; m.fireT = rnd(0.7, 1.4); m.goalT = 0;
			m.role = m.specialty?.tactic || (m.kind === 'drone' ? 'orbit' : m.kind === 'crawler' || m.kind === 'creature' ? 'rush' : k === 0 ? 'suppress' : k % 2 ? 'flank' : 'assault');
			m.flankSide = k % 4 < 2 ? 1 : -1;
			k++;
		}
		if (src && h.squad) h.squad.last = { x: src.x, z: src.z };
		const first = mem.find((m) => !m.dead && !m.crew);
		if (first) say(first, 'contact');
	}
	// gunfire heard at (x, z): squads within earshot wake
	function hear(x, z, r = 60) {
		for (const h of alive()) {
			const d = Math.hypot(h.pos.x - x, h.pos.z - z);
			// (gunfire close by wakes a sleeping giant; further off it stays a tree)
			if (h.dormant) { if (d < Math.min(r, 30) && h.waking < 0) h.waking = 0; continue; }
			if (!h.alert && !h.crew && d < r) alertSquad(h, { x, z });
		}
	}

	// whom to fight: the nearest enemy in sight: you (if they hate you or you struck them),
	// another side's fighter, or (for raiders and their like) the villagers and townsfolk
	const ME = { id: 'me', kind: 'player', faction: PLAYER };
	function chooseTarget(h, eye) {
		if (h.recall) return null;
		if (h.ally) return allyTarget(h, eye);
		const F = h.F;
		let best = null, bd = h.B.sight * (h.alert ? 1.8 : 1);
		const dMe = Math.hypot(eye.x - h.pos.x, eye.z - h.pos.z);
		const hateMe = h.provoked || relations.hostile(h.fid, PLAYER) || (F.lawful && F.kind !== 'military' && ctx.wanted() > 0) || (F.kind === 'military' && (ctx.wanted() >= 5 || !!ctx.trespass?.(h))) || (F.kind === 'mercs' && ctx.bounty() > 0);
		if (hateMe && !ctx.playerDown() && !ctx.cloaked?.() && dMe < bd) { best = ME; bd = dMe; }
		// (the police on your side after you were fired on: whoever opened fire on you is theirs)
		const backMe = F.lawful && F.kind !== 'military' && ctx.defending?.();
		for (const o of list) {
			if (o === h || o.dead || o.surrendered || o.crew || o.recall || o.fid === h.fid || ctx.ignore?.(h, o)) continue;
			// (your guild's people: fought by whoever fights you, and the law only once they fire on it)
			if (o.ally) { if (!(F.lawful ? o.hitLaw > 0 : hateMe || h.lastHitBy === o)) continue; }
			else if (!relations.hostile(h.fid, o.fid) && !(backMe && o.struckFirst && !o.F?.lawful)) continue;
			const d = Math.hypot(o.pos.x - h.pos.x, o.pos.z - h.pos.z);
			if (d < bd) { bd = d; best = o.T; }
		}
		if (!best && (F.kind === 'raiders' || F.kind === 'creatures' || F.kind === 'machines') && h.squad?.raid) {
			for (const T of ctx.civilians()) {
				if (T.child || !relations.hostile(h.fid, T.faction)) continue;
				const d = Math.hypot(T.bound.x - h.pos.x, T.bound.z - h.pos.z);
				if (d < bd) { bd = d; best = T; }
			}
		}
		return best;
	}
	// one of your guild's: whoever is after you or them, near you; the law only when it opens fire
	function allyTarget(h, eye) {
		let best = null, bd = h.B.sight * 1.5;
		for (const o of list) {
			if (o === h || o.ally || o.dead || o.surrendered || o.crew || o.recall || o.fleeing || o.dormant) continue;
			const foe = o.F?.lawful ? o.shotAtPlayer > 0 || !!o.target?.ref?.ally : o.target?.id === 'me' || !!o.target?.ref?.ally || o.provoked || o.shotAtPlayer > 0 || relations.hostile(PLAYER, o.fid);
			if (!foe || Math.hypot(o.pos.x - eye.x, o.pos.z - eye.z) > ALLY_LEASH) continue;
			const d = Math.hypot(o.pos.x - h.pos.x, o.pos.z - h.pos.z);
			if (d < bd) { bd = d; best = o.T; }
		}
		return best;
	}
	const posOf = (T) => (T.id === 'me' ? ctx.eye() : _w.set(T.bound.x, T.bound.y + 0.4, T.bound.z));

	// where to go: by a bit of cover facing the target, round its side, or in close
	function chooseGoal(h, at) {
		const dx = h.pos.x - at.x, dz = h.pos.z - at.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
		let R = 20, ang = 0;
		if (h.role === 'suppress') R = rnd(20, 28);
		else if (h.role === 'flank') { R = rnd(14, 20); ang = h.flankSide * rnd(0.9, 1.3); }
		else if (h.role === 'assault') R = rnd(8, 13);
		else if (h.role === 'fallback') R = rnd(32, 42);
		if (h.specialty && h.role !== 'fallback') R = rnd(...h.specialty.distance);
		// guns holstered: officers close right in to make the arrest
		const arrest = h.target?.id === 'me' && ctx.holdFire?.(h);
		if (arrest) { R = rnd(1.6, 2.6); ang = 0; }
		const c = Math.cos(ang), s = Math.sin(ang);
		let gx = at.x + (ux * c - uz * s) * R, gz = at.z + (ux * s + uz * c) * R;
		const cover = arrest ? null : ctx.coverNear?.(gx, gz, 9);
		if (cover) { const cx = cover.x - at.x, cz = cover.z - at.z, cl = Math.hypot(cx, cz) || 1; gx = cover.x + cx / cl * (cover.r + 0.7); gz = cover.z + cz / cl * (cover.r + 0.7); h.inCover = true; } else h.inCover = false;
		h.goal = { x: gx, z: gz };
		h.goalT = rnd(4, 7);
		if (h.role === 'flank') say(h, 'flank');
	}

	function shoot(h, dt) {
		const B = h.B, T = h.target;
		h.fireT -= dt;
		if (h.fireT > 0 || !h.los || !T || h.noGun) return;
		if (T.id === 'me' && ctx.holdFire?.(h)) { h.fireT = 0.4; return; }
		const to0 = posOf(T).clone(), from = h.kind === 'drone' ? h.pos.clone() : h.kind === 'crawler' ? new THREE.Vector3(h.pos.x, h.pos.y + 0.65, h.pos.z) : muzzleOf(h);
		const dist = from.distanceTo(to0), atMe = T.id === 'me';
		if (dist > B.range) return;
		if (atMe) { h.shotAtPlayer = 8; if (!h.provoked && !h.F?.lawful) h.struckFirst = true; }
		if (h.ally && T.ref?.F?.lawful) h.hitLaw = 12;
		if (h.kind === 'crawler') {
			if (dist < 5 || h.spitT > 0) return;
			h.spitT = rnd(3.5, 5.5);
			ctx.projectile({ from, to: to0.add(_v.set(0, -0.3, 0)), speed: 22, drop: 6, dmg: B.dmg * 0.8, type: 'energy', owner: h.T, style: 4, splash: 0.8, hostile: true });
			h.fireT = rnd(...B.gap);
			return;
		}
		if (h.kind === 'drone') {
			ctx.projectile({ from, to: to0, speed: 45, drop: 0, dmg: B.dmg, type: 'energy', owner: h.T, style: 4, splash: 0.6, hostile: true });
			h.fireT = rnd(...B.gap);
			return;
		}
		// a burst: each round a chance to hit, by distance, the target's movement, their role
		if (h.burst <= 0) h.burst = Math.round(rnd(...B.burst)) * (h.role === 'suppress' && !h.specialty ? 2 : 1);
		h.burst--; h.mag--;
		const moving = atMe ? Math.min(1, (ctx.me().speed || 0) / 6) : 0.3;
		const pHit = (h.F.acc || 0.4) * Math.max(0.15, 1 - dist / (B.range * 1.1)) * (1 - 0.5 * moving) * (h.role === 'suppress' && h.specialty?.name !== 'Marksman' ? 0.6 : 1) * (atMe ? ctx.coverK?.() ?? 1 : 1);
		const hitIt = Math.random() < pHit;
		const to = to0.clone().add(_v.set(0, atMe ? -0.35 : 0, 0));
		if (!hitIt) to.add(_v.set(rnd(-1, 1), rnd(-0.6, 0.8), rnd(-1, 1)).multiplyScalar(0.8 + dist * 0.03));
		const dir = to.clone().sub(from).normalize();
		const style = h.F.kind === 'law' || h.F.kind === 'police' || h.F.kind === 'military' ? 1 : h.F.gun === 'warden-spark-carbine' ? 2 : 4;
		// (what stands in the way takes it: a child's ward, cover, someone else)
		const block = ctx.firstHit(from, dir, Math.min(B.range, dist + 30), h.T);
		let end = hitIt ? to : from.clone().addScaledVector(dir, Math.min(B.range, dist + 30));
		if (block && block.t < from.distanceTo(end) - 0.3) { end = from.clone().addScaledVector(dir, block.t); ctx.landShot(block, from, dir, h, B.dmg); }
		else if (hitIt) {
			if (atMe) ctx.hurtPlayer({ amount: B.dmg * rnd(0.85, 1.15), type: 'ballistic', part: 'torso', src: from, by: h.T });
			else ctx.strikeNpc(T, { amount: B.dmg * 2.2 * rnd(0.85, 1.15), type: 'ballistic', part: npcPart(), src: from, dir, by: h.T }, end);
		} else if (atMe) ctx.whiz?.(from, end);
		fx.tracer(from, end, style, 380);
		fx.muzzle(from, dir, style === 2 ? 2 : 0);
		if (style !== 2) fx.casing?.({ x: from.x - dir.x * 0.35, y: from.y - dir.y * 0.35, z: from.z - dir.z * 0.35 }, dir);
		ctx.gunshot?.(from, h.F.gun);
		ctx.heard?.(from, h);
		if (h.mag <= 0) { reloadGun(h); return; }
		h.fireT = h.burst > 0 ? B.rate : rnd(...B.gap);
		if (h.role === 'suppress' && Math.random() < 0.08) say(h, 'pin');
	}
	function muzzleOf(h) {
		const m = h.body?.hand?.model;
		if (m?.visible) return _v.set(0.8, 0.1, 0).applyMatrix4(m.matrix).clone();
		return new THREE.Vector3(h.pos.x + Math.sin(h.yaw) * 0.5, h.pos.y + 1.35, h.pos.z + Math.cos(h.yaw) * 0.5);
	}

	// ---------- each frame ----------
	let time = 0;
	// spare bodies past what the tier allows let go, one a frame (body.js freeBody; the hand's model too)
	function trimPool() {
		if (pools.person.length <= maxNow() + 2) return;
		const i = pools.person.findIndex((b) => !b.used);
		if (i < 0) return;
		const [b] = pools.person.splice(i, 1);
		b.hand?.set(null);
		if (b.P.ragdoll) ctx.ragdolls.release(b.P);
		freeBody(b.P);
	}
	function update(dt) {
		time += dt;
		if (queue.length) queue.shift()();
		trimPool();
		const eye = ctx.eye();
		for (let i = list.length - 1; i >= 0; i--) {
			const h = list[i];
			h.saidT = Math.max(0, (h.saidT || 0) - dt);
			h.shotAtPlayer = Math.max(0, h.shotAtPlayer - dt);
			if (h.hitLaw) h.hitLaw = Math.max(0, h.hitLaw - dt);
			const d = Math.hypot(h.pos.x - eye.x, h.pos.z - eye.z);
			if (h.dead) { fading(h, dt); continue; }
			if (d > 280 && !h.ally) { release(h); continue; }
			tickHealth(h.H, dt);
			if (h.crew) { crewStep(h, dt, d); bounds(h); continue; }
			if (h.surrendered) { yieldStep(h, dt, d); bounds(h); continue; }
			// held still or put to flight by a spell (magic/caster.js lays h.T.hex on and wears it off)
			const hx = h.T.hex;
			if (hx && (hx.hold > 0 || hx.fear > 0)) { hexStep(h, dt, hx, eye); bounds(h); continue; }
			if (h.dormant) { dormantStep(h, dt, d); bounds(h); continue; }
			// (cloaked, you are lost to those hunting you)
			if (h.target === ME && ctx.cloaked?.()) { h.target = null; h.los = false; }
			// a target, and sight of it, a few times a second
			h.losT -= dt; h.targetT -= dt;
			if (h.losT <= 0) {
				h.losT = rnd(0.2, 0.35);
				if (!h.target || h.targetT <= 0 || h.target.removed || (h.target.ref?.dead) || (h.target.ref?.surrendered)) { h.target = chooseTarget(h, eye); h.targetT = rnd(3, 6); }
				const T = h.target;
				const from = _v.set(h.pos.x, h.pos.y + (h.kind === 'drone' ? 0 : h.kind === 'crawler' ? 0.7 : h.cr ? h.Sp.height * 0.85 : 1.5), h.pos.z);
				h.los = !!T && !ctx.blocked(from, posOf(T));
				if (h.los && !h.alert) alertSquad(h, posOf(T));
				if (h.los && h.squad) h.squad.last = { x: posOf(T).x, z: posOf(T).z };
			}
			if (h.kind === 'drone') droneStep(h, dt);
			else if (h.kind === 'crawler') crawlerStep(h, dt, d);
			else if (h.cr) creatureStep(h, dt, d);
			else personStep(h, dt, d);
			bounds(h);
		}
	}
	function bounds(h) { const B = h.T.bound; B.x = h.pos.x; B.y = h.pos.y + (h.kind === 'drone' ? 0 : h.cr ? h.Sp.height * (h.cr.size || 1) * 0.45 + (h.alt || 0) : 0.9); B.z = h.pos.z; }
	function fading(h, dt) {
		h.deadT += dt;
		if (h.body) {
			// Keep recent nearby fighters long enough to inspect their equipment, and the
			// ground a fight was on strewn with its fallen a while after (two minutes in
			// sight). Older bodies fade independently of drops, at most twelve kept nearby.
			const recent = list.filter((q) => q.dead && q.body).slice(-12).includes(h);
			let keep = recent && Math.hypot(h.pos.x - ctx.eye().x, h.pos.z - ctx.eye().z) < 70 ? 120 : 25;
			// (waiting for the ambulance: kept until it has been, gone soon after)
			if (h.awaitMedic) keep = h.collected ? Math.min(h.deadT, keep) : 100;
			if (h.deadT > keep) { const k = 1 - (h.deadT - keep) / 2; fadePerson(h.body.P, k); if (k <= 0) release(h); }
		} else if (h.kind === 'drone') {
			h.vy = (h.vy || 0) - 9.8 * dt; h.pos.y += h.vy * dt;
			const gy = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1);
			if (h.pos.y < gy + 0.2) { h.pos.y = gy + 0.2; if (!h.burst2) { h.burst2 = true; fx.explosion(h.pos, 1.4); } }
			h.mesh.position.copy(h.pos); h.mesh.rotation.z += dt * 3;
			if (h.deadT > 4) { h.mesh.scale.setScalar(Math.max(0.01, 1 - (h.deadT - 4))); if (h.deadT > 5) release(h); }
		} else if (h.cr) {
			// the death plays out (the knees go, it folds), it lies a while, then sinks away
			const c = h.cr;
			if (h.deadT < 2) c.motion.update(dt, { speed: 0 });
			if (h.deadT < 4) c.facets?.update(dt, { dead: true });
			// (a crystal thing bursts as its legs fold, and is gone)
			if (h.Sp.shatter && h.deadT > 0.3 && c.root.visible) { c.legs?.shatter(fx); c.root.visible = false; voice.play('shatter', h.pos, 0.9); }
			// (a flyer drops out of the air)
			if (h.alt > 0) { h.vy = (h.vy || 0) + 9.8 * dt; h.alt = Math.max(0, h.alt - h.vy * dt); }
			c.root.position.set(h.pos.x, h.pos.y + (h.alt || 0) - Math.max(0, h.deadT - 8) * 0.25 * c.height, h.pos.z);
			// (a biped falls forward as it folds: the whole body tips over its knees; four legs
			// and wings go over in their own death)
			const tip = !c.meta.rig || c.meta.rig === 'biped' ? 1.2 : 0;
			c.root.rotation.set(Math.min(1, h.deadT / 1.3) ** 2 * tip, h.yaw, 0);
			if (h.deadT > 12) release(h);
		} else {
			h.mesh.rotation.z = Math.min(Math.PI * 0.9, h.deadT * 3);
			h.mesh.position.set(h.pos.x, h.pos.y + Math.min(0.6, h.deadT * 0.6) - Math.max(0, h.deadT - 4) * 0.4, h.pos.z);
			if (h.deadT > 6.5) release(h);
		}
	}
	// a fighter under a spell: held, it stands (a drone hangs where it is); afraid, it runs from you
	function hexStep(h, dt, hx, eye) {
		const M = h.body?.M;
		if (hx.hold > 0) { if (M) { M.want.speed = 0; M.want.run = 0; } else if (h.cr) h.cr.motion.update(dt, { speed: 0 }); return; }
		const ax = h.pos.x - eye.x, az = h.pos.z - eye.z, l = Math.hypot(ax, az) || 1;
		h.target = null; h.los = false;
		if (M) { M.want.heading = Math.atan2(ax / l, az / l); M.want.speed = h.B.speed * 1.2 * (hx.slowK || 1); M.want.run = 1; }
		else if (h.kind === 'crawler') { h.yaw = Math.atan2(ax / l, az / l); _was.copy(h.pos); h.pos.x += ax / l * h.B.speed * dt; h.pos.z += az / l * h.B.speed * dt; ctx.keepOut?.(h.pos, _was); h.pos.y = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1); h.mesh.position.copy(h.pos); h.mesh.rotation.set(0, h.yaw, 0); }
		else if (h.cr) {
			const sp = hx.hold > 0 ? 0 : h.Sp.run * (hx.slowK || 1);
			if (sp) { h.yaw = Math.atan2(ax / l, az / l); _was.copy(h.pos); h.pos.x += ax / l * sp * dt; h.pos.z += az / l * sp * dt; ctx.keepOut?.(h.pos, _was); h.pos.y = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1); }
			h.cr.root.position.copy(h.pos); h.cr.root.position.y += flyAlt(h, dt, null); h.cr.root.rotation.set(0, h.yaw, 0);
			h.cr.motion.update(dt, { speed: sp });
		}
	}
	function walk(h, gx, gz, speed, run) {
		const M = h.body.M, pc = pace(h.W);
		speed *= (h.T.hex?.slowK || 1) * pc.k;
		if (!pc.run) run = 0;
		// no headway for a while (a wall, a car in the way): a sidestep along it, then on
		if (h.side > 0) { gx = h.pos.x + h.sideX * 4; gz = h.pos.z + h.sideZ * 4; }
		const dx = gx - h.pos.x, dz = gz - h.pos.z, d = Math.hypot(dx, dz);
		if (d > 1.2) { M.want.heading = Math.atan2(dx, dz); M.want.speed = speed; M.want.run = run; } else { M.want.speed = 0; M.want.run = 0; }
		return d;
	}
	function headway(h, dt) {
		if (h.side > 0) h.side -= dt;
		if (!(h.body?.M.want.speed > 0.5)) { h.stuckT = 0; h.at0 = null; return; }
		if (!h.at0) { h.at0 = { x: h.pos.x, z: h.pos.z }; h.stuckT = 0; return; }
		h.stuckT += dt;
		if (h.stuckT < 1.6) return;
		const moved = Math.hypot(h.pos.x - h.at0.x, h.pos.z - h.at0.z);
		h.at0.x = h.pos.x; h.at0.z = h.pos.z; h.stuckT = 0;
		if (moved > 0.8) return;
		const hd = h.body.M.want.heading, s = Math.random() < 0.5 ? 1 : -1;
		h.sideX = Math.sin(hd + s * 1.7); h.sideZ = Math.cos(hd + s * 1.7); h.side = 1.2;
		if (h.goal) h.goalT = Math.min(h.goalT, 1.3);
	}
	function personStep(h, dt, d) {
		const b = h.body, M = b.M, S = M.S, eye = ctx.eye();
		h.pos.copy(S.pos);
		// wounds (combat/wounds.js): a limp on the bad leg, and a reaction playing out, the first
		// beat of it a stagger back along the round's line
		const pc = pace(h.W);
		S.limp.side = pc.side === 'L' ? 1 : pc.side === 'R' ? -1 : 0; S.limp.k = pc.limp;
		if (h.react) {
			const R0 = h.react;
			R0.age += dt; R0.t -= dt;
			if (R0.push > 0 && R0.age < 0.3 && !h.W.crippled) { const k = R0.push * Math.min(dt, 0.05) / 0.3; S.pos.x += R0.ax * k; S.pos.z += R0.az * k; ctx.keepOut?.(S.pos, h.pos); }
			if (R0.t <= 0) h.react = null;
		}
		// (the knee behind cover is held only while the fight below keeps asking for it)
		if (S.act.name === 'kneel') M.act(null);
		// (raised to the shoulder only while engaging; carried at the ready otherwise)
		let aimAt = null;
		const armed = !!b.hand?.model && !h.noGun;
		// over a fence or up onto a ledge (combat/npc-climb.js): the climb carries them to its end
		if (h.climb) {
			const at = climber()?.step(h.climb, dt);
			b.climbY = !at || at.done ? null : at.feet;
			if (!at || !climbBody(M, h.climb, at, armed)) { h.climb = null; if (!at) M.act(null); }
		}
		M.want.low = 0;
		// at close quarters with you (combat/melee-foes.js steers them: circling, their turns, a
		// takedown): only the body is moved here, and the gun is put away
		if (h.melee) {
			h.yaw = S.heading;
			M.update(dt, time, eye);
			b.P.lod?.(d);
			if (b.hand && !h.noGun) b.hand.follow(b.P, S.heading, false, M, time);
			return;
		}
		// held to a post: a fight that strays too far from it is let go, and they walk back
		const P0 = h.post;
		if (P0 && h.target && Math.hypot(posOf(h.target).x - P0.x, posOf(h.target).z - P0.z) > (P0.r || 40) * 2.5) { h.target = null; h.alert = 0.4; h.goal = null; }
		// (yours keep to you: a fight that runs off is let go, and they come back to your side)
		if (h.ally && h.target && Math.hypot(posOf(h.target).x - eye.x, posOf(h.target).z - eye.z) > ALLY_LEASH * 1.2) { h.target = null; h.alert = 0; h.goal = null; }
		if (h.climb) {
			// (carried by the climb)
		} else if (h.W.crippled) {
			// the leg gone from under them: down on that knee where they fell, still fighting
			M.want.speed = 0; M.want.run = 0;
			const name = `hurt-crippled${h.W.crippled}${b.hand?.model && !h.noGun ? '+' : ''}`;
			if (S.act.name !== name) M.act(name, 0);
			h.crouch = 0.55;
			if (h.target && h.alert) {
				const at = posOf(h.target);
				M.want.heading = Math.atan2(at.x - h.pos.x, at.z - h.pos.z);
				S.look.target = h.target.id === 'me' ? eye : null;
				if (h.los && !h.react) { shoot(h, dt); aimAt = (h.aimV ||= new THREE.Vector3()).copy(at); } else h.fireT = Math.max(h.fireT, 0.3);
			}
		} else if (h.alert && h.target && P0?.kind === 'tower') {
			// up a watchtower: they hold the platform and fire from it
			const at = posOf(h.target);
			M.want.speed = 0; M.want.heading = Math.atan2(at.x - h.pos.x, at.z - h.pos.z);
			S.look.target = h.target.id === 'me' ? eye : null;
			if (h.los && !h.react) { shoot(h, dt); aimAt = (h.aimV ||= new THREE.Vector3()).copy(at); } else h.fireT = Math.max(h.fireT, 0.3);
		} else if (h.alert && h.target) {
			const at = posOf(h.target).clone();
			h.goalT -= dt;
			if (!h.goal || h.goalT <= 0) chooseGoal(h, at);
			const gd = walk(h, h.goal.x, h.goal.z, h.B.speed * (h.role === 'fallback' ? 1.1 : 1), 1);
			const toT = Math.atan2(at.x - h.pos.x, at.z - h.pos.z), dT = Math.hypot(at.x - h.pos.x, at.z - h.pos.z);
			// on the move in sight of the target: they keep their face and their gun on it and
			// move along their way (a strafe, a step back), at a walk with the stock up, firing;
			// a long way to go across open ground, or the way more than square behind them, they turn and run
			const toG = M.want.heading, off = wrapA(toG - toT);
			const strafe = h.los && gd > 1.2 && h.role !== 'fallback' && dT < 45 && Math.abs(off) < 1.9 && (gd < 12 || Math.abs(off) > 0.5);
			if (strafe) { M.want.travel = toG; M.want.travelT = 0.3; M.want.heading = toT; M.want.speed = Math.min(M.want.speed, (Math.abs(off) > 1.1 ? 1.9 : 2.1) * pc.k); M.want.run = 0; }
			// (reeling from a round: barely moving, not firing)
			if (h.react) { M.want.speed = Math.min(M.want.speed, 0.6); M.want.run = 0; }
			// low on the move under fire: crouched the last stretch into cover, or all the way while
			// the target has sight of them; a few keep low even strafing; upright and flat out
			// across open ground or falling back
			else if (gd > 1.2 && h.role !== 'fallback') {
				const low = strafe ? (h.lowK > 0.5 ? 0.45 : 0) : (h.inCover && gd < 9) || (h.los && gd < 14) ? 0.7 + 0.3 * h.lowK : 0;
				M.want.low = low; M.want.speed *= 1 - 0.18 * low;
			}
			// in cover: down on a knee (hidden, reloading) and up to fire, in turns; just hit, down
			const held = gd <= 1.2 && h.inCover && !h.noGun;
			if (held) {
				h.peekT = (h.peekT ?? 0) - dt;
				if (h.peekT <= 0) { h.peek = !h.peek; h.peekT = h.peek ? rnd(1.6, 3.4) : rnd(1.0, 2.2); }
			} else { h.peek = true; h.peekT = 0; }
			const down = held && !h.peek, reloading = !!b.hand?.reloading;
			// (down behind cover with half a magazine or less: changed now, not mid-fight)
			if (down && h.mag <= 6 && !reloading && h.fireT < 0.5) reloadGun(h, true);
			h.crouch = down || (reloading && held) ? 0.55 : 0;
			if (down && !reloading && !h.react) M.act('kneel', 0); else if (M.S.act.name === 'kneel') M.act(null);
			if (h.los && gd < 6) M.want.heading = toT;
			S.look.target = h.target.id === 'me' ? eye : null;
			if (h.los && !down && !h.react && (gd < 6 || h.role === 'suppress' || strafe)) { shoot(h, dt); if (gd < 2.5 || strafe) aimAt = (h.aimV ||= new THREE.Vector3()).copy(at); }
			else h.fireT = Math.max(h.fireT, 0.3);
		} else {
			if (h.alert && !h.target) { h.alert = Math.max(0, h.alert - dt * 0.05); }
			// a slow patrol about home, or on to a task (a raid's target), or the post's beat
			h.goalT -= dt;
			if (h.ally) followStep(h, dt, eye, d);
			else if (P0 && !h.squad?.dest) postStep(h, P0, dt);
			else {
				if (h.goalT <= 0) { h.goalT = rnd(4, 9); const c = h.squad?.dest || h.home, a = Math.random() * 6.283; h.goal = { x: c.x + Math.cos(a) * 6, z: c.z + Math.sin(a) * 6 }; }
				if (h.goal) walk(h, h.goal.x, h.goal.z, h.squad?.dest ? 2.6 : 1.1, h.squad?.dest ? 1 : 0);
			}
		}
		// running at something they can get over: over it, as you would (no turning off round it)
		if (!h.climb && !h.W.crippled && !h.react && M.want.speed > 1.6 && S.speed.v > 1.2 && !(M.want.travelT > 0) && (h.lookT = (h.lookT || 0) - dt) <= 0) {
			h.lookT = 0.2;
			const hd = M.want.heading, C = climber()?.look(S.pos.x, S.pos.z, S.pos.y, Math.sin(hd), Math.cos(hd), S.speed.v);
			if (C) { h.climb = C; b.climbY = S.pos.y; S.clutch = null; }
		}
		// (a spell of theirs, when they know one and it is time: guild/companions.js)
		if (h.ally && !h.climb && !h.react) ctx.allyCast?.(h, dt);
		h.yaw = S.heading;
		headway(h, dt);
		M.update(dt, time, eye);
		b.P.lod?.(d);
		if (b.hand && !h.noGun) { aimHold(h, aimAt); b.hand.follow(b.P, S.heading, d < 90, M, time, dt); }
		else if (S.clutch) { b.P.root.updateMatrixWorld(true); applyClutch(b.P, M, dt); }
	}
	// the gun up and on the target while engaging (the stock at the shoulder, the strong hand's
	// finger on the trigger), down at the ready while moving or searching
	// a magazine changed in the hands: the gun comes down, the support hand goes to the well, off
	// to a pouch and back (people/actions.js reload, crysis/held-items.js), with its sounds;
	// no shooting till it is done
	function reloadGun(h, tactical = false) {
		const W = h.body?.hand, eye = ctx.eye();
		const T = W?.reload?.(null, Math.hypot(h.pos.x - eye.x, h.pos.z - eye.z)) ? Math.max(1.6, W.model?.userData?.reload || 2.2) : 2.2;
		h.mag = 12; h.burst = 0; h.fireT = Math.max(h.fireT, T + rnd(0.15, 0.4));
		if (!tactical || Math.random() < 0.5) say(h, 'reload');
	}
	function aimHold(h, at) {
		const b = h.body, up = !!at && b.M.S.speed.v < 2.2 && !b.hand?.reloading && !h.react;
		b.hand.aim?.(up);
		if (up) b.hand.aimPitch?.(Math.atan2(at.y - (h.pos.y + 1.4), Math.max(1, Math.hypot(at.x - h.pos.x, at.z - h.pos.z))));
		b.M.trigger?.('R', up ? 1 : 0);
	}
	// one of yours, with nothing to fight: at your back, a step to one side each, facing the way
	// you face; left far behind (you drove, flew or were carried off), they catch you up out of
	// your sight, as people in a party do
	function followStep(h, dt, eye, d) {
		const M = h.body.M, yaw = ctx.yaw?.() ?? 0, k = h.slot || 0;
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw), side = (k % 2 ? 1 : -1) * (1.5 + Math.floor(k / 2) * 1.3), back = 2.4 + Math.floor(k / 2) * 1.4;
		const gx = eye.x - fx * back + fz * side, gz = eye.z - fz * back - fx * side;
		if (d > ALLY_CATCH && !h.target) {
			// (set down where there is room: from where you stand out to their place, as far as the
			// walls allow, never inside a wall or the far side of one)
			const at = ctx.clearSpot ? ctx.clearSpot(eye, { x: gx, z: gz }, eye.y - 1.68) : { x: gx, z: gz };
			const gy = ctx.ground(at.x, at.z, eye.y);
			M.place(at.x, gy, at.z, Math.atan2(fx, fz)); h.pos.set(at.x, gy, at.z); h.goal = null; h.climb = null; h.body.climbY = null;
			return;
		}
		const gd = Math.hypot(gx - h.pos.x, gz - h.pos.z);
		if (walk(h, gx, gz, gd > 9 ? h.B.speed * 1.2 : gd > 3.5 ? 2.6 : 1.3, gd > 9 ? 1 : 0) <= 1.2) M.want.heading = Math.atan2(fx, fz);
	}
	// at a post: a loop walked at a steady pace (each one spaced along it), or a spot held
	// facing out, with a look about now and then
	function postStep(h, P0, dt) {
		const M = h.body.M;
		if (P0.loop?.length) {
			const L = P0.loop, n = L.length;
			if (h.leg === undefined) h.leg = (h.slot * Math.ceil(n / 2)) % n;
			const [gx, gz] = L[h.leg];
			if (walk(h, gx, gz, 1.3, 0) < 2.5) h.leg = (h.leg + 1) % n;
			return;
		}
		const side = (h.slot % 2 ? 1 : -1) * Math.ceil(h.slot / 2) * 2.2, c = Math.cos(P0.yaw || 0), s = Math.sin(P0.yaw || 0);
		const gx = P0.x + side * c, gz = P0.z - side * s;
		if (walk(h, gx, gz, 1.4, 0) <= 1.2) {
			h.lookT = (h.lookT || 0) - dt;
			if (h.lookT <= 0) { h.lookT = rnd(3, 7); h.face = (P0.yaw || 0) + rnd(-0.7, 0.7); }
			M.want.heading = h.face ?? P0.yaw ?? 0;
		}
	}
	function yieldStep(h, dt, d) {
		const M = h.body.M;
		h.surrendered -= dt;
		M.want.speed = 0;
		M.act(h.surrendered > 20 ? 'crouch' : 'cheer', h.surrendered > 20 ? 0 : 0.35);
		h.pos.copy(M.S.pos);
		M.update(dt, time, ctx.eye());
		h.body.P.lod?.(d);
		// let go: they slip away (and you spared them)
		if (h.surrendered <= 0) { ctx.onSpared?.(h, d); h.surrendered = 0; h.role = 'fallback'; h.alert = 0; h.target = null; h.squad = null; h.home = { x: h.pos.x + (h.pos.x - ctx.eye().x) * 3, z: h.pos.z + (h.pos.z - ctx.eye().z) * 3 }; h.goal = h.home; h.goalT = 30; M.act(null); h.fleeing = true; }
	}
	function crewStep(h, dt, d) {
		const b = h.body, M = b.M, F = ctx.fireAt(h.task);
		h.pos.copy(M.S.pos);
		if (!F) { h.home = h.home || h.pos.clone(); if (walk(h, h.pos.x + 30, h.pos.z, 1.4, 0) < 2 || (h.leaveT = (h.leaveT || 0) + dt) > 12) { h.H.state = 'dead'; h.dead = true; h.deadT = 10; layer.remove(h.id); } }
		else {
			const dx = h.pos.x - F.x, dz = h.pos.z - F.z, l = Math.hypot(dx, dz) || 1;
			const gd = walk(h, F.x + dx / l * 7, F.z + dz / l * 7, 3.6, 1);
			if (gd < 2) {
				M.want.heading = Math.atan2(F.x - h.pos.x, F.z - h.pos.z);
				M.act('hold', 0.5);
				ctx.douse(h.task, dt);
				const from = _v.set(h.pos.x, h.pos.y + 1.2, h.pos.z), dir = _w.set(F.x - h.pos.x, 0.25, F.z - h.pos.z).normalize();
				fx.dust(from.addScaledVector(dir, 0.6), 1, 0.85, 0.9, 0.95, 0.35, 0.1);
			}
		}
		M.update(dt, time, ctx.eye());
		b.P.lod?.(d);
	}
	function droneStep(h, dt) {
		const T = h.target, at = T ? posOf(T) : null;
		h.ph += dt;
		let tx = h.home.x + Math.cos(h.ph * 0.3) * 8, tz = h.home.z + Math.sin(h.ph * 0.3) * 8;
		if (h.alert && at) {
			const a = Math.atan2(h.pos.z - at.z, h.pos.x - at.x) + dt * 0.5 * (h.flankSide || 1), R = 18 + Math.sin(h.ph * 0.7) * 4;
			tx = at.x + Math.cos(a) * R; tz = at.z + Math.sin(a) * R;
			h.yaw = Math.atan2(at.x - h.pos.x, at.z - h.pos.z);
			shoot(h, dt);
		}
		const gy = ctx.ground(tx, tz, h.pos.y) + h.hover + Math.sin(h.ph * 1.3) * 0.6, k = Math.min(1, dt * 1.6);
		h.pos.x += (tx - h.pos.x) * k * 0.6; h.pos.z += (tz - h.pos.z) * k * 0.6; h.pos.y += (gy - h.pos.y) * k;
		const m = h.mesh;
		m.position.copy(h.pos); m.rotation.set(0.15 * Math.sin(h.ph * 2), h.yaw, 0.1 * Math.cos(h.ph * 1.7));
		for (const r of m.userData.rotors) r.rotation.y += dt * 40;
		m.userData.eye.material.color.setRGB(1, h.fireT < 0.4 && h.alert ? 0.9 : 0.29, 0.16);
	}
	function crawlerStep(h, dt) {
		const m = h.mesh, T = h.target, at = T ? posOf(T) : null;
		h.spitT -= dt;
		let speed = 0;
		if (h.alert && at) {
			const tx = at.x - h.pos.x, tz = at.z - h.pos.z, dd = Math.hypot(tx, tz);
			if (h.leap > 0) {
				// reared up (the warning), then the lunge
				h.leap -= dt;
				if (h.leap < 0.35 && !h.struck) { speed = 9; if (dd < 2.4) { h.struck = true; if (T.id === 'me') ctx.hurtPlayer({ amount: h.B.dmg, type: 'impact', part: 'torso', src: h.pos.clone(), by: h.T }); else ctx.strikeNpc(T, { amount: h.B.dmg * 2, type: 'impact', part: 'torso', src: h.pos.clone(), by: h.T }); } }
				if (h.leap <= 0) { h.leap = 0; h.fireT = rnd(1.2, 2); }
			} else if (dd < 2.6 && h.fireT <= 0) { h.leap = 0.9; h.struck = false; }
			else { speed = dd > 3 ? h.B.speed : 0; h.fireT -= dt; shoot(h, dt); }
			h.yaw = Math.atan2(tx, tz);
		} else {
			h.goalT -= dt;
			if (h.goalT <= 0) { h.goalT = rnd(3, 6); h.yaw += rnd(-1.5, 1.5); }
			speed = 1.2;
		}
		speed *= h.T.hex?.slowK || 1;
		_was.copy(h.pos);
		h.pos.x += Math.sin(h.yaw) * speed * dt; h.pos.z += Math.cos(h.yaw) * speed * dt;
		ctx.keepOut?.(h.pos, _was);
		h.pos.y = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1);
		const rear = h.leap > 0.35 ? Math.sin((0.9 - h.leap) / 0.55 * Math.PI / 2) * 0.5 : 0;
		m.position.copy(h.pos); m.rotation.set(-rear, h.yaw, 0);
		h.ph += dt * (0.5 + speed * 1.6);
		for (const L of m.userData.legs) L.pivot.rotation.set(Math.sin(h.ph * 2 + L.ph) * 0.35, Math.cos(h.ph * 2 + L.ph) * 0.3, 0);
	}

	// a creature (creatures/catalog.js): it wanders until it notices someone it hates, then closes
	// at its run and strikes when in reach. A blow has its wind-up (the first part of its time:
	// the arm drawn back, readable, a step back is enough) and lands only if the target is still
	// in reach and in front of it then.
	// the Moonturned's change: the person's body gives way to the beast's
	function turnBeast(h) {
		const b = h.beast;
		h.beast = null;
		h.cr.root.visible = false; h.cr.used = false; h.cr.root.position.y = -1e4;
		h.cr = b;
		b.root.visible = true; b.root.position.copy(h.pos); b.root.rotation.set(0, h.yaw, 0);
		b.motion.state.death = -1; b.motion.state.strike = -1;
		b.motion.hit();
		fx.dust({ x: h.pos.x, y: h.pos.y + 0.3, z: h.pos.z }, 6, 0.9, 0.3, 0.28, 0.26, 0.6);
	}
	function creatureStep(h, dt, d) {
		let c = h.cr;
		const S = h.Sp, T = h.target, at = T ? posOf(T) : null;
		let speed = 0, want = h.yaw;
		if (h.beast) {
			// a villager still, walking the lane, until you come near or hurt it: then it turns,
			// shuddering where it stands, and comes on as the beast
			if (h.turn < 0 && h.alert && at && Math.hypot(at.x - h.pos.x, at.z - h.pos.z) < 16) h.turn = 0;
			if (h.turn >= 0) {
				h.turn += dt / 1.8;
				h.turnK = (h.turnK || 0) + dt;
				if (h.turnK > 0.45) { h.turnK = 0; c.motion.hit(); }
				if (h.turn >= 0.6) { turnBeast(h); c = h.cr; }
				c.root.position.copy(h.pos); c.root.rotation.set(0, h.yaw, 0);
				c.motion.update(dt, { speed: 0 });
				return;
			}
		}
		let menace = 0;
		if (h.alert && at && !h.beast) {
			const tx = at.x - h.pos.x, tz = at.z - h.pos.z, dd = Math.hypot(tx, tz);
			want = Math.atan2(tx, tz);
			h.fireT -= dt;
			menace = h.strikeT >= 0 ? 0.4 : 1;
			// first sight of you: it stops dead, and it lets you know (a hound lowers its head and
			// growls, or rakes the ground; anything else twitches round to look), then it comes
			if (!h.spotted) {
				h.spotted = true;
				if (dd > S.reach * 2.5 && !S.fly) {
					h.standT = c.meta.rig === 'quad' ? rnd(1.4, 2.4) : rnd(0.7, 1.2);
					c.motion.beat(c.meta.rig === 'quad' ? (Math.random() < 0.65 ? 'growl' : 'scrape') : 'twitch');
				}
			}
			if (h.standT > 0) h.standT -= dt;
			if (h.standT > 0) speed = 0;
			else if (h.strikeT >= 0) {
				h.strikeT += dt / S.strike;
				// (a short lunge into the blow; a thrower stands to throw)
				if (!h.throwing && h.strikeT > 0.3 && h.strikeT < 0.5) speed = S.walk * 1.5;
				if (!h.struck && h.strikeT >= 0.45 && h.throwing) {
					// a fire pot, a curse: lobbed from the hand at where you stand
					h.struck = true;
					const Th = S.throw, from = new THREE.Vector3(h.pos.x + Math.sin(h.yaw) * 0.4, h.pos.y + S.height * 0.85, h.pos.z + Math.cos(h.yaw) * 0.4);
					ctx.projectile({ from, to: at.clone().add(_v.set(0, -0.3, 0)), speed: 16, drop: 9, dmg: Th.dmg, type: Th.type, owner: h.T, style: 4, splash: Th.splash, hostile: true });
				} else if (!h.struck && h.strikeT >= 0.45) {
					h.struck = true;
					const ahead = (Math.sin(h.yaw) * tx + Math.cos(h.yaw) * tz) / (dd || 1);
					if (dd < S.reach + 0.5 && ahead > 0.5) {
						const src = _w.set(h.pos.x, h.pos.y + S.height * 0.6, h.pos.z).clone();
						if (T.id === 'me') ctx.hurtPlayer({ amount: S.dmg * rnd(0.9, 1.1), type: 'impact', part: 'torso', src, by: h.T });
						else ctx.strikeNpc(T, { amount: S.dmg * 2, type: 'impact', part: 'torso', src, dir: { x: tx / dd, y: 0, z: tz / dd }, by: h.T });
						fx.dust({ x: at.x, y: at.y - 0.4, z: at.z }, 3, 0.5, 0.45, 0.4, 0.25, 0.25);
					}
				}
				if (h.strikeT >= 1) { h.strikeT = -1; h.fireT = h.throwing ? rnd(...S.throw.every) : rnd(0.5, 1.3); h.throwing = false; }
			} else if (dd < S.reach && h.fireT <= 0 && Math.abs(wrapA(want - h.yaw)) < 0.6) {
				h.strikeT = 0; h.struck = false; h.throwing = false; c.motion.strike();
				if (c.meta.rig === 'quad') voice.play('snarl', h.pos, 0.8, 1 / (S.height * (c.size || 1)) ** 0.3);
				if (T.id === 'me') { h.struckFirst = h.struckFirst || !h.provoked; h.shotAtPlayer = 8; }
			} else if (S.throw && h.los && dd > S.reach * 1.6 && dd < S.throw.range && h.fireT <= 0 && Math.abs(wrapA(want - h.yaw)) < 0.5) {
				h.strikeT = 0; h.struck = false; h.throwing = true; c.motion.strike();
				if (T.id === 'me') { h.struckFirst = h.struckFirst || !h.provoked; h.shotAtPlayer = 8; }
			} else if (S.throw && dd < S.throw.keep && dd > S.reach) speed = -S.walk;
			else if (S.throw && dd < S.throw.range * 0.8 && dd > S.reach) speed = 0;
			else if (dd > S.reach * 0.75) speed = dd > 7 ? S.run : Math.max(S.walk, S.run * 0.5);
		} else {
			// wandering: a slow walk this way and that, with pauses
			h.goalT -= dt;
			if (h.goalT <= 0) { h.goalT = rnd(3, 7); h.wander = Math.random() < 0.35 ? 0 : 1; h.face = h.yaw + rnd(-1.4, 1.4); }
			want = h.face ?? h.yaw;
			speed = (h.wander ?? 1) * S.walk * 0.6;
		}
		speed *= h.T.hex?.slowK || 1;
		// (turns as a body turns, not in a snap: the heavier slower)
		const turn = (h.alert ? 3.2 : 1.6) / Math.max(0.7, S.height / 1.8);
		h.yaw += Math.max(-turn * dt, Math.min(turn * dt, wrapA(want - h.yaw)));
		_was.copy(h.pos);
		h.pos.x += Math.sin(h.yaw) * speed * dt; h.pos.z += Math.cos(h.yaw) * speed * dt;
		ctx.keepOut?.(h.pos, _was);
		h.pos.y = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1);
		c.root.position.copy(h.pos); c.root.position.y += flyAlt(h, dt, at);
		c.root.rotation.set(0, h.yaw, 0);
		// (far off, moved less often: the bones are the cost)
		h.animT = (h.animT || 0) + dt;
		const every = d > 70 ? 0.1 : d > 35 ? 0.05 : 0;
		// (one that drifts, the Facet Wraith, glides without a step)
		if (h.animT >= every) { c.motion.update(h.animT, { speed: S.drift ? 0 : Math.abs(speed), look: 0, menace }); h.animT = 0; }
		c.facets?.update(dt, { strike: c.motion.state.strike, alert: !!h.alert });
		// a growl now and then as it closes on you
		if (menace > 0.5 && c.meta.rig === 'quad' && d < 40) {
			h.growlT = (h.growlT ?? rnd(1, 3)) - dt;
			if (h.growlT <= 0) { h.growlT = rnd(3, 6); voice.play('growl', h.pos, 0.7, 1 / (S.height * (c.size || 1)) ** 0.3); }
		}
		creatureEvents(h, c, d);
		c.root.visible = d < 220;
	}
	// what its body did, heard and seen: a growl, a sniff, claws raking dirt
	const _paw = new THREE.Vector3();
	function creatureEvents(h, c, d) {
		const ev = c.motion.drain();
		if (!ev.length || d > 60) return;
		const big = 1 / (h.Sp.height * (c.size || 1)) ** 0.3;
		for (const e of ev) {
			if (e === 'growl') voice.play('growl', h.pos, 0.8, big);
			else if (e === 'sniff') voice.play('sniff', h.pos, 0.5, big * 1.2);
			else if (e === 'twitch' && (c.meta.rig === 'flyer' || c.meta.rig === 'spider')) voice.play('chitter', h.pos, 0.5, c.meta.rig === 'spider' ? 1.3 : 1);
			else if (e === 'click') voice.play('click', h.pos, 0.45);
			else if (e === 'scuff') {
				const b = c.motion.state.beat, p = c.motion.at(b?.side < 0 ? 'hand_R' : 'hand_L', _paw) || _paw.copy(h.pos);
				voice.play('scrape', p, 0.6);
				fx.dust({ x: p.x, y: h.pos.y + 0.1, z: p.z }, 4, 0.45, 0.42, 0.36, 0.28, 0.35);
			}
		}
	}
	// a creature standing still as the trees round it until something disturbs it: you too near,
	// a blow, gunfire close by; then it wakes (wood groaning, shuddering, its boughs coming down)
	// and comes for you
	function dormantStep(h, dt, d) {
		const c = h.cr, L = h.Sp.lurk;
		if (h.waking < 0 && d < (L.wake || 8)) h.waking = 0;
		if (h.waking >= 0) {
			if (h.waking === 0) {
				voice.play('creak', h.pos, 1, 0.8);
				ctx.shake?.(0.25);
			}
			h.waking += dt / (L.rise || 2.8);
			h.wakeK = (h.wakeK || 0) + dt;
			if (h.wakeK > 0.5) {
				h.wakeK = 0; c.motion.hit();
				// (bark and dead leaves shaken off it)
				const hh = h.Sp.height * (c.size || 1);
				fx.dust({ x: h.pos.x + rnd(-2, 2), y: h.pos.y + hh * rnd(0.4, 0.9), z: h.pos.z + rnd(-2, 2) }, 5, 1.2, 0.3, 0.24, 0.16, 0.5);
			}
			h.dormant = 1 - Math.min(1, h.waking);
			if (h.waking >= 1) {
				h.dormant = 0; h.spotted = true;
				alertSquad(h, ctx.eye());
			}
		}
		c.root.position.copy(h.pos); c.root.rotation.set(0, h.yaw, 0);
		c.motion.update(dt, { speed: 0, dormant: h.dormant });
		c.root.visible = d < 220;
	}
	// a flyer (the Lampeater) keeps its height over the ground, comes lower as it closes, and drops
	// to strike; its height in m over the ground
	function flyAlt(h, dt, at) {
		const F = h.Sp.fly;
		if (!F) return 0;
		const near = at && h.alert && Math.hypot(at.x - h.pos.x, at.z - h.pos.z) < h.Sp.reach * 2.5;
		const goal = h.strikeT >= 0 && !h.throwing ? F.strike : near ? F.strike + 0.8 : F.hover;
		h.alt = h.alt ?? F.hover;
		h.alt += (goal - h.alt) * Math.min(1, dt * 2.2);
		return h.alt;
	}
	// a body of a model (a kind's own, or the person a Moonturned is first), from the pool or new (each kind's model loaded once: creatures/models.js)
	// (look: a model dressed as another kind, the Facet Wraith's shards round a body: creatures/facets.js;
	// or grown on, the Shard Mite's crystal legs: creatures/crystal-legs.js)
	async function creatureBody(id, species = id, look = null) {
		const pool = pools.creature;
		const free = pool.find((c) => !c.used && c.id === id && c.look === look);
		if (free) { free.used = true; free.meta.strikeTime = SPECIES[species].strike; return free; }
		try {
			const c = await makeCreature(id);
			c.meta.strikeTime = SPECIES[species].strike;
			c.look = look;
			if (look === 'facets') c.facets = facetLook(c);
			if (look === 'legs') c.legs = crystalLegs(c);
			if (look === 'sword') c.sword = hollowKing(c);
			c.used = true;
			group.add(c.root);
			pool.push(c);
			return c;
		} catch (e) { console.warn('creature', id, e); return null; }
	}

	// a squad of n of a faction round a point. opts: { alert, raid (attack civilians), dest
	// (where to head), task (a fire for a crew), ids }
	function squad(fid, x, z, n, opts = {}) {
		const sq = { id: 's' + nextId++, fid, members: [], last: null, home: { x, z }, raid: !!opts.raid, dest: opts.dest || null, post: opts.post || null, tag: opts.tag || null };
		squads.set(sq.id, sq);
		const out = [];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * 6.283 + Math.random(), r = opts.spread ?? (fid === 'rogue' ? 6 : 3 + Math.random() * 3);
			out.push(spawn(fid, x + (opts.post?.kind === 'tower' ? 0 : Math.cos(a) * r), z + (opts.post?.kind === 'tower' ? 0 : Math.sin(a) * r), sq, { ...opts, specialty: opts.roles?.[i] || opts.specialty, id: opts.ids?.[i] }).then((h) => { if (h && opts.alert) alertSquad(h, ctx.eye()); return h; }));
		}
		return Promise.all(out).then(() => sq);
	}
	function clear() { epoch++; for (const job of queue.splice(0)) job.cancel(); pending.clear(); for (const h of [...list]) release(h); squads.clear(); }
	const info = () => ({ alive: alive().length, fading: list.length - alive().length, max: maxNow(), squads: [...squads.values()].map((s) => ({ id: s.id, faction: s.fid, post: s.post?.kind || null, tag: s.tag, n: s.members.filter((m) => !m.dead).length, roles: s.members.filter((m) => !m.dead).map((m) => m.role), alert: s.members.some((m) => m.alert), targets: s.members.filter((m) => m.target).map((m) => m.target.id === 'me' ? 'you' : m.target.faction), surrendered: s.members.filter((m) => m.surrendered > 0).length, stances: s.members.filter((m) => !m.dead).map((m) => m.body?.M.S.act.name === 'kneel' ? 'kneel' : m.body?.M.want.travelT > 0 ? 'strafe' : 'move') })), bodies: pools.person.length, queue: queue.length });
	// (the world's fighters, alive: your guild's own are counted apart, allies())
	return { group, update, squad, spawn, hear, clear, info, alive: () => alive().filter((h) => !h.ally), allies: () => list.filter((h) => h.ally && !h.dead), list, release, surrender, squads };
}
