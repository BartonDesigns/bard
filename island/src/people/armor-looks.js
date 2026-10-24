// What you wear, seen: each garment and piece of armour you can own (gameplay/arms.js) as the
// pieces the body cuts and paints (people/body.js, garment.js). The aether garments in their
// indigo, waxed olive and gold thread; the armour of the old kingdoms in steel and mail (a
// kettle hat or a great helm, a gambeson, a hauberk, a cuirass with pauldrons, chausses and
// greaves, gauntlets, sabatons); and modern combat gear the way soldiers wear it now: a
// high-cut helmet with a night-vision mount and a headset, a combat shirt under a plate
// carrier or a chest rig, camouflage trousers with knee pads, gloves and coyote boots.
// No real makers, insignia or unit marks.
//
// dressInGear(style, worn) lays what is worn over the clothes someone already has on: each
// slot replaces only its own part (a helm takes the place of a cap, trousers of trousers).
// Pure: no three, no DOM.

import { CAMO } from '../combat/outfits.js';
import { LEGENDARY_ARMOR } from '../gameplay/legendary-items.js';

const STEEL = '#55595e', IRON = '#55595e', MAIL = '#55585c', LEATHER = '#4a3424', GOLD = '#c9a45c';
const MC = CAMO.multicam;
const multicam = (kind, extra = {}) => ({ kind, col: MC[0], acc: MC[1], acc2: MC[2], pat: 'camo', camo: 'multicam', ...extra });
const combatShirt = () => multicam('longsleeve', { fit: 'regular', sleeves: 'long', tuck: true });
const mailShirt = () => ({ kind: 'tunic', col: MAIL, acc: IRON, pat: 'mail', fab: 'metal', fit: 'regular', sleeves: 'long' });
const mailLegs = () => ({ kind: 'trousers', col: MAIL, acc: IRON, pat: 'mail', fab: 'metal', legs: 'long', fit: 'slim' });

// each item's look: the parts it puts on (top, outer, bottom, shoes) and the things it adds (acc)
const BASE_LOOKS = {
	// the aether garments
	'wayfarers-hood': { acc: [{ kind: 'hood', col: '#2c3047', acc: GOLD }] },
	'stargazer-circlet': { acc: [{ kind: 'circlet', col: '#d9dbe6', acc: '#8fd0ff' }] },
	'aetherweave-coat': { top: { kind: 'longsleeve', col: '#1d1f2e', pat: 'plain', fit: 'fitted', sleeves: 'long' }, outer: { kind: 'jacket', col: '#2a2d48', acc: GOLD, pat: 'plain', fab: 'twill', fit: 'regular', sleeves: 'long', long: true } },
	'rangers-jacket': { top: { kind: 'tee', col: '#3a3a33', pat: 'plain', fit: 'regular', sleeves: 'short' }, outer: { kind: 'jacket', col: '#5a5a3a', acc: '#3d3d27', pat: 'plain', fab: 'canvas', fit: 'regular', sleeves: 'long', open: true } },
	'aetherweave-trousers': { bottom: { kind: 'trousers', col: '#23263b', acc: GOLD, pat: 'plain', legs: 'long', fit: 'slim' } },
	'rangers-trousers': { bottom: { kind: 'cargo', col: '#5f6440', pat: 'cargo', legs: 'long', fit: 'regular' } },
	'spellbinder-gloves': { acc: [{ kind: 'gloves', col: '#262a3f', acc: GOLD }] },
	'fieldcraft-gloves': { acc: [{ kind: 'gloves', col: '#6b4a2e', acc: '#4a3220' }] },
	'trailstrider-boots': { shoes: { kind: 'trail', col: '#6b5a44', sole: '#2a2522', acc: GOLD } },
	'duskwalker-boots': { shoes: { kind: 'boot', col: '#1d1d24', sole: '#0e0e10' } },
	// the old kingdoms' armour
	'kettle-helm': { acc: [{ kind: 'helmet', form: 'kettle', col: STEEL }] },
	'great-helm': { acc: [{ kind: 'helmet', form: 'great', col: STEEL, acc: '#121314' }] },
	'gambeson': { top: { kind: 'tunic', col: '#c9b994', acc: '#a89870', pat: 'quilt', fab: 'canvas', fit: 'regular', sleeves: 'long' } },
	'mail-hauberk': { top: mailShirt() },
	// (plate over mail, a torn tabard over the plate, belted)
	'plate-cuirass': { top: { ...mailShirt(), fit: 'slim' }, acc: [{ kind: 'cuirass', col: STEEL, acc: LEATHER, tabard: '#4a1d1b', trim: '#8c7a4e', belt: '#2e2219' }] },
	'mail-chausses': { bottom: mailLegs() },
	'plate-greaves': { bottom: mailLegs(), acc: [{ kind: 'greaves', col: STEEL, acc: LEATHER }] },
	'plate-gauntlets': { acc: [{ kind: 'gloves', col: STEEL, acc: IRON, steel: true, leather: '#2b211a' }] },
	'leather-bracers': { acc: [{ kind: 'gloves', col: '#5a3b22', acc: '#3a2616', bracers: true }] },
	'sabatons': { shoes: { kind: 'boot', col: LEATHER, sole: '#1a1410' }, acc: [{ kind: 'sabatons', col: STEEL }] },
	'riding-boots': { shoes: { kind: 'boot', col: '#4a2e1c', sole: '#1a120c', tall: true } },
	// modern combat gear
	'ops-cap': { acc: [{ kind: 'cap', col: MC[0], acc: MC[1], camo: 'multicam' }, { kind: 'comms', col: '#2b2d2a' }] },
	'ballistic-helmet': { acc: [{ kind: 'helmet', combat: true, col: '#6e6a52', camo: 'multicam', nvg: true, comms: true }] },
	'combat-shirt': { top: combatShirt() },
	'chest-rig': { top: combatShirt(), acc: [{ kind: 'carrier', rig: true, col: '#4e4d3c', acc: '#5f5c45' }] },
	'plate-carrier': { top: combatShirt(), acc: [{ kind: 'carrier', col: MC[0], acc: MC[1], camo: 'multicam' }] },
	'combat-trousers': { bottom: multicam('cargo', { legs: 'long', fit: 'regular' }), acc: [{ kind: 'kneepads', col: '#3a3a32' }] },
	'tactical-gloves': { acc: [{ kind: 'gloves', col: '#3b3a33', acc: '#24241f', knuckle: true }] },
	'combat-boots': { shoes: { kind: 'boot', col: '#8a7556', sole: '#2a241c', combat: true } },
};
// Append only: existing multiplayer wardrobe codes must never shift.
const relicLook = x => {
	if(x.id==='stormwarden-flightcoat')return {top:{kind:'longsleeve',col:'#273442',pat:'plain',fit:'fitted',sleeves:'long'},outer:{kind:'jacket',col:'#273442',acc:'#9b875a',pat:'plain',fab:'twill',fit:'regular',sleeves:'long',long:true}};
	const paint = v => Array.isArray(v) ? v.map(paint) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,a]) =>
		[k, k === 'camo' ? undefined : k === 'col' ? (x.boss === 'leviathan' ? '#536b75' : x.boss === 'walker' ? '#38302d' : x.boss === 'gunship' ? '#3b4b5b' : '#34313f') : ['acc','trim','acc2'].includes(k) && typeof a === 'string' ? `#${x.color.toString(16).padStart(6,'0')}` : k === 'pat' && a === 'camo' ? 'plain' : paint(a)])) : v;
	return paint(BASE_LOOKS[x.base]);
};
export const LOOKS = Object.freeze({ ...BASE_LOOKS, ...Object.fromEntries(LEGENDARY_ARMOR.map(x => [x.id,relicLook(x)])) });

