// The buildings' polish: a wreck reads as one (slabs hanging off their bars, bars out of the
// breaks, rooms behind the holes, a heap of every size of block), a tower with one hole stays
// cheap, a rebuild goes frame then walls then glass, fresh wrecks burn, the crews' trucks and
// people are built, and the landmarks take a beating without coming down (unless the world is
// ending).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildShell, fireSpots, standingOf } from '../src/structures/shell.js';
import { parts, flatbed, dump, mixer, mixerDrum, craneCarrier, craneUpper, van, createCrew, towerJib, cloth, NET } from '../src/structures/crewkit.js';
import { createMonuments } from '../src/structures/monuments.js';
import { landmarkRects } from '../src/bay/footprints.js';

const original = globalThis.localStorage;
afterEach(() => { if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original; });
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const lot = (o = {}) => ({ x: 100, z: 50, w: 28, d: 36, h: 21.2, a: 0.3, y: -1.2, kind: 3, col: [0.7, 0.68, 0.64], roof: null, ...o });
const finite = (g) => g.attributes.position.array.every(Number.isFinite);

test('a partial collapse: slabs hang off their bars, bars stand out of the breaks, the heap is blocks of every size', () => {
	const o = lot(), rec = { m: [[0, 0, 4, 3], [2, 0, 4, 3]], c: 0.5, s: 4321, hp: 0.3, cause: 'blast' };
	const B = buildShell(o, rec);
	assert.ok(B.hangs > 4, `pieces of slab hanging (${B.hangs})`);
	assert.ok(B.rebars > 40, `rebar showing (${B.rebars})`);
	assert.ok(B.blocks > 30, `a heap of blocks (${B.blocks})`);
	assert.ok(finite(B.geo) && B.geo.attributes.aFac.count === B.verts, 'every vertex has its facade');
	// (the heap spills further the way it fell: the low side of the slant)
	const S = standingOf(o, rec), lo = [-S.dx * (o.w / 2 + 3), -S.dz * (o.d / 2 + 3)], hi = [S.dx * (o.w / 2 + 3), S.dz * (o.d / 2 + 3)];
	assert.ok(B.rubble(lo[0], lo[1]) > B.rubble(hi[0], hi[1]), 'the mound leans the way it fell');
});

test('a tower with one small hole is cheap: the whole walls are big quads, the windows drawn by the material', () => {
	const o = lot({ w: 42, d: 34, h: 117.2, kind: 2 });
	const B = buildShell(o, { m: [[3, 0, 0.9, 0.46]], c: 0, s: 1234, hp: 0.98 });
	assert.ok(B.verts < 20000, `vertices ${B.verts}`);
	const win = [...new Set(Array.from(B.geo.attributes.aFac.array.filter((v, i) => i % 4 === 0)))];
	assert.ok(win.includes(3), 'its curtain wall drawn as such');
	const lite = buildShell(lot(), { m: [[0, 0, 4, 3]], c: 0.5, s: 4321, hp: 0.3 }, null, { lite: true }), full = buildShell(lot(), { m: [[0, 0, 4, 3]], c: 0.5, s: 4321, hp: 0.3 });
	assert.ok(lite.verts < full.verts, 'a phone draws less of it');
});

test('a rebuild: the rubble cleared, the frame up ahead of the walls, glazed from the ground up, whole at the end', () => {
	const o = lot(), rec = { m: [[0, 0, 4, 3]], c: 0.93, s: 999, hp: 0.1 }, H = o.h - 1.2;
	const at = (p) => buildShell(o, rec, p);
	assert.ok(at(null).rubble(0, 0) > 0.5 && at(0.2).rubble(0, 0) === 0, 'cleared by a fifth of the way');
	const mid = at(0.5), late = at(0.8);
	assert.ok(mid.standing(0, o.d / 2) < late.standing(0, o.d / 2), 'the walls rise');
	const glazed = (B) => { const f = B.geo.attributes.aFac.array; let g = 0, raw = 0; for (let i = 0; i < f.length; i += 4) if (f[i] > 0) { if (f[i + 3] === 0) g++; else if (f[i + 3] === 2) raw++; } return { g, raw }; };
	assert.ok(glazed(mid).raw > 0, 'bare openings in the new work');
	assert.equal(at(1).standing(0, o.d / 2), H);
	assert.equal(glazed(at(1)).raw, 0, 'all glazed at the end');
});

