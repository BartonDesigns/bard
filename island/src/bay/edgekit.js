// The edgelands' things, made once: shipping containers, pallets, tyres, drums, shopping
// carts, a dumpster, jersey barriers, a pipe gate; litter (bags, cans, cups, paper,
// bottles); weeds and dry grass; and what a small camp holds: dome tents, tarps, camp
// chairs, a bike, buckets, milk crates, a cooler, a stove and pot, bags of belongings, a
// sleeping bag with its sleeper. Each is one vertex-coloured geometry at its real size,
// white where the instance's own colour paints it. The textures are drawn here too: the
// chain link, privacy slats, a cart's wire, grass blades and the painted tags (abstract
// shapes, never words).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const hash = (a, b) => { let h = Math.imul(Math.floor(a) | 0, 374761393) ^ Math.imul(Math.floor(b) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();

// a part: a geometry placed (x, y, z, rotation, scale) and coloured (a colour, or a function
// of the vertex's local position)
function part(g, x, y, z, col, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
	g = g.index ? g.toNonIndexed() : g;
	for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
	const P = g.attributes.position, c = new Float32Array(P.count * 3);
	for (let i = 0; i < P.count; i++) { const v = typeof col === 'function' ? col(P.getX(i), P.getY(i), P.getZ(i), i) : col; c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
	g.setAttribute('color', new THREE.BufferAttribute(c, 3));
	g.applyMatrix4(M4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz)));
	return g;
}
const box = (w, h, d, x, y, z, col, o) => part(new THREE.BoxGeometry(w, h, d), x, y, z, col, o);
const cyl = (r0, r1, h, seg, x, y, z, col, o) => part(new THREE.CylinderGeometry(r0, r1, h, seg, 1, false), x, y, z, col, o);
const tube = (r0, r1, h, seg, x, y, z, col, o) => part(new THREE.CylinderGeometry(r0, r1, h, seg, 1, true), x, y, z, col, o);
// a thin bar from a to b
function bar(a, b, r, col, seg = 5) {
	const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
	const g = new THREE.CylinderGeometry(r, r, L, seg, 1, true);
	g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())));
	return part(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, col);
}
const merge = (parts) => { const g = mergeGeometries(parts, false); g.computeBoundingSphere(); return g; };

