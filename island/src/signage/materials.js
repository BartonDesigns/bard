// What the decals are made of, each answering light in its own way, apart from the surface
// it is stuck to:
//   retro   prismatic sheeting on road signs and plates: an ordinary matte face by day, and
//           at night it sends the headlights' light straight back to the driver (the camera),
//           bright in the beam, dark outside it
//   vinyl   glossy printed or cut vinyl: a tight highlight over matte brick or painted metal
//   glass   cut vinyl on a window: seen from both sides, mirrored from inside (the adhesive
//           side duller), frosted film translucent white, a little of the room's light through
//           it at night
//   paper   matte posters and flyers: no sheen, the corner peeling where the paste let go,
//           yellowed and holed with age
//   foil    gold leaf and metallic labels: metal that catches the light
//   paint   spray paint, its overspray soft, the wall's own grain showing through
//   grime   no texture: rust, soot, water and gum worked out in the shader (bay/weathering.js)
// Every one reads its graphic from the atlas through the instance's cell (aCell), and its
// back, seed, wear and extra flag from aFx; writes no depth and is biased toward the eye by
// its layer (layers.js), so it never fights its host or the decal under it. Distant decals
// fade out before they would shimmer.

import * as THREE from 'three';
import { layerBias } from './layers.js';
import { WALL_GLSL, GRIME_GLSL } from '../bay/weathering.js';

// shared by every signage material: the headlights (xyz where, w how strong), which way
// they point, how dark it is, the daylight for the foil
export const SIGN_U = {
	uSgHead: { value: new THREE.Vector4(0, -1e5, 0, 0) },
	uSgHeadDir: { value: new THREE.Vector3(0, 0, -1) },
	uSgNight: { value: 0 },
	uSgDay: { value: 1 },
	uSgTime: { value: 0 },
};
const SPEC = {
	retro: { roughness: 0.42, metalness: 0.0, far: 420 },
	cloth: { roughness: 0.98, metalness: 0.0, far: 160 },
	vinyl: { roughness: 0.28, metalness: 0.0, far: 140 },
	glass: { roughness: 0.22, metalness: 0.0, far: 90 },
	paper: { roughness: 0.96, metalness: 0.0, far: 140 },
	foil: { roughness: 0.3, metalness: 0.75, far: 90 },
	paint: { roughness: 0.72, metalness: 0.0, far: 320 },
	grime: { roughness: 0.9, metalness: 0.0, far: 160 },
};
const COMMON_V = /* glsl */`
uniform float uSgTime;
attribute vec4 aCell;
attribute vec4 aFx;
varying vec2 vSgUv; varying vec4 vSgCell; varying vec4 vSgFx; varying vec3 vSgW; varying vec3 vSgN;
`;
const COMMON_F = /* glsl */`
uniform vec4 uSgHead; uniform vec3 uSgHeadDir; uniform float uSgNight; uniform float uSgDay; uniform float uSgFar;
varying vec2 vSgUv; varying vec4 vSgCell; varying vec4 vSgFx; varying vec3 vSgW; varying vec3 vSgN;
float sgH(vec2 p) { return fract(sin(dot(mod(p, 289.0), vec2(127.1, 311.7))) * 43758.5453); }
float sgN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sgH(i), sgH(i + vec2(1, 0)), f.x), mix(sgH(i + vec2(0, 1)), sgH(i + vec2(1, 1)), f.x), f.y); }
`;

