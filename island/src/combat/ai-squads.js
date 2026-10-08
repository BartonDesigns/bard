// The ones who fight back, all fictional: Ashfang raiders (people in sealed dark armour and
// masks, never a face, on the wild worlds), rogue drones (old survey machines gone wrong),
// gloomcrawlers (pale, glowing cave creatures of the Deep) and, on Earth, the patrol answering
// your wanted level. They come as squads with a little sense: they hear gunfire, call it out,
// take cover by crates and rocks, one pins you down while others flank, and they reload and
// fall back when hurt. Few at once (fewer on a phone); bodies are pooled and reused.
//
// A raider or officer struck down goes limp (people/ragdoll.js) and fades; a drone drops and
// bursts; a crawler curls up and sinks away. Nothing graphic.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { fadePerson } from '../people/fade.js';
import { createHealth, applyDamage, tickHealth } from './health.js';
import { personShapes } from './targets.js';
import { npcHand } from './weapon-view.js';

export const TYPES = Object.freeze({
	raider: { faction: 'ashfang', name: 'Ashfang raider', hp: 100, armour: 35, speed: 3.8, sight: 55, range: 70, dmg: 7, burst: [3, 5], gap: [1.1, 2.2], rate: 0.14, acc: 0.42, gun: 'aurora-trail-rifle', surface: 'person' },
	police: { faction: 'patrol', name: 'Patrol officer', hp: 100, armour: 20, speed: 4.2, sight: 60, range: 60, dmg: 6, burst: [2, 3], gap: [1.0, 1.8], rate: 0.22, acc: 0.45, gun: 'mossback-scout-rifle', surface: 'person' },
	drone: { faction: 'rogue', name: 'Rogue drone', hp: 60, armour: 0, speed: 7, sight: 65, range: 55, dmg: 9, burst: [1, 2], gap: [1.4, 2.2], rate: 0.35, acc: 0.5, surface: 'machine', resist: { ballistic: 0.85, energy: 1.35 } },
	crawler: { faction: 'gloom', name: 'Gloomcrawler', hp: 70, armour: 0, speed: 6.5, sight: 40, range: 18, dmg: 12, burst: [1, 1], gap: [3, 5], rate: 1, acc: 0.6, surface: 'creature', resist: { fire: 1.4 } },
});
const CALL = {
	ashfang: { contact: ['Contact!', 'There, by the rocks!', 'We have company!'], flank: ['Flanking left!', 'Going round!', 'Moving up!'], reload: ['Reloading!', 'Changing cells!'], down: ['Man down!', 'We lost one!'], pin: ['Keep them pinned!', 'Covering fire!'] },
	patrol: { contact: ['Patrol! Drop it!', 'Suspect sighted!', 'Hold it right there!'], flank: ['Moving to flank!', 'Cutting them off!'], reload: ['Reloading!'], down: ['Officer down!'], pin: ['Suppressing!', 'Stay in cover!'] },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

// the looks: a raider's sealed armour, a patrol officer's uniform
const RAIDER_STYLE = { gen: 'alien', top: { kind: 'suit', col: '#2a2e33', acc: '#b8462c', pat: 'block', fit: 'fitted', sleeves: 'long', fab: 'tech' }, outer: null, bottom: { kind: 'suit', col: '#25282c', acc: '#b8462c', pat: 'plain', legs: 'long', fit: 'regular', fab: 'tech' }, shoes: { kind: 'boot', col: '#1c1d20', sole: '#111' }, acc: [{ kind: 'helmet', col: '#33373c', visor: '#ff7a2a' }] };
const POLICE_STYLE = { gen: 'alien', top: { kind: 'suit', col: '#1d2a45', acc: '#d9c46a', pat: 'block', fit: 'fitted', sleeves: 'long', fab: 'tech' }, outer: null, bottom: { kind: 'suit', col: '#1a2338', acc: '#1a2338', pat: 'plain', legs: 'long', fit: 'regular', fab: 'twill' }, shoes: { kind: 'boot', col: '#121315', sole: '#0c0c0c' }, acc: [{ kind: 'helmet', col: '#1d2a45', visor: '#9fd8ff' }] };

// shared parts for the machines and creatures
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
	const eye = new THREE.Mesh(k.sphere, k.eye); eye.scale.setScalar(0.09); eye.position.set(0, -0.04, 0.44); g.add(eye);
	const rotors = [];
	for (const [x, z] of [[0.55, 0.45], [-0.55, 0.45], [0.55, -0.45], [-0.55, -0.45]]) {
		const arm = new THREE.Mesh(k.cyl, k.dark); arm.scale.set(0.03, Math.hypot(x, z), 0.03); arm.rotation.set(Math.PI / 2, 0, 0); arm.lookAt(x, 0, z); arm.position.set(x / 2, 0.05, z / 2); g.add(arm);
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
	g.userData.legs = legs; g.userData.body = [abd, tho, head];
	return g;
}
// a sealed mask over a person's face, on their head bone
function maskOn(P) {
	const k = kit(), hb = P.bones[P.map.head];
	if (!hb) return;
	P.root.position.set(0, 0, 0); P.root.rotation.set(0, 0, 0); P.root.updateMatrixWorld(true);
	const wp = hb.getWorldPosition(new THREE.Vector3()), inv = new THREE.Matrix4().copy(hb.matrixWorld).invert();
	const m = new THREE.Group();
	const shell = new THREE.Mesh(k.sphere, k.mask); shell.scale.set(0.105, 0.12, 0.085); m.add(shell);
	const slit = new THREE.Mesh(k.sphere, k.slit); slit.scale.set(0.075, 0.012, 0.02); slit.position.set(0, 0.03, 0.075); m.add(slit);
	const at = wp.clone().add(new THREE.Vector3(0, 0.035, 0.055)).applyMatrix4(inv);
	m.position.copy(at);
	const q = new THREE.Quaternion(); hb.getWorldQuaternion(q);
	m.quaternion.copy(q.invert());
	const s = new THREE.Vector3(); hb.getWorldScale(s);
	m.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
	hb.add(m);
}

export function createHostiles(ctx) {
	const { layer, fx, isPhone } = ctx;
	const group = new THREE.Group(); group.name = 'combat-hostiles';
	const MAX = isPhone ? 5 : 10;
	const list = [];                                  // the living and the fading
	const pools = { person: [], drone: [], crawler: [] };
	const squads = new Map();
	let A = null, loading = null, nextId = 1;
	const assets = () => { if (A) return Promise.resolve(A); if (!loading) loading = loadPeopleAssets().then((a) => (A = a)); return loading; };

	// a body from the pool, or a new one (people are made one a frame, in the background)
	const queue = [];
	function personBody(type, seed) {
		const style = type === 'police' ? POLICE_STYLE : RAIDER_STYLE;
		const free = pools.person.find((b) => !b.used && b.type === type);
		if (free) { free.used = true; return Promise.resolve(free); }
		return new Promise((res) => queue.push(() => {
			const d = personDNA(seed, { age: 24 + (seed % 20), style });
			const P = buildPerson(A, d);
			if (type === 'raider') maskOn(P);
			const b = { P, M: createMotion(P, (x, z) => ctx.ground(x, z, P.root.position.y + 1.2)), type, used: true, hand: npcHand(group, TYPES[type].gun, 2 + (seed % 3), seed % 2) };
			group.add(P.root);
			pools.person.push(b);
			res(b);
		}));
	}

	// one hostile at (x, z) in a squad
	async function spawn(type, x, z, squad, opts = {}) {
		if (alive().length >= MAX) return null;
		const D = TYPES[type];
		const id = opts.id || `h${type[0]}${nextId++}`;
		const h = { id, type, D, squad, H: createHealth({ max: D.hp * (opts.hpK || 1), armour: (opts.armour ?? D.armour), soak: 0.5, resist: D.resist || {} }), pos: new THREE.Vector3(x, 0, z), yaw: opts.yaw || 0, state: 'idle', alert: 0, role: 'assault', goal: null, goalT: 0, fireT: rnd(0.6, 1.2), burst: 0, mag: 12, losT: 0, los: false, deadT: 0, hover: rnd(4, 7), ph: Math.random() * 10, home: { x, z }, body: null, mesh: null, leap: 0, spitT: rnd(2, 4) };
		h.pos.y = ctx.ground(x, z, opts.y ?? ctx.eye().y);
		if (D.surface === 'person') {
			await assets();
			const b = await personBody(type, (Math.random() * 1e9) >>> 0);
			if (h.gone) { b.used = false; return null; }
			h.body = b;
			b.P.root.visible = true; fadePerson(b.P, 1);
			if (b.P.ragdoll) ctx.ragdolls.release(b.P);
			b.M.place(x, h.pos.y, z, h.yaw);
		} else {
			const pool = pools[type];
			let m = pool.find((q) => !q.userData.used);
			if (!m) { m = type === 'drone' ? droneMesh() : crawlerMesh(); pool.push(m); group.add(m); }
			m.userData.used = true; m.visible = true; m.scale.setScalar(1); m.rotation.set(0, h.yaw, 0);
			h.mesh = m;
			if (type === 'drone') h.pos.y += h.hover;
		}
		h.T = {
			id, kind: 'hostile', faction: D.faction, bound: { x, y: h.pos.y + 1, z, r: 1.4 },
			surface: D.surface, shapes: () => shapesOf(h),
			onHit: (blow) => hit(h, blow),
			ref: h,
		};
		layer.add(h.T);
		list.push(h);
		if (squad) squad.members.push(h);
		return h;
	}
	function shapesOf(h) {
		const p = h.pos;
		if (h.type === 'drone') return [{ type: 'sphere', c: { x: p.x, y: p.y, z: p.z }, r: 0.5, part: 'body' }, { type: 'sphere', c: { x: p.x + Math.sin(h.yaw) * 0.45, y: p.y - 0.04, z: p.z + Math.cos(h.yaw) * 0.45 }, r: 0.12, part: 'weak' }];
		if (h.type === 'crawler') {
			const fx2 = Math.sin(h.yaw), fz = Math.cos(h.yaw);
			return [{ type: 'capsule', a: { x: p.x - fx2 * 0.8, y: p.y + 0.55, z: p.z - fz * 0.8 }, b: { x: p.x + fx2 * 0.3, y: p.y + 0.6, z: p.z + fz * 0.3 }, r: 0.38, part: 'body' }, { type: 'sphere', c: { x: p.x + fx2 * 0.58, y: p.y + 0.62, z: p.z + fz * 0.58 }, r: 0.22, part: 'head' }];
		}
		return personShapes(p.x, p.y, p.z, h.body?.P.height || 1.75, h.crouch || 0);
	}
	const alive = () => list.filter((h) => !h.dead);

	function hit(h, blow) {
		if (h.dead) return null;
		const r = applyDamage(h.H, blow);
		if (!h.alert) alertSquad(h, blow.src);
		h.hurtT = 0.25;
		if (r.killed) die(h, blow);
		else if (h.H.hp < h.H.max * 0.35 && h.role !== 'fallback' && h.type !== 'crawler' && h.type !== 'drone') { h.role = 'fallback'; h.goalT = 0; }
		return r;
	}
	function die(h, blow) {
		h.dead = true; h.deadT = 0;
		layer.remove(h.id);
		const sq = h.squad;
		if (sq) { const rest = sq.members.filter((m) => !m.dead); if (rest.length) say(rest[0], 'down'); }
		const d = blow?.dir || { x: 0, z: 0 };
		if (h.body) {
			const p = h.pos;
			ctx.ragdolls.hit(h.body.P, { vel: new THREE.Vector3(d.x, 0.1, d.z).normalize().multiplyScalar(blow?.type === 'blast' ? 7 : 3.5), mass: 400, point: new THREE.Vector3(p.x, p.y + 1.2, p.z), lift: 0.06 });
			h.body.hand.hide();
		} else if (h.type === 'drone') { fx.explosion(h.pos, 1.2, false); h.vy = 0; }
		else fx.dust(h.pos, 6, 0.5, 0.55, 0.5, 0.8, 0.5);
		ctx.onDeath?.(h);
	}
	function release(h) {
		const i = list.indexOf(h);
		if (i >= 0) list.splice(i, 1);
		layer.remove(h.id);
		h.gone = true;
		if (h.body) { if (h.body.P.ragdoll) ctx.ragdolls.release(h.body.P); h.body.P.root.visible = false; h.body.hand.hide(); h.body.used = false; h.body.M.want.speed = 0; }
		if (h.mesh) { h.mesh.visible = false; h.mesh.userData.used = false; }
		if (h.squad) { const k = h.squad.members.indexOf(h); if (k >= 0) h.squad.members.splice(k, 1); if (!h.squad.members.length) squads.delete(h.squad.id); }
	}

	function say(h, what) {
		const lines = CALL[h.D.faction]?.[what];
		if (!lines || h.saidT > 0) return;
		const d = Math.hypot(h.pos.x - ctx.eye().x, h.pos.z - ctx.eye().z);
		if (d > 45) return;
		h.saidT = 4;
		ctx.call?.(pick(lines), h.D.name);
	}
	function alertSquad(h, src) {
		const sq = h.squad, mem = sq ? sq.members : [h];
		let k = 0;
		for (const m of mem) {
			if (m.dead || m.alert) continue;
			m.alert = 1; m.state = 'combat'; m.fireT = rnd(0.7, 1.4); m.goalT = 0;
			// one pins you down, the rest flank and close in
			m.role = m.type === 'drone' ? 'orbit' : m.type === 'crawler' ? 'rush' : k === 0 ? 'suppress' : k % 2 ? 'flank' : 'assault';
			m.flankSide = k % 4 < 2 ? 1 : -1;
			k++;
		}
		if (src && sq) sq.last = { x: src.x, z: src.z };
		const first = mem.find((m) => !m.dead);
		if (first) say(first, 'contact');
	}
	// gunfire heard at (x, z): squads within earshot wake
	function hear(x, z, r = 60) {
		for (const h of alive()) if (!h.alert && Math.hypot(h.pos.x - x, h.pos.z - z) < r) alertSquad(h, { x, z });
	}

	// where to go: by a bit of cover facing you, round your side, or in close
	function chooseGoal(h, me) {
		const dx = h.pos.x - me.x, dz = h.pos.z - me.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
		let R = 20, ang = 0;
		if (h.role === 'suppress') R = rnd(20, 28);
		else if (h.role === 'flank') { R = rnd(14, 20); ang = h.flankSide * rnd(0.9, 1.3); }
		else if (h.role === 'assault') R = rnd(9, 14);
		else if (h.role === 'fallback') R = rnd(32, 42);
		const c = Math.cos(ang), s = Math.sin(ang);
		let gx = me.x + (ux * c - uz * s) * R, gz = me.z + (ux * s + uz * c) * R;
		// the nearest cover within reach of that spot: put it between you and them
		const cover = ctx.coverNear?.(gx, gz, 9);
		if (cover) { const cx = cover.x - me.x, cz = cover.z - me.z, cl = Math.hypot(cx, cz) || 1; gx = cover.x + cx / cl * (cover.r + 0.7); gz = cover.z + cz / cl * (cover.r + 0.7); h.inCover = true; } else h.inCover = false;
		h.goal = { x: gx, z: gz };
		h.goalT = rnd(4, 7);
		if (h.role === 'flank') say(h, 'flank');
	}

	function shoot(h, me, dt) {
		const D = h.D;
		h.fireT -= dt;
		if (h.fireT > 0 || !h.los) return;
		const eye = ctx.eye(), dist = h.pos.distanceTo(eye);
		if (dist > D.range) return;
		const from = h.type === 'drone' ? h.pos.clone() : h.type === 'crawler' ? new THREE.Vector3(h.pos.x, h.pos.y + 0.65, h.pos.z) : muzzleOf(h);
		if (h.type === 'crawler') {
			// a spit of glowing mucus, slow enough to sidestep
			if (dist < 5 || h.spitT > 0) return;
			h.spitT = rnd(3.5, 5.5);
			ctx.projectile({ from, to: eye.clone().add(_v.set(0, -0.3, 0)), speed: 22, drop: 6, dmg: D.dmg * 0.8, type: 'energy', owner: h.T, style: 4, size: 0.12, splash: 0.8, hostile: true });
			h.fireT = rnd(...D.gap);
			return;
		}
		if (h.type === 'drone') {
			ctx.projectile({ from, to: eye.clone(), speed: 45, drop: 0, dmg: D.dmg, type: 'energy', owner: h.T, style: 4, size: 0.08, splash: 0.6, hostile: true, lead: me.vel });
			h.fireT = rnd(...D.gap);
			return;
		}
		// a raider's or officer's burst: each round a chance to hit, by distance, your movement, their role
		if (h.burst <= 0) { h.burst = Math.round(rnd(...D.burst)) * (h.role === 'suppress' ? 2 : 1); }
		h.burst--; h.mag--;
		const moving = Math.min(1, (me.speed || 0) / 6);
		const pHit = D.acc * Math.max(0.15, 1 - dist / (D.range * 1.1)) * (1 - 0.5 * moving) * (h.role === 'suppress' ? 0.6 : 1) * (h.inCover ? 0.85 : 1) * (ctx.coverK?.() ?? 1);
		const hitMe = Math.random() < pHit;
		const to = eye.clone().add(_v.set(0, -0.35, 0));
		if (!hitMe) to.add(_w.set(rnd(-1, 1), rnd(-0.6, 0.8), rnd(-1, 1)).multiplyScalar(0.8 + dist * 0.03));
		const dir = to.clone().sub(from).normalize();
		const end = hitMe ? to : from.clone().addScaledVector(dir, Math.min(D.range, dist + 30));
		fx.tracer(from, end, h.D.faction === 'patrol' ? 1 : 4, 380);
		fx.muzzle(from, dir, h.D.faction === 'patrol' ? 1 : 0);
		ctx.sound?.('hostile', from);
		if (hitMe) ctx.hurtPlayer({ amount: D.dmg * rnd(0.85, 1.15), type: 'ballistic', part: 'torso', src: from, by: h.T });
		else ctx.whiz?.(from, end);
		if (h.mag <= 0) { h.mag = 12; h.fireT = 2.2; h.burst = 0; say(h, 'reload'); return; }
		h.fireT = h.burst > 0 ? D.rate : rnd(...D.gap);
		if (h.role === 'suppress' && Math.random() < 0.08) say(h, 'pin');
	}
	function muzzleOf(h) {
		const m = h.body?.hand?.model;
		if (m?.visible) { _v.set(0.8, 0.1, 0).applyMatrix4(m.matrix); return _v.clone(); }
		return new THREE.Vector3(h.pos.x + Math.sin(h.yaw) * 0.5, h.pos.y + 1.35, h.pos.z + Math.cos(h.yaw) * 0.5);
	}

	// ---------- each frame ----------
	let time = 0;
	function update(dt, me) {
		time += dt;
		if (queue.length) queue.shift()();
		const eye = ctx.eye();
		for (let i = list.length - 1; i >= 0; i--) {
			const h = list[i];
			h.saidT = Math.max(0, (h.saidT || 0) - dt);
			const d = Math.hypot(h.pos.x - eye.x, h.pos.z - eye.z);
			if (h.dead) { fading(h, dt); continue; }
			// out of the fight (too far, another world): gone quietly
			if (d > 260) { release(h); continue; }
			tickHealth(h.H, dt);
			// sight: a few times a second
			h.losT -= dt;
			if (h.losT <= 0) {
				h.losT = rnd(0.2, 0.35);
				const from = _v.set(h.pos.x, h.pos.y + (h.type === 'drone' ? 0 : h.type === 'crawler' ? 0.7 : 1.5), h.pos.z);
				h.los = d < h.D.sight * (h.alert ? 1.8 : 1) && !ctx.blocked(from, eye);
				if (h.los && !h.alert && (d < h.D.sight * 0.7 || me.firing)) alertSquad(h, eye);
				if (h.los && h.squad) h.squad.last = { x: eye.x, z: eye.z };
			}
			if (h.type === 'drone') droneStep(h, dt, me, d);
			else if (h.type === 'crawler') crawlerStep(h, dt, me, d);
			else personStep(h, dt, me, d);
			const B = h.T.bound;
			B.x = h.pos.x; B.y = h.pos.y + (h.type === 'drone' ? 0 : 0.9); B.z = h.pos.z;
		}
	}
	function fading(h, dt) {
		h.deadT += dt;
		if (h.body) {
			if (h.deadT > 9) { const k = 1 - (h.deadT - 9) / 2; fadePerson(h.body.P, k); if (k <= 0) release(h); }
		} else if (h.type === 'drone') {
			h.vy = (h.vy || 0) - 9.8 * dt; h.pos.y += h.vy * dt;
			const gy = ctx.ground(h.pos.x, h.pos.z, h.pos.y + 1);
			if (h.pos.y < gy + 0.2) { h.pos.y = gy + 0.2; if (!h.burst2) { h.burst2 = true; fx.explosion(h.pos, 1.4); fx.smokePuff(h.pos, 0.2, 1.2); } }
			h.mesh.position.copy(h.pos); h.mesh.rotation.z += dt * 3;
			if (h.deadT > 4) { h.mesh.scale.setScalar(Math.max(0.01, 1 - (h.deadT - 4))); if (h.deadT > 5) release(h); }
		} else {
			h.mesh.rotation.z = Math.min(Math.PI * 0.9, h.deadT * 3);
			h.mesh.position.set(h.pos.x, h.pos.y + Math.min(0.6, h.deadT * 0.6) - Math.max(0, h.deadT - 4) * 0.4, h.pos.z);
			if (h.deadT > 6.5) release(h);
		}
	}
	function personStep(h, dt, me, d) {
		const b = h.body, M = b.M, S = M.S, eye = ctx.eye();
		h.pos.copy(S.pos);
		if (h.alert) {
			h.goalT -= dt;
			if (!h.goal || h.goalT <= 0) chooseGoal(h, eye);
			const gx = h.goal.x - h.pos.x, gz = h.goal.z - h.pos.z, gd = Math.hypot(gx, gz);
			const fx2 = eye.x - h.pos.x, fz = eye.z - h.pos.z;
			if (gd > 1.2) { M.want.heading = Math.atan2(gx, gz); M.want.speed = h.D.speed * (h.role === 'fallback' ? 1.1 : 1); M.want.run = 1; h.crouch = 0; }
			else { M.want.speed = 0; M.want.run = 0; M.want.heading = Math.atan2(fx2, fz); h.crouch = h.inCover ? 0.5 : 0; }
			// (they turn to you to shoot)
			if (h.los && gd < 6) M.want.heading = Math.atan2(fx2, fz);
			S.look.target = eye;
			if (h.los && (gd < 6 || h.role === 'suppress')) shoot(h, me, dt);
			else h.fireT = Math.max(h.fireT, 0.3);
		} else {
			// a slow patrol about where they stand
			h.goalT -= dt;
			if (h.goalT <= 0) { h.goalT = rnd(4, 9); const a = Math.random() * 6.283; h.goal = { x: h.home.x + Math.cos(a) * 6, z: h.home.z + Math.sin(a) * 6 }; }
			const gx = h.goal ? h.goal.x - h.pos.x : 0, gz = h.goal ? h.goal.z - h.pos.z : 0;
			if (Math.hypot(gx, gz) > 1) { M.want.heading = Math.atan2(gx, gz); M.want.speed = 1.1; M.want.run = 0; } else M.want.speed = 0;
		}
		h.yaw = S.heading;
		M.update(dt, time, eye);
		b.P.lod?.(d);
		b.hand.follow(b.P, S.heading, d < 90, M, time);
	}
	function droneStep(h, dt, me, d) {
		const eye = ctx.eye();
		h.ph += dt;
		let tx = h.home.x + Math.cos(h.ph * 0.3) * 8, tz = h.home.z + Math.sin(h.ph * 0.3) * 8;
		if (h.alert) {
			// circling you at a distance, rising and dipping
			const a = Math.atan2(h.pos.z - eye.z, h.pos.x - eye.x) + dt * 0.5 * (h.flankSide || 1);
			const R = 18 + Math.sin(h.ph * 0.7) * 4;
			tx = eye.x + Math.cos(a) * R; tz = eye.z + Math.sin(a) * R;
			shoot(h, me, dt);
		}
		const gy = ctx.ground(tx, tz, h.pos.y) + h.hover + Math.sin(h.ph * 1.3) * 0.6;
		const k = Math.min(1, dt * 1.6);
		h.pos.x += (tx - h.pos.x) * k * 0.6; h.pos.z += (tz - h.pos.z) * k * 0.6; h.pos.y += (gy - h.pos.y) * k;
		h.yaw = Math.atan2(eye.x - h.pos.x, eye.z - h.pos.z);
		const m = h.mesh;
		m.position.copy(h.pos); m.rotation.set(0.15 * Math.sin(h.ph * 2), h.yaw, 0.1 * Math.cos(h.ph * 1.7));
		for (const r of m.userData.rotors) r.rotation.y += dt * 40;
		m.userData.eye.material.color.setRGB(1, h.fireT < 0.4 && h.alert ? 0.9 : 0.29, 0.16);
	}
	function crawlerStep(h, dt, me, d) {
		const eye = ctx.eye(), m = h.mesh;
		h.spitT -= dt;
		let speed = 0;
		const tx = eye.x - h.pos.x, tz = eye.z - h.pos.z;
		if (h.alert) {
			if (h.leap > 0) {
				// the lunge: reared up (the warning), then across the gap
				h.leap -= dt;
				if (h.leap < 0.35 && !h.struck) { speed = 9; if (d < 2.4) { h.struck = true; ctx.hurtPlayer({ amount: h.D.dmg, type: 'impact', part: 'torso', src: h.pos.clone(), by: h.T }); } }
				if (h.leap <= 0) { h.leap = 0; h.fireT = rnd(1.2, 2); }
			} else if (d < 2.6 && h.fireT <= 0) { h.leap = 0.9; h.struck = false; }
			else { speed = d > 3 ? h.D.speed : 0; h.fireT -= dt; shoot(h, me, dt); }
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

	// a squad of n of a type round a point, facing a way
	function squad(type, x, z, n, opts = {}) {
		const sq = { id: 's' + nextId++, type, members: [], last: null, home: { x, z } };
		squads.set(sq.id, sq);
		const out = [];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * 6.283 + Math.random(), r = opts.spread ?? (type === 'drone' ? 6 : 3 + Math.random() * 3);
			const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
			out.push(spawn(type, px, pz, sq, { ...opts, id: opts.ids?.[i] }).then((h) => { if (h && opts.alert) alertSquad(h, ctx.eye()); return h; }));
		}
		return Promise.all(out).then(() => sq);
	}
	function clear() { for (const h of [...list]) release(h); squads.clear(); }
	const info = () => ({ alive: alive().length, fading: list.length - alive().length, max: MAX, squads: [...squads.values()].map((s) => ({ id: s.id, type: s.type, n: s.members.filter((m) => !m.dead).length, roles: s.members.filter((m) => !m.dead).map((m) => m.role), alert: s.members.some((m) => m.alert) })), bodies: pools.person.length, queue: queue.length });
	return { group, update, squad, spawn, hear, clear, info, alive, list, release };
}
