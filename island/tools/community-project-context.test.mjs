// The pass context of community-project-marks.js (communityProjectContext): the buildings and
// streets a spot keeps clear of gathered once for a pass, and each candidate tested against
// only those in its reach. It must find exactly the spots the old way found, call for call:
// here against a copy of the old way, over crowded random streets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { communityProjectSpot, communityProjectContext, communityProjectAnchor, COMMUNITY_PROJECT_FOOTPRINTS } from '../src/guide/community-project-marks.js';
import { BLOCKS, toGrid } from '../src/bay/styles.js';

// ---------- the old way, as it was (one list per call, every box measured at every sample) ----------
const finite = Number.isFinite;
const clamp = (n, a, b) => finite(n) ? Math.max(a, Math.min(b, n)) : a;
const hash = value => { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
const STAGES = new Set(['surveying', 'preparing', 'building', 'completed']);
const stage = p => p?.stage || p?.status;
function oldSegmentDistance(x, z, points) {
	let d = Infinity;
	for (let i = 0; i + 1 < (points?.length || 0); i++) {
		const a = points[i], b = points[i + 1], ax = a[0] ?? a.x, az = a[1] ?? a.z, bx = b[0] ?? b.x, bz = b[1] ?? b.z;
		if (![ax, az, bx, bz].every(finite)) continue;
		const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
		const t = len ? clamp(((x - ax) * dx + (z - az) * dz) / len, 0, 1) : 0;
		d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return d;
}
function oldBlockedAt(W, x, z, y, boxes, roads, probe) {
	if (W.globe?.regional?.settlements?.blocked?.(x, z, .5, true) || W.globe?.roads?.onRoad?.(x, z, .5) || W.globe?.lanes?.onRoad?.(x, z, .5)) return true;
	if (boxes.some(b => finite(b.x) && finite(b.z) && Math.hypot(x - b.x, z - b.z) < Math.hypot(b.w || 0, b.d || 0) * .5 + .65)) return true;
	if (roads.some(r => oldSegmentDistance(x, z, r.pts) < (r.w || 4) * .5 + .65)) return true;
	if ((W.real?.landAt?.(x, z)?.road || 0) > .25) return true;
	const U = W.bayArea?.urbanAt?.(x, z);
	if (U?.u > .3 && !W.real?.inside?.(x, z)) {
		const [bx, bz, width] = BLOCKS[U.s] || BLOCKS[3], [gx, gz] = toGrid(x, z, U.a, U.s);
		const lx = ((gx % bx) + bx) % bx, lz = ((gz % bz) + bz) % bz;
		if (lx < width + .65 || lz < width + .65 || lx > bx - .65 || lz > bz - .65) return true;
	}
	if ((W.vegetation?.obstacles?.(x, z, .6) || []).length) return true;
	if (W.player?.pushOut) {
		probe.x = x; probe.y = y + 1.68; probe.z = z; W.player.pushOut(probe);
		if (Math.hypot(probe.x - x, probe.z - z) > .04) return true;
	}
	return false;
}
function oldSpot(W, project, { exact = null } = {}) {
	const anchor = communityProjectAnchor(W, project), extent = COMMUNITY_PROJECT_FOOTPRINTS[project?.kind];
	if (!anchor || !extent || !STAGES.has(stage(project))) return null;
	const I = W.island, ground = I?.drawnAt || I?.heightAt;
	if (!ground) return null;
	const angle = hash(project.siteId || project.id) / 4294967296 * Math.PI * 2;
	const yaw = angle;
	const c = Math.cos(yaw), s = Math.sin(yaw), [width, depth] = extent, nx = Math.ceil(width), nz = Math.ceil(depth), probe = { x: 0, y: 0, z: 0 };
	const boxes = [...(W.real?.near?.('boxes', anchor.x, anchor.z, 40) || []), ...(W.village?.footprints || []), ...(W.city?.nearList?.() || [])].filter(b => finite(b.x) && finite(b.z) && Math.hypot(b.x - anchor.x, b.z - anchor.z) < 40 + Math.hypot(b.w || 0, b.d || 0) * .5);
	const roads = W.real?.near?.('roads', anchor.x, anchor.z, 40) || [];
	const candidates = exact ? [exact] : [{ x: anchor.x, z: anchor.z }, ...[7, 13, 19].flatMap(r => [0, 1, 2, 3].map(i => ({ x: anchor.x + Math.cos(angle + i * Math.PI / 2) * r, z: anchor.z + Math.sin(angle + i * Math.PI / 2) * r })))];
	for (const candidate of candidates) {
		let lo = Infinity, hi = -Infinity, clear = true;
		for (let i = 0; i <= nx && clear; i++) for (let j = 0; j <= nz; j++) {
			const u = (i / nx - .5) * width, v = (j / nz - .5) * depth, x = candidate.x + c * u + s * v, z = candidate.z - s * u + c * v;
			const y = ground.call(I, x, z), floor = W.player?.floorAt?.(x, z, y), water = I.waterAt?.(x, z) ?? W.water?.waterAt?.(x, z) ?? W.globe?.waterAt?.(x, z);
			if (!finite(y) || Math.abs(y - anchor.y) > 3 || (I.hasOcean !== false && y < .4) || (finite(water) && y < water + .25) || I.inWater?.(x, z) || (finite(floor) && Math.abs(floor - y) > .35) || oldBlockedAt(W, x, z, y, boxes, roads, probe)) { clear = false; break; }
			lo = Math.min(lo, y); hi = Math.max(hi, y);
			if (hi - lo > .45) { clear = false; break; }
		}
		if (clear) return { x: candidate.x, y: ground.call(I, candidate.x, candidate.z), z: candidate.z, yaw, radius: Math.hypot(width, depth) * .5 };
	}
	return null;
}

// ---------- crowded random streets ----------
function rng(seed) { let h = seed >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
function crowded(seed) {
	const r = rng(seed), box = () => ({ x: r() * 400, z: r() * 400, w: r() < .05 ? 60 + r() * 120 : 2 + r() * 14, d: 2 + r() * 14 });
	const realBoxes = Array.from({ length: 60 }, box), village = Array.from({ length: 10 }, box), city = Array.from({ length: 260 }, box);
	city.push({ x: NaN, z: 3, w: 4, d: 4 }, { x: 100, z: 100 }, { x: 150, z: 150, w: NaN, d: 3 });
	const flat = Array.from({ length: 40 }, () => ({ w: 4 + r() * 10, pts: new Float32Array([r() * 400, r() * 400, r() * 400, r() * 400, r() * 400, r() * 400]) }));
	const pairs = Array.from({ length: 6 }, () => ({ w: r() * 6, pts: [[r() * 400, r() * 400], { x: r() * 400, z: r() * 400 }, [r() * 400, r() * 400]] }));
	const holes = Array.from({ length: 30 }, () => ({ x: r() * 400, z: r() * 400, r: 1 + r() * 4 }));
	const calls = { boxes: 0, roads: 0 };
	return {
		calls,
		W: {
			body: { key: 'earth' },
			island: { heightAt: (x, z) => 2 + Math.sin(x * .05) * .3 + Math.cos(z * .07) * .2 + (Math.hypot(x - 200, z - 200) < 20 ? 4 : 0), hasOcean: true },
			real: {
				// (as the real city's grid gives them: a superset, whole cells)
				near: (kind, x, z, rad) => { calls[kind]++; return kind === 'boxes' ? realBoxes.filter(b => Math.abs(b.x - x) < rad + 50 && Math.abs(b.z - z) < rad + 50) : [...flat, ...pairs]; },
				landAt: (x, z) => ({ road: (Math.floor(x / 37) + Math.floor(z / 41)) % 13 === 0 ? 1 : 0 }),
			},
			village: { footprints: village },
			city: { nearList: () => city },
			vegetation: { obstacles: (x, z) => holes.filter(h => Math.hypot(h.x - x, h.z - z) < h.r) },
			player: { floorAt: (x, z, y) => y, pushOut: p => { if (Math.hypot(p.x - 320, p.z - 60) < 8) p.x += 1; } },
		},
		at: () => ({ x: r() * 400, z: r() * 400 }),
	};
}

test('a pass context finds exactly the spots each call found alone', () => {
	let found = 0, tried = 0;
	for (let seed = 1; seed <= 6; seed++) {
		const F = crowded(seed), context = communityProjectContext(F.W);
		for (let n = 0; n < 60; n++) {
			const a = F.at(), kind = Object.keys(COMMUNITY_PROJECT_FOOTPRINTS)[n % 4];
			const p = { id: 'p' + seed + ':' + n, siteId: 's' + seed + ':' + n, world: 'earth', kind, status: 'surveying', anchor: { x: a.x, y: 2, z: a.z } };
			const want = oldSpot(F.W, p);
			assert.deepEqual(communityProjectSpot(F.W, p, { context }), want);
			assert.deepEqual(communityProjectSpot(F.W, p), want);
			if (want) {
				found++;
				// (the spot checked again where it stands, as the sites and the marks do)
				const at = { ...p, anchor: { x: want.x, y: want.y, z: want.z } };
				for (const k of Object.keys(COMMUNITY_PROJECT_FOOTPRINTS)) assert.deepEqual(communityProjectSpot(F.W, { ...at, kind: k }, { exact: want, context }), oldSpot(F.W, { ...at, kind: k }, { exact: want }));
			}
			tried++;
		}
	}
	// (the streets are crowded, not impassable: some found, some not)
	assert.ok(found > 10 && found < tried, `${found} of ${tried}`);
});

test('a pass context gathers what is near an anchor once', () => {
	const F = crowded(9), context = communityProjectContext(F.W);
	const p = { id: 'q', siteId: 'q', world: 'earth', kind: 'path', status: 'surveying', anchor: { x: 210, y: 2, z: 190 } };
	for (const kind of Object.keys(COMMUNITY_PROJECT_FOOTPRINTS)) communityProjectSpot(F.W, { ...p, kind }, { context });
	assert.equal(F.calls.boxes, 1);
	assert.equal(F.calls.roads, 1);
	// (another world's context is not used for this one)
	const G = crowded(9);
	assert.deepEqual(communityProjectSpot(G.W, p, { context }), oldSpot(G.W, p));
});
