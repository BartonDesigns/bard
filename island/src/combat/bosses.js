// The set-piece bosses, their bodies and their arenas (the rules are combat/boss-defs.js and
// boss-machine.js):
//   the Lumen Leviathan   a serpent of living crystal that swims through the rock of the Deep's
//                         crystal galleries: an eye always, a heart once its crest cracks
//   the Cinder Colossus   a four-legged war machine on the ash plains of MAGMA and TOXIC
//                         worlds: break both front knees and it kneels, its core bared
//   the Stormwarden       a storm-grey gunship over the cliff settlements and the gas worlds:
//                         two engine pods, then the core when its armour ring falls
//   the Fog Mother        an old woman of fog as tall as the Golden Gate's towers, wading
//                         beside the bridge at night: her blue heart, always
// Every attack is warned first (a ring on the ground where it will land, a beam's line, a glow)
// so it can be read and dodged. Each has a big health bar, phases announced on screen, and a
// reward: Legendary gear, credits and a journal entry.

import * as THREE from 'three';
import { createBossMachine } from './boss-machine.js';
import { BOSSES } from './boss-defs.js';
import { leviathanBody } from '../creatures/leviathan.js';
import { GFX_PHONE } from '../world/device.js';
import { makeCreature } from '../creatures/models.js';
import { fogLook } from '../creatures/fog.js';
import { createCreatureVoice } from '../creatures/voice.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function glowMat(c, k = 1) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k, roughness: 0.3, metalness: 0.2 }); }

