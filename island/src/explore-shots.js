// A complete camera move runs over a musical phrase, with zero velocity and
// acceleration at either end. It changes only framing, never player flight physics.
export function shotFrame(shot, elapsed, duration) {
	const t = Math.min(1, Math.max(0, elapsed / Math.max(1, duration)));
	const u = t * t * t * (t * (t * 6 - 15) + 10);
	const out = {};
	for (const key of ['a', 'd', 'h', 'lh', 'ahead']) {
		const start = shot[key] || 0;
		out[key] = start + ((shot.end?.[key] ?? start) - start) * u;
	}
	return out;
}
