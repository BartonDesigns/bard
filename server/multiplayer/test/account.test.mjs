// Accounts (src/account.js) and their routes (src/index.js), with Durable Object storage stood
// in for, and the game's client (island/src/persistence/cloud-save.js) talking to them.
// node --test test/account.test.mjs   (no network, no account)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Account, FAILS_MAX } from '../src/account.js';
import { handle } from '../src/index.js';
import { createCloudSave, collect, applyRestore, isProgressKey, ACCOUNT_KEY, RESTORE_KEY, cleanRecovery, RECOVERY_RE } from '../../../island/src/persistence/cloud-save.js';

function storage() {
	const M = new Map();
	return { M, get: async (k) => structuredClone(M.get(k)), put: async (k, v) => { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) M.set(a, structuredClone(b)); } else M.set(k, structuredClone(v)); }, delete: async (k) => M.delete(k) };
}
// a namespace of accounts, as env.ACCOUNTS
function namespace() {
	const objects = new Map();
	return { objects, idFromName: (n) => n, get: (id) => { if (!objects.has(id)) objects.set(id, new Account({ storage: storage() }, {})); return objects.get(id); } };
}
const ORIGIN = 'https://level99bard.com';
function server(env = { ACCOUNTS: namespace() }) {
	return async (url, init = {}) => handle(new Request(url, { ...init, headers: { ...init.headers, origin: ORIGIN } }), env);
}
// localStorage, stood in for
function local(init = {}) {
	const M = new Map(Object.entries(init));
	return { M, get length() { return M.size; }, key: (i) => [...M.keys()][i] ?? null, getItem: (k) => (M.has(k) ? M.get(k) : null), setItem: (k, v) => M.set(k, String(v)), removeItem: (k) => M.delete(k) };
}
const URL0 = 'https://rooms.test';

