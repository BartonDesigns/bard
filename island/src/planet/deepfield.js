// The Deep: a cave that goes down for ever. One gallery winds down round a wandering axis,
// a turn every 70 m of depth, and every 130 m or so it opens into a landmark: a hall, an
// underground lake, a vast cathedral, a chasm with a bridge, ruins, an alcove of singing
// stones; every third holds a waystone. Nothing is stored: the rock at any point is a
// function of the world's seed and the depth, so it is made as you come to it and forgotten
// behind you. Depth D is in metres below the gate (positive down); here y = -D.
//
// The field is cavenet.js's: solid(x, y, z) > 0 in rock, < 0 in the air, so the same
// meshing (meshChunk) and the same walking (floor, push) serve it.

import { makeNoise3 } from './cavenet.js';
import { mulberry32, smoothstep } from '../noise.js';

// each band of depth: its stone, its light, its air, what grows in it
export const BANDS = [
	{ key: 'limestone', name: 'Damp limestone', from: 0, rock: [0.46, 0.43, 0.38], glow: [0.35, 0.85, 0.75], fog: [0.028, 0.032, 0.032], water: 0.9, crystals: 0, lava: 0, ice: 0, glowK: 0.7, prop: 'drip' },
	{ key: 'crystal', name: 'Crystal galleries', from: 250, rock: [0.27, 0.24, 0.33], glow: [0.72, 0.5, 1.0], fog: [0.03, 0.02, 0.05], water: 0.3, crystals: 1, lava: 0, ice: 0.2, glowK: 1.3, prop: 'crystal' },
	{ key: 'flooded', name: 'Flooded galleries', from: 600, rock: [0.21, 0.27, 0.31], glow: [0.3, 0.75, 1.0], fog: [0.012, 0.035, 0.045], water: 1, crystals: 0.2, lava: 0, ice: 0, glowK: 1, prop: 'drip' },
	{ key: 'fungal', name: 'Fungal glow', from: 1000, rock: [0.24, 0.19, 0.15], glow: [0.55, 1.0, 0.3], fog: [0.025, 0.045, 0.018], water: 0.5, crystals: 0, lava: 0, ice: 0, glowK: 2.6, prop: 'shroom' },
	{ key: 'basalt', name: 'Lava-lit basalt', from: 1500, rock: [0.1, 0.09, 0.09], glow: [1.0, 0.45, 0.15], fog: [0.06, 0.022, 0.01], water: 0, crystals: 0, lava: 1, ice: 0, glowK: 0.8, prop: 'ember' },
	{ key: 'geometric', name: 'The strange deep', from: 2200, rock: [0.13, 0.14, 0.19], glow: [0.9, 0.3, 1.0], fog: [0.02, 0.012, 0.04], water: 0.2, crystals: 0.5, lava: 0, ice: 0, glowK: 2, prop: 'shard', geo: true },
];
export function bandIndex(D) {
	let i = 0;
	while (i + 1 < BANDS.length && D >= BANDS[i + 1].from) i++;
	return i;
}
// below the last band the strange deep keeps changing its light, a new hue every 800 m
export function hueShift(D) { return D < 2200 ? 0 : Math.floor((D - 2200) / 800) * 0.17; }

export const LM = 130;          // metres of depth between landmarks
const DROP = 11;                // metres of depth per radian of the winding: 69 m a turn
const TURN = DROP * Math.PI * 2;

