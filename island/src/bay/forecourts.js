// The suburbs' gas stations and corner stores, built out as they stand on the real streets
// (Josh 2026-10-23: the neighbourhoods are homes, "aside from the occasional corner store, and
// gas station (which need to be fully designed, do this)"). bay/siteplan.js chose their corners
// and put each one's building on the map as a shop (city.js raises it, economy/ names and signs
// it, commercial.js builds its inside), and the road map paints its paving, its drives and its
// spaces (realcity.js). Here, within a few hundred metres, the rest of it:
//   a gas station: the canopy over the pumps in its brand's colours, its name on the fascia and
//     the lights recessed in its underside; three islands, each with two dispensers (a screen,
//     the grade buttons and the nozzles each side, hoses down to them), a column holding up the
//     canopy, the bin and the squeegee bucket, yellow bollards at the ends; the price sign on
//     its planter at the corner (the brand over four grades in LED digits); before the food mart
//     the ice box and the propane exchange cage, bollards along the walk and wheel stops in the
//     spaces; the air and water machine, the tanks' fill caps, the dumpster in its block pen
//   a corner store: its pole sign at the corner (the name and what it sells), the ice box by the
//     door, the news racks and the bin, the neon OPEN and the posters in the window, the lamps
//     over the front, bollards along the walk, the dumpster pen out back
// Each site is merged per material: a handful of draws, built a few milliseconds a frame. The
// canopy's lights, the lamps over a store front and the price sign's glow fall on the ground at
// night through bay/nightlights.js (sites() there), not through lights of their own.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LOTS, PUMP_X, siteHash } from './siteplan.js';
import { establish } from '../economy/establishments.js';
import { buildSlice } from '../world/buildslice.js';

// the canopy over the pumps (x along the main street, z toward it), how high its underside stands
// over the highest ground beneath it, and its fascia
export const CANOPY = { x0: -14, x1: 14, z0: 3.5, z1: 14.5, under: 4.9, fascia: 1.1 };
// where the canopy's lights are (over the lanes between the islands)
export const CANOPY_LIGHTS = { x: [-12, -4, 4, 12], z: [5.5, 9, 12.5] };
const ISLAND = { hw: 0.65, z0: 5.7, z1: 12.3, h: 0.2 }, DISP_Z = [7.4, 10.6], COLUMN_Z = 9;

