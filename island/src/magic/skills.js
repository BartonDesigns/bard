// Skills as game rules: your level, the skill points it gives, a rank in every skill that rises
// with use, and the perks bought with points. Pure: no three, no DOM (island/tools/skills.test.mjs).
//
// Every skill has its own page, laid out as a constellation (magic/skills-ui.js draws it): the
// eleven schools of magic, whose spells are woven with aether fabric (magic/spells.js), and three
// of the body. On each page the perks hang off the spells (or off one another), and a perk takes
// three things: a skill point, the node it hangs from, and a rank in its skill.
//
//   Experience comes from everything you do: the mana you spend casting, the fabric you weave
//   and gather, the harm your weapons deal, the harm you take, the ground you cover on foot,
//   and mercy and its opposite. Each level gives a skill point.
//   A skill's rank (0 to 100) rises with its own use: a school with the mana spent on its
//   spells, Marksman with the harm your weapons deal, Athletics with the ground you cover,
//   Resilience with the harm you take and live through.
//
// A perk's effects (fx) are a stat, a share or an amount, and a scope: a school, a strand
// (light, dark, twilight) or all. The perks you hold are summed into state.mods (refreshMods),
// which the spells' rules (spells.js) and the caster read.

import { SCHOOLS, SPELLS, SPELL, weaveBlock, weaveCost } from './spells.js';
import { composeMods } from './stats.js';

// the skills of the body: no spells, perks only
export const BODY = Object.freeze({
	marksman: { name: 'Marksman', strand: 'body', color: '#ff8f6b', line: 'The bow, the rifle and the steady hand: harder hits where they count.' },
	athletics: { name: 'Athletics', strand: 'body', color: '#7ff0e0', line: 'Feet that carry you further: pace, spring and the art of landing.' },
	resilience: { name: 'Resilience', strand: 'body', color: '#d8c49a', line: 'What does not fell you hardens you: less harm, and wounds that close.' },
});
export const SKILL = Object.freeze({ ...SCHOOLS, ...BODY });
// the pages, in order: light, dark, twilight, then the body
export const PAGES = Object.freeze([...Object.keys(SCHOOLS), ...Object.keys(BODY)]);
export const STRAND_NAME = Object.freeze({ light: 'Light aether', dark: 'Dark aether', twilight: 'Twilight', body: 'Body' });

