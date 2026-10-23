// The storefronts and the working day (src/economy/frontage.js, daily-life.js; the fit-outs in
// src/interiors/estab-fit.js; a house that is a business in src/bay/houseplan.js; the money's
// word for wealth in src/people/npc-money.js): every kind of business has a front, hours and a
// fit-out; shops shut and roll their shutters down at night while the bars stay lit; the glass
// and the fascia fit the facade; the coast is found from a ring of samples; the waterfront
// gets its fishing trades; the fit-outs place their things inside their rooms; a house that is
// a café has a counter and a kitchen; a household's stated wealth follows the bank's standing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, profileOf, hoursOf, within, stateAt, frontSpec, fasciaOf, gapRoom, postsFor, shiftOf, phaseOf, lifeAt, coastScan, coastClass, DISPLAY } from '../src/economy/frontage.js';
import { TYPES, planTown, hashAt } from '../src/economy/establishments.js';
import { fitFront, fitBack, houseRoles, BACK } from '../src/interiors/estab-fit.js';
import { planHouse } from '../src/bay/houseplan.js';
import { wealthOf, wealthOfStanding, createMoney } from '../src/people/npc-money.js';
import { createDailyLife } from '../src/economy/daily-life.js';

const at = (type, x = 10, z = 20, setting = 'main') => ({ type, x, z, setting });

test('every kind of business has a front, a display, hours and (where it has rooms) a fit-out', () => {
	for (const id of Object.keys(TYPES)) {
		const p = PROFILES[id];
		assert.ok(p, 'no profile for ' + id);
		assert.ok(['glass', 'office', 'lodging', 'bays', 'home', 'none'].includes(p.style), id + ' style');
		assert.ok(Number.isFinite(p.d) && p.d >= 0 && p.d <= Math.max(...Object.values(DISPLAY)), id + ' display');
		assert.ok(p.h[1] > p.h[0], id + ' hours');
		if (p.fit) assert.ok(typeof p.fit === 'string', id + ' fit');
	}
	assert.equal(profileOf('nonsense').style, 'none');
});

test('hours: within wraps past midnight; a street does not all open at once', () => {
	assert.ok(within(23.5, 11, 25) && within(0.5, 11, 25) && !within(1.5, 11, 25) && !within(10, 11, 25));
	assert.ok(within(12, 0, 24) && within(3, 0, 24));
	const opens = new Set();
	for (let i = 0; i < 40; i++) opens.add(hoursOf(at('cafe', i * 13.7, i * 7.1))[0]);
	assert.ok(opens.size >= 2, 'jittered openings');
	for (let i = 0; i < 40; i++) { const [o, c] = hoursOf(at('bookshop', i * 5, i * 3)); assert.ok(o >= 9.75 && o <= 10.25 && c >= 18.75 && c <= 19.25); }
});

test('shops shut at night (shutters down), bars stay lit late, offices shut at weekends, laundromats keep a light', () => {
	const st = (E, h, dow = 3) => stateAt(E, h, dow, {});
	const hw = at('hardware', 3, 4);
	assert.equal(st(hw, 12).open, true);
	assert.equal(st(hw, 12).shutter, 0);
	assert.equal(st(hw, 23).open, false);
	assert.equal(st(hw, 23).shutter, 1);
	assert.equal(st(hw, 2).lit, 0);
	// the shutter rolls: up before opening, down after closing, over a few minutes
	const [o, c] = hoursOf(hw);
	assert.ok(st(hw, c + 0.5).shutter > 0 && st(hw, c + 0.5).shutter < 1);
	assert.equal(st(hw, o - 0.1).shutter, 0);
	assert.equal(st(hw, c + 0.3).phase, 'closing');
	const pub = at('pub', 7, 9);
	assert.equal(st(pub, 23.5).open, true);
	assert.equal(st(pub, 0.5).open, true);
	assert.equal(st(pub, 23.5).lit, 1);
	assert.equal(st(pub, 23.5).shutter, 0);
	const law = at('law', 1, 2, 'downtown');
	assert.equal(st(law, 11, 3).open, true);
	assert.equal(st(law, 11, 0).open, false);
	assert.equal(st(law, 11, 6).open, false);
	assert.ok(st(at('laundromat'), 2).lit >= 0.5);
	assert.equal(st(at('bnb'), 3).open, true);
	// a workshop's bay doors come down when it shuts
	assert.equal(st(at('autorepair', 5, 5), 22).shutter, 1);
	// (no garbage: the same object filled)
	const out = {};
	assert.equal(stateAt(hw, 12, 3, out), out);
});

