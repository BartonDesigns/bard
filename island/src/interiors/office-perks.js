// What an office keeps for its people that is yours to use too: the coffee machine (a hot cup
// steadies you), the water cooler, the vending machine (a snack for a few credits), the
// first-aid box (patches you up, or a field medkit to take with you, one a day from each box)
// and a conference floor's buffet. The towers' floors list theirs (bay/towers.js amenities,
// placed by interiors/workplace-fitout.js); the city's offices are read from their furniture
// (interiors/furnish.js officeFit: the coffee bar with its first-aid box, the vending machine,
// the water); the walk-in offices on the streets keep the same, and a cinema's concession
// stand and the lanes' snack bar sell you something too (bay/commercial.js amenities, placed
// by bay/venuefit.js). Their kitchens' fridges are the cooking's (cooking/index.js). And in a
// shop with reach-in coolers what each door keeps cold, paid for at the till: you pull the door
// open, take a drink, a beer, milk or an ice cream of a maker on its shelves, and it swings shut
// (bay/storefit.js coolers, bay/cooler-doors.js). Anywhere else in a shop that sells something to
// carry away (the hardware, a pharmacy's medkits, the clothes: bay/storefit.js gearOf), its
// counter: the gear screen's sheet of what it sells (ui/gear.js, openShop).
//
// One prompt (E, or its button), like the kitchen's.

import { mintUid } from '../gameplay/gear-levels.js';
import { brandName } from '../signage/brand-catalog.js';

const STORE = 'bard:office-perks';
// how near you need to be, metres; how long before the same one does you good again, seconds
const REACH = 1.6;
const PERK = {
	coffee: { label: '☕ Coffee', hp: 10, wait: 90, line: 'A hot coffee from the office machine. You feel steadier.' },
	water: { label: '💧 Water', hp: 5, wait: 30, line: 'A cup of cold water from the cooler.' },
	vending: { label: '🥤 Vending machine', hp: 18, wait: 60, price: 3, line: 'Crisps and a fizzy drink from the machine' },
	buffet: { label: '🥐 Buffet', hp: 15, wait: 120, line: 'A pastry and a coffee from the conference buffet. Nobody minds.' },
	firstaid: { label: '🩹 First aid', hp: 40, wait: 600, line: 'You patch yourself up from the office first-aid box.' },
	popcorn: { label: '🍿 Popcorn', hp: 14, wait: 90, price: 6, line: 'A tub of popcorn and a cold soda from the concession stand' },
	snackbar: { label: '🌭 Snack bar', hp: 16, wait: 90, price: 5, line: 'A hot dog and a soda from the snack bar' },
	// (a cooler's door: door, whose makers are on its shelves, the brand catalog's family)
	colddrink: { label: '🥤 Cold drink', hp: 8, wait: 40, price: 2, door: 'beverages', line: (b) => `You pull the cooler open and take a cold ${b}` },
	coldbeer: { label: '🍺 Cold beer', hp: 6, wait: 60, price: 4, door: 'guild', line: (b) => `A cold bottle of ${b} ale from the cooler` },
	milk: { label: '🥛 Milk', hp: 8, wait: 60, price: 2, door: 'dairy', line: (b) => `A cold carton of ${/milk|dairy/i.test(b) ? b : `${b} milk`} from the cooler` },
	icecream: { label: '🍦 Ice cream', hp: 10, wait: 60, price: 3, door: 'produce', line: (b) => `${/^[aeiou]/i.test(b) ? 'An' : 'A'} ${b} ice lolly from the freezer` },
	// a Strip casino's (interiors/resort-fitout.js): its games played at ui/casino.js, its bar, its
	// buffet, the cashier at the cage
	slots: { label: '🎰 Play the slots', game: 'slots' },
	blackjack: { label: '🃏 Play blackjack', game: 'blackjack' },
	roulette: { label: '🎡 Play roulette', game: 'roulette' },
	cage: { label: '💰 Cashier', game: 'cage' },
	cocktail: { label: '🍸 Order a drink', hp: 8, wait: 60, price: 9, line: () => ['A margarita on the rocks from the casino bar', 'An old fashioned, poured long, from the casino bar', 'A vodka soda with lime from the casino bar', 'A cold beer from the casino bar', 'A dirty martini from the casino bar'][Math.floor(Math.random() * 5)] },
	casinobuffet: { label: '🦀 The buffet', hp: 40, wait: 300, price: 30, line: 'All you can eat at the buffet: crab legs, prime rib, a slice of cheesecake' },
};
// a maker's name as said (the catalog's shouted ones in plain capitals)
const said = (s) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s);
const lineOf = (P, q) => (typeof P.line === 'function' ? P.line(said(brandName(P.door, ((q.n || 0) % 8 + 8) % 8)) || 'drink') : P.line);
// the city offices' furniture that is one of them (its place on the item, in the item's frame:
// across, out in front)
const ITEMS = {
	coffeeBar: [['coffee', -0.6, 0.9], ['firstaid', 0.75, 0.9]],
	vending: [['vending', 0, 0.9]],
	waterCooler: [['water', 0, 0.5]],
};
const FACE = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const today = () => new Date().toISOString().slice(0, 10);