// ---------- the yard ----------
// a shipping container, long along x: corrugated sides, the doors and their bars at +x
function container(L) {
	const W = 2.44, H = 2.59, parts = [], n = Math.round(L / 0.28);
	const rust = (x, y, i) => { const r = hash(Math.floor((x + L) * 3.6), 17 + i % 3); const k = 0.82 + r * 0.22 - (y < 0.35 ? 0.2 : 0) - (hash(Math.floor((x + L) * 1.2), 5) > 0.8 ? 0.22 * (1 - y / H) : 0); return [k, k * 0.97, k * 0.94]; };
	// the long sides: a trapezoid corrugation, pressed in and out
	for (const s of [-1, 1]) {
		const P = [];
		for (let k = 0; k < n; k++) {
			const x0 = -L / 2 + k * L / n, x1 = x0 + L / n, z0 = s * W / 2, z1 = s * (W / 2 - 0.04);
			const pts = [[x0, z0], [x0 + (x1 - x0) * 0.25, z1], [x0 + (x1 - x0) * 0.75, z1], [x1, z0]];
			for (let q = 0; q < 3; q++) {
				const [ax, az] = pts[q], [bx, bz] = pts[q + 1];
				if (s > 0) P.push(ax, 0.1, az, bx, 0.1, bz, bx, H - 0.1, bz, ax, 0.1, az, bx, H - 0.1, bz, ax, H - 0.1, az);
				else P.push(bx, 0.1, bz, ax, 0.1, az, ax, H - 0.1, az, bx, 0.1, bz, ax, H - 0.1, az, bx, H - 0.1, bz);
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.computeVertexNormals();
		parts.push(part(g, 0, 0, 0, (x, y, z, i) => rust(x, y, i)));
	}
	// the roof, the ends, the frame rails top and bottom, the corner posts
	parts.push(box(L, 0.06, W - 0.06, 0, H - 0.08, 0, [0.8, 0.78, 0.75]));
	parts.push(box(0.06, H - 0.2, W - 0.08, -L / 2 + 0.03, H / 2, 0, (x, y) => rust(x, y, 1)));
	parts.push(box(0.05, H - 0.2, W - 0.1, L / 2 - 0.05, H / 2, 0, [0.86, 0.84, 0.8]));
	for (const y of [0.05, H - 0.05]) for (const s of [-1, 1]) parts.push(box(L, 0.12, 0.1, 0, y, s * (W / 2 - 0.02), [0.62, 0.6, 0.58]));
	for (const x of [-1, 1]) for (const s of [-1, 1]) parts.push(box(0.16, H, 0.16, x * (L / 2 - 0.08), H / 2, s * (W / 2 - 0.08), [0.55, 0.53, 0.5]));
	// the door seam and the four locking bars
	parts.push(box(0.02, H - 0.25, 0.03, L / 2 + 0.005, H / 2, 0, [0.3, 0.3, 0.3]));
	for (const z of [-0.85, -0.35, 0.35, 0.85]) parts.push(cyl(0.022, 0.022, H - 0.3, 5, L / 2 + 0.04, H / 2, z, [0.5, 0.48, 0.45]));
	return merge(parts);
}
// a wooden pallet: stringers, top deck boards, bottom boards
function pallet() {
	const parts = [], wood = (i) => { const k = 0.8 + hash(i, 3) * 0.3; return [0.72 * k, 0.6 * k, 0.44 * k]; };
	for (const z of [-0.45, 0, 0.45]) parts.push(box(1.2, 0.09, 0.08, 0, 0.065, z, wood(z * 10)));
	for (let k = 0; k < 7; k++) parts.push(box(0.1, 0.022, 1.0, -0.55 + k * 0.183, 0.121, 0, wood(k + 7)));
	for (const x of [-0.53, 0, 0.53]) parts.push(box(0.12, 0.022, 1.0, x, 0.011, 0, wood(x * 10 + 20)));
	return merge(parts);
}
const tyre = () => merge([part(new THREE.TorusGeometry(0.3, 0.11, 7, 14), 0, 0.11, 0, [0.09, 0.09, 0.1], { rx: Math.PI / 2 }), cyl(0.2, 0.2, 0.12, 12, 0, 0.11, 0, [0.05, 0.05, 0.05])]);
// a 55-gallon drum: rolled hoops, the lid's rim
function drum() {
	return merge([cyl(0.29, 0.29, 0.88, 14, 0, 0.44, 0, (x, y) => { const k = 0.85 + hash(Math.atan2(x, 0.29) * 5 + 9, y * 8) * 0.25 - (y < 0.1 ? 0.25 : 0); return [k, k, k]; }),
		tube(0.3, 0.3, 0.03, 14, 0, 0.3, 0, [0.8, 0.8, 0.8]), tube(0.3, 0.3, 0.03, 14, 0, 0.6, 0, [0.8, 0.8, 0.8]), tube(0.295, 0.295, 0.04, 14, 0, 0.87, 0, [0.7, 0.7, 0.7])]);
}
// a dumpster: sloped plastic lids, side pockets for the truck's forks, casters
function dumpster() {
	const W = 1.95, D = 1.55, H = 1.25, parts = [], body = [1, 1, 1];
	const P = [], v = (x, y, z) => P.push(x, y, z);
	// the body: a tapered bin, wider at the top
	const b0 = [[-W / 2 + 0.05, 0.25, -D / 2 + 0.2], [W / 2 - 0.05, 0.25, -D / 2 + 0.2], [W / 2 - 0.05, 0.25, D / 2 - 0.05], [-W / 2 + 0.05, 0.25, D / 2 - 0.05]];
	const b1 = [[-W / 2, H, -D / 2], [W / 2, H, -D / 2], [W / 2, H + 0.25, D / 2], [-W / 2, H + 0.25, D / 2]];
	for (let k = 0; k < 4; k++) { const a = b0[k], b = b0[(k + 1) % 4], c = b1[(k + 1) % 4], d = b1[k]; v(...a); v(...b); v(...c); v(...a); v(...c); v(...d); }
	v(...b0[0]); v(...b0[2]); v(...b0[1]); v(...b0[0]); v(...b0[3]); v(...b0[2]);
	const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
	parts.push(part(g, 0, 0, 0, (x, y) => { const k = 0.85 + hash(x * 7 + 3, y * 5) * 0.2 - (y < 0.5 ? 0.15 : 0); return [k, k, k]; }));
	// the lids, black plastic, one propped a little open
	for (const s of [-1, 1]) parts.push(box(W / 2 - 0.04, 0.05, D + 0.08, s * W / 4, H + 0.16, 0.02, [0.12, 0.12, 0.13], { rx: -Math.atan2(0.25, D) + (s > 0 ? -0.1 : 0) }));
	for (const s of [-1, 1]) parts.push(box(0.16, 0.14, D * 0.9, s * (W / 2 + 0.06), 0.8, 0, body));
	for (const x of [-0.75, 0.75]) for (const z of [-0.45, 0.55]) { parts.push(box(0.07, 0.2, 0.07, x, 0.12, z, [0.3, 0.3, 0.3])); parts.push(cyl(0.07, 0.07, 0.05, 8, x, 0.07, z, [0.1, 0.1, 0.1], { rz: Math.PI / 2 })); }
	return merge(parts);
}
// a jersey barrier (the concrete K-rail left along a lot's edge), 3 m long
function jersey() {
	const P = [], prof = [[-0.3, 0], [-0.3, 0.08], [-0.2, 0.33], [-0.08, 0.81], [0.08, 0.81], [0.2, 0.33], [0.3, 0.08], [0.3, 0]];
	for (let k = 0; k + 1 < prof.length; k++) { const [a0, b0] = prof[k], [a1, b1] = prof[k + 1]; P.push(-1.5, b0, a0, 1.5, b0, a0, 1.5, b1, a1, -1.5, b0, a0, 1.5, b1, a1, -1.5, b1, a1); }
	for (const x of [-1.5, 1.5]) for (let k = 1; k + 1 < prof.length; k++) { const s = x > 0 ? 1 : -1, a = prof[0], b = prof[k], c = prof[k + 1]; if (s > 0) P.push(x, a[1], a[0], x, c[1], c[0], x, b[1], b[0]); else P.push(x, a[1], a[0], x, b[1], b[0], x, c[1], c[0]); }
	const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
	return merge([part(g, 0, 0, 0, (x, y) => { const k = 0.9 + hash(x * 4 + 1, y * 6) * 0.12 - (y < 0.15 ? 0.2 : 0); return [0.72 * k, 0.7 * k, 0.66 * k]; })]);
}
// a pipe gate across a fire road: two posts and a swing arm with a diagonal brace
function gate() {
	const Y = [0.85, 0.72, 0.18], G = [0.4, 0.4, 0.38];
	return merge([cyl(0.08, 0.08, 1.3, 8, -2.2, 0.65, 0, G), cyl(0.08, 0.08, 1.3, 8, 2.1, 0.65, 0, G), bar([-2.2, 1.05, 0], [2.1, 1.05, 0], 0.045, Y), bar([-2.2, 0.55, 0], [2.1, 0.55, 0], 0.035, Y), bar([-2.2, 0.55, 0], [-0.2, 1.05, 0], 0.03, Y), bar([-0.2, 0.55, 0], [1.8, 1.05, 0], 0.03, Y)]);
}
// a shopping cart's frame (the wire basket is its own mesh, cartWire): handle at -x
function cartFrame() {
	const C = [0.72, 0.73, 0.75], parts = [];
	const bx0 = -0.45, bx1 = 0.45, top = 0.98, bot = 0.5;
	for (const s of [-1, 1]) {
		parts.push(bar([bx0, top, s * 0.28], [bx1, top, s * 0.24], 0.012, C), bar([bx0, bot, s * 0.26], [bx1 - 0.08, bot, s * 0.2], 0.012, C));
		parts.push(bar([bx0 - 0.02, 0.12, s * 0.25], [bx1 - 0.05, 0.12, s * 0.2], 0.014, C), bar([bx0 - 0.02, 0.12, s * 0.25], [bx0 - 0.05, top + 0.05, s * 0.28], 0.014, C), bar([bx1 - 0.05, 0.12, s * 0.2], [bx1 - 0.1, bot, s * 0.2], 0.012, C));
		for (const x of [bx0 - 0.02, bx1 - 0.05]) parts.push(cyl(0.05, 0.05, 0.035, 8, x, 0.05, s * 0.22, [0.15, 0.15, 0.16], { rx: Math.PI / 2 }));
	}
	parts.push(bar([bx0 - 0.1, top + 0.06, -0.3], [bx0 - 0.1, top + 0.06, 0.3], 0.018, [0.75, 0.15, 0.12]));
	return merge(parts);
}
// the cart's basket: its five wire faces (uv: the wire texture's repeat)
function cartWire() {
	const P = [], U = [], q = (a, b, c, d, su, sv) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); U.push(0, 0, su, 0, su, sv, 0, 0, su, sv, 0, sv); };
	const x0 = -0.45, x1 = 0.45, t = 0.98, b = 0.5;
	for (const s of [-1, 1]) q([x0, b, s * 0.26], [x1 - 0.08, b, s * 0.2], [x1, t, s * 0.24], [x0, t, s * 0.28], 9, 5);
	q([x1 - 0.08, b, -0.2], [x1 - 0.08, b, 0.2], [x1, t, 0.24], [x1, t, -0.24], 5, 5);
	q([x0, b, 0.26], [x0, b, -0.26], [x0, t, -0.28], [x0, t, 0.28], 5, 5);
	q([x0, b, -0.26], [x1 - 0.08, b, -0.2], [x1 - 0.08, b, 0.2], [x0, b, 0.26], 9, 5);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
	g.computeVertexNormals();
	return g;
}

