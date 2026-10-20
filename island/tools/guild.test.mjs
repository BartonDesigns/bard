// Guilds' rules (src/guild/guild-rules.js) and your guild's place among the factions
// (src/combat/factions.js: 'guild' stands where you stand).
// node --test tools/guild.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/guild/guild-rules.js';
import { createRelations, FACTIONS, PLAYER } from '../src/combat/factions.js';
import { SPELL } from '../src/magic/spells.js';

test('names, tags and colours', () => {
	assert.ok(G.nameOk('The Bay Bards')); assert.ok(G.nameOk("Fog Watch's Own"));
	assert.ok(!G.nameOk('x')); assert.ok(!G.nameOk('A'.repeat(30))); assert.ok(!G.nameOk('<script>'));
	assert.equal(G.tagFrom('The Bay Bards'), 'TBB'); assert.equal(G.tagFrom('Fogwatch'), 'FOG'); assert.equal(G.tagFrom('Bay Area Reality Designers'), 'BARD');
	assert.equal(G.cleanTag('bb!'), 'BB');
	assert.deepEqual(G.cleanColours(['#3b82f6', 'red']), ['#3b82f6', '#e8e0cc']);
	assert.throws(() => G.newGuild({ name: 'x' }), /guild name/);
	assert.throws(() => G.newGuild({ name: 'Bay Bards', tag: 'B' }), /tag/);
	const g = G.newGuild({ name: '  Bay   Bards ', tag: 'bb' });
	assert.equal(g.name, 'Bay Bards'); assert.equal(g.tag, 'BB'); assert.equal(g.rank, 'leader');
});

test('every spell on every path is a real spell, and works in their hands', () => {
	for (const [role, strands] of Object.entries(G.PATHS)) {
		assert.ok(G.ROLES[role], role);
		for (const path of Object.values(strands)) {
			let last = 0;
			for (const [L, id] of path) {
				assert.ok(SPELL[id], id); assert.ok(G.SPELL_ACTS[id], id);
				assert.ok(L > last && L <= G.LEVEL_MAX, `${role} ${id} at ${L}`); last = L;
			}
		}
	}
	// a mage and a healer start with a spell; a warrior learns their first at 3
	assert.equal(G.spellsAt('mage', 'dark', 1)[0], 'shadowbolt');
	assert.equal(G.spellsAt('healer', 'light', 1)[0], 'mend');
	assert.equal(G.spellsAt('warrior', 'light', 2).length, 0);
});

test('callings from what people do, and joining', () => {
	assert.equal(G.callingFor('a retired firefighter who hikes here every week'), 'warrior');
	assert.equal(G.callingFor('a nurse at the hospital'), 'healer');
	assert.equal(G.callingFor('a geology professor'), 'mage');
	assert.ok(G.ROLES[G.callingFor('', 12345)]);
	assert.equal(G.strandFor('healer', 3), 'light');
	const m = G.newMember({ name: 'Maria Lopez', first: 'Maria', seed: 99, job: 'a paramedic' }, 1000);
	assert.equal(m.role, 'healer'); assert.equal(m.level, 1); assert.deepEqual(m.spells, ['mend']); assert.ok(m.follow);
});

test('the odds of a yes: honor and trust help, the law hurts, never a child', () => {
	assert.equal(G.recruitOdds({ minor: true, honorRank: 9, trust: 10 }), 0);
	assert.equal(G.recruitOdds({ members: G.NPC_MAX }), 0);
	const base = G.recruitOdds({});
	assert.ok(G.recruitOdds({ honorRank: 5 }) > base);
	assert.ok(G.recruitOdds({ trust: 4 }) > base);
	assert.ok(G.recruitOdds({ wanted: 3 }) < base);
	assert.ok(G.recruitOdds({ wanted: 5, afraid: true }) >= 0.05);
	assert.ok(G.recruitOdds({ honorRank: 9, trust: 10 }) <= 0.95);
});

test('levels: experience, stronger each level, spells learned on the way', () => {
	const m = G.newMember({ name: 'Ari', seed: 7, job: 'a carpenter' });
	assert.equal(m.role, 'warrior');
	const s1 = G.statsFor(m);
	let r = G.giveXp(m, G.xpToNext(1) - 1);
	assert.equal(r.levels, 0); assert.equal(m.level, 1);
	r = G.giveXp(m, 1 + G.xpToNext(2));
	assert.equal(r.levels, 2); assert.equal(m.level, 3);
	assert.equal(r.learned.length, 1, 'their first spell at 3');
	assert.ok(['sunspark', 'shadowbolt'].includes(r.learned[0]));
	const s3 = G.statsFor(m);
	assert.ok(s3.hpK > s1.hpK && s3.dmgK > s1.dmgK && s3.acc > s1.acc && s3.armour > s1.armour);
	G.giveXp(m, 1e9);
	assert.equal(m.level, G.LEVEL_MAX); assert.equal(m.xp, 0); assert.equal(m.spells.length, 5);
	assert.equal(G.giveXp(m, 100).levels, 0, 'no further');
	assert.equal(G.nextSpell(m), null);
	assert.ok(G.statsFor(m).acc <= 0.72);
	assert.ok(G.xpForKill({ max: 240, kind: 'creature' }) > G.xpForKill({ max: 100 }));
});

test('a saved guild read back, and who walks with you', () => {
	const g = G.newGuild({ name: 'Bay Bards', tag: 'BB' });
	for (let i = 0; i < 5; i++) g.npcs.push(G.newMember({ name: 'P' + i, seed: i + 1 }));
	g.npcs[1].downUntil = 2000;
	g.npcs[2].follow = false;
	g.npcs.push({ id: 'bad', role: 'wizard' });
	const back = G.readGuild(JSON.stringify(g));
	assert.equal(back.npcs.length, 5, 'an unknown calling dropped');
	assert.deepEqual(G.followers(back, 1000, 3).map((m) => m.name), ['P0', 'P3', 'P4']);
	assert.deepEqual(G.followers(back, 3000, 2).map((m) => m.name), ['P0', 'P1'], 'rested, and out again');
	assert.equal(G.readGuild('nonsense'), null);
	assert.equal(G.readGuild({ name: 'x', tag: 'BB' }), null);
	assert.deepEqual(G.npcSummary(back)[0], { name: 'P0', role: back.npcs[0].role, level: 1 });
	assert.equal(G.guildLine(back), '6 members');
});

test('your guild stands where you stand with every faction', () => {
	const R = createRelations();
	assert.ok(FACTIONS.guild && FACTIONS.guild.zones.length === 0);
	assert.ok(R.hostile('ashfang', 'guild'), 'raiders hate you, so your people');
	assert.ok(R.hostile('nightborn', 'guild'));
	assert.ok(!R.hostile('village', 'guild'));
	assert.ok(R.allied('guild', PLAYER));
	assert.equal(R.get('guild', 'patrol'), R.get(PLAYER, 'patrol'));
	// what is done to them is done to you, and nothing about you changes by their being there
	const before = R.get(PLAYER, 'copperline');
	R.attacked('copperline', 'guild');
	assert.ok(R.get(PLAYER, 'copperline') < before);
	assert.ok(!('guild' in R.player()), 'the compass lists the world, not your own');
	const S = createRelations(), b0 = S.get(PLAYER, 'ashfang');
	S.attacked('ashfang', 'village');
	assert.equal(S.get(PLAYER, 'ashfang'), b0, 'a raid on a village leaves your own feelings as they were');
});
