// A wildfire. It starts in the dry country upwind of you (the grass and brush of the open
// hills, the edges of the woods; never on water, in the streets or on a roof) and runs on the
// ground as a front of cells (cataclysm/front.js): faster with the wind behind it and uphill,
// throwing embers ahead. Drawn as a line of flames along the front, a tall column of smoke that
// leans downwind and darkens the sky, embers on the wind, and scorched black ground behind it.
// Houses in its way catch (combat's building fires, answered by their stations); engines are
// sent to the front (services.dispatchFire) and their crews' hoses knock it down near them;
// you can take a hose to it too (cataclysm/quests.js). It is held when no flame is left.

import { createFront } from './front.js';
import { roll } from './schedule.js';
import { isBuilding } from '../structures/overlap.js';

export function createWildfire(ctx) {
	const { world, hooks, isPhone, fx, sound, response, quests, shared } = ctx;
	const W = () => world();
	const CELL = isPhone ? 14 : 10, VIEW = isPhone ? 450 : 800;
	let F = null;
	const ground = (x, z) => W()?.island?.heightAt?.(x, z) ?? 0;

	// how much there is to burn at a point: open country, dry by the month, the woods more
	function fuelAt(x, z) {
		const w = W();
		if (!w) return 0;
		const h = ground(x, z);
		if (h < 0.8) return 0;
		if (w.real?.landAt?.(x, z)?.roof > 0.15) return 0;
		let u = 0;
		try { u = (w.townAt || w.bayArea?.urbanAt)?.(x, z)?.u ?? 0; } catch { u = 0; }
		if ((w.city?.lotsNear?.(x, z, CELL * 0.5) || []).some(isBuilding)) return 0;
		let k = Math.max(0, 1 - u * 2.4) * (0.55 + 0.45 * (ctx.dry?.() ?? 1));
		try { if (w.vegetation?.obstacles?.(x, z, CELL * 0.6)?.length) k += 0.25; } catch { /* no trees here */ }
		return Math.min(1, k);
	}
	// where it starts: the best fuel near the spot it was meant to start (upwind of you)
	function origin(ev) {
		const me = ctx.camera.position, wd = wind();
		const base = { x: me.x - wd.x * ev.distance + Math.cos(ev.bearing) * ev.distance * 0.4, z: me.z - wd.z * ev.distance + Math.sin(ev.bearing) * ev.distance * 0.4 };
		let best = null, bf = 0.35;
		for (let k = 0; k < 60; k++) {
			const a = roll(ev.seed, 'oa', k) * Math.PI * 2, r = (k < 30 ? 1 : 2.5) * roll(ev.seed, 'or', k) * 220;
			const x = base.x + Math.cos(a) * r, z = base.z + Math.sin(a) * r, f = fuelAt(x, z);
			if (f > bf) { bf = f; best = { x, z }; if (f > 0.8) break; }
		}
		return best;
	}
	function wind() {
		const d = shared?.uWindDir?.value, s = shared?.uWind?.value ?? 0.5;
		const x = d ? d.x : 0.93, z = d ? d.y : 0.35, l = Math.hypot(x, z) || 1;
		return { x: x / l, z: z / l, speed: Math.max(0.6, Math.min(1.6, s * 1.3 + (F?.ev?.severity ?? 0.5) * 0.5)) };
	}
	function start(ev) {
		const at = origin(ev);
		if (!at) return null;
		const front = createFront({ cell: CELL, fuelAt, heightAt: ground, maxBurning: isPhone ? 140 : 360, maxCells: Math.round((isPhone ? 260 : 760) * (0.6 + ev.severity * 0.8)), spread: 0.012 + ev.severity * 0.006 });
		for (const [dx, dz] of [[0, 0], [CELL, 0], [0, CELL]]) front.ignite(at.x + dx, at.z + dz);
		if (!front.burning.size) return null;
		F = { ev, at, front, t: 0, acc: 0, draw: [], drawT: 0, smokeAcc: 0, emberAcc: 0, crews: [], engineT: 6, houseT: 3, houses: 0, hoseT: 25, hoses: 0, heldAt: null, scorchT: 0, hurtT: 0 };
		return at;
	}
	// a crew put down by an engine near the front: their hose on it for a while
	function hose(cx, cz, tx, tz) {
		if (!F) return;
		F.crews.push({ x: cx, z: cz, tx, tz, t: 60 });
		ctx.news?.('Engine crews are on the fire line.');
	}
	// the flames to draw: the burning cells nearest you, refreshed a few times a second
	function refreshDraw() {
		const me = ctx.camera.position, out = F.draw;
		out.length = 0;
		for (const c of F.front.burning) { const d = Math.hypot(c.x - me.x, c.z - me.z); if (d < VIEW) out.push([d, c]); }
		out.sort((a, b) => a[0] - b[0]);
	}
	function update(dt) {
		if (!F) return 0;
		F.t += dt;
		const front = F.front, me = ctx.camera.position, wd = wind();
		// the front moves on (ten times a second)
		F.acc += dt;
		if (F.acc >= 0.1) {
			const step = F.acc; F.acc = 0;
			front.step(step, wd);
			for (const C of F.crews) { C.t -= step; front.douse(C.x, C.z, 32, step * 0.18); }
			F.crews = F.crews.filter((C) => C.t > 0);
		}
		// held: nothing left alight
		if (F.heldAt == null && front.held()) { F.heldAt = F.t; ctx.news?.('The fire is contained. Crews are mopping up hot spots.'); }
		if ((F.drawT -= dt) <= 0) { F.drawT = 0.25; refreshDraw(); }
		// the flames along the front
		let nearD = 1e9, nearN = 0, n160 = 0;
		for (const [d, c] of F.draw) {
			if (c.s !== 1) continue;
			if (d < nearD) nearD = d;
			if (d < 120) nearN++;
			if (d < 160) n160++;
			const h0 = (2.2 + c.fuel * 5.5) * (0.35 + c.heat * 0.65), r1 = roll(c.i, c.j, 'f1'), r2 = roll(c.i, c.j, 'f2');
			const x = c.x + (r1 - 0.5) * CELL * 0.6, z = c.z + (r2 - 0.5) * CELL * 0.6;
			if (!fx.flame(x, ground(x, z) - 0.2, z, h0 * (1.6 + r2 * 0.4), h0 * 1.1, c.heat)) break;
			if (d < 160 && !isPhone) { const x2 = c.x - (r2 - 0.5) * CELL * 0.7, z2 = c.z + (r1 - 0.5) * CELL * 0.7; if (!fx.flame(x2, ground(x2, z2) - 0.2, z2, h0 * 1.1, h0 * 0.9, c.heat * 0.8)) break; }
		}
		// smoke: from the front, nearer cells more often; tall and dark, warm underneath
		const live = front.burning.size;
		F.smokeAcc += dt * Math.min(isPhone ? 16 : 55, 6 + live * 0.5);
		const arr = F.draw;
		while (F.smokeAcc >= 1 && arr.length) {
			F.smokeAcc -= 1;
			const c = arr[Math.floor(Math.pow(Math.random(), 1.6) * arr.length)][1];
			const g = ground(c.x, c.z);
			fx.smoke(c.x + (Math.random() - 0.5) * CELL, g + 2 + Math.random() * 3, c.z + (Math.random() - 0.5) * CELL, 3 + Math.random() * 2.5, 13 + Math.random() * 9, 4, 24 + Math.random() * 14, 0.2 + Math.random() * 0.14, 0.9 * c.heat, 0.55);
		}
		F.smokeAcc = Math.min(F.smokeAcc, 4);
		// embers carried on the wind from the near flames
		F.emberAcc += dt * (isPhone ? 10 : 36) * Math.min(1, nearN / 6);
		while (F.emberAcc >= 1) { F.emberAcc -= 1; if (!n160) { F.emberAcc = 0; break; } const c = arr[Math.floor(Math.random() * Math.min(n160, arr.length))][1]; fx.ember(c.x + (Math.random() - 0.5) * CELL, ground(c.x, c.z) + 1 + Math.random() * 3, c.z + (Math.random() - 0.5) * CELL, 1); }
		// scorched ground where it has been (laid once each)
		if ((F.scorchT -= dt) <= 0) {
			F.scorchT = 0.5;
			let n = 0;
			for (const c of front.scorched(me.x, me.z, VIEW * 0.8, 120)) { fx.mark(`w${F.ev.seed}:${c.i},${c.j}`, 0, c.x, c.z, CELL * 1.7, CELL * 1.7, roll(c.i, c.j, 'y') * 6.28); if (++n > 12) break; }
		}
		// houses in its way catch
		if ((F.houseT -= dt) <= 0) {
			F.houseT = 2.5;
			const C = hooks.combat;
			for (const [d, c] of F.draw) {
				if (d > 450 || c.s !== 1 || c.heat < 0.6) continue;
				const o = (W()?.city?.lotsNear?.(c.x, c.z, CELL) || []).find((q) => isBuilding(q) && !q.burntBy);
				if (!o) continue;
				o.burntBy = F.ev.id;
				if (C?.igniteAt?.(o.x, o.z, Math.max(o.w, o.d) / 2 + 4)) { F.houses++; if (F.houses === 1) ctx.news?.(`Homes are burning at the edge of ${ctx.place?.() || 'town'}. Evacuate now.`); }
				break;
			}
		}
		// the engines: one to the front near you every so often while it burns
		if (F.heldAt == null && (F.engineT -= dt) <= 0) {
			F.engineT = 35;
			const c = front.nearest(me.x, me.z);
			if (c && response.engineTo(c.x, c.z)) ctx.news?.('An engine company is on its way to the fire.');
		}
		// a hose for you to take, beside the flames near you
		if (F.heldAt == null && (F.hoseT -= dt) <= 0 && F.hoses < 3) {
			F.hoseT = 40;
			const c = front.nearest(me.x, me.z);
			if (c && Math.hypot(c.x - me.x, c.z - me.z) < 600) { F.hoses++; quests.offer('hose', { title: 'Take a hose to the fire line', at: { x: c.x, z: c.z } }); }
		}
		// the crews' spray, where you can see it
		for (const C of F.crews) { if (Math.hypot(C.x - me.x, C.z - me.z) > 220 || Math.random() > dt * 18) continue; const c = front.near(C.x, C.z, 32)[0]; if (c) fx.spray?.(C.x, ground(C.x, C.z) + 1.3, C.z, c.x, ground(c.x, c.z) + 0.5, c.z, 2); }
		// too close: it burns you
		if ((F.hurtT -= dt) <= 0) {
			F.hurtT = 0.5;
			if (nearD < CELL * 0.8 && !W()?.player?.state?.flying) try { hooks.combat?.hurtPlayer?.({ amount: 6, type: 'fire', part: 'torso', src: { x: me.x + 1, y: me.y, z: me.z }, quiet: true }); } catch { /* not in a fight */ }
		}
		// the roar
		const roar = Math.max(0, 1 - nearD / 420) * Math.min(1, 0.25 + nearN / 25);
		const nc = front.nearest(me.x, me.z);
		sound.setRoar(roar, nc);
		return roar;
	}
	// how thick the smoke is where you are (0..1): for the sky's tint
	function smokeHere() {
		if (!F) return 0;
		const e = F.front.extent(), me = ctx.camera.position;
		const amount = Math.min(1, F.front.burning.size / (isPhone ? 60 : 140));
		if (!e) return F.heldAt != null ? Math.max(0, 0.35 - (F.t - F.heldAt) / 200) : 0;
		const d = Math.max(0, Math.hypot(e.x - me.x, e.z - me.z) - e.r);
		// (downwind it is thicker)
		const wd = wind(), down = ((me.x - e.x) * wd.x + (me.z - e.z) * wd.z) > 0 ? 1.3 : 0.8;
		return Math.min(1, amount * Math.max(0, 1 - d / 2600) * down);
	}
	// (the console: the front run on by s seconds at once)
	function advance(s) { if (!F) return; const wd = wind(); for (let t = 0; t < s; t += 0.5) { F.front.step(0.5, wd); for (const C of F.crews) { C.t -= 0.5; F.front.douse(C.x, C.z, 32, 0.09); } } F.crews = F.crews.filter((C) => C.t > 0); F.drawT = 0; }
	function threat(x, z) { const c = F?.front.nearest(x, z); return c && Math.hypot(c.x - x, c.z - z) < 500 ? { x: c.x, z: c.z } : null; }
	function stop() { sound.setRoar(0); F = null; }
	function info() { return F && { t: +F.t.toFixed(1), origin: [Math.round(F.at.x), Math.round(F.at.z)], ...F.front.stats(), cell: CELL, crews: F.crews.length, houses: F.houses, held: F.heldAt != null, drawn: fx.counts().flames, extent: F.front.extent() && Object.fromEntries(Object.entries(F.front.extent()).map(([k, v]) => [k, Math.round(v)])) }; }
	return { start, update, stop, hose, advance, smokeHere, threat, info, front: () => F?.front || null, heldAt: () => F?.heldAt ?? null, state: () => F, fuelAt };
}
