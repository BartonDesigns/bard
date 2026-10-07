// Ball fields: a baseball diamond, a soccer pitch and an American football field, laid out to
// regulation wherever an open, level, grassy piece of park has room for one.
// Where they come from:
//   the Bay Area's mapped towns: the pitches in the land-use map (their shape says which
//     sport: a long narrow one is a football field, a squarer one a diamond), and the lawns
//     of the parks that have a playground (so not a cemetery's);
//   the parks the agencies run (nature/parks.js) that list a ball field or soccer, a few of
//     San Francisco's own (Golden Gate Park's, the Marina Green), and the parks of the towns
//     the civilization engine grows;
//   the island (Earth's, and every other world's): on the open ground above the village,
//     off the paths, the ground made level under them before anything grows there.
// The Bay's are found in tiles as you near them (the arcade offers their games within two
// kilometres), built within a kilometre and dropped past one and a half. The trees
// (city.js) and the park furniture (parkkit.js) keep off them: inClearing().
// A field is drawn in its own frame: y up, the play running along -z (from the plate out to
// centre field; from one goal to the other), laid over the ground as it lies; the games
// (games/baseball.js, soccer.js, football.js) build the same field round their stage.
// Worlds that aren't green get an arena of their own instead (arenas.js): the island's plan
// is handed the world's profile to know which.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARKS } from './nature/parks.js';
import { toWorld } from './bay/geo.js';
import { THEMES, arenaSpec, arenaSpot, arenaTheme, arenaDeck, buildArena, hotBallLayer } from './arenas.js';

const YD = 0.9144;
const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
export const LABEL = { baseball: 'Baseball diamond', soccer: 'Soccer pitch', football: 'Football field', arena: 'Arena' };
const label = (f) => (f.kind === 'arena' ? THEMES[f.theme].label : LABEL[f.kind]);

// ---------- the shapes ----------
// a field's dimensions, and the rectangle it takes (its frame: x0, x1, z0, z1)
export function fieldSpec(kind, size = 'full') {
	// (an arena's size is its theme)
	if (kind === 'arena') return arenaSpec(size);
	if (kind === 'baseball') {
		const d = size === 'full' ? { base: 27.43, mound: 18.44, fence: 99, back: 15 } : { base: 18.29, mound: 14.02, fence: 61, back: 8 };
		return { kind, size, d, rect: [-(d.fence * 0.72 + 9), d.fence * 0.72 + 9, -(d.fence + 4), d.back + 3] };
	}
	if (kind === 'soccer') {
		const d = size === 'full' ? { L: 100, W: 64 } : { L: 72, W: 46 };
		return { kind, size, d, rect: [-d.W / 2 - 8, d.W / 2 + 8, -d.L / 2 - 5, d.L / 2 + 5] };
	}
	const d = { L: 120 * YD, W: 160 / 3 * YD };
	return { kind: 'football', size: 'full', d, rect: [-d.W / 2 - 9, d.W / 2 + 9, -d.L / 2 - 4, d.L / 2 + 4] };
}
// whether a point of the rectangle is part of the field (a diamond is a fan, not a box)
function uses(f, lx, lz) {
	if (f.kind !== 'baseball') return true;
	const R = f.d.fence;
	if (lz > -f.d.base * 0.3) return Math.abs(lx) < f.d.base * 0.9 + 6 || lz < -Math.abs(lx) + 12;
	return Math.hypot(lx, lz) < R + 4 && -lz > Math.abs(lx) - 12;
}
// the frame to the world and back (the frame turned by yaw, as three turns an object)
export function toFrame(f, x, z) { const c = Math.cos(f.yaw), s = Math.sin(f.yaw), dx = x - f.x, dz = z - f.z; return [c * dx - s * dz, s * dx + c * dz]; }
export function fromFrame(f, lx, lz) { const c = Math.cos(f.yaw), s = Math.sin(f.yaw); return [f.x + c * lx + s * lz, f.z - s * lx + c * lz]; }
function inside(f, x, z, pad = 0) {
	const [lx, lz] = toFrame(f, x, z), [x0, x1, z0, z1] = f.rect;
	if (lx < x0 - pad || lx > x1 + pad || lz < z0 - pad || lz > z1 + pad) return false;
	return pad > 0 ? uses(f, Math.sign(lx) * Math.max(0, Math.abs(lx) - pad), lz + (lz < 0 ? pad : -pad)) : uses(f, lx, lz);
}
// where each game is played from on a field: [x, z] in its frame, facing -z
export function playSpot(f) {
	if (f.kind === 'arena') return arenaSpot(f);
	if (f.kind === 'baseball') return [0, 0];
	if (f.kind === 'soccer') return [0, -f.d.L / 2 + 11];
	return [0, -f.d.L / 2 + 10 * YD + 20 * YD];
}

// ---------- the clearings: every field there is, for the trees and the furniture to keep off ----------
const REG = { list: [], grid: new Map(), v: 0 };
const GC = 64;
function register(f) {
	REG.list.push(f);
	const r = f.rad + 16;
	for (let i = Math.floor((f.x - r) / GC); i <= Math.floor((f.x + r) / GC); i++) for (let j = Math.floor((f.z - r) / GC); j <= Math.floor((f.z + r) / GC); j++) {
		const k = i + ',' + j;
		(REG.grid.get(k) || REG.grid.set(k, []).get(k)).push(f);
	}
}
// on a field (with a margin round it)?
export function inClearing(x, z, pad = 0) {
	const g = REG.grid.get(Math.floor(x / GC) + ',' + Math.floor(z / GC));
	if (!g) return false;
	for (const f of g) if (inside(f, x, z, pad + 3)) return true;
	return false;
}
// (bumped when a field is laid out near enough to have trees already standing on it)
export const clearingVersion = () => REG.v;

function finish(f, name, src) {
	const S = fieldSpec(f.kind, f.size);
	Object.assign(f, S, { name, src, id: `${f.kind}:${Math.round(f.x)}:${Math.round(f.z)}` });
	const [x0, x1, z0, z1] = f.rect;
	f.rad = Math.max(Math.hypot(x0, z0), Math.hypot(x1, z0), Math.hypot(x0, z1), Math.hypot(x1, z1));
	// the venue: arriving on the field (its middle and reach), and the spot it's played from
	const mid = f.kind === 'baseball' ? [0, -f.d.fence * 0.45] : [0, 0];
	const [cx, cz] = fromFrame(f, ...mid), [sx, sz] = fromFrame(f, ...playSpot(f));
	f.site = { name, x: cx, z: cz, r: f.kind === 'baseball' ? f.d.fence * 0.6 : Math.max(f.d.L, f.d.W) / 2 + 4, field: f, spot: { x: sx, z: sz, yaw: f.yaw } };
	// (how far a point is from the field itself: nothing inside it, the metres to its edge outside)
	f.site.dist = (x, z) => {
		const [lx, lz] = toFrame(f, x, z), [x0, x1, z0, z1] = f.rect;
		if (inside(f, x, z)) return 0;
		return Math.max(1, Math.hypot(Math.max(0, x0 - lx, lx - x1), Math.max(0, z0 - lz, lz - z1)));
	};
	return f;
}

// the test a layout has to pass: every point it uses clear (ok), off every other field, and
// its ground within `range` metres top to bottom; returns the range, or -1
function fits(f, ok, H, range, step = 6) {
	const [x0, x1, z0, z1] = f.rect;
	let lo = Infinity, hi = -Infinity;
	for (let lz = z0; lz <= z1 + 0.01; lz += (z1 - z0) / Math.ceil((z1 - z0) / step)) for (let lx = x0; lx <= x1 + 0.01; lx += (x1 - x0) / Math.ceil((x1 - x0) / step)) {
		if (!uses(f, lx, lz)) continue;
		const [x, z] = fromFrame(f, lx, lz);
		if (!ok(x, z) || inClearing(x, z, 6)) return -1;
		const h = H(x, z);
		lo = Math.min(lo, h); hi = Math.max(hi, h);
		if (hi - lo > range) return -1;
	}
	return hi - lo;
}

