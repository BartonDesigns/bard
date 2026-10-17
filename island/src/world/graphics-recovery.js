// One restoration may resume play. A second loss within a minute needs a fresh
// page, not an endless render -> loss -> restore -> render loop.
export const GRAPHICS_RELOAD_REQUIRED = 'GRAPHICS_RELOAD_REQUIRED';
export function graphicsReloadError() {
	return Object.assign(new Error('Graphics could not recover. Reload to continue with simpler graphics.'), { code: GRAPHICS_RELOAD_REQUIRED });
}
export function createGraphicsRecovery({ now = () => Date.now(), windowMs = 60000, timeoutMs = 8000,
	onTimeout = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
	let losses = [], blocked = false, waiting = false, timer = null;
	const waiters = new Set();
	const clear = () => { if (timer != null) clearTimer(timer); timer = null; };
	const settle = (error) => { for (const w of waiters) error ? w.reject(error) : w.resolve(); waiters.clear(); };
	return {
		lost() {
			clear(); waiting = true;
			const at = now(); losses = losses.filter(t => at - t < windowMs); losses.push(at);
			blocked ||= losses.length >= 2;
			if (blocked) settle(graphicsReloadError());
			else {
				timer = setTimer(() => {
					timer = null; blocked = true;
					settle(graphicsReloadError()); onTimeout();
				}, timeoutMs);
				timer?.unref?.(); // Node fixtures must not keep a process alive.
			}
			return blocked;
		},
		restored() { clear(); if (blocked) return false; waiting = false; settle(); return true; },
		// Build phases wait for the existing context, or fail with the same actionable
		// recovery screen. They cannot keep allocating through a reset or open play early.
		wait() { return blocked ? Promise.reject(graphicsReloadError()) : !waiting ? Promise.resolve() : new Promise((resolve, reject) => waiters.add({ resolve, reject })); },
		blocked: () => blocked,
	};
}