test('sign up, log in, save and load through the routes', async () => {
	const env = { ACCOUNTS: namespace() }, f = server(env);
	const post = (op, body, token) => f(`${URL0}/account/${op}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
	const s = await post('signup', { u: 'Josh', p: 'correct horse' });
	assert.equal(s.status, 200); assert.match(s.token, /^[a-f0-9]{64}$/); assert.match(s.recovery, RECOVERY_RE);
	assert.equal((await post('signup', { u: 'josh', p: 'another one' })).status, 409, 'names are one, whatever the case');
	assert.equal((await post('signup', { u: 'no', p: 'correct horse' })).status, 400, 'too short a name');
	assert.equal((await post('signup', { u: 'kim', p: 'short' })).status, 400, 'too short a password');
	const user = env.ACCOUNTS.objects.get('user:josh').state.storage.M.get('user');
	assert.ok(user && !JSON.stringify(user).includes('correct horse') && !JSON.stringify(user).includes(s.recovery), 'only hashes are kept');
	assert.equal((await post('save', { u: 'josh', data: '{"l99-magic":"{}"}', base: 0 })).status, 401, 'a save needs a session');
	const saved = await post('save', { u: 'josh', data: JSON.stringify({ 'l99-magic': '{"level":7}', big: 'x'.repeat(150000) }), base: 0, summary: { level: 7 } }, s.token);
	assert.equal(saved.status, 200); assert.equal(saved.rev, 1);
	assert.equal((await post('save', { u: 'josh', data: '{}', base: 0 }, s.token)).status, 409, 'a save from an older base is refused');
	assert.equal((await post('save', { u: 'josh', data: '[1]', base: 1 }, s.token)).status, 400, 'a save is a map of strings');
	const bad = await post('login', { u: 'josh', p: 'wrong password' });
	assert.equal(bad.status, 403);
	const l = await post('login', { u: 'JOSH', p: 'correct horse' });
	assert.equal(l.status, 200); assert.equal(l.rev, 1); assert.equal(l.summary.level, 7);
	const back = await post('load', { u: 'josh' }, l.token);
	assert.equal(JSON.parse(back.data).big.length, 150000, 'a big save comes back whole, from its pieces');
	assert.equal((await post('load', { u: 'josh' }, 'f'.repeat(64))).status, 401, 'a made-up session is refused');
	await post('logout', { u: 'josh' }, l.token);
	assert.equal((await post('load', { u: 'josh' }, l.token)).status, 401, 'logged out');
	assert.equal((await post('load', { u: 'josh' }, s.token)).status, 200, 'the other device stays signed in');
	// reset with the recovery code: a new password and code, and every device signed out
	assert.equal((await post('reset', { u: 'josh', code: 'AAAA-AAAA-AAAA-AAAA', p: 'new password' })).status, 403);
	const r = await post('reset', { u: 'josh', code: s.recovery, p: 'new password' });
	assert.equal(r.status, 200); assert.notEqual(r.recovery, s.recovery); assert.equal(r.rev, 1);
	assert.equal((await post('load', { u: 'josh' }, s.token)).status, 401, 'a reset signs the old sessions out');
	assert.equal((await post('login', { u: 'josh', p: 'correct horse' })).status, 403, 'the old password is gone');
	assert.equal((await post('reset', { u: 'josh', code: s.recovery, p: 'third password' })).status, 403, 'and so is the old code');
	assert.equal((await post('login', { u: 'josh', p: 'new password' })).status, 200);
	assert.equal((await post('login', { u: 'nobody', p: 'whatever pw' })).status, 403, 'no such user reads like a wrong password');
});

test('guessing locks the account for a while', async () => {
	const f = server();
	const post = (op, body) => f(`${URL0}/account/${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
	await post('signup', { u: 'kim', p: 'kims password' });
	for (let i = 0; i < FAILS_MAX; i++) await post('login', { u: 'kim', p: 'guess ' + i + ' xx' });
	const r = await post('login', { u: 'kim', p: 'kims password' });
	assert.equal(r.status, 429, 'even the right password waits');
});

test('no accounts on a server without them, and only the game may ask', async () => {
	const r = await server({})(`${URL0}/account/login`, { method: 'POST', body: JSON.stringify({ u: 'josh', p: 'correct horse' }) });
	assert.equal(r.status, 503);
	const x = await handle(new Request(`${URL0}/account/login`, { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), { ACCOUNTS: namespace() });
	assert.equal(x.status, 403);
	const st = await (await server()(`${URL0}/status`)).json();
	assert.ok(st.features.includes('accounts-v1'));
});

test('the game: what is saved, a restore staged and applied, and a second device', async () => {
	const env = { ACCOUNTS: namespace() }, f = server(env);
	assert.ok(isProgressKey('l99-magic') && isProgressKey('crysis-arms-v1') && !isProgressKey('l99-quality') && !isProgressKey('island-terrain2-x') && !isProgressKey(ACCOUNT_KEY) && !isProgressKey('l99-mp-id'));
	const A = local({ 'l99-magic': JSON.stringify({ v: 1, level: 12, honor: { pts: 400 } }), 'crysis-arms-v1': '{"credits":50}', 'l99-quality': 'ultra', 'island-terrain2-a': 'cache' });
	assert.deepEqual(Object.keys(collect(A).keys).sort(), ['crysis-arms-v1', 'l99-magic']);
	const a = createCloudSave({ url: URL0, storage: A, request: f, reload: () => {} });
	const { recovery } = await a.signup('Josh', 'correct horse');
	assert.equal(cleanRecovery(recovery.toLowerCase().replace(/-/g, ' ')), recovery, 'a code typed loosely still reads');
	assert.equal(a.info().user, 'josh'); assert.equal(a.info().rev, 1, 'the first save went up with the sign-up');
	assert.ok(A.getItem(ACCOUNT_KEY), 'signed in on this device');
	assert.deepEqual(await a.save(), { unchanged: true }, 'nothing changed: nothing sent');
	// a cleared browser (a new phone), logging in
	let reloaded = 0;
	const B = local({ 'l99-magic': JSON.stringify({ v: 1, level: 1 }), 'crysis-quests': '[]', 'l99-quality': 'high' });
	const b = createCloudSave({ url: URL0, storage: B, request: f, reload: () => reloaded++ });
	const { saved } = await b.login('josh', 'correct horse');
	assert.equal(saved.level, 12); assert.equal(saved.honor, 400);
	await b.load();
	assert.equal(reloaded, 1); assert.ok(B.getItem(RESTORE_KEY), 'staged for the next load');
	assert.ok(applyRestore(B));
	assert.equal(JSON.parse(B.getItem('l99-magic')).level, 12); assert.equal(B.getItem('crysis-arms-v1'), '{"credits":50}');
	assert.equal(B.getItem('crysis-quests'), null, 'what the save does not hold is gone'); assert.equal(B.getItem('l99-quality'), 'high', 'the device keeps its own settings');
	assert.equal(B.getItem(RESTORE_KEY), null);
	// both play on: the phone saves, then the first device's older base is refused
	B.setItem('crysis-quests', '["new"]');
	assert.equal((await b.save()).ok, true);
	A.setItem('crysis-quests', '["old"]');
	const c = await a.save();
	assert.equal(c.conflict, true, 'newer progress from another device is never overwritten unasked');
	assert.ok(a.info().conflict);
	assert.equal((await a.save({ over: true, force: true })).ok, true, 'unless you choose to');
	assert.equal(a.info().conflict, 0);
	await b.logout();
	assert.equal(b.info().user, ''); assert.equal(B.getItem(ACCOUNT_KEY), null);
});
