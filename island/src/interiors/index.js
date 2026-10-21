// Every building a real building. The city's blocks (city.js) are boxes painted with
// windows; the houses, shops and towers near you are already built for real by houses.js,
// commercial.js and towers.js. This does the rest, and keeps them all solid:
//   - any building near you that nothing has built stops you at its walls;
//   - within a few dozen metres, the rest are built inside, one at a time, a slice a
//     frame: San Francisco's row houses and flats over shops (plan.js planRow), the
//     apartment blocks (planApt), and the big plain halls, warehouses, schools, stores,
//     garages and parking decks (planHall). The far block stays where it is, its front door
//     cut out of it and its front windows opened onto the rooms behind them (city.js
//     setDoor); the door swings open as you come to it;
//   - the rooms are furnished (furnish.js), their seats given to the people who live and
//     work there (people/people.js, through venue());
//   - a tall block keeps only the floors round the one you are on fully built, the rest as
//     shells (walls, floors, windows) for the street to see into;
//   - a building is let go once you have walked on, and only so many are kept at once.

import * as THREE from 'three';
import { planRow, planApt, planHall, rng, seedOf, ST } from './plan.js';
import { furnish } from './furnish.js';
import { prepare, buildLevel } from './build.js';
import { houseMaterials, lin } from '../bay/housekit.js';
import { STYLE, sfDistrict } from '../bay/styles.js';
import { crowd, ZONE, kidsAbout } from '../people/flow.js';
import { createWorkplaceNavigation } from '../people/workplace-navigation.js';
import { lightInterior, releaseInterior, configureLighting, lightingClock, lightingMovers } from './lighting.js';
import { profileOf } from '../economy/frontage.js';
import './estab-kit.js';
import { buildSlice, viewDistance } from '../world/buildslice.js';

const SHOPS = { chinatown: ['grocer', 'restaurant', 'grocer', 'boutique', 'restaurant'], mission: ['cafe', 'restaurant', 'laundromat', 'grocer', 'bar', 'florist'], northbeach: ['cafe', 'restaurant', 'bar', 'books'], sunset: ['restaurant', 'cafe', 'laundromat', 'grocer'], any: ['cafe', 'grocer', 'books', 'restaurant', 'laundromat', 'bar', 'florist', 'boutique'] };
// the buildings anyone may walk into (the rest are homes, or shut)
const PUBLIC = new Set(['shop', 'store', 'office', 'school', 'site']);
// the rooms whose air is dusty enough to see the light in (lighting.js draws its beams)
const DUSTY = new Set(['garage', 'garage2', 'warehouse', 'parking', 'shed', 'storage', 'apparatus', 'sallyport', 'depot', 'barn', 'cellhouse', 'casemate', 'bar', 'workshop']);
// the hours a public place keeps its lights on (the rest of the night only a few)
const OPEN = { store: [7, 22], office: [7, 20], school: [7, 18] };
const STYLE_OF = { victorian: 'victorian', pacheights: 'edwardian', nobhill: 'edwardian', northbeach: 'edwardian', chinatown: 'edwardian', marina: 'sunset', sunset: 'sunset', mission: 'mission' };

