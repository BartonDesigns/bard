// The country's homes are homes: every regional house kind describes itself (structures.js
// home()), settle.js hands it to bay/houses.js as a house to plan and build, the plan has a
// kitchen, a bed and a bath, its walls give way once it is built, and the same home keeps its
// name when the floating frame moves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSettlements } from '../src/region/settle.js';
import { planHouse } from '../src/bay/houseplan.js';

const HOMES = ['log', 'arctic', 'chalet', 'farmhouse', 'cottage', 'halftimber', 'stonehouse', 'stonetile', 'cube', 'adobe', 'adobethatch', 'homestead', 'tinroof', 'tincottage', 'stilt', 'easthouse', 'flatbrick', 'mudtile'];
const KIT = { log: 'snow', arctic: 'polar', chalet: 'alpine', farmhouse: 'farm', cottage: 'village', halftimber: 'village', stonehouse: 'himalaya', stonetile: 'mediterranean', cube: 'mediterranean', adobe: 'desert', adobethatch: 'andes', homestead: 'outback', tinroof: 'savanna', tincottage: 'island', stilt: 'jungle', easthouse: 'eastvillage', flatbrick: 'southasia', mudtile: 'sahel' };
const SIZE = { farmhouse: [10, 9], homestead: [14, 12], chalet: [9.5, 8], halftimber: [8.5, 7] };

function one(type, { ground = (x) => 20 + x * 0.02, rot = 0.6 } = {}) {
	const scene = new THREE.Scene(), F = { epoch: 1 };
	let shift = 0;
	const S = createSettlements({ scene, ground, wet: () => false, F, toXZ: () => ({ x: shift, z: 0 }), toLL: (x, z) => ({ lat: z, lon: x }), isPhone: true });
	const [w, d] = SIZE[type] || [7.5, 6];
	const site = S.add({ key: 'home:' + type, kind: 'village', kit: KIT[type], lots: [{ type, x: 10, z: 10, w, d, rot, role: 'house' }] });
	const cam = { position: { x: 10, y: 30, z: 10 } };
	for (let i = 0; i < 160 && ![...site.cells.values()].some((c) => c.mesh); i++) S.update(0.1, cam, { budget: 4 });
	return { S, site, F, scene, cam, move: (dx) => { shift = dx; F.epoch++; S.update(0.1, cam, { budget: 4 }); } };
}

test('every country house kind describes itself as a home, its own faces marked', () => {
	for (const type of HOMES) {
		const { S, site } = one(type);
		const C = [...site.cells.values()].find((c) => c.mesh);
		assert.ok(C, type + ' built');
		assert.equal(C.homes.length, 1, type + ' is a home');
		const r = C.homes[0], H = r.H;
		assert.ok(r.v1 > r.v0 && r.v1 <= C.mesh.geometry.attributes.position.count, type + ' marks its own faces');
		for (const k of ['w', 'd', 'H', 'y0']) assert.ok(Number.isFinite(H[k]) && H[k] >= 0, type + ' ' + k);
		assert.ok(['gable', 'hip', 'flat'].includes(H.roof?.kind), type + ' has a roof');
		assert.ok(C.mesh.geometry.attributes.aNear?.itemSize === 4, type + ' can hand over');
		S.dispose();
	}
});

test('a country home is planned as a house with a kitchen, a bed and a bath, its door on its front', () => {
	for (const type of HOMES) {
		const { S } = one(type);
		const [grp] = S.homesNear(10, 10, 40);
		assert.ok(grp && grp.rural && Number.isFinite(grp.floorY), type + ' near');
		const plan = planHouse(grp);
		assert.ok(plan, type + ' planned');
		const items = new Set(plan.items.map((i) => i.type)), rooms = plan.rooms.filter((r) => r.cells.length).map((r) => r.type);
		assert.ok(items.has('fridge') || rooms.includes('kitchen'), type + ' has a kitchen: ' + rooms);
		assert.ok(items.has('bed'), type + ' has a bed: ' + [...items]);
		assert.ok(items.has('toilet'), type + ' has a bath: ' + [...items]);
		const R0 = plan.rects.find((r) => r.main);
		assert.ok(Math.abs(plan.door.z - R0.z1) < 0.01, type + ' door on the front');
		S.dispose();
	}
});

test('built for real, a home hands over its faces and stops holding you out', () => {
	const { S, site } = one('farmhouse');
	const [grp] = S.homesNear(10, 10, 40), C = [...site.cells.values()].find((c) => c.mesh), r = C.homes[0];
	const p = { x: site.x + r.c[0], z: site.z + r.c[1] };
	S.push(p, r.y + 0.8);
	assert.ok(Math.hypot(p.x - site.x - r.c[0], p.z - site.z - r.c[1]) > 3, 'the far house holds you out');
	grp.nearBorn = 5;
	S.setNear(grp, [grp[0].x, grp[0].z]);
	const A = C.mesh.geometry.attributes.aNear.array;
	assert.equal(A[r.v0 * 4 + 2], 1); assert.equal(A[(r.v1 - 1) * 4 + 2], 1); assert.equal(A[r.v0 * 4 + 3], 5);
	assert.equal(A[r.v1 * 4 + 2] || 0, 0, 'what stands beside it stays');
	const q = { x: site.x + r.c[0], z: site.z + r.c[1] };
	S.push(q, r.y + 0.8);
	assert.ok(Math.hypot(q.x - site.x - r.c[0], q.z - site.z - r.c[1]) < 1e-6, 'its walls are the built house\'s now');
	S.setNear(grp, null);
	assert.equal(A[r.v0 * 4 + 2], 0);
	S.dispose();
});

test('a home keeps its name when the frame moves, and the house built in the old frame goes', () => {
	const { S, move } = one('cottage');
	const [a] = S.homesNear(10, 10, 40);
	move(1000);
	assert.ok(a.dead, 'the old one is let go');
	const [b] = S.homesNear(1010, 10, 40);
	assert.ok(b && b !== a && !b.dead);
	assert.equal(b.homeId, a.homeId);
	assert.ok(Math.abs(b[0].x - a[0].x - 1000) < 1e-6);
	S.dispose();
});
