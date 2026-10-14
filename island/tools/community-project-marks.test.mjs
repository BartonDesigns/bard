import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { communityProjectAnchor, communityProjectSpot, createCommunityProjectMarks, COMMUNITY_PROJECT_FOOTPRINTS } from '../src/guide/community-project-marks.js';
import { toLL, setFrame, bayFrame } from '../src/earth/globeframe.js';

const project = (extra = {}) => ({ id: 'project:one', world: 'earth', kind: 'garden', stage: 'completed', siteId: 'park:one', shared: true, anchor: { x: 120, y: 2, z: 80, heading: 0 }, ...extra });
const world = (extra = {}) => ({ body: { key: 'earth' }, island: { heightAt: () => 2, hasOcean: true }, ...extra });
const fixture = (initial = [project()], W = world(), options = {}) => {
	let rows = initial, current = W; const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(); camera.position.set(120, 3.68, 80);
	const view = createCommunityProjectMarks({ scene, camera, world: () => current, projects: () => rows, ...options });
	return { scene, camera, view, setRows: value => { rows = value; }, setWorld: value => { current = value; }, tick: (n = 5) => { for (let i = 0; i < n; i++) view.update(.25); } };
};

test('all project kinds reserve a stable completed footprint at every stage', () => {
	for (const kind of Object.keys(COMMUNITY_PROJECT_FOOTPRINTS)) {
		const p = project({ kind }), first = communityProjectSpot(world(), p);
		assert.ok(first, kind); assert.equal(first.x, p.anchor.x); assert.equal(first.z, p.anchor.z);
		for (const stage of ['surveying', 'preparing', 'building', 'completed']) assert.deepEqual(communityProjectSpot(world(), { ...p, stage }), first);
	}
});

test('unknown coordinates and another body do not receive a default origin or meshes', () => {
	assert.equal(communityProjectSpot(world(), project({ anchor: {} })), null);
	assert.equal(communityProjectSpot(world(), project({ world: 'moon' })), null);
	assert.equal(communityProjectSpot(world(), project({ anchor: { x: NaN, y: 2, z: 80 } })), null);
	const f = fixture([project({ world: 'moon' }), project({ anchor: {} })]); f.tick(); assert.equal(f.view.info().visible, 0); f.view.dispose();
});

test('water, invalid ground, raised roofs, steep slopes and steps cannot accept a project', () => {
	const p = project();
	for (const island of [
		{ heightAt: () => NaN }, { heightAt: () => -.1, hasOcean: true },
		{ heightAt: () => 2, waterAt: () => 3 }, { heightAt: () => 2, inWater: () => true },
		{ heightAt: (x, z) => 2 + Math.sin(x * 3) },
		{ heightAt: (x, z) => 2 + (Math.floor(x) % 2 === 0 ? .7 : 0) },
	]) assert.equal(communityProjectSpot(world({ island }), p), null);
	assert.equal(communityProjectSpot(world({ player: { floorAt: () => 5 } }), p), null);
	assert.equal(communityProjectSpot(world({ player: { pushOut: v => { v.x += 1; } } }), p), null);
});

test('dry lunar valleys below sea level remain valid', () => {
	const p = project({ world: 'moon', anchor: { x: 120, y: -20, z: 80 } });
	const spot = communityProjectSpot(world({ body: { key: 'moon' }, island: { heightAt: () => -20, hasOcean: false } }), p);
	assert.ok(spot); assert.equal(spot.y, -20);
});

test('real and procedural houses, roads, trees and settlement reservations are respected', () => {
	const p = project();
	const fixtures = [
		{ village: { footprints: [{ x: 120, z: 80, w: 100, d: 100 }] } },
		{ real: { near: kind => kind === 'boxes' ? [{ x: 120, z: 80, w: 100, d: 100 }] : [] } },
		{ city: { nearList: () => [{ x: 120, z: 80, w: 100, d: 100 }] } },
		{ real: { near: kind => kind === 'roads' ? [{ pts: [[0, 80], [240, 80]], w: 100 }] : [] } },
		{ real: { landAt: () => ({ road: 1 }) } },
		{ vegetation: { obstacles: () => [{}] } },
		{ globe: { frame: { bay: true }, regional: { settlements: { blocked: () => true } } } },
		{ globe: { frame: { bay: true }, roads: { onRoad: () => true } } },
	];
	for (const fixture of fixtures) assert.equal(communityProjectSpot(world(fixture), p), null);
});

test('obstructions select a deterministic nearby footprint and retain the actual ground', () => {
	const p = project(); const W = world({ village: { footprints: [{ x: 120, z: 80, w: 3, d: 3 }] } });
	const a = communityProjectSpot(W, p), b = communityProjectSpot(W, p);
	assert.deepEqual(a, b); assert.ok(a); assert.ok(Math.hypot(a.x - 120, a.z - 80) > 3);
	assert.ok(Math.hypot(a.x - 120, a.z - 80) <= 19.001);
});

test('geographic anchors survive a floating Earth frame without a stale-coordinate clone', () => {
	bayFrame(); const a = toLL(120, 80), p = project({ anchor: { x: 120, y: 2, z: 80, ...a } });
	const W = world({ globe: { frame: { bay: true } } });
	const before = communityProjectAnchor(W, p); assert.ok(Math.abs(before.x - 120) < .00001);
	setFrame(a.lat, a.lon); W.globe.frame.bay = false;
	const after = communityProjectAnchor(W, p); assert.equal(after.x, -400000); assert.equal(after.z, 0);
	assert.equal(communityProjectAnchor(W, project()), null); bayFrame();
});

