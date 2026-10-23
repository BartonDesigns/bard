// The reach-in coolers' doors (bay/storefit.js coolers). Each is drawn into the shop's kit as a
// run of vertices of its own, noted as it is drawn (Builder.mark/since) and carried through the
// light bake to its finer copy (interiors/lightbake.js tessellate's marks), so a door swings open
// on its hinge without a draw of its own: only its few hundred floats go up while it moves. It
// opens when you take something cold from it (interiors/office-perks.js: a drink, a beer, milk,
// an ice cream), and when a shopper standing before it reaches in (the real people take the
// places to stand: people/people.js); the seal lets go with a soft pop as it opens and the door
// meets the frame with a thud as it swings shut, both where the door is (audio/spatial.js).

import { soundBus, noise } from '../world/soundbus.js';
import { placed } from '../audio/spatial.js';

// what each cooler's stock is yours to take as (office-perks.js PERK)
export const COLD = { soda: 'colddrink', cancool: 'colddrink', water: 'colddrink', energy: 'colddrink', beer: 'coldbeer', dairy: 'milk', frozen: 'icecream' };
// how far a door swings (a quarter turn: two doors hung on one mullion lie side by side open)
const WIDE = Math.PI / 2;

// a door as storefit draws it, all in the building's frame: ranges [[key, first, count]] its
// vertices in the kit (Builder.since), its hinge (hx, hz), its free edge from the hinge (ex, ez),
// its outward face (nx, nz), the place before it where you reach in (fx, fz)
export function makeDoor(ranges, hx, hz, ex, ez, nx, nz, fx, fz) {
	// (the way round that takes its free edge out into the shop)
	return { ranges, hx, hz, sx: Math.sign(ez * nx - ex * nz) || 1, fx, fz, a: 0, v: 0, hold: 0, npc: 2 + Math.random() * 8, spot: undefined, parts: null };
}

// the kit's meshes made (Builder.meshSteps, named by their keys): each door's runs as places in
// its mesh's list of marks, which the bake carries over to the finer copy it puts in its place
export function hangDoors(doors, meshes) {
	const cuts = new Map();
	for (const d of doors) for (const [k, f, c] of d.ranges) { if (!cuts.has(k)) cuts.set(k, new Set()); cuts.get(k).add(f).add(f + c); }
	for (const [k, s] of cuts) { const m = meshes.get(k); if (m) m.geometry.userData.marks = [...s].sort((a, b) => a - b); }
	for (const d of doors) {
		d.parts = [];
		for (const [k, f, c] of d.ranges) {
			const m = meshes.get(k), M = m?.geometry.userData.marks;
			if (M) d.parts.push({ m, i0: M.indexOf(f), i1: M.indexOf(f + c), geo: null, rest: null, nrest: null });
		}
	}
}

// a door at its angle: its vertices turned about its hinge from where they stand shut
function pose(d) {
	const a = d.a * d.sx, c = Math.cos(a), s = Math.sin(a);
	for (const P of d.parts) {
		const g = P.m.geometry, M = g.userData.marks, pos = g.attributes.position, nrm = g.attributes.normal;
		if (!M || !pos) continue;
		const v0 = M[P.i0], v1 = M[P.i1], o = v0 * 3;
		// (its place shut, kept the first time it moves in this geometry: the bake's copy is new)
		if (P.geo !== g) { P.geo = g; P.rest = pos.array.slice(o, v1 * 3); P.nrest = nrm ? nrm.array.slice(o, v1 * 3) : null; }
		const A = pos.array, N = nrm?.array, R = P.rest, Q = P.nrest;
		for (let i = 0; i < R.length; i += 3) {
			const x = R[i] - d.hx, z = R[i + 2] - d.hz;
			A[o + i] = d.hx + x * c + z * s; A[o + i + 1] = R[i + 1]; A[o + i + 2] = d.hz - x * s + z * c;
			if (Q) { const nx = Q[i], nz = Q[i + 2]; N[o + i] = nx * c + nz * s; N[o + i + 2] = -nx * s + nz * c; }
		}
		pos.addUpdateRange(o, R.length); pos.needsUpdate = true;
		if (Q) { nrm.addUpdateRange(o, R.length); nrm.needsUpdate = true; }
	}
}

// (not while the bake is reading the shop: it would light a door where it stood open)
const ready = (B) => !B.light || B.light.state === 'done' || B.light.state === 'failed';

// a door opened from the place before it (x, z in the building's frame, within reach), held
// open hold seconds; false: none there (or the shop is still being lit)
export function openDoor(B, x, z, hold = 2.5, reach = 0.9) {
	if (!B.doors?.length || !ready(B)) return false;
	let best = null, bd = reach;
	for (const d of B.doors) { const q = Math.hypot(d.fx - x, d.fz - z); if (d.parts && q < bd) { bd = q; best = d; } }
	if (best) best.hold = Math.max(best.hold, hold);
	return !!best;
}

