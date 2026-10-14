// A scripted pilot for the military's aircraft (military/flight.js), for the tests: the jet
// down the runway, round a circuit and back onto it; the helicopter up, hovering, across and
// down again. Fixed small steps, inputs forced every frame, as a player's would be.
import { jetState, jetStep, heliState, heliStep } from '../src/military/flight.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the runway: along +z from z = 0 (1300 m of it) at x = 0, on flat ground at height h
export function flyCircuit({ h = 10, dt = 1 / 60, maxT = 600 } = {}) {
	const ground = () => h;
	const S = jetState(0, h, 40, 0);
	const log = { events: [], maxAlt: 0, maxSpd: 0, gearUp: false, phases: [], minGearT: 1 };
	// the circuit: climb out, crosswind, downwind, base, then the centreline
	const wps = [[0, 3200, 300], [-2600, 5200, 300], [-4800, 2500, 300], [-4800, -4500, 300], [-1800, -7500, 300]];
	let phase = 'roll', wi = 0, t = 0;
	const att = () => {
		// forward in the world, and how high the left wing is
		const q = S.q, fx = 2 * (q.x * q.z + q.w * q.y), fy = 2 * (q.y * q.z - q.w * q.x), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
		const ly = 2 * (q.x * q.y + q.w * q.z);
		return { pitch: Math.asin(clamp(fy, -1, 1)), bank: Math.asin(clamp(ly, -1, 1)), hdg: Math.atan2(fx, fz) };
	};
	const fly = (hdgT, altT, vT, pitchMax = 0.25) => {
		const A = att();
		const bankT = clamp(-wrap(hdgT - A.hdg) * 1.6, -0.75, 0.75);
		const pitchT = clamp((altT - S.alt) * 0.012, -0.12, pitchMax) / Math.max(0.6, Math.cos(A.bank));
		return { thr: clamp((vT - S.spd) / 15, -1, 1), pitch: clamp((pitchT - A.pitch) * 4, -1, 1), roll: clamp((bankT - A.bank) * 3, -1, 1), yaw: 0, brake: false };
	};
	while (t < maxT) {
		t += dt;
		let I;
		if (phase === 'roll') {
			I = { thr: 1, pitch: S.spd > 72 ? 1 : 0, roll: 0, yaw: 0, brake: false };
		} else if (phase === 'climb' || phase === 'circuit') {
			const [wx, wz, wa] = wps[wi];
			I = fly(Math.atan2(wx - S.pos.x, wz - S.pos.z), wa, wi >= 3 ? 105 : 150);
			if (Math.hypot(wx - S.pos.x, wz - S.pos.z) < 400) { wi++; phase = 'circuit'; if (wi >= wps.length) phase = 'final'; }
		} else if (phase === 'final') {
			// along the centreline (a point ahead on it), down a three degree slope to the numbers
			const toGo = 120 - S.pos.z, A = att();
			const hdgT = Math.atan2(0 - S.pos.x, Math.max(600, toGo * 0.5));
			const glide = Math.max(0, toGo) * Math.tan(3 * Math.PI / 180);
			const bankT = clamp(-wrap(hdgT - A.hdg) * 2, -0.5, 0.5);
			let pitchT = -0.052 + clamp((glide - S.alt) * 0.02, -0.08, 0.08);
			let thr = clamp((84 - S.spd) / 10, -1, 1);
			if (S.alt < 12) { pitchT = -Math.min(1.2 + S.alt * 0.3, -A.pitch * S.spd) / Math.max(40, S.spd); thr = clamp((86 - S.spd) / 10, -1, 1); }
			I = { thr, pitch: clamp((pitchT - A.pitch) * 5, -1, 1), roll: clamp((bankT - A.bank) * 3, -1, 1), yaw: 0, brake: false };
		} else {
			I = { thr: -1, pitch: 0, roll: 0, yaw: 0, brake: true };
		}
		const ev = jetStep(S, I, dt, ground);
		log.maxAlt = Math.max(log.maxAlt, S.alt); log.maxSpd = Math.max(log.maxSpd, S.spd);
		if (!S.gear) log.gearUp = true;
		if (phase === 'final' || phase === 'rollout') log.minGearT = Math.min(log.minGearT, S.gearT);
		if (ev) log.events.push({ ev, t: +t.toFixed(1), z: Math.round(S.pos.z), x: +S.pos.x.toFixed(1), ...(S.touch || {}) });
		if (ev === 'crash') break;
		if (ev === 'takeoff') { phase = 'climb'; log.phases.push(['climb', +t.toFixed(1)]); }
		if ((ev === 'smooth' || ev === 'firm') && phase === 'final') { phase = 'rollout'; log.phases.push(['rollout', +t.toFixed(1)]); }
		if (phase === 'rollout' && S.spd < 0.5) break;
	}
	return { S, log, t, phase };
}

// up to 30 m, a hover, across 200 m, a stop, and a held descend onto the ground
export function flyHover({ h = 10, dt = 1 / 60 } = {}) {
	const ground = (x) => h + (x > 100 ? 0.5 : 0);
	const S = heliState(0, h, 0, 0), log = { events: [], hoverDrift: 0, maxAlt: 0 };
	let t = 0, phase = 'spool', holdT = 0, hoverAlt = 0;
	while (t < 240) {
		t += dt;
		const I = { coll: 0, fwd: 0, side: 0, turn: 0 };
		if (phase === 'spool') { I.coll = 1; if (!S.ground) phase = 'climb'; }
		else if (phase === 'climb') { I.coll = S.alt < 30 ? 1 : 0; if (S.alt >= 30) { phase = 'hover'; holdT = 0; } }
		else if (phase === 'hover') { holdT += dt; if (holdT > 2 && !hoverAlt) hoverAlt = S.alt; if (holdT > 2) log.hoverDrift = Math.max(log.hoverDrift, Math.abs(S.alt - hoverAlt)); if (holdT > 8) phase = 'across'; }
		else if (phase === 'across') { I.fwd = S.pos.z < 200 ? 1 : -Math.sign(S.vel.z) * Math.min(1, Math.abs(S.vel.z) / 3); if (S.pos.z > 190 && Math.abs(S.vel.z) < 0.5) phase = 'descend'; }
		else if (phase === 'descend') I.coll = -1;
		const ev = heliStep(S, I, dt, ground);
		log.maxAlt = Math.max(log.maxAlt, S.alt);
		if (ev) log.events.push({ ev, t: +t.toFixed(1), ...(S.touch || {}) });
		if (ev === 'crash' || (ev === 'down' && phase === 'descend')) break;
	}
	return { S, log, t, phase };
}
