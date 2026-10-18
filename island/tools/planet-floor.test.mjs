// The planet floor: the ground drawn (terrain.js's camera-centred grid, lifted on the graphics
// card) and the ground walked (island.heightAt) must be one surface. world/floorguard.js rebuilds
// the drawn surface on the CPU from the grid's own vertices; these tests hold it to radialGrid,
// to the height map, to the grid's moving centre, and check that the guard finds and repairs a
// grid left behind (the planet floor bug: docs/planet-floor-2026-10-15.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { radialGrid, TERRAIN_GRID, leanTerrainMaterial } from '../src/world/terrain.js';
import { gridAt, textureHeight, drawnTerrainHeight, floorVerdict, createFloorGuard } from '../src/world/floorguard.js';
import { generateIsland } from '../src/world/islandgen.js';
import { planetProfile } from '../src/planet/profile.js';

const G = TERRAIN_GRID;
const world = (type, seed, res = 384) => generateIsland({ seed, biome: type, resolution: res, profile: planetProfile(type, seed), land: null });
const src = (I) => ({ data: I.height, N: I.N, half: I.half, cell: I.cell, far: I.far });
const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const landPoints = (I, n, seed = 7) => {
	const r = rng(seed), out = [];
	for (let k = 0; out.length < n && k < n * 50; k++) {
		const x = (r() * 2 - 1) * (I.half - 40), z = (r() * 2 - 1) * (I.half - 40);
		if (I.heightAt(x, z) > 2) out.push([x, z]);
	}
	return out;
};

test('the grid the guard rebuilds is radialGrid, bounded and running on to the horizon', () => {
	for (const far of [false, true]) {
		const geo = far ? radialGrid(G.segments, G.radius, G.power, G.extra, G.far) : radialGrid(G.segments, G.radius, G.power);
		const p = geo.attributes.position.array, n = G.segments + (far ? 2 * G.extra : 0) + 1;
		for (const i of [0, 1, 5, Math.floor(n / 2), n - 6, n - 2, n - 1]) {
			assert.ok(Math.abs(p[i * 3] - gridAt(i, G, far)) < 1e-3, `x of vertex ${i} (far ${far})`);
			assert.ok(Math.abs(p[(i * n) * 3 + 2] - gridAt(i, G, far)) < 1e-3, `z of row ${i} (far ${far})`);
		}
	}
});

test('centred on the player, the drawn ground is the walked ground on every planet', () => {
	for (const [type, seed] of [['MAGMA', 4242], ['TERRAN', 77], ['ICE', 5255], ['MYSTICAL', 77], ['ARID', 4242]]) {
		const I = world(type, seed), S = src(I);
		let worst = 0;
		for (const [x, z] of landPoints(I, 150)) {
			// the grid's centre moves in 4 m steps: anywhere within half a step of the camera
			for (const [ox, oz] of [[0, 0], [1.9, -1.7], [-2, 2]]) {
				const cx = Math.round((x + ox) / G.snap) * G.snap, cz = Math.round((z + oz) / G.snap) * G.snap;
				worst = Math.max(worst, Math.abs(drawnTerrainHeight(S, cx, cz, x, z) - I.heightAt(x, z)));
			}
		}
		assert.ok(worst < 0.3, `${type}: drawn and walked ground differ by ${worst.toFixed(3)} m under the player`);
	}
});

test('the texture the shader reads is read as the walker reads the land', () => {
	const I = world('TERRAN', 77), S = src(I);
	for (const [x, z] of landPoints(I, 200, 3)) assert.ok(Math.abs(textureHeight(S, x, z) - I.heightAt(x, z)) < 1e-6);
	// clamped at the map's edge, as both clamp
	assert.ok(Math.abs(textureHeight(S, I.half + 500, 0) - I.heightAt(I.half + 500, 0)) < 1e-6);
});

