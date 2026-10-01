// Which regional kit a place is: from the atlas region (its id says where, and so whose
// customs), its climate (the warmth of its coldest and warmest months, its rain), how high
// it is and how big the place is (a herders' camp and a capital in the same country are
// built differently). Near a border the atlas gives several regions with weights; each
// gives its kit and the weights are summed, so a village near a border may be either, and
// what is blended (the colours, the plants) leans by the same weights.
//
//   kitAt(at, { pop, elev })   at: atlas regionAt(); pop: the town's size class (0 village
//                              .. 5 megacity; -1 for the open country); elev: metres
//   -> { id, kit, weights: [{ id, w }], culture }

import { KITS } from './kits.js';
import { cultureOf } from './cultures.js';
import { region } from '../earth/atlas.js';

const starts = (id, ...p) => p.some((s) => id === s || id.startsWith(s + '.'));
const ISLAMIC_TOWNS = ['af.maghreb', 'af.egypt', 'af.sudan', 'as.tr', 'as.levant', 'as.iraq', 'as.arabia', 'as.iran', 'as.central', 'as.afpak.af', 'as.cn.xinjiang', 'as.caucasus.az'];
const MED = ['eu.es', 'eu.pt', 'eu.it', 'eu.gr', 'eu.cyprus', 'eu.malta', 'eu.fr.provence', 'eu.fr.corsica', 'eu.balkans.dalmatia', 'eu.balkans.al', 'atl.madeira', 'atl.azores', 'atl.canaries', 'as.tr', 'as.levant', 'af.maghreb'];

// the kit for one region (resolved atlas profile R), at a size and a height
export function kitFor(id, R, { pop = -1, elev = 0, lat = 0 } = {}) {
	const T = R?.climate?.temp || [10, 20], rain = R?.climate?.rain ?? 700, cold = T[0], warm = T[1], mean = (cold + warm) / 2;
	const town = pop >= 1, city = pop >= 3;
	// the poles and the Arctic
	if (starts(id, 'an')) return 'station';
	if (starts(id, 'na.ak.north', 'na.can.arctic', 'atl.greenland', 'eu.nordic.svalbard', 'as.ru.arctic')) return city ? 'snow' : 'polar';
	if (Math.abs(lat) > 69 && warm < 9) return 'polar';
	// the mountains
	if (starts(id, 'as.himalaya.kathmandu') && town) return city ? 'southcity' : 'southasia';
	if (starts(id, 'as.himalaya', 'as.tibet', 'as.afpak.north')) return 'himalaya';
	if (starts(id, 'sa.andes') && elev > 1800) return 'andes';
	if (starts(id, 'eu.alps') || (starts(id, 'eu') && !starts(id, ...MED) && elev > 900 && !city)) return 'alpine';
	// the grass sea
	if (starts(id, 'as.mongolia') || (starts(id, 'as.cn.gobi', 'as.central.steppe') && pop <= 0)) return 'steppe';
	// the cold north
	if ((cold < -7 && Math.abs(lat) > 47) || starts(id, 'as.ru.yakutia', 'eu.nordic.lapland')) return 'snow';
	// the old towns of the Islamic world: bazaars; their villages by climate
	if (starts(id, ...ISLAMIC_TOWNS)) {
		if (town) return 'bazaar';
		if (starts(id, 'as.central') && rain > 300) return 'steppe';
		return rain < 320 ? 'desert' : starts(id, ...MED) ? 'mediterranean' : 'desert';
	}
	if (starts(id, 'af.sahara')) return town ? 'bazaar' : 'desert';
	// East Asia
	if (starts(id, 'as.cn', 'as.jp', 'as.kr', 'as.tw')) return city ? 'eastcity' : 'eastvillage';
	if (starts(id, 'as.sea')) return city || starts(id, 'as.sea.sg') ? 'eastcity' : town && starts(id, 'as.sea.vn') ? 'eastvillage' : 'jungle';
	// South Asia
	if (starts(id, 'as.india', 'as.lanka', 'as.afpak')) return city ? 'southcity' : 'southasia';
	// Africa
	if (starts(id, 'af.sahel', 'af.west.hausa')) return 'sahel';
	if (starts(id, 'af.congo')) return 'jungle';
	if (starts(id, 'af.west')) return rain > 1400 && !town ? 'jungle' : 'savanna';
	if (starts(id, 'af.south.cape')) return 'mediterranean';
	if (starts(id, 'af')) return mean > 18 && rain > 1800 && !town ? 'jungle' : 'savanna';
	// the islands
	if (starts(id, 'pac.png')) return 'jungle';
	if (starts(id, 'pac', 'na.hi', 'atl.carib', 'atl.capeverde')) return 'island';
	// the Americas, Australia and New Zealand
	if (starts(id, 'oc.outback')) return 'outback';
	if (starts(id, 'na.sw', 'na.utah.canyons')) return 'pueblo';
	if (starts(id, 'sa.amazon')) return 'jungle';
	if (starts(id, 'na.cam', 'sa.co') && rain > 2000 && !town) return 'jungle';
	if (starts(id, 'na', 'oc', 'sa')) return rain < 260 && mean > 12 ? 'outback' : 'farm';
	// Europe and what is left
	if (starts(id, ...MED)) return 'mediterranean';
	if (starts(id, 'eu', 'as.caucasus', 'atl')) return 'village';
	// by climate alone
	if (rain < 260 && mean > 10) return 'desert';
	if (mean > 23 && rain > 1800) return 'jungle';
	if (mean > 19 && rain > 450) return 'savanna';
	return 'village';
}

// the kit at a place, with the blend near borders
export function kitAt(at, opts = {}) {
	if (!at) return null;
	const W = at.weights?.length ? at.weights : [{ id: at.id, w: 1 }];
	const sum = new Map();
	for (const x of W) {
		const R = x.id === at.id ? at.profile : region(x.id) || at.profile;
		const k = kitFor(x.id, R, { ...opts, lat: at.lat });
		sum.set(k, (sum.get(k) || 0) + x.w);
	}
	const weights = [...sum].map(([id, w]) => ({ id, w })).sort((a, b) => b.w - a.w);
	const id = weights[0].id;
	return { id, kit: KITS[id], weights, culture: cultureOf(at.id) };
}

// one of the blend's kits for a seed (a village near a border is one or the other)
export function kitPick(K, u) {
	let x = u;
	for (const k of K.weights) { if ((x -= k.w) <= 0) return KITS[k.id]; }
	return K.kit;
}
