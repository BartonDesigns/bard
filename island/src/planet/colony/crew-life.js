// The colony's named crew in the world: real bodies (people/body.js) in coveralls of their
// trade's colour, their faces bare indoors; outside, the coverall painted white as a suit,
// a glass helmet and a pack, put on and taken off as they pass an airlock. Each keeps the
// day crew.js gives them, walking the corridors and the dome's ring between the rooms; out
// of sight they are simply where their day says. Only the few near you have bodies.
//
// You can walk up to any of them and talk (people.js addTalkers, the guide's conversation):
// they are remembered residents (people/social.js) with who they are from crew.js, and
// what they have to ask comes from errands.js (talk, marks, holds).

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA, rng } from '../../people/body.js';
import { hairFor } from '../../people/wardrobe.js';
import { createMotion } from '../../people/motion.js';
import { paint } from '../../people/garment.js';
import { addTalkers } from '../../people/people.js';
import { freeBody } from '../../people/social-actors.js';
import { frame } from '../alienkit.js';
import { markTexture } from '../medieval/quests.js';
import { CAST, placeFor, activity } from './crew.js';

const TAU = Math.PI * 2, RING = 13.6, DOME = 15;
const hash = (s) => s.split('').reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
// a coverall of the trade's colour, or the same cut in suit white with the colour as trim
const coverall = (col, suit) => ({ gen: 'alien', top: { kind: 'suit', col: suit ? '#e6e6e2' : col, acc: suit ? col : '#d8d8d4', pat: 'block', fit: 'fitted', sleeves: 'long', fab: 'tech' }, outer: null, bottom: { kind: 'suit', col: suit ? '#e2e2de' : col, acc: suit ? col : '#d8d8d4', pat: 'plain', legs: 'long', fit: 'regular', fab: 'tech' }, shoes: { kind: 'boot', col: suit ? '#cfcfca' : '#3a3d42', sole: '#1b1b1d' }, acc: [] });
// how they walk the rooms: lane points (local x, share of the module's length) clear of the furniture
const LANES = { lounge: [[0, 0.3], [1.85, 0.36], [1.85, 0.62]], workshop: [[0.9, 0.2]], mess: [[0.5, 0.15]], med: [[0.3, 0.15]] };

// where everyone works, eats, rests and sleeps: plain points from the colony's plan
export function planCrew(X, plan, floor) {
	const h = plan.hub, R = X.rooms, mods = R.modules;
	const mod = (role) => mods.find((m) => m.role === role);
	const at = (M, lx, t, yaw) => { const p = M.frame.p(lx, 0, M.d0 + M.L * t); return { x: p.x, z: p.z, y: M.y + 0.4, mod: M.i, yaw: yaw ?? M.a }; };
	const claim = (room) => { const s = X.spots.find((q) => q.room === room && !q.taken); if (!s) return null; s.taken = true; return { x: s.x, z: s.z, y: s.y, mod: s.mod ?? 'dome', yaw: s.yaw }; };
	const F = frame(h.x, h.y, h.z, h.yaw);
	const work = {};
	for (const c of CAST) {
		let p = null;
		if (c.at === 'dome') { const q = F.p(0.9, 0, 5.4); p = { x: q.x, z: q.z, y: h.y, mod: 'dome', yaw: h.yaw + Math.PI }; }
		else if (c.at === 'farm') p = claim('farm');
		else if (c.at === 'mess' && mod('mess')) { const M = mod('mess'); p = at(M, 1.25, (1.6 + (M.L * 0.7 - 2.2) * 0.45) / M.L, M.a + Math.PI / 2); }
		else if (['med', 'workshop', 'depot'].includes(c.at)) p = claim(c.at);
		else if (c.at === 'cab' && R.cab) { const C = R.cab, q = frame(C.x, C.y, C.z, C.yaw).p(0, 0, -2.9); p = { x: q.x, z: q.z, y: C.y + C.cab, mod: 'cab', yaw: C.yaw + Math.PI }; }
		else {
			const o = (plan.outer || []).find((q) => q.kind === c.at);
			const L = { relay: [1.4, -5.0], observatory: [3.4, -5.4], shelter: [2.8, 10.8], plaza: [1.8, -7.0], mine: [2.0, 9.0] }[c.at];
			if (o && L) { const q = frame(o.x, o.y, o.z, o.yaw).p(L[0], 0, L[1]); p = { x: q.x, z: q.z, y: floor(q.x, q.z, o.y + 3), mod: 'out:' + c.at, yaw: o.yaw + Math.PI }; }
		}
		if (p) work[c.id] = p;
	}
	// meals at the mess tables, evenings in the lounge's windowed end, nights by the bunks
	const seats = { mess: [], lounge: [], quarters: [] };
	const M = mod('mess'), Lg = mod('lounge'), Q = mod('quarters');
	for (let j = 0; j < CAST.length; j++) {
		if (M) seats.mess.push(at(M, -0.35, 0.18 + (j % 7) * 0.075, M.a - Math.PI / 2));
		if (Lg) { const s = [[-1.4, 0.74], [1.4, 0.76], [0, 0.9], [-0.9, 0.86], [1.0, 0.88], [-1.7, 0.82], [1.7, 0.84]][j % 7]; seats.lounge.push(at(Lg, s[0], s[1] + (j >= 7 ? 0.03 : 0), Lg.a)); }
		if (Q) { const side = j % 2 ? 1 : -1, k = (j >> 1) % Math.max(1, Math.floor((Q.L * 0.65 - 2) / 2.4)); const p = Q.frame.p(side * 0.85, 0, Q.d0 + 2.2 + k * 2.4); seats.quarters.push({ x: p.x, z: p.z, y: Q.y + 0.4, mod: Q.i, yaw: Q.a + side * Math.PI / 2 }); }
	}
	// the earthrise watch: the lounge's windowed end
	const watch = Lg ? at(Lg, 0, 0.8) : null;
	return { hub: h, work, seats, watch, lounge: Lg?.i ?? null };
}