test('a grid left behind misdraws the hills and leaves no ground at all past its rings', () => {
	const I = world('ICE', 5255, 512), S = src(I);
	// the centre stuck in one corner while the player walks across the land
	const c = [-I.half + 10, -I.half + 10];
	let worst = 0, voids = 0, n = 0;
	for (let z = -I.half + 20; z < I.half; z += 40) for (let x = -I.half + 20; x < I.half; x += 40) {
		const h = I.heightAt(x, z);
		if (h < 2) continue;
		n++;
		const d = drawnTerrainHeight(S, c[0], c[1], x, z);
		if (d == null) { voids++; continue; }
		worst = Math.max(worst, Math.abs(d - h));
	}
	assert.ok(voids > n * 0.03, `past 2.2 km from where it stopped there is no ground (${voids} of ${n} land points)`);
	assert.ok(worst > 4, `and nearer, the coarse rings misdraw the hills by metres (worst ${worst.toFixed(2)} m)`);
	assert.equal(drawnTerrainHeight(S, c[0], c[1], I.half - 50, I.half - 50), null);
	// on a bounded world nothing is drawn past the map's edge; on the Moon it runs on
	assert.equal(drawnTerrainHeight(S, I.half + 100, 0, I.half + 100, 0), null);
	const M = world('MOON', 1969), MS = src(M);
	for (const x of [M.half + 200, M.half + 3000, 9000]) {
		const d = drawnTerrainHeight(MS, x, 400, x, 400);
		assert.ok(d != null && Math.abs(d - M.heightAt(x, 400)) < 0.3, `the Moon at ${x} m: drawn ${d} walked ${M.heightAt(x, 400)}`);
	}
});

test('verdicts: built floors are skipped, a hidden or missing or misdrawn ground is a fault', () => {
	assert.equal(floorVerdict({ walk: 10, ground: 10, drawn: 10.2, visible: true }), 'ok');
	assert.equal(floorVerdict({ walk: 18, ground: 10, drawn: 10, visible: true }), 'skip');
	assert.equal(floorVerdict({ walk: 10, ground: 10, drawn: 10, visible: false }), 'hidden');
	assert.equal(floorVerdict({ walk: 10, ground: 10, drawn: null, visible: true }), 'void');
	assert.equal(floorVerdict({ walk: 150, ground: 150, drawn: -2, visible: true }), 'gap');
	assert.equal(floorVerdict({ walk: null, ground: 10, drawn: 10, visible: true }), 'skip');
});

// a world with just what the guard reads
function fakeWorld(I) {
	const center = { x: 0, y: 0 };
	const tex = { image: { data: I.height }, needsUpdate: false };
	const camera = { position: { x: 0, y: 0, z: 0 } };
	const P = { pos: { x: 0, y: 0, z: 0 }, flying: false, swimming: false, diving: false };
	const terrain = { visible: true, parent: {}, userData: { center, heightTex: () => tex, update: (cam) => { center.x = Math.round(cam.position.x / 4) * 4; center.y = Math.round(cam.position.z / 4) * 4; } } };
	const W = { island: I, terrain, player: { state: P, floorAt: (x, z) => I.heightAt(x, z) } };
	const stand = (x, z) => { const y = I.heightAt(x, z) + 1.68; P.pos.x = camera.position.x = x; P.pos.z = camera.position.z = z; P.pos.y = camera.position.y = y; };
	return { W, camera, stand, tex, terrain };
}

