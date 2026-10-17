// Skills (src/magic/skills.js): every page's constellation whole, levels and skill points, ranks
// rising with use, what a perk takes, and what the perks add up to on the spells' rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPELLS, SPELL, SCHOOLS, createMagicState, saveMagic, weave, weaveBlock, gather, spellPower, manaCost, manaMax, manaRegen, cooldownOf, shaped } from '../src/magic/spells.js';
import { PAGES, SKILL, LAYOUT, PERKS, PERK, pageNodes, pageLinks, rankOf, useFor, rankFrac, xpNeed, pointsOf, addXp, addUse, perkBlock, takePerk, sanitizeSkills, computeMods, fxLines, spellBlock, isUltimate, ULTIMATE_RANK, MASTERY, MASTERY_POWER, masteryLevel, masteryFrac, masteryToNext, addMastery, feedSpell, feedable, feedCost } from '../src/magic/skills.js';

const fresh = () => sanitizeSkills(createMagicState());

test('every page is a whole constellation: its spells placed, its perks hung from what is on the page', () => {
	assert.equal(PAGES.length, Object.keys(SCHOOLS).length + 3);
	const ids = new Set(SPELLS.map((s) => s.id));
	for (const p of PERKS) { assert.ok(!ids.has(p.id), 'unique ' + p.id); ids.add(p.id); }
	for (const k of PAGES) {
		assert.ok(SKILL[k] && LAYOUT[k], k);
		assert.match(LAYOUT[k].fig, /^M[\d. MLCAZQ-]+$/i, k + ' figure');
		const nodes = pageNodes(k), here = new Set(nodes.map((n) => n.id));
		assert.ok(nodes.length >= 4, k + ' has stars');
		for (const s of SPELLS.filter((q) => q.school === k)) assert.ok(LAYOUT[k].spells[s.id], `${s.id} placed on ${k}`);
		for (const n of nodes) {
			assert.ok(n.at[0] >= 4 && n.at[0] <= 96 && n.at[1] >= 4 && n.at[1] <= 96, `${n.id} inside its page`);
			for (const q of n.parents) assert.ok(here.has(q), `${n.id} hangs from ${q} on the same page`);
		}
		// no two stars on top of one another
		for (const a of nodes) for (const b of nodes) if (a !== b) assert.ok(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) >= 9, `${a.id} and ${b.id} apart`);
		assert.ok(pageLinks(k).length >= nodes.length - 1 - nodes.filter((n) => !n.parents.length).length + 1 || k in { marksman: 1, athletics: 1, resilience: 1 }, k + ' joined');
	}
	for (const p of PERKS) {
		assert.ok(p.desc.length > 15 && p.name && p.glyph, p.id);
		assert.ok(p.rank >= 0 && p.rank <= 100);
		assert.ok(p.fx.length && fxLines(p).every((l) => typeof l === 'string' && l.length > 5 && !/undefined|NaN/.test(l)), p.id + ' words');
	}
	// every page of the body has a root to begin from
	for (const k of ['marksman', 'athletics', 'resilience']) assert.ok(PERKS.some((p) => p.page === k && p.parent == null && p.rank === 0), k + ' root');
});

test('ranks rise with use, quickly at first, to a hundred', () => {
	assert.equal(rankOf(0), 0);
	for (let r = 1; r <= 100; r++) { assert.equal(rankOf(useFor(r)), r, 'rank ' + r); assert.equal(rankOf(useFor(r) - 1), r - 1); }
	assert.equal(rankOf(1e9), 100);
	assert.ok(useFor(20) < 500 && useFor(70) > 2500, 'the first ranks come quickly');
	assert.ok(rankFrac(useFor(10) + 1) > 0 && rankFrac(useFor(10) + 1) < 1);
});

