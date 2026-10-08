// Health for anything that can be hurt in a fight: you, a hostile, a car, a crate, a boss.
// Hit points, armour that soaks a share of each blow until it is worn through, damage types
// (each thing can shrug off or feel some more than others), where it was hit, regeneration
// after a quiet spell, and how it ends: down (you, back up after a knockout) or destroyed.
// Pure data and functions, shared by every combat system and the tests.

export const DAMAGE_TYPES = ['ballistic', 'energy', 'pierce', 'blast', 'fire', 'impact'];
// where a blow lands, as a multiplier (a weak point is a boss's or machine's exposed core)
export const PARTS = Object.freeze({ head: 1.8, torso: 1, limb: 0.7, body: 1, weak: 2.5, plate: 0.25, wheel: 0.8 });

const fin = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// max: hit points; armour: points of armour; soak: the share of a blow armour takes (0..1);
// resist: { type: multiplier }; regen: hp a second after `delay` seconds without a hit;
// down: true for those knocked out rather than destroyed (you)
export function createHealth({ max = 100, armour = 0, soak = 0.6, resist = {}, regen = 0, delay = 5, down = false } = {}) {
	return { max, hp: max, armourMax: armour, armour, soak, resist: { ...resist }, regen, delay, quiet: 0, canDown: down, state: 'ok', lastHit: null, taken: 0 };
}

export const alive = (h) => !!h && h.state === 'ok';
export const frac = (h) => (h ? Math.max(0, h.hp / h.max) : 0);

// a blow: { amount, type, part, from: [x, y, z] }. Returns what it did.
export function applyDamage(h, blow) {
	const out = { dealt: 0, absorbed: 0, killed: false, downed: false, ignored: false };
	if (!h || h.state !== 'ok' || !blow) { out.ignored = true; return out; }
	const type = DAMAGE_TYPES.includes(blow.type) ? blow.type : 'ballistic';
	let amt = Math.max(0, fin(blow.amount)) * (PARTS[blow.part] ?? 1) * fin(h.resist[type], 1);
	if (amt <= 0) { out.ignored = true; return out; }
	// armour soaks its share (energy wears it faster, blast slips past more)
	if (h.armour > 0) {
		const soak = h.soak * (type === 'blast' ? 0.6 : 1);
		const take = Math.min(h.armour, amt * soak);
		h.armour = Math.max(0, h.armour - take * (type === 'energy' ? 1.6 : 1));
		amt -= take; out.absorbed = take;
	}
	h.hp = Math.max(0, h.hp - amt);
	h.quiet = 0; h.taken += amt;
	h.lastHit = { type, part: blow.part || 'body', from: blow.from || null };
	out.dealt = amt;
	if (h.hp <= 0) {
		if (h.canDown) { h.state = 'down'; out.downed = true; } else { h.state = 'dead'; out.killed = true; }
	}
	return out;
}

// time passing: regeneration after a quiet spell
export function tickHealth(h, dt) {
	if (!h || h.state !== 'ok') return;
	h.quiet += dt;
	if (h.regen > 0 && h.quiet >= h.delay && h.hp < h.max) h.hp = Math.min(h.max, h.hp + h.regen * dt);
}
export function heal(h, n) { if (h && h.state === 'ok') h.hp = Math.min(h.max, h.hp + Math.max(0, fin(n))); }
// back on your feet after being knocked out
export function revive(h, k = 1) { if (!h) return; h.state = 'ok'; h.hp = Math.max(1, h.max * k); h.armour = h.armourMax; h.quiet = 0; h.lastHit = null; }
