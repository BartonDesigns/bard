// The spells as game rules: the schools, every spell's numbers, and what learning and casting
// one takes. Pure: no three, no DOM (island/tools/magic.test.mjs checks it all).
//
// Magic is woven from the aether, which runs through the world in two strands. Light aether
// gathers where the sun falls (high open ground, still water, by day); dark aether where it
// does not (caves, deep woods, the night). Each strand is gathered as fabric (world: the motes
// and wells, magic/aether.js), and a spell is learned by weaving its fabric into you: light
// spells from light fabric, dark from dark, twilight spells from both.
//
// What you weave is who you become. Every thread of fabric woven into a spell is affinity with
// its strand: the more of a strand you carry, the stronger its spells and the cheaper they are
// to cast, and only one who carries both strands deeply can weave the twilight spells. Light
// spells burn brighter by day, dark spells at night, twilight spells at dusk and dawn.
//
// A school is a ladder of four tiers: each spell past the first needs one of the tier below
// it in the same school. Casting costs mana, which comes back on its own; each spell has its
// own cooldown.

export const STRANDS = Object.freeze({ light: 'Light Aether', dark: 'Dark Aether' });

// the schools: their strand (light, dark, or twilight: both), colour (display, #rrggbb) and a line
export const SCHOOLS = Object.freeze({
	radiance: { name: 'Radiance', strand: 'light', color: '#ffd27a', line: 'Daylight made into a weapon: sparks, lances and judgement from the sky.' },
	restoration: { name: 'Restoration', strand: 'light', color: '#8ef0b0', line: 'Mending: wounds closed, life renewed, death turned aside.' },
	warding: { name: 'Warding', strand: 'light', color: '#9fd8ff', line: 'Shields and holy ground that keep harm away.' },
	dawn: { name: 'Dawn', strand: 'light', color: '#ffe9b0', line: 'The light that shows the way: lamps, swift feet, far sight and the wells.' },
	shadow: { name: 'Shadow', strand: 'dark', color: '#9a7cff', line: 'Night given an edge: bolts, cloaks, steps through the dark and terror.' },
	void: { name: 'Void', strand: 'dark', color: '#6a5cff', line: 'The pull of nothing: shards, force and wells that swallow.' },
	blight: { name: 'Blight', strand: 'dark', color: '#a8d84a', line: 'Rot and hunger: curses, plague and the siphoning of life.' },
	umbral: { name: 'Umbral', strand: 'dark', color: '#c08aff', line: 'Pacts with what lives in the dark: shades that serve, sight in the night.' },
	storm: { name: 'Storm', strand: 'twilight', color: '#7fd8ff', line: 'Where the two strands cross, the sky answers: lightning and thunder.' },
	chrono: { name: 'Chrono', strand: 'twilight', color: '#e8d6ff', line: 'The weave of time itself: quickened, stopped, unwound.' },
	primal: { name: 'Primal', strand: 'twilight', color: '#ff9a5a', line: 'The old elements: fire, frost and rain, for the fight and for the world.' },
});

// what one tier of spell takes to weave, in fabric of its strand (a twilight spell: this much
// of each strand times TWILIGHT_SHARE), and the affinity a twilight spell needs in both strands
export const WEAVE_COST = Object.freeze([10, 30, 80, 200]);
export const TWILIGHT_SHARE = 0.6;
export const TWILIGHT_NEEDS = Object.freeze([20, 60, 150, 320]);

