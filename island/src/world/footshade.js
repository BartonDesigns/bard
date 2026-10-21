// Where people meet the ground: a soft shade under each shoe and a broader, fainter one under
// the body, so they stand on the sand or the pavement instead of looking pasted over it. The
// sun's shadow cannot do this. Its map is drawn across a 110 m box, so on a phone one texel is
// 10 cm or more (20 on the lower tiers), softened over four, which is wider than a shoe's own
// shadow; under cloud or the coast's fog the sun's shadow fades out altogether; and the light
// from the whole sky that a body really hides from the ground at its feet is not shaded at all.
// The building, tree and car shade (bay/contact.js) does the same for things that do not move.
//
// One material and one draw for everyone: flat quads, one per shoe and one under the body,
// in a single instanced mesh, darkening what is already drawn there (the ground's own shaders
// are left as they are). The material reads no lights and no fog, so the number of lamps
// about never builds it again, and it never changes once made: its one shader is built with
// the rest before Enter (world/shaderwarm.js warms what is in the scene and drawn, and this
// mesh always is, with no one under it when nobody is near). The fog is applied here, by
// distance, before the shade is written. Each frame, for the bodies near and in view: each
// foot's ground (the floor people walk on, read again only once the foot has moved), the
// shade there faded by how high the foot is off it (a step, a jump, a ladder, a seat), by
// distance and by the person's own fade in or out.
//
//   createFootShade(scene, { bodies, floor })   { update(camera), mesh, info(), dispose() }
//     bodies: a set of WeakRefs to built people (people/body.js liveBodies)
//     floor(x, z, y): the ground or floor a sole at height y stands on
import * as THREE from 'three';

export const FOOT_REACH = 40;           // m: no shade beyond this from the camera
export const FOOT_FADE = 8;             // m: faded out over the last of it
export const MAX_PEOPLE = 48;           // shaded at once (more than are ever built near you)
const LIFT = 0.025;                     // m off the ground, with the polygon offset, so it never flickers
const FOOT_DARK = 0.55, BODY_DARK = 0.26;
const REQUERY = 0.1 * 0.1;              // a foot moved this far (squared, m) has its ground read again

// how much of the shade a foot leaves on the ground, by the sole's height over it (m): all of it
// standing, less with the heel up or the foot swinging through, none from a half metre up; a
// foot well below the ground found under it is somewhere that ground does not know (a cellar,
// a room built below the street, a car's footwell under the road's mesh): none there either
export function liftK(h) {
	if (h < -0.25) return 0;
	if (h <= 0.03) return 1;
	if (h >= 0.45) return 0;
	const t = (h - 0.03) / 0.42;
	return 1 - t * t * (3 - 2 * t);
}

// by the camera's distance (m): whole near, gone at FOOT_REACH
export function reachK(d) {
	if (d >= FOOT_REACH) return 0;
	const t = (FOOT_REACH - d) / FOOT_FADE;
	return t >= 1 ? 1 : t * t * (3 - 2 * t);
}

// what the scene's fog (exponential squared) leaves of something d metres off (a negative
// density is the water's per-channel absorption: its size is what counts)
export function fogK(d, density) {
	const f = d * Math.abs(density || 0);
	return Math.exp(-f * f);
}

