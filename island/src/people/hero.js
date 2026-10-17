// You, the hero: not a passer-by drawn from a seed but one of two bodies made by hand, a man
// or a woman (chosen in the settings, kept in this browser). Tall, athletic and sure of
// themselves; a face kept close to the base mesh's even average, with only the features that
// read strong (a square jaw on him, high cheekbones and full lips on her), never the dozen
// strong random ones a townsperson gets; lean rather than built (the base mesh's muscle target
// inflates past a little, so the V is shaped instead: people/build.js); a groomed cut, and kit
// made to move in. Him: a fitted top with its sleeves rolled under a plate carrier (straps,
// plates, pouches: built as pieces, not puffed cloth). Her: a big plaid flannel worn
// open and flowing over a fitted tank. Both: rugged cargo trousers that hang straight from the
// thigh and are bloused into tall combat boots (people/garment.js hang, tuck, tall). In their
// own colours, so a hero is never taken for one of the soldiers. And they stand ready.
//
// Friends draw you from your seed alone (net/protocol.js cleanLook), so the hero is a seed of
// its own: HERO_TAG in the top byte (above any seed a townsperson or an old visit was given,
// which are below 2^31), the choice in the low one. Pure but for the choice kept in storage.

import { personDNA } from './body.js';
import { C } from './wardrobe.js';

export const HERO_TAG = 0xb4000000;
export const HEROES = ['male', 'female'];
const KEY = 'l99-hero';

export const heroSeed = (sex) => (HERO_TAG | (sex === 'female' ? 2 : 1)) >>> 0;
// the hero a seed stands for ('male', 'female'), or null for anyone else
export function heroOf(seed) {
	const s = seed >>> 0;
	if (((s & 0xff000000) >>> 0) !== HERO_TAG) return null;
	const k = s & 0xff;
	return k === 1 ? 'male' : k === 2 ? 'female' : null;
}

// the choice, kept (storage: localStorage, or anything with getItem and setItem)
export function heroChoice(storage = globalThis.localStorage) {
	try { const v = storage?.getItem(KEY); return HEROES.includes(v) ? v : 'male'; } catch { return 'male'; }
}
export function setHeroChoice(sex, storage = globalThis.localStorage) {
	const v = HEROES.includes(sex) ? sex : 'male';
	try { storage?.setItem(KEY, v); storage?.setItem('l99-me', String(heroSeed(v))); } catch { /* private mode */ }
	return v;
}

