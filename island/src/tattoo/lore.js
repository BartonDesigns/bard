// Why someone has the tattoos they have: each piece is a moment of their life (a mother, a
// first big climb, the kids, the ocean, the year that nearly broke them), got at an age that
// fits, on a part of the body that fits, in ink that has aged as long as it has been there
// (old black goes soft and a little blue-green). The same person has the same pieces every
// time, from their seed; the body wears them (tattoo/skinink.js) and they tell you about
// them if you ask (people/persona.js). Nothing tied to where their family is from.

import { newDesign } from './ink.js';

const rng = (seed) => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// the motifs: a design (marks, as ink.js draws them), what it is, the stories people tell of it,
// where it tends to go, and how old someone is when they get it
const S = (shape, style, ink, s = 0.38, fill = false, size = 0.025, x = 0.5, y = 0.5, rot = 0) => ({ kind: 'shape', shape, x, y, s, rot, style, ink, size, fill });
export const MOTIFS = [
	{ id: 'rose', what: 'a rose over a banner', marks: [S('rose', 'line', 'red', 0.3, false, 0.022, 0.5, 0.4), S('banner', 'line', 'black', 0.4, false, 0.02, 0.5, 0.78)], why: ['for my mom', 'for my grandmother; it was her favourite flower'], at: [18, 45], slots: ['upperarm', 'forearm', 'torso'] },
	{ id: 'wave', what: 'a breaking wave', marks: [S('wave', 'line', 'blue', 0.4, false, 0.03), S('wave', 'dashed', 'black', 0.4, false, 0.012, 0.5, 0.62)], why: ['I have surfed Pacifica since I was sixteen', 'I grew up by the ocean and never want to live far from it'], at: [17, 35], slots: ['forearm', 'calf'] },
	{ id: 'mountain', what: 'a mountain range in a circle', marks: [S('mountain', 'line', 'black', 0.32, false, 0.024), S('circle', 'dotted', 'black', 0.46, false, 0.014)], why: ['the first time I summited Whitney', 'I did the John Muir Trail the summer after college'], at: [20, 50], slots: ['forearm', 'upperarm', 'calf'] },
	{ id: 'stars', what: 'a small star for each of my kids', marks: [], why: ['one for each of my kids'], at: [25, 55], slots: ['forearm', 'torso', 'neck'], kids: true },
	{ id: 'compass', what: 'a compass star', marks: [S('star', 'line', 'black', 0.4, false, 0.02), S('diamond', 'line', 'black', 0.18, true, 0.02), S('circle', 'dashed', 'black', 0.46, false, 0.012)], why: ['I moved out here on my own at nineteen; it points home', 'my dad was a sailor; he had the same one'], at: [18, 40], slots: ['forearm', 'upperarm', 'calf'] },
	{ id: 'spiral', what: 'a spiral', marks: [S('spiral', 'line', 'black', 0.4, false, 0.022)], why: ['I got it after a hard year. One day at a time', 'it is about change; I needed the reminder'], at: [20, 45], slots: ['forearm', 'neck', 'calf'] },
	{ id: 'moon', what: 'a crescent moon', marks: [S('moon', 'line', 'black', 0.36, true, 0.02), S('star', 'line', 'black', 0.08, true, 0.01, 0.76, 0.3)], why: ['I worked nights for years', 'my best friend and I got matching ones'], at: [18, 40], slots: ['forearm', 'upperarm', 'calf', 'neck'] },
	{ id: 'heart', what: 'a heart', marks: [S('heart', 'line', 'red', 0.36, true, 0.02), S('heart', 'line', 'black', 0.36, false, 0.02)], why: ['for my wife; we got them the week we married', 'for my husband; we got matching ones', 'for someone I lost'], at: [20, 50], slots: ['upperarm', 'forearm', 'torso'] },
	{ id: 'arrow', what: 'an arrow', marks: [S('arrow', 'line', 'black', 0.42, false, 0.022, 0.5, 0.5, -0.4)], why: ['it only goes forward; I got it when I started over', 'my sister and I have the same one'], at: [18, 35], slots: ['forearm', 'upperarm', 'calf'] },
	{ id: 'band', what: 'a band I drew myself', marks: [S('band', 'tribal', 'black', 0.46, false, 0.03)], why: ['I drew it in art school', 'I designed it myself'], at: [18, 28], slots: ['upperarm', 'calf'] },
	{ id: 'diamond', what: 'a geometric piece', marks: [S('diamond', 'line', 'black', 0.4, false, 0.018), S('triangle', 'line', 'black', 0.3, false, 0.018), S('hexagon', 'dotted', 'black', 0.46, false, 0.012)], why: ['I just liked the shapes', 'an architect friend designed it for me'], at: [20, 40], slots: ['forearm', 'upperarm', 'torso'] },
	{ id: 'wreath', what: 'a ring of dots and dashes', marks: [S('circle', 'dotted', 'black', 0.42, false, 0.02), S('circle', 'dashed', 'grey', 0.3, false, 0.014), S('circle', 'line', 'black', 0.06, true, 0.01)], why: ['a friend is a tattoo artist; she practised on me', 'I got it the day I graduated'], at: [18, 35], slots: ['forearm', 'calf', 'neck'] },
	{ id: 'greenwave', what: 'waves in green and blue', marks: [S('wave', 'line', 'green', 0.4, false, 0.03, 0.5, 0.4), S('wave', 'line', 'blue', 0.4, false, 0.03, 0.5, 0.6)], why: ['Hawaii, my honeymoon', 'the bay where I learned to sail'], at: [22, 50], slots: ['calf', 'forearm'] },
	{ id: 'triangle', what: 'three small triangles', marks: [S('triangle', 'line', 'black', 0.14, true, 0.01, 0.3, 0.5), S('triangle', 'line', 'black', 0.14, true, 0.01, 0.5, 0.5), S('triangle', 'line', 'black', 0.14, true, 0.01, 0.7, 0.5)], why: ['my brothers and I got them together'], at: [18, 35], slots: ['forearm', 'neck'] },
	{ id: 'ochre', what: 'a sun', marks: [S('star', 'dashed', 'ochre', 0.44, false, 0.02), S('circle', 'line', 'ochre', 0.22, true, 0.02)], why: ['I moved here from somewhere cold and never went back', 'I am a morning person, and I wanted a reminder on the bad days'], at: [18, 45], slots: ['forearm', 'upperarm', 'calf'] },
	{ id: 'anchor', what: 'a ship\'s wheel', marks: [S('circle', 'line', 'black', 0.3, false, 0.03), S('star', 'line', 'black', 0.44, false, 0.02), S('circle', 'line', 'black', 0.08, true, 0.02)], why: ['twenty years in the Navy', 'I worked on the ferries; everyone had one'], at: [19, 35], slots: ['upperarm', 'forearm'] },
];
// the designs themselves, as the flash sheet on a parlour's wall draws them (stars for kids
// drawn as three)
export function motifDesign(m, kids = 3) {
	const d = newDesign();
	if (m.kids) for (let i = 0; i < kids; i++) d.marks.push(S('star', 'line', 'black', 0.12, true, 0.01, 0.5 + (i - (kids - 1) / 2) * 0.28, 0.5 + (i % 2 ? 0.08 : -0.04)));
	else d.marks.push(...m.marks.map((k) => ({ ...k })));
	return d;
}

