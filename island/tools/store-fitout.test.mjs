// The walk-in shops fitted out for what they sell (bay/storefit.js, interiors/goods.js,
// bay/commercial.js): every trade builds, a few steps a frame, inside its walls, with stock on
// its shelves, a clerk's place behind its counter, and the marts sell food (cooking/kitchens.js).
// The cafés and restaurants laid out for how they serve (bay/dinefit.js), each with its menu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommercial } from '../src/bay/commercial.js';
import { tradeOf } from '../src/bay/storefit.js';
import { styleOf } from '../src/bay/dinefit.js';
import { venueOf } from '../src/economy/venue.js';
import { RECIPE } from '../src/cooking/recipes.js';
import { KINDS, SIGNS, stripUV, signUV, GoodsBuilder, GARMENTS, garmentAt } from '../src/interiors/goods.js';
import { shelves, menuOf, SHOPS } from '../src/cooking/kitchens.js';

const shop = (o) => { const b = { x: 12, z: 0, w: 15, d: 10, a: 0.3, wallH: 4.6, kind: 6, h: 4.6, door: 0.5, ...o }; b.grp = [b]; b.grp.biz = true; return b; };
const TYPES = ['grocer', 'hardware', 'pharmacy', 'liquor', 'bookshop', 'boutique', 'pet', 'phonefix', 'florist', 'salon', 'laundromat', 'gym', 'vet', 'gift'];

function built(b) {
	const C = createCommercial({ add() {} }, { heightAt: () => 0 }, null, { procBiz: () => [b], setNear() {} }, {});
	const cam = { position: { x: b.x, y: 2, z: b.z } };
	let frames = 0;
	while (!C.count() && frames < 200) { C.update(cam, 0.016, 12, 0); frames++; }
	return { C, frames, L: C.list()[0] };
}

test('every trade and both marts build in a few frames, stocked, inside their walls', () => {
	const cases = [shop({ store: 'fuel' }), shop({ store: 'corner', w: 16, d: 12 }), ...TYPES.map((t, i) => shop({ biz: { type: t, name: t, sign: { bg: '#c8102e', fg: '#ffffff' } }, w: 10 + (i % 4) * 5, d: 10 + (i % 3) * 5 }))];
	// (a big one open to its roof: its light strips hang at the same height, on wires)
	cases.push(shop({ biz: { type: 'grocer', name: 'big', sign: { bg: '#2a9d3f', fg: '#ffffff' } }, w: 28, d: 22, wallH: 7, h: 7 }));
	for (const b of cases) {
		const { C, frames, L } = built(b);
		const what = b.store || b.biz.type;
		assert.equal(C.count(), 1, what + ' built');
		// (a few ms a frame: a small shop on a quick machine may be done in its first)
		assert.ok(frames >= 1 && frames < 60, `${what}: built over a few frames (${frames})`);
		assert.ok(L.stocked && L.trade === (b.store ? 'mart' : tradeOf(b.biz.type)), what);
		let goods = 0;
		C.group.traverse((o) => { if (o.name === 'goods') goods += o.geometry.attributes.position.count; });
		// (a vet or a salon is mostly its rooms and its chairs: a short run of stock by the desk)
		const sells = !['gym', 'laundromat'].includes(what), least = what === 'vet' || what === 'salon' ? 150 : 300;
		if (sells) assert.ok(goods > least, `${what}: stock on its shelves (${goods})`);
		assert.ok(L.seats > 0, what + ': places to stand');
		// nothing of the fit-out lies on the floor that should hang from the ceiling
		C.group.traverse((o) => { if (o.material?.emissive?.getHex?.() === 0xfff4e0 && o.geometry?.attributes.position) { o.geometry.computeBoundingBox(); assert.ok(o.geometry.boundingBox.min.y > 0.2, what + ': a light strip on the floor'); } });
	}
});

