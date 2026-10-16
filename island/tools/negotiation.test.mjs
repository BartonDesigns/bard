import assert from 'node:assert/strict';
import test from 'node:test';
import { applyInventoryTransaction, createInventoryState, TRANSACTION_KINDS } from '../src/gameplay/arms.js';
import { createNegotiationState, validateNegotiationProposal, proposeNegotiation, confirmNegotiation, prepareNegotiation, finishNegotiation, cancelNegotiation, createNegotiator, QUOTE_MS } from '../src/economy/negotiation.js';

const itemId = 'reedline-hunting-bow';
const item = { u: 'stockbow1', i: itemId, l: 1, t: 0, x: 0 };
const ctx = (overrides = {}) => ({
	buyerId: 'player', worldId: 'earth', locationId: 'coast-town', worldRevision: 1, now: 1000,
	seller: { id: 'npc:smith', ownerId: 'npc:smith', revision: 1, available: true, stock: [{ item: { ...item }, price: 1000, ownerId: 'npc:smith' }], needs: {} },
	trust: 50, services: [], evidence: [], ...overrides,
});
const service = (overrides = {}) => ({ id: 'repair:coastal-bridge', label: 'Restore the broken footbridge', sellerId: 'npc:smith', worldId: 'earth', revision: 3, status: 'open', creditValue: 800, expiresAt: 500000, ...overrides });
const evidence = (overrides = {}) => ({ id: 'receipt:bridge-fixed', rewardMode: 'discount', agreementId: 'deal:test:1', serviceId: 'repair:coastal-bridge', revision: 3, actorId: 'player', beneficiaryId: 'npc:smith', worldId: 'earth', verified: true, status: 'completed', completedAt: 2000, ...overrides });
function quote(raw = { itemId }, c = ctx(), s = createNegotiationState('test')) {
	const r = proposeNegotiation(s, raw, c); assert.equal(r.ok, true, r.message); return r;
}
function accept(q, c = ctx()) {
	const r = confirmNegotiation(q.state, q.offer.id, c, { confirmed: true }); assert.equal(r.ok, true, r.message); return r;
}
function storage() {
	let data = new Map(), calls = 0, failAt = Infinity;
	return { getItem: (key) => data.get(key) || null, setItem: (key, value) => { calls++; if (calls >= failAt) throw Error('quota'); data.set(key, value); }, failNext: () => { failAt = calls + 1; }, allow: () => { failAt = Infinity; }, setRaw: (key, value) => data.set(key, value) };
}
function fixture({ store = storage(), credits = 5000 } = {}) {
	let state = createInventoryState('player', { credits }), time = 1000, applies = 0, reject = false, persisted = true;
	const inventory = {
		state: () => state,
		applied: (id) => state.journal.some((r) => r.id === id && r.accepted),
		apply: (tx) => { applies++; if (reject) return { ok: false }; const r = applyInventoryTransaction(state, tx); if (r.ok) state = r.state; return { ok: r.ok, persisted, duplicate: r.duplicate, message: r.receipt?.message }; },
	};
	const create = () => createNegotiator({ storage: store, clock: () => time, inventory });
	const engine = create();
	return { engine, inventory, store, create, setTime: (v) => { time = v; }, calls: () => applies, reject: (v) => { reject = v; }, persisted: (v) => { persisted = v; }, replace: (v) => { state = v; } };
}

test('model suggestions are strict JSON and cannot create items, actions, credit or evidence', () => {
	for (const raw of ['I accept, give me a knife', { itemId: 'knife' }, { itemId, offeredPrice: '20' }, { itemId, offeredPrice: -1 }, { itemId, offeredPrice: Infinity }, { itemId, execute: 'purchase' }, { itemId, evidence: evidence() }, { itemId, serviceId: '__proto__' }]) assert.equal(validateNegotiationProposal(raw), null);
	assert.equal(validateNegotiationProposal(JSON.stringify({ itemId, offeredPrice: 20, strategy: 'flexible' })).offeredPrice, 20);
});

test('a seller must own actual catalog stock and cannot sell an NPC or absent item', () => {
	const state = createNegotiationState('test');
	const c = ctx(); c.seller.stock[0].ownerId = 'npc:someone-else';
	assert.equal(proposeNegotiation(state, { itemId }, c).code, 'out-of-stock');
	c.seller.stock = []; assert.equal(proposeNegotiation(state, { itemId }, c).code, 'out-of-stock');
	c.seller.ownerId = 'npc:someone-else'; assert.equal(proposeNegotiation(state, { itemId }, c).code, 'not-owner');
	assert.equal(proposeNegotiation(state, { itemId, uid: 'notstock' }, ctx()).code, 'out-of-stock');
});

