// Lance of Dawn's volley (src/magic/lances.js): what mastery makes of it, where the spears come
// from, how they dive, and how a volley's harm is shared.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANCE_MASTERY, LANCE_OVERLAP, lanceShape, lanceSky, lanceVolley, lanceFlight, lanceStrikes, lanceShare, LANCE_LOW, LANCE_STEEP, SUMMON, FLIGHT } from '../src/magic/lances.js';
import { SPELL, shaped } from '../src/magic/spells.js';
import { MASTERY_GIFT } from '../src/magic/perks.js';

const lance = SPELL['lance-of-dawn'];
const half = () => 0.5;

test('every level of mastery makes it more: more lances, greater, wider, winged, and at V a heart', () => {
	const S = [1, 2, 3, 4, 5].map((L) => lanceShape(lance, L));
	assert.deepEqual(S.map((s) => s.n), [3, 3, 4, 4, 5]);
	for (let i = 1; i < 5; i++) {
		assert.ok(S[i].r > S[i - 1].r, 'wider at ' + (i + 1));
		assert.ok(S[i].size > S[i - 1].size, 'greater at ' + (i + 1));
		assert.ok(S[i].wing > S[i - 1].wing, 'its wings grow at ' + (i + 1));
		assert.ok(S[i].falloff <= S[i - 1].falloff, 'the rim forgives as much or more at ' + (i + 1));
	}
	assert.equal(S[0].wing, 0, 'no wings at I');
	assert.deepEqual(S.map((s) => s.heart), [false, false, false, false, true]);
	assert.deepEqual(S.map((s) => s.burst), [false, false, false, true, true]);
	assert.ok(S[4].r >= lance.r * 1.6, 'full mastery strikes far wider');
	assert.equal(lanceShape(lance, 9).level, 5, 'bounded');
	assert.equal(lanceShape(lance, 0).level, 1, 'bounded');
	assert.equal(LANCE_MASTERY.length, 5);
	for (const L of [2, 3, 4, 5]) assert.ok(MASTERY_GIFT['lance-of-dawn'][L]?.name, 'the menu says what level ' + L + ' brings');
});

test('the perks show in it: a wider area, a longer reach, a hotter power', () => {
	const wide = shaped(lance, { area: { radiance: 0.25 } }), far = shaped(lance, { range: { radiance: 0.3 } });
	assert.ok(lanceShape(wide, 3).r > lanceShape(lance, 3).r, 'area perks widen every strike');
	assert.ok(lanceShape(far, 3, 1, lance.range).reach > 1.25, 'range perks call them from further');
	assert.equal(lanceShape(lance, 3, 1, lance.range).reach, 1);
	assert.ok(lanceShape(lance, 3, 1.6).heat > lanceShape(lance, 3, 1).heat, 'more power burns hotter');
	const sky = lanceSky({ x: 0.4, y: 0.7, z: 0.2 }, null);
	const near = lanceVolley({ x: 0, z: 0 }, lanceShape(lance, 3, 1, lance.range), sky, half)[0], further = lanceVolley({ x: 0, z: 0 }, lanceShape(far, 3, 1, lance.range), sky, half)[0];
	assert.ok(further.from > near.from, 'from further out along the line to the sky');
	const hot = lanceVolley({ x: 0, z: 0 }, lanceShape(lance, 3, 1.8), sky, half)[0];
	assert.ok(hot.thick > near.thick && hot.len > near.len, 'a hotter lance is a heavier one');
});

test('the volley: round the aim, closer and surer with mastery; the heart on the very mark', () => {
	const sky = lanceSky({ x: 0.3, y: 0.8, z: 0.1 }, null);
	for (const L of [1, 2, 3, 4, 5]) {
		const S = lanceShape(lance, L), V = lanceVolley({ x: 10, z: -4 }, S, sky, half);
		assert.equal(V.length, S.n);
		for (const v of V) assert.ok(Math.hypot(v.x - 10, v.z + 4) <= S.spread * 1.13, 'round the aim');
		const over = V.filter((v) => Math.hypot(v.x - 10, v.z + 4) <= v.r).length;
		assert.ok(over >= (L >= 3 ? S.n : 1), `the mark itself is struck at ${L} (${over} of ${S.n})`);
		// (they fall one after another)
		for (let i = 1; i < V.length; i++) assert.ok(V[i].wait > V[i - 1].wait);
	}
	const V = lanceVolley({ x: 10, z: -4 }, lanceShape(lance, 5), sky, half), heart = V[V.length - 1];
	assert.ok(heart.heart && heart.x === 10 && heart.z === -4, 'the heart strikes the very mark, last');
	assert.ok(heart.len > V[0].len && heart.r > V[0].r, 'the greatest of them');
});