test('levels give skill points; experience carries over', () => {
	const s = fresh();
	assert.equal(s.level, 1); assert.equal(pointsOf(s), 1, 'one to begin with');
	assert.equal(addXp(s, xpNeed(1) - 1), 0);
	assert.equal(addXp(s, 1), 1);
	assert.equal(s.level, 2); assert.equal(pointsOf(s), 2);
	assert.equal(addXp(s, xpNeed(2) + xpNeed(3) + 5), 2, 'two at once');
	assert.equal(s.level, 4); assert.equal(s.xp, 5);
	// use is experience too
	const r = addUse(s, 'radiance', xpNeed(4));
	assert.equal(r.levels, 1);
	assert.ok(r.ranks > 0);
});

test('a perk takes a point, the node it hangs from, and the rank', () => {
	const s = fresh();
	// Searing Light hangs from Sunspark (known from the start), rank 0
	assert.equal(perkBlock(s, 'searing-light'), null);
	// Focused Lens needs Lance of Dawn
	assert.match(perkBlock(s, 'focused-lens'), /Lance of Dawn/);
	gather(s, 'light', 100); assert.ok(weave(s, 'lance-of-dawn'));
	assert.match(perkBlock(s, 'focused-lens'), /rank 20/);
	addUse(s, 'radiance', useFor(20));
	assert.equal(s.level > 1, true);
	assert.equal(perkBlock(s, 'focused-lens'), null);
	assert.ok(takePerk(s, 'searing-light'));
	assert.ok(takePerk(s, 'focused-lens'));
	assert.match(perkBlock(s, 'searing-light'), /already/);
	// out of points
	while (pointsOf(s) > 0) { const p = PERKS.find((q) => !perkBlock(s, q.id)); if (!p) break; takePerk(s, p.id); }
	const left = PERKS.find((q) => !s.perks.includes(q.id) && q.parent == null);
	assert.match(perkBlock(s, left.id), /skill point|rank/);
	// a perk off another perk
	const t = fresh();
	addXp(t, 5000);
	assert.match(perkBlock(t, 'trained-eye'), /Steady Aim/);
	assert.ok(takePerk(t, 'steady-aim'));
	addUse(t, 'marksman', useFor(15));
	assert.ok(takePerk(t, 'trained-eye'));
	// any one of two parents
	addUse(t, 'marksman', useFor(70));
	assert.match(perkBlock(t, 'master-marksman'), /Deadeye or Giant Slayer/);
	assert.ok(takePerk(t, 'deadeye'));
	assert.equal(perkBlock(t, 'master-marksman'), null);
});

test('the perks shape the spells: power, mana, cooldowns, duration, reach, area, statuses', () => {
	const s = fresh(), sp = SPELL.sunspark, flare = SPELL['solar-flare'];
	const p0 = spellPower(s, sp), m0 = manaCost(s, SPELL['lance-of-dawn']), c0 = cooldownOf(s, SPELL.judgement), max0 = manaMax(s), reg0 = manaRegen(s);
	s.perks.push('searing-light', 'focused-lens', 'blinding-glare', 'zenith', 'wellspring');
	sanitizeSkills(s);
	// (the perks without their parents fall away on load, like rubbish)
	assert.deepEqual(s.perks, ['searing-light']);
	s.known.push('lance-of-dawn', 'solar-flare', 'judgement', 'renewal', 'sanctuary');
	s.perks.push('focused-lens', 'blinding-glare', 'zenith', 'wellspring');
	s.mods = computeMods(s.perks);
	const max1 = manaMax({ ...s, mods: null }), reg1 = manaRegen({ ...s, mods: null });
	assert.ok(Math.abs(spellPower(s, sp) / p0 - 1.4) < 1e-9, 'searing light and zenith: +40%');
	assert.ok(manaCost(s, SPELL['lance-of-dawn']) < m0);
	assert.ok(Math.abs(cooldownOf(s, SPELL.judgement) - c0 * 0.75) < 1e-9);
	assert.equal(manaMax(s), max1 + 25); assert.equal(manaRegen(s), reg1 + 1.5);
	assert.ok(max0 <= max1 && reg0 <= reg1);
	const f = shaped(flare, s.mods);
	assert.ok(f.r > flare.r && f.range > flare.range && f.status.hold > flare.status.hold);
	assert.equal(flare.status.hold, 1.6, 'the catalog is left alone');
	// another school is untouched
	assert.equal(spellPower(s, SPELL.shadowbolt), spellPower(fresh(), SPELL.shadowbolt));
	assert.equal(shaped(SPELL.shadowbolt, s.mods), SPELL.shadowbolt);
	// strand-wide and body perks
	const m = computeMods(['sunwalker', 'steady-aim', 'hardy', 'thick-skin', 'iron-will', 'unyielding', 'steadfast', 'light-step']);
	assert.equal(m.power.light, 0.1); assert.equal(m.weapon, 0.1); assert.equal(m.speed, 0.05);
	assert.ok(m.armor <= 0.5);
});

