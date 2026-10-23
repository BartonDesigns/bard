// Requests: what the businesses ask of whoever will help, so the town lives together. The pasta
// place wants an order taken to a customer, the waffle shop needs eggs from the farm stand, the
// farm stand needs its truck seen to at the garage, the fishing outfitter has a catch for the
// seafood place, the hunting post has lost a hound, the bed-and-breakfast has a guest to meet,
// the tech company a prototype to courier, the shop on a street with a pothole that jolts its
// deliveries wants it reported to the city (bay/potholes.js; a crew comes to fill it). Every pickup and drop is a real place from the
// registry (economy/layer.js near()) or a person at a real door, and the business pays.
//
// Anyone can take one: the player or someone in the town. The same business asks the same things
// on the same day (seeded by its id and the day), so a request can be talked about and found
// again. Payment goes through payroll.js (its onPay hook); nothing here keeps a purse.
//
// The shared descriptor (the morality work uses the same shape for people's own requests):
/**
 * @typedef {Object} RequestStep
 * @property {'go'|'pickup'|'deliver'|'talk'|'wait'|'fix'|'chase'} do
 * @property {{ x: number, z: number, name: string, establishmentId?: string }} at
 * @property {{ name: string, shape: string }} [item]
 *
 * @typedef {Object} Request
 * @property {string} id
 * @property {string} kind
 * @property {string} title
 * @property {{ type: 'business'|'person', id: string, name: string, x: number, z: number }} giver
 * @property {RequestStep[]} steps
 * @property {{ credits: number, from: string }} reward          from: an establishment id or a person id
 * @property {{ done: string, betray?: 'steal'|'robbery'|'kept-wallet' }} deeds   done: 'favour' or a morality RULES key
 * @property {number} tempt          0..1, how tempting it is to make off with it (cash, goods)
 * @property {string} region         the locale (establishments.js localeAt)
 * @property {number} expires        when it lapses (the board's clock, ms)
 */
//
//   requestsFor(E, places, { day, now, homes })   one establishment's requests for a day (pure)
//   nearestPast(d, far, n)   the n nearest past far, as a steady sort of all would have them
//   const board = createBoard({ near, homes, clock, payroll })
//   board.near(x, z, r)  board.take(id, takerId)  board.complete(id, takerId, outcome)
// and the game's own board, as requestsNear / takeRequest / completeRequest.

import { hashAt, LOCALES } from './establishments.js';
import { payroll as gamePayroll } from './payroll.js';

