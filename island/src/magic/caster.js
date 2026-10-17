// The spells at work (their numbers: magic/spells.js). A spell is cast along your aim: the view's
// centre while you aim, or the cursor while you look about with the camera (player.js). What it
// does is one of a few kinds, each worked out here every frame from fixed lists:
//
//   bolt     a glowing bolt flies along the aim (pierce: on through the first it strikes; splash:
//            a burst where it lands; ignite: sets alight what will burn)
//   beam     held: a lance from the hand along the aim, burning (drain: healing you) while held
//   burst    light or dark bursting where you aim (after a delay, if it has one)
//   strike   a pillar from the sky onto where you aim, a breath later
//   lances   lances falling point first round where you aim, out of the sun (or the moon by night)
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
// How each spell shows is its own (magic/looks.js): this calls on the look at each moment (the
// cast, a bolt's flight and landing, a beam, a blast and its tell, a lingering area, a wraith, a
// buff while it lasts, a status on a fighter) and falls back on a soft orb of its school's colour.

import * as THREE from 'three';
import { SPELL, SCHOOLS, castBlock, spend, spellPower, manaMax, manaRegen, strandOf, moonlit } from './spells.js';
import { GLOW, magicSound } from './fx.js';
import { lookOf, LOOK } from './looks.js';

const EYE = 1.68;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
const typeOf = (t) => (t === 'fire' ? 'fire' : 'energy');
const hostile = (T) => !!T && !T.removed && (T.kind === 'hostile' || T.kind === 'boss') && !T.surrendered;

