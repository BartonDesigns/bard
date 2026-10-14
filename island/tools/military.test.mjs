// The military, the police, the clothing of the armed sides and fists: siting bases, who may
// stand where (no militia roams), the dispatch, the police plan, escalation, and that minors
// are never targets. node island/tools/military.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { siteScore, chooseSite, baseLayout, interiorFrames, garrisonPlan, mayStation, militiaCamps, planDispatch, policePlan, globeSites, BAY_SITES, invasionPlan, toLocal, toWorld, FORCES } from '../src/military/rules.js';
import { FACTIONS, factionsFor, createRelations } from '../src/combat/factions.js';
import { outfitFor, lookOf } from '../src/combat/outfits.js';
import { canMelee, escalate, STAGES, nextBlow, blowDamage, brawlResponse, improvised } from '../src/combat/brawl.js';

// a flat plain at 12 m with a town to the east (x > 3000) and the sea to the south (z > 2000)
const plain = { height: (x, z) => (z > 2000 ? -2 : 12 + Math.sin(x * 0.01) * 0.4), water: (x, z) => z > 2000, urban: (x) => (x > 3000 ? 0.6 : 0), built: (x) => (x > 3000 ? 40 : 0), road: () => 800, coast: (x, z) => Math.abs(2000 - z) };
// hills: steep everywhere
const hills = { height: (x, z) => Math.sin(x * 0.02) * 40 + Math.cos(z * 0.017) * 35 + 140, water: () => false, urban: () => 0, built: () => 0 };

test('a base is sited on open flat land, never in a town, the sea or the hills', () => {
	const L = baseLayout('garrison', 5);
	const ok = siteScore(plain, 0, 0, 0, L.W, L.D);
	assert.equal(ok.ok, true);
	assert.ok(ok.floor && Number.isFinite(ok.floor.c));
	// the pad stands above every bit of ground under it
	for (const [lx, lz] of [[-L.W / 2, -L.D / 2], [L.W / 2, L.D / 2], [0, 0]]) assert.ok(ok.floor.a * lx + ok.floor.b * lz + ok.floor.c >= plain.height(lx, lz) - 1e-6);
	assert.equal(siteScore(plain, 3600, 0, 0, L.W, L.D).why, 'town');
	assert.equal(siteScore(plain, 0, 2050, 0, L.W, L.D).why, 'water');
	assert.ok(['slope', 'rough'].includes(siteScore(hills, 0, 0, 0, L.W, L.D).why));
	// a candidate in the town is moved out of it to open ground nearby
	const moved = chooseSite(plain, { x: 3100, z: 0, yaw: 0 }, L.W, L.D);
	assert.ok(moved && moved.x < 3000 - L.W / 2 + 200, `moved to ${moved?.x}`);
	assert.equal(chooseSite(hills, { x: 0, z: 0 }, L.W, L.D), null);
});

test('the base layout has the buildings, an airstrip, parked vehicles, posts and interior frames', () => {
	const A = baseLayout('airbase', 9), G = baseLayout('garrison', 9);
	const types = new Set(A.buildings.map((b) => b.type));
	for (const t of ['gate', 'guardhouse', 'barracks', 'hq', 'armoury', 'motorpool', 'hangar', 'tower', 'control', 'helipad', 'runway', 'taxiway', 'apron']) assert.ok(types.has(t), t);
	assert.ok(A.runway.w >= 900);
	assert.ok(!G.buildings.some((b) => b.type === 'runway'));
	const kinds = new Set(A.parked.map((p) => p.kind));
	for (const k of ['tank', 'apc', 'jeep', 'heli', 'jet']) assert.ok(kinds.has(k), k);
	assert.ok(!G.parked.some((p) => p.kind === 'jet'));
	// everything inside the fence
	for (const b of A.buildings) assert.ok(Math.abs(b.x) <= A.W / 2 + 1 && Math.abs(b.z) <= A.D / 2 + 1, b.type);
	for (const p of A.parked) assert.ok(Math.abs(p.x) < A.W / 2 && Math.abs(p.z) < A.D / 2, p.kind);
	const F = interiorFrames(A);
	assert.deepEqual([...new Set(F.map((f) => f.builder))].sort(), ['barracks', 'depot', 'warRoom']);
	for (const f of F) assert.ok(f.w > 0 && f.d > 0 && f.floorH > 2.5);
	// the frame round trip
	const B = { x: 100, z: -50, yaw: 0.7 };
	const [wx, wz] = toWorld(B, 30, -12), [lx, lz] = toLocal(B, wx, wz);
	assert.ok(Math.abs(lx - 30) < 1e-9 && Math.abs(lz + 12) < 1e-9);
});