// One body's shade, from its feet. F: each ankle (lx, ly, lz / rx, ry, rz) and the way its toes
// point across the ground (ldx, ldz / rdx, rdz, not yet of unit length), the ground under each
// (lg, rg), the ankle's height over its sole when standing (ankle) and the body's height (h),
// all in metres; k: everything else that fades it (distance, fog, the person's own fade).
// Writes up to three quads into out (each { x, y, z, ux, uy, uz, a, b, k }: the centre, the
// long axis (unit), the half length and half width, and how dark) and returns how many.
export function personShade(F, k, out) {
	let n = 0;
	const hl = F.ly - F.ankle - F.lg, hr = F.ry - F.ankle - F.rg;
	const kl = liftK(hl), kr = liftK(hr);
	// the print sits a little ahead of the ankle, under the middle of the shoe
	let ll = Math.sqrt(F.ldx * F.ldx + F.ldz * F.ldz), lr = Math.sqrt(F.rdx * F.rdx + F.rdz * F.rdz);
	const ldx = ll > 1e-6 ? F.ldx / ll : 0, ldz = ll > 1e-6 ? F.ldz / ll : 1, rdx = lr > 1e-6 ? F.rdx / lr : 0, rdz = lr > 1e-6 ? F.rdz / lr : 1;
	const ahead = F.h * 0.035, fa = F.h * 0.13, fb = F.h * 0.072;
	const plx = F.lx + ldx * ahead, plz = F.lz + ldz * ahead, prx = F.rx + rdx * ahead, prz = F.rz + rdz * ahead;
	if (kl * k > 0.004) n = put(out, n, plx, F.lg + LIFT, plz, ldx, 0, ldz, fa, fb, FOOT_DARK * kl * k);
	if (kr * k > 0.004) n = put(out, n, prx, F.rg + LIFT, prz, rdx, 0, rdz, fa, fb, FOOT_DARK * kr * k);
	// under the body: long across the feet (side to side stood still, along the stride walking),
	// tilted from one foot's ground to the other's so a slope does not bury half of it; there
	// while either foot is down
	const kb = Math.max(kl, kr) * k;
	if (kb > 0.004) {
		let ux = prx - plx, uz = prz - plz;
		const sep = Math.sqrt(ux * ux + uz * uz);
		let uy = 0;
		if (sep > 0.02) { uy = Math.max(-0.6, Math.min(0.6, (F.rg - F.lg) / sep)); ux /= sep; uz /= sep; }
		else { const sx = ldx + rdx, sz = ldz + rdz, s = Math.sqrt(sx * sx + sz * sz) || 1; ux = sz / s; uz = -sx / s; }
		const ul = Math.sqrt(1 + uy * uy);
		n = put(out, n, (plx + prx) / 2, (F.lg + F.rg) / 2 + LIFT, (plz + prz) / 2, ux / ul, uy / ul, uz / ul, sep / 2 + F.h * 0.22, F.h * 0.19, BODY_DARK * kb);
	}
	return n;
}
function put(out, n, x, y, z, ux, uy, uz, a, b, k) {
	const q = out[n];
	q.x = x; q.y = y; q.z = z; q.ux = ux; q.uy = uy; q.uz = uz; q.a = a; q.b = b; q.k = k;
	return n + 1;
}

// a quad's instance matrix into arr at i: the unit square on the ground (x and z from -0.5 to
// 0.5) stretched 2a along the axis and 2b across it, and moved to its centre
export function shadeMatrix(arr, i, q) {
	const o = i * 16, hx = q.uz, hz = -q.ux, hl = Math.sqrt(hx * hx + hz * hz) || 1;
	// (across: level, at right angles to the axis)
	const vx = -hx / hl, vz = -hz / hl;
	arr[o] = q.ux * 2 * q.a; arr[o + 1] = q.uy * 2 * q.a; arr[o + 2] = q.uz * 2 * q.a; arr[o + 3] = 0;
	arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
	arr[o + 8] = vx * 2 * q.b; arr[o + 9] = 0; arr[o + 10] = vz * 2 * q.b; arr[o + 11] = 0;
	arr[o + 12] = q.x; arr[o + 13] = q.y; arr[o + 14] = q.z; arr[o + 15] = 1;
}

