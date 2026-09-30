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
import { createGlobeHeight, anchorUniforms, globeUniforms } from './globeheight.js';
import { createGlobeTerrain, SEAM_A, SEAM_B } from './globeterrain.js';
import { createGlobeTrees } from './globetrees.js';
import { createGlobeTowns } from './globetowns.js';
import { BAY_DETAIL_U, BAY_DETAIL_AMP } from './baydetail.js';
import { loadAtlas, atlasReady, regionAt, palette } from './atlas.js';
import { setFarGround } from '../bay/terrain.js';
import { LAT0, LON0 } from '../bay/geo.js';

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
	data.U = globeUniforms(THREE);
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

	// ---------- the woods and the towns ----------
	const inBayWild = (x, z) => { if (!F.bay) return false; const ll = toLL(x, z); return bayKm(ll.lat, ll.lon) < BAY_WILD_KM + 10; };
	const trees = createGlobeTrees({ scene, shared, data, heightAt: (x, z) => bay.heightAt(x, z), isPhone, allowed: (x, z) => !inBayWild(x, z) && bayOut(x, z) > SEAM_A });
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
	const towns = createGlobeTowns({ real: realP, heightAt: (x, z) => bay.heightAt(x, z), water: () => world()?.water?.gen, director, skip: bayHas });

	// ---------- flying: a cruising height out over the globe ----------
	island.flyCeiling = (x, z) => {
		if (!F.bay) return 12000;
		const ll = toLL(x, z), k = Math.min(1, Math.max(0, (bayKm(ll.lat, ll.lon) - 120) / 150));
		return 900 + k * k * 11100;
	};

	// ---------- the frame ----------
	// move it so the camera sits at its anchor (or back to the Bay's): everything of ours moves
	// with it, and you and the camera; the Bay's own things stay (they are far off by then)
	function reframe(bayBack) {
		const P = world()?.player?.state;
		const x0 = camera.position.x, z0 = camera.position.z, ll = toLL(x0, z0);
		if (bayBack) bayFrame(); else setFrame(ll.lat, ll.lon);
		const p = bayBack ? toXZ(ll.lat, ll.lon) : { x: FAR.x, z: FAR.z };
		const dx = p.x - x0, dz = p.z - z0;
		if (P) { P.pos.x += dx; P.pos.z += dz; }
		camera.position.x += dx; camera.position.z += dz;
		camera.updateMatrixWorld();
		data.anchor(); anchorUniforms(data.U, data.win);
		trees.shift(dx, dz);
		towns.reset();
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
		if (bayKm(lat, lon) < BAY_BACK_KM) { if (!F.bay) { bayFrame(); data.anchor(); anchorUniforms(data.U, data.win); towns.reset(); } }
		else { setFrame(lat, lon); data.anchor(); anchorUniforms(data.U, data.win); towns.reset(); }
		const p = toXZ(lat, lon);
		// (a jump out of the window: nothing is drawn or placed from the old one meanwhile)
		const gi = Math.floor((lon + 180) * 10), gj = Math.floor((90 - lat) * 10), W = data.win;
		if (Math.abs(((gi - W.gi0 - 128) % 3600 + 5400) % 3600 - 1800) > 110 || Math.abs(gj - W.gj0 - 128) > 110) W.ready = false;
		return { x: p.x, z: p.z, ready: data.cover(lat, lon).then(() => { data.anchor(); anchorUniforms(data.U, data.win); }) };
	}

	// ---------- each frame ----------
	let regionT = 0, regionId = null, veg = null;
	function update(dt, cam, night) {
		const t0 = performance.now();
		frameCheck();
		const x = cam.position.x, z = cam.position.z, ll = toLL(x, z);
		const moving = data.follow(ll.lat, ll.lon);
		if (moving) moving.then(() => anchorUniforms(data.U, data.win)).catch(() => {});
		const out = bayOut(x, z);
		terrain.update(cam, F, { bay: F.bay, bayOut: out, night, cities: towns.lit(12), on: !F.bay || bay.loaded() });
		// the place: its name as you come into it, its plants for the woods (every 2 s)
		regionT -= dt;
		if (regionT <= 0) {
			regionT = 2;
			if (!atlasReady()) loadAtlas().catch(() => {});
			else {
				const R = regionAt(ll.lat, ll.lon);
				veg = R?.land ? R.profile.veg : veg;
				const top = R?.weights?.[0];
				if (R?.land && top && top.w > 0.6 && R.id !== regionId && out > SEAM_A) {
					const was = regionId; regionId = R.id;
					if (was) hint(R.name[0].toUpperCase() + R.name.slice(1), 3500);
				}
			}
		}
		const steady = data.win.ready && !data.win.moving;
		trees.update(cam, veg, steady && (!F.bay || out > SEAM_A - 3000), data.win.version);
		if (steady) towns.update(cam);
		const ms = performance.now() - t0;
		stats.updateMs += (ms - stats.updateMs) * 0.05; stats.maxMs = Math.max(stats.maxMs * 0.995, ms);
	}

	// what the console shows (Crysis.globe())
	function info() {
		const ll = toLL(camera.position.x, camera.position.z);
		return {
			at: `${ll.lat.toFixed(4)}, ${ll.lon.toFixed(4)}`, frame: F.bay ? 'the Bay\'s' : `floating at ${F.lat.toFixed(3)}, ${F.lon.toFixed(3)}`, rebases: stats.rebases,
			ground: Math.round(height.at(camera.position.x, camera.position.z)), region: regionId, towns: towns.info(), trees: trees.count(),
			window: { cell0: [data.win.gi0, data.win.gj0], tiles: data.stats.tiles, composeMs: data.stats.composeMs, decodeMs: Math.round(data.stats.decodeMs), mb: Math.round(data.bytes() / 1e5) / 10 },
			ms: { mean: Math.round(stats.updateMs * 100) / 100, peak: Math.round(stats.maxMs * 10) / 10 },
		};
	}
	function dispose() {
		setFarGround(null);
		BAY_DETAIL_U.uBDAmp.value = 0;
		delete island.flyCeiling;
		if (!F.bay) bayFrame();
		towns.reset();
		for (const g of [terrain.group, trees.group]) { scene.remove(g); g.traverse((o) => { o.geometry?.dispose?.(); }); }
		for (const t of data.tex) t.dispose();
	}
	// finish what is being laid out now, in one go (tests, and after a jump)
	function settle() { trees.settle(); towns.civ().flush(); }
	return { update, place, info, dispose, settle, toLL, toXZ, height, data, terrain, trees, towns, whenReady, frame: F, bayOut };
}