test('out of the sun on a slant, never straight down; the moon by night; over your shoulder at noon', () => {
	const el = (d) => Math.asin(d.y);
	const low = lanceSky({ x: 1, y: 0.1, z: 0 }, null), high = lanceSky({ x: 0.05, y: 1, z: 0.02 }, null, { x: 0, z: 1 });
	assert.ok(el(low.dir) >= LANCE_LOW - 1e-9 && el(high.dir) <= LANCE_STEEP + 1e-9, 'held between low and steep');
	assert.ok(low.dir.x > 0.4, 'toward the sun');
	assert.ok(high.dir.z > 0.4, 'the sun overhead: from behind you');
	assert.equal(lanceSky(null, { x: 0, y: 0.6, z: -0.8 }).night, true);
	assert.equal(lanceSky({ x: 0, y: -0.2, z: 1 }, { x: 0, y: 0.6, z: -0.8 }).night, true, 'the sun down, the moon up');
	assert.ok(lanceSky({ x: 0, y: -0.2, z: 1 }, { x: 0, y: 0.6, z: -0.8 }).dir.z < 0, 'out of the moon');
	for (const s of [low, high]) assert.ok(Math.abs(Math.hypot(s.dir.x, s.dir.y, s.dir.z) - 1) < 1e-9);
});

test('the dive eases in like a missile: slow far out, faster and faster, then the blow', () => {
	const L = { wait: 0.2, from: 110 };
	assert.equal(lanceFlight(L, 0.1).stage, 'wait');
	assert.equal(lanceFlight(L, 0.2 + SUMMON * 0.5).stage, 'summon');
	assert.equal(lanceFlight(L, lanceStrikes(L) + 0.01).stage, 'struck');
	const at = (u) => lanceFlight(L, 0.2 + SUMMON + FLIGHT * u);
	assert.ok(110 - at(0.5).d < 110 * 0.4, 'the first half of the dive covers well under half the way');
	let d = 111, v = -1;
	for (let u = 0; u < 1; u += 0.05) { const f = at(u); assert.ok(f.d < d, 'always nearer'); assert.ok(f.v >= v, 'always faster'); d = f.d; v = f.v; }
	assert.ok(at(0.97).v > 150, 'it lands hard');
});

test('more lances make the volley surer, not a heavier blow on one spot', () => {
	const S = lanceShape(lance, 5), V = lanceVolley({ x: 0, z: 0 }, S, lanceSky({ x: 0.3, y: 0.8, z: 0 }), half), ring = V[0];
	assert.equal(lanceShare(S, ring, 0), 1);
	assert.equal(lanceShare(S, ring, ring.r + 0.1), 0, 'out of its reach');
	assert.ok(Math.abs(lanceShare(S, ring, 0, 1) - LANCE_OVERLAP) < 1e-9, 'a second lance on the same one');
	assert.ok(lanceShare(S, ring, ring.r) > lanceShare(lanceShape(lance, 1), { ...ring, heart: false }, ring.r), 'the rim forgives more at V');
	// (one standing on the mark through the whole volley at V: under twice what one lance does)
	let total = 0;
	V.forEach((v, i) => { total += lanceShare(S, v, Math.hypot(v.x, v.z), i); });
	assert.ok(total > 1 && total < 2.2, 'all five on the mark: ' + total.toFixed(2));
	const src = fs.readFileSync(new URL('../src/magic/caster.js', import.meta.url), 'utf8');
	assert.match(src, /lanceShare\(S, P, x\.d, before\)/, 'the caster shares the harm so');
	assert.match(src, /masteryLevel\(state\.mastery\?\.\[spell\.id\]/, 'the caster reads the spell\'s mastery');
});