// ---------- litter ----------
// a plastic bag: a crumpled, flattened lump, knotted at one end
function bag() {
	const g = new THREE.IcosahedronGeometry(0.16, 1), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.75 + hash(x * 40 + 3, z * 40 + y * 17) * 0.5; P.setXYZ(i, x * k * 1.2, y * k * 0.45 + 0.07, z * k); }
	g.computeVertexNormals();
	return merge([part(g, 0, 0, 0, (x, y) => { const k = 0.85 + y * 1.2; return [k, k, k]; }), cyl(0.02, 0.035, 0.08, 5, 0.22, 0.07, 0, [1, 1, 1], { rz: Math.PI / 2 })]);
}
// a bag snagged on a fence: stretched out flat by the wind, torn at the edge
function snag() {
	const g = new THREE.PlaneGeometry(0.4, 0.3, 4, 3), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setXYZ(i, x * (1 - (y + 0.15) * 0.8), y, (hash(x * 30 + 7, y * 30) - 0.5) * 0.08 + Math.sin(x * 12) * 0.02); }
	g.computeVertexNormals();
	return merge([part(g, 0, 0, 0, (x, y) => { const k = 0.8 + (y + 0.15) * 0.6; return [k, k, k]; })]);
}
const can = () => merge([cyl(0.033, 0.033, 0.122, 9, 0, 0.033, 0, (x, y) => { const k = Math.abs(y) > 0.055 ? 0.75 : 1; return [k, k, k]; }, { rz: Math.PI / 2, sx: 1, sy: 1, sz: 1 }).applyMatrix4(new THREE.Matrix4().makeRotationY(0.3))]);
const cup = () => merge([tube(0.045, 0.032, 0.14, 9, 0, 0.042, 0, [1, 1, 1], { rz: Math.PI / 2 + 0.25 }), cyl(0.047, 0.047, 0.012, 9, 0.075, 0.06, 0, [0.9, 0.9, 0.9], { rz: Math.PI / 2 + 0.25 })]);
function paper() {
	const g = new THREE.PlaneGeometry(0.22, 0.29, 3, 3), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); P.setZ(i, Math.abs(x) * 0.12 + hash(x * 50 + 1, y * 50) * 0.02); }
	g.computeVertexNormals();
	return merge([part(g, 0, 0.01, 0, [1, 1, 1], { rx: -Math.PI / 2 })]);
}
const bottle = () => merge([cyl(0.035, 0.035, 0.2, 8, 0, 0.035, 0, [1, 1, 1], { rz: Math.PI / 2 }), cyl(0.013, 0.03, 0.08, 7, 0.13, 0.035, 0, [1, 1, 1], { rz: -Math.PI / 2 })]);