test('the garrison: gate and patrol first, fewer on a phone', () => {
	const L = baseLayout('airbase', 3);
	const desk = garrisonPlan(L), phone = garrisonPlan(L, { phone: true });
	assert.equal(desk[0].post.kind, 'gate');
	assert.ok(desk.some((g) => g.post.kind === 'tower'));
	assert.ok(phone.reduce((a, g) => a + g.n, 0) <= 5);
	assert.ok(desk.reduce((a, g) => a + g.n, 0) <= 12);
});

test('no militia roams: stationed sides stand only at posts; nobody spawns them by zone', () => {
	for (const z of ['earth-rural', 'earth-urban', 'earth-coast', 'earth-desert', 'wild', 'arid', 'village']) {
		for (const f of factionsFor(z)) assert.ok(!['militia', 'military'].includes(FACTIONS[f].kind), `${f} in ${z}`);
	}
	const R = { ...FACTIONS.ridgeback, id: 'ridgeback' }, G = { ...FACTIONS.guard, id: 'guard' };
	assert.equal(R.stationed, true);
	assert.equal(G.stationed, true);
	const posts = [{ x: 0, z: 0, r: 60 }, { x: 500, z: 500, r: 70, fid: 'ridgeback' }];
	assert.equal(mayStation(R, 10, 10, posts), true);
	assert.equal(mayStation(R, 300, 0, posts), false);
	assert.equal(mayStation(G, 520, 480, posts), false, 'a soldier at a militia compound');
	assert.equal(mayStation(R, 520, 480, posts), true);
	assert.equal(mayStation({ ...FACTIONS.copperline, id: 'copperline' }, 9999, 9999, []), true, 'gangs are not stationed');
	// the compounds are fixed: the same wherever you ask from
	const a = militiaCamps(0, 0, 7, 3000), b = militiaCamps(800, -600, 7, 3000);
	const shared = a.filter((c) => b.some((d) => d.id === c.id));
	assert.ok(shared.length > 0);
	for (const c of shared) { const d = b.find((q) => q.id === c.id); assert.equal(c.x, d.x); assert.equal(c.z, d.z); }
});

test('the dispatch: the nearest ready base answers, by road when near, by air when far', () => {
	const bases = [
		{ id: 'a', name: 'A', x: 0, z: 0, units: { tank: 2, apc: 2, jeep: 3, heli: 1, jet: 2 } },
		{ id: 'b', name: 'B', x: 60000, z: 0, units: { tank: 1, apc: 1, jeep: 2, heli: 2, jet: 0 } },
	];
	const gang = planDispatch({ kind: 'gang', x: 3000, z: 0, severity: 1 }, bases);
	assert.equal(gang.base, 'a'); assert.equal(gang.mode, 'road'); assert.ok(gang.units.includes('jeep'));
	assert.ok(!gang.units.includes('jet'));
	// too far for a gang call from either
	assert.equal(planDispatch({ kind: 'gang', x: 30000, z: 0 }, bases), null);
	// a boss far from A: B is nearer and sends by road
	const boss = planDispatch({ kind: 'boss', x: 50000, z: 0, severity: 3 }, bases);
	assert.equal(boss.base, 'b'); assert.ok(boss.units.includes('tank')); assert.ok(boss.units.includes('heli'));
	// a busy base passes the call on
	const busy = planDispatch({ kind: 'gang', x: 3000, z: 0, t: 10 }, [{ ...bases[0], busyUntil: 100 }, bases[1]]);
	assert.equal(busy, null);
	// an invasion far from both: air
	const inv = planDispatch({ kind: 'invasion', x: 0, z: 100000, severity: 3 }, bases);
	assert.equal(inv.mode, 'air'); assert.ok(inv.units.every((u) => u === 'heli' || u === 'jet'));
	assert.ok(inv.eta > 0);
	const plan = invasionPlan({ x: 0, z: 0 }, () => 0.5);
	assert.ok(Math.hypot(plan.from.x, plan.from.z) > 2000);
	assert.ok(FORCES.invasion.reach > FORCES.gang.reach);
});

