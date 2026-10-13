// Using what you hold. A held item with a use shows a Use control (U on a keyboard); using it
// does its work in the world, spends it if it is single-use, and trains it (gear levels rise
// with use, gameplay/gear-levels.js). The Field Medkit: someone hurt in front of you is
// patched up first (a good deed on the compass), else your own wounds.
import { statsOf } from './gear-levels.js';

// what each usable item does, and what its control says
export const USES = Object.freeze({
	'field-medkit': { label: '🩹 Use medkit', xp: 30 },
	'repair-roll': { label: '🧰 Use repair roll', xp: 30 },
});

// how much a medkit mends, from its own Heal stat at its level and tier
export function healOf(inst) {
	const row = statsOf(inst).find((r) => r.label === 'Heal');
	return row ? row.value : 35;
}

// chooses what using an item does now: { kind: 'tend' | 'self' | 'none', why }
export function plan(id, { wounded = [], hurt = 0, favour = false } = {}) {
	if (id === 'repair-roll') return favour ? { kind: 'favour' } : { kind: 'none', why: 'Nothing here needs fixing.' };
	if (id !== 'field-medkit') return { kind: 'none', why: 'That has no use here.' };
	if (wounded.length) return { kind: 'tend', who: wounded[0] };
	if (hurt >= 1) return { kind: 'self' };
	return { kind: 'none', why: 'Nobody here is hurt, you included.' };
}

export function createItemUse({ arms, combat, people, persona, camera, hint, chatter, morality, worldKey = () => 'here', note = () => {}, errands = () => null }) {
	let uses = 0;
	function usable() {
		const H = arms.held?.();
		return H && USES[H.i] ? { inst: H, ...USES[H.i] } : null;
	}
	function use() {
		const U = usable();
		if (!U) return false;
		const C = combat(), cam = camera.position;
		if (!C) return false;
		const P = plan(U.inst.i, { wounded: C.woundedNear?.(cam.x, cam.z, 3) || [], hurt: C.hurt0?.() || 0, favour: !!errands()?.needs?.(U.inst.i) });
		if (P.kind === 'none') { hint(P.why, 2200); return false; }
		const item = arms.catalog?.().find?.((x) => x.id === U.inst.i);
		const r = arms.apply({ id: `use-${U.inst.u}-${Date.now().toString(36)}-${++uses}`, kind: 'use', itemId: U.inst.i, uid: U.inst.u, quantity: 1, activity: item?.activities?.[0] || 'home-defense' });
		if (!r?.ok) { hint(r?.message || 'That could not be used.', 2200); return false; }
		const amount = healOf(U.inst);
		if (P.kind === 'favour') errands()?.useHere?.(U.inst.i);
		else if (P.kind === 'tend') {
			const p = P.who.p;
			C.tend(p);
			const who = persona(p)?.first || 'them';
			chatter?.say?.(p, { text: ['Thank you. I thought that was it for me.', 'Oh, that is better. Thank you, really.', 'You stopped for me? Thank you.'][Math.floor(Math.random() * 3)], gesture: 'nod', feel: { joy: 0.6 } }, null);
			morality()?.record?.({ kind: 'tend', target: who, world: worldKey() });
			note('tend', {});
			hint(`You patched up ${who}.`, 2500);
		} else {
			const got = C.mend(amount);
			hint(`Patched up: +${Math.round(got)} health.`, 2200);
		}
		// (a single-use one is gone now: the next of its kind comes to hand, if there is one)
		const st = arms.state?.(), next = st && Object.values(st.instances || {}).find((x) => x.i === U.inst.i && x.u !== U.inst.u);
		if (st?.instances?.[U.inst.u]) arms.train?.(U.inst.u, U.xp);
		else if (next) arms.hold?.(next.u);
		else hint('That was your last one.', 2000);
		return true;
	}
	return { usable, use };
}
