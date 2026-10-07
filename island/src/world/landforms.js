// Each kind of world's own landfall: not the island recoloured, but a land of its own shape
// (planet/profile.js `land`). A landform gives the height at any point, its great feature
// (the peak every other system climbs toward), and once the heights are made, the place a
// traveller comes down: the landfall, with the way it faces.
//
//   isles      two high jungle islands joined by a sandbar, a third offshore
//   continent  a coast along one side, rolling country, highlands, and a river valley to the sea
//   atoll      a ring of low islets round a lagoon, a few volcanic stacks, no big island
//   canyon     mesa tableland cut by canyons, opening onto a sea of dunes
//   fjord      ice ridges, glacier valleys with crevasses, drowned at their mouths
//   lavaplain  a black plain, calderas, fields of basalt columns
//   marsh      acid pools and channels, hills of fungal shelf terraces
//   floating   a crystal plain, sheer pillars, terraces of rock hung in the air
//   clouddeck  platforms standing out of a sea of cloud, natural bridges between them
//   plateau    stepped highland tablelands, gorges, wide pasture treads
//   riverplain a broad plain under one steep castle hill, downs at its edges

import { smoothstep, lerp, clamp, hash2 } from '../noise.js';

const TAU = Math.PI * 2;

export function makeLandform(kind, { nz, rand, half }) {
	const ang = rand() * TAU;
	const d = { x: Math.cos(ang), z: Math.sin(ang) }, s = { x: -d.z, z: d.x };
	const along = (x, z) => x * d.x + z * d.z, across = (x, z) => x * s.x + z * s.z;
	// the far coast, all round at the map's edge: the land runs out to a sea in the haze
	const rimK = (x, z) => smoothstep(0.82, 0.97, Math.hypot(x, z) / half + (nz.fbm(x * 0.0012 + 5, z * 0.0012 - 3, 2) - 0.5) * 0.22);
	const toSea = (h, e) => e <= 0 ? h : lerp(h, Math.min(h, -45), e);
	// a meandering line across the land: its offset along the given axis
	const mk = () => ({ a1: 70 + rand() * 50, a2: 20 + rand() * 25, p1: rand() * TAU, p2: rand() * TAU, v0: (rand() - 0.5) * 240 });
	const meander = (m, u) => m.v0 + m.a1 * Math.sin(u / 260 + m.p1) + m.a2 * Math.sin(u / 105 + m.p2);
	const bump = (q, x, z) => Math.hypot(x - q.x, z - q.z) / q.r;
	const scatter = (n, rmin, rmax, reach, space) => {
		const out = [];
		for (let k = 0; out.length < n && k < n * 40; k++) {
			const a = rand() * TAU, dd = Math.sqrt(rand()) * reach, r = rmin + rand() * (rmax - rmin);
			const q = { x: Math.cos(a) * dd, z: Math.sin(a) * dd, r };
			if (out.some((o) => Math.hypot(o.x - q.x, o.z - q.z) < (o.r + q.r) * space)) continue;
			out.push(q);
		}
		return out;
	};
	const L = { kind, R: half * 0.85, peak: null, inland: true, post: null };

	if (kind === 'isles') {
		const gap = 70 + rand() * 50, r0 = 400 + rand() * 60, r1 = 300 + rand() * 50;
		const c0 = { x: -d.x * (r0 + gap / 2) * 0.82, z: -d.z * (r0 + gap / 2) * 0.82, r: r0, h: 170 + rand() * 60 };
		const c1 = { x: d.x * (r1 + gap / 2) * 0.82, z: d.z * (r1 + gap / 2) * 0.82, r: r1, h: 110 + rand() * 50 };
		const c2 = { x: s.x * 620 + d.x * 120, z: s.z * 620 + d.z * 120, r: 170, h: 60 + rand() * 30 };
		const isl = [c0, c1, c2];
		const bar = { ax: c0.x + d.x * c0.r * 0.7, az: c0.z + d.z * c0.r * 0.7, bx: c1.x - d.x * c1.r * 0.7, bz: c1.z - d.z * c1.r * 0.7 };
		L.height = (x, z) => {
			let h = -60;
			for (const q of isl) {
				const wx = x + (nz.fbm(x * 0.002 + q.r, z * 0.002, 3) - 0.5) * 260, wz = z + (nz.fbm(x * 0.002, z * 0.002 - q.r, 3) - 0.5) * 260;
				const t = Math.hypot(wx - q.x, wz - q.z) / q.r;
				let v = t < 0.85 ? 2.4 + (0.85 - t) * 26 : t < 1 ? lerp(2.4, -0.8, (t - 0.85) / 0.15) : lerp(-0.8, -9, smoothstep(1, 1.3, t)) + lerp(0, -40, smoothstep(1.3, 2.2, t));
				if (t < 0.8) v += Math.pow(Math.max(0, 1 - t / 0.75), 1.6) * q.h * (0.6 + 0.4 * nz.ridged(x * 0.004 + q.h, z * 0.004, 4));
				h = Math.max(h, v);
			}
			// the sandbar between the two: a low ridge of sand across the strait
			const bx = bar.bx - bar.ax, bz = bar.bz - bar.az, bl = bx * bx + bz * bz;
			const tt = clamp(((x - bar.ax) * bx + (z - bar.az) * bz) / bl, 0, 1), ds = Math.hypot(x - bar.ax - bx * tt, z - bar.az - bz * tt);
			h = Math.max(h, 1.35 - (ds * ds) / 380);
			return h;
		};
		L.R = half * 0.8;
		L.peak = { x: c0.x, z: c0.z, h: c0.h, r: c0.r };
		L.inland = false;
		// landfall: the middle of the sandbar, facing out across the strait
		L.site = () => ({ x: (bar.ax + bar.bx) / 2, z: (bar.az + bar.bz) / 2, face: { x: s.x, z: s.z }, coastal: true, onBar: true });
	} else if (kind === 'continent') {
		const riv = mk();
		const coastU = (v) => 380 + (nz.fbm(v * 0.002 + 9, 3.3, 3) - 0.5) * 300;
		L.height = (x, z) => {
			const u = along(x, z), v = across(x, z), inl = coastU(v) - u;
			let h;
			if (inl < 0) h = Math.max(-60, -1.2 + inl * 0.09);
			else {
				h = 1.6 + inl * 0.04 + Math.max(0, (nz.fbm(x * 0.0024, z * 0.0024, 4) - 0.42) * 46) * smoothstep(0, 220, inl);
				h += Math.pow(nz.ridged(x * 0.0018 + 7, z * 0.0018 - 3, 4), 2.2) * 210 * smoothstep(420, 1100, inl);
			}
			// the river valley: a broad floor sloping to the sea, drowned at the mouth
			const dv = Math.abs(v - meander(riv, u)), wide = 80 + Math.max(0, inl) * 0.05;
			const fl = Math.max(-4, 0.3 + inl * 0.016);
			const vk = 1 - smoothstep(wide * 0.35, wide * 1.7, dv);
			if (inl > -120) h = lerp(h, Math.min(h, fl + Math.pow(dv / wide, 2) * 6), vk * smoothstep(-120, -20, inl));
			return toSea(h, rimK(x, z));
		};
		L.site = (H) => {
			let best = null;
			for (let inl = 80; inl < 300; inl += 10) for (const side of [-1, 1]) {
				const v0 = 0, u = coastU(v0) - inl;
				const v = meander(riv, u) + side * (90 + inl * 0.05);
				const x = d.x * u + s.x * v, z = d.z * u + s.z * v, h = H(x, z);
				if (h < 2 || h > 16) continue;
				const sc = rough(H, x, z, 45) + Math.abs(inl - 160) * 0.01;
				if (!best || sc < best.sc) best = { sc, x, z };
			}
			best ||= { x: d.x * 200, z: d.z * 200 };
			return { x: best.x, z: best.z, face: { x: d.x, z: d.z } };
		};
	} else if (kind === 'atoll') {
		const Lc = { x: (rand() - 0.5) * 260, z: (rand() - 0.5) * 260 }, Ra = 560 + rand() * 80;
		const stacks = [0, 1, 2].map((k) => {
			const a = ang + k * 2.2 + rand() * 0.6, rr = Ra + (k === 0 ? -40 : 160 + rand() * 200);
			return { x: Lc.x + Math.cos(a) * rr, z: Lc.z + Math.sin(a) * rr, r: k === 0 ? 120 : 70 + rand() * 40, h: k === 0 ? 46 + rand() * 18 : 18 + rand() * 20 };
		});
		L.height = (x, z) => {
			const rr = Math.hypot(x - Lc.x, z - Lc.z) + (nz.fbm(x * 0.0022 + 4, z * 0.0022, 3) - 0.5) * 180;
			const W = 55 + nz.fbm(x * 0.004, z * 0.004 + 8, 2) * 70, dr = rr - Ra;
			let h;
			if (dr < -W) {
				// the lagoon: clear and shallow, scattered with coral heads
				h = -3.5 - smoothstep(-W, -W - 220, dr) * 7;
				h = Math.max(h, -11 + smoothstep(0.6, 0.7, nz.fbm(x * 0.02 + 3, z * 0.02, 2)) * 9.6);
			} else if (dr < W) {
				const k = 1 - (dr / W) * (dr / W), motu = smoothstep(0.48, 0.56, nz.fbm(x * 0.0055 + 11, z * 0.0055 - 2, 3));
				h = lerp(-3.5, -0.5, smoothstep(0, 0.35, k)) + motu * 4.2 * Math.pow(k, 0.7);
			} else h = Math.max(-95, -2 - (dr - W) * 0.32);
			for (const q of stacks) {
				const t = bump(q, x, z);
				if (t < 1.4) h = Math.max(h, (t < 1 ? 1.2 + q.h * Math.pow(1 - t, 1.4) * (0.7 + 0.3 * nz.ridged(x * 0.012, z * 0.012, 3)) : 1.2) - smoothstep(1, 1.4, t) * 6);
			}
			return h;
		};
		L.R = Ra + 220;
		L.peak = { x: stacks[0].x, z: stacks[0].z, h: stacks[0].h, r: stacks[0].r };
		L.inland = false;
		L.bay = { x: Lc.x, z: Lc.z, r: 240 };
		// landfall: the broadest islet on the ring, its lagoon shore
		L.site = (H) => {
			let best = null;
			for (let k = 0; k < 96; k++) {
				const a = k / 96 * TAU;
				let land = 0, at = 0;
				for (let rr = Ra - 160; rr < Ra + 160; rr += 6) { const h = H(Lc.x + Math.cos(a) * rr, Lc.z + Math.sin(a) * rr); if (h > 1.4) { land++; at += rr; } }
				if (land < 6) continue;
				const sc = land + rand();
				if (!best || sc > best.sc) best = { sc, a, rr: at / land };
			}
			best ||= { a: ang, rr: Ra };
			const x = Lc.x + Math.cos(best.a) * best.rr, z = Lc.z + Math.sin(best.a) * best.rr;
			return { x, z, face: { x: -Math.cos(best.a), z: -Math.sin(best.a) }, coastal: true };
		};
	} else if (kind === 'canyon') {
		const dune = { x: d.x, z: d.z }, wind = { x: Math.cos(ang + 1.2), z: Math.sin(ang + 1.2) };
		L.height = (x, z) => {
			const table = 60 + (nz.fbm(x * 0.0015, z * 0.0015, 3) - 0.5) * 50;
			const f = table / 19, fl = Math.floor(f), terr = (fl + smoothstep(0.7, 0.95, f - fl)) * 19;
			const cn = 1 - Math.abs(nz.fbm(x * 0.0026 + 20, z * 0.0026 - 4, 3) * 2 - 1);
			const cut = smoothstep(0.8, 0.93, cn);
			let h = lerp(terr, 9 + (table - 60) * 0.1, cut);
			// the dune sea: one side of the world, long crests across the wind, buttes standing in it
			const dk = smoothstep(80, 420, x * dune.x + z * dune.z + (nz.fbm(x * 0.0017 - 3, z * 0.0017, 2) - 0.5) * 420);
			if (dk > 0) {
				const ph = (x * wind.x + z * wind.z) * 0.032 + nz.fbm(x * 0.004, z * 0.004 + 6, 2) * 7;
				const dunes = 7 + Math.pow(Math.sin(ph) * 0.5 + 0.5, 2) * 10 + (nz.fbm(x * 0.012, z * 0.012, 2) - 0.5) * 3;
				const butte = smoothstep(0.6, 0.66, nz.fbm(x * 0.006 + 40, z * 0.006, 2));
				h = lerp(h, Math.max(dunes, terr * butte), dk);
			}
			return toSea(h, rimK(x, z));
		};
		// landfall: where a canyon opens onto the dunes, mesa walls behind
		L.site = (H) => {
			let best = null;
			for (let z = -700; z <= 700; z += 24) for (let x = -700; x <= 700; x += 24) {
				const h = H(x, z);
				if (h < 6 || h > 20) continue;
				const dk = x * dune.x + z * dune.z;
				if (dk < 0 || dk > 420) continue;
				let wall = 0;
				for (let k = 0; k < 8; k++) wall = Math.max(wall, H(x + Math.cos(k * 0.785) * 160, z + Math.sin(k * 0.785) * 160));
				const sc = rough(H, x, z, 40) * 3 - Math.min(60, wall - h) * 0.15 + Math.hypot(x, z) * 0.004;
				if (!best || sc < best.sc) best = { sc, x, z };
			}
			best ||= { x: dune.x * 200, z: dune.z * 200 };
			return { x: best.x, z: best.z, face: { x: dune.x, z: dune.z } };
		};
	} else if (kind === 'fjord') {
		const vals = [mk(), mk()];
		vals[0].v0 = -240 + rand() * 80; vals[1].v0 = 200 + rand() * 80;
		const coastU = (v) => 360 + (nz.fbm(v * 0.002 + 9, 3.3, 3) - 0.5) * 200;
		L.height = (x, z) => {
			const u = along(x, z), v = across(x, z), inl = coastU(v) - u;
			let h = inl < 0 ? Math.max(-70, -4 + inl * 0.2) : 4 + Math.min(inl, 300) * 0.25 + Math.pow(nz.ridged(x * 0.0022 + 3, z * 0.0022, 4), 1.4) * 230 * smoothstep(-40, 380, inl);
			h += (nz.fbm(x * 0.0018 + 2, z * 0.0018 - 5, 3) - 0.5) * 40 * smoothstep(0, 200, inl);
			// the valleys: U-shaped, their floors drowned near the sea, ice further up
			for (const m of vals) {
				const W = 120, dv = Math.abs(v - meander(m, u)) / W;
				if (dv > 1.5) continue;
				const fl = -24 + (inl + 400) * 0.055, cr = Math.pow(1 - Math.abs(nz.fbm(x * 0.03, z * 0.03, 2) * 2 - 1), 14) * 3 * smoothstep(380, 460, inl);
				h = Math.min(h, fl + Math.pow(dv, 2.4) * Math.max(0, h - fl) - cr);
			}
			return toSea(h, rimK(x, z));
		};
		L.inland = false;
		// landfall: the strand at the head of the first fjord, looking down it to the sea
		L.site = (H) => {
			const m = vals[0];
			let at = null;
			for (let u = 600; u > -800; u -= 6) {
				const v = meander(m, u), x = d.x * u + s.x * v, z = d.z * u + s.z * v;
				if (H(x, z) > 1.2) { at = { u, x, z }; break; }
			}
			at ||= { u: 0, x: 0, z: 0 };
			const u2 = at.u + 30, v2 = meander(m, u2);
			const fx = d.x * u2 + s.x * v2 - at.x, fz = d.z * u2 + s.z * v2 - at.z, fl = Math.hypot(fx, fz) || 1;
			return { x: at.x, z: at.z, face: { x: fx / fl, z: fz / fl }, coastal: true };
		};
	} else if (kind === 'lavaplain') {
		const big = { x: d.x * 260 + (rand() - 0.5) * 200, z: d.z * 260 + (rand() - 0.5) * 200, r: 170 + rand() * 40, h: 70 + rand() * 20 };
		const cals = [big, ...scatter(5, 45, 110, 900, 1.6).filter((q) => bump(big, q.x, q.z) > 2).map((q) => ({ ...q, h: 14 + q.r * 0.2 }))];
		L.height = (x, z) => {
			let h = 7 + (nz.fbm(x * 0.002, z * 0.002, 3) - 0.5) * 14 + Math.pow(nz.ridged(x * 0.006 - 4, z * 0.006 + 2, 3), 3) * 5;
			for (const q of cals) {
				const t = bump(q, x, z);
				if (t > 3) continue;
				const c = t < 1 ? q.h * (0.18 + 0.82 * Math.pow(smoothstep(0.55, 1, t), 2)) : q.h * Math.exp(-Math.pow((t - 1) * 2.4, 1.2));
				h = Math.max(h, 6 + c + (nz.fbm(x * 0.03, z * 0.03, 2) - 0.5) * 2.5);
			}
			return toSea(h, rimK(x, z));
		};
		L.peak = { x: big.x, z: big.z, h: big.h + 6, r: big.r * 1.6, volcanic: true };
		L.craters = cals;
		// basalt columns: hexagons standing at their own heights, in patches on the plain
		L.post = (x, z, h) => {
			if (h < 3 || h > 30) return h;
			const p = smoothstep(0.58, 0.64, nz.fbm(x * 0.004 + 40, z * 0.004 - 7, 2));
			if (p <= 0) return h;
			const q = (2 / 3 * x) / 6, r = (-1 / 3 * x + Math.sqrt(3) / 3 * z) / 6;
			let rx = Math.round(q), rz = Math.round(r);
			const ry = Math.round(-q - r), dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
			if (dx > dz && dx > dy) rx = -ry - rz; else if (dz > dy) rz = -rx - ry;
			return h + p * (0.6 + Math.floor(hash2(rx, rz, 77) * 4) * 1.1);
		};
		L.site = (H) => {
			let best = null;
			for (let k = 0; k < 64; k++) {
				const a = k / 64 * TAU, dd = 380 + (k % 4) * 60, x = big.x + Math.cos(a) * dd, z = big.z + Math.sin(a) * dd;
				const h = H(x, z);
				if (h < 4 || h > 18 || Math.hypot(x, z) > half * 0.7) continue;
				const sc = rough(H, x, z, 50) + Math.hypot(x, z) * 0.004;
				if (!best || sc < best.sc) best = { sc, x, z };
			}
			best ||= { x: big.x - 400, z: big.z };
			const fx = big.x - best.x, fz = big.z - best.z, fl = Math.hypot(fx, fz) || 1;
			return { x: best.x, z: best.z, face: { x: fx / fl, z: fz / fl } };
		};
	} else if (kind === 'marsh') {
		const hills = scatter(5, 110, 210, 800, 1.3).map((q) => ({ ...q, h: 22 + q.r * 0.14 }));
		L.height = (x, z) => {
			let h = 5.5 + (nz.fbm(x * 0.0025, z * 0.0025, 3) - 0.5) * 6;
			h = lerp(h, -1.4, smoothstep(0.55, 0.62, nz.fbm(x * 0.008 + 30, z * 0.008, 3)));
			h -= Math.pow(1 - Math.abs(nz.fbm(x * 0.004 - 6, z * 0.004 + 3, 2) * 2 - 1), 10) * 8;
			// the fungal terraces: round hills of stacked shelves, each with a lip at its edge
			for (const q of hills) {
				const t = bump(q, x, z) + (nz.fbm(x * 0.01, z * 0.01, 2) - 0.5) * 0.25;
				if (t > 1.05) continue;
				const H0 = q.h * Math.pow(Math.max(0, 1 - t), 0.8), f = H0 / 6, fl = Math.floor(f), fr = f - fl;
				const terr = (fl + smoothstep(0.78, 1, fr)) * 6 + Math.exp(-Math.pow((fr - 0.1) / 0.07, 2)) * 0.9;
				h = Math.max(h, 5.5 + terr);
			}
			return toSea(h, rimK(x, z));
		};
		const top = hills.reduce((a, b) => b.h > a.h ? b : a, hills[0] || { x: 0, z: 0, r: 150, h: 30 });
		L.peak = { x: top.x, z: top.z, h: top.h + 6, r: top.r };
		L.site = (H) => {
			const q = hills.reduce((a, b) => Math.hypot(b.x, b.z) < Math.hypot(a.x, a.z) ? b : a, top);
			let best = null;
			for (let k = 0; k < 48; k++) {
				const a = k / 48 * TAU, x = q.x + Math.cos(a) * q.r * 0.86, z = q.z + Math.sin(a) * q.r * 0.86;
				const h = H(x, z);
				if (h < 6 || Math.hypot(x, z) > half * 0.7) continue;
				const sc = rough(H, x, z, 22) + Math.hypot(x, z) * 0.003;
				if (!best || sc < best.sc) best = { sc, x, z, a };
			}
			best ||= { x: q.x + q.r, z: q.z, a: 0 };
			return { x: best.x, z: best.z, face: { x: Math.cos(best.a), z: Math.sin(best.a) } };
		};
	} else if (kind === 'floating') {
		const pillars = scatter(12, 28, 70, 900, 2.2).map((q) => ({ ...q, h: 50 + rand() * 100 }));
		const fc = { x: d.x * 120, z: d.z * 120 };
		// terraces of rock hung in the air (planet/floaters.js draws them and makes them floors)
		L.floaters = [];
		for (let k = 0; k < 9; k++) {
			const a = ang + k * 0.75 + rand() * 0.4, dd = 90 + k * 34 + rand() * 30;
			L.floaters.push({ x: fc.x + Math.cos(a) * dd, z: fc.z + Math.sin(a) * dd, r: 16 + rand() * 26, y: 34 + k * 9 + rand() * 18, seed: (rand() * 1e9) >>> 0 });
		}
		L.height = (x, z) => {
			let h = 6 + (nz.fbm(x * 0.0022, z * 0.0022, 3) - 0.5) * 12;
			h -= smoothstep(0.58, 0.66, nz.fbm(x * 0.004 + 11, z * 0.004 - 8, 3)) * 10;
			for (const q of pillars) {
				const t = bump(q, x, z);
				if (t < 1.2) h = Math.max(h, q.h * (1 - smoothstep(0.82, 1.08, t)) + (nz.fbm(x * 0.05, z * 0.05, 2) - 0.5) * 2);
			}
			return toSea(h, rimK(x, z));
		};
		const tall = pillars.reduce((a, b) => b.h > a.h ? b : a, pillars[0] || { x: 400, z: 0, r: 40, h: 90 });
		L.peak = { x: tall.x, z: tall.z, h: tall.h, r: tall.r };
		L.site = (H) => {
			let best = null;
			for (let k = 0; k < 48; k++) {
				const a = k / 48 * TAU, dd = 200 + (k % 3) * 60, x = fc.x + Math.cos(a) * dd, z = fc.z + Math.sin(a) * dd;
				const h = H(x, z);
				if (h < 3 || h > 14 || L.floaters.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + 20)) continue;
				const sc = rough(H, x, z, 40);
				if (!best || sc < best.sc) best = { sc, x, z };
			}
			best ||= { x: fc.x + 220, z: fc.z };
			const fx = fc.x - best.x, fz = fc.z - best.z, fl = Math.hypot(fx, fz) || 1;
			return { x: best.x, z: best.z, face: { x: fx / fl, z: fz / fl } };
		};
	} else if (kind === 'clouddeck') {
		const plats = [{ x: (rand() - 0.5) * 120, z: (rand() - 0.5) * 120, r: 210 + rand() * 40 }, ...scatter(12, 60, 170, 950, 1.25)].map((q) => ({ ...q, h: 14 + rand() * 30 }));
		plats[0].h = 22;
		const spans = [];
		for (let i = 0; i < plats.length; i++) for (let j = i + 1; j < plats.length; j++) {
			const a = plats[i], b = plats[j], g = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
			if (g > 10 && g < 160 && spans.length < 7) spans.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, h: Math.min(a.h, b.h) - 3 });
		}
		L.height = (x, z) => {
			let h = -30 + (nz.fbm(x * 0.002, z * 0.002, 2) - 0.5) * 16;
			for (const q of plats) {
				const t = bump(q, x, z) + (nz.fbm(x * 0.006 + q.r, z * 0.006, 2) - 0.5) * 0.3;
				if (t < 1.15) h = Math.max(h, lerp(q.h + (nz.fbm(x * 0.01, z * 0.01, 3) - 0.5) * 5, -30, smoothstep(0.86, 1.12, t)));
			}
			for (const b of spans) {
				const bx = b.bx - b.ax, bz = b.bz - b.az, bl = bx * bx + bz * bz;
				const tt = clamp(((x - b.ax) * bx + (z - b.az) * bz) / bl, 0, 1), ds = Math.hypot(x - b.ax - bx * tt, z - b.az - bz * tt);
				if (ds < 16) h = Math.max(h, b.h - Math.pow(ds / 9, 2) * 6 - Math.sin(tt * Math.PI) * 2);
			}
			return h;
		};
		L.peak = { x: plats[0].x, z: plats[0].z, h: plats[0].h + 3, r: plats[0].r };
		L.site = () => {
			const q = plats[0], o = plats.slice(1).reduce((a, b) => Math.hypot(b.x - q.x, b.z - q.z) < Math.hypot(a.x - q.x, a.z - q.z) ? b : a, plats[1] || { x: q.x + 1, z: q.z });
			const fx = o.x - q.x, fz = o.z - q.z, fl = Math.hypot(fx, fz) || 1;
			return { x: q.x + fx / fl * q.r * 0.55, z: q.z + fz / fl * q.r * 0.55, face: { x: fx / fl, z: fz / fl } };
		};
	} else if (kind === 'plateau') {
		L.height = (x, z) => {
			const H0 = Math.max(6, 22 + (nz.fbm(x * 0.0012 + 3, z * 0.0012, 3) - 0.32) * 300);
			const f = H0 / 34, fl = Math.floor(f), fr = f - fl;
			let h = (fl + smoothstep(0.8, 0.97, fr)) * 34 + (nz.fbm(x * 0.006, z * 0.006 + 2, 2) - 0.5) * 6 + 4;
			h -= Math.pow(1 - Math.abs(nz.fbm(x * 0.0026 - 9, z * 0.0026 + 5, 3) * 2 - 1), 14) * Math.min(Math.max(0, h - 4), 46);
			return toSea(h, rimK(x, z));
		};
		// landfall: a broad pasture tread at an escarpment's edge, looking out over the drop
		L.site = (H) => {
			let best = null;
			for (let z = -650; z <= 650; z += 26) for (let x = -650; x <= 650; x += 26) {
				const h = H(x, z);
				if (h < 36) continue;
				let drop = 0, dir = 0;
				for (let k = 0; k < 8; k++) { const dd = h - H(x + Math.cos(k * 0.785) * 140, z + Math.sin(k * 0.785) * 140); if (dd > drop) { drop = dd; dir = k * 0.785; } }
				if (drop < 22) continue;
				const sc = rough(H, x, z, 40) * 3 - Math.min(drop, 70) * 0.05 + Math.hypot(x, z) * 0.004;
				if (!best || sc < best.sc) best = { sc, x, z, dir };
			}
			best ||= { x: 0, z: 0, dir: ang };
			return { x: best.x, z: best.z, face: { x: Math.cos(best.dir), z: Math.sin(best.dir) } };
		};
	} else if (kind === 'riverplain') {
		const hill = { x: d.x * (180 + rand() * 120), z: d.z * (180 + rand() * 120), r: 95 + rand() * 20, h: 48 + rand() * 14 };
		L.height = (x, z) => {
			const rr = Math.hypot(x, z);
			let h = 5 + (nz.fbm(x * 0.0018, z * 0.0018, 3) - 0.5) * 8;
			h += Math.max(0, nz.fbm(x * 0.003 + 4, z * 0.003, 3) - 0.4) * 110 * smoothstep(520, 950, rr);
			const t = bump(hill, x, z) + (nz.fbm(x * 0.012, z * 0.012, 2) - 0.5) * 0.18;
			if (t < 2.2) h = Math.max(h, 5 + hill.h * (1 - smoothstep(0.5, 1.0, t)) + hill.h * 0.22 * Math.exp(-t * 1.6) + (nz.fbm(x * 0.03, z * 0.03, 2) - 0.5) * 2);
			return toSea(h, rimK(x, z));
		};
		L.peak = { x: hill.x, z: hill.z, h: hill.h + 5, r: hill.r * 1.6 };
		L.site = (H) => {
			let best = null;
			for (let k = 0; k < 48; k++) {
				const a = k / 48 * TAU, x = hill.x + Math.cos(a) * 440, z = hill.z + Math.sin(a) * 440;
				if (Math.hypot(x, z) > half * 0.6) continue;
				const sc = rough(H, x, z, 50) + Math.abs(H(x, z) - 6) * 0.2;
				if (!best || sc < best.sc) best = { sc, x, z };
			}
			best ||= { x: hill.x - 440, z: hill.z };
			const fx = hill.x - best.x, fz = hill.z - best.z, fl = Math.hypot(fx, fz) || 1;
			return { x: best.x, z: best.z, face: { x: fx / fl, z: fz / fl } };
		};
	} else return null;
	return L;
}

// how uneven the ground is round a point
export function rough(H, x, z, r) {
	const c = H(x, z);
	let s = 0;
	for (let k = 0; k < 10; k++) s += Math.abs(H(x + Math.cos(k * 0.628) * r, z + Math.sin(k * 0.628) * r) - c);
	return s / 10;
}
