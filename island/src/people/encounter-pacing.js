// One budget for visible street incidents across regions and planets. Active play time,
// rather than wall time, prevents reloads and travel from refreshing rare encounters.
export const RARE_GAP = 20 * 60;
export const familyOf = (kind) => {
	kind = kind.replace(/^favour\./, '');
	if (['bag', 'snatch', 'theft', 'lead'].includes(kind)) return 'property';
	if (['pass', 'catch', 'courier', 'groceries'].includes(kind)) return 'delivery';
	if (['repair', 'jumpstart'].includes(kind)) return 'vehicle';
	if (['firstaid', 'fall', 'checkin'].includes(kind)) return 'care';
	if (['survey', 'cleanup', 'pothole'].includes(kind)) return 'civic';
	return kind;
};
export function createEncounterPacing({ store = null, rand = Math.random } = {}) {
	let clock = 0, next = 90, rareAt = 0, recent = [], offeredAt = {}, saved = 0;
	try {
		const s = JSON.parse(store?.get('l99-encounter-pacing-v1') || 'null');
		if (s && Number.isFinite(s.clock) && s.clock >= 0) {
			clock = s.clock; next = Number.isFinite(s.next) ? s.next : clock + 90;
			rareAt = Number.isFinite(s.rareAt) ? s.rareAt : clock;
			recent = Array.isArray(s.recent) ? s.recent.filter((k) => typeof k === 'string').slice(-12) : [];
			for (const k of recent) if (Number.isFinite(s.offeredAt?.[k])) offeredAt[k] = s.offeredAt[k];
		}
	} catch { /* unavailable storage */ }
	const save = () => { try { store?.set('l99-encounter-pacing-v1', JSON.stringify({ clock, next, rareAt, recent, offeredAt })); } catch {} };
	const rareReady = () => clock - rareAt >= RARE_GAP;
	const ready = (kind) => clock >= next && (familyOf(kind) !== 'property' || rareReady());
	return {
		tick(dt) { if (!Number.isFinite(dt) || dt <= 0) return; clock += Math.min(dt, 1); saved += dt; if (saved >= 15) { saved = 0; save(); } },
		ready, rareReady,
		choose(kinds, explicit = false) {
			let pool = [...new Set(kinds)].filter((k) => (explicit || ready(k)) && (familyOf(k) !== 'property' || rareReady()));
			if (!explicit) {
				const varied = pool.filter((k) => !recent.slice(-3).includes(k) && familyOf(k) !== familyOf(recent.at(-1) || ''));
				pool = varied.length ? varied : pool.filter((k) => clock - (offeredAt[k] ?? -Infinity) >= 720);
			}
			const fresh = pool.filter((k) => !recent.includes(k));
			if (fresh.length) pool = fresh;
			// Quiet is preferable to another copy of the same encounter.
			return pool.length ? pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))] : null;
		},
		record(kind) { recent.push(kind); recent = recent.slice(-12); offeredAt[kind] = clock; for (const k of Object.keys(offeredAt)) if (!recent.includes(k)) delete offeredAt[k]; next = clock + 150 + rand() * 90; if (familyOf(kind) === 'property') rareAt = clock; save(); },
		info: () => ({ clock, nextIn: Math.max(0, next - clock), rareIn: Math.max(0, RARE_GAP - clock + rareAt), recent: [...recent] }),
	};
}
