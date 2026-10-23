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

test('the Strip: its resorts, the wheel, the tower, the sign and Fremont Street, each built and lit', () => {
	const names = VEGAS.map((e) => e[0]).join(' / ');
	for (const want of ['Welcome to Fabulous Las Vegas', 'Luxor', 'Bellagio', 'Caesars', 'Paris Las Vegas', 'New York-New York', 'High Roller', 'Venetian', 'Sphere', 'Wynn', 'Strat', 'Fremont Street']) assert.ok(names.includes(want), want);
	const idx = fs.readFileSync(new URL('../src/region/index.js', import.meta.url), 'utf8');
	for (const [name, , , type, sc, , about, args] of VEGAS) {
		assert.ok(REAL_BUILD[type], name + ' has a builder');
		assert.match(idx, new RegExp('\\b' + type + ': \\d+'), name + ' keeps its ground clear');
		assert.ok(about.length > 20, name + ' has a tale');
		const b = B();
		REAL_BUILD[type](b, sc, args, () => 0.5, (x) => 0.002 * x);
		assert.ok(b.G.p.length > 0 && finite(b.G) && finite(b.glow) && finite(b.night), name + ' built');
		assert.ok(b.glow.p.length + b.night.p.length > 0, name + ' is lit by night');
		assert.ok(b.solid.length > 0, name + ' stands in your way');
	}
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
	// (on the boulevard: none more than a kilometre off it, the Sphere and Fremont aside)
	for (const e of VEGAS) if (!/Sphere|Fremont|Strat/.test(e[0])) assert.ok(Math.abs(e[2] + 115.172) < 0.01, e[0]);
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
	const keepAt = [{ x: 300, z: -200, r: 170 }, { x: -450, z: 350, r: 230 }];
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

test('in the desert a closed basin is a dry pan, not a lake', async () => {
	const { proceduralWater } = await import('../src/crysis/rivers.js');
	// (a bowl of a valley, its floor well below its rim all round)
	const heightAt = (x, z) => 600 + Math.hypot(x + 400000, z) ** 2 / 20000 + 8 * Math.sin(x / 300) * Math.cos(z / 260);
	const lakes = (arid) => {
		const gen = proceduralWater({ heightAt, inSurvey: () => false, arid: () => arid });
		for (let n = 0; n < 4000 && !gen.readyAt(-400000, 0, 10); n++) gen.pump(-400000, 0, 10, 50);
		assert.ok(gen.readyAt(-400000, 0, 10));
		return gen.lakes.length;
	};
	assert.ok(lakes(false) > 0, 'a lake where it rains');
	assert.equal(lakes(true), 0, 'none in the desert');
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