test('the glazing and the fascia fit the facade', () => {
	for (const run of [6, 8, 11, 15, 24]) for (const wallH of [2.8, 3.1, 5.6]) {
		const s = frontSpec('house', run, wallH, 'glass');
		if (!s) continue;
		assert.ok(s.w <= run - 1.39 && s.w >= 2.2, `house glass ${s.w} on ${run}`);
		assert.ok(s.y1 <= wallH - 0.74 && s.y1 > s.y0, 'under the eaves');
		const f = fasciaOf(s);
		if (f) { assert.ok(f.y + f.h / 2 <= s.fascia + 0.01, 'fascia under the wall top'); assert.ok(f.y - f.h / 2 >= s.y1, 'fascia over the glass'); assert.ok(f.w <= s.w + 1e-9 && f.h >= 0.36); }
	}
	const row = frontSpec('row', 7.6, 9, 'glass');
	assert.ok(row && row.y1 === 3.3 && row.fascia === 4.15 && row.w === 7.1);
	const rf = fasciaOf(row);
	assert.ok(rf.y - rf.h / 2 >= 3.3 && rf.y + rf.h / 2 <= 4.16);
	assert.equal(frontSpec('house', 10, 3, 'lodging'), null);
	assert.equal(frontSpec('house', 10, 3, 'home'), null);
	assert.ok(frontSpec('retail', 80, 8, 'glass').w <= 22);
	assert.equal(frontSpec('office', 30, 12, 'glass'), null);
	const of = frontSpec('house', 10, 3, 'office');
	assert.ok(of.kind === 'office' && of.w <= 3.2);
	// the pavement's room: a front garden keeps its path, a pavement its walking width
	assert.equal(gapRoom(2.0, 'shop'), 0.7);
	assert.ok(Math.abs(gapRoom(6, 'shop') - 4.2) < 1e-9);
	assert.equal(gapRoom(NaN, 'house'), 3.7);
	assert.ok(gapRoom(30, 'house') <= 6.5);
});

test('the staff out front and the working day', () => {
	assert.equal(postsFor(at('autorepair'))[0].x, 'car');
	assert.equal(postsFor(at('outfitter'))[0].x, 'boat');
	assert.equal(postsFor(at('cafe'))[0].role, 'server');
	assert.equal(postsFor(at('tech')).length, 0);
	const E = at('bakery', 4, 4), S = shiftOf(E, 77), [o, c] = hoursOf(E);
	assert.ok(S.start < o && S.end > o + 6 && S.end <= c + 0.7 && S.end - S.start <= 10.01 && S.lunch > S.start && S.lunchEnd < S.end);
	void c;
	assert.equal(phaseOf(S, S.start - 0.3), 'arriving');
	assert.equal(phaseOf(S, (S.start + S.lunch) / 2), 'work');
	assert.equal(phaseOf(S, S.lunch + 0.1), 'lunch');
	assert.equal(phaseOf(S, S.end + 0.3), 'leaving');
	assert.equal(phaseOf(S, 23), 'home');
	const allDay = shiftOf(at('bnb'), 5);
	assert.ok(allDay.end - allDay.start <= 10);
	const m = lifeAt(8.1), n = lifeAt(12.6), e = lifeAt(17.6), late = lifeAt(3);
	assert.ok(m.commuteIn > 0.5 && m.commuteOut === 0);
	assert.ok(n.lunch > 0.3 && n.commuteIn === 0);
	assert.ok(e.commuteOut > 0.45);
	assert.ok(late.commuteIn === 0 && late.lunch === 0 && late.shop < 0.1);
	assert.ok(lifeAt(8.1, true).commuteIn < m.commuteIn);
});

