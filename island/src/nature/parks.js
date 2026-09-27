// Parks & Recreation data for Crysis (San Francisco Bay Area and coast).
// Plain data, no dependencies. Place with src/bay/geo.js toWorld(lat, lon):
//   x = (lon + 122.57) * 111320 * cos(37.76 deg), z = -(lat - 37.76) * 110996.
//
// PARKS: one entry per park. lat/lon is the main lot / visitor hub (where a player should
//   arrive), not the geometric centre. Coordinates marked "(approx)" in the note or
//   trailhead name are from memory to ~100-300 m and should be checked against OSM
//   before building fixed geometry on them.
//   busy: the peak window [start hour, end hour] (24 h) on weekdays and weekends.
//   fishing: species and the months (1-12) they are realistically caught there.
// AGENCY_STYLE: sign and building palette per managing agency (keys used by PARKS.agency).
// KIT: amenity specs, metres, hex colours, for building from primitives.

export const PARKS = [
	{
		id: 'sanramon-central', name: 'San Ramon Central Park', lat: 37.7643, lon: -121.9528, agency: 'city-sanramon', kind: 'city',
		amenities: ['playground', 'playground-tot', 'water-play', 'soccer', 'softball', 'bocce', 'picnic', 'bbq', 'restroom', 'drinking-fountain', 'bench', 'amphitheater', 'community-center', 'library', 'bike-rack', 'dog-park', 'parking'],
		trailheads: [{ name: 'Central Park path loop (from Community Center lot)', lat: 37.7648, lon: -121.9535 }],
		fishing: [],
		busy: { weekday: [15, 19], weekend: [9, 17] },
		note: 'Splash in the summer water play, then race to the big slide while the soccer games go on next door. (City Center Bishop Ranch at 37.7672,-121.9600 is 600 m WNW; the park is east of City Hall on Bollinger Canyon Rd and Alcosta Blvd.)',
	},
	{
		id: 'bishop-ranch-os', name: 'Bishop Ranch Regional Open Space', lat: 37.7745, lon: -121.9975, agency: 'ebrpd', kind: 'open-space',
		amenities: ['trailhead', 'kiosk', 'trail-marker', 'cattle-gate', 'barbed-fence', 'bench', 'trash'],
		trailheads: [{ name: 'Bishop Ranch OS access, Morgan Dr / San Ramon Valley Blvd (approx)', lat: 37.7745, lon: -121.9975 }],
		fishing: [],
		busy: { weekday: [7, 9], weekend: [8, 11] },
		note: 'A short steep climb through cattle gates to a ridge bench where you can spot Mt Diablo and count the hawks.',
	},
	{
		id: 'iron-horse', name: 'Iron Horse Regional Trail (San Ramon)', lat: 37.7687, lon: -121.9640, agency: 'ebrpd', kind: 'regional',
		amenities: ['bike-path', 'trail-marker', 'bench', 'drinking-fountain', 'trash', 'bike-rack'],
		trailheads: [{ name: 'Iron Horse Trail at Bishop Ranch / Crow Canyon Rd', lat: 37.7687, lon: -121.9640 }],
		fishing: [],
		busy: { weekday: [6, 8], weekend: [8, 12] },
		note: 'A flat old railway line that is perfect for a first long bike ride; count the mileposts as you go.',
	},
	{
		id: 'lake-annabel', name: 'Lake Annabel (Bishop Ranch)', lat: 37.7646, lon: -121.9652, agency: 'private', kind: 'city',
		amenities: ['fishing-edge', 'bench', 'path-loop', 'trash', 'restaurant'],
		trailheads: [{ name: 'Lake walk, Roundhouse side', lat: 37.7651, lon: -121.9639 }],
		fishing: [{ species: 'bluegill', months: [4, 5, 6, 7, 8, 9, 10] }, { species: 'largemouth bass', months: [3, 4, 5, 6, 9, 10] }, { species: 'redear sunfish', months: [5, 6, 7, 8, 9] }, { species: 'channel catfish', months: [6, 7, 8, 9] }, { species: 'common carp', months: [4, 5, 6, 7, 8, 9, 10] }],
		busy: { weekday: [11, 14], weekend: [9, 12] },
		note: 'A little office-park lake for a first bobber: bluegill by the rocks, turtles on the riprap (private land: treat as catch-and-release).',
	},
	{
		id: 'las-trampas', name: 'Las Trampas Regional Wilderness', lat: 37.8155, lon: -122.0495, agency: 'ebrpd', kind: 'regional',
		amenities: ['trailhead', 'kiosk', 'parking', 'restroom-vault', 'picnic', 'drinking-fountain', 'trail-marker', 'cattle-gate', 'barbed-fence', 'horse-stables'],
		trailheads: [{ name: 'Bollinger Canyon staging area', lat: 37.8155, lon: -122.0495 }, { name: 'Rocky Ridge (top of Rocky Ridge View Tr, approx)', lat: 37.8110, lon: -122.0390 }],
		fishing: [],
		busy: { weekday: [8, 10], weekend: [8, 12] },
		note: 'Hunt for fossil shells in the sandstone up Rocky Ridge, and look out for golden eagles on the wind.',
	},
	{
		id: 'mt-diablo', name: 'Mount Diablo State Park', lat: 37.8816, lon: -121.9142, agency: 'ca-state-parks', kind: 'state',
		amenities: ['visitor-center', 'summit-observation-deck', 'entrance-kiosk', 'campground', 'fire-ring', 'food-locker', 'picnic', 'bbq', 'restroom-vault', 'restroom-flush', 'trailhead', 'kiosk', 'trail-marker', 'cattle-gate', 'parking'],
		trailheads: [
			{ name: 'Summit Visitor Center (stone building, beacon)', lat: 37.8816, lon: -121.9142 },
			{ name: 'Rock City picnic area and Wind Caves', lat: 37.8456, lon: -121.9393 },
			{ name: 'Mitchell Canyon staging and visitor center', lat: 37.9190, lon: -121.9416 },
			{ name: 'Juniper Campground (approx)', lat: 37.8676, lon: -121.9290 },
			{ name: 'South Gate entrance kiosk (approx)', lat: 37.8380, lon: -121.9565 },
		],
		fishing: [],
		busy: { weekday: [16, 19], weekend: [9, 16] },
		note: 'Crawl through the Wind Caves at Rock City, then drive to the summit to spot the Sierra snow on a clear winter day.',
	},
	{
		id: 'mission-peak', name: 'Mission Peak Regional Preserve', lat: 37.5048, lon: -121.9085, agency: 'ebrpd', kind: 'regional',
		amenities: ['trailhead', 'kiosk', 'parking', 'restroom-vault', 'drinking-fountain', 'trail-marker', 'cattle-gate', 'summit-post'],
		trailheads: [{ name: 'Stanford Ave staging area (approx)', lat: 37.5048, lon: -121.9085 }, { name: 'Summit pole', lat: 37.5128, lon: -121.8804 }],
		fishing: [],
		busy: { weekday: [6, 9], weekend: [6, 11] },
		note: 'A tough but famous climb: bring lots of water and take the family photo with the summit pole.',
	},
	{
		id: 'sunol', name: 'Sunol Regional Wilderness', lat: 37.5160, lon: -121.8305, agency: 'ebrpd', kind: 'regional',
		amenities: ['visitor-center', 'entrance-kiosk', 'trailhead', 'kiosk', 'picnic', 'bbq', 'restroom-vault', 'campground', 'fire-ring', 'trail-marker', 'cattle-gate', 'creek'],
		trailheads: [{ name: 'Old Green Barn Visitor Center', lat: 37.5160, lon: -121.8305 }, { name: 'Little Yosemite (Camp Ohlone Rd)', lat: 37.5065, lon: -121.8255 }],
		fishing: [],
		busy: { weekday: [10, 14], weekend: [9, 15] },
		note: 'Walk the flat fire road to Little Yosemite and rock-hop beside Alameda Creek (no fishing: the creek is steelhead habitat).',
	},
	{
		id: 'del-valle', name: 'Del Valle Regional Park', lat: 37.5870, lon: -121.7000, agency: 'ebrpd', kind: 'regional',
		amenities: ['entrance-kiosk', 'lake', 'swim-beach', 'lifeguard', 'boat-launch', 'boat-rental', 'marina-store', 'fishing-dock', 'campground', 'fire-ring', 'food-locker', 'picnic', 'bbq', 'restroom-flush', 'shower', 'visitor-center', 'trailhead', 'parking'],
		trailheads: [{ name: 'East Beach (approx)', lat: 37.5850, lon: -121.6975 }, { name: 'West Shore Trail / Ohlone Wilderness Trail start (approx)', lat: 37.5760, lon: -121.7050 }],
		fishing: [{ species: 'rainbow trout (stocked)', months: [10, 11, 12, 1, 2, 3, 4, 5] }, { species: 'striped bass', months: [4, 5, 6, 7, 8, 9, 10] }, { species: 'largemouth bass', months: [3, 4, 5, 6, 9, 10] }, { species: 'smallmouth bass', months: [4, 5, 6, 7, 8, 9] }, { species: 'channel catfish', months: [6, 7, 8, 9] }, { species: 'bluegill', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [11, 17], weekend: [9, 18] },
		note: 'Rent a patio boat or fish the shore for planted trout in winter, then swim at the lifeguarded beach in summer.',
	},
	{
		id: 'shadow-cliffs', name: 'Shadow Cliffs Regional Recreation Area', lat: 37.6730, lon: -121.8425, agency: 'ebrpd', kind: 'regional',
		amenities: ['entrance-kiosk', 'lake', 'swim-beach', 'lifeguard', 'boat-rental', 'fishing-dock', 'picnic', 'bbq', 'restroom-flush', 'playground', 'dog-area', 'parking'],
		trailheads: [{ name: 'Swim beach and boat rental (approx)', lat: 37.6730, lon: -121.8425 }],
		fishing: [{ species: 'rainbow trout (stocked)', months: [10, 11, 12, 1, 2, 3, 4] }, { species: 'channel catfish', months: [5, 6, 7, 8, 9] }, { species: 'largemouth bass', months: [3, 4, 5, 6, 9, 10] }, { species: 'bluegill', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [12, 17], weekend: [10, 18] },
		note: 'An old gravel quarry turned lake: pedal-boat around the cliffs, then fish the docks for planted trout.',
	},
	{
		id: 'tilden', name: 'Tilden Regional Park', lat: 37.8985, lon: -122.2495, agency: 'ebrpd', kind: 'regional',
		amenities: ['lake', 'swim-beach', 'lifeguard', 'fishing-edge', 'petting-farm', 'nature-center', 'steam-train', 'carousel', 'botanic-garden', 'golf', 'picnic', 'bbq', 'restroom-flush', 'playground', 'trailhead', 'kiosk', 'parking'],
		trailheads: [
			{ name: 'Lake Anza beach and lot', lat: 37.8985, lon: -122.2495 },
			{ name: 'Little Farm and Environmental Education Center (Jewel Lake trail)', lat: 37.9094, lon: -122.2661 },
			{ name: 'Redwood Valley Railway steam trains (approx)', lat: 37.8900, lon: -122.2420 },
			{ name: 'Merry-go-round (approx)', lat: 37.8958, lon: -122.2445 },
			{ name: 'Inspiration Point (Nimitz Way)', lat: 37.9050, lon: -122.2445 },
		],
		fishing: [{ species: 'rainbow trout', months: [11, 12, 1, 2, 3, 4] }, { species: 'largemouth bass', months: [4, 5, 6, 9, 10] }, { species: 'bluegill', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [10, 15], weekend: [10, 16] },
		note: 'Feed the Little Farm cows celery you brought from home, ride the steam train, then look for newts on the Jewel Lake boardwalk.',
	},
	{
		id: 'lake-chabot', name: 'Lake Chabot Regional Park', lat: 37.7230, lon: -122.1110, agency: 'ebrpd', kind: 'regional',
		amenities: ['lake', 'marina-store', 'boat-rental', 'fishing-dock', 'fishing-edge', 'cafe', 'campground', 'fire-ring', 'picnic', 'bbq', 'restroom-flush', 'playground', 'bike-path', 'trailhead', 'kiosk', 'parking'],
		trailheads: [{ name: 'Marina and West Shore Trail (paved)', lat: 37.7230, lon: -122.1110 }],
		fishing: [{ species: 'rainbow trout (stocked)', months: [10, 11, 12, 1, 2, 3, 4, 5] }, { species: 'largemouth bass', months: [3, 4, 5, 6, 9, 10] }, { species: 'channel catfish', months: [6, 7, 8, 9] }, { species: 'black crappie', months: [3, 4, 5] }, { species: 'bluegill', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [7, 10], weekend: [7, 15] },
		note: 'Rent a rowboat at the marina and drift a worm for trout; no swimming, the lake is emergency drinking water.',
	},
	{
		id: 'lake-merritt', name: 'Lake Merritt and Children\'s Fairyland', lat: 37.8088, lon: -122.2600, agency: 'city-oakland', kind: 'city',
		amenities: ['boat-rental', 'boating-center', 'playground', 'fairyland', 'bird-refuge', 'bench', 'path-loop', 'restroom-flush', 'picnic', 'bbq', 'drinking-fountain'],
		trailheads: [{ name: 'Lakeside Park / Fairyland gate', lat: 37.8088, lon: -122.2600 }, { name: 'Lake Merritt Boating Center (approx)', lat: 37.8060, lon: -122.2575 }],
		fishing: [],
		busy: { weekday: [16, 19], weekend: [10, 18] },
		note: 'Visit the storybook sets at Fairyland, then walk the 5 km loop counting pelicans and cormorants at the bird islands.',
	},
	{
		id: 'golden-gate-park', name: 'Golden Gate Park', lat: 37.7713, lon: -122.4762, agency: 'sfrec', kind: 'city',
		amenities: ['lake', 'boat-rental', 'playground', 'carousel', 'bison-paddock', 'casting-pools', 'model-yacht-lake', 'soccer', 'tennis', 'pickleball', 'archery', 'golf', 'dog-park', 'picnic', 'bbq', 'restroom-flush', 'bike-path', 'bench', 'drinking-fountain', 'visitor-center'],
		trailheads: [
			{ name: 'Stow Lake Boathouse', lat: 37.7713, lon: -122.4762 },
			{ name: 'Koret Children\'s Quarter playground and carousel', lat: 37.7678, lon: -122.4577 },
			{ name: 'Bison Paddock', lat: 37.7695, lon: -122.4990 },
			{ name: 'Spreckels Lake (model yachts)', lat: 37.7703, lon: -122.4948 },
			{ name: 'Fly Casting Pools (approx)', lat: 37.7690, lon: -122.4965 },
			{ name: 'Beach Chalet / Dutch Windmill', lat: 37.7700, lon: -122.5095 },
		],
		fishing: [{ species: 'common carp', months: [4, 5, 6, 7, 8, 9, 10] }, { species: 'largemouth bass', months: [4, 5, 6, 9, 10] }, { species: 'bluegill', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [15, 18], weekend: [10, 17] },
		note: 'Pedal a boat round Strawberry Hill on Stow Lake, then say hello to the bison at the west end.',
	},
	{
		id: 'crissy-field', name: 'Crissy Field and Torpedo Wharf', lat: 37.8055, lon: -122.4555, agency: 'nps', kind: 'national',
		amenities: ['beach', 'marsh', 'fishing-pier', 'visitor-center', 'cafe', 'picnic', 'bbq', 'restroom-flush', 'bike-path', 'dog-area', 'drinking-fountain', 'bench', 'parking'],
		trailheads: [
			{ name: 'East Beach lot and picnic area', lat: 37.8055, lon: -122.4555 },
			{ name: 'Crissy Field Center / marsh boardwalk', lat: 37.8040, lon: -122.4600 },
			{ name: 'Warming Hut', lat: 37.8078, lon: -122.4697 },
			{ name: 'Torpedo Wharf fishing pier', lat: 37.8105, lon: -122.4715 },
		],
		fishing: [{ species: 'striped bass', months: [5, 6, 7, 8, 9, 10] }, { species: 'jacksmelt', months: [11, 12, 1, 2, 3, 4] }, { species: 'Dungeness crab (hoop net)', months: [11, 12, 1, 2, 3, 4, 5, 6] }, { species: 'leopard shark', months: [5, 6, 7, 8] }],
		busy: { weekday: [16, 19], weekend: [9, 17] },
		note: 'Drop a crab net off Torpedo Wharf under the Golden Gate Bridge; no license needed on a public pier.',
	},
	{
		id: 'fort-baker', name: 'Fort Baker and Horseshoe Bay', lat: 37.8350, lon: -122.4770, agency: 'nps', kind: 'national',
		amenities: ['fishing-pier', 'marina', 'museum', 'playground', 'lawn', 'picnic', 'restroom-flush', 'bench', 'parking', 'bike-path'],
		trailheads: [{ name: 'Bay Area Discovery Museum / Lookout Cove', lat: 37.8350, lon: -122.4770 }, { name: 'Fort Baker pier', lat: 37.8323, lon: -122.4754 }, { name: 'Bay Trail to Vista Point (approx)', lat: 37.8330, lon: -122.4795 }],
		fishing: [{ species: 'striped bass', months: [5, 6, 7, 8, 9, 10] }, { species: 'jacksmelt', months: [11, 12, 1, 2, 3] }, { species: 'rock crab', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }, { species: 'Dungeness crab (hoop net)', months: [11, 12, 1, 2, 3, 4, 5, 6] }],
		busy: { weekday: [10, 14], weekend: [10, 16] },
		note: 'Climb the kid-size Golden Gate at Lookout Cove, then fish the pier right under the real one.',
	},
	{
		id: 'marin-headlands', name: 'Marin Headlands (GGNRA)', lat: 37.8305, lon: -122.5245, agency: 'nps', kind: 'national',
		amenities: ['visitor-center', 'junior-ranger', 'beach', 'lagoon', 'campground', 'fire-ring', 'food-locker', 'picnic', 'restroom-vault', 'trailhead', 'kiosk', 'trail-marker', 'lighthouse', 'batteries', 'parking'],
		trailheads: [
			{ name: 'Marin Headlands Visitor Center (Fort Barry chapel)', lat: 37.8305, lon: -122.5245 },
			{ name: 'Rodeo Beach and Lagoon', lat: 37.8322, lon: -122.5378 },
			{ name: 'Hawk Hill', lat: 37.8255, lon: -122.4990 },
			{ name: 'Point Bonita Lighthouse trail', lat: 37.8157, lon: -122.5298 },
			{ name: 'Kirby Cove campground (approx)', lat: 37.8268, lon: -122.4915 },
			{ name: 'Tennessee Valley trailhead', lat: 37.8606, lon: -122.5363 },
		],
		fishing: [{ species: 'surfperch (Rodeo Beach)', months: [3, 4, 5, 6, 7] }],
		busy: { weekday: [11, 15], weekend: [9, 16] },
		note: 'Pick up the Junior Ranger booklet at the visitor center and walk through the lighthouse tunnel at Point Bonita (open limited days).',
	},
	{
		id: 'muir-woods', name: 'Muir Woods National Monument', lat: 37.8920, lon: -122.5718, agency: 'nps', kind: 'national',
		amenities: ['entrance-kiosk', 'visitor-center', 'junior-ranger', 'boardwalk', 'cafe', 'gift-shop', 'restroom-flush', 'bench', 'trailhead', 'parking-reservation', 'shuttle'],
		trailheads: [{ name: 'Main entrance and visitor center (approx)', lat: 37.8920, lon: -122.5718 }, { name: 'Cathedral Grove (field guide point)', lat: 37.8970, lon: -122.5811 }],
		fishing: [],
		busy: { weekday: [10, 15], weekend: [9, 16] },
		note: 'Earn a Junior Ranger badge, count banana slugs on the boardwalk, and whisper in Cathedral Grove (it is a quiet zone).',
	},
	{
		id: 'mt-tam', name: 'Mount Tamalpais State Park', lat: 37.9040, lon: -122.6040, agency: 'ca-state-parks', kind: 'state',
		amenities: ['ranger-station', 'visitor-center', 'campground', 'fire-ring', 'food-locker', 'picnic', 'restroom-vault', 'amphitheater', 'trailhead', 'kiosk', 'trail-marker', 'parking'],
		trailheads: [
			{ name: 'Pantoll Ranger Station and campground', lat: 37.9040, lon: -122.6040 },
			{ name: 'East Peak visitor center and Verna Dullea loop', lat: 37.9290, lon: -122.5775 },
			{ name: 'Mountain Theater (approx)', lat: 37.9068, lon: -122.6130 },
			{ name: 'Bootjack picnic area (approx)', lat: 37.9058, lon: -122.6020 },
		],
		fishing: [],
		busy: { weekday: [10, 16], weekend: [8, 16] },
		note: 'Walk the flat loop round East Peak and find the Farallon Islands on the horizon.',
	},
	{
		id: 'lake-lagunitas', name: 'Lake Lagunitas (Mt Tam Watershed)', lat: 37.9500, lon: -122.5960, agency: 'mmwd', kind: 'open-space',
		amenities: ['lake', 'fishing-edge', 'picnic', 'bbq', 'restroom-vault', 'trailhead', 'parking'],
		trailheads: [{ name: 'Lake Lagunitas lot (Sky Oaks, approx)', lat: 37.9490, lon: -122.5935 }],
		fishing: [{ species: 'rainbow trout (wild, catch-and-release, artificial lures)', months: [4, 5, 6, 7, 8, 9, 10, 11] }],
		busy: { weekday: [10, 15], weekend: [9, 15] },
		note: 'A 3 km loop round a quiet reservoir; look for newts on the trail after rain.',
	},
	{
		id: 'angel-island', name: 'Angel Island State Park', lat: 37.8688, lon: -122.4347, agency: 'ca-state-parks', kind: 'state',
		amenities: ['ferry-dock', 'visitor-center', 'cafe', 'bike-rental', 'campground', 'picnic', 'bbq', 'restroom-flush', 'beach', 'trailhead', 'museum'],
		trailheads: [{ name: 'Ayala Cove ferry landing', lat: 37.8688, lon: -122.4347 }, { name: 'Mt Livermore summit (approx)', lat: 37.8610, lon: -122.4325 }],
		fishing: [{ species: 'striped bass', months: [5, 6, 7, 8, 9] }, { species: 'jacksmelt', months: [11, 12, 1, 2, 3] }],
		busy: { weekday: [11, 15], weekend: [10, 16] },
		note: 'Take the ferry over and ride bikes round the 8 km Perimeter Road with the whole bay turning around you.',
	},
	{
		id: 'rancho-san-antonio', name: 'Rancho San Antonio County Park and Open Space Preserve', lat: 37.3325, lon: -122.0870, agency: 'midpen', kind: 'open-space',
		amenities: ['trailhead', 'kiosk', 'parking', 'restroom-flush', 'drinking-fountain', 'picnic', 'petting-farm', 'trail-marker', 'bench', 'bike-rack'],
		trailheads: [{ name: 'County park main lot (approx)', lat: 37.3325, lon: -122.0870 }, { name: 'Deer Hollow Farm', lat: 37.3264, lon: -122.1080 }],
		fishing: [],
		busy: { weekday: [7, 10], weekend: [7, 12] },
		note: 'An easy 2.5 km walk to Deer Hollow Farm to see goats, sheep and chickens, with deer and turkeys by the trail.',
	},
	{
		id: 'purisima', name: 'Purisima Creek Redwoods Open Space Preserve', lat: 37.4405, lon: -122.3740, agency: 'midpen', kind: 'open-space',
		amenities: ['trailhead', 'kiosk', 'parking', 'restroom-vault', 'trail-marker', 'bench', 'bridge'],
		trailheads: [{ name: 'Purisima Creek Rd lower lot', lat: 37.4405, lon: -122.3740 }, { name: 'Skyline Blvd North Ridge lot (approx)', lat: 37.4490, lon: -122.3390 }],
		fishing: [],
		busy: { weekday: [9, 13], weekend: [9, 14] },
		note: 'Follow the creek up under the redwoods and find a fairy ring of trees growing round an old logged stump.',
	},
	{
		id: 'half-moon-bay-sb', name: 'Half Moon Bay State Beach (Francis Beach campground)', lat: 37.4660, lon: -122.4452, agency: 'ca-state-parks', kind: 'beach',
		amenities: ['entrance-kiosk', 'campground', 'campsite-post', 'fire-ring', 'food-locker', 'picnic', 'bbq', 'restroom-flush', 'shower', 'beach', 'bike-path', 'visitor-center', 'parking'],
		trailheads: [{ name: 'Francis Beach campground entrance', lat: 37.4660, lon: -122.4452 }, { name: 'Coastside Trail (paved, bike)', lat: 37.4700, lon: -122.4460 }],
		fishing: [{ species: 'barred surfperch', months: [12, 1, 2, 3, 4, 5] }, { species: 'striped bass (surf)', months: [5, 6, 7, 8] }, { species: 'California halibut', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [12, 17], weekend: [10, 21] },
		note: 'Camp on the bluff, cook dinner at the fire ring, and fall asleep to the surf (quiet hours 10 pm to 6 am).',
	},
	{
		id: 'pacifica-pier', name: 'Pacifica Municipal Pier', lat: 37.6334, lon: -122.4946, agency: 'city-pacifica', kind: 'city',
		amenities: ['fishing-pier', 'bait-shop', 'fish-cleaning', 'bench', 'restroom-flush', 'parking', 'beach'],
		trailheads: [{ name: 'Pier foot, Beach Blvd', lat: 37.6334, lon: -122.4946 }],
		fishing: [{ species: 'Dungeness crab (hoop net / snare)', months: [11, 12, 1, 2, 3, 4, 5, 6] }, { species: 'striped bass', months: [6, 7, 8, 9] }, { species: 'king salmon (season set yearly)', months: [6, 7, 8] }, { species: 'surfperch', months: [2, 3, 4, 5] }, { species: 'jacksmelt', months: [11, 12, 1, 2, 3] }, { species: 'kingfish (white croaker)', months: [5, 6, 7, 8, 9] }],
		busy: { weekday: [6, 9], weekend: [6, 13] },
		note: 'No license needed on the pier: drop a crab snare in winter and watch the gray whales go by in spring.',
	},
	{
		id: 'fitzgerald', name: 'Fitzgerald Marine Reserve', lat: 37.5230, lon: -122.5155, agency: 'smcparks', kind: 'beach',
		amenities: ['tidepools', 'visitor-center', 'naturalist', 'picnic', 'restroom-flush', 'trailhead', 'parking', 'boardwalk'],
		trailheads: [{ name: 'California Ave lot', lat: 37.5230, lon: -122.5155 }, { name: 'Seal Cove cypress trail (approx)', lat: 37.5175, lon: -122.5140 }],
		fishing: [],
		busy: { weekday: [10, 14], weekend: [9, 15] },
		note: 'Come at a minus tide and look for sea stars and anemones, touching nothing but bare rock (no collecting: marine protected area).',
	},
	{
		id: 'coyote-point', name: 'Coyote Point Recreation Area', lat: 37.5880, lon: -122.3245, agency: 'smcparks', kind: 'regional',
		amenities: ['playground', 'museum', 'beach', 'marina', 'boat-launch', 'fishing-edge', 'picnic', 'bbq', 'restroom-flush', 'bike-path', 'entrance-kiosk', 'parking'],
		trailheads: [{ name: 'Magic Mountain playground (approx)', lat: 37.5895, lon: -122.3270 }, { name: 'CuriOdyssey science museum and zoo', lat: 37.5880, lon: -122.3260 }],
		fishing: [{ species: 'jacksmelt', months: [11, 12, 1, 2, 3] }, { species: 'leopard shark', months: [5, 6, 7, 8] }, { species: 'striped bass', months: [5, 6, 9, 10] }],
		busy: { weekday: [10, 15], weekend: [10, 17] },
		note: 'Climb the castle-and-dragon playground, then watch the planes and windsurfers from the beach.',
	},
	{
		id: 'coyote-hills', name: 'Coyote Hills Regional Park', lat: 37.5540, lon: -122.0880, agency: 'ebrpd', kind: 'regional',
		amenities: ['visitor-center', 'boardwalk', 'marsh', 'bike-path', 'picnic', 'restroom-flush', 'trailhead', 'kiosk', 'parking'],
		trailheads: [{ name: 'Visitor center and marsh boardwalk', lat: 37.5540, lon: -122.0880 }],
		fishing: [],
		busy: { weekday: [10, 14], weekend: [9, 15] },
		note: 'Walk the marsh boardwalk looking for avocets and stilts, then climb the little hills for the whole South Bay.',
	},
	{
		id: 'alum-rock', name: 'Alum Rock Park', lat: 37.3972, lon: -121.8002, agency: 'city-sanjose', kind: 'city',
		amenities: ['nature-center', 'mineral-springs', 'creek', 'picnic', 'bbq', 'restroom-flush', 'playground', 'trailhead', 'kiosk', 'bike-path', 'parking', 'entrance-kiosk'],
		trailheads: [{ name: 'Youth Science Institute and main picnic area (approx)', lat: 37.3985, lon: -121.7990 }, { name: 'Penitencia Creek trail / mineral springs grottos (approx)', lat: 37.3968, lon: -121.8030 }],
		fishing: [],
		busy: { weekday: [11, 15], weekend: [10, 16] },
		note: 'Sniff the sulphur springs in the old stone grottos and check the live hawks and snakes at the Youth Science Institute.',
	},
	{
		id: 'santana-row-parks', name: 'Santana Row area: Santana Park (approx)', lat: 37.3195, lon: -121.9510, agency: 'city-sanjose', kind: 'city',
		amenities: ['playground', 'lawn', 'bench', 'picnic', 'drinking-fountain', 'path-loop'],
		trailheads: [{ name: 'Santana Park (approx, verify in OSM)', lat: 37.3195, lon: -121.9510 }],
		fishing: [],
		busy: { weekday: [15, 19], weekend: [10, 18] },
		note: 'A small neighbourhood park a few minutes from Santana Row: swings and a lawn for a break between shops (location approximate).',
	},
	{
		id: 'cupertino-memorial', name: 'Cupertino Memorial Park', lat: 37.3232, lon: -122.0445, agency: 'city-cupertino', kind: 'city',
		amenities: ['pond', 'playground', 'amphitheater', 'softball', 'tennis', 'community-center', 'veterans-memorial', 'picnic', 'bbq', 'restroom-flush', 'bench', 'drinking-fountain', 'parking'],
		trailheads: [{ name: 'Quinlan Community Center lot (approx)', lat: 37.3240, lon: -122.0430 }],
		fishing: [],
		busy: { weekday: [15, 19], weekend: [10, 17] },
		note: 'Watch the ducks and geese on the ponds, then find the playground behind the amphitheater.',
	},
	{
		id: 'apple-park-vc', name: 'Apple Park Visitor Center', lat: 37.3325, lon: -122.0053, agency: 'private', kind: 'city',
		amenities: ['visitor-center', 'cafe', 'store', 'roof-terrace', 'olive-grove', 'restroom-flush', 'parking-garage', 'bench'],
		trailheads: [{ name: 'Visitor Center, N Tantau Ave', lat: 37.3325, lon: -122.0053 }],
		fishing: [],
		busy: { weekday: [11, 16], weekend: [11, 17] },
		note: 'Look at the AR model of the Ring, then climb to the roof terrace to see the real one over the trees.',
	},
	{
		id: 'ano-nuevo', name: 'Año Nuevo State Park', lat: 37.1105, lon: -122.3300, agency: 'ca-state-parks', kind: 'state',
		amenities: ['entrance-kiosk', 'visitor-center', 'marine-education-center', 'guided-walks', 'restroom-flush', 'picnic', 'trailhead', 'kiosk', 'trail-marker', 'parking'],
		trailheads: [{ name: 'Marine Education Center and staging area', lat: 37.1105, lon: -122.3300 }, { name: 'Wildlife Protection Area gate (approx)', lat: 37.1050, lon: -122.3290 }],
		fishing: [],
		busy: { weekday: [10, 14], weekend: [9, 15] },
		note: 'On a winter guided walk, watch two-tonne elephant seal bulls roar at each other from 8 m away.',
	},
	{
		id: 'linda-mar', name: 'Pacifica State Beach (Linda Mar)', lat: 37.5945, lon: -122.5028, agency: 'city-pacifica', kind: 'beach',
		amenities: ['beach', 'surf', 'restroom-flush', 'shower', 'parking', 'bike-path', 'bench', 'trash'],
		trailheads: [{ name: 'Linda Mar lot', lat: 37.5945, lon: -122.5028 }],
		fishing: [{ species: 'barred surfperch', months: [12, 1, 2, 3, 4, 5] }, { species: 'striped bass (surf)', months: [5, 6, 7, 8] }],
		busy: { weekday: [7, 10], weekend: [7, 16] },
		note: 'The gentlest waves on the San Mateo coast: a good place for a first foam-board lesson.',
	},
];

// Sign and building palettes per agency. font: what to set the canvas with (the real
// faces in brackets). text: what the entrance sign says.
export const AGENCY_STYLE = {
	'ca-state-parks': {
		sign: { bg: '#4a3222', fg: '#efe3c2', border: '#e9dcb8', font: 'bold Georgia, serif', real: 'routed redwood, cream-filled serif caps (Clarendon-like)', text: ['MOUNT DIABLO', 'STATE PARK'], emblem: 'bear-and-poppy oval, gold #c9a14a on brown', post: '#3a2a1c' },
		building: { wall: '#8a6a4a', roof: '#4e3b2c', trim: '#2f2418', style: 'board-and-batten or rubble stone (CCC-era) with shake roof; campground restrooms tan split-face block, brown metal roof' },
	},
	'ebrpd': {
		sign: { bg: '#5a3d26', fg: '#f4efe0', border: '#3b2a1c', font: 'bold "Trebuchet MS", sans-serif', real: 'routed wood, white/cream sans (Helvetica-like), district logo (green oak on blue-green disc)', text: ['LAS TRAMPAS', 'REGIONAL WILDERNESS', 'East Bay Regional Park District'], emblem: 'EBRPD roundel green #3f7a3a / blue #2f6b8a', post: '#4a3322' },
		building: { wall: '#9c8566', roof: '#5a4a3a', trim: '#3b2f22', style: 'tan split-face or board-and-batten, brown standing-seam roof; staging-area kiosk with shingled gable roof' },
	},
	'midpen': {
		sign: { bg: '#5b4633', fg: '#f2ead6', border: '#3a2c20', font: '"Trebuchet MS", sans-serif', real: 'brown-stained redwood, cream sans caps, green leaf logo', text: ['RANCHO SAN ANTONIO', 'OPEN SPACE PRESERVE', 'Midpeninsula Regional Open Space District'], emblem: 'Midpen hills-and-sky mark green #4b7a3a', post: '#4a3828' },
		building: { wall: '#7a6450', roof: '#4a3c30', trim: '#2e261e', style: 'almost no buildings: vault toilet, kiosk with brown metal roof, split-rail at lots' },
	},
	'nps': {
		sign: { bg: '#5e3f2a', fg: '#ffffff', border: '#ffffff', font: 'bold "Arial Narrow", sans-serif', real: 'NPS brown (Pantone 4625-ish), white NPS Rawlinson / Frutiger, arrowhead emblem left', text: ['Muir Woods', 'National Monument', 'National Park Service'], emblem: 'arrowhead: brown #6b3f1f field, white sequoia/bison/mountain, green #3a5a2a', post: '#4a3222' },
		building: { wall: '#f2eee4', roof: '#8a3b2a', trim: '#2f4a3a', style: 'Fort Baker/Fort Barry: white clapboard army buildings, red-brown roofs, dark green trim; Muir Woods: rustic redwood log and board visitor buildings with shake roofs' },
	},
	'smcparks': {
		sign: { bg: '#4b3a28', fg: '#f0e6c8', border: '#e0d2a8', font: 'bold Georgia, serif', real: 'routed wood, cream caps, San Mateo County Parks green logo', text: ['COYOTE POINT', 'RECREATION AREA', 'San Mateo County Parks'], emblem: 'green #3d6b3a oak/leaf', post: '#3a2a1c' },
		building: { wall: '#a08a6a', roof: '#4e4034', trim: '#2f2a22', style: 'rustic wood and tan block; entrance kiosk booth' },
	},
	'mmwd': {
		sign: { bg: '#3e4f3a', fg: '#f2efe2', border: '#f2efe2', font: '"Trebuchet MS", sans-serif', real: 'dark green panel, white sans, Marin Water logo', text: ['LAKE LAGUNITAS', 'Marin Water'], emblem: 'blue drop #2f6b9a', post: '#3a2a1c' },
		building: { wall: '#8a7a62', roof: '#4a4a44', trim: '#2a2a26', style: 'vault toilets, old stone dam houses' },
	},
	'sfrec': {
		sign: { bg: '#2e5e3a', fg: '#ffffff', border: '#ffffff', font: 'bold Helvetica, Arial, sans-serif', real: 'dark green painted panel/metal, white sans, SF Rec & Park cypress logo', text: ['GOLDEN GATE PARK', 'Stow Lake', 'San Francisco Recreation and Parks'], emblem: 'Rec & Park tree mark green/white', post: '#23402b' },
		building: { wall: '#e8e0cc', roof: '#b0492e', trim: '#2e5e3a', style: 'GGP: Spanish-Mission stucco (cream walls, red clay tile roofs) and rustic stone; playground restrooms green-painted' },
	},
	'city-sanramon': {
		sign: { bg: '#23466a', fg: '#ffffff', border: '#c9b58a', font: 'bold Helvetica, Arial, sans-serif', real: 'monument sign: tan stacked-stone base, blue metal panel with white letters and San Ramon logo', text: ['CENTRAL PARK', 'City of San Ramon'], emblem: 'San Ramon hills logo', post: '#b8a47e' },
		building: { wall: '#d2c3a2', roof: '#6a5a48', trim: '#3a4a3a', style: 'Tri-Valley civic: tan stucco and stone veneer, brown standing-seam or tile roof' },
	},
	'city-oakland': {
		sign: { bg: '#1f5a3a', fg: '#ffffff', border: '#ffffff', font: 'bold Helvetica, Arial, sans-serif', real: 'green metal panel, white letters, Oakland oak logo', text: ['LAKESIDE PARK'], emblem: 'oak tree', post: '#1f3a2a' },
		building: { wall: '#e4dccb', roof: '#9a4a32', trim: '#1f5a3a', style: 'Mission-revival stucco boathouse, tile roofs' },
	},
	'city-sanjose': {
		sign: { bg: '#1d4f73', fg: '#ffffff', border: '#e8b04a', font: 'bold Helvetica, Arial, sans-serif', real: 'blue metal panel with white letters and gold accent, "City of San José Parks"', text: ['ALUM ROCK PARK', 'City of San José'], emblem: 'San José Parks sun mark', post: '#223040' },
		building: { wall: '#c9b89a', roof: '#6a4e3a', trim: '#2f3a44', style: 'WPA stone (Alum Rock) and tan block restrooms' },
	},
	'city-cupertino': {
		sign: { bg: '#2f5a3e', fg: '#ffffff', border: '#d8c8a0', font: 'bold Helvetica, Arial, sans-serif', real: 'green panel on stone base, white letters, Cupertino logo', text: ['MEMORIAL PARK', 'City of Cupertino'], emblem: 'Cupertino tree', post: '#a89a80' },
		building: { wall: '#d6ccb4', roof: '#5a4e42', trim: '#2f5a3e', style: 'low stucco, brown roofs' },
	},
	'city-pacifica': {
		sign: { bg: '#1e4a6a', fg: '#ffffff', border: '#ffffff', font: 'bold Helvetica, Arial, sans-serif', real: 'blue panel, white letters; pier has painted arch sign', text: ['PACIFICA MUNICIPAL PIER'], emblem: 'wave', post: '#9a9a96' },
		building: { wall: '#c8c2b4', roof: '#4a4a48', trim: '#1e4a6a', style: 'concrete block, weathered' },
	},
	'private': {
		sign: { bg: '#f2f2ee', fg: '#333333', border: '#cfcfca', font: 'Helvetica, Arial, sans-serif', real: 'low corporate monument signs', text: [], emblem: '', post: '#9a9a96' },
		building: { wall: '#f4f4f0', roof: '#2a2826', trim: '#9a9a96', style: 'modern glass and white' },
	},
	// the MUTCD brown "recreational and cultural interest" guide signs on the roads to parks
	'road-guide': {
		sign: { bg: '#6a4a2e', fg: '#ffffff', border: '#ffffff', font: 'bold "Highway Gothic", "Arial Narrow", sans-serif', real: 'MUTCD D-series brown, white Highway Gothic, white border', text: ['Mt Diablo State Park', '5 mi'], emblem: '', post: '#9a9d9a' },
		building: { wall: '#000000', roof: '#000000', trim: '#000000', style: 'n/a' },
	},
};

// Amenity kit: size [w, h, d] in metres (w along the long axis, h up, d across), colour
// (main hex), material, placement rule; parts lists the primitives with their own sizes.
export const KIT = {
	trailheadKiosk: {
		size: [2.6, 2.9, 1.3], colour: '#5a3d26', material: 'timber posts 0.15 sq, shingle or brown metal gable roof, 3 panels',
		parts: { posts: [0.15, 2.5, 0.15], panel: [1.2, 0.9, 0.05], panelBottom: 1.0, roof: '#4e3b2c', map: '#e8e2cc', rules: '#f7f4ea' },
		placement: 'at the lot edge where the trail leaves, 5-15 m from the nearest stall, facing the lot; with a trash can, a dog-bag dispenser and a bench within 6 m',
	},
	picnicTable: {
		size: [1.83, 0.76, 1.5], colour: '#8a5a3c', material: 'redwood slats on steel frame (parks), thermoplastic-coated expanded metal #2f5d3a (city), cast concrete #b8b2a6 (beaches)',
		parts: { top: [1.83, 0.05, 0.76], seat: [1.83, 0.05, 0.25], seatH: 0.46, seatOut: 0.55, adaOverhang: 0.5 },
		placement: 'in clusters of 2-6 under tree shade, 20-80 m from parking, on level ground (slope < 5%), 6 m apart, each with a grill 2 m downwind; one ADA table per cluster on a concrete pad',
	},
	bbqGrill: {
		size: [0.6, 0.95, 0.45], colour: '#1d1d1d', material: 'black steel firebox on 0.1 m pipe post set in concrete; group grills 1.2 x 0.6 on two posts',
		parts: { post: [0.1, 0.7, 0.1], box: [0.6, 0.25, 0.45], grate: '#3a3a3a', coalBin: { size: [0.55, 0.9, 0.55], colour: '#9a9d9a', lid: '#b8342a', label: 'HOT COALS ONLY' } },
		placement: 'one per picnic table, 2-3 m from it, downwind; a hot-coal bin per 4 grills',
	},
	fireRing: {
		size: [0.95, 0.3, 0.95], colour: '#5a3a2a', material: 'rusted steel ring with hinged cooking grate; beach rings concrete #b8b2a6',
		placement: 'one per campsite, 4-5 m from the table and tent pad, 3 m clear of shrubs; beach rings above the high-tide line',
	},
	parkBench: {
		size: [1.8, 0.85, 0.6], colour: '#6a4a30', material: 'wood slats on black cast/steel ends; memorial plaque 0.2 x 0.1 brass #b08a3a on the top rail',
		parts: { seatH: 0.45, seatD: 0.45, back: [1.8, 0.4, 0.05] },
		placement: 'facing the view (water, playground, summit panorama), backs to paths; every 150-300 m on loop paths, 2-3 around a playground facing in, at summits and lake edges',
	},
	drinkingFountain: {
		size: [0.4, 0.97, 0.4], colour: '#2f5d3a', material: 'powder-coated steel pedestal (city green / park brown #5a3d26) or exposed-aggregate concrete; hi-lo ADA pair 0.97/0.76; dog bowl at 0.15; bottle filler',
		placement: 'at the trailhead, playground edge and sports-field entry, on a 1.5 x 1.5 m concrete pad with a drain',
	},
	restroomVault: {
		size: [2.4, 3.2, 2.7], colour: '#c8b89a', material: 'precast concrete (CXT/Romtec), split-face or wood-grain texture, brown metal hip/gable roof #5b4a3c, vent stack 0.25 dia to 4.5 m',
		placement: 'trailheads and campgrounds: 30-80 m from the lot, downwind of picnic areas, 30 m+ from water; single or double (4.3 wide)',
	},
	restroomFlush: {
		size: [8, 3.4, 6], colour: '#d2c3a2', material: 'split-face block by agency palette, standing-seam roof, stainless fixtures, outdoor rinse shower at beaches',
		placement: 'city parks and day-use hubs: between the lot and the playground, 30-60 m from each, visible from both; doors facing the path, not the lot',
	},
	playground: {
		size: [18, 4.5, 14], colour: '#2f6f9a', material: 'galvanized 0.114 dia posts painted (green #3f7a3a, blue #2f6f9a, tan #c9b08a), HDPE panels and slides (yellow #e8c23a, red #c23a2a, green)',
		parts: { deck: [1.2, 0.05, 1.2], deckHeights: [0.9, 1.2, 1.5, 1.8], roof: [1.4, 0.6, 1.4], slideStraight: [0.6, null, 3.2], tubeSlide: 0.8, climber: 'arch ladder / rock wall 1.2 w', surface: { pourInPlace: ['#a8543a', '#3a6ea8', '#4a7a3a'], woodFibre: '#9a7a52', depth: 0.3 }, useZone: 1.8, curb: [null, 0.15, 0.15] },
		placement: 'separate 2-5 (tot, low decks) and 5-12 areas, 20-50 m from the lot and the restroom, ringed by benches facing in; shade tree or sail on the south-west; fence it if within 15 m of a street or water',
	},
	swings: {
		size: [5.0, 2.4, 1.8], colour: '#2f6f9a', material: 'A-frame of 0.114 dia pipe, top beam 2.4 (tot) or 3.0-3.7 (5-12), galvanized chains, black belt seats; tot bucket seats; one saucer/net swing 1.0 dia',
		parts: { bayWidth: 2.4, seatsPerBay: 2, seatH: 0.6, useZoneFrontBack: '2 x beam height' },
		placement: 'at the edge of the play area (not across a path), swing arc parallel to the edge',
	},
	tennisCourt: {
		size: [36.6, 3.6, 18.3], colour: '#3d7a4a', material: 'acrylic on asphalt, green inside #3d7a4a with #5e8f5f surround (or blue #2f5d8c inside), white lines 0.05, 3.0-3.6 chain-link fence #1d1d1d vinyl or galvanized, windscreen #1f4a2e',
		parts: { playing: [23.77, 0, 10.97], singles: 8.23, service: 6.40, netCentre: 0.914, netPost: 1.07 },
		placement: 'in banks of 2-4 side by side, long axis north-south, near the lot, with a bench and fountain at the gate',
	},
	pickleballCourt: {
		size: [18.3, 1.2, 9.1], colour: '#2f5d8c', material: 'acrylic, blue court #2f5d8c / green surround, white lines 0.05; often 4 overlaid on a tennis court in yellow #e8c23a',
		parts: { playing: [13.41, 0, 6.10], kitchen: 2.13, netCentre: 0.86, netPost: 0.91 },
		placement: 'banks of 4-8, near restrooms; the busiest courts at 8-11 am',
	},
	basketballCourt: {
		size: [28.7, 3.95, 15.2], colour: '#7a7a78', material: 'grey asphalt or colour acrylic (#b0492e key), white lines, galvanized pole with 1.2 offset, steel or acrylic backboard 1.83 x 1.07',
		parts: { rim: 3.05, key: [5.8, 0, 4.9], threePoint: 6.75, halfCourt: [15, 0, 15] },
		placement: 'half courts in neighbourhood parks, full courts in big parks, away from tot lots, lit for evenings',
	},
	baseballField: {
		size: [70, 6, 70], colour: '#b3714a', material: 'skinned infield clay #b3714a, grass #3f7a3a, white chalk lines; backstop chain-link 6 high x 12-18 wide with 2 m hood; outfield fence 1.2 high green with yellow cap #e8c23a; yellow foul poles',
		parts: { basesLittleLeague: 18.29, moundLL: 14.02, basesAdult: 27.43, moundAdult: 18.44, basesSoftball: 18.29, fenceLL: 61, dugout: [10, 2.2, 2.5], bleachers: [4.5, 1.2, 2.6] },
		placement: 'home plate to the south-west or south-east (batter faces east-north-east), backstop near the lot; dugouts along first and third base lines, 8-10 m off',
	},
	soccerField: {
		size: [100, 2.44, 64], colour: '#3f7a3a', material: 'grass mown in 5 m stripes, white lines 0.12; goals white aluminium with net, wheeled and weighted',
		parts: { goalAdult: [7.32, 2.44, 2.0], goalYouth: [5.5, 1.8, 1.5], goalTiny: [3.7, 1.8, 1.2], centreCircle: 9.15, penaltyArea: [40.3, 0, 16.5], youthU10: [55, 0, 36] },
		placement: 'long axis north-south; big parks lay 2-4 youth fields crossways on one adult pitch on Saturdays; team canopies and folding chairs along one touchline',
	},
	dogPark: {
		size: [60, 1.5, 40], colour: '#1d1d1d', material: 'black vinyl chain-link 1.5 high, double-gate entry vestibule 3 x 3, decomposed granite #b89c74 or wood chips, separate small-dog area',
		parts: { bagDispenser: { size: [0.3, 1.4, 0.2], colour: '#3f7a3a' }, dogFountain: 'fountain with 0.15 high bowl', shade: 'sail 5 x 5' },
		placement: 'at the park edge away from playgrounds (40 m+) and picnic areas, near the lot; benches inside along the fence',
	},
	trailMarker: {
		size: [0.14, 1.3, 0.14], colour: '#5a3d26', material: 'EBRPD/Midpen: 6x6 redwood post with routed white trail names and arrows; State Parks: 4x4 with routed mileage; NPS: brown Carsonite 0.08 wide fibreglass with decals',
		parts: { top: 'chamfered', symbols: ['hiker', 'horse', 'bike', 'no-bike'], mileage: '0.5 mi steps' },
		placement: 'at every junction (one post per junction, arrows to each branch) and every 0.5 mi on long trails; 1 m off the tread on the uphill side',
	},
	cattleGate: {
		size: [4.9, 1.3, 0.1], colour: '#9a9d9a', material: '5-bar galvanized 0.05 pipe gate on 0.2 dia wood or steel posts, chain latch; walk-through hiker gate 1.2 wide self-closing beside it; "PLEASE CLOSE GATE / cattle grazing" sign',
		parts: { cattleGuard: { size: [4.3, 0.1, 2.4], rails: 0.1, gap: 0.15, pit: 0.5 } },
		placement: 'where a fire road crosses a fence line (EBRPD and Midpen grazing units); barbed-wire fence 4 strands on steel T-posts 3 m apart, wood corner braces',
	},
	bikeRack: {
		size: [0.6, 0.9, 0.05], colour: '#1d1d1d', material: 'inverted-U 0.05 pipe, galvanized or black; set 0.9 apart in a row',
		placement: 'within 15 m of the restroom/visitor center door and at trailheads that allow bikes; racks of 3-6',
	},
	trashCans: {
		size: [0.6, 1.0, 0.6], colour: '#5a3d26', material: 'State/EBRPD/Midpen: brown steel with wildlife-proof lid; city: black landfill #1d1d1d, blue recycle #2f5d8c, SF three-bin with green compost #3f7a3a',
		placement: 'pairs (trash + recycle) at trailheads, each picnic cluster, playground edges and pier foot; 1 per 4 tables',
	},
	fishingPier: {
		size: [4.5, 1.07, 300], colour: '#b8b2a6', material: 'concrete deck on concrete piles (Pacifica 347 m long); rail 1.07 high galvanized or wood cap #6a4a30',
		parts: { lampPost: { h: 4.5, every: 20 }, cleaningStation: [1.2, 0.9, 0.6], rodHolders: 'every 3 m on the cap', bench: 'every 30 m', crabNets: 'hoop nets and snares by the rail in winter', signs: ['NO FISHING LICENSE REQUIRED ON THIS PIER', 'Size and bag limits apply'] },
		placement: 'from a beach lot or seawall; bait shop/café and restroom at the landward end; anglers every 3-6 m along both rails at dawn',
	},
	boatLaunch: {
		size: [9, 0.3, 40], colour: '#9a968c', material: 'grooved concrete ramp at 12-15 %, 4.5 per lane, boarding float 1.8 x 18 beside it, courtesy dock; trailer lot stalls 3 x 12',
		placement: 'sheltered shore by the marina, ramp toe 1.5 m below low water; kayak/paddleboat rentals on a floating dock next to it',
	},
	foodLocker: {
		size: [1.2, 0.9, 0.8], colour: '#5a4a3a', material: 'steel box with two latching doors (raccoon/raven-proof; no bears in the Bay Area, so not "bear boxes" here), painted brown',
		placement: 'one per campsite, beside the table, 2-3 m from the fire ring',
	},
	campsitePost: {
		size: [0.14, 1.0, 0.14], colour: '#5a3d26', material: '6x6 post, routed white number 0.12 tall on both faces, reservation clip below',
		parts: { pad: [6, 0, 10], tentPad: [4, 0.15, 4], spur: [3, 0, 9] },
		placement: 'at the spur entrance on the loop road, sites 25-40 m apart, numbered clockwise; host site by the entrance with a sign',
	},
	entranceKiosk: {
		size: [2.4, 3.0, 3.0], colour: '#8a6a4a', material: 'staffed booth with sliding window, agency palette, flat or shed roof; iron ranger (steel fee post) and envelope box beside it when unstaffed',
		placement: 'on the park road 50-150 m inside the gate, with a STOP line and a turnaround; day-use fee board',
	},
	visitorCenter: {
		size: [20, 5, 12], colour: '#8a6a4a', material: 'agency building style; porch, flagpole 9 m, bike rack, exhibit windows',
		placement: 'at the main lot, the first thing you reach from it, restroom beside it, trailhead kiosk 20-40 m away',
	},
	splitRailFence: {
		size: [3.0, 1.1, 0.12], colour: '#6a5040', material: 'two rails between round posts; lot perimeters and trail edges',
		placement: 'round lots and to keep people off restored dunes and marsh',
	},
};
