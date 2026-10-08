// Levels and quality for gear (gameplay/arms.js). Every item you own is its own instance with
// an id, a level (1 to 10), a quality tier (Common to Legendary) and experience toward its
// next level. Stats are game numbers that grow with both; nothing here is a real-world spec.
// Pure functions over plain data, shared by the inventory, the gear screen and trading.

export const MAX_LEVEL = 10;
export const TIERS = Object.freeze([
	Object.freeze({ id: 'common', name: 'Common', color: '#c9d1d3', glow: 0 }),
	Object.freeze({ id: 'fine', name: 'Fine', color: '#6fdc8c', glow: 0.15 }),
	Object.freeze({ id: 'superior', name: 'Superior', color: '#5fb4ff', glow: 0.35 }),
	Object.freeze({ id: 'masterwork', name: 'Masterwork', color: '#c48bff', glow: 0.6 }),
	Object.freeze({ id: 'legendary', name: 'Legendary', color: '#ffb340', glow: 1 }),
]);
const STAT_TIER = [1, 1.12, 1.25, 1.42, 1.65];
const VALUE_TIER = [1, 1.6, 2.5, 4, 6.5];
const COST_TIER = [1, 1.2, 1.45, 1.8, 2.3];
// the material an outfitter uses for an upgrade
export const UPGRADE_MATERIAL = 'repair-roll';
export const UID_RE = /^[a-z0-9~-]{4,24}$/;

// each item's stats at level 1, Common: [label, value, unit, cap]
const STATS = {
	'aurora-trail-rifle': [['Accuracy', 70, '%', 99], ['Range', 60, 'u'], ['Steadiness', 50, '']],
	'mossback-scout-rifle': [['Accuracy', 66, '%', 99], ['Range', 45, 'u'], ['Quiet', 70, '%', 99]],
	'warden-spark-carbine': [['Deterrence', 60, '', 200], ['Reach', 25, 'u'], ['Recharge', 50, '']],
	'reedline-hunting-bow': [['Accuracy', 62, '%', 99], ['Range', 30, 'u'], ['Quiet', 80, '%', 99]],
	'hunting-net': [['Capture', 30, '%', 95], ['Reach', 6, 'u']],
	'trail-scent-kit': [['Trail length', 120, 'u'], ['Clarity', 50, '%', 99]],
	'door-brace': [['Hold', 40, ''], ['Setup speed', 50, '']],
	'lantern-alarm': [['Alert radius', 20, 'u'], ['Wake chance', 55, '%', 99]],
	'field-medkit': [['Heal', 35, ''], ['Recovery speed', 50, '']],
	'camp-lantern': [['Light radius', 12, 'u'], ['Burn time', 240, 'min']],
	'repair-roll': [['Repair', 25, ''], ['Work speed', 50, '']],
	'station-signal-flare': [['Visibility', 800, 'u'], ['Burn time', 60, 's']],
};

const int = (v, lo, hi, d) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
export const tierOf = (t) => TIERS[int(t, 0, 4, 0)];
// experience needed to go from this level to the next
export const xpNeed = (level) => 60 * level;
const statMult = (l, t) => (1 + 0.07 * (l - 1)) * STAT_TIER[t];

// an instance, cleaned (null when it is not one)
export function cleanInstance(x, known = () => true) {
	if (!x || typeof x !== 'object' || !UID_RE.test(x.u || '') || typeof x.i !== 'string' || !known(x.i)) return null;
	return { u: x.u, i: x.i, l: int(x.l, 1, MAX_LEVEL, 1), t: int(x.t, 0, 4, 0), x: int(x.x ?? 0, 0, 1e6, 0) };
}

// an item's stats at its level and tier, each with the next level's value for comparison
export function statsOf(inst) {
	const rows = STATS[inst?.i] || [];
	const m = statMult(inst.l, inst.t), next = inst.l < MAX_LEVEL ? statMult(inst.l + 1, inst.t) : m;
	const at = (v, k, cap) => { const n = v * k; const r = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10; return cap ? Math.min(cap, r) : r; };
	return rows.map(([label, v, unit, cap]) => ({ label, unit, value: at(v, m, cap), next: at(v, next, cap) }));
}
// the same stats compared: b minus a, label by label (a or b may be null: nothing to compare)
export function compareStats(a, b) {
	const A = a ? statsOf(a) : [], B = b ? statsOf(b) : [];
	return (B.length ? B : A).map((row, k) => ({ label: row.label, unit: row.unit, a: A[k]?.value ?? 0, b: B[k]?.value ?? 0, delta: Math.round(((B[k]?.value ?? 0) - (A[k]?.value ?? 0)) * 10) / 10 }));
}

// what an instance is worth against a fresh one, Common, level 1
export const valueFactor = (inst) => (1 + 0.18 * (int(inst?.l, 1, 10, 1) - 1)) * VALUE_TIER[int(inst?.t, 0, 4, 0)];
// credits for one more level at an outfitter (plus one upgrade material)
export const upgradeCost = (inst, basePrice) => Math.round(basePrice * 0.35 * inst.l * COST_TIER[inst.t]);
export const canUpgrade = (inst) => !!inst && inst.l < MAX_LEVEL;
export const canCombine = (a, b) => !!a && !!b && a.u !== b.u && a.i === b.i && a.t === b.t && a.t < TIERS.length - 1;
// two of a kind and tier become one of the next tier, keeping the better level
export const combined = (a, b) => ({ u: a.u, i: a.i, l: Math.max(a.l, b.l), t: a.t + 1, x: Math.max(a.x, b.x) });

// experience gained: levels rise while it covers the next one
export function trained(inst, xp) {
	let { l, x } = inst;
	x += Math.max(0, Math.round(xp));
	while (l < MAX_LEVEL && x >= xpNeed(l)) { x -= xpNeed(l); l++; }
	if (l >= MAX_LEVEL) x = 0;
	return { ...inst, l, x };
}

// a short, stable id from a transaction id and a count (FNV-1a, two seeds)
function fnv(s, h) { for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
export function mintUid(seed, n = 0) {
	const s = `${seed}#${n}`;
	return (fnv(s, 2166136261).toString(36) + fnv(s, 3323198485).toString(36)).slice(0, 14).padEnd(6, '0');
}
// instances held, grouped by item, level and tier (best first), for lists
export function groupInstances(list) {
	const groups = new Map();
	for (const x of list) { const k = `${x.i}|${x.l}|${x.t}`; if (!groups.has(k)) groups.set(k, { i: x.i, l: x.l, t: x.t, list: [] }); groups.get(k).list.push(x); }
	return [...groups.values()].sort((a, b) => a.i.localeCompare(b.i) || b.t - a.t || b.l - a.l);
}
