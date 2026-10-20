// Guilds and alliances (src/guild.js) through their routes (src/index.js), with accounts made
// the real way (src/account.js) and Durable Object storage stood in for; and the game's own
// client (island/src/guild/guild-net.js) talking to them.
// node --test test/guild.test.mjs   (no network, no account)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../src/account.js';
import { Guilds } from '../src/guild.js';
import { handle } from '../src/index.js';
import { createGuildNet } from '../../../island/src/guild/guild-net.js';

function storage() {
	const M = new Map();
	return {
		M, get: async (k) => structuredClone(M.get(k)),
		put: async (k, v) => { if (typeof k === 'object') { for (const [a, b] of Object.entries(k)) M.set(a, structuredClone(b)); } else M.set(k, structuredClone(v)); },
		delete: async (k) => M.delete(k),
		list: async ({ prefix = '', limit = 1000 } = {}) => new Map([...M].filter(([k]) => k.startsWith(prefix)).slice(0, limit).map(([k, v]) => [k, structuredClone(v)])),
	};
}
function namespace(Kind) {
	const objects = new Map();
	return { objects, idFromName: (n) => n, get: (id) => { if (!objects.has(id)) objects.set(id, new Kind({ storage: storage() }, {})); return objects.get(id); } };
}
const ORIGIN = 'https://level99bard.com', URL0 = 'https://rooms.test';
function world() {
	// (each its own address, as the hourly limits see it)
	const env = { ACCOUNTS: namespace(Account), GUILDS: namespace(Guilds), IP_SALT: 'test' + Math.random() };
	const f = (url, init = {}) => handle(new Request(url, { ...init, headers: { ...init.headers, origin: ORIGIN } }), env);
	const post = (path, body, token) => f(`${URL0}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
	return { env, f, post };
}
async function player(W, u) {
	const s = await W.post('account/signup', { u, p: 'correct horse ' + u });
	assert.equal(s.status, 200);
	return (op, body = {}) => W.post('guilds/' + op, { u, ...body }, s.token);
}

test('status names the feature once guilds are bound', async () => {
	const W = world();
	const st = await (await W.f(`${URL0}/status`)).json();
	assert.ok(st.features.includes('guilds-v1'));
	const bare = await (await handle(new Request(`${URL0}/status`, { headers: { origin: ORIGIN } }), { ACCOUNTS: namespace(Account) })).json();
	assert.ok(!bare.features.includes('guilds-v1'), 'not without the GUILDS object');
});

test('only a signed-in player reaches the guilds', async () => {
	const W = world();
	await player(W, 'josh');
	assert.equal((await W.post('guilds/mine', { u: 'josh' })).status, 401, 'no session');
	assert.equal((await W.post('guilds/mine', { u: 'josh' }, 'f'.repeat(64))).status, 401, 'a made-up session');
	assert.equal((await W.post('guilds/mine', { u: 'nobody' }, 'f'.repeat(64))).status, 401, 'no such player');
	assert.equal((await W.post('account/whoami', { u: 'josh' })).status, 404, 'whoami is not a public route');
});

test('found, invite, join, ranks, leave', async () => {
	const W = world(), josh = await player(W, 'josh'), kim = await player(W, 'kim'), ari = await player(W, 'ari');
	assert.equal((await josh('mine')).guild, null);
	assert.equal((await josh('found', { name: 'x', tag: 'BD' })).status, 400, 'too short a name');
	assert.equal((await josh('found', { name: 'Bay Bards', tag: 'bd!' })).status, 400, 'a bad tag');
	const g = await josh('found', { name: 'Bay Bards', tag: 'BB', colours: ['#3b82f6', '#nothex'], npcs: [{ name: 'Maria Lopez', role: 'healer', level: 4 }, { name: 'x', role: 'wizard' }] });
	assert.equal(g.status, 200);
	assert.equal(g.guild.tag, 'BB'); assert.deepEqual(g.guild.colours, ['#3b82f6', '#e8e0cc']);
	assert.equal(g.guild.npcs.length, 1, 'only real callings kept');
	assert.equal((await kim('found', { name: 'bay bards', tag: 'KB' })).status, 409, 'names are one, whatever the case');
	assert.equal((await kim('found', { name: 'Kim Crew', tag: 'BB' })).status, 409, 'tags are one');
	assert.equal((await josh('found', { name: 'Second', tag: 'SC' })).status, 409, 'one guild at a time');
	// an invitation
	assert.equal((await kim('invite', { to: 'ari' })).status, 404, 'kim is in no guild');
	assert.equal((await josh('invite', { to: 'kim' })).status, 200);
	const k = await kim('mine');
	assert.equal(k.invites.length, 1); assert.equal(k.invites[0].name, 'Bay Bards');
	assert.equal((await ari('join', { id: g.guild.id })).status, 404, 'not invited');
	const j = await kim('join', { id: g.guild.id });
	assert.equal(j.status, 200); assert.equal(j.guild.members.length, 2);
	assert.equal((await kim('mine')).invites.length, 0);
	// usernames stay private: members are a player name and an id
	const seen = (await kim('mine')).guild;
	assert.ok(!JSON.stringify(seen).includes('josh'), 'kim never sees josh\'s username');
	const joshId = seen.members.find((m) => !m.me).id, kimId = seen.members.find((m) => m.me).id;
	assert.match(joshId, /^p[0-9a-f]{12}$/);
	// ranks: only the leader
	assert.equal((await kim('invite', { to: 'ari' })).status, 403, 'a member cannot invite');
	assert.equal((await kim('rank', { id: joshId, rank: 'member' })).status, 403);
	assert.equal((await josh('rank', { id: kimId, rank: 'officer' })).status, 200);
	const inv = await kim('invite', { to: 'ari' });
	assert.equal(inv.status, 200, 'an officer can');
	assert.equal(inv.guild.invites[0].name, 'ari', 'the one who invited sees whom');
	assert.ok(!JSON.stringify((await josh('mine')).guild.invites).includes('"ari"'), 'the others do not');
	assert.equal((await ari('decline', { id: g.guild.id })).status, 200);
	assert.equal((await ari('mine')).invites.length, 0);
	// the leader leaves: the officer leads
	assert.equal((await josh('leave')).status, 200);
	const after = await kim('mine');
	assert.equal(after.guild.members.length, 1); assert.equal(after.guild.members[0].rank, 'leader');
	assert.equal((await josh('mine')).guild, null);
	// the last one out: gone, and its name free again
	assert.equal((await kim('leave')).disbanded, true);
	assert.equal((await ari('found', { name: 'Bay Bards', tag: 'BB' })).status, 200);
});

test('alliances: offered, accepted, ended', async () => {
	const W = world(), josh = await player(W, 'josh'), kim = await player(W, 'kim');
	const a = (await josh('found', { name: 'Bay Bards', tag: 'BB' })).guild, b = (await kim('found', { name: 'Fog Watch', tag: 'FOG' })).guild;
	assert.equal((await josh('ally', { tag: 'ZZZ' })).status, 404);
	assert.equal((await josh('ally', { tag: 'BB' })).status, 400, 'not your own');
	const o = await josh('ally', { tag: 'fog' });
	assert.equal(o.status, 200); assert.equal(o.guild.offered[0].tag, 'FOG'); assert.equal(o.guild.allies.length, 0);
	const k = await kim('mine');
	assert.equal(k.guild.asks[0].tag, 'BB', 'they see the offer');
	const yes = await kim('ally', { tag: 'BB' });
	assert.equal(yes.guild.allies[0].tag, 'BB'); assert.equal(yes.guild.asks.length, 0);
	assert.equal((await josh('mine')).guild.allies[0].tag, 'FOG', 'both ways');
	assert.equal((await josh('ally', { tag: 'FOG' })).status, 409, 'once');
	assert.equal((await josh('find', { tag: 'fog' })).guild.name, 'Fog Watch');
	assert.equal((await josh('list')).guilds.length, 2);
	const end = await kim('unally', { id: a.id });
	assert.equal(end.guild.allies.length, 0);
	assert.equal((await josh('mine')).guild.allies.length, 0);
	// a guild that goes leaves no alliance behind
	await kim('ally', { tag: 'BB' }); await josh('ally', { tag: 'FOG' });
	assert.equal((await josh('mine')).guild.allies.length, 1);
	await kim('leave');
	assert.equal((await josh('mine')).guild.allies.length, 0);
	assert.ok(b.id);
});

test('the game\'s client, end to end', async () => {
	const W = world();
	const s = await W.post('account/signup', { u: 'josh', p: 'correct horse battery' });
	const net = createGuildNet({ url: URL0, auth: () => ({ u: 'josh', token: s.token }), request: (url, init) => W.f(url, init) });
	assert.equal((await net.mine()).guild, null);
	const g = await net.call('found', { name: 'Bay Bards', tag: 'BB' });
	assert.equal(g.guild.name, 'Bay Bards');
	await assert.rejects(net.call('found', { name: 'Again', tag: 'AG' }), /in a guild already/);
	const nobody = createGuildNet({ url: URL0, auth: () => null, request: (url, init) => W.f(url, init) });
	await assert.rejects(nobody.mine(), /account/i);
	const old = createGuildNet({ url: URL0, auth: () => ({ u: 'josh', token: s.token }), request: (url, init) => handle(new Request(url, { ...init, headers: { ...init.headers, origin: ORIGIN } }), { ACCOUNTS: W.env.ACCOUNTS }) });
	await assert.rejects(old.mine(), (e) => e.notDeployed === true, 'an older server says so');
});
