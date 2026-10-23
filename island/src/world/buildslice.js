// How long a frame may spend building what streams in round you (a house's rooms, a building's
// interior, its light). A fixed few milliseconds a frame builds at the frame rate's pace: on a
// phone drawing the city at 15 frames a second that was a quarter of a computer's, and a
// building's rooms took the best part of ten seconds to come in. This gives the builders the
// same share of the time whatever the frame rate: their own few milliseconds when frames are
// quick, about an eighth of a slow frame (never more than a capped slice) when they are not.
//   buildSlice(dt, base)   ms for this frame; dt the frame's seconds, base the builder's own
const SHARE = 0.12, CAP = 9;

export function buildSlice(dt, base) {
	return Math.max(base, Math.min(CAP, (dt || 0) * 1000 * SHARE));
}

// what to build first among things at distance d: the nearest, and of those near alike, the
// ones in front of you (a building behind you counts as further off)
export function viewDistance(d, x, z, cam, fwd) {
	const dx = x - cam.x, dz = z - cam.z, L = Math.hypot(dx, dz);
	if (L < 1e-3 || !fwd) return d;
	const ahead = (dx * fwd.x + dz * fwd.z) / (L * (Math.hypot(fwd.x, fwd.z) || 1));
	return ahead > 0.2 ? d : d * 1.6 + 15;
}

// A build laid out in steps (a generator that yields between them) run for this frame's share:
// steps until the budget is spent or the build is done. Every step runs whole, so a frame may
// go over by one step; what the build makes is the same whatever the budget, only spread over
// more frames. Returns true once the generator is done.
//   runSteps(gen, ms, now)   now: the clock (performance.now by default), for tests
// the same steps run whole, at once (the synchronous callers, and the tests)
export function runAll(gen) {
	for (;;) { const r = gen.next(); if (r.done) return r.value; }
}
export function runSteps(gen, ms, now = () => performance.now()) {
	const t0 = now();
	do { if (gen.next().done) return true; } while (now() - t0 < ms);
	return false;
}
