// Where an off-world colony stands: its hub in a crater floor (or the flattest open ground),
// the spaceport on the plain beside it, outposts on the rims and the high ground, and the
// compacted roads and the maglev between them. Planned before the ground is baked: the
// hub, the pads and the outposts' footings are levelled into the height map and the roads
// worn into the path mask, so the terrain follows the colony and the colony the terrain.

import { mulberry32, smoothstep, lerp } from '../../noise.js';
import { colonyStyle } from './styles.js';

const TAU = Math.PI * 2;

// level a disc of the height map to y, blending out over `blend` metres
function level(I, x, z, r, blend, y) {
	const { N, cell, half, height } = I, R = r + blend;
	const i0 = Math.max(0, Math.floor((x - R + half) / cell)), i1 = Math.min(N - 1, Math.ceil((x + R + half) / cell));
	const j0 = Math.max(0, Math.floor((z - R + half) / cell)), j1 = Math.min(N - 1, Math.ceil((z + R + half) / cell));
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
		const d = Math.hypot(-half + i * cell - x, -half + j * cell - z);
		if (d > R) continue;
		const k = j * N + i;
		height[k] = lerp(height[k], y, smoothstep(R, r, d));
	}
}
// wear a road into the path mask (the terrain draws it as compacted ground)
function wear(I, pts, w) {
	const { N, cell, half, masks } = I;
	for (let s = 0; s < pts.length - 1; s++) {
		const a = pts[s], b = pts[s + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (cell * 0.5));
		for (let t = 0; t <= n; t++) {
			const x = lerp(a.x, b.x, t / n), z = lerp(a.z, b.z, t / n);
			const ci = (x + half) / cell, cj = (z + half) / cell, rr = w / cell + 1;
			for (let j = Math.floor(cj - rr); j <= Math.ceil(cj + rr); j++) for (let i = Math.floor(ci - rr); i <= Math.ceil(ci + rr); i++) {
				if (i < 0 || j < 0 || i >= N || j >= N) continue;
				const v = Math.round(smoothstep(w / 2 + cell, w / 2 - cell * 0.3, Math.hypot(i - ci, j - cj) * cell) * 255);
				if (v > masks[(j * N + i) * 4]) masks[(j * N + i) * 4] = v;
			}
		}
	}
}
// trodden ground: no wild growth (grass) and the path's packed surface
function trodden(I, x, z, r) {
	const { N, cell, half, masks } = I;
	for (let j = Math.max(0, Math.floor((z - r + half) / cell)); j <= Math.min(N - 1, Math.ceil((z + r + half) / cell)); j++) {
		for (let i = Math.max(0, Math.floor((x - r + half) / cell)); i <= Math.min(N - 1, Math.ceil((x + r + half) / cell)); i++) {
			const w = smoothstep(r, r - 8, Math.hypot(-half + i * cell - x, -half + j * cell - z)), k = (j * N + i) * 4;
			if (w <= 0) continue;
			masks[k + 3] = Math.round(masks[k + 3] * (1 - w));
			masks[k] = Math.max(masks[k], Math.round(w * 150));
		}
	}
}
// the ground's spread over a disc: how far from level it is
function rough(H, x, z, r) {
	const c = H(x, z);
	let s = 0;
	for (const f of [0.5, 1]) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; s = Math.max(s, Math.abs(H(x + Math.cos(a) * r * f, z + Math.sin(a) * r * f) - c)); }
	return s;
}
// a road from a to b: steps of 9 m turned toward b, choosing the gentlest of a fan of headings
function route(H, a, b) {
	const pts = [{ x: a.x, z: a.z }];
	let x = a.x, z = a.z;
	for (let n = 0; n < 220; n++) {
		const d = Math.hypot(b.x - x, b.z - z);
		if (d < 12) break;
		const to = Math.atan2(b.x - x, b.z - z);
		let best = null;
		for (let k = -3; k <= 3; k++) {
			const h = to + k * 0.22, nx = x + Math.sin(h) * 9, nz = z + Math.cos(h) * 9;
			const cost = Math.abs(H(nx, nz) - H(x, z)) * 1.6 + Math.abs(k) * 0.35;
			if (!best || cost < best.cost) best = { cost, nx, nz };
		}
		x = best.nx; z = best.nz;
		pts.push({ x, z });
	}
	pts.push({ x: b.x, z: b.z });
	return pts;
}