test('a fresh wreck burns: most of a blast\'s holes and a collapse\'s broken storeys', () => {
	const o = lot();
	assert.ok(fireSpots(o, { m: [[0, 0, 4, 3], [1, 2, 2, 2], [2, 1, 6, 2]], c: 0, s: 7, cause: 'blast' }).length >= 1);
	assert.equal(fireSpots(o, { m: [], c: 0, s: 7 }).length, 0, 'nothing broken, nothing burning');
	const down = fireSpots(o, { m: [], c: 0.93, s: 7 });
	assert.ok(down.length >= 3 && down.every((f) => f.every(Number.isFinite)));
});

test('the crews\' kit: trucks, the mixer\'s drum, the crane\'s upper works, the crew instanced', () => {
	const K = parts();
	flatbed(K.at(0, 0, 0), [1, 0.5, 0.1], 'glass'); dump(K.at(10, 0, 0, 1), [1, 0.5, 0.1], true); mixer(K.at(20, 0, 0), [0.9, 0.9, 0.9]); craneCarrier(K.at(30, 0, 0), [0.95, 0.74, 0.08]); van(K.at(40, 0, 0));
	const g = K.merge();
	assert.ok(g.attributes.position.count > 2000 && finite(g), 'the trucks have their parts');
	assert.ok(mixerDrum([0.9, 0.9, 0.9]).attributes.position.count > 100);
	const up = craneUpper([0.95, 0.74, 0.08], 0.8, 22);
	assert.ok(up.head[1] > 10 && up.hook[1] < up.head[1] - 3, 'the boom up, the hook hanging from its head');
	assert.ok(towerJib(26).attributes.position.count > 200);
	const C = cloth();
	C.quad([0, 0, 0], [4, 0, 0], [4, 2, 0], [0, 2, 0], NET, 2, 1);
	assert.equal(C.geo().attributes.aCell.count, 6);
	const scene = new THREE.Scene(), crew = createCrew(scene, 8);
	crew.begin();
	for (const pose of ['walk', 'hammer', 'shovel', 'carry', 'talk']) crew.set(0, 0, 0, 0, pose, 1.3);
	crew.end();
	assert.equal(crew.count(), 5);
	const legs = scene.children.find((m) => m.isInstancedMesh && m.count === 10);
	assert.ok(legs, 'two legs each');
});

test('the landmarks: scorched and chipped but standing; in a cataclysm, down', () => {
	globalThis.localStorage = memory();
	let wild = false, now = 0;
	const stub = { chunk() {}, puff() {}, haze() {} };
	const ctx = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), debris: stub, sounds: { crumble() {}, collapse() {} }, marks: null, isPhone: false, store: { now: () => now }, ground: () => 0, landmarks: () => null, cataclysm: () => wild, shake() {} };
	const M = createMonuments(ctx);
	const L = { ...landmarkRects[2], i: 2, top: 40 };
	for (let i = 0; i < 200; i++) M.strike(L, { x: L.x, y: 5, z: L.z }, { x: 1, y: 0, z: 0 }, 260, 'blast');
	let s = M.state(L.x, L.z);
	assert.ok(s.hp >= 0.5 && !s.cut, `standing (hp ${s.hp})`);
	assert.ok(s.mk.length > 0 && s.mk.length <= 32, 'the scorch marks kept, a few dozen at most');
	wild = true;
	for (let i = 0; i < 60 && !M.state(L.x, L.z).cut; i++) M.strike(L, { x: L.x, y: 5, z: L.z }, { x: 1, y: 0, z: 0 }, 260, 'blast');
	s = M.state(L.x, L.z);
	assert.ok(s.cut > 0, 'brought down with the world ending');
	assert.equal(M.info().fallen, 1, 'its stubs and mound shown');
});