// world(): the world; camera: your eye; combat: its mend/hurt0 (combat/combat.js); arms: the
// wallet and the gear (gameplay/arms.js); button: main.js's; doorNear(), busy(): another prompt
// has E (a door, the kitchen)
// play(game, q): a casino's game to sit down at (ui/casino.js)
export function createOfficePerks({ mount, button, hint = () => {}, isPhone = false, world, camera, combat = null, arms = null, doorNear = () => false, busy = () => false, openShop = null, play = null }) {
	let here = null, hereT = 0, txN = 0;
	const used = new Map();
	let kept = {};
	try { kept = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { kept = {}; }
	const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(kept)); } catch { /* private mode */ } };

	// the city's offices: the things on your floor of the building you are in
	function cityPerks(eye) {
		const W = world(), I = W?.interiors?.inside?.(eye);
		if (!I) return [];
		const B = I.B, P = B.P, F = W.interiors.frame?.(B.o);
		if (!F || !P?.items) return [];
		const out = [];
		for (const it of P.items) {
			const list = ITEMS[it.type];
			if (!list || (P.rooms?.[it.room]?.k ?? I.level) !== I.level) continue;
			const [fx, fz] = FACE[it.rot || 0];
			for (const [kind, a, f] of list) {
				const lx = it.x + fz * a + fx * (it.d / 2 + f - 0.5), lz = it.z - fx * a + fz * (it.d / 2 + f - 0.5);
				const [x, z] = F.w(lx, lz), d = Math.hypot(x - eye.x, z - eye.z);
				if (d < REACH + 0.6) out.push({ kind, x, z, d, key: `${B.key}:${kind}:${Math.round(it.x * 10)}:${Math.round(it.z * 10)}`, place: 'office' });
			}
		}
		return out.sort((a, b) => a.d - b.d);
	}
	function find() {
		const W = world(), P = W?.player?.state;
		if (!P || P.flying) return null;
		const eye = camera.position;
		const near = [...(W.towers?.amenities?.(eye, REACH + 0.6) || []), ...cityPerks(eye), ...(W.commercial?.amenities?.(eye, REACH + 0.6) || [])].filter((q) => PERK[q.kind]).sort((a, b) => a.d - b.d);
		return near[0] && near[0].d < REACH + 0.6 ? near[0] : tillHere(W, eye);
	}
	// a shop you are in that sells what you can carry away: its counter, from anywhere inside
	function tillHere(W, eye) {
		const C = openShop && W.commercial?.inside?.(eye);
		if (!C?.gear) return null;
		return { kind: 'till', x: eye.x, z: eye.z, d: 0, key: `till:${Math.round(C.b.x)}:${Math.round(C.b.z)}`, place: 'shop', name: C.b.biz?.name || 'Shop', hours: C.hours || [0, 24], at: { x: C.b.x, y: eye.y, z: C.b.z } };
	}

	const act = button('☕ Coffee', 'Use it (E)', 'display:none;', 'prompt 58');
	mount?.appendChild(act);
	for (const ev of ['pointerdown', 'touchstart']) act.addEventListener(ev, (e) => e.stopPropagation());
	const label = (q) => (q.kind === 'till' ? `🛍 ${q.name}` : PERK[q.kind].label + (PERK[q.kind].price ? ` · ${PERK[q.kind].price} cr` : '')) + (isPhone ? '' : ' (E)');

	const mend = (n) => combat?.mend?.(n) || 0;
	function giveMedkit(q) {
		const day = today(), n = Date.now() % 100000;
		const out = arms?.apply?.({ id: `office:${q.key}:${day}:${(txN++).toString(36)}`.slice(0, 80), kind: 'trade', peer: `office:${q.key}`.slice(0, 40), give: { credits: 0, items: [] }, get: { credits: 0, items: [{ u: mintUid(`${q.key}:medkit:${day}`, n % 997), i: 'field-medkit', l: 1, t: 0, x: 0 }] } });
		return !!out?.ok;
	}
	function use(q = here) {
		if (!q) return;
		if (q.kind === 'till') { till(q); return; }
		if (PERK[q.kind]?.game) { if (play) play(PERK[q.kind].game, q); else hint('The table is closed.', 2000); return; }
		// (one cold drink a while from a shop's coolers, whichever door: its key without the door's place)
		const P = PERK[q.kind], now = performance.now() / 1000, wk = P.door ? q.key.replace(/(:-?\d+){2}$/, '') : q.key, last = used.get(wk) ?? -1e9;
		if (q.kind === 'firstaid') {
			const hurt = combat?.hurt0?.() || 0;
			if (hurt > 1 && now - last > P.wait) { used.set(q.key, now); const got = mend(P.hp); hint(`${P.line} (+${Math.round(got)} health)`, 3200); return; }
			if (kept[q.key] === today()) { hint(hurt > 1 ? 'The first-aid box is down to plasters. Try again in a while.' : 'You already took this box\'s spare medkit today.', 2600); return; }
			if (giveMedkit(q)) { kept[q.key] = today(); for (const k of Object.keys(kept)) if (kept[k] !== today()) delete kept[k]; keep(); hint('You took the spare field medkit from the first-aid box. It\'s in your gear.', 3500); }
			else hint('The first-aid box is locked.', 2200);
			return;
		}
		if (now - last < P.wait) { hint(P.door ? 'You just had one. Give it a minute.' : P.price ? 'You just had a snack. Give it a minute.' : q.kind === 'water' ? 'You just had a cup.' : 'You just had one. Give it a minute.', 2000); return; }
		if (P.price) {
			if (!arms?.spendCredits?.(P.price, { id: `office-vend-${Date.now().toString(36)}-${(txN++).toString(36)}`, kind: 'vending' })) { hint(P.door ? `That's ${P.price} credits at the till.` : `The machine wants ${P.price} credits.`, 2200); return; }
		}
		used.set(wk, now);
		// (the cooler's door swings open as you take it, and shut behind you)
		if (P.door) world()?.commercial?.swing?.(q.x, q.z, 2.4);
		const got = mend(P.hp), line = lineOf(P, q);
		hint(P.price ? `${line} (${P.price} credits)${got > 0 ? ` · +${Math.round(got)} health` : ''}.` : `${line}${got > 0 ? ` (+${Math.round(got)} health)` : ''}`, 2800);
	}
	// the shop's sheet: of the shops the gear knows, the one nearest the middle of this one (its
	// own, or its business's at its door), open its hours
	function till(q) {
		const h = world()?.sky?.state?.hours ?? 12, [a, b] = q.hours;
		if (!(h >= a && h < b)) { hint(`${q.name} is closed. It opens at ${String(Math.floor(a)).padStart(2, '0')}:${String(Math.round((a % 1) * 60)).padStart(2, '0')}.`, 2600); return; }
		const sh = (arms?.shops?.(q.at) || []).find((s) => !Number.isFinite(s.distance) || s.distance < 20);
		if (sh) openShop(sh.id);
		else hint('Nobody is at the till.', 2000);
	}
	act.addEventListener('click', (e) => { e.stopPropagation(); use(); });
	addEventListener('keydown', (e) => {
		if ((e.key !== 'e' && e.key !== 'E') || !here || e.repeat || e.metaKey || e.ctrlKey) return;
		if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || window._KEYS_PLAY_ON || doorNear() || busy()) return;
		e.preventDefault(); use();
	});
	function update(dt) {
		hereT -= dt;
		if (hereT > 0) return;
		hereT = 0.25;
		here = busy() ? null : find();
		act.style.display = here ? '' : 'none';
		if (here) { const s = label(here); if (act.textContent !== s) act.textContent = s; }
	}
	return { update, near: () => !!here, use: (kind) => use(kind ? { ...(here || {}), kind, key: here?.key || 'test' } : here), info: () => ({ here: here && { kind: here.kind, d: +here.d.toFixed(2), place: here.place } }) };
}
