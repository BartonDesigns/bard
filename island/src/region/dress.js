// What people wear, by region: the everyday clothes of the place for the weather today, in
// the garment kinds the body system cuts and paints (people/wardrobe.js). Most of the world
// dresses much as anyone does now (jeans, shirts, jackets; the wardrobe's own choices);
// on top of that, what is really worn day to day here: a parka with a fur-trimmed hood in
// the Arctic, a long robe and a headcloth in the Gulf, a djellaba in Morocco, a chuba in
// Tibet, a deel on the steppe, a pollera and a felt hat in the Andes, a shuka among the
// Maasai, a boubou or a wrapper and headwrap in West Africa, a kurta or a sari in India, a
// sarong or a lungi across South and Southeast Asia, a lavalava in the Pacific. Headscarves,
// caps and wraps only as often as people here wear them (cultures.js); many don't.

import { dressFor } from '../people/wardrobe.js';

const pick = (r, L) => L[Math.floor(r() * L.length)];
const chance = (r, p) => r() < p;
const H = (...L) => L;

const COL = {
	parka: H('#b3162b', '#1f2a44', '#1b1b1d', '#5f6440', '#d8412f', '#2354c7', '#2f4a38', '#f07a28', '#6a2331'),
	fur: H('#cfc3b0', '#b9ab94', '#ddd6c8', '#8a7a62'),
	wool: H('#36383c', '#4e3226', '#565c63', '#1f2a44', '#5f6440', '#7a5a44'),
	robeWhite: H('#f3f2ee', '#f3f2ee', '#ede4d0', '#d9ccb2'),
	robeEarth: H('#a89a74', '#7a5a44', '#565c63', '#cdb58f', '#4e3226', '#8d9095', '#2f4a38'),
	djellaba: H('#7a5a44', '#a89a74', '#d9ccb2', '#36383c', '#4f5a36', '#57304a', '#bfb49e'),
	indigo: H('#1c2640', '#2b3d63', '#15192a'),
	bright: H('#d8412f', '#f07a28', '#d0a126', '#1f8a4c', '#2354c7', '#e43b86', '#3fc2c0', '#b3162b', '#f2dc8a', '#57304a'),
	chuba: H('#6a2331', '#33231c', '#4e3226', '#1b1b1d', '#2f4a38'),
	deel: H('#2354c7', '#6a2331', '#2f4a38', '#4e3226', '#2b3d63', '#2a7d7f', '#57304a'),
	sash: H('#d0a126', '#f07a28', '#b3162b', '#1f8a4c', '#f2dc8a'),
	saree: H('#e43b86', '#d8412f', '#f07a28', '#d0a126', '#1f8a4c', '#2354c7', '#57304a', '#b3162b', '#3fc2c0', '#f2dc8a'),
	kurta: H('#f3f2ee', '#ede4d0', '#a9cdee', '#9aa58a', '#f2dc8a', '#d9ccb2', '#b4b5b3'),
	shuka: H('#b3162b', '#c8322c', '#2354c7', '#6a2331'),
	field: H('#5f6440', '#565c63', '#4e3226', '#1f2a44', '#7a5a44', '#a89a74'),
	light: H('#f3f2ee', '#ede4d0', '#a9cdee', '#b4b5b3', '#f2dc8a', '#9aa58a', '#f0826a', '#3fc2c0'),
	scarf: H('#2f4a38', '#1f2a44', '#b08552', '#6a2331', '#d9ccb2', '#57304a', '#1b1b1d', '#9aa58a', '#5ea9e0', '#f2dc8a', '#c0694a'),
	gulfscarf: H('#1b1b1d', '#1b1b1d', '#15192a'),
};

