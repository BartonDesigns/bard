// The magic in gear. Every weapon and garment (gameplay/arms.js) is attuned to one school of
// magic (magic/spells.js), fixed by its own id: two hoods are rarely alike, a hood keeps its
// school through upgrades, combining (the one you keep) and trades. As it levels its magic
// wakes, at 5, 10, 15 and 20, while you hold the weapon or wear the garment:
//
//   5   Attuned   its school's spells strike harder (and heal and ward more)
//   10  Flow      a garment: the school's spells cost less and come back sooner;
//                 a weapon: each hit takes time off the school's cooldowns (Spellstrike)
//   15  Altered   a garment changes how one of the school's spells works (ALTERATIONS);
//                 a weapon: its hits carry the school's nature (INFUSIONS)
//   20  Mastery   a garment: every few spells of its school cost nothing;
//                 a weapon: every few hits it looses one of the school's spells (SPELLSHOT)
//
// The better its quality tier, the stronger the numbers. Gear is levelled by use, at an
// outfitter, or by infusing it with aether fabric of its school's strand.
// Pure: no three, no DOM (island/tools/gear-magic.test.mjs). magic/stats.js sums it.

import { ARMS_CATALOG } from './arms.js';
import { hashOf, statsOf } from './gear-levels.js';
import { SCHOOLS, SPELL, SPELLS } from '../magic/spells.js';

export const AWAKEN = Object.freeze([5, 10, 15, 20]);
export const AWAKEN_NAMES = Object.freeze(['Attuned', 'Flow', 'Altered', 'Mastery']);
// experience a thread of fabric gives when infused into gear
export const XP_PER_FABRIC = 3;

// the schools each weapon can be attuned to (all eleven between them); a garment can take any
const WEAPON_SCHOOLS = Object.freeze({
	'aurora-trail-rifle': ['radiance', 'storm', 'void', 'warding', 'dawn'],
	'mossback-scout-rifle': ['shadow', 'blight', 'umbral', 'chrono', 'void'],
	'warden-spark-carbine': ['storm', 'warding', 'chrono', 'restoration', 'radiance'],
	'reedline-hunting-bow': ['primal', 'radiance', 'shadow', 'blight', 'dawn', 'restoration'],
});
const ALL_SCHOOLS = Object.freeze(Object.keys(SCHOOLS));

// a school's mark: the glyph of its first spell
const GLYPH = Object.fromEntries(Object.keys(SCHOOLS).map((k) => [k, SPELLS.filter((q) => q.school === k).sort((a, b) => a.tier - b.tier)[0]?.glyph || '✦']));
export const schoolGlyph = (school) => GLYPH[school] || '';

export const isGarmentId = (id) => ARMS_CATALOG[id]?.kind === 'garment';
export const isWeaponId = (id) => !!WEAPON_SCHOOLS[id];
// does this item carry magic at all
export const isMagical = (id) => isWeaponId(id) || isGarmentId(id);
const schoolsFor = (id) => WEAPON_SCHOOLS[id] || (isGarmentId(id) ? ALL_SCHOOLS : null);

// the school an instance is attuned to (null: not a magical item)
export function attunement(inst) {
	const list = inst && schoolsFor(inst.i);
	if (!list || typeof inst.u !== 'string') return null;
	return list[hashOf(`${inst.u}|${inst.i}`) % list.length];
}
// which strands of fabric it takes when infused: its school's, or either for a twilight school
export function infuseStrands(inst) {
	const st = SCHOOLS[attunement(inst)]?.strand;
	return st === 'twilight' ? ['light', 'dark'] : st ? [st] : [];
}

const tierOf = (inst) => Math.max(0, Math.min(4, inst?.t | 0));
const levelOf = (inst) => Math.max(1, inst?.l | 0);
const pc = (v) => `${Math.round(v * 100)}%`;
const secs = (v) => `${Math.round(v * 10) / 10}`;

// L5: the school's spells strike harder
export const attunedPower = (t) => 0.05 + 0.02 * t;
// L10 on a garment: cheaper and quicker; on a weapon, seconds off the school's cooldowns a hit
export const flowShare = (t) => 0.06 + 0.02 * t;
export const strikeCut = (t) => Math.round((0.3 + 0.1 * t) * 10) / 10;
// L20: every this many spells (a garment) or hits (a weapon)
export const masteryEvery = (t) => [5, 5, 4, 4, 3][t];
export const spellshotEvery = (t) => [6, 5, 5, 4, 3][t];

