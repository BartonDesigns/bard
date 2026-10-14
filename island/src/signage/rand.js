// Seeds for the signage: every sign, sticker and tag is the same each visit, from where it
// stands and what it is. Plain numbers, no clock, shared by the node tests.

// a 32-bit hash of any mix of numbers and strings
export function hash32(...xs) {
	let h = 2166136261 >>> 0;
	for (const x of xs) {
		if (typeof x === 'number') {
			const v = Math.round(x * 64) | 0;
			h = Math.imul(h ^ (v & 0xffff), 16777619);
			h = Math.imul(h ^ (v >>> 16), 16777619);
		} else for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	}
	h = Math.imul(h ^ (h >>> 15), 2246822507);
	h = Math.imul(h ^ (h >>> 13), 3266489909);
	return (h ^ (h >>> 16)) >>> 0;
}
// 0..1 from the same
export const hash01 = (...xs) => hash32(...xs) / 4294967296;
// a little generator from a seed (mulberry32)
export function rng(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
