// The working life of a town: which buildings are businesses, what each one is, what it is
// called and how it shows it. A café with tables out front, a fishing outfitter with an
// outrigger canoe on its rack by the water, a hunting post with antlers over the door at the
// edge of the woods, a bed-and-breakfast with its sign on a post in the front garden, a
// burger stand with its drive-through lane, a tech company behind its monument sign.
//
// Pure: no three, no document, so the node tests and the town generator can use it. The same
// building (by where it stands) is always the same business with the same name; the place's
// food and words come from where on Earth it is (localeAt). Every name is made up from word
// parts; none is a real brand or chain (DENY is checked, and the tests check it again).
//
//   const E = establish(b, locale)       one building -> its establishment, or null (a home)
//   const town = planTown(list, opts)    every building of a town, names unique within it
//
// A building as the economy sees it (the city and the town generator fill these in):
//   { x, z, w, d, a, h, use, street, coast, wild, rural, highway, down, venue, sign }
//   use      house | row | shop | retail | office | tower | apt | industry | school | civic
//   street   0 a quiet street, 1 a corner or a collector, 2 an arterial or a main street
//   coast    by the sea or a harbour; wild: at the edge of the woods; rural: open country
//   shore    0 inland, 1 near the coast, 2 by the harbour, 3 on the waterfront (frontage.js)
//   highway  by a freeway exit; down: how downtown it is (0..1)
//   venue    what bay/commercial.js builds inside it (economy/venue.js), if anything
//   sign     a sign text from the town's brief (earth/director.js), in the local language

import { venueOf } from './venue.js';

