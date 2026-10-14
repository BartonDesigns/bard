import { SOUL_SITE, soulWorld } from '../reputation/sanctuary.js';

// A walkable branch in the island's own cave field, never a separate scene or loading gate.
export function addSoulCave(plan, island, profile) {
	if (!soulWorld(profile, island.seed)) return;
	const H = island.heightAt, x = 400, z = 0, start = H(x, z) - 0.5;
	const chamber = { kind: 'soul', x: 0, z: 0, fy: SOUL_SITE.y, h: 9, rx: 10, rz: 10, rot: 0, cos: 1, sin: 0, k: 5, bump: 0, pools: [] };
	const pts = [];
	for (let i = 0; i <= 100; i++) {
		const t = i / 100, px = x * (1 - t);
		const y = start + (SOUL_SITE.y - start) * t;
		pts.push({ x: px, z, y, w: 3.6, h: 5 });
	}
	const tunnel = { pts, mouth: true, amp: 0.15, soul: true };
	const entrance = { x, z, y: H(x,z), yaw: Math.PI / 2, dir: { x: -1, z: 0 }, to: chamber, tunnel, name: 'The Quiet Well · soul tunnel' };
	plan.chambers.push(chamber); plan.tunnels.push(tunnel); plan.entrances.unshift(entrance);
	plan.holes.unshift({ x, z, r: 12 });
	plan.soul = { ...SOUL_SITE, entrance, tunnel };
}
