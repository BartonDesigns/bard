// The strike response: a ring of light that radiates out from the point you touched
// and travels across the whole object you struck (that tree, that rock, that house),
// fading as it goes. It lives in the object's own surface, so it reads as the object
// ringing rather than a glow floating in front of it. Three pulses can overlap.

import * as THREE from 'three';

const N = 3;
export const PULSE = {
	uPulseP: { value: Array.from({ length: N }, () => new THREE.Vector3(1e5, 1e5, 1e5)) },  // contact point
	uPulseO: { value: Array.from({ length: N }, () => new THREE.Vector3(1e5, 1e5, 1e5)) },  // the struck instance's origin
	uPulseC: { value: Array.from({ length: N }, () => new THREE.Color()) },
	uPulseS: { value: [-100, -100, -100] },                                              // start time
	uPulseR: { value: [0, 0, 0] },                                                       // reach (object size)
	uPulseNow: { value: 0 },
};
let slot = 0;

// point: world contact; origin: instance origin (or null for a merged mesh, which then
// rings within `reach` of the contact); reach: how far the ring travels
export function strikePulse(point, origin, reach, color, now) {
	const i = slot++ % N;
	PULSE.uPulseP.value[i].copy(point);
	if (origin) PULSE.uPulseO.value[i].copy(origin); else PULSE.uPulseO.value[i].set(1e5, 1e5, 1e5);
	PULSE.uPulseC.value[i].set(color);
	PULSE.uPulseS.value[i] = now;
	PULSE.uPulseR.value[i] = reach;
}

// add the pulse to a MeshStandard/Lambert shader (call inside onBeforeCompile)
export function addPulse(sh) {
	Object.assign(sh.uniforms, PULSE);
	sh.vertexShader = 'varying vec3 vPW228; varying vec3 vPO228;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
		{
			vec4 pw = vec4(transformed, 1.0);
			#ifdef USE_INSTANCING
			pw = instanceMatrix * pw;
			vPO228 = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
			#else
			vPO228 = vec3(1e5);
			#endif
			vPW228 = (modelMatrix * pw).xyz;
		}`);
	sh.fragmentShader = `varying vec3 vPW228; varying vec3 vPO228;
		uniform vec3 uPulseP[${N}]; uniform vec3 uPulseO[${N}]; uniform vec3 uPulseC[${N}]; uniform float uPulseS[${N}]; uniform float uPulseR[${N}]; uniform float uPulseNow;
		` + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
		for (int i = 0; i < ${N}; i++) {
			float age = uPulseNow - uPulseS[i];
			if (age < 0.0 || age > 1.6) continue;
			// on the struck instance only (merged meshes: within reach of the contact)
			bool mine = uPulseO[i].x > 9e4 ? vPO228.x > 9e4 : distance(vPO228, uPulseO[i]) < 0.05;
			if (!mine) continue;
			float d = distance(vPW228, uPulseP[i]);
			if (d > uPulseR[i]) continue;
			float front = age * max(3.0, uPulseR[i] * 1.4);
			float ring = exp(-pow((d - front) / (0.18 + 0.12 * front), 2.0));
			float trail = smoothstep(front, 0.0, d) * 0.18;                   // the part it has passed hums faintly
			float fade = (1.0 - smoothstep(0.0, 1.6, age)) * (1.0 - smoothstep(uPulseR[i] * 0.7, uPulseR[i], d));
			totalEmissiveRadiance += uPulseC[i] * (ring + trail) * fade * 1.4;
		}`);
}
