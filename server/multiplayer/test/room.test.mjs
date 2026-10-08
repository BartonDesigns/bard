// Node checks for the rooms server, with the Durable Object's state and sockets stood in for.
// node test/room.test.mjs   (no network, no account)
import { handle, Room } from '../src/index.js';
import { CLOSE } from '../src/room.js';
import { MAX_PLAYERS, BURST, MAX_BYTES, STALE_MS, cleanEvent, cleanPose, cleanState, cleanFx, cleanHit, cleanCombatState, cleanRules } from '../../../island/src/net/protocol.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };
const section = (s) => console.log('\n== ' + s);

// ---------- stand-ins ----------
function storage() {
	const M = new Map();
	return { M, alarm: null, get: async (k) => structuredClone(M.get(k)), put: async (k, v) => { M.set(k, structuredClone(v)); }, deleteAll: async () => M.clear(), setAlarm: async function (t) { this.alarm = t; } };
}
function socket() {
	let att = null;
	const ws = { sent: [], closed: null, send(m) { if (this.closed) throw new Error('closed'); this.sent.push(typeof m === 'string' && m[0] === '{' ? JSON.parse(m) : m); }, close(code, reason) { if (!this.closed) this.closed = { code, reason }; }, serializeAttachment(a) { att = structuredClone(a); }, deserializeAttachment() { return structuredClone(att); } };
	ws.of = (t) => ws.sent.filter((m) => m?.t === t);
	return ws;
}
function roomState() {
	const list = [];
	return { storage: storage(), list, acceptWebSocket: (ws) => list.push(ws), getWebSockets: () => list.filter((w) => !w.closed) };
}
async function makeRoom(owner = 'owner-aaaa') {
	const st = roomState(), R = new Room(st, {});
	const r = await R.fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ code: 'ABCDEF', owner }) }));
	return { R, st, r };
}
async function join(R, id, name = id, seed = 42) { const ws = socket(); await R.connect(ws, { id, name, seed: String(seed) }); return ws; }
const say = (R, ws, m) => R.webSocketMessage(ws, typeof m === 'string' ? m : JSON.stringify(m));
const bye = async (R, ws) => { ws.close(1000); await R.webSocketClose(ws, 1000, '', true); };

// ---------- rooms ----------
section('rooms');
{
	const { R, r } = await makeRoom();
	ok(r.status === 200, 'init answers 200');
	const again = await R.fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ code: 'ABCDEF', owner: 'other-bbbb' }) }));
	ok(again.status === 409, 'a live code cannot be taken again');
	const bad = await new Room(roomState(), {}).fetch(new Request('https://room/init', { method: 'POST', body: JSON.stringify({ code: 'ABCDEF', owner: 'x' }) }));
	ok(bad.status === 400, 'a bad owner id is refused');
	// a room that was never made
	const lone = new Room(roomState(), {}), ws = socket();
	await lone.connect(ws, { id: 'guest-cccc', name: 'G' });
	ok(ws.closed?.code === CLOSE.noRoom, 'joining an unmade room closes 4404');
	const { R: R2 } = await makeRoom();
	const w2 = socket(); await R2.connect(w2, { id: 'no', name: 'G' });
	ok(w2.closed?.code === 1008, 'a bad player id is refused');
}

