// A household's day, in quarter hours: when each of them wakes, eats, goes to school or
// work (day shifts, evening shifts, night shifts), who walks the little ones to school and
// who picks them up, the after-school clubs, the grocery run, who cooks, dinner together,
// homework, bedtime; and at weekends the park, the market, sport, chores, their community.
//
// The rule every plan keeps: a child is never on their own. Under thirteen someone is
// always with them (a grown-up of the house, school, a club, the bus, a grandparent or a
// neighbour, an older brother or sister for a few hours after school); thirteen to fifteen
// they may be home alone by day but not through the night. When nobody can, a grown-up
// changes their day (leaves work early, starts late, takes the night off), and the plan
// says so: that is what the family talks about.
//
// Plain data, cheap: planDay() for a household and a weekday, whereAt() for one of them at
// an hour. Nothing here knows about bodies.

import { needsCare, needsNightCare, minorsOf, adultsOf, rng } from './households.js';

export const SLOT = 0.25, N = 96;
export const slotOf = (h) => Math.max(0, Math.min(N - 1, Math.floor((((h % 24) + 24) % 24) / SLOT)));
export const hourOf = (s) => s * SLOT;
// places a child counts as looked after by the place itself
export const MINDED = new Set(['school', 'club', 'daycare', 'helper', 'bus']);

const fill = (a, from, to, v) => { const s0 = slotOf(from), s1 = to >= 24 ? N : slotOf(to); for (let s = s0; s < s1; s++) a[s] = v; };
const isWeekend = (day) => day === 0 || day === 6;
const SCHOOL = { preschool: [8.5, 14], elementary: [8.25, 15], middle: [8, 15.25], high: [8, 15.5] };
const BED = { baby: 19, little: 19.5, child: 20.5, teen: 22.5, adult: 23, elder: 22 };

// the house's own rhythm: which days they shop, who cooks when (from its seed)
function rhythm(h) {
	const r = rng(h.seed ^ 0x5c4ed);
	return { shopDays: [1 + Math.floor(r() * 4), 6], bus: r() < 0.35, cookTurn: Math.floor(r() * 7) };
}