test('the solid fittings stand inside the walls and leave the doorway clear', () => {
	for (const b of [shop({ store: 'fuel' }), shop({ store: 'corner', w: 16, d: 12 }), ...TYPES.map((t) => shop({ biz: { type: t, name: t, sign: { bg: '#123456', fg: '#ffffff' } }, w: 14, d: 14 }))]) {
		const { C } = built(b);
		const L = C.list()[0], hw = L.hw, hd = L.hd, WALL = 0.3;
		// walk in through the door and down the middle: the push keeps you out of the shelving, and
		// from just inside the door you can step in a metre
		const ca = Math.cos(b.a), sa = Math.sin(b.a), W = (lx, lz) => ({ x: b.x + ca * lx - sa * lz, z: b.z + sa * lx + ca * lz });
		const p = W(L.doorX, hd - WALL - 0.5), y = L.y;
		const q = { ...p };
		C.push(q, y);
		assert.ok(Math.hypot(q.x - p.x, q.z - p.z) < 0.05, `${b.store || b.biz.type}: the doorway is clear`);
		const p2 = W(L.doorX, hd - WALL - 1.4), q2 = { ...p2 };
		C.push(q2, y);
		assert.ok(Math.hypot(q2.x - p2.x, q2.z - p2.z) < 0.05, `${b.store || b.biz.type}: a step inside is clear`);
		void hw;
	}
});

test('a mart and a counter shop keep a place for the clerk', () => {
	for (const b of [shop({ store: 'fuel' }), shop({ biz: { type: 'pharmacy', name: 'p', sign: { bg: '#c8102e', fg: '#fff' } }, w: 16, d: 14 })]) {
		const { C } = built(b);
		const v = C.venue({ x: b.x, z: b.z }, 12);
		assert.ok(v && v.areas.length, 'people in at noon');
		assert.ok(v.areas[0].seats.some((s) => s.staff), 'a clerk\'s spot');
	}
	// the gas station's mart is open all night: someone is in at 3 am
	const { C } = built(shop({ store: 'fuel' }));
	assert.ok(C.venue({ x: 12, z: 0 }, 3), 'the all-night mart has its clerk at 3 am');
});

test('the goods sheet: every kind and sign has its place on it', () => {
	for (const k of Object.keys(KINDS)) for (let n = 0; n < 5; n++) { const [u0, v0, u1, v1] = stripUV(k, n); assert.ok(u0 >= 0 && u1 <= 1 && v0 >= 0 && v1 <= 1 && u1 > u0 && v1 > v0, k); }
	for (const s of SIGNS) { const [u0, v0, u1, v1] = signUV(s); assert.ok(u0 >= 0 && u1 <= 1 && v0 >= 0 && v1 <= 1, s); }
	// a run of stock is a few quads a bay, whatever its length
	const G = new GoodsBuilder();
	G.run('chips', 0, 12, 0.5, 0.4, 0, 0.4);
	assert.ok(G.p.length / 3 <= 10 * 12 + 12, 'a dozen metres of chips in a few quads');
	// a sign's letters keep their shape on a narrow sign
	const S = new GoodsBuilder();
	S.sign('SNACKS', 0, 0.8, 0, 0.22, 0, [1, 0, 0]);
	const xs = S.p.filter((_, i) => i % 3 === 0).slice(6), ys = S.p.filter((_, i) => i % 3 === 1).slice(6);
	const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
	assert.ok(Math.abs(w / h - 8) < 0.01, `letters 8:1 (${(w / h).toFixed(2)})`);
});

