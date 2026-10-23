// Magic (src/magic/): the spells' catalog and its ladders, weaving with the two strands of fabric,
// twilight's gate, power by the time of day, mana and cooldowns, what is kept between visits,
// the aether's motes and wells in the world, and the weapons on the keys 1 to 5.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SPELLS, SPELL, SCHOOLS, WEAVE_COST, TWILIGHT_NEEDS, createMagicState, saveMagic, weave, weaveBlock, weaveCost, bind, spellPower, manaCost, castBlock, spend, cooldownLeft, manaMax, gather, strandOf, moonlit, grantMoonlit, aetherShare, gatherShare } from '../src/magic/spells.js';
import { moteAt, wellAt, aetherNear, strandsShowing, isBack, fabricOf, seedOf, cellHash, MOTE_BACK } from '../src/magic/aether.js';
import { hotbarBinds, hotbarPress } from '../src/combat/hotbar.js';

test('every spell is whole, and every school a ladder with no rung missing', () => {
	const ids = new Set();
	for (const s of SPELLS) {
		assert.ok(!ids.has(s.id), 'unique ' + s.id); ids.add(s.id);
		assert.ok(SCHOOLS[s.school], s.id + ' school');
		assert.ok(s.tier >= 1 && s.tier <= 4 || s.tier === 5 && s.kind === 'singularity', s.id + ' tier');
		assert.ok(s.name && s.glyph && s.desc.length > 20, s.id + ' words');
		assert.ok(s.mana >= 0 && s.cd > 0, s.id + ' costs');
		if (['bolt', 'burst', 'flare', 'strike', 'nova', 'cone', 'chain', 'orb', 'well'].includes(s.kind)) assert.ok(s.dmg > 0, s.id + ' harms');
		if (s.kind === 'bolt') assert.ok(s.speed > 0, s.id + ' flies');
	}
	assert.ok(SPELLS.length >= 40, `a wide book (${SPELLS.length})`);
	for (const k of Object.keys(SCHOOLS)) {
		const tiers = new Set(SPELLS.filter((s) => s.school === k).map((s) => s.tier));
		const top = Math.max(...tiers);
		for (let t = 1; t <= top; t++) assert.ok(tiers.has(t), `${k} has tier ${t}`);
	}
	// every strand has its schools
	for (const st of ['light', 'dark', 'twilight']) assert.ok(Object.values(SCHOOLS).filter((q) => q.strand === st).length >= 3, st);
});

test('the runtime knows every kind of spell', () => {
	const src = fs.readFileSync(new URL('../src/magic/caster.js', import.meta.url), 'utf8');
	for (const kind of new Set(SPELLS.map((s) => s.kind))) assert.ok(new RegExp(`\\n\\t\\t${kind}\\(`).test(src), `caster does ${kind}`);
});

test('weaving takes the fabric of its strand, makes affinity, and climbs the ladder a rung at a time', () => {
	const s = createMagicState();
	assert.deepEqual(s.binds.slice(0, 4), ['sunspark', 'shadowbolt', 'mend', 'lumen']);
	assert.match(weaveBlock(s, SPELL['lance-of-dawn']), /fabric/);
	assert.match(weaveBlock(s, SPELL['solar-flare']), /tier 2/);
	gather(s, 'light', 30);
	const before = s.fabric.light;
	assert.ok(weave(s, 'lance-of-dawn'));
	assert.equal(s.fabric.light, before - WEAVE_COST[1]);
	assert.equal(s.affinity.light, WEAVE_COST[1]);
	assert.equal(s.binds[4], 'lance-of-dawn', 'the free key takes it');
	assert.equal(weaveBlock(s, SPELL['lance-of-dawn']), 'You know it already.');
	// dark from dark only
	assert.deepEqual(weaveCost(SPELL['void-shard']), { light: 0, dark: WEAVE_COST[0] });
	assert.ok(weave(s, 'void-shard'));
	assert.equal(s.affinity.dark, WEAVE_COST[0]);
});

