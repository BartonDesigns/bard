// The Boardwalk's sounds, made on the spot: the lift chain's clack, the wind and the
// rumble of the wheels on the wood, screams on the drops, the thump of bumper cars and the
// crackle of their poles on the ceiling grid, and the band organ's notes. Everything goes
// through one bus into the Bard's own output, and only once its sound is running.

export function createSound() {
	let ctx = null, bus = null, noise = null;
	function get() {
		const b = window._masterClip || window.leadBus227, c = b?.context;
		if (!c || c.state !== 'running') return null;
		if (!bus || ctx !== c) {
			ctx = c; noise = null;
			bus = c.createGain(); bus.gain.value = 0.85;
			const comp = c.createDynamicsCompressor();
			comp.threshold.value = -14; comp.ratio.value = 4;
			bus.connect(comp); comp.connect(b);
		}
		return bus;
	}
	function noiseBuf() {
		if (noise) return noise;
		const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
		for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
		return (noise = buf);
	}
	// a steady noise through a filter, its level and pitch set every frame (wind, rumble, surf)
	function loop(type = 'bandpass', f = 800, q = 0.7) {
		let src = null, flt = null, g = null;
		const L = {
			set(gain, freq) {
				const out = get();
				if (!out) return;
				if (!src) {
					src = ctx.createBufferSource(); src.buffer = noiseBuf(); src.loop = true;
					src.playbackRate.value = 0.8 + Math.random() * 0.4;
					flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
					g = ctx.createGain(); g.gain.value = 0;
					src.connect(flt); flt.connect(g); g.connect(out); src.start();
				}
				g.gain.setTargetAtTime(Math.max(0, gain), ctx.currentTime, 0.08);
				if (freq) flt.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
			},
			stop() { if (src) { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); src.stop(ctx.currentTime + 0.5); } catch { /* already stopped */ } src = null; } },
		};
		return L;
	}
	// a short knock of filtered noise (a chain dog on its ratchet, a wheel over a rail joint)
	function click(gain = 0.3, f = 1800, q = 3, dur = 0.05, at = 0) {
		const out = get();
		if (!out) return;
		const t = ctx.currentTime + at;
		const s = ctx.createBufferSource(); s.buffer = noiseBuf();
		const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		s.connect(fl); fl.connect(g); g.connect(out);
		s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
	}
	// a voice on a drop: a glide up and down through the vowel's two formants
	function scream(gain = 0.2, pitch = 700, len = 1.6) {
		const out = get();
		if (!out) return;
		const t = ctx.currentTime;
		const o = ctx.createOscillator(); o.type = 'sawtooth';
		o.frequency.setValueAtTime(pitch * 0.8, t); o.frequency.linearRampToValueAtTime(pitch * 1.15, t + 0.25); o.frequency.linearRampToValueAtTime(pitch * 0.85, t + len);
		const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.5 + Math.random() * 2; vg.gain.value = pitch * 0.03;
		vib.connect(vg); vg.connect(o.frequency);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.12); g.gain.setTargetAtTime(0, t + len * 0.7, len * 0.15);
		for (const [f, q, k] of [[900 + Math.random() * 200, 6, 1], [1500 + Math.random() * 300, 8, 0.6], [2800, 10, 0.25]]) {
			const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
			const bg = ctx.createGain(); bg.gain.value = k;
			o.connect(b); b.connect(bg); bg.connect(g);
		}
		g.connect(out);
		o.start(t); vib.start(t); o.stop(t + len + 0.5); vib.stop(t + len + 0.5);
	}
	// the thump of two rubber bumpers meeting
	function thump(gain = 0.5) {
		const out = get();
		if (!out) return;
		const t = ctx.currentTime;
		const o = ctx.createOscillator(); o.type = 'sine';
		o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
		const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
		o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
		click(gain * 0.5, 600, 1.2, 0.08);
	}
	// the crackle of a pole's shoe on the ceiling grid
	function crackle(gain = 0.08) {
		for (let k = 0; k < 3; k++) click(gain * (0.5 + Math.random()), 4000 + Math.random() * 3000, 1.5, 0.012 + Math.random() * 0.02, k * (0.01 + Math.random() * 0.03));
	}
	// a pipe of the band organ: a few detuned partials through a soft filter
	function pipe(freq, at, dur, gain = 0.05, kind = 'flute') {
		const out = get();
		if (!out) return;
		const t = ctx.currentTime + at;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.setValueAtTime(gain, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'bass' ? 700 : kind === 'bell' ? 6000 : 2600; lp.Q.value = 0.6;
		lp.connect(g); g.connect(out);
		const waves = kind === 'bell' ? [['sine', 1, 1], ['sine', 2.76, 0.3], ['sine', 5.4, 0.12]] : kind === 'bass' ? [['sawtooth', 1, 0.7], ['square', 0.5, 0.4]] : [['square', 1, 0.45], ['sawtooth', 1.003, 0.35], ['sine', 2, 0.25]];
		for (const [type, m, k] of waves) {
			const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * m;
			const og = ctx.createGain(); og.gain.value = k;
			o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.05);
		}
		if (kind === 'bell') g.gain.setTargetAtTime(0, t + 0.05, dur * 0.35);
	}
	return { get, loop, click, scream, thump, crackle, pipe, now: () => ctx?.currentTime || 0 };
}
