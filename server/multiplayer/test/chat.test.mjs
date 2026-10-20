// Node checks for the chat hub (src/chat.js), with the Durable Object's state and sockets stood in
// for, and the shared cleaners (island/src/net/chat-protocol.js).
// node --test test/chat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatHub, CHAT_CLOSE } from '../src/chat.js';
import { handle } from '../src/index.js';
import { cleanVoice, cleanWho, cleanGroup, cleanText, clashes, whoLabel, nameStyle, GROUP_MAX, HISTORY_MAX, CHAT_FEATURE } from '../../../island/src/net/chat-protocol.js';

function storage() {
	const M = new Map();
	return { M, alarm: null, get: async (k) => structuredClone(M.get(k)), put: async (k, v) => { M.set(k, structuredClone(v)); }, delete: async (k) => M.delete(k), setAlarm: async function (t) { this.alarm = t; } };
}
function socket() {
	let att = null;
	const ws = { sent: [], closed: null, send(m) { if (this.closed) throw new Error('closed'); this.sent.push(typeof m === 'string' && m[0] === '{' ? JSON.parse(m) : m); }, close(code, reason) { if (!this.closed) this.closed = { code, reason }; }, serializeAttachment(a) { att = structuredClone(a); }, deserializeAttachment() { return structuredClone(att); } };
	ws.of = (t) => ws.sent.filter((m) => m?.t === t);
	ws.last = (t) => ws.of(t).at(-1);
	return ws;
}
// a stand-in account: a session token per username, and the name the account holds
function accounts(users) {
	return { idFromName: (n) => n, get: (n) => ({ fetch: async (req) => {
		const u = users[n.replace(/^user:/, '')], tok = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
		return u && u.token === tok ? Response.json({ rev: 0, at: 0, name: u.name, nameAt: 0 }) : Response.json({ error: 'Please log in again.' }, { status: 401 });
	} }) };
}
function hub(env = {}) {
	const list = [], st = { storage: storage(), acceptWebSocket: (ws) => list.push(ws), getWebSockets: () => list.filter((w) => !w.closed) };
	return { H: new ChatHub(st, env), st };
}
async function join(H, id, name = id, r = 'bay:sf', rn = 'San Francisco', k = 0) { const ws = socket(); await H.connect(ws, { id, name, r, rn, k: String(k) }); return ws; }
const say = (H, ws, m) => H.webSocketMessage(ws, JSON.stringify(m));
const T = '0123456789abcdef'.repeat(4);

test('the cleaners keep only what may travel', () => {
	assert.equal(cleanText('  hi\u0000 there\n\nfriend  '), 'hi there friend');
	assert.equal(cleanText('x'.repeat(500)).length, 240);
	assert.equal(cleanVoice({ ch: 'world', mime: 'text/html', ms: 2000, data: 'A'.repeat(100) }), null);
	assert.equal(cleanVoice({ ch: 'world', mime: 'audio/webm;codecs=opus', ms: 60000, data: 'A'.repeat(100) }), null);
	assert.equal(cleanVoice({ ch: 'world', mime: 'audio/webm;codecs=opus', ms: 2000, data: 'A'.repeat(100) + '<' }), null);
	assert.ok(cleanVoice({ ch: 'group', mime: 'audio/mp4', ms: 2000, data: 'A'.repeat(100) }));
	assert.deepEqual(cleanWho({ id: 'player-aaaa', name: 'Jo<b>', n: 5, k: 99, acct: 'secret' }), { id: 'player-aaaa', name: 'Job', n: 100 });
	assert.equal(cleanWho({ id: 'x', name: 'J' }), null);
	assert.equal(cleanGroup({ gid: 'bad', members: [] }), null);
});

test('names that clash get their number; honor shows in the name', () => {
	const a = { id: 'player-aaaa', name: 'Josh', n: 101 }, b = { id: 'player-bbbb', name: 'josh', n: 202 }, c = { id: 'player-cccc', name: 'Mo', n: 303 };
	const C = clashes([a, b, c, a]);
	assert.equal(whoLabel(a, C), 'Josh#101');
	assert.equal(whoLabel(c, C), 'Mo');
	// the same signed-in person in two tabs is one person
	assert.equal(clashes([{ ...a, v: 1 }, { ...a, id: 'player-dddd', v: 1 }]).size, 0);
	assert.equal(nameStyle({ k: 2 }), '');
	assert.equal(nameStyle({ k: 3 }), 'bold');
	assert.equal(nameStyle({ k: 9 }), 'exalted');
});

