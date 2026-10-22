// Gravitational lensing and Gargantua's ending, drawn over the finished frame. The frame is copied,
// then drawn again: round each black hole, above the horizon, the light is bent in along its edge:
// what lies beyond the rim is drawn out and wrapped round it, the sky and its clouds stretched
// round the shadow, strongest at the rim and easing off with distance (after Interstellar); the
// hole's own sphere and face stay in the scene, so what stands in front of it still hides it. Then
// the grade: as Gargantua nears its end the colours invert (a wave out from the hole), drain to
// grey and go to black, and after two seconds of black the world bursts back. Drawn only while
// either is up.
import * as THREE from 'three';

const MAX = 4;
const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = `uniform sampler2D uSrc; uniform vec4 uL[${MAX}]; uniform vec2 uK[${MAX}]; uniform vec4 uE[${MAX}]; uniform int uN; uniform float uAspect; uniform float uT; uniform vec4 uGrade; varying vec2 vUv;
	void main(){
		vec2 asp = vec2(uAspect, 1.0), q = (vUv * 2.0 - 1.0) * asp, s = q;
		float hole = 0.0, px = 2.0 / 900.0;
		for (int i = 0; i < ${MAX}; i++) {
			if (i >= uN) break;
			// (x, y: its shadow's heart on screen, z: the shadow's half-width there, w: how far out the
			// bending reaches, in radii; uK.x: its strength 0..1, uK.y: where the horizon crosses it on
			// screen; uE.xy: the way out from the view's centre, along which a sphere seen off the axis
			// is drawn out on screen, by uE.z: squeezed back, its shadow is a circle again)
			vec2 d = s - uL[i].xy, ax = uE[i].xy, tg = vec2(-ax.y, ax.x);
			vec2 dc = vec2(dot(d, ax) / uE[i].z, dot(d, tg));
			float rs = uL[i].z, th = max(length(dc), 1e-4), k = uK[i].x;
			// (only above the horizon: below it the hole is hidden, and so is its light; the bend eases in
			// over the lowest bit of the shadow, so the sky is not smeared sideways along the horizon
			// and the shadow's edge goes cleanly down under it)
			float sky = smoothstep(uK[i].y - px, uK[i].y + min(0.08, uL[i].z * 0.12), s.y);
			// (the shadow itself, its ring and the flat of its disc are kept out of the grade, until
			// it has grown past the whole view, when all of it goes with the world)
			float e = length(vec2(d.x / (rs * 3.6), d.y / (rs * 0.32)));
			float keep = max(1.0 - smoothstep(rs * 1.35, rs * 1.5, th), 1.0 - smoothstep(0.85, 1.0, e)) * (1.0 - smoothstep(1.0, 2.0, rs));
			hole = max(hole, k * sky * keep);
			// (every pixel outside the rim looks in toward it: at the rim, to just past the edge; farther
			// out, less and less, so the sky is squeezed round the shadow and eases back to itself)
			float beyond = th - rs;
			if (beyond <= 0.0) continue;
			float pull = (beyond - rs * 0.012) * exp(-beyond / (rs * uL[i].w));
			float bent = th - max(0.0, pull) * k * sky;
			vec2 dn = dc / th * bent;
			s = uL[i].xy + ax * (dn.x * uE[i].z) + tg * dn.y;
		}
		vec2 uv = s / asp * 0.5 + 0.5;
		vec3 c = texture2D(uSrc, clamp(uv, 0.0, 1.0)).rgb;
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
	const L = [], K = [], E = [];
	for (let i = 0; i < MAX; i++) { L.push(new THREE.Vector4()); K.push(new THREE.Vector2()); E.push(new THREE.Vector4(1, 0, 1, 0)); }
	const mat = new THREE.ShaderMaterial({
		uniforms: { uSrc: { value: null }, uL: { value: L }, uK: { value: K }, uE: { value: E }, uN: { value: 0 }, uAspect: { value: 1 }, uT: { value: 0 }, uGrade: { value: new THREE.Vector4() } },
		vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
	});
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false;
	const scene = new THREE.Scene(), cam = new THREE.Camera();
	scene.add(quad);
	let fb = null;
	const size = new THREE.Vector2(), v = new THREE.Vector3(), fwd = new THREE.Vector3(), q = new THREE.Quaternion();
	// lenses: [{ p, r (m), k (0..1), cut (the horizon's height, m) }] in the world, the frame bent
	// round those in front; grade: { inv, grey, black, burst } 0..1 (or null)
	function post(renderer, camera, lenses, t = 0, grade = null) {
		const graded = !!grade && grade.inv + grade.grey + grade.black + grade.burst > 0.002;
		if (!lenses.length && !graded) return false;
		const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov || 60) / 2);
		camera.getWorldDirection(fwd);
		camera.getWorldQuaternion(q).invert();
		let n = 0;
		for (const l of lenses) {
			if (n >= MAX || l.k <= 0.01) continue;
			v.set(l.p.x, l.p.y, l.p.z).sub(camera.position);
			const dist = v.length(), ahead = v.dot(fwd);
			if (ahead <= l.r * 0.2 || dist <= l.r * 1.02) continue;
			// (its shadow on screen, in the units of the view's half height: a sphere off the view's
			// axis is not a circle there but an ellipse drawn out along the line from the centre of the
			// view, its own centre pushed out a little past where its heart lands; from the angle it
			// stands off the axis and the angle it spans: the view is a plane the cone of its edge is
			// cut by)
			v.applyQuaternion(q);
			const rho = Math.hypot(v.x, v.y), sinA = Math.min(0.999, l.r / dist), cosA = Math.sqrt(1 - sinA * sinA), sinT = rho / dist, cosT = ahead / dist;
			const A = Math.max(0.02, cosA * cosA - sinT * sinT), ux = rho > 1e-6 ? v.x / rho : 1, uy = rho > 1e-6 ? v.y / rho : 0;
			const c0 = sinT * cosT / A / tanH, a = sinA * cosA / A / tanH, b = sinA / Math.sqrt(A) / tanH;
			const hx = ux * c0, hy = uy * c0;
			if (Math.abs(hx) > camera.aspect + a * 4 || Math.abs(hy) > 1 + a * 4) continue;
			v.set(l.p.x, l.cut ?? -1e9, l.p.z).project(camera);
			L[n].set(hx, hy, b, 0.7);
			K[n].set(Math.min(1, l.k), Math.max(-10, v.y));
			E[n].set(ux, uy, a / b, 0);
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
