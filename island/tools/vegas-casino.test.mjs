// A Strip resort is a resort inside too: its casino a casino floor (slot banks, the table games'
// pits, the bar, the cage), a showroom over it; its tower a hotel (the lobby's front desk, floor
// after floor of guest rooms, the suites at the top), never a mall or an office
// (interiors/workplace-plan.js planResort, interiors/resort-fitout.js, bay/towers.js). Its games
// are played for credits by a casino's own rules (gameplay/casino-rules.js, ui/casino.js) at its
// machines and tables (interiors/office-perks.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planWorkplace, commercialStack } from '../src/interiors/workplace-plan.js';
import { fitResort } from '../src/interiors/resort-fitout.js';
import { slotReturn, slotPay, spinSlots, REEL, createBlackjack, handTotal, spinRoulette, WHEEL, pocketColour } from '../src/gameplay/casino-rules.js';

const src = (p) => fs.readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
const mat = (n) => ({ name: n });
const M = new Proxy({ art: [0, 1, 2, 3].map((i) => mat('art' + i)), neon: [0, 1, 2].map((i) => mat('neon' + i)) }, { get: (o, k) => (k in o ? o[k] : (o[k] = mat(k))) });
const at = { lat: 36.11, lon: -115.17 };
const casinoBox = (w = 150, d = 80, h = 18) => ({ x: 100, y: 0, z: 200, w, d, h, a: 0.3, src: { kind: 6, resort: [100, 200], biz: { name: 'The Golden Mesa' } } });
const towerBox = (w = 80, d = 30, h = 120) => ({ x: 100, y: 0, z: 200, w, d, h, a: 0.3, src: { kind: 11, resort: [100, 200], biz: { name: 'The Golden Mesa' } } });
// a level fitted, as bay/towers.js would: what blocks you, the seats, the things to use, the signs
function fit(T, L, phone = false) {
	const col = [], seats = [], perks = [], signs = [];
	let verts = 0;
	const B = { M, seats, phone, add: (m, g) => { verts += g.attributes.position.count; for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v), m.name + ' is finite'); }, sign: (t) => signs.push(t), plant: () => {}, chair: () => {},
		solid: (x0, z0, x1, z1, y0, y1) => col.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), y0, y1]), perk: (kind, x, z) => perks.push({ kind, x, z }) };
	const stats = fitResort(T, L, B);
	const blocked = (x, z) => col.some((c) => x > c[0] && x < c[2] && z > c[1] && z < c[3] && c[5] > 0.5);
	return { stats, col, seats, perks, signs, verts, blocked };
}
const count = (list, kind) => list.filter((p) => p.kind === kind).length;

test('a Strip resort is planned as a casino and a hotel, never a mall or offices', () => {
	const C = planWorkplace(casinoBox(), 0.25, at);
	assert.equal(C.type, 'casino');
	assert.equal(C.name, 'The Golden Mesa');
	assert.deepEqual(C.levels.map((L) => L.kind), ['casino', 'showroom', 'roof']);
	assert.ok(C.levels[0].h >= 5 && C.levels[0].h <= 7.3, 'the gaming floor under a low ceiling');
	const H = planWorkplace(towerBox(), 0.25, at), kinds = H.levels.map((L) => L.kind);
	assert.equal(H.type, 'hotel');
	assert.equal(kinds[0], 'lobby');
	assert.ok(kinds.slice(1, -1).every((k) => k === 'hotel'), 'floor after floor of guest rooms');
	assert.ok(H.levels.length > 30, 'a 120 m tower has its storeys');
	assert.deepEqual(H.levels.filter((L) => L.suite).map((L) => L.program), ['Suites', 'Suites']);
	// (an office tower and a mall are as they were)
	assert.equal(planWorkplace({ ...towerBox(), src: { kind: 11 } }, 0.25, at).type, 'office');
	assert.equal(planWorkplace({ ...casinoBox(), src: { kind: 6 } }, 0.25, at).type, 'mall');
	// (the biggest casinos are walked into too)
	assert.equal(commercialStack(6, 260, 110, 20), false);
	assert.equal(commercialStack(6, 260, 110, 20, true), true);
	assert.match(src('bay/city.js'), /o\.h-1\.2,!!o\.src\?\.resort\)\)/);
});

