import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, healOf, USES, createItemUse } from '../src/gameplay/item-use.js';
import { createInventoryState, applyInventoryTransaction } from '../src/gameplay/arms.js';
import { score } from '../src/combat/morality.js';

test('a medkit tends the hurt near you first, else you; never nothing', () => {
	assert.equal(plan('field-medkit', { wounded: [{ p: 1 }], hurt: 50 }).kind, 'tend');
	assert.equal(plan('field-medkit', { hurt: 20 }).kind, 'self');
	assert.equal(plan('field-medkit', {}).kind, 'none');
	assert.equal(plan('camp-lantern', { hurt: 20 }).kind, 'none');
	assert.ok(healOf({ i: 'field-medkit', l: 5, t: 2 }) > healOf({ i: 'field-medkit', l: 1, t: 0 }));
	assert.ok(USES['field-medkit']);
	const t = score('tend'); assert.ok(t.mercy > 0 && t.protect > 0);
});

test('using a held medkit spends that one and the next comes to hand', () => {
	let S = createInventoryState('test', { credits: 1000 });
	const ok = (tx) => { const r = applyInventoryTransaction(S, tx); if (r.ok) S = r.state; return { ok: r.ok, message: r.receipt?.message }; };
	assert.ok(ok({ id: 'buy-1', kind: 'purchase', itemId: 'field-medkit', sourceId: 'npc-trader', quantity: 2, unitPrice: undefined }).ok || ok({ id: 'buy-2', kind: 'purchase', itemId: 'field-medkit', sourceId: 'supermarket', quantity: 2 }).ok);
	const meds = Object.values(S.instances).filter((x) => x.i === 'field-medkit');
	assert.equal(meds.length, 2);
	let hand = meds[0].u, mended = 0, hints = [];
	const arms = {
		held: () => (hand && S.instances[hand] ? S.instances[hand] : null), state: () => S, catalog: () => [{ id: 'field-medkit', activities: ['hunting'] }],
		apply: ok, hold: (u) => { hand = u; }, train() {},
	};
	const combat = { woundedNear: () => [], hurt0: () => 40, mend: (n) => (mended += n, n), tend: () => true };
	const U = createItemUse({ arms, combat: () => combat, people: {}, persona: () => ({ first: 'A' }), camera: { position: { x: 0, z: 0 } }, hint: (t) => hints.push(t), chatter: null, morality: () => null });
	assert.ok(U.use());
	assert.ok(mended >= 35);
	assert.equal(Object.values(S.instances).filter((x) => x.i === 'field-medkit').length, 1);
	assert.equal(hand, meds[1].u, 'the next one is in hand');
	assert.ok(U.use());
	assert.equal(U.usable(), null);
	assert.ok(hints.some((h) => /last one/.test(h)));
});
