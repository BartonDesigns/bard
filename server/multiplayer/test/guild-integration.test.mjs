// Guilds in the production Worker, run in workerd (Miniflare) with real SQLite-backed Durable
// Object storage: two accounts, a guild founded and joined, two guilds allied, the list.
// node test/guild-integration.test.mjs   (local only: nothing reaches the live server)
import assert from 'node:assert/strict';
import { startLocalRooms } from './local-worker.mjs';

const ORIGIN = 'http://localhost:8768', local = await startLocalRooms(), url = local.url;
const post = (path, body, token) => fetch(`${url}/${path}`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
async function player(u) {
	const s = await post('account/signup', { u, p: 'correct horse ' + u });
	assert.equal(s.status, 200, 'signup ' + u);
	return (op, body = {}) => post('guilds/' + op, { u, ...body }, s.token);
}
try {
	const st = await (await fetch(`${url}/status`, { headers: { origin: ORIGIN } })).json();
	assert.ok(st.features.includes('guilds-v1'));
	const josh = await player('josh'), kim = await player('kim');
	const a = await josh('found', { name: 'Bay Bards', tag: 'BB', npcs: [{ name: 'Maria Lopez', role: 'healer', level: 3 }] });
	assert.equal(a.status, 200); assert.equal(a.guild.npcs[0].name, 'Maria Lopez');
	assert.equal((await josh('invite', { to: 'kim' })).status, 200);
	assert.equal((await kim('join', { id: a.guild.id })).guild.members.length, 2);
	assert.equal((await kim('leave')).status, 200);
	await kim('found', { name: 'Fog Watch', tag: 'FOG' });
	await josh('ally', { tag: 'FOG' });
	assert.equal((await kim('ally', { tag: 'BB' })).guild.allies[0].tag, 'BB');
	assert.equal((await josh('list')).guilds.length, 2);
	assert.equal((await post('guilds/mine', { u: 'josh' }, 'a'.repeat(64))).status, 401);
	console.log('guild Worker integration: founded, invited, joined, left, allied and listed in workerd');
} finally { await local.dispose(); }
