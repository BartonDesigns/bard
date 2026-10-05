import assert from 'node:assert/strict';
import {
	ACTIVITIES,
	ACQUISITION_SOURCES,
	ARMS_CATALOG,
	SOURCE_CATALOG,
	TRANSACTION_KINDS,
	applyInventoryTransaction,
	canAttemptTheft,
	createInventoryRepository,
	createInventoryState,
	createPlayerOffer,
	deserializeInventory,
	getItem,
	inventorySummary,
	itemSupportsActivity,
	listOffers,
	resolveTheftAttempt,
	serializeInventory,
} from '../src/gameplay/arms.js';

assert.ok(Object.keys(ARMS_CATALOG).length >= 10);
assert.deepEqual(Object.keys(SOURCE_CATALOG).sort(), Object.values(ACQUISITION_SOURCES).sort());

// The catalog is an intentionally fictional gameplay layer: no real-world
// ballistic fields or operational instructions leak into the data model.
for (const item of Object.values(ARMS_CATALOG)) {
	assert.equal(item.fictional, true);
	assert.equal(typeof item.use, 'string');
	assert.equal('caliber' in item, false);
	assert.equal('range' in item, false);
}

const supermarket = listOffers(ACQUISITION_SOURCES.SUPERMARKET);
assert.ok(supermarket.some((offer) => offer.itemId === 'aurora-trail-rifle'));
assert.ok(supermarket.some((offer) => offer.itemId === 'door-brace'));
assert.ok(supermarket.every((offer) => offer.mode === 'purchase'));

const police = listOffers(ACQUISITION_SOURCES.POLICE_STATION);
assert.ok(police.some((offer) => offer.itemId === 'warden-spark-carbine'));
assert.ok(police.every((offer) => offer.mode === 'theft'));
assert.equal(police.some((offer) => offer.unitPrice !== null), false);
assert.ok(listOffers(ACQUISITION_SOURCES.NPC_TRADER).length > 0);

const playerOffer = createPlayerOffer({ offerId: 'offer-1', itemId: 'reedline-hunting-bow', sellerId: 'seller-1', price: 90, quantity: 2 });
assert.equal(playerOffer.sellerId, 'seller-1');
assert.equal(listOffers(ACQUISITION_SOURCES.PLAYER_MARKET, { offers: [playerOffer] })[0].offerId, 'offer-1');
assert.equal(createPlayerOffer({ itemId: 'no-such-item', sellerId: 'seller-1', price: 1 }), null);

assert.equal(itemSupportsActivity('mossback-scout-rifle', ACTIVITIES.HUNTING), true);
assert.equal(itemSupportsActivity('mossback-scout-rifle', ACTIVITIES.HOME_DEFENSE), false);
assert.equal(getItem('not-an-item'), null);

let state = createInventoryState('player-1', { credits: 1000 });
const purchase = applyInventoryTransaction(state, {
	id: 'purchase-1',
	kind: TRANSACTION_KINDS.PURCHASE,
	sourceId: ACQUISITION_SOURCES.SUPERMARKET,
	itemId: 'door-brace',
	quantity: 2,
});
assert.equal(purchase.ok, true);
assert.equal(purchase.state.items['door-brace'], 2);
assert.equal(purchase.state.credits, 902);
assert.equal(purchase.state.revision, 1);
state = purchase.state;

// The same id cannot spend credits or duplicate an item twice.
const duplicate = applyInventoryTransaction(state, {
	id: 'purchase-1',
	kind: TRANSACTION_KINDS.PURCHASE,
	sourceId: ACQUISITION_SOURCES.SUPERMARKET,
	itemId: 'door-brace',
	quantity: 2,
});
assert.equal(duplicate.ok, true);
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.state.revision, 1);
assert.equal(duplicate.state.items['door-brace'], 2);
assert.equal(duplicate.state.credits, 902);

