// Walk-in shops, cafés, restaurants, offices and places to play. Within a few dozen metres
// the mapped commercial buildings (the shops along a main street, a strip centre, an office
// block's ground floor) stop being painted blocks and are built for real, the way the
// houses are (houses.js): walls with thickness, a glass storefront with its door open, a
// ceiling of light panels, and inside, a fit-out for what the place is:
//   café        - the espresso bar and its menu boards, the pastry case, round tables, the
//                 bar along the window; a bakery's, a donut shop's, a gelato counter's own
//                 (bay/dinefit.js)
//   restaurant  - the kitchen behind its pass, tables laid for two and four, booths; a pub's
//                 bar, a diner's counter, a sushi bar, a pizzeria's or a burger place's order
//                 counter and lit menus (bay/dinefit.js)
//   shop        - fitted out for its trade (bay/storefit.js)
//   office      - reception and the company's board, desks in pods at their work, the meeting
//                 room behind glass, the kitchenette; a clinic's waiting room and treatment rooms
//   arcade      - cabinets under their marquees, pinball, skee-ball, claw machines, air hockey,
//                 the prize counter
//   bowling     - the lanes, their pins and masking, the ball returns and scores, the shoe
//                 counter and the snack bar
//   cinema      - a lobby with its concession stand, then a dark hall of raked seats and the screen
//   tattoo      - the counter, the flash framed on the wall, the stations (all: bay/venuefit.js)
// and the people in them by the hour (people/flow.js): cafés full over breakfast, offices
// through the working day, restaurants from dusk, the arcade and lanes in the evening.
// Everything in a building is merged per material, so each is a handful of draws.

import * as THREE from 'three';
import { addLodFade, anchorBuilding, buildingBand, updateDetailClock } from '../world/lodfade.js';
import { addNightField } from '../world/nightfield.js';
import { commercialStack } from '../interiors/workplace-plan.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crowd, ZONE, kidsAbout } from '../people/flow.js';
import { inCampus } from './discovery.js';
import { flashAtlas } from '../tattoo/skinink.js';
import { shopScheme, seedAt } from './decor.js';
import { lightInterior, releaseInterior, configureLighting } from '../interiors/lighting.js';
import { venueOf } from '../economy/venue.js';
import { sineHash as hh } from '../noise.js';
import { Builder, houseMaterials, lin } from './housekit.js';
import { GoodsBuilder, goodsSteps, goodsMaterial } from '../interiors/goods.js';
import { fitMart, fitShop, tradeOf } from './storefit.js';
import { fitDining, styleOf } from './dinefit.js';
import { fitVenue, officeKind } from './venuefit.js';
import { screenAtlasTexture, tileUV } from '../interiors/screen-atlas.js';
import { buildSlice } from '../world/buildslice.js';