export function createCrew(X, C, o) {
	const { camera, scene, isPhone, plan, floor } = o;
	const group = new THREE.Group();
	group.name = 'colony:crew';
	scene.add(group);
	const h = C.hub, mods = X.rooms.modules;
	const LIMIT = isPhone ? 4 : 8, BUILD = isPhone ? 60 : 85, FREE = BUILD + 50;
	let A = null, failed = false, building = false, clock = 0, t = 0;
	// the helmet, the collar and the pack: shared shapes and materials
	const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
	const shell = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.55 });
	const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6 });
	const ball = new THREE.SphereGeometry(1, 20, 14), torus = new THREE.TorusGeometry(1, 0.22, 8, 20).rotateX(Math.PI / 2), pack = new THREE.BoxGeometry(0.34, 0.46, 0.17), pipe = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6);
	const markTex = { offer: markTexture('offer'), ready: markTexture('ready') };
	const markMat = { offer: new THREE.SpriteMaterial({ map: markTex.offer, depthTest: false, transparent: true }), ready: new THREE.SpriteMaterial({ map: markTex.ready, depthTest: false, transparent: true }) };

	// ---------- everyone, logically, always ----------
	const folk = CAST.filter((c) => C.work[c.id]).map((c, j) => ({ c, id: c.id, j, name: c.name, built: false, P: null, M: null, pos: { ...C.work[c.id] }, place: null, route: [], goal: null, active: true, engaged: false, speakUntil: 0, hold: false, mark: null, suited: null, t: 0, P0: null }));
	const byId = Object.fromEntries(folk.map((f) => [f.id, f]));
	const inside = (p) => X.vol.some((v) => {
		if (p.y < v.y0 || p.y > v.y1) return false;
		if (v.kind === 'disc') return Math.hypot(p.x - v.x, p.z - v.z) < v.r;
		const dx = p.x - v.x, dz = p.z - v.z, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
		return Math.abs(dx * c - dz * s) < v.hw && Math.abs(dx * s + dz * c) < v.hd;
	});
	// a point in the hub as seen from the dome's middle
	const polar = (p) => ({ a: Math.atan2(p.x - h.x, p.z - h.z), r: Math.hypot(p.x - h.x, p.z - h.z) });
	const ringAt = (a, r = RING) => ({ x: h.x + Math.sin(a) * r, z: h.z + Math.cos(a) * r, y: h.y });
	const local = (M, p) => { const dx = p.x - h.x, dz = p.z - h.z, c = Math.cos(M.a), s = Math.sin(M.a); return { x: dx * c - dz * s, z: dx * s + dz * c }; };
	const mp = (M, lx, lz) => { const q = M.frame.p(lx, 0, lz); return { x: q.x, z: q.z, y: M.y + 0.4 }; };
	// in or out of a module, by its door and its lanes
	function intoModule(M, to) {
		const L = local(M, to), lanes = LANES[M.role] || [], out = [mp(M, 0, DOME - 1.2), mp(M, 0, M.d0 + 1.0)];
		let lx = 0;
		for (const [x, k] of lanes) { const z = M.d0 + M.L * k; if (z < L.z - 0.5) { out.push(mp(M, x, z)); lx = x; } }
		out.push(mp(M, lx, L.z), { ...to });
		return out;
	}
	// a walk through the hub: out of a room, round the dome's ring, into another
	function hubRoute(from, to) {
		const fM = typeof from.mod === 'number' ? mods[from.mod] : null, tM = typeof to.mod === 'number' ? mods[to.mod] : null;
		if (fM && fM === tM) { const L = local(fM, to); return [mp(fM, LANES[fM.role]?.at(-1)?.[0] ?? 0, L.z), { ...to }]; }
		const out = [];
		if (fM) out.push(...intoModule(fM, from).reverse().slice(1));
		const a0 = fM ? fM.a : polar(from).a, a1 = tM ? tM.a : polar(to).a;
		let da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
		const n = Math.max(1, Math.ceil(Math.abs(da) / 0.3));
		for (let k = 0; k <= n; k++) out.push(ringAt(a0 + da * k / n));
		if (tM) out.push(...intoModule(tM, to));
		else out.push({ ...to });
		return out;
	}
	const zone = (p) => (typeof p.mod === 'number' || p.mod === 'dome' ? 'hub' : p.mod);
	const seen = (f) => f.built && Math.hypot(f.pos.x - camera.position.x, f.pos.z - camera.position.z) < 70;
	// where their day (or an errand, or the earthrise watch) puts them now
	function goalFor(f, hours) {
		const watchOn = o.watching?.(f.id);
		if (watchOn && C.watch) {
			// round the window, facing out with everyone else
			if (!f.watchP) { const M = mods[C.lounge], L = local(M, C.watch), a = f.j * 2.4; f.watchP = { ...mp(M, Math.max(-1.7, Math.min(1.7, Math.sin(a) * 1.4)), L.z + Math.cos(a) * 0.9 - 0.6), mod: C.lounge, yaw: M.a }; }
			return { key: 'watch', p: f.watchP };
		}
		const pl = placeFor(f.c, hours, f.hold);
		if (pl === 'work') return { key: 'work', p: C.work[f.id] };
		const s = C.seats[pl]?.[f.j];
		return s ? { key: pl, p: s } : { key: 'work', p: C.work[f.id] };
	}
	function setGoal(f, g) {
		f.place = g.key;
		f.goal = g.p;
		const from = f.pos, to = g.p, za = zone(from), zb = zone(to);
		if (!seen(f)) { f.route = []; f.pos = { ...to }; if (f.built) f.M.place(to.x, to.y, to.z, to.yaw ?? 0); return; }
		if (za === 'hub' && zb === 'hub') f.route = hubRoute(from, to);
		else if (za === 'hub') {
			// leaving the hub: out through the nearest airlock, and gone over the regolith
			const k = typeof from.mod === 'number' ? from.mod : 0, d = X.doors[k];
			f.route = [...hubRoute(from, { ...mp(mods[k], 0, mods[k].z1 - 1.5), mod: k }), { x: d.lock.x, z: d.lock.z, y: h.y }, { x: d.x, z: d.z, y: h.y }, { jump: to }];
		} else if (zb === 'hub') {
			// coming home: in at an airlock, the suit off inside
			const k = typeof to.mod === 'number' ? to.mod : 0, d = X.doors[k], inner = { ...mp(mods[k], 0, mods[k].z1 - 1.5), mod: k };
			f.route = [{ jump: { x: d.x, z: d.z, y: h.y, mod: 'out' } }, { x: d.lock.x, z: d.lock.z, y: h.y }, ...hubRoute(inner, to)];
		} else f.route = [{ jump: to }];
	}
	const near = () => folk.filter((f) => f.built).length;
	async function grow(f) {
		building = true;
		try {
			A = A || await loadPeopleAssets();
			const c = f.c, seed = (hash(c.id) ^ (plan.seed || 0)) >>> 0;
			const d = personDNA(seed, { age: c.age, ancestry: c.anc, style: coverall(c.col, false) });
			const male = c.sex === 'm', r = rng(seed ^ 0xc0ffee);
			d.male = male; d.sex = male ? 0.85 : 0.12;
			d.height = (male ? 1.76 : 1.64) + (r() - 0.5) * 0.1;
			d.hair = male ? (c.age > 50 && r() < 0.3 ? null : r() < 0.5 ? 'short01' : 'short02') : r() < 0.5 ? 'ponytail01' : 'short02';
			d.style.hair = hairFor(rng(seed ^ 0x57a1e), d, d.style);
			const P = buildPerson(A, d);
			const M = createMotion(P, (x, z) => floor(x, z, P.root.position.y));
			M.place(f.pos.x, f.pos.y, f.pos.z, f.pos.yaw ?? 0);
			M.setPose('rest');
			f.P = P; f.M = M; f.built = true; f.suited = null;
			f.gear = suitGear(P);
			group.add(P.root);
		} catch (e) { failed = true; console.warn('[colony] crew', e); }
		building = false;
	}
	function suitGear(P) {
		const s = P.height / 1.7, head = P.bones[P.map.head], neck = P.bones[P.map.neck01] || head, back = P.bones[P.map.spine01] || P.bones[0];
		const helmet = new THREE.Mesh(ball, glass); helmet.scale.setScalar(0.19 * s); helmet.position.set(0, 0.1 * s, 0.015); helmet.renderOrder = 4;
		const collar = new THREE.Mesh(torus, shell); collar.scale.set(0.12 * s, 0.12 * s, 0.12 * s); collar.position.set(0, 0.0, 0.0);
		const pk = new THREE.Mesh(pack, shell); pk.position.set(0, 0.02, -0.2 * s); pk.castShadow = true;
		const hose = new THREE.Mesh(pipe, dark); hose.position.set(0.12 * s, 0.25 * s, -0.12 * s); hose.rotation.x = 0.7;
		head.add(helmet); neck.add(collar); back.add(pk, hose);
		return [helmet, collar, pk, hose];
	}
	function suit(f, on) {
		if (f.suited === on) return;
		f.suited = on;
		for (const m of f.gear) m.visible = on;
		paint(f.P.clothMat, coverall(f.c.col, on));
	}
	function drop(f) {
		for (const m of f.gear || []) m.removeFromParent();
		if (f.markS) { f.markS.removeFromParent(); f.markS = null; }
		freeBody(f.P);
		f.P = f.M = null; f.built = false; f.gear = null;
	}
	const stopTalk = addTalkers(() => folk.filter((f) => f.built && f.P.root.visible));
	for (const f of folk) {
		f.talk = { open: () => o.talkOpen?.(f.id), reply: (text) => o.talkReply?.(f.id, text) };
		f.resident = () => o.resident(f.id, activity(f.c, f.place || 'work'));
	}

	function update(dt) {
		t += dt; clock -= dt;
		const hours = o.hours?.();
		const cam = camera.position;
		// every few seconds: the day moves people on; bodies come and go with you
		if (clock <= 0) {
			clock = 1.5;
			if (Number.isFinite(hours)) for (const f of folk) {
				f.hold = !!o.holds?.(f.id);
				if (f.engaged) continue;
				const g = goalFor(f, hours);
				if (g.p && (g.key !== f.place || g.p !== f.goal) && !(f.route.length && f.goal === g.p)) setGoal(f, g);
				f.mark = o.mark?.(f.id) || null;
			}
			if (!building && !failed && near() < LIMIT) {
				const want = folk.filter((f) => !f.built).map((f) => ({ f, d: Math.hypot(f.pos.x - cam.x, f.pos.z - cam.z, (f.pos.y - cam.y) * 2) })).filter((q) => q.d < BUILD).sort((a, b) => a.d - b.d)[0];
				if (want) grow(want.f);
			}
			for (const f of folk) if (f.built && !f.engaged && Math.hypot(f.pos.x - cam.x, f.pos.z - cam.z) > FREE) drop(f);
		}
		for (const f of folk) {
			// out of sight: straight to the next point, then the place
			if (!f.built) { if (f.route.length) { const q = f.route.shift(); f.pos = q.jump ? { ...q.jump } : { ...f.pos, ...q }; } continue; }
			const M = f.M, S = M.S;
			const d = Math.hypot(S.pos.x - cam.x, S.pos.z - cam.z);
			f.P.lod?.(d);
			if (f.engaged) {
				// talking with you: stop, face you, speak while there is speech
				M.want.heading = Math.atan2(cam.x - S.pos.x, cam.z - S.pos.z);
				M.want.speed = 0;
				S.look.target = cam;
				const speaking = performance.now() < (f.speakUntil || 0);
				S.talk = speaking ? 1 : 0;
				M.setPose(speaking ? 'rest' : 'listen');
				f.t -= dt;
				if (!speaking && f.t < 0) { f.t = 3 + Math.random() * 5; if (Math.random() < 0.5) M.gesture('nod'); }
			} else if (f.route.length) {
				const q = f.route[0];
				if (q.jump) {
					f.route.shift();
					f.pos = { ...q.jump };
					M.place(q.jump.x, q.jump.y, q.jump.z, q.jump.yaw ?? 0);
					continue;
				}
				const dx = q.x - S.pos.x, dz = q.z - S.pos.z, dd = Math.hypot(dx, dz);
				M.want.heading = Math.atan2(dx, dz);
				M.want.speed = 1.15;
				S.look.target = d < 5 ? cam : null;
				M.setPose('rest');
				if (dd < 0.45 || (f.route.length > 1 && dd < 0.8)) f.route.shift();
				if (!f.route.length) M.want.speed = 0;
			} else {
				M.want.speed = 0;
				if (f.goal?.yaw !== undefined && f.t < 0) { M.want.heading = f.goal.yaw; }
				S.look.target = d < 5 ? cam : null;
				f.t -= dt;
				if (f.t < 0) {
					f.t = 5 + Math.random() * 7;
					if (d < 7) { M.want.heading = Math.atan2(cam.x - S.pos.x, cam.z - S.pos.z); M.gesture(['wave', 'nod', 'open'][Math.floor(Math.random() * 3)]); }
					else if (f.place === 'work') M.gesture(['think', 'explain', 'point'][Math.floor(Math.random() * 3)]);
					M.setPose(f.place === 'quarters' || f.place === 'lounge' ? 'crossed' : 'rest');
				}
			}
			M.update(dt, t, cam);
			f.pos = { x: S.pos.x, y: S.pos.y, z: S.pos.z, mod: f.goal?.mod ?? f.pos.mod, yaw: S.heading };
			const on = d < 160;
			f.P.root.visible = on;
			if (on) suit(f, !inside({ x: S.pos.x, y: S.pos.y + 0.3, z: S.pos.z }));
			// the mark over the head: something to ask (!), or to hear (?)
			const mk = f.engaged ? null : f.mark;
			if (mk && !f.markS) { f.markS = new THREE.Sprite(markMat[mk]); f.markS.scale.setScalar(0.42); f.markS.renderOrder = 6; f.P.root.add(f.markS); }
			if (f.markS) {
				if (!mk) { f.markS.removeFromParent(); f.markS = null; }
				else { f.markS.material = markMat[mk]; f.markS.position.set(0, f.P.height + (f.suited ? 0.55 : 0.4) + Math.sin(t * 2) * 0.04, 0); }
			}
		}
	}
	function dispose() {
		stopTalk();
		for (const f of folk) if (f.built) drop(f);
		scene.remove(group);
		for (const g of [ball, torus, pack, pipe]) g.dispose();
		for (const m of [glass, shell, dark, markMat.offer, markMat.ready]) m.dispose();
		markTex.offer.dispose(); markTex.ready.dispose();
	}
	const info = () => folk.map((f) => ({ id: f.id, name: f.name, place: f.place, built: f.built, suited: f.suited, mark: f.mark, walking: f.route.length, x: Math.round(f.pos.x * 10) / 10, y: Math.round(f.pos.y * 10) / 10, z: Math.round(f.pos.z * 10) / 10 }));
	return { update, dispose, folk, byId, info, state: () => ({ assets: !!A, building, failed }), where: (id) => byId[id]?.pos || null, place: (id) => byId[id]?.place || null };
}
