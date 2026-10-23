// Sitting down and sleeping (gameplay/rest.js): the seats read off a home's furniture, a city
// building's and a cafe's seats, the benches and picnic tables; the one offered; what a night's
// sleep is at an hour; and a home's household keeping clear of the seat kept for you
// (people/home-routine.js arrange's taken).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeSeats, buildingSeats, venueSeats, outdoorSeats, pickSeat, sleepPlan } from '../src/gameplay/rest.js';
import { spotsOf, arrange } from '../src/people/home-routine.js';
import { makeHousehold } from '../src/people/households.js';
import { planDay } from '../src/people/schedules.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// a little house: a sofa facing a TV in the living room, a double bed upstairs, a dining table
const plan = {
	rooms: [{ id: 0, type: 'living' }, { id: 1, type: 'master', level: 1 }, { id: 2, type: 'dining' }],
	items: [
		{ type: 'sofa', room: 0, level: 0, y: 0, x: 0, z: 0, rot: 0, w: 2.1, d: 0.9 },
		{ type: 'tvConsole', room: 0, level: 0, y: 0, x: 0, z: 3, rot: 2, w: 1.6, d: 0.45, h: 0.5 },
		{ type: 'bed', room: 1, level: 1, y: 2.9, x: 4, z: 1, rot: 1, w: 1.6, d: 2.0 },
		{ type: 'diningTable', room: 2, level: 0, y: 0, x: -4, z: 2, rot: 0, w: 1.6, d: 0.9, chairs: 4 },
	],
};
const house = { plan, root: { rotation: { y: 0.5 } }, cx: 100, cz: 200, floorY: 10 };
const toWorld = (lx, lz) => [100 + lx * Math.cos(0.5) + lz * Math.sin(0.5), 200 - lx * Math.sin(0.5) + lz * Math.cos(0.5)];

test('a home\'s seats are its furniture, in the world, on the floor you are on', () => {
	const down = homeSeats(house, 10);
	const sofa = down.filter((s) => s.kind === 'sofa');
	assert.equal(sofa.length, 3, 'a long sofa seats three');
	const [x, z] = toWorld(0, 0.06);
	assert.ok(sofa.some((s) => near(s.x, x) && near(s.z, z)), 'the middle cushion where the plan has it');
	assert.ok(sofa.every((s) => near(s.face, 0.5) && near(s.y, 10) && near(s.h, 0.47)), 'facing out of the sofa, turned with the house');
	assert.equal(down.filter((s) => s.kind === 'dine').length, 4);
	assert.ok(down.some((s) => s.kind === 'couch' && s.lie), 'the sofa long enough to lie on');
	assert.ok(!down.some((s) => s.kind === 'bed' || s.kind === 'bedEdge'), 'the bed is upstairs');
	const up = homeSeats(house, 12.9);
	const beds = up.filter((s) => s.kind === 'bed');
	assert.equal(beds.length, 2, 'two sides of a double bed');
	const [mx, mz] = toWorld(4, 1);
	assert.ok(beds.every((s) => near(s.lie.mx, mx) && near(s.lie.mz, mz) && near(s.lie.top, 0.58)), 'reached from round the bed\'s middle');
	assert.ok(up.some((s) => s.kind === 'bedEdge' && near(s.h, 0.58)));
	// (the spots the household has are not offered)
	const used = new Set(spotsOf(plan).filter((s) => s.kind === 'sofa').map((s) => s.id));
	assert.equal(homeSeats(house, 10, used).filter((s) => s.kind === 'sofa').length, 0);
	assert.deepEqual(homeSeats({ plan: null }, 0), []);
});

test('a city building\'s seats and a cafe\'s, with the taken ones left out', () => {
	const F = { ca: Math.cos(1), sa: Math.sin(1), w: (lx, lz) => [50 + Math.cos(1) * lx - Math.sin(1) * lz, 60 + Math.sin(1) * lx + Math.cos(1) * lz] };
	const B = { P: { f0: 4, levels: [{ y: 0 }, { y: 3.4 }], seats: [
		{ x: 1, z: 2, y: 0, fx: 0, fz: 1, sit: true, h: 0.47, table: true },
		{ x: 2, z: 2, y: 0, fx: 0, fz: -1, sit: true, h: 0.47 },
		{ x: 3, z: 2, y: 0, fx: 1, fz: 0, sit: false, h: 0 },
		{ x: 1, z: 2, y: 3.4, fx: 0, fz: 1, sit: true, h: 0.47 },
	] }, spots: [{ taken: false }, { taken: true }, { taken: false }, { taken: false }] };
	const S = buildingSeats(B, 0, F);
	assert.equal(S.length, 1, 'the ground floor\'s free seat; not the one taken, the place to stand, upstairs');
	const [x, z] = F.w(1, 2);
	assert.ok(near(S[0].x, x) && near(S[0].z, z) && near(S[0].y, 4) && S[0].kind === 'chair');
	assert.ok(near(S[0].face, Math.atan2(-Math.sin(1), Math.cos(1))), 'facing +z of the lot, turned into the world');
	assert.equal(buildingSeats(B, 1, F).length, 1);
	// a cafe: [x, z, yaw, sitting, floor, seat height]; a seat's yaw turns -z
	const C = { b: { x: 10, z: 20, a: 0 }, floorY: 1, type: 'cafe', seats: [[1, 1, 0, true], [2, 1, Math.PI, true, 0, 0.62], [3, 1, 0, false]] };
	const V = venueSeats(C);
	assert.equal(V.length, 2);
	assert.ok(near(V[0].x, 11) && near(V[0].z, 21) && near(V[0].face, Math.PI) && near(V[0].h, 0.46), 'faces -z');
	assert.ok(near(V[1].face, 0) && near(V[1].h, 0.62), 'a bar stool, turned round');
	C.spots = [{ x: 11, z: 21, taken: true }];
	assert.equal(venueSeats(C).length, 1, 'someone is in the first one');
	assert.equal(venueSeats({ ...C, type: 'cinema', spots: null })[0].kind, 'cinema');
});