// ---------- the island's fields, planned before anything grows ----------
// The open ground a few hundred metres above the village: level enough, off the paths, out of
// the village. One of each sport where they fit, the ground under each made level (the
// heights are the island's own, before its ground and plants are made from them). Returns the
// fields and the circles nothing is to grow in.
export function planIslandFields(island, profile = null) {
	REG.list.length = 0; REG.grid.clear();
	// no ball fields on an airless world
	if (profile?.airless) return { fields: [], clear: [] };
	const theme = arenaTheme(profile);
	const V = island.village || { x: 0, z: 0 }, H = island.heightAt;
	const ok = (x, z) => {
		const h = H(x, z);
		if (h < 2.2 || h > island.peak.h * 0.7) return false;
		if (island.maskAt(x, z, 0) > 0.04 || island.maskAt(x, z, 1) > 0.02) return false;
		return Math.hypot(x - V.x, z - V.z) > 150;
	};
	const out = [], R = island.R * 0.95;
	for (const [kind, size] of theme ? [['arena', theme]] : [['soccer', 'full'], ['baseball', 'youth'], ['football', 'full'], ['soccer', 'youth']]) {
		if (out.some((f) => f.kind === kind)) continue;
		const cand = [];
		for (let z = -R; z <= R; z += 34) for (let x = -R; x <= R; x += 34) {
			const dv = Math.hypot(x - V.x, z - V.z);
			if (dv < 200 || dv > 900 || !ok(x, z)) continue;
			for (let k = 0; k < 4; k++) {
				const f = { kind, size, x, z, yaw: k * Math.PI / 4 + hh(x, z) * 0.3, ...fieldSpec(kind, size) };
				const r = fits(f, ok, H, 7, 8);
				if (r >= 0) cand.push({ f, score: r + Math.abs(dv - 380) * 0.012 });
			}
		}
		// the best of them that a closer look (along the paths' edges) still passes
		cand.sort((a, b) => a.score - b.score);
		const best = cand.slice(0, 24).find((c) => fits(c.f, ok, H, 7, 3) >= 0);
		if (!best) continue;
		const f = finish(best.f, `${label(best.f)} above the village`, 'island');
		f.y = level(island, f);
		out.push(f); register(f);
	}
	// nothing grows on them: circles down each field's length
	const clear = [];
	for (const f of out) {
		const [x0, x1, z0, z1] = f.rect, w = x1 - x0, r = w / 2 + 2;
		for (let lz = z0 + r * 0.6; lz < z1 + r * 0.6; lz += r * 0.9) { const [x, z] = fromFrame(f, (x0 + x1) / 2, Math.min(z1, lz)); clear.push({ x, z, r: r - 3 }); }
	}
	return { fields: out, clear };
}
// the island's ground made level under a field, eased back into the hillside round it; and
// its grass kept short (the path mask: the long grass doesn't grow on a path)
function level(island, f) {
	const { N, cell, half, height, masks } = island;
	const [x0, x1, z0, z1] = f.rect;
	let sum = 0, n = 0;
	for (let lz = z0; lz <= z1; lz += 6) for (let lx = x0; lx <= x1; lx += 6) { const [x, z] = fromFrame(f, lx, lz); sum += island.heightAt(x, z); n++; }
	const y = sum / n, EASE = 16;
	const r = f.rad + EASE + cell;
	const i0 = Math.max(0, Math.floor((f.x - r + half) / cell)), i1 = Math.min(N - 1, Math.ceil((f.x + r + half) / cell));
	const j0 = Math.max(0, Math.floor((f.z - r + half) / cell)), j1 = Math.min(N - 1, Math.ceil((f.z + r + half) / cell));
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
		const [lx, lz] = toFrame(f, -half + i * cell, -half + j * cell);
		const d = Math.hypot(Math.max(0, x0 - 2 - lx, lx - x1 - 2), Math.max(0, z0 - 2 - lz, lz - z1 - 2));
		if (d >= EASE) continue;
		const t = d / EASE, w = 1 - t * t * (3 - 2 * t), k = j * N + i;
		height[k] = height[k] * (1 - w) + y * w;
		const wx = -half + i * cell, wz = -half + j * cell, worn = inside(f, wx, wz, 0) ? 128 : inside(f, wx, wz, 3) ? 70 : 0;
		if (masks && worn > masks[k * 4]) masks[k * 4] = worn;
	}
	return y;
}

// ---------- the Bay Area's fields, found tile by tile ----------
const TILE = 800, FIND = 2600;
// San Francisco's own (no land-use map there): Golden Gate Park's fields and the Marina Green
const KNOWN = [
	['soccer', 'full', 'Beach Chalet fields, Golden Gate Park', 37.7692, -122.5072, 0],
	['soccer', 'full', 'Beach Chalet fields, Golden Gate Park', 37.7692, -122.5055, 0],
	['soccer', 'full', 'Polo Field, Golden Gate Park', 37.7688, -122.4928, Math.PI / 2],
	['baseball', 'full', 'Big Rec, Golden Gate Park', 37.7672, -122.4648, Math.PI * 0.75],
	['football', 'full', 'Kezar Stadium', 37.7668, -122.4572, 0],
	['soccer', 'full', 'Marina Green', 37.8068, -122.4385, Math.PI / 2],
];

function tileOf(x, z) { return [Math.floor(x / TILE), Math.floor(z / TILE)]; }

// the land round a tile, cell by cell (8 m): what's there, and what a field can't go on
function survey(W, tx, tz) {
	const C = 8, M = 160, x0 = tx * TILE - M, z0 = tz * TILE - M, n = Math.ceil((TILE + 2 * M) / C);
	const lu = new Uint8Array(n * n).fill(255), block = new Uint8Array(n * n), real = W.real, bay = W.bayArea;
	let mapped = false;
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C, k = j * n + i;
		const L = real?.landAt?.(x, z);
		if (L) {
			mapped = true; lu[k] = L.lu;
			if (L.roof > 0.12 || L.road > 0.3 || L.lu === 1 || L.lu === 7 || L.lu === 8 || L.lu === 13) block[k] = 1;
		} else if (bay.urbanAt(x, z).u > 0.12) block[k] = 2;          // (a town's grid: only the known fields go there)
		if (bay.heightAt(x, z) < 0.8 || W.lake?.waterAt?.(x, z) != null) block[k] = 1;
	}
	const cellAt = (x, z) => { const i = Math.floor((x - x0) / C), j = Math.floor((z - z0) / C); return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i; };
	// the streets, the park paths and the buildings: the cells they cross
	const mark = (ax, az, bx, bz, hw) => {
		const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / 3));
		for (let s = 0; s <= steps; s++) {
			const px = ax + (bx - ax) * s / steps, pz = az + (bz - az) * s / steps;
			for (let dz = -hw; dz <= hw; dz += 3) for (let dx = -hw; dx <= hw; dx += 3) { const k = cellAt(px + dx, pz + dz); if (k >= 0) block[k] = 1; }
		}
	};
	if (mapped && real?.near) {
		const cx = tx * TILE + TILE / 2, cz = tz * TILE + TILE / 2, rad = TILE * 0.72 + M;
		for (const r of real.near('roads', cx, cz, rad)) { const p = r.pts, hw = (r.w || 4) / 2 + (r.drive ? 2 : 0.5); for (let i = 0; i + 3 < p.length; i += 2) mark(p[i], p[i + 1], p[i + 2], p[i + 3], hw); }
		for (const b of real.near('boxes', cx, cz, rad)) mark(b.x, b.z, b.x, b.z, Math.max(b.w || 8, b.d || 8) / 2 + 2);
		for (const pond of real.ponds?.() || []) for (const q of pond) mark(q.x, q.z, q.x, q.z, 8);
	}
	return { x0, z0, n, C, lu, block, mapped, cellAt };
}

