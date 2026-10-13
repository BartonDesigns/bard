import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { quote, settle, step, line, expected } from '../src/vehicles/fares-core.js';

test('fares grow with the distance; tips reward quick, smooth driving', () => {
	assert.ok(quote(400) < quote(1500));
	assert.equal(quote(0) % 5, 0);
	const good = settle({ metres: 1200, seconds: expected(1200) * 0.8 }), bad = settle({ metres: 1200, seconds: expected(1200) * 2.5, hits: 3 });
	assert.ok(good.tip > 0 && good.stars >= 4);
	assert.equal(bad.tip, 0); assert.ok(bad.stars <= 2);
	assert.equal(good.total, good.fare + good.tip);
	assert.ok(settle({ metres: 1200, seconds: 60, scares: 1 }).tip < settle({ metres: 1200, seconds: 60 }).tip);
});

test('stages: hail, board, arrive; leaving lapses; words fit the ride', () => {
	let F = { stage: 'hailing' };
	assert.equal(step(F, 'arrive').out, null);
	F = step(F, 'board').F; assert.equal(F.stage, 'riding');
	assert.equal(step(F, 'arrive').out.done, true);
	assert.equal(step({ stage: 'riding' }, 'leave').out.say, 'out');
	assert.equal(step({ stage: 'hailing' }, 'leave').out.say, null);
	assert.match(line('board', { place: 'Danville' }), /Danville/);
	assert.match(line('board', { place: '' }), /pin/);
	assert.match(line('thanks', { stars: 1 }), /walk|guess/);
});

// ---- the runtime with a stand-in car and street ----
function stage() {
	globalThis.localStorage = { m: new Map(), getItem(k) { return this.m.get(k) ?? null; }, setItem(k, v) { this.m.set(k, v); } };
	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
	camera.position.set(0, 1.7, 0); camera.lookAt(0, 1.7, -1); camera.updateMatrixWorld();
	const car = { x: 0, y: 0, z: 0, speed: 8 }, driving = { on: true };
	const body = (x, z) => ({ active: true, role: 'walk', route: { kind: 'street' }, P: { dna: { seed: 7 }, height: 1.7, root: { visible: true } }, M: { S: { pos: new THREE.Vector3(x, 0, z), look: {}, feel: {}, remark: null }, want: {}, gesture() {}, place(x2, y2, z2) { this.S.pos.set(x2, y2, z2); } } });
	const said = [], paid = [], hints = [];
	const W = { island: { heightAt: () => 3 }, labels: { where: (x) => ({ name: x > 200 ? 'Danville' : 'San Ramon' }) } };
	return { camera, car, driving, body, said, paid, hints, mk: (pool) => ({ camera, world: () => W, people: { pool, sidewalk: (x, z) => [x, z] }, chatter: { say: (p, l) => said.push([p, l.text]) }, persona: () => ({ first: 'Rae' }), drive: { carAt: () => (driving.on ? car : null) }, arms: () => ({ apply: (tx) => (paid.push(tx), { ok: true }) }), hint: (t) => hints.push(t), isPhone: false }) };
}

test('a fare from hail to payment, the body kept aside and back at the kerb', async () => {
	const { createFares } = await import('../src/vehicles/fares.js');
	const T = stage(), p = T.body(0, -60);
	const R = createFares(T.mk([p]));
	assert.match(R.hailNow(), /Rae/);
	assert.ok(p.held);
	assert.equal(R.mark().title, 'Pick up Rae');
	// pull up and stop
	T.car.z = -57; T.car.speed = 1; R.update(0.1);
	assert.equal(R.info().fare.stage, 'riding');
	assert.equal(p.active, false); assert.equal(p.reserved, true);
	const dest = R.mark(); assert.match(dest.title, /Drive Rae/);
	// a crash on the way
	T.car.speed = 15; R.update(1 / 60); T.car.speed = 2; R.update(1 / 60);
	assert.equal(R.info().fare.hits, 1);
	// drive there and stop
	T.car.x = dest.x; T.car.z = dest.z; T.car.speed = 1; R.update(0.1);
	assert.equal(R.info().fare, null);
	assert.equal(T.paid.length, 1); assert.ok(T.paid[0].get.credits >= quote(350));
	assert.ok(p.active && p.P.root.visible && !p.reserved, 'back on the pavement');
	assert.ok(T.said.some(([q]) => q === p), 'they say goodbye in their own body');
	for (let k = 0; k < 80; k++) R.update(0.1);
	assert.ok(!p.held && !p.override, 'and go on their way');
	assert.equal(R.info().rides, 1);
});

test('stopping the car with a passenger lets them out unpaid', async () => {
	const { createFares } = await import('../src/vehicles/fares.js');
	const T = stage(), p = T.body(0, -60);
	const R = createFares(T.mk([p]));
	R.hailNow(); T.car.z = -57; T.car.speed = 1; R.update(0.1);
	T.driving.on = false; R.update(0.1);
	assert.equal(R.info().fare, null); assert.equal(T.paid.length, 0);
	assert.ok(p.active && !p.reserved);
});
