// The rain on the glass when you drive in it. From the driver's seat the windshield is the
// nearest thing there is: drops land on it, sit and swell, run down and are gone; the glass
// mists; at speed the drops smear up and back and the runnels race (Josh's photo through the
// windshield on a rainy freeway at dawn: the tree line and the tail lights blurred behind a
// wet sheet of glass). One quad over the whole view, drawn last, only while you sit in a car
// in the rain; its fragment is a few hashes a pixel (two sizes of drop, one of them in each
// cell of its grid, each on its own clock), nothing read back from the scene. The drops take
// the haze's colour, which is what the sky and the far road are through them.

import * as THREE from 'three';

const VS = /* glsl */`
	varying vec2 vUv;
	void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.5, 1.0); }`;
const FS = /* glsl */`
	uniform float uRain, uTime, uSpeed, uAspect, uDim; uniform vec3 uTint;
	varying vec2 vUv;
	float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	// one grid of drops, cells s across (screen heights), seeded; each cell's drop is born at its
	// own moment of every life seconds, sits, runs down and goes. Returns the drop's cover (x),
	// its bright side (y), its runnel (z)
	vec3 drops(vec2 p, float s, float seed, float life){
		vec2 c = floor(p / s), f = p / s - c;
		float h0 = h21(c + seed), h1 = h21(c + seed + 7.3), h2 = h21(c + seed + 3.1), h3 = h21(c + seed + 11.7);
		// as many drops as it rains; the rest of the cells stay dry
		if (h3 > uRain * 0.28 + 0.02) return vec3(0.0);
		float t = fract(uTime / life + h2);
		float born = smoothstep(0.0, 0.1, t), gone = 1.0 - smoothstep(0.8, 1.0, t);
		// (it sits most of its life, then the big ones run: down the glass; at speed, up and back)
		float run = smoothstep(0.5, 1.0, t) * (0.3 + 0.7 * h1);
		float r = 0.05 + 0.11 * h1 * h1;
		vec2 o = vec2(0.25 + 0.5 * h0, 0.78 - 0.55 * run * (1.0 - uSpeed * 0.6) - uSpeed * 0.4);
		vec2 q = f - o;
		// the drop: round sitting, drawn out long when it runs or when the car is moving
		q.y /= 1.0 + run * 0.9 + uSpeed * 1.8;
		q.x *= 1.0 + run * 0.3;
		float d = length(q);
		float body = (1.0 - smoothstep(r * 0.8, r, d)) * born * gone;
		// its rim (the glass bends the light at the edge) and a bright side
		float rim = smoothstep(r * 0.45, r * 0.8, d) * body;
		float bright = (1.0 - smoothstep(0.0, r * 0.55, length(q - vec2(-0.3, 0.35) * r))) * body;
		// its runnel: a thin wet line it has left above it as it ran
		float trail = (1.0 - smoothstep(0.0, r * 0.3, abs(f.x - o.x))) * step(o.y, f.y) * (1.0 - smoothstep(o.y, o.y + 0.45 + 0.3 * run, f.y)) * run * born * gone * (1.0 - smoothstep(0.0, 0.2, uSpeed));
		return vec3(body + rim * 1.5, bright, trail);
	}
	void main(){
		vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y);
		vec3 a = drops(p, 1.0 / 11.0, 0.0, 11.0) + drops(p + vec2(0.37, 0.11), 1.0 / 23.0, 5.0, 6.5) * vec3(0.6, 0.6, 0.4);
		// at speed the rain streaks up the glass in fast fine lines
		float col = floor(p.x * 150.0 + 0.5), hc = h21(vec2(col, 2.0));
		float sy = fract(p.y * 0.6 - uTime * (2.0 + 2.0 * hc) + hc * 7.0);
		float streak = (1.0 - smoothstep(0.0, 0.45, abs(fract(p.x * 150.0 + 0.5) - 0.5) * 2.0)) * smoothstep(0.0, 0.25, sy) * (1.0 - smoothstep(0.25, 0.6, sy)) * step(0.55, h21(vec2(col, 9.0))) * uSpeed * uRain;
		// a mist on the glass, thinner where the wipers would pass, faint at the top
		float mist = (0.03 + 0.03 * h21(floor(p * 40.0))) * uRain * (0.6 + 0.4 * smoothstep(0.75, 1.0, vUv.y));
		float cover = clamp(a.x * 0.17 + a.y * 0.35 + a.z * 0.22 + streak * 0.3 + mist, 0.0, 0.6);
		// (the glass is the upper part of the view from the seat: the dash is under it)
		cover *= smoothstep(0.3, 0.46, vUv.y);
		// (the body of a drop mostly lets the view through, its rim a shade darker, its bright side the sky)
		vec3 c = uTint * (0.7 + 0.6 * a.y / max(a.x * 0.17 + a.y * 0.35, 1e-3) * 0.35 * step(0.01, a.x));
		c *= 1.0 - 0.35 * smoothstep(1.0, 1.8, a.x);
		gl_FragColor = vec4(c, cover * uDim);
		#include <colorspace_fragment>
	}`;

export function createWindshield(scene, shared) {
	const U = { uRain: { value: 0 }, uTime: shared.uTime, uSpeed: { value: 0 }, uAspect: { value: 16 / 9 }, uDim: { value: 0 }, uTint: { value: new THREE.Color(0.5, 0.53, 0.57) } };
	const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthTest: false, depthWrite: false });
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	quad.frustumCulled = false; quad.renderOrder = 1001; quad.visible = false; quad.name = 'windshield';
	scene.add(quad);
	const last = new THREE.Vector3(); let placed = false, speed = 0;
	// seated: in the driver's seat of a car; rain: the rain where you are; fog: the haze's
	// colour (what the sky and the road are through the glass), as the fog has it
	function update(dt, cam, { seated = false, rain = 0, fog = null } = {}) {
		if (placed) { const v = cam.position.distanceTo(last) / Math.max(dt, 1e-3); speed += (Math.min(1, v / 25) - speed) * Math.min(1, dt * 3); }
		last.copy(cam.position); placed = true;
		const want = seated ? Math.min(1, rain * 1.4) : 0;
		U.uDim.value += (want - U.uDim.value) * Math.min(1, dt * (seated ? 0.8 : 3));
		U.uRain.value = Math.min(1, rain * 1.2);
		U.uSpeed.value = seated ? speed : 0;
		if (fog) U.uTint.value.copy(fog);
		quad.visible = U.uDim.value > 0.01;
	}
	quad.onBeforeRender = (r) => { const s = r.getSize(new THREE.Vector2()); U.uAspect.value = s.x / Math.max(1, s.y); };
	function dispose() { scene.remove(quad); quad.geometry.dispose(); mat.dispose(); }
	return { update, dispose, quad, uniforms: U };
}
