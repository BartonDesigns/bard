// The globe's towns and cities: the atlas's real ones (earth/atlas.js citiesNear) as you come
// near them, grown street by street by the engine's own town generator (crysis/civgen.js,
// through crysis/civ.js, one at a time as it does for the Bay's generated towns), sized by
// the place's size class and laid out in the place's manner: the older, denser grid where the
// towns are old, the curving suburban streets where they grew with the car. Their briefs
// (street names, signs) come from the city director (earth/director.js) as you approach.
//
// Where the Bay's own map already has the place (its surveyed land, its mapped regions, or a
// town the Bay's generator already put there), it is left to the Bay. The same cities also
// give the terrain its built-up ground and its lights at night, far out past where a town is
// grown (globeterrain.js).

import { createCivilization } from '../crysis/civ.js';
import { loadAtlas, atlasReady, citiesNear, regionAt, hash } from './atlas.js';
import { STYLE } from '../bay/styles.js';
import { F, toXZ, toLL } from './globeframe.js';

// civgen's reach, and how far the built-up ground spreads, by the atlas's size class
// (village, town, city, large city, metropolis, megacity)
const REACH = [650, 1100, 1700, 2300, 2900, 3400];
const SPREAD = [1400, 3200, 6500, 11000, 18000, 26000];
const GLOW = [0.35, 0.55, 0.75, 0.9, 1, 1];
const SCAN_KM = 260, RESCAN = 1500;

export function createGlobeTowns({ real, heightAt, water, director, skip }) {
	const towns = [];                  // for civ.js: { x, z, r, ang, style, name, pop, city }
	let list = [], civ = null, scanAt = null, scanEpoch = -1, scanT = -1e9;
	const view = { towns, heightAt: (x, z) => heightAt(x, z), loaded: () => true };
	const briefs = new Map();
	// a town's brief: the director's for the real city; null while it is on its way (the town
	// waits for it, up to 12 s), undefined for none
	function brief(t) {
		if (!director?.briefFor) return undefined;
		let B = briefs.get(t.city.id);
		if (!B) {
			B = { t0: performance.now(), v: null, done: false };
			briefs.set(t.city.id, B);
			director.briefFor(t.city.id).then((b) => { B.v = b || undefined; B.done = true; }).catch(() => { B.v = undefined; B.done = true; });
		}
		if (B.done) return B.v;
		return performance.now() - B.t0 > 12000 ? undefined : null;
	}
	const make = () => createCivilization({ real, bay: view, water, brief });
	civ = make();

	function scan(lat, lon) {
		const near = citiesNear(lat, lon, SCAN_KM, 80);
		list = [];
		towns.length = 0;
		for (const c of near) {
			const p = toXZ(c.lat, c.lon), size = Math.max(0, Math.min(5, c.pop | 0));
			const rec = { city: c, x: p.x, z: p.z, size, spread: SPREAD[size], km: c.km };
			if (skip(p.x, p.z, REACH[size])) { rec.bay = true; list.push(rec); continue; }
			list.push(rec);
			// the old world's towns keep their old grids; the new world's big cities too
			const R = regionAt(c.lat, c.lon), id = R?.id || '';
			const older = !/^(na|oc)\b/.test(id) || size >= 3;
			const h = hash(c.id);
			towns.push({ x: p.x, z: p.z, r: REACH[size], ang: (h % 1000) / 1000 * Math.PI / 2, style: older ? STYLE.older : STYLE.suburb, name: c.name, pop: [800, 8000, 60000, 300000, 1500000, 8000000][size], city: c, region: id });
		}
	}
	function update(camera) {
		if (!atlasReady()) { loadAtlas().catch(() => {}); return; }
		const t = performance.now(), x = camera.position.x, z = camera.position.z;
		if (scanEpoch !== F.epoch || !scanAt || (t - scanT > RESCAN && Math.hypot(x - scanAt[0], z - scanAt[1]) > 3000)) {
			const ll = toLL(x, z);
			scan(ll.lat, ll.lon);
			scanAt = [x, z]; scanEpoch = F.epoch; scanT = t;
		}
		civ.update(camera);
	}
	// the frame moved: the town being grown or standing goes (it is grown again in the new frame)
	function reset() {
		const A = civ.active();
		if (A?.handle) real.removeRegion(A.handle);
		civ = make();
		scanAt = null;
	}
	// the cities round a point for the terrain's built-up ground (engine metres; nearest first)
	function lit(n) {
		return list.slice(0, n).map((c) => ({ x: c.x, z: c.z, r: c.spread, k: GLOW[c.size] * (c.bay ? 0 : 1) }));
	}
	const busy = () => civ.busy() || !!civ.active();
	return { update, reset, lit, busy, towns, list: () => list, civ: () => civ, info: () => ({ near: list.slice(0, 6).map((c) => `${c.city.name} (${c.km} km${c.bay ? ', the Bay\'s' : ''})`), growing: civ.job(), active: civ.active()?.town?.name || null }) };
}