test('the police plan follows the wanted level, the military backs them at four stars', () => {
	assert.deepEqual(policePlan(1, 2, 0), { cruisers: 1, officers: 2, backup: null });
	assert.equal(policePlan(3, 4, 2).cruisers, 1);
	assert.equal(policePlan(4, 5, 0).backup, 'road');
	assert.equal(policePlan(5, 6, 0).backup, 'air');
	assert.equal(policePlan(2, 3, 5).cruisers, 0);
});

test('bases everywhere on Earth: the Bay sites and a seeded globe grid', () => {
	assert.ok(BAY_SITES.length >= 3);
	for (const s of BAY_SITES) assert.ok(!/air force|army|navy|marine|national guard/i.test(s.name), s.name);
	const lisbon = globeSites(38.7, -9.1, 3), again = globeSites(38.7, -9.1, 3);
	assert.ok(lisbon.length > 0);
	assert.deepEqual(lisbon, again);
	assert.ok(lisbon.some((s) => s.kind === 'airbase') || globeSites(10, 20, 6).some((s) => s.kind === 'airbase'));
	assert.equal(globeSites(37.8, -122.3, 0.4).length, 0, 'the Bay keeps its own');
});

test('each side has its look: urban gangs, camouflage and modern militia, soldiers, police', () => {
	const looks = (fid, n = 40) => { const F = FACTIONS[fid], s = new Set(); for (let i = 1; i <= n; i++) s.add(lookOf(outfitFor({ fid, kind: F.kind, colors: F.colors, masked: F.masked }, i * 7919))); return s; };
	assert.ok(looks('copperline').has('urban'));
	const m = looks('ridgeback');
	assert.ok(m.has('camouflage') && m.has('modern-militia'), [...m].join());
	assert.deepEqual([...looks('guard')], ['soldier']);
	assert.deepEqual([...looks('police')], ['police']);
	// modern militia: a carrier and a baseball or trucker cap
	for (let i = 1; i < 60; i++) {
		const o = outfitFor({ fid: 'ridgeback', kind: 'militia', colors: FACTIONS.ridgeback.colors }, i * 104729);
		if (lookOf(o) !== 'modern-militia') continue;
		assert.ok(o.acc.some((q) => q.kind === 'cap' || q.kind === 'trucker'));
	}
	// the same seed, the same clothes
	assert.deepEqual(outfitFor({ fid: 'glasshouse', kind: 'gang', colors: ['#111111', '#eeeeee'] }, 42), outfitFor({ fid: 'glasshouse', kind: 'gang', colors: ['#111111', '#eeeeee'] }, 42));
	// police and soldiers are distinct at a glance
	const pol = outfitFor({ fid: 'police', kind: 'police', colors: FACTIONS.police.colors }, 3), sol = outfitFor({ fid: 'guard', kind: 'military', colors: FACTIONS.guard.colors }, 3);
	assert.notEqual(pol.top.pat, sol.top.pat);
});

test('the police and soldiers stand with the townsfolk; invaders against everyone', () => {
	const R = createRelations();
	assert.equal(R.stance('guard', 'police'), 'allied');
	assert.equal(R.stance('police', 'civ'), 'allied');
	assert.equal(R.stance('ironvale', 'guard'), 'hostile');
	assert.equal(R.stance('copperline', 'police'), 'hostile');
	assert.equal(R.stance('player', 'police'), 'neutral');
});