// The spells. kind says what the runtime does (magic/caster.js); the rest are its numbers:
// mana, cd (seconds), and per kind: dmg (per hit), dps, r (radius, m), range (m), speed (m/s),
// t (seconds), and a status laid on what is struck: hold (seconds unable to move or fight),
// slow (share of pace kept, for its t), fear (seconds fleeing), dot (damage a second, for t).
// Damage types: radiant, shadow, void, blight, storm, frost, fire.
const S = (id, name, school, tier, kind, mana, cd, glyph, desc, o = {}) => ({ id, name, school, tier, kind, mana, cd, glyph, desc, ...o });
export const SPELLS = Object.freeze([
	// ---------- Radiance ----------
	S('sunspark', 'Sunspark', 'radiance', 1, 'bolt', 8, 0.45, '✦', 'A spark of daylight thrown from the hand. Burns hotter under the sun.', { dmg: 22, speed: 70, type: 'radiant' }),
	S('lance-of-dawn', 'Lance of Dawn', 'radiance', 2, 'beam', 14, 4, '⟋', 'Hold to pour a lance of light along your aim, searing all it touches.', { dps: 46, range: 60, t: 3, type: 'radiant' }),
	S('solar-flare', 'Solar Flare', 'radiance', 3, 'burst', 30, 10, '☀', 'Light bursts where you aim, burning and blinding everyone near it.', { dmg: 70, r: 5, range: 80, type: 'radiant', status: { hold: 1.6 } }),
	S('judgement', 'Judgement', 'radiance', 4, 'strike', 55, 30, '⇣', 'Call a pillar of light down from the sky. It lands a breath later and spares nothing within it.', { dmg: 170, r: 6, range: 120, delay: 1.2, type: 'radiant' }),
	// ---------- Restoration ----------
	S('mend', 'Mend', 'restoration', 1, 'heal', 16, 6, '✚', 'Close your wounds with a touch of light.', { heal: 30 }),
	S('renewal', 'Renewal', 'restoration', 2, 'hot', 22, 14, '❀', 'Light runs through you, healing a little each moment for a while.', { heal: 70, t: 10 }),
	S('sanctuary', 'Sanctuary', 'restoration', 3, 'zone', 40, 40, '◎', 'Hallowed ground at your feet. You heal inside it, and anyone hostile who enters is slowed.', { r: 6, t: 12, heal: 10, status: { slow: 0.45, t: 1 } }),
	S('resurgence', 'Resurgence', 'restoration', 4, 'deathward', 60, 180, '♱', 'For two minutes, a blow that would fell you instead leaves you standing, healed and shining.', { t: 120, heal: 0.4 }),
	// ---------- Warding ----------
	S('aegis', 'Aegis', 'warding', 1, 'shield', 14, 12, '⛨', 'A ward of light that takes the next blows for you.', { absorb: 40, t: 20 }),
	S('radiant-aura', 'Radiant Aura', 'warding', 2, 'aura', 24, 20, '✺', 'You shine. Anyone hostile close to you burns for as long as it lasts.', { dps: 14, r: 4.5, t: 12, type: 'radiant' }),
	S('bulwark', 'Bulwark', 'warding', 3, 'shield', 34, 35, '▣', 'For a few seconds nothing reaches you at all.', { absorb: 1e6, t: 3.5 }),
	S('banish', 'Banish', 'warding', 4, 'nova', 50, 45, '✸', 'A wall of light throws everyone hostile back from you and sends them fleeing.', { dmg: 30, r: 12, push: 9, type: 'radiant', status: { fear: 6 } }),
	// ---------- Dawn ----------
	S('lumen', 'Lumen', 'dawn', 1, 'light', 6, 2, '○', 'A small sun that follows at your shoulder and lights the dark. Cast again to let it go.', { t: 300 }),
	S('dawnsight', 'Dawnsight', 'dawn', 1, 'sight', 10, 20, '◈', 'See the aether: every mote and well near you shines through hill and wall.', { t: 30, what: 'aether', r: 300 }),
	S('swiftstride', 'Swiftstride', 'dawn', 2, 'buff', 18, 25, '»', 'Light at your heels: you run far faster and leap higher, and falls are gentle.', { t: 18, speedK: 1.65, jumpK: 1.5, fallK: 0.45 }),
	S('waterstride', 'Waterstride', 'dawn', 2, 'buff', 20, 30, '≈', 'Walk on water as on stone.', { t: 60, waterWalk: true }),
	S('daybreak', 'Daybreak', 'dawn', 3, 'daybreak', 40, 300, '☼', 'Hurry the night along: the sky turns toward dawn round you. (Only by night.)', {}),
	S('sunwell-gate', 'Sunwell Gate', 'dawn', 4, 'gate', 45, 60, '⊙', 'Step through the light to an aether well you have found. Cast again to choose the next.', {}),
	// ---------- Shadow ----------
	S('shadowbolt', 'Shadowbolt', 'shadow', 1, 'bolt', 9, 0.5, '☾', 'A bolt of the night. Strikes harder after dark.', { dmg: 26, speed: 60, type: 'shadow' }),
	S('shadowstep', 'Shadowstep', 'shadow', 2, 'blink', 18, 8, '⤳', 'Vanish and reappear where you aim, up to twenty metres off.', { range: 22 }),
	S('umbral-cloak', 'Umbral Cloak', 'shadow', 2, 'cloak', 26, 40, '◐', 'The dark folds round you. Those hunting you lose sight of you while it lasts, unless you strike.', { t: 12 }),
	S('night-terror', 'Night Terror', 'shadow', 3, 'cone', 34, 25, '☠', 'A wave of dread before you: all it touches flees in terror.', { dmg: 12, range: 25, angle: 0.6, type: 'shadow', status: { fear: 7 } }),
	S('eclipse', 'Eclipse', 'shadow', 4, 'burst', 60, 40, '●', 'The light goes out where you aim. All within are held in darkness, then torn by it.', { dmg: 140, r: 8, range: 90, delay: 2, type: 'shadow', status: { hold: 2 } }),
	// ---------- Void ----------
	S('void-shard', 'Void Shard', 'void', 1, 'bolt', 10, 0.8, '◆', 'A splinter of nothing that passes through the first it strikes.', { dmg: 30, speed: 95, type: 'void', pierce: true }),
	S('repulse', 'Repulse', 'void', 2, 'cone', 22, 10, '⇶', 'Force before you, hurling everyone in reach away.', { dmg: 20, range: 12, angle: 0.75, push: 10, type: 'void' }),
	S('gravity-well', 'Gravity Well', 'void', 3, 'well', 38, 25, '◉', 'A knot of void where you aim draws everyone near into it, then collapses.', { dmg: 90, r: 9, range: 70, t: 3.5, pull: 4, type: 'void' }),
	S('event-horizon', 'Event Horizon', 'void', 4, 'well', 65, 60, '⊚', 'A sphere of void that holds all within it still and drinks their life.', { dmg: 60, dps: 28, r: 11, range: 70, t: 5, pull: 1.5, type: 'void', status: { hold: 5 } }),
	// ---------- Blight ----------
	S('hex-of-decay', 'Hex of Decay', 'blight', 1, 'bolt', 11, 3, '✣', 'A curse that rots the one it strikes for a while.', { dmg: 8, speed: 55, type: 'blight', status: { dot: 9, t: 8 } }),
	S('withering', 'Withering', 'blight', 2, 'bolt', 16, 6, '≀', 'Drains the strength from the one it strikes: they slow and weaken.', { dmg: 18, speed: 55, type: 'blight', status: { slow: 0.4, t: 8, dot: 4 } }),
	S('plague-cloud', 'Plague Cloud', 'blight', 3, 'cloud', 36, 25, '☁', 'A sickly cloud where you aim, choking and slowing all who stand in it.', { dps: 14, r: 5, range: 60, t: 10, type: 'blight', status: { slow: 0.6, t: 1 } }),
	S('soul-siphon', 'Soul Siphon', 'blight', 3, 'beam', 20, 12, '⥈', 'Hold to draw the life out of the one you aim at; half of it heals you.', { dps: 32, range: 30, t: 4, drain: 0.5, type: 'blight' }),
	S('contagion', 'Contagion', 'blight', 4, 'bolt', 44, 30, '☣', 'A plague that eats the one it strikes, and passes to the nearest of their kind if they fall.', { dmg: 20, speed: 50, type: 'blight', status: { dot: 22, t: 10, spread: 12 } }),
	// ---------- Umbral ----------
	S('nightsight', 'Nightsight', 'umbral', 1, 'sight', 10, 30, '◑', 'Your eyes open to the dark, and every living thing near you shows through the walls.', { t: 45, what: 'life', r: 120, night: true }),
	S('shade', 'Summon Shade', 'umbral', 2, 'summon', 30, 50, '✧', 'A shade comes out of the dark to fight beside you, striking at what threatens you.', { t: 45, dmg: 14, rate: 1.1, range: 30, n: 1, type: 'shadow' }),
	S('grave-host', 'Grave Host', 'umbral', 3, 'summon', 48, 90, '⁂', 'Three shades answer you, circling close and striking at everything hostile.', { t: 40, dmg: 12, rate: 0.9, range: 24, n: 3, type: 'shadow' }),
	S('dark-pact', 'Dark Pact', 'umbral', 4, 'pact', 0, 120, '⛧', 'Give a third of your life to the dark. Your mana is filled, and for a while every spell you cast is stronger.', { hp: 0.33, t: 20, power: 1.5 }),
	// ---------- Storm (twilight) ----------
	S('thunderclap', 'Thunderclap', 'storm', 1, 'nova', 18, 8, '⚡', 'Thunder breaks round you, stunning everyone close.', { dmg: 25, r: 6, push: 3, type: 'storm', status: { hold: 1.2 } }),
	S('chain-lightning', 'Chain Lightning', 'storm', 2, 'chain', 26, 6, 'ϟ', 'Lightning from your hand leaps from one foe to the next.', { dmg: 36, range: 50, jumps: 4, hop: 12, type: 'storm' }),
	S('ball-lightning', 'Ball Lightning', 'storm', 3, 'orb', 36, 18, '❂', 'A slow ball of lightning rolls out along your aim, striking everything near its path.', { dmg: 14, r: 6, speed: 9, t: 6, rate: 0.45, type: 'storm' }),
	S('tempest', 'Tempest', 'storm', 4, 'storm', 70, 60, '⛈', 'A storm gathers where you aim: lightning falls again and again, and the rain puts out fires.', { dmg: 60, r: 14, range: 110, t: 7, strikes: 10, douse: 40, type: 'storm' }),
	// ---------- Chrono (twilight) ----------
	S('quicken', 'Quicken', 'chrono', 2, 'buff', 28, 45, '⌁', 'Time runs faster for you: your spells come back sooner and you move quicker.', { t: 12, speedK: 1.3, cdK: 3 }),
	S('stasis', 'Stasis', 'chrono', 3, 'stasis', 30, 20, '⌛', 'The one you aim at is frozen in a moment of time.', { range: 60, t: 6 }),
	S('rewind', 'Rewind', 'chrono', 4, 'rewind', 50, 90, '↺', 'Unwind the last five seconds: you are back where you were, as hale as you were.', { back: 5 }),
	S('mark-and-recall', 'Mark and Recall', 'chrono', 1, 'recall', 20, 15, '⚑', 'Leave a mark in the weave. Cast again to return to it. (Hold Shift as you cast to mark anew.)', {}),
	// ---------- Primal (twilight) ----------
	S('cinder', 'Cinder', 'primal', 1, 'bolt', 12, 1.2, '♨', 'A coal of fire that bursts where it lands and sets alight what will burn.', { dmg: 24, speed: 50, splash: 2.5, type: 'fire', ignite: true }),
	S('frost-nova', 'Frost Nova', 'primal', 2, 'nova', 24, 14, '❄', 'Frost bursts out from you, freezing everyone close where they stand.', { dmg: 18, r: 7, type: 'frost', status: { hold: 4 } }),
	S('call-rain', 'Call Rain', 'primal', 2, 'douse', 22, 30, '☂', 'Rain falls round you, quenching every fire within forty metres.', { r: 40 }),
]);

