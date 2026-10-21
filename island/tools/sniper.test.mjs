// The Longwatch sniper rifle: a forgiving heavy rifle. Its numbers down a person with one body
// shot, its assist draws a near miss onto the person it passed (never a warded child, never
// through what stands between), and where the round lands still decides the harm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, weaponStats, damageAt } from '../src/combat/weapons.js';
import { createLayer, personShapes, nearestOn, rayShape } from '../src/combat/targets.js';
import { createHealth, applyDamage } from '../src/combat/health.js';
import { ARMS_CATALOG } from '../src/gameplay/arms.js';
import { HOLDS, GRIPS, CHARGERS, WEAPONS as VIEWS } from '../src/crysis/held-items.js';
import { scopeView, scopeGone, onScopeCapture, scopeCapture } from '../src/crysis/scope-view.js';

const ID = 'longwatch-sniper-rifle';
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; };

test('the Longwatch is in the catalogue, the shops and the hand', () => {
	assert.ok(ARMS_CATALOG[ID] && ARMS_CATALOG['longwatch-round-box'], 'item and its rounds');
	assert.equal(WEAPONS[ID].box, 'longwatch-round-box');
	const H = HOLDS[ID];
	assert.equal(H.kind, 'long');
	assert.ok(H.zoom >= 2 && H.scopeMag >= 4, 'a real long-range scope');
	assert.ok(GRIPS[ID] && CHARGERS[ID] && VIEWS[ID]?.bolt > 0, 'fingers, a bolt knob and its stroke');
});

test('one body shot downs a person, even armoured and far off', () => {
	const S = weaponStats({ i: ID, u: 'snip1', l: 1, t: 0 });
	for (const [part, d] of [['chest', 120], ['gut', 300], ['head', 600]]) {
		const h = createHealth({ max: 120, armour: 35 });
		const r = applyDamage(h, { amount: damageAt(S, d), type: S.type, part });
		assert.ok(r.killed, `${part} at ${d} m`);
	}
	// where it lands still counts: a leg or an arm is a wound, not a kill, on a tough target
	const h = createHealth({ max: 130, armour: 50 });
	assert.ok(!applyDamage(h, { amount: S.dmg, type: S.type, part: 'arm' }).killed, 'an arm only wounds');
});

test('a near miss is drawn onto the person it passed; a wide miss is not', () => {
	const layer = createLayer();
	const shapes = personShapes(0, 0, -100, 1.75);
	layer.add({ id: 'p', kind: 'person', faction: 'raiders', bound: { x: 0, y: 0.9, z: -100, r: 1.1 }, shapes });
	const o = { x: 0, y: 1.3, z: 0 }, A = WEAPONS[ID].assist;
	// 45 cm wide of the torso's edge at 100 m
	const near = unit(0.115 * 1.75 + 0.45, 0, -100);
	assert.equal(layer.cast(o, near, 300), null, 'the exact ray misses');
	const hit = layer.cast(o, near, 300, null, {}, A);
	assert.ok(hit?.T, 'the assisted ray meets them');
	// drawn to the nearest point of that shape, the exact ray meets it
	const at = nearestOn(hit.shape, o, near), to = unit(at.x - o.x, at.y - o.y, at.z - o.z);
	assert.ok(rayShape(o, to, hit.shape), 'the shot sent to the shape strikes it');
	assert.equal(layer.cast(o, to, 300)?.T.id, 'p');
	// three metres off is a miss
	assert.equal(layer.cast(o, unit(3, 0, -100), 300, null, {}, A), null);
});

test('the assist never reaches a warded child', () => {
	const layer = createLayer();
	layer.add({ id: 'kid', kind: 'person', child: true, bound: { x: 0, y: 0.6, z: -50, r: 0.8 }, shapes: personShapes(0, 0, -50, 1.2) });
	const r = layer.cast({ x: 0, y: 1, z: 0 }, unit(0.4, 0, -50), 300, null, {}, WEAPONS[ID].assist);
	assert.ok(!r || r.ward, 'only ever the ward');
});

test('the scope view: a hook round each scope picture, and let go when put away', () => {
	const seen = [];
	const off = onScopeCapture((phase, cam) => seen.push([phase, cam]));
	scopeCapture('before', 1); scopeCapture('after', 1);
	off(); scopeCapture('before', 2);
	assert.deepEqual(seen, [['before', 1], ['after', 1]]);
	scopeView.active = true; scopeView.aiming = 1; scopeView.item = ID;
	scopeGone();
	assert.equal(scopeView.active, false); assert.equal(scopeView.aiming, 0);
});
