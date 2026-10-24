// Deterministic building programmes. Height controls capacity, never occupancy type.
export const STOREY = 3.9;
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
export const OFFICE_PROGRAMS = ['Product studio', 'Client services', 'Engineering', 'Finance', 'Coworking', 'Conference centre', 'Executive offices'];
export const SHOP_PROGRAMS = ['Design & home', 'Books & stationery', 'Technology', 'Fashion', 'Market hall', 'Food court'];
export const WORKPLACE_PROFILES = {
 'Pacific coast': {deskPitch:2.3,commons:12,baffles:true,privacy:false},
 'Japan': {deskPitch:1.9,commons:10,baffles:true,privacy:true},
 'East Asia': {deskPitch:2.05,commons:12,baffles:false,privacy:true},
 'Southeast Asia': {deskPitch:2.2,commons:10,baffles:true,privacy:false},
 'Gulf': {deskPitch:2.4,commons:12,baffles:false,privacy:true},
 'Europe': {deskPitch:2.3,commons:10,baffles:true,privacy:true},
 'International': {deskPitch:2.2,commons:12,baffles:false,privacy:false},
};

export function regionAt({ lat = 37.77, lon = -122.42 } = {}) {
 if (lon >= 129 && lon <= 146 && lat >= 29 && lat <= 46) return 'Japan';
 if (lon >= 100 && lon <= 145 && lat >= 20) return 'East Asia';
 if (lon >= 95 && lon <= 145 && lat < 20 && lat > -12) return 'Southeast Asia';
 if (lon > 32 && lon < 61 && lat > 14 && lat < 34) return 'Gulf';
 if (lon > -15 && lon < 40 && lat > 34) return 'Europe';
 return lon < -110 && lon > -135 ? 'Pacific coast' : 'International';
}

// The source and renderer use different kind enumerations; callers pass source kind.
// (resort: a Strip resort's casino or tower, crysis/civgen.js: its casino may be bigger yet)
export function commercialStack(kind, w, d, height, resort = false) {
 if (Math.min(w, d) <= 12 || w * d > (resort ? 40000 : 26000)) return false;
 return kind === 11 || (kind === 5 && height >= 7.5) || (kind === 6 && w * d >= 1600 && Math.min(w, d) >= 28 && height >= 7);
}

export function planWorkplace(o, floor0, location) {
 const top = o.y + o.h, height = top - floor0, seed = hash(Math.round(o.x * .37), Math.round(o.z * .29));
 const region = regionAt(location), W = o.w, D = o.d, hw = W / 2 - .3, hd = D / 2 - .3;
 const sourceKind = o.src?.kind ?? (o.kind === 2 ? 11 : o.kind === 3 ? 5 : o.kind === 6 ? 6 : 8);
 // a Strip resort's (crysis/civgen.js strip): its casino a casino, its tower a hotel
 if (o.src?.resort && (sourceKind === 6 || sourceKind === 11)) return planResort(o, floor0, sourceKind === 6, { top, height, seed, region, W, D, hw, hd });
 const mall = sourceKind === 6, residential = sourceKind === 8 || o.src?.use === 'residential';
 const type = mall ? 'mall' : residential ? 'home' : 'office';
 const lobbyH = Math.min(mall ? 4.8 : 5.2, Math.max(3.2, height / 2));
 const storey = mall ? 4.8 : STOREY;
 const count = Math.max(1, 1 + Math.floor((height - lobbyH + 1e-6) / storey));
 const coreW = Math.min(10, W * .32), coreD = Math.min(4.5, D * .2), coreZ = -hd + coreD;
 // A small, explicit mixed-use allocation; an office is never randomly all bedrooms.
 const suites = !mall && !residential && count > 24 && seed < .12 ? 2 : 0;
 const atrium = mall ? { x0: -Math.min(8, W * .14), x1: Math.min(8, W * .14), z0: -Math.min(11, D * .2), z1: Math.min(11, D * .2) } : null;
 const levels = [];
 for (let i = 0; i < count; i++) {
  const y = i ? floor0 + lobbyH + (i - 1) * storey : floor0;
  const h = i === count - 1 ? top - y : i ? storey : lobbyH;
  const home = residential || (suites && i >= count - suites);
  const kind = mall ? 'mall' : i === 0 ? 'lobby' : home ? 'home' : 'office';
  let program = i === 0 ? 'Reception & directory' : home ? 'Guest apartments' : OFFICE_PROGRAMS[(i + Math.floor(seed * 31)) % OFFICE_PROGRAMS.length];
  if (kind === 'office' && i % WORKPLACE_PROFILES[region].commons === 0) program = 'Sky commons';
  if (mall) program = i === count - 1 && count > 1 ? 'Food court' : SHOP_PROGRAMS[(i + Math.floor(seed * 5)) % 5];
  levels.push({ n: i, y, h, kind, program, seed: hash(seed * 137, i), holes: mall && i > 0 ? [atrium] : [] });
 }
 levels.push({ n: 'R', y: top, h: 0, kind: 'roof', program: 'Roof terrace', holes: [] });
 const T = { o, key: Math.round(o.x) + ':' + Math.round(o.z), W, D, hw, hd, floor0, top, type, region, profile:WORKPLACE_PROFILES[region], levels, coreW, coreD, coreZ, r: seed, atrium };
 for (const L of levels) L.zones = L.kind === 'office' ? officeZones(T, L) : [];
 return T;
}

