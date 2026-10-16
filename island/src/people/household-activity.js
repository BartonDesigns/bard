// Public household facts and bounded, recurring social opportunities. Money stays
// in the existing bank/ledger; simulated conversations cannot mint payments.
export const HOUSEHOLD_FEATURE = 'household-life-v1';
const clean = (s, max = 96) => typeof s === 'string' ? s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '';
export function householdObservation(person) {
	const home = person?.P?.home, h = home?.household, m = home?.member;
	if (!h?.id || !m?.id || !Array.isArray(h.members)) return null;
	return normalizeHousehold({ id: h.id, memberId: m.id, kind: h.kind, role: m.role,
		members: h.members.length, dependants: h.members.filter(m => m.age < 18).length,
		earners: h.members.filter(m => m.age >= 18 && m.job).length });
}
export function normalizeHousehold(value) {
	if (!value || typeof value !== 'object') return null;
	const id = clean(value.id), memberId = clean(value.memberId);
	if (!id || !memberId || ['__proto__', 'constructor', 'prototype'].includes(id)) return null;
	const count = v => Number.isSafeInteger(v) ? Math.max(0, Math.min(20, v)) : 0;
	return { id, memberId, kind: clean(value.kind, 32), role: clean(value.role, 32),
		members: Math.max(1, count(value.members)), dependants: count(value.dependants), earners: count(value.earners) };
}
export function householdLine(actor, money = null) {
	const h = actor?.household;
	if (!h) return '';
	let line = `${actor.name || 'A resident'}: ${h.role || 'member'} in a ${h.members}-person ${h.kind.replaceAll('-', ' ') || 'household'}, ${h.dependants} dependants.`;
	if (money && Number.isFinite(money.balance)) line += ` Household account: ${Math.round(money.balance).toLocaleString('en-US')} credits; ${money.mood || 'budget recorded'}.`;
	if (money?.rent) line += ` Rent due in ${money.rent.inDays} days.`;
	return line;
}
export function householdOpportunities(state, at) {
	const requests = [], days = { ...(state.householdDays || {}) };
	if (state.situation.hazard >= .6) return { requests, days };
	const families = new Map();
	for (const a of Object.values(state.actors).sort((a,b) => a.id.localeCompare(b.id))) {
		if (a.registeredAt > at || !a.household || !a.sites.home || state.situation.unavailableActors.includes(a.id)) continue;
		if (!families.has(a.household.id)) families.set(a.household.id, a);
	}
	for (const [id, a] of families) {
		if (requests.length >= 4 || Object.keys(state.requests).length + requests.length >= 112) break;
		const local = at + a.utcOffsetMinutes * 60000, day = Math.floor(local / 86400000), hour = ((local % 86400000) + 86400000) % 86400000 / 3600000;
		if (hour < 8 || hour >= 20 || days[id] >= day || state.situation.destroyedSites.includes(a.sites.home) || state.situation.blockedSites.includes(a.sites.home)) continue;
		if (Object.values(state.requests).some(q => q.source === 'household-life' && q.giverId === a.id && !['completed','failed'].includes(q.status))) continue;
		if (!Object.values(state.actors).some(other => other.id !== a.id && other.registeredAt <= at && !state.situation.unavailableActors.includes(other.id))) continue;
		days[id] = day;
		requests.push({ id: `family:${a.id}:${day}`, title: a.household.dependants ? `Check in with ${a.name} about the family` : `Catch up with ${a.name} at home`,
			kind: 'checkin', source: 'household-life', giverId: a.id, siteId: a.sites.home, siteName: `${a.name}'s household`,
			durationMs: 10 * 60000, completionMode: 'social', tags: ['social','family'], allowNpc: true,
			choices: [{ id: 'defer', label: 'Give the household some time', effect: 'defer' }, { id: 'resume', label: 'Resume the visit', effect: 'resume' }] });
	}
	return { requests, days };
}
