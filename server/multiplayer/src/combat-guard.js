// Server-side bounds for combat reports. Inventories remain local saves; this validates
// the equipped game item, world, reach, target and damage rate, not item ownership.
import { weaponStats } from '../../../island/src/combat/weapons.js';

export function createCombatGuard(now = () => Date.now()) {
	const budgets = new Map();
	return {
		clear(id) { budgets.delete(id); },
		accept(id, hit, source, target, pvp = false) {
			if (!source?.w || source.w !== target?.w || !source.p || !target.p || !hit.w || hit.w !== source.h) return false;
			const S = weaponStats({ i: source.h, l: source.hl || 1, t: source.ht || 0 });
			if (!S || hit.d <= 0 || (hit.k && hit.k !== S.type)) return false;
			const distance = Math.hypot(...source.p.map((v, i) => v - target.p[i]));
			if (distance > S.range + 15 + (target.radius || 0)) return false;
			if (pvp && !['head', 'body', 'torso', 'limb'].includes(hit.p)) return false;
			const t = now(), cap = S.dmg * Math.max(3, Math.ceil(S.rpm / 30));
			let B = budgets.get(id);
			// Switching held weapons must not refill the damage allowance.
			if (!B) B = { left: cap, at: t };
			B.left = Math.min(cap, B.left + Math.max(0, t - B.at) / 1000 * S.dmg * S.rpm / 60);
			B.at = t; budgets.set(id, B);
			if (hit.d > B.left + 0.01) return false;
			B.left -= hit.d;
			return true;
		},
	};
}
