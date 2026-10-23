// A big city out on the globe is built wherever its lights are (src/earth/globetowns.js): its
// districts round the centre are grown too, one where you stand, on a lattice of the city's own;
// the town you leave stands until the next is grown (src/crysis/civ.js); and by night its ground
// is lit from the air with streets and windows, never a flat wash under your feet
// (src/earth/globeterrain.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadAtlas } from '../src/earth/atlas.js';
import { setFrame, bayFrame, toXZ } from '../src/earth/globeframe.js';
import { createGlobeTowns } from '../src/earth/globetowns.js';

const PARIS = [48.8566, 2.3522];
const cam = (x, z, y = 1.7) => ({ position: { x, y, z } });
function towns(log = []) {
	const real = { addRegion: (r) => { log.push(['add', r.name]); return { r }; }, removeRegion: (h) => log.push(['remove', h.r.name]) };
	return createGlobeTowns({ real, heightAt: () => 40, water: () => null, director: null, skip: () => false, claim: () => false });
}

test('a big city\'s districts are listed round where you are, the same every time', async () => {
	await loadAtlas();
	setFrame(...PARIS);
	try {
		const c = toXZ(...PARIS);
		// 9 km out from the middle of Paris: well past its centre's reach, still in its lights
		const at = cam(c.x + 7000, c.z - 5500);
		const T = towns();
		T.update(at);
		const parisT = T.towns.filter((t) => t.city.name === 'Paris');
		const core = parisT.find((t) => !t.district), districts = parisT.filter((t) => t.district);
		assert.ok(core, 'the centre is there');
		assert.ok(districts.length >= 6, `${districts.length} districts round you`);
		// none inside the centre's own reach, none far from you
		for (const d of districts) {
			assert.ok(Math.hypot(d.x - core.x, d.z - core.z) > core.r * 0.85);
			assert.ok(Math.hypot(d.x - at.position.x, d.z - at.position.z) <= 9001);
			assert.equal(d.ang, core.ang);
		}
		// the town you would grow here is a district, and you are well inside it
		const reach = (t) => t.r * 1.3 + 150, dist = (t) => Math.hypot(t.x - at.position.x, t.z - at.position.z);
		const best = T.towns.reduce((a, b) => (dist(b) - reach(b) < dist(a) - reach(a) ? b : a));
		assert.ok(best.district, 'a district, not the far centre');
		assert.ok(dist(best) < best.r * 0.8, `${Math.round(dist(best))} m from its middle (reach ${best.r})`);
		// the same lattice from another scan nearby
		const T2 = towns();
		T2.update(cam(at.position.x + 400, at.position.z + 300));
		const key = (t) => Math.round(t.x) + ',' + Math.round(t.z);
		assert.ok(T2.towns.some((t) => key(t) === key(best)), 'the same district from a few hundred metres off');
		// its lights for the sky over you
		assert.ok(T.glowAt(at.position.x, at.position.z) > 0.3);
		assert.equal(T.urbanAt(at.position.x, at.position.z), 0, 'no town light where nothing is grown yet');
	} finally { bayFrame(); }
});

