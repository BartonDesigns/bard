// Law and order: the escalation ladder (witnesses call it in after a while and only if they
// saw it, who comes at each level, the military only at the top, arrests and fines, the
// search before the points ebb), the gangs' ground by region (corners, recruits, how they take
// a patrol), militia only out of town, and the street tactics (roadblocks on the road ahead,
// nothing appearing in view, falling back when outnumbered, out of buildings).
// node --test island/tools/escalation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLadder, witness, dueReports, pending, responsePlan, routeTrouble, complying, arrestable, fineFor, reportDelay, SEARCH, LEVELS, searchLoop, createDamageLog, smashed, SPREE } from '../src/law/ladder.js';
import { territoryAt, cornerSize, recruits, junctions, pickCorners, gangStance, warChance, militiaAllowed, lowMorality, GANGS, CELL } from '../src/law/gangs.js';
import { insideBox, pushOut, roadblockSpot, blockSlots, hiddenSpot, inCone, squadMorale, offscreenPace } from '../src/law/tactics.js';
import { createWanted, offend, tickWanted, sighted, STARS, defend, officerHurt, tickDefence, clearWanted, DEFENCE } from '../src/combat/heat.js';
import { policePlan } from '../src/military/rules.js';
import { FACTIONS, createRelations, ATTACK, attackGap, raidWobble } from '../src/combat/factions.js';
import { outfitFor, lookOf } from '../src/combat/outfits.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('a crime nobody saw is nobody\'s business; one a passer-by saw is called in after a while', () => {
	const L = createLadder();
	assert.equal(witness(L, { kind: 'hitCivilian', at: { x: 0, z: 0 }, t: 0, witnesses: 0 }), null);
	assert.equal(pending(L), 0);
	assert.equal(witness(L, { kind: 'hitCivilian', at: { x: 0, z: 0 }, t: 0, witnesses: 1 }, () => 0.5), 'later');
	assert.equal(dueReports(L, 1).length, 0, 'not at once');
	const q = L.reports[0];
	assert.ok(q.due >= 9 && q.due <= 20, `delay ${q.due}`);
	const due = dueReports(L, q.due + 0.01);
	assert.equal(due.length, 1);
	assert.equal(due[0].call, 'assault');
	assert.equal(due[0].seen, true);
	assert.equal(dueReports(L, q.due + 5).length, 0, 'called in once');
});

test('one broken window is nobody\'s police matter; smashing things on purpose is vandalism', () => {
	const D = createDamageLog();
	assert.equal(smashed(D, { x: 0, z: 0 }, 0), null, 'one window');
	assert.equal(smashed(D, { x: 3, z: 0 }, 10), null, 'two, a while apart');
	assert.equal(smashed(D, { x: 6, z: 0 }, 14), 'vandalism', 'the third in half a minute');
	assert.equal(smashed(D, { x: 8, z: 0 }, 16), 'prop', 'more of the same spree');
	// broken here and there over the day never adds up
	const E = createDamageLog();
	for (let i = 0; i < 10; i++) assert.equal(smashed(E, { x: 0, z: 0 }, i * (SPREE.window * 0.6)), null);
	// nor do things far apart
	const F = createDamageLog();
	for (let i = 0; i < 6; i++) assert.equal(smashed(F, { x: i * 200, z: 0 }, i), null);
	// a spree is called in as damage to property, one patrol car's worth
	const L = createLadder();
	assert.equal(witness(L, { kind: 'vandalism', at: { x: 0, z: 0 }, t: 0, witnesses: 2 }, () => 0.5), 'later');
	assert.equal(L.reports[0].call, 'damage');
	const W = createWanted();
	offend(W, 'vandalism');
	assert.equal(W.stars, 1);
});

