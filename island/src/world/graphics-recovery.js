// One restoration may resume play. A second loss within a minute needs a fresh
// page, not an endless render -> loss -> restore -> render loop.
export const GRAPHICS_RELOAD_REQUIRED = 'GRAPHICS_RELOAD_REQUIRED';
export function graphicsReloadError() {
	return Object.assign(new Error('Graphics reset repeatedly. Reload to continue with simpler graphics.'), { code: GRAPHICS_RELOAD_REQUIRED });
}
export function createGraphicsRecovery({ now = () => Date.now(), windowMs = 60000 } = {}) {
	let losses = [], blocked = false;
	return {
		lost() { const at = now(); losses = losses.filter(t => at - t < windowMs); losses.push(at); blocked ||= losses.length >= 2; return blocked; },
		blocked: () => blocked,
	};
}
