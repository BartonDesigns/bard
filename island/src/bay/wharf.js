// The Santa Cruz Municipal Wharf (1914): half a mile of timber deck on thousands of
// creosoted pilings, out from the west end of Main Beach into Monterey Bay. A two-lane
// plank road with parking and sidewalks down it; the outer end widens into a head lined
// both sides with low wooden buildings (seafood restaurants, Stagnaro Bros. and the fish
// markets, saltwater taffy and fudge, gift shops, the bait shop), benches and railings all
// round, and the Pacific on three sides: the Boardwalk back along the beach, the
// lighthouse on its point to the west. Under the far end the sea lions haul out on the
// cross-beams and bark; pelicans and gulls stand on the rails.
//
// Built in the Boardwalk's frame (u along the beach, v out to sea), itself in its own:
// s out along the wharf, x across it (+x toward the Boardwalk).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DECK, toW, toL, merger, instancer, bulbs, signBoard, rng } from './rides/kit.js';
import { toWorld } from './geo.js';
import { seaLion, bird, loft, tube } from '../world/creatures.js';

// its foot on Beach Street and the way it points (bearing about 170°, nearly straight out)
const BASE = [-502, -24], DIR = [-0.105, 0.9945], LEN = 830, Y = 5.4;
const ANG = Math.atan2(DIR[0], DIR[1]);
// where a point of the wharf's frame is in the Boardwalk's, and back
export const wP = (s, x) => [BASE[0] + DIR[0] * s + DIR[1] * x, BASE[1] + DIR[1] * s - DIR[0] * x];
const wL = (u, v) => { const du = u - BASE[0], dv = v - BASE[1]; return [du * DIR[0] + dv * DIR[1], du * DIR[1] - dv * DIR[0]]; };
// the deck's outline [s, x] round: the long neck, the wide head, the narrower tip
const OUTLINE = [[0, -10], [520, -10], [520, -14], [772, -14], [772, -8], [LEN, -8], [LEN, 14], [772, 14], [772, 34], [520, 34], [520, 10], [0, 10]];
// the holes in the deck to look down at the sea lions [s, x, half-size]
const HOLES = [[738, 27, 1.6], [805, 2, 1.6]];
// the buildings [s0, s1, side (-1 west row facing east, +1 east row facing west), kind, name, paint]
const SHOPS = [
	[372, 384, 1, 'bait', 'BAIT & TACKLE', 'shingle'], [390, 403, 1, 'shop', 'KAYAK TOURS', 'seablue'], [409, 423, 1, 'candy', 'SALTWATER TAFFY', 'white'], [428, 441, 1, 'candy', 'FUDGE & CANDY', 'pinkwood'],
	[447, 462, 1, 'shop', 'GIFTS & SHELLS', 'sage'], [468, 482, 1, 'counter', 'FISH & CHIPS', 'white'], [488, 512, 1, 'counter', 'CLAM CHOWDER', 'seablue'],
	[526, 553, -1, 'restaurant', 'RIVA FISH HOUSE', 'shingle'], [558, 588, -1, 'restaurant', 'GILDA\'S', 'white'], [594, 612, -1, 'market', 'FISH MARKET', 'seablue'], [618, 632, -1, 'shop', 'WHARF GIFTS', 'sage'],
	[637, 650, -1, 'candy', 'CANDY SHOP', 'pinkwood'], [656, 684, -1, 'restaurant', 'SEAFOOD GRILL', 'shingle'], [696, 768, -1, 'restaurant', 'STAGNARO BROS.', 'wharfred'],
	[526, 548, 1, 'restaurant', 'CHOWDER HOUSE', 'white'], [554, 566, 1, 'candy', 'SALTWATER TAFFY', 'pinkwood'], [571, 583, 1, 'candy', 'FUDGE', 'white'], [589, 605, 1, 'shop', 'SOUVENIRS', 'seablue'],
	[611, 622, 1, 'bait', 'BAIT SHOP', 'shingle'], [628, 646, 1, 'market', 'FISH MARKET', 'white'], [652, 664, 1, 'counter', 'ICE CREAM', 'sage'], [670, 690, 1, 'shop', 'KITES & SHIRTS', 'seablue'],
];
const WALL = { shingle: 0x8b8e8a, seablue: 0x5f87a6, white: 0xe9e6dc, sage: 0x93a88c, pinkwood: 0xd9a3a8, wharfred: 0x9a3a2e };
// where a row's fronts and backs stand, across the wharf
const rowX = (s, side) => (s < 520 ? (side > 0 ? [4.4, 10] : [-4.4, -10]) : side > 0 ? [23, 34] : [-3, -14]);

function inOutline(s, x) {
	let inside = false;
	for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
		const [as, ax] = OUTLINE[i], [bs, bx] = OUTLINE[j];
		if ((ax > x) !== (bx > x) && s < (bs - as) * (x - ax) / (bx - ax) + as) inside = !inside;
	}
	return inside;
}
const inHole = (s, x) => HOLES.some(([hs, hx, h]) => Math.abs(s - hs) < h && Math.abs(x - hx) < h);
// the deck's width at a point along it
const span = (s) => (s < 520 ? [-10, 10] : s < 772 ? [-14, 34] : [-8, 14]);

