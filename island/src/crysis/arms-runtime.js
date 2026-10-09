// Crysis arms runtime: the bridge between the pure gameplay arms core, generated
// world sites, the Guide and the Crysis console. This adapter owns no rendering and
// emits no real-world weapon instructions; all actions are finite game transactions.

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
	getItem,
	listOffers,
	resolveTheftAttempt,
	inventorySummary,
	instancesOf,
	sellPrice,
	upgradePrice,
} from '../gameplay/arms.js';
import { canCombine, canUpgrade } from '../gameplay/gear-levels.js';
import { normalizeSiteKind, resolveSiteAccess, siteDefinition } from '../world/site-catalog.js';

const SOURCE_BY_SITE = Object.freeze({
	police_station: ACQUISITION_SOURCES.POLICE_STATION,
	armory: ACQUISITION_SOURCES.POLICE_STATION,
	supermarket: ACQUISITION_SOURCES.SUPERMARKET,
	home_supply: ACQUISITION_SOURCES.SUPERMARKET,
	outfitter: ACQUISITION_SOURCES.NPC_TRADER,
	npc_vendor: ACQUISITION_SOURCES.NPC_TRADER,
	ranger_camp: ACQUISITION_SOURCES.NPC_TRADER,
	player_vendor: ACQUISITION_SOURCES.PLAYER_MARKET,
	player_market: ACQUISITION_SOURCES.PLAYER_MARKET,
});

// site-catalog uses broad prop-level ids while gameplay/arms.js owns the actual
// player inventory ids. Keep this translation at the integration boundary.
const SITE_ITEM_TO_CORE = Object.freeze({
	field_rifle: 'aurora-trail-rifle', utility_carbine: 'warden-spark-carbine',
	flare_launcher: 'station-signal-flare', tranquilizer_rifle: 'mossback-scout-rifle',
	first_aid_kit: 'field-medkit', flashlight: 'camp-lantern',
	lock_repair_kit: 'repair-roll', camping_kit: 'home-supply-kit',
});

const ITEM_ALIASES = Object.freeze({
	rifle: 'aurora-trail-rifle', carbine: 'warden-spark-carbine',
	'home defense': 'warden-spark-carbine', 'home-defense': 'warden-spark-carbine',
	bow: 'reedline-hunting-bow', 'hunting bow': 'reedline-hunting-bow',
	net: 'hunting-net', 'scent kit': 'trail-scent-kit', medkit: 'field-medkit',
	'first aid': 'field-medkit', lantern: 'camp-lantern',
	'home supplies': 'home-supply-kit', 'barracks supplies': 'home-supply-kit',
});

const ACTION_WORDS = {
	purchase: /\b(?:buy|purchase|trade|shop|order|get|pick\s+up)\b/i,
	secure: /\b(?:secure|lock|claim|stash|store|take|steal|snatch)\b/i,
	hunt: /\b(?:hunt|hunting|track|tracking|game\s+trail|go\s+after)\b/i,
	describe: /\b(?:weapon|weapons|rifle|carbine|bow|ammo|armory|arms|gear|supplies)\b/i,
};
const SOURCE_WORDS = [
	['police_station', /\bpolice(?:\s+station)?\b/i], ['armory', /\b(?:armory|armoury|barracks)\b/i],
	['supermarket', /\b(?:supermarket|grocery|market|store)\b/i],
	['outfitter', /\b(?:outfitter|sporting\s+goods|hunting\s+shop)\b/i],
	['npc_vendor', /\b(?:hunter|ranger|guide|npc|merchant|trader)\b/i],
	['player_vendor', /\b(?:player|marketplace|player\s+market)\b/i],
	['house', /\b(?:home|house|safehouse)\b/i],
];