export const SPELL = Object.freeze(Object.fromEntries(SPELLS.map((q) => [q.id, q])));
export const strandOf = (spell) => SCHOOLS[spell?.school]?.strand || null;

// what weaving a spell costs: { light, dark } (twilight: both)
export function weaveCost(spell) {
	const c = WEAVE_COST[spell.tier - 1] || 0, strand = strandOf(spell);
	if (strand === 'twilight') { const h = Math.round(c * TWILIGHT_SHARE); return { light: h, dark: h }; }
	return { light: strand === 'light' ? c : 0, dark: strand === 'dark' ? c : 0 };
}

// ---------- your magic ----------
export const STARTER = Object.freeze({ known: ['sunspark', 'shadowbolt', 'mend', 'lumen'], binds: ['sunspark', 'shadowbolt', 'mend', 'lumen', null], fabric: { light: 12, dark: 12 } });
export const SLOTS = 5;

export function createMagicState(from = null) {
	const s = { v: 1, known: [...STARTER.known], binds: [...STARTER.binds], fabric: { ...STARTER.fabric }, affinity: { light: 0, dark: 0 }, mana: 100, cds: {}, mark: null, wells: [], gateAt: 0, gathered: {} };
	if (from && from.v === 1) {
		if (Array.isArray(from.known)) s.known = from.known.filter((id) => SPELL[id]);
		if (Array.isArray(from.binds)) s.binds = [...Array(SLOTS)].map((_, i) => (SPELL[from.binds[i]] && s.known.includes(from.binds[i]) ? from.binds[i] : null));
		for (const k of ['light', 'dark']) { s.fabric[k] = Math.max(0, Math.floor(+from.fabric?.[k] || 0)); s.affinity[k] = Math.max(0, Math.floor(+from.affinity?.[k] || 0)); }
		if (Number.isFinite(from.mana)) s.mana = from.mana;
		if (from.mark && Number.isFinite(from.mark.x)) s.mark = { x: from.mark.x, y: from.mark.y, z: from.mark.z, w: from.mark.w || null };
		if (Array.isArray(from.wells)) s.wells = from.wells.filter((w) => Number.isFinite(w?.x)).slice(0, 64);
		if (from.gathered && typeof from.gathered === 'object') s.gathered = { ...from.gathered };
	}
	return s;
}
// what is kept (no cooldowns: they are of the moment)
export function saveMagic(s) { return { v: 1, known: s.known, binds: s.binds, fabric: s.fabric, affinity: s.affinity, mana: Math.round(s.mana), mark: s.mark, wells: s.wells, gathered: s.gathered }; }

