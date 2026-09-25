// Sky, sun, moon, clouds, haze and the light rig, all driven by one clock.
// Daylight lasts much longer than night: most visits happen in the sun.

import * as THREE from 'three';
import { NOISE_GLSL } from './terrain.js';
import { STARS_B64, STAR_COUNT } from './starcat.js';

// The real sky over the Bay Area: latitude 37.8 N, a midsummer night (the sun near
// RA 7.6 h), so the Milky Way's heart stands over the southern horizon in the evening
// and the Summer Triangle overhead. East is +x, north is -z, up is +y.
const LAT = 37.8 * Math.PI / 180, SUN_RA = 7.6;
// equatorial (J2000) to galactic
const EQ2GAL = [-0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.4448296300, 0.7469822445, -0.8676661490, -0.1980763734, 0.4559837762];

const C = (r, g, b) => new THREE.Color(r, g, b);
const PAL = {
	dayZen: C(0.03, 0.24, 0.72), dayHor: C(0.50, 0.72, 0.92),
	setZen: C(0.20, 0.24, 0.50), setHor: C(1.00, 0.52, 0.26),
	nightZen: C(0.004, 0.009, 0.028), nightHor: C(0.018, 0.03, 0.065),
	sunDay: C(1.0, 0.90, 0.74), sunSet: C(1.0, 0.52, 0.22), moon: C(0.45, 0.55, 0.8),
};

