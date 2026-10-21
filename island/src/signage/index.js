// Environmental graphics for the whole engine: the signs, decals, stickers, posters, tags and
// grime of a place, decided by context (placement.js), drawn into one atlas (faces.js,
// graffiti.js, pictograms.js), laid on their surfaces in the right order (layers.js) in their
// own materials (materials.js), a handful of instanced draws for the region round you.
//
//   const S = createSignage({ scene, world, isPhone, locate, morality, day });
//   S.update(dt, camera, night, driving);           // each frame: cheap unless a rebuild is due
//   S.add('my-system:42', records);                 // place records of your own (see placement.js)
//   S.storefront('shop:7', biz, front, { glass });  // a shop's door and window decals
//   S.remove('my-system:42');
//   S.info()                                        // counts, atlas use, what is where
//
// What it reads: the mapped and grown streets (bay/realcity.js), the businesses and their
// fronts (economy/layer.js), the built shops and their aisles (bay/commercial.js), the
// freeways' walls, piers and bridge faces (bay/freeways.js), the alleys' doors and bins
// (structures/alleys.js), the bus shelters (bay/streetlife.js), the hospitals
// (services/), the crews rebuilding (structures/rebuild.js) and the region's morality
// (people/moral-regions.js through npc-quests). The cars' plates, stickers and liveries ride
// on the fleets (signage/cars.js).
//
// A phone gets a quarter-size atlas, a smaller radius, half the caps and fewer small decals.
// Everything streams with the region and is let go when it is rebuilt or disposed.

import * as THREE from 'three';
import { createAtlas, faceKey } from './atlas.js';
import { createBatch } from './batch.js';
import { SIGN_U, clearMaterials } from './materials.js';
import { LAYER } from './layers.js';
import { systemFor } from './systems.js';
import { streetSigns, freewaySigns, storefrontDecals, backDoorDecals, graffitiFor, grimeFor, constructionSigns, MAT, BACK } from './placement.js';
import { hash01, hash32, rng, pick } from './rand.js';
import { localeAt } from '../economy/establishments.js';
import { routeOf, DEST } from '../bay/freeways.js';
import { setFleetDecals } from '../vehicles/fleet.js';
import { createFleetDecals, setCarLocale } from './cars.js';
import { qualityNow, onQuality } from '../world/governor.js';
import { gridStreets } from './gridstreets.js';
import { BLOCKS, toGrid, fromGrid } from '../bay/styles.js';
import { requestsNear } from '../economy/requests.js';
import { shopCampaigns, wallCampaign } from './campaigns.js';
import { productBrand } from './brand-catalog.js';
import { buildingArtSurfaces, wreckedHost } from '../civic/placement.js';
import { graffitiGraphic } from '../civic/graffiti-catalog.js';
import { artRevision } from './art.js';

const CAPS = { retro: 900, vinyl: 1400, cloth: 80, glass: 900, paper: 500, foil: 320, paint: 900, grime: 900 };
const ITEMS = {
	grocer: [['Produce', 'Fruit', 'Vegetables'], ['Bread', 'Cereal', 'Coffee'], ['Canned Goods', 'Soup', 'Pasta'], ['Dairy', 'Eggs', 'Cheese'], ['Snacks', 'Chips', 'Soda'], ['Frozen', 'Ice Cream'], ['Baking', 'Spices', 'Oil'], ['Household', 'Paper', 'Cleaning']],
	pharmacy: [['Cold & Flu', 'Pain Relief'], ['Vitamins', 'First Aid'], ['Baby', 'Personal Care'], ['Cosmetics', 'Hair Care'], ['Snacks', 'Drinks']],
	hardware: [['Fasteners', 'Nails', 'Screws'], ['Paint', 'Brushes'], ['Plumbing', 'Pipe'], ['Electrical', 'Lighting'], ['Garden', 'Hoses'], ['Tools', 'Hand Tools']],
	any: [['New Arrivals'], ['Gifts', 'Cards'], ['Home', 'Kitchen'], ['Books', 'Stationery'], ['Seasonal'], ['Sale', 'Clearance']],
};
const DEPT = { grocer: ['PRODUCE · DELI', 'cart', '#7a2a1c'], pharmacy: ['PHARMACY', 'hospital', '#1d4f9c'], hardware: ['TOOLS & PAINT', 'worker', '#a8501c'], any: ['WELCOME', 'info', '#2a3a4a'] };

