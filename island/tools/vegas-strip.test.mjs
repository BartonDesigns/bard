// Las Vegas looks like Las Vegas: the Strip's resorts stand where they stand (region/landmarks.js),
// lit by night with their neon and their rooms (the rooms and the Luxor's beam only after dark:
// region/settle.js B.night); the towns grown round them keep off their ground (crysis/civ.js keep);
// the desert's towns are stucco subdivisions on a north-south grid under palms
// (earth/globetowns.js); and the desert's closed basins are dry pans, not lakes (crysis/rivers.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { REAL, REAL_BUILD } from '../src/region/landmarks.js';
import { Geo } from '../src/region/geo.js';
import { createSettlements } from '../src/region/settle.js';
import { createCivilization } from '../src/crysis/civ.js';
import { loadAtlas, aridAt } from '../src/earth/atlas.js';
import { setFrame, bayFrame, toXZ } from '../src/earth/globeframe.js';
import { createGlobeTowns } from '../src/earth/globetowns.js';
import { STYLE } from '../src/bay/styles.js';

const VEGAS = REAL.filter(([, la, lo]) => la > 36 && la < 36.25 && lo > -115.25 && lo < -115.1);
const B = () => ({ G: new Geo(), glow: new Geo(), night: new Geo(), solid: [], smoke: [], lights: [], trees: [] });
const finite = (g) => g.p.every((v) => Number.isFinite(v));

test('the Strip: its resorts, the wheel, the tower, the sign and Fremont Street, each built and lit', async () => {
	const names = VEGAS.map((e) => e[0]).join(' / ');
	for (const want of ['Welcome to Fabulous Las Vegas', 'Luxor', 'Bellagio', 'Caesars', 'Paris Las Vegas', 'New York-New York', 'High Roller', 'Venetian', 'Sphere', 'Wynn', 'Strat', 'Fremont Street']) assert.ok(names.includes(want), want);
	const idx = fs.readFileSync(new URL('../src/region/index.js', import.meta.url), 'utf8');
	for (const [name, , , type, sc, , about, args] of VEGAS) {
		assert.ok(REAL_BUILD[type], name + ' has a builder');
		assert.match(idx, new RegExp('\\b' + type + ': \\d+'), name + ' keeps its ground clear');
		assert.ok(about.length > 20, name + ' has a tale');
		const b = { ...B(), signs: [], name };
		REAL_BUILD[type](b, sc, args, () => 0.5, (x) => 0.002 * x);
		assert.ok(b.G.p.length > 0 && finite(b.G) && finite(b.glow) && finite(b.night), name + ' built');
		assert.ok(b.glow.p.length + b.night.p.length > 0, name + ' is lit by night');
		assert.ok(b.solid.length > 0, name + ' stands in your way');
		// (a resort's pool deck out the back and its garage at the side, all on its own paved ground)
		if (type === 'casino' || type === 'bellagio') {
			const clear = +idx.match(new RegExp('\\b' + type + ': (\\d+)'))[1] * sc;
			assert.ok(b.solid.length >= 4 && b.trees.length > 12, name + ' has its pools and garage');
			// (its own name in lights: both faces of its pylon, the crown of each tower)
			assert.ok(b.signs.length >= 3 && b.signs.every((q) => q.text === name && q.w > 4 && q.h > 3 && [q.x, q.y, q.z, q.yaw].every(Number.isFinite)), name + ' has its name up');
			assert.equal(b.signs.filter((q) => q.y > 40 && q.y < 50).length, 2, name + ' on its pylon both sides');
			for (const [x, z, w, d] of b.solid) assert.ok(Math.hypot(Math.abs(x) + w / 2, Math.abs(z) + d / 2) < clear, `${name}: ${Math.round(x)},${Math.round(z)} inside its ground (${clear})`);
		}
	}
	// (the names lettered as each resort letters its own: no "the", capitals but for the script ones)
	const { signText } = await import('../src/region/marquee.js');
	assert.equal(signText('the Flamingo', 'script'), 'Flamingo');
	assert.equal(signText('Caesars Palace'), 'CAESARS PALACE');
	const st = fs.readFileSync(new URL('../src/region/settle.js', import.meta.url), 'utf8');
	assert.match(st, /name: s\.kind === 'real' \? s\.name : null/);
	assert.match(st, /signs\.push\(\{ \.\.\.q, x, y: y \+ q\.y, z, yaw: rot \+ q\.yaw \}\)/);
	assert.match(st, /C\.signs = marquees\.mesh\(signs\)/);
	// (the towers' rooms lit only after dark; the Luxor's beam goes up from its point)
	const mb = B(); REAL_BUILD.casino(mb, 1, VEGAS.find((e) => e[0] === 'Mandalay Bay')[7], () => 0.5);
	assert.ok(mb.night.p.length > 900, 'lit rooms up the tower');
	const lx = B(); REAL_BUILD.luxor(lx, 1);
	let top = 0;
	for (let i = 1; i < lx.night.p.length; i += 3) top = Math.max(top, lx.night.p[i]);
	assert.ok(top > 3000, 'the beam into the sky');
	let glowTop = 0;
	for (let i = 1; i < lx.glow.p.length; i += 3) glowTop = Math.max(glowTop, lx.glow.p[i]);
	assert.ok(glowTop < 200, 'and not lit by day');
	// (south to north up the Strip, the Strat and Fremont Street past its north end)
	const at = (n) => VEGAS.find((e) => e[0].includes(n));
	assert.ok(at('Welcome')[1] < at('Luxor')[1] && at('Luxor')[1] < at('Bellagio')[1] && at('Bellagio')[1] < at('Wynn')[1] && at('Wynn')[1] < at('Strat')[1] && at('Strat')[1] < at('Fremont')[1]);
	// (on the boulevard where it runs north and south, up to Spring Mountain Road: each close by, its
	// ground clear of the road itself; the Sphere set back behind)
	const idx2 = fs.readFileSync(new URL('../src/region/index.js', import.meta.url), 'utf8');
	for (const e of VEGAS) {
		if (e[1] > 36.126 || /Sphere|Welcome/.test(e[0])) continue;
		const off = Math.abs(e[2] + 115.1722) * 89900, clear = +idx2.match(new RegExp('\\b' + e[3] + ': (\\d+)'))[1] * e[4];
		assert.ok(off < 650, `${e[0]} on the Strip (${Math.round(off)} m off)`);
		assert.ok(off > clear, `${e[0]} keeps off the boulevard (${Math.round(off)} m, clear ${clear})`);
	}
});