test('twilight needs both strands deeply, and takes from both', () => {
	const s = createMagicState();
	gather(s, 'light', 500); gather(s, 'dark', 500);
	assert.match(weaveBlock(s, SPELL.thunderclap), /both strands/);
	s.affinity.light = s.affinity.dark = TWILIGHT_NEEDS[0];
	assert.equal(weaveBlock(s, SPELL.thunderclap), null);
	const c = weaveCost(SPELL.thunderclap);
	assert.ok(c.light > 0 && c.dark > 0);
	assert.ok(weave(s, 'thunderclap'));
	assert.match(weaveBlock(s, SPELL['chain-lightning']), /both strands/, 'tier 2 needs more');
});

test('light burns by day, dark by night, twilight at dusk; affinity and the pact strengthen', () => {
	const s = createMagicState();
	const L = SPELL.sunspark, D = SPELL.shadowbolt, T = SPELL.thunderclap;
	assert.ok(spellPower(s, L, { light: 0.8 }) > spellPower(s, L, { light: -0.6 }));
	assert.ok(spellPower(s, D, { light: -0.6 }) > spellPower(s, D, { light: 0.8 }));
	assert.ok(spellPower(s, T, { light: 0 }) > spellPower(s, T, { light: 0.8 }));
	const k0 = spellPower(s, L, { light: 0.5 });
	s.affinity.light = 250;
	assert.ok(spellPower(s, L, { light: 0.5 }) > k0, 'affinity');
	assert.ok(spellPower(s, L, { light: 0.5, pact: 1.5 }) > spellPower(s, L, { light: 0.5 }), 'pact');
	assert.ok(manaCost(s, L) <= L.mana, 'cheaper with affinity');
});

test('casting spends mana and starts a cooldown; quickened cooldowns are shorter', () => {
	const s = createMagicState();
	assert.equal(castBlock(s, 'sunspark', 10), null);
	spend(s, 'sunspark', 10);
	assert.ok(s.mana < 100);
	assert.match(castBlock(s, 'sunspark', 10.1), /not ready/);
	assert.ok(cooldownLeft(s, 'sunspark', 10.1) > 0);
	assert.equal(castBlock(s, 'sunspark', 11), null);
	assert.match(castBlock(s, 'judgement', 11), /do not know/);
	s.mana = 1;
	assert.match(castBlock(s, 'mend', 20), /mana/);
	s.mana = 100;
	spend(s, 'mend', 20, 3);
	assert.ok(s.cds.mend - 20 < SPELL.mend.cd);
	assert.ok(manaMax(s) >= 100);
});

test('what you know, bind and carry is kept between visits', () => {
	const s = createMagicState();
	gather(s, 'dark', 50); weave(s, 'hex-of-decay'); bind(s, 0, 'hex-of-decay');
	s.mark = { x: 1, y: 2, z: 3, w: 'here' };
	const back = createMagicState(JSON.parse(JSON.stringify(saveMagic(s))));
	assert.deepEqual(back.known, s.known);
	assert.equal(back.binds[0], 'hex-of-decay');
	assert.equal(back.binds.filter((b) => b === 'hex-of-decay').length, 1, 'a spell on one key only');
	assert.deepEqual(back.fabric, s.fabric);
	assert.deepEqual(back.mark, s.mark);
	// (rubbish is dropped)
	const odd = createMagicState({ v: 1, known: ['nope', 'mend'], binds: ['nope', 'mend'], fabric: { light: -5, dark: 'x' } });
	assert.deepEqual(odd.known, ['mend']);
	assert.equal(odd.binds[0], null);
	assert.deepEqual(odd.fabric, { light: 0, dark: 0 });
	assert.equal(strandOf(SPELL.tempest), 'twilight');
});

