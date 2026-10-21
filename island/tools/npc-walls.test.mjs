// Nobody through a wall (people/walls.js, vehicles/lane-path.js, vehicles/wall-guard.js): a body's
// step swept against the world's pushes can never come out the far side of a thin wall, however
// slow the frame; it slides along one it meets at a slant; a body set down near you lands on your
// side of a wall; a car pulling out of its space follows its street round the corner rather than
// on through the block; a car's nose in sight of a building is held. Run with node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweepOut, clearSpot, EYE, PIECE } from '../src/people/walls.js';
import { streetUnder, streetLine, laneAway, laneIn, rightOf, laneOff } from '../src/vehicles/lane-path.js';
import { inBuilding, noseInto } from '../src/vehicles/wall-guard.js';
import { routeOf, cutRoute, along } from '../src/military/route.js';

// a house wall 0.12 m thick along x = 5, from z = -10 to 10, 3 m high; the push keeps a body's
// middle 0.3 m off it (as houses.js and interiors/index.js do)
const WALLS = [[4.94, -10, 5.06, 10, 3]];
const R = 0.3;
const push = (p) => {
	const footY = p.y - EYE;
	for (const b of WALLS) {
		if (footY > b[4]) continue;
		const qx = Math.max(b[0], Math.min(b[2], p.x)), qz = Math.max(b[1], Math.min(b[3], p.z)), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
		if (d2 >= R * R) continue;
		if (d2 < 1e-8) {
			const pen = [p.x - b[0], b[2] - p.x, p.z - b[1], b[3] - p.z], m = Math.min(...pen), k = pen.indexOf(m);
			if (k === 0) p.x = b[0] - R; else if (k === 1) p.x = b[2] + R; else if (k === 2) p.z = b[1] - R; else p.z = b[3] + R;
			continue;
		}
		const d = Math.sqrt(d2); p.x = qx + dx / d * R; p.z = qz + dz / d * R;
	}
};

test('a sprinter on a slow frame never comes out the far side of a thin wall', () => {
	for (const step of [0.05, 0.2, 0.35, 0.5, 0.7, 1.2, 2.5]) {
		for (const x0 of [3.5, 4.1, 4.4, 4.55, 4.64]) {
			const from = { x: x0, y: 0, z: 0 }, pos = { x: x0 + step, y: 0, z: 0 };
			// (only from where a body can stand: never inside the push)
			const s = { x: x0, y: EYE, z: 0 }; push(s); from.x = s.x;
			pos.x = from.x + step;
			sweepOut(push, from, pos, 0);
			assert.ok(pos.x <= 4.94 - R + 1e-6, `step ${step} from ${from.x.toFixed(2)} ended at ${pos.x.toFixed(3)}`);
		}
	}
	// (and the one push the townsfolk had before: a long enough step tunnels straight through)
	const one = { x: 4.64 + 0.5, y: EYE, z: 0 }; push(one);
	assert.ok(one.x > 5, 'a single push at the end of a 0.5 m step puts it out on the far side');
});

test('meeting a wall at a slant, a body slides along it rather than stopping dead', () => {
	const pos = { x: 4.64 + 0.3, y: 0, z: 0.3 }, from = { x: 4.64, y: 0, z: 0 };
	const held = sweepOut(push, from, pos, 0);
	assert.ok(pos.x <= 4.64 + 1e-6, 'kept off the wall');
	assert.ok(pos.z > 0.29, 'still on its way along it: ' + pos.z);
	assert.ok(held > 0.25 && held < 0.35, 'held back by about the push into the wall: ' + held);
});

test('standing, stepping a little, or set down far off: one push where it ends', () => {
	let n = 0;
	const counting = (p) => { n++; push(p); };
	const at = { x: 1, y: 0, z: 0 };
	sweepOut(counting, { x: 1, z: 0 }, at, 0);
	assert.equal(n, 1);
	n = 0; sweepOut(counting, { x: 1, z: 0 }, { x: 1 + PIECE * 0.9, z: 0 }, 0); assert.equal(n, 1);
	n = 0; const far = { x: 5.0, y: 0, z: 0 }; sweepOut(counting, { x: -20, z: 0 }, far, 0); assert.equal(n, 2, 'set down: one push, and one more to see it has stopped');
	assert.ok(Math.abs(far.x - 5) > 0.3, 'set down inside the wall: pushed out of it');
	n = 0; sweepOut(counting, { x: 0, z: 0 }, { x: 3, z: 0 }, 0); assert.equal(n, Math.ceil(3 / PIECE));
	// (above the wall's top it does not hold you)
	const over = { x: 4.9, y: 0, z: 0 }; sweepOut(push, { x: 4.4, z: 0 }, over, 3.5); assert.ok(Math.abs(over.x - 4.9) < 1e-9);
	// (nothing to push with, or a body with no position yet: left as it is)
	const nan = { x: NaN, y: 0, z: 0 }; assert.equal(sweepOut(push, { x: 0, z: 0 }, nan, 0), 0);
	assert.equal(sweepOut(null, { x: 0, z: 0 }, at, 0), 0);
});

