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
function fakeRenderer({ cost = 30 } = {}) {
	const drawn = [];
	let clock = 0, target = null;
	// (a properties set like three's: one per graphics context, a new one after a loss)
	const fresh = () => { const props = new WeakMap(); return { get: (m) => { let p = props.get(m); if (!p) props.set(m, (p = {})); return p; } }; };
	const get = (m) => R.properties.get(m);
	const R = {
		properties: fresh(),
		getContext: () => ({ isContextLost: () => false }),
		getRenderTarget: () => target,
		setRenderTarget: (t) => { target = t; },
		render(scene, cam) {
			scene.traverseVisible((o) => { if (o.isMesh) R.renderBufferDirect(cam, scene, o.geometry, o.material, o, null); });
		},
		renderBufferDirect(cam, scene, g, m, o) {
			const p = get(m);
			if (!p.programs) { p.programs = new Map([['k', {}]]); clock += cost; }
			drawn.push(o.name);
		},
		compile(scene) { scene.traverse((o) => { if (o.isMesh) get(o.material).programs ||= new Map([['k', {}]]); }); },
		compileAsync(scene, cam, target2) { R.compile(scene, cam, target2); return Promise.resolve(scene); },
		// a graphics loss and restore: three makes a new properties set, so no material has its shaders
		reinit() { R.properties = fresh(); },
		drawn, now: () => clock,
	};
	return R;
}
function setup(n, opts) {
	const R = fakeRenderer(opts), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera();
	const meshes = Array.from({ length: n }, (_, i) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()); m.name = 'm' + i; scene.add(m); return m; });
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


test('after the graphics come back from a loss, everything is built again a few a frame and drawn', async () => {
	const { R, scene, cam, warm, meshes, restore } = setup(12, { cost: 30 });
	try {
		for (let f = 0; f < 40 && R.drawn.length < 12; f++) { warm.buildHeld(); await settle(); R.drawn.length = 0; R.render(scene, cam); }
		assert.equal(R.drawn.length, 12, 'all drawn before the loss');
		// the loss: three's new properties set says no material has its shaders (the old set, kept,
		// would say they all still had them, and the first frame back would build every one at once)
		R.reinit();
		R.drawn.length = 0; R.render(scene, cam);
		assert.ok(R.drawn.length >= 1 && R.drawn.length < 12, 'the first frame back builds its budget, not every shader at once: ' + R.drawn.length);
		assert.ok(warm.info().gate.held > 0, 'the rest held for the background');
		let frames = 1;
		while (R.drawn.length < 12 && frames < 40) { warm.buildHeld(); await settle(); R.drawn.length = 0; R.render(scene, cam); frames++; }
		assert.equal(R.drawn.length, 12, 'everything drawn again');
		assert.ok(frames > 1 && frames < 40, 'over a few frames: ' + frames);
		// and once built nothing is held back again (a stale set would never see the new shaders)
		R.drawn.length = 0; R.render(scene, cam);
		assert.deepEqual(R.drawn, meshes.map((m) => m.name));
		assert.equal(warm.info().gate.held, 0);
	} finally { restore(); }
});