// a weekday plan for every member, with who is minding each minor
export function planDay(h, day = 1) {
	const R = rhythm(h), wk = isWeekend(day), prev = (day + 6) % 7;
	const at = {}, act = {}, carer = {}, notes = [];
	for (const m of h.members) {
		const A = at[m.id] = new Array(N).fill('home'), B = act[m.id] = new Array(N).fill('home');
		const bed = BED[m.stage], wake = wk ? 8 : m.age < 18 ? 7 : 6.5;
		fill(B, 0, wake, 'sleep'); fill(B, bed, 24, 'sleep');
		fill(B, wake, wake + 0.5, 'breakfast');
		// school, and the way there and back
		const S = !wk && m.school && SCHOOL[m.school];
		if (S && !h.unhoused) {
			fill(A, S[0] - 0.25, S[0], 'transit'); fill(B, S[0] - 0.25, S[0], 'to-school');
			fill(A, S[0], S[1], 'school'); fill(B, S[0], S[1], 'class');
			let back = S[1];
			if (m.club && m.club.days.includes(day)) { fill(A, S[1], m.club.end, 'club'); fill(B, S[1], m.club.end, m.club.kind); back = m.club.end; }
			fill(A, back, back + 0.25, 'transit'); fill(B, back, back + 0.25, 'from-school');
			if (m.age >= 6) fill(B, 19.25, 20, 'homework');
		}
		// work (a night shift from last night runs into this morning)
		const J = m.job;
		if (J) {
			if (J.night) {
				if (J.days.includes(prev)) { fill(A, 0, J.end + 0.5, 'work'); fill(B, 0, J.end + 0.5, 'work'); fill(B, J.end + 0.5, J.end + 7.5, 'sleep'); }
				if (J.days.includes(day)) { fill(A, J.start - 0.5, 24, 'work'); fill(B, J.start - 0.5, 24, 'work'); }
			} else if (J.days.includes(day)) {
				const where = J.home ? 'home' : J.kind === 'teen-job' ? 'job' : 'work';
				fill(A, J.start - 0.5, J.end + 0.5, where); fill(B, J.start - 0.5, J.end + 0.5, 'work');
			}
		}
	}
	const free = (id, s0, s1, ok = (x) => x === 'home') => { for (let s = s0; s < s1; s++) if (!ok(at[id][s]) || act[id][s] === 'work' || act[id][s] === 'sleep') return false; return true; };
	const adults = adultsOf(h), minors = minorsOf(h);
	// weekends: chores in the morning, then the house's outing; their community on Sunday;
	// the teens out with friends on Saturday afternoon
	if (wk) {
		for (const m of h.members) if (m.age >= 8) fill(act[m.id], 9, 10, act[m.id][slotOf(9)] === 'work' ? 'work' : 'chores');
		const out = day === 6 ? h.weekend : h.community && h.community !== 'volunteering' ? h.community : day === 0 ? h.weekend : null;
		if (out && out !== 'home') {
			const go = h.members.filter((m) => free(m.id, slotOf(10), slotOf(12.5), (x) => x === 'home') || m.age < 13);
			if (go.some((m) => m.age >= 18)) for (const m of go) { fill(at[m.id], 10, 12.5, out); fill(act[m.id], 10, 12.5, out); }
		}
		if (day === 6) for (const m of minors) if (m.age >= 13 && free(m.id, slotOf(14), slotOf(17.5))) { fill(at[m.id], 14, 17.5, 'park'); fill(act[m.id], 14, 17.5, 'friends'); }
	}
	// the grocery run: whoever is free that evening (or Saturday morning), the little ones
	// along if nobody else is home with them
	if (R.shopDays.includes(day) && !h.unhoused) {
		const t0 = day === 6 ? 13 : 17.25, t1 = t0 + 1;
		const who = adults.find((m) => free(m.id, slotOf(t0), slotOf(t1))) || minors.find((m) => m.age >= 16 && free(m.id, slotOf(t0), slotOf(t1)));
		if (who) {
			fill(at[who.id], t0, t1, 'store'); fill(act[who.id], t0, t1, 'groceries');
			h.shopper = who.id;
			notes.push({ kind: 'groceries', who: who.id, at: t0 });
		}
	}
	// the food bank, for an encampment, and the community kitchen's supper
	if (h.unhoused) for (const m of h.members) if (act[m.id][slotOf(17.5)] !== 'work') { fill(at[m.id], 17.5, 18.5, 'kitchen'); fill(act[m.id], 17.5, 18.5, 'supper'); }
	// dinner: one of them cooks (it takes turns among those home), everyone home eats together
	const home = (s) => h.members.filter((m) => at[m.id][s] === 'home' && act[m.id][s] !== 'sleep' && act[m.id][s] !== 'work');
	if (!h.unhoused) {
		const cooks = home(slotOf(17.75)).filter((m) => m.age >= 15);
		const cook = cooks.length ? cooks[(R.cookTurn + day) % cooks.length] : null;
		if (cook) { fill(act[cook.id], 17.75, 18.5, 'cooking'); h.cook = cook.id; }
		for (const m of home(slotOf(18.75))) fill(act[m.id], 18.5, 19.25, 'dinner');
		// bedtime: a grown-up with the little ones
		for (const k of minors.filter((q) => q.age < 9)) {
			const s = slotOf(BED[k.stage] - 0.5), g = h.members.find((m) => m.age >= 18 && at[m.id][s] === 'home' && act[m.id][s] !== 'work' && act[m.id][s] !== 'sleep');
			if (g) fill(act[g.id], BED[k.stage] - 0.5, BED[k.stage], 'bedtime');
		}
	}
	const plan = { day, at, act, carer, notes, bus: R.bus };
	cover(h, plan);
	return plan;
}