// The constellations: where each spell sits on its page (x, y in a 100 x 100 box, y down: the
// first tier at the foot, the highest at the top), and a faint figure drawn behind (an SVG path
// in the same box) that gives the page its shape.
export const LAYOUT = Object.freeze({
	radiance: { fig: 'M50 98 L50 4 M50 4 L42 16 M50 4 L58 16 M14 40 L50 52 L86 40 M20 72 L50 62 L80 72', spells: { sunspark: [50, 84], 'lance-of-dawn': [50, 60], 'solar-flare': [50, 37], judgement: [50, 13] } },
	restoration: { fig: 'M50 96 C36 80 24 62 30 42 C34 28 44 22 50 10 C56 22 66 28 70 42 C76 62 64 80 50 96 M30 42 C18 36 12 26 14 14 M70 42 C82 36 88 26 86 14', spells: { mend: [50, 84], renewal: [50, 61], sanctuary: [50, 38], resurgence: [50, 14] } },
	warding: { fig: 'M50 6 L86 18 C86 56 72 80 50 96 C28 80 14 56 14 18 Z M50 6 L50 96', spells: { aegis: [50, 82], 'radiant-aura': [50, 60], bulwark: [50, 38], banish: [50, 16] } },
	dawn: { fig: 'M6 92 L94 92 M14 92 A36 36 0 0 1 86 92 M50 56 L50 6 M24 66 L8 46 M76 66 L92 46', spells: { lumen: [30, 84], dawnsight: [70, 84], swiftstride: [30, 60], waterstride: [70, 60], daybreak: [50, 37], 'sunwell-gate': [50, 12] } },
	shadow: { fig: 'M62 6 A46 46 0 1 0 62 94 A34 34 0 1 1 62 6', spells: { shadowbolt: [62, 88], shadowstep: [34, 72], 'umbral-cloak': [56, 62], 'night-terror': [26, 42], eclipse: [56, 14] } },
	// (gargantua: the Void's ultimate, crowning the spiral; it shows once the spell is in the book)
	void: { fig: 'M50 52 C56 44 66 46 66 56 C66 70 46 74 38 64 C26 50 36 30 54 28 C76 26 88 46 82 66 C76 86 50 94 30 86', spells: { 'void-shard': [50, 52], repulse: [66, 70], 'gravity-well': [30, 66], 'event-horizon': [30, 22], gargantua: [46, 8] } },
	blight: { fig: 'M50 96 L50 8 M50 70 L22 46 L12 24 M50 70 L78 46 L88 24 M50 40 L36 26 M50 40 L64 26', spells: { 'hex-of-decay': [50, 86], withering: [50, 64], 'plague-cloud': [28, 44], 'soul-siphon': [72, 44], contagion: [50, 14] } },
	umbral: { fig: 'M50 96 C30 90 22 70 24 50 C26 34 36 26 50 24 C64 26 74 34 76 50 C78 70 70 90 50 96 M30 34 C20 24 18 12 24 4 M70 34 C80 24 82 12 76 4 M36 56 L46 58 M64 56 L54 58', spells: { nightsight: [50, 84], shade: [50, 62], 'grave-host': [50, 40], 'dark-pact': [50, 16] } },
	storm: { fig: 'M74 2 L64 14 L36 38 L54 44 L64 62 L42 70 L30 86 L22 98', spells: { thunderclap: [30, 86], 'chain-lightning': [64, 62], 'ball-lightning': [34, 40], tempest: [64, 14] } },
	chrono: { fig: 'M18 8 L82 8 L54 50 L82 92 L18 92 L46 50 Z', spells: { 'mark-and-recall': [50, 84], quicken: [50, 62], stasis: [50, 38], rewind: [50, 14] } },
	primal: { fig: 'M50 96 C26 86 18 64 30 44 C36 34 34 22 30 10 C46 18 52 30 50 42 C58 34 62 24 62 14 C78 30 84 52 74 72 C68 86 60 92 50 96', spells: { cinder: [50, 84], 'frost-nova': [30, 54], 'call-rain': [70, 54] } },
	marksman: { fig: 'M20 92 C8 60 8 40 20 8 M20 8 L20 92 M20 50 L94 50 M94 50 L84 42 M94 50 L84 58', spells: {} },
	athletics: { fig: 'M20 92 C30 72 44 66 50 50 C56 34 70 28 80 8 M50 50 C38 44 24 46 10 40 M50 50 C62 56 76 54 90 60', spells: {} },
	resilience: { fig: 'M10 94 L50 6 L90 94 Z M30 50 L70 50 M22 72 L78 72', spells: {} },
});

