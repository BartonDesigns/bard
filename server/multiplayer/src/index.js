// The rooms server: friends playing together. The host makes a room (a six-letter code) and
// shares a link; each room is one Durable Object (room.js) that friends join by WebSocket.
// No accounts: a player is an id their browser made up, and a name they chose.
//
//   GET  /status               { ok, version, maxPlayers }
//   POST /rooms                { id } -> { code }: a new room, owned by that player
//   GET  /rooms/:code/ws?id=&name=&seed=   (WebSocket) join the room

import { Room } from './room.js';
import { VERSION, MAX_PLAYERS, ID_RE, newCode, cleanCode } from '../../../island/src/net/protocol.js';

export { Room };

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
	if (allowed) Object.assign(h, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' });
	return h;
}
const reply = (v, status, headers) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers } });
async function who(request, env) {
	const ip = request.headers.get('cf-connecting-ip') || '';
	const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode((env.IP_SALT || 'l99') + '|' + ip)));
	return [...h.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function tooMany(key) {
	const now = Date.now(), hour = Math.floor(now / 3600000);
	if (made.size > 5000) made.clear();
	const m = made.get(key);
	if (!m || m.hour !== hour) { made.set(key, { hour, n: 1 }); return false; }
	return ++m.n > MAKE_PER_HOUR;
}
const room = (env, code) => env.ROOMS.get(env.ROOMS.idFromName(code));

export async function handle(request, env) {
	const url = new URL(request.url), origin = request.headers.get('origin');
	const ok = origins(env)(origin), H = cors(origin, ok);
	if (origin && !ok) return reply({ error: 'origin not allowed' }, 403, { vary: 'Origin' });
	if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: H });

	if (request.method === 'GET' && url.pathname === '/status') return reply({ ok: true, version: VERSION, maxPlayers: MAX_PLAYERS, features: ['trade-v2', 'combat-v1', 'combat-guard-v1'] }, 200, H);

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