// ---------- small tools ----------
// a position to 0..1 (rounded to half a metre, so a lot rebuilt in the same place agrees)
export function hashAt(x, z, salt = 0) {
	let h = Math.imul(Math.round(x * 2) | 0, 0x9e3779b1) ^ Math.imul(Math.round(z * 2) | 0, 0x85ebca6b) ^ Math.imul(salt | 0, 0xc2b2ae35);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const pickOf = (a, u) => a[Math.min(a.length - 1, Math.floor(u * a.length))];

// ---------- where it stands ----------
export const SETTINGS = ['downtown', 'main', 'strip', 'park', 'harbour', 'rural', 'forest', 'highway', 'residential', 'industrial'];

// ---------- the kinds of business ----------
// u: the buildings it takes (H house, R row house, S shopfront, T strip or big box, O office,
// W tower, A a block of flats' ground floor, I a shed or warehouse); v: the walk-in fit-out
// it agrees with (economy/venue.js); w: how common by setting; s: its sign [shape, lettering]
// (shapes rect, oval, pill, arch, banner, plank, neon, block; lettering serif, sans, script,
// slab, narrow); pal: [board, letters]; awn: awning colours (sRGB); props: what stands out
// front (economy/layer.js); n: how it is named ({F} a first name, {S} a surname, {A} a word
// that describes, {W} and {W2} the place's words, {X} a company ending); tag: the small line
const OLD_PAL = [['#2b1a10', '#e8c873'], ['#1d3b2a', '#f1dfb0'], ['#3b2a1a', '#e8d6a8']];
const LIGHT_PAL = [['#f4efe4', '#2d4a3a'], ['#fff6ea', '#7a2e1f'], ['#f3ead6', '#1f3b4d']];
const DARK_PAL = [['#1f3b4d', '#f6d38a'], ['#2a2a2a', '#f2f2f2'], ['#5a2232', '#f3e7d3']];
const NEON_PAL = [['#101820', '#ff5e7e'], ['#12333f', '#7fe3ff'], ['#1b1b2f', '#f9d65c']];
export const TYPES = {
	// eating and drinking
	cafe: { label: 'café', u: 'HRSTAO', v: 'cafe', w: { downtown: 4, main: 5, strip: 1.5, park: 1, harbour: 2, rural: 1, forest: 0.5, highway: 1, residential: 1.4, industrial: 0.5 }, s: ['oval', 'serif'], pal: [['#3b2a20', '#f3e6c8'], ['#f4efe4', '#2d4a3a'], ['#1f3b4d', '#f6d38a'], ['#7a2e1f', '#fbe9d0']], awn: [[0.24, 0.36, 0.3], [0.55, 0.2, 0.14], [0.15, 0.22, 0.32]], props: ['table', 'table', 'aboard'], n: ['{A} {W} Coffee', "{F}'s Café", 'Café {W}', 'The {A} Cup', '{W} Coffee House', '{W} & {W2} Roasters', 'Little {W} Espresso'], tag: 'COFFEE · PASTRIES' },
	bakery: { label: 'bakery', u: 'HRSTA', v: 'cafe', w: { downtown: 2, main: 3, strip: 1, harbour: 1, rural: 1, residential: 1.2 }, s: ['arch', 'script'], pal: [['#f6e7c8', '#7a3b1c'], ['#c9a26b', '#3a1f10'], ['#fff6ea', '#b5432f']], awn: [[0.85, 0.62, 0.42], [0.92, 0.86, 0.72], [0.6, 0.3, 0.2]], props: ['aboard', 'bench'], n: ["{F}'s Bakery", '{A} Crust Bakery', '{W} Bread Co.', 'The {W} Oven', 'The {A} Loaf', 'Rise & {W}'], tag: 'BREAD · CAKES' },
	waffle: { label: 'waffle shop', u: 'HRSTA', v: 'cafe', w: { downtown: 1, main: 1.5, strip: 1.5, harbour: 1, highway: 1, residential: 0.6 }, s: ['pill', 'slab'], pal: [['#f2b632', '#5a2d0c'], ['#ffe9b0', '#8a3b12'], ['#d9482b', '#fff2d6']], awn: [[0.95, 0.72, 0.2], [0.85, 0.28, 0.18]], props: ['table', 'aboard'], n: ['The {A} Waffle Iron', "{F}'s Waffles", 'Waffle & {W}', 'The {W} Waffle', 'Syrup & {W}', '{W} Waffle Co.'], tag: 'WAFFLES · CREPES' },
	donut: { label: 'donut shop', u: 'STA', v: 'cafe', w: { strip: 2, main: 0.8, highway: 1 }, s: ['pill', 'sans'], pal: [['#f7a6c1', '#5b1a33'], ['#fff1f6', '#d0457a']], awn: [[0.96, 0.6, 0.72], [0.98, 0.9, 0.9]], props: ['aboard'], n: ['{A} Donut', "{F}'s Donuts", '{W} Donut Shop', 'Ring & {W} Donuts'], tag: 'DONUTS · COFFEE' },
	boba: { label: 'bubble tea', u: 'STA', v: 'cafe', w: { strip: 1.5, main: 1, downtown: 1 }, s: ['pill', 'sans'], pal: [['#2f8f7f', '#ffffff'], ['#fbe7d2', '#6a3b2a']], awn: [[0.3, 0.62, 0.56]], props: ['aboard'], n: ['{W} Tea Bar', 'Bubble {W}', '{A} Pearl Tea', '{W} Milk Tea'], tag: 'BUBBLE TEA' },
	icecream: { label: 'ice cream', u: 'HRSTA', v: 'cafe', w: { main: 1.2, harbour: 2, strip: 0.8, residential: 0.4, downtown: 0.6 }, s: ['oval', 'script'], pal: [['#ffd1e1', '#7b2a4d'], ['#d6f1f4', '#1f5f74'], ['#fff5d1', '#c14a2b']], awn: [[0.96, 0.7, 0.8], [0.6, 0.85, 0.9], [0.98, 0.92, 0.72]], props: ['bench', 'umbrella'], n: ['The {A} Scoop', "{F}'s Creamery", '{W} Ice Cream', 'The {A} Cone'], tag: 'ICE CREAM' },
	pasta: { label: 'pasta place', u: 'HRSTA', v: 'restaurant', w: { downtown: 1.5, main: 2, strip: 1, residential: 0.5, harbour: 0.6 }, s: ['rect', 'serif'], pal: [['#1e4d2b', '#f4ead2'], ['#7d1f1a', '#f6e3c2'], ['#f4ead2', '#7d1f1a']], awn: [[0.2, 0.38, 0.22], [0.62, 0.14, 0.12], [0.92, 0.88, 0.78]], props: ['table', 'table', 'umbrella'], n: ["{F}'s Pasta", 'Trattoria {W}', '{W} Pasta Bar', 'Casa {F}', 'The {A} Noodle', "Nonna {F}'s"], tag: 'PASTA · WINE' },
	pizza: { label: 'pizzeria', u: 'HRSTA', v: 'restaurant', w: { downtown: 1, main: 1.6, strip: 2.2, residential: 0.5, highway: 0.8 }, s: ['block', 'slab'], pal: [['#c62f22', '#ffffff'], ['#1f6b3a', '#fff4dc'], ['#fff4dc', '#c62f22']], awn: [[0.78, 0.18, 0.14], [0.2, 0.45, 0.25]], props: ['table', 'aboard'], n: ["{F}'s Pizza", 'The {A} Slice', '{W} Pizzeria', 'Brick {W} Pizza', 'The {W} Pie'], tag: 'PIZZA BY THE SLICE' },
	diner: { label: 'diner', u: 'HSTA', v: 'restaurant', w: { main: 1, strip: 1, rural: 2, highway: 2.5, harbour: 0.8, residential: 0.3 }, s: ['neon', 'slab'], pal: [['#12333f', '#ff6b6b'], ['#e8e0cf', '#b2221c'], ['#1d2a44', '#7fe3ff']], awn: [[0.75, 0.15, 0.15], [0.15, 0.4, 0.55]], props: ['bench'], n: ["{F}'s Diner", 'The {A} Spoon Diner', 'The {W} Grill', '{W} Road Diner', 'Blue Plate {W}'], tag: 'BREAKFAST ALL DAY' },
	burger: { label: 'fast food', u: 'ST', v: 'restaurant', w: { strip: 3, highway: 4, main: 0.6, downtown: 0.5 }, s: ['block', 'sans'], pal: [['#f2c230', '#b3201a'], ['#d12b20', '#ffe36a'], ['#1b4fa0', '#ffffff']], awn: [[0.95, 0.75, 0.15], [0.82, 0.18, 0.12]], props: ['menuboard'], drive: true, n: ["{F}'s Burgers", 'The {A} Bun', 'Burger {W}', '{W} Drive-In', 'Big {W} Burgers', 'Flip & {W}'], tag: 'DRIVE-THRU · OPEN LATE' },
	taco: { label: 'taco shop', u: 'HRSTA', v: 'restaurant', w: { main: 1.4, strip: 2, downtown: 0.8, residential: 0.4, highway: 1 }, s: ['banner', 'slab'], pal: [['#e8a33d', '#3a1c0b'], ['#2d8a6b', '#fff1c8'], ['#c73a2b', '#ffe6a8']], awn: [[0.9, 0.55, 0.2], [0.2, 0.55, 0.42], [0.82, 0.24, 0.18]], props: ['table', 'umbrella'], n: ['Taquería {F}', "{F}'s Tacos", 'El {W} Taco', 'Tacos {W}', 'La {W} Cocina'], tag: 'TACOS · BURRITOS' },
	sushi: { label: 'sushi bar', u: 'HRSTA', v: 'restaurant', w: { downtown: 1.2, main: 1, strip: 1 }, s: ['rect', 'sans'], pal: [['#f5efe2', '#1e2a3a'], ['#22303f', '#f5efe2'], ['#9e2a20', '#fff6e8']], awn: [[0.2, 0.25, 0.32], [0.9, 0.88, 0.82]], props: ['aboard'], n: ['Sushi {W}', '{W} Sushi Bar', 'The {A} Fin', '{W} Roll House'], tag: 'SUSHI · SASHIMI' },
	ramen: { label: 'ramen shop', u: 'HRSTA', v: 'restaurant', w: { downtown: 1, main: 1, strip: 0.8, residential: 0.1 }, s: ['banner', 'sans'], pal: [['#c0392b', '#fff4e0'], ['#1f1f1f', '#f7d046']], awn: [[0.75, 0.2, 0.16], [0.12, 0.12, 0.12]], props: ['aboard'], n: ['{W} Ramen', 'Ramen {W}', 'Noodle {W}'], tag: 'RAMEN' },
	bistro: { label: 'bistro', u: 'HRSA', v: 'restaurant', w: { downtown: 1, main: 1.2, harbour: 0.6, residential: 0.3, rural: 0.5 }, s: ['rect', 'serif'], pal: [['#20303a', '#e9dcc0'], ['#5a2232', '#f3e7d3']], awn: [[0.2, 0.22, 0.3], [0.45, 0.18, 0.24]], props: ['table', 'table'], n: ['Bistro {W}', 'The {A} Table', "{F}'s Kitchen", '{W} & Vine'], tag: 'BISTRO · WINE BAR' },
	pub: { label: 'pub', u: 'HRSA', v: 'restaurant', w: { downtown: 1.2, main: 1.6, harbour: 1.2, rural: 1, residential: 0.3 }, s: ['plank', 'serif'], pal: OLD_PAL, awn: [[0.18, 0.3, 0.2], [0.3, 0.18, 0.12]], props: ['kegs', 'bench'], n: ['The {A} {W}', 'The {W} & {W2}', "{F}'s Tavern", 'The {W} Arms', 'The {W} Tap'], tag: 'ALES · FOOD' },
	bbq: { label: 'barbecue', u: 'HSTI', v: 'restaurant', w: { strip: 0.8, highway: 1.5, rural: 1.2, main: 0.6, industrial: 0.6, residential: 0.12 }, s: ['plank', 'slab'], pal: [['#3a1f12', '#f2c14e'], ['#8b1e14', '#ffe7b8']], awn: [[0.35, 0.18, 0.1], [0.55, 0.14, 0.1]], props: ['kegs', 'bench', 'table'], n: ["{F}'s Smokehouse", 'The {A} Pit', '{W} Barbecue', 'Low & Slow {W}', 'Hickory {W} BBQ'], tag: 'BRISKET · RIBS' },
	seafood: { label: 'seafood', u: 'HRSTA', v: 'restaurant', w: { harbour: 4, main: 0.5, downtown: 0.5 }, s: ['plank', 'serif'], pal: [['#1d4e6b', '#f4efe0'], ['#f4efe0', '#1d4e6b'], ['#b8432b', '#fff3dc']], awn: [[0.15, 0.35, 0.5], [0.9, 0.9, 0.86]], props: ['table', 'umbrella', 'nets'], n: ["{F}'s Fish House", 'The {A} Clam', '{W} Oyster Bar', 'Dockside {W}', '{W} Chowder House'], tag: 'FRESH CATCH' },
	curry: { label: 'curry house', u: 'HRSTA', v: 'restaurant', w: { main: 0.6, strip: 0.8, downtown: 0.5, residential: 0.08 }, s: ['arch', 'serif'], pal: [['#e09a2d', '#4a1606'], ['#6a1b3a', '#ffd88a']], awn: [[0.88, 0.55, 0.15], [0.5, 0.12, 0.3]], props: ['aboard'], n: ['{W} Curry House', 'Spice {W}', 'The {A} Tandoor', '{W} Masala'], tag: 'CURRY · NAAN' },
	noodles: { label: 'noodle house', u: 'HRSTA', v: 'restaurant', w: { strip: 1, main: 0.7, downtown: 0.6, residential: 0.1 }, s: ['rect', 'sans'], pal: [['#f6e7b5', '#9b2c1e'], ['#1f5a43', '#fff5d8']], awn: [[0.85, 0.2, 0.15], [0.2, 0.45, 0.35]], props: ['aboard'], n: ['{W} Noodle House', '{W} Pho', 'The {A} Bowl', '{W} Dumpling Kitchen'], tag: 'NOODLES · DUMPLINGS' },
	tapas: { label: 'tapas bar', u: 'HRSA', v: 'restaurant', w: { main: 0.3, downtown: 0.2, harbour: 0.2, residential: 0.1, rural: 0.05 }, s: ['rect', 'serif'], pal: [['#7a1c1c', '#f5d36b'], ['#f3e3c3', '#7a1c1c']], awn: [[0.62, 0.14, 0.12], [0.9, 0.7, 0.2]], props: ['table', 'table', 'kegs'], n: ['{W} Tapas', '{W} Wine & Tapas', 'Small Plates {W}'], tag: 'TAPAS' },
	izakaya: { label: 'izakaya', u: 'HRSA', v: 'restaurant', w: { main: 0.1, downtown: 0.1, residential: 0.02 }, s: ['banner', 'sans'], pal: [['#2a1f1a', '#f2e3c4'], ['#b02b1f', '#fff1dc']], awn: [[0.2, 0.15, 0.12]], props: ['aboard'], n: ['Izakaya {W}', '{W} Tei'], tag: 'IZAKAYA' },
	grill: { label: 'grill', u: 'HRSTA', v: 'restaurant', w: { main: 0.25, strip: 0.25, residential: 0.05 }, s: ['rect', 'sans'], pal: [['#f4e3c1', '#7b2416'], ['#1e5a3c', '#ffffff']], awn: [[0.7, 0.2, 0.12], [0.2, 0.45, 0.3]], props: ['table', 'aboard'], n: ['{W} Grill', "{F}'s Kebab", 'Falafel {W}', '{W} Shawarma'], tag: 'KEBAB · FALAFEL' },
	// shops
	bookshop: { label: 'bookshop', u: 'HRSA', v: 'shop', w: { downtown: 1, main: 1.2, harbour: 0.4, residential: 0.3 }, s: ['rect', 'serif'], pal: [['#2a3d2c', '#efe3c4'], ['#4a2525', '#f2e6cf']], awn: [[0.2, 0.32, 0.22], [0.4, 0.18, 0.16]], props: ['bench', 'crates'], n: ['The {A} Page', "{F}'s Books", '{W} Bookshop', 'The {W} Shelf', 'Dog-Eared {W}'], tag: 'BOOKS · USED & NEW' },
	florist: { label: 'florist', u: 'HRSA', v: 'shop', w: { main: 1, downtown: 0.6, residential: 0.6, strip: 0.4 }, s: ['oval', 'script'], pal: [['#f4e6ea', '#4e7a3f'], ['#3f6b3a', '#fdf0f3']], awn: [[0.85, 0.6, 0.68], [0.35, 0.55, 0.32]], props: ['crates', 'crates'], n: ['{W} & Stem', "{F}'s Flowers", 'The {A} Petal', '{W} Florist', 'Bloom {W}'], tag: 'FLOWERS' },
	hardware: { label: 'hardware store', u: 'STA', v: 'shop', w: { main: 0.8, strip: 1.4, rural: 0.8 }, s: ['block', 'sans'], pal: [['#c8302a', '#ffffff'], ['#1f3f7a', '#ffd34e']], awn: [[0.75, 0.18, 0.15], [0.15, 0.25, 0.5]], props: ['crates'], n: ["{F}'s Hardware", '{W} Supply Co.', 'The {A} Nail', '{W} Tool & Paint'], tag: 'HARDWARE · PAINT' },
	grocer: { label: 'grocer', u: 'HRSTA', v: 'shop', w: { main: 1.4, strip: 2, downtown: 0.8, residential: 0.7, rural: 0.5 }, s: ['rect', 'sans'], pal: [['#2e7d32', '#ffffff'], ['#f6efd6', '#2e5d27']], awn: [[0.25, 0.55, 0.25], [0.9, 0.88, 0.8]], props: ['crates', 'crates'], n: ["{F}'s Market", '{W} Grocery', 'The {A} Basket', 'Corner {W} Market', '{W} Fresh Foods'], tag: 'GROCERY · PRODUCE' },
	pharmacy: { label: 'pharmacy', u: 'STA', v: 'shop', w: { main: 0.8, strip: 1, downtown: 0.6 }, s: ['rect', 'sans'], pal: [['#ffffff', '#1b7a4a'], ['#1b6fa8', '#ffffff']], awn: [[0.9, 0.92, 0.9]], props: [], n: ['{W} Pharmacy', "{F}'s Drugstore", 'The {A} Leaf Apothecary'], tag: 'PHARMACY' },
	outfitter: { label: 'fishing outfitter', u: 'HSRAT', v: 'shop', w: { harbour: 5, rural: 0.4, main: 0.2 }, s: ['plank', 'slab'], pal: [['#1e3a4c', '#f2d27a'], ['#f1e4c3', '#24465a']], awn: [[0.15, 0.35, 0.45], [0.85, 0.55, 0.2]], props: ['outrigger', 'nets', 'crates'], n: ["{F}'s Fishing Outfitters", 'The {A} Hook Outfitters', '{W} Bay Tackle & Charter', 'Tide & {W} Outfitters', '{W} Line Fishing Co.'], tag: 'CHARTERS · TACKLE · CANOES' },
	bait: { label: 'bait and tackle', u: 'HSRA', v: 'shop', w: { harbour: 3, rural: 0.4 }, s: ['plank', 'slab'], pal: [['#24465a', '#f1e4c3'], ['#f2d27a', '#1e3a4c']], awn: [[0.15, 0.35, 0.45]], props: ['crates', 'nets'], n: ['{W} Bait & Tackle', "{F}'s Bait Shop", 'The {A} Worm'], tag: 'LIVE BAIT · ICE' },
	surf: { label: 'surf shop', u: 'HSRA', v: 'shop', w: { harbour: 2, main: 0.2 }, s: ['pill', 'sans'], pal: [['#26a0b5', '#fff8e0'], ['#ff7a45', '#ffffff']], awn: [[0.2, 0.65, 0.75], [0.98, 0.55, 0.3]], props: ['surfrack'], n: ['{W} Surf Co.', "{F}'s Board Shop", 'The {A} Wave', 'Swell & {W}'], tag: 'SURF · RENTALS' },
	huntpost: { label: 'hunting post', u: 'HSI', v: 'shop', w: { forest: 5, rural: 2 }, s: ['plank', 'slab'], pal: [['#3b2a1a', '#e8d6a8'], ['#4b5a2a', '#f3e7c2']], awn: [[0.3, 0.36, 0.18], [0.4, 0.28, 0.16]], props: ['antlers', 'gearrack', 'crates'], n: ["{F}'s Hunting Post", '{W} Ridge Outfitters', 'The {A} Antler Trading Post', '{W} Creek Sporting Goods', 'Timber & {W} Hunt Supply'], tag: 'LICENCES · AMMO · GEAR' },
	general: { label: 'general store', u: 'HS', v: 'shop', w: { rural: 2, forest: 1.5, harbour: 0.6 }, s: ['plank', 'serif'], pal: OLD_PAL, awn: [[0.4, 0.28, 0.16], [0.6, 0.18, 0.12]], props: ['crates', 'bench'], n: ["{F}'s General Store", '{W} Mercantile', '{W} Trading Co.'], tag: 'GENERAL STORE' },
	feed: { label: 'feed store', u: 'HSI', v: 'shop', w: { rural: 1.5 }, s: ['block', 'slab'], pal: [['#7a2a1a', '#f6e7c8'], ['#2e5d27', '#fff6dc']], awn: [[0.55, 0.2, 0.12]], props: ['crates'], n: ['{W} Feed & Seed', "{F}'s Farm Supply", '{W} Valley Feed'], tag: 'FEED · SEED · TACK' },
	farmstand: { label: 'farm stand', u: 'H', w: { rural: 3 }, s: ['plank', 'script'], pal: OLD_PAL, awn: [[0.6, 0.18, 0.12]], props: ['crates', 'crates', 'postsign'], n: ["{F}'s Farm Stand", '{W} Orchard', 'The {A} Acre Farm'], tag: 'PRODUCE · EGGS · HONEY' },
	antiques: { label: 'antiques', u: 'HRS', v: 'shop', w: { main: 0.6, rural: 1.2, harbour: 0.4 }, s: ['oval', 'serif'], pal: OLD_PAL, awn: [[0.3, 0.2, 0.15]], props: ['bench'], n: ['{W} Antiques', "{F}'s Curiosities", 'The {A} Attic'], tag: 'ANTIQUES · CURIOS' },
	bike: { label: 'bike shop', u: 'RSA', v: 'shop', w: { main: 0.6, downtown: 0.4 }, s: ['pill', 'sans'], pal: LIGHT_PAL, awn: [[0.2, 0.4, 0.6]], props: ['crates'], n: ['{W} Cycles', "{F}'s Bike Shop", 'The {A} Spoke'], tag: 'BIKES · REPAIRS' },
	records: { label: 'record shop', u: 'RSA', v: 'shop', w: { main: 0.5, downtown: 0.4 }, s: ['neon', 'sans'], pal: NEON_PAL, awn: [[0.12, 0.12, 0.14]], props: [], n: ['{W} Records', 'The {A} Groove', 'Spin {W}'], tag: 'VINYL · TAPES' },
	thrift: { label: 'thrift shop', u: 'RSTA', v: 'shop', w: { main: 0.5, strip: 0.6 }, s: ['rect', 'sans'], pal: LIGHT_PAL, awn: [[0.5, 0.3, 0.55]], props: [], n: ['{W} Thrift', 'Second {W}', "{F}'s Resale"], tag: 'THRIFT · VINTAGE' },
	pet: { label: 'pet shop', u: 'STA', v: 'shop', w: { strip: 0.8, main: 0.3 }, s: ['pill', 'sans'], pal: LIGHT_PAL, awn: [[0.25, 0.5, 0.65]], props: [], n: ['{W} Pet Supply', "{F}'s Pets", 'The {A} Paw'], tag: 'PET SUPPLY' },
	liquor: { label: 'bottle shop', u: 'RSTA', v: 'shop', w: { strip: 0.6, main: 0.4 }, s: ['neon', 'sans'], pal: NEON_PAL, awn: [[0.12, 0.12, 0.14]], props: [], n: ['{W} Liquors', "{F}'s Bottle Shop", 'The {A} Cork'], tag: 'WINE · SPIRITS' },
	phonefix: { label: 'phone repair', u: 'RSTA', v: 'shop', w: { strip: 0.6, main: 0.3, downtown: 0.3 }, s: ['rect', 'sans'], pal: [['#1b6fa8', '#ffffff'], ['#ffffff', '#1b6fa8']], awn: [[0.2, 0.42, 0.65]], props: [], n: ['{W} Phone Repair', 'Fix {W} Mobile', "{F}'s Gadget Repair"], tag: 'SCREENS · BATTERIES' },
	boutique: { label: 'boutique', u: 'RSA', v: 'shop', w: { downtown: 1, main: 1 }, s: ['rect', 'serif'], pal: [['#111111', '#f2f2f2'], ['#f2ece4', '#3a2a24']], awn: [[0.12, 0.12, 0.12], [0.92, 0.9, 0.86]], props: [], n: ['{W} Boutique', 'The {A} Thread', 'Atelier {W}', "{F}'s Closet"], tag: 'CLOTHING' },
	gift: { label: 'gift shop', u: 'HRSA', v: 'shop', w: { harbour: 1, main: 0.6 }, s: ['oval', 'script'], pal: LIGHT_PAL, awn: [[0.2, 0.55, 0.62]], props: ['bench'], n: ['{W} Gifts', 'The {A} Shell', "{F}'s Gift Shop"], tag: 'GIFTS · POSTCARDS' },
	butcher: { label: 'butcher', u: 'RSA', v: 'shop', w: { main: 0.4 }, s: ['rect', 'serif'], pal: [['#7d1f1a', '#ffffff'], ['#ffffff', '#7d1f1a']], awn: [[0.62, 0.14, 0.12], [0.9, 0.9, 0.88]], props: [], n: ["{F}'s Butcher", '{W} Meats', 'The {A} Cleaver'], tag: 'BUTCHER · DELI' },
	winery: { label: 'tasting room', u: 'HS', v: 'shop', w: { rural: 1, main: 0.2 }, s: ['oval', 'serif'], pal: [['#4a1f2a', '#f1e2c4'], ['#f1e2c4', '#4a1f2a']], awn: [[0.45, 0.15, 0.2]], props: ['table', 'kegs'], n: ['{W} Cellars', 'The {A} Vineyard', "{F}'s Tasting Room"], tag: 'WINE TASTING' },
	// services
	salon: { label: 'salon', u: 'HRSTA', v: 'shop', w: { main: 1, strip: 1.6, residential: 0.8, downtown: 0.5 }, s: ['oval', 'script'], pal: [['#f7e1e6', '#6b2f4a'], ['#1e1e1e', '#f3c6d3']], awn: [[0.9, 0.7, 0.75], [0.15, 0.15, 0.15]], props: ['aboard'], n: ["{F}'s Salon", 'Studio {W}', 'The {A} Mane', '{W} Hair & Nails'], tag: 'HAIR · NAILS' },
	barber: { label: 'barbershop', u: 'HRSA', v: 'shop', w: { main: 0.9, strip: 0.8, residential: 0.5 }, s: ['rect', 'slab'], pal: [['#1d2a44', '#f2f2f2'], ['#f2f2f2', '#a21f1f']], awn: [[0.15, 0.2, 0.4], [0.7, 0.15, 0.15]], props: ['bench'], n: ["{F}'s Barbershop", 'The {A} Razor', '{W} Barbers'], tag: 'CUTS · SHAVES' },
	laundromat: { label: 'laundromat', u: 'RSTA', v: 'shop', w: { strip: 0.8, main: 0.5 }, s: ['rect', 'sans'], pal: [['#e8f4fb', '#1b5f8f'], ['#1b5f8f', '#ffffff']], awn: [[0.3, 0.6, 0.8]], props: [], n: ['{W} Laundromat', 'Suds {W}', 'Spin & {W} Laundry'], tag: 'COIN LAUNDRY' },
	gym: { label: 'gym', u: 'STAI', v: 'shop', w: { strip: 1, downtown: 0.6, industrial: 0.8 }, s: ['block', 'sans'], pal: [['#111111', '#f6c90e'], ['#c8302a', '#ffffff']], awn: [[0.1, 0.1, 0.1]], props: [], n: ['{W} Fitness', 'The {A} Iron Gym', "{F}'s Boxing Club", '{W} Climbing Co.'], tag: 'GYM · CLASSES' },
	yoga: { label: 'yoga studio', u: 'HRS', v: 'shop', w: { main: 0.5, residential: 0.4 }, s: ['oval', 'sans'], pal: LIGHT_PAL, awn: [[0.55, 0.65, 0.5]], props: [], n: ['{W} Yoga', 'Studio {W}', 'The {A} Mat'], tag: 'YOGA · PILATES' },
	daycare: { label: 'daycare', u: 'H', w: { residential: 0.8 }, s: ['pill', 'sans'], pal: [['#ffd84d', '#2b4c8c'], ['#7cc6e8', '#ffffff']], awn: [[0.98, 0.8, 0.3]], props: ['postsign'], n: ['{W} Little Learners', "{F}'s Daycare", 'The {A} Sprout Preschool'], tag: 'DAYCARE · PRESCHOOL' },
	tutor: { label: 'lessons', u: 'H', w: { residential: 0.6 }, s: ['oval', 'serif'], pal: LIGHT_PAL, awn: null, props: ['postsign'], n: ["{F}'s Music Lessons", '{W} Tutoring', 'The {A} Key Piano Studio'], tag: 'LESSONS' },
	vet: { label: 'vet', u: 'HST', v: 'shop', w: { residential: 0.5, strip: 0.5, rural: 0.6 }, s: ['rect', 'sans'], pal: [['#ffffff', '#2a7a6a'], ['#2a7a6a', '#ffffff']], awn: [[0.3, 0.6, 0.55]], props: ['postsign'], n: ['{W} Animal Clinic', "{F}'s Vet", 'The {A} Paw Veterinary'], tag: 'VETERINARY' },
	tailor: { label: 'tailor', u: 'HRS', v: 'shop', w: { main: 0.3, residential: 0.3 }, s: ['rect', 'serif'], pal: DARK_PAL, awn: [[0.2, 0.2, 0.3]], props: [], n: ["{F}'s Tailoring", '{W} Alterations'], tag: 'ALTERATIONS' },
	tattoo: { label: 'tattoo parlour', u: 'RS', v: 'tattoo', w: { main: 0.4, downtown: 0.3 }, s: ['neon', 'slab'], pal: NEON_PAL, awn: [[0.1, 0.1, 0.1]], props: [], n: ['The {A} Needle', '{W} Ink', "{F}'s Tattoo Parlour"], tag: 'TATTOO · PIERCING' },
	arcade: { label: 'arcade', u: 'ST', v: 'arcade', w: { main: 0.1, strip: 0.2 }, s: ['neon', 'sans'], pal: NEON_PAL, awn: null, props: [], n: ['{W} Arcade', 'Pixel {W}', 'The {A} Token'], tag: 'GAMES · PRIZES' },
	lanes: { label: 'bowling alley', u: 'T', v: 'bowling', w: { strip: 0.1 }, s: ['neon', 'slab'], pal: NEON_PAL, awn: null, props: [], n: ['{W} Lanes', 'The {A} Pin'], tag: 'BOWLING' },
	cinema: { label: 'cinema', u: 'TO', v: 'cinema', w: { strip: 0.1, downtown: 0.1 }, s: ['neon', 'serif'], pal: NEON_PAL, awn: null, props: [], n: ['The {W} Cinema', '{W} Picture House', 'The {A} Reel'], tag: 'NOW SHOWING' },
	// places to stay
	bnb: { label: 'bed and breakfast', u: 'HRA', w: { harbour: 2, rural: 2.5, forest: 2, residential: 0.7, main: 0.4 }, s: ['oval', 'serif'], pal: [['#f3ead6', '#3d4f3a'], ['#2f3e4f', '#f1e2bf']], awn: [[0.3, 0.4, 0.3], [0.55, 0.4, 0.3]], props: ['postsign', 'bench'], home: true, n: ['{W} House B&B', 'The {A} {W} Inn', "{F}'s Bed & Breakfast", '{W} Cottage Inn', '{W} Guest House'], tag: 'BED & BREAKFAST · VACANCY' },
	motel: { label: 'motel', u: 'HSI', w: { highway: 3, rural: 0.6, harbour: 0.6 }, s: ['neon', 'slab'], pal: NEON_PAL, awn: null, props: ['postsign'], n: ['{W} Motor Lodge', 'The {A} Star Motel', "{F}'s Motor Court"], tag: 'VACANCY · POOL' },
	cabins: { label: 'cabin rentals', u: 'H', w: { forest: 3, rural: 0.8 }, s: ['plank', 'slab'], pal: OLD_PAL, awn: null, props: ['postsign', 'gearrack'], n: ['{W} Creek Cabins', 'The {A} Pine Lodge', "{F}'s Cabin Rentals"], tag: 'CABINS · FIREWOOD' },
	hotel: { label: 'hotel', u: 'W', w: { downtown: 1 }, s: ['rect', 'serif'], pal: DARK_PAL, awn: [[0.15, 0.15, 0.2]], props: [], n: ['Hotel {W}', 'The {W} Hotel', 'The {A} Grand'], tag: 'HOTEL' },
	// offices
	tech: { label: 'tech company', u: 'OW', v: 'office', w: { downtown: 4, park: 6 }, s: ['rect', 'sans'], pal: [['#101820', '#5ce1e6'], ['#f7f7f7', '#2b59c3'], ['#1b1b2f', '#e94560'], ['#ffffff', '#111111']], awn: null, props: ['monument'], n: ['{W}{X}', '{W} Labs', '{A}{X}', '{W}{X} Systems', '{W} Robotics', '{A} {W} Games'], tags: ['SOFTWARE', 'ROBOTICS', 'DATA', 'GAMES', 'CLOUD', 'SENSORS', 'BATTERIES', 'MAPS'] },
	law: { label: 'law firm', u: 'OWH', v: 'office', w: { downtown: 2, park: 1.5, main: 0.4, residential: 0.4 }, s: ['rect', 'serif'], pal: DARK_PAL, awn: null, props: ['monument'], n: ['{S} & {S2}', '{S}, {S2} & Partners', '{S} Law'], tag: 'ATTORNEYS AT LAW' },
	design: { label: 'design studio', u: 'ORH', v: 'office', w: { downtown: 1, park: 1, main: 0.4 }, s: ['rect', 'narrow'], pal: [['#ffffff', '#111111'], ['#f05a28', '#ffffff']], awn: null, props: ['monument'], n: ['{W} Design Studio', 'The {A} Line Architects', 'Studio {W}'], tag: 'ARCHITECTURE · DESIGN' },
	finance: { label: 'finance', u: 'OW', v: 'office', w: { downtown: 2, park: 1.2 }, s: ['rect', 'serif'], pal: DARK_PAL, awn: null, props: ['monument'], n: ['{W} Capital', '{A} Harbor Partners', '{W} Credit Union', '{S} Wealth'], tag: 'FINANCIAL' },
	agency: { label: 'agency', u: 'OW', v: 'office', w: { downtown: 1.5, park: 1 }, s: ['block', 'narrow'], pal: [['#f9d65c', '#111111'], ['#111111', '#f9d65c']], awn: null, props: ['monument'], n: ['{W} Creative', 'The {A} Signal', '{W} & {W2} Agency'], tag: 'CREATIVE AGENCY' },
	realtor: { label: 'realtor', u: 'HOS', v: 'office', w: { main: 0.6, residential: 0.7, park: 0.5 }, s: ['rect', 'sans'], pal: [['#ffffff', '#1f3b6e'], ['#1f3b6e', '#ffffff']], awn: [[0.2, 0.3, 0.5]], props: ['postsign'], n: ['{W} Realty', "{F}'s Homes", 'The {A} Key Real Estate'], tag: 'REAL ESTATE' },
	clinic: { label: 'clinic', u: 'HOT', v: 'office', w: { park: 1.2, strip: 0.7, residential: 0.6, downtown: 0.6 }, s: ['rect', 'sans'], pal: [['#ffffff', '#1b6fa8'], ['#1b6fa8', '#ffffff']], awn: null, props: ['monument'], n: ['{W} Medical Group', '{W} Family Clinic', '{A} Valley Health'], tag: 'CLINIC · URGENT CARE' },
	dental: { label: 'dentist', u: 'HOT', v: 'office', w: { residential: 0.8, strip: 0.8, park: 0.6 }, s: ['pill', 'sans'], pal: [['#e8f6f8', '#1f6f7f'], ['#1f6f7f', '#ffffff']], awn: [[0.4, 0.7, 0.75]], props: ['postsign'], n: ['{W} Dental', "{F}'s Family Dentistry", 'The {A} Smile'], tag: 'DENTAL' },
	insurance: { label: 'insurance', u: 'HOS', v: 'office', w: { main: 0.3, park: 0.5, residential: 0.3 }, s: ['rect', 'sans'], pal: LIGHT_PAL, awn: null, props: ['postsign'], n: ['{W} Insurance', '{S} Insurance Agency'], tag: 'INSURANCE' },
	// the public services: their buildings are named and signed here, and claimed by whatever runs
	// them (src/services/, through registerSiting); their insides and work are theirs
	hospital: { label: 'hospital', u: 'OW', v: 'office', service: 'hospital', w: { downtown: 0.12, park: 0.25 }, s: ['rect', 'sans'], pal: [['#ffffff', '#c62828'], ['#1b6fa8', '#ffffff']], awn: null, props: ['monument'], n: ['{W} General Hospital', '{W} Medical Center', '{A} Valley Hospital'], tag: 'EMERGENCY' },
	police: { label: 'police station', u: 'OST', v: null, service: 'police', w: { downtown: 0.1, main: 0.06, park: 0.1, strip: 0.05 }, s: ['rect', 'sans'], pal: [['#13294b', '#ffffff']], awn: null, props: ['monument'], n: ['{W} Police Station', '{W} Police Department'], tag: 'POLICE' },
	firestation: { label: 'fire station', u: 'OSTI', v: null, service: 'fire', w: { main: 0.06, park: 0.08, strip: 0.05, industrial: 0.15, rural: 0.02 }, s: ['rect', 'slab'], pal: [['#b71c1c', '#ffffff']], awn: null, props: [], n: ['{W} Fire Station', 'Station {W}', '{W} Fire Company'], tag: 'FIRE · RESCUE' },
	armory: { label: 'armory', u: 'OSTI', v: null, service: 'armory', w: {}, s: ['rect', 'slab'], pal: [['#3b4a2a', '#f2f2e8']], awn: null, props: [], n: ['{W} Armory'], tag: 'ARMORY' },
	// sheds and warehouses
	brewery: { label: 'brewery', u: 'I', w: { industrial: 2, harbour: 0.8 }, s: ['plank', 'slab'], pal: OLD_PAL, awn: null, props: ['kegs', 'table'], n: ['{W} Brewing Co.', 'The {A} Barrel', "{F}'s Ales"], tag: 'TAPROOM' },
	autorepair: { label: 'auto repair', u: 'IH', w: { industrial: 3, highway: 2, rural: 1 }, s: ['block', 'sans'], pal: [['#1f3f7a', '#ffffff'], ['#c8302a', '#ffffff']], awn: null, props: ['car'], n: ["{F}'s Auto Repair", '{W} Garage', 'The {A} Wrench'], tag: 'AUTO REPAIR · TYRES' },
	movers: { label: 'storage', u: 'I', w: { industrial: 2 }, s: ['block', 'sans'], pal: [['#f28c28', '#ffffff'], ['#2b2b2b', '#f28c28']], awn: null, props: [], n: ['{W} Moving & Storage', '{W} Freight'], tag: 'STORAGE · FREIGHT' },
	woodshop: { label: 'woodworks', u: 'IH', w: { industrial: 1, rural: 0.6, forest: 1 }, s: ['plank', 'slab'], pal: OLD_PAL, awn: null, props: ['crates'], n: ['{W} Woodworks', "{F}'s Joinery", 'The {A} Grain'], tag: 'FURNITURE · JOINERY' },
	boatyard: { label: 'boatyard', u: 'I', w: { harbour: 4 }, s: ['plank', 'slab'], pal: [['#1d4e6b', '#f4efe0'], ['#f4efe0', '#1d4e6b']], awn: null, props: ['outrigger', 'boat'], n: ['{W} Boatworks', "{F}'s Marine", '{W} Chandlery'], tag: 'BOAT REPAIR · CHANDLERY' },
	roastery: { label: 'roastery', u: 'I', w: { industrial: 1 }, s: ['oval', 'serif'], pal: [['#3b2a20', '#f3e6c8']], awn: null, props: ['crates'], n: ['{W} Coffee Roasters', "{F}'s Roastery"], tag: 'ROASTERY · CAFÉ' },
	printshop: { label: 'print shop', u: 'IS', v: 'shop', w: { industrial: 0.8, main: 0.2 }, s: ['block', 'narrow'], pal: LIGHT_PAL, awn: null, props: [], n: ['{W} Press', "{F}'s Print Shop"], tag: 'PRINT · SIGNS' },
	fishmarket: { label: 'fish market', u: 'ISH', w: { harbour: 2 }, s: ['plank', 'slab'], pal: [['#1d4e6b', '#f4efe0']], awn: null, props: ['nets', 'crates'], n: ['{W} Fish Market', '{W} Seafood Co.'], tag: 'FISH MARKET' },
};
const USE_LETTER = { house: 'H', row: 'R', shop: 'S', retail: 'T', office: 'O', tower: 'W', apt: 'A', industry: 'I' };

// ---------- the place's words and food ----------
const EN = {
	F: ['Rosa', 'Hank', 'Mabel', 'Otis', 'June', 'Walt', 'Dot', 'Gus', 'Ivy', 'Lou', 'Nell', 'Sal', 'Bea', 'Della', 'Earl', 'Fern', 'Hazel', 'Iris', 'Jack', 'Kit', 'Lola', 'Moe', 'Nina', 'Opal', 'Pete', 'Ruby', 'Stan', 'Tess', 'Vera', 'Wes', 'Abe', 'Cora', 'Duke', 'Elsie', 'Frank', 'Greta', 'Hal', 'Ines', 'Jo', 'Kay', 'Leon', 'Mae', 'Ned', 'Rex', 'Sid', 'Una', 'Vic', 'Winnie', 'Zeke', 'Marco', 'Rosie', 'Benny', 'Lupe', 'Ana', 'Dev', 'Priya', 'Kenji', 'Mei', 'Omar', 'Layla', 'Tariq', 'Ingrid', 'Sven', 'Hugo', 'Lena'],
	A: ['Golden', 'Blue', 'Little', 'Old', 'Lucky', 'Red', 'Silver', 'Copper', 'Salty', 'Sunny', 'Wild', 'Quiet', 'Happy', 'Iron', 'Northern', 'Crooked', 'Brass', 'Green', 'Rusty', 'Velvet', 'Honest', 'Hidden', 'Tall', 'Bright', 'Gentle', 'Humble', 'Proud', 'Merry', 'Lazy', 'Brave', 'Painted', 'Sleepy', 'Windy', 'Twin', 'Amber', 'Cobalt', 'Crimson', 'Stone'],
	W: ['Oak', 'Pine', 'Fern', 'Heron', 'Otter', 'Willow', 'Juniper', 'Harbor', 'Ridge', 'Creek', 'Hollow', 'Meadow', 'Maple', 'Cedar', 'Fox', 'Crow', 'Wren', 'Elk', 'Sparrow', 'Thistle', 'Clover', 'Bramble', 'Lantern', 'Anchor', 'Compass', 'Kettle', 'Acorn', 'Birch', 'Lark', 'Finch', 'Badger', 'Marigold', 'Sage', 'Cypress', 'Driftwood', 'Pebble', 'Quarry', 'Orchard', 'Larkspur', 'Sundial', 'Hearth', 'Mill', 'Ferry', 'Bluff', 'Cove', 'Summit', 'Canyon', 'Prairie', 'Mesa', 'Poppy', 'Tamarack', 'Bayberry', 'Gull', 'Osprey', 'Kestrel'],
	S: ['Whitlock', 'Okafor', 'Brennan', 'Castillo', 'Nakamura', 'Lindqvist', 'Petrova', 'Abernathy', 'Moreau', 'Haddad', 'Delacroix', 'Fairbanks', 'Osei', 'Vasquez', 'Kowalski', 'Ashby', 'Reyes', 'Thorne', 'Quinlan', 'Hale', 'Ferreira', 'Sato', 'Grimaldi', 'Novak', 'Pryce', 'Mendel', 'Oyelaran', 'Strand'],
};
const X = ['ly', 'io', 'ware', 'grid', 'stack', 'loop', 'mind', 'sync', 'base', 'forge', 'pixel', 'wave', 'scope', 'bit', 'nest', 'path', 'spark', 'works'];
// each place: its first names (F), words (W, and A where its names describe), how much more or
// less of each kind of business it has (m), and how it names them (n)
export const LOCALES = {
	us: { ...EN, m: {} },
	'us-ca': { ...EN, m: { winery: 2.5, taco: 1.4, boba: 1.6, sushi: 1.2, tech: 1.3, surf: 1.5 } },
	'us-tx': { ...EN, W: [...EN.W, 'Bluebonnet', 'Pecan', 'Mesquite', 'Longhorn', 'Lone Oak', 'Hill Country', 'Live Oak'], m: { bbq: 5, taco: 2, diner: 1.3, huntpost: 1.5, feed: 1.5, sushi: 0.5, boba: 0.5 }, n: { bbq: ["{F}'s Smokehouse", '{W} Pit BBQ', 'The {A} Brisket', '{W} Barbecue Co.', 'Hickory {W} BBQ'] } },
	uk: { ...EN, m: { pub: 4, seafood: 2, cafe: 1.5, curry: 2, diner: 0.1, bbq: 0.1, taco: 0.2, burger: 0.6, huntpost: 0.3 }, n: { pub: ['The {A} {W}', 'The {W} & {W2}', 'The {W} Arms', 'The {A} Lion'], seafood: ["{F}'s Chippy", 'The {A} Haddock', '{W} Fish Bar'], cafe: ['{W} Tea Rooms', "{F}'s Café", 'The {A} Teapot'], bnb: ['{W} Guest House', '{W} House B&B'], grocer: ["{F}'s Corner Shop", '{W} Stores'] } },
	au: { ...EN, m: { cafe: 2, seafood: 1.5, pub: 1.5, bakery: 1.2, diner: 0.3, bbq: 0.6, huntpost: 0.5 }, n: { cafe: ['{W} Espresso', "{F}'s Café", 'The {A} Bean'], seafood: ['{W} Fish & Chips', "{F}'s Fish Shop"], bakery: ['{W} Pie Shop', "{F}'s Bakery"], pub: ['The {W} Hotel', 'The {A} {W} Tavern'] } },
	jp: {
		F: ['Haru', 'Yuki', 'Kenji', 'Mika', 'Taro', 'Aoi', 'Sora', 'Rin', 'Hana', 'Kaito', 'Emi', 'Jiro'], S: ['Tanaka', 'Mori', 'Ishida', 'Ueno', 'Hayashi', 'Kondo'],
		W: ['Sakura', 'Kawa', 'Yama', 'Umi', 'Kaze', 'Take', 'Momiji', 'Hoshi', 'Midori', 'Kiku', 'Tanuki', 'Kitsune', 'Maru', 'Shiro', 'Kumo', 'Hinata', 'Ume', 'Tsubaki', 'Koi', 'Hotaru', 'Ishi', 'Kaede'],
		m: { ramen: 5, sushi: 4, izakaya: 30, noodles: 1.5, curry: 1.5, seafood: 1.5, burger: 0.4, bbq: 0.2, taco: 0.1, diner: 0.1, pub: 0.2, pasta: 0.5, waffle: 0.5, donut: 0.4, huntpost: 0.3, winery: 0.1, tapas: 0, motel: 0.3, grill: 0.1 },
		n: { cafe: ['Kissa {W}', '{W} Coffee', 'Café {W}'], bakery: ['{W} Bakery', 'Boulangerie {W}'], ramen: ['{W} Ramen', 'Menya {W}', 'Ramen {W}'], sushi: ['Sushi {W}', '{W} Zushi', 'Kaiten {W}'], izakaya: ['Izakaya {W}', '{W} Tei', 'Sakaba {W}'], noodles: ['{W} Soba', 'Udon {W}', 'Teuchi {W}'], curry: ['{W} Curry', 'Curry House {W}'], bnb: ['Ryokan {W}', 'Minshuku {W}', '{W} Inn'], seafood: ['{W} Robata', 'Kaisen {W}'], bistro: ['Yoshoku {W}'], pub: ['Sakaba {W}'], grocer: ['{W} Mart', '{W} Shoten'], general: ['{W} Shoten'], hotel: ['Hotel {W}'], motel: ['Business Hotel {W}'], tech: ['{W} Labs', '{W}{X}', '{W} Systems'] },
	},
	kr: {
		F: ['Minji', 'Jisoo', 'Hyun', 'Seo', 'Jun', 'Ara', 'Dae', 'Eun'], S: ['Kim', 'Park', 'Choi', 'Jung', 'Kang'],
		W: ['Hana', 'Haneul', 'Baram', 'Dal', 'Byeol', 'Namu', 'Saem', 'Bom', 'Gaeul', 'Bada', 'Sol', 'Nuri', 'Maru', 'Areum'],
		m: { bbq: 3, noodles: 2, cafe: 2, boba: 1, sushi: 0.5, taco: 0.1, diner: 0.1, pub: 0.6, burger: 0.6, huntpost: 0.3 },
		n: { bbq: ['{W} Galbi', '{W} Gogi House', '{W} Grill'], noodles: ['{W} Guksu', '{W} Naengmyeon', '{W} Kimbap'], cafe: ['Cafe {W}', '{W} Coffee'], bnb: ['{W} Guesthouse', '{W} Hanok Stay'], pub: ['{W} Pocha', '{W} Hof'] },
	},
	cn: {
		F: ['Mei', 'Lin', 'Wei', 'Jun', 'Hua', 'Lan', 'Bo', 'Xiu'], S: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen'],
		W: ['Jade', 'Lotus', 'Bamboo', 'Peony', 'Phoenix', 'Willow', 'Plum', 'Crane', 'Pearl', 'Orchid', 'Lantern', 'Osmanthus', 'Magpie', 'Cloud'],
		m: { noodles: 5, boba: 2, bakery: 1, cafe: 1, bbq: 0.6, sushi: 0.2, taco: 0, pasta: 0.2, diner: 0, pub: 0.2, huntpost: 0.2 },
		n: { noodles: ['{W} Noodle House', '{W} Dumplings', '{W} Hand-Pulled Noodles', '{W} Hotpot'], cafe: ['{W} Tea House', '{W} Teahouse'], bakery: ['{W} Bakery', '{W} Mooncake Shop'], bbq: ['{W} Hotpot', '{W} Skewers'], bnb: ['{W} Guesthouse'] },
	},
	es: {
		F: ['Lola', 'Paco', 'Carmen', 'Pepe', 'Lucía', 'Manolo', 'Rocío', 'Juan', 'Pilar', 'Toni'], S: ['García', 'Romero', 'Navarro', 'Ortega', 'Serrano'],
		W: ['Esquina', 'Sol', 'Luna', 'Olivo', 'Azahar', 'Puerto', 'Brisa', 'Romero', 'Tomillo', 'Alegría', 'Plaza', 'Jazmín', 'Mirador', 'Rincón', 'Faro', 'Higuera'],
		m: { tapas: 25, bakery: 1.5, cafe: 1.5, seafood: 1.5, waffle: 0.8, pub: 0.3, diner: 0, bbq: 0.3, burger: 0.4, taco: 0.1, sushi: 0.4, pasta: 0.6, donut: 0.2, huntpost: 0.5 },
		n: { tapas: ['Bar {W}', 'Taberna {F}', 'Tasca {W}', 'Casa {F}', 'Bodega {W}'], cafe: ['Café {W}', 'Cafetería {F}'], bakery: ['Panadería {F}', 'Horno {W}', 'Pastelería {W}'], waffle: ['Churrería {F}', 'Churros {W}'], seafood: ['Marisquería {W}', 'Freiduría {F}'], bnb: ['Hostal {W}', 'Pensión {F}', 'Casa Rural {W}'], pub: ['Cervecería {W}'], icecream: ['Heladería {W}'], grocer: ['Ultramarinos {F}', 'Frutería {W}'], butcher: ['Carnicería {F}'], pharmacy: ['Farmacia {W}'], general: ['Ultramarinos {W}'], motel: ['Hostal {W}'], hotel: ['Hotel {W}'] },
	},
	pt: {
		F: ['Rui', 'Inês', 'João', 'Marta', 'Tiago', 'Ana', 'Zé', 'Rita'], S: ['Silva', 'Costa', 'Ferreira', 'Pereira'],
		W: ['Sol', 'Mar', 'Farol', 'Cais', 'Oliveira', 'Ribeira', 'Laranja', 'Gaivota', 'Brisa', 'Pinhal', 'Ponte', 'Sardinha'],
		m: { tapas: 10, bakery: 2, cafe: 1.5, seafood: 2, bbq: 1.5, diner: 0, burger: 0.4, taco: 0.1, huntpost: 0.4 },
		n: { tapas: ['Tasca {W}', 'Taberna {F}'], bakery: ['Pastelaria {W}', 'Padaria {F}'], cafe: ['Café {W}'], bbq: ['Churrasqueira {W}', 'Churrascaria {W}'], seafood: ['Marisqueira {W}'], bnb: ['Pousada {W}', 'Casa {W}', 'Pensão {F}'], icecream: ['Gelataria {W}'], pub: ['Cervejaria {W}'] },
	},
	it: {
		F: ['Rosa', 'Gino', 'Lucia', 'Marco', 'Tonino', 'Franca', 'Beppe', 'Sofia', 'Nino', 'Carla'], S: ['Rossi', 'Bianchi', 'Esposito', 'Ferri', 'Galli'],
		W: ['Sole', 'Luna', 'Ulivo', 'Vento', 'Gallo', 'Borgo', 'Ponte', 'Fontana', 'Vigna', 'Stella', 'Mulino', 'Piazza', 'Torre', 'Leone', 'Sorgente', 'Glicine'],
		m: { pasta: 4, pizza: 4, icecream: 3, cafe: 2, bakery: 1.2, burger: 0.3, taco: 0, diner: 0, bbq: 0.2, sushi: 0.4, tapas: 0, boba: 0.2, huntpost: 0.5 },
		n: { pasta: ['Trattoria {W}', 'Osteria {W}', 'Da {F}', 'Pastificio {F}'], pizza: ['Pizzeria {W}', 'Pizzeria da {F}', 'Forno {W}'], cafe: ['Bar {W}', 'Caffè {W}', 'Caffè {F}'], bakery: ['Forno {F}', 'Panificio {W}', 'Pasticceria {W}'], icecream: ['Gelateria {W}', 'Gelateria da {F}'], bnb: ['Locanda {W}', 'B&B {W}', 'Albergo {W}'], pub: ['Enoteca {W}', 'Birreria {W}'], bistro: ['Ristorante {W}'], butcher: ['Macelleria {F}'], grocer: ['Alimentari {F}', 'Bottega {W}'], seafood: ['Pescheria {W}'], pharmacy: ['Farmacia {W}'], hotel: ['Hotel {W}', 'Albergo {W}'] },
	},
	fr: {
		F: ['Margot', 'Lucien', 'Odile', 'Henri', 'Colette', 'Jules', 'Élise', 'Gaston', 'Rémy', 'Simone'], S: ['Martin', 'Bernard', 'Lefèvre', 'Girard', 'Fournier'],
		W: ['Coin', 'Marché', 'Pont', 'Soleil', 'Moulin', 'Chêne', 'Tilleul', 'Vieux Port', 'Port', 'Phare', 'Clocher', 'Jardin', 'Rocher', 'Lavoir', 'Coquelicot', 'Verger'],
		m: { bakery: 3, bistro: 4, cafe: 2, waffle: 2, pub: 1, burger: 0.4, taco: 0.1, diner: 0, bbq: 0.1, sushi: 0.6, tapas: 0, huntpost: 0.5 },
		n: { bakery: ['Boulangerie {F}', 'Fournil du {W}', 'Boulangerie du {W}'], cafe: ['Café du {W}', 'Le {W}', 'Salon de Thé du {W}'], bistro: ['Bistrot du {W}', 'Chez {F}', 'Le Petit {W}'], waffle: ['Crêperie du {W}', 'Crêperie {F}'], pub: ['Brasserie du {W}', 'Bar du {W}'], seafood: ['La Marée du {W}', 'Poissonnerie {F}'], bnb: ["Chambres d'hôtes du {W}", 'Gîte du {W}', 'Auberge du {W}'], butcher: ['Boucherie {F}'], grocer: ['Épicerie {F}', 'Primeur du {W}'], pharmacy: ['Pharmacie du {W}'], hotel: ['Hôtel du {W}'], icecream: ['Glacier {F}'], florist: ['Fleurs du {W}'], bookshop: ['Librairie du {W}'] },
	},
	de: {
		F: ['Greta', 'Otto', 'Liesel', 'Fritz', 'Anni', 'Klaus', 'Hanne', 'Willi', 'Ilse', 'Bruno'], S: ['Weber', 'Becker', 'Hoffmann', 'Schröder', 'Keller'],
		W: ['Linde', 'Eiche', 'Hirsch', 'Adler', 'Rose', 'Krone', 'Sonne', 'Brunnen', 'Mühle', 'Tanne', 'Bach', 'Stern', 'Löwe', 'Ochsen', 'Schwan'],
		m: { bakery: 3, pub: 2, butcher: 3, cafe: 1.3, grill: 1.5, bbq: 0.2, taco: 0.1, diner: 0, burger: 0.6, huntpost: 1 },
		n: { bakery: ['Bäckerei {F}', 'Backstube {W}'], pub: ['Gasthaus {W}', 'Wirtshaus {W}', 'Gaststätte {W}'], bistro: ['Gasthof {W}'], cafe: ['Café {W}', 'Kaffeehaus {F}'], butcher: ['Metzgerei {F}'], bnb: ['Pension {W}', 'Gästehaus {F}'], grill: ['{W} Imbiss', 'Döner {W}'], grocer: ['Markt {F}'], pharmacy: ['{W}-Apotheke'], hotel: ['Hotel {W}'], huntpost: ['Jagdhaus {W}'], icecream: ['Eiscafé {W}'] },
	},
	nordic: {
		F: ['Astrid', 'Lars', 'Freja', 'Nils', 'Ingrid', 'Sven', 'Maja', 'Olle'], S: ['Berg', 'Lund', 'Dahl', 'Holm'],
		W: ['Fjord', 'Björk', 'Tall', 'Lind', 'Havn', 'Fyr', 'Älv', 'Sjö', 'Granen', 'Måsen', 'Strand', 'Ekorre'],
		m: { bakery: 2, cafe: 2, seafood: 1.5, pub: 0.8, taco: 0.2, diner: 0.1, bbq: 0.3, huntpost: 1.2 },
		n: { bakery: ['{W} Bageri', 'Bageri {F}'], cafe: ['Kafé {W}', '{W} Kaffebar'], seafood: ['{W} Fisk', 'Fiskebua {W}'], bnb: ['{W} Gästgiveri', 'Pensionat {W}'], pub: ['{W} Krog'] },
	},
	mx: {
		F: ['Lupe', 'Chuy', 'Rosa', 'Beto', 'Marisol', 'Nacho', 'Lety', 'Pancho', 'Chela', 'Toño'], S: ['Hernández', 'López', 'Ramírez', 'Cruz'],
		W: ['Sol', 'Luna', 'Nopal', 'Maguey', 'Colibrí', 'Jacaranda', 'Fuego', 'Agave', 'Cielo', 'Palma', 'Milagro', 'Mariposa', 'Cometa', 'Girasol'],
		m: { taco: 6, bakery: 2, icecream: 2, pub: 1, seafood: 1.2, diner: 0.1, bbq: 0.5, sushi: 0.3, waffle: 0.2, donut: 0.2, boba: 0.3 },
		n: { taco: ['Taquería {F}', 'Tacos {W}', 'Taquería {W}', 'Tortillería {F}'], bakery: ['Panadería {W}', 'Panadería {F}'], icecream: ['Paletería {W}', 'Nevería {F}'], pub: ['Cantina {W}', 'Cantina {F}'], seafood: ['Mariscos {W}', 'Mariscos {F}'], bnb: ['Posada {W}', 'Casa {W}'], cafe: ['Café {W}', 'Cafetería {F}'], grocer: ['Abarrotes {F}', 'Mercadito {W}'], general: ['Abarrotes {W}'], bbq: ['Barbacoa {F}', 'Carnitas {W}'], butcher: ['Carnicería {F}'], pharmacy: ['Farmacia {W}'], hotel: ['Hotel {W}'], motel: ['Motel {W}'] },
	},
	in: {
		F: ['Ravi', 'Priya', 'Anand', 'Lakshmi', 'Arjun', 'Meera', 'Vikram', 'Asha'], S: ['Sharma', 'Iyer', 'Patel', 'Reddy', 'Nair'],
		W: ['Lotus', 'Jasmine', 'Peacock', 'Saffron', 'Monsoon', 'Banyan', 'Tulsi', 'Marigold', 'Neem', 'Kesar', 'Chandni', 'Champa'],
		m: { curry: 6, cafe: 2, bakery: 2, noodles: 0.6, burger: 0.5, bbq: 0.2, taco: 0, pub: 0.3, diner: 0, sushi: 0.1, huntpost: 0.2, tailor: 3 },
		n: { curry: ['{W} Dhaba', 'Hotel {W}', '{W} Bhavan', "{F}'s Biryani House"], cafe: ['{W} Chai', "{F}'s Tea Stall"], bakery: ['{W} Sweets', '{F} Mithai'], bnb: ['{W} Guest House', '{W} Homestay'], grocer: ['{F} Kirana Store', '{W} Provisions'], pharmacy: ['{W} Medicals'], tailor: ['{F} Tailors'] },
	},
	sea: {
		F: ['Mai', 'Somchai', 'Linh', 'Anh', 'Nok', 'Dao', 'Ploy', 'Tuan'], S: ['Nguyen', 'Tran', 'Chaiyo', 'Santos'],
		W: ['Lotus', 'Orchid', 'Coconut', 'Monsoon', 'Jasmine', 'Frangipani', 'Bamboo', 'Lemongrass', 'Pandan', 'Sunrise', 'River', 'Banana Leaf'],
		m: { noodles: 5, cafe: 1.5, seafood: 1.5, bbq: 0.5, burger: 0.6, taco: 0, diner: 0, huntpost: 0.2 },
		n: { noodles: ['Pho {W}', '{W} Noodle Bar', '{W} Kitchen'], seafood: ['{W} Seafood'], cafe: ['{W} Café', '{W} Coffee'], bnb: ['{W} Homestay', '{W} Guesthouse'] },
	},
	me: {
		F: ['Omar', 'Layla', 'Karim', 'Nadia', 'Samir', 'Yasmin', 'Tariq', 'Rania'], S: ['Haddad', 'Khoury', 'Mansour', 'Aziz'],
		W: ['Cedar', 'Jasmine', 'Oasis', 'Pomegranate', 'Saffron', 'Olive', 'Crescent', 'Palm', 'Fig', 'Zaatar', 'Sumac', 'Rose'],
		m: { grill: 6, cafe: 2, bakery: 1.5, pub: 0.1, bbq: 0.3, taco: 0, diner: 0, burger: 0.6, pasta: 0.4, huntpost: 0.3 },
		n: { grill: ['{W} Grill', "{F}'s Shawarma", 'Falafel {W}', '{W} Kebab House'], cafe: ['{W} Coffee House', "{F}'s Qahwa"], bakery: ['{W} Sweets', '{W} Bakery'], bnb: ['{W} Guest House'] },
	},
};
// when a town has two of a name: how a second one tells itself apart (a branch, an owner)
const APART = { fr: ['de {F}'], it: ['da {F}'], es: ['de {F}'], mx: ['de {F}'], latam: ['de {F}'], pt: ['de {F}'], br: ['de {F}'], de: ['Inh. {F}'], jp: ['{W}-ten'], kr: ['{W}-jeom'], nordic: ['hos {F}'] };
const APART_EN = ['on {W}', 'of {W}', '{W} Street', 'at {W} Corner'];
LOCALES.latam = { ...LOCALES.mx, n: { ...LOCALES.mx.n, taco: ['Arepera {W}', 'Empanadas {F}', 'Pupusería {F}'] } };
LOCALES.br = { ...LOCALES.pt, m: { bbq: 3, bakery: 2, cafe: 1.5, icecream: 1.3, taco: 0.1, diner: 0, tapas: 0 }, n: { ...LOCALES.pt.n, pub: ['Boteco {F}', 'Bar {W}'], icecream: ['Sorveteria {W}'], bakery: ['Padaria {W}'], bbq: ['Churrascaria {W}'] } };
LOCALES.intl = { ...EN, m: { cafe: 1.2, grill: 1, noodles: 0.6, diner: 0.2, bbq: 0.5, huntpost: 0.6, winery: 0.3 } };

// which place's words: a few boxes, tried in order (rough borders are fine for shop names)
export function localeAt(lat, lon) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'us-ca';
	const inB = (s, w, n, e) => lat >= s && lat <= n && lon >= w && lon <= e;
	if (inB(36.5, -124.5, 42, -119.5) || inB(32.5, -121, 36.5, -114.5)) return 'us-ca';
	// Mexico: south of the border (the Rio Grande from El Paso to Brownsville, roughly)
	if (inB(14.5, -118, 32.7, -86.7)) {
		const border = lon < -114.7 ? 32.5 : lon < -106.5 ? 31.33 : lon < -97.2 ? 31.8 - (lon + 106.5) * 0.634 : 25.9;
		if (lat < border) return 'mx';
	}
	if (inB(25.8, -106.7, 36.5, -93.5)) return 'us-tx';
	if (inB(24.5, -125, 49.5, -66.5) || inB(49, -141, 70, -52)) return 'us';
	if (inB(-34, -74, 5.3, -34.8)) return 'br';
	if (inB(-56, -92, 14.5, -34)) return 'latam';
	if (inB(49.8, -10.7, 60.9, 1.8)) return 'uk';
	if (inB(36.9, -9.6, 42.2, -6.2)) return 'pt';
	if (inB(35.9, -9.4, 43.8, 3.4) && (lat < 42.4 || lon < -1.6)) return 'es';
	if (inB(36.6, 6.6, 47.1, 18.6) && !(lat > 46.4 && lon < 10.5)) return 'it';
	if (inB(42.3, -4.8, 51.1, 8.2)) return 'fr';
	if (inB(45.8, 5.9, 55.1, 17.2)) return 'de';
	if (inB(54.5, 4.5, 71.2, 31.6)) return 'nordic';
	if (inB(24, 122.9, 46, 146)) return 'jp';
	if (inB(33, 124.5, 38.7, 130.9)) return 'kr';
	if (inB(-11, 92, 23.4, 141) && !(lat > 18 && lon > 106.8 && lon < 122)) return 'sea';
	if (inB(18, 73.5, 53.6, 135)) return 'cn';
	if (inB(6.5, 68, 35.5, 97.4)) return 'in';
	if (inB(12, 34, 42, 63)) return 'me';
	if (inB(-47.5, 112, -10, 179)) return 'au';
	return 'intl';
}

