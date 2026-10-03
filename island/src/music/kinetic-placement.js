// A conservative footprint search: never place a rig in water, through buildings,
// or across a steep slope. Returns null instead of forcing an obstructed placement.
// Enclose the complete animation at the model's maximum count, with clear margins.
export const RIG_FOOTPRINTS = Object.freeze({
	garden: [18, 18], pendulum: [12, 8], dominoes: [25, 25], chimes: [5, 5],
	cradle: [6, 3], droplets: [8, 8], harp: [18, 18], stairs: [6, 6],
	fountain: [11, 11], wavebars: [16, 3],
});
export function kineticFootprint(kind, requestedCount) {
	if (!Object.hasOwn(RIG_FOOTPRINTS, kind)) return null;
	const limit = RIG_LIMITS[kind], count = Number.isFinite(requestedCount) ? Math.round(Math.max(limit.minCount, Math.min(limit.maxCount, requestedCount))) : limit.defaultCount;
	if (kind === 'dominoes') { const width = Math.ceil(2 * (1.4 + (count - 1) * .115) + 2); return [width, width]; }
	if (kind === 'harp') {
		let radius = 0;
		for (let i = 0; i < count; i++) radius = Math.max(radius, (1.5 + i * .75) * (1 + .45 + i % 4 * .12));
		const width = Math.ceil(radius * 2 + 1); return [width, width];
	}
	if (kind === 'wavebars') return [Math.ceil(count * .42 + 2), 3];
	return RIG_FOOTPRINTS[kind];
}
export function findKineticSpot({ player, ground, blocked = () => false, wet = () => false, kind = 'garden', count }) {
	const footprint = kineticFootprint(kind, count); if (!footprint) return null;
	const [width, depth] = footprint;
	const nx = Math.ceil(width / 1.5), nz = Math.ceil(depth / 1.5);
	const yaw = player.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
	for (const distance of [Math.max(12, Math.hypot(width, depth) / 2 + 2), 22, 32, 44]) for (const turn of [0, -.55, .55, -1.1, 1.1, Math.PI]) {
		const x = player.pos.x - Math.sin(yaw + turn) * distance, z = player.pos.z - Math.cos(yaw + turn) * distance;
		let lo = Infinity, hi = -Infinity, clear = true;
		for (let i = 0; i <= nx && clear; i++) for (let j = 0; j <= nz; j++) {
			const u = (i / nx - .5) * width, v = (j / nz - .5) * depth;
			const px = x + c * u + s * v, pz = z - s * u + c * v, h = ground(px, pz);
			if (!Number.isFinite(h) || h < .3 || wet(px, pz) || blocked(px, pz)) { clear = false; break; }
			lo = Math.min(lo, h); hi = Math.max(hi, h);
			if (hi - lo > .8) { clear = false; break; }
		}
		if (clear) return { x, y: hi + .02, z, yaw, kind };
	}
	return null;
}
import { RIG_LIMITS } from './kinetic-rigs.js';
