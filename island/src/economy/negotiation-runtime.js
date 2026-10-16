// The conversational shop boundary. A resident must actually staff a registered
// shop (or be its explicit owner); being near someone else's goods is not ownership.
import { createNegotiator } from './negotiation.js';
import { mintUid } from '../gameplay/gear-levels.js';
import { payroll } from './payroll.js';
import { bank as gameBank } from './bank.js';

const DAY = 86400000;
const distance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;
const copy = value => JSON.parse(JSON.stringify(value));
export function createNegotiationRuntime({ arms, bodyKey, position, livingWorld, relationship = () => null,
  morality = () => null, structures = () => null, now = Date.now, storage, resolveSeller = null, bank = gameBank } = {}) {
  const pendingSellerReceipts = new Set();
  const book = createNegotiator({ inventory: arms, clock: now, storage });
  const sellerKey = site => 'merchant:' + mintUid(bodyKey() + ':' + site.id);
  const revision = () => Math.floor(now() / DAY); // One authored lot per item per real day.
  const uid = (site, item) => mintUid(sellerKey(site) + ':' + revision() + ':' + item);
  function sourceFor(p) {
    if (resolveSeller) return resolveSeller(p);
    if (!p?.active || p.P?.ragdoll || p.P?.dna?.child || p.P?.dna?.teen || p.P?.dna?.minor) return null;
    const at = p.M?.S?.pos, who = 'npc:' + (p.P?.dna?.seed >>> 0);
    if (!at || distance(at, position()) > 8 || Math.abs(at.y - position().y) > 3) return null;
    const all = arms.shops(at).filter(s => distance(s, at) < 30 && (!Number.isFinite(s.y) || Math.abs(s.y - at.y) < 4));
    const owned = all.find(s => s.npcId === who || s.ownerId === who);
    if (owned) return owned;
    if (p.workSpot?.work?.role !== 'vendor' && p.workContext?.role !== 'vendor') return null;
    const employer = payroll.employerOf(who);
    const employerSite = all.find(s => employer && s.economyId === employer);
    if (employerSite) return employerSite;
    // A work role alone is not authority over whichever shop happens to be
    // nearby. Only its assigned counter can act for an unregistered generated lot.
    return all.find(s => s.source === 'generated-commercial' && !s.economyId && p.workSpot && distance(s, p.workSpot) < 12 && (!Number.isFinite(s.y) || !Number.isFinite(p.workSpot.y) || Math.abs(s.y - p.workSpot.y) < 4)) || null;
  }
  function shopSituation(site) {
    const system = structures();
    const danger = !!system?.cataclysm?.();
    let damaged = false;
    system?.store?.each?.((id, rec) => {
      if (damaged || !rec || !(rec.c > 0 || rec.m?.length) || !Number.isFinite(rec.x) || !Number.isFinite(rec.z)) return;
      if (rec.worldId && rec.worldId !== bodyKey()) return;
      if (site.buildingId === id) { damaged = true; return; }
      if (!(Number.isFinite(rec.w) && rec.w > 0 && Number.isFinite(rec.d) && rec.d > 0)) return;
      // Sources can sit at a doorway instead of the building centre. Compare in
      // the building's rotated frame; an adjacent small building stays distinct.
      const angle = Number.isFinite(rec.a) ? rec.a : 0, c = Math.cos(angle), s = Math.sin(angle);
      const dx = site.x - rec.x, dz = site.z - rec.z, lx = c * dx + s * dz, lz = -s * dx + c * dz;
      if (Math.abs(lx) > rec.w / 2 + 3 || Math.abs(lz) > rec.d / 2 + 3) return;
      if (Number.isFinite(site.y) && Number.isFinite(rec.y) && Number.isFinite(rec.h) && rec.h > 0 && (site.y < rec.y - 3 || site.y > rec.y + rec.h + 3)) return;
      damaged = true;
    });
    return { danger, damaged, reason: danger ? 'The shop is closed while the local emergency is active.' : damaged ? 'The shop is closed until its damaged building has been repaired.' : 'This shop is not available right now.' };
  }
  function context(site, p = null) {
    if (!site) return null;
    const sellerId = sellerKey(site), body = bodyKey(), at = position(), rev = revision();
    const accountId = /^biz:[\w.:-]{1,60}$/.test(site.economyId || '') ? site.economyId : 'biz:' + mintUid(body + ':' + (site.economyId || site.id));
    const sheet = arms.shopSheet(site.id, at);
    const stock = (sheet?.buy || []).map(row => ({ item: { u: uid(site, row.itemId), i: row.itemId, l: 1, t: 0, x: 0 }, price: row.price, ownerId: sellerId }));
    const beneficiaryId = site.economyId || site.id;
    const tasks = (livingWorld?.servicesFor?.(beneficiaryId) || []).filter(t => t.beneficiaryId === beneficiaryId && t.worldId === body);
    const services = tasks.map(t => ({ ...t, sellerId }));
    const evidence = services.flatMap(t => {
      const e = livingWorld?.completionEvidence?.(t.id);
      // The business-to-merchant alias is the only translation. Never rewrite a
      // foreign-world, wrong-beneficiary or stale receipt into current evidence.
      return e?.verified === true && e.status === 'completed' && e.actorId === 'player' && e.serviceId === t.id && e.worldId === body && e.beneficiaryId === beneficiaryId && e.revision === t.revision
        ? [{ ...e, beneficiaryId: sellerId }] : [];
    });
    const rel = p ? relationship(p) : null;
    // Community standing is a recorded regional/world deed score, not model praise.
    const m = morality()?.world?.(body) || {};
    const score = Math.max(0, Math.min(100, ((m.honest || 0) + (m.protect || 0) + (m.mercy || 0)) / 3));
    const { danger, damaged, reason: closureReason } = shopSituation(site);
    return { buyerId: 'player', worldId: body, locationId: 'place:' + mintUid(body + ':' + site.id), worldRevision: (danger ? 1 : 0) + (damaged ? 2 : 0), closureReason,
      now: now(), inReach: distance(site, at) < 45 && (!Number.isFinite(site.y) || !Number.isFinite(at.y) || Math.abs(site.y - at.y) < 4) && (!p || distance(p.M?.S?.pos, at) < 8 && Math.abs((p.M?.S?.pos.y || 0) - (at.y || 0)) < 3),
      seller: { id: sellerId, ownerId: sellerId, accountId, revision: rev, available: !danger && !damaged && site.available !== false, stock, needs: { scarcity: .2, urgency: danger ? 1 : 0 } },
      trust: Math.max(0, Math.min(100, 35 + (rel?.trust || 0) * 5)), services, evidence,
      reputation: { score, revision: morality()?.info?.().epoch || 0 }, reputationPolicy: { threshold: 15, discountFraction: .15 } };
  }
  function current(p) { const site = sourceFor(p); return { site, ctx: context(site, p) }; }
  const displayOffer = o => o && ({ ...copy(o), itemId: o.item.i });
  function contextFor(p) {
    const { site, ctx } = current(p);
    if (!ctx) return { available: false, bodyKey: bodyKey(), stock: [], services: [], reason: 'This resident is not authorised to sell nearby shop property. Ask a shopkeeper at their counter.' };
    const pendingOffer = book.list('player').filter(o => o.sellerId === ctx.seller.id && ['quoted', 'accepted', 'prepared'].includes(o.status)).at(-1);
    return { available: ctx.seller.available, sellerId: ctx.seller.id, sellerName: site.name, bodyKey: bodyKey(),
      stock: ctx.seller.stock.filter(r => book.available(ctx.seller.id, r.item.u) || pendingOffer?.item.u === r.item.u).map(r => ({ id: r.item.i, name: arms.catalog().find(i => i.id === r.item.i)?.name || r.item.i, price: r.price })),
      services: ctx.services.map(s => ({ id: s.id, label: s.label })), pendingOffer: displayOffer(pendingOffer),
      reason: ctx.seller.available ? 'One of each listed item is available from this daily lot. Agreements use this device’s existing wallet and saved stock; service discounts require the identity that completed the work.' : ctx.closureReason };
  }
  function propose(p, intent) {
    if (!intent || !['quote', 'bargain', 'service', 'reputation'].includes(intent.kind) || (intent.amount != null && (!Number.isInteger(intent.amount) || intent.amount < 0 || intent.amount > 1000000))) return { ok: false, code: 'invalid-proposal', message: 'Use a whole, non-negative credit amount and an item this merchant actually sells.' };
    const { ctx } = current(p); if (!ctx) return { ok: false, message: contextFor(p).reason };
    const raw = { itemId: intent.itemId, strategy: intent.kind === 'service' ? 'service' : intent.kind === 'reputation' ? 'reputation' : intent.kind === 'bargain' ? 'flexible' : 'cash' };
    if (Number.isInteger(intent.amount)) raw.offeredPrice = intent.amount;
    const r = book.propose(raw, ctx); return { ...r, offer: displayOffer(r.offer) };
  }
  async function confirm(p, id) {
    const { ctx } = current(p); if (!ctx) return { ok: false, message: contextFor(p).reason };
    const r = book.confirm(id, ctx, { confirmed: true });
    if (!r.ok) return r;
    if (r.duplicate) return { ...r, offer: displayOffer(r.offer) };
    if (r.offer.condition?.kind === 'service') {
      let joined;
      try { joined = await livingWorld?.action?.(r.offer.condition.id, 'join', { agreementId: r.offer.id, rewardMode: 'discount' }); } catch { joined = { ok: false, message: 'The work source could not confirm this agreement. Your wallet is unchanged.' }; }
      if (!joined?.ok) { book.cancel(id, ctx); return { ok: false, message: joined?.message || 'That work could not be reserved. Your wallet is unchanged.' }; }
    }
    return { ...r, offer: displayOffer(r.offer) };
  }
  function settleSeller(result) {
    if (!result.ok || !result.receipt) return result;
    const receipt = result.receipt;
    let settlement;
    try { settlement = bank?.earnOnce?.(receipt.id, receipt.sellerAccountId || receipt.sellerId, receipt.credits, 'sale', 'player'); } catch { settlement = { ok: false }; }
    if (settlement?.ok) pendingSellerReceipts.delete(receipt.id); else pendingSellerReceipts.add(receipt.id);
    return { ...result, sellerSettlement: settlement?.ok ? 'saved-local' : 'pending', message: settlement?.ok ? result.message : `${result.message || 'The exchange completed.'} The merchant ledger update is pending; your item and payment are saved.` };
  }
  function recover() {
    const recovered = book.recover();
    // Completed agreement receipts survive reload and outlive short inventory
    // journals. earnOnce reconciles them without repeating the payment.
    const settlements = book.list().filter(o => o.status === 'redeemed' && o.receipt).map(o => settleSeller({ ok: true, offer: o, receipt: o.receipt }));
    return [...recovered, ...settlements];
  }
  function redeem(p, id) {
    const { ctx } = current(p); if (!ctx) return { ok: false, message: contextFor(p).reason };
    const r = settleSeller(book.redeem(id, ctx)); return { ...r, offer: displayOffer(r.offer) };
  }
  async function cancel(p, id) {
    const { ctx } = current(p); if (!ctx) return { ok: false, message: contextFor(p).reason };
    const r = book.cancel(id, ctx);
    if (r.ok && r.offer.condition?.kind === 'service' && Number.isFinite(r.offer.acceptedAt)) {
      let cleared;
      try { cleared = await livingWorld?.clearAgreement?.(r.offer.condition.id, r.offer.id); } catch { cleared = { ok: false }; }
      if (!cleared?.ok) return { ...r, ok: false, code: 'reward-release-pending', message: 'The item reservation is released. Restoring the original task reward is still pending; retry cancel to finish.', offer: displayOffer(r.offer) };
    }
    return { ...r, offer: displayOffer(r.offer) };
  }
  // Direct Buy and conversational agreements share the same finite daily lot.
  // This callback uses arms.apply (a trade), never recursively calls arms.buy.
  function purchase(site, item) {
    const ctx = context(site), r = book.propose({ itemId: item.id, strategy: 'cash' }, ctx);
    if (!r.ok) return { ...r, receipt: { message: r.message } };
    const accepted = book.confirm(r.offer.id, ctx, { confirmed: true });
    if (!accepted.ok) return { ...accepted, receipt: { message: accepted.message } };
    const result = settleSeller(book.redeem(r.offer.id, ctx));
    return { ...result, receipt: { ...result.receipt, message: result.message || '' } };
  }
  arms.setPurchasePolicy?.({ purchase, available: (site, itemId) => book.available(sellerKey(site), uid(site, itemId)) });
  // Reconcile any exchange interrupted between inventory, contract and bank saves.
  recover();
  return { contextFor, propose, confirm, redeem, cancel, info: () => ({ ...book.info(), walletScope: 'device', pendingSellerSettlements: pendingSellerReceipts.size }), recover, book };
}