const SILVER = '#c9ccd0';
const HERO = {
	male: {
		// (a climber's or a fighter's build: shoulders out over a compact waist, long legs, a head
		// in proportion; lean, so the muscle target is light: people/build.js shapes the rest)
		base: 0x4e70, sex: 0.96, height: 1.86, muscle: 0.3, weight: 0.03, lean: 0.2, build: { shoulders: 0.018, waist: 0.08, head: -0.05, legs: 0.04 },
		// (hair colours are used as they are, lit by the strands' own shade: hairkit.js; a dark
		// chestnut is dark in the numbers)
		ancestry: [0.18, 0.14, 0.68], hairColour: [0.075, 0.045, 0.024], iris: 4, brows: { dens: 0.5, thick: 0.62 },
		face: {
			jaw: 0.42, 'jaw-out': 0.08, 'chin-width': 0.24, 'chin-out': 0.2, 'chin-height': 0.1, 'chin-cleft': 0.12,
			cheekbones: 0.32, cheeks: -0.25, 'brow-ridge': 0.2, 'brow-angle': 0.04, forehead: 0.05, temples: -0.05,
			'nose-width': -0.12, 'nose-hump': -0.08, 'nose-length': 0.04, 'eye-tilt': 0.05, 'eye-open': -0.08, 'eye-spacing': -0.02,
			'mouth-width': 0.04, 'upper-lip': 0.02, 'lower-lip': 0.08, 'head-square': 0.3, 'head-oval': 0.25, 'head-fat': -0.3, 'neck-width': 0.18,
		},
		hair: { style: 'short01', vol: 1.12, fadeK: 0.25, beard: 'stubble', cut: 'textured' },
		style: () => ({
			gen: 'millennial', look: 'mono',
			// (a fitted charcoal top, its sleeves pushed up the forearms)
			top: { kind: 'longsleeve', col: C.charcoal, pat: 'plain', fit: 'fitted', sleeves: 'rolled', push: true, tuck: true },
			outer: null,
			// (tailored cargo trousers: laid over the legs and hung, garment.js trouserHull; their
			// seams, fly, pockets and knees in the cloth, pat 'tech'; tucked into tall boots built
			// over the feet; a belt and bellows pockets built on them)
			bottom: { kind: 'cargo', col: C.olive, pat: 'tech', legs: 'long', fit: 'slim', hull: { taper: 0.07, ease: 0.006, knee: 0.007 }, tuck: true },
			shoes: { kind: 'boot', tall: true, built: true, col: '#5a4632', sole: '#1b1917', mid: '#3e3328', lace: '#2a231e' },
			acc: [
				{ kind: 'carrier', compact: true, col: '#5d5c41', acc: '#4c4b35' },
				{ kind: 'belt', col: '#262422', buckle: '#7d796f', loop: C.olive },
				{ kind: 'cargo', col: C.olive },
				{ kind: 'watch', col: C.black, acc: SILVER, metal: true },
			],
		}),
	},
	female: {
		// (her own build, not his made smaller: defined shoulders, a long waist drawn in, strong
		// long legs, a smaller head; a runner's or a climber's)
		base: 0x4e71, sex: 0.04, height: 1.73, muscle: 0.24, weight: 0.04, lean: 0.25, build: { shoulders: 0.012, waist: 0.1, head: -0.045, legs: 0.05 },
		ancestry: [0.1, 0.22, 0.68], hairColour: [0.2, 0.065, 0.026], iris: 5, freckles: true, brows: { dens: 0.48, thick: 0.55 },
		face: {
			cheekbones: 0.45, cheeks: -0.18, jaw: -0.12, 'chin-width': -0.18, 'chin-out': 0.08,
			'nose-width': -0.26, 'nose-volume': -0.16, 'nose-tip': 0.12, 'nose-hump': -0.1,
			'eye-size': 0.15, 'eye-tilt': 0.15, 'upper-lip': 0.2, 'lower-lip': 0.28, 'cupids-bow': 0.2, 'mouth-width': 0.04,
			'brow-ridge': -0.1, 'brow-angle': 0.1, 'head-oval': 0.4, 'head-heart': 0.28, 'head-fat': -0.22, 'neck-width': -0.15,
		},
		hair: { style: 'ponytail01', vol: 1, beard: '', cut: 'pony' },
		style: () => ({
			gen: 'millennial', look: 'mono',
			top: { kind: 'tank', col: C.charcoal, pat: 'plain', fit: 'fitted', sleeves: 'none', tuck: true },
			outer: { kind: 'flannel', col: '#a3262a', acc: C.black, acc2: '#e8e0d0', pat: 'plaid', fit: 'fitted', sleeves: 'rolled', open: true, collar: true, fab: 'canvas', drape: 0.35 },
			// (tailored khaki trousers meeting the collars of mid-height hiking boots built over the feet)
			bottom: { kind: 'cargo', col: '#8a7a5c', pat: 'tech', legs: 'long', fit: 'slim', hull: { taper: 0.075, ease: 0.005, knee: 0.006 }, tuck: true },
			shoes: { kind: 'boot', built: true, col: '#6a4c34', sole: '#1b1917', mid: '#4a3a2c', lace: '#3a2a20' },
			acc: [{ kind: 'watch', col: C.black, acc: SILVER, metal: true }],
		}),
	},
};

// the hero's body: personDNA's shape (people/body.js), every part of it chosen
export function heroDNA(sex = 'male', opts = {}) {
	const H = HERO[sex] || HERO.male;
	const style = H.style();
	const d = personDNA(H.base, { age: 29, ancestry: H.ancestry, style, ...opts });
	d.hero = sex;
	d.sex = H.sex; d.male = sex !== 'female';
	d.age = 29; d.height = H.height; d.muscle = H.muscle; d.weight = H.weight; d.lean = H.lean || 0;
	d.hair = sex === 'female' ? 'ponytail01' : 'short02';
	d.hairColour = H.hairColour.slice();
	d.greyShift = -20;
	d.iris = H.iris;
	d.brows = { ...H.brows };
	d.freckles = !!H.freckles;
	// (his hair and beard, or hers, by name: people/hairkit.js styleFor, beardFor)
	style.printKind = 0;
	style.hair = { dyed: null, buzz: false, bun: false, volume: 1, scarf: false, recede: 0, thin: 0, part: 1, fresh: true, ...H.hair };
	d.style = style;
	d.styleSig = JSON.stringify(d.outfit);
	// (sure of themselves: chest up, an easy stride)
	d.temper = { outgoing: 0.7, confident: 0.95, warmth: 0.6, fidget: 0.1 };
	d.gait = { stride: 1.05, bounce: 0.85, armSwing: 0.9, posture: -0.03, pace: 1.35 };
	d.face = { ...H.face };
	// (the V: broad shoulders, a narrow waist, people/build.js)
	d.build = { ...H.build };
	return d;
}
// the body for a seed: the hero's for a hero's seed, else a townsperson's
export function lookDNA(seed, opts = {}) {
	const h = heroOf(seed);
	return h ? heroDNA(h, opts) : personDNA(seed, { age: 30, ...opts });
}
