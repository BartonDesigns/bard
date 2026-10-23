// The creatures (creatures/catalog.js): every kind has its model, its side is a creature
// faction that hates you (so killing one is honor, combat/honor.js), and they come only where
// and when they should.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPECIES, SPECIES_IDS, speciesFor, pickSpecies } from '../src/creatures/catalog.js';
import { FACTIONS, PLAYER, createRelations } from '../src/combat/factions.js';
import { pveHonor } from '../src/combat/honor.js';
import { DAMAGE_TYPES, PARTS } from '../src/combat/health.js';
import { HIT_PARTS } from '../src/net/protocol.js';
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
	// (Shard Mites swarm, and burst when they die)
	assert.ok(speciesFor('deep', 0).includes('shard-mite'));
	assert.ok(SPECIES['shard-mite'].where.pack[0] >= 3 && SPECIES['shard-mite'].shatter);
	assert.ok(!speciesFor('deep', 1).includes('fog-wight'));
});

test('the Moon has its white hounds at any hour, and none of the woods\' or the towns\' creatures', () => {
	// (Ryan 2026-10-22: the Burnt Giant stood at the moon base; the sky there is black by day)
	assert.deepEqual(speciesFor('moon', 0), ['ridge-hound']);
	assert.deepEqual(speciesFor('moon', 1), ['ridge-hound']);
	const M = SPECIES['ridge-hound'].moon;
	assert.ok(M && M.sat < 0.5 && M.val > 1.2, 'bleached on the Moon');
	for (const id of SPECIES_IDS) if (id !== 'ridge-hound') assert.ok(!SPECIES[id].where.zones.includes('moon'), id);
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

test('the big ones have a weak point on bones they have, worth 1.5x', () => {
	assert.equal(PARTS.vital, 1.5);
	assert.ok(HIT_PARTS.includes('vital'));
	let n = 0;
	for (const [id, S] of Object.entries(SPECIES)) {
		if (!S.weak) continue;
		n++;
		const spec = JSON.parse(fs.readFileSync(new URL(`./monsters/specs/${S.model ?? id}.json`, import.meta.url)));
		const bones = spec.bones.map((b) => b.name);
		for (const b of S.weak.bones) assert.ok(bones.includes(b), `${id} weak bone ${b}`);
		assert.ok(S.weak.name && S.weak.glow && S.weak.r > 0, `${id} weak point incomplete`);
		assert.ok(S.height >= 1.9 || S.hp >= 400, `${id} is not a big one`);
	}
	assert.ok(n >= 8, `${n} weak points`);
	for (const big of ['burnt-giant', 'hollow-king', 'old-drain-king', 'saltmarsh-mother']) assert.ok(SPECIES[big].weak, big);
});

test('their voices are made, heard and never clip', () => {
	for (const v of ['growl', 'snarl', 'sniff', 'scrape', 'creak', 'chitter', 'click', 'shatter', 'slam', 'souls', 'soulburst', 'ember', 'thud', 'collapse', 'crystalroar', 'lunge', 'pulse', 'burst', 'cracking', 'slither', 'spit', 'chord']) assert.ok(VOICES.includes(v), v);
	// (every kind has a voice of its own, every sound it names is one that is made, and the
	// sets stay apart: no two kinds share a whole set)
	const sets = new Map();
	for (const [id, S] of Object.entries(SPECIES)) {
		assert.ok(S.voice, `${id} has no voice`);
		for (const [k, v] of Object.entries(S.voice)) {
			if (k === 'loop') assert.ok(VOICES.includes(v.name), `${id} loop ${v.name}`);
			else if (typeof v === 'string') assert.ok(VOICES.includes(v), `${id} ${k} ${v}`);
		}
		const key = ['spot', 'strike', 'swing', 'hit', 'idle', 'die', 'turn', 'lob'].map((k) => S.voice[k] || '').join('|');
		assert.ok(!sets.has(key), `${id} sounds just like ${sets.get(key)}`);
		sets.set(key, id);
	}
	for (const v of VOICES) {
		const d = renderVoice(v, 22050);
		let peak = 0, e = 0;
		for (const x of d) { assert.ok(Number.isFinite(x), v); peak = Math.max(peak, Math.abs(x)); e += x * x; }
		assert.ok(peak <= 1 && peak > 0.3, `${v} peak ${peak}`);
		assert.ok(e / d.length > 1e-4, `${v} is silent`);
	}
});
