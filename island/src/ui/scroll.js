// Menus that scroll under a finger everywhere. The world under them takes every touch
// (touch-action: none), and iOS Safari lets that switch off native scrolling in the
// panels on top, so a panel is scrolled here by hand: it follows the finger, then
// coasts to a stop. A tap that doesn't move still clicks its button.

export function scrollable(el) {
	let y0 = 0, s0 = 0, lastY = 0, lastT = 0, v = 0, moved = false, raf = 0;
	const coast = () => {
		v *= 0.95;
		el.scrollTop -= v * 16;
		raf = Math.abs(v) > 0.02 ? requestAnimationFrame(coast) : 0;
	};
	el.addEventListener('touchstart', (e) => {
		e.stopPropagation();
		if (e.touches.length !== 1) return;
		cancelAnimationFrame(raf); raf = 0;
		y0 = lastY = e.touches[0].clientY; s0 = el.scrollTop; lastT = performance.now(); v = 0; moved = false;
	}, { passive: true });
	el.addEventListener('touchmove', (e) => {
		e.stopPropagation();
		if (e.touches.length !== 1) return;
		const y = e.touches[0].clientY, now = performance.now();
		if (!moved && Math.abs(y - y0) < 6) return;
		moved = true;
		if (e.cancelable) e.preventDefault();
		el.scrollTop = s0 - (y - y0);
		const dt = Math.max(1, now - lastT);
		v = v * 0.4 + ((y - lastY) / dt) * 0.6;
		lastY = y; lastT = now;
	}, { passive: false });
	el.addEventListener('touchend', (e) => {
		e.stopPropagation();
		if (moved && Math.abs(v) > 0.05) raf = requestAnimationFrame(coast);
	}, { passive: true });
	// a drag is not a tap: swallow the click that would otherwise fire on release
	el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
	el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
	return el;
}
