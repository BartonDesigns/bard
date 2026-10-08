// Fictional, server-friendly equipment and acquisition rules for the world.
//
// This module intentionally contains game abstractions only. It does not model
// real-world firearms, ammunition, tactics, or instructions. Rifles are named
// fantasy game items with broad activity tags so the dialogue/quest layers can
// ask for a hunting or home-defence action without turning the game into a
// real-world weapons simulator.

export const INVENTORY_VERSION = 1;
export const MAX_JOURNAL_ENTRIES = 512;

export const ACTIVITIES = Object.freeze({
	HUNTING: 'hunting',
	HOME_DEFENSE: 'home-defense',
});

export const ACQUISITION_SOURCES = Object.freeze({
	PLAYER_MARKET: 'player-market',
	NPC_TRADER: 'npc-trader',
	SUPERMARKET: 'supermarket',
	POLICE_STATION: 'police-station',
});

export const TRANSACTION_KINDS = Object.freeze({
	PURCHASE: 'purchase',
	STEAL: 'steal',
	USE: 'use',
	EQUIP: 'equip',
	UNEQUIP: 'unequip',
	DISCARD: 'discard',
	COOL_HEAT: 'cool-heat',
	SELL: 'sell',
	TRADE: 'trade',
});

// what a shop pays back for an item it sells, as a share of its own price
export const SELL_BACK = 0.5;
// the most of one item, and of credits, a player-to-player trade can carry
export const TRADE_MAX_ITEMS = 12;
export const TRADE_MAX_QUANTITY = 999;
export const TRADE_MAX_CREDITS = 1000000;

const SOURCE_PRICE_FACTOR = Object.freeze({
	[ACQUISITION_SOURCES.PLAYER_MARKET]: 1,
	[ACQUISITION_SOURCES.NPC_TRADER]: 1.08,
	[ACQUISITION_SOURCES.SUPERMARKET]: 1.02,
});

const THEFT_PROFILES = Object.freeze({
	[ACQUISITION_SOURCES.POLICE_STATION]: Object.freeze({
		security: 0.82,
		witness: 0.64,
		baseHeat: 28,
		cooldown: 0.04,
	}),
});

function freeze(value) {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	Object.freeze(value);
	for (const child of Object.values(value)) freeze(child);
	return value;
}

