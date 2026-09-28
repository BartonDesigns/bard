// What the ears need to know about where you are, read from the world a few times a second:
//   surface: what is underfoot (a trail's gravel, the road, sand, a wooden floor, snow...)
//   room:    the space round you (open air, a street between buildings, a small room, a
//            tower's lobby, a cave), and a wall near enough to throw an echo back
//   place:   what kind of place it is and how busy (a café, a beach, the village...), for
//            the ambience

import { toGrid, BLOCKS, STYLE } from '../bay/styles.js';
import { toWorld } from '../bay/geo.js';
import { crowd, zoneOf, ZONE, kidsAbout } from '../people/flow.js';

const EYE = 1.68;
// the real map's paths and tracks, by what they are made of
const PATHS = { path: 'dirt', track: 'gravel', bridleway: 'dirt', footway: 'concrete', pedestrian: 'concrete', cycleway: 'road', steps: 'stone' };
// inside the shops and the towers
const BIZ_FLOOR = { cafe: 'tile', restaurant: 'wood', shop: 'tile', office: 'stone', arcade: 'carpet', bowling: 'wood', cinema: 'carpet' };
const BIZ_ROOM = { cafe: 'shop', restaurant: 'shop', shop: 'shop', office: 'lobby', arcade: 'shop', bowling: 'hall', cinema: 'hall' };
const TOWER_FLOOR = { lobby: 'stone', office: 'carpet', home: 'wood', roof: 'concrete', amenity: 'tile' };
const TOWER_ROOM = { lobby: 'lobby', office: 'office', home: 'room', amenity: 'hall' };
// the Santa Cruz Beach Boardwalk
const BOARDWALK = toWorld(36.9643, -122.0177);