test('a bench seats two side by side, a picnic table four facing across it', () => {
	const S = outdoorSeats([{ kind: 'bench', x: 0, y: 2, z: 0, heading: Math.PI / 2 }]);
	assert.equal(S.length, 2);
	assert.ok(S.every((s) => near(s.face, Math.PI / 2) && near(s.y, 2) && near(s.h, 0.48)));
	assert.ok(S.every((s) => near(Math.hypot(s.x, s.z), Math.hypot(0.45, 0.04))), 'along the bench either side of its middle');
	const T = outdoorSeats([{ kind: 'picnic', x: 5, y: 0, z: 5, heading: 0 }]);
	assert.equal(T.length, 4);
	assert.ok(T.filter((s) => s.z > 5).every((s) => near(s.face, Math.PI)) && T.filter((s) => s.z < 5).every((s) => near(s.face, 0)), 'everyone facing the table');
	assert.deepEqual(outdoorSeats(null), []);
});

test('the seat offered: the nearest within reach on your level, the one you face first', () => {
	const seats = [
		{ x: 1, z: 0, y: 0, kind: 'a' },
		{ x: -0.9, z: 0, y: 0, kind: 'behind' },
		{ x: 0.5, z: 0, y: 3, kind: 'upstairs' },
		{ x: 3, z: 0, y: 0, kind: 'far' },
	];
	assert.equal(pickSeat(seats, { x: 0, z: 0, feet: 0, fx: 1, fz: 0 }).kind, 'a', 'the one in front, though the other is nearer');
	assert.equal(pickSeat(seats, { x: 0, z: 0, feet: 0, fx: -1, fz: 0 }).kind, 'behind');
	assert.equal(pickSeat(seats, { x: 2.2, z: 0, feet: 0, fx: 1, fz: 0 }).kind, 'far');
	assert.equal(pickSeat(seats, { x: 10, z: 0, feet: 0, fx: 1, fz: 0 }), null);
	// a bed: from anywhere round it
	const bed = { x: 0, z: 0, y: 0, kind: 'bed', lie: { mx: 0, mz: 1, r: 1, top: 0.58 } };
	assert.equal(pickSeat([bed], { x: 1.5, z: 1, feet: 0, fx: -1, fz: 0 }), bed);
	assert.equal(pickSeat([bed], { x: 2.9, z: 1, feet: 0, fx: -1, fz: 0 }), null);
});

test('a night\'s sleep runs to seven in the morning; by day a nap; with friends about, a rest', () => {
	assert.deepEqual(sleepPlan(23), { hours: 8, wake: 7, heal: 1, kind: 'night' });
	assert.deepEqual(sleepPlan(2.5), { hours: 4.5, wake: 7, heal: 1, kind: 'night' });
	assert.equal(sleepPlan(19).hours, 12);
	const nap = sleepPlan(14);
	assert.equal(nap.kind, 'nap'); assert.equal(nap.hours, 2); assert.equal(nap.wake, 16); assert.ok(nap.heal < 1);
	assert.equal(sleepPlan(23.5, true).hours, 0, 'the clock is everyone\'s');
	assert.equal(sleepPlan(23.5, true).heal, 1);
});

test('a home\'s household keeps clear of the seat kept for you', () => {
	const hh = makeHousehold(7, { x: 0, z: 0, kind: 'house' }, { id: 'test', weights: { couple: 1 } });
	const spots = spotsOf(plan), plans = planDay(hh, 3);
	// the evening in front of the TV
	let hour = 20, A = arrange(hh, plans, spots, hour, { day: 3 });
	for (let h = 18; !A.some((q) => q.spot.kind === 'sofa') && h < 23; h += 0.5) A = arrange(hh, plans, spots, (hour = h), { day: 3 });
	const sat = A.filter((q) => q.spot.kind === 'sofa').map((q) => q.spot.id);
	assert.ok(sat.length, 'someone on the sofa of an evening');
	const B = arrange(hh, plans, spots, hour, { day: 3, taken: sat });
	assert.ok(!B.some((q) => sat.includes(q.spot.id)), 'not on the seat kept for you');
});
