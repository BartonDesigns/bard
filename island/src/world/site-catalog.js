// Stable world-site contract for systems that need to place or resolve
// fictional equipment.  This module deliberately contains no rendering,
// input, networking, or procedural instructions.  The weapons/inventory
// layer can consume the catalog without importing the city or interior
// builders, and can later add a generated site id/position to each record.
//
// A site describes what kind of place it is and what game-facing channels it
// exposes.  A channel is not an automatic grant: the caller still validates
// ownership, stock, currency, reputation, quest state, and the world's
// consequence system before committing an action.

const freeze = (value) => {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	Object.freeze(value);
	for (const child of Object.values(value)) freeze(child);
	return value;
};

const clone = (value) => {
	if (Array.isArray(value)) return value.map(clone);
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
	return value;
};

/** Canonical site categories understood by the gameplay resolver. */
export const SITE_KINDS = Object.freeze({
	POLICE_STATION: 'police_station',
	ARMORY: 'armory',
	SUPERMARKET: 'supermarket',
	HOME_SUPPLY: 'home_supply',
	OUTFITTER: 'outfitter',
	NPC_VENDOR: 'npc_vendor',
	PLAYER_VENDOR: 'player_vendor',
	HOUSE: 'house',
	HUNTING_AREA: 'hunting_area',
	RANGER_CAMP: 'ranger_camp',
});

const CHANNELS = Object.freeze({
	PURCHASE: 'purchase',
	PLAYER_TRADE: 'player_trade',
	NPC_TRADE: 'npc_trade',
	QUEST_REWARD: 'quest_reward',
	THEFT: 'theft',
	SCAVENGE: 'scavenge',
	USE: 'use',
	HUNT: 'hunt',
});

const SUPPLY = freeze({
	// Names are intentionally game inventory ids rather than real product
	// specifications.  A future weapons core can attach its own stats.
	field_rifle: { family: 'weapon', role: 'hunting', tags: ['ranged', 'field'] },
	utility_carbine: { family: 'weapon', role: 'home_defense', tags: ['ranged', 'compact'] },
	flare_launcher: { family: 'tool', role: 'signal', tags: ['ranged', 'rescue'] },
	tranquilizer_rifle: { family: 'tool', role: 'wildlife', tags: ['ranged', 'nonlethal'] },
	field_ammo: { family: 'consumable', role: 'ranged', tags: ['ammo'] },
	field_shells: { family: 'consumable', role: 'ranged', tags: ['ammo'] },
	protective_vest: { family: 'gear', role: 'protection', tags: ['protective'] },
	first_aid_kit: { family: 'supply', role: 'medical', tags: ['home', 'medical'] },
	flashlight: { family: 'supply', role: 'visibility', tags: ['home', 'utility'] },
	lock_repair_kit: { family: 'supply', role: 'home_security', tags: ['home', 'utility'] },
	camping_kit: { family: 'supply', role: 'outdoor', tags: ['camp', 'utility'] },
	field_binoculars: { family: 'tool', role: 'observation', tags: ['field', 'utility'] },
});

const ACCESS = Object.freeze({
	retail: {
		channels: [CHANNELS.PURCHASE],
		requires: ['stock', 'currency'],
		failure: ['out_of_stock', 'insufficient_funds'],
	},
	npc: {
		channels: [CHANNELS.NPC_TRADE, CHANNELS.QUEST_REWARD],
		requires: ['vendor_relationship', 'stock_or_offer'],
		failure: ['vendor_unavailable', 'offer_declined'],
	},
	player: {
		channels: [CHANNELS.PLAYER_TRADE],
		requires: ['listing', 'player_confirmation'],
		failure: ['listing_expired', 'trade_declined'],
	},
	secured: {
		// The action is intentionally abstract.  Do not turn this into a route,
		// bypass, or real-world security guide.  The game decides the risk roll.
		channels: [CHANNELS.THEFT, CHANNELS.SCAVENGE],
		requires: ['world_consequence_system', 'site_security_state'],
		failure: ['alarm', 'wanted_state', 'site_locked'],
	},
	field: {
		channels: [CHANNELS.USE, CHANNELS.HUNT],
		requires: ['player_has_item', 'valid_target'],
		failure: ['invalid_target', 'outside_habitat'],
	},
});

const site = (kind, label, access, stock, extra = {}) => ({
	kind,
	label,
	access: ACCESS[access],
	stock,
	roles: extra.roles || [],
	tags: extra.tags || [],
	...extra,
});

/**
 * The source-of-truth site definitions.  Keep this plain data so it can be
 * consumed by a future weapons core, NPC vendors, generated city lots, or a
 * multiplayer planner without pulling in Three.js.
 */