test('the coast from rings of samples: waterfront, harbour, near, inland; dry land rejected quickly', () => {
	// the sea east of x = 500 (heights below nought), land rising west of it
	let calls = 0;
	const H = (x) => { calls++; return x > 500 ? -5 : 2 + (500 - x) * 0.01; };
	const a = coastScan(H, 420, 0, 0.1);
	assert.ok(a.dist <= 120 && a.dx > 0.9, 'waterfront, the sea to the east');
	assert.equal(coastClass(a), 3);
	assert.equal(coastClass(coastScan(H, 100, 0, 0.1)), 2);
	assert.equal(coastClass(coastScan(H, -600, 0, 0.1)), 1);
	assert.equal(coastClass(coastScan(H, -5000, 0, 0.1)), 0);
	calls = 0; coastScan(H, -5000, 0, 0.1);
	assert.ok(calls <= 25, 'inland is two rings and done: ' + calls);
	// high ground is never the waterfront
	assert.equal(coastScan(() => 80, 0, 0, 0.1).dist, Infinity);
});

test('the waterfront gets its fishing trades; inland streets do not', () => {
	// (a terrace's shopfronts on a corner or collector: a neighbourhood's houses are homes, by the
	// water or not, economy.test.mjs)
	const row = (shore) => { const out = []; for (let i = 0; i < 400; i++) out.push({ x: i * 13.3, z: shore * 1000 + (i % 7) * 31, w: 9, d: 8, a: 0, h: 3, use: 'row', street: 1, coast: shore >= 2, shore, rural: false, wild: false, down: 0 }); return out; };
	const count = (shore) => planTown(row(shore)).filter((E) => ['outfitter', 'bait', 'fishmarket', 'boatyard', 'seafood', 'surf'].includes(E.type)).length;
	const front = count(3), inland = count(0), near = count(1);
	assert.ok(front > 40, 'waterfront fishing trades: ' + front);
	assert.equal(inland, 0);
	assert.ok(near > 0 && near < front, 'a few near the coast: ' + near);
});

// a fake room and its helpers, as the furnishers give them
function fakeK(x0, z0, x1, z1, extra = {}) {
	const items = [], placed = [], seats = [], anchors = [];
	let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	const inside = (b) => b[0] >= x0 - 0.01 && b[2] <= x1 + 0.01 && b[1] >= z0 - 0.01 && b[3] <= z1 + 0.01;
	const hit = (b) => placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1]);
	const sides = [['x', z0, 1, x0, x1], ['x', z1, -1, x0, x1, true], ['z', x0, 1, z0, z1], ['z', x1, -1, z0, z1]].map(([axis, pos, n, s0, e, ext]) => ({ axis, pos, n, s: s0, e, ext: !!ext, walled: true, open: ext ? [{ s0: (x0 + x1) / 2 - 0.5, s1: (x0 + x1) / 2 + 0.5, type: 'front' }] : [] }));
	const against = (type, w, d, h, opt = {}) => {
		for (const sd of sides) {
			if (opt.side && !opt.side(sd)) continue;
			for (let c = sd.s + w / 2 + 0.1; c <= sd.e - w / 2 - 0.1; c += 0.25) {
				if (sd.open.some((o) => c + w / 2 > o.s0 - 0.1 && c - w / 2 < o.s1 + 0.1)) continue;
				const f0 = sd.pos, f1 = sd.pos + sd.n * d;
				const box = sd.axis === 'x' ? [c - w / 2, Math.min(f0, f1), c + w / 2, Math.max(f0, f1)] : [Math.min(f0, f1), c - w / 2, Math.max(f0, f1), c + w / 2];
				if (!inside(box) || hit(box)) continue;
				placed.push(box);
				const it = { type, x: (box[0] + box[2]) / 2, z: (box[1] + box[3]) / 2, rot: sd.axis === 'x' ? (sd.n > 0 ? 0 : 2) : (sd.n > 0 ? 1 : 3), w, d, h, side: sd, c, box, y: 0, v: rnd() };
				items.push(it);
				return it;
			}
		}
		return null;
	};
	const standing = (type, x, z, w, d, h, rot = 0, pad = 0) => { const hw = rot % 2 ? d / 2 : w / 2, hd = rot % 2 ? w / 2 : d / 2, box = [x - hw - pad, z - hd - pad, x + hw + pad, z + hd + pad]; if (!inside(box) || hit(box)) return null; placed.push(box); const it = { type, x, z, w, d, h, rot, box: [x - hw, z - hd, x + hw, z + hd], y: 0, v: rnd() }; items.push(it); return it; };
	const inFront = (base, type, w, d, h, gap) => { const sd = base.side, out = sd.pos + sd.n * (base.d + gap + d / 2); return standing(type, sd.axis === 'x' ? base.c : out, sd.axis === 'x' ? out : base.c, w, d, h, base.rot); };
	return { K: { rm: { x0, z0, x1, z1 }, y0: 0, ceil: 3, bw: x1 - x0, bd: z1 - z0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, sides, rnd, items, against, standing, inFront, stand: (x, z) => seats.push({ x, z, sit: false }), seat: (x, z) => seats.push({ x, z, sit: true }), sitOn: () => {}, deskSeat: () => {}, chairs: () => {}, light: () => {}, anchor: (kind, x, y, z) => anchors.push({ kind, x, y, z }), passSide: null, ...extra }, items, seats, anchors };
}

