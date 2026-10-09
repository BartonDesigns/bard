// Fictional, server-friendly equipment and acquisition rules for the world.
//
// This module intentionally contains game abstractions only. It does not model
// real-world firearms, ammunition, tactics, or instructions. Rifles are named
// fantasy game items with broad activity tags so the dialogue/quest layers can
// ask for a hunting or home-defence action without turning the game into a
// real-world weapons simulator.

import { MAX_LEVEL, UPGRADE_MATERIAL, canCombine, cleanInstance, combined, mintUid, trained, upgradeCost, valueFactor } from './gear-levels.js';

// 2: every item owned is an instance with an id, a level and a quality tier (gameplay/gear-levels.js)
export const INVENTORY_VERSION = 2;
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
	TRAIN: 'train',
	UPGRADE: 'upgrade',
	COMBINE: 'combine',
});

// what a shop pays back for an item it sells, as a share of its own price
export const SELL_BACK = 0.5;
// the most of one item, and of credits, a player-to-player trade can carry
export const TRADE_MAX_ITEMS = 12;
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
	// ammunition boxes for the field arms (combat/weapons.js): a box opens into its rounds at a reload
	...[
		['trail-rifle-box', 'Trail Rifle Cartridge Box', 'A box of game rounds for the Aurora Trail Rifle.', 28],
		['scout-rifle-box', 'Scout Rifle Cartridge Box', 'A box of game rounds for the Mossback Scout Rifle.', 24],
		['spark-cell-pack', 'Spark Cell Pack', 'Charge cells for the Warden Spark Carbine.', 32],
		['reed-arrow-quiver', 'Reedline Arrow Quiver', 'A quiver of arrows for the Reedline Hunting Bow.', 16],
	].map(([id, name, use, basePrice]) => ({ id, name, kind: 'ammo', fictional: true, activities: [ACTIVITIES.HUNTING, ACTIVITIES.HOME_DEFENSE], use, sources: { 'player-market': 'purchase', 'npc-trader': 'purchase', supermarket: 'purchase' }, marketTradable: true, basePrice, weight: 1, slot: 'utility', stackable: true, consumable: true, heatRisk: 0 })),
	// the Moon colony's errand things (planet/colony/errands.js): carried, handed over, never sold
	...[
		['relay-transceiver-board', 'Relay Transceiver Board', 'A spare transceiver board for the Far Side Relay, signed out of the colony depot.'],
		['kestrel-flight-recorder', 'Kestrel Flight Recorder', 'The orange flight recorder from the Wreck of the Kestrel, still blinking.'],
		['regolith-core-sample', 'Sealed Regolith Core', 'A metre of fresh regolith from the Copernicus face, sealed on site for the med bay.'],
		['hydroponic-harvest-crate', 'Harvest Crate', 'Basil and lettuces from the dome farm, on their way to the mess.'],
	].map(([id, name, use]) => ({ id, name, kind: 'errand', fictional: true, activities: [], use, sources: {}, marketTradable: true, basePrice: 0, weight: 1, slot: 'hand', stackable: false, consumable: false, heatRisk: 0 })),
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
// (an instance's level and tier raise it: see gear-levels.js valueFactor)
export function sellPrice(itemId, sourceId = ACQUISITION_SOURCES.NPC_TRADER, inst = null) {
	if (!ensureSourceItem(sourceId, itemId, 'purchase')) return null;
	const price = quotePrice(itemId, sourceId);
	return price == null ? null : Math.max(1, Math.floor(price * SELL_BACK * (inst ? valueFactor(inst) : 1)));
}
// what an outfitter charges to raise an instance one level (plus one upgrade material)
export function upgradePrice(inst) {
	const item = itemFor(inst?.i);
	return item ? upgradeCost(inst, item.basePrice) : null;
}
const known = (id) => !!itemFor(id)?.marketTradable;

