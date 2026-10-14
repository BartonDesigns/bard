// The environmental graphics (src/signage/): the layer order holds (each layer lifted and
// biased further and drawn later than the one under it), the streets get the signs a sign
// shop would put up (stop on the minor legs facing the traffic on its own side, blades with
// both names, speed limits in the system's units, nothing at signalled corners), the freeway
// exits get their gore sign and gantry, the shops their glass decals, the alleys their back
// door signs, and the writers keep off storefronts and civic buildings and paint more where
// the region is rougher. Everything is the same for the same place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LAYER, LAYER_NAMES, layerBias, DECAL_ORDER } from '../src/signage/layers.js';
import { junctions, controlOf, streetSigns, freewaySigns, storefrontDecals, backDoorDecals, graffitiFor, grimeFor, writerPressure, constructionSigns, carDecalSet, bladeName, hoursOf, ALARM_CO, CARD_MARKS, MAT, BACK } from '../src/signage/placement.js';
import { systemFor, SYSTEMS } from '../src/signage/systems.js';
import { tagName, crewName } from '../src/signage/graffiti.js';
import { faceDims, FACE_KINDS } from '../src/signage/faces.js';
import { denied } from '../src/economy/establishments.js';

const road = (cls, name, pts, o = {}) => ({ cls, name, w: cls === 'primary' ? 13 : cls === 'motorway' ? 14 : 10.5, pts: new Float32Array(pts), drive: true, walked: true, bridge: false, link: false, divided: false, ...o, box: [Math.min(pts[0], pts[pts.length - 2]), Math.min(pts[1], pts[pts.length - 1]), Math.max(pts[0], pts[pts.length - 2]), Math.max(pts[1], pts[pts.length - 1])] });
// a primary avenue running x with a residential street crossing it at the origin
const cross = () => [road('primary', 'Mission Street', [-300, 0, 0, 0, 300, 0]), road('residential', 'Oak Avenue', [0, -300, 0, 0, 0, 300])];
const US = SYSTEMS.us;

test('layers: each is lifted further, biased further and drawn later than the one under it', () => {
	assert.deepEqual(LAYER_NAMES, ['surface', 'grime', 'paint', 'poster', 'sticker', 'overSticker']);
	for (const phone of [false, true]) {
		let prev = layerBias(LAYER.surface, { phone });
		assert.equal(prev.lift, 0); assert.equal(prev.units, 0);
		for (let k = 1; k <= LAYER.overSticker; k++) {
			const b = layerBias(k, { phone });
			assert.ok(b.lift > prev.lift, `lift ${k}`);
			assert.ok(b.units < prev.units, `units ${k}`);
			assert.ok(b.factor <= prev.factor, `factor ${k}`);
			assert.equal(b.renderOrder, DECAL_ORDER + k);
			assert.ok(b.lift < 0.02, 'never enough to see a gap');
			prev = b;
		}
	}
	// (a phone's coarser depth gets the bigger steps)
	assert.ok(layerBias(LAYER.sticker, { phone: true }).units < layerBias(LAYER.sticker).units);
	assert.ok(layerBias(LAYER.sticker).renderOrder > layerBias(LAYER.poster).renderOrder && layerBias(LAYER.poster).renderOrder > layerBias(LAYER.paint).renderOrder && layerBias(LAYER.paint).renderOrder > layerBias(LAYER.grime).renderOrder);
});

test('systems: the locales map to their manuals', () => {
	assert.equal(systemFor('us-ca').id, 'us'); assert.equal(systemFor('us-tx').id, 'us');
	assert.equal(systemFor('de').id, 'vienna'); assert.equal(systemFor('fr').id, 'vienna');
	assert.equal(systemFor('uk').id, 'uk'); assert.equal(systemFor('jp').id, 'jp');
	assert.equal(systemFor('mx').id, 'americas'); assert.equal(systemFor('mx').stop, 'ALTO');
	assert.equal(systemFor('us', { planet: true }).id, 'orbital');
	assert.equal(SYSTEMS.jp.side, 'left'); assert.equal(SYSTEMS.uk.unit, 'mph'); assert.equal(SYSTEMS.vienna.unit, 'km/h');
});

