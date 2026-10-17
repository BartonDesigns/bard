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
		// (a climber's or a fighter's build: shoulders out over a compact waist, full arms, long
		// legs, a head in proportion; lean, so the muscle target is light: people/build.js shapes the rest)
		base: 0x4e70, sex: 0.96, height: 1.86, muscle: 0.3, weight: 0.03, lean: 0.2, build: { shoulders: 0.018, waist: 0.08, head: -0.05, legs: 0.04, arms: [0.12, 0.1] },
		// (hair colours are used as they are, lit by the strands' own shade: hairkit.js; a dark
		// chestnut is dark in the numbers. Brows groomed: short hairs swept the one way over a
		// full tone of their own, a little lighter than the numbers, as the hair reads lit)
		ancestry: [0.18, 0.14, 0.68], hairColour: [0.075, 0.045, 0.024], iris: 4, brows: { dens: 0.7, thick: 0.66, len: 0.66, tidy: 0.5, fill: 2.1 }, browTone: 1.75,
		// (the sheet's face: the brow heavy over hooded eyes; a straight nose with a defined tip;
		// cheekbones high with a hollow below, never gaunt; a square jaw and a firm chin; a
		// defined bow to the lip, a fuller lower lip; ears close; a strong neck)
		face: {
			jaw: 0.45, 'jaw-out': 0.2, 'chin-width': 0.3, 'chin-out': 0.18, 'chin-height': 0.12, 'chin-cleft': 0.15,
			cheekbones: 0.45, cheeks: -0.25, 'cheek-inner': -0.12, 'brow-ridge': 0.38, 'brow-angle': 0.06, forehead: 0.05, 'forehead-height': -0.05, temples: -0.05,
			'nose-width': -0.1, 'nose-hump': -0.08, 'nose-length': 0.04, 'nose-curve': -0.05, 'nose-point': 0.05, 'nose-volume': -0.05,
			'eye-tilt': 0.05, 'eye-open': -0.18, 'eye-spacing': -0.02,
			'mouth-width': 0.06, 'upper-lip': 0.05, 'lower-lip': 0.12, 'cupids-bow': 0.15, philtrum: 0.1, 'mouth-corners': 0.02,
			'ear-out': -0.15, 'ear-size': -0.05, 'head-square': 0.4, 'head-oval': 0.2, 'head-fat': -0.3, 'neck-width': 0.35,
		},
		// (the sheet's hair: medium length, tousled and swept, over the temples and the tops of the
		// ears, people/hairkit.js; cut: the painted crop under it follows its hairline,
		// people/hair.js scalpMask, crisp, where a faded cut's blurs a band over the temples)
		hair: { style: 'grump', vol: 0.95, fadeK: 0, beard: 'stubble', stubble: 1, cut: 'swept' },
		style: () => ({
			gen: 'millennial', look: 'mono',
			// (a fitted charcoal top, its sleeves pushed up the forearms; room enough over the
			// trapezius that the shoulders never show through it as they move)
			top: { kind: 'longsleeve', col: C.charcoal, pat: 'plain', fit: 'fitted', sleeves: 'rolled', push: true, tuck: true, shoulderEase: 0.6 },
			outer: null,
			// (tailored cargo trousers: laid over the legs and hung, garment.js trouserHull; their
			// seams, fly, pockets and knees in the cloth, pat 'tech'; tucked into tall boots built
			// over the feet; a belt and bellows pockets built on them)
			bottom: { kind: 'cargo', col: C.olive, pat: 'tech', legs: 'long', fit: 'slim', hull: { taper: 0.16, shin: 0.08, ease: 0.013, knee: 0.008, room: 0.007 }, tuck: true },
			shoes: { kind: 'boot', tall: true, built: true, col: '#4a3628', sole: '#1b1917', mid: '#352a20', lace: '#2a231e' },
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
		base: 0x4e71, sex: 0.04, height: 1.73, muscle: 0.24, weight: 0.04, lean: 0.25, build: { shoulders: 0.012, waist: 0.1, head: -0.045, legs: 0.05, arms: [0.05, 0.04] },
		ancestry: [0.1, 0.22, 0.68], hairColour: [0.2, 0.065, 0.026], iris: 5, freckles: true, brows: { dens: 0.62, thick: 0.58, len: 0.7, tidy: 0.5, fill: 1.9 },
		// (hers: high cheekbones, a slim nose with its tip lifted, full lips with a clear bow,
		// almond eyes, a soft but defined jaw and chin; ears close)
		face: {
			cheekbones: 0.45, cheeks: -0.15, 'cheek-inner': -0.05, jaw: -0.08, 'chin-width': -0.15, 'chin-out': 0.1,
			'nose-width': -0.24, 'nose-volume': -0.16, 'nose-tip': 0.15, 'nose-point': 0.08, 'nose-hump': -0.1,
			'eye-size': 0.12, 'eye-tilt': 0.15, 'upper-lip': 0.22, 'lower-lip': 0.3, 'cupids-bow': 0.25, 'mouth-width': 0.05, 'mouth-corners': 0.08,
			'brow-ridge': -0.1, 'brow-angle': 0.1, forehead: -0.05, 'ear-out': -0.1, 'head-oval': 0.4, 'head-heart': 0.28, 'head-fat': -0.22, 'neck-width': -0.12,
		},
		// (the sheet's ponytail is full, not slicked: a little more volume than the style as made)
		hair: { style: 'ponytail01', vol: 1.07, beard: '', cut: 'pony' },
		style: () => ({
			gen: 'millennial', look: 'mono',
			top: { kind: 'tank', col: C.charcoal, pat: 'plain', fit: 'fitted', sleeves: 'none', tuck: true },
			// (the plaid a little bigger than most, as the sheet's: scale, checks per metre)
			outer: { kind: 'flannel', col: '#a3262a', acc: C.black, acc2: '#e8e0d0', pat: 'plaid', scale: 8.5, fit: 'fitted', sleeves: 'rolled', open: true, collar: true, pocket: true, fab: 'canvas', drape: 0.35 },
			// (tailored khaki trousers, zipped pockets slanting down the thighs, meeting the collars of
			// mid-height hiking boots built over the feet; the overshirt's chest pocket buttoned)
			bottom: { kind: 'cargo', col: '#8a7a5c', pat: 'tech', legs: 'long', fit: 'slim', hull: { taper: 0.25, shin: 0.25, ease: 0.006, knee: 0.002, room: 0 }, tuck: true, zips: true },
			shoes: { kind: 'boot', built: true, col: '#6a4c34', sole: '#1b1917', mid: '#4a3a2c', lace: '#3a2a20' },
			acc: [{ kind: 'watch', col: C.black, acc: SILVER, metal: true }],
		}),
	},
};

