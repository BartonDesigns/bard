// An earthquake. The first jolt (the P wave) and then the strong shaking rolls in from the
// epicentre, as long as its magnitude makes it: the view sways and jolts, the trees thrash,
// the ground rumbles from under everything, windows rattle, glass comes down off the towers
// and shop fronts, car alarms go off along the street, the street cracks open, dust lifts off
// everything. Every building in reach is shaken by how hard the ground moves there and how
// strong it is (cataclysm/schedule.js damageFor: a timber house worst, a steel tower best):
// glass lost, walls cracked open, the top storeys down, or the whole of it down, through the
// structures' own damage (structures/damage.js holes and collapses, debris, dust, rubble kept
// until the crews rebuild). People near what falls are hurt or trapped; a few gas mains catch
// (combat's fires, answered by the fire stations). Aftershocks follow over the next minutes.

import { shakeAt, quakeDuration, quakeRadius, arrival, aftershocks, damageFor, roll } from './schedule.js';
import { isBuilding } from '../structures/overlap.js';
import { bid, frameOf, FACES, onFace, faceLen } from '../structures/ids.js';

export function createQuake(ctx) {
	const { world, hooks, isPhone, fx, sound, response, quests } = ctx;
	const W = () => world();
	// (the structures break things where you can see them: debris, dust and shells are local,
	// so the buildings broken are those within NEAR of you, a few a frame)
	const NEAR = isPhone ? 170 : 280, PER = isPhone ? 1 : 2;
	const CAP = { collapse: isPhone ? 3 : 7, partial: isPhone ? 4 : 10, crack: isPhone ? 10 : 26, glass: isPhone ? 14 : 40, hurt: isPhone ? 3 : 7, fires: isPhone ? 1 : 2, cracks: isPhone ? 4 : 9 };
	let Q = null;

	// the buildings in reach, what each will suffer and when (nearest you first, for the caps)
	function plan(ev, at) {
		const city = W()?.city, S = hooks.structures;
		const R = quakeRadius(ev.magnitude), me = ctx.camera.position;
		const lots = (city?.lotsNear?.(me.x, me.z, NEAR) || []).filter((o) => isBuilding(o) && !o.wrecked && Math.hypot(o.x - at.x, o.z - at.z) < R);
		lots.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
		const left = { ...CAP }, D = quakeDuration(ev.magnitude), out = [];
		for (const o of lots.slice(0, isPhone ? 160 : 420)) {
			const d = Math.hypot(o.x - at.x, o.z - at.z), I = shakeAt(ev.magnitude, d);
			const tough = S?.damage?.toughness?.(o) ?? 1;
			let what = damageFor(I, tough, o.h - 1.2, roll(ev.seed, bid(o)));
			// (past the caps a building comes off one step lighter)
			while (what !== 'none' && left[what] <= 0) what = what === 'collapse' ? 'partial' : what === 'partial' ? 'crack' : what === 'crack' ? 'glass' : 'none';
			if (what === 'none') continue;
			left[what]--;
			out.push({ o, what, d, t: arrival(d) + 1.6 + roll(ev.seed, bid(o), 't') * D * 0.75, done: false });
		}
		return out.sort((a, b) => a.t - b.t);
	}
	function start(ev, at) {
		Q = { ev, at, t: 0, D: quakeDuration(ev.magnitude), list: plan(ev, at), after: aftershocks(ev.seed, ev.magnitude), shocks: [], hurt: 0, trapped: 0, carried: 0, fires: [], fireAt: 0, alarmAt: 0.6 + Math.random() * 1.5, dustT: 0, broken: { collapse: 0, partial: 0, crack: 0, glass: 0 } };
		Q.fireAt = Q.D + 6 + Math.random() * 14;
		openCracks();
		return Q;
	}
	// how hard the ground moves where you are, now (0..1)
	function intensity() {
		if (!Q) return 0;
		const me = ctx.camera.position, d = Math.hypot(me.x - Q.at.x, me.z - Q.at.z);
		const t = Q.t - arrival(d);
		let k = 0;
		if (t > 0 && t < Q.D) {
			// (a sharp first jolt, then the rolling S waves building to their worst, then dying away)
			const env = t < 1.4 ? 0.3 * Math.sin(t / 1.4 * Math.PI) : t < 3.2 ? 0.3 + 0.7 * ((t - 1.4) / 1.8) : t > Q.D * 0.7 ? Math.max(0, 1 - (t - Q.D * 0.7) / (Q.D * 0.3)) : 1;
			k = shakeAt(Q.ev.magnitude, d) * env;
		}
		for (const A of Q.shocks) {
			const u = Q.t - A.t0, L = quakeDuration(A.mag) * 0.5;
			if (u > 0 && u < L) k = Math.max(k, shakeAt(A.mag, d) * Math.sin(Math.min(1, u / L) * Math.PI) * 0.9);
		}
		return Math.min(1, k + (k > 0 ? 0.08 : 0));
	}
	// the street opens: cracks on open ground near you and near the heart
	function openCracks() {
		const W0 = W(), me = ctx.camera.position;
		let n = 0;
		for (let k = 0; k < 40 && n < CAP.cracks; k++) {
			const near = k % 2 === 0, base = near ? me : Q.at, a = roll(Q.ev.seed, 'ca', k) * Math.PI * 2, r = 8 + roll(Q.ev.seed, 'cr', k) * (near ? 70 : 140);
			const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r;
			if (shakeAt(Q.ev.magnitude, Math.hypot(x - Q.at.x, z - Q.at.z)) < 0.45) continue;
			const h = W0?.island?.heightAt?.(x, z) ?? 0;
			if (h < 0.6 || (W0?.city?.lotsNear?.(x, z, 4) || []).some(isBuilding)) continue;
			fx.mark(`q${Q.ev.seed}:${k}`, 1, x, z, 8 + roll(Q.ev.seed, 'cl', k) * 12, 1.4 + roll(Q.ev.seed, 'cw', k) * 0.9, a + 1.3);
			n++;
		}
	}
	// one building's fate
	function strike(e) {
		const S = hooks.structures, o = e.o;
		if (!S?.damage || o.wrecked && e.what !== 'collapse') { if (S?.glass) S.glass.blast({ x: o.x, y: o.y + Math.min(o.h * 0.5, 12), z: o.z }, Math.max(3, Math.min(o.w, o.d) * 0.4)); return; }
		const F = frameOf(o), r = (k) => roll(Q.ev.seed, bid(o), k);
		const holeAt = (k, rad) => {
			const f = Math.floor(r('f' + k) * 4), L = faceLen(o, f), u = (r('u' + k) - 0.5) * L * 0.7, [lx, lz] = onFace(o, f, u), [wx, wz] = F.w(lx, lz), [nx, nz] = F.dir(...FACES[f]);
			S.damage.hole(o, { x: wx, y: o.y + 1.2 + 1 + r('y' + k) * Math.min(12, o.h - 3), z: wz }, rad, [nx * 2, 0.5, nz * 2], 'blast');
		};
		const top = { x: o.x, y: o.y + Math.min(o.h * 0.55, 18), z: o.z }, span = Math.min(24, Math.max(o.w, o.d));
		if (e.what === 'glass') S.glass.blast(top, Math.max(3, span * 0.35));
		else if (e.what === 'crack') { S.glass.blast(top, Math.max(4, span * 0.5)); holeAt(0, 0.6 + r('r0') * 0.6); if (r('two') < 0.4) holeAt(1, 0.5 + r('r1') * 0.5); }
		else if (e.what === 'partial') { S.glass.blast(top, span * 0.7); holeAt(0, 1 + r('r0') * 0.8); S.damage.bringDown(o, 0.3 + r('c') * 0.25); }
		else { S.glass.blast(top, span); holeAt(0, 1.4); S.damage.bringDown(o, 0.93); }
		Q.broken[e.what]++;
		if (e.what === 'partial' || e.what === 'collapse') hurtNear(o, e.what === 'collapse');
	}
	// people beside what came down: hurt (the hospital told), trapped (yours to dig out), or
	// hurt and waiting for someone to help them there (yours to carry)
	function hurtNear(o, bad) {
		if (Q.hurt >= CAP.hurt) return;
		const reach = Math.max(o.w, o.d) / 2 + 12;
		for (const p of ctx.people?.pool || []) {
			if (Q.hurt >= CAP.hurt) break;
			if (!p.active || p.leaving || p.P?.ragdoll || p.P?.dna?.child || p.P?.dna?.minor || p.heldBy) continue;
			const q = p.M.S.pos;
			if (Math.hypot(q.x - o.x, q.z - o.z) > reach || roll(Q.ev.seed, p.P?.dna?.seed ?? 0, 'hurt') > (bad ? 0.7 : 0.4)) continue;
			const sev = 0.3 + roll(Q.ev.seed, p.P?.dna?.seed ?? 0, 'sev') * 0.6;
			let kind = 'hurt';
			if (bad && Q.trapped < (isPhone ? 1 : 2)) { kind = 'trapped'; Q.trapped++; }
			else if (Q.carried < (isPhone ? 1 : 2) && sev > 0.4) { kind = 'carry'; Q.carried++; }
			// (the trapped are where it fell, against its wall)
			if (kind === 'trapped') { const F = frameOf(o), [lx, lz] = F.l(q.x, q.z), cx = Math.max(-o.w / 2 - 1.2, Math.min(o.w / 2 + 1.2, lx)), cz = Math.max(-o.d / 2 - 1.2, Math.min(o.d / 2 + 1.2, lz)), [wx, wz] = F.w(cx, cz); const g = W()?.island?.heightAt?.(wx, wz) ?? q.y; p.M.place?.(wx, g, wz, p.M.S.heading); }
			const N = response.injure(p, sev, kind, { x: o.x, z: o.z });
			if (!N) continue;
			Q.hurt++;
			if (kind === 'trapped') quests.offer('rescue', { need: N, title: `Dig ${N.name} out of the rubble`, at: { x: N.x, z: N.z } });
			else if (kind === 'carry') quests.offer('carry', { need: N, title: `Help ${N.name} to the hospital`, at: { x: N.x, z: N.z } });
		}
	}
	// gas mains: a building or two alight once the shaking stops
	function lightFires() {
		const C = hooks.combat;
		if (!C?.igniteAt) return;
		const broken = Q.list.filter((e) => e.done && (e.what === 'collapse' || e.what === 'partial' || e.what === 'crack'));
		const me = ctx.camera.position;
		broken.sort((a, b) => Math.hypot(a.o.x - me.x, a.o.z - me.z) - Math.hypot(b.o.x - me.x, b.o.z - me.z));
		for (const e of broken.slice(0, 6)) {
			if (Q.fires.length >= CAP.fires) break;
			const id = C.igniteAt(e.o.x, e.o.z, Math.max(e.o.w, e.o.d) / 2 + 6);
			if (!id) continue;
			const f = (C.firesNear?.(e.o.x, e.o.z, 40) || []).find((q) => q.id === id) || { x: e.o.x, z: e.o.z };
			Q.fires.push(id);
			quests.offer('fire', { fire: id, title: 'Get water on the burning building', at: { x: f.x, z: f.z }, r: Math.max(e.o.w, e.o.d) / 2 });
		}
		if (Q.fires.length) ctx.news?.(`Gas fires reported in ${ctx.place?.() || 'the area'}: engines are on the way.`);
	}
	function update(dt) {
		if (!Q) return 0;
		Q.t += dt;
		const k = intensity();
		// the buildings, as the shaking reaches them
		let heavy = 0, light = 0;
		for (const e of Q.list) {
			if (e.done || Q.t < e.t) continue;
			if (e.what === 'glass' ? light++ >= 3 : heavy++ >= PER) continue;
			e.done = true; strike(e);
		}
		// the glass of the panes near you, coming down (a few at a time)
		const S = hooks.structures;
		if (k > 0.25 && S?.glass && Math.random() < k * dt * (isPhone ? 2 : 5)) {
			const me = ctx.camera.position, ps = S.glass.panes();
			for (let i = 0; i < 6 && ps.length; i++) {
				const p = ps[Math.floor(Math.random() * ps.length)];
				if (Math.hypot(p.x - me.x, p.z - me.z) > 120) continue;
				if (Math.random() < k * 0.7) S.glass.shatter(p, [p.nx * 1.5, -0.5, p.nz * 1.5]);
				else S.glass.strike?.(p, Math.random(), Math.random(), 20);
				break;
			}
		}
		// car alarms along the street
		if (Q.t > Q.alarmAt && Q.alarmAt > 0 && k > 0.15) {
			Q.alarmAt = -1;
			const me = ctx.camera.position, cars = (W()?.vehicles?.carsNear?.(me.x, me.z, 110) || []).filter((c) => c.id !== 'mine').sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z));
			Q.cars = [];
			for (const c of cars.slice(0, 6)) if (sound.alarm(c, 18 + Math.random() * 14)) Q.cars.push({ x: c.x, y: (c.y || W()?.island?.heightAt?.(c.x, c.z) || 0) + 0.8, z: c.z, until: Q.t + 26 });
		}
		if (Q.cars) for (const c of Q.cars) if (Q.t < c.until && Math.floor(Q.t * 2.6) % 2 === 0 && Math.random() < dt * 8) fx.blink(c.x, c.y, c.z);
		// dust lifting off everything while it shakes
		if (k > 0.2 && (Q.dustT -= dt) <= 0) {
			Q.dustT = isPhone ? 0.25 : 0.1;
			const me = ctx.camera.position, a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 40, x = me.x + Math.cos(a) * r, z = me.z + Math.sin(a) * r;
			fx.smoke(x, (W()?.island?.heightAt?.(x, z) ?? 0) + 0.5, z, 0.4, 5 + Math.random() * 4, 1.5, 7, 0.62, 0, 0.22 * k);
		}
		// the rumble and the rattling
		sound.setRumble(k);
		if (k > 0.2 && Math.random() < k * dt * 6) sound.rattle(k);
		// aftershocks
		for (const A of Q.after) if (!A.done && Q.t >= Q.D + A.t) {
			A.done = true; A.t0 = Q.t;
			Q.shocks.push(A);
			ctx.news?.(`Aftershock, magnitude ${A.mag.toFixed(1)}. Stay clear of damaged buildings.`);
			// (a strong one brings a little more down: cracks and glass)
			if (A.mag > 5.6) for (const e of Q.list) if (e.done && e.what === 'crack' && roll(Q.ev.seed, bid(e.o), 'as') < 0.25 && hooks.structures?.glass) hooks.structures.glass.blast({ x: e.o.x, y: e.o.y + 4, z: e.o.z }, Math.max(e.o.w, e.o.d) * 0.4);
		}
		if (Q.fireAt > 0 && Q.t > Q.fireAt) { Q.fireAt = -1; lightFires(); }
		return k;
	}
	function stop() { sound.setRumble(0); Q = null; }
	function info() { return Q && { t: +Q.t.toFixed(1), at: [Math.round(Q.at.x), Math.round(Q.at.z)], magnitude: Q.ev.magnitude, reach: quakeRadius(Q.ev.magnitude), planned: Q.list.length, struck: Q.list.filter((e) => e.done).length, broken: { ...Q.broken }, hurt: Q.hurt, fires: Q.fires.length, aftershocks: Q.after.map((a) => ({ t: a.t, mag: a.mag, done: !!a.done })), here: +intensity().toFixed(2) }; }
	return { start, update, stop, intensity, info, state: () => Q };
}