// ---------- presence ----------
section('presence');
{
	const { R } = await makeRoom();
	const host = await join(R, 'owner-aaaa', 'Josh', 7);
	const w = host.of('welcome')[0];
	ok(w && w.you === 'owner-aaaa' && w.host === 'owner-aaaa' && w.code === 'ABCDEF' && w.players.length === 1, 'the owner is welcomed as host');
	const g = await join(R, 'guest-bbbb', 'Sam<script>', 99);
	const gw = g.of('welcome')[0];
	ok(gw.players.length === 2 && gw.host === 'owner-aaaa', 'a guest sees both and who hosts');
	const j = host.of('join')[0];
	ok(j?.player.id === 'guest-bbbb' && j.player.name === 'Samscript' && j.player.look.seed === 99, 'the host hears the join, the name cleaned');
	// poses pass to the others only
	await say(R, host, { t: 'pose', p: [10.123, 2, -5], y: 1.5, a: 'walk', v: 'car', w: 'earth', extra: 'dropped' });
	const p = g.of('pose')[0];
	ok(p && p.id === 'owner-aaaa' && p.p[0] === 10.12 && p.a === 'walk' && p.v === 'car' && !('extra' in p), 'a pose reaches the guest, cleaned');
	ok(!host.of('pose').length, 'not echoed to its sender');
	await say(R, host, { t: 'pose', p: [1, 2], y: 0 });
	ok(g.of('pose').length === 1, 'a malformed pose is dropped');
	// spots
	await say(R, g, { t: 'spot', code: 'eyJ2IjoxfQ' });
	ok(host.of('spot')[0]?.code === 'eyJ2IjoxfQ', 'a spot code is passed on');
	await say(R, g, { t: 'spot', code: 'bad code!' });
	ok(host.of('spot').length === 1, 'a bad spot code is dropped');
	// a third joining sees the latest pose
	const k = await join(R, 'third-cccc', 'Kim');
	const kw = k.of('welcome')[0];
	ok(kw.players.find((x) => x.id === 'owner-aaaa')?.pose?.p[0] === 10.12, 'a late joiner gets the last poses');
	// reconnect: same id replaces the old socket without a second seat
	const g2 = await join(R, 'guest-bbbb', 'Sam');
	ok(g.closed?.code === CLOSE.replaced && R.sockets().length === 3, 'a reconnect replaces the old socket');
	ok(g2.of('welcome')[0].players.length === 3, 'and is welcomed back');
	await bye(R, k);
	ok(host.of('leave').some((m) => m.id === 'third-cccc'), 'a leave is announced');
}

// ---------- the host's world ----------
section('host state and events');
{
	const { R, st } = await makeRoom();
	const host = await join(R, 'owner-aaaa');
	const g = await join(R, 'guest-bbbb');
	await say(R, g, { t: 'state', s: { hours: 3 } });
	ok(!host.of('state').length && !(await st.storage.get('meta')).shared, 'a guest cannot set the world');
	await say(R, host, { t: 'state', s: { hours: 18.25, clock: 42.25, speed: 1, weather: { mode: 'storm', day: 3 }, secret: 1 } });
	const s = g.of('state')[0]?.s;
	ok(s && s.hours === 18.25 && s.weather.mode === 'storm' && s.weather.day === 3 && s.clock === 42.25 && !('secret' in s), 'the host sets the hour and weather');
	ok((await st.storage.get('meta')).shared.hours === 18.25, 'kept in storage');
	const ev = { id: 'meet-3', npcName: 'Rosa', place: { name: 'Dolores Park', pos: { x: 100, y: 5, z: -200, lat: 37.76, lon: -122.43 }, radius: 20 }, due: 40.5, status: 'agreed', gathering: { kind: 'concert', title: 'Concert', size: 14, seed: 1234 }, transcript: 'never shared', history: ['x'] };
	await say(R, host, { t: 'event', e: ev });
	const e = g.of('event')[0]?.e;
	ok(e && e.kind === 'gathering' && e.gathering.seed === 1234 && e.place.name === 'Dolores Park', 'a gathering reaches the guest');
	ok(!('transcript' in e) && !('history' in e) && !JSON.stringify(e).includes('never shared'), 'nothing of a conversation travels');
	await say(R, g, { t: 'event', e: { ...ev, id: 'meet-9' } });
	ok(host.of('event').length === 0, 'a guest cannot add events');
	await say(R, host, { t: 'event', e: { ...ev, status: 'cancelled' } });
	ok((await st.storage.get('meta')).events.length === 1 && (await st.storage.get('meta')).events[0].status === 'cancelled', 'an event updates in place');
	for (let i = 0; i < 40; i++) await say(R, host, { t: 'event', e: { ...ev, id: 'm' + i } });
	ok((await st.storage.get('meta')).events.length <= 30, 'events are capped');
	const late = await join(R, 'late-dddd');
	const lw = late.of('welcome')[0];
	ok(lw.state?.hours === 18.25 && lw.events.length > 0, 'a late joiner gets the world and the plans');
}