// the flash sheets on a parlour's wall: the designs the street wears, on paper (made once)
let SHEET = null;
function flashSheet() {
	if (SHEET) return SHEET;
	const F = flashAtlas(), cv = document.createElement('canvas');
	cv.width = F.canvas.width; cv.height = F.canvas.height;
	const g = cv.getContext('2d');
	g.fillStyle = '#efe6d2'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(F.canvas, 0, 0);
	const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
	SHEET = { tiles: F.tiles, mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }) };
	return SHEET;
}
// a place's own board, for the wall behind its reception: its name in its colours and its small
// line (economy/establishments.js), on a canvas of its own
const FONTS = { serif: 'Georgia, "Times New Roman", serif', sans: '"Helvetica Neue", Arial, sans-serif', script: '"Brush Script MT", "Segoe Script", cursive', slab: 'Rockwell, "Roboto Slab", "Courier New", serif', narrow: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif' };
function drawBoard(cv, E) {
	const g = cv.getContext('2d'), w = cv.width, h = cv.height, sg = E?.sign || {}, bg = sg.bg || '#2a3a4a', fg = sg.fg || '#ffffff';
	g.fillStyle = bg; g.fillRect(0, 0, w, h);
	g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20); g.globalAlpha = 1;
	const tag = String(E?.tag || '').toUpperCase(), font = FONTS[sg.font] || FONTS.sans, weight = sg.font === 'serif' || sg.font === 'script' ? '' : 'bold ';
	let px = tag ? 58 : 66;
	g.font = `${weight}${px}px ${font}`;
	const tw = g.measureText(E?.name || '').width;
	if (tw > w - 60) px = Math.max(20, Math.floor(px * (w - 60) / tw));
	g.font = `${weight}${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
	g.fillText(E?.name || '', w / 2, h / 2 - (tag ? 14 : 0));
	if (tag) { g.font = `bold 20px ${FONTS.sans}`; g.globalAlpha = 0.85; g.fillText(tag, w / 2, h / 2 + 36); g.globalAlpha = 1; }
}
const CEIL = 3.6, WALL = 0.3, STORE = 3.1;
// the hours each keeps its lights on (interiors/lighting.js dims them the rest of the night)
const HOURS = { cafe: [6, 20], restaurant: [10, 23.5], shop: [8, 21], office: [7, 20], arcade: [10, 24], bowling: [10, 24], cinema: [10, 24], tattoo: [11, 22] };

// what a commercial block is, from its kind, size and where it stands (stable for a place;
// economy/venue.js, which the signs out front agree with)
const typeOf = venueOf;
const ZONE_OF = { cafe: ZONE.dining, restaurant: ZONE.dining, shop: ZONE.retail, tattoo: ZONE.retail, office: ZONE.office, arcade: 'play', bowling: 'play', cinema: 'play' };
function busyAt(type, h) {
	if (ZONE_OF[type] === 'play') return Math.max(0, Math.min(1, Math.exp(-(((h - 20) / 2.6) ** 2)) + Math.exp(-(((h - 15) / 2.5) ** 2)) * 0.45));
	if (type === 'cafe') return Math.max(0, Math.min(1, Math.exp(-(((h - 8.3) / 1.6) ** 2)) + Math.exp(-(((h - 14) / 2) ** 2)) * 0.35));
	if (type === 'restaurant') return Math.max(0, Math.min(1, Math.exp(-(((h - 19.4) / 1.8) ** 2)) + Math.exp(-(((h - 12.5) / 1.1) ** 2)) * 0.55));
	return crowd(ZONE_OF[type], h).k;
}
// how many of those in are children (with their families), when children are about
const KIDS_IN = { tattoo: 0, cafe: 0.14, restaurant: 0.2, shop: 0.16, office: 0, arcade: 0.3, bowling: 0.28, cinema: 0.22 };
// a fitted shop's floor, by its trade (the house kit's: 'tile' a 12 inch square, 'floor4' a
// 24 inch porcelain, 'floor0' a vinyl checkerboard, 'floor6' Saltillo) and its tint
const FLOORS = {
	mart: ['tile', [0.93, 0.93, 0.9]], grocer: ['floor4', [0.92, 0.91, 0.88]], hardware: ['concrete', [0.85, 0.84, 0.82]], pharmacy: ['floor4', [0.95, 0.95, 0.94]],
	liquor: ['tile', [0.8, 0.74, 0.66]], books: ['wood', [0.78, 0.66, 0.52]], clothes: ['wood', [0.88, 0.84, 0.78]], pet: ['tile', [0.9, 0.9, 0.86]],
	tech: ['floor4', [0.9, 0.9, 0.92]], florist: ['floor6', [0.95, 0.85, 0.75]], salon: ['floor0', [0.95, 0.95, 0.95]], laundry: ['floor0', [0.95, 0.95, 0.93]],
	gym: ['concrete', [0.6, 0.6, 0.62]], clinic: ['floor4', [0.95, 0.95, 0.95]], variety: ['tile', [0.92, 0.92, 0.9]],
	// (the cafés' and restaurants', by how they're laid out: bay/dinefit.js)
	cafe: ['wood', [0.82, 0.7, 0.55]], sitdown: ['wood', [0.58, 0.42, 0.3]], pub: ['wood', [0.46, 0.33, 0.23]], diner: ['floor0', [0.95, 0.95, 0.95]],
	pizza: ['floor6', [0.92, 0.8, 0.7]], quick: ['floor4', [0.88, 0.87, 0.84]], counter: ['wood', [0.88, 0.78, 0.62]], bakery: ['floor6', [0.97, 0.9, 0.82]],
	donut: ['floor0', [0.97, 0.93, 0.95]], boba: ['floor4', [0.95, 0.95, 0.94]], icecream: ['floor0', [0.98, 0.94, 0.95]],
	// (the offices', by what they do; the places to play; a tattoo parlour's: bay/venuefit.js)
	studio: ['carpet', [0.5, 0.52, 0.56]], firm: ['carpet', [0.42, 0.4, 0.42]], care: ['floor4', [0.94, 0.94, 0.93]],
	arcade: ['carpet', [0.2, 0.12, 0.3]], bowling: ['carpet', [0.32, 0.14, 0.36]], cinema: ['carpet', [0.42, 0.1, 0.12]], tattoo: ['concrete', [0.5, 0.5, 0.52]],
};
// the colours a shop wears (its sign's: economy/establishments.js), linear and as written
function brandOf(b) {
	const sg = b.biz?.sign || (b.store === 'fuel' ? { bg: '#c8102e', fg: '#ffffff' } : b.store ? { bg: '#1d6f42', fg: '#ffffff' } : { bg: '#2a3a4a', fg: '#ffffff' });
	const C = (h, d) => { const c = new THREE.Color(); try { c.setStyle(h || d); } catch { c.setStyle(d); } return c; };
	const bg = C(sg.bg, '#2a3a4a'), fg = C(sg.fg, '#ffffff'), s = new THREE.Color();
	// (a white sign's stripe would vanish on a white wall: its letters' colour leads instead)
	const pale = bg.r + bg.g + bg.b > 2.4, A = pale ? fg : bg, B = pale ? bg : fg;
	return { bg: [A.r, A.g, A.b], fg: [B.r, B.g, B.b], bgs: A.getRGB(s, THREE.SRGBColorSpace).toArray(), fgs: B.getRGB(s, THREE.SRGBColorSpace).toArray() };
}
// what a shop's fit-out was made for: rebuilt when its business changes (the plan comes in late)
const bizKey = (b) => (b.biz ? b.biz.type + ':' + b.biz.name + ':' + b.biz.sign?.bg : b.store || '');

export function createCommercial(scene, bay, real, city, { isPhone = false, houseMats = null } = {}) {
	const band = buildingBand(isPhone);
	const BUILD_R = isPhone ? 36 : 50, DROP_R = BUILD_R + 25, MAX = isPhone ? 3 : 6;
	configureLighting({ isPhone });
	const group = new THREE.Group();
	group.name = 'commercial';
	scene.add(group);
	const S = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
	const mats = {
		wall: S(0xe9e4da, 0.9), walld: S(0x8a8074, 0.85), trim: S(0x3a3a3c, 0.5, { metalness: 0.4 }), glass: S(0x9fb4bf, 0.05, { metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false }),
		floorW: S(0x8a6440, 0.55), floorT: S(0xc9c4ba, 0.45), carpet: S(0x5a5f6a, 0.95), lane: S(0xc79a5e, 0.25),
		ceil: S(0xf2f0ea, 0.9), deck: S(0x2e3033, 0.9), duct: S(0xc4c8cc, 0.35, { metalness: 0.75 }), pipe: S(0xa8201c, 0.5), panel: S(0xffffff, 0.5, { emissive: new THREE.Color(0xfff4e0), emissiveIntensity: 0.9 }),
		wood: S(0x6b4a2e, 0.6), dark: S(0x202224, 0.5), steel: S(0xb8bcc0, 0.3, { metalness: 0.7 }), white: S(0xf4f4f0, 0.5), red: S(0x9c2a26, 0.7), leather: S(0x5a2e22, 0.6),
		green: S(0x3f6b3a, 0.8), screen: S(0x101418, 0.3, { emissive: new THREE.Color(0x6fb0ff), emissiveIntensity: 1.2 }), neon: S(0x220a22, 0.4, { emissive: new THREE.Color(0xff4fd0), emissiveIntensity: 1.6 }),
		bigscreen: S(0x111111, 0.4, { emissive: new THREE.Color(0xc8d8ff), emissiveIntensity: 1.1 }), seat: S(0x7a1c24, 0.8), food: S(0xd9a54a, 0.7), cup: S(0xf4efe6, 0.4),
		goods: [S(0xc0392b), S(0x2e86c1), S(0xf1c40f), S(0x27ae60), S(0x8e44ad), S(0xe67e22), S(0xecf0f1)],
		skin: [S(0xe0b494), S(0xc68e6a), S(0x8d5a3b), S(0x5a3a26), S(0xf0cfb0)], cloth: [S(0x2c3e50), S(0x7f8c8d), S(0xa93226), S(0x1f618d), S(0x117a65), S(0xd4ac0d), S(0x6c3483), S(0xeeeeee)],
	};
	// the inside faces of the walls, painted: one material for every building, each wall its
	// own colour in its vertices (so a painted room or an accent wall costs no draw of its own)
	mats.lining = S(0xffffff, 0.9, { vertexColors: true });
	mats.lining.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); };
	mats.lining.customProgramCacheKey = () => 'lining';
	// the screens' pictures (interiors/screen-atlas.js: a desk's work, a cabinet's game, the lanes'
	// scores), glowing of themselves
	mats.screens = new THREE.MeshBasicMaterial({ map: typeof document !== 'undefined' ? screenAtlasTexture() : null, color: 0xe6e6e6 });
	for (const m of Object.values(mats).flat()) addLodFade(m, 'building', band);
	const FILL = [mats.wall, mats.walld, mats.ceil, mats.floorW, mats.floorT, mats.carpet, mats.lane, mats.wood, mats.white, mats.leather, mats.red, mats.seat, mats.steel, mats.food, mats.cup, mats.green, mats.lining, ...mats.goods, ...mats.skin, ...mats.cloth];
	for (const m of FILL) { m.emissive = m.color.clone(); m.emissiveIntensity = 0.1; }
	// the floors, desks and seats in a place's own colours (decor.js shopScheme): tinted copies
	// of the shared materials, kept and shared by every place that asks for the same colour
	const tints = new Map();
	const tinted = (base, rgb) => {
		const key = base.uuid + rgb.map((v) => v.toFixed(3)).join(',');
		let m = tints.get(key);
		if (!m) { m = base.clone(); m.color.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace); m.emissive = m.color.clone(); m.emissiveIntensity = 0.1; addLodFade(m, 'building', band); FILL.push(m); tints.set(key, m); }
		return m;
	};
	const built = new Map();         // grp -> building

	// ---------- building one (a few steps a frame: update() runs them) ----------
	function* build(b) {
		const type = typeOf(b), rnd = (() => { let s = 1; return () => hh(b.x * 0.013 + s++ * 0.71, b.z * 0.017 - s * 0.37); })();
		// a shop is fitted out for what it sells (bay/storefit.js), a café or a restaurant for how
		// it serves (bay/dinefit.js): its fittings in the house kit, its stock and its menus on the
		// goods' sheet; its floor, its lights and its stripe its own
		// (an office, a place to play or a tattoo parlour for what it is: bay/venuefit.js)
		const stock = type === 'shop', dine = type === 'cafe' || type === 'restaurant', fitted = true;
		const trade = stock ? (b.store ? 'mart' : tradeOf(b.biz?.type)) : dine ? styleOf(type, b.biz?.type) : type === 'office' ? officeKind(b.biz?.type) : type;
		const kg = fitted ? new Builder() : null, goods = fitted ? new GoodsBuilder() : null;
		if (kg) { kg.ao = true; kg.inside(); }
		const ca = Math.cos(b.a), sa = Math.sin(b.a);
		let floorY = -1e9;
		for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) floorY = Math.max(floorY, bay.heightAt(b.x + ca * sx * b.w / 2 - sa * sz * b.d / 2, b.z + sa * sx * b.w / 2 + ca * sz * b.d / 2));
		floorY += 0.12;
		const W = b.w, D = b.d, H = Math.max(CEIL + 0.8, b.wallH - (floorY - bay.heightAt(b.x, b.z))), hw = W / 2, hd = D / 2;
		const parts = new Map(), col = [], glassCol = new Set(), aisles = [], products = [];      // col: solid boxes [x0, z0, x1, z1, y0, y1] in the local frame; aisles: the shelf rows [x0, x1, z] (signage/)
		const add = (mat, g) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(g.index ? g.toNonIndexed() : g); };
		const box = (mat, x0, y0, z0, x1, y1, z1, solid = false) => { add(mat, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); if (solid) col.push([x0, z0, x1, z1, y0, y1]); };
		const cyl = (mat, x, y, z, r, h, seg = 10) => add(mat, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z));

		// the shell: the floor, three solid walls, the storefront (glass between mullions, the
		// doorway open), the ceiling of light panels, the walls above and the roof
		const outside = mats.wall.clone(); outside.color.setRGB(...(b.look?.wall || city?.buildingLook?.(b)?.wall || [.91,.89,.85]), THREE.SRGBColorSpace); outside.emissiveIntensity=0; addLodFade(outside, 'building', band);
		// (after dark the street lamps and porch lights near it fall on its outside walls, as they do
		// on the painted block it takes over from: world/nightfield.js)
		addNightField(outside);
		const sc = shopScheme(type, seedAt(b.x, b.z));
		const floorMat = type === 'office' || type === 'cinema' ? tinted(mats.carpet, sc.carpet) : type === 'restaurant' ? tinted(mats.floorW, sc.wood) : type === 'bowling' ? mats.floorW : tinted(mats.floorT, sc.tile);
		if (kg) { const [fk, fc] = FLOORS[trade] || FLOORS.variety; kg.box((f) => (f === 2 ? fk : f === 3 ? null : 'concrete'), -hw, -0.4, -hd, hw, 0, hd, lin(fc)); }
		else box(floorMat, -hw, -0.4, -hd, hw, 0, hd);
		// the walls inside, painted, the back one sometimes in the place's colour (y0: a band
		// partway up, the shops' stripes)
		const lining = (x0, z0, x1, z1, rgb, h, y0 = 0) => {
			const g = new THREE.BoxGeometry(x1 - x0, h - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + h) / 2, (z0 + z1) / 2).toNonIndexed(), c = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace), a = new Float32Array(g.attributes.position.count * 3);
			for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i);
			g.setAttribute('color', new THREE.BufferAttribute(a, 3));
			add(mats.lining, g);
		};
		box(outside, -hw, 0, -hd, hw, H, -hd + WALL, true);
		box(outside, -hw, 0, -hd, -hw + WALL, H, hd, true);
		box(outside, hw - WALL, 0, -hd, hw, H, hd, true);
		const doorX = (b.door ?? 0.5) * (W - 4) - (hw - 2), dw = 1.9;
		box(outside, -hw, STORE, hd - WALL, hw, H, hd);
		box(mats.trim, -hw, 0, hd - WALL, hw, 0.35, hd, false);
		for (const [a0, a1] of [[-hw, doorX - dw / 2], [doorX + dw / 2, hw]]) {
			if (a1 - a0 < 0.1) continue;
			add(mats.glass, new THREE.BoxGeometry(a1 - a0, STORE - 0.35, 0.03).translate((a0 + a1) / 2, 0.35 + (STORE - 0.35) / 2, hd - WALL / 2));
			const pane = [a0, hd - WALL, a1, hd, 0, STORE];
			col.push(pane); glassCol.add(pane);
			for (let x = a0; x <= a1 + 0.01; x += Math.max(1.2, (a1 - a0) / Math.max(1, Math.round((a1 - a0) / 2.4)))) box(mats.trim, x - 0.05, 0.35, hd - WALL, x + 0.05, STORE, hd);
		}
		box(mats.trim, doorX - dw / 2 - 0.08, 0, hd - WALL, doorX - dw / 2, STORE, hd); box(mats.trim, doorX + dw / 2, 0, hd - WALL, doorX + dw / 2 + 0.08, STORE, hd);
		// an awning over the door, the name board above it (a corner store or gas station's mart has
		// its big board down over the windows and its lamps over the front: bay/forecourts.js)
		if (!b.store) box(type === 'restaurant' ? mats.red : type === 'arcade' || type === 'tattoo' ? mats.neon : mats.dark, doorX - 2.2, STORE + 0.1, hd, doorX + 2.2, STORE + 0.25, hd + 1.4);
		yield;
		// the ceiling: a dropped grid of light panels, or (the creative offices, the big stores,
		// some cafés and restaurants) open to the roof: the deck painted dark, bowstring trusses
		// arching across, spiral ducts, the sprinkler main, a cable tray, pendant lights
		const open = H > CEIL + 1.4 && ((type === 'office' && rnd() < 0.5) || (type === 'shop' && W * D > 500) || ((type === 'cafe' || type === 'restaurant') && rnd() < 0.4));
		if (!open) {
			box(type === 'arcade' || type === 'bowling' || type === 'cinema' ? mats.deck : mats.ceil, -hw, CEIL, -hd, hw, CEIL + 0.12, hd);
			// (a fitted shop has its rows of light strips instead, a café or a restaurant its pendants
			// and downlights: bay/storefit.js, dinefit.js; an arcade, the lanes and a cinema their own
			// lights under a dark ceiling: bay/venuefit.js)
			if (type === 'office' || type === 'tattoo') for (let x = -hw + 2; x < hw - 1; x += 3) for (let z = -hd + 2; z < hd - 1; z += 3) box(mats.panel, x - 0.55, CEIL - 0.02, z - 0.55, x + 0.55, CEIL, z + 0.55);
		} else openCeiling();
		// (up to the ceiling, or the roof deck where it is open)
		const lh = open ? H - 0.14 : CEIL + 0.1;
		{
			// (the places to play darker: their own lights are the point)
			const dk = type === 'arcade' || type === 'bowling' || type === 'cinema' ? 0.3 : 1, wc = sc.wall.map((c) => c * dk);
			lining(-hw + WALL, -hd + WALL, hw - WALL, -hd + WALL + 0.015, dk < 1 ? wc : sc.accent || sc.wall, lh);
			lining(-hw + WALL, -hd + WALL, -hw + WALL + 0.015, hd - WALL, wc, lh);
			lining(hw - WALL - 0.015, -hd + WALL, hw - WALL, hd - WALL, wc, lh);
		}
		function openCeiling() {
			const beam = (mat, x0, y0, x1, y1, z, t) => { const L = Math.hypot(x1 - x0, y1 - y0); add(mat, new THREE.BoxGeometry(L, t, t).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2, z)); };
			const top = H - 0.14, yb = Math.max(CEIL + 0.4, H - 1.9), span = W - 2 * WALL;
			box(mats.deck, -hw, top, -hd, hw, top + 0.04, hd);
			// the trusses: a straight bottom chord, an arched top chord, webs between
			for (let z = -hd + 2.5; z < hd - 1.5; z += 4.5) {
				const N = 12, arc = (t) => yb + (top - 0.06 - yb) * Math.sin(t * Math.PI);
				beam(mats.deck, -span / 2, yb, span / 2, yb, z, 0.12);
				for (let k = 0; k < N; k++) {
					const t0 = k / N, t1 = (k + 1) / N, x0 = -span / 2 + span * t0, x1 = -span / 2 + span * t1;
					beam(mats.deck, x0, arc(t0), x1, arc(t1), z, 0.14);
					if (k > 0) beam(mats.deck, x0, yb, x0, arc(t0), z, 0.05);
					beam(mats.deck, k % 2 ? x0 : x1, yb, k % 2 ? x1 : x0, arc(k % 2 ? t1 : t0), z, 0.04);
				}
			}
			// the ducts: a big spiral duct each side down the length, drops to round diffusers
			for (const sx of [-1, 1]) {
				const x = sx * span * 0.28, y = yb - 0.45;
				add(mats.duct, new THREE.CylinderGeometry(0.34, 0.34, D - 2, 14, 1, true).rotateX(Math.PI / 2).translate(x, y, 0));
				for (let z = -hd + 3; z < hd - 2; z += 1.2) add(mats.duct, new THREE.TorusGeometry(0.345, 0.012, 4, 14).translate(x, y, z));
				for (let z = -hd + 4; z < hd - 3; z += 6) { cyl(mats.duct, x, y - 0.9, z, 0.13, 0.6, 10); cyl(mats.duct, x, y - 0.95, z, 0.3, 0.06, 14); }
			}
			// the sprinkler main and its heads, a cable tray, and the pendant lights on long cords
			add(mats.pipe, new THREE.CylinderGeometry(0.05, 0.05, D - 1, 8).rotateX(Math.PI / 2).translate(span * 0.06, yb - 0.12, 0));
			for (let z = -hd + 2; z < hd - 1; z += 3) cyl(mats.steel, span * 0.06, yb - 0.3, z, 0.02, 0.18, 6);
			box(mats.dark, -span * 0.1 - 0.2, yb - 0.25, -hd + 1, -span * 0.1 + 0.2, yb - 0.2, hd - 1);
			for (let x = -span / 2 + 2.2; x < span / 2 - 1.5; x += 3.4) for (let z = -hd + 2.8; z < hd - 2.2; z += 3.4) {
				if (Math.abs(Math.abs(x) - span * 0.28) < 0.8) continue;
				box(mats.dark, x - 0.008, 3.1, z - 0.008, x + 0.008, top, z + 0.008);
				add(mats.dark, new THREE.ConeGeometry(0.28, 0.3, 14, 1, true).translate(x, 3.0, z));
				cyl(mats.panel, x, 2.86, z, 0.2, 0.02, 12);
			}
		}
		box(mats.walld, -hw, H - 0.1, -hd, hw, H + 0.25, hd);
		yield;

		// ---------- the fit-out ----------
		const seats = [];                // where people sit or stand: [x, z, yaw, sitting]
		const perks = [], games = [];    // what is yours to use, the machines and lanes to play (local)
		let board = null;
		const boardMat = () => {
			if (board) return board.mat;
			const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
			if (cv) { cv.width = 512; cv.height = 128; drawBoard(cv, b.biz); }
			const tex = cv ? new THREE.CanvasTexture(cv) : null;
			if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }
			board = { mat: new THREE.MeshBasicMaterial({ map: tex, color: 0xe6e6e6 }), tex };
			addLodFade(board.mat, 'building', band);
			return board.mat;
		};
		// what a fit-out (bay/storefit.js, dinefit.js, venuefit.js) draws with and into
		const fit = () => ({
			g: kg, s: goods, box, mats, col, seats, aisles, rnd, isPhone, doorX,
			wall: { x0: -hw + WALL, x1: hw - WALL, z0: -hd + WALL, z1: hd - WALL }, ceil: open ? null : CEIL, roof: open ? H - 0.14 : CEIL, brand: brandOf(b),
			band: (x0, z0, x1, z1, rgb, y0, y1) => lining(x0, z0, x1, z1, rgb, y1, y0),
			// a picture on a screen (the atlas's tile), facing +z turned by yaw, its middle at (x, y, z)
			screen: (x, y, z, w, h, tile, yaw = 0) => add(mats.screens, tileUV(new THREE.PlaneGeometry(w, h), tile).rotateY(yaw).translate(x, y, z)),
			// the place's own board (its name and line in its colours), the same way
			board: (x, y, z, w, h, yaw = 0) => add(boardMat(), new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z)),
			// a sheet of the street's tattoo flash (its i-th design) on a wall
			flash: (x, y, z, w, h, yaw, i) => {
				if (typeof document === 'undefined') return;
				const F = flashSheet(), n = F.tiles.length, t = F.tiles[((i % n) + n) % n], g = new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(x, y, z), uv = g.attributes.uv;
				for (let k = 0; k < uv.count; k++) uv.setXY(k, t[0] + uv.getX(k) * t[2], t[1] + uv.getY(k) * t[3]);
				add(F.mat, g);
			},
			// something here that is yours to use (interiors/office-perks.js), a game to play (arcade.js)
			perk: (kind, x, z) => perks.push({ kind, x, z }),
			game: (id, x, z, r, name) => games.push({ id, x, z, r, name }),
			biz: b.biz || null,
		});
		if (dine) {
			// a café or a restaurant, laid out for how it serves (bay/dinefit.js): an espresso bar,
			// a pizzeria's counter and oven, a pub's bar, a sit-down place's kitchen and its pass...
			yield* goodsSteps();
			yield* fitDining(fit(), type, b.biz?.type);
		} else if (stock) {
			// a shop, fitted out for its trade (bay/storefit.js): a gas station's food mart or a corner
			// store (bay/siteplan.js b.store), a grocer, a hardware store, a pharmacy, a bottle shop...
			// (the goods' sheet painted first, a few strips a step, once for every shop)
			yield* goodsSteps();
			const K = fit();
			yield* (b.store ? fitMart(K, b.store) : fitShop(K, b.biz?.type));
		} else {
			// an office for what it does, an arcade, the lanes, a cinema, a tattoo parlour
			// (bay/venuefit.js): their machines to play, their coffee and their popcorn yours too
			yield* goodsSteps();
			yield* fitVenue(fit(), type, b.biz);
		}

		// ---------- the building's people, by the hour ----------
		yield;
		const root = new THREE.Group();
		// (merged a few hundred boxes a step)
		let merged = 0;
		for (const [mat, list] of parts) {
			const m = new THREE.Mesh(mergeGeometries(list), mat); m.receiveShadow = true; m.castShadow = !isPhone && mat !== mats.glass; root.add(m);
			// (a screen or a board lights itself: nothing for the bake to do there)
			if (mat === mats.screens || mat === board?.mat) { m.userData.noBake = true; m.castShadow = m.receiveShadow = false; }
			if ((merged += list.length) > 300) { merged = 0; yield; }
		}
		// a fitted shop's fittings (the house kit's materials, shared with the houses) and its stock:
		// one unlit draw, its light set by the building's own each frame (in update)
		let goodsMat = null;
		if (kg) {
			yield;
			// (where there is no page to paint the kit's textures on, the tests: plain materials)
			const hm = houseMats || (houseMats = typeof document !== 'undefined' ? houseMaterials(band, undefined, 'building') : new Proxy({}, { get: (t, k) => t[k] || (t[k] = new THREE.MeshStandardMaterial({ vertexColors: true })) }));
			// (a material's mesh a step)
			for (const m of kg.meshSteps(hm, !isPhone)) { root.add(m); yield; }
			if (!goods.empty()) {
				goodsMat = goodsMaterial();
				addLodFade(goodsMat, 'building', band);
				const m = new THREE.Mesh(goods.geometry(), goodsMat);
				m.name = 'goods'; m.userData.noBake = true; m.castShadow = false;
				root.add(m);
			}
			yield;
		}
		// Exactly the coarse footprint: complementary coverage prevents coplanar overlap.
		root.position.set(b.x, floorY, b.z); root.rotation.y = -b.a; b.grp.nearBorn=updateDetailClock();anchorBuilding(root,b.x,b.z,Math.max(W,D)/2,b.grp.nearBorn);
		group.add(root);
		// lit by its own light panels, pendants, screens and signs (interiors/lighting.js), open
		// these hours (a café's or a restaurant's kitchen too: cooking/index.js)
		const hrs = b.store === 'fuel' ? [0, 24] : b.store ? [6, 23.5] : HOURS[type];
		const light = lightInterior(root, {
			id: 'biz:' + Math.round(b.x) + ':' + Math.round(b.z), occluders: col.filter((q) => !glassCol.has(q)), lamps: [mats.panel, mats.screen, mats.neon, mats.bigscreen],
			exclude: [outside], levels: [[0, open ? H - 0.14 : CEIL]], bounds: [-hw, -hd, hw, hd], rooms: 1, roomOf: () => 0,
			// (a gas station's mart keeps its lights on all night, a corner store till late)
			hours: hrs, allNight: b.store === 'fuel', dust: type === 'restaurant' && open,
		});
		const B = { b, type, root, floorY, seats, col, hw, hd, doorX, aisles, products, ceil: open ? null : CEIL, lastH: -99, stocked: stock, fitted, trade, hours: hrs, bizKey: bizKey(b), light, goodsMat, perks, games, dispose: () => { releaseInterior(root); root.traverse((o) => o.geometry?.dispose()); outside.dispose(); goodsMat?.dispose(); board?.mat.dispose(); board?.tex?.dispose(); } };
		return B;
	}

	// who is in, by the hour: the real people (people/people.js) take the seats and the
	// places to stand, from the list each building publishes here
	function venue(cam, hours) {
		const areas = [];
		let n = 0, kids = 0;
		for (const B of built.values()) {
			const [lx, lz] = local(B, cam.x, cam.z);
			if (Math.abs(lx) > B.hw + 14 || Math.abs(lz) > B.hd + 14) continue;
			// (a mart open all night has its clerk and a customer or two at any hour)
			const late = B.b.store === 'fuel' || (B.b.store && hours >= 6 && hours < 23.5);
			const k = late ? Math.max(0.16, busyAt(B.type, hours)) : busyAt(B.type, hours);
			if (k <= 0.02) continue;
			if (!B.spots) {
				const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a);
				// (not the cinema's raked rows: a sitter there would need the rake for a floor)
				B.spots = B.seats.filter((q) => !(q[4] > 0.05)).map((q) => {
					const [x, z, yaw, sit, y0 = 0, h = 0.46] = q;
					// (a seat's yaw turns -z, the way its sitter faces, in the building's frame)
					const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
					return { x: B.b.x + ca * x - sa * z, z: B.b.z + sa * x + ca * z, y: B.floorY + y0, h: sit ? h : 0, sit, heading: Math.atan2(fx * ca - fz * sa, fx * sa + fz * ca), taken: false, table: sit && h < 0.6 && B.type !== 'cinema', staff: !!q.staff };
				});
			}
			const want = Math.round(B.spots.length * k * (B.type === 'cinema' ? 0.7 : 0.55));
			if (!want) continue;
			n += want;
			kids += want * (KIDS_IN[B.type] || 0);
			areas.push({ w: want, seats: B.spots });
		}
		// families at the tables: the children sit with their grown-ups (people/people.js)
		return areas.length ? { n: Math.min(n, 24), kids: n ? Math.min(0.35, kids / n * kidsAbout(hours)) : 0, areas } : null;
	}

	// ---------- near you ----------
	let scanX = 1e9, scanZ = 1e9, cands = [], cool = 0, job = null;
	const BUDGET = isPhone ? 3 : 4, failed = new WeakSet(), GOODS_K = 0.92;
	function update(cam, dt, hours, nightK) {
		updateDetailClock();const x = cam.position.x, z = cam.position.z;
		const high = cam.position.y - (bay.heightAt(x, z) || 0) > 120;
		group.visible = !high;
		mats.panel.emissiveIntensity = 0.7 + nightK * 0.6;
		// the rooms are lit from their ceilings: a glow on everything inside where the light is
		// not baked yet (no extra lights, so no shaders are rebuilt), no brighter after dark
		for (const m of FILL) m.emissiveIntensity = 0.1 - nightK * 0.03;
		if (high) { for (const [grp] of built) if(grp.near) city?.setNear?.(grp,null); return; }
		for (const [grp,B] of built) if(!grp.near) city?.setNear?.(grp,[B.b.x,B.b.z]);
		if (!real?.loaded() && !city?.procBiz) return;
		if (Math.hypot(x - scanX, z - scanZ) > 6) {
			scanX = x; scanZ = z;
			cands = [];
			for (const b of real?.loaded() ? real.near('boxes', x, z, BUILD_R + 20) : []) {
				if (!b.grp?.biz || b.grp.wrecked || commercialStack(b.kind,b.w,b.d,b.wallH) || inCampus(b.x, b.z)) continue;
				const d = Math.hypot(b.x - x, b.z - z) - Math.max(b.w, b.d) / 2;
				if (d < BUILD_R) cands.push([d, b]);
			}
			// ...and the gridded towns' shops and offices (city.js gives them the same shape)
			for (const b of city?.procBiz?.(x, z, BUILD_R + 20) || []) { if (b.grp?.wrecked) continue; const d = Math.hypot(b.x - x, b.z - z) - Math.max(b.w, b.d) / 2; if (d < BUILD_R) cands.push([d, b]); }
			cands.sort((p, q) => p[0] - q[0]);
			cands.length = Math.min(cands.length, MAX);
		}
		for (const [grp, B] of built) {
			const d = Math.hypot(B.b.x - x, B.b.z - z) - Math.max(B.b.w, B.b.d) / 2;
			// (a wrecked shop is let go: structures/ draws its shell, and it is built whole again once put right)
			// (and a shop whose business has changed since it was fitted out: built again for the new one)
			if (d > DROP_R || grp.wrecked || (!cands.some((c) => c[1].grp === grp) && built.size > MAX) || (B.fitted && B.bizKey !== bizKey(B.b))) { group.remove(B.root); B.dispose(); city?.setNear?.(grp, null); built.delete(grp); }
		}
		// one at a time, a few milliseconds a frame (as the houses are)
		if (job && (job.b.grp.wrecked || !cands.some((c) => c[1] === job.b))) job = null;
		cool -= dt;
		if (!job && cool <= 0) for (const [, b] of cands) if (!built.has(b.grp) && !b.grp.wrecked && !failed.has(b)) { job = { b, gen: build(b) }; break; }
		const t0 = performance.now(), slice = buildSlice(dt, BUDGET);
		while (job && performance.now() - t0 < slice) {
			let r;
			try { r = job.gen.next(); } catch (e) { console.warn('commercial', e); failed.add(job.b); r = { done: true, value: null }; }
			if (!r.done) continue;
			const B = r.value, b = job.b;
			job = null; cool = 0.25;
			if (B) { b.grp.detailRadius = Math.max(b.w, b.d) / 2; built.set(b.grp, B); city?.setNear?.(b.grp, [b.x, b.z]); }
		}
		// the stock as lit as the shop round it: full while it is open, the night lights' share once
		// it has shut for the night, a little of the day through the windows
		for (const B of built.values()) {
			const U = B.light?.U;
			if (!B.goodsMat || !U) continue;
			const nk = U.ibakeNight.value;
			B.goodsMat.color.setScalar(GOODS_K * (U.ibakeK.value * (1 - 0.72 * nk) + 0.18 * (1 - nightK) * nk));
		}
	}

	const local = (B, x, z) => { const dx = x - B.b.x, dz = z - B.b.z, ca = Math.cos(B.b.a), sa = Math.sin(B.b.a); return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
	// the floor inside
	function floor(x, z, y) {
		let best = -1e9;
		for (const B of built.values()) {
			const [lx, lz] = local(B, x, z);
			if (Math.abs(lx) < B.hw && Math.abs(lz) < B.hd && y > B.floorY - 1.2) best = Math.max(best, B.floorY);
		}
		return best;
	}
	// the walls, counters and shelves are solid
	function push(pos, footY) {
		const R = 0.3;
		for (const B of built.values()) {
			let [lx, lz] = local(B, pos.x, pos.z);
			if (Math.abs(lx) > B.hw + 1 || Math.abs(lz) > B.hd + 1) continue;
			const y0 = footY - B.floorY + 0.25, y1 = footY - B.floorY + 1.7;
			let moved = false;
			for (const c of B.col) {
				if (y1 < c[4] || y0 > c[5]) continue;
				const qx = Math.max(c[0], Math.min(c[2], lx)), qz = Math.max(c[1], Math.min(c[3], lz));
				const dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
				if (d2 >= R * R) continue;
				if (d2 < 1e-8) { const pen = [lx - c[0], c[2] - lx, lz - c[1], c[3] - lz], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) lx = c[0] - R; else if (k === 1) lx = c[2] + R; else if (k === 2) lz = c[1] - R; else lz = c[3] + R; }
				else { const d = Math.sqrt(d2); lx = qx + dx / d * R; lz = qz + dz / d * R; }
				moved = true;
			}
			if (moved) { const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a); pos.x = B.b.x + ca * lx - sa * lz; pos.z = B.b.z + sa * lx + ca * lz; }
		}
	}
	// the place you are in (for a hint)
	function inside(pos) {
		for (const B of built.values()) { const [lx, lz] = local(B, pos.x, pos.z); if (Math.abs(lx) < B.hw - 0.3 && Math.abs(lz) < B.hd - 0.3 && pos.y - B.floorY < CEIL) return B; }
		return null;
	}
	// the doorways a walker may use (always open: a storefront's door stands open), each with
	// its outward normal and a point just inside and just outside
	function doorsNear(x, z, r = 40) {
		const out = [];
		for (const B of built.values()) {
			if (Math.hypot(B.b.x - x, B.b.z - z) > r + Math.max(B.hw, B.hd)) continue;
			const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a), W = (lx, lz) => [B.b.x + ca * lx - sa * lz, B.b.z + sa * lx + ca * lz];
			const [dx, dz] = W(B.doorX, B.hd), [ix, iz] = W(B.doorX, B.hd - 1.6), [ox, oz] = W(B.doorX, B.hd + 1.6);
			out.push({ x: dx, z: dz, y: B.floorY, heading: Math.atan2(-sa, ca), nx: -sa, nz: ca, inside: { x: ix, z: iz }, outside: { x: ox, z: oz, y: bay.heightAt(ox, oz) }, use: B.type, B });
		}
		return out;
	}
	// what is yours to use in the places round you (the office's coffee, water, vending machine
	// and first-aid box, a cinema's concession stand, the lanes' snack bar: interiors/office-perks.js)
	function amenities(eye, r = 2.2) {
		const out = [];
		for (const B of built.values()) {
			if (!B.perks?.length || Math.abs(eye.y - B.floorY - 1.6) > 2.5) continue;
			const [lx, lz] = local(B, eye.x, eye.z);
			if (Math.abs(lx) > B.hw + r || Math.abs(lz) > B.hd + r) continue;
			const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a);
			for (const q of B.perks) {
				const d = Math.hypot(q.x - lx, q.z - lz);
				if (d < r) out.push({ kind: q.kind, x: B.b.x + ca * q.x - sa * q.z, z: B.b.z + sa * q.x + ca * q.z, d, key: `biz:${Math.round(B.b.x)}:${Math.round(B.b.z)}:${q.kind}:${Math.round(q.x * 10)}:${Math.round(q.z * 10)}`, place: B.type });
			}
		}
		return out.sort((a, b) => a.d - b.d);
	}
	// the machines and lanes to play in the places round you (arcade.js offers each where it stands)
	function gameSpots(x, z, R = 2000) {
		const out = [];
		for (const B of built.values()) {
			if (!B.games?.length || Math.hypot(B.b.x - x, B.b.z - z) > R + Math.max(B.hw, B.hd)) continue;
			const ca = Math.cos(B.b.a), sa = Math.sin(B.b.a), name = B.b.biz?.name || '';
			for (const q of B.games) out.push({ game: q.id, name: name ? `${q.name}, ${name}` : q.name, x: B.b.x + ca * q.x - sa * q.z, z: B.b.z + sa * q.x + ca * q.z, r: q.r });
		}
		return out;
	}
	return { group, update, floor, push, inside, venue, doorsNear, amenities, gameSpots, count: () => built.size, busy: () => !!job, list: () => [...built.values()].map((B) => ({ x: B.b.x, z: B.b.z, a: B.b.a, type: B.type, y: B.floorY, hw: B.hw, hd: B.hd, seats: B.seats.length, doorX: B.doorX, glassZ: B.hd - WALL / 2, aisles: B.aisles, products: B.products, ceil: B.ceil, name: B.b.biz?.name || '', stocked: !!B.stocked, trade: B.trade || null })) };
}
