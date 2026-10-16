// A house built by bay/houses.js, broken by structures/walls/: the drawn replacement for a wall
// sits where the wall was (inside its bounds, in the house's own frame, carrying the house's
// dissolve anchor so it never vanishes or fades in from elsewhere), the first punches only dent
// it (its faces still drawn, nothing opened), and what stops you opens only once a real breach
// does: then a body walks through it, and a whole wall still stops one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// (no canvas in Node: a stand-in that takes every drawing call and draws nothing)
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k === 'measureText' ? () => ({ width: 0 }) : k.startsWith?.('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
globalThis.document = globalThis.document || { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }) };

const { createHouses } = await import('../src/bay/houses.js');
const { createWalls } = await import('../src/structures/walls/index.js');

function stage() {
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	const house = { x: 220, z: -140, w: 14, d: 11, a: 0.35, wallH: 5.75, roofH: 1.6, kind: 0, door: 0.5, hip: 1, look: { wall: [0.86, 0.8, 0.68], roof: [0.3, 0.3, 0.31], era: 'tract' } };
	house.grp = [house];
	const bay = { heightAt: () => 0, loaded: () => true };
	const city = { houseLook: (b) => b.look, setNearBand() {}, setNear(g, c) { g.near = c; }, procHomes: () => [], lotsNear: () => [] };
	const houses = createHouses(scene, bay, { loaded: () => true, near: (k) => (k === 'boxes' ? [house] : []) }, city, { isPhone: false });
	camera.position.set(house.x, 1.7, house.z + 12);
	for (let i = 0; i < 4000 && (houses.count() < 1 || houses.busy()); i++) houses.update(camera, 0.05, 0);
	const h = houses.houses.get(house.grp);
	const walls = createWalls({ scene, isPhone: false, sounds: {}, debris: null, floorAt: () => 0, city: () => city, world: () => ({ houses }) });
	walls.update(1, camera, null);
	return { scene, camera, houses, h, walls, house };
}
// the bounds of a wall's own triangles in the house's merged meshes
function sourceBounds(Wl) {
	const box = new THREE.Box3(), v = new THREE.Vector3();
	const byName = new Map(); for (const m of Wl.src.root.children) if (m.isMesh && !m.userData.wallDamage && !byName.has(m.name)) byName.set(m.name, m);
	for (const [k, s, n] of Wl.verts) { const p = byName.get(k)?.geometry.attributes.position; if (p) for (let i = s; i < s + n; i++) box.expandByPoint(v.fromBufferAttribute(p, i)); }
	return box;
}

