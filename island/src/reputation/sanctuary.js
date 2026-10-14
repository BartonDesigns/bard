// One authored refuge beneath Gargantua's island, shared by the world and the server.
export const SOUL_FEATURE = 'persistent-reputation-v1';
export const SOUL_SITE = Object.freeze({ seed: 2281969, type: 'SINGULARITY', world: 'w2281969', x: 0, y: 6, z: 0, radius: 3.5, seconds: 8, name: 'The Quiet Well' });
export const soulWorld = (profile, seed) => profile?.type === SOUL_SITE.type && (seed >>> 0) === SOUL_SITE.seed;
export function atSoulWell(p) {
	return !!p && p.w === SOUL_SITE.world && p.type === SOUL_SITE.type && Array.isArray(p.p) && p.p.length === 3 && p.p.every(Number.isFinite)
		&& Math.hypot(p.p[0] - SOUL_SITE.x, p.p[2] - SOUL_SITE.z) <= SOUL_SITE.radius
		&& Math.abs(p.p[1] - (SOUL_SITE.y + 1.68)) <= 1.2 && !p.flying && !p.driving;
}
