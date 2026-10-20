// The game's chat client (island/src/net/chat-client.js) over real WebSockets, through the
// production Worker in workerd (Miniflare): world, region and group chat, a voice clip, a
// group made by invite, and a signed-in player known by their account's name.
// node test/chat-integration.test.mjs
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createChatClient } from '../../../island/src/net/chat-client.js';
import { startLocalRooms } from './local-worker.mjs';

const ORIGIN = 'http://localhost:8768', local = await startLocalRooms(), url = local.url;
class GameSocket extends WebSocket { constructor(address) { super(address, { headers: { origin: ORIGIN } }); } }
const wait = async (fn, label, timeout = 12000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await fn()) return; await new Promise((r) => setTimeout(r, 20)); } throw new Error(`Timed out: ${label}`); };
let checks = 0;
const check = (v, label) => { assert.ok(v, label); checks++; };
const people = [];
function person(id, name, region) {
	const P = { id, events: [], region };
	P.c = createChatClient({ url, id, name: () => name, region: () => P.region, rank: () => P.rank || 0, WS: GameSocket, on: (t, v) => P.events.push({ t, v }) });
	P.of = (t) => P.events.filter((e) => e.t === t).map((e) => e.v);
	people.push(P);
	return P;
}
try {
	await wait(async () => { try { return (await fetch(url + '/status', { headers: { origin: ORIGIN } })).ok; } catch { return false; } }, 'Worker boot', 30000);
	const status = await (await fetch(url + '/status', { headers: { origin: ORIGIN } })).json();
	check(status.features.includes('chat-v1'), 'the Worker advertises chat');
	const A = person('player-aaaa1', 'Ann', { id: 'bay:sf', name: 'San Francisco' }), B = person('player-bbbb1', 'Bo', { id: 'bay:sf', name: 'San Francisco' }), C = person('player-cccc1', 'Cy', { id: 'bay:oak', name: 'Oakland' });
	for (const P of people) P.c.start();
	await wait(() => people.every((P) => P.c.status === 'on'), 'all connect');
	A.c.say('world', 'hello world');
	await wait(() => C.c.log.world.some((m) => m.text === 'hello world'), 'world text reaches Oakland');
	A.c.say('region', 'hi SF');
	await wait(() => B.c.log.region.some((m) => m.text === 'hi SF'), 'region text reaches SF');
	await new Promise((r) => setTimeout(r, 200));
	check(!C.c.log.region.some((m) => m.text === 'hi SF'), 'Oakland does not hear SF');
	// Cy flies to SF: the region's texts come along
	C.region = { id: 'bay:sf', name: 'San Francisco' }; C.c.track();
	await wait(() => C.c.log.region.some((m) => m.text === 'hi SF') && C.c.region?.name === 'San Francisco', 'region history on moving');
	// a group by invite, group text, a voice clip
	A.c.invite(B.id);
	await wait(() => B.c.invites.length === 1, 'invite arrives');
	B.c.accept(B.c.invites[0].gid);
	await wait(() => A.c.group?.members.length === 2 && B.c.group?.members.length === 2, 'both in the group');
	check(A.c.leads() && !B.c.leads(), 'the inviter leads');
	B.c.say('group', 'ready when you are');
	await wait(() => A.c.log.group.some((m) => m.text === 'ready when you are'), 'group text');
	B.c.voice('group', { mime: 'audio/webm;codecs=opus', ms: 1500, data: 'T2dnUw'.repeat(30) });
	await wait(() => A.c.log.group.some((m) => m.voice?.ms === 1500), 'voice clip over the wire');
	// Cy asks to join; Ann lets them in; Ann opens a room for the group
	C.c.ask(A.id);
	await wait(() => A.c.group?.asks.some((w) => w.id === C.id), 'the ask reaches the leader');
	A.c.letIn(C.id);
	await wait(() => C.c.group?.members.length === 3, 'Cy is in');
	A.c.shareRoom('ABCDEF');
	await wait(() => C.c.group?.room === 'ABCDEF', 'the group sees the room');
	A.rank = 9; A.c.track();
	A.c.say('world', 'gold');
	await wait(() => B.c.log.world.some((m) => m.text === 'gold' && m.from.k === 9), 'the rank travels');
	// a signed-in player: their account's player name, with a tick
	const post = async (op, body, token) => (await fetch(`${url}/account/${op}`, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) })).json();
	const s = await post('signup', { u: 'bo_b', p: 'correct horse', name: 'Bo the Bard' });
	check(s.name === 'Bo the Bard', 'the account holds the player name');
	B.c.account({ u: 'bo_b', token: s.token });
	await wait(() => B.of('acct').some((v) => v.ok), 'the hub checks the account');
	B.c.say('world', 'signed in now');
	await wait(() => A.c.log.world.some((m) => m.text === 'signed in now'), 'signed-in text');
	const m = A.c.log.world.find((x) => x.text === 'signed in now');
	check(m.from.name === 'Bo the Bard' && m.from.v === 1, 'known by the account name, with the tick');
	check(!JSON.stringify(A.events).includes('bo_b'), 'the username never reaches anyone else');
	const n = await post('name', { u: 'bo_b', name: 'Bo Again' }, s.token);
	check(n.name === 'Bo Again', 'the first change is allowed');
	check((await post('name', { u: 'bo_b', name: 'Bo Thrice' }, s.token)).error?.includes('again on'), 'the second waits 30 days');
	console.log(`chat integration: ${checks} checks passed`);
} finally {
	for (const P of people) P.c.stop();
	await local.dispose();
}
