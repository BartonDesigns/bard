// The screen-sized overlays over the world (veils, glare, flashes, the ghost's grain, call-outs)
// sit at opacity 0 nearly all the time. On an iPhone each one that paints anything still costs
// the compositor a backing store the size of the screen (15 MB at 3x) and a blend pass a frame,
// because it lies over the world's canvas. So an overlay left at opacity 0 for a moment is
// hidden outright (visibility), and shown again the frame its opacity moves. Only the mount's
// own children with an inline opacity of exactly 0 are touched, and only ones this hid.
const SETTLE_MS = 1200;   // (longer than any fade-out, so none is cut short)

export function createIdleOverlays(mount) {
	const since = new WeakMap(), hid = new WeakSet();
	function sweep(now) {
		// (every child every frame, a string compare each: one shown again must not wait)
		const kids = mount.children;
		for (let k = 0, n = kids.length; k < n; k++) {
			const el = kids[k];
			const idle = el.style.opacity === '0';
			if (idle) {
				if (hid.has(el)) continue;
				const t = since.get(el);
				if (t === undefined) since.set(el, now);
				else if (now - t > SETTLE_MS) { el.style.visibility = 'hidden'; hid.add(el); since.delete(el); }
			} else {
				if (since.has(el)) since.delete(el);
				if (hid.has(el)) { hid.delete(el); el.style.visibility = ''; }
			}
		}
	}
	// (something shown by its opacity this frame, before the sweep comes round to it)
	function wake(el) { if (hid.has(el)) { hid.delete(el); el.style.visibility = ''; } since.delete(el); }
	return { sweep, wake, info: () => { let h = 0; for (const el of mount.children) if (hid.has(el)) h++; return { hidden: h, children: mount.children.length }; } };
}