test('junctions: a crossing of two named streets is found with four legs', () => {
	const J = junctions(cross());
	assert.equal(J.length, 1);
	assert.equal(J[0].legs.length, 4);
	assert.deepEqual([...J[0].names].sort(), ['Mission Street', 'Oak Avenue']);
	// (a motorway is never a junction's leg)
	assert.equal(junctions([...cross(), road('motorway', 'I-80', [0, 0, 0, 500], { link: false })]).length, 1);
});

test('streets: stop signs on the minor legs only, facing their traffic, on its own side', () => {
	const { signs } = streetSigns(cross(), US, {});
	const stops = signs.filter((s) => s.face.k === 'stop');
	assert.equal(stops.length, 2, 'the two legs of the residential street');
	for (const s of stops) {
		// on the Oak Avenue legs (x near 0), facing out along them toward the coming traffic
		assert.ok(Math.abs(s.nx) < 0.01 && Math.abs(Math.abs(s.nz) - 1) < 0.01);
		assert.ok(Math.sign(s.z) === Math.sign(s.nz), 'faces away from the junction, toward the cars');
		// right-hand traffic coming in along -nz: its right is (nz... ) -> the sign is on the driver's right
		const inx = -s.nx, inz = -s.nz, rx = -inz, rz = inx;
		assert.ok(s.x * rx + s.z * rz > 0, 'on the right of the incoming lane');
		assert.equal(s.face.word, 'STOP');
		assert.equal(s.mat, MAT.retro);
	}
	// Japan keeps left: the same stop sits on the other side, and says 止まれ
	const jp = streetSigns(cross(), SYSTEMS.jp, {}).signs.filter((s) => s.face.k === 'stop');
	for (const s of jp) { const rx = s.nz, rz = -s.nx; assert.ok(s.x * rx + s.z * rz < 0); assert.equal(s.face.word, '止まれ'); }
	// two collectors crossing are signalled: no stop, no yield
	const sig = streetSigns([road('primary', 'A Street', [-300, 0, 0, 0, 300, 0]), road('secondary', 'B Street', [0, -300, 0, 0, 0, 300])], US, {}).signs;
	assert.equal(sig.filter((s) => s.face.k === 'stop' || s.face.k === 'yield').length, 0);
	assert.equal(controlOf(junctions([road('primary', 'A Street', [-300, 0, 0, 0, 300, 0]), road('secondary', 'B Street', [0, -300, 0, 0, 0, 300])])[0], US).kind, 'signal');
});

test('streets: two blades with both names on one corner post, readable both sides', () => {
	const { signs, posts } = streetSigns(cross(), US, {});
	const blades = signs.filter((s) => s.face.k === 'blade');
	assert.equal(blades.length, 2);
	assert.deepEqual(blades.map((b) => b.face.name).sort(), ['Mission St', 'Oak Ave']);
	assert.ok(blades.every((b) => b.back === BACK.readable));
	assert.equal(blades[0].x, blades[1].x); assert.ok(blades[0].hy !== blades[1].hy);
	// each blade runs along its street: its face square to it
	const oak = blades.find((b) => b.face.name === 'Oak Ave');
	assert.ok(Math.abs(oak.nz) < 0.01);
	// the corner post stands clear of both carriageways
	const p = posts.find((q) => q.x === blades[0].x);
	assert.ok(Math.abs(p.x) > 5.25 && Math.abs(p.z) > 6.5);
	assert.equal(bladeName('North Main Boulevard', US), 'N Main Blvd');
	assert.equal(bladeName('Rue de Rivoli', SYSTEMS.vienna), 'Rue de Rivoli');
});

