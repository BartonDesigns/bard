// The rooms server: friends playing together. The host makes a room (a six-letter code) and
// shares a link; each room is one Durable Object (room.js) that friends join by WebSocket.
// Rooms need no account: a player is an id their browser made up, and a name they chose.
//
//   GET  /status               { ok, version, maxPlayers }
//   POST /rooms                { id } -> { code }: a new room, owned by that player
//   GET  /rooms/:code/ws?id=&name=&seed=   (WebSocket) join the room
//   POST /account/:op          a player's username, password and saved progress (account.js)
//   POST /guilds/:op           guilds and their alliances, for players with an account (guild.js)

import { Room } from './room.js';
import { Soul, soulId, SOUL_TOKEN } from './soul.js';
import { SOUL_FEATURE } from '../../../island/src/reputation/sanctuary.js';
import { VERSION, MAX_PLAYERS, ID_RE, GEAR_FEATURE, PVP_FEATURE, newCode, cleanCode } from '../../../island/src/net/protocol.js';
import { REPUTATION_FEATURE } from '../../../island/src/net/reputation.js';
import { Account } from './account.js';
import { usernameOk, cleanUsername, SAVE_MAX, ACCOUNT_FEATURE } from '../../../island/src/persistence/cloud-save.js';
import { Guilds } from './guild.js';
import { GUILD_FEATURE } from '../../../island/src/guild/guild-rules.js';
import { LivingRegion, LIVING_FEATURE, COMMUNITY_FEATURE, HOUSEHOLD_FEATURE, LIVING_MAX_BYTES, livingIdentity, livingScope } from './living-region.js';

export { Room, Soul, LivingRegion, Account, Guilds };
// guild requests per address an hour, and guilds founded
const GUILD_OPS_PER_HOUR = 600, FOUNDS_PER_HOUR = 20;
// accounts made, and logins tried, per address an hour
const SIGNUPS_PER_HOUR = 10, LOGINS_PER_HOUR = 60;

// rooms made per address an hour (kept in this instance's memory only, by a hash)
const MAKE_PER_HOUR = 20;
const made = new Map();

function origins(env) {
	const L = String(env.ALLOWED_ORIGINS || 'https://level99bard.com,https://www.level99bard.com').split(',').map((s) => s.trim()).filter(Boolean);
	const local = env.ALLOW_LOCALHOST !== 'false';
	return (o) => !!o && (L.includes(o) || (local && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o)));
}
function cors(origin, allowed) {
	const h = { vary: 'Origin' };
	if (allowed) Object.assign(h, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' });
	return h;
}
const reply = (v, status, headers) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers } });
async function who(request, env) {
	const ip = request.headers.get('cf-connecting-ip') || '';
	const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode((env.IP_SALT || 'l99') + '|' + ip)));
	return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function tooMany(key, max = MAKE_PER_HOUR) {
	const now = Date.now(), hour = Math.floor(now / 3600000);
	if (made.size > 5000) made.clear();
	const m = made.get(key);
	if (!m || m.hour !== hour) { made.set(key, { hour, n: 1 }); return false; }
	return ++m.n > max;
}
const room = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));

