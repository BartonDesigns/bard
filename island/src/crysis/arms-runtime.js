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
} from '../gameplay/arms.js';
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
	function txId(kind, itemId, sourceId) { sequence = (sequence + 1) % 1000000; return `arms:${now()}:${sequence}:${kind}:${itemId || 'none'}:${sourceId || 'none'}`; }
	function save(next) {
		state = next;
		try { repository.save(state); } catch { /* private mode or a transient storage failure */ }
		try { onChange(info(lastPosition)); } catch { /* observers do not break the world */ }
	}
	function purchase(source, item) {
		const offer = offerFor(source, item.id), tx = { id: txId('purchase', item.id, source.sourceId), kind: TRANSACTION_KINDS.PURCHASE, sourceId: source.sourceId, itemId: item.id, quantity: 1, ...(offer ? { unitPrice: offer.unitPrice, offer } : {}) };
		const out = C.applyInventoryTransaction(state, tx, { expectedRevision: state.revision }); if (out.ok && !out.duplicate) save(out.state); return out;
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
		const tx = { id: txId('steal', item.id, source.sourceId), kind: TRANSACTION_KINDS.STEAL, sourceId: source.sourceId, itemId: item.id, quantity: 1, theftProof: attempt.proof }, out = C.applyInventoryTransaction(state, tx, { expectedRevision: state.revision });
		if (out.ok && !out.duplicate) save(out.state);
		return out.ok ? result(true, 'secure', `Secured ${item.name} from ${source.name}. Local heat rose by ${attempt.heatDelta}; consequences remain in the world state.`, { outcome: attempt.outcome, receipt: out.receipt }) : result(false, 'secure', out.receipt?.message || 'The cache would not open.');
	}
	function hunt(source, item) {
		if ((state.items?.[item.id] || 0) < 1) return result(false, 'hunt', `You need ${item.name} before starting a hunt. Ask me to purchase it from a nearby outfitter or player market.`);
		const entry = { id: txId('hunt', item.id, source.id), kind: 'hunt', itemId: item.id, sourceId: source.id, activity: ACTIVITIES.HUNTING, at: now(), status: 'active' };
		save({ ...state, journal: [...(state.journal || []), entry].slice(-512), updatedAt: now() });
		const message = `Hunt started with ${item.name} near ${source.name}. Follow the marked trail and return when the encounter is complete.`; hint(message, 4500); return result(true, 'hunt', message, { hunt: entry });
	}
	function execute(request, context = {}) {
		const parsed = typeof request === 'string' ? parseArmsRequest(request) : request || { kind: 'none' }; if (!parsed || parsed.kind === 'none') return result(false, 'none', null);
		const source = nearestSource(parsed, context.position || lastPosition);
		if (parsed.kind === 'describe') return result(true, 'describe', source ? `Nearby: ${source.name}. Ask to buy, secure, or hunt and I will use its authored game rules.` : 'No equipment source is nearby. Ask me for a supermarket, outfitter, police station or player market.');
		if (!source) return result(false, parsed.kind, 'There is no nearby source for that action. Ask me to find a supermarket, outfitter, police station or player market.');
		const item = findItem(parsed.item || (parsed.kind === 'hunt' ? 'mossback-scout-rifle' : parsed.kind === 'secure' ? 'warden-spark-carbine' : 'home-supply-kit'));
		if (!item) return result(false, parsed.kind, 'That piece of gear is not in the game catalog. Try a rifle, carbine, bow or home supplies.');
		// Generated sites without a stock override use the gameplay core's authored
		// source offers. Explicit world stock remains authoritative for dynamic vendors.
		if (source.stockExplicit && source.stock.length && !source.stock.includes(item.id) && parsed.kind !== 'hunt') return result(false, parsed.kind, `${source.name} does not list ${item.name}.`);
		if (parsed.kind === 'purchase') { const out = purchase(source, item); return out.ok ? result(true, parsed.kind, `Purchased ${item.name} from ${source.name}. It is now in your persistent gear.`, { receipt: out.receipt }) : result(false, parsed.kind, out.receipt?.message || 'That purchase could not be completed.', { receipt: out.receipt }); }
		if (parsed.kind === 'secure') return secure(source, item, context);
		if (parsed.kind === 'hunt') return hunt(source, item);
		return result(false, parsed.kind, 'That arms action is not available here.');
	}
	function command(text, context = {}) { return execute(parseArmsRequest(text), context); }
	function update(dt = 0, position = null) { scanClock -= Math.max(0, +dt || 0); if (position && (scanClock <= 0 || !lastPosition || distance(position, lastPosition) > 8)) { scanClock = 0.5; nearby(position); } return lastNearby; }
	return { catalog: () => catalogEntries().map(copy), state: () => copy(state), nearby, sources: () => allSources(lastPosition).map(copy), info, snapshot: info, parse: parseArmsRequest, command, execute, update, offers: (sourceId) => C.listOffers(sourceId), canAttemptTheft: (input) => C.canAttemptTheft(input) };
}

export { ARMS_CATALOG, SOURCE_CATALOG };