test('the night layer is dark by day and lit after it, on the glow\'s own shader', () => {
	const scene = new THREE.Scene(), F = { epoch: 1 };
	const S = createSettlements({ scene, ground: () => 600, wet: () => false, F, toXZ: () => ({ x: 0, z: 0 }), toLL: (x, z) => ({ lat: z, lon: x }), isPhone: true });
	const e = VEGAS.find((q) => q[0] === 'the Bellagio');
	const site = S.add({ key: 'real:test', kind: 'real', clear: 160, kit: 'desert', pop: -1, name: e[0], opts: {}, env: { snow: 0 }, lots: [{ type: 'casino', build: (b, L, P, r) => REAL_BUILD.casino(b, 1, e[7], r, () => 0), x: 0, z: 0, rot: Math.PI / 2, w: 30, d: 30, role: 'centre' }] });
	const cam = { position: { x: 0, y: 30, z: 0 } };
	for (let i = 0; i < 200 && ![...site.cells.values()].some((c) => c.night); i++) S.update(0.1, cam, { budget: 4, night: 1 });
	const C = [...site.cells.values()].find((c) => c.night);
	assert.ok(C, 'its rooms built');
	assert.ok(C.glow && C.mesh);
	assert.equal(C.night.material.visible, true);
	assert.ok(C.night.material.color.r > 1);
	assert.equal(C.night.material.customProgramCacheKey(), C.glow.material.customProgramCacheKey(), 'no new shader');
	S.update(0.1, cam, { budget: 4, night: 0 });
	assert.equal(C.night.material.visible, false, 'by day the rooms are just glass');
	S.dispose();
});

