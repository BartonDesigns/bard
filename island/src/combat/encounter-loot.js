import { LEGENDARIES, LEGENDARY_ARMOR, BOSS_RELICS } from '../gameplay/legendary-items.js';

export const RARE_PITY = 5, LEGENDARY_PITY = 12;
export function lootProgress(raw = {}) {
	const count = (n, max, fallback) => Number.isInteger(n) && n >= 0 ? Math.min(max - 1, n) : fallback;
	return { rare: count(raw?.rare, RARE_PITY, RARE_PITY - 1), legendary: count(raw?.legendary, LEGENDARY_PITY, 0) };
}
export const rewardEligible = h => !!(h?.dead && h.T?.kind === 'hostile' && !h.ally && !h.crew && !h.surrendered && !h.child && !h.T.child && h.F?.kind !== 'civilians' && !(h.kind === 'person' && h.noGun));
const sample = rand => { const v = rand(); return Number.isFinite(v) ? Math.max(0, Math.min(.999999999, v)) : .999999999; };
export function legendaryReward(uid, level = 15, rand = Math.random) {
	return { u: uid, i: LEGENDARIES[Math.floor(sample(rand) * LEGENDARIES.length)].id,
		l: Math.max(15, Math.min(99, Math.floor(Number(level) || 15))), t: 4, x: 0 };
}
export function armorReward(uid, level = 15, rand = Math.random, boss = null) {
	const pool = boss ? LEGENDARY_ARMOR.filter(x => x.boss === boss) : LEGENDARY_ARMOR;
	if (!pool.length) return null;
	return {u:uid,i:pool[Math.floor(sample(rand)*pool.length)].id,l:Math.max(15,Math.min(99,Math.floor(Number(level)||15))),t:4,x:0};
}
export function bossRelics(boss, uid, level = 15, rand = Math.random) {
	const pool = BOSS_RELICS[boss]; if (!pool) return [];
	// 'a' is reserved by equipmentItems for the weapon's ammo, including fallback caches.
	return [{ ...legendaryReward(uid,level,rand), i:pool[Math.floor(sample(rand)*pool.length)] }, armorReward(`${uid}b`,level,rand,boss)];
}
// One roll per player-credited enemy death. Persist counters between world visits/reloads.
// Pity counts generated drops, not collected ones; deliberately leaving loot cannot farm rerolls.
export function rollEncounter(h, uid, progress, rand = Math.random) {
	const p = lootProgress(progress);
	if (!rewardEligible(h)) return { progress: p, item: null };
	p.rare++; p.legendary++;
	const r = sample(rand), t = p.legendary >= LEGENDARY_PITY || r < .05 ? 4 : r < .13 ? 3 : p.rare >= RARE_PITY || r < .38 ? 2 : -1;
	if (t < 0) return { progress: p, item: null };
	p.rare = 0;
	const level = h.loadout?.l || Math.round((h.H?.max || 100) / 30);
	if (t === 4) { p.legendary = 0; return { progress: p, item: sample(rand) >= .65 ? armorReward(uid,level,rand) : legendaryReward(uid, level, rand) }; }
	const pool = sample(rand) >= .5 ? ['kettle-helm','mail-hauberk','plate-cuirass','plate-greaves','plate-gauntlets','sabatons','ballistic-helmet','plate-carrier','tactical-gloves','combat-boots'] : ['aurora-trail-rifle', 'mossback-scout-rifle', 'warden-spark-carbine', 'longwatch-sniper-rifle'];
	return { progress: p, item: { u: uid, i: pool[Math.floor(sample(rand) * pool.length)], l: Math.max(1, Math.min(99, level)), t, x: 0 } };
}
