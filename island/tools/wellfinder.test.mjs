import test from 'node:test';
import assert from 'node:assert/strict';
import { surveyWells, riteSite } from '../src/magic/wellfinder.js';
import { wellAt, WELL_BACK } from '../src/magic/aether.js';
import { createMagicState, saveMagic } from '../src/magic/spells.js';
import { sanitizeSkills, useFor, pointsOf } from '../src/magic/skills.js';
import { ascend, riteBlock } from '../src/magic/trials.js';

const heightAt = () => 10, position = { x: 0, y: 11.3, z: 0 }, seed = 1337, now = 10000000;
const survey = (args = {}) => surveyWells({ position, seed, heightAt, light: 0, now, ...args });
test('wellfinder lists real deterministic wells, distance sorted with bounded terrain sampling', () => {
	let reads = 0;
	const list = survey({ heightAt: () => { reads++; return 10; } });
	assert.ok(list.length > 0); assert.ok(reads <= 50);
	assert.deepEqual(list, survey());
	for (let n = 0; n < list.length; n++) {
		const w = list[n], [i, j] = w.key.split(':')[1].split(',').map(Number);
		assert.equal(wellAt(i, j, seed, heightAt).key, w.key);
		assert.match(w.bearing, /^(N|NE|E|SE|S|SW|W|NW)$/);
		if (n) assert.ok(w.distance >= list[n - 1].distance);
	}
});
test('no destinations are invented for absent players, invalid worlds or underwater ground', () => {
	for (const args of [{ position: null }, { seed: null }, { seed: NaN }, { heightAt: null }, { heightAt: () => NaN }, { heightAt: () => -1 }]) assert.deepEqual(survey(args), []);
});
test('reach requires the player on the well floor, not directly above or below it', () => {
	const w = survey()[0], p = { x: w.x, y: w.y + 0.9, z: w.z };
	assert.equal(riteSite(survey({ position: p })).key, w.key);
	for (const y of [p.y + 20, p.y - 20]) assert.equal(riteSite(survey({ position: { ...p, y } })), null);
	assert.equal(riteSite(survey({ position: { ...p, x: p.x + 10 } })), null);
});
test('depleted well remains a valid rite site without granting fabric or resetting cooldown', () => {
	const w = survey()[0], p = { x: w.x, y: w.y + 0.9, z: w.z };
	const gathered = { [w.key]: now - 1000 }, before = JSON.stringify(gathered);
	const list = survey({ position: p, gathered, wells: [w] }), site = riteSite(list);
	assert.equal(site.key, w.key); assert.equal(site.waitMs, WELL_BACK - 1000); assert.equal(site.discovered, true);
	assert.equal(JSON.stringify(gathered), before);
	const s = sanitizeSkills(createMagicState({ v: 1, level: 99, known: ['tempest'], gathered, wells: Array.from({ length: 12 }, (_, i) => ({ ...w, key: `w${i}` })), deeds: { bosses: 3, spared: 25 }, use: Object.fromEntries(['radiance', 'void', 'storm'].map(k => [k, useFor(100)])) }));
	const ctx = { weaponTop: 99, wornTop: 5 }, fabric = { ...s.fabric }, points = pointsOf(s);
	assert.match(riteBlock(s, ctx, { well: true, light: 0.7 }), /dusk or dawn/);
	assert.match(riteBlock(s, { ...ctx, wornTop: 4 }, { well: true, light: 0 }), /trial/);
	assert.equal(ascend(s, ctx, { well: !!site, light: 0 }), true);
	assert.equal(ascend(s, ctx, { well: !!site, light: 0 }), false);
	assert.deepEqual(s.fabric, fabric); assert.equal(JSON.stringify(s.gathered), before);
	const restored = sanitizeSkills(createMagicState(saveMagic(s)));
	assert.equal(restored.ascended, true); assert.equal(pointsOf(restored), points + 1);
});
test('day/night availability and discovery reflect live state without modifying it', () => {
	for (const light of [-0.5, 0, 0.5]) for (const w of survey({ light })) assert.equal(w.visible, light === 0 || (light > 0 ? w.strand === 'light' : w.strand === 'dark'));
	const other = survey({ seed: seed + 1 });
	assert.ok(other.every(w => !survey().some(a => a.key === w.key)));
});
test('touching distance uses the gathering floor, without surveying distant collisions', () => {
	const w = survey()[0]; let queries = 0;
	const ground = () => { queries++; return 30; };
	const list = survey({ position: { x: w.x, y: 31.3, z: w.z }, ground });
	assert.equal(riteSite(list)?.key, w.key);
	assert.equal(queries, 1);
	assert.equal(riteSite(survey({ position: { x: w.x, y: 11.3, z: w.z }, ground })), null);
});
