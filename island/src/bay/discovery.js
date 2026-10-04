// The Bay Area Discovery Museum, at Fort Baker under the north end of the Golden Gate: a
// children's museum in the old army post's buildings round a courtyard east of the parade
// ground, each built on its real footprint (Overture Maps) as the fort built them in 1905:
// white clapboard, two storeys, a red-brown hip roof, a deep two-level porch along the front
// on slim white posts with railings, tall six-over-six windows in white frames, grey-green
// doors. The museum's sign at the courtyard gate, in its bright colours; stroller parking.
// Inside the main hall, walk-in exhibit rooms: Tot Wetlands (a shallow blue pond, reeds, a
// boardwalk bridge, soft ducks and fish), the Art Studio (easels, paint tables, splashes),
// Discovery Hall (a climbing net and slide), a reading nook; the café in the next building,
// and in the rest the studios and classrooms, low tables and shelves of paint and paper.
// Out east, Lookout Cove, the outdoor playground by the water: a little Golden Gate Bridge to
// climb, a shipwreck and a fishing boat to play in, a sea cave, tide pools, a net climber,
// and the real bridge towering over it all.
// Families by the hour: open 9 to 5, closed Mondays, busiest on weekday mornings and at the
// weekend. Built when you come near; the fort's mapped blocks give way to it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toWorld } from './geo.js';
import { buildFaith } from '../world/boatmodel.js';
import { museumPorch, museumStroller, museumFlagpole } from './discovery-details.js';
import { buildDiscoveryGrove } from './discovery-grove.js';

export const CAMPUS = { ...toWorld(37.83560, -122.47660), r: 72 };
export const inCampus = (x, z) => Math.hypot(x - CAMPUS.x, z - CAMPUS.z) < CAMPUS.r;
const COVE = toWorld(37.83545, -122.47515);
const GATE = toWorld(37.8262, -122.4790);           // the bridge's north tower, past Faith's bow
const hh = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

function clapboard() {
	const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
	const g = cv.getContext('2d');
	g.fillStyle = '#e4e1c9'; g.fillRect(0, 0, 256, 256);
	for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y + 13, 256, 3); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(0, y, 256, 2); }
	const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
function museumSign() {
	const cv = document.createElement('canvas'); cv.width = 768; cv.height = 256;
	const g = cv.getContext('2d');
	g.fillStyle = '#ffffff'; g.fillRect(0, 0, 768, 256);
	g.strokeStyle = '#1d4e89'; g.lineWidth = 10; g.strokeRect(8, 8, 752, 240);
	const cols = ['#e8452c', '#f5a623', '#3fae49', '#1d8fd1', '#8e44ad', '#e8452c', '#f5a623'];
	g.font = 'bold 78px "Trebuchet MS", sans-serif'; g.textBaseline = 'middle';
	const word = 'DISCOVERY'; let x = 384 - g.measureText(word).width / 2;
	for (let i = 0; i < word.length; i++) { g.fillStyle = cols[i % cols.length]; g.fillText(word[i], x, 118); x += g.measureText(word[i]).width; }
	g.fillStyle = '#1d4e89'; g.textAlign = 'center';
	g.font = 'bold 34px "Trebuchet MS", sans-serif'; g.fillText('BAY AREA', 384, 52);
	g.font = 'bold 40px "Trebuchet MS", sans-serif'; g.fillText('MUSEUM', 384, 190);
	g.font = '22px "Trebuchet MS", sans-serif'; g.fillText('Open Tuesday – Sunday · 9 am – 5 pm', 384, 232);
	const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}