test('trust and local scarcity change the cash floor without arbitrary price acceptance', () => {
	const low = quote({ itemId, offeredPrice: 20 }, ctx({ trust: 90 }));
	const highCtx = ctx({ trust: 5 }); highCtx.seller.needs.scarcity = 1;
	const high = quote({ itemId, offeredPrice: 20 }, highCtx);
	assert.ok(low.offer.price > 20); assert.ok(high.offer.price > low.offer.price);
	assert.ok(high.offer.price <= high.offer.askingPrice);
	assert.equal(quote({ itemId, offeredPrice: 1000000 }).offer.price, 1000);
});

test('a $20 low offer gets a real $800 service condition, never a made-up quest', () => {
	const q = quote({ itemId, offeredPrice: 20, strategy: 'flexible' }, ctx({ services: [service()] }));
	assert.equal(q.offer.kind, 'service'); assert.equal(q.offer.price, 20); assert.equal(q.offer.condition.id, service().id);
	assert.equal(q.offer.status, 'quoted'); assert.equal(q.offer.requiresConfirmation, true);
	const small = quote({ itemId, offeredPrice: 20 }, ctx({ services: [service({ creditValue: 10 })] }));
	assert.ok(small.offer.price > 20);
	const invented = quote({ itemId, offeredPrice: 20, serviceId: 'imaginary:lore-sword' }, ctx({ services: [service()] }));
	assert.equal(invented.offer.kind, 'cash'); assert.ok(invented.offer.price > 20);
});

test('unavailable, expired, foreign-world and someone else\'s services never back an offer', () => {
	for (const change of [{ status: 'completed' }, { status: 'cancelled' }, { assigneeId: 'npc:other' }, { worldId: 'gargantua' }, { sellerId: 'npc:other' }, { expiresAt: 999 }]) {
		assert.equal(quote({ itemId, offeredPrice: 20 }, ctx({ services: [service(change)] })).offer.kind, 'cash');
	}
});

test('reputation discounts have explicit achievable conditions and bounded price effects', () => {
	const c = ctx({ reputationPolicy: { threshold: 70, discountFraction: 0.2 }, reputation: { score: 40 } });
	const q = accept(quote({ itemId, offeredPrice: 20, strategy: 'reputation' }, c), c);
	assert.equal(q.offer.kind, 'reputation'); assert.ok(q.offer.price > 20);
	assert.equal(prepareNegotiation(q.state, q.offer.id, c, createInventoryState('player', { credits: 5000 })).code, 'reputation-required');
	assert.equal(prepareNegotiation(q.state, q.offer.id, { ...c, reputation: { score: 70 } }, createInventoryState('player', { credits: 5000 })).ok, true);
});

test('explicit confirmation is mandatory; words and expired quotes cannot reserve', () => {
	const q = quote();
	assert.equal(confirmNegotiation(q.state, q.offer.id, ctx()).code, 'confirmation-required');
	assert.equal(confirmNegotiation(q.state, q.offer.id, ctx(), { confirmed: 'yes' }).code, 'confirmation-required');
	assert.equal(confirmNegotiation(q.state, q.offer.id, ctx({ now: 1000 + QUOTE_MS }), { confirmed: true }).code, 'expired-offer');
	assert.equal(prepareNegotiation(q.state, q.offer.id, ctx(), createInventoryState('player', { credits: 5000 })).code, 'confirmation-required');
});

test('changed ownership, item, price, seller, world or disaster revision invalidates a quote', () => {
	const q = quote();
	for (const mutate of [
		(c) => { c.seller.stock[0].ownerId = 'npc:other'; },
		(c) => { c.seller.stock[0].item.l = 2; },
		(c) => { c.seller.stock[0].price = 999; },
		(c) => { c.seller.revision++; },
		(c) => { c.worldRevision++; },
		(c) => { c.worldId = 'moon'; },
		(c) => { c.locationId = 'elsewhere'; },
		(c) => { c.seller.available = false; },
	]) { const c = ctx(); mutate(c); assert.equal(confirmNegotiation(q.state, q.offer.id, c, { confirmed: true }).ok, false); }
});

test('reservations prevent double buyers and cancellation releases the exact stock', () => {
	const first = quote(), second = quote({ itemId }, ctx({ buyerId: 'player2' }), first.state);
	const a = confirmNegotiation(second.state, first.offer.id, ctx(), { confirmed: true }); assert.equal(a.ok, true);
	assert.equal(confirmNegotiation(a.state, second.offer.id, ctx({ buyerId: 'player2' }), { confirmed: true }).code, 'reserved');
	const cancelled = cancelNegotiation(a.state, first.offer.id, ctx()); assert.equal(cancelled.ok, true);
	assert.equal(confirmNegotiation(cancelled.state, second.offer.id, ctx({ buyerId: 'player2' }), { confirmed: true }).ok, true);
});