export const SITE_CATALOG = freeze({
	[SITE_KINDS.POLICE_STATION]: site(SITE_KINDS.POLICE_STATION, 'police station', 'secured', [
		'utility_carbine', 'field_rifle', 'field_ammo', 'field_shells', 'protective_vest', 'first_aid_kit', 'flashlight',
	], {
	roles: ['civic_security', 'evidence_store'],
	tags: ['civic', 'secured', 'high_consequence'],
	// Police sites expose a game-theft branch while keeping the consequence
	// decision with the authoritative world-state system.
	theft: { enabled: true, risk: 'high', consequences: ['alarm', 'wanted_state', 'local_panic', 'site_lockdown'] },
	}),
	[SITE_KINDS.ARMORY]: site(SITE_KINDS.ARMORY, 'armory', 'secured', [
		'field_rifle', 'utility_carbine', 'field_ammo', 'field_shells', 'protective_vest', 'first_aid_kit',
	], {
	roles: ['military', 'fortification'],
	tags: ['civic', 'secured', 'high_consequence'],
	theft: { enabled: true, risk: 'high', consequences: ['alarm', 'wanted_state', 'local_panic', 'site_lockdown'] },
	}),
	[SITE_KINDS.SUPERMARKET]: site(SITE_KINDS.SUPERMARKET, 'supermarket', 'retail', [
		'field_rifle', 'utility_carbine', 'flare_launcher', 'field_ammo', 'field_shells', 'first_aid_kit', 'flashlight', 'lock_repair_kit', 'camping_kit', 'field_binoculars',
	], {
	roles: ['grocer', 'general_store'],
	tags: ['retail', 'home_supply', 'public'],
	}),
	[SITE_KINDS.HOME_SUPPLY]: site(SITE_KINDS.HOME_SUPPLY, 'home-supply store', 'retail', [
		'utility_carbine', 'flare_launcher', 'field_ammo', 'field_shells', 'first_aid_kit', 'flashlight', 'lock_repair_kit', 'camping_kit',
	], {
	roles: ['hardware', 'home_goods'],
	tags: ['retail', 'home_supply', 'public'],
	}),
	[SITE_KINDS.OUTFITTER]: site(SITE_KINDS.OUTFITTER, 'outdoor outfitter', 'retail', [
		'field_rifle', 'tranquilizer_rifle', 'field_ammo', 'field_shells', 'protective_vest', 'camping_kit', 'field_binoculars', 'first_aid_kit',
	], {
	roles: ['ranger_supply', 'hunting_guide'],
	tags: ['retail', 'outdoors', 'hunting'],
	}),
	[SITE_KINDS.NPC_VENDOR]: site(SITE_KINDS.NPC_VENDOR, 'NPC vendor', 'npc', [
		'field_rifle', 'utility_carbine', 'flare_launcher', 'tranquilizer_rifle', 'field_ammo', 'field_shells', 'camping_kit', 'field_binoculars',
	], {
	roles: ['merchant', 'scavenger', 'ranger', 'craftsperson'],
	tags: ['social', 'dynamic_stock'],
	}),
	[SITE_KINDS.PLAYER_VENDOR]: site(SITE_KINDS.PLAYER_VENDOR, 'player vendor', 'player', [
		'field_rifle', 'utility_carbine', 'flare_launcher', 'tranquilizer_rifle', 'field_ammo', 'field_shells', 'protective_vest', 'camping_kit',
	], {
	roles: ['player_market'],
	tags: ['social', 'multiplayer', 'dynamic_stock'],
	}),
	[SITE_KINDS.HOUSE]: site(SITE_KINDS.HOUSE, 'house', 'retail', [
		'utility_carbine', 'field_ammo', 'field_shells', 'first_aid_kit', 'flashlight', 'lock_repair_kit', 'camping_kit',
	], {
	roles: ['resident', 'safehouse'],
	tags: ['residential', 'home_defense'],
	}),
	[SITE_KINDS.HUNTING_AREA]: site(SITE_KINDS.HUNTING_AREA, 'hunting area', 'field', [], {
	roles: ['wildlife_habitat'],
	tags: ['outdoors', 'hunting', 'wildlife'],
	}),
	[SITE_KINDS.RANGER_CAMP]: site(SITE_KINDS.RANGER_CAMP, 'ranger camp', 'npc', [
		'field_rifle', 'tranquilizer_rifle', 'field_ammo', 'field_shells', 'protective_vest', 'camping_kit', 'field_binoculars', 'first_aid_kit',
	], {
	roles: ['ranger', 'wildlife_service'],
	tags: ['outdoors', 'hunting', 'public'],
	}),
});