// the sign sheet: one canvas a site (its brand, its prices, its labels), regions in a 1024 x 512 sheet
const SHEET = { w: 1024, h: 512 };
const R = {
	fascia: [0, 0, 1024, 128], pylon: [0, 128, 288, 384], pole: [288, 128, 448, 224], top: [288, 352, 224, 80], ice: [512, 352, 224, 80],
	propane: [736, 128, 288, 80], air: [736, 208, 288, 80], open: [736, 288, 288, 112], poster: [736, 400, 288, 112], atm: [288, 432, 224, 80], beer: [512, 432, 224, 80],
};
const GRADES = [['REGULAR', '87', 0], ['PLUS', '89', 0.2], ['PREMIUM', '91', 0.4], ['DIESEL', '', 0.36]];
// a size of type that fits w, from size down
function fit(g, text, w, size, weight = 'bold', face = '"Helvetica Neue", Arial, sans-serif') {
	let s = size;
	do { g.font = `${weight} ${s}px ${face}`; if (g.measureText(text).width <= w) break; s -= 2; } while (s > 8);
	return s;
}
// a site's sheet: E { name, bg, fg, tag }, prices from the site's own dice
function drawSheet(cv, site, E, k) {
	const g = cv.getContext('2d');
	g.setTransform(k, 0, 0, k, 0, 0);
	g.textAlign = 'center'; g.textBaseline = 'middle';
	const box = (r, bg) => { g.fillStyle = bg; g.fillRect(r[0], r[1], r[2], r[3]); };
	const say = (r, text, col, size, y = 0.5, w = 0.88, weight = 'bold') => { fit(g, text, r[2] * w, size, weight); g.fillStyle = col; g.fillText(text, r[0] + r[2] / 2, r[1] + r[3] * y); };
	const name = (E.name || '').toUpperCase();
	// the fascia: the brand's colour, a band of its second colour along the bottom, the name
	box(R.fascia, E.bg); g.fillStyle = E.fg; g.fillRect(0, 104, 1024, 14);
	say([0, 0, 1024, 104], name, E.fg, 84, 0.54, 0.92);
	// the price sign: the name over the grades, the prices in red LED digits on black
	box(R.pylon, '#111'); box([R.pylon[0] + 8, R.pylon[1] + 8, 272, 104], E.bg);
	say([R.pylon[0] + 8, R.pylon[1] + 8, 272, 104], name, E.fg, 46, 0.52, 0.9);
	const base = 4.59 + Math.floor(siteHash(site.x, site.z, 31) * 80) / 100;
	GRADES.forEach(([label, oct, up], i) => {
		const y = R.pylon[1] + 124 + i * 64;
		g.fillStyle = '#1e1e1e'; g.fillRect(R.pylon[0] + 8, y, 272, 58);
		g.textAlign = 'left'; fit(g, label, 110, 22); g.fillStyle = '#f2f2f2'; g.fillText(label, R.pylon[0] + 16, y + 20);
		if (oct) { fit(g, oct, 60, 18, 'normal'); g.fillStyle = '#bbb'; g.fillText(oct, R.pylon[0] + 16, y + 42); }
		g.textAlign = 'right';
		const p = (base + up).toFixed(2);
		g.font = 'bold 40px "Courier New", monospace'; g.fillStyle = '#ff3b1f'; g.shadowColor = '#ff3b1f'; g.shadowBlur = 8;
		g.fillText(p, R.pylon[0] + 254, y + 30);
		g.font = 'bold 20px "Courier New", monospace'; g.fillText('9', R.pylon[0] + 272, y + 18);
		g.shadowBlur = 0; g.textAlign = 'center';
	});
	// the corner store's pole sign: the name, and what it sells under it
	box(R.pole, E.bg); g.fillStyle = E.fg; g.fillRect(R.pole[0], R.pole[1] + 150, R.pole[2], 6);
	say([R.pole[0], R.pole[1], R.pole[2], 150], name, E.fg, 60, 0.52, 0.9);
	say([R.pole[0], R.pole[1] + 156, R.pole[2], 68], (E.tag || 'GROCERY · LOTTO · ICE').toUpperCase(), E.fg, 30, 0.5, 0.9);
	// the dispensers' toppers
	box(R.top, E.bg); say(R.top, name, E.fg, 40, 0.54, 0.9);
	// the ice box, the propane cage, the air machine
	box(R.ice, '#f4f8fb'); say(R.ice, 'ICE', '#1565c0', 64, 0.56, 0.6, '900');
	box(R.propane, '#0d47a1'); say(R.propane, 'PROPANE EXCHANGE', '#ffffff', 32, 0.52);
	box(R.air, '#c62828'); say(R.air, 'AIR · WATER', '#ffffff', 40, 0.54);
	// the window: a neon OPEN, the posters, the ATM's sticker
	box(R.open, '#050505');
	g.shadowColor = '#ff2d55'; g.shadowBlur = 18; say(R.open, 'OPEN', '#ff6b8a', 78, 0.54, 0.8, '900'); g.shadowBlur = 0;
	g.strokeStyle = '#2d7bff'; g.lineWidth = 5; g.shadowColor = '#2d7bff'; g.shadowBlur = 10; g.strokeRect(R.open[0] + 12, R.open[1] + 10, R.open[2] - 24, R.open[3] - 20); g.shadowBlur = 0;
	box(R.poster, '#fdd835'); say([R.poster[0], R.poster[1], R.poster[2], 70], site.kind === 'fuel' ? 'COFFEE · SNACKS' : 'BEER · WINE', '#b71c1c', 40, 0.55); say([R.poster[0], R.poster[1] + 64, R.poster[2], 48], 'LOTTO · ICE · ATM', '#1a1a1a', 30, 0.5);
	box(R.atm, '#1b5e20'); say(R.atm, 'ATM', '#ffffff', 56, 0.56, 0.6, '900');
	box(R.beer, '#000'); g.shadowColor = '#ffb300'; g.shadowBlur = 14; say(R.beer, site.kind === 'fuel' ? 'FOOD MART' : 'COLD BEER', '#ffca28', 40, 0.54); g.shadowBlur = 0;
}

