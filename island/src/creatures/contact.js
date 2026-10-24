// The creatures' contact shade: a soft dark patch on the ground under each foot that is down and
// under the body, so a creature stands on the ground rather than over it (Josh 2026-10-24: "they
// just look stamped on"). The sun's shadow does this in sunlight; in shade, under cloud, at night
// and on a phone's small shadow map nothing else does. A foot lifting in its stride lets its
// patch go; a body lying where it fell has one under it; a flyer's is faint and wide, fading the
// higher it hangs.
//
// One instanced mesh for all of them (one draw, one small program, made once): each patch a
// square laid on the ground's slope there, darkening what is under it (the framebuffer times
// 1 - shade). What a kind stands on (standOf) and how dark a lifting foot's patch is (footShade)
// need no three, so they can be checked on their own.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// what a kind stands on, from its rig's joints at rest (model metres): its feet (each a bone, how
// high its joint is off the ground at rest, how far ahead of the joint the patch sits, a patch
// radius), the body's patch (half its width, half its length, and where its middle is along it)
// and the height of its hips
export function standOf(meta) {
	const J = meta.joints || {}, H = meta.height || 2;
	const jl = (n) => { const j = J[n]; return j ? Math.hypot(j[1][0] - j[0][0], j[1][2] - j[0][2]) : 0; };
	const feet = [];
	const foot = (n, r) => { const j = J[n]; if (j) feet.push({ bone: n, y0: j[0][1], fz: (j[1][2] - j[0][2]) * 0.5, r: Math.max(0.08, r) }); };
	if (meta.rig === 'biped') for (const s of ['L', 'R']) foot('foot_' + s, Math.max(jl('foot_' + s) * 0.75, H * 0.07));
	else if (meta.rig === 'quad') for (const s of ['L', 'R']) { foot('hand_' + s, H * 0.1); foot(J['toe_' + s] ? 'toe_' + s : 'foot_' + s, H * 0.1); }
	let x = 0, z0 = Infinity, z1 = -Infinity;
	for (const n of meta.bones || []) {
		const j = J[n];
		if (!j || (meta.props || []).includes(n)) continue;
		for (const p of j) { x = Math.max(x, Math.abs(p[0])); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
	}
	if (!Number.isFinite(z0)) { z0 = -H * 0.2; z1 = H * 0.2; }
	const flat = meta.rig === 'quad' || meta.rig === 'spider';
	return { feet, body: { rx: clamp(x * (flat ? 0.95 : 0.8), H * 0.12, H * 0.6), rz: clamp((z1 - z0) * (flat ? 0.55 : 0.6), H * 0.12, H * 0.9), cz: (z0 + z1) / 2 }, H, hipH: J.hips ? J.hips[0][1] : H * 0.5, flyer: meta.rig === 'flyer' };
}

// how dark a foot's patch is: full while it is down, none once it is lifted a fifth of the hips'
// height off the ground (lift: its height above where it rests, in m)
export const footShade = (lift, hipH) => 1 - smooth(lift / Math.max(0.05, hipH * 0.2));

export function createContactShadows({ isPhone = false } = {}) {
	const CAP = isPhone ? 24 : 48;
	const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
	const k = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
	k.setUsage(THREE.DynamicDrawUsage);
	geo.setAttribute('aShade', k);
	const mat = new THREE.ShaderMaterial({
		vertexShader: /* glsl */`
			attribute float aShade;
			varying vec2 vUv;
			varying float vShade;
			void main() {
				vUv = uv * 2.0 - 1.0;
				vShade = aShade;
				gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
			}`,
		fragmentShader: /* glsl */`
			varying vec2 vUv;
			varying float vShade;
			void main() {
				float r = dot(vUv, vUv);
				float d = r < 1.0 ? (1.0 - r) * (1.0 - r) * vShade : 0.0;
				// (alpha 0: what is under it keeps its own alpha, times 1 - 0)
				gl_FragColor = vec4(vec3(d), 0.0);
			}`,
		transparent: true, depthWrite: false, fog: false, toneMapped: false,
		blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcColorFactor,
		polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
	});
	const mesh = new THREE.InstancedMesh(geo, mat, CAP);
	mesh.count = 0; mesh.frustumCulled = false; mesh.name = 'creature-contact'; mesh.renderOrder = 1;
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), n = new THREE.Vector3(), p = new THREE.Vector3(), sc = new THREE.Vector3();
	let i = 0;
	// one patch: at x, z on the plane through (x0, y0, z0) with normal N (the ground there), r by
	// rz across (turned to yaw), shade 0..1
	function put(x, z, P, rx, rz, yaw, shade) {
		if (i >= CAP || shade < 0.02) return;
		n.set(P.nx, P.ny, P.nz);
		const y = P.y - ((x - P.x) * P.nx + (z - P.z) * P.nz) / Math.max(0.3, P.ny);
		q.setFromUnitVectors(UP, n).multiply(qy.setFromAxisAngle(UP, yaw));
		m4.compose(p.set(x, y + 0.025, z), q, sc.set(rx, 1, rz));
		mesh.setMatrixAt(i, m4);
		k.array[i] = shade;
		i++;
	}
	return {
		mesh,
		begin() { i = 0; },
		put,
		end() {
			mesh.count = i;
			if (i) { mesh.instanceMatrix.needsUpdate = true; k.needsUpdate = true; }
		},
		get count() { return i; },
		dispose() { geo.dispose(); mat.dispose(); },
	};
}
