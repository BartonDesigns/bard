import test from 'node:test';
import assert from 'node:assert/strict';
import { createArmsRuntime } from '../src/crysis/arms-runtime.js';
import { createBank } from '../src/economy/bank.js';
import { createNegotiationRuntime } from '../src/economy/negotiation-runtime.js';

const ITEM = 'reedline-hunting-bow';
const DAY = 86400000;
function memory() {
  const data = new Map(); let fail = null;
  return { getItem: k => data.get(k) || null, setItem: (k, v) => { if (fail?.(k)) throw Error('disk full'); data.set(k, v); }, fail: f => { fail = f; } };
}
function fixture(t, options = {}) {
  const oldStorage = globalThis.localStorage, storage = memory(); globalThis.localStorage = storage;
  t.after(() => { globalThis.localStorage = oldStorage; });
  let now = 1000, body = 'earth', danger = false, player = { x: 0, y: 0, z: 0 }, taskStatus = 'open', proof = null, joins = 0, joinResult = true;
  let agreementId = null, rewardMode = 'cash', damage = [];
  const site = { id: 'shore-outfitter', name: 'Shore Outfitter', kind: 'outfitter', sourceId: 'npc-trader', economyId: 'biz:shore', x: 2, y: 0, z: 0, actions: ['purchase'], npcId: 'npc:42' };
  const sites = [site];
  const person = { active: true, P: { dna: { seed: 42 } }, M: { S: { pos: { x: 2, y: 0, z: 0 } } } };
  const services = () => options.services ? [{ id: 'bridge-service', label: 'Repair the existing bridge', beneficiaryId: site.economyId, worldId: body, revision: 1, status: taskStatus, creditValue: 100, expiresAt: 500000, ...(taskStatus !== 'open' ? { assigneeId: 'player' } : {}) }] : [];
  const livingWorld = { servicesFor: services, completionEvidence: () => proof, clearAgreement: async (id, deal) => { if (agreementId !== deal) return { ok: false }; rewardMode = 'cash'; return { ok: true }; }, action: async (id, op, args) => { joins++; if (joinResult) { taskStatus = 'taken'; agreementId = args.agreementId; rewardMode = args.rewardMode; } return { ok: joinResult }; } };
  const arms = createArmsRuntime({ storageKey: 'test-real-arms', startingCredits: 1000, sites: () => sites, now: () => now });
  arms.update(0, player);
  const bank = createBank({ storage, clock: () => now });
  const runtime = createNegotiationRuntime({ arms, storage, bank, bodyKey: () => body, world: () => ({}), position: () => player, livingWorld, structures: () => ({ cataclysm: () => danger, store: { each: fn => damage.forEach((r, i) => fn('building:' + i, r)) } }), now: () => now, ...(options.resolve === false ? {} : { resolveSeller: () => site }) });
  return { arms, runtime, person, site, storage, bank, joins: () => joins, now: v => { now = v; }, body: v => { body = v; }, danger: v => { danger = v; }, damage: v => { damage = v; }, move: v => { player = v; }, failJoin: () => { joinResult = false; },
    complete: (overrides = {}) => { now = 3000; taskStatus = 'completed'; proof = { id: 'receipt:bridge1', serviceId: 'bridge-service', revision: 1, actorId: 'player', status: 'completed', verified: true, worldId: body, beneficiaryId: site.economyId, completedAt: now, agreementId, rewardMode, ...overrides }; },
  };
}

test('real arms shop and bargain share one stock lot; words alone cannot buy', async t => {
  const f = fixture(t);
  const q = f.runtime.propose(f.person, { kind: 'bargain', itemId: ITEM, amount: 120 });
  assert.equal(q.ok, true); assert.equal(q.offer.price, 120); assert.equal(f.arms.state().credits, 1000);
  assert.equal(f.runtime.redeem(f.person, q.offer.id).code, 'confirmation-required');
  assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, true);
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, false, 'ordinary buy respects the held item');
  const done = f.runtime.redeem(f.person, q.offer.id); assert.equal(done.ok, true, done.message);
  assert.equal(f.arms.state().credits, 1000 - q.offer.price); assert.equal(f.arms.state().items[ITEM], 1);
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, false, 'ordinary buy cannot regenerate sold stock');
  assert.equal(f.runtime.redeem(f.person, q.offer.id).duplicate, true);
});

