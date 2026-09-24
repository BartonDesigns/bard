// Sky, sun, moon, clouds, haze and the light rig, all driven by one clock.
// Daylight lasts much longer than night: most visits happen in the sun.

import * as THREE from 'three';
import { NOISE_GLSL } from './terrain.js';

const C = (r, g, b) => new THREE.Color(r, g, b);
const PAL = {
	dayZen: C(0.04, 0.20, 0.74), dayHor: C(0.46, 0.68, 0.95),
	setZen: C(0.20, 0.24, 0.50), setHor: C(1.00, 0.52, 0.26),
	nightZen: C(0.004, 0.009, 0.028), nightHor: C(0.018, 0.03, 0.065),
	sunDay: C(1.0, 0.95, 0.86), sunSet: C(1.0, 0.52, 0.22), moon: C(0.45, 0.55, 0.8),
};

export function createSky(scene, shared, renderer) {
	const uniforms = {
		uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor,
		uTime: shared.uTime, uNight: { value: 0 }, uCloud: { value: 0.45 }, uHigh: shared.uHigh,
	};
	const dome = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), new THREE.ShaderMaterial({
		uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
		vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
		fragmentShader: /* glsl */`
			uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor; uniform float uTime, uNight, uCloud, uHigh;
			varying vec3 vDir;
			${NOISE_GLSL}
			float fbm5(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.02 + 3.1; a *= 0.5; } return s; }
			void main(){
				vec3 d = normalize(vDir);
				float h = max(d.y, 0.0);
				vec3 col = mix(uSkyHor, uSkyZen, pow(h, 0.5));
				float sd = max(dot(d, uSunDir), 0.0);
				col += uSunColor * (pow(sd, 12.0) * 0.18 + pow(sd, 3.0) * 0.06) * (1.0 - uNight);
				col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 18.0 * (1.0 - uNight);
				// stars, fixed to the sky
				if (uNight > 0.01 && d.y > 0.0){
					vec3 s3 = d * 180.0; float st = h21(floor(s3.xz) + floor(s3.y) * 13.0);
					col += vec3(0.8, 0.86, 1.0) * smoothstep(0.996, 1.0, st) * uNight * (0.7 + 0.3 * sin(uTime * 2.0 + st * 50.0));
					// the moon, opposite the sun
					float md = max(dot(d, -uSunDir), 0.0);
					col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9994, 0.9997, md) * 2.5 + pow(md, 60.0) * 0.08) * uNight;
				}
				// cumulus on a plane above the island, lit from the sun's side
				if (d.y > 0.01){
					vec2 cp = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
					float base = fbm5(cp * 0.9);
					float cover = mix(0.72, 0.42, uCloud);
					float dens = smoothstep(cover, cover + 0.16, base) * smoothstep(0.01, 0.2, d.y);
					float toward = fbm5(cp * 0.9 + uSunDir.xz * 0.12);
					float lit = clamp(0.62 + (base - toward) * 4.0, 0.0, 1.2);
					vec3 shade = mix(vec3(0.42, 0.47, 0.58), vec3(1.0), lit);
					vec3 cloud = shade * mix(vec3(1.0), uSunColor * 0.9, 0.35) * (1.0 - uNight * 0.9) + uSkyHor * 0.12;
					cloud += uSunColor * pow(sd, 6.0) * 0.5 * (1.0 - uNight);
					col = mix(col, cloud, dens * 0.95);
				}
				col = mix(col, uSkyHor, smoothstep(0.02, -0.12, d.y));
				gl_FragColor = vec4(col, 1.0);
				#include <tonemapping_fragment>
				#include <colorspace_fragment>
			}`,
	}));
	dome.frustumCulled = false;
	dome.renderOrder = -10;
	scene.add(dome);

	const sun = new THREE.DirectionalLight(0xffffff, 3);
	sun.castShadow = true;
	sun.shadow.mapSize.set(2048, 2048);
	const sc = sun.shadow.camera;
	sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400;
	sun.shadow.bias = -0.0004;
	sun.shadow.normalBias = 0.04;
	// soft-edged, and never black: skylight still reaches into shade
	sun.shadow.radius = 4;
	sun.shadow.intensity = 0.78;
	scene.add(sun, sun.target);
	const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a5230, 0.9);
	scene.add(hemi);
	scene.fog = new THREE.FogExp2(0xa9c4dc, 0.00026);

	const state = { hours: shared.startHours ?? 10.5, speed: 1 };
	const tmpA = new THREE.Color(), tmpB = new THREE.Color();

	function update(dt, focus) {
		// daylight hours pass slowly (~9 real minutes), night quickly (~2.5)
		const day = state.hours >= 6 && state.hours < 18.5;
		state.hours = (state.hours + dt * state.speed * (day ? 12.5 / 540 : 11.5 / 150)) % 24;
		const a = (state.hours - 6) / 12 * Math.PI;
		const sd = shared.uSunDir.value.set(Math.cos(a) * 0.82, Math.sin(a), 0.42).normalize();
		const elev = sd.y;
		const dayK = THREE.MathUtils.smoothstep(elev, -0.05, 0.25);
		const setK = 1 - THREE.MathUtils.smoothstep(Math.abs(elev), 0.02, 0.3);
		const night = 1 - THREE.MathUtils.smoothstep(elev, -0.18, 0.02);
		uniforms.uNight.value = night;
		tmpA.copy(PAL.dayZen).lerp(PAL.setZen, setK * 0.8).lerp(PAL.nightZen, night);
		tmpB.copy(PAL.dayHor).lerp(PAL.setHor, setK * 0.85).lerp(PAL.nightHor, night);
		shared.uSkyZen.value.copy(tmpA);
		shared.uSkyHor.value.copy(tmpB);
		const sunCol = shared.uSunColor.value.copy(PAL.sunDay).lerp(PAL.sunSet, setK);
		// light: the sun by day, the moon by night
		if (night < 0.5) {
			sun.color.copy(sunCol);
			sun.intensity = 3.4 * dayK + 0.4 * setK;
			sun.position.copy(sd).multiplyScalar(200).add(focus);
		} else {
			sun.color.copy(PAL.moon);
			sun.intensity = 0.28 * night;
			sun.position.copy(sd).multiplyScalar(-200).add(focus);
		}
		sun.target.position.copy(focus);
		// the shadow box follows the player in whole texels so edges do not crawl
		const texel = 110 / 2048;
		sun.target.position.x = Math.round(focus.x / texel) * texel;
		sun.target.position.z = Math.round(focus.z / texel) * texel;
		sun.position.x += sun.target.position.x - focus.x;
		sun.position.z += sun.target.position.z - focus.z;
		hemi.color.copy(tmpB).lerp(tmpA, 0.5).multiplyScalar(1.0);
		hemi.groundColor.setRGB(0.32, 0.28, 0.17).multiplyScalar(0.3 + 0.7 * dayK);
		hemi.intensity = 0.25 + 0.9 * dayK;
		shared.uAmbient.value.copy(hemi.color).multiplyScalar(0.35 * hemi.intensity + 0.02);
		// haze: blue by day so far land stacks up in layers
		scene.fog.color.copy(tmpB).lerp(tmpA, 0.12);
		renderer.toneMappingExposure = 1.15 + night * 0.5;
		dome.position.copy(focus);
		return { night, dayK, setK };
	}
	return { dome, sun, hemi, state, update, uniforms };
}
