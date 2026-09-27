// The works of the people who lived here before (or live here still, somewhere out of
// sight). Every world flight lands on but Earth has them: a great landmark on the high
// ground that can be seen from anywhere on the island, a complex or two on the level
// ground below it, and smaller works scattered about: markers, gates, beacons, ledges
// cut out over cliffs, spans across the gorges, pylons in the shallows. Each kind of
// world had its own people and they built in their own way (aliencivs.js).
//
// Sharp, angular, deliberate: the land here is weathered smooth, and whatever is cut
// clean and hard-edged was made. They stand on their own ground (a platform cut level,
// its sides going down past the lowest ground under it, a causeway up to it); some you
// can walk up onto or into.
//
// planAlien(island, profile, avoid) chooses the sites before anything grows (its clear
// circles keep the plants off them); createAlien builds them: a few merged meshes per
// site, one per material, the fine detail dropped with distance.

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { Kit, alienUniforms, skinMaterial, glowMaterial, beamMaterial, beamGeo, auroraMaterial, curtainGeo, skyEnvironment } from './alienkit.js';
import { CIVS, CIV_OF, nameFor, platform, bridge, baseOf, findRamp } from './aliencivs.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const KIND = { landmark: 'landmark', complex: 'complex', marker: 'small', gate: 'small', beacon: 'small', platform: 'small', bridge: 'small', stilt: 'small' };

