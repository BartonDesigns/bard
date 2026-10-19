// Honor (src/combat/honor.js): the ladder, the honor in a deed (PvE), a PvP win and its repeats,
// who may fight whom, and its rank folded into the mods with combat, health and defence.
// node island/tools/honor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, RANK_TOP, PER_RANK, rankOf, titleOf, rankFrac, honorMods, sanitizeHonor, addHonor, pveHonor, HONOR_FOR, pvpHonor, pvpWin, PVP_BASE, REPEAT_MS, pvpOpen, honorSheet } from '../src/combat/honor.js';
import { createMagicState, saveMagic } from '../src/magic/spells.js';
import { sanitizeSkills } from '../src/magic/skills.js';
import { composeMods, statSheet, BASE_LIFE } from '../src/magic/stats.js';
import { cleanPose, cleanDown } from '../src/net/protocol.js';

test('the ladder climbs, and every rank lifts combat, health and defence', () => {
	for (let i = 1; i < RANKS.length; i++) assert.ok(RANKS[i][0] > RANKS[i - 1][0], 'rising ' + RANKS[i][1]);
	assert.equal(rankOf(0), 0); assert.equal(rankOf(49), 0); assert.equal(rankOf(50), 1); assert.equal(rankOf(1e9), RANK_TOP);
	assert.equal(titleOf(3), 'Vanguard'); assert.equal(titleOf(99), titleOf(RANK_TOP));
	assert.equal(rankFrac(100), 0.5); assert.equal(rankFrac(1e9), 1);
	const M = honorMods(4);
	assert.equal(M.life, 4 * PER_RANK.health);
	assert.ok(Math.abs(M.weapon - 4 * PER_RANK.combat) < 1e-9 && Math.abs(M.armor - 4 * PER_RANK.defence) < 1e-9);
});

test('honor is kept whole: never below none, earned each way, mended from a bad save', () => {
	const h = sanitizeHonor({ pts: -5, pve: 'x', wins: [{ id: 'a', t: 1 }, { id: 3 }, null] });
	assert.deepEqual(h, { pts: 0, pve: 0, pvp: 0, wins: [{ id: 'a', t: 1 }] });
	let r = addHonor(h, 60);
	assert.deepEqual([r.n, r.from, r.to, h.pts, h.pve], [60, 0, 1, 60, 60]);
	r = addHonor(h, -100);
	assert.equal(r.n, -60); assert.equal(h.pts, 0); assert.equal(h.pve, 60, 'what was earned stays counted');
});

test('the honor in a deed: fair fights earn it, killing the defenceless costs it', () => {
	const kill = (faction, ctx = []) => pveHonor({ kind: 'kill', faction, ctx });
	assert.ok(kill('ashfang') > 0, 'raiders are fair game');
	assert.ok(kill('ironvale') > kill('ashfang'), 'invaders, tougher, are worth more');
	assert.ok(kill('gloom') > 0 && kill('rogue') > 0, 'creatures and rogue machines too');
	assert.equal(kill('copperline'), 0, 'a gang member minding their own business: no honor');
	assert.ok(kill('copperline', ['hostileTarget']) > 0 && kill('copperline', ['selfDefence']) > 0 && kill('copperline', ['defence']) > 0, 'one after you, or who struck first: honor');
	assert.equal(kill('ashfang', ['surrendered']), HONOR_FOR.killSurrendered);
	assert.equal(pveHonor({ kind: 'kill-surrendered', faction: 'ashfang' }), HONOR_FOR.killSurrendered);
	assert.equal(kill('police', ['selfDefence']), HONOR_FOR.killLaw, 'the law is never fair game');
	assert.equal(kill('civ', ['unarmed']), HONOR_FOR.killUnarmed);
	assert.equal(kill('civ', ['unarmed', 'hostileTarget']), 0, 'a townsperson who came at you: nothing either way');
	assert.equal(pveHonor({ kind: 'boss-slain' }), HONOR_FOR.bossSlain);
	assert.equal(pveHonor({ kind: 'defend-village', ctx: [] }), HONOR_FOR.defendVillage);
	assert.equal(pveHonor({ kind: 'spare' }), HONOR_FOR.spare);
	assert.equal(pveHonor({ kind: 'hurt', faction: 'ashfang' }), 0, 'a wound is no win');
	assert.equal(pveHonor({ kind: 'kill', faction: 'ashfang', ctx: { hostileTarget: true } }) > 0, true, 'ctx as an object too');
});