test('the casino floor: slot banks, blackjack and roulette in their pits, the bar, the cage, a sportsbook and a buffet on a long one', () => {
	for (const [w, d, phone] of [[150, 80, false], [260, 110, false], [54, 60, false], [150, 80, true]]) {
		const T = planWorkplace(casinoBox(w, d), 0.25, at), F = fit(T, T.levels[0], phone);
		const tag = `${w}x${d}${phone ? ' phone' : ''}`;
		assert.ok(F.stats.slots >= (phone ? 100 : 200), tag + ' slot machines: ' + F.stats.slots);
		assert.ok(F.stats.slots <= (phone ? 140 : 300), tag + ' no more machines than a floor can build');
		assert.equal(count(F.perks, 'slots'), F.stats.slots, tag + ' every machine is played');
		assert.ok(count(F.perks, 'blackjack') >= 4 && count(F.perks, 'roulette') >= 2, tag + ' the tables');
		assert.equal(count(F.perks, 'cocktail'), 1, tag + ' the bar');
		assert.equal(count(F.perks, 'cage'), 1, tag + ' the cage');
		if (w >= 150) { assert.ok(count(F.perks, 'casinobuffet') > 0, tag + ' the buffet'); assert.ok(F.signs.includes('RACE & SPORTS BOOK'), tag + ' the sportsbook'); }
		assert.ok(F.signs.includes('THE GOLDEN MESA'), tag + ' its name over the aisle');
		assert.ok(F.verts < (phone ? 120000 : 200000), tag + ' vertices ' + F.verts);
		// everyone's place and every game's spot inside and clear of what blocks you
		for (const [x, z] of F.seats) { assert.ok(Math.abs(x) < T.hw && Math.abs(z) < T.hd, tag + ' seat inside'); assert.ok(!F.blocked(x, z), `${tag} seat at ${x.toFixed(1)}, ${z.toFixed(1)} is clear`); }
		for (const p of F.perks) assert.ok(!F.blocked(p.x, p.z) && Math.abs(p.x) < T.hw && Math.abs(p.z) < T.hd, `${tag} ${p.kind} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} is reachable`);
		// the way from the doors to the lifts is clear
		for (let z = T.coreZ + 3.2; z < T.hd; z += 0.5) assert.ok(!F.blocked(0, z), `${tag} the aisle at ${z.toFixed(1)}`);
		const roles = new Set(F.seats.map((s) => s[5]?.role));
		for (const r of ['gambler', 'dealer', 'bartender', 'cashier', 'pit boss']) assert.ok(roles.has(r), tag + ' ' + r);
	}
});

test('the showroom and the hotel: rows of seats facing the stage, the front desk, the rooms down the corridor', () => {
	const C = planWorkplace(casinoBox(), 0.25, at), S = fit(C, C.levels[1]);
	assert.ok(S.stats.seats >= 200, 'the showroom seats ' + S.stats.seats);
	assert.ok(S.seats.every(([, , yaw]) => Math.abs(Math.abs(yaw) - Math.PI) < 1e-6), 'all facing the stage');
	assert.ok(S.seats.every(([x, z]) => !S.blocked(x, z)), 'a way along the rows');
	const H = planWorkplace(towerBox(), 0.25, at), lobby = fit(H, H.levels[0]);
	assert.ok(lobby.signs.includes('FRONT DESK · CHECK-IN'));
	assert.ok(lobby.seats.some((s) => s[5]?.role === 'front desk') && lobby.seats.some((s) => s[5]?.role === 'bell captain'));
	for (let z = H.coreZ + 3.2; z < H.hd; z += 0.5) assert.ok(!lobby.blocked(0, z), 'the doors to the lifts');
	for (const [i, want] of [[1, 'Guest rooms'], [H.levels.length - 2, 'Suites']]) {
		const L = H.levels[i], F = fit(H, L);
		assert.equal(L.program, want);
		assert.ok(F.stats.rooms >= (L.suite ? 8 : 20), want + ': ' + F.stats.rooms + ' rooms');
		assert.equal(count(F.perks, 'vending'), 1, 'the vending machine by the lifts');
		// (down the corridor from the lifts, one end to the other)
		for (let x = -H.hw + 0.5; x < H.hw - 0.5; x += 0.4) assert.ok(!F.blocked(x, 0), `${want}: the corridor at ${x.toFixed(1)}`);
		for (let z = H.coreZ + 0.4; z < 0; z += 0.3) assert.ok(!F.blocked(0, z), `${want}: the lifts to the corridor`);
		assert.match(F.signs.join('|'), new RegExp(`FLOOR ${L.n} · ROOMS ${L.n}01–`));
	}
});

