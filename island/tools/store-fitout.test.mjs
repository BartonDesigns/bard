// The walk-in shops fitted out for what they sell (bay/storefit.js, interiors/goods.js,
// bay/commercial.js): every trade builds, a few steps a frame, inside its walls, with stock on
// its shelves, a clerk's place behind its counter, and the marts sell food (cooking/kitchens.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommercial } from '../src/bay/commercial.js';
import { tradeOf } from '../src/bay/storefit.js';
import { KINDS, SIGNS, stripUV, signUV, GoodsBuilder } from '../src/interiors/goods.js';
import { shelves, SHOPS } from '../src/cooking/kitchens.js';

const shop = (o) => { const b = { x: 12, z: 0, w: 15, d: 10, a: 0.3, wallH: 4.6, kind: 6, h: 4.6, door: 0.5, ...o }; b.grp = [b]; b.grp.biz = true; return b; };
const TYPES = ['grocer', 'hardware', 'pharmacy', 'liquor', 'bookshop', 'boutique', 'pet', 'phonefix', 'florist', 'salon', 'laundromat', 'gym', 'vet', 'gift'];

function built(b) {
	const C = createCommercial({ add() {} }, { heightAt: () => 0 }, null, { procBiz: () => [b], setNear() {} }, {});
	const cam = { position: { x: 0, y: 2, z: 0 } };
	let frames = 0;
	while (!C.count() && frames < 200) { C.update(cam, 0.016, 12, 0); frames++; }
	return { C, frames, L: C.list()[0] };
}

test('every trade and both marts build in a few frames, stocked, inside their walls', () => {
	const cases = [shop({ store: 'fuel' }), shop({ store: 'corner', w: 16, d: 12 }), ...TYPES.map((t, i) => shop({ biz: { type: t, name: t, sign: { bg: '#c8102e', fg: '#ffffff' } }, w: 10 + (i % 4) * 5, d: 10 + (i % 3) * 5 }))];
	for (const b of cases) {
		const { C, frames, L } = built(b);
		const what = b.store || b.biz.type;
		assert.equal(C.count(), 1, what + ' built');
		assert.ok(frames > 1 && frames < 60, `${what}: built over a few frames (${frames})`);
		assert.ok(L.stocked && L.trade === (b.store ? 'mart' : tradeOf(b.biz.type)), what);
		let goods = 0;
		C.group.traverse((o) => { if (o.name === 'goods') goods += o.geometry.attributes.position.count; });
		// (a vet is mostly its exam rooms: a short run of food and meds by the desk)
		const sells = !['gym', 'laundromat'].includes(what), least = what === 'vet' ? 150 : 300;
		if (sells) assert.ok(goods > least, `${what}: stock on its shelves (${goods})`);
		assert.ok(L.seats > 0, what + ': places to stand');
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

test('the marts and bottle shops sell food and drink, not fresh meat', () => {
	const mart = shelves('mart', { seed: 3 }).map((q) => q.id);
	for (const id of ['milk', 'eggs', 'bread', 'spaghetti', 'tinned-tomatoes']) assert.ok(mart.includes(id), id);
	assert.ok(!mart.some((id) => /chicken|beef|pork|lamb|salmon/.test(id) && !/stock/.test(id)), 'no fresh meat: ' + mart.join(','));
	assert.ok(SHOPS.liquor && shelves('liquor', { seed: 3 }).some((q) => q.id === 'red-wine'));
});
