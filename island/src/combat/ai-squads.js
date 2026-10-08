// The armed people of the world and the things that hunt in it, in squads (combat/factions.js
// says who they are and whom they hate): gangs on the city's streets, militias and rangers in
// the hills, raiders on the desert worlds, smugglers on the coasts, contract hunters sent after
// a bounty, a village's own Hearthguard, the patrol answering a wanted level, rogue drones and
// the Deep's gloomcrawlers. They fight each other as readily as you: a raid on a village, two
// gangs over a corner, raiders against raiders. Each squad has a little sense: they hear
// gunfire and call it out, take cover by crates and rocks, one pins a target down while others
// flank, they reload, fall back when hurt, and a beaten fighter may throw down their weapon and
// surrender (what you do then is yours, and the morality compass weighs it).
//
// Few at once (fewer on a phone); bodies are pooled and reused. A person struck down goes limp
// (people/ragdoll.js) and fades; a drone drops and bursts; a crawler curls up and sinks away.
// A fire crew (on Earth) walks to a fire and puts it out.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { fadePerson } from '../people/fade.js';
import { createHealth, applyDamage, tickHealth } from './health.js';
import { personShapes } from './targets.js';
import { npcHand } from './weapon-view.js';
import { FACTIONS, PLAYER } from './factions.js';

