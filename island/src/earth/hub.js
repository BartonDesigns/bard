// What the place round you is like, for the systems that want a word of it: the people's
// chatter, the ambience, signs. The city director (director.js) sets the brief of the town or
// city you are in; anything can read it or listen for changes, without loading the atlas.
//
//   currentBrief()        the brief of where you are, or null
//   chatter(seed)         a line someone here might say in passing ('' when nothing is known)
//   line(kind, seed)      the same from any of the brief's lists: 'signs', 'streets', 'food'...
//   onBrief(fn)           fn(brief) now and whenever it changes; returns an unsubscribe

let brief = null;
const listeners = new Set();

export function setBrief(b) {
	if (b === brief) return;
	brief = b || null;
	for (const f of listeners) { try { f(brief); } catch (e) { console.warn('earth brief listener', e); } }
}
export const currentBrief = () => brief;
export function line(kind, seed) {
	const L = brief?.[kind];
	if (!Array.isArray(L) || !L.length) return '';
	const n = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : Math.floor(Math.random() * 1e9);
	const v = L[n % L.length];
	return typeof v === 'string' ? v : v?.name || v?.look || '';
}
export const chatter = (seed) => line('chatter', seed);
export function onBrief(fn) {
	listeners.add(fn);
	if (brief) fn(brief);
	return () => listeners.delete(fn);
}
