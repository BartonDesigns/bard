// A boss's fight as a small machine: phases by health (and by weak points broken), attacks
// chosen from the phase's own set, each telegraphed (a warning you can read and dodge), then
// active, then a recovery you can punish. Between phases it is untouchable for a moment while it
// changes. Weak points take more; some only open in a phase, some can be broken outright.
// Pure: the bosses (combat/bosses.js) read its state and events to move and draw.

// def: { hp, gap, transition, phases: [{ at, name, attacks: [ids], speed }],
//   attacks: { id: { warn, active, recover, weight } },
//   weak: { id: { mult, open: [phase indices] | null (always), hp, advances } } }
export function createBossMachine(def, rand = Math.random) {
	const weak = {};
	for (const [id, w] of Object.entries(def.weak || {})) weak[id] = { ...w, hp: w.hp ?? Infinity, max: w.hp ?? Infinity, broken: false };
	const M = { def, max: def.hp, hp: def.hp, phase: 0, state: 'idle', t: (def.gap ?? 2) * 0.75, attack: null, last: null, weak, dealt: 0, phaseName: def.phases[0].name };
	const ph = () => def.phases[M.phase];
	const speed = () => ph().speed || 1;

	function pick() {
		const ids = ph().attacks.filter((a) => a !== M.last || ph().attacks.length === 1);
		let sum = 0;
		for (const a of ids) sum += def.attacks[a]?.weight ?? 1;
		let x = rand() * sum;
		for (const a of ids) { x -= def.attacks[a]?.weight ?? 1; if (x <= 0) return a; }
		return ids[ids.length - 1];
	}
	// the phase this health (and what is broken) calls for
	function wantPhase() {
		let p = M.phase;
		const f = M.hp / M.max;
		for (let i = M.phase + 1; i < def.phases.length; i++) {
			const P = def.phases[i];
			const brokenNeed = P.broken ? P.broken.every((id) => weak[id]?.broken) : false;
			if (f <= P.at || brokenNeed) p = i;
		}
		return p;
	}
	function enter(state, dur) { M.state = state; M.t = dur; }

	// time passing: the events that happened
	function tick(dt) {
		const ev = [];
		if (M.state === 'dead') return ev;
		M.t -= dt * (M.state === 'transition' ? 1 : speed());
		if (M.t > 0) return ev;
		if (M.state === 'transition') { enter('idle', (def.gap ?? 2) * 0.5); ev.push({ type: 'phase-ready', phase: M.phase }); return ev; }
		if (M.state === 'idle') { M.attack = pick(); M.last = M.attack; enter('telegraph', def.attacks[M.attack].warn); ev.push({ type: 'telegraph', attack: M.attack }); return ev; }
		if (M.state === 'telegraph') { enter('active', def.attacks[M.attack].active); ev.push({ type: 'attack', attack: M.attack }); return ev; }
		if (M.state === 'active') { enter('recover', def.attacks[M.attack].recover); ev.push({ type: 'recover', attack: M.attack }); return ev; }
		if (M.state === 'recover') { ev.push({ type: 'end', attack: M.attack }); M.attack = null; enter('idle', def.gap ?? 2); }
		return ev;
	}

	const isOpen = (id) => { const w = weak[id]; return !!w && !w.broken && (!w.open || w.open.includes(M.phase)); };
	// a blow on a part: 'body' or a weak point's id. Returns { dealt, events }
	function damage(amount, part = 'body') {
		const ev = [];
		if (M.state === 'dead' || M.state === 'transition' || !(amount > 0)) return { dealt: 0, events: ev };
		let mult = 1;
		const w = weak[part];
		if (w) {
			if (!isOpen(part)) mult = 0.25;
			else {
				mult = w.mult ?? 2.5;
				if (Number.isFinite(w.hp)) {
					w.hp = Math.max(0, w.hp - amount * mult);
					if (w.hp <= 0 && !w.broken) { w.broken = true; ev.push({ type: 'broken', part }); }
				}
			}
		}
		const dealt = amount * mult;
		M.hp = Math.max(0, M.hp - dealt);
		M.dealt += dealt;
		if (M.hp <= 0) { M.state = 'dead'; M.attack = null; ev.push({ type: 'dead' }); return { dealt, events: ev }; }
		const p = wantPhase();
		if (p !== M.phase) {
			M.phase = p; M.phaseName = def.phases[p].name; M.attack = null;
			enter('transition', def.transition ?? 2.5);
			ev.push({ type: 'phase', phase: p, name: M.phaseName });
		}
		return { dealt, events: ev };
	}
	// how far into the current step (0..1), for the telegraphs and the attacks' motion
	const progress = () => {
		const dur = M.state === 'telegraph' ? def.attacks[M.attack].warn : M.state === 'active' ? def.attacks[M.attack].active : M.state === 'recover' ? def.attacks[M.attack].recover : M.state === 'transition' ? def.transition ?? 2.5 : def.gap ?? 2;
		return Math.max(0, Math.min(1, 1 - M.t / Math.max(1e-6, dur)));
	};
	// (the host's word, on a guest: health and phase as the host has them)
	function sync(hp, phase) {
		if (M.state === 'dead') return;
		M.hp = Math.max(0, Math.min(M.max, hp));
		if (phase > M.phase && phase < def.phases.length) { M.phase = phase; M.phaseName = def.phases[phase].name; }
		if (M.hp <= 0) M.state = 'dead';
	}
	return { M, tick, damage, isOpen, progress, sync, frac: () => M.hp / M.max };
}