test('the games keep the house edge a Strip casino keeps', () => {
	const rtp = slotReturn();
	assert.ok(rtp > 0.88 && rtp < 0.95, 'the slots pay back ' + rtp.toFixed(3));
	assert.equal(REEL.length, 32);
	assert.equal(slotPay(['7', '7', '7']).pays, 1000);
	assert.equal(slotPay(['BAR', 'BAR2', 'BAR3']).pays, 9);
	assert.equal(slotPay(['CHERRY', 'BLANK', 'BELL']).pays, 1);
	assert.equal(slotPay(['BLANK', 'CHERRY', 'BELL']).pays, 0);
	let r = 0.5;
	const S = spinSlots(5, () => r);
	assert.equal(S.line.length, 3); assert.equal(S.win, slotPay(S.line).pays * 5);
	// blackjack with the shoe stacked: you 10 and Q, the dealer 9 and 7 (draws to 17 or more)
	assert.equal(handTotal([{ r: 'A' }, { r: 'A' }, { r: '9' }]).total, 21);
	assert.equal(handTotal([{ r: 'A' }, { r: '6' }]).soft, true);
	let took = 0, paid = 0;
	const T = createBlackjack({ take: (n) => { took += n; return true; }, pay: (n) => { paid += n; } });
	assert.ok(T.deal(10));
	const s0 = T.state();
	assert.equal(s0.hands[0].cards.length, 2); assert.equal(s0.dealer.length, 2);
	while (T.state().phase === 'play') T.stand();
	const done = T.state(), h = done.hands[0], d = handTotal(done.dealer).total;
	assert.ok(d >= 17 || h.out === 'blackjack' || handTotal(h.cards).total > 21, 'the dealer draws to 17');
	assert.equal(paid, done.back);
	assert.equal(took, 10);
	assert.equal(h.back, { blackjack: 25, win: 20, push: 10, lose: 0, bust: 0 }[h.out]);
	// a thousand rounds standing on 17: the house ahead, but not by much
	let bank = 0, put = 0;
	const P = createBlackjack({ take: (n) => { bank -= n; put += n; return true; }, pay: (n) => { bank += n; } });
	for (let i = 0; i < 3000; i++) { P.deal(10); while (P.state().phase === 'play') { const t = handTotal(P.state().hands[P.state().at].cards).total; if (t < 17) P.hit(); else P.stand(); } }
	assert.ok(bank / put < 0.02 && bank / put > -0.15, 'blackjack returns ' + (1 + bank / put).toFixed(3));
	// roulette: 38 pockets, 18 red, a straight bet pays 35 to 1
	assert.equal(WHEEL.length, 38);
	assert.equal(WHEEL.filter((n) => pocketColour(n) === 'red').length, 18);
	const at17 = WHEEL.indexOf(17) / 38 + 1e-6;
	const R = spinRoulette([{ kind: 'straight', n: 17, amount: 2 }, { kind: 'black', amount: 5 }, { kind: 'red', amount: 5 }, { kind: 'odd', amount: 1 }], () => at17);
	assert.equal(R.n, 17);
	assert.equal(R.back, 2 * 36 + 5 * 2 + 1 * 2);
	const zero = spinRoulette([{ kind: 'red', amount: 5 }, { kind: 'even', amount: 5 }], () => WHEEL.indexOf(37) / 38 + 1e-6);
	assert.equal(zero.back, 0, 'the double zero takes the even bets');
});