// each frame for a shop with coolers: the shoppers reaching in, the doors swinging; near: you
// are near enough to hear it (and to see a shopper's hand on the door); local(B, x, z): a place
// in the world into the building's frame; at(B, d): a door's front in the world, for its sound
export function stepDoors(B, dt, near, local, at) {
	if (!ready(B)) return;
	// (each place to stand before the coolers is one door's: the nearest)
	if (B.spots && !B.doorSpots) {
		B.doorSpots = true;
		for (const q of B.spots) {
			if (q.sit) continue;
			const [lx, lz] = local(B, q.x, q.z);
			let best = null, bd = 0.8;
			for (const d of B.doors) { const r = Math.hypot(d.fx - lx, d.fz - lz); if (r < bd) { bd = r; best = d; } }
			if (best) best.spot = q;
		}
	}
	for (const d of B.doors) {
		if (!d.parts?.length) continue;
		d.hold -= dt;
		// a shopper at it reaches in now and then, holds it a moment, lets it go
		if (near && d.spot?.taken && (d.npc -= dt) <= 0) { d.npc = 7 + Math.random() * 16; d.hold = Math.max(d.hold, 1.4 + Math.random() * 1.8); }
		const want = d.hold > 0 ? WIDE : 0;
		if (d.a === want && !d.v) continue;
		const was = d.a;
		if (want) {
			// pulled open: quick, then easing to its stop
			d.v = 0;
			d.a += (WIDE - d.a) * (1 - Math.exp(-dt * 7));
			if (WIDE - d.a < 0.003) d.a = WIDE;
		} else {
			// let go: its closer draws it back, gathering speed, and the seal takes it
			d.v = Math.min(d.v + dt * 3.4, 2.8);
			d.a = Math.max(0, d.a - d.v * dt);
			if (!d.a) d.v = 0;
		}
		pose(d);
		if (near && !was && d.a) doorSound(at(B, d), true);
		if (near && was && !d.a) doorSound(at(B, d), false);
	}
}

// the doors put back shut (a shop let go: its bake's copy of the geometry may be kept and used
// again, so nothing is left standing open in it)
export function shutDoors(B) {
	for (const d of B.doors || []) if (d.a) { d.a = 0; d.v = 0; d.hold = 0; pose(d); }
}

// the sound of a cooler's door: opening, the seal letting go (a soft low pop, a breath of air
// drawn in) and the bottles on its shelves touching; shutting, the thud of the door meeting the
// frame, the seal's sigh and the glass rattling in it
function doorSound(at, open) {
	const S = soundBus();
	if (!S || !at) return;
	const { ctx, out } = S, t = ctx.currentTime;
	const P = placed(ctx, out, at, { ref: 1.4, roll: 1.25, max: 30 });
	const bus = ctx.createGain();
	bus.gain.value = open ? 0.5 : 0.65;
	bus.connect(P.node);
	const env = (g, peak, attack, len, at0 = t) => { g.gain.setValueAtTime(0.0001, at0); g.gain.exponentialRampToValueAtTime(peak, at0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, at0 + len); };
	// the thump, low
	const o = ctx.createOscillator(), og = ctx.createGain();
	o.type = 'sine';
	o.frequency.setValueAtTime(open ? 150 : 105, t);
	o.frequency.exponentialRampToValueAtTime(open ? 72 : 46, t + 0.14);
	env(og, open ? 0.32 : 0.6, 0.005, open ? 0.16 : 0.24);
	o.connect(og).connect(bus);
	o.start(t); o.stop(t + 0.3);
	// the air through the seal
	const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
	n.buffer = noise(ctx, 'pink'); n.loop = true;
	f.type = 'bandpass'; f.frequency.value = open ? 950 : 620; f.Q.value = 0.7;
	env(ng, open ? 0.22 : 0.16, open ? 0.03 : 0.008, open ? 0.32 : 0.18);
	n.connect(f).connect(ng).connect(bus);
	n.start(t, Math.random() * 3); n.stop(t + 0.4);
	// the glass: a bottle or two clinking (open), the pane rattling in its frame (shut)
	for (let k = 0; k < (open ? 2 : 3); k++) {
		const at0 = t + (open ? 0.05 + k * 0.07 : 0.012 + k * 0.022), p = ctx.createOscillator(), pg = ctx.createGain();
		p.type = 'sine';
		p.frequency.value = open ? 2300 + Math.random() * 1300 : 3200 + Math.random() * 900;
		env(pg, open ? 0.035 + Math.random() * 0.03 : 0.025, 0.002, open ? 0.12 + Math.random() * 0.08 : 0.05, at0);
		p.connect(pg).connect(bus);
		p.start(at0); p.stop(at0 + 0.25);
	}
	setTimeout(() => P.stop(), 800);
}