// ---------- weeds and dry grass: three crossed cards of blades ----------
function tuftGeo(h = 1) {
	const P = [], U = [], C = [];
	for (let k = 0; k < 3; k++) {
		const a = k * Math.PI / 3, c = Math.cos(a) * 0.5, s = Math.sin(a) * 0.5;
		P.push(-c, 0, -s, c, 0, s, c, h, s, -c, 0, -s, c, h, s, -c, h, -s);
		U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
		for (const y of [0, 0, 1, 0, 1, 1]) C.push(0.55 + y * 0.45, 0.55 + y * 0.45, 0.55 + y * 0.45);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
	g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length / 3).fill([0, 1, 0]).flat(), 3));
	return g;
}

// ---------- a camp ----------
// a dome tent: a low, squashed dome over a rectangle, the door at +x, a fly over it
function tent() {
	const g = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); P.setXYZ(i, x * 1.15 * (1 + (hash(i, 7) - 0.5) * 0.04), Math.pow(Math.max(0, y), 0.8) * 1.15, z * 1.05); }
	g.computeVertexNormals();
	// the fly's seams along the two crossed poles show darker; the door dark
	const parts = [part(g, 0, 0, 0, (x, y, z) => { const seam = Math.min(Math.abs(x / 1.15 - z / 1.05), Math.abs(x / 1.15 + z / 1.05)) < 0.12 ? 0.75 : 1; const k = (0.82 + y * 0.2) * seam - (x > 0.7 && Math.abs(z) < 0.4 && y < 0.95 ? 0.45 : 0); return [k, k, k]; })];
	// the poles over it, crossed, and the guy lines' pegs
	for (const s of [-1, 1]) { const P2 = []; for (let k = 0; k <= 10; k++) { const t = k / 10 * Math.PI; P2.push([Math.cos(t) * 1.18, Math.sin(t) * 1.17, Math.cos(t) * 1.08 * s]); } for (let k = 0; k < 10; k++) parts.push(bar(P2[k], P2[k + 1], 0.012, [0.25, 0.25, 0.27], 4)); }
	for (const [x, z] of [[1.5, 1.3], [-1.5, 1.3], [1.5, -1.3], [-1.5, -1.3]]) parts.push(bar([x * 0.78, 0.55, z * 0.8], [x, 0.01, z], 0.004, [0.8, 0.8, 0.7], 3));
	return merge(parts);
}
// a tarp lean-to: a sheet tied high at one end (to a fence, a post) and pegged low at the
// other, sagging between, open on the sides
function tarp() {
	const g = new THREE.PlaneGeometry(3, 2.6, 6, 5), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) {
		const x = P.getX(i), y = P.getY(i), t = (y + 1.3) / 2.6;
		P.setXYZ(i, x, 0.25 + t * 1.45 - Math.sin(Math.PI * t) * 0.18 - Math.sin(Math.PI * (x / 3 + 0.5)) * 0.08 + hash(i, 3) * 0.03, -1.3 + t * 2.3);
	}
	g.computeVertexNormals();
	return merge([part(g, 0, 0, 0, (x, y) => { const k = 0.8 + y * 0.12; return [k, k, k]; }), cyl(0.025, 0.025, 1.75, 5, -1.45, 0.87, 1.0, [0.45, 0.4, 0.33]), cyl(0.025, 0.025, 1.75, 5, 1.45, 0.87, 1.0, [0.45, 0.4, 0.33])]);
}
// a folding camp chair (seat 0.42 m up), facing +z
function chair() {
	const L = [0.2, 0.2, 0.22], parts = [];
	for (const s of [-1, 1]) { parts.push(bar([s * 0.25, 0, -0.25], [s * 0.25, 0.44, 0.22], 0.012, L), bar([s * 0.25, 0, 0.22], [s * 0.25, 0.44, -0.25], 0.012, L), bar([s * 0.25, 0.44, -0.25], [s * 0.26, 0.9, -0.33], 0.012, L), bar([s * 0.25, 0.62, -0.28], [s * 0.26, 0.62, 0.15], 0.015, L)); }
	parts.push(box(0.5, 0.03, 0.45, 0, 0.42, 0, [1, 1, 1], { rx: 0.08 }), box(0.5, 0.45, 0.03, 0, 0.66, -0.3, [0.92, 0.92, 0.92], { rx: -0.15 }));
	return merge(parts);
}
// a bicycle standing on its kickstand, along x
function bike() {
	const F = [1, 1, 1], T = [0.08, 0.08, 0.08], parts = [];
	for (const x of [-0.52, 0.52]) { parts.push(part(new THREE.TorusGeometry(0.34, 0.02, 5, 20), x, 0.35, 0, T)); parts.push(cyl(0.02, 0.02, 0.06, 6, x, 0.35, 0, [0.6, 0.6, 0.6], { rx: Math.PI / 2 })); }
	const bb = [0, 0.3, 0], seat = [-0.18, 0.78, 0], head = [0.36, 0.8, 0];
	parts.push(bar(bb, seat, 0.02, F), bar(seat, head, 0.018, F), bar(bb, head, 0.022, F), bar(bb, [-0.52, 0.35, 0.04], 0.012, F), bar(seat, [-0.52, 0.35, 0.04], 0.012, F), bar(head, [0.52, 0.35, 0], 0.016, F));
	parts.push(box(0.22, 0.05, 0.1, -0.2, 0.86, 0, [0.08, 0.08, 0.08]), bar([0.36, 0.95, -0.25], [0.36, 0.95, 0.25], 0.013, [0.1, 0.1, 0.1]), bar(head, [0.36, 0.95, 0], 0.016, [0.6, 0.6, 0.6]));
	return merge(parts).rotateX(0.06);
}
const bucket = () => merge([tube(0.15, 0.14, 0.37, 12, 0, 0.185, 0, [1, 1, 1]), cyl(0.14, 0.14, 0.01, 12, 0, 0.01, 0, [0.8, 0.8, 0.8]), tube(0.152, 0.152, 0.03, 12, 0, 0.35, 0, [0.9, 0.9, 0.9])]);
// a milk crate: an open box with a darker lattice
function crate() {
	const parts = [box(0.33, 0.02, 0.33, 0, 0.01, 0, [0.8, 0.8, 0.8])];
	for (const s of [-1, 1]) { parts.push(box(0.33, 0.28, 0.02, 0, 0.14, s * 0.155, (x, y) => { const k = Math.abs(((y * 18) % 1) - 0.5) < 0.2 ? 0.7 : 1; return [k, k, k]; })); parts.push(box(0.02, 0.28, 0.33, s * 0.155, 0.14, 0, [0.95, 0.95, 0.95])); }
	return merge(parts);
}
const cooler = () => merge([box(0.62, 0.36, 0.38, 0, 0.18, 0, [1, 1, 1]), box(0.64, 0.07, 0.4, 0, 0.395, 0, [0.95, 0.95, 0.95]), box(0.2, 0.03, 0.04, 0, 0.44, 0, [0.3, 0.3, 0.3])]);
// a one-burner stove on its canister, a pot on it
const stove = () => merge([cyl(0.055, 0.055, 0.1, 10, 0, 0.05, 0, [0.85, 0.35, 0.12]), cyl(0.06, 0.06, 0.03, 8, 0, 0.115, 0, [0.35, 0.35, 0.36]), tube(0.1, 0.1, 0.12, 12, 0, 0.19, 0, [0.72, 0.72, 0.74]), cyl(0.1, 0.1, 0.01, 12, 0, 0.13, 0, [0.5, 0.5, 0.52]), bar([0.1, 0.24, 0], [0.24, 0.24, 0], 0.008, [0.2, 0.2, 0.2])]);
// a bag of belongings: a duffel, a backpack, a trash bag full of clothes (by its scale)
function duffel() {
	const g = new THREE.SphereGeometry(0.2, 10, 7), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.92 + hash(i * 3, 11) * 0.12; P.setXYZ(i, x * 2 * k, Math.max(-0.19, y) * 0.9 * k, z * 1.05 * k); }
	g.computeVertexNormals();
	return merge([part(g, 0, 0.18, 0, (x, y) => { const k = 0.85 + y * 0.6; return [k, k, k]; }), bar([-0.15, 0.36, 0], [0.15, 0.36, 0], 0.012, [0.2, 0.2, 0.2])]);
}
// a sleeping bag with someone asleep in it, the hood drawn up round a knit cap: head at +x
function sleeper() {
	const g = new THREE.SphereGeometry(1, 14, 8), P = g.attributes.position;
	for (let i = 0; i < P.count; i++) {
		const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (x + 1) / 2;
		// broad at the shoulders, narrow at the feet, the shape of someone on their side
		const r = 0.22 + 0.08 * Math.sin(Math.PI * Math.min(1, t * 1.25)) - 0.05 * (1 - t), hip = 1 + 0.12 * Math.exp(-((t - 0.45) ** 2) / 0.01);
		P.setXYZ(i, x * 0.95, Math.max(-0.2, y * r * 1.05 * hip) + r * 0.9, z * r * 1.2 * hip + Math.sin(t * 3.2) * 0.04);
	}
	g.computeVertexNormals();
	const parts = [part(g, 0, 0, 0, (x, y) => { const k = 0.85 + y * 0.35 + (hash(Math.floor(x * 7), 3) - 0.5) * 0.08; return [k, k, k]; })];
	// the knit cap in the hood's opening, a pillow of folded clothes under it
	parts.push(part(new THREE.SphereGeometry(0.1, 10, 7), 0.94, 0.28, 0.02, [0.25, 0.24, 0.26], { sx: 1, sy: 1.1, sz: 0.9 }));
	parts.push(box(0.36, 0.1, 0.46, 0.98, 0.05, 0, [0.42, 0.4, 0.36]));
	// a mat under it all
	parts.push(box(2.05, 0.02, 0.62, 0.05, 0.01, 0, [0.2, 0.3, 0.45]));
	return merge(parts);
}
// a book, open, face down on a crate or held (edgecamp.js moves the held ones)
export const bookGeo = () => merge([box(0.15, 0.022, 0.2, -0.078, 0.011, 0, [0.62, 0.2, 0.16], { rz: -0.12 }), box(0.15, 0.022, 0.2, 0.078, 0.011, 0, [0.62, 0.2, 0.16], { rz: 0.12 }), box(0.3, 0.015, 0.19, 0, 0.022, 0, [0.95, 0.93, 0.86])]);

