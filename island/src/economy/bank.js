// The bank: everyone's money, the townsfolk, their households, the businesses and the player.
// A household's balance is its baseline (ledger-core.js: a pure function of who lives there,
// their work and the day) plus the delta of what has actually happened to it: a request paid, a
// wallet lost or handed back, a hospital bill, a purchase. Only accounts something happened to
// are stored, compactly (the delta, the delta at the end of each day it changed for 90 days, the
// last 20 transactions), in this browser; the ledger Worker (server/ledger) settles them once a
// day for everyone when it can be reached, and the game works the same without it.
//
// Married couples (of either sex) and families share one household account: every grown-up's
// pay goes into it and the children's allowance, lunches and clothes come out of it. Roommates
// and people living alone keep their own.
//
//   link(npcId, household, member)     whose account someone draws on (people/households.js)
//   household(npcId | person)          -> account id ('hh:<id>', a roommate's 'hh:<id>.<n>', or 'npc:<seed>')
//   account(id)  balance(id)  history(id)  daily(id, days)
//   earn(id, credits, kind, counterparty)  spend(...)  transfer(from, to, credits, kind)
//   moneyTalk(npcId)                    facts for the talk: rent due, paid today, a wallet returned
//   standing(id)                        balance over a week's costs (below 0: in trouble)
//   sync()                              settle with the ledger Worker, if one is set

import { profileOf, baseline, dayOf, weekdayOf, nextDay, weeklyCosts, applyEvents, deltaAt, kindCode, KIND, KIND_NAME, WEEKDAYS } from './ledger-core.js';
import { makeHousehold } from '../people/households.js';
import { payroll } from './payroll.js';

const STORE = 'crysis-bank-v1';
const ID_RE = /^[a-z]+:[\w.:-]{1,60}$/;

