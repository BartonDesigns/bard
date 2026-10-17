// The spells at work (their numbers: magic/spells.js). A spell is cast along your aim: the view's
// centre while you aim, or the cursor while you look about with the camera (player.js). What it
// does is one of a few kinds, each worked out here every frame from fixed lists:
//
//   bolt     a glowing bolt flies along the aim (pierce: on through the first it strikes; splash:
//            a burst where it lands; ignite: sets alight what will burn)
//   beam     held: a lance from the hand along the aim, burning (drain: healing you) while held
//   burst    light or dark bursting where you aim (after a delay, if it has one)
//   strike   a pillar from the sky onto where you aim, a breath later
//   nova     out from you; cone: before you
//   chain    lightning leaping from the first struck to the next
//   orb      a slow ball rolling along the aim, striking all near its path
//   well     a knot of void at the aim drawing all near in, then collapsing
//   cloud    a lingering cloud at the aim; zone: hallowed ground at your feet; storm: lightning
//            falling again and again
//   heal, hot, shield, deathward, aura, buff, cloak, light, sight, pact, summon
//   blink, recall, gate, rewind, stasis, douse, daybreak
//
// Harm goes through the fight's own door (combat.deal), so the wards on children, surrender and
// the morality of it all hold for spells as for shots. Spells that spread over an area (novas,
// clouds, auras, wells, storms) strike only the hostile (fighters and bosses); a bolt or a beam
// strikes what it meets. A status (held, slowed, afraid, rotting) is laid on a fighter's hex,
// which the fighters read (combat/ai-squads.js) and this wears off. Bosses take the harm and
// shrug off the rest.
//
// What you wear and hold changes some of this (gameplay/gear-magic.js, through state.mods):
// a spell can be altered (three sparks, a bolt that passes through everyone, a step that
// leaves you cloaked, burning ground, a heal that lingers, a ward with an aura, a recall that
// mends), a school's every few spells can cost nothing (mods.free), and the weapon in hand's
// hits reach in here (hexOn, arc, ward, fleet, strike) and loose spells of their own (a free cast).

import * as THREE from 'three';
import { SPELL, SCHOOLS, castBlock, spend, spellPower, manaMax, manaRegen, manaCost, shaped, strandOf } from './spells.js';
import { GLOW, magicSound } from './fx.js';

const EYE = 1.68;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const typeOf = (t) => (t === 'fire' ? 'fire' : 'energy');
const hostile = (T) => !!T && !T.removed && (T.kind === 'hostile' || T.kind === 'boss') && !T.surrendered;

