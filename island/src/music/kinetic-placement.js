// A conservative footprint search: never place a rig in water, through buildings,
// or across a steep slope. Returns null instead of forcing an obstructed placement.
export function findKineticSpot({ player, ground, blocked = () => false, wet = () => false, kind = 'garden' }) {
	const width = kind === 'pendulum' ? 12 : 18, depth = kind === 'pendulum' ? 8 : 18;
	const yaw = player.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
	for (const distance of [12, 20, 30, 42]) for (const turn of [0, -.55, .55, -1.1, 1.1, Math.PI]) {
		const x = player.pos.x - Math.sin(yaw + turn) * distance, z = player.pos.z - Math.cos(yaw + turn) * distance;
		let lo = Infinity, hi = -Infinity, clear = true;
		for (let i = 0; i <= 6 && clear; i++) for (let j = 0; j <= 6; j++) {
			const u = (i / 6 - .5) * width, v = (j / 6 - .5) * depth;
			const px = x + c * u + s * v, pz = z - s * u + c * v, h = ground(px, pz);
			if (!Number.isFinite(h) || h < .3 || wet(px, pz) || blocked(px, pz)) { clear = false; break; }
			lo = Math.min(lo, h); hi = Math.max(hi, h);
			if (hi - lo > .8) { clear = false; break; }
		}
		if (clear) return { x, y: hi + .02, z, yaw, kind };
	}
	return null;
}