export function createSportsFields({ scene, getWorld, isPhone = false, plan = null }) {
	REG.list.length = 0; REG.grid.clear(); REG.v++;
	const all = [];
	for (const f of plan?.fields || []) { all.push(f); register(f); }
	const root = new THREE.Group();
	root.name = 'sportsfields';
	scene.add(root);
	const built = new Map(), hidden = new Set(), done = new Set();
	const M = fieldMaterials();
	// (bump: the trees near you to be planted again round new fields, at most every couple of seconds)
	let cool = 0, known = null, realV = -1, bump = false, bumpT = 0, aimed = false;
	const unmapped = new Set(), placed = new Set();

	const H = (x, z) => getWorld()?.island.heightAt(x, z) ?? 0;
	function add(f) {
		all.push(f); register(f);
		const C = getWorld()?.player?.state?.pos;
		if (C && Math.hypot(f.x - C.x, f.z - C.z) < 1500) bump = true;
	}

	// the park a field is in, for its name
	const PK = PARKS.map((p) => ({ name: p.name, ...toWorld(p.lat, p.lon), p }));
	function placeName(W, x, z) {
		let best = null, bd = 900;
		for (const p of PK) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.name; } }
		if (best) return best;
		for (const q of W.real?.genParks?.() || []) if (Math.hypot(q.x - x, q.z - z) < Math.max(q.hw, q.hd) + 40) return `${q.town} park`;
		let town = null; bd = 4000;
		for (const t of W.bayArea?.towns || []) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; town = t.name; } }
		return town;
	}
	const named = (W, kind, x, z) => { const p = placeName(W, x, z); return p ? `${LABEL[kind]} · ${p}` : LABEL[kind]; };

	// try layouts in turn: the first that fits (or the most level of those tried)
	function tryAll(list, ok, range) {
		let best = null;
		for (const f of list) {
			const r = fits(f, ok, H, range);
			if (r >= 0 && (!best || r < best.r)) { best = { f, r }; if (r < range * 0.4) break; }
		}
		return best?.f || null;
	}

	function scanTile(W, tx, tz) {
		const S = survey(W, tx, tz), inTile = (x, z) => tileOf(x, z)[0] === tx && tileOf(x, z)[1] === tz;
		const free = (allow) => (x, z) => { const k = S.cellAt(x, z); return k >= 0 && !S.block[k] && (!allow || allow.has(S.lu[k])); };
		let count = 0;
		// (each park, playground and known field gives one field, however often its tile is looked at)
		const put = (f, src, key) => { if (!f || count >= 4 || placed.has(key)) return; if (key) placed.add(key); add(finish(f, named(W, f.kind, f.x, f.z), src)); count++; };
		const lay = (kind, size, x, z, yaw) => ({ kind, size, x, z, yaw, ...fieldSpec(kind, size) });
		// 1. the mapped pitches: each blob of pitch in the land-use map, its shape read for its sport
		if (S.mapped) {
			const { n, lu, C } = S, seen = new Uint8Array(n * n);
			for (let k0 = 0; k0 < n * n; k0++) {
				if (lu[k0] !== 4 || seen[k0]) continue;
				const cells = [], q = [k0];
				seen[k0] = 1;
				while (q.length) {
					const k = q.pop(), i = k % n, j = (k - i) / n;
					cells.push(k);
					for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b, kk = jj * n + ii; if (ii >= 0 && jj >= 0 && ii < n && jj < n && !seen[kk] && lu[kk] === 4) { seen[kk] = 1; q.push(kk); } }
				}
				if (cells.length * C * C < 3000) continue;
				// (a golf course's tees and greens are pitch-coloured too)
				let mx = 0, mz = 0, golf = false;
				for (const k of cells) { const i = k % n, j = (k - i) / n; mx += i; mz += j; for (const [a, b] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (lu[(j + b) * n + i + a] === 3) golf = true; }
				if (golf) continue;
				mx /= cells.length; mz /= cells.length;
				let cxx = 0, czz = 0, cxz = 0;
				for (const k of cells) { const i = k % n, j = (k - i) / n; cxx += (i - mx) ** 2; czz += (j - mz) ** 2; cxz += (i - mx) * (j - mz); }
				const th = 0.5 * Math.atan2(2 * cxz, cxx - czz), ux = Math.cos(th), uz = Math.sin(th);
				let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
				for (const k of cells) { const i = k % n, j = (k - i) / n, u = (i - mx) * ux + (j - mz) * uz, v = -(i - mx) * uz + (j - mz) * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
				const Lu = (u1 - u0 + 1) * C, Lv = (v1 - v0 + 1) * C, um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
				const wx = S.x0 + (mx + um * ux - vm * uz + 0.5) * C, wz = S.z0 + (mz + um * uz + vm * ux + 0.5) * C;
				if (!inTile(wx, wz)) continue;
				const long = Math.max(Lu, Lv), short = Math.min(Lu, Lv), aspect = long / short;
				// the long axis as a yaw (the frame's z along it)
				const along = Lu >= Lv ? Math.atan2(ux, uz) : Math.atan2(-uz, ux);
				const ok = free(new Set([4, 2, 6, 5, 0, 11, 12, 255]));
				const tries = [];
				if (aspect > 1.85 && long > 100) tries.push(lay('football', 'full', wx, wz, along), lay('football', 'full', wx, wz, along + Math.PI));
				if (aspect > 1.25 && long > 66) for (const sz of long > 96 && short > 60 ? ['full', 'youth'] : ['youth']) tries.push(lay('soccer', sz, wx, wz, along), lay('soccer', sz, wx, wz, along + Math.PI));
				if (aspect <= 1.5 && short > 55) {
					// a diamond sits in its square with the plate in a corner: try each corner
					for (const sz of short > 95 ? ['full', 'youth'] : ['youth']) {
						const R = fieldSpec('baseball', sz).d.fence;
						for (let c = 0; c < 4; c++) {
							const a = along + Math.PI / 4 + c * Math.PI / 2, fx = -Math.sin(a), fz = -Math.cos(a);
							tries.push(lay('baseball', sz, wx - fx * R * 0.45, wz - fz * R * 0.45, a));
						}
					}
				}
				put(tryAll(tries, ok, 3.5), 'pitch');
			}
			// 2. a park's lawn (a park: it has a playground on it): room for one field, off its paths
			const park = free(new Set([2, 4]));
			for (let k0 = 0; k0 < n * n && count < 3; k0 += 1) {
				if (lu[k0] !== 5 || seen[k0] === 2) continue;
				const i0 = k0 % n, j0 = (k0 - i0) / n;
				// (one try per playground, round it out to 200 m)
				for (let j = Math.max(0, j0 - 25); j <= Math.min(n - 1, j0 + 25); j++) for (let i = Math.max(0, i0 - 25); i <= Math.min(n - 1, i0 + 25); i++) seen[j * n + i] = 2;
				const px = S.x0 + (i0 + 0.5) * C, pz = S.z0 + (j0 + 0.5) * C;
				if (!inTile(px, pz)) continue;
				const kinds = [['soccer', 'full'], ['baseball', 'youth'], ['football', 'full'], ['soccer', 'youth']], r0 = hh(px, pz), tries = [];
				for (let m = 0; m < kinds.length; m++) {
					const [kind, size] = kinds[(m + Math.floor(r0 * 3)) % kinds.length];
					for (let t = 0; t < 26; t++) {
						const a = hh(px + t, pz - m) * Math.PI * 2, d = 50 + hh(px - t, pz + m) * 130, yaw = Math.floor(hh(t, m + px) * 8) * Math.PI / 4;
						tries.push(lay(kind, size, px + Math.cos(a) * d, pz + Math.sin(a) * d, yaw));
					}
				}
				if (!placed.has('pg' + Math.round(px) + ',' + Math.round(pz))) put(tryAll(tries, park, 2.5), 'park', 'pg' + Math.round(px) + ',' + Math.round(pz));
			}
		}
		// 3. the generated towns' parks: along the park, inside its path round the lawn
		for (const q of W.real?.genParks?.() || []) {
			if (!q.big || !inTile(q.x, q.z)) continue;
			const ca = Math.cos(q.a), sa = Math.sin(q.a);
			const inPark = (x, z) => { const dx = x - q.x, dz = z - q.z, a = dx * ca + dz * sa, b = -dx * sa + dz * ca; return Math.abs(a) < q.hw - 11 && Math.abs(b) < q.hd - 11; };
			const ok = (x, z) => inPark(x, z) && free(null)(x, z);
			const long = q.hw > q.hd ? Math.atan2(ca, sa) : Math.atan2(-sa, ca), tries = [];
			for (const [kind, size] of [['football', 'full'], ['soccer', 'full'], ['baseball', 'full'], ['soccer', 'youth'], ['baseball', 'youth']]) for (const off of [0, -0.25, 0.25]) for (const flip of [0, Math.PI]) {
				const L = Math.max(q.hw, q.hd) * off;
				tries.push(lay(kind, size, q.x + Math.sin(long) * L, q.z + Math.cos(long) * L, long + flip + (kind === 'baseball' ? Math.PI / 4 : 0)));
			}
			if (!placed.has('gp' + q.x)) put(tryAll(tries, ok, 3), 'town', 'gp' + q.x);
		}
		// 4. the agencies' parks with ball fields
		for (const p of PK) {
			const am = p.p.amenities || [];
			const want = [am.includes('soccer') && 'soccer', (am.includes('softball') || am.includes('baseball')) && 'baseball'].filter(Boolean);
			if (!want.length || !inTile(p.x, p.z)) continue;
			for (const kind of want) {
				const tries = [];
				for (let t = 0; t < 60; t++) {
					const a = hh(p.x + t, p.z) * Math.PI * 2, d = 40 + hh(p.z, p.x - t) * 260;
					tries.push(lay(kind, kind === 'baseball' ? 'youth' : 'full', p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, Math.floor(hh(t, p.x) * 8) * Math.PI / 4));
				}
				if (!placed.has(p.name + kind)) put(tryAll(tries, free(new Set([2, 4, 6, 0, 11, 12, 255])), 3), 'agency', p.name + kind);
			}
		}
		// 5. San Francisco's own
		known ||= KNOWN.map(([kind, size, name, lat, lon, yaw]) => ({ kind, size, name, yaw, ...toWorld(lat, lon) }));
		for (const k of known) {
			if (!inTile(k.x, k.z) || placed.has(k.name + k.x)) continue;
			const f = lay(k.kind, k.size, k.x, k.z, k.yaw);
			if (fits(f, (x, z) => { const c = S.cellAt(x, z); return c >= 0 && S.block[c] !== 1; }, H, 5) >= 0) { placed.add(k.name + k.x); add(finish(f, `${LABEL[k.kind]} · ${k.name}`, 'known')); count++; }
		}
		return S.mapped;
	}

	// ---------- built near, dropped far ----------
	function build(f) {
		const W = getWorld();
		const g = new THREE.Group();
		g.position.set(f.x, 0, f.z); g.rotation.y = f.yaw;
		const out = buildField(f, (lx, lz) => { const [x, z] = fromFrame(f, lx, lz); return W.island.heightAt(x, z); }, { M, res: isPhone ? 8 : 14, shadows: !isPhone });
		g.add(out.group);
		g.visible = !hidden.has(f.id);
		root.add(g);
		// (a magma arena: the fresh balls the volcano has dropped on it)
		const hot = f.theme === 'magma' ? hotBallLayer(f) : null;
		if (hot) { g.add(hot.group); out.tex.push(...hot.tex); }
		// the posts and fences, in the world, for walking into
		const walls = out.walls.map(([ax, az, bx, bz, r, top]) => { const a = fromFrame(f, ax, az), b = fromFrame(f, bx, bz); return [a[0], a[1], b[0], b[1], r, top]; });
		built.set(f, { g, walls, tex: out.tex, tick: out.tick, hot, H: (lx, lz) => { const [x, z] = fromFrame(f, lx, lz); return W.island.heightAt(x, z); } });
	}
	function drop(f) {
		const B = built.get(f);
		B.g.traverse((o) => o.geometry?.dispose());
		for (const t of B.tex) t.dispose();
		B.g.traverse((o) => { if (o.material && !M.shared.has(o.material)) o.material.dispose(); });
		root.remove(B.g);
		built.delete(f);
	}

	function update(dt, camera) {
		const W = getWorld();
		if (!W) return;
		const x = camera.position.x, z = camera.position.z;
		// the Bay's tiles round you, nearest first, a few milliseconds' worth a frame
		// (a mapped town's data arriving late: the tiles looked at without it are looked at again)
		const rv = W.real?.version?.() ?? 0;
		if (rv !== realV) { realV = rv; for (const k of unmapped) done.delete(k); unmapped.clear(); }
		if (W.bayArea?.loaded() && camera.position.y < 3000 && (!W.real || W.real.loaded())) {
			const t0 = performance.now(), [cx, cz] = tileOf(x, z), R = Math.ceil(FIND / TILE), todo = [];
			for (let j = cz - R; j <= cz + R; j++) for (let i = cx - R; i <= cx + R; i++) {
				const k = i + ',' + j, d = Math.hypot((i + 0.5) * TILE - x, (j + 0.5) * TILE - z);
				if (!done.has(k) && d < FIND + TILE * 0.7) todo.push([d, i, j, k]);
			}
			todo.sort((a, b) => a[0] - b[0]);
			for (const [, i, j, k] of todo) {
				if (performance.now() - t0 > 6) break;
				done.add(k);
				// (the island's own heights are its own: no tiles out over it)
				if (Math.max(Math.abs((i + 0.5) * TILE), Math.abs((j + 0.5) * TILE)) < (W.island.half || 1300) + 200) continue;
				try { if (!scanTile(W, i, j)) unmapped.add(k); } catch (err) { console.warn('[fields]', k, err); }
			}
		}
		if (bump && performance.now() > bumpT) { bump = false; bumpT = performance.now() + 2000; REG.v++; }
		// the arenas: what moves on them, and the volcano's bombs asked to land on a magma one
		for (const B of built.values()) {
			if (!B.g.visible) continue;
			B.tick?.(dt, camera);
			B.hot?.update(performance.now() / 1000, B.H);
		}
		if (W.volcano?.aims && !aimed) aimed = aimBombs(W.volcano.aims, all);
		cool -= dt;
		const near = isPhone ? 750 : 1100;
		for (const f of all) {
			const d = Math.hypot(f.x - x, f.z - z) - f.rad;
			if (!built.has(f) && d < near && cool <= 0 && camera.position.y - H(x, z) < 1500) { try { build(f); } catch (err) { console.warn('[fields] build', f.id, err); built.set(f, { g: new THREE.Group(), walls: [], tex: [] }); } cool = 0.3; }
			else if (built.has(f) && d > near + 500) drop(f);
		}
	}
	// the fields round a point, with their venues (nearest first)
	function near(x, z, R) {
		return all.map((f) => [f.site.dist(x, z), f]).filter(([d]) => d < R).sort((a, b) => a[0] - b[0]).map(([, f]) => f);
	}
	// walking into the posts, the fences, the dugouts, the stands
	function push(p, footY) {
		for (const [f, B] of built) {
			if (Math.abs(f.x - p.x) > f.rad + 10 || Math.abs(f.z - p.z) > f.rad + 10) continue;
			for (const [ax, az, bx, bz, r, top] of B.walls) {
				if (footY > top) continue;
				const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / l2));
				const qx = p.x - ax - dx * t, qz = p.z - az - dz * t, d = Math.hypot(qx, qz), R = r + 0.3;
				if (d < R && d > 1e-4) { p.x += qx / d * (R - d); p.z += qz / d * (R - d); }
			}
		}
	}
	// a game played on a field hides the field's own copy (it builds its own round its stage)
	function hide(f, on) {
		if (on) hidden.add(f.id); else hidden.delete(f.id);
		const B = built.get(f);
		if (B) B.g.visible = !on;
	}
	// a raised arena's floor (the rune court, the pool's deck, the sky platform), walked on
	function floor(x, z, y) {
		const g = REG.grid.get(Math.floor(x / GC) + ',' + Math.floor(z / GC));
		if (!g) return -Infinity;
		for (const f of g) {
			if (f.kind !== 'arena' || !THEMES[f.theme].lift) continue;
			const [lx, lz] = toFrame(f, x, z), d = arenaDeck(f, lx, lz);
			if (d === null) continue;
			const top = H(x, z) + d;
			if (y > top - 1.4) return top;
		}
		return -Infinity;
	}
	return { group: root, update, near, push, hide, floor, list: () => all.slice(), built: () => built.size };
}

