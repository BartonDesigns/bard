// Crysis ecology: the living world is generated, not listed.
//
// A seed gives a place its physical character (a marine profile: water warmth,
// clarity, nutrients, current, volcanism, reef age). From that profile the food web
// is built role by role: which niches exist here, how many species fill each, and
// each species' genome (body, colour, pattern, behaviour, depth band), derived from
// the physics rather than invented. Everything downstream (the reef, the fish, the
// small things on the sand) is grown from these genomes. Deterministic per seed.
//
// Carries forward the old flight build's ecology profile -> niche roles -> species
// pattern, and its community/stand fields, so a region commits to a few species
// instead of an even salad of everything.

import { mulberry32, makeNoise } from '../noise.js';

// ---------- names ----------
// genus from syllables, the common name from what the animal looks like and does
const SYL_A = ['vor', 'thal', 'cru', 'myx', 'pel', 'gna', 'sor', 'vex', 'lun', 'dra', 'oss', 'fen', 'qua', 'rho', 'tyr', 'umb', 'cal', 'ner', 'ist', 'aru'];
const SYL_B = ['ith', 'oden', 'ax', 'ula', 'esk', 'oth', 'arn', 'ix', 'oon', 'eth', 'ave', 'usk', 'orr', 'ann', 'ib', 'elt', 'ora', 'ium'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const taken = new Set();
const genus = (rng) => {
	// never two species with one name in a place
	for (let i = 0; i < 40; i++) {
		const n = cap(SYL_A[(rng() * SYL_A.length) | 0] + SYL_B[(rng() * SYL_B.length) | 0]);
		if (!taken.has(n)) { taken.add(n); return n; }
	}
	return cap(SYL_A[(rng() * SYL_A.length) | 0] + SYL_B[(rng() * SYL_B.length) | 0] + SYL_B[(rng() * SYL_B.length) | 0]);
};

const HUE_WORDS = [[0.0, 'red'], [0.05, 'salmon'], [0.09, 'orange'], [0.14, 'golden'], [0.17, 'yellow'], [0.27, 'lime'], [0.38, 'green'], [0.47, 'teal'], [0.55, 'azure'], [0.62, 'blue'], [0.7, 'indigo'], [0.77, 'violet'], [0.85, 'magenta'], [0.93, 'rose'], [1.0, 'red']];
const hueWord = (h, s, l) => {
	if (s < 0.18) return l > 0.6 ? 'silver' : l < 0.25 ? 'sooty' : 'grey';
	let best = HUE_WORDS[0];
	for (const w of HUE_WORDS) if (Math.abs(w[0] - h) < Math.abs(best[0] - h)) best = w;
	return best[1];
};

// ---------- the place ----------
export function marineProfile(seed, hints = {}) {
	const rng = mulberry32((seed ^ 0x5eab10) >>> 0);
	const warmth = 24 + rng() * 6;                                  // degrees C
	const clarity = 0.45 + rng() * 0.5;                              // clear water favours hard corals
	const nutrients = 0.2 + rng() * 0.6;                             // plankton: planktivores, filter feeders, jellies
	const current = 0.2 + rng() * 0.7;                               // current favours fans and whips
	const volcanism = hints.volcanism ?? 0.8;                        // a live vent in the caldera
	const reefAge = 0.3 + rng() * 0.7;                               // old reefs grow big massive heads
	const predation = 0.3 + rng() * 0.6;
	const words = [];
	words.push(clarity > 0.75 ? 'gin-clear' : clarity < 0.55 ? 'green-tinted' : 'clear');
	words.push(warmth > 28 ? 'warm' : 'temperate-tropical');
	const drivers = [];
	if (nutrients > 0.6) drivers.push('plankton blooms');
	if (current > 0.65) drivers.push('strong currents');
	if (volcanism > 0.6) drivers.push('a living volcanic vent');
	if (reefAge > 0.75) drivers.push('great age');
	if (predation > 0.7) drivers.push('hunting pressure');
	const thesis = `A ${words.join(', ')} caldera reef shaped by ${drivers.slice(0, 2).join(' and ') || 'calm seasons'}.`;
	return { seed, warmth, clarity, nutrients, current, volcanism, reefAge, predation, thesis };
}

// ---------- genomes ----------
const CORAL_FORMS = ['branching', 'digitate', 'tabular', 'massive', 'foliose', 'pillar', 'whip', 'sponge-tube', 'sponge-barrel', 'fan'];

function coralGenome(rng, form, P) {
	// palettes are natural: tans, olives and browns with vivid accents on the tips,
	// pinks and purples in the soft corals, oranges and purples in sponges
	const base = {
		branching: () => [[0.08, 0.35, 0.5], [0.75, 0.3, 0.45], [0.55, 0.35, 0.45], [0.12, 0.45, 0.55]][(rng() * 4) | 0],
		digitate: () => [[0.1, 0.5, 0.55], [0.62, 0.35, 0.5], [0.02, 0.45, 0.5], [0.3, 0.3, 0.45]][(rng() * 4) | 0],
		tabular: () => [[0.12, 0.35, 0.34], [0.25, 0.3, 0.3], [0.95, 0.3, 0.42], [0.5, 0.25, 0.35]][(rng() * 4) | 0],
		massive: () => [[0.1, 0.4, 0.36], [0.22, 0.3, 0.3], [0.95, 0.3, 0.38], [0.06, 0.35, 0.32]][(rng() * 4) | 0],
		foliose: () => [[0.3, 0.35, 0.38], [0.08, 0.4, 0.4], [0.9, 0.3, 0.4]][(rng() * 3) | 0],
		pillar: () => [[0.12, 0.3, 0.5], [0.08, 0.35, 0.45]][(rng() * 2) | 0],
		whip: () => [[0.83, 0.55, 0.45], [0.12, 0.8, 0.5], [0.99, 0.65, 0.45], [0.9, 0.35, 0.6]][(rng() * 4) | 0],
		'sponge-tube': () => [[0.06, 0.75, 0.5], [0.78, 0.5, 0.45], [0.13, 0.75, 0.5], [0.55, 0.5, 0.45]][(rng() * 4) | 0],
		'sponge-barrel': () => [[0.03, 0.45, 0.35], [0.07, 0.4, 0.32]][(rng() * 2) | 0],
		fan: () => [[0.8, 0.6, 0.45], [0.02, 0.7, 0.45], [0.12, 0.8, 0.55]][(rng() * 3) | 0],
	}[form]();
	// clear shallow reefs are colourful: hard corals get a stronger tint than the dull base palettes
	const vivid = form.startsWith('sponge') || form === 'whip' || form === 'fan' ? 1 : 1.5 + P.clarity * 0.4;
	const jitter = (c) => [(c[0] + (rng() - 0.5) * 0.04 + 1) % 1, Math.min(0.85, c[1] * vivid * (0.85 + rng() * 0.3)), c[2] * (0.95 + rng() * 0.2)];
	// hard corals need light; soft corals and fans want current; sponges tolerate the deep
	const lightNeed = { branching: 0.8, digitate: 0.7, tabular: 0.85, massive: 0.5, foliose: 0.45, pillar: 0.6, whip: 0.3, 'sponge-tube': 0.1, 'sponge-barrel': 0.05, fan: 0.25 }[form];
	const g = {
		kind: 'coral', form, colour: jitter(base), tip: rng() < 0.4 ? [(rng() * 0.3 + 0.5 + (rng() < 0.5 ? 0.3 : 0)) % 1, 0.5, 0.6] : null,
		// how common the form is where it fits: pillars and barrels are rare, branching and finger corals everywhere
		abundance: { branching: 1.3, digitate: 1.2, tabular: 0.6, massive: 1, foliose: 0.9, pillar: 0.25, whip: 0.8, 'sponge-tube': 0.8, 'sponge-barrel': 0.45, fan: 0.6 }[form],
		lightNeed, currentLove: form === 'whip' || form === 'fan' ? 0.8 : 0.2,
		depth: [lightNeed > 0.6 ? 1.6 : 3, lightNeed > 0.6 ? 10 : 18],
		size: { branching: 0.9, digitate: 0.7, tabular: 0.8, massive: 1.2, foliose: 0.8, pillar: 0.9, whip: 0.9, 'sponge-tube': 0.8, 'sponge-barrel': 0.8, fan: 0.9 }[form] * (0.8 + rng() * 0.5) * (form === 'massive' ? 0.6 + P.reefAge : 1),
		// shape parameters, each form reads the ones it needs
		branchAngle: 0.35 + rng() * 0.5, branchDepth: 2 + ((rng() * 2) | 0), thick: 0.6 + rng() * 0.8, forks: 2 + ((rng() * 2) | 0),
		count: 5 + ((rng() * 9) | 0), tiers: 1 + ((rng() * 2) | 0), lobes: 3 + ((rng() * 6) | 0), curl: rng(),
	};
	return g;
}

// fish: body plan and colour from the niche
const FISH_NICHES = {
	planktivore: { word: ['damsel', 'chromis', 'anthias'], len: [0.06, 0.12], depthR: [0.45, 0.6], school: [25, 60], home: 'heads', speed: 1.4, tail: ['fork', 'lunate'] },
	grazer: { word: ['tang', 'surgeon', 'parrotfish'], len: [0.2, 0.4], depthR: [0.5, 0.75], school: [4, 9], home: 'bottom', speed: 1.1, tail: ['lunate', 'square'] },
	butterfly: { word: ['butterflyfish', 'angelfish', 'bannerfish'], len: [0.12, 0.22], depthR: [0.75, 0.95], school: [2, 4], home: 'heads', speed: 0.9, tail: ['square', 'round'] },
	bait: { word: ['sprat', 'silverside', 'scad'], len: [0.07, 0.12], depthR: [0.22, 0.3], school: [90, 160], home: 'open', speed: 1.8, tail: ['fork'] },
	predator: { word: ['grouper', 'jack', 'barracuda', 'snapper'], len: [0.7, 1.3], depthR: [0.18, 0.4], school: [1, 1], home: 'patrol', speed: 1.6, tail: ['fork', 'round', 'lunate'] },
	ray: { word: ['ray'], len: [0.9, 1.6], depthR: [0.12, 0.14], school: [1, 1], home: 'glide', speed: 1.0, tail: ['whip'] },
};
const PATTERNS = ['plain', 'bands', 'stripes', 'spots', 'gradient', 'saddle', 'eyespot', 'mask'];

function fishGenome(rng, niche, P, used) {
	const N = FISH_NICHES[niche];
	const r2 = (a) => a[0] + rng() * (a[1] - a[0]);
	// colour: reef fish are vivid, open-water fish silver and counter-shaded, predators drab
	let h, s, l;
	if (niche === 'bait') { h = 0.55 + rng() * 0.08; s = 0.15; l = 0.62; }
	else if (niche === 'predator') { h = [0.08, 0.12, 0.55, 0.0][(rng() * 4) | 0]; s = 0.15 + rng() * 0.25; l = 0.35 + rng() * 0.15; }
	else if (niche === 'ray') { h = 0.08 + rng() * 0.05; s = 0.2; l = 0.3; }
	else {
		do { h = rng(); } while (used.some((u) => Math.abs(u - h) < 0.06));
		used.push(h);
		s = 0.6 + rng() * 0.35; l = 0.45 + rng() * 0.12;
	}
	const accentH = niche === 'bait' ? h : (h + (rng() < 0.5 ? 0.5 : 0.08 + rng() * 0.15)) % 1;
	const pattern = niche === 'bait' ? 'gradient' : niche === 'ray' ? 'spots' : PATTERNS[(rng() * PATTERNS.length) | 0];
	const word = N.word[(rng() * N.word.length) | 0];
	const len = r2(N.len);
	const g = {
		kind: 'fish', niche, genus: genus(rng), common: `${hueWord(h, s, l)} ${pattern === 'plain' || pattern === 'gradient' ? '' : { bands: 'banded ', stripes: 'striped ', spots: 'spotted ', saddle: 'saddled ', eyespot: 'eyespot ', mask: 'masked ' }[pattern]}${word}`.replace(/\s+/g, ' ').trim(),
		len, depthR: r2(N.depthR), widthR: niche === 'ray' ? 1.0 : 0.3 + rng() * 0.15,
		tail: N.tail[(rng() * N.tail.length) | 0], tailSize: 0.8 + rng() * 0.5,
		dorsal: niche === 'predator' ? 0.3 + rng() * 0.3 : niche === 'butterfly' ? 0.6 + rng() * 0.6 : 0.3 + rng() * 0.6,
		snout: niche === 'butterfly' ? 0.4 + rng() * 0.6 : niche === 'predator' ? 0.3 + rng() * 0.5 : rng() * 0.4,
		base: [h, s, l], accent: [accentH, Math.min(1, s + 0.1), niche === 'bait' ? 0.35 : l * (rng() < 0.5 ? 0.45 : 1.35)], belly: [h, s * 0.4, Math.min(0.9, l + 0.3)],
		pattern, patternFreq: 2 + rng() * 5, shimmer: niche === 'bait' ? 0.8 : rng() * 0.3,
		school: Math.round(r2(N.school) * (niche === 'planktivore' || niche === 'bait' ? 0.6 + P.nutrients * 0.8 : 1)),
		home: N.home, speed: N.speed * (0.85 + rng() * 0.3), shy: niche === 'predator' ? 0 : niche === 'bait' ? 6 : 3 + rng() * 2,
		depth: niche === 'ray' ? [3, 20] : niche === 'bait' ? [2, 12] : niche === 'predator' ? [3, 22] : [1.5, 16],
	};
	return g;
}

// the small animals of the reef floor and the open water
function invertGenome(rng, form) {
	const col = {
		starfish: () => [[0.02, 0.7, 0.5], [0.08, 0.8, 0.55], [0.62, 0.55, 0.5], [0.85, 0.5, 0.5]][(rng() * 4) | 0],
		cucumber: () => [[0.06, 0.4, 0.25], [0.0, 0.1, 0.15], [0.1, 0.5, 0.4]][(rng() * 3) | 0],
		clam: () => [[0.55, 0.8, 0.5], [0.45, 0.8, 0.45], [0.75, 0.7, 0.5], [0.3, 0.7, 0.45]][(rng() * 4) | 0],
		duster: () => [[0.95, 0.6, 0.55], [0.12, 0.8, 0.6], [0.62, 0.6, 0.6], [0.0, 0.0, 0.9]][(rng() * 4) | 0],
		jelly: () => [[0.55 + rng() * 0.3, 0.4, 0.75]][0],
		eel: () => [[0.12, 0.2, 0.75], [0.1, 0.5, 0.6]][(rng() * 2) | 0],
	}[form]();
	return { kind: 'invert', form, genus: genus(rng), common: `${hueWord(col[0], col[1], col[2])} ${{ starfish: 'sea star', cucumber: 'sea cucumber', clam: 'giant clam', duster: 'feather duster', jelly: 'moon jelly', eel: 'garden eel' }[form]}`, colour: col, size: 0.8 + rng() * 0.5, arms: 5 + (rng() < 0.15 ? 1 : 0) };
}

// ---------- the web ----------
export function buildEcology(seed, hints = {}) {
	taken.clear();
	const P = marineProfile(seed, hints);
	const rng = mulberry32((seed ^ 0xf00d3b) >>> 0);
	const species = [];
	// builders: how many coral species this reef supports, and which forms
	const nCoral = Math.round(7 + P.clarity * 4 + P.reefAge * 2);
	const forms = [];
	const weight = (f) => ({ branching: P.clarity, digitate: 0.6, tabular: P.clarity * 0.8, massive: P.reefAge, foliose: 1 - P.clarity + 0.3, pillar: 0.3, whip: P.current, 'sponge-tube': P.nutrients, 'sponge-barrel': P.nutrients * 0.7, fan: P.current * 0.8 }[f]);
	// every form at least once, then extra species where the place favours them
	for (const f of CORAL_FORMS) forms.push(f);
	while (forms.length < nCoral) {
		let t = rng() * CORAL_FORMS.reduce((s, f) => s + weight(f), 0);
		for (const f of CORAL_FORMS) { t -= weight(f); if (t <= 0) { forms.push(f); break; } }
	}
	for (const f of forms) { const g = coralGenome(rng, f, P); g.genus = genus(rng); g.common = `${hueWord(...g.colour)} ${{ branching: 'staghorn coral', digitate: 'finger coral', tabular: 'table coral', massive: 'brain coral', foliose: 'lettuce coral', pillar: 'pillar coral', whip: 'sea whip', 'sponge-tube': 'tube sponge', 'sponge-barrel': 'barrel sponge', fan: 'sea fan' }[f]}`; species.push(g); }
	// fish, niche by niche; the counts follow the place
	const used = [];
	const add = (niche, n) => { for (let i = 0; i < n; i++) species.push(fishGenome(rng, niche, P, used)); };
	add('planktivore', 3 + (P.nutrients > 0.5 ? 1 : 0));
	add('grazer', 2 + (P.clarity > 0.7 ? 1 : 0));
	add('butterfly', 2 + (P.reefAge > 0.6 ? 1 : 0));
	add('bait', 1);
	add('predator', P.predation > 0.55 ? 2 : 1);
	add('ray', 1);
	// the floor and the drift
	for (const f of ['starfish', 'starfish', 'cucumber', 'clam', 'duster', 'duster', 'eel']) species.push(invertGenome(rng, f));
	if (P.nutrients > 0.35) species.push(invertGenome(rng, 'jelly'));
	// who eats whom, for the inspector and for behaviour (prey flee their predators)
	for (const s of species) {
		if (s.kind !== 'fish') continue;
		s.eats = { planktivore: 'plankton', grazer: 'turf algae', butterfly: 'coral polyps', bait: 'plankton', predator: 'reef and bait fish', ray: 'sand-dwellers' }[s.niche];
		s.eatenBy = s.niche === 'predator' || s.niche === 'ray' ? [] : species.filter((o) => o.niche === 'predator').map((o) => o.genus);
	}
	return { profile: P, species, coral: species.filter((s) => s.kind === 'coral'), fish: species.filter((s) => s.kind === 'fish'), inverts: species.filter((s) => s.kind === 'invert') };
}

// communities: a coarse field picks which few coral species dominate a region, a finer
// one gives each stand its accent (stands, not a salad)
export function communityField(seed) {
	const nz = makeNoise(seed + 9173);
	return (x, z) => ({ primary: nz.vnoise(x / 70, z / 70), secondary: nz.vnoise(x / 22 + 40, z / 22 - 40) });
}

// a readable summary, for the console and the journal
export function describe(eco) {
	const lines = [eco.profile.thesis, ''];
	const group = (t, list) => { lines.push(t); for (const s of list) lines.push(`  ${s.genus} (${s.common})${s.niche ? ' - ' + s.niche + ', eats ' + s.eats + (s.school > 1 ? ', schools of ~' + s.school : '') : ''}`); };
	group('Builders:', eco.coral);
	group('Fish:', eco.fish);
	group('Floor and drift:', eco.inverts);
	return lines.join('\n');
}
