// The sea's mirror: the land, its trees, the village and its boats, the far islands, the city
// and the bridge drawn once more each frame, upside down through the sea's surface, into a
// small picture the sea (world/ocean.js) reads where it reflects. Only those are drawn into it
// (the sky, the clouds and the sun the sea works out for itself, and grass, people, spray and
// the like would cost more than they show at the size they lie in the water); what is not drawn
// is left clear, and there the sea keeps its own sky. The water's ripples bend the picture, and
// it fades in by the sea's own Fresnel, so a calm look straight down shows the bed, a low look
// across a flat sea the hills standing in it.
//
// Off on the lighter tiers and on phones (a second draw of the land), under the water, and while
// its shaders are still being made: the picture is drawn without the screen's tone curve, so
// every material it shows needs a second program, and those are compiled ahead, in the
// background where the browser allows it, before the first frame that uses them.

import * as THREE from 'three';
import { qualityNow } from './governor.js';
import { createShaderWarm } from './shaderwarm.js';

// the picture's size, as a share of the screen's each way, by tier (none on the lighter ones)
const SCALE = { high: 0.5, medium: 0.35 }, MAX_W = 960;
// the sea's mean level, and how far under it the mirror cuts (so the shore's own edge is kept)
const LEVEL = 0, CLIP_BIAS = 0.003;

export function createSeaMirror(renderer, { phone = false, safe = false } = {}) {
	const half = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
	const rt = new THREE.WebGLRenderTarget(1, 1, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false });
	rt.texture.generateMipmaps = false;
	rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter;
	rt.texture.name = 'sea-mirror';
	const cam = new THREE.PerspectiveCamera();
	cam.matrixAutoUpdate = true;
	// the sea's uniforms (live objects, shared with world/ocean.js)
	const uniforms = { uRefl: { value: null }, uReflM: { value: new THREE.Matrix4() }, uReflOn: { value: 0 } };

	const normal = new THREE.Vector3(0, 1, 0), mirrorAt = new THREE.Vector3(0, LEVEL, 0);
	const camAt = new THREE.Vector3(), view = new THREE.Vector3(), target = new THREE.Vector3(), look = new THREE.Vector3();
	const rot = new THREE.Matrix4(), plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
	const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
	const size = new THREE.Vector2(), clearC = new THREE.Color();
	const shown = [], saved = [];
	let warm = null, warmScene = null, warmFor = null;
	function reset() {
		warm?.reset(); warm = warmScene = warmFor = null;
		uniforms.uReflOn.value = 0; uniforms.uRefl.value = null;
		// Disabling a pass must release its attachments, not just stop its draw.
		if (rt.width !== 1 || rt.height !== 1) rt.setSize(1, 1);
	}

	// the mirror camera for this view; false when there is nothing to mirror (below the sea)
	function aim(camera) {
		camAt.setFromMatrixPosition(camera.matrixWorld);
		view.subVectors(mirrorAt.set(camAt.x, LEVEL, camAt.z), camAt);
		if (view.dot(normal) > -0.05) return false;
		view.reflect(normal).negate().add(mirrorAt);
		rot.extractRotation(camera.matrixWorld);
		look.set(0, 0, -1).applyMatrix4(rot).add(camAt);
		target.subVectors(mirrorAt, look).reflect(normal).negate().add(mirrorAt);
		cam.position.copy(view);
		cam.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
		cam.lookAt(target);
		cam.near = camera.near; cam.far = camera.far;
		cam.updateMatrixWorld();
		cam.projectionMatrix.copy(camera.projectionMatrix);
		// what the sea samples: a point on it, through the mirror camera, to the picture
		uniforms.uReflM.value.multiplyMatrices(bias, cam.projectionMatrix).multiply(cam.matrixWorldInverse);
		// the near plane laid along the water (an oblique frustum), so nothing under it is drawn
		plane.setFromNormalAndCoplanarPoint(normal, mirrorAt).applyMatrix4(cam.matrixWorldInverse);
		clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
		const P = cam.projectionMatrix.elements;
		q.set((Math.sign(clip.x) + P[8]) / P[0], (Math.sign(clip.y) + P[9]) / P[5], -1, (1 + P[10]) / P[14]);
		clip.multiplyScalar(2 / clip.dot(q));
		P[2] = clip.x; P[6] = clip.y; P[10] = clip.z + 1 - CLIP_BIAS; P[14] = clip.w;
		cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
		return true;
	}
	// show only what the mirror draws (and the lights), noting what to put back
	function hideRest(scene, list) {
		shown.length = 0; saved.length = 0;
		for (const o of list) if (o) shown.push(o);
		for (const o of scene.children) {
			saved.push(o.visible);
			if (o.visible && !o.isLight && !shown.includes(o) && (o.isMesh || o.isPoints || o.isLine || o.isSprite || o.children.length)) o.visible = false;
		}
	}
	function restore(scene) {
		for (let i = 0; i < scene.children.length && i < saved.length; i++) scene.children[i].visible = saved[i];
	}
	// the renderer's own settings, kept and put back round the mirror's draw
	function drawInto(fn) {
		const was = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
		renderer.getClearColor(clearC);
		const autoS = renderer.shadowMap.autoUpdate, needS = renderer.shadowMap.needsUpdate;
		renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
		renderer.setRenderTarget(rt);
		renderer.setClearColor(0x000000, 0);
		try { fn(); } finally {
			renderer.setRenderTarget(was);
			renderer.setClearColor(clearC, alpha);
			renderer.shadowMap.autoUpdate = autoS; renderer.shadowMap.needsUpdate = needS;
		}
	}

	// Each frame before the scene is drawn: list is what the water reflects (scene children);
	// under: 1 when you are under the water.
	function render(scene, camera, list, under = 0) {
		const tier = qualityNow(), scale = phone || safe || !tier?.reflect ? 0 : SCALE[tier.name] || 0;
		uniforms.uReflOn.value = 0;
		if (!scale || under > 0.5) { reset(); return; }
		camera.updateMatrixWorld();
		if (!aim(camera)) { reset(); return; }
		renderer.getDrawingBufferSize(size);
		// (on a dense screen the picture still stays near a thousand pixels across: the ripples
		// blur it, and the land is drawn again for every one of them)
		const k = Math.min(scale, MAX_W / Math.max(1, size.x));
		const w = Math.max(16, Math.round(size.x * k)), h = Math.max(16, Math.round(size.y * k));
		if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
		hideRest(scene, list);
		try {
			// Three.compile traverses even invisible objects. Compiling the whole
			// scene here duplicated underground/interior/people shaders in one burst.
			// Warm only the mirror's visible frustum, two materials at a time, including
			// newly streamed content. Keep the procedural sky until it is ready.
			if (!warm || warmScene !== scene || warmFor !== list[0]) {
				warm?.reset(); warm = createShaderWarm(renderer, scene, cam);
				warmScene = scene; warmFor = list[0];
			}
			let ready = false;
			drawInto(() => { ready = warm.prepare({ n: 2 }); });
			if (!ready) return;
			drawInto(() => { renderer.clear(); renderer.render(scene, cam); });
			uniforms.uRefl.value = rt.texture;
			uniforms.uReflOn.value = 1;
		} finally { restore(scene); }
	}
	function dispose() { reset(); rt.dispose(); }
	return { uniforms, render, reset, dispose, target: rt, camera: cam };
}