// every kind: geometry, capacity (desktop), material key, shadows
export function makeKit() {
	return {
		cont20: { geo: container(6.06), max: 90, shadow: true },
		cont40: { geo: container(12.19), max: 70, shadow: true },
		pallet: { geo: pallet(), max: 320 },
		tyre: { geo: tyre(), max: 260 },
		drum: { geo: drum(), max: 200, shadow: true },
		dumpster: { geo: dumpster(), max: 40, shadow: true },
		jersey: { geo: jersey(), max: 120, shadow: true },
		gate: { geo: gate(), max: 30 },
		cart: { geo: cartFrame(), max: 50 },
		cartWire: { geo: cartWire(), max: 50, mat: 'wire' },
		bag: { geo: bag(), max: 900 },
		snag: { geo: snag(), max: 500, mat: 'soft' },
		can: { geo: can(), max: 700 },
		cup: { geo: cup(), max: 500 },
		paper: { geo: paper(), max: 600, mat: 'soft' },
		bottle: { geo: bottle(), max: 300 },
		weed: { geo: tuftGeo(1), max: 7000, mat: 'tuft' },
		tent: { geo: tent(), max: 40, shadow: true, mat: 'soft' },
		tarp: { geo: tarp(), max: 30, shadow: true, mat: 'soft' },
		chair: { geo: chair(), max: 40 },
		bike: { geo: bike(), max: 30 },
		bucket: { geo: bucket(), max: 60 },
		crate: { geo: crate(), max: 80 },
		cooler: { geo: cooler(), max: 30 },
		stove: { geo: stove(), max: 20 },
		duffel: { geo: duffel(), max: 120, mat: 'soft' },
		post: { geo: cyl(1, 1, 1, 6, 0, 0.5, 0, [1, 1, 1]), max: 2600 },
	};
}