test('the towns grown round the resorts keep off their ground, and their trees are palms', () => {
	const log = [];
	const town = { x: 0, z: 0, r: 1100, ang: 0, style: STYLE.suburb, name: 'Paradise' };
	const keepAt = [{ x: 300, z: -200, r: 170, paved: true }, { x: -450, z: 350, r: 230 }];
	const civ = createCivilization({ real: { addRegion: (r) => { log.push(r); return { r }; }, removeRegion: () => {} }, bay: { towns: [town], heightAt: () => 610, loaded: () => true }, keep: (x, z, r) => keepAt.filter((k) => Math.hypot(k.x - x, k.z - z) < r + k.r), palms: (t) => t === town });
	const cam = { position: { x: 0, y: 1.7, z: 0 } };
	for (let n = 0; n < 6000 && !civ.active(); n++) civ.update(cam);
	const R = civ.active()?.region;
	assert.ok(R, 'the town grew');
	assert.ok(R.boxes.length > 200 && R.roads.length > 20, `${R.boxes.length} buildings, ${R.roads.length} streets`);
	const inside = (x, z, pad = 0) => keepAt.some((k) => Math.hypot(x - k.x, z - k.z) < k.r - pad);
	for (const b of R.boxes) assert.ok(!inside(b.x, b.z), `no building on a resort's ground (${Math.round(b.x)}, ${Math.round(b.z)})`);
	for (const p of R.pools || []) assert.ok(!inside(p.x, p.z));
	// (streets may run up to its edge: none crosses its middle)
	for (const q of R.roads) for (let i = 0; i < q.pts.length; i += 2) assert.ok(!inside(q.pts[i], q.pts[i + 1], 25), `${q.cls} through a resort`);
	const leafy = R.trees.filter((t) => !t.cone);
	assert.ok(leafy.length > 50);
	const palms = leafy.filter((t) => t.sp === 3).length / leafy.length;
	assert.ok(palms > 0.55 && palms < 0.85, `${Math.round(palms * 100)}% palms`);
	assert.ok(leafy.filter((t) => t.sp === 3).every((t) => t.h >= 9), 'palms stand tall');
	// a resort's clearing is the town's paved ground on its map (no scrub there); a landmark in the wild keeps it wild
	const M = R.map, luAt = (x, z) => Math.round(M.px[(Math.floor((z - M.z0) / M.step) * M.w + Math.floor((x - M.x0) / M.step)) * 4 + 1] / 16);
	assert.equal(luAt(300, -200), 7, 'the resort\'s ground is paved');
	assert.equal(luAt(300, -200 + 150), 7, 'out to its edge');
	assert.equal(luAt(-450, 350), 0, 'the unpaved landmark\'s is not');
});

