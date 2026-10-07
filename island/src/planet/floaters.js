// A mystical world's terraces of rock hung in the air (world/landforms.js 'floating' lays them
// out): a grassed top you can stand on, a broken root of stone below, crystals growing down
// from it; and the crystal fields on the plain beneath. Plain lit materials, no shader of
// their own.

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function createFloaters(island, scene, profile) {
	const list = island.floaters || [];
	const group = new THREE.Group();
	group.name = 'floaters';
	const grass = new THREE.Color(...(profile.ground?.grass || [0.4, 0.4, 0.5])), rock = new THREE.Color(...(profile.ground?.rock || [0.4, 0.4, 0.45]));
	const glow = new THREE.Color(...(profile.glow || [0.65, 0.45, 1.0]));
	const paint = (g, c) => {
		const n = g.attributes.position.count, a = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
		g.setAttribute('color', new THREE.BufferAttribute(a, 3));
		return g.index ? g.toNonIndexed() : g;
	};
	const stone = [], gems = [];
	for (const f of list) {
		const r = mulberry32(f.seed);
		// the top: a shallow dome of turf
		const top = new THREE.CylinderGeometry(f.r, f.r * 0.96, 1.6, 20, 1);
		top.translate(f.x, f.y - 0.8, f.z);
		stone.push(paint(top, grass));
		// the root: a jagged cone of rock hanging under it
		const depth = f.r * (1.1 + r() * 0.8);
		const cone = new THREE.ConeGeometry(f.r * 0.97, depth, 14, 4, true);
		const p = cone.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const y = p.getY(i), k = 0.5 - y / depth;
			const j = 1 + (r() - 0.5) * 0.35 * k;
			p.setX(i, p.getX(i) * j); p.setZ(i, p.getZ(i) * j);
		}
		cone.rotateX(Math.PI);
		cone.translate(f.x, f.y - 1.6 - depth / 2, f.z);
		cone.computeVertexNormals();
		stone.push(paint(cone, rock));
		// crystals growing down out of the rock
		for (let k = 0; k < 5; k++) {
			const a = r() * Math.PI * 2, d = r() * f.r * 0.5, L = 3 + r() * f.r * 0.35;
			const g = new THREE.CylinderGeometry(0, 0.6 + r() * 0.8, L, 6);
			g.rotateX(Math.PI + (r() - 0.5) * 0.5);
			g.translate(f.x + Math.cos(a) * d, f.y - 2 - depth * (0.3 + r() * 0.3) - L / 2, f.z + Math.sin(a) * d);
			gems.push(paint(g, glow));
		}
	}
	// the crystal fields on the plain: clusters of shards where the ground is low and level
	const rr = mulberry32(island.seed ^ 0xc4157a1);
	for (let c = 0; c < 26; c++) {
		const cx = (rr() - 0.5) * island.R * 1.6, cz = (rr() - 0.5) * island.R * 1.6;
		const h0 = island.heightAt(cx, cz);
		if (h0 < 1 || h0 > 16 || Math.hypot(cx - island.village.x, cz - island.village.z) < 90) continue;
		for (let k = 0; k < 9; k++) {
			const x = cx + (rr() - 0.5) * 16, z = cz + (rr() - 0.5) * 16, L = 1.5 + rr() * 5;
			const g = new THREE.CylinderGeometry(0, 0.4 + rr() * 0.7, L, 6);
			g.rotateZ((rr() - 0.5) * 0.7); g.rotateY(rr() * 6.28);
			g.translate(x, island.heightAt(x, z) + L * 0.42, z);
			gems.push(paint(g, glow));
		}
	}
	const mk = (parts, mat) => {
		if (!parts.length) return;
		const m = new THREE.Mesh(mergeGeometries(parts.map((g) => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(a)) g.deleteAttribute(a); return g; }), false), mat);
		m.castShadow = true; m.receiveShadow = true;
		m.userData.material175 = 'crystal';
		group.add(m);
		for (const g of parts) g.dispose();
		return m;
	};
	const stoneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
	const gemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.1, emissive: glow, emissiveIntensity: 0.6, flatShading: true });
	const meshes = [mk(stone, stoneMat), mk(gems, gemMat)].filter(Boolean);
	scene.add(group);
	// the tops are floors: stand on one, walk off its edge and fall
	function floor(x, z, y) {
		let g = -Infinity;
		for (const f of list) if (Math.hypot(x - f.x, z - f.z) < f.r * 0.94 && y > f.y - 3) g = Math.max(g, f.y);
		return g;
	}
	function update(night) { gemMat.emissiveIntensity = 0.5 + night * 1.6; }
	return { group, floor, update, pickables: meshes, dispose() { scene.remove(group); for (const m of meshes) m.geometry.dispose(); stoneMat.dispose(); gemMat.dispose(); } };
}
