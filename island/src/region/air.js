// What hangs in the air of a place, round you: snow crystals drifting down and blowing in the
// north, dust and its bright motes in the dry lands, the mist low among the rainforest trees
// in the morning, pollen and seeds on a summer meadow, fireflies over the paddies and the
// savanna on warm nights. One field of points wrapped round the camera on the GPU (no
// per-frame work but a few uniforms). The fog takes the place's haze: a warm dust in the
// desert, a damp grey-green in the forest, a blue clarity up high.

import * as THREE from 'three';

const VS = /* glsl */`
	attribute vec4 aSeed; uniform vec3 uCam; uniform float uTime, uBox, uKind, uSize, uK; uniform vec2 uWind;
	varying float vA; varying float vGlow;
	void main() {
		vec3 p = aSeed.xyz * uBox;
		// how each kind moves: snow falls and drifts, dust and pollen wander, mist hangs, fireflies hover
		float fall = uKind < 0.5 ? 1.1 : uKind < 1.5 ? 0.05 : uKind < 2.5 ? 0.0 : uKind < 3.5 ? 0.15 : -0.05;
		vec3 off = vec3(uWind.x * uTime * (uKind < 2.5 ? 1.6 : 0.4), -fall * uTime, uWind.y * uTime * (uKind < 2.5 ? 1.6 : 0.4));
		off += vec3(sin(uTime * 0.7 + aSeed.w * 40.0), sin(uTime * 0.5 + aSeed.w * 23.0) * 0.5, cos(uTime * 0.6 + aSeed.w * 31.0)) * (uKind > 3.5 ? 1.5 : 0.6);
		vec3 q = mod(p + off - uCam + uBox * 0.5, uBox) - uBox * 0.5;
		// mist and fireflies keep low, near the ground (the box is squashed down)
		if (uKind > 1.5 && uKind < 2.5) q.y = q.y * 0.12 - 1.0;
		if (uKind > 3.5) q.y = q.y * 0.15 - 0.5;
		vec4 mv = modelViewMatrix * vec4(uCam + q, 1.0);
		gl_Position = projectionMatrix * mv;
		float d = length(q);
		gl_PointSize = uSize * (uKind > 1.5 && uKind < 2.5 ? 70.0 : 1.0) / max(0.5, -mv.z) * (0.6 + aSeed.w * 0.8);
		vA = uK * smoothstep(uBox * 0.5, uBox * 0.25, d) * smoothstep(0.3, 2.0, d);
		vGlow = uKind > 3.5 ? smoothstep(0.6, 1.0, sin(uTime * 2.0 + aSeed.w * 60.0)) : 0.0;
		if (uKind > 3.5) vA *= vGlow;
	}`;
const FS = /* glsl */`
	uniform vec3 uCol; uniform float uKind; varying float vA; varying float vGlow;
	void main() {
		vec2 d = gl_PointCoord - 0.5; float r = length(d);
		float a = (uKind > 1.5 && uKind < 2.5 ? smoothstep(0.5, 0.0, r) * 0.12 : smoothstep(0.5, 0.15, r)) * vA;
		if (a < 0.01) discard;
		gl_FragColor = vec4(uCol * (1.0 + vGlow * 2.0), a);
	}`;

const KIND = { snow: 0, dust: 1, mist: 2, pollen: 3, fireflies: 4 };

export function createAir(scene, { isPhone = false }) {
	const N = isPhone ? 700 : 1600, seeds = new Float32Array(N * 4);
	for (let i = 0; i < N * 4; i++) seeds[i] = Math.random();
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
	g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
	g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
	const U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBox: { value: 60 }, uKind: { value: 0 }, uSize: { value: 30 }, uK: { value: 0 }, uWind: { value: new THREE.Vector2(0.5, 0.2) }, uCol: { value: new THREE.Color(1, 1, 1) } };
	const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false });
	const pts = new THREE.Points(g, mat);
	pts.frustumCulled = false; pts.name = 'regional air';
	scene.add(pts);
	const haze = new THREE.Color();
	let k = 0;

	// what the air holds here and now
	function kindNow(kit, C, wx, night) {
		const a = kit?.air?.kind;
		if (!a) return null;
		if (a === 'snow') return (C?.snow || 0) > 0.3 || (wx?.rain || 0) > 0.2 ? 'snow' : null;
		if (a === 'mist') return night > 0.6 && C?.season !== 'dry' ? 'fireflies' : 'mist';
		if (a === 'dust') return 'dust';
		if (a === 'pollen' || ((a === 'haze' || a === 'clear') && (C?.season === 'summer' || C?.season === 'spring'))) return night > 0.6 && (C?.now || 0) > 16 ? 'fireflies' : 'pollen';
		return null;
	}
	function update(dt, cam, { kit = null, climate = null, wx = null, night = 0, on = true, fog = null, wind = null } = {}) {
		const kind = on ? kindNow(kit, climate, wx, night) : null;
		k += ((kind ? 1 : 0) - k) * Math.min(1, dt * 0.5);
		pts.visible = k > 0.01;
		U.uTime.value += dt;
		if (kind) {
			U.uKind.value = KIND[kind];
			U.uBox.value = kind === 'mist' ? 120 : kind === 'fireflies' ? 70 : 55;
			U.uSize.value = kind === 'snow' ? 26 : kind === 'dust' ? 9 : kind === 'pollen' ? 8 : kind === 'fireflies' ? 16 : 30;
			U.uCol.value.set(kind === 'snow' ? '#f4f8ff' : kind === 'dust' ? '#e8d0a0' : kind === 'mist' ? '#dfe6e0' : kind === 'fireflies' ? '#c8ff6a' : '#fff6d8');
			U.uK.value = k * (kind === 'snow' ? 0.9 : kind === 'dust' ? 0.5 : kind === 'mist' ? 0.7 : kind === 'fireflies' ? 1 : 0.4) * (kind === 'mist' ? 1 - night * 0.6 : 1);
		}
		if (wind) U.uWind.value.set(wind.x, wind.y);
		U.uCam.value.copy(cam.position);
		// the place's haze on the fog
		if (on && fog && kit?.air) {
			haze.set(kit.air.haze || '#c8d0d8').multiplyScalar(1 - night * 0.85);
			fog.color.lerp(haze, 0.22 * (1 - night * 0.5));
			if (fog.density > 0) fog.density *= 1 + ((kit.air.k ?? 1) - 1) * 0.8;
		}
	}
	function dispose() { scene.remove(pts); g.dispose(); mat.dispose(); }
	return { update, dispose };
}