// ---------- where they stand ----------
export function planAlien(island, profile, avoid = {}) {
	const type = profile?.type || 'TERRAN', civ = CIV_OF[type] || 'grown', C = CIVS[civ];
	const rnd = mulberry32((island.seed ^ 0xa11e4b) >>> 0);
	const H = (x, z) => island.heightAt(x, z), V = island.village || { x: 1e9, z: 1e9 }, pk = island.peak || { x: 0, z: 0, h: 100 };
	const volcanic = profile?.relief === 'volcano' || !!pk.volcanic;
	const holes = avoid.holes || [], fields = avoid.fields || [], phone = !!avoid.isPhone;
	const sites = [], R = island.R || 800;
	const near = (x, z, r, pad) => {
		if (Math.hypot(x - V.x, z - V.z) < r + 200) return true;
		if (volcanic && Math.hypot(x - pk.x, z - pk.z) < r + 340) return true;
		for (const h of holes) if (Math.hypot(x - h.x, z - h.z) < r + h.r + 16) return true;
		for (const f of fields) if (Math.hypot(x - f.x, z - f.z) < r + f.r + 12) return true;
		for (const s of sites) if (Math.hypot(x - s.x, z - s.z) < r + s.clearR + pad) return true;
		return false;
	};
	// the ground under a footprint: its lowest and highest, and whether it is all dry,
	// off the paths and the village, and clear of the shore
	const ground = (x, z, r, paths = true) => {
		let lo = H(x, z), hi = lo, ok = island.coastAt(x, z) > r + 30;
		for (const f of [0.45, 0.8, 1.05]) for (let k = 0; k < 12; k++) {
			const a = k / 12 * TAU, px = x + Math.sin(a) * r * f, pz = z + Math.cos(a) * r * f, h = H(px, pz);
			lo = Math.min(lo, h); hi = Math.max(hi, h);
			if (h < 2.5 || island.maskAt(px, pz, 1) > 0.05 || (paths && island.maskAt(px, pz, 0) > 0.35)) ok = false;
		}
		return { lo, hi, ok };
	};
	const add = (S) => {
		S.id = sites.length;
		S.kind = KIND[S.type];
		S.name = `${C.nouns[S.type] || S.type} of ${nameFor(C, rnd)}`;
		S.clearR = S.clearR || S.r + 6;
		sites.push(S);
		return S;
	};
	const scale = { tether: 1.25, sun: 0.95, lens: 0.95, glass: 1.05 }[C.key] || 1;

	// the landmark: the highest ground a platform can be cut level on
	let best = null;
	for (const rL of [34, 28]) {
		for (let z = -R * 1.05; z <= R * 1.05; z += 18) for (let x = -R * 1.05; x <= R * 1.05; x += 18) {
			const h = H(x, z);
			if (h < 12 || near(x, z, rL, 60)) continue;
			const g = ground(x, z, rL, false);
			if (!g.ok || g.hi - g.lo > 30) continue;
			const score = g.hi - (g.hi - g.lo) * 1.3 - Math.hypot(x, z) * 0.01;
			if (!best || score > best.score) best = { score, x, z, g, r: rL };
		}
		if (best) break;
	}
	if (best) {
		const S = { type: 'landmark', x: best.x, z: best.z, r: best.r, g0: best.g.lo, g1: best.g.hi, y: best.g.hi + 1, h: (190 + rnd() * 70) * scale, yaw: rnd() * TAU };
		// it faces the village, the way most come to it from
		S.yaw = Math.atan2(V.x - S.x, V.z - S.z);
		add(S);
	}
	const L = sites[0] || { x: pk.x, z: pk.z };
	// the complexes: broad level ground on the slopes below, well away from the landmark
	for (let n = 0; n < (phone ? 1 : 2); n++) {
		let b = null;
		const rC = 44;
		for (let z = -R; z <= R; z += 22) for (let x = -R; x <= R; x += 22) {
			const h = H(x, z);
			if (h < 4 || h > pk.h * 0.8 || near(x, z, rC, 70) || Math.hypot(x - L.x, z - L.z) < 280) continue;
			const g = ground(x, z, rC);
			if (!g.ok || g.hi - g.lo > 8) continue;
			const score = (g.hi - g.lo) * 3 + Math.abs(h - 35) * 0.04 + rnd() * 8 - Math.min(400, Math.hypot(x - L.x, z - L.z)) * 0.01;
			if (!b || score < b.score) b = { score, x, z, g };
		}
		if (!b) break;
		// its door toward the lowest ground round it (the view, and the way up)
		let dn = 0, lo = 1e9;
		for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, h = H(b.x + Math.sin(a) * (rC + 14), b.z + Math.cos(a) * (rC + 14)); if (h < lo) { lo = h; dn = a; } }
		add({ type: 'complex', x: b.x, z: b.z, r: rC, g0: b.g.lo, g1: b.g.hi, y: b.g.hi + 1, h: 40, yaw: dn });
	}
	// a span across a gorge, where there is one
	{
		let b = null;
		for (let i = 0; i < 700 && !b; i++) {
			const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R, ha = H(x, z);
			if (ha < 8 || near(x, z, 8, 40) || island.coastAt(x, z) < 40) continue;
			for (let k = 0; k < 12 && !b; k++) {
				const a = k / 12 * TAU, dx = Math.sin(a), dz = Math.cos(a);
				for (let len = 34; len <= 90; len += 8) {
					const bx = x + dx * len, bz = z + dz * len, hb = H(bx, bz);
					if (Math.abs(ha - hb) > 5 || hb < 8 || island.coastAt(bx, bz) < 40 || near(bx, bz, 8, 40)) continue;
					let low = 1e9;
					for (let t = 0.15; t <= 0.85; t += 0.05) low = Math.min(low, H(x + dx * len * t, z + dz * len * t));
					if (low > Math.min(ha, hb) - 14) continue;
					let clear = true;
					for (let t = 0; t <= 1; t += 0.1) if (island.maskAt(x + dx * len * t, z + dz * len * t, 1) > 0.05 || near(x + dx * len * t, z + dz * len * t, 4, 20)) clear = false;
					if (!clear) continue;
					b = { a: { x, z }, b: { x: bx, z: bz }, len, y: Math.max(ha, hb) + 0.6 };
					break;
				}
			}
		}
		if (b) {
			const S = add({ type: 'bridge', x: (b.a.x + b.b.x) / 2, z: (b.a.z + b.b.z) / 2, r: b.len / 2 + 6, a: b.a, b: b.b, y: b.y, g0: b.y - 20, g1: b.y, h: 6, yaw: Math.atan2(b.b.x - b.a.x, b.b.z - b.a.z) });
			S.clear = [{ x: b.a.x, z: b.a.z, r: 8 }, { x: b.b.x, z: b.b.z, r: 8 }];
		}
	}
	// ledges cut out over cliffs: an edge where the ground falls away steeply
	for (let n = 0, tries = 0; n < 2 && tries < 900; tries++) {
		const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R, h = H(x, z);
		if (h < 14 || near(x, z, 12, 50)) continue;
		for (let k = 0; k < 12; k++) {
			const a = k / 12 * TAU, dx = Math.sin(a), dz = Math.cos(a);
			const h8 = H(x + dx * 8, z + dz * 8), h22 = H(x + dx * 22, z + dz * 22), hb = H(x - dx * 6, z - dz * 6);
			if (h - h8 > 5 || h - h22 < 15 || Math.abs(hb - h) > 2.5) continue;
			if (island.maskAt(x, z, 0) > 0.3 || island.maskAt(x, z, 1) > 0.05 || island.coastAt(x, z) < 30) continue;
			add({ type: 'platform', x, z, r: 10, clearR: 12, g0: h8, g1: h, y: Math.max(h, hb) + 0.5, h: 3, yaw: a });
			n++;
			break;
		}
	}
	// tidal pylons in the shallows, off an ocean world's shore
	if (type === 'OCEAN') {
		for (let n = 0, tries = 0; n < 3 && tries < 1500; tries++) {
			const a = rnd() * TAU, d = R * (0.7 + rnd() * 0.6), x = Math.sin(a) * d, z = Math.cos(a) * d, h = H(x, z);
			if (h > -2 || h < -7 || near(x, z, 6, 60)) continue;
			let land = false;
			for (let k = 0; k < 8; k++) { const b = k / 8 * TAU; if (H(x + Math.sin(b) * 45, z + Math.cos(b) * 45) > 1) land = true; }
			if (!land) continue;
			add({ type: 'stilt', x, z, r: 7, g0: h, g1: 0, y: 1.2, h: 24, yaw: rnd() * TAU });
			n++;
		}
	}
	// the small works, spread over the island: the next each time the one furthest from the rest
	const want = phone ? 6 : 10, kinds = ['marker', 'gate', 'beacon'];
	const cand = [];
	for (let i = 0; i < 600; i++) {
		const x = (rnd() * 2 - 1) * R, z = (rnd() * 2 - 1) * R;
		if (H(x, z) < 5) continue;
		cand.push({ x, z });
	}
	for (let n = 0; n < want; n++) {
		let b = null;
		for (const c of cand) {
			if (c.used) continue;
			const r = 9;
			if (near(c.x, c.z, r, 30)) { c.used = true; continue; }
			let dmin = 1e9;
			for (const s of sites) dmin = Math.min(dmin, Math.hypot(c.x - s.x, c.z - s.z));
			const score = dmin + H(c.x, c.z) * 0.6;
			if (!b || score > b.score) b = { score, c };
		}
		if (!b) break;
		b.c.used = true;
		const g = ground(b.c.x, b.c.z, 9);
		if (!g.ok || g.hi - g.lo > 4) { n--; if (cand.every((c) => c.used)) break; continue; }
		const type = kinds[n % kinds.length];
		// gates look toward the landmark: seen through one, it stands framed
		const yaw = type === 'gate' ? Math.atan2(L.x - b.c.x, L.z - b.c.z) + Math.PI / 2 : rnd() * TAU;
		add({ type, x: b.c.x, z: b.c.z, r: 9, g0: g.lo, g1: g.hi, y: g.hi + 0.6, h: 20, yaw });
	}
	// the circles nothing is to grow in: each footprint, its terraces, the causeways up to it
	const clear = [];
	for (const S of sites) {
		if (S.clear) { clear.push(...S.clear); continue; }
		if (S.type === 'stilt') continue;
		const B = baseOf(C, S);
		clear.push({ x: S.x, z: S.z, r: (S.kind === 'small' ? S.r : B.out) + 4 });
		const rp = S.kind === 'small' ? null : findRamp(H, S, B);
		if (rp) for (let q = B.out; q <= rp.rr + 2; q += 7) clear.push({ x: S.x + Math.sin(S.yaw + rp.th) * q, z: S.z + Math.cos(S.yaw + rp.th) * q, r: B.rampW / 2 + 3 });
	}
	return { civ, type, people: C.people, sites, clear };
}

