// The shader gate (world/shaderwarm.js gate): in the frame's own render of the scene a material
// with no shaders yet is drawn only while that frame's budget lasts (at least one a frame); the
// rest are left out of that frame, built in the background and drawn once built. Everything
// already built is always drawn, and renders of anything else are never held back.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShaderWarm } from '../src/world/shaderwarm.js';

// a stand-in renderer: render() draws each mesh of the scene through renderBufferDirect, a first
// draw builds the material's shaders (cost ms of the frame), compileAsync builds them off the frame
// (as in three, materials made alike share one program: only the first of a kind costs anything)
function fakeRenderer({ cost = 30 } = {}) {
	const props = new WeakMap(), drawn = [], programs = [];
	let clock = 0, target = null;
	const get = (m) => { let p = props.get(m); if (!p) props.set(m, (p = {})); return p; };
	const key = (m) => m.type + (m.map ? '+map' : '');
	const link = (m) => { const p = get(m); if (p.programs) return; let prog = programs.find((q) => q.cacheKey === key(m)); if (!prog) { prog = { cacheKey: key(m) }; programs.push(prog); clock += cost; } p.programs = new Map([[prog.cacheKey, prog]]); };
	const R = {
		properties: { get },
		info: { programs },
		getContext: () => ({ isContextLost: () => false }),
		getRenderTarget: () => target,
		setRenderTarget: (t) => { target = t; },
		render(scene, cam) {
			scene.traverseVisible((o) => { if (o.isMesh) R.renderBufferDirect(cam, scene, o.geometry, o.material, o, null); });
		},
		renderBufferDirect(cam, scene, g, m, o) {
			link(m);
			drawn.push(o.name);
		},
		compile(scene) { scene.traverse((o) => { if (o.isMesh) link(o.material); }); },
		compileAsync(scene, cam, target2) { R.compile(scene, cam, target2); return Promise.resolve(scene); },
		drawn, now: () => clock,
	};
	return R;
}
// (n meshes, each with a material of its own kind: a different picture set makes a different program)
const kinds = [THREE.MeshStandardMaterial, THREE.MeshBasicMaterial, THREE.MeshPhongMaterial, THREE.MeshLambertMaterial, THREE.MeshToonMaterial, THREE.MeshPhysicalMaterial, THREE.MeshNormalMaterial, THREE.MeshMatcapMaterial, THREE.MeshDepthMaterial, THREE.MeshDistanceMaterial];
function setup(n, opts) {
	const R = fakeRenderer(opts), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera();
	const meshes = Array.from({ length: n }, (_, i) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new kinds[i % kinds.length]()); if (i >= kinds.length) m.material.map = new THREE.Texture(); m.name = 'm' + i; scene.add(m); return m; });
	const warm = createShaderWarm(R, scene, cam);
	// (the gate times its draws with performance.now: the stand-in's clock instead)
	const real = performance.now.bind(performance);
	performance.now = () => R.now();
	warm.gate({ budget: 50 });
	return { R, scene, cam, warm, meshes, restore: () => { performance.now = real; } };
}
const settle = () => new Promise((ok) => setTimeout(ok, 5));

test('a frame builds only its budget of new shaders, the rest come in the next frames', async () => {
	const { R, scene, cam, warm, meshes, restore } = setup(10, { cost: 30 });
	try {
		R.drawn.length = 0; R.render(scene, cam);
		// 30 ms each, a 50 ms budget: two in (the second goes past it), the rest held
		assert.equal(R.drawn.length, 2);
		assert.ok(warm.info().gate.held > 0);
		let frames = 1;
		while (R.drawn.length < 10 && frames < 40) {
			warm.buildHeld();
			await settle();
			R.drawn.length = 0; R.render(scene, cam); frames++;
		}
		assert.equal(R.drawn.length, 10, 'everything drawn in the end');
		assert.ok(frames > 1 && frames < 40);
		// built: nothing held back again
		R.drawn.length = 0; R.render(scene, cam);
		assert.deepEqual(R.drawn, meshes.map((m) => m.name));
	} finally { restore(); }
});

test('at least one new material a frame, whatever it costs', async () => {
	const { R, scene, cam, restore } = setup(3, { cost: 500 });
	try {
		R.drawn.length = 0; R.render(scene, cam);
		assert.equal(R.drawn.length, 1);
	} finally { restore(); }
});

