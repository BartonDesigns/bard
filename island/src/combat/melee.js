// Close combat, yours and the townsfolk's (combat/melee-rules.js has the timing, brawl.js how a
// quarrel grows, melee-foes.js those who square up to you).
//
// You, with nothing in your hands: tap the left button (Q, or Strike on a touch screen) for a
// quick strike, and keep tapping for the string (jab, cross). Shift+press, or Heavy on touch,
// drawn back while you hold and thrown when you let go. Hold the right button (Block) to guard:
// raised just as a blow comes in, it parries and leaves them open for a counter that hits
// harder. C (Dodge) slips the way you are moving, or back, with a moment in the middle when
// nothing lands. Behind someone who has not seen you, Q (Takedown) chokes them out. Shift+Q
// is a charged heavy; J or Grab grabs and throws; X still shoves (people/self.js). A bat, a
// length of pipe or a bottle lying about is picked up as you walk over it and swung instead.
//
// Each strike winds up, lands at its moment and recovers; one that lands holds the world still
// a few frames (hit-stop), kicks the view, sounds in layers (melee-sound.js) and knocks the one
// struck the way it went (people/motion.js jolt), rocking them or putting them down. Someone you
// hit may run, or may square up and come back at you, and a gang member who has closed on you
// while your hands are empty fights the same way. People near flinch and watch; the police are
// called and come to arrest you when the fight was yours. In the street now and then two
// grown-ups fall out: words, a shove, fists, a bottle off a table; most cool off, some go down;
// step in and you have broken it up. Children are never part of any of it: never struck, never
// a brawler (the Spark, combat/targets.js).
//
// Nothing here is made per frame: the vectors are kept, the lists are reused.

import * as THREE from 'three';
import { BLOWS, nextBlow, canMelee, canBrawl, escalate, improvised, blowDamage, brawlResponse, stageIndex } from './brawl.js';
import { MOVES, phaseAt, moveTime, createStriker, wobble, strikeDamage, defend, DODGE, COUNTER_WINDOW, hitStop, canTakedown, TAKEDOWN, fightDeed } from './melee-rules.js';
import { isMinor } from './targets.js';
import { createMeleeSound } from './melee-sound.js';
import { createMeleeFeel } from './melee-feel.js';
import { createFistView } from './melee-view.js';
import { meleeItem, meleeMaterials } from './melee-items.js';
import { createFoes } from './melee-foes.js';
import { createMeleeTouch } from './melee-touch.js';