test('fired on first, you answer it: a blue star, no crime; hurt an officer three times and they turn', () => {
	const W = createWanted();
	assert.equal(defend(W), true, 'turns blue');
	assert.equal(W.blue, 1);
	assert.equal(W.stars, 0, 'no yellow star');
	assert.equal(defend(W), false, 'already blue');
	assert.equal(officerHurt(W, 0), 'warn');
	assert.equal(officerHurt(W, 0.5), 'same', 'one burst is one time');
	assert.equal(officerHurt(W, 3), 'warn');
	assert.equal(officerHurt(W, 6), 'turn', 'the third time');
	assert.equal(W.blue, 0);
	assert.equal(officerHurt(W, 9), 'crime', 'no blue: an offence as ever');
	// the blue holds while they are still after you, and goes a while after
	defend(W);
	tickDefence(W, DEFENCE.last + 5, true);
	assert.equal(W.blue, 1);
	tickDefence(W, DEFENCE.last - 1, false);
	assert.equal(W.blue, 1);
	tickDefence(W, 2, false);
	assert.equal(W.blue, 0);
	// a yellow star (a crime of your own) ends it, and none comes while you have one
	defend(W); offend(W, 'hitCivilian'); tickDefence(W, 0.1, true);
	assert.equal(W.blue, 0);
	assert.equal(defend(W), false);
	clearWanted(W);
	assert.equal(W.blue, 0);
	// called in like gunfire: heard where people are, seen by passers-by
	const L = createLadder();
	assert.equal(witness(L, { kind: 'defence', at: { x: 0, z: 0 }, t: 0, witnesses: 0, heard: false }), null, 'out in the empty country nobody hears it');
	assert.equal(witness(L, { kind: 'defence', at: { x: 0, z: 0 }, t: 0, witnesses: 0, heard: true }, () => 0.5), 'later');
	assert.equal(L.reports[0].call, 'defence');
	assert.ok(L.reports[0].due <= 10);
});

test('attacks on you are paced events: 15 minutes on their ground, 30 elsewhere, a rare raid with no ground', () => {
	assert.equal(attackGap(FACTIONS.ashfang, 'wild'), 15 * 60);
	assert.equal(attackGap(FACTIONS.ashfang, 'village'), 30 * 60);
	assert.equal(attackGap(FACTIONS.halcyon, 'earth-urban'), ATTACK.raid);
	assert.ok(ATTACK.raid > ATTACK.away && ATTACK.away > ATTACK.home);
	// a raid never on the dot: 45 minutes and up to 35 more
	assert.equal(raidWobble(() => 0), 0);
	assert.equal(raidWobble(() => 0.999999) < 35 * 60, true);
	assert.equal(attackGap(FACTIONS.halcyon, 'earth-urban', raidWobble(() => 0.5)), 45 * 60 + 17.5 * 60);
	assert.equal(attackGap(FACTIONS.ashfang, 'wild', 0), 15 * 60, 'never sooner than 15 minutes on its ground');
	assert.equal(attackGap(FACTIONS.ashfang, 'wild', 35 * 60), 15 * 60 + 35 * 60 / 3, 'the same share of the wobble as a raid');
	assert.equal(attackGap(FACTIONS.ashfang, 'village', 35 * 60), 30 * 60 + 70 * 60 / 3);
});

test('an officer who sees it counts it at once; several witnesses make one call, sooner', () => {
	const L = createLadder();
	assert.equal(witness(L, { kind: 'hitCivilian', at: { x: 0, z: 0 }, t: 0, police: true }), 'now');
	assert.equal(witness(L, { kind: 'hitPolice', at: { x: 0, z: 0 }, t: 0, witnesses: 0 }), 'now', 'hurting an officer is always known');
	const one = reportDelay('assault', 1, () => 0.5), four = reportDelay('assault', 4, () => 0.5);
	assert.ok(four < one);
	witness(L, { kind: 'shots', at: { x: 5, z: 5 }, t: 0, witnesses: 1 }, () => 0.5);
	witness(L, { kind: 'shots', at: { x: 8, z: 2 }, t: 0.5, witnesses: 2 }, () => 0.5);
	witness(L, { kind: 'shots', at: { x: 6, z: 6 }, t: 1, witnesses: 1 }, () => 0.5);
	assert.equal(pending(L), 1);
	assert.equal(L.reports[0].weight, 3);
	// a worse offence folds into the call
	witness(L, { kind: 'downCivilian', at: { x: 400, z: 0 }, t: 0, witnesses: 1 });
	witness(L, { kind: 'hitCivilian', at: { x: 405, z: 0 }, t: 1, witnesses: 1 });
	assert.equal(L.reports.find((q) => q.at.x === 400).kind, 'downCivilian');
});