// The perks. at: where it sits; parent: the node (spell or perk) it hangs from, or a list (any
// one of them), or null (a root); rank: the rank in its skill it needs.
const K = (id, page, name, glyph, rank, parent, at, desc, fx) => ({ id, page, name, glyph, rank, parent, at, desc, fx });
export const PERKS = Object.freeze([
	// ---------- Radiance ----------
	K('searing-light', 'radiance', 'Searing Light', '✶', 0, 'sunspark', [26, 74], 'Your Radiance spells burn 15% hotter.', [['power', 0.15]]),
	K('focused-lens', 'radiance', 'Focused Lens', '◇', 20, 'lance-of-dawn', [76, 52], 'Radiance spells reach 30% further and cost 15% less mana.', [['range', 0.3], ['mana', 0.15]]),
	K('blinding-glare', 'radiance', 'Blinding Glare', '✺', 40, 'solar-flare', [24, 28], 'Those your light holds stay held half again as long, and its bursts are a quarter wider.', [['status', 0.5], ['area', 0.25]]),
	K('zenith', 'radiance', 'Zenith', '☀', 70, 'judgement', [76, 8], 'Radiance spells strike 25% harder and come back 25% sooner.', [['power', 0.25], ['cd', 0.25]]),
	// ---------- Restoration ----------
	K('gentle-hands', 'restoration', 'Gentle Hands', '❦', 0, 'mend', [24, 74], 'Your Restoration spells heal 20% more.', [['power', 0.2]]),
	K('lasting-light', 'restoration', 'Lasting Light', '✿', 20, 'renewal', [76, 54], 'Restoration spells last 40% longer.', [['dur', 0.4]]),
	K('wellspring', 'restoration', 'Wellspring', '❂', 35, 'sanctuary', [22, 30], 'Your mana pool grows by 25, and mana comes back 1.5 a second faster.', [['manaMax', 25, 'all'], ['regen', 1.5, 'all']]),
	K('second-dawn', 'restoration', 'Second Dawn', '✧', 60, 'resurgence', [78, 8], 'Restoration spells cost a quarter less mana and come back a quarter sooner.', [['mana', 0.25], ['cd', 0.25]]),
	// ---------- Warding ----------
	K('tempered-ward', 'warding', 'Tempered Ward', '⬡', 0, 'aegis', [24, 74], 'Your wards take 30% more, and your aura burns 30% hotter.', [['power', 0.3]]),
	K('steadfast', 'warding', 'Steadfast', '▲', 15, 'aegis', [78, 74], 'You take 8% less harm from everything.', [['armor', 0.08, 'all']]),
	K('wide-ward', 'warding', 'Wide Ward', '◯', 30, 'radiant-aura', [76, 46], 'Warding spells reach 35% further round you.', [['area', 0.35]]),
	K('unbroken', 'warding', 'Unbroken', '▣', 50, 'bulwark', [24, 30], 'Warding spells last 40% longer and come back 20% sooner.', [['dur', 0.4], ['cd', 0.2]]),
	K('exile', 'warding', 'Exile', '✸', 70, 'banish', [76, 8], 'Those you banish flee 60% longer, and the blow is 20% harder.', [['status', 0.6], ['power', 0.2]]),
	// ---------- Dawn ----------
	K('aether-sense', 'dawn', 'Aether Sense', '◈', 0, 'dawnsight', [90, 70], 'You gather a quarter more light fabric from every mote and well.', [['fabric', 0.25, 'light']]),
	K('fleet-light', 'dawn', 'Fleet Light', '»', 15, 'swiftstride', [10, 48], 'Dawn spells last half again as long.', [['dur', 0.5]]),
	K('early-riser', 'dawn', 'Early Riser', '☼', 30, 'daybreak', [78, 28], 'Dawn spells cost 30% less mana and come back 30% sooner.', [['mana', 0.3], ['cd', 0.3]]),
	K('sunwalker', 'dawn', 'Sunwalker', '⊙', 50, 'sunwell-gate', [24, 6], 'Every light spell is 10% stronger.', [['power', 0.1, 'light']]),
	// ---------- Shadow ----------
	K('nightblade', 'shadow', 'Nightblade', '☾', 0, 'shadowbolt', [84, 80], 'Your Shadow spells strike 15% harder.', [['power', 0.15]]),
	K('long-shadow', 'shadow', 'Long Shadow', '⤳', 20, 'shadowstep', [12, 84], 'Shadow spells reach 40% further.', [['range', 0.4]]),
	K('deep-cloak', 'shadow', 'Deep Cloak', '◐', 35, 'umbral-cloak', [80, 48], 'Shadow spells last half again as long and come back 20% sooner.', [['dur', 0.5], ['cd', 0.2]]),
	K('dread', 'shadow', 'Dread', '☠', 50, 'night-terror', [12, 22], 'Those you frighten or hold stay so half again as long.', [['status', 0.5]]),
	K('total-eclipse', 'shadow', 'Total Eclipse', '●', 70, 'eclipse', [82, 10], 'Shadow spells strike 25% harder, over a quarter more ground.', [['power', 0.25], ['area', 0.25]]),
	// ---------- Void ----------
	K('null-edge', 'void', 'Null Edge', '◆', 0, 'void-shard', [64, 36], 'Your Void spells strike 15% harder.', [['power', 0.15]]),
	K('force-of-nothing', 'void', 'Force of Nothing', '⇶', 20, 'repulse', [86, 84], 'Void spells reach 35% further.', [['range', 0.35], ['area', 0.2]]),
	K('deep-void', 'void', 'Deep Void', '◉', 40, 'gravity-well', [10, 86], 'Void spells last 40% longer, and what they hold stays held 40% longer.', [['dur', 0.4], ['status', 0.4]]),
	K('horizon-heart', 'void', 'Horizon Heart', '⊚', 65, 'event-horizon', [64, 10], 'Void spells cost a quarter less mana and strike 20% harder.', [['mana', 0.25], ['power', 0.2]]),
	// ---------- Blight ----------
	K('festering', 'blight', 'Festering', '✣', 0, 'hex-of-decay', [24, 80], 'Your Blight spells eat 15% deeper.', [['power', 0.15]]),
	K('lingering-rot', 'blight', 'Lingering Rot', '≀', 20, 'withering', [78, 74], 'Rot and slows last half again as long.', [['status', 0.5], ['dur', 0.3]]),
	K('miasma', 'blight', 'Miasma', '☁', 35, 'plague-cloud', [10, 22], 'Blight spells spread over 40% more ground.', [['area', 0.4]]),
	K('hunger', 'blight', 'Hunger', '⥈', 50, 'soul-siphon', [90, 22], 'Blight spells cost a quarter less mana, and all your mana comes back faster.', [['mana', 0.25], ['regen', 1, 'all']]),
	K('pandemic', 'blight', 'Pandemic', '☣', 70, 'contagion', [74, 6], 'Blight spells strike 25% harder and their rot lasts a quarter longer.', [['power', 0.25], ['status', 0.25]]),
	// ---------- Umbral ----------
	K('dark-eyes', 'umbral', 'Dark Eyes', '◑', 0, 'nightsight', [24, 80], 'You gather a quarter more dark fabric from every mote and well.', [['fabric', 0.25, 'dark']]),
	K('binding', 'umbral', 'Binding', '✧', 20, 'shade', [78, 58], 'Your shades last half again as long and strike a quarter harder.', [['dur', 0.5], ['power', 0.25]]),
	K('legion', 'umbral', 'Legion', '⁂', 45, 'grave-host', [22, 22], 'Umbral spells come back 30% sooner.', [['cd', 0.3]]),
	K('covenant', 'umbral', 'Covenant', '⛧', 70, 'dark-pact', [78, 8], 'Every dark spell is 10% stronger, and your mana pool grows by 30.', [['power', 0.1, 'dark'], ['manaMax', 30, 'all']]),
	// ---------- Storm ----------
	K('static', 'storm', 'Static', '⚡', 0, 'thunderclap', [62, 92], 'Your Storm spells strike 15% harder.', [['power', 0.15]]),
	K('arc-reach', 'storm', 'Arc Reach', 'ϟ', 20, 'chain-lightning', [88, 44], 'Storm spells reach 40% further.', [['range', 0.4]]),
	K('stormcaller', 'storm', 'Stormcaller', '❂', 40, 'ball-lightning', [12, 24], 'Storm spells last 40% longer, over a quarter more ground.', [['dur', 0.4], ['area', 0.25]]),
	K('eye-of-the-storm', 'storm', 'Eye of the Storm', '⛈', 70, 'tempest', [36, 6], 'Storm spells cost a quarter less, come back a quarter sooner and strike 10% harder.', [['mana', 0.25], ['cd', 0.25], ['power', 0.1]]),
	// ---------- Chrono ----------
	K('borrowed-time', 'chrono', 'Borrowed Time', '⚑', 0, 'mark-and-recall', [24, 88], 'Chrono spells cost 20% less mana.', [['mana', 0.2]]),
	K('haste', 'chrono', 'Haste', '⌁', 20, 'quicken', [76, 88], 'Chrono spells last 40% longer, and you run 5% faster at all times.', [['dur', 0.4], ['speed', 0.05, 'all']]),
	K('still-water', 'chrono', 'Still Water', '⌛', 40, 'stasis', [24, 12], 'Those you freeze in time stay frozen half again as long.', [['dur', 0.5], ['status', 0.5]]),
	K('eternity', 'chrono', 'Eternity', '↺', 70, 'rewind', [76, 12], 'Chrono spells come back 35% sooner.', [['cd', 0.35]]),
	// ---------- Primal ----------
	K('kindling', 'primal', 'Kindling', '♨', 0, 'cinder', [76, 84], 'Your Primal spells strike 15% harder, over a fifth more ground.', [['power', 0.15], ['area', 0.2]]),
	K('deep-frost', 'primal', 'Deep Frost', '❄', 25, 'frost-nova', [22, 28], 'Those you freeze stay frozen half again as long, over a quarter more ground.', [['status', 0.5], ['area', 0.25]]),
	K('monsoon', 'primal', 'Monsoon', '☂', 25, 'call-rain', [78, 28], 'Primal spells come back 30% sooner and their rain falls half as wide again.', [['cd', 0.3], ['area', 0.5]]),
	K('elemental-heart', 'primal', 'Elemental Heart', '✹', 55, ['deep-frost', 'monsoon'], [50, 10], 'Primal spells strike 20% harder and cost 20% less mana.', [['power', 0.2], ['mana', 0.2]]),
	// ---------- Marksman ----------
	K('steady-aim', 'marksman', 'Steady Aim', '⊕', 0, null, [40, 84], 'Your weapons strike 10% harder.', [['weapon', 0.1, 'all']]),
	K('battle-mage', 'marksman', 'Battle Mage', '✦', 15, 'steady-aim', [78, 82], 'Every hit with a weapon gives you 2 mana.', [['manaOnHit', 2, 'all']]),
	K('trained-eye', 'marksman', 'Trained Eye', '◎', 15, 'steady-aim', [26, 62], 'Your weapons strike another 10% harder.', [['weapon', 0.1, 'all']]),
	K('deadeye', 'marksman', 'Deadeye', '⌖', 30, 'trained-eye', [44, 40], 'Hits to the head or a weak point strike 30% harder.', [['weak', 0.3, 'all']]),
	K('giant-slayer', 'marksman', 'Giant Slayer', '♜', 45, 'trained-eye', [70, 30], 'Your weapons strike a quarter harder against the great beasts and machines.', [['boss', 0.25, 'all']]),
	K('master-marksman', 'marksman', 'Master Marksman', '✪', 70, ['deadeye', 'giant-slayer'], [62, 10], 'Your weapons strike 15% harder.', [['weapon', 0.15, 'all']]),
	// ---------- Athletics ----------
	K('light-step', 'athletics', 'Light Step', '◌', 0, null, [26, 86], 'You run 5% faster.', [['speed', 0.05, 'all']]),
	K('springheel', 'athletics', 'Springheel', '⤒', 15, 'light-step', [36, 64], 'You jump 15% higher.', [['jump', 0.15, 'all']]),
	K('long-stride', 'athletics', 'Long Stride', '»', 15, 'light-step', [14, 44], 'You run another 7% faster.', [['speed', 0.07, 'all']]),
	K('cat-fall', 'athletics', 'Cat Fall', '⤓', 30, 'springheel', [64, 52], 'You fall 30% more gently.', [['fall', 0.3, 'all']]),
	K('trailblazer', 'athletics', 'Trailblazer', '⟿', 40, 'cat-fall', [88, 62], 'Everything you do teaches you 10% more.', [['xp', 0.1, 'all']]),
	K('windrunner', 'athletics', 'Windrunner', '❖', 65, ['cat-fall', 'long-stride'], [72, 14], 'You run 10% faster and jump 15% higher.', [['speed', 0.1, 'all'], ['jump', 0.15, 'all']]),
	// ---------- Resilience ----------
	K('hardy', 'resilience', 'Hardy', '⛊', 0, null, [50, 86], 'You take 5% less harm.', [['armor', 0.05, 'all']]),
	K('thick-skin', 'resilience', 'Thick Skin', '◼', 15, 'hardy', [30, 70], 'You take another 7% less harm.', [['armor', 0.07, 'all']]),
	K('recovery', 'resilience', 'Recovery', '✚', 15, 'hardy', [70, 70], 'Out of a fight your wounds close: half a point of life a second.', [['hpRegen', 0.5, 'all']]),
	K('iron-will', 'resilience', 'Iron Will', '⬢', 35, 'thick-skin', [38, 50], 'You take another 8% less harm, and your mana pool grows by 15.', [['armor', 0.08, 'all'], ['manaMax', 15, 'all']]),
	K('vigor', 'resilience', 'Vigor', '❤', 35, 'recovery', [62, 50], 'Your wounds close faster: another point of life a second out of a fight.', [['hpRegen', 1, 'all']]),
	K('unyielding', 'resilience', 'Unyielding', '⛰', 65, ['iron-will', 'vigor'], [50, 16], 'You take another 10% less harm, and your wounds close faster still.', [['armor', 0.1, 'all'], ['hpRegen', 0.5, 'all']]),
]);
export const PERK = Object.freeze(Object.fromEntries(PERKS.map((p) => [p.id, p])));

