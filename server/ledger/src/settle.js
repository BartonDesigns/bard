// The ledger's book-keeping, kept apart from the Worker so the tests run it in node. A store is
// anything with the Durable Object storage calls: get(key), put(key, value), delete(keys), list({ prefix }).
//
//   keys:  f:<account>   its plan (ledger-core.js profileOf; the first client to send it wins: every
//                        client derives the same one from the same household)
//          p:<day>:<n>   an event not yet settled: [account, day, amount, kind, counterparty, base]
//          a:<account>   its settled state { state: { dd, sn, tx }, balance, day, daily: [[day, balance]...] }
//          seq           the event counter

import { applyEvents, baseline, deltaAt } from '../../../island/src/economy/ledger-core.js';

export const ACCOUNT_RE = /^(hh|npc|biz):[\w.:-]{1,60}$|^player(:[\w-]{1,40})?$/;
const MAX_EVENT = 5000, MAX_BATCH = 500, DAILY = 90;
const PLAN_KEYS = ['start', 'pay', 'pension', 'payday', 'rent', 'rentDay', 'bills', 'billDay', 'food', 'living', 'allowance', 'lunch', 'clothes', 'clothesDay'];

// a plan as numbers only (whatever else a client sends is dropped)
function cleanPlan(P) {
	if (!P || typeof P !== 'object') return null;
	const out = {};
	for (const k of PLAN_KEYS) { const v = Number(P[k]); if (!Number.isFinite(v) || Math.abs(v) > 1e7) return null; out[k] = v; }
	return out;
}

// clients post what happened: { events: [[account, day, amount, kind, counterparty, base?]], profiles: { account: plan } }
export async function appendEvents(store, body, today) {
	const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_BATCH) : [];
	let seq = (await store.get('seq')) || 0, kept = 0;
	const puts = {};
	for (const e of events) {
		if (!Array.isArray(e)) continue;
		const [id, day, amount, kind, cp, base] = e;
		if (!ACCOUNT_RE.test(String(id)) || !Number.isInteger(day) || day < today - 7 || day > today + 1) continue;
		const a = Math.round(Number(amount));
		if (!Number.isFinite(a) || !a || Math.abs(a) > MAX_EVENT) continue;
		puts[`p:${day}:${++seq}`] = [String(id), day, a, Number(kind) | 0, String(cp || '').slice(0, 40), base ? 1 : 0];
		kept++;
	}
	for (const [id, P] of Object.entries(body?.profiles || {}).slice(0, MAX_BATCH)) {
		if (!ACCOUNT_RE.test(id)) continue;
		const C = cleanPlan(P);
		if (C && !(await store.get('f:' + id))) puts['f:' + id] = C;
	}
	puts.seq = seq;
	await store.put(puts);
	return { kept, of: events.length };
}

// once a day: every account with events gets them applied onto its baseline; its settled balance
// and today's snapshot are kept
export async function settleAll(store, today) {
	const pending = await store.list({ prefix: 'p:' });
	const by = new Map();
	for (const [, e] of pending) { const [id, ...ev] = e; (by.get(id) || by.set(id, []).get(id)).push(ev); }
	let n = 0;
	for (const [id, evs] of by) {
		const A = (await store.get('a:' + id)) || { state: null, daily: [] };
		A.state = applyEvents(A.state, evs);
		await stamp(store, id, A, today);
		n++;
	}
	if (pending.size) await store.delete([...pending.keys()]);
	return { accounts: n, events: pending.size };
}
async function stamp(store, id, A, today) {
	const P = await store.get('f:' + id);
	A.day = today;
	A.balance = baseline(P, today) + deltaAt(A.state, today);
	A.daily = (A.daily || []).filter((d) => d[0] !== today).concat([[today, A.balance]]).slice(-DAILY);
	await store.put('a:' + id, A);
}

// one account as the server holds it, its daily balances filled in from the baseline where no
// snapshot was kept
export async function accountView(store, id, today, days = 90) {
	if (!ACCOUNT_RE.test(id)) return null;
	const A = await store.get('a:' + id), P = await store.get('f:' + id);
	if (!A && !P) return null;
	const kept = new Map((A?.daily || []).map(([d, b]) => [d, b])), daily = [];
	for (let d = today - days + 1; d <= today; d++) daily.push([d, kept.get(d) ?? baseline(P, d) + deltaAt(A?.state, d)]);
	return { id, plan: P || null, state: A?.state || null, balance: baseline(P, today) + deltaAt(A?.state, today), day: today, daily };
}

export async function accountsList(store, limit = 200) {
	const L = await store.list({ prefix: 'a:', limit });
	return [...L].map(([k, A]) => ({ id: k.slice(2), balance: A.balance, day: A.day, tx: A.state?.tx?.length || 0 }));
}