test('world, region and group each reach the right people', async () => {
	const { H } = hub();
	const A = await join(H, 'player-aaaa', 'Ann'), B = await join(H, 'player-bbbb', 'Bo'), C = await join(H, 'player-cccc', 'Cy', 'bay:oak', 'Oakland');
	assert.equal(A.last('welcome').features[0], CHAT_FEATURE);
	await say(H, A, { t: 'say', ch: 'world', text: 'hello all' });
	assert.equal(C.last('said')?.text, 'hello all');
	assert.equal(C.last('said').from.name, 'Ann');
	await say(H, A, { t: 'say', ch: 'region', text: 'anyone in SF?' });
	assert.equal(B.last('said').text, 'anyone in SF?');
	assert.equal(B.last('said').r, 'San Francisco');
	assert.equal(C.last('said').text, 'hello all', 'Oakland does not hear San Francisco');
	await say(H, A, { t: 'say', ch: 'group', text: 'team?' });
	assert.match(A.last('note').text, /not in a group/);
	// a new arrival hears the latest world and region texts
	const D = await join(H, 'player-dddd', 'Di');
	assert.deepEqual(D.last('welcome').history.world.map((m) => m.text), ['hello all']);
	assert.deepEqual(D.last('welcome').history.region.map((m) => m.text), ['anyone in SF?']);
	// moving region brings that region's texts
	await say(H, C, { t: 'where', r: 'bay:sf', rn: 'San Francisco' });
	assert.equal(C.last('history').list[0].text, 'anyone in SF?');
});

test('texts are rate limited and history is bounded', async () => {
	const { H } = hub();
	const A = await join(H, 'player-aaaa'), B = await join(H, 'player-bbbb');
	for (let i = 0; i < 8; i++) await say(H, A, { t: 'say', ch: 'world', text: 'm' + i });
	assert.equal(B.of('said').length, 5, 'a burst of five, then one a second');
	assert.match(A.last('note').text, /Slow down/);
	H.bucket.clear();
	for (let i = 0; i < HISTORY_MAX + 10; i++) { H.bucket.clear(); await say(H, A, { t: 'say', ch: 'world', text: 'h' + i }); }
	assert.equal((await H.store.get('h:world')).length, HISTORY_MAX);
	// a flood closes the socket
	for (let i = 0; i < 200 && !A.closed; i++) await H.webSocketMessage(A, '{"t":"who"}');
	assert.equal(A.closed?.code, CHAT_CLOSE.tooFast);
	// too big
	const C = await join(H, 'player-cccc');
	await H.webSocketMessage(C, 'x'.repeat(200000));
	assert.equal(C.closed?.code, CHAT_CLOSE.tooBig);
});

test('voice clips are passed on, never kept', async () => {
	const { H } = hub();
	const A = await join(H, 'player-aaaa'), B = await join(H, 'player-bbbb');
	await say(H, A, { t: 'voice', ch: 'world', mime: 'audio/webm;codecs=opus', ms: 1800, data: 'QUJD'.repeat(40) });
	assert.equal(B.last('voice').ms, 1800);
	assert.equal(B.last('voice').from.id, 'player-aaaa');
	assert.equal(await H.store.get('h:world'), undefined);
});

test('groups: invite and accept, ask and let in, lead, kick, leave, play together', async () => {
	const { H } = hub();
	const A = await join(H, 'player-aaaa', 'Ann'), B = await join(H, 'player-bbbb', 'Bo'), C = await join(H, 'player-cccc', 'Cy');
	// inviting makes a group for you
	await say(H, A, { t: 'g-invite', to: 'player-bbbb' });
	const g = A.last('group').g;
	assert.equal(g.leader, 'player-aaaa');
	assert.equal(g.name, "Ann's group");
	const inv = B.last('invites').list[0];
	assert.equal(inv.gid, g.gid);
	await say(H, B, { t: 'g-accept', gid: g.gid });
	assert.equal(B.last('group').g.members.length, 2);
	assert.ok(B.last('said').text.includes('Bo joined'));
	// group texts reach members only
	await say(H, B, { t: 'say', ch: 'group', text: 'ready' });
	assert.equal(A.last('said').text, 'ready');
	assert.notEqual(C.last('said')?.text, 'ready');
	// Cy asks to join; only the leader may let them in
	await say(H, C, { t: 'g-ask', to: 'player-bbbb' });
	assert.equal(A.last('group').g.asks[0].id, 'player-cccc');
	await say(H, B, { t: 'g-let', id: 'player-cccc' });
	assert.equal(A.last('group').g.members.length, 2, 'not the leader: nothing happens');
	await say(H, A, { t: 'g-let', id: 'player-cccc' });
	assert.equal(C.last('group').g.members.length, 3);
	// the leader shares a room, hands over the lead, then the new leader asks Cy out
	await say(H, A, { t: 'g-room', code: 'ABCDEF' });
	assert.equal(C.last('group').g.room, 'ABCDEF');
	await say(H, A, { t: 'g-lead', id: 'player-bbbb' });
	assert.equal(C.last('group').g.leader, 'player-bbbb');
	await say(H, B, { t: 'g-kick', id: 'player-cccc' });
	assert.equal(C.last('group').g, null);
	assert.equal(A.last('group').g.members.length, 2);
	// leaving: the last one out ends the group
	await say(H, A, { t: 'g-leave' });
	await say(H, B, { t: 'g-leave' });
	assert.equal(await H.store.get('g:' + g.gid), undefined);
	assert.deepEqual(await H.store.get('groups'), []);
});