test('where two solids stand close, the body is pushed until it is clear of both', () => {
	// two posts 0.2 m apart: the second one's push, taken alone, puts the body back inside the
	// first one's clearance (0.1 m in), as a block seam in the city did
	const posts = [[0, 0, 0.5], [1.2, 0, 0.5]];
	const once = (p) => {
		for (const [cx, cz, r] of posts) {
			const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
			if (d >= r + R) continue;
			p.x = cx + dx / d * (r + R); p.z = cz + dz / d * (r + R);
		}
	};
	const gap = (p) => Math.min(...posts.map(([cx, cz, r]) => Math.hypot(p.x - cx, p.z - cz) - r - R));
	const one = { x: 0.6, z: 0.25 }; once(one);
	assert.ok(gap(one) < -0.05, 'one pass leaves it inside: ' + gap(one));
	const pos = { x: 0.6, y: 0, z: 0.25 };
	sweepOut(once, { x: 0.6, z: 0.25 }, pos, 0);
	assert.ok(gap(pos) > -0.01, `left ${(-gap(pos)).toFixed(3)} m inside a clearance`);
});

test('a companion catching you up is set down on your side of the wall', () => {
	const you = { x: 4, z: 0 }, want = { x: 7.5, z: 1 };
	const p = clearSpot(push, you, want, 0);
	assert.ok(p.x <= 4.94 - R + 1e-6, 'on your side: ' + p.x);
	const open = clearSpot(push, you, { x: 2, z: 2 }, 0);
	assert.deepEqual([+open.x.toFixed(6), +open.z.toFixed(6)], [2, 2], 'with nothing between, just where they were wanted');
});

// two streets: Elm runs east from (0, 0) to (100, 0) and ends there at Oak, which runs north
// from (100, -60) to (100, 200); a block of houses stands past Elm's end, east of Oak
const ELM = { pts: [0, 0, 50, 0, 100, 0], w: 9, drive: true, cls: 'residential' };
const OAK = { pts: [100, -60, 100, 0, 100, 80, 100, 200], w: 11, drive: true, cls: 'tertiary' };
const PATH = { pts: [60, -5, 60, 5], w: 2, drive: false, cls: 'footway' };
const ROADS = [ELM, OAK, PATH];
const near = (x, z, r) => ROADS.filter((q) => { for (let i = 0; i < q.pts.length; i += 2) if (Math.hypot(q.pts[i] - x, q.pts[i + 1] - z) < r + 60) return true; return false; });

test('the street under a parked car: the one it lies along, not the one across its nose', () => {
	// parked on Elm at the kerb, facing east (yaw pi/2: forward is +x)
	const at = streetUnder(near, 60, 3.3, 1, 0);
	assert.equal(at.r, ELM);
	assert.equal(at.dir, 1);
	assert.ok(Math.abs(at.x - 60) < 1e-9 && Math.abs(at.z) < 1e-9);
	assert.equal(streetUnder(near, 60, 3.3, 0, 1), null, 'nothing runs north under it there');
	assert.equal(streetUnder(near, 500, 500, 1, 0), null, 'no street at all out there');
});

test('a car pulling out drives on round the corner at the end of its street, never on into the block', () => {
	const S = streetLine(near, 60, 3.3, 1, 0, 200);
	assert.ok(S, 'a way');
	const P = S.pts, n = P.length / 2;
	// along Elm to its end, then north up Oak (Elm's end meets Oak, the most nearly straight way
	// on there is either way along it; never past x = 100 into the houses)
	for (let i = 0; i < n; i++) assert.ok(P[i * 2] <= 100 + 1e-9, 'never east of Oak: ' + P[i * 2]);
	assert.ok(Math.abs(P[(n - 1) * 2] - 100) < 1e-9, 'on Oak at the end');
	let run = 0; for (let i = 1; i < n; i++) run += Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
	assert.ok(run >= 200 - 1e-6, 'as far as was asked: ' + run);
	// the lane: right of the way it goes (driving east, right is +z: bay/streetlife.js), the side
	// it was parked on; north up Oak, right is west of its middle
	const L = laneAway(near, 60, 3.3, 1, 0, 200);
	assert.ok(Math.abs(L[1] - laneOff(9)) < 1e-9, 'east along Elm in the lane right of the middle: ' + L[1]);
	const last = L.length - 2;
	assert.ok(Math.abs(L[last] - (100 - laneOff(9))) < 1e-9, 'up Oak in its own lane: ' + L[last]);
	// (a footway is never a way for a car)
	assert.ok(!S.pts.some((v, i) => i % 2 === 0 && v === 60 && S.pts[i + 1] === -5));
});

