// The military's materials and a small geometry builder. One program per material, shared by
// every base and vehicle: painted armour (panel seams, rivets, chipped edges, mud low down,
// a camouflage pattern laid in the vehicle's own metres), the aircraft's low-visibility grey,
// dark gunmetal, rubber and track, glass, concrete weathered as the town's walls are
// (bay/weathering.js), corrugated metal, asphalt with its markings painted in the shader, the
// chain-link fence (cut out, so it is one strip), and lamps that light at night.
//
//   const B = builder(); B.box('concrete', w, h, d, x, y, z, yaw, colour); ... B.meshes(kit)
// gathers everything by material into one merged geometry each: a base is a handful of draws.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { weatherStucco } from '../bay/weathering.js';
import { usePhoto, photoUniform, TRI_GLSL } from '../world/photomats.js';

const NOISE = /* glsl */`
float mh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float mn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(mh(i), mh(i + vec3(1, 0, 0)), f.x), mix(mh(i + vec3(0, 1, 0)), mh(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(mh(i + vec3(0, 0, 1)), mh(i + vec3(1, 0, 1)), f.x), mix(mh(i + vec3(0, 1, 1)), mh(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
// a thin line at each whole unit of x, faded out where it would be finer than a pixel
float mline(float x, float w){ float fw = max(fwidth(x), 1e-4), d = abs(fract(x + 0.5) - 0.5); return (1.0 - smoothstep(w, w + fw * 1.5, d)) * (1.0 - smoothstep(0.15, 0.5, fw)); }
`;

