// The sound of the streets, synthesised live and played into the Bard's master output
// so the faceplate's volume still owns the mix:
//   a low city bed (distant traffic and air handling), louder downtown and by day
//   tyre hiss and engine hum from the cars going past, panned and Doppler-shifted
//   footsteps: yours on the pavement, and the people walking near you
//   voices: a soft murmur where people stand and talk
//   birds in the leafy streets by day, crickets in the suburbs at night
// Everything fades out when you fly up, go under water, or leave the towns.

import { STYLE } from './styles.js';

export function createCitySound(bay, groundAt) {
	let ctx = null, out = null, A = null;
	let lastPos = null, stepAcc = 0, birdT = 2, cricketT = 0, walla = 0;

	function noiseBuffer(c, secs, brown) {
		const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0);
		let last = 0;
		for (let i = 0; i < d.length; i++) {
			const w = Math.random() * 2 - 1;
			if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
		}
		return b;
	}
	function loop(buf, type, f, q) {
		const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
		const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
		const g = ctx.createGain(); g.gain.value = 0;
		s.connect(fl).connect(g).connect(A.master);
		s.start();
		return { s, fl, g };
	}
	function setup() {
		const bus = window._masterClip || window.leadBus227;
		const c = bus && bus.context;
		if (!c || c.state !== 'running') return false;
		if (ctx === c && A) return true;
		ctx = c; out = bus;
		const master = ctx.createGain(); master.gain.value = 0; master.connect(out);
		A = { master };
		A.white = noiseBuffer(ctx, 2, false);
		A.brown = noiseBuffer(ctx, 4, true);
		A.bed = loop(A.brown, 'lowpass', 260, 0.5);
		A.hum = loop(A.white, 'bandpass', 110, 1.2);
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
	function step(level, pan, bright) {
		const t = ctx.currentTime;
		const s = ctx.createBufferSource(); s.buffer = A.white;
		const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (bright ? 1400 : 700) * (0.85 + Math.random() * 0.3); f.Q.value = 1.1;
		const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);
		const p = ctx.createStereoPanner(); p.pan.value = pan;
		s.connect(f).connect(g).connect(p).connect(A.master);
		s.start(t, Math.random() * 1.5); s.stop(t + 0.12);
	}
	function chirp(level, pan) {
		const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 4), f0 = 2600 + Math.random() * 2400;
		const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(A.master);
		for (let k = 0; k < n; k++) {
			const o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + k * (0.09 + Math.random() * 0.05);
			o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * (1.3 + Math.random() * 0.4), t0 + 0.06);
			g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.08);
			o.connect(g).connect(p); o.start(t0); o.stop(t0 + 0.1);
		}
	}
	function cricket(level) {
		const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
		o.frequency.value = 4300 + Math.random() * 400;
		g.gain.setValueAtTime(0, t);
		for (let k = 0; k < 3; k++) { g.gain.linearRampToValueAtTime(level, t + k * 0.05 + 0.01); g.gain.linearRampToValueAtTime(0, t + k * 0.05 + 0.035); }
		o.connect(g).connect(A.master); o.start(t); o.stop(t + 0.2);
	}
	const ease = (param, v, tc = 0.25) => param.setTargetAtTime(v, ctx.currentTime, tc);

	// cam: the camera; o: { night, cars, people, steps, player, under, islandHalf }
	function update(dt, cam, o) {
		if (!setup()) return;
		const x = cam.position.x, z = cam.position.z;
		const U = bay.loaded() ? bay.urbanAt(x, z) : null;
		const alt = cam.position.y - groundAt(x, z);
		const onIsland = Math.max(Math.abs(x), Math.abs(z)) < (o.islandHalf || 0);
		const town = U && !onIsland ? Math.min(1, Math.max(0, (U.u - 0.1) / 0.5)) : 0;
		const near = Math.max(0, 1 - Math.max(0, alt - 3) / 120) * (o.under ? 0 : 1);
		const on = town * near;
		ease(A.master.gain, on > 0.01 ? 1 : 0, 0.6);
		if (on <= 0.01) { lastPos = null; if (o.steps) o.steps.length = 0; return; }
		const busy = U.s === STYLE.sf || U.d > 0.2 ? 1 : U.s === STYLE.retail || U.s === STYLE.office ? 0.7 : U.s === STYLE.older ? 0.45 : 0.3;
		const day = 1 - o.night * 0.6;
		ease(A.bed.g.gain, 0.08 * on * (0.4 + busy) * day);
		ease(A.hum.g.gain, 0.012 * on * busy);
		// the car closest to you (by loudness), Doppler-shifted as it passes
		let best = null, bl = 0;
		const e = cam.matrixWorld.elements, fl = Math.hypot(e[8], e[10]) || 1, fx = -e[8] / fl, fz = -e[10] / fl;
		for (const c of o.cars || []) {
			if (c.px === undefined) continue;
			const dx = c.px - x, dz = c.pz - z, d2 = dx * dx + dz * dz;
			const l = c.v / (1 + d2 / 60);
			if (l > bl) { bl = l; best = { c, dx, dz, d: Math.sqrt(d2) }; }
		}
		if (best) {
			const { c, dx, dz, d } = best;
			const vr = d > 0.1 ? (c.vx * dx + c.vz * dz) / d : 0;           // speed away from you
			const dop = 343 / (343 + vr);
			const right = fz * dx - fx * dz;                                    // + to the right of the view
			ease(A.pan.pan, Math.max(-0.9, Math.min(0.9, -right / (d + 4))), 0.08);
			const l = Math.min(1, c.v / 10) / (1 + d * d / 90) * on;
			ease(A.car.hg.gain, 0.12 * l, 0.1);
			ease(A.car.eg.gain, 0.05 * l, 0.1);
			ease(A.car.hf.frequency, 700 * dop + c.v * 30, 0.1);
			ease(A.car.eo.frequency, (38 + c.v * 3.2) * dop, 0.1);
		} else { ease(A.car.hg.gain, 0); ease(A.car.eg.gain, 0); }
		// your footsteps on the pavement
		const P = o.player;
		if (lastPos && P && P.grounded && !P.flying && !P.swimming) {
			const sp = Math.hypot(x - lastPos.x, z - lastPos.z) / Math.max(dt, 1e-3);
			if (sp > 0.6 && sp < 9) {
				stepAcc += sp * dt;
				const stride = sp > 4 ? 1.5 : 0.75;
				if (stepAcc > stride) { stepAcc = 0; step(0.09 * on, (Math.random() - 0.5) * 0.2, true); }
			}
		}
		lastPos = { x, z };
		// the people's footsteps and voices
		const steps = o.steps || [];                                          // footstep events from the people: { x, z, k }
		for (const e of steps) {
			const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
			if (d < 18) step(0.05 * on * e.k / (1 + d * d / 12), Math.max(-0.8, Math.min(0.8, -(fz * dx - fx * dz) / (d + 2))), false);
		}
		steps.length = 0;
		let talk = 0;
		for (const p of o.people || []) {
			if (!p.active || p.role !== 'chat') continue;
			const d = Math.hypot(p.M.S.pos.x - x, p.M.S.pos.z - z);
			talk += 1 / (1 + d * d / 30);
		}
		walla += (Math.min(1, talk) - walla) * Math.min(1, dt * 2);
		const syll = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * (5.3 + Math.sin(performance.now() / 2100) * 1.7));
		ease(A.voice.vg.gain, 0.05 * walla * on * syll, 0.04);
		ease(A.voice.f1.frequency, 420 + syll * 260 + Math.sin(performance.now() / 700) * 80, 0.05);
		ease(A.voice.f2.frequency, 1200 + (1 - syll) * 700, 0.05);
		// birds by day in the leafy streets, crickets at night in the suburbs
		const leafy = U.s === STYLE.suburb || U.s === STYLE.older ? 1 : U.s === STYLE.sunset ? 0.4 : 0.15;
		birdT -= dt;
		if (birdT < 0) { birdT = 1.5 + Math.random() * 6 / (0.3 + leafy); if (o.night < 0.4) chirp(0.02 * on * leafy, (Math.random() - 0.5) * 1.6); }
		cricketT -= dt;
		if (cricketT < 0) { cricketT = 0.35 + Math.random() * 0.9; if (o.night > 0.6) cricket(0.008 * on * leafy); }
	}
	return { update };
}
