// Potholes: where the asphalt has broken through to the base, in the wheel paths, more of
// them the older and more let go the street (streetera.js). Laid out per street from its
// own dice, so the same street has the same holes every visit; painted into the road map's
// paint layer (realcity.js) as a round dip the ground shader reads for its depth, broken
// edge and standing water (weathering.js potholeAge), and felt: a wheel dropping into one
// knocks the car (its body, through the physics, and the driver's eye) with a ka-thunk.
// A hole reported (the pothole favour, people/errands.js) gets a crew (roadcrew.js), and
// once filled it is a square of fresh black patch from then on (kept in this browser).
//
// The paint layer's channels, besides realcity's own (R yellow lines, G lane wear, patches,
// covers and the freeways' concrete): B a pothole's depth (0.5 on its rim, rising inward)
// or a fresh patch (0.3, under the rim's cut), A the street's era and bearing, for the
// sidewalk, kerb and asphalt (code + 1 over 255; code = era * 48 + bearing in 3.75 degrees).

import { soundBus } from '../world/soundbus.js';
import { holeRate, ERA_INDEX } from './streetera.js';
import { BLOCKS, toGrid } from './styles.js';

const STORE = 'crysis-potholes-v1';
export const HOLE = [0, 0, 1, 0], FRESH = [0, 0.2, 0.3, 0];
// the lanes' centres across a street (as realcity's wear() has them)
export function lanesOf(r) {
	const hw = r.w / 2, out = [];
	if (r.w < 6.5) out.push(0);
	else if (r.divided || r.link) { const n = Math.max(1, Math.round(r.w / 3.6)), lw = r.w / n; for (let k = 0; k < n; k++) out.push(-hw + lw * (k + 0.5)); }
	else for (let k = 0, n = Math.max(1, Math.floor(r.w / 7.2)); k < n; k++) out.push(1.8 + 3.6 * k, -1.8 - 3.6 * k);
	return out;
}
// a street's own dice for its holes (not the patches' dice: those stay as they were)
function dice(r) {
	let h = (Math.imul(Math.round(r.pts[0] * 4), 2654435761) ^ Math.imul(Math.round(r.pts[1] * 4), 40503) ^ 0x5bd1e995) >>> 0;
	return () => { h = (Math.imul(h ^ (h >>> 15), 2246822519) + 0x6d2b79f5) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
}
export const holeId = (x, z) => Math.round(x * 2) + ':' + Math.round(z * 2);
// the potholes of one street: [{ id, x, z, r (m), d (depth m), tx, tz (its way along), o
// (across from the centre line) }], from its era and how let go it is (era: { key, neglect })
export function holesFor(r, era) {
	if (!r.drive || r.bridge || r.cls === 'motorway' || r.hand) return [];
	const p = r.pts, rnd = dice(r), lanes = lanesOf(r), hw = r.w / 2, out = [];
	let L = 0;
	const cum = [0];
	for (let i = 0; i + 3 < p.length; i += 2) { L += Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); cum.push(L); }
	const n = Math.floor(holeRate(era.key, r.cls, era.neglect) * L * lanes.length / 100 + rnd());
	for (let k = 0; k < n; k++) {
		const s = rnd() * L;
		let i = 0;
		while (i + 2 < cum.length && cum[i + 1] < s) i++;
		const ax = p[i * 2], az = p[i * 2 + 1], sl = cum[i + 1] - cum[i] || 1, tx = (p[i * 2 + 2] - ax) / sl, tz = (p[i * 2 + 3] - az) / sl;
		// in a wheel path, a little either way
		const o = lanes[Math.floor(rnd() * lanes.length)] + (rnd() < 0.5 ? -0.85 : 0.85) + (rnd() - 0.5) * 0.5;
		if (Math.abs(o) > hw - 0.45) { rnd(); rnd(); continue; }
		const along = s - cum[i], x = ax + tx * along - tz * o, z = az + tz * along + tx * o;
		const rad = 0.22 + rnd() * 0.3, d = 0.04 + rnd() * 0.06;
		out.push({ id: holeId(x, z), x, z, r: rad, d, tx, tz, o });
		// they come in twos and threes where the base has gone
		if (rnd() < 0.3) { const a = rnd() * 6.283, q = 0.6 + rnd() * 0.8, x2 = x + Math.cos(a) * q, z2 = z + Math.sin(a) * q; out.push({ id: holeId(x2, z2), x: x2, z: z2, r: rad * (0.5 + rnd() * 0.4), d: d * 0.8, tx, tz, o }); }
	}
	return out;
}
// the era code painted in the paint layer's alpha: era and bearing (mod a half turn)
export function eraCode(idx, ux, uz) {
	let a = Math.atan2(uz, ux);
	if (a < 0) a += Math.PI;
	return idx * 48 + (Math.round(a / Math.PI * 48) % 48);
}