test('fists: minors and the surrendered are never targets; a quarrel climbs and cools', () => {
	assert.equal(canMelee({ id: 'k', child: true }), false);
	assert.equal(canMelee({ id: 'k', P: { dna: { child: true } } }), false);
	assert.equal(canMelee({ id: 't', P: { dna: { age: 16 } } }), false);
	assert.equal(canMelee({ id: 's', surrendered: true }), false);
	assert.equal(canMelee({ id: 'a', P: { dna: { age: 30 } } }), true);
	assert.deepEqual([nextBlow(null, 0), nextBlow('jab', 0.3), nextBlow('cross', 0.3), nextBlow('hook', 0.3), nextBlow('cross', 2)], ['jab', 'cross', 'hook', 'jab', 'jab']);
	assert.ok(blowDamage('hook') > blowDamage('jab'));
	assert.ok(blowDamage('jab', 10) < blowDamage('jab', 100));
	// unarmed townsfolk never reach guns
	let st = 'fists';
	for (let i = 0; i < 500; i++) st = escalate({ stage: st, heat: 1, temper: 1, armed: false, blow: 20, t: 1 }, () => 0);
	assert.notEqual(st, 'guns');
	// the armed can
	st = 'weapon';
	for (let i = 0; i < 50 && st !== 'guns'; i++) st = escalate({ stage: st, heat: 1, temper: 1, armed: true, blow: 20, t: 1 }, () => 0);
	assert.equal(st, 'guns');
	// left alone, words cool back down
	assert.equal(escalate({ stage: 'words', heat: 0.2, temper: 0.1, armed: false, blow: 0, t: 10 }, () => 0.1), 'calm');
	assert.ok(STAGES.indexOf('weapon') > STAGES.indexOf('fists'));
	assert.ok(['bat', 'bottle', null].includes(improvised(null, () => 0.9)));
	assert.equal(brawlResponse('fists').police, true);
	assert.equal(brawlResponse('words').police, false);
	assert.equal(brawlResponse('guns', 3).military, true);
});

test('convoys and cruisers follow the roads toward the trouble, or go straight where there are none', async () => {
	const { roadRoute, along } = await import('../src/military/route.js');
	// a road east along z = 0 from x = 0 to 2000, then one north (to z = -1500) at its end
	const roads = [{ cls: 'primary', pts: [0, 0, 500, 0, 1000, 0, 1500, 0, 2000, 0] }, { cls: 'secondary', pts: [2000, 0, 2000, -500, 2000, -1000, 2000, -1500] }];
	const near = (x, z, r) => roads.filter((q) => { for (let i = 0; i < q.pts.length; i += 2) if (Math.hypot(q.pts[i] - x, q.pts[i + 1] - z) <= r) return true; return false; });
	const R = roadRoute(near, { x: -100, z: 30 }, { x: 2050, z: -1500 });
	assert.ok(R.pts.includes(2000), 'it turns at the junction');
	assert.ok(R.length > 3400 && R.length < 4200, `length ${R.length}`);
	const mid = along(R, R.length / 2);
	assert.ok(Number.isFinite(mid.x) && Math.abs(Math.hypot(mid.dx, mid.dz) - 1) < 1e-6);
	const straight = roadRoute(null, { x: 0, z: 0 }, { x: 300, z: 400 });
	assert.equal(Math.round(straight.length), 500);
	// never off the end
	assert.equal(Math.round(along(straight, 9999).x), 300);
});

test('the jet takes off, flies a circuit and lands back on the runway; the helicopter hovers and sets down', async () => {
	const { flyCircuit, flyHover } = await import('./flight-pilot.mjs');
	const J = flyCircuit();
	const ev = J.log.events.map((e) => e.ev);
	assert.ok(!ev.includes('crash'), JSON.stringify(J.log.events));
	assert.equal(ev[0], 'takeoff');
	assert.ok(ev.includes('smooth') || ev.includes('firm'), 'it touched down');
	assert.ok(J.log.maxAlt > 250 && J.log.gearUp, `up to ${Math.round(J.log.maxAlt)} m, gear up`);
	const down = J.log.events.find((e) => e.ev === 'smooth' || e.ev === 'firm');
	assert.ok(down.sink < 3 && down.gear > 0.9 && down.bank < 0.1, JSON.stringify(down));
	// stopped on the runway (1300 m along z at x = 0, 32 m wide)
	assert.equal(J.phase, 'rollout');
	assert.ok(J.S.spd < 1 && Math.abs(J.S.pos.x) < 14 && J.S.pos.z > 0 && J.S.pos.z < 1300, `${J.S.pos.x.toFixed(1)}, ${J.S.pos.z.toFixed(1)} at ${J.S.spd.toFixed(1)} m/s`);
	const Hh = flyHover();
	assert.deepEqual(Hh.log.events.map((e) => e.ev), ['lift', 'down']);
	assert.ok(Hh.log.hoverDrift < 0.5 && Hh.log.maxAlt > 28, JSON.stringify(Hh.log));
	assert.ok(Hh.log.events[1].sink < 3, 'a held descend flares onto the skids');
});

