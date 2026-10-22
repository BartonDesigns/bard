// One beat for everything that moves to the music: the people nodding, the dancers' feet,
// the crowd's hands, your own body when you dance. Counted from the music's own clock,
// never from a frame timer, and at the moment the beat is heard (the audio output's lag, a
// Bluetooth headset's 150 ms included), so a dip lands with the kick, not before it.
//
// Sources, in turn: the auto music's bar clock while it plays (music/automusic.js clock():
// the faceplate's sequencer drives it when that runs), the faceplate's sequencer on its own
// (the steps' audio times in window._seqRing), and the faceplate's tempo for half a minute
// after you last played a note (as your footsteps already keep it). wireBeat() hands in the
// auto music; beatNow() answers the same object each call, filled in place.

const BEAT = {
	playing: false,      // a beat to move to right now
	bpm: 0, period: 0.6, // seconds a beat
	beat: 0,             // beats since the bar the clock counts from (continuous: 2.25 is a quarter past the third)
	phase: 0,            // 0..1 through the beat (0 on it)
	bar: 0,              // 0..1 through a four-beat bar
	on: 0,               // 0..1: the music's hold on the people, eased in over a second and out over two
	energy: 0,           // the score's energy (0..1), for how big the moves are
	at: 0,               // page time (ms) of the bar's first beat, as heard
	stamp: -1,
};
let source = null, pulse = null, onAt = 0;
export function wireBeat(clock, energy) { source = clock; pulse = energy; BEAT.stamp = -1; }
const bardCtx = () => (window._masterClip || window.leadBus227)?.context || null;
// the faceplate's sequencer running by itself: its last step's audio time, mapped to the page
function seqClock() {
	const st = window.autoSynth?.state?.(), ring = window._seqRing, C = window.L99Clock, ctx = bardCtx();
	if (!st?.sequencerRunning || !ring?.length || !C || !ctx || !(st.bpm > 0)) return null;
	const last = ring[ring.length - 1], period = 60 / st.bpm;
	// (steps are sixteenths: four a beat, sixteen a bar)
	return { period, at: C.perfAt(ctx, last.at) - (last.step % 16) * period * 250 };
}
export function beatNow(nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
	if (nowMs - BEAT.stamp < 4 && nowMs >= BEAT.stamp) return BEAT;
	const dt = BEAT.stamp < 0 ? 0 : Math.min(0.25, (nowMs - BEAT.stamp) / 1000);
	BEAT.stamp = nowMs;
	let B = null;
	try { B = source?.() || seqClock(); } catch { B = null; }
	if (B && B.period > 0.15 && B.period < 2.5 && Number.isFinite(B.at)) {
		// the auto music's bar clock is the step's scheduled time; it is heard an output lag later
		let lag = 0;
		try { const ctx = bardCtx(); lag = B.heard ? 0 : (ctx && window.L99Clock ? window.L99Clock.lag(ctx) * 1000 : 0); } catch { lag = 0; }
		BEAT.playing = true;
		BEAT.period = B.period; BEAT.bpm = 60 / B.period;
		BEAT.at = B.at + lag;
		const b = (nowMs - BEAT.at) / 1000 / B.period;
		BEAT.beat = b;
		BEAT.phase = b - Math.floor(b);
		BEAT.bar = (b / 4) - Math.floor(b / 4);
		let e = 0;
		try { const P = pulse?.(); e = P?.playing ? (P.energy || 0) : 0.5; } catch { e = 0.5; }
		BEAT.energy += (e - BEAT.energy) * Math.min(1, dt * 1.5);
		if (!onAt) onAt = nowMs;
		BEAT.on = Math.min(1, BEAT.on + dt / 1.2);
	} else {
		BEAT.playing = false;
		onAt = 0;
		BEAT.on = Math.max(0, BEAT.on - dt / 2);
		BEAT.energy *= Math.max(0, 1 - dt);
		// (the count goes on at the last tempo while the hold eases off, so nobody freezes mid-step)
		const b = BEAT.beat + dt / BEAT.period;
		BEAT.beat = b; BEAT.phase = b - Math.floor(b); BEAT.bar = (b / 4) - Math.floor(b / 4);
	}
	return BEAT;
}
// how deep into the beat a body sinks: deepest on the beat, up again between (a bounce, not
// a wave: the body hangs at the top and drops into the hit)
export const dip = (phase) => { const c = 0.5 + 0.5 * Math.cos(phase * Math.PI * 2); return c * c * (1.5 - 0.5 * c); };