// every node of a page (spells, then perks): { id, kind: 'spell' | 'perk', at, parents, item }
export function pageNodes(page) {
	const L = LAYOUT[page] || { spells: {} };
	const spells = SPELLS.filter((s) => s.school === page).sort((a, b) => a.tier - b.tier);
	const out = spells.map((s) => ({ id: s.id, kind: 'spell', at: L.spells[s.id] || [50, 50], parents: s.tier > 1 ? spells.filter((q) => q.tier === s.tier - 1).map((q) => q.id) : [], item: s }));
	for (const p of PERKS.filter((q) => q.page === page)) out.push({ id: p.id, kind: 'perk', at: p.at, parents: p.parent == null ? [] : [].concat(p.parent), item: p });
	return out;
}
// the lines of a page: [from, to] node ids
export function pageLinks(page) {
	const out = [];
	for (const n of pageNodes(page)) for (const p of n.parents) out.push([p, n.id]);
	return out;
}

// ---------- ranks and levels ----------
export const RANK_MAX = 100;
// the use a rank takes (from 0): rises by a power, so the first ranks come quickly
export const useFor = (rank) => Math.ceil(5 * Math.pow(Math.max(0, rank), 1.5));
export const rankOf = (use) => Math.min(RANK_MAX, Math.floor(Math.pow(Math.max(0, use) / 5, 1 / 1.5) + 1e-9));
// An ultimate (a tier 5 spell) is for a master of its school: on top of the ladder below it, it
// takes the school's highest rank.
export const ULTIMATE_RANK = RANK_MAX;
export const isUltimate = (spell) => (spell?.tier || 0) >= 5;
// what stands between you and weaving a spell (null: nothing): the spell's own rules, and an
// ultimate's rank, told after the ladder and before the fabric
export function spellBlock(s, spell) {
	const why = weaveBlock(s, spell);
	if (!isUltimate(spell) || s.known.includes(spell.id) || /first\.$/.test(why || '')) return why;
	const r = rankOf(s.use?.[spell.school] || 0);
	return r < ULTIMATE_RANK ? `It needs ${SKILL[spell.school].name} rank ${ULTIMATE_RANK} (yours is ${r}).` : why;
}
// the share of the way to the next rank (0 .. 1)
export function rankFrac(use) {
	const r = rankOf(use);
	if (r >= RANK_MAX) return 1;
	const a = useFor(r), b = useFor(r + 1);
	return Math.max(0, Math.min(1, (use - a) / Math.max(1, b - a)));
}
// experience from one level to the next
export const xpNeed = (level) => 100 + 35 * (Math.max(1, level) - 1);
export const START_POINTS = 1;
// the points you hold (a level's each, and the one you start with, less those spent)
export const pointsOf = (s) => Math.max(0, START_POINTS + (s.level || 1) - 1 - (s.perks?.length || 0));