// the outfit for a person here (or null for the wardrobe's own choice): d the body's DNA,
// kit the regional kit, C the culture, cold 0..1, role what they are doing; also sets
// head: a scarf colour for the hair system's headscarf, when they wear one
export function regionalDress(r, d, kit, C, { cold = 0.3, role = 'walk', id = '' } = {}) {
	const style = kit?.folk?.dress || 'village', male = d.male, old = d.age > 55, child = d.child;
	const base = dressFor(r, d, { place: style === 'city' ? 'sf' : 'suburb', activity: 'walk', cold, wet: false });
	const own = base.outer;
	const o = base, head = { scarf: null };
	const top = (kind, col, extra = {}) => { o.top = { kind, col, acc: extra.acc || col, pat: extra.pat || 'plain', fit: extra.fit || 'regular', sleeves: extra.sleeves || 'long', fab: extra.fab, long: extra.long, collar: extra.collar }; };
	const robe = (col, extra = {}) => { top('tunic', col, { long: true, fit: 'oversized', ...extra }); o.bottom = { kind: 'trousers', col: extra.legs || col, pat: 'plain', legs: 'long', fit: 'wide' }; o.outer = extra.outer || null; };
	const long = (col, pat = 'plain', acc = null) => { o.bottom = { kind: 'skirt', col, acc: acc || col, pat, legs: 'skirt', len: 'maxi' }; };
	const sandals = (c = '#7a5a44') => { o.shoes = { kind: 'sandal', col: c, sole: '#33231c' }; };
	const boots = (c = '#33231c') => { o.shoes = { kind: 'boot', col: c, sole: '#1b1b1d' }; };
	const acc = (q) => { o.acc = (o.acc || []).filter((a) => !/^(cap|beanie|bucket|sunhat|visor|hood)$/.test(a.kind) || !/^(cap|beanie|bucket|sunhat|visor|hood)$/.test(q.kind)); o.acc.push(q); };
	const custom = (k) => !child && d.age > 14 && C?.head && chance(r, C.head[k] || 0);
	switch (style) {
		case 'arctic': {
			o.outer = { kind: 'puffer', col: pick(r, COL.parka), acc: pick(r, COL.fur), pat: chance(r, 0.4) ? 'hem' : 'quilt', fit: 'oversized', sleeves: 'long', open: false, long: chance(r, 0.6), fab: 'nylon' };
			o.bottom = { kind: 'trousers', col: pick(r, COL.wool), pat: 'plain', legs: 'long', fit: 'regular', fab: 'nylon' };
			boots(chance(r, 0.3) ? '#a57c52' : '#1b1b1d');
			acc(chance(r, 0.6) ? { kind: 'hood', col: pick(r, COL.fur) } : { kind: 'beanie', col: pick(r, COL.wool) });
			o.acc.push({ kind: chance(r, 0.5) ? 'mitt' : 'gloves', col: pick(r, COL.wool) });
			break;
		}
		case 'boreal': {
			if (cold > 0.45) { o.outer = { kind: chance(r, 0.5) ? 'puffer' : 'quilted', col: pick(r, [...COL.wool, ...COL.parka.slice(0, 4)]), pat: 'quilt', fit: 'regular', sleeves: 'long', open: false, long: old && chance(r, 0.5), fab: 'nylon' }; acc({ kind: chance(r, old ? 0.4 : 0.1) ? 'hood' : 'beanie', col: pick(r, COL.wool) }); o.acc.push({ kind: 'gloves', col: pick(r, COL.wool) }); boots(pick(r, ['#1b1b1d', '#33231c', '#565c63'])); }
			if (/sakha|nenets|sami/.test(C?.key || '') && cold > 0.6 && chance(r, 0.4)) { o.outer = { kind: 'quilted', col: pick(r, ['#7a5a44', '#4e3226', '#cfc3b0']), acc: '#d0a126', pat: 'hem', fit: 'oversized', sleeves: 'long', open: false, long: true, fab: 'wool' }; acc({ kind: 'hood', col: pick(r, COL.fur) }); }
			break;
		}
		case 'alpine':
			if (cold > 0.5) { o.outer = o.outer || { kind: 'quilted', col: pick(r, COL.wool), pat: 'quilt', fit: 'regular', sleeves: 'long', open: true, fab: 'nylon' }; acc({ kind: 'beanie', col: pick(r, COL.wool) }); }
			if (!o.top || chance(r, 0.4)) top(chance(r, 0.5) ? 'flannel' : 'knit', pick(r, ['#6a2331', '#2f4a38', '#36383c', '#ede4d0', '#7a5a44']), { pat: chance(r, 0.5) ? 'check' : 'plain' });
			boots();
			break;
		case 'himalaya':
			if (chance(r, old ? 0.8 : 0.45)) {
				o.outer = { kind: 'jacket', col: pick(r, COL.chuba), acc: pick(r, COL.sash), pat: 'sash', fit: 'oversized', sleeves: 'long', open: false, long: true, fab: 'wool' };
				o.bottom = male ? { kind: 'trousers', col: pick(r, COL.wool), pat: 'plain', legs: 'long', fit: 'wide' } : { kind: 'skirt', col: pick(r, COL.bright), acc: pick(r, COL.bright), acc2: pick(r, COL.bright), pat: 'stripe', legs: 'skirt', len: 'maxi' };
			} else if (cold > 0.3) o.outer = { kind: 'puffer', col: pick(r, [...COL.parka, ...COL.wool]), pat: 'quilt', fit: 'regular', sleeves: 'long', open: chance(r, 0.4), fab: 'nylon' };
			boots(pick(r, ['#33231c', '#6a2331', '#1b1b1d']));
			if (cold > 0.3) acc({ kind: 'beanie', col: pick(r, [...COL.wool, ...COL.bright]) });
			break;
		case 'andean':
			if (!male && chance(r, old ? 0.85 : 0.55)) {
				long(pick(r, COL.bright), 'pleat', pick(r, COL.bright));
				o.outer = { kind: 'knit', col: pick(r, COL.bright), acc: pick(r, COL.bright), acc2: pick(r, COL.bright), pat: 'stripe', fit: 'oversized', sleeves: 'long', open: true, fab: 'wool' };
				if (custom('hat')) acc({ kind: 'bucket', col: pick(r, ['#1b1b1d', '#4e3226', '#33231c', '#565c63']) });
			} else if (male && chance(r, old ? 0.6 : 0.3)) {
				o.outer = { kind: 'knit', col: pick(r, ['#b3162b', '#6a2331', '#4e3226', '#c0694a']), acc: pick(r, COL.bright), pat: 'stripe', fit: 'oversized', sleeves: 'long', open: false, fab: 'wool' };
				acc({ kind: 'beanie', col: pick(r, COL.bright) });
			}
			sandals('#1b1b1d');
			if (cold > 0.5) boots();
			break;
		case 'desert': case 'bazaar': {
			const gulf = /^as\.arabia/.test(id), maghreb = /^af\.(maghreb|sahara)/.test(id), tuareg = C?.key === 'tuareg', persian = C?.key === 'persian', egypt = /^af\.(egypt|sudan)/.test(id);
			const robeShare = gulf ? 0.85 : tuareg ? 0.85 : maghreb ? 0.35 : egypt ? (style === 'desert' ? 0.6 : 0.3) : persian ? 0.05 : 0.15;
			if (male && !child && chance(r, robeShare)) {
				if (gulf) { robe(pick(r, COL.robeWhite)); if (custom('wrap')) acc({ kind: 'hood', col: chance(r, 0.5) ? '#f3f2ee' : '#c8322c' }); }
				else if (tuareg) { robe(pick(r, [...COL.indigo, '#f3f2ee', '#d9ccb2'])); acc({ kind: 'hood', col: pick(r, COL.indigo) }); }
				else if (maghreb) { robe(pick(r, COL.djellaba), { pat: chance(r, 0.4) ? 'stripe' : 'plain', acc: pick(r, COL.djellaba) }); if (custom('cap')) acc({ kind: 'beanie', col: pick(r, ['#b3162b', '#f3f2ee', '#36383c']) }); }
				else { robe(pick(r, [...COL.robeEarth, ...COL.robeWhite])); if (custom('wrap')) acc({ kind: 'hood', col: pick(r, ['#f3f2ee', '#ede4d0']) }); }
				sandals();
			} else if (!male && !child) {
				if (gulf && chance(r, 0.8)) { top('tunic', '#1b1b1d', { long: true, fit: 'oversized' }); long('#1b1b1d'); }
				else if (chance(r, maghreb || tuareg || egypt ? 0.6 : 0.3)) { top('tunic', pick(r, [...COL.djellaba, ...COL.bright]), { long: true, fit: 'oversized', pat: chance(r, 0.3) ? 'dots' : 'plain' }); long(pick(r, [...COL.djellaba, ...COL.wool])); }
				if (custom('scarf')) head.scarf = gulf ? pick(r, COL.gulfscarf) : pick(r, COL.scarf);
				if (chance(r, 0.5)) sandals();
			}
			if (cold > 0.5 && !o.outer) o.outer = { kind: 'jacket', col: pick(r, COL.wool), pat: 'plain', fit: 'regular', sleeves: 'long', open: true, fab: 'canvas' };
			break;
		}
		case 'sahel': case 'savanna': {
			const maasai = C?.key === 'maasai', west = /westafrica|congo/.test(C?.key || '');
			if (maasai && !child && chance(r, 0.6)) { o.outer = { kind: 'jacket', col: pick(r, COL.shuka), acc: '#1f2a44', pat: chance(r, 0.7) ? 'check' : 'plaid', fit: 'oversized', sleeves: 'none', open: true, long: true, fab: 'wool' }; sandals('#1b1b1d'); o.acc.push({ kind: 'chain', col: '#f3f2ee' }); }
			else if ((west || style === 'sahel') && !child) {
				if (male && chance(r, style === 'sahel' ? 0.6 : 0.35)) { robe(pick(r, [...COL.bright, ...COL.robeWhite, ...COL.indigo]), { pat: chance(r, 0.5) ? 'graphic' : 'plain', acc: pick(r, COL.bright) }); if (custom('cap')) acc({ kind: 'beanie', col: pick(r, [...COL.robeWhite, ...COL.bright]) }); }
				else if (!male && chance(r, 0.7)) { top('shirt', pick(r, COL.bright), { pat: pick(r, ['dye', 'graphic', 'block', 'dots']), acc: pick(r, COL.bright), sleeves: 'short' }); long(pick(r, COL.bright), pick(r, ['dye', 'graphic', 'block']), pick(r, COL.bright)); head.scarf = chance(r, 0.6) || custom('scarf') ? pick(r, COL.bright) : null; }
				sandals(pick(r, ['#1b1b1d', '#7a5a44', '#d8412f']));
			} else if (!male && !child && chance(r, 0.45)) { long(pick(r, COL.bright), pick(r, ['dye', 'graphic', 'block']), pick(r, COL.bright)); if (custom('scarf')) head.scarf = pick(r, COL.bright); }
			if (role === 'farm' || role === 'herd') boots(pick(r, ['#1b1b1d', '#33231c']));
			break;
		}
		case 'tropical': case 'island': {
			const sarong = /malay|thai|burmese|southasia|dayak|polynesian|melanesian/.test(C?.key || '');
			top(chance(r, 0.6) ? 'tee' : 'shirt', pick(r, COL.light), { sleeves: 'short', pat: chance(r, style === 'island' ? 0.5 : 0.2) ? 'graphic' : 'plain', acc: pick(r, COL.bright) });
			if (sarong && chance(r, male ? 0.45 : 0.6)) long(pick(r, COL.bright), pick(r, male ? ['check', 'plaid'] : ['dye', 'graphic', 'plaid']), pick(r, COL.bright));
			else if (chance(r, 0.6)) o.bottom = { kind: 'shorts', col: pick(r, COL.field), pat: 'plain', legs: 'shorts', fit: 'regular' };
			o.outer = null;
			sandals(pick(r, ['#1b1b1d', '#2354c7', '#d8412f']));
			if (role === 'farm' || role === 'fish') { if (chance(r, 0.5)) boots('#1b1b1d'); if (chance(r, 0.5)) acc({ kind: 'sunhat', col: '#d9ccb2' }); }
			if (custom('scarf')) head.scarf = pick(r, COL.scarf);
			break;
		}
		case 'eastasia':
			if (role === 'farm' && chance(r, 0.6)) { acc({ kind: 'sunhat', col: '#d9ccb2' }); top('longsleeve', pick(r, COL.field)); boots('#1b1b1d'); }
			if (cold > 0.55 && old && chance(r, 0.5)) o.outer = { kind: 'quilted', col: pick(r, ['#1f2a44', '#36383c', '#6a2331', '#4e3226']), pat: 'quilt', fit: 'regular', sleeves: 'long', open: false, fab: 'nylon' };
			if (C?.key === 'vietnamese' && custom('hat')) acc({ kind: 'sunhat', col: '#d9ccb2' });
			break;
		case 'southasia': {
			const south = /^as\.(india\.(kerala|tamil)|lanka)/.test(id), punjab = /punjab/.test(id);
			if (male && !child) {
				if (chance(r, old ? 0.7 : 0.4)) { top('tunic', pick(r, COL.kurta), { fit: 'regular', sleeves: 'long' }); if (south && chance(r, 0.6)) long(pick(r, ['#f3f2ee', '#ede4d0', '#1f2a44']), chance(r, 0.4) ? 'check' : 'plain'); else o.bottom = { kind: 'trousers', col: pick(r, ['#f3f2ee', '#ede4d0', '#8d9095', '#36383c']), pat: 'plain', legs: 'long', fit: 'wide' }; }
				if (punjab && custom('wrap')) acc({ kind: 'beanie', col: pick(r, ['#f07a28', '#1f2a44', '#f3f2ee', '#b3162b', '#1b1b1d']) });
				sandals();
			} else if (!child) {
				if (chance(r, 0.75)) {
					top('tunic', pick(r, COL.saree), { long: chance(r, 0.5), acc: pick(r, COL.sash), pat: chance(r, 0.4) ? 'hem' : 'plain', sleeves: chance(r, 0.5) ? 'short' : 'long' });
					if (chance(r, 0.5)) long(pick(r, COL.saree), 'hem', pick(r, COL.sash)); else o.bottom = { kind: 'trousers', col: pick(r, COL.saree), pat: 'plain', legs: 'long', fit: 'wide' };
				}
				if (custom('scarf')) head.scarf = pick(r, COL.saree);
				sandals(pick(r, ['#7a5a44', '#d0a126', '#1b1b1d']));
			}
			o.outer = cold > 0.5 ? { kind: 'knit', col: pick(r, COL.wool), pat: 'plain', fit: 'regular', sleeves: 'long', open: true, fab: 'wool' } : null;
			break;
		}
		case 'steppe':
			if (chance(r, old || cold > 0.5 ? 0.75 : 0.4)) { o.outer = { kind: 'jacket', col: pick(r, COL.deel), acc: pick(r, COL.sash), pat: 'sash', fit: 'oversized', sleeves: 'long', open: false, long: true, fab: 'wool' }; o.bottom = { kind: 'trousers', col: pick(r, COL.wool), pat: 'plain', legs: 'long', fit: 'regular' }; boots(pick(r, ['#1b1b1d', '#6a2331', '#33231c'])); }
			if (cold > 0.55) acc({ kind: chance(r, 0.6) ? 'hood' : 'beanie', col: pick(r, [...COL.fur, ...COL.wool]) });
			break;
		case 'outback':
			top('shirt', pick(r, ['#a9cdee', '#ede4d0', '#5f6440', '#c0694a', '#1f2a44']), { collar: true, sleeves: chance(r, 0.6) ? 'long' : 'short', pat: chance(r, 0.4) ? 'check' : 'plain' });
			o.bottom = { kind: 'jeans', col: '#2b3d63', pat: 'denim', legs: 'long', fit: 'straight' };
			boots('#7a5a44');
			if (chance(r, 0.6)) acc({ kind: 'sunhat', col: pick(r, ['#7a5a44', '#a57c52', '#ede4d0']) });
			break;
		case 'mediterranean':
			if (cold < 0.3) { o.outer = null; if (chance(r, 0.5)) top(chance(r, 0.5) ? 'shirt' : 'tee', pick(r, COL.light), { sleeves: 'short' }); if (chance(r, 0.4)) sandals(); }
			break;
		default:
			break;
	}
	// (in the heat, the wardrobe's own jacket comes off; a robe or a shuka stays)
	if (cold < 0.25 && o.outer && o.outer === own) o.outer = null;
	if (cold < 0.2 && o.bottom?.kind === 'joggers') o.bottom = { kind: 'trousers', col: o.bottom.col, pat: 'plain', legs: 'long', fit: 'regular' };
	if (o.outer && o.top && o.outer.sleeves !== 'none') o.top.sleeves = o.top.sleeves || 'long';
	return { outfit: o, head };
}