export const manaMax = (s) => Math.min(260, 100 + 4 * s.known.length + Math.floor((s.affinity.light + s.affinity.dark) / 40));
// mana a second: more out of a fight
export const manaRegen = (s, fighting = false) => (fighting ? 4 : 7) + Math.min(6, (s.affinity.light + s.affinity.dark) / 150);

// why a spell cannot be woven now (null: it can)
export function weaveBlock(s, spell) {
	if (!spell) return 'There is no such spell.';
	if (s.known.includes(spell.id)) return 'You know it already.';
	const strand = strandOf(spell);
	if (spell.tier > 1 && !s.known.some((id) => SPELL[id].school === spell.school && SPELL[id].tier === spell.tier - 1)) return `Weave a tier ${spell.tier - 1} ${SCHOOLS[spell.school].name} spell first.`;
	if (strand === 'twilight') {
		const need = TWILIGHT_NEEDS[spell.tier - 1];
		if (s.affinity.light < need || s.affinity.dark < need) return `Twilight needs both strands in you: ${need} affinity with each (you have ${s.affinity.light} light, ${s.affinity.dark} dark).`;
	}
	const c = weaveCost(spell);
	if (s.fabric.light < c.light || s.fabric.dark < c.dark) return `It takes ${[c.light && `${c.light} light`, c.dark && `${c.dark} dark`].filter(Boolean).join(' and ')} fabric.`;
	return null;
}
// weave it: the fabric spent becomes affinity; the first free slot takes it. Returns ok.
export function weave(s, id) {
	const spell = SPELL[id];
	if (weaveBlock(s, spell)) return false;
	const c = weaveCost(spell);
	s.fabric.light -= c.light; s.fabric.dark -= c.dark;
	s.affinity.light += c.light; s.affinity.dark += c.dark;
	s.known.push(id);
	const free = s.binds.indexOf(null);
	if (free >= 0) s.binds[free] = id;
	return true;
}
// bind a known spell to slot i (0..4: the keys 6 to 0); it leaves any other slot
export function bind(s, i, id) {
	if (i < 0 || i >= SLOTS || (id && !s.known.includes(id))) return false;
	if (id) for (let k = 0; k < SLOTS; k++) if (s.binds[k] === id) s.binds[k] = null;
	s.binds[i] = id || null;
	return true;
}

