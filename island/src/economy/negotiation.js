// Contextual merchant agreements. The model can suggest a catalog item, price and
// an existing favour; only this validator can turn that suggestion into a quote.
// Nothing trades until an explicit confirm, and a favour must have a receipt from
// gameplay. These are LOCAL agreements; shared stock needs a server authority.
//
// inventory is the current arms runtime ({ state, apply, applied }), never a second
// copy of the player's wallet. A saved prepared agreement precedes its idempotent
// inventory transaction, so a reload between the two writes can safely recover.
import { applyInventoryTransaction, cleanTradeSide, getItem, TRANSACTION_KINDS, TRADE_MAX_CREDITS } from '../gameplay/arms.js';

export const NEGOTIATION_VERSION = 1;
export const QUOTE_MS = 5 * 60 * 1000;
export const RESERVATION_MS = 24 * 60 * 60 * 1000;
const MAX_OPEN = 128;
const STATUSES = ['quoted', 'accepted', 'prepared', 'redeemed', 'cancelled', 'expired'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const copy = (o) => JSON.parse(JSON.stringify(o));
const safeId = (s) => typeof s === 'string' && /^[a-zA-Z0-9_.:~/-]{1,180}$/.test(s) && !['__proto__', 'prototype', 'constructor'].includes(s);
const amount = (n) => Number.isInteger(n) && n >= 0 && n <= TRADE_MAX_CREDITS;
const bounded = (n, lo, hi, fallback = 0) => Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
const label = (s, fallback) => typeof s === 'string' && s.trim() ? s.trim().slice(0, 240) : fallback;
const sameItem = (a, b) => !!a && !!b && ['u', 'i', 'l', 't', 'x'].every((k) => a[k] === b[k]);
const nowOf = (ctx) => Number.isFinite(ctx?.now) && ctx.now >= 0 ? ctx.now : 0;
const err = (state, code, message, extra = {}) => ({ ok: false, state, code, message, ...extra });
const ok = (state, offer, extra = {}) => ({ ok: true, state, offer: copy(offer), ...extra });
const stockKey = (sellerId, uid) => `${sellerId}|${uid}`;
const receiptKey = (sellerId, serviceId) => `${sellerId}|${serviceId}`;

export function createNegotiationState(nonce = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`) {
	return { version: NEGOTIATION_VERSION, nonce, sequence: 0, revision: 0, offers: {}, sold: {}, usedServices: {} };
}

// Strict schema: prose, tool calls, prices-as-strings and fabricated item ids never
// reach the transaction layer. Ownership and service value come ONLY from ctx.
export function validateNegotiationProposal(raw) {
	if (typeof raw === 'string') {
		if (raw.length > 4096) return null;
		try { raw = JSON.parse(raw); } catch { return null; }
	}
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	if (Object.keys(raw).some((k) => !['itemId', 'uid', 'offeredPrice', 'strategy', 'serviceId'].includes(k))) return null;
	if (!getItem(raw.itemId)?.marketTradable) return null;
	if (raw.offeredPrice !== undefined && !amount(raw.offeredPrice)) return null;
	if (raw.uid !== undefined && (typeof raw.uid !== 'string' || !/^[a-z0-9~-]{4,24}$/.test(raw.uid))) return null;
	const strategy = raw.strategy || 'cash';
	if (!['cash', 'service', 'reputation', 'flexible'].includes(strategy)) return null;
	if (raw.serviceId !== undefined && !safeId(raw.serviceId)) return null;
	return { itemId: raw.itemId, ...(raw.uid ? { uid: raw.uid } : {}), strategy, ...(raw.offeredPrice !== undefined ? { offeredPrice: raw.offeredPrice } : {}), ...(raw.serviceId ? { serviceId: raw.serviceId } : {}) };
}

function contextError(ctx) {
	const s = ctx?.seller;
	if (!safeId(ctx?.buyerId) || !safeId(ctx?.worldId) || !safeId(ctx?.locationId) || !safeId(s?.id) || !Number.isInteger(s?.revision) || s.revision < 0 || !Number.isInteger(ctx?.worldRevision) || ctx.worldRevision < 0) return ['invalid-context', 'The current place and merchant could not be verified.'];
	if (s.ownerId !== s.id || s.id === ctx.buyerId) return ['not-owner', 'This person cannot sell that property.'];
	if (s.available === false || ctx.inReach === false) return ['unavailable', 'The merchant is not available here now.'];
	if (!Array.isArray(s.stock)) return ['no-stock', 'This person has no verified stock to offer.'];
	return null;
}
function liveRows(ctx) {
	return ctx.seller.stock.filter((row) => {
		const clean = cleanTradeSide({ credits: 0, items: [row?.item] });
		return row?.ownerId === ctx.seller.id && amount(row.price) && row.price > 0 && clean?.items.length === 1 && sameItem(clean.items[0], row.item) && row.available !== false;
	});
}
function reservedBy(state, sellerId, uid, now, except = '') {
	return Object.values(state.offers).find((o) => o.id !== except && o.sellerId === sellerId && o.item.u === uid && (o.status === 'prepared' || o.status === 'accepted' && o.reservedUntil > now));
}
function serviceHeld(state, sellerId, serviceId, now, except = '') {
	return Object.values(state.offers).find((o) => o.id !== except && o.sellerId === sellerId && o.condition?.kind === 'service' && o.condition.id === serviceId && (o.status === 'prepared' || o.status === 'accepted' && o.reservedUntil > now));
}
function availableService(service, ctx, state) {
	return safeId(service?.id) && service.sellerId === ctx.seller.id && service.worldId === ctx.worldId && service.status === 'open' && amount(service.creditValue) && service.creditValue > 0 && Number.isInteger(service.revision) && service.revision >= 0 && Number.isFinite(service.expiresAt) && service.expiresAt > nowOf(ctx) && (!service.assigneeId || service.assigneeId === ctx.buyerId) && !own(state.usedServices, receiptKey(ctx.seller.id, service.id)) && !serviceHeld(state, ctx.seller.id, service.id, nowOf(ctx));
}
function floorFor(price, ctx) {
	const trust = bounded(ctx.trust, 0, 100, 50), scarcity = bounded(ctx.seller.needs?.scarcity, 0, 1), urgency = bounded(ctx.seller.needs?.urgency, 0, 1);
	const basisPoints = Math.round(bounded(0.92 - trust * 0.002 + scarcity * 0.15 - urgency * 0.08, 0.65, 1) * 10000);
	return Math.max(1, Math.ceil(price * basisPoints / 10000));
}
function evolve(state, offer, extras = {}) {
	return { ...state, ...extras, revision: state.revision + 1, offers: { ...state.offers, [offer.id]: offer } };
}

export function proposeNegotiation(state, raw, ctx) {
	const p = validateNegotiationProposal(raw);
	if (!p) return err(state, 'invalid-proposal', 'That is not a valid offer for an item this game knows.');
	const bad = contextError(ctx); if (bad) return err(state, ...bad);
	const now = nowOf(ctx), seller = ctx.seller;
	if (Object.values(state.offers).filter((o) => ['quoted', 'accepted', 'prepared'].includes(o.status) && (o.status === 'prepared' || Math.max(o.expiresAt, o.reservedUntil || 0) > now)).length >= MAX_OPEN) return err(state, 'too-many-offers', 'Finish or cancel an earlier agreement first.');
	const row = liveRows(ctx).find((r) => r.item.i === p.itemId && (!p.uid || r.item.u === p.uid) && !own(state.sold, stockKey(seller.id, r.item.u)) && !reservedBy(state, seller.id, r.item.u, now));
	if (!row) return err(state, 'out-of-stock', 'This merchant does not own an available copy of that item.');
	const askingPrice = row.price, floor = floorFor(askingPrice, ctx);
	const requested = p.offeredPrice ?? askingPrice;
	let price = Math.min(askingPrice, Math.max(requested, floor)), kind = 'cash', condition = null;
	const wantsAlternative = p.strategy === 'service' || requested < floor || p.strategy === 'flexible' && p.offeredPrice === undefined;
	if (wantsAlternative) {
		const services = (ctx.services || []).filter((s) => availableService(s, ctx, state) && (!p.serviceId || s.id === p.serviceId)).sort((a, b) => b.creditValue - a.creditValue || a.id.localeCompare(b.id));
		const s = services[0];
		if (s) {
			const serviceFloor = Math.max(1, floor - s.creditValue);
			price = Math.min(askingPrice, Math.max(p.offeredPrice ?? serviceFloor, serviceFloor));
			kind = 'service';
			condition = { kind, id: s.id, label: label(s.label, 'Complete this existing favour'), revision: s.revision, creditValue: s.creditValue, expiresAt: s.expiresAt };
		}
	}
	if (!condition && (p.strategy === 'reputation' || wantsAlternative) && ctx.reputationPolicy) {
		const policy = ctx.reputationPolicy;
		if (Number.isFinite(policy.threshold) && policy.threshold >= 0 && policy.threshold <= 100 && Number.isFinite(policy.discountFraction) && policy.discountFraction > 0 && policy.discountFraction <= 0.4) {
			const reputationFloor = Math.max(1, Math.ceil(floor * (1 - policy.discountFraction)));
			price = Math.min(askingPrice, Math.max(p.offeredPrice ?? reputationFloor, reputationFloor));
			kind = 'reputation';
			condition = { kind, threshold: policy.threshold, label: `Reach ${policy.threshold} local reputation with this community` };
		}
	}
	const id = `deal:${state.nonce}:${state.sequence + 1}`;
	const offer = { id, sellerId: seller.id, sellerAccountId: safeId(seller.accountId) ? seller.accountId : seller.id, buyerId: ctx.buyerId, worldId: ctx.worldId, locationId: ctx.locationId, worldRevision: ctx.worldRevision, sellerRevision: seller.revision, item: copy(row.item), itemName: getItem(p.itemId).name, askingPrice, floor, offeredPrice: requested, price, kind, condition, status: 'quoted', createdAt: now, expiresAt: now + QUOTE_MS, requiresConfirmation: true, explanation: condition?.kind === 'service' ? `Complete “${condition.label}”, then pay ${price} credits. The item stays reserved while that agreement is active.` : condition?.kind === 'reputation' ? `${condition.label}, then pay ${price} credits.` : requested < floor ? `My current cash price is ${price} credits; I cannot sell it for ${requested}.` : `${price} credits for this item.` };
	return ok(evolve(state, offer, { sequence: state.sequence + 1 }), offer, { message: offer.explanation });
}

function currentOfferError(state, offer, ctx, confirming = false) {
	const bad = contextError(ctx); if (bad) return bad;
	if (offer.buyerId !== ctx.buyerId || offer.sellerId !== ctx.seller.id) return ['wrong-person', 'This agreement belongs to a different buyer or merchant.'];
	if (offer.worldId !== ctx.worldId || offer.locationId !== ctx.locationId) return ['wrong-place', 'Return to the merchant and place where this was agreed.'];
	if (offer.worldRevision !== ctx.worldRevision || offer.sellerRevision !== ctx.seller.revision) return ['stale-offer', 'The place or merchant has changed. Ask for a fresh quote.'];
	const row = liveRows(ctx).find((r) => sameItem(r.item, offer.item));
	if (!row || row.price !== offer.askingPrice || own(state.sold, stockKey(offer.sellerId, offer.item.u))) return ['stock-changed', 'That exact item or its ownership has changed. Ask for a fresh quote.'];
	if (reservedBy(state, offer.sellerId, offer.item.u, nowOf(ctx), offer.id)) return ['reserved', 'That item is reserved by another agreement.'];
	if (offer.condition?.kind === 'service') {
		const c = offer.condition, s = (ctx.services || []).find((x) => x.id === c.id);
		if (!s || s.sellerId !== offer.sellerId || s.worldId !== offer.worldId || s.revision !== c.revision || s.creditValue !== c.creditValue || s.expiresAt !== c.expiresAt || ['cancelled', 'failed', 'expired'].includes(s.status) || (s.assigneeId && s.assigneeId !== offer.buyerId)) return ['service-changed', 'The promised favour has changed or belongs to someone else.'];
		if (confirming && s.status !== 'open') return ['service-changed', 'That favour is no longer available.'];
		if (nowOf(ctx) >= c.expiresAt) return ['service-expired', 'That favour is no longer available.'];
		if (own(state.usedServices, receiptKey(offer.sellerId, c.id)) || serviceHeld(state, offer.sellerId, c.id, nowOf(ctx), offer.id)) return ['service-used', 'That favour already backs another agreement.'];
	}
	return null;
}

export function confirmNegotiation(state, id, ctx, { confirmed = false } = {}) {
	const offer = state.offers[id];
	if (!offer) return err(state, 'unknown-offer', 'There is no such quote.');
	if (confirmed !== true) return err(state, 'confirmation-required', 'Review the terms and confirm this agreement explicitly.');
	if (offer.buyerId !== ctx?.buyerId) return err(state, 'wrong-person', 'This agreement belongs to a different buyer.');
	if (['accepted', 'prepared', 'redeemed'].includes(offer.status)) return ok(state, offer, { duplicate: true });
	if (offer.status !== 'quoted') return err(state, 'closed-offer', 'That quote is no longer open.');
	if (nowOf(ctx) >= offer.expiresAt) return err(state, 'expired-offer', 'That quote expired. Ask for a fresh one.');
	const bad = currentOfferError(state, offer, ctx, true); if (bad) return err(state, ...bad);
	const accepted = { ...offer, status: 'accepted', acceptedAt: nowOf(ctx), reservedUntil: Math.min(nowOf(ctx) + RESERVATION_MS, offer.condition?.expiresAt ?? Infinity), requiresConfirmation: false };
	return ok(evolve(state, accepted), accepted, { message: offer.condition ? 'Agreement accepted. Complete the condition, then return to collect.' : 'Agreement accepted. Ready to exchange.' });
}

function fulfillmentError(offer, ctx) {
	const c = offer.condition; if (!c) return null;
	if (c.kind === 'reputation') return Number.isFinite(ctx.reputation?.score) && ctx.reputation.score >= c.threshold ? null : ['reputation-required', `This agreement requires ${c.threshold} local reputation.`];
	const e = (ctx.evidence || []).find((r) => safeId(r?.id) && r.verified === true && r.status === 'completed' && r.rewardMode === 'discount' && r.agreementId === offer.id && r.serviceId === c.id && r.revision === c.revision && r.actorId === offer.buyerId && r.beneficiaryId === offer.sellerId && r.worldId === offer.worldId && Number.isFinite(r.completedAt) && r.completedAt >= offer.acceptedAt && r.completedAt <= nowOf(ctx));
	return e ? null : ['evidence-required', 'The game has not recorded you completing this agreed favour. Saying it is done does not complete it.'];
}

// Preview both the authoritative condition checks and the existing inventory API.
// The caller must persist this prepared state before applying transaction.
export function prepareNegotiation(state, id, ctx, inventory) {
	const offer = state.offers[id];
	if (!offer) return err(state, 'unknown-offer', 'There is no such agreement.');
	if (offer.buyerId !== ctx?.buyerId || inventory?.ownerId !== offer.buyerId) return err(state, 'wrong-person', 'This agreement belongs to a different buyer.');
	if (offer.status === 'redeemed') return ok(state, offer, { duplicate: true });
	if (!['accepted', 'prepared'].includes(offer.status)) return err(state, 'confirmation-required', 'Confirm the agreement before collecting the item.');
	if (nowOf(ctx) >= offer.reservedUntil) return err(state, 'reservation-expired', 'The reservation expired. Ask for a fresh quote.');
	const bad = currentOfferError(state, offer, ctx); if (bad) return err(state, ...bad);
	const unmet = fulfillmentError(offer, ctx); if (unmet) return err(state, ...unmet);
	if (inventory.instances?.[offer.item.u]) return err(state, 'item-conflict', 'This item is already in the buyer inventory; no duplicate will be created.');
	const transaction = { id: `negotiation:${offer.id}`, kind: TRANSACTION_KINDS.TRADE, peer: offer.sellerId, at: nowOf(ctx), give: { credits: offer.price, items: [] }, get: { credits: 0, items: [copy(offer.item)] } };
	const preview = applyInventoryTransaction(inventory, transaction, { expectedRevision: inventory.revision });
	if (!preview.ok || preview.duplicate) return err(state, preview.receipt?.code || 'inventory-changed', preview.receipt?.message || 'The inventory receipt needs recovery before this agreement can continue.');
	const prepared = { ...offer, status: 'prepared', transaction, preparedAt: nowOf(ctx) };
	return ok(evolve(state, prepared), prepared, { transaction, inventory: preview.state, message: 'Ready to exchange the agreed payment and item.' });
}

// An applied inventory receipt is the only evidence used to settle an exchange.
export function finishNegotiation(state, id, applied, at = 0) {
	const offer = state.offers[id];
	if (!offer || !['prepared', 'redeemed'].includes(offer.status)) return err(state, 'not-prepared', 'There is no prepared exchange to settle.');
	if (offer.status === 'redeemed') return ok(state, offer, { duplicate: true });
	if (applied !== true) return err(state, 'inventory-unconfirmed', 'The payment and item have not both been saved.');
	const receipt = { id: offer.transaction.id, sellerId: offer.sellerId, sellerAccountId: offer.sellerAccountId || offer.sellerId, buyerId: offer.buyerId, itemUid: offer.item.u, itemId: offer.item.i, credits: offer.price, worldId: offer.worldId, at };
	const redeemed = { ...offer, status: 'redeemed', redeemedAt: at, receipt };
	const sold = { ...state.sold, [stockKey(offer.sellerId, offer.item.u)]: id };
	const usedServices = offer.condition?.kind === 'service' ? { ...state.usedServices, [receiptKey(offer.sellerId, offer.condition.id)]: id } : state.usedServices;
	return ok(evolve(state, redeemed, { sold, usedServices }), redeemed, { receipt, message: `Received ${offer.itemName} for ${offer.price} credits.` });
}

export function cancelNegotiation(state, id, ctx) {
	const offer = state.offers[id];
	if (!offer || offer.buyerId !== ctx?.buyerId) return err(state, 'unknown-offer', 'There is no such agreement for you.');
	if (offer.status === 'cancelled') return ok(state, offer, { duplicate: true });
	if (offer.status === 'prepared') return err(state, 'exchange-pending', 'The pending exchange must recover before it can be cancelled.');
	if (offer.status === 'redeemed') return err(state, 'already-redeemed', 'That exchange already completed.');
	return ok(evolve(state, { ...offer, status: 'cancelled' }), { ...offer, status: 'cancelled' }, { message: 'Agreement cancelled; its reservation is released.' });
}

function validSave(raw) {
	if (!raw || raw.version !== NEGOTIATION_VERSION || !safeId(raw.nonce) || !Number.isSafeInteger(raw.sequence) || raw.sequence < 0 || !Number.isSafeInteger(raw.revision) || !raw.offers || !raw.sold || !raw.usedServices || [raw.offers, raw.sold, raw.usedServices].some((map) => typeof map !== 'object' || Array.isArray(map))) return false;
	for (const [id, o] of Object.entries(raw.offers)) {
		if (!o || id !== o.id || !safeId(id) || !STATUSES.includes(o.status) || !safeId(o.buyerId) || !safeId(o.sellerId) || !safeId(o.worldId) || !safeId(o.locationId) || !amount(o.price) || !amount(o.askingPrice) || !Number.isFinite(o.expiresAt) || !cleanTradeSide({ credits: 0, items: [o.item] })) return false;
		if (['accepted', 'prepared', 'redeemed'].includes(o.status) && !Number.isFinite(o.reservedUntil)) return false;
		if (o.condition && !['service', 'reputation'].includes(o.condition.kind)) return false;
		if (o.condition?.kind === 'service' && (!safeId(o.condition.id) || !Number.isInteger(o.condition.revision) || o.condition.revision < 0 || !amount(o.condition.creditValue) || !Number.isFinite(o.condition.expiresAt))) return false;
		if (o.condition?.kind === 'reputation' && (!Number.isFinite(o.condition.threshold) || o.condition.threshold < 0 || o.condition.threshold > 100)) return false;
		if (o.status === 'redeemed' && (!o.receipt || o.receipt.id !== `negotiation:${id}` || o.receipt.sellerId !== o.sellerId || o.receipt.buyerId !== o.buyerId || o.receipt.credits !== o.price || o.receipt.itemUid !== o.item.u || raw.sold[stockKey(o.sellerId, o.item.u)] !== id)) return false;
		if (o.status === 'redeemed' && o.condition?.kind === 'service' && raw.usedServices[receiptKey(o.sellerId, o.condition.id)] !== id) return false;
		if (o.status === 'prepared') {
			const t = o.transaction;
			if (t?.id !== `negotiation:${id}` || t.kind !== TRANSACTION_KINDS.TRADE || t.peer !== o.sellerId || t.give?.credits !== o.price || t.give?.items?.length !== 0 || t.get?.credits !== 0 || t.get?.items?.length !== 1 || !sameItem(t.get.items[0], o.item)) return false;
		}
	}
	return true;
}

/** Runtime contract:
 * propose({itemId,offeredPrice?,strategy?,serviceId?}, context)
 * confirm(id, context, {confirmed:true}) — wire ONLY to an explicit UI action.
 * redeem(id, context) — conditions come from current gameplay, never dialogue.
 * Context contains current buyer/world/location/revisions and seller-owned stock,
 * services and verified completion receipts; see tests for concrete descriptors.
 * inventory.apply must return {ok,persisted}, and applied(id) only checks the same
 * inventory. Storage failure closes trading rather than forgetting sold stock.
 */
export function createNegotiator({ storage, key = 'crysis-negotiation-v1', clock = () => Date.now(), inventory } = {}) {
	let state = createNegotiationState(), stored = null, blocked = null;
	try {
		if (!storage?.getItem || !storage?.setItem) blocked = 'Agreements need working save storage before any exchange.';
		else {
			stored = storage.getItem(key);
			if (stored) { const parsed = JSON.parse(stored); if (!validSave(parsed)) throw Error('invalid agreement save'); state = parsed; }
		}
	} catch { blocked = 'The agreement save could not be read. Existing agreements were left untouched.'; }
	const context = (ctx) => ({ ...ctx, now: clock() });
	const failure = (code, message) => ({ ok: false, code, message });
	function save(next) {
		if (blocked) return failure('storage-unavailable', blocked);
		try {
			// Reject another tab's changes rather than overwrite its reservation.
			if (storage.getItem(key) !== stored) return failure('save-conflict', 'Another game session changed these agreements. Reload before trading.');
			const serialized = JSON.stringify(next);
			storage.setItem(key, serialized);
			stored = serialized; state = next;
			return { ok: true };
		} catch { return failure('save-failed', 'The agreement could not be saved. The exchange remains pending.'); }
	}
	function publish(result) {
		if (!result.ok) { const out = { ...result }; delete out.state; return out; }
		if (result.state !== state) { const saved = save(result.state); if (!saved.ok) return saved; }
		const out = { ...result }; delete out.state; delete out.inventory; return out;
	}
	function finish(id) {
		const offer = state.offers[id];
		const out = finishNegotiation(state, id, inventory?.applied?.(offer?.transaction?.id) === true, clock());
		return publish(out);
	}
	function recoverOne(id) {
		const offer = state.offers[id];
		if (offer?.status !== 'prepared') return failure('not-prepared', 'No pending exchange.');
		if (!inventory?.applied?.(offer.transaction.id)) return { ok: false, code: 'unapplied', message: 'The reserved exchange needs its current merchant context before retrying.' };
		// apply the same id once more to flush an inventory write that previously
		// failed. arms.apply reports persistence separately from in-memory success.
		let applied;
		try { applied = inventory.apply(offer.transaction); } catch { return failure('inventory-unavailable', 'The saved inventory could not be recovered yet.'); }
		if (!applied?.ok || applied.persisted === false) return failure('inventory-save-pending', 'The item and payment are awaiting an inventory save.');
		return finish(id);
	}
	function consumeStock(sellerId, uid, receipt) {
		if (blocked) return failure('storage-unavailable', blocked);
		if (!safeId(sellerId) || !/^[a-z0-9~-]{4,24}$/.test(uid || '') || !safeId(receipt?.id) || receipt.accepted !== true || receipt.kind !== TRANSACTION_KINDS.PURCHASE || !getItem(receipt.itemId) || receipt.quantity !== 1) return failure('invalid-receipt', 'A saved purchase receipt is required to consume merchant stock.');
		const stock = stockKey(sellerId, uid);
		if (own(state.sold, stock)) return state.sold[stock] === receipt.id ? { ok: true, duplicate: true } : failure('stock-changed', 'That stock was already sold.');
		if (reservedBy(state, sellerId, uid, clock())) return failure('reserved', 'That stock is reserved by another agreement.');
		return save({ ...state, revision: state.revision + 1, sold: { ...state.sold, [stock]: receipt.id } });
	}
	function redeem(id, ctx) {
		if (blocked) return failure('storage-unavailable', blocked);
		if (!inventory?.state || !inventory?.apply || !inventory?.applied) return failure('inventory-unavailable', 'The current player inventory is unavailable.');
		const existing = state.offers[id];
		if (existing?.buyerId !== ctx?.buyerId) return failure('wrong-person', 'This agreement belongs to a different buyer.');
		if (existing?.status === 'redeemed') return { ok: true, duplicate: true, offer: copy(existing), receipt: copy(existing.receipt) };
		if (existing?.status === 'prepared' && inventory.applied(existing.transaction.id)) return recoverOne(id);
		const result = prepareNegotiation(state, id, context(ctx), inventory.state());
		if (!result.ok) return publish(result);
		const prepared = publish(result); if (!prepared.ok) return prepared;
		let applied;
		try { applied = inventory.apply(result.transaction); } catch { return failure('inventory-unavailable', 'The inventory could not be saved; this agreement remains reserved.'); }
		if (!applied?.ok) return failure('inventory-rejected', applied?.message || 'The inventory changed before the exchange. No exchange was completed.');
		if (applied.persisted === false) return failure('inventory-save-pending', 'The item and payment are awaiting an inventory save.');
		return finish(id);
	}
	return {
		propose: (proposal, ctx) => blocked ? failure('storage-unavailable', blocked) : publish(proposeNegotiation(state, proposal, context(ctx))),
		confirm: (id, ctx, options) => blocked ? failure('storage-unavailable', blocked) : publish(confirmNegotiation(state, id, context(ctx), options)),
		cancel: (id, ctx) => publish(cancelNegotiation(state, id, context(ctx))),
		redeem, consumeStock,
		reserved: (sellerId, uid) => { const found = reservedBy(state, sellerId, uid, clock()); return found ? copy(found) : null; },
		recover: () => blocked ? [failure('storage-unavailable', blocked)] : Object.values(state.offers).filter((o) => o.status === 'prepared').map((o) => ({ id: o.id, ...recoverOne(o.id) })),
		list: (buyerId = null) => Object.values(state.offers).filter((o) => !buyerId || o.buyerId === buyerId).map(copy),
		available: (sellerId, uid) => !blocked && !own(state.sold, stockKey(sellerId, uid)) && !reservedBy(state, sellerId, uid, clock()),
		snapshot: () => copy(state),
		info: () => ({ version: NEGOTIATION_VERSION, scope: 'local', blocked, revision: state.revision, agreements: Object.keys(state.offers).length }),
	};
}
