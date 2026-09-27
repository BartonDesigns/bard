// The sound of the streets, synthesised live and played into the Bard's master output
// (soundbus.js) so the faceplate's volume still owns the mix:
//   a low city bed (distant traffic, the freeways, air handling), louder downtown and by day
//   tyre hiss and engine hum from the cars going past, panned and Doppler-shifted, the
//   hiss louder and brighter on wet roads; now and then a horn downtown, a far siren
//   footsteps: yours, on whatever is underfoot (pavement, grass, a dirt trail up high,
//   sand by the water, a wooden floor indoors, splashy in the rain), and the people
//   walking near you
//   voices: a soft murmur where people stand and talk
//   the cable cars' bells on the San Francisco lines, a church bell striking the hours
//   birds in the leafy streets by day, crickets in the suburbs at night
//   indoors: the street through the walls, and the house's own quiet hum
// Everything but your own feet fades out when you fly up, go under water, or leave the towns.

import { STYLE } from './styles.js';
import { toWorld } from './geo.js';
import { soundBus, noise } from '../world/soundbus.js';

// the cable car lines: Powell St, the Mason and Hyde branches along Jackson, California St
const CABLE = [
	[[37.7849, -122.4078], [37.7955, -122.4101]], [[37.7955, -122.4101], [37.8045, -122.4136]],
	[[37.7955, -122.4101], [37.7942, -122.4190]], [[37.7942, -122.4190], [37.8065, -122.4215]],
	[[37.7932, -122.3964], [37.7905, -122.4222]],
].map(([a, b]) => [toWorld(...a), toWorld(...b)]);
function toSegment(x, z, [a, b]) {
	const dx = b.x - a.x, dz = b.z - a.z, k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
	return Math.hypot(x - a.x - dx * k, z - a.z - dz * k);
}

