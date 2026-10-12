// The settlement's small lights: the streaks its lights lay on the water (a strip on the
// surface turned toward you, rippling: a reflection's look without a reflection's cost), and
// points of light on the ground: glowing flowers on the green slopes near the houses, and the
// lamps of hamlets on the slopes over the mist. Both additive, both brighter as night comes.

import * as THREE from 'three';

const STREAK_V = /* glsl */`
attribute vec4 aP;
attribute vec4 aC;
uniform float uFar;
varying vec2 vUv;
varying vec3 vC;
void main(){
	vec2 to = cameraPosition.xz - aP.xz;
	float d = length(to);
	vec2 dir = to / max(d, 0.001), ac = vec2(-dir.y, dir.x);
	float len = min(aC.w, d * 0.92);
	vec3 p = aP.xyz + vec3(dir.x, 0.0, dir.y) * position.y * len + vec3(ac.x, 0.0, ac.y) * position.x * aP.w * (1.0 + position.y * 2.0);
	vUv = position.xy; vC = aC.rgb * (1.0 - smoothstep(uFar * 0.6, uFar, d)) * step(aP.y, cameraPosition.y);
	gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const STREAK_F = /* glsl */`
uniform float uK, uTime;
varying vec2 vUv;
varying vec3 vC;
void main(){
	float a = (1.0 - smoothstep(0.0, 1.0, vUv.y)) * (1.0 - smoothstep(0.15, 0.5, abs(vUv.x)));
	a *= 0.45 + 0.55 * smoothstep(-0.2, 0.9, sin(vUv.y * 140.0 - uTime * 1.7 + sin(vUv.x * 9.0 + uTime) * 1.5));
	gl_FragColor = vec4(vC * a * uK, 1.0);
}`;

const DOT_V = /* glsl */`
attribute vec3 color;
attribute float aS;
uniform float uScale;
varying vec3 vC;
varying float vA;
void main(){
	vec4 mv = modelViewMatrix * vec4(position, 1.0);
	float px = aS * uScale / max(1.0, -mv.z);
	gl_PointSize = max(1.5, px);
	vA = min(1.0, px / 1.5) * (1.0 - smoothstep(220.0, 340.0, -mv.z * (aS > 0.4 ? 0.25 : 1.0)));
	vC = color;
	gl_Position = projectionMatrix * mv;
}`;
const DOT_F = /* glsl */`
uniform float uK;
varying vec3 vC;
varying float vA;
void main(){
	float d = length(gl_PointCoord - 0.5) * 2.0;
	if (d > 1.0) discard;
	gl_FragColor = vec4(vC * (1.0 - d * d) * vA * uK, 1.0);
}`;

export function createGlow(scene, shared, { streaks = [], dots = [], renderer = null } = {}) {
	const group = new THREE.Group();
	group.name = 'arch:glow';
	const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
	const sU = { uK: { value: 1 }, uTime: shared.uTime, uFar: { value: 1800 } }, dU = { uK: { value: 1 }, uScale: { value: 600 } };
	const mats = [];
	if (streaks.length) {
		const g = new THREE.InstancedBufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
		g.setIndex([0, 1, 2, 0, 2, 3]);
		g.setAttribute('aP', new THREE.InstancedBufferAttribute(new Float32Array(streaks.flatMap((q) => [q.x, q.y, q.z, q.w])), 4));
		g.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(streaks.flatMap((q) => [...q.c, q.len])), 4));
		g.instanceCount = streaks.length;
		const m = new THREE.ShaderMaterial({ uniforms: sU, vertexShader: STREAK_V, fragmentShader: STREAK_F, ...add, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
		const mesh = new THREE.Mesh(g, m);
		mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'arch:streaks';
		group.add(mesh); mats.push(m);
	}
	if (dots.length) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(dots.flatMap((q) => [q.x, q.y, q.z]), 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(dots.flatMap((q) => q.c), 3));
		g.setAttribute('aS', new THREE.Float32BufferAttribute(dots.map((q) => q.s), 1));
		g.computeBoundingSphere();
		const m = new THREE.ShaderMaterial({ uniforms: dU, vertexShader: DOT_V, fragmentShader: DOT_F, ...add });
		const pts = new THREE.Points(g, m);
		pts.renderOrder = 3; pts.name = 'arch:dots';
		group.add(pts); mats.push(m);
	}
	scene.add(group);
	const sz = new THREE.Vector2();
	return {
		group,
		update(night) {
			sU.uK.value = 0.12 + night * 1.1;
			dU.uK.value = 0.35 + night * 1.6;
			if (renderer) { renderer.getDrawingBufferSize(sz); dU.uScale.value = sz.y * 0.9; }
		},
		dispose() { group.traverse((o) => o.geometry?.dispose()); for (const m of mats) m.dispose(); scene.remove(group); },
	};
}
