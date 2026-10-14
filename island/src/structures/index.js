// The buildings as things in the world, not scenery: none through another or a street
// (overlap.js, lots.js, town.js), alleys behind the shops (alleys.js, alleyview.js), glass
// that breaks (glass.js), windows and low walls to vault (vault.js), walls that break and
// buildings that fall (damage.js, shell.js, debris.js), the crews that rebuild them
// (rebuild.js), and what has happened kept in this browser (store.js).
//
// createStructures() is made with the Bay Area (main.js) and asked by the rest: combat for its
// shots and blasts (ray, hit, blast), the car you drive for what it runs into (each frame,
// here), the player for vaults (s.tryVault, s.move), the walking for floors and walls.
// Crysis.structures() tells how it all stands; Crysis.demolish(x, z) brings one down.

import { createStore } from './store.js';
import { createStructureSounds } from './audio.js';
import { createDebris } from './debris.js';
import { createGlass } from './glass.js';
import { createDamage } from './damage.js';
import { createRebuild } from './rebuild.js';
import { createVault } from './vault.js';
import { createAlleyView } from './alleyview.js';
import { lotOverlaps, countNext } from './lots.js';
import { stats as settled, isBuilding } from './overlap.js';
import { bid, frameOf } from './ids.js';

export function createStructures({ scene, camera, world, isPhone = false, shared, car = null }) {
	const W = () => world();
	const store = createStore();
	const sounds = createStructureSounds(camera);
	const ground = (x, z) => W()?.island?.heightAt?.(x, z) ?? 0;
	const lotsNear = (x, z, r) => W()?.city?.lotsNear?.(x, z, r) || [];
	// the buildings near a point as boxes for the debris to strike (their walls as they stand)
	const solids = (x, z, r) => lotsNear(x, z, r).filter((o) => isBuilding(o) && !o.wrecked).map((o) => ({ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, y: o.y, h: o.h }));
	const debris = createDebris(scene, { isPhone, ground, solids });
	const hiddenRoots = new Map();
	let glass = null, damage = null, rebuild = null, shakeK = 0;
	// (a building coming down shakes the view: the ground under you shudders)
	const shake = (k) => { shakeK = Math.min(1, shakeK + k); };
	const ctx = {
		scene, camera, isPhone, shared, store, sounds, debris, ground, shake,
		city: () => W()?.city, interiors: () => W()?.interiors, real: () => W()?.real, glass: () => glass, player: () => W()?.player,
		floorAt: (x, z, y) => W()?.player?.floorAt?.(x, z, y) ?? ground(x, z),
		record: (o) => damage.record(o),
		progress: (rec) => rebuild.progress(rec),
		frontOf: (o) => glass.frontOf(o),
		damaged: () => { glass?.refresh(); },
		// a building broken: whoever had built it whole lets it go (interiors/ drops its rooms; a
		// shop of commercial.js is hidden till it is put right)
		release(o) {
			const w = W();
			w?.interiors?.release?.(o);
			const C = w?.commercial?.group;
			if (C && o.src) for (const r of C.children) if (r.visible && Math.abs(r.position.x - o.src.x) < 0.05 && Math.abs(r.position.z - o.src.z) < 0.05) { r.visible = false; hiddenRoots.set(bid(o), r); }
		},
		// put right: the shell goes, the block stands again, the builders may build it whole
		repaired(id, rec) {
			damage.repaired(id);
			const r = hiddenRoots.get(id);
			if (r) { r.visible = true; hiddenRoots.delete(id); }
			for (const o of lotsNear(rec.x, rec.z, 2)) if (bid(o) === id) { o.wrecked = false; if (o.src?.grp) { o.src.grp.wrecked = false; o.src.grp.shut = false; } W()?.interiors?.release?.(o); }
			glass.refresh();
		},
	};
	glass = createGlass(ctx);
	damage = createDamage(ctx);
	rebuild = createRebuild(ctx);
	const vault = createVault(ctx);
	const alleys = createAlleyView(ctx);

	// ---------- the car you drive, into what it meets ----------
	let carPrev = null, carCool = 0;
	function drive(dt) {
		const C = car?.();
		if (!C) { carPrev = null; return; }
		const sp = Math.hypot(C.vx, C.vz), fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
		const front = { x: C.x + fx * C.L / 2, z: C.z + fz * C.L / 2 };
		// the glass first: through a shop front at a jog, if the car has the weight
		glass.bodyInto(front.x, C.y, C.y + 1.6, front.z, C.W / 2, C.vx, C.vz, C.mass * 0.02, 1.0);
		// a wall struck hard: the speed lost in a moment is the blow
		carCool -= dt;
		if (carPrev && carCool <= 0) {
			const lost = carPrev.sp - sp;
			if (lost > 3.5) {
				const E = 0.5 * C.mass * lost * lost;
				let best = null;
				for (const o of lotsNear(front.x, front.z, 4)) {
					if (!isBuilding(o) || o.wrecked && !damage.shells.has(bid(o))) continue;
					const F = frameOf(o), [lx, lz] = F.l(front.x, front.z), d = Math.hypot(Math.max(0, Math.abs(lx) - o.w / 2), Math.max(0, Math.abs(lz) - o.d / 2));
					if (d < 1.6 && (!best || d < best.d)) best = { o, d };
				}
				if (best && E > 50000) {
					const r = Math.min(2.6, Math.sqrt(E / 40000) * 0.5 / Math.sqrt(damage.toughness(best.o)));
					damage.hole(best.o, { x: front.x + fx * 0.5, y: C.y + 0.7 + r * 0.3, z: front.z + fz * 0.5 }, r, [carPrev.vx, 0, carPrev.vz], 'impact');
					carCool = 0.8;
				}
			}
		}
		carPrev = { sp, vx: C.vx, vz: C.vz };
	}

	// ---------- each frame ----------
	function update(dt, nightK = 0, hours = null) {
		const w = W();
		if (!w?.city) return;
		store.tick(hours, dt);
		const p = w.player?.state;
		if (p && !p.tryVault) { p.tryVault = (how) => vault.tryStart(p, how); p.move = (d) => vault.step(p, d); }
		glass.update(camera, nightK);
		damage.update(camera);
		rebuild.update(camera, dt);
		alleys.update(camera);
		debris.update(dt);
		// you, running through a pane
		if (p && !p.flying && !p.locked && !vault.active()) { glass.bodyInto(p.pos.x, p.pos.y - 1.68, p.pos.y + 0.1, p.pos.z, 0.3, p.vel.x, p.vel.z, 80); vault.update(p); }
		drive(dt);
		if (shakeK > 0) { shakeK = Math.max(0, shakeK - dt * 0.8); camera.rotation.x += (Math.random() - 0.5) * shakeK * 0.03; camera.rotation.y += (Math.random() - 0.5) * shakeK * 0.03; }
	}

	// ---------- for combat ----------
	// where a shot's ray meets glass first: { t, n, surface, glass, u, v }
	function ray(o, d, max) {
		const g = glass.ray(o, d, max);
		return g ? { t: g.t, n: g.n, surface: 'glass', glass: g.pane, u: g.u, v: g.v } : null;
	}
	const lotOf = (box) => lotsNear(box.x, box.z, 1.5).find((o) => o.src === box) || null;
	// a shot landed on a wall or a pane: point, direction, the hit, its damage and kind
	function hit(at, dir, h, dmg, type) {
		if (h?.glass) { glass.strike(h.glass, h.u, h.v, type === 'blast' ? 99 : dmg, [dir.x * 4, 0, dir.z * 4]); return true; }
		if (type !== 'blast' && dmg < 120) return false;
		const o = h?.box ? lotOf(h.box) : nearestLot(at.x, at.z, 4);
		if (o) damage.hole(o, at, Math.max(0.3, Math.min(1.4, dmg / 120)), [dir.x * 3, 0, dir.z * 3], 'blast');
		return !!o;
	}
	function nearestLot(x, z, r) {
		let best = null, bd = 1e9;
		for (const o of lotsNear(x, z, r)) {
			if (!isBuilding(o)) continue;
			const [lx, lz] = frameOf(o).l(x, z), d = Math.hypot(Math.max(0, Math.abs(lx) - o.w / 2), Math.max(0, Math.abs(lz) - o.d / 2));
			if (d < bd) { bd = d; best = o; }
		}
		return bd <= r ? best : null;
	}
	// a blast of radius r and damage dmg: the panes round it, and the walls it reaches
	function blast(at, r, dmg) {
		glass.blast(at, r * 1.6);
		if (dmg * r < 25) return 0;
		let n = 0;
		for (const o of lotsNear(at.x, at.z, r + 3).filter(isBuilding).slice(0, 4)) {
			const F = frameOf(o), [lx, lz] = F.l(at.x, at.z), cx = Math.max(-o.w / 2, Math.min(o.w / 2, lx)), cz = Math.max(-o.d / 2, Math.min(o.d / 2, lz));
			const cy = Math.max(o.y + 1.4, Math.min(o.y + o.h - 0.4, at.y)), [wx, wz] = F.w(cx, cz), d = Math.hypot(wx - at.x, cy - at.y, wz - at.z);
			if (d > r) continue;
			const rh = Math.max(0.4, Math.min(6, 0.35 * r * Math.sqrt(dmg / 60) * (1 - d / r * 0.5) / Math.sqrt(damage.toughness(o))));
			damage.hole(o, { x: wx, y: cy, z: wz }, rh, [(wx - at.x) / Math.max(0.5, d) * 6, 2, (wz - at.z) / Math.max(0.5, d) * 6], 'blast');
			n++;
		}
		return n;
	}
	// bring one down (for testing, and for whatever needs a building gone): k 1 all of it, less a part
	function demolish(x, z, k = 1) {
		const o = nearestLot(x, z, 60);
		if (!o) return 'no building near there';
		const F = frameOf(o);
		for (const [lx, lz] of [[0, o.d / 2], [o.w / 2, 0], [0, -o.d / 2], [-o.w / 2, 0]]) { const [wx, wz] = F.w(lx, lz); damage.hole(o, { x: wx, y: o.y + 1.2 + Math.min(4, (o.h - 1.2) * 0.3), z: wz }, Math.min(4, 1.2 + 2 * k), null, 'blast'); }
		glass.blast({ x: o.x, y: o.y + 3, z: o.z }, Math.max(o.w, o.d));
		const rec = k >= 0.99 ? damage.bringDown(o, 0.93) : k > 0.4 ? damage.bringDown(o, 0.3 + k * 0.3) : store.get(bid(o));
		return { id: bid(o), x: +o.x.toFixed(1), z: +o.z.toFixed(1), w: +o.w.toFixed(1), d: +o.d.toFixed(1), h: +(o.h - 1.2).toFixed(1), collapse: rec?.c || 0, holes: rec?.m?.length || 0 };
	}
	function info() {
		return {
			overlaps: { grid: lotOverlaps(), settled: { ...settled } },
			alleys: alleys.info(),
			glass: glass.count(),
			damage: damage.info(),
			rebuilds: rebuild.info(),
			cataclysm: rebuild.cataclysm(),
			debris: debris.counts(),
			vault: vault.info(),
			kept: store.size(),
			hours: +store.now().toFixed(2),
		};
	}
	// the car's boxes as drive.js gives them: a wrecked building's replaced by its walls as they
	// stand (a hole is a way through), and the gridded towns' lots added (solid to a car too)
	function carBoxes(list, x, z, r) {
		const out = [];
		for (const b of list) {
			const o = lotOf(b);
			if (o?.wrecked) { for (const q of damage.carBoxes(o)) out.push(q); continue; }
			out.push(b);
		}
		for (const o of lotsNear(x, z, r)) if (!o.mapped && isBuilding(o)) { if (o.wrecked) { for (const q of damage.carBoxes(o)) out.push(q); } else out.push({ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, h: o.h, y: o.y }); }
		return out;
	}
	return {
		update, floor: damage.floor, push: damage.push, ray, hit, blast, demolish, info, carBoxes,
		cataclysm: (on) => rebuild.cataclysm(on),
		vault: (how = 'key') => { const p = W()?.player?.state; return p ? vault.tryStart(p, how) : false; },
		ahead: () => { const p = W()?.player?.state; const a = p && vault.ahead(p); return a ? { kind: a.kind, d: +a.d.toFixed(2), sill: +a.sill.toFixed(2) } : null; },
		shatter: (x, z) => { const ps = glass.panes().filter((q) => Math.hypot(q.x - x, q.z - z) < 30).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)); return ps[0] ? glass.shatter(ps[0], null) : false; },
		crack: (x, z) => { const ps = glass.panes().filter((q) => !q.plan && Math.hypot(q.x - x, q.z - z) < 30).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)); return ps[0] ? glass.strike(ps[0], 0.4, 0.55, 20) || true : false; },
		advance: (h) => store.advance(h),
		recount: () => countNext(),
		forget: () => { store.clear(); },
		glass, damage, rebuild, store,
	};
}