// the hero's body: personDNA's shape (people/body.js), every part of it chosen
export function heroDNA(sex = 'male', opts = {}) {
	const H = HERO[sex] || HERO.male;
	const style = H.style();
	// (opts.look: a variant tried in the hero view, people/hero-view.js: { hair, hairColour, face })
	const look = opts.look || {};
	const d = personDNA(H.base, { age: 29, ancestry: H.ancestry, style, ...opts });
	d.hero = sex;
	d.sex = H.sex; d.male = sex !== 'female';
	d.age = 29; d.height = H.height; d.muscle = H.muscle; d.weight = H.weight; d.lean = H.lean || 0;
	d.hair = sex === 'female' ? 'ponytail01' : 'short02';
	d.hairColour = (look.hairColour || H.hairColour).slice();
	d.greyShift = -20;
	d.iris = H.iris;
	d.brows = { ...H.brows };
	d.browTone = H.browTone ?? 0.85;
	d.freckles = !!H.freckles;
	// (his hair and beard, or hers, by name: people/hairkit.js styleFor, beardFor)
	style.printKind = 0;
	style.hair = { dyed: null, buzz: false, bun: false, volume: 1, scarf: false, recede: 0, thin: 0, part: 1, fresh: true, ...H.hair, ...(look.hair || {}) };
	d.style = style;
	d.styleSig = JSON.stringify(d.outfit);
	// (sure of themselves: chest up, an easy stride)
	d.temper = { outgoing: 0.7, confident: 0.95, warmth: 0.6, fidget: 0.1 };
	d.gait = { stride: 1.05, bounce: 0.85, armSwing: 0.9, posture: -0.03, pace: 1.35 };
	d.face = { ...H.face, ...(look.face || {}) };
	// (the V: broad shoulders, a narrow waist, people/build.js)
	d.build = { ...H.build };
	return d;
}
// the body for a seed: the hero's for a hero's seed, else a townsperson's
export function lookDNA(seed, opts = {}) {
	const h = heroOf(seed);
	return h ? heroDNA(h, opts) : personDNA(seed, { age: 30, ...opts });
}