// ---------- no real brands ----------
// (names that would read as a real chain or company; checked letters only, any case)
export const DENY = ['mcdonald', 'starbucks', 'peets', 'philz', 'bluebottle', 'dutchbros', 'timhortons', 'costacoffee', 'caffenero', 'panera', 'krispykreme', 'dunkin', 'wafflehouse', 'ihop', 'dennys', 'blackbear', 'redrobin', 'olivegarden', 'goldencorral', 'crackerbarrel', 'pizzahut', 'dominos', 'papajohn', 'littlecaesar', 'roundtable', 'sbarro', 'subway', 'jerseymike', 'jimmyjohn', 'burgerking', 'wendys', 'carlsjr', 'jackinthebox', 'innout', 'fiveguys', 'shakeshack', 'smashburger', 'sonicdrive', 'arbys', 'hardees', 'culvers', 'whataburger', 'whitecastle', 'fatburger', 'kfc', 'kentuckyfried', 'popeyes', 'chickfila', 'bojangles', 'raisingcane', 'tacobell', 'deltaco', 'chipotle', 'qdoba', 'elpolloloco', 'pandaexpress', 'pfchang', 'benihana', 'nandos', 'wagamama', 'pretamanger', 'greggs', 'yosushi', 'ichiran', 'ippudo', 'yoshinoya', 'sukiya', 'matsuya', 'mosburger', 'lotteria', 'cocoichibanya', 'saizeriya', 'lawson', 'familymart', 'seveneleven', '7eleven', 'uniqlo', 'muji', 'donquijote', 'telepizza', 'mercadona', 'carrefour', 'lidl', 'aldi', 'tesco', 'sainsbury', 'walmart', 'target', 'costco', 'safeway', 'wholefoods', 'traderjoe', 'kroger', 'albertsons', 'walgreens', 'riteaid', 'homedepot', 'lowes', 'acehardware', 'truevalue', 'basspro', 'cabelas', 'patagonia', 'northface', 'orvis', 'westmarine', 'apple', 'google', 'amazon', 'microsoft', 'tesla', 'nvidia', 'intel', 'oracle', 'salesforce', 'adobe', 'cisco', 'netflix', 'uber', 'lyft', 'airbnb', 'facebook', 'hilton', 'marriott', 'hyatt', 'sheraton', 'holidayinn', 'bestwestern', 'motel6', 'super8', 'daysinn', 'comfortinn', 'ritzcarlton', 'fourseasons', 'wellsfargo', 'bankofamerica', 'citibank', 'nike', 'adidas', 'zara', 'ikea', 'sephora', 'supercuts', 'greatclips', 'jiffylube', 'midas', 'pepboys', 'firestone', 'goodyear', 'chevron', 'exxon', 'texaco', 'valero', 'planetfitness', 'goldsgym', 'equinox', 'anytimefitness', 'baskinrobbins', 'dairyqueen', 'coldstone', 'benjerry', 'haagendazs', 'parisbaguette', 'tousles', 'gongcha', 'kungfutea', 'chatime', 'dintaifung', 'haidilao', 'luckin', 'mixue', 'heytea', 'hooters', 'applebee', 'chilis', 'tgifriday', 'outback', 'texasroadhouse', 'longhorn steak', 'buffalowild', 'cheesecakefactory', 'hardrock', 'rainforestcafe', 'bubbagump', 'crabshack', 'redlobster', 'longjohnsilver', 'bonefish', 'ghirardelli', 'boudin', 'wetherspoon', 'harvester', 'tobycarvery', 'beefeater', 'premierinn', 'travelodge', 'boots', 'waitrose', 'vapiano', 'tchibo', 'nordsee', 'oxxo', 'sanborns', 'haldiram', 'bikanervala', 'chaayos', 'saravana', 'kyochon', 'ediya', 'paiks', 'cafecoffeeday', 'briochedoree', 'boulangeriepaul', 'laduree', 'hippopotamus', 'buffalogrill', 'flunch', 'autogrill', 'eataly', 'lavazza', 'segafredo', 'illycaffe', 'redcross', 'goldengate', 'blueapron', 'sweetgreen', 'cava', 'jollibee', 'mrdonut', 'misterdonut', 'tullys', 'doutor', 'komeda', 'pronto', 'ootoya', 'genkisushi', 'kurasushi', 'sushiro', 'hamazushi', 'tenya', 'marugame', 'hanamaru'].map((s) => s.replace(/[^a-z0-9]/g, ''));
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function denied(name) {
	const n = norm(name);
	return DENY.some((d) => d && n.includes(d));
}

