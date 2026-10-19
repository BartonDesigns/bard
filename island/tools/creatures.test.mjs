// The creatures (creatures/catalog.js): every kind has its model, its side is a creature
// faction that hates you (so killing one is honor, combat/honor.js), and they come only where
// and when they should.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPECIES, SPECIES_IDS, speciesFor } from '../src/creatures/catalog.js';
import { FACTIONS, PLAYER, createRelations } from '../src/combat/factions.js';
import { pveHonor } from '../src/combat/honor.js';
import { DAMAGE_TYPES } from '../src/combat/health.js';

test('every kind has its packed model', () => {
	for (const id of SPECIES_IDS) assert.ok(fs.existsSync(new URL(`../assets/creatures/${id}.glb`, import.meta.url)), id);
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
	assert.deepEqual(speciesFor('earth-rural', 0), []);
	assert.ok(speciesFor('earth-rural', 1).includes('fog-wight'));
	assert.ok(speciesFor('earth-urban', 1).includes('drain-skulker'));
	assert.ok(speciesFor('deep', 0).includes('sporeborn-miner'));
	assert.ok(!speciesFor('deep', 1).includes('fog-wight'));
});