// the skills' part of your magic, made whole (from what was kept, or new)
export function sanitizeSkills(s) {
	s.xp = Math.max(0, Math.floor(+s.xp || 0));
	s.level = Math.max(1, Math.min(999, Math.floor(+s.level || 1)));
	const seen = new Set();
	s.perks = (Array.isArray(s.perks) ? s.perks : []).filter((id) => PERK[id] && !seen.has(id) && seen.add(id));
	// (a perk can only stand on what it hangs from, and only so many as the points allow)
	s.perks = s.perks.filter((id) => parentsHeld(s, PERK[id], s.perks));
	while (s.perks.length > START_POINTS + s.level - 1) s.perks.pop();
	const use = {};
	for (const k of PAGES) use[k] = Math.max(0, Math.floor(+s.use?.[k] || 0));
	s.use = use;
	const mastery = {};
	for (const id of s.known || []) if (SPELL[id]) mastery[id] = Math.max(0, Math.floor(+s.mastery?.[id] || 0));
	s.mastery = mastery;
	refreshMods(s);
	return s;
}
function parentsHeld(s, p, held = s.perks) {
	if (p.parent == null) return true;
	return [].concat(p.parent).some((id) => (SPELL[id] ? s.known?.includes(id) : held.includes(id)));
}
// does the player hold this node (a spell known, a perk taken)
export const holds = (s, id) => (SPELL[id] ? !!s.known?.includes(id) : !!s.perks?.includes(id));

