// Keep a citizen's first observed family through streaming and reload. Household
// bodies remain temporary; the demographic record does not depend on pool order.
const KEY = 'l99-household-identities-v1';
const valid = s => typeof s === 'string' && s.length > 0 && s.length <= 240 && !['__proto__', 'constructor', 'prototype'].includes(s);
const clone = x => JSON.parse(JSON.stringify(x));
export function createHouseholdMemory(storage = globalThis.localStorage) {
	let data = {}, blocked = false;
	try {
		const raw = storage?.getItem(KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed?.version !== 1 || !parsed.records || Array.isArray(parsed.records)) throw Error('Invalid household save');
			data = parsed.records;
		}
	} catch { blocked = true; }
	const key = (scope, actor) => JSON.stringify([scope, actor]);
	function remember(scope, actor, household, member) {
		if (!valid(scope) || !valid(actor) || !household?.members?.length || !member?.id || blocked) return false;
		const id = key(scope, actor);
		if (data[id]) return true;
		// Never evict an older family to make room for a newly discovered person.
		if (Object.keys(data).length >= 4096) return false;
		const family = clone(household);
		delete family.food; delete family.well; delete family.taken;
		for (const m of family.members) delete m.embodied;
		const next = { ...data, [id]: { household: family, memberId: member.id } };
		try { storage.setItem(KEY, JSON.stringify({ version: 1, records: next })); data = next; return true; }
		catch { return false; }
	}
	function recall(scope, actor) {
		const value = data[key(scope, actor)];
		if (!value?.household?.members?.some(m => m.id === value.memberId)) return null;
		return clone(value);
	}
	return { remember, recall, status: () => ({ blocked, count: Object.keys(data).length }) };
}