test('gunfire only heard is reported as shots fired, with no description of you', () => {
	const L = createLadder();
	assert.equal(witness(L, { kind: 'shots', at: { x: 0, z: 0 }, t: 0, witnesses: 0, heard: true }), 'later');
	const [q] = dueReports(L, 60);
	assert.equal(q.call, 'shots');
	assert.equal(q.seen, false);
	// others' trouble carries its event, and the worst severity heard
	witness(L, { kind: 'gang', at: { x: 0, z: 900 }, t: 0, witnesses: 0, heard: true, ev: { kind: 'gang', x: 0, z: 900, severity: 1 }, severity: 1 });
	witness(L, { kind: 'gang', at: { x: 10, z: 900 }, t: 2, witnesses: 2, heard: true, ev: { kind: 'gang', x: 10, z: 900, severity: 2 }, severity: 2 });
	const [g] = dueReports(L, 100);
	assert.equal(g.severity, 2);
	assert.equal(g.ev.kind, 'gang');
});

test('the ladder: who comes at each level, the military only at the top, guns holstered for an unarmed suspect', () => {
	assert.equal(LEVELS.length, 6);
	const p = [0, 1, 2, 3, 4, 5].map((l) => responsePlan(l));
	assert.equal(p[0].cars, 0);
	assert.equal(p[1].cars, 1);
	assert.equal(p[2].cars, 2);
	assert.equal(p[3].blocks, 1);
	assert.equal(p[4].swat, 1);
	for (let l = 0; l < 5; l++) assert.equal(p[l].military, null, `no military at ${l}`);
	assert.equal(p[5].military, 'convoy');
	// lethal force only for an armed suspect, one who has fired, or at the top
	assert.equal(responsePlan(1).lethal, false);
	assert.equal(responsePlan(2).lethal, false);
	assert.equal(responsePlan(2, { armed: true }).lethal, true);
	assert.equal(responsePlan(1, { fired: true }).lethal, true);
	assert.equal(responsePlan(4).lethal, true);
	// a phone sends fewer
	const ph = responsePlan(5, { phone: true });
	assert.ok(ph.cars <= 2 && ph.blocks <= 1 && ph.swatSize <= 3);
	// the old plan agrees: the military backs the police only at five
	assert.equal(policePlan(4, 5).backup, null);
	assert.ok(policePlan(5, 6).backup);
});

test('trouble among others: the police first, the tactical team for a bad gang fight, the military for wars, bosses, invasions', () => {
	assert.equal(routeTrouble({ kind: 'brawl' }), 'police');
	assert.equal(routeTrouble({ kind: 'gang', severity: 1 }), 'police');
	assert.equal(routeTrouble({ kind: 'gang', severity: 2 }), 'swat');
	assert.equal(routeTrouble({ kind: 'gang', severity: 3 }), 'military');
	assert.equal(routeTrouble({ kind: 'boss', severity: 1 }), 'military');
	assert.equal(routeTrouble({ kind: 'invasion' }), 'military');
	assert.equal(routeTrouble({ kind: 'wanted', severity: 2 }), 'police');
	assert.equal(routeTrouble({ kind: 'wanted', severity: 3 }), 'military');
	assert.equal(routeTrouble({ kind: 'shots' }), 'police');
});