const LINES = {
	words: ['You got a problem?', 'Back off!', 'Say that again.', 'Walk away, man.', 'Don\'t push me!', 'What did you just say?'],
	fists: ['That\'s it!', 'Come on then!', 'Hey! Break it up!', 'Somebody call the police!'],
	weapon: ['He\'s got a bottle!', 'Put it down!', 'Whoa, whoa, whoa!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// which side each strike comes from, for the view's roll (-1 the left hand, 1 the right)
const SIDE = { jab: -1, cross: 1, hook: 1, heavy: 1, bat: 1, pipe: 1, bottle: 1, knife: 1, machete: 1, batHeavy: 0, pipeHeavy: 0, bottleHeavy: 0, knifeHeavy: 0, macheteHeavy: 0 };
const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _a = new THREE.Vector3();

export function createMelee(ctx) {
	const { camera, mount, touch } = ctx;
	const isPhone = !!ctx.isPhone;
	const ME = { id: 'me', kind: 'player', faction: 'player' };
	const brawls = [];
	const drops = [];
	const me = {
		item: null, uses: 0, last: null, lastT: 9, guardT: 0, held: null, holdT: 0, holdQ: 0,
		move: null, m: null, mt: 0, hitDone: false, charging: false, charge: 0, counter: false, queued: null, target: null,
		press: false, pressT: 0, block: false, blockT: 0, breakT: 0, dodgeT: -1, dodgeX: 0, dodgeZ: 0, dodgeSide: 0, dodgeCool: 0,
		staggerT: 0, counterT: 0, take: null, takeT: null, cuffed: false, locked: false, attackT: -9, rock: 0,
		wobT: 0, wobMax: 0, wobSlow: 1, fought: new Set(), told: {},
	};
	let startT = 70 + Math.random() * 60, lineT = 0, now = 0, scanT = 0, scatterT = 120 + Math.random() * 90;
	let bound = { avatar: null, self: null }, askedForHands = false;
	const yaw = () => ctx.player?.()?.yaw ?? 0;
	const sound = createMeleeSound({ eye: ctx.eye, yaw, isPhone });
	const feel = createMeleeFeel({ camera, mount, isPhone });
	const view = createFistView({ camera, isPhone });

	// ---------- who is who ----------
	// a target's body and motion: a townsperson (people pool) or a squad member
	function bodyOf(T) {
		if (!T) return null;
		if (T.ref?.body) return { kind: 'squad', h: T.ref, P: T.ref.body.P, M: T.ref.body.M, T };
		if (T.P) { const pool = ctx.people()?.pool || []; for (let i = 0; i < pool.length; i++) if (pool[i].P === T.P) return { kind: 'person', p: pool[i], P: pool[i].P, M: pool[i].M, T }; }
		return null;
	}
	// the one in front of you within reach, inside the strike's arc; the one you struck last is
	// kept a little longer (a soft lock)
	function inFront(reach, arc = 0.55) {
		const e = ctx.eye(); camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
		const focused = ctx.focusTarget?.();
		let best = null, bs = 1e9;
		for (const T of ctx.layer.map.values()) {
			if (T.kind !== 'person' && T.kind !== 'hostile') continue;
			if (!T.P && !T.ref?.body) continue;
			const dx = T.bound.x - e.x, dz = T.bound.z - e.z, d = Math.hypot(dx, dz);
			if (d > reach + 0.45 || Math.abs(T.bound.y - (e.y - 0.7)) > 1.6) continue;
			const c = (dx * _f.x + dz * _f.z) / (d || 1);
			if (c < arc || !canMelee(T) || T.child || T.P?.ragdoll || T.ref?.dead || T.removed) continue;
			if (ctx.blocked?.(e, T.bound)) continue;
			const s = d + (1 - c) * 1.5 - (T === focused ? 3 : T === me.target ? 0.4 : 0);
			if (s < bs) { bs = s; best = T; }
		}
		return best;
	}
	// the townsfolk's own fight this body is in, if any
	function brawlOf(P) { for (let i = 0; i < brawls.length; i++) { const q = brawls[i]; if (!q.done && (q.A.b?.P === P || q.B.b?.P === P)) return q; } return null; }
	const withYou = (q) => !!q && (q.A.kind === 'player' || q.B.kind === 'player');

	// knocked down (a ragdoll, if one is free) and back up a little later, off the ground
	function knockDown(b, dir, power, down = 2200) {
		const P = b.P;
		if (!P || P.ragdoll || isMinor(P)) return;
		const q = b.M.S.pos;
		setTimeout(() => sound.fall(b.M.S.pos), 320);
		ctx.ragdolls.hit(P, { vel: new THREE.Vector3(dir.x, 0.15, dir.z).normalize().multiplyScalar(power), mass: 90, point: new THREE.Vector3(q.x, q.y + 1.25, q.z), lift: 0.02 }, (Pd) => {
			setTimeout(() => {
				if (!Pd.ragdoll || b.dead || b.h?.dead) return;
				const at = Pd.bones[Pd.map.root].getWorldPosition(_a);
				ctx.ragdolls.release(Pd);
				b.M.place(at.x, ctx.ground(at.x, at.z, at.y + 1), at.z, b.M.S.heading);
				if (!foes.has(Pd)) b.M.play('getup', 1.15, true);
			}, down);
		});
	}

	// ---------- your strikes ----------
	const free = () => ctx.active() && !ctx.armed() && !ctx.down() && !me.take && !me.cuffed && !ctx.driving?.();
	// Quick presses strike now; modified presses charge a heavy (melee-rules.js).
	const striker = createStriker({
		item: () => me.item,
		allow: () => free() && me.staggerT <= 0,
		onStart(name, m) {
			me.hitDone = false; me.counter = me.counterT > 0; me.guardT = 4; me.attackT = now; me.block = false;
			if (m.kind === 'light' && !m.item) { me.last = name; me.lastT = 0; }
			const T = inFront(m.reach + 0.9, 0.4);
			if (T) { me.target = T; const b = bodyOf(T); if (b) foes.threat(b.P, m); }
			const A = third();
			if (A) A.M.play(m.anim, moveTime(m) * 1.1, true);
		},
	});
	const St = striker.state;
	// a strike broken off (a block, a dodge, a blow taken, the hands no longer free)
	function cancelMove() { striker.cancel(); syncMove(); }
	function syncMove() { me.move = St.move; me.m = St.m; me.mt = St.t; me.charging = St.charging; me.charge = St.charge; me.press = St.press; me.queued = St.queued; }
	const startMove = (name) => { const ok = striker.start(name); syncMove(); return ok; };
	// Strike starts immediately; the separate Heavy action charges while held.
	function pressStart(heavy = false) {
		if (!free()) return;
		if (me.takeT && !me.move) { takedown(me.takeT); return; }
		if (me.held) { grapple(); return; }
		striker.press({ heavy }); syncMove();
	}
	function pressEnd() { striker.release(); syncMove(); }
	// a strike's landing moment: what it meets. Returns true when it met something
	function strike(name, m) {
		const e = ctx.eye();
		sound.swing(m.kind === 'heavy', null, m.item);
		feel.thrown(name, m, me.charge);
		const T = inFront(m.reach + 0.25, m.arc);
		if (!T) { const hitWall = wall(m, name); if (!hitWall) feel.nudge(-0.4, 0, (SIDE[name] || 0) * 0.5); return hitWall; }
		if (!canMelee(T) || T.child) { if (T.child) ctx.ward?.(T); return true; }
		const dx = T.bound.x - e.x, dz = T.bound.z - e.z, dl = Math.hypot(dx, dz) || 1;
		const dir = { x: dx / dl, y: 0, z: dz / dl };
		const b = bodyOf(T), foe = b ? foes.find(b.P) : null;
		// do they face you? (a guard only turns a blow from the front)
		const facing = b ? -(Math.sin(b.M.S.heading) * dir.x + Math.cos(b.M.S.heading) * dir.z) : 1;
		const blocked = !!b && foes.guarded(b.P, m, facing);
		const counter = me.counter;
		const amount = strikeDamage(m, { chargeLevel: me.charge, counter }) * (blocked ? 0.2 : 1);
		const head = Math.random() < (m.part === 'head' ? 0.7 : 0.2);
		const hostile = T.kind === 'hostile', theyStruck = !!foe?.struckMe;
		const moral = theyStruck ? { selfDefence: true, provoked: true, hostileTarget: true } : null;
		const r = ctx.deal(T, { amount, type: 'impact', part: head ? 'head' : 'torso', src: { x: e.x, y: e.y, z: e.z }, dir, by: ME, melee: name, moral }, true);
		if (!r || r.ignored) return true;
		// what it counts for: the first blow of a fight, or stepping into someone else's
		const q = b ? brawlOf(b.P) : null;
		const deed = fightDeed({ first: !me.fought.has(T.id), theyStruck, theirBrawl: !!q, withMe: !!foe || withYou(q), hostile });
		me.fought.add(T.id);
		if (deed === 'start-fight') ctx.deed?.('start-fight', T.name || 'someone');
		if (deed === 'break-up-fight' && !q.brokenUp) { q.brokenUp = true; q.done = true; ctx.deed?.('break-up-fight', T.name || 'someone'); }
		// the feel of it
		const result = blocked ? 'block' : 'hit', hs = hitStop(m, result) * (r.killed ? 1.3 : 1);
		feel.stop(hs);
		feel.landed(m.kind === 'heavy', SIDE[name] || 0, result);
		sound.land(result, m, T.bound, { head });
		if (!blocked) sound.grunt(T.bound, b?.P.dna?.male === false ? 1.45 : 1, 1);
		if (!isPhone || m.kind === 'heavy') ctx.fx?.dust?.({ x: T.bound.x, y: T.bound.y + (head ? 0.65 : 0.3), z: T.bound.z }, m.kind === 'heavy' ? 4 : 2, 0.6, 0.55, 0.5, 0.2, 0.2);
		if (b) {
			const H = b.h?.H || ctx.civilians?.stateOf?.(b.p)?.H;
			const R = foes.struck(b, m, dir, { hpFrac: H ? H.hp / H.max : 1, blocked, killed: !!r.killed, hold: hs });
			if (R === 'down' && !r.killed) knockDown(b, dir, m.knock * 1.2 * (counter ? 1.3 : 1));
			// they may stand and fight: a townsperson squares up (or runs)
			if (b.kind === 'person' && !foe && !r.killed && !blocked && !(deed === 'break-up-fight')) answer(b);
		}
		foes.onlookers(T.bound);
		if (m.shatters && ++me.uses >= 2) { sound.glass(T.bound); me.item = null; me.uses = 0; ctx.hint('The bottle shatters.', 1400, 1); }
		else if (m.item === 'bat' && ++me.uses >= 16) { me.item = null; me.uses = 0; ctx.hint('The bat splinters.', 1400, 1); }
		me.counter = false; me.counterT = 0;
		ctx.heard?.(T.bound);
		return true;
	}
	// a strike with nobody in reach, into a wall (structures/walls): it dents, cracks and goes
	// through the drywall between the studs; on a stud, brick, stucco or concrete it stops dead
	// and a bare fist hurts
	function wall(m, name) {
		const r = ctx.wallBlow?.(m);
		if (!r) return false;
		const heavy = m.kind === 'heavy', side = SIDE[name] || 0;
		feel.stop(hitStop(m, r.hard ? 'block' : 'hit') * (r.hard ? 1.3 : 1));
		feel.landed(heavy, side, r.hard ? 'block' : 'hit');
		if (r.hard) feel.nudge(0.35, 0, -side * 0.6);
		if (r.hard && !m.item) {
			ctx.hurtPlayer?.({ amount: heavy ? 4 : 1.5, type: 'impact', part: 'hand', src: r.at, quiet: true });
			if (!me.told.knuckles) { me.told.knuckles = true; ctx.hint(r.stud ? 'A stud behind it. That hurt.' : 'Solid. Your knuckles feel that.', 1800, 1); }
		}
		if (m.item === 'bat' && ++me.uses >= 16) { me.item = null; me.uses = 0; ctx.hint('The bat splinters.', 1400, 1); }
		if (r.broke && r.at) ctx.heard?.(r.at);
		return true;
	}
	// each frame: the strike in progress, an explicit heavy hold, the next in the string;
	// a heavy thrown leaves you wobbling a moment, more when it met nothing
	function stepMove(dt) {
		const ev = striker.tick(dt);
		syncMove();
		feel.coil(me.charging ? me.charge : 0, me.charging);
		const m = me.m;
		// the step into it: a little closer to the one you are striking at
		const P = ctx.player?.();
		if (m && P && me.target && phaseAt(m, me.mt) === 'wind' && !me.charging) {
			const e = ctx.eye(), dx = me.target.bound.x - e.x, dz = me.target.bound.z - e.z, d = Math.hypot(dx, dz);
			if (d > m.reach - 0.2 && d < m.reach + 1.0) { const s = Math.min(3.5, (d - m.reach + 0.35) / Math.max(0.08, m.wind)); P.vel.x += (dx / d * s - P.vel.x) * 0.5; P.vel.z += (dz / d * s - P.vel.z) * 0.5; }
		}
		for (let i = 0; i < ev.length; i++) {
			const E = ev[i];
			me.hitDone = true;
			const met = strike(E.name, E.m);
			if (E.m.kind === 'heavy') {
				const w = wobble(E.charge, !met);
				me.wobT = me.wobMax = w.t; me.wobSlow = w.slow;
				feel.wobble(w.t, w.roll);
			}
		}
	}
	// ---------- defence ----------
	function blockOn() { if (!free()) return; me.block = true; me.blockT = 0; me.guardT = 4; if (me.move && phaseAt(me.m, me.mt) !== 'active') cancelMove(); else if (me.charging) cancelMove(); }
	function blockOff() { me.block = false; }
	function dodge() {
		const P = ctx.player?.();
		if (!free() || me.dodgeCool > 0 || me.staggerT > 0 || !P || P.flying || P.swimming || !P.grounded) return;
		const inp = ctx.input?.() || { mx: 0, mz: 0 }, a = P.yaw;
		const fx = -Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
		let x = fx * -inp.mz + rx * inp.mx, z = fz * -inp.mz + rz * inp.mx;
		const l = Math.hypot(x, z);
		if (l < 0.2) { x = -fx; z = -fz; } else { x /= l; z /= l; }
		me.dodgeT = 0; me.dodgeX = x; me.dodgeZ = z; me.dodgeSide = Math.sign(inp.mx); me.dodgeCool = DODGE.time + DODGE.cool; me.guardT = 4;
		if ((me.move && phaseAt(me.m, me.mt) === 'wind') || me.charging) cancelMove();
		sound.dodge();
		feel.nudge(0.4, -me.dodgeSide * 0.4, me.dodgeSide * 1.6);
	}
	// a blow coming in from foe f (melee-foes.js), at its landing moment: your defence decides
	// it. Returns 'parry' | 'block' | 'break' | 'evade' | 'hit'
	function incoming(f, m) {
		const e = ctx.eye(), at = f.M.S.pos, P = ctx.player?.();
		const dx = at.x - e.x, dz = at.z - e.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
		camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
		const facing = _f.x * ux + _f.z * uz, a = yaw(), side = Math.sign(Math.cos(a) * ux - Math.sin(a) * uz) || 0;
		const out = defend({ blocking: me.block && me.breakT <= 0 && !me.move, blockT: me.blockT, dodgeT: me.dodgeT, facing, heavy: m.kind === 'heavy' });
		const amount = strikeDamage(m) * f.dmgK * (m.part === 'head' ? 1.1 : 1);
		const src = { x: at.x, y: at.y + 1.5, z: at.z }, mid = _v.set((at.x + e.x) / 2, e.y - 0.3, (at.z + e.z) / 2);
		me.guardT = 4;
		const A = third();
		switch (out.result) {
			case 'parry':
				feel.stop(hitStop(m, 'parry')); feel.took(side, 0, 'parry');
				sound.land('parry', m, mid);
				me.counterT = COUNTER_WINDOW;
				if (!me.told.parry) { me.told.parry = true; ctx.hint('Parried. Strike now: a counter hits harder.', 2200, 1); }
				break;
			case 'block':
				ctx.hurtPlayer({ amount: amount * out.k, type: 'impact', part: 'torso', src, quiet: true });
				feel.stop(hitStop(m, 'block')); feel.took(side, 1, 'block');
				sound.land('block', m, mid);
				if (P) { P.vel.x -= ux * 1.6; P.vel.z -= uz * 1.6; }
				break;
			case 'break':
				ctx.hurtPlayer({ amount: amount * out.k, type: 'impact', part: 'torso', src });
				feel.stop(hitStop(m, 'break')); feel.took(side, 1, 'break');
				sound.land('break', m, mid);
				me.staggerT = out.stagger; me.breakT = 0.7; me.rock = 1;
				if (!me.told.heavy) { me.told.heavy = true; ctx.hint('A heavy blow breaks a block. Dodge it, or parry it just as it lands.', 2600, 1); }
				break;
			case 'evade':
				sound.miss(at);
				if (me.dodgeT >= 0) me.counterT = 0.5;
				break;
			default:
				ctx.hurtPlayer({ amount, type: 'impact', part: 'torso', src });
				feel.took(side, m.kind === 'heavy' ? 1.3 : 0.7);
				sound.land('hit', m, mid, { head: m.part === 'head' });
				sound.grunt(null, 0.92, 0.8);
				me.staggerT = Math.max(me.staggerT, out.stagger); me.rock = 1;
				// a blow taken breaks off a wind-up
				if ((me.move && phaseAt(me.m, me.mt) === 'wind') || me.charging) cancelMove();
				if (A && !A.M.S.act.name) A.M.play('reel', 0.5, true);
		}
		return out.result;
	}

	// ---------- the takedown ----------
	// someone close, in front, with their back to you and no idea you are there
	function takedownTarget() {
		if (!free() || me.move || foes.list.length) return null;
		const e = ctx.eye(); camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
		let best = null, bd = 1.9;
		for (const T of ctx.layer.map.values()) {
			if (T.kind !== 'person' && T.kind !== 'hostile') continue;
			if (!canMelee(T) || T.child) continue;
			const dx = T.bound.x - e.x, dz = T.bound.z - e.z, d = Math.hypot(dx, dz);
			if (d > bd || Math.abs(T.bound.y - (e.y - 0.7)) > 1.4 || (dx * _f.x + dz * _f.z) / (d || 1) < 0.55) continue;
			const b = bodyOf(T);
			if (!b || b.P.ragdoll || isMinor(b.P)) continue;
			const aware = b.kind === 'squad' ? (b.h.alert > 0.5 || b.h.target?.id === 'me' || b.h.melee) : (!!b.p.override || !!brawlOf(b.P) || b.p.engaged);
			if (!canTakedown({ dx: -dx, dz: -dz, heading: b.M.S.heading, aware })) continue;
			bd = d; best = T;
		}
		return best;
	}
	function takedown(T) {
		const b = bodyOf(T), P = ctx.player?.();
		if (!b || !P || me.take) return;
		me.take = { b, T, t: 0, done: false, x: P.pos.x, z: P.pos.z };
		me.takeT = null; me.guardT = 4; cancelMove();
		if (b.kind === 'squad') b.h.melee = true;
		else { b.p.engaged = false; b.p.override = () => true; me.take.ov = b.p.override; }
		b.M.act('choked'); b.M.S.act.dur = 0.7;
		lock(true);
		const A = third();
		if (A) A.M.act('choke', 0);
		sound.grunt(b.M.S.pos, b.P.dna?.male === false ? 1.4 : 1, 0.9);
		feel.nudge(-0.6, 0, 0.3);
	}
	function stepTakedown(dt) {
		const k = me.take, P = ctx.player?.();
		if (!k || !P) return;
		k.t += dt;
		const b = k.b, S = b.M.S, a = P.yaw, fx = -Math.sin(a), fz = -Math.cos(a);
		P.pos.x = k.x; P.pos.z = k.z; P.vel.set(0, 0, 0);
		if (!k.done) {
			// held in front of you, back to you, struggling
			if (b.P.ragdoll || (b.h && (b.h.dead || b.h.gone))) { endTakedown(); return; }
			S.pos.x += (k.x + fx * 0.55 - S.pos.x) * Math.min(1, dt * 12); S.pos.z += (k.z + fz * 0.55 - S.pos.z) * Math.min(1, dt * 12);
			const h = Math.atan2(fx, fz);
			b.M.want.heading = h; S.yaw.v = h; b.M.want.speed = 0;
			if (b.h) b.h.pos.copy(S.pos);
			if (Math.random() < dt * 2.5) feel.nudge(0.12 * (Math.random() - 0.5), 0.15 * (Math.random() - 0.5), 0.2 * (Math.random() - 0.5));
			if (k.t > TAKEDOWN.choke) {
				k.done = true;
				const T = k.T, hostile = T.kind === 'hostile';
				ctx.deal(T, { amount: 4, type: 'impact', part: 'torso', src: { x: k.x, y: P.pos.y, z: k.z }, dir: { x: fx, y: 0, z: fz }, by: ME, melee: 'takedown', moral: hostile ? { hostileTarget: true } : null }, true);
				// out cold: limp where they stand, a long while down; a fighter is out of the fight
				if (b.h) { const h = b.h; h.surrendered = TAKEDOWN.down + 18; h.noGun = true; h.body?.hand?.hide(); h.target = null; h.role = 'yield'; h.melee = false; }
				if (k.ov && b.p.override === k.ov) b.p.override = null;
				b.M.act(null);
				knockDown(b, { x: fx * 0.3, z: fz * 0.3 }, 1.2, TAKEDOWN.down * 1000);
				feel.stop(0.06);
			}
		}
		if (k.t > TAKEDOWN.time) endTakedown();
	}
	function endTakedown() {
		const k = me.take;
		if (!k) return;
		if (!k.done) { if (k.ov && k.b.p?.override === k.ov) k.b.p.override = null; if (k.b.h) k.b.h.melee = false; if (!k.b.P.ragdoll) k.b.M.act(null); }
		me.take = null;
		lock(false);
		const A = third();
		if (A && A.M.S.act.name === 'choke') A.M.act(null);
	}
	// you, held where you are (a takedown, the cuffs): the view is ours to set while it lasts
	function lock(on) {
		const P = ctx.player?.();
		if (!P) return;
		if (on && !P.locked) { P.locked = true; me.locked = true; }
		else if (!on && me.locked) { P.locked = false; me.locked = false; }
	}

	// ---------- grabs and throws ----------
	function grapple() {
		if (me.held) {
			// thrown, the way you face
			const b = me.held; me.held = null;
			camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
			knockDown(b, _f, 5);
			ctx.deal(b.T, { amount: BLOWS.grapple.dmg * 2, type: 'impact', part: 'torso', src: ctx.eye().clone(), by: ME, melee: 'grapple' }, true);
			sound.land('hit', MOVES.heavy, b.M.S.pos);
			feel.landed(true, 1);
			return;
		}
		const T = inFront(BLOWS.grapple.reach);
		if (!T || !canMelee(T)) return;
		const b = bodyOf(T);
		if (!b || b.P.ragdoll) return;
		me.held = b; me.holdT = 3; me.guardT = 3;
		ctx.deal(T, { amount: BLOWS.grapple.dmg, type: 'impact', part: 'torso', src: ctx.eye().clone(), by: ME, melee: 'grapple' }, true);
		b.M.play('reel', 0.8);
		sound.land('block', MOVES.jab, b.M.S.pos);
		// (a brawl you grab one of out of is over)
		const q = brawlOf(b.P);
		if (q && !withYou(q) && !q.brokenUp) { q.brokenUp = true; q.done = true; ctx.deed?.('break-up-fight', T.name || 'someone'); }
	}
	function holding(dt) {
		const b = me.held;
		if (!b) return;
		me.holdT -= dt;
		if (b.P.ragdoll || me.holdT <= 0 || !ctx.active()) { me.held = null; return; }
		// held in front of you, struggling
		const e = ctx.eye(); camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
		const S = b.M.S;
		S.pos.x += (e.x + _f.x * 0.75 - S.pos.x) * Math.min(1, dt * 10); S.pos.z += (e.z + _f.z * 0.75 - S.pos.z) * Math.min(1, dt * 10);
		b.M.want.speed = 0; b.M.want.heading = Math.atan2(e.x - S.pos.x, e.z - S.pos.z);
	}

	// ---------- the townsfolk's fights ----------
	// a fighter: you, a townsperson or a squad member
	const you = () => ({ kind: 'player', id: 'me', blows: 0 });
	function fighter(b) { return { kind: b.kind, b, id: b.P.dna?.seed ?? Math.random(), hp: 100, item: null, temper: 0.25 + ((b.P.dna?.seed ?? 7) % 100) / 140, blowT: 0.6 + Math.random(), last: null, lastT: 9, blows: 0 }; }
	const posOf = (f) => (f.kind === 'player' ? ctx.eye() : f.b.M.S.pos);
	function startBrawl(A, B, stage = 'words') {
		const q = { A, B, stage, t: 0, tick: 1.5, heat: 0.4 + Math.random() * 0.3, armed: false, done: false, said: 0 };
		brawls.push(q);
		const mine = A.kind === 'player' || B.kind === 'player';
		for (const f of [A, B]) {
			if (f.kind !== 'person') continue;
			f.q = q;
			// against you: they square up and take their turns (melee-foes.js)
			if (mine) foes.add({ kind: 'person', p: f.b.p, P: f.b.P, M: f.b.M, fighter: f, item: f.item });
			else steer(f, q);
		}
		return q;
	}
	// a townsperson's steering while they fight another: toward their opponent, squaring up
	function steer(f, q) {
		const p = f.b.p;
		p.engaged = false;
		p.override = f.ov = (pp) => {
			if (q.done || f.down || pp.P.ragdoll) { if (q.done || f.down) { pp.override = null; pp.M.act(null); } return !!pp.P.ragdoll; }
			const o = q.A === f ? q.B : q.A, at = posOf(o), S = pp.M.S, dx = at.x - S.pos.x, dz = at.z - S.pos.z, d = Math.hypot(dx, dz);
			const want = q.stage === 'words' ? 1.7 : 1.05;
			pp.M.want.heading = Math.atan2(dx, dz);
			pp.M.want.speed = d > want + 0.3 ? (q.stage === 'words' ? 1.2 : 2.4) : 0;
			pp.M.want.run = d > 4 ? 1 : 0;
			if (stageIndex(q.stage) >= 3 && !pp.M.S.act.name) pp.M.act('guard', 0);
			S.look.target = null;
			return true;
		};
	}
	// someone you hit: squares up to you (the hot-tempered), or runs (the civilians module)
	function answer(b, force = false) {
		if (brawlOf(b.P)) return;
		const f = fighter(b);
		if ((!force && f.temper < 0.55) || isMinor(b.P)) return;
		const q = startBrawl(f, you(), 'fists');
		q.heat = 0.8;
		ctx.call?.(pick(LINES.fists), 'bystander');
	}
	// a blow between townsfolk fighting each other
	function land(q, from, to, kind) {
		const at = posOf(to), src = posOf(from);
		const dmg = blowDamage(kind, 100 - (from.blows || 0) * 4, Math.random() < 0.12);
		const dx = at.x - src.x, dz = at.z - src.z, dl = Math.hypot(dx, dz) || 1;
		if (to.kind === 'squad') ctx.deal(to.b.T, { amount: dmg, type: 'impact', part: 'torso', src, by: from.kind === 'squad' ? from.b.h.T : null, melee: kind }, false);
		else { to.hp -= dmg; to.b.M.jolt?.(dx / dl, dz / dl, kind === 'hook' || BLOWS[kind]?.item ? 1.1 : 0.7, kind === 'hook' ? 0.6 : 0, 0.05); }
		const m = MOVES[kind] || (kind === 'shove' ? null : MOVES.jab);
		if (m) sound.land('hit', m, at, { head: kind !== 'shove' && Math.random() < 0.6 });
		if (kind === 'bottle' && Math.random() < 0.6) { sound.glass(at); from.item = null; }
		if (to.kind !== 'player' && (to.hp <= 15 || BLOWS[kind].knock >= 3.4 && Math.random() < 0.5)) {
			knockDown(to.b, { x: dx / dl, z: dz / dl }, BLOWS[kind].knock * 1.3);
			if (to.hp <= 15) { to.down = true; q.done = true; if (to.item) drop(to.item, at); }
		}
		q.blow = dmg; q.heat = Math.min(1, q.heat + dmg / 60);
	}
	function stepBrawl(q, dt) {
		q.t += dt; q.tick -= dt;
		const A = q.A, B = q.B;
		for (let k = 0; k < 2; k++) {
			const f = k ? B : A;
			if (f.kind === 'person' && (!f.b.p.active || !f.b.P.root.visible)) q.done = true;
			if (f.kind === 'squad' && f.b.h.dead) q.done = true;
		}
		const mine = withYou(q);
		if (mine && ctx.down()) q.done = true;
		const dA = posOf(A), dB = posOf(B), d = Math.hypot(dA.x - dB.x, dA.z - dB.z);
		if (d > 25) q.done = true;
		// against you, the fight is the foes' to run (melee-foes.js): it ends when they leave it
		if (mine) { for (let k = 0; k < 2; k++) { const f = k ? B : A; if (f.kind === 'person' && !foes.has(f.b.P) && !f.b.P.ragdoll && q.t > 1) q.done = true; } }
		if (q.done) return;
		// up the ladder, or down it
		if (q.tick <= 0) {
			q.tick = 1.6 + Math.random();
			const was = q.stage;
			q.stage = escalate({ stage: q.stage, heat: q.heat, temper: Math.max(A.temper ?? 0.6, B.temper ?? 0.6), armed: q.armed, friends: 0, blow: q.blow || 0, t: q.t }, Math.random);
			q.blow = 0;
			if (q.stage !== was) {
				q.t = 0;
				const mx = (dA.x + dB.x) / 2, mz = (dA.z + dB.z) / 2;
				if (q.stage === 'calm' && !mine) { q.done = true; return; }
				if (q.stage === 'calm') q.stage = 'fists';
				if (q.stage === 'guns' && !q.armed) q.stage = 'weapon';
				if (q.stage === 'weapon') for (let k = 0; k < 2; k++) { const f = k ? B : A; if (f.kind !== 'player' && !f.item) { f.item = improvised(null); if (f.item) { ctx.call?.(pick(LINES.weapon), 'bystander'); const F = foes.find(f.b.P); if (F) F.item = f.item; } } }
				const R = brawlResponse(q.stage);
				if (R.police) { ctx.civilians?.alarm(mx, mz, 12); ctx.event?.({ kind: 'brawl', x: mx, z: mz, stage: q.stage, severity: R.severity }); }
				if (stageIndex(q.stage) >= 3 && lineT <= 0) { lineT = 6; ctx.call?.(pick(LINES.fists), 'bystander'); }
			}
		}
		// each townsperson fighting another acts (those fighting you are the foes')
		if (!mine) for (let k = 0; k < 2; k++) {
			const f = k ? B : A;
			if (f.kind === 'player' || f.down) continue;
			const o = f === A ? B : A, M = f.b.M;
			f.blowT -= dt; f.lastT += dt;
			if (q.stage === 'words') {
				if (f.blowT <= 0) { f.blowT = 1.2 + Math.random() * 1.6; M.gesture(Math.random() < 0.5 ? 'emphatic' : 'point'); M.feel?.('anger', 0.8); if (q.said++ < 3 && lineT <= 0 && d < 40) { lineT = 3; ctx.call?.(pick(LINES.words), 'bystander'); } }
				continue;
			}
			if (d > 1.5 || f.blowT > 0) continue;
			let kind = q.stage === 'shove' ? 'shove' : f.item || nextBlow(f.last, f.lastT);
			if (q.stage === 'fists' && Math.random() < 0.15) kind = 'shove';
			const Bw = BLOWS[kind];
			f.blowT = Bw.time + 0.35 + Math.random() * 0.7; f.last = kind; f.lastT = 0; f.blows++;
			M.play(Bw.item ? 'swing' : kind, Bw.time);
			const hit = Math.random() < 0.68;
			setTimeout(() => { if (!q.done && hit && Math.hypot(posOf(f).x - posOf(o).x, posOf(f).z - posOf(o).z) < Bw.reach + 0.4) land(q, f, o, kind); }, Bw.time * 450);
			if (Math.random() < 0.5) setTimeout(() => sound.swing(false, posOf(f)), Bw.time * 300);
		}
		// held items in their hands
		for (let k = 0; k < 2; k++) { const f = k ? B : A; if (f.kind !== 'player') handItem(f); }
	}
	// a bat, a pipe or a bottle in a brawler's right hand
	const handMeshes = new Map();
	const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.55 }), glass = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 });
	const steel = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.4, metalness: 0.35 });
	const batGeo = new THREE.CylinderGeometry(0.03, 0.016, 0.84, 10).translate(0, 0.42, 0), bottleGeo = new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.036, 0.16], [0.016, 0.22], [0.012, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
	const pipeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8).translate(0, 0.39, 0);
	const bladeMats = meleeMaterials();
	const itemMesh = (kind) => kind === 'knife' || kind === 'machete' ? meleeItem(kind, bladeMats) : new THREE.Mesh(kind === 'bat' ? batGeo : kind === 'pipe' ? pipeGeo : bottleGeo, kind === 'bat' ? wood : kind === 'pipe' ? steel : glass);
	function handItem(f) {
		let m = handMeshes.get(f);
		if (!f.item) { if (m) { m.removeFromParent(); handMeshes.delete(f); } return; }
		if (m && m.userData.kind === f.item) return;
		if (m) m.removeFromParent();
		const bone = f.b.P.bones[f.b.P.map['wrist.R']];
		if (!bone) return;
		m = itemMesh(f.item);
		m.userData.kind = f.item;
		bone.getWorldScale(_a);
		m.scale.set(1 / _a.x, 1 / _a.y, 1 / _a.z); m.position.set(0, 0.08 / _a.y, 0);
		bone.add(m); handMeshes.set(f, m);
	}
	// a dropped bat, pipe or bottle, lying where it fell, to be picked up
	function drop(kind, at) {
		const m = itemMesh(kind);
		m.position.set(at.x + 0.4, ctx.ground(at.x, at.z, at.y + 1) + 0.04, at.z); m.rotation.set(Math.PI / 2, 0, Math.random() * 6.28);
		ctx.group.add(m); drops.push({ kind, m, t: 0 });
	}
	function pickups(dt) {
		const e = ctx.eye();
		for (let i = drops.length - 1; i >= 0; i--) {
			const D = drops[i]; D.t += dt;
			if (D.t > 240) { D.m.removeFromParent(); drops.splice(i, 1); continue; }
			if (!me.item && !ctx.armed() && Math.hypot(D.m.position.x - e.x, D.m.position.z - e.z) < 1.3 && Math.abs(D.m.position.y - (e.y - 1.6)) < 1.2) {
				me.item = D.kind; me.uses = 0; D.m.removeFromParent(); drops.splice(i, 1);
				ctx.hint(`You pick up the ${D.kind}. Strike swings it; Shift + strike (Heavy on touch) charges a heavy blow.`, 2600, 1);
			}
		}
	}
	// now and then in town, something to hand lying about: a length of pipe, a bat, a bottle, and
	// more rarely a hunting knife or a machete
	function scatter(dt) {
		scatterT -= dt;
		if (scatterT > 0) return;
		scatterT = 150 + Math.random() * 120;
		if (drops.length >= 3 || !ctx.isEarth() || ctx.zone() !== 'earth-urban') return;
		const e = ctx.eye(), a = Math.random() * 6.283, r = 7 + Math.random() * 8;
		const r2 = Math.random();
		drop(r2 < 0.34 ? 'pipe' : r2 < 0.64 ? 'bat' : r2 < 0.86 ? 'bottle' : r2 < 0.94 ? 'knife' : 'machete', { x: e.x + Math.cos(a) * r, y: e.y, z: e.z + Math.sin(a) * r });
	}
	// a quarrel starting in the street: two grown-ups near each other, near you
	function ambient(dt) {
		startT -= dt;
		if (startT > 0 || brawls.some((q) => !q.done) || !ctx.isEarth() || ctx.zone() !== 'earth-urban') return;
		startT = 90 + Math.random() * 120;
		const e = ctx.eye(), pool = (ctx.people()?.pool || []).filter((p) => p.active && p.P.root.visible && !p.P.ragdoll && !p.override && canBrawl(p) && !isMinor(p.P) && Math.hypot(p.M.S.pos.x - e.x, p.M.S.pos.z - e.z) < 45);
		for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
			const a = pool[i], b = pool[j];
			if (Math.hypot(a.M.S.pos.x - b.M.S.pos.x, a.M.S.pos.z - b.M.S.pos.z) > 7) continue;
			startBrawl(fighter({ kind: 'person', p: a, P: a.P, M: a.M }), fighter({ kind: 'person', p: b, P: b.P, M: b.M }));
			return;
		}
	}

	// ---------- the foes ----------
	const foes = createFoes({ ...ctx, isPhone, sound, ME }, {
		incoming, taking: () => !!me.take, attacking: () => now - me.attackT < 1.0,
	});

	// ---------- input ----------
	const canvas = mount.querySelector('canvas');
	const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || window._KEYS_PLAY_ON;
	const mouseOk = (e) => e.pointerType === 'mouse' && (!canvas || e.target === canvas) && (!canvas?.requestPointerLock || document.pointerLockElement === canvas);
	addEventListener('pointerdown', (e) => {
		if (e.defaultPrevented || !mouseOk(e) || !ctx.active() || ctx.armed() || ctx.realmArmed?.()) return;
		if (e.button === 0) pressStart(e.shiftKey);
		else if (e.button === 2) blockOn();
	});
	addEventListener('pointerup', (e) => {
		if (e.pointerType !== 'mouse') return;
		if (e.button === 0) pressEnd();
		else if (e.button === 2) blockOff();
	});
	addEventListener('contextmenu', (e) => { if (canvas && e.target === canvas && ctx.active() && !ctx.armed()) e.preventDefault(); });
	addEventListener('blur', () => { if (me.press || me.charging) cancelMove(); me.block = false; });
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || typing() || !ctx.active() || ctx.armed()) return;
		if (ctx.realmArmed?.()) return;
		const k = e.key.toLowerCase();
		if (k === 'q') { pressStart(e.shiftKey); e.preventDefault(); }
		else if (k === 'j') { grapple(); e.preventDefault(); }
		else if (k === 'c' && !ctx.player?.()?.flying && (me.guardT > 0 || foes.list.length)) { dodge(); }
	});
	addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'q') pressEnd(); });
	const cancelHeldInput = () => { if (me.press || me.charging) cancelMove(); me.block = false; };
	addEventListener('pointercancel', cancelHeldInput);
	document.addEventListener('visibilitychange', () => { if (document.hidden) cancelHeldInput(); });
	document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) cancelHeldInput(); });

	const pad = touch ? createMeleeTouch({ mount, on: {
		strike: (d) => (d ? pressStart() : pressEnd()),
		heavy: (d) => (d ? pressStart(true) : pressEnd()),
		cancel: cancelHeldInput,
		block: (d) => (d ? blockOn() : blockOff()),
		dodge,
		grab: () => { if (me.takeT && !me.move) takedown(me.takeT); else grapple(); },
	} }) : null;
	// the takedown's prompt with a keyboard
	const prompt = touch ? null : document.createElement('div');
	if (prompt) {
		prompt.dataset.hud = 'prompt 26';
		prompt.style.cssText = 'display:none;padding:7px 12px;border-radius:12px;background:rgba(8,20,26,.6);border:1px solid rgba(190,255,230,.55);color:#eafaf6;font:600 13px system-ui;pointer-events:none;';
		prompt.innerHTML = '<b style="display:inline-block;min-width:18px;padding:1px 5px;margin-right:6px;border-radius:5px;background:rgba(255,255,255,.18);text-align:center">Q</b>Takedown';
		mount.appendChild(prompt);
	}

	// ---------- you, in third person ----------
	function third() { const s = bound.self, A = bound.avatar?.me; return s?.state?.third && A?.P.root.visible ? A : null; }

	// ---------- each frame ----------
	const vs = { on: false, item: null, move: null, anim: null, m: null, mt: 0, charging: false, charge: 0, block: false, take: false, cuffed: false, dodge: 0, dodgeSide: 0, rock: 0, step: 0, pace: 0 };
	function update(dt) {
		now += dt;
		const P = ctx.player?.();
		feel.update(dt, !!P && !P.locked);
		me.lastT += dt; me.guardT = Math.max(0, me.guardT - dt); lineT -= dt;
		me.dodgeCool = Math.max(0, me.dodgeCool - dt); me.staggerT = Math.max(0, me.staggerT - dt); me.counterT = Math.max(0, me.counterT - dt);
		me.breakT = Math.max(0, me.breakT - dt); me.rock = Math.max(0, me.rock - dt * 4);
		if (me.block) me.blockT += dt;
		if (!free() && !me.take && !me.cuffed) { if (me.press || me.charging || (me.move && ctx.armed())) cancelMove(); me.block = false; }
		// (a weapon drawn: whatever you were swinging is let fall)
		if (me.item && ctx.armed()) { drop(me.item, ctx.eye()); me.item = null; }
		// the dodge carries you
		if (me.dodgeT >= 0 && P) {
			me.dodgeT += dt;
			const u = me.dodgeT / DODGE.time, s = DODGE.speed * Math.max(0, 1 - u * u);
			P.vel.x = me.dodgeX * s; P.vel.z = me.dodgeZ * s;
			if (me.dodgeT >= DODGE.time) me.dodgeT = -1;
		}
		// blocking: slower on your feet
		if (me.block && P) { P.vel.x *= 1 - Math.min(1, dt * 6) * 0.5; P.vel.z *= 1 - Math.min(1, dt * 6) * 0.5; }
		// off balance after a heavy: your feet slow, coming back as it passes
		if (me.wobT > 0) {
			me.wobT = Math.max(0, me.wobT - dt);
			if (P) { const cap = 5.2 * (me.wobSlow + (1 - me.wobSlow) * (1 - me.wobT / me.wobMax)), v = Math.hypot(P.vel.x, P.vel.z); if (v > cap) { P.vel.x *= cap / v; P.vel.z *= cap / v; } }
		}
		stepMove(dt);
		stepTakedown(dt);
		holding(dt);
		pickups(dt);
		ambient(dt);
		scatter(dt);
		foes.update(dt);
		if (foes.list.length) me.guardT = Math.max(me.guardT, 2);
		for (let i = brawls.length - 1; i >= 0; i--) {
			const q = brawls[i];
			stepBrawl(q, dt);
			if (q.done) {
				for (let j = 0; j < 2; j++) { const f = j ? q.B : q.A; if (f.kind === 'person') { const F = foes.find(f.b.P); if (F) foes.remove(F); else if (!f.down && f.ov && f.b.p.override === f.ov) { f.b.p.override = null; f.b.M.act(null); } } f.item = null; handItem(f); }
				brawls.splice(i, 1);
			}
		}
		// the takedown on offer, a few times a second
		scanT -= dt;
		if (scanT <= 0) { scanT = 0.15; me.takeT = takedownTarget(); }
		if (prompt) { const d = me.takeT && !me.take ? 'block' : 'none'; if (prompt.style.display !== d) prompt.style.display = d; }
		// you held still (a takedown, cuffs): the view follows where you look
		if (me.locked && P) { camera.position.copy(P.pos); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); feel.update(0, true); }
		// your fists, or your body in third person
		const A = third();
		if (A) {
			const name = A.M.S.act.name;
			if (me.block && name !== 'block') A.M.act('block', 0);
			else if (!me.block && name === 'block') A.M.act(null);
		}
		const on = !A && ctx.active() && !ctx.armed() && !ctx.driving?.() && !P?.flying && !P?.swimming && (me.guardT > 0 || !!me.item || me.block || !!me.move || !!me.take || me.cuffed);
		if (on && !camera.parent) ctx.scene?.add(camera);
		if (on && !bound.avatar?.me && !askedForHands && bound.avatar?.ready) {
			askedForHands = true; bound.avatar.ready().catch(() => {});
		}
		vs.on = on; vs.item = me.item; vs.move = me.move; vs.anim = me.m?.anim === 'haymaker' ? 'heavy' : me.m?.anim; vs.m = me.m; vs.mt = me.mt;
		vs.charging = me.charging; vs.charge = me.charge; vs.block = me.block && me.breakT <= 0; vs.take = !!me.take; vs.cuffed = me.cuffed;
		vs.dodge = me.dodgeT >= 0 ? Math.sin(Math.PI * Math.min(1, me.dodgeT / DODGE.time)) : 0; vs.dodgeSide = me.dodgeSide; vs.rock = me.rock;
		vs.step = P?.gait?.phase || 0; vs.pace = Math.min(1, (P?.gait?.speed || 0) / 5);
		if (!vs.move) vs.anim = null;
		view.update(dt, now, vs, bound.avatar?.me);
		if (pad) pad.update(ctx.active() && !ctx.armed() && !ctx.driving?.() && !P?.flying && !P?.swimming && !ctx.realmArmed?.(), me.guardT > 0 || foes.list.length > 0, !!me.takeT && !me.take, !!me.held, me.item);
	}
	function clear() {
		for (const q of brawls) { q.done = true; for (const f of [q.A, q.B]) { if (f.kind === 'person') { f.b.p.override = null; f.b.M.act(null); } f.item = null; handItem(f); } }
		brawls.length = 0;
		for (const D of drops) D.m.removeFromParent();
		drops.length = 0; me.held = null; me.item = null;
		foes.clear();
		endTakedown();
		cancelMove(); me.block = false; me.dodgeT = -1; me.wobT = 0; me.cuffed = false; me.fought.clear();
		lock(false);
		feel.clear();
	}
	const info = () => ({
		item: me.item, holding: !!me.held, last: me.last, move: me.move, phase: me.move ? phaseAt(me.m, me.mt) : null, block: me.block, dodging: me.dodgeT >= 0, counter: +me.counterT.toFixed(2), takedown: me.take ? +me.take.t.toFixed(1) : !!me.takeT,
		active: ctx.active(), fists: view.root.visible, guardT: +me.guardT.toFixed(1),
		brawls: brawls.map((q) => ({ stage: q.stage, a: q.A.kind, b: q.B.kind, hp: [Math.round(q.A.hp ?? 100), Math.round(q.B.hp ?? 100)] })), drops: drops.length, nextIn: Math.round(startT), ...foes.info(), sound: sound.info(),
	});
	// for the console and tests: a quarrel now between the two nearest grown-ups
	function quarrel() { startT = 0; ambient(0.01); return info(); }
	// a strike by name (the tests, and the old names: jab, cross, hook, bat, bottle, shove, grapple)
	function swing(kind = 'jab') {
		if (kind === 'shove' || kind === 'grapple') { grapple(); return true; }
		return startMove(MOVES[kind] ? kind : 'jab');
	}
	// for the tests: the nearest grown-up squares up to you now
	function spar(n = 1) {
		const e = ctx.eye(), pool = (ctx.people()?.pool || []).filter((p) => p.active && p.P.root.visible && !p.P.ragdoll && !isMinor(p.P) && !foes.has(p.P)).sort((a, b) => Math.hypot(a.M.S.pos.x - e.x, a.M.S.pos.z - e.z) - Math.hypot(b.M.S.pos.x - e.x, b.M.S.pos.z - e.z));
		for (const p of pool.slice(0, n)) answer({ kind: 'person', p, P: p.P, M: p.M }, true);
		me.guardT = 4;
		return info();
	}
	// the police arrive: the fights near them end
	function calm(x, z, r = 30) { for (const q of brawls) { if (withYou(q)) continue; const a = posOf(q.A); if (Math.hypot(a.x - x, a.z - z) < r) q.done = true; } }
	// you, seen in third person (people/avatar.js, people/self.js): main.js hands these over
	function bind(o = {}) { bound = { avatar: o.avatar || bound.avatar, self: o.self || bound.self }; return true; }
	return { update, clear, info, swing, grapple, quarrel, spar, startBrawl, fighter, drop, calm, bind, foes, block: (on) => (on ? blockOn() : blockOff()), dodge, takedown: () => { const T = me.takeT || takedownTarget(); if (T) takedown(T); return !!T; }, press: pressStart, release: pressEnd, state: me, sound, feel };
}