const FOOD = ['cafe', 'bakery', 'waffle', 'donut', 'boba', 'icecream', 'pasta', 'pizza', 'diner', 'burger', 'taco', 'sushi', 'ramen', 'bistro', 'pub', 'bbq', 'seafood', 'curry', 'noodles', 'tapas', 'izakaya', 'grill'];
const RESTAURANT = FOOD.filter((t) => !['cafe', 'bakery', 'donut', 'boba', 'icecream', 'waffle'].includes(t));
const OFFICE = ['tech', 'law', 'design', 'finance', 'agency', 'realtor', 'clinic', 'dental', 'insurance'];
const STAY = ['bnb', 'motel', 'cabins', 'hotel'];
const SHOP = ['bookshop', 'florist', 'hardware', 'grocer', 'pharmacy', 'outfitter', 'bait', 'surf', 'huntpost', 'general', 'feed', 'antiques', 'bike', 'records', 'thrift', 'pet', 'liquor', 'phonefix', 'boutique', 'gift', 'butcher', 'winery', 'farmstand'];
// what a kitchen sends out in a bag
const DISH = { cafe: 'a tray of coffees', bakery: 'a box of pastries', waffle: 'a stack of waffles', donut: 'a dozen donuts', boba: 'a carrier of bubble teas', icecream: 'a tub of ice cream', pasta: 'two tubs of carbonara', pizza: 'three pizzas', diner: 'a breakfast platter', burger: 'a sack of burgers', taco: 'a bag of tacos', sushi: 'a sushi platter', ramen: 'two bowls of ramen', bistro: 'a dinner for two', pub: 'fish pie and chips', bbq: 'a pound of brisket', seafood: 'a pot of chowder', curry: 'a curry for four', noodles: 'a bag of dumplings', tapas: 'a box of tapas', izakaya: 'skewers and rice', grill: 'a sack of kebabs' };
// what a business runs short of, and who has it
const NEEDS = {
	waffle: [['eggs', 'crate', ['farmstand', 'grocer']], ['syrup', 'box', ['grocer', 'general']]],
	bakery: [['flour', 'sack', ['feed', 'grocer', 'general']], ['eggs', 'crate', ['farmstand', 'grocer']]],
	diner: [['eggs', 'crate', ['farmstand', 'grocer']], ['coffee beans', 'sack', ['roastery', 'cafe']]],
	cafe: [['coffee beans', 'sack', ['roastery']], ['milk', 'crate', ['grocer', 'farmstand']]],
	pasta: [['tomatoes', 'crate', ['farmstand', 'grocer']], ['basil', 'box', ['florist', 'farmstand', 'grocer']]],
	pizza: [['mozzarella', 'box', ['grocer', 'butcher']], ['flour', 'sack', ['feed', 'grocer']]],
	burger: [['buns', 'crate', ['bakery']], ['beef', 'box', ['butcher', 'grocer']]],
	taco: [['tortillas', 'crate', ['bakery', 'grocer']], ['limes', 'crate', ['farmstand', 'grocer']]],
	bbq: [['oak for the smoker', 'logs', ['woodshop', 'general', 'feed']], ['a side of beef', 'box', ['butcher']]],
	seafood: [['the morning catch', 'crate', ['outfitter', 'fishmarket', 'boatyard']]],
	sushi: [['fresh tuna', 'crate', ['fishmarket', 'outfitter']]],
	pub: [['two kegs', 'keg', ['brewery']]],
	bistro: [['wine', 'case', ['winery', 'liquor']]],
	icecream: [['cream', 'crate', ['farmstand', 'grocer']]],
	florist: [['cut flowers', 'bucket', ['farmstand']]],
	grocer: [['produce', 'crate', ['farmstand']]],
	hardware: [['lumber', 'bundle', ['woodshop', 'movers']]],
	bookshop: [['a box of printed flyers', 'box', ['printshop']]],
	bnb: [['clean linens', 'bundle', ['laundromat']], ['fresh bread', 'bag', ['bakery']]],
	hotel: [['clean linens', 'bundle', ['laundromat']]],
	outfitter: [['bait', 'bucket', ['bait', 'fishmarket']], ['a new net', 'bundle', ['boatyard', 'general']]],
	huntpost: [['boxes of cartridges', 'box', ['hardware', 'general']]],
	butcher: [['game from the hills', 'box', ['huntpost']]],
	winery: [['oak barrels', 'barrel', ['woodshop', 'brewery']]],
	brewery: [['grain', 'sack', ['feed']]],
	farmstand: [['seed and feed', 'sack', ['feed', 'general']]],
};

const round5 = (v) => Math.max(10, Math.min(250, Math.round(v / 5) * 5));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// the places of the n nearest past far, given each one's distance d: their places in d, in the
// order a steady sort gives (nearer first, and of two as near the earlier), without sorting all
export function nearestPast(d, far, n) {
	const c = [];
	for (let i = 0; i < d.length; i++) {
		const v = d[i];
		if (!(v > far) || (c.length === n && !(v < d[c[n - 1]]))) continue;
		let k = c.length < n ? c.length : n - 1;
		while (k > 0 && d[c[k - 1]] > v) k--;
		c.splice(k, 0, i);
		if (c.length > n) c.pop();
	}
	return c;
}