// someone's tattoos, from their seed and their body: [{ motif (its index), slot, angle, along,
// size, rot, fade (1 new .. 0.5 old), got (age), why, where }]
const PART = { upperarm: 'upper arm', forearm: 'forearm', calf: 'calf', thigh: 'thigh', torso: 'chest', neck: 'neck' };
export function inkOf(dna) {
	const age = dna.age;
	if (dna.child || age < 18) return [];
	const r = rng((dna.seed ^ 0x1abe11ed) >>> 0);
	const T = dna.temper || { outgoing: 0.5, confident: 0.5 };
	// about a third of adults, fewer of the oldest; a little more of the outgoing
	const p = (age < 30 ? 0.34 : age < 50 ? 0.36 : age < 70 ? 0.2 : 0.1) * (0.8 + 0.4 * T.outgoing);
	if (r() > p) return [];
	const n = 1 + Math.floor(r() * r() * 3.2), out = [], used = new Set();
	for (let k = 0; k < n * 3 && out.length < n; k++) {
		const i = Math.floor(r() * MOTIFS.length), m = MOTIFS[i];
		if (used.has(m.id) || age < m.at[0]) continue;
		used.add(m.id);
		const got = Math.round(m.at[0] + r() * (Math.min(age, m.at[1]) - m.at[0]));
		const part = m.slots[Math.floor(r() * m.slots.length)];
		const side = r() < 0.55 ? 'L' : 'R', slot = part === 'torso' || part === 'neck' ? part : part + '.' + side;
		if (out.some((o) => o.slot === slot)) continue;
		const years = age - got;
		const back = part === 'torso' && r() < 0.4;
		out.push({
			motif: i, slot, got, why: m.why[Math.floor(r() * m.why.length)], what: m.what,
			where: part === 'torso' ? (back ? 'back' : 'chest') : part === 'neck' ? 'neck' : (side === 'L' ? 'left ' : 'right ') + PART[part],
			angle: part === 'torso' ? (back ? Math.PI : 0) + (r() - 0.5) * 0.4 : part === 'neck' ? (r() < 0.5 ? 1.4 : -1.4) : (r() - 0.5) * 1.6,
			along: 0.35 + r() * 0.3, size: (part === 'torso' ? 0.13 : part === 'neck' ? 0.05 : 0.075) + r() * 0.03, rot: (r() - 0.5) * 0.3,
			// (ink softens with the years: a new piece is sharp and dark, a forty-year-old one faint)
			fade: Math.max(0.5, 1 - years / 80),
		});
	}
	return out;
}

// what they would say about them (for the conversational model's sheet, and without one)
export function inkStory(dna) {
	return inkOf(dna).map((t) => `${t.what} on my ${t.where}, from when I was ${t.got}: ${t.why}`);
}
