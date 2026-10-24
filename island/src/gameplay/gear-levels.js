// Levels and quality for gear (gameplay/arms.js). Every item you own is its own instance with
// an id, a level, a quality tier (Common to Legendary) and experience toward its next level.
// Experience and outfitters carry it to level 99 (LEVEL_CAP). The hundredth, 100★, is earned:
// a weapon or garment at 99 has a trial of its own (ASCEND_TRIALS), and its experience counts
// that trial instead (trialStep). Stats are game numbers that grow with level and tier; nothing
// here is a real-world spec. Weapons and garments also lend attributes (rows in 'pt',
// magic/stats.js), and their magic wakes as they climb (gameplay/gear-magic.js). Pure
// functions over plain data, shared by the inventory, the gear screen and trading.

// the most experience and outfitters reach; the hundredth beyond it is earned by a trial
export const LEVEL_CAP = 99;
export const ASCENDED = 100;
export const MAX_LEVEL = ASCENDED;
// the level past which growth slows: 7% a level up to it, 5% a level to 20, then ever slower
export const SOFT_LEVEL = 10;
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

// each item's stats at level 1, Common: [label, value, unit, cap]. A row in 'pt' is an
// attribute the item lends you while held or worn (whole points; magic/stats.js ATTRS)
const STATS = {
	'aurora-trail-rifle': [['Accuracy', 70, '%', 99], ['Range', 60, 'u'], ['Steadiness', 50, ''], ['Precision', 3, 'pt']],
	'mossback-scout-rifle': [['Accuracy', 66, '%', 99], ['Range', 45, 'u'], ['Quiet', 70, '%', 99], ['Precision', 2, 'pt'], ['Focus', 1, 'pt']],
	'longwatch-sniper-rifle': [['Accuracy', 82, '%', 99], ['Range', 90, 'u'], ['Stopping power', 90, '', 200], ['Precision', 4, 'pt'], ['Focus', 1, 'pt']],
	'warden-spark-carbine': [['Deterrence', 60, '', 200], ['Reach', 25, 'u'], ['Recharge', 50, ''], ['Precision', 2, 'pt'], ['Resolve', 1, 'pt']],
	'reedline-hunting-bow': [['Accuracy', 62, '%', 99], ['Range', 30, 'u'], ['Quiet', 80, '%', 99], ['Precision', 2, 'pt'], ['Swiftness', 1, 'pt']],
	// garments (gameplay/arms.js GARMENTS): attributes only
	'wayfarers-hood': [['Focus', 3, 'pt'], ['Resolve', 2, 'pt']],
	'stargazer-circlet': [['Potency', 3, 'pt'], ['Haste', 2, 'pt']],
	'aetherweave-coat': [['Vigour', 3, 'pt'], ['Potency', 2, 'pt']],
	'rangers-jacket': [['Resolve', 3, 'pt'], ['Precision', 2, 'pt']],
	'spellbinder-gloves': [['Haste', 3, 'pt'], ['Potency', 2, 'pt']],
	'fieldcraft-gloves': [['Precision', 3, 'pt'], ['Swiftness', 2, 'pt']],
	'trailstrider-boots': [['Swiftness', 3, 'pt'], ['Vigour', 2, 'pt']],
	'duskwalker-boots': [['Swiftness', 3, 'pt'], ['Focus', 2, 'pt']],
	'aetherweave-trousers': [['Focus', 3, 'pt'], ['Vigour', 2, 'pt']],
	'rangers-trousers': [['Armour', 2, '%', 6], ['Swiftness', 2, 'pt'], ['Precision', 2, 'pt']],
	// armour: Armour (harm turned aside, grows to a cap), Weight (kg: slows you past a light
	// load) and Spellcraft (spells' strength lost to steel); neither of the last two grows
	'kettle-helm': [['Armour', 5, '%', 12], ['Weight', 2.5, 'kg'], ['Spellcraft', -2, '-%'], ['Resolve', 2, 'pt']],
	'great-helm': [['Armour', 8, '%', 18], ['Weight', 3.5, 'kg'], ['Spellcraft', -5, '-%'], ['Resolve', 3, 'pt'], ['Vigour', 1, 'pt']],
	'gambeson': [['Armour', 6, '%', 14], ['Weight', 3, 'kg'], ['Vigour', 2, 'pt'], ['Resolve', 1, 'pt']],
	'mail-hauberk': [['Armour', 11, '%', 24], ['Weight', 10, 'kg'], ['Spellcraft', -4, '-%'], ['Resolve', 3, 'pt'], ['Vigour', 2, 'pt']],
	'plate-cuirass': [['Armour', 16, '%', 32], ['Weight', 14, 'kg'], ['Spellcraft', -8, '-%'], ['Resolve', 4, 'pt'], ['Vigour', 3, 'pt']],
	'mail-chausses': [['Armour', 6, '%', 14], ['Weight', 5, 'kg'], ['Spellcraft', -2, '-%'], ['Resolve', 2, 'pt']],
	'plate-greaves': [['Armour', 8, '%', 18], ['Weight', 6, 'kg'], ['Spellcraft', -3, '-%'], ['Resolve', 2, 'pt'], ['Vigour', 1, 'pt']],
	'plate-gauntlets': [['Armour', 4, '%', 10], ['Weight', 1.5, 'kg'], ['Spellcraft', -4, '-%'], ['Precision', 2, 'pt']],
	'leather-bracers': [['Armour', 2, '%', 5], ['Weight', 0.6, 'kg'], ['Precision', 2, 'pt'], ['Swiftness', 1, 'pt']],
	'sabatons': [['Armour', 4, '%', 10], ['Weight', 2, 'kg'], ['Spellcraft', -1, '-%'], ['Resolve', 2, 'pt']],
	'riding-boots': [['Armour', 2, '%', 5], ['Weight', 1.2, 'kg'], ['Swiftness', 2, 'pt'], ['Vigour', 1, 'pt']],
	'ops-cap': [['Precision', 3, 'pt'], ['Focus', 1, 'pt']],
	'ballistic-helmet': [['Armour', 7, '%', 16], ['Weight', 1.5, 'kg'], ['Resolve', 2, 'pt'], ['Precision', 2, 'pt']],
	'combat-shirt': [['Armour', 2, '%', 5], ['Weight', 0.5, 'kg'], ['Swiftness', 2, 'pt'], ['Precision', 1, 'pt']],
	'chest-rig': [['Armour', 4, '%', 10], ['Weight', 3, 'kg'], ['Precision', 2, 'pt'], ['Swiftness', 1, 'pt']],
	'plate-carrier': [['Armour', 14, '%', 30], ['Weight', 9, 'kg'], ['Resolve', 3, 'pt'], ['Vigour', 2, 'pt']],
	'combat-trousers': [['Armour', 3, '%', 7], ['Weight', 1, 'kg'], ['Swiftness', 2, 'pt'], ['Resolve', 1, 'pt']],
	'tactical-gloves': [['Armour', 1, '%', 3], ['Weight', 0.2, 'kg'], ['Precision', 3, 'pt']],
	'combat-boots': [['Armour', 3, '%', 7], ['Weight', 1.4, 'kg'], ['Swiftness', 2, 'pt'], ['Vigour', 1, 'pt']],
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
// experience needed to go from this level to the next: 60 a level to 10, then 600 and 8 more a
// level (about 87,000 from 1 to 99)
export const xpNeed = (level) => (level <= SOFT_LEVEL ? 60 * level : 600 + 8 * (level - SOFT_LEVEL));
// growth with level: 7% a level to 10, 5% a level to 20, then ever more slowly to three times at
// 99; the hundredth a tenth more again
export function levelGrowth(l) {
	if (l <= SOFT_LEVEL) return 1 + 0.07 * (l - 1);
	if (l <= 20) return 1.63 + 0.05 * (l - SOFT_LEVEL);
	if (l <= LEVEL_CAP) return 2.13 + 0.87 * Math.pow((l - 20) / (LEVEL_CAP - 20), 0.7);
	return 3.3;
}
const statMult = (l, t) => levelGrowth(l) * STAT_TIER[t];
// the same growth as one number for an instance (combat/weapons.js scales its numbers by it)
export const statScale = (inst) => statMult(int(inst?.l, 1, MAX_LEVEL, 1), int(inst?.t, 0, 4, 0));

// an instance, cleaned (null when it is not one)
export function cleanInstance(x, known = () => true) {
	if (!x || typeof x !== 'object' || !UID_RE.test(x.u || '') || typeof x.i !== 'string' || !known(x.i)) return null;
	return { u: x.u, i: x.i, l: int(x.l, 1, MAX_LEVEL, 1), t: int(x.t, 0, 4, 0), x: int(x.x ?? 0, 0, 1e6, 0) };
}

// an item's stats at its level and tier, each with the next level's value for comparison
export function statsOf(inst) {
	const rows = STATS[inst?.i] || [];
	const m = statMult(inst.l, inst.t), next = inst.l < MAX_LEVEL ? statMult(inst.l + 1, inst.t) : m;
	// (weight and a hindrance to spells are what the thing is: they do not grow)
	const at = (v, k, cap, unit) => { if (unit === 'kg' || unit === '-%') return v; const n = v * k; const r = n >= 100 || unit === 'pt' ? Math.round(n) : Math.round(n * 10) / 10; return cap ? Math.min(cap, r) : r; };
	return rows.map(([label, v, unit, cap]) => ({ label, unit, value: at(v, m, cap, unit), next: at(v, next, cap, unit) }));
}
// the same stats compared: b minus a, label by label (a or b may be null: nothing to compare)
export function compareStats(a, b) {
	const A = a ? statsOf(a) : [], B = b ? statsOf(b) : [];
	return (B.length ? B : A).map((row, k) => ({ label: row.label, unit: row.unit, a: A[k]?.value ?? 0, b: B[k]?.value ?? 0, delta: Math.round(((B[k]?.value ?? 0) - (A[k]?.value ?? 0)) * 10) / 10 }));
}

// what an instance is worth against a fresh one, Common, level 1 (18% a level to 20, 6% after)
export const valueFactor = (inst) => { const l = int(inst?.l, 1, MAX_LEVEL, 1); return (1 + 0.18 * (Math.min(l, 20) - 1) + 0.06 * Math.max(0, l - 20)) * VALUE_TIER[int(inst?.t, 0, 4, 0)]; };
// credits for one more level at an outfitter (plus one upgrade material)
export const upgradeCost = (inst, basePrice) => Math.round(basePrice * 0.35 * inst.l * COST_TIER[inst.t]);
export const canUpgrade = (inst) => !!inst && inst.l < LEVEL_CAP;
export const canCombine = (a, b) => !!a && !!b && a.u !== b.u && a.i === b.i && a.t === b.t && a.t < TIERS.length - 1;
// two of a kind and tier become one of the next tier, keeping the better level (and that one's
// experience, or its trial's progress at 99)
export function combined(a, b) {
	const hi = a.l === b.l ? (a.x >= b.x ? a : b) : a.l > b.l ? a : b;
	return { u: a.u, i: a.i, l: hi.l, t: a.t + 1, x: hi.x };
}

// the experience it would take to reach level 99 from where it stands
export function xpToMax(inst) {
	let n = -int(inst?.x ?? 0, 0, 1e6, 0);
	for (let l = int(inst?.l, 1, MAX_LEVEL, 1); l < LEVEL_CAP; l++) n += xpNeed(l);
	return Math.max(0, n);
}
// experience gained: levels rise while it covers the next one, to 99. At 99 experience no
// longer counts (x is the trial's progress there: trialStep).
export function trained(inst, xp) {
	if (inst.l >= LEVEL_CAP) return inst;
	let { l, x } = inst;
	x += Math.max(0, Math.round(xp));
	while (l < LEVEL_CAP && x >= xpNeed(l)) { x -= xpNeed(l); l++; }
	if (l >= LEVEL_CAP) x = 0;
	return { ...inst, l, x };
}

// What the hundredth takes, by what an item is (gameplay/arms.js: a catalog item's `ascend`): a
// weapon brings down one of the great beasts or machines while in hand; a garment carries its
// own school through 300 spells cast while it is worn.
export const ASCEND_TRIALS = Object.freeze({
	weapon: Object.freeze({ n: 1, what: 'boss' }),
	garment: Object.freeze({ n: 300, what: 'casts' }),
});
// n more toward an item's trial at 99, of `of`: done, it is 100★ (anything else is unchanged)
export function trialStep(inst, n, of) {
	if (inst?.l !== LEVEL_CAP || !(of > 0)) return inst;
	const x = Math.min(of, (inst.x || 0) + Math.max(0, Math.floor(n)));
	return x >= of ? { ...inst, l: ASCENDED, x: 0 } : { ...inst, x };
}
// a level as it is shown: 100★ for the hundredth
export const levelText = (l) => (l >= ASCENDED ? `${ASCENDED}★` : String(l));

// a short, stable id from a transaction id and a count (FNV-1a, two seeds)
function fnv(s, h) { for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
// a stable whole number from a string (an item's attunement comes from its id: gear-magic.js)
export const hashOf = (s) => fnv(String(s), 2166136261);
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