function plankTexture() {
	const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
	const g = cv.getContext('2d');
	g.fillStyle = '#8a7a66'; g.fillRect(0, 0, 256, 256);
	for (let y = 0; y < 256; y += 16) {
		for (let x = 0; x < 256; x += 64) { const k = 110 + Math.floor(Math.random() * 40); g.fillStyle = `rgb(${k},${k - 14},${k - 30})`; g.fillRect(x + ((y / 16) % 2) * 32, y + 1, 63, 14); }
		g.fillStyle = 'rgba(40,32,24,0.8)'; g.fillRect(0, y, 256, 1.5);
	}
	for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(50,40,30,0.25)' : 'rgba(200,190,170,0.18)'; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 6, 1); }
	const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
function stripes(a, b) {
	const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16;
	const g = cv.getContext('2d');
	for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 16, 0, 16, 16); }
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
// a gull or a pelican standing on a rail (feet at y = 0, facing +z)
function perched(kind) {
	const pel = kind === 'pelican', k = pel ? 1.7 : 1;
	const lin = (c) => c.map((v) => Math.pow(v, 2.2));
	const back = lin(pel ? [0.42, 0.4, 0.38] : [0.62, 0.65, 0.68]), belly = lin(pel ? [0.52, 0.5, 0.46] : [0.96, 0.96, 0.95]), head = lin(pel ? [0.92, 0.9, 0.8] : [0.97, 0.97, 0.96]);
	const body = loft([[0, 0.14 * k, -0.2 * k, 0.01, 0.01, 0.01], [0, 0.16 * k, -0.12 * k, 0.07 * k, 0.05 * k, 0.05 * k], [0, 0.2 * k, 0.02 * k, 0.1 * k, 0.1 * k, 0.09 * k], [0, 0.28 * k, 0.12 * k, 0.07 * k, 0.07 * k, 0.07 * k], [0, 0.36 * k, 0.16 * k, 0.05 * k, 0.05 * k, 0.05 * k], [0, 0.4 * k, 0.2 * k, 0.045 * k, 0.045 * k, 0.04 * k], [0, 0.4 * k, 0.25 * k, 0.01, 0.01, 0.01]], { seg: 10, sub: 3, paint: (s, up) => (s > 0.62 ? head : up > 0.2 ? back : belly) });
	const bill = tube([[0, 0.4 * k, 0.24 * k, 0.012 * k], [0, pel ? 0.3 * k : 0.39 * k, (pel ? 0.5 : 0.31) * k, 0.008 * k]], { paint: () => lin(pel ? [0.7, 0.55, 0.35] : [0.95, 0.8, 0.2]) });
	const legs = [-1, 1].map((sx) => tube([[sx * 0.03 * k, 0.16 * k, 0, 0.008 * k], [sx * 0.03 * k, 0, 0.01, 0.007 * k]], { paint: () => lin(pel ? [0.2, 0.2, 0.2] : [0.85, 0.7, 0.4]) }));
	const g = mergeGeometries([body, bill, ...legs]);
	g.computeBoundingSphere();
	return g;
}

