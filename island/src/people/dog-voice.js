// A dog's voice, made as it sounds (no recordings): a whimper is a soft whine that glides up
// and falls away with a little breath through it; a yip is short and bright; a bark here is
// a muffled woof, never a shout; panting is breath in and out through an open mouth. A
// smaller dog is higher. Everything plays into the world's sound bus (world/soundbus.js),
// so the World sounds level owns it, placed left or right of you and quieter and duller
// with distance. (The bus is fetched when the first dog speaks, so this module and the
// favours that use it load anywhere, the tests included.)

let soundBus = null;
// soft noise for breath, made once per audio context
const breaths = new WeakMap();
function noise(ctx) {
	let b = breaths.get(ctx);
	if (b) return b;
	const n = ctx.sampleRate * 2, d = new Float32Array(n);
	let b0 = 0, b1 = 0, b2 = 0;
	for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
	b = ctx.createBuffer(1, n, ctx.sampleRate); b.getChannelData(0).set(d);
	breaths.set(ctx, b);
	return b;
}

const pitchOf = (size) => Math.pow(0.57 / Math.max(0.2, size || 0.57), 0.55);

// an envelope on a gain: points [time, level] from t, ramped between
function env(g, t, pts) {
	g.gain.setValueAtTime(0.0001, t);
	for (const [dt, v] of pts) g.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + dt);
}
// a voiced sound: a tone gliding along f (pairs of [time, Hz]), through a formant or two
function tone(ctx, out, t, f, { type = 'triangle', forms = [[1400, 3]], lp = 3200, level = [], vib = 0 } = {}) {
	const o = ctx.createOscillator(), g = ctx.createGain(), low = ctx.createBiquadFilter(), end = f[f.length - 1][0];
	o.type = type;
	o.frequency.setValueAtTime(f[0][1], t);
	for (const [dt, hz] of f.slice(1)) o.frequency.exponentialRampToValueAtTime(hz, t + dt);
	low.type = 'lowpass'; low.frequency.value = lp; low.Q.value = 0.5;
	const sum = ctx.createGain(); sum.gain.value = 1;
	for (const [hz, q] of forms) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q; o.connect(bp); bp.connect(sum); }
	if (vib) { const l = ctx.createOscillator(), d = ctx.createGain(); l.frequency.value = 5.5 + Math.random(); d.gain.value = vib; l.connect(d); d.connect(o.frequency); l.start(t); l.stop(t + end + 0.05); }
	sum.connect(low); low.connect(g); g.connect(out);
	env(g, t, level);
	o.start(t); o.stop(t + end + 0.05);
	return end;
}
// breath: coloured noise through a band, shaped
function breath(ctx, out, t, dur, hz, q, level) {
	const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
	s.buffer = noise(ctx); s.loop = true;
	bp.type = 'bandpass'; bp.frequency.value = hz; bp.Q.value = q;
	s.connect(bp); bp.connect(g); g.connect(out);
	env(g, t, level);
	s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
	return dur;
}

// the sounds: each from time t into out; returns how long it lasts
export const VOICE = {
	// two or three soft whines, rising and falling away
	whimper(ctx, out, t, size) {
		const k = pitchOf(size);
		let at = 0;
		const n = 2 + (Math.random() < 0.4 ? 1 : 0);
		for (let i = 0; i < n; i++) {
			const d = 0.45 + Math.random() * 0.35, f0 = (560 + Math.random() * 120) * k, top = f0 * (1.45 + Math.random() * 0.25);
			tone(ctx, out, t + at, [[0, f0], [d * 0.35, top], [d * 0.7, top * 0.92], [d, f0 * 0.82]], { type: 'triangle', forms: [[1250 * k, 2.5], [2500 * k, 4]], lp: 2800, vib: 9 * k, level: [[0.07, 0.05], [d * 0.6, 0.045], [d, 0]] });
			breath(ctx, out, t + at, d, 2200 * k, 0.8, [[0.05, 0.008], [d * 0.7, 0.006], [d, 0]]);
			at += d + 0.12 + Math.random() * 0.1;
		}
		return at;
	},
	// a short bright yip
	yip(ctx, out, t, size) {
		const k = pitchOf(size), d = 0.1 + Math.random() * 0.03, f0 = (820 + Math.random() * 120) * k;
		tone(ctx, out, t, [[0, f0], [d * 0.3, f0 * 1.55], [d, f0 * 1.05]], { type: 'sawtooth', forms: [[1700 * k, 2], [900 * k, 1.5]], lp: 3600, level: [[0.008, 0.06], [d * 0.5, 0.035], [d, 0]] });
		breath(ctx, out, t, 0.03, 3000, 0.7, [[0.004, 0.012], [0.03, 0]]);
		return d;
	},
	// a soft woof
	bark(ctx, out, t, size) {
		const k = pitchOf(size), d = 0.2, f0 = 240 * k;
		tone(ctx, out, t, [[0, f0], [0.04, f0 * 1.6], [d, f0 * 0.9]], { type: 'sawtooth', forms: [[650 * k, 1.4], [1500 * k, 2.2]], lp: 1900, level: [[0.012, 0.07], [0.08, 0.045], [d, 0]] });
		breath(ctx, out, t, d, 900 * k, 1, [[0.01, 0.02], [0.08, 0.01], [d, 0]]);
		return d;
	},
	// one breath in and out through the open mouth
	pant(ctx, out, t, size) {
		const k = pitchOf(size);
		breath(ctx, out, t, 0.11, 1700 * k, 1.3, [[0.03, 0.012], [0.11, 0]]);
		breath(ctx, out, t + 0.12, 0.13, 1150 * k, 1.1, [[0.03, 0.016], [0.13, 0]]);
		return 0.25;
	},
};