export function createDiscovery(scene, bay, real, { isPhone = false } = {}) {
	const root = new THREE.Group();
	root.name = 'discovery-museum';
	scene.add(root);
	const M = (c, rough = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: rough, ...extra });
	const siding = clapboard();
	const mat = {
		wall: new THREE.MeshStandardMaterial({ map: siding, roughness: 0.8 }), inWall: M('#f6f1e4', 0.9, { emissive: new THREE.Color('#6b665c') }), trim: M('#f7f6f2', 0.6), roof: M('#a04b3e', 0.8), door: M('#4f6b5a', 0.6), glass: M('#6f8796', 0.1, { metalness: 0.55 }),
		porch: M('#7a7064', 0.85), floor: M('#b98f5f', 0.6), rubber: M('#3a8fbf', 0.95), pond: M('#3aa0d8', 0.1, { metalness: 0.2 }), reed: M('#5f8a3a', 0.8), wood: M('#8a6440', 0.8), plush: M('#f5c518', 0.7), plush2: M('#e8452c', 0.7),
		easel: M('#c9a67a', 0.7), paint: [M('#e8452c', 0.4), M('#f5a623', 0.4), M('#3fae49', 0.4), M('#1d8fd1', 0.4), M('#8e44ad', 0.4)], net: M('#2a2a2a', 0.6), slide: M('#f5a623', 0.35), book: M('#1d8fd1', 0.6),
		orange: M('#c0362c', 0.55, { metalness: 0.25 }), sand: M('#d9c7a0', 0.95), rock: M('#6d655a', 0.95, { flatShading: true }), counter: M('#6b4a2e', 0.6), steel: M('#9aa0a4', 0.4, { metalness: 0.6 }),
		cloth: [M('#2c3e50'), M('#e8452c'), M('#1d8fd1'), M('#3fae49'), M('#f5a623'), M('#8e44ad'), M('#eeeeee')], skin: [M('#e0b494'), M('#c68e6a'), M('#8d5a3b'), M('#f0cfb0')],
		shutter: M('#574638'), enamel: M('#79a393'), canvas: M('#ece9d9'), rugPink: M('#d85c8a', 0.9), rugBlue: M('#5aa0d0', 0.9),
		flags: ['#bf392e', '#e8b634', '#367caf', '#efeee4'].map(c => M(c, 0.85, { side: THREE.DoubleSide })),
		signFace: new THREE.MeshStandardMaterial({ map: museumSign(), roughness: 0.6 }),
		roofD: M('#a04b3e', 0.8, { side: THREE.DoubleSide }), wallD: new THREE.MeshStandardMaterial({ map: siding, roughness: 0.8, side: THREE.DoubleSide }),
		vault: M('#f8f5ec', 0.9, { side: THREE.DoubleSide, emissive: new THREE.Color('#77736a') }), shade: M('#2f4f4a', 0.5, { side: THREE.DoubleSide }), bulb: M('#fff3d6', 0.4, { emissive: new THREE.Color('#ffe2a8'), emissiveIntensity: 1.4 }),
	};
	let built = null, disposed = false;
	const g = (x, z) => bay.heightAt(x, z);
	const inFrame = (F, lx, lz) => { const ca = Math.cos(F.a), sa = Math.sin(F.a); return { x: F.x + ca * lx - sa * lz, z: F.z + sa * lx + ca * lz }; };

	function build() {
		const B = { group: new THREE.Group(), col: [], floors: [], fronts: [], entrances: [] };
		const parts = new Map(), add = (m, geo) => { if (!parts.has(m)) parts.set(m, []); if (geo.index) { const plain = geo.toNonIndexed(); geo.dispose(); parts.get(m).push(plain); } else parts.get(m).push(geo); };
		// a box in a building's frame; solid ones go in the collision list (world space, oriented)
		const boxIn = (Fr, m, w, h, d, x = 0, y = 0, z = 0, solid = false) => {
			const geo = new THREE.BoxGeometry(w, h, d);
			if (m === mat.wall) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * h + y) / 2.88); }
			geo.translate(x, y + h / 2, z); geo.applyMatrix4(Fr.m); add(m, geo);
			if (solid) B.col.push({ F: Fr, x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: Fr.y + y, y1: Fr.y + y + h });
		};
		const frameAt = (x, z, a, y) => ({ x, z, a, y, m: new THREE.Matrix4().makeRotationY(-a).setPosition(x, y, z) });
		// the fort's buildings on their real footprints
		const boxes = (real?.near ? real.near('boxes', CAMPUS.x, CAMPUS.z, CAMPUS.r + 30) : []).filter((b) => inCampus(b.x, b.z) && b.w * b.d > 120).sort((a, b) => b.w * b.d - a.w * a.d);
		boxes.forEach((b, bi) => {
			let y0 = -1e9;
			for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const ca = Math.cos(b.a), sa = Math.sin(b.a); y0 = Math.max(y0, g(b.x + ca * sx * b.w / 2 - sa * sz * b.d / 2, b.z + sa * sx * b.w / 2 + ca * sz * b.d / 2)); }
			y0 += 0.5;
			const F = frameAt(b.x, b.z, b.a, y0), W = b.w, D = Math.max(9, b.d - 3), H = bi < 3 ? 7.4 : 4.2, hw = W / 2, hd = D / 2, zc = -1.5;
			// (every one of them walked into: the hall's exhibits, the café, the studios and classrooms)
			const main = bi === 0, cafe = bi === 1;
			// foundation and floor
			boxIn(F, mat.porch, W + 0.4, 1.2, D + 0.4, 0, -1.2, zc);
			boxIn(F, mat.floor, W - 0.4, 0.05, D - 0.4, 0, 0, zc);
			B.floors.push({ F, x0: -hw, x1: hw, z0: zc - hd, z1: zc + hd, y: y0 });
			// the walls: clapboard outside, plaster in; the front has doors at its middle and ends
			const T = 0.25, doors = [-hw * 0.6, 0, hw * 0.6];
			for (const [side, len, along] of [[-1, W, 'x'], [1, W, 'x'], [-1, D, 'z'], [1, D, 'z']]) {
				// plaster lines the inside of the walls where you can walk in
				const lin = (w, h, d, x, y, z) => boxIn(F, mat.inWall, w, h, d, x, y, z);
				if (along === 'z') { boxIn(F, mat.wall, T, H, D, side * (hw - T / 2), 0, zc, true); lin(0.04, H - 0.1, D - 0.6, side * (hw - T - 0.02), 0, zc); continue; }
				const zz = zc + side * (hd - T / 2), zin = zz - side * (T / 2 + 0.02);
				if (side > 0) {
					// the front: wall pieces between the door openings
					let a0 = -hw;
					for (const dx of doors) { if (dx - 0.9 - a0 > 0.1) { boxIn(F, mat.wall, dx - 0.9 - a0, H, T, (a0 + dx - 0.9) / 2, 0, zz, true); lin(dx - 0.9 - a0, H - 0.1, 0.04, (a0 + dx - 0.9) / 2, 0, zin); } boxIn(F, mat.wall, 1.8, H - 2.4, T, dx, 2.4, zz); lin(1.8, H - 2.5, 0.04, dx, 2.4, zin); boxIn(F, mat.door, 0.1, 2.4, 0.3, dx - 0.95, 0, zz); boxIn(F, mat.door, 0.1, 2.4, 0.3, dx + 0.95, 0, zz); a0 = dx + 0.9; }
					boxIn(F, mat.wall, hw - a0, H, T, (a0 + hw) / 2, 0, zz, true); lin(hw - a0, H - 0.1, 0.04, (a0 + hw) / 2, 0, zin);
				} else { boxIn(F, mat.wall, len, H, T, 0, 0, zz, true); lin(len - 0.6, H - 0.1, 0.04, 0, 0, zin); }
				// windows: tall, white-framed, both storeys
				for (let k = -hw + 2; k < hw - 1.5; k += 2.6) for (const wy of H > 5 ? [1.0, 4.6] : [1.0]) {
					if (side > 0 && doors.some((dx) => Math.abs(dx - k) < 1.6) && wy < 2) continue;
					boxIn(F, mat.glass, 1.0, 1.7, 0.06, k, wy, zz + side * (T / 2 + 0.01)); boxIn(F, mat.trim, 1.2, 0.12, 0.1, k, wy - 0.06, zz + side * (T / 2 + 0.04)); boxIn(F, mat.trim, 1.2, 0.12, 0.1, k, wy + 1.72, zz + side * (T / 2 + 0.04));
					for (const sx of [-1, 1]) { boxIn(F, mat.trim, 0.075, 1.7, 0.1, k + sx * 0.54, wy, zz + side * (T / 2 + 0.05)); boxIn(F, mat.shutter, 0.32, 1.85, 0.08, k + sx * 0.78, wy - 0.05, zz + side * (T / 2 + 0.02)); }
					boxIn(F, mat.trim, 1.0, 0.045, 0.11, k, wy + 0.85, zz + side * (T / 2 + 0.06));
					boxIn(F, mat.trim, 0.04, 1.7, 0.11, k, wy, zz + side * (T / 2 + 0.06));
				}
			}
			// the upper floor and the ceiling (inside, the ground floor is one open hall)
			if (!(main || cafe) || H < 5) boxIn(F, mat.inWall, W - 0.4, 0.2, D - 0.4, 0, Math.min(3.6, H - 0.3), zc);
			else {
				// the halls are open to the roof: a white barrel vault springing from the wall tops,
				// steel tie rods across, and the building's services left bare below it: two long
				// spiral ducts, the red sprinkler main, pendant lights on long cords
				const c = D - 0.6, rise = 2.3, R = (c * c / 4 + rise * rise) / (2 * rise), half = Math.asin(c / 2 / R);
				const vg = new THREE.CylinderGeometry(R, R, W - 0.5, 40, 1, true, Math.PI / 2 - half, 2 * half).rotateZ(Math.PI / 2).translate(0, H - 0.05 + rise - R, zc);
				vg.applyMatrix4(F.m); add(mat.vault, vg);
				for (let k = -hw + 1.2; k < hw - 0.8; k += 3.2) {
					boxIn(F, mat.steel, 0.04, 0.04, D - 0.6, k, H - 0.3, zc);
					// ribs under the vault at each tie
					for (let j = 0; j < 12; j++) {
						const a0 = -half + (2 * half) * j / 12, a1 = -half + (2 * half) * (j + 1) / 12, y0 = H - 0.05 + rise - R + R * Math.cos(a0), y1 = H - 0.05 + rise - R + R * Math.cos(a1), z0 = zc + R * Math.sin(a0), z1 = zc + R * Math.sin(a1);
						const rib = new THREE.BoxGeometry(0.12, 0.14, Math.hypot(z1 - z0, y1 - y0)).rotateX(-Math.atan2(y1 - y0, z1 - z0)).translate(k, (y0 + y1) / 2 - 0.05, (z0 + z1) / 2);
						rib.applyMatrix4(F.m); add(mat.wood, rib);
					}
				}
				for (const sz of [-1, 1]) {
					const dz = zc + sz * D * 0.22, dy = H - 0.9;
					const dg = new THREE.CylinderGeometry(0.3, 0.3, W - 1, 14, 1, true).rotateZ(Math.PI / 2).translate(0, dy, dz); dg.applyMatrix4(F.m); add(mat.steel, dg);
					for (let k = -hw + 1.5; k < hw - 1; k += 1.1) { const t = new THREE.TorusGeometry(0.305, 0.012, 4, 14).rotateY(Math.PI / 2).translate(k, dy, dz); t.applyMatrix4(F.m); add(mat.steel, t); }
					for (let k = -hw + 3; k < hw - 2; k += 5) boxIn(F, mat.steel, 0.5, 0.25, 0.5, k, dy - 0.55, dz);
				}
				{ const pg = new THREE.CylinderGeometry(0.045, 0.045, W - 1, 8).rotateZ(Math.PI / 2).translate(0, H - 0.5, zc + 0.8); pg.applyMatrix4(F.m); add(mat.orange, pg); }
				for (let k = -hw + 2.4; k < hw - 1.5; k += 3.2) for (const lz of [zc - D * 0.3, zc, zc + D * 0.3]) {
					boxIn(F, mat.net, 0.015, H - 3.2, 0.015, k, 3.1, lz);
					const sh = new THREE.ConeGeometry(0.3, 0.28, 16, 1, true).translate(k, 3.05, lz); sh.applyMatrix4(F.m); add(mat.shade, sh);
					const bulb = new THREE.SphereGeometry(0.1, 10, 6).translate(k, 2.95, lz); bulb.applyMatrix4(F.m); add(mat.bulb, bulb);
				}
			}
			// the hip roof
			if ((main || cafe) && H > 5) {
				// the halls: a gable roof (ridge along the length) over the vault, clapboard gable ends
				const rd = D / 2 + 0.5, rh = 3.4, L = W / 2 + 0.3, P = [[-L, 0, -rd], [L, 0, -rd], [L, rh, 0], [-L, rh, 0], [-L, 0, rd], [L, 0, rd]];
				const tri = (a2, b2, c2) => [...P[a2], ...P[b2], ...P[c2]];
				const rg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...tri(0, 3, 2), ...tri(0, 2, 1), ...tri(5, 2, 3), ...tri(5, 3, 4)], 3));
				rg.computeVertexNormals(); rg.translate(0, H, zc); rg.applyMatrix4(F.m); add(mat.roofD, rg);
				for (const sx of [-1, 1]) { const eg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([sx * (W / 2), 0, -hd, sx * (W / 2), 0, hd, sx * (W / 2), rh - 0.25, 0], 3)).setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.4], 2)); eg.computeVertexNormals(); eg.translate(0, H, zc); eg.applyMatrix4(F.m); add(mat.wallD, eg); }
			} else { const rg = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4); rg.scale(W * 0.76, H > 5 ? 3.4 : 2.4, D * 0.76); rg.translate(0, H + (H > 5 ? 1.7 : 1.2), zc); rg.applyMatrix4(F.m); add(mat.roof, rg); }
			// the porch: a deck along the front on white posts, a balcony above with railings
			const pd = 2.6, pz = zc + hd + pd / 2;
			boxIn(F, mat.porch, W, 0.25, pd, 0, -0.25, pz);
			B.floors.push({ F, x0: -hw, x1: hw, z0: zc + hd, z1: zc + hd + pd, y: y0 });
			B.fronts.push({ F, w: W - 2, z: zc + hd + pd });
			for (let k = -hw + 0.2; k <= hw - 0.1; k += W / Math.max(3, Math.round(W / 3.2))) if (!doors.some(dx => Math.abs(dx - k) < 1.1)) boxIn(F, mat.trim, 0.18, H > 5 ? 6.6 : 3.4, 0.18, k, 0, zc + hd + pd - 0.15);
			if (H > 5) { boxIn(F, mat.porch, W, 0.2, pd, 0, 3.4, pz); for (let k = -hw; k < hw; k += 0.18) boxIn(F, mat.trim, 0.05, 0.9, 0.05, k, 3.6, zc + hd + pd - 0.15); boxIn(F, mat.trim, W, 0.08, 0.12, 0, 4.5, zc + hd + pd - 0.15); }
			boxIn(F, mat.canvas, W + 0.3, 0.15, pd + 0.2, 0, H > 5 ? 6.6 : 3.4, pz);
			museumPorch({ B, F, W, H, hd, zc, doors, mat, boxIn, add, ground: g, inFrame });

			// ---------- inside ----------
			const ix0 = -hw + 0.6, ix1 = hw - 0.6, iz0 = zc - hd + 0.6, iz1 = zc + hd - 1.4, iw = ix1 - ix0;
			if (main) {
				// Tot Wetlands, a third of the hall: the pond, reeds, the boardwalk, ducks and fish
				const tx = ix0 + iw / 6, tz = (iz0 + iz1) / 2;
				{ const pg = new THREE.CircleGeometry(Math.min(iw / 7, (iz1 - iz0) / 2.4), 28).rotateX(-Math.PI / 2).scale(1.3, 1, 1).translate(tx, 0.07, tz); pg.applyMatrix4(F.m); add(mat.pond, pg); }
				boxIn(F, mat.wood, 1.2, 0.3, (iz1 - iz0) * 0.7, tx, 0, tz);
				for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283, r = Math.min(iw / 7, (iz1 - iz0) / 2.4) * 1.05; boxIn(F, mat.reed, 0.06, 0.9 + hh(k, 2) * 0.5, 0.06, tx + Math.cos(a) * r * 1.3, 0, tz + Math.sin(a) * r); }
				for (let k = 0; k < 5; k++) { const geo = new THREE.SphereGeometry(0.18, 10, 8).scale(1.3, 0.9, 1).translate(tx - 1 + k * 0.6, 0.18, tz + (k % 2 ? 0.8 : -0.9)); geo.applyMatrix4(F.m); add(k % 2 ? mat.plush : mat.plush2, geo); }
				// the Art Studio: easels and a long paint table, splashes of colour
				const ax = ix0 + iw / 2;
				for (let k = 0; k < 4; k++) { const ex = ax - 2.4 + k * 1.6; boxIn(F, mat.easel, 0.06, 1.5, 0.06, ex - 0.35, 0, iz0 + 1.2); boxIn(F, mat.easel, 0.06, 1.5, 0.06, ex + 0.35, 0, iz0 + 1.2); boxIn(F, mat.paint[k % 5], 0.8, 0.6, 0.04, ex, 0.8, iz0 + 1.25); }
				boxIn(F, mat.wood, 4.5, 0.06, 1.2, ax, 0.55, (iz0 + iz1) / 2 + 0.5, true);
				for (let k = 0; k < 10; k++) boxIn(F, mat.paint[k % 5], 0.12, 0.14, 0.12, ax - 2 + k * 0.44, 0.61, (iz0 + iz1) / 2 + 0.5 + (k % 2 ? 0.3 : -0.3));
				for (let k = 0; k < 6; k++) boxIn(F, mat.easel, 0.35, 0.3, 0.35, ax - 1.8 + k * 0.72, 0, (iz0 + iz1) / 2 + 1.5);
				// Discovery Hall: a climbing tower with a net and a slide, a reading nook
				const dx = ix1 - iw / 6;
				for (const [a2, b2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) boxIn(F, mat.steel, 0.1, 2.6, 0.1, dx + a2 * 1.1, 0, tz + b2 * 1.1);
				boxIn(F, mat.rubber, 2.4, 0.1, 2.4, dx, 1.4, tz); boxIn(F, mat.rubber, 5.5, 0.06, 5.5, dx, 0, tz);
				for (let k = 0; k < 7; k++) boxIn(F, mat.net, 0.03, 1.4, 2.2, dx + 1.15, 0, tz, false), boxIn(F, mat.net, 2.2, 0.03, 0.03, dx, 0.2 * k, tz - 1.15);
				{ const sl = new THREE.BoxGeometry(0.6, 0.05, 2.6).rotateX(-0.55).translate(dx, 0.75, tz + 2.1); sl.applyMatrix4(F.m); add(mat.slide, sl); }
				for (let k = 0; k < 8; k++) boxIn(F, mat.book, 0.25, 0.3, 0.08, ix1 - 0.6, 0.4 + (k % 4) * 0.35, iz1 - 2 + Math.floor(k / 4) * 0.4);
				boxIn(F, mat.rugPink, 2, 0.3, 1.2, ix1 - 1.6, 0, iz1 - 1.2);
				// the front desk by the middle door
				boxIn(F, mat.counter, 2.6, 1.05, 0.7, 0, 0, iz1 - 1.2, true);
				B.main = { F, ix0, ix1, iz0, iz1, pond: [tx, tz, Math.min(iw / 7, (iz1 - iz0) / 2.4) * 1.45] };
			}
			if (!main && !cafe) {
				// a studio or a classroom: low tables with their stools, shelves of paint and paper
				// along the back, the children's pictures on the walls, a rug to sit on for a story
				for (let x2 = ix0 + 1.6; x2 < ix1 - 1.4; x2 += 3.2) for (let z2 = iz0 + 1.8; z2 < iz1 - 1.8; z2 += 2.6) {
					boxIn(F, mat.wood, 1.6, 0.05, 0.8, x2, 0.55, z2, true);
					for (const [sx, sz] of [[-0.5, -0.65], [0.5, -0.65], [-0.5, 0.65], [0.5, 0.65]]) boxIn(F, mat.paint[((Math.round(x2 + z2) + sx * 2) % 5 + 5) % 5 | 0], 0.3, 0.32, 0.3, x2 + sx, 0, z2 + sz);
				}
				for (let x2 = ix0 + 0.6; x2 < ix1 - 0.8; x2 += 1.4) { boxIn(F, mat.wood, 1.2, 1.4, 0.4, x2 + 0.6, 0, iz0 - 0.3, true); for (let k = 0; k < 3; k++) boxIn(F, mat.paint[((k + Math.round(x2)) % 5 + 5) % 5 | 0], 0.3, 0.22, 0.3, x2 + 0.25 + k * 0.35, 1.4, iz0 - 0.3); }
				for (let x2 = ix0 + 1; x2 < ix1 - 1; x2 += 1.8) boxIn(F, mat.paint[(Math.round(x2) % 5 + 5) % 5 | 0], 0.7, 0.5, 0.02, x2, 1.4, iz0 - 0.52);
				boxIn(F, mat.rugBlue, 2.4, 0.02, 1.8, ix1 - 1.6, 0, iz1 - 1.3);
			}
			if (cafe) {
				boxIn(F, mat.counter, iw * 0.6, 1.05, 0.7, 0, 0, iz0 + 1.2, true);
				boxIn(F, mat.steel, 0.7, 0.5, 0.4, -iw * 0.2, 1.05, iz0 + 1.2);
				for (let x2 = ix0 + 1.2; x2 < ix1 - 1; x2 += 2.2) for (let z2 = iz0 + 3; z2 < iz1 - 0.5; z2 += 2.2) { boxIn(F, mat.wood, 0.9, 0.05, 0.9, x2, 0.72, z2); boxIn(F, mat.steel, 0.08, 0.72, 0.08, x2, 0, z2); }
				B.cafe = { F, ix0, ix1, iz0, iz1 };
			}
		});
		// the sign at the courtyard gate, and stroller parking beside it
		{
			// on the walk up to the main hall's porch, facing the way you come
			const M0 = B.main || B.fronts[0], mf = B.fronts[0];
			const at = M0 ? inFrame(M0.F, -mf.w * 0.25, mf.z + 7) : { x: CAMPUS.x, z: CAMPUS.z }, a = M0 ? M0.F.a : 0;
			const F = frameAt(at.x, at.z, a, g(at.x, at.z));
			B.sign = { F };
			boxIn(F, mat.trim, 0.2, 2.6, 0.2, -2.1, 0, 0); boxIn(F, mat.trim, 0.2, 2.6, 0.2, 2.1, 0, 0);
			const sg = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 0.12), [mat.trim, mat.trim, mat.trim, mat.trim, mat.signFace, mat.trim]); sg.applyMatrix4(F.m); sg.position.y += 1.9; B.group.add(sg);
			museumFlagpole({ F, mat, boxIn, add });
			for (let k = 0; k < 5; k++) museumStroller({ F, x: 3.6 + k * 0.85, z: 0.8, mat, boxIn, add, color: k % 2 ? 0 : 6 });
		}

		// Trees follow the supplied grove photographs, outside mapped walls and paths.
		const roads = real.near('roads', CAMPUS.x, CAMPUS.z, CAMPUS.r + 30);
		const blocked = (x, z, radius) => roads.some(road => {
			for (let i = 0; i + 3 < road.pts.length; i += 2) {
				const ax = road.pts[i], az = road.pts[i + 1], dx = road.pts[i + 2] - ax, dz = road.pts[i + 3] - az;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
				if (Math.hypot(x - ax - dx * t, z - az - dz * t) < road.w / 2 + radius) return true;
			}
			return false;
		});
		B.grove = buildDiscoveryGrove({ add, frameAt, collisions: B.col, bay, boxes, campus: CAMPUS, cove: COVE, isPhone, blocked });

		// ---------- Lookout Cove ----------
		{
			const F = frameAt(COVE.x, COVE.z, 0.5, Math.max(0.8, g(COVE.x, COVE.z)));
			B.cove = { F };
			// the sandy play yard
			{ const pg = new THREE.CircleGeometry(30, 36).rotateX(-Math.PI / 2).translate(0, 0.12, 0); pg.applyMatrix4(F.m); add(mat.sand, pg); }
			// a little Golden Gate: towers, a deck, the cables' sag in rails
			for (const z of [-9, 9]) { boxIn(F, mat.orange, 0.7, 6, 0.7, -1.3, 0, z); boxIn(F, mat.orange, 0.7, 6, 0.7, 1.3, 0, z); boxIn(F, mat.orange, 3.3, 0.45, 0.7, 0, 3, z); boxIn(F, mat.orange, 3.3, 0.45, 0.7, 0, 5.7, z); }
			boxIn(F, mat.orange, 2.4, 0.3, 28, 0, 1.9, 0);
			B.floors.push({ F, x0: -1.2, x1: 1.2, z0: -14, z1: 14, y: F.y + 2.2 });
			for (const x of [-1.3, 1.3]) for (let k = 0; k < 14; k++) { const z = -13 + k * 2, y = 2.2 + 3.6 * (Math.abs(z) / 9 - 1) ** 2 * (Math.abs(z) < 9 ? 1 : 0.3); boxIn(F, mat.orange, 0.06, Math.max(0.2, Math.min(3.6, y - 2.2)), 0.06, x, 2.2, z); }
			// the shipwreck, half buried
			{ const hull = new THREE.CylinderGeometry(1.6, 1.6, 9, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 0.8, 1).translate(10, 0.5, 6); hull.applyMatrix4(F.m); add(mat.wood, hull); }
			boxIn(F, mat.wood, 0.25, 4.5, 0.25, 10, 0, 6);
			// Faith, the old fishing boat hauled up on the gravel, bow to the bay and the bridge:
			// up the gangway, round the netted foredeck, the ladder to the flying bridge
			{
				const at = inFrame(F, -12, -6), a = Math.atan2(GATE.x - at.x, -(GATE.z - at.z));
				const faith = buildFaith({ glass: mat.glass, beached: true });
				const BF = frameAt(at.x, at.z, a, F.y + 0.12 - faith.userData.ground);
				faith.applyMatrix4(BF.m);
				faith.traverse((o) => { if (o.isMesh) o.castShadow = !isPhone && o.castShadow; });
				B.group.add(faith);
				const { floors, walls } = faith.userData.walk;
				for (const f of floors) B.floors.push({ F: BF, x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1, y: BF.y + f.y });
				for (const c of walls) B.col.push({ F: BF, x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, y0: BF.y + c.y0, y1: BF.y + c.y1 });
				B.faith = BF;
			}
			// the sea cave: a rock arch to crawl through; the tide pools beside it
			for (let k = 0; k < 9; k++) { const a = k / 8 * Math.PI, geo = new THREE.DodecahedronGeometry(1.2 + hh(k, 5) * 0.4, 0).translate(14 + Math.cos(a) * 2.6, Math.sin(a) * 2.2, -8); geo.applyMatrix4(F.m); add(mat.rock, geo); }
			for (let k = 0; k < 4; k++) { const geo = new THREE.CircleGeometry(1.2 + hh(k, 7) * 0.6, 16).rotateX(-Math.PI / 2).translate(8 + k * 2.4, 0.16, -12 + (k % 2) * 1.5); geo.applyMatrix4(F.m); add(mat.pond, geo); }
			for (let k = 0; k < 8; k++) { const geo = new THREE.DodecahedronGeometry(0.5 + hh(k, 9) * 0.3, 0).translate(7 + k * 1.3, 0.2, -13.5 + (k % 3)); geo.applyMatrix4(F.m); add(mat.rock, geo); }
			// a net climber: a pyramid of ropes
			for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, geo = new THREE.CylinderGeometry(0.03, 0.03, 5.2, 4).rotateZ(0.9).rotateY(-a).translate(-4 + Math.cos(a) * 1.9, 2.1, 12 + Math.sin(a) * 1.9); geo.applyMatrix4(F.m); add(mat.net, geo); }
			boxIn(F, mat.steel, 0.12, 4.4, 0.12, -4, 0, 12);
		}
		for (const [m, list] of parts) { const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = !isPhone && m !== mat.glass; mesh.receiveShadow = true; B.group.add(mesh); for (const geo of list) geo.dispose(); }
		root.add(B.group);
		built = B;
	}

	// ---------- families by the hour ----------
	// the visitors themselves are the real people (people/people.js), grown-ups with their
	// children; this says how many and where they go
	function busy(h, day) {
		if (day === 1 || h < 9 || h >= 17) return 0;                     // closed Mondays, and out of hours
		const morning = Math.exp(-(((h - 10.5) / 1.4) ** 2)), after = Math.exp(-(((h - 14) / 1.6) ** 2)) * 0.6;
		return Math.min(1, (morning + after) * (day === 0 || day === 6 ? 1.1 : 0.9));
	}
	function venue(cam, hours) {
		if (!built || Math.hypot(cam.x - CAMPUS.x, cam.z - CAMPUS.z) > CAMPUS.r + 110) return null;
		const k = busy(hours, new Date().getDay());
		if (k <= 0) return { n: 0, kids: 0.5, areas: [] };
		// anywhere on a room's floor, round the Tot Wetlands pond rather than through it
		const B = built, room = (R) => (r) => { let lx = 0, lz = 0; for (let k = 0; k < 6; k++) { lx = R.ix0 + 1 + r() * (R.ix1 - R.ix0 - 2); lz = R.iz0 + 1.5 + r() * (R.iz1 - R.iz0 - 3); if (!R.pond || Math.hypot(lx - R.pond[0], lz - R.pond[1]) > R.pond[2]) break; } return inFrame(R.F, lx, lz); };
		const areas = [];
		if (B.main) areas.push({ w: 0.34, pick: room(B.main) });
		if (B.cafe) areas.push({ w: 0.12, pick: room(B.cafe) });
		areas.push({ w: 0.34, pick: (r) => { const a = r() * 6.283, d = 4 + r() * 18; return { x: COVE.x + Math.cos(a) * d, z: COVE.z + Math.sin(a) * d }; } });
		for (const Fr of B.fronts) areas.push({ w: 0.2 / B.fronts.length, pick: (r) => inFrame(Fr.F, (r() - 0.5) * Fr.w, Fr.z + 1.5 + r() * 5) });
		return { n: Math.round(24 * k), kids: 0.5, areas };
	}
	function update(dt, camera) {
		if (disposed) return;
		const d = Math.hypot(camera.position.x - CAMPUS.x, camera.position.z - CAMPUS.z);
		if (!built && d < 900 && bay.loaded() && real?.loaded() && real.near('boxes', CAMPUS.x, CAMPUS.z, 60).length) { try { build(); } catch (e) { console.warn('discovery museum', e); built = { group: new THREE.Group(), col: [], floors: [], fronts: [] }; } }
		if (built && d > 1600) unload();
	}
	function unload() {
		if (!built) return;
		built.group.traverse(o => o.geometry?.dispose());
		built.grove?.dispose();
		root.remove(built.group); built = null;
	}
	function dispose() {
		if (disposed) return;
		disposed = true; unload();
		const materials = new Set(Object.values(mat).flat()), textures = new Set([siding]);
		for (const m of materials) { if (m.map) textures.add(m.map); m.dispose(); }
		for (const texture of textures) texture.dispose();
		root.removeFromParent();
	}
	const toLocal = (F, x, z) => { const dx = x - F.x, dz = z - F.z, ca = Math.cos(F.a), sa = Math.sin(F.a); return [ca * dx + sa * dz, -sa * dx + ca * dz]; };
	// the floors inside, the porches, the little bridge's deck and the boat
	function floor(x, z, y) {
		if (!built || Math.abs(x - CAMPUS.x) > 260 || Math.abs(z - CAMPUS.z) > 260) return -1e9;
		let best = -1e9;
		for (const f of built.floors) { const [lx, lz] = toLocal(f.F, x, z); if (lx > f.x0 && lx < f.x1 && lz > f.z0 && lz < f.z1 && y > f.y - 1.2) best = Math.max(best, f.y); }
		return best;
	}
	function push(pos, footY) {
		// (the cove, and Faith on it, lie out east past the campus's circle)
		if (!built || (Math.hypot(pos.x - CAMPUS.x, pos.z - CAMPUS.z) > CAMPUS.r + 20 && Math.hypot(pos.x - COVE.x, pos.z - COVE.z) > 40)) return;
		const R = 0.3;
		for (const c of built.col) {
			if (footY + 1.7 < c.y0 || footY + 0.25 > c.y1) continue;
			let [lx, lz] = toLocal(c.F, pos.x, pos.z);
			const qx = Math.max(c.x0, Math.min(c.x1, lx)), qz = Math.max(c.z0, Math.min(c.z1, lz)), dx = lx - qx, dz = lz - qz, d2 = dx * dx + dz * dz;
			if (d2 >= R * R) continue;
			if (d2 < 1e-8) { const pen = [lx - c.x0, c.x1 - lx, lz - c.z0, c.z1 - lz], m = Math.min(...pen), k = pen.indexOf(m); if (k === 0) lx = c.x0 - R; else if (k === 1) lx = c.x1 + R; else if (k === 2) lz = c.z0 - R; else lz = c.z1 + R; }
			else { const d = Math.sqrt(d2); lx = qx + dx / d * R; lz = qz + dz / d * R; }
			const ca = Math.cos(c.F.a), sa = Math.sin(c.F.a); pos.x = c.F.x + ca * lx - sa * lz; pos.z = c.F.z + sa * lx + ca * lz;
		}
	}
	// where in the museum you are, for a note
	function where(pos) {
		if (!built) return null;
		for (const [R, name] of [[built.main, 'main'], [built.cafe, 'cafe']]) { if (!R) continue; const [lx, lz] = toLocal(R.F, pos.x, pos.z); if (lx > R.ix0 - 0.6 && lx < R.ix1 + 0.6 && lz > R.iz0 - 0.6 && lz < R.iz1 + 1.4 && pos.y - R.F.y < 3.6) return name; }
		if (Math.hypot(pos.x - COVE.x, pos.z - COVE.z) < 32) return 'cove';
		return inCampus(pos.x, pos.z) ? 'campus' : null;
	}
	return { group: root, update, floor, push, where, busy, venue, dispose, get built() { return built; } };
}
