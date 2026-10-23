// The globe's towns and cities: the atlas's real ones (earth/atlas.js citiesNear) as you come
// near them, grown street by street by the engine's own town generator (crysis/civgen.js,
// through crysis/civ.js, one at a time as it does for the Bay's generated towns), sized by
// the place's size class and laid out in the place's manner: the older, denser grid where the
// towns are old, the curving suburban streets where they grew with the car. Their briefs
// (street names, signs) come from the city director (earth/director.js) as you approach.
//
// A big city's districts round its centre grow the same way, one at a time, where you are in it
// (so wherever its lights are, coming down among them finds its streets).
//
// Where the Bay's own map already has the place (its surveyed land, its mapped regions, or a
// town the Bay's generator already put there), it is left to the Bay. The same cities also
// give the terrain its built-up ground and its lights at night, far out past where a town is
// grown (globeterrain.js).

import { createCivilization } from '../crysis/civ.js';
import { loadAtlas, atlasReady, citiesNear, regionAt, aridAt, hash } from './atlas.js';
import { STYLE } from '../bay/styles.js';
import { F, toXZ, toLL } from './globeframe.js';

// civgen's reach, and how far the built-up ground spreads, by the atlas's size class
// (village, town, city, large city, metropolis, megacity)
const REACH = [650, 1100, 1700, 2300, 2900, 3400];
const SPREAD = [1400, 3200, 6500, 11000, 18000, 26000];
const GLOW = [0.35, 0.55, 0.75, 0.9, 1, 1];
const SCAN_KM = 260, RESCAN = 1500;
// a city is more than its middle: its built-up ground (and its lights at night) spreads far past
// the town grown at its centre, so the districts round it are grown too, each on a lattice of the
// city's own (hexagonal, turned to its streets, so a district is the same every visit), the one
// you are in standing as the centre does. A district's reach and the lattice's spacing by size
// class (none round a village); its built-up ground goes out as far as the terrain draws it
const DISTRICT = [0, 1100, 1500, 1800, 2000, 2200];
const D_STEP = 1.3, D_LIT = 0.3, D_KM = 9;
const urbOf = (size, d) => Math.exp(-((d / SPREAD[size]) ** 3) * 1.2) * GLOW[size];

