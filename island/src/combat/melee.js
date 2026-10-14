// Fists for the unarmed, yours and the townsfolk's (combat/brawl.js has the rules).
//
// You: with nothing in your hands, the left button (or Q, or the Punch button on a touch
// screen) throws a jab, a cross and a hook in a string; held Q grabs whoever is in front of you
// and throws them; X still shoves (people/self.js). A bat or a bottle someone dropped is picked
// up as you walk over it and swung instead. Someone you hit may run, or may square up and hit
// back. In the street now and then two grown-ups fall out: words, a shove, fists, a bottle off a
// table; most cool off, some go down. The police are called when fists fly (military/police.js),
// and among the armed it can end in gunfire, when the squads take over. Children are never part
// of any of it: never struck, never a brawler (the Spark, combat/targets.js).

import * as THREE from 'three';
import { BLOWS, nextBlow, canMelee, canBrawl, escalate, improvised, blowDamage, brawlResponse, stageIndex } from './brawl.js';
import { isMinor } from './targets.js';
import { soundBus, noise } from '../world/soundbus.js';

const LINES = {
	words: ['You got a problem?', 'Back off!', 'Say that again.', 'Walk away, man.', 'Don\'t push me!', 'What did you just say?'],
	fists: ['That\'s it!', 'Come on then!', 'Hey! Break it up!', 'Somebody call the police!'],
	weapon: ['He\'s got a bottle!', 'Put it down!', 'Whoa, whoa, whoa!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3(), _f = new THREE.Vector3();

export function createMelee(ctx) {
	const { camera, mount, touch } = ctx;
	const ME = { id: 'me', kind: 'player', faction: 'player' };
	const brawls = [];
	const drops = [];
	const me = { item: null, uses: 0, last: null, lastT: 9, cool: 0, guardT: 0, holdQ: 0, held: null, holdT: 0, swing: 0, blow: null };
	let startT = 70 + Math.random() * 60, lineT = 0;

	// ---------- the fists you see ----------
	const view = new THREE.Group(); view.name = 'melee-fists'; view.visible = false;
	const skin = new THREE.MeshStandardMaterial({ color: 0xc8916c, roughness: 0.6 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.85 });
	const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.55 }), glass = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 });
	const fistGeo = new THREE.SphereGeometry(1, 12, 9).scale(0.045, 0.05, 0.06), armGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.36, 10).rotateX(Math.PI / 2).translate(0, 0, 0.2);
	const fists = [-1, 1].map((s) => { const g = new THREE.Group(); g.add(new THREE.Mesh(fistGeo, skin)); g.add(new THREE.Mesh(armGeo, sleeve)); g.userData.s = s; view.add(g); return g; });
	const batGeo = new THREE.CylinderGeometry(0.03, 0.016, 0.84, 10).translate(0, 0.42, 0), bottleGeo = new THREE.LatheGeometry([[0, 0], [0.034, 0], [0.036, 0.16], [0.016, 0.22], [0.012, 0.3], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
	const heldBat = new THREE.Mesh(batGeo, wood), heldBottle = new THREE.Mesh(bottleGeo, glass);
	fists[1].add(heldBat, heldBottle); heldBat.rotation.x = -1.1; heldBottle.rotation.x = -1.4; heldBat.visible = heldBottle.visible = false;
	camera.add(view);
	function showView(dt) {
		const on = ctx.active() && !ctx.armed() && (me.guardT > 0 || me.item) && !ctx.driving?.();
		if (on && !camera.parent) ctx.scene?.add(camera);
		view.visible = on;
		if (!on) return;
		me.swing = Math.max(0, me.swing - dt);
		const k = me.blow ? BLOWS[me.blow].time : 0.4, u = me.swing > 0 ? 1 - me.swing / k : 1, punch = Math.sin(Math.min(1, u) * Math.PI);
		const lead = me.blow === 'jab' ? 0 : 1;
		fists.forEach((g, i) => {
			const s = g.userData.s, out = i === lead && me.blow !== 'shove' && me.blow !== 'grapple' ? punch : me.blow === 'shove' || me.blow === 'grapple' ? punch * 0.8 : 0;
			g.position.set(s * (0.16 - out * 0.08), -0.2 + out * 0.08, -0.36 - out * 0.32);
			g.rotation.set(0.15, s * (0.2 - (me.blow === 'hook' && i === lead ? punch * 0.9 : 0)), 0);
		});
		heldBat.visible = me.item === 'bat'; heldBottle.visible = me.item === 'bottle';
		if (me.item) { const g = fists[1]; g.position.set(0.2, -0.24 + punch * 0.12, -0.42 - punch * 0.12); g.rotation.set(0.3 - punch * 1.6, -0.3 + punch * 0.9, 0); fists[0].position.set(-0.18, -0.26, -0.38); }
	}

	// ---------- sound ----------
	function thud(at, hard = 1, kind = 'thud') {
		try {
			if (at && Math.hypot(at.x - ctx.eye().x, at.z - ctx.eye().z) > 60) return;
			const B = soundBus(); if (!B) return;
			const c = B.ctx, t = c.currentTime, g = c.createGain(), n = c.createBufferSource(), f = c.createBiquadFilter();
			n.buffer = noise(c, kind === 'glass' ? 'white' : 'pink');
			f.type = kind === 'glass' ? 'highpass' : 'lowpass'; f.frequency.value = kind === 'glass' ? 2500 : 700 + hard * 300;
			g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * hard, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'glass' ? 0.4 : 0.16));
			n.connect(f).connect(g).connect(B.out); n.start(t, Math.random() * 3); n.stop(t + 0.5);
			const o = c.createOscillator(), og = c.createGain();
			o.frequency.setValueAtTime(kind === 'glass' ? 2200 : 110, t); o.frequency.exponentialRampToValueAtTime(kind === 'glass' ? 1400 : 50, t + 0.12);
			og.gain.setValueAtTime(0.25 * hard, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
			o.connect(og).connect(B.out); o.start(t); o.stop(t + 0.2);
			n.onended = () => { n.disconnect(); f.disconnect(); g.disconnect(); o.disconnect(); og.disconnect(); };
		} catch { /* no audio */ }
	}

	// ---------- who is who ----------
	// a target's body and motion: a townsperson (people pool) or a squad member
	function bodyOf(T) {
		if (!T) return null;
		if (T.ref?.body) return { kind: 'squad', h: T.ref, P: T.ref.body.P, M: T.ref.body.M, T };
		if (T.P) { const p = (ctx.people()?.pool || []).find((q) => q.P === T.P); if (p) return { kind: 'person', p, P: p.P, M: p.M, T }; }
		return null;
	}
	// the one in front of you within reach
	function inFront(reach) {
		const e = ctx.eye(); camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
		let best = null, bd = reach + 0.45;
		for (const T of ctx.layer.map.values()) {
			if (T.kind !== 'person' && T.kind !== 'hostile') continue;
			if (!T.P && !T.ref?.body) continue;
			const dx = T.bound.x - e.x, dz = T.bound.z - e.z, d = Math.hypot(dx, dz);
			if (d > bd || Math.abs(T.bound.y - (e.y - 0.7)) > 1.6) continue;
			if ((dx * _f.x + dz * _f.z) / (d || 1) < 0.55) continue;
			bd = d; best = T;
		}
		return best;
	}
	// knocked down (a ragdoll, if one is free) and back up a little later
	function knockDown(b, dir, power) {
		const P = b.P;
		if (!P || P.ragdoll || isMinor(P)) return;
		const q = b.M.S.pos;
		ctx.ragdolls.hit(P, { vel: new THREE.Vector3(dir.x, 0.15, dir.z).normalize().multiplyScalar(power), mass: 90, point: new THREE.Vector3(q.x, q.y + 1.25, q.z), lift: 0.02 }, (Pd) => {
			setTimeout(() => {
				if (!Pd.ragdoll || b.dead) return;
				const at = Pd.bones[Pd.map.root].getWorldPosition(new THREE.Vector3());
				ctx.ragdolls.release(Pd);
				b.M.place(at.x, ctx.ground(at.x, at.z, at.y + 1), at.z, b.M.S.heading);
			}, 2200);
		});
	}

	// ---------- your blows ----------
	function swing(kind) {
		if (me.cool > 0 || !ctx.active() || ctx.armed() || ctx.down()) return false;
		const B = BLOWS[kind];
		me.cool = B.time; me.swing = B.time; me.blow = kind; me.guardT = 3; me.last = kind; me.lastT = 0;
		ctx.avatar?.()?.M?.play(kind === 'bat' || kind === 'bottle' ? 'swing' : kind === 'grapple' ? 'grab' : kind, B.time);
		const T = inFront(B.reach);
		if (!T) return true;
		if (!canMelee(T) || T.child) { if (T.child) ctx.ward?.(T); return true; }
		const e = ctx.eye(), dir = _v.set(T.bound.x - e.x, 0, T.bound.z - e.z).normalize().clone();
		const head = kind === 'hook' || (kind === 'cross' && Math.random() < 0.4);
		const r = ctx.deal(T, { amount: blowDamage(kind, 100, Math.random() < 0.15), type: 'impact', part: head ? 'head' : 'torso', src: e.clone(), dir: { x: dir.x, y: 0, z: dir.z }, by: ME, melee: kind }, true);
		if (!r || r.ignored) return true;
		thud(T.bound, kind === 'hook' || B.item ? 1.3 : 0.9);
		ctx.fx?.dust?.({ x: T.bound.x, y: T.bound.y + 0.3, z: T.bound.z }, 3, 0.6, 0.55, 0.5, 0.25, 0.25);
		const b = bodyOf(T);
		if (b && !r.killed) {
			if (B.knock >= 3 || (b.kind === 'squad' && b.h.H.hp < b.h.H.max * 0.3)) knockDown(b, dir, B.knock * 1.2);
			else b.M.play('reel', 0.6);
			// they may stand and fight: a townsperson squares up (or runs), a fighter turns on you
			if (b.kind === 'person') answer(b);
		}
		if (B.breaks && ++me.uses >= 2) { thud(T.bound, 1, 'glass'); me.item = null; me.uses = 0; ctx.hint('The bottle shatters.', 1400, 1); }
		ctx.heard?.(T.bound);
		return true;
	}
	function grapple() {
		if (me.held) {
			// thrown, the way you face
			const b = me.held; me.held = null;
			camera.getWorldDirection(_f); _f.y = 0; _f.normalize();
			knockDown(b, _f, 5);
			ctx.deal(b.T, { amount: BLOWS.grapple.dmg * 2, type: 'impact', part: 'torso', src: ctx.eye().clone(), by: ME, melee: 'grapple' }, true);
			thud(b.M.S.pos, 1.4);
			me.blow = 'shove'; me.swing = 0.45;
			return;
		}
		const T = inFront(BLOWS.grapple.reach);
		if (!T || !canMelee(T)) return;
		const b = bodyOf(T);
		if (!b || b.P.ragdoll) return;
		me.held = b; me.holdT = 3; me.blow = 'grapple'; me.swing = 0.6; me.guardT = 3;
		ctx.deal(T, { amount: BLOWS.grapple.dmg, type: 'impact', part: 'torso', src: ctx.eye().clone(), by: ME, melee: 'grapple' }, true);
		b.M.play('reel', 0.8);
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
		for (const f of [A, B]) if (f.kind === 'person') steer(f, q);
		return q;
	}
	// a townsperson's steering while they fight: toward their opponent, squaring up
	function steer(f, q) {
		const p = f.b.p;
		p.engaged = false;
		p.override = (pp) => {
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
	function answer(b) {
		if (brawls.some((q) => !q.done && (q.A.b?.P === b.P || q.B.b?.P === b.P))) return;
		const f = fighter(b);
		if (f.temper < 0.55 || isMinor(b.P)) return;
		const q = startBrawl(f, you(), 'fists');
		q.heat = 0.8;
		ctx.call?.(pick(LINES.fists), 'bystander');
	}
	// a blow between fighters (one of them may be you)
	function land(q, from, to, kind) {
		const at = posOf(to), src = posOf(from);
		const dmg = blowDamage(kind, 100 - (from.blows || 0) * 4, Math.random() < 0.12);
		if (to.kind === 'player') {
			ctx.hurtPlayer({ amount: dmg * 0.8, type: 'impact', part: 'torso', src: { x: src.x, y: src.y + 1.4, z: src.z } });
		} else if (to.kind === 'squad') {
			ctx.deal(to.b.T, { amount: dmg, type: 'impact', part: 'torso', src, by: from.kind === 'squad' ? from.b.h.T : null, melee: kind }, false);
		} else {
			to.hp -= dmg;
			to.b.M.play('reel', 0.55);
		}
		thud(at, kind === 'bat' ? 1.4 : 1);
		if (kind === 'bottle' && Math.random() < 0.6) { thud(at, 1, 'glass'); from.item = null; }
		if (to.kind !== 'player' && (to.hp <= 15 || BLOWS[kind].knock >= 3.4 && Math.random() < 0.5)) {
			const dir = _v.set(at.x - src.x, 0, at.z - src.z).normalize().clone();
			knockDown(to.b, dir, BLOWS[kind].knock * 1.3);
			if (to.hp <= 15) { to.down = true; q.done = true; if (to.item) drop(to.item, at); }
		}
		q.blow = dmg; q.heat = Math.min(1, q.heat + dmg / 60);
	}
	function stepBrawl(q, dt) {
		q.t += dt; q.tick -= dt;
		for (const f of [q.A, q.B]) {
			if (f.kind === 'person' && (!f.b.p.active || !f.b.P.root.visible)) q.done = true;
			if (f.kind === 'squad' && f.b.h.dead) q.done = true;
		}
		if (q.A.kind === 'player' || q.B.kind === 'player') { if (ctx.down()) q.done = true; }
		const dA = posOf(q.A), dB = posOf(q.B), d = Math.hypot(dA.x - dB.x, dA.z - dB.z);
		if (d > 25) q.done = true;
		if (q.done) return;
		// up the ladder, or down it
		if (q.tick <= 0) {
			q.tick = 1.6 + Math.random();
			const was = q.stage;
			q.stage = escalate({ stage: q.stage, heat: q.heat, temper: Math.max(q.A.temper ?? 0.6, q.B.temper ?? 0.6), armed: q.armed, friends: 0, blow: q.blow || 0, t: q.t }, Math.random);
			q.blow = 0;
			if (q.stage !== was) {
				q.t = 0;
				const mid = { x: (dA.x + dB.x) / 2, z: (dA.z + dB.z) / 2 };
				if (q.stage === 'calm') { q.done = true; return; }
				if (q.stage === 'guns' && !q.armed) q.stage = 'weapon';
				if (q.stage === 'weapon') for (const f of [q.A, q.B]) if (f.kind !== 'player' && !f.item) { f.item = improvised(null); if (f.item) ctx.call?.(pick(LINES.weapon), 'bystander'); }
				const R = brawlResponse(q.stage);
				if (R.police) { ctx.civilians?.alarm(mid.x, mid.z, 12); ctx.event?.({ kind: 'brawl', x: mid.x, z: mid.z, stage: q.stage, severity: R.severity }); }
				if (stageIndex(q.stage) >= 3 && lineT <= 0) { lineT = 6; ctx.call?.(pick(LINES.fists), 'bystander'); }
			}
		}
		// each fighter acts
		for (const f of [q.A, q.B]) {
			if (f.kind === 'player' || f.down) continue;
			const o = f === q.A ? q.B : q.A, M = f.b.M;
			f.blowT -= dt; f.lastT += dt;
			if (q.stage === 'words') {
				if (f.blowT <= 0) { f.blowT = 1.2 + Math.random() * 1.6; M.gesture(Math.random() < 0.5 ? 'emphatic' : 'point'); M.feel?.('anger', 0.8); if (q.said++ < 3 && lineT <= 0 && d < 40) { lineT = 3; ctx.call?.(pick(LINES.words), 'bystander'); } }
				continue;
			}
			if (d > 1.5 || f.blowT > 0) continue;
			let kind = q.stage === 'shove' ? 'shove' : f.item || nextBlow(f.last, f.lastT);
			if (q.stage === 'fists' && Math.random() < 0.15) kind = 'shove';
			const B = BLOWS[kind];
			f.blowT = B.time + 0.35 + Math.random() * 0.7; f.last = kind; f.lastT = 0; f.blows++;
			M.play(kind === 'bat' || kind === 'bottle' ? 'swing' : kind, B.time);
			const hit = Math.random() < (o.kind === 'player' ? 0.55 : 0.68);
			setTimeout(() => { if (!q.done && hit && Math.hypot(posOf(f).x - posOf(o).x, posOf(f).z - posOf(o).z) < B.reach + 0.4) land(q, f, o, kind); }, B.time * 450);
		}
		// held items in their hands
		for (const f of [q.A, q.B]) if (f.kind !== 'player') handItem(f);
	}
	// a bat or bottle in a brawler's right hand
	const handMeshes = new Map();
	function handItem(f) {
		let m = handMeshes.get(f);
		if (!f.item) { if (m) { m.removeFromParent(); handMeshes.delete(f); } return; }
		if (m && m.userData.kind === f.item) return;
		if (m) m.removeFromParent();
		const bone = f.b.P.bones[f.b.P.map['wrist.R']];
		if (!bone) return;
		m = new THREE.Mesh(f.item === 'bat' ? batGeo : bottleGeo, f.item === 'bat' ? wood : glass);
		m.userData.kind = f.item;
		const s = new THREE.Vector3(); bone.getWorldScale(s);
		m.scale.set(1 / s.x, 1 / s.y, 1 / s.z); m.position.set(0, 0.08 / s.y, 0);
		bone.add(m); handMeshes.set(f, m);
	}
	// a dropped bat or bottle, lying where it fell, to be picked up
	function drop(kind, at) {
		const m = new THREE.Mesh(kind === 'bat' ? batGeo : bottleGeo, kind === 'bat' ? wood : glass);
		m.position.set(at.x + 0.4, ctx.ground(at.x, at.z, at.y + 1) + 0.04, at.z); m.rotation.set(Math.PI / 2, 0, Math.random() * 6.28);
		ctx.group.add(m); drops.push({ kind, m, t: 0 });
	}
	function pickups(dt) {
		const e = ctx.eye();
		for (let i = drops.length - 1; i >= 0; i--) {
			const D = drops[i]; D.t += dt;
			if (D.t > 120) { D.m.removeFromParent(); drops.splice(i, 1); continue; }
			if (!me.item && !ctx.armed() && Math.hypot(D.m.position.x - e.x, D.m.position.z - e.z) < 1.3 && Math.abs(D.m.position.y - (e.y - 1.6)) < 1.2) {
				me.item = D.kind; me.uses = 0; D.m.removeFromParent(); drops.splice(i, 1);
				ctx.hint(`You pick up the ${D.kind}. Swing it as you would your fists.`, 2200, 1);
			}
		}
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

	// ---------- input ----------
	const canvas = mount.querySelector('canvas');
	const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || window._KEYS_PLAY_ON;
	addEventListener('pointerdown', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.pointerType !== 'mouse' || (canvas && e.target !== canvas)) return;
		if (canvas?.requestPointerLock && document.pointerLockElement !== canvas) return;
		if (!ctx.active() || ctx.armed()) return;
		swing(me.item || nextBlow(me.last, me.lastT));
	});
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || typing() || !ctx.active() || ctx.armed()) return;
		if (ctx.realmArmed?.()) return;
		if (e.key === 'q' || e.key === 'Q') { me.holdQ = performance.now(); e.preventDefault(); }
	});
	addEventListener('keyup', (e) => {
		if ((e.key !== 'q' && e.key !== 'Q') || !me.holdQ) return;
		const held = performance.now() - me.holdQ; me.holdQ = 0;
		if (!ctx.active() || ctx.armed()) return;
		if (held > 420 || me.held) grapple(); else swing(me.item || nextBlow(me.last, me.lastT));
	});
	let btn = null;
	if (touch) {
		btn = document.createElement('button');
		btn.type = 'button'; btn.textContent = 'Punch'; btn.setAttribute('aria-label', 'Punch');
		btn.dataset.hud = 'action 30';
		btn.style.cssText = 'position:absolute;right:calc(16px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 160px + env(safe-area-inset-bottom));width:68px;height:68px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(8,20,26,.55);color:#eafaf6;font:600 13px system-ui;display:none;touch-action:none;';
		let downAt = 0;
		btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); downAt = performance.now(); });
		btn.addEventListener('pointerup', (e) => { e.stopPropagation(); if (performance.now() - downAt > 450 || me.held) grapple(); else swing(me.item || nextBlow(me.last, me.lastT)); });
		btn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
		mount.appendChild(btn);
	}

	// ---------- each frame ----------
	function update(dt) {
		me.cool = Math.max(0, me.cool - dt); me.lastT += dt; me.guardT = Math.max(0, me.guardT - dt); lineT -= dt;
		showView(dt);
		holding(dt);
		pickups(dt);
		ambient(dt);
		for (let i = brawls.length - 1; i >= 0; i--) {
			const q = brawls[i];
			stepBrawl(q, dt);
			if (q.done) {
				for (const f of [q.A, q.B]) { if (f.kind === 'person' && !f.down) { f.b.p.override = null; f.b.M.act(null); } f.item = null; handItem(f); }
				brawls.splice(i, 1);
			}
		}
		if (btn) { const show = ctx.active() && !ctx.armed() && !ctx.driving?.() ? '' : 'none'; if (btn.style.display !== show) btn.style.display = show === '' ? 'block' : 'none'; }
	}
	function clear() {
		for (const q of brawls) { q.done = true; for (const f of [q.A, q.B]) { if (f.kind === 'person') { f.b.p.override = null; f.b.M.act(null); } f.item = null; handItem(f); } }
		brawls.length = 0;
		for (const D of drops) D.m.removeFromParent();
		drops.length = 0; me.held = null; me.item = null;
	}
	const info = () => ({ item: me.item, holding: !!me.held, last: me.last, brawls: brawls.map((q) => ({ stage: q.stage, a: q.A.kind, b: q.B.kind, hp: [Math.round(q.A.hp ?? 100), Math.round(q.B.hp ?? 100)] })), drops: drops.length, nextIn: Math.round(startT) });
	// for the console and tests: a quarrel now between the two nearest grown-ups, a blow thrown
	function quarrel() { startT = 0; ambient(0.01); return info(); }
	// the police arrive: the fights near them end
	function calm(x, z, r = 30) { for (const q of brawls) { const a = posOf(q.A); if (Math.hypot(a.x - x, a.z - z) < r) q.done = true; } }
	return { update, clear, info, swing, grapple, quarrel, startBrawl, fighter, drop, calm, state: me };
}