test('an ordinary Buy consumes the same stock and pays once through the inventory API', t => {
  const f = fixture(t), price = f.arms.shopSheet(f.site.id).buy.find(x => x.itemId === ITEM).price;
  const bought = f.arms.buy(f.site.id, ITEM); assert.equal(bought.ok, true, bought.message);
  assert.equal(f.arms.state().credits, 1000 - price); assert.equal(f.arms.state().items[ITEM], 1);
  assert.equal(f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM }).ok, false);
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, false);
});

test('the actual merchant price and stock come from the catalog shop sheet', t => {
  const f = fixture(t), sheet = f.arms.shopSheet(f.site.id);
  const q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM });
  assert.equal(q.offer.askingPrice, sheet.buy.find(x => x.itemId === ITEM).price);
  assert.equal(f.runtime.propose(f.person, { kind: 'bargain', itemId: 'imaginary-knife', amount: 20 }).ok, false);
  for (const amount of [20.1, '20', -5, Infinity]) assert.equal(f.runtime.propose(f.person, { kind: 'bargain', itemId: ITEM, amount }).code, 'invalid-proposal');
  assert.equal(f.arms.state().credits, 1000);
});

test('large lowball needs current task and its exact discount-mode completion receipt', async t => {
  const f = fixture(t, { services: true }), q = f.runtime.propose(f.person, { kind: 'bargain', itemId: ITEM, amount: 20 });
  assert.equal(q.offer.kind, 'service'); assert.equal(q.offer.price, 20);
  assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, true);
  assert.equal((await f.runtime.confirm(f.person, q.offer.id)).duplicate, true); assert.equal(f.joins(), 1);
  assert.equal(f.runtime.redeem(f.person, q.offer.id).code, 'evidence-required');
  for (const overrides of [{ worldId: 'moon' }, { beneficiaryId: 'biz:wrong' }, { revision: 2 }, { actorId: 'npc:42' }, { agreementId: 'deal:another' }, { rewardMode: 'cash' }, { completedAt: 999 }]) {
    f.complete(overrides); assert.equal(f.runtime.redeem(f.person, q.offer.id).code, 'evidence-required');
  }
  f.complete(); assert.equal(f.runtime.redeem(f.person, q.offer.id).ok, true); assert.equal(f.arms.state().credits, 980);
  assert.equal(f.arms.state().items[ITEM], 1);
});

test('failed task reservation cancels the item agreement without taking money', async t => {
  const f = fixture(t, { services: true }), q = f.runtime.propose(f.person, { kind: 'service', itemId: ITEM, amount: 20 }); f.failJoin();
  assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, false);
  assert.equal(f.runtime.book.list()[0].status, 'cancelled'); assert.equal(f.arms.state().credits, 1000);
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, true);
});

test('agreement storage failure cannot spend the real arms wallet', async t => {
  const f = fixture(t), q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM });
  await f.runtime.confirm(f.person, q.offer.id);
  f.storage.fail(k => k === 'crysis-negotiation-v1');
  assert.equal(f.runtime.redeem(f.person, q.offer.id).code, 'save-failed'); assert.equal(f.arms.state().credits, 1000);
});

test('real arms persistence failure leaves a prepared exchange and recovery does not charge twice', async t => {
  const f = fixture(t), q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM }); await f.runtime.confirm(f.person, q.offer.id);
  f.storage.fail(k => k === 'test-real-arms');
  assert.equal(f.runtime.redeem(f.person, q.offer.id).code, 'inventory-save-pending');
  const after = f.arms.state().credits; assert.equal(after, 1000 - q.offer.price);
  f.storage.fail(null); const recovered = f.runtime.recover(); assert.equal(recovered[0].ok, true);
  assert.equal(f.arms.state().credits, after); assert.equal(f.arms.state().items[ITEM], 1);
});