// ---------- what a building is ----------
export function settingOf(b) {
	const use = b.use, down = b.down || 0;
	if (use === 'tower' || (down > 0.3 && use !== 'house')) return 'downtown';
	if (use === 'industry') return b.coast ? 'harbour' : b.highway ? 'highway' : 'industrial';
	if (use === 'office') return down > 0.12 ? 'downtown' : 'park';
	if (use === 'retail') return b.coast ? 'harbour' : b.highway ? 'highway' : 'strip';
	if (use === 'shop') return b.coast ? 'harbour' : down > 0.15 ? 'downtown' : 'main';
	if (b.coast) return 'harbour';
	if (b.wild) return 'forest';
	if (b.rural) return 'rural';
	if (b.highway && (b.street || 0) >= 1) return 'highway';
	if (use === 'row' || use === 'apt') return (b.street || 0) >= 2 ? 'main' : 'residential';
	return 'residential';
}
// the chance a building is a business, by what it is and where it stands (tuned so every kind
// of town comes out at about a third or more: tools/economy.test.mjs holds it to 30%)
export function chanceOf(b, setting) {
	const st = b.street || 0;
	switch (b.use) {
		case 'tower': return 0.92;
		case 'office': return 0.95;
		case 'retail': return 0.97;
		case 'shop': return 0.97;
		case 'industry': return 0.72;
		case 'apt': return st >= 2 ? 0.55 : st === 1 ? 0.3 : 0.14;
		case 'row': return st >= 2 ? 0.7 : st === 1 ? 0.35 : 0.12;
		case 'house':
			if (setting === 'harbour') return st >= 1 ? 0.75 : 0.42;
			if (setting === 'forest') return st >= 1 ? 0.7 : 0.45;
			if (setting === 'rural') return st >= 1 ? 0.7 : 0.42;
			if (setting === 'highway') return 0.75;
			return st >= 2 ? 0.8 : st === 1 ? 0.5 : 0.1;
		default: return 0;
	}
}
// the walk-in fit-out a low commercial block gets (bay/commercial.js), so its sign agrees
export function venueFor(b) {
	if (b.venue !== undefined) return b.venue;
	if ((b.use === 'retail' || b.use === 'office') && (b.h || 0) <= 20) return venueOf({ x: b.x, z: b.z, w: b.w, d: b.d, kind: b.use === 'office' ? 5 : 6 });
	return null;
}
// the water's trades: on the waterfront (shore 3) twice as likely again, and near the coast
// (shore 1: the town reaches the sea a street or a few back) a few of them in any setting
const SHORE = { outfitter: 0.7, bait: 0.6, seafood: 0.9, surf: 0.35, fishmarket: 0.45, boatyard: 0.5, gift: 0.3, icecream: 0.3 };
function candidates(b, setting, loc) {
	const L = USE_LETTER[b.use], venue = venueFor(b), M = LOCALES[loc]?.m || {}, out = [];
	let tot = 0;
	const shore = b.shore || 0;
	for (const [id, T] of Object.entries(TYPES)) {
		if (!T.u.includes(L)) continue;
		if (venue && T.v !== venue) continue;
		let w = (T.w[setting] || 0) * (M[id] ?? 1);
		if (SHORE[id] && setting !== 'forest' && setting !== 'downtown') w = shore >= 3 ? w * 2 + SHORE[id] * 2 : shore >= 1 ? w + SHORE[id] * (shore >= 2 ? 1 : 0.5) * (M[id] ?? 1) : w;
		// (a fit-out with nothing listed for the setting still takes its own kind of place)
		if (venue && w === 0) w = 0.05 * (M[id] ?? 1);
		if (w <= 0) continue;
		tot += w; out.push([id, w]);
	}
	return { list: out, tot, venue };
}
function fill(pattern, L, u) {
	const F = L.F || EN.F, W = L.W || EN.W, A = L.A || W, S = L.S || EN.S;
	const w1 = pickOf(W, u(1));
	let w2 = pickOf(W, u(2));
	if (w2 === w1) w2 = W[(W.indexOf(w1) + 1) % W.length];
	const s1 = pickOf(S, u(3));
	let s2 = pickOf(S, u(4));
	if (s2 === s1) s2 = S[(S.indexOf(s1) + 1) % S.length];
	const xs = pickOf(X, u(6));
	return pattern.replace('{F}', pickOf(F, u(0))).replace('{W2}', w2).replace('{W}', w1).replace('{S2}', s2).replace('{S}', s1).replace('{A}', pickOf(A, u(5))).replace('{X}', xs)
		// ('Oak' + 'ly' reads as one word: 'Oakly'; 'Copper' + 'io' as 'Copperio')
		.replace(/([A-Za-z])\s?(ly|io|ware|grid|stack|loop|mind|sync|base|forge|pixel|wave|scope|bit|nest|path|spark|works)\b/, (m, a, b2) => (pattern.includes('{X}') ? a + b2 : m));
}
// a name for a business of type id at (x, z) in a place, the salt trying another
export function nameFor(id, x, z, loc = 'us-ca', salt = 0) {
	const T = TYPES[id], L = LOCALES[loc] || LOCALES.us;
	// (the English ways of naming read oddly elsewhere: 'The Coin Acre Farm', 'Élise's Pets')
	const english = !L.n || L.F === EN.F, own = L.n?.[id];
	const plain = english ? T.n : T.n.filter((p) => !p.includes('{A}') && !p.includes("'s"));
	const pats = own || (plain.length ? plain : T.n);
	for (let k = 0; k < 16; k++) {
		const s = salt * 31 + k * 7 + 3;
		const u = (n) => hashAt(x, z, 1000 + s * 13 + n * 101);
		const p = pickOf(pats, u(9));
		const name = fill(p, L, u);
		if (!denied(name)) return name;
	}
	return 'The ' + pickOf(EN.W, hashAt(x, z, 77 + salt)) + ' ' + T.label.replace(/^\w/, (c) => c.toUpperCase());
}

