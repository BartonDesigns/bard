// Named relics: a shared, dependency-free catalog for inventory, combat and procedural art.
// All values are fictional game balance. Existing ammunition keeps every drop usable.
const A = 'aurora-trail-rifle', M = 'mossback-scout-rifle', L = 'longwatch-sniper-rifle', W = 'warden-spark-carbine';
const rows = [
	['sunbreak-testament', 'Sunbreak Testament', A, 'radiance', 0xf3cd72, 65, 84, 7, 'The last lighthouse keeper engraved a sunrise into its stock.'],
	['black-tide', 'Black Tide', M, 'shadow', 0x7569ac, 88, 60, 5, 'Carried through a drowned city without a single lantern.'],
	['stormglass-repeater', 'Stormglass Repeater', A, 'storm', 0x64dfff, 39, 180, 12, 'Its glass veins remember every storm that crossed the bay.'],
	['widows-meridian', 'Widow’s Meridian', L, 'chrono', 0xc5adf4, 135, 48, 4, 'The watchmaker cut the final hour out of its dial.'],
	['orchard-of-ashes', 'Orchard of Ashes', M, 'primal', 0xe78043, 76, 78, 6, 'Salvaged from an orchard that bloomed after the fire.'],
	['pilgrims-last-light', 'Pilgrim’s Last Light', A, 'restoration', 0x9ce5bf, 52, 108, 9, 'A field medic carried it farther than any army marched.'],
	['event-horizon', 'Event Horizon', L, 'void', 0x8e78e4, 165, 32, 3, 'A black lens from the islands beneath Gargantua.'],
	['copper-saint', 'Copper Saint', A, 'warding', 0xc88c63, 60, 96, 8, 'Its dented copper plates bear the names of defended homes.'],
	['moth-kings-lantern', 'Moth King’s Lantern', W, 'umbral', 0x9a94d9, 20, 300, 22, 'The moths beneath the old tunnel followed this light home.'],
	['choir-of-thorns', 'Choir of Thorns', W, 'blight', 0xa5c35c, 25, 240, 18, 'A thorn reliquary that sings with a ruined garden’s voice.'],
	['dawn-engine', 'Dawn Engine', W, 'dawn', 0xffc392, 15, 480, 28, 'A courier’s sunwheel, rebuilt to carry the first light.'],
	['winter-debt', 'Winter Debt', W, 'chrono', 0x92d8ef, 29, 210, 16, 'Every crystal holds a second borrowed from a frozen river.'],
	['cathedral-of-sparks', 'Cathedral of Sparks', W, 'storm', 0x61bfff, 18, 420, 26, 'A portable reliquary for the thunder choir’s final chord.'],
	['gravesong-resonator', 'Gravesong Resonator', W, 'shadow', 0xb184cd, 33, 174, 12, 'The cavern’s answering note never quite fades.'],
	['hearth-of-the-exile', 'Hearth of the Exile', W, 'restoration', 0x93c6a5, 24, 240, 20, 'A wandering healer’s hearth, warm even between worlds.'],
	['gargantuas-whisper', 'Gargantua’s Whisper', W, 'void', 0x9879ff, 43, 126, 10, 'Island stone around a hollow that swallows its own echo.'],
	['wildfire-canticle', 'Wildfire Canticle', W, 'primal', 0xff7650, 27, 240, 18, 'The conductor’s instrument survived when the theatre did not.'],
	['oathkeeper-lattice', 'Oathkeeper Lattice', W, 'warding', 0x77d1c9, 21, 300, 24, 'A lattice of promises set into battered silver.'],
	['hollow-crown', 'Hollow Crown', W, 'umbral', 0xc39bdf, 38, 150, 11, 'No king wore it twice; the tunnel kept their voices.'],
	['first-morning', 'First Morning', W, 'radiance', 0xffe2a6, 31, 192, 15, 'An apprentice caught a sunrise in a broken observatory lens.'],
];
export const LEGENDARIES = Object.freeze(rows.map(([id, name, base, school, color, dmg, rpm, mag, lore], index) => Object.freeze({
	id, name, base, school, color, dmg, rpm, mag, lore, index,
	form: index < 8 ? 'firearm' : index % 2 ? 'relic' : 'hybrid',
	reload: base === L ? 3.1 : base === W ? 1.9 + (index % 3) * 0.15 : 2.3,
})));
export const LEGENDARY = Object.freeze(Object.fromEntries(LEGENDARIES.map(x => [x.id, x])));
export const LEGENDARY_ARMOR = Object.freeze([
	['lumencrest-circlet', 'Lumencrest Circlet', 'stargazer-circlet', 'head', 'radiance', 'leviathan', 0x9ee8ed, 'A crest shard from the Lumen Leviathan. Its radiance splits Sunspark into a fan.'],
	['gallery-scale-mail', 'Gallery Scale Mail', 'mail-hauberk', 'body', 'radiance', 'leviathan', 0x9ee8ed, 'Crystal-gallery scales over silver mail, resonating with the Leviathan’s Shell of Song.'],
	['cinder-core-cuirass', 'Cinder Core Cuirass', 'plate-cuirass', 'body', 'primal', 'walker', 0xe58a4b, 'Forged around the Cinder Colossus’s cooled vent plates. Cinder leaves burning ground.'],
	['ashwalker-greaves', 'Ashwalker Greaves', 'plate-greaves', 'legs', 'primal', 'walker', 0xe58a4b, 'Blackened plates from the Colossus’s kneeling joints, threaded with living embers.'],
	['stormwarden-flightcoat', 'Stormwarden Flightcoat', 'plate-carrier', 'body', 'storm', 'gunship', 0x7ac6ed, 'Storm-grey gunship plating and cyan seams. Chain Lightning reaches three more foes.'],
	['stormwarden-gauntlets', 'Stormwarden Gauntlets', 'tactical-gloves', 'hands', 'storm', 'gunship', 0x7ac6ed, 'Insulated gloves sewn around the Stormwarden’s recovered induction contacts.'],
	['fogmothers-veil', 'Fog Mother’s Veil', 'wayfarers-hood', 'head', 'shadow', 'fogmother', 0xb2a2cf, 'Salt-stained mourning cloth from the Gate. Shadowstep leaves a brief cloak behind.'],
	['drowned-procession-boots', 'Drowned Procession Boots', 'duskwalker-boots', 'feet', 'shadow', 'fogmother', 0xb2a2cf, 'The drowned walk silently in these weathered boots, their bridge-red seams still holding.'],
].map(([id,name,base,slot,school,boss,color,lore]) => Object.freeze({id,name,base,slot,school,boss,color,lore})));
export const RELICS = Object.freeze({ ...LEGENDARY, ...Object.fromEntries(LEGENDARY_ARMOR.map(x => [x.id,x])) });
export const legendaryBase = id => RELICS[id]?.base || id;
export const BOSS_RELICS = Object.freeze({
	leviathan: ['first-morning', 'winter-debt'], walker: ['orchard-of-ashes', 'wildfire-canticle'],
	gunship: ['stormglass-repeater', 'cathedral-of-sparks'], fogmother: ['black-tide', 'gravesong-resonator'],
});
export const relicBoss = id => RELICS[id]?.boss || Object.keys(BOSS_RELICS).find(k => BOSS_RELICS[k].includes(id)) || null;
export const RELIC_BOSS_NAMES = Object.freeze({leviathan:'Lumen Leviathan',walker:'Cinder Colossus',gunship:'Stormwarden',fogmother:'Fog Mother'});
