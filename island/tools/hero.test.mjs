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
	assert.ok(m.muscle > 0.25 && m.muscle < 0.45 && f.muscle > 0.15 && m.weight < 0.1 && f.weight < 0.1, 'lean, not inflated');
	assert.ok(m.temper.confident > 0.9 && m.gait.posture < 0, 'chest up');
	assert.equal(m.age, 29);
	// (no feature pushed far: a face near the base mesh's even average, which reads handsome)
	for (const d of [m, f]) for (const [k, v] of Object.entries(d.face)) assert.ok(Math.abs(v) <= 0.45, `${k} ${v}`);
	assert.ok(m.face.jaw > 0.2 && m.face['brow-ridge'] > 0.1, 'his jaw and brow');
	assert.ok(f.face.cheekbones > 0.3 && f.face['lower-lip'] > 0.15 && f.face.jaw < 0, 'her cheekbones and lips');
	// (dressed to move in, groomed, and never grey)
	for (const d of [m, f]) { assert.notEqual(d.style.outer.fab, 'leather', 'matte, nothing shiny to balloon'); assert.equal(d.style.bottom.kind, 'cargo', 'trousers with room, not leggings'); }
	assert.equal(m.style.shoes.kind, 'boot');
	assert.equal(f.style.shoes.kind, 'boot');
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
});