// ---------- what you walk on and into ----------
function colliders() {
	const CELL = 48, grid = new Map(), all = [];
	const key = (i, j) => i * 73856093 ^ j * 19349663;
	const put = (e, x, z, r) => {
		all.push(e);
		for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) {
			const k = key(i, j);
			if (!grid.has(k)) grid.set(k, []);
			grid.get(k).push(e);
		}
	};
	const at = (x, z) => grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
	const local = (e, x, z) => { const dx = x - e.x, dz = z - e.z; return [dx * e.c - dz * e.s, dx * e.s + dz * e.c]; };
	const topOf = (e, lz) => e.kind === 'ramp' ? e.y0 + (e.y1 - e.y0) * Math.max(0, Math.min(1, (lz - e.z0) / (e.z1 - e.z0))) : e.top;
	const api = {
		all,
		disc(x, z, r, top, o = {}) { put({ kind: 'disc', x, z, r, top, y0: o.y0 ?? -1e9, floor: o.floor !== false, solid: o.solid !== false, site: o.site }, x, z, r); },
		box(x, z, yaw, hw, hd, top, o = {}) { put({ kind: 'box', x, z, c: Math.cos(yaw), s: Math.sin(yaw), hw, hd, top, y0: o.y0 ?? -1e9, floor: o.floor !== false, solid: o.solid !== false, site: o.site }, x, z, Math.hypot(hw, hd)); },
		// a slope along the frame's z from z0 (height y0) to z1 (height y1)
		ramp(x, z, yaw, hw, z0, z1, y0, y1, site, solid = true) {
			const zm = (z0 + z1) / 2, c = Math.cos(yaw), s = Math.sin(yaw);
			put({ kind: 'ramp', x, z, c, s, hw, z0, z1, y0, y1, floor: true, solid, site }, x + zm * s, z + zm * c, Math.hypot(hw, (z1 - z0) / 2) + Math.abs(zm));
		},
		// a curve of terraces: an annulus from bearing a0 through span
		ring(x, z, r0, r1, top, a0, span, site) { put({ kind: 'ring', x, z, r0, r1, top, a0, span, floor: true, solid: false, site }, x, z, r1); },
		seg(a, b, hw, top, site, y0 = -1e9) { put({ kind: 'seg', ax: a.x, az: a.z, bx: b.x, bz: b.z, hw, top, y0, floor: false, solid: true, site }, (a.x + b.x) / 2, (a.z + b.z) / 2, Math.hypot(b.x - a.x, b.z - a.z) / 2 + hw); },
		floor(x, z, y) {
			let best = -Infinity;
			for (const e of at(x, z)) {
				if (!e.floor) continue;
				let top;
				if (e.kind === 'disc') { if ((x - e.x) ** 2 + (z - e.z) ** 2 > e.r * e.r) continue; top = e.top; }
				else if (e.kind === 'ring') {
					const d = Math.hypot(x - e.x, z - e.z);
					if (d < e.r0 || d > e.r1) continue;
					const b = ((Math.atan2(x - e.x, z - e.z) - e.a0) % TAU + TAU) % TAU;
					if (b > e.span) continue;
					top = e.top;
				} else {
					const [lx, lz] = local(e, x, z);
					if (Math.abs(lx) > e.hw) continue;
					if (e.kind === 'box' ? Math.abs(lz) > e.hd : lz < e.z0 || lz > e.z1) continue;
					top = topOf(e, lz);
				}
				if (y > top - 1.4 && top > best) best = top;
			}
			return best;
		},
		push(p, footY) {
			const list = at(p.x, p.z);
			// on a causeway or a stair: its own site's walls do not stop you climbing it
			let skip = -1;
			for (const e of list) {
				if (e.kind !== 'ramp') continue;
				const [lx, lz] = local(e, p.x, p.z);
				if (Math.abs(lx) < e.hw + 0.2 && lz > e.z0 - 0.5 && lz < e.z1 + 0.5 && footY > topOf(e, lz) - 0.7) skip = e.site;
			}
			const pad = 0.35;
			for (const e of list) {
				if (!e.solid || e.site === skip) continue;
				// (what can be stepped up onto is left to the floor to lift you)
				const lim = e.floor ? 1.2 : 0.3;
				if (e.kind === 'seg') {
					if (footY >= e.top - lim || footY < e.y0 - 1.8) continue;
					const dx = e.bx - e.ax, dz = e.bz - e.az, l2 = dx * dx + dz * dz || 1;
					const t = Math.max(0, Math.min(1, ((p.x - e.ax) * dx + (p.z - e.az) * dz) / l2));
					const qx = e.ax + dx * t, qz = e.az + dz * t, d = Math.hypot(p.x - qx, p.z - qz), m = e.hw + pad;
					if (d >= m) continue;
					let nx = p.x - qx, nz = p.z - qz;
					if (d < 1e-4) { nx = -dz; nz = dx; }
					const nl = Math.hypot(nx, nz) || 1;
					p.x = qx + nx / nl * m; p.z = qz + nz / nl * m;
				} else if (e.kind === 'disc') {
					if (footY >= e.top - lim || footY < e.y0 - 1.8) continue;
					const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), m = e.r + pad;
					if (d >= m) continue;
					const nl = d || 1;
					p.x = e.x + (d ? dx / nl : 1) * m; p.z = e.z + (d ? dz / nl : 0) * m;
				} else if (e.kind === 'box' || e.kind === 'ramp') {
					const [lx, lz] = local(e, p.x, p.z);
					const hd = e.kind === 'box' ? e.hd : (e.z1 - e.z0) / 2, cz = e.kind === 'box' ? 0 : (e.z0 + e.z1) / 2;
					if (Math.abs(lx) >= e.hw + pad || Math.abs(lz - cz) >= hd + pad) continue;
					if (footY >= topOf(e, lz) - lim || footY < (e.y0 ?? -1e9) - 1.8 && e.kind === 'box') continue;
					const pen = [e.hw + pad - lx, lx + e.hw + pad, cz + hd + pad - lz, lz - (cz - hd - pad)];
					const k = pen.indexOf(Math.min(...pen));
					let nx = lx, nz = lz;
					if (k === 0) nx = e.hw + pad; else if (k === 1) nx = -e.hw - pad; else if (k === 2) nz = cz + hd + pad; else nz = cz - hd - pad;
					p.x = e.x + nx * e.c + nz * e.s; p.z = e.z - nx * e.s + nz * e.c;
				}
			}
		},
	};
	return api;
}

