import { GFX_PHONE } from './device.js';
// The evening's lamps on what they light, close by: the few nearest lamps outside (a porch
// light, the light over a garage, an uplight under a tree, a street lamp) handed to the
// materials of the things they fall on (the trees' bark and leaves, the houses' outside walls)
// as a short list of small lights in the shader, without three's own lights (which every
// material in the world would pay for, and whose number changing would rebuild every program).
// A light here has a place and reach, a colour and strength (its level already in), and for a
// spot a direction and cone. bay/nightlights.js fills the list a few times a second.
//
// The light it gives is the interiors' kind (lightbake.js): strength over the distance
// squared, times the cosine at the surface, so a porch light reads the same on a wall built
// close by as the far house's shader (city.js) draws it.
//
// There are three lists, each for its own materials (one list a material):
//   NF  the houses' walls and the trees: every kind of lamp near you
//   SF  the city's own buildings (city.js): the street lamps only (the far houses draw their
//       own porch lights), so a shop front by a lamp has its pool of light on it
//   LF  the landmarks and the bridges: their floodlights (bay/floodlights.js), chosen from a
//       few kilometres round, so a lit tower stands out across the city

const PHONE = GFX_PHONE;
// how many lights a fragment looks at (a compile-time number: it never changes while running)
export const NF_N = PHONE ? 6 : 16;
export const SF_N = PHONE ? 4 : 8;
export const LF_N = PHONE ? 6 : 12;

// A list: xyz place, w reach; rgb colour times strength, w the cone's outer cosine (-2: all
// round); xyz the spot's direction, w the cone's inner cosine; n how many are in use.
function makeField(id, N) {
	const U = {
		[`u${id}P`]: { value: new Float32Array(N * 4) },
		[`u${id}C`]: { value: new Float32Array(N * 4) },
		[`u${id}D`]: { value: new Float32Array(N * 4) },
		[`u${id}n`]: { value: 0 },
	};
	const glsl = /* glsl */`
uniform vec4 u${id}P[${N}];
uniform vec4 u${id}C[${N}];
uniform vec4 u${id}D[${N}];
uniform int u${id}n;
varying vec3 v${id}W;
vec3 field${id}(vec3 p, vec3 n, float wrap) {
	vec3 e = vec3(0.0);
	for (int i = 0; i < ${N}; i++) {
		if (i >= u${id}n) break;
		vec3 L = u${id}P[i].xyz - p;
		float d2 = dot(L, L), r2 = u${id}P[i].w * u${id}P[i].w;
		if (d2 > r2) continue;
		L *= inversesqrt(max(d2, 1e-6));
		float c = u${id}C[i].w > -1.5 ? smoothstep(u${id}C[i].w, u${id}D[i].w, dot(-L, u${id}D[i].xyz)) : 1.0;
		float nl = dot(n, L);
		float lam = max(nl, 0.0) * (1.0 - wrap) + wrap * (0.5 + 0.5 * nl);
		float win = 1.0 - d2 / r2;
		e += u${id}C[i].rgb * (c * lam * win * win / (d2 + 0.2));
	}
	return e;
}
`;
	return { id, N, U, glsl, P: U[`u${id}P`], C: U[`u${id}C`], D: U[`u${id}D`], n: U[`u${id}n`] };
}
export const FIELDS = { NF: makeField('NF', NF_N), SF: makeField('SF', SF_N), LF: makeField('LF', LF_N) };
// (the evening's own list, as it always was: NF.uNFP and the rest)
export const NF = FIELDS.NF.U;

// Light a material by a list. wrap: how much light comes through from behind (leaves are
// thin: 0.5; a wall: 0); field: 'NF' (the default), 'SF' or 'LF'. Keeps whatever the material
// already does to its shader.
export function addNightField(material, { wrap = 0, field = 'NF' } = {}) {
	const Fd = FIELDS[field] || FIELDS.NF, id = Fd.id;
	if (!material || material.userData.nightField) return material;
	material.userData.nightField = id;
	const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey?.bind(material);
	material.onBeforeCompile = (sh, r) => {
		if (prev) prev.call(material, sh, r);
		Object.assign(sh.uniforms, Fd.U);
		sh.vertexShader = `varying vec3 v${id}W;\n` + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
	{
		vec4 nfW = vec4(transformed, 1.0);
		#ifdef USE_BATCHING
		nfW = batchingMatrix * nfW;
		#endif
		#ifdef USE_INSTANCING
		nfW = instanceMatrix * nfW;
		#endif
		v${id}W = (modelMatrix * nfW).xyz;
	}`);
		sh.fragmentShader = Fd.glsl + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	if (u${id}n > 0) totalEmissiveRadiance += diffuseColor.rgb * field${id}(v${id}W, inverseTransformDirection(normal, viewMatrix), ${wrap.toFixed(2)}) * RECIPROCAL_PI;`);
	};
	material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|' + id + Fd.N + 'w' + wrap.toFixed(2);
	material.needsUpdate = true;
	return material;
}
