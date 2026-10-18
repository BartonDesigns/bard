// Gravitational lensing: after the frame is drawn, the light round each black hole (Gargantua, an
// Event Horizon) is bent the way a mass bends it. The frame is copied, then drawn again through up
// to four lenses: each pixel near one looks out along the bent ray, so what stands behind the hole
// is pulled round its rim into a ring and its far side shows as a second, flipped image hugging the
// edge; inside the shadow nothing comes back. Only drawn while a lens is up.
import * as THREE from 'three';

const MAX = 4;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = `uniform sampler2D uSrc; uniform vec4 uL[${MAX}]; uniform vec2 uK[${MAX}]; uniform int uN; uniform float uAspect; uniform float uT; varying vec2 vUv;
	void main(){
		vec2 asp = vec2(uAspect, 1.0), q = (vUv * 2.0 - 1.0) * asp, s = q;
		float shadow = 1.0, ring = 0.0;
		for (int i = 0; i < ${MAX}; i++) {
			if (i >= uN) break;
			// (x, y: its heart on screen, z: its shadow's radius, w: how hard it bends; uK.x: its strength 0..1)
			vec2 d = s - uL[i].xy;
			float th = max(length(d), 1e-4), rs = uL[i].z, te = rs * uL[i].w, k = uK[i].x;
			// (the bent ray: a point lens, beta = theta - thetaE^2 / theta, eased out far away so the
			// edge of the screen stays put; past the heart it reads the far side, flipped)
			float fade = 1.0 - smoothstep(te * 2.5, te * 7.0, th);
			float beta = th - te * te / th * fade * k;
			s = uL[i].xy + d / th * beta;
			// (the shadow, its edge a pixel or two soft, and the thin bright ring of light that went
			// round the hole once just outside it)
			float px = 2.0 / 900.0;
			shadow *= mix(1.0, smoothstep(rs - px, rs + px, th), min(1.0, k * 3.0));
			ring += k * exp(-pow((th - rs * 1.035) / (rs * 0.022 + px), 2.0)) * (0.85 + 0.15 * sin(atan(d.y, d.x) * 5.0 + uT * 3.0));
		}
		vec2 uv = s / asp * 0.5 + 0.5;
		// (off the edge of the frame there is nothing to read: the nearest edge, sinking into the dark)
		vec2 o = max(abs(uv - 0.5) - 0.5, 0.0);
		vec3 c = texture2D(uSrc, clamp(uv, 0.0, 1.0)).rgb * (1.0 - 0.85 * smoothstep(0.0, 0.12, length(o)));
		c = c * shadow + ring * vec3(1.0, 0.86, 0.66) * (0.6 + 0.8 * dot(c, vec3(0.33)));
		gl_FragColor = vec4(c, 1.0);
	}`;

export function createLens() {
	const L = [], K = [];
	for (let i = 0; i < MAX; i++) { L.push(new THREE.Vector4()); K.push(new THREE.Vector2()); }
	const mat = new THREE.ShaderMaterial({
		uniforms: { uSrc: { value: null }, uL: { value: L }, uK: { value: K }, uN: { value: 0 }, uAspect: { value: 1 }, uT: { value: 0 } },
		vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
	});
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false;
	const scene = new THREE.Scene(), cam = new THREE.Camera();
	scene.add(quad);
	let fb = null;
	const size = new THREE.Vector2(), v = new THREE.Vector3(), fwd = new THREE.Vector3();
	// lenses: [{ p, r (m), k (0..1), bend }] in the world; the frame is bent through those in front
	function post(renderer, camera, lenses, t = 0) {
		if (!lenses.length) return false;
		const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov || 60) / 2);
		camera.getWorldDirection(fwd);
		let n = 0;
		for (const l of lenses) {
			if (n >= MAX || l.k <= 0.01) continue;
			v.set(l.p.x, l.p.y, l.p.z).sub(camera.position);
			const dist = v.length(), ahead = v.dot(fwd);
			if (ahead <= l.r * 0.2 || dist <= l.r * 1.02) continue;
			// (its shadow's size on screen from the angle it spans, in the same units as the height of the view)
			const rs = Math.tan(Math.asin(Math.min(0.999, l.r / dist))) / tanH;
			v.set(l.p.x, l.p.y, l.p.z).project(camera);
			if (Math.abs(v.x) > 1 + rs * 4 || Math.abs(v.y) > 1 + rs * 4) continue;
			L[n].set(v.x * camera.aspect, v.y, rs, l.bend || 1.5);
			K[n].set(Math.min(1, l.k), 0);
			n++;
		}
		if (!n) return false;
		renderer.getDrawingBufferSize(size);
		const w = size.x | 0, h = size.y | 0;
		if (!fb || fb.image.width !== w || fb.image.height !== h) {
			fb?.dispose();
			fb = new THREE.FramebufferTexture(w, h);
			fb.minFilter = fb.magFilter = THREE.LinearFilter;
			// (a canvas made without alpha has no alpha to copy: the copy must ask for none, or it fails
			// and the frame comes back black)
			if (renderer.getContextAttributes?.()?.alpha === false) { fb.format = THREE.RGBFormat; fb.internalFormat = 'RGB8'; }
		}
		const prevAuto = renderer.autoClear;
		renderer.copyFramebufferToTexture(fb);
		mat.uniforms.uSrc.value = fb; mat.uniforms.uN.value = n; mat.uniforms.uAspect.value = w / Math.max(1, h); mat.uniforms.uT.value = t;
		renderer.autoClear = false;
		renderer.render(scene, cam);
		renderer.autoClear = prevAuto;
		return true;
	}
	return {
		post,
		dispose() { fb?.dispose(); quad.geometry.dispose(); mat.dispose(); },
	};
}