export function createSignage({ scene, world, isPhone = false, locate = null, morality = () => ({}), day = () => Math.floor(Date.now() / 86400000) } = {}) {
	let openRequests = [];
	const group = new THREE.Group();
	group.name = 'signage';
	scene.add(group);
	const R0 = isPhone ? 260 : 420, SHOP_R = isPhone ? 110 : 170, IN_R = isPhone ? 30 : 55;
	const atlas = createAtlas({ size: isPhone ? 1024 : 2048, name: 'signage', scale: isPhone ? 0.55 : 1 });
	const batches = new Map();
	const batchOf = (mat, layer) => {
		const k = mat + ':' + layer;
		let B = batches.get(k);
		if (!B) { B = createBatch(group, mat, layer, atlas.tex, Math.floor((CAPS[mat] || 600) * (isPhone ? 0.5 : 1)), { phone: isPhone, name: mat }); batches.set(k, B); }
		return B;
	};
	// the posts, the totems' slabs and the gantries' steel
	const steel = new THREE.MeshStandardMaterial({ color: 0x9a9fa3, roughness: 0.45, metalness: 0.7, name: 'signage-steel' });
	const slabMat = new THREE.MeshStandardMaterial({ color: 0x1e2726, roughness: 0.6, metalness: 0.3, name: 'signage-slab' });
	const postGeo = new THREE.CylinderGeometry(0.032, 0.036, 1, 7).translate(0, 0.5, 0);
	const slabGeo = new THREE.BoxGeometry(0.82, 1, 0.16).translate(0, 0.5, 0);
	const POST_CAP = isPhone ? 500 : 1300, SLAB_CAP = 64;
	const posts = new THREE.InstancedMesh(postGeo, steel, POST_CAP), slabs = new THREE.InstancedMesh(slabGeo, slabMat, SLAB_CAP);
	for (const m of [posts, slabs]) { m.count = 0; m.frustumCulled = false; m.castShadow = !isPhone; m.receiveShadow = true; group.add(m); }
	let gantryMesh = null;
	// the cars' decals ride on the fleets
	setFleetDecals((g, o) => createFleetDecals(g, o));
	const offQuality = onQuality(() => { dirty = true; });

	const extra = new Map();                         // owner -> records placed by other systems
	const glassOf = new Map(), glassAt = new Map();  // owner -> a shop's glass decals { x, z, recs }; where -> owner
	const posKey = (x, z) => Math.round(x) + ':' + Math.round(z);
	let boundSF = null, lastOut = [], forceHead = false, checkT = 0, at = { x: 1e9, z: 1e9 }, keyNow = '', sys = systemFor('us-ca'), locale = 'us-ca', last = { records: 0, ms: 0, posts: 0 }, dirty = true, disposed = false;
	let cityLots = null, surfaceHosts = [], hostState = '';
	const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _f = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
	const _bd = new THREE.Vector3(), _bq = new THREE.Quaternion(), _bz = new THREE.Vector3(0, 0, 1);

	const W = () => world?.();
	const ground = (x, z) => { const I = W()?.island; return I?.drawnAt ? I.drawnAt(x, z) : I?.heightAt?.(x, z) ?? 0; };
	function moralNow() {
		try {
			const w = morality?.() || {};
			const s = w.situation || w, tally = w.region?.tally;
			return { trouble: s.trouble ?? 0.3, means: s.means ?? 0.5, law: tally ? Math.max(-1, Math.min(1, (tally.law || 0) / 50)) : 0 };
		} catch { return { trouble: 0.3, means: 0.5, law: 0 }; }
	}

	// ---------- the region's records ----------
	function gather(cx, cz) {
		const w = W(), real = w?.real;
		// (the quality governor's tier: a nearer reach and fewer small decals when it steps down)
		const Q = qualityNow() || {}, R = Math.max(160, R0 * (Q.far ?? 1)), lite = isPhone || (Q.people ?? 1) < 0.6;
		const out = [], postList = [], gantries = [], slabList = [], surfaces = [], storefronts = [];
		if (!real?.loaded?.()) return { out, postList, gantries, slabList };
		const ll = locate?.(cx, cz);
		locale = ll ? localeAt(ll.lat, ll.lon) : 'us-ca';
		sys = systemFor(locale);
		setCarLocale(locale);
		const seed = hash32(locale);
		const landAt = (x, z) => real.landAt?.(x, z);
		const near = (x, z, r) => Math.hypot(x - cx, z - cz) < r;
		// (the mapped streets, and the procedural grid towns' own: named here, gridstreets.js)
		const roads = real.near('roads', cx, cz, R).concat(w.bayArea?.urbanAt ? gridStreets(cx, cz, Math.min(R, 360), { urbanAt: (x, z) => w.bayArea.urbanAt(x, z), inside: (x, z) => real.inside?.(x, z), BLOCKS, toGrid, fromGrid }) : []);
		const lots = (w.city?.nearList?.() || []).filter((o) => o && near(o.x, o.z, R + 80));
		const schools = lots.filter((o) => o.src?.kind === 7).map((o) => ({ x: o.x, z: o.z }));
		// the streets
		const ST = streetSigns(roads, sys, { landAt, schools, seed, phone: isPhone });
		out.push(...ST.signs); postList.push(...ST.posts);
		// the freeways
		const mk = w.freeways?.marks?.() || {};
		const FW = freewaySigns(roads, sys, { faces: (mk.faces || []).filter((f) => near(f.x, f.z, R)), decks: mk.crossings || [], route: routeOf, dest: (num, dir) => DEST[+num]?.[dir]?.replace('  ', ' · '), seed });
		out.push(...FW.signs); postList.push(...FW.posts); gantries.push(...FW.gantries);
		// the shops' doors and windows: the built shop's real glass where it stands, else the face
		const plan = w.city?.economy?.plan?.() || [], built = w.commercial?.list?.() || [];
		const builtAt = (x, z) => built.find((q) => Math.hypot(q.x - x, q.z - z) < 3);
		let campaigns=0, murals=0;
		const posted = new Set();
		for (const E of plan) {
			if (!E.front || !near(E.x, E.z, SHOP_R)) continue;
			const B = builtAt(E.x, E.z);
			let front = E.front, glass = E.use === 'shop' || E.use === 'row' || E.use === 'retail' || E.use === 'apt';
			if (B && B.glassZ !== undefined) {
				const ca = Math.cos(B.a), sa = Math.sin(B.a);
				front = { x: B.x - sa * B.glassZ, z: B.z + ca * B.glassZ, nx: -sa, nz: ca, run: B.hw * 2, g: B.y, door: B.doorX, height: B.ceil ?? 3.5 };
				glass = true;
			} else if (glassAt.has(posKey(E.x, E.z))) {
				// (its display window drawn by the storefronts: the decals on that glass, at its door)
				const G = glassOf.get(glassAt.get(posKey(E.x, E.z)));
				front = G.front; glass = G.glass; posted.add(G);
			}
			out.push(...storefrontDecals({ ...E, x: E.x, z: E.z, request: openRequests.some(q => q.giver.id === E.id) }, front, sys, { seed, glass }));
			if(campaigns<(lite?8:20)){const C=shopCampaigns(E,front,{phone:lite});out.push(...C.signs);postList.push(...C.posts);if(C.signs.length)campaigns++;}
			storefronts.push({ x: E.front.x, z: E.front.z, nx: E.front.nx, nz: E.front.nz, run: E.front.run });
			if (landAt(E.front.x, E.front.z)?.lu === 7 && hash01(E.x, E.z, 'gum') < 0.35) surfaces.push({ kind: 'ground', x: front.x + front.nx * 2.2, z: front.z + front.nz * 2.2, nx: front.nx, nz: front.nz, w: 2, gum: 1 });
		}
		for (const [, recs] of extra) for (const r of recs) if (near(r.x, r.z, R)) out.push(r);
		// the storefronts' own display windows (economy/storefront.js): on the shop glass itself,
		// unless the shop is built for real near you (its own glass then, above)
		for (const [, G] of glassOf) if (!posted.has(G) && near(G.x, G.z, SHOP_R) && !builtAt(G.x, G.z)) out.push(...storefrontDecals(G.biz, G.front, sys, { seed, glass: G.glass }));
		// inside the built shops: aisle markers, the department over the back wall, shelf tags
		for (const B of built) {
			if (B.type !== 'shop' || !B.aisles?.length || !near(B.x, B.z, IN_R)) continue;
			const E = plan.find((q) => Math.hypot(q.x - B.x, q.z - B.z) < 3);
			const t = /grocer|market|general|food/.test(E?.type || '') ? 'grocer' : /pharm|chem/.test(E?.type || '') ? 'pharmacy' : /hardware|tool/.test(E?.type || '') ? 'hardware' : 'any';
			out.push(...interiorRecords(B, t, lite));
		}
		// ...and the grocers built inside (interiors/: the flats over shops, the halls): the aisle
		// markers hung over the aisles between their gondolas, numbered from the door
		for (const A of w.interiors?.signAnchors?.() || []) {
			if (A.kind !== 'aisle' || !near(A.x, A.z, IN_R)) continue;
			const t = /pharm|chem/.test(A.type) ? 'pharmacy' : /hardware|tool/.test(A.type) ? 'hardware' : A.fit === 'general' && !/grocer|market|food/.test(A.type) ? 'any' : 'grocer';
			const items = ITEMS[t], l = Math.hypot(A.nx, A.nz) || 1, col = pick(rng(hash32(String(A.building), 'aisle')), ['#1c6b3a', '#1d4f9c', '#7a2a1c', '#2a3a4a', '#a8501c']);
			out.push({ mat: MAT.vinyl, layer: LAYER.poster, face: { k: 'aisle', n: A.n, items: items[(A.n - 1) % items.length], col }, x: A.x, z: A.z, abs: A.y, nx: A.nx / l, nz: A.nz / l, w: 1.1, h: 0.38, back: BACK.readable, wear: 0 });
		}
		// the rules at the city parks' entrances, on their boards (bay/parkkit.js)
		for (const P of w.parks?.rulesBoards?.(cx, cz, R) || []) out.push({ mat: MAT.vinyl, layer: LAYER.poster, face: { k: 'parkrules', name: P.name }, x: P.x, z: P.z, abs: P.y, nx: P.nx, nz: P.nz, w: P.w, h: P.h, back: BACK.none, wear: 0.12 });
		// the alleys: the back doors' signs; the walls and bins for the writers and the grime
		for (const r of roads) {
			if (!r.alley) continue;
			for (const d of r.alley.doors) {
				const [x, z, yaw, b] = d;
				if (!near(x, z, R)) continue;
				out.push(...backDoorDecals(d, sys, { seed, name: b?.biz?.name || '' }));
				const nx = Math.sin(yaw), nz = Math.cos(yaw), food = /cafe|restaurant|diner|pizza|bakery|bar|pub|taco|ramen|grill|burger|curry|noodle|sushi/.test(b?.biz?.type || '');
				const tx = nz, tz = -nx, off = 2.6 + hash01(x, z, 'off') * 1.5;
				surfaces.push({ kind: 'alley', x: x + tx * off + nx * 0.03, z: z + tz * off + nz * 0.03, y: ground(x, z), nx, nz, w: 4, h: Math.min(6, (b?.h || 6) - 0.4), kitchen: food, lu: landAt(x, z)?.lu });
			}
			for (const [bx, bz, yaw] of r.alley.bins) {
				if (!near(bx, bz, R * 0.7)) continue;
				const tx = Math.cos(yaw), tz = -Math.sin(yaw), g = ground(bx, bz);
				for (const s of [1, -1]) surfaces.push({ kind: 'dumpster', x: bx + tx * s * 0.556, z: bz + tz * s * 0.556, y: g + 0.16, nx: tx * s, nz: tz * s, w: 1.8, h: 0.95, lu: landAt(bx, bz)?.lu });
				surfaces.push({ kind: 'ground', x: bx + Math.sin(yaw) * 1.4, z: bz + Math.cos(yaw) * 1.4, nx: 0, nz: 1, w: 1, gum: 0, oil: true });
			}
		}
		// the construction sites
		for (const S of w.structures?.rebuild?.sites?.values?.() || []) {
			const o = S.o;
			if (!o || !near(o.x, o.z, R)) continue;
			const C = constructionSigns({ x: o.x, z: o.z, w: o.w, d: o.d, a: o.a || 0 }, sys, { seed });
			out.push(...C.signs); postList.push(...C.posts);
		}
		// the bus stops: the flag on its post, the map on the shelter's panel, gum about
		for (const s of w.street?.seatsNear?.(cx, cz, R * 0.8) || []) {
			if (s.kind !== 'shelter') continue;
			const c = Math.cos(s.heading), sn = Math.sin(s.heading), L = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
			const [mx, mz] = L(1.1, -0.62), [px, pz] = L(2.3, 0.55);
			const routes = [1, 2, 3].slice(0, 1 + Math.floor(hash01(s.x, s.z, 'rt') * 3)).map((i) => 10 + Math.floor(hash01(s.x, s.z, i) * 80));
			out.push({ mat: MAT.paper, layer: LAYER.poster, face: { k: 'transitmap', seed: hash32(Math.round(s.x / 500), Math.round(s.z / 500)) % 999 }, x: mx, z: mz, hy: 1.2, base: s.y, nx: sn, nz: c, w: 1.1, h: 1.6, back: BACK.mirrored, wear: 0.1 });
			for (const sd of [1, -1]) out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'busstop', sys: sys.id, routes, name: '' }, x: px + c * sd * 0.01, z: pz - sn * sd * 0.01, hy: 2.35, nx: c * sd, nz: -sn * sd, w: 0.45, h: 0.62, back: BACK.blank, wear: 0.15 });
			postList.push({ x: px, z: pz, h: 2.7, kind: 'post' });
			surfaces.push({ kind: 'ground', x: s.x + sn * 1.2, z: s.z + c * 1.2, nx: sn, nz: c, w: 3, gum: 3 });
		}
		// the hospital: EMERGENCY at its front by the street, H and an arrow at the junctions near
		for (const F of w.services?.list?.() || []) {
			if (F.kind !== 'hospital' || !near(F.x, F.z, R + 300)) continue;
			const sw = real.sidewalk?.(F.x, F.z);
			if (sw && near(sw[0], sw[1], R)) {
				let nx = sw[0] - F.x, nz = sw[1] - F.z; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
				out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'hospital', line: 'EMERGENCY' }, x: sw[0] - nx * 1.2, z: sw[1] - nz * 1.2, hy: 2.0, nx, nz, w: 1.8, h: 0.6, back: BACK.blank, wear: 0 });
				postList.push({ x: sw[0] - nx * 1.25 - nz * 0.7, z: sw[1] - nz * 1.25 + nx * 0.7, h: 2.3, kind: 'post' }, { x: sw[0] - nx * 1.25 + nz * 0.7, z: sw[1] - nz * 1.25 - nx * 0.7, h: 2.3, kind: 'post' });
			}
			const js = ST.junctions.map((J) => [Math.hypot(J.x - F.x, J.z - F.z), J]).filter(([d]) => d > 40 && d < 320).sort((a, b) => a[0] - b[0]).slice(0, 2);
			for (const [, J] of js) {
				let hx = F.x - J.x, hz = F.z - J.z; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
				// (the leg whose traffic is heading the hospital's way: its signs face back down it)
				const L = J.legs.reduce((b, q) => (q.ux * -hx + q.uz * -hz > b.ux * -hx + b.uz * -hz ? q : b), J.legs[0]);
				const [rx, rz] = [L.uz, -L.ux], d = L.hw + 0.8, along = Math.max(...J.legs.map((q) => q.hw)) + 9;
				const x = J.x + L.ux * along + rx * d * (sys.side === 'left' ? -1 : 1), z = J.z + L.uz * along + rz * d * (sys.side === 'left' ? -1 : 1);
				// the arrow, as the driver coming in sees it
				const ahx = -L.ux, ahz = -L.uz, rgx = -ahz, rgz = ahx;
				const ang = Math.atan2(-(hx * ahx + hz * ahz), hx * rgx + hz * rgz);
				out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'hospital', line: 'HOSPITAL', arrow: Math.round(ang / (Math.PI / 4)) * (Math.PI / 4) }, x, z, hy: 2.9, nx: L.ux, nz: L.uz, w: 1.5, h: 0.42, back: BACK.blank, wear: 0 });
				postList.push({ x: x - L.ux * 0.04, z: z - L.uz * 0.04, h: 3.15, kind: 'post' });
			}
		}
		// wayfinding totems at the downtown corners: where the nearest places are, and how far
		for (const J of ST.junctions) {
			if (!near(J.x, J.z, R * 0.75) || landAt(J.x, J.z)?.lu !== 7 || hash01(Math.round(J.x), Math.round(J.z), seed, 'totem') > 0.14 || J.legs.length < 3) continue;
			const a = J.legs[0], b = J.legs[1];
			let bx = a.ux + b.ux, bz = a.uz + b.uz; const bl = Math.hypot(bx, bz) || 1; bx /= bl; bz /= bl;
			const d = Math.max(a.hw, b.hw) + 3.2, x = J.x + bx * d, z = J.z + bz * d, nx = -bx, nz = -bz;
			const ahx = bx, ahz = bz, rgx = -ahz, rgz = ahx;
			const items = (w.city?.economy?.near?.(x, z, 900) || []).filter((E) => Math.hypot(E.x - x, E.z - z) > 60).filter((E, i, all) => all.findIndex((q) => q.label === E.label) === i).slice(0, 6).map((E) => {
				const dx = E.x - x, dz = E.z - z, l = Math.hypot(dx, dz) || 1;
				return { name: E.name, min: Math.max(1, Math.round(l / 80)), a: Math.round(Math.atan2(-(dx * ahx + dz * ahz) / l, (dx * rgx + dz * rgz) / l) / (Math.PI / 4)) * (Math.PI / 4) };
			});
			if (items.length < 3) continue;
			const yaw = Math.atan2(nx, nz);
			slabList.push({ x, z, h: 2.3, yaw });
			for (const s of [1, -1]) out.push({ mat: MAT.vinyl, layer: LAYER.poster, face: { k: 'totem', title: 'DOWNTOWN', items: s > 0 ? items : items.map((q) => ({ ...q, a: q.a + Math.PI })) }, x: x + nx * s * 0.085, z: z + nz * s * 0.085, hy: 1.2, nx: nx * s, nz: nz * s, w: 0.74, h: 2.1, back: BACK.none, wear: 0.05 });
		}
		// the writers' and the weather's surfaces
		for (const q of mk.walls || []) if (near(q.x, q.z, R)) surfaces.push({ kind: 'soundwall', ...q, lu: landAt(q.x - q.nx * 25, q.z - q.nz * 25)?.lu ?? 1 });
		for (const q of mk.abutments || []) if (near(q.x, q.z, R)) surfaces.push({ kind: 'abutment', ...q, lu: landAt(q.x, q.z)?.lu ?? 7 });
		for (const q of mk.piers || []) {
			if (!near(q.x, q.z, R)) continue;
			const tx = q.nz, tz = -q.nx;
			for (const [nx, nz] of [[q.nx, q.nz], [-q.nx, -q.nz], [tx, tz], [-tx, -tz]]) surfaces.push({ kind: 'pier', x: q.x + nx * 0.66, z: q.z + nz * 0.66, y: q.y, nx, nz, w: 1.3, h: Math.max(2, q.h), lu: landAt(q.x, q.z)?.lu ?? 7 });
		}
		const fronted = (x, z, nx, nz) => storefronts.some((F) => Math.abs((x - F.x) * F.nx + (z - F.z) * F.nz) < 1.5 && Math.abs((x - F.x) * F.nz - (z - F.z) * F.nx) < F.run / 2 + 0.5 && nx * F.nx + nz * F.nz > 0.8);
		const walls=buildingArtSurfaces(lots,{x:cx,z:cz,radius:R,ground,landAt,fronted,cap:lite?64:128});
		surfaces.push(...walls);
		surfaceHosts=lots.filter(o=>o&&(o.kind===5||o.src?.kind===9)).slice(0,lite?64:128);
		// stickers on the backs of the signs and up the posts
		for (const r of out) if (r.mat === MAT.retro && r.back === BACK.blank && r.post && hash01(r.x, r.z, 'sb') < 0.5) surfaces.push({ kind: 'signback', x: r.x - r.nx * 0.004, z: r.z - r.nz * 0.004, y: null, hy: r.hy, nx: -r.nx, nz: -r.nz, w: r.w * 0.8, h: r.h * 0.8, lu: landAt(r.x, r.z)?.lu });
		for (const p of postList) if (hash01(p.x, p.z, 'ps') < 0.4) { const a = hash01(p.x, p.z, 'pa') * Math.PI * 2; surfaces.push({ kind: 'post', x: p.x + Math.sin(a) * 0.037, z: p.z + Math.cos(a) * 0.037, y: null, hy: 1.5, nx: Math.sin(a), nz: Math.cos(a), w: 0.07, h: 0.9, lu: landAt(p.x, p.z)?.lu }); }
		for (const c of real.crossings?.() || []) if (c.city && near(c.x, c.z, R * 0.6) && hash01(c.x, c.z, 'cg') < 0.5) surfaces.push({ kind: 'ground', x: c.x + c.uz * (c.hw + 1.5), z: c.z - c.ux * (c.hw + 1.5), nx: c.ux, nz: c.uz, w: 2.5, gum: 2 });
		// (the stickers on a post are not to fly off it: their y comes from the post's ground)
		// Large campaign art uses a separate cap; street and safety signs stay untouched.
		for(const S of surfaces){if(murals>=(lite?2:5))break;const ad=S.campaignEligible===true?wallCampaign(S,seed):null;if(ad){out.push(ad);murals++;}}
		// Small material scars live on existing industrial/alley surfaces, never sign lettering.
		let scars=0;for(const S of surfaces){if(scars>=(lite?6:16))break;if(!['industrial','alley','dumpster','abutment'].includes(S.kind)||S.civic||S.storefront||hash01(S.x,S.z,'scar')>.35)continue;const size=Math.min(S.w*.6,1.8);out.push({mat:MAT.paint,layer:LAYER.grime,face:{k:'damage',tile:hash32(S.x,S.z,'damage')%4},x:S.x,z:S.z,hy:Math.min((S.h||2)*.4,1.25),nx:S.nx,nz:S.nz,w:size,h:Math.min(size*.8,(S.h||2)*.7),base:S.y??null,back:BACK.none,wear:.12});scars++;}
		const M = moralNow();
		out.push(...grimeFor(surfaces, { seed, phone: lite }));
		out.push(...graffitiFor(surfaces, { morality: M, seed, day: day(), phone: lite }));
		return { out, postList, gantries, slabList, M };
	}
	// a built shop's inside, in its own frame (bay/commercial.js: x across, the storefront at +z)
	function interiorRecords(B, t, lite) {
		const out = [], ca = Math.cos(B.a), sa = Math.sin(B.a);
		const L = (lx, lz) => [B.x + ca * lx - sa * lz, B.z + sa * lx + ca * lz], N = (lx, lz) => [ca * lx - sa * lz, sa * lx + ca * lz];
		const hang = (B.ceil ?? 4.4) - 0.75, r = rng(hash32(Math.round(B.x), Math.round(B.z), 'aisle'));
		const items = ITEMS[t] || ITEMS.any, col = pick(r, ['#1c6b3a', '#1d4f9c', '#7a2a1c', '#2a3a4a', '#a8501c']);
		const rows = B.aisles;
		for (let k = 0; k + 1 < rows.length; k++) {
			const [, x1, z0] = rows[k], zc = (z0 + rows[k + 1][2]) / 2, [x, z] = L(x1 - 0.2, zc), [nx, nz] = N(1, 0);
			out.push({ mat: MAT.vinyl, layer: LAYER.poster, face: { k: 'aisle', n: k + 1, items: items[k % items.length], col }, x, z, hy: hang, base: B.y, nx, nz, w: 1.25, h: 0.42, back: BACK.readable, wear: 0 });
		}
		if (/grocer|market|general/.test(t) && B.products?.length) {
			const count = Math.min(lite ? 24 : 72, B.products.length);
			for (let i = 0; i < count; i++) {
				const start = Math.floor(i * B.products.length / count), end = Math.floor((i+1) * B.products.length / count);
				// Rotate within each sample interval: a fixed even stride labels only one shelf side.
				const p = B.products[start + i % Math.max(1,end-start)], [x,z] = L(p.x,p.z), [nx,nz] = N(0,p.side);
				const product = [6, [2,4,11][i%3], i%2?5:10, 3, i%2?8:9, -1, 10, 7][p.row % 8];
				if (product < 0) continue;
				const brand = productBrand(product, `${B.name}:${Math.floor(p.x * 3)}:${p.row}`);
				out.push({ mat: MAT.paper, layer: LAYER.sticker, face: { k: 'product', product, brandFamily: brand.family, brandIndex: brand.trade }, x,z,nx,nz,hy:p.y,base:B.y,w:.245,h:.285,back:BACK.none,wear:0 });
			}
		}
		const D = DEPT[t] || DEPT.any;
		{ const [x, z] = L(0, -B.hd + 0.31), [nx, nz] = N(0, 1); out.push({ mat: MAT.vinyl, layer: LAYER.poster, face: { k: 'dept', name: D[0], picto: D[1], col: D[2] }, x, z, hy: Math.min(hang, 2.75), base: B.y, nx, nz, w: 2.6, h: 0.5, back: BACK.none, wear: 0 }); }
		if (!lite) for (const [x0, x1, zr] of rows) for (const s of [-1, 1]) for (const y of [0.2, 0.75, 1.3]) for (let x = x0 + 0.5; x < x1 - 0.3; x += 1.1) {
			if (r() < 0.25) continue;
			const [wx, wz] = L(x, zr + s * 0.535), [nx, nz] = N(0, s);
			const pi = Math.floor(r() * 12), sale = pi === 0;
			out.push({ mat: MAT.paper, layer: LAYER.poster, face: { k: 'price', item: pick(rng(pi + 1), ['Each', 'per lb', '2 for', 'Value', 'Fresh', 'Organic']), price: `${1 + (pi * 7) % 9}.${['99', '49', '29', '79'][pi % 4]}`, sale }, x: wx, z: wz, hy: y, base: B.y, nx, nz, w: 0.075, h: 0.04, back: BACK.none, wear: 0 });
		}
		return out;
	}

	// ---------- into the batches ----------
	function rebuild(cx, cz) {
		const t0 = performance.now();
		const { out, postList, gantries, slabList, M } = gather(cx, cz);
		// the faces into the atlas (grime needs none)
		const want = new Map();
		for (const r of out) { if (r.mat === MAT.grime) continue; r.key = faceKey(r.face); if (!want.has(r.key)) want.set(r.key, { face: r.face, w: r.w, h: r.h }); }
		atlas.sync(want);
		for (const B of batches.values()) B.clear();
		let n = 0;
		for (const r of out) {
			const c = r.mat === MAT.grime ? null : atlas.get(r.key);
			if (!c && r.mat !== MAT.grime) continue;
			const B = batchOf(r.mat, r.layer);
			let nx = r.nx || 0, ny = r.ny || 0, nz = r.nz || 0, tx, ty = 0, tz, y;
			if (ny > 0.5) {
				// on the ground: tilted to the ground's own slope there, turned by its seed
				const e = 0.6, gx = ground(r.x + e, r.z) - ground(r.x - e, r.z), gz = ground(r.x, r.z + e) - ground(r.x, r.z - e);
				_f.set(-gx, 2 * e, -gz).normalize(); nx = _f.x; ny = _f.y; nz = _f.z;
				const a = hash01(r.x, r.z, 'rot') * Math.PI * 2; tx = Math.cos(a); tz = Math.sin(a);
				const d = tx * nx + tz * nz; tx -= nx * d; ty = -ny * d; tz -= nz * d; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
				y = ground(r.x, r.z) + 0.03;
			} else {
				tx = nz; tz = -nx;
				y = r.abs ?? (r.base ?? ground(r.x, r.z)) + r.hy;
			}
			const extraF = r.mat === MAT.grime ? ({ rust: 0, soot: 1, streak: 2, gum: 3, oil: 4 }[r.face.type] ?? 0) : r.mat === MAT.glass && r.face.frost ? 1 : r.mat===MAT.paint&&graffitiGraphic(r.face.k,r.face.seed)?.gloss?1:0;
			if (B.put(r.x, y, r.z, nx, ny, nz, tx, ty, tz, r.w, r.h, c, r.back ?? BACK.blank, r.seed ?? hash01(r.x, r.z, r.hy || 0), r.wear || 0, extraF)) n++;
		}
		for (const B of batches.values()) B.commit();
		// posts, slabs, gantries
		let np = 0;
		for (const p of postList) {
			if (np >= POST_CAP) break;
			const g = ground(p.x, p.z) - 0.05;
			posts.setMatrixAt(np++, _m.compose(_p.set(p.x, g, p.z), _q.identity(), _s.set(1, p.h + 0.05, 1)));
		}
		posts.count = np; posts.instanceMatrix.needsUpdate = true;
		let ns = 0;
		for (const s of slabList) { if (ns >= SLAB_CAP) break; slabs.setMatrixAt(ns++, _m.compose(_p.set(s.x, ground(s.x, s.z) - 0.05, s.z), _q.setFromAxisAngle(Y, s.yaw), _s.set(1, s.h, 1))); }
		slabs.count = ns; slabs.instanceMatrix.needsUpdate = true;
		if (gantryMesh) { group.remove(gantryMesh); gantryMesh.geometry.dispose(); gantryMesh = null; }
		if (gantries.length) {
			const parts = [];
			for (const G of gantries) {
				const dx = G.x1 - G.x0, dz = G.z1 - G.z0, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
				const g0 = ground(G.x0, G.z0), g1 = ground(G.x1, G.z1), top = Math.max(g0, g1) + G.h;
				for (const [x, z, g] of [[G.x0, G.z0, g0], [G.x1, G.z1, g1]]) parts.push(new THREE.BoxGeometry(0.42, top + 2.8 - g, 0.42).translate(0, (top + 2.8 - g) / 2, 0).rotateY(yaw).translate(x, g, z));
				// the sign bridge's box truss: four chords, laced corner to corner on its faces
				const at = (t, fo, hy) => [G.x0 + dx * t + G.ux * fo, top + hy, G.z0 + dz * t + G.uz * fo];
				for (const fo of [-0.55, 0.55]) for (const hy of [0.4, 2.3]) parts.push(bar(at(0, fo, hy), at(1, fo, hy), 0.16));
				const bays = Math.max(2, Math.round(L / 1.9));
				for (let k = 0; k < bays; k++) {
					const t0 = k / bays, t1 = (k + 1) / bays, up = k % 2 === 0;
					for (const fo of [-0.55, 0.55]) parts.push(bar(at(t0, fo, up ? 0.4 : 2.3), at(t1, fo, up ? 2.3 : 0.4), 0.07));
					parts.push(bar(at(t0, up ? -0.55 : 0.55, 2.3), at(t1, up ? 0.55 : -0.55, 2.3), 0.07));
				}
				// the catwalk under the signs
				parts.push(new THREE.BoxGeometry(0.9, 0.06, L * 0.9).rotateY(yaw).translate((G.x0 + G.x1) / 2 - G.ux * 0.6, top - 0.05, (G.z0 + G.z1) / 2 - G.uz * 0.6));
			}
			const merged = mergeBoxes(parts);
			gantryMesh = new THREE.Mesh(merged, steel); gantryMesh.castShadow = !isPhone; gantryMesh.receiveShadow = true; gantryMesh.name = 'signage-gantries';
			group.add(gantryMesh);
			for (const p of parts) p.dispose();
		}
		lastOut = out;
		last = { records: n, ms: Math.round(performance.now() - t0), posts: np, gantries: gantries.length, slabs: ns, morality: M };
	}
	// a square bar from a to b ([x, y, z])
	function bar(a, b, w) {
		const d = _bd.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
		return new THREE.BoxGeometry(w, w, L).applyQuaternion(_bq.setFromUnitVectors(_bz, d.normalize())).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
	}
	function mergeBoxes(parts) {
		let nv = 0, ni = 0;
		for (const p of parts) { nv += p.attributes.position.count; ni += p.index.count; }
		const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
		let vo = 0, io = 0;
		for (const p of parts) { pos.set(p.attributes.position.array, vo * 3); nor.set(p.attributes.normal.array, vo * 3); for (let i = 0; i < p.index.count; i++) idx[io + i] = p.index.array[i] + vo; vo += p.attributes.position.count; io += p.index.count; }
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
		return g;
	}

	// ---------- each frame ----------
	function update(dt, camera, night = 0, driving = false) {
		if (disposed) return;
		SIGN_U.uSgTime.value += Math.min(dt,.1);
		SIGN_U.uSgNight.value = night; SIGN_U.uSgDay.value = 1 - night;
		// the headlights: yours, when you drive after dark (the camera stands in for the lamps;
		// a retroreflector sends their light back toward its source, and the eye is beside it)
		const H = SIGN_U.uSgHead.value;
		if ((driving || forceHead) && night > 0.12) {
			camera.getWorldDirection(_f); _f.y = Math.min(_f.y, 0.05); _f.normalize();
			H.set(camera.position.x, camera.position.y - 0.6, camera.position.z, Math.min(1, night * 1.3));
			SIGN_U.uSgHeadDir.value.copy(_f);
		} else H.w = 0;
		const w = W(), real = w?.real;
		// (the storefronts post their display windows' decals here: bound once the city has them)
		const SF = w?.city?.economy?.storefronts;
		if (SF !== boundSF && SF?.setSignage) { boundSF?.setSignage?.(null); boundSF = SF; SF.setSignage(api); }
		if (!real?.loaded?.() || camera.position.y > 2500) { group.visible = camera.position.y < 2500; return; }
		group.visible = true;
		const x = camera.position.x, z = camera.position.z;
		// (what changed round you is asked twice a second, not every frame)
		checkT -= dt;
		if (!dirty && checkT > 0 && Math.hypot(x - at.x, z - at.z) < R0 * 0.28) return;
		checkT = 0.5;
		openRequests = requestsNear(x,z,SHOP_R);
		const nextLots=w.city?.nearList?.();
		const nextHosts=surfaceHosts.map(o=>[wreckedHost(o)?1:0,o.y,o.h].join(',')).join('|');
		if(nextLots!==cityLots||nextHosts!==hostState){dirty=true;cityLots=nextLots;hostState=nextHosts;}
		const key = [openRequests.map(q => q.id).sort().join(','), artRevision(), real.version?.() ?? 0, w.freeways?.builds?.() ?? 0, (w.city?.economy?.plan?.() || []).length, w.commercial?.count?.() ?? 0, w.structures?.rebuild?.sites?.size ?? 0, w.parks?.count?.() ?? 0, w.interiors?.live?.size ?? 0].join('|');
		if (!dirty && key === keyNow && Math.hypot(x - at.x, z - at.z) < R0 * 0.28) return;
		dirty = false; keyNow = key; at = { x, z };
		rebuild(x, z);
	}

	function info() {
		const counts = {};
		for (const [k, B] of batches) counts[k] = B.n;
		return { system: sys.id, locale, atlas: atlas.info(), batches: counts, draws: [...batches.values()].filter((B) => B.n).length + (posts.count ? 1 : 0) + (slabs.count ? 1 : 0) + (gantryMesh ? 1 : 0), ...last, extra: extra.size, shopGlass: glassOf.size };
	}
	const api = {
		group, update, info,
		// records of your own (placement.js's shape), kept until removed; owner: any string
		add(owner, records) { extra.set(owner, records); dirty = true; },
		remove(owner) {
			const G = glassOf.get(owner);
			if (G) { glassOf.delete(owner); if (glassAt.get(G.k) === owner) glassAt.delete(G.k); dirty = true; }
			if (extra.delete(owner)) dirty = true;
		},
		// a shop's glass decals by your own geometry (the storefronts): biz { name, type, use, x, z },
		// front { x, z, nx, nz, run, g, door }; glass false for an opaque door
		storefront(owner, biz, front, { glass = true } = {}) {
			const old = glassOf.get(owner);
			if (old) glassAt.delete(old.k);
			const k = posKey(biz.x, biz.z);
			glassOf.set(owner, { x: biz.x, z: biz.z, k, biz, front, glass });
			glassAt.set(k, owner);
			dirty = true;
		},
		refresh() { dirty = true; },
		// where the records of a face kind stand (for a look at them: Crysis.signage.where('blade'))
		where: (k, n = 5) => lastOut.filter((r) => r.face?.k === k).slice(0, n).map((r) => ({ x: +r.x.toFixed(2), z: +r.z.toFixed(2), hy: r.hy, nx: +(r.nx || 0).toFixed(3), nz: +(r.nz || 0).toFixed(3), base: r.base ?? null, art: graffitiGraphic(r.face.k,r.face.seed) })),
		// the big painted pieces round you, the murals and the graffiti pieces on the long walls (for
		// the lamps over them at night: bay/nightlights.js): { x, z, hy, nx, nz, w, h, base, mural }
		murals: () => lastOut.filter((r) => r.face && (r.face.k === 'piece' || (r.face.k === 'campaign' && r.face.format === 'mural'))).map((r) => ({ x: r.x, z: r.z, hy: r.hy, nx: r.nx || 0, nz: r.nz || 0, w: r.w, h: r.h, base: r.base ?? null, mural: r.face.k === 'campaign' })),
		// (for a look at the sheeting at night without a car: the camera's lamps on)
		headlights(on = true) { forceHead = !!on; return forceHead; },
		atlas,
		system: () => sys,
		dispose() {
			if (disposed) return;
			disposed = true;
			boundSF?.setSignage?.(null); boundSF = null;
			setFleetDecals(null);
			offQuality?.();
			for (const B of batches.values()) B.dispose();
			batches.clear();
			if (gantryMesh) gantryMesh.geometry.dispose();
			posts.dispose(); slabs.dispose(); postGeo.dispose(); slabGeo.dispose(); steel.dispose(); slabMat.dispose();
			scene.remove(group);
			atlas.dispose();
			clearMaterials();
		},
	};
	return api;
}