// The volcano's bombs, some of them, sent to land on a magma arena (planet/volcano.js asks
// aims.target() for somewhere to throw one, and tells aims.landed() where it came down):
// one every few seconds at most, somewhere on the court; one that lands there lies as a
// fresh magma ball (arenas.js draws them; the game counts them).
function aimBombs(aims, all) {
	const f = all.find((q) => q.kind === 'arena' && q.theme === 'magma');
	if (!f) return true;
	let last = 0;
	f.hot ||= [];
	aims.target = () => {
		const now = performance.now() / 1000;
		if (now - last < 3.5 || Math.random() > 0.2) return null;
		last = now;
		const { L, W } = f.d, [x, z] = fromFrame(f, (Math.random() - 0.5) * (W - 6), (Math.random() - 0.5) * (L - 8));
		return { x, z, size: 0.45 };
	};
	aims.landed = (x, y, z) => {
		const [lx, lz] = toFrame(f, x, z), { L, W } = f.d;
		if (Math.abs(lx) > W / 2 + 8 || Math.abs(lz) > L / 2 + 8) return;
		// (one that came down in the moat rolls up onto the court)
		f.hot.push({ lx: Math.max(-W / 2 + 1, Math.min(W / 2 - 1, lx)), lz: Math.max(-L / 2 + 1, Math.min(L / 2 - 1, lz)), born: performance.now() / 1000 });
		if (f.hot.length > 8) f.hot.shift();
	};
	return true;
}

