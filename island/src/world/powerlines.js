// Power lines striding over the land: steel lattice pylons a few hundred metres apart, each
// line's conductors hanging between them in shallow curves. Seen from a ridge they run off
// over the hills toward the haze, the thing that most says "people live out here" at a
// distance, as in the reference video's snowfields.
//
// On Earth they follow the Bay Area's real corridors roughly (from the Delta's power station
// south through the San Ramon valley, the East Bay hills, the Peninsula's ridge), set once the
// survey's ground is in; on a settled planet (TERRAN, ARID, ICE, OCEAN) two lines cross its
// land; none on the wild or old worlds, nor on an airless one.
//
// One instanced draw for every pylon (refilled with the ones within reach every couple of
// seconds as you move) and one draw of line segments for all the wires.
//
//   createPowerlines(scene, { isPhone })   { group, plan(opts), update(camera), info(), dispose() }
//   plan({ island, profile, earth, heightAt })   lays the lines (again, for a new world)

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const SPAN = 330;                          // m between pylons
const ARMS = [[24, 6.2], [30.5, 4.8]];     // the cross-arms: height, half-length (a conductor hangs at each end)
const PEAK = 36.5;                         // the earth wire's peak
const SETTLED = new Set(['TERRAN', 'ARID', 'ICE', 'OCEAN']);
// Earth's corridors, [lat, lon] waypoints: roughly where the Bay's big lines run
const EARTH_LINES = [
	[[38.035, -121.885], [37.945, -121.93], [37.83, -121.915], [37.73, -121.9], [37.6, -121.875], [37.43, -121.87]],
	[[38.02, -122.13], [37.895, -122.1], [37.83, -122.12], [37.7, -122.06], [37.62, -122.02], [37.5, -121.97]],
	[[37.7, -122.455], [37.585, -122.37], [37.455, -122.255], [37.33, -122.07]],
	[[37.94, -122.33], [37.88, -122.24], [37.84, -122.2]],
];
const KX = 111320 * Math.cos(37.76 * Math.PI / 180), KZ = 110996;
const toXZ = ([lat, lon]) => ({ x: (lon + 122.57) * KX, z: (37.76 - lat) * KZ });

// a beam of the lattice from a to b: a four-sided box (no ends), w thick
function beam(a, b, w) {
	const d = new THREE.Vector3().subVectors(b, a), L = d.length();
	const g = new THREE.BoxGeometry(w, L, w, 1, 1, 1);
	// (the box's two ends are never seen: dropped, a third fewer triangles)
	const idx = [...g.index.array].slice(0, 24).concat([...g.index.array].slice(36));
	g.setIndex(idx);
	g.translate(0, L / 2, 0);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
	g.translate(a.x, a.y, a.z);
	return g;
}
// one pylon in its own frame: x across the line (the arms), z along it, y up from its foot
export function pylonGeometry(detail = 1) {
	const V = (x, y, z) => new THREE.Vector3(x, y, z);
	const parts = [];
	// the body tapers from a 7 m square foot to 1.8 m under the arms, then runs up to the peak
	const lv = detail > 0.5 ? [0, 9, 17, 24, 30.5, PEAK - 2] : [0, 12, 24, 30.5, PEAK - 2];
	const half = (y) => y <= 24 ? 3.5 - (3.5 - 0.9) * Math.pow(y / 24, 0.8) : 0.9 - (y - 24) / (PEAK - 24) * 0.45;
	const corners = (y) => { const h = half(y); return [V(-h, y, -h), V(h, y, -h), V(h, y, h), V(-h, y, h)]; };
	for (let i = 0; i < lv.length - 1; i++) {
		const A = corners(lv[i]), B = corners(lv[i + 1]);
		for (let k = 0; k < 4; k++) {
			parts.push(beam(A[k], B[k], 0.32));                                    // the legs
			parts.push(beam(A[k], B[(k + 1) % 4], 0.12), beam(A[(k + 1) % 4], B[k], 0.12));   // the X on each face
			if (i > 0) parts.push(beam(A[k], A[(k + 1) % 4], 0.14));               // a ring at each level
		}
	}
	// the cross-arms, each with its stays down to the body, and the insulator strings
	for (const [y, L] of ARMS) {
		const h = half(y);
		parts.push(beam(V(-L, y, 0), V(L, y, 0), 0.32));
		for (const s of [-1, 1]) {
			parts.push(beam(V(s * h, y - 2.2, 0), V(s * L * 0.92, y, 0), 0.14));
			parts.push(beam(V(s * L, y, 0), V(s * L, y - 2.6, 0), 0.22));        // the insulators hang under the arm's end
		}
	}
	parts.push(beam(V(0, PEAK - 2, 0), V(0, PEAK, 0), 0.22));
	const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
	for (const p of parts) p.dispose();
	g.computeVertexNormals();
	return g;
}
// the points the wires hang from, in the pylon's frame
const HANGS = [...ARMS.flatMap(([y, L]) => [[-L, y - 2.6], [L, y - 2.6]]), [0, PEAK]];