// the bodies: people (dressed by faction), and the two that are not
const BODY = {
	drone: { speed: 7, sight: 65, range: 55, dmg: 9, burst: [1, 2], gap: [1.4, 2.2], rate: 0.35, surface: 'machine', resist: { ballistic: 0.85, energy: 1.35 } },
	crawler: { speed: 6.5, sight: 40, range: 18, dmg: 12, burst: [1, 1], gap: [3, 5], rate: 1, surface: 'creature', resist: { fire: 1.4 } },
	person: { speed: 3.9, sight: 60, range: 70, dmg: 7, burst: [2, 5], gap: [1.0, 2.2], rate: 0.15, surface: 'person' },
};
const CALL = {
	default: { contact: ['Contact!', 'There!', 'We have company!'], flank: ['Flanking left!', 'Going round!', 'Moving up!'], reload: ['Reloading!', 'Changing cells!'], down: ['Man down!', 'We lost one!'], pin: ['Keep them pinned!', 'Covering fire!'], give: ['Enough! I yield!', 'Don\'t shoot! I\'m done!'] },
	law: { contact: ['Patrol! Drop your weapon!', 'Suspect sighted!', 'Hold it right there!'], flank: ['Moving to flank!', 'Cutting them off!'], reload: ['Reloading!'], down: ['Officer down!'], pin: ['Suppressing!', 'Stay in cover!'], give: ['I\'m down, I\'m down!'] },
	villagers: { contact: ['Raiders! Protect the houses!', 'To the walls!'], flank: ['Round the back of the barn!'], reload: ['Arrows!'], down: ['They got Tam!'], pin: ['Keep their heads down!'], give: ['Mercy!'] },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// a beaten fighter's choice (pure, for the tests): yield when badly hurt and outnumbered, more
// readily when their side is not a fierce one; never machines or creatures
export function shouldSurrender({ hpFrac, allies, enemies, aggression = 0.5, kind = 'gang' }, rand = Math.random) {
	if (kind === 'machines' || kind === 'creatures' || hpFrac > 0.3 || enemies < 1) return false;
	const odds = (0.25 + (enemies - allies) * 0.15) * (1.2 - aggression);
	return rand() < Math.max(0, Math.min(0.85, odds));
}

// a faction's look: a fitted kit in its colours; the masked ones hide their faces
function styleOf(fid) {
	const F = FACTIONS[fid] || {}, [a, b] = F.colors || ['#444', '#999'];
	const o = { gen: 'alien', top: { kind: 'suit', col: a, acc: b, pat: 'block', fit: 'fitted', sleeves: 'long', fab: 'tech' }, outer: null, bottom: { kind: 'suit', col: a, acc: b, pat: 'plain', legs: 'long', fit: 'regular', fab: 'twill' }, shoes: { kind: 'boot', col: '#18191b', sole: '#0e0e0e' }, acc: [] };
	if (fid === 'fire') { o.top.col = o.bottom.col = '#c99a1a'; o.top.acc = o.bottom.acc = '#2a2a2a'; o.acc.push({ kind: 'helmet', col: '#d8a21a', visor: '#2a2a2a' }); return o; }
	if (F.masked || F.kind === 'mercs' || F.kind === 'law') o.acc.push({ kind: 'helmet', col: F.kind === 'law' ? a : '#33373c', visor: F.kind === 'law' ? '#9fd8ff' : b });
	else if (F.kind === 'gang') o.acc.push({ kind: Math.random() < 0.5 ? 'beanie' : 'cap', col: a });
	else if (F.kind === 'militia' || F.kind === 'villagers') o.acc.push({ kind: 'cap', col: b });
	return o;
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
	const MAX = isPhone ? 6 : 14;
	const list = [];
	const pools = { person: [], drone: [], crawler: [] };
	const squads = new Map();
	let A = null, loading = null, nextId = 1;
	const assets = () => { if (A) return Promise.resolve(A); if (!loading) loading = loadPeopleAssets().then((a) => (A = a)); return loading; };

	// people are made one a frame, in the background, and kept for the next squad of their side
	const queue = [];
	function personBody(fid, seed) {
		const free = pools.person.find((b) => !b.used && b.fid === fid);
		if (free) { free.used = true; return Promise.resolve(free); }
		return new Promise((res) => queue.push(() => {
			const F = FACTIONS[fid] || {};
			const d = personDNA(seed, { age: 22 + (seed % 30), style: styleOf(fid) });
			const P = buildPerson(A, d);
			if (F.masked) maskOn(P, F.colors?.[0] || '#ff7a2a');
			const b = { P, M: createMotion(P, (x, z) => ctx.ground(x, z, P.root.position.y + 1.2)), fid, used: true, hand: F.gun ? npcHand(group, F.gun, 2 + (seed % 4), seed % 3) : null };
			group.add(P.root);
			pools.person.push(b);
			res(b);
		}));
	}

	// one at (x, z) of a faction, in a squad
	async function spawn(fid, x, z, squad, opts = {}) {
		if (alive().length >= MAX) return null;
		const F = FACTIONS[fid] || {}, kind = fid === 'rogue' ? 'drone' : fid === 'gloom' ? 'crawler' : 'person';
		const B = BODY[kind];
		const id = opts.id || `h${fid.slice(0, 2)}${nextId++}`;
		const h = {
			id, fid, F, kind, B, squad, crew: fid === 'fire',
			H: createHealth({ max: (F.hp || 100) * (opts.hpK || 1), armour: opts.armour ?? F.armour ?? 0, soak: 0.5, resist: B.resist || {} }),
			pos: new THREE.Vector3(x, 0, z), yaw: opts.yaw || 0, alert: 0, role: 'assault', goal: null, goalT: 0, fireT: rnd(0.6, 1.2), burst: 0, mag: 12,
			losT: 0, los: false, target: null, targetT: 0, deadT: 0, hover: rnd(4, 7), ph: Math.random() * 10, home: { x, z }, body: null, mesh: null, leap: 0, spitT: rnd(2, 4),
			provoked: false, shotAtPlayer: 0, surrendered: 0, task: opts.task || null,
		};
		h.pos.y = ctx.ground(x, z, opts.y ?? ctx.eye().y);
		if (kind === 'person') {
			await assets();
			const b = await personBody(fid, (Math.random() * 1e9) >>> 0);
			if (h.gone) { b.used = false; return null; }
			h.body = b;
			if (b.P.ragdoll) ctx.ragdolls.release(b.P);
			b.P.root.visible = true; fadePerson(b.P, 1);
			b.M.act(null); b.M.place(x, h.pos.y, z, h.yaw);
		} else {
			const pool = pools[kind];
			let m = pool.find((q) => !q.userData.used);
			if (!m) { m = kind === 'drone' ? droneMesh() : crawlerMesh(); pool.push(m); group.add(m); }
			m.userData.used = true; m.visible = true; m.scale.setScalar(1); m.rotation.set(0, h.yaw, 0);
			h.mesh = m;
			if (kind === 'drone') h.pos.y += h.hover;
		}
		h.T = {
			id, kind: 'hostile', faction: fid, bound: { x, y: h.pos.y + 1, z, r: 1.4 }, name: F.name ? `a ${F.name.replace(/s$/, '')} fighter` : 'a fighter',
			surface: B.surface, shapes: () => shapesOf(h), ref: h,
			onHit: (blow) => hit(h, blow),
			moral: () => ({ hostileTarget: h.alert > 0 && !h.surrendered && (h.provoked || relations.hostile(fid, PLAYER) || (h.target?.id === 'me')), selfDefence: h.shotAtPlayer > 0, surrendered: h.surrendered > 0, fleeing: h.role === 'fallback', lawTarget: !!F.lawful, unarmed: h.crew }),
		};
		if (h.crew) { h.T.faction = 'civ'; h.T.name = 'a firefighter'; }
		layer.add(h.T);
		list.push(h);
		if (squad) squad.members.push(h);
		return h;
	}
	function shapesOf(h) {
		const p = h.pos;
		if (h.kind === 'drone') return [{ type: 'sphere', c: { x: p.x, y: p.y, z: p.z }, r: 0.5, part: 'body' }, { type: 'sphere', c: { x: p.x + Math.sin(h.yaw) * 0.45, y: p.y - 0.04, z: p.z + Math.cos(h.yaw) * 0.45 }, r: 0.12, part: 'weak' }];
		if (h.kind === 'crawler') {
			const a = Math.sin(h.yaw), c = Math.cos(h.yaw);
			return [{ type: 'capsule', a: { x: p.x - a * 0.8, y: p.y + 0.55, z: p.z - c * 0.8 }, b: { x: p.x + a * 0.3, y: p.y + 0.6, z: p.z + c * 0.3 }, r: 0.38, part: 'body' }, { type: 'sphere', c: { x: p.x + a * 0.58, y: p.y + 0.62, z: p.z + c * 0.58 }, r: 0.22, part: 'head' }];
		}
		return personShapes(p.x, p.y, p.z, h.body?.P.height || 1.75, h.crouch || (h.surrendered ? 0.5 : 0));
	}
	const alive = () => list.filter((h) => !h.dead);

	function hit(h, blow) {
		if (h.dead) return null;
		const r = applyDamage(h.H, blow);
		const by = blow.by;
		if (by) {
			// the one who struck them is their enemy now, whatever the old feelings
			h.provoked = h.provoked || by.id === 'me';
			if (!h.surrendered) { h.target = by; h.targetT = 6; }
			for (const m of h.squad?.members || []) if (!m.dead && !m.surrendered) { if (by.id === 'me') m.provoked = true; if (!m.target) { m.target = by; m.targetT = 6; } }
		}
		if (!h.alert) alertSquad(h, blow.src);
		h.hurtT = 0.25;
		if (r.killed) die(h, blow);
		else if (!h.surrendered && h.kind === 'person' && !h.crew) {
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
			ctx.ragdolls.hit(h.body.P, { vel: new THREE.Vector3(d.x, 0.1, d.z).normalize().multiplyScalar(blow?.type === 'blast' ? 7 : 3.5), mass: 400, point: new THREE.Vector3(p.x, p.y + 1.2, p.z), lift: 0.06 });
			h.body.hand?.hide();
		} else if (h.kind === 'drone') { fx.explosion(h.pos, 1.2, false); h.vy = 0; }
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
		if (h.squad) { const k = h.squad.members.indexOf(h); if (k >= 0) h.squad.members.splice(k, 1); if (!h.squad.members.length) squads.delete(h.squad.id); }
	}

	function say(h, what, force = false) {
		const lines = (CALL[h.F.kind] || CALL.default)[what] || CALL.default[what];
		if (!lines || (h.saidT > 0 && !force)) return;
		const d = Math.hypot(h.pos.x - ctx.eye().x, h.pos.z - ctx.eye().z);
		if (d > 50) return;
		h.saidT = 4;
		ctx.call?.(pick(lines), h.F.name || 'someone');
	}
	function alertSquad(h, src) {
		const mem = h.squad ? h.squad.members : [h];
		let k = 0;
		for (const m of mem) {
			if (m.dead || m.alert || m.crew) continue;
			m.alert = 1; m.fireT = rnd(0.7, 1.4); m.goalT = 0;
			m.role = m.kind === 'drone' ? 'orbit' : m.kind === 'crawler' ? 'rush' : k === 0 ? 'suppress' : k % 2 ? 'flank' : 'assault';
			m.flankSide = k % 4 < 2 ? 1 : -1;
			k++;
		}
		if (src && h.squad) h.squad.last = { x: src.x, z: src.z };
		const first = mem.find((m) => !m.dead && !m.crew);
		if (first) say(first, 'contact');
	}
	// gunfire heard at (x, z): squads within earshot wake
	function hear(x, z, r = 60) {
		for (const h of alive()) if (!h.alert && !h.crew && Math.hypot(h.pos.x - x, h.pos.z - z) < r) alertSquad(h, { x, z });
	}

	// whom to fight: the nearest enemy in sight: you (if they hate you or you struck them),
	// another side's fighter, or (for raiders and their like) the villagers and townsfolk
	const ME = { id: 'me', kind: 'player', faction: PLAYER };
	function chooseTarget(h, eye) {
		const F = h.F;
		let best = null, bd = h.B.sight * (h.alert ? 1.8 : 1);
		const dMe = Math.hypot(eye.x - h.pos.x, eye.z - h.pos.z);
		const hateMe = h.provoked || relations.hostile(h.fid, PLAYER) || (F.lawful && ctx.wanted() > 0) || (F.kind === 'mercs' && ctx.bounty() > 0);
		if (hateMe && !ctx.playerDown() && dMe < bd) { best = ME; bd = dMe; }
		for (const o of list) {
			if (o === h || o.dead || o.surrendered || o.crew || o.fid === h.fid || !relations.hostile(h.fid, o.fid)) continue;
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
	const posOf = (T) => (T.id === 'me' ? ctx.eye() : _w.set(T.bound.x, T.bound.y + 0.4, T.bound.z));

	// where to go: by a bit of cover facing the target, round its side, or in close
	function chooseGoal(h, at) {
		const dx = h.pos.x - at.x, dz = h.pos.z - at.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
		let R = 20, ang = 0;
		if (h.role === 'suppress') R = rnd(20, 28);
		else if (h.role === 'flank') { R = rnd(14, 20); ang = h.flankSide * rnd(0.9, 1.3); }
		else if (h.role === 'assault') R = rnd(8, 13);
		else if (h.role === 'fallback') R = rnd(32, 42);
		const c = Math.cos(ang), s = Math.sin(ang);
		let gx = at.x + (ux * c - uz * s) * R, gz = at.z + (ux * s + uz * c) * R;
		const cover = ctx.coverNear?.(gx, gz, 9);
		if (cover) { const cx = cover.x - at.x, cz = cover.z - at.z, cl = Math.hypot(cx, cz) || 1; gx = cover.x + cx / cl * (cover.r + 0.7); gz = cover.z + cz / cl * (cover.r + 0.7); h.inCover = true; } else h.inCover = false;
		h.goal = { x: gx, z: gz };
		h.goalT = rnd(4, 7);
		if (h.role === 'flank') say(h, 'flank');
	}

	function shoot(h, dt) {
		const B = h.B, T = h.target;
		h.fireT -= dt;
		if (h.fireT > 0 || !h.los || !T || h.noGun) return;
		const to0 = posOf(T).clone(), from = h.kind === 'drone' ? h.pos.clone() : h.kind === 'crawler' ? new THREE.Vector3(h.pos.x, h.pos.y + 0.65, h.pos.z) : muzzleOf(h);
		const dist = from.distanceTo(to0), atMe = T.id === 'me';
		if (dist > B.range) return;
		if (atMe) h.shotAtPlayer = 8;
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
		if (h.burst <= 0) h.burst = Math.round(rnd(...B.burst)) * (h.role === 'suppress' ? 2 : 1);
		h.burst--; h.mag--;
		const moving = atMe ? Math.min(1, (ctx.me().speed || 0) / 6) : 0.3;
		const pHit = (h.F.acc || 0.4) * Math.max(0.15, 1 - dist / (B.range * 1.1)) * (1 - 0.5 * moving) * (h.role === 'suppress' ? 0.6 : 1) * (atMe ? ctx.coverK?.() ?? 1 : 1);
		const hitIt = Math.random() < pHit;
		const to = to0.clone().add(_v.set(0, atMe ? -0.35 : 0, 0));
		if (!hitIt) to.add(_v.set(rnd(-1, 1), rnd(-0.6, 0.8), rnd(-1, 1)).multiplyScalar(0.8 + dist * 0.03));
		const dir = to.clone().sub(from).normalize();
		const style = h.F.kind === 'law' ? 1 : h.F.gun === 'warden-spark-carbine' ? 2 : 4;
		// (what stands in the way takes it: a child's ward, cover, someone else)
		const block = ctx.firstHit(from, dir, Math.min(B.range, dist + 30), h.T);
		let end = hitIt ? to : from.clone().addScaledVector(dir, Math.min(B.range, dist + 30));
		if (block && block.t < from.distanceTo(end) - 0.3) { end = from.clone().addScaledVector(dir, block.t); ctx.landShot(block, from, dir, h, B.dmg); }
		else if (hitIt) {
			if (atMe) ctx.hurtPlayer({ amount: B.dmg * rnd(0.85, 1.15), type: 'ballistic', part: 'torso', src: from, by: h.T });
			else ctx.strikeNpc(T, { amount: B.dmg * 2.2 * rnd(0.85, 1.15), type: 'ballistic', part: Math.random() < 0.15 ? 'head' : 'torso', src: from, dir, by: h.T }, end);
		} else if (atMe) ctx.whiz?.(from, end);
		fx.tracer(from, end, style, 380);
		fx.muzzle(from, dir, style === 2 ? 2 : 0);
		ctx.heard?.(from, h);
		if (h.mag <= 0) { h.mag = 12; h.fireT = 2.2; h.burst = 0; say(h, 'reload'); return; }
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
	function update(dt) {
		time += dt;
		if (queue.length) queue.shift()();
		const eye = ctx.eye();
		for (let i = list.length - 1; i >= 0; i--) {
			const h = list[i];
			h.saidT = Math.max(0, (h.saidT || 0) - dt);
			h.shotAtPlayer = Math.max(0, h.shotAtPlayer - dt);
			const d = Math.hypot(h.pos.x - eye.x, h.pos.z - eye.z);
			if (h.dead) { fading(h, dt); continue; }
			if (d > 280) { release(h); continue; }
			tickHealth(h.H, dt);
			if (h.crew) { crewStep(h, dt, d); bounds(h); continue; }
			if (h.surrendered) { yieldStep(h, dt, d); bounds(h); continue; }
			// a target, and sight of it, a few times a second
			h.losT -= dt; h.targetT -= dt;
			if (h.losT <= 0) {
				h.losT = rnd(0.2, 0.35);
				if (!h.target || h.targetT <= 0 || h.target.removed || (h.target.ref?.dead) || (h.target.ref?.surrendered)) { h.target = chooseTarget(h, eye); h.targetT = rnd(3, 6); }
				const T = h.target;
				const from = _v.set(h.pos.x, h.pos.y + (h.kind === 'drone' ? 0 : h.kind === 'crawler' ? 0.7 : 1.5), h.pos.z);
				h.los = !!T && !ctx.blocked(from, posOf(T));
				if (h.los && !h.alert) alertSquad(h, posOf(T));
				if (h.los && h.squad) h.squad.last = { x: posOf(T).x, z: posOf(T).z };
			}
			if (h.kind === 'drone') droneStep(h, dt);
			else if (h.kind === 'crawler') crawlerStep(h, dt, d);
			else personStep(h, dt, d);
			bounds(h);
		}
	}
	function bounds(h) { const B = h.T.bound; B.x = h.pos.x; B.y = h.pos.y + (h.kind === 'drone' ? 0 : 0.9); B.z = h.pos.z; }
	function fading(h, dt) {
		h.deadT += dt;
		if (h.body) {
			if (h.deadT > 10) { const k = 1 - (h.deadT - 10) / 2; fadePerson(h.body.P, k); if (k <= 0) release(h); }
		} else if (h.kind === 'drone') {
			h.vy = (h.vy || 0) - 9.8 * dt; h.pos.y += h.vy * dt;
			const gy = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1);
			if (h.pos.y < gy + 0.2) { h.pos.y = gy + 0.2; if (!h.burst2) { h.burst2 = true; fx.explosion(h.pos, 1.4); } }
			h.mesh.position.copy(h.pos); h.mesh.rotation.z += dt * 3;
			if (h.deadT > 4) { h.mesh.scale.setScalar(Math.max(0.01, 1 - (h.deadT - 4))); if (h.deadT > 5) release(h); }
		} else {
			h.mesh.rotation.z = Math.min(Math.PI * 0.9, h.deadT * 3);
			h.mesh.position.set(h.pos.x, h.pos.y + Math.min(0.6, h.deadT * 0.6) - Math.max(0, h.deadT - 4) * 0.4, h.pos.z);
			if (h.deadT > 6.5) release(h);
		}
	}
	function walk(h, gx, gz, speed, run) {
		const M = h.body.M, dx = gx - h.pos.x, dz = gz - h.pos.z, d = Math.hypot(dx, dz);
		if (d > 1.2) { M.want.heading = Math.atan2(dx, dz); M.want.speed = speed; M.want.run = run; } else { M.want.speed = 0; M.want.run = 0; }
		return d;
	}
	function personStep(h, dt, d) {
		const b = h.body, M = b.M, S = M.S, eye = ctx.eye();
		h.pos.copy(S.pos);
		if (h.alert && h.target) {
			const at = posOf(h.target).clone();
			h.goalT -= dt;
			if (!h.goal || h.goalT <= 0) chooseGoal(h, at);
			const gd = walk(h, h.goal.x, h.goal.z, h.B.speed * (h.role === 'fallback' ? 1.1 : 1), 1);
			h.crouch = gd <= 1.2 && h.inCover ? 0.5 : 0;
			if (h.los && gd < 6) M.want.heading = Math.atan2(at.x - h.pos.x, at.z - h.pos.z);
			S.look.target = h.target.id === 'me' ? eye : null;
			if (h.los && (gd < 6 || h.role === 'suppress')) shoot(h, dt);
			else h.fireT = Math.max(h.fireT, 0.3);
		} else {
			if (h.alert && !h.target) { h.alert = Math.max(0, h.alert - dt * 0.05); }
			// a slow patrol about home, or on to a task (a raid's target)
			h.goalT -= dt;
			if (h.goalT <= 0) { h.goalT = rnd(4, 9); const c = h.squad?.dest || h.home, a = Math.random() * 6.283; h.goal = { x: c.x + Math.cos(a) * 6, z: c.z + Math.sin(a) * 6 }; }
			if (h.goal) walk(h, h.goal.x, h.goal.z, h.squad?.dest ? 2.6 : 1.1, h.squad?.dest ? 1 : 0);
		}
		h.yaw = S.heading;
		M.update(dt, time, eye);
		b.P.lod?.(d);
		if (b.hand && !h.noGun) b.hand.follow(b.P, S.heading, d < 90, M, time);
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
		h.pos.x += Math.sin(h.yaw) * speed * dt; h.pos.z += Math.cos(h.yaw) * speed * dt;
		h.pos.y = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1);
		const rear = h.leap > 0.35 ? Math.sin((0.9 - h.leap) / 0.55 * Math.PI / 2) * 0.5 : 0;
		m.position.copy(h.pos); m.rotation.set(-rear, h.yaw, 0);
		h.ph += dt * (0.5 + speed * 1.6);
		for (const L of m.userData.legs) L.pivot.rotation.set(Math.sin(h.ph * 2 + L.ph) * 0.35, Math.cos(h.ph * 2 + L.ph) * 0.3, 0);
	}

	// a squad of n of a faction round a point. opts: { alert, raid (attack civilians), dest
	// (where to head), task (a fire for a crew), ids }
	function squad(fid, x, z, n, opts = {}) {
		const sq = { id: 's' + nextId++, fid, members: [], last: null, home: { x, z }, raid: !!opts.raid, dest: opts.dest || null };
		squads.set(sq.id, sq);
		const out = [];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * 6.283 + Math.random(), r = opts.spread ?? (fid === 'rogue' ? 6 : 3 + Math.random() * 3);
			out.push(spawn(fid, x + Math.cos(a) * r, z + Math.sin(a) * r, sq, { ...opts, id: opts.ids?.[i] }).then((h) => { if (h && opts.alert) alertSquad(h, ctx.eye()); return h; }));
		}
		return Promise.all(out).then(() => sq);
	}
	function clear() { for (const h of [...list]) release(h); squads.clear(); }
	const info = () => ({ alive: alive().length, fading: list.length - alive().length, max: MAX, squads: [...squads.values()].map((s) => ({ id: s.id, faction: s.fid, n: s.members.filter((m) => !m.dead).length, roles: s.members.filter((m) => !m.dead).map((m) => m.role), alert: s.members.some((m) => m.alert), targets: s.members.filter((m) => m.target).map((m) => m.target.id === 'me' ? 'you' : m.target.faction), surrendered: s.members.filter((m) => m.surrendered > 0).length })), bodies: pools.person.length, queue: queue.length });
	return { group, update, squad, spawn, hear, clear, info, alive, list, release, surrender };
}