// ---------- textures ----------
const canvasTex = (w, h, draw, srgb = true) => {
	const c = document.createElement('canvas'); c.width = w; c.height = h;
	draw(c.getContext('2d'), w, h);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
	if (srgb) t.colorSpace = THREE.SRGBColorSpace;
	return t;
};
// the chain link: diamond mesh on a clear ground, one repeat 3 m by 2 m... drawn as 0.06 m diamonds
export const chainTex = () => canvasTex(128, 128, (g) => {
	g.strokeStyle = 'rgba(160,164,166,1)'; g.lineWidth = 1.3;
	for (let x = -128; x < 256; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 128, 128); g.stroke(); g.beginPath(); g.moveTo(x, 128); g.lineTo(x + 128, 0); g.stroke(); }
});
// privacy slats woven through the link: green, white or brown, some broken out
export const slatTex = () => canvasTex(256, 64, (g, w, h) => {
	for (let k = 0; k < 64; k++) {
		const r = hash(k, 91);
		if (r < 0.12) continue;
		const x = k * 4, top = r < 0.2 ? h * (0.3 + r) : 0;
		const s = 200 + Math.floor(hash(k, 3) * 40);
		g.fillStyle = `rgb(${s},${s},${s})`;
		g.fillRect(x, top, 3.4, h - top);
	}
});
// a cart's wire grid
export const wireTex = () => canvasTex(32, 32, (g) => { g.strokeStyle = 'rgba(200,202,205,1)'; g.lineWidth = 2; g.strokeRect(1, 1, 30, 30); });
// grass blades: a fan of tapering strokes, lighter to the tips
export const bladeTex = () => canvasTex(128, 128, (g) => {
	for (let k = 0; k < 26; k++) {
		const x = 10 + hash(k, 1) * 108, lean = (hash(k, 2) - 0.5) * 50, top = 8 + hash(k, 3) * 60, w = 2 + hash(k, 4) * 2.5;
		const s = 150 + Math.floor(hash(k, 5) * 100);
		g.fillStyle = `rgb(${s},${s},${s})`;
		g.beginPath(); g.moveTo(x - w, 128); g.quadraticCurveTo(x + lean * 0.3, 70, x + lean, top); g.quadraticCurveTo(x + lean * 0.3 + w * 0.5, 70, x + w, 128); g.closePath(); g.fill();
		// a seed head on some
		if (hash(k, 6) > 0.7) { g.beginPath(); g.ellipse(x + lean, top + 6, 2.2, 7, lean / 90, 0, Math.PI * 2); g.fill(); }
	}
});

