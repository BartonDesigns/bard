// The cliff settlements' materials. Nearly all of it is one lit material, its look chosen
// per vertex by aGlow (the kit's attribute), so a house is a draw call or two:
//   0 white concrete: board-formed, a fine grain, a little weathering low down
//   1 glazing: dark glass that takes the sky, its mullions, panes lit by dusk and night in
//     warm white, pink or violet (the towers' grids)
//   2 rock: strata and grain in the world's own stone (the collars where the works meet the cliff)
//   3 timber: soffits and decks in warm slats
//   4 planted: the green roofs and planters, a mottle of growth
//   5 self-lit: lamps, the light strips under the decks
//   6 beacons: blinking on the towers' crowns and the craft
//   7 water: the pools on the decks, a ripple and a glint
//   8 metal: the trims and the struts' caps
// Small shader, no loops: phones and Apple GPUs run it as they do the rest.

import * as THREE from 'three';

const HEAD_V = /* glsl */`
attribute float aGlow;
varying vec3 vAW;
varying vec3 vAN;
varying float vAG;
`;
const HEAD_F = /* glsl */`
uniform float uTime, uNight, uLampK;
uniform vec3 uWinC, uWinB, uWinV;
varying vec3 vAW;
varying vec3 vAN;
varying float vAG;
float aH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float aN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(aH(vec3(i, 0.0)), aH(vec3(i + vec2(1.0, 0.0), 0.0)), f.x), mix(aH(vec3(i + vec2(0.0, 1.0), 0.0)), aH(vec3(i + vec2(1.0, 1.0), 0.0)), f.x), f.y); }
float aEm = 0.0, aRough = 0.8, aMetal = 0.0;
vec3 aEmC = vec3(0.0);
`;
const LOOK = /* glsl */`
	vec3 an = normalize(vAN), aa = abs(an);
	vec2 fp = aa.y > 0.8 ? vAW.xz : (aa.x > aa.z ? vAW.zy : vAW.xy);
	float aFar = smoothstep(80.0, 400.0, length(cameraPosition - vAW));
	vec3 aCol = diffuseColor.rgb;
	if (vAG < 0.5) {
		float board = smoothstep(0.46, 0.5, abs(fract(vAW.y * 2.6) - 0.5)) * (1.0 - aFar) * (1.0 - step(0.8, aa.y));
		aCol *= (0.95 + 0.06 * aN(fp * 1.7)) * (1.0 - board * 0.05);
		aRough = 0.72;
	} else if (vAG < 1.5) {
		vec2 q = vec2(fp.x / 1.8, fp.y / 3.5);
		vec2 f = fract(q), id = floor(q);
		float mull = 1.0 - step(0.1, f.x) * step(f.x, 0.9) * step(0.14, f.y) * step(f.y, 0.86);
		float lit = step(0.45, aH(vec3(id, 7.0))), hue = aH(vec3(id, 11.0));
		aCol = mix(aCol * 0.25, aCol * 1.4 + 0.02, mull * (1.0 - aFar * 0.8));
		aRough = mix(0.3, 0.5, mull); aMetal = mix(0.15, 0.3, mull);
		aEm = (1.0 - mull) * lit * uNight * 2.4 * (0.4 + 0.9 * aH(vec3(id, 3.0)));
		aEmC = hue < 0.5 ? uWinC : hue < 0.78 ? uWinB : uWinV;
		// far off, the grid is finer than a pixel: its average glow, not a shimmer
		float aAvg = smoothstep(350.0, 900.0, length(cameraPosition - vAW));
		aEm = mix(aEm, 0.45 * uNight * 2.0, aAvg);
		aEmC = mix(aEmC, uWinC * 0.5 + uWinB * 0.3 + uWinV * 0.2, aAvg);
	} else if (vAG < 2.5) {
		float y = vAW.y + aN(fp * 0.25) * 2.0;
		float lay = fract(y * 0.7);
		aCol *= (0.78 + 0.22 * smoothstep(0.0, 0.2, lay) * smoothstep(1.0, 0.75, lay)) * (0.82 + 0.3 * aN(fp * 1.3) * (1.0 - aFar));
		aRough = 0.92;
	} else if (vAG < 3.5) {
		float sl = fract(fp.x * 6.0);
		aCol *= (0.86 + 0.14 * smoothstep(0.0, 0.1, sl) * smoothstep(1.0, 0.85, sl)) * (0.9 + 0.15 * aH(vec3(floor(fp.x * 6.0), 1.0, 2.0)));
		aRough = 0.6;
	} else if (vAG < 4.5) {
		float m = aN(vAW.xz * 0.9) * 0.6 + aN(vAW.xz * 3.1) * 0.4;
		aCol *= 0.7 + 0.6 * m;
		aRough = 0.95;
	} else if (vAG < 5.5) {
		aEm = uLampK * 1.6; aEmC = aCol; aCol *= 0.3;
	} else if (vAG < 6.5) {
		float ph = aH(floor(vAW * 0.2)) * 6.2831;
		float b = smoothstep(0.8, 0.9, sin(uTime * 2.2 + ph));
		aEm = (0.2 + b * 3.0) * uLampK; aEmC = aCol; aCol *= 0.25;
	} else if (vAG < 7.5) {
		float w = sin(vAW.x * 1.3 + uTime * 1.1) * sin(vAW.z * 1.1 - uTime * 0.9);
		aCol *= 0.85 + 0.15 * w;
		aRough = 0.04; aMetal = 0.2;
		aEm = uNight * 0.35; aEmC = aCol * 1.6;
	} else {
		aRough = 0.32; aMetal = 0.85;
	}
	diffuseColor.rgb = aCol;
`;

