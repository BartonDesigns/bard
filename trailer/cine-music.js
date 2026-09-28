// The trailer's music, seen: evaluated inside the page (after the engine loads), with the
// soundtrack's note timeline in window.__TL (trailer/soundtrack.mjs writes it: every lead
// note, bass note and drum hit, in seconds of the song).
//
//   TRAILER.bands(t)              the faceplate's bass / mid / high at song time t, from the
//                                 same notes the soundtrack plays (kick and bass, lead, hats)
//   TRAILER.tick(t0, t1, taps)    run the song from t0 to t1: the bands go to the world (it
//                                 reads them where it reads the live faceplate,
//                                 L99Continuity.sample), and each lead note in (t0, t1] strikes
//                                 the world at the next of the shot's tap points (screen
//                                 positions, -1..1) through the world's own strike: its
//                                 raycast (music.hitAt) and its ripple (music.ripple)
(() => {
	const TL = window.__TL || { lead: [], bass: [], kick: [], snare: [], hat: [] };
	const now = { bass: 0, mid: 0, high: 0 };
	// the world samples the faceplate here; in the trailer the faceplate is the timeline
	window.L99Continuity = { bands: now, sample: () => now };
	// a struck note's envelope: a fast attack, then an exponential decay of `tau` seconds
	const env = (list, t, tau, look = 4) => {
		let v = 0;
		for (let i = list.length - 1; i >= 0; i--) {
			const d = t - list[i].t;
			if (d < -0.012) continue;
			if (d > tau * look) break;
			v += (list[i].v ?? 1) * (d < 0 ? 1 + d / 0.012 : Math.exp(-d / tau));
		}
		return v;
	};
	const sorted = (a) => (a || []).slice().sort((p, q) => p.t - q.t);
	const L = { lead: sorted(TL.lead), bass: sorted(TL.bass), kick: sorted(TL.kick), snare: sorted(TL.snare), hat: sorted(TL.hat) };
	const sat = (x) => 1 - Math.exp(-x);
	function bands(t) {
		return {
			bass: Math.min(1, sat(env(L.kick, t, 0.22) * 1.6 + env(L.bass, t, 0.3) * 0.7)),
			mid: Math.min(1, sat(env(L.lead, t, 0.35) * 1.2 + env(L.snare, t, 0.15) * 0.5)),
			high: Math.min(1, sat(env(L.hat, t, 0.07) * 1.4 + env(L.lead, t, 0.12) * 0.3)),
		};
	}
	let tapIndex = 0;
	const kinds = { wood: 'wood', stone: 'stone', crystal: 'crystal', soft: 'soft' };
	function strike(w, x, y, kind) {
		const hit = w.music?.hitAt(x, y);
		if (!hit) return false;
		const k = kinds[hit.object?.userData?.material175] || kind || 'soft';
		w.music.ripple(hit, k);
		return true;
	}
	function tick(t0, t1, taps, kind) {
		Object.assign(now, bands(t1));
		const w = window.L99Island?.world?.();
		if (!w || !taps || !taps.length) return 0;
		let n = 0;
		for (const note of L.lead) {
			if (note.t <= t0) continue;
			if (note.t > t1) break;
			const p = taps[tapIndex++ % taps.length];
			// a little scatter round the point, so repeated notes land on fresh spots
			const j = ((tapIndex * 0.618) % 1) - 0.5;
			if (strike(w, p[0] + j * (p[2] || 0.04), p[1] + j * 0.7 * (p[2] || 0.04), kind)) n++;
		}
		return n;
	}
	window.TRAILER = { bands, tick, strike, TL: L };
})();