// one side of a player-to-player trade, cleaned: credits and up to 12 item instances, each
// with its id, level and tier, in id order (null when anything in it is not a real, tradable
// item, a sane amount, or an id given twice)
export function cleanTradeSide(side) {
	const s = side && typeof side === 'object' ? side : {};
	const credits = integer(s.credits ?? 0, -1);
	if (credits < 0 || credits > TRADE_MAX_CREDITS) return null;
	const raw = Array.isArray(s.items) ? s.items : [];
	if (raw.length > TRADE_MAX_ITEMS) return null;
	const items = [];
	for (const x of raw) {
		const inst = cleanInstance(x, known);
		if (!inst || inst.l !== x.l || inst.t !== x.t || items.some((y) => y.u === inst.u)) return null;
		items.push(inst);
	}
	items.sort((a, b) => (a.u < b.u ? -1 : 1));
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
	const instances = {};
	for (const [itemId, n] of Object.entries(items)) for (let k = 0; k < n; k++) { const u = mintUid(`${ownerId}:${options.updatedAt || 0}:${itemId}`, k); instances[u] = { u, i: itemId, l: 1, t: 0, x: 0 }; }
	return {
		version: INVENTORY_VERSION,
		ownerId: String(ownerId || 'player'),
		revision: 0,
		credits: Math.max(0, integer(options.credits)),
		heat: clamp(options.heat, 0, 100),
		items,
		instances,
		hand: null,
		equipped: {},
		journal: [],
		updatedAt: integer(options.updatedAt),
	};
}

// the counts by item, from the instances
function recount(state) {
	const items = {};
	for (const x of Object.values(state.instances)) items[x.i] = (items[x.i] || 0) + 1;
	const hand = state.hand && state.instances[state.hand] ? state.hand : null;
	const equipped = Object.fromEntries(Object.entries(state.equipped || {}).filter(([, itemId]) => items[itemId] > 0));
	return { ...state, items, hand, equipped };
}
// one owned instance (null if not owned)
export const instanceOf = (state, uid) => state?.instances?.[uid] || null;
// the instances of one item, best first
export const instancesOf = (state, itemId) => Object.values(state?.instances || {}).filter((x) => x.i === itemId).sort((a, b) => b.t - a.t || b.l - a.l || (a.u < b.u ? -1 : 1));

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
	// version 2 keeps instances; a version 1 save is migrated: its counts became Common, level 1
	if (source.instances && typeof source.instances === 'object') {
		normalized.instances = {};
		for (const x of Object.values(source.instances)) { const inst = cleanInstance(x, (id) => !!itemFor(id)); if (inst) normalized.instances[inst.u] = inst; }
	}
	normalized.equipped = {};
	if (source.equipped && typeof source.equipped === 'object') {
		for (const [slot, itemId] of Object.entries(source.equipped)) {
			if (itemFor(itemId)) normalized.equipped[String(slot)] = itemId;
		}
	}
	normalized.hand = typeof source.hand === 'string' ? source.hand : null;
	// (version 1 held an item by its kind: the best one of that kind now)
	if (!normalized.hand && normalized.equipped.hand) normalized.hand = instancesOf(normalized, normalized.equipped.hand)[0]?.u || null;
	Object.assign(normalized, recount(normalized));
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

