// Fire: buildings, cars and crates set alight burn, grow, spread to what stands near them, and
// burn out, leaving a blackened shell. Limits keep it a fire and not the end of a city: only so
// many burn at once, a chain only reaches so far from where it began, and nothing burns twice.
// On Earth a fire crew comes. The rules here are pure (fireField); combat/combat.js draws them.

// opts: { maxBurning, maxChain (hops from the first), radius (metres a fire can jump), life
// (seconds a fire burns), spreadRate (chance a second to catch, at full heat, right beside) }
export function createFireField({ maxBurning = 5, maxChain = 3, radius = 14, life = 70, spreadRate = 0.06 } = {}) {
	const fires = new Map();                    // id -> { id, x, z, heat 0..1, t, chain, origin, state }
	const burnt = new Set();
	// set something alight; returns false when it cannot be (burnt, already burning, at the cap)
	function ignite(id, x, z, { chain = 0, origin = id, fuel = 1 } = {}) {
		if (fires.has(id) || burnt.has(id)) return false;
		if (fires.size >= maxBurning || chain > maxChain) return false;
		fires.set(id, { id, x, z, heat: 0.15, t: 0, life: life * fuel, chain, origin, doused: 0 });
		return true;
	}
	function douse(id, k) { const F = fires.get(id); if (F) F.doused += k; }
	// time: heat grows to full, then dies down; neighbours (from near(x, z, r)) may catch.
	// Returns the events: { type: 'spread', from, to }, { type: 'out', id }
	function tick(dt, near = () => [], rand = Math.random) {
		const ev = [];
		for (const F of [...fires.values()]) {
			F.t += dt;
			const grow = F.t < F.life * 0.25 ? F.t / (F.life * 0.25) : 1 - Math.max(0, (F.t - F.life * 0.6) / (F.life * 0.4));
			F.heat = Math.max(0, Math.min(1, grow) - F.doused * 0.02);
			if (F.t >= F.life || (F.doused > 0 && F.heat <= 0.02)) { fires.delete(F.id); burnt.add(F.id); ev.push({ type: 'out', id: F.id }); continue; }
			if (F.heat < 0.5 || F.chain >= maxChain) continue;
			for (const N of near(F.x, F.z, radius)) {
				if (N.id === F.id || fires.has(N.id) || burnt.has(N.id)) continue;
				const d = Math.hypot(N.x - F.x, N.z - F.z);
				if (d > radius) continue;
				const p = spreadRate * F.heat * (1 - d / radius) * (N.fuel ?? 1) * dt;
				if (rand() < p && ignite(N.id, N.x, N.z, { chain: F.chain + 1, origin: F.origin, fuel: N.fuel ?? 1 })) ev.push({ type: 'spread', from: F.id, to: N.id });
			}
		}
		return ev;
	}
	return { fires, burnt, ignite, douse, tick, burning: (id) => fires.has(id), isBurnt: (id) => burnt.has(id), clear() { fires.clear(); burnt.clear(); } };
}