// ---------- drawing a field ----------
// the materials the fields share (a game's own copy makes its own, and frees them after)
export function fieldMaterials() {
	const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.75, ...o });
	const tile = (draw, px = 64) => { const c = document.createElement('canvas'); c.width = c.height = px; draw(c.getContext('2d'), px); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
	// chain link: a diamond mesh of wire, 16 to the metre
	const chainT = tile((g, s) => { g.strokeStyle = 'rgba(200,205,210,0.95)'; g.lineWidth = 2.2; for (let k = -s; k <= s * 2; k += s / 4) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + s, s); g.stroke(); g.beginPath(); g.moveTo(k + s, 0); g.lineTo(k, s); g.stroke(); } });
	chainT.repeat.set(4, 4);
	// a goal's net: a square mesh of white cord
	const netT = tile((g, s) => { g.strokeStyle = 'rgba(250,250,250,0.95)'; g.lineWidth = 3; for (let k = 0; k <= s; k += s / 2) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, s); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(s, k); g.stroke(); } });
	netT.repeat.set(8, 8);
	const M = {
		white: S('#f2f2ee', { roughness: 0.45 }), steel: S('#b8bcc0', { metalness: 0.6, roughness: 0.35 }), yellow: S('#f0c030', { roughness: 0.45 }),
		dirt: S('#b0744a', { roughness: 1 }), wood: S('#8a6a48', { roughness: 0.85 }), roof: S('#2f4f66', { metalness: 0.3, roughness: 0.5 }), block: S('#a8a296', { roughness: 0.9 }),
		screen: S('#1e4a2e', { roughness: 0.9 }), pad: S('#1d3f7a', { roughness: 0.7 }), orange: S('#ff6a1a', { side: THREE.DoubleSide, roughness: 0.6 }), alu: S('#c4c8cc', { metalness: 0.7, roughness: 0.3 }),
		chain: new THREE.MeshStandardMaterial({ map: chainT, color: 0xffffff, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: false, metalness: 0.5, roughness: 0.4 }),
		net: new THREE.MeshStandardMaterial({ map: netT, color: 0xffffff, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8 }),
	};
	M.shared = new Set(Object.values(M));
	M.maps = [chainT, netT];
	return M;
}