export function createWharf({ group, bay, sound, isPhone = false, signs = [], winMats = [] }) {
	const W = { solids: [], seats: [], counters: [], lions: [], swim: [], gulls: [], lampPools: null, built: false };
	const r = rng(1914);
	const paints = {};
	for (const [k, c] of Object.entries(WALL)) paints[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
	paints.deck = new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.95 });
	paints.deck.map.repeat.set(1, 1);
	const glowM = (col) => { const m = new THREE.MeshStandardMaterial({ color: 0x28343a, roughness: 0.15, metalness: 0.3, emissive: col, emissiveIntensity: 0.05 }); winMats.push(m); return m; };
	paints.win = glowM(0xffd9a0);
	paints.inside = glowM(0xfff0d0);
	// a box in the wharf's frame: w across (x), d along (s)
	const B = (Mg, w, h, d, key, s, x, y, tilt = 0) => { const [u, v] = wP(s, x); Mg.box(w, h, d, key, u, y, v, tilt, ANG, 0); };
	const ground = (s, x) => { const [u, v] = wP(s, x), [wx, wz] = toW(u, v); return bay.heightAt(wx, wz); };

	// ---------- the deck on its pilings ----------
	function buildDeck() {
		const Mg = merger();
		// the deck in strips along it, the holes cut out
		const rects = [[-2, 520, -10, 10], [520, 772, -14, 34], [772, LEN, -8, 14]];
		const cut = (R, [hs, hx, h]) => {
			const [s0, s1, x0, x1] = R;
			if (hs + h <= s0 || hs - h >= s1 || hx + h <= x0 || hx - h >= x1) return [R];
			return [[s0, hs - h, x0, x1], [hs + h, s1, x0, x1], [hs - h, hs + h, x0, hx - h], [hs - h, hs + h, hx + h, x1]].filter(([a, b, c, d]) => b - a > 0.05 && d - c > 0.05);
		};
		let parts = rects;
		for (const H of HOLES) parts = parts.flatMap((R) => cut(R, H));
		const deckG = [];
		for (const [s0, s1, x0, x1] of parts) {
			const g = new THREE.BoxGeometry(x1 - x0, 0.5, s1 - s0);
			// (planks run across the wharf: the texture in metres)
			const uv = g.attributes.uv, p = g.attributes.position;
			for (let i = 0; i < uv.count; i++) { uv.setXY(i, (p.getX(i) + (x0 + x1) / 2) / 8, (p.getZ(i) + (s0 + s1) / 2) / 4); }
			const [u, v] = wP((s0 + s1) / 2, (x0 + x1) / 2);
			g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(u, Y - 0.25, v), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ANG, 0)), new THREE.Vector3(1, 1, 1)));
			deckG.push(g);
		}
		const deck = new THREE.Mesh(mergeGeometries(deckG), paints.deck);
		deck.receiveShadow = true;
		group.add(deck);
		// the road's paint: the yellow line down the middle, the stalls, the head's angle parking
		for (let s = 4; s < 516; s += 9) B(Mg, 0.14, 0.02, 4.5, 'yellow', s, -1.75, Y + 0.01);
		for (let s = 530; s < 766; s += 9) B(Mg, 0.14, 0.02, 4.5, 'yellow', s, 2.5, Y + 0.01);
		for (const x of [-5.5, 2]) B(Mg, 0.1, 0.02, 516, 'white', 258, x, Y + 0.01);
		for (let s = 530; s < 764; s += 3) B(Mg, 0.1, 0.02, 5.6, 'white', s, 13, Y + 0.01, 0);
		// the landward ramp up from Beach Street
		const ramp = new THREE.BoxGeometry(20, 0.45, 20.6);
		const [ru, rv] = wP(-12, 0);
		const a = Math.atan2(Y - DECK, 20);
		ramp.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(ru, (Y + DECK) / 2 - 0.25, rv), new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, ANG, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
		const rm = new THREE.Mesh(ramp, new THREE.MeshStandardMaterial({ color: 0xb4ada2, roughness: 0.95 }));
		rm.receiveShadow = true;
		group.add(rm);
		// the rails all round: posts and two runs, white
		for (let i = 0; i + 1 < OUTLINE.length; i++) {
			const [as, ax] = OUTLINE[i], [bs, bx] = OUTLINE[i + 1], L = Math.hypot(bs - as, bx - ax), n = Math.max(1, Math.round(L / 2.4));
			const ms = (as + bs) / 2, mx = (ax + bx) / 2;
			const along = Math.abs(bs - as) > Math.abs(bx - ax);
			for (const hy of [0.55, 1.05]) B(Mg, along ? 0.12 : L, 0.08, along ? L : 0.12, 'white', ms, mx, Y + hy);
			for (let k = 0; k <= n; k++) B(Mg, 0.14, 1.1, 0.14, 'white', as + (bs - as) * k / n, ax + (bx - ax) * k / n, Y + 0.55);
		}
		// the holes' rails, and their signs
		for (const [hs, hx, h] of HOLES) {
			for (const [ds, dx, w, d] of [[-h - 0.1, 0, 2 * h + 0.3, 0.1], [h + 0.1, 0, 2 * h + 0.3, 0.1], [0, -h - 0.1, 0.1, 2 * h + 0.3], [0, h + 0.1, 0.1, 2 * h + 0.3]]) { B(Mg, w, 0.08, d, 'white', hs + ds, hx + dx, Y + 1.0); B(Mg, 0.12, 1.0, 0.12, 'white', hs + ds, hx + dx, Y + 0.5); }
			W.solids.push([hs - h - 0.25, hx - h - 0.25, hs + h + 0.25, hx + h + 0.25]);
			// (a board each way, back to back, so it reads from both sides)
			for (const e of [-1, 1]) {
				const sg = signBoard('SEA LION VIEWING', 2.6, 0.5, { w: 768, h: 150, bg: '#1e3c8c', fg: '#ffffff', border: '#ffffff', font: 'bold 96px Georgia, serif', glow: 0.2 });
				sg.material.side = THREE.FrontSide;
				const [su, sv] = wP(hs - h - 0.2 + e * 0.02, hx);
				sg.position.set(su, Y + 1.5, sv); sg.rotation.y = ANG + (e < 0 ? Math.PI : 0);
				group.add(sg); signs.push(sg);
			}
		}
		Mg.done(group, { shadow: !isPhone });
		// the arch at its foot
		const A = merger();
		for (const x of [-10.5, 10.5]) B(A, 0.6, 7, 0.6, 'white', -4, x, DECK + 3.5);
		B(A, 22, 0.5, 0.7, 'white', -4, 0, DECK + 7.1);
		A.done(group, { shadow: !isPhone });
		const s = signBoard('SANTA CRUZ MUNICIPAL WHARF', 14, 1.4, { bg: '#1e3c8c', fg: '#ffffff', border: '#ffffff', glow: 0.25 });
		const [su, sv] = wP(-4.3, 0);
		s.position.set(su, DECK + 6.2, sv); s.rotation.y = ANG + Math.PI;
		group.add(s); signs.push(s);
	}
	function buildPiles() {
		const piles = instancer(new THREE.CylinderGeometry(0.2, 0.22, 1, 6), new THREE.MeshStandardMaterial({ color: 0x3b2e24, roughness: 0.9 }));
		const Mg = merger();
		for (let s = 3; s < LEN; s += 5) {
			const [x0, x1] = span(s), n = Math.round((x1 - x0) / 3.4);
			let low = 1e9;
			for (let k = 0; k <= n; k++) {
				const x = x0 + 0.3 + (x1 - x0 - 0.6) * k / n, g = Math.min(ground(s, x), 1.2) - 1.5, [u, v] = wP(s, x);
				piles.at(u, (g + Y - 0.5) / 2, v, 1, Y - 0.5 - g, 1);
				low = Math.min(low, g);
			}
			// the cap across each row, the bracing, the low wales the sea lions lie on
			B(Mg, x1 - x0, 0.35, 0.35, 'darkwood', s, (x0 + x1) / 2, Y - 0.68);
			if (s % 10 === 3) B(Mg, x1 - x0, 0.3, 0.25, 'darkwood', s, (x0 + x1) / 2, 2.0);
			if (s % 15 === 8 && low < 0) for (let k = 0; k < n; k++) {
				const xa = x0 + 0.3 + (x1 - x0 - 0.6) * k / n, xb = x0 + 0.3 + (x1 - x0 - 0.6) * (k + 1) / n, [ua, va] = wP(s, xa), [ub, vb] = wP(s, xb);
				Mg.rod([ua, 0.6, va], [ub, Y - 1.0, vb], 0.07, 'darkwood', 4);
			}
		}
		// the stringers along under the deck
		for (const x of [-9, -5, -1, 3, 7]) B(Mg, 0.3, 0.3, 520, 'darkwood', 260, x, Y - 0.62);
		for (let x = -13; x < 34; x += 4) B(Mg, 0.3, 0.3, 252, 'darkwood', 646, x, Y - 0.62);
		for (let x = -7; x < 14; x += 4) B(Mg, 0.3, 0.3, 58, 'darkwood', 801, x, Y - 0.62);
		piles.done(group);
		Mg.done(group, { shadow: false });
	}

	// ---------- the buildings ----------
	const awn = [['#c8323a', '#f4f1ea'], ['#e86aa0', '#f4f1ea'], ['#2656a8', '#f4f1ea'], ['#2e8b57', '#f4f1ea']].map(([a, b]) => new THREE.MeshStandardMaterial({ map: stripes(a, b), roughness: 0.8, side: THREE.DoubleSide }));
	const goods = instancer(new THREE.BoxGeometry(0.22, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
	const GC = { candy: [0xf28cb8, 0xfff2a8, 0xa8e0f0, 0xffffff, 0xb8f0b0, 0xf0b070], shop: [0x2a64c8, 0xf2c230, 0xd8262e, 0xffffff, 0x2e9b57], market: [0xe0e8ee, 0xd89070, 0xf0a080, 0xc8d0d8], counter: [0xf2e0b0, 0xe8c070, 0xffffff], bait: [0x3a5a3a, 0x8a6a48, 0xc0c0b0], restaurant: [0xffffff] };
	function buildShops(list) {
		const Mg = merger(), L = bulbs();
		for (const [s0, s1, side, kind, name, wall] of list) {
			const [xf, xb] = rowX(s0, side), depth = Math.abs(xb - xf), len = s1 - s0, sm = (s0 + s1) / 2, xm = (xf + xb) / 2;
			const big = kind === 'restaurant', h = big ? 6.2 + r() * 1.2 : 4.4 + r() * 0.8, door = big ? 2.4 : Math.min(len - 3, 5.5);
			const into = side;          // (from the front into the room, across the wharf)
			const face = into > 0 ? ANG + Math.PI / 2 : ANG - Math.PI / 2;
			// the walls: back, ends, and the front either side of its doorway
			B(Mg, 0.3, h, len, wall, sm, xb, Y + h / 2);
			for (const e of [-1, 1]) B(Mg, depth, h, 0.3, wall, sm + e * (len / 2 - 0.15), xm, Y + h / 2);
			const pier = (len - door) / 2;
			for (const e of [-1, 1]) B(Mg, 0.3, h, pier, wall, sm + e * (door / 2 + pier / 2), xf, Y + h / 2);
			B(Mg, 0.3, h - 2.8, door, wall, sm, xf, Y + 2.8 + (h - 2.8) / 2);
			// the roof, and the false front over the street with the name on it
			B(Mg, depth + 0.8, 0.3, len + 0.6, 'darksteel', sm, xm, Y + h + 0.15);
			B(Mg, 0.3, 1.6, len, wall, sm, xf, Y + h + 0.8);
			B(Mg, 0.4, 0.2, len + 0.3, 'white', sm, xf, Y + h + 1.65);
			// windows (lit at night), a restaurant's big ones
			if (pier > 1.4) for (const e of [-1, 1]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.12, big ? 1.8 : 1.3, pier - 1.0), paints.win); const [u, v] = wP(sm + e * (door / 2 + pier / 2), xf + into * 0.05); g.position.set(u, Y + (big ? 1.9 : 1.7), v); g.rotation.y = ANG; group.add(g); }
			// the room: its lit ceiling, the counter across it, the shelves behind
			const ceil = new THREE.Mesh(new THREE.BoxGeometry(depth - 0.8, 0.06, len - 0.8), paints.inside);
			const [cu, cv] = wP(sm, xm); ceil.position.set(cu, Y + h - 0.35, cv); ceil.rotation.y = ANG; group.add(ceil);
			const xc = xf + into * 0.6 * depth;          // (across the room, near the back)
			if (!big) {
				B(Mg, 0.9, 1.0, len - 2.4, kind === 'market' ? 'white' : 'wood', sm, xc, Y + 0.5);
				B(Mg, 1.1, 0.06, len - 2.2, kind === 'market' ? 'steel' : 'plank', sm, xc, Y + 1.03);
				B(Mg, 0.5, 2.2, len - 1.2, 'darkwood', sm, xb - into * 0.45, Y + 1.1);
				const gc = GC[kind] || GC.shop;
				for (let k = 0; k < (isPhone ? 10 : 22); k++) { const q = r(), [u, v] = wP(s0 + 1 + q * (len - 2), xb - into * (0.4 + (k % 2) * 0.1)); goods.at(u, Y + 0.5 + Math.floor(r() * 4) * 0.5, v, 1, 1, 1, ANG, new THREE.Color(gc[Math.floor(r() * gc.length)])); }
				if (kind === 'market') for (let k = 0; k < 10; k++) { const [u, v] = wP(s0 + 1.5 + k * (len - 3) / 10, xc); goods.at(u, Y + 1.1, v, 2.4, 0.5, 0.8, ANG + 0.3, new THREE.Color(k % 2 ? 0xc8d0d8 : 0xd89070)); }
				W.solids.push([s0 + 1.2, Math.min(xc - 0.45, xc + 0.45), s1 - 1.2, Math.max(xc - 0.45, xc + 0.45)]);
				// the clerk behind the counter, customers in front of it
				for (const k of [0.3, 0.7]) { const [u, v] = wP(s0 + k * len, xc - into * 1.0); W.counters.push({ u, v, y: Y, heading: face }); }
				{ const [u, v] = wP(sm, xc + into * 1.0); W.counters.push({ u, v, y: Y, heading: face + Math.PI }); }
			} else {
				// tables and chairs
				for (let a = s0 + 2.5; a < s1 - 2; a += 3.2) for (let b = 1.6; b < depth - 1.4; b += 2.8) {
					const x = xf + into * b;
					B(Mg, 0.9, 0.06, 0.9, 'white', a, x, Y + 0.75); B(Mg, 0.1, 0.75, 0.1, 'darksteel', a, x, Y + 0.37);
					for (const e of [-0.75, 0.75]) { B(Mg, 0.45, 0.45, 0.45, 'darkwood', a + e, x, Y + 0.22); const [u, v] = wP(a + e, x); W.seats.push({ u, v, y: Y, h: 0.45, sit: true, table: true, heading: e > 0 ? ANG + Math.PI : ANG }); }
					W.solids.push([a - 0.5, x - 0.5, a + 0.5, x + 0.5]);
				}
			}
			// an awning over the door (striped over the candy), and the sign
			const aw = new THREE.Mesh(new THREE.PlaneGeometry(door + 2, 1.4), awn[kind === 'candy' ? 1 : Math.floor(r() * awn.length)]);
			const [au, av] = wP(sm, xf - into * 0.7); aw.position.set(au, Y + 2.95, av); aw.rotation.set(0, ANG + (side > 0 ? -Math.PI / 2 : Math.PI / 2), 0); aw.rotateX(-0.9);
			group.add(aw);
			const bg = { restaurant: '#f4efe2', candy: '#fff0f5', market: '#1e3c8c', bait: '#2e4a2e', counter: '#b3202a', shop: '#1e5c6a' }[kind];
			const fg = { restaurant: '#1e3c8c', candy: '#c8326a', market: '#ffffff', bait: '#f2e6c0', counter: '#fff6dc', shop: '#ffffff' }[kind];
			const sg = signBoard(name, Math.min(len - 1, big ? 12 : 8), big ? 1.2 : 0.95, { w: 1024, h: 150, bg, fg, border: fg, font: 'bold 110px Georgia, serif', glow: 0.3 });
			const [su, sv] = wP(sm, xf - into * 0.2); sg.position.set(su, Y + h + 0.8, sv); sg.rotation.y = ANG + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
			group.add(sg); signs.push(sg);
			// the bulbs along the false front
			for (let a = s0 + 0.5; a < s1; a += 0.8) { const [u, v] = wP(a, xf - into * 0.25); L.add(u, Y + h + 1.75, v); }
			// walls to walk round (ends, back, the front's piers)
			const lo = Math.min(xf, xb), hi = Math.max(xf, xb);
			W.solids.push([s0, lo, s0 + 0.35, hi], [s1 - 0.35, lo, s1, hi], [s0, xb - 0.2, s1, xb + 0.2]);
			for (const e of [-1, 1]) { const a0 = e < 0 ? s0 : sm + door / 2, a1 = e < 0 ? sm - door / 2 : s1; W.solids.push([a0, xf - 0.2, a1, xf + 0.2]); }
		}
		Mg.done(group, { shadow: !isPhone, paints });
		L.done(group, 0.9);
	}

	// ---------- lamps, benches, the parked cars ----------
	function buildStreet() {
		const Mg = merger(), L = bulbs(), P = [];
		for (let s = 10; s < LEN; s += 26) { const [x0, x1] = span(s); P.push([s, x0 + 0.6], [s, x1 - 0.6]); }
		for (const [s, x] of P) {
			if (inOutline(s, x) === false) continue;
			B(Mg, 0.14, 4.4, 0.14, 'black', s, x, Y + 2.2);
			const [u, v] = wP(s, x); L.add(u, Y + 4.5, v);
		}
		// benches facing out along the rails
		for (let s = 20; s < LEN; s += 34) for (const x of [span(s)[0] + 1.3, span(s)[1] - 1.3]) {
			if (s > 360 && s < 515 && x > 0) continue;
			if (s > 520 && s < 772) continue;
			const [u, v] = wP(s, x), f = x < 0 ? ANG - Math.PI / 2 : ANG + Math.PI / 2;
			B(Mg, 0.5, 0.08, 1.8, 'plank', s, x, Y + 0.46);
			B(Mg, 0.06, 0.45, 1.8, 'plank', s, x - Math.sign(x) * 0.25, Y + 0.72);
			W.seats.push({ u, v, y: Y, h: 0.46, sit: true, heading: f });
			W.solids.push([s - 0.95, x - 0.35, s + 0.95, x + 0.35]);
		}
		// people fishing at the rails (standing places), a line of benches round the tip
		for (let s = 60; s < LEN; s += 23) { const [x0] = span(s); const [u, v] = wP(s, x0 + 0.7); W.counters.push({ u, v, y: Y, heading: ANG - Math.PI / 2, rail: true }); }
		Mg.done(group, { shadow: false });
		W.lamps = L.done(group, 1.3);
		// the cars: parallel down the neck, angled on the head
		const CC = [0xf4f1ea, 0x222222, 0x8a9096, 0xb3202a, 0x2656a8, 0x3a3f45, 0xd9d4c8, 0x5a6e50];
		const body = instancer(new THREE.BoxGeometry(1.8, 0.8, 4.4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 }));
		const cab = instancer(new THREE.BoxGeometry(1.6, 0.6, 2.3), new THREE.MeshStandardMaterial({ color: 0x1a2226, roughness: 0.1, metalness: 0.5 }));
		const car = (s, x, a) => { const [u, v] = wP(s, x), c = new THREE.Color(CC[Math.floor(r() * CC.length)]); body.at(u, Y + 0.62, v, 1, 1, 1, ANG + a, c); cab.at(u, Y + 1.3, v, 1, 1, 1, ANG + a); W.solids.push([s - 2.4, x - 1.1, s + 2.4, x + 1.1]); };
		for (let s = 30; s < 510; s += 6.2) { if (r() < 0.55) car(s, -6.75, 0); if (s < 360 && r() < 0.5) car(s, 3.2, 0); }
		for (let s = 532; s < 762; s += 3) if (r() < 0.6) car(s, 13, 0.6);
		body.done(group); cab.done(group);
		// the pools of light, after dark
		const cv = document.createElement('canvas'); cv.width = cv.height = 64;
		const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.6, 'rgba(255,190,120,0.3)'); gr.addColorStop(1, 'rgba(255,180,110,0)');
		g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
		const pm = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
		const pools = instancer(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), pm);
		for (const [s, x] of P) { const [u, v] = wP(s, x - Math.sign(x) * 2); pools.at(u, Y + 0.03, v); }
		pools.done(group);
		W.poolMat = pm;
		goods.done(group);
	}

	// ---------- the animals: sea lions under the end, birds on the rails ----------
	function buildAnimals() {
		const lionM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55 });
		const geos = [seaLion(0.2), seaLion(0.55), seaLion(0.85)];
		const n = isPhone ? 10 : 18;
		for (let k = 0; k < n; k++) {
			// on the low wales (every tenth metre, 2 m up) under the head and the tip
			const s = 603 + Math.floor(r() * 22) * 10, [x0, x1] = span(s), x = x0 + 1.5 + r() * (x1 - x0 - 3);
			const m = new THREE.Mesh(geos[k % 3], lionM);
			const [u, v] = wP(s, x);
			m.position.set(u, 2.15, v); m.rotation.y = ANG + (r() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (r() - 0.5) * 0.3;
			const sc = 0.85 + r() * 0.4; m.scale.setScalar(sc);
			m.castShadow = !isPhone;
			group.add(m);
			W.lions.push({ m, ph: r() * 10, bark: 0, ry: m.rotation.y });
		}
		// a few in the water round the end
		for (let k = 0; k < 4; k++) {
			const m = new THREE.Mesh(geos[k % 3], lionM);
			group.add(m);
			W.swim.push({ m, s: 640 + r() * 180, x: r() < 0.5 ? -24 - r() * 20 : 44 + r() * 20, a: r() * 6.28, sp: 0.6 + r() * 0.5 });
		}
		// gulls and pelicans on the rails
		const birdM = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.7 });
		const gl = instancer(perched('gull'), birdM), pl = instancer(perched('pelican'), birdM);
		for (let k = 0; k < (isPhone ? 18 : 34); k++) {
			const s = 40 + r() * (LEN - 50), [x0, x1] = span(s), x = r() < 0.5 ? x0 : x1, [u, v] = wP(s, x);
			(s > 600 && r() < 0.3 ? pl : gl).at(u, Y + 1.1, v, 1, 1, 1, ANG + r() * 6.28);
		}
		gl.done(group); pl.done(group);
		// gulls wheeling overhead
		const gg = bird('gull');
		for (let k = 0; k < 6; k++) {
			const m = new THREE.Mesh(gg, birdM);
			group.add(m);
			W.gulls.push({ m, s: 300 + r() * 500, x: r() * 30 - 10, rad: 18 + r() * 30, h: 12 + r() * 16, ph: r() * 6.28, sp: 0.2 + r() * 0.15 });
		}
	}

	// ---------- the lighthouse on Lighthouse Point, across the water to the west ----------
	function buildLighthouse() {
		const p = toWorld(36.95145, -122.02675), [u, v] = toL(p.x, p.z), y = Math.max(2, bay.heightAt(p.x, p.z));
		const Mg = merger(), L = bulbs();
		// the red brick house and its square tower, white trim, the lantern on top
		Mg.box(7, 3.6, 6, 'darkred', u + 3, y + 1.8, v).box(7.6, 0.4, 6.6, 'white', u + 3, y + 3.8, v);
		Mg.box(3.2, 11, 3.2, 'darkred', u, y + 5.5, v).box(4.2, 0.35, 4.2, 'white', u, y + 11.1, v);
		for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; Mg.box(0.08, 0.9, 0.08, 'white', u + Math.cos(a) * 1.95, y + 11.7, v + Math.sin(a) * 1.95); }
		Mg.cyl(1.2, 1.2, 1.8, 'glass', u, y + 12.2, v, 12).geo(new THREE.ConeGeometry(1.45, 1.1, 12), 'darksteel', u, y + 13.65, v).cyl(0.06, 0.06, 1.2, 'darksteel', u, y + 14.6, v, 4);
		Mg.done(group, { shadow: !isPhone });
		L.add(u, y + 12.2, v, [1, 0.95, 0.8]);
		L.done(group, 4);
	}

	// ---------- walking ----------
	function floor(u, v, y) {
		const [s, x] = wL(u, v);
		if (s < -24 || s > LEN + 1 || x < -15 || x > 35) return null;
		if (s < 0 && Math.abs(x) < 10.2) { const fy = DECK + (Y - DECK) * Math.min(1, Math.max(0, (s + 22) / 20)); return y > fy - 1.6 ? fy : null; }
		if (!inOutline(s, x) || inHole(s, x)) return null;
		return y > Y - 1.4 ? Y : null;
	}
	// out of the walls, and kept on the deck by the rails
	function push(u, v, footY) {
		let [s, x] = wL(u, v);
		if (s < -2 || s > LEN + 2 || x < -16 || x > 36 || Math.abs(footY - Y) > 1.2) return null;
		const R = 0.3;
		let moved = false;
		for (const q of W.solids) {
			if (s < q[0] - R || s > q[2] + R || x < q[1] - R || x > q[3] + R) continue;
			const pen = [s - (q[0] - R), q[2] + R - s, x - (q[1] - R), q[3] + R - x], m = Math.min(...pen), k = pen.indexOf(m);
			if (k === 0) s = q[0] - R; else if (k === 1) s = q[2] + R; else if (k === 2) x = q[1] - R; else x = q[3] + R;
			moved = true;
		}
		// the rails: back inside the outline
		if (!inOutline(s, x) && s > 1) {
			let best = null, bd = 1e9;
			for (let i = 0; i + 1 < OUTLINE.length; i++) {
				const [as, ax] = OUTLINE[i], [bs, bx] = OUTLINE[i + 1], ds = bs - as, dx = bx - ax, l2 = ds * ds + dx * dx;
				const t = Math.max(0, Math.min(1, ((s - as) * ds + (x - ax) * dx) / l2)), ps = as + ds * t, px = ax + dx * t, d = Math.hypot(s - ps, x - px);
				if (d < bd) { bd = d; best = [ps, px]; }
			}
			if (best && bd < 3) { const ds = best[0] - s, dx = best[1] - x, l = Math.hypot(ds, dx) || 1; s = best[0] + ds / l * 0.35; x = best[1] + dx / l * 0.35; moved = true; }
		}
		return moved ? wP(s, x) : null;
	}

	// ---------- visitors: on the sidewalks and in the shops, at the rails ----------
	function venue(lu, lv, ly, k) {
		if (!W.built) return null;
		const [s, x] = wL(lu, lv);
		if (s < -30 || s > LEN + 40 || x < -40 || x > 60 || ly > Y + 40) return null;
		const pick = (s0, s1, x0, x1) => (rr) => { const a = Math.max(0, Math.min(LEN, s + (rr() - 0.5) * 120)), q = Math.max(s0, Math.min(s1, a)), [u, v] = wP(q, x0 + rr() * (x1 - x0)), [wx, wz] = toW(u, v); return { x: wx, z: wz, y: Y }; };
		const areas = [
			{ w: 0.4, pick: pick(0, 516, -9.6, -8.2) },
			{ w: 0.3, pick: pick(0, 355, 5, 9.6) },
			{ w: 0.3, pick: pick(524, 768, 20.2, 22.8) },
			{ w: 0.3, pick: pick(524, 768, -2.8, -1.2) },
			{ w: 0.2, pick: pick(776, LEN - 1, -7, 13) },
		];
		const out = { n: Math.round(22 * k), kids: 0.3, areas };
		if (Math.random() < 0.45) out.areas = [{ w: 1, seats: W.seatList }];
		return out;
	}

	// ---------- each frame ----------
	let barkT = 4, gullT = 6;
	const tmpE = new THREE.Euler();
	function update(dt, t, lu, lv, ly, night) {
		if (!W.built) return;
		const [s, x] = wL(lu, lv), near = Math.hypot(Math.max(0, Math.abs(s - LEN / 2) - LEN / 2), Math.max(0, Math.abs(x - 10) - 25));
		if (W.poolMat) W.poolMat.opacity = night * 0.55;
		if (near > 700) return;
		// the sea lions: breathing, a head lifted to bark now and then
		for (const L of W.lions) {
			L.ph += dt;
			L.bark = Math.max(0, L.bark - dt);
			const lift = L.bark > 0 ? Math.sin(Math.min(1, (1.6 - L.bark) * 3) * Math.PI / 2) * 0.35 : 0;
			L.m.rotation.set(-lift + Math.sin(L.ph * 0.9) * 0.02, L.ry, 0);
		}
		for (const S of W.swim) {
			S.a += dt * S.sp * 0.08;
			const [u, v] = wP(S.s + Math.cos(S.a) * 25, S.x + Math.sin(S.a) * 12);
			S.m.position.set(u, -0.55 + Math.sin(t * 1.3 + S.s) * 0.08, v);
			S.m.rotation.copy(tmpE.set(0.2, ANG + Math.atan2(-Math.sin(S.a) * 25, Math.cos(S.a) * 12), 0));
		}
		for (const G of W.gulls) {
			G.ph += dt * G.sp;
			const [u, v] = wP(G.s + Math.cos(G.ph) * G.rad, G.x + Math.sin(G.ph) * G.rad);
			G.m.position.set(u, Y + G.h + Math.sin(G.ph * 3) * 1.5, v);
			G.m.rotation.set(0, ANG + G.ph + Math.PI, 0.35);
		}
		// their sounds, from where they are
		const dl = Math.hypot(Math.max(0, Math.abs(s - 710) - 110), Math.max(0, Math.abs(x - 10) - 25), Math.max(0, ly - Y - 5));
		barkT -= dt;
		if (barkT < 0 && W.lions.length) {
			barkT = 2 + Math.random() * 7;
			const L = W.lions[Math.floor(Math.random() * W.lions.length)];
			L.bark = 1.6;
			if (dl < 250) bark(0.16 * Math.max(0, 1 - dl / 250) ** 1.5);
		}
		gullT -= dt;
		if (gullT < 0) { gullT = 4 + Math.random() * 9; if (near < 150) cry(0.03 * Math.max(0, 1 - near / 150)); }
	}
	// a sea lion's bark: a run of hoarse, falling "ar"s
	function bark(gain) {
		const out = sound?.get();
		if (!out) return;
		const c = out.context, n = 3 + Math.floor(Math.random() * 4), f0 = 230 + Math.random() * 120;
		for (let k = 0; k < n; k++) {
			const t = c.currentTime + k * (0.3 + Math.random() * 0.08);
			const o = c.createOscillator(); o.type = 'sawtooth';
			o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.2);
			const g = c.createGain();
			g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.025); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
			for (const [f, q, kk] of [[650, 4, 1], [1250, 6, 0.6], [2500, 5, 0.25]]) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f * (0.9 + Math.random() * 0.2); b.Q.value = q; const bg = c.createGain(); bg.gain.value = kk; o.connect(b); b.connect(bg); bg.connect(g); }
			g.connect(out);
			o.start(t); o.stop(t + 0.3);
		}
		sound.click(gain * 0.4, 900, 1.2, 0.2);
	}
	// a gull's cry: a few high falling calls
	function cry(gain) {
		const out = sound?.get();
		if (!out) return;
		const c = out.context;
		for (let k = 0; k < 3; k++) {
			const t = c.currentTime + k * 0.22, o = c.createOscillator(); o.type = 'triangle';
			o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(1150, t + 0.18);
			const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
			o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.22);
		}
	}

	const steps = [
		buildDeck, buildPiles,
		...[0, 4, 8, 11, 14, 18].map((k, i, A) => () => buildShops(SHOPS.slice(k, A[i + 1] ?? SHOPS.length))),
		buildStreet, buildAnimals, buildLighthouse,
		() => { W.seatList = [...W.seats, ...W.counters].map((q) => { const [x, z] = toW(q.u, q.v); return { x, z, y: q.y, h: q.h || 0, sit: !!q.sit, table: !!q.table, heading: q.heading + 16 * Math.PI / 180, taken: false }; }); W.built = true; },
	];
	return { steps, floor, push, venue, update, get built() { return W.built; }, info: () => ({ built: W.built, shops: SHOPS.length, lions: W.lions.length, seats: W.seats.length + W.counters.length }), geom: { BASE, DIR, LEN, Y } };
}