// heavens(): { sun, moon }, the directions toward each (the lances fall out of whichever is up)
export function createCaster({ camera, combat, player, state, fx, light, heavens = () => null, hint, sky, worldKey, seed, isPhone = false }) {
	const P = () => player()?.state;
	const now = () => performance.now() / 1000;
	const bolts = [], effects = [], shades = [], knocks = [], hexed = new Map(), held = new Map();
	const buff = { shield: 0, shieldUntil: 0, cloakUntil: 0, deathUntil: 0, pactUntil: 0, quickUntil: 0, lightUntil: 0, sightUntil: 0, sightWhat: null, nightUntil: 0, hots: [], moves: [], looks: new Map() };
	const history = [];
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
	function hex(T, st, k = 1, by = null) {
		if (!st || !T || T.kind !== 'hostile' || T.removed) return;
		const H = T.hex || (T.hex = { hold: 0, fear: 0, slowK: 1, slowT: 0, dot: 0, dotT: 0, dotAcc: 0, spread: 0, by: null });
		// (the spell that laid it, for how it shows on them)
		if (by && LOOK[by]?.mark) H.by = by;
		if (st.hold) H.hold = Math.max(H.hold, st.hold);
		if (st.fear) H.fear = Math.max(H.fear, st.fear);
		if (st.slow) { H.slowK = Math.min(H.slowK, st.slow); H.slowT = Math.max(H.slowT, st.t || 3); }
		if (st.dot) { H.dot = Math.max(H.dot, st.dot * k); H.dotT = Math.max(H.dotT, st.t || 6); H.spread = st.spread || H.spread; }
		hexed.set(T, H);
	}
	function stepHexes(dt) {
		for (const [T, H] of hexed) {
			if (H.by && T.bound) LOOK[H.by].mark(fx, T, H);
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
						if (next) { hex(next, { dot: H.dot, t: 10, spread: H.spread }, 1, H.by); (LOOK[H.by]?.spread || ((f, a, b) => f.line(a, b, GLOW.blight, 0.5, 0.5, 0.2, 0.6)))(fx, T.bound, next.bound); }
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
			hex(x.T, status, k, spell.id);
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
			bolts.push({ spell, k, pos: from, vel: dir.multiplyScalar(spell.speed), life: 4, pierced: false, owner: 'me', look: lookOf(spell) });
		},
		beam(spell, k) { held.set(spell.id, { spell, k, t: spell.t, acc: new Map() }); },
		burst(spell, k) {
			const { at } = aimPoint(spell.range);
			const c = GLOW[spell.school], L = lookOf(spell), D = spell.delay || 0;
			if (L.tell) effects.push({ t: 0, every: 0.08, life: Math.max(0.16, D), step() { L.tell(fx, at, spell.r, 1 - Math.max(0, this.life) / Math.max(0.16, D)); } });
			else fx.ring(at, spell.r, c, 30, D || 0.5, 0.25);
			effects.push({ t: D, run: () => { if (L.blast) L.blast(fx, at, spell.r); else { fx.burst(at, c, 60, spell.r * 1.6, 0.8, 0.45, 1); fx.ring(at, spell.r, c, 50, 0.5, 0.4); } areaHarm(at, spell.r, spell, k, spell.dmg, spell.status); magicSound(spell.school, 0.16); } });
		},
		strike(spell, k) {
			const { at } = aimPoint(spell.range);
			const c = GLOW[spell.school], L = lookOf(spell);
			effects.push({ t: 0, every: 0.08, life: spell.delay, step() { if (L.tell) L.tell(fx, at, spell.r, 1 - Math.max(0, this.life) / spell.delay); else fx.ring(at, spell.r, c, 18, 0.3, 0.2); } });
			effects.push({ t: spell.delay, run: () => { if (L.blast) L.blast(fx, at, spell.r); else { fx.pillar(at, 40, c, isPhone ? 60 : 140, 0.5, 0.9, false); fx.burst(at, c, 80, 9, 1, 0.5, 2); } areaHarm(at, spell.r, spell, k, spell.dmg, null); combat.shake?.(0.25); magicSound('storm', 0.2); } });
		},
		flare(spell, k) {
			// Solar Flare: directed light out of wherever the sun stands, a column down onto where you aim
			// for spell.delay, then the blast. By night only once it channels the moon (moonlit), in
			// silver and a fifth weaker; under no moon, or unmastered, it is not cast and costs nothing.
			const H = heavens() || {}, up = (q) => q && q.y > 0.05, night = !up(H.sun);
			if (night && (!moonlit(state, spell.id) || !up(H.moon))) { hint(moonlit(state, spell.id) ? 'There is no moon up to channel.' : `${spell.name} needs the sun. Master it to channel the moon by night.`, 2200); return 'refund'; }
			const src = night ? H.moon : H.sun, dir = new THREE.Vector3(src?.x || 0, Math.max(0.35, src?.y || 1), src?.z || 0).normalize();
			const { at } = aimPoint(spell.range), L = lookOf(spell), D = spell.delay || 0.5, kk = night ? k * 0.8 : k;
			const top = { x: at.x + dir.x * 70, y: at.y + dir.y * 70, z: at.z + dir.z * 70 };
			effects.push({ t: 0, every: 0.05, life: D, step() { const u = 1 - Math.max(0, this.life) / D; L.tell?.(fx, at, spell.r, u, night); L.beam?.(fx, top, at, u, night); } });
			effects.push({ t: D, run: () => { if (L.blast) L.blast(fx, at, spell.r, night); else fx.burst(at, GLOW.radiance, 60, spell.r * 1.6, 0.8, 0.45, 1); areaHarm(at, spell.r, spell, kk, spell.dmg, spell.status); combat.shake?.(0.12); magicSound(spell.school, 0.16); } });
		},
		singularity(spell, k) {
			// Gargantua: it rises on the horizon the way you face, and over spell.t draws every foe within
			// spell.r of you into it, holding them as they slide toward it and unmaking each at its moment.
			// Anything vast loses spell.bossCut of its life, a little at each step. Foes who come into
			// reach while it feeds are taken too.
			const L = lookOf(spell), me = camera.position.clone();
			aim(_o, _d);
			const fw = _d.clone().setY(0);
			if (fw.lengthSq() < 1e-4) fw.set(0, 0, -1);
			fw.normalize();
			const hx = me.x + fw.x * spell.far, hz = me.z + fw.z * spell.far, base = Math.max(me.y - EYE, combat.ground(hx, hz, me.y) ?? -1e9);
			const hole = new THREE.Vector3(hx, base + spell.rise, hz), drawn = hole.clone(), R = spell.size, RISE = 1.2;
			const doomed = new Map(), vast = new Map();
			let t = 0, n = 0;
			const gather = () => {
				for (const x of combat.layer.within(me, spell.r, combat.me)) {
					const T = x.T;
					if (!hostile(T)) continue;
					if (T.kind === 'boss') { if (!vast.has(T)) vast.set(T, { dealt: 0 }); }
					else if (!doomed.has(T)) doomed.set(T, { at: Math.max(t + 0.8, RISE + 0.3 + Math.random() * (spell.t - RISE - 1.3)) });
				}
			};
			const unmake = (T) => { const b = T.bound; L.arc?.(fx, b, drawn); harm(T, 1e6, spell, drawn, { x: drawn.x - b.x, y: drawn.y - b.y, z: drawn.z - b.z }); };
			const bleed = (T, B, share) => {
				const M = T.life?.(), owed = M ? M.max * spell.bossCut * share - B.dealt : 0;
				if (owed > 0) B.dealt += harm(T, owed, spell, drawn)?.dealt || 0;
			};
			gather();
			combat.shake?.(0.3);
			magicSound('void', 0.25);
			effects.push({ t: 0, life: spell.t, every: 0.1,
				step() {
					t += 0.1; n++;
					const u = Math.min(1, t / RISE), e = 1 - (1 - u) * (1 - u);
					drawn.set(hole.x, hole.y - (1 - e) * R * 2.5, hole.z);
					if (u < 1) { if (L.tell) L.tell(fx, drawn, R, e, camera.position); } else if (L.tick) L.tick(fx, drawn, R, now(), camera.position);
					else fx.burst(drawn, GLOW.void, 6, -R, 0.5, R * 0.1, 0);
					if (n % 10 === 0) { gather(); combat.shake?.(0.05); }
					for (const [T, D] of doomed) {
						if (T.removed || T.dead || !T.bound) { doomed.delete(T); continue; }
						const h = T.ref, S = h?.body?.M?.S, pos = S ? S.pos : h?.pos;
						if (pos) { const dx = drawn.x - pos.x, dz = drawn.z - pos.z, l = Math.hypot(dx, dz) || 1, v = (1.5 + 12 * t / spell.t) * 0.1; pos.x += dx / l * v; pos.z += dz / l * v; }
						hex(T, { hold: 0.3 }, k, spell.id);
						if (t >= D.at) { unmake(T); doomed.delete(T); }
					}
					for (const [T, B] of vast) if (!T.removed) bleed(T, B, Math.min(1, t / spell.t));
				},
				end() {
					// (whoever is left goes now, and the vast pay what they still owe)
					for (const T of doomed.keys()) if (!T.removed && T.bound) unmake(T);
					for (const [T, B] of vast) if (!T.removed) bleed(T, B, 1);
					if (L.blast) L.blast(fx, drawn, R); else fx.burst(drawn, GLOW.void, 90, R * 3, 0.9, R * 0.2, 0);
					combat.shake?.(0.4); magicSound('void', 0.3);
				} });
		},
		lances(spell, k) {
			const { at } = aimPoint(spell.range), L = lookOf(spell);
			// (out of the sun while it is up, else the moon, else straight down; never too low to see)
			const H = heavens() || {}, up = (q) => q && q.y > 0.05;
			const night = !up(H.sun) && up(H.moon), src = up(H.sun) ? H.sun : night ? H.moon : { x: 0, y: 1, z: 0 };
			const dir = new THREE.Vector3(src.x, Math.max(0.55, src.y), src.z).normalize();
			const n = spell.n || 3;
			for (let i = 0; i < n; i++) {
				const a = i / n * 6.283 + 0.5, to = new THREE.Vector3(at.x + Math.cos(a) * spell.spread, 0, at.z + Math.sin(a) * spell.spread);
				to.y = combat.ground(to.x, to.z, at.y + 20);
				L.tell?.(fx, to, spell.r, 0, night);
				const fall = 26, from = to.clone().addScaledVector(dir, fall), T = 0.32;
				effects.push({ t: 0, life: 0.18 * i + T, every: 0.04, pos: from.clone(), wait: 0.18 * i,
					move(dt) { if ((this.wait -= dt) > 0) { L.tell?.(fx, to, spell.r, 0, night); return; } this.pos.addScaledVector(dir, -fall / T * dt); if (this.pos.distanceTo(to) < 0.5 || (this.pos.y < to.y)) this.pos.copy(to); },
					step() { if (this.wait <= 0) L.fall?.(fx, this.pos, dir, night); },
					end() { L.blast?.(fx, to, spell.r, night); areaHarm(to, spell.r, spell, k, spell.dmg, null); combat.shake?.(0.08); magicSound(spell.school, 0.12); } });
			}
		},
		nova(spell, k) {
			const c = { x: camera.position.x, y: camera.position.y - EYE + 0.4, z: camera.position.z };
			const L = lookOf(spell);
			if (L.blast) L.blast(fx, c, spell.r);
			else { fx.ring(c, spell.r, GLOW[spell.type === 'frost' ? 'frost' : spell.school], 60, 0.45, 0.4); fx.burst(c, GLOW[spell.type === 'frost' ? 'frost' : spell.school], 40, spell.r * 1.2, 0.6, 0.3, 0.5); }
			areaHarm(c, spell.r, spell, k, spell.dmg, spell.status, spell.push || 0);
		},
		cone(spell, k) {
			aim(_o, _d);
			const c = GLOW[spell.school], cos = Math.cos(spell.angle), L = lookOf(spell);
			if (L.cone) L.cone(fx, _o, _d, spell.range, spell.angle);
			else for (let n = 0; n < 50; n++) {
				_q.set(_d.x + (Math.random() - 0.5) * spell.angle * 1.6, _d.y + (Math.random() - 0.5) * 0.4, _d.z + (Math.random() - 0.5) * spell.angle * 1.6).normalize().multiplyScalar(spell.range / 0.5);
				fx.emit(_o.x, _o.y - 0.3, _o.z, _q.x, _q.y, _q.z, 0.5, 0.3, 0.9, c, 0.8, 0, 0.5);
			}
			for (const x of hostilesNear(_o, spell.range, struck)) {
				_p.set(x.T.bound.x - _o.x, 0, x.T.bound.z - _o.z).normalize();
				if (_p.dot(_q.set(_d.x, 0, _d.z).normalize()) < cos) continue;
				harm(x.T, spell.dmg * k, spell, _o);
				hex(x.T, spell.status, k, spell.id);
				if (spell.push) shove(x.T, _o, spell.push);
			}
		},
		chain(spell, k) {
			const { at, T } = aimPoint(spell.range);
			const from = hand(new THREE.Vector3()), c = GLOW.storm, L = lookOf(spell);
			const arc = L.arc || ((f, a, b) => f.line(a, b, c, 0.45, 0.25, 0.2, 1.4));
			let cur = T && hostile(T) ? T : nearestHostile(at, 6);
			if (!cur) { arc(fx, from, at); return; }
			const done = new Set();
			let a = from, dmg = spell.dmg * k;
			for (let j = 0; j <= spell.jumps && cur; j++) {
				done.add(cur);
				const b = { x: cur.bound.x, y: cur.bound.y + 0.2, z: cur.bound.z };
				arc(fx, a, b);
				harm(cur, dmg, spell, a);
				hex(cur, { hold: 0.3 });
				a = b; dmg *= 0.8;
				cur = nearestHostile(b, spell.hop, (q) => !done.has(q));
			}
		},
		orb(spell, k) {
			const pos = hand(new THREE.Vector3());
			aim(_o, _d);
			const L = lookOf(spell);
			effects.push({ t: 0, life: spell.t, every: spell.rate, pos, vel: _d.clone().setY(0).normalize().multiplyScalar(spell.speed), trail: 0,
				move(dt) { this.pos.addScaledVector(this.vel, dt); const gy = combat.ground(this.pos.x, this.pos.z, this.pos.y + 2); this.pos.y += (gy + 1.2 - this.pos.y) * Math.min(1, dt * 3); if (L.orb) L.orb(fx, this.pos, now()); else fx.burst(this.pos, GLOW.storm, 3, 1.5, 0.25, 0.35, 0); },
				step() { for (const x of hostilesNear(this.pos, spell.r, struck)) { if (L.arc) L.arc(fx, this.pos, x.T.bound); else fx.line(this.pos, x.T.bound, GLOW.storm, 0.4, 0.15, 0.15, 0.8); harm(x.T, spell.dmg * k, spell, this.pos); } } });
		},
		well(spell, k) {
			const { at } = aimPoint(spell.range);
			at.y += 1;
			const L = lookOf(spell);
			effects.push({ t: 0, life: spell.t, every: 0.1,
				step() {
					if (L.tick) L.tick(fx, at, spell.r, now());
					else {
						fx.burst(at, GLOW.void, 6, -2, 0.5, 0.35, 0);
						for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, r = spell.r * Math.random(); fx.emit(at.x + Math.cos(a) * r, at.y + (Math.random() - 0.5) * 2, at.z + Math.sin(a) * r, -Math.cos(a) * r * 2, 0, -Math.sin(a) * r * 2, 0.5, 0.25, 0.05, GLOW.void, 0.9, 0, 0); }
					}
					for (const x of hostilesNear(at, spell.r, struck)) {
						const h = x.T.ref, S = h?.body?.M?.S, pos = S ? S.pos : h?.pos;
						if (pos && x.d > 0.8) { const dx = at.x - pos.x, dz = at.z - pos.z, l = Math.hypot(dx, dz) || 1; pos.x += dx / l * spell.pull * 0.1; pos.z += dz / l * spell.pull * 0.1; }
						if (spell.dps) harm(x.T, spell.dps * 0.1 * k, spell, at);
						hex(x.T, spell.status ? { hold: 0.3 } : { slow: 0.3, t: 0.3 }, k, spell.id);
					}
				},
				end() { if (L.blast) L.blast(fx, at, spell.r); else { fx.burst(at, GLOW.void, 90, spell.r * 1.5, 0.7, 0.5, 0); fx.ring(at, spell.r, GLOW.void, 50, 0.4, 0.4); } areaHarm(at, spell.r, spell, k, spell.dmg, null); magicSound('void', 0.2); } });
		},
		cloud(spell, k) {
			const { at } = aimPoint(spell.range);
			const L = lookOf(spell);
			effects.push({ t: 0, life: spell.t, every: 0.5,
				step() {
					if (L.tick) L.tick(fx, at, spell.r, now());
					else for (let n = 0; n < (isPhone ? 6 : 14); n++) { const a = Math.random() * 6.283, r = spell.r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * r, at.y + 0.3 + Math.random() * 1.5, at.z + Math.sin(a) * r, 0, 0.2, 0, 1.6, 0.9, 1.6, GLOW.blight, 0.35, 0, 0.5); }
					for (const x of hostilesNear(at, spell.r, struck)) { harm(x.T, spell.dps * 0.5 * k, spell, at); hex(x.T, spell.status, k, spell.id); }
				} });
		},
		zone(spell, k) {
			const at = { x: camera.position.x, y: camera.position.y - EYE, z: camera.position.z };
			const L = lookOf(spell);
			effects.push({ t: 0, life: spell.t, every: 0.5,
				step() {
					if (L.tick) L.tick(fx, at, spell.r, now()); else fx.ring(at, spell.r, GLOW.restoration, 24, 0.5, 0.25);
					const e = camera.position;
					if (Math.hypot(e.x - at.x, e.z - at.z) < spell.r) combat.mend(spell.heal * 0.5 * k);
					for (const x of hostilesNear(at, spell.r, struck)) hex(x.T, spell.status, k, spell.id);
				} });
		},
		storm(spell, k) {
			const { at } = aimPoint(spell.range);
			for (const F of combat.firesNear(at.x, at.z, spell.douse)) combat.douse(F.id, 60);
			const L = lookOf(spell);
			effects.push({ t: 0, life: spell.t, every: spell.t / spell.strikes,
				step() {
					const tgt = nearestHostile(at, spell.r);
					const a = Math.random() * 6.283, r = Math.random() * spell.r;
					const p = tgt && Math.random() < 0.7 ? { x: tgt.bound.x, y: tgt.bound.y - 0.9, z: tgt.bound.z } : { x: at.x + Math.cos(a) * r, y: 0, z: at.z + Math.sin(a) * r };
					if (!tgt) p.y = combat.ground(p.x, p.z, at.y + 30);
					const top = { x: p.x + (Math.random() - 0.5) * 6, y: p.y + (L.strike ? 15 : 45), z: p.z + (Math.random() - 0.5) * 6 };
					if (L.strike) L.strike(fx, top, p);
					else { fx.line(top, p, GLOW.storm, 0.9, 0.22, 0.4, 3.5); fx.burst(p, GLOW.storm, 20, 6, 0.4, 0.3, 1); }
					for (const x of hostilesNear(p, 3, struck)) harm(x.T, spell.dmg * k, spell, p);
					combat.shake?.(0.08); magicSound('storm', 0.1);
				} });
			// (the rain under it)
			// (and the thunderhead over it)
			effects.push({ t: 0, life: spell.t, every: 0.05, step() { if (L.rain) { L.rain(fx, at, spell.r); L.cloud?.(fx, at, spell.r); } else for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, r = spell.r * Math.sqrt(Math.random()); fx.emit(at.x + Math.cos(a) * r, at.y + 14, at.z + Math.sin(a) * r, 0, -16, 0, 0.9, 0.06, 0.04, [0.5, 0.65, 0.8], 0.6, 0, 0); } } });
		},
		heal(spell, k) { const n = combat.mend(spell.heal * k); if (!LOOK[spell.id]?.self) fx.burst({ x: camera.position.x, y: camera.position.y - 0.8, z: camera.position.z }, GLOW.restoration, 30, 1.2, 0.9, 0.2, 1.4); if (!n) hint('You are not hurt.', 1400); },
		hot(spell, k) { buff.hots.push({ left: spell.t, rate: spell.heal * k / spell.t }); },
		shield(spell, k) { buff.shield = spell.absorb * (spell.absorb > 1e5 ? 1 : k); buff.shieldUntil = now() + spell.t; },
		deathward(spell) { buff.deathUntil = now() + spell.t; buff.deathHeal = spell.heal; },
		aura(spell, k) {
			effects.push({ t: 0, life: spell.t, every: 0.25,
				step() {
					const c = { x: camera.position.x, y: camera.position.y - 1, z: camera.position.z };
					if (LOOK[spell.id]?.tick) LOOK[spell.id].tick(fx, { x: c.x, y: c.y - 0.6, z: c.z }, spell.r, now());
					else for (let n = 0; n < 8; n++) { const a = Math.random() * 6.283; fx.emit(c.x + Math.cos(a) * spell.r, c.y + Math.random(), c.z + Math.sin(a) * spell.r, 0, 0.8, 0, 0.5, 0.25, 0.05, GLOW.radiance, 0.8, 0, 0); }
					for (const x of hostilesNear(c, spell.r, struck)) harm(x.T, spell.dps * 0.25 * k, spell, c);
				} });
		},
		buff(spell) {
			buff.moves.push({ until: now() + spell.t, speedK: spell.speedK || 1, jumpK: spell.jumpK || 1, fallK: spell.fallK || 1, waterWalk: !!spell.waterWalk });
			if (spell.cdK) buff.quickUntil = now() + spell.t;
		},
		cloak(spell) { buff.cloakUntil = now() + spell.t; },
		light(spell) { if (buff.lightUntil > now()) { buff.lightUntil = 0; return 'off'; } buff.lightUntil = now() + spell.t; },
		sight(spell) { buff.sightUntil = now() + spell.t; buff.sightWhat = spell.what; buff.sightR = spell.r; if (spell.night) buff.nightUntil = now() + spell.t; },
		pact(spell) {
			const v = combat.vitals();
			if (v.hp <= v.max * spell.hp + 1) { hint('You have too little life to give.', 2000); return 'refund'; }
			combat.hurtPlayer({ amount: v.max * spell.hp, type: 'energy', part: 'torso', pact: true, quiet: true });
			state.mana = manaMax(state); buff.pactUntil = now() + spell.t; buff.pactK = spell.power;
		},
		summon(spell, k) {
			for (let n = 0; n < spell.n; n++) shades.push({ spell, k, until: now() + spell.t, a: n / spell.n * 6.283, cool: 0.5 + n * 0.3, pos: camera.position.clone(), look: lookOf(spell) });
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
			// (gone in smoke here; the look's own puff comes again where you land, after the cast)
			lookOf(spell).self?.(fx, p.pos);
			teleport(to.x, to.y, to.z);
		},
		recall(spell, k, o) {
			const p = P(); if (!p) return 'refund';
			const w = worldKey();
			if (!state.mark || state.mark.w !== w || o.shift) {
				state.mark = { x: p.pos.x, y: p.pos.y, z: p.pos.z, w };
				hint('The weave is marked here. Cast again to return.', 2500);
				return 'cheap';
			}
			lookOf(spell).self?.(fx, p.pos);
			teleport(state.mark.x, state.mark.y, state.mark.z);
		},
		gate() {
			const sd = seed(), list = state.wells.filter((q) => q.seed === sd);
			if (!list.length) { hint('You have found no aether well in this world yet. Look for a bright spring of light or dark.', 3500); return 'refund'; }
			const W0 = list[gateI++ % list.length];
			teleport(W0.x + 2.5, combat.ground(W0.x + 2.5, W0.z, W0.y + 3) + EYE, W0.z);
			hint(`Through the light to a ${W0.strand} well (${(gateI - 1) % list.length + 1} of ${list.length}).`, 2500);
		},
		rewind(spell) {
			const t0 = now() - 5, S = history.find((q) => q.t >= t0) || history[0];
			if (!S) return 'refund';
			// (the way back drawn as you go: every place of the last five seconds)
			lookOf(spell).self?.(fx, camera.position, history.filter((q) => q.t >= t0));
			teleport(S.x, S.y, S.z);
			const v = combat.vitals();
			if (S.hp > v.hp) combat.mend(S.hp - v.hp);
		},
		stasis(spell) {
			const { T } = aimPoint(spell.range);
			if (!T) { hint('Nothing there to hold.', 1200); return 'refund'; }
			if (T.kind !== 'hostile') { hint(T.kind === 'boss' ? 'It is too vast to hold in time.' : 'Stasis holds only those who fight.', 1600); return 'refund'; }
			hex(T, { hold: spell.t }, 1, spell.id);
		},
		douse(spell) {
			const e = camera.position, list = combat.firesNear(e.x, e.z, spell.r);
			for (const F of list) combat.douse(F.id, 60);
			const L = lookOf(spell), at = { x: e.x, y: e.y, z: e.z };
			effects.push({ t: 0, life: 4, every: 0.04, step() { if (L.rain) L.rain(fx, at, 18); else for (let n = 0; n < 6; n++) { const a = Math.random() * 6.283, r = 18 * Math.sqrt(Math.random()); fx.emit(e.x + Math.cos(a) * r, e.y + 12, e.z + Math.sin(a) * r, 0, -15, 0, 1, 0.05, 0.04, [0.55, 0.7, 0.85], 0.6, 0, 0); } } });
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
	// cast a spell by its id: true if it was cast (o.shift: Shift held)
	function cast(id, o = {}) {
		const spell = SPELL[id], t = now();
		const why = castBlock(state, id, t);
		if (why) { hint(why, 1400); magicSound('fizzle', 0.06); return false; }
		const k = spellPower(state, spell, { light: light(), pact: buff.pactUntil > t ? buff.pactK || 1.5 : 1 });
		const out = DO[spell.kind]?.(spell, k, o);
		if (out === 'refund') return false;
		spend(state, id, t, buff.quickUntil > t ? 3 : 1);
		// (marking costs little; letting a light go costs nothing)
		if (out === 'cheap' || out === 'off') { state.mana += Math.round(spell.mana * (out === 'off' ? 1 : 0.75)); state.cds[id] = t + 1; }
		// (any harm you do shows you: the cloak is gone)
		if (spell.dmg || spell.dps) buff.cloakUntil = 0;
		const c = GLOW[spell.school], L = lookOf(spell);
		if (L.cast) L.cast(fx, hand(_p)); else fx.burst(hand(_p), c, 14, 1.4, 0.35, 0.16, 0.2);
		// (on your body: a heal, a ward, a pact; and its look while it lasts)
		if (L.self && SELF_AFTER.has(spell.kind)) L.self(fx, camera.position);
		if (L.on) buff.looks.set(id, { until: t + (spell.t || 600), on: L.on, alive: ALIVE[spell.kind] || (() => true) });
		magicSound(spell.school);
		return true;
	}
	// let go of a held spell (a beam)
	function release(id) { held.delete(id); }
	// (kinds whose look is drawn on you once cast; a blink, a recall and a rewind draw their own)
	const SELF_AFTER = new Set(['heal', 'hot', 'shield', 'deathward', 'cloak', 'sight', 'pact', 'summon', 'blink', 'gate', 'daybreak', 'recall', 'buff']);
	// (and while a buff's look lasts: as long as the buff does)
	const ALIVE = {
		shield: () => buff.shield > 0 && buff.shieldUntil > now(), deathward: () => buff.deathUntil > now(), cloak: () => buff.cloakUntil > now(),
		light: () => buff.lightUntil > now(), pact: () => buff.pactUntil > now(), hot: () => buff.hots.length > 0,
	};

	// ---------- each frame ----------
	function stepBolts(dt) {
		for (let i = bolts.length - 1; i >= 0; i--) {
			const B = bolts[i], spell = B.spell;
			B.life -= dt;
			if (B.life <= 0) { bolts.splice(i, 1); continue; }
			const step = B.vel.length() * dt;
			_d.copy(B.vel).normalize();
			const h = combat.firstHit(B.pos, _d, step, combat.me);
			const c = GLOW[spell.school], L = B.look || {};
			// (its trail)
			if (L.trail) L.trail(fx, B.pos, _d, step);
			else for (let n = 0; n < 3; n++) fx.emit(B.pos.x - _d.x * step * n / 3, B.pos.y - _d.y * step * n / 3, B.pos.z - _d.z * step * n / 3, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, 0.28, n ? 0.18 : 0.32, 0.04, c, 1, 0, 0);
			if (h) {
				const at = B.pos.clone().addScaledVector(_d, h.t);
				if (h.T && !h.ward) { harm(h.T, (B.dmg ?? spell.dmg) * B.k, spell, at, _d); hex(h.T, spell.status, B.k, spell.id); }
				if (L.hit) L.hit(fx, at, _d); else fx.burst(at, c, 16, 3, 0.4, 0.22, 0.6);
				if (spell.splash) { fx.ring(at, spell.splash, c, 24, 0.35, 0.3); areaHarm(at, spell.splash, spell, B.k, spell.dmg * 0.6, null); }
				if (spell.ignite) combat.igniteAt(at.x, at.z, 5);
				if (spell.pierce && h.T && !B.pierced) { B.pierced = true; B.pos.copy(at).addScaledVector(_d, 0.6); continue; }
				bolts.splice(i, 1);
				continue;
			}
			B.pos.addScaledVector(B.vel, dt);
		}
	}
	function stepBeams(dt, keysHeld) {
		for (const [id, H] of held) {
			const spell = H.spell;
			H.t -= dt;
			if (H.t <= 0 || !keysHeld(id)) { held.delete(id); continue; }
			const from = hand(new THREE.Vector3());
			aim(_o, _d);
			const h = combat.firstHit(_o, _d, spell.range, combat.me), end = _o.clone().addScaledVector(_d, h ? h.t : spell.range);
			const c = GLOW[spell.school], L = lookOf(spell);
			if (L.beam) L.beam(fx, from, end, now());
			else { fx.line(from, end, c, isPhone ? 1.2 : 0.6, 0.06, spell.drain ? 0.18 : 0.28, 0.05); fx.burst(end, c, 2, 1.5, 0.25, 0.2, 0.3); }
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
			if (S.look?.body) S.look.body(fx, S.pos, t);
			else { fx.emit(S.pos.x, S.pos.y, S.pos.z, 0, 0.1, 0, 0.3, 0.38, 0.1, GLOW.umbral, 0.9, 0, 0); fx.emit(S.pos.x + (Math.random() - 0.5) * 0.3, S.pos.y, S.pos.z + (Math.random() - 0.5) * 0.3, 0, -0.3, 0, 0.6, 0.15, 0.02, [0.2, 0.1, 0.35], 1, 0, 0); }
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
			p.speedK = sk; p.jumpK = jk; p.fallK = fk; p.waterWalk = ww;
		}
		// (quickened: every cooldown runs three times as fast)
		if (buff.quickUntil > t) for (const id of Object.keys(state.cds)) state.cds[id] -= dt * 2;
		if (buff.shieldUntil <= t) buff.shield = 0;
		// the looks of what lasts on you (the small sun at your shoulder, a ward, petals, smoke)
		if (buff.looks.size) {
			aim(_o, _d);
			const moving = !!p && Math.hypot(p.vel?.x || 0, p.vel?.z || 0) > 0.5;
			for (const [id, B] of buff.looks) {
				if (B.until <= t || !B.alive()) { buff.looks.delete(id); continue; }
				B.on(fx, camera.position, t, _d, moving);
			}
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
		// (where you were, for a rewind)
		histT -= dt;
		const p = P();
		if (histT <= 0 && p) { histT = 0.25; history.push({ t, x: p.pos.x, y: p.pos.y, z: p.pos.z, hp: combat.vitals().hp }); while (history.length && history[0].t < t - 6) history.shift(); }
		stepBolts(dt); stepBeams(dt, keysHeld); stepEffects(dt); stepShades(dt, t); stepHexes(dt); stepKnocks(dt); stepBuffs(dt, t);
	}
	function clear() { bolts.length = effects.length = shades.length = knocks.length = 0; held.clear(); buff.looks.clear(); for (const T of hexed.keys()) T.hex = null; hexed.clear(); history.length = 0; }
	return {
		cast, release, update, clear, shieldBlow, exposure,
		cloaked: () => buff.cloakUntil > now(),
		sighting: () => buff.sightUntil > now(),
		sightWhat: () => (buff.sightUntil > now() ? buff.sightWhat : null),
		setCursor: (c) => { cursor = c; },
		info: () => ({ bolts: bolts.length, effects: effects.length, shades: shades.length, hexed: hexed.size, held: [...held.keys()], shield: Math.round(buff.shield), cloak: buff.cloakUntil > now(), mana: Math.round(state.mana), max: manaMax(state) }),
		strandOf, SCHOOLS,
	};
}