// painted armour and airframes: seams on a grid in the object's own frame, rivet rows along
// them, edge wear, grime and mud from below; camo (k) blotches in three tones of the paint
function armour(camo, night) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: camo ? 0.78 : 0.55, metalness: camo ? 0.15 : 0.3, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNight = night;
		sh.vertexShader = 'varying vec3 vMl; varying vec3 vMn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMl = position; vMn = normal;');
		sh.fragmentShader = 'varying vec3 vMl; varying vec3 vMn; uniform float uNight;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec3 p = vMl, n = normalize(vMn);
				vec3 c = diffuseColor.rgb;
				${camo ? `float b1 = mn(p * 0.9 + vec3(3.1, 0.0, 1.7)) * 0.75 + mn(p * 2.7) * 0.25;
				float b2 = mn(p.zyx * 1.1 + 7.3) * 0.75 + mn(p * 3.1 + 2.0) * 0.25;
				c = mix(c, c * vec3(0.62, 0.66, 0.55), smoothstep(0.54, 0.58, b1));
				c = mix(c, c * vec3(1.18, 1.12, 0.95), smoothstep(0.6, 0.64, b2));` : ''}
				// panel seams and rivets
				vec3 q = p * vec3(1.1, 1.4, 0.85);
				float ax = abs(n.x) > 0.6 ? 0.0 : 1.0, az = abs(n.z) > 0.6 ? 0.0 : 1.0, ay = abs(n.y) > 0.6 ? 0.0 : 1.0;
				float seam = max(max(mline(q.x, 0.012) * ax, mline(q.z, 0.012) * az), mline(q.y, 0.016) * ay * 0.7);
				c *= 1.0 - seam * 0.35;
				float rv = (1.0 - smoothstep(0.035, 0.05, length(fract(q.xz * 6.0) - 0.5))) * max(mline(q.x, 0.03) * ax, mline(q.z, 0.03) * az);
				c *= 1.0 + rv * 0.18;
				// wear: chips to bare metal, grime streaks, mud and dust from the ground up
				float chip = smoothstep(0.78, 0.82, mn(p * 9.0) * 0.6 + mn(p * 31.0) * 0.4);
				c = mix(c, vec3(0.32, 0.31, 0.3), chip * 0.5);
				float streak = smoothstep(0.5, 0.8, mn(vec3(p.x * 4.0, p.y * 0.4, p.z * 4.0)));
				c *= 1.0 - streak * 0.12 * (1.0 - abs(n.y));
				float mud = (1.0 - smoothstep(0.2, 1.3, p.y + (mn(p * 2.0) - 0.5) * 0.5));
				c = mix(c, vec3(0.32, 0.27, 0.2), mud * ${camo ? '0.55' : '0.0'});
				c = mix(c, c * 1.1 + 0.03, max(n.y, 0.0) * 0.15);
				diffuseColor.rgb = c;
			}`);
	};
	m.customProgramCacheKey = () => (camo ? 'mil-armour-camo-2' : 'mil-armour-air-2');
	return m;
}

// the vehicles: one program for every surface of every vehicle, chosen per vertex (mtl, the
// numbers in models.js M): paint (camouflage in three tones of the instance's colour, laid in
// the vehicle's own metres, or the aircraft's smooth grey), dark metal, rubber, glass, lamps,
// canvas, track links that scroll (the instance colour's red carries how far), hot metal,
// beacons and bare steel. Panel seams, rivets, chipped edges, grime streaks; mud and dust up the
// lower hull and the running gear; the grain of brushed metal from the photographic swatches
// (world/photomats.js). lit: lamps glow at night (a vehicle in use); burnt: a wreck
function vehicle(night, time, { lit = false, burnt = false } = {}) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2, vertexColors: true });
	const [uPh, uPhK] = photoUniform('aluminium', { mean: 0.5, contrast: 0.8 });
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, { uNight: night, uTime: time, uPh, uPhK });
		sh.vertexShader = 'attribute float mtl; attribute vec3 opos; varying float vMtl; varying vec3 vOp; varying vec3 vOn; varying vec3 vTint; varying vec2 vTu;\n' + sh.vertexShader.replace('#include <color_vertex>', `
			vColor = vec4(1.0);
			#ifdef USE_COLOR
				vColor.rgb *= color;
			#endif
			#ifdef USE_INSTANCING_COLOR
				vTint = instanceColor.xyz;
			#else
				vTint = vec3(1.0);
			#endif
			vMtl = mtl; vOp = opos; vOn = normal; vTu = uv;`);
		sh.fragmentShader = 'varying float vMtl; varying vec3 vOp; varying vec3 vOn; varying vec3 vTint; varying vec2 vTu; uniform float uNight; uniform float uTime; uniform sampler2D uPh; uniform float uPhK;\n' + NOISE + TRI_GLSL + sh.fragmentShader
			.replace('#include <color_fragment>', `#include <color_fragment>
				float mR = 0.6, mM = 0.2; vec3 mE = vec3(0.0);
				{
					vec3 p = vOp, n = normalize(vOn), c = vColor.rgb;
					int k = int(vMtl + 0.5);
					float ph = mix(1.0, triPhoto(uPh, p, n, 0.9).g * 2.0, 0.3 * uPhK);
					bool ground = p.y < 1.6;
					if (k <= 1) {
						c *= vTint;
						if (k == 0) {
							// three tones over the paint, in broad blotches with brushed edges
							float b1 = mn(p * 0.55 + vec3(3.1, 0.0, 1.7)) * 0.7 + mn(p * 1.9) * 0.3;
							float b2 = mn(p.zyx * 0.7 + 7.3) * 0.7 + mn(p * 2.2 + 2.0) * 0.3;
							float b3 = mn(p * 0.8 + 13.1) * 0.75 + mn(p * 3.3) * 0.25;
							c = mix(c, c * vec3(0.58, 0.6, 0.52), smoothstep(0.55, 0.57, b1));
							c = mix(c, c * vec3(1.22, 1.15, 0.98), smoothstep(0.6, 0.62, b2) * (1.0 - smoothstep(0.55, 0.57, b1)));
							c = mix(c, vec3(0.13, 0.13, 0.12), smoothstep(0.66, 0.68, b3) * 0.85);
						}
						// panel seams and rivets on a grid in the vehicle's metres
						vec3 q = p * (k == 0 ? vec3(1.1, 1.4, 0.85) : vec3(0.55, 0.8, 0.42));
						float ax = abs(n.x) > 0.6 ? 0.0 : 1.0, az = abs(n.z) > 0.6 ? 0.0 : 1.0, ay = abs(n.y) > 0.6 ? 0.0 : 1.0;
						float seam = max(max(mline(q.x, 0.01) * ax, mline(q.z, 0.01) * az), mline(q.y, 0.014) * ay * 0.7);
						c *= 1.0 - seam * (k == 0 ? 0.35 : 0.14);
						float rv = (1.0 - smoothstep(0.03, 0.045, length(fract(q.xz * 6.0) - 0.5))) * max(mline(q.x, 0.03) * ax, mline(q.z, 0.03) * az);
						c *= 1.0 + rv * 0.2;
						if (k == 0) {
							// chips to bare metal along the edges, grime streaks down the sides
							float chip = smoothstep(0.8, 0.84, mn(p * 9.0) * 0.6 + mn(p * 31.0) * 0.4);
							c = mix(c, vec3(0.3, 0.29, 0.28), chip * 0.55);
							c *= 1.0 - smoothstep(0.5, 0.8, mn(vec3(p.x * 4.0, p.y * 0.35, p.z * 4.0))) * 0.14 * (1.0 - abs(n.y));
						} else {
							// soot behind the nozzles, the paint a touch uneven
							c *= 1.0 - smoothstep(-6.2, -7.8, p.z) * 0.45 * (0.6 + 0.4 * mn(p * 3.0));
							c *= 0.96 + 0.06 * mn(p * 0.6);
						}
						c *= ph;
						mR = k == 0 ? 0.72 : 0.42; mM = k == 0 ? 0.12 : 0.28;
					} else if (k == 2) { c *= ph; mR = 0.5; mM = 0.55; }
					else if (k == 3) { c *= 0.9 + 0.2 * mn(p * 12.0); mR = 0.93; mM = 0.0; }
					else if (k == 4) { mR = 0.05; mM = 0.65; ground = false; }
					else if (k == 5) {
						mR = 0.25; mM = 0.0;
						${lit ? 'mE = c * (0.25 + uNight * 6.0);' : 'mE = c * 0.04;'}
						c *= 0.5; ground = false;
					}
					else if (k == 6) { c *= 0.88 + 0.16 * mn(p * 8.0) + 0.05 * sin(p.x * 160.0) * sin(p.z * 160.0); mR = 0.97; mM = 0.0; }
					else if (k == 7) {
						// track links: shoes with gaps between, end connectors worn bright, a guide down the middle
						float u = vTu.x + vTint.r, v = abs(vTu.y);
						float f = fract(u / 0.17);
						float gap = smoothstep(0.0, 0.07, f) * (1.0 - smoothstep(0.86, 0.93, f));
						c = mix(c * 0.3, c, gap);
						c = mix(c, vec3(0.52, 0.5, 0.47), smoothstep(0.22, 0.24, v) * gap * 0.8);
						c *= 1.0 - (1.0 - smoothstep(0.03, 0.05, v)) * 0.4;
						c *= 0.85 + 0.3 * mn(vec3(u * 3.0, v * 9.0, 0.0));
						mR = 0.62 - smoothstep(0.22, 0.24, v) * 0.2; mM = 0.55;
					}
					else if (k == 8) { mR = 0.4; mM = 0.75; c *= vec3(1.0, 0.92, 0.95) * (0.8 + 0.3 * mn(p * 6.0)); }
					else if (k == 9) {
						// nav lights steady, white strobes and red beacons flashing
						mR = 0.3; mM = 0.0;
						float blink = step(0.9, fract(uTime * 0.8 + p.x * 0.13 + p.z * 0.07));
						${lit ? 'mE = c * (0.6 + uNight * 4.0) * (c.g > 0.9 && c.r > 0.9 ? blink * 2.0 : c.g < 0.5 ? 0.3 + 0.7 * blink : 1.0);' : 'mE = vec3(0.0);'}
						ground = false;
					}
					else { mR = 0.32; mM = 0.85; c *= ph; }
					// mud from the ground up, dust settled on whatever faces up
					if (ground && k != 1) {
						float lo = 1.0 - smoothstep(0.25, 1.3, p.y + (mn(p * 2.1) - 0.5) * 0.6);
						float splat = smoothstep(0.35, 0.65, mn(p * 4.0 + 5.0) * 0.6 + mn(p * 13.0) * 0.4);
						c = mix(c, vec3(0.105, 0.085, 0.06), lo * mix(0.45, 0.85, splat));
						mR = mix(mR, 0.95, lo * 0.7);
						c = mix(c, vec3(0.3, 0.26, 0.2), max(n.y, 0.0) * 0.3 * smoothstep(0.35, 0.7, mn(p * 1.7 + 9.0)));
					}
					${burnt ? `c = mix(vec3(0.05, 0.045, 0.04), vec3(0.28, 0.14, 0.07), smoothstep(0.6, 0.75, mn(p * 2.0)) * 0.6) * (0.7 + 0.3 * mn(p * 5.0));
					mR = 0.95; mM = 0.1; mE = vec3(0.0);` : ''}
					diffuseColor.rgb = c;
				}`)
			.replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mR;')
			.replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mM;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += mE;');
	};
	m.customProgramCacheKey = () => 'mil-vehicle-1' + (lit ? '-lit' : '') + (burnt ? '-burnt' : '');
	return m;
}
// the afterburner's flame: additive, brightest at the nozzle, shock rings down its length
function flame(colA, colB, strength) {
	return new THREE.ShaderMaterial({
		uniforms: { uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) }, uK: { value: strength } },
		vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: 'uniform vec3 uA; uniform vec3 uB; uniform float uK; varying vec2 vU; void main(){ float t = 1.0 - vU.y; float a = pow(t, 1.4) * uK; vec3 c = mix(uB, uA, t); float ring = 0.7 + 0.3 * sin(vU.y * 30.0); gl_FragColor = vec4(c * a * ring, a); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}
// a rotor's blur: a faint disc, darker at the tips, the blades smeared round it. Each blade
// trails a ghost that fades behind it (the disc turns with the rotor, models.js), and a second,
// fainter set of ghosts runs round against them on the kit's clock, so the disc shimmers as a
// whirring rotor does instead of sitting still
function blurDisc(time) {
	return new THREE.ShaderMaterial({
		uniforms: { uTime: time },
		vertexShader: 'varying vec2 vU; void main(){ vU = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: `uniform float uTime; varying vec2 vU;
			float ghost(float ang, float ph) { float u = fract((ang + ph) * 0.63662); return pow(1.0 - u, 2.4); }
			void main(){
				float r = length(vU) * 2.0; if (r > 1.0) discard;
				float a = smoothstep(0.05, 0.1, r) * (1.0 - smoothstep(0.93, 1.0, r));
				float ang = atan(vU.y, vU.x);
				float g1 = ghost(ang, 0.0), g2 = ghost(-ang, uTime * 9.0);
				float tip = 0.55 + 0.45 * smoothstep(0.8, 0.95, r);
				float body = (0.07 + 0.3 * g1 + 0.13 * g2) * tip;
				gl_FragColor = vec4(vec3(0.09, 0.095, 0.1), a * body);
			}`,
		transparent: true, depthWrite: false, side: THREE.DoubleSide,
	});
}

// asphalt with its markings: the runway's centreline, threshold bars, touchdown and aiming
// marks and edge lines, the taxiways' yellow line; tyre rubber at the touchdown zones. The
// geometry's uv is metres along (u) and across (v) from the strip's middle; uv1.x its length,
// uv1.y its width, uv1 sign: runway (+) or taxiway (-)
function asphalt() {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.vertexShader = 'attribute vec3 strip; varying vec3 vSt; varying vec2 vSu; varying vec3 vSw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSt = strip; vSu = uv; vSw = (modelMatrix * vec4(position, 1.0)).xyz;');
		sh.fragmentShader = 'varying vec3 vSt; varying vec2 vSu; varying vec3 vSw;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec2 w = vSw.xz;
				float n = mn(vec3(w * 0.35, 0.0)) * 0.5 + mn(vec3(w * 2.3, 1.0)) * 0.3 + mn(vec3(w * 11.0, 2.0)) * 0.2;
				vec3 c = diffuseColor.rgb * (0.82 + 0.3 * n);
				float L = vSt.x, H = vSt.y, kind = vSt.z, u = vSu.x, v = vSu.y, au = abs(u), av = abs(v);
				if (kind < -0.5) {
					// the ground between: dry grass and bare earth, mown in broad passes
					float g = mn(vec3(w * 0.08, 7.0)) * 0.5 + mn(vec3(w * 0.6, 8.0)) * 0.3 + mn(vec3(w * 3.0, 9.0)) * 0.2;
					vec3 grass = mix(vec3(0.42, 0.4, 0.22), vec3(0.58, 0.52, 0.32), g);
					grass = mix(grass, vec3(0.47, 0.4, 0.3), smoothstep(0.62, 0.8, mn(vec3(w * 0.05, 10.0))) * 0.7);
					grass *= 0.94 + 0.06 * step(0.5, fract(dot(w, vec2(0.7, 0.7)) / 6.0));
					diffuseColor.rgb = grass * (0.9 + 0.2 * mn(vec3(w * 9.0, 11.0)));
				} else {
				// patches and sealed cracks, broken up so they never run on for ever
				float crack = (1.0 - smoothstep(0.0, 0.006, abs(mn(vec3(w * 0.33, 4.0)) - 0.5))) * smoothstep(0.55, 0.75, mn(vec3(w * 0.09, 6.0)));
				c *= 1.0 - crack * 0.3;
				c = mix(c, c * 0.88, smoothstep(0.6, 0.7, mn(vec3(floor(w / 3.0), 5.0))) * 0.6);
				float paint = 0.0; vec3 pc = vec3(0.93, 0.93, 0.9);
				if (kind > 1.5) {
					// the runway: edge lines, the dashed centreline, threshold bars at each end, the
					// aiming point blocks and touchdown pairs; rubber in the touchdown zones
					float end = L * 0.5 - au;
					paint = max(paint, step(H * 0.5 - 1.2, av) * step(av, H * 0.5 - 0.3));
					paint = max(paint, step(av, 0.45) * step(0.45, fract(u / 50.0)) * step(end, L * 0.5 - 60.0) * step(60.0, end));
					paint = max(paint, step(6.0, end) * step(end, 36.0) * step(fract(v / 3.2), 0.6) * step(av, H * 0.5 - 2.5));
					paint = max(paint, step(300.0, end) * step(end, 345.0) * step(4.0, av) * step(av, 9.5));
					for (int k = 0; k < 3; k++) { float s = 150.0 + float(k) * 150.0; paint = max(paint, step(s, end) * step(end, s + 22.0) * step(3.0, av) * step(av, 5.0) * step(k == 0 ? 0.0 : 0.5, 1.0)); }
					float rubber = smoothstep(60.0, 120.0, end) * (1.0 - smoothstep(300.0, 650.0, end)) * (1.0 - smoothstep(2.0, 9.0, av));
					c *= 1.0 - rubber * (0.35 + 0.3 * mn(vec3(u * 0.8, v * 6.0, 3.0)));
				} else if (kind > 0.5) {
					// a taxiway: the yellow centreline down its length, its edges; where a link meets
					// the runway, the hold bars (two solid, two dashed)
					pc = vec3(0.86, 0.68, 0.16);
					bool longU = L >= H;
					float cl = longU ? av : au, hw = longU ? H * 0.5 : L * 0.5;
					paint = max(step(cl, 0.2), step(hw - 0.6, cl) * step(cl, hw - 0.3));
					if (!longU) {
						float hv = v - (H * 0.5 - 10.0);
						float solid = step(abs(hv), 0.15) + step(abs(hv - 0.5), 0.15);
						float dash = (step(abs(hv - 1.3), 0.15) + step(abs(hv - 1.8), 0.15)) * step(0.5, fract(u / 1.8));
						paint = max(paint, min(1.0, solid + dash) * step(au, hw - 0.6));
					}
				} else if (kind > 0.05) {
					// an apron or a helipad: stand lines, a lead-in line to each stand ending at its stop
					// bar, the edge lines; the pad's circle and H
					pc = vec3(0.86, 0.68, 0.16);
					paint = step(0.97, fract(u / 25.0)) * step(av, H * 0.5 - 3.0);
					float su = (fract(u / 25.0 + 0.5) - 0.5) * 25.0;
					paint = max(paint, step(abs(su), 0.12) * step(-H * 0.5 + 14.0, v) * step(v, H * 0.5 - 1.2));
					paint = max(paint, step(abs(su), 2.2) * step(abs(v + H * 0.5 - 13.5), 0.22));
					paint = max(paint, step(H * 0.5 - 1.1, av) * step(av, H * 0.5 - 0.85) + step(H * 0.5 - 0.65, av) * step(av, H * 0.5 - 0.4));
					if (kind < 0.2) { float r = length(vec2(u, v)); pc = vec3(0.93); paint = max(step(abs(r - 9.5), 0.35), (step(au, 3.4) * step(av, 4.6) * (step(2.4, au) + step(av, 0.45)))); }
				}
				paint *= 0.85 + 0.15 * smoothstep(0.3, 0.7, mn(vec3(w * 3.0, 5.0)));
				diffuseColor.rgb = mix(c, pc * (0.8 + 0.2 * n), clamp(paint, 0.0, 1.0));
				}
			}`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.9;');
	};
	m.customProgramCacheKey = () => 'mil-asphalt-4';
	return m;
}