// ---------- the Lumen Leviathan ----------
function leviathan(ctx, B) {
	const N = 16, g = new THREE.Group();
	const segs = [];
	for (let i = 0; i < N; i++) segs.push({ r: 0.6 + 1.7 * Math.sin(Math.PI * (i + 1) / (N + 1)) * (i < 3 ? 1.15 : 1), p: new THREE.Vector3() });
	// (its body, head and plate: creatures/leviathan.js, from its sheet)
	const L = leviathanBody({ n: N, radii: segs.map((s) => s.r), phone: GFX_PHONE });
	g.add(L.group);
	const pts = segs.map((s) => s.p), eye = new THREE.Vector3(), heart = L.heart;
	const C = B.center;
	let a = 0, charge = null, jaw = 0, roar = 0;
	// It crawls like a snake: down on the gallery floor, its neck reared like a cobra's, its body
	// laid in S-bends that follow the path the head took. It moves in sharp bursts: a lunge, the
	// bends whipping through the body, then dead still but for small quick flicks of the head.
	const SEG = 1.3, LOOP = 13, WAVE = 10, SWAY = 2.4, REAR = 4.2;
	let wave = 0, burst = 0, hold = 0.6, speed = 0, flickIn = 0;
	const flick = new THREE.Vector3(), flickTo = new THREE.Vector3();
	const floor = (x, z) => ctx.ground(x, z, C.y + 2);
	// the head's way round its loop, swaying side to side as it goes
	const pathAt = (t, w, out) => out.set(C.x + Math.cos(t) * (LOOP + Math.sin(w) * SWAY), 0, C.z + Math.sin(t) * (LOOP + Math.sin(w) * SWAY));
	const head = pathAt(0, 0, new THREE.Vector3());
	head.y = floor(head.x, head.z) + REAR;
	// (the trail of the head on the floor, newest first: the body lies along it)
	const trail = [];
	for (let d = 0; d < N * SEG + 6; d += 0.3) trail.push(pathAt(-d / LOOP, -d / WAVE * Math.PI * 2, new THREE.Vector3()));
	let headY = head.y;
	B.parts = () => {
		const out = segs.map((s) => ({ type: 'sphere', c: s.p, r: s.r * 0.95, part: 'body' }));
		out.push({ type: 'sphere', c: eye, r: 0.55, part: 'eye' }, { type: 'sphere', c: heart.position, r: 0.9, part: 'heart' });
		return out;
	};
	B.surface = 'crystal';
	B.attack = (name, step, k) => {
		const me = ctx.eye();
		if (name === 'volley') {
			if (step === 'telegraph') { L.eyeMat.emissiveIntensity = 2 + k * 4; roar = 0.6; }
			if (step === 'attack') for (let i = 0; i < 6; i++) setTimeout(() => !B.dead && ctx.projectile({ from: head.clone(), to: me.clone().add(_v.set(rnd(-2, 2), rnd(-0.5, 1), rnd(-2, 2))), speed: 34, drop: 0, dmg: 10, type: 'pierce', owner: B.T, style: 5, splash: 0.8, hostile: true }), i * 160);
		} else if (name === 'charge') {
			if (step === 'telegraph-start') { roar = 1; const to = me.clone(); to.y -= 1.2; charge = { from: head.clone(), to: to.clone().add(to.clone().sub(head).setLength(8)), t: 0 }; ctx.fx.beam(charge.from, charge.to, 1.8, 0xb070ff, 0.5); ctx.fx.ring(to.x, ctx.ground(to.x, to.z, to.y + 1), to.z, 3, 1.8, 0xb070ff); }
			if (step === 'attack' && charge) charge.go = true;
		} else if (name === 'pulse') {
			if (step === 'telegraph-start') ctx.fx.ring(C.x, ctx.ground(C.x, C.z, C.y + 2), C.z, 15, 2, 0xc080ff, true);
			if (step === 'attack') { ctx.fx.sparks(head, 30, null, 0.8, 0.6, 1, 14); if (Math.hypot(me.x - C.x, me.z - C.z) < 15 && ctx.me().grounded) ctx.hurtPlayer({ amount: 22, type: 'energy', src: C, part: 'torso', by: B.T }); ctx.shake?.(0.5, C); }
		} else if (name === 'mites') {
			// (Shard Mites, broken out of crystal where they land: creatures/catalog.js)
			if (step === 'attack') {
				const x = C.x + rnd(-6, 6), z = C.z + rnd(-6, 6), p = _v.set(x, ctx.ground(x, z, C.y + 2) + 0.3, z);
				ctx.fx.glass(p, 16, 3, 0.16); ctx.fx.sparks(p, 16, null, 0.75, 0.55, 1, 6);
				ctx.spawnSquad('deepborn', x, z, 4, { alert: true, species: 'shard-mite', spread: 2 });
			}
		}
	};
	B.step = (dt) => {
		const M = B.mc.M, sp = (B.def.phases[M.phase].speed || 1);
		if (charge?.go) {
			// the strike: fast off the mark, the last of it a snap
			charge.t += dt / 1.2;
			const k = 1 - Math.pow(1 - Math.min(1, charge.t), 3);
			head.lerpVectors(charge.from, charge.to, k);
			headY = head.y;
			if (!charge.hit && head.distanceTo(ctx.eye()) < 3) { charge.hit = true; ctx.hurtPlayer({ amount: 30, type: 'impact', src: head.clone(), part: 'torso', by: B.T }); }
			if (charge.t >= 1) { charge = null; a = Math.atan2(head.z - C.z, head.x - C.x); }
		} else {
			// a burst: full speed at once, falling away to nothing; then still
			const fast = M.state === 'transition' ? 1.6 : 1;
			if (burst > 0) {
				burst -= dt;
				speed = 17 * sp * fast * Math.pow(Math.max(0, burst) / 0.65, 1.6);
				if (burst <= 0) hold = rnd(0.45, 1.25) / (sp * fast);
			} else {
				speed = 0;
				hold -= dt;
				if (hold <= 0) { burst = 0.65; flickTo.set(0, 0, 0); }
			}
			const ds = speed * dt;
			pathAt(a, wave, _v);
			const d = Math.hypot(_v.x - head.x, _v.z - head.z);
			// (back on its loop after a strike, it crawls to it before going round again)
			const on = d < 2.5;
			a += ds / LOOP * (on ? 1 : 0.3);
			wave += ds / WAVE * Math.PI * 2 * (on ? 1 : 0.3);
			pathAt(a, wave, _v);
			const go = Math.min(Math.hypot(_v.x - head.x, _v.z - head.z), ds * (on ? 1.2 : 1.6));
			_w.set(_v.x - head.x, 0, _v.z - head.z);
			if (_w.lengthSq() > 1e-6) head.addScaledVector(_w.normalize(), go);
			// still, it watches: the head flicks to a new angle and holds
			if (burst <= 0 && (flickIn -= dt) <= 0) { flickIn = rnd(0.18, 0.55); flickTo.set(rnd(-0.45, 0.45), rnd(-0.3, 0.35), rnd(-0.45, 0.45)); }
			flick.lerp(flickTo, Math.min(1, dt * 24));
			headY += (floor(head.x, head.z) + REAR - headY) * Math.min(1, dt * 7);
			head.y = headY;
		}
		if (Math.hypot(head.x - trail[0].x, head.z - trail[0].z) > 0.3) { const p = trail.pop(); p.set(head.x, 0, head.z); trail.unshift(p); }
		// the body along the trail, a spine point every SEG metres; the neck reared, the rest down
		let j = 0, acc = 0, from = head;
		for (let i = 0; i < N; i++) {
			const want = i * SEG, P = segs[i].p;
			if (i === 0) P.copy(head).add(flick);
			else {
				while (j < trail.length - 1) {
					const l = Math.hypot(trail[j].x - from.x, trail[j].z - from.z);
					if (acc + l >= want) { const f = (want - acc) / (l || 1); P.set(from.x + (trail[j].x - from.x) * f, 0, from.z + (trail[j].z - from.z) * f); break; }
					acc += l; from = trail[j]; j++;
				}
				if (j >= trail.length - 1) P.set(trail[j].x, 0, trail[j].z);
				const u = Math.min(1, Math.max(0, (want - SEG) / (SEG * 3.5)));
				const rear = 1 - u * u * (3 - 2 * u);
				const gy = floor(P.x, P.z) + L.radius(i / (N - 1)) * 0.85;
				P.y = gy + (Math.max(headY, gy) - gy) * rear + flick.y * rear * 0.5;
			}
		}
		// the jaw opens to roar as it winds up, and gapes through a charge
		roar = Math.max(0, roar - dt * 0.6);
		jaw += ((charge?.go ? 1 : roar > 0.2 ? 0.8 : 0.08 + Math.sin(B.time * 0.9) * 0.05) - jaw) * Math.min(1, dt * 5);
		const glow = 1 + (M.state === 'transition' ? Math.sin(B.time * 20) * 0.6 + 0.6 : 0) + (M.phase === 2 ? 0.5 : 0);
		const r = L.update(pts, B.time, { jaw, phase: M.phase, glow, cracked: M.phase === 1 ? 1 : 0 });
		L.brow.getWorldPosition(eye);
		L.eyeMat.emissiveIntensity += (2.2 - L.eyeMat.emissiveIntensity) * Math.min(1, dt * 3);
		// (its breastplate bursts as the last of the fight begins)
		if (r.plateBurst) { ctx.fx.glass(r.plateBurst, 30, 6, 0.6); ctx.fx.sparks(r.plateBurst, 30, null, 0.75, 0.6, 1, 12); ctx.shake?.(0.6, r.plateBurst); }
	};
	B.die = () => { for (const s of segs) { ctx.fx.glass(s.p, 6, 5, 0.5); ctx.fx.sparks(s.p, 10, null, 0.8, 0.6, 1, 8); } };
	B.focus = () => head;
	return g;
}

