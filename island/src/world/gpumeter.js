// How much the graphics hold, roughly: the bytes given to each texture, buffer and renderbuffer,
// counted as they are handed over and let go. A phone's browser gives no figure of its own
// (Safari has no performance.memory), and on a phone the graphics' memory is the page's memory,
// so this is what the governor (governor.js) reads to see memory climbing before the browser
// closes the page. An estimate: mipmaps a third more, formats by their size per pixel.
const BPP = { 6408: 4, 6407: 4, 6403: 1, 33319: 2, 6409: 1, 6410: 2, 6406: 1, 32856: 4, 32849: 4, 33321: 1, 33323: 2, 34842: 8, 34836: 16, 33325: 2, 33326: 4, 33327: 4, 33328: 8, 35898: 4, 35901: 4, 36194: 2, 33189: 4, 33190: 4, 36012: 4, 35056: 4, 36013: 8, 34041: 4, 35907: 4 };
const CUBE_FACE = (t) => t >= 34069 && t <= 34074;

export function meterGL(gl) {
	const m = { tex: 0, buf: 0, rb: 0 };
	if (!gl || gl.__meter) return gl?.__meter || { bytes: () => 0, info: () => m };
	const texBytes = new WeakMap(), bufBytes = new WeakMap(), rbBytes = new WeakMap();
	let unit = 0, rb = null;
	const bound = {}, bufs = {};
	const curTex = (target) => bound[unit + ':' + (CUBE_FACE(target) ? 34067 : target)];
	const setTex = (tex, key, bytes) => {
		if (!tex) return;
		let e = texBytes.get(tex);
		if (!e) { e = new Map(); texBytes.set(tex, e); }
		m.tex += bytes - (e.get(key) || 0);
		e.set(key, bytes);
	};
	const wrap = (name, after) => {
		const f = gl[name];
		if (typeof f !== 'function') return;
		const fn = f.bind(gl);
		gl[name] = (...a) => { const r = fn(...a); try { after(a); } catch { /* an estimate only */ } return r; };
	};
	wrap('activeTexture', (a) => { unit = a[0] - 33984; });
	wrap('bindTexture', (a) => { bound[unit + ':' + a[0]] = a[1]; });
	wrap('texImage2D', (a) => {
		let w, h;
		if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s?.videoWidth || s?.naturalWidth || s?.width || 0; h = s?.videoHeight || s?.naturalHeight || s?.height || 0; }
		setTex(curTex(a[0]), a[0] + ':' + a[1], w * h * (BPP[a[2]] || 4));
	});
	wrap('texImage3D', (a) => { setTex(curTex(a[0]), a[0] + ':' + a[1], a[3] * a[4] * a[5] * (BPP[a[2]] || 4)); });
	const storage = (a, depth) => { let b = 0, w = a[3], h = a[4]; for (let l = 0; l < a[1]; l++) { b += w * h * depth * (BPP[a[2]] || 4); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); } return b; };
	wrap('texStorage2D', (a) => { setTex(curTex(a[0]), 'all', storage(a, 1) * (a[0] === 34067 ? 6 : 1)); });
	wrap('texStorage3D', (a) => { setTex(curTex(a[0]), 'all', storage(a, a[5])); });
	wrap('compressedTexImage2D', (a) => { setTex(curTex(a[0]), a[0] + ':' + a[1], a[a.length - 1]?.byteLength || 0); });
	wrap('generateMipmap', (a) => { const t = curTex(a[0]), e = t && texBytes.get(t); if (!e) return; let base = 0; for (const [k, v] of e) if (k !== 'mip') base += v; setTex(t, 'mip', Math.round(base / 3)); });
	wrap('deleteTexture', (a) => { const e = a[0] && texBytes.get(a[0]); if (!e) return; for (const v of e.values()) m.tex -= v; texBytes.delete(a[0]); });
	wrap('bindBuffer', (a) => { bufs[a[0]] = a[1]; });
	wrap('bufferData', (a) => { const b = bufs[a[0]]; if (!b) return; const n = typeof a[1] === 'number' ? a[1] : a[1]?.byteLength || 0; m.buf += n - (bufBytes.get(b) || 0); bufBytes.set(b, n); });
	wrap('deleteBuffer', (a) => { const n = a[0] && bufBytes.get(a[0]); if (n == null) return; m.buf -= n; bufBytes.delete(a[0]); });
	wrap('bindRenderbuffer', (a) => { rb = a[1]; });
	const rbSet = (n) => { if (!rb) return; m.rb += n - (rbBytes.get(rb) || 0); rbBytes.set(rb, n); };
	wrap('renderbufferStorage', (a) => rbSet(a[2] * a[3] * (BPP[a[1]] || 4)));
	wrap('renderbufferStorageMultisample', (a) => rbSet(a[3] * a[4] * (BPP[a[2]] || 4) * Math.max(1, a[1])));
	wrap('deleteRenderbuffer', (a) => { const n = a[0] && rbBytes.get(a[0]); if (n == null) return; m.rb -= n; rbBytes.delete(a[0]); });
	// the screen's own buffers: colour, depth and the one being shown
	const screen = () => (gl.drawingBufferWidth || 0) * (gl.drawingBufferHeight || 0) * 12;
	const meter = { bytes: () => m.tex + m.buf + m.rb + screen(), info: () => ({ tex: m.tex, buf: m.buf, rb: m.rb, screen: screen() }), reset() { m.tex = m.buf = m.rb = 0; } };
	gl.__meter = meter;
	return meter;
}
