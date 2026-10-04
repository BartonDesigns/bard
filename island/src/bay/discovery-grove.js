import * as THREE from 'three';

const TAU = Math.PI * 2;
const noise = (a, b = 0) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function segmentDistance(x, z, a, b) {
	const dx = b.x - a.x, dz = b.z - a.z, q = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
	return Math.hypot(x - a.x - dx * q, z - a.z - dz * q);
}
function nearBuilding(x, z, radius, box) {
	const c = Math.cos(box.a || 0), s = Math.sin(box.a || 0), dx = x - box.x, dz = z - box.z;
	const px = Math.abs(c * dx + s * dz), pz = Math.abs(-s * dx + c * dz);
	// Include the existing porch and eaves, as well as the mapped footprint.
	return Math.hypot(Math.max(0, px - box.w / 2 - 3), Math.max(0, pz - box.d / 2 - 3)) < radius;
}

/**
 * Static coastal cypress grove for the Discovery Museum's outer campus.
 *
 * add(material, geometry) receives world-space BufferGeometry suitable for the
 * museum's existing per-material merge. frameAt has discovery.js's (x,z,a,y)
 * signature; collisions is its B.col array. blocked(x,z,radius) reserves mapped
 * roads/paths against the low limbs and roots; high crowns may shade those paths.
 * All heights come from bay.heightAt; no temporary scene or textures.
 *
 * Geometry ownership transfers to add. The returned dispose() releases only the
 * three owned materials and is idempotent: call it when the merged museum batches
 * stream out. Final world resource capture can instead dispose those scene materials.
 */