// How strong a spell is just now. light: the sun's height (-1 below .. 1 overhead); pact: the
// dark pact's power, if it holds. Its strand's affinity adds up to half again; light spells
// gain a quarter by day, dark spells a third by night, twilight spells a third at dusk and
// dawn (the sun near the horizon); in the other's time each strand loses a tenth.
export function spellPower(s, spell, { light = 0.5, pact = 1 } = {}) {
	const strand = strandOf(spell);
	const day = Math.max(0, Math.min(1, light * 4 + 0.2)), night = 1 - day, dusk = Math.max(0, 1 - Math.abs(light) * 5);
	const aff = strand === 'twilight' ? Math.min(s.affinity.light, s.affinity.dark) : s.affinity[strand] || 0;
	let k = 1 + Math.min(0.5, aff / 500);
	if (strand === 'light') k *= 1 + 0.25 * day - 0.1 * night;
	else if (strand === 'dark') k *= 1 + 0.33 * night - 0.1 * day;
	else k *= 1 + 0.33 * dusk;
	return k * pact;
}
// its mana now: a deep affinity makes its own strand cheaper (to two thirds)
export function manaCost(s, spell) {
	const strand = strandOf(spell), aff = strand === 'twilight' ? Math.min(s.affinity.light, s.affinity.dark) : s.affinity[strand] || 0;
	return Math.round(spell.mana * (1 - Math.min(0.33, aff / 900)));
}
// why a spell cannot be cast now (null: it can); now in seconds
export function castBlock(s, id, now) {
	const spell = SPELL[id];
	if (!spell || !s.known.includes(id)) return 'You do not know that spell.';
	if ((s.cds[id] || 0) > now) return `${spell.name} is not ready (${Math.ceil(s.cds[id] - now)} s).`;
	if (s.mana < manaCost(s, spell)) return 'Not enough mana.';
	return null;
}
// pay for it and start its cooldown (cdK: how fast cooldowns run, a quickening)
export function spend(s, id, now, cdK = 1) {
	const spell = SPELL[id];
	s.mana -= manaCost(s, spell);
	s.cds[id] = now + spell.cd / Math.max(1, cdK);
}
// the share of its cooldown still to run (0 ready .. 1 just cast)
export const cooldownLeft = (s, id, now) => { const spell = SPELL[id], end = s.cds[id] || 0; return !spell || end <= now ? 0 : Math.min(1, (end - now) / Math.max(0.01, spell.cd)); };

// fabric gathered: n of a strand
export function gather(s, strand, n) { if (strand !== 'light' && strand !== 'dark') return false; s.fabric[strand] += Math.max(0, Math.floor(n)); return true; }