// a kit material: lit, coloured per vertex, its look per vertex by aGlow
export function archMaterial(U, o = {}) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.8, metalness: 0 });
	if (o.env) m.envMap = o.env;
	m.envMapIntensity = 0.7;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = HEAD_V + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vec4 aw = vec4(transformed, 1.0);
			#ifdef USE_INSTANCING
				aw = instanceMatrix * aw;
			#endif
			vAW = (modelMatrix * aw).xyz;
			vAN = normalize(mat3(modelMatrix) * objectNormal);
			vAG = aGlow;`);
		sh.fragmentShader = HEAD_F + sh.fragmentShader
			.replace('#include <color_fragment>', '#include <color_fragment>\n' + LOOK)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = aRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = aMetal;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += aEmC * aEm;');
	};
	m.customProgramCacheKey = () => 'archshell';
	return m;
}
// the balustrades' glass: clear, a little green at the edges, taking the sky
export function railGlass(o = {}) {
	return new THREE.MeshStandardMaterial({ color: new THREE.Color(0.62, 0.72, 0.72), transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.6, depthWrite: false, side: THREE.DoubleSide, envMap: o.env || null });
}
// where the works meet the ground: a soft darkening, multiplied in (no pad, no edge)
export function contactMaterial() {
	return new THREE.ShaderMaterial({
		vertexShader: 'attribute float aK; varying float vK; varying float vD; void main(){ vK = aK; vec4 w = modelMatrix * vec4(position, 1.0); vD = length(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
		fragmentShader: 'varying float vK; varying float vD; void main(){ float k = vK * (1.0 - smoothstep(250.0, 700.0, vD)); gl_FragColor = vec4(vec3(1.0 - k), 1.0); }',
		transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
		polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
	});
}
export function archUniforms(shared, S) {
	return { uTime: shared.uTime, uNight: { value: 0 }, uLampK: { value: 1 }, uWinC: { value: new THREE.Color(...S.window) }, uWinB: { value: new THREE.Color(...S.winB) }, uWinV: { value: new THREE.Color(...S.winV) } };
}

// ---------- the interiors ----------
// One lit material for the rooms (furnish.js), its look per vertex by aGlow, the room's light
// baked into aLit (the chandeliers', the lamps', the glow's: no real lights) and added as the
// surface's own glow:
//   0 plaster, panelled    1 polished stone in great tiles, brass inlaid    2 terrazzo
//   3 brass                4 dark lacquer                                   5 velvet
//   6 self-lit (lamps, light sculptures, strips)                            7 water
//   8 glowing plants       9 books on their shelves                         10 a dome of stars
//   11 leaves, unlit
const IN_V = /* glsl */`
attribute float aGlow;
attribute vec3 aLit;
varying vec3 vIW;
varying vec3 vIN;
varying float vIG;
varying vec3 vIL;
`;
const IN_F = /* glsl */`
uniform float uTime;
uniform vec3 uBrass;
varying vec3 vIW;
varying vec3 vIN;
varying float vIG;
varying vec3 vIL;
float iH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float iN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(iH(vec3(i, 0.0)), iH(vec3(i + vec2(1.0, 0.0), 0.0)), f.x), mix(iH(vec3(i + vec2(0.0, 1.0), 0.0)), iH(vec3(i + vec2(1.0, 1.0), 0.0)), f.x), f.y); }
float iEm = 0.0, iRough = 0.8, iMetal = 0.0;
`;
const IN_LOOK = /* glsl */`
	vec3 inn = normalize(vIN), ia = abs(inn);
	vec2 ip = ia.y > 0.7 ? vIW.xz : (ia.x > ia.z ? vIW.zy : vIW.xy);
	vec3 ic = diffuseColor.rgb;
	if (vIG < 0.5) {
		float pn = smoothstep(0.47, 0.5, abs(fract(ip.x / 2.4) - 0.5)) * (1.0 - step(0.7, ia.y));
		ic *= (0.94 + 0.08 * iN(ip * 0.8)) * (1.0 - pn * 0.25);
		iRough = 0.8;
	} else if (vIG < 1.5) {
		vec2 t = ip / 3.0, f = fract(t);
		float vein = smoothstep(0.93, 1.0, 1.0 - abs(sin((ip.x * 0.6 + ip.y * 0.35 + iN(ip * 0.4) * 3.5) * 1.4)));
		float inlay = 1.0 - step(0.012, f.x) * step(f.x, 0.988) * step(0.012, f.y) * step(f.y, 0.988);
		ic = mix(ic * (0.88 + 0.16 * iH(vec3(floor(t), 1.0))) * (1.0 - vein * 0.4) + vein * 0.06, uBrass * 0.8, inlay);
		iRough = mix(0.1, 0.3, inlay); iMetal = inlay;
	} else if (vIG < 2.5) {
		float ch = step(0.78, iH(vec3(floor(ip * 11.0), 2.0)));
		ic = mix(ic * (0.95 + 0.05 * iN(ip * 3.0)), ic * 0.45 + vec3(0.22, 0.16, 0.2) * iH(vec3(floor(ip * 11.0), 5.0)), ch);
		iRough = 0.22;
	} else if (vIG < 3.5) {
		ic *= 0.9 + 0.1 * iN(ip * 6.0); iRough = 0.26; iMetal = 1.0;
	} else if (vIG < 4.5) {
		iRough = 0.08;
	} else if (vIG < 5.5) {
		float fr = 1.0 - abs(dot(inn, normalize(cameraPosition - vIW)));
		ic *= 0.65 + 0.9 * fr * fr; iRough = 1.0;
	} else if (vIG < 6.5) {
		iEm = 1.6;
	} else if (vIG < 7.5) {
		float w = sin(vIW.x * 2.1 + uTime * 0.9) * sin(vIW.z * 1.7 - uTime * 0.7);
		ic *= 0.8 + 0.2 * w; iRough = 0.03; iMetal = 0.3; iEm = 0.25;
	} else if (vIG < 8.5) {
		iEm = 0.55 + 0.35 * sin(uTime * 0.8 + iH(floor(vIW * 0.5)) * 6.28);
	} else if (vIG < 9.5) {
		float row = floor(ip.y / 0.42), u = ip.x * 13.0 + row * 7.31, id = floor(u);
		float hb = 0.26 + 0.12 * iH(vec3(id, row, 3.0)), up = fract(ip.y / 0.42) * 0.42;
		vec3 bk = mix(mix(vec3(0.32, 0.05, 0.08), vec3(0.06, 0.12, 0.22), step(0.35, iH(vec3(id, row, 1.0)))), vec3(0.5, 0.36, 0.18), step(0.75, iH(vec3(id, row, 2.0))));
		float gap = step(hb, up) + (1.0 - step(0.06, fract(u)));
		ic = mix(bk * (0.8 + 0.4 * iH(vec3(id, row, 4.0))), ic * 0.25, clamp(gap, 0.0, 1.0));
		iRough = 0.7;
	} else if (vIG < 10.5) {
		vec3 sc = floor(vIW * 4.0);
		float st = step(0.965, iH(sc)) * (0.6 + 0.4 * sin(uTime * 1.3 + iH(sc + 1.0) * 6.28)) * smoothstep(0.5, 0.2, length(fract(vIW * 4.0) - 0.5));
		ic = vec3(0.004, 0.003, 0.012);
		iEm = 1.0; iRough = 1.0;
		ic += vec3(0.9, 0.85, 1.0) * st * 6.0;
	} else {
		ic *= 0.8 + 0.3 * iN(ip * 2.0); iRough = 0.9;
	}
	diffuseColor.rgb = ic;