test('streets: speed limits in the system units, a school zone near a school; the same every time', () => {
	const many = [];
	for (let i = 0; i < 30; i++) many.push(road('tertiary', 'T' + i, [i * 400, -300, i * 400, 0, i * 400, 300]), road('residential', 'R' + i, [i * 400 - 300, 0, i * 400, 0, i * 400 + 300, 0]));
	const A = streetSigns(many, US, { seed: 3 }), B = streetSigns(many, US, { seed: 3 });
	assert.deepEqual(A.signs, B.signs);
	const sp = A.signs.filter((s) => s.face.k === 'speed');
	assert.ok(sp.length > 0);
	assert.ok(sp.every((s) => s.face.unit === 'mph' && [25, 35].includes(s.face.n)));
	const eu = streetSigns(many, SYSTEMS.vienna, { seed: 3 }).signs.filter((s) => s.face.k === 'speed');
	assert.ok(eu.every((s) => s.face.unit === 'km/h' && [30, 50].includes(s.face.n)));
	const school = streetSigns(many, US, { seed: 3, schools: many.filter((r, i) => i % 2 === 0).map((r) => ({ x: r.pts[0], z: 40 })) }).signs;
	assert.ok(school.some((s) => s.face.k === 'school'));
	assert.ok(school.filter((s) => s.face.k === 'speed' && s.face.school).every((s) => s.face.n === US.speeds.school));
});

