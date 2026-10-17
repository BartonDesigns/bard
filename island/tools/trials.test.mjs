// The trials of the hundredth (src/magic/trials.js) and your level's top (src/magic/skills.js):
// experience to 99 and no further, the first thirty levels as they were, the seven trials and
// what each reads, deeds done before 99 counting, each trial told once, the rite at a well at
// dusk or dawn, the hundredth's gifts, and what is kept between visits.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMagicState, saveMagic } from '../src/magic/spells.js';
import { sanitizeSkills, addXp, addUse, useFor, xpNeed, pointsOf, levelOf, takePerk, LEVEL_CAP, ASCENDED_LEVEL } from '../src/magic/skills.js';
import { TRIALS, RITE, ASCENDED_ATTRIBUTE, trialsOf, trialsOpen, trialsDone, riteBlock, ascend, countDeed, newlyDone } from '../src/magic/trials.js';
import { attributesOf, refreshStats, statSheet, ATTR_IDS } from '../src/magic/stats.js';

const fresh = (o = null) => sanitizeSkills(createMagicState(o));
// a state with every trial done but the rite, at 99
function ready() {
	const s = fresh({ v: 1, level: LEVEL_CAP, known: ['sunspark', 'tempest'], wells: Array.from({ length: 12 }, (_, k) => ({ key: 'w' + k, x: k, y: 0, z: 0, strand: 'light', seed: 1 })), deeds: { bosses: 3, spared: 25 } });
	for (const k of ['radiance', 'void', 'storm']) addUse(s, k, useFor(100));
	return s;
}
const GEAR = { weaponTop: 99, wornTop: 4 };

test('experience carries you to 99 and no further; the first thirty levels are as they were', () => {
	assert.equal(LEVEL_CAP, 99); assert.equal(ASCENDED_LEVEL, 100);
	for (let l = 1; l <= 30; l++) assert.equal(xpNeed(l), 100 + 35 * (l - 1), `level ${l} as before`);
	for (let l = 31; l < LEVEL_CAP; l++) assert.ok(xpNeed(l) - xpNeed(l - 1) > 35, `level ${l} steeper`);
	const total = Array.from({ length: LEVEL_CAP - 1 }, (_, k) => xpNeed(k + 1)).reduce((a, b) => a + b);
	assert.ok(total > 550000 && total < 650000, `a long climb (${total})`);
	const s = fresh();
	assert.equal(addXp(s, total + 1e6), LEVEL_CAP - 1, 'all the way to 99 at once');
	assert.equal(s.level, LEVEL_CAP); assert.equal(s.xp, 0, 'and nothing carried past it');
	assert.equal(addXp(s, 1e6), 0, 'at 99 experience no longer counts');
	assert.equal(s.level, LEVEL_CAP);
	assert.equal(pointsOf(s), LEVEL_CAP, 'a point a level');
	// an old save past 99 comes back at 99; the hundredth only stands on 99
	assert.equal(fresh({ v: 1, level: 400 }).level, LEVEL_CAP);
	assert.equal(fresh({ v: 1, level: 50, ascended: true }).ascended, false);
	assert.equal(fresh({ v: 1, level: LEVEL_CAP, ascended: true }).ascended, true);
});

test('seven trials, each read from what you have done', () => {
	assert.equal(TRIALS.length, 7);
	for (const t of TRIALS) assert.ok(t.name && t.glyph && t.desc.length > 20 && t.of > 0, t.id);
	const s = fresh();
	assert.ok(trialsOf(s, {}).every((t) => t.n === 0 && !t.done), 'a newcomer has done none');
	const R = ready();
	const rows = Object.fromEntries(trialsOf(R, GEAR).map((t) => [t.id, t]));
	assert.ok(Object.values(rows).every((t) => t.done), JSON.stringify(rows));
	assert.equal(trialsDone(R, { weaponTop: 98, wornTop: 3 }), 5, 'the gear trials read the gear');
	assert.equal(trialsOf(R, { weaponTop: 98 }).find((t) => t.id === 'heirloom').n, 98);
	// two schools mastered of three
	const two = fresh({ v: 1, level: LEVEL_CAP }); addUse(two, 'radiance', useFor(100)); addUse(two, 'void', useFor(100)); addUse(two, 'storm', useFor(99));
	assert.equal(trialsOf(two, {}).find((t) => t.id === 'mastery').n, 2);
	// rewind counts as well as tempest
	assert.equal(trialsOf(fresh({ v: 1, known: ['rewind'] }), {}).find((t) => t.id === 'twilight').done, true);
	// the fight's own record counts the deeds
	const d = fresh();
	assert.ok(countDeed(d, 'boss-slain') && countDeed(d, 'spare') && !countDeed(d, 'kill'));
	assert.deepEqual(d.deeds, { bosses: 1, spared: 1 });
});