test('a clothes shop hangs its clothes: some facing out, printed, and everyone inside its walls', () => {
	// (every garment's front has its place among the garments' strips)
	for (let n = 0; n < GARMENTS.length; n++) { const [t, f0, f1] = garmentAt(n); assert.ok(t >= 0 && t < KINDS.garments && f0 >= 0 && f1 <= 1 && f1 > f0, GARMENTS[n].name); }
	const [, gv0] = stripUV('garments', 0), [, , , gv1] = stripUV('garments', KINDS.garments - 1);
	for (const [w, d] of [[13, 14], [10, 10], [18, 16], [9, 18]]) {
		const b = shop({ biz: { type: 'boutique', name: 'b', sign: { bg: '#111111', fg: '#ffffff' } }, w, d });
		const { C, L } = built(b);
		let faces = 0;
		C.group.traverse((o) => { if (o.name !== 'goods') return; const uv = o.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) if (uv.getY(i) >= gv0 - 1e-6 && uv.getY(i) <= gv1 + 1e-6 && uv.getY(i) < 1) faces++; });
		assert.ok(faces >= 4 * 6, `${w}x${d}: garments facing out (${faces / 6})`);
		const v = C.venue({ x: b.x, z: b.z }, 20), ca = Math.cos(b.a), sa = Math.sin(b.a);
		for (const q of v.areas[0].seats) {
			const dx = q.x - b.x, dz = q.z - b.z, lx = ca * dx + sa * dz, lz = -sa * dx + ca * dz;
			assert.ok(Math.abs(lx) < L.hw - 0.3 && Math.abs(lz) < L.hd - 0.3, `${w}x${d}: a place out of the shop at ${lx.toFixed(2)}, ${lz.toFixed(2)}`);
			// (and not inside a rack or a table)
			const p = { x: q.x, z: q.z };
			C.push(p, L.y);
			assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 0.05, `${w}x${d}: a place to stand inside a fitting at ${lx.toFixed(2)}, ${lz.toFixed(2)}`);
		}
	}
});

test('the marts and bottle shops sell food and drink, not fresh meat', () => {
	const mart = shelves('mart', { seed: 3 }).map((q) => q.id);
	for (const id of ['milk', 'eggs', 'bread', 'spaghetti', 'tinned-tomatoes']) assert.ok(mart.includes(id), id);
	assert.ok(!mart.some((id) => /chicken|beef|pork|lamb|salmon/.test(id) && !/stock/.test(id)), 'no fresh meat: ' + mart.join(','));
	assert.ok(SHOPS.liquor && shelves('liquor', { seed: 3 }).some((q) => q.id === 'red-wine'));
});

// the economy's cafés and restaurants (economy/establishments.js), somewhere it would put each
const DINING = { cafe: ['cafe', 'bakery', 'waffle', 'donut', 'boba', 'icecream'], restaurant: ['pasta', 'pizza', 'diner', 'burger', 'taco', 'sushi', 'ramen', 'bistro', 'pub', 'bbq', 'seafood', 'curry', 'noodles', 'tapas', 'izakaya', 'grill'] };
const diner = (venue, type, o = {}) => { const b = shop({ biz: { type, name: type, sign: { bg: '#1d3557', fg: '#ffffff' } }, ...o }); while (venueOf(b) !== venue) b.x += 7; return b; };

