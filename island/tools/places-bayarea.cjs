// Builds src/bay/places.js: every GeoNames place (cities1000, CC BY 4.0) in the nine
// Bay Area counties, with rough populations for the cities (thousands) that set how far
// each town's streets reach, plus the waters and landmarks that get their own notation.
// Run: node tools/places-bayarea.cjs <path to cities.json package dir>
const fs = require('fs');
const dir = process.argv[2];
const C = require(dir + '/cities.json');
const COUNTY = { '001': 'Alameda County', '013': 'Contra Costa County', '041': 'Marin County', '055': 'Napa County', '075': 'San Francisco', '081': 'San Mateo County', '085': 'Santa Clara County', '095': 'Solano County', '097': 'Sonoma County' };
const POP = { 'San Jose': 970, 'San Francisco': 810, Oakland: 430, Fremont: 225, 'Santa Rosa': 175, Hayward: 160, Sunnyvale: 155, Concord: 125, 'Santa Clara': 130, Vallejo: 125, Berkeley: 120, Fairfield: 120, Richmond: 115, Antioch: 115, 'Daly City': 100, 'San Mateo': 105, Vacaville: 100, Livermore: 87, 'San Leandro': 85, 'San Ramon': 85, Pleasanton: 78, 'Mountain View': 82, Milpitas: 80, 'Union City': 70, 'Walnut Creek': 70, 'Palo Alto': 68, 'Redwood City': 84, Pittsburg: 76, Alameda: 76, Dublin: 72, Napa: 78, 'San Rafael': 60, Petaluma: 60, Brentwood: 65, Cupertino: 60, 'South San Francisco': 66, Newark: 47, Novato: 53, 'Castro Valley': 66, 'Menlo Park': 33, Campbell: 43, 'Los Gatos': 33, Saratoga: 31, 'Morgan Hill': 45, Gilroy: 59, Pacifica: 38, 'Foster City': 33, 'San Bruno': 43, Burlingame: 31, Belmont: 28, 'San Carlos': 30, Millbrae: 23, Martinez: 37, 'Pleasant Hill': 34, Danville: 43, Lafayette: 25, Orinda: 19, Moraga: 17, 'El Cerrito': 25, Albany: 20, Emeryville: 13, Piedmont: 11, Hercules: 26, Pinole: 19, 'San Pablo': 32, Benicia: 27, Suisun: 29, Dixon: 19, 'Rohnert Park': 44, Windsor: 26, Healdsburg: 12, Sebastopol: 8, Sonoma: 11, 'American Canyon': 21, 'Mill Valley': 14, Sausalito: 7, Larkspur: 13, 'Corte Madera': 10, Tiburon: 9, Belvedere: 2, 'Half Moon Bay': 11, 'East Palo Alto': 29, 'Los Altos': 31, Atherton: 7, Woodside: 5, Hillsborough: 11, Brisbane: 5, Colma: 1.5, Clayton: 11, Oakley: 44, 'Bay Point': 23, Alamo: 15, Kensington: 5, Ashland: 23, 'San Lorenzo': 29, Cherryland: 15, 'San Anselmo': 12, Fairfax: 7, Ross: 2, Calistoga: 5, 'Saint Helena': 5, Yountville: 3, Cloverdale: 9, Cotati: 7, 'Rio Vista': 10, Crockett: 3, Rodeo: 9, 'El Sobrante': 13, 'Pacheco': 4, 'Stanford': 15, 'Los Altos Hills': 8, 'Monte Sereno': 3, 'Portola Valley': 4, 'Redwood Shores': 13, 'North Fair Oaks': 14, 'Montara': 3, 'Moss Beach': 3, 'El Granada': 5, 'Marin City': 3, 'Bolinas': 1.5, 'Inverness': 1.5, 'Bodega Bay': 1, 'Guerneville': 5, 'Occidental': 1, 'Discovery Bay': 15 };
// neighbourhoods of San Francisco and San Jose get notations but no reach of their own
const NEIGHBOURHOOD = new Set(['Bayview', 'Bayview-Hunters Point', 'Chinatown', 'Mission District', 'Noe Valley', 'Parkside', 'Visitacion Valley', 'Alum Rock', 'Burbank', 'Cambrian Park', 'Communications Hill', 'Seven Trees', 'Broadmoor']);
const places = [];
const seen = new Set();
for (const c of C) {
	if (c.country !== 'US' || c.admin1 !== 'CA' || !COUNTY[c.admin2]) continue;
	const key = c.name + '|' + (+c.lat).toFixed(2);
	if (seen.has(key)) continue; seen.add(key);
	const n = NEIGHBOURHOOD.has(c.name);
	places.push([c.name, +(+c.lat).toFixed(5), +(+c.lng).toFixed(5), COUNTY[c.admin2], n ? 0 : (POP[c.name] || 2.5), n ? 1 : 0]);
}
// waters and landmarks: [name, lat, lon, subtitle, radius m]
const ZONES = [
	['Pacific Ocean', 37.72, -122.9, 'Gulf of the Farallones', 0],
	['Golden Gate', 37.8166, -122.4845, 'The strait between San Francisco and the Marin Headlands', 1500],
	['San Francisco Bay', 37.78, -122.35, 'Central Bay', 9000],
	['Richardson Bay', 37.87, -122.49, 'Between Sausalito and Tiburon', 2500],
	['Raccoon Strait', 37.868, -122.445, 'Between Tiburon and Angel Island', 900],
	['San Pablo Bay', 38.05, -122.38, 'North Bay', 11000],
	['Carquinez Strait', 38.055, -122.2, 'Where the rivers meet the bay', 3500],
	['Suisun Bay', 38.07, -122.03, 'Gateway to the Delta', 8000],
	['South Bay', 37.55, -122.15, 'San Francisco Bay', 16000],
	['Angel Island', 37.8609, -122.4326, 'State Park', 1300],
	['Alcatraz Island', 37.8267, -122.4230, 'The Rock', 350],
	['Treasure Island', 37.8237, -122.3708, 'San Francisco', 900],
	['Yerba Buena Island', 37.8103, -122.3636, 'San Francisco', 600],
	['Marin Headlands', 37.83, -122.51, 'Golden Gate National Recreation Area', 2500],
	['The Presidio', 37.7989, -122.4662, 'San Francisco', 1400],
	['Golden Gate Park', 37.7694, -122.4862, 'San Francisco', 1600],
	['Twin Peaks', 37.7544, -122.4477, 'San Francisco', 600],
	['Mount Tamalpais', 37.9235, -122.5965, 'Marin County', 2500],
	['Mount Diablo', 37.8816, -121.9142, 'Contra Costa County', 3500],
	['Mount Hamilton', 37.3414, -121.6425, 'Lick Observatory, Santa Clara County', 3000],
	['Point Reyes', 38.0, -122.95, 'National Seashore, Marin County', 6000],
	['Point Bonita', 37.8157, -122.5298, 'Lighthouse, Marin Headlands', 500],
	['Ocean Beach', 37.7594, -122.5107, 'San Francisco', 1200],
	['Muir Woods', 37.8970, -122.5811, 'Redwoods, Marin County', 900],
	['Stinson Beach', 37.9005, -122.6444, 'Marin County', 1000],
	['Fisherman\'s Wharf', 37.8080, -122.4177, 'San Francisco', 500],
	['Financial District', 37.7946, -122.3999, 'San Francisco', 600],
	['Lake Merritt', 37.8024, -122.2583, 'Oakland', 700],
];
const out = `// Generated by tools/places-bayarea.cjs from GeoNames (cities1000, CC BY 4.0).
// Places: [name, lat, lon, county, population (thousands; 0 = neighbourhood), neighbourhood?]
// Zones: waters and landmarks with their own notation: [name, lat, lon, subtitle, radius m]
export const PLACES = ${JSON.stringify(places)};
export const ZONES = ${JSON.stringify(ZONES)};
`;
fs.writeFileSync(__dirname + '/../src/bay/places.js', out);
console.log(places.length, 'places,', ZONES.length, 'zones');
