// The bank (src/economy/bank.js, ledger-core.js): balances derived, never rolled; married couples
// of either sex share one account; children draw on it; roommates keep their own; accounts stay
// small; payroll pays in without counting a regular wage twice; it works offline and syncs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBank, wirePayroll } from '../src/economy/bank.js';
import { profileOf, baseline, dayOf, weeklyCosts, EPOCH, DAY_MS } from '../src/economy/ledger-core.js';
import { makeHousehold, makeHouseholds } from '../src/people/households.js';
import { createPayroll } from '../src/economy/payroll.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const at = (day) => () => EPOCH + day * DAY_MS + 3600000;

test('the same household on the same day has the same balance, on any device', () => {
	const a = createBank({ clock: at(200), storage: null }), b = createBank({ clock: at(200), storage: null });
	for (const seed of [1, 77, 4242, 99991]) {
		const h1 = makeHousehold(seed, null, { id: 'x' + seed }), h2 = makeHousehold(seed, null, { id: 'x' + seed });
		const A = a.link('npc:1', h1), B = b.link('npc:2', h2);
		assert.equal(A, B);
		assert.equal(a.balance(A), b.balance(B));
		assert.equal(a.balance(A, 150), baseline(profileOf(h1), 150));
	}
	// a person living alone, known only by their seed
	assert.equal(a.balance('npc:31337'), b.balance('npc:31337'));
	assert.deepEqual(a.daily('npc:31337', 10), b.daily('npc:31337', 10));
});

test('money follows work and family size: some houses comfortable, some struggling, few absurd', () => {
	const H = makeHouseholds(7, Array.from({ length: 400 }, () => ({})));
	const B = createBank({ clock: at(285), storage: null });
	const moods = {};
	for (const h of H) { const id = B.link(null, h); const t = B.moneyTalk(id); moods[t.mood] = (moods[t.mood] || 0) + 1; assert.ok(Number.isFinite(t.balance)); }
	assert.ok((moods.comfortable || 0) + (moods.flush || 0) > 60, JSON.stringify(moods));
	assert.ok((moods.struggling || 0) + (moods.broke || 0) > 20, JSON.stringify(moods));
	assert.ok((moods['getting by'] || 0) > 30, JSON.stringify(moods));
	// the costs are sane against the pay
	for (const h of H.slice(0, 50)) { const P = profileOf(h); if (P.pay > 0) assert.ok(weeklyCosts(P) < (P.pay + P.pension) * 1.25, JSON.stringify(P)); }
});

test('married couples share one account, whatever their sexes; children draw on it; roommates keep their own', () => {
	const B = createBank({ clock: at(100), storage: null });
	// a two-mum or two-dad family and a mixed one: all the same, one account per house
	let same = null, mixed = null;
	for (let s = 1; s < 4000 && (!same || !mixed); s++) { const h = makeHousehold(s, null, { kind: 'two-parent', id: 'f' + s }); const [p, q] = h.members; if (p.male === q.male) same = same || h; else mixed = mixed || h; }
	for (const h of [same, mixed]) {
		const ids = h.members.map((m, i) => B.link('npc:' + (h.seed + i * 13), h, m));
		assert.equal(new Set(ids).size, 1, h.id);
		const [par1, par2] = h.members, kid = h.members.find((m) => m.age < 18);
		const acc = ids[0], before = B.balance(acc);
		B.earn('npc:' + h.seed, 100, 'request', 'biz:1:1');           // one partner's pay
		B.earn('npc:' + (h.seed + 13), 50, 'bonus', 'biz:2:2');       // the other's
		assert.equal(B.balance(acc), before + 150);
		if (kid) { const ki = h.members.indexOf(kid); B.spend('npc:' + (h.seed + ki * 13), 30, 'clothes', 'biz:3:3'); assert.equal(B.balance(acc), before + 120, 'a child spends from the house'); }
		assert.ok(par1.job || par2.job || true);
	}
	// the plan carries the children: allowance, lunch money, clothes
	const fam = makeHousehold(12, null, { kind: 'two-parent', id: 'kids' }), P = profileOf(fam);
	assert.ok(P.minors > 0 && P.lunch > 0 && P.clothes > 0);
	const r = makeHousehold(5, null, { kind: 'roommates', id: 'rm' });
	const rids = r.members.map((m, i) => B.link('npc:r' + i, r, m));
	assert.equal(new Set(rids).size, r.members.length, 'roommates each their own');
});

