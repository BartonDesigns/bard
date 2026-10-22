// The sky in the water on wet paving. After rain a road is a dull mirror: at a low look
// the sky lies on it (Fresnel: nothing close under you, nearly all of it far ahead), brighter
// and sharper where water stands in the ruts and dips, and toward a low sun the road carries
// the same glow the haze does that way (Josh's photos: the freeway at a rainy sunrise, the
// peach of the sky laid down the wet lanes, the tree line smeared in it). No pass and no
// texture: the sky's own two colours and the haze's colour toward the sun, which the ground
// (bay/terrain.js) and the freeways' concrete (bay/freeways.js) add as light.

import * as THREE from 'three';

// the uniforms the sheen reads (one set, shared by reference: world/sky.js writes them)
export function wetSheenUniforms(shared) {
	shared.uSkySun = shared.uSkySun || { value: new THREE.Color() };
	shared.uSkySunK = shared.uSkySunK || { value: 0 };
	return { uWet: shared.uWet || { value: 0 }, uSkyZenS: shared.uSkyZen || { value: new THREE.Color() }, uSkyHorS: shared.uSkyHor || { value: new THREE.Color() }, uSkySunS: shared.uSkySun, uSkySunK: shared.uSkySunK, uSunDirS: shared.uSunDir || { value: new THREE.Vector3(0, 1, 0) } };
}
export const WET_SHEEN_PARS = /* glsl */`
uniform vec3 uSkySunS, uSunDirS; uniform float uSkySunK;
// N: the surface's normal (world), P: the point (world), film: how much of a mirror it is
// (0..1: the dampness of the paving, more where water pools); returns the sky's light in it
vec3 wetSheen(vec3 N, vec3 P, float film){
	vec3 Vv = normalize(cameraPosition - P), nS = normalize(N);
	vec3 Rr = reflect(-Vv, nS);
	float Fs = 0.02 + 0.98 * pow(1.0 - max(dot(nS, Vv), 0.0), 5.0);
	vec3 skyR = mix(uSkyHorS, uSkyZenS, clamp(Rr.y * 2.0, 0.0, 1.0));
	// toward a low sun the sky's glow (the haze's colour that way, world/airfog.js) lies on the road
	float mu = max(dot(normalize(Rr.xz + 1e-5), normalize(uSunDirS.xz + 1e-5)), 0.0);
	skyR = mix(skyR, uSkySunS, clamp((mu * mu * mu * 0.4 + pow(mu, 12.0) * 0.6) * uSkySunK, 0.0, 1.0) * (1.0 - smoothstep(0.0, 0.3, Rr.y)));
	return skyR * Fs * film;
}
`;