// a field's paint on the ground: a canvas in the field's own metres (x across, z along)
function paint(f, res) {
	const [x0, x1, z0, z1] = f.rect, w = x1 - x0, d = z1 - z0;
	const ppm = Math.min(res, 2048 / Math.max(w, d));
	const cv = document.createElement('canvas');
	cv.width = Math.ceil(w * ppm); cv.height = Math.ceil(d * ppm);
	const g = cv.getContext('2d');
	g.setTransform(ppm, 0, 0, ppm, -x0 * ppm, -z0 * ppm);
	const r = hh(f.x || 1, f.z || 2);
	// the turf, mown in stripes
	const G1 = '#3b7f35', G2 = '#4a9441';
	g.fillStyle = G1; g.fillRect(x0, z0, w, d);
	const line = (ax, az, bx, bz, lw = 0.12) => { g.lineWidth = lw; g.beginPath(); g.moveTo(ax, az); g.lineTo(bx, bz); g.stroke(); };
	g.strokeStyle = '#f4f4ee'; g.lineCap = 'butt';
	if (f.kind === 'baseball') {
		const { base, mound, fence } = f.d, s = base / 27.43, q = base / Math.SQRT2;
		// the outfield mown in a checkerboard of diagonals, the infield in rings
		g.save(); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, fence, -Math.PI * 0.75, -Math.PI * 0.25); g.closePath(); g.clip();
		g.fillStyle = G2;
		for (let k = -fence * 2; k < fence * 2; k += 12 * s) { g.save(); g.translate(0, 0); g.rotate(Math.PI / 4); g.fillRect(k, -fence * 2, 6 * s, fence * 4); g.restore(); }
		g.restore();
		// the warning track inside the fence
		g.fillStyle = '#9a6a44'; g.beginPath(); g.arc(0, 0, fence, -Math.PI * 0.75, -Math.PI * 0.25); g.arc(0, 0, fence - 4.5 * Math.max(0.7, s), -Math.PI * 0.25, -Math.PI * 0.75, true); g.closePath(); g.fill();
		// the skin: the dirt arc behind the bases, out to 95 ft from the rubber
		const rI = 28.96 * s, dm = mound / Math.SQRT2, t = dm + Math.sqrt(dm * dm - mound * mound + rI * rI), P = t / Math.SQRT2;
		const a1 = Math.atan2(-P + mound, P), a2 = Math.atan2(-P + mound, -P);
		g.fillStyle = '#b07448';
		g.beginPath(); g.moveTo(0, 0); g.lineTo(P, -P); g.arc(0, -mound, rI, a1, a2, true); g.closePath(); g.fill();
		// the infield grass, inside the base paths
		const c = -q, k = (q - 2.7 * s) / q;
		g.fillStyle = G2;
		g.beginPath(); g.moveTo(0, c + q * k); g.lineTo(q * k, c); g.lineTo(0, c - q * k); g.lineTo(-q * k, c); g.closePath(); g.fill();
		// round the plate, the mound, the cut-outs round first and third
		g.fillStyle = '#b07448';
		for (const [x, z, rr] of [[0, 0, 3.96 * s], [0, -mound, 2.74 * s], [q, -q, 2.2 * s], [-q, -q, 2.2 * s], [0, -2 * q, 2.4 * s]]) { g.beginPath(); g.arc(x, z, rr, 0, Math.PI * 2); g.fill(); }
		// chalk: the foul lines out to the poles, the batter's and catcher's boxes, the coaches'
		g.strokeStyle = '#f4f4ee';
		const L = fence / Math.SQRT2;
		line(0, 0, L, -L, 0.1); line(0, 0, -L, -L, 0.1);
		g.lineWidth = 0.08;
		for (const sd of [-1, 1]) g.strokeRect(sd * 0.76 - (sd > 0 ? 0 : 1.22) * s, -0.9 * s, 1.22 * s, 1.83 * s);
		g.strokeRect(-0.55 * s, 0.9 * s, 1.1 * s, 2.4 * s);
		for (const sd of [-1, 1]) { const bx = sd * q, bz = -q; g.strokeRect(bx + sd * 5 * s - 3 * s, bz + 3 * s, 6 * s, 3 * s); }
		// the on-deck circles
		for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * 11 * s, 7 * s, 0.9 * s, 0, Math.PI * 2); g.stroke(); }
	} else if (f.kind === 'soccer') {
		const { L, W } = f.d, k = W / 68;
		for (let i = 0; i < 16; i++) if (i % 2) { g.fillStyle = G2; g.fillRect(-W / 2 - 2, -L / 2 + i * L / 16, W + 4, L / 16); }
		g.lineWidth = 0.12;
		g.strokeRect(-W / 2, -L / 2, W, L);
		line(-W / 2, 0, W / 2, 0);
		g.beginPath(); g.arc(0, 0, 9.15 * Math.min(1, k * 1.1), 0, Math.PI * 2); g.stroke();
		g.fillStyle = '#f4f4ee';
		const spot = (x, z) => { g.beginPath(); g.arc(x, z, 0.12, 0, Math.PI * 2); g.fill(); };
		spot(0, 0);
		for (const sd of [-1, 1]) {
			const gz = sd * L / 2, pa = Math.min(40.32, W * 0.62), pd = Math.min(16.5, L * 0.165), ga = 18.32, gd = 5.5;
			g.strokeRect(-pa / 2, sd > 0 ? gz - pd : gz, pa, pd);
			g.strokeRect(-ga / 2, sd > 0 ? gz - gd : gz, ga, gd);
			const ps = gz - sd * 11;
			spot(0, ps);
			// the arc at the top of the box: 9.15 m from the spot, outside the box
			const e = pd - 11, a = Math.acos(Math.min(1, e / 9.15));
			g.beginPath(); if (sd > 0) g.arc(0, ps, 9.15, -Math.PI / 2 - a, -Math.PI / 2 + a); else g.arc(0, ps, 9.15, Math.PI / 2 - a, Math.PI / 2 + a); g.stroke();
			for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * W / 2, gz, 1, sx > 0 ? (sd > 0 ? Math.PI : Math.PI / 2) : (sd > 0 ? -Math.PI / 2 : 0), sx > 0 ? (sd > 0 ? Math.PI * 1.5 : Math.PI) : (sd > 0 ? 0 : Math.PI / 2)); g.stroke(); }
		}
	} else {
		const { L, W } = f.d, G = 10 * YD, HX = W / 2 - 60 * 0.3048;
		// five-yard bands, the end zones in the home colour
		for (let i = 0; i < 20; i++) if (i % 2) { g.fillStyle = G2; g.fillRect(-W / 2, -L / 2 + G + i * 5 * YD, W, 5 * YD); }
		const EZ = ['#7a1f2b', '#1d3f7a', '#5a2a7a', '#8a5a14'][Math.floor(r * 4)];
		for (const sd of [-1, 1]) {
			g.fillStyle = EZ; g.fillRect(-W / 2, sd < 0 ? -L / 2 : L / 2 - G, W, G);
			// the end zone's diagonal stripes
			g.save(); g.beginPath(); g.rect(-W / 2, sd < 0 ? -L / 2 : L / 2 - G, W, G); g.clip();
			g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.6;
			for (let x = -W / 2 - G; x < W / 2 + G; x += 2.5) line(x, sd < 0 ? -L / 2 : L / 2 - G, x + G, sd < 0 ? -L / 2 + G : L / 2);
			g.restore();
		}
		g.strokeStyle = '#f4f4ee';
		// the border, the goal lines, every five yards across, the ticks at every yard
		g.lineWidth = 0.3; g.strokeRect(-W / 2 - 0.15, -L / 2 - 0.15, W + 0.3, L + 0.3);
		for (let y = 0; y <= 100; y += 5) line(-W / 2, -L / 2 + G + y * YD, W / 2, -L / 2 + G + y * YD, y % 100 === 0 ? 0.2 : 0.1);
		for (let y = 1; y < 100; y++) {
			if (y % 5 === 0) continue;
			const z = -L / 2 + G + y * YD;
			for (const sd of [-1, 1]) { line(sd * (W / 2 - 0.2), z, sd * (W / 2 - 0.8), z, 0.1); line(sd * HX, z, sd * (HX - 0.6), z, 0.1); }
		}
		// the numbers every ten yards, their tops toward the middle, the arrows toward the goal
		g.fillStyle = '#f4f4ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
		g.font = 'bold 1.83px system-ui, sans-serif';
		for (let y = 10; y <= 90; y += 10) {
			const z = -L / 2 + G + y * YD, num = String(y <= 50 ? y : 100 - y);
			for (const sd of [-1, 1]) {
				g.save(); g.translate(sd * (W / 2 - 11 * YD), z); g.rotate(sd > 0 ? -Math.PI / 2 : Math.PI / 2);
				g.fillText(num, 0, 0);
				if (y !== 50) {
					const dir = (y < 50 ? -1 : 1) * (sd > 0 ? -1 : 1), ax = dir * 1.75;
					g.beginPath(); g.moveTo(ax + dir * 0.45, -0.55); g.lineTo(ax, -0.8); g.lineTo(ax, -0.3); g.closePath(); g.fill();
				}
				g.restore();
			}
		}
	}
	// the edge: the field's own shape, feathered into the ground round it (drawn at a pixel
	// to the metre, blurred, and stretched over the paint to cut it)
	const MP = 1, mw = Math.ceil(w * MP), md = Math.ceil(d * MP);
	const mk = document.createElement('canvas');
	mk.width = mw; mk.height = md;
	const m = mk.getContext('2d');
	// the shape is drawn well off the canvas and only its blurred shadow lands on it: a soft
	// edge made on the GPU, with no reading the pixels back (that stalled phones for seconds)
	const OFF = mw + md + 64;
	m.setTransform(MP, 0, 0, MP, -x0 * MP - OFF, -z0 * MP);
	m.shadowColor = '#000'; m.shadowBlur = 4; m.shadowOffsetX = OFF; m.shadowOffsetY = 0;
	m.fillStyle = '#000'; m.beginPath();
	if (f.kind === 'baseball') {
		const { base, fence } = f.d, e = base * 0.9 + 3.5, u = (-10 + Math.sqrt(100 - 2 * (100 - (fence + 1.5) ** 2))) / 2;
		m.rect(-e, -base * 0.3 - 3, 2 * e, z1 - 3 + base * 0.3 + 3);
		m.moveTo(-10, 0); m.lineTo(-(u + 10), -u);
		m.arc(0, 0, fence + 1.5, Math.atan2(-u, -(u + 10)), Math.atan2(-u, u + 10));
		m.lineTo(10, 0); m.closePath();
	} else m.rect(x0 + 3.5, z0 + 3.5, w - 7, d - 7);
	m.fill();
	g.setTransform(1, 0, 0, 1, 0, 0);
	g.globalCompositeOperation = 'destination-in';
	g.imageSmoothingEnabled = true;
	g.drawImage(mk, 0, 0, cv.width, cv.height);
	g.globalCompositeOperation = 'source-over';
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
	return tex;
}

