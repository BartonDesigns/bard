// Gravitational lensing and Gargantua's ending, drawn over the finished frame. The frame is copied,
// then drawn again: round the rim of each black hole, above the horizon, the light is bent along its
// edge, what lies just beyond the rim drawn out and wrapped round it, with a thin bright photon ring
// on the edge itself; the hole's own sphere stays in the scene, so what stands in front of it still
// hides it. Then the grade: as Gargantua nears its end the colours invert, drain to grey and go to
// black, and after two seconds of black the world bursts back. Drawn only while either is up.
import * as THREE from 'three';

const MAX = 4;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = `uniform sampler2D uSrc; uniform vec4 uL[${MAX}]; uniform vec2 uK[${MAX}]; uniform int uN; uniform float uAspect; uniform float uT; uniform vec4 uGrade; varying vec2 vUv;
	void main(){
		vec2 asp = vec2(uAspect, 1.0), q = (vUv * 2.0 - 1.0) * asp, s = q;
		float ring = 0.0, hole = 0.0, px = 2.0 / 900.0;
		for (int i = 0; i < ${MAX}; i++) {
			if (i >= uN) break;
			// (x, y: its heart on screen, z: its radius there, w: how wide the bent band round it is;
			// uK.x: its strength 0..1, uK.y: where the horizon crosses it on screen)
			vec2 d = s - uL[i].xy;
			// (the hole itself, its halo and the flat of its disc, kept out of the grade)
			float rr = uL[i].z, e = length(vec2(d.x / (rr * 3.3), d.y / (rr * 0.4)));
			hole = max(hole, uK[i].x * smoothstep(uK[i].y - px, uK[i].y + px * 2.0, s.y) * max(1.0 - smoothstep(rr * 1.9, rr * 2.0, length(d)), 1.0 - smoothstep(0.9, 1.0, e)));
			float th = max(length(d), 1e-4), rs = uL[i].z, w = rs * uL[i].w, k = uK[i].x;
			// (only above the horizon: below it the hole is hidden, and so is its light)
			float sky = smoothstep(uK[i].y - px, uK[i].y + px * 2.0, s.y);
			// (in the band round the rim each pixel looks out to just past the rim: what lies beyond is
			// drawn out along the edge, easing back to the frame as it is at the band's outer edge)
			float x = clamp((th - rs) / w, 0.0, 1.0), f = x * x * (2.0 - x);
			float src = rs * 1.01 + (w - rs * 0.01) * f;
			float bent = th > rs && th < rs + w ? mix(th, src, k * sky) : th;
			s = uL[i].xy + d / th * bent;
			ring += k * sky * exp(-pow((th - rs * 1.012) / (rs * 0.012 + px), 2.0)) * (0.85 + 0.15 * sin(atan(d.y, d.x) * 5.0 + uT * 3.0));
		}
		vec2 uv = s / asp * 0.5 + 0.5;
		vec3 c = texture2D(uSrc, clamp(uv, 0.0, 1.0)).rgb + ring * vec3(1.0, 0.86, 0.66);
		// (the grade on all but the hole: x invert, y grey, z black, w the burst back to life)
		vec3 c0 = c;
		// (the inversion spreads out from the hole across the view, a hard-edged wave rather than a fade
		// through grey)
		vec2 from = uN > 0 ? uL[0].xy : vec2(0.0);
		float front = uGrade.x * (length(asp) * 2.2 + 0.2) - 0.1;
		c = mix(c, 1.0 - clamp(c, 0.0, 1.0), uGrade.x >= 1.0 ? 1.0 : 1.0 - smoothstep(front - 0.04, front + 0.04, length(q - from)));
		float g = dot(c, vec3(0.299, 0.587, 0.114));
		c = mix(c, vec3(g), uGrade.y);
		c *= 1.0 - uGrade.z;
		c = mix(vec3(g), c, 1.0 + 0.5 * uGrade.w) * (1.0 + 0.5 * uGrade.w) + uGrade.w * uGrade.w * vec3(1.0, 0.95, 0.85) * 0.7;
		c = mix(c, c0, hole);
		gl_FragColor = vec4(c, 1.0);
	}`;

export function createLens() {
	const L = [], K = [];
	for (let i = 0; i < MAX; i++) { L.push(new THREE.Vector4()); K.push(new THREE.Vector2()); }
	const mat = new THREE.ShaderMaterial({
		uniforms: { uSrc: { value: null }, uL: { value: L }, uK: { value: K }, uN: { value: 0 }, uAspect: { value: 1 }, uT: { value: 0 }, uGrade: { value: new THREE.Vector4() } },
		vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
	});
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false;
	const scene = new THREE.Scene(), cam = new THREE.Camera();
	scene.add(quad);
	let fb = null;
	const size = new THREE.Vector2(), v = new THREE.Vector3(), fwd = new THREE.Vector3();
	// lenses: [{ p, r (m), k (0..1), cut (the horizon's height, m) }] in the world, the frame bent
	// round those in front; grade: { inv, grey, black, burst } 0..1 (or null)
	function post(renderer, camera, lenses, t = 0, grade = null) {
		const graded = !!grade && grade.inv + grade.grey + grade.black + grade.burst > 0.002;
		if (!lenses.length && !graded) return false;
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
			const hx = v.x * camera.aspect, hy = v.y;
			v.set(l.p.x, l.cut ?? -1e9, l.p.z).project(camera);
			L[n].set(hx, hy, rs, 0.45);
			K[n].set(Math.min(1, l.k), Math.max(-10, v.y));
			n++;
		}
		if (!n && !graded) return false;
		if (graded) mat.uniforms.uGrade.value.set(grade.inv, grade.grey, grade.black, grade.burst); else mat.uniforms.uGrade.value.set(0, 0, 0, 0);
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