// more of an item (new instances, Common, level 1, their ids from the transaction's) or fewer
// (the least valuable go first, the one in hand last, or exactly `uid` when given)
function withQuantity(state, itemId, delta, seed = '', uid = null) {
	const instances = { ...state.instances };
	if (delta > 0) for (let k = 0; k < delta; k++) { let u = mintUid(`${seed}:${itemId}`, k); while (instances[u]) u = mintUid(u, k + 1); instances[u] = { u, i: itemId, l: 1, t: 0, x: 0 }; }
	else if (delta < 0) {
		const pick = uid && instances[uid]?.i === itemId ? [instances[uid]] : instancesOf(state, itemId).reverse().sort((a, b) => (a.u === state.hand) - (b.u === state.hand));
		for (const x of pick.slice(0, -delta)) delete instances[x.u];
	}
	return recount({ ...state, instances });
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
		const next = withQuantity({ ...state, credits: state.credits - total }, item.id, quantity, id);
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
		const next = withQuantity({ ...state, heat: clamp(state.heat + clamp(proof.heatDelta, 0, 100), 0, 100) }, item.id, quantity, id);
		return applyAccepted(next, tx, { sourceId: tx.sourceId, itemId: item.id, quantity, outcome: proof.outcome, heatDelta: clamp(proof.heatDelta, 0, 100), theftAttemptId: String(proof.attemptId) });
	}

	if (kind === TRANSACTION_KINDS.USE) {
		if (!item || quantityFor(state, item.id) < quantity) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		if (!itemSupportsActivity(item.id, tx.activity)) return reject(state, tx, 'wrong-activity', 'That item does not support this activity.');
		const next = item.consumable ? withQuantity(state, item.id, -quantity, id, tx.uid) : state;
		return applyAccepted(next, tx, { itemId: item.id, activity: tx.activity, quantity, consumed: item.consumable });
	}

	if (kind === TRANSACTION_KINDS.EQUIP) {
		// (a particular one by its uid, or the best of the kind)
		const inst = tx.uid ? instanceOf(state, tx.uid) : item ? instancesOf(state, item.id)[0] : null;
		if (!inst || (item && inst.i !== item.id)) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const slot = String(tx.slot || itemFor(inst.i).slot || 'utility');
		return applyAccepted({ ...state, equipped: { ...state.equipped, [slot]: inst.i }, hand: slot === 'hand' ? inst.u : state.hand }, tx, { itemId: inst.i, uid: inst.u, slot });
	}

	if (kind === TRANSACTION_KINDS.UNEQUIP) {
		const slot = String(tx.slot || '');
		if (!slot || !state.equipped[slot]) return reject(state, tx, 'not-equipped', 'That equipment slot is already empty.');
		const equipped = { ...state.equipped };
		const itemId = equipped[slot];
		delete equipped[slot];
		return applyAccepted({ ...state, equipped, hand: slot === 'hand' ? null : state.hand }, tx, { itemId, slot });
	}

	if (kind === TRANSACTION_KINDS.DISCARD) {
		if (!item || quantityFor(state, item.id) < quantity) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		return applyAccepted(withQuantity(state, item.id, -quantity, id, tx.uid), tx, { itemId: item.id, quantity });
	}

	if (kind === TRANSACTION_KINDS.SELL) {
		if (!item || quantityFor(state, item.id) < quantity) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const sourceId = String(tx.sourceId || '');
		const sold = tx.uid ? instanceOf(state, tx.uid) : null;
		if (tx.uid && (!sold || sold.i !== item.id || quantity !== 1)) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const unitPrice = sellPrice(item.id, sourceId, sold);
		if (unitPrice == null) return reject(state, tx, 'not-bought', 'This place does not buy that item.');
		if (tx.unitPrice !== undefined && integer(tx.unitPrice, -1) !== unitPrice) return reject(state, tx, 'price-mismatch', 'The buy-back price changed before this sale was applied.');
		const total = unitPrice * quantity;
		const next = withQuantity({ ...state, credits: state.credits + total }, item.id, -quantity, id, tx.uid);
		return applyAccepted(next, tx, { sourceId, itemId: item.id, quantity, total, currency: 'community-credits' });
	}

	// one player's own side of a trade with another: what they give goes, what they get
	// comes, all at once or not at all (the other player applies their own side)
	if (kind === TRANSACTION_KINDS.TRADE) {
		const give = cleanTradeSide(tx.give), get = cleanTradeSide(tx.get);
		if (!give || !get) return reject(state, tx, 'bad-trade', 'That trade has an item or amount the game does not know.');
		if (state.credits < give.credits) return reject(state, tx, 'insufficient-credits', 'The player does not have enough community credits.');
		// what is given must be here, exactly as offered (the same id, level and tier)
		for (const x of give.items) { const own = instanceOf(state, x.u); if (!own || own.i !== x.i || own.l !== x.l || own.t !== x.t || own.x !== x.x) return reject(state, tx, 'not-owned', 'The player no longer has everything offered.'); }
		const instances = { ...state.instances };
		for (const x of give.items) delete instances[x.u];
		// (an id already here, which only a mistake elsewhere could make, gets a new one: never lost)
		for (const x of get.items) { let u = x.u; while (instances[u]) u = mintUid(`${id}:${u}`, 1); instances[u] = { ...x, u }; }
		const next = recount({ ...state, instances, credits: Math.min(Number.MAX_SAFE_INTEGER, state.credits - give.credits + get.credits) });
		return applyAccepted(next, tx, { peer: String(tx.peer || '').slice(0, 40), give: give.items.map((x) => x.u), get: get.items.map((x) => x.u), credits: get.credits - give.credits });
	}

	// experience from using or carrying an item (local and frequent: counted, not journaled)
	if (kind === TRANSACTION_KINDS.TRAIN) {
		const inst = instanceOf(state, tx.uid);
		if (!inst) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		const next = recount({ ...state, instances: { ...state.instances, [inst.u]: trained(inst, clamp(tx.xp, 0, 1000)) }, revision: state.revision + 1, updatedAt: integer(tx.at, state.updatedAt) });
		return { ok: true, state: next, receipt: receipt(id, kind, true, next.revision, { uid: inst.u, level: next.instances[inst.u].l }) };
	}

	// one level more at an outfitter, for credits and one upgrade material
	if (kind === TRANSACTION_KINDS.UPGRADE) {
		const inst = instanceOf(state, tx.uid);
		if (!inst) return reject(state, tx, 'not-owned', 'The player does not have that item.');
		if (inst.l >= MAX_LEVEL) return reject(state, tx, 'max-level', 'That item is already at its highest level.');
		if (String(tx.sourceId || '') !== ACQUISITION_SOURCES.NPC_TRADER) return reject(state, tx, 'not-here', 'Upgrades are done at an outfitter.');
		const cost = upgradePrice(inst);
		if (tx.cost !== undefined && integer(tx.cost, -1) !== cost) return reject(state, tx, 'price-mismatch', 'The upgrade price changed.');
		if (state.credits < cost) return reject(state, tx, 'insufficient-credits', 'The player does not have enough community credits.');
		const material = instancesOf(state, UPGRADE_MATERIAL).reverse().find((x) => x.u !== inst.u && x.u !== state.hand) || instancesOf(state, UPGRADE_MATERIAL).find((x) => x.u !== inst.u);
		if (!material) return reject(state, tx, 'no-material', 'An upgrade needs a Repair Roll as material.');
		const instances = { ...state.instances, [inst.u]: { ...inst, l: inst.l + 1, x: 0 } };
		delete instances[material.u];
		return applyAccepted(recount({ ...state, credits: state.credits - cost, instances }), tx, { uid: inst.u, level: inst.l + 1, cost, material: material.u });
	}

	// two of a kind and tier become one of the next tier
	if (kind === TRANSACTION_KINDS.COMBINE) {
		const a = instanceOf(state, tx.uid), b = instanceOf(state, tx.with);
		if (!canCombine(a, b)) return reject(state, tx, 'cannot-combine', 'Only two of the same item and tier combine, below Legendary.');
		const instances = { ...state.instances, [a.u]: combined(a, b) };
		delete instances[b.u];
		return applyAccepted(recount({ ...state, instances, hand: state.hand === b.u ? a.u : state.hand }), tx, { uid: a.u, consumed: b.u, tier: a.t + 1 });
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
		instances: Object.values(normalized.instances).map((x) => ({ ...x })),
		hand: normalized.hand,
		equipped: { ...normalized.equipped },
	};
}
