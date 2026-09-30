// The small things that make a street lived in, each drawn as one instanced mesh of simple
// vertex-coloured parts: on the roofs, chimneys (brick or stucco), metal flues, plumbing
// vents, box vents, skylights, dormers, solar arrays and satellite dishes, and downspouts
// down the corners; in the drives and yards, cars (and the odd one abandoned), RVs and
// boats on trailers, bins at the kerb, a basketball hoop, an AC condenser, raised beds, a
// for-sale sign; round a complex's pool, loungers, umbrellas, a cabana, a built-in grill,
// tables, the carports, the mailbox kiosk, wrought-iron fencing and the gate; a picket
// fence; tennis nets and park benches. An entry is [x, y, z, yaw, sx, sy, sz, tilt, r, g, b]
// (tilt about the thing's own x; the colour tints it, where it has one).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const colored = (geo, c) => { const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const B = (w, h, d, x, y, z, c) => colored(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), c);
const C = (r, h, x, y, z, c, seg = 8, r2 = r) => colored(new THREE.CylinderGeometry(r, r2, h, seg).translate(x, y + h / 2, z), c);
const M = (parts) => mergeGeometries(parts);
const WHITE = [0.93, 0.93, 0.91], DARK = [0.08, 0.08, 0.09], GLASS = [0.12, 0.15, 0.18], STEEL = [0.62, 0.63, 0.64], TYRE = [0.05, 0.05, 0.05];

