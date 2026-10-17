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
// The hundredth level (magic/trials.js) adds five to every one.
//
// The gear's own magic is scoped like a perk's: its school's spells stronger, cheaper and
// quicker (power, mana, cd), one spell of the school changed (alter), every few spells free
// (free), and the weapon in hand's hits (gearWeapon: magic/index.js and magic/caster.js).

import { computeMods, rankOf, levelOf, LEVEL_CAP } from './skills.js';
import { trialsOf, trialsOpen, riteBlock, ASCENDED_ATTRIBUTE } from './trials.js';
import { SCHOOLS, STRANDS, manaMax, manaRegen, spellPower, cooldownOf, modFor } from './spells.js';
import { gearMagic, attributesOf as itemAttributes } from '../gameplay/gear-magic.js';
import { ARMS_CATALOG } from '../gameplay/arms.js';

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
	for (const k of ATTR_IDS) {
		from[k] = from[k].map(([label, n]) => [label, Math.min(BASE_CAP, Math.floor(n))]);
		if (s.ascended) from[k].push(['The hundredth', ASCENDED_ATTRIBUTE]);
	}
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
	m.alter = G.alter;
	m.free = G.free;
	m.gearWeapon = G.weapon;
	m.armor = Math.min(ARMOR_CAP, m.armor);
	m.life = Math.round(m.life);
	m.manaMax = Math.round(m.manaMax);
	return m;
}
// state.mods made anew, with the attributes and the gear's magic kept for the sheet
export function refreshStats(s) {
	s.mods = composeMods(s);
	return s.mods;
}

// The sheet: everything about you as numbers, for the Character view (ui/gear.js).
// light: the sun's height now (spells' strength by the time of day); trial: what the trials
// read from your gear (magic/trials.js)
export function statSheet(s, { light = 0.5, trial = {} } = {}) {
	const M = s.mods || composeMods(s), A = attributesOf(s), G = gearMagic(s.gear || []);
	const pct = (v) => Math.round(v * 100);
	const schools = Object.entries(SCHOOLS).map(([id, S]) => {
		const probe = { id, school: id, mana: 100, cd: 10 };
		const aff = S.strand === 'twilight' ? Math.min(s.affinity.light, s.affinity.dark) : s.affinity[S.strand] || 0;
		const mana = (1 - Math.min(0.33, aff / 900)) * (1 - Math.min(0.6, modFor(M, 'mana', probe)));
		return { id, name: S.name, color: S.color, strand: S.strand, power: pct(spellPower(s, probe, { light })), mana: pct(mana), cd: pct(cooldownOf(s, probe) / 10), free: M.free?.[id] || 0, gear: pct(G.power[id] || 0) };
	});
	return {
		level: levelOf(s), ascended: !!s.ascended, cap: LEVEL_CAP,
		trials: trialsOf(s, trial), trialsOpen: trialsOpen(s), rite: s.ascended ? null : riteBlock(s, trial),
		attrs: A,
		life: BASE_LIFE + (M.life || 0),
		lifeRegen: Math.round((M.hpRegen || 0) * 100) / 100,
		mana: manaMax(s),
		manaRegen: Math.round(manaRegen(s, false) * 10) / 10,
		manaRegenFighting: Math.round(manaRegen(s, true) * 10) / 10,
		harmTaken: 100 - pct(M.armor || 0),
		weapon: pct(M.weapon || 0), weak: pct(M.weak || 0), boss: pct(M.boss || 0), manaOnHit: M.manaOnHit || 0,
		pace: pct(M.speed || 0), jump: pct(M.jump || 0), fall: pct(M.fall || 0), xp: pct(M.xp || 0),
		affinity: { ...s.affinity }, strands: STRANDS,
		schools,
		magic: G.lines,
		weaponMagic: G.weapon,
	};
}