test('freeways: an exit gets its gore sign and a gantry 400 m before; bridges their clearance', () => {
	const main = road('motorway', 'I-80', [0, 0, 0, 2000], { divided: true, walked: false });
	const link = road('motorway', '', [9, 1000, 20, 1100, 40, 1200], { link: true, walked: false });
	const st = road('secondary', 'University Avenue', [-400, 1210, 400, 1210]);
	const F = freewaySigns([main, link, st], US, { faces: [{ x: 0, y: 6, z: 500, nx: 0, nz: -1, clear: 4.9 }], route: () => '80', dest: () => 'Sacramento' });
	const gore = F.signs.filter((s) => s.face.k === 'exitgore');
	assert.equal(gore.length, 1);
	assert.equal(F.gantries.length, 1);
	assert.ok(Math.abs(F.gantries[0].z0 - 600) < 30, 'about 400 m up the mainline');
	const guide = F.signs.filter((s) => s.face.k === 'guide');
	assert.ok(guide.some((s) => s.face.lines.includes('University Ave') && s.face.exit));
	assert.ok(guide.some((s) => s.face.route === '80' && s.face.lines.includes('Sacramento')));
	assert.ok(guide.every((s) => s.nz < -0.99), 'facing the traffic coming up');
	const cl = F.signs.find((s) => s.face.k === 'clearance');
	assert.ok(cl && /^15'-\d+"$/.test(cl.face.txt), cl?.face.txt);
	// (an on-ramp, starting on a street, is no exit)
	assert.equal(freewaySigns([main, road('motorway', '', [-300, 1300, -10, 1350], { link: true })], US).signs.length, 0);
});

test('shops: the door gets hours, push or pull, the cards, the number; offices a suite; alleys staff only', () => {
	const biz = { name: "Rosa's Market", type: 'grocer', use: 'shop', x: 10, z: 20 };
	const front = { x: 10, z: 26, nx: 0, nz: 1, run: 9, g: 5, door: 0 };
	const D = storefrontDecals(biz, front, US, { seed: 1 });
	const kinds = D.map((d) => d.face.k);
	for (const k of ['pushpull', 'hours', 'address']) assert.ok(kinds.includes(k), k);
	assert.ok(D.every((d) => d.base === 5 && d.nz === 1 && Math.abs(d.z - 26) < 1e-9), 'on the face, from its ground');
	assert.ok(D.filter((d) => d.face.k === 'hours').every((d) => d.mat === MAT.glass && d.back === BACK.mirrored && d.hy > 1.2 && d.hy < 1.7));
	assert.equal(D.find((d) => d.face.k === 'pushpull').back, BACK.none);
	assert.deepEqual(storefrontDecals(biz, front, US, { seed: 1 }), D, 'the same each visit');
	const office = storefrontDecals({ name: 'Ridge Partners', type: 'office', use: 'office', x: 0, z: 0 }, front, US, { seed: 1 });
	assert.ok(office.some((d) => d.face.k === 'suite'));
	const h = hoursOf('cafe', US), h24 = hoursOf('cafe', SYSTEMS.vienna);
	assert.match(h.line, /am|pm/); assert.match(h24.line, /^\d\d:\d\d/);
	const back = backDoorDecals([0, 0, 0, null], US, { seed: 2 });
	assert.ok(back.some((d) => d.face.k === 'staff'));
	for (const n of [...ALARM_CO, ...CARD_MARKS]) assert.equal(denied(n), false, n);
});

test('graffiti: on the walls the writers want, never a storefront or a civic building, more where it is rough', () => {
	const walls = [];
	for (let i = 0; i < 80; i++) walls.push({ kind: 'soundwall', x: i * 12, z: 0, y: 0, nx: 0, nz: 1, w: 12, h: 4.3, lu: 1 });
	const calm = graffitiFor(walls, { morality: { trouble: 0.05, means: 0.8 }, seed: 1 }), rough = graffitiFor(walls, { morality: { trouble: 0.9, means: 0.2 }, seed: 1 });
	assert.ok(rough.length > calm.length * 1.5, `${rough.length} vs ${calm.length}`);
	assert.ok(writerPressure({ trouble: 0.9 }) > writerPressure({ trouble: 0.1 }));
	assert.ok(rough.every((d) => d.layer === 2 || d.layer === 3), 'paint and posters');
	assert.ok(rough.some((d) => d.face.k === 'tag') && rough.some((d) => d.face.k === 'throwup'));
	// the crews: buffed blocks, some written over again (and the new tag drawn after its buff)
	const all = graffitiFor(walls, { morality: { trouble: 0.9, means: 0.2 }, seed: 1, day: 70 });
	const bi = all.findIndex((d) => d.face.k === 'buff');
	assert.ok(bi >= 0);
	assert.ok(all.every((d) => d.hy + d.h / 2 <= 4.3 + 1e-6), 'never over the top of the wall');
	const nice = graffitiFor([{ kind: 'industrial', x: 0, z: 0, nx: 1, nz: 0, w: 30, h: 6, storefront: true }, { kind: 'alley', x: 5, z: 0, nx: 1, nz: 0, w: 30, h: 6, civic: true }], { morality: { trouble: 1, means: 0 }, seed: 1 });
	assert.equal(nice.length, 0);
	assert.deepEqual(graffitiFor(walls, { morality: { trouble: 0.5 }, seed: 9 }), graffitiFor(walls, { morality: { trouble: 0.5 }, seed: 9 }));
	// (a phone gets fewer)
	assert.ok(graffitiFor(walls, { morality: { trouble: 0.9 }, seed: 1, phone: true }).length < rough.length);
	// grime under the fixtures, soot only over a kitchen
	const g = grimeFor([{ kind: 'alley', x: 0, z: 0, nx: 1, nz: 0, w: 5, h: 5, kitchen: true }, { kind: 'alley', x: 9, z: 0, nx: 1, nz: 0, w: 5, h: 5 }], { seed: 4 });
	assert.ok(g.every((d) => d.mat === MAT.grime && d.layer === LAYER.grime));
	assert.ok(g.filter((d) => d.face.type === 'soot').every((d) => d.x < 5));
});

test('writers, cars, sites: names are said aloud and no brand, the same car the same plate', () => {
	const seen = new Set();
	for (let s = 0; s < 400; s++) { const n = tagName(s); assert.match(n, /^[A-Z]{3,6}$/); assert.equal(denied(n), false); seen.add(n); }
	assert.ok(seen.size > 150, 'varied');
	assert.match(crewName(5), /^[A-Z]{3}$/);
	assert.deepEqual(carDecalSet(1234, { sys: US }), carDecalSet(1234, { sys: US }));
	const L = carDecalSet(77, { sys: US, livery: 'police' });
	assert.equal(L.bumper.length, 0); assert.equal(L.livery, 'police');
	const C = constructionSigns({ x: 0, z: 0, w: 20, d: 14, a: 0 }, US);
	assert.ok(C.signs.some((s) => s.face.k === 'work') && C.signs.some((s) => s.face.k === 'site'));
	for (const k of ['stop', 'blade', 'guide', 'tag', 'piece', 'plate', 'aisle', 'hours', 'livery']) assert.ok(FACE_KINDS.includes(k), k);
	const [w, h] = faceDims({ k: 'piece' }, 9, 3.4);
	assert.ok(w <= 1024 && h <= 512 && Math.abs(w / h - 9 / 3.4) < 0.05);
});