// the things on the head, the hands, the legs and the feet that a worn piece takes the place of
const CLEARS = {
	head: /^(cap|trucker|peaked|beret|beanie|bucket|sunhat|helmet|hood|hazhood|visor|headphones|comms|circlet)$/,
	body: /^(carrier|cuirass)$/,
	legs: /^(kneepads|greaves)$/,
	hands: /^(gloves|mitt)$/,
	feet: /^(sabatons)$/,
};
// each item's slot (gameplay/arms.js), passed in so this stays free of the catalogue
// worn: { slot: item id } (or { slot: { i } }); returns a new style, the old one untouched
export function dressInGear(style, worn = {}) {
	const o = { ...style, acc: [...(style?.acc || [])], relics: [] };
	for (const [slot, w] of Object.entries(worn || {})) {
		const id = typeof w === 'string' ? w : w?.i, L = LOOKS[id];
		if (!L || !CLEARS[slot]) continue;
		if(LEGENDARY_ARMOR.some(x=>x.id===id && x.slot===slot))o.relics.push(id);
		o.acc = o.acc.filter((q) => !CLEARS[slot].test(q.kind));
		if (slot === 'body' && L.top) { o.top = { ...L.top }; o.outer = L.outer ? { ...L.outer } : null; }
		if (slot === 'legs' && L.bottom) o.bottom = { ...L.bottom };
		if (slot === 'feet' && L.shoes) o.shoes = { ...L.shoes };
		// (a bandana or a balaclava stays under a helm, but not under a great helm)
		if (slot === 'head' && (L.acc || []).some((q) => q.form === 'great')) o.acc = o.acc.filter((q) => !/^(bandana|glasses|sunglasses|earrings)$/.test(q.kind));
		// (under modern headgear, sunglasses are the black-framed shooting kind)
		if (slot === 'head' && (L.acc || []).some((q) => q.combat || q.kind === 'comms')) o.acc = o.acc.map((q) => (q.kind === 'sunglasses' ? { ...q, col: '#1b1c1e', wire: false, shape: 'rect' } : q));
		for (const q of L.acc || []) o.acc.push({ ...q });
	}
	return o;
}
// a short key for what is worn, to know when to dress again
export const gearKey = (worn = {}) => Object.keys(CLEARS).map((k) => { const w = worn?.[k]; return (typeof w === 'string' ? w : w?.i) || ''; }).join('|');

// what is worn, as a few characters for a pose (net/protocol.js): each slot's item, by its
// place in LOOKS, in base 36 (0: nothing), head to foot
const IDS = Object.keys(LOOKS), SLOTS = Object.keys(CLEARS);
export function wearCode(worn = {}) {
	return SLOTS.map((k) => { const w = worn?.[k], id = typeof w === 'string' ? w : w?.i, n = IDS.indexOf(id); return n < 0 ? '0' : (n + 1).toString(36); }).join('.');
}
export function wornOfCode(code = '') {
	const out = {};
	String(code).split('.').slice(0, SLOTS.length).forEach((c, k) => { const id = IDS[parseInt(c, 36) - 1]; if (id) out[SLOTS[k]] = id; });
	return out;
}