// corrugated sheet: ridges along the geometry's v (the sheet's run), light through the ridges
function corrugated() {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.22, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.vertexShader = 'varying vec3 vCw; varying vec3 vCn;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCw = position; vCn = normal;');
		sh.fragmentShader = 'varying vec3 vCw; varying vec3 vCn;\n' + NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{ vec3 n = normalize(vCn); float t = abs(n.x) > 0.5 ? vCw.z : vCw.x;
			  // (the ridges fade where they would be finer than a pixel, instead of shimmering)
			  float r = sin(t * 41.9) * (1.0 - smoothstep(0.25, 0.8, fwidth(t) * 6.67)); diffuseColor.rgb *= 0.86 + 0.14 * r;
			  float rust = smoothstep(0.62, 0.75, mn(vCw * 1.3) * 0.7 + mn(vCw * 7.0) * 0.3) * (1.0 - smoothstep(0.0, 3.0, vCw.y) * 0.5);
			  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.24, 0.12), rust * 0.45);
			  diffuseColor.rgb *= 0.9 + 0.1 * mn(vec3(vCw.xz * 0.2, vCw.y));
			}`);
	};
	m.customProgramCacheKey = () => 'mil-corrugated-2';
	return m;
}
// chain-link: a diamond mesh cut out of a strip, posts and wire drawn as geometry
function chainlink() {
	const S = 64, cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	let tex = null;
	if (cv) {
		cv.width = cv.height = S;
		const g = cv.getContext('2d');
		g.clearRect(0, 0, S, S); g.strokeStyle = 'rgba(190,195,198,1)'; g.lineWidth = 3;
		g.beginPath(); g.moveTo(0, 0); g.lineTo(S, S); g.moveTo(S, 0); g.lineTo(0, S); g.moveTo(-S / 2, S / 2); g.lineTo(S / 2, -S / 2); g.moveTo(S / 2, S + S / 2); g.lineTo(S + S / 2, S / 2); g.stroke();
		tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10); tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
	}
	return new THREE.MeshStandardMaterial({ color: 0xc9ccce, map: tex, alphaMap: tex, alphaTest: 0.35, transparent: false, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
}
// lamps: lit only at night (window cabs, floodlights, runway edge lights, beacons)
function lamps(night) {
	const m = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3, vertexColors: true });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uNight = night;
		sh.fragmentShader = 'uniform float uNight;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * (0.2 + uNight * 6.0);');
	};
	m.customProgramCacheKey = () => 'mil-lamp-1';
	return m;
}

// the pools of light under the floodlights and lamps, and their beams: additive, lit only at
// night (strip.x: 0 a pool, its uv round from the middle; 1 a beam, its uv up the cone)
function glowMat(night) {
	return new THREE.ShaderMaterial({
		uniforms: { uNight: night },
		vertexShader: 'attribute vec3 color; attribute vec3 strip; varying vec3 vC; varying vec2 vU; varying float vM; void main(){ vC = color; vU = uv; vM = strip.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: 'uniform float uNight; varying vec3 vC; varying vec2 vU; varying float vM; void main(){ float a; if (vM < 0.5) { float r = length(vU - 0.5) * 2.0; a = pow(max(0.0, 1.0 - r), 1.8) * 0.85; } else { float e = sin(vU.x * 6.2832); a = pow(vU.y, 2.2) * 0.1 * (0.55 + 0.45 * e * e); } gl_FragColor = vec4(vC * a * uNight, 1.0); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
	});
}
// the halo round each light, seen from far off: a soft point sized to the distance (never less
// than a dot); blink: 0 steady, else flashes (whole part the rate a second, the fraction its phase)
function haloMat(night, time) {
	return new THREE.ShaderMaterial({
		uniforms: { uNight: night, uTime: time },
		vertexShader: 'attribute vec3 color; attribute float size; attribute float blink; uniform float uNight; uniform float uTime; varying vec3 vC; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = max(1.0, -mv.z); float rate = floor(blink), ph = fract(blink); float on = blink > 0.0 ? step(0.72, fract(uTime * max(rate, 0.5) + ph)) : 1.0; gl_PointSize = clamp(size * 650.0 / d, 2.0, 40.0); vC = color; vA = uNight * on * clamp(1.5 - d / 3000.0, 0.35, 1.0); }',
		fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 2.0) * 0.7 + (1.0 - smoothstep(0.0, 0.3, r)) * 0.6; gl_FragColor = vec4(vC * a * vA, 1.0); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
}
// the bases' flags: three original emblems on one cloth (one a row), waving in the wind
function flagMat(time) {
	let map = null;
	if (typeof document !== 'undefined') {
		const W = 256, Hh = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh * 3;
		const g = cv.getContext('2d');
		const star = (cx, cy, r0, r1, n, rot = 0) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r1 : r0; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); };
		// the base's own: olive, a gold ring round a dark disc, a white eight-pointed star, two gold bars
		g.fillStyle = '#4b5534'; g.fillRect(0, 0, W, Hh);
		g.fillStyle = '#c9a845'; g.beginPath(); g.arc(W / 2, Hh / 2, 54, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#1d2117'; g.beginPath(); g.arc(W / 2, Hh / 2, 47, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#f2f0e6'; star(W / 2, Hh / 2, 40, 15, 8, -Math.PI / 2);
		g.fillStyle = '#5d7a3c'; g.beginPath(); g.arc(W / 2, Hh / 2, 9, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#c9a845'; g.fillRect(20, Hh - 34, W - 40, 7); g.fillRect(20, Hh - 22, W - 40, 7);
		// sand with a dark green diagonal and a white lozenge
		g.fillStyle = '#c4b28a'; g.fillRect(0, Hh, W, Hh);
		g.fillStyle = '#2f4a2a'; g.beginPath(); g.moveTo(0, Hh * 2); g.lineTo(60, Hh * 2); g.lineTo(W, Hh + 40); g.lineTo(W, Hh); g.lineTo(W - 60, Hh); g.lineTo(0, Hh * 2 - 40); g.closePath(); g.fill();
		g.fillStyle = '#f2f0e6'; g.beginPath(); g.moveTo(W / 2, Hh + 40); g.lineTo(W / 2 + 34, Hh * 1.5); g.lineTo(W / 2, Hh * 2 - 40); g.lineTo(W / 2 - 34, Hh * 1.5); g.closePath(); g.fill();
		// deep blue with a white ring and three gold chevrons
		g.fillStyle = '#1f2f4e'; g.fillRect(0, Hh * 2, W, Hh);
		g.strokeStyle = '#f2f0e6'; g.lineWidth = 8; g.beginPath(); g.arc(W / 2, Hh * 2.5, 44, 0, Math.PI * 2); g.stroke();
		g.strokeStyle = '#d4b04a'; g.lineWidth = 9;
		for (let i = 0; i < 3; i++) { const y = Hh * 2.5 - 14 + i * 14; g.beginPath(); g.moveTo(W / 2 - 26, y + 12); g.lineTo(W / 2, y - 6); g.lineTo(W / 2 + 26, y + 12); g.stroke(); }
		map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
	}
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: 0.9, side: THREE.DoubleSide });
	m.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = time;
		// (uv.x runs from the hoist to the fly; the wave grows toward the fly)
		sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fl = uv.x; transformed.z += sin(fl * 7.0 - uTime * 5.0 + position.x * 0.2) * 0.2 * fl; transformed.y -= fl * fl * 0.12; transformed.x -= abs(sin(fl * 3.0 - uTime * 2.0)) * 0.08 * fl;');
	};
	m.customProgramCacheKey = () => 'mil-flag-1';
	return m;
}

let K = null;
// the shared kit (made once)
export function militaryKit() {
	if (K) return K;
	const night = { value: 0 };
	const concrete = weatherStucco(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, vertexColors: true }));
	usePhoto(concrete, [['plaster', 3, { mean: 0.72, contrast: 0.6 }, 0.5]]);
	const time = { value: 0 };
	// (the blur discs: one material, a geometry per radius)
	const discs = new Map();
	K = {
		night, time,
		vehicle: vehicle(night, time), vehicleLit: vehicle(night, time, { lit: true }), vehicleBurnt: vehicle(night, time, { burnt: true }),
		flame: flame('#9fc4ff', '#ff9a4a', 0.55), flameAB: flame('#ffb26a', '#ff5a2a', 1.2),
		flameGeo: new THREE.CylinderGeometry(0.16, 0.4, 2.4, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -1.2),
		glow: glowMat(night), halo: haloMat(night, time), flag: flagMat(time),
		disc: blurDisc(time), discGeo: (r) => { if (!discs.has(r)) discs.set(r, new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2)); return discs.get(r); },
		camo: armour(true, night), air: armour(false, night),
		dark: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, vertexColors: true }),
		rubber: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true }),
		glass: new THREE.MeshStandardMaterial({ color: 0x1d2a30, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.2 }),
		concrete, asphalt: asphalt(), metal: Object.assign(corrugated(), { side: THREE.DoubleSide }), fence: chainlink(), lamp: lamps(night),
		paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, vertexColors: true }),
		canvas: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, vertexColors: true, side: THREE.DoubleSide }),
	};
	for (const m of Object.values(K)) if (m?.isMaterial) m.userData.shared = true;
	return K;
}

// ---------- the builder ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
// (one unit box, scaled to each: building thousands of boxes is the slow part of a base)
let unitBox = null;
const UNIT_BOX = () => unitBox || (unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed());
export function builder() {
	const by = new Map();
	// add a geometry under a material name, placed (x, y, z, yaw, pitch, roll, scale) and tinted
	function add(mat, g, x = 0, y = 0, z = 0, yaw = 0, col = '#ffffff', pitch = 0, roll = 0, strip = null, scale = null) {
		let geo = g.index ? g.toNonIndexed() : g;
		if (geo === g) geo = g.clone();
		for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a);
		if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
		geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), scale ? _s.set(scale[0], scale[1], scale[2]) : _s.set(1, 1, 1)));
		// (walls and roofs: uv in metres on the face's own plane, for the photographic detail)
		if (!strip) {
			const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
			for (let i = 0; i < P.count; i++) { const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)); U.setXY(i, ny > 0.7 ? P.getX(i) : nx > nz ? P.getZ(i) : P.getX(i), ny > 0.7 ? P.getZ(i) : P.getY(i)); }
		}
		const n = geo.attributes.position.count, cs = new Float32Array(n * 3), st = new Float32Array(n * 3);
		_c.set(col);
		for (let i = 0; i < n; i++) { cs[i * 3] = _c.r; cs[i * 3 + 1] = _c.g; cs[i * 3 + 2] = _c.b; if (strip) { st[i * 3] = strip[0]; st[i * 3 + 1] = strip[1]; st[i * 3 + 2] = strip[2]; } }
		geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
		geo.setAttribute('strip', new THREE.BufferAttribute(st, 3));
		if (!by.has(mat)) by.set(mat, []);
		by.get(mat).push(geo);
		return geo;
	}
	const api = {
		add,
		box: (mat, w, h, d, x, y, z, yaw = 0, col, pitch = 0, roll = 0) => add(mat, UNIT_BOX(), x, y + h / 2, z, yaw, col, pitch, roll, null, [w, h, d]),
		// a box whose centre is at y (not its foot)
		cbox: (mat, w, h, d, x, y, z, yaw = 0, col, pitch = 0, roll = 0) => add(mat, UNIT_BOX(), x, y, z, yaw, col, pitch, roll, null, [w, h, d]),
		cyl: (mat, r0, r1, h, x, y, z, seg = 12, col, pitch = 0, roll = 0, yaw = 0) => add(mat, new THREE.CylinderGeometry(r0, r1, h, seg), x, y, z, yaw, col, pitch, roll),
		// a flat strip on the ground with uv in metres from its middle (asphalt markings)
		strip: (mat, L, H, x, y, z, yaw, col, kind) => { const g = new THREE.PlaneGeometry(L, H, Math.max(1, Math.ceil(L / 40)), 1).rotateX(-Math.PI / 2); const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i)); return add(mat, g, x, y, z, yaw, col, 0, 0, [L, H, kind]); },
		// an extruded profile (x, y points), d deep along z
		extrude: (mat, pts, d, x, y, z, yaw = 0, col, bevel = 0) => { const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, -d / 2); return add(mat, g, x, y, z, yaw, col); },
		lathe: (mat, pts, seg, x, y, z, col, pitch = 0, yaw = 0, roll = 0) => add(mat, new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), x, y, z, yaw, col, pitch, roll),
		has: (mat) => by.has(mat),
		// one merged geometry per material
		geometries() {
			const out = {};
			for (const [mat, gs] of by) { const g = gs.length > 1 ? mergeGeometries(gs) : gs[0]; g.computeBoundingSphere(); g.computeBoundingBox(); out[mat] = g; for (const q of gs) if (q !== g) q.dispose(); }
			by.clear();
			return out;
		},
		// meshes in a group, one per material
		meshes(kit, group = new THREE.Group(), shadows = true) {
			for (const [mat, g] of Object.entries(api.geometries())) {
				const m = new THREE.Mesh(g, kit[mat]);
				m.castShadow = shadows && mat !== 'asphalt' && mat !== 'lamp'; m.receiveShadow = true; m.name = 'mil-' + mat;
				group.add(m);
			}
			return group;
		},
	};
	return api;
}
