// The discovery server: where every player's game gets the brief of a place (its districts,
// streets, signs, chatter, music...), the same for everyone. The first player to come to a
// place has it made (Workers AI, inside the free daily allowance); everyone after gets that one.
//
//   GET  /brief/:id      the kept brief, or 404 while no one has discovered the place
//   POST /discover       { id, lat, lon, name, pop } -> the brief (made now if need be), or 202
//                        while it is still being made; 429 / 403 say use the atlas brief for now
//   POST /talk           a townsperson's reply (talk.js), inside its own share of the day
//   GET  /status         the day's Neurons (no secrets, nothing about players)
//
// ids are an atlas city's ('lisbon') or a generated town's ('gen:<slug>:<lat>,<lon>'). Only the
// id and the size class ever shape what is made; the prompt is built from the server's own
// copy of the atlas (place.js). Nightly (the cron in wrangler.toml) whatever is left of the
// day's allowance goes on the biggest atlas cities no one has discovered yet.

import { BriefStore } from './store.js';
import { Ledger } from './ledger.js';
import { placeOf, citiesByPop, requestFor } from './place.js';
import { settings, worstCase, talkSettings, ask } from './ai.js';
import { npcOf, talkSystem } from './talk.js';

export { BriefStore, Ledger };

const MAX_BODY = 2048, MAX_TALK = 6144;

function origins(env) {
	const L = String(env.ALLOWED_ORIGINS || 'https://level99bard.com,https://www.level99bard.com').split(',').map((s) => s.trim()).filter(Boolean);
	const local = env.ALLOW_LOCALHOST !== 'false';
	return (o) => !!o && (L.includes(o) || (local && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o)));
}
function cors(origin, allowed) {
	const h = { 'vary': 'Origin' };
	if (allowed) Object.assign(h, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' });
	return h;
}
function reply(v, status, headers, extra = {}) {
	return new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers, ...extra } });
}
// a player, as a hash of their address and the day (kept in memory only, and only for the limit)
async function who(request, env) {
	const ip = request.headers.get('cf-connecting-ip') || '';
	const data = new TextEncoder().encode((env.IP_SALT || 'l99') + '|' + new Date().toISOString().slice(0, 10) + '|' + ip);
	const h = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
	return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const store = (env, id) => env.BRIEFS.get(env.BRIEFS.idFromName(id));
const ledger = (env) => env.LEDGER.get(env.LEDGER.idFromName('ledger'));

export async function handle(request, env) {
	const url = new URL(request.url), origin = request.headers.get('origin');
	const ok = origins(env)(origin), H = cors(origin, ok);
	if (origin && !ok) return reply({ error: 'origin not allowed' }, 403, { vary: 'Origin' });
	if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: H });

	if (request.method === 'GET' && url.pathname.startsWith('/brief/')) {
		let id;
		try { id = decodeURIComponent(url.pathname.slice(7)); } catch { return reply({ error: 'bad id' }, 400, H); }
		const P = placeOf(id);
		if (P.error) return reply({ error: P.error }, 400, H);
		const r = await store(env, P.city.id).fetch('https://store/', { method: 'GET' });
		// a kept brief never changes: it can be cached; a miss must not be
		return reply(await r.json(), r.status, H, { 'cache-control': r.status === 200 ? 'public, max-age=86400' : 'no-store' });
	}

	if (request.method === 'POST' && url.pathname === '/discover') {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return reply({ error: 'json only' }, 415, H);
		const text = await request.text();
		if (text.length > MAX_BODY) return reply({ error: 'too big' }, 413, H);
		let body;
		try { body = JSON.parse(text); } catch { return reply({ error: 'bad json' }, 400, H); }
		if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'bad request' }, 400, H);
		const P = placeOf(body.id, body);
		if (P.error) return reply({ error: P.error }, 400, H);
		// only what was checked goes on, with the player's hash: never their words
		const fwd = { id: P.city.id, lat: P.city.lat, lon: P.city.lon, pop: P.city.pop, who: await who(request, env) };
		const r = await store(env, P.city.id).fetch('https://store/discover', { method: 'POST', body: JSON.stringify(fwd) });
		return reply(await r.json(), r.status, H, { 'cache-control': 'no-store' });
	}

	if (request.method === 'POST' && url.pathname === '/talk') {
		if (!ok) return reply({ error: 'origin required' }, 403, H);
		if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return reply({ error: 'json only' }, 415, H);
		const text = await request.text();
		if (text.length > MAX_TALK) return reply({ error: 'too big' }, 413, H);
		let body;
		try { body = JSON.parse(text); } catch { return reply({ error: 'bad json' }, 400, H); }
		const T = npcOf(body);
		if (T.error) return reply({ error: T.error }, 400, H);
		return talk(env, T, await who(request, env), H);
	}

	if (request.method === 'GET' && url.pathname === '/status') {
		const r = await ledger(env).fetch('https://ledger/state');
		return reply(await r.json(), 200, H, { 'cache-control': 'no-store' });
	}
	return reply({ error: 'not found' }, 404, H);
}

// one townsperson's reply: the worst it could cost reserved first, what it did cost settled after
async function talk(env, T, player, H) {
	const S = talkSettings(env), system = talkSystem(T.npc);
	const req = { system, user: T.history.map((m) => m.content).join('\n') };
	const worst = worstCase(req, S);
	const L = ledger(env);
	const res = await (await L.fetch('https://ledger/reserve', { method: 'POST', body: JSON.stringify({ kind: 'talk', who: player, neurons: worst }) })).json();
	if (!res.ok) return reply({ error: res.reason, fallback: 'offline' }, res.reason === 'rate' ? 429 : 503, H, { 'cache-control': 'no-store' });
	const out = await ask(env.AI, req, S, { json: false, messages: T.history, temperature: 0.75 });
	await L.fetch('https://ledger/settle', { method: 'POST', body: JSON.stringify({ kind: 'talk', day: res.day, reserved: res.reserved, used: out.neurons, exhausted: out.exhausted }) });
	const said = typeof out.value === 'string' ? out.value.trim().slice(0, 600) : '';
	if (!said) return reply({ error: out.error || 'no reply', fallback: 'offline' }, 503, H, { 'cache-control': 'no-store' });
	return reply({ reply: said, neurons: out.neurons }, 200, H, { 'cache-control': 'no-store' });
}

// the nightly round: the biggest atlas cities not yet discovered, while the allowance lasts
export async function nightly(env) {
	const S = settings(env), max = Math.max(0, +env.NIGHT_MAX || 30);
	const done = new Set((await (await ledger(env).fetch('https://ledger/done-list')).json()).done);
	let made = 0;
	for (const c of citiesByPop()) {
		if (made >= max) break;
		if (done.has(c.id)) continue;
		const st = await (await ledger(env).fetch('https://ledger/state')).json();
		if (st.left < worstCase(requestFor(c), S)) break;
		const r = await store(env, c.id).fetch('https://store/discover', { method: 'POST', body: JSON.stringify({ id: c.id, night: true }) });
		if (r.status === 503) break;
		made++;
	}
	return made;
}

export default {
	fetch: (request, env) => handle(request, env).catch((err) => {
		console.error('discovery', err?.message || err);
		return reply({ error: 'server error', fallback: 'atlas' }, 500, cors(request.headers.get('origin'), origins(env)(request.headers.get('origin'))));
	}),
	scheduled: (event, env, ctx) => { ctx.waitUntil(nightly(env)); },
};