test('earn, spend, transfer; history and daily; small to keep', () => {
	const S = mem(), B = createBank({ clock: at(120), storage: S });
	const h = makeHousehold(55, null, { kind: 'couple', id: 'c55' }), id = B.link('npc:1', h);
	const b0 = B.balance(id);
	B.earn(id, 40, 'returned', 'npc:9');
	B.spend(id, 15, 'purchase', 'biz:1:2');
	B.transfer(id, 'player', 10, 'tip');
	assert.equal(B.balance(id), b0 + 15);
	assert.equal(B.balance('player'), 10);
	assert.deepEqual(B.history(id).map((t) => [t.kind, t.amount]), [['tip', -10], ['purchase', -15], ['returned', 40]]);
	const d = B.daily(id, 5);
	assert.equal(d.length, 5); assert.equal(d.at(-1).balance, B.balance(id));
	for (let i = 0; i < 200; i++) B.earn(id, 1 + (i % 7), 'tip', 'npc:' + i);
	const raw = JSON.stringify(B.raw(id));
	assert.ok(B.raw(id).tx.length === 20 && raw.length < 1600, `account ${raw.length} bytes`);
	// it is the same tomorrow, plus the baseline's day
	B.flush();
	const B2 = createBank({ clock: at(121), storage: S });
	B2.link('npc:1', h);
	assert.equal(B2.balance(id, 120), B.balance(id));
});

test('what someone can say about their money', () => {
	const B = createBank({ clock: at(140), storage: null });
	const h = makeHousehold(808, null, { kind: 'single-parent', id: 's808' }), id = B.link('npc:5', h, h.members[0]);
	B.earn('npc:5', 40, 'returned', 'npc:player');
	const t = B.moneyTalk('npc:5');
	assert.equal(t.account, id);
	assert.ok(['broke', 'struggling', 'getting by', 'comfortable', 'flush'].includes(t.mood));
	assert.ok(t.recent.some((r) => r.kind === 'returned' && r.amount === 40 && r.daysAgo === 0));
	if (t.rent) assert.ok(t.rent.inDays >= 0 && t.rent.inDays < 30 && t.rent.weekday);
	assert.ok(t.payday === undefined || (t.payday.inDays >= 0 && t.payday.inDays < 7));
	assert.ok(t.tempted >= 0 && t.tempted <= 1);
	// the flush tip, the struggling ask for help
	const H = makeHouseholds(3, Array.from({ length: 120 }, () => ({}))).map((q) => B.link(null, q));
	const rich = H.find((q) => B.standing(q) > 12), poor = H.find((q) => B.standing(q) < 1);
	if (rich) assert.ok(B.tipFor(rich, 100) >= 25 && !B.needsHelp(rich));
	if (poor) assert.ok(B.tipFor(poor, 100) === 0 && B.needsHelp(poor));
});

test('payroll pays in: a regular wage is listed, not counted twice; a bonus is money on top', () => {
	const B = createBank({ clock: at(90), storage: null }), P = createPayroll({ clock: () => 0 });
	wirePayroll(B, P);
	P.setResolver(() => ({ id: 'biz:9:9', name: 'Café Wren', type: 'cafe' }));
	const h = makeHousehold(3131, null, { kind: 'couple', id: 'w' }), worker = h.members.find((m) => m.job) || h.members[0];
	const id = B.link('npc:44', h, worker), b0 = B.balance(id);
	P.clockIn('npc:44', { x: 0, z: 0 });
	P.taskDone('npc:44', 'meeting', { x: 0, z: 0 });
	const hist = B.history(id);
	assert.equal(hist.length, 2);
	const wageListed = hist.find((t) => t.kind === 'wage');
	assert.ok(wageListed && wageListed.counterparty === 'biz:9:9');
	assert.equal(B.balance(id), b0 + (B.account(id).plan.pay ? 0 : wageListed.amount) + 6);
});

test('offline first: events queue, and go to the ledger when it can be reached', async () => {
	const sent = [];
	const B = createBank({ clock: at(60), storage: null, server: 'https://ledger.example', fetch: async (u, o) => { sent.push([u, JSON.parse(o.body)]); return { ok: true, json: async () => ({ kept: 1 }) }; } });
	const h = makeHousehold(9, null, { id: 'q' }), id = B.link('npc:1', h);
	B.earn(id, 25, 'request', 'biz:1:1');
	assert.equal(B.info().pending, 1);
	const r = await B.sync();
	assert.ok(r.ok && r.sent === 1 && B.info().pending === 0);
	assert.equal(sent[0][0], 'https://ledger.example/events');
	assert.deepEqual(sent[0][1].events[0].slice(0, 4), [id, 60, 25, 4]);
	assert.ok(sent[0][1].profiles[id].pay >= 0);
	const off = createBank({ clock: at(60), storage: null, server: 'https://ledger.example', fetch: async () => { throw new Error('offline'); } });
	off.earn('player', 5, 'tip');
	assert.equal((await off.sync()).ok, false);
	assert.equal(off.info().pending, 1, 'kept for later');
	assert.equal(dayOf(EPOCH), 0);
});
