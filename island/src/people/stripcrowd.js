// The Strip's crowds: Las Vegas Boulevard's pavements thronged into the small hours, as far down
// it as you can see. Walkers by the hundred (crowd.js: real bodies baked and instanced, dressed
// for a night out), up and down both broad pavements between the kerb and the casinos' fronts
// (crysis/civgen.js's 'strip' boulevard, its roads marked strip). They keep to the stretch round
// you: one gone far behind comes back far ahead, too far off to be seen arriving. Near you the
// real people take over (people.js); at any hour only the hour's share are out (flow.js).

import { createCrowd } from './crowd.js';
import { crowd, ZONE } from './flow.js';

const NEAR = 55;            // within this the real people walk instead (people.js NEAR is 70)
const BACK = 250;           // a walker comes back no nearer than this
const HIDE = 3500;          // further than this from the boulevard, none are kept up

// ground(x, z): the ground's height; phone: fewer of them
export function createStripCrowd({ scene, ground, phone = false }) {
	const N = phone ? 160 : 300, WIN = phone ? 520 : 650;
	let C = null, region = null, walks = [], F = [], seed = 1, reach = [], reachAt = [1e9, 1e9], reachLen = 0, last = [1e9, 1e9], shown = 0;
	const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

	// each piece of the boulevard: its points and how far along each one is
	function lay(R) {
		walks = (R.roads || []).filter((r) => r.strip && r.pts.length >= 4).map((r) => {
			const p = r.pts, cum = [0];
			for (let i = 2; i < p.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
			return { p, cum, L: cum[cum.length - 1], hw: r.w / 2 };
		}).filter((w) => w.L > 20);
		if (!walks.length) return;
		seed = (Math.round(Math.abs(R.strip?.[0]?.x || 0)) * 31 + 7) >>> 0 || 1;
		C = createCrowd(N, { kind: 'walk', place: 'boardwalk', seed: 77, cold: 0.25, far: true, kids: 0.06, night: true });
		scene.add(C.group);
		for (let i = 0; i < N; i++) C.place(i, 0, -1e4, 0, 0, 0);
		F = [];
		for (let i = 0; i < N; i++) {
			// (most out past the palms toward the casinos, some along the kerb)
			F.push({ w: null, s: 0, side: rand() < 0.5 ? 1 : -1, band: rand() < 0.35 ? rand() * 2 : 5 + rand() * 6, dir: rand() < 0.5 ? 1 : -1, sp: 0.85 + rand() * 0.6, sc: 0.93 + rand() * 0.14, x: 0, z: 0, y: 0, ys: -1e9, out: true });
		}
	}
	function drop() {
		C?.dispose();
		C = null; walks = []; F = [];
	}
	// where along a piece: the point at s, offset across it
	function at(f) {
		const w = f.w, p = w.p, cum = w.cum;
		let lo = 0, hi = cum.length - 1;
		while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= f.s) lo = m; else hi = m; }
		const ax = p[lo * 2], az = p[lo * 2 + 1], bx = p[hi * 2], bz = p[hi * 2 + 1], L = cum[hi] - cum[lo] || 1;
		const t = Math.max(0, Math.min(1, (f.s - cum[lo]) / L)), dx = (bx - ax) / L, dz = (bz - az) / L, off = (w.hw + 0.9 + f.band) * f.side;
		f.x = ax + (bx - ax) * t - dz * off; f.z = az + (bz - az) * t + dx * off;
		f.yaw = Math.atan2(dx * f.dir, dz * f.dir);
	}
	// the stretch of each piece within WIN of (cx, cz), worked out again as you go 40 m
	function within(cx, cz) {
		if (Math.hypot(cx - reachAt[0], cz - reachAt[1]) < 40) return;
		reachAt = [cx, cz]; reach = []; reachLen = 0;
		for (const w of walks) {
			const p = w.p;
			let best = 0, bd = Infinity;
			for (let i = 1; i < w.cum.length; i++) {
				const ax = p[i * 2 - 2], az = p[i * 2 - 1], dx = p[i * 2] - ax, dz = p[i * 2 + 1] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / l2)), d = Math.hypot(ax + dx * t - cx, az + dz * t - cz);
				if (d < bd) { bd = d; best = w.cum[i - 1] + t * (w.cum[i] - w.cum[i - 1]); }
			}
			if (bd >= WIN) continue;
			const half = Math.sqrt(WIN * WIN - bd * bd), s0 = Math.max(0, best - half), s1 = Math.min(w.L, best + half);
			if (s1 - s0 > 4) { reach.push({ w, s0, s1 }); reachLen += s1 - s0; }
		}
	}
	// somewhere on the stretch round (cx, cz), at least min off: a few tries, else left out a while
	function put(f, cx, cz, min) {
		within(cx, cz);
		if (!reach.length) { f.out = true; return false; }
		for (let k = 0; k < 6; k++) {
			let u = rand() * reachLen, q = reach[0];
			for (const o of reach) { if ((u -= o.s1 - o.s0) <= 0) { q = o; break; } }
			const w = q.w;
			f.w = w; f.s = q.s0 + rand() * (q.s1 - q.s0);
			at(f);
			const d = Math.hypot(f.x - cx, f.z - cz);
			if (d >= min && d < WIN) { f.out = false; f.ys = -1e9; return true; }
		}
		f.out = true;
		return false;
	}

	function update(dt, t, cam, R, hours) {
		if (R !== region) { drop(); region = R; reachAt = [1e9, 1e9]; if (R?.strip?.length) lay(R); }
		if (!C) return;
		const cx = cam.position.x, cz = cam.position.z;
		// (off away from the Strip: kept, not drawn)
		const S = region.strip, far = !S.some((q) => Math.hypot(q.x - cx, q.z - cz) < HIDE + Math.max(q.hw, q.hd));
		C.group.visible = !far;
		if (far) return;
		C.update(t);
		if (!C.ready()) return;
		const on = Math.round(N * crowd(ZONE.strip, hours).k);
		// (come here all at once, a teleport or a landing: the crowd round you at once, not out at the edge)
		const jump = Math.hypot(cx - last[0], cz - last[1]) > 200, back = jump ? NEAR : BACK;
		last = [cx, cz]; shown = 0;
		for (let i = 0; i < N; i++) {
			const f = F[i];
			if (i >= on) { if (!f.hid) { C.place(i, 0, -1e4, 0, 0, 0); f.hid = true; f.out = true; } continue; }
			if (jump) f.out = true;
			if (f.out && !put(f, cx, cz, f.hid === undefined ? NEAR : back)) continue;
			f.hid = false;
			f.s += f.dir * f.sp * dt;
			// (at a piece's end, back the other way)
			if (f.s < 0 || f.s > f.w.L) { f.dir = -f.dir; f.s = Math.max(0, Math.min(f.w.L, f.s)); }
			at(f);
			const d = Math.hypot(f.x - cx, f.z - cz);
			// gone far behind: back far ahead (or anywhere far enough off)
			if (d > WIN && !put(f, cx, cz, BACK)) { C.place(i, 0, -1e4, 0, 0, 0); continue; }
			if (Math.abs(f.s - f.ys) > 3) { f.y = ground(f.x, f.z); f.ys = f.s; }
			C.place(i, f.x, f.y, f.z, f.yaw, d > NEAR ? f.sc : 0);
			if (d > NEAR) shown++;
		}
	}
	return { update, info: () => ({ walkers: C ? N : 0, pieces: walks.length, ready: !!C?.ready(), shown, reach: Math.round(reachLen) }) };
}
