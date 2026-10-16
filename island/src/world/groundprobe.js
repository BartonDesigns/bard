// A test probe for the ground as drawn: the scene is drawn once from straight above a point
// into a tiny target with a float depth buffer, and the depth under the centre is read back as
// a height. The ground's shape is made on the graphics card (terrain.js displaces its grid
// there), so only a draw tells where it really is. For the browser harnesses only
// (island/tools/planet-floor-browser.cjs): it stalls the graphics, so nothing calls it per frame.

import * as THREE from 'three';

const S = 8;

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
		const hidden = [];
		if (keep) for (const o of scene.children) if (o.visible && !keep(o)) { o.visible = false; hidden.push(o); }
		const was = { target: renderer.getRenderTarget(), auto: renderer.shadowMap.autoUpdate, clear: renderer.autoClear, bg: scene.background, fog: scene.fog };
		renderer.shadowMap.autoUpdate = false;
		renderer.autoClear = true;
		scene.background = null;
		try {
			renderer.setRenderTarget(rt);
			renderer.clear(true, true, true);
			renderer.render(scene, cam);
			renderer.setRenderTarget(copy);
			renderer.render(quad, cam);
			renderer.readRenderTargetPixels(copy, 0, 0, S, S, buf);
		} finally {
			for (const o of hidden) o.visible = true;
			renderer.setRenderTarget(was.target);
			renderer.shadowMap.autoUpdate = was.auto;
			renderer.autoClear = was.clear;
			scene.background = was.bg;
		}
		const c = (S / 2 * S + S / 2) * 4, d = buf[c];
		if (!(d < 0.999999)) return null;   // nothing drawn under the point
		return top - (cam.near + d * (cam.far - cam.near));
	}
	function dispose() { rt?.dispose(); copy?.dispose(); quad?.geometry.dispose(); quad?.material.dispose(); rt = null; }
	return { probe, dispose };
}