test('de-escalation: out of sight they search a while before the points ebb, longer the hotter it was', () => {
	for (let i = 1; i < SEARCH.length; i++) assert.ok(SEARCH[i] > SEARCH[i - 1]);
	const W = createWanted(0);
	offend(W, 'downCivilian'); offend(W, 'downCivilian');
	const stars = W.stars, points = W.points;
	assert.ok(stars >= 2);
	sighted(W, { x: 10, z: 20 });
	assert.deepEqual(W.last, { x: 10, z: 20 });
	// out of sight, but still searching: nothing ebbs yet
	for (let i = 0; i < SEARCH[stars] - 1; i++) tickWanted(W, 1, false);
	assert.equal(W.points, points);
	// seen again: the search starts over, and the police know where you are
	tickWanted(W, 1, true, { x: 50, z: 60 });
	assert.equal(W.quiet, 0);
	assert.deepEqual(W.last, { x: 50, z: 60 });
	for (let i = 0; i < 200; i++) tickWanted(W, 1, false);
	assert.equal(W.stars, 0);
	// a reported shooting is a star; shots alone still never pass two
	const G = createWanted(0);
	offend(G, 'gunfire');
	assert.equal(G.stars, 1);
	const E = createWanted(0);
	offend(E, 'hitCivilian'); offend(E, 'evade');
	assert.ok(E.points >= STARS[2], 'running from the police makes it a pursuit');
});

test('arrests: giving up near an officer, or downed with officers near; booked and fined', () => {
	assert.equal(complying({ armed: false, speed: 0, stillT: 3.5, officerD: 12 }), true);
	assert.equal(complying({ armed: true, speed: 0, stillT: 9, officerD: 12 }), false, 'armed is not giving up');
	assert.equal(complying({ armed: false, speed: 0, stillT: 1, officerD: 12 }), false, 'not yet');
	assert.equal(complying({ armed: false, speed: 0, stillT: 9, officerD: 80 }), false, 'nobody to give up to');
	assert.equal(complying({ handsUp: true, officerD: 20 }), true);
	assert.equal(complying({ handsUp: true, armed: true, officerD: 20 }), false);
	assert.equal(arrestable({ level: 2, downed: true, officerD: 30 }), true);
	assert.equal(arrestable({ level: 0, downed: true, officerD: 5 }), false, 'nobody is after you');
	assert.equal(arrestable({ level: 2, downed: true, officerD: 200 }), false, 'no officer near: the hospital');
	assert.equal(arrestable({ level: 1, complies: true, officerD: 2 }), true);
	const small = fineFor({ points: 12, peak: 1 }), big = fineFor({ points: 150, peak: 4, resisted: true });
	assert.ok(small > 0 && big > small && big <= 5000);
	assert.equal(small % 10, 0);
	const loop = searchLoop({ x: 0, z: 0 }, 20, 4);
	assert.equal(loop.length, 4);
	for (const [x, z] of loop) assert.ok(Math.abs(Math.hypot(x, z) - 20) < 1e-9);
});

test('gangs hold ground by region: more of it where trouble is high and morality low, in stretches, with borders', () => {
	const count = (opts, region = 'bay.east') => { let n = 0; const seen = new Set(); for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const T = territoryAt(region, i * CELL + 5, j * CELL + 5, opts); if (T?.gang) { n++; seen.add(T.gang); } } return { n, gangs: seen.size }; };
	const calm = count({ trouble: 0.1, tally: null }), rough = count({ trouble: 0.5, tally: null }), lawless = count({ trouble: 0.5, tally: { law: -50, protect: -45 } });
	assert.ok(calm.n < rough.n && rough.n < lawless.n, `${calm.n} ${rough.n} ${lawless.n}`);
	assert.equal(lawless.gangs, 2);
	assert.equal(territoryAt('bay.east', 0, 0, { urban: 0.1 }), null, 'not in the country');
	// the same every visit
	assert.deepEqual(territoryAt('bay.sf', 1234, 5678, { trouble: 0.5 }), territoryAt('bay.sf', 1234, 5678, { trouble: 0.5 }));
	// neighbouring held cells mostly share an owner; where they differ it is a border
	let same = 0, diff = 0, borders = 0;
	for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
		const a = territoryAt('bay.east', i * CELL + 5, j * CELL + 5, { trouble: 0.7 }), b = territoryAt('bay.east', (i + 1) * CELL + 5, j * CELL + 5, { trouble: 0.7 });
		if (a?.gang && b?.gang) { if (a.gang === b.gang) same++; else diff++; }
		if (a?.border) borders++;
	}
	assert.ok(same > diff * 1.5, `${same} vs ${diff}`);
	assert.ok(borders > 0);
	assert.ok(lowMorality({ law: -40, protect: -40 }) === 1 && lowMorality({ law: 20, protect: 30 }) === 0);
	assert.ok(GANGS.every((g) => FACTIONS[g]?.kind === 'gang'));
});