export function createCitySound(bay, groundAt) {
	let ctx = null, A = null;
	let lastPos = null, stepAcc = 0, birdT = 2, cricketT = 0, walla = 0, cableT = 5, hornT = 20, sirenT = 90, lastHour = null;
	const bellPan = Math.random() * 1.2 - 0.6;

	function loop(buf, type, f, q, dest) {
		const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
		const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
		const g = ctx.createGain(); g.gain.value = 0;
		s.connect(fl).connect(g).connect(dest || A.master);
		s.start(0, Math.random() * 3);
		return { s, fl, g };
	}
	function setup() {
		const B = soundBus();
		if (!B) return false;
		if (ctx === B.ctx && A) return true;
		ctx = B.ctx;
		// indoors the street is heard through the walls: a low-pass over the town's sound
		const room = ctx.createBiquadFilter(); room.type = 'lowpass'; room.frequency.value = 18000; room.Q.value = 0.5; room.connect(B.out);
		const master = ctx.createGain(); master.gain.value = 0; master.connect(room);
		// what you hear wherever you walk: your feet, the room you are in (not faded with the town)
		const own = ctx.createGain(); own.gain.value = 1; own.connect(B.out);
		A = { master, room, own };
		A.white = noise(ctx, 'white');
		A.brown = noise(ctx, 'brown');
		A.bed = loop(A.brown, 'lowpass', 260, 0.5);
		A.hum = loop(A.white, 'bandpass', 110, 1.2);
		// a room's own quiet: air handling and the fridge's hum
		A.roomTone = loop(A.brown, 'lowpass', 140, 0.7, own);
		const mains = ctx.createOscillator(); mains.frequency.value = 120;
		A.mainsG = ctx.createGain(); A.mainsG.gain.value = 0;
		mains.connect(A.mainsG).connect(own); mains.start();
		// the nearest car: tyre hiss and an engine note, panned
		A.pan = ctx.createStereoPanner(); A.pan.connect(master);
		const hs = ctx.createBufferSource(); hs.buffer = A.white; hs.loop = true;
		const hf = ctx.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 900; hf.Q.value = 0.5;
		const hg = ctx.createGain(); hg.gain.value = 0;
		hs.connect(hf).connect(hg).connect(A.pan); hs.start();
		const eo = ctx.createOscillator(); eo.type = 'sawtooth'; eo.frequency.value = 55;
		const el = ctx.createBiquadFilter(); el.type = 'lowpass'; el.frequency.value = 180;
		const eg = ctx.createGain(); eg.gain.value = 0;
		eo.connect(el).connect(eg).connect(A.pan); eo.start();
		A.car = { hf, hg, eo, eg };
		// voices: noise through two formant bands, gated by a slow random envelope
		const vs = ctx.createBufferSource(); vs.buffer = A.white; vs.loop = true;
		const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 4;
		const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1450; f2.Q.value = 5;
		const vg = ctx.createGain(); vg.gain.value = 0;
		vs.connect(f1).connect(vg); vs.connect(f2).connect(vg); vg.connect(master); vs.start();
		A.voice = { f1, f2, vg };
		return true;
	}
	const panner = (v, dest) => { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(dest); return p; };
	// a burst of noise: filter, level, attack and decay (s), where to
	function burst(type, f, q, level, attack, decay, dest, t = ctx.currentTime) {
		const s = ctx.createBufferSource(); s.buffer = A.white;
		const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
		const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.setTargetAtTime(0, t + attack, decay / 3);
		s.connect(fl).connect(g).connect(dest);
		s.start(t, Math.random() * 3.5); s.stop(t + attack + decay + 0.02);
	}
	function thud(f, level, len, dest, t = ctx.currentTime) {
		const o = ctx.createOscillator(), g = ctx.createGain();
		o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + len);
		g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
		o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.01);
	}
	// one footfall on a surface: 'pave', 'grass', 'dirt', 'sand', 'wood'; wet: 0..1
	function step(level, pan, surface, wet = 0) {
		if (!(level > 1e-4)) return;
		const t = ctx.currentTime, p = panner(pan, surface === 'people' ? A.master : A.own), j = 0.85 + Math.random() * 0.3;
		if (surface === 'pave' || surface === 'people') { thud(120 * j, level * 0.5, 0.04, p, t); burst('bandpass', 1400 * j, 1.1, level, 0.004, 0.08, p, t + 0.012); }
		else if (surface === 'wood') { thud(150 * j, level * 0.9, 0.08, p, t); burst('bandpass', 600 * j, 2, level * 0.5, 0.003, 0.07, p, t); }
		else if (surface === 'grass') burst('highpass', 2500 * j, 0.7, level * 0.6, 0.03, 0.14, p, t);
		else if (surface === 'sand') { thud(90, level * 0.3, 0.06, p, t); burst('lowpass', 900 * j, 0.6, level * 0.8, 0.03, 0.16, p, t); }
		else { burst('bandpass', 1800 * j, 0.8, level * 0.7, 0.005, 0.06, p, t); burst('bandpass', 2600 * j, 0.9, level * 0.5, 0.005, 0.07, p, t + 0.03 + Math.random() * 0.02); }
		if (wet > 0.1 && surface !== 'wood') burst('bandpass', 3200 * j, 1.2, level * 0.6 * wet, 0.01, 0.15, p, t + 0.02);
	}
	function chirp(level, pan) {
		const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 4), f0 = 2600 + Math.random() * 2400;
		const p = panner(pan, A.master);
		for (let k = 0; k < n; k++) {
			const o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + k * (0.09 + Math.random() * 0.05);
			o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), t0 + 0.06);
			g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.08);
			o.connect(g).connect(p); o.start(t0); o.stop(t0 + 0.1);
		}
	}
	function cricket(level) {
		const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
		o.frequency.value = 4600;
		g.gain.setValueAtTime(0, t);
		for (let k = 0; k < 3; k++) { g.gain.linearRampToValueAtTime(level, t + k * 0.034 + 0.006); g.gain.linearRampToValueAtTime(0, t + k * 0.034 + 0.02); }
		o.connect(g).connect(A.master); o.start(t); o.stop(t + 0.12);
	}
	// a struck bell or bar: a handful of inharmonic partials, each dying at its own rate
	function strike(f, partials, level, dest, t) {
		for (const [m, lv, dec] of partials) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.value = f * m;
			g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level * lv, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
			o.connect(g).connect(dest); o.start(t); o.stop(t + dec + 0.02);
		}
	}
	// the gripman's bell: a quick syncopated clang-clang, clang-a-clang
	const CABLE_BELL = [[1, 1, 0.5], [2.76, 0.5, 0.3], [5.4, 0.25, 0.15]];
	function cableBell(level, pan) {
		const t = ctx.currentTime, p = panner(pan, A.master), f = 1180 + Math.random() * 60;
		const rhythm = Math.random() < 0.5 ? [0, 0.16, 0.42, 0.52, 0.62, 0.9] : [0, 0.12, 0.24, 0.5, 0.74, 0.86, 1.1, 1.22];
		for (const at of rhythm) strike(f, CABLE_BELL, level * (0.8 + Math.random() * 0.2), p, t + at);
	}
	// a church bell tolling the hour, far off: hum, prime, minor third, fifth, octave
	const CHURCH = [[0.5, 0.6, 5], [1, 1, 3.5], [1.19, 0.5, 2.5], [1.5, 0.35, 2], [2, 0.4, 1.6]];
	function toll(n, level) {
		const t = ctx.currentTime, p = panner(bellPan, A.master), lp = ctx.createBiquadFilter();
		lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(p);
		for (let k = 0; k < n; k++) strike(262 * 0.99, CHURCH, level, lp, t + k * 2.2);
		setTimeout(() => lp.disconnect(), (n * 2.2 + 6) * 1000);
	}
	function horn(level, pan) {
		const t = ctx.currentTime, p = panner(pan, A.master), len = 0.18 + Math.random() * 0.35;
		for (const f of [405, 510]) {
			const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
			o.type = 'square'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1500;
			g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.02); g.gain.setValueAtTime(level, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.04);
			o.connect(lp).connect(g).connect(p); o.start(t); o.stop(t + len + 0.06);
		}
	}
	function siren(level, pan) {
		// a far wail, rising and falling, blocks away
		const t = ctx.currentTime, p = panner(pan, A.master), len = 7 + Math.random() * 5;
		const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
		o.type = 'triangle'; o.frequency.setValueAtTime(700, t);
		for (let k = 0; k < len / 2.4; k++) { o.frequency.linearRampToValueAtTime(1350, t + k * 2.4 + 1.2); o.frequency.linearRampToValueAtTime(700, t + k * 2.4 + 2.4); }
		lp.type = 'lowpass'; lp.frequency.value = 1600;
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + len * 0.4); g.gain.linearRampToValueAtTime(0, t + len);
		o.connect(lp).connect(g).connect(p); o.start(t); o.stop(t + len + 0.05);
	}
	const ease = (param, v, tc = 0.25) => param.setTargetAtTime(v, ctx.currentTime, tc);

	// cam: the camera; o: { night, cars, people, steps, player, under, islandHalf, and if
	// main passes them, indoors (true/false), rain (0..1), hours (0..24) }
	function update(dt, cam, o) {
		if (!setup()) return;
		const x = cam.position.x, z = cam.position.z;
		const U = bay.loaded() ? bay.urbanAt(x, z) : null;
		const gy = groundAt(x, z), alt = cam.position.y - gy;
		const onIsland = Math.max(Math.abs(x), Math.abs(z)) < (o.islandHalf || 0);
		const town = U && !onIsland ? Math.min(1, Math.max(0, (U.u - 0.1) / 0.5)) : 0;
		const near = Math.max(0, 1 - Math.max(0, alt - 3) / 120) * (o.under ? 0 : 1);
		const on = town * near, inside = !!o.indoors, rain = o.rain || 0;
		const e = cam.matrixWorld.elements, fl = Math.hypot(e[8], e[10]) || 1, fx = -e[8] / fl, fz = -e[10] / fl;
		ease(A.room.frequency, inside ? 500 : 18000, 0.3);
		ease(A.roomTone.g.gain, inside ? 0.05 : 0, 0.5);
		ease(A.mainsG.gain, inside ? 0.0025 : 0, 0.5);
		// your own footsteps, on whatever is underfoot, anywhere you walk
		const P = o.player;
		if (lastPos && P && P.grounded && !P.flying && !P.swimming && !o.under) {
			const sp = Math.hypot(x - lastPos.x, z - lastPos.z) / Math.max(dt, 1e-3);
			if (sp > 0.6 && sp < 9) {
				stepAcc += sp * dt;
				const stride = sp > 4 ? 1.5 : 0.75;
				if (stepAcc > stride) {
					stepAcc = 0;
					const surface = inside ? 'wood' : town > 0.3 ? 'pave' : gy < 4 && !onIsland ? 'sand' : gy > 250 ? 'dirt' : 'grass';
					step(0.09 * (sp > 4 ? 1.3 : 1), (Math.random() - 0.5) * 0.2, surface, inside ? 0 : Math.min(1, rain * 2));
				}
			}
		} else stepAcc = 0;
		lastPos = { x, z };
		ease(A.master.gain, on > 0.01 ? (inside ? 0.5 : 1) : 0, 0.6);
		if (on <= 0.01) { if (o.steps) o.steps.length = 0; return; }
		const busy = U.s === STYLE.sf || U.d > 0.2 ? 1 : U.s === STYLE.retail || U.s === STYLE.office ? 0.7 : U.s === STYLE.older ? 0.45 : 0.3;
		const day = 1 - o.night * 0.6;
		ease(A.bed.g.gain, 0.08 * on * (0.4 + busy) * day);
		ease(A.hum.g.gain, 0.012 * on * busy);
		// the car closest to you (by loudness), Doppler-shifted as it passes; on wet roads the
		// tyres hiss louder and brighter
		let best = null, bl = 0;
		for (const c of o.cars || []) {
			if (c.px === undefined) continue;
			const dx = c.px - x, dz = c.pz - z, d2 = dx * dx + dz * dz;
			const l = c.v / (1 + d2 / 60);
			if (l > bl) { bl = l; best = { c, dx, dz, d: Math.sqrt(d2) }; }
		}
		const wetRoad = Math.min(1, rain * 2);
		if (best) {
			const { c, dx, dz, d } = best;
			const vr = d > 0.1 ? (c.vx * dx + c.vz * dz) / d : 0;           // speed away from you
			const dop = 343 / (343 + vr);
			const right = fz * dx - fx * dz;                                    // + to the right of the view
			ease(A.pan.pan, Math.max(-0.9, Math.min(0.9, -right / (d + 4))), 0.08);
			const l = Math.min(1, c.v / 10) / (1 + d * d / 90) * on;
			ease(A.car.hg.gain, 0.12 * l * (1 + wetRoad * 1.2), 0.1);
			ease(A.car.eg.gain, 0.05 * l, 0.1);
			ease(A.car.hf.frequency, (700 + wetRoad * 1600) * dop + c.v * 30, 0.1);
			ease(A.car.eo.frequency, (38 + c.v * 3.2) * dop, 0.1);
		} else { ease(A.car.hg.gain, 0); ease(A.car.eg.gain, 0); }
		// the people's footsteps and voices
		const steps = o.steps || [];                                          // footstep events from the people: { x, z, k }
		for (const s of steps) {
			const dx = s.x - x, dz = s.z - z, d = Math.hypot(dx, dz);
			if (d < 18) step(0.05 * on * s.k / (1 + d * d / 12), Math.max(-0.8, Math.min(0.8, -(fz * dx - fx * dz) / (d + 2))), 'people');
		}
		steps.length = 0;
		let talk = 0;
		for (const p of o.people || []) {
			if (!p.active || p.role !== 'chat') continue;
			const d = Math.hypot(p.M.S.pos.x - x, p.M.S.pos.z - z);
			talk += 1 / (1 + d * d / 30);
		}
		walla += (Math.min(1, talk) - walla) * Math.min(1, dt * 2);
		const now = performance.now() / 1000;
		const syll = 0.5 + 0.5 * Math.sin(now * (5.3 + Math.sin(now / 2.1) * 1.7));
		ease(A.voice.vg.gain, 0.05 * walla * on * syll, 0.04);
		ease(A.voice.f1.frequency, 420 + syll * 260 + Math.sin(now / 0.7) * 80, 0.05);
		ease(A.voice.f2.frequency, 1200 + (1 - syll) * 700, 0.05);
		// downtown now and then a horn, and a siren somewhere across the city
		hornT -= dt;
		if (hornT < 0) { hornT = 25 + Math.random() * 60; if (busy > 0.6 && o.night < 0.8) horn(0.012 * on, (Math.random() - 0.5) * 1.4); }
		sirenT -= dt;
		if (sirenT < 0) { sirenT = 120 + Math.random() * 240; if (busy > 0.6) siren(0.006 * on, (Math.random() - 0.5) * 1.6); }
		// the cable cars' bells, near the lines, from early till late
		cableT -= dt;
		if (cableT < 0) {
			cableT = 6 + Math.random() * 18;
			let d = 1e9;
			for (const s of CABLE) d = Math.min(d, toSegment(x, z, s));
			const h = o.hours ?? (o.night < 0.5 ? 12 : 2);
			if (d < 260 && h > 6.5 && h < 23.5) cableBell(0.03 * on / (1 + d / 40), (Math.random() - 0.5) * 1.2);
		}
		// a church bell striking the hour in the towns at nine, noon and six (the game's
		// day passes in minutes: every hour would be too many); only when the clock has
		// walked there, not when it was set
		if (o.hours !== undefined) {
			const hr = Math.floor(o.hours);
			if (lastHour !== null && hr !== lastHour && (hr - lastHour + 24) % 24 === 1 && (hr === 9 || hr === 12 || hr === 18) && U.s !== STYLE.office && U.s !== STYLE.industry && Math.random() < 0.7) toll(hr % 12 || 12, 0.03 * on);
			lastHour = hr;
		}
		// birds by day in the leafy streets, crickets at night in the suburbs
		const leafy = U.s === STYLE.suburb || U.s === STYLE.older ? 1 : U.s === STYLE.sunset ? 0.4 : 0.15;
		birdT -= dt;
		if (birdT < 0) { birdT = 1.5 + Math.random() * 6 / (0.3 + leafy); if (o.night < 0.4 && rain < 0.3) chirp(0.02 * on * leafy, (Math.random() - 0.5) * 1.6); }
		cricketT -= dt;
		if (cricketT < 0) { cricketT = 0.42 + Math.random() * 0.04; if (o.night > 0.6 && rain < 0.2) cricket(0.008 * on * leafy); }
	}
	return { update };
}
