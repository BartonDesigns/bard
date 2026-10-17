import { STORE_KEY, readRecord, lossRecord } from './governor.js';

export const GRAPHICS_UNAVAILABLE = '3D graphics could not start, even with lighter settings. Try closing other 3D tabs and reopening Bard. If this keeps happening, restart the browser.';
export function graphicsMode(storage) {
	try { const v = storage?.getItem('l99-quality'); return ['auto', 'high', 'low'].includes(v) ? v : 'auto'; } catch { return 'auto'; }
}
export function recentGraphicsLoss(storage, now = Date.now()) {
	try { const at = Number(storage?.getItem('l99-gl-lost')); return at > 0 && now >= at && now - at < 86400000; } catch { return false; }
}
export function rememberGraphicsLoss(storage, now = Date.now()) {
	try {
		storage?.setItem('l99-gl-lost', String(now));
		storage?.setItem(STORE_KEY, JSON.stringify(lossRecord(readRecord(storage.getItem(STORE_KEY)), now, 1)));
	} catch { /* storage can be disabled */ }
}

// Cap total pixels as well as DPR: Retina/4K screens otherwise multiply GPU work
// and framebuffer memory before the governor gets a chance to measure anything.
export function renderRatio({ width, height, dpr = 1, ratio = 1, phone = false, safe = false, mode = 'auto' }) {
	const cap = safe ? 1 : mode === 'high' ? 1.75 : 1.25;
	const budget = (safe ? 1200000 : mode === 'high' ? 4000000 : phone ? 1500000 : 2400000) * ratio * ratio;
	return Math.min(Math.max(.25, Math.min(dpr || 1, cap) * ratio), Math.sqrt(budget / Math.max(1, width * height)));
}

// Validate before Three reads .precision. A lost context can be non-null yet
// return null here. Never reuse a failed canvas, and retry at most once.
export function createGraphicsRenderer({ canvas, Renderer, replaceCanvas, storage, phone = false, safe = false, mode = 'auto' }) {
	let lighter = safe || recentGraphicsLoss(storage), marked = false;
	const record = () => { if (!marked) { marked = true; rememberGraphicsLoss(storage); } lighter = true; };
	for (let attempt = 0; attempt < 2; attempt++) {
		let gl = null, renderer = null;
		const prevent = (event) => { event.preventDefault(); record(); };
		canvas.addEventListener('webglcontextlost', prevent);
		try {
			const options = { antialias: !lighter && !phone && mode === 'high', alpha: false, powerPreference: lighter ? 'low-power' : 'default' };
			gl = canvas.getContext('webgl2', options);
			if (!gl || gl.isContextLost()) throw new Error('Graphics context unavailable');
			for (const stage of [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER]) {
				if (!gl.getShaderPrecisionFormat(stage, gl.HIGH_FLOAT) || !gl.getShaderPrecisionFormat(stage, gl.MEDIUM_FLOAT)) throw new Error('Graphics context interrupted');
			}
			renderer = new Renderer({ canvas, context: gl, ...options });
			if (gl.isContextLost()) throw new Error('Graphics context interrupted');
			return { renderer, canvas, recovered: attempt > 0, lighter };
		} catch {
			record();
			try { renderer?.dispose(); if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
		} finally { canvas.removeEventListener('webglcontextlost', prevent); }
		if (attempt === 0) canvas = replaceCanvas(canvas);
	}
	throw new Error(GRAPHICS_UNAVAILABLE);
}
