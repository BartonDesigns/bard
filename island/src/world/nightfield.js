// The evening's lamps on what they light, close by: the few nearest lamps outside (a porch
// light, the light over a garage, an uplight under a tree) handed to the materials of the
// things they fall on (the trees' bark and leaves, the houses' outside walls) as a short list
// of small lights in the shader, without three's own lights (which every material in the
// world would pay for, and whose number changing would rebuild every program). A light here
// has a place and reach, a colour and strength (its level already in), and for a spot a
// direction and cone. bay/nightlights.js fills the list a few times a second.
//
// The light it gives is the interiors' kind (lightbake.js): strength over the distance
// squared, times the cosine at the surface, so a porch light reads the same on a wall built
// close by as the far house's shader (city.js) draws it.

const PHONE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
// how many lights a fragment looks at (a compile-time number: it never changes while running)
export const NF_N = PHONE ? 6 : 16;

// the list: xyz place, w reach; rgb colour times strength, w the cone's outer cosine (-2: all
// round); xyz the spot's direction, w the cone's inner cosine
export const NF = {
	uNFP: { value: new Float32Array(NF_N * 4) },
	uNFC: { value: new Float32Array(NF_N * 4) },
	uNFD: { value: new Float32Array(NF_N * 4) },
	uNFn: { value: 0 },
};

const GLSL = /* glsl */`
uniform vec4 uNFP[NF_N];
uniform vec4 uNFC[NF_N];
uniform vec4 uNFD[NF_N];
uniform int uNFn;
varying vec3 vNFW;
vec3 nightField(vec3 p, vec3 n, float wrap) {
	vec3 e = vec3(0.0);
	for (int i = 0; i < NF_N; i++) {
		if (i >= uNFn) break;
		vec3 L = uNFP[i].xyz - p;
		float d2 = dot(L, L), r2 = uNFP[i].w * uNFP[i].w;
		if (d2 > r2) continue;
		L *= inversesqrt(max(d2, 1e-6));
		float c = uNFC[i].w > -1.5 ? smoothstep(uNFC[i].w, uNFD[i].w, dot(-L, uNFD[i].xyz)) : 1.0;
		float nl = dot(n, L);
		float lam = max(nl, 0.0) * (1.0 - wrap) + wrap * (0.5 + 0.5 * nl);
		float win = 1.0 - d2 / r2;
		e += uNFC[i].rgb * (c * lam * win * win / (d2 + 0.2));
	}
	return e;
}
`;

// Light a material by the list. wrap: how much light comes through from behind (leaves are
// thin: 0.5; a wall: 0). Keeps whatever the material already does to its shader.
export function addNightField(material, { wrap = 0 } = {}) {
	if (!material || material.userData.nightField) return material;
	material.userData.nightField = true;
	const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey?.bind(material);
	material.onBeforeCompile = (sh, r) => {
		if (prev) prev.call(material, sh, r);
		sh.defines = sh.defines || {};
		sh.defines.NF_N = NF_N;
		Object.assign(sh.uniforms, NF);
		sh.vertexShader = 'varying vec3 vNFW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
	{
		vec4 nfW = vec4(transformed, 1.0);
		#ifdef USE_BATCHING
		nfW = batchingMatrix * nfW;
		#endif
		#ifdef USE_INSTANCING
		nfW = instanceMatrix * nfW;
		#endif
		vNFW = (modelMatrix * nfW).xyz;
	}`);
		sh.fragmentShader = GLSL + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	if (uNFn > 0) totalEmissiveRadiance += diffuseColor.rgb * nightField(vNFW, inverseTransformDirection(normal, viewMatrix), ${wrap.toFixed(2)}) * RECIPROCAL_PI;`);
	};
	material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|nf' + NF_N + 'w' + wrap.toFixed(2);
	material.needsUpdate = true;
	return material;
}
