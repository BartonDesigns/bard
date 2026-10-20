// Your statistics: seven attributes, what feeds them and what they do, folded together with
// your perks (magic/skills.js) and the magic in what you wear and hold (gameplay/gear-magic.js)
// into the one set of numbers the spells and the fight read, state.mods. Pure: no three, no DOM
// (island/tools/gear-magic.test.mjs).
//
// Every attribute has a part that grows with you and a part your gear lends:
//
//   Vigour     life, and wounds that close out of a fight     your Resilience rank
//   Resolve    harm turned aside                              your Resilience rank
//   Precision  weapon harm, more on heads and weak points     your Marksman rank
//   Swiftness  pace and spring                                your Athletics rank
//   Potency    the strength of every spell                    your three best schools of magic
//   Focus      a deeper mana pool that fills faster           your level
//   Haste      spells come back sooner                        your Chrono rank
//
// The gear's own magic is scoped like a perk's: its school's spells stronger, cheaper and
// quicker (power, mana, cd), one spell of the school changed (alter), every few spells free
// (free), and the weapon in hand's hits (gearWeapon: magic/index.js and magic/caster.js).

import { computeMods, rankOf, applyMastery, masteryLevel, MASTERY_POWER, NUMERAL } from './perks.js';
import { SCHOOLS, STRANDS, manaMax, manaRegen, spellPower, cooldownOf, modFor } from './spells.js';
import { gearMagic, attributesOf as itemAttributes } from '../gameplay/gear-magic.js';
import { statsOf } from '../gameplay/gear-levels.js';
import { ARMS_CATALOG } from '../gameplay/arms.js';
import { rankOf as honorRank, honorMods } from '../combat/honor.js';
import { foldMeals } from '../cooking/meals.js';

// per: what one point of it gives (life and manaMax in points, regen in points a second, the
// rest as shares)
export const ATTRS = Object.freeze({
	vigour: { name: 'Vigour', glyph: '❤', color: '#ff8a8a', line: 'Life, and wounds that close out of a fight.', per: { life: 2.5, hpRegen: 0.02 } },
	resolve: { name: 'Resolve', glyph: '⛨', color: '#d8c49a', line: 'Harm turned aside.', per: { armor: 0.004 } },
	precision: { name: 'Precision', glyph: '⌖', color: '#ff8f6b', line: 'Harder weapon hits, harder still on heads and weak points.', per: { weapon: 0.008, weak: 0.008 } },
	swiftness: { name: 'Swiftness', glyph: '»', color: '#7ff0e0', line: 'Pace and spring.', per: { speed: 0.003, jump: 0.003 } },
	potency: { name: 'Potency', glyph: '✦', color: '#ffd27a', line: 'The strength of every spell.', per: { power: 0.006 } },
	focus: { name: 'Focus', glyph: '◈', color: '#8fb0ff', line: 'A deeper mana pool that fills faster.', per: { manaMax: 2.5, regen: 0.05 } },
	haste: { name: 'Haste', glyph: '⌁', color: '#e8d6ff', line: 'Spells come back sooner.', per: { cd: 0.005 } },
});
export const ATTR_IDS = Object.freeze(Object.keys(ATTRS));
// the most your own growth lends any one attribute
export const BASE_CAP = 30;
// your life before Vigour (combat/combat.js's own)
export const BASE_LIFE = 100;
// the most harm turned aside, perks and Resolve together
export const ARMOR_CAP = 0.6;