test('groups hold at most GROUP_MAX and an invite can be turned down', async () => {
	const { H } = hub();
	const P = [];
	for (let i = 0; i < GROUP_MAX + 2; i++) P.push(await join(H, 'player-' + String(i).padStart(4, '0')));
	for (let i = 1; i < P.length; i++) { await say(H, P[0], { t: 'g-invite', to: 'player-' + String(i).padStart(4, '0') }); H.bucket.clear(); }
	const gid = P[0].last('group').g.gid;
	for (let i = 1; i < P.length; i++) await say(H, P[i], { t: 'g-accept', gid });
	assert.equal(P[0].last('group').g.members.length, GROUP_MAX);
	assert.match(P[P.length - 1].last('note').text, /full/);
	const { H: H2 } = hub();
	const A = await join(H2, 'player-aaaa', 'Ann'), B = await join(H2, 'player-bbbb', 'Bo');
	await say(H2, A, { t: 'g-invite', to: 'player-bbbb' });
	await say(H2, B, { t: 'g-decline', gid: A.last('group').g.gid });
	assert.match(A.last('note').text, /no thanks/);
	assert.equal(B.last('invites').list.length, 0);
});

test('a signed-in player is known by their account name, and keeps their group on a new tab', async () => {
	const { H } = hub({ ACCOUNTS: accounts({ josh: { token: T, name: 'Josh B' } }) });
	const A = await join(H, 'player-aaaa', 'Anyone'), B = await join(H, 'player-bbbb', 'Bo');
	await say(H, A, { t: 'acct', u: 'josh', token: 'f'.repeat(64) });
	assert.equal(A.last('acct').ok, false);
	await say(H, A, { t: 'acct', u: 'josh', token: T });
	assert.equal(A.last('acct').me.name, 'Josh B');
	assert.equal(A.last('acct').me.v, 1);
	assert.ok(!JSON.stringify(A.sent).includes('"josh"'), 'the username never travels back');
	// (a signed-in name changes at the account, not here)
	await say(H, A, { t: 'name', name: 'Imposter' });
	await say(H, A, { t: 'say', ch: 'world', text: 'hi' });
	assert.equal(B.last('said').from.name, 'Josh B');
	assert.equal(B.last('said').from.v, 1);
	await say(H, A, { t: 'g-invite', to: 'player-bbbb' });
	const gid = A.last('group').g.gid;
	await say(H, B, { t: 'g-accept', gid });
	// the tab closes; a new one signs in and is still in the group, still leading
	A.close(1000); await H.webSocketClose(A);
	const A2 = await join(H, 'player-zzzz', 'Anyone');
	await say(H, A2, { t: 'acct', u: 'josh', token: T });
	const g = B.last('group').g;
	assert.ok(g.members.some((m) => m.id === 'player-zzzz'));
	assert.equal(g.leader, 'player-zzzz');
	assert.ok(!g.members.some((m) => m.id === 'player-aaaa'));
	// the number beside a signed-in name is the same on any tab
	assert.equal(A2.last('acct').me.n, A.last('acct').me.n);
});

test('honor rank travels with the name', async () => {
	const { H } = hub();
	const A = await join(H, 'player-aaaa', 'Ann', 'bay:sf', 'SF', 4), B = await join(H, 'player-bbbb');
	await say(H, A, { t: 'say', ch: 'world', text: 'hi' });
	assert.equal(B.last('said').from.k, 4);
	await say(H, A, { t: 'rank', k: 99 });
	H.bucket.clear();
	await say(H, A, { t: 'say', ch: 'world', text: 'again' });
	assert.equal(B.last('said').from.k, 9);
});

test('who is online, by name or near you first', async () => {
	const { H } = hub();
	const A = await join(H, 'player-aaaa', 'Ann'), _B = await join(H, 'player-bbbb', 'Bob', 'bay:oak', 'Oakland'), _C = await join(H, 'player-cccc', 'Cass');
	await say(H, A, { t: 'who' });
	const w = A.last('who');
	assert.equal(w.online, 3);
	assert.deepEqual(w.players.map((p) => p.name), ['Cass', 'Bob']);
	await say(H, A, { t: 'who', q: 'bo' });
	assert.deepEqual(A.last('who').players.map((p) => p.name), ['Bob']);
});

test('the Worker: chat on /status, and only the game may join', async () => {
	const env = { CHAT: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('hub') }) } };
	const s = await (await handle(new Request('https://x/status', { headers: { origin: 'https://level99bard.com' } }), env)).json();
	assert.ok(s.features.includes(CHAT_FEATURE));
	const bad = await handle(new Request('https://x/chat/ws?id=player-aaaa', { headers: { origin: 'https://evil.example', upgrade: 'websocket' } }), env);
	assert.equal(bad.status, 403);
	const none = await handle(new Request('https://x/chat/ws?id=player-aaaa', { headers: { origin: 'https://level99bard.com', upgrade: 'websocket' } }), {});
	assert.equal(none.status, 503);
	const okr = await handle(new Request('https://x/chat/ws?id=player-aaaa', { headers: { origin: 'https://level99bard.com', upgrade: 'websocket' } }), env);
	assert.equal(await okr.text(), 'hub');
});