const ITEMS = [
	{
		id: 'aurora-trail-rifle',
		name: 'Aurora Trail Rifle',
		kind: 'rifle',
		fictional: true,
		activities: [ACTIVITIES.HUNTING, ACTIVITIES.HOME_DEFENSE],
		use: 'A steady long-range game action for tracking and protecting a home zone.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 240,
		weight: 4,
		slot: 'primary',
		stackable: false,
		consumable: false,
		heatRisk: 8,
	},
	{
		id: 'mossback-scout-rifle',
		name: 'Mossback Scout Rifle',
		kind: 'rifle',
		fictional: true,
		activities: [ACTIVITIES.HUNTING],
		use: 'A quiet trail tool used by hunters to complete a tracking encounter.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 185,
		weight: 3,
		slot: 'primary',
		stackable: false,
		consumable: false,
		heatRisk: 6,
	},
	{
		id: 'warden-spark-carbine',
		name: 'Warden Spark Carbine',
		kind: 'rifle',
		fictional: true,
		activities: [ACTIVITIES.HOME_DEFENSE],
		use: 'A non-lethal fictional guard item that resolves a home-threat encounter.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', 'police-station': 'theft' },
		marketTradable: true,
		basePrice: 310,
		weight: 4,
		slot: 'primary',
		stackable: false,
		consumable: false,
		heatRisk: 18,
	},
	{
		id: 'reedline-hunting-bow',
		name: 'Reedline Hunting Bow',
		kind: 'bow',
		fictional: true,
		activities: [ACTIVITIES.HUNTING, ACTIVITIES.HOME_DEFENSE],
		use: 'A quiet trail encounter tool with a music-reactive draw animation.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 120,
		weight: 2,
		slot: 'primary',
		stackable: false,
		consumable: false,
		heatRisk: 3,
	},
	{
		id: 'hunting-net',
		name: 'Hunting Net',
		kind: 'tool',
		fictional: true,
		activities: [ACTIVITIES.HUNTING],
		use: 'A capture encounter tool for small wildlife and rescue quests.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 36,
		weight: 1,
		slot: 'utility',
		stackable: true,
		consumable: false,
		heatRisk: 0,
	},
	{
		id: 'trail-scent-kit',
		name: 'Trail Scent Kit',
		kind: 'supply',
		fictional: true,
		activities: [ACTIVITIES.HUNTING],
		use: 'A single-use clue item that reveals a nearby tracking route.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 22,
		weight: 1,
		slot: 'utility',
		stackable: true,
		consumable: true,
		heatRisk: 0,
	},
	{
		id: 'door-brace',
		name: 'Door Brace',
		kind: 'home-tool',
		fictional: true,
		activities: [ACTIVITIES.HOME_DEFENSE],
		use: 'A placeable home improvement that makes a shelter encounter safer.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 48,
		weight: 3,
		slot: 'household',
		stackable: true,
		consumable: false,
		heatRisk: 0,
	},
	{
		id: 'lantern-alarm',
		name: 'Lantern Alarm',
		kind: 'home-tool',
		fictional: true,
		activities: [ACTIVITIES.HOME_DEFENSE],
		use: 'A placeable warning device that alerts nearby friendly NPCs.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 64,
		weight: 2,
		slot: 'household',
		stackable: true,
		consumable: false,
		heatRisk: 0,
	},
	{
		id: 'field-medkit',
		name: 'Field Medkit',
		kind: 'home-supply',
		fictional: true,
		activities: [ACTIVITIES.HUNTING, ACTIVITIES.HOME_DEFENSE],
		use: 'A single-use recovery item for an injury state in a quest or encounter.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase', 'police-station': 'theft' },
		marketTradable: true,
		basePrice: 58,
		weight: 1,
		slot: 'utility',
		stackable: true,
		consumable: true,
		heatRisk: 2,
	},
	{
		id: 'camp-lantern',
		name: 'Camp Lantern',
		kind: 'home-supply',
		fictional: true,
		activities: [ACTIVITIES.HUNTING, ACTIVITIES.HOME_DEFENSE],
		use: 'A light source that makes a shelter or trail encounter visible.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 30,
		weight: 1,
		slot: 'utility',
		stackable: true,
		consumable: false,
		heatRisk: 0,
	},
	{
		id: 'repair-roll',
		name: 'Repair Roll',
		kind: 'home-supply',
		fictional: true,
		activities: [ACTIVITIES.HOME_DEFENSE],
		use: 'A single-use building supply that restores a damaged shelter object.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 14,
		weight: 1,
		slot: 'utility',
		stackable: true,
		consumable: true,
		heatRisk: 0,
	},
	{
		id: 'station-signal-flare',
		name: 'Station Signal Flare',
		kind: 'tool',
		fictional: true,
		activities: [ACTIVITIES.HUNTING, ACTIVITIES.HOME_DEFENSE],
		use: 'A visible emergency signal that can call a friendly response event.',
		sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', 'police-station': 'theft', supermarket: 'purchase' },
		marketTradable: true,
		basePrice: 44,
		weight: 1,
		slot: 'utility',
		stackable: true,
		consumable: true,
		heatRisk: 4,
	},
];

export const ARMS_CATALOG = freeze(Object.fromEntries(ITEMS.map((item) => [item.id, item])));

export const SOURCE_CATALOG = freeze({
	[ACQUISITION_SOURCES.PLAYER_MARKET]: {
		id: ACQUISITION_SOURCES.PLAYER_MARKET,
		label: 'Player exchange',
		modes: ['purchase', 'trade'],
		items: ITEMS.filter((item) => item.marketTradable).map((item) => item.id),
	},
	[ACQUISITION_SOURCES.NPC_TRADER]: {
		id: ACQUISITION_SOURCES.NPC_TRADER,
		label: 'NPC outfitter',
		modes: ['purchase', 'trade'],
		items: ITEMS.filter((item) => item.sources[ACQUISITION_SOURCES.NPC_TRADER] === 'purchase').map((item) => item.id),
	},
	[ACQUISITION_SOURCES.SUPERMARKET]: {
		id: ACQUISITION_SOURCES.SUPERMARKET,
		label: 'Supermarket and home supplies',
		modes: ['purchase'],
		items: ITEMS.filter((item) => item.sources[ACQUISITION_SOURCES.SUPERMARKET] === 'purchase').map((item) => item.id),
	},
	[ACQUISITION_SOURCES.POLICE_STATION]: {
		id: ACQUISITION_SOURCES.POLICE_STATION,
		label: 'Police station recovery cache',
		modes: ['theft'],
		items: ITEMS.filter((item) => item.sources[ACQUISITION_SOURCES.POLICE_STATION] === 'theft').map((item) => item.id),
	},
});

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
}

