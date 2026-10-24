// The whole Earth past the Bay, as one engine with it: fly or drive east from the Golden Gate
// and the land goes on, over the Sierra and the Great Basin, the Rockies and the Plains, to the
// Atlantic and its islands, Europe and Africa, and across Asia to China.
//
//   globeframe.js    where the engine's metres are on the globe; the frame that floats
//   globedata.js     the coarse Earth (baked from open data, tools/bake-globe.mjs), streamed
//   globeheight.js   the ground: the coarse Earth and the engine's relief shaped by the place
//   globeterrain.js  drawn: its own rings and lakes, coloured by the place
//   globetrees.js    the woods and bushes of the place
//   globetowns.js    the atlas's real towns and cities, grown by the town generator
//   globeroads.js    the highways and main roads between them, driven like any mapped road
//   globelanes.js    the county roads, lanes and drives that join the homes to them
//   baydetail.js     the same relief on the Bay's real ground, finer than its survey
//
// This module runs them: it keeps the coarse window round you, moves the frame when you go far
// (and shifts you, the camera and what it placed with it), hands the Bay's ground the globe's
// heights past its survey (bay/terrain.js setFarGround), and names the region as you come
// into it. The Bay's own systems (bay/*) keep the Bay; past about 180 km its woods and wild
// things hand over to these (main.js gives them a view of the Bay that says so).

import * as THREE from 'three';
import { F, toLL, toXZ, setFrame, bayFrame, bayKm, BAY_KM, BAY_BACK_KM, DRIFT, DRIFT_MAX, FAR } from './globeframe.js';
import { createGlobeData } from './globedata.js';
import { createGlobeHeight, anchorUniforms, GLOBE_U } from './globeheight.js';
import { createGlobeTerrain, SEAM_A, SEAM_B } from './globeterrain.js';
import { createGlobeTrees } from './globetrees.js';
import { inClearing, clearingVersion } from '../sportsfields.js';
import { createGlobeTowns } from './globetowns.js';
import { createGlobeRoads, localRoadTownId } from './globeroads.js';
import { createGlobeLanes } from './globelanes.js';
import { createTownStreets } from './townstreets.js';
import { createGridStreets } from '../bay/gridstreets.js';
import { BAY_DETAIL_U, BAY_DETAIL_AMP } from './baydetail.js';
import { loadAtlas, atlasReady, regionAt, palette, citiesNear } from './atlas.js';
import { setFarGround } from '../bay/terrain.js';
import { LAT0, LON0 } from '../bay/geo.js';
import { today, onMonth } from '../calendar.js';
import { createRegional } from '../region/index.js';

// the countries that drive on the left (the rest keep right)
const LEFT = /United Kingdom|England|Scotland|Wales|Ireland|Japan|India|Pakistan|Bangladesh|Sri Lanka|Nepal|Bhutan|Thailand|Malaysia|Singapore|Indonesia|Brunei|Hong Kong|Macau|Australia|New Zealand|South Africa|Kenya|Tanzania|Uganda|Zambia|Zimbabwe|Botswana|Namibia|Mozambique|Malawi|Lesotho|Eswatini|Mauritius|Seychelles|Cyprus|Malta|Jamaica|Bahamas|Barbados|Trinidad|Guyana|Suriname|Bermuda|Cayman|Virgin Islands|Saint Lucia|Grenada|Dominica|Antigua|Saint Kitts|Saint Vincent|Fiji|Papua|Solomon|Tonga|Samoa|Timor|Falkland/i;
function placeOf(r) {
	if (!atlasReady()) return null;
	const ll = toLL((r.bounds[0] + r.bounds[2]) / 2, (r.bounds[1] + r.bounds[3]) / 2), R = regionAt(ll.lat, ll.lon);
	if (!R) return null;
	const country = R.profile.country || '';
	return { region: R.id, name: R.name, country, drive: LEFT.test(country) ? 'left' : 'right', palette: palette(R.id), style: R.profile.arch?.style || '' };
}

// past this the Bay's own woods and wild things (bay/city.js and the rest) give way to the globe's
export const BAY_WILD_KM = 180;

