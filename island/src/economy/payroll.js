// Payroll: the people who work in a building are employed by the business there (economy/
// layer.js, establishments.js). They are paid a wage for each shift they turn up to (the
// workplace routines: people/workplace-life.js) and a little more for each task done for the
// employer: station work, a meeting, a stock check, a sale. Each business keeps a balance: what
// it started with, its sales and what requests it paid for, less its wages. So the economy can
// show which places do well.
//
// This keeps no one's purse. Every payment goes out through onPay(fn), fn({ npcId, credits, why,
// employerId }), for whatever keeps people's money to hear (and for the player's requests the
// same: npcId 'player'). Pure apart from the clock, so the tests run it in node.
//
//   onPay(fn)                       -> unsubscribe
//   setResolver((x, z) => E|null)   which establishment a workplace at (x, z) belongs to
//   clockIn(npcId, at, role)        turned up: a wage, once a shift
//   taskDone(npcId, kind, at)       a task for the employer: a bonus
//   sale(at, credits, npcId)        a sale: revenue to the business, a small cut to whoever sold
//   payFrom(employerId, npcId, credits, why)   a business pays for something (a request done)
//   ledger()                        totals, balances, top earners

const SHIFT_MS = 15 * 60 * 1000;        // a shift, in play (a quarter of an hour of the clock)
// a shift's wage by the kind of business, credits
const WAGE = { tech: 120, finance: 110, law: 110, design: 90, agency: 90, clinic: 95, dental: 95, realtor: 80, insurance: 80, hotel: 70 };
const WAGE_BY_CAT = { food: 55, shop: 50, service: 55, stay: 55, trade: 65, office: 85 };
const CAT = (type) => /cafe|bakery|waffle|donut|boba|icecream|pasta|pizza|diner|burger|taco|sushi|ramen|bistro|pub|bbq|seafood|curry|noodles|tapas|izakaya|grill/.test(type) ? 'food'
	: /bnb|motel|cabins|hotel/.test(type) ? 'stay' : /brewery|autorepair|movers|woodshop|boatyard|roastery|printshop|fishmarket/.test(type) ? 'trade'
		: /tech|law|design|finance|agency|realtor|clinic|dental|insurance/.test(type) ? 'office' : /salon|barber|laundromat|gym|yoga|daycare|tutor|vet|tailor|tattoo/.test(type) ? 'service' : 'shop';
// a task's bonus
const BONUS = { station: 4, meeting: 6, 'stock check': 3, sale: 2, service: 4 };
const seedOf = (id) => { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };

export function createPayroll({ clock = () => Date.now() } = {}) {
	const fns = new Set(), firms = new Map(), staff = new Map();
	let resolve = () => null, paid = 0, wages = 0, bonuses = 0;
	function firm(E) {
		if (!E) return null;
		let f = firms.get(E.id);
		// (a business starts with something in the till, more for the bigger kinds)
		if (!f) firms.set(E.id, f = { id: E.id, name: E.name, type: E.type, balance: Math.round((CAT(E.type) === 'office' ? 2400 : 600) * (0.6 + seedOf(E.id) * 0.8)), revenue: 0, wages: 0, spent: 0, staff: 0 });
		return f;
	}
	function emit(p) { paid += p.credits; for (const fn of fns) { try { fn(p); } catch (e) { console.warn('payroll', e); } } }
	function pay(f, npcId, credits, why) {
		credits = Math.max(0, Math.round(credits));
		if (!credits || !f) return 0;
		f.balance -= credits;
		const s = staff.get(npcId);
		if (s) s.earned += credits;
		emit({ npcId, credits, why, employerId: f.id });
		return credits;
	}
	function hire(npcId, at) {
		let s = staff.get(npcId);
		if (s && s.employer) return s;
		const E = at ? resolve(at.x, at.z) : null;
		if (!E) return s || null;
		if (!s) staff.set(npcId, s = { npcId, employer: null, shifts: 0, tasks: 0, earned: 0, shiftKey: -1 });
		s.employer = E.id;
		firm(E).staff++;
		return s;
	}
	function clockIn(npcId, at, role = '') {
		const s = hire(npcId, at);
		if (!s?.employer) return 0;
		const k = Math.floor(clock() / SHIFT_MS);
		if (s.shiftKey === k) return 0;
		s.shiftKey = k; s.shifts++;
		const f = firms.get(s.employer), w = WAGE[f.type] ?? WAGE_BY_CAT[CAT(f.type)] ?? 50;
		f.wages += w; wages += w;
		return pay(f, npcId, w, 'wage' + (role ? ': ' + role : ''));
	}
	function taskDone(npcId, kind, at) {
		const s = hire(npcId, at);
		if (!s?.employer) return 0;
		s.tasks++;
		const b = BONUS[kind] ?? 2;
		bonuses += b;
		return pay(firms.get(s.employer), npcId, b, 'task: ' + kind);
	}
	function sale(at, credits, npcId = null) {
		const E = at ? resolve(at.x, at.z) : null, f = firm(E);
		if (!f) return false;
		f.balance += credits; f.revenue += credits;
		if (npcId) taskDone(npcId, 'sale', at);
		return true;
	}
	function payFrom(employerId, npcId, credits, why) {
		const f = firms.get(employerId) || (employerId ? (firms.set(employerId, { id: employerId, name: employerId, type: 'shop', balance: 600, revenue: 0, wages: 0, spent: 0, staff: 0 }), firms.get(employerId)) : null);
		if (!f) return 0;
		const c = pay(f, npcId, credits, why);
		f.spent += c;
		return c;
	}
	function ledger(n = 5) {
		const F = [...firms.values()], S = [...staff.values()];
		return {
			paid, wages, bonuses, businesses: F.length, employed: S.filter((s) => s.employer).length,
			topEarners: S.sort((a, b) => b.earned - a.earned).slice(0, n).map((s) => ({ npcId: s.npcId, earned: s.earned, shifts: s.shifts, tasks: s.tasks, employer: firms.get(s.employer)?.name || null })),
			best: F.sort((a, b) => b.balance - a.balance).slice(0, n).map((f) => ({ id: f.id, name: f.name, balance: f.balance, revenue: f.revenue, wages: f.wages })),
			worst: F.sort((a, b) => a.balance - b.balance).slice(0, Math.min(n, 3)).map((f) => ({ id: f.id, name: f.name, balance: f.balance })),
		};
	}
	return {
		onPay: (fn) => { fns.add(fn); return () => fns.delete(fn); },
		setResolver: (fn) => { resolve = fn || (() => null); },
		clockIn, taskDone, sale, payFrom, ledger, employerOf: (npcId) => staff.get(npcId)?.employer || null, balance: (id) => firms.get(id)?.balance ?? null,
	};
}

// the one the game runs on (the city sets its resolver; the workplaces report to it)
export const payroll = createPayroll();
export const onPay = (fn) => payroll.onPay(fn);
