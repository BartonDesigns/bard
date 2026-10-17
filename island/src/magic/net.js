// Spells seen by friends in a room. A spell travels as one of the shots friends already see
// (combat/combat.js net.fx, relayed by the room as it is: net/protocol.js cleanFx), marked by
// its style (SPELL_STYLE) so the room needs nothing new: from where it was cast to where it went,
// and which spell it was carried in the hundredths of a metre of the end (the room keeps
// positions to the hundredth; the end is drawn to the tenth). impact: 1 for a held beam's pulse.
// Pure (island/tools/magic-net.test.mjs).

import { SPELLS } from './spells.js';

export const SPELL_STYLE = 7;
const INDEX = new Map(SPELLS.map((s, i) => [s.id, i]));

// a coordinate to the tenth, its hundredths digit d (0..9)
const put = (v, d) => { const s = v < 0 ? -1 : 1, a = Math.floor(Math.abs(v) * 10) / 10; return s * (a + d / 100); };
const dig = (v) => Math.round(Math.abs(v) * 100) % 10;

// the shot that carries a spell: { a, b } (b with the spell's index in its hundredths)
export function encodeSpell(id, from, to) {
	const i = INDEX.get(id);
	if (i === undefined) return null;
	return { a: { x: from.x, y: from.y, z: from.z }, b: { x: put(to.x, i % 10), y: to.y, z: put(to.z, Math.floor(i / 10) % 10) } };
}
// the spell a carried shot was (its catalog entry), or null
export function decodeSpell(b) {
	const i = dig(b.x) + 10 * dig(b.z);
	return SPELLS[i] || null;
}
// the room's own rounding (net/protocol.js r2), for the tests
export const roomRound = (v) => Math.round(v * 100) / 100;
