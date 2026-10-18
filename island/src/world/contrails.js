// Airliners crossing the sky far above, each drawing its contrails: two thin white lines that
// form a little behind the engines, run together, spread, drift off with the wind up there and
// break up into wisps. How long they hang depends on the air: in dry air they melt within a
// few hundred metres of the plane, on a day with cirrus about they last minutes and fan out
// into bands across the sky. They pass behind the cumulus (the sky's own cloud field decides
// what hides them), glow pink at sunset, and after dark the plane is a blinking light.
//
// The planes fly 8.5-11 km up on long straight tracks past wherever you are. Everything is
// drawn shrunk toward the camera (by SHRINK), which keeps it inside the far plane and looks
// exactly the same from the eye; it is lit and hazed for its true distance.
//
// One mesh for all of it: per slot, two engine trails of SEG segments and the plane's own
// quad, all moved on the GPU from the slot's track (uA/uB/uC); the CPU only starts and ends
// flights.

import * as THREE from 'three';
import { NOISE_GLSL } from './terrain.js';
import { CLOUD_GLSL } from './sky.js';

const SLOTS = 3, SEG = 72, SHRINK = 0.25;
const SPAN = 30000;                      // how far a track runs either side of you (m)

export function createContrails(scene, shared, sky, { isPhone = false } = {}) {
	const slots = isPhone ? 2 : SLOTS;
	// per vertex: slot, engine (-1/+1; 0 = the plane itself), t along the trail (0 at the plane), side
	const A = [], I = [];
	for (let s = 0; s < slots; s++) {
		for (const eng of [-1, 1]) {
			const b = A.length / 4;
			for (let k = 0; k <= SEG; k++) for (const side of [-1, 1]) A.push(s, eng, k / SEG, side);
			for (let k = 0; k < SEG; k++) { const a = b + k * 2; I.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
		}
		const b = A.length / 4;
		for (const [t, side] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) A.push(s, 0, t, side);
		I.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('aV', new THREE.Float32BufferAttribute(A, 4));
	// (position is only there for three's bookkeeping: the shader places every vertex)
	geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(A.length / 4 * 3), 3));
	geo.setIndex(I);

	// uA: start x, z, altitude, start time; uB: heading x, z, speed, on (0-1); uC: trail life (s), seed, -, -
	const uA = Array.from({ length: SLOTS }, () => new THREE.Vector4());
	const uB = Array.from({ length: SLOTS }, () => new THREE.Vector4(1, 0, 240, 0));
	const uC = Array.from({ length: SLOTS }, () => new THREE.Vector4(60, 0, 0, 0));
	const U = sky.uniforms;
	const uniforms = {
		uA: { value: uA }, uB: { value: uB }, uC: { value: uC },
		uClock: { value: 0 }, uTime: shared.uTime, uWindDir: shared.uWindDir, uUpWind: { value: 12 },
		uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyHor: shared.uSkyHor,
		uNight: U.uNight, uCloud: U.uCloud, uCloudOff: U.uCloudOff, uShowers: U.uShowers,
		uFogC: { value: new THREE.Color() }, uFogD: { value: 0.00026 },
	};
	const mat = new THREE.ShaderMaterial({
		uniforms, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
		vertexShader: /* glsl */`
			#define SLOTS ${SLOTS}
			attribute vec4 aV;
			uniform vec4 uA[SLOTS], uB[SLOTS], uC[SLOTS];
			uniform float uClock, uUpWind; uniform vec2 uWindDir;
			varying vec3 vRel; varying vec2 vQ; varying float vAge, vA, vPlane, vSeed;
			${NOISE_GLSL}
			void main(){
				int s = int(aV.x + 0.5);
				vec4 A = uA[s], B = uB[s], C = uC[s];
				// (a slot with no flight on is folded away off screen)
				if (B.w <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); vA = 0.0; return; }
				vec3 dir = normalize(vec3(B.x, 0.0, B.y));
				float flown = uClock - A.w;
				vec3 P = vec3(A.x, A.z, A.y) + dir * B.z * flown;
				vec3 c; vec3 along = dir; float w; float a = B.w;
				vSeed = C.y; vPlane = 0.0;
				if (aV.y == 0.0) {
					// the plane: a short streak along its heading
					c = P; w = 22.0; vAge = 0.0; vPlane = 1.0;
					c += dir * aV.z * 30.0;
				} else {
					// how old the trail is here (finer near the plane, where it forms), never older than the flight
					float age = min(C.x * pow(aV.z, 1.6), flown);
					vAge = age;
					c = P - dir * B.z * age;
					// the engine pair, side by side, closing into one band
					vec3 perp = vec3(-dir.z, 0.0, dir.x);
					c += perp * aV.y * 13.0 * (1.0 - smoothstep(8.0, 45.0, age));
					// the wind up there carries it off, it sinks a little, and it wanders as it breaks up
					c.xz += uWindDir * uUpWind * age;
					c.y -= age * 0.35;
					float wob = (vn(vec2(age * 0.018 + C.y * 7.1, aV.y)) - 0.5) * age * 1.6;
					c += perp * wob;
					c.y += (vn(vec2(age * 0.022 - C.y * 3.3, 4.0)) - 0.5) * age * 0.6;
					w = 3.0 + age * 0.9 + age * age * 0.004;
					// (forms some way behind the engines; fades as it ages out)
					a *= smoothstep(0.35, 2.4, age) * (1.0 - smoothstep(C.x * 0.45, C.x, age));
				}
				// faced toward the eye, across its own line; never thinner than about a pixel
				// (a sliver breaks into dashes), the extra width paid for in strength
				vec3 rel = c - cameraPosition;
				float wMin = length(rel) * 0.0011;
				a *= sqrt(w / max(w, wMin));
				w = max(w, wMin);
				vA = a;
				vec3 side = normalize(cross(along, normalize(rel)));
				rel += side * aV.w * w;
				vRel = rel;
				vQ = vec2(aV.z, aV.w);
				gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + rel * ${SHRINK}, 1.0);
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uSunDir, uSunColor, uSkyHor, uFogC; uniform float uNight, uCloud, uTime, uFogD, uClock;
			varying vec3 vRel; varying vec2 vQ; varying float vAge, vA, vPlane, vSeed;
			${NOISE_GLSL}
			${CLOUD_GLSL}
			void main(){
				float a = vA;
				if (a < 0.003) discard;
				vec3 d = normalize(vRel);
				// behind the cumulus
				float base, sh;
				a *= 1.0 - cumulus(d, uCloud, uTime, base, sh) * 0.97;
				float dist = length(vRel);
				// thin air aloft: much less haze than the same distance along the ground
				float haze = 1.0 - exp(-pow(uFogD * dist * 0.22, 2.0));
				float day = 1.0 - uNight;
				vec3 col;
				if (vPlane > 0.5) {
					// the plane: a dark speck by day that catches the sun now and then; at night its lights
					float glint = pow(max(0.0, sin(uClock * 0.7 + vSeed * 20.0)), 30.0) * 0.8 * day;
					float strobe = step(0.92, fract(uClock * 0.8 + vSeed)) + 0.6 * step(0.5, fract(uClock * 0.55 + vSeed * 3.0)) * step(fract(uClock * 0.55 + vSeed * 3.0), 0.56);
					float r = length(vec2(vQ.x * 0.5, vQ.y));
					col = mix(vec3(0.32, 0.34, 0.38) * (0.4 + uSunColor * 0.5), vec3(1.0, 0.97, 0.9), glint);
					a *= day * (0.75 + glint) * (1.0 - smoothstep(0.5, 1.0, r));
					// at night only the strobes, as points
					float lights = uNight * strobe * (1.0 - smoothstep(0.0, 0.5, r)) * 2.0;
					col = mix(col, vec3(1.0, 0.95, 0.9) * 2.5, clamp(lights, 0.0, 1.0));
					a = max(a, lights);
					a *= 1.0 - haze * 0.8;
				} else {
					// soft across its width, lumpy along it once it has begun to break up
					float x = abs(vQ.y);
					float soft = 1.0 - smoothstep(0.15, 1.0, x);
					float lump = mix(1.0, 0.45 + 0.9 * vn(vec2(vAge * 0.09 + vSeed * 31.0, x * 2.0 + vAge * 0.01)), smoothstep(10.0, 70.0, vAge));
					a *= soft * lump;
					// lit white by the sun, warm at its setting; dim and blue under the night sky
					float lit = 0.55 + 0.45 * clamp(dot(d, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
					col = mix(uSkyHor * 0.7, vec3(1.0), 0.55) * (0.3 + uSunColor * 0.85 * lit);
					a *= 0.82 * (0.08 + 0.92 * day);
					// fainter as it spreads thin
					a *= 1.0 - smoothstep(30.0, 200.0, vAge) * 0.55;
				}
				col = mix(col, uFogC, haze);
				gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	mesh.name = 'contrails';
	scene.add(mesh);

	// the flights: when each slot is free again, and where the last camera was (a jump resets them)
	const next = Array.from({ length: SLOTS }, (_, i) => 3 + i * 25 + Math.random() * 30);
	const end = new Array(SLOTS).fill(0);
	const last = new THREE.Vector3(NaN, 0, 0);
	let clock = 0, enabled = true;

	function launch(i, cam, humid) {
		const h = Math.random() * Math.PI * 2, dx = Math.cos(h), dz = Math.sin(h);
		// passing to one side of you (sometimes almost overhead), from beyond the horizon
		const off = (Math.random() * 2 - 1) * 9000;
		const speed = 225 + Math.random() * 35;
		const x0 = cam.x - dx * SPAN - dz * off, z0 = cam.z - dz * SPAN + dx * off;
		// the trail's life: short and clean in dry air, long and spreading with cirrus about
		const life = 25 + Math.min(1, humid * (0.6 + Math.random() * 0.9)) * 190;
		uA[i].set(x0, z0, 8500 + Math.random() * 2500, clock);
		uB[i].set(dx, dz, speed, 1);
		uC[i].set(life, Math.random(), 0, 0);
		end[i] = clock + SPAN * 2 / speed + life;
	}

	function update(dt, camera) {
		// (off on other worlds; where it is on, the caves may still hide it: main.js)
		if (!enabled) { mesh.visible = false; return; }
		clock += dt;
		uniforms.uClock.value = clock;
		const cam = camera.position;
		if (!Number.isFinite(last.x) || Math.hypot(cam.x - last.x, cam.z - last.z) > 20000) {
			// a new place: nothing in the sky yet, the first along soon
			for (let i = 0; i < slots; i++) { uB[i].w = 0; end[i] = clock; next[i] = clock + 4 + i * 30 + Math.random() * 30; }
		}
		last.copy(cam);
		const humid = Math.min(1, (U.uCirrus?.value ?? 0.25) * 1.4 + 0.15);
		for (let i = 0; i < slots; i++) {
			if (uB[i].w > 0 && clock > end[i]) { uB[i].w = 0; next[i] = clock + 20 + Math.random() * 70; }
			if (uB[i].w === 0 && clock > next[i]) launch(i, cam, humid);
		}
		// the haze is the scene's own
		if (scene.fog) { uniforms.uFogC.value.copy(scene.fog.color); uniforms.uFogD.value = scene.fog.density ?? 0.00026; }
		uniforms.uUpWind.value = 8 + (shared.uWind?.value ?? 0.5) * 14;
	}

	function dispose() {
		scene.remove(mesh);
		geo.dispose();
		mat.dispose();
	}

	return {
		mesh, update, dispose,
		set enabled(v) { enabled = !!v; }, get enabled() { return enabled; },
		info: () => ({ flights: uB.slice(0, slots).map((b, i) => b.w ? { x: +(uA[i].x + b.x * b.z * (clock - uA[i].w)).toFixed(0), z: +(uA[i].y + b.y * b.z * (clock - uA[i].w)).toFixed(0), alt: Math.round(uA[i].z), life: Math.round(uC[i].x) } : null) }),
		// (for checks: put a flight across the sky now, crossing near you, already this far along)
		launchNow: (camera, along = 0.45, humid = 1) => { launch(0, camera.position, humid); uA[0].w = clock - SPAN * 2 * along / uB[0].z; end[0] = clock + 9999; },
	};
}
