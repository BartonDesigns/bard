// Honor: standing earned in a fair fight, and what it makes of you. Fighters who come at you or
// at others (raiders, invaders, gangs and crews who struck first, drones, the creatures of the
// deep), a village held against a raid, a great beast or machine brought down, mercy shown, and
// friends beaten in a fight both of you chose (PvP: the room allows it and both raised their
// flag) all earn it. Killing those who gave up, the unarmed or the law takes it away.
//
// Honor climbs a ladder of ranks, and each rank lifts three things at once (magic/stats.js folds
// them into state.mods with the perks and the gear):
//
//   Combat    the harm your weapons and fists deal          (mods.weapon)
//   Health    your life                                     (mods.life)
//   Defence   the harm turned aside                         (mods.armor)
//
// Pure: no three, no DOM (island/tools/honor.test.mjs).

import { FACTIONS } from './factions.js';

// [honor needed, title]
export const RANKS = Object.freeze([
	[0, 'Unproven'], [50, 'Recruit'], [150, 'Sentinel'], [350, 'Vanguard'], [700, 'Knight-Errant'],
	[1200, 'Champion'], [2000, 'Warden'], [3200, 'Paragon'], [5000, 'Legend'], [8000, 'Exalted'],
]);
export const RANK_TOP = RANKS.length - 1;
// what one rank gives: weapon harm (a share), life (points), harm turned aside (a share)
export const PER_RANK = Object.freeze({ combat: 0.025, health: 6, defence: 0.015 });
export const SKILLS = Object.freeze({
	combat: { name: 'Combat', glyph: '⚔', color: '#ff8f6b', line: 'Harder hits with every weapon, and with your hands.' },
	health: { name: 'Health', glyph: '❤', color: '#ff8a8a', line: 'More life to fight on with.' },
	defence: { name: 'Defence', glyph: '⛨', color: '#d8c49a', line: 'More of every blow turned aside.' },
});

export const rankOf = (pts) => { let i = 0; while (i < RANK_TOP && pts >= RANKS[i + 1][0]) i++; return i; };
export const titleOf = (rank) => RANKS[Math.max(0, Math.min(RANK_TOP, rank | 0))][1];
// the share of the way to the next rank (1 at the top)
export function rankFrac(pts) {
	const r = rankOf(pts);
	if (r >= RANK_TOP) return 1;
	return Math.max(0, Math.min(1, (pts - RANKS[r][0]) / (RANKS[r + 1][0] - RANKS[r][0])));
}
// what a rank gives, in the mods' own units
export const honorMods = (rank) => ({ weapon: rank * PER_RANK.combat, life: rank * PER_RANK.health, armor: rank * PER_RANK.defence });

// your honor, made whole (from what was kept, or new): pts, and what it came from (pve, pvp:
// the honor earned each way; wins: the PvP wins of the last while, for the repeats rule)
export function sanitizeHonor(h) {
	const n = (v) => Math.max(0, Math.floor(+v || 0));
	const o = { pts: n(h?.pts), pve: n(h?.pve), pvp: n(h?.pvp), wins: [] };
	if (Array.isArray(h?.wins)) for (const w of h.wins.slice(-20)) if (typeof w?.id === 'string' && Number.isFinite(w.t)) o.wins.push({ id: w.id.slice(0, 40), t: w.t });
	return o;
}

// honor gained (or lost: n < 0, never below none). way: 'pve' or 'pvp'. Returns { n, from, to }:
// the change and the rank before and after.
export function addHonor(h, n, way = 'pve') {
	const from = rankOf(h.pts);
	n = Math.round(n);
	if (n < 0) n = -Math.min(h.pts, -n);
	h.pts += n;
	if (n > 0 && (way === 'pve' || way === 'pvp')) h[way] += n;
	return { n, from, to: rankOf(h.pts) };
}

// ---------- PvE ----------
// how much a fighter of each kind is worth (their own toughness on top). Those always out to
// do harm (raiders, invaders, rogue machines, the creatures below) are fair game; the rest
// only when they are after you or someone (hostile) or struck first.
const KIND = Object.freeze({ raiders: 1.1, invaders: 1.3, machines: 0.8, creatures: 1, gang: 1, smugglers: 0.9, mercs: 1.3, militia: 0.8 });
const ALWAYS = new Set(['raiders', 'invaders', 'machines', 'creatures']);
export const HONOR_FOR = Object.freeze({ bossSlain: 200, defendVillage: 15, spare: 5, killSurrendered: -25, killLaw: -40, killUnarmed: -20 });