// ---------- host promotion ----------
section('host promotion');
{
	const { R, st } = await makeRoom();
	const host = await join(R, 'owner-aaaa');
	const a = await join(R, 'guest-aaaa');
	await new Promise((r) => setTimeout(r, 5));
	const b = await join(R, 'guest-bbbb');
	await bye(R, host);
	ok(a.of('host').at(-1)?.id === 'guest-aaaa' && b.of('host').at(-1)?.id === 'guest-aaaa', 'the longest here takes over');
	ok((await st.storage.get('meta')).host === 'guest-aaaa', 'kept');
	await say(R, a, { t: 'state', s: { hours: 6 } });
	ok(b.of('state').at(-1)?.s.hours === 6, 'the new host sets the world');
	const back = await join(R, 'owner-aaaa');
	ok(back.of('welcome')[0].host === 'owner-aaaa' && a.of('host').at(-1)?.id === 'owner-aaaa', 'the owner takes the seat back on return');
	await say(R, back, { t: 'host', id: 'guest-bbbb' });
	ok(a.of('host').at(-1)?.id === 'guest-bbbb', 'the host can hand over');
	await say(R, back, { t: 'end' });
	ok(!a.of('end').length, 'only the host can end it');
	await say(R, b, { t: 'end' });
	ok(a.closed?.code === CLOSE.ended && back.closed?.code === CLOSE.ended, 'the host ends the room for all');
	const late = await join(R, 'late-eeee');
	ok(late.closed?.code === CLOSE.noRoom, 'an ended room takes no one');
	await R.alarm();
	ok(!(await st.storage.get('meta')), 'and is forgotten');
}

