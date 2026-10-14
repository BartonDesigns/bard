// The one way into the speakers for the world's sounds. Everything plays into the Bard's
// master ahead of its peak guard (window._peakInput177), so the guard holds the music and the
// world together under one ceiling, and the faceplate's volume, the recorder and the muffle
// under water (main.js) all own the mix. (The world once went in after the guard, and a loud
// moment on top of a full mix went past full scale: the clipping.) On the way the world has a
// gentle compressor of its own, and it steps back a little while music plays, so the music
// keeps its level. Before the Bard has made its audio (the island on its own), a quiet
// context of our own stands in, woken by the first touch or key.
//
// The world's ambience and footsteps go a step further, through audio/acoustics.js's mix (an
// ambience master, the feet, and the room's reverberation) before they reach it.
//
// Noise buffers are made once per context and shared by every module that asks:
//   white, pink (rain, wind, surf wash), brown (rumble, roar, the city's bed)

let own = null;
const hasBard = () => !!(window._masterClip || window.leadBus227);
function wake() {
	if (hasBard()) return;
	if (own) { if (own.ctx.state === 'suspended') own.ctx.resume(); return; }
	try { const c = new (window.AudioContext || window.webkitAudioContext)(); own = { ctx: c, out: c.destination }; } catch { own = null; }
}
if (typeof addEventListener === 'function') for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { passive: true });

// ---- the world's bus and the voices' bus, one each per context
const buses = new WeakMap();
let ducking = 0;
function into(c) {
	const g = window._peakInput177, m = window._masterClip || window.leadBus227;
	return g && g.context === c ? g : m && m.context === c ? m : null;
}
function busFor(c) {
	const dest = into(c);
	if (!dest) return null;
	let B = buses.get(c);
	if (!B) {
		const world = c.createGain(), comp = c.createDynamicsCompressor(), duck = c.createGain(), voice = c.createGain();
		// (a gunshot, an engine, a crash: their edge taken off before they reach the music)
		comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
		world.connect(comp).connect(duck);
		B = { world, duck, voice, dest: null, k: 1 };
		buses.set(c, B);
		live.push(B);
		if (!ducking) ducking = setInterval(duckAll, 120);
	}
	if (B.dest !== dest) {
		try { B.duck.disconnect(); B.voice.disconnect(); } catch { /* not yet connected */ }
		B.duck.connect(dest); B.voice.connect(dest); B.dest = dest;
	}
	return B;
}
// how far the world steps back: about 3 dB while music plays, and further while the peak
// guard is having to hold the total down
export function duckTarget(musicOn, reduction) {
	let k = musicOn ? 0.7 : 1;
	if (reduction < -1.5) k *= Math.pow(10, (reduction + 1.5) / 20);
	return Math.max(0.4, Math.min(1, k));
}
function duckAll() {
	const now = Date.now();
	const musicOn = (window._musicEnergy || 0) > 0.04 || now - (window._musicLastAt || 0) < 1500 || !!window._specialDrumsActive;
	let red = 0;
	try { red = Number(window.L99Peak177?.state?.().reduction) || 0; } catch { /* no guard yet */ }
	const k = duckTarget(musicOn, red);
	for (const B of live) {
		if (!B.duck || Math.abs(k - B.k) < 0.01) continue;
		const c = B.duck.context;
		B.duck.gain.setTargetAtTime(k, c.currentTime, k < B.k ? 0.06 : 0.5);
		B.k = k;
	}
}