test('an ultimate takes mastery of its school: the ladder below it, then the highest rank', () => {
	// (Gargantua, the Void's ultimate, comes into the book with the spells; its star is kept ready)
	assert.ok(LAYOUT.void.spells.gargantua, 'a place for it at the top of the Void');
	const ult = { id: 'gargantua', name: 'Gargantua', school: 'void', tier: 5, kind: 'singularity', mana: 100, cd: 300, glyph: '●', desc: 'x' };
	assert.ok(isUltimate(ult) && !isUltimate(SPELL['event-horizon']));
	assert.equal(ULTIMATE_RANK, 100);
	const s = fresh();
	assert.match(spellBlock(s, ult), /tier 4 Void spell first/, 'the ladder first');
	s.known.push('event-horizon');
	addUse(s, 'void', useFor(99));
	assert.match(spellBlock(s, ult), /Void rank 100 \(yours is 99\)/);
	addUse(s, 'void', useFor(100) - useFor(99));
	assert.equal(spellBlock(s, ult), weaveBlock(s, ult), 'mastered: only the spell\'s own rules are left');
	// an ordinary spell is only its own rules
	assert.equal(spellBlock(fresh(), SPELL['lance-of-dawn']), weaveBlock(fresh(), SPELL['lance-of-dawn']));
});

test('a spell grows with casting and with aether poured in; Solar Flare learns the moon at III', () => {
	assert.deepEqual([0, 99, 100, 299, 300, 1499, 1500, 9e9].map(masteryLevel), [1, 1, 2, 2, 3, 4, 5, 5]);
	assert.equal(masteryFrac(200), 0.5); assert.equal(masteryFrac(1500), 1); assert.equal(masteryToNext(250), 50); assert.equal(masteryToNext(1500), 0);
	const s = fresh();
	// only a spell you know
	assert.equal(addMastery(s, 'solar-flare', 50), 0); assert.equal(s.mastery['solar-flare'], undefined);
	gather(s, 'light', 1000); weave(s, 'lance-of-dawn'); weave(s, 'solar-flare');
	const p0 = spellPower(s, SPELL['solar-flare']), lance0 = spellPower(s, SPELL['lance-of-dawn']);
	// casting: the mana paid
	assert.equal(addMastery(s, 'solar-flare', 120), 1);
	assert.ok(Math.abs(spellPower(s, SPELL['solar-flare']) / p0 - (1 + MASTERY_POWER)) < 1e-9, 'its own power, and only its own');
	assert.equal(spellPower(s, SPELL['lance-of-dawn']), lance0);
	assert.ok(!s.moonlit['solar-flare'], 'not yet by the moon');
	// pouring: its strand's aether, a point each
	const light0 = s.fabric.light, dark0 = s.fabric.dark;
	assert.deepEqual(feedSpell(s, 'solar-flare', 200), { fed: 200, levels: 1 });
	assert.equal(s.fabric.light, light0 - 200); assert.equal(s.fabric.dark, dark0);
	assert.equal(masteryLevel(s.mastery['solar-flare']), 3);
	assert.ok(s.moonlit['solar-flare'], 'Moonfall: it works by night');
	// no more than you have, and not past the last level
	s.fabric.light = 30;
	assert.equal(feedable(s, 'solar-flare', 100), 30);
	s.fabric.light = 1e6;
	feedSpell(s, 'solar-flare', 1e6);
	assert.equal(s.mastery['solar-flare'], MASTERY[MASTERY.length - 1]);
	assert.equal(feedSpell(s, 'solar-flare', 10).fed, 0);
	// a twilight spell takes both strands, half each, in pairs
	assert.deepEqual(feedCost(SPELL.thunderclap, 10), { light: 5, dark: 5 });
	assert.deepEqual(feedCost(SPELL.shadowbolt, 10), { light: 0, dark: 10 });
	// kept between visits; derived again on load
	const back = sanitizeSkills(createMagicState(JSON.parse(JSON.stringify(saveMagic(s)))));
	assert.equal(back.mastery['solar-flare'], 1500); assert.ok(back.moonlit['solar-flare']);
	assert.ok(back.mods.power['solar-flare'] > 0.3);
	// rubbish (and spells not known) dropped
	const junk = sanitizeSkills(createMagicState({ v: 1, known: ['sunspark'], mastery: { sunspark: 'lots', 'solar-flare': 900, nope: 5 } }));
	assert.deepEqual(junk.mastery, { sunspark: 0 });
});