// ---------- the Cinder Colossus ----------
function walker(ctx, B) {
	const g = new THREE.Group();
	const metal = new THREE.MeshStandardMaterial({ color: 0x3b3a38, roughness: 0.55, metalness: 0.75 });
	const dark = new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.7, metalness: 0.5 });
	const glow = glowMat(0xff6a1a, 1.4);
	const hull = new THREE.Group(); g.add(hull);
	const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
	const add = (p, geo, mat, s, pos) => { const m = new THREE.Mesh(geo, mat); m.scale.set(...s); m.position.set(...pos); p.add(m); return m; };
	add(hull, box, metal, [5, 2.4, 8], [0, 0, 0]); add(hull, box, dark, [4.2, 1.2, 6], [0, 1.6, -0.5]);
	add(hull, box, metal, [2.2, 1.4, 2.4], [0, 0.6, 4.6]);
	const muzzle = add(hull, cyl, dark, [0.25, 2.2, 0.25], [0, 0.4, 6.2]); muzzle.rotation.x = Math.PI / 2;
	for (const s of [-1, 1]) add(hull, box, glow, [0.08, 0.2, 7], [2.52 * s, 0.4, 0]);
	const core = add(hull, new THREE.SphereGeometry(1, 16, 12), glowMat(0xffa040, 0.3), [1.1, 1.1, 1.1], [0, -1.6, 0.5]);
	const legs = [[-1, 1, 'legL'], [1, 1, 'legR'], [-1, -1, null], [1, -1, null]].map(([sx, sz, weak], i) => {
		const up = add(g, cyl, metal, [0.45, 1, 0.45], [0, 0, 0]), lo = add(g, cyl, dark, [0.35, 1, 0.35], [0, 0, 0]);
		const knee = add(g, new THREE.SphereGeometry(1, 12, 10), weak ? glowMat(0xff8a2a, 1.6) : metal, [0.75, 0.75, 0.75], [0, 0, 0]);
		return { sx, sz, weak, up, lo, knee, ph: i * Math.PI * 0.5 + (i > 1 ? Math.PI : 0), foot: new THREE.Vector3(), kneeP: new THREE.Vector3() };
	});
	const C = B.center;
	let height = 9, yaw = 0, beam = null, vent = 0;
	const pos = new THREE.Vector3(C.x, 0, C.z);
	const hip = (L, out) => out.set(L.sx * 2.6, -0.8, L.sz * 3.4).applyAxisAngle(_w.set(0, 1, 0), yaw).add(hull.position);
	B.parts = () => {
		const out = [{ type: 'box', c: hull.position, h: [2.6, 1.6, 4.4], yaw, part: 'body' }];
		for (const L of legs) out.push({ type: 'sphere', c: L.kneeP, r: 0.85, part: L.weak || 'body' });
		out.push({ type: 'sphere', c: core.getWorldPosition(new THREE.Vector3()), r: 1.2, part: 'core' });
		return out;
	};
	B.surface = 'machine';
	B.attack = (name, step) => {
		const me = ctx.eye();
		if (name === 'mortar') {
			if (step === 'telegraph-start') { B.marks = []; for (let i = 0; i < 5 + B.mc.M.phase * 2; i++) { const x = me.x + rnd(-7, 7), z = me.z + rnd(-7, 7), y = ctx.ground(x, z, me.y); B.marks.push({ x, y, z }); ctx.fx.ring(x, y, z, 3.5, 1.8 + 2.2, 0xff5a2a, true); } }
			if (step === 'attack') (B.marks || []).forEach((m, i) => setTimeout(() => { if (B.dead) return; const p = new THREE.Vector3(m.x, m.y + 0.5, m.z); ctx.fx.explosion(p, 2.4); ctx.blast(p, 3.5, 28, B.T, B.T); }, 150 + i * 280));
		} else if (name === 'beam') {
			if (step === 'telegraph-start') { const d = Math.atan2(me.x - pos.x, me.z - pos.z); beam = { a0: d - 0.5, a1: d + 0.5, r: Math.hypot(me.x - pos.x, me.z - pos.z), t: 0, live: false }; }
			if (step === 'attack' && beam) beam.live = true;
			if (step === 'recover') beam = null;
		} else if (name === 'stomp') {
			if (step === 'telegraph-start') ctx.fx.ring(pos.x, ctx.ground(pos.x, pos.z, 0), pos.z, 11, 1.3, 0xff7a2a, true);
			if (step === 'attack') { ctx.shake?.(0.8, pos); ctx.fx.dust({ x: pos.x, y: ctx.ground(pos.x, pos.z, 0) + 0.5, z: pos.z }, 20, 0.45, 0.4, 0.35, 3, 1.5); if (Math.hypot(me.x - pos.x, me.z - pos.z) < 11 && ctx.me().grounded) ctx.hurtPlayer({ amount: 30, type: 'impact', src: pos.clone(), part: 'torso', by: B.T }); }
		} else if (name === 'vent') {
			if (step === 'telegraph-start') ctx.fx.ring(pos.x, ctx.ground(pos.x, pos.z, 0), pos.z, 13, 1.5, 0xffa040);
			if (step === 'attack') vent = B.def.attacks.vent.active;
		}
	};
	B.step = (dt) => {
		const M = B.mc.M, me = ctx.eye(), sp = (B.def.phases[M.phase].speed || 1);
		const kneel = M.phase >= 1;
		height += ((kneel ? 4.6 : 9) - height) * Math.min(1, dt * 1.2);
		// walk to keep about 28 m off, facing you
		const dx = me.x - pos.x, dz = me.z - pos.z, d = Math.hypot(dx, dz);
		const want = Math.atan2(dx, dz);
		yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * Math.min(1, dt * 0.6);
		const go = !kneel && M.state !== 'active' ? Math.max(-1, Math.min(1, (d - 28) / 10)) * 2.2 * sp : 0;
		pos.x += Math.sin(yaw) * go * dt; pos.z += Math.cos(yaw) * go * dt;
		const gy = ctx.ground(pos.x, pos.z, me.y);
		hull.position.set(pos.x, gy + height + Math.sin(B.time * 3) * 0.1 * Math.abs(go), pos.z);
		hull.rotation.set(kneel ? 0.18 : 0, yaw, 0);
		B.walkPh = (B.walkPh || 0) + dt * Math.abs(go) * 0.8;
		for (const L of legs) {
			const broken = L.weak && B.mc.M.weak[L.weak]?.broken;
			const h = hip(L, new THREE.Vector3());
			const lift = Math.max(0, Math.sin(B.walkPh * 2 + L.ph)) * 0.8, swing = Math.cos(B.walkPh * 2 + L.ph) * 1.2;
			const fx = h.x + Math.sin(yaw) * (L.sz * 0.8 + swing) + Math.cos(yaw) * L.sx * 2.2, fz = h.z + Math.cos(yaw) * (L.sz * 0.8 + swing) - Math.sin(yaw) * L.sx * 2.2;
			L.foot.set(fx, ctx.ground(fx, fz, gy) + lift, fz);
			L.kneeP.lerpVectors(h, L.foot, 0.5).add(_v.set(Math.cos(yaw) * L.sx * 1.6, broken ? -0.5 : 1.6, -Math.sin(yaw) * L.sx * 1.6));
			const seg = (m, a, b, r) => { m.position.lerpVectors(a, b, 0.5); m.scale.set(r, a.distanceTo(b), r); m.quaternion.setFromUnitVectors(_w.set(0, 1, 0), _v.subVectors(b, a).normalize()); };
			seg(L.up, h, L.kneeP, 0.45); seg(L.lo, L.kneeP, L.foot, 0.35);
			L.knee.position.copy(L.kneeP);
			if (L.weak) { L.knee.material.emissiveIntensity = broken ? 0 : 1.2 + Math.sin(B.time * 5) * 0.4; if (broken && Math.random() < dt * 6) ctx.fx.smokePuff(L.kneeP, 0.12, 0.8, 2); }
		}
		core.material.emissiveIntensity = B.mc.isOpen('core') ? 2.5 + Math.sin(B.time * 7) : 0.3;
		if (beam) {
			beam.t += dt / (beam.live ? B.def.attacks.beam.active : B.def.attacks.beam.warn);
			const a = beam.a0 + (beam.a1 - beam.a0) * Math.min(1, beam.t), from = muzzle.getWorldPosition(new THREE.Vector3());
			const tx = pos.x + Math.sin(a) * beam.r, tz = pos.z + Math.cos(a) * beam.r, to = new THREE.Vector3(tx, ctx.ground(tx, tz, me.y), tz);
			ctx.fx.beam(from, to, 0.06, beam.live ? 0xff4a1a : 0xff2a1a, beam.live ? 0.5 : 0.06);
			if (beam.live) { ctx.fx.flame(to, 1.4); if (Math.hypot(me.x - tx, me.z - tz) < 1.8 && !beam.hit) { beam.hit = true; ctx.hurtPlayer({ amount: 26, type: 'fire', src: from, part: 'torso', by: B.T }); } }
		}
		if (vent > 0) {
			vent -= dt;
			for (let i = 0; i < 4; i++) { const an = Math.random() * 6.283, r = Math.random() * 12; ctx.fx.flame({ x: pos.x + Math.cos(an) * r, y: gy + 0.3, z: pos.z + Math.sin(an) * r }, 1.5); }
			if (Math.hypot(me.x - pos.x, me.z - pos.z) < 12) ctx.hurtPlayer({ amount: 14 * dt, type: 'fire', src: pos.clone(), part: 'torso', by: B.T, quiet: true });
		}
	};
	B.broken = (part) => { const L = legs.find((q) => q.weak === part); if (L) { ctx.fx.explosion(L.kneeP, 2.5); ctx.shake?.(0.5, L.kneeP); } };
	B.die = () => { for (let i = 0; i < 6; i++) setTimeout(() => ctx.fx.explosion(hull.position.clone().add(_v.set(rnd(-3, 3), rnd(-1, 1), rnd(-4, 4))), 3.5), i * 260); };
	B.dying = (dt) => { hull.position.y -= dt * 3; hull.rotation.z += dt * 0.2; };
	B.focus = () => hull.position;
	return g;
}