function segDist(x, z, p) {
	let best = 1e9;
	for (let i = 0; i + 3 < p.length; i += 2) {
		const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
		best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return best;
}
// a floor source's height here, if it is the one you stand on
const on = (fn, x, z, foot) => { if (!fn) return false; const f = fn(x, z, foot + 0.3); return f > -1e8 && Math.abs(f - foot) < 0.3; };

// how far down a medieval realm's dungeon you are (0..1)
const dungeon = (W) => { const v = W.medieval?.inside?.(); return typeof v === 'number' ? v : 0; };

export function createSensing() {
	const S = { surface: 'dirt', why: '', room: 'open', roomK: 1, slap: { d: 0.1, k: 0 }, place: { kind: 'wild' }, x: 1e9, z: 1e9, y: 1e9, t: 9, rt: 9, pt: 9 };

	// ---------- underfoot ----------
	function surface(W, P) {
		const I = W.island, x = P.pos.x, z = P.pos.z, foot = P.pos.y - EYE, pos = P.pos;
		// wading
		if (P.surface !== undefined && P.surface > foot + 0.06 && !I.underFloor?.(x, z, foot)) return ['water', 'wading'];
		if (I.underFloor?.(x, z, foot) != null) return ['stone', 'cave floor'];
		const g = I.heightAt(x, z), onIsland = Math.max(Math.abs(x), Math.abs(z)) < I.half;
		// indoors, and the built things you can stand on
		const H = W.houses?.inside?.(pos);
		if (H) return [H.level ? 'carpet' : 'wood', 'house'];
		const B = W.commercial?.inside?.(pos);
		if (B) return [BIZ_FLOOR[B.type] || 'tile', B.type];
		const T = W.towers?.here?.(pos);
		if (T) return [TOWER_FLOOR[T.kind] || 'stone', 'tower ' + T.kind];
		if (dungeon(W) > 0.3) return ['stone', 'dungeon'];
		if (foot > g + 0.12) {
			if (on(W.bridge?.deckFloor, x, z, foot)) return ['concrete', 'bridge deck'];
			if (on(W.freeways?.floor, x, z, foot)) return ['road', 'freeway deck'];
			if (on(W.beaches?.floor, x, z, foot)) return ['wood', 'boardwalk'];
			if (on(W.discovery?.floor, x, z, foot)) return ['wood', 'museum'];
			if (on(W.alien?.floor, x, z, foot)) return ['metal', 'alien works'];
			for (const src of [W.landmarks, W.diablo, W.tidepools, W.volcano]) if (on(src?.floor, x, z, foot)) return ['stone', 'rock'];
			if (foot > g + 0.3 && onIsland) return ['wood', 'porch'];
		}
		if (onIsland || !W.bayArea) return island(I, x, z, g, S.planet);
		return bay(W, x, z, g);
	}
	// the island, and the other worlds (all island)
	function island(I, x, z, g, planet) {
		const type = planet?.type || 'TROPICAL';
		const snow = I.biomes?.snowAt?.(x, z, g) || 0;
		if (snow > 0.45) return ['snow', 'snow'];
		if (g < 2.2 && (I.coastAt?.(x, z) ?? 99) < 45) return [type === 'MAGMA' ? 'gravel' : 'sand', 'beach'];
		if (I.maskAt(x, z, 0) > 0.45) return [type === 'ARID' ? 'dirt' : 'gravel', 'trail'];
		if (I.maskAt(x, z, 1) > 0.5) return ['dirt', 'village lane'];
		if (I.normalAt(x, z).y < 0.8) return ['stone', 'rock'];
		const wild = I.maskAt(x, z, 3) > 0.25;
		if (type === 'ICE') return ['snow', 'ice world'];
		if (type === 'MAGMA') return ['gravel', 'ash'];
		if (type === 'ARID') return [wild ? 'dirt' : 'sand', 'desert'];
		return [wild ? 'grass' : 'dirt', wild ? 'meadow' : 'bare ground'];
	}
	// the Bay Area: the real streets and trails where they are mapped, the town grid elsewhere
	function bay(W, x, z, g) {
		const bay = W.bayArea, real = W.real;
		const U = bay.urbanAt(x, z);
		if (W.beaches?.beachAt?.(x, z) && g < 8) return ['sand', 'beach'];
		if (g < 3.5 && U.u < 0.3) {
			for (const [dx, dz] of [[18, 0], [-18, 0], [0, 18], [0, -18]]) if (bay.heightAt(x + dx, z + dz) < 0) return ['sand', 'shore'];
		}
		if (real?.loaded?.() && real.inside(x, z)) {
			let best = null, bd = 1e9;
			for (const r of real.near('roads', x, z, 30)) {
				const d = segDist(x, z, r.pts) - r.w / 2;
				if (d < bd) { bd = d; best = r; }
			}
			if (best && bd < 0.2) return [PATHS[best.cls] || 'road', best.cls];
			if (best && best.walked && bd < 2.8) return ['concrete', 'sidewalk'];
			const L = real.landAt?.(x, z);
			if (L) {
				if (L.road > 0.5) return ['road', 'paved'];
				const lu = L.lu;
				if (lu === 7 || lu === 13) return ['concrete', 'lot'];
				if (lu === 8) return ['gravel', 'yard'];
				if (lu === 9) return ['sand', 'bunker'];
				if (lu === 5) return ['dirt', 'playground'];
				if (lu === 1 || lu === 2 || lu === 3 || lu === 4 || lu === 6 || lu === 11) return ['grass', 'grass'];
			}
		} else if (U.u > 0.3) {
			// the grid: the street, its sidewalks, the lots
			const [BX, BZ, ST] = BLOCKS[U.s] || BLOCKS[3], [gx, gz] = toGrid(x, z, U.a, U.s);
			const lx = gx - Math.floor(gx / BX) * BX, lz = gz - Math.floor(gz / BZ) * BZ;
			if (lx < ST || lz < ST) return ['road', 'street'];
			if (lx < ST + 2.6 || lz < ST + 2.6 || lx > BX - 2.6 || lz > BZ - 2.6) return ['concrete', 'sidewalk'];
			return U.s === STYLE.sf || U.d > 0.3 || U.s === STYLE.office || U.s === STYLE.retail ? ['concrete', 'plaza'] : ['grass', 'yard'];
		}
		// the wild: rock on the steep, dirt under the trees, dry grass on the hills
		const e = 2, sl = Math.hypot(bay.heightAt(x + e, z) - bay.heightAt(x - e, z), bay.heightAt(x, z + e) - bay.heightAt(x, z - e)) / (2 * e);
		if (sl > 0.75) return ['stone', 'rock'];
		if (g > 900) return ['stone', 'summit'];
		return ['grass', 'hills'];
	}

	// ---------- the space round you ----------
	function room(W, cam) {
		const pos = cam.position, x = pos.x, z = pos.z;
		const cave = W.underworld?.inside?.() || 0;
		if (cave > 0.3) return ['cave', cave];
		const dk = dungeon(W);
		if (dk > 0.3) return ['dungeon', dk];
		const T = W.towers?.here?.(pos);
		if (T && TOWER_ROOM[T.kind]) return [TOWER_ROOM[T.kind], 1];
		const B = W.commercial?.inside?.(pos);
		if (B) return [BIZ_ROOM[B.type] || 'shop', 1];
		if (W.houses?.inside?.(pos)) return ['room', 1];
		if (W.discovery?.where?.(pos) === 'main') return ['hall', 1];
		// under a deck: a freeway overpass, the bridge's approach
		const head = pos.y + 0.3;
		for (const f of [W.freeways?.floor, W.bridge?.deckFloor]) if (f) { const v = f(x, z, head + 14); if (v > head && v < head + 14) return ['underpass', 1]; }
		const U = W.bayArea && Math.max(Math.abs(x), Math.abs(z)) > W.island.half ? W.bayArea.urbanAt(x, z) : null;
		if (U && U.u > 0.45 && (U.s === STYLE.sf || U.d > 0.25 || U.s === STYLE.office || U.s === STYLE.retail)) return ['street', Math.min(1, (U.u - 0.3) * 1.5)];
		return ['open', 1];
	}
	// a cliff or a hillside near you: where the land stands well above you, the nearest
	// distance at which it does, for a slap-back echo; in the streets, the buildings across
	function slap(W, cam, roomName) {
		if (roomName === 'street') return { d: 2 * 16 / 343, k: 0.5 };
		if (roomName !== 'open') return { d: 0.1, k: 0 };
		const x = cam.position.x, z = cam.position.z, y = cam.position.y, H = W.island.heightAt;
		let near = 1e9, walls = 0;
		for (let a = 0; a < 8; a++) {
			const dx = Math.cos(a * Math.PI / 4), dz = Math.sin(a * Math.PI / 4);
			for (const d of [25, 50, 90]) { if (H(x + dx * d, z + dz * d) > y + 10 + d * 0.15) { near = Math.min(near, d); walls++; break; } }
		}
		if (!walls) return { d: 0.1, k: 0 };
		return { d: 2 * near / 343, k: Math.min(1, walls / 4) * (near < 60 ? 1 : 0.6) };
	}

	// ---------- the place and its people ----------
	function place(W, cam, people, hours, night) {
		const pos = cam.position, x = pos.x, z = pos.z, weekend = [0, 6].includes(new Date().getDay());
		const out = { kind: 'wild', indoor: false, busy: 0, near: 0, talk: 0, kids: 0, kidsAbout: kidsAbout(hours, weekend), planet: S.planet?.type || null, earth: !!W.bayArea, coast: 1e9, hours, night, weekend };
		// the people round you (people.js), and their children
		let near = 0, talk = 0, kids = 0;
		for (const p of people?.pool || []) {
			if (!p.active) continue;
			const q = p.M.S.pos, d = Math.hypot(q.x - x, q.z - z, (q.y - pos.y) * 2);
			if (d > 45) continue;
			const w = 1 / (1 + (d / 9) ** 2);
			near += w;
			talk += w * (p.role === 'chat' || p.partner ? 1.6 : p.route?.kind === 'seat' ? 1.2 : p.role === 'wait' ? 0.5 : 0.25);
			if (p.P?.dna?.child) kids += w;
		}
		out.near = near; out.talk = talk; out.kids = kids;
		const I = W.island, onIsland = Math.max(Math.abs(x), Math.abs(z)) < I.half;
		if (onIsland) out.coast = I.coastAt?.(x, z) ?? 1e9;
		// indoors
		const T = W.towers?.here?.(pos), B = W.commercial?.inside?.(pos), H = W.houses?.inside?.(pos);
		const cave = W.underworld?.inside?.() || 0;
		if (cave > 0.3) {
			out.kind = 'cave'; out.indoor = true;
			const V = W.underworld.village?.(), c = V?.centre;
			if (c) { const d = Math.hypot(c.x - x, c.z - z); if (d < 70) { out.kind = 'caveVillage'; out.busy = Math.max(0, 1 - d / 70) * Math.min(1, (V.folk?.length || 6) / 10); } }
			return out;
		}
		if (dungeon(W) > 0.3) { out.kind = 'dungeon'; out.indoor = true; return out; }
		// a realm's town and castle (planet/medieval/): busy by day, quiet at night
		const R = W.medieval?.realm;
		if (R) {
			let d = 1e9;
			for (const c of [R.town, R.castle]) if (c) d = Math.min(d, Math.hypot(c.x - x, c.z - z));
			if (d < 160) { out.kind = 'medieval'; out.busy = (1 - night * 0.8) * Math.max(0.2, 1 - d / 160); return out; }
		}
		if (T) {
			out.indoor = true; out.kind = T.kind === 'lobby' ? 'lobby' : T.kind === 'office' ? 'office' : 'home';
			out.busy = T.kind === 'home' ? 0.1 : crowd(ZONE.office, hours, weekend).k;
			return out;
		}
		if (B) {
			out.indoor = true; out.kind = B.type;
			const seats = B.spots?.length || B.seats?.length || 0, taken = (B.spots || []).filter((q) => q.taken).length;
			const zone = B.type === 'office' ? ZONE.office : B.type === 'shop' ? ZONE.retail : ZONE.dining;
			out.busy = seats && B.spots ? Math.min(1, taken / Math.max(4, seats * 0.6)) : crowd(zone, hours, weekend).k;
			return out;
		}
		if (H) { out.indoor = true; out.kind = 'house'; return out; }
		if (W.discovery?.where?.(pos)) { out.kind = 'museum'; out.busy = W.discovery.busy?.(hours, new Date().getDay()) || 0; out.indoor = W.discovery.where(pos) === 'main'; return out; }
		if (onIsland || !W.bayArea) {
			const v = I.village, dv = v ? Math.hypot(x - v.x, z - v.z) : 1e9;
			out.kind = dv < 140 ? 'village' : out.coast < 60 ? 'beach' : 'wild';
			out.busy = out.kind === 'village' ? (1 - night * 0.7) * Math.max(0, 1 - dv / 140) : 0;
			return out;
		}
		// the Bay Area
		const alt = pos.y - W.island.heightAt(x, z);
		if (alt > 80) { out.kind = 'air'; return out; }
		const dBw = Math.hypot(x - BOARDWALK.x, z - BOARDWALK.z);
		if (W.boardwalk || dBw < 400) {
			const bw = W.boardwalk?.near?.(pos);
			if (bw || dBw < 400) { out.kind = 'boardwalk'; out.busy = Math.max(0.2, crowd(ZONE.beach, hours, weekend).k) * (bw?.busy ?? Math.max(0, 1 - dBw / 400)); return out; }
		}
		const bc = W.beaches?.beachAt?.(x, z);
		if (bc) { out.kind = 'beach'; out.busy = crowd(bc.quiet ? ZONE.quiet : ZONE.beach, hours, weekend).k * (bc.quiet ? 0.3 : 1); return out; }
		const pk = W.parks?.parkAt?.(x, z);
		if (pk) { out.kind = 'park'; out.busy = crowd(ZONE.trail, hours, weekend).k; return out; }
		const U = W.bayArea.urbanAt(x, z);
		if (U.u > 0.2) {
			const zone = zoneOf(U);
			out.kind = zone === ZONE.downtown ? 'downtown' : zone === ZONE.dining || zone === ZONE.retail ? 'mainstreet' : zone === ZONE.office ? 'offices' : zone === ZONE.industrial ? 'industrial' : 'suburb';
			out.busy = crowd(zone, hours, weekend).k * Math.min(1, U.u * 1.3);
			return out;
		}
		out.kind = 'wild';
		return out;
	}

	// read it all, no more often than it can change
	function update(dt, W, cam, P, people, hours, night, planet) {
		S.planet = planet;
		S.t += dt; S.rt += dt; S.pt += dt;
		const moved = Math.hypot(P.pos.x - S.x, P.pos.z - S.z, P.pos.y - S.y);
		if (S.t > 0.35 || moved > 1.2) {
			S.t = 0; S.x = P.pos.x; S.z = P.pos.z; S.y = P.pos.y;
			try { [S.surface, S.why] = surface(W, P); } catch { S.surface = 'dirt'; S.why = '?'; }
		}
		if (S.rt > 0.3) {
			S.rt = 0;
			try { [S.room, S.roomK] = room(W, cam); S.slap = slap(W, cam, S.room); } catch { S.room = 'open'; S.roomK = 1; }
		}
		if (S.pt > 0.5) { S.pt = 0; try { S.place = place(W, cam, people, hours, night); } catch { S.place = { kind: 'wild' }; } }
		return S;
	}
	return { update, state: S, surfaceOf: (W, P) => surface(W, P) };
}