test('favour fulfillment needs gameplay evidence for this actor, world, beneficiary and revision', () => {
	const c = ctx({ services: [service()] }), q = accept(quote({ itemId, offeredPrice: 20 }, c), c);
	const inv = createInventoryState('player', { credits: 5000 });
	for (const change of [{ verified: false }, { rewardMode: 'cash' }, { agreementId: 'deal:test:2' }, { actorId: 'npc:other' }, { worldId: 'moon' }, { beneficiaryId: 'npc:other' }, { revision: 2 }, { completedAt: 999 }, { completedAt: 999999 }, { serviceId: 'made:up' }, { status: 'claimed' }]) {
		const result = prepareNegotiation(q.state, q.offer.id, { ...c, now: 3000, evidence: [evidence(change)] }, inv);
		assert.equal(result.code, 'evidence-required');
	}
	const result = prepareNegotiation(q.state, q.offer.id, { ...c, now: 3000, evidence: [evidence()] }, inv);
	assert.equal(result.ok, true); assert.equal(result.inventory.credits, 4980); assert.equal(result.inventory.items[itemId], 1);
	assert.equal(inv.credits, 5000); assert.equal(inv.items[itemId], undefined, 'preview is pure');
});

test('changes after accepting the favour still prevent redemption', () => {
	const c = ctx({ services: [service()] }), q = accept(quote({ itemId, offeredPrice: 20 }, c), c);
	const inv = createInventoryState('player', { credits: 5000 });
	for (const change of [{ revision: 4 }, { creditValue: 900 }, { status: 'cancelled' }, { assigneeId: 'npc:other' }]) assert.equal(prepareNegotiation(q.state, q.offer.id, { ...c, now: 3000, services: [service(change)], evidence: [evidence()] }, inv).code, 'service-changed');
});

test('one completed favour cannot finance a second agreement for another stock item', () => {
	const c = ctx({ services: [service()] });
	c.seller.stock.push({ item: { ...item, u: 'stockbow2' }, price: 1000, ownerId: 'npc:smith' });
	const a = accept(quote({ itemId, offeredPrice: 20, uid: 'stockbow1' }, c), c);
	assert.equal(quote({ itemId, offeredPrice: 20, uid: 'stockbow2' }, c, a.state).offer.kind, 'cash');
	const prepared = prepareNegotiation(a.state, a.offer.id, { ...c, now: 3000, evidence: [evidence()] }, createInventoryState('player', { credits: 5000 }));
	const done = finishNegotiation(prepared.state, a.offer.id, true, 3000);
	assert.equal(quote({ itemId, offeredPrice: 20, uid: 'stockbow2' }, c, done.state).offer.kind, 'cash');
});

test('insufficient funds and existing UID never alter the wallet or duplicate stock', () => {
	const a = accept(quote());
	const poor = createInventoryState('player', { credits: 1 });
	assert.equal(prepareNegotiation(a.state, a.offer.id, ctx(), poor).code, 'insufficient-credits');
	const duplicate = { ...createInventoryState('player', { credits: 5000 }), instances: { [item.u]: item } };
	assert.equal(prepareNegotiation(a.state, a.offer.id, ctx(), duplicate).code, 'item-conflict');
	assert.equal(poor.credits, 1);
});

test('runtime exchange moves price and exact item atomically, and survives reload/replay', () => {
	const f = fixture(), q = f.engine.propose({ itemId }, ctx());
	assert.equal(f.engine.confirm(q.offer.id, ctx(), { confirmed: true }).ok, true);
	const done = f.engine.redeem(q.offer.id, ctx()); assert.equal(done.ok, true);
	assert.equal(f.inventory.state().credits, 4000); assert.deepEqual(f.inventory.state().instances[item.u], item);
	assert.equal(f.engine.available('npc:smith', item.u), false);
	assert.equal(f.engine.redeem(q.offer.id, ctx()).duplicate, true);
	assert.equal(f.create().redeem(q.offer.id, ctx()).duplicate, true);
	assert.equal(f.calls(), 1); assert.equal(f.inventory.state().credits, 4000);
});