// the world's own level (the Sky & World panel's World sounds): one gain in front of the
// Bard's master for everything the world plays, kept between visits; the music is not in it
let level = (() => { try { const v = parseFloat(localStorage.getItem('l99-worldvol')); return isNaN(v) ? 1 : Math.max(0, Math.min(1.5, v)); } catch { return 1; } })();
const gates = new WeakMap(), live = [], levels = [];
let air = 1;
// Atmosphere attenuation is transient; it never changes the saved volume or the music.
export function worldAir(v) {
	const next = Math.max(0, Math.min(1, v));
	if (Math.abs(next - air) < .001) return;
	air = next;
	for (const g of levels) g.gain.setTargetAtTime(level * air, g.context.currentTime, .15);
}
function gate(ctx, dest) {
	let g = gates.get(dest);
	if (!g) { g = ctx.createGain(); g.gain.value = level * air; g.connect(dest); gates.set(dest, g); levels.push(g); }
	return g;
}
export function worldLevel(v) {
	if (v === undefined) return level;
	level = Math.max(0, Math.min(1.5, +v || 0));
	try { localStorage.setItem('l99-worldvol', String(level)); } catch { /* private mode: not kept */ }
	for (const g of levels) g.gain.setTargetAtTime(level * air, g.context.currentTime, 0.05);
	for (const g of cabinLevels) g.gain.setTargetAtTime(level, g.context.currentTime, 0.05);
	return level;
}

// { ctx, out } while there is a running context to play into, else null
export function soundBus() {
	if (typeof window === 'undefined') return null;
	const b = window._masterClip || window.leadBus227, c = b && b.context;
	if (c) { const B = c.state === 'running' && busFor(c); return B ? { ctx: c, out: gate(c, B.world) } : null; }
	return own && own.ctx.state === 'running' ? { ctx: own.ctx, out: gate(own.ctx, own.out) } : null;
}
// an effect on the music itself (a trip's reverb, a stretch): taken from the music ahead of
// the master and given back ahead of the peak guard, so its return is held under the ceiling
// too (no loop: the guard's input is downstream of where it is taken)
export function musicSend() {
	if (typeof window === 'undefined') return null;
	const m = window._masterClip, c = m?.context;
	if (!c || c.state !== 'running') return null;
	const from = window._dcFilter, to = window._peakInput177;
	if (from?.context === c && to?.context === c) return { ctx: c, from, to };
	return { ctx: c, from: m, to: c.destination };
}
// the ship's own sounds (its thrusters, its cabin): under the world's volume but not the air's,
// so they carry on in space, where everything outside falls silent
const cabins = new WeakMap(), cabinLevels = [];
function cabinGate(ctx, dest) {
	let g = cabins.get(dest);
	if (!g) { g = ctx.createGain(); g.gain.value = level; g.connect(dest); cabins.set(dest, g); cabinLevels.push(g); }
	return g;
}
export function cabinOut() {
	if (typeof window === 'undefined') return null;
	const b = window._masterClip || window.leadBus227, c = b && b.context;
	if (c) { const B = c.state === 'running' && busFor(c); return B ? { ctx: c, out: cabinGate(c, B.world) } : null; }
	return own && own.ctx.state === 'running' ? { ctx: own.ctx, out: cabinGate(own.ctx, own.out) } : null;
}
// the world's way in for a module that wants the node itself (its .context is the context)
export function worldOut() { return soundBus()?.out || null; }
// spoken voices: into the same master, never ducked, not under the world's volume
export function voiceBus() {
	if (typeof window === 'undefined') return null;
	const b = window._masterClip || window.leadBus227, c = b && b.context;
	const B = c && c.state === 'running' && busFor(c);
	return B ? { ctx: c, out: B.voice } : null;
}

const cache = new WeakMap();
// a looping noise buffer of the given colour, four seconds long, made once per context
export function noise(ctx, colour = 'white') {
	let m = cache.get(ctx);
	if (!m) cache.set(ctx, m = {});
	if (m[colour]) return m[colour];
	// (made a little long, and the overhang cross-faded into the start, so the loop has no click)
	const len = ctx.sampleRate * 4, n = Math.floor(ctx.sampleRate * 0.05), d = new Float32Array(len + n);
	let b0 = 0, b1 = 0, b2 = 0, last = 0;
	for (let i = 0; i < d.length; i++) {
		const w = Math.random() * 2 - 1;
		if (colour === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
		else if (colour === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
		else d[i] = w;
	}
	for (let i = 0; i < n; i++) { const k = i / n; d[i] = d[i] * k + d[len + i] * (1 - k); }
	const b = ctx.createBuffer(1, len, ctx.sampleRate);
	b.getChannelData(0).set(d.subarray(0, len));
	return (m[colour] = b);
}