// what armour costs: past a light load (kg) each kilo slows you a little, to a floor
export const FREE_LOAD = 8;
export const LOAD_PACE = 0.01;
export const LOAD_FLOOR = 0.3;
// What you wear as armour (gameplay/gear-levels.js rows): armour (a share of harm turned
// aside), kg carried, and spellcraft (a share of spells' strength lost to steel, negative),
// with each item's part: { armor, kg, spell, items: [{ name, armor, kg, spell }] }
export function armourOf(gear = []) {
	const out = { armor: 0, kg: 0, spell: 0, items: [] };
	for (const inst of gear) {
		if (!inst) continue;
		const row = (label) => statsOf(inst).find((r) => r.label === label)?.value || 0;
		const it = { name: ARMS_CATALOG[inst.i]?.name || inst.i, armor: row('Armour') / 100, kg: row('Weight'), spell: row('Spellcraft') / 100 };
		if (!it.armor && !it.kg && !it.spell) continue;
		out.armor += it.armor; out.kg += it.kg; out.spell += it.spell;
		out.items.push(it);
	}
	out.kg = Math.round(out.kg * 10) / 10;
	return out;
}
// the pace lost to a load of kg (a share)
export const loadPace = (kg) => Math.min(LOAD_FLOOR, Math.max(0, kg - FREE_LOAD) * LOAD_PACE);

// what grows with you: { attr: [[where from, points]] }
export function baseAttributes(s) {
	const r = (k) => rankOf(s.use?.[k] || 0);
	const best = Object.keys(SCHOOLS).map(r).sort((a, b) => b - a);
	const from = {
		vigour: [['Resilience rank', r('resilience') / 4]],
		resolve: [['Resilience rank', r('resilience') / 6]],
		precision: [['Marksman rank', r('marksman') / 4]],
		swiftness: [['Athletics rank', r('athletics') / 4]],
		potency: [['Your three best schools', (best[0] + best[1] + best[2]) / 12]],
		focus: [['Your level', ((s.level || 1) - 1) / 2]],
		haste: [['Chrono rank', r('chrono') / 5]],
	};
	for (const k of ATTR_IDS) from[k] = from[k].map(([label, n]) => [label, Math.min(BASE_CAP, Math.floor(n))]);
	return from;
}

// every attribute: { total, from: [{ label, n }] } (gear: each item that lends it, by name)
export function attributesOf(s, gear = s.gear || []) {
	const base = baseAttributes(s), out = {};
	for (const k of ATTR_IDS) out[k] = { total: 0, from: base[k].filter(([, n]) => n > 0).map(([label, n]) => ({ label, n })) };
	for (const inst of gear) for (const { attr, n } of itemAttributes(inst)) if (out[attr] && n > 0) out[attr].from.push({ label: ARMS_CATALOG[inst.i]?.name || inst.i, n, gear: true });
	for (const k of ATTR_IDS) out[k].total = out[k].from.reduce((a, f) => a + f.n, 0);
	return out;
}