// experience gained: n, raised by perks. Returns the levels gained.
export function addXp(s, n) {
	if (!(n > 0)) return 0;
	s.xp += n * (1 + (s.mods?.xp || 0));
	let up = 0;
	while (s.xp >= xpNeed(s.level) && s.level < 999) { s.xp -= xpNeed(s.level); s.level++; up++; }
	s.xp = Math.round(s.xp * 100) / 100;
	return up;
}
// use of a skill: n. Returns the ranks gained (and gives as much experience).
export function addUse(s, page, n) {
	if (!(n > 0) || !(page in s.use)) return { ranks: 0, levels: 0 };
	const r0 = rankOf(s.use[page]);
	s.use[page] += n;
	return { ranks: rankOf(s.use[page]) - r0, levels: addXp(s, n) };
}

// why a perk cannot be taken now (null: it can)
export function perkBlock(s, id) {
	const p = PERK[id];
	if (!p) return 'There is no such perk.';
	if (s.perks.includes(id)) return 'You have it already.';
	if (!parentsHeld(s, p)) {
		const names = [].concat(p.parent).map((q) => SPELL[q]?.name || PERK[q]?.name || q);
		return `It hangs from ${names.join(' or ')}: ${SPELL[[].concat(p.parent)[0]] ? 'weave' : 'take'} that first.`;
	}
	const r = rankOf(s.use[p.page] || 0);
	if (r < p.rank) return `It needs ${SKILL[p.page].name} rank ${p.rank} (yours is ${r}).`;
	if (pointsOf(s) < 1) return 'It takes a skill point: you earn one each level.';
	return null;
}
export function takePerk(s, id) {
	if (perkBlock(s, id)) return false;
	s.perks.push(id);
	refreshMods(s);
	return true;
}