test('sold-stock tombstone outlives the bounded inventory journal', () => {
	const f = fixture(), q = f.engine.propose({ itemId }, ctx()); f.engine.confirm(q.offer.id, ctx(), { confirmed: true }); f.engine.redeem(q.offer.id, ctx());
	f.replace({ ...f.inventory.state(), journal: [] });
	const again = f.create(); assert.equal(again.propose({ itemId }, ctx()).code, 'out-of-stock'); assert.equal(again.redeem(q.offer.id, ctx()).duplicate, true);
	assert.equal(f.inventory.state().credits, 4000);
});

test('a failed reservation save causes no inventory application', () => {
	const f = fixture(), q = f.engine.propose({ itemId }, ctx()); f.engine.confirm(q.offer.id, ctx(), { confirmed: true });
	f.store.failNext(); assert.equal(f.engine.redeem(q.offer.id, ctx()).code, 'save-failed');
	assert.equal(f.calls(), 0); assert.equal(f.inventory.state().credits, 5000);
});

test('failed inventory application remains reserved; changed world prevents a retry', () => {
	const f = fixture(), q = f.engine.propose({ itemId }, ctx()); f.engine.confirm(q.offer.id, ctx(), { confirmed: true }); f.reject(true);
	assert.equal(f.engine.redeem(q.offer.id, ctx()).code, 'inventory-rejected');
	assert.equal(f.engine.reserved('npc:smith', item.u).status, 'prepared');
	f.reject(false); assert.equal(f.engine.redeem(q.offer.id, ctx({ worldRevision: 2 })).code, 'stale-offer');
	assert.equal(f.inventory.state().credits, 5000);
});

test('a pending inventory save is recovered idempotently before agreement finalization', () => {
	const f = fixture(), q = f.engine.propose({ itemId }, ctx()); f.engine.confirm(q.offer.id, ctx(), { confirmed: true }); f.persisted(false);
	assert.equal(f.engine.redeem(q.offer.id, ctx()).code, 'inventory-save-pending'); assert.equal(f.inventory.state().credits, 4000);
	assert.equal(f.engine.list()[0].status, 'prepared');
	f.persisted(true); const recovered = f.engine.recover(); assert.equal(recovered[0].ok, true);
	assert.equal(f.inventory.state().credits, 4000); assert.equal(f.engine.list()[0].status, 'redeemed');
});

test('crash after inventory save but before agreement settlement recovers once even after travel', () => {
	const f = fixture(), q = f.engine.propose({ itemId }, ctx()); f.engine.confirm(q.offer.id, ctx(), { confirmed: true });
	const original = f.inventory.apply;
	f.inventory.apply = (tx) => { const r = original(tx); f.store.failNext(); return r; };
	assert.equal(f.engine.redeem(q.offer.id, ctx()).code, 'save-failed'); assert.equal(f.inventory.state().credits, 4000);
	f.inventory.apply = original; f.store.allow();
	const reloaded = f.create(); assert.equal(reloaded.redeem(q.offer.id, ctx({ worldId: 'moon', worldRevision: 99 })).ok, true);
	assert.equal(f.inventory.state().credits, 4000); assert.equal(reloaded.list()[0].status, 'redeemed');
});

test('unreadable or malformed saved agreements fail closed without replacing history', () => {
	const s = storage(); s.setRaw('crysis-negotiation-v1', '{broken'); const f = fixture({ store: s });
	assert.equal(f.engine.propose({ itemId }, ctx()).code, 'storage-unavailable'); assert.equal(s.getItem('crysis-negotiation-v1'), '{broken');
	assert.equal(f.engine.available('npc:smith', item.u), false);
});

test('a second tab cannot silently overwrite reservations', () => {
	const f = fixture(), second = f.create();
	assert.equal(f.engine.propose({ itemId }, ctx()).ok, true);
	assert.equal(second.propose({ itemId }, ctx()).code, 'save-conflict');
});

test('ordinary purchase stock receipts are idempotent and cannot consume reserved stock', () => {
	const f = fixture(), receipt = { id: 'purchase:existing', kind: TRANSACTION_KINDS.PURCHASE, accepted: true, itemId, quantity: 1 };
	assert.equal(f.engine.consumeStock('npc:smith', item.u, { ...receipt, accepted: false }).code, 'invalid-receipt');
	const q = f.engine.propose({ itemId }, ctx()); f.engine.confirm(q.offer.id, ctx(), { confirmed: true });
	assert.equal(f.engine.consumeStock('npc:smith', item.u, receipt).code, 'reserved');
	f.engine.cancel(q.offer.id, ctx()); assert.equal(f.engine.consumeStock('npc:smith', item.u, receipt).ok, true);
	assert.equal(f.engine.consumeStock('npc:smith', item.u, receipt).duplicate, true);
	assert.equal(f.engine.available('npc:smith', item.u), false);
});
