// 200 original fictional identities, organized by the actual service or product.
// Images are decoded lazily; this catalog contains no raster data.
import { hash32 } from './rand.js';
export const BRAND_COLLECTIONS = Object.freeze({
  "mobile": {
    "title": "Phone and device shops",
    "names": [
      "nori",
      "HOPWIRE",
      "pebbl",
      "DIALDAY",
      "milo mobile",
      "small signal",
      "ROVE",
      "telli"
    ]
  },
  "network": {
    "title": "Internet and communications",
    "names": [
      "FIBRAIL",
      "nearby",
      "KINET",
      "openline",
      "LUMA LINK",
      "tandem",
      "WEFT",
      "good ping"
    ]
  },
  "coffee": {
    "title": "Coffee roasters and cafes",
    "names": [
      "SUNDIAL",
      "brim",
      "STILLHOUSE",
      "third cup",
      "EMBERDAY",
      "wakefolk",
      "low tide",
      "COPPER SIP"
    ]
  },
  "tea": {
    "title": "Tea and botanical drinks",
    "names": [
      "leaflet",
      "MOSS & MINT",
      "STEEP",
      "quiet kettle",
      "VERDARA",
      "petal hour",
      "TANSY",
      "slowleaf"
    ]
  },
  "dairy": {
    "title": "Milk yogurt butter and cheese",
    "names": [
      "FIELDNOTE",
      "moolet",
      "GENTLE DAIRY",
      "white meadow",
      "CLOVERDAY",
      "nibble curd",
      "pale pail",
      "MELLOW MILK"
    ]
  },
  "bakery": {
    "title": "Bakeries and bread",
    "names": [
      "CRUMBFOLK",
      "rise & rye",
      "LOAFER",
      "little oven",
      "GOLDCRUST",
      "bready",
      "wheat street",
      "HUMBLE ROLL"
    ]
  },
  "grains": {
    "title": "Breakfast oats rice and cereal",
    "names": [
      "MORNING FIELD",
      "oatwell",
      "GRAINROOM",
      "ricewise",
      "HUSK",
      "early bowl",
      "CROP CIRCLE",
      "brann"
    ]
  },
  "pantry": {
    "title": "Canned goods spices and cooking supplies",
    "names": [
      "SHELFLIFE",
      "pinch",
      "GOOD JAR",
      "simmer",
      "PANTRY PAL",
      "whole spoon",
      "KIN SALT",
      "bright tin"
    ]
  },
  "pasta": {
    "title": "Pasta sauces and olive oil",
    "names": [
      "RIGOLI",
      "pomaro",
      "TWIRL",
      "casa filo",
      "OLIVET",
      "little basil",
      "SUGONA",
      "ribbon red"
    ]
  },
  "produce": {
    "title": "Fruit vegetables and market gardens",
    "names": [
      "SUNSPRIG",
      "orchard day",
      "PIP & STEM",
      "freshfolk",
      "GREEN CART",
      "meadow box",
      "ROOTLET",
      "happy harvest"
    ]
  },
  "snacks": {
    "title": "Crackers crisps nuts and sweets",
    "names": [
      "CRACKLE",
      "nibbits",
      "POPJOY",
      "salt skate",
      "PEPPERSNAP",
      "tiny crunch",
      "NUTKIN",
      "morsel"
    ]
  },
  "beverages": {
    "title": "Juice sparkling water and soda",
    "names": [
      "SPLISH",
      "drift soda",
      "ZESTRA",
      "clear creek",
      "BUBBLIN",
      "pulp day",
      "TANGLET",
      "spring room"
    ]
  },
  "cleaning": {
    "title": "Household cleaners soap and paper goods",
    "names": [
      "SWEEP",
      "spry",
      "CLEAN SLATE",
      "soft suds",
      "GLEAMLET",
      "wipewise",
      "BRISK HOME",
      "fresh fold"
    ]
  },
  "care": {
    "title": "Personal care and grooming",
    "names": [
      "daily kind",
      "FERNFORM",
      "soma soap",
      "SOFT CURRENT",
      "bare ritual",
      "LILT",
      "gentle grain",
      "NOVA COMB"
    ]
  },
  "home": {
    "title": "Homewares furniture and textiles",
    "names": [
      "HEARTHLINE",
      "nestlewood",
      "COMMON ROOM",
      "fold & form",
      "LAMPLOW",
      "woven day",
      "PLINTH",
      "small shelter"
    ]
  },
  "hardware": {
    "title": "Hardware tools repair and workshops",
    "names": [
      "BOLTWORK",
      "turnkey",
      "FIXFIELD",
      "IRON DOT",
      "hex & hand",
      "MAKERS END",
      "true square",
      "RIVETRY"
    ]
  },
  "outdoor": {
    "title": "Outdoor camping fishing and equipment",
    "names": [
      "TRAILTHREAD",
      "wild current",
      "CAMPKIN",
      "LOW RIDGE",
      "reed & reel",
      "FOOTPATH",
      "roamwell",
      "FIELD REST"
    ]
  },
  "apparel": {
    "title": "Clothing shoes tailoring and laundry",
    "names": [
      "HEMLINE",
      "threadkind",
      "OFFCUT",
      "soft hem",
      "CLOTH CLUB",
      "wearwell",
      "PLEAT",
      "needle day"
    ]
  },
  "books": {
    "title": "Bookshops stationery and printing",
    "names": [
      "MARGIN",
      "paperfolk",
      "INKWELL DAY",
      "turn page",
      "FOLIO CLUB",
      "pencil room",
      "LEAF & LINE",
      "little press"
    ]
  },
  "music": {
    "title": "Music instruments records and audio",
    "names": [
      "SIDE B",
      "humline",
      "REEDROOM",
      "little groove",
      "TONECRAFT",
      "pluck",
      "SOUND COMMON",
      "loop cellar"
    ]
  },
  "transport": {
    "title": "Bicycles garages delivery and travel",
    "names": [
      "WHEELDAY",
      "rollout",
      "CARGO KIN",
      "waypost",
      "SHIFTWORK",
      "parcel hop",
      "MILEMARK",
      "easy axle"
    ]
  },
  "retro": {
    "title": "Independent neighborhood shops and services",
    "names": [
      "CORNER GOOD",
      "daymart",
      "SUNSET SUPPLY",
      "okay shop",
      "PARKSIDE",
      "good neighbor",
      "ODD HOURS",
      "sunday service"
    ]
  },
  "guild": {
    "title": "Medieval trades and inns",
    "names": [
      "THE BENT NAIL",
      "Reed & Root",
      "FOXLOAF",
      "The Quiet Bell",
      "ASH & ANVIL",
      "Willow Thread",
      "CANDLEWICK",
      "Mossgate"
    ]
  },
  "fae": {
    "title": "Mystical herbalists makers and wayhouses",
    "names": [
      "moonmend",
      "FERNLIGHT",
      "Dew & Thorn",
      "HUSHWELL",
      "Silverroot",
      "moth hour",
      "GLIMMER REED",
      "Stillbloom"
    ]
  },
  "orbital": {
    "title": "Off-world habitat repair and provision suppliers",
    "names": [
      "ORBITAL COMMON",
      "airkind",
      "DOCK NINE",
      "REGOLITH",
      "pulse supply",
      "HABIT FORM",
      "ion pantry",
      "CIRCUIT YARD"
    ]
  }
});
export const BRAND_FAMILIES = Object.freeze(Object.keys(BRAND_COLLECTIONS).map(id => 'brands-' + id));
export const BRAND_COUNT = Object.values(BRAND_COLLECTIONS).reduce((n,c)=>n+c.names.length,0);
export function brandName(family, index) { return BRAND_COLLECTIONS[String(family).replace(/^brands-/, '')]?.names[index] || ''; }
export function brandIdentity(category, seed = '') {
 const c=BRAND_COLLECTIONS[category]; if(!c) return null;
 const trade=hash32(String(seed),category) % c.names.length;
 return {family:'brands-'+category,trade,brand:c.names[trade]};
}
export function brandCategory(type='') {
 const t=String(type).toLowerCase();
 const rules=[
 ['mobile',/phone|mobile|gadget/],['network',/telecom|internet|broadband/],
 ['tea',/^(tea|boba)$/],['coffee',/cafe|coffee|roastery/],['dairy',/dairy|cheese/],['bakery',/bake|bread|donut|waffle/],
 ['pasta',/pasta|pizza|italian/],['produce',/farmstand|produce|greengrocer/],['snacks',/candy|snack|sweet/],['beverages',/juice|soda/],
 ['cleaning',/laundr|cleaning/],['care',/barber|salon|spa|beauty/],['home',/furniture|homeware|upholster/],
 ['hardware',/hardware|woodshop|tools|repair|mechanic|garage/],['outdoor',/outfit|fishing|bait|surf|huntpost|camp/],
 ['apparel',/cloth|tailor|boutique|thrift/],['books',/book|printshop|stationer/],['music',/music|records|instrument/],
 ['transport',/bike|mover|courier|delivery|transport/],['pantry',/grocer|market|general|provision/],['retro',/gift|antique|shop/]
 ];
 return rules.find(([,re])=>re.test(t))?.[0] || null;
}
// Department assignment is explicit so labels never advertise food in hardware shops.
export function productBrand(product, seed='') {
 return brandIdentity(({2:'coffee',3:'dairy',4:'grains',5:'pasta',6:'produce',7:'cleaning',8:'snacks',9:'beverages',10:'pantry',11:'bakery'})[product], seed);
}