export function createPowerlines(scene, { isPhone = false } = {}) {
	const group = new THREE.Group();
	group.name = 'powerlines';
	scene.add(group);
	const MAX = isPhone ? 260 : 900, REACH = isPhone ? 9000 : 22000;
	const geo = pylonGeometry(isPhone ? 0 : 1);
	const mat = new THREE.MeshStandardMaterial({ color: 0x8b9298, roughness: 0.55, metalness: 0.35 });
	const mesh = new THREE.InstancedMesh(geo, mat, MAX);
	mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
	mesh.name = 'pylons';
	group.add(mesh);
	const wireMat = new THREE.LineBasicMaterial({ color: 0x2b2e30, transparent: true, opacity: 0.85 });
	let wires = null;
	let pylons = [];                         // { x, y, z, yaw }
	let lastAt = null, refillT = 0;
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();

	function clear() {
		pylons = []; mesh.count = 0; lastAt = null;
		if (wires) { group.remove(wires); wires.geometry.dispose(); wires = null; }
	}
	// a line through waypoints: pylons every SPAN along it, standing on the ground (a stretch over
	// water or off the land breaks it); the wires strung between neighbours that both stand
	function lay(points, heightAt, seg) {
		const out = [];
		for (let i = 0; i < points.length - 1; i++) {
			const a = points[i], b = points[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / SPAN));
			for (let k = 0; k < n + (i === points.length - 2 ? 1 : 0); k++) {
				const t = k / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
				const h = heightAt(x, z);
				out.push(Number.isFinite(h) && h > 1.5 ? { x, y: h, z, yaw: 0, line: seg } : null);
			}
		}
		// each pylon faces down its line (the arms square across it), turned halfway at a bend
		for (let i = 0; i < out.length; i++) {
			const P = out[i];
			if (!P) continue;
			const A = out[i - 1] || P, B = out[i + 1] || P;
			P.yaw = Math.atan2((B.x - A.x) || 1e-6, (B.z - A.z) || 1e-6);
		}
		return out;
	}
	function string(lines) {
		const pos = [];
		const at = (P, hx, hy) => { const c = Math.cos(P.yaw), s = Math.sin(P.yaw); return [P.x + hx * c, P.y + hy, P.z - hx * s]; };
		for (const L of lines) for (let i = 0; i < L.length - 1; i++) {
			const A = L[i], B = L[i + 1];
			if (!A || !B) continue;
			const span = Math.hypot(B.x - A.x, B.z - A.z), sag = span * 0.028, N = 10;
			for (const [hx, hy] of HANGS) {
				const a = at(A, hx, hy), b = at(B, hx, hy);
				for (let k = 0; k < N; k++) {
					for (const t of [k / N, (k + 1) / N]) pos.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t);
				}
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		wires = new THREE.LineSegments(g, wireMat);
		wires.frustumCulled = false; wires.name = 'wires';
		group.add(wires);
	}
	function plan({ island, profile, earth = false, heightAt = null } = {}) {
		clear();
		const H = heightAt || ((x, z) => island.heightAt(x, z));
		const lines = [];
		if (earth) {
			EARTH_LINES.forEach((L, i) => lines.push(lay(L.map(toXZ), H, i)));
		} else {
			if (!profile || profile.airless || !SETTLED.has(profile.type)) return info();
			// two lines across the land, edge to edge, with a bend or two
			let r = ((island.seed ^ 0x9e1e) >>> 0) || 1;
			const rnd = () => { r = (Math.imul(r, 16807) >>> 0) % 2147483647; return r / 2147483647; };
			const half = island.half || 1300;
			for (let li = 0; li < 2; li++) {
				const a0 = rnd() * Math.PI * 2, a1 = a0 + Math.PI + (rnd() - 0.5) * 1.2, R = half * 0.92;
				const A = { x: Math.cos(a0) * R, z: Math.sin(a0) * R }, B = { x: Math.cos(a1) * R, z: Math.sin(a1) * R };
				const M = { x: (A.x + B.x) / 2 + (rnd() - 0.5) * half * 0.5, z: (A.z + B.z) / 2 + (rnd() - 0.5) * half * 0.5 };
				lines.push(lay([A, M, B], H, li));
			}
		}
		pylons = lines.flat().filter(Boolean);
		string(lines);
		lastAt = null;
		return info();
	}
	// the pylons within reach go into the instanced draw (nearest first when there are too many)
	function refill(cam) {
		const cx = cam.position.x, cz = cam.position.z;
		let near = pylons.filter((P) => Math.abs(P.x - cx) < REACH && Math.abs(P.z - cz) < REACH);
		if (near.length > MAX) near = near.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz)).slice(0, MAX);
		near.forEach((P, i) => {
			q.setFromAxisAngle(up, P.yaw);
			// (sunk a little: a foot on a slope never shows daylight under it)
			mesh.setMatrixAt(i, m4.compose(p.set(P.x, P.y - 0.6, P.z), q, one));
		});
		mesh.count = near.length;
		mesh.instanceMatrix.needsUpdate = true;
		lastAt = { x: cx, z: cz };
	}
	function update(cam, dt = 0.016) {
		if (!pylons.length) return;
		refillT -= dt;
		if (!lastAt || (refillT <= 0 && Math.hypot(cam.position.x - lastAt.x, cam.position.z - lastAt.z) > 600)) { refillT = 2; refill(cam); }
		if (wires) wires.visible = cam.position.y < 30000;
	}
	const info = () => ({ pylons: pylons.length, drawn: mesh.count, lines: new Set(pylons.map((P) => P.line)).size, wireSegments: wires ? wires.geometry.attributes.position.count / 2 : 0 });
	function dispose() { clear(); scene.remove(group); geo.dispose(); mat.dispose(); wireMat.dispose(); }
	return { group, plan, update, info, dispose };
}