// who is with a minor at a slot: a place that minds them, a grown-up (or a teen of fifteen
// or more, by day, for a while) in the same place and not at work
function minder(h, plan, k, s, sibling = true) {
	const where = plan.at[k.id][s];
	if (MINDED.has(where)) return where;
	for (const m of h.members) {
		if (m === k || plan.at[m.id][s] !== where || plan.act[m.id][s] === 'work') continue;
		if (m.age >= 18) return m.id;
		if (sibling && m.age >= 15 && plan.act[m.id][s] === 'babysitting') return m.id;
	}
	return null;
}
const needs = (k, s) => needsCare(k.age) || (needsNightCare(k.age) && (hourOf(s) >= 22 || hourOf(s) < 6.5));

// every minor's gaps: [{ child, slot, at }]
export function coverageGaps(h, plan) {
	const out = [];
	for (const k of minorsOf(h)) for (let s = 0; s < N; s++) if (needs(k, s) && !(plan.carer[k.id]?.[s] ?? minder(h, plan, k, s))) out.push({ child: k.id, slot: s, at: plan.at[k.id][s] });
	return out;
}

// closing the gaps, in the order families really do: an older sibling for a short spell
// after school, the after-school programme, a grandparent or a neighbour, daycare for the
// little ones, the school bus; and when none of that will do, a grown-up changes their day
function cover(h, plan) {
	const { at, act } = plan;
	const runs = (k) => {
		const out = [];
		let s0 = -1;
		for (let s = 0; s <= N; s++) {
			const gap = s < N && needs(k, s) && !plan.carer[k.id]?.[s] && !minder(h, plan, k, s);
			if (gap && s0 < 0) s0 = s;
			if (!gap && s0 >= 0) { out.push([s0, s]); s0 = -1; }
		}
		return out;
	};
	// (the night stays asleep, wherever it is spent)
	const set = (id, s0, s1, where, what) => { for (let s = s0; s < s1; s++) { if (where) at[id][s] = where; if (what && (act[id][s] !== 'sleep' || where === 'transit')) act[id][s] = what; } };
	const note = (o) => plan.notes.push(o);
	const kids = minorsOf(h);
	// (minding one can leave another: so round them all again until nobody is alone)
	for (let pass = 0; pass < 6; pass++) {
		let open = 0;
		for (const k of kids) {
			const gaps = runs(k);
			open += gaps.length;
			for (const [s0, s1] of gaps) {
				const h0 = hourOf(s0), h1 = hourOf(s1), where = at[k.id][s0], len = h1 - h0;
				// the walk to or from school: a grown-up or older sibling at home walks them
				// (the school run), or the bus
				if (where === 'transit') {
					const esc = h.members.find((m) => m !== k && (m.age >= 18 || (m.age >= 15 && h0 > 14)) && at[m.id].slice(s0, s1).every((x) => x === 'home' || x === 'transit') && act[m.id].slice(s0, s1).every((x) => x !== 'work' && x !== 'sleep'));
					if (esc) { set(esc.id, s0, s1, 'transit', h0 < 12 ? 'school-run' : 'pickup'); note({ kind: h0 < 12 ? 'school-run' : 'pickup', who: esc.id, child: k.id, at: h0 }); continue; }
					// the teen walking to school with them (same time, same way)
					const sib = h.members.find((m) => m !== k && m.age >= 13 && at[m.id].slice(s0, s1).every((x) => x === 'transit'));
					if (sib && k.age >= 8) { for (let s = s0; s < s1; s++) (plan.carer[k.id] ||= new Array(N).fill(null))[s] = sib.id; note({ kind: 'walks-with-sibling', who: sib.id, child: k.id, at: h0 }); continue; }
					if (plan.bus) { set(k.id, s0, s1, 'bus', 'school-bus'); continue; }
				}
				if (where === 'home' || where === 'transit') {
					// an older brother or sister home after school, for a few hours
					const sib = h.members.find((m) => m !== k && m.age >= 15 && m.age < 18 && h0 >= 14.5 && h1 <= 21 && len <= 3.5 && at[m.id].slice(s0, s1).every((x) => x === 'home' || x === 'park') && act[m.id].slice(s0, s1).every((x) => x !== 'job' && x !== 'sleep'));
					if (sib) { set(sib.id, s0, s1, 'home', 'babysitting'); set(k.id, s0, s1, 'home', null); note({ kind: 'sibling-minds', who: sib.id, child: k.id, at: h0 }); continue; }
					// the after-school programme, school days to six
					if (!isWeekend(plan.day) && k.age >= 5 && h0 >= 14.9 && h1 <= 18.01 && k.school) { set(k.id, s0, s1, 'club', 'after-school program'); note({ kind: 'after-school', child: k.id, at: h0 }); continue; }
					// daycare for the little ones on a working day
					if (!isWeekend(plan.day) && k.age < 5 && h0 >= 7.5 && h1 <= 18.01) { set(k.id, s0, s1, 'daycare', 'daycare'); note({ kind: 'daycare', child: k.id, at: h0 }); continue; }
					// a grandparent, a neighbour, a friend's family
					const night = h0 >= 21 || h0 < 6.5 || h1 > 21.5;
					const help = h.helpers.find((q) => (night ? q.night : h0 >= q.from && h1 <= q.to));
					if (help) { set(k.id, s0, s1, 'helper', `with ${help.kind === 'grandparent' ? 'grandma and grandpa' : help.kind === 'neighbour' ? 'the neighbours' : "a friend's family"}`); note({ kind: 'helper', who: help.id, helper: help.kind, child: k.id, at: h0, night }); continue; }
				}
				// nobody can: a grown-up changes their day. The one whose change is smallest:
				// one working from home, then a day job (leave early, start late), then a night
				// shift (take the night off)
				const cand = h.members.filter((m) => m.age >= 18).map((m) => {
					let cost = 0;
					for (let s = s0; s < s1; s++) cost += (act[m.id][s] === 'work' ? (m.job?.night ? 3 : 1) : at[m.id][s] !== 'home' ? 0.5 : 0) + (kids.some((o) => o !== k && at[o.id][s] !== at[k.id][s] && minder(h, plan, o, s) === m.id) ? 6 : 0);
					return [m, cost];
				}).sort((a, b) => a[1] - b[1]);
				const g = cand[0]?.[0];
				if (!g) { set(k.id, s0, s1, 'helper', 'with a relative'); note({ kind: 'helper', helper: 'relative', child: k.id, at: h0 }); continue; }
				// (they go where the child is: on the walk, at home, at the park)
				let was = 'home';
				for (let s = s0; s < s1; s++) { if (act[g.id][s] === 'work') was = 'work'; const w = at[k.id][s]; set(g.id, s, s + 1, w, w === 'transit' ? (h0 < 12 ? 'school-run' : 'pickup') : 'care'); }
				note({ kind: was === 'work' ? (g.job?.night ? 'night-off' : h0 < 12 ? 'starts-late' : 'leaves-early') : 'stays-home', who: g.id, child: k.id, at: h0, until: h1 });
			}
		}
		if (!open) break;
	}
	for (const k of kids) {
		// who it is, slot by slot (for the world and the tests); and should anything still be
		// open, a relative comes (never alone)
		const C = (plan.carer[k.id] ||= new Array(N).fill(null));
		for (let s = 0; s < N; s++) {
			if (!C[s]) C[s] = minder(h, plan, k, s) ?? (needs(k, s) ? null : 'self');
			if (!C[s]) { at[k.id][s] = 'helper'; act[k.id][s] = 'with a relative'; C[s] = 'helper'; }
		}
	}
}

// one of them at an hour: { at, act, carer }
export function whereAt(plan, id, hour) {
	const s = slotOf(hour);
	return { at: plan.at[id]?.[s], act: plan.act[id]?.[s], carer: plan.carer[id]?.[s] ?? null };
}
// the moments of the day worth seeing: who walks who to school, who shops, who cooks
export function momentsOf(h, plan) {
	return plan.notes.map((n) => ({ ...n, member: h.members.find((m) => m.id === n.who) || null, child: h.members.find((m) => m.id === n.child) || null }));
}
