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
import * as THREE from 'three';
import { bid, frameOf } from './ids.js';
import { createMarks, POCK, CHIP, SCORCH, CRATER } from './marks.js';
import { rayBox } from '../combat/targets.js';
import { createMonuments } from './monuments.js';
import { createWalls } from './walls/index.js';

export function createStructures({ scene, camera, world, isPhone = false, shared, car = null }) {
	const W = () => world();
	const store = createStore();
	const sounds = createStructureSounds(camera);
	const ground = (x, z) => W()?.island?.heightAt?.(x, z) ?? 0;
	const lotsNear = (x, z, r) => W()?.city?.lotsNear?.(x, z, r) || [];
	// the buildings near a point as boxes for the debris to strike (their walls as they stand)
	const solids = (x, z, r) => lotsNear(x, z, r).filter((o) => isBuilding(o) && !o.wrecked).map((o) => ({ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a, y: o.y, h: o.h }));
	const debris = createDebris(scene, { isPhone, ground, solids });
	const marks = createMarks(scene, { isPhone });
	const hiddenRoots = new Map();
	let glass = null, damage = null, rebuild = null, shakeK = 0;
	// (a building coming down shakes the view: the ground under you shudders)
	const shake = (k) => { shakeK = Math.min(1, shakeK + k); };
	const ctx = {
		scene, camera, isPhone, shared, store, sounds, debris, marks, ground, shake, world: W,
		landmarks: () => W()?.landmarks, cataclysm: () => rebuild?.cataclysm(),
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
			marks.clear(id);
			walls?.repair(id);
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
	const monuments = createMonuments(ctx);
	// walls you break through, layer by layer (walls/): the houses' and the interiors' near you
	const walls = createWalls({ ...ctx, world: W });

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
				// (a house built near you: its wall broken through layer by layer, the house left standing)
				if (best && E > 20000 && walls.claims(best.o) && walls.impact({ x: front.x, y: C.y + 0.7, z: front.z }, { x: fx, z: fz }, E, C.W / 2)) carCool = 0.8;
				else if (best && E > 50000) {
					// (as wide as the car's nose at least, wider the harder it hit; a hard one tears a second
					// hole beside the first, the breach a car's width across)
					const k = 1 / Math.sqrt(damage.toughness(best.o)), r = Math.min(2.4, (0.55 + Math.sqrt(E / 100000) * 0.6) * k);
					const at = { x: front.x + fx * 0.5, y: C.y + 0.6 + r * 0.3, z: front.z + fz * 0.5 };
					damage.hole(best.o, at, r, [carPrev.vx, 0, carPrev.vz], 'impact');
					if (E > 150000) for (const s of [-1, 1]) damage.hole(best.o, { x: at.x + fz * s * C.W * 0.35, y: at.y - 0.1, z: at.z - fx * s * C.W * 0.35 }, r * 0.8, [carPrev.vx, 0, carPrev.vz], 'impact');
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
		rebuild.update(camera, dt, nightK);
		alleys.update(camera);
		monuments.update(dt);
		debris.update(dt);
		walls.update(dt, camera, p);
		// you, running through a pane
		if (p && !p.flying && !p.locked && !vault.active()) { glass.bodyInto(p.pos.x, p.pos.y - 1.68, p.pos.y + 0.1, p.pos.z, 0.3, p.vel.x, p.vel.z, 80); vault.update(p); }
		drive(dt);
		if (shakeK > 0) { shakeK = Math.max(0, shakeK - dt * 0.8); camera.rotation.x += (Math.random() - 0.5) * shakeK * 0.03; camera.rotation.y += (Math.random() - 0.5) * shakeK * 0.03; }
	}

	// ---------- for combat ----------
	// where a shot's ray meets glass, or a gridded town's building (the surveyed ones are the
	// real city's boxes, combat's own), first: { t, n, surface, glass?, u, v, lot? }
	// prior: what combat's own boxes met first (a house built near you stands in for its box,
	// below its roof: { none: true } then means nothing of it was struck), max0 the ray's full reach
	function ray(o, d, max, prior = null, max0 = max) {
		let cleared = false;
		if (prior?.box) { const c = walls.claimsBox(prior.box); if (c && o.y + d.y * prior.t < c.top + 0.05) { max = max0; cleared = true; } }
		const g = glass.ray(o, d, max);
		const L = rayLots(o, d, g ? g.t : max);
		const Wh = walls.ray(o, d, L ? L.t : g ? g.t : max);
		const M = monuments.ray(o, d, Wh ? Wh.t : L ? L.t : g ? g.t : max);
		if (M) return { t: M.t, n: M.n, surface: 'stone', landmark: M.L };
		if (Wh) return { t: Wh.t, n: Wh.n, surface: Wh.surface, wall: Wh.wall, material: Wh.material };
		if (L) return L;
		if (g) return { t: g.t, n: g.n, surface: 'glass', glass: g.pane, u: g.u, v: g.v };
		return cleared ? { none: true } : null;
	}
	// (the lots along the ray a cell at a time; a wrecked one is its walls as they stand)
	function rayLots(o, d, max) {
		const L = Math.min(max, 420), seen = new Set();
		let best = null;
		for (let s = 0; s < L + 30; s += 30) {
			const k = Math.min(s, L), px = o.x + d.x * k, pz = o.z + d.z * k;
			for (const lot of lotsNear(px, pz, 24)) {
				if (seen.has(lot)) continue;
				seen.add(lot);
				if (lot.mapped || !isBuilding(lot) || walls.claims(lot, 'house')) continue;
				const boxes = lot.wrecked ? damage.carBoxes(lot) : [lot];
				for (const b of boxes) {
					const h = rayBox(o, d, { x: b.x, y: b.y + b.h / 2, z: b.z }, [b.w / 2, b.h / 2, b.d / 2], -b.a);
					if (h && h.t > 0.05 && h.t < (best?.t ?? L)) best = { t: h.t, n: new THREE.Vector3(h.n.x, h.n.y, h.n.z), surface: 'stone', lot };
					// (begun inside it, through a pane: across the rooms to its far wall)
					else if (h && h.t <= 0.05) { const t = exitOf(o, d, b); if (t > 0.05 && t < (best?.t ?? L)) best = { t, n: new THREE.Vector3(-d.x, 0, -d.z), surface: 'stone', lot, inside: true }; }
				}
			}
			if (best && best.t < s - 30) break;
		}
		return best;
	}
	// how far a ray from inside a lot's box goes before it leaves it
	function exitOf(o, d, b) {
		const c = Math.cos(b.a), s = Math.sin(b.a), px = o.x - b.x, pz = o.z - b.z;
		const lo = [c * px + s * pz, o.y - (b.y + b.h / 2), -s * px + c * pz], ld = [c * d.x + s * d.z, d.y, -s * d.x + c * d.z], hh = [b.w / 2, b.h / 2, b.d / 2];
		let t = Infinity;
		for (let i = 0; i < 3; i++) if (Math.abs(ld[i]) > 1e-9) t = Math.min(t, ((ld[i] > 0 ? hh[i] : -hh[i]) - lo[i]) / ld[i]);
		return t;
	}
	const lotOf = (box) => lotsNear(box.x, box.z, 1.5).find((o) => o.src === box) || null;
	// a shot landed on a wall or a pane: point, direction, the hit, its damage and kind. A round
	// goes through one pane (a hole and its star of cracks) and on, weaker; a blast stops at it.
	// On a wall: every round leaves its pock, a heavy one a chip and a spray of grit, a very
	// heavy one or a blast a hole. Returns { through, dmg } for a round that goes on.
	function hit(at, dir, h, dmg, type) {
		// (only a wall built near you carries its record; combat marks every world hit wall: true)
		if (h?.wall?.W) return walls.hit(h, at, dir, dmg, type);
		if (h?.glass) {
			glass.strike(h.glass, h.u, h.v, type === 'blast' ? 99 : dmg, [dir.x * 4, 0, dir.z * 4]);
			if (type === 'blast' || type === 'fire' || dmg < 6) return { stop: true };
			return { through: true, dmg: dmg * (type === 'energy' ? 0.7 : 0.55) };
		}
		if (h?.landmark) { monuments.strike(h.landmark, at, dir, type === 'blast' ? Math.max(dmg, 60) : dmg, type, h.n); return { stop: true }; }
		const o = h?.lot || (h?.box ? lotOf(h.box) : null) || nearestLot(at.x, at.z, 2);
		if (!o) return null;
		const n = h?.n || { x: -dir.x, y: 0, z: -dir.z };
		if ((type === 'blast' || dmg >= 120) && walls.claims(o) && dmg < 240) { walls.blast(at, 1.2 + dmg / 120, dmg); return { stop: true }; }
		if (type === 'blast' || dmg >= 120) { damage.hole(o, at, Math.max(0.3, Math.min(1.4, dmg / 120)), [dir.x * 3, 0, dir.z * 3], 'blast'); marks.add(SCORCH, at, n, 1.4 + dmg / 90, bid(o)); return { stop: true }; }
		if (Math.abs(n.y ?? 0) > 0.7 || h?.inside) return { stop: true };
		chip(o, at, n, dmg);
		return { stop: true };
	}
	// a pock, or for a heavy round a chip and the grit it throws
	function chip(o, at, n, dmg) {
		const heavy = dmg >= 40;
		marks.add(heavy ? CHIP : POCK, at, n, heavy ? 0.35 + dmg / 260 : 0.16 + Math.random() * 0.06, bid(o));
		if (!heavy) return;
		const col = o.col || [0.7, 0.68, 0.64];
		for (let i = 0, k = Math.min(isPhone ? 2 : 4, 1 + Math.floor(dmg / 40)); i < k; i++) {
			const s = 0.06 + Math.random() * 0.1;
			debris.chunk(at.x + n.x * 0.15, at.y, at.z + n.z * 0.15, n.x * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2, 1 + Math.random() * 2, n.z * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2, [s, s * 0.7, s], i ? [0.42, 0.41, 0.39] : col);
		}
		debris.puff(at.x + n.x * 0.3, at.y, at.z + n.z * 0.3, 3, 0.2, 0.35);
	}
	// a tank's shell: through the wall where it struck (a hole bigger than a blast's alone,
	// thrown inward), the burst after it is combat's own blast()
	function shell(at, dir, h, dmg = 260) {
		if (h?.glass) glass.strike(h.glass, h.u, h.v, 99, [dir.x * 6, 0, dir.z * 6]);
		if (h?.landmark) { monuments.strike(h.landmark, at, dir, dmg, 'blast', h.n); return true; }
		const o = h?.lot || (h?.box ? lotOf(h.box) : null) || nearestLot(at.x, at.z, 3);
		if (!o) { if (h && !h.glass && Math.abs(h.n?.y ?? 0) > 0.7) marks.add(CRATER, at, { x: 0, y: 1, z: 0 }, 3.2); return false; }
		const r = Math.min(3.2, 1.1 * Math.sqrt(dmg / 120) / Math.sqrt(damage.toughness(o)));
		damage.hole(o, at, r, [dir.x * 8, 1, dir.z * 8], 'impact');
		marks.add(SCORCH, at, h?.n || { x: -dir.x, y: 0, z: -dir.z }, r * 2.6, bid(o));
		return true;
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
		const nw = walls.blast(at, r, dmg);
		if (dmg * r < 25) return nw;
		let n = monuments.blast(at, r, dmg);
		for (const o of lotsNear(at.x, at.z, r + 3).filter(isBuilding).slice(0, 4)) {
			const F = frameOf(o), [lx, lz] = F.l(at.x, at.z), cx = Math.max(-o.w / 2, Math.min(o.w / 2, lx)), cz = Math.max(-o.d / 2, Math.min(o.d / 2, lz));
			const cy = Math.max(o.y + 1.4, Math.min(o.y + o.h - 0.4, at.y)), [wx, wz] = F.w(cx, cz), d = Math.hypot(wx - at.x, cy - at.y, wz - at.z);
			if (d > r) continue;
			const rh = Math.max(0.4, Math.min(6, 0.35 * r * Math.sqrt(dmg / 60) * (1 - d / r * 0.5) / Math.sqrt(damage.toughness(o))));
			if (rh < 1.8 && walls.claims(o)) continue;          // (a house built near you: its walls took it, layer by layer)
			damage.hole(o, { x: wx, y: cy, z: wz }, rh, [(wx - at.x) / Math.max(0.5, d) * 6, 2, (wz - at.z) / Math.max(0.5, d) * 6], 'blast');
			n++;
		}
		return n;
	}
	// bring one down (for testing, and for whatever needs a building gone): k 1 all of it, less a part
	function demolish(x, z, k = 1) {
		const L = monuments.rectAt(x, z, 6);
		if (L) {
			const g = ground(x, z);
			// (four charges along its middle, in its frame)
			for (let i = 0; i < 4; i++) { const lx = (i % 2 ? 1 : -1) * L.hw * 0.4, lz = (i < 2 ? 1 : -1) * Math.min(L.hd * 0.3, 20); monuments.blast({ x: L.x + L.c * lx + L.s * lz, y: g + 2 + i, z: L.z - L.s * lx + L.c * lz }, 8, 200 * k); }
			return { landmark: L.i, ...monuments.state(x, z) };
		}
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
			marks: marks.count(),
			landmarks: monuments.info(),
			walls: walls.info(),
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
		update, floor: damage.floor, push: damage.push, ray, hit, shell, blast, demolish, info, carBoxes,
		// a fist or a swing at a wall: walls/ for the walls built near you, the glass, else null
		blow(eye, dir, reach, move) {
			const w = walls.blow(eye, dir, reach, move);
			if (w) return w;
			const g = glass.ray(eye, dir, reach);
			if (g) { const gone = glass.strike(g.pane, g.u, g.v, move?.item ? 60 : 35, [dir.x * 2, 0, dir.z * 2]); return { material: 'glass', hard: false, broke: !!gone }; }
			return null;
		},
		cataclysm: (on) => rebuild.cataclysm(on),
		vault: (how = 'key') => { const p = W()?.player?.state; return p ? vault.tryStart(p, how) : false; },
		ahead: () => { const p = W()?.player?.state; const a = p && vault.ahead(p); return a ? { kind: a.kind, d: +a.d.toFixed(2), sill: +a.sill.toFixed(2) } : null; },
		shatter: (x, z) => { const ps = glass.panes().filter((q) => Math.hypot(q.x - x, q.z - z) < 30).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)); return ps[0] ? glass.shatter(ps[0], null) : false; },
		crack: (x, z) => { const ps = glass.panes().filter((q) => !q.plan && Math.hypot(q.x - x, q.z - z) < 30).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z)); return ps[0] ? glass.strike(ps[0], 0.4, 0.55, 20) || true : false; },
		advance: (h) => store.advance(h),
		recount: () => countNext(),
		forget: () => { store.clear(); },
		// the world going (main.js teardown): let go of what listens to the quality tier
		dispose: () => { walls.dispose(); },
		landmark: (x, z) => { const p = W()?.player?.state?.pos; return monuments.state(x ?? p?.x, z ?? p?.z); },
		glass, damage, rebuild, store, monuments, marks, debris, walls,
	};
}