test('PvP: more for beating someone above you, less and then nothing for the same friend again', () => {
	assert.equal(pvpHonor(2, 2), PVP_BASE);
	assert.ok(pvpHonor(0, 4) > PVP_BASE && pvpHonor(4, 0) < PVP_BASE && pvpHonor(9, 0) > 0);
	const h = sanitizeHonor(null), t = 1e9;
	const a = pvpWin(h, 'friend-aaaa', 0, t), b = pvpWin(h, 'friend-aaaa', 0, t + 1000), c = pvpWin(h, 'friend-aaaa', 0, t + 2000), d = pvpWin(h, 'friend-aaaa', 0, t + 3000);
	assert.deepEqual([a.n, b.n, d.n], [PVP_BASE, PVP_BASE / 2, 0]);
	assert.ok(c.n > 0 && c.n < b.n, 'the third, less again (and you have climbed above them by now)');
	const now = () => pvpHonor(rankOf(h.pts), 1);
	let want = now();
	assert.equal(pvpWin(h, 'friend-bbbb', 1, t + 4000).n, want, 'another friend counts afresh');
	want = now();
	assert.equal(pvpWin(h, 'friend-aaaa', 1, t + 3000 + REPEAT_MS).n, want, 'and so does the same friend after a while');
	assert.equal(h.pvp, h.pts, 'all of it from PvP');
});

test('who may fight whom: the room allows it and both raised their flag', () => {
	assert.equal(pvpOpen({ pvp: false }, true, true), false, 'the host has it off');
	assert.equal(pvpOpen({ pvp: true }, false, true), false, 'your own flag down');
	assert.equal(pvpOpen({ pvp: true }, true, false), false, 'their flag down');
	assert.equal(pvpOpen({ pvp: true }, true, true), true);
	assert.equal(pvpOpen({ pvp: true }, true, null), true, 'an older server cannot tell theirs: yours decides on your side');
	assert.equal(cleanPose({ p: [0, 1, 0], pk: 1 }).pk, 1);
	assert.equal(cleanPose({ p: [0, 1, 0], pk: true }).pk, undefined, 'only exactly 1 raises it');
	assert.deepEqual(cleanDown({ by: 'friend-aaaa', r: 3 }), { by: 'friend-aaaa', r: 3 });
});

test('honor rides the magic save, and its rank lifts the mods and the sheet', () => {
	const s = sanitizeSkills(createMagicState());
	assert.deepEqual(s.honor, { pts: 0, pve: 0, pvp: 0, wins: [] });
	const base = composeMods(s);
	assert.equal(base.honor, 0);
	addHonor(s.honor, RANKS[5][0]);
	const back = sanitizeSkills(createMagicState(JSON.parse(JSON.stringify(saveMagic(s)))));
	assert.equal(back.honor.pts, RANKS[5][0], 'kept between visits');
	const m = composeMods(back);
	assert.equal(m.honor, 5);
	assert.equal(m.life - base.life, 5 * PER_RANK.health);
	assert.ok(Math.abs(m.weapon - base.weapon - 5 * PER_RANK.combat) < 1e-9);
	assert.ok(Math.abs(m.armor - base.armor - 5 * PER_RANK.defence) < 1e-9);
	back.mods = m;
	assert.equal(statSheet(back).life, BASE_LIFE + m.life);
	const sh = honorSheet(back.honor, true);
	assert.equal(sh.title, titleOf(5)); assert.equal(sh.flag, true);
	assert.deepEqual(sh.skills.map((k) => [k.id, k.level]), [['combat', 5], ['health', 5], ['defence', 5]]);
});