// in the world: placed by where the dog is from the camera
export function createDogVoice(camera) {
	const live = new Set();
	let pantT = 0;
	if (!soundBus) import('../world/soundbus.js').then((m) => { soundBus = m.soundBus; }).catch(() => {});
	function play(kind, at, size = 0.57) {
		const B = soundBus?.(), make = VOICE[kind];
		if (!B || !make || live.size > 24) return;
		const { ctx, out } = B, c = camera.position, dx = at.x - c.x, dz = at.z - c.z, d = Math.hypot(dx, dz, at.y - c.y);
		if (d > 45) return;
		const e = camera.matrixWorld.elements, side = (dx * e[0] + dz * e[2]) / (Math.hypot(dx, dz) || 1);
		const g = ctx.createGain(), p = ctx.createStereoPanner(), lp = ctx.createBiquadFilter();
		g.gain.value = 0.9 / (1 + d / 4); p.pan.value = Math.max(-0.85, Math.min(0.85, side * 0.85));
		lp.type = 'lowpass'; lp.frequency.value = 9000 / (1 + d / 10);
		lp.connect(g); g.connect(p); p.connect(out);
		const node = { g, p, lp };
		live.add(node);
		const dur = make(ctx, lp, ctx.currentTime + 0.02, size);
		setTimeout(() => { lp.disconnect(); g.disconnect(); p.disconnect(); live.delete(node); }, (dur + 0.4) * 1000);
	}
	// panting, a breath every quarter second while it runs or is happy, close by only
	function pant(dt, on, at, size) {
		if (!on) { pantT = 0; return; }
		pantT -= dt;
		if (pantT <= 0) { pantT = 0.26 + Math.random() * 0.05; if (Math.hypot(at.x - camera.position.x, at.z - camera.position.z) < 14) play('pant', at, size); }
	}
	function dispose() { for (const n of live) { n.lp.disconnect(); n.g.disconnect(); n.p.disconnect(); } live.clear(); }
	return { play, pant, dispose, info: () => ({ voices: live.size }) };
}

// for the review: each sound rendered offline to a 16-bit WAV, as base64
export async function renderDogSounds(sizes = [0.57, 0.27]) {
	const out = {}, rate = 44100;
	const scripts = {
		whimper: (ctx, o, s) => { let t = 0.1; for (let i = 0; i < 3; i++) t += VOICE.whimper(ctx, o, t, s) + 0.5; return t; },
		yips: (ctx, o, s) => { let t = 0.1; for (let i = 0; i < 6; i++) t += VOICE.yip(ctx, o, t, s) + 0.18 + Math.random() * 0.2; return t; },
		bark: (ctx, o, s) => { let t = 0.1; for (let i = 0; i < 3; i++) t += VOICE.bark(ctx, o, t, s) + 0.45; return t; },
		pant: (ctx, o, s) => { let t = 0.1; while (t < 3) t += VOICE.pant(ctx, o, t, s) + 0.02; return t; },
		reunion: (ctx, o, s) => { let t = 0.1; t += VOICE.whimper(ctx, o, t, s) + 0.6; t += VOICE.bark(ctx, o, t, s) + 0.5; for (let i = 0; i < 5; i++) t += VOICE.yip(ctx, o, t, s) + 0.25; while (t < 7.5) t += VOICE.pant(ctx, o, t, s) + 0.02; return t; },
	};
	for (const size of sizes) for (const [name, run] of Object.entries(scripts)) {
		const ctx = new OfflineAudioContext(1, rate * 9, rate), g = ctx.createGain();
		g.gain.value = 2.2; g.connect(ctx.destination);
		const len = run(ctx, g, size) + 0.4, buf = await ctx.startRendering(), n = Math.min(buf.length, Math.ceil(len * rate)), data = buf.getChannelData(0);
		let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
		const wav = new DataView(new ArrayBuffer(44 + n * 2)), str = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
		str(0, 'RIFF'); wav.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true);
		wav.setUint32(24, rate, true); wav.setUint32(28, rate * 2, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); str(36, 'data'); wav.setUint32(40, n * 2, true);
		// (brought up to a listenable level for the file; in the world it plays as made)
		const gain = peak > 0 ? 0.7 / peak : 1;
		for (let i = 0; i < n; i++) wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i] * gain)) * 32767, true);
		let bin = ''; const bytes = new Uint8Array(wav.buffer);
		for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		out[`dog-${size > 0.4 ? 'big' : 'small'}-${name}.wav`] = { b64: btoa(bin), seconds: +(n / rate).toFixed(2), peak: +peak.toFixed(3) };
	}
	return out;
}
