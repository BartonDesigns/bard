// The colony's materials. Nearly everything is one lit material, its look chosen per
// vertex by aGlow (the kit's attribute), so a whole site is one or two draw calls:
//   0 hull: painted plates, the joints dark
//   1 printed regolith: layered strata, as a printer lays it down
//   2 windows: a grid of panes, dark glass by day, lit (most of them) by night
//   3 regolith: berms and spoil, grainy
//   4 solar cells: blue-black cells in a fine grid, a sheen toward the sun
//   5 self-lit: lamps, grow lights, a rover's headlights
//   6 running lights: blinking, each to its own beat
//   7 coolant: a glow running along the pipe
// Small shader, no loops: phones and Apple GPUs run it as they do the rest.

import * as THREE from 'three';

const HEAD_V = /* glsl */`
attribute float aGlow;
varying vec3 vCW;
varying vec3 vCN;
varying float vCG;
`;
const HEAD_F = /* glsl */`
uniform float uTime, uNight, uLampK;
uniform vec3 uWinC;
varying vec3 vCW;
varying vec3 vCN;
varying float vCG;
float cH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cEm = 0.0;
vec3 cEmC = vec3(0.0);
`;
const LOOK = /* glsl */`
	vec3 cn = normalize(vCN), ca = abs(cn);
	vec2 fp = ca.y > 0.8 ? vCW.xz : (ca.x > ca.z ? vCW.zy : vCW.xy);
	float cFar = smoothstep(90.0, 420.0, length(cameraPosition - vCW));
	vec3 cCol = diffuseColor.rgb;
	if (vCG < 0.5) {
		vec2 q = fp * vec2(0.55, 0.9);
		vec2 e = abs(fract(q) - 0.5);
		cCol *= 0.93 + 0.1 * cH(vec3(floor(q), 3.0));
		cCol *= 0.7 + 0.3 * smoothstep(0.496, 0.47, max(e.x, e.y));
	} else if (vCG < 1.5) {
		float y = vCW.y + sin(fp.x * 0.35) * 0.08 + sin(fp.x * 1.7 + vCW.y) * 0.02;
		float lay = fract(y * 5.5);
		cCol *= 0.8 + 0.2 * smoothstep(0.0, 0.25, lay) * smoothstep(1.0, 0.7, lay);
		cCol *= 0.92 + 0.1 * cH(vec3(floor(y * 5.5), 0.0, 1.0));
	} else if (vCG < 2.5) {
		vec2 q = vec2(fp.x / 2.2, fp.y / 2.6);
		vec2 f = fract(q), id = floor(q);
		float pane = step(0.18, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.72);
		float lit = step(0.3, cH(vec3(id, 5.0)));
		cCol = mix(cCol, vec3(0.05, 0.07, 0.09), pane * (1.0 - cFar * 0.6));
		cEm = pane * lit * (0.08 + uNight * 1.6) * (0.75 + 0.5 * cH(vec3(id, 9.0)));
		cEmC = uWinC;
	} else if (vCG < 3.5) {
		cCol *= 0.82 + 0.3 * cH(floor(vCW * 2.5)) * (1.0 - cFar);
	} else if (vCG < 4.5) {
		vec2 q = fp * vec2(1.6, 1.6);
		vec2 e = abs(fract(q) - 0.5);
		cCol = mix(vec3(0.75, 0.78, 0.82), vec3(0.03, 0.05, 0.11), smoothstep(0.49, 0.45, max(e.x, e.y)) * (1.0 - cFar * 0.7));
	} else if (vCG < 5.5) {
		cEm = uLampK; cEmC = cCol; cCol *= 0.3;
	} else if (vCG < 6.5) {
		float ph = cH(floor(vCW * 0.25)) * 6.2831;
		float b = smoothstep(0.82, 0.9, sin(uTime * 2.4 + ph));
		cEm = (0.15 + b * 2.5) * uLampK; cEmC = cCol; cCol *= 0.25;
	} else {
		float f = 0.55 + 0.45 * sin(dot(vCW, vec3(0.7, 0.2, 0.5)) * 0.6 - uTime * 2.2);
		cEm = f * (0.6 + uNight * 0.9); cEmC = cCol; cCol *= 0.3;
	}
	diffuseColor.rgb = cCol;
`;

// a kit material: lit, coloured per vertex, its look per vertex by aGlow
export function shellMaterial(U, o = {}) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: o.rough ?? 0.78, metalness: o.metal ?? 0.05 });
	if (o.env) m.envMap = o.env;
	m.envMapIntensity = 0.35;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = HEAD_V + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vec4 cw = vec4(transformed, 1.0);
			#ifdef USE_INSTANCING
				cw = instanceMatrix * cw;
			#endif
			vCW = (modelMatrix * cw).xyz;
			vCN = normalize(mat3(modelMatrix) * objectNormal);
			vCG = aGlow;`);
		sh.fragmentShader = HEAD_F + sh.fragmentShader
			.replace('#include <color_fragment>', '#include <color_fragment>\n' + LOOK)
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += cEmC * cEm;');
	};
	m.customProgramCacheKey = () => 'colonyshell';
	return m;
}
// the pressure glass: a dark, clear skin that takes the sky, warm from within by night
export function glassMaterial(o = {}) {
	return new THREE.MeshStandardMaterial({ color: new THREE.Color(...(o.color || [0.5, 0.65, 0.8])), transparent: true, opacity: 0.32, roughness: 0.06, metalness: 0.7, depthWrite: false, side: THREE.DoubleSide, envMap: o.env || null, emissive: new THREE.Color(0, 0, 0) });
}
// light on the ground round the lamps at night: soft additive discs
export function poolMaterial(U) {
	return new THREE.ShaderMaterial({
		uniforms: { uNight: U.uNight },
		vertexShader: 'attribute vec3 color; varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: 'uniform float uNight; varying vec2 vUv; varying vec3 vC; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2); gl_FragColor = vec4(vC * a * uNight * 0.55, 1.0); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
	});
}
// the shared uniforms (colony.js sets them each frame)
export function colonyUniforms(shared, S) {
	return { uTime: shared.uTime, uNight: { value: 0 }, uLampK: { value: 1 }, uWinC: { value: new THREE.Color(...S.window) } };
}