const VERT = /* glsl */`
varying vec2 vP;
varying float vK;
void main() {
	vP = position.xz * 2.0;
	vK = instanceColor.r;
	gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
// dark in the middle, nothing at the rim; drawn as what to take away from the colour beneath
const FRAG = /* glsl */`
varying vec2 vP;
varying float vK;
void main() {
	float t = max(0.0, 1.0 - dot(vP, vP));
	gl_FragColor = vec4(vec3(vK * t * t), 1.0);
}`;

export function createFootShade(scene, { bodies, floor }) {
	const CAP = MAX_PEOPLE * 3;
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
	geo.setIndex([0, 2, 1, 2, 3, 1]);
	// (the colour beneath times one less the shade: dst * (1 - src), whatever the ground is)
	const mat = new THREE.ShaderMaterial({
		vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
		blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcColorFactor,
		polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6, fog: false, lights: false, toneMapped: false,
	});
	mat.name = 'foot-shade';
	const mesh = new THREE.InstancedMesh(geo, mat, CAP);
	// (made with its colours from the start: a mesh that gained them later would need a second shader)
	mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
	mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
	mesh.count = 0;
	mesh.name = 'foot-shade';
	// (over the ground, before anything else see-through: hair and glass over it blend as ever)
	mesh.renderOrder = -1;
	mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
	// (nothing aims at it, steps on it or hides behind it)
	mesh.raycast = () => {};
	mesh.matrixAutoUpdate = false;
	scene.add(mesh);

	const state = new WeakMap();
	const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
	const quads = Array.from({ length: 3 }, () => ({ x: 0, y: 0, z: 0, ux: 1, uy: 0, uz: 0, a: 0, b: 0, k: 0 }));
	const F = { lx: 0, ly: 0, lz: 0, ldx: 0, ldz: 1, lg: 0, rx: 0, ry: 0, rz: 0, rdx: 0, rdz: 1, rg: 0, ankle: 0.08, h: 1.7 };
	let people = 0, shades = 0, queries = 0;
	const drawn = (o) => { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; } return false; };
	// a body's own, worked out once: its foot bones, the ankle's height, the toes' way at rest
	function own(P) {
		let S = state.get(P);
		if (S) return S;
		const iL = P.map?.['foot.L'], iR = P.map?.['foot.R'];
		if (iL === undefined || iR === undefined) S = { none: true };
		else S = { L: P.bones[iL], R: P.bones[iR], ankle: P.rest.heads[iL].y, dL: P.rest.dirs[iL], dR: P.rest.dirs[iR], gx: [1e9, 1e9], gy: [0, 0], gz: [1e9, 1e9], g: [0, 0] };
		state.set(P, S);
		return S;
	}
	// the ground under a foot, read again only once it has moved
	function groundUnder(S, side, x, y, z) {
		const dx = x - S.gx[side], dz = z - S.gz[side];
		if (dx * dx + dz * dz > REQUERY || Math.abs(y - S.gy[side]) > 0.2) {
			S.gx[side] = x; S.gz[side] = z; S.gy[side] = y;
			S.g[side] = floor(x, z, y);
			queries++;
		}
		return S.g[side];
	}

	function update(camera) {
		const arr = mesh.instanceMatrix.array, col = mesh.instanceColor.array;
		const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
		const density = scene.fog?.density ?? 0;
		camera.updateMatrixWorld();
		frustum.setFromProjectionMatrix(pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		let n = 0;
		people = 0;
		for (const ref of bodies) {
			const P = ref.deref();
			if (!P || P.freed) { bodies.delete(ref); continue; }
			if (n + 3 > CAP) break;
			if (!drawn(P.root)) continue;
			// near enough and in view (where it stood last frame: a margin for the walk since)
			const e = P.root.matrixWorld.elements;
			let dx = e[12] - cx, dy = e[13] - cy, dz = e[14] - cz;
			if (dx * dx + dy * dy + dz * dz > (FOOT_REACH + 4) ** 2) continue;
			const S = own(P);
			if (S.none) continue;
			// (a body drawn without a shadow of its own, a ghost, leaves none here either)
			if (P.skin && P.skin.castShadow === false) continue;
			S.L.updateWorldMatrix(true, false); S.R.updateWorldMatrix(true, false);
			const a = S.L.matrixWorld.elements, b = S.R.matrixWorld.elements;
			sphere.center.set((a[12] + b[12]) / 2, (a[13] + b[13]) / 2, (a[14] + b[14]) / 2); sphere.radius = 1.2;
			if (!frustum.intersectsSphere(sphere)) continue;
			dx = sphere.center.x - cx; dy = sphere.center.y - cy; dz = sphere.center.z - cz;
			const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
			const k = reachK(d) * fogK(d, density) * (P.fadeK ?? 1);
			if (k <= 0.004) continue;
			// (the body's own scale, if something has scaled it)
			const s = Math.sqrt(a[4] * a[4] + a[5] * a[5] + a[6] * a[6]) || 1;
			F.ankle = S.ankle * s; F.h = (P.height || 1.7) * s;
			F.lx = a[12]; F.ly = a[13]; F.lz = a[14];
			F.rx = b[12]; F.ry = b[13]; F.rz = b[14];
			// the toes' way: the bone's turn applied to its direction at rest, across the ground
			const L = S.dL, R = S.dR;
			F.ldx = a[0] * L.x + a[4] * L.y + a[8] * L.z; F.ldz = a[2] * L.x + a[6] * L.y + a[10] * L.z;
			F.rdx = b[0] * R.x + b[4] * R.y + b[8] * R.z; F.rdz = b[2] * R.x + b[6] * R.y + b[10] * R.z;
			// (asked from the soles: the floor they stand on, not one overhead)
			F.lg = groundUnder(S, 0, F.lx, F.ly - F.ankle, F.lz);
			F.rg = groundUnder(S, 1, F.rx, F.ry - F.ankle, F.rz);
			const m = personShade(F, k, quads);
			if (m) people++;
			for (let i = 0; i < m; i++) {
				shadeMatrix(arr, n, quads[i]);
				col[n * 3] = col[n * 3 + 1] = col[n * 3 + 2] = quads[i].k;
				n++;
			}
		}
		if (n || mesh.count) {
			mesh.count = n;
			mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, Math.max(1, n) * 16); mesh.instanceMatrix.needsUpdate = true;
			mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, Math.max(1, n) * 3); mesh.instanceColor.needsUpdate = true;
		}
		shades = n;
	}
	function dispose() { mesh.removeFromParent(); geo.dispose(); mat.dispose(); mesh.dispose(); }
	return { update, mesh, dispose, info: () => ({ people, shades, queries, bodies: bodies.size, programs: 1 }) };
}