test('the vehicle models: every kind whole and coarse, the moving parts, within budget', async () => {
	const { vehicleGeometry, DIMS } = await import('../src/military/models.js');
	const tri = (g) => g.attributes.position.count / 3;
	for (const k of Object.keys(DIMS)) {
		const G = vehicleGeometry(k);
		for (const a of ['position', 'normal', 'color', 'mtl', 'opos', 'uv']) assert.ok(G.whole.attributes[a] && G.far.attributes[a], `${k} ${a}`);
		assert.ok(tri(G.far) < tri(G.whole) * 0.75, `${k}: far ${tri(G.far)} near ${tri(G.whole)}`);
		assert.ok(tri(G.whole) < 16000 && tri(G.far) < 2500, `${k}: ${tri(G.whole)} / ${tri(G.far)}`);
		// standing on the ground, about its size
		const b = G.whole.boundingBox;
		assert.ok(Math.abs(b.min.y) < 0.12, `${k} on the ground: ${b.min.y}`);
		assert.ok(b.max.z - b.min.z > DIMS[k].L * 0.85 && b.max.z - b.min.z < DIMS[k].L * 1.5, `${k} length ${b.max.z - b.min.z}`);
	}
	assert.deepEqual(Object.keys(vehicleGeometry('tank').parts).sort(), ['gun', 'hull', 'trackL', 'trackR', 'turret']);
	for (const p of ['flapL', 'flapR', 'ailL', 'ailR', 'tailL', 'tailR', 'rudL', 'rudR', 'gearN', 'gearL', 'gearR', 'doorL', 'doorR']) assert.ok(vehicleGeometry('jet').parts[p], p);
	for (const k of ['apc', 'jeep', 'truck']) assert.ok(vehicleGeometry(k).parts.wheel && vehicleGeometry(k).wheels.length >= 4, k);
	// the track belt's uv runs along it (metres), for the links to scroll
	const uv = vehicleGeometry('tank').parts.trackL.attributes.uv;
	let max = 0;
	for (let i = 0; i < uv.count; i++) max = Math.max(max, uv.getX(i));
	assert.ok(max > 14 && max < 20, `belt ${max} m`);
});

test('a base: dressed, lit, its pad graded into the ground, a handful of draws', async () => {
	const { buildBase } = await import('../src/military/base-model.js');
	for (const [kind, rough] of [['garrison', 0], ['airbase', 1]]) {
		const L = baseLayout(kind, 4);
		const ground = (x, z) => 30 + rough * (x * 0.008 + Math.sin(z * 0.012) * 1.6);
		const sc = siteScore({ height: ground, water: () => false, urban: () => 0, built: () => 0 }, 0, 0, 0, L.W, L.D);
		assert.ok(sc.ok, sc.why);
		const out = buildBase({ name: 'T', x: 0, z: 0, yaw: 0, layout: L, floor: sc.floor }, {}, ground);
		assert.ok(out.draws <= 13, `draws ${out.draws}`);
		assert.ok(out.tris < 90000, `tris ${out.tris}`);
		const names = out.group.children.map((m) => m.name);
		for (const n of ['mil-glow', 'mil-halos', 'mil-flag', 'mil-lamp']) assert.ok(names.includes(n), n);
		assert.ok(out.halos > (kind === 'airbase' ? 150 : 20), `halos ${out.halos}`);
		// the bank reaches further where it has further to fall, never a cliff
		assert.ok(out.banks >= 7 && out.banks <= 70, `banks ${out.banks}`);
	}
});
