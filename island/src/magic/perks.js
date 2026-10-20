// The perk tree's data and what it adds up to, apart from anyone's state: the perks, the ranks
// and the mastery levels, and the mods they sum to. Pure: no three, no DOM. magic/skills.js
// (your skills as game state) and magic/stats.js (the numbers your gear and attributes add)
// both build on it, so neither has to import the other's half.

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

// ---------- ranks ----------
export const RANK_MAX = 100;
// the use a rank takes (from 0): rises by a power, so the first ranks come quickly
export const useFor = (rank) => Math.ceil(5 * Math.pow(Math.max(0, rank), 1.5));
export const rankOf = (use) => Math.min(RANK_MAX, Math.floor(Math.pow(Math.max(0, use) / 5, 1 / 1.5) + 1e-9));

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

// ---------- spell mastery: the levels and what they open (magic/skills.js has the rest) ----------
export const MASTERY = Object.freeze([0, 100, 300, 700, 1500]);
export const MASTERY_POWER = 0.08;
export const NUMERAL = Object.freeze(['I', 'II', 'III', 'IV', 'V']);
export const MASTERY_GIFT = Object.freeze({
	'solar-flare': { 3: { moonlit: true, name: 'Moonfall', text: 'It works at night, drawing its blast down from the moon.' } },
});
export const masteryLevel = (pts) => MASTERY.filter((p) => pts >= p).length;

// each spell's mastery folded into mods m (its own power), and what its levels open into s
// (s.moonlit). magic/stats.js's composeMods calls it, so the gear's numbers keep it.
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
