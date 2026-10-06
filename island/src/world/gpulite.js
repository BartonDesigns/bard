// The lighter ground shader, for devices whose graphics cannot build the full one (Apple's
// shader compiler has lost the graphics on the Bay's ground). Chosen by ?lite on the address,
// or by itself after this device has once lost its graphics (main.js); ?full clears that.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } return null; };
if (q.has('full')) store('l99-gpu-lite3', null);
// (the full one builds on Apple's devices since its height reads went into loops, bay/terrain.js;
// the light one is for a device that lost its graphics building the ground, and for three days
// only: then the full one is tried again. The older, lasting flags are left unread.)
const LITE_DAYS = 3;
export const GPU_LITE = q.has('lite') || (!q.has('full') && !q.has('ground') && Date.now() - (+store('l99-gpu-lite3') || 0) < LITE_DAYS * 86400000);
// its two halves, for testing one at a time: ?ground=v (the full shape, light colour) and
// ?ground=f (light shape, full colour)
const half = q.get('ground');
export const LITE_V = half ? half !== 'v' : GPU_LITE;
export const LITE_F = half ? half !== 'f' : GPU_LITE;
// remembered when the graphics are lost, for the next load
export const preferLite = () => store('l99-gpu-lite3', String(Date.now()));
