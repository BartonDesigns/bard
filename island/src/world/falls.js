// Where water falls, for the spray and mist at the foot of it (world/spray.js):
// - the creeks' cascades and chutes, and a stream's last drop into a lake below it
//   (bay/water.js: the real Bay Area's and a planet's streams alike);
// - in a wet world's caves, water spilling from a crack in the vault into a chamber's pool
//   (the falling water itself drawn as spray: there is nothing else to show it).
// Each fall: its foot { x, y, z }, its lip { lx, ly, lz }, its drop and its width, and
// whether it is under ground.

const DEG = Math.PI / 180;

export function createFalls({ world } = {}) {
	let caves = null, cavePlan = null;

	// a cave's falls, worked out once: one over some of the chambers' water pools
	function caveFalls(plan) {
		const out = [], F = plan.field;
		let n = 0;
		for (const c of plan.chambers || []) for (const p of c.pools || []) {
			if (p.kind !== 'water' || (n++ * 0.618) % 1 > 0.7) continue;
			// a point over the far side of the pool, and the vault straight above it
			const a = Math.atan2(p.z - c.z, p.x - c.x) + 40 * DEG, x = p.x + Math.cos(a) * p.r * 0.55, z = p.z + Math.sin(a) * p.r * 0.55;
			let top = p.y + 1;
			while (top < p.y + 24 && (!F?.solid || F.solid(x, top + 0.5, z) < 0)) top += 0.5;
			if (top - p.y < 3 || top >= p.y + 24) continue;
			out.push({ x, y: p.y, z, lx: x, ly: top - 0.3, lz: z, drop: top - 0.3 - p.y, w: 0.5 + p.r * 0.06, cave: true });
		}
		return out;
	}

	function near(x, z, r) {
		const W = world();
		if (!W) return [];
		const out = W.water?.falls ? W.water.falls(x, z, r) : [];
		const plan = W.underworld?.plan;
		if (plan !== cavePlan) { cavePlan = plan; caves = plan ? caveFalls(plan) : []; }
		for (const f of caves) if (Math.hypot(f.x - x, f.z - z) < r) out.push(f);
		return out;
	}
	return { near, caves: () => caves || [] };
}