// track(kind, ...): what you do, for your skills (magic/skills.js): ('cast', spell, mana paid),
// ('hurt', harm taken)
export function createCaster({ camera, combat, player, state, fx, light, hint, sky, worldKey, seed, isPhone = false, track = () => {} }) {
	const P = () => player()?.state;
	const now = () => performance.now() / 1000;
	const bolts = [], effects = [], shades = [], knocks = [], hexed = new Map(), held = new Map();
	const buff = { shield: 0, shieldUntil: 0, cloakUntil: 0, deathUntil: 0, pactUntil: 0, quickUntil: 0, lightUntil: 0, sightUntil: 0, sightWhat: null, nightUntil: 0, hots: [], moves: [] };
	const history = [];
	// (casts of each school since its last free one: a garment's mastery, mods.free)
	const freeCount = {};
	let histT = 0, regenT = 0, fighting = false, gateI = 0, cursor = null, dayTween = null;

	// ---------- aim ----------
	// where a cast comes from (the hand, a little right of and below the eye) and where it goes
	function aim(o, d) {
		camera.getWorldDirection(d);
		if (P()?.lookMode === 'camera' && cursor) { _u.set(cursor.x, cursor.y, 0.5).unproject(camera); d.copy(_u).sub(camera.position).normalize(); }
		o.copy(camera.position);
	}
	function hand(out) {
		aim(_o, _d);
		_r.set(-_d.z, 0, _d.x).normalize();
		return out.copy(_o).addScaledVector(_d, 0.7).addScaledVector(_r, 0.28).add(_u.set(0, -0.22, 0));
	}
	// the point you aim at, up to range: the first thing the aim meets, else the ground below the
	// end of it. returns { at, T } (T: a target struck by the aim, if any)
	function aimPoint(range) {
		aim(_o, _d);
		const h = combat.firstHit(_o, _d, range, combat.me);
		const at = _o.clone().addScaledVector(_d, h ? h.t : range);
		if (!h) at.y = combat.ground(at.x, at.z, at.y + 50);
		return { at, T: h?.T || null, n: h?.n || null };
	}

	// ---------- harm and hexes ----------
	function harm(T, amount, spell, at, dir = null) {
		if (!T || amount <= 0) return null;
		const blow = { amount, type: typeOf(spell.type), part: 'body', src: at, dir: dir || { x: T.bound.x - at.x, y: 0.3, z: T.bound.z - at.z }, by: combat.me, spell: spell.type };
		const r = combat.deal(T, blow, true);
		const c = GLOW[spell.type === 'frost' ? 'frost' : spell.school];
		if (r?.dealt) fx.burst({ x: T.bound.x, y: T.bound.y + 0.2, z: T.bound.z }, c, 8, 3, 0.4, 0.2);
		return r;
	}
	// a status on a fighter (not a boss): hold, slow (for t), fear, dot (for t)
	function hex(T, st, k = 1) {
		if (!st || !T || T.kind !== 'hostile' || T.removed) return;
		const H = T.hex || (T.hex = { hold: 0, fear: 0, slowK: 1, slowT: 0, dot: 0, dotT: 0, dotAcc: 0, spread: 0 });
		if (st.hold) H.hold = Math.max(H.hold, st.hold);
		if (st.fear) H.fear = Math.max(H.fear, st.fear);
		if (st.slow) { H.slowK = Math.min(H.slowK, st.slow); H.slowT = Math.max(H.slowT, st.t || 3); }
		if (st.dot) { H.dot = Math.max(H.dot, st.dot * k); H.dotT = Math.max(H.dotT, st.t || 6); H.spread = st.spread || H.spread; }
		hexed.set(T, H);
	}
	function stepHexes(dt) {
		for (const [T, H] of hexed) {
			H.hold = Math.max(0, H.hold - dt); H.fear = Math.max(0, H.fear - dt);
			if (H.slowT > 0) { H.slowT -= dt; if (H.slowT <= 0) H.slowK = 1; }
			if (H.dotT > 0) {
				H.dotT -= dt; H.dotAcc += dt;
				if (H.dotAcc >= 0.5) {
					const amt = H.dot * H.dotAcc; H.dotAcc = 0;
					const r = combat.deal(T, { amount: amt, type: 'energy', part: 'body', src: { x: T.bound.x, y: T.bound.y, z: T.bound.z }, by: combat.me, spell: 'blight', quiet: true }, true);
					fx.burst({ x: T.bound.x, y: T.bound.y + 0.4, z: T.bound.z }, GLOW.blight, 4, 1.2, 0.6, 0.18, 0.8);
					// (a contagion passes to the nearest of their kind when they fall)
					if ((r?.killed || T.ref?.dead) && H.spread) {
						const next = nearestHostile(T.bound, H.spread, (q) => q !== T && !q.hex?.dotT);
						if (next) { hex(next, { dot: H.dot, t: 10, spread: H.spread }); fx.line(T.bound, next.bound, GLOW.blight, 0.5, 0.5, 0.2, 0.6); }
						H.dotT = 0;
					}
				}
			}
			if (T.removed || T.ref?.dead || (!H.hold && !H.fear && H.slowK >= 1 && H.dotT <= 0)) { hexed.delete(T); if (!T.removed) T.hex = null; }
		}
	}
	function hostilesNear(c, r, out = []) {
		out.length = 0;
		for (const x of combat.layer.within(c, r, combat.me)) if (hostile(x.T)) out.push(x);
		return out;
	}
	function nearestHostile(c, r, ok = () => true) {
		let best = null, bd = r;
		for (const x of combat.layer.within(c, r, combat.me)) if (hostile(x.T) && ok(x.T) && x.d < bd) { bd = x.d; best = x.T; }
		return best;
	}
	// a shove: a fighter carried away from (or toward) a point over a moment
	function shove(T, from, dist) {
		const h = T.ref;
		if (!h || T.kind !== 'hostile') return;
		const dx = T.bound.x - from.x, dz = T.bound.z - from.z, l = Math.hypot(dx, dz) || 1;
		knocks.push({ h, vx: dx / l * dist / 0.35, vz: dz / l * dist / 0.35, t: 0.35 });
	}
	function stepKnocks(dt) {
		for (let i = knocks.length - 1; i >= 0; i--) {
			const K = knocks[i], h = K.h, S = h.body?.M?.S, pos = S ? S.pos : h.pos;
			K.t -= dt;
			if (K.t <= 0 || h.dead) { knocks.splice(i, 1); continue; }
			pos.x += K.vx * dt; pos.z += K.vz * dt;
			if (!S) pos.y = combat.ground(pos.x, pos.z, pos.y + 1);
		}
	}
	const struck = [];
	function areaHarm(c, r, spell, k, dmg, status, push = 0) {
		for (const x of hostilesNear(c, r, struck)) {
			const f = 1 - 0.5 * (x.d / r);
			harm(x.T, dmg * k * f, spell, c);
			hex(x.T, status, k);
			if (push) shove(x.T, c, push * f);
		}
	}

	// ---------- the kinds ----------
	const DO = {
		bolt(spell, k) {
			const from = hand(new THREE.Vector3());
			aim(_o, _d);
			// (aim the bolt from the hand at where the view's ray lands, so it meets the crosshair)
			const tgt = combat.firstHit(_o, _d, 300, combat.me), end = _o.clone().addScaledVector(_d, tgt ? tgt.t : 300);
			const dir = end.sub(from).normalize();
			// (split: several in a fan about the aim, each the weaker for it)
			const n = Math.max(1, spell.split | 0), dmg = spell.dmg * (spell.dmgK || 1);
			for (let j = 0; j < n; j++) {
				const v = n > 1 ? dir.clone().applyAxisAngle(_u.set(0, 1, 0), (j / (n - 1) - 0.5) * 0.16) : dir;
				bolts.push({ spell, k, pos: j === n - 1 ? from : from.clone(), vel: v.multiplyScalar(spell.speed), life: 4, pierced: false, owner: 'me', dmg: n > 1 ? dmg : undefined });
			}
		},
		beam(spell, k) { held.set(spell.id, { spell, k, t: spell.t, acc: new Map() }); },
		burst(spell, k) {
			const { at } = aimPoint(spell.range);
			const c = GLOW[spell.school];
			fx.ring(at, spell.r, c, 30, spell.delay || 0.5, 0.25);
			effects.push({ t: spell.delay || 0, run: () => { fx.burst(at, c, 60, spell.r * 1.6, 0.8, 0.45, 1); fx.ring(at, spell.r, c, 50, 0.5, 0.4); areaHarm(at, spell.r, spell, k, spell.dmg, spell.status); magicSound(spell.school, 0.16); } });
		},
		strike(spell, k) {
			const { at } = aimPoint(spell.range);
			const c = GLOW[spell.school];
			effects.push({ t: 0, every: 0.08, life: spell.delay, step: () => fx.ring(at, spell.r, c, 18, 0.3, 0.2) });
			effects.push({ t: spell.delay, run: () => { fx.pillar(at, 40, c, isPhone ? 60 : 140, 0.5, 0.9, false); fx.burst(at, c, 80, 9, 1, 0.5, 2); areaHarm(at, spell.r, spell, k, spell.dmg, null); combat.shake?.(0.25); magicSound('storm', 0.2); } });
		},
		nova(spell, k) {
			const c = { x: camera.position.x, y: camera.position.y - EYE + 0.4, z: camera.position.z };
			fx.ring(c, spell.r, GLOW[spell.type === 'frost' ? 'frost' : spell.school], 60, 0.45, 0.4);
			fx.burst(c, GLOW[spell.type === 'frost' ? 'frost' : spell.school], 40, spell.r * 1.2, 0.6, 0.3, 0.5);
			areaHarm(c, spell.r, spell, k, spell.dmg, spell.status, spell.push || 0);
		},
		cone(spell, k) {
			aim(_o, _d);
			const c = GLOW[spell.school], cos = Math.cos(spell.angle);
			for (let n = 0; n < 50; n++) {
				_q.set(_d.x + (Math.random() - 0.5) * spell.angle * 1.6, _d.y + (Math.random() - 0.5) * 0.4, _d.z + (Math.random() - 0.5) * spell.angle * 1.6).normalize().multiplyScalar(spell.range / 0.5);
				fx.emit(_o.x, _o.y - 0.3, _o.z, _q.x, _q.y, _q.z, 0.5, 0.3, 0.9, c, 0.8, 0, 0.5);
			}
			for (const x of hostilesNear(_o, spell.range, struck)) {
				_p.set(x.T.bound.x - _o.x, 0, x.T.bound.z - _o.z).normalize();
				if (_p.dot(_q.set(_d.x, 0, _d.z).normalize()) < cos) continue;
				harm(x.T, spell.dmg * k, spell, _o);
				hex(x.T, spell.status, k);
				if (spell.push) shove(x.T, _o, spell.push);
			}
		},
		chain(spell, k) {
			const { at, T } = aimPoint(spell.range);
			const from = hand(new THREE.Vector3()), c = GLOW.storm;
			let cur = T && hostile(T) ? T : nearestHostile(at, 6);
			if (!cur) { fx.line(from, at, c, 0.5, 0.2, 0.18, 1.2); return; }
			const done = new Set();
			let a = from, dmg = spell.dmg * k;
			for (let j = 0; j <= spell.jumps && cur; j++) {
				done.add(cur);
				const b = { x: cur.bound.x, y: cur.bound.y + 0.2, z: cur.bound.z };
				fx.line(a, b, c, 0.45, 0.25, 0.2, 1.4);
				harm(cur, dmg, spell, a);
				hex(cur, { hold: 0.3 });
				a = b; dmg *= 0.8;
				cur = nearestHostile(b, spell.hop, (q) => !done.has(q));
			}
		},
		orb(spell, k) {
			const pos = hand(new THREE.Vector3());
			aim(_o, _d);
			effects.push({ t: 0, life: spell.t, every: spell.rate, pos, vel: _d.clone().setY(0).normalize().multiplyScalar(spell.speed), trail: 0,
				move(dt) { this.pos.addScaledVector(this.vel, dt); const gy = combat.ground(this.pos.x, this.pos.z, this.pos.y + 2); this.pos.y += (gy + 1.2 - this.pos.y) * Math.min(1, dt * 3); fx.burst(this.pos, GLOW.storm, 3, 1.5, 0.25, 0.35, 0); },
				step() { for (const x of hostilesNear(this.pos, spell.r, struck)) { fx.line(this.pos, x.T.bound, GLOW.storm, 0.4, 0.15, 0.15, 0.8); harm(x.T, spell.dmg * k, spell, this.pos); } } });
		},
		well(spell, k) {
			const { at } = aimPoint(spell.range);
			at.y += 1;
			effects.push({ t: 0, life: spell.t, every: 0.1,
				step() {
					fx.burst(at, GLOW.void, 6, -2, 0.5, 0.35, 0);
					for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, r = spell.r * Math.random(); fx.emit(at.x + Math.cos(a) * r, at.y + (Math.random() - 0.5) * 2, at.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0, -Math.sin(a) * r * 2, 0.5, 0.25, 0.05, GLOW.void, 0.9, 0, 0); }
					for (const x of hostilesNear(at, spell.r, struck)) {
						const h = x.T.ref, S = h?.body?.M?.S, pos = S ? S.pos : h?.pos;
						if (pos && x.d > 0.8) { const dx = at.x - pos.x, dz = at.z - pos.z, l = Math.hypot(dx, dz) || 1; pos.x += dx / l * spell.pull * 0.1; pos.z += dz / l * spell.pull * 0.1; }
						if (spell.dps) harm(x.T, spell.dps * 0.1 * k, spell, at);
						hex(x.T, spell.status ? { hold: 0.3 } : { slow: 0.3, t: 0.3 }, k);
					}
				},
				end() { fx.burst(at, GLOW.void, 90, spell.r * 1.5, 0.7, 0.5, 0); fx.ring(at, spell.r, GLOW.void, 50, 0.4, 0.4); areaHarm(at, spell.r, spell, k, spell.dmg, null); magicSound('void', 0.2); } });
		},
		cloud(spell, k) {
			const { at } = aimPoint(spell.range);
			effects.push({ t: 0, life: spell.t, every: 0.5,
				step() {
					for (let n = 0; n < (isPhone ? 6 : 14); n++) { const a = Math.random() * 6.283, r = spell.r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * r, at.y + 0.3 + Math.random() * 1.5, at.z + Math.sin(a) * r, 0, 0.2, 0, 1.6, 0.9, 1.6, GLOW.blight, 0.35, 0, 0.5); }
					for (const x of hostilesNear(at, spell.r, struck)) { harm(x.T, spell.dps * 0.5 * k, spell, at); hex(x.T, spell.status, k); }
				} });
		},
		zone(spell, k) {
			const at = { x: camera.position.x, y: camera.position.y - EYE, z: camera.position.z };
			effects.push({ t: 0, life: spell.t, every: 0.5,
				step() {
					fx.ring(at, spell.r, GLOW.restoration, 24, 0.5, 0.25);
					const e = camera.position;
					if (Math.hypot(e.x - at.x, e.z - at.z) < spell.r) combat.mend(spell.heal * 0.5 * k);
					for (const x of hostilesNear(at, spell.r, struck)) hex(x.T, spell.status, k);
				} });
		},
		storm(spell, k) {
			const { at } = aimPoint(spell.range);
			for (const F of combat.firesNear(at.x, at.z, spell.douse)) combat.douse(F.id, 60);
			effects.push({ t: 0, life: spell.t, every: spell.t / spell.strikes,
				step() {
					const tgt = nearestHostile(at, spell.r);
					const a = Math.random() * 6.283, r = Math.random() * spell.r;
					const p = tgt && Math.random() < 0.7 ? { x: tgt.bound.x, y: tgt.bound.y - 0.9, z: tgt.bound.z } : { x: at.x + Math.cos(a) * r, y: 0, z: at.z + Math.sin(a) * r };
					if (!tgt) p.y = combat.ground(p.x, p.z, at.y + 30);
					fx.line({ x: p.x + (Math.random() - 0.5) * 6, y: p.y + 45, z: p.z + (Math.random() - 0.5) * 6 }, p, GLOW.storm, 0.9, 0.22, 0.4, 3.5);
					fx.burst(p, GLOW.storm, 20, 6, 0.4, 0.3, 1);
					for (const x of hostilesNear(p, 3, struck)) harm(x.T, spell.dmg * k, spell, p);
					combat.shake?.(0.08); magicSound('storm', 0.1);
				} });
			// (the rain under it)
			effects.push({ t: 0, life: spell.t, every: 0.05, step() { for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, r = spell.r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * r, at.y + 14, at.z + Math.sin(a) * r, 0, -16, 0, 0.9, 0.06, 0.04, [0.5, 0.65, 0.8], 0.6, 0, 0); } } });
		},
		heal(spell, k, o) {
			const n = combat.mend(spell.heal * k);
			fx.burst({ x: camera.position.x, y: camera.position.y - 0.8, z: camera.position.z }, GLOW.restoration, 30, 1.2, 0.9, 0.2, 1.4);
			// (renew: it goes on healing for a while after)
			if (spell.renew) buff.hots.push({ left: spell.renewT, rate: spell.heal * k * spell.renew / spell.renewT });
			else if (!n && !o.quiet) hint('You are not hurt.', 1400);
		},
		hot(spell, k) { buff.hots.push({ left: spell.t, rate: spell.heal * k / spell.t }); },
		shield(spell, k) {
			buff.shield = spell.absorb * (spell.absorb > 1e5 ? 1 : k); buff.shieldUntil = now() + spell.t;
			// (an aura lit with it)
			if (spell.aura) DO.aura({ ...SPELL['radiant-aura'], ...spell.aura }, k);
		},
		deathward(spell) { buff.deathUntil = now() + spell.t; buff.deathHeal = spell.heal; },
		aura(spell, k) {
			effects.push({ t: 0, life: spell.t, every: 0.25,
				step() {
					const c = { x: camera.position.x, y: camera.position.y - 1, z: camera.position.z };
					for (let n = 0; n < 8; n++) { const a = Math.random() * 6.283; fx.emit(c.x + Math.cos(a) * spell.r, c.y + Math.random(), c.z + Math.sin(a) * spell.r, 0, 0.8, 0, 0.5, 0.25, 0.05, GLOW.radiance, 0.8, 0, 0); }
					for (const x of hostilesNear(c, spell.r, struck)) harm(x.T, spell.dps * 0.25 * k, spell, c);
				} });
		},
		buff(spell) {
			buff.moves.push({ until: now() + spell.t, speedK: spell.speedK || 1, jumpK: spell.jumpK || 1, fallK: spell.fallK || 1, waterWalk: !!spell.waterWalk });
			if (spell.cdK) buff.quickUntil = now() + spell.t;
		},
		cloak(spell) { buff.cloakUntil = now() + spell.t; fx.burst({ x: camera.position.x, y: camera.position.y - 0.8, z: camera.position.z }, GLOW.shadow, 40, 2, 0.8, 0.3, 0); },
		light(spell) { if (buff.lightUntil > now()) { buff.lightUntil = 0; return 'off'; } buff.lightUntil = now() + spell.t; },
		sight(spell) { buff.sightUntil = now() + spell.t; buff.sightWhat = spell.what; buff.sightR = spell.r; if (spell.night) buff.nightUntil = now() + spell.t; },
		pact(spell) {
			const v = combat.vitals();
			if (v.hp <= v.max * spell.hp + 1) { hint('You have too little life to give.', 2000); return 'refund'; }
			combat.hurtPlayer({ amount: v.max * spell.hp, type: 'energy', part: 'torso', pact: true, quiet: true });
			state.mana = manaMax(state); buff.pactUntil = now() + spell.t; buff.pactK = spell.power;
			fx.burst({ x: camera.position.x, y: camera.position.y - 0.6, z: camera.position.z }, GLOW.umbral, 60, 3, 1, 0.3, 0);
		},
		summon(spell, k) {
			for (let n = 0; n < spell.n; n++) shades.push({ spell, k, until: now() + spell.t, a: n / spell.n * 6.283, cool: 0.5 + n * 0.3, pos: camera.position.clone() });
			while (shades.length > 4) shades.shift();
		},
		blink(spell) {
			const p = P(); if (!p) return 'refund';
			aim(_o, _d);
			_d.y = Math.max(-0.4, Math.min(0.4, _d.y)); _d.normalize();
			const h = combat.firstHit(_o, _d, spell.range, combat.me);
			const d = Math.max(0, (h ? h.t : spell.range) - 0.8);
			if (d < 1.5) { hint('No room to step there.', 1200); return 'refund'; }
			const to = _o.clone().addScaledVector(_d, d);
			const gy = combat.ground(to.x, to.z, to.y + 1);
			to.y = Math.max(to.y, gy + EYE);
			fx.burst({ x: p.pos.x, y: p.pos.y - 0.8, z: p.pos.z }, GLOW.shadow, 40, 2.5, 0.6, 0.3, 0);
			teleport(to.x, to.y, to.z);
			fx.burst({ x: to.x, y: to.y - 0.8, z: to.z }, GLOW.shadow, 40, 2.5, 0.6, 0.3, 0);
			// (and the dark keeps you a moment after)
			if (spell.cloakAfter) buff.cloakUntil = Math.max(buff.cloakUntil, now() + spell.cloakAfter);
		},
		recall(spell, k, o) {
			const p = P(); if (!p) return 'refund';
			const w = worldKey();
			if (!state.mark || state.mark.w !== w || o.shift) {
				state.mark = { x: p.pos.x, y: p.pos.y, z: p.pos.z, w };
				fx.pillar({ x: p.pos.x, y: p.pos.y - EYE, z: p.pos.z }, 3, GLOW.chrono, 40, 1, 0.3, true);
				hint('The weave is marked here. Cast again to return.', 2500);
				return 'cheap';
			}
			fx.pillar({ x: p.pos.x, y: p.pos.y - EYE, z: p.pos.z }, 4, GLOW.chrono, 50, 0.7, 0.4, true);
			teleport(state.mark.x, state.mark.y, state.mark.z);
			if (spell.recallHeal) combat.mend(combat.vitals().max * spell.recallHeal);
		},
		gate() {
			const sd = seed(), list = state.wells.filter((q) => q.seed === sd);
			if (!list.length) { hint('You have found no aether well in this world yet. Look for a bright spring of light or dark.', 3500); return 'refund'; }
			const W0 = list[gateI++ % list.length];
			teleport(W0.x + 2.5, combat.ground(W0.x + 2.5, W0.z, W0.y + 3) + EYE, W0.z);
			fx.pillar({ x: W0.x + 2.5, y: W0.y - 0.5, z: W0.z }, 6, GLOW.dawn, 80, 1, 0.5, true);
			hint(`Through the light to a ${W0.strand} well (${(gateI - 1) % list.length + 1} of ${list.length}).`, 2500);
		},
		rewind() {
			const t0 = now() - 5, S = history.find((q) => q.t >= t0) || history[0];
			if (!S) return 'refund';
			fx.burst({ x: camera.position.x, y: camera.position.y - 0.8, z: camera.position.z }, GLOW.chrono, 50, 2, 0.8, 0.3, 0);
			teleport(S.x, S.y, S.z);
			const v = combat.vitals();
			if (S.hp > v.hp) combat.mend(S.hp - v.hp);
		},
		stasis(spell, k, o) {
			const { T } = aimPoint(spell.range);
			if (!T) { if (!o.quiet) hint('Nothing there to hold.', 1200); return 'refund'; }
			if (T.kind !== 'hostile') { if (!o.quiet) hint(T.kind === 'boss' ? 'It is too vast to hold in time.' : 'Stasis holds only those who fight.', 1600); return 'refund'; }
			hex(T, { hold: spell.t });
			effects.push({ t: 0, life: spell.t, every: 0.12, step: () => fx.burst({ x: T.bound.x, y: T.bound.y, z: T.bound.z }, GLOW.chrono, 3, 0.6, 0.6, 0.25, 0) });
		},
		douse(spell) {
			const e = camera.position, list = combat.firesNear(e.x, e.z, spell.r);
			for (const F of list) combat.douse(F.id, 60);
			effects.push({ t: 0, life: 4, every: 0.04, step() { for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, r = 18 * Math.sqrt(Math.random()); fx.emit(e.x + Math.cos(a) * r, e.y + 12, e.z + Math.sin(a) * r, 0, -15, 0, 1, 0.05, 0.04, [0.55, 0.7, 0.85], 0.6, 0, 0); } } });
			hint(list.length ? `Rain falls. ${list.length} fire${list.length > 1 ? 's' : ''} put out.` : 'Rain falls round you.', 2200);
		},
		daybreak() {
			if (light() > -0.05 || !sky?.state) { hint('It is already day.', 1500); return 'refund'; }
			const h0 = sky.state.hours, h1 = 6.4 + (h0 > 6.4 ? 24 : 0);
			dayTween = { h0, h1, t: 0, T: 6 };
			hint('The sky turns toward dawn.', 2500);
		},
	};
	function teleport(x, y, z) {
		const p = P(); if (!p) return;
		p.pos.set(x, y, z); p.vel.set(0, 0, 0);
		camera.position.set(x, y, z);
	}

	// ---------- casting ----------
	// cast a spell by its id: true if it was cast (o.shift: Shift held). o.free: loosed by the
	// weapon in hand (gear-magic.js Spellshot): known or not, no mana, no cooldown, no word.
	// A garment's mastery (mods.free) makes every few casts of its school free the same way.
	function cast(id, o = {}) {
		const spell = SPELL[id], t = now();
		if (!spell) return false;
		const every = !o.free && state.mods?.free?.[spell.school];
		const mastery = !!every && ((freeCount[spell.school] || 0) + 1) % every === 0;
		const why = o.free ? null : castBlock(state, id, t);
		// (a free cast needs no mana, only the spell known and ready)
		if (why && !(mastery && state.known.includes(id) && (state.cds[id] || 0) <= t)) { if (!o.quiet) hint(why, 1400); magicSound('fizzle', 0.06); return false; }
		const k = spellPower(state, spell, { light: light(), pact: buff.pactUntil > t ? buff.pactK || 1.5 : 1 });
		// (the perks you hold and the gear you wear shape it: magic/skills.js, gear-magic.js)
		const out = DO[spell.kind]?.(shaped(spell, state.mods), k, o);
		if (out === 'refund') return false;
		const c = GLOW[spell.school];
		// (any harm you do shows you: the cloak is gone)
		if (spell.dmg || spell.dps) buff.cloakUntil = 0;
		if (o.free || mastery) {
			if (every) freeCount[spell.school] = 0;
			fx.ring({ x: camera.position.x, y: camera.position.y - EYE + 0.1, z: camera.position.z }, 1.4, c, 24, 0.5, 0.3);
			if (mastery) { hint(`Mastery: ${spell.name} cost nothing.`, 1100); track('cast', spell, manaCost(state, spell) * 0.5); }
			fx.burst(hand(_p), c, 14, 1.4, 0.35, 0.16, 0.2);
			magicSound(spell.school);
			return true;
		}
		if (every) freeCount[spell.school] = (freeCount[spell.school] || 0) + 1;
		const paid = manaCost(state, spell);
		spend(state, id, t, buff.quickUntil > t ? 3 : 1);
		track('cast', spell, out === 'off' ? 0 : out === 'cheap' ? paid * 0.25 : paid);
		// (marking costs little; letting a light go costs nothing)
		if (out === 'cheap' || out === 'off') { state.mana += Math.round(spell.mana * (out === 'off' ? 1 : 0.75)); state.cds[id] = t + 1; }
		fx.burst(hand(_p), c, 14, 1.4, 0.35, 0.16, 0.2);
		magicSound(spell.school);
		return true;
	}
	// let go of a held spell (a beam)
	function release(id) { held.delete(id); }

	// ---------- each frame ----------
	function stepBolts(dt) {
		for (let i = bolts.length - 1; i >= 0; i--) {
			const B = bolts[i], spell = B.spell;
			B.life -= dt;
			if (B.life <= 0) { bolts.splice(i, 1); continue; }
			const step = B.vel.length() * dt;
			_d.copy(B.vel).normalize();
			const h = combat.firstHit(B.pos, _d, step, combat.me);
			const c = GLOW[spell.school];
			// (its trail)
			for (let n = 0; n < 3; n++) fx.emit(B.pos.x - _d.x * step * n / 3, B.pos.y - _d.y * step * n / 3, B.pos.z - _d.z * step * n / 3, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0.28, n ? 0.18 : 0.32, 0.04, c, 1, 0, 0);
			if (h) {
				const at = B.pos.clone().addScaledVector(_d, h.t);
				if (h.T && !h.ward) { harm(h.T, (B.dmg ?? spell.dmg) * B.k, spell, at, _d); hex(h.T, spell.status, B.k); }
				fx.burst(at, c, 16, 3, 0.4, 0.22, 0.6);
				if (spell.splash) { fx.ring(at, spell.splash, c, 24, 0.35, 0.3); areaHarm(at, spell.splash, spell, B.k, spell.dmg * 0.6, null); }
				if (spell.ignite) combat.igniteAt(at.x, at.z, 5);
				if (spell.burn) burnAt(at, spell, B.k);
				// (pierce: on through the first it strikes; 'all': through everyone, up to eight)
				if (spell.pierce === 'all' && h.T && (B.hits = (B.hits || 0) + 1) < 8) { B.pos.copy(at).addScaledVector(_d, 0.6); continue; }
				if (spell.pierce === true && h.T && !B.pierced) { B.pierced = true; B.pos.copy(at).addScaledVector(_d, 0.6); continue; }
				bolts.splice(i, 1);
				continue;
			}
			B.pos.addScaledVector(B.vel, dt);
		}
	}
	// burning ground where a bolt lands (a garment's Cinder): the hostile in it take fire
	function burnAt(at, spell, k) {
		const B0 = spell.burn, c = GLOW.primal, p = at.clone();
		effects.push({ t: 0, life: B0.t, every: 0.25,
			step() {
				for (let n = 0; n < (isPhone ? 4 : 9); n++) { const a = Math.random() * 6.283, r = B0.r * Math.sqrt(Math.random()); fx.emit(p.x + Math.cos(a) * r, p.y + 0.1, p.z + Math.sin(a) * r, 0, 1.2 + Math.random(), 0, 0.5, 0.22, 0.05, c, 0.9, 0, 0); }
				for (const x of hostilesNear(p, B0.r, struck)) harm(x.T, B0.dps * 0.25 * k, spell, p);
			} });
	}
	function stepBeams(dt, keysHeld) {
		for (const [id, H] of held) {
			const spell = H.spell;
			H.t -= dt;
			if (H.t <= 0 || !keysHeld(id)) { held.delete(id); continue; }
			const from = hand(new THREE.Vector3());
			aim(_o, _d);
			const h = combat.firstHit(_o, _d, spell.range, combat.me), end = _o.clone().addScaledVector(_d, h ? h.t : spell.range);
			const c = GLOW[spell.school];
			fx.line(from, end, c, isPhone ? 1.2 : 0.6, 0.06, spell.drain ? 0.18 : 0.28, 0.05);
			fx.burst(end, c, 2, 1.5, 0.25, 0.2, 0.3);
			if (h?.T && !h.ward) {
				const acc = (H.acc.get(h.T) || 0) + spell.dps * H.k * dt;
				if (acc >= 4) {
					const r = harm(h.T, acc, spell, from, _d);
					if (spell.drain && r?.dealt) combat.mend(r.dealt * spell.drain);
					H.acc.set(h.T, 0);
				} else H.acc.set(h.T, acc);
			}
		}
	}
	function stepEffects(dt) {
		for (let i = effects.length - 1; i >= 0; i--) {
			const E = effects[i];
			if (E.run) { E.t -= dt; if (E.t <= 0) { E.run(); effects.splice(i, 1); } continue; }
			E.life -= dt;
			E.move?.(dt);
			E.acc = (E.acc || 0) + dt;
			if (E.acc >= E.every) { E.acc = 0; E.step(); }
			if (E.life <= 0) { E.end?.(); effects.splice(i, 1); }
		}
	}
	function stepShades(dt, t) {
		for (let i = shades.length - 1; i >= 0; i--) {
			const S = shades[i];
			if (t > S.until) { fx.burst(S.pos, GLOW.umbral, 20, 2, 0.6, 0.25, 0); shades.splice(i, 1); continue; }
			S.a += dt * 1.4;
			const e = camera.position;
			_p.set(e.x + Math.cos(S.a) * 1.6, e.y - 0.2 + Math.sin(S.a * 1.7) * 0.25, e.z + Math.sin(S.a) * 1.6);
			S.pos.lerp(_p, Math.min(1, dt * 4));
			fx.emit(S.pos.x, S.pos.y, S.pos.z, 0, 0.1, 0, 0.3, 0.38, 0.1, GLOW.umbral, 0.9, 0, 0);
			fx.emit(S.pos.x + (Math.random() - 0.5) * 0.3, S.pos.y, S.pos.z + (Math.random() - 0.5) * 0.3, 0, -0.3, 0, 0.6, 0.15, 0.02, [0.2, 0.1, 0.35], 1, 0, 0);
			S.cool -= dt;
			if (S.cool > 0) continue;
			S.cool = S.spell.rate;
			const T = nearestHostile(S.pos, S.spell.range, (q) => q.ref?.alert || q.kind === 'boss');
			if (!T) continue;
			_d.set(T.bound.x - S.pos.x, T.bound.y - S.pos.y, T.bound.z - S.pos.z).normalize();
			bolts.push({ spell: { ...SPELL.shadowbolt, dmg: S.spell.dmg, school: 'umbral' }, k: S.k, pos: S.pos.clone(), vel: _d.clone().multiplyScalar(45), life: 2, owner: 'shade' });
		}
	}
	function stepBuffs(dt, t) {
		const p = P();
		for (let i = buff.hots.length - 1; i >= 0; i--) { const H = buff.hots[i]; H.left -= dt; combat.mend(H.rate * dt); if (H.left <= 0) buff.hots.splice(i, 1); }
		buff.moves = buff.moves.filter((m) => m.until > t);
		if (p) {
			let sk = 1, jk = 1, fk = 1, ww = false;
			for (const m of buff.moves) { sk = Math.max(sk, m.speedK); jk = Math.max(jk, m.jumpK); fk = Math.min(fk, m.fallK); ww = ww || m.waterWalk; }
			// (and the body's perks, at all times)
			const M = state.mods;
			p.speedK = sk * (1 + (M?.speed || 0)); p.jumpK = jk * (1 + (M?.jump || 0)); p.fallK = fk * (1 - (M?.fall || 0)); p.waterWalk = ww;
		}
		// (quickened: every cooldown runs three times as fast)
		if (buff.quickUntil > t) for (const id of Object.keys(state.cds)) state.cds[id] -= dt * 2;
		if (buff.shieldUntil <= t) buff.shield = 0;
		// the small sun at your shoulder
		if (buff.lightUntil > t) {
			const e = camera.position;
			aim(_o, _d);
			fx.emit(e.x - _d.z * 0.5, e.y + 0.35, e.z + _d.x * 0.5, 0, 0, 0, 0.12, 0.55, 0.45, GLOW.dawn, 1, 0, 0);
		}
		// what the sight spells show
		if (buff.sightUntil > t && Math.random() < dt * 4) {
			const e = camera.position;
			if (buff.sightWhat === 'life') for (const T of combat.layer.map.values()) {
				if (!T.bound || T.removed || (T.kind !== 'hostile' && T.kind !== 'person' && T.kind !== 'boss')) continue;
				if (Math.hypot(T.bound.x - e.x, T.bound.z - e.z) > buff.sightR) continue;
				fx.emit(T.bound.x, T.bound.y + 0.2, T.bound.z, 0, 0.1, 0, 0.5, T.kind === 'hostile' || T.kind === 'boss' ? 0.9 : 0.6, 0.5, T.kind === 'person' ? [0.4, 0.9, 0.6] : [1, 0.25, 0.25], 0.7, 0, 0);
			}
		}
		if (dayTween && sky?.state) {
			dayTween.t += dt;
			const u = Math.min(1, dayTween.t / dayTween.T);
			sky.state.hours = (dayTween.h0 + (dayTween.h1 - dayTween.h0) * (u * u * (3 - 2 * u))) % 24;
			if (u >= 1) dayTween = null;
		}
	}
	// the fight's door for a blow at you: the shield takes it, the death ward turns it aside
	function shieldBlow(blow) {
		if (blow.pact) return blow;
		const t = now();
		// (the perks that harden you, and the harm taken teaching you)
		if (state.mods?.armor) blow = { ...blow, amount: blow.amount * (1 - state.mods.armor) };
		track('hurt', blow.amount);
		if (buff.shield > 0 && buff.shieldUntil > t) {
			const take = Math.min(buff.shield, blow.amount);
			buff.shield -= take;
			const at = camera.position;
			fx.burst({ x: at.x, y: at.y - 0.6, z: at.z }, GLOW.warding, 10, 1.6, 0.3, 0.25, 0);
			if (take >= blow.amount) return null;
			blow = { ...blow, amount: blow.amount - take };
		}
		if (buff.deathUntil > t) {
			const v = combat.vitals();
			if (blow.amount >= v.hp) {
				buff.deathUntil = 0;
				combat.mend(v.max * (buff.deathHeal || 0.4));
				const at = camera.position;
				fx.pillar({ x: at.x, y: at.y - EYE, z: at.z }, 5, GLOW.restoration, 80, 1, 0.5, true);
				hint('Resurgence: the blow that would have felled you is turned aside.', 3000);
				return null;
			}
		}
		return blow;
	}
	// how much brighter the eye takes the night (Lumen a little, Nightsight much)
	function exposure() {
		const t = now(), dark = Math.max(0, Math.min(1, -light() * 6 + 0.3));
		return 1 + dark * ((buff.nightUntil > t ? 1.6 : 0) + (buff.lightUntil > t ? 0.45 : 0));
	}
	function update(dt, keysHeld = () => false) {
		const t = now();
		// your mana comes back (more slowly in a fight)
		regenT -= dt;
		if (regenT <= 0) { regenT = 0.5; fighting = !!combat.squads?.alive?.().some((h) => h.alert && h.target?.id === 'me'); }
		state.mana = Math.min(manaMax(state), state.mana + manaRegen(state, fighting) * dt);
		// (wounds close out of a fight, with the perks for it)
		if (state.mods?.hpRegen && !fighting) combat.mend(state.mods.hpRegen * dt);
		// (where you were, for a rewind)
		histT -= dt;
		const p = P();
		if (histT <= 0 && p) { histT = 0.25; history.push({ t, x: p.pos.x, y: p.pos.y, z: p.pos.z, hp: combat.vitals().hp }); while (history.length && history[0].t < t - 6) history.shift(); }
		stepBolts(dt); stepBeams(dt, keysHeld); stepEffects(dt); stepShades(dt, t); stepHexes(dt); stepKnocks(dt); stepBuffs(dt, t);
	}
	function clear() { bolts.length = effects.length = shades.length = knocks.length = 0; held.clear(); for (const T of hexed.keys()) T.hex = null; hexed.clear(); history.length = 0; }

	// ---------- what the weapon in hand's hits carry (gear-magic.js INFUSIONS, magic/index.js) ----------
	// a status laid on a fighter
	const hexOn = (T, st, k = 1) => hex(T, st, k);
	// a share of a hit leaping as lightning to the nearest other foe within hop m
	function arc(T, amount, hop = 8) {
		if (!T?.bound || amount <= 0) return false;
		const next = nearestHostile(T.bound, hop, (q) => q !== T);
		if (!next) return false;
		fx.line({ x: T.bound.x, y: T.bound.y + 0.2, z: T.bound.z }, { x: next.bound.x, y: next.bound.y + 0.2, z: next.bound.z }, GLOW.storm, 0.35, 0.22, 0.18, 1.2);
		harm(next, amount, { type: 'storm', school: 'storm' }, T.bound);
		return true;
	}
	// ward laid on you, up to max, held a while
	function ward(n, max = 40) {
		const t = now();
		buff.shield = Math.min(max, (buff.shieldUntil > t ? buff.shield : 0) + n);
		buff.shieldUntil = Math.max(buff.shieldUntil, t + 8);
	}
	// fleet feet for t s (the one entry, renewed)
	function fleet(share, t = 3) {
		const until = now() + t, m = buff.moves.find((q) => q.fleet);
		if (m) { m.until = Math.max(m.until, until); m.speedK = Math.max(m.speedK, 1 + share); } else buff.moves.push({ until, speedK: 1 + share, jumpK: 1, fallK: 1, waterWalk: false, fleet: true });
	}
	// seconds off the cooldowns of a school's spells
	function strike(school, cut) {
		const t = now();
		for (const id of Object.keys(state.cds)) if (SPELL[id]?.school === school && state.cds[id] > t) state.cds[id] = Math.max(t, state.cds[id] - cut);
	}
	return {
		cast, release, update, clear, shieldBlow, exposure, hexOn, arc, ward, fleet, strike,
		cloaked: () => buff.cloakUntil > now(),
		sighting: () => buff.sightUntil > now(),
		sightWhat: () => (buff.sightUntil > now() ? buff.sightWhat : null),
		setCursor: (c) => { cursor = c; },
		info: () => ({ bolts: bolts.length, effects: effects.length, shades: shades.length, hexed: hexed.size, held: [...held.keys()], shield: Math.round(buff.shield), cloak: buff.cloakUntil > now(), mana: Math.round(state.mana), max: manaMax(state) }),
		strandOf, SCHOOLS,
	};
}
