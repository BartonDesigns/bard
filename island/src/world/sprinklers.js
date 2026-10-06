// The lawns' sprinklers: where the heads stand and when they run. In the real suburbs
// (bay/realcity.js) each house's front lawn, between its front wall and the street, gets
// spray heads at its corners turned in toward the house, away from the drive; the back
// yard a rotor (or a pair of spray heads) by the back wall, throwing away from it. The
// parks, playing fields and golf courses get big rotors on a loose grid, where the map
// says grass. The fishing village's fenced yards get a few small heads too.
//
// Each yard keeps its own seeded timer. A fifth of the houses water at sunrise (the real
// sunrise for the day), another fifth at three in the morning, the rest never on their
// own; a run is 15-30 minutes, the starts a few minutes apart from house to house, the
// front zone and then the back. The parks' rotors run before dawn, a few late at night.
// After a run the grass stays wet and dries over a couple of hours. The timer is a
// window on the clock, not an instant, so it holds at any speed the clock runs.
// What they look like is world/spray.js.

import { mainOf } from '../bay/houseplan.js';

const TAU = Math.PI * 2;
const G = 9.81;

function rng(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const keyOf = (x, z) => (Math.imul(Math.round(x * 2) | 0, 73856093) ^ Math.imul(Math.round(z * 2) | 0, 19349663)) >>> 0;

// a park's runs, in hours: [start, end] (the end may pass midnight)
function parkRuns(r) {
	const runs = [];
	if (r() < 0.8) { const s = 3.5 + r() * 3; runs.push([s, s + 0.8 + r() * 1.2]); }
	if (r() < 0.35) { const s = 20.5 + r() * 2.5; runs.push([s, s + 0.6 + r() * 0.8]); }
	return runs;
}
// a house's timer, from its own seed: at sunrise (1 in 5), at 3 am (1 in 5) or never;
// 15-30 minutes, started a few minutes off the hour
function houseTimer(key) {
	const r = rng(key ^ 0x7133e5), u = r();
	return { at: u < 0.2 ? 'rise' : u < 0.4 ? 3 : null, off: r() * 0.2, len: 0.25 + r() * 0.25 };
}
function timerRuns(T, rise) {
	if (T.at == null) return [];
	const s = (T.at === 'rise' ? rise : T.at) + T.off;
	return [[s, s + T.len]];
}
// hours since a time of day, 0..24
const since = (h, s) => ((h - s) % 24 + 24) % 24;

// a head's throw: the speed for its radius at its elevation (a little over, for the air's drag)
function head(x, z, kind, a0, arc, R, r) {
	const el = kind === 2 ? 0.4 + r() * 0.08 : 0.42 + r() * 0.1;
	const sp = Math.min(11, Math.max(5.5, Math.sqrt(R * G / Math.sin(2 * el)) * 1.12));
	return { x, y: 0, z, kind, a0, arc, R, el, sp, period: kind === 2 ? (arc > 6 ? 36 : 14 + arc * 4) * (0.8 + r() * 0.4) : 0, ph: r(), k: 0 };
}

export function createSprinklers({ world, isPhone = false } = {}) {
	const yards = new Map();        // key -> { heads, runs, zones } (null: no lawn there)
	const live = [];                // the yards in reach
	let scanX = 1e9, scanZ = 1e9, scanT = 0, queue = [];
	const REACH = 140;

	const ground = (x, z) => { const I = world()?.island; return I ? (I.drawnAt || I.heightAt)(x, z) : 0; };
	// grass, and nothing paved, roofed or wet on it
	function lawn(x, z, park) {
		const W = world(), real = W?.real;
		if (W?.water?.inWater?.(x, z)) return false;
		if (!real?.landAt) return true;
		const L = real.landAt(x, z);
		if (!L) return !park;
		return L.road < 0.05 && L.roof < 0.05 && (park ? L.lu >= 2 && L.lu <= 4 : L.lu >= 1 && L.lu <= 2);
	}

	// ---- a house's lawns, front and back
	function houseYard(grp) {
		const M = mainOf(grp);
		if (!M) return null;
		const key = keyOf(M.x, M.z);
		if (yards.has(key)) return key;
		const r = rng(key ^ 0x5eed5);
		const ca = Math.cos(M.a), sa = Math.sin(M.a), hw = M.w / 2, hd = M.d / 2;
		const at = (lx, lz) => [M.x + ca * lx - sa * lz, M.z + sa * lx + ca * lz];
		const heads = [];
		const add = (lx, lz, kind, f0, arc, R, zone, park) => {
			const [x, z] = at(lx, lz);
			if (!lawn(x, z, park)) return;
			const h = head(x, z, kind, f0 + M.a, arc, R, r);
			h.zone = zone;
			heads.push(h);
		};
		// the front lawn: out to the street (the drive on the garage's side)
		let s = 0;
		for (let d = 1; d < 16; d++) { const [x, z] = at(0, hd + d); const L = world()?.real?.landAt?.(x, z); if (L && L.road > 0.3) break; s = d; }
		const side = M.kind === 1 ? 1 : M.kind === 2 ? -1 : (r() < 0.5 ? 1 : -1);
		const xa = side > 0 ? -hw + 6.8 : -hw - 0.5, xb = side > 0 ? hw + 0.5 : hw - 6.8;
		if (s >= 4 && xb - xa > 3) {
			const lz = hd + s - 1.6, R = Math.min(5.5, Math.max(3, s - 1.8));
			add(xa + 0.3, lz, 1, -Math.PI / 2, Math.PI / 2, R, 0);
			add(xb - 0.3, lz, 1, -Math.PI, Math.PI / 2, R, 0);
			if (xb - xa > 10) add((xa + xb) / 2, lz, 1, -Math.PI, Math.PI, R, 0);
		}
		// the back yard, as deep as it goes before a fence line, a roof or a road
		let b = 0;
		for (let d = 1; d < 14; d++) { const [x, z] = at(0, -hd - d); if (!lawn(x, z)) break; b = d; }
		if (b >= 4) {
			if (b >= 7 && r() < 0.65) add(0, -hd - 0.7, 2, Math.PI, Math.PI, Math.min(9, b - 0.5), 1);
			else {
				const R = Math.min(5.5, b - 0.6);
				add(-hw + 0.4, -hd - 0.6, 1, Math.PI, Math.PI / 2, R, 1);
				add(hw - 0.4, -hd - 0.6, 1, -Math.PI / 2, Math.PI / 2, R, 1);
			}
		}
		yards.set(key, heads.length ? { x: M.x, z: M.z, heads, timer: houseTimer(key), zones: Math.max(...heads.map((h) => h.zone)) + 1 } : null);
		return key;
	}

	// ---- the parks', fields' and golf courses' rotors, on a loose grid
	const CELL = 24;
	function parkCell(i, j) {
		const key = (Math.imul(i, 92837111) ^ Math.imul(j, 689287499) ^ 0x9a2c) >>> 0;
		if (yards.has(key)) return key;
		const r = rng(key);
		let Y = null;
		if (r() < 0.55) {
			const x = (i + 0.2 + r() * 0.6) * CELL, z = (j + 0.2 + r() * 0.6) * CELL;
			const R = 6 + r() * 3;
			// (the throw stays on the grass: the ground round it must be grass too)
			const ok = lawn(x, z, true) && [0, 1, 2, 3, 4, 5].every((k) => lawn(x + Math.cos(k * 1.047) * R * 0.75, z + Math.sin(k * 1.047) * R * 0.75, true));
			if (ok) {
				const full = r() < 0.6, h = head(x, z, r() < 0.8 ? 2 : 1, r() * TAU, full ? TAU : Math.PI, full ? R : R * 0.8, r);
				h.zone = 0;
				// (neighbours on one controller: their runs much the same)
				const rz = rng((Math.imul(i >> 2, 7919) ^ Math.imul(j >> 2, 104729)) >>> 0);
				Y = { x, z, heads: [h], runs: parkRuns(rz), zones: 1, park: true };
			}
		}
		yards.set(key, Y);
		return key;
	}

	// ---- the fishing village's fenced yards
	function villageYards() {
		const out = [];
		for (const f of world()?.village?.footprints || []) {
			if (!f.fence) continue;
			const key = keyOf(f.x + 0.25, f.z);
			if (!yards.has(key)) {
				const r = rng(key);
				const c = Math.cos(f.face), s = Math.sin(f.face);
				const at = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
				const heads = [];
				const add = (lx, lz, f0, arc, R, zone) => { const [x, z] = at(lx, lz); const h = head(x, z, 1, f0 - f.face, arc, R, r); h.zone = zone; heads.push(h); };
				const R = Math.min(5, f.fzF - 2);
				add(-f.fx + 0.5, f.fzF - 0.6, -Math.PI / 2, Math.PI / 2, R, 0);
				add(f.fx - 0.5, f.fzF - 0.6, -Math.PI, Math.PI / 2, R, 0);
				add(0, f.fzB + 0.5, 0, Math.PI, Math.min(4, -f.fzB - 1), 1);
				yards.set(key, { x: f.x, z: f.z, heads, timer: houseTimer(key), zones: 2 });
			}
			out.push(key);
		}
		return out;
	}

	// what is in reach, rescanned as you move; new yards worked out a few at a time
	function scan(cam, dt) {
		const x = cam.position.x, z = cam.position.z;
		scanT -= dt;
		if (Math.hypot(x - scanX, z - scanZ) > 15 || scanT < 0) {
			scanX = x; scanZ = z; scanT = 4;
			const W = world(), keys = new Set(villageYards());
			queue = [];
			if (W?.real?.loaded?.()) {
				const seen = new Set();
				for (const b of W.real.near('boxes', x, z, REACH)) {
					if (!b.grp || b.grp.biz || b.grp.shut || seen.has(b.grp)) continue;
					seen.add(b.grp);
					queue.push(() => houseYard(b.grp));
				}
				for (let i = Math.floor((x - REACH) / CELL); i <= Math.floor((x + REACH) / CELL); i++) for (let j = Math.floor((z - REACH) / CELL); j <= Math.floor((z + REACH) / CELL); j++) {
					if (Math.hypot((i + 0.5) * CELL - x, (j + 0.5) * CELL - z) < REACH) queue.push(() => parkCell(i, j));
				}
			}
			for (const grp of W?.city?.procHomes?.(x, z, REACH) || []) queue.push(() => houseYard(grp));
			// (the ground under the heads looked at again: it may have loaded since)
			for (const k of live) for (const h of yards.get(k)?.heads || []) h.y = 0;
			live.length = 0;
			for (const k of keys) live.push(k);
			queue.reverse();
		}
		// (a few milliseconds a frame at most)
		const t0 = performance.now();
		while (queue.length && performance.now() - t0 < (isPhone ? 1 : 2)) {
			const k = queue.pop()();
			if (k != null && !live.includes(k)) live.push(k);
		}
		// let the far ones go
		if (yards.size > 4000) for (const [k, Y] of yards) if (!Y || Math.hypot(Y.x - x, Y.z - z) > REACH * 3) yards.delete(k);
	}

	// the heads in reach with what they are doing at this hour: on (0/1) and how wet their grass is
	let lastH = null;
	function heads(cam, hours, dt, force, rain, rise = 6) {
		scan(cam, dt);
		// (how far the clock ran since the last frame; a jump of the clock is not a run)
		const run = lastH == null ? 0 : since(hours, lastH), step = run < 2 ? run : 0;
		lastH = hours;
		const out = [];
		for (const k of live) {
			const Y = yards.get(k);
			if (!Y) continue;
			const runs = Y.runs || timerRuns(Y.timer, rise);
			for (const h of Y.heads) {
				if (!h.y) h.y = ground(h.x, h.z) + 0.1;
				let on = force ? 1 : 0, wet = force ? 1 : 0;
				for (const [s, e] of runs) {
					const d = e - s, z0 = s + d * h.zone / Y.zones, z1 = s + d * (h.zone + 1) / Y.zones;
					const a = since(hours, z0);
					// (on in its window, or if the clock ran right past its start since the last frame)
					if (a < z1 - z0 || a <= step) { if (!rain) on = 1; wet = Math.max(wet, Math.min(1, 0.3 + Math.min(a, z1 - z0) * 6)); }
					else wet = Math.max(wet, 1 - (a - (z1 - z0)) / 2.5);
				}
				h.on = on;
				h.wet = Math.max(0, wet);
				out.push(h);
			}
		}
		return out;
	}
	return { heads, count: () => live.length, reset() { yards.clear(); live.length = 0; scanX = 1e9; } };
}
