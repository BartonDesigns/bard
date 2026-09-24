// The sea: rolling waves that come in toward the shore from every side, plus
// wind chop. Waves steepen and break white where the water shallows; colour
// comes from the real depth over sand and reef, so shallows go turquoise over
// lit sand with caustics and the deep goes navy. Sky and sun reflect.

import * as THREE from 'three';
import { radialGrid, HEIGHT_GLSL, NOISE_GLSL } from './terrain.js';

export function createOcean(island, shared) {
	const geo = radialGrid(255, 9000, 3.0);
	const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
		uHeight: { value: shared.heightTex }, uMasks: { value: shared.maskTex },
		uHalf: { value: island.half }, uCell: { value: island.cell }, uN: { value: island.N },
		uCenter: { value: new THREE.Vector2() },
		uWave: { value: 1 },
	}]);
	// shared, live objects (not copies)
	Object.assign(uniforms, {
		uTime: shared.uTime, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor,
		uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor, uAmbient: shared.uAmbient,
		uMid: shared.uMid, uHigh: shared.uHigh,
	});
	uniforms.uHeight.value = shared.heightTex;
	uniforms.uMasks.value = shared.maskTex;

	const WAVES = /* glsl */`
	uniform float uTime, uWave; uniform vec2 uCenter;
	// one Gerstner train: direction d, wavelength L, amplitude A, steepness Q
	void train(vec2 p, vec2 d, float L, float A, float Q, float speed, inout vec3 disp, inout vec3 dx, inout vec3 dz){
		float k = 6.28318 / L, c = sqrt(9.8 / k) * speed, f = k * (dot(d, p) - c * uTime);
		float s = sin(f), co = cos(f), wa = k * A;
		disp += vec3(Q * A * d.x * co, A * s, Q * A * d.y * co);
		dx += vec3(-Q * d.x * d.x * wa * s, d.x * wa * co, -Q * d.x * d.y * wa * s);
		dz += vec3(-Q * d.x * d.y * wa * s, d.y * wa * co, -Q * d.y * d.y * wa * s);
	}`;

	const mat = new THREE.ShaderMaterial({
		uniforms, fog: true,
		vertexShader: /* glsl */`
			${HEIGHT_GLSL}
			${WAVES}
			varying vec3 vW; varying vec3 vN; varying float vDepth; varying float vCrest; varying float vRoll;
			#include <fog_pars_vertex>
			void main(){
				vec2 p = position.xz + uCenter;
				float depth = max(0.0, -heightAt(p));
				float open = smoothstep(0.4, 7.0, depth);
				vec3 disp = vec3(0.0), dx = vec3(1.0, 0.0, 0.0), dz = vec3(0.0, 0.0, 1.0);
				// open-water swell from two directions; near the island it turns into
				// rollers that run in toward the beach (so no rings show offshore)
				float r = length(p) + 1e-3; vec2 inward = -p / r;
				float nearShore = 1.0 - smoothstep(4.0, 16.0, depth);
				float swellA = uWave * 0.42 * open;
				train(p, normalize(vec2(0.86, 0.51)), 22.0, swellA, 0.45, 1.0, disp, dx, dz);
				train(p, normalize(vec2(0.31, 0.95)), 14.0, swellA * 0.55, 0.5, 1.0, disp, dx, dz);
				float amp = uWave * mix(0.16, 0.5, open) * nearShore;
				train(p, inward, 16.0, amp, mix(1.1, 0.6, open), 1.0, disp, dx, dz);
				// wind chop
				train(p, normalize(vec2(0.82, 0.57)), 5.3, 0.1 * uWave, 0.5, 1.0, disp, dx, dz);
				train(p, normalize(vec2(-0.43, 0.9)), 3.1, 0.05 * uWave, 0.5, 1.0, disp, dx, dz);
				vec3 w = vec3(p.x, 0.0, p.y) + disp;
				vW = w; vDepth = depth; vCrest = disp.y / max(0.05, amp + swellA + 0.15);
				float k = 6.28318 / 16.0; vRoll = k * (dot(inward, p) - sqrt(9.8 / k) * uTime);
				vN = normalize(cross(dz, dx));
				vec4 mvPosition = viewMatrix * vec4(w, 1.0);
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: /* glsl */`
			uniform sampler2D uMasks; uniform float uHalf, uTime, uMid, uHigh;
			uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor, uAmbient;
			varying vec3 vW; varying vec3 vN; varying float vDepth; varying float vCrest; varying float vRoll;
			${NOISE_GLSL}
			#include <fog_pars_fragment>
			void main(){
				vec3 V = normalize(cameraPosition - vW);
				// ripples on top of the swell, fading with distance so the far sea stays calm
				float dist = length(cameraPosition - vW);
				float near = 1.0 - smoothstep(60.0, 900.0, dist);
				vec2 q = vW.xz * 0.35 + vec2(uTime * 0.21, -uTime * 0.13);
				float r0 = fbm3(q), rx = fbm3(q + vec2(0.07, 0.0)), rz = fbm3(q + vec2(0.0, 0.07));
				vec3 N = normalize(vN + vec3(r0 - rx, 0.0, r0 - rz) * 2.0 * near);
				float ndv = max(0.0, dot(N, V));
				float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
				// the bottom you see through the water: sand, reef, caustics
				vec2 muv = (vW.xz + uHalf) / (uHalf * 2.0);
				float reef = texture2D(uMasks, muv).b;
				vec3 sand = vec3(0.86, 0.80, 0.64);
				vec3 bottom = mix(sand, vec3(0.20, 0.24, 0.16), reef * 0.85);
				vec2 cq = vW.xz * 0.55;
				float c1 = 1.0 - abs(vn(cq + vec2(uTime * 0.35, uTime * 0.2)) * 2.0 - 1.0);
				float c2 = 1.0 - abs(vn(cq * 1.3 - vec2(uTime * 0.28, -uTime * 0.31)) * 2.0 - 1.0);
				float caust = pow(min(c1, c2), 6.0) * 2.4 * (1.0 - smoothstep(0.5, 9.0, vDepth));
				float sunUp = clamp(uSunDir.y * 3.0, 0.0, 1.0);
				bottom *= (0.55 + caust * sunUp) ;
				vec3 trans = exp(-vec3(0.34, 0.075, 0.052) * vDepth);
				vec3 deep = vec3(0.004, 0.055, 0.14);
				vec3 body = bottom * trans + deep * (1.0 - trans);
				vec3 light = uAmbient + uSunColor * max(0.0, uSunDir.y) * 0.9;
				body *= light;
				// reflection of the sky and the sun
				vec3 R = reflect(-V, N);
				vec3 sky = mix(uSkyHor, uSkyZen, pow(clamp(R.y, 0.0, 1.0), 0.35)) * 0.82;
				float spec = pow(max(dot(R, uSunDir), 0.0), 500.0) * 14.0 * (0.25 + 0.75 * near) + pow(max(dot(R, uSunDir), 0.0), 60.0) * 0.8;
				vec3 col = mix(body, sky, F * 0.7) + uSunColor * spec * (0.8 + uHigh * 0.6);
				// foam: breakers where it shallows, wash on the sand, caps on the crests
				float surf = smoothstep(0.25, 0.6, vDepth) * (1.0 - smoothstep(1.2, 2.2, vDepth));
				float roll = smoothstep(0.62, 0.97, sin(vRoll + 0.6));
				float lace = fbm3(vW.xz * 0.6 + vec2(uTime * 0.4, 0.0));
				float breaker = roll * surf * smoothstep(0.35, 0.65, lace + 0.15);
				float wash = (1.0 - smoothstep(0.04, 0.3, vDepth)) * smoothstep(0.4, 0.75, lace + 0.25 * sin(uTime * 1.3 + vW.x * 0.2));
				float cap = smoothstep(0.85, 1.1, vCrest) * smoothstep(0.55, 0.75, lace) * smoothstep(6.0, 20.0, vDepth) * near * 0.5;
				float foam = clamp(breaker + wash + cap * 0.7, 0.0, 1.0);
				col = mix(col, vec3(0.92, 0.95, 0.96) * (uAmbient * 0.8 + uSunColor * max(0.1, uSunDir.y)), foam);
				gl_FragColor = vec4(col, 1.0);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
				#include <fog_fragment>
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.name = 'ocean';
	mesh.renderOrder = 1;
	mesh.userData.update = (cam) => {
		const snap = 8;
		uniforms.uCenter.value.set(Math.round(cam.position.x / snap) * snap, Math.round(cam.position.z / snap) * snap);
	};
	mesh.userData.uniforms = uniforms;
	return mesh;
}

// CPU mirror of the swell height so swimmers and boats ride the same sea.
export function waveHeight(island, x, z, t, wave = 1) {
	const depth = Math.max(0, -island.heightAt(x, z));
	const open = Math.min(1, Math.max(0, (depth - 0.4) / 6.6));
	const r = Math.hypot(x, z) + 1e-3, ix = -x / r, iz = -z / r;
	const amp = wave * (0.18 + (0.62 - 0.18) * open);
	const k = 6.28318 / 16, c = Math.sqrt(9.8 / k);
	return amp * Math.sin(k * ((ix * x + iz * z) - c * t)) + 0.11 * wave * Math.sin(6.28318 / 5.3 * ((0.82 * x + 0.57 * z) - Math.sqrt(9.8 / (6.28318 / 5.3)) * t));
}