`;
export function interiorMaterial(U, o = {}) {
	const m = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.8, metalness: 0 });
	if (o.env) m.envMap = o.env;
	m.envMapIntensity = 0.2;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = IN_V + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vec4 iw = vec4(transformed, 1.0);
			vec3 inrm = objectNormal;
			#ifdef USE_INSTANCING
				iw = instanceMatrix * iw;
				inrm = mat3(instanceMatrix) * inrm;
			#endif
			vIW = (modelMatrix * iw).xyz;
			vIN = normalize(mat3(modelMatrix) * inrm);
			vIG = aGlow; vIL = aLit;`);
		sh.fragmentShader = IN_F + sh.fragmentShader
			.replace('#include <color_fragment>', '#include <color_fragment>\n' + IN_LOOK)
			.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = iRough;')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n\tmetalnessFactor = iMetal;')
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * (vIL * (1.0 - iMetal * 0.6) + iEm);')
			// (the day outside reaches in only a little: the rooms are lit by their own light)
			.replace('#include <aomap_fragment>', '#include <aomap_fragment>\n\treflectedLight.directDiffuse *= 0.08; reflectedLight.indirectDiffuse *= 0.12; reflectedLight.directSpecular *= 0.3; reflectedLight.indirectSpecular *= 0.5;');
	};
	m.customProgramCacheKey = () => 'archinterior';
	return m;
}
// the rooms' window glass: nearly clear, a little of the sky in it
export function paneGlass(o = {}) {
	return new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.5, 0.62), transparent: true, opacity: 0.13, roughness: 0.04, metalness: 0.7, depthWrite: false, side: THREE.DoubleSide, envMap: o.env || null, envMapIntensity: 0.6 });
}
