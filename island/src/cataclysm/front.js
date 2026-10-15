// A wildfire's front: the ground cut into cells, each with its fuel (dry grass and brush, the
// trees; nothing on water, a road's width or a roof), burning a while and spreading to its
// neighbours, faster downwind and uphill, now and then throwing embers ahead to start a spot
// fire. Water (a crew's hose, yours) knocks a cell down; a cell that has burned or been put
// out does not burn again. Pure: no scene, the dice passed in, so the tests can run a fire.
//
// opts: { cell (metres), fuelAt(x, z) -> 0..1, heightAt(x, z), maxBurning, maxCells (all the
// cells this fire may take, burning or burnt), spread (how readily it catches), rand }

const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function createFront({ cell = 10, fuelAt = () => 1, heightAt = () => 0, maxBurning = 400, maxCells = 1600, spread = 0.014, rand = Math.random } = {}) {
	const cells = new Map();          // key -> { i, j, x, z, s (1 burning, 2 burnt, 3 put out), heat, t, life, fuel, h }
	const burning = new Set();
	let lit = 0, out = 0, doused = 0;
	const key = (i, j) => i + ',' + j;
	const at = (i, j) => cells.get(key(i, j));
	function make(i, j) {
		const x = (i + 0.5) * cell, z = (j + 0.5) * cell;
		const c = { i, j, x, z, s: 0, heat: 0, t: 0, life: 0, fuel: Math.max(0, Math.min(1, fuelAt(x, z) || 0)), h: heightAt(x, z) || 0 };
		cells.set(key(i, j), c);
		return c;
	}
	// light the cell at (x, z), or a cell given; returns it, or null when it cannot burn
	function ignite(x, z, c = null) {
		const i = c ? c.i : Math.floor(x / cell), j = c ? c.j : Math.floor(z / cell);
		c = at(i, j) || make(i, j);
		if (c.s !== 0 || c.fuel < 0.08 || burning.size >= maxBurning || lit >= maxCells) return null;
		c.s = 1; c.heat = 0.2; c.t = 0;
		// (grass flashes through in a few seconds; brush and trees burn longer)
		c.life = 14 + c.fuel * 26 + rand() * 8;
		burning.add(c); lit++;
		return c;
	}
	// time and the wind ({ x, z } a unit direction, speed 0..2): returns { lit: [cells], out: [cells] }
	function step(dt, wind = { x: 1, z: 0, speed: 0.5 }) {
		const ev = { lit: [], out: [] };
		const ws = Math.max(0, wind.speed ?? 0.5);
		for (const c of [...burning]) {
			c.t += dt;
			c.heat = Math.min(1, c.t < 4 ? 0.2 + c.t * 0.2 : 1) * (c.t > c.life * 0.7 ? Math.max(0, 1 - (c.t - c.life * 0.7) / (c.life * 0.3)) : 1);
			if (c.t >= c.life || c.heat <= 0.01) { c.s = 2; c.heat = 0; burning.delete(c); out++; ev.out.push(c); continue; }
			if (c.heat < 0.4) continue;
			for (const [di, dj] of N8) {
				let n = at(c.i + di, c.j + dj);
				if (n && n.s !== 0) continue;
				n ||= make(c.i + di, c.j + dj);
				if (n.fuel < 0.08) continue;
				const d = Math.hypot(di, dj), ux = di / d, uz = dj / d;
				// downwind it races, upwind it creeps; uphill it climbs fast (the flames lean onto the slope)
				const windK = Math.exp((ux * wind.x + uz * wind.z) * ws * 1.6);
				const slope = (n.h - c.h) / (cell * d), slopeK = Math.exp(Math.max(-1.5, Math.min(2.5, slope * 4)));
				const p = spread * c.heat * n.fuel * windK * slopeK / d * dt;
				if (rand() < p && ignite(0, 0, n)) ev.lit.push(n);
			}
			// an ember thrown ahead on the wind: a spot fire a few cells downwind
			if (ws > 0.4 && rand() < 0.012 * c.heat * ws * dt) {
				const k = 2 + Math.floor(rand() * 3), si = Math.round(c.i + wind.x * k + (rand() - 0.5) * 2), sj = Math.round(c.j + wind.z * k + (rand() - 0.5) * 2);
				const n = at(si, sj) || make(si, sj);
				if (n.s === 0 && ignite(0, 0, n)) { n.spot = true; ev.lit.push(n); }
			}
		}
		return ev;
	}
	// water over the cells within r of (x, z): k of their heat a second (dt already in k); a cell
	// with its heat gone is put out (and will not burn again). Returns how many went out
	function douse(x, z, r, k) {
		let n = 0;
		for (const c of [...burning]) {
			if (Math.abs(c.x - x) > r || Math.abs(c.z - z) > r || Math.hypot(c.x - x, c.z - z) > r) continue;
			c.heat -= k; c.life = Math.max(c.t, c.life - k * 6);
			if (c.heat <= 0.05) { c.s = 3; c.heat = 0; burning.delete(c); out++; doused++; n++; }
		}
		return n;
	}
	// the burning cells within r of a point (nearest first when sorted)
	function near(x, z, r) {
		const res = [];
		for (const c of burning) if (Math.abs(c.x - x) <= r && Math.abs(c.z - z) <= r) res.push(c);
		return res;
	}
	// the cells that have burned (for the scorched ground), within r of a point
	function scorched(x, z, r, cap = 400) {
		const res = [];
		for (const c of cells.values()) { if ((c.s === 2 || c.s === 1 && c.t > 6) && Math.abs(c.x - x) <= r && Math.abs(c.z - z) <= r) { res.push(c); if (res.length >= cap) break; } }
		return res;
	}
	// the nearest burning cell to a point
	function nearest(x, z) {
		let best = null, bd = 1e18;
		for (const c of burning) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < bd) { bd = d; best = c; } }
		return best;
	}
	// the middle of what is burning, and how far it reaches
	function extent() {
		if (!burning.size) return null;
		let sx = 0, sz = 0;
		for (const c of burning) { sx += c.x; sz += c.z; }
		sx /= burning.size; sz /= burning.size;
		let r = 0;
		for (const c of burning) r = Math.max(r, Math.hypot(c.x - sx, c.z - sz));
		return { x: sx, z: sz, r: r + cell };
	}
	return {
		cells, burning, cell, ignite, step, douse, near, scorched, nearest, extent,
		stats: () => ({ burning: burning.size, lit, out, doused, known: cells.size }),
		held: () => lit > 0 && burning.size === 0,
		full: () => lit >= maxCells,
		clear() { cells.clear(); burning.clear(); lit = out = doused = 0; },
	};
}