const ALIASES = Object.freeze({
	police: SITE_KINDS.POLICE_STATION,
	'police station': SITE_KINDS.POLICE_STATION,
	precinct: SITE_KINDS.POLICE_STATION,
	station: SITE_KINDS.POLICE_STATION,
	armory: SITE_KINDS.ARMORY,
	armoury: SITE_KINDS.ARMORY,
	barracks: SITE_KINDS.ARMORY,
	supermarket: SITE_KINDS.SUPERMARKET,
	grocery: SITE_KINDS.SUPERMARKET,
	grocer: SITE_KINDS.SUPERMARKET,
	'home supply': SITE_KINDS.HOME_SUPPLY,
	'home-supply': SITE_KINDS.HOME_SUPPLY,
	'home supply store': SITE_KINDS.HOME_SUPPLY,
	'home-supply store': SITE_KINDS.HOME_SUPPLY,
	'hardware store': SITE_KINDS.HOME_SUPPLY,
	hardware: SITE_KINDS.HOME_SUPPLY,
	outfitter: SITE_KINDS.OUTFITTER,
	'outdoor store': SITE_KINDS.OUTFITTER,
	'npc vendor': SITE_KINDS.NPC_VENDOR,
	merchant: SITE_KINDS.NPC_VENDOR,
	trader: SITE_KINDS.NPC_VENDOR,
	'player vendor': SITE_KINDS.PLAYER_VENDOR,
	'player-vendor': SITE_KINDS.PLAYER_VENDOR,
	'player market': SITE_KINDS.PLAYER_VENDOR,
	'player-market': SITE_KINDS.PLAYER_VENDOR,
	player: SITE_KINDS.PLAYER_VENDOR,
	house: SITE_KINDS.HOUSE,
	home: SITE_KINDS.HOUSE,
	'hunting area': SITE_KINDS.HUNTING_AREA,
	hunting: SITE_KINDS.HUNTING_AREA,
	wilderness: SITE_KINDS.HUNTING_AREA,
	'ranger camp': SITE_KINDS.RANGER_CAMP,
});

const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Convert user/world aliases to a stable catalog key. */
export function normalizeSiteKind(value) {
	const raw = String(value ?? '').trim().toLowerCase();
	const alias = ALIASES[raw] || ALIASES[raw.replace(/[_-]/g, ' ')];
	if (alias) return alias;
	const key = norm(value);
	return SITE_CATALOG[key] ? key : null;
}

/**
 * Resolve a generated record without mutating it.  Callers commonly have a
 * site `{ kind, type, category, siteKind }`; the first known field wins.
 */
export function siteKindOf(record) {
	if (typeof record === 'string') return normalizeSiteKind(record);
	if (!record || typeof record !== 'object') return null;
	for (const key of ['siteKind', 'kind', 'type', 'category', 'use', 'role']) {
		const value = normalizeSiteKind(record[key]);
		if (value) return value;
	}
	return null;
}

/** Return an immutable catalog definition as a detached object. */
export function siteDefinition(kindOrRecord) {
	const kind = siteKindOf(kindOrRecord);
	return kind && SITE_CATALOG[kind] ? clone(SITE_CATALOG[kind]) : null;
}

const itemMeta = (itemId) => SUPPLY[itemId] || { family: 'unknown', role: 'unknown', tags: [] };

/**
 * Return the game-facing channels available at a site.  This is intentionally
 * descriptive: the weapons core must run its own authoritative validation.
 */
export function resolveSiteAccess(siteOrKind, context = {}) {
	const definition = siteDefinition(siteOrKind);
	if (!definition) return { kind: null, known: false, channels: [], requires: [], failure: ['unknown_site'] };
	const channels = definition.access.channels.slice();
	const requirements = definition.access.requires.slice();
	const failures = definition.access.failure.slice();
	const secure = definition.access.channels.includes(CHANNELS.THEFT);
	if (secure && context.siteSecurityState === 'locked') {
		return { kind: definition.kind, known: true, channels: [], requires: requirements, failure: ['site_locked'], risk: definition.theft?.risk || 'high' };
	}
	return {
		kind: definition.kind,
		known: true,
		channels,
		requires: requirements,
		failure: failures,
		risk: definition.theft?.risk || null,
		consequences: definition.theft?.consequences?.slice() || [],
	};
}

/**
 * Resolve whether an item is listed at a site and which channels can offer it.
 * Stock overrides are accepted for generated NPC/player inventories but are
 * always copied, so a caller cannot mutate the catalog by accident.
 */
export function resolveSiteItem(siteOrKind, itemId, { stock = null, siteSecurityState = null } = {}) {
	const definition = siteDefinition(siteOrKind);
	if (!definition) return { known: false, available: false, kind: null, item: itemId, channels: [], reason: 'unknown_site' };
	const id = String(itemId ?? '').trim();
	const listed = Array.isArray(stock) ? stock.includes(id) : definition.stock.includes(id);
	const access = resolveSiteAccess(definition.kind, { siteSecurityState });
	return {
		known: true,
		available: listed && access.channels.length > 0,
		kind: definition.kind,
		item: id,
		meta: itemMeta(id),
		channels: listed ? access.channels.slice() : [],
		requires: listed ? access.requires.slice() : ['stock'],
		failure: listed ? access.failure.slice() : ['not_listed'],
		risk: listed ? access.risk : null,
	};
}

/** A detached list for inventory UIs, NPC planning, or tests. */
export function siteStock(siteOrKind, { stock = null } = {}) {
	const definition = siteDefinition(siteOrKind);
	if (!definition) return [];
	const ids = Array.isArray(stock) ? stock : definition.stock;
	return ids.map((id) => ({ id, ...clone(itemMeta(id)) }));
}

export { CHANNELS as SITE_CHANNELS, SUPPLY as SITE_SUPPLY };
