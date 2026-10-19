// The lock-on (combat/target-focus.js), where rounds land (health.js PARTS) and what wounds do
// (combat/wounds.js): run with node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { trackStep, aimAngles, pickAt, LOCK_WINDOW } from '../src/combat/target-focus.js';
import { createHealth, applyDamage, PARTS } from '../src/combat/health.js';
import { createWounds, react, pace, CRIPPLE_AT } from '../src/combat/wounds.js';
import { ACTIONS } from '../src/people/actions.js';

const lock = () => ({ offY: 0, offP: 0, recY: 0, recP: 0, lastY: null, lastP: null, slip: 0, acq: 1 });

test('lock-on: the view follows a moving target and settles on the chest', () => {
	const L = lock(), p = { yaw: 0.4, pitch: 0.1 }, eye = { x: 0, y: 1.7, z: 0 };
	let want;
	for (let i = 0; i < 90; i++) { const at = { x: -3 + i * 0.05, y: 1.35, z: -15 }; want = aimAngles(eye, at); assert.ok(trackStep(L, p, want, 1 / 60)); }
	assert.ok(Math.abs(p.yaw - want.yaw) < 0.01, 'yaw on the target');
	assert.ok(Math.abs(p.pitch - want.pitch) < 0.01, 'pitch on the chest');
});

test('lock-on: your own mouse moves the aim on their body, within the window, and holds it there', () => {
	const L = lock(), p = { yaw: 0, pitch: 0 }, eye = { x: 0, y: 1.7, z: 0 }, at = { x: 0, y: 1.35, z: -20 };
	const want = aimAngles(eye, at);
	for (let i = 0; i < 30; i++) trackStep(L, p, want, 1 / 60);
	// up toward the head: 0.45 m at 20 m
	p.pitch += Math.atan(0.45 / 20);
	for (let i = 0; i < 60; i++) trackStep(L, p, want, 1 / 60);
	assert.ok(Math.abs(p.pitch - (want.pitch + Math.atan(0.45 / 20))) < 0.002, 'the head shot held');
	// far over the top: kept at the window's edge
	p.pitch += 0.2;
	for (let i = 0; i < 30; i++) trackStep(L, p, want, 1 / 60);
	assert.ok(p.pitch - want.pitch <= Math.atan(LOCK_WINDOW.up / 20) + 1e-6);
});

test('lock-on: recoil kicks and settles back; a hard push sideways lets go', () => {
	const L = lock(), p = { yaw: 0, pitch: 0 }, want = { yaw: 0, pitch: 0, d: 15 };
	for (let i = 0; i < 10; i++) trackStep(L, p, want, 1 / 60);
	p.pitch += 0.03; trackStep(L, p, want, 1 / 60, 0, 0.03);
	assert.ok(p.pitch > 0.01, 'the kick shows');
	for (let i = 0; i < 90; i++) trackStep(L, p, want, 1 / 60);
	assert.ok(Math.abs(p.pitch) < 0.002, 'and settles');
	let held = true;
	for (let i = 0; i < 10 && held; i++) { p.yaw += 0.08; held = trackStep(L, p, want, 1 / 60); }
	assert.equal(held, false, 'flicked away, the lock lets go');
});

test('tap to lock: the person under the finger, by their body on screen', () => {
	const px = (q) => ({ x: 200 + q.x * 40, y: 400 - q.y * 40, z: 0.5 });
	const a = { id: 'a', bound: { x: 0, y: 0.9, z: -8 } }, b = { id: 'b', bound: { x: 3, y: 0.9, z: -8 } };
	assert.equal(pickAt([a, b], 202, 380, px)?.id, 'a');
	assert.equal(pickAt([a, b], 318, 350, px)?.id, 'b');
	assert.equal(pickAt([a, b], 600, 100, px), null);
});

test('the head is the weakest point; centre mass hits harder than a limb', () => {
	assert.ok(PARTS.head > PARTS.neck && PARTS.neck > PARTS.chest && PARTS.chest > PARTS.gut && PARTS.gut > PARTS.leg && PARTS.leg > PARTS.arm);
	const h = createHealth({ max: 100 });
	assert.equal(applyDamage(h, { amount: 30, type: 'ballistic', part: 'head' }).killed, true, 'a rifle round to the head drops them');
	const f = createHealth({ max: 100 });
	applyDamage(f, { amount: 10, part: 'head', melee: 'jab' });
	assert.ok(f.hp > 100 - 10 * PARTS.head, 'a fist to the head counts for less than a bullet');
});

const motion = () => { const S = { heading: 0, act: { name: null }, clutch: null }; return { S, play(n) { S.act.name = n; }, act(n) { S.act.name = n; } }; };

test('a leg wound slows, then a leg gone cripples: down on that knee', () => {
	const W = createWounds(), M = motion();
	assert.equal(pace(W).k, 1);
	react(W, M, null, { part: 'leg', side: 'R' }, { dealt: 30 }, { max: 100, rand: () => 0.1 });
	const p = pace(W);
	assert.ok(p.k < 1 && p.limp > 0 && p.side === 'R' && !p.run, 'a limp on the right');
	let R;
	for (let i = 0; i < 5 && !W.crippled; i++) R = react(W, M, null, { part: 'leg', side: 'R' }, { dealt: 30 }, { max: 100, rand: () => 0.1 });
	assert.ok(W.legs.R >= CRIPPLE_AT && W.crippled === 'R' && R.crippled);
	assert.equal(pace(W).k, 0);
	assert.equal(M.S.act.name, 'hurt-crippledR');
});

test('each place hit reacts its own way, on its side, and varies', () => {
	const seen = new Map();
	let r = 7;
	const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
	for (const part of ['head', 'neck', 'chest', 'gut', 'shoulder', 'arm', 'leg']) for (const side of ['L', 'R']) for (let i = 0; i < 12; i++) {
		const M = motion(), R = react(createWounds(), M, null, { part, side }, { dealt: 25 }, { max: 100, armed: i % 2 === 0, rand });
		assert.ok(R?.name && ACTIONS[R.name], `${part} ${side}: ${R?.name}`);
		if (part === 'shoulder' || part === 'arm' || part === 'leg') assert.ok(R.name.includes(side), `${part} on the ${side}`);
		const set = seen.get(part) || new Set(); set.add(R.name.replace(/[LR]\+?$/, '')); seen.set(part, set);
	}
	for (const [part, set] of seen) if (part !== 'arm') assert.ok(set.size >= 2, `${part} has more than one reaction`);
	assert.ok(react(createWounds(), motion(), null, { part: 'chest' }, { dealt: 40 }, { max: 100, rand }).stagger > 0.5, 'centre mass knocks them back');
	assert.equal(react(createWounds(), motion(), null, { part: 'chest' }, { dealt: 40, killed: true }, { max: 100 }), null, 'the dead do not react');
});
