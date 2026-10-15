// Those who square up to you at close quarters, and the people round a fight. A townsperson
// you hit who hits back, a gang member or militia fighter who has closed on you while your
// hands are empty (raiders, smugglers, the village's guard, hired guns too): each circles you in a boxer's shuffle,
// spread round you, and they take turns (combat/melee-rules.js createTurns): one at a time
// (two when there are four or more, never two on a phone), a breath between, the one who has
// waited longest next. A strike has a tell (the step in, a heavy drawn right back) long enough
// to read, and the cannier ones feint. A blow lands on you only at its moment, and your block,
// parry or dodge decides it then (melee.js incoming()). Hit, they flinch, stagger (pushed back
// the way the blow went) or go down; up again off the ground after a fall. They sometimes raise
// their guard when they see your blow coming, which turns a light blow but not a heavy one.
//
// Round a fight: the people nearest flinch from each blow, those a little further stop and
// watch (some film it on their phones). What you did is a crime like any other (combat.js
// crime(), through the deal), so the witnesses call it in and the police come to arrest you the
// law's way (law/index.js). Minors are never part of any of it.
//
// Every list here is a plain array reused frame to frame, and the vectors are kept: nothing is
// made per frame while a fight goes on.

import * as THREE from 'three';
import { MOVES, createTurns, turnsFor, ringAngle, feints, tell, reaction } from './melee-rules.js';
import { isMinor } from './targets.js';
import { FACTIONS } from './factions.js';

