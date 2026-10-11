// Local encounter recovery. Inventory commits atomically before a drop is removed.
// Unclaimed equipment lives for this world visit; collected instances use the normal save.
import { WEAPONS } from './weapons.js';
import { cleanInstance } from '../gameplay/gear-levels.js';

export const LOOT_REACH = 3.4;
export function recoveryItems(soldier, uid) {
	if (soldier?.kind !== 'person' || soldier.crew || !soldier.dead || soldier.noGun) return null;
	const held = soldier.loadout;
	if (!held || held.i !== soldier.F?.gun || !WEAPONS[held.i]) return null;
	const weapon = cleanInstance({ ...held, u: uid, x: 0 }, (id) => !!WEAPONS[id]);
	if (!weapon) return null;
	const box = WEAPONS[weapon.i].box;
	return [weapon, { u: `${uid}a`, i: box, l: 1, t: 0, x: 0 }];
}

export function createLoot({ apply, visible = () => true, max = 32, nonce = Math.random().toString(36).slice(2, 10) } = {}) {
	const drops = new Map();
	const caches = new Set();
	let sequence = 0;
	function add(soldier) {
		if (soldier.recoveryCreated) return null;
		const id = `l${nonce}${(++sequence).toString(36)}`;
		const items = recoveryItems(soldier, id);
		if (!items) return null;
		soldier.recoveryCreated = true;
		const p = soldier.pos;
		const drop = { id, items, name: soldier.F.name || 'Fallen fighter', pos: { x: p.x, y: p.y + 0.2, z: p.z }, yaw: soldier.yaw || 0, age: 0 };
		if (drops.size >= max) { const oldest = [...drops.values()].find((d) => !d.cache); if (oldest) drops.delete(oldest.id); else return null; }
		drops.set(id, drop);
		return drop;
	}
	function addCache({ id, name, pos, weapon, source }) {
		if (caches.has(id)) return null;
		const x = cleanInstance({ ...weapon, u: id, x: 0 }, (i) => !!WEAPONS[i]);
		if (!x) return null;
		caches.add(id);
		if (drops.size >= max) { const oldest = [...drops.values()].find((d) => !d.cache); if (oldest) drops.delete(oldest.id); }
		const drop = { id, name, pos: { ...pos }, items: [x, { u: `${id}a`, i: WEAPONS[x.i].box, l: 1, t: 0, x: 0 }], source, lift: .26, age: 0, yaw: 0, cache: true };
		drops.set(id, drop); return drop;
	}
	function reachable(drop, eye) {
		return !!drop && !!eye && Math.hypot(drop.pos.x - eye.x, drop.pos.y - eye.y, drop.pos.z - eye.z) <= LOOT_REACH && visible(eye, drop.pos);
	}
	function nearest(eye, forward) {
		let best = null, distance = Infinity;
		for (const drop of drops.values()) {
			const dx = drop.pos.x - eye.x, dz = drop.pos.z - eye.z, d = Math.hypot(dx, dz);
			// Looking toward the body suffices; aiming precisely at a small floor prop does not.
			const f = Math.hypot(forward.x, forward.z);
			if (d > 0.5 && f > 0.1 && (dx * forward.x + dz * forward.z) / (d * f) < 0.35) continue;
			if (d < distance && reachable(drop, eye)) { best = drop; distance = d; }
		}
		return best;
	}
	function take(id, eye) {
		const drop = drops.get(id);
		if (!reachable(drop, eye)) return { ok: false, message: 'Move closer to the fallen fighter’s equipment.' };
		const out = apply({ id: `recovery:${id}`, kind: 'trade', peer: 'field-recovery', give: { credits: 0, items: [] }, get: { credits: 0, items: drop.items } });
		if (!out?.ok) return { ok: false, message: out?.message || 'Could not collect equipment. Try again.' };
		drops.delete(id);
		return { ok: true, weapon: drop.items[0], source: drop.source, duplicate: !!out.duplicate };
	}
	function update(dt, eye) {
		for (const [id, drop] of drops) {
			drop.age += dt;
			if (!drop.cache && drop.age > 600 && Math.hypot(drop.pos.x - eye.x, drop.pos.z - eye.z) > 40) drops.delete(id);
		}
	}
	return { drops, add, addCache, nearest, take, update, remove: (id) => drops.delete(id), clear: () => { drops.clear(); caches.clear(); } };
}
