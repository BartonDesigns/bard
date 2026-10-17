// The air between you and far things. Three's fog is one exp² curve, the same in every
// direction and at every height, so a ridge 4 km off and the valley under it fade alike and
// far land reads as one flat sheet. Here it is shaded as air is:
//  - thickest low down: the haze along each ray is summed over the heights it passes
//    through (an exponential falloff with height), so valleys and the sea's edge fill with
//    it while ridges and peaks stand clear above, layer behind layer;
//  - lit toward the sun: looking into the light the haze glows with it (the sky's own
//    colour that way, tone mapped as the fog colour is), and away from it stays cool blue;
//  - whole by the far plane, so thinning it up high never shows the end of the world.
// Under water the density is negative (main.js) and light is absorbed red first, then green:
// near things keep their colour, far things go blue-green; that path is unchanged.
//
// The uniforms are plain {x, y, z, w} objects, shared by reference by every material
// (three's uniform cloning copies only its own vector types; plain objects are kept), so
// one write per frame reaches the whole scene. A material that made its own fog uniforms
// without these gets zeros: strength 0, plain exp² fog as before.

import * as THREE from 'three';

export const AIR = {
	// x: the height the air's density is measured from (sea level), y: falloff per metre,
	// z: how much of the height shaping is used (0: plain exp²), w: the view depth by which
	// the fog is whole (0: no such limit)
	air: { x: 0, y: 1 / 420, z: 0, w: 0 },
	// toward the sun (unit) and how strongly the haze glows that way
	sun: { x: 0, y: 1, z: 0, w: 0 },
	// the haze looking into the sun (tone mapped, as fogColor is)
	sunCol: { x: 1, y: 0.9, z: 0.75 },
};

const PARS_V = /* glsl */`
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogRay;
#endif
`;
// (world space from the camera: the view's rotation undone, its translation left out)
const VERT = /* glsl */`
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogRay = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif
`;
const PARS_F = /* glsl */`
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogRay;
	uniform vec4 fogAir;
	uniform vec4 fogSun;
	uniform vec3 fogSunCol;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;
const FRAG = /* glsl */`
#ifdef USE_FOG
	vec3 fogTint = fogColor;
	#ifdef FOG_EXP2
		float fogD2 = fogDensity * fogDensity * vFogDepth * vFogDepth;
		vec3 fogFactor3;
		if (fogDensity < 0.0) fogFactor3 = 1.0 - exp(-fogD2 * vec3(2.6, 1.0, 0.7));
		else {
			float fogL = length(vFogRay);
			vec3 fogRd = vFogRay / max(fogL, 1e-4);
			// the mean density along the ray: exp(-h) summed from the eye's height to the
			// point's (each measured up from the base, in falloff lengths; below it, the most)
			float fogH0 = max(cameraPosition.y - fogAir.x, 0.0) * fogAir.y;
			float fogH1 = max(cameraPosition.y + vFogRay.y - fogAir.x, 0.0) * fogAir.y;
			float fogDh = fogH1 - fogH0;
			float fogH = abs(fogDh) > 1e-3 ? (exp(-fogH0) - exp(-fogH1)) / fogDh : exp(-fogH0);
			fogH = mix(1.0, clamp(fogH * 1.3, 0.28, 2.2), fogAir.z);
			float fogK = 1.0 - exp(-fogD2 * fogH);
			if (fogAir.w > 0.0) fogK = max(fogK, smoothstep(fogAir.w * 0.6, fogAir.w, vFogDepth));
			// into the light, the haze glows with it
			float fogMu = max(dot(fogRd, fogSun.xyz), 0.0);
			fogTint = mix(fogColor, fogSunCol, clamp((fogMu * fogMu * fogMu * 0.4 + pow(fogMu, 12.0) * 0.6) * fogSun.w, 0.0, 1.0));
			fogFactor3 = vec3(fogK);
		}
	#else
		vec3 fogFactor3 = vec3(smoothstep(fogNear, fogFar, vFogDepth));
	#endif
	gl_FragColor.rgb = mix(gl_FragColor.rgb, fogTint, fogFactor3);
#endif
`;

let installed = false;
// before any material is compiled: the chunks, and the uniforms in every built-in shader
// (three merged its fog uniforms into them when it loaded) and in UniformsLib.fog for the
// ShaderMaterials made from it later
export function installAirFog() {
	if (installed) return;
	installed = true;
	THREE.ShaderChunk.fog_pars_vertex = PARS_V;
	THREE.ShaderChunk.fog_vertex = VERT;
	THREE.ShaderChunk.fog_pars_fragment = PARS_F;
	THREE.ShaderChunk.fog_fragment = FRAG;
	const add = (u) => { u.fogAir = { value: AIR.air }; u.fogSun = { value: AIR.sun }; u.fogSunCol = { value: AIR.sunCol }; };
	add(THREE.UniformsLib.fog);
	for (const k in THREE.ShaderLib) { const u = THREE.ShaderLib[k].uniforms; if (u && 'fogDensity' in u) add(u); }
}