export function createForecourts(scene, bay, real, city, { isPhone = false } = {}) {
	const root = new THREE.Group();
	root.name = 'forecourts';
	scene.add(root);
	const NEAR = isPhone ? 260 : 420, FAR = NEAR + 120, SLICE = isPhone ? 3 : 5, K = isPhone ? 0.5 : 1;
	const S = (hex, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, ...extra });
	const mat = {
		// everything painted (the canopy, the dispensers, the bollards, the bins, the cage's tanks):
		// one material, each part's colour in its vertices
		paint: S('#ffffff', 0.5, { vertexColors: true }),
		metal: S('#c4c8cc', 0.32, { metalness: 0.65 }),
		dark: S('#1c1d1f', 0.6),
		concrete: S('#b8b3a8', 0.88),
		block: S('#a49d92', 0.95),
		// the canopy's lights and the store front's lamps, and the dispensers' screens
		glow: S('#ffffff', 0.4, { emissive: new THREE.Color('#eef4ff'), emissiveIntensity: 0.6 }),
		screen: S('#0b1622', 0.25, { emissive: new THREE.Color('#3d86e8'), emissiveIntensity: 0.9 }),
		// the canopy's underside: white panels, lit from below by the slab and by its own lights
		// (left to the sky alone, a face looking down goes the ground's brown)
		soffit: S('#f2f3f4', 0.7, { emissive: new THREE.Color('#e2e7ec'), emissiveIntensity: 0.35 }),
	};
	const built = new Map();
	let job = null;

	// a site's name and colours: the economy's plan for its building (city.js), or the same roll
	// made here while the plan has not come in
	function brandOf(site) {
		const st = site.store;
		const E = city?.economy?.raw?.(st.x, st.z, 2)?.find((q) => q.type === site.kind);
		if (E) return { name: E.name, bg: E.sign.bg, fg: E.sign.fg, tag: E.tag, real: true };
		const F = establish({ x: st.x, z: st.z, w: st.w, d: st.d, a: st.a, h: st.wallH, use: 'retail', street: 2, store: site.kind, venue: 'shop' });
		return F ? { name: F.name, bg: F.sign.bg, fg: F.sign.fg, tag: F.tag, real: false } : { name: site.kind === 'fuel' ? 'Gas' : 'Market', bg: '#c8102e', fg: '#ffffff', tag: '', real: false };
	}

	function* build(site) {
		const B = { site, group: new THREE.Group(), solid: [], floors: [], parts: new Map(), brand: brandOf(site) };
		const parts = B.parts, side = site.side, X = (lx) => lx * side;
		const ca = Math.cos(site.a), sa = Math.sin(site.a);
		const y0 = bay.heightAt(site.x, site.z);
		// the ground under a point of the lot, from the lot's middle
		const gy = (lx, lz) => bay.heightAt(site.x + ca * lx - sa * lz, site.z + sa * lx + ca * lz) - y0;
		const add = (m, geo) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(geo); };
		const col = new THREE.Color();
		const tint = (geo, hex) => { col.set(hex); const n = geo.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
		// a box (centre x, z; from y up h), in a material or painted a colour; solid ones are kept
		// for walking into (their footprint in the lot's frame, and how high)
		const box = (m, w, h, d, x, y, z, ry = 0, solid = false) => {
			const geo = new THREE.BoxGeometry(w, h, d);
			if (ry) geo.rotateY(ry);
			geo.translate(x, y + h / 2, z);
			if (typeof m === 'string') { tint(geo, m); add(mat.paint, geo); } else add(m, geo);
			if (solid) B.solid.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2, y, y + h]);
		};
		const cyl = (m, r, h, x, y, z, seg = 10, r2 = r) => {
			const geo = new THREE.CylinderGeometry(r2, r, h, seg).translate(x, y + h / 2, z);
			if (typeof m === 'string') { tint(geo, m); add(mat.paint, geo); } else add(m, geo);
		};
		// a face of the sign sheet: region r on a plane w x h, at (x, y, z) facing yaw (0: +z)
		const sheet = document.createElement('canvas');
		sheet.width = SHEET.w * K; sheet.height = SHEET.h * K;
		drawSheet(sheet, site, B.brand, K);
		const tex = new THREE.CanvasTexture(sheet);
		tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = isPhone ? 2 : 8;
		const signM = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.55, roughness: 0.45 });
		B.tex = tex; B.signM = signM; B.sheet = sheet;
		const face = (r, w, h, x, y, z, yaw) => {
			const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
			for (let i = 0; i < uv.count; i++) uv.setXY(i, (r[0] + uv.getX(i) * r[2]) / SHEET.w, 1 - (r[1] + (1 - uv.getY(i)) * r[3]) / SHEET.h);
			geo.rotateY(yaw).translate(x, y, z);
			add(signM, geo);
		};
		const bollard = (x, z, hex = '#f2c200') => { const g = gy(x, z); cyl(hex, 0.1, 1.0, x, g, z, 10); cyl(hex, 0.1, 0.06, x, g + 1.0, z, 10, 0.05); B.solid.push([x - 0.12, z - 0.12, x + 0.12, z + 0.12, g, g + 1.06]); };
		// the dumpster in its pen of block: three walls, two steel gates
		const pen = (x0, z0, x1, z1) => {
			const g = Math.min(gy(x0, z0), gy(x1, z1)), H = 1.8, xm = (x0 + x1) / 2;
			box(mat.block, x1 - x0, H + 0.3, 0.2, xm, g - 0.3, z0 + 0.1, 0, true);
			box(mat.block, 0.2, H + 0.3, z1 - z0, x0 + 0.1, g - 0.3, (z0 + z1) / 2, 0, true);
			box(mat.block, 0.2, H + 0.3, z1 - z0, x1 - 0.1, g - 0.3, (z0 + z1) / 2, 0, true);
			for (const s of [-1, 1]) box('#2f4a3a', (x1 - x0) / 2 - 0.25, 1.6, 0.06, xm + s * ((x1 - x0) / 4 - 0.05), g + 0.1, z1 - 0.05, 0, true);
			box('#24563a', 1.9, 1.15, 1.1, xm, g, (z0 + z1) / 2 - 0.1);
			box('#1d4430', 1.95, 0.08, 1.15, xm, g + 1.15, (z0 + z1) / 2 - 0.15, 0);
		};
		// the ice box by the door: white, its two doors, ICE across the front
		const iceBox = (x, z, yaw = 0) => {
			const g = gy(x, z);
			box('#eef2f4', 1.7, 1.3, 0.8, x, g, z, yaw, true);
			box(mat.dark, 0.02, 0.9, 0.02, x, g + 0.15, z + 0.41);
			face(R.ice, 1.3, 0.45, x, g + 1.0, z + 0.41, 0);
			box(mat.metal, 1.72, 0.06, 0.82, x, g + 1.3, z);
		};
		yield;

		if (site.kind === 'fuel') {
			// ---- the canopy
			let top = -1e9;
			for (let x = CANOPY.x0; x <= CANOPY.x1; x += 7) for (let z = CANOPY.z0; z <= CANOPY.z1; z += 5.5) top = Math.max(top, gy(x, z));
			const Hc = top + CANOPY.under, cw = CANOPY.x1 - CANOPY.x0, cd = CANOPY.z1 - CANOPY.z0, cz = (CANOPY.z0 + CANOPY.z1) / 2, F = CANOPY.fascia;
			box(mat.soffit, cw, 0.22, cd, 0, Hc, cz);
			// the fascia round it in the brand's colour, the band of its second colour along its foot
			for (const [w, d, x, z] of [[cw + 0.24, 0.12, 0, CANOPY.z1 + 0.06], [cw + 0.24, 0.12, 0, CANOPY.z0 - 0.06], [0.12, cd, CANOPY.x0 - 0.06, cz], [0.12, cd, CANOPY.x1 + 0.06, cz]]) {
				box(B.brand.bg, w, F, d, x, Hc - 0.05, z);
				box(B.brand.fg, w + 0.02, 0.13, d + 0.02, x, Hc - 0.02, z);
			}
			box('#e6e6e4', cw + 0.2, 0.08, cd + 0.2, 0, Hc + F - 0.05, cz);
			// its name on the front and the back, and on each end
			face(R.fascia, 7.6, 0.95, 0, Hc + F / 2 + 0.02, CANOPY.z1 + 0.125, 0);
			face(R.fascia, 7.6, 0.95, 0, Hc + F / 2 + 0.02, CANOPY.z0 - 0.125, Math.PI);
			face(R.fascia, 5.2, 0.65, CANOPY.x1 + 0.125, Hc + F / 2 + 0.02, cz, Math.PI / 2);
			face(R.fascia, 5.2, 0.65, CANOPY.x0 - 0.125, Hc + F / 2 + 0.02, cz, -Math.PI / 2);
			// the lights in its underside, over the lanes
			for (const x of CANOPY_LIGHTS.x) for (const z of CANOPY_LIGHTS.z) { box(mat.glow, 0.9, 0.03, 0.9, x, Hc - 0.03, z); box(mat.metal, 1.0, 0.02, 1.0, x, Hc - 0.01, z); }
			// (a roof to stand on)
			B.floors.push([CANOPY.x0, CANOPY.z0, CANOPY.x1, CANOPY.z1, Hc + F - 0.01]);
			B.Hc = Hc;
			yield;
			// ---- the islands, their dispensers, the columns
			for (const ix of PUMP_X) {
				const gi = Math.max(gy(ix, ISLAND.z0), gy(ix, ISLAND.z1), gy(ix, COLUMN_Z)), it = gi + ISLAND.h;
				box(mat.concrete, ISLAND.hw * 2, ISLAND.h + 0.3, ISLAND.z1 - ISLAND.z0, ix, gi - 0.3, (ISLAND.z0 + ISLAND.z1) / 2, 0, true);
				for (const [z, a] of [[ISLAND.z0, Math.PI], [ISLAND.z1, 0]]) { const geo = new THREE.CylinderGeometry(ISLAND.hw, ISLAND.hw, ISLAND.h + 0.3, 12, 1, false, a - Math.PI / 2, Math.PI).translate(ix, gi - 0.3 + (ISLAND.h + 0.3) / 2, z); add(mat.concrete, geo); }
				// (the island's top to step up on)
				B.floors.push([ix - ISLAND.hw, ISLAND.z0, ix + ISLAND.hw, ISLAND.z1, it]);
				// the column, white with the brand's colour at its head, a steel collar at its foot
				box('#f2f2f0', 0.46, Hc - it, 0.46, ix, it, COLUMN_Z, 0, true);
				box(B.brand.bg, 0.5, 0.9, 0.5, ix, Hc - 0.95, COLUMN_Z);
				box(mat.metal, 0.56, 0.3, 0.56, ix, it, COLUMN_Z);
				// the bin and the squeegee bucket each side of it, a towel box on it
				cyl('#2e5e3e', 0.21, 0.95, ix, it, COLUMN_Z + 0.62, 12); cyl(mat.dark, 0.22, 0.05, ix, it + 0.95, COLUMN_Z + 0.62, 12);
				cyl(mat.metal, 0.03, 0.85, ix, it, COLUMN_Z - 0.6, 6); cyl('#2b7bd6', 0.14, 0.26, ix, it + 0.85, COLUMN_Z - 0.6, 10, 0.12);
				box('#d8d8d6', 0.3, 0.38, 0.12, ix, it + 1.2, COLUMN_Z - 0.29);
				// the bollards at its ends
				for (const z of [ISLAND.z0 - 0.35, ISLAND.z1 + 0.35]) bollard(ix, z);
				for (const dz of DISP_Z) {
					// the dispenser: its plinth, its body, the brand's head and topper; each side
					// a screen, the keypad, three grade buttons, three nozzles in their boots, a hose
					box(mat.dark, 0.72, 0.12, 1.12, ix, it, dz);
					box('#e9eaeb', 0.56, 1.42, 1.0, ix, it + 0.12, dz, 0, true);
					box(mat.metal, 0.58, 0.05, 1.02, ix, it + 1.54, dz);
					box(B.brand.bg, 0.6, 0.38, 1.04, ix, it + 1.59, dz);
					box(B.brand.fg, 0.61, 0.05, 1.05, ix, it + 1.59, dz);
					for (const s of [-1, 1]) {
						const fx = ix + s * 0.285, yaw = s * Math.PI / 2;
						face(R.top, 0.92, 0.32, ix + s * 0.305, it + 1.78, dz, yaw);
						const sg = new THREE.PlaneGeometry(0.34, 0.24).rotateY(yaw).translate(fx + s * 0.002, it + 1.18, dz - 0.18); add(mat.screen, sg);
						box(mat.dark, 0.02, 0.16, 0.2, fx, it + 0.86, dz - 0.18);
						['#2e7d32', '#1565c0', '#c62828'].forEach((c, k) => box(c, 0.02, 0.07, 0.1, fx + s * 0.005, it + 1.0, dz + 0.1 + k * 0.13));
						for (let k = 0; k < 3; k++) {
							const nz = dz + 0.1 + k * 0.13;
							box(mat.dark, 0.08, 0.22, 0.1, fx + s * 0.04, it + 0.66, nz);
							box(k === 2 ? '#2e7d32' : '#202020', 0.06, 0.16, 0.07, fx + s * 0.07, it + 0.78, nz);
						}
						// (the hose: from the head out and down in a slack loop to the middle nozzle)
						const curve = new THREE.CatmullRomCurve3([
							new THREE.Vector3(fx + s * 0.02, it + 1.5, dz + 0.36), new THREE.Vector3(fx + s * 0.32, it + 1.1, dz + 0.42),
							new THREE.Vector3(fx + s * 0.28, it + 0.45, dz + 0.32), new THREE.Vector3(fx + s * 0.09, it + 0.72, dz + 0.23),
						]);
						add(mat.dark, new THREE.TubeGeometry(curve, isPhone ? 8 : 14, 0.019, 5, false));
					}
				}
				yield;
			}
			// ---- the price sign at the corner, on its planter, facing along the main street
			{
				const px = X(19.3), pz = 16.6, g = gy(px, pz);
				box(mat.block, 0.9, 0.9, 3.0, px, g - 0.3, pz, 0, true);
				box('#5a3b28', 0.7, 0.02, 2.8, px, g + 0.6, pz);
				for (const dz of [-1.0, 1.0]) box(mat.metal, 0.18, 2.0, 0.18, px, g + 0.6, pz + dz);
				box(mat.dark, 0.42, 3.4, 2.5, px, g + 2.5, pz, 0, true);
				box(B.brand.bg, 0.46, 0.18, 2.54, px, g + 5.9, pz);
				for (const s of [-1, 1]) face(R.pylon, 2.3, 3.07, px + s * 0.215, g + 4.2, pz, s * Math.PI / 2);
				B.pylon = [px, g + 4.2, pz];
			}
			// ---- before the mart: the ice box and the propane cage by the doors, bollards along the
			// walk, wheel stops in the spaces
			const st = LOTS.fuel.store, front = st.z + st.d / 2;
			iceBox(X(st.x + st.w / 2 - 1.2), front + 0.45);
			{
				const x = X(st.x - st.w / 2 + 1.2), z = front + 0.4, g = gy(x, z);
				box(mat.dark, 1.5, 0.08, 0.7, x, g, z, 0, true);
				box(mat.dark, 1.5, 0.06, 0.7, x, g + 1.42, z);
				for (let k = 0; k <= 10; k++) box(mat.metal, 0.02, 1.36, 0.02, x - 0.74 + k * 0.148, g + 0.07, z + 0.35);
				for (const s of [-1, 1]) for (let k = 0; k <= 4; k++) box(mat.metal, 0.02, 1.36, 0.02, x + s * 0.74, g + 0.07, z - 0.34 + k * 0.17);
				for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { cyl(r ? '#dfe3e6' : '#e8ecee', 0.155, 0.45, x - 0.5 + k * 0.33, g + 0.08 + r * 0.66, z, 12); cyl(mat.metal, 0.06, 0.08, x - 0.5 + k * 0.33, g + 0.53 + r * 0.66, z, 8); }
				face(R.propane, 1.4, 0.3, x, g + 1.25, z + 0.37, 0);
			}
			for (let k = 0; k <= 5; k++) bollard(X(-9 + k * 2.8), front + 1.75);
			for (let k = 0; k < 5; k++) { const x = X(-7.6 + k * 2.8), z = front + 2.5; box(mat.concrete, 1.8, 0.14, 0.2, x, gy(x, z), z); }
			// the window's neon and posters, the mart's front
			face(R.open, 1.1, 0.43, X(st.x + 2.6), 2.1 + gy(X(st.x), front), front + 0.04, 0);
			face(R.poster, 1.2, 0.47, X(st.x - 3.4), 1.6 + gy(X(st.x), front), front + 0.04, 0);
			face(R.beer, 1.4, 0.5, X(st.x - 3.4), 2.4 + gy(X(st.x), front), front + 0.04, 0);
			// ---- the air and water machine, the tanks' fill caps, the dumpster
			{
				const x = X(-17.4), z = -2.5, g = gy(x, z);
				box(mat.concrete, 1.0, 0.12, 0.8, x, g, z);
				box('#c62828', 0.55, 1.35, 0.45, x, g + 0.12, z, 0, true);
				face(R.air, 0.5, 0.14, x, g + 1.2, z + 0.23, 0);
				add(mat.dark, new THREE.TorusGeometry(0.16, 0.025, 5, 14).translate(x, g + 0.8, z + 0.25));
			}
			['#f4f4f4', '#1e5bbd', '#c62828', '#f2c200', '#f57c00'].forEach((c, k) => { const x = X(-12 + k * 1.3), z = 1.3, g = gy(x, z); cyl(mat.metal, 0.34, 0.03, x, g, z, 14); cyl(c, 0.27, 0.035, x, g, z, 14); });
			pen(X(9.4) - (side < 0 ? 4 : 0), -17.6, X(9.4) + (side > 0 ? 4 : 0), -14.6);
		} else {
			const st = LOTS.corner.store, front = st.z + st.d / 2, sx = st.x;
			// ---- the pole sign at the corner
			{
				const px = X(10.9), pz = 13.1, g = gy(px, pz);
				cyl(mat.concrete, 0.4, 0.5, px, g - 0.1, pz, 12);
				cyl(mat.metal, 0.14, 4.6, px, g + 0.4, pz, 10);
				box(mat.dark, 0.44, 1.6, 2.9, px, g + 4.6, pz, 0, false);
				box(B.brand.bg, 0.46, 0.1, 2.92, px, g + 6.2, pz);
				for (const s of [-1, 1]) face(R.pole, 2.8, 1.4, px + s * 0.225, g + 5.4, pz, s * Math.PI / 2);
				B.solid.push([px - 0.4, pz - 0.4, px + 0.4, pz + 0.4, g, g + 4.6]);
				B.pylon = [px, g + 5.4, pz];
			}
			// ---- the front: the ice box, the news racks and the bin by the door, bollards, wheel stops
			iceBox(X(sx + st.w / 2 - 1.3), front + 0.45);
			{
				const z = front + 0.35;
				for (const [dx, c] of [[-2.6, '#1f4e9a'], [-3.2, '#b3261e']]) { const x = X(sx + dx), g = gy(x, z); box(c, 0.5, 0.95, 0.42, x, g, z, 0, true); box(mat.metal, 0.4, 0.3, 0.02, x, g + 0.55, z + 0.22); }
				const bx = X(sx - 1.6), g = gy(bx, z);
				cyl('#3a3a3a', 0.26, 0.9, bx, g, z, 12); cyl(mat.dark, 0.28, 0.06, bx, g + 0.9, z, 12);
				B.solid.push([bx - 0.28, z - 0.28, bx + 0.28, z + 0.28, g, g + 0.96]);
			}
			for (let k = 0; k <= 5; k++) bollard(X(sx - 7 + k * 2.8), front + 1.75);
			for (let k = 0; k < 5; k++) { const x = X(sx - 5.6 + k * 2.8), z = front + 2.6; box(mat.concrete, 1.8, 0.14, 0.2, x, gy(x, z), z); }
			// ---- the window: OPEN in neon, the posters, the ATM's sticker; the lamps over the front
			const gf = gy(X(sx), front);
			face(R.open, 1.1, 0.43, X(sx + 2.8), gf + 2.1, front + 0.04, 0);
			face(R.poster, 1.3, 0.5, X(sx - 3.6), gf + 1.6, front + 0.04, 0);
			face(R.beer, 1.4, 0.5, X(sx - 3.6), gf + 2.4, front + 0.04, 0);
			face(R.atm, 0.6, 0.21, X(sx + 1.6), gf + 1.5, front + 0.04, 0);
			for (const dx of [-5, 5]) { const x = X(sx + dx); box(mat.dark, 0.36, 0.26, 0.22, x, gf + 3.55, front + 0.11); box(mat.glow, 0.3, 0.02, 0.16, x, gf + 3.54, front + 0.13); }
			// ---- out back, the dumpster in its pen
			pen(X(-10.4) - (side > 0 ? 0 : 3.2), -12.8, X(-10.4) + (side > 0 ? 3.2 : 0), -10.2);
			if (siteHash(site.x, site.z, 41) < 0.4) cyl('#e8ecee', 0.155, 0.45, X(sx + st.w / 2 - 2.7), gy(X(sx + st.w / 2 - 2.7), front + 0.4), front + 0.4, 12);
		}
		yield;
		// ---- merged, a mesh a material
		for (const [m, list] of parts) {
			const geo = mergeGeometries(list);
			for (const q of list) q.dispose();
			const mesh = new THREE.Mesh(geo, m);
			mesh.castShadow = !isPhone && m !== mat.glow && m !== signM; mesh.receiveShadow = true;
			B.group.add(mesh);
			yield;
		}
		parts.clear();
		B.group.position.set(site.x, y0, site.z);
		B.group.rotation.y = -site.a;
		B.group.updateMatrixWorld(true);
		B.y0 = y0;
		root.add(B.group);
		return B;
	}
	function drop(site) {
		const B = built.get(site);
		built.delete(site);
		if (!B?.group) return;
		B.group.traverse((o) => o.geometry?.dispose());
		root.remove(B.group);
		B.tex?.dispose(); B.signM?.dispose();
	}

	// the sites near you come, the far ones go; one built at a time, a few milliseconds a frame
	let look = 0, near = [];
	function update(dt, camera, night = 0) {
		const x = camera.position.x, z = camera.position.z;
		mat.glow.emissiveIntensity = 0.5 + 2.6 * night;
		mat.soffit.emissiveIntensity = 0.35 + 0.55 * night;
		look -= dt;
		if (look <= 0) {
			look = 1;
			near = camera.position.y - bay.heightAt(x, z) < 900 ? real?.sites?.(x, z, FAR) || [] : [];
			for (const s of [...built.keys()]) if (!near.includes(s) || Math.hypot(s.x - x, s.z - z) > FAR) { if (job?.site === s) job = null; drop(s); }
			// (a sign drawn while the economy's plan was still to come: drawn again with its name)
			for (const B of built.values()) if (B.brand && !B.brand.real) { const E = brandOf(B.site); if (E.real) { if (E.name !== B.brand.name || E.bg !== B.brand.bg) { B.brand = E; drawSheet(B.sheet, B.site, E, K); B.tex.needsUpdate = true; } else B.brand = E; } }
		}
		if (!job) {
			let best = null, bd = NEAR;
			for (const s of near) { if (built.has(s)) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
			if (best) { built.set(best, null); job = { site: best, it: build(best) }; }
		}
		if (job) {
			const t0 = performance.now(), ms = buildSlice(dt, SLICE);
			try {
				for (;;) {
					const r = job.it.next();
					if (r.done) { built.set(job.site, r.value); job = null; break; }
					if (performance.now() - t0 > ms) break;
				}
			} catch (e) { console.warn('forecourt', job.site.id, e); built.set(job.site, { site: job.site, group: null, solid: [], floors: [] }); job = null; }
		}
	}

	// ---------- walking about: the islands, dispensers, columns, signs and pens are solid; the
	// islands' tops and the canopy's roof are stood on ----------
	const local = (B, x, z) => { const dx = x - B.site.x, dz = z - B.site.z, ca = Math.cos(B.site.a), sa = Math.sin(B.site.a); return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
	function floor(x, z, y) {
		let best = -1e9;
		for (const B of built.values()) {
			if (!B?.floors?.length || Math.abs(x - B.site.x) > 40 || Math.abs(z - B.site.z) > 40) continue;
			const [lx, lz] = local(B, x, z);
			for (const f of B.floors) if (lx > f[0] && lx < f[2] && lz > f[1] && lz < f[3] && y > B.y0 + f[4] - 0.6) best = Math.max(best, B.y0 + f[4]);
		}
		return best;
	}
	function push(pos, footY) {
		const Rr = 0.32;
		for (const B of built.values()) {
			if (!B?.solid?.length || Math.abs(pos.x - B.site.x) > 40 || Math.abs(pos.z - B.site.z) > 40) continue;
			let [lx, lz] = local(B, pos.x, pos.z);
			const fy = footY - B.y0;
			let moved = false;
			for (const c of B.solid) {
				if (fy + 1.7 < c[4] || fy + 0.25 > c[5]) continue;
				const qx = Math.max(c[0], Math.min(c[2], lx)), qz = Math.max(c[1], Math.min(c[3], lz));
				const dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
				if (d2 >= Rr * Rr) continue;
				if (d2 < 1e-8) { const pen = [lx - c[0], c[2] - lx, lz - c[1], c[3] - lz], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) lx = c[0] - Rr; else if (k === 1) lx = c[2] + Rr; else if (k === 2) lz = c[1] - Rr; else lz = c[3] + Rr; }
				else { const d = Math.sqrt(d2); lx = qx + dx / d * Rr; lz = qz + dz / d * Rr; }
				moved = true;
			}
			if (moved) { const ca = Math.cos(B.site.a), sa = Math.sin(B.site.a); pos.x = B.site.x + ca * lx - sa * lz; pos.z = B.site.z + sa * lx + ca * lz; }
		}
	}
	// the station or store you are on, for a hint
	function siteAt(x, z) {
		for (const B of built.values()) {
			if (!B?.group) continue;
			const [lx, lz] = local(B, x, z);
			if (Math.abs(lx) < B.site.w / 2 && Math.abs(lz) < B.site.d / 2) return { kind: B.site.kind, name: B.brand?.name || '', id: B.site.id };
		}
		return null;
	}
	const info = () => ({ near: near.length, built: [...built.values()].filter((B) => B?.group).map((B) => ({ id: B.site.id, kind: B.site.kind, name: B.brand?.name, draws: B.group.children.length })), building: job?.site.id || null });
	return { group: root, update, floor, push, siteAt, info };
}