// the field itself: its paint laid over the ground (H: the ground's height at a point of the
// field's frame, in the group's own height), and everything that stands on it. Returns the
// group, the walls to walk into (segments in the frame: ax, az, bx, bz, radius, top) and the
// textures it made.
export function buildField(f, H, { M = fieldMaterials(), res = 12, shadows = true } = {}) {
	if (f.kind === 'arena') return buildArena(f, H, { res, shadows });
	const group = new THREE.Group(), parts = new Map(), walls = [], seats = [];
	const put = (m, geo) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(geo.index ? geo.toNonIndexed() : geo); };
	const box = (m, w, h, d, x, y, z, ry = 0) => put(m, new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(ry).translate(x, y, z));
	const cyl = (m, r, h, x, y, z, seg = 8) => put(m, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z));
	// a bar from one point to another
	const bar = (m, r, a, b, seg = 8) => {
		const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = v.length();
		const geo = new THREE.CylinderGeometry(r, r, l, seg).translate(0, l / 2, 0);
		geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
		put(m, geo.translate(a[0], a[1], a[2]));
	};
	// an upright panel between two points (chain link, windscreen, net), its texture in metres
	const panel = (m, ax, az, bx, bz, y0a, y0b, h) => {
		const l = Math.hypot(bx - ax, bz - az), geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute([ax, y0a, az, bx, y0b, bz, bx, y0b + h, bz, ax, y0a + h, az], 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, l / 4, 0, l / 4, h / 4, 0, h / 4], 2));
		geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals();
		put(m, geo);
	};
	const G = (x, z) => H(x, z);
	// a run of fence between two points: posts, chain link, a top rail
	const fence = (ax, az, bx, bz, h, walk = true) => {
		const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 3));
		for (let i = 0; i < n; i++) {
			const px = ax + (bx - ax) * i / n, pz = az + (bz - az) * i / n, qx = ax + (bx - ax) * (i + 1) / n, qz = az + (bz - az) * (i + 1) / n;
			panel(M.chain, px, pz, qx, qz, G(px, pz), G(qx, qz), h);
			bar(M.steel, 0.025, [px, G(px, pz) + h, pz], [qx, G(qx, qz) + h, qz], 6);
		}
		for (let i = 0; i <= n; i++) { const px = ax + (bx - ax) * i / n, pz = az + (bz - az) * i / n; cyl(M.steel, 0.035, h + 0.05, px, G(px, pz), pz, 6); }
		if (walk) walls.push([ax, az, bx, bz, 0.08, G(ax, az) + h]);
	};
	// a shelter for a team: back wall, roof, a bench, facing (fx, fz)
	const dugout = (x, z, fx, fz, w) => {
		const yaw = Math.atan2(fx, fz), y = G(x, z), c = Math.cos(yaw), s = Math.sin(yaw);
		const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
		box(M.block, w, 2.3, 0.2, ...rot(at(0, -0.9), y), yaw);
		for (const u of [-w / 2, w / 2]) box(M.block, 0.2, 2.3, 1.8, ...rot(at(u, 0), y), yaw);
		box(M.roof, w + 0.6, 0.12, 2.4, ...rot(at(0, 0.1), y + 2.3), yaw);
		box(M.wood, w - 0.6, 0.06, 0.4, ...rot(at(0, -0.55), y + 0.45), yaw);
		for (const u of [-w / 2 + 0.6, 0, w / 2 - 0.6]) box(M.steel, 0.06, 0.45, 0.3, ...rot(at(u, -0.55), y), yaw);
		const [p, q] = [at(-w / 2, -0.9), at(w / 2, -0.9)];
		walls.push([p[0], p[1], q[0], q[1], 0.2, y + 2.3]);
		for (const u of [-w / 2, w / 2]) { const [a, b] = [at(u, -0.9), at(u, 0.9)]; walls.push([a[0], a[1], b[0], b[1], 0.15, y + 2.3]); }
	};
	const rot = ([x, z], y) => [x, y, z];
	// aluminium stands: rows of planks stepping up and back, facing (fx, fz)
	const stands = (x, z, fx, fz, w, rows = 4) => {
		const yaw = Math.atan2(fx, fz), y = G(x, z), c = Math.cos(yaw), s = Math.sin(yaw);
		const at = (u, v) => [x + c * u + s * v, z - s * u + c * v];
		for (let r = 0; r < rows; r++) {
			box(M.alu, w, 0.05, 0.3, ...rot(at(0, -r * 0.7), y + 0.42 + r * 0.4), yaw);
			box(M.alu, w, 0.04, 0.25, ...rot(at(0, -r * 0.7 + 0.3), y + 0.2 + r * 0.4), yaw);
		}
		for (const u of [-w / 2 + 0.3, 0, w / 2 - 0.3]) { const [a, b] = [at(u, 0.2), at(u, -rows * 0.7 + 0.2)]; bar(M.steel, 0.04, [a[0], y, a[1]], [b[0], y + rows * 0.4 + 0.2, b[1]], 6); }
		const [p, q] = [at(-w / 2, -rows * 0.35), at(w / 2, -rows * 0.35)];
		walls.push([p[0], p[1], q[0], q[1], rows * 0.35, y + rows * 0.4 + 0.3]);
		// where people sit on them (the games fill them: games/fieldgame.js)
		for (let r = 0; r < rows; r++) for (let u = -w / 2 + 0.35; u <= w / 2 - 0.3; u += 0.55) { const [sx, sz] = at(u, -r * 0.7); seats.push({ x: sx, y: y + 0.445 + r * 0.4, z: sz, yaw }); }
	};

	// the ground, draped over the land where the field uses it
	const tex = paint(f, res), [x0, x1, z0, z1] = f.rect;
	{
		const nx = Math.ceil((x1 - x0) / 4), nz = Math.ceil((z1 - z0) / 4), pos = [], uv = [], idx = [], vid = new Map();
		const v = (i, j) => {
			const k = i + ',' + j;
			if (vid.has(k)) return vid.get(k);
			const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz;
			pos.push(x, G(x, z) + 0.06, z); uv.push((x - x0) / (x1 - x0), 1 - (z - z0) / (z1 - z0));
			vid.set(k, pos.length / 3 - 1);
			return pos.length / 3 - 1;
		};
		for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
			const cx = x0 + (x1 - x0) * (i + 0.5) / nx, cz = z0 + (z1 - z0) * (j + 0.5) / nz;
			if (!uses(f, cx, cz) && !uses(f, cx + 4, cz + 4) && !uses(f, cx - 4, cz + 4)) continue;
			const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
			idx.push(a, d, b, b, d, c);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
		geo.setIndex(idx); geo.computeVertexNormals();
		const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
		const ground = new THREE.Mesh(geo, mat);
		ground.receiveShadow = true; ground.userData.fieldGround = true;
		group.add(ground);
	}

	if (f.kind === 'baseball') {
		const { base, mound, fence: R, back } = f.d, s = base / 27.43, q = base / Math.SQRT2;
		// the bases, the plate, the mound and its rubber
		for (const [x, z] of [[q, -q], [0, -2 * q], [-q, -q]]) box(M.white, 0.38, 0.09, 0.38, x, G(x, z) + 0.04, z, Math.PI / 4);
		put(M.white, new THREE.CylinderGeometry(0.3, 0.3, 0.03, 5).rotateY(Math.PI / 10 + Math.PI).translate(0, G(0, 0) + 0.07, 0.05));
		put(M.dirt, new THREE.CylinderGeometry(0.9 * s, 2.74 * s, 0.25 * s, 24).translate(0, G(0, -mound) + 0.12 * s + 0.04, -mound));
		box(M.white, 0.61, 0.05, 0.15, 0, G(0, -mound) + 0.25 * s + 0.02, -mound);
		// the backstop behind the plate, and its wings along the lines to the dugouts
		const arc = [];
		for (let i = 0; i <= 6; i++) { const a = (-0.42 + i / 6 * 0.84) * Math.PI; arc.push([Math.sin(a) * back, Math.cos(a) * back]); }
		for (let i = 0; i < 6; i++) fence(arc[i][0], arc[i][1], arc[i + 1][0], arc[i + 1][1], s > 0.8 ? 6 : 4);
		for (const sd of [-1, 1]) {
			const e = arc[sd < 0 ? 0 : 6], wx = sd * (q * 0.55 + 7 * s), wz = -q * 0.55 + 7 * s;
			fence(e[0], e[1], wx, wz, 1.2);
			// the dugout, off the line between home and the base, facing the field
			dugout(sd * (q * 0.62 + 8 * s), -q * 0.62 + 8 * s, -sd * 0.7071, -0.7071, s > 0.8 ? 9 : 6);
			stands(sd * (q * 0.95 + 12 * s), -q * 0.95 + 12 * s, -sd * 0.7071, -0.7071, 7, 4);
		}
		// the outfield fence: windscreen on posts, a yellow cap, foul poles at the lines
		const hF = s > 0.8 ? 2.4 : 1.8, n = Math.ceil(R * Math.PI / 2 / 4);
		let prev = null;
		for (let i = 0; i <= n; i++) {
			const a = -Math.PI / 4 + i / n * Math.PI / 2, x = Math.sin(a) * R, z = -Math.cos(a) * R;
			if (prev) {
				panel(M.screen, prev[0], prev[1], x, z, G(...prev), G(x, z), hF);
				panel(M.screen, x, z, prev[0], prev[1], G(x, z), G(...prev), hF);
				bar(M.yellow, 0.05, [prev[0], G(...prev) + hF, prev[1]], [x, G(x, z) + hF, z], 6);
				walls.push([prev[0], prev[1], x, z, 0.1, G(x, z) + hF]);
			}
			cyl(M.steel, 0.04, hF, x, G(x, z), z, 6);
			prev = [x, z];
		}
		for (const sd of [-1, 1]) { const x = sd * R / Math.SQRT2, z = -R / Math.SQRT2; cyl(M.yellow, 0.08, s > 0.8 ? 14 : 8, x, G(x, z), z, 8); }
	} else if (f.kind === 'soccer') {
		const { L, W } = f.d;
		for (const sd of [-1, 1]) {
			const gz = sd * L / 2, bz = gz + sd * 2, y = G(0, gz), gw = 7.32, gh = 2.44;
			// the posts and the bar, the frame behind, the net over it
			for (const x of [-gw / 2, gw / 2]) { cyl(M.white, 0.06, gh, x, y, gz, 10); bar(M.white, 0.025, [x, y + gh, gz], [x, y, bz], 6); bar(M.white, 0.025, [x, y, gz], [x, y, bz], 6); walls.push([x, gz, x, gz, 0.07, y + gh]); }
			bar(M.white, 0.06, [-gw / 2 - 0.06, y + gh, gz], [gw / 2 + 0.06, y + gh, gz], 10);
			bar(M.white, 0.025, [-gw / 2, y, bz], [gw / 2, y, bz], 6);
			// (the back net slopes from the bar down to the frame on the ground)
			{ const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-gw / 2, y, bz, gw / 2, y, bz, gw / 2, y + gh, gz, -gw / 2, y + gh, gz], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, gw / 4, 0, gw / 4, 0.8, 0, 0.8], 2)); geo.setIndex([0, 1, 2, 0, 2, 3]); geo.computeVertexNormals(); put(M.net, geo); }
			for (const x of [-gw / 2, gw / 2]) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([x, y, gz, x, y, bz, x, y + gh, gz], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 0, 0, 0.6], 2)); geo.setIndex([0, 1, 2]); geo.computeVertexNormals(); put(M.net, geo); }
			walls.push([-gw / 2, bz, gw / 2, bz, 0.1, y + 1.5]);
			// the corner flags
			for (const sx of [-1, 1]) { const x = sx * W / 2, cy = G(x, gz); cyl(M.yellow, 0.02, 1.5, x, cy, gz, 6); put(M.orange, new THREE.PlaneGeometry(0.4, 0.3).translate(0.2, cy + 1.32, 0).rotateY(0).translate(x, 0, gz)); }
		}
		// the teams' shelters on one touchline, the stands on the other
		for (const z of [-6, 6]) dugout(W / 2 + 4, z, -1, 0, 6);
		for (const z of [-12, 0, 12]) stands(-W / 2 - 5, z, 1, 0, 9, 4);
	} else {
		const { L, W } = f.d;
		for (const sd of [-1, 1]) {
			// the goalpost: the post set back behind the end line, the gooseneck, the bar, the uprights
			const ez = sd * L / 2, pz = ez + sd * 1.8, y = G(0, ez), bh = 3.05, hw = 5.64 / 2;
			cyl(M.yellow, 0.14, bh + 0.5, 0, G(0, pz), pz, 12);
			cyl(M.pad, 0.3, 2, 0, G(0, pz), pz, 12);
			bar(M.yellow, 0.12, [0, y + bh + 0.5, pz], [0, y + bh, ez], 10);
			bar(M.yellow, 0.1, [-hw, y + bh, ez], [hw, y + bh, ez], 10);
			for (const x of [-hw, hw]) { cyl(M.yellow, 0.07, 9.1, x, y + bh, ez, 10); put(M.orange, new THREE.PlaneGeometry(0.12, 1.1).translate(x + 0.08, y + bh + 8.5, ez)); }
			walls.push([0, pz, 0, pz, 0.3, G(0, pz) + bh]);
			// the pylons at the corners of the end zone
			for (const sx of [-1, 1]) for (const z of [ez, ez - sd * 10 * YD]) box(M.orange, 0.1, 0.45, 0.1, sx * (W / 2 + 0.1), G(sx * W / 2, z), z);
		}
		// the benches along both sidelines, the stands behind one
		for (const sx of [-1, 1]) for (const z of [-9, 0, 9]) { box(M.alu, 8, 0.05, 0.4, sx * (W / 2 + 6), G(sx * (W / 2 + 6), z) + 0.45, z); box(M.steel, 7.6, 0.45, 0.06, sx * (W / 2 + 6), G(sx * (W / 2 + 6), z), z); }
		for (const z of [-24, -12, 0, 12, 24]) stands(W / 2 + 12, z, -1, 0, 11, 6);
	}
	const texs = [tex];
	for (const [m, list] of parts) {
		const mesh = new THREE.Mesh(mergeGeometries(list), m);
		mesh.castShadow = shadows && m !== M.chain && m !== M.net;
		mesh.receiveShadow = true;
		group.add(mesh);
	}
	return { group, walls, tex: texs, seats };
}
