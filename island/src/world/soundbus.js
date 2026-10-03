// The one way into the speakers for the world's sounds. Everything plays into the Bard's
// master output (window._masterClip, or its lead bus), so the faceplate's volume, its
// limiter, the recorder and the muffle under water (main.js) all own the mix. Before the
// Bard has made its audio (the island on its own), a quiet context of our own stands in,
// woken by the first touch or key.
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
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { passive: true });

// the world's own level (the Sky & World panel's World sounds): one gain in front of the
// Bard's master for everything the world plays, kept between visits; the music is not in it
let level = (() => { try { const v = parseFloat(localStorage.getItem('l99-worldvol')); return isNaN(v) ? 1 : Math.max(0, Math.min(1.5, v)); } catch { return 1; } })();
const gates = new WeakMap(), live = [];
let air = 1;
// Atmosphere attenuation is transient; it never changes the saved volume or the music.
export function worldAir(v) {
	const next = Math.max(0, Math.min(1, v));
	if (Math.abs(next - air) < .001) return;
	air = next;
	for (const g of live) g.gain.setTargetAtTime(level * air, g.context.currentTime, .15);
}
function gate(ctx, dest) {
	let g = gates.get(dest);
	if (!g) { g = ctx.createGain(); g.gain.value = level * air; g.connect(dest); gates.set(dest, g); live.push(g); }
	return g;
}
export function worldLevel(v) {
	if (v === undefined) return level;
	level = Math.max(0, Math.min(1.5, +v || 0));
	try { localStorage.setItem('l99-worldvol', String(level)); } catch { /* private mode: not kept */ }
	for (const g of live) g.gain.setTargetAtTime(level * air, g.context.currentTime, 0.05);
	return level;
}

// { ctx, out } while there is a running context to play into, else null
export function soundBus() {
	const b = window._masterClip || window.leadBus227, c = b && b.context;
	if (c) return c.state === 'running' ? { ctx: c, out: gate(c, b) } : null;
	return own && own.ctx.state === 'running' ? { ctx: own.ctx, out: gate(own.ctx, own.out) } : null;
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