// the services' own siting (src/services/): registerSiting('hospital', (b, setting) => true) claims
// a building for that service before anything else is considered; fn returns true to claim it,
// or the service's own name for it (so the sign and the service agree)
const SITING = new Map();
const SERVICE_TYPE = { hospital: 'hospital', police: 'police', fire: 'firestation', 'fire station': 'firestation', firestation: 'firestation', armory: 'armory' };
export function registerSiting(kind, fn) {
	const id = SERVICE_TYPE[kind];
	if (!id) throw new Error('registerSiting: hospital, police, fire or armory');
	if (fn) SITING.set(id, fn); else SITING.delete(id);
	return () => SITING.delete(id);
}

// one building -> its establishment (or null: a home, a school, a car park)
export function establish(b, loc = 'us-ca') {
	const setting = settingOf(b);
	let id = null, given = null;
	for (const [k, fn] of SITING) { try { const got = fn(b, setting); if (got) { id = k; given = typeof got === 'string' ? got : null; break; } } catch (e) { console.warn('siting', k, e); } }
	if (!id) {
		const p = chanceOf(b, setting);
		if (p <= 0 || hashAt(b.x, b.z, 11) >= p) return null;
		const C = candidates(b, setting, loc);
		if (!C.tot) return null;
		let u = hashAt(b.x, b.z, 23) * C.tot;
		id = C.list[C.list.length - 1][0];
		for (const [k, w] of C.list) { u -= w; if (u <= 0) { id = k; break; } }
	}
	const T = TYPES[id], r = (n) => hashAt(b.x, b.z, 300 + n);
	const pal = pickOf(T.pal, r(1));
	const ca = Math.cos(b.a || 0), sa = Math.sin(b.a || 0), f = b.front ?? 1, out = (b.d / 2 + 1.2) * f;
	return {
		type: id, label: T.label, name: given || nameFor(id, b.x, b.z, loc), tag: b.sign && !denied(b.sign) ? String(b.sign).slice(0, 28) : T.tags ? pickOf(T.tags, r(4)) : T.tag,
		setting, use: b.use, venue: T.service ? null : venueFor(b) || T.v || null, service: T.service || null, locale: loc,
		x: b.x, z: b.z, a: b.a || 0, w: b.w, d: b.d, h: b.h || 0, front: f,
		door: [b.x - sa * out, b.z + ca * out],
		sign: { shape: T.s[0], font: T.s[1], bg: pal[0], fg: pal[1] },
		awning: T.awn ? pickOf(T.awn, r(2)) : null,
		props: T.props, drive: !!T.drive,
	};
}