// what is filled, and what is reported and when (Date.now()), kept in this browser
function load() {
	try { const o = JSON.parse(localStorage.getItem(STORE) || '{}'); return { fixed: new Set(o.fixed || []), reported: new Map(o.reported || []) }; } catch { return { fixed: new Set(), reported: new Map() }; }
}
const S = load();
const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ fixed: [...S.fixed].slice(-600), reported: [...S.reported].slice(-60) })); } catch { /* private mode */ } };
export const isFixed = (id) => S.fixed.has(id);

// Paints one street's era, holes and patched holes into the paint layer (realcity.js
// drawRoadMap, the fine map only). p: its points in the map's space; Y: the paint builder;
// R0: the map's ramp; era: { idx, key, neglect }; walked: it has sidewalks
export function paintStreet(r, p, Y, R0, era, walked, x0, z0) {
	const hw = r.w / 2;
	if (walked && era) {
		const band = hw + 1.8 + R0 + 0.1;
		for (let i = 0; i + 1 < p.length; i++) {
			const [ax, ay] = p[i], [bx, by] = p[i + 1], L = Math.hypot(bx - ax, by - ay);
			if (L < 0.01) continue;
			const col = [0, 0, 0, (eraCode(era.idx, (bx - ax) / L, (by - ay) / L) + 1) / 255];
			Y.line([p[i], p[i + 1]], band, col, false);
			if (i === 0) Y.disc(ax, ay, band, col);
			Y.disc(bx, by, band, col);
		}
	}
	if (!r.drive || r.bridge || r.cls === 'motorway' || !era) return;
	for (const h of holesOf(r, era)) {
		const hx = h.x - x0, hz = h.z - z0;
		if (S.fixed.has(h.id)) {
			// cut square and filled: a black patch a little bigger than the hole, along the street
			const q = h.r + 0.3;
			Y.line([[hx - h.tx * q, hz - h.tz * q], [hx + h.tx * q, hz + h.tz * q]], q, FRESH, false);
		} else Y.disc(hx, hz, h.r, HOLE);
	}
}
// a street's holes, worked out once
export function holesOf(r, era) {
	if (!r.holes || r.holesEra !== era) { r.holes = holesFor(r, era); r.holesEra = era; }
	return r.holes;
}