// L15 on a garment: how it changes one spell of its school. set: fields put on the spell, add:
// fields added to, status: fields put on its status (magic/spells.js shaped reads them all;
// magic/caster.js does the work)
export const ALTERATIONS = Object.freeze({
	radiance: { spell: 'sunspark', set: { split: 3, dmgK: 0.6 }, desc: 'Sunspark flies as three sparks in a fan, each three fifths as strong.' },
	restoration: { spell: 'mend', set: { renew: 0.5, renewT: 6 }, desc: 'Mend goes on healing half as much again over six seconds.' },
	warding: { spell: 'aegis', set: { aura: { dps: 6, r: 3.5, t: 10 } }, desc: 'Aegis also lights a radiant aura round you for ten seconds.' },
	dawn: { spell: 'swiftstride', set: { waterWalk: true }, desc: 'Swiftstride carries you across water too.' },
	shadow: { spell: 'shadowstep', set: { cloakAfter: 3 }, desc: 'Shadowstep leaves you cloaked for three seconds.' },
	void: { spell: 'void-shard', set: { pierce: 'all' }, desc: 'Void Shard passes through everyone in its path.' },
	blight: { spell: 'hex-of-decay', status: { spread: 10 }, desc: 'Hex of Decay leaps to the nearest foe when its victim falls.' },
	umbral: { spell: 'shade', add: { n: 1 }, desc: 'Summon Shade calls two shades.' },
	storm: { spell: 'chain-lightning', add: { jumps: 3 }, desc: 'Chain Lightning leaps three more times.' },
	chrono: { spell: 'mark-and-recall', set: { recallHeal: 0.25 }, desc: 'Returning to your mark closes a quarter of your wounds.' },
	primal: { spell: 'cinder', set: { burn: { dps: 10, r: 2.5, t: 4 } }, desc: 'Cinder leaves the ground burning where it lands for four seconds.' },
});

// L15 on a weapon: what its hits carry, at quality k (1 Common .. 1.6 Legendary). Only those who
// fight you feel it (fighters and the great beasts); a bystander's harm is never rewarded.
// status: laid on the foe's hex (magic/caster.js); harm: a share more; arc: a share of the hit
// leaps to the next foe within hop m; ward: points of ward on you a hit (up to wardMax);
// leech: a share of the harm mends you; haste: a share faster for t s; mana: a hit gives mana
const INFUSE = {
	radiance: { name: 'Dazzling', at: (k) => ({ status: { hold: 0.5 * k } }), desc: (e) => `Hits dazzle the foe, holding them for ${secs(e.status.hold)} s.` },
	shadow: { name: 'Dreadful', at: (k) => ({ status: { fear: 1.5 * k } }), desc: (e) => `Hits fill the foe with dread: they flee for ${secs(e.status.fear)} s.` },
	void: { name: 'Hollow', at: (k) => ({ harm: 0.15 * k }), desc: (e) => `Hits strike ${pc(e.harm)} harder, as if armour were not there.` },
	blight: { name: 'Festering', at: (k) => ({ status: { dot: Math.round(5 * k), t: 4 } }), desc: (e) => `Hits rot the foe: ${e.status.dot} harm a second for 4 s.` },
	storm: { name: 'Arcing', at: (k) => ({ arc: 0.35 * k, hop: 8 }), desc: (e) => `${pc(e.arc)} of each hit leaps as lightning to the nearest other foe.` },
	primal: { name: 'Searing', at: (k) => ({ status: { dot: Math.round(7 * k), t: 3 }, fire: true }), desc: (e) => `Hits set the foe smouldering: ${e.status.dot} harm a second for 3 s.` },
	warding: { name: 'Warding', at: (k) => ({ ward: Math.round(5 * k), wardMax: 40 }), desc: (e) => `Each hit lays ${e.ward} of ward on you, up to ${e.wardMax}.` },
	restoration: { name: 'Mending', at: (k) => ({ leech: 0.06 * k }), desc: (e) => `Each hit mends you by ${pc(e.leech)} of the harm it deals.` },
	dawn: { name: 'Fleet', at: (k) => ({ haste: 0.12 * k, t: 3 }), desc: (e) => `Each hit quickens your feet: ${pc(e.haste)} faster for 3 s.` },
	chrono: { name: 'Stilling', at: (k) => ({ status: { slow: 0.6, t: 2.5 * k } }), desc: (e) => `Hits slow the foe to 60% of their pace for ${secs(e.status.t)} s.` },
	umbral: { name: 'Hungering', at: (k) => ({ mana: Math.round(3 * k) }), desc: (e) => `Each hit draws ${e.mana} mana from the foe into you.` },
};
// a weapon's infusion at its tier: { school, name, desc, ...effects }
export function infusionOf(school, t = 0) {
	const I = INFUSE[school];
	if (!I) return null;
	const e = I.at(1 + 0.15 * t);
	return { school, name: I.name, ...e, desc: I.desc(e) };
}
// L20 on a weapon: the spell it looses by itself, cast along your aim at no cost
export const SPELLSHOT = Object.freeze({ radiance: 'solar-flare', shadow: 'night-terror', void: 'repulse', blight: 'plague-cloud', storm: 'chain-lightning', primal: 'cinder', warding: 'aegis', restoration: 'mend', dawn: 'swiftstride', chrono: 'stasis', umbral: 'shade' });

