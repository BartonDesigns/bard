// The ledger server: events checked and queued, settled once a day onto the baseline, accounts
// read back with their daily balances, the admin key guarding the admin calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appendEvents, settleAll, accountView, accountsList } from '../src/settle.js';
import worker, { handle, Bank } from '../src/index.js';
import { profileOf, baseline, dayOf, KIND } from '../../../island/src/economy/ledger-core.js';
import { makeHousehold } from '../../../island/src/people/households.js';

// the Durable Object storage calls, in memory
function memStore() {
	const m = new Map();
	const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
	return {
		m,
		async get(k) { return clone(m.get(k)); },
		async put(k, v) { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) m.set(a, clone(b)); } else m.set(k, clone(v)); },
		async delete(ks) { for (const k of [].concat(ks)) m.delete(k); },
		async list({ prefix = '', limit = Infinity } = {}) { return new Map([...m].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, limit).map(([k, v]) => [k, clone(v)])); },
	};
}
const today = dayOf(Date.now());
const H = makeHousehold(4242, null, { kind: 'two-parent', id: 'h-test' }), P = profileOf(H);

test('events are checked, queued, and settled onto the baseline once a day', async () => {
	const S = memStore();
	const r = await appendEvents(S, { events: [['hh:h-test', today, 40, KIND.returned, 'npc:7'], ['hh:h-test', today, -120, KIND.hospital, 'biz:1:2'], ['bad id', today, 5, 1], ['hh:h-test', today - 30, 5, 1], ['hh:h-test', today, 99999, 1], ['player', today, 25, KIND.request, 'biz:3:4']], profiles: { 'hh:h-test': P } }, today);
	assert.deepEqual(r, { kept: 3, of: 6 });
	const s = await settleAll(S, today);
	assert.deepEqual(s, { accounts: 2, events: 3 });
	assert.equal((await S.list({ prefix: 'p:' })).size, 0, 'the queue is emptied');
	const A = await accountView(S, 'hh:h-test', today);
	assert.equal(A.balance, baseline(P, today) - 80);
	assert.equal(A.daily.length, 90);
	assert.equal(A.daily.at(-1)[1], A.balance);
	assert.equal(A.daily[0][1], baseline(P, today - 89), 'before anything happened, the baseline');
	assert.deepEqual(A.state.tx.map((t) => t[1]), [40, -120]);
	const L = await accountsList(S);
	assert.deepEqual(L.map((a) => a.id).sort(), ['hh:h-test', 'player']);
	// a second day: more on top, the ring and snapshots kept small
	await appendEvents(S, { events: Array.from({ length: 30 }, (v, i) => ['hh:h-test', today + 1, i + 1, KIND.tip, '']) }, today + 1);
	await settleAll(S, today + 1);
	const B = await S.get('a:hh:h-test');
	assert.equal(B.state.tx.length, 20);
	assert.equal(B.state.dd, -80 + 465);
	assert.ok(JSON.stringify(B).length < 2500, `account size ${JSON.stringify(B).length}`);
});

test('a plan is taken once, as numbers only', async () => {
	const S = memStore();
	await appendEvents(S, { events: [], profiles: { 'hh:a': { ...P, evil: '<script>' } } }, today);
	await appendEvents(S, { events: [], profiles: { 'hh:a': { ...P, start: 1e9 } } }, today);
	const f = await S.get('f:hh:a');
	assert.equal(f.start, P.start);
	assert.equal(f.evil, undefined);
});

// the Worker, its Durable Object stubbed in memory
function env(key = 'a-long-admin-key-123') {
	const bank = new Bank({ storage: memStore() }, {});
	return { ADMIN_KEY: key, ALLOW_LOCALHOST: 'true', BANK: { idFromName: () => 'one', get: () => ({ fetch: (req) => bank.fetch(req) }) } };
}
test('the Worker: events in, the account out, the admin calls behind the key', async () => {
	const E = env();
	const post = await handle(new Request('https://l/events', { method: 'POST', headers: { origin: 'http://localhost:8080' }, body: JSON.stringify({ events: [['npc:99', today, 12, KIND.bonus, 'biz:1:1']], profiles: {} }) }), E);
	assert.equal(post.status, 200);
	assert.equal((await post.json()).kept, 1);
	assert.equal((await handle(new Request('https://l/events', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), E)).status, 403);
	assert.equal((await handle(new Request('https://l/admin/api/settle', { method: 'POST' }), E)).status, 401);
	assert.equal((await handle(new Request('https://l/admin/api/settle', { method: 'POST', headers: { 'x-admin-key': 'wrong-key-wrong-key' } }), E)).status, 401);
	const s = await handle(new Request('https://l/admin/api/settle', { method: 'POST', headers: { 'x-admin-key': 'a-long-admin-key-123' } }), E);
	assert.equal((await s.json()).accounts, 1);
	const a = await (await handle(new Request('https://l/account/npc%3A99'), E)).json();
	assert.equal(a.state.dd, 12);
	assert.equal((await handle(new Request('https://l/account/drop%20table'), E)).status, 400);
	const page = await handle(new Request('https://l/admin'), E);
	assert.match(await page.text(), /<svg|chart\(/);
	// a short key never opens the admin calls
	assert.equal((await handle(new Request('https://l/admin/api/accounts', { headers: { 'x-admin-key': 'short' } }), env('short'))).status, 401);
	// the cron settles
	let waited = null;
	await worker.scheduled({}, E, { waitUntil: (p) => { waited = p; } });
	assert.ok(waited && (await waited).status === 200);
});