test('the machines and tables are played: their prompts open the casino, the screen holds the game', () => {
	const perks = src('interiors/office-perks.js');
	for (const k of ['slots', 'blackjack', 'roulette', 'cage']) assert.match(perks, new RegExp(`${k}: \\{ label: '[^']+', game: '${k}' \\}`));
	assert.match(perks, /cocktail: \{ label: '🍸 Order a drink', hp: 8, wait: 60, price: 9/);
	assert.match(perks, /if \(PERK\[q\.kind\]\?\.game\) \{ if \(play\) play\(PERK\[q\.kind\]\.game, q\)/);
	const main = src('main.js');
	assert.match(main, /const casino = HOOKS\.casino = createCasino\(\{ mount: dom\.mount, arms,/);
	assert.match(main, /play: \(game, q\) => casino\.open\(game, q\)/);
	assert.match(main, /casino\.update\(camera\.position\)/);
	assert.match(src('island-frame.js'), /!!HOOKS\.casino\?\.active\?\.\(\)/);
	const ui = src('ui/casino.js');
	assert.match(ui, /spendCredits\?\.\(n, \{ id: id\('bet'\), kind: 'casino' \}\)/);
	assert.match(ui, /kind: 'trade', peer: 'casino', give: \{ credits: 0, items: \[\] \}, get: \{ credits: Math\.round\(n\), items: \[\] \}/);
	assert.match(ui, /document\.exitPointerLock/);
	const towers = src('bay/towers.js');
	assert.match(towers, /T\.type === 'casino' \|\| T\.type === 'hotel'\) \{\n\t\t\t\/\/ a Strip resort's casino, showroom, hotel lobby and guest floors\n\t\t\tdetails = fitResort\(T, L, /);
	assert.match(towers, /allNight: resort/);
	assert.match(towers, /kind === 'casino' \? crowd\(ZONE\.strip, hours\)\.k/);
	assert.match(towers, /T\.type === 'casino' \? 0 :/);
});

test('the famous resorts are walked into: Caesars\' casino block holds a casino floor, its doors open as you come to them', async () => {
	const THREE = await import('three');
	const { createSettlements } = await import('../src/region/settle.js');
	const { REAL, REAL_BUILD } = await import('../src/region/landmarks.js');
	const e = REAL.find((q) => q[0] === 'Caesars Palace'), rot = e[5] * Math.PI / 180;
	const S = createSettlements({ scene: new THREE.Scene(), ground: () => 600, wet: () => false, F: { epoch: 1 }, toXZ: () => ({ x: 0, z: 0 }), toLL: (x, z) => ({ lat: 36.11 + z / 1e5, lon: -115.17 + x / 1e5 }), isPhone: true });
	const site = S.add({ key: 'real:caesars', kind: 'real', clear: 300, paved: true, lat: 36.11, lon: -115.17, kit: 'desert', pop: -1, name: e[0], opts: {}, env: { snow: 0 }, lots: [{ type: 'casino', build: (B, L, P, r) => REAL_BUILD.casino(B, e[4], e[7], r, () => 0), x: 0, z: 0, rot, w: 30, d: 30, role: 'centre' }] });
	const cam = { position: { x: 0, y: 630, z: 0 } };
	for (let i = 0; i < 600 && ![...site.cells.values()].some((c) => c.halls?.length && c.mesh); i++) S.update(0.1, cam, { budget: 8 });
	const [o] = S.hallsNear(0, 0, 300);
	assert.ok(o && o === S.hallsNear(0, 0, 300)[0], 'its casino block, the same one each time');
	assert.ok(o.w > 150 && o.d > 100 && o.h > 10 && o.landmark === 'Caesars Palace', JSON.stringify({ w: o.w, d: o.d, h: o.h }));
	// (planned as a Strip casino is: its floor, the showroom over it, its own name over the aisle)
	const T = planWorkplace(o, o.y + 0.25, at);
	assert.equal(T.type, 'casino');
	assert.equal(T.name, 'Caesars Palace');
	assert.deepEqual(T.levels.map((L) => L.kind), ['casino', 'showroom', 'roof']);
	const F = fit(T, T.levels[0]);
	assert.ok(F.stats.slots >= 100 && F.stats.tables >= 6, JSON.stringify(F.stats));
	// (its doors where the block's are: the tower's +z, the porte-cochère's side)
	const H = o.hall, dx = o.x - Math.sin(o.a) * o.d / 2, dz = o.z + Math.cos(o.a) * o.d / 2;
	assert.ok(Math.hypot(dx - (site.x + H.door[0]), dz - (site.z + H.door[1])) < 1.5, 'the casino\'s doors in the block\'s front');
	// (the block holds you out till its casino is built inside; then its own walls do)
	// (three metres in through its doors)
	const ux = H.c[0] - H.door[0], uz = H.c[1] - H.door[1], ul = Math.hypot(ux, uz), inX = site.x + H.door[0] + ux / ul * 3, inZ = site.z + H.door[1] + uz / ul * 3;
	const p = { x: inX, z: inZ };
	S.push(p, o.y + 0.8);
	assert.ok(Math.hypot(p.x - inX, p.z - inZ) > 2, 'held out of the block from outside');
	// (all along it, from either end: not only in the cell its lot is in)
	for (const sx of [-1, 1]) {
		const lx = sx * (o.w / 2 - 3), ex = o.x + Math.cos(o.a) * lx, ez = o.z + Math.sin(o.a) * lx, r = { x: ex, z: ez };
		S.push(r, o.y + 0.8);
		assert.ok(Math.hypot(r.x - ex, r.z - ez) > 2, 'held out at its ' + (sx < 0 ? 'one' : 'other') + ' end');
	}
	const C = [...site.cells.values()].find((c) => c.halls?.length), A = C.mesh.geometry.attributes.aNear.array;
	const AG = C.glow.geometry.attributes.aNear.array;
	assert.ok(H.v1 > H.v0 && H.g1 > H.g0 && A[H.v0 * 4 + 2] === 0 && AG[H.g0 * 4 + 2] === 0, 'its doors marked, shut');
	S.openHall(o);
	const q = { x: inX, z: inZ };
	S.push(q, o.y + 0.8);
	assert.ok(Math.hypot(q.x - inX, q.z - inZ) < 1e-6, 'walked in');
	// (and all the way to its back wall: the hotel over it stands on its roof, not on its floor)
	for (let t = 3; t < o.d - 3; t += 4) for (const u of [-0.3, 0, 0.3]) {
		const wx = site.x + H.door[0] + ux / ul * t - uz / ul * u * o.w, wz = site.z + H.door[1] + uz / ul * t + ux / ul * u * o.w, w = { x: wx, z: wz };
		S.push(w, o.y + 0.8);
		assert.ok(Math.hypot(w.x - wx, w.z - wz) < 1e-6, 'across its floor, ' + t.toFixed(0) + ' m in');
	}
	assert.equal(A[H.v0 * 4 + 2], 1); assert.equal(A[(H.v1 - 1) * 4 + 2], 1);
	assert.equal(A[H.v1 * 4 + 2] || 0, 0, 'only the doors give way');
	assert.equal(AG[H.g0 * 4 + 2], 1, 'the light through their glass too');
	S.openHall(null);
	assert.equal(A[H.v0 * 4 + 2], 0, 'and come back when you have gone');
	assert.equal(AG[H.g0 * 4 + 2], 0);
	S.dispose();
	// (and every resort on the Strip with a casino block: each opens onto its own casino)
	const { Geo } = await import('../src/region/geo.js');
	const open = REAL.filter(([, la, lo, type]) => la > 36 && la < 36.25 && lo > -115.25 && lo < -115.1 && ['casino', 'bellagio', 'venetian', 'nyny', 'parislv', 'strat', 'luxor', 'excalibur', 'canopy'].includes(type));
	assert.ok(open.length >= 22, open.length + ' resorts');
	const named = [];
	for (const [name, , , type, sc, , , args] of open) {
		const b = { G: new Geo(), glow: new Geo(), night: new Geo(), solid: [], smoke: [], lights: [], trees: [], signs: [], name };
		// (on ground that rises away from the boulevard, as the valley does)
		const gr = (x, z) => 0.012 * z + 0.004 * x;
		REAL_BUILD[type](b, sc, args, () => 0.5, gr);
		assert.ok(b.halls?.length >= (type === 'canopy' ? 7 : 1), name + ': ' + (b.halls?.length || 0) + ' casinos');
		for (const h of b.halls) {
			const id = h.name || name, c = Math.cos(h.r), n = Math.sin(h.r);
			named.push(id);
			// (its corners and the ground before its doors, in the landmark's frame: hall() turned by h.r)
			const at2 = (u, v) => [h.x + u * c + v * n, h.z - u * n + v * c], g2 = (u, v) => gr(...at2(u, v));
			for (const [u, v] of [[-h.w / 2, -h.d / 2], [h.w / 2, -h.d / 2], [-h.w / 2, h.d / 2], [h.w / 2, h.d / 2]]) assert.ok(h.fy >= g2(u, v) + 0.25 - 1e-9, id + ': its floor over the ground everywhere under it');
			const door = at2(0, -h.d / 2);
			assert.ok(Math.hypot(door[0] - h.gx, door[1] - h.gz) < 1e-6, id + ': its doors in its front');
			assert.ok(h.stair && Math.abs(h.stair.y - g2(0, -h.d / 2 - 1)) < 1e-9 && h.stair.len >= (h.fy - h.stair.y) / 0.17 * 0.32 - 0.33, id + ': steps up to its doors');
			assert.ok(h.w >= 80 && h.d >= 40 && h.h >= 9 && h.v1 > h.v0 && h.g1 > h.g0, id + ' has its casino block, its doors lit');
			assert.equal(b.solid.filter((q) => q[5] === h).length, 1, id + ' its block solid till you are in');
			const Tn = planWorkplace({ x: 0, z: 0, y: 0, w: h.w - 1, d: h.d - 1, h: h.h - 1.5, a: 0, src: { kind: 6, resort: [0, 0], biz: { name: id } } }, 0.25, at);
			assert.equal(Tn.type, 'casino', id);
			assert.equal(Tn.levels[0].kind, 'casino', id);
			if (h.name) assert.ok(b.signs.some((q) => q.text === h.name), id + ': its name in lights over its doors');
		}
		// (nothing else stands at its doors, but a canopy's post: they open onto the street)
		for (const h of b.halls) for (const q of b.solid) {
			if (q[5] === h || Math.max(q[2], q[3]) < 3) continue;
			const c = Math.cos(h.r), n = Math.sin(h.r), u = (q[0] - h.gx) * c - (q[1] - h.gz) * n, v = (q[0] - h.gx) * n + (q[1] - h.gz) * c;
			assert.ok(!(Math.abs(u) < 12 + q[2] / 2 && v < 0 && v > -6 - q[3] / 2), (h.name || name) + ': its doorway clear of ' + JSON.stringify(q.slice(0, 4)));
		}
	}
	for (const n of ['the Luxor', 'the Excalibur', 'Circa', 'Golden Nugget', 'Binion\'s', 'Four Queens', 'Golden Gate', 'The D', 'Fremont']) assert.ok(named.includes(n), n + ' walked into');
	// (bay/towers.js takes them with the city's own towers, island-build.js hands it the settlements)
	assert.match(src('bay/towers.js'), /concat\(regional\(\)\?\.hallsNear\?\.\(cam\.x,cam\.z,28\)/);
	assert.match(src('bay/towers.js'), /if\(best\.hall\)regional\(\)\?\.openHall\?\.\(best\)/);
	assert.match(src('bay/towers.js'), /if\(T\.o\.hall\)regional\(\)\?\.openHall\?\.\(null\)/);
	assert.match(src('bay/towers.js'), /if \(o\.floor0 != null\) return planWorkplace\(o, o\.floor0/, 'its floor where its steps lead');
	assert.match(src('bay/towers.js'), /const sy=T\.floor0-\(T\.floor0-st\.y\)/, 'and the steps walked up');
	assert.match(src('island-build.js'), /createTowers\([^\n]*regional: \(\) => iw\.world\?\.globe\?\.regional\?\.settlements/);
});