// an item's attributes (its 'pt' rows at its level and tier): [{ attr, n }]
export function attributesOf(inst) {
	if (!inst || !isMagical(inst.i)) return [];
	return statsOf(inst).filter((r) => r.unit === 'pt').map((r) => ({ attr: r.label.toLowerCase(), n: r.value }));
}

// the four awakenings of an instance, in words, each with whether it is awake: [{ level, name, desc, on }]
export function awakenings(inst) {
	const school = attunement(inst);
	if (!school) return [];
	const t = tierOf(inst), l = levelOf(inst), S = SCHOOLS[school].name, weapon = isWeaponId(inst.i);
	const A = ALTERATIONS[school], I = infusionOf(school, t), shot = SPELL[SPELLSHOT[school]];
	const rows = [
		`${S} spells are ${pc(attunedPower(t))} stronger.`,
		weapon ? `Spellstrike: each hit takes ${strikeCut(t)} s off your ${S} spells' cooldowns.` : `${S} spells cost ${pc(flowShare(t))} less mana and come back ${pc(flowShare(t))} sooner.`,
		weapon ? `${I.name}: ${I.desc[0].toLowerCase()}${I.desc.slice(1)}` : A.desc,
		weapon ? `Spellshot: every ${spellshotEvery(t)} hits, it looses ${shot.name} of its own.` : `Every ${['', '', '', 'third', 'fourth', 'fifth'][masteryEvery(t)]} ${S} spell costs nothing and starts no cooldown.`,
	];
	return AWAKEN.map((level, k) => ({ level, name: AWAKEN_NAMES[k], desc: rows[k], on: l >= level }));
}
// the next awakening still asleep (null: all awake)
export const nextAwakening = (inst) => awakenings(inst).find((a) => !a.on) || null;
// the awakening just reached in going from level a to level b (for the announcement)
export function awakenedBetween(inst, a, b) {
	return awakenings({ ...inst, l: b }).filter((x) => x.level > a && x.level <= b);
}

// What the gear you wear and hold adds up to. list: the worn garments and the weapon in hand
// (instances). Returns { attrs: { attr: n }, power, mana, cd: { school: share }, alter:
// { spellId: alteration }, free: { school: every }, weapon: null | { uid, school, strike,
// infuse, shot: { spell, every } }, lines: [what is awake, in words] }
export function gearMagic(list) {
	const out = { attrs: {}, power: {}, mana: {}, cd: {}, alter: {}, free: {}, weapon: null, lines: [] };
	for (const inst of list || []) {
		if (!inst || !isMagical(inst.i)) continue;
		for (const { attr, n } of attributesOf(inst)) out.attrs[attr] = (out.attrs[attr] || 0) + n;
		const school = attunement(inst), t = tierOf(inst), l = levelOf(inst), weapon = isWeaponId(inst.i);
		if (!school) continue;
		const name = ARMS_CATALOG[inst.i]?.name || inst.i;
		if (weapon) out.weapon = { uid: inst.u, school, strike: 0, infuse: null, shot: null };
		const rows = awakenings(inst);
		for (const a of rows) if (a.on) out.lines.push({ item: name, uid: inst.u, school, level: a.level, name: a.name, desc: a.desc });
		if (l >= AWAKEN[0]) out.power[school] = (out.power[school] || 0) + attunedPower(t);
		if (l >= AWAKEN[1]) {
			if (weapon) out.weapon.strike = strikeCut(t);
			else { out.mana[school] = (out.mana[school] || 0) + flowShare(t); out.cd[school] = (out.cd[school] || 0) + flowShare(t); }
		}
		if (l >= AWAKEN[2]) {
			if (weapon) out.weapon.infuse = infusionOf(school, t);
			else out.alter[ALTERATIONS[school].spell] = ALTERATIONS[school];
		}
		if (l >= AWAKEN[3]) {
			if (weapon) out.weapon.shot = { spell: SPELLSHOT[school], every: spellshotEvery(t) };
			// (two garments of one school: the more generous one counts)
			else out.free[school] = Math.min(out.free[school] || 99, masteryEvery(t));
		}
	}
	return out;
}