const bowOffer = createPlayerOffer({ offerId: 'bow-offer', itemId: 'reedline-hunting-bow', sellerId: 'seller-2', price: 70, quantity: 1 });
const playerPurchase = applyInventoryTransaction(state, {
	id: 'purchase-2',
	kind: TRANSACTION_KINDS.PURCHASE,
	sourceId: ACQUISITION_SOURCES.PLAYER_MARKET,
	itemId: 'reedline-hunting-bow',
	quantity: 1,
	offer: bowOffer,
});
assert.equal(playerPurchase.ok, true);
assert.equal(playerPurchase.state.items['reedline-hunting-bow'], 1);
assert.equal(playerPurchase.state.credits, 832);
const missingOffer = applyInventoryTransaction(state, {
	id: 'purchase-missing-offer', kind: TRANSACTION_KINDS.PURCHASE,
	sourceId: ACQUISITION_SOURCES.PLAYER_MARKET, itemId: 'reedline-hunting-bow', quantity: 1,
});
assert.equal(missingOffer.ok, false);
assert.equal(missingOffer.receipt.code, 'offer-required');
const underpricedRetail = applyInventoryTransaction(state, {
	id: 'purchase-underpriced', kind: TRANSACTION_KINDS.PURCHASE,
	sourceId: ACQUISITION_SOURCES.SUPERMARKET, itemId: 'door-brace', quantity: 1, unitPrice: 0,
});
assert.equal(underpricedRetail.ok, false);
assert.equal(underpricedRetail.receipt.code, 'price-mismatch');

const blockedTheft = canAttemptTheft({ itemId: 'warden-spark-carbine', heat: 90 });
assert.deepEqual(blockedTheft, { allowed: false, reason: 'too-hot', heat: 90 });
const failedTheft = resolveTheftAttempt({ attemptId: 'theft-fail', itemId: 'warden-spark-carbine', stealth: 0, successRoll: 1, detectionRoll: 0 });
assert.equal(failedTheft.ok, true);
assert.equal(failedTheft.outcome, 'caught');
assert.equal(failedTheft.proof, null);

const theft = resolveTheftAttempt({
	attemptId: 'theft-success',
	itemId: 'warden-spark-carbine',
	stealth: 1,
	preparation: 1,
	successRoll: 0,
	detectionRoll: 1,
});
assert.equal(theft.outcome, 'secured');
assert.ok(theft.proof);
const stolen = applyInventoryTransaction(state, {
	id: 'steal-1',
	kind: TRANSACTION_KINDS.STEAL,
	sourceId: ACQUISITION_SOURCES.POLICE_STATION,
	itemId: 'warden-spark-carbine',
	theftProof: theft.proof,
});
assert.equal(stolen.ok, true);
assert.equal(stolen.state.items['warden-spark-carbine'], 1);
assert.ok(stolen.state.heat > 0);
const duplicateProof = applyInventoryTransaction(stolen.state, {
	id: 'steal-duplicate-proof', kind: TRANSACTION_KINDS.STEAL,
	sourceId: ACQUISITION_SOURCES.POLICE_STATION, itemId: 'warden-spark-carbine', theftProof: theft.proof,
});
assert.equal(duplicateProof.ok, false);
assert.equal(duplicateProof.receipt.code, 'duplicate-theft-proof');
const bulkTheft = applyInventoryTransaction(stolen.state, {
	id: 'steal-bulk', kind: TRANSACTION_KINDS.STEAL,
	sourceId: ACQUISITION_SOURCES.POLICE_STATION, itemId: 'warden-spark-carbine', quantity: 2, theftProof: { ...theft.proof, attemptId: 'bulk-attempt' },
});
assert.equal(bulkTheft.ok, false);
assert.equal(bulkTheft.receipt.code, 'theft-quantity');

