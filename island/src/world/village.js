// One fishing village, built by one hand: clapboard cottages in a shared
// palette, tin roofs, sea-facing porches, stilts where the ground drops, a
// plank pier on posts and a moored boat. Windows glow after dark.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../noise.js';
import * as TX from './textures.js';

const WALLS = [[0.93, 0.93, 0.90], [0.58, 0.72, 0.86], [0.52, 0.75, 0.68], [0.95, 0.86, 0.56], [0.88, 0.58, 0.50], [0.93, 0.93, 0.90]];
const ROOFS = [[0.70, 0.20, 0.17], [0.22, 0.48, 0.52], [0.52, 0.55, 0.58], [0.45, 0.22, 0.18]];
const TRIM = [0.95, 0.95, 0.93];

function paint(geo, rgb) {
	const n = geo.attributes.position.count, c = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
	geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
	return geo;
}
// a box whose uvs are in metres (divided by `tile`), so siding keeps its scale
function box(w, h, d, tile = 2) {
	const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
	const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
	for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
		const i = f * 4 + k;
		uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
	}
	return g;
}
function gable(w, d, rise, tile = 2) {
	// the triangular wall ends under a pitched roof, front and back
	const g = new THREE.BufferGeometry(), hw = w / 2, hd = d / 2;
	const P = [-hw, 0, hd, hw, 0, hd, 0, rise, hd, hw, 0, -hd, -hw, 0, -hd, 0, rise, -hd];
	const N = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
	const U = [0, 0, w / tile, 0, w / tile / 2, rise / tile, 0, 0, w / tile, 0, w / tile / 2, rise / tile];
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
	return g;
}
const place = (g, x, y, z, ry = 0, rz = 0, rx = 0) => {
	const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
	return g.applyMatrix4(m);
};

