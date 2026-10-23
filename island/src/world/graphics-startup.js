import { STORE_KEY, readRecord, lossRecord } from './governor.js';

export const GRAPHICS_UNAVAILABLE = '3D graphics could not start, even with lighter settings. Try closing other 3D tabs and reopening Bard. If this keeps happening, restart the browser.';
// High or Ultra: the lower settings (Auto, Low) are gone, and a device left on one comes back on High
export function graphicsMode(storage) {
	try { return storage?.getItem('l99-quality') === 'ultra' ? 'ultra' : 'high'; } catch { return 'high'; }
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
// (Ultra is High on a phone that asked for the desktop's graphics)
export function renderRatio({ width, height, dpr = 1, ratio = 1, phone = false, safe = false, mode = 'auto' }) {
	const high = mode === 'high' || mode === 'ultra';
	const cap = safe ? 1 : high ? 1.75 : 1.25;
	const budget = (safe ? 1200000 : high ? 4000000 : phone ? 1500000 : 2400000) * ratio * ratio;
	return Math.min(Math.max(.25, Math.min(dpr || 1, cap) * ratio), Math.sqrt(budget / Math.max(1, width * height)));
}

// Validate before Three reads .precision. A lost context can be non-null yet
// return null here. Never reuse a failed canvas, and retry at most once.
// The error thrown when both tries fail carries what went wrong each time in error.detail
// (the loading card's Copy load details sends it to us): whether the browser gave a context
// at all, whether it was lost at once, what the shader precision check or three's own
// constructor said, and the graphics card's name when a context said it (Josh's Mac,
// 2026-10-22: Safari and then Chrome failed within two minutes, and the card could only say
// "could not start").
export function createGraphicsRenderer({ canvas, Renderer, replaceCanvas, storage, phone = false, safe = false, mode = 'auto' }) {
	let lighter = safe || recentGraphicsLoss(storage), marked = false;
	const record = () => { if (!marked) { marked = true; rememberGraphicsLoss(storage); } lighter = true; };
	const tries = [];
	let gpu = null;
	for (let attempt = 0; attempt < 2; attempt++) {
		let gl = null, renderer = null, lostEvent = null;
		const prevent = (event) => { event.preventDefault(); lostEvent = event.statusMessage || 'lost'; record(); };
		canvas.addEventListener('webglcontextlost', prevent);
		const options = { antialias: !lighter && !phone && (mode === 'high' || mode === 'ultra'), alpha: false, powerPreference: lighter ? 'low-power' : 'default' };
		try {
			gl = canvas.getContext('webgl2', options);
			if (!gl) throw new Error(canvas.getContext('webgl') ? 'no WebGL2 context (WebGL1 only)' : 'no WebGL context at all');
			if (gl.isContextLost()) throw new Error('context lost as soon as it was made');
			gpu = gpuName(gl) || gpu;
			for (const stage of [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER]) {
				if (!gl.getShaderPrecisionFormat(stage, gl.HIGH_FLOAT) || !gl.getShaderPrecisionFormat(stage, gl.MEDIUM_FLOAT)) throw new Error('shader precision unreadable (context interrupted)');
			}
			renderer = new Renderer({ canvas, context: gl, ...options });
			if (gl.isContextLost()) throw new Error('context lost while the renderer was set up');
			return { renderer, canvas, recovered: attempt > 0, lighter, tries, gpu };
		} catch (error) {
			tries.push({ attempt, options, error: String(error?.message || error).slice(0, 200), lostEvent });
			record();
			try { renderer?.dispose(); if (gl && !gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
		} finally { canvas.removeEventListener('webglcontextlost', prevent); }
		if (attempt === 0) canvas = replaceCanvas(canvas);
	}
	const error = new Error(GRAPHICS_UNAVAILABLE);
	error.detail = { tries, gpu, lighter };
	throw error;
}
// the graphics card's name, where the browser tells it
export function gpuName(gl) {
	try {
		const ext = gl.getExtension('WEBGL_debug_renderer_info');
		return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
	} catch { return null; }
}
