// The services' sounds, through the world's one way into the speakers (world/soundbus.js):
// the sirens of the ambulances and fire engines (their wail rising and falling, panned and
// faded with distance), the radios crackling in a comms room or a station's watch room, and
// the monitors' beeps beside the beds. All made here from oscillators and noise.

import { soundBus, noise } from '../world/soundbus.js';

// a siren: start() once; set(gain 0..1, pan -1..1) each frame; stop() when it is done
export function createSiren(kind = 'ambulance') {
	let S = null;
	function start() {
		const B = soundBus();
		if (!B || S) return !!S;
		const c = B.ctx, osc = c.createOscillator(), osc2 = c.createOscillator(), lfo = c.createOscillator(), depth = c.createGain(), mix = c.createGain(), pan = c.createStereoPanner ? c.createStereoPanner() : null, out = c.createGain();
		osc.type = 'sawtooth'; osc2.type = 'square';
		// the wail: about 650 to 1500 Hz and back, a few seconds round (an engine's slower, lower)
		const lo = kind === 'engine' ? 520 : 660, hi = kind === 'engine' ? 1250 : 1480;
		osc.frequency.value = (lo + hi) / 2; osc2.frequency.value = (lo + hi) / 4;
		lfo.type = 'sine'; lfo.frequency.value = kind === 'engine' ? 0.22 : 0.3;
		depth.gain.value = (hi - lo) / 2;
		lfo.connect(depth); depth.connect(osc.frequency);
		const d2 = c.createGain(); d2.gain.value = (hi - lo) / 4; depth.connect(d2); d2.connect(osc2.frequency);
		const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
		mix.gain.value = 0.5;
		osc.connect(mix); osc2.connect(mix); mix.connect(tone);
		out.gain.value = 0;
		if (pan) { tone.connect(pan); pan.connect(out); } else tone.connect(out);
		out.connect(B.out);
		osc.start(); osc2.start(); lfo.start();
		S = { c, osc, osc2, lfo, out, pan };
		return true;
	}
	function set(gain, p = 0) {
		if (!S) return;
		const t = S.c.currentTime;
		S.out.gain.setTargetAtTime(Math.max(0, Math.min(0.35, gain)), t, 0.08);
		if (S.pan) S.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, p)), t, 0.08);
	}
	function stop() {
		if (!S) return;
		const s = S; S = null;
		try { s.out.gain.setTargetAtTime(0, s.c.currentTime, 0.1); setTimeout(() => { try { s.osc.stop(); s.osc2.stop(); s.lfo.stop(); s.out.disconnect(); } catch { /* already stopped */ } }, 600); } catch { /* the context went away */ }
	}
	return { start, set, stop, get on() { return !!S; } };
}

// a burst of radio: the squelch, a voice-shaped band of noise, the squelch again
export function radioBurst(gain = 0.06, pan = 0) {
	const B = soundBus();
	if (!B) return;
	const c = B.ctx, t = c.currentTime, len = 0.6 + Math.random() * 1.6;
	const src = c.createBufferSource(); src.buffer = noise(c, 'white'); src.loop = true;
	const band = c.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1300; band.Q.value = 1.4;
	const g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(gain * 1.4, t + 0.02);
	// (the voice: the band wavers as syllables would)
	for (let k = 0.08; k < len; k += 0.11 + Math.random() * 0.09) { g.gain.linearRampToValueAtTime(gain * (0.35 + Math.random() * 0.65), t + k); band.frequency.linearRampToValueAtTime(900 + Math.random() * 900, t + k); }
	g.gain.linearRampToValueAtTime(gain * 1.2, t + len + 0.02);
	g.gain.linearRampToValueAtTime(0, t + len + 0.12);
	src.connect(band); band.connect(g);
	if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(B.out); } else g.connect(B.out);
	src.start(t); src.stop(t + len + 0.2);
	src.onended = () => { try { g.disconnect(); p?.disconnect(); } catch { /* gone */ } };
}

// a monitor's beep beside a bed
export function monitorBeep(gain = 0.03, pan = 0) {
	const B = soundBus();
	if (!B) return;
	const c = B.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
	o.type = 'sine'; o.frequency.value = 960;
	g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.linearRampToValueAtTime(0, t + 0.12);
	o.connect(g);
	if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(B.out); } else g.connect(B.out);
	o.start(t); o.stop(t + 0.15);
	o.onended = () => { try { g.disconnect(); p?.disconnect(); } catch { /* gone */ } };
}
