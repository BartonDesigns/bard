// The aether in the world, where you gather its fabric (magic/spells.js). Two strands:
//
//   light motes   gold, gathered where the sun reaches: the higher and more open the ground,
//                 the likelier; they show only while the sun is up
//   dark motes    violet, gathered where it does not: low ground, hollows, the woods; they
//                 show only after dark
//   wells         rare, bright springs of one strand or the other, a dozen times a mote's
//                 fabric; found once, a well is a place you can step back to (Sunwell Gate)
//
// At dusk and dawn both strands show, and each mote gives a little more. Placement is fixed by
// the world (a hash of the cell and the world's own seed), so a mote is always in the same place
// in the same world, and once gathered it is gone for a while (MOTE_BACK, WELL_BACK) before it
// gathers again. Walk into one to gather it.

const CELL = 46, WELL_CELL = 420;
export const MOTE_BACK = 15 * 60 * 1000, WELL_BACK = 40 * 60 * 1000;
export const GATHER_R = 2.4;

// a hash of a cell and the seed, 0..1 (k picks one of several independent draws)
export function cellHash(i, j, seed, k = 0) {
	let h = (Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 2147483647) ^ Math.imul(k + 1, 1274126177)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
	h = (h ^ (h >>> 16)) >>> 0;
	return h / 4294967296;
}
// a string (a world's key) to a seed
export function seedOf(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h | 0; }

// which strands show now, by the sun's height (-1 .. 1): light by day, dark by night, both at
// dusk and dawn; and the twilight's bonus
export function strandsShowing(light) { return { light: light > -0.06, dark: light < 0.06, twilight: Math.abs(light) < 0.06 }; }

// the mote in cell (i, j), or null: { key, x, z, strand, n }. heightAt(x, z): the ground; none in
// the sea or a lake bed (under -0.5 m)
export function moteAt(i, j, seed, heightAt) {
	if (cellHash(i, j, seed, 0) > 0.3) return null;
	const x = (i + 0.15 + 0.7 * cellHash(i, j, seed, 1)) * CELL, z = (j + 0.15 + 0.7 * cellHash(i, j, seed, 2)) * CELL;
	const h = heightAt(x, z);
	if (!Number.isFinite(h) || h < -0.5) return null;
	// (high open ground leans to light, low ground to dark)
	const lightBias = Math.max(0.2, Math.min(0.8, 0.42 + h / 260));
	const strand = cellHash(i, j, seed, 3) < lightBias ? 'light' : 'dark';
	return { key: `m${seed}:${i},${j}`, x, z, strand, n: 1 + Math.floor(cellHash(i, j, seed, 4) * 3), well: false };
}
// the well in a large cell, or null: a dozen times a mote's fabric
export function wellAt(i, j, seed, heightAt) {
	if (cellHash(i, j, seed, 10) > 0.2) return null;
	const x = (i + 0.25 + 0.5 * cellHash(i, j, seed, 11)) * WELL_CELL, z = (j + 0.25 + 0.5 * cellHash(i, j, seed, 12)) * WELL_CELL;
	const h = heightAt(x, z);
	if (!Number.isFinite(h) || h < -0.5) return null;
	return { key: `w${seed}:${i},${j}`, x, z, strand: cellHash(i, j, seed, 13) < 0.5 ? 'light' : 'dark', n: 18 + Math.floor(cellHash(i, j, seed, 14) * 14), well: true };
}
// every mote and well within r of (x, z) (out: an array to fill)
export function aetherNear(x, z, r, seed, heightAt, out = []) {
	out.length = 0;
	const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL), j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
	for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const m = moteAt(i, j, seed, heightAt); if (m && Math.hypot(m.x - x, m.z - z) <= r) out.push(m); }
	const I0 = Math.floor((x - r) / WELL_CELL), I1 = Math.floor((x + r) / WELL_CELL), J0 = Math.floor((z - r) / WELL_CELL), J1 = Math.floor((z + r) / WELL_CELL);
	for (let j = J0; j <= J1; j++) for (let i = I0; i <= I1; i++) { const w = wellAt(i, j, seed, heightAt); if (w && Math.hypot(w.x - x, w.z - z) <= r) out.push(w); }
	return out;
}
// whether one gathered at `at` (ms) is back by now
export const isBack = (m, at, now) => !at || now - at >= (m.well ? WELL_BACK : MOTE_BACK);
// the fabric it gives now: a little more at dusk and dawn
export const fabricOf = (m, light) => m.n + (strandsShowing(light).twilight ? Math.ceil(m.n / 2) : 0);

