// The ledger server for Level 99 Bard (see README.md): the source of truth for the town's money.
// Clients post what actually happened to an account (events); once a day a Cron Trigger settles
// every account that had any onto its deterministic baseline (island/src/economy/ledger-core.js)
// and keeps its balance and a daily snapshot. Workers Free plan: a Worker, one SQLite-backed
// Durable Object, one cron.
//
//   GET  /status                   { ok, pending }
//   POST /events                   { events: [[account, day, amount, kind, counterparty, base?]], profiles }
//   GET  /account/:id              the settled account: plan, state, balance, 90 daily balances
//   GET  /admin?key=               the admin page (ADMIN_KEY, a secret the owner sets)
//   GET  /admin/api/accounts       (header x-admin-key) the settled accounts
//   GET  /admin/api/account/:id    (header x-admin-key) one account
//   POST /admin/api/settle         (header x-admin-key) settle now

import { appendEvents, settleAll, accountView, accountsList, ACCOUNT_RE } from './settle.js';
import { dayOf } from '../../../island/src/economy/ledger-core.js';
import { ADMIN_HTML } from './admin.js';

export class Bank {
	constructor(ctx, env) { this.ctx = ctx; this.env = env; }
	async fetch(request) {
		const url = new URL(request.url), store = this.ctx.storage, today = dayOf(Date.now());
		const json = (v, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { 'content-type': 'application/json' } });
		if (url.pathname === '/events') return json(await appendEvents(store, await request.json(), today));
		if (url.pathname === '/settle') return json(await settleAll(store, today));
		if (url.pathname.startsWith('/account/')) { const v = await accountView(store, decodeURIComponent(url.pathname.slice(9)), today); return v ? json(v) : json({ error: 'unknown account' }, 404); }
		if (url.pathname === '/accounts') return json(await accountsList(store));
		if (url.pathname === '/status') return json({ ok: true, pending: (await store.list({ prefix: 'p:' })).size, day: today });
		return json({ error: 'not found' }, 404);
	}
}

function origins(env) {
	const L = String(env.ALLOWED_ORIGINS || 'https://level99bard.com,https://www.level99bard.com').split(',').map((s) => s.trim()).filter(Boolean);
	const local = env.ALLOW_LOCALHOST !== 'false';
	return (o) => !!o && (L.includes(o) || (local && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o)));
}
const ledger = (env) => env.BANK.get(env.BANK.idFromName('ledger'));
const inner = (env, path, init) => ledger(env).fetch(new Request('https://bank' + path, init));
// the admin key, compared without leaking its length or content through timing
function keyOk(env, given) {
	const k = String(env.ADMIN_KEY || ''), g = String(given || '');
	if (!k || k.length < 12) return false;
	let d = k.length ^ g.length;
	for (let i = 0; i < k.length; i++) d |= k.charCodeAt(i) ^ (g.charCodeAt(i) || 0);
	return d === 0;
}

export async function handle(request, env) {
	const url = new URL(request.url), origin = request.headers.get('origin'), ok = origins(env)(origin);
	const H = { vary: 'Origin', ...(ok ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-admin-key' } : {}) };
	const pass = async (r) => new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json', ...H } });
	if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: H });
	if (request.method === 'GET' && url.pathname === '/status') return pass(await inner(env, '/status'));
	if (request.method === 'POST' && url.pathname === '/events') {
		if (origin && !ok) return new Response('{"error":"origin not allowed"}', { status: 403, headers: H });
		const text = await request.text();
		if (text.length > 200000) return new Response('{"error":"too big"}', { status: 413, headers: H });
		try { JSON.parse(text); } catch { return new Response('{"error":"bad json"}', { status: 400, headers: H }); }
		return pass(await inner(env, '/events', { method: 'POST', body: text }));
	}
	if (request.method === 'GET' && url.pathname.startsWith('/account/')) {
		const id = decodeURIComponent(url.pathname.slice(9));
		if (!ACCOUNT_RE.test(id)) return new Response('{"error":"bad id"}', { status: 400, headers: H });
		return pass(await inner(env, '/account/' + encodeURIComponent(id)));
	}
	if (request.method === 'GET' && url.pathname === '/admin') return new Response(ADMIN_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY', 'cache-control': 'no-store' } });
	if (url.pathname.startsWith('/admin/api/')) {
		if (!keyOk(env, request.headers.get('x-admin-key'))) return new Response('{"error":"admin key"}', { status: 401, headers: H });
		const rest = url.pathname.slice(11);
		if (rest === 'accounts') return pass(await inner(env, '/accounts'));
		if (rest === 'settle' && request.method === 'POST') return pass(await inner(env, '/settle', { method: 'POST' }));
		if (rest.startsWith('account/')) return pass(await inner(env, '/account/' + rest.slice(8)));
	}
	return new Response('{"error":"not found"}', { status: 404, headers: H });
}

export default {
	fetch: handle,
	// the day's settling, just after midnight UTC
	async scheduled(event, env, ctx) { ctx.waitUntil(inner(env, '/settle', { method: 'POST' })); },
};
