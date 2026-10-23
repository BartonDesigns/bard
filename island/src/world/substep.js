// Your own movement keeps real time on a slow phone. The world's systems take at most CAP
// seconds a frame (a slow frame slows the world rather than letting its physics tunnel), but
// at 8 frames a second that cap alone ran everything at 40% speed, flight included. So the
// movement (walking, flying, driving) is stepped in pieces of at most CAP until the real time
// since the last frame is used up: the same distance per real second as at 60 fps, with each
// piece no bigger than the physics was written for. Beyond MOST pieces the rest is let go (a
// frame that took longer than that was a stall, not play).
export const CAP = 0.05;
export const MOST = 5;
export function moveSteps(elapsed, cap = CAP, most = MOST) {
	const out = [];
	for (let left = Math.min(elapsed, cap * most); left > 1e-4 && out.length < most; left -= cap) out.push(Math.min(cap, left));
	return out.length ? out : [Math.max(0, elapsed)];
}