export function createVillage(island, shared, scene) {
	const r = mulberry32(island.seed ^ 0x5eed);
	const v = island.village, seaAng = Math.atan2(v.seaDir.x, v.seaDir.z);
	const parts = { wall: [], roof: [], wood: [], glass: [] };
	const footprints = [];
	const lane = island.paths[0].points;
	const side = { x: -v.seaDir.z, z: v.seaDir.x };

	function house(cx, cz, face, colorW, colorR) {
		const w = 5 + r() * 2.2, d = 6 + r() * 2.2, tall = r() < 0.25, wallH = tall ? 5.6 : 3.1, rise = 1.4 + r() * 0.8;
		// floor sits at the highest corner, stilts make up the drop
		let hi = -1e9, lo = 1e9;
		for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
			const lx = sx * w / 2, lz = sz * d / 2;
			const x = cx + lx * Math.cos(face) + lz * Math.sin(face), z = cz - lx * Math.sin(face) + lz * Math.cos(face);
			const h = island.heightAt(x, z);
			hi = Math.max(hi, h); lo = Math.min(lo, h);
		}
		if (hi - lo > 3.5 || lo < 0.4) return false;
		const floor = hi + 0.45;
		const local = [];
		const add = (bucket, g, color) => local.push([bucket, paint(g, color)]);
		add('wall', place(box(w, wallH, d), 0, wallH / 2, 0), colorW);
		add('wall', place(gable(w, d, rise), 0, wallH, 0), colorW);
		// pitched roof, overhanging
		const slope = Math.hypot(w / 2 + 0.5, rise), ang = Math.atan2(rise, w / 2 + 0.5);
		for (const s of [-1, 1]) add('roof', place(box(slope, 0.12, d + 1.0, 1.2), s * (w / 4 + 0.25) * 1, wallH + rise / 2 + 0.06, 0, 0, -s * ang), colorR);
		add('wood', place(box(0.25, 0.25, d + 1.0), 0, wallH + rise + 0.05, 0), TRIM);
		// porch on the sea side, with posts and a lean-to roof
		const pd = 2.2;
		add('wood', place(box(w + 0.4, 0.18, pd, 1.5), 0, -0.05, d / 2 + pd / 2), [0.72, 0.62, 0.48]);
		for (const s of [-1, 1]) add('wood', place(box(0.16, 2.6, 0.16), s * (w / 2 + 0.05), 1.3, d / 2 + pd - 0.1), TRIM);
		add('roof', place(box(w + 0.6, 0.1, pd + 0.4, 1.2), 0, 2.75, d / 2 + pd / 2, 0, 0, 0.18), colorR);   // lean-to falls toward the sea
		// railing
		add('wood', place(box(w + 0.4, 0.08, 0.08), 0, 0.95, d / 2 + pd - 0.05), TRIM);
		// door and windows
		add('wood', place(box(1.0, 2.1, 0.08), -w * 0.18, 1.05, d / 2 + 0.03), [0.35, 0.28, 0.22]);
		const winY = tall ? [1.5, 4.2] : [1.55];
		for (const y of winY) {
			add('glass', place(box(0.9, 1.1, 0.06), w * 0.22, y, d / 2 + 0.04), [1, 1, 1]);
			add('glass', place(box(0.06, 1.1, 0.9), w / 2 + 0.04, y, 0), [1, 1, 1]);
			add('glass', place(box(0.06, 1.1, 0.9), -w / 2 - 0.04, y, -d * 0.15), [1, 1, 1]);
			add('wood', place(box(1.1, 0.12, 0.12), w * 0.22, y - 0.62, d / 2 + 0.08), TRIM);
		}
		// stilts down to the ground
		const stiltH = floor - lo + 0.3;
		for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]]) {
			add('wood', place(box(0.22, stiltH, 0.22), sx * (w / 2 - 0.2), -stiltH / 2, sz * (d / 2 - 0.2)), [0.40, 0.33, 0.26]);
		}
		// steps down from the porch
		for (let k = 0; k < 3; k++) add('wood', place(box(1.2, 0.12, 0.35), 0, -0.25 - k * 0.2, d / 2 + pd + 0.2 + k * 0.32), [0.6, 0.52, 0.42]);
		const m = new THREE.Matrix4().makeRotationY(face).setPosition(cx, floor, cz);
		for (const [bucket, g] of local) parts[bucket].push(g.applyMatrix4(m));
		footprints.push({ x: cx, z: cz, face, w: w + 0.4, d: d + pd, y: floor, h: wallH + rise });
		return true;
	}

	// cottages either side of the shore lane, facing the water
	let placed = 0;
	for (let i = 1; i < lane.length - 1 && placed < 22; i++) {
		const p = lane[i];
		for (const s of [1, -1]) {
			if (r() < 0.2) continue;
			const off = s > 0 ? -(9 + r() * 4) : 8 + r() * 3;
			const cx = p.x + v.seaDir.x * off + side.x * (r() - 0.5) * 3;
			const cz = p.z + v.seaDir.z * off + side.z * (r() - 0.5) * 3;
			if (footprints.some((f) => Math.hypot(f.x - cx, f.z - cz) < 10.5)) continue;
			const face = seaAng + (r() - 0.5) * 0.25;
			if (house(cx, cz, face, WALLS[Math.floor(r() * WALLS.length)], ROOFS[Math.floor(r() * ROOFS.length)])) placed++;
		}
	}

	// the pier: from the beach out over the reef on posts
	const pier = { x: v.coast.x - v.seaDir.x * 6, z: v.coast.z - v.seaDir.z * 6, len: 48 + r() * 14, w: 2.6 };
	const deckY = 1.6;
	const pierM = new THREE.Matrix4().makeRotationY(seaAng).setPosition(pier.x, 0, pier.z);
	const pierParts = [];
	pierParts.push(paint(place(box(pier.w, 0.2, pier.len, 1.3), 0, deckY, pier.len / 2), [0.78, 0.68, 0.54]));
	pierParts.push(paint(place(box(8, 0.2, 5, 1.3), 0, deckY, pier.len + 2), [0.78, 0.68, 0.54]));
	for (let s = 0; s <= pier.len + 4; s += 4) for (const sx of [-1, 1]) {
		const wx = pier.x + v.seaDir.x * s + side.x * sx * 1.2, wz = pier.z + v.seaDir.z * s + side.z * sx * 1.2;
		const bed = island.heightAt(wx, wz), ph = deckY - bed + 0.6;
		pierParts.push(paint(place(new THREE.CylinderGeometry(0.14, 0.17, ph, 6), sx * (s > pier.len ? 3.8 : 1.2), deckY - ph / 2 + 0.3, s), [0.36, 0.30, 0.24]));
	}
	for (const sx of [-1, 1]) pierParts.push(paint(place(box(0.08, 0.08, pier.len), sx * 1.25, deckY + 0.9, pier.len / 2), [0.55, 0.48, 0.4]));
	for (const g of pierParts) { if (!g.attributes.uv) continue; parts.wood.push(g.applyMatrix4(pierM)); }
	footprints.push({ pier: true, x: pier.x, z: pier.z, face: seaAng, len: pier.len + 4, w: pier.w, y: deckY + 0.1 });

	const tex = { siding: TX.siding(), roof: TX.roofing(), plank: TX.planks() };
	const mats = {
		wall: new THREE.MeshStandardMaterial({ map: tex.siding, vertexColors: true, roughness: 0.85 }),
		roof: new THREE.MeshStandardMaterial({ map: tex.roof, vertexColors: true, roughness: 0.55, metalness: 0.25 }),
		wood: new THREE.MeshStandardMaterial({ map: tex.plank, vertexColors: true, roughness: 0.9 }),
		glass: new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: 0.15, metalness: 0.2, emissive: 0xffc47a, emissiveIntensity: 0 }),
	};
	const group = new THREE.Group();
	group.name = 'village';
	const pickables = [];
	for (const k of Object.keys(parts)) {
		if (!parts[k].length) continue;
		const clean = parts[k].map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(a)) n.deleteAttribute(a); return n; });
		const merged = mergeGeometries(clean, false);
		const mesh = new THREE.Mesh(merged, mats[k]);
		mesh.castShadow = k !== 'glass';
		mesh.receiveShadow = true;
		mesh.userData.material175 = k === 'roof' ? 'crystal' : k === 'glass' ? 'crystal' : 'wood';
		group.add(mesh);
		pickables.push(mesh);
	}

	// a fishing boat on its mooring off the pier head
	const boat = new THREE.Group();
	const hullShape = new THREE.Shape();
	hullShape.moveTo(-1.4, -3.2); hullShape.lineTo(1.4, -3.2); hullShape.lineTo(1.5, 1.6); hullShape.quadraticCurveTo(0, 4.6, -1.5, 1.6); hullShape.closePath();
	const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 1.5, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 });
	hull.rotateX(-Math.PI / 2);
	boat.add(new THREE.Mesh(hull, new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 })));
	const stripe = new THREE.Mesh(box(3.1, 0.25, 6.6), new THREE.MeshStandardMaterial({ color: 0x8e2a22, roughness: 0.6 }));
	stripe.position.set(0, 1.35, -0.8); boat.add(stripe);
	const cabin = new THREE.Mesh(box(2.2, 1.6, 2.2), new THREE.MeshStandardMaterial({ color: 0xf5f5f2, roughness: 0.6 }));
	cabin.position.set(0, 2.3, -0.9); boat.add(cabin);
	const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.5, 6), mats.wood);
	mast.position.set(0, 4, -0.9); boat.add(mast);
	boat.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.material175 = 'wood'; pickables.push(o); } });
	const bx = pier.x + v.seaDir.x * (pier.len - 6) + side.x * 5.5, bz = pier.z + v.seaDir.z * (pier.len - 6) + side.z * 5.5;
	boat.position.set(bx, 0, bz);
	boat.rotation.y = seaAng + Math.PI / 2 + 0.2;
	group.add(boat);

	scene.add(group);
	function update(t, night) {
		mats.glass.emissiveIntensity = night * 2.2;
		boat.position.y = Math.sin(t * 0.9) * 0.12 - 0.2;
		boat.rotation.z = Math.sin(t * 0.7) * 0.04;
		boat.rotation.x = Math.sin(t * 0.55 + 1) * 0.03;
	}
	return { group, footprints, pickables, pier, boat, update, placed };
}