// one establishment's requests on a day: places is the registry round it (establishments, with
// id, name, type, x, z, door); homes are doors of houses round it ({ x, z }); hole: a pothole in
// the street near it not yet reported ({ id, x, z, street }), if there is one
export function requestsFor(E, places, { day = 0, now = 0, homes = [], hole = null } = {}) {
	const r = (n) => hashAt(E.x + day * 0.37, E.z - day * 0.53, 7000 + n);
	const L = LOCALES[E.locale] || LOCALES.us, F = L.F;
	const here = { x: E.door?.[0] ?? E.x, z: E.door?.[1] ?? E.z, name: E.name, establishmentId: E.id };
	const others = places.filter((p) => p.id !== E.id);
	const placeOf = (P) => ({ x: P.door?.[0] ?? P.x, z: P.door?.[1] ?? P.z, name: P.name, establishmentId: P.id });
	// the nearest few of some kinds, one picked by the day (each place's distance measured once,
	// when first wanted: downtown the registry round a place is thousands strong, and sorting it
	// all, measuring both sides at every turn, for each place in turn stalled a walk for seconds)
	let D = null;
	const dists = () => D || (D = others.map((p) => dist(p, E)));
	const find = (types, n) => {
		const d = dists(), at = [];
		for (let i = 0; i < others.length; i++) if (types.includes(others[i].type)) at.push(i);
		const c = at.sort((a, b) => d[a] - d[b]).slice(0, 4).map((i) => others[i]);
		return c.length ? c[Math.floor(r(n) * c.length)] : null;
	};
	const anyOther = (n, far = 120) => { const c = nearestPast(dists(), far, 8); return c.length ? others[c[Math.floor(r(n) * c.length)]] : null; };
	const person = (n) => { const h = homes.length ? homes[Math.floor(r(n) * homes.length)] : null; const who = F[Math.floor(r(n + 1) * F.length)]; return h ? { x: h.x, z: h.z, name: `${who}'s house`, who } : null; };
	const out = [];
	const add = (kind, title, steps, base, { tempt = 0.2, betray = undefined, done = 'favour', life = 40 } = {}) => {
		let metres = 0, prev = here;
		for (const s of steps) { metres += dist(prev, s.at); prev = s.at; }
		const R = { id: `req:${E.id}:${day}:${out.length}`, kind, title, giver: { type: 'business', id: E.id, name: E.name, x: here.x, z: here.z }, steps, reward: { credits: round5(base + metres * 0.03), from: E.id }, deeds: betray ? { done, betray } : { done }, tempt, region: E.locale || 'us', expires: now + life * 60000 };
		out.push(R);
	};
	const T = E.type;
	const tries = [];
	// a kitchen: an order out to a customer, supplies in, a shift covered, a card left behind, flyers
	if (FOOD.includes(T)) {
		tries.push(() => { const P = person(1); if (P) add('delivery', `Take ${DISH[T] || 'an order'} to ${P.name}`, [{ do: 'pickup', at: here, item: { name: DISH[T] || 'an order', shape: 'bag' } }, { do: 'deliver', at: P }], 15, { tempt: 0.25, betray: 'steal' }); });
		tries.push(() => { const P = person(3); if (P) add('lost-card', `A customer, ${P.who}, left a bank card at ${E.name}: take it back`, [{ do: 'pickup', at: here, item: { name: `${P.who}'s bank card`, shape: 'card' } }, { do: 'deliver', at: P }], 15, { tempt: 0.6, betray: 'kept-wallet' }); });
		tries.push(() => add('shift', `Cover a shift at ${E.name}: someone called in sick`, [{ do: 'go', at: here }, { do: 'wait', at: here }], 45, { tempt: 0.1, life: 90 }));
		tries.push(() => { const A = anyOther(5), B = anyOther(6, 220); if (A && B && A !== B) add('flyers', `Hand out ${E.name}'s flyers at ${A.name} and ${B.name}`, [{ do: 'pickup', at: here, item: { name: 'a stack of flyers', shape: 'paper' } }, { do: 'talk', at: placeOf(A) }, { do: 'talk', at: placeOf(B) }], 15, { tempt: 0.02 }); });
		tries.push(() => { const B = find(['finance'], 7); if (B) add('takings', `Take the day's takings from ${E.name} to ${B.name}`, [{ do: 'pickup', at: here, item: { name: 'a bag of cash', shape: 'bag' } }, { do: 'deliver', at: placeOf(B) }], 25, { tempt: 0.9, betray: 'kept-wallet' }); });
	}
	// supplies: what it runs short of, from whoever has it (the chains: eggs from the farm stand...)
	for (const [n, [what, shape, from]] of (NEEDS[T] || []).entries()) {
		tries.push(() => { const S = find(from, 20 + n); if (S) add('supply', `${E.name} needs ${what} from ${S.name}`, [{ do: 'go', at: placeOf(S) }, { do: 'pickup', at: placeOf(S), item: { name: what, shape } }, { do: 'deliver', at: here }], 15, { tempt: 0.3, betray: 'steal' }); });
	}
	// the water: the catch to a kitchen, crew for the outrigger, gear brought back
	if (T === 'outfitter' || T === 'fishmarket' || T === 'boatyard') {
		tries.push(() => { const K = find(['seafood', 'sushi', 'bistro', 'pub', 'izakaya', 'tapas'], 30); if (K) add('catch', `Bring the catch from ${E.name} to ${K.name}`, [{ do: 'pickup', at: here, item: { name: 'a crate of fish on ice', shape: 'crate' } }, { do: 'deliver', at: placeOf(K) }], 20, { tempt: 0.35, betray: 'steal' }); });
		if (T === 'outfitter') tries.push(() => add('crew', `Crew ${E.name}'s outrigger for the morning charter`, [{ do: 'go', at: here }, { do: 'wait', at: { ...here, name: `${E.name}'s outrigger` } }], 40, { tempt: 0.05, life: 60 }));
		tries.push(() => { const P = person(31); if (P) add('rental', `${P.who} never brought back a rented rod: fetch it for ${E.name}`, [{ do: 'go', at: P }, { do: 'pickup', at: P, item: { name: 'a fishing rod', shape: 'rod' } }, { do: 'deliver', at: here }], 15, { tempt: 0.2, betray: 'steal' }); });
	}
	// the woods: game to the butcher, a hound gone after a scent, a hiker turned around
	if (T === 'huntpost' || T === 'cabins') {
		const woods = { x: E.x + (r(40) - 0.5) * 500, z: E.z + (r(41) - 0.5) * 500, name: 'the woods' };
		tries.push(() => { const B = find(['butcher', 'bbq', 'diner', 'pub'], 42); if (B && T === 'huntpost') add('game', `Carry a dressed deer from ${E.name} to ${B.name}`, [{ do: 'pickup', at: here, item: { name: 'venison, wrapped', shape: 'crate' } }, { do: 'deliver', at: placeOf(B) }], 25, { tempt: 0.3, betray: 'steal' }); });
		tries.push(() => add('hound', `${E.name}'s hound went off after a scent: find her and bring her back`, [{ do: 'chase', at: woods, item: { name: 'a hound', shape: 'dog' } }, { do: 'deliver', at: here }], 30, { tempt: 0.05 }));
		tries.push(() => add('guide', 'A hiker is lost out past the trailhead: bring them in', [{ do: 'talk', at: { ...woods, name: 'a lost hiker' } }, { do: 'go', at: here }], 30, { tempt: 0.1 }));
	}
	// somewhere to stay: a guest to meet, linens in, a guest sent to dinner
	if (STAY.includes(T)) {
		tries.push(() => { const M = find(['cafe', 'diner', 'bakery'], 50) || anyOther(51); if (M) add('guest', `Meet ${E.name}'s guest outside ${M.name} and walk them over`, [{ do: 'talk', at: { ...placeOf(M), name: `a guest outside ${M.name}` } }, { do: 'go', at: here }], 20, { tempt: 0.15, betray: 'robbery' }); });
		tries.push(() => { const K = find(RESTAURANT, 52); if (K) add('recommend', `A guest at ${E.name} wants dinner: take them to ${K.name}`, [{ do: 'talk', at: here }, { do: 'go', at: placeOf(K) }], 15, { tempt: 0.05 }); });
	}
	// offices: a prototype, a laptop left behind, lunch for the team, papers to sign
	if (OFFICE.includes(T)) {
		tries.push(() => { const O = find(OFFICE, 60) || anyOther(61); if (O) add('courier', T === 'tech' ? `Courier a prototype from ${E.name} to ${O.name}` : `Take signed papers from ${E.name} to ${O.name}`, [{ do: 'pickup', at: here, item: T === 'tech' ? { name: 'a prototype in a case', shape: 'case' } : { name: 'an envelope of contracts', shape: 'paper' } }, { do: 'deliver', at: placeOf(O) }], 25, { tempt: T === 'tech' ? 0.7 : 0.3, betray: 'steal' }); });
		tries.push(() => { const C = find(['cafe', 'bakery', 'diner', 'pub'], 62); if (C) add('laptop', `Someone from ${E.name} left a laptop at ${C.name}: get it back before anyone walks off with it`, [{ do: 'go', at: placeOf(C) }, { do: 'pickup', at: placeOf(C), item: { name: 'a laptop', shape: 'case' } }, { do: 'deliver', at: here }], 20, { tempt: 0.65, betray: 'steal' }); });
		tries.push(() => { const K = find(RESTAURANT.concat(['cafe']), 63); if (K) add('lunch', `Fetch lunch for the team at ${E.name} from ${K.name}`, [{ do: 'pickup', at: placeOf(K), item: { name: DISH[K.type] || 'lunch for eight', shape: 'bag' } }, { do: 'deliver', at: here }], 15, { tempt: 0.2, betray: 'steal' }); });
	}
	// shops: stock to fetch, a thief to stop, parcels left at the wrong door
	if (SHOP.includes(T)) {
		tries.push(() => { const near2 = { x: here.x + (r(70) - 0.5) * 160, z: here.z + (r(71) - 0.5) * 160, name: `the street by ${E.name}` }; add('shoplifter', `Someone ran out of ${E.name} without paying: catch them and bring it back`, [{ do: 'chase', at: near2, item: { name: 'what they took', shape: 'bag' } }, { do: 'deliver', at: here }], 30, { tempt: 0.4, betray: 'steal', done: 'favour' }); });
		tries.push(() => { const O = anyOther(72); if (O) add('parcels', `Parcels for ${O.name} were left at ${E.name}: take them over`, [{ do: 'pickup', at: here, item: { name: 'two parcels', shape: 'box' } }, { do: 'deliver', at: placeOf(O) }], 12, { tempt: 0.35, betray: 'steal' }); });
	}
	// the trades: kegs to the pub, a table to a café, the farm stand's truck mended
	if (T === 'brewery') tries.push(() => { const P = find(['pub', 'bistro', 'bbq', 'tapas'], 80); if (P) add('kegs', `Deliver kegs from ${E.name} to ${P.name}`, [{ do: 'pickup', at: here, item: { name: 'two kegs', shape: 'keg' } }, { do: 'deliver', at: placeOf(P) }], 20, { tempt: 0.3, betray: 'steal' }); });
	if (T === 'woodshop') tries.push(() => { const C = find(FOOD, 81); if (C) add('furniture', `Deliver a new table from ${E.name} to ${C.name}`, [{ do: 'pickup', at: here, item: { name: 'an oak table', shape: 'table' } }, { do: 'deliver', at: placeOf(C) }], 20, { tempt: 0.1 }); });
	if (T === 'farmstand' || T === 'feed' || T === 'general') tries.push(() => { const G = find(['autorepair'], 82); if (G) add('truck', `${E.name}'s truck will not start: fetch a part from ${G.name} and fix it`, [{ do: 'go', at: placeOf(G) }, { do: 'pickup', at: placeOf(G), item: { name: 'a starter motor', shape: 'box' } }, { do: 'fix', at: { ...here, name: `${E.name}'s truck` } }], 35, { tempt: 0.15, betray: 'steal' }); });
	if (T === 'laundromat') tries.push(() => { const S = find(STAY, 83); if (S) add('linens', `Take clean linens from ${E.name} to ${S.name}`, [{ do: 'pickup', at: here, item: { name: 'a bundle of linens', shape: 'bundle' } }, { do: 'deliver', at: placeOf(S) }], 12, { tempt: 0.1 }); });
	if (T === 'vet' || T === 'pet') tries.push(() => { const P = person(84); if (P) add('pet', `${P.who}'s cat slipped out at ${E.name}: find it and take it home`, [{ do: 'chase', at: { x: here.x + (r(85) - 0.5) * 200, z: here.z + (r(86) - 0.5) * 200, name: 'the gardens nearby' }, item: { name: 'a ginger cat', shape: 'cat' } }, { do: 'deliver', at: P }], 20, { tempt: 0.02 }); });
	if (T === 'printshop' || T === 'roastery') tries.push(() => { const C = find(T === 'roastery' ? ['cafe', 'bakery', 'diner'] : FOOD, 87); if (C) add('delivery', `Deliver ${T === 'roastery' ? 'sacks of beans' : 'new menus'} from ${E.name} to ${C.name}`, [{ do: 'pickup', at: here, item: { name: T === 'roastery' ? 'sacks of beans' : 'a box of menus', shape: 'box' } }, { do: 'deliver', at: placeOf(C) }], 15, { tempt: 0.15, betray: 'steal' }); });
	if (T === 'autorepair') tries.push(() => { const P = person(88); if (P) add('tow', `${P.who}'s car broke down: take ${E.name}'s jump pack over and fix it`, [{ do: 'pickup', at: here, item: { name: 'a jump pack', shape: 'box' } }, { do: 'fix', at: { ...P, name: `${P.who}'s car` } }], 25, { tempt: 0.2, betray: 'steal' }); });
	if (T === 'salon' || T === 'barber' || T === 'gym' || T === 'yoga' || T === 'daycare' || T === 'tutor' || T === 'tattoo') tries.push(() => { const S = find(['pharmacy', 'grocer', 'general', 'hardware'], 89); if (S) add('supply', `${E.name} is out of supplies: pick some up at ${S.name}`, [{ do: 'pickup', at: placeOf(S), item: { name: 'a box of supplies', shape: 'box' } }, { do: 'deliver', at: here }], 12, { tempt: 0.2, betray: 'steal' }); });
	// a pothole in its street: reported by whoever stands by it, and the city sends a crew
	if (hole && (FOOD.includes(T) || SHOP.includes(T) || STAY.includes(T) || T === 'autorepair')) {
		const at = { x: hole.x, z: hole.z, name: hole.street ? `the pothole on ${hole.street}` : 'the pothole down the street', holeId: hole.id };
		tries.push(() => { add('pothole', `${E.name}'s deliveries keep hitting a pothole${hole.street ? ' on ' + hole.street : ''}: report it to the city`, [{ do: 'go', at }, { do: 'wait', at }], 12, { tempt: 0.02 }); out[out.length - 1].hole = hole; });
	}
	// one to three today, chosen by the day
	const n = 1 + Math.floor(r(99) * Math.min(3, tries.length));
	const start = Math.floor(r(98) * tries.length);
	for (let k = 0; k < tries.length && out.length < n; k++) tries[(start + k) % tries.length]();
	return out;
}