function wheels(parts, xs, zs, r, y = 0) {
	for (const x of xs) for (const z of zs) parts.push(colored(new THREE.CylinderGeometry(r, r, 0.22, 10).rotateZ(Math.PI / 2).translate(x, r + y, z), TYRE));
}
// the shapes, each in its own metres, length along z, standing on y 0
function shapes() {
	const S = {};
	// a car: body tinted by the entry's colour, glass and tyres dark
	{
		const p = [B(1.8, 0.62, 4.5, 0, 0.3, 0, [1, 1, 1]), B(1.62, 0.55, 2.3, 0, 0.92, -0.2, [1, 1, 1]), B(1.64, 0.42, 2.1, 0, 0.98, -0.2, GLASS), B(1.84, 0.12, 0.25, 0, 0.45, 2.2, [0.25, 0.25, 0.26]), B(1.84, 0.12, 0.25, 0, 0.45, -2.2, [0.25, 0.25, 0.26])];
		wheels(p, [-0.82, 0.82], [-1.4, 1.4], 0.33);
		S.car = M(p);
	}
	// a motorhome: a white box on a cab, a stripe down it, a band of windows
	{
		const p = [B(2.45, 2.55, 7.4, 0, 0.45, -0.6, WHITE), B(2.3, 1.2, 1.6, 0, 0.45, 3.8, WHITE), B(2.2, 0.5, 0.2, 0, 1.2, 4.55, GLASS), B(2.47, 0.18, 7.3, 0, 1.1, -0.6, [0.45, 0.2, 0.12]), B(2.47, 0.1, 7.3, 0, 1.32, -0.6, [0.2, 0.22, 0.28]), B(2.47, 0.45, 4.5, 0, 1.95, -0.4, GLASS), B(2.2, 0.4, 2.2, 0, 3.0, 0.9, WHITE), B(1.1, 0.3, 1.2, 0, 3.0, -2.5, [0.8, 0.8, 0.78])];
		wheels(p, [-1.05, 1.05], [-2.9, -1.9, 3.3], 0.45);
		S.rv = M(p);
	}
	// a boat on its trailer: the frame and its wheels, a white hull, a windscreen, an outboard
	{
		const p = [B(1.6, 0.14, 6.2, 0, 0.45, 0, DARK), B(0.12, 0.12, 1.4, 0, 0.45, 3.7, DARK), B(2.2, 0.75, 5.6, 0, 0.62, -0.2, WHITE), B(1.7, 0.5, 0.9, 0, 0.42, 2.9, WHITE), B(2.24, 0.14, 5.6, 0, 1.2, -0.2, [0.12, 0.25, 0.5]), B(1.9, 0.45, 0.08, 0, 1.37, 0.4, GLASS), B(0.35, 1.0, 0.4, 0, 0.7, -3.2, DARK)];
		wheels(p, [-0.95, 0.95], [-0.8], 0.33);
		S.boat = M(p);
	}
	// on the roofs
	S.chimney = M([B(1, 1, 1, 0, 0, 0, [1, 1, 1]), B(1.16, 0.12, 1.16, 0, 1, 0, [0.82, 0.8, 0.78]), B(0.3, 0.35, 0.3, -0.2, 1.12, 0, [0.35, 0.33, 0.3])]);
	S.flue = M([C(0.1, 1, 0, 0, 0, STEEL, 10), C(0.2, 0.08, 0, 1.0, 0, STEEL, 10, 0.2), colored(new THREE.ConeGeometry(0.22, 0.14, 10).translate(0, 1.15, 0), STEEL)]);
	S.pipe = M([C(0.045, 0.45, 0, 0, 0, [0.2, 0.2, 0.21], 6)]);
	S.boxvent = M([B(0.45, 0.14, 0.45, 0, 0, 0, [0.3, 0.3, 0.31]), B(0.36, 0.12, 0.36, 0, 0.14, 0, [0.24, 0.24, 0.25])]);
	S.skylight = M([B(0.9, 0.1, 1.3, 0, 0, 0, [0.85, 0.85, 0.83]), B(0.74, 0.04, 1.14, 0, 0.1, 0, [0.16, 0.24, 0.3])]);
	S.dish = M([B(0.06, 0.5, 0.06, 0, 0, 0, [0.5, 0.5, 0.5]), colored(new THREE.CylinderGeometry(0.34, 0.12, 0.12, 12).rotateX(-1.1).translate(0, 0.62, 0.04), [0.9, 0.9, 0.88]), B(0.04, 0.04, 0.4, 0, 0.62, 0.25, [0.4, 0.4, 0.4])]);
	// a dormer: its cheeks and front tinted as the walls, a window; its little roof apart
	S.dormer = M([B(1.6, 1.3, 2.0, 0, 0, 0, [1, 1, 1]), B(0.9, 0.8, 0.05, 0, 0.3, 1.0, [0.95, 0.95, 0.93]), B(0.74, 0.64, 0.06, 0, 0.38, 1.01, GLASS)]);
	{
		const g = new THREE.BufferGeometry();
		const P = [-0.95, 1.3, 1.15, 0, 1.95, 1.15, 0, 1.95, -1.0, -0.95, 1.3, 1.15, 0, 1.95, -1.0, -0.95, 1.3, -1.0, 0.95, 1.3, 1.15, 0.95, 1.3, -1.0, 0, 1.95, -1.0, 0.95, 1.3, 1.15, 0, 1.95, -1.0, 0, 1.95, 1.15, -0.8, 1.3, 1.1, 0.8, 1.3, 1.1, 0, 1.9, 1.1];
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.computeVertexNormals();
		S.dormerRoof = colored(g, [1, 1, 1]);
		const ca = S.dormerRoof.attributes.color; for (let i = 12; i < 15; i++) ca.setXYZ(i, 3, 3, 3);       // (the gable face under it: pale; the tint is the roof's)
	}
	S.spout = M([B(0.08, 1, 0.1, 0, 0, 0, [1, 1, 1])]);
	// in the yards
	S.bins = M([B(0.6, 1.05, 0.7, -0.7, 0, 0, [0.2, 0.36, 0.2]), B(0.6, 1.05, 0.7, 0, 0, 0, [0.15, 0.3, 0.55]), B(0.6, 1.05, 0.7, 0.7, 0, 0, [0.24, 0.24, 0.25])]);
	S.hoop = M([C(0.06, 3.0, 0, 0, 0, [0.3, 0.3, 0.32]), B(1.2, 0.8, 0.05, 0, 2.7, 0.35, WHITE), colored(new THREE.TorusGeometry(0.23, 0.02, 4, 12).rotateX(Math.PI / 2).translate(0, 3.0, 0.62), [0.85, 0.35, 0.1])]);
	S.cond = M([B(0.75, 0.75, 0.75, 0, 0, 0, [0.72, 0.72, 0.7]), C(0.28, 0.03, 0, 0.75, 0, DARK, 12)]);
	S.bed = M([B(1.2, 0.4, 2.4, 0, 0, 0, [0.42, 0.3, 0.2]), B(1.05, 0.06, 2.25, 0, 0.36, 0, [0.22, 0.34, 0.12])]);
	S.sign = M([B(0.08, 1.4, 0.08, 0, 0, 0, WHITE), B(0.9, 0.08, 0.06, 0.4, 1.3, 0, WHITE), B(0.7, 0.5, 0.03, 0.55, 0.72, 0, [0.72, 0.12, 0.1]), B(0.62, 0.14, 0.035, 0.55, 0.82, 0, WHITE)]);
	S.picket = M((() => { const p = [B(2.4, 0.08, 0.05, 0, 0.55, 0, WHITE), B(2.4, 0.08, 0.05, 0, 0.2, 0, WHITE)]; for (let k = 0; k < 16; k++) p.push(B(0.08, 0.95, 0.03, -1.15 + k * 0.153, 0, 0.03, WHITE)); return p; })());
	S.iron = M((() => { const p = [B(2.4, 0.04, 0.04, 0, 1.45, 0, DARK), B(2.4, 0.04, 0.04, 0, 0.12, 0, DARK), B(0.1, 1.6, 0.1, -1.2, 0, 0, DARK)]; for (let k = 0; k < 20; k++) p.push(B(0.02, 1.5, 0.02, -1.14 + k * 0.12, 0, 0, DARK)); return p; })());
	// round the pool
	S.lounger = M([B(0.66, 0.3, 1.9, 0, 0, 0, WHITE), B(0.64, 0.06, 1.3, 0, 0.3, 0.3, [1, 1, 1]), colored(new THREE.BoxGeometry(0.64, 0.06, 0.7).rotateX(-0.9).translate(0, 0.55, -0.62), [1, 1, 1])]);
	S.umbrella = M([C(0.03, 2.3, 0, 0, 0, [0.85, 0.85, 0.83], 6), colored(new THREE.ConeGeometry(1.35, 0.45, 8, 1, true).translate(0, 2.35, 0), [1, 1, 1]), colored(new THREE.ConeGeometry(1.35, 0.45, 8, 1, true).rotateX(Math.PI).translate(0, 2.35, 0), [0.7, 0.7, 0.7])]);
	S.cabana = M([...[[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].map(([x, z]) => B(0.12, 2.5, 0.12, x, 0, z, WHITE)), B(3.1, 0.15, 3.1, 0, 2.5, 0, [1, 1, 1]), colored(new THREE.ConeGeometry(2.3, 0.7, 4).rotateY(Math.PI / 4).translate(0, 3.0, 0), [1, 1, 1]), B(0.05, 2.1, 3.0, -1.45, 0.3, 0, [0.95, 0.94, 0.9]), B(1.2, 0.35, 2.0, 0, 0, 0, [0.88, 0.86, 0.8])]);
	S.bbq = M([B(2.6, 0.9, 0.8, 0, 0, 0, [0.62, 0.55, 0.46]), B(2.7, 0.06, 0.9, 0, 0.9, 0, [0.4, 0.38, 0.36]), B(0.8, 0.28, 0.55, -0.5, 0.96, 0, STEEL), B(0.4, 0.04, 0.5, 0.7, 0.96, 0, STEEL)]);
	S.table = M([C(0.55, 0.05, 0, 0.72, 0, WHITE, 10), C(0.04, 0.72, 0, 0, 0, DARK, 6), ...[0, 1, 2, 3].map((k) => B(0.45, 0.45, 0.45, Math.cos(k * 1.571) * 0.85, 0, Math.sin(k * 1.571) * 0.85, [0.2, 0.2, 0.22]))]);
	S.carport = M([...[-2.6, 2.6].map((z) => B(0.12, 2.6, 0.12, 0, 0, z, [0.55, 0.56, 0.57])), colored(new THREE.BoxGeometry(3.0, 0.1, 6.0).rotateX(0.05).translate(0, 2.65, 0), [1, 1, 1]), B(3.0, 0.2, 0.08, 0, 2.5, 3.0, [0.45, 0.46, 0.47])]);
	S.mailbox = M([B(1.6, 1.6, 0.6, 0, 0.1, 0, [0.72, 0.69, 0.6]), B(1.5, 1.2, 0.02, 0, 0.35, 0.31, [0.6, 0.58, 0.52]), B(1.3, 0.06, 0.03, 0, 1.0, 0.32, DARK), B(1.9, 0.12, 0.9, 0, 1.7, 0, [0.4, 0.3, 0.22]), B(1.7, 0.1, 0.5, 0, 0, 0, [0.6, 0.6, 0.58])]);
	S.gate = M([B(0.5, 2.2, 0.5, -3.6, 0, 0, [0.7, 0.62, 0.52]), B(0.5, 2.2, 0.5, 3.6, 0, 0, [0.7, 0.62, 0.52]), B(0.6, 0.12, 0.6, -3.6, 2.2, 0, [0.5, 0.45, 0.4]), B(0.6, 0.12, 0.6, 3.6, 2.2, 0, [0.5, 0.45, 0.4]), B(6.7, 0.06, 0.05, 0, 1.55, 0, DARK), B(6.7, 0.06, 0.05, 0, 0.2, 0, DARK), ...[...Array(32)].map((_, k) => B(0.025, 1.45, 0.025, -3.25 + k * 0.21, 0.15, 0, DARK)), B(0.5, 0.2, 0.4, 3.0, 1.0, -0.8, [0.3, 0.3, 0.32])]);
	S.net = M([B(0.08, 1.07, 0.08, -0.5, 0, 0, [0.3, 0.3, 0.3]), B(0.08, 1.07, 0.08, 0.5, 0, 0, [0.3, 0.3, 0.3]), B(1, 0.84, 0.02, 0, 0.07, 0, [0.12, 0.12, 0.12]), B(1, 0.07, 0.03, 0, 0.9, 0, WHITE)]);
	S.bench = M([B(1.8, 0.06, 0.45, 0, 0.42, 0, [0.45, 0.32, 0.2]), B(1.8, 0.35, 0.05, 0, 0.5, -0.22, [0.45, 0.32, 0.2]), B(0.06, 0.45, 0.45, -0.8, 0, 0, DARK), B(0.06, 0.45, 0.45, 0.8, 0, 0, DARK)]);
	S.solar = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
	return S;
}

// [shape, cap, cast shadows, phone keeps it, material]
const SPEC = {
	car: [5000, true, true], rv: [600, true, true], boat: [600, true, true],
	chimney: [9000, true, true], flue: [5000, false, true], pipe: [12000, false, false], boxvent: [12000, false, false], skylight: [3000, false, true], dish: [2500, false, false],
	dormer: [2500, true, true], dormerRoof: [2500, true, true], spout: [16000, false, false], solar: [5000, false, true, 'solar'],
	bins: [5000, false, false], hoop: [1200, false, false], cond: [5000, false, false], bed: [2500, false, false], sign: [500, false, true],
	picket: [6000, false, true], iron: [6000, false, true],
	lounger: [3000, false, true], umbrella: [1200, true, true], cabana: [400, true, true], bbq: [400, false, true], table: [800, false, true],
	carport: [3000, true, true], mailbox: [400, false, true], gate: [300, false, true], net: [400, false, true], bench: [1500, false, false],
};

export function createProps(group, wrap, isPhone) {
	const S = shapes();
	const base = wrap(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }));
	// the solar arrays: dark cells in silver frames, a panel every metre by 1.7
	const solarM = wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.3 }));
	const prev = solarM.onBeforeCompile;
	solarM.onBeforeCompile = (sh, r) => {
		prev?.call(solarM, sh, r);
		sh.vertexShader = 'varying vec3 vSolP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSolP = position * vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));');
		sh.fragmentShader = 'varying vec3 vSolP;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				vec2 q = vSolP.xz + 20.0;
				vec2 pf = fract(q / vec2(1.02, 1.7)), cf = fract(q / vec2(0.17, 0.17));
				float fw = length(fwidth(q));
				float frame = max(step(pf.x, 0.03) + step(0.97, pf.x), step(pf.y, 0.02) + step(0.98, pf.y));
				float cell = (step(cf.x, 0.06) + step(cf.y, 0.06)) * (1.0 - smoothstep(0.02, 0.06, fw));
				vec3 c = mix(vec3(0.04, 0.06, 0.12), vec3(0.1, 0.13, 0.2), cell * 0.6);
				c = mix(c, vec3(0.7, 0.72, 0.74), clamp(frame, 0.0, 1.0) * (1.0 - smoothstep(0.05, 0.2, fw)));
				diffuseColor.rgb = mix(c, vec3(0.08, 0.1, 0.15), smoothstep(0.05, 0.2, fw) * 0.6);
			}`);
	};
	const pk = solarM.customProgramCacheKey?.bind(solarM);
	solarM.customProgramCacheKey = () => (pk ? pk() : '') + '|solar1';
	const meshes = {};
	for (const [k, [cap, cast, phone, mat]] of Object.entries(SPEC)) {
		if (isPhone && !phone) continue;
		const n = isPhone ? Math.ceil(cap / 2) : cap;
		const im = new THREE.InstancedMesh(S[k], mat === 'solar' ? solarM : base, n);
		im.count = 0; im.frustumCulled = false; im.castShadow = cast; im.receiveShadow = true;
		im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
		group.add(im);
		meshes[k] = im;
	}
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qt = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
	// every kind's entries (a map of kind -> list); what isn't listed is emptied
	function upload(put) {
		for (const [k, im] of Object.entries(meshes)) {
			const L = put?.[k] || [], cap = im.instanceMatrix.count, col = im.instanceColor.array;
			let n = 0;
			for (const e of L) {
				if (n >= cap) break;
				q.setFromAxisAngle(Y, -e[3]);
				if (e[7]) q.multiply(qt.setFromAxisAngle(X, e[7]));
				im.setMatrixAt(n, m4.compose(p.set(e[0], e[1], e[2]), q, s.set(e[4], e[5], e[6])));
				if (e.length > 8) { col[n * 3] = e[8]; col[n * 3 + 1] = e[9]; col[n * 3 + 2] = e[10]; } else { col[n * 3] = col[n * 3 + 1] = col[n * 3 + 2] = 1; }
				n++;
			}
			im.count = n;
			im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
			im.computeBoundingSphere();
		}
	}
	const counts = () => Object.fromEntries(Object.entries(meshes).map(([k, im]) => [k, im.count]));
	return { upload, counts, has: (k) => !!meshes[k] };
}
