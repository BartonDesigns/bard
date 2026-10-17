// What stands in the water, by its depth: the pier's posts, the boats' hulls, the rocks off the
// shore, the reef's coral and the bridge's piers drawn each frame from your own eye, depth only,
// into a small picture the sea (world/ocean.js) reads. The sea knows the ground under it (its
// colour and its shore are worked out from that), but not these: with their depth it sees how
// much water lies between its surface and a hull or a post, tints them through just that much
// (a post's foot a metre down, not the bed's ten), and rings each with a line of foam where it
// breaks the surface.
//
// The things are marked (mark) with a layer of their own, kept beside the one the view draws,
// so the pass draws only them, with one plain material, and nothing else changes. On the
// lighter tiers and on phones it is off, and the sea falls back to the ground's depth alone.

import * as THREE from 'three';
import { qualityNow } from './governor.js';

export const SEA_DEPTH_LAYER = 5;
const SCALE = { high: 0.5, medium: 0.5 }, MAX_W = 960;

export function createSeaDepth(renderer, { phone = false, safe = false } = {}) {
	const rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, stencilBuffer: false });
	rt.texture.generateMipmaps = false;
	rt.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
	rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter;
	rt.depthTexture.name = 'sea-depth';
	const cam = new THREE.PerspectiveCamera();
	// (both faces: a hull's halves are mirrored, so one side's faces turn inward)
	const draw = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
	// the sea's uniforms (live objects): the depth, the camera's near and far, the screen's size, and on
	const uniforms = { uSeaDepth: { value: null }, uSeaDepthNF: { value: new THREE.Vector2(0.25, 16000) }, uSeaDepthPx: { value: new THREE.Vector2(1, 1) }, uSeaDepthOn: { value: 0 } };
	const size = new THREE.Vector2(), clearC = new THREE.Color();
	function reset() {
		uniforms.uSeaDepthOn.value = 0; uniforms.uSeaDepth.value = null;
		if (rt.width !== 1 || rt.height !== 1) rt.setSize(1, 1);
	}

	// what the pass draws: obj and everything under it (or only the meshes keep(o) picks)
	function mark(obj, keep = null) {
		obj?.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && (!keep || keep(o))) o.layers.enable(SEA_DEPTH_LAYER); });
	}
	// each frame before the scene is drawn
	function render(scene, camera, under = 0) {
		const tier = qualityNow(), scale = phone || safe || !tier?.reflect ? 0 : SCALE[tier.name] || 0;
		uniforms.uSeaDepthOn.value = 0;
		if (!scale || under > 0.5 || !camera.isPerspectiveCamera) { reset(); return; }
		renderer.getDrawingBufferSize(size);
		const k = Math.min(scale, MAX_W / Math.max(1, size.x));
		const w = Math.max(16, Math.round(size.x * k)), h = Math.max(16, Math.round(size.y * k));
		if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
		camera.updateMatrixWorld();
		// (the view's own camera, by its place in the world: never a copy of what it carries)
		camera.matrixWorld.decompose(cam.position, cam.quaternion, cam.scale);
		cam.projectionMatrix.copy(camera.projectionMatrix);
		cam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
		cam.near = camera.near; cam.far = camera.far;
		cam.updateMatrixWorld();
		cam.layers.set(SEA_DEPTH_LAYER);
		uniforms.uSeaDepthNF.value.set(camera.near, camera.far);
		uniforms.uSeaDepthPx.value.copy(size);
		const was = renderer.getRenderTarget(), alpha = renderer.getClearAlpha(), over = scene.overrideMaterial;
		renderer.getClearColor(clearC);
		const autoS = renderer.shadowMap.autoUpdate, needS = renderer.shadowMap.needsUpdate;
		renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
		scene.overrideMaterial = draw;
		renderer.setRenderTarget(rt);
		try {
			renderer.clear(true, true, false);
			renderer.render(scene, cam);
			uniforms.uSeaDepth.value = rt.depthTexture;
			uniforms.uSeaDepthOn.value = 1;
		} finally {
			scene.overrideMaterial = over;
			renderer.setRenderTarget(was);
			renderer.setClearColor(clearC, alpha);
			renderer.shadowMap.autoUpdate = autoS; renderer.shadowMap.needsUpdate = needS;
		}
	}
	function dispose() { reset(); rt.dispose(); rt.depthTexture.dispose(); draw.dispose(); }
	return { uniforms, render, mark, reset, dispose, target: rt };
}

// (the GLSL the sea reads it with: how far behind the water's surface, along the look, the
// nearest marked thing lies at this pixel; a large number where there is none)
export const SEA_DEPTH_GLSL = /* glsl */`
uniform sampler2D uSeaDepth; uniform vec2 uSeaDepthNF, uSeaDepthPx; uniform float uSeaDepthOn;
float seaDepthBehind(vec3 w){
	vec2 screenUv = gl_FragCoord.xy / uSeaDepthPx;
	if (uSeaDepthOn < 0.5) return 1e4;
	float z = texture2D(uSeaDepth, screenUv).r;
	if (z >= 1.0) return 1e4;
	float n = uSeaDepthNF.x, f = uSeaDepthNF.y;
	float objZ = 2.0 * n * f / (f + n - (z * 2.0 - 1.0) * (f - n));
	vec3 vp = (viewMatrix * vec4(w, 1.0)).xyz;
	float waterZ = max(-vp.z, 1e-3);
	return (objZ - waterZ) * length(vp) / waterZ;
}`;