test('the district round you grows, and the one you leave stands until the next is grown', async () => {
	await loadAtlas();
	setFrame(...PARIS);
	try {
		const c = toXZ(...PARIS), log = [];
		const T = towns(log);
		const here = cam(c.x + 7000, c.z - 5500);
		T.update(here);
		assert.equal(T.pending(), true, 'you stand in a district not yet grown');
		for (let n = 0; n < 4000 && !T.civ().active(); n++) T.update(here);
		const A = T.civ().active();
		assert.ok(A?.town.district, 'a district stands round you');
		assert.equal(T.pending(), false);
		assert.ok(T.urbanAt(here.position.x, here.position.z) > 0.3, 'its own light by night');
		assert.deepEqual(log, [['add', 'Paris']]);
		// a rescan makes the list again: the same town is kept, not taken down and put back
		T.update(cam(here.position.x + 3100, here.position.z));
		T.update(here);
		assert.equal(T.civ().active(), A);
		assert.equal(log.length, 1);
		// on to the next district: the first stands while the next grows, then gives way to it
		const reach = (t) => t.r * 1.3 + 150;
		const next = T.towns.filter((t) => t.district && t !== A.town && Math.hypot(t.x - A.town.x, t.z - A.town.z) < A.town.r * 1.6)[0];
		assert.ok(next, 'a neighbouring district');
		const there = cam(next.x, next.z);
		T.update(there);
		T.update(there);
		assert.ok(T.civ().busy(), 'the next is growing');
		assert.equal(T.civ().active(), A, 'the first still stands');
		for (let n = 0; n < 4000 && T.civ().active() === A; n++) T.update(there);
		assert.ok(Math.hypot(T.civ().active().town.x - next.x, T.civ().active().town.z - next.z) < 1);
		assert.deepEqual(log.slice(1), [['remove', 'Paris'], ['add', 'Paris']]);
		assert.ok(reach(next) > 0);
	} finally { bayFrame(); }
});

test('by night a far city is lit from the air, and gives way to the town round you', () => {
	const g = fs.readFileSync(new URL('../src/earth/globeterrain.js', import.meta.url), 'utf8');
	const block = g.slice(g.indexOf('float litK'), g.indexOf('gCityGlow = (lamp'));
	// (never on woods or snow, and faded out round you when you are down among the town)
	assert.match(block, /litK = uGNight \* smoothstep\(0\.1, 0\.6, urb\) \* \(1\.0 - forest\) \* \(1\.0 - snowK\) \* smoothstep\(uGLitNear\.x, uGLitNear\.y, dist\)/);
	// (streets and main roads as lines that settle to their mean far off: no 100 m checkerboard)
	assert.match(block, /gVor\(2, 83u, sid\)/);
	assert.match(block, /gLine\(se, 3\.5, px\)/);
	assert.doesNotMatch(g, /step\(0\.55, blk\)\) \* 0\.35/);
	// how high you are sets how near the glow comes
	assert.match(g, /const lk = THREE\.MathUtils\.smoothstep\(agl, 400, 2000\);\n\t\tcommon\.uGLitNear\.value\.set\(1500 \* \(1 - lk\), 4000 \* \(1 - lk\) \+ 1\);/);
});

test('a jump far off works the water again from the ground under the new place', async () => {
	const { proceduralWater } = await import('../src/crysis/rivers.js');
	const gen = proceduralWater({ heightAt: (x, z) => 60 + 40 * Math.sin(x / 900) * Math.cos(z / 700) - z / 400, inSurvey: () => false });
	const x = -400000, z = 0;
	for (let n = 0; n < 2000 && !gen.readyAt(x, z, 10); n++) gen.pump(x, z, 10, 50);
	assert.ok(gen.readyAt(x, z, 10), 'the water of the first place is worked');
	const v = gen.version();
	gen.reframe();
	assert.equal(gen.readyAt(x, z, 10), false, 'the same engine metres are other ground now: worked again');
	assert.equal(gen.lakes.length, 0);
	assert.ok(gen.version() > v, 'the water drawn from it hears of it');
	// (earth/globe.js moves the frame on a jump and on a far rebase; bay/water.js lets go of its ribbons and carving)
	const g = fs.readFileSync(new URL('../src/earth/globe.js', import.meta.url), 'utf8');
	// (a jump, and a far place rebased as you travel on: its ground moves under the same metres too)
	assert.match(g, /function reframe\(bayBack\) \{[\s\S]{0,800}towns\.reset\(\); world\(\)\?\.water\?\.reframe\?\.\(\);/);
	assert.match(g, /if \(moved\) world\(\)\?\.water\?\.reframe\?\.\(\);/);
	const w = fs.readFileSync(new URL('../src/bay/water.js', import.meta.url), 'utf8');
	assert.match(w, /reframe\(\) \{[\s\S]{0,400}S\.tiles\.clear\(\);[\s\S]{0,200}atlas\.drop\(/);
});