test('skills are kept between visits, and rubbish is dropped', () => {
	const s = fresh();
	addXp(s, 1000); addUse(s, 'void', 300); assert.ok(takePerk(s, 'searing-light'));
	const back = sanitizeSkills(createMagicState(JSON.parse(JSON.stringify(saveMagic(s)))));
	assert.equal(back.level, s.level); assert.equal(back.xp, s.xp);
	assert.deepEqual(back.perks, ['searing-light']); assert.equal(back.use.void, 300);
	assert.ok(back.mods.power.radiance > 0);
	const junk = sanitizeSkills(createMagicState({ v: 1, known: ['sunspark'], level: 'x', xp: -5, perks: ['nope', 'null-edge', 'null-edge', 7], use: { void: 'lots', radiance: 40 } }));
	assert.equal(junk.level, 1); assert.equal(junk.xp, 0);
	assert.deepEqual(junk.perks, [], 'null-edge needs Void Shard, which is not known');
	assert.equal(junk.use.void, 0); assert.equal(junk.use.radiance, 40);
	// more perks than points: trimmed
	const greedy = sanitizeSkills(createMagicState({ v: 1, known: ['sunspark', 'mend'], level: 1, perks: ['searing-light', 'gentle-hands'] }));
	assert.equal(greedy.perks.length, 1);
});

test('the menu is wired: the keys, the places menu, the fight held and the world not drawn under it', () => {
	const idx = fs.readFileSync(new URL('../src/magic/index.js', import.meta.url), 'utf8');
	for (const k of ["e.code === 'Tab'", 'KeyN', 'menu.insertBefore', 'hooks.power', 'spellBlock(state, SPELL[id])', 'addMastery(state, a.id, b)', 'onFeed:', "addUse(state, 'athletics'"]) assert.ok(idx.includes(k), k);
	const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
	assert.match(main, /menu: tpMenu/); assert.match(main, /magic\.menuOpen\(\)/); assert.match(main, /magic\.covering\(\)/);
	const ui = fs.readFileSync(new URL('../src/magic/skills-ui.js', import.meta.url), 'utf8');
	for (const k of ['sk-feed', 'onFeed(sp.id', 'pointerdown', 'wheel', 'ArrowRight', 'Escape', 'Digit6', 'stopImmediatePropagation', "addEventListener('keydown', onKey, true)"]) assert.ok(ui.includes(k), k);
	const combat = fs.readFileSync(new URL('../src/combat/combat.js', import.meta.url), 'utf8');
	assert.match(combat, /hooks\.power\(T, blow\)/);
});
