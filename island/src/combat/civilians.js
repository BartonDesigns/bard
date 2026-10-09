// The townsfolk in a fight (people/people.js's crowd): gunfire or a blast near them and they
// react. Grown-ups flinch, some drop and cower a moment, most run from it, and now and then
// one calls out. Children are never targets: they are never put in the combat layer, and they
// walk calmly away from the noise with their families. Anyone struck down goes limp
// (people/ragdoll.js), lies a while, and fades away; no blood, no wounds.

import * as THREE from 'three';
import { isMinor, personShapes } from './targets.js';
import { createHealth, applyDamage } from './health.js';

const CALLS = ['Get down!', 'Run!', 'Everyone, this way!', 'Somebody call the patrol!', 'Over there, go!', 'Keep low!'];
const _v = new THREE.Vector3();

export function createCivilians(ctx) {
	const { people, ragdolls, layer } = ctx;
	const known = new Map();                           // person -> { T, H, panic, ... }
	let callT = 0;

	// a minor, under the ward
	const sheltered = (p) => isMinor(p.P);
	const vulnerable = (p) => !!p.camp || p.route?.kind === 'camp' || (p.P.dna?.age || 30) > 75;

	function stateOf(p) {
		let s = known.get(p);
		if (!s) {
			s = { p, panic: 0, from: { x: 0, z: 0 }, cower: 0, calm: false, dead: 0, H: null, T: null };
			const id = 'pp' + (known.size + Math.floor(Math.random() * 1e6));
			s.T = {
				id, kind: 'person', faction: p.village ? 'village' : 'civ', P: p.P, child: sheltered(p), bound: { x: 0, y: 0, z: 0, r: 1.2 },
				name: sheltered(p) ? 'a young person' : vulnerable(p) ? 'a vulnerable bystander' : 'a bystander',
				moral: () => ({ unarmed: true, fleeing: s.panic > 0 && !s.cower, vulnerable: vulnerable(p), villager: !!p.village, surrendered: s.hands > 0 }),
				shapes: () => { const q = p.M.S.pos; return personShapes(q.x, q.y, q.z, p.P.height || 1.7, s.cower > 0 ? 0.6 : 0); },
				surface: 'person',
				get surrendered() { return s.hands > 0; },
				onHit: (blow) => hit(s, blow),
			};
			known.set(p, s);
		}
		return s;
	}

	// fleeing, cowering or fallen: steering taken from the crowd for a while
	function override(p, dt) {
		const s = known.get(p);
		if (!s) return false;
		if (s.dead) return true;
		if (s.hands > 0) {
			// hands up, held up
			s.hands -= dt;
			p.M.want.speed = 0; p.M.act('cheer', 0.35);
			if (s.hands <= 0) { p.M.act(null); s.panic = Math.max(s.panic, 8); }
			return true;
		}
		if (s.panic <= 0) { p.override = null; p.M.act(null); return false; }
		s.panic -= dt;
		const M = p.M, at = M.S.pos;
		if (s.cower > 0) {
			s.cower -= dt;
			M.want.speed = 0; M.act('crouch', 0);
			if (s.cower <= 0) M.act(null);
			return true;
		}
		let ax = at.x - s.from.x, az = at.z - s.from.z;
		const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
		// (a little to one side, so a crowd scatters rather than files away)
		const side = s.side || (s.side = Math.random() < 0.5 ? -0.4 : 0.4);
		M.want.heading = Math.atan2(ax + az * side, az - ax * side);
		M.want.speed = s.calm ? 1.5 : 3.6 + Math.random() * 0.2;
		M.want.run = s.calm ? 0 : 1;
		M.S.look.target = null;
		return true;
	}

	// gunfire or a blast at (x, z) within r: everyone near reacts
	function alarm(x, z, r = 22) {
		for (const p of people()?.pool || []) {
			if (!p.active || !p.P.root.visible || p.P.ragdoll) continue;
			const q = p.M.S.pos, d = Math.hypot(q.x - x, q.z - z);
			if (d > r) continue;
			const s = stateOf(p);
			if (s.dead) continue;
			const fresh = s.panic <= 0;
			s.from.x = x; s.from.z = z;
			s.calm = sheltered(p);
			s.panic = Math.max(s.panic, 8 + Math.random() * 6);
			if (fresh && !s.calm && d < r * 0.6 && Math.random() < 0.3) s.cower = 1 + Math.random() * 2;
			if (fresh && !s.calm && Math.random() < 0.5) p.M.gesture('shrug', 0.6);
			p.engaged = false;
			p.override = override;
			if (fresh && !s.calm && callT <= 0 && d < r * 0.8) { callT = 5 + Math.random() * 4; ctx.call?.(CALLS[Math.floor(Math.random() * CALLS.length)], 'bystander'); }
		}
	}

	// held up at gunpoint: hands up for a while; the first time, what they carry is handed over
	function holdUp(p) {
		const s = stateOf(p);
		if (s.dead || sheltered(p) || s.hands > 0 || p.P.restrained) return null;
		const first = !s.robbed;
		s.robbed = true; s.hands = 5; s.panic = 0;
		p.override = override; p.engaged = false;
		const rich = ((p.P.dna?.seed ?? 0) % 3) === 0;
		return { first, credits: first ? (rich ? 80 + Math.floor(Math.random() * 160) : 5 + Math.floor(Math.random() * 25)) : 0, rich };
	}

	function hit(s, blow) {
		const p = s.p;
		if (s.dead || sheltered(p) || s.hands > 0 || p.P.restrained) return null;
		s.H ||= createHealth({ max: 100 });
		const r = applyDamage(s.H, blow);
		const q = p.M.S.pos;
		if (r.killed) {
			s.dead = 0.001; s.panic = 0;
			p.override = override; p.engaged = false;
			const d = blow.dir || { x: 0, y: 0, z: 0 };
			ragdolls.hit(p.P, { vel: _v.set(d.x, 0.1, d.z).normalize().multiplyScalar(blow.type === 'blast' ? 7 : 3.5).clone(), mass: 400, point: new THREE.Vector3(q.x, q.y + (blow.part === 'limb' ? 0.5 : 1.2), q.z), lift: blow.type === 'blast' ? 0.25 : 0.05 });
			layer.remove(s.T.id);
		} else {
			// a flinch and a run
			s.from.x = blow.src?.x ?? q.x; s.from.z = blow.src?.z ?? q.z;
			s.panic = 12; s.cower = 0; s.calm = false;
			p.override = override;
			p.M.gesture('shrug', 0.5);
		}
		alarm(q.x, q.z, 18);
		return r;
	}

	function update(dt, cam) {
		callT -= dt;
		const pool = people()?.pool || [];
		const present = new Set(pool);
		for (const [p, s] of known) if (!present.has(p)) {
			layer.remove(s.T.id); p.override = null;
			if (s.dead && p.P.ragdoll) ragdolls.release(p.P);
			known.delete(p);
		}
		for (const p of pool) {
			const s = known.get(p);
			// everyone near you in the layer (a child only to show the ward)
			const near = p.active && p.P.root.visible && !p.P.ragdoll && Math.abs(p.M.S.pos.x - cam.x) < 120 && Math.abs(p.M.S.pos.z - cam.z) < 120;
			if (near) {
				const st = s || stateOf(p);
				if (!st.dead) {
					const q = p.M.S.pos, h = p.P.height || 1.7;
					st.T.bound.x = q.x; st.T.bound.y = q.y + h * 0.5; st.T.bound.z = q.z; st.T.bound.r = h * 0.6;
					if (!layer.get(st.T.id)) { st.T.removed = false; layer.add(st.T); }
				}
			} else if (s && !s.dead) layer.remove(s.T.id);
			if (!s) continue;
			// the fallen: lie a while, then fade (the crowd fades and lets them go)
			if (s.dead) {
				s.dead += dt;
				if (s.dead > 12 && !p.leaving && p.active) { p.leaving = true; p.leaveT = 6; }
				if (!p.active) { ragdolls.release(p.P); p.override = null; layer.remove(s.T.id); known.delete(p); }
			} else if (!p.active) { p.override = null; layer.remove(s.T.id); known.delete(p); }
		}
	}
	function clear() {
		for (const [p, s] of known) { layer.remove(s.T.id); p.override = null; if (s.dead && p.P.ragdoll) ragdolls.release(p.P); }
		known.clear();
	}
	const info = () => { let panic = 0, dead = 0, inLayer = 0; for (const s of known.values()) { if (s.panic > 0) panic++; if (s.dead) dead++; if (layer.get(s.T.id)) inLayer++; } return { known: known.size, panic, dead, inLayer }; };
	return { update, alarm, clear, info, holdUp, stateOf };
}