// ---------- what the perks add up to ----------
// state.mods: { power, mana, cd, dur, area, range, status: { scope: share }, fabric: { light, dark },
// manaMax, regen, speed, jump, fall, armor, hpRegen, weapon, weak, boss, manaOnHit, xp }
const SCOPED = ['power', 'mana', 'cd', 'dur', 'area', 'range', 'status', 'fabric'];
export function computeMods(perks) {
	const m = { manaMax: 0, regen: 0, speed: 0, jump: 0, fall: 0, armor: 0, hpRegen: 0, weapon: 0, weak: 0, boss: 0, manaOnHit: 0, xp: 0 };
	for (const k of SCOPED) m[k] = {};
	for (const id of perks) {
		const p = PERK[id];
		if (!p) continue;
		for (const [stat, v, scope] of p.fx) {
			if (SCOPED.includes(stat)) { const sc = scope || p.page; m[stat][sc] = (m[stat][sc] || 0) + v; } else m[stat] = (m[stat] || 0) + v;
		}
	}
	// (bounds: nothing free, nothing untouchable)
	m.armor = Math.min(0.5, m.armor);
	m.fall = Math.min(0.6, m.fall);
	return m;
}
// (the perks, the attributes, the gear's magic and each spell's mastery: magic/stats.js)
export function refreshMods(s) {
	s.mods = composeMods(s);
	return s.mods;
}
// each spell's mastery folded into mods m (its own power), and what its levels open into s
// (s.moonlit). magic/stats.js's composeMods calls it too, so the gear's numbers keep it.
export function applyMastery(s, m) {
	const lit = new Set(Array.isArray(s.moonlit) ? s.moonlit : []);
	for (const [id, pts] of Object.entries(s.mastery || {})) {
		const L = masteryLevel(pts);
		if (L > 1) m.power[id] = (m.power[id] || 0) + (L - 1) * MASTERY_POWER;
		for (const [at, g] of Object.entries(MASTERY_GIFT[id] || {})) if (L >= +at && g.moonlit) lit.add(id);
	}
	s.moonlit = [...lit];
	return m;
}