test('every café and restaurant builds in a few frames, laid out for how it serves', () => {
	for (const [venue, types] of Object.entries(DINING)) for (const [i, t] of types.entries()) {
		const b = diner(venue, t, { w: 9 + (i % 4) * 4, d: 10 + (i % 3) * 5, door: i % 2 ? 0.2 : 0.8 });
		const { C, frames, L } = built(b);
		assert.equal(C.count(), 1, t + ' built');
		assert.ok(frames >= 1 && frames < 60, `${t}: built over a few frames (${frames})`);
		assert.equal(L.trade, styleOf(venue, t), t);
		// (its menus and what is in its cases on the goods' sheet)
		let goods = 0;
		C.group.traverse((o) => { if (o.name === 'goods') goods += o.geometry.attributes.position.count; });
		assert.ok(goods > 20, `${t}: menus on the wall (${goods})`);
		assert.ok(L.seats > 4, `${t}: seats (${L.seats})`);
		// someone working there through its busy hours, people in to eat
		const v = C.venue({ x: b.x, z: b.z }, venue === 'cafe' ? 8.3 : 19.4);
		assert.ok(v?.areas?.[0]?.seats.some((s) => s.staff), t + ': a place for the staff');
		assert.ok(v.areas[0].seats.filter((s) => s.sit && s.table).length >= 4, t + ': places at a table');
		// the door and a few steps in left clear
		const ca = Math.cos(b.a), sa = Math.sin(b.a), W = (lx, lz) => ({ x: b.x + ca * lx - sa * lz, z: b.z + sa * lx + ca * lz });
		for (const dz of [0.5, 1.4, 2.2]) {
			const p = W(L.doorX, L.hd - 0.3 - dz), q = { ...p };
			C.push(q, L.y);
			assert.ok(Math.hypot(q.x - p.x, q.z - p.z) < 0.05, `${t}: ${dz} m inside the door is clear`);
		}
		// every place to sit or stand inside the walls
		for (const q of v.areas[0].seats) {
			const dx = q.x - b.x, dz = q.z - b.z, lx = ca * dx + sa * dz, lz = -sa * dx + ca * dz;
			assert.ok(Math.abs(lx) < L.hw - 0.3 && Math.abs(lz) < L.hd - 0.3, `${t}: a seat out of the room at ${lx.toFixed(2)}, ${lz.toFixed(2)}`);
		}
	}
});

test('a café or a restaurant serves dishes of its cuisine, priced, from the recipes', () => {
	for (const t of [...DINING.cafe, ...DINING.restaurant]) {
		const M = menuOf(t, { seed: 7 });
		for (const d of M) { assert.ok(RECIPE[d.id], t + ': ' + d.id); assert.ok(d.price >= 5 && d.price < 80, `${t}: ${d.name} at ${d.price}`); }
		if (t === 'boba' || t === 'icecream') assert.equal(M.length, 0, t + ' serves no meals');
		else assert.ok(M.length >= 1 && !M[0].out, t + ': a dish on, at least');
	}
	// the same menu all day, a different dish off another day
	assert.deepEqual(menuOf('bistro', { seed: 3, day: 100 }), menuOf('bistro', { seed: 3, day: 100 }));
});

test('a shop that sells things to carry away lists them from the gear catalog, at its own prices', async () => {
	const { ARMS_CATALOG, listOffers, ACQUISITION_SOURCES } = await import('../src/gameplay/arms.js');
	const { gearOf } = await import('../src/bay/storefit.js');
	const SRC = { supermarket: ACQUISITION_SOURCES.SUPERMARKET, outfitter: ACQUISITION_SOURCES.NPC_TRADER };
	for (const type of ['hardware', 'feed', 'pharmacy', 'pet', 'boutique', 'thrift', 'surf', 'tailor', 'gift', 'antiques', 'bait', 'bike']) {
		const G = gearOf(tradeOf(type), type);
		assert.ok(G?.stock.length, `${type} sells something`);
		const offered = new Set(listOffers(SRC[G.kind]).filter((o) => o.mode === 'purchase').map((o) => o.itemId));
		for (const id of G.stock) { assert.ok(ARMS_CATALOG[id], `${type}: ${id} in the catalog`); assert.ok(offered.has(id), `${type}: ${id} sold at a ${G.kind}`); }
	}
	// (the food shops sell their food; the outfitters and hunting posts are the economy's own sites)
	for (const type of ['grocer', 'liquor', 'bookshop', 'florist', 'salon', 'outfitter', 'huntpost']) assert.equal(gearOf(tradeOf(type), type), null, type);
	// a hardware store built: its list says what it sells
	const b = shop({ biz: { type: 'hardware', name: 'h', sign: { bg: '#e05a00', fg: '#ffffff' } }, w: 20, d: 16 });
	const { L } = built(b);
	assert.deepEqual(L.gear, gearOf('hardware', 'hardware'));
});