// a board of requests over the registry: open ones round a point, taken by someone, done
export function createBoard({ near = () => [], homes = () => [], clock = () => Date.now(), payroll = gamePayroll, dayMs = 24 * 60 * 60 * 1000, storage = null, scope = 'local' } = {}) {
	const known = new Map(), made = new Set(), listeners = new Set();
	let scopeKey = String(scope), saving = true, claimGuard = null;
	const key = () => 'l99-business-requests-v1:' + encodeURIComponent(scopeKey);
	function save() {
		if (!storage) return true;
		try { storage.setItem(key(), JSON.stringify({ version: 1, requests: [...known.values()].slice(-600) })); saving = true; return true; }
		catch { saving = false; return false; }
	}
	function load() {
		known.clear(); made.clear();
		try {
			const data = JSON.parse(storage?.getItem(key()) || 'null');
			for (const R of (data?.requests || []).slice(-600)) {
				if (typeof R?.id === 'string' && Array.isArray(R.steps) && R.giver && ['open', 'taken', 'done', 'failed', 'betrayed'].includes(R.status)) known.set(R.id, R);
			}
		} catch { /* An unavailable save never invents a receipt. */ }
	}
	function emit(type, request, extra = {}) { for (const fn of listeners) { try { fn({ type, request, scope: scopeKey, ...extra }); } catch { /* Observer cannot undo a source transaction. */ } } }
	load();
	function near2(x, z, r = 400) {
		const now = clock(), day = Math.floor(now / dayMs), places = near(x, z, r + 600);
		let changed = false;
		const H = homes(x, z, r + 300);
		for (const E of places) {
			if (Math.hypot(E.x - x, E.z - z) > r) continue;
			const key = E.id + '@' + day;
			if (made.has(key)) continue;
			made.add(key); changed = true;
			const hole = potholes?.near?.(E.door?.[0] ?? E.x, E.door?.[1] ?? E.z, 150) || null;
			for (const R of requestsFor(E, places, { day, now, homes: H, hole })) if (!known.has(R.id)) known.set(R.id, { ...R, status: 'open', taker: null });
		}
		// (the old and lapsed forgotten)
		if (known.size > 600) for (const [id, R] of known) if (R.expires < now - 3600000) known.delete(id);
		if (changed) save();
		return [...known.values()].filter((R) => R.status === 'open' && R.expires > now && Math.hypot(R.giver.x - x, R.giver.z - z) < r).sort((a, b) => Math.hypot(a.giver.x - x, a.giver.z - z) - Math.hypot(b.giver.x - x, b.giver.z - z));
	}
	function take(id, takerId) {
		const R = known.get(id);
		if (!R || R.status !== 'open' || R.expires < clock() || (claimGuard && !claimGuard(R, takerId))) return null;
		R.status = 'taken'; R.taker = takerId;
		if (!save()) { R.status = 'open'; R.taker = null; return null; }
		emit('taken', R);
		return R;
	}
	// outcome: 'done' (paid), 'failed' (no pay), or a betrayal ('steal', 'robbery', 'kept-wallet')
	function complete(id, takerId, outcome = 'done') {
		const R = known.get(id);
		if (!R || R.status !== 'taken' || R.taker !== takerId) return { ok: false, reason: R ? 'not yours' : 'unknown request' };
		if (outcome === 'done') {
			// Commit a terminal receipt before issuing money: reloads cannot pay twice.
			R.status = 'done'; R.completedAt = clock(); R.receiptId = `request:${scopeKey}:${id}:done`;
			if (!save()) { R.status = 'taken'; delete R.completedAt; delete R.receiptId; return { ok: false, reason: 'Could not save this completion; try again.' }; }
			const paid = R.rewardMode === 'discount' ? 0 : payroll.payFrom(R.reward.from, takerId, R.reward.credits, 'request: ' + R.kind);
			if (R.kind === 'pothole' && R.hole) potholes?.report?.(R.hole);
			R.paid = paid; save(); emit('completed', R, { paid });
			return { ok: true, paid, deed: R.deeds.done, request: R, receiptId: R.receiptId };
		}
		R.status = outcome === 'failed' ? 'failed' : 'betrayed';
		save(); emit('completed', R, { paid: 0 });
		return { ok: true, paid: 0, deed: outcome === 'failed' ? null : R.deeds.betray || outcome, request: R };
	}
	function release(id, takerId) {
		const R = known.get(id); if (!R || R.status !== 'taken' || R.taker !== takerId) return false;
		R.status = 'open'; R.taker = null; save(); emit('released', R); return true;
	}
	function agreeReward(id, takerId, { rewardMode, agreementId } = {}) {
		const R = known.get(id);
		if (!R || R.status !== 'taken' || R.taker !== takerId || rewardMode !== 'discount' || typeof agreementId !== 'string' || !agreementId) return false;
		if (R.agreementId && R.agreementId !== agreementId) return false;
		const previous = { rewardMode: R.rewardMode, agreementId: R.agreementId };
		R.rewardMode = rewardMode; R.agreementId = agreementId;
		if (!save()) { Object.assign(R, previous); return false; }
		return true;
	}
	function clearAgreement(id, takerId, agreementId) {
		const R = known.get(id);
		if (R?.taker === takerId && R.releasedAgreementId === agreementId && R.rewardMode === 'cash') return true;
		if (!R || R.taker !== takerId || R.agreementId !== agreementId || R.rewardMode !== 'discount') return false;
		const previous = { rewardMode: R.rewardMode, agreementId: R.agreementId };
		R.rewardMode = 'cash'; R.agreementId = null; R.releasedAgreementId = agreementId;
		if (!save()) { Object.assign(R, previous); return false; }
		// A cancelled item agreement restores the original work reward once. Persist
		// the conversion before emitting a payout so reloads cannot replay it.
		if (R.status === 'done' && !R.paid) { R.paid = payroll.payFrom(R.reward.from, takerId, R.reward.credits, 'request: ' + R.kind); save(); }
		return true;
	}
	return { near: near2, take, complete, release, agreeReward, clearAgreement,
		list: () => [...known.values()],
		onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
		setClaimGuard: (fn) => { claimGuard = fn; },
		setScope: (next) => { next = String(next); if (next !== scopeKey) { save(); scopeKey = next; load(); } },
		status: () => ({ scope: scopeKey, savedLocally: saving }),
		get: (id) => known.get(id) || null, counts: () => { const c = { open: 0, taken: 0, done: 0, failed: 0, betrayed: 0 }; for (const R of known.values()) c[R.status === 'open' && R.expires < clock() ? 'failed' : R.status]++; return c; } };
}

// the potholes (bay/streets.js gives them: near(x, z, r) the nearest not yet reported, report(hole))
let potholes = null;
export function setPotholeSource(src) { potholes = src; }

// the game's board (the city gives it the registry: economy/layer.js)
export let board = createBoard();
export function setRequestSource({ near, homes, clock }) {
	let storage = null; try { storage = globalThis.localStorage; } catch { /* private mode */ }
	board = createBoard({ near, homes, clock, storage });
}
export const requestsNear = (x, z, r) => board.near(x, z, r);
export const takeRequest = (id, takerId) => board.take(id, takerId);
export const completeRequest = (id, takerId, outcome) => board.complete(id, takerId, outcome);