// ---------- the Stormwarden ----------
function gunship(ctx, B) {
	const g = new THREE.Group();
	const grey = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.45, metalness: 0.7 });
	const dark = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6, metalness: 0.5 });
	const sph = new THREE.SphereGeometry(1, 20, 14), cyl = new THREE.CylinderGeometry(1, 1, 1, 14), box = new THREE.BoxGeometry(1, 1, 1);
	const add = (geo, mat, s, p, r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.scale.set(...s); m.position.set(...p); m.rotation.set(...r); g.add(m); return m; };
	add(sph, grey, [3, 2, 10], [0, 0, 0]); add(sph, dark, [1.6, 1, 2.2], [0, 0.9, 6]);
	add(box, grey, [0.3, 3, 3], [0, 2, -8]); add(box, grey, [14, 0.4, 2.6], [0, 0, -1]);
	const pods = ['podL', 'podR'].map((id, i) => { const s = i ? 1 : -1; const p = add(cyl, dark, [1.3, 4, 1.3], [7.4 * s, 0, -1], [Math.PI / 2, 0, 0]); const glow = add(new THREE.CircleGeometry(1.1, 18), glowMat(0x6ad8ff, 2), [1, 1, 1], [7.4 * s, 0, -3.05], [0, Math.PI, 0]); return { id, p, glow }; });
	const core = add(sph, glowMat(0x9ae0ff, 0.3), [1.2, 1.2, 1.2], [0, -2, 0]);
	const ring = add(new THREE.TorusGeometry(1.8, 0.45, 8, 20), dark, [1, 1, 1], [0, -2, 0], [Math.PI / 2, 0, 0]);
	const C = B.center;
	let ang = Math.random() * 6.283, alt = 38, sweep = null;
	B.parts = () => [
		{ type: 'capsule', a: g.localToWorld(new THREE.Vector3(0, 0, -8)), b: g.localToWorld(new THREE.Vector3(0, 0, 8)), r: 2.2, part: 'body' },
		...pods.map((P) => ({ type: 'sphere', c: P.p.getWorldPosition(new THREE.Vector3()), r: 1.6, part: P.id })),
		{ type: 'sphere', c: core.getWorldPosition(new THREE.Vector3()), r: 1.3, part: 'core' },
	];
	B.surface = 'machine';
	B.missiles = [];
	B.attack = (name, step) => {
		const me = ctx.eye();
		if (name === 'sweep') {
			if (step === 'telegraph-start') { const d = new THREE.Vector3(me.x - g.position.x, 0, me.z - g.position.z).normalize(); sweep = { from: new THREE.Vector3(me.x - d.x * 25, 0, me.z - d.z * 25), to: new THREE.Vector3(me.x + d.x * 15, 0, me.z + d.z * 15), t: 0, live: false, shotT: 0 }; }
			if (step === 'attack' && sweep) { sweep.live = true; sweep.t = 0; }
			if (step === 'recover') sweep = null;
		} else if (name === 'salvo') {
			if (step === 'telegraph-start') for (const P of pods) P.glow.material.emissive.set(0xff3a2a);
			if (step === 'attack') { for (const P of pods) P.glow.material.emissive.set(0x6ad8ff); for (let i = 0; i < 6; i++) setTimeout(() => !B.dead && ctx.missile(B, pods[i % 2].p.getWorldPosition(new THREE.Vector3())), i * 220); }
		} else if (name === 'drones') {
			if (step === 'attack') ctx.spawnSquad('rogue', g.position.x, g.position.z, 2, { alert: true });
		} else if (name === 'barrage') {
			if (step === 'telegraph-start') { B.marks = []; for (let i = 0; i < 9; i++) { const x = me.x + rnd(-9, 9), z = me.z + rnd(-9, 9), y = ctx.ground(x, z, me.y); B.marks.push({ x, y, z }); ctx.fx.ring(x, y, z, 3.5, 2 + 2.6, 0xff5a2a, true); } }
			if (step === 'attack') (B.marks || []).forEach((m, i) => setTimeout(() => { if (B.dead) return; const p = new THREE.Vector3(m.x, m.y + 0.5, m.z); ctx.fx.explosion(p, 2.6); ctx.blast(p, 3.5, 26, B.T, B.T); }, i * 250));
		}
	};
	B.step = (dt) => {
		const M = B.mc.M, me = ctx.eye(), sp = (B.def.phases[M.phase].speed || 1);
		C.x += (me.x - C.x) * Math.min(1, dt * 0.05); C.z += (me.z - C.z) * Math.min(1, dt * 0.05);
		alt += ([38, 26, 20][M.phase] - alt) * Math.min(1, dt * 0.5);
		ang += dt * 0.12 * sp;
		const x = C.x + Math.cos(ang) * 45, z = C.z + Math.sin(ang) * 45, y = Math.max(ctx.ground(x, z, me.y), C.y) + alt;
		const prev = g.position.clone();
		g.position.set(x, y + Math.sin(B.time * 0.8) * 1.5, z);
		const v = g.position.clone().sub(prev);
		if (v.lengthSq() > 1e-6) g.rotation.set(0, Math.atan2(v.x, v.z), -0.25);
		for (const P of pods) { const broken = B.mc.M.weak[P.id]?.broken; P.glow.visible = !broken; if (broken && Math.random() < dt * 8) ctx.fx.smokePuff(P.p.getWorldPosition(_v), 0.1, 1.4, 3); }
		ring.visible = !B.mc.isOpen('core');
		core.material.emissiveIntensity = B.mc.isOpen('core') ? 2.5 + Math.sin(B.time * 6) : 0.3;
		if (sweep) {
			sweep.t += dt / (sweep.live ? B.def.attacks.sweep.active : B.def.attacks.sweep.warn);
			const p = new THREE.Vector3().lerpVectors(sweep.from, sweep.to, Math.min(1, sweep.t));
			p.y = ctx.ground(p.x, p.z, me.y);
			ctx.fx.beam(g.position, p, 0.05, sweep.live ? 0xffd27a : 0xff3a2a, sweep.live ? 0.08 : 0.25);
			if (!sweep.live) ctx.fx.ring(p.x, p.y, p.z, 2.4, 0.1, 0xff3a2a);
			if (sweep.live) {
				sweep.shotT -= dt;
				if (sweep.shotT <= 0) { sweep.shotT = 0.05; const q = p.clone().add(_v.set(rnd(-1.5, 1.5), 0, rnd(-1.5, 1.5))); ctx.fx.tracer(g.position, q, 0, 700); ctx.fx.impact(q, null, 'ground'); }
				if (Math.hypot(me.x - p.x, me.z - p.z) < 2.4 && !sweep.hitT) { sweep.hitT = 0.4; ctx.hurtPlayer({ amount: 9, type: 'ballistic', src: g.position.clone(), part: 'torso', by: B.T }); }
				sweep.hitT = Math.max(0, (sweep.hitT || 0) - dt);
			}
		}
	};
	B.broken = (part) => { const P = pods.find((q) => q.id === part); if (P) ctx.fx.explosion(P.p.getWorldPosition(new THREE.Vector3()), 3); };
	B.die = () => { ctx.fx.explosion(g.position.clone(), 6); };
	B.dying = (dt) => { B.vy = (B.vy || 0) - 9.8 * dt; g.position.y += B.vy * dt; g.rotation.z += dt * 0.8; if (Math.random() < 0.5) ctx.fx.smokePuff(g.position, 0.08, 2, 3); const gy = ctx.ground(g.position.x, g.position.z, g.position.y); if (g.position.y < gy + 1 && !B.crashed) { B.crashed = true; ctx.fx.explosion(g.position.clone(), 7); ctx.shake?.(1, g.position); g.visible = false; } };
	B.focus = () => g.position;
	return g;
}