// ---------- in the world ----------
// fx: magic/fx.js; ground(x, z): the floor; light(): the sun's height; seed(): the world's;
// state: magic/spells.js's (gathered and wells); onGather(m, n): told when you gather one
export function createAether({ fx, ground, heightAt, light, seed, state, onGather, isPhone = false }) {
	const near = [], shown = [];
	let scanAt = { x: 1e9, z: 1e9, seed: null, t: 0 }, t = 0, sparkle = 0;
	const LIGHT = [1.0, 0.82, 0.42], DARK = [0.58, 0.34, 1.0];
	function scan(x, z, sd) {
		aetherNear(x, z, isPhone ? 70 : 110, sd, heightAt, near);
		scanAt = { x, z, seed: sd, t };
	}
	function update(dt, eye, now = Date.now()) {
		t += dt;
		const sd = seed();
		if (sd == null) return;
		if (Math.hypot(eye.x - scanAt.x, eye.z - scanAt.z) > 12 || sd !== scanAt.seed) scan(eye.x, eye.z, sd);
		const L = light(), show = strandsShowing(L);
		shown.length = 0;
		for (const m of near) {
			if (!show[m.strand] || !isBack(m, state.gathered[m.key], now)) continue;
			m.y ??= ground(m.x, m.z) + (m.well ? 0.4 : 1.1);
			shown.push(m);
		}
		// the motes drawn: a few points a frame each, rising and orbiting
		sparkle += dt * (isPhone ? 30 : 60);
		const n = Math.floor(sparkle); sparkle -= n;
		for (let k = 0; k < n && shown.length; k++) {
			const m = shown[Math.floor(Math.random() * shown.length)], c = m.strand === 'light' ? LIGHT : DARK, d = Math.hypot(m.x - eye.x, m.z - eye.z);
			if (d > 90 && Math.random() < 0.6) continue;
			const a = Math.random() * 6.283, r = m.well ? 0.4 + Math.random() * 1.6 : Math.random() * 0.35;
			const bob = Math.sin(t * 1.3 + m.x) * 0.15;
			fx.emit(m.x + Math.cos(a) * r, m.y + bob + (m.well ? Math.random() * 0.4 : 0), m.z + Math.sin(a) * r, -Math.sin(a) * 0.4, m.well ? 0.9 + Math.random() : 0.25 + Math.random() * 0.3, Math.cos(a) * 0.4, m.well ? 2.2 : 1.1, m.well ? 0.5 : 0.24, 0.03, c, 1, 0, 0.3);
			if (Math.random() < 0.25) fx.emit(m.x, m.y + bob, m.z, 0, 0.05, 0, 0.18, m.well ? 1.3 : 0.55, 0.4, c, 0.9, 0, 0);
		}
		// gathered: walk into it
		for (const m of shown) {
			if (Math.hypot(m.x - eye.x, m.z - eye.z) > (m.well ? GATHER_R + 1.2 : GATHER_R) || Math.abs(m.y - (eye.y - 0.9)) > 3) continue;
			const got = fabricOf(m, L);
			state.gathered[m.key] = now;
			if (m.well && !state.wells.some((w) => w.key === m.key)) state.wells.push({ key: m.key, x: m.x, y: m.y, z: m.z, strand: m.strand, seed: sd });
			// (the fabric drawn into you)
			const c = m.strand === 'light' ? LIGHT : DARK;
			for (let k = 0; k < (m.well ? 60 : 18); k++) {
				const a = Math.random() * 6.283, r = Math.random() * (m.well ? 1.6 : 0.5);
				const px = m.x + Math.cos(a) * r, pz = m.z + Math.sin(a) * r, py = m.y + Math.random() * 0.6;
				fx.emit(px, py, pz, (eye.x - px) * 2.4, (eye.y - 0.5 - py) * 2.4, (eye.z - pz) * 2.4, 0.4, 0.22, 0.05, c, 1, 0, 0);
			}
			onGather?.(m, got);
		}
		// (forget what came back long ago)
		if (Math.random() < 0.002) for (const [k, at] of Object.entries(state.gathered)) if (now - at > WELL_BACK * 2) delete state.gathered[k];
	}
	return { update, near: () => near, shown: () => shown, rescan: () => { scanAt.x = 1e9; } };
}