test('visible meshes actually change through lifecycle stages without local time completion', () => {
	const f = fixture([project({ stage: 'surveying' })]); f.tick();
	const counts = [];
	for (const stage of ['surveying', 'preparing', 'building', 'completed']) {
		f.setRows([project({ stage })]); f.tick();
		let instances = 0; f.scene.traverse(o => { if (o.isInstancedMesh) instances += o.count; }); counts.push(instances);
		assert.equal(f.view.info().projects[0].stage, stage);
	}
	assert.equal(new Set(counts).size, 4);
	f.setRows([project({ stage: 'building' })]); f.tick(400); assert.equal(f.view.info().projects[0].stage, 'building'); f.view.dispose();
});

test('cap, distance culling, detail LOD and body replacement bound work and resources', () => {
	const rows = Array.from({ length: 15 }, (_, i) => project({ id: `project:${i}`, anchor: { x: 120 + i * 11, y: 2, z: 80, heading: 0 } }));
	const f = fixture(rows); f.tick(); assert.equal(f.view.info().visible, 8);
	f.camera.position.set(1000, 3, 1000); f.tick(); assert.equal(f.view.info().visible, 0);
	f.camera.position.set(120, 3, 80); f.tick(); assert.equal(f.view.info().visible, 8);
	f.setWorld(world({ body: { key: 'moon' } })); f.tick(); assert.equal(f.view.info().visible, 0);
	f.view.dispose(); assert.equal(f.scene.children.length, 0);
});

test('late streamed obstruction hides an existing site instead of cutting through it', () => {
	let blocked = false; const W = world({ vegetation: { obstacles: () => blocked ? [{}] : [] } }); const f = fixture([project()], W);
	f.tick(); assert.equal(f.view.info().visible, 1); blocked = true; f.tick(24); assert.equal(f.view.info().visible, 0); f.view.dispose();
});

test('canonical places never move to a nearby free site after a new obstruction', () => {
	const W = world({ village: { footprints: [] } }); const p = project(); const f = fixture([p], W);
	f.tick(); assert.equal(f.view.info().visible, 1);
	W.village.footprints.push({ x: 120, z: 80, w: 2, d: 2 });
	assert.ok(communityProjectSpot(W, p), 'proposal search still finds nearby free ground');
	assert.equal(communityProjectSpot(W, p, { exact: p.anchor }), null, 'the existing canonical site is obstructed');
	f.tick(80); assert.equal(f.view.info().visible, 0); f.view.dispose();
});

test('resources are shared, reusable across reset, and disposed exactly once', () => {
	const f = fixture([project(), project({ id: 'project:two', anchor: { x: 140, y: 2, z: 80 } })]); f.tick();
	const geos = new Set(), mats = new Set(); f.scene.traverse(o => { if (o.geometry) geos.add(o.geometry); if (o.material) mats.add(o.material); });
	assert.ok(geos.size <= 5); assert.ok(mats.size <= 7);
	let geometryDisposals = 0, materialDisposals = 0;
	for (const g of geos) g.addEventListener('dispose', () => geometryDisposals++);
	for (const m of mats) m.addEventListener('dispose', () => materialDisposals++);
	f.view.reset(); assert.equal(geometryDisposals, 0); assert.equal(materialDisposals, 0); f.tick(); assert.equal(f.view.info().visible, 2);
	f.view.dispose(); f.view.dispose(); assert.equal(geometryDisposals, geos.size); assert.equal(materialDisposals, mats.size);
});

test('resonance reacts to real music, plays only on request, and releases every owned voice', () => {
	const plays = [], stops = [], host = { playLead: (...args) => plays.push(args), stopLead: id => stops.push(id) };
	const signal = { held: 0, mid: 0, high: 0, kick: 0 }; const f = fixture([project({ kind: 'resonance' })], world(), { host, signal: () => signal });
	f.tick(); assert.equal(plays.length, 0); assert.equal(f.view.nearest().id, 'project:one');
	const ring = []; f.scene.traverse(o => { if (o.geometry?.type === 'TorusGeometry') ring.push(o); });
	const before = ring[0].position.y; signal.held = 1; f.tick(16); assert.ok(ring[0].position.y > before); assert.equal(plays.length, 0);
	assert.equal(f.view.playNearest(undefined, 2).ok, true); assert.equal(plays.length, 1); assert.equal(f.view.playNearest().ok, false);
	f.camera.position.x += 15; assert.equal(f.view.playNearest().ok, false); f.view.dispose(); assert.equal(stops.length, 1);
});

test('uncompleted resonance, absent audio and a departed body cannot start sound', () => {
	const f = fixture([project({ kind: 'resonance', stage: 'building' })]); f.tick(); assert.equal(f.view.nearest(), null);
	f.setRows([project({ kind: 'resonance' })]); f.tick(); assert.equal(f.view.playNearest().ok, false);
	f.setWorld(world({ body: { key: 'moon' } })); assert.equal(f.view.nearest(), null); f.view.dispose();
});