function integer(value, fallback = 0) {
	const n = Number(value);
	return Number.isInteger(n) ? n : fallback;
}

function positiveInteger(value, fallback = 1) {
	const n = integer(value, fallback);
	return n > 0 ? n : fallback;
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function itemFor(itemId) {
	return ARMS_CATALOG[String(itemId)] || null;
}

function sourceFor(sourceId) {
	return SOURCE_CATALOG[String(sourceId)] || null;
}

function sourceMode(item, sourceId) {
	return item?.sources?.[sourceId] || null;
}

function ensureSourceItem(sourceId, itemId, mode) {
	const item = itemFor(itemId);
	const source = sourceFor(sourceId);
	if (!item || !source || !source.items.includes(item.id) || !source.modes.includes(mode) || sourceMode(item, sourceId) !== mode) return null;
	return item;
}

export function getItem(itemId) {
	const item = itemFor(itemId);
	return item ? clone(item) : null;
}

export function getSource(sourceId) {
	const source = sourceFor(sourceId);
	return source ? clone(source) : null;
}

export function itemSupportsActivity(itemId, activity) {
	return Boolean(itemFor(itemId)?.activities.includes(activity));
}

export function quotePrice(itemId, sourceId = ACQUISITION_SOURCES.NPC_TRADER) {
	const item = itemFor(itemId);
	if (!item || !SOURCE_PRICE_FACTOR[sourceId]) return null;
	return Math.max(1, Math.round(item.basePrice * SOURCE_PRICE_FACTOR[sourceId]));
}

// what a shop pays for one of an item it sells (null: it does not buy it)
export function sellPrice(itemId, sourceId = ACQUISITION_SOURCES.NPC_TRADER) {
	if (!ensureSourceItem(sourceId, itemId, 'purchase')) return null;
	const price = quotePrice(itemId, sourceId);
	return price == null ? null : Math.max(1, Math.floor(price * SELL_BACK));
}

// one side of a player-to-player trade, cleaned: credits and catalogue items with counts
// (null when anything in it is not a real, tradable item or a sane amount)
export function cleanTradeSide(side) {
	const s = side && typeof side === 'object' ? side : {};
	const credits = integer(s.credits ?? 0, -1);
	if (credits < 0 || credits > TRADE_MAX_CREDITS) return null;
	const items = {};
	const entries = Object.entries(s.items && typeof s.items === 'object' ? s.items : {});
	if (entries.length > TRADE_MAX_ITEMS) return null;
	for (const [itemId, value] of entries) {
		const item = itemFor(itemId), quantity = integer(value, -1);
		if (!item || !item.marketTradable || quantity < 0 || quantity > TRADE_MAX_QUANTITY) return null;
		if (quantity) items[item.id] = quantity;
	}
	return { credits, items };
}

export function listOffers(sourceId, options = {}) {
	const source = sourceFor(sourceId);
	if (!source) return [];
	if (sourceId === ACQUISITION_SOURCES.PLAYER_MARKET && Array.isArray(options.offers)) {
		return options.offers.map((offer) => createPlayerOffer({ ...offer, price: offer?.price ?? offer?.unitPrice })).filter(Boolean);
	}
	return source.items.map((itemId) => {
		const item = itemFor(itemId);
		const mode = sourceMode(item, sourceId);
		return freeze({
			offerId: `${sourceId}:${item.id}`,
			sourceId,
			mode,
			itemId: item.id,
			name: item.name,
			quantity: null,
			unitPrice: mode === 'purchase' ? quotePrice(item.id, sourceId) : null,
			currency: mode === 'purchase' ? 'community-credits' : null,
			fictional: true,
			heatRisk: item.heatRisk,
		});
	});
}

export function createPlayerOffer({ offerId, itemId, sellerId, price, quantity = 1, note = '' } = {}) {
	const item = itemFor(itemId);
	if (!item || !item.marketTradable || !String(sellerId || '').trim()) return null;
	const unitPrice = integer(price, -1);
	const stock = integer(quantity, -1);
	if (unitPrice < 0 || stock < 1) return null;
	return freeze({
		offerId: String(offerId || `player:${sellerId}:${item.id}`),
		sourceId: ACQUISITION_SOURCES.PLAYER_MARKET,
		mode: 'purchase',
		itemId: item.id,
		name: item.name,
		sellerId: String(sellerId),
		quantity: stock,
		unitPrice,
		currency: 'community-credits',
		note: String(note || '').slice(0, 160),
		fictional: true,
	});
}

export function createInventoryState(ownerId, options = {}) {
	const initialItems = options.initialItems && typeof options.initialItems === 'object' ? options.initialItems : {};
	const items = {};
	for (const [itemId, value] of Object.entries(initialItems)) {
		if (itemFor(itemId)) {
			const quantity = Math.max(0, integer(value));
			if (quantity) items[itemId] = quantity;
		}
	}
	return {
		version: INVENTORY_VERSION,
		ownerId: String(ownerId || 'player'),
		revision: 0,
		credits: Math.max(0, integer(options.credits)),
		heat: clamp(options.heat, 0, 100),
		items,
		equipped: {},
		journal: [],
		updatedAt: integer(options.updatedAt),
	};
}

function normalizeInventory(raw, ownerId = 'player') {
	const source = raw && typeof raw === 'object' ? raw : {};
	const normalized = createInventoryState(source.ownerId || ownerId, {
		credits: source.credits,
		heat: source.heat,
		updatedAt: source.updatedAt,
		initialItems: source.items,
	});
	normalized.version = INVENTORY_VERSION;
	normalized.revision = Math.max(0, integer(source.revision));
	normalized.equipped = {};
	if (source.equipped && typeof source.equipped === 'object') {
		for (const [slot, itemId] of Object.entries(source.equipped)) {
			if (itemFor(itemId) && normalized.items[itemId] > 0) normalized.equipped[String(slot)] = itemId;
		}
	}
	normalized.journal = Array.isArray(source.journal)
		? source.journal.filter((entry) => entry && typeof entry.id === 'string').slice(-MAX_JOURNAL_ENTRIES).map((entry) => clone(entry))
		: [];
	return normalized;
}

export function serializeInventory(state) {
	return JSON.stringify(normalizeInventory(state, state?.ownerId || 'player'));
}

export function deserializeInventory(payload, ownerId = 'player') {
	if (!payload) return createInventoryState(ownerId);
	try {
		return normalizeInventory(JSON.parse(String(payload)), ownerId);
	} catch {
		return createInventoryState(ownerId);
	}
}

export function canAttemptTheft({ sourceId = ACQUISITION_SOURCES.POLICE_STATION, itemId, heat = 0 } = {}) {
	const profile = THEFT_PROFILES[sourceId];
	const item = ensureSourceItem(sourceId, itemId, 'theft');
	if (!profile || !item) return { allowed: false, reason: 'not-available' };
	if (clamp(heat, 0, 100) >= 90) return { allowed: false, reason: 'too-hot', heat: clamp(heat, 0, 100) };
	return { allowed: true, sourceId, itemId: item.id, heat: clamp(heat, 0, 100), security: profile.security };
}

export function resolveTheftAttempt({
	attemptId,
	sourceId = ACQUISITION_SOURCES.POLICE_STATION,
	itemId,
	heat = 0,
	stealth = 0,
	preparation = 0,
	localTrust = 0,
	successRoll = 1,
	detectionRoll = 1,
} = {}) {
	const check = canAttemptTheft({ sourceId, itemId, heat });
	if (!check.allowed) return { ok: false, ...check };
	const profile = THEFT_PROFILES[sourceId];
	const item = itemFor(itemId);
	const skill = clamp(stealth, 0, 1);
	const prep = clamp(preparation, 0, 1);
	const trust = clamp(localTrust, -1, 1);
	const successChance = clamp(0.2 + skill * 0.38 + prep * 0.18 + trust * 0.08 - profile.security * 0.2 - clamp(heat, 0, 100) / 100 * 0.18, 0.05, 0.9);
	const detectionChance = clamp(profile.witness * 0.62 + profile.security * 0.2 - skill * 0.35 - prep * 0.16 + clamp(heat, 0, 100) / 100 * 0.2, 0.05, 0.95);
	const success = Number(successRoll) < successChance;
	const detected = Number(detectionRoll) < detectionChance;
	const outcome = success ? detected ? 'hot' : 'secured' : detected ? 'caught' : 'failed';
	const heatDelta = detected ? Math.round(profile.baseHeat + item.heatRisk + (success ? 6 : 14)) : success ? Math.max(2, Math.round(item.heatRisk * 0.25)) : 0;
	const proof = success ? {
		attemptId: String(attemptId || `${sourceId}:${item.id}:${Math.round(Number(successRoll) * 10000)}`),
		sourceId,
		itemId: item.id,
		outcome,
		heatDelta,
	} : null;
	return {
		ok: true,
		sourceId,
		itemId: item.id,
		outcome,
		success,
		detected,
		successChance,
		detectionChance,
		heatDelta,
		proof,
	};
}

function receipt(id, kind, accepted, revision, details = {}) {
	return { id, kind, accepted, revision, ...details };
}

function reject(state, tx, code, message) {
	return { ok: false, state, receipt: receipt(String(tx?.id || ''), String(tx?.kind || ''), false, state.revision, { code, message }) };
}

function appendJournal(state, entry) {
	const journal = [...state.journal, entry].slice(-MAX_JOURNAL_ENTRIES);
	return { ...state, journal };
}

function alreadyApplied(state, transactionId) {
	return state.journal.find((entry) => entry.id === transactionId && entry.accepted !== false) || null;
}

function theftProofApplied(state, attemptId) {
	if (!attemptId) return null;
	return state.journal.find((entry) => entry.accepted !== false && entry.theftAttemptId === String(attemptId)) || null;
}

function quantityFor(state, itemId) {
	return Math.max(0, integer(state.items?.[itemId]));
}

function withQuantity(state, itemId, delta) {
	const items = { ...state.items };
	const quantity = quantityFor(state, itemId) + delta;
	if (quantity > 0) items[itemId] = quantity;
	else delete items[itemId];
	return { ...state, items };
}

// an item given away or sold is no longer held
function dropEquipped(state) {
	const equipped = Object.fromEntries(Object.entries(state.equipped || {}).filter(([, itemId]) => quantityFor(state, itemId) > 0));
	return { ...state, equipped };
}

function applyAccepted(state, tx, details = {}) {
	const next = {
		...state,
		revision: state.revision + 1,
		updatedAt: integer(tx.at, state.updatedAt),
	};
	const entry = receipt(String(tx.id), String(tx.kind), true, next.revision, details);
	return { ok: true, state: appendJournal(next, entry), receipt: entry };
}

export function applyInventoryTransaction(inputState, transaction, options = {}) {
	const state = normalizeInventory(inputState, inputState?.ownerId || 'player');
	const tx = transaction && typeof transaction === 'object' ? transaction : {};
	const id = String(tx.id || '');
	if (!id) return reject(state, tx, 'missing-id', 'A stable transaction id is required.');
	if (options.expectedRevision !== undefined && integer(options.expectedRevision) !== state.revision) {
		return reject(state, tx, 'revision-conflict', 'Inventory changed before this transaction was applied.');
	}
	const previous = alreadyApplied(state, id);
	if (previous) return { ok: true, duplicate: true, state, receipt: { ...previous, duplicate: true } };

	const kind = String(tx.kind || '');
	const item = tx.itemId ? itemFor(tx.itemId) : null;
	const quantity = positiveInteger(tx.quantity);

	if (kind === TRANSACTION_KINDS.PURCHASE) {
		if (!item) return reject(state, tx, 'unknown-item', 'That item is not in the game catalog.');
		const sourceId = String(tx.sourceId || '');
		const staticItem = ensureSourceItem(sourceId, item.id, 'purchase');
		const offer = tx.offer ? createPlayerOffer({ ...tx.offer, price: tx.offer.price ?? tx.offer.unitPrice }) : null;
		if (sourceId === ACQUISITION_SOURCES.PLAYER_MARKET && !offer) return reject(state, tx, 'offer-required', 'A player-market purchase needs a current seller offer.');
		if (offer && (offer.itemId !== item.id || offer.sourceId !== sourceId)) return reject(state, tx, 'offer-mismatch', 'The offer does not match the requested item or source.');
		if (!staticItem && !offer) return reject(state, tx, 'not-for-sale', 'That item is not available for purchase at this source.');
		const listedPrice = offer?.unitPrice ?? quotePrice(item.id, sourceId);
		const requestedPrice = tx.unitPrice === undefined ? listedPrice : integer(tx.unitPrice, -1);
		const unitPrice = offer ? requestedPrice : listedPrice;
		if (unitPrice < 0) return reject(state, tx, 'invalid-price', 'A purchase needs a non-negative game price.');
		if (!offer && requestedPrice !== listedPrice) return reject(state, tx, 'price-mismatch', 'The listed game price changed before this purchase was applied.');
		if (offer && quantity > offer.quantity) return reject(state, tx, 'out-of-stock', 'That player offer does not have enough stock.');
		const total = unitPrice * quantity;
		if (state.credits < total) return reject(state, tx, 'insufficient-credits', 'The player does not have enough community credits.');
		const next = withQuantity({ ...state, credits: state.credits - total }, item.id, quantity);
		return applyAccepted(next, tx, { sourceId, itemId: item.id, quantity, total, currency: 'community-credits' });
	}

	if (kind === TRANSACTION_KINDS.STEAL) {
		if (!item) return reject(state, tx, 'unknown-item', 'That item is not in the game catalog.');
		const proof = tx.theftProof;
		if (!proof || proof.itemId !== item.id || proof.sourceId !== tx.sourceId || !['secured', 'hot'].includes(proof.outcome) || !proof.attemptId) {
			return reject(state, tx, 'invalid-theft-proof', 'A successful, server-issued theft result is required.');
		}
		if (quantity !== 1) return reject(state, tx, 'theft-quantity', 'A recovery-cache attempt can secure one item per authored event.');
		if (theftProofApplied(state, proof.attemptId)) return reject(state, tx, 'duplicate-theft-proof', 'That recovery-cache result has already been applied.');
		if (!ensureSourceItem(tx.sourceId, item.id, 'theft')) return reject(state, tx, 'not-stealable', 'That item is not available from this recovery cache.');
		const next = withQuantity({ ...state, heat: clamp(state.heat + clamp(proof.heatDelta, 0, 100), 0, 100) }, item.id, quantity);
		return applyAccepted(next, tx, { sourceId: tx.sourceId, itemId: item.id, quantity, outcome: proof.outcome, heatDelta: clamp(proof.heatDelta, 0, 100), theftAttemptId: String(proof.attemptId) });
	}

	if (kind === TRANSACTION_KINDS.USE) {
		if (!item || quantityFor(state, item.id) < quantity) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		if (!itemSupportsActivity(item.id, tx.activity)) return reject(state, tx, 'wrong-activity', 'That item does not support this activity.');
		const next = item.consumable ? withQuantity(state, item.id, -quantity) : state;
		return applyAccepted(next, tx, { itemId: item.id, activity: tx.activity, quantity, consumed: item.consumable });
	}

	if (kind === TRANSACTION_KINDS.EQUIP) {
		if (!item || quantityFor(state, item.id) < 1) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const slot = String(tx.slot || item.slot || 'utility');
		return applyAccepted({ ...state, equipped: { ...state.equipped, [slot]: item.id } }, tx, { itemId: item.id, slot });
	}

	if (kind === TRANSACTION_KINDS.UNEQUIP) {
		const slot = String(tx.slot || '');
		if (!slot || !state.equipped[slot]) return reject(state, tx, 'not-equipped', 'That equipment slot is already empty.');
		const equipped = { ...state.equipped };
		const itemId = equipped[slot];
		delete equipped[slot];
		return applyAccepted({ ...state, equipped }, tx, { itemId, slot });
	}

	if (kind === TRANSACTION_KINDS.DISCARD) {
		if (!item || quantityFor(state, item.id) < quantity) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const equipped = Object.fromEntries(Object.entries(state.equipped).filter(([, itemId]) => itemId !== item.id || quantityFor(state, item.id) > quantity));
		return applyAccepted({ ...withQuantity(state, item.id, -quantity), equipped }, tx, { itemId: item.id, quantity });
	}

	if (kind === TRANSACTION_KINDS.SELL) {
		if (!item || quantityFor(state, item.id) < quantity) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const sourceId = String(tx.sourceId || '');
		const unitPrice = sellPrice(item.id, sourceId);
		if (unitPrice == null) return reject(state, tx, 'not-bought', 'This place does not buy that item.');
		if (tx.unitPrice !== undefined && integer(tx.unitPrice, -1) !== unitPrice) return reject(state, tx, 'price-mismatch', 'The buy-back price changed before this sale was applied.');
		const total = unitPrice * quantity;
		const next = dropEquipped(withQuantity({ ...state, credits: state.credits + total }, item.id, -quantity));
		return applyAccepted(next, tx, { sourceId, itemId: item.id, quantity, total, currency: 'community-credits' });
	}

	// one player's own side of a trade with another: what they give goes, what they get
	// comes, all at once or not at all (the other player applies their own side)
	if (kind === TRANSACTION_KINDS.TRADE) {
		const give = cleanTradeSide(tx.give), get = cleanTradeSide(tx.get);
		if (!give || !get) return reject(state, tx, 'bad-trade', 'That trade has an item or amount the game does not know.');
		if (state.credits < give.credits) return reject(state, tx, 'insufficient-credits', 'The player does not have enough community credits.');
		for (const [itemId, n] of Object.entries(give.items)) if (quantityFor(state, itemId) < n) return reject(state, tx, 'not-owned', 'The player no longer has everything offered.');
		let next = { ...state, credits: Math.min(Number.MAX_SAFE_INTEGER, state.credits - give.credits + get.credits) };
		for (const [itemId, n] of Object.entries(give.items)) next = withQuantity(next, itemId, -n);
		for (const [itemId, n] of Object.entries(get.items)) next = withQuantity(next, itemId, n);
		return applyAccepted(dropEquipped(next), tx, { peer: String(tx.peer || '').slice(0, 40), give, get });
	}

	if (kind === TRANSACTION_KINDS.COOL_HEAT) {
		const amount = clamp(tx.amount, 0, 100);
		return applyAccepted({ ...state, heat: clamp(state.heat - amount, 0, 100) }, tx, { amount });
	}

	return reject(state, tx, 'unknown-kind', 'That inventory action is not supported.');
}

export function createInventoryRepository({ storage, key = 'bard:inventory', ownerId = 'player' } = {}) {
	const memory = new Map();
	const store = storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function'
		? storage
		: { getItem: (name) => memory.get(name) || null, setItem: (name, value) => memory.set(name, String(value)) };
	return {
		load() {
			return deserializeInventory(store.getItem(key), ownerId);
		},
		save(state) {
			const normalized = normalizeInventory(state, ownerId);
			store.setItem(key, serializeInventory(normalized));
			return normalized;
		},
		apply(transaction, options = {}) {
			const current = this.load();
			const result = applyInventoryTransaction(current, transaction, options);
			if (result.ok && !result.duplicate) this.save(result.state);
			return result;
		},
	};
}

export function inventorySummary(state) {
	const normalized = normalizeInventory(state, state?.ownerId || 'player');
	return {
		ownerId: normalized.ownerId,
		revision: normalized.revision,
		credits: normalized.credits,
		heat: normalized.heat,
		items: Object.entries(normalized.items).map(([itemId, quantity]) => ({ itemId, name: itemFor(itemId).name, quantity })),
		equipped: { ...normalized.equipped },
	};
}
