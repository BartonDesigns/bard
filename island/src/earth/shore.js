// Roots sit 20 cm below the terrain. Keep them dry; near the water favour low
// shrubs while retaining occasional trees on the higher bank. null is dry land.
export function shoreVegetation(ground, level, variation) {
	if (level == null || !Number.isFinite(level)) return 'normal';
	const above = ground - level;
	if (above < 0.3) return 'none';
	if (above < 4 && variation > 0.12 + 0.18 * (above / 4)) return 'bush';
	return 'normal';
}