// every building of a town -> its establishments, names unique within it (a clash takes
// another roll; buildings are taken in a fixed order, so a clash always settles the same way)
export function planTown(list, { locale = 'us-ca' } = {}) {
	const out = [], used = new Set(), order = list.map((b, i) => [hashAt(b.x, b.z, 5), i]).sort((p, q) => p[0] - q[0]);
	for (const [, i] of order) {
		const b = list[i], E = establish(b, b.locale || locale);
		if (!E) continue;
		for (let s = 1; used.has(E.name.toLowerCase()) && s < 24; s++) E.name = nameFor(E.type, b.x, b.z, E.locale, s);
		// (still taken: the same name with a branch or an owner after it)
		if (used.has(E.name.toLowerCase())) {
			const L = LOCALES[E.locale] || LOCALES.us, Q = APART[E.locale] || APART_EN, base = E.name;
			for (let k = 0; used.has(E.name.toLowerCase()) && k < 60; k++) E.name = base + ' ' + fill(pickOf(Q, hashAt(b.x, b.z, 500 + k)), L, (n) => hashAt(b.x, b.z, 600 + k * 17 + n));
		}
		used.add(E.name.toLowerCase());
		E.i = i;
		out.push(E);
	}
	return out;
}

// the share of the buildings that are businesses (homes, schools and the rest counted too)
export function shareOf(list, plan) {
	const n = list.filter((b) => b.use && b.use !== 'civic').length;
	return n ? plan.length / n : 0;
}

