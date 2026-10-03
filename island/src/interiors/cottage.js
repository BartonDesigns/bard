// Inside the island's fishing cottages (world/village.js): one room under the tin roof, the
// bed against the back wall, the stove and counter, a table for two by the window, a chair
// by the door, shelves and a rug, furnished with the houses' own kit (bay/housekit.js) as
// you come near and let go as you leave. The walls are the cottage's (hollow, the doorway
// open onto the porch); the furniture here joins them as things to walk round.

import * as THREE from 'three';
import { Builder, houseMaterials } from '../bay/housekit.js';
import { drawAny, SOFT } from './kit.js';
import { captureResources } from '../world/resources.js';

export function createCottageInteriors(scene, footprints, { isPhone = false, mats = null } = {}) {
	const R = isPhone ? 30 : 45, MAX = isPhone ? 2 : 4;
	const list = footprints.filter((f) => f.room), live = new Map();
	const group = new THREE.Group();
	group.name = 'cottage-interiors';
	scene.add(group);
	let M = mats;
	function build(f) {
		if (!M) M = houseMaterials([-2, -1, 120, 130]);
		const { w, d, wallH } = f.room, x0 = -w / 2 + 0.16, x1 = w / 2 - 0.16, z0 = -d / 2 + 0.16, z1 = d / 2 - 0.16;
		let s = Math.floor(Math.abs(f.x * 31 + f.z * 17)) % 2147483646 + 1;
		const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
		const items = [], ceil = Math.min(wallH, 3.1) - 0.06;
		const it = (type, x, z, rot, iw, id, h, extra = {}) => { const hw = rot % 2 ? id / 2 : iw / 2, hd = rot % 2 ? iw / 2 : id / 2; items.push({ type, x, z, y: 0, rot, w: iw, d: id, h, v: rnd(), ceil, box: [x - hw, z - hd, x + hw, z + hd], ...extra }); };
		it('bed', x1 - 0.72, z0 + 1.03, 0, 1.4, 2.05, 0.6);
		const cl = Math.max(0.9, (x1 - 1.6) - x0 - 0.1);
		it('counter', x0 + cl / 2, z0 + 0.32, 0, cl, 0.63, 0.92, { uppers: 0.6, sink: x0 + cl * 0.3, range: x0 + cl * 0.75, c: x0 + cl / 2 });
		it('diningTable', w * 0.16, d * 0.1, 0, 1.0, 0.75, 0.76, { chairs: 2 });
		it('armchair', x1 - 0.45, z1 - 0.55, 2, 0.8, 0.8, 0.85);
		it('bookcase', x0 + 0.17, -0.2, 1, 0.9, 0.34, 1.8);
		it('rug', w * 0.05, d * 0.12, 0, Math.min(2.2, w - 2), 1.4, 0.01);
		it('plant', x0 + 0.3, z1 - 0.35, 0, 0.4, 0.4, 1.0);
		it('art', x1 - 0.72, z0 + 0.02, 0, 0.7, 0.03, 0.01);
		it('ceilingLight', 0, 0, 0, 0.35, 0.35, 0, { kind: 'pendant', level: 0 });
		const g = new Builder(), col = [];
		for (const q of items) { drawAny(g, q, rnd); if (!SOFT.has(q.type)) col.push([...q.box, Math.max(0.3, q.h)]); }
		const root = new THREE.Group();
		for (const m of g.meshes(M, !isPhone)) root.add(m);
		root.position.set(f.x, f.y, f.z);
		root.rotation.y = f.face;
		group.add(root);
		f.walls.push(...col);
		return { root, col };
	}
	function drop(f, H) {
		group.remove(H.root);
		H.root.traverse((q) => q.geometry?.dispose());
		f.walls.splice(f.walls.length - H.col.length, H.col.length);
	}
	let t = 0;
	function update(cam, dt = 0.016) {
		if (!list.length) return;
		t -= dt;
		if (t > 0) return;
		t = 0.5;
		const near = list.map((f) => [Math.hypot(f.x - cam.x, f.z - cam.z), f]).filter((q) => q[0] < R && Math.abs(cam.y - q[1].y) < 60).sort((a, b) => a[0] - b[0]).slice(0, MAX);
		for (const [f, H] of live) if (!near.some((q) => q[1] === f)) { drop(f, H); live.delete(f); }
		for (const [, f] of near) if (!live.has(f)) { live.set(f, build(f)); break; }
	}
	function dispose() {
		for (const [f, H] of live) drop(f, H);
		live.clear(); group.removeFromParent();
		// The kit outlives individual streamed rooms, including periods with no room
		// in the scene. Release the owned palette when the world itself is retired.
		if (M && !mats) captureResources(group, { materials: Object.values(M) })();
		M = null;
	}
	return { update, dispose, group, count: () => live.size, cottages: list.length };
}