export function buildDiscoveryGrove({ add, frameAt, collisions, bay, boxes = [], campus, cove, isPhone = false, blocked = () => false }) {
	const trees = [], limit = isPhone ? 6 : 9, ground = (x, z) => bay.heightAt(x, z);
	// A stable sequence along the northern/western perimeter leaves the central
	// courtyard, porch approaches and the eastward walk to Lookout Cove open.
	for (let i = 0; i < 128 && trees.length < limit; i++) {
		const a = 2.12 + noise(i, 14) * 2.58, distance = campus.r * (.72 + noise(i, 19) * .2);
		const x = campus.x + Math.cos(a) * distance, z = campus.z + Math.sin(a) * distance;
		const scale = .82 + noise(i, 23) * .24, radius = 9.1 * scale, y = ground(x, z);
		if (!Number.isFinite(y) || y < .5 || distance + radius > campus.r + 10) continue;
		if (cove && (Math.hypot(x - cove.x, z - cove.z) < 34 + radius || segmentDistance(x, z, campus, cove) < 5 + radius)) continue;
		// Keep the entire crown off buildings/porches, but reserve only the low
		// physical limbs at paths. This allows a walk under the canopy's shade.
		const clearance = 4.7 * scale;
		if (boxes.some(b => nearBuilding(x, z, radius, b)) || blocked(x, z, clearance)) continue;
		if (trees.some(t => Math.hypot(x - t.x, z - t.z) < (radius + t.radius) * .58)) continue;
		let lo = y, hi = y, suitable = true;
		for (let k = 0; k < 12; k++) {
			const angle = k / 12 * TAU, h = ground(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
			if (!Number.isFinite(h) || h < .4) { suitable = false; break; }
			lo = Math.min(lo, h); hi = Math.max(hi, h);
		}
		if (!suitable || hi - lo > 2.8) continue;
		trees.push({ x, y, z, radius, clearance, scale, height: 7.4 * scale, seed: i + 1 });
	}
	const bark = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 });
	const foliage = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1 });
	const earth = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
	bark.name = 'discovery-grove-bark'; foliage.name = 'discovery-grove-foliage'; earth.name = 'discovery-grove-earth';
	const materials = [bark, foliage, earth], stats = { trees: trees.length, vertices: 0, triangles: 0, colliders: 0, materials: trees.length ? 3 : 0 };
	const direction = new THREE.Vector3(), center = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), rotation = new THREE.Quaternion(), color = new THREE.Color();
	function emit(material, geometry) {
		stats.vertices += geometry.getAttribute('position').count;
		stats.triangles += (geometry.index?.count || geometry.getAttribute('position').count) / 3;
		// Pass a non-indexed geometry to avoid leaving an unowned indexed original
		// behind when discovery's add() converts it for merging.
		if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); add(material, flat); }
		else add(material, geometry);
	}
	function colorVertices(geometry, seed, base, amount) {
		const positions = geometry.getAttribute('position'), colors = new Float32Array(positions.count * 3);
		for (let i = 0; i < positions.count; i++) {
			const variation = .82 + noise(positions.getX(i) * 4 + positions.getY(i) * 3, seed + positions.getZ(i) * 2) * amount;
			color.setHex(base).multiplyScalar(variation); colors.set([color.r, color.g, color.b], i * 3);
		}
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	}
	function limb(tree, a, b, r0, r1, seed, solid = false) {
		direction.subVectors(b, a); const length = direction.length();
		const geometry = new THREE.CylinderGeometry(r1, r0, length, isPhone ? 6 : 8, 3);
		const positions = geometry.getAttribute('position');
		for (let i = 0; i < positions.count; i++) {
			const x = positions.getX(i), z = positions.getZ(i), angle = Math.atan2(z, x);
			const rib = 1 + .1 * Math.sin(angle * 5 + seed) + .045 * Math.cos(positions.getY(i) * 4 + seed);
			positions.setXYZ(i, x * rib, positions.getY(i), z * rib);
		}
		geometry.computeVertexNormals(); colorVertices(geometry, seed, 0x615344, .34);
		rotation.setFromUnitVectors(up, direction.normalize()); center.copy(a).add(b).multiplyScalar(.5);
		geometry.applyQuaternion(rotation).translate(tree.x + center.x, tree.y + center.y, tree.z + center.z); emit(bark, geometry);
		if (solid) {
			// Short oriented prisms closely follow the visible sloping trunk/limbs;
			// preserve headroom under the higher spreading branches.
			const n = Math.max(1, Math.ceil(length / 1.05));
			for (let i = 0; i < n; i++) {
				const p = a.clone().lerp(b, i / n), q = a.clone().lerp(b, (i + 1) / n), radius = r0 + (r1 - r0) * i / n;
				if (Math.min(p.y, q.y) - radius > 2.8) continue;
				const angle = Math.atan2(q.z - p.z, q.x - p.x), F = frameAt(tree.x + (p.x + q.x) / 2, tree.z + (p.z + q.z) / 2, angle, tree.y);
				const half = Math.hypot(q.x - p.x, q.z - p.z) / 2 + radius;
				collisions.push({ F, x0: -half, x1: half, z0: -radius, z1: radius, y0: tree.y + Math.min(p.y, q.y) - radius, y1: tree.y + Math.max(p.y, q.y) + radius }); stats.colliders++;
			}
		}
	}
	function crown(tree, x, y, z, sx, sy, sz, seed) {
		const geometry = new THREE.IcosahedronGeometry(1, isPhone ? 0 : 1), positions = geometry.getAttribute('position');
		for (let i = 0; i < positions.count; i++) {
			const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i), f = .9 + noise(px * 7 + py * 3, pz * 8 + seed) * .18;
			// A shallow, uneven lower surface and broad crown, rather than a ball.
			positions.setXYZ(i, px * sx * f, py * sy * (py < 0 ? .4 : 1) * f, pz * sz * f);
		}
		geometry.computeVertexNormals(); colorVertices(geometry, seed, seed % 2 ? 0x465134 : 0x58613c, .32);
		geometry.translate(tree.x + x, tree.y + y, tree.z + z); emit(foliage, geometry);
	}
	for (const tree of trees) {
		const s = tree.scale, seed = tree.seed, v = (x, y, z) => new THREE.Vector3(x * s, y * s, z * s);
		const base = v(0, -.14, 0), fork = v(.3, 2.2, -.12), top = v(.65, 4.65, -.28);
		limb(tree, base, fork, .65 * s, .48 * s, seed, true); limb(tree, fork, top, .48 * s, .23 * s, seed + 2, true);
		// Buttress roots finish on the sampled ground instead of floating over it.
		for (let k = 0; k < 7; k++) {
			const a = k / 7 * TAU + noise(seed, k), reach = (1.5 + noise(k, seed) * 1.1) * s;
			const x = Math.cos(a) * reach, z = Math.sin(a) * reach, h = ground(tree.x + x, tree.z + z) - tree.y;
			limb(tree, v(Math.cos(a) * .25, .38, Math.sin(a) * .25), new THREE.Vector3(x, h + .02, z), .28 * s, .025 * s, seed + k);
		}
		const branches = isPhone ? 4 : 5;
		for (let k = 0; k < branches; k++) {
			const a = k / branches * TAU + seed * .37, reach = 4 + noise(seed, k + 9) * 1.6;
			const start = v(.26, 1.8 + k * .34, -.1), elbow = v(Math.cos(a) * reach * .52, 2.55 + k * .25, Math.sin(a) * reach * .52);
			const end = v(Math.cos(a) * reach, 4.4 + noise(seed, k + 2) * 1.15, Math.sin(a) * reach);
			limb(tree, start, elbow, .3 * s, .2 * s, seed + k + 11, true); limb(tree, elbow, end, .2 * s, .085 * s, seed + k + 17, true);
			for (let j = 0; j < 2; j++) {
				const tip = end.clone().add(v(Math.cos(a + (j ? .65 : -.65)) * 1.25, .35 + j * .3, Math.sin(a + (j ? .65 : -.65)) * 1.25));
				limb(tree, elbow.clone().lerp(end, .7), tip, .09 * s, .025 * s, seed + k * 2 + j + 24);
				crown(tree, tip.x, tip.y, tip.z, 1.8 * s, .9 * s, 1.6 * s, seed + k * 2 + j);
			}
			crown(tree, end.x * .78, end.y + .45 * s, end.z * .78, 2.1 * s, 1.05 * s, 1.7 * s, seed + k + 31);
		}
		crown(tree, .45 * s, 5.9 * s, -.2 * s, 3.3 * s, 1.1 * s, 2.8 * s, seed + 41);
		// Low irregular earth/needle bed follows the real surface. Real canopy
		// shadows remain enabled by the museum's normal batch renderer on desktop.
		const segments = isPhone ? 16 : 24, positions = [], colors = [], shade = new THREE.Color();
		const bedRadius = k => Math.min(tree.clearance - .15, (3.3 + noise(k, seed) * 1.5) * s);
		for (let k = 0; k < segments; k++) {
			for (const [angle, radius] of [[0, 0], [k / segments * TAU, bedRadius(k)], [(k + 1) / segments * TAU, bedRadius((k + 1) % segments)]]) {
				const x = tree.x + Math.cos(angle) * radius, z = tree.z + Math.sin(angle) * radius;
				positions.push(x, ground(x, z) + .035, z); shade.setHex(radius ? 0x655d45 : 0x403e31); colors.push(shade.r, shade.g, shade.b);
			}
		}
		const patch = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)).setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		// Ring order above points downward in the XZ plane; flip to face upward.
		const p = patch.getAttribute('position'), c = patch.getAttribute('color');
		for (let i = 0; i < p.count; i += 3) for (const attr of [p, c]) for (let j = 0; j < 3; j++) { const value = attr.array[(i + 1) * 3 + j]; attr.array[(i + 1) * 3 + j] = attr.array[(i + 2) * 3 + j]; attr.array[(i + 2) * 3 + j] = value; }
		patch.computeVertexNormals(); emit(earth, patch);
	}
	let disposed = false;
	function dispose() { if (disposed) return; disposed = true; for (const material of materials) material.dispose(); }
	if (!trees.length) dispose();
	return { trees, stats, materials, dispose };
}
