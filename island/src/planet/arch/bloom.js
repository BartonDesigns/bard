// The settlements' glow: after the frame is drawn, its brightest light (the window grids, the
// light strips, the tower feet in the mist, beacons, chandeliers) taken at a quarter size,
// blurred twice and added back over it, so lit things light the air round them. Drawn the way
// world/sunrays.js draws its burst (the frame copied, small targets, one quad); only while a
// settlement's dusk or night is on, or you are in its rooms. Off on phones unless asked for.

import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export function createBloom(renderer, { isPhone = false } = {}) {
	const U = { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2() }, uK: { value: 1 }, uThr: { value: 0.6 } };
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
	quad.frustumCulled = false;
	const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	scene.add(quad);
	const mat = (f, o = {}) => new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: f, depthTest: false, depthWrite: false, toneMapped: false, ...o });
	// the bright pass: what stands over the threshold, coloured light weighted up (a lit pane, not a pale wall)
	const bright = mat(/* glsl */`
		uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThr; varying vec2 vUv;
		vec3 tap(vec2 o){
			vec3 c = texture2D(uSrc, vUv + o * uTexel).rgb;
			// (by brightness, not by the strongest channel: a magenta sky is bright red but not light)
			float l = dot(c, vec3(0.3, 0.55, 0.15));
			return c * smoothstep(uThr, uThr + 0.3, l);
		}
		void main(){ gl_FragColor = vec4((tap(vec2(-1.5, -1.5)) + tap(vec2(1.5, -1.5)) + tap(vec2(-1.5, 1.5)) + tap(vec2(1.5, 1.5))) * 0.25, 1.0); }`);
	const blur = mat(/* glsl */`
		uniform sampler2D uSrc; uniform vec2 uTexel, uDir; varying vec2 vUv;
		void main(){
			vec2 d = uDir * uTexel;
			vec3 c = texture2D(uSrc, vUv).rgb * 0.227;
			c += (texture2D(uSrc, vUv + d * 1.38).rgb + texture2D(uSrc, vUv - d * 1.38).rgb) * 0.316;
			c += (texture2D(uSrc, vUv + d * 3.23).rgb + texture2D(uSrc, vUv - d * 3.23).rgb) * 0.07;
			gl_FragColor = vec4(c, 1.0);
		}`);
	const comp = mat(/* glsl */`
		uniform sampler2D uSrc; uniform float uK; varying vec2 vUv;
		void main(){ vec3 c = texture2D(uSrc, vUv).rgb * uK; gl_FragColor = vec4(c, 1.0); }`, { transparent: true, blending: THREE.AdditiveBlending });
	// (compiled now, not on the first frame it is wanted)
	for (const m of [bright, blur, comp]) { quad.material = m; try { renderer.compile(scene, cam); } catch { /* compiled when first drawn */ } }
	let fb = null, rtA = null, rtB = null;
	const size = new THREE.Vector2();
	function targets() {
		renderer.getDrawingBufferSize(size);
		const w = size.x | 0, h = size.y | 0;
		if (fb && fb.image.width === w && fb.image.height === h) return;
		fb?.dispose(); rtA?.dispose(); rtB?.dispose();
		fb = new THREE.FramebufferTexture(w, h);
		fb.minFilter = fb.magFilter = THREE.LinearFilter;
		const q = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
		rtA = new THREE.WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), q);
		rtB = new THREE.WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), q);
	}
	const S = { on: !isPhone, k: 0 };
	const pass = (m, src, dst) => { quad.material = m; U.uSrc.value = src; renderer.setRenderTarget(dst); renderer.render(scene, cam); };
	// k: how strongly (0 skips it)
	function post(k) {
		S.k = k;
		if (!S.on || k < 0.02) return;
		targets();
		const prev = renderer.getRenderTarget(), auto = renderer.autoClear;
		renderer.copyFramebufferToTexture(fb);
		renderer.autoClear = false;
		U.uTexel.value.set(1 / fb.image.width, 1 / fb.image.height);
		pass(bright, fb, rtA);
		U.uTexel.value.set(1 / rtA.width, 1 / rtA.height);
		for (const s of [1, 2.6]) {
			U.uDir.value.set(s, 0); pass(blur, rtA.texture, rtB);
			U.uDir.value.set(0, s); pass(blur, rtB.texture, rtA);
		}
		U.uK.value = k * 0.9;
		pass(comp, rtA.texture, prev);
		renderer.autoClear = auto;
	}
	// Crysis.archGlow(): on / off / a threshold
	function control(v) {
		if (v === 'on' || v === true) S.on = true;
		else if (v === 'off' || v === false) S.on = false;
		else if (typeof v === 'number') U.uThr.value = v;
		return { on: S.on, k: +S.k.toFixed(2), threshold: U.uThr.value };
	}
	function dispose() { fb?.dispose(); rtA?.dispose(); rtB?.dispose(); quad.geometry.dispose(); bright.dispose(); blur.dispose(); comp.dispose(); }
	return { post, control, dispose };
}
