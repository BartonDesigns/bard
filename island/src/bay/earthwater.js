// Earth's fresh water, put together for water.js: the real Bay Area's (baked), the
// generated land's beyond the survey (crysis/rivers.js), and the generated towns' ponds.

import { createWater } from './water.js';
import { bakedWater, pondWater } from './watersrc.js';
import { waterDelta } from './watercarve.js';
import { proceduralWater } from '../crysis/rivers.js';
import { LEVELS, toWorld } from './geo.js';

export function createEarthWater(scene, bay, shared, { isPhone = false, real = null, ground = null, riverLevel = () => null } = {}) {
	const L0 = LEVELS[0], a = toWorld(L0.lat[1], L0.lon[0]), b = toWorld(L0.lat[0], L0.lon[1]);
	const inSurvey = (x, z) => x > a.x && x < b.x && z > a.z && z < b.z;
	const baked = bakedWater(bay, shared.bayU, riverLevel);
	const gen = proceduralWater({ heightAt: (x, z) => bay.heightAt(x, z) - waterDelta(x, z), inSurvey });
	const ponds = pondWater(real, (x, z) => bay.heightAt(x, z));
	// how much a place is town (0 wild .. 1 built up), for concrete channels and the banks' trees
	function townK(x, z) {
		if (real?.inside?.(x, z)) { const L = real.landAt(x, z); if (L) return L.lu === 0 || L.lu === 11 || L.lu === 12 ? 0 : L.lu === 2 || L.lu === 3 || L.lu === 4 ? 0.3 : 1; }
		return Math.min(1, (bay.urbanAt?.(x, z).u || 0) * 2.5);
	}
	const W = createWater(scene, shared, { isPhone, heightAt: (x, z) => bay.heightAt(x, z), ground, real, sources: [baked, gen, ponds], townK, skip: baked.skip, mode: 'bay' });
	// (for civgen.js's towns: how far the water is, and whether it is known yet round a place)
	W.gen = gen;
	return W;
}