export function createGlobeTowns({ real, heightAt, water, director, skip, claim = () => false, keep = () => [] }) {
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
		const v = B.done ? B.v : performance.now() - B.t0 > 12000 ? undefined : null;
		return v && t.district ? districtBrief(v, t) : v;
	}
	// a district's brief: its city's, the street names and shop signs taken from another place in
	// the lists (so the next district over doesn't repeat the same high street)
	const turned = new Map();
	function districtBrief(v, t) {
		const k = t.city.id + ':' + t.district;
		let B = turned.get(k);
		if (B?.of === v) return B.v;
		const n = hash(k), turn = (a) => (Array.isArray(a) && a.length ? a.map((_, i) => a[(i + n) % a.length]) : a);
		B = { of: v, v: { ...v, streets: turn(v.streets), signs: turn(v.signs) } };
		turned.set(k, B);
		return B.v;
	}
	const make = () => createCivilization({ real, bay: view, water, brief, keep, palms: (t) => !!t.palms });
	civ = make();

	function scan(lat, lon) {
		const near = citiesNear(lat, lon, SCAN_KM, 80);
		list = [];
		towns.length = 0;
		for (const c of near) {
			const p = toXZ(c.lat, c.lon), size = Math.max(0, Math.min(5, c.pop | 0));
			const rec = { city: c, x: p.x, z: p.z, size, spread: SPREAD[size], km: c.km };
			if (skip(p.x, p.z, REACH[size])) { rec.bay = true; list.push(rec); continue; }
			// (a place the regional kit builds in its own manner: lit at night, not grown here)
			if (claim(c)) { rec.regional = true; list.push(rec); continue; }
			list.push(rec);
			// the old world's towns keep their old grids; the new world's big cities too
			const R = regionAt(c.lat, c.lon), id = R?.id || '';
			// (the American desert's towns, Las Vegas and Phoenix as much as the small ones, are stucco
			// subdivisions on the survey's mile grid, north and south; a warm desert's street trees are palms)
			const southwest = /^na\b/.test(id) && aridAt(c.lat, c.lon), palms = aridAt(c.lat, c.lon) && (R.profile?.climate?.temp?.[0] ?? 0) >= 5;
			const older = (!/^(na|oc)\b/.test(id) || size >= 3) && !southwest;
			const h = hash(c.id), ang = southwest ? 0 : (h % 1000) / 1000 * Math.PI / 2, style = older ? STYLE.older : STYLE.suburb, pop = [800, 8000, 60000, 300000, 1500000, 8000000][size];
			towns.push({ x: p.x, z: p.z, r: REACH[size], ang, style, name: c.name, pop, city: c, region: id, palms });
			districts(rec, ang, style, pop, id, palms);
		}
	}
	// the districts of a city round where you are (within D_KM): the lattice's points that are
	// built up enough, past the centre's own reach, not the Bay's
	function districts(rec, ang, style, pop, region, palms) {
		const size = rec.size, r = DISTRICT[size];
		if (!r || rec.km > SPREAD[size] / 1000 + D_KM) return;
		const D = r * D_STEP, row = D * Math.sqrt(3) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
		const here = scanAt ? { x: scanAt[0], z: scanAt[1] } : null;
		if (!here) return;
		// where you are in the city's own frame, and the lattice's rows and columns round it
		const lu = (here.x - rec.x) * ca + (here.z - rec.z) * sa, lv = -(here.x - rec.x) * sa + (here.z - rec.z) * ca;
		const n = Math.ceil(D_KM * 1000 / row) + 1, j0 = Math.round(lv / row);
		for (let j = j0 - n; j <= j0 + n; j++) {
			const off = (j & 1) ? D / 2 : 0, i0 = Math.round((lu - off) / D);
			for (let i = i0 - n; i <= i0 + n; i++) {
				if (!i && !j) continue;
				const u = i * D + off, v = j * row, d = Math.hypot(u, v);
				if (d < REACH[size] * 0.9 || urbOf(size, d) < D_LIT) continue;
				const x = rec.x + u * ca - v * sa, z = rec.z + u * sa + v * ca;
				if (Math.hypot(x - here.x, z - here.z) > D_KM * 1000 || skip(x, z, r)) continue;
				towns.push({ x, z, r, ang, style, name: rec.city.name, pop: Math.round(pop / 4), city: rec.city, region, palms, district: [i, j] });
			}
		}
	}
	function update(camera, arriving = false) {
		if (!atlasReady()) { loadAtlas().catch(() => {}); return; }
		const t = performance.now(), x = camera.position.x, z = camera.position.z;
		if (scanEpoch !== F.epoch || !scanAt || (t - scanT > RESCAN && Math.hypot(x - scanAt[0], z - scanAt[1]) > 3000)) {
			const ll = toLL(x, z);
			scanAt = [x, z]; scanEpoch = F.epoch; scanT = t;
			scan(ll.lat, ll.lon);
		}
		civ.update(camera, { arriving });
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
	// how built up the ground is at a point, for the town's own light by night (island-frame.js):
	// the town grown round you, as civgen.js thins it out from its middle (none where none is grown)
	function urbanAt(x, z) {
		const A = civ.active()?.town;
		if (!A) return 0;
		const d = Math.hypot(x - A.x, z - A.z) / A.r;
		return d > 1.6 ? 0 : Math.exp(-d * d * d * 1.1);
	}
	// ...and how much the cities round light the sky over a point (their whole footprint, as the
	// terrain draws it lit: globeterrain.js)
	function glowAt(x, z) {
		let u = 0;
		for (let i = 0; i < Math.min(12, list.length); i++) {
			const c = list[i];
			if (c.bay) continue;
			u = Math.max(u, urbOf(c.size, Math.hypot(x - c.x, z - c.z)));
		}
		return u;
	}
	// you stand in a town (or a district) still being grown
	const pending = () => civ.pending();
	return { update, reset, lit, busy, pending, urbanAt, glowAt, towns, list: () => list, civ: () => civ, info: () => ({ near: list.slice(0, 6).map((c) => `${c.city.name} (${c.km} km${c.bay ? ', the Bay\'s' : ''})`), growing: civ.job(), active: civ.active()?.town?.name || null }) };
}