test('a car coming home comes down its own street to beside its space, by the corner it came round', () => {
	// parked on Elm facing east at x = 60: it comes from behind it, from the west along Elm
	const L = laneIn(near, 60, 3.3, 1, 0, 50);
	const n = L.length / 2;
	assert.ok(Math.abs(L[(n - 1) * 2] - 60) < 1e-9, 'ends beside the space');
	assert.ok(L[0] < 60 - 49, 'from 50 m back up the street: ' + L[0]);
	for (let i = 0; i < n; i++) assert.ok(Math.abs(L[i * 2 + 1] - laneOff(9)) < 1e-9, 'in its lane, the same side as it parks');
	// a car parked facing west on Elm (the south kerb) comes from the east: down Oak and round
	// the corner into Elm, in the southbound lane
	const W2 = laneIn(near, 60, -3.3, -1, 0, 80);
	assert.ok(Math.abs(W2[0] - (100 + laneOff(9))) < 1e-9 && W2[1] > 40, 'from up Oak: ' + W2.slice(0, 2));
	assert.ok(Math.abs(W2[W2.length - 1] - -laneOff(9)) < 1e-9, 'into Elm on its south side');
});

test('a dead end: the way stops at the end of the street', () => {
	const DEAD = [{ pts: [0, 0, 40, 0], w: 8, drive: true, cls: 'residential' }];
	const S = streetLine((x, z, r) => DEAD, 10, 2, 1, 0, 400);
	assert.deepEqual(S.pts.slice(-2), [40, 0]);
});

test('rightOf keeps a corner square: each point moved by the mean of its two sides', () => {
	const pts = rightOf([0, 0, 10, 0, 10, 10], 1);
	// east then north: right of east is +z, right of north is -x, the corner between them
	assert.deepEqual(pts.slice(0, 2), [0, 1]);
	assert.deepEqual(pts.slice(4, 6), [9, 10]);
	assert.ok(Math.abs(pts[2] - (10 - Math.SQRT1_2)) < 1e-9 && Math.abs(pts[3] - Math.SQRT1_2) < 1e-9);
});

test('a vehicle in sight is held at a building: its nose, not its middle, is what counts', () => {
	const house = { x: 20, z: 0, w: 10, d: 12, a: 0, h: 6, y: 0 };
	const W = { city: { lotsNear: (x, z, r) => [house].filter((o) => Math.hypot(o.x - x, o.z - z) < r + Math.max(o.w, o.d) / 2) } };
	assert.ok(inBuilding(W, 20, 0));
	assert.ok(inBuilding(W, 14.8, 0), 'within its pad');
	assert.ok(!inBuilding(W, 14, 0));
	// a 4.8 m car at x = 10 heading east (+x): nose at 12.4, looking to 14.4 + ... reaches the wall at 15
	assert.ok(noseInto(W, 10.8, 0, Math.PI / 2, 2.4));
	assert.ok(!noseInto(W, 5, 0, Math.PI / 2, 2.4));
	assert.ok(!noseInto(W, 10.8, 0, -Math.PI / 2, 2.4), 'driving away from it');
	// (a wreck, a low wall, nothing at all: no building to stop for)
	assert.ok(!inBuilding({ city: { lotsNear: () => [{ ...house, wrecked: true }] } }, 20, 0));
	assert.ok(!inBuilding({ city: { lotsNear: () => [{ ...house, h: 1 }] } }, 20, 0));
	assert.ok(!inBuilding({}, 20, 0));
});

test('a column pulled up short: its route ends where it stopped', () => {
	const Rt = routeOf([0, 0, 100, 0, 100, 100]);
	const C = cutRoute(Rt, 130);
	assert.equal(Math.round(C.length), 130);
	const q = along(C, C.length);
	assert.deepEqual([Math.round(q.x), Math.round(q.z)], [100, 30]);
	assert.equal(Math.round(cutRoute(Rt, 0.5).length * 10) / 10, 0.5);
});
