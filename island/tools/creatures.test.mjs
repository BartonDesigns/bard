// The creatures (creatures/catalog.js): every kind has its model, its side is a creature
// faction that hates you (so killing one is honor, combat/honor.js), and they come only where
// and when they should.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPECIES, SPECIES_IDS, speciesFor, pickSpecies } from '../src/creatures/catalog.js';
import { FACTIONS, PLAYER, createRelations } from '../src/combat/factions.js';
import { pveHonor } from '../src/combat/honor.js';
import { DAMAGE_TYPES } from '../src/combat/health.js';
import { VOICES, renderVoice } from '../src/creatures/voice.js';

test('every kind has its packed model', () => {
	for (const id of SPECIES_IDS) {
		const S = SPECIES[id];
		for (const m of [S.model ?? id, S.human].filter(Boolean)) assert.ok(fs.existsSync(new URL(`../assets/creatures/${m}.glb`, import.meta.url)), m);
	}
});

test('each one is of a creature side that hates you, and its harm types are real ones', () => {
	const rel = createRelations();
	for (const id of SPECIES_IDS) {
		const S = SPECIES[id];
		assert.equal(FACTIONS[S.faction]?.kind, 'creatures', id);
		assert.ok(rel.hostile(S.faction, PLAYER), id);
		for (const k of Object.keys(S.resist)) assert.ok(DAMAGE_TYPES.includes(k), `${id} resists ${k}`);
		assert.ok(S.hp > 0 && S.reach > 0 && S.strike > 0 && S.run >= S.walk, id);
	}
});

test('bringing one down is honor', () => {
	for (const f of ['nightborn', 'goblins', 'deepborn']) assert.ok(pveHonor({ kind: 'kill', faction: f, ctx: [] }) > 0, f);
});

test('the night ones come only after dark; the Deep keeps its own', () => {
	// (by day only the Burnt Giant, standing as a tree among the trees)
	assert.deepEqual(speciesFor('earth-rural', 0), ['burnt-giant']);
	assert.ok(SPECIES['burnt-giant'].lurk?.wake > 0);
	assert.ok(speciesFor('earth-rural', 1).includes('fog-wight'));
	assert.ok(speciesFor('earth-urban', 1).includes('drain-skulker'));
	assert.ok(speciesFor('wild', 1).includes('ridge-hound'));
	// (the Deep's gloom squads bring the Gloomcrawlers themselves)
	assert.ok(!speciesFor('deep', 0).includes('gloomcrawler'));
	assert.ok(speciesFor('deep', 0).includes('sporeborn-miner'));
	assert.ok(!speciesFor('deep', 1).includes('fog-wight'));
});

test('a rare one comes rarely', () => {
	const n = { 'sporeborn-miner': 0, 'old-drain-king': 0 };
	for (let i = 0; i < 1000; i++) n[pickSpecies(['sporeborn-miner', 'old-drain-king'], (i + 0.5) / 1000)]++;
	assert.ok(n['old-drain-king'] > 50 && n['old-drain-king'] < 200, JSON.stringify(n));
});

test('a flyer keeps above you and drops into reach to strike', () => {
	for (const id of SPECIES_IDS) {
		const F = SPECIES[id].fly;
		if (!F) continue;
		assert.ok(F.hover > F.strike && F.strike > 0 && F.strike < 2, id);
	}
	assert.ok(SPECIES.lampeater.fly);
});

test('their voices are made, heard and never clip', () => {
	for (const v of ['growl', 'snarl', 'sniff', 'scrape', 'creak', 'chitter']) assert.ok(VOICES.includes(v), v);
	for (const v of VOICES) {
		const d = renderVoice(v, 22050);
		let peak = 0, e = 0;
		for (const x of d) { assert.ok(Number.isFinite(x), v); peak = Math.max(peak, Math.abs(x)); e += x * x; }
		assert.ok(peak <= 1 && peak > 0.3, `${v} peak ${peak}`);
		assert.ok(e / d.length > 1e-4, `${v} is silent`);
	}
});
