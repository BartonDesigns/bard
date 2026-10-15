// Holes through the city's blocks. A building built inside (interiors/) still shows the street
// its far block's painted face; where one of its outside walls has been broken through
// (structures/walls/), the block's face is cut away round the hole so the broken wall behind it
// shows from the street too. A few boxes, nearest first, read by the block's shader (bay/city.js).

import * as THREE from 'three';

export const CUT_MAX = 12;
// a: centre (x, y, z) and the wall's turn about y; b: half extents along the wall, up it, across it
export const WALL_CUTS = {
	n: { value: 0 },
	a: { value: Array.from({ length: CUT_MAX }, () => new THREE.Vector4()) },
	b: { value: Array.from({ length: CUT_MAX }, () => new THREE.Vector4()) },
};
// the shader's part: declared, then the test that throws the fragment away (vCW: its world point)
export const CUT_PARS = `uniform int uCutN; uniform vec4 uCutA[${CUT_MAX}]; uniform vec4 uCutB[${CUT_MAX}];\n`;
export const CUT_TEST = `
	for (int ci = 0; ci < ${CUT_MAX}; ci++) {
		if (ci >= uCutN) break;
		vec3 cq = vCW - uCutA[ci].xyz;
		float cc = cos(uCutA[ci].w), cs = sin(uCutA[ci].w);
		vec2 cl = vec2(cc * cq.x + cs * cq.z, -cs * cq.x + cc * cq.z);
		if (abs(cl.x) < uCutB[ci].x && abs(cq.y) < uCutB[ci].y && abs(cl.y) < uCutB[ci].z) discard;
	}`;
// set the boxes: list of { x, y, z, yaw, hu, hv, ha }
export function setCuts(list) {
	const n = Math.min(CUT_MAX, list.length);
	for (let i = 0; i < n; i++) { const c = list[i]; WALL_CUTS.a.value[i].set(c.x, c.y, c.z, c.yaw); WALL_CUTS.b.value[i].set(c.hu, c.hv, c.ha, 0); }
	WALL_CUTS.n.value = n;
}