// ---------- trading ----------
section('trading');
const LAMP = { u: 'lamp-0001', i: 'camp-lantern', l: 3, t: 2, x: 40 };
const BIG = Array.from({ length: 12 }, (_, i) => ({ u: 'abcdefghijklmnopqrstu' + String(i).padStart(3, '0'), i: 'station-signal-flare', l: 10, t: 4, x: 999999 }));
{
	const { R } = await makeRoom();
	const a = await join(R, 'owner-aaaa', 'Ann'), b = await join(R, 'guest-bbbb', 'Ben'), c = await join(R, 'third-cccc', 'Cat');
	await say(R, a, { t: 'trade', op: 'propose', id: 'tr-123456', to: 'guest-bbbb', extra: 'dropped' });
	const got = b.of('trade')[0];
	ok(got && got.from === 'owner-aaaa' && got.op === 'propose' && got.id === 'tr-123456' && !('to' in got) && !('extra' in got), 'a trade reaches its one peer, from its sender, cleaned');
	ok(!c.of('trade').length && !a.of('trade').length, 'no one else hears it, nor the sender');
	const ack = a.of('trade-ack')[0];
	ok(ack && ack.id === 'tr-123456' && ack.op === 'propose' && ack.there === true && ack.to === 'guest-bbbb', 'the sender is told it was passed on');
	await say(R, b, { t: 'trade', op: 'update', id: 'tr-123456', to: 'owner-aaaa', v: 1, side: { credits: 50, items: [LAMP, { ...LAMP, u: 'lamp-0002', l: 9, t: 4 }] } });
	const up = a.of('trade')[0];
	ok(up?.side.credits === 50 && up.side.items.length === 2 && up.side.items[1].l === 9 && up.side.items[1].t === 4 && up.v === 1, 'an offer travels with its credits and item instances, levels and tiers');
	await say(R, a, { t: 'trade', op: 'accept', id: 'tr-123456', to: 'guest-bbbb', key: '0.1', sides: { a: { credits: 0, items: [] }, b: { credits: 50, items: [LAMP] } } });
	ok(b.of('trade')[1]?.key === '0.1' && b.of('trade')[1].sides.b.credits === 50, 'a confirmation carries the version and both sides');
	const n = b.of('trade').length;
	for (const bad of [
		{ t: 'trade', op: 'steal', id: 'tr-123456', to: 'guest-bbbb' },
		{ t: 'trade', op: 'update', id: 'x', to: 'guest-bbbb' },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: -5 } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: [{ ...LAMP, i: 'Bad Item!' }] } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: Array.from({ length: 13 }, (_, i) => ({ ...LAMP, u: 'lamp-' + i })) } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: [LAMP, LAMP] } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: [{ ...LAMP, l: 11 }] } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: [{ ...LAMP, t: 5 }] } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: [{ ...LAMP, u: 'BAD ID' }] } },
		{ t: 'trade', op: 'update', id: 'tr-123456', to: 'guest-bbbb', side: { credits: 1, items: { 'camp-lantern': 1 } } },
		{ t: 'trade', op: 'accept', id: 'tr-123456', to: 'guest-bbbb', key: 'one' },
		{ t: 'trade', op: 'propose', id: 'tr-123456' },
	]) await say(R, a, bad);
	ok(b.of('trade').length === n, 'bad trades are dropped: op, id, credits, item, too many, an id twice, level, tier, item id, the old count form, key, no one addressed');
	const own = a.of('trade').length;
	await say(R, a, { t: 'trade', op: 'propose', id: 'tr-999999', to: 'owner-aaaa' });
	ok(a.of('trade').length === own && !a.of('trade-ack').some((x) => x.id === 'tr-999999'), 'not to yourself');
	await say(R, a, { t: 'trade', op: 'propose', id: 'tr-777777', to: 'gone-dddddd' });
	const miss = a.of('trade-ack').find((x) => x.id === 'tr-777777');
	ok(miss && miss.there === false, 'the sender hears when the peer is not here');
	// the rate limit applies to trades too
	const { R: R2 } = await makeRoom();
	const x = await join(R2, 'owner-aaaa'), y = await join(R2, 'guest-bbbb');
	for (let i = 0; i < BURST + 10; i++) await say(R2, x, { t: 'trade', op: 'update', id: 'tr-555555', to: 'guest-bbbb', v: i + 1, side: { credits: i } });
	ok(y.of('trade').length <= BURST + 1, 'trades share the rate limit');
	ok(MAX_BYTES >= JSON.stringify({ t: 'trade', op: 'accept', id: 'tr-123456', to: 'guest-bbbb', key: '99.99', sides: { a: { credits: 999999, items: BIG }, b: { credits: 999999, items: BIG } } }).length, 'the largest trade message fits the size limit');
	// the held item's level and tier ride the pose
	await say(R, a, { t: 'pose', p: [1, 2, 3], y: 0, a: 'idle', w: 'earth', h: 'camp-lantern', hl: 7, ht: 4 });
	const hp = b.of('pose').at(-1);
	ok(hp?.h === 'camp-lantern' && hp.hl === 7 && hp.ht === 4, 'a held item passes with its level and tier');
	await say(R, a, { t: 'pose', p: [1, 2, 3], y: 0, a: 'idle', w: 'earth', h: 'camp-lantern', hl: 70, ht: -1 });
	const hq = b.of('pose').at(-1);
	ok(hq?.h === 'camp-lantern' && !('hl' in hq) && !('ht' in hq), 'a bad level or tier is dropped');
}

// ---------- limits ----------
section('limits');
{
	const { R } = await makeRoom();
	const socks = [];
	for (let i = 0; i < MAX_PLAYERS; i++) socks.push(await join(R, 'player-' + String(i).padStart(4, '0')));
	const extra = await join(R, 'extra-zzzz');
	ok(extra.closed?.code === CLOSE.full && R.sockets().length === MAX_PLAYERS, `the room is capped at ${MAX_PLAYERS}`);
	const [x, y] = socks;
	const before = y.of('pose').length;
	for (let i = 0; i < BURST + 20; i++) await say(R, x, { t: 'pose', p: [i, 0, 0], y: 0, a: 'run' });
	const got = y.of('pose').length - before;
	ok(got >= BURST - 1 && got <= BURST + 2, `a burst is cut at about ${BURST} (got ${got})`);
	for (let i = 0; i < BURST * 3; i++) await say(R, x, { t: 'pose', p: [i, 0, 0], y: 0 });
	ok(x.closed?.code === CLOSE.tooFast, 'a flood closes the socket');
	await say(R, y, 'x'.repeat(MAX_BYTES + 1));
	ok(y.closed?.code === CLOSE.tooBig, 'an oversize message closes the socket');
}

