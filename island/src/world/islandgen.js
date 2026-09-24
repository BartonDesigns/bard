// The island: one seeded heightfield plus masks that every other system reads.
// Coast, beach, reef shelf, a volcanic ridge, one village on the gentlest bay,
// and worn paths that climb from the village into the hills.

import { makeNoise, mulberry32, smoothstep, clamp, lerp } from '../noise.js';

export const WORLD_SIZE = 2600;   // metres covered by the height map
export const SEA_LEVEL = 0;

export function generateIsland(params = {}) {
	const seed = (params.seed >>> 0) || 1337;
	const N = params.resolution || 768;
	const S = WORLD_SIZE, half = S / 2, cell = S / (N - 1);
	const rand = mulberry32(seed ^ 0x9e3779b9);
	const nz = makeNoise(seed);
	const R = 760 + rand() * 90;
	const peak = { x: (rand() - 0.5) * 360, z: (rand() - 0.5) * 360, h: 150 + rand() * 70, r: 430 + rand() * 80 };

	function shape(x, z) {
		const wx = x + (nz.fbm(x * 0.0015 + 3.1, z * 0.0015, 3) - 0.5) * 420;
		const wz = z + (nz.fbm(x * 0.0015, z * 0.0015 - 7.7, 3) - 0.5) * 420;
		return Math.hypot(wx, wz) / R;
	}
	// Baseline profile from the coast outward: gentle rise, beach, shore,
	// a shallow reef shelf, the drop-off and the deep.
	function profile(t) {
		if (t < 0.8) return 3.2 + (0.8 - t) * 22;
		if (t < 0.93) return lerp(3.2, 0.25, (t - 0.8) / 0.13);
		if (t < 1.0) return lerp(0.25, -1.4, (t - 0.93) / 0.07);
		if (t < 1.18) return lerp(-1.4, -4.2, (t - 1.0) / 0.18);
		if (t < 1.45) return lerp(-4.2, -38, smoothstep(1.18, 1.45, t));
		return lerp(-38, -95, smoothstep(1.45, 2.1, t));
	}
	function natural(x, z) {
		const t = shape(x, z);
		let h = profile(t);
		if (t > 1.6) return { h, t, reef: 0 };
		const inland = smoothstep(0.9, 0.62, t);
		const hills = nz.ridged(x * 0.0055 + 40, z * 0.0055 - 12, 4) * 26 * inland;
		const rolling = (nz.fbm(x * 0.0021, z * 0.0021, 4) - 0.45) * 18 * inland;
		const dp = Math.hypot(x - peak.x, z - peak.z) / peak.r;
		const cone = Math.pow(Math.max(0, 1 - dp), 1.7);
		const ridge = nz.ridged(x * 0.0042 - 9, z * 0.0042 + 21, 5);
		const mountain = cone * peak.h * (0.55 + 0.45 * ridge) * smoothstep(0.95, 0.55, t);
		h += Math.max(0, hills + rolling) + mountain;
		let reef = 0;
		if (t > 0.97 && t < 1.22) {
			const r = nz.fbm(x * 0.018 + 5, z * 0.018 - 3, 3);
			reef = smoothstep(0.52, 0.64, r) * smoothstep(0.97, 1.02, t) * smoothstep(1.22, 1.15, t);
			h += reef * 1.1;
		}
		return { h, t, reef };
	}

	const height = new Float32Array(N * N);
	const tmap = new Float32Array(N * N);
	const masks = new Uint8Array(N * N * 4);   // r: path, g: village, b: reef, a: wild growth
	for (let j = 0; j < N; j++) {
		const z = -half + j * cell;
		for (let i = 0; i < N; i++) {
			const x = -half + i * cell;
			const s = natural(x, z), k = j * N + i;
			height[k] = s.h;
			tmap[k] = s.t;
			masks[k * 4 + 2] = Math.round(s.reef * 255);
		}
	}

	const idx = (x, z) => {
		const fx = clamp((x + half) / cell, 0, N - 1.001), fz = clamp((z + half) / cell, 0, N - 1.001);
		return [fx, fz];
	};
	function sample(arr, x, z) {
		const [fx, fz] = idx(x, z);
		const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
		return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + N] * (1 - u) + arr[k + N + 1] * u) * v;
	}
	const heightAt = (x, z) => sample(height, x, z);

	// The village: the gentlest stretch of coast, away from the peak.
	let village = null;
	for (let a = 0; a < 72; a++) {
		const th = a / 72 * Math.PI * 2, dx = Math.cos(th), dz = Math.sin(th);
		let coast = null;
		for (let d = 200; d < 1400; d += 6) {
			if (heightAt(dx * d, dz * d) < 0.4) { coast = d; break; }
		}
		if (!coast) continue;
		const cx = dx * (coast - 60), cz = dz * (coast - 60);
		let rough = 0;
		for (let s = 0; s < 12; s++) {
			const px = cx + Math.cos(s * 0.52) * 70, pz = cz + Math.sin(s * 0.52) * 70;
			rough += Math.abs(heightAt(px, pz) - heightAt(cx, cz));
		}
		const peakDist = Math.hypot(cx - peak.x, cz - peak.z);
		const score = rough - peakDist * 0.02 + rand() * 4;
		if (!village || score < village.score) village = { score, x: cx, z: cz, th, coast: { x: dx * coast, z: dz * coast }, seaDir: { x: dx, z: dz } };
	}
	if (!village) village = { x: 0, z: 0, th: 0, coast: { x: R, z: 0 }, seaDir: { x: 1, z: 0 } };

	// The bay: the village sits at the back of a sheltered inlet. Scoop the coast out
	// in a round cove and raise a wooded headland on each side, so from the beach the
	// jungle wraps round you and the open sea is framed between the points.
	{
		const d = village.seaDir, sd = { x: -d.z, z: d.x };
		const Rb = 165 + rand() * 30;
		// the cove bites into the land: its back beach lies well inland of the old shore,
		// and the village moves back with it
		const B = { x: village.coast.x + d.x * Rb * 0.2, z: village.coast.z + d.z * Rb * 0.2 };
		village.coast = { x: B.x - d.x * (Rb - 6), z: B.z - d.z * (Rb - 6) };
		village.x = village.coast.x - d.x * 60; village.z = village.coast.z - d.z * 60;
		const hl = [22 + rand() * 12, 18 + rand() * 12];            // headland heights, left and right
		village.bay = { x: B.x, z: B.z, r: Rb };
		for (let j = 0; j < N; j++) {
			const z = -half + j * cell;
			for (let i = 0; i < N; i++) {
				const x = -half + i * cell, k = j * N + i;
				const px = x - B.x, pz = z - B.z, r = Math.hypot(px, pz);
				if (r > Rb + 190) continue;
				const along = px * d.x + pz * d.z, side = px * sd.x + pz * sd.z;
				let h = height[k];
				// the cove: a sandy beach at the back, shelving to clear water in the middle
				const t = r / Rb;
				const cove = t < 1 ? lerp(-6.5, -0.4, smoothstep(0.35, 1.0, t)) : lerp(-0.4, 2.2, smoothstep(1.0, 1.22, t));
				const reach = 1 - smoothstep(Rb * 0.95, Rb * 1.35, r);
				if (h > cove) h = lerp(h, cove, reach);
				// the headlands: two arms of high ground reaching out round the cove
				const arm = smoothstep(Rb + 4, Rb + 40, r) * smoothstep(Rb + 170, Rb + 90, r);
				const out = smoothstep(Rb * 1.0, Rb * 0.3, along);            // tapering to the points
				const H = side > 0 ? hl[0] : hl[1];
				const rough = 0.75 + 0.5 * nz.fbm(x * 0.02 + 3, z * 0.02 - 5, 3);
				const head = H * arm * out * rough * (0.55 + 0.45 * smoothstep(Rb * 0.9, -Rb * 0.3, along));
				// rocky ends where the arms meet the sea
				const tip = smoothstep(Rb * 0.5, Rb * 1.0, along) * arm;
				const land = head > 0.5 ? Math.max(head, 1.2) - tip * 2.5 : head;
				if (land > h) h = lerp(h, land, smoothstep(0.0, 0.5, arm * out));
				height[k] = h;
			}
		}
	}

	// Level the village terrace: rises gently inland from the beach.
	const vr = 115;
	for (let j = 0; j < N; j++) {
		const z = -half + j * cell;
		for (let i = 0; i < N; i++) {
			const x = -half + i * cell, k = j * N + i;
			const d = Math.hypot(x - village.x, z - village.z);
			if (d > vr) continue;
			const w = smoothstep(vr, vr * 0.55, d);
			const along = (x - village.coast.x) * -village.seaDir.x + (z - village.coast.z) * -village.seaDir.z;
			if (height[k] < -0.6) continue;
			const target = Math.max(0.35, 1.3 + along * 0.028);
			height[k] = lerp(height[k], target, w * smoothstep(-0.6, 0.6, height[k]));
			masks[k * 4 + 1] = Math.max(masks[k * 4 + 1], Math.round(w * 255));
		}
	}

	// Paths: a shore lane through the village, then a trail that climbs
	// toward the peak choosing the least steep step each time.
	const paths = [];
	const side = { x: -village.seaDir.z, z: village.seaDir.x };
	const lane = [];
	for (let s = -9; s <= 9; s++) {
		const t = s * 11;
		const wob = Math.sin(s * 0.7 + seed) * 4;
		lane.push({ x: village.x + side.x * t + village.seaDir.x * (18 + wob), z: village.z + side.z * t + village.seaDir.z * (18 + wob) });
	}
	paths.push({ points: lane, width: 1.9 });
	const trail = [{ x: village.x - village.seaDir.x * 10, z: village.z - village.seaDir.z * 10 }];
	let hx = trail[0].x, hz = trail[0].z;
	for (let step = 0; step < 140; step++) {
		const gx = peak.x - hx, gz = peak.z - hz, gl = Math.hypot(gx, gz);
		if (gl < 60) break;
		const base = Math.atan2(gz, gx);
		let best = null;
		for (let c = -3; c <= 3; c++) {
			const a = base + c * 0.28 + (nz.vnoise(step * 0.3, seed * 0.001) - 0.5) * 0.5;
			const nx = hx + Math.cos(a) * 7, nzz = hz + Math.sin(a) * 7;
			const cost = Math.abs(heightAt(nx, nzz) - heightAt(hx, hz)) + Math.abs(c) * 0.25;
			if (!best || cost < best.cost) best = { cost, x: nx, z: nzz };
		}
		hx = best.x; hz = best.z;
		trail.push({ x: hx, z: hz });
		if (heightAt(hx, hz) > peak.h * 0.75) break;
	}
	paths.push({ points: trail, width: 1.8 });
	// A spur to a lookout on the headland.
	const spurStart = trail[Math.min(trail.length - 1, 22)];
	const spur = [spurStart];
	let sx = spurStart.x, sz = spurStart.z;
	const spurDir = Math.atan2(side.z, side.x);
	for (let step = 0; step < 50; step++) {
		const a = spurDir + Math.sin(step * 0.21) * 0.5;
		sx += Math.cos(a) * 7; sz += Math.sin(a) * 7;
		if (heightAt(sx, sz) < 1.2) break;
		spur.push({ x: sx, z: sz });
	}
	if (spur.length > 4) paths.push({ points: spur, width: 1.5 });

	function distToPath(x, z, pts) {
		let best = 1e9;
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dz = b.z - a.z, dd = dx * dx + dz * dz || 1;
			const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / dd, 0, 1);
			best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
		}
		return best;
	}
	for (const p of paths) {
		let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
		for (const q of p.points) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z); }
		const pad = p.width * 3;
		const i0 = Math.max(0, Math.floor((minX - pad + half) / cell)), i1 = Math.min(N - 1, Math.ceil((maxX + pad + half) / cell));
		const j0 = Math.max(0, Math.floor((minZ - pad + half) / cell)), j1 = Math.min(N - 1, Math.ceil((maxZ + pad + half) / cell));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
			const x = -half + i * cell, z = -half + j * cell;
			const d = distToPath(x, z, p.points);
			// the edge wanders so a path reads as worn, not ruled
			const edge = p.width * (0.8 + nz.vnoise(x * 0.15, z * 0.15) * 0.6);
			const w = smoothstep(edge * 1.6, edge * 0.5, d);
			const k = j * N + i;
			if (w > masks[k * 4] / 255) masks[k * 4] = Math.round(w * 255);
			if (height[k] > 0.3) height[k] -= w * 0.12;
		}
	}
	// Wild growth: dense away from paths, village, beach and bare rock.
	for (let k = 0; k < N * N; k++) {
		const h = height[k];
		const g = smoothstep(1.6, 3.2, h) * (1 - masks[k * 4] / 255) * (1 - 0.7 * masks[k * 4 + 1] / 255) * smoothstep(peak.h * 0.95, peak.h * 0.6, h);
		masks[k * 4 + 3] = Math.round(g * 255);
	}

	// distance to water, in metres (chamfer transform over the final height map)
	const coastDist = new Float32Array(N * N);
	for (let k = 0; k < N * N; k++) coastDist[k] = height[k] < 0 ? 0 : 1e6;
	const dd = cell, dg = cell * Math.SQRT2;
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
		const k = j * N + i; let v = coastDist[k];
		if (i > 0) v = Math.min(v, coastDist[k - 1] + dd);
		if (j > 0) { v = Math.min(v, coastDist[k - N] + dd); if (i > 0) v = Math.min(v, coastDist[k - N - 1] + dg); if (i < N - 1) v = Math.min(v, coastDist[k - N + 1] + dg); }
		coastDist[k] = v;
	}
	for (let j = N - 1; j >= 0; j--) for (let i = N - 1; i >= 0; i--) {
		const k = j * N + i; let v = coastDist[k];
		if (i < N - 1) v = Math.min(v, coastDist[k + 1] + dd);
		if (j < N - 1) { v = Math.min(v, coastDist[k + N] + dd); if (i < N - 1) v = Math.min(v, coastDist[k + N + 1] + dg); if (i > 0) v = Math.min(v, coastDist[k + N - 1] + dg); }
		coastDist[k] = v;
	}
	const coastAt = (x, z) => sample(coastDist, x, z);

	function normalAt(x, z) {
		const e = cell;
		const hx0 = heightAt(x - e, z), hx1 = heightAt(x + e, z), hz0 = heightAt(x, z - e), hz1 = heightAt(x, z + e);
		const nx = hx0 - hx1, nzv = hz0 - hz1, ny = 2 * e, l = Math.hypot(nx, ny, nzv);
		return { x: nx / l, y: ny / l, z: nzv / l };
	}
	const maskAt = (x, z, ch) => {
		const [fx, fz] = idx(x, z);
		return masks[(Math.round(fz) * N + Math.round(fx)) * 4 + ch] / 255;
	};

	// Spawn on the trail just above the village, facing the sea.
	const sp = trail[Math.min(4, trail.length - 1)];
	const spawn = { x: sp.x, z: sp.z, yaw: Math.atan2(village.seaDir.x, village.seaDir.z) + Math.PI };

	return {
		seed, N, size: S, cell, half, sea: SEA_LEVEL, R, peak, village, paths, spawn,
		height, masks, heightAt, normalAt, maskAt, shapeAt: shape, coastAt, distToPath,
		biome: params.biome || 'tropical',
	};
}