test('at least four spells are always bound, on every screen', async () => {
	const { fillBinds, MIN_BOUND } = await import('../src/magic/spells.js');
	assert.equal(MIN_BOUND, 4);
	// (an old save with one spell on the keys comes back with four)
	const old = createMagicState({ v: 1, known: ['sunspark', 'shadowbolt', 'mend', 'lumen', 'lance-of-dawn'], binds: [null, 'mend', null, null, null], fabric: { light: 0, dark: 0 } });
	assert.deepEqual(old.binds, ['sunspark', 'mend', 'shadowbolt', 'lumen', null], 'the empty keys take known spells, in order');
	// (moved to another key, a spell swaps with what was there)
	bind(old, 3, 'sunspark');
	assert.deepEqual(old.binds, ['lumen', 'mend', 'shadowbolt', 'sunspark', null]);
	// (a key cleared takes another known spell; the one taken off stays off)
	bind(old, 1, null);
	assert.equal(old.binds.filter(Boolean).length, 4);
	assert.ok(!old.binds.includes('mend') && old.binds.includes('lance-of-dawn'));
	// (with only four known, a cleared key stays clear: the player's choice)
	const s = createMagicState();
	bind(s, 2, null);
	assert.equal(s.binds[2], null);
	assert.equal(fillBinds(createMagicState({ v: 1, known: ['mend'], binds: [], fabric: {} })).binds.filter(Boolean).length, 1, 'never more than you know');
	// (a touch screen shows the first four bound beside the spell button, a tap casting one)
	const hud = fs.readFileSync(new URL('../src/magic/hud.js', import.meta.url), 'utf8');
	assert.match(hud, /const QUICK = \{\n\tn: 4,/);
	assert.match(hud, /\[-8, -74\], \[-55, -50\], \[-74, 0\], \[-55, 50\]/, 'an arc round the button in portrait');
	assert.match(hud, /if \(SPELL\[state\.binds\[i\]\]\) quick\[k\+\+\]\.i = i;/, 'the first four bound');
	assert.match(hud, /if \(q\.i < 0\) return; e\.classList\.add\('on'\); cast\(q\.i\);/, 'a tap casts it');
});

test('the aether lies where the world puts it: the same every time, none in the sea', () => {
	const seed = seedOf('earth'), flat = () => 5, sea = () => -10;
	const a = aetherNear(0, 0, 400, seed, flat), b = aetherNear(0, 0, 400, seed, flat);
	assert.deepEqual(a, b);
	assert.ok(a.length > 10, 'motes about');
	assert.ok(a.some((m) => m.strand === 'light') && a.some((m) => m.strand === 'dark'), 'both strands');
	assert.equal(aetherNear(0, 0, 400, seed, sea).length, 0);
	assert.notDeepEqual(aetherNear(0, 0, 400, seedOf('MAGMA:4242'), flat).map((m) => m.key), a.map((m) => m.key), 'each world its own');
	// high ground leans to light
	const high = aetherNear(0, 0, 2000, seed, () => 200).filter((m) => !m.well), low = aetherNear(0, 0, 2000, seed, () => 0).filter((m) => !m.well);
	const share = (L) => L.filter((m) => m.strand === 'light').length / L.length;
	assert.ok(share(high) > share(low));
	// wells are rare and rich
	let wells = 0;
	for (let j = -20; j < 20; j++) for (let i = -20; i < 20; i++) if (wellAt(i, j, seed, flat)) wells++;
	assert.ok(wells > 100 && wells < 600, `wells ${wells}`);
	const w = [...Array(400).keys()].map((k) => wellAt(k, 3, seed, flat)).find(Boolean);
	assert.ok(w.n >= 18 && w.well);
	assert.ok(moteAt(3, 4, seed, flat) === null || moteAt(3, 4, seed, flat).n <= 3);
	assert.ok(cellHash(1, 2, 3) >= 0 && cellHash(1, 2, 3) < 1);
});

test('light shows by day, dark by night, both at dusk; gathered motes come back', () => {
	assert.deepEqual(strandsShowing(0.7), { light: true, dark: false, twilight: false });
	assert.deepEqual(strandsShowing(-0.5), { light: false, dark: true, twilight: false });
	assert.deepEqual(strandsShowing(0), { light: true, dark: true, twilight: true });
	const m = { n: 2, well: false };
	assert.ok(fabricOf(m, 0) > fabricOf(m, 0.7), 'more at dusk');
	assert.equal(isBack(m, 1000, 1000 + MOTE_BACK - 1), false);
	assert.equal(isBack(m, 1000, 1000 + MOTE_BACK), true);
	assert.equal(isBack(m, 0, 5), true);
});

test('weapons fill the keys 1 to 5, stay put, and a second press puts one away', () => {
	const inv = { hand: null, instances: {
		a: { u: 'a', i: 'warden-spark-carbine', l: 1, t: 0 },
		b: { u: 'b', i: 'aurora-trail-rifle', l: 3, t: 1 },
		c: { u: 'c', i: 'aurora-trail-rifle', l: 1, t: 0 },
		k: { u: 'k', i: 'field-medkit', l: 1, t: 0 },
	} };
	const binds = hotbarBinds(inv);
	assert.deepEqual(binds.slice(0, 3), ['b', 'a', 'c'], 'each kind first, by the arms order, then the spare');
	assert.ok(!binds.includes('k'), 'not a medkit');
	// kept where they are as more come
	inv.instances.d = { u: 'd', i: 'reedline-hunting-bow', l: 1, t: 0 };
	const next = hotbarBinds(inv, binds);
	assert.deepEqual(next.slice(0, 4), ['b', 'a', 'c', 'd']);
	// one sold leaves its key; the rest stay
	delete inv.instances.a;
	const after = hotbarBinds(inv, next);
	assert.equal(after[0], 'b'); assert.equal(after[2], 'c');
	assert.deepEqual(hotbarPress(after, 0, null), { hold: 'b' });
	assert.deepEqual(hotbarPress(after, 0, 'b'), { hold: null });
	assert.equal(hotbarPress([null], 0, null), null);
});

test('the look modes and the keys are wired', () => {
	const player = fs.readFileSync(new URL('../src/player.js', import.meta.url), 'utf8');
	assert.match(player, /e\.key !== 'Alt'/);
	// (a tap of Alt / Option each way: aiming lets the mouse go, and with it free takes it back; a
	// plain click on the world takes it back too, so nobody is stuck with the hand cursor)
	assert.match(player, /setLookMode\(s\.lookMode === 'camera' \? 'aim' : 'camera'\)/, 'Alt toggles between the camera and aiming');
	assert.match(player, /if \(tap\) setLookMode\('aim'\)/, 'a plain click takes the mouse back to aim');
	assert.match(player, /lookMode === 'camera'/);
	const idx = fs.readFileSync(new URL('../src/magic/index.js', import.meta.url), 'utf8');
	for (const k of ['Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyN']) assert.ok(idx.includes(k), k);
	const hb = fs.readFileSync(new URL('../src/combat/hotbar.js', import.meta.url), 'utf8');
	assert.match(hb, /Digit\(\[1-5\]\)/);
	const ai = fs.readFileSync(new URL('../src/combat/ai-squads.js', import.meta.url), 'utf8');
	assert.match(ai, /hexStep/); assert.match(ai, /ctx\.cloaked/);
	// (the spellbook is the skills menu now, magic/skills-ui.js: it is shut until opened)
});

test('every spell has a look of its own, and no two look alike', async () => {
	const THREE = await import('three');
	const { createMagicFx } = await import('../src/magic/fx.js');
	const { LOOK, LOOK_IDS } = await import('../src/magic/looks.js');
	for (const s of SPELLS) assert.ok(LOOK[s.id], 'a look for ' + s.id);
	assert.equal(LOOK_IDS.length, SPELLS.length);
	let seen = null;
	const fx = createMagicFx(new THREE.Scene(), { onEmit: (c, o) => seen?.add(`${o?.shape || 0}${o?.ink ? 'i' : ''}:${c.map((v) => v.toFixed(2)).join(',')}`) });
	const v = (x, y, z) => ({ x, y, z }), d = v(0, 0, -1), T = { bound: v(0, 1, -5) };
	const sigs = new Map();
	for (const id of LOOK_IDS) {
		seen = new Set();
		const L = LOOK[id];
		// each part drawn a few times (some draw by chance), with all it may be given
		for (let n = 0; n < 40; n++) {
			L.cast?.(fx, v(0, 1.5, 0)); L.trail?.(fx, v(0, 1.5, -2), d, 1); L.hit?.(fx, v(0, 1, -5), d);
			L.beam?.(fx, v(0, 1.5, 0), v(0, 1, -10), n / 10); L.tell?.(fx, v(0, 0, -8), 5, n / 40); L.blast?.(fx, v(0, 0, -8), 5);
			L.cone?.(fx, v(0, 1.6, 0), d, 8, 0.6); L.arc?.(fx, v(0, 1.5, 0), v(0, 1, -6)); L.orb?.(fx, v(0, 1, -4), n / 10);
			L.tick?.(fx, v(0, 0, -6), 5, n / 10); L.self?.(fx, v(0, 1.68, 0), [v(1, 1.68, 0), v(2, 1.68, 0)]); L.on?.(fx, v(0, 1.68, 0), n / 10, d, true);
			L.mark?.(fx, T, {}); L.body?.(fx, v(1, 1.5, 0), n / 10); L.spread?.(fx, v(0, 1, -5), v(2, 1, -6));
			L.fall?.(fx, v(0, 3, -6), v(0.3, 0.9, 0.2), n % 2 === 0); L.cloud?.(fx, v(0, 0, -8), 6); L.strike?.(fx, v(0, 15, -8), v(0, 0, -8)); L.rain?.(fx, v(0, 0, -8), 6);
		}
		assert.ok(seen.size > 0, id + ' draws something');
		sigs.set(id, [...seen].sort().join('|'));
	}
	const by = new Map();
	for (const [id, sg] of sigs) { assert.ok(!by.has(sg), `${id} looks just like ${by.get(sg)}`); by.set(sg, id); }
	fx.dispose();
});

test('Solar Flare needs the sun until it channels the moon; aether leans to your name', () => {
	const s = createMagicState();
	assert.equal(SPELL['solar-flare'].night, 'moon');
	assert.equal(moonlit(s, 'solar-flare'), false);
	assert.equal(grantMoonlit(s, 'sunspark'), false, 'only a spell of the sun can channel the moon');
	assert.equal(grantMoonlit(s, 'solar-flare'), true);
	assert.equal(grantMoonlit(s, 'solar-flare'), false, 'once');
	const back = createMagicState(JSON.parse(JSON.stringify(saveMagic(s))));
	assert.equal(moonlit(back, 'solar-flare'), true, 'kept between visits');
	assert.deepEqual(createMagicState({ v: 1, moonlit: ['sunspark', 'nope', 'solar-flare'] }).moonlit, ['solar-flare'], 'rubbish dropped');
	const src = fs.readFileSync(new URL('../src/magic/caster.js', import.meta.url), 'utf8');
	assert.match(src, /night && \(!moonlit\(state, spell\.id\)/, 'refused by night unless moonlit');
	// a saint gathers twice the light and half the dark; a monster the other way; no name, as it was
	assert.equal(aetherShare('light', 100), 2); assert.equal(aetherShare('dark', 100), 0.5);
	assert.equal(aetherShare('dark', -100), 2); assert.equal(aetherShare('light', -100), 0.5);
	assert.equal(aetherShare('light', 0), 1); assert.equal(aetherShare('dark', 500), 0.5, 'bounded');
	assert.deepEqual(gatherShare(50), { light: 1.5, dark: 0.75 });
});

test('each element does its own thing to the one it strikes', async () => {
	const THREE = await import('three');
	const { createMagicFx } = await import('../src/magic/fx.js');
	const { ELEMENTS, createAfflictions } = await import('../src/magic/elements.js');
	// every damage type a spell deals has an affliction, named and worded for the menu
	for (const s of SPELLS) if (s.type) assert.ok(ELEMENTS[s.type]?.name && ELEMENTS[s.type].text.length > 20, `${s.id}: ${s.type} has an effect`);
	const fx = createMagicFx(new THREE.Scene());
	const dealt = [], hexes = [];
	const foe = (kind = 'hostile') => ({ kind, bound: { x: 0, y: 1, z: -5 } }), other = foe();
	const A = createAfflictions({ fx, deal: (T, n, type) => dealt.push({ T, n, type }), hex: (T, st) => hexes.push({ T, st }), near: (T) => (T === other ? null : other) });
	const run = (s) => { for (let t = 0; t < s; t += 0.1) A.step(0.1); };
	const sum = (type) => dealt.filter((d) => d.type === type).reduce((a, d) => a + d.n, 0);
	// fire burns for 40% of the blow over 4 s, all of it, and no more
	const f = foe(); A.apply(f, 'fire', 100, f.bound); run(5);
	assert.ok(Math.abs(sum('fire') - 40) < 0.01, 'burned ' + sum('fire'));
	// blight rots 30% over 6 s; radiant sears 25% over 3 s
	A.apply(foe(), 'blight', 100, f.bound); A.apply(foe(), 'radiant', 100, f.bound); run(7);
	assert.ok(Math.abs(sum('blight') - 30) < 0.01 && Math.abs(sum('radiant') - 25) < 0.01, `${sum('blight')} ${sum('radiant')}`);
	// frost slows, and the third chill in a row freezes
	const c = foe(); for (let i = 0; i < 3; i++) A.apply(c, 'frost', 10, c.bound);
	assert.deepEqual(hexes.filter((h) => h.T === c).map((h) => Object.keys(h.st)[0]), ['slow', 'slow', 'hold']);
	assert.ok(A.info(c).frozen > 1);
	// storm jolts and leaps 30% to the next foe
	const s = foe(); A.apply(s, 'storm', 50, s.bound);
	assert.ok(hexes.some((h) => h.T === s && h.st.hold === 0.35) && dealt.some((d) => d.T === other && d.n === 15));
	// shadow: dread, 15% more from you for 4 s
	const d = foe(); A.apply(d, 'shadow', 10, d.bound); assert.equal(A.vuln(d), 0.15); run(4.2); assert.equal(A.vuln(d), 0);
	// void: 30% again a moment later
	const v = foe(); A.apply(v, 'void', 100, v.bound); const before = sum('void'); run(1.2); assert.ok(Math.abs(sum('void') - before - 30) < 0.01);
	// anything vast takes the damage and the dread, but is never slowed, frozen or jolted
	const b = foe('boss'); hexes.length = 0; for (let i = 0; i < 3; i++) A.apply(b, 'frost', 10, b.bound); A.apply(b, 'storm', 10, b.bound); A.apply(b, 'shadow', 10, b.bound);
	assert.equal(hexes.length, 0); assert.equal(A.vuln(b), 0.15);
	fx.dispose();
});

test('things picked up and carried share the keys 1 to 5, after the field arms', () => {
	const inv = { hand: null, instances: { a: { u: 'a', i: 'warden-spark-carbine', l: 1, t: 0 } } };
	const carried = [{ id: 'm1', kind: 'bat', held: true }, { id: 'm2', kind: 'pipe', held: false }];
	const binds = hotbarBinds(inv, [], carried);
	assert.deepEqual(binds.slice(0, 3), ['a', 'm1', 'm2']);
	// a bat in hand: its key puts it away; the pipe's takes the pipe up
	assert.deepEqual(hotbarPress(binds, 1, 'm1'), { hold: null });
	assert.deepEqual(hotbarPress(binds, 2, 'm1'), { hold: 'm2' });
	// broken or dropped: its key frees
	assert.deepEqual(hotbarBinds(inv, binds, [{ id: 'm2', kind: 'pipe' }]).slice(0, 3), ['a', null, 'm2']);
});

test('a spell travels to friends as a marked shot and survives the room\'s rounding', async () => {
	const { encodeSpell, decodeSpell, roomRound, SPELL_STYLE } = await import('../src/magic/net.js');
	assert.equal(SPELL_STYLE, 7);
	const r = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
	for (const sp of SPELLS) {
		for (let k = 0; k < 4; k++) {
			const from = { x: (r() - 0.5) * 2e5, y: r() * 300, z: (r() - 0.5) * 2e5 }, to = { x: from.x + (r() - 0.5) * 200, y: from.y, z: from.z + (r() - 0.5) * 200 };
			const e = encodeSpell(sp.id, from, to);
			const b = { x: roomRound(e.b.x), y: roomRound(e.b.y), z: roomRound(e.b.z) };
			assert.equal(decodeSpell(b)?.id, sp.id, sp.id);
			assert.ok(Math.abs(b.x - to.x) < 0.2 && Math.abs(b.z - to.z) < 0.2, 'drawn where it went');
		}
	}
	assert.equal(encodeSpell('nope', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), null);
	// the room's own cleaner passes it through as it is
	const { cleanFx } = await import('../src/net/protocol.js');
	const e = encodeSpell('tempest', { x: 1, y: 2, z: 3 }, { x: 40, y: 2, z: -50 });
	const c = cleanFx({ s: [[e.a.x, e.a.y, e.a.z, e.b.x, e.b.y, e.b.z, SPELL_STYLE, 0]] });
	assert.equal(c.s[0][6], SPELL_STYLE);
	assert.equal(decodeSpell({ x: c.s[0][3], y: c.s[0][4], z: c.s[0][5] }).id, 'tempest');
});

test('spells reach brawlers and townsfolk, hands cast them, the body gestures, the bar sits low', () => {
	const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
	assert.match(src('magic/caster.js'), /T\.kind !== 'hostile' && T\.kind !== 'person'/, 'townsfolk take holds, slows and fear');
	assert.match(src('magic/caster.js'), /T\.P\.hex = H/, 'on the body, for a brawl');
	assert.match(src('combat/civilians.js'), /s\.T\.hex/);
	assert.match(src('combat/melee-foes.js'), /f\.T\?\.hex \|\| f\.P\?\.hex/);
	assert.match(src('people/motion.js'), /cast2?: \(u\)/);
	assert.match(src('magic/hands.js'), /createAnatomicalHand/);
	assert.match(src('combat/melee.js'), /function draw\(id\)/);
	const hud = src('magic/hud.js');
	assert.match(hud, /\.mg-bar\{position:absolute;left:50%;bottom:calc\(12px/, 'the bar at the bottom on a desktop');
	assert.match(hud, /\.mg-hub\{position:absolute;right:calc\(24px [^}]*bottom:calc\(226px/, 'on a touch screen a spell button tops the right thumb\'s column');
	assert.match(hud, /const RING = \{ s: \[100, \[64, 32, 0, -32, -64\]\], w: \[162, \[40, 20, 0, -20, -40\]\] \}/, 'spells on the inner arc, weapons on the outer');
	assert.match(hud, /if \(SPELL\[state\.binds\[last\]\]\) cast\(last\); else open\(\);/, 'a tap casts the last spell again');
	assert.doesNotMatch(hud, /SPELLS'|WEAPONS'|Test mode/, 'the arcs carry no words and no test mode');
	for (const id of ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine', 'reedline-hunting-bow', 'bat', 'pipe', 'bottle', 'knife', 'machete']) assert.match(hud, new RegExp(`\\n\\t'?${id}'?: '<`), `a picture for ${id}`);
	// (the spellbook is now the skills and magic menu, magic/skills-ui.js: shut until opened)
	assert.match(src('magic/skills-ui.js'), /let root = null, built = false, open = false/, 'the menu is shut until opened, so the keys work from the start');
});

test('a beam gathers, lets go with a punch, pours, and thins away', async () => {
	const { beamShape, CHARGE, MIN_BLAST } = await import('../src/magic/beam.js');
	assert.ok(CHARGE > 0.2 && CHARGE < 0.5 && MIN_BLAST > 0);
	assert.deepEqual(beamShape(-0.1), { out: 0, r: 0, a: 0 }, 'nothing poured while it gathers');
	const go = beamShape(0.01), on = beamShape(1.5);
	assert.ok(go.out < 1 && go.r > 1.4, 'its head racing out, wide with the punch');
	assert.equal(on.out, 1);
	assert.ok(Math.abs(on.r - 1) < 0.01 && Math.abs(on.a - 1) < 0.01, 'settled to a steady pour');
	assert.ok(beamShape(1.5, 0.1).r < 0.3 && beamShape(1.5, 0.3).a === 0, 'let go, it thins to nothing');
	const src = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
	const caster = src('magic/caster.js');
	assert.match(caster, /age: -CHARGE/, 'it gathers before it lets go');
	assert.match(caster, /H\.age >= MIN_BLAST/, 'a tap still lets it go');
	assert.match(caster, /shove\(h\.T, from/, 'its pressure drives fighters back');
	assert.match(caster, /beamVoice\(spell\.school\)/);
	assert.match(src('magic/index.js'), /beams\.show\(`net:\$\{who\}`/, 'a friend\'s beam pours steadily');
	assert.match(src('people/motion.js'), /beam: \(u, t\)/);
	assert.match(src('magic/hands.js'), /A\.to = BEAM/, 'both hands');
});