// the honor in a deed: a morality event (combat/morality.js record: { kind, faction, ctx: the
// names of what was so, such as 'hostileTarget', 'selfDefence' or 'surrendered' })
export function pveHonor(e) {
	if (!e) return 0;
	const ctx = new Set(Array.isArray(e.ctx) ? e.ctx : Object.keys(e.ctx || {}).filter((k) => e.ctx[k]));
	switch (e.kind) {
		case 'boss-slain': return HONOR_FOR.bossSlain;
		case 'defend-village': return HONOR_FOR.defendVillage;
		case 'spare': return HONOR_FOR.spare;
		case 'kill-surrendered': return HONOR_FOR.killSurrendered;
		case 'kill': {
			const F = FACTIONS[e.faction];
			if (ctx.has('surrendered')) return HONOR_FOR.killSurrendered;
			if (F?.lawful || ctx.has('lawTarget')) return HONOR_FOR.killLaw;
			if (!F || F.kind === 'civilians' || F.kind === 'villagers' || ctx.has('unarmed')) return ctx.has('hostileTarget') ? 0 : HONOR_FOR.killUnarmed;
			const w = KIND[F.kind] || 0;
			if (!w || !(ALWAYS.has(F.kind) || ctx.has('hostileTarget') || ctx.has('selfDefence') || ctx.has('defence'))) return 0;
			// (tougher fighters are worth more: 100 life and no armour is 10)
			return Math.round(10 * w * ((F.hp || 100) + (F.armour || 0) * 0.5) / 100);
		}
	}
	return 0;
}

// ---------- PvP ----------
export const PVP_BASE = 40;
// the same friend beaten again within this long counts as a repeat: half as much each time,
// nothing past the third
export const REPEAT_MS = 30 * 60 * 1000;
export const REPEATS_MAX = 3;
// the honor for beating a friend of rank `theirs` when you are `mine`: more for beating
// someone above you, less for someone below
export function pvpHonor(mine, theirs, repeats = 0) {
	if (repeats >= REPEATS_MAX) return 0;
	const k = Math.max(0.25, Math.min(2, 1 + 0.25 * ((theirs | 0) - (mine | 0))));
	return Math.round(PVP_BASE * k / Math.pow(2, repeats));
}
// a PvP win over `id` (rank `theirs`) at time t: recorded, and its honor given. Returns addHonor's.
export function pvpWin(h, id, theirs, t = Date.now()) {
	h.wins = h.wins.filter((w) => t - w.t < REPEAT_MS);
	const repeats = h.wins.filter((w) => w.id === id).length;
	h.wins.push({ id: String(id).slice(0, 40), t });
	if (h.wins.length > 20) h.wins.shift();
	return addHonor(h, pvpHonor(rankOf(h.pts), theirs, repeats), 'pvp');
}

// May a blow pass between two players? The room must allow PvP (the host's rule) and each must
// have raised their own flag. `theirs` is null when the room's server cannot tell (an older one,
// without net/protocol.js PVP_FEATURE): then only your own flag is weighed, on your side of it.
export const pvpOpen = (rules, mine, theirs = null) => !!rules?.pvp && !!mine && (theirs === null || !!theirs);

// ---------- for the Character view ----------
export function honorSheet(h, flag = false) {
	const rank = rankOf(h?.pts || 0), M = honorMods(rank), next = RANKS[rank + 1] || null;
	return {
		pts: h?.pts || 0, pve: h?.pve || 0, pvp: h?.pvp || 0, rank, title: titleOf(rank), frac: rankFrac(h?.pts || 0),
		next: next && { at: next[0], title: next[1] }, flag: !!flag,
		skills: [
			{ id: 'combat', ...SKILLS.combat, level: rank, text: `+${Math.round(M.weapon * 1000) / 10}% harm with weapons and fists` },
			{ id: 'health', ...SKILLS.health, level: rank, text: `+${M.life} life` },
			{ id: 'defence', ...SKILLS.defence, level: rank, text: `${Math.round(M.armor * 1000) / 10}% more harm turned aside` },
		],
	};
}
