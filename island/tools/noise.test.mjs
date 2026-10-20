// noise.js holds the seeded random and the small maths that most of the world is grown
// from (mulberry32, smoothstep, clamp, lerp, sineHash, wrapAngle). The modules that used to
// keep their own copies now import these, so a change here moves every generated world at
// once: these values pin what they give today.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, smoothstep, clamp, lerp, sineHash, wrapAngle } from '../src/noise.js';
import { hash as rideHash } from '../src/bay/rides/kit.js';
import { rng as synthRng } from '../src/audio/synth.js';
import { rng as bodyRng } from '../src/people/body.js';
import { rng as signRng } from '../src/signage/rand.js';
import { rng as planRng } from '../src/interiors/plan.js';
import { seeded } from '../src/combat/outfits.js';
import { seededRandom } from '../src/people/gatherings.js';

// each draw is a whole number of 2^-32, so the sequence can be pinned exactly
const draws = (seed, n = 4) => { const r = mulberry32(seed); return Array.from({ length: n }, () => r() * 4294967296); };

test('mulberry32 gives the same sequence it always has', () => {
	assert.deepEqual(draws(0), [1144304738, 1416247, 958946056, 627933444]);
	assert.deepEqual(draws(1), [2693262067, 11749833, 2265367787, 4213581821]);
	assert.deepEqual(draws(1337), [792042790, 815997621, 3480950701, 2764880138]);
	assert.deepEqual(draws(4294967295), [3850105811, 813802916, 3073704848, 4054706436]);
	// seeds wrap to 32 bits, as the old copies did
	assert.deepEqual(draws(4294967296 + 1337), draws(1337));
	assert.deepEqual(draws(-1), draws(4294967295));
});

test('mulberry32 stays in [0, 1)', () => {
	const r = mulberry32(99);
	for (let i = 0; i < 20000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});

test('the modules that kept their own generator now share this one', () => {
	for (const f of [synthRng, bodyRng, signRng, planRng, seeded, seededRandom]) assert.equal(f, mulberry32);
});

test('smoothstep, clamp and lerp', () => {
	assert.equal(smoothstep(0, 1, 0.25), 0.15625);
	assert.equal(smoothstep(0, 1, 0.5), 0.5);
	assert.equal(smoothstep(2, 4, 3.5), 0.84375);
	assert.equal(smoothstep(0, 1, -3), 0);
	assert.equal(smoothstep(0, 1, 9), 1);
	// reversed edges fall instead of rise
	assert.equal(smoothstep(1, 0, 0.25), 0.84375);
	assert.equal(clamp(5, 0, 2), 2);
	assert.equal(clamp(-5, 0, 2), 0);
	assert.equal(clamp(1.5, 0, 2), 1.5);
	assert.equal(lerp(2, 6, 0.25), 3);
});

test('the sine hash and the angle wrap', () => {
	assert.equal(sineHash(0, 0), 0);
	assert.equal(sineHash(1, 2), 0.48287847430947295);
	assert.equal(sineHash(-3.5, 7.25), 0.8654398436192423);
	for (let i = 0; i < 2000; i++) { const v = sineHash(i * 0.37 - 200, i * 1.91); assert.ok(v >= 0 && v < 1); }
	assert.equal(rideHash, sineHash);
	assert.equal(wrapAngle(0), 0);
	assert.equal(wrapAngle(2), 2);
	assert.equal(wrapAngle(Math.PI * 3), 3.1415926535897927);
	assert.equal(wrapAngle(-7), -0.7168146928204135);
});