// ---------- stale players ----------
section('stale players and empty rooms');
{
	const { R, st } = await makeRoom();
	const host = await join(R, 'owner-aaaa');
	const g = await join(R, 'guest-bbbb');
	R.seen.set('guest-bbbb', Date.now() - STALE_MS - 1000);
	await R.alarm();
	ok(g.closed?.code === CLOSE.stale && host.of('leave').some((m) => m.id === 'guest-bbbb'), 'a silent player times out');
	ok(!host.closed && st.storage.alarm > Date.now(), 'the rest stay, and the sweep goes on');
	// a ping (answered by the runtime) counts as alive
	const g2 = await join(R, 'guest-cccc');
	R.seen.set('guest-cccc', Date.now() - STALE_MS - 1000);
	st.getWebSocketAutoResponseTimestamp = (ws) => (ws === g2 ? new Date() : null);
	await R.alarm();
	ok(!g2.closed, 'pings keep a still player in');
	await bye(R, host); await bye(R, g2);
	const m = await st.storage.get('meta');
	ok(m.emptySince > 0 && st.storage.alarm >= m.emptySince, 'an empty room waits for a reconnect');
	const m2 = await st.storage.get('meta'); m2.emptySince = Date.now() - 31 * 60 * 1000; await st.storage.put('meta', m2); R.meta = null;
	await R.alarm();
	ok(!(await st.storage.get('meta')), 'then is forgotten');
}

// ---------- the Worker ----------
section('worker routes');
{
	const live = new Map();
	const env = { ALLOWED_ORIGINS: 'https://level99bard.com', ALLOW_LOCALHOST: 'true', ROOMS: { idFromName: (n) => n, get: (id) => { let o = live.get(id); if (!o) live.set(id, o = new Room(roomState(), env)); return { fetch: (u, init) => o.fetch(u instanceof Request ? u : new Request(u, init)) }; } } };
	const SITE = 'https://level99bard.com';
	const st = await handle(new Request('https://api.test/status', { headers: { origin: SITE } }), env);
	ok(st.status === 200 && (await st.json()).maxPlayers === MAX_PLAYERS, '/status');
	const mk = (origin, body = { id: 'owner-aaaa' }, ip = '203.0.113.9') => handle(new Request('https://api.test/rooms', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify(body) }), env);
	const r = await mk(SITE);
	const j = await r.json();
	ok(r.status === 200 && /^[A-Z2-9]{6}$/.test(j.code) && live.has(j.code), 'POST /rooms makes a room');
	ok(r.headers.get('access-control-allow-origin') === SITE, 'with CORS for the site');
	ok((await mk('https://evil.example')).status === 403, 'another site cannot make rooms');
	ok((await mk(SITE, { id: '?' })).status === 400, 'a bad id is refused');
	ok((await mk('http://localhost:8768')).status === 200, 'localhost may, for development');
	let last = 0;
	for (let i = 0; i < 25; i++) last = (await mk(SITE, { id: 'owner-aaaa' }, '198.51.100.1')).status;
	ok(last === 429, 'room making is rate limited per address');
	const nows = await handle(new Request(`https://api.test/rooms/${j.code}/ws?id=x`, { headers: { origin: SITE } }), env);
	ok(nows.status === 426, 'the join route wants a WebSocket');
	const evil = await handle(new Request(`https://api.test/rooms/${j.code}/ws`, { headers: { origin: 'https://evil.example', upgrade: 'websocket' } }), env);
	ok(evil.status === 403, 'another site cannot join');
}

// ---------- the cleaners ----------
section('cleaners');
ok(cleanPose({ p: [1, 2, 3], y: 0, a: 'moonwalk' }).a === 'idle', 'unknown animations idle');
ok(cleanPose({ p: [1e9, 2, 3] }) === null, 'positions are bounded');
ok(cleanState({ hours: 25.5 }).hours === 1.5, 'hours wrap');
ok(cleanEvent({ id: 'x', place: { pos: {} }, due: 1 }) === null, 'an event needs a place');
ok(cleanEvent({ id: 'x', place: { pos: { x: 1, z: 2 } }, due: 1, gathering: { kind: 'rave', size: 5, seed: 1 } }) === null, 'unknown gathering kinds are refused');