// ---------- the procedural grid's holes ----------
// The gridded towns' streets are not in the road map: the ground shader (terrain.js, "potholes
// in the wheel paths") throws its holes from a hash of the grid cell, one chance in each 5 m of
// lane. The same sums here, the hash in single precision as the GPU has it, so a wheel finds the
// hole that is drawn (the hash matched the shader's bit for bit over 65536 cells in headless
// Chromium; the grid's own coordinates, worked out in double here, may put a hole at a block's
// very edge a hair to one side).
const f32 = Math.fround, fract = (v) => v - Math.floor(v);
export function h21(x, y) {
	x = f32(x - 4096 * Math.floor(x / 4096)); y = f32(y - 4096 * Math.floor(y / 4096));
	let a = f32(fract(f32(x * f32(0.1031)))), b = f32(fract(f32(y * f32(0.1031)))), c = a;
	const d = f32(f32(f32(a * f32(b + f32(33.33))) + f32(b * f32(c + f32(33.33)))) + f32(c * f32(a + f32(33.33))));
	a = f32(a + d); b = f32(b + d); c = f32(c + d);
	return f32(fract(f32(f32(a + b) * c)));
}
export function vn(x, y) {
	const i = Math.floor(x), j = Math.floor(y);
	let u = x - i, v = y - j;
	u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
	const a = h21(i, j), b = h21(i + 1, j), c = h21(i, j + 1), d = h21(i + 1, j + 1);
	return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
// the grid's hole under a point (within pad m of its edge), or null. a, sty: the town map's
// grid bearing and style there (terrain.js urbanAt). { id, r, d, gap: how far in (m, < 0 inside) }
export function gridHoleAt(x, z, a, sty, pad = 0) {
	const [BX, BZ, ST] = BLOCKS[sty] || BLOCKS[3];
	const [gx, gz] = toGrid(x, z, a, sty);
	const cx = Math.floor(gx / BX), cz = Math.floor(gz / BZ), fx = gx - cx * BX, fz = gz - cz * BZ;
	if (fx > ST && fz > ST) return null;
	const xs = fx <= ST, ax = xs ? fx : fz, al = xs ? gz : gx, cd = Math.abs(ax - ST * 0.5);
	const fl = Math.floor(al / 5), far = cd >= 1.8 ? 1 : 0;
	const hx = f32(fl + f32(cx * f32(5.3))), hy = f32((ax >= ST * 0.5 ? 2 : 0) + far + f32(cz * f32(5.3)));
	const hk = (sty < 2.5 ? 0.13 : 0.05) * (0.5 + vn(x * 0.002 + 7, z * 0.002 + 7));
	if (h21(hx, hy) <= 1 - hk) return null;
	// (the offsets added in single precision too: the hash magnifies the last bit)
	const at = (k) => h21(f32(hx + f32(k)), f32(hy + f32(k)));
	const ca = (fl + 0.25 + 0.5 * at(1.7)) * 5, cc = (far ? 2.65 : 0.95) + (at(4.1) - 0.5) * 0.2;
	const r = 0.2 + 0.25 * at(2.3), gap = Math.hypot(al - ca, cd - cc) - r;
	if (gap > pad) return null;
	return { id: `g${cx}:${cz}:${xs ? 1 : 0}:${fl}:${hy}`, r, d: 0.04 + (r - 0.2) * 0.14, gap };
}

// ---------- the runtime: what you drive over, and the reports ----------
// grid(x, z): the procedural grid's bearing and style where its streets are drawn ({ a, s }),
// null where they are not (out of the towns, or inside a mapped region)
export function createPotholes({ real, eraOf, carAt, physics, camera, repaint, grid = null }) {
	const NEAR = 64, hx = new Float32Array(NEAR * 4), ids = new Array(NEAR);
	const inHole = new Array(4).fill(null);
	let n = 0, atX = 1e9, atZ = 1e9, atT = 0, clock = 0, lastX = 0, lastZ = 0, jolt = 0, joltV = 0, prevOk = false;
	const nearList = [];
	let hits = 0, gridHits = 0;
	// the holes within reach of you, refreshed as you go (nearest first)
	function gather(x, z) {
		atX = x; atZ = z; atT = clock; n = 0; nearList.length = 0;
		for (const r of real.near('roads', x, z, 70)) {
			if (!r.drive || r.bridge) continue;
			for (const h of holesOf(r, eraOf(r))) {
				if (S.fixed.has(h.id) || Math.abs(h.x - x) > 70 || Math.abs(h.z - z) > 70) continue;
				nearList.push(h);
			}
		}
		nearList.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
		for (const h of nearList) { if (n >= NEAR) break; hx[n * 4] = h.x; hx[n * 4 + 1] = h.z; hx[n * 4 + 2] = h.r; hx[n * 4 + 3] = h.d; ids[n] = h.id; n++; }
	}
	// the knock: a low thump and the rattle of the car's body over it
	let buf = null, bufCtx = null;
	function knock(gain) {
		const B = soundBus();
		if (!B) return;
		if (!buf || bufCtx !== B.ctx) {
			const sr = B.ctx.sampleRate, len = Math.floor(sr * 0.28);
			buf = B.ctx.createBuffer(1, len, sr); bufCtx = B.ctx;
			const d = buf.getChannelData(0);
			let ph = 0, lp = 0;
			for (let i = 0; i < len; i++) {
				const t = i / sr, f = 55 + 60 * Math.exp(-t * 40);
				ph += 2 * Math.PI * f / sr; lp += (Math.random() * 2 - 1 - lp) * 0.25;
				d[i] = Math.sin(ph) * Math.exp(-t * 18) + lp * Math.exp(-t * 35) * 0.9 + (t > 0.07 ? lp * Math.exp(-(t - 0.07) * 50) * 0.6 : 0);
			}
		}
		const src = B.ctx.createBufferSource(), g = B.ctx.createGain();
		src.buffer = buf; g.gain.value = gain;
		src.connect(g).connect(B.out);
		src.start();
	}
	// the wheels: front pair and rear pair, from the car's heading
	const WX = [0.78, -0.78, 0.78, -0.78], WZ = [1.35, 1.35, -1.35, -1.35];
	function update(dt) {
		clock += dt;
		// the eye settles back after a knock (a stiff spring)
		joltV += (-jolt * 260 - joltV * 18) * dt; jolt += joltV * dt;
		const car = carAt?.();
		if (!car || car.speed < 1.5) { prevOk = false; if (Math.abs(jolt) > 1e-4) camera.position.y += jolt; return; }
		if (Math.hypot(car.x - atX, car.z - atZ) > 25 || clock - atT > 3) gather(car.x, car.z);
		// heading: the physics body's, or the way it has been going
		const C = physics?.();
		let fx, fz;
		if (C) { const q = C.body.rotation(), yaw = 2 * Math.atan2(q.y, q.w); fx = Math.sin(yaw); fz = Math.cos(yaw); }
		else { const dx = car.x - lastX, dz = car.z - lastZ, l = Math.hypot(dx, dz); if (!prevOk || l < 1e-4) { lastX = car.x; lastZ = car.z; prevOk = true; return; } fx = dx / l; fz = dz / l; }
		lastX = car.x; lastZ = car.z; prevOk = true;
		const W = C?.spec?.W ? C.spec.W / 2 - 0.15 : 0.78, B2 = C?.spec?.wz ?? 1.35, G = !!grid?.(car.x, car.z);
		for (let w = 0; w < 4; w++) {
			const lx = Math.sign(WX[w]) * W, lz = Math.sign(WZ[w]) * B2;
			const px = car.x + fz * lx + fx * lz, pz = car.z - fx * lx + fz * lz;
			let hit = null, depth = 0;
			for (let k = 0; k < n; k++) { const dx = hx[k * 4] - px, dz = hx[k * 4 + 1] - pz, rr = hx[k * 4 + 2] + 0.12; if (dx * dx + dz * dz < rr * rr) { hit = ids[k]; depth = hx[k * 4 + 3]; break; } }
			// (the gridded towns' holes, from the same sums as the ground shader's)
			if (hit === null && G) { const U = grid(px, pz), h = U && gridHoleAt(px, pz, U.a, U.s, 0.12); if (h) { hit = h.id; depth = h.d; } }
			if (hit !== null && inHole[w] !== hit) {
				const k = Math.min(1.2, car.speed / 14) * (depth / 0.07);
				knock(0.25 + 0.45 * Math.min(1, k));
				joltV -= 1.6 * k;
				if (C) {
					// the corner drops into it and is thrown back up (the springs do the rest)
					const m = C.feel?.mass || 1400, t = C.body.translation();
					C.body.applyImpulseAtPoint({ x: 0, y: -m * 0.55 * k, z: 0 }, { x: t.x + fz * lx + fx * lz, y: t.y, z: t.z - fx * lx + fz * lz }, true);
				}
				hits++;
				if (hit[0] === 'g') gridHits++;
			}
			inHole[w] = hit;
		}
		if (Math.abs(jolt) > 1e-4) camera.position.y += jolt;
	}
	// ---------- the favour's side: the nearest hole to report, a report, a fill ----------
	function nearest(x, z, R = 120) {
		let best = null, bd = R;
		for (const r of real.near('roads', x, z, R)) {
			if (!r.drive || r.bridge) continue;
			for (const h of holesOf(r, eraOf(r))) {
				if (S.fixed.has(h.id) || S.reported.has(h.id)) continue;
				const d = Math.hypot(h.x - x, h.z - z);
				if (d < bd) { bd = d; best = { ...h, street: r.name || '' }; }
			}
		}
		return best;
	}
	function report(h) { if (!h || S.reported.has(h.id)) return false; S.reported.set(h.id, Date.now()); save(); return true; }
	function fix(id) {
		if (S.fixed.has(id)) return false;
		S.fixed.add(id); S.reported.delete(id); save();
		atT = -1e9;            // (gathered again: it is gone)
		repaint?.();
		return true;
	}
	const reported = () => [...S.reported];
	function info() { return { near: n, hits, gridHits, fixed: S.fixed.size, reported: S.reported.size, first: n ? { id: ids[0], x: +hx[0].toFixed(1), z: +hx[1].toFixed(1), r: +hx[2].toFixed(2) } : null }; }
	// for the console and tests: the holes round a point
	function around(x, z, R = 60) {
		const out = [];
		for (const r of real.near('roads', x, z, R)) if (r.drive && !r.bridge) for (const h of holesOf(r, eraOf(r))) if (Math.hypot(h.x - x, h.z - z) < R) out.push({ id: h.id, x: +h.x.toFixed(1), z: +h.z.toFixed(1), r: +h.r.toFixed(2), fixed: S.fixed.has(h.id), street: r.name || r.cls });
		return out;
	}
	return { update, nearest, report, fix, reported, isFixed, info, around, eraIndex: ERA_INDEX };
}
