// Detail levels that dissolve into each other instead of popping. Across a band at each
// boundary, every pixel of a plant belongs to exactly one of the two versions (a screen
// noise decides which), in proportions that slide with distance: the nearer version
// thins out as the farther one fills in, never both, never neither. The same dissolve
// fades the last level out at the edge of the draw distance.
//
// Two ways to give a mesh its share:
//   uniform: the tier's inner and outer edges (vec4: in-start, in-end, out-start, out-end),
//            measured from each instance to the camera in the shader (city trees)
//   attribute: aFade (vec2: keep from, keep to), worked out on the CPU per instance when
//            the plants are streamed (the island's vegetation)

import * as THREE from 'three';

// a tier that starts at the camera / never ends
export const NONE_IN = [-2, -1], NONE_OUT = [1e8, 1e8 + 1];

// the share of the farther tier across a boundary at E, band W: 0 before, 1 past it
const s = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// keep-range for a tier with an inner boundary [a0, a1] and outer [b0, b1] at distance d
export function fadeRange(d, a0, a1, b0, b1) { return [1 - s(a0, a1, d), 1 - s(b0, b1, d)]; }

const VERT_HEAD = 'varying vec2 vLodK;\n';
const FRAG_HEAD = 'varying vec2 vLodK;\nfloat lodIgn(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\n';
const FRAG_CUT = '#include <clipping_planes_fragment>\n{ float hL = lodIgn(gl_FragCoord.xy); if (hL < vLodK.x || hL >= vLodK.y) discard; }';

// patch a material (keeping whatever onBeforeCompile it already has)
export function addLodFade(material, mode, band = null) {
	const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey?.bind(material);
	const uBand = { value: new THREE.Vector4(...(band || [NONE_IN[0], NONE_IN[1], NONE_OUT[0], NONE_OUT[1]])) };
	material.onBeforeCompile = (sh, r) => {
		if (prev) prev(sh, r);
		const calc = mode === 'attribute' ? 'vLodK = aFade;' : `
			{
				#ifdef USE_INSTANCING
				vec2 ipL = (modelMatrix * instanceMatrix[3]).xz;
				#else
				vec2 ipL = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
				#endif
				float dL = length(ipL - cameraPosition.xz);
				vLodK = vec2(1.0 - smoothstep(uLodBand.x, uLodBand.y, dL), 1.0 - smoothstep(uLodBand.z, uLodBand.w, dL));
			}`;
		if (mode === 'uniform') sh.uniforms.uLodBand = uBand;
		sh.vertexShader = (mode === 'attribute' ? 'attribute vec2 aFade;\n' : 'uniform vec4 uLodBand;\n') + VERT_HEAD + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + calc);
		sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <clipping_planes_fragment>', FRAG_CUT);
	};
	material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|lodfade-' + mode;
	material.needsUpdate = true;
	material.userData.lodBand = uBand;
	return uBand;
}