const clean = (v) => String(v ?? '').trim();
const norm = (v) => clean(v).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const finite = (v) => Number.isFinite(+v);
const distance = (a, b) => Math.hypot((+a?.x || 0) - (+b?.x || 0), (+a?.z || 0) - (+b?.z || 0));
function copy(value) {
	if (value == null || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map(copy);
	const out = {};
	for (const [key, child] of Object.entries(value)) { if (typeof child === 'function') continue; out[key] = typeof child === 'object' && child !== null ? copy(child) : child; }
	return out;
}
function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
function catalogEntries() {
	return Object.values(ARMS_CATALOG).map((item) => ({ ...copy(item), aliases: [item.id.replace(/-/g, ' '), item.name.toLowerCase(), item.kind] }));
}
function canonicalItem(value) {
	const q = norm(value); if (!q) return null;
	const alias = ITEM_ALIASES[q] || ITEM_ALIASES[q.replace(/ /g, '-')];
	if (alias && ARMS_CATALOG[alias]) return alias;
	let best = null, score = 0;
	for (const item of catalogEntries()) for (const name of [item.id, item.name, item.kind, ...(item.aliases || [])]) {
		const n = norm(name), s = n === q ? 100 : n.startsWith(q) ? 65 : n.includes(q) ? 45 : q.includes(n) && n.length > 3 ? 30 : 0;
		if (s > score) { score = s; best = item.id; }
	}
	return best;
}
function sourceKindOf(source) {
	const raw = source?.siteKind || source?.kind || source?.type || source?.category || source?.role || source?.name;
	return normalizeSiteKind(raw) || (norm(raw).replace(/ /g, '_') || 'site');
}
function sourceIdOf(source) {
	if (SOURCE_CATALOG[source?.sourceId]) return source.sourceId;
	return SOURCE_BY_SITE[sourceKindOf(source)] || null;
}
function actionNames(source) {
	const explicit = source?.actions || source?.services;
	if (explicit) return [...new Set((Array.isArray(explicit) ? explicit : [explicit]).map(norm).filter(Boolean))];
	const access = resolveSiteAccess(sourceKindOf(source)), channels = access.channels || [];
	return [...new Set(channels.map((channel) => channel === 'theft' || channel === 'scavenge' ? 'secure' : channel === 'player_trade' || channel === 'npc_trade' ? 'purchase' : channel === 'hunt' || channel === 'use' ? 'hunt' : channel))];
}
function stockToCore(source) {
	const raw = Array.isArray(source?.stock) ? source.stock : siteDefinition(sourceKindOf(source))?.stock || [];
	return raw.map((id) => SITE_ITEM_TO_CORE[id] || id).filter((id) => !!ARMS_CATALOG[id]);
}
function normalizeSource(source, index) {
	if (!source || typeof source !== 'object') return null;
	const kind = sourceKindOf(source), sourceId = sourceIdOf(source);
	const x = finite(source.x) ? +source.x : finite(source.position?.x) ? +source.position.x : null;
	const z = finite(source.z) ? +source.z : finite(source.position?.z) ? +source.position.z : null;
	return { ...copy(source), id: clean(source.id || source.key || `${kind}-${index}`), name: clean(source.name || source.label || source.title || siteDefinition(kind)?.label || kind), kind, sourceId, x, z, stock: stockToCore(source), stockExplicit: Array.isArray(source.stock), actions: actionNames(source), available: source.available !== false };
}

/** Parse a conversational request without mutating world or inventory state. */
export function parseArmsRequest(text) {
	const raw = clean(text), q = norm(raw);
	if (!q || /\b(?:don t|do not|never|would not|what if|imagine|what does)\b/.test(q)) return { kind: 'none' };
	let kind = null; for (const [name, rx] of Object.entries(ACTION_WORDS)) if (rx.test(raw)) { kind = name; break; }
	if (!kind) return { kind: 'none' };
	if (kind === 'describe' && !/[?]|\b(?:what|where|which|show|list|available|offer|sell|find|need|looking)\b/i.test(raw)) return { kind: 'none' };
	let source = null; for (const [name, rx] of SOURCE_WORDS) if (rx.test(raw)) { source = name; break; }
	let item = null;
	for (const entry of catalogEntries()) if ([entry.id, entry.name, entry.kind, ...(entry.aliases || [])].some((name) => q.includes(norm(name)))) { item = entry.id; break; }
	item ||= canonicalItem(raw);
	if (!item && kind === 'secure' && source === 'police_station') item = 'warden-spark-carbine';
	if (!item && kind === 'hunt') item = 'mossback-scout-rifle';
	if (!item && kind === 'purchase' && source === 'supermarket') item = 'home-supply-kit';
	return { kind, source, item, text: raw };
}

/**
 * Build the runtime around gameplay/arms.js. `core` is optional dependency injection
 * for a future weapons_core-compatible module; it may replace the catalog/repository
 * hooks while preserving this adapter's public contract.
 */
export function createArmsRuntime({ world = () => null, sites = () => [], core = null, storageKey = 'crysis-arms-v1', ownerId = 'player', startingCredits = 0, radius = 180, now = () => Date.now(), hint = () => {}, onChange = () => {} } = {}) {
	const C = core || { ARMS_CATALOG, SOURCE_CATALOG, TRANSACTION_KINDS, ACTIVITIES, applyInventoryTransaction, canAttemptTheft, createInventoryRepository, createInventoryState, getItem, listOffers, resolveTheftAttempt, inventorySummary };
	const repository = C.createInventoryRepository({ storage: browserStorage(), key: storageKey, ownerId });
	let state = repository.load();
	let tradeLocks = new Set();
	function transact(tx, options) {
		if (tradeLocks.size && ![...tradeLocks].some((id) => tx.id === `trade:${id}` || tx.id === `trade:${id}:undo`)) return { ok: false, state, receipt: { message: 'Finish the pending trade before changing gear or spending credits.' } };
		return C.applyInventoryTransaction(state, tx, options);
	}
	function lockTrades(ids = []) { tradeLocks = new Set(ids); }
	if (!state.updatedAt && startingCredits > 0) { state = C.createInventoryState(ownerId, { credits: startingCredits }); repository.save(state); }
	let lastNearby = [], lastPosition = null, scanClock = 0, sequence = 0;
	function rawSites(position = null) {
		const W = typeof world === 'function' ? world() : world;
		let source = typeof sites === 'function' ? sites(W) : sites;
		// World modules commonly expose a lazy `worldSites()` function rather than an
		// eagerly allocated array. Resolve that extra layer here so streamed shops and
		// the island fallback are discoverable without coupling the runtime to builders.
		if (typeof source === 'function') {
			try { source = source(position, W); } catch { source = []; }
		}
		if (Array.isArray(source)) return source;
		if (typeof source?.nearby === 'function' && position) { try { const found = source.nearby(position, radius); if (Array.isArray(found)) return found; } catch { /* optional site module */ } }
		if (Array.isArray(source?.list?.())) return source.list();
		if (Array.isArray(source?.sources)) return source.sources;
		if (Array.isArray(W?.worldSites)) return W.worldSites;
		if (typeof C.nearby === 'function' && position) { try { const found = C.nearby(position, radius); if (Array.isArray(found)) return found; } catch { /* optional core module */ } }
		return [];
	}
	function allSources(position = null) {
		const out = [];
		for (const [index, source] of rawSites(position).entries()) { const normalized = normalizeSource(source, index); if (!normalized || !normalized.available) continue; if (position && finite(normalized.x) && finite(normalized.z)) normalized.distance = distance(normalized, position); out.push(normalized); }
		return out;
	}
	function nearby(position = null, max = radius) {
		const p = position || lastPosition; let out = allSources(p);
		if (p) out = out.filter((source) => !finite(source.distance) || source.distance <= max).sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
		lastNearby = out.slice(0, 24); lastPosition = p ? { x: +p.x || 0, z: +p.z || 0, y: +p.y || 0 } : lastPosition; return lastNearby.map(copy);
	}
	function findItem(itemId) { return C.getItem(itemId) || getItem(itemId); }
	function nearestSource(request, position) {
		const all = nearby(position), wanted = request.source;
		if (wanted) { const kind = normalizeSiteKind(wanted) || wanted; return all.find((source) => source.kind === kind || source.sourceId === SOURCE_BY_SITE[kind] || norm(source.name).includes(norm(wanted))) || null; }
		const need = request.kind === 'purchase' ? ['purchase', 'trade', 'player_trade', 'npc_trade'] : request.kind === 'secure' ? ['secure', 'theft', 'scavenge'] : request.kind === 'hunt' ? ['hunt'] : [];
		return all.find((source) => !need.length || need.some((action) => source.actions.includes(action))) || all[0] || null;
	}
	function offerFor(source, itemId, mode = 'purchase') {
		if (!source?.sourceId) return null;
		return C.listOffers(source.sourceId, { offers: source.offers }).find((offer) => offer.itemId === itemId && (offer.mode === mode || (mode === 'purchase' && ['trade', 'player_trade', 'npc_trade'].includes(offer.mode)))) || null;
	}
	function info(position = lastPosition) {
		const summary = C.inventorySummary(state);
		return { version: 1, inventory: summary?.items || [], items: summary?.items || [], credits: summary?.credits ?? state.credits ?? 0, heat: summary?.heat ?? state.heat ?? 0, equipped: summary?.equipped || {}, nearby: nearby(position).map((source) => ({ id: source.id, name: source.name, kind: source.kind, sourceId: source.sourceId, distance: source.distance, actions: source.actions, stock: source.stock })), updatedAt: state.updatedAt || 0 };
	}
	function result(ok, kind, message, extra = {}) { return { ok, kind, message, ...extra, state: info(lastPosition) }; }
	// (a nonce for this visit, so two players' new items never share an id)
	const nonce = Math.random().toString(36).slice(2, 8);
	function txId(kind, itemId, sourceId) { sequence = (sequence + 1) % 1000000; return `arms:${nonce}:${now()}:${sequence}:${kind}:${itemId || 'none'}:${sourceId || 'none'}`; }
	function save(next) {
		state = next;
		try { repository.save(state); } catch { /* private mode or a transient storage failure */ }
		try { onChange(info(lastPosition)); } catch { /* observers do not break the world */ }
	}
	function purchase(source, item) {
		const offer = offerFor(source, item.id), tx = { id: txId('purchase', item.id, source.sourceId), kind: TRANSACTION_KINDS.PURCHASE, sourceId: source.sourceId, itemId: item.id, quantity: 1, ...(offer ? { unitPrice: offer.unitPrice, offer } : {}) };
		const out = transact(tx, { expectedRevision: state.revision }); if (out.ok && !out.duplicate) save(out.state); return out;
	}
	function secure(source, item, context) {
		if (source.sourceId !== ACQUISITION_SOURCES.POLICE_STATION) return result(false, 'secure', `${source.name} has no recoverable secure cache in the current world.`);
		const attempt = C.resolveTheftAttempt({ attemptId: txId('attempt', item.id, source.sourceId), sourceId: source.sourceId, itemId: item.id, heat: state.heat, stealth: context.stealth ?? 0.5, preparation: context.preparation ?? 0.5, localTrust: context.localTrust ?? 0, successRoll: context.successRoll ?? Math.random(), detectionRoll: context.detectionRoll ?? Math.random() });
		if (!attempt.ok) return result(false, 'secure', `The cache is unavailable: ${attempt.reason}.`);
		if (!attempt.proof) {
			const heatDelta = Math.max(0, Number(attempt.heatDelta) || 0);
			if (heatDelta) save({ ...state, heat: Math.min(100, state.heat + heatDelta), updatedAt: now() });
			return result(false, 'secure', `The attempt failed and the local alert state changed: ${attempt.outcome}.`, { outcome: attempt.outcome, heatDelta });
		}
		const tx = { id: txId('steal', item.id, source.sourceId), kind: TRANSACTION_KINDS.STEAL, sourceId: source.sourceId, itemId: item.id, quantity: 1, theftProof: attempt.proof }, out = transact(tx, { expectedRevision: state.revision });
		if (out.ok && !out.duplicate) save(out.state);
		return out.ok ? result(true, 'secure', `Secured ${item.name} from ${source.name}. Local heat rose by ${attempt.heatDelta}; consequences remain in the world state.`, { outcome: attempt.outcome, receipt: out.receipt }) : result(false, 'secure', out.receipt?.message || 'The cache would not open.');
	}
	function hunt(source, item) {
		if ((state.items?.[item.id] || 0) < 1) return result(false, 'hunt', `You need ${item.name} before starting a hunt. Ask me to purchase it from a nearby outfitter or player market.`);
		const entry = { id: txId('hunt', item.id, source.id), kind: 'hunt', itemId: item.id, sourceId: source.id, activity: ACTIVITIES.HUNTING, at: now(), status: 'active' };
		save({ ...state, journal: [...(state.journal || []), entry].slice(-512), updatedAt: now() });
		// (starting a hunt is experience for the item it uses)
		const used = state.hand && state.instances?.[state.hand]?.i === item.id ? state.hand : instancesOf(state, item.id)[0]?.u;
		if (used) train(used, 40);
		const message = `Hunt started with ${item.name} near ${source.name}. Follow the marked trail and return when the encounter is complete.`; hint(message, 4500); return result(true, 'hunt', message, { hunt: entry });
	}
	function execute(request, context = {}) {
		if (tradeLocks.size) return result(false, 'trade', 'Finish the pending trade before changing gear or spending credits.');
		const parsed = typeof request === 'string' ? parseArmsRequest(request) : request || { kind: 'none' }; if (!parsed || parsed.kind === 'none') return result(false, 'none', null);
		const source = nearestSource(parsed, context.position || lastPosition);
		if (parsed.kind === 'describe') return result(true, 'describe', source ? `Nearby: ${source.name}. Ask to buy, secure, or hunt and I will use its authored game rules.` : 'No equipment source is nearby. Ask me for a supermarket, outfitter, police station or player market.');
		if (!source) return result(false, parsed.kind, 'There is no nearby source for that action. Ask me to find a supermarket, outfitter, police station or player market.');
		const item = findItem(parsed.item || (parsed.kind === 'hunt' ? 'mossback-scout-rifle' : parsed.kind === 'secure' ? 'warden-spark-carbine' : 'home-supply-kit'));
		if (!item) return result(false, parsed.kind, 'That piece of gear is not in the game catalog. Try a rifle, carbine, bow or home supplies.');
		// Generated sites without a stock override use the gameplay core's authored
		// source offers. Explicit world stock remains authoritative for dynamic vendors.
		if (source.stockExplicit && !source.stock.includes(item.id) && parsed.kind !== 'hunt') return result(false, parsed.kind, `${source.name} does not list ${item.name}.`);
		if (parsed.kind === 'purchase') { const out = purchase(source, item); return out.ok ? result(true, parsed.kind, `Purchased ${item.name} from ${source.name}. It is now in your persistent gear.`, { receipt: out.receipt }) : result(false, parsed.kind, out.receipt?.message || 'That purchase could not be completed.', { receipt: out.receipt }); }
		if (parsed.kind === 'secure') return secure(source, item, context);
		if (parsed.kind === 'hunt') return hunt(source, item);
		return result(false, parsed.kind, 'That arms action is not available here.');
	}
	// ---------- the gear screen: shops, the item in hand, and trades between players ----------
	const SHOP_SOURCES = [ACQUISITION_SOURCES.NPC_TRADER, ACQUISITION_SOURCES.SUPERMARKET];
	// the shops near a place (the outfitters, ranger camps, traders and supermarkets), nearest first
	function shops(position = lastPosition) { return nearby(position).filter((source) => SHOP_SOURCES.includes(source.sourceId)); }
	function shopFor(siteId, position) { return shops(position).find((source) => source.id === siteId) || allSources(position).find((source) => source.id === siteId && SHOP_SOURCES.includes(source.sourceId)) || null; }
	// what a shop sells and what it would pay for what you have
	function shopSheet(siteId, position = lastPosition) {
		const source = shopFor(siteId, position);
		if (!source) return null;
		const offers = C.listOffers(source.sourceId).filter((offer) => offer.mode === 'purchase' && (!source.stockExplicit || source.stock.includes(offer.itemId)));
		const buy = offers.map((offer) => ({ itemId: offer.itemId, name: offer.name, price: offer.unitPrice, owned: state.items?.[offer.itemId] || 0 }));
		const sell = Object.values(state.instances || {}).map((x) => ({ uid: x.u, itemId: x.i, l: x.l, t: x.t, name: findItem(x.i)?.name || x.i, price: sellPrice(x.i, source.sourceId, x) })).filter((row) => row.price != null).sort((a, b) => b.price - a.price);
		const upgrades = source.sourceId === ACQUISITION_SOURCES.NPC_TRADER;
		return { id: source.id, name: source.name, kind: source.kind, sourceId: source.sourceId, distance: source.distance, credits: state.credits, buy, sell, upgrades };
	}
	function buy(siteId, itemId, position = lastPosition) {
		const source = shopFor(siteId, position), item = findItem(itemId);
		if (!source || !item || (source.stockExplicit && !source.stock.includes(itemId))) return result(false, 'purchase', 'That is not for sale here.');
		const out = purchase(source, item);
		return out.ok ? result(true, 'purchase', `Bought ${item.name}.`, { receipt: out.receipt }) : result(false, 'purchase', out.receipt?.message || 'That purchase could not be completed.');
	}
	// sell one: a particular instance by its uid, or the least valuable of an item
	function sell(siteId, which, position = lastPosition) {
		const inst = state.instances?.[which] || instancesOf(state, which).at(-1) || null;
		const source = shopFor(siteId, position), item = inst && findItem(inst.i);
		if (!source || !item) return result(false, 'sell', 'This place does not buy that.');
		const tx = { id: txId('sell', item.id, source.sourceId), kind: TRANSACTION_KINDS.SELL, sourceId: source.sourceId, itemId: item.id, uid: inst.u, quantity: 1, unitPrice: sellPrice(item.id, source.sourceId, inst) ?? undefined };
		const out = transact(tx, { expectedRevision: state.revision });
		if (out.ok && !out.duplicate) save(out.state);
		return out.ok ? result(true, 'sell', `Sold ${item.name} for ${out.receipt.total} credits.`, { receipt: out.receipt }) : result(false, 'sell', out.receipt?.message || 'That sale could not be completed.');
	}
	// the item in your hand (one at a time, by its uid or the best of an item; null puts it away)
	function hold(which) {
		const inst = which ? state.instances?.[which] || instancesOf(state, which)[0] : null;
		if (which && !inst) return result(false, 'hold', 'You do not have that.');
		const tx = inst ? { id: txId('equip', inst.i, 'hand'), kind: TRANSACTION_KINDS.EQUIP, uid: inst.u, slot: 'hand' } : { id: txId('unequip', 'hand', 'hand'), kind: TRANSACTION_KINDS.UNEQUIP, slot: 'hand' };
		if (!inst && !state.equipped?.hand) return result(true, 'hold', null);
		const out = transact(tx, { expectedRevision: state.revision });
		if (out.ok && !out.duplicate) save(out.state);
		return result(out.ok, 'hold', out.ok ? null : out.receipt?.message);
	}
	// one side of a trade with a friend (gameplay/trade.js builds it; its id makes it land once)
	function apply(tx) {
		const out = transact(tx);
		if (out.ok && !out.duplicate) save(out.state);
		return { ok: out.ok, duplicate: !!out.duplicate, message: out.receipt?.message || '' };
	}
	// Food and community actions spend the same wallet as shops and gear.
	function spendCredits(amount, context = {}) {
		if (!Number.isInteger(amount) || amount < 0 || amount > 1e6) return false;
		if (!amount) return true;
		return apply({ id: context.id || txId('community', 'credits', context.kind), kind: TRANSACTION_KINDS.TRADE, peer: 'community', give: { credits: amount, items: [] }, get: { credits: 0, items: [] } }).ok;
	}
	// one level more for an item, at an outfitter near you
	function upgrade(uid, siteId, position = lastPosition) {
		const inst = state.instances?.[uid], source = shopFor(siteId, position);
		if (!inst || !canUpgrade(inst)) return result(false, 'upgrade', inst ? 'That is already at its highest level.' : 'You do not have that.');
		if (source?.sourceId !== ACQUISITION_SOURCES.NPC_TRADER) return result(false, 'upgrade', 'Upgrades are done at an outfitter, a ranger camp or a trader.');
		const out = transact({ id: txId('upgrade', inst.i, source.sourceId), kind: TRANSACTION_KINDS.UPGRADE, uid, sourceId: source.sourceId, cost: upgradePrice(inst) }, { expectedRevision: state.revision });
		if (out.ok && !out.duplicate) save(out.state);
		return out.ok ? result(true, 'upgrade', `${findItem(inst.i).name} is level ${inst.l + 1} now.`, { receipt: out.receipt }) : result(false, 'upgrade', out.receipt?.message || 'That upgrade could not be done.');
	}
	// two of the same item and tier into one of the next tier (anywhere)
	function combine(uid, other) {
		const a = state.instances?.[uid], b = state.instances?.[other];
		if (!canCombine(a, b)) return result(false, 'combine', 'Only two of the same item and tier combine, below Legendary.');
		const out = transact({ id: txId('combine', a.i, 'self'), kind: TRANSACTION_KINDS.COMBINE, uid, with: other }, { expectedRevision: state.revision });
		if (out.ok && !out.duplicate) save(out.state);
		return out.ok ? result(true, 'combine', `${findItem(a.i).name} is ${['Common', 'Fine', 'Superior', 'Masterwork', 'Legendary'][a.t + 1]} now.`) : result(false, 'combine', out.receipt?.message || 'Those would not combine.');
	}
	// experience for an item (carrying it about, a hunt): gathered, then counted every so often
	let pendingXp = 0, pendingUid = null, xpClock = 0;
	function train(uid, xp) {
		if (!state.instances?.[uid]) return;
		const before = state.instances[uid].l;
		const out = transact({ id: txId('train', state.instances[uid].i, 'xp'), kind: TRANSACTION_KINDS.TRAIN, uid, xp, at: now() });
		if (!out.ok) return;
		save(out.state);
		if (out.state.instances[uid].l > before) hint(`${findItem(out.state.instances[uid].i).name} reached level ${out.state.instances[uid].l}.`, 3500);
	}
	// carrying the item in hand while you travel on foot: about one point every 15 m
	function carry(dt, metres) {
		const uid = state.hand;
		if (!uid) return;
		if (uid !== pendingUid) { pendingUid = uid; pendingXp = 0; }
		pendingXp += Math.max(0, Math.min(metres, 30)) / 15;
		xpClock += dt;
		if (xpClock >= 20 && pendingXp >= 1) { xpClock = 0; const n = Math.floor(pendingXp); pendingXp -= n; train(uid, n); }
	}
	const applied = (id) => (state.journal || []).some((entry) => entry.id === id && entry.accepted !== false);

	function command(text, context = {}) { return execute(parseArmsRequest(text), context); }
	function update(dt = 0, position = null) { scanClock -= Math.max(0, +dt || 0); if (position && (scanClock <= 0 || !lastPosition || distance(position, lastPosition) > 8)) { scanClock = 0.5; nearby(position); } return lastNearby; }
	return { catalog: () => catalogEntries().map(copy), state: () => copy(state), nearby, sources: () => allSources(lastPosition).map(copy), info, snapshot: info, parse: parseArmsRequest, command, execute, update, offers: (sourceId) => C.listOffers(sourceId), shops, shopSheet, buy, sell, hold, held: () => (state.hand && state.instances?.[state.hand] ? { ...state.instances[state.hand] } : null), upgrade, combine, train, carry, apply, applied, spendCredits, lockTrades, locked: () => tradeLocks.size > 0, canAttemptTheft: (input) => C.canAttemptTheft(input) };
}

export { ARMS_CATALOG, SOURCE_CATALOG };
