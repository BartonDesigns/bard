// The trials of the hundredth. Experience carries you to level 99 (magic/skills.js LEVEL_CAP);
// the hundredth, 100★, is earned. At 99 the trials open: seven deeds that ask for everything the
// game has taught (schools mastered, the deepest twilight, the great beasts brought down, the
// wells of the world found, mercy, and gear raised to the top). Deeds done before 99 count. Once
// every one is done comes the rite: gather from an aether well at dusk or dawn, when both strands
// show. The hundredth gives a skill point and five points to every attribute (magic/stats.js).
// Pure: no three, no DOM (island/tools/trials.test.mjs).

import { SCHOOLS } from './spells.js';
import { rankOf, RANK_MAX } from './perks.js';
import { LEVEL_CAP } from './levels.js';
import { GARMENT_SLOTS } from '../gameplay/arms.js';
import { strandsShowing } from './aether.js';

// ctx: what the trials read from your gear (magic/index.js trialContext): weaponTop, the highest
// level of a weapon you own; wornTop, how many slots wear a garment at 75 or more
const T = (id, name, glyph, of, desc, at) => ({ id, name, glyph, of, desc, at });
export const TRIALS = Object.freeze([
	T('mastery', 'Master of Schools', '✦', 3, 'Reach rank 100 in three schools of magic.', (s) => Object.keys(SCHOOLS).filter((k) => rankOf(s.use?.[k] || 0) >= RANK_MAX).length),
	T('twilight', 'Twilight Unbound', '⛈', 1, 'Weave Tempest or Rewind, the deepest of the twilight spells.', (s) => (s.known?.includes('tempest') || s.known?.includes('rewind') ? 1 : 0)),
	T('giants', 'Giant-feller', '♜', 3, 'Bring down three of the great beasts and machines.', (s) => s.deeds?.bosses || 0),
	T('wells', 'Wellwalker', '⊙', 12, 'Find twelve aether wells, in any of the worlds.', (s) => s.wells?.length || 0),
	T('mercy', 'The Open Hand', '❦', 25, 'Spare twenty-five who fought you.', (s) => s.deeds?.spared || 0),
	T('heirloom', 'Heirloom', '⚔', LEVEL_CAP, 'Raise a weapon to level 99.', (s, c) => c.weaponTop || 0),
	T('regalia', 'Regalia', '♛', GARMENT_SLOTS.length, 'Wear a garment on every slot, each at level 75 or more.', (s, c) => c.wornTop || 0),
]);
export const RITE = 'With every trial done, gather from an aether well at dusk or dawn.';
// the hundredth's gift to every attribute (magic/stats.js)
export const ASCENDED_ATTRIBUTE = 5;

// are the trials open (you are at 99)
export const trialsOpen = (s) => (s.level || 1) >= LEVEL_CAP;
// every trial as it stands: { id, name, glyph, desc, n, of, done }
export function trialsOf(s, ctx = {}) {
	return TRIALS.map((t) => {
		const n = Math.max(0, Math.min(t.of, Math.floor(t.at(s, ctx) || 0)));
		return { id: t.id, name: t.name, glyph: t.glyph, desc: t.desc, n, of: t.of, done: n >= t.of };
	});
}
export const trialsDone = (s, ctx) => trialsOf(s, ctx).filter((t) => t.done).length;
// why the rite cannot be made now (null: it can). at: { well: gathering from a well, light: the
// sun's height }
export function riteBlock(s, ctx, { well = false, light = 0.5 } = {}) {
	if (s.ascended) return 'You stand at the hundredth already.';
	if (!trialsOpen(s)) return `The trials open at level ${LEVEL_CAP}.`;
	const left = trialsOf(s, ctx).filter((t) => !t.done);
	if (left.length) return `${left.length} trial${left.length > 1 ? 's' : ''} still to do.`;
	if (!well) return RITE;
	if (!strandsShowing(light).twilight) return 'The rite is made at dusk or dawn, when both strands show.';
	return null;
}
// the rite made: you are 100★. Returns whether it was.
export function ascend(s, ctx, at) {
	if (riteBlock(s, ctx, at)) return false;
	s.ascended = true;
	return true;
}
// the deeds the trials count, from the fight's own record (combat/morality.js events)
export function countDeed(s, kind) {
	if (!s.deeds) s.deeds = { bosses: 0, spared: 0 };
	if (kind === 'boss-slain') { s.deeds.bosses++; return true; }
	if (kind === 'spare') { s.deeds.spared++; return true; }
	return false;
}
// the trials finished since they were last told (s.trials keeps those told): their ids
export function newlyDone(s, ctx) {
	const told = new Set(s.trials || []), out = [];
	for (const t of trialsOf(s, ctx)) if (t.done && !told.has(t.id)) out.push(t.id);
	s.trials = [...told, ...out];
	return out;
}