test('a material made like one already built is drawn at once, not held', async () => {
	const { R, scene, cam, warm, meshes, restore } = setup(1, { cost: 500 });
	try {
		R.drawn.length = 0; R.render(scene, cam);
		assert.equal(R.drawn.length, 1);
		// five clones of its material and five of a new kind, all in view the next frame
		const clones = [], others = [];
		for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), meshes[0].material.clone()); m.name = 'clone' + i; scene.add(m); clones.push(m); }
		for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); m.name = 'other' + i; scene.add(m); others.push(m); }
		R.drawn.length = 0; R.render(scene, cam);
		assert.deepEqual(R.drawn.filter((n) => n.startsWith('clone')).length, 5, 'the clones are all drawn');
		// (the first of the new kind built in the frame, then the other four are alike and drawn too)
		assert.equal(R.drawn.filter((n) => n.startsWith('other')).length, 5, 'one program built, five drawn');
		assert.equal(R.info.programs.length, 2);
		assert.equal(warm.info().gate.built, 2);
		assert.equal(warm.info().gate.alike, 9);
		assert.equal(warm.info().gate.alikeMissed, 0);
		// a new kind past the budget is held; built in the background, the kind's others pass as alike
		for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhongMaterial()); m.name = 'third' + i; scene.add(m); }
		for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial()); m.name = 'fourth' + i; scene.add(m); }
		R.drawn.length = 0; R.render(scene, cam);
		assert.equal(R.drawn.filter((n) => n.startsWith('third')).length, 5);
		assert.equal(R.drawn.filter((n) => n.startsWith('fourth')).length, 0, 'held: the frame\'s budget is spent');
		warm.buildHeld(); await settle();
		R.drawn.length = 0; R.render(scene, cam);
		assert.equal(R.drawn.filter((n) => n.startsWith('fourth')).length, 5);
		assert.equal(R.info.programs.length, 4);
	} finally { restore(); }
});

test('what would fill a good part of the view is never held back, however new', async () => {
	const { R, scene, cam, warm, restore } = setup(2, { cost: 500 });
	try {
		// (two new kinds in: the second is past the budget)
		R.drawn.length = 0; R.render(scene, cam);
		assert.equal(R.drawn.length, 1);
		// the ground under the camera (a big sphere, the camera inside it), the sky (never culled), a
		// lamp post 40 m off: all of new kinds, the frame spent on the first
		const ground = new THREE.Mesh(new THREE.SphereGeometry(500), new THREE.MeshToonMaterial()); ground.name = 'ground'; ground.geometry.computeBoundingSphere();
		const sky = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshNormalMaterial()); sky.name = 'sky'; sky.frustumCulled = false;
		const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 0.2), new THREE.MeshMatcapMaterial()); lamp.name = 'lamp'; lamp.position.set(0, 0, -40); lamp.geometry.computeBoundingSphere();
		// ferns all round you (instanced, never culled) are big; a kit of AC units 200 m off is not
		const ferns = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshDepthMaterial(), 20); ferns.name = 'ferns'; ferns.frustumCulled = false; ferns.count = 20;
		for (let i = 0; i < 20; i++) ferns.setMatrixAt(i, new THREE.Matrix4().setPosition(Math.cos(i) * 60, 0, Math.sin(i) * 60));
		const units = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshDistanceMaterial(), 20); units.name = 'units'; units.frustumCulled = false; units.count = 20;
		for (let i = 0; i < 20; i++) units.setMatrixAt(i, new THREE.Matrix4().setPosition(200 + i, 30, -200));
		scene.add(ground, sky, lamp, ferns, units); scene.updateMatrixWorld(true);
		R.drawn.length = 0; R.render(scene, cam);
		assert.ok(R.drawn.includes('ground') && R.drawn.includes('sky') && R.drawn.includes('ferns'), 'the big things are drawn: ' + R.drawn.join());
		assert.ok(!R.drawn.includes('lamp') && !R.drawn.includes('units'), 'the small things wait: ' + R.drawn.join());
		assert.ok(warm.info().gate.held > 0);
	} finally { restore(); }
});

test('other scenes and render targets are never held back', async () => {
	const { R, cam, restore } = setup(0, { cost: 30 });
	try {
		const other = new THREE.Scene();
		for (let i = 0; i < 6; i++) other.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()));
		R.drawn.length = 0; R.render(other, cam);
		assert.equal(R.drawn.length, 6);
	} finally { restore(); }
});

test('a render inside the frame\'s own (an environment map made on first use) is drawn whole', async () => {
	const { R, scene, cam, meshes, restore } = setup(4, { cost: 30 });
	try {
		const inner = new THREE.Scene();
		for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial()); m.name = 'pmrem' + i; inner.add(m); }
		meshes[0].onBeforeRender = () => {};
		const rbd = R.renderBufferDirect;
		let once = false;
		// (the first draw of the frame makes the map: a nested render of its own scene)
		R.renderBufferDirect = function (...a) { if (!once) { once = true; R.render(inner, cam); } return rbd.apply(this, a); };
		R.drawn.length = 0; R.render(scene, cam);
		assert.equal(R.drawn.filter((n) => n.startsWith('pmrem')).length, 5);
	} finally { restore(); }
});