// ---------- combat: shots seen, hits reported, the host's word, the room's rules ----------
section('combat');
{
	const { R } = await makeRoom();
	const host = await join(R, 'owner-aaaa'), g1 = await join(R, 'guest-bbbb'), g2 = await join(R, 'guest-cccc');
	ok(host.of('welcome')[0].rules?.pvp === false, 'PvP is off when a room opens');
	await say(R, g1, { t: 'fx', s: [[0, 1, 0, 10, 1, 0, 2, 1]] });
	ok(g2.of('fx').length === 1 && host.of('fx').length === 1 && g1.of('fx').length === 0, 'shots go to everyone else');
	ok(g2.of('fx')[0].id === 'guest-bbbb', 'with who fired them');
	await say(R, g1, { t: 'fx', s: [[0, 0, 0, 5000, 0, 0]] });
	ok(g2.of('fx').length === 1, 'an impossible streak is dropped');
	await say(R, g1, { t: 'hit', id: 'boss:walker', d: 40, p: 'core' });
	ok(host.of('hit').length === 1 && host.of('hit')[0].from === 'guest-bbbb' && g2.of('hit').length === 0, 'a hit on a shared thing goes to the host only');
	await say(R, g1, { t: 'hit', id: 'me', to: 'guest-cccc', d: 20 });
	ok(g2.of('hit').length === 0, 'no PvP hit passes while PvP is off');
	await say(R, g1, { t: 'rules', r: { pvp: true } });
	ok(!g2.of('rules').length, 'only the host sets the rules');
	await say(R, host, { t: 'rules', r: { pvp: true } });
	ok(g1.of('rules')[0]?.r.pvp === true && g2.of('rules')[0]?.r.pvp === true, 'the host turns PvP on for all');
	await say(R, g1, { t: 'hit', id: 'me', to: 'guest-cccc', d: 20 });
	ok(g2.of('hit').length === 1 && g2.of('hit')[0].from === 'guest-bbbb' && !g2.of('hit')[0].to, 'with PvP on, a hit reaches only its player');
	await say(R, g1, { t: 'hit', id: 'me', to: 'guest-bbbb', d: 20 });
	ok(g1.of('hit').length === 0, 'nobody hits themselves');
	await say(R, g1, { t: 'cs', e: [['boss:walker', 10, 2, 0]] });
	ok(g2.of('cs').length === 0, 'only the host speaks for shared things');
	await say(R, host, { t: 'cs', e: [['boss:walker', 4000, 1, 0]], b: { id: 'boss:walker', kind: 'walker', x: 1, y: 2, z: 3 } });
	ok(g1.of('cs')[0]?.e[0][1] === 4000 && g1.of('cs')[0].b.kind === 'walker', 'the host\'s word on a boss reaches the guests');
	const late = await join(R, 'guest-dddd');
	ok(late.of('welcome')[0].rules.pvp === true, 'a late joiner is told the rules');
	await say(R, host, { t: 'rules', r: { pvp: 'yes' } });
	ok(g1.of('rules').at(-1).r.pvp === false, 'anything but true is off');
}
section('combat cleaners');
ok(cleanFx({ s: Array.from({ length: 9 }, () => [0, 0, 0, 1, 1, 1]) }) === null, 'at most 8 streaks a message');
ok(cleanFx({ s: [[0, 0, 0, 1, 1, 'x']] }) === null, 'streaks are numbers');
ok(cleanHit({ id: 'boss:walker', d: 9999 }) === null, 'damage is bounded');
ok(cleanHit({ id: '<script>', d: 1 }) === null, 'ids are plain');
ok(cleanHit({ id: 'x1', d: 5, p: 'spleen' }).p === 'body', 'unknown parts are the body');
ok(cleanCombatState({ e: [['boss:x', 5, 99, 0]] }).e[0][2] === 0, 'phases are bounded');
ok(cleanCombatState({ b: { id: 'boss:x', kind: 'dragon', x: 0, y: 0, z: 0 } }) === null, 'only the known bosses');
ok(cleanRules({ pvp: 1 }).pvp === false && cleanRules({ pvp: true }).pvp === true, 'rules: PvP only when exactly true');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
