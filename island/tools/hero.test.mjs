// Your hero (people/hero.js): two bodies made by hand, a man and a woman, carried to friends
// in the seed alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HERO_TAG, heroSeed, heroOf, heroDNA, lookDNA, heroChoice, setHeroChoice } from '../src/people/hero.js';
import { personDNA } from '../src/people/body.js';
import { cleanLook } from '../src/net/protocol.js';

test('a hero is a seed of its own, which the room passes on as it is', () => {
	for (const sex of ['male', 'female']) {
		const s = heroSeed(sex);
		assert.equal(heroOf(s), sex);
		assert.equal(cleanLook({ seed: s }).seed, s, 'the room keeps it');
		assert.equal(heroOf(cleanLook({ seed: s }).seed), sex);
	}
	// (every seed a townsperson or an older visit was given is below 2^31: never a hero)
	for (let i = 0; i < 2000; i++) assert.equal(heroOf((Math.random() * 2 ** 31) >>> 0), null);
	assert.equal(heroOf(HERO_TAG), null);
	assert.equal(heroOf(HERO_TAG | 9), null);
});

test('he and she are tall, athletic, sure of themselves, and look it', () => {
	const m = heroDNA('male'), f = heroDNA('female');
	assert.ok(m.male && m.sex > 0.9 && !f.male && f.sex < 0.1);
	assert.ok(m.height > 1.8 && f.height > 1.68, 'tall');
	assert.ok(m.muscle > 0.3 && m.muscle < 0.5 && f.muscle > 0.15 && m.weight < 0.1 && f.weight < 0.1, 'athletic, not inflated');
	assert.ok(m.temper.confident > 0.9 && m.gait.posture < 0, 'chest up');
	assert.equal(m.age, 29);
	// (no feature pushed far: a face near the base mesh's even average, which reads handsome)
	for (const d of [m, f]) for (const [k, v] of Object.entries(d.face)) assert.ok(Math.abs(v) <= 0.45, `${k} ${v}`);
	assert.ok(m.face.jaw > 0.2 && m.face['brow-ridge'] > 0.1, 'his jaw and brow');
	assert.ok(f.face.cheekbones > 0.3 && f.face['lower-lip'] > 0.15 && f.face.jaw < 0, 'her cheekbones and lips');
	// (dressed to move in, groomed, and never grey)
	assert.equal(m.style.outer, null, 'no jacket to balloon on him');
	assert.equal(f.style.outer.kind, 'flannel'); assert.equal(f.style.outer.pat, 'plaid'); assert.equal(f.style.outer.fit, 'oversized', 'a big flowing plaid shirt');
	for (const d of [m, f]) { assert.ok(d.style.bottom.hang > 0.02 && d.style.bottom.tuck && d.style.shoes.tall, 'rugged trousers into tall boots'); assert.equal(d.style.bottom.kind, 'cargo', 'trousers with room, not leggings'); }
	assert.equal(m.style.shoes.kind, 'boot');
	assert.ok(m.style.acc.some((q) => q.kind === 'carrier') && m.style.acc.some((q) => q.kind === 'gloves'), 'his carrier and gloves');
	assert.ok(m.build.shoulders > f.build.shoulders && m.build.waist > 0 && f.build.waist > 0, 'the V');
	assert.equal(f.style.shoes.kind, 'boot');
	const src0 = fs.readFileSync(new URL('../src/people/garment.js', import.meta.url), 'utf8');
	assert.match(src0, /B\.tuck \? cut\.ankle \+ 0\.14/, 'trousers end at the boots');
	assert.match(src0, /F\.tall \? 0\.17 : 0\.09/, 'tall boots');
	assert.match(src0, /const legHang = B\?\.hang/, 'a straight hang');
	assert.equal(m.style.hair.style, 'short01');
	assert.equal(m.style.hair.beard, 'stubble');
	assert.equal(f.style.hair.style, 'ponytail01');
	assert.equal(f.style.hair.beard, '');
	assert.equal(m.style.hair.recede, 0);
	assert.ok(m.greyShift < 0);
	// (the same every time)
	assert.deepEqual(heroDNA('female'), heroDNA('female'));
});

test('a friend is drawn as their hero, or as the townsperson an older visit made them', () => {
	assert.equal(lookDNA(heroSeed('female')).hero, 'female');
	assert.deepEqual(lookDNA(1234), personDNA(1234, { age: 30 }));
});

test('the choice is kept, and your seed with it', () => {
	const m = new Map(), st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
	assert.equal(heroChoice(st), 'male', 'a man until chosen');
	assert.equal(setHeroChoice('female', st), 'female');
	assert.equal(heroChoice(st), 'female');
	assert.equal(+m.get('l99-me'), heroSeed('female'));
	assert.equal(setHeroChoice('wizard', st), 'male');
});

test('your body, its hands, friends and the settings all use the hero', () => {
	const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
	assert.match(src('people/avatar.js'), /buildPerson\(A, heroDNA\(h\)\)/);
	assert.match(src('people/avatar.js'), /async function setHero\(sex\)/);
	assert.match(src('net/remotes.js'), /lookDNA\(r\.seed\)/);
	assert.match(src('net/multiplayer.js'), /const seed = heroSeed\(heroChoice\(\)\)/);
	assert.match(src('crysis/viewmodel.js'), /arms\.me !== avatar\.me/, 'the gun hands made again');
	assert.match(src('main.js'), /'Your hero'/);
	assert.match(src('people/self.js'), /hero \? 'ready' : 'rest'/, 'they stand ready');
	assert.match(src('people/motion.js'), /ready: \{ both: arm/);
});

test('a build broadens the shoulders, carries the arms out whole, and draws the waist in', async () => {
	const { shapeBuild } = await import('../src/people/build.js');
	// four vertices on a body 2 high: an arm's (all upper arm), the chest's middle, the chest's
	// side, the waist's side; the feet and the head mark the height
	const A = { bones: [{ name: 'spine01' }, { name: 'upperarm01.L' }], ids: new Uint8Array(24), weights: new Uint16Array(24) };
	const at = [[0.4, 1.5, 0], [0, 1.55, 0.1], [0.2, 1.55, 0.05], [0.15, 1.17, 0.1], [0, 0, 0], [0, 2, 0]];
	const p = Float32Array.from(at.flat());
	for (let v = 0; v < 6; v++) { A.ids[v * 4] = v === 0 ? 1 : 0; A.weights[v * 4] = 1000; }
	shapeBuild(p, A, { shoulders: 0.02, waist: 0.1 });
	assert.ok(Math.abs(p[0] - (0.4 + 0.04)) < 1e-6, 'the arm out whole, by 2% of the height');
	assert.ok(Math.abs(p[3]) < 1e-6, 'the middle of the chest stays');
	assert.ok(p[6] > 0.2 + 0.03, 'the side of the chest out with the shoulders');
	assert.ok(p[9] < 0.15 * 0.95 && p[11] < 0.1, 'the waist drawn in');
	assert.ok(p[13] === 0 && p[16] === 2, 'its height kept');
	const q = Float32Array.from(at.flat());
	shapeBuild(q, A, null);
	assert.deepEqual([...q], at.flat().map(Math.fround), 'no build, no change');
});