// ---------- building them ----------
export function createAlien(island, shared, scene, camera, profile, plan, opts = {}) {
	const none = { update() {}, floor: () => -Infinity, push() {}, sites: [], go: () => 'no alien works on this world', dispose() {}, group: null };
	if (!plan || !plan.sites.length) return none;
	const C = CIVS[plan.civ], isPhone = !!opts.isPhone;
	const group = new THREE.Group();
	group.name = 'alien';
	scene.add(group);
	const U = alienUniforms(shared, C.glow);
	// what the metal and glass reflect: this world's own sky
	const air = profile?.air?.tint || [0.75, 0.85, 1.0], rock = profile?.ground?.rock || [0.3, 0.3, 0.3];
	const envRT = skyEnvironment(opts.renderer, air.map((v) => v * 0.4), air.map((v) => v * 0.7), rock.map((v) => v * 0.3));
	const env = envRT?.texture || null;
	const mats = {
		body: skinMaterial(U, { ...C.mats.body, env }),
		trim: skinMaterial(U, { ...C.mats.trim, env }),
		glass: skinMaterial(U, { ...C.mats.glass, env }),
		glow: glowMaterial(U),
	};
	const beamMat = beamMaterial(U), auroraMat = auroraMaterial(U);
	const col = colliders();
	const beams = [], auroras = [];
	const groups = [];
	const X = {
		C, col, r: mulberry32((island.seed ^ 0x5ea7ed) >>> 0), H: (x, z) => island.heightAt(x, z), det: isPhone ? 0.6 : 1,
		rings: profile?.sky?.rings || false,
		beam: (p, len, r0, r1, dir, c) => beams.push(beamGeo(p, len, r0, r1, dir, c)),
		aurora: (c, R, a0, a1, h) => auroras.push(curtainGeo(c, R, a0, a1, h, isPhone ? 24 : 48)),
	};
	const t0 = performance.now();
	// the landmark and each complex are merged on their own (so each can shed its fine
	// detail with distance); the small works all together, a handful of meshes for them all
	const smallK = new Kit();
	for (const S of plan.sites) {
		X.K = S.kind === 'small' ? smallK : new Kit();
		try {
			if (S.type === 'platform') platform(X, S);
			else if (S.type === 'bridge') bridge(X, S);
			else (C[S.type] || C.marker)(X, S);
		} catch (err) {
			console.error('[alien] ' + S.name, err);
			continue;
		}
		if (S.kind === 'small') continue;
		const g = new THREE.Group();
		g.name = 'alien:' + S.name;
		const meshes = X.K.build(mats, g);
		group.add(g);
		groups.push({ S, g, meshes, far: S.kind === 'landmark' ? Infinity : 2600, nearD: S.kind === 'landmark' ? 700 : 420 });
	}
	if (smallK.b.size) {
		const g = new THREE.Group();
		g.name = 'alien:small works';
		smallK.build(mats, g, true);
		group.add(g);
	}
	if (beams.length) {
		const m = new THREE.Mesh(mergeGeometries(beams), beamMat);
		m.frustumCulled = false; m.renderOrder = 3; m.name = 'alien:beams';
		group.add(m);
		for (const b of beams) b.dispose();
	}
	if (auroras.length) {
		const m = new THREE.Mesh(mergeGeometries(auroras), auroraMat);
		m.frustumCulled = false; m.renderOrder = 3; m.name = 'alien:aurora';
		group.add(m);
		for (const a of auroras) a.dispose();
	}
	const buildMs = performance.now() - t0;

	// a low hum near the landmark: two tones a hair apart, beating slowly
	const hum = { nodes: null, k: 0 };
	function humUpdate(dt) {
		const L = plan.sites[0];
		if (!L || L.kind !== 'landmark') return;
		const d = Math.hypot(camera.position.x - L.x, camera.position.z - L.z);
		const want = Math.max(0, 1 - Math.max(0, d - L.r) / 260) * (camera.position.y > -1 ? 1 : 0);
		hum.k += (want - hum.k) * Math.min(1, dt * 0.8);
		if (hum.k < 0.002 && !hum.nodes) return;
		const bus = window._masterClip || window.leadBus227, ctx = bus?.context;
		if (!ctx || ctx.state !== 'running') return;
		if (!hum.nodes || hum.nodes.ctx !== ctx) {
			try {
				const g = ctx.createGain(), lp = ctx.createBiquadFilter();
				g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 420;
				const base = { choir: 110, lens: 41.2, brood: 58.3, sun: 73.4, glass: 146.8, forge: 49, grown: 87.3, tether: 98 }[C.key] || 82.4;
				const osc = [base, base * 1.0035, base * 1.5].map((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = i === 2 ? 0.25 : 0.5; o.connect(og); og.connect(lp); o.start(); return o; });
				lp.connect(g); g.connect(bus);
				hum.nodes = { ctx, g, lp, osc };
			} catch { return; }
		}
		hum.nodes.g.gain.setTargetAtTime(hum.k * 0.05, ctx.currentTime, 0.2);
	}
	function humStop() {
		if (!hum.nodes) return;
		try { for (const o of hum.nodes.osc) o.stop(); hum.nodes.g.disconnect(); } catch { /* already gone */ }
		hum.nodes = null;
	}

	// arriving at one: its name
	const seen = new Set();
	let lookT = 0;
	function update(dt) {
		// the light lines brighten as the day goes; the music stirs them
		const sy = shared.uSunDir.value.y, night = 1 - THREE.MathUtils.smoothstep(sy, -0.12, 0.12);
		U.uNight.value = night;
		U.uGlowK.value = 1.1 + night * 1.9;
		beamMat.uniforms.uBeamK.value = 0.07 + night * 0.6;
		auroraMat.uniforms.uK.value = 0.06 + night * 1.2;
		const envK = 0.25 + 0.75 * THREE.MathUtils.smoothstep(sy, -0.1, 0.3);
		for (const m of [mats.body, mats.trim, mats.glass]) m.envMapIntensity = envK * m.userData.env;
		// far sites drop their fine detail, and past a distance are left out
		const cx = camera.position.x, cz = camera.position.z;
		for (const G of groups) {
			const d = Math.hypot(cx - G.S.x, cz - G.S.z) - G.S.r;
			const vis = d < G.far;
			if (G.g.visible !== vis) G.g.visible = vis;
			if (!vis) continue;
			for (const m of G.meshes) if (m.userData.near) m.visible = d < G.nearD;
		}
		humUpdate(dt);
		lookT += dt;
		if (lookT > 0.5 && opts.hint) {
			lookT = 0;
			for (const S of plan.sites) {
				if (seen.has(S.id)) continue;
				const d = Math.hypot(cx - S.x, cz - S.z);
				if (d < S.r + (S.kind === 'small' ? 12 : 30) && camera.position.y < S.y + (S.h || 20) + 30) {
					seen.add(S.id);
					opts.hint(`${S.name}\nbuilt by ${C.people}`, 5000);
				}
			}
		}
	}
	// go and look at one: stand off from it on open ground, facing it
	function go(i = 0) {
		const S = plan.sites[i], P = opts.player?.();
		if (!S || !P) return 'no such site';
		const back = S.kind === 'landmark' ? S.r + 90 + S.h * 0.15 : S.kind === 'complex' ? S.r + 45 : S.type === 'bridge' ? 40 : S.r + 18;
		let best = null;
		for (let k = 0; k < 16; k++) {
			const a = S.yaw + k / 16 * TAU, x = S.x + Math.sin(a) * back, z = S.z + Math.cos(a) * back, h = island.heightAt(x, z);
			if (h < 1) continue;
			const score = -Math.abs(h - S.y) - (k ? 4 : 0);
			if (!best || score > best.score) best = { x, z, h, score };
		}
		const x = best ? best.x : S.x + back, z = best ? best.z : S.z;
		P.flying = false; P.diving = false; P.vel?.set(0, 0, 0);
		const g = Math.max(island.heightAt(x, z), col.floor(x, z, 1e4) > -1e8 ? col.floor(x, z, 1e4) : -1e9);
		P.pos.set(x, g + 1.7, z);
		P.yaw = Math.atan2(-(S.x - x), -(S.z - z));
		P.pitch = S.kind === 'landmark' ? 0.28 : 0.05;
		camera.position.copy(P.pos);
		return S.name;
	}
	function dispose() {
		humStop();
		envRT?.dispose();
		for (const m of [mats.body, mats.trim, mats.glass, mats.glow, beamMat, auroraMat]) m.dispose();
		group.traverse((o) => o.geometry?.dispose());
		scene.remove(group);
	}
	const sites = plan.sites.map((S, i) => ({ i, name: S.name, type: S.type, x: Math.round(S.x), z: Math.round(S.z), y: Math.round(S.y), h: Math.round(S.h || 0), r: S.r, yaw: +S.yaw.toFixed(3) }));
	return {
		update, floor: col.floor, push: col.push, sites, go, dispose, group, colliders: col,
		info: () => ({ civ: plan.civ, people: C.people, sites: sites.length, buildMs: Math.round(buildMs), meshes: group.children.reduce((n, c) => n + (c.isMesh ? 1 : c.children.length), 0), tris: (() => { let t = 0; group.traverse((o) => { if (o.isMesh) t += o.geometry.attributes.position.count / 3; }); return Math.round(t); })(), colliders: col.all.length }),
	};
}
