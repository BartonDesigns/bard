// The mapped regions (written by tools/bake-realcity.py; see realcity.js): each one's file
// under assets/bayarea/real/, its extent [west, south, east, north] and the area it was baked
// with. Those named t/<i>_<j> are cells of the shared tile grid, fetched as you come near.
export const REAL_REGIONS = [
	['eastbay', -122.02, 37.715, -121.84, 37.95, 'eastbay'],
	['tam', -122.66, 37.87, -122.53, 37.96, 'tam'],
	['missionpeak', -121.95, 37.48, -121.84, 37.55, 'missionpeak'],
	['coast', -122.53, 37.455, -122.425, 37.665, 'coast'],
	['bolinas', -122.735, 37.875, -122.66, 37.93, 'bolinas'],
	['sausalito', -122.505, 37.825, -122.47, 37.872, 'sausalito'],
	['cupertino', -122.035, 37.315, -121.995, 37.345, 'cupertino'],
	['sanjose', -121.91, 37.318, -121.87, 37.345, 'sanjose'],
	['southcoast', -122.43, 37.10, -122.29, 37.455, 'southcoast'],
];
// the tall buildings among them, for the far skylines: x, z, width, depth, angle, height
export const REAL_TALL = [
];