// the tags: eight panels of abstract spray paint on a clear ground, in a 4 x 2 atlas.
// Bubble throw-ups, swooping wild strokes with arrows, drips, looping scribbles, stars and
// rings, and a square of grey where the city buffed one out. Shapes, never letters.
export function tagAtlas() {
	const PAINT = ['#d8dade', '#15151a', '#c8302a', '#2a5fc0', '#8ccf2a', '#e062a8', '#f08a20', '#f2f2ec', '#6a3aa0', '#20a0a0'];
	return canvasTex(1024, 512, (g) => {
		for (let t = 0; t < 8; t++) {
			const ox = (t % 4) * 256, oy = Math.floor(t / 4) * 256, r = (k) => hash(t * 97 + k, 13 + t);
			g.save(); g.beginPath(); g.rect(ox + 4, oy + 4, 248, 248); g.clip(); g.translate(ox, oy);
			const fill = PAINT[Math.floor(r(1) * PAINT.length)], line = PAINT[(Math.floor(r(2) * 3) + 1) % 2 === 0 ? 1 : 7];
			g.lineJoin = g.lineCap = 'round';
			if (t === 7) {
				// the buff: flat grey roller paint, a little off the wall's colour, a ghost of a line under it
				g.fillStyle = 'rgba(128,124,118,0.95)'; g.fillRect(30, 60, 190, 120);
				g.strokeStyle = 'rgba(60,60,64,0.25)'; g.lineWidth = 7; g.beginPath(); g.moveTo(40, 150); g.bezierCurveTo(90, 60, 150, 190, 210, 90); g.stroke();
			} else if (t % 3 === 0) {
				// a throw-up: fat overlapping blobs, outlined, a highlight, a shadow drop
				const n = 3 + Math.floor(r(3) * 3), pts = [];
				for (let k = 0; k < n; k++) pts.push([45 + k * (170 / n) + r(10 + k) * 20, 110 + (r(20 + k) - 0.5) * 50, 26 + r(30 + k) * 22]);
				for (const [pass, col, grow] of [[0, 'rgba(0,0,0,0.55)', 16], [1, line, 11], [2, fill, 0]]) {
					g.fillStyle = col;
					for (const [x, y, rad] of pts) { g.beginPath(); g.ellipse(x + (pass === 0 ? 6 : 0), y + (pass === 0 ? 7 : 0), rad + grow, (rad + grow) * 1.25, (r(x) - 0.5) * 0.6, 0, Math.PI * 2); g.fill(); }
				}
				g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4;
				for (const [x, y, rad] of pts) { g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.4, rad * 0.5, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
			} else if (t % 3 === 1) {
				// swooping strokes, thick, outlined, ending in points and arrows
				const strokes = 2 + Math.floor(r(4) * 3);
				for (const [col, wd] of [[line, 30], [fill, 18]]) {
					g.strokeStyle = col; g.lineWidth = wd;
					for (let k = 0; k < strokes; k++) {
						const y0 = 70 + r(40 + k) * 110;
						g.beginPath(); g.moveTo(25 + r(50 + k) * 30, y0);
						g.bezierCurveTo(80 + r(60 + k) * 40, y0 - 90 + r(70 + k) * 60, 140 + r(80 + k) * 40, y0 + 80 - r(90 + k) * 60, 220 - r(95 + k) * 20, y0 - 20 + r(99 + k) * 40);
						g.stroke();
					}
				}
				g.fillStyle = line;
				const ax = 225, ay = 60 + r(5) * 120;
				g.beginPath(); g.moveTo(ax + 22, ay); g.lineTo(ax - 12, ay - 22); g.lineTo(ax - 6, ay); g.lineTo(ax - 12, ay + 22); g.closePath(); g.fill();
			} else {
				// a looping scribble in one colour, fast and thin, with a couple of drips; a ring or a star
				g.strokeStyle = fill === '#f2f2ec' ? '#15151a' : fill; g.lineWidth = 5;
				g.beginPath();
				let x = 30, y = 120 + (r(6) - 0.5) * 60;
				g.moveTo(x, y);
				for (let k = 0; k < 9; k++) { const nx = x + 18 + r(100 + k) * 10, ny = 120 + (r(110 + k) - 0.5) * 110; g.bezierCurveTo(x + 30, y - 60 * (k % 2 ? 1 : -1), nx - 30, ny + 50 * (k % 2 ? -1 : 1), nx, ny); x = nx; y = ny; }
				g.stroke();
				g.lineWidth = 3;
				for (let k = 0; k < 3; k++) { const dx = 50 + r(120 + k) * 150, dy = 110 + r(130 + k) * 40; g.beginPath(); g.moveTo(dx, dy); g.lineTo(dx, dy + 20 + r(140 + k) * 50); g.stroke(); }
				if (r(7) > 0.5) { g.lineWidth = 6; g.beginPath(); g.arc(205, 70, 22, 0, Math.PI * 2); g.stroke(); }
				else { g.fillStyle = PAINT[Math.floor(r(8) * 6)]; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rad = k % 2 ? 9 : 22; g.lineTo(200 + Math.cos(a) * rad, 70 + Math.sin(a) * rad); } g.closePath(); g.fill(); }
			}
			// overspray: a faint mist round it all
			g.globalAlpha = 0.08; g.fillStyle = fill;
			for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(20 + r(200 + k) * 216, 40 + r(300 + k) * 170, 3 + r(400 + k) * 6, 0, Math.PI * 2); g.fill(); }
			g.globalAlpha = 1;
			g.restore();
		}
	});
}
// (for edgecamp.js: the sleeper, the held book, a cart that moves)
export { sleeper as sleeperGeo, cartFrame as cartFrameGeo, cartWire as cartWireGeo };