export function createBank({ clock = () => Date.now(), storage = typeof localStorage !== 'undefined' ? localStorage : null, server = '', fetch: fetcher = typeof fetch === 'function' ? fetch.bind(globalThis) : null } = {}) {
	const profiles = new Map();        // account id -> its plan (derived, never stored)
	const links = new Map();           // npc id -> account id
	let state = { a: {}, q: [] };      // a: account id -> { dd, sn, tx }; q: events not yet settled by the server
	try { const s = storage && JSON.parse(storage.getItem(STORE) || 'null'); if (s?.a) state = { a: s.a, q: s.q || [] }; } catch { /* private mode, or nothing kept */ }
	let saveT = null;
	const flush = () => { if (saveT) { clearTimeout(saveT); saveT = null; } if (!storage) return; try { storage.setItem(STORE, JSON.stringify(state)); } catch { /* full or private */ } };
	const save = () => { if (saveT || !storage) return; saveT = setTimeout(flush, 500); };
	try { globalThis.addEventListener?.('pagehide', flush); } catch { /* not a page */ }
	const today = () => dayOf(clock());

	// someone's own account, when no household has claimed them: a person living alone, from their seed
	function ownProfile(id) {
		const seed = Number(id.slice(4)) >>> 0;
		return profileOf(makeHousehold(seed, null, { kind: 'single', id: 'n' + seed.toString(36) }));
	}
	function profile(id) {
		let P = profiles.get(id);
		if (!P && id.startsWith('npc:') && /^\d+$/.test(id.slice(4))) profiles.set(id, P = ownProfile(id));
		return P || null;
	}
	function link(npcId, h, member = null) {
		if (!h?.members?.length) return null;
		const own = h.kind === 'roommates' && member, id = 'hh:' + h.id + (own ? '.' + h.members.indexOf(member) : '');
		if (!profiles.has(id)) profiles.set(id, profileOf(h, own ? member : null));
		if (npcId) links.set(String(npcId), id);
		return id;
	}
	// a person (people.js: p.P.home is { household, member }) or an npc id
	function household(who) {
		if (who && typeof who === 'object') {
			const id = who.P?.dna ? 'npc:' + (who.P.dna.seed >>> 0) : null, home = who.P?.home;
			if (home?.household) return link(id, home.household, home.member);
			return id;
		}
		const k = String(who);
		return links.get(k) || (k.startsWith('npc:') || k.startsWith('hh:') || k.startsWith('biz:') || k === 'player' ? k : 'npc:' + k);
	}
	const acct = (id) => state.a[id];
	function balance(id, day = today()) {
		return baseline(profile(id), day) + deltaAt(acct(id), day);
	}
	function post(id, credits, kind, cp, base = 0) {
		if (!ID_RE.test(id) && id !== 'player') return 0;
		const a = Math.round(credits);
		if (!Number.isFinite(a) || !a) return 0;
		const d = today(), ev = [d, a, kindCode(kind), cp ? String(cp).slice(0, 40) : ''];
		if (base) ev.push(1);
		state.a[id] = applyEvents(acct(id), [ev]);
		state.q.push([id, ...ev]);
		if (state.q.length > 2000) state.q = state.q.slice(-2000);
		save();
		return a;
	}
	const earn = (id, credits, kind = 'other', cp = '') => post(household(id), Math.abs(credits), kind, cp);
	const spend = (id, credits, kind = 'other', cp = '') => -post(household(id), -Math.abs(credits), kind, cp);
	// a regular wage seen being paid: listed, already in the baseline
	const note = (id, credits, kind = 'wage', cp = '') => post(household(id), credits, kind, cp, 1);
	function transfer(from, to, credits, kind = 'transfer') {
		const f = household(from), t = household(to), c = Math.abs(Math.round(credits));
		post(f, -c, kind, t); post(t, c, kind, f);
		return c;
	}
	function history(id) {
		const S = acct(household(id));
		return (S?.tx || []).map(([day, amount, kind, cp]) => ({ day, amount, kind: KIND_NAME[kind] || 'other', counterparty: cp })).reverse();
	}
	function daily(id, days = 30) {
		const k = household(id), d = today(), out = [];
		for (let i = days - 1; i >= 0; i--) out.push({ day: d - i, balance: balance(k, d - i) });
		return out;
	}
	function standing(id) {
		const k = household(id), P = profile(k);
		if (!P) return null;
		return Math.round(balance(k) / Math.max(1, weeklyCosts(P)) * 100) / 100;
	}
	function account(id) {
		const k = household(id), P = profile(k), S = acct(k);
		return { id: k, balance: balance(k), day: today(), stored: !!S, delta: S?.dd || 0, standing: standing(k), plan: P && { pay: P.pay, pension: P.pension, rent: P.rent, rentDay: P.rentDay, bills: P.bills, people: P.people, minors: P.minors, earners: P.earners }, recent: history(k).slice(0, 5) };
	}
	// what someone might say about their money (the talk phrases it: people/chatter, dialogue)
	function moneyTalk(npcId) {
		const k = household(npcId), P = profile(k), d = today();
		if (!P) return null;
		const s = standing(k), bal = balance(k);
		const mood = s < 0 ? 'broke' : s < 1 ? 'struggling' : s < 4 ? 'getting by' : s < 12 ? 'comfortable' : 'flush';
		const rentIn = P.rent ? nextDay(P, 'rent', d) - d : null, payIn = P.pay ? nextDay(P, 'pay', d) - d : null;
		const facts = { account: k, balance: bal, mood, shared: k.startsWith('hh:') && P.people > 1 && !/\.\d+$/.test(k), dependants: P.minors, earners: P.earners };
		if (rentIn !== null) facts.rent = { amount: P.rent, inDays: rentIn, weekday: WEEKDAYS[weekdayOf(d + rentIn)], canPay: bal - P.rent > 0 };
		if (payIn !== null) facts.payday = { inDays: payIn, weekday: WEEKDAYS[weekdayOf(d + payIn)], today: payIn === 0, amount: P.pay };
		// the latest things that happened (a wallet returned, paid at the waffle shop, robbed)
		facts.recent = history(k).filter((t) => d - t.day <= 3).slice(0, 3).map((t) => ({ kind: t.kind, amount: t.amount, from: t.counterparty, daysAgo: d - t.day }));
		facts.tempted = Math.max(0, Math.min(1, s < 0 ? 0.8 : s < 1 ? 0.5 : s < 4 ? 0.2 : 0.05));
		facts.tips = s > 8 ? 'well' : s > 2 ? 'a little' : 'nothing';
		return facts;
	}
	// for the requests and favours: a flush house tips well, a struggling one asks for work or help
	function tipFor(id, base) {
		const s = standing(id);
		if (s === null) return 0;
		return Math.round(Math.max(0, base) * (s > 12 ? 0.3 : s > 4 ? 0.15 : s > 1 ? 0.05 : 0) / 5) * 5;
	}
	const needsHelp = (id) => { const s = standing(id); return s !== null && s < 1; };
	// ---------- the ledger Worker ----------
	let syncing = false;
	async function sync() {
		if (!server || !fetcher || syncing) return { ok: false, reason: server ? 'busy' : 'no ledger set' };
		syncing = true;
		try {
			const batch = state.q.slice(0, 500);
			const prof = {};
			for (const [id] of batch) if (profiles.has(id) && !prof[id]) prof[id] = profiles.get(id);
			if (batch.length) {
				const res = await fetcher(server.replace(/\/+$/, '') + '/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events: batch, profiles: prof }) });
				if (!res.ok) return { ok: false, reason: 'status ' + res.status };
				state.q = state.q.slice(batch.length);
				save();
			}
			return { ok: true, sent: batch.length };
		} catch (e) {
			return { ok: false, reason: String(e?.message || e) };
		} finally { syncing = false; }
	}
	// the server's settled state for an account (it wins over this browser's, where it has one)
	async function pull(id) {
		if (!server || !fetcher) return null;
		try {
			const res = await fetcher(server.replace(/\/+$/, '') + '/account/' + encodeURIComponent(household(id)));
			if (!res.ok) return null;
			const S = await res.json();
			if (S?.state && !state.q.some((e) => e[0] === household(id))) { state.a[household(id)] = S.state; save(); }
			return S;
		} catch { return null; }
	}
	const info = () => ({ accounts: Object.keys(state.a).length, linked: links.size, pending: state.q.length, server: server || null, bytes: JSON.stringify(state).length });
	return { link, household, account, balance, earn, spend, note, transfer, flush, tipFor, needsHelp, history, daily, standing, moneyTalk, sync, pull, info, setServer: (u) => { server = u || ''; }, KIND, raw: (id) => acct(household(id)) || null };
}

// payroll (payroll.js) pays into the bank: a wage the household's plan already counts is listed
// (it is how they live), a bonus, a sale's cut or a request done is money on top
export function wirePayroll(B, P) {
	return P.onPay(({ npcId, credits, why, employerId }) => {
		const id = B.household(npcId), wage = /^wage/.test(why), plan = B.account(id).plan;
		if (wage && plan?.pay) B.note(id, credits, 'wage', employerId);
		else B.earn(id, credits, wage ? 'wage' : /^request/.test(why) ? 'request' : /sale/.test(why) ? 'sale' : 'bonus', employerId);
	});
}
// the game's bank. The ledger is the owner's Worker when the game is served from its own site
// (or locally, which the Worker also lets in); ?ledger=<url> or localStorage 'crysis-ledger-url'
// points it elsewhere, and ?ledger=off keeps this browser's book to itself.
const LEDGER = 'https://l99-ledger.joshbarton1921.workers.dev';
const HOME = /^(www\.)?level99bard\.com$|^localhost$|^127\.0\.0\.1$/;
const url = (() => {
	try {
		const set = new URLSearchParams(globalThis.location?.search || '').get('ledger') || globalThis.localStorage?.getItem('crysis-ledger-url') || '';
		if (set) return set === 'off' ? '' : set;
		return HOME.test(globalThis.location?.hostname || '') ? LEDGER : '';
	} catch { return ''; }
})();
export const bank = createBank({ server: url });
// settle with it on its own: a minute after there is something to send, and as the page is put
// away; a ledger that can't be reached is asked again later and later (up to ten minutes apart)
if (url && typeof window !== 'undefined') {
	let wait = 60e3;
	const send = async () => {
		if (bank.info().pending) { const r = await bank.sync(); wait = r.ok ? 60e3 : Math.min(wait * 2, 600e3); }
		setTimeout(send, wait);
	};
	setTimeout(send, wait);
	document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && bank.info().pending) bank.sync(); });
}
wirePayroll(bank, payroll);
export const moneyTalk = (npcId) => bank.moneyTalk(npcId);
