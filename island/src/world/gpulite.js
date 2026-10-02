// The lighter ground shader, for devices whose graphics cannot build the full one (Apple's
// shader compiler has lost the graphics on the Bay's ground). Chosen by ?lite on the address,
// or by itself after this device has once lost its graphics (main.js); ?full clears that.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } return null; };
if (q.has('full')) store('l99-gpu-lite', null);
export const GPU_LITE = q.has('lite') || (!q.has('full') && store('l99-gpu-lite') === '1');
// remembered when the graphics are lost, for the next load
export const preferLite = () => store('l99-gpu-lite', '1');
