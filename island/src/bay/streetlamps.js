// The street lamps by era, as light: what each kind is (how high its head, how far over the
// road it reaches, how strong), what colour it burns, and the pool it throws on the road and
// the sidewalk. The poles themselves are streetlife.js's; the walls and trees the nearest
// lamps fall on are lit by nightlights.js and world/nightfield.js from the same numbers.
//
// By era (streetera.js): an acorn lantern on its post in an old core burns warm, the cobra
// heads of the older streets and the arterials are high pressure sodium (that orange), a share
// of them refitted with white LED heads (more of them on the busier roads and the newer
// tracts), and the slim LED heads of the newest subdivisions are a cool 4000 K white.
//
// The pool is the light of a lamp on the ground below it: I over the distance squared times
// the cosine, so the inverse cube of the slant distance, brightest under the head and fading
// to nothing at two and a half times its height; a cobra head's optics throw it further along
// the street than across. One quad each, tilted to the slope it falls on, additive, drawn
// once a rebuild; nothing changes a frame but its one uniform.

import * as THREE from 'three';

// the kinds: head height (m), how far in from the kerb over the road (m), strength (the
// interiors' units: I over d squared, 1 a well lit room's floor), pool radius in heights
export const LAMP = {
	cobra: { k: 0, h: 8.2, reach: 1.2, I: 30, R: 2.5 },
	led: { k: 1, h: 7.4, reach: 0.8, I: 26, R: 2.5 },
	acorn: { k: 2, h: 4.2, reach: 0, I: 10, R: 2.8 },
};
export const LAMP_KINDS = ['cobra', 'led', 'acorn'];
// the colours (linear, about equal in brightness): sodium, a 4000 K LED, a 3000 K LED, the acorns' 2700 K
export const LAMP_COL = { sodium: [1, 0.46, 0.12], led: [0.76, 0.84, 1], warmLed: [1, 0.72, 0.44], acorn: [1, 0.64, 0.34] };

// How a lamp looks: kind ('cobra', 'led', 'acorn'), the street's era, its rank (1 residential
// .. 6 a freeway), r a roll 0..1 for the street. { c: colour, k: kind index, col: its name }
export function lampLook(kind, era = 'tract', rank = 1, r = 0.5) {
	const L = LAMP[kind] || LAMP.cobra;
	let col;
	if (kind === 'acorn') col = r < 0.3 ? 'warmLed' : 'acorn';
	else if (kind === 'led') col = 'led';
	else {
		// the cobra heads: sodium, unless this street's were refitted with LED heads (the
		// freeways and the busier roads first, and the newer tracts)
		const refit = (rank >= 5 ? 0.5 : rank >= 3 ? 0.35 : 0.15) + (era === 'tract' ? 0.15 : era === 'new' ? 0.4 : 0);
		col = r < refit ? 'led' : 'sodium';
	}
	return { c: LAMP_COL[col], k: L.k, col };
}

// the light on the ground at d metres out from under a lamp h high, as a share of that under it
export const poolAt = (d, h) => Math.pow(1 + (d / h) * (d / h), -1.5);
// a pool's peak, in the same scale as the evening's pools (nightlights.js groundPool)
export const poolPeak = (L) => L.I / (L.h * L.h) * 0.08;

const VS = /* glsl */`
	varying vec2 vUV; varying vec3 vC;
	void main() {
		vUV = position.xz;
		vC = instanceColor;
		gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
	}`;
const FS = /* glsl */`
	uniform float uK, uExpo;
	varying vec2 vUV; varying vec3 vC;
	void main() {
		// (the quad reaches 2.5 heights out: so the slant distance's inverse cube is this)
		float r = length(vUV);
		float e = pow(1.0 + 6.25 * r * r, -1.5) * (1.0 - smoothstep(0.72, 1.0, r));
		if (e < 0.003) discard;
		gl_FragColor = vec4(vC * e * uK * uExpo, 1.0);
		#include <colorspace_fragment>
	}`;

// The pools for up to cap lamps: an InstancedMesh with fill() after a rebuild and setLevel()
// each frame.
export function lampPools(cap) {
	const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
	const mat = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uExpo: { value: 1 } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
	const im = new THREE.InstancedMesh(geo, mat, cap);
	im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
	im.count = 0; im.frustumCulled = false; im.renderOrder = 3; im.name = 'street-pools';
	im.onBeforeRender = (r) => { mat.uniforms.uExpo.value = r.toneMappingExposure * 0.85; };
	const M = new THREE.Matrix4(), C = im.instanceColor.array;
	// n lamps: heads at pos (xyz), colours col (rgb), kinds (LAMP_KINDS index), the street's yaw
	im.fill = (n, pos, col, kinds, yaws, groundAt) => {
		for (let i = 0; i < n; i++) {
			const L = LAMP[LAMP_KINDS[kinds[i]]] || LAMP.cobra;
			const x = pos[i * 3], z = pos[i * 3 + 2], R = L.h * L.R, Ra = L.k === 2 ? R : R * 1.25, s = R * 0.5;
			const ax = Math.sin(yaws[i]), az = Math.cos(yaws[i]), bx = -az, bz = ax;
			// tilted to the ground: its slope along the street and across it
			const g = groundAt(x, z);
			const ga = (groundAt(x + ax * s, z + az * s) - groundAt(x - ax * s, z - az * s)) / (2 * s);
			const gb = (groundAt(x + bx * s, z + bz * s) - groundAt(x - bx * s, z - bz * s)) / (2 * s);
			// (local x along the street, local z across it)
			M.set(ax * Ra, 0, bx * R, x, ga * Ra, 1, gb * R, g + 0.08, az * Ra, 0, bz * R, z, 0, 0, 0, 1);
			im.setMatrixAt(i, M);
			const k = poolPeak(L);
			C[i * 3] = col[i * 3] * k; C[i * 3 + 1] = col[i * 3 + 1] * k; C[i * 3 + 2] = col[i * 3 + 2] * k;
		}
		im.count = n;
		im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
	};
	im.setLevel = (k) => { mat.uniforms.uK.value = k; im.visible = k > 0.002 && im.count > 0; };
	return im;
}
