// Where you are, as the regional kit sees it: the one profile the people, the sounds, the
// music and the talk all read (set a few times a second by index.js while you are out on
// the globe; off in the Bay and on other worlds, where everything keeps its own ways).
//
//   regionalNow()   the state, or null when the regional kit is not in charge here

export const here = {
	on: false,
	lat: 0, lon: 0,
	kit: null,                  // kits.js profile (the one you are in)
	weights: [],                // the blend near a border: [{ id, w }]
	culture: null,              // cultures.js
	region: null,               // the atlas profile
	regionId: '', regionName: '', country: '',
	town: null,                 // the settlement you are in or nearest: { name, kind, km }
	climate: null,              // climate.js now()
	landmark: null,             // the nearest landmark with a story: { name, tale, km, dir, real }
	onward: null,               // the next town on: { name, km, dir }
	known: null,                // the nearest real town and the landmarks it is known for
	minaret: null,              // the nearest minaret (for the call to prayer): [x, y, z]
};
export const regionalNow = () => (here.on ? here : null);