// A resort's casino: the gaming floor inside the doors, under a low ceiling, open all hours;
// over it, where the block is tall enough, the showroom. Its hotel: the lobby with the front
// desk, then floor after floor of guest rooms down a corridor, the suites at the top.
export const HOTEL_STOREY = 3.3;
function planResort(o, floor0, casino, { top, height, seed, region, W, D, hw, hd }) {
 const coreW = Math.min(10, W * .32), coreD = Math.min(4.5, D * .2), coreZ = -hd + coreD, levels = [];
 const name = o.src?.biz?.name || null;
 if (casino) {
  const h0 = height >= 12 ? Math.min(7.2, height * .45) : height;
  levels.push({ n: 0, y: floor0, h: h0, kind: 'casino', program: 'Casino floor', seed: hash(seed * 137, 0), holes: [] });
  if (height - h0 >= 5) levels.push({ n: 1, y: floor0 + h0, h: top - floor0 - h0, kind: 'showroom', program: 'Showroom', seed: hash(seed * 137, 1), holes: [] });
 } else {
  const lobbyH = Math.min(6.4, Math.max(3.4, height / 2)), count = Math.max(1, 1 + Math.floor((height - lobbyH + 1e-6) / HOTEL_STOREY));
  for (let i = 0; i < count; i++) {
   const y = i ? floor0 + lobbyH + (i - 1) * HOTEL_STOREY : floor0, h = i === count - 1 ? top - y : i ? HOTEL_STOREY : lobbyH;
   // (the top two floors of a tall one its suites)
   const suite = i > 0 && count > 8 && i >= count - 2;
   levels.push({ n: i, y, h, kind: i ? 'hotel' : 'lobby', program: i ? (suite ? 'Suites' : 'Guest rooms') : 'Hotel lobby', seed: hash(seed * 137, i), holes: [], suite });
  }
 }
 levels.push({ n: 'R', y: top, h: 0, kind: 'roof', program: 'Roof terrace', holes: [] });
 const T = { o, key: Math.round(o.x) + ':' + Math.round(o.z), W, D, hw, hd, floor0, top, type: casino ? 'casino' : 'hotel', name, region, profile: WORKPLACE_PROFILES[region], levels, coreW, coreD, coreZ, r: seed, atrium: null };
 for (const L of levels) L.zones = [];
 return T;
}

export function officeZones(T, L) {
 const { hw, hd, coreW, coreZ } = T, z0 = coreZ + 3.5, z1 = hd - .8, middle = (z0 + z1) / 2;
 const width = hw - 2.1, depth = (z1 - z0) / 2 - .8;
 if (width < 3 || depth < 2.5) return [{ type: 'work', x0: -hw + .8, x1: -1.4, z0, z1 }, { type: 'lounge', x0: 1.4, x1: hw - .8, z0, z1 }].filter(r => r.x1-r.x0>2 && r.z1-r.z0>2);
 // One quarter of desks at most (in pods, by the windows: workplace-fitout.js); the rest is
 // the floor's own trade (a lab, a studio, a market wall, a café), rooms, and a lounge.
 const P = L.program, third = P === 'Executive offices' || P === 'Client services' ? 'private' : T.profile.privacy && L.seed < .5 ? 'focus' : 'meeting';
 const types = P === 'Sky commons' ? ['lounge', 'gym', 'games', 'lounge']
  : P === 'Conference centre' ? ['meeting', 'feature', 'meeting', 'lounge']
  : P === 'Executive offices' ? ['private', 'feature', 'meeting', 'lounge']
  : ['work', 'feature', third, 'lounge'];
 const zones = [];
 for (let row = 0; row < 2; row++) for (let side = 0; side < 2; side++) zones.push({ type: types[row * 2 + side], x0: side ? 1.4 : -hw + .8, x1: side ? hw - .8 : -1.4, z0: row ? middle + .8 : z0, z1: row ? z1 : middle - .8 });
 // Plumbing, printing and refreshments flank the same lift core on every floor.
 for (const side of [-1, 1]) if (hw - coreW/2 > 4) zones.push({ type: side < 0 ? 'restroom' : 'pantry', x0: side < 0 ? -hw + .8 : coreW/2 + .8, x1: side < 0 ? -coreW/2 - .8 : hw - .8, z0: -hd + .8, z1: coreZ + 1.6 });
 return zones;
}

export function levelBelow(T, y, allowance = 1.2) {
 for (let i = T.levels.length - 1; i >= 0; i--) if (y >= T.levels[i].y - allowance) return T.levels[i];
 return null;
}
// The floor plates stop just inside the facade: flush with it, their edges shared the
// tower's outer face at every storey and flickered through it from the street.
export const SLAB_INSET = .15;
export function slabRects(T, L) {
 const a = L.holes[0], X = T.W/2 - SLAB_INSET, Z = T.D/2 - SLAB_INSET;
 if (!a) return [[-X, -Z, X, Z]];
 return [[-X,-Z,a.x0,Z],[a.x1,-Z,X,Z],[a.x0,-Z,a.x1,a.z0],[a.x0,a.z1,a.x1,Z]];
}
export function floorAt(T, x, z, y) {
 if (Math.abs(x) > T.W/2 || Math.abs(z) > T.D/2) return -1e9;
 let ramp = -1e9;
 if(T.atrium && Math.abs(x)>.4 && Math.abs(x)<2.2 && z>=T.atrium.z0 && z<=T.atrium.z1) {
  const t=(z-T.atrium.z0)/(T.atrium.z1-T.atrium.z0),u=x<0?t:1-t;
  for(const L of T.levels.slice(0,-2)){const sy=L.y+Math.min(1,(Math.floor(u*32)+1)/32)*L.h;if(y>=sy-.45)ramp=Math.max(ramp,sy);}
 }
 for (let i = T.levels.length - 1; i >= 0; i--) {
  const L = T.levels[i];
  if (y < L.y - 1.2) continue;
  if (!L.holes.some(a => x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1)) return Math.max(ramp,L.y);
 }
 return ramp;
}