test('corner crews: a few on a corner, more in the evening and where strong, recruits where the region has gone wrong', () => {
	const T = { gang: 'copperline', strength: 0.7, low: 0.8 };
	assert.equal(cornerSize(null), 0);
	assert.ok(cornerSize(T, { hour: 21 }) > cornerSize({ ...T, strength: 0.2 }, { hour: 11 }));
	assert.ok(cornerSize(T, { hour: 21, phone: true }) <= 3);
	let n = 2, m = 2;
	for (let i = 0; i < 400; i++) { n = recruits(n, 5, 0.9, 1, seq(0.005)); m = recruits(m, 5, 0, 1, seq(0.005)); }
	assert.equal(n, 5, 'recruits where it has gone wrong');
	assert.equal(m, 2, 'hardly at all where it has not');
	// the corners: where streets meet
	const roads = [{ pts: [0, 0, 50, 0], cls: 'residential' }, { pts: [50, 0, 50, 60], cls: 'residential' }, { pts: [50, 0, 100, 0], cls: 'residential' }, { pts: [200, 0, 300, 0], cls: 'residential' }, { pts: [0, 0, 0, -40], cls: 'footway' }];
	const J = junctions(roads);
	assert.equal(J.length, 1);
	assert.deepEqual([J[0].x, J[0].z, J[0].n], [50, 0, 3]);
	const many = []; for (let i = 0; i < 60; i++) many.push({ x: 60 + i * 7, z: 20, n: 2 });
	const a = pickCorners(many, 'bay.sf', { x: 0, z: 0 }, { n: 2 }), b = pickCorners(many, 'bay.sf', { x: 0, z: 0 }, { n: 2 });
	assert.deepEqual(a, b);
	for (const c of a) assert.ok(c.d >= 60 && c.d <= 170);
});

test('a corner crew drifts off when a patrol pulls up, squares up to rivals, and fights only when it is a fight', () => {
	assert.equal(gangStance({}), 'hold');
	assert.equal(gangStance({ policeNear: 2 }), 'disperse');
	assert.equal(gangStance({ rivalsNear: 3 }), 'square-up');
	assert.equal(gangStance({ provoked: true, policeNear: 2 }), 'fight');
	assert.equal(gangStance({ alert: true, outnumbered: true }), 'scatter');
	assert.ok(warChance({ gang: 'glasshouse', border: true, strength: 0.5, low: 0 }) > warChance({ gang: 'glasshouse', border: false, strength: 0.5, low: 0 }));
	assert.equal(warChance(null), 0);
	// gangs do not stand with the police, and the tactical team stands with the police
	const R = createRelations();
	assert.ok(R.hostile('copperline', 'police'));
	assert.ok(R.allied('swat', 'police'));
	assert.ok(R.hostile('swat', 'copperline'));
	assert.equal(lookOf(outfitFor({ fid: 'swat', kind: FACTIONS.swat.kind, colors: FACTIONS.swat.colors }, 7)), 'police');
});

test('militia only out of town', () => {
	assert.equal(militiaAllowed({ urban: 0, built: 0, townD: 4000 }), true);
	assert.equal(militiaAllowed({ urban: 0.3, built: 0, townD: 4000 }), false);
	assert.equal(militiaAllowed({ urban: 0, built: 12, townD: 4000 }), false, 'a suburb');
	assert.equal(militiaAllowed({ urban: 0, built: 0, townD: 600 }), false, 'the edge of a town');
	assert.equal(FACTIONS.ridgeback.zones.length, 0);
});