// Your mods: the perks (or `perks`, to see a perk before it is taken), the attributes and the
// gear's magic together. s.gear: the instances worn and held.
export function composeMods(s, perks = s.perks || []) {
	const m = computeMods(perks), G = gearMagic(s.gear || []), A = attributesOf(s);
	m.life = 0;
	for (const k of ATTR_IDS) {
		const n = A[k].total;
		if (!n) continue;
		for (const [stat, v] of Object.entries(ATTRS[k].per)) {
			if (stat === 'power' || stat === 'cd') m[stat].all = (m[stat].all || 0) + v * n;
			else m[stat] = (m[stat] || 0) + v * n;
		}
	}
	for (const stat of ['power', 'mana', 'cd']) for (const [school, v] of Object.entries(G[stat])) m[stat][school] = (m[stat][school] || 0) + v;
	// the armour you wear: harm turned aside, the weight of it, steel in the way of the weave
	const W = armourOf(s.gear || []);
	m.armor += W.armor;
	m.speed -= loadPace(W.kg); m.jump -= loadPace(W.kg) * 0.8;
	if (W.spell) m.power.all = (m.power.all || 0) + W.spell;
	m.load = W.kg;
	m.alter = G.alter;
	m.free = G.free;
	m.gearWeapon = G.weapon;
	applyMastery(s, m);
	// your honor's rank: combat, health and defence (combat/honor.js)
	m.honor = honorRank(s.honor?.pts || 0);
	const H = honorMods(m.honor);
	m.weapon += H.weapon; m.life += H.life; m.armor += H.armor;
	// the meals you cooked and ate today (cooking/meals.js): they last the day, deaths and all
	if (s.fed?.length) foldMeals(m, s.fed);
	m.armor = Math.min(ARMOR_CAP, m.armor);
	m.life = Math.round(m.life);
	m.manaMax = Math.round(m.manaMax);
	return m;
}
// Where a spell's strength comes from, past its own: [{ label, n (a share), kind }], kind perk,
// gear (one row an item, by name), attr (Potency) or mastery. Time of day and affinity are
// spellPower's own and not here.
export function powerSources(s, spell) {
	const out = [], add = (label, n, kind) => { if (n > 0.0005) out.push({ label, n, kind }); };
	add('Perks', modFor(computeMods(s.perks || []), 'power', spell), 'perk');
	for (const inst of s.gear || []) add(ARMS_CATALOG[inst.i]?.name || inst.i, gearMagic([inst]).power[spell.school] || 0, 'gear');
	const pot = attributesOf(s).potency.total;
	add(`Potency ${pot}`, pot * ATTRS.potency.per.power, 'attr');
	const L = masteryLevel(s.mastery?.[spell.id] || 0);
	add(`Mastery ${NUMERAL[L - 1]}`, (L - 1) * MASTERY_POWER, 'mastery');
	// (and what steel takes away)
	for (const it of armourOf(s.gear || []).items) if (it.spell < 0) out.push({ label: it.name, n: it.spell, kind: 'steel' });
	return out;
}
// the worn item that changes this spell (its L15 alteration): { item, desc } or null
export function alteredBy(s, spell) {
	for (const inst of s.gear || []) {
		const a = gearMagic([inst]).alter[spell.id];
		if (a) return { item: ARMS_CATALOG[inst.i]?.name || inst.i, desc: a.desc };
	}
	return null;
}
// state.mods made anew, with the attributes and the gear's magic kept for the sheet
export function refreshStats(s) {
	s.mods = composeMods(s);
	return s.mods;
}

// The sheet: everything about you as numbers, for the Character view (ui/gear.js).
// light: the sun's height now (spells' strength by the time of day)
export function statSheet(s, { light = 0.5 } = {}) {
	const M = s.mods || composeMods(s), A = attributesOf(s), G = gearMagic(s.gear || []);
	const pct = (v) => Math.round(v * 100);
	const schools = Object.entries(SCHOOLS).map(([id, S]) => {
		const probe = { id, school: id, mana: 100, cd: 10 };
		const aff = S.strand === 'twilight' ? Math.min(s.affinity.light, s.affinity.dark) : s.affinity[S.strand] || 0;
		const mana = (1 - Math.min(0.33, aff / 900)) * (1 - Math.min(0.6, modFor(M, 'mana', probe)));
		return { id, name: S.name, color: S.color, strand: S.strand, power: pct(spellPower(s, probe, { light })), mana: pct(mana), cd: pct(cooldownOf(s, probe) / 10), free: M.free?.[id] || 0, gear: pct(G.power[id] || 0) };
	});
	return {
		level: s.level || 1,
		attrs: A,
		life: BASE_LIFE + (M.life || 0),
		lifeRegen: Math.round((M.hpRegen || 0) * 100) / 100,
		mana: manaMax(s),
		manaRegen: Math.round(manaRegen(s, false) * 10) / 10,
		manaRegenFighting: Math.round(manaRegen(s, true) * 10) / 10,
		harmTaken: 100 - pct(M.armor || 0), load: M.load || 0, loadPace: pct(loadPace(M.load || 0)),
		weapon: pct(M.weapon || 0), weak: pct(M.weak || 0), boss: pct(M.boss || 0), manaOnHit: M.manaOnHit || 0,
		pace: pct(M.speed || 0), jump: pct(M.jump || 0), fall: pct(M.fall || 0), xp: pct(M.xp || 0),
		affinity: { ...s.affinity }, strands: STRANDS,
		schools,
		magic: G.lines,
		weaponMagic: G.weapon,
	};
}