test('daily restock creates a new item UID and each planet has separate stock', t => {
  const f = fixture(t); assert.equal(f.arms.buy(f.site.id, ITEM).ok, true);
  const firstUid = Object.values(f.arms.state().instances).find(x => x.i === ITEM).u;
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, false);
  f.now(DAY + 1000); assert.equal(f.arms.buy(f.site.id, ITEM).ok, true);
  assert.equal(f.arms.state().items[ITEM], 2); assert.equal(Object.keys(f.arms.state().instances).includes(firstUid), true);
  f.body('gargantua'); assert.equal(f.arms.buy(f.site.id, ITEM).ok, true); assert.equal(f.arms.state().items[ITEM], 3);
});

test('old daily quotes, another planet, distance, and cataclysm cannot authorize a purchase', async t => {
  const f = fixture(t), q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM });
  f.body('moon'); assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, false);
  f.body('earth'); f.danger(true); assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, false);
  f.danger(false); f.move({ x: 0, y: 30, z: 0 }); assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, false);
  f.move({ x: 500, y: 0, z: 0 }); assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, false);
  f.move({ x: 0, y: 0, z: 0 }); f.now(DAY + 1000); assert.equal((await f.runtime.confirm(f.person, q.offer.id)).ok, false);
  assert.equal(f.arms.state().credits, 1000);
});

test('nearby residents, children, and vendors assigned elsewhere cannot sell someone else\'s goods', t => {
  const f = fixture(t, { resolve: false }), other = { active: true, P: { dna: { seed: 99 } }, M: { S: { pos: { x: 2, y: 0, z: 0 } } } };
  assert.equal(f.runtime.contextFor(other).available, false);
  other.workSpot = { x: 500, y: 0, z: 500, work: { role: 'vendor' } };
  f.site.source = 'generated-commercial'; delete f.site.economyId;
  assert.equal(f.runtime.contextFor(other).available, false);
  other.workSpot.x = 2; other.workSpot.z = 0;
  assert.equal(f.runtime.contextFor(other).available, true);
  other.P.dna.child = true; assert.equal(f.runtime.contextFor(other).available, false);
  assert.equal(f.runtime.contextFor(f.person).available, true, 'explicit NPC owner still has authority');
  f.person.M.S.pos.y = 10; assert.equal(f.runtime.contextFor(f.person).available, false);
});


test('completed bargains and direct purchases pay the actual seller once', async t => {
  const f = fixture(t), q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM });
  await f.runtime.confirm(f.person, q.offer.id);
  const done = f.runtime.redeem(f.person, q.offer.id);
  assert.equal(done.ok, true); assert.equal(done.sellerSettlement, 'saved-local');
  assert.equal(f.bank.balance('biz:shore'), q.offer.price);
  f.runtime.redeem(f.person, q.offer.id); f.runtime.recover();
  assert.equal(f.bank.balance('biz:shore'), q.offer.price);
  const before = f.arms.state().credits;
  assert.equal(f.arms.buy(f.site.id, 'camp-lantern').ok, true);
  assert.equal(f.bank.balance('biz:shore'), q.offer.price + before - f.arms.state().credits);
});

test('merchant ledger save failure leaves successful goods/payment intact and reconciles later', async t => {
  const f = fixture(t), q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM });
  await f.runtime.confirm(f.person, q.offer.id);
  f.storage.fail(k => k === 'crysis-bank-v1');
  const done = f.runtime.redeem(f.person, q.offer.id);
  assert.equal(done.ok, true); assert.equal(done.sellerSettlement, 'pending');
  assert.equal(f.arms.state().items[ITEM], 1); assert.equal(f.arms.state().credits, 1000 - q.offer.price); assert.equal(f.bank.balance('biz:shore'), 0);
  f.storage.fail(null); f.body('moon'); f.runtime.recover();
  assert.equal(f.bank.balance('biz:shore'), q.offer.price, 'saved receipt keeps original payee after travel');
  f.runtime.recover(); assert.equal(f.bank.balance('biz:shore'), q.offer.price);
});