test('the trials open at 99, deeds before then count, and each is told once', () => {
	const s = ready(); s.level = 98;
	assert.equal(trialsOpen(s), false);
	assert.match(riteBlock(s, GEAR), /open at level 99/);
	s.level = LEVEL_CAP;
	assert.equal(trialsOpen(s), true);
	assert.equal(newlyDone(s, GEAR).length, 7, 'the deeds done before 99 count');
	assert.deepEqual(newlyDone(s, GEAR), [], 'and are told once');
	const t = fresh({ v: 1, level: LEVEL_CAP });
	assert.deepEqual(newlyDone(t, {}), []);
	countDeed(t, 'boss-slain'); countDeed(t, 'boss-slain'); countDeed(t, 'boss-slain');
	assert.deepEqual(newlyDone(t, {}), ['giants']);
});

test('the rite: every trial done, then an aether well at dusk or dawn', () => {
	const s = ready();
	assert.match(riteBlock(s, { weaponTop: 50, wornTop: 4 }), /1 trial still to do/);
	assert.equal(riteBlock(s, GEAR), RITE, 'all done: the rite is what is left');
	assert.match(riteBlock(s, GEAR, { well: true, light: 0.6 }), /dusk or dawn/);
	assert.equal(ascend(s, GEAR, { well: true, light: 0.6 }), false, 'not at noon');
	assert.equal(ascend(s, GEAR, { well: false, light: 0.01 }), false, 'not away from a well');
	assert.equal(levelOf(s), LEVEL_CAP);
	const pts = pointsOf(s);
	assert.equal(ascend(s, GEAR, { well: true, light: 0.02 }), true, 'at a well, at dusk');
	assert.equal(levelOf(s), ASCENDED_LEVEL); assert.equal(s.level, LEVEL_CAP);
	assert.equal(pointsOf(s), pts + 1, 'a skill point');
	assert.match(riteBlock(s, GEAR, { well: true, light: 0 }), /already/);
	// five to every attribute
	refreshStats(s);
	const A = attributesOf(s), b = attributesOf(ready());
	for (const k of ATTR_IDS) assert.equal(A[k].total - b[k].total, ASCENDED_ATTRIBUTE, k);
	assert.ok(A.vigour.from.some((f) => f.label === 'The hundredth'));
	const sh = statSheet(s, { trial: GEAR });
	assert.equal(sh.level, 100); assert.equal(sh.ascended, true); assert.equal(sh.rite, null);
	// a perk taken with the hundredth's point stays on reload
	assert.ok(takePerk(s, 'hardy'));
});

test('the hundredth, the deeds and the told trials are kept between visits; rubbish is dropped', () => {
	const s = ready(); s.level = LEVEL_CAP;
	newlyDone(s, GEAR); ascend(s, GEAR, { well: true, light: 0 });
	const back = sanitizeSkills(createMagicState(JSON.parse(JSON.stringify(saveMagic(s)))));
	assert.equal(back.ascended, true); assert.equal(levelOf(back), 100);
	assert.deepEqual(back.deeds, { bosses: 3, spared: 25 });
	assert.equal(back.trials.length, 7);
	const junk = fresh({ v: 1, ascended: 'yes', deeds: { bosses: -4, spared: 'lots' }, trials: [7, 'mercy'] });
	assert.equal(junk.ascended, false); assert.deepEqual(junk.deeds, { bosses: 0, spared: 0 }); assert.deepEqual(junk.trials, ['mercy']);
});

test('the runtime counts, tells and makes the rite; the screens show it', () => {
	const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
	const idx = src('../src/magic/index.js');
	for (const k of ["countDeed(state, 'spare')", "countDeed(state, 'boss-slain')", 'if (m.well && rite(m)) return;', 'stepTrial(H.u)', 'stepTrial(g.u)', 'arms.trialMany', 'function tellTrials', 'hud?.ascend?.(', 'The trials of the hundredth are open']) assert.ok(idx.includes(k), k);
	assert.match(src('../src/magic/hud.js'), /function ascend\(pts\)/);
	assert.match(src('../src/magic/skills-ui.js'), /the trials of the hundredth/);
	const gear = src('../src/ui/gear.js');
	for (const k of ['function drawTrials', 'Trial for the hundredth', "'Earned by its trial'"]) assert.ok(gear.includes(k), k);
	assert.match(src('../src/crysis/arms-runtime.js'), /function trialMany\(steps\)/);
});
