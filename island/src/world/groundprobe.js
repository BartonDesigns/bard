// A test probe for the ground as drawn: the scene is drawn once from straight above a point
// into a tiny target with a float depth buffer, and the depth under the centre is read back as
// a height. The ground's shape is made on the graphics card (terrain.js displaces its grid
// there), so only a draw tells where it really is. For the browser harnesses only
// (island/tools/planet-floor-browser.cjs): it stalls the graphics, so nothing calls it per frame.
//
// The floor guard's looks (world/floorguard.js) are asked for inside probeLater(): there, where
// the card can say (WebGL2: a pixel pack buffer and a fence), the depth is read back a frame or
// two after its draw and the look is a promise of the height. A plain read waits for the card
// to finish everything sent before it, the frame's whole city with it: on a phone that was most
// of the long tasks at the end of a walk. Asked for anywhere else (the harnesses), the height
// comes at once, as it always did.

import * as THREE from 'three';

const S = 8;
let later = false;
export function probeLater(fn) {
	const was = later;
	later = true;
	try { return fn(); } finally { later = was; }
}
// (the height under the centre of a read, or null where nothing was drawn)
function heightOf(px, top, near, far) {
	const c = (S / 2 * S + S / 2) * 4, d = px[c];
	if (!(d < 0.999999)) return null;   // nothing drawn under the point
	return top - (near + d * (far - near));
}

// a light that counts as the one given does in three's tally (its kind, its shadow, a spot's
// pattern, the layers it is seen on) and gives none
function darkAs(c) {
	const L = new c.constructor();
	L.intensity = 0;
	L.castShadow = c.castShadow;
	L.layers.mask = c.layers.mask;
	if (c.isSpotLight) L.map = c.map;
	return L;
}

export function createGroundProbe(renderer) {
	let rt = null, copy = null, quad = null, cam = null, buf = null;
	function setup() {
		const depth = new THREE.DepthTexture(S, S);
		depth.type = THREE.FloatType;
		rt = new THREE.WebGLRenderTarget(S, S, { depthTexture: depth, depthBuffer: true });
		copy = new THREE.WebGLRenderTarget(S, S, { type: THREE.FloatType, depthBuffer: false });
		const mat = new THREE.ShaderMaterial({
			uniforms: { tDepth: { value: depth } },
			vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
			fragmentShader: 'uniform sampler2D tDepth; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tDepth, vUv).x, 0.0, 0.0, 1.0); }',
			depthTest: false, depthWrite: false,
		});
		quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
		quad.frustumCulled = false;
		cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
		buf = new Float32Array(S * S * 4);
	}
	// the height of the first surface drawn under (x, z), looking down from top over span
	// metres; keep: a test for which of the scene's top-level children take part (all if none)
	function probe(scene, x, z, { top = 6000, span = 12000, radius = 0.5, keep = null } = {}) {
		if (!rt) setup();
		cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
		cam.near = 0.05; cam.far = span;
		cam.position.set(x, top, z);
		cam.up.set(0, 0, -1);
		cam.lookAt(x, top - 10, z);
		cam.updateProjectionMatrix(); cam.updateMatrixWorld();
		const hidden = [], async = later && typeof renderer.readRenderTargetPixelsAsync === 'function' && typeof renderer.getContext?.()?.fenceSync === 'function';
		let read = null;
		// (the lights stay, and those of the groups set aside are stood in for by dark ones of the
		// same kind: the ground's materials are then drawn with the lights they always are, and
		// three finds the programs it has, not links new ones mid-frame, as world/lightpad.js keeps
		// its count)
		const stand = [];
		if (keep) for (const o of scene.children) {
			if (!o.visible || o.isLight || keep(o)) continue;
			o.traverseVisible((c) => { if (c.isLight) stand.push(darkAs(c)); });
			o.visible = false; hidden.push(o);
		}
		for (const L of stand) scene.add(L);
		// (and a shadow redraw the governor has asked for, every few frames, is left for the frame
		// it was asked for: drawn here it would be spent with the casters set aside)
		const was = { target: renderer.getRenderTarget(), auto: renderer.shadowMap.autoUpdate, now: renderer.shadowMap.needsUpdate, clear: renderer.autoClear, bg: scene.background };
		renderer.shadowMap.autoUpdate = false;
		renderer.shadowMap.needsUpdate = false;
		renderer.autoClear = true;
		scene.background = null;
		try {
			renderer.setRenderTarget(rt);
			renderer.clear(true, true, true);
			renderer.render(scene, cam);
			renderer.setRenderTarget(copy);
			renderer.render(quad, cam);
			// (a read of its own for each look later: one may still be on its way when the next is drawn)
			if (async) { const px = new Float32Array(S * S * 4), near = cam.near, far = cam.far; read = renderer.readRenderTargetPixelsAsync(copy, 0, 0, S, S, px).then(() => heightOf(px, top, near, far)); }
			else renderer.readRenderTargetPixels(copy, 0, 0, S, S, buf);
		} finally {
			for (const o of hidden) o.visible = true;
			for (const L of stand) { scene.remove(L); L.dispose?.(); }
			renderer.setRenderTarget(was.target);
			renderer.shadowMap.autoUpdate = was.auto;
			renderer.shadowMap.needsUpdate = was.now;
			renderer.autoClear = was.clear;
			scene.background = was.bg;
		}
		return read || heightOf(buf, top, cam.near, cam.far);
	}
	function dispose() { rt?.dispose(); copy?.dispose(); quad?.geometry.dispose(); quad?.material.dispose(); rt = null; }
	return { probe, dispose };
}