test('cancelling an accepted service bargain releases its reward binding without buying the item', async t => {
  const f = fixture(t, { services: true }), q = f.runtime.propose(f.person, { kind: 'service', itemId: ITEM, amount: 20 });
  await f.runtime.confirm(f.person, q.offer.id);
  assert.equal((await f.runtime.cancel(f.person, q.offer.id)).ok, true);
  assert.equal(f.runtime.book.list()[0].status, 'cancelled');
  assert.equal(f.arms.state().credits, 1000); assert.equal(f.arms.state().items[ITEM], undefined);
  f.complete(); assert.equal(f.runtime.redeem(f.person, q.offer.id).ok, false);
});


test('schema null budgets preserve real quote, bargain, service and reputation proposals', t => {
  const f = fixture(t, { services: true });
  const wallet = f.arms.state().credits;
  for (const kind of ['quote', 'bargain', 'service', 'reputation']) {
    const result = f.runtime.propose(f.person, { kind, itemId: ITEM, amount: null });
    assert.equal(result.ok, true, `${kind}: ${result.message}`);
    assert.equal(result.offer.status, 'quoted');
    assert.equal(result.offer.requiresConfirmation, true);
    assert.equal(result.offer.kind, kind === 'quote' ? 'cash' : kind === 'reputation' ? 'reputation' : 'service');
  }
  assert.equal(f.arms.state().credits, wallet, 'a nullable budget never confirms or spends');
  assert.equal(f.arms.state().items[ITEM], undefined);
  for (const amount of [false, '', '20', 0.5, NaN, Infinity, -1]) {
    assert.equal(f.runtime.propose(f.person, { kind: 'bargain', itemId: ITEM, amount }).code, 'invalid-proposal');
  }
});


test('destroyed merchant buildings block ordinary purchases and accepted bargains until repaired', async t => {
  const f = fixture(t), q = f.runtime.propose(f.person, { kind: 'quote', itemId: ITEM, amount: null });
  await f.runtime.confirm(f.person, q.offer.id);
  f.damage([{ x: 2, z: 0, y: 0, w: 12, d: 8, h: 10, a: 0, c: .93, m: [] }]);
  assert.equal(f.runtime.contextFor(f.person).available, false);
  assert.match(f.runtime.contextFor(f.person).reason, /repaired/);
  assert.equal(f.arms.buy(f.site.id, 'camp-lantern').ok, false);
  assert.equal(f.runtime.propose(f.person, { kind: 'quote', itemId: 'camp-lantern', amount: null }).ok, false);
  assert.equal(f.runtime.redeem(f.person, q.offer.id).ok, false);
  assert.equal(f.arms.state().credits, 1000);
  f.damage([]);
  assert.equal(f.runtime.contextFor(f.person).available, true);
  assert.equal(f.runtime.redeem(f.person, q.offer.id).ok, true);
  assert.equal(f.arms.buy(f.site.id, 'camp-lantern').ok, true);
});

test('damaged rotated storefronts include offset door sources without closing unrelated neighbours', t => {
  const f = fixture(t);
  // The site is 21 m from the centre, within a 40 m wide rotated building's door allowance.
  f.damage([{ x: 2, z: -21, y: 0, w: 40, d: 8, h: 10, a: Math.PI / 2, c: 0, m: [[0, 0, 1, 1]] }]);
  assert.equal(f.runtime.contextFor(f.person).available, false);
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, false);
  // A separate small building only 10 m away does not share this footprint.
  f.damage([{ x: 12, z: 0, y: 0, w: 4, d: 4, h: 10, a: 0, c: .93, m: [] }]);
  assert.equal(f.runtime.contextFor(f.person).available, true);
  // Nor does a damaged building on another vertical surface above this store.
  f.damage([{ x: 2, z: 0, y: 30, w: 12, d: 8, h: 10, a: 0, c: .93, m: [] }]);
  assert.equal(f.runtime.contextFor(f.person).available, true);
  assert.equal(f.arms.buy(f.site.id, ITEM).ok, true);
});