test('roadblocks: on the road ahead of the suspect, the cars across it, the officers behind them', () => {
	const roads = [
		{ pts: [0, 0, 0, 100, 0, 200, 0, 300, 0, 400], cls: 'primary' },
		{ pts: [-300, 150, -200, 150, -100, 150], cls: 'residential' },
		{ pts: [0, -150, 0, -250, 0, -350], cls: 'primary' },
		{ pts: [10, 180, 10, 190, 10, 200], cls: 'footway' },
	];
	const spot = roadblockSpot(roads, { x: 0, z: 0 }, { x: 0, z: 1 });
	assert.ok(spot, 'found');
	assert.ok(spot.z > 0 && spot.d >= 130 && spot.d <= 260, JSON.stringify(spot));
	assert.ok(Math.abs(spot.tz) > 0.99, 'the road runs along');
	assert.equal(roadblockSpot(roads, { x: 0, z: 0 }, { x: 1, z: 0 }), null, 'nothing ahead that way');
	const { cars, post } = blockSlots(spot, { x: 0, z: 0 }, 2);
	assert.equal(cars.length, 2);
	// across the road: side by side across it, turned square to it
	assert.ok(Math.abs(cars[0].z - cars[1].z) < 1e-9 && Math.abs(cars[0].x - cars[1].x) > 2.5);
	for (const c of cars) assert.ok(Math.abs(Math.cos(c.yaw - spot.yaw)) < 0.3);
	// the officers behind them, away from the suspect
	assert.ok(post.z > spot.z);
});

test('nothing appears in front of you: a spot out of view or behind something', () => {
	const eye = { x: 0, z: 0 }, dir = { x: 0, z: -1 };
	assert.equal(inCone(eye, dir, 0, -50), true);
	assert.equal(inCone(eye, dir, 0, 50), false);
	const ahead = { x: 0, z: -60 }, behind = { x: 5, z: 70 };
	assert.deepEqual(hiddenSpot([ahead, behind], eye, dir), behind);
	assert.deepEqual(hiddenSpot([ahead], eye, dir, (x, z) => z < -30), ahead, 'behind a wall');
	assert.equal(hiddenSpot([ahead], eye, dir), null, 'in plain view and near: nowhere');
	assert.ok(offscreenPace(800, 18) > 18 && offscreenPace(100, 18) === 18);
});

test('a squad that is losing and outnumbered falls back; soldiers and police hold longer', () => {
	assert.equal(squadMorale({ alive: 4, start: 4, enemies: 3 }), 'hold');
	assert.equal(squadMorale({ alive: 2, start: 4, enemies: 4 }), 'fallback');
	assert.equal(squadMorale({ alive: 1, start: 3, enemies: 3 }), 'rout');
	assert.equal(squadMorale({ alive: 1, start: 3, enemies: 3, kind: 'military' }), 'fallback');
	assert.equal(squadMorale({ alive: 2, start: 4, enemies: 3, kind: 'police' }), 'hold');
	assert.equal(squadMorale({ alive: 1, start: 3, enemies: 3, kind: 'machines' }), 'hold');
	assert.equal(squadMorale({ alive: 3, start: 3, enemies: 0 }), 'hold');
});

test('out of buildings: a body that walks into a box is put back outside it', () => {
	const b = { x: 10, z: 10, w: 8, d: 4, a: 0.6 };
	assert.equal(insideBox(b, 10, 10), true);
	assert.equal(insideBox(b, 30, 10), false);
	const p = { x: 10.5, z: 10.2 };
	assert.equal(pushOut([b], p), true);
	assert.equal(insideBox(b, p.x, p.z, 0.3), false);
	const q = { x: 40, z: 40 };
	assert.equal(pushOut([b], q), false);
	assert.deepEqual(q, { x: 40, z: 40 });
});
