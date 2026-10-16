// What the armed sides wear, so you can tell them apart at a glance: the city gangs in street
// clothes in their colours (hoodies, track jackets, a bandana over the face), the militias in
// camouflage (woodland or desert) or the modern militia's mix (a camo or plain hoodie under a
// plate carrier, a baseball or camouflage trucker cap), the soldiers at the bases in full
// pattern uniform, helmet and carrier, the police in navy shirts, peaked caps and a badge,
// the invaders in their own grey pattern. Every outfit grows from the person's seed, so the
// same fighter always wears the same thing. Pure: colours and garment kinds only; the body
// (people/body.js) cuts and paints them. No real insignia, brands or unit marks.

// the camouflage schemes: base, blotch, second blotch, dark
export const CAMO = Object.freeze({
	woodland: ['#5d6440', '#3c4a2c', '#7a6a48', '#262a1f'],
	desert: ['#c8b48a', '#a68d62', '#d9caa6', '#7d6a4c'],
	urban: ['#7c8085', '#55595e', '#a6a9ad', '#2f3236'],
	steppe: ['#8a8a74', '#62664f', '#b0aa8c', '#3e4034'],
});

// a little generator from a seed (mulberry32)
export function seeded(seed) {
	let a = seed >>> 0;
	return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

// a camo garment in a scheme
const camo = (kind, s, extra = {}) => ({ kind, col: CAMO[s][0], acc: CAMO[s][1], acc2: CAMO[s][2], pat: 'camo', camo: s, ...extra });
const boots = (col = '#2a241c') => ({ kind: 'boot', col, sole: '#121110' });
// a plate carrier over whatever is underneath, its pouches in the same cloth
const carrier = (col, pouch = col) => ({ kind: 'carrier', col, acc: pouch });

// the city gangs: street clothes in the gang's colours
function urban(r, a, b) {
	const o = { gen: 'alien', top: null, outer: null, bottom: null, shoes: null, acc: [] };
	const look = r();
	if (look < 0.45) o.top = { kind: 'hoodie', col: a, acc: b, pat: r() < 0.3 ? 'block' : 'plain', fit: 'oversized', sleeves: 'long' };
	else { o.top = { kind: 'tee', col: r() < 0.5 ? '#1b1b1d' : '#f3f2ee', acc: a, pat: 'plain', fit: 'oversized', sleeves: 'short' }; o.outer = { kind: 'track', col: a, acc: b, pat: 'track', fit: 'regular', sleeves: 'long', open: r() < 0.5 }; }
	o.bottom = r() < 0.55 ? { kind: 'joggers', col: r() < 0.5 ? '#1b1b1d' : a, acc: b, pat: 'track', legs: 'long', fit: 'regular', cuff: true } : { kind: 'jeans', col: pick(r, ['#1c2640', '#2a2b30', '#4a6189']), pat: 'denim', legs: 'long', fit: 'baggy' };
	o.shoes = { kind: pick(r, ['chunky', 'sneaker', 'skate']), col: r() < 0.5 ? '#f3f2ee' : '#1b1b1d', sole: '#f3f2ee', acc: a };
	if (r() < 0.55) o.acc.push({ kind: 'bandana', col: a, acc: b });
	const hat = r();
	if (hat < 0.35) o.acc.push({ kind: 'beanie', col: r() < 0.5 ? a : '#1b1b1d' });
	else if (hat < 0.7) o.acc.push({ kind: 'cap', col: a, acc: b });
	if (r() < 0.35) o.acc.push({ kind: 'chain', col: '#d4af6a' });
	return o;
}
// the militias: camouflage, or the modern militia's mix with a carrier and a cap
function militia(r, a, b, scheme) {
	const o = { gen: 'alien', top: null, outer: null, bottom: null, shoes: boots(), acc: [] };
	const modern = r() < 0.55;
	if (modern) {
		o.top = r() < 0.5 ? camo('hoodie', scheme, { fit: 'regular', sleeves: 'long' }) : { kind: 'hoodie', col: pick(r, ['#36383c', '#4f5a36', '#565c63', '#1b1b1d', a]), acc: b, pat: 'plain', fit: 'regular', sleeves: 'long' };
		o.bottom = r() < 0.6 ? camo('cargo', scheme, { legs: 'long', fit: 'regular' }) : { kind: 'cargo', col: pick(r, ['#a89a74', '#5f6440', '#36383c']), pat: 'cargo', legs: 'long', fit: 'regular' };
		o.acc.push(carrier(pick(r, ['#4b4f3a', '#6a6450', '#2f3236', CAMO[scheme][0]]), CAMO[scheme][1]));
		o.acc.push(r() < 0.5 ? { kind: 'trucker', col: CAMO[scheme][0], acc: '#e9e4d6', camo: scheme } : { kind: 'cap', col: pick(r, [a, '#36383c', '#5f6440', '#a89a74']), acc: b });
	} else {
		o.top = camo('longsleeve', scheme, { fit: 'regular', sleeves: 'long' });
		o.outer = r() < 0.5 ? camo('jacket', scheme, { fit: 'regular', sleeves: 'long', open: r() < 0.4 }) : null;
		o.bottom = camo('cargo', scheme, { legs: 'long', fit: 'regular' });
		o.acc.push(r() < 0.5 ? { kind: 'cap', col: CAMO[scheme][0], acc: CAMO[scheme][1], camo: scheme } : { kind: 'bucket', col: CAMO[scheme][0], camo: scheme });
		if (r() < 0.4) o.acc.push({ kind: 'bandana', col: CAMO[scheme][3], acc: CAMO[scheme][1] });
		o.rollable = true;
	}
	if (r() < 0.6) o.acc.push({ kind: 'gloves', col: '#2a2b2e' });
	// some roll their sleeves (the last draw: the rest stays as it was): the shirt's, or the
	// jacket's over a short-sleeved one
	if (o.rollable && r() < 0.35) { if (o.outer) { o.outer.sleeves = 'rolled'; o.top.sleeves = 'short'; } else o.top.sleeves = 'rolled'; }
	delete o.rollable;
	return o;
}
// the soldiers at the bases: full pattern uniform, helmet, carrier, gloves
function soldier(r, scheme, officer = false) {
	const o = { gen: 'alien', top: camo('longsleeve', scheme, { fit: 'regular', sleeves: 'long' }), outer: camo('jacket', scheme, { fit: 'regular', sleeves: 'long' }), bottom: camo('cargo', scheme, { legs: 'long', fit: 'regular' }), shoes: boots('#3a2f22'), acc: [] };
	if (officer) o.acc.push({ kind: 'beret', col: '#2c3a2a' });
	else o.acc.push({ kind: 'helmet', col: CAMO[scheme][1], visor: null, camo: scheme, combat: true });
	o.acc.push(carrier(CAMO[scheme][3], CAMO[scheme][1]));
	if (r() < 0.8) o.acc.push({ kind: 'gloves', col: '#2a2b2e' });
	// about a third with the jacket's sleeves rolled to below the elbow over a pattern tee
	// (the last draw, so the rest of the kit stays as it was)
	if (r() < 0.33) { o.top = camo('tee', scheme, { fit: 'regular', sleeves: 'short' }); o.outer.sleeves = 'rolled'; }
	return o;
}
// the police: navy uniform shirt and trousers, peaked cap, a vest with a badge
function police(r) {
	const navy = '#1c2540';
	const o = { gen: 'alien', top: { kind: 'shirt', col: r() < 0.25 ? '#dfe4ea' : navy, acc: navy, pat: 'plain', fit: 'regular', sleeves: r() < 0.5 ? 'short' : 'long', tuck: true }, outer: null, bottom: { kind: 'trousers', col: navy, acc: '#b9a24a', pat: 'track', legs: 'long', fit: 'regular' }, shoes: { kind: 'boot', col: '#121214', sole: '#0b0b0b' }, acc: [] };
	o.acc.push({ kind: 'peaked', col: navy, acc: '#0d0f16', band: '#d9c46a' });
	o.acc.push({ kind: 'carrier', col: '#161a26', acc: '#232838', badge: '#d9c46a', police: true });
	return o;
}
// the police's tactical team: charcoal fatigues, a helmet with a visor, a heavy carrier
function tactical(r) {
	const dark = '#22262d';
	const o = { gen: 'alien', top: { kind: 'longsleeve', col: dark, acc: '#2c313a', pat: 'plain', fit: 'regular', sleeves: 'long' }, outer: null, bottom: { kind: 'cargo', col: dark, pat: 'cargo', legs: 'long', fit: 'regular' }, shoes: boots('#121214'), acc: [] };
	o.acc.push({ kind: 'helmet', col: '#1a1d22', visor: r() < 0.5 ? '#3a4656' : null, combat: true });
	o.acc.push({ kind: 'carrier', col: '#15181d', acc: '#2a2f38', badge: '#d9c46a', police: true });
	o.acc.push({ kind: 'gloves', col: '#151618' });
	return o;
}

// the kit for one fighter of a side: kind (factions.js), the side's colours, seed
export function outfitFor({ fid, kind, colors = ['#444444', '#999999'], masked = false }, seed = 1) {
	const r = seeded(seed ^ 0x51ed), [a, b] = colors;
	if (fid === 'fire') return { gen: 'alien', top: { kind: 'suit', col: '#c99a1a', acc: '#2a2a2a', pat: 'hazmat', fit: 'regular', sleeves: 'long', fab: 'canvas' }, outer: null, bottom: { kind: 'suit', col: '#c99a1a', acc: '#2a2a2a', pat: 'hazmat', legs: 'long', fit: 'regular' }, shoes: boots('#18191b'), acc: [{ kind: 'helmet', col: '#d8a21a', visor: '#2a2a2a' }] };
	if (fid === 'swat') return tactical(r);
	if (kind === 'gang') return urban(r, a, b);
	if (kind === 'militia') return militia(r, a, b, r() < 0.3 ? 'desert' : 'woodland');
	if (kind === 'military') return soldier(r, 'woodland', r() < 0.08);
	if (kind === 'invaders') return soldier(r, 'steppe');
	if (kind === 'police') return police(r);
	if (kind === 'raiders' && !masked) return militia(r, a, b, 'desert');
	// everyone else: a fitted kit in their colours (the masked ones hide their faces)
	const o = { gen: 'alien', top: { kind: 'suit', col: a, acc: b, pat: 'block', fit: 'fitted', sleeves: 'long', fab: 'tech' }, outer: null, bottom: { kind: 'suit', col: a, acc: b, pat: 'plain', legs: 'long', fit: 'regular', fab: 'twill' }, shoes: { kind: 'boot', col: '#18191b', sole: '#0e0e0e' }, acc: [] };
	if (masked || kind === 'mercs' || kind === 'law') o.acc.push({ kind: 'helmet', col: kind === 'law' ? a : '#33373c', visor: kind === 'law' ? '#9fd8ff' : b });
	else if (kind === 'smugglers') { o.top = { kind: 'knit', col: a, acc: b, pat: 'rib', fit: 'regular', sleeves: 'long' }; o.bottom = { kind: 'cargo', col: '#36383c', pat: 'cargo', legs: 'long', fit: 'regular' }; o.acc.push({ kind: 'beanie', col: a }); }
	else if (kind === 'villagers') o.acc.push({ kind: 'cap', col: b });
	return o;
}

// which look a side has, in a word (for the tests and Crysis.military())
export function lookOf(o) {
	const accs = (o.acc || []).map((q) => q.kind);
	if (accs.includes('peaked') || (accs.includes('carrier') && o.acc.some((q) => q.police))) return 'police';
	if (o.top?.pat === 'camo' && (accs.includes('helmet') || accs.includes('beret'))) return 'soldier';
	if (accs.includes('carrier')) return 'modern-militia';
	if (o.top?.pat === 'camo' || o.bottom?.pat === 'camo') return 'camouflage';
	if (o.top?.kind === 'hoodie' || o.outer?.kind === 'track' || accs.includes('bandana')) return 'urban';
	return 'kit';
}