export function createInteriors(scene, bay, city, { isPhone = false, mats = null, towers = null, night = { value: 0 } } = {}) {
	const BUILD_R = isPhone ? 55 : 85, DROP_R = BUILD_R + 30, MAX = isPhone ? 3 : 6;
	let BUDGET = isPhone ? 3 : 4;
	const fwd = new THREE.Vector3();
	const group = new THREE.Group();
	group.name = 'interiors';
	scene.add(group);
	let M = mats, MW = null;
	const K = city.KIND;
	const live = new Map();         // lot key -> building
	configureLighting({ isPhone });
	const stats = { built: 0, dropped: 0, lastMs: 0, maxSlice: 0, planMs: 0 };

	// ---------- what a lot is, and its plan ----------
	function useOf(o, tall) {
		if (underSite(o) || o.wrecked) return null;          // (a wrecked one is its shell: structures/damage.js)
		if (o.src?.grp || tall.has(o) || o.w < 3.2 || o.d < 3.2 || o.w * o.d > 26000) return null;
		const b = o.src, top = o.y + o.h, g = bay.heightAt(o.x, o.z), hA = top - g;
		if (hA < 2.4) return null;
		if (b) {
			if (b.kind === 7) return 'school';
			if (b.kind === 8) return 'apt';
			if (b.kind === 11) return 'office';
			if (b.kind === 9) return 'warehouse';
			if (b.kind === 10) return o.w * o.d > 10 ? 'shed' : null;
			if (b.kind === 12) return 'parking';
			if (b.kind === 5 || b.kind === 6) return b.kind === 6 ? 'store' : 'office';
			return null;
		}
		const k = o.kind;
		// (a row house that is a business: the business on the ground floor, a flat over it, never
		// bedrooms behind the shop)
		if (k < 0.5) return o.biz && profileOf(o.biz.type).fit ? 'shop' : 'row';
		if (k === K.shop) return 'shop';
		if (k === K.industry) return 'warehouse';
		if (k === K.garage) return 'garage2';
		if (k === K.retail) return 'store';
		if (k === K.office) return 'office';
		if (k === K.tower) return 'office';
		if (k === K.apt) return hA > 5 ? 'apt' : null;
		return null;
	}
	// a mapped block standing where a landmark is built inside (addSite) is the landmark's
	const sites = [];
	const underSite = (o) => sites.some((S) => { if (!S.o) return false; const [lx, lz] = frame(S.o).l(o.x, o.z); return Math.abs(lx) < S.o.w / 2 + 1 && Math.abs(lz) < S.o.d / 2 + 1; });
	// the lot's frame: local (x across, z toward the front) to the world and back
	const frame = (o) => { const ca = Math.cos(o.a), sa = Math.sin(o.a); return { ca, sa, w: (lx, lz) => [o.x + ca * lx - sa * lz, o.z + sa * lx + ca * lz], l: (x, z) => { const dx = x - o.x, dz = z - o.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; } }; };
	function plan(o, use) {
		const F = frame(o), H = bay.heightAt, rnd = rng(seedOf(o.x, o.z, 0x1f2e));
		const W = o.w, D = o.d, top = o.y + o.h, g = H(o.x, o.z);
		const U = bay.urbanAt(o.x, o.z), dist = U.s === STYLE.sunset ? 'sunset' : U.s === STYLE.sf ? sfDistrict(o.x, o.z) : 'modern';
		const style = STYLE_OF[dist] || (use === 'row' || use === 'shop' ? 'edwardian' : 'modern');
		// the ground under it, row by row from the front, the highest across each
		const rows = [];
		for (let z = D / 2 - 0.3; z > -D / 2; z -= 1) { let m = -1e9; for (let i = 0; i <= 4; i++) { const [x, zz] = F.w(-W / 2 + 0.3 + i * (W - 0.6) / 4, z); m = Math.max(m, H(x, zz)); } rows.push([z, m]); }
		const hiAll = Math.max(...rows.map((r) => r[1]));
		let spec, P;
		if (use === 'row' || use === 'shop' || use === 'apt') {
			const garage = use === 'row' && o.kind > 0.05 ? (o.kind < 0.15 ? 'L' : 'R') : null;
			let doorX = use === 'apt' ? 0 : garage === 'R' ? -W / 2 + 1.1 : W / 2 - 1.1;
			let stairSide = null;
			if (use === 'shop') { stairSide = rnd() < 0.5 ? 1 : -1; doorX = -stairSide * Math.min(1.2, W * 0.12); }
			const [dx, dz] = F.w(doorX, D / 2 + 0.6), street = H(dx, dz);
			// the ground floor at the street; up a little where the hill won't have it
			let f0 = Math.max(street + 0.05, rows[0][1] + 0.05);
			const levelsAt = (f) => Math.max(1, Math.floor((top - 0.25 - f - ST.ceil) / ST.storey) + 1);
			const zbOf = (f) => { const out = []; for (let k = 0; k < 8; k++) { const fk = f + k * ST.storey; let zb = -D / 2 + ST.ext; for (const [z, m] of rows) if (m > fk - 0.08) { zb = z + 0.5; break; } out.push(Math.min(D / 2 - ST.ext - 3, zb)); } return out; };
			const need = (n, k) => { const zs = D / 2 - ST.ext - ST.vest; return k < n - 1 ? zs - k * (ST.run + ST.land) - ST.run - ST.land - 0.3 : zs - Math.max(0, n - 2) * (ST.run + ST.land) - ST.run - ST.land - 2.4; };
			let n = levelsAt(f0), zb = zbOf(f0);
			const wide = W >= 10.5;
			const apt = use === 'apt' || (use === 'row' && n >= 4 && wide);
			for (let it = 0; it < 14 && !apt; it++) {
				const reach = Math.min(n, 3);
				if (zb.slice(0, reach).every((v, k) => v <= need(reach, k) + 0.01)) break;
				f0 += 0.3; n = levelsAt(f0); zb = zbOf(f0);
			}
			if (apt) f0 = Math.max(f0, hiAll + 0.08);
			n = Math.min(n, apt ? 14 : 5);
			if (n < 1) return null;
			const winCols = [], winRows = [];
			if (o.kind < 0.5 || o.kind === K.shop) { for (let i = 0; i < Math.floor(W / 2.54 + 1e-6); i++) winCols.push((i + 0.5) * 2.54 - W / 2); }
			for (let k = 0; k < n; k++) { const fk = f0 + k * ST.storey, j = Math.max(0, Math.round((fk - g) / 3.3)); const a = g + j * 3.3 + 0.825 - f0, b = g + j * 3.3 + 2.64 - f0; winRows.push([Math.max(k * ST.storey + 0.3, a), Math.min(k * ST.storey + ST.ceil - 0.1, b)]); }
			// the bay window on its own block, over the front
			let bayLot = null, bayS = null;
			if (!apt) {
				const [fx, fz] = F.w(0, D / 2 + 0.5);
				bayLot = city.lotsNear(fx, fz, 1.5).find((q) => q.kind === K.bay && Math.abs(q.a - o.a) < 0.02 && Math.hypot(q.x - fx, q.z - fz) < 1.2) || null;
				if (bayLot) { const [bx] = F.l(bayLot.x, bayLot.z); bayS = { x0: bx - bayLot.w / 2, x1: bx + bayLot.w / 2, y0: bayLot.y - f0, y1: bayLot.y + bayLot.h - f0 }; }
			}
			spec = { use: apt ? 'apt' : use, W, D, levels: n, reach: 3, doorX, stairSide, garage: !!garage, zb, winCols: winCols.length ? winCols : null, winRows, bay: bayS, shopType: SHOPS[dist]?.[Math.floor(rnd() * (SHOPS[dist]?.length || 1))] || SHOPS.any[Math.floor(rnd() * SHOPS.any.length)], rnd, style, party: !o.src && o.kind < 0.5 };
			// (an apartment block with a business in it: the business on the ground floor, the flats over it)
			const E = o.biz || o.src?.biz;
			spec.shop = apt && !!E && !!profileOf(E.type).fit;
			P = apt ? planApt(spec) : planRow(spec);
			if (garage) P.garage = garage === 'L' ? [-W / 2 + 0.5, -W / 2 + 3.1] : [W / 2 - 3.1, W / 2 - 0.5];
			P.f0 = f0; P.street = street; P.bayLot = bayLot;
		} else {
			const [dx, dz] = F.w(0, D / 2 + 0.6), street = H(dx, dz), f0 = Math.max(street + 0.05, hiAll + 0.05);
			spec = { use, W, D, h: top - 0.3 - f0, doorX: 0, rnd, style: use === 'school' || use === 'office' ? 'modern' : 'plain' };
			P = planHall(spec);
			P.f0 = f0; P.street = street;
		}
		P.style = spec.style;
		// a building the economy made a business (economy/layer.js): its rooms fitted out as one
		const E = o.biz || o.src?.biz;
		if (E) { const fit = profileOf(E.type).fit; if (fit) P.estab = { fit, type: E.type, id: E.id, name: E.name }; }
		furnish(P, 0);
		// steps up to the door from the street, where the floor stands above it
		P.stoop = [];
		const rise = P.f0 - P.street;
		if (rise > 0.22) {
			const n = Math.min(14, Math.ceil(rise / 0.18)), dw = P.door.w + 0.5;
			for (let i = 0; i < n; i++) { const y = rise * (n - i) / (n + 1) - rise, z0 = D / 2 + i * 0.28; P.stoop.push([P.door.x - dw / 2, z0, P.door.x + dw / 2, z0 + 0.28, y]); }
		}
		return P;
	}

	// a landmark's own plan (addSite): its floor, the street at its door, the steps up
	function sitePlan(S) {
		const P = S.plan();
		P.f0 = S.o.f0; P.street = S.o.street ?? S.o.f0;
		P.style = P.style || 'plain';
		furnish(P, 0);
		P.stoop = [];
		const rise = P.f0 - P.street;
		if (rise > 0.22) {
			const n = Math.min(14, Math.ceil(rise / 0.18)), dw = P.door.w + 0.5;
			for (let i = 0; i < n; i++) { const y = rise * (n - i) / (n + 1) - rise, z0 = P.D / 2 + i * 0.28; P.stoop.push([P.door.x - dw / 2, z0, P.door.x + dw / 2, z0 + 0.28, y]); }
		}
		return P;
	}

	// ---------- building one, level by level ----------
	function* make(B) {
		const t0 = performance.now();
		const P = B.site ? sitePlan(B.site) : plan(B.o, B.use);
		stats.planMs = performance.now() - t0;
		if (!P) return null;
		yield;
		B.P = P;
		P.private = P.private ?? !PUBLIC.has(B.use);
		if (!M) M = houseMaterials([-2, -1, 150, 160]);
		// (the houses' materials dissolve past the near band, by the building's middle: a big hall
		// or a landmark's would vanish round you, so these have their own, seen to 150 m)
		B.M = B.site || Math.max(P.W, P.D) > 30 ? (MW || (MW = houseMaterials([-2, -1, 150, 160]))) : M;
		B.C = prepare(P, { outside: B.o.col || [0.85, 0.82, 0.76], litShare: 0.55 });
		if (P.doorColor) B.C.doorC = lin(P.doorColor);
		B.root = new THREE.Group();
		B.root.position.set(B.o.x, P.f0, B.o.z);
		B.root.rotation.y = -B.o.a;
		B.levels = P.levels.map(() => null);
		// the stoop outside
		if (P.stoop.length) {
			const geo = [];
			for (const s of P.stoop) geo.push(new THREE.BoxGeometry(s[2] - s[0], Math.max(0.05, s[4] + 0.6 + (P.f0 - P.street)), s[3] - s[1]).translate((s[0] + s[2]) / 2, s[4] - Math.max(0.05, s[4] + 0.6 + (P.f0 - P.street)) / 2, (s[1] + s[3]) / 2));
			const m = new THREE.Mesh(mergeBoxes(geo), stoneMat());
			m.receiveShadow = true;
			B.root.add(m);
		}
		group.add(B.root);
		yield* levelsFor(B, 0);
		return B;
	}
	// which levels are full: all of a low building's; the one you're on and those either
	// side of it (and the ground floor) of a tall one
	const wantFull = (B, cur) => (k) => B.P.levels.length <= 5 || k === 0 || Math.abs(k - cur) <= (isPhone ? 0 : 1);
	function* levelsFor(B, cur) {
		const want = wantFull(B, cur);
		for (let k = 0; k < B.P.levels.length; k++) {
			const full = want(k), have = B.levels[k];
			if (have && have.full === full) continue;
			if (full && !B.P.rooms.every((r) => r.k !== k || r.furnished)) { furnish(B.P, k); B.spots = null; B.nav = null; yield; }
			const Lb = yield* buildLevel(B.P, B.M || M, B.C, k, full, night);
			// a full level lit by its own fixtures (lighting.js); the shells keep their glow
			if (full) lightInterior(Lb.root, lightSpec(B, k, Lb));
			if (have) { releaseInterior(have.root); B.root.remove(have.root); disposeTree(have.root); }
			B.levels[k] = Lb;
			B.root.add(Lb.root);
			yield;
		}
		B.cur = cur;
	}
	// what the lighting needs of a level: its solid boxes, its rooms (which are lit, which dusty),
	// its floor and ceiling, its hours
	function lightSpec(B, k, Lb) {
		const P = B.P, L = P.levels[k], rooms = P.rooms.filter((r) => r.k === k);
		const roomOf = (x, y, z) => { for (const r of rooms) if (x > r.x0 - 0.05 && x < r.x1 + 0.05 && z > r.z0 - 0.05 && z < r.z1 + 0.05) return r.id; return -1; };
		return {
			id: B.key + ':' + k, occluders: Lb.occ, levels: [[L.y, L.y + L.h]], bounds: [-P.W / 2, -P.D / 2, P.W / 2, P.D / 2],
			rooms: P.rooms.length, roomOf, roomArea: (id) => { const r = P.rooms[id]; return r ? (r.x1 - r.x0) * (r.z1 - r.z0) : 0; },
			// (a landmark's, a hospital's, a station's rooms are all lit: they never close)
			litOf: (id) => B.use === 'site' || !!B.C.lit[id], fixtures: anchorFixtures(P, k), dust: (x, y, z, id) => DUSTY.has(P.rooms[id]?.type),
			home: B.use === 'row' || B.use === 'apt', hours: P.hours || OPEN[B.use] || null,
			// (a home's household to bed by its own late hour: lighting.js keeps one lamp on after)
			bed: B.use === 'row' || B.use === 'apt' ? 22.5 + ((Math.abs(Math.round(B.o.x * 7 + B.o.z * 13)) % 997) / 997) * 3 : null,
			// (a hospital keeps every light on all night; the rest keep their night lights)
			allNight: P.service === 'hospital',
		};
	}
	// the lamps a fit-out left places for (estab-fit.js: pendants over tables and booths, track
	// lights over shelves, a light over the counter), as fixtures
	function anchorFixtures(P, k) {
		return (P.lightAnchors || []).filter((a) => a.level === k).map((a) => a.kind === 'track'
			? { p: [a.x, a.y, a.z], c: [1, 0.9, 0.78], I: 7, shape: 'spot', n: [0, -1, 0], cone: [0.85, 0.55], room: a.room }
			: { p: [a.x, a.y, a.z], c: [1, 0.82, 0.62], I: a.kind === 'pendant' ? 6 : 8, shape: 'down', n: [0, -1, 0], beam: 2, room: a.room });
	}
	function disposeTree(root) { root.traverse((q) => { if (q.isMesh && q.geometry && !q.geometry.userData?.shared) q.geometry.dispose(); }); }
	let stoneM = null;
	const stoneMat = () => stoneM || (stoneM = new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.85 }));
	function mergeBoxes(list) {
		const P = [], N = [];
		for (const g of list) { const n = g.index ? g.toNonIndexed() : g; P.push(...n.attributes.position.array); N.push(...n.attributes.normal.array); g.dispose(); if (n !== g) n.dispose(); }
		const out = new THREE.BufferGeometry();
		out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
		return out;
	}
	function drop(key) {
		const B = live.get(key);
		if (!B) return;
		live.delete(key);
		if (B.root) { for (const Lb of B.levels || []) if (Lb) releaseInterior(Lb.root); group.remove(B.root); disposeTree(B.root); }
		if (B.site) { B.site.live = false; return; }
		city.setDoor(B.o, null);
		if (B.P?.bayLot) city.setDoor(B.P.bayLot, null);
		stats.dropped++;
	}

	// ---------- streaming ----------
	let scanX = 1e9, scanZ = 1e9, scanT = 0, cands = [], job = null, towerKey = null, towerLot = null;
	function update(camera, dt, hours, nightK) {
		night.value = nightK;
		lightingClock(nightK, hours);
		const p = camera.position, x = p.x, z = p.z;
		const high = p.y - (bay.heightAt(x, z) || 0) > 150;
		group.visible = !high;
		if (!bay.loaded() || high) return;
		scanT -= dt;
		if (scanT < 0 || Math.hypot(x - scanX, z - scanZ) > 8) {
			scanT = 0.5; scanX = x; scanZ = z;
			const tall = new Set(city.towersNear?.(x, z, BUILD_R + 40) || []);
			cands = [];
			for (const o of city.lotsNear(x, z, BUILD_R)) {
				const key = city.lotKey(o), B = live.get(key);
				if (B) { B.o = o; B.seen = true; }
				// (built as a home before the town made it a business: built again as one, once you are not in it)
				if (B?.ready && B.use === 'row' && useOf(o, tall) === 'shop' && inside(p)?.B !== B) { drop(key); continue; }
				const use = B ? B.use : useOf(o, tall);
				if (!use) continue;
				const d = Math.max(0, Math.hypot(o.x - x, o.z - z) - Math.max(o.w, o.d) / 2);
				if (d < BUILD_R) cands.push({ d, key, o, use });
			}
			// the landmarks built inside (addSite)
			for (const S of sites) {
				if (!S.ready()) continue;
				const d = Math.max(0, Math.hypot(S.o.x - x, S.o.z - z) - Math.max(S.o.w, S.o.d) / 2);
				if (d < BUILD_R) cands.push({ d, key: S.key, o: S.o, use: 'site', site: S });
			}
			// (the nearest first; of those near alike, the ones you are looking at)
			camera.getWorldDirection(fwd);
			for (const c of cands) c.v = viewDistance(c.d, c.o.x, c.o.z, p, fwd);
			cands.sort((a, b) => a.v - b.v);
			cands.length = Math.min(cands.length, MAX);
			for (const [key, B] of live) {
				const d = Math.max(0, Math.hypot(B.o.x - x, B.o.z - z) - Math.max(B.o.w, B.o.d) / 2);
				if (d > DROP_R || (live.size > MAX && !cands.some((c) => c.key === key))) drop(key);
			}
			// the tower you're at: its front door cut out too (towers.js builds the lobby behind it)
			const tk = towers?.key?.() || null;
			if (tk !== towerKey) {
				if (towerLot) city.setDoor(towerLot, null);
				towerKey = tk; towerLot = null;
				if (tk) {
					towerLot = [...tall].find((o) => Math.round(o.x) + ':' + Math.round(o.z) === tk) || null;
					if (towerLot) { let g0 = -1e9; const F = frame(towerLot); for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) g0 = Math.max(g0, bay.heightAt(...F.w(sx * towerLot.w / 2, sz * towerLot.d / 2))); city.setDoor(towerLot, towers.door?.() || [0, g0 + 0.25 - towerLot.y, 2.8]); }
				}
			}
		}
		// one building at a time, a few milliseconds a frame
		if (job && !live.has(job.key)) job = null;
		if (!job) {
			for (const c of cands) if (!live.has(c.key)) { const B = { key: c.key, o: c.o, use: c.use, site: c.site, ms: 0 }; live.set(c.key, B); job = { key: c.key, B, gen: make(B) }; break; }
			// ...or a tall one's floors, as you climb it
			if (!job) for (const B of live.values()) {
				if (!B.ready || B.P.levels.length <= 5) continue;
				const cur = levelAt(B, p.y - 1.7);
				if (cur !== B.cur) { job = { key: B.key, B, gen: levelsFor(B, cur), climb: true }; break; }
			}
		}
		const t0 = performance.now(), slice = buildSlice(dt, BUDGET);
		while (job && performance.now() - t0 < slice) {
			const t1 = performance.now();
			let r;
			try { r = job.gen.next(); } catch (e) { console.warn('interior', e); r = { done: true, value: null }; }
			const ms = performance.now() - t1;
			job.B.ms += ms; stats.maxSlice = Math.max(stats.maxSlice, ms);
			if (!r.done) continue;
			if (!job.climb) {
				if (!r.value) { live.delete(job.key); live.set(job.key, { key: job.key, o: job.B.o, use: null, dead: true }); }
				else if (r.value.site) { const B = r.value; B.ready = true; B.site.live = true; stats.built++; stats.lastMs = B.ms; }
				else { const B = r.value; B.ready = true; const top = Math.max(0, Math.floor(B.P.f0 - B.o.y + B.P.levels.length * ST.storey - 0.2)); city.setDoor(B.o, [B.P.door.x, B.P.f0 - B.o.y + B.P.door.y, B.P.door.w + 4 * top]); if (B.P.bayLot) city.setDoor(B.P.bayLot, [0, 0, 0.001 + 4 * Math.max(0, Math.floor(B.P.f0 + B.P.levels.length * ST.storey - B.P.bayLot.y - 0.2))]); stats.built++; stats.lastMs = B.ms; }
			}
			job = null;
		}
		// the doors: open as you come to them (you, or anyone walking by), shut behind you
		for (const B of live.values()) {
			if (!B.ready) continue;
			for (const D of B.levels[0]?.doors || []) {
				const [wx, wz] = frame(B.o).w(D.at[0], D.at[2]), d = Math.hypot(wx - x, wz - z), fy = B.P.f0 + D.y0;
				const near = (d < 2.3 && Math.abs(p.y - 1.7 - fy) < 1.8) || (!B.P.private && walkers.some((q) => Math.abs(q.footY - fy) < 1.8 && Math.hypot(q.x - wx, q.z - wz) < 2.3));
				if (!D.manual) D.target = near ? 1 : 0;
				else if (d > 5) D.manual = false;
				if (Math.abs(D.open - D.target) > 1e-3) { D.open += Math.sign(D.target - D.open) * Math.min(Math.abs(D.target - D.open), dt * 1.8); D.apply(); }
			}
		}
		// (the rooms' lamps are lighting.js's: their light baked in, a few real ones near you)
	}
	function levelAt(B, footY) {
		const y = footY - B.P.f0;
		let best = 0;
		for (const L of B.P.levels) if (y > L.y - 1.2) best = L.k;
		return best;
	}

	// ---------- you in them: floors, walls, doors ----------
	const localOf = (B, x, z) => frame(B.o).l(x, z);
	function floor(x, z, y) {
		let best = -1e9;
		for (const B of live.values()) {
			if (!B.ready) continue;
			const [lx, lz] = localOf(B, x, z), P = B.P;
			if (Math.abs(lx) > P.W / 2 + 4 || Math.abs(lz) > P.D / 2 + 5) continue;
			const fy = y - P.f0;
			for (const s of P.stoop) if (lx > s[0] && lx < s[2] && lz > s[1] && lz < s[3] && fy > s[4] - 0.7) best = Math.max(best, P.f0 + s[4]);
			if (Math.abs(lx) > P.hw + 0.05 || lz > P.D / 2 + 0.05) continue;
			for (const L of P.levels) {
				if (!B.levels[L.k] || lz < L.zb - 0.05 || fy < L.y - 0.6) continue;
				if (L.holes.some((h) => lx > h[0] && lx < h[2] && lz > h[1] && lz < h[3])) continue;
				best = Math.max(best, P.f0 + L.y);
			}
			for (const A of P.alcoves) if (lx > A.x0 && lx < A.x1 && lz > A.z0 - 0.3 && lz < A.z1 && fy > A.y - 0.6) best = Math.max(best, P.f0 + A.y);
			for (const f of P.flights) {
				if (!B.levels[f.k]?.full || lx < f.x0 || lx > f.x1) continue;
				const t = (lz - f.zb) * f.dir, run = Math.abs(f.zt - f.zb);
				if (t < 0 || t > run) continue;
				const R = (f.y1 - f.y0) / f.n, T = run / (f.n - 1), sy = Math.min(f.y1, f.y0 + (Math.floor(t / T) + 1) * R);
				if (fy > sy - 0.75) best = Math.max(best, P.f0 + sy);
			}
			for (const Ld of P.landings) if (B.levels[Ld.k]?.full && lx > Ld.x0 && lx < Ld.x1 && lz > Ld.z0 && lz < Ld.z1 && fy > Ld.y - 0.75) best = Math.max(best, P.f0 + Ld.y);
		}
		return best;
	}
	// the ceiling over a body inside one (feet at y): the floor of the level above it, or
	// Infinity (the building's roof is the city's: city.js ceiling)
	function ceiling(x, z, y) {
		let best = Infinity;
		for (const B of live.values()) {
			if (!B.ready) continue;
			const [lx, lz] = localOf(B, x, z), P = B.P;
			if (Math.abs(lx) > P.hw + 0.05 || Math.abs(lz) > P.D / 2 + 0.05) continue;
			const fy = y - P.f0;
			if (fy < -0.6) continue;
			for (const L of P.levels) {
				if (L.y < fy + 0.5 || lz < L.zb - 0.05 || L.holes.some((h) => lx > h[0] && lx < h[2] && lz > h[1] && lz < h[3])) continue;
				best = Math.min(best, P.f0 + L.y - 0.05);
			}
		}
		return best;
	}
	const RAD = 0.3;
	function pushBox(q, b) {
		const qx = Math.max(b[0], Math.min(b[2], q[0])), qz = Math.max(b[1], Math.min(b[3], q[1]));
		const dx = q[0] - qx, dz = q[1] - qz, d2 = dx * dx + dz * dz;
		if (d2 >= RAD * RAD) return false;
		if (d2 < 1e-8) {
			const pen = [q[0] - b[0], b[2] - q[0], q[1] - b[1], b[3] - q[1]], m = Math.min(...pen), k = pen.indexOf(m);
			if (k === 0) q[0] = b[0] - RAD; else if (k === 1) q[0] = b[2] + RAD; else if (k === 2) q[1] = b[1] - RAD; else q[1] = b[3] + RAD;
		} else { const d = Math.sqrt(d2); q[0] = qx + dx / d * RAD; q[1] = qz + dz / d * RAD; }
		return true;
	}
	function push(pos, footY) {
		const claimed = new Set();
		for (const B of live.values()) {
			if (!B.ready) continue;
			claimed.add(B.key);
			if (B.P?.bayLot) claimed.add(city.lotKey(B.P.bayLot));
			const P = B.P, F = frame(B.o), q = F.l(pos.x, pos.z);
			if (Math.abs(q[0]) > P.W / 2 + 1 || Math.abs(q[1]) > P.D / 2 + 2) continue;
			const y0 = footY - P.f0 + 0.25, y1 = footY - P.f0 + 1.7, fy = footY - P.f0;
			let moved = false;
			for (const Lb of B.levels) {
				if (!Lb) continue;
				for (const b of Lb.col) if (!(y1 < b[4] || y0 > b[5]) && pushBox(q, b)) moved = true;
				for (const D of Lb.doors) if (D.open < 0.3 && !(y1 < D.y0 || y0 > D.y0 + 2.2) && pushBox(q, D.box)) moved = true;
			}
			// the stairs are solid under their treads
			for (const f of P.flights) {
				if (!B.levels[f.k]?.full) continue;
				const run = Math.abs(f.zt - f.zb), t = Math.max(0, Math.min(run, (q[1] - f.zb) * f.dir)), R = (f.y1 - f.y0) / f.n, T = run / (f.n - 1);
				const sy = Math.min(f.y1, f.y0 + (Math.floor(t / T) + 1) * R), base = P.levels[f.k].y;
				if (fy < sy - 0.75 && fy > base - 0.5 && pushBox(q, [f.x0, Math.min(f.zb, f.zt), f.x1, Math.max(f.zb, f.zt)])) moved = true;
			}
			for (const Ld of P.landings) if (B.levels[Ld.k]?.full && fy < Ld.y - 0.75 && fy > P.levels[Ld.k].y - 0.5 && pushBox(q, [Ld.x0, Ld.z0, Ld.x1, Ld.z1])) moved = true;
			if (moved) { const [wx, wz] = F.w(q[0], q[1]); pos.x = wx; pos.z = wz; }
		}
		// every other building nothing has built: a solid block
		const tk = towers?.key?.();
		for (const o of city.lotsNear(pos.x, pos.z, 1.5)) {
			if (o.src?.grp?.near || o.wrecked || (tk && Math.round(o.x) + ':' + Math.round(o.z) === tk && towers.inside?.())) continue;
			const top = o.y + o.h;
			if (footY + 0.35 > top || footY + 1.7 < o.y) continue;
			const key = city.lotKey(o);
			if (claimed.has(key) || underSite(o)) continue;
			const F = frame(o), q = F.l(pos.x, pos.z);
			if (pushBox(q, [-o.w / 2, -o.d / 2, o.w / 2, o.d / 2])) { const [wx, wz] = F.w(q[0], q[1]); pos.x = wx; pos.z = wz; }
		}
	}
	function inside(pos) {
		for (const B of live.values()) {
			if (!B.ready) continue;
			const [lx, lz] = localOf(B, pos.x, pos.z), P = B.P;
			if (Math.abs(lx) > P.hw || lz > P.hd || lz < -P.hd) continue;
			const fy = pos.y - 1.7 - P.f0;
			if (fy < -1 || fy > (P.top ?? P.levels.length * ST.storey)) continue;
			return { B, level: levelAt(B, pos.y - 1.7), use: B.use };
		}
		return null;
	}
	function doorNear(cam) {
		let best = null;
		const fx = -Math.sin(cam.rotation.y), fz = -Math.cos(cam.rotation.y);
		for (const B of live.values()) {
			for (const D of B.levels?.[0]?.doors || []) {
				const [wx, wz] = frame(B.o).w(D.at[0], D.at[2]), dx = wx - cam.position.x, dz = wz - cam.position.z, d = Math.hypot(dx, dz);
				if (d > 1.9 || Math.abs(B.P.f0 + D.at[1] - cam.position.y) > 1.6) continue;
				const facing = (dx * fx + dz * fz) / Math.max(d, 1e-3);
				if (d > 0.6 && facing < 0.3) continue;
				if (!best || d - facing < best.s) best = { D, s: d - facing };
			}
		}
		return best && { kind: 'door', open: best.D.target > 0.5, toggle: () => { best.D.manual = true; best.D.target = best.D.target > 0.5 ? 0 : 1; } };
	}
	// who's in: at home in the evening and at night, a few by day; a shop's customers by the hour
	function venue(cam, hours) {
		const h = inside(cam);
		if (!h) return null;
		const B = h.B, P = B.P, lvY = P.levels[h.level].y;
		const home = B.use === 'row' || B.use === 'apt';
		// (a home's own household is in it: people/home-life.js)
		if (B.lived && (home || (B.use === 'shop' && h.level > 0))) return null;
		const k = B.use === 'shop' && h.level === 0 ? crowd(ZONE.retail, hours).k : home ? (hours > 18 || hours < 8 ? 0.75 : 0.35) : B.use === 'school' ? (hours > 8 && hours < 15.5 ? 0.9 : 0.02) : B.use === 'office' ? crowd(ZONE.office, hours).k : B.use === 'store' ? crowd(ZONE.retail, hours).k : B.use === 'site' ? (hours > (P.hours?.[0] ?? 9.5) && hours < (P.hours?.[1] ?? 16.5) ? 0.6 : 0) : 0.2;
		if (!B.spots) {
			const F = frame(B.o);
			B.spots = P.seats.map((s) => { const [wx, wz] = F.w(s.x, s.z), wfx = F.ca * s.fx - F.sa * s.fz, wfz = F.sa * s.fx + F.ca * s.fz; return { x: wx, z: wz, y: P.f0 + s.y, ly: s.y, h: s.h, sit: s.sit, heading: Math.atan2(wfx, wfz), taken: false, table: !!s.table, work: s.work }; });
		}
		const seats = B.spots.filter((s) => Math.abs(s.ly - lvY) < 0.5);
		// a workplace's seats (a ward, a station's desks): their people walk their rounds on the
		// floor's own paths (people/workplace-routine.js), and its roster says who is on now
		if (seats.some((s) => s.work)) navFor(B, h.level, seats);
		if (P.roster) {
			const list = P.roster(hours, seats, h.level) || [];
			const m = Math.min(isPhone ? 7 : 12, list.length);
			return m ? { n: m, kids: 0, zone: P.zone, key: B.key + ':' + h.level, areas: [{ w: 1, seats: list }] } : null;
		}
		const n = Math.min(isPhone ? 6 : 10, Math.round(seats.length * k * 0.5));
		return n ? { n, kids: home ? 0.3 * kidsAbout(hours) : B.use === 'school' ? 0.8 : 0.1 * kidsAbout(hours), areas: [{ w: 1, seats }] } : null;
	}
	// one route grid per furnished level, from its solid boxes, in the building's frame
	function navFor(B, k, seats) {
		B.nav = B.nav || [];
		if (B.nav[k] || !B.levels[k]?.full) return;
		const P = B.P, L = P.levels[k], F = frame(B.o);
		const solids = B.levels[k].col.filter((c) => c[5] > L.y + 0.2 && c[4] < L.y + 2).map((c) => [c[0], c[1], c[2], c[3], c[4] - L.y, c[5] - L.y]);
		const nav = createWorkplaceNavigation({ width: P.W, depth: P.D, solids, holes: L.holes.map((q) => ({ x0: q[0], z0: q[1], x1: q[2], z1: q[3] })),
			toLocal: (q) => { const [x, z] = F.l(q.x, q.z); return { x, z }; },
			toWorld: (q) => { const [x, z] = F.w(q.x, q.z); return { x, z }; } });
		nav.spots = seats;
		for (const st of seats) if (st.work) st.navigation = nav;
		B.nav[k] = nav;
	}
	function info() {
		let verts = 0, bytes = 0, meshes = 0, levels = 0;
		for (const B of live.values()) B.root?.traverse((q) => { if (q.isMesh) { meshes++; const a = q.geometry.attributes; verts += a.position.count; for (const k in a) bytes += a[k].array.byteLength; } });
		for (const B of live.values()) levels += (B.levels || []).filter(Boolean).length;
		return { live: [...live.values()].filter((B) => B.ready).length, building: !!job, cands: cands.length, levels, meshes, verts, geoMB: +(bytes / 1048576).toFixed(2), ...stats, list: [...live.values()].filter((B) => B.P).map((B) => ({ use: B.use, x: +B.o.x.toFixed(1), z: +B.o.z.toFixed(1), a: +B.o.a.toFixed(3), w: B.o.w, d: B.o.d, levels: B.P.levels.length, f0: +B.P.f0.toFixed(2), style: B.P.style, ms: +B.ms.toFixed(1), rooms: B.P.rooms.map((r) => r.type).join(',') })) };
	}
	// in front of the nearest building of a kind, facing its door (for looking round and tests)
	function goTo(P, use, idx = 0, roomType = null) {
		const list = [...live.values()].filter((B) => B.ready && (!use || B.use === use) && (!roomType || B.P.rooms.some((r) => r.type === roomType)));
		const B = list[idx % Math.max(1, list.length)];
		if (!B) return null;
		const F = frame(B.o);
		if (roomType) {
			// inside, in the far corner of the room, looking across it
			const r = B.P.rooms.find((q) => q.type === roomType), L = B.P.levels[r.k];
			const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, lx = r.x0 + 0.5 + (r.x1 - r.x0 - 1) * 0.15, lz = r.z0 + 0.5 + (r.z1 - r.z0 - 1) * 0.12;
			const [x, z] = F.w(lx, lz), [tx, tz] = F.w(cx + (cx - lx) * 0.5, cz + (cz - lz) * 0.5);
			P.flying = false; P.vel?.set(0, 0, 0);
			P.pos.set(x, B.P.f0 + L.y + 1.68, z);
			P.yaw = Math.atan2(-(tx - x), -(tz - z)); P.pitch = -0.12;
			return { use: B.use, room: r.type, level: r.k, style: B.P.style };
		}
		const [x, z] = F.w(B.P.door.x, B.P.D / 2 + 3.2), [dx, dz] = F.w(B.P.door.x, 0);
		P.flying = false; P.vel?.set(0, 0, 0);
		P.pos.set(x, Math.max(B.P.street, bay.heightAt(x, z)) + 1.7, z);
		P.yaw = Math.atan2(-(dx - x), -(dz - z)); P.pitch = 0;
		return { use: B.use, style: B.P.style, levels: B.P.levels.length };
	}
	// ---------- the people walking about: their doors ----------
	// walkers(list): where the townspeople and hikers are this frame ([{ x, z, footY }]); a
	// public building's doors open for them as for you. doorsNear(x, z, r): the doors a walker
	// may use, the public buildings' only (shops, stores, offices, schools, the visitor
	// centre...), and those of any other source added with addDoors({ doorsNear, walkers })
	let walkers = [];
	const sources = [];
	function setWalkers(list) { walkers = list || []; lightingMovers(walkers); for (const s of sources) s.walkers?.(walkers); }
	function doorsNear(x, z, r = 40) {
		const out = [];
		for (const B of live.values()) {
			if (!B.ready || !PUBLIC.has(B.use) || B.P.private || Math.hypot(B.o.x - x, B.o.z - z) > r + Math.max(B.o.w, B.o.d) / 2) continue;
			const F = frame(B.o), fw = B.P.walls.find((w) => w.k === 0 && w.kind === 'ext' && w.axis === 'x' && w.out > 0);
			for (const D of B.levels[0]?.doors || []) {
				const [dx, dz] = F.w(D.at[0], D.at[2]), [ix, iz] = F.w(D.at[0], (fw ? fw.pos : D.at[2]) - 1.4), [ox, oz] = F.w(D.at[0], D.at[2] + 1.6);
				const nx = -F.sa, nz = F.ca;
				out.push({ x: dx, z: dz, y: B.P.f0 + D.y0, heading: Math.atan2(nx, nz), nx, nz, inside: { x: ix, z: iz }, outside: { x: ox, z: oz, y: B.P.street ?? B.P.f0 }, use: B.use, B });
			}
		}
		for (const s of sources) for (const d of s.doorsNear?.(x, z, r) || []) out.push(d);
		return out;
	}
	// (budget: milliseconds a frame for building; tests on a slow machine give it more)
	// a building's rooms let go now (structures/: it was wrecked, or put right and to be built afresh)
	const release = (o) => { const k = city.lotKey(o); if (live.has(k)) { if (job?.key === k) job = null; drop(k); scanT = -1; } };
	// where the lamps of a business's rooms would hang (estab-fit.js anchors: pendants over the
	// counter and the tables, heat lamps over the pass, track over the shelves), in the world, for
	// whatever lights the rooms
	const lightAnchors = () => { const out = []; for (const B of live.values()) { if (!B.ready || !B.P.lightAnchors) continue; const F = frame(B.o); for (const a of B.P.lightAnchors) { const [x, z] = F.w(a.x, a.z); out.push({ ...a, x, z, y: B.P.f0 + a.y, building: B.key, estab: B.P.estab?.id || null }); } } return out; };
	// where the signs inside the businesses hang (estab-fit.js K.sign: the grocers' aisle markers),
	// in the world, the way each faces, and the business
	const signAnchors = () => { const out = []; for (const B of live.values()) { if (!B.ready || !B.P.signAnchors) continue; const F = frame(B.o); for (const a of B.P.signAnchors) { const [x, z] = F.w(a.x, a.z), [x2, z2] = F.w(a.x + (a.nx || 0), a.z + (a.nz || 0)); out.push({ ...a, x, z, y: B.P.f0 + a.y, nx: x2 - x, nz: z2 - z, building: B.key, estab: B.P.estab?.id || null, type: B.P.estab?.type || a.fit || '' }); } } return out; };
	return { group, update, floor, push, ceiling, inside, doorNear, venue, info, goTo, live, frame, release, lightAnchors, signAnchors, walkers: setWalkers, doorsNear, addDoors: (src) => sources.push(src), addSite: (S) => { sites.push(S); scanT = -1; }, budget: (ms) => { BUDGET = ms; } };
}