test('every fit-out furnishes its room inside its walls, with someone to work it and lamps to hang', () => {
	const fits = new Set(Object.values(PROFILES).map((p) => p.fit).filter(Boolean));
	fits.add('breakfast'); fits.add('lounge');
	for (const fit of fits) {
		const { K, items, seats, anchors } = fakeK(-3.5, -4, 3.5, 4);
		assert.ok(fitFront(fit, K), 'no fit-out for ' + fit);
		assert.ok(items.length >= 3, fit + ': ' + items.length + ' things');
		for (const it of items) if (it.box && it.type !== 'car') assert.ok(it.box[0] >= -3.51 && it.box[2] <= 3.51 && it.box[1] >= -4.01 && it.box[3] <= 4.01, fit + ' ' + it.type + ' outside');
		for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i].box, b = items[j].box; if (a && b && items[i].type !== 'car' && items[j].type !== 'car' && items[i].type !== 'carLift' && items[j].type !== 'carLift' && items[i].type !== 'rug' && items[j].type !== 'rug') assert.ok(!(a[0] < b[2] - 0.02 && a[2] > b[0] + 0.02 && a[1] < b[3] - 0.02 && a[3] > b[1] + 0.02), `${fit}: ${items[i].type} overlaps ${items[j].type}`); }
		if (!['breakfast', 'lounge', 'laundromat', 'florist'].includes(fit)) assert.ok(seats.length > 0 || anchors.length > 0, fit + ': nobody works it, no lamps');
	}
	// the kinds that are a counter: a counter, someone behind it, a lamp over it
	const { K, items, seats, anchors } = fakeK(-3, -4, 3, 4);
	fitFront('cafe', K);
	assert.ok(items.some((i) => i.type === 'shopCounter' && i.kind === 'cafe'));
	assert.ok(items.some((i) => i.type === 'cafeTable'));
	assert.ok(seats.length >= 1 && anchors.some((a) => a.kind === 'counter' || a.kind === 'pendant'));
	// a restaurant with a kitchen behind gets the pass on the wall they share
	const R = fakeK(-4, -4, 4, 4);
	R.K.passSide = R.K.sides[0];
	fitFront('restaurant', R.K);
	assert.ok(R.items.some((i) => i.type === 'pass'), 'the pass');
	assert.ok(R.items.some((i) => i.type === 'diningTable') && R.items.some((i) => i.type === 'hostStand'));
	assert.ok(R.anchors.some((a) => a.kind === 'heatlamp'));
	for (const k of ['kitchen', 'bakehouse', 'stock', 'workshop', 'office']) { const B = fakeK(-3, -2.5, 3, 2.5); assert.ok(fitBack(k, B.K), k); assert.ok(B.items.length >= 2, k); }
	const kitchen = fakeK(-3, -2.5, 3, 2.5); fitBack('kitchen', kitchen.K);
	assert.ok(kitchen.items.some((i) => i.type === 'range') && kitchen.items.some((i) => i.type === 'prepTable'));
	assert.equal(BACK.restaurant, 'kitchen');
});

