// You, the hero: not a passer-by drawn from a seed but one of two bodies made by hand, a man
// or a woman (chosen in the settings, kept in this browser). Tall, athletic and sure of
// themselves; a face kept close to the base mesh's even average, with only the features that
// read strong (a square jaw on him, high cheekbones and full lips on her), never the dozen
// strong random ones a townsperson gets; lean rather than built (the base mesh's muscle target
// inflates past a little, so the V is shaped instead: people/build.js); a groomed cut, and kit
// made to move in. Him: a fitted top with its sleeves rolled under a plate carrier (straps,
// plates, pouches: built as pieces, not puffed cloth), gloves. Her: a big plaid flannel worn
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
		base: 0x4e70, sex: 0.96, height: 1.87, muscle: 0.4, build: { shoulders: 0.024, waist: 0.07 }, weight: 0.04, ancestry: [0.18, 0.14, 0.68], hairColour: [0.07, 0.048, 0.032],
		face: {
			jaw: 0.38, 'jaw-out': 0.08, 'chin-width': 0.28, 'chin-out': 0.16, 'chin-height': 0.1, 'chin-cleft': 0.15,
			cheekbones: 0.32, cheeks: -0.18, 'brow-ridge': 0.16, 'brow-angle': 0.04, forehead: 0.05,
			'nose-width': -0.1, 'nose-hump': -0.12, 'nose-length': 0.05, 'eye-tilt': 0.05, 'eye-open': -0.05,
			'mouth-width': 0.05, 'lower-lip': 0.06, 'head-square': 0.38, 'head-oval': 0.22, 'head-fat': -0.3, 'neck-width': 0.38,
		},
		hair: { style: 'short01', vol: 1.08, fadeK: 0.3, beard: 'stubble', cut: 'textured' },
		style: () => ({
			gen: 'millennial', look: 'mono',
			top: { kind: 'longsleeve', col: C.charcoal, pat: 'plain', fit: 'fitted', sleeves: 'rolled' },
			outer: null,
			bottom: { kind: 'cargo', col: C.olive, pat: 'cargo', legs: 'long', fit: 'regular', hang: 0.032, tuck: true },
			shoes: { kind: 'boot', tall: true, col: '#2a241c', sole: '#121110' },
			acc: [{ kind: 'carrier', col: '#6a5f48', acc: '#4e4636' }, { kind: 'gloves', col: '#2a2b2e' }, { kind: 'watch', col: C.black, acc: SILVER, metal: true }],
		}),
	},
	female: {
		base: 0x4e71, sex: 0.04, height: 1.74, muscle: 0.26, build: { shoulders: 0.01, waist: 0.08 }, weight: 0.05, ancestry: [0.1, 0.22, 0.68], hairColour: [0.3, 0.13, 0.065],
		face: {
			cheekbones: 0.42, cheeks: -0.12, jaw: -0.2, 'chin-width': -0.2, 'chin-out': 0.06,
			'nose-width': -0.26, 'nose-volume': -0.16, 'nose-tip': 0.1, 'nose-hump': -0.1,
			'eye-size': 0.15, 'eye-tilt': 0.2, 'upper-lip': 0.22, 'lower-lip': 0.26, 'cupids-bow': 0.2, 'mouth-width': 0.04,
			'brow-ridge': -0.1, 'brow-angle': 0.12, 'head-oval': 0.4, 'head-heart': 0.28, 'head-fat': -0.22, 'neck-width': -0.1,
		},
		hair: { style: 'ponytail01', vol: 1, beard: '', cut: 'pony' },
		style: () => ({
			gen: 'millennial', look: 'mono',
			top: { kind: 'tank', col: C.charcoal, pat: 'plain', fit: 'fitted', sleeves: 'none' },
			outer: { kind: 'flannel', col: C.cherry, acc: C.black, acc2: C.cream, pat: 'plaid', fit: 'oversized', sleeves: 'rolled', open: true, collar: true, fab: 'canvas' },
			bottom: { kind: 'cargo', col: '#6a5f48', pat: 'cargo', legs: 'long', fit: 'regular', hang: 0.028, tuck: true },
			shoes: { kind: 'boot', tall: true, col: '#2a241c', sole: '#121110' },
			acc: [{ kind: 'watch', col: C.black, acc: SILVER, metal: true }, { kind: 'earrings', hoop: false, col: SILVER }],
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
	d.age = 29; d.height = H.height; d.muscle = H.muscle; d.weight = H.weight;
	d.hair = sex === 'female' ? 'ponytail01' : 'short02';
	d.hairColour = H.hairColour.slice();
	d.greyShift = -20;
	d.iris = sex === 'female' ? 5 : 6;
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