export function makeDeepField(seed, { cx = 0, cz = 0, isPhone = false, shaft = 40 } = {}) {
	const n3 = makeNoise3((seed ^ 0xdee95eed) >>> 0);
	const n1 = (t, o) => n3(t, o, 0.37);
	// the gallery: its axis wanders, its radius breathes, its bore widens and narrows
	const centre = (D) => [cx + 90 * n1(D / 520, 3.1), cz + 90 * n1(D / 520 + 40, 9.7)];
	const radius = (D) => 40 + 14 * n1(D / 170, 5.3);
	const halfW = (D) => 3.7 + 1.3 * n1(D / 60, 7.7);
	const tall = (D) => 6.2 + 2 * n1(D / 80, 1.9);
	function path(D, out = {}) {
		const [x0, z0] = centre(D), R = radius(D), a = D / DROP;
		out.x = x0 + Math.cos(a) * R; out.z = z0 + Math.sin(a) * R; out.y = -D;
		return out;
	}
	// the way the gallery runs at a depth (level, unit)
	function tangent(D) {
		const a = path(D - 1), b = path(D + 1), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
		return [dx / l, dz / l];
	}

	// ---------- landmarks ----------
	const marks = new Map();
	function landmark(L) {
		if (L < 0) return null;
		let m = marks.get(L);
		if (m) return m;
		const r = mulberry32(((seed >>> 0) ^ Math.imul(L + 7, 0x9e3779b1)) >>> 0);
		const D = L * LM + 45 + r() * 40, bi = bandIndex(D), band = BANDS[bi];
		let kind;
		if (L % 4 === 1) kind = 'alcove';
		else if (L % 7 === 3) kind = 'cathedral';
		else {
			const k = r(), wet = band.key === 'flooded' ? 0.45 : 0.2;
			kind = k < wet ? 'lake' : k < wet + 0.25 ? 'chasm' : k < wet + 0.5 ? 'ruins' : 'hall';
		}
		const p = path(D), [tx, tz] = tangent(D);
		const size = { hall: [15, 15, 11], lake: [20, 17, 12], cathedral: [30, 26, 40], chasm: [9, 9, 9], ruins: [17, 15, 13], alcove: [8, 7, 6] }[kind];
		m = { L, D, kind, band: bi, x: p.x, y: p.y, z: p.z, tx, tz, nx: -tz, nz: tx, rx: size[0] * (0.9 + r() * 0.2), rz: size[1] * (0.9 + r() * 0.2), h: size[2], way: L % 3 === 2, seed: (r() * 1e9) >>> 0, cols: [] };
		// the alcove opens off the outer side of the way
		if (kind === 'alcove') { m.ox = m.x + m.nx * 6; m.oz = m.z + m.nz * 6; } else { m.ox = m.x; m.oz = m.z; }
		if (kind === 'cathedral') for (const [a, b] of [[-14, -11], [-14, 11], [0, -14], [0, 14], [14, -11], [14, 11]]) m.cols.push({ x: m.x + m.tx * a + m.nx * b, z: m.z + m.tz * a + m.nz * b, r: 2.2 + r() * 0.8 });
		if (kind === 'lake') m.lake = { x: m.x + m.nx * 7, z: m.z + m.nz * 7, r: 9 + r() * 3 };
		marks.set(L, m);
		if (marks.size > 64) marks.delete(marks.keys().next().value);
		return m;
	}

	// ---------- the field ----------
	const out = { kind: 0 };
	const fine = !isPhone;
	// the floor of the gallery at (x, z), on the turn nearest below y
	function floorTurn(x, y, z) {
		const D = -y, [x0, z0] = centre(D);
		const phi = Math.atan2(z - z0, x - x0);
		const k0 = Math.round((D / DROP - phi) / (Math.PI * 2));
		let best = null;
		for (let k = k0 - 1; k <= k0 + 1; k++) {
			const Dk = DROP * (phi + Math.PI * 2 * k);
			if (Dk < -2) continue;
			const v = y + Dk;
			if (v < -2.5) continue;
			if (!best || v < best.v) best = { D: Dk, v };
		}
		return best;
	}
	function solid(x, y, z) {
		out.kind = 0;
		const D = -y;
		if (D < -shaft - 18) return 30;
		const geoK = smoothstep(2150, 2350, D);
		let d = 1e9;
		// the gallery: the turns above and below this point
		{
			const [x0, z0] = centre(D);
			const phi = Math.atan2(z - z0, x - x0), rq = Math.hypot(x - x0, z - z0);
			const k0 = Math.round((D / DROP - phi) / (Math.PI * 2));
			for (let k = k0 - 1; k <= k0 + 1; k++) {
				const Dk = DROP * (phi + Math.PI * 2 * k);
				if (Dk < -1) continue;
				const v = y + Dk;
				if (v < -12 || v > 22) continue;
				const R = radius(Dk), w = halfW(Dk), h = tall(Dk);
				const a = (rq - R) / w, b = (v - h * 0.4) / (h * 0.6);
				const round = Math.sqrt(a * a + b * b), box = Math.max(Math.abs(a), Math.abs(b));
				const e = ((geoK > 0 ? round + (box - round) * geoK : round) - 1) * Math.min(w, h * 0.6);
				d = Math.min(d, Math.max(e, -v));
			}
		}
		// the landmarks round this depth
		const L0 = Math.floor((D - 45) / LM);
		for (let L = L0 - 1; L <= L0 + 1; L++) {
			const m = landmark(L);
			if (!m) continue;
			const dx = x - m.ox, dz = z - m.oz;
			if (Math.abs(dx) > m.rx + 40 || Math.abs(dz) > m.rx + 40 || y < m.y - 45 || y > m.y + m.h + 12) continue;
			const al = dx * m.tx + dz * m.tz, ac = dx * m.nx + dz * m.nz;
			if (m.kind === 'chasm') {
				// a slot across the way, falling far below it; the bridge carries the way over
				const e = Math.max(Math.abs(al) - 4.5, Math.abs(ac) - 26, (m.y - 34) - y, y - (m.y + 11));
				d = Math.min(d, e);
				continue;
			}
			const t = floorTurn(x, y, z);
			let fy = t && Math.abs(t.D - m.D) < 30 ? -t.D : m.y;
			// a lake's bed sinks below the way
			if (m.lake) { const ld = Math.hypot(x - m.lake.x, z - m.lake.z); fy -= 1.6 * (1 - smoothstep(m.lake.r * 0.55, m.lake.r * 1.05, ld)); }
			const v = y - fy;
			const ea = al / m.rx, eb = ac / m.rz, ec = (v - m.h * 0.3) / (m.h * 0.75);
			let e = (Math.sqrt(ea * ea + eb * eb + ec * ec) - 1) * Math.min(m.rx, m.rz, m.h * 0.75);
			e = Math.max(e, -v);
			// a cathedral's columns stand from the floor to the vault
			for (const c of m.cols) e = Math.max(e, -(Math.hypot(x - c.x, z - c.z) - c.r));
			d = Math.min(d, e);
		}
		// the landing under the gate: a round chamber, and the shaft up to the gate's floor
		if (D < 40) {
			const p = path(0), dx = x - p.x, dz = z - p.z, v = y;
			const e = Math.max((Math.sqrt((dx / 11) ** 2 + (dz / 11) ** 2 + ((v - 3) / 7) ** 2) - 1) * 7, -v);
			const shaftE = Math.max(Math.hypot(dx, dz) - 3, -v - 0.5, v - shaft - 14);
			d = Math.min(d, e, shaftE);
		}
		if (d > 9) return d;
		// the rock's roughness: little on the floors, so they stay walkable
		const t = floorTurn(x, y, z);
		const up = t ? smoothstep(0.3, 1.8, t.v) : 1;
		let n = n3(x * 0.16, y * 0.16, z * 0.16) * 0.9 * (0.18 + 0.82 * up);
		if (fine) n += n3(x * 0.47 + 7, y * 0.47, z * 0.47) * 0.32 * up;
		// the strange deep: the walls go to steps and facets
		if (geoK > 0) n = n * (1 - geoK) + geoK * Math.round(n3(x * 0.07, y * 0.07, z * 0.07) * 3) * 0.6 * up;
		return d + n;
	}
	// the floor under a point in the air, marching down (cf. underworld.js rockFloor)
	function floor(x, z, y) {
		let y0 = y, f = solid(x, y0, z);
		if (f >= 0) {
			let k = 0;
			while (f >= 0 && k++ < 5) { y0 += 0.4; f = solid(x, y0, z); }
			if (f >= 0) return null;
		}
		let yA = y0, fA = f;
		for (let i = 0; i < 120; i++) {
			const yB = yA - Math.min(1.5, Math.max(0.08, -fA * 0.7)), fB = solid(x, yB, z);
			if (fB >= 0) {
				let lo = yB, hi = yA;
				for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; if (solid(x, mid, z) >= 0) lo = mid; else hi = mid; }
				return (lo + hi) / 2;
			}
			yA = yB; fA = fB;
			if (y0 - yA > 60) return null;
		}
		return null;
	}
	function roof(x, z, y, max = 40) {
		let yA = y, fA = solid(x, yA, z);
		if (fA >= 0) return null;
		for (let i = 0; i < 100; i++) {
			const yB = yA + Math.min(1.5, Math.max(0.08, -fA * 0.7)), fB = solid(x, yB, z);
			if (fB >= 0) return yB;
			yA = yB; fA = fB;
			if (yA - y > max) return null;
		}
		return null;
	}
	return { solid, cave: solid, out, inHole: () => false, floor, roof, path, tangent, landmark, centre, radius, halfW, tall, TURN };
}