// ---------- the Fog Mother ----------
// an old woman of fog as tall as the bridge's towers, wading in the strait beside the Golden Gate
// at night, the blue heart in her chest the one place she can be hurt hard. She brings her hands
// down on the roadway (a ring on the deck where one will fall), wails, breathes a bank of cold fog
// down the deck, and calls Fog Wights up out of it. Her body is her sheet's (creatures/models.js,
// creatures/fog.js makes it fog); it comes when it has loaded.
const FOG_H = 220;
function fogMother(ctx, B) {
	const g = new THREE.Group();
	const C = B.center, heart = new THREE.Vector3(C.x, C.y + FOG_H * 0.66, C.z), focus = heart;
	const voice = createCreatureVoice({ eye: ctx.eye, yaw: () => ctx.yaw?.() ?? 0, isPhone: GFX_PHONE });
	let c = null, look = null, k = 1, yaw = 0, arm = null, breath = null, fade = 1;
	// where she stands and which way she faces: toward the deck, across it
	const bridge = ctx.world?.()?.bridge;
	if (bridge) { const t = (C.x - bridge.centre.x) * -bridge.axis.y + (C.z - bridge.centre.z) * bridge.axis.x; yaw = Math.atan2(bridge.axis.y * Math.sign(t), -bridge.axis.x * Math.sign(t)); }
	else { const e = ctx.eye(); yaw = Math.atan2(e.x - C.x, e.z - C.z); }
	makeCreature('fog-mother').then((body) => {
		if (B.dead && B.deadT > 6) return;
		c = body;
		k = FOG_H / (c.meta.height || 3);
		c.root.scale.setScalar(k);
		c.root.position.set(C.x, C.y - FOG_H * 0.04, C.z);
		c.root.rotation.set(0, yaw, 0);
		look = fogLook(c, { phone: GFX_PHONE });
		g.add(c.root);
		B.T.bound.r = FOG_H * 0.6;
	}).catch((e) => console.warn('fog mother', e));
	const shapes = [];
	B.parts = () => {
		if (!c) return [{ type: 'sphere', c: heart, r: FOG_H * 0.05, part: 'heart' }];
		const sh = c.shapes();
		shapes.length = 0;
		for (const z of sh) shapes.push({ type: 'capsule', a: z.a, b: z.b, r: z.r * k, part: 'body' });
		shapes.push({ type: 'sphere', c: heart, r: FOG_H * 0.035, part: 'heart' });
		return shapes;
	};
	B.surface = 'creature';
	// a world rotation laid on a bone (its parent's frame turned into it)
	const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
	function turn(bone, q) {
		bone.parent.getWorldQuaternion(_pq);
		bone.quaternion.premultiply(_q.copy(_pq).invert().multiply(q).multiply(_pq));
		bone.updateMatrixWorld(true);
	}
	const bone = (n) => { let b = null; c?.root.traverse((o) => { if (!b && o.isBone && o.name === n) b = o; }); return b; };
	const deckY = (x, z) => ctx.ground(x, z, ctx.eye().y + 3);
	B.attack = (name, step, kk) => {
		const me = ctx.eye();
		if (name === 'slam') {
			if (step === 'telegraph-start') {
				// the hand on the side you are, and where it will fall: the deck where you stand
				const side = c ? Math.sign(Math.cos(yaw) * (me.x - C.x) - Math.sin(yaw) * (me.z - C.z)) || 1 : 1;
				const at = new THREE.Vector3(me.x, deckY(me.x, me.z), me.z);
				arm = { side: side > 0 ? 'L' : 'R', at, up: 0, down: 0, hit: false };
				ctx.fx.ring(at.x, at.y + 0.3, at.z, 18, B.def.attacks.slam.warn + 0.4, 0x8ac8ff, true);
				voice.play('growl', heart, 1, 0.35);
			}
			if (step === 'telegraph' && arm) arm.up = kk;
			if (step === 'attack' && arm) arm.down = 0.001;
			if (step === 'recover') arm = null;
		} else if (name === 'wail') {
			if (step === 'telegraph-start') { voice.play('wail', heart, 1.2, 0.8); B.wail = 0.001; }
			if (step === 'attack') {
				ctx.shake?.(0.5);
				ctx.fx.ring(me.x, deckY(me.x, me.z) + 0.5, me.z, 30, 1.2, 0xbfd8ff, false);
				if (Math.hypot(me.x - C.x, me.z - C.z) < FOG_H * 0.9) ctx.hurtPlayer({ amount: 16, type: 'energy', src: heart.clone(), part: 'head', by: B.T });
			}
		} else if (name === 'breath') {
			if (step === 'telegraph-start') voice.play('wail', heart, 0.6, 0.5);
			if (step === 'attack') {
				// a bank of fog rolled down the deck toward you, from the side she stands
				const from = new THREE.Vector3(C.x, deckY(C.x, C.z), C.z), to = new THREE.Vector3(me.x, deckY(me.x, me.z), me.z);
				breath = { from, to, t: 0, hurt: 0 };
			}
		} else if (name === 'wights') {
			if (step === 'attack') {
				for (const sd of [-1, 1]) {
					const x = me.x + Math.cos(yaw) * 18 * sd, z = me.z - Math.sin(yaw) * 18 * sd, p = _a.set(x, deckY(x, z) + 1, z);
					ctx.fx.dust(p, 14, 0.75, 0.78, 0.82, 4, 2);
					ctx.spawnSquad('nightborn', x, z, 1, { alert: true, species: 'fog-wight', spread: 1 });
				}
			}
		}
	};
	B.step = (dt) => {
		const M = B.mc.M;
		if (!c) return;
		const glow = (M.phase === 2 ? 1.8 : 1) + (M.state === 'transition' ? 0.8 : 0);
		c.motion.update(dt, { speed: 0, look: 0 });
		c.motion.drain();
		// a hand: raised high over her as it winds up, then down on the deck
		if (arm) {
			const ua = bone('upperarm_' + arm.side);
			if (ua) {
				if (arm.down > 0) arm.down = Math.min(1, arm.down + dt / 0.35);
				ua.getWorldPosition(_a);
				const hand = bone('hand_' + arm.side);
				hand?.getWorldPosition(_b);
				const raised = _d.set(Math.sin(yaw) * 0.35, 1, Math.cos(yaw) * 0.35).normalize();
				const down = _b.copy(arm.at).sub(_a).normalize();
				const want = arm.down > 0 ? raised.clone().lerp(down, Math.min(1, arm.down * arm.down)).normalize() : raised;
				hand?.getWorldPosition(_b);
				const now = _b.sub(_a).normalize();
				const w = arm.down > 0 ? 1 : Math.min(1, arm.up * 1.4);
				_q.setFromUnitVectors(now, want);
				turn(ua, new THREE.Quaternion().slerp(_q, w));
				if (arm.down >= 1 && !arm.hit) {
					arm.hit = true;
					const p = arm.at;
					ctx.shake?.(1);
					ctx.fx.dust({ x: p.x, y: p.y + 1, z: p.z }, 40, 0.78, 0.8, 0.84, 9, 3);
					ctx.fx.sparks(p, 20, null, 0.6, 0.8, 1, 10);
					voice.play('scrape', p, 1, 0.4);
					const e = ctx.eye();
					if (Math.hypot(e.x - p.x, e.z - p.z) < 18 && Math.abs(e.y - p.y) < 14) ctx.hurtPlayer({ amount: 34, type: 'impact', src: p.clone(), part: 'torso', by: B.T });
				}
			}
		}
		// the fog bank rolling down the deck
		if (breath) {
			breath.t += dt / 2.5;
			const front = _a.lerpVectors(breath.from, breath.to, Math.min(1, breath.t * 1.3));
			ctx.fx.dust({ x: front.x, y: front.y + 2, z: front.z }, 3, 0.8, 0.83, 0.88, 6, 2.5);
			const e = ctx.eye();
			breath.hurt -= dt;
			if (breath.hurt <= 0 && Math.hypot(e.x - front.x, e.z - front.z) < 16) { breath.hurt = 0.5; ctx.hurtPlayer({ amount: 5, type: 'energy', src: front.clone(), part: 'torso', by: B.T }); }
			if (breath.t >= 1) breath = null;
		}
		look.heart(heart);
		look.update(dt, { glow, fade, wind: _d.set(Math.sin(yaw + Math.PI), 0, Math.cos(yaw + Math.PI)) });
	};
	B.die = () => { voice.play('wail', heart, 1.4, 0.6); ctx.fx.sparks(heart, 40, null, 0.5, 0.8, 1, 20); };
	B.dying = (dt) => { fade = Math.max(0, 1 - B.deadT / 5); if (c) { c.motion.update(dt, { speed: 0 }); look.update(dt, { glow: fade * 2, fade }); } };
	B.focus = () => focus;
	return g;
}