test('a house wall broken in place: the replacement inside the wall, anchored like the house, solid until a breach', () => {
	const { h, walls, houses } = stage();
	assert.ok(h, 'the house was built');
	const src = [...walls.sources.values()].find((s) => s.kind === 'house');
	assert.ok(src && src.walls.length > 4, 'its walls are known');
	const ext = src.walls.find((Wl) => Wl.ext && Wl.floor === 0 && Wl.pieces.some((p) => p.u1 - p.u0 > 1.5 && p.y1 - p.y0 > 2.3 && p.y0 <= 0.05));
	const pc = ext.pieces.find((p) => p.u1 - p.u0 > 1.5 && p.y1 - p.y0 > 2.3 && p.y0 <= 0.05);
	const before = sourceBounds(ext);
	assert.ok(!before.isEmpty());
	const room = ext.stack.dir < 0 ? 1 : 0, u = (pc.studs[1] + pc.studs[2]) / 2;
	const at = walls.toWorld(ext, u, 1.3, room ? ext.a1 : ext.a0), n = walls.normalOf(ext, room);
	const eye = at.clone().addScaledVector(n, 0.6), dir = at.clone().sub(eye).normalize();
	// one punch: a dent
	const r = walls.blow(eye, dir, 1.8, { kind: 'light', dmg: 11 });
	assert.ok(r && r.material === 'drywall' && !r.holed, 'the punch landed on the drywall and only dented it');
	walls.update(0.1, null, null);
	assert.ok(ext.meshes.length >= 3, 'the wall is drawn again by walls/');
	const names = ext.meshes.map((m) => m.name);
	for (const k of pc.keys) if (k) assert.ok(names.some((q) => q === k || k.startsWith(q)), `its ${k} face is still drawn`);
	// (in the house's frame, inside the wall's own bounds; a few centimetres for flaps and batts)
	const grown = before.clone().expandByScalar(0.06);
	for (const m of ext.meshes) {
		assert.equal(m.parent, h.root, 'in the house\'s own group');
		m.geometry.computeBoundingBox();
		assert.ok(grown.containsBox(m.geometry.boundingBox), `${m.name} within the wall's bounds`);
		const A = m.geometry.attributes.aLodAnchor, R = h.root.children.find((q) => q.isMesh && !q.userData.wallDamage).geometry.attributes.aLodAnchor;
		assert.ok(A, `${m.name} carries the house's dissolve anchor`);
		for (let q = 0; q < 4; q++) assert.equal(A.array[q], R.array[q]);
	}
	// the faces cover the wall: their area about the piece's, both sides
	const area = (m) => { const p = m.geometry.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let s = 0; for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); s += b.sub(a).cross(c.sub(a)).length() / 2; } return s; };
	const want = ext.pieces.reduce((s, p) => s + (p.u1 - p.u0) * (p.y1 - p.y0), 0) * 2;
	const faces = ext.meshes.filter((m) => !m.name.startsWith('wall-')).reduce((s, m) => s + area(m), 0);
	assert.ok(faces > want * 0.95, `the faces still cover the wall (${faces.toFixed(1)} of ${want.toFixed(1)} m2)`);
	// what stops you: unchanged by punches
	assert.ok(pc.col[4] < 1e8 && pc.col[5] > -1e8, 'the wall still stops you');
	for (let i = 0; i < 12; i++) walls.blow(eye, dir, 1.8, { kind: 'heavy', dmg: 24 });
	walls.update(0.1, null, null);
	assert.ok(pc.col[4] < 1e8, 'a fist-sized hole is no way through');
	const body = eye.clone(); body.y = h.floorY + 1.68;
	for (let i = 0; i < 30; i++) { body.addScaledVector(n, -0.05); houses.push(body, body.y - 1.68); }
	assert.ok(body.clone().sub(at).dot(n) > 0, 'walking into it, you are stopped');
	// a round as combat hands it over (combat marks it wall: true, the wall's record rides as wallHit)
	{
		const o = walls.toWorld(ext, u + 0.4, 1.6, room ? ext.a0 : ext.a1).addScaledVector(n, -5), d = walls.toWorld(ext, u + 0.4, 1.6, room ? ext.a0 : ext.a1).sub(o).normalize();
		const hh = walls.ray(o, d, 10);
		assert.ok(hh, 'a round from outside meets the wall');
		const r2 = walls.hit({ ...hh, wallHit: hh.wall, wall: true }, o.clone().addScaledVector(d, hh.t), d, 58, 'ballistic');
		assert.ok(r2.through && r2.dmg > 10 && r2.dmg < 58, 'it goes on through, weaker');
	}
	// a blast against it: a breach, and through it you go
	walls.blast(at.clone().addScaledVector(n, 0.4), 2.6, 260);
	for (let i = 0; i < 30; i++) walls.update(0.1, null, null);          // (a wall or two rebuilt a frame)
	const br = ext.breach.find(Boolean);
	assert.ok(br && br.kind === 'stand', 'a way through');
	// (nothing that stops you stands across the breach at a body's width; beside it the wall still does)
	const blocks = (u) => { const X = ext.axis === 'x'; return h.col.some((b) => { const c0 = X ? b[1] : b[0], c1 = X ? b[3] : b[2], s0 = X ? b[0] : b[1], s1 = X ? b[2] : b[3]; return c1 > ext.a0 - 0.01 && c0 < ext.a1 + 0.01 && s1 > u - 0.3 && s0 < u + 0.3 && b[5] > h.floorY * 0 + 0.3 && b[4] < 1.7 && b[4] < b[5]; }); };
	assert.ok(!blocks((br.u0 + br.u1) / 2), 'a body passes through the breach');
	const beside = pc.u0 + 0.31 < br.u0 ? pc.u0 + 0.31 : pc.u1 - 0.31 > br.u1 ? pc.u1 - 0.31 : null;
	if (beside !== null) assert.ok(blocks(beside), 'the wall beside it still stops you');
	// repaired: the builder's wall back, ours gone
	walls.repair(src.id);
	assert.equal(ext.meshes.length, 0);
	assert.ok(pc.col[4] < 1e8, 'solid again');
	assert.ok(sourceBounds(ext).equals(before), 'the builder\'s triangles put back');
});
