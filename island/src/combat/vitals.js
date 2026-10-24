// What a target has left, read the same way for anyone in the fight: a person, a fighter, a
// monster, a vehicle, a friend in PvP. The target frame (combat/target-frame.js) and the bars
// over the monsters (combat/nameplates.js) show it. Pure: no three, no DOM.
//
// A target says it with vitals() ({ hp, max, armour, armourMax, mana, manaMax, pct }: pct when
// only shares are known, a friend's over the wire), or by its health (T.health, a squad
// fighter's T.ref.H) or a boss's machine (T.life()).

import { FACTIONS, PLAYER } from './factions.js';

const fin = (v) => Number.isFinite(+v);
// one target's vitals, or null for one with no life to show
export function vitalsOf(T) {
	if (!T) return null;
	const v = T.vitals?.() || T.health || T.ref?.H || T.life?.() || null;
	if (!v || !fin(v.hp) || !(v.max > 0)) return null;
	const hp = Math.max(0, Math.min(v.max, +v.hp));
	const out = { hp, max: +v.max, frac: hp / v.max, armour: 0, armourMax: 0, mana: null, manaMax: 0, pct: !!v.pct };
	if (v.armourMax > 0 && fin(v.armour)) { out.armourMax = +v.armourMax; out.armour = Math.max(0, Math.min(out.armourMax, +v.armour)); }
	if (v.manaMax > 0 && fin(v.mana)) { out.manaMax = +v.manaMax; out.mana = Math.max(0, Math.min(out.manaMax, +v.mana)); }
	return out;
}

// how a target stands among its kind (creatures/catalog.js rank): its word on the frame
export const RANK_LABEL = Object.freeze({ elite: 'Elite', rare: 'Rare Elite', boss: 'Boss' });
export const rankOf = (T) => T?.rank || T?.ref?.Sp?.rank || (T?.kind === 'boss' ? 'boss' : null);

// 'a Fog Wight' -> 'Fog Wight'; 'the Hollow King' -> 'The Hollow King'
export const plainName = (n) => String(n || 'Target').replace(/^an? /i, '').replace(/^\w/, (c) => c.toUpperCase());

// a life as it reads on a bar: whole points (one left shows as 1, not 0), thousands spaced
export function lifeText(v) {
	if (!v) return '';
	if (v.pct) return `${Math.ceil(v.frac * 100)}%`;
	const n = (x) => Math.ceil(x - 1e-6).toLocaleString('en-US');
	return `${n(v.hp)} / ${Math.round(v.max).toLocaleString('en-US')}`;
}

// the line under the name: what side or sort they are
export function sortOf(T) {
	if (!T) return '';
	if (T.kind === 'remote') return 'Player · PvP';
	if (T.kind === 'car') return 'Vehicle';
	if (T.kind === 'person') return T.child ? 'Young person' : T.faction === 'village' ? 'Villager' : 'Bystander';
	if (T.kind === 'boss') return 'Boss';
	const F = FACTIONS[T.faction];
	if (T.ref?.cr) return F?.name || 'Monster';
	if (T.kind === 'vehicle') return F?.name || 'Vehicle';
	return F?.name || '';
}
// hostile (red), neutral (gold) or friendly (green): hostile(T) says whether they are in a fight
// with you; a monster always is
export function reactionOf(T, hostile = () => false) {
	if (!T) return 'neutral';
	if (T.kind === 'ally' || T.faction === PLAYER) return 'friendly';
	if (T.ref?.cr || T.kind === 'boss' || T.kind === 'remote' || hostile(T)) return 'hostile';
	return 'neutral';
}

// the pale lag behind a bar's fill: it holds where the life was for a moment, then drains down
// to it, so each blow shows as the piece it took. c = { v, hold }; f the life now (0..1)
export const CHIP_HOLD = 0.4;
export function chipStep(c, f, dt) {
	if (c.v == null || f >= c.v) { c.v = f; c.last = f; c.hold = 0; return c.v; }
	// (a fresh blow: held again from where the life was before the first of them)
	if (c.last == null || f < c.last - 1e-6) c.hold = CHIP_HOLD;
	c.last = f;
	if (c.hold > 0) { c.hold -= dt; return c.v; }
	c.v = Math.max(f, c.v - Math.max(0.6 * dt, (c.v - f) * Math.min(1, dt * 5)));
	return c.v;
}