const BUILD = { leviathan, walker, gunship, fogmother: fogMother };

// a boss at center ({ x, y, z }); id is shared in a room (the host's)
export function createBoss(ctx, kind, center, { id = 'boss:' + kind, rand = Math.random } = {}) {
	const def = BOSSES[kind];
	const B = { id, kind, def, center: new THREE.Vector3(center.x, center.y, center.z), time: 0, dead: false, deadT: 0, mc: createBossMachine(def, rand) };
	B.group = BUILD[kind](ctx, B);
	B.group.name = 'boss-' + kind;
	B.T = { id, kind: 'boss', faction: 'boss', shared: true, surface: B.surface, name: def.name, bound: { x: center.x, y: center.y, z: center.z, r: 30 }, shapes: () => B.parts(), onHit: (blow) => damage(blow), life: () => B.mc.M };
	ctx.layer.add(B.T);
	function damage(blow) {
		if (B.dead) return null;
		const r = B.mc.damage(blow.amount, blow.part);
		for (const e of r.events) event(e);
		return { dealt: r.dealt, killed: B.mc.M.state === 'dead' };
	}
	function event(e) {
		if (e.type === 'phase') { ctx.hud?.phase(e.name); ctx.call?.(`${def.name}: ${e.name}`, 'boss'); ctx.shake?.(0.6, B.focus()); ctx.fx.explosion(B.focus().clone(), 2.5, false); ctx.onPhase?.(B, e); }
		if (e.type === 'broken') B.broken?.(e.part);
		if (e.type === 'dead') { B.dead = true; ctx.layer.remove(id); B.die?.(); ctx.onBossDown?.(B); }
		if (e.type === 'telegraph') B.attack(e.attack, 'telegraph-start', 0);
		if (e.type === 'attack') B.attack(e.attack, 'attack', 1);
		if (e.type === 'recover') B.attack(e.attack, 'recover', 1);
	}
	function update(dt) {
		B.time += dt;
		if (B.dead) { B.deadT += dt; B.dying?.(dt); return B.deadT < 6; }
		for (const e of B.mc.tick(dt)) event(e);
		if (B.mc.M.state === 'telegraph') B.attack(B.mc.M.attack, 'telegraph', B.mc.progress());
		B.step(dt);
		const f = B.focus();
		B.T.bound.x = f.x; B.T.bound.y = f.y; B.T.bound.z = f.z;
		return true;
	}
	// (a guest: the host's health and phase)
	function sync(hp, phase, dead) {
		const was = B.mc.M.phase;
		B.mc.sync(hp, phase);
		if (B.mc.M.phase !== was) event({ type: 'phase', phase, name: def.phases[phase].name });
		if (dead && !B.dead) event({ type: 'dead' });
	}
	function dispose() {
		B.dead = true; ctx.layer.remove(id); B.group.removeFromParent();
		const resources = new Set();
		B.group.traverse((o) => { if (o.geometry) resources.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) resources.add(m); });
		for (const r of resources) r.dispose();
	}
	return Object.assign(B, { update, sync, damage, dispose, info: () => ({ id, kind, name: def.name, hp: Math.round(B.mc.M.hp), max: def.hp, phase: B.mc.M.phase, phaseName: B.mc.M.phaseName, state: B.mc.M.state, attack: B.mc.M.attack, dead: B.dead, at: [B.focus().x, B.focus().y, B.focus().z].map(Math.round), weak: Object.fromEntries(Object.entries(B.mc.M.weak).map(([k, w]) => [k, { open: B.mc.isOpen(k), broken: w.broken }])) }) });
}