test('a house that is a business: its ground floor re-typed and fitted out, shop windows at the front', () => {
	assert.deepEqual(houseRoles('cafe', 'living'), { fit: 'cafe', role: 'front' });
	assert.equal(houseRoles('cafe', 'kitchen').fit, 'kitchen');
	assert.equal(houseRoles('bnb', 'dining').fit, 'breakfast');
	assert.equal(houseRoles('bnb', 'kitchen'), null);
	assert.equal(houseRoles('garage', 'garage').fit, 'workshop');
	assert.equal(houseRoles(null, 'living'), null);
	const grp = [{ x: 100, z: 200, w: 13, d: 11, a: 0.2, wallH: 3.0, roofH: 2, kind: 0, door: 0.5, hip: 0 }];
	const home = planHouse(grp), shop = planHouse(grp, { estab: { fit: 'cafe', glass: true } });
	assert.ok(home && shop);
	const t = (p) => p.items.map((i) => i.type);
	assert.ok(!t(home).includes('shopCounter'));
	assert.ok(t(shop).includes('shopCounter'), 'a counter: ' + t(shop).join(' '));
	assert.ok(t(shop).includes('cafeTable'));
	assert.ok(shop.rooms.some((r) => r.biz?.role === 'front'));
	const shopWins = shop.walls.flatMap((w) => w.open).filter((o) => o.shop);
	assert.ok(shopWins.length >= 1 && shopWins.every((o) => o.y0 <= 0.5 && o.y1 >= 2.3), 'low wide shop windows');
	assert.ok(shop.lightAnchors?.length > 0, 'lamp anchors');
	// the same house is the same business every time
	assert.deepEqual(t(planHouse(grp, { estab: { fit: 'cafe', glass: true } })), t(shop));
	const bnb = planHouse([{ ...grp[0], wallH: 5.6 }], { estab: { fit: 'bnb', glass: false } });
	assert.ok(t(bnb).includes('frontDesk'), 'a front desk: ' + t(bnb).join(' '));
});

test('wealth follows the bank: a household of thousands with a week of rent is getting by, not rich', () => {
	assert.equal(wealthOfStanding(null), null);
	assert.equal(wealthOfStanding(-3), -1);
	assert.ok(wealthOfStanding(-0.5) < -0.79);              // broke
	assert.ok(wealthOfStanding(0.5) < -0.29 && wealthOfStanding(0.5) > -0.8);  // struggling
	assert.ok(Math.abs(wealthOfStanding(2)) < 0.01);         // getting by
	assert.ok(wealthOfStanding(6) > 0.37 && wealthOfStanding(6) < 1);          // comfortable
	assert.equal(wealthOfStanding(20), 1);                   // flush
	// monotonic
	for (let s = -1; s < 20; s += 0.5) assert.ok(wealthOfStanding(s + 0.5) >= wealthOfStanding(s));
	// through the adapter: the bank's standing wins over the raw balance
	const bank = { balance: () => 4200, standing: () => 1.5 };
	const M = createMoney(bank);
	assert.ok(wealthOf(4200) > 0.9, 'the old scale would call them rich');
	assert.ok(M.wealth('x') < 0 && M.wealth('x') > -0.3, 'getting by: ' + M.wealth('x'));
	assert.ok(createMoney().wealth('someone') <= 0.6, 'the stand-in keeps its own scale');
});

test('the working day: staff spots only at open businesses, doors with their ways in and out', () => {
	const mk = (type, x) => ({ type, x, z: 0, setting: 'main', id: 'biz:' + x, door: [x, 2.4], ground: 1, face: { nx: 0, nz: 1, run: 8 }, posts: [{ id: 'biz:' + x, x: x + 1, z: 2, y: 1, heading: 0, pose: 'listen', role: 'server' }] });
	const list = [mk('cafe', 0), mk('pub', 20)];
	const econ = { raw: (x, z, r, out) => { out.length = 0; for (const E of list) out.push(E); return out; } };
	const D = createDailyLife(econ, { isPhone: true });
	const morning = D.at(0, 0, 8.3, 0, 3);
	assert.equal(morning.cap, 3);
	assert.equal(morning.posts.length, 1, 'the café is open, the pub not');
	assert.equal(morning.doors.length, 2);
	const d = morning.doors[0];
	assert.ok(d.inZ < d.z && d.outZ > d.z, 'in behind the door line, out toward the kerb');
	assert.ok(morning.life.commuteIn > 0.2);
	// cached within the second; a new hour looks again
	assert.equal(D.at(0.5, 0, 8.31, 0.5, 3), morning);
	const night = D.at(0, 0, 23, 5, 3);
	assert.equal(night.posts.length, 1, 'only the pub');
	assert.equal(night.posts[0].id, 'biz:20');
	assert.ok(hashAt(1, 2) >= 0);
});
