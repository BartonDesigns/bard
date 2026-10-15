// Today's goals: three small things to do, new each day (by the date where you play), paid in
// credits as each is done and a bonus for all three. The systems tell this what happened
// (note('favour'), note('fare', { stars, metres }), ...); nothing here watches the world.

export const GOALS = Object.freeze([
	{ id: 'favours2', text: 'Do 2 favours for people', kind: 'favour', need: 2, credits: 80 },
	{ id: 'lost1', text: 'Find something someone lost', kind: 'favour', test: (d) => d.kind === 'lost', need: 1, credits: 60 },
	{ id: 'catch1', text: 'Catch a friend who left something behind', kind: 'favour', test: (d) => d.kind === 'catch', need: 1, credits: 60 },
	{ id: 'pass1', text: 'Carry something to someone waiting', kind: 'favour', test: (d) => d.kind === 'pass', need: 1, credits: 50 },
	{ id: 'repair1', text: 'Get someone\'s car running again', kind: 'favour', test: (d) => d.kind === 'repair', need: 1, credits: 90 },
	{ id: 'thief1', text: 'Stop a bag thief', kind: 'thief', need: 1, credits: 120 },
	{ id: 'fares3', text: 'Drive 3 fares', kind: 'fare', need: 3, credits: 100 },
	{ id: 'five1', text: 'Earn a five-star ride', kind: 'fare', test: (d) => d.stars === 5, need: 1, credits: 90 },
	{ id: 'rush1', text: 'Get a passenger in a hurry there on time', kind: 'fare', test: (d) => d.onTime === true, need: 1, credits: 100 },
	{ id: 'long1', text: 'Drive a fare over a kilometre', kind: 'fare', test: (d) => d.metres >= 1000, need: 1, credits: 80 },
	{ id: 'tend1', text: 'Patch up someone who is hurt', kind: 'tend', need: 1, credits: 90 },
	{ id: 'cross3', text: 'Cross the street at a crosswalk 3 times', kind: 'street', test: (d) => d.kind === 'crosswalk', need: 3, credits: 40 },
	{ id: 'pothole1', text: 'Report a pothole for someone', kind: 'favour', test: (d) => d.kind === 'pothole', need: 1, credits: 50 },
]);
export const ALL_BONUS = 150;

// the date where you are, as YYYY-MM-DD
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// three goals for a day, the same for everyone that day, never two of one kind of thing
export function goalsFor(day) {
	let h = 2166136261;
	for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
	const out = [], kinds = new Set();
	for (let k = 0; out.length < 3 && k < 60; k++) {
		h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
		const g = GOALS[h % GOALS.length];
		if (out.includes(g) || kinds.has(g.kind)) continue;
		out.push(g); kinds.add(g.kind);
	}
	return out;
}

export function createDaily({ arms, hint, now = Date.now, storage = globalThis.localStorage, key = 'crysis-daily-v1' } = {}) {
	let S = { day: '', got: {}, paid: {}, bonus: false };
	try { const o = JSON.parse(storage?.getItem(key) || 'null'); if (o?.day) S = o; } catch { /* private mode */ }
	const save = () => { try { storage?.setItem(key, JSON.stringify(S)); } catch { /* private mode */ } };
	function fresh() { const d = dayKey(now()); if (S.day !== d) { S = { day: d, got: {}, paid: {}, bonus: false }; save(); } return goalsFor(d); }
	function pay(id, credits, why) {
		const r = arms()?.apply?.({ id: `daily:${S.day}:${id}`, kind: 'trade', peer: 'daily', give: { credits: 0, items: [] }, get: { credits, items: [] } });
		hint?.(r?.ok === false ? `Today's goal done: ${why}.` : `Today's goal done: ${why}. +${credits} credits`, 4500);
	}
	function note(kind, data = {}) {
		const goals = fresh();
		let changed = false;
		for (const g of goals) {
			if (g.kind !== kind || S.paid[g.id] || (g.test && !g.test(data))) continue;
			S.got[g.id] = (S.got[g.id] || 0) + 1; changed = true;
			if (S.got[g.id] >= g.need) { S.paid[g.id] = true; pay(g.id, g.credits, g.text); }
		}
		if (changed && !S.bonus && goals.every((g) => S.paid[g.id])) { S.bonus = true; arms()?.apply?.({ id: `daily:${S.day}:all`, kind: 'trade', peer: 'daily', give: { credits: 0, items: [] }, get: { credits: ALL_BONUS, items: [] } }); hint?.(`All of today's goals done. +${ALL_BONUS} credits`, 5000); }
		if (changed) save();
	}
	function list() { const goals = fresh(); return { day: S.day, bonus: S.bonus, goals: goals.map((g) => ({ id: g.id, text: g.text, need: g.need, got: Math.min(g.need, S.got[g.id] || 0), done: !!S.paid[g.id], credits: g.credits })) }; }
	return { note, list };
}
