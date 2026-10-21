// The caches in the armories, stations and hospitals: what is on their racks, as items of the
// game's own inventory (gameplay/arms.js), taken (looted) or brought (resupplied) through the
// same transactions a trade with a friend uses, so the wallet and the gear screen see them.
// Plain data: services/index.js keeps one for each depot near you and its panel.

import { ARMS_CATALOG } from '../gameplay/arms.js';
import { mintUid } from '../gameplay/gear-levels.js';

// what each kind of cache holds when full: [item id, how many]
export const STOCK = {
	weapons: [['warden-spark-carbine', 3], ['longwatch-sniper-rifle', 1], ['spark-cell-pack', 8], ['trail-rifle-box', 5], ['scout-rifle-box', 5], ['longwatch-round-box', 3], ['reed-arrow-quiver', 3], ['station-signal-flare', 6]],
	supply: [['field-medkit', 6], ['repair-roll', 10], ['camp-lantern', 4], ['door-brace', 3], ['hunting-net', 2], ['station-signal-flare', 4]],
	medical: [['field-medkit', 14]],
	police: [['warden-spark-carbine', 1], ['spark-cell-pack', 4], ['field-medkit', 4], ['station-signal-flare', 4]],
	fire: [['field-medkit', 5], ['station-signal-flare', 6], ['repair-roll', 6]],
};
// how long a depot's quartermaster takes to bring one of a thing back (seconds)
export const RESTOCK = 480;
// what a cache pays you for what you bring it, as a share of the item's price
export const SUPPLY_SHARE = 0.6;

const known = (id) => !!ARMS_CATALOG[id];

// a depot: id (stable, from where it stands), kind (a key of STOCK), guarded (taking from it
// is looting: the place minds)
export function createDepot(id, kind = 'supply', { guarded = true } = {}) {
	const plan = (STOCK[kind] || STOCK.supply).filter(([i]) => known(i));
	return { id: String(id), kind, guarded: !!guarded, cap: Object.fromEntries(plan), stock: Object.fromEntries(plan), clock: 0, taken: 0, brought: 0, seq: 0 };
}
export const priceOf = (itemId) => ARMS_CATALOG[itemId]?.basePrice ?? 0;
export const supplyPay = (itemId) => Math.max(1, Math.round(priceOf(itemId) * SUPPLY_SHARE));

// the transaction that hands you one of itemId from the depot (for arms.apply), and the
// depot as it will be once it has gone through; null and why when it cannot
export function takeFrom(depot, itemId, nonce = 'x') {
	if (!known(itemId)) return { ok: false, why: 'That is not a thing the game knows.' };
	if (!(depot.stock[itemId] > 0)) return { ok: false, why: 'None left on the rack.' };
	const n = depot.seq + 1, u = mintUid(`${depot.id}:${itemId}:${nonce}`, n);
	const tx = { id: `depot:${depot.id}:take:${nonce}:${n}`, kind: 'trade', peer: `depot:${depot.id}`.slice(0, 40), give: { credits: 0, items: [] }, get: { credits: 0, items: [{ u, i: itemId, l: 1, t: 0, x: 0 }] } };
	const next = { ...depot, seq: n, taken: depot.taken + 1, stock: { ...depot.stock, [itemId]: depot.stock[itemId] - 1 } };
	return { ok: true, tx, next, looted: depot.guarded };
}
// the transaction that gives one of yours (an instance { u, i, l, t, x }) to the depot for
// its pay; only what the depot keeps, and only while it has room
export function bringTo(depot, inst, nonce = 'x') {
	if (!inst || !known(inst.i)) return { ok: false, why: 'The depot has no use for that.' };
	if (!(inst.i in depot.cap)) return { ok: false, why: 'This cache does not keep that.' };
	if ((depot.stock[inst.i] || 0) >= depot.cap[inst.i] * 2) return { ok: false, why: 'The racks are full of those.' };
	const n = depot.seq + 1, pay = supplyPay(inst.i);
	const tx = { id: `depot:${depot.id}:bring:${nonce}:${n}`, kind: 'trade', peer: `depot:${depot.id}`.slice(0, 40), give: { credits: 0, items: [{ u: inst.u, i: inst.i, l: inst.l, t: inst.t, x: inst.x ?? 0 }] }, get: { credits: pay, items: [] } };
	const next = { ...depot, seq: n, brought: depot.brought + 1, stock: { ...depot.stock, [inst.i]: (depot.stock[inst.i] || 0) + 1 } };
	return { ok: true, tx, next, pay };
}
// time passing: one of whatever is short comes back each RESTOCK seconds
export function restock(depot, dt) {
	const next = { ...depot, stock: { ...depot.stock }, clock: depot.clock + Math.max(0, +dt || 0) };
	while (next.clock >= RESTOCK) {
		next.clock -= RESTOCK;
		const short = Object.keys(next.cap).filter((i) => (next.stock[i] || 0) < next.cap[i]).sort();
		if (!short.length) { next.clock = 0; break; }
		const i = short[Math.floor(next.seq + next.taken) % short.length];
		next.stock[i] = (next.stock[i] || 0) + 1;
	}
	return next;
}
export const stockList = (depot) => Object.keys(depot.cap).map((i) => ({ itemId: i, name: ARMS_CATALOG[i]?.name || i, n: depot.stock[i] || 0, cap: depot.cap[i], pay: supplyPay(i) }));
