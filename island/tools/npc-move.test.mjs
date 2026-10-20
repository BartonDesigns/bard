// Fighters on the move (combat/npc-climb.js on parkour.js; people/actions.js vault poses): over a
// fence and up a ledge the way you go, and never through a wall. A small yard of boxes stands in
// for the world, as in parkour.test.mjs. Run with node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClimber } from '../src/combat/npc-climb.js';
import { ACTIONS, actionAt } from '../src/people/actions.js';

const EYE = 1.68;
// [x0, z0, x1, z1, top, walk]
const YARD = { fence: [-2, -3.04, 2, -2.96, 1.0, false], ledge: [8, -5, 12, -3, 1.2, true], wall: [18, -5, 22, -3, 3.5, true] };
const B = Object.values(YARD);
const floorAt = (x, z, y) => { let g = 0; for (const b of B) if (b[5] && x > b[0] && x < b[2] && z > b[1] && z < b[3] && y > b[4] - 1.4) g = Math.max(g, b[4]); return g; };
const pushOut = (p) => {
	const footY = p.y - EYE;
	for (const b of B) {
		if (footY > b[4] - 0.25) continue;
		const qx = Math.max(b[0], Math.min(b[2], p.x)), qz = Math.max(b[1], Math.min(b[3], p.z)), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
		if (d2 >= 0.09) continue;
		if (d2 < 1e-8) { p.z = b[3] + 0.3; continue; }
		const d = Math.sqrt(d2); p.x = qx + dx / d * 0.3; p.z = qz + dz / d * 0.3;
	}
};
const run = (C, climber) => { let at = null, n = 0, top = 0; while (n++ < 400) { at = climber.step(C, 1 / 60); top = Math.max(top, at.feet); if (at.done) break; } return { at, top }; };

test('running at a fence: a hop over it, landing on the far side carrying on', () => {
	const K = createClimber({ floorAt, pushOut });
	assert.equal(K.look(0, 0, 0, 0, -1, 4), null, 'nothing yet, 3 m off');
	const C = K.look(0, -2.3, 0, 0, -1, 4);
	assert.equal(C?.kind, 'hop');
	assert.equal(C.pose, 'vault-hop');
	assert.ok(Math.abs(C.hand.y - 1.0) < 0.06 && C.hand.z < -2.94 && C.hand.z > -3.06, 'the hand on the top: ' + JSON.stringify(C.hand));
	const { at, top } = run(C, K);
	assert.ok(at.done && at.z < -3.1 && at.feet === 0, 'over and down: ' + JSON.stringify(at));
	assert.ok(top > 0.15, 'up off the ground going over');
	assert.ok(C.exit >= 3.5, 'and on at a run');
});

test('a ledge they can reach: a mantle up onto it; a tall wall: no climb', () => {
	const K = createClimber({ floorAt, pushOut });
	const C = K.look(10, -2.4, 0, 0, -1, 4);
	assert.equal(C?.kind, 'mantle');
	const { at } = run(C, K);
	assert.ok(at.done && Math.abs(at.feet - 1.2) < 0.02 && at.z < -3, 'standing on it: ' + JSON.stringify(at));
	assert.equal(K.look(20, -2.4, 0, 0, -1, 4), null, 'a 3.5 m wall is not for climbing');
});

test('the vault poses: the legs tucked up over the top, every key with the same channels', () => {
	for (const n of ['vault-hop', 'vault-hop+', 'vault-mantle', 'vault-mantle+']) {
		assert.ok(ACTIONS[n], n);
		const ch = (q) => ['sp', 'hp', 'hd', 'rt', 'fL', 'fR'].filter((c) => q[c]).join();
		const K = ACTIONS[n].keys;
		for (const [, q] of K) assert.equal(ch(q), ch(K[0][1]), n + ' keys differ');
	}
	assert.ok(actionAt('vault-hop', 0.48).fL[1] > 0.6, 'feet up over the top');
});