// ---------- spell mastery ----------
// Each spell you know grows with you: casting it adds the mana you paid, and you can pour aether
// into it (its own strand; a twilight spell takes half of each). Its levels (I .. V) make it
// stronger, and on some spells open more: Solar Flare, a blast of the sun's own light, learns at
// III to draw on the moon by night (s.moonlit: the ids of the spells that may; the caster reads it).
export const MASTERY = Object.freeze([0, 100, 300, 700, 1500]);
export const MASTERY_POWER = 0.08;
export const NUMERAL = Object.freeze(['I', 'II', 'III', 'IV', 'V']);
export const MASTERY_GIFT = Object.freeze({
	'solar-flare': { 3: { moonlit: true, name: 'Moonfall', text: 'It works at night, drawing its blast down from the moon.' } },
});
export const masteryLevel = (pts) => MASTERY.filter((p) => pts >= p).length;
// the share of the way to the next level (1 at the last)
export function masteryFrac(pts) {
	const L = masteryLevel(pts);
	if (L >= MASTERY.length) return 1;
	return (pts - MASTERY[L - 1]) / (MASTERY[L] - MASTERY[L - 1]);
}
// points to the next level (0 at the last)
export const masteryToNext = (pts) => (masteryLevel(pts) >= MASTERY.length ? 0 : MASTERY[masteryLevel(pts)] - pts);
// mastery gained on a spell you know: n points. Returns the levels gained.
export function addMastery(s, id, n) {
	if (!(n > 0) || !SPELL[id] || !s.known?.includes(id)) return 0;
	const L0 = masteryLevel(s.mastery[id] || 0);
	s.mastery[id] = Math.min(MASTERY[MASTERY.length - 1], (s.mastery[id] || 0) + n);
	const up = masteryLevel(s.mastery[id]) - L0;
	if (up) refreshMods(s);
	return up;
}
// the aether a point of mastery takes from you: { light, dark } for n points
export function feedCost(spell, n) {
	const c = weaveCost({ ...spell, tier: 1 });
	if (c.light && c.dark) return { light: Math.ceil(n / 2), dark: Math.ceil(n / 2) };
	return { light: c.light ? n : 0, dark: c.dark ? n : 0 };
}
// how much aether you could pour in now, up to n (and not past the last level)
export function feedable(s, id, n) {
	const spell = SPELL[id];
	if (!spell || !s.known?.includes(id)) return 0;
	n = Math.min(n, MASTERY[MASTERY.length - 1] - (s.mastery[id] || 0));
	const c = feedCost(spell, 1), both = c.light && c.dark;
	const have = both ? Math.min(s.fabric.light, s.fabric.dark) * 2 : c.light ? s.fabric.light : s.fabric.dark;
	const k = Math.max(0, Math.min(n, Math.floor(have)));
	return both ? k - (k % 2) : k;
}
// pour aether into a spell: up to n points. Returns { fed, levels }.
export function feedSpell(s, id, n) {
	const k = feedable(s, id, n);
	if (!k) return { fed: 0, levels: 0 };
	const c = feedCost(SPELL[id], k);
	s.fabric.light -= c.light; s.fabric.dark -= c.dark;
	return { fed: k, levels: addMastery(s, id, k) };
}

// a perk's effects in words, one line each, for the page
const WORD = { power: ['+', 'power'], mana: ['−', 'mana cost'], cd: ['−', 'cooldowns'], dur: ['+', 'duration'], area: ['+', 'area'], range: ['+', 'reach'], status: ['+', 'hold, fear and rot time'] };
export function fxLines(p) {
	return p.fx.map(([stat, v, scope]) => {
		const sc = scope || p.page, pc = `${Math.round(v * 100)}%`;
		const who = sc === 'all' ? 'all spells' : SKILL[sc] ? `${SKILL[sc].name} spells` : `${sc} spells`;
		switch (stat) {
			case 'manaMax': return `+${v} mana pool`;
			case 'regen': return `+${v} mana a second`;
			case 'speed': return `+${pc} running pace`;
			case 'jump': return `+${pc} jump height`;
			case 'fall': return `${pc} gentler falls`;
			case 'armor': return `${pc} less harm taken`;
			case 'hpRegen': return `+${v} life a second out of a fight`;
			case 'weapon': return `+${pc} weapon harm`;
			case 'weak': return `+${pc} on head and weak-point hits`;
			case 'boss': return `+${pc} against great beasts and machines`;
			case 'manaOnHit': return `+${v} mana for every weapon hit`;
			case 'xp': return `+${pc} experience`;
			case 'fabric': return `+${pc} ${sc} fabric gathered`;
			default: return WORD[stat] ? `${WORD[stat][0]}${pc} ${WORD[stat][1]}, ${who}` : `${stat} ${pc}`;
		}
	});
}