// who closes to fists with an unarmed opponent: street gangs, militia, raiders, smugglers, the
// village's own, hired guns. Never officers (law/ arrests you its own way) nor soldiers
const MELEE_KINDS = new Set(['gang', 'militia', 'raiders', 'smugglers', 'villagers', 'mercs']);
// where each animation's wind-up ends and its blow lands, as progress through the action
const UMAP = { jab: [0.12, 0.35], cross: [0.14, 0.4], hook: [0.28, 0.55], haymaker: [0.5, 0.64], swing: [0.2, 0.45], overhead: [0.5, 0.66] };
const LINES = {
	taunt: ['Come on!', 'That all you got?', 'You\'re done!', 'Get him!', 'Hold still!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createFoes(ctx, api) {
	const { isPhone } = ctx;
	const list = [];                                   // the foes, in a fixed array
	const turns = createTurns({ max: 1, gap: isPhone ? [0.7, 1.3] : [0.45, 1.0] });
	const MAX = isPhone ? 3 : 5;
	let seq = 1, scanT = 0, lineT = 0, base = Math.random() * 6.28;
	const watchers = [];

	const find = (P) => { for (let i = 0; i < list.length; i++) if (list[i].P === P) return list[i]; return null; };
	const posOf = (f) => f.M.S.pos;
	// a foe: kind 'person' (a townsperson, with their brawl fighter f), 'squad' (a squad member h)
	function add(o) {
		const had = find(o.P);
		if (had) return had;
		if (list.length >= MAX || isMinor(o.P)) return null;
		const seed = o.P.dna?.seed ?? seq;
		const f = {
			id: 'foe' + seq++, kind: o.kind, P: o.P, M: o.M, p: o.p || null, h: o.h || null, fighter: o.fighter || null, T: o.T || null,
			skill: o.skill ?? (0.25 + (seed % 60) / 100), poise: o.poise ?? (o.kind === 'squad' ? 0.55 : 0.35), dmgK: o.kind === 'squad' ? 1 : 0.8,
			state: 'approach', t: 0, slot: 0, dir: seed % 2 ? 1 : -1, dirT: 1 + Math.random() * 2, cool: 0.6 + Math.random() * 0.8,
			move: null, m: null, wind: 0, feint: false, resolved: false, openT: 0, guardT: 0, struckMe: false, item: o.item || null,
			slide: new THREE.Vector3(), ov: null,
		};
		if (f.kind === 'person' && f.p) {
			f.ov = () => true;
			f.p.engaged = false; f.p.override = f.ov;
		}
		if (f.h) f.h.melee = true;
		list.push(f);
		return f;
	}
	function remove(f, i = list.indexOf(f)) {
		if (i < 0) return;
		list.splice(i, 1);
		turns.drop(f.id);
		if (f.p && f.p.override === f.ov) { f.p.override = null; if (!f.P.ragdoll) f.M.act(null); }
		if (f.h) { f.h.melee = false; if (!f.P.ragdoll) f.M.act(null); }
		f.gone = true;
	}
	const has = (P) => !!find(P);

	// ---------- the squads: who closes to fists ----------
	function scanSquads(e) {
		const sq = ctx.squads?.();
		if (!sq) return;
		const armed = ctx.armed();
		const alive = sq.list;
		for (let i = 0; i < alive.length; i++) {
			const h = alive[i];
			if (h.dead || h.kind !== 'person' || !h.body || h.crew || h.surrendered || h.fleeing) continue;
			const F = FACTIONS[h.fid];
			if (!F || !MELEE_KINDS.has(F.kind)) continue;
			const d = Math.hypot(h.pos.x - e.x, h.pos.z - e.z);
			if (h.melee) continue;
			if (armed || d > 6.5 || h.target?.id !== 'me' || ctx.down()) continue;
			add({ kind: 'squad', h, P: h.body.P, M: h.body.M, T: h.T });
			if (lineT <= 0 && Math.random() < 0.5) { lineT = 4; ctx.call?.(pick(LINES.taunt), F.name); }
		}
	}

	// ---------- turns and steps ----------
	function stepFoe(f, dt, e, n, idx) {
		const M = f.M, S = M.S, at = posOf(f);
		const dx = e.x - at.x, dz = e.z - at.z, d = Math.hypot(dx, dz) || 0.001, ux = dx / d, uz = dz / d;
		f.t += dt; f.cool -= dt; f.openT -= dt; f.guardT -= dt; f.dirT -= dt;
		// (the struck townsperson's steering stays theirs while they fight you)
		if (f.p && f.p.override !== f.ov && !f.P.ragdoll) f.p.override = f.ov;
		if (f.P.ragdoll) { if (f.state !== 'down') { f.state = 'down'; turns.drop(f.id); f.move = null; } return; }
		if (f.state === 'down') { f.state = 'getup'; f.t = 0; M.play('getup', 1.15, true); }
		M.want.heading = Math.atan2(dx, dz);
		M.want.speed = 0; M.want.run = 0;
		S.look.target = e;
		// a push from a blow, eased out
		if (f.slide.lengthSq() > 1e-4) { at.x += f.slide.x * dt; at.z += f.slide.z * dt; f.slide.multiplyScalar(Math.max(0, 1 - dt * 7)); }
		switch (f.state) {
			case 'getup':
				if (f.t > 1.1) { f.state = 'circle'; f.t = 0; f.cool = 0.5; }
				return;
			case 'stagger':
				if (f.t > f.stagger) { f.state = 'circle'; f.t = 0; f.cool = 0.4 + Math.random() * 0.4; M.act(null); }
				return;
			case 'guard':
				M.act('block', 0);
				if (f.guardT <= 0) { f.state = 'circle'; f.t = 0; }
				return;
			case 'approach': {
				if (S.act.name && S.act.name !== 'shuffle') M.act(null);
				if (d < 3.1) { f.state = 'circle'; f.t = 0; break; }
				M.want.speed = d > 6 ? 3.6 : 2.4; M.want.run = d > 6 ? 1 : 0.4;
				return;
			}
			case 'circle': break;
			case 'wind': case 'strike': case 'recover': strikeStep(f, dt, d, ux, uz); return;
		}
		// circling: in the shuffle, at the ring, round you, now and then the other way
		if (d > 4.2) { f.state = 'approach'; M.act(null); return; }
		M.act('shuffle');
		S.act.dur = 0.62;
		if (f.dirT <= 0) { f.dirT = 1.5 + Math.random() * 2.5; if (Math.random() < 0.4) f.dir = -f.dir; }
		const want = ringAngle(idx, n, base), R = 2.15 + (idx % 2) * 0.3;
		const tx = e.x - Math.sin(want) * R, tz = e.z - Math.cos(want) * R;
		// toward the ring's slot, and a slow strafe round it
		let vx = (tx - at.x) * 1.6 - uz * f.dir * 0.7, vz = (tz - at.z) * 1.6 + ux * f.dir * 0.7;
		const sp = Math.hypot(vx, vz), cap = 1.5;
		if (sp > cap) { vx *= cap / sp; vz *= cap / sp; }
		at.x += vx * dt; at.z += vz * dt;
		// a turn, when it is given
		if (f.cool <= 0 && d < 3.6 && !api.taking() && turns.want(f.id)) startStrike(f);
	}
	function startStrike(f) {
		let name;
		const r = Math.random();
		if (f.item) name = r < 0.3 ? f.item + 'Heavy' : f.item;
		else name = r < 0.22 + f.skill * 0.08 ? 'heavy' : r < 0.55 ? 'jab' : r < 0.8 ? 'cross' : 'hook';
		const m = MOVES[name] || MOVES.jab;
		f.move = name; f.m = m; f.t = 0; f.state = 'wind'; f.resolved = false;
		f.wind = tell(m, f.skill);
		f.feint = feints(f.skill);
		if (m.kind === 'heavy') ctx.sound.grunt(posOf(f), 0.9 + Math.random() * 0.2, 0.6);
	}
	function strikeStep(f, dt, d, ux, uz) {
		const M = f.M, m = f.m, at = posOf(f), [u0, u1] = UMAP[m.anim] || UMAP.jab;
		const reach = m.reach + 0.15;
		if (f.state === 'wind') {
			M.act(m.anim, u0 * Math.min(1, f.t / f.wind));
			// the step in: the tell
			if (d > reach - 0.25) { const s = Math.min(3.2, (d - reach + 0.35) / Math.max(0.1, f.wind - f.t)); at.x += ux * s * dt; at.z += uz * s * dt; }
			if (f.feint && f.t > f.wind * 0.7) { f.state = 'recover'; f.t = m.recover * 0.4; f.resolved = true; return; }
			if (f.t >= f.wind) { f.state = 'strike'; f.t = 0; ctx.sound.swing(m.kind === 'heavy', at, m.item); }
			return;
		}
		if (f.state === 'strike') {
			M.act(m.anim, u0 + (u1 - u0) * Math.min(1, f.t / m.active));
			if (!f.resolved && f.t >= m.active * 0.7) {
				f.resolved = true;
				// in reach and in front of them: your defence decides it
				if (d < reach + 0.2) {
					const r = api.incoming(f, m);
					f.struckMe = f.struckMe || r === 'hit' || r === 'break' || r === 'block';
					if (r === 'parry') { stagger(f, 1.0, -ux, -uz, 1.6); f.openT = 1.2; return; }
					if (r === 'evade') f.extra = 0.3;
				} else ctx.sound.miss(at);
			}
			if (f.t >= m.active) { f.state = 'recover'; f.t = 0; }
			return;
		}
		// recovering back to the guard
		const rec = m.recover * 1.3 + (f.extra || 0);
		M.act(m.anim, u1 + (1 - u1) * Math.min(1, f.t / rec));
		if (f.t >= rec) { f.state = 'circle'; f.t = 0; f.extra = 0; f.move = null; turns.done(f.id); f.cool = 0.5 + Math.random() * 0.9 - f.skill * 0.3; M.act(null); }
	}
	function stagger(f, t, dx, dz, push) {
		f.state = 'stagger'; f.t = 0; f.stagger = t; f.move = null;
		turns.done(f.id);
		f.slide.set(dx * push, 0, dz * push);
		f.M.act(null);
	}

	// ---------- you strike them ----------
	// your blow is coming at P: they may raise their guard (light blows only are turned)
	function threat(P, m) {
		const f = find(P);
		if (!f || f.state !== 'circle' || f.openT > 0) return;
		if (Math.random() < f.skill * (m.kind === 'heavy' ? 0.25 : 0.5)) { f.state = 'guard'; f.guardT = 0.55; f.t = 0; }
	}
	// a blow of yours on P is about to land: is it turned by their guard?
	function guarded(P, m, facing) {
		const f = find(P);
		return !!f && f.state === 'guard' && facing > 0.2 && m.kind !== 'heavy';
	}
	// your blow landed on someone (a foe or not): their reaction. dir: the blow's way (unit)
	function struck(b, m, dir, { hpFrac = 1, blocked = false, killed = false, hold = 0 } = {}) {
		const f = find(b.P), M = b.M;
		const k = m.kind === 'heavy' ? 1.7 : m.anim === 'hook' ? 1.1 : m.item ? 1.4 : 0.75;
		const twist = m.anim === 'hook' || m.anim === 'swing' ? -(dir.x * Math.cos(M.S.heading) - dir.z * Math.sin(M.S.heading)) * 0.8 - 0.4 : 0;
		if (!b.P.ragdoll) M.jolt?.(dir.x, dir.z, blocked ? k * 0.35 : k, twist, hold);
		if (killed) return 'killed';
		const R = reaction(m, { poise: f?.poise ?? 0.35, hpFrac, open: (f?.openT ?? 0) > 0, blocked });
		if (f) {
			if (blocked) { f.slide.set(dir.x * 1.2, 0, dir.z * 1.2); f.state = 'circle'; f.t = 0; return 'blocked'; }
			if (R.kind === 'stagger' || R.kind === 'down') stagger(f, R.t, dir.x, dir.z, R.kind === 'down' ? 3 : 2.2);
			else {
				// a flinch: a wind-up broken off, a little push
				if (f.state === 'wind') { f.state = 'circle'; f.t = 0; f.move = null; turns.done(f.id); M.act(null); }
				f.slide.set(dir.x * 1.1, 0, dir.z * 1.1);
			}
		}
		return R.kind;
	}

	// ---------- round a fight ----------
	// the nearest flinch; a little further off they stop and watch, some filming it
	function onlookers(at) {
		const pool = ctx.people()?.pool;
		if (!pool) return;
		for (let i = 0; i < pool.length; i++) {
			const p = pool[i];
			if (!p.active || !p.P?.root.visible || p.P.ragdoll || isMinor(p.P) || find(p.P)) continue;
			const q = p.M.S.pos, d = Math.hypot(q.x - at.x, q.z - at.z);
			if (d < 6.5) {
				if (!p.M.S.act.name) p.M.play('flinch', 0.6, true);
				p.M.feel?.('surprise', 0.8);
			} else if (d < 20 && !p.override && !p.engaged && watchers.length < (isPhone ? 4 : 10)) {
				const w = { p, t: 6 + Math.random() * 6, film: Math.random() < 0.4, x: at.x, z: at.z };
				p.override = (pp) => { const S = pp.M.S; pp.M.want.speed = 0; pp.M.want.heading = Math.atan2(w.x - S.pos.x, w.z - S.pos.z); return true; };
				w.ov = p.override;
				if (w.film) p.M.setPose('phone');
				p.M.feel?.('surprise', 0.6);
				watchers.push(w);
			}
		}
	}
	function stepWatchers(dt, e) {
		for (let i = watchers.length - 1; i >= 0; i--) {
			const w = watchers[i];
			w.t -= dt;
			// (keep watching while the fight goes on near them)
			if (list.length && Math.hypot(w.x - e.x, w.z - e.z) < 25) { w.x = e.x; w.z = e.z; w.t = Math.max(w.t, 1); }
			if (w.t <= 0 || !w.p.active || w.p.override !== w.ov) {
				if (w.p.override === w.ov) { w.p.override = null; w.p.M.setPose('rest'); }
				watchers.splice(i, 1);
			}
		}
	}

	// ---------- each frame ----------
	function update(dt) {
		const e = ctx.eye();
		lineT -= dt; scanT -= dt;
		turns.tick(dt);
		if (scanT <= 0) { scanT = 0.25; scanSquads(e); }
		// leaving: the beaten, the far, the yielded, and everyone when you draw a weapon
		const armed = ctx.armed();
		for (let i = list.length - 1; i >= 0; i--) {
			const f = list[i], at = posOf(f), d = Math.hypot(at.x - e.x, at.z - e.z);
			const gone = d > 14 || (f.h && (f.h.dead || f.h.gone || f.h.surrendered || f.h.fleeing)) || (f.p && (!f.p.active || !f.P.root.visible)) || (f.fighter && (f.fighter.down || f.fighter.q?.done)) || ctx.down();
			if (gone || (armed && f.h)) remove(f, i);
		}
		turns.setMax(turnsFor(list.length, isPhone));
		base += dt * 0.05;
		for (let i = 0; i < list.length; i++) stepFoe(list[i], dt, e, list.length, i);
		// (kept apart from each other)
		for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
			const a = posOf(list[i]), b = posOf(list[j]), dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
			if (d < 0.95 && d > 1e-3) { const k = (0.95 - d) * 0.5 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
		}
		stepWatchers(dt, e);
	}
	function clear() {
		for (let i = list.length - 1; i >= 0; i--) remove(list[i], i);
		for (const w of watchers) if (w.p.override === w.ov) { w.p.override = null; w.p.M.setPose('rest'); }
		watchers.length = 0;
		turns.clear();
	}
	// the one striking at you now, if any (for the HUD and the tests)
	const striking = () => { for (let i = 0; i < list.length; i++) if (list[i].state === 'wind' || list[i].state === 'strike') return list[i]; return null; };
	const info = () => ({ foes: list.map((f) => ({ kind: f.kind, state: f.state, move: f.move, d: +Math.hypot(posOf(f).x - ctx.eye().x, posOf(f).z - ctx.eye().z).toFixed(1), skill: +f.skill.toFixed(2) })), turns: turns.busy, rest: +turns.rest.toFixed(2), watchers: watchers.length });
	return { add, remove, has, find, threat, guarded, struck, onlookers, update, clear, info, striking, get list() { return list; } };
}