const hot = resolveTheftAttempt({ attemptId: 'theft-hot', itemId: 'warden-spark-carbine', stealth: 1, preparation: 1, successRoll: 0, detectionRoll: 0 });
assert.equal(hot.outcome, 'hot');
const hotState = applyInventoryTransaction(stolen.state, {
	id: 'steal-hot',
	kind: TRANSACTION_KINDS.STEAL,
	sourceId: ACQUISITION_SOURCES.POLICE_STATION,
	itemId: 'warden-spark-carbine',
	theftProof: hot.proof,
});
assert.equal(hotState.ok, true);
assert.ok(hotState.state.heat > stolen.state.heat);

const useWrongRole = applyInventoryTransaction(playerPurchase.state, {
	id: 'use-wrong-role',
	kind: TRANSACTION_KINDS.USE,
	itemId: 'mossback-scout-rifle',
	activity: ACTIVITIES.HOME_DEFENSE,
});
assert.equal(useWrongRole.ok, false);
assert.equal(useWrongRole.receipt.code, 'not-owned');
const withKit = createInventoryState('player-2', { initialItems: { 'trail-scent-kit': 2, 'door-brace': 1 } });
const usedKit = applyInventoryTransaction(withKit, { id: 'use-kit', kind: TRANSACTION_KINDS.USE, itemId: 'trail-scent-kit', activity: ACTIVITIES.HUNTING });
assert.equal(usedKit.ok, true);
assert.equal(usedKit.state.items['trail-scent-kit'], 1);
const usedBrace = applyInventoryTransaction(usedKit.state, { id: 'use-brace', kind: TRANSACTION_KINDS.USE, itemId: 'door-brace', activity: ACTIVITIES.HOME_DEFENSE });
assert.equal(usedBrace.ok, true);
assert.equal(usedBrace.state.items['door-brace'], 1);

const equipped = applyInventoryTransaction(playerPurchase.state, { id: 'equip-bow', kind: TRANSACTION_KINDS.EQUIP, itemId: 'reedline-hunting-bow' });
assert.equal(equipped.ok, true);
assert.equal(equipped.state.equipped.primary, 'reedline-hunting-bow');
const unequipped = applyInventoryTransaction(equipped.state, { id: 'unequip-bow', kind: TRANSACTION_KINDS.UNEQUIP, slot: 'primary' });
assert.equal(unequipped.ok, true);
assert.equal(unequipped.state.equipped.primary, undefined);

const revisionConflict = applyInventoryTransaction(state, { id: 'conflict', kind: TRANSACTION_KINDS.COOL_HEAT, amount: 4 }, { expectedRevision: 99 });
assert.equal(revisionConflict.ok, false);
assert.equal(revisionConflict.receipt.code, 'revision-conflict');

const payload = serializeInventory(stolen.state);
const restored = deserializeInventory(payload, 'player-1');
assert.deepEqual(inventorySummary(restored), inventorySummary(stolen.state));

const storage = new Map();
const repository = createInventoryRepository({ storage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, key: 'test:inventory', ownerId: 'persistent-player' });
repository.save(createInventoryState('persistent-player', { credits: 500 }));
const persistedPurchase = repository.apply({ id: 'persist-1', kind: TRANSACTION_KINDS.PURCHASE, sourceId: ACQUISITION_SOURCES.SUPERMARKET, itemId: 'camp-lantern' });
assert.equal(persistedPurchase.ok, true);
assert.equal(repository.load().items['camp-lantern'], 1);
const persistedDuplicate = repository.apply({ id: 'persist-1', kind: TRANSACTION_KINDS.PURCHASE, sourceId: ACQUISITION_SOURCES.SUPERMARKET, itemId: 'camp-lantern' });
assert.equal(persistedDuplicate.duplicate, true);
assert.equal(repository.load().items['camp-lantern'], 1);

console.log('Arms: fictional catalog, player/NPC/supermarket/police acquisition, guarded theft heat, activity use, equip, idempotent persistence passed.');