export function createGlobe({ scene, shared, bay, island, camera, world, director = null, hint = () => {}, isPhone = false, busy = () => false }) {
	const data = createGlobeData();
	data.U = GLOBE_U;
	data.tex.forEach((t, i) => { GLOBE_U['uGT' + i].value = t; });
	const height = createGlobeHeight(data.win);
	const terrain = createGlobeTerrain({ scene, data, BU: shared.bayU, isPhone });
	const stats = { rebases: 0, lastRebase: 0, updateMs: 0, maxMs: 0 };
	// the relief on the Bay's real ground, from the start (before anything is placed on it)
	BAY_DETAIL_U.uBDAmp.value = BAY_DETAIL_AMP;

	// the window round the Bay first
	const whenReady = data.follow(LAT0, LON0).then(() => { anchorUniforms(data.U, data.win); }).catch((e) => console.warn('globe', e));
	// how far past the Bay's survey a point is (m), in the Bay's frame
	function bayOut(x, z) {
		const L = bay.levels?.[0];
		if (!L || !F.bay) return 1e9;
		const qx = (x - L.x0) / L.step, qz = (z - L.zN) / L.step;
		return Math.hypot(Math.max(0, -qx, qx - (L.W - 1)), Math.max(0, -qz, qz - (L.H - 1))) * L.step;
	}
	setFarGround({ ready: () => data.win.ready, at: (x, z) => height.at(x, z), seam: [SEAM_A, SEAM_B], whenReady, hideBay: () => !F.bay });

	// ---------- the roads between the places (globeroads.js), found by the real city's near() ----------
	let leftSide = false, sourced = null;
	const roads = createGlobeRoads({ scene, height, data, groundAt: (x, z) => bay.heightAt(x, z), isPhone, left: () => leftSide,
		extraPlaces: () => {
			if (!F.bay) return [];
			return (bay.towns || []).map((t) => {
				const ll = toLL(t.x, t.z);
				return { id: localRoadTownId(t), name: t.name, lat: ll.lat, lon: ll.lon, pop: t.big ? 3 : 2 };
			});
		},
	});

	// The CPU uses the same mask, elevation and 30 cm bed clearance as the lake shader.
	// Return the nearby lake level on the dry bank as well for shoreline vegetation.
	function lakeLevel(x, z) {
		if (!data.win.ready || bayOut(x, z) <= SEAM_A) return null;
		height.at(x, z);
		return height.out.lake >= 0.5 && height.out.level >= 1 ? height.out.level : null;
	}
	function waterAt(x, z) {
		const level = lakeLevel(x, z);
		return level != null && height.out.h <= level - 0.3 ? level : null;
	}
	// the globe's own word for the sea (the economy's harbour trades, economy/layer.js setSea):
	// true on the open sea (under the drawn sea level, where the land mask says sea) or a lake,
	// false on land, null where the ground is not the globe's (the Bay's survey) or not yet in;
	// coastMask, its land mask (0 at the coastline, about 0.5 well inland), or null
	const ownGround = (x, z) => data.win.ready && bayOut(x, z) > SEAM_A;
	function seaAt(x, z) {
		if (!ownGround(x, z)) return null;
		const h = height.at(x, z);
		return (h < 0 && height.out.land <= 0.02) || waterAt(x, z) != null;
	}
	function coastMask(x, z) {
		if (!ownGround(x, z)) return null;
		height.at(x, z);
		return height.out.land;
	}

	// ---------- the woods and the towns ----------
	const inBayWild = (x, z) => { if (!F.bay) return false; const ll = toLL(x, z); return bayKm(ll.lat, ll.lon) < BAY_WILD_KM + 10; };
	// (the local roads come after the places they join: until then nothing is on them)
	let lanes = null;
	const trees = createGlobeTrees({ scene, shared, data, heightAt: (x, z) => bay.heightAt(x, z), waterLevel: (x, z) => world()?.water?.waterAt(x, z) ?? lakeLevel(x, z), isPhone, allowed: (x, z) => !inBayWild(x, z) && bayOut(x, z) > SEAM_A && !roads.onRoad(x, z, 8) && !lanes?.onRoad(x, z, 5) && !regional.settlements.vegetationBlocked(x, z, 8) && !inClearing(x, z, 6) });
	// a city the Bay already has: its towns' map, a mapped region, or one of its generated towns
	// (a generated town where the atlas has a real one gives way to it)
	function bayHas(x, z, r) {
		if (!F.bay) return false;
		if (Math.max(Math.abs(x), Math.abs(z)) < (island.half || 1400) + r) return true;
		const W = world();
		if (W?.real?.inside?.(x, z) || bay.urbanAt(x, z).u > 0.12) return true;
		const T = bay.towns || [];
		for (let i = T.length - 1; i >= 0; i--) {
			const t = T[i];
			if (Math.hypot(t.x - x, t.z - z) > t.r + r + 1000) continue;
			if (W?.civ?.active?.()?.town === t) return true;
			T.splice(i, 1);
		}
		return false;
	}
	// the real city (bay/realcity.js) as it comes to be: each town grown gets the place's own
	// particulars on it (its region, palette, the side of the road), for whatever draws it
	const realP = {
		addRegion: (r) => { if (r && r.name) r.place = placeOf(r); return world().real.addRegion(r); },
		removeRegion: (h) => world()?.real?.removeRegion(h),
	};
	// the regional kit (region/): the look, the buildings, the people and the sounds of the place;
	// it builds the towns it claims itself, and the town generator leaves those to it
	const heightRef = { height, world };
	const allRoads = { onRoad: (x, z, m) => roads.onRoad(x, z, m) || !!lanes?.onRoad(x, z, m), version: () => roads.version() * 1000 + (lanes?.version() || 0) };
	const laneRef = { keepOff: (x, z, m) => !!lanes?.keepOff(x, z, m), gridAt: (x, z) => lanes?.gridAt(x, z) || null, onRoad: (x, z, m) => !!lanes?.onRoad(x, z, m) };
	const regional = createRegional({ scene, shared, island, globe: heightRef, hint, isPhone, F, toLL, toXZ, bayKm, bayWildKm: BAY_WILD_KM, roads: allRoads, lanes: laneRef, woods: (x, z) => trees.woodsAt(x, z), water: () => world()?.water?.gen });
	lanes = createGlobeLanes({ scene, height, groundAt: (x, z) => bay.heightAt(x, z), isPhone, highways: roads, settlements: regional.settlements });
	// Regional settlements paint their own streets; publish those same streets to driving,
	// grading and intercity routing so claimed cities are not disconnected islands.
	let regionalRoadTowns = [], regionalRoadVersion = 0;
	const regionalRoads = {
		version: () => regionalRoadVersion,
		near(kind, x, z, rad, out) {
			if (kind !== 'roads') return;
			for (const T of regionalRoadTowns) for (const r of T.roads) {
				const b = r.box; if (b[2] >= x - rad && b[0] <= x + rad && b[3] >= z - rad && b[1] <= z + rad) out.push(r);
			}
		},
	};
	const towns = createGlobeTowns({ real: realP, heightAt: (x, z) => bay.heightAt(x, z), water: () => world()?.water?.gen, director, skip: bayHas, claim: (c) => regional.claims(c) });

	// ---------- the towns' own streets, out where the Bay's ground no longer paints them ----------
	// (townstreets.js) the grown towns' (bay/realcity.js's generated regions, anywhere on Earth) and
	// the Bay's gridded towns' (bay/gridstreets.js, out to 50 km past its survey). The Bay's ground
	// paints both itself as far as it reaches, SEAM_A past the survey.
	const painted = (x, z) => F.bay && bayOut(x, z) < SEAM_A;
	const streets = createTownStreets({ scene, groundAt: (x, z) => bay.heightAt(x, z), isPhone, painted });
	const gridStreets = createGridStreets({ bay, real: () => world()?.real, painted, isPhone });
	// a grown town's streets, its drives and walks (as the real city keeps them: the ones a gas
	// station's forecourt took are gone), and its forecourts; in pieces of a square 1.2 km, so the
	// streets round you come first and the rest are left out of view
	const genSets = new WeakMap(), PIECE_M = 1200;
	function genSetsOf(G) {
		let L = genSets.get(G);
		if (!L) {
			const cells = new Map();
			const at = (x, z) => {
				const i = Math.floor(x / PIECE_M), j = Math.floor(z / PIECE_M), k = i + ',' + j;
				let S = cells.get(k);
				if (!S) cells.set(k, S = { key: null, x: (i + 0.5) * PIECE_M, z: (j + 0.5) * PIECE_M, roads: [], paths: [], ground: [] });
				return S;
			};
			for (const r of G.data.roads) { const p = r.pts; if (p?.length >= 4) { const m = (p.length >> 1) & ~1; at(p[m], p[m + 1]).roads.push(r); } }
			for (const c of G.grid.values()) for (const q of c.paths) at(q.ax, q.az).paths.push(q);
			for (const S of G.sites || []) for (const g of S.ground || []) at(g[0], g[1]).ground.push(g);
			L = [...cells.values()];
			for (const S of L) S.key = S;
			genSets.set(G, L);
		}
		return L;
	}
	// the Bay's gridded towns out past its ground (bay.towns, terrain.js), as the highways and the
	// survey's roads see them: a highway stops at the edge and goes on into the town's streets,
	// the section roads keep out. (A town's houses reach to about 1.2 of its radius: buildUrban.)
	function gridTowns(x, z, grown) {
		const out = [];
		if (!F.bay) return out;
		for (const t of bay.towns || []) {
			if (t === grown || Math.hypot(t.x - x, t.z - z) > 40000 || bayOut(t.x, t.z) < SEAM_A) continue;
			const r = t.r * 1.2;
			out.push({ id: localRoadTownId(t), x: t.x, z: t.z, r, join: 500, around: true, roads: gridStreets.townRoads(t, r) || NONE });
		}
		return out;
	}
	const NONE = [];


	// the place's name for the Bay's labels (bay/labels.js), out where the Bay's own names don't
	// reach: the town you are in, else the region; the sea by the atlas's name for it
	bay.farWhere = (x, z) => {
		const ll = toLL(x, z);
		if (F.bay && bayKm(ll.lat, ll.lon) < BAY_WILD_KM) return undefined;
		if (!atlasReady()) return null;
		const R = regionAt(ll.lat, ll.lon), cap = (t) => t ? t[0].toUpperCase() + t.slice(1) : '';
		if (!R) return null;
		if (!R.land || height.at(x, z) < 0) return { name: cap(R.sea?.name || R.name || 'The open sea'), sub: '' };
		const c = citiesNear(ll.lat, ll.lon, 25, 1)[0], country = R.profile.country || '';
		if (c && c.km < 4 + c.pop * 2) return { name: c.name, sub: [cap(R.name), country].filter((t, i, a) => t && a.indexOf(t) === i).join(' · ') };
		return { name: cap(R.name), sub: country };
	};

	// ---------- flying: a cruising height out over the globe ----------
	island.flyCeiling = (x, z) => {
		if (!F.bay) return 12000;
		const ll = toLL(x, z), k = Math.min(1, Math.max(0, (bayKm(ll.lat, ll.lon) - 120) / 150));
		return 900 + k * k * 11100;
	};

	// ---------- the season ----------
	// how far this month's air is from the year's mean (C): coldest mid-January in the north and
	// mid-July in the south; a wide swing inland at high latitudes, a small one by the sea and
	// near the equator (how much land lies within a few hundred km)
	function seasonal(lat, lon) {
		let land = 0;
		for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) land += Math.min(1, Math.max(0, data.cellAt(lat + a * 1.2, lon + b * 1.5).L || 0));
		const A = (3 + 0.28 * Math.min(60, Math.abs(lat))) * (0.35 + 0.65 * land / 25);
		const d = today(), m = d.getMonth() + (d.getDate() - 1) / 30;
		return -A * Math.cos(2 * Math.PI * (m - 0.5) / 12) * (lat < 0 ? -1 : 1);
	}

	// ---------- the frame ----------
	// move it so the camera sits at its anchor (or back to the Bay's): everything of ours moves
	// with it, and you and the camera; the Bay's own things stay (they are far off by then)
	function reframe(bayBack) {
		const P = world()?.player?.state;
		const x0 = camera.position.x, z0 = camera.position.z, ll = toLL(x0, z0);
		if (bayBack) bayFrame(); else setFrame(ll.lat, ll.lon);
		const p = bayBack ? toXZ(ll.lat, ll.lon) : { x: FAR.x, z: FAR.z };
		const dx = p.x - x0, dz = p.z - z0;
		if (!Number.isFinite(dx) || !Number.isFinite(dz)) return { dx: 0, dz: 0 };
		if (P) { P.pos.x += dx; P.pos.z += dz; }
		camera.position.x += dx; camera.position.z += dz;
		camera.updateMatrixWorld();
		data.anchor(); anchorUniforms(data.U, data.win);
		trees.shift(dx, dz);
		towns.reset(); world()?.water?.reframe?.();
		roads.reframe(); lanes.reframe(); streets.clear(); gridStreets.clear();
		stats.rebases++; stats.lastRebase = performance.now();
		return { dx, dz };
	}
	function frameCheck() {
		const x = camera.position.x, z = camera.position.z, ll = toLL(x, z), km = bayKm(ll.lat, ll.lon);
		if (busy()) return;           // driving or aboard: the frame waits (a float still holds a few cm out to 1000 km)
		if (F.bay) { if (km > BAY_KM) reframe(false); return; }
		if (km < BAY_BACK_KM) { reframe(true); return; }
		const d = Math.hypot(x - F.fx, z - F.fz);
		if (d > DRIFT_MAX || (d > DRIFT && !towns.busy())) reframe(false);
	}
	// go to a place anywhere on Earth: the frame moves there first; returns its engine metres
	function place(lat, lon) {
		const was = F.epoch;
		if (bayKm(lat, lon) < BAY_BACK_KM) { if (!F.bay) { bayFrame(); data.anchor(); anchorUniforms(data.U, data.win); towns.reset(); } }
		else { setFrame(lat, lon); data.anchor(); anchorUniforms(data.U, data.win); towns.reset(); }
		roads.reframe(); lanes.reframe(); streets.clear(); gridStreets.clear();
		// (the water worked out round you was for the old frame's ground, at the same metres; and
		// again once the new ground is in, as any worked out meanwhile was from ground not yet there)
		const moved = F.epoch !== was, ep = F.epoch;
		if (moved) world()?.water?.reframe?.();
		const p = toXZ(lat, lon);
		// (a jump out of the window: nothing is drawn or placed from the old one meanwhile)
		const gi = Math.floor((lon + 180) * 10), gj = Math.floor((90 - lat) * 10), W = data.win;
		if (Math.abs(((gi - W.gi0 - 128) % 3600 + 5400) % 3600 - 1800) > 110 || Math.abs(gj - W.gj0 - 128) > 110) W.ready = false;
		return { x: p.x, z: p.z, ready: data.cover(lat, lon).then(() => { data.anchor(); anchorUniforms(data.U, data.win); if (moved && F.epoch === ep) world()?.water?.reframe?.(); }) };
	}

	// ---------- each frame ----------
	let regionT = 0, regionId = null, veg = null, seasonT = 0, arriveT = -1e9;
	const look = new THREE.Vector3(), lead = { x: 0, z: 0 }, treeAt = { position: new THREE.Vector3() };
	const offMonth = onMonth(() => { seasonT = 0; });
	// a guard: the camera and you are never left at a NaN (the frame moves, the jumps and the
	// heights all feed them); if one ever turns up you go back to the last good place, once said
	const good = { p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion(), ok: false, said: false };
	function sane(cam) {
		const P = world()?.player?.state;
		const fin = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
		if (fin(cam.position) && Number.isFinite(cam.quaternion.w) && (!P || (fin(P.pos) && fin(P.vel)))) {
			good.c.copy(cam.position); good.q.copy(cam.quaternion); if (P) { good.p.copy(P.pos); good.v.copy(P.vel); } good.ok = true;
			return;
		}
		if (!good.said) { good.said = true; console.warn('[globe] a NaN reached the camera or the player: put back'); }
		if (!good.ok) return;
		cam.position.copy(good.c); cam.quaternion.copy(good.q); cam.updateMatrixWorld();
		if (P) { P.pos.copy(good.p); P.vel.set(0, 0, 0); if (!Number.isFinite(P.yaw)) P.yaw = 0; if (!Number.isFinite(P.pitch)) P.pitch = 0; }
	}
	// arriving: coming down from orbit onto a new place (its towns start growing on the way down)
	function update(dt, cam, night, { arriving = false } = {}) {
		const t0 = performance.now();
		sane(cam);
		frameCheck();
		const x = cam.position.x, z = cam.position.z, ll = toLL(x, z);
		const moving = data.follow(ll.lat, ll.lon);
		if (moving) moving.then(() => anchorUniforms(data.U, data.win)).catch(() => {});
		const out = bayOut(x, z);
		// the sharpest ground and the near trees round you and cast ahead of you: their middles
		// lead you along where you look, further the higher you are (none looking straight down)
		cam.getWorldDirection(look);
		const flat = Math.hypot(look.x, look.z), gy = bay.heightAt(x, z);
		const ahead = flat > 0.2 ? Math.max(40, Math.min(450, (cam.position.y - (Number.isFinite(gy) ? gy : 0)) * 0.6)) : 0;
		lead.x = ahead ? look.x / flat * ahead : 0; lead.z = ahead ? look.z / flat * ahead : 0;
		terrain.update(cam, F, { bay: F.bay, bayOut: out, night, cities: towns.lit(12), on: !F.bay || bay.loaded(), lead, agl: cam.position.y - (Number.isFinite(gy) ? gy : 0) });
		// the place: its name as you come into it, its plants for the woods (every 2 s)
		// the season here, once the window is in (and at once when another month is picked)
		seasonT -= dt;
		if (seasonT <= 0 && data.win.ready) { seasonT = 2; GLOBE_U.uGSeason.value = seasonal(ll.lat, ll.lon); }
		regionT -= dt;
		if (regionT <= 0) {
			regionT = 2;
			if (!atlasReady()) loadAtlas().catch(() => {});
			else {
				const R = regionAt(ll.lat, ll.lon);
				veg = R?.land ? R.profile.veg : veg;
				if (R?.land) leftSide = LEFT.test(R.profile.country || '');
				const top = R?.weights?.[0];
				if (R?.land && top && top.w > 0.6 && R.id !== regionId && out > SEAM_A) {
					const was = regionId; regionId = R.id;
					if (was) hint(R.name[0].toUpperCase() + R.name.slice(1), 3500);
				}
			}
		}
		const steady = data.win.ready && !data.win.moving;
		const tk = Math.min(1, 150 / (Math.hypot(lead.x, lead.z) || 1));
		treeAt.position.set(x + lead.x * tk, 0, z + lead.z * tk);
		trees.update(treeAt, veg, steady && (!F.bay || out > SEAM_A - 3000), data.win.version + ':' + roads.version() + ':' + lanes.version() + ':' + regional.settlements.version() + ':' + clearingVersion() + ':' + (world()?.water?.lakesVersion?.() ?? ''));
		// (kept on for a while after the orbit lets go at 7.8 km, down through the last few km)
		if (arriving) arriveT = t0;
		if (steady) towns.update(cam, arriving || t0 - arriveT < 45000);
		if (data.win.ready) regional.update(dt, cam, { night, out: !F.bay || out > SEAM_A - 3000, wind: shared.uWindDir ? { x: shared.uWindDir.value.x * (0.3 + (shared.uWind?.value || 0.5)), y: shared.uWindDir.value.y * (0.3 + (shared.uWind?.value || 0.5)) } : null });
		// the roads: a source for the real city (drive.js, the traffic, the grading find them there)
		const real = world()?.real;
		if (real?.addSource && sourced !== real) { for (const S of [roads, regionalRoads, lanes]) { sourced?.removeSource?.(S); real.addSource(S); } sourced = real; }
		const nextRoadTowns = regional.settlements.roadTowns();
		if (nextRoadTowns.length !== regionalRoadTowns.length || nextRoadTowns.some((t, i) => t !== regionalRoadTowns[i])) { regionalRoadTowns = nextRoadTowns; regionalRoadVersion++; }
		const A = towns.civ().active(), B = world()?.civ?.active();
		const activeTownRoads = [];
		// (a town grown here: a highway to it ends at its edge and goes on into its streets, and one
		// only passing through leaves it at its edge each way, globeroads.js; a city's district is
		// not the city's end, the town at its middle is, but a place standing in it ends there)
		const D = A?.town.district;
		if (A?.region) activeTownRoads.push({ id: D ? A.town.city.id + ':' + D.join(',') : A.town.city.id, x: A.town.x, z: A.town.z, r: A.town.r, district: !!D, around: !!D, join: D ? 500 : undefined, through: true, roads: A.region.roads || [] });
		if (B?.region) activeTownRoads.push({ id: localRoadTownId(B.town), x: B.town.x, z: B.town.z, r: B.town.r, around: true, through: true, roads: B.region.roads || [] });
		// the gridded towns' streets round you, worked out tile by tile (inside the Bay's ground
		// it paints them, and none are needed)
		gridStreets.update(cam, steady && F.bay && bay.loaded() && out > SEAM_A - 2600);
		const gridT = gridTowns(x, z, B?.town);
		roads.update(dt, cam, steady && (!F.bay || out > SEAM_A), [...regionalRoadTowns, ...activeTownRoads, ...gridT.filter((t) => t.roads.length)]);
		// the local roads; the streets of a town grown here take over inside it
		lanes.update(dt, cam, steady && (!F.bay || out > SEAM_A), [...regionalRoadTowns, ...activeTownRoads, ...gridT].filter((t) => Number.isFinite(t.r)));
		// ...and every town's streets on the ground: the grown towns', the gridded towns'
		const sets = [];
		for (const G of real?.R?.regions || []) if (G.gen) for (const S of genSetsOf(G)) sets.push(S);
		for (const S of gridStreets.sets()) sets.push(S);
		streets.update(cam, data.win.ready && (!F.bay || out > SEAM_A - 3000), sets);
		const ms = performance.now() - t0;
		stats.updateMs += (ms - stats.updateMs) * 0.05; stats.maxMs = Math.max(stats.maxMs * 0.995, ms);
	}

	// what the console shows (Crysis.globe())
	function info() {
		const ll = toLL(camera.position.x, camera.position.z);
		return {
			at: `${ll.lat.toFixed(4)}, ${ll.lon.toFixed(4)}`, frame: F.bay ? 'the Bay\'s' : `floating at ${F.lat.toFixed(3)}, ${F.lon.toFixed(3)}`, rebases: stats.rebases,
			ground: Math.round(height.at(camera.position.x, camera.position.z)), region: regionId, towns: towns.info(), trees: trees.count(), roads: roads.info(), lanes: lanes.info(), streets: { ...streets.info(), grid: gridStreets.info() }, regional: regional.info(),
			window: { cell0: [data.win.gi0, data.win.gj0], tiles: data.stats.tiles, composeMs: data.stats.composeMs, decodeMs: Math.round(data.stats.decodeMs), mb: Math.round(data.bytes() / 1e5) / 10 },
			ms: { mean: Math.round(stats.updateMs * 100) / 100, peak: Math.round(stats.maxMs * 10) / 10 },
		};
	}
	function dispose() {
		setFarGround(null);
		offMonth();
		regional.dispose();
		delete bay.farWhere;
		GLOBE_U.uGOn.value = 0;
		for (const S of [roads, regionalRoads, lanes]) sourced?.removeSource?.(S);
		BAY_DETAIL_U.uBDAmp.value = 0;
		delete island.flyCeiling;
		if (!F.bay) bayFrame();
		towns.reset();
		roads.dispose(); lanes.dispose(); streets.dispose(); gridStreets.clear();
		for (const g of [terrain.group, trees.group]) { scene.remove(g); g.traverse((o) => { o.geometry?.dispose?.(); }); }
		for (const t of data.tex) t.dispose();
	}
	// finish what is being laid out now, in one go (tests, and after a jump)
	function settle() {
		trees.settle(); towns.civ().flush();
		if (F.bay && bay.loaded()) gridStreets.settle(camera);
		roads.settle(camera); lanes.settle(camera);
		const sets = [...(world()?.real?.R?.regions || []).filter((G) => G.gen).flatMap(genSetsOf), ...gridStreets.sets()];
		streets.settle(sets, camera);
	}
	return { update, place, info, dispose, settle, roads, lanes, streets, gridStreets, toLL, toXZ, height, waterAt, seaAt, coastMask, data, terrain, trees, towns, regional, whenReady, frame: F, bayOut };
}
