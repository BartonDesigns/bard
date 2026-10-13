// Standing earned by doing things, not bought: a rank for each way of helping out, from the
// counts the systems already keep (favours: people/errands.js; fares: vehicles/fares.js).
// Pure: the tables, the rank for a count, and the step to the next.

export const LADDERS = Object.freeze({
	favours: { name: 'Neighbour', steps: [[0, 'Stranger'], [1, 'Passer-by who helped'], [5, 'Familiar face'], [15, 'Good neighbour'], [40, 'Pillar of the community'], [100, 'Local legend']] },
	fares: { name: 'Driver', steps: [[0, 'Off duty'], [1, 'New driver'], [10, 'Regular'], [30, 'Trusted driver'], [75, 'Top rated'], [150, 'Legend of the road']] },
	stars: { name: 'Five-star rides', steps: [[0, 'None yet'], [1, 'First five stars'], [10, 'Smooth operator'], [40, 'Silk']] },
});

// { title, at, next: { at, title } | null, k: progress 0..1 to the next }
export function rankOf(ladder, count) {
	const L = LADDERS[ladder]?.steps || [];
	let i = 0;
	while (i + 1 < L.length && count >= L[i + 1][0]) i++;
	const next = L[i + 1] || null;
	return { title: L[i]?.[1] || '', at: L[i]?.[0] || 0, next: next && { at: next[0], title: next[1] }, k: next ? Math.max(0, Math.min(1, (count - L[i][0]) / (next[0] - L[i][0]))) : 1 };
}
// a rank just reached, when a count goes from a to b (for the announcement)
export function promoted(ladder, a, b) {
	const A = rankOf(ladder, a), B = rankOf(ladder, b);
	return B.title !== A.title ? B.title : null;
}