// the decal's own look, after the map: alpha, back, wear, the material's quirks
function fragBody(kind) {
	return /* glsl */`
	vec2 sgUv = vSgUv;
	float sgMode = floor(vSgFx.x + 0.5), sgSeed = vSgFx.y, sgWear = vSgFx.z, sgExtra = vSgFx.w;
	bool sgBack = !gl_FrontFacing;
	if (sgBack && sgMode > 2.5) discard;
	if (sgBack && sgMode > 0.5 && sgMode < 1.5) sgUv.x = 1.0 - sgUv.x;
	${kind === 'grime' ? `
	vec4 sgTex = grimeDecal(sgUv, sgExtra, sgSeed * 37.0);
	diffuseColor = vec4(sgTex.rgb, sgTex.a * (0.55 + 0.45 * sgWear));
	` : `
	vec4 sgTex = texture2D(map, vSgCell.xy + clamp(sgUv, 0.0, 1.0) * vSgCell.zw);
	diffuseColor.rgb *= sgTex.rgb; diffuseColor.a *= sgTex.a;
	// wear: the colour chalked toward its grey, small losses where it has been scraped
	if (sgWear > 0.01) {
		float l = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
		diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * 1.05 + 0.04, sgWear * 0.45);
		float n = sgN(sgUv * vec2(28.0, 28.0 * vSgCell.w / max(vSgCell.z, 1e-4) ) + sgSeed * 91.0) * 0.7 + sgN(sgUv * 90.0 + sgSeed * 13.0) * 0.3;
		diffuseColor.a *= 1.0 - smoothstep(1.0 - sgWear * 0.45, 1.05 - sgWear * 0.45, n);
	}
	`}
	${kind === 'retro' ? `
	// the blank's back: bare aluminium in the same shape
	if (sgBack && sgMode < 0.5) diffuseColor.rgb = vec3(0.5, 0.51, 0.52) * (0.85 + 0.15 * sgN(sgUv * 6.0 + sgSeed));
	` : ''}
	${kind === 'glass' ? `
	// frosted film: translucent white wherever the cut is
	if (sgExtra > 0.5) diffuseColor = vec4(vec3(0.92), diffuseColor.a * 0.55);
	// from inside: the adhesive side, paler and duller
	if (sgBack && sgMode > 1.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86), 0.35) * 0.9;
	diffuseColor.a *= 0.94;
	` : ''}
	${kind === 'paper' ? `
	// a corner peeling: cut away past the fold, the paper's pale back curled over beside it
	{
		float pk = sgWear * 0.32;
		vec2 c = sgUv; float q = sgH(vec2(sgSeed * 17.0, 3.1));
		if (q < 0.25) c = vec2(c.x, 1.0 - c.y); else if (q < 0.5) c = vec2(1.0 - c.x, 1.0 - c.y); else if (q < 0.75) c = vec2(1.0 - c.x, c.y);
		float d = c.x + c.y;
		if (d < pk) discard;
		if (d < pk * 1.7) diffuseColor.rgb = mix(vec3(0.83, 0.8, 0.72), vec3(0.45, 0.43, 0.4), smoothstep(pk, pk * 1.7, d)) ;
		// yellowed and water-stained with age
		diffuseColor.rgb *= mix(vec3(1.0), vec3(0.96, 0.9, 0.76), sgWear);
		diffuseColor.rgb *= 1.0 - 0.18 * sgWear * smoothstep(0.55, 0.8, sgN(sgUv * 5.0 + sgSeed * 7.0));
	}
	` : ''}
	${kind === 'paint' ? `
	// the wall's grain through the paint, the overspray thinning at its edges
	diffuseColor.a *= 0.86 + 0.14 * sgN(vSgW.xz * 9.0 + vSgW.y * 7.0);
	` : ''}
	// fade out in the distance
	diffuseColor.a *= 1.0 - smoothstep(uSgFar * 0.72, uSgFar, distance(cameraPosition, vSgW));
	if (diffuseColor.a < 0.01) discard;
	`;
}
function emissiveBody(kind) {
	if (kind === 'retro') return /* glsl */`
	{
		// the headlights come back off the prisms toward where they came from
		vec3 L = uSgHead.xyz - vSgW; float d = length(L); L /= max(d, 1e-3);
		float facing = gl_FrontFacing ? max(dot(normalize(vSgN), L), 0.0) : 0.0;
		float cone = smoothstep(0.78, 0.96, dot(normalize(uSgHeadDir), -L));
		float retro = uSgHead.w * pow(facing, 0.6) * cone / (1.0 + d * d / 5200.0);
		totalEmissiveRadiance += diffuseColor.rgb * retro * (2.6 + sgExtra);
	}`;
	if (kind === 'foil') return /* glsl */`
	totalEmissiveRadiance += diffuseColor.rgb * (0.08 + 0.22 * uSgDay) * (0.6 + 0.4 * pow(1.0 - abs(dot(normalize(vSgN), normalize(cameraPosition - vSgW))), 2.0));`;
	if (kind === 'glass') return /* glsl */`
	if (gl_FrontFacing) totalEmissiveRadiance += diffuseColor.rgb * uSgNight * (sgExtra > 0.5 ? 0.35 : 0.08);`;
	return '';
}

const cache = new Map();
// a material for kind (retro, vinyl, glass, paper, foil, paint, grime) at layer, its map the atlas
export function signMaterial(kind, layer, map, { phone = false } = {}) {
	const key = kind + layer + (phone ? 'p' : '') + (map?.uuid || '');
	if (cache.has(key)) return cache.get(key);
	const S = SPEC[kind] || SPEC.vinyl, B = layerBias(layer, { phone });
	const m = new THREE.MeshStandardMaterial({
		map: kind === 'grime' ? null : map, roughness: S.roughness, metalness: S.metalness,
		transparent: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.0,
		polygonOffset: true, polygonOffsetFactor: B.factor, polygonOffsetUnits: B.units,
	});
	m.name = `signage-${kind}-${layer}`;
	const far = { value: S.far * (phone ? 0.65 : 1) };
	m.userData.far = far;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, SIGN_U, { uSgFar: far });
		sh.vertexShader = COMMON_V + sh.vertexShader
			.replace('#include <begin_vertex>', '#include <begin_vertex>' + (kind === 'cloth' ? '\ntransformed.z += 0.085 * uv.x * sin(uv.x * 7.0 + uv.y * 2.0 - uSgTime * 2.4 + aFx.y * 6.28);' : ''))
			.replace('#include <uv_vertex>', '#include <uv_vertex>\nvSgUv = uv; vSgCell = aCell; vSgFx = aFx;')
			.replace('#include <project_vertex>', `#include <project_vertex>
			{
				vec4 sgw = vec4(transformed, 1.0);
				vec3 sgn = objectNormal;
				#ifdef USE_INSTANCING
				sgw = instanceMatrix * sgw; sgn = mat3(instanceMatrix) * sgn;
				#endif
				vSgW = (modelMatrix * sgw).xyz; vSgN = normalize(mat3(modelMatrix) * sgn);
			}`);
		sh.fragmentShader = COMMON_F + (kind === 'grime' ? WALL_GLSL + GRIME_GLSL : '') + sh.fragmentShader
			.replace('#include <map_fragment>', fragBody(kind))
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emissiveBody(kind));
	};
	m.customProgramCacheKey = () => 'signage1' + kind;
	// (grime has no map, but its uv must still reach the shader)
	if (kind === 'grime') m.defines = { USE_UV: '' };
	m.userData.renderOrder = B.renderOrder;
	m.userData.lift = B.lift;
	cache.set(key, m);
	return m;
}
export function clearMaterials() { for (const m of cache.values()) m.dispose(); cache.clear(); }