export async function handle(request, env) {
	const url = new URL(request.url), origin = request.headers.get('origin');
	const ok = origins(env)(origin), H = cors(origin, ok);
	if (origin && !ok) return reply({ error: 'origin not allowed' }, 403, { vary: 'Origin' });
	if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: H });

	if (request.method === 'GET' && url.pathname === '/status') return reply({ ok: true, version: VERSION, maxPlayers: MAX_PLAYERS, features: ['trade-v2', GEAR_FEATURE, 'combat-v1', 'combat-guard-v1', PVP_FEATURE, REPUTATION_FEATURE, ...(env.SOULS ? [SOUL_FEATURE] : []), ...(env.LIVING ? [LIVING_FEATURE, COMMUNITY_FEATURE, HOUSEHOLD_FEATURE] : []), ...(env.ACCOUNTS ? [ACCOUNT_FEATURE] : []), ...(env.ACCOUNTS && env.GUILDS ? [GUILD_FEATURE] : [])] }, 200, H);

	const living = url.pathname.match(/^\/living\/([^/]+)\/([^/]+)$/);
	if (living && ['GET', 'POST'].includes(request.method)) {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (!env.LIVING) return reply({ error: 'Shared citizen activity is not deployed.' }, 503, H);
		const key = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
		if (!SOUL_TOKEN.test(key)) return reply({ error: 'Soul key required.' }, 401, H);
		let world, region;
		try { world = decodeURIComponent(living[1]); region = decodeURIComponent(living[2]); } catch { return reply({ error: 'Invalid region encoding.' }, 400, H); }
		if (!livingScope(world) || !livingScope(region)) return reply({ error: 'Invalid body or region.' }, 400, H);
		const length = Number(request.headers.get('content-length'));
		if (Number.isFinite(length) && length > LIVING_MAX_BYTES) return reply({ error: 'Observation batch too large.' }, 413, H);
		let body;
		if (request.method === 'POST') {
			body = await request.text();
			if (new TextEncoder().encode(body).length > LIVING_MAX_BYTES) return reply({ error: 'Observation batch too large.' }, 413, H);
		}
		const identity = await livingIdentity(await soulId(key), world, region);
		const q = new URL('https://living/state'); q.searchParams.set('world', world); q.searchParams.set('region', region);
		for (const field of ['before', 'limit']) if (url.searchParams.has(field)) q.searchParams.set(field, url.searchParams.get(field));
		const stub = env.LIVING.get(env.LIVING.idFromName(JSON.stringify([world, region])));
		const result = await stub.fetch(new Request(q, { method: request.method, headers: { 'x-living-player': identity, 'content-type': 'application/json' }, ...(body !== undefined ? { body } : {}) }));
		return new Response(result.body, { status: result.status, headers: { ...H, 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
	}

	if (url.pathname === '/souls/me' && ['GET', 'POST'].includes(request.method)) {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (!env.SOULS) return reply({ error: 'Cloud reputation is not deployed.' }, 503, H);
		const key = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
		if (!SOUL_TOKEN.test(key)) return reply({ error: 'Soul key required.' }, 401, H);
		const id = await soulId(key), stub = env.SOULS.get(env.SOULS.idFromName(id));
		const result = await stub.fetch(new Request('https://soul/me', request));
		return new Response(result.body, { status: result.status, headers: { ...H, 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
	}

	const acct = url.pathname.match(/^\/account\/(signup|login|reset|save|load|peek|logout)$/);
	if (acct && request.method === 'POST') {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (!env.ACCOUNTS) return reply({ error: 'Accounts are not on the server yet.' }, 503, H);
		const limit = SAVE_MAX + 8192, length = Number(request.headers.get('content-length'));
		if (Number.isFinite(length) && length > limit) return reply({ error: 'That save is too big.' }, 413, H);
		const text = await request.text();
		if (text.length > limit) return reply({ error: 'That save is too big.' }, 413, H);
		let u;
		try { u = cleanUsername(JSON.parse(text)?.u); } catch { return reply({ error: 'bad json' }, 400, H); }
		if (!usernameOk(u)) return reply({ error: 'A username is 3 to 20 letters, digits, - or _.' }, 400, H);
		const op = acct[1];
		if (op === 'signup' && tooMany('signup:' + await who(request, env), SIGNUPS_PER_HOUR)) return reply({ error: 'Too many new accounts from here. Try again later.' }, 429, H);
		if ((op === 'login' || op === 'reset') && tooMany('login:' + await who(request, env), LOGINS_PER_HOUR)) return reply({ error: 'Too many tries from here. Try again later.' }, 429, H);
		const stub = env.ACCOUNTS.get(env.ACCOUNTS.idFromName('user:' + u));
		const result = await stub.fetch(new Request('https://account/' + op, { method: 'POST', headers: { authorization: request.headers.get('authorization') || '' }, body: text }));
		return new Response(result.body, { status: result.status, headers: { ...H, 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
	}

	const gop = url.pathname.match(/^\/guilds\/(mine|found|edit|invite|uninvite|join|decline|leave|kick|rank|ally|unally|find|list)$/);
	if (gop && request.method === 'POST') {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (!env.ACCOUNTS || !env.GUILDS) return reply({ error: 'Guilds are not on the server yet.' }, 503, H);
		const text = await request.text();
		if (text.length > 8192) return reply({ error: 'too big' }, 413, H);
		let u;
		try { u = cleanUsername(JSON.parse(text || '{}')?.u); } catch { return reply({ error: 'bad json' }, 400, H); }
		if (!usernameOk(u)) return reply({ error: 'Please log in again.' }, 401, H);
		const ip = await who(request, env);
		if (tooMany('guild:' + ip, GUILD_OPS_PER_HOUR) || (gop[1] === 'found' && tooMany('found:' + ip, FOUNDS_PER_HOUR))) return reply({ error: 'Too many tries from here. Try again later.' }, 429, H);
		// (who is signed in: their own account says, by its session)
		const me = await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('user:' + u)).fetch(new Request('https://account/whoami', { method: 'POST', headers: { authorization: request.headers.get('authorization') || '' }, body: JSON.stringify({ u }) }));
		if (me.status !== 200) return reply({ error: 'Please log in again.' }, 401, H);
		const stub = env.GUILDS.get(env.GUILDS.idFromName('registry'));
		const result = await stub.fetch(new Request('https://guild/' + gop[1], { method: 'POST', headers: { 'x-guild-user': u }, body: text }));
		return new Response(result.body, { status: result.status, headers: { ...H, 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
	}

	if (request.method === 'POST' && url.pathname === '/rooms') {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		const text = await request.text();
		if (text.length > 512) return reply({ error: 'too big' }, 413, H);
		let body;
		try { body = JSON.parse(text); } catch { return reply({ error: 'bad json' }, 400, H); }
		if (!ID_RE.test(body?.id || '')) return reply({ error: 'bad id' }, 400, H);
		if (tooMany(await who(request, env))) return reply({ error: 'too many rooms' }, 429, H);
		for (let i = 0; i < 5; i++) {
			const code = newCode(() => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
			const r = await room(env, code).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, owner: body.id }) });
			if (r.status === 200) return reply({ code }, 200, H);
		}
		return reply({ error: 'try again' }, 503, H);
	}

	const m = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})\/ws$/);
	if (m && request.method === 'GET') {
		// browsers always send their page's origin on a WebSocket: only the game's may join
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (request.headers.get('upgrade') !== 'websocket') return reply({ error: 'websocket only' }, 426, H);
		const code = cleanCode(m[1]);
		if (!code) return reply({ error: 'bad code' }, 400, H);
		const q = new URL('https://room/ws');
		for (const k of ['id', 'name', 'seed']) q.searchParams.set(k, (url.searchParams.get(k) || '').slice(0, 64));
		return room(env, code).fetch(new Request(q, request));
	}
	return reply({ error: 'not found' }, 404, H);
}

export default { fetch: (request, env) => handle(request, env) };