test('no wild plant comes up on a resort\'s ground, nor in the yards and streets of a town grown round you', () => {
	const scene = new THREE.Scene(), F = { epoch: 1 };
	const S = createSettlements({ scene, ground: () => 600, wet: () => false, F, toXZ: (la, lo) => ({ x: lo, z: la }), toLL: (x, z) => ({ lat: z, lon: x }), isPhone: true });
	const site = (key, lon, paved) => S.add({ key, kind: 'real', clear: 190, paved, lat: 0, lon, kit: 'desert', pop: -1, name: key, opts: {}, env: { snow: 0 }, lots: [] });
	const a = site('real:paved', 0, true), b = site('real:wild', 5000, false);
	a.planned = b.planned = { reach: 0, paths: [], lots: [], fields: [] };
	assert.equal(S.vegetationBlocked(120, 0, 1), true, 'a resort\'s gardens are its own');
	assert.equal(S.vegetationBlocked(300, 0, 1), false, 'the desert past them');
	assert.equal(S.vegetationBlocked(5120, 0, 1), false, 'a landmark out in the wild keeps the wild round it');
	S.dispose();
	const idx = fs.readFileSync(new URL('../src/region/index.js', import.meta.url), 'utf8');
	assert.match(idx, /\|\| !!built\?\.at\(x, z\)/, 'the flora keeps out of the town grown round you');
	assert.match(idx, /\(built\?\.version\(\) \|\| 0\)/, 'and is laid again when it grows');
	assert.match(idx, /PAVED = new Set\(\['casino'[^\n]*'canopy'/);
	const g = fs.readFileSync(new URL('../src/earth/globe.js', import.meta.url), 'utf8');
	assert.match(g, /L\.lu > 0 \|\| L\.road > 0\.05/);
	assert.match(g, /&& !built\.at\(x, z\) \}\);/, 'nor the wild trees');
	// the wild ground at your feet (nature/wildground.js): worked out again when a town grows, and out on the
	// globe none in the town's yards, lots and streets
	const wg = fs.readFileSync(new URL('../src/nature/wildground.js', import.meta.url), 'utf8');
	assert.match(wg, /real\?\.genVersion\?\.\(\)[^\n]*\n[^\n]*if \(gv !== genSeen\) \{ genSeen = gv; cells\.clear\(\)/);
	assert.match(wg, /if \(away && real\?\.inside\(cx, cz\)\) \{ const L = real\.landAt\(cx, cz\); if \(L && L\.lu !== 0/);
	// a paved landmark's clearing is paved out to its edge
	const G = new Geo(), B = { G, glow: new Geo(), night: new Geo(), later: [], smoke: [], solid: [], lights: [], trees: [] };
	const paveLot = new Function('B', 'R', 'gr', idx.match(/function paveLot\(B, R, gr\) \{([\s\S]*?)\n\}/)[1]);
	paveLot(B, 150, () => 0);
	const P = G.p;
	let far = 0, up = 0;
	for (let i = 0; i < P.length; i += 3) far = Math.max(far, Math.hypot(P[i], P[i + 2]));
	for (let i = 1; i < G.n.length; i += 3) if (G.n[i] > 0.99) up++;
	assert.ok(far > 149 && far < 151, `paved out to ${far}`);
	assert.equal(up, G.n.length / 3, 'facing up');
	assert.match(idx, /if \(PAVED\.has\(type\)\) paveLot\(B, \(CLEAR\[type\] \?\? 45\) \* sc, gr\)/);
});

test('the desert\'s towns: Las Vegas grows stucco subdivisions on a north-south grid, palms in its streets', async () => {
	await loadAtlas();
	assert.equal(aridAt(36.12, -115.17), true, 'Las Vegas');
	assert.equal(aridAt(33.45, -112.07), true, 'Phoenix');
	assert.equal(aridAt(25.2, 55.27), true, 'Dubai');
	assert.equal(aridAt(48.85, 2.35), false, 'Paris');
	assert.equal(aridAt(37.77, -122.42), false, 'San Francisco');
	setFrame(36.1135, -115.1722);
	try {
		const T = createGlobeTowns({ real: { addRegion: () => ({}), removeRegion: () => {} }, heightAt: () => 610, water: () => null, director: null, skip: () => false, claim: () => false, keep: () => [] });
		const c = toXZ(36.1135, -115.1722);
		T.update({ position: { x: c.x, y: 1.7, z: c.z } });
		const lv = T.towns.filter((t) => t.city.name === 'Las Vegas');
		assert.ok(lv.length > 3, 'the city and its districts');
		for (const t of lv) { assert.equal(t.style, STYLE.suburb); assert.equal(t.ang, 0); assert.equal(t.palms, true); }
		assert.ok(lv.some((t) => t.district && Math.hypot(t.x - c.x, t.z - c.z) < t.r), 'a district over the Strip');
	} finally { bayFrame(); }
	// (the cold desert's towns keep their own trees: palms want a mild winter)
	setFrame(47.92, 106.9);
	try {
		const T = createGlobeTowns({ real: { addRegion: () => ({}), removeRegion: () => {} }, heightAt: () => 1300, water: () => null, director: null, skip: () => false, claim: () => false });
		const c = toXZ(47.92, 106.9);
		T.update({ position: { x: c.x, y: 1.7, z: c.z } });
		assert.ok(T.towns.length > 0);
		assert.ok(T.towns.every((t) => !t.palms), 'no palms in Ulaanbaatar');
	} finally { bayFrame(); }
});

test('the landmarks\' ground is known before the sites round you are scanned', () => {
	const idx = fs.readFileSync(new URL('../src/region/index.js', import.meta.url), 'utf8');
	assert.match(idx, /function landmarksNear\(x, z, r\) \{[\s\S]{0,300}for \(const \[, la, lo, type, sc\] of REAL\)/);
	const g = fs.readFileSync(new URL('../src/earth/globe.js', import.meta.url), 'utf8');
	assert.match(g, /keep: \(x, z, r\) => regional\.landmarksNear\(x, z, r\)/);
});

test('in the desert a closed basin is a dry pan, not a lake, and its washes run dry', async () => {
	const { proceduralWater } = await import('../src/crysis/rivers.js');
	// (a bowl of a valley, its floor well below its rim all round)
	const heightAt = (x, z) => 600 + Math.hypot(x + 400000, z) ** 2 / 20000 + 8 * Math.sin(x / 300) * Math.cos(z / 260);
	const water = (arid) => {
		const gen = proceduralWater({ heightAt, inSurvey: () => false, arid: () => arid });
		for (let n = 0; n < 4000 && !gen.readyAt(-400000, 0, 10); n++) gen.pump(-400000, 0, 10, 50);
		assert.ok(gen.readyAt(-400000, 0, 10));
		let near = Infinity;
		for (let x = -3800; x <= 3800; x += 200) for (let z = -3800; z <= 3800; z += 200) near = Math.min(near, gen.near(-400000 + x, z));
		return { lakes: gen.lakes.length, near };
	};
	const wet = water(false), dry = water(true);
	assert.ok(wet.lakes > 0, 'a lake where it rains');
	assert.ok(wet.near < 150, 'and creeks running into it');
	assert.equal(dry.lakes, 0, 'none in the desert');
	assert.ok(dry.near > 1e6, `no creek either (${dry.near})`);
	const w = fs.readFileSync(new URL('../src/bay/earthwater.js', import.meta.url), 'utf8');
	assert.match(w, /arid: \(x, z\) => !F\.bay && aridAt\(/);
});

test('a big town\'s freeway is not laid over a landmark\'s ground', () => {
	const grow = (keepAt) => {
		const town = { x: 0, z: 0, r: 1800, ang: 0, style: STYLE.suburb, name: 'Paradise' };
		const civ = createCivilization({ real: { addRegion: (r) => ({ r }), removeRegion: () => {} }, bay: { towns: [town], heightAt: () => 610, loaded: () => true }, keep: () => keepAt });
		const cam = { position: { x: 0, y: 1.7, z: 0 } };
		for (let n = 0; n < 20000 && !civ.active(); n++) civ.update(cam);
		return civ.active().region;
	};
	const free = grow([]), fwy = free.roads.filter((q) => q.cls === 'motorway' && !q.link);
	assert.ok(fwy.length, 'a freeway through it with nothing in the way');
	const p = fwy[0].pts, mid = (p.length >> 2) << 1, k = { x: p[mid], z: p[mid + 1], r: 160 };
	const R = grow([k]);
	for (const q of R.roads) if (q.cls === 'motorway') for (let i = 0; i < q.pts.length; i += 2) assert.ok(Math.hypot(q.pts[i] - k.x, q.pts[i + 1] - k.z) > k.r, 'no freeway over the resort');
});

test('the American desert grows its own plants: creosote and Joshua trees round Las Vegas, sagebrush up by Reno', async () => {
	const { regionAt } = await import('../src/earth/atlas.js');
	const { kitAt } = await import('../src/region/choose.js');
	await loadAtlas();
	const kit = (la, lo) => kitAt(regionAt(la, lo), {})?.id;
	assert.equal(kit(36.12, -115.17), 'mojave', 'Las Vegas');
	assert.equal(kit(39.53, -119.81), 'mojave', 'Reno');
	assert.equal(kit(31.76, -106.49), 'mojave', 'El Paso');
	assert.equal(kit(33.45, -112.07), 'pueblo', 'Phoenix keeps its saguaros');
	assert.equal(kit(-23.7, 133.88), 'outback', 'Alice Springs keeps its gums');
	const vegas = regionAt(36.12, -115.17).profile;
	assert.ok(vegas.veg.some((v) => /creosote/i.test(v)) && vegas.veg.some((v) => /joshua/i.test(v)), 'the Mojave\'s plants');
	assert.ok(vegas.climate.temp[0] >= 5 && vegas.climate.rain < 200, 'a hot desert, mild in winter');
	assert.equal(aridAt(70.2, -148.5), false, 'the tundra keeps its thaw lakes');
	const { KITS } = await import('../src/region/kits.js');
	const words = KITS.mojave.flora.map(([w]) => w);
	for (const w of ['creosote', 'joshua', 'yucca', 'sagebrush']) assert.ok(words.includes(w), w);
	assert.ok(!words.some((w) => /oak|cottonwood|gum|hedge/.test(w)), 'no leafy trees out in the desert');
	const fl = fs.readFileSync(new URL('../src/region/flora.js', import.meta.url), 'utf8');
	for (const w of ['creosote', 'joshua', 'yucca']) assert.match(fl, new RegExp('[\\t ]' + w + ': \\[\\x27'), w + ' has a form');
	assert.match(fl, /kind === 'joshua' \|\| kind === 'yucca'/, 'the Joshua tree is built');
	// (the kit's own name everywhere the kits are listed)
	assert.match(fs.readFileSync(new URL('../src/region/talk.js', import.meta.url), 'utf8'), /case 'mojave':/);
	assert.match(fs.readFileSync(new URL('../src/region/index.js', import.meta.url), 'utf8'), /mojave: 0,/);
});

test('Las Vegas Boulevard runs straight down the Strip, the district\'s grid lined up on it', async () => {
	const town = { x: 0, z: 0, r: 2000, ang: 0, style: STYLE.suburb, name: 'Las Vegas', spine: { x: 437, name: 'Las Vegas Boulevard', z0: -1500, z1: 1800, hw: 380 } };
	const keepAt = [{ x: 437 - 330, z: 200, r: 190 }];
	const civ = createCivilization({ real: { addRegion: (r) => ({ r }), removeRegion: () => {} }, bay: { towns: [town], heightAt: () => 610, loaded: () => true }, keep: (x, z, r) => keepAt.filter((k) => Math.hypot(k.x - x, k.z - z) < r + k.r), palms: () => true });
	const cam = { position: { x: 0, y: 1.7, z: 0 } };
	for (let n = 0; n < 20000 && !civ.active(); n++) civ.update(cam);
	const R = civ.active().region;
	const blvd = R.roads.filter((q) => q.name === 'Las Vegas Boulevard');
	assert.ok(blvd.length, 'the boulevard is there by name');
	let len = 0;
	for (const q of blvd) {
		assert.equal(q.cls, 'primary');
		assert.ok(q.w >= 24, `a broad boulevard (${q.w} m)`);
		for (let i = 0; i < q.pts.length; i += 2) assert.ok(Math.abs(q.pts[i] - 437) < 2, `straight on its line (${q.pts[i].toFixed(1)})`);
		len += Math.abs(q.pts[q.pts.length - 1] - q.pts[1]);
	}
	assert.ok(len > 2 * 2000, `${Math.round(len)} m of it, through the town and on out`);
	assert.ok(Math.abs(R.centre[0]) <= R.info.arterialSpacing / 2 + 1, 'the grid moved less than half its spacing');
	// the Strip: resorts down both sides of it, no house nor street of houses
	const strip = (x, z) => Math.abs(x - 437) < 380 && z > -1500 && z < 1800;
	const on = R.boxes.filter((b) => strip(b.x, b.z));
	assert.ok(!on.some((b) => b.kind <= 4 || b.kind === 10), 'no house on the Strip');
	assert.ok(!R.roads.some((q) => q.cls === 'residential' && [...Array(q.pts.length >> 1).keys()].some((i) => strip(q.pts[2 * i], q.pts[2 * i + 1]))), 'no street of houses');
	const casinos = on.filter((b) => b.kind === 6 && b.wallH > 12), towers = on.filter((b) => b.kind === 11 && b.wallH > 50);
	for (const side of [-1, 1]) {
		assert.ok(casinos.filter((b) => Math.sign(b.x - 437) === side).length >= 5, 'casinos along the pavement, each side');
		assert.ok(towers.filter((b) => Math.sign(b.x - 437) === side).length >= 4, 'their hotel towers behind');
	}
	// (a casino fronts the boulevard: its front, the box's +z, faces it)
	for (const b of casinos) assert.ok(-Math.sin(b.a) * Math.sign(437 - b.x) > 0.99, 'facing the boulevard');
	assert.ok(!on.some((b) => Math.hypot(b.x - keepAt[0].x, b.z - keepAt[0].z) < keepAt[0].r), 'none on a named resort\'s ground');
	const palms = R.trees.filter((t) => strip(t.x, t.z));
	assert.ok(palms.length > 200 && palms.filter((t) => t.sp === 3).length > palms.length * 0.95, 'palms down its pavements');
	// (in their wells: the pavement under them is paved, and city.js keeps a tree off paving unless it stands in a well)
	const kerbPalms = R.trees.filter((t) => strip(t.x, t.z) && Math.abs(Math.abs(t.x - 437) - 17) < 1);
	assert.ok(kerbPalms.length > 200 && kerbPalms.every((t) => t.well), 'kerb palms in wells');
	assert.match(fs.readFileSync(new URL('../src/bay/city.js', import.meta.url), 'utf8'), /trees\.push\(\{ src: 'real',[^\n]*well: t\.well/);
	assert.ok(R.paths.some((p) => p.wells && strip(p.ax, p.az) && Math.abs(Math.abs(p.ax - 437) - 22) < 1), 'the promenade under them takes trees in wells');
	const { makeClearance } = await import('../src/bay/clearance.js');
	const promenade = { ax: 22, az: 0, bx: 22, bz: 24, w: 24, wells: 1 }, lot = { ax: -22, az: 0, bx: -22, bz: 24, w: 24 };
	const K = makeClearance({ near: (k) => (k === 'paths' ? [promenade, lot] : []), inside: () => true }, 0, 12, 200);
	assert.ok(K.clear(17, 12, 0.5, true) && !K.clear(17, 12, 0.5, false), 'a palm in its well on the promenade; nothing else stands there');
	assert.ok(!K.clear(-17, 12, 0.5, true), 'nor in a lot');
	// (and its ground paved from the pavement back, the forecourts, lots and drives: no desert between the resorts)
	const slabs = R.paths.filter((p) => p.w >= 8), onSlab = (x, z) => slabs.some((p) => { const dx = p.bx - p.ax, dz = p.bz - p.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p.ax) * dx + (z - p.az) * dz) / L2)); return Math.hypot(p.ax + dx * t - x, p.az + dz * t - z) <= p.w / 2 + 0.5; });
	let n = 0, paved = 0;
	for (let z = -1300; z < 1700; z += 37) for (const dx of [-200, -120, -60, 60, 120, 200]) {
		const x = 437 + dx;
		if (Math.hypot(x - keepAt[0].x, z - keepAt[0].z) < keepAt[0].r + 25) continue;
		n++; if (onSlab(x, z)) paved++;
	}
	assert.ok(paved > n * 0.95, `${paved} of ${n} spots on the Strip paved`);
	// (the freeway behind the resorts on the west, north and south beside it, as the 15 runs)
	const fwy = R.roads.filter((q) => q.cls === 'motorway' && !q.link);
	assert.ok(fwy.length);
	for (const q of fwy) for (let i = 0; i < q.pts.length; i += 2) assert.ok(q.pts[i] < 437 - 380 - 200 && q.pts[i] > 437 - 1200, `the freeway west of the Strip (${Math.round(q.pts[i] - 437)})`);
	// (the districts over the Strip have it; downtown, up past the Strat, does not)
	await loadAtlas();
	setFrame(36.1135, -115.1722);
	try {
		const T = createGlobeTowns({ real: { addRegion: () => ({}), removeRegion: () => {} }, heightAt: () => 610, water: () => null, director: null, skip: () => false, claim: () => false });
		const c = toXZ(36.1135, -115.1722);
		T.update({ position: { x: c.x, y: 1.7, z: c.z } });
		const lv = T.towns.filter((t) => t.city.name === 'Las Vegas');
		assert.ok(lv.some((t) => t.spine && Math.hypot(t.x - c.x, t.z - c.z) < t.r), 'the district you stand in on the Strip');
		assert.ok(lv.some((t) => t.spine && Math.abs(t.x - c.x) < 5 && Math.abs(t.z - c.z) < t.r * 0.7), 'centred on the boulevard');
		assert.ok(!lv.find((t) => !t.district).spine, 'not downtown');
		for (const t of lv.filter((q) => q.spine)) {
			assert.ok(Math.abs(t.spine.x - c.x) < 30);
			// (the Strip from just past the welcome sign up to Sands Avenue)
			assert.ok(t.spine.z0 < c.z - 1000 && t.spine.z1 > c.z + 3000 && t.spine.hw >= 300, 'the Strip\'s length');
		}
		// (the grid's lights by night: the desert cities on the mile grid say so)
		assert.ok(T.lit(12).some((q) => q.k >= 2), 'Las Vegas lit on its grid');
		const sh = fs.readFileSync(new URL('../src/earth/globeterrain.js', import.meta.url), 'utf8');
		assert.match(sh, /gw = step\(2\.0, C\.w\)/);
		assert.match(sh, /gQI & 63/, 'the section lines every mile');
	} finally { bayFrame(); }
});

test('the Strip is alive at night: thronged round the clock, every resort between the named ones a casino with its tower, its name in lights, the boulevard full of cars', async () => {
	const town = { x: 0, z: 0, r: 2000, ang: 0, style: STYLE.suburb, name: 'Las Vegas', spine: { x: 437, name: 'Las Vegas Boulevard', z0: -1500, z1: 1800, hw: 380 } };
	const civ = createCivilization({ real: { addRegion: (r) => ({ r }), removeRegion: () => {} }, bay: { towns: [town], heightAt: () => 610, loaded: () => true }, keep: () => [], palms: () => true });
	const cam = { position: { x: 0, y: 1.7, z: 0 } };
	for (let n = 0; n < 20000 && !civ.active(); n++) civ.update(cam);
	const R = civ.active().region;
	// (people: the town map says the Strip, and the Strip is busy at every hour, busiest late)
	const { townMapAt } = await import('../src/crysis/townmap.js');
	const { zoneOf, crowd, ZONE } = await import('../src/people/flow.js');
	assert.ok(R.strip?.length === 1, 'the Strip\'s frontage');
	const U = townMapAt(R, 437 + 30, 300), off = townMapAt(R, -1200, 300);
	assert.ok(U?.strip && U.u > 0.8 && zoneOf(U) === ZONE.strip, 'on the Strip');
	assert.ok(!off?.strip, 'and not the subdivisions across the freeway');
	for (const h of [0, 1, 21, 22.5, 23.5]) assert.ok(crowd(ZONE.strip, h, false).k > 0.75, `thronged at ${h}`);
	assert.ok(crowd(ZONE.strip, 15, false).k > 0.5 && crowd(ZONE.strip, 4, false).k > 0.35, 'busy by afternoon, never empty');
	assert.ok(crowd(ZONE.strip, 7, false).k < crowd(ZONE.strip, 22.5, false).k * 0.4, 'quietest at breakfast');
	assert.ok(crowd(ZONE.retail, 22.5, false).k < 0.1, '(a shopping street is shut by then)');
	const ppl = fs.readFileSync(new URL('../src/people/people.js', import.meta.url), 'utf8');
	assert.match(ppl, /zone === ZONE\.downtown \|\| zone === ZONE\.strip \? 1/);
	// (and they walk it: the boulevard's broad pavements, though it is no side street)
	assert.match(ppl, /const onFoot = \(q\) => \(q\.walked \|\| q\.strip \|\|/);
	assert.match(ppl, /band = road\.strip \?/);
	// (and far down it, by the hundred, round wherever you are on it: people/stripcrowd.js)
	const { createStripCrowd } = await import('../src/people/stripcrowd.js');
	const added = [], SC = createStripCrowd({ scene: { add: (g) => added.push(g) }, ground: () => 610 });
	SC.update(0.016, 1, { position: { x: 437, y: 2, z: 0 } }, R, 22.5);
	assert.ok(SC.info().pieces >= 1 && SC.info().walkers === 300 && added.length === 1, JSON.stringify(SC.info()));
	SC.update(0.016, 1, { position: { x: 437, y: 2, z: 0 } }, null, 22.5);
	assert.equal(SC.info().walkers, 0, 'gone with the town');
	assert.match(fs.readFileSync(new URL('../src/earth/globe.js', import.meta.url), 'utf8'), /stripCrowd\.update\(dt, t0 \/ 1000, cam, A\?\.region/);
	// (the resorts: casino, tower and garage one resort; the economy makes the casino a casino and the tower its hotel, by one name)
	const strip = (x, z) => Math.abs(x - 437) < 380 && z > -1500 && z < 1800;
	const on = R.boxes.filter((b) => strip(b.x, b.z) && b.resort);
	const casinos = on.filter((b) => b.kind === 6);
	assert.ok(casinos.length >= 10, `${casinos.length} casinos`);
	for (const c of casinos) assert.ok(Math.hypot(c.resort[0] - c.x, c.resort[1] - c.z) < 80, 'keyed by its own place');
	assert.ok(on.filter((b) => b.kind === 11).every((t) => casinos.some((c) => c.resort === t.resort)), 'each tower its casino\'s');
	const { describeBoxes, planTown } = await import('../src/economy/establishments.js');
	const D = describeBoxes(R.boxes.filter((b) => strip(b.x, b.z)));
	const plan = planTown(D, { locale: 'us' });
	const byKey = new Map();
	for (const E of plan) {
		const b = D[E.i];
		if (!b.resort) continue;
		assert.ok(E.type === (b.use === 'tower' ? 'resorthotel' : 'casino'), `${b.use} a ${E.type}`);
		assert.equal(E.venue, null, 'no shop fitted in a casino');
		const k = b.resort.join(',');
		if (byKey.has(k)) assert.equal(E.name, byKey.get(k), 'casino and tower one name'); else byKey.set(k, E.name);
	}
	assert.ok(byKey.size >= 10 && new Set(byKey.values()).size === byKey.size, 'each resort its own name');
	assert.ok(plan.filter((E) => D[E.i].resort).length === D.filter((b) => b.resort && (b.use === 'retail' || b.use === 'tower')).length, 'every one of them');
	// (the name in lights: across the casino's front, on its pylon both sides, across the tower's crown; all night)
	const layer = fs.readFileSync(new URL('../src/economy/layer.js', import.meta.url), 'utf8');
	assert.match(layer, /D\.use === 'retail' && E\.type === 'casino'/);
	assert.match(layer, /put\('pylon'/);
	assert.match(layer, /E\.type === 'resorthotel'/);
	assert.match(fs.readFileSync(new URL('../src/bay/lotkit.js', import.meta.url), 'utf8'), /S\.pylon = M\(/);
	const { hoursOf } = await import('../src/economy/frontage.js');
	assert.deepEqual(hoursOf({ type: 'casino', x: 1, z: 2 }), [0, 24]);
	// (the boulevard: the Strip by name, three lanes each way, nose to tail)
	assert.ok(R.roads.filter((q) => q.name === 'Las Vegas Boulevard').every((q) => q.strip === 1), 'the boulevard is the Strip');
	assert.ok(!R.roads.some((q) => q.strip && q.name !== 'Las Vegas Boulevard'));
	const sl = fs.readFileSync(new URL('../src/bay/streetlife.js', import.meta.url), 'utf8');
	assert.match(sl, /Math\.min\(3, Math\.floor\(\(half - 1\.2\) \/ 3\.5\)\)/, 'lanes side by side');
	assert.match(sl, /const nC = l\.strip \? Math\.min\(150, Math\.round\(\(u1 - u0\) \* l\.L \* l\.n \* 2 \/ 35\)\)/, 'a car every 35 m of each lane round you');
	assert.match(sl, /u: u0 \+ Math\.random\(\) \* \(u1 - u0\)/);
	assert.match(sl, /if \(\(c\.u \* L - l\.camS\) \* c\.dir > W\) \{ c\.u = /, 'and one gone off down it comes up it again');
});