// ---------- the town generator's boxes and the mapped ones (bay/realcity.js kinds) ----------
// 0 house, 1/2 house with its garage, 3 garage, 4 wing, 5 office, 6 retail, 7 school,
// 8 apartments, 9 industrial, 10 shed, 11 tower, 12 parking
export const USE_OF_KIND = { 0: 'house', 1: 'house', 2: 'house', 5: 'office', 6: 'retail', 7: 'school', 8: 'apt', 9: 'industry', 11: 'tower' };
// boxes -> buildings: the street each house faces (b.street, civgen's road class), how
// crowded round it (fewer than five within 80 m is open country), and the env's own
// judgements: coast(x, z), wild(x, z), highway(x, z), down(x, z), street(b)
export function describeBoxes(boxes, env = {}) {
	const out = [], C = 40, grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
	for (const b of boxes) { if (USE_OF_KIND[b.kind] === undefined) continue; const k = key(Math.floor(b.x / C), Math.floor(b.z / C)); (grid.get(k) || grid.set(k, []).get(k)).push(b); }
	const crowd = (x, z) => { let n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) for (const q of grid.get(key(Math.floor(x / C) + i, Math.floor(z / C) + j)) || []) if ((q.x - x) ** 2 + (q.z - z) ** 2 < 6400) n++; return n - 1; };
	for (const b of boxes) {
		const use = USE_OF_KIND[b.kind];
		if (use === undefined) continue;
		const cls = b.street, core = b.core ?? 1;
		// (the road it faces; the old centre of a grown town counts as its main street)
		const st = env.street ? env.street(b) : Math.max(cls === 'primary' || cls === 'secondary' || cls === 'trunk' ? 2 : cls === 'tertiary' ? 1 : 0, core < 0.4 ? 2 : core < 0.6 || b.artery ? 1 : 0);
		const n = crowd(b.x, b.z);
		out.push({
			x: b.x, z: b.z, w: b.w, d: b.d, a: b.a, h: b.wallH || 0, use, street: st, src: b, sign: b.sign || null,
			coast: !!env.coast?.(b.x, b.z), shore: env.shore ? env.shore(b.x, b.z) : env.coast?.(b.x, b.z) ? 2 : 0, wild: !!env.wild?.(b.x, b.z) && n < 8, rural: use === 'house' && n < 5, highway: !!env.highway?.(b.x, b.z), down: env.down?.(b.x, b.z) || (b.site === 'downtown' ? 0.4 : 0),
		});
	}
	return out;
}