export function createSky(scene, shared, renderer) {
	const uniforms = {
		uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uSkyZen: shared.uSkyZen, uSkyHor: shared.uSkyHor,
		uTime: shared.uTime, uNight: { value: 0 }, uCloud: { value: 0.62 }, uHigh: shared.uHigh,
		uW2E: { value: new THREE.Matrix3() }, uE2G: { value: new THREE.Matrix3().set(...EQ2GAL) }, uGlow: shared.uSkyGlow || (shared.uSkyGlow = { value: 0 }),
	};
	const dome = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), new THREE.ShaderMaterial({
		uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
		vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`,
		fragmentShader: /* glsl */`
			uniform vec3 uSunDir, uSunColor, uSkyZen, uSkyHor; uniform float uTime, uNight, uCloud, uHigh, uGlow; uniform mat3 uW2E, uE2G;
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
				// the Milky Way: the galaxy's disc seen edge-on, from its real place in the sky.
				// Galactic longitude l, latitude b: a band along b = 0, the bulge swelling toward
				// Sagittarius (l = 0), bright star clouds, and the Great Rift's dark dust splitting
				// it from Cygnus down to the centre. Light-polluted skies wash it out.
				if (uNight > 0.01 && d.y > -0.05){
					vec3 eq = uW2E * d, g = uE2G * eq;
					float l = atan(g.y, g.x), b = asin(clamp(g.z, -1.0, 1.0));
					float core = exp(-l * l / 0.55);
					float width = 0.09 + 0.16 * core + 0.03 * exp(-pow(l - 1.4, 2.0) / 0.2);
					float band = exp(-b * b / (width * width));
					vec2 gp = vec2(l * 9.0, b * 20.0);
					float clouds = fbm5(gp * 0.8 + 3.0) * 0.9 + fbm5(gp * 2.3 - 5.0) * 0.5;
					float bright = band * (0.28 + 0.9 * core + 0.35 * exp(-pow(l - 1.4, 2.0) / 0.25) + 0.15 * exp(-pow(abs(l) - 2.6, 2.0) / 0.3)) * (0.5 + clouds);
					// dust lanes: the Rift along the plane from Cygnus (l ~ 80 deg) to the core, and dark knots
					float rift = exp(-pow((b - 0.02 - 0.03 * sin(l * 3.0) - 0.02 * (fbm5(gp * 0.6) - 0.5)) / (0.035 + 0.03 * core), 2.0)) * smoothstep(1.7, 0.9, l) * smoothstep(-0.7, -0.1, l);
					float knots = smoothstep(0.5, 0.85, fbm5(gp * 1.4 + 11.0)) * band;
					bright *= 1.0 - 0.6 * rift - 0.35 * knots;
					bright *= 0.75 + 0.5 * fbm5(gp * 3.1 + 7.0);                              // mottled, never smooth
					vec3 mw = mix(vec3(0.55, 0.62, 0.82), vec3(1.0, 0.8, 0.58), core * 0.85);
					// the unresolved glow of countless faint stars: fine grain on the band
					float grain = step(0.985, h21(floor(d.xz * 900.0 / (abs(d.y) + 0.3)) + floor(d.y * 700.0))) * band;
					float horizon = smoothstep(0.0, 0.25, d.y);
					col += (mw * bright * 0.04 + vec3(0.9, 0.9, 1.0) * grain * 0.1) * uNight * horizon * (1.0 - uGlow * 0.85);
					// Andromeda: a faint elongated smudge at RA 0h42m, Dec +41 deg
					vec3 m31 = vec3(0.7336, 0.1368, 0.6597);
					float am = dot(eq, m31);
					if (am > 0.99){
						vec3 ax = normalize(cross(m31, vec3(0.0, 0.0, 1.0))), ay = cross(ax, m31);
						vec2 q = vec2(dot(eq, ax), dot(eq, ay));
						vec2 qr = mat2(0.8, -0.6, 0.6, 0.8) * q;
						float e2 = qr.x * qr.x / 0.0009 + qr.y * qr.y / 0.00008;
						col += vec3(0.85, 0.82, 0.78) * (exp(-e2) * 0.025 + exp(-e2 * 30.0) * 0.05) * uNight * horizon * (1.0 - uGlow);
					}
					// now and then a meteor
					float mt = floor(uTime / 7.0), mf = fract(uTime / 7.0);
					if (h21(vec2(mt, 3.0)) > 0.55 && mf < 0.12){
						vec3 m0 = normalize(vec3(h21(vec2(mt, 1.0)) - 0.5, 0.55 + h21(vec2(mt, 2.0)) * 0.4, h21(vec2(mt, 4.0)) - 0.5));
						vec3 mdir = normalize(cross(m0, vec3(0.3, 1.0, 0.2)));
						vec3 head = normalize(m0 + mdir * mf * 1.6);
						vec3 tail = normalize(m0 + mdir * max(0.0, mf * 1.6 - 0.12));
						vec3 seg = head - tail; float tt = clamp(dot(d - tail, seg) / dot(seg, seg), 0.0, 1.0);
						float md = length(d - (tail + seg * tt));
						col += vec3(0.9, 0.95, 1.0) * smoothstep(0.0025, 0.0, md) * tt * (1.0 - mf / 0.12) * uNight * 1.5;
					}
				}
				if (uNight > 0.01 && d.y > 0.0){
					// the moon, opposite the sun
					float md = max(dot(d, -uSunDir), 0.0);
					col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9994, 0.9997, md) * 2.5 + pow(md, 60.0) * 0.08) * uNight;
				}
				// cumulus on a plane above the island, lit from the sun's side
				if (d.y > 0.01){
					vec2 cp = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
					float base = fbm5(cp * 0.9);
					// heaped cumulus: a broad field of cloud heaps, the fine detail riding on them
					float heap = fbm5(cp * 0.32 + 11.0);
					base = base * 0.6 + heap * 0.55;
					float cover = mix(0.78, 0.46, uCloud);
					float dens = smoothstep(cover, cover + 0.12, base) * smoothstep(0.01, 0.2, d.y);
					float toward = fbm5(cp * 0.9 + uSunDir.xz * 0.12);
					float lit = clamp(0.62 + (base - toward) * 4.0, 0.0, 1.2);
					// bright sunlit tops, cool grey-blue bases: a cloud with volume, not a smear
					vec3 shade = mix(vec3(0.46, 0.52, 0.64), vec3(1.08), smoothstep(0.1, 1.0, lit)) * (0.85 + 0.25 * smoothstep(cover, cover + 0.35, base));
					// at night the clouds are dark shapes against the stars, rimmed faintly by moonlight
					vec3 cloud = shade * mix(vec3(1.0), uSunColor * 0.9, 0.35) * (1.0 - uNight * 0.975) + uSkyHor * 0.12;
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

	// ---------- the stars: every naked-eye star in its real place ----------
	const stars = (() => {
		const raw = Uint8Array.from(atob(STARS_B64), (c) => c.charCodeAt(0));
		const S = new Float32Array(raw.buffer);
		const pos = new Float32Array(STAR_COUNT * 3), mag = new Float32Array(STAR_COUNT), col = new Float32Array(STAR_COUNT * 3);
		const bv2rgb = (bv) => {
			// B-V colour to a star's tint: blue-white hot stars to orange cool giants
			const t = THREE.MathUtils.clamp((bv + 0.3) / 2.0, 0, 1);
			return [1.0 - Math.max(0, 0.25 - t) * 1.2 + 0.0, 0.82 + 0.18 * (1 - Math.abs(t - 0.3) * 1.6), 1.0 - t * 0.75];
		};
		for (let i = 0; i < STAR_COUNT; i++) {
			const ra = S[i * 4] / 12 * Math.PI, dec = S[i * 4 + 1] * Math.PI / 180;
			pos.set([Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)], i * 3);
			mag[i] = S[i * 4 + 2];
			col.set(bv2rgb(S[i * 4 + 3]), i * 3);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
		g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
		const m = new THREE.ShaderMaterial({
			uniforms: { uNight: uniforms.uNight, uTime: shared.uTime, uPx: { value: renderer.getPixelRatio() }, uGlow: uniforms.uGlow, uCloud: uniforms.uCloud },
			vertexShader: `attribute float aMag; attribute vec3 aCol; uniform float uNight, uTime, uPx, uGlow, uCloud; varying vec3 vCol; varying float vA;
				${NOISE_GLSL}
				float fbm5(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.02 + 3.1; a *= 0.5; } return s; }
				void main(){
					vec3 w = normalize(mat3(modelMatrix) * position);
					vec4 p = viewMatrix * vec4(cameraPosition + w * 11000.0, 1.0);
					gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99998;
					// brightness from magnitude; the faint ones drown in city glow and horizon haze
					float limit = 6.2 - uGlow * 3.2;
					float flux = pow(10.0, -0.4 * (aMag - 1.0));
					float alt = w.y;
					float ext = smoothstep(-0.02, 0.2, alt);
					float tw = 1.0 + (0.25 + 0.5 * (1.0 - smoothstep(0.0, 0.5, alt))) * sin(uTime * (7.0 + fract(aMag * 13.1) * 9.0) + aMag * 40.0);
					// hidden behind the clouds (the dome's own cloud field)
					float cover = 0.0;
					if (w.y > 0.01){
						vec2 cp = w.xz / (w.y + 0.08) * 1.6 + vec2(uTime * 0.012, uTime * 0.004);
						float base = fbm5(cp * 0.9) * 0.6 + fbm5(cp * 0.32 + 11.0) * 0.55;
						float cv = mix(0.78, 0.46, uCloud);
						cover = smoothstep(cv - 0.02, cv + 0.08, base) * smoothstep(0.01, 0.2, w.y);
					}
					vA = clamp(sqrt(flux) * 0.55 + 0.25, 0.0, 1.0) * smoothstep(limit, limit - 1.2, aMag) * ext * uNight * tw * (1.0 - cover);
					gl_PointSize = clamp(1.3 + sqrt(flux) * 2.2, 1.2, 7.0) * uPx;
					vCol = aCol;
				}`,
			fragmentShader: `varying vec3 vCol; varying float vA;
				void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = (smoothstep(0.5, 0.0, r) * 0.5 + smoothstep(0.18, 0.0, r)) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a * 1.4, 1.0); }`,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
		});
		const pts = new THREE.Points(g, m);
		pts.frustumCulled = false;
		pts.renderOrder = -9;
		pts.matrixAutoUpdate = false;
		scene.add(pts);
		return pts;
	})();
	const eqM = new THREE.Matrix4(), rz = new THREE.Matrix4(), w2e = new THREE.Matrix3();
	// the celestial sphere turns with the clock: local sidereal time from solar time
	function orientSky() {
		const lst = ((state.hours + SUN_RA - 12) % 24 + 24) % 24 / 12 * Math.PI;
		const sf = Math.sin(LAT), cf = Math.cos(LAT);
		rz.set(Math.cos(lst), Math.sin(lst), 0, 0, -Math.sin(lst), Math.cos(lst), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
		eqM.set(0, 1, 0, 0, cf, 0, sf, 0, sf, 0, -cf, 0, 0, 0, 0, 1).multiply(rz);
		stars.matrix.copy(eqM); stars.matrixWorld.copy(eqM);
		w2e.setFromMatrix4(eqM).transpose();
		uniforms.uW2E.value.copy(w2e);
	}

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
			sun.intensity = 0.5 * night;
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
		// light bounced off warm sand and sunlit leaves fills the shade with gold, not grey
		hemi.groundColor.setRGB(0.46, 0.36, 0.18).multiplyScalar(0.3 + 0.7 * dayK);
		hemi.intensity = 0.25 + 0.9 * dayK;
		shared.uAmbient.value.copy(hemi.color).multiplyScalar(0.35 * hemi.intensity + 0.02);
		// haze: blue by day so far land stacks up in layers
		scene.fog.color.copy(tmpB).lerp(tmpA, 0.12);
		renderer.toneMappingExposure = 1.15 + night * 0.15;
		dome.position.copy(focus);
		orientSky();
		return { night, dayK, setK };
	}
	return { dome, sun, hemi, state, update, uniforms };
}