test('the guard re-centres a grid left behind and puts back a texture that lost its data', () => {
	const I = world('TERRAN', 77, 512), pts = landPoints(I, 400, 5);
	const F = fakeWorld(I), logs = [];
	const guard = createFloorGuard({ world: () => F.W, camera: F.camera, every: 0, log: (...a) => logs.push(a.join(' ')) });
	// land far from the stuck centre, where nothing (or the wrong ground) is drawn
	const sp = { x: -I.half + 10, z: -I.half + 10 };
	F.terrain.userData.center.x = sp.x; F.terrain.userData.center.y = sp.z;
	const far = pts.find(([x, z]) => { const d = drawnTerrainHeight(src(I), sp.x, sp.z, x, z); return d == null || Math.abs(d - I.heightAt(x, z)) > 6; });
	assert.ok(far, 'a point the stale grid misdraws');
	F.stand(far[0], far[1]);
	const r1 = guard.check(1, { open: true });
	assert.ok(['gap', 'void'].includes(r1.verdict), `found ${r1.verdict}`);
	assert.ok(logs.some((l) => /recentred/.test(l)));
	const r2 = guard.check(1, { open: true });
	assert.equal(r2.verdict, 'ok', 'the next look finds the ground back under the player');
	// the texture holding other numbers (a stale upload): put back and sent again
	F.tex.image.data = new Float32Array(I.height.length);
	const r3 = guard.check(1, { open: true });
	assert.equal(r3.verdict, 'gap');
	assert.equal(F.tex.image.data, I.height);
	assert.equal(F.tex.needsUpdate, true);
	assert.equal(guard.check(1, { open: true }).verdict, 'ok');
	// down in the caves (open false) and flying it keeps out of the way
	assert.equal(guard.check(1, { open: false }), null);
	F.W.player.state.flying = true;
	assert.equal(guard.check(1, { open: true }), null);
	F.W.player.state.flying = false;
	// a hidden ground with the surface open is shown again
	F.terrain.visible = false;
	assert.equal(guard.check(1, { open: true }).verdict, 'hidden');
	assert.equal(F.terrain.visible, true);
	assert.ok(guard.info().repairs >= 3);
});

test('a ground program that will not run is replaced by the lean ground, which lifts the grid the same way', async () => {
	const THREE = await import('three');
	const I = world('MAGMA', 4242, 256);
	// the lean material's shader edits must land on three's own chunks, bounded and far
	const u = (v) => ({ value: v });
	const uniforms = { uHeight: u(null), uHalf: u(I.half), uCell: u(I.cell), uN: u(I.N), uCenter: u(new THREE.Vector2()), uPlG: u(new THREE.Vector3()), uPlS: u(new THREE.Vector3()), uHoles: u([]) };
	for (const far of [false, true]) {
		const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader };
		leanTerrainMaterial(uniforms, far).onBeforeCompile(sh);
		// (LIFT_H is groundH unless the guard has lifted the grid on the CPU: terrain.js cpuLift)
		assert.match(sh.vertexShader, /vec3 transformed = vec3\(wxz\.x, LIFT_H\(wxz\), wxz\.y\)/);
		assert.match(sh.vertexShader, /#define LIFT_H\(w\) groundH\(w\)/);
		assert.match(sh.vertexShader, /vec3 objectNormal = normalize/);
		assert.doesNotMatch(sh.vertexShader, /#include <begin_vertex>|#include <beginnormal_vertex>/);
		assert.match(sh.fragmentShader, /uHoles\[i\]/);
		assert.equal(/farBlend/.test(sh.vertexShader), far);
		assert.ok(sh.uniforms.uHeight && sh.uniforms.uCenter);
	}
	// the guard swaps it in, once, when the full program's diagnostics say it will not run
	const F = fakeWorld(I), logs = [];
	const renderer = { properties: { get: () => ({ currentProgram: { diagnostics: { runnable: false } } }) } };
	let made = 0;
	F.terrain.material = { name: 'full' };
	F.terrain.userData.lean = () => { made++; return { name: 'lean' }; };
	const guard = createFloorGuard({ world: () => F.W, camera: F.camera, renderer, every: 0, log: (...a) => logs.push(a.join(' ')) });
	F.stand(I.spawn.x, I.spawn.z);
	guard.check(1, { open: true });
	guard.check(1, { open: true });
	assert.equal(F.terrain.material.name, 'lean');
	assert.equal(made, 1);
	assert.ok(logs.some((l) => /lean ground/.test(l)));
});