export function planColony(island, profile, opts = {}) {
	const S = colonyStyle(profile?.type);
	if (!S) return null;
	const isPhone = !!opts.isPhone, P = { ...S.parts };
	if (isPhone) { P.habs = Math.min(P.habs, 4); P.walkers = Math.ceil(P.walkers / 2); P.rovers = Math.min(P.rovers, 3); P.solar = Math.min(P.solar, 2); }
	const r = mulberry32((island.seed ^ 0xc0101e5) >>> 0);
	const H = island.heightAt, half = island.half, sea = (island.sea || 0) + (S.minH ?? 4);
	const avoid = [...(opts.avoid || [])];
	const V = island.village;
	if (V && !profile.airless && !profile.noVillage) avoid.push({ x: V.x, z: V.z, r: 140 });
	const free = (x, z, pad) => Math.hypot(x, z) < half * 0.88 && !avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad) && H(x, z) > sea;
	// no village here: its worn trails go with it (the roads below are the colony's own)
	if (profile.airless || profile.noVillage) for (let k = 0; k < island.masks.length; k += 4) island.masks[k] = island.masks[k + 1] = 0;
	const peak = island.peak;
	const volcanic = profile.relief === 'volcano' || peak?.volcanic;
	// keep off a volcano's cone, where the lava runs
	const cone = (x, z) => volcanic && Math.hypot(x - peak.x, z - peak.z) < peak.r * 0.75;

	// ---------- the hub ----------
	let hub = null;
	const craters = island.craters || [];
	if (profile.relief === 'lunar' && craters.length) {
		for (const q of craters) {
			if (q.r < 70 || q.r > 210 || !free(q.x, q.z, 60)) continue;
			const score = Math.abs(q.r - 120) + Math.hypot(q.x, q.z) * 0.15 + rough(H, q.x, q.z, q.r * 0.4) * 2;
			if (!hub || score < hub.score) hub = { x: q.x, z: q.z, crater: q, score };
		}
	}
	if (!hub) {
		for (let z = -half * 0.7; z <= half * 0.7; z += 36) for (let x = -half * 0.7; x <= half * 0.7; x += 36) {
			if (!free(x, z, 70) || cone(x, z)) continue;
			const score = rough(H, x, z, 55) * 3 + Math.hypot(x, z) * 0.02 + r() * 2;
			if (!hub || score < hub.score) hub = { x, z, score };
		}
	}
	if (!hub) return null;
	hub.r = hub.crater ? Math.min(62, hub.crater.r * 0.55) : 52;
	// the floor's level: its mean, cut into the ground a little
	let ym = 0;
	for (let k = 0; k < 12; k++) ym += H(hub.x + Math.cos(k) * hub.r * 0.5, hub.z + Math.sin(k) * hub.r * 0.5);
	hub.y = ym / 12;
	hub.yaw = r() * TAU;
	level(island, hub.x, hub.z, hub.r + 6, 22, hub.y);
	avoid.push({ x: hub.x, z: hub.z, r: (hub.crater ? hub.crater.r : hub.r) + 10 });

	// ---------- the spaceport ----------
	let port = null;
	const nPads = P.pads;
	const apron = 18 + nPads * 16;
	for (let k = 0; k < 64; k++) {
		const a = r() * TAU, d = (hub.crater ? hub.crater.r * 1.25 : hub.r) + apron + 30 + r() * 220;
		const x = hub.x + Math.sin(a) * d, z = hub.z + Math.cos(a) * d;
		if (!free(x, z, apron) || cone(x, z)) continue;
		const score = rough(H, x, z, apron) * 2 + d * 0.02;
		if (!port || score < port.score) port = { x, z, score, yaw: a };
	}
	if (port) {
		port.y = H(port.x, port.z);
		port.r = apron;
		level(island, port.x, port.z, apron * 1.45, 26, port.y);
		avoid.push({ x: port.x, z: port.z, r: apron + 10 });
		// pads in a row across the line to the hub; the tower and the station on the hub's side
		const c = Math.cos(port.yaw), s = Math.sin(port.yaw);
		const loc = (lx, lz) => ({ x: port.x + lx * c + lz * s, z: port.z - lx * s + lz * c });
		port.pads = [];
		for (let i = 0; i < nPads; i++) { const p = loc((i - (nPads - 1) / 2) * 34, 8); port.pads.push({ ...p, y: port.y, r: 13 }); }
		port.tower = { ...loc(apron * 0.55, -apron * 0.55), y: port.y };
		port.station = { ...loc(-apron * 0.5, -apron * 0.62), y: port.y };
		port.name = S.port;
	}

	// ---------- outposts ----------
	const outposts = [];
	const names = [...S.outposts];
	const add = (kind, x, z, rad) => {
		const y = H(x, z);
		level(island, x, z, rad, 12, y);
		avoid.push({ x, z, r: rad + 8 });
		outposts.push({ kind, x, z, y, r: rad, yaw: Math.atan2(hub.x - x, hub.z - z), name: names.shift() || 'Outpost' });
	};
	if (P.mine) {
		let best = null;
		// on the Moon: a crater rim facing the hub; elsewhere the high ground near it
		for (const q of craters) {
			const d = Math.hypot(q.x - hub.x, q.z - hub.z);
			if (q === hub.crater || q.r < 25 || q.r > 140 || d < 220 || d > 760) continue;
			const a = Math.atan2(hub.x - q.x, hub.z - q.z), x = q.x + Math.sin(a) * q.r * 1.02, z = q.z + Math.cos(a) * q.r * 1.02;
			if (!free(x, z, 16)) continue;
			const score = Math.abs(d - 420) + r() * 60;
			if (!best || score < best.score) best = { x, z, score };
		}
		if (!best) for (let k = 0; k < 60; k++) {
			const a = r() * TAU, d = 220 + r() * 420, x = hub.x + Math.sin(a) * d, z = hub.z + Math.cos(a) * d;
			if (!free(x, z, 16) || cone(x, z) && !volcanic) continue;
			const score = -H(x, z) + rough(H, x, z, 14) * 4 + (volcanic ? Math.abs(Math.hypot(x - peak.x, z - peak.z) - peak.r * 0.85) * 0.2 : 0);
			if (!best || score < best.score) best = { x, z, score };
		}
		if (best) add('mine', best.x, best.z, 14);
	}
	for (let n = 0; n < (P.dish ? 1 : 0); n++) {
		let best = null;
		for (let k = 0; k < 80; k++) {
			const a = r() * TAU, d = 160 + r() * 520, x = hub.x + Math.sin(a) * d, z = hub.z + Math.cos(a) * d;
			if (!free(x, z, 12) || cone(x, z)) continue;
			const score = -H(x, z) + rough(H, x, z, 10) * 3;
			if (!best || score < best.score) best = { x, z, score };
		}
		if (best) add('relay', best.x, best.z, 10);
	}
	if (P.stacks) {
		let best = null;
		for (let k = 0; k < 60; k++) {
			const a = r() * TAU, d = 170 + r() * 260, x = hub.x + Math.sin(a) * d, z = hub.z + Math.cos(a) * d;
			if (!free(x, z, 30)) continue;
			const score = rough(H, x, z, 28) * 3 + r();
			if (!best || score < best.score) best = { x, z, score };
		}
		if (best) add('scrubbers', best.x, best.z, 26);
	}
	// a solar farm on open ground near the hub
	const solar = [];
	for (let n = 0; n < P.solar; n++) {
		let best = null;
		for (let k = 0; k < 40; k++) {
			const a = r() * TAU, d = (hub.crater ? hub.crater.r * 1.2 : hub.r + 20) + 20 + r() * 140;
			const x = hub.x + Math.sin(a) * d, z = hub.z + Math.cos(a) * d;
			if (!free(x, z, 22) || cone(x, z)) continue;
			const score = rough(H, x, z, 20) * 3 + r();
			if (!best || score < best.score) best = { x, z, score };
		}
		if (!best) continue;
		const y = H(best.x, best.z);
		level(island, best.x, best.z, 20, 10, y);
		avoid.push({ x: best.x, z: best.z, r: 26 });
		solar.push({ x: best.x, z: best.z, y, r: 20, yaw: r() * TAU });
	}

	// ---------- roads and rail ----------
	// the hub's gate faces each place it serves; roads run from the gates
	const gate = (to) => { const a = Math.atan2(to.x - hub.x, to.z - hub.z), g = hub.r + 8; return { x: hub.x + Math.sin(a) * g, z: hub.z + Math.cos(a) * g }; };
	const roads = [];
	const ends = [...(port ? [port.station] : []), ...outposts, ...solar];
	for (const e of ends) roads.push(route(H, gate(e), e));
	for (const rd of roads) wear(island, rd, 5);
	// a ring road round the hub
	const ringR = [];
	for (let k = 0; k <= 36; k++) { const a = k / 36 * TAU; ringR.push({ x: hub.x + Math.sin(a) * (hub.r + 8), z: hub.z + Math.cos(a) * (hub.r + 8) }); }
	wear(island, ringR, 4);
	roads.push(ringR);
	// the maglev: the spaceport's station, the hub, on to the far outpost
	const rail = [];
	if (P.rail && port) {
		const far = outposts.find((o) => o.kind === 'mine') || outposts[0];
		const hs = gate(port.station);
		rail.push([port.station, hs].map((p) => ({ x: p.x, z: p.z })));
		if (far) { const h2 = gate(far); rail.push([h2, { x: far.x + Math.sin(far.yaw) * (far.r + 8), z: far.z + Math.cos(far.yaw) * (far.r + 8) }]); }
	}
	// keep the plants (where any grow) off it all, and the grass: the ground there is trodden bare
	const clear = [{ x: hub.x, z: hub.z, r: hub.r + 10 }, ...(port ? [{ x: port.x, z: port.z, r: port.r + 6 }] : []), ...outposts.map((o) => ({ x: o.x, z: o.z, r: o.r + 6 })), ...solar.map((o) => ({ x: o.x, z: o.z, r: o.r + 4 }))];
	for (const c of clear) trodden(island, c.x, c.z, c.r);
	return { style: S, parts: P, seed: island.seed, hub, port, outposts, solar, roads, rail, clear, name: S.name };
}
