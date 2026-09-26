// The Bay Area's freeways as you see them from the driver's seat, on the mapped roads
// round you: pale concrete carriageways (painted in realcity.js), a concrete barrier
// down the median, tall block sound walls where the freeway passes houses, and the
// overpasses: every mapped bridge lifted clear of what it crosses, a concrete box girder
// with parapets and a chain-link fence on top, columns and bent caps under it where it
// isn't over a lane, and the green overhead signs on its face toward the traffic. The
// decks are floors: you walk and drive over them (floor()).
// Rebuilt round you as you move, like the city.

import * as THREE from 'three';
import { ROUTES } from './roads.js';
import { toWorld } from './geo.js';

// where the freeways go, for the signs (by route number and direction of travel)
const DEST = {
	680: { N: 'Sacramento', S: 'San Jose' }, 580: { W: 'Oakland  San Francisco', E: 'Stockton', N: 'San Rafael', S: 'Oakland' }, 80: { E: 'Sacramento', W: 'San Francisco', N: 'Sacramento', S: 'San Francisco' },
	880: { N: 'Oakland', S: 'San Jose' }, 101: { N: 'San Francisco', S: 'San Jose' }, 280: { N: 'San Francisco', S: 'San Jose' }, 24: { E: 'Walnut Creek', W: 'Oakland', N: 'Walnut Creek', S: 'Oakland' }, 4: { E: 'Antioch', W: 'Martinez', N: 'Martinez', S: 'Antioch' },
};

// the route a freeway is (the mapped ones carry names like "Donald D Doyle Highway",
// not numbers): the nearest of the known alignments
let ROUTE_PTS = null;
function routeOf(x, z) {
	if (!ROUTE_PTS) ROUTE_PTS = Object.entries(ROUTES).map(([k, ll]) => [(/(\d+)/.exec(k) || [])[1], ll.map(([a, b]) => toWorld(a, b))]);
	let best = null, bd = 1500;
	for (const [num, pts] of ROUTE_PTS) for (let i = 0; i + 1 < pts.length; i++) {
		const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
		const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
		if (d < bd) { bd = d; best = num; }
	}
	return best;
}
// the chain link: a diamond mesh between posts, on a transparent ground
function chainLink() {
	const c = document.createElement('canvas');
	c.width = 128; c.height = 64;
	const g = c.getContext('2d');
	g.strokeStyle = 'rgba(150,154,156,0.95)'; g.lineWidth = 1.2;
	for (let x = -64; x < 192; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 64, 64); g.stroke(); g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 64, 0); g.stroke(); }
	g.fillStyle = 'rgba(120,124,126,1)'; g.fillRect(0, 0, 4, 64); g.fillRect(0, 0, 128, 3); g.fillRect(0, 61, 128, 3);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}
// a green freeway sign: the shield, the direction, the city
const signTex = new Map();
function signTexture(num, dir, dest) {
	const key = num + dir + dest;
	if (signTex.has(key)) return signTex.get(key);
	const c = document.createElement('canvas');
	c.width = 512; c.height = 200;
	const g = c.getContext('2d');
	g.fillStyle = '#0f6b3c'; g.fillRect(0, 0, 512, 200);
	g.strokeStyle = '#f2f2ee'; g.lineWidth = 5; g.strokeRect(8, 8, 496, 184);
	// the interstate shield (blue and red) or a state route's spade (white)
	const inter = [80, 280, 580, 680, 880].includes(+num);
	g.save(); g.translate(70, 92);
	g.beginPath(); g.moveTo(-42, -40); g.quadraticCurveTo(0, -52, 42, -40); g.lineTo(42, 5); g.quadraticCurveTo(38, 42, 0, 55); g.quadraticCurveTo(-38, 42, -42, 5); g.closePath();
	g.fillStyle = inter ? '#1c3f94' : '#f2f2ee'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#f2f2ee'; g.stroke();
	if (inter) { g.fillStyle = '#c8202a'; g.fillRect(-40, -44, 80, 16); }
	g.fillStyle = inter ? '#f2f2ee' : '#111'; g.font = `bold ${String(num).length > 2 ? 30 : 38}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.fillText(num, 0, 22);
	g.restore();
	g.fillStyle = '#f2f2ee'; g.textAlign = 'left';
	g.font = 'bold 30px Arial, Helvetica, sans-serif'; g.fillText({ N: 'NORTH', S: 'SOUTH', E: 'EAST', W: 'WEST' }[dir], 130, 62);
	g.font = 'bold 44px Arial, Helvetica, sans-serif';
	const words = dest.split('  ');
	words.forEach((w, i) => g.fillText(w, 130, 112 + i * 48));
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	signTex.set(key, t);
	return t;
}

// geometry, flat-shaded, with vertex colours
function Geo() {
	const P = [], C = [];
	const tri = (a, b, c, col) => { P.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) C.push(col[0], col[1], col[2]); };
	const quad = (a, b, c, d, col) => { tri(a, b, c, col); tri(a, c, d, col); };
	// sweep a cross-section along a path: path points {x, z, y, nx, nz} (n: the left normal),
	// profile [[across, up], ...]; closed profiles join the last point to the first
	const sweep = (path, prof, col, closed = false) => {
		const n = prof.length - (closed ? 0 : 1);
		for (let i = 0; i + 1 < path.length; i++) {
			const A = path[i], B = path[i + 1];
			const pa = (p) => [A.x + A.nx * p[0], A.y + p[1], A.z + A.nz * p[0]], pb = (p) => [B.x + B.nx * p[0], B.y + p[1], B.z + B.nz * p[0]];
			const cc = typeof col === 'function' ? col(i) : col;
			for (let k = 0; k < n; k++) { const p0 = prof[k], p1 = prof[(k + 1) % prof.length]; quad(pa(p0), pb(p0), pb(p1), pa(p1), cc); }
		}
	};
	// an upright box, turned by yaw
	const box = (x, y0, z, sx, sy, sz, yaw, col) => {
		const c = Math.cos(yaw), s = Math.sin(yaw);
		const v = (a, b, h) => [x + c * a - s * b, y0 + h, z + s * a + c * b];
		const X = sx / 2, Z = sz / 2;
		const q = [v(-X, -Z, 0), v(X, -Z, 0), v(X, Z, 0), v(-X, Z, 0), v(-X, -Z, sy), v(X, -Z, sy), v(X, Z, sy), v(-X, Z, sy)];
		quad(q[4], q[5], q[6], q[7], col); quad(q[0], q[1], q[5], q[4], col); quad(q[1], q[2], q[6], q[5], col); quad(q[2], q[3], q[7], q[6], col); quad(q[3], q[0], q[4], q[7], col);
	};
	const mesh = (mat) => {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
		g.computeVertexNormals();
		return new THREE.Mesh(g, mat);
	};
	return { sweep, box, mesh, size: () => P.length / 3 };
}

// a polyline's points every `step` metres, with the left normal (the direction's left in
// this world: x east, z south) at each
function resample(pts, step) {
	const out = [];
	for (let i = 0; i + 3 < pts.length; i += 2) {
		const ax = pts[i], az = pts[i + 1], bx = pts[i + 2], bz = pts[i + 3], L = Math.hypot(bx - ax, bz - az);
		if (L < 0.01) continue;
		const n = Math.max(1, Math.ceil(L / step));
		for (let k = i ? 1 : 0; k <= n; k++) out.push({ x: ax + (bx - ax) * k / n, z: az + (bz - az) * k / n, dx: (bx - ax) / L, dz: (bz - az) / L });
	}
	for (const p of out) { p.nx = p.dz; p.nz = -p.dx; }
	return out;
}
function distTo(r, x, z) {
	let best = 1e9;
	const p = r.pts;
	for (let i = 0; i + 3 < p.length; i += 2) {
		const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
		const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
		best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return best;
}

export function createFreeways(scene, bay, real, { isPhone = false } = {}) {
	const group = new THREE.Group();
	group.name = 'freeways';
	scene.add(group);
	const concrete = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide });
	const fenceTex = chainLink();
	const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, transparent: false, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
	const R = isPhone ? 900 : 1400;
	let at = { x: 1e9, z: 1e9 }, ver = -1;
	let decks = [];                                  // for the floors: [{ pts: [{x,z,y}], hw }]
	const grid = new Map();                          // 25 m cells -> deck segments
	const cellKey = (x, z) => Math.floor(x / 25) + ',' + Math.floor(z / 25);

	function clear() {
		for (const m of [...group.children]) { group.remove(m); m.geometry.dispose(); if (m.material !== concrete && m.material !== fenceMat) m.material.dispose(); }
		decks = []; grid.clear();
	}

	function build(cx, cz) {
		clear();
		const H = (x, z) => bay.heightAt(x, z);
		const roads = real.near('roads', cx, cz, R).filter((r) => r.drive);
		const lanes = roads.filter((r) => !r.bridge);
		const G = Geo(), F = [];                         // concrete; fences as [path, lo, hi]
		const CON = [0.66, 0.64, 0.6], WALL = [0.6, 0.56, 0.49], ASPH = [0.26, 0.26, 0.27];
		const tint = (base, i, k = 0.05) => { const h = Math.sin(i * 12.9898) * 43758.5453 % 1; const f = 1 + (Math.abs(h) - 0.5) * k * 2; return base.map((c) => c * f); };

		// ---- the freeways: barrier down the median, sound walls beside the houses ----
		for (const r of roads) {
			if (r.cls !== 'motorway' || r.bridge) continue;
			const hw = r.w / 2, path = resample(r.pts, 8);
			if (!r.link) {
				// the median barrier on the left of the direction of travel
				const bp = path.map((p) => { const x = p.x + p.nx * (hw + 0.45), z = p.z + p.nz * (hw + 0.45); return { x, z, y: H(x, z) - 0.06, nx: p.nx, nz: p.nz }; });
				G.sweep(bp, [[-0.3, -0.2], [-0.3, 0.08], [-0.1, 0.33], [-0.075, 0.84], [0.075, 0.84], [0.1, 0.33], [0.3, 0.08], [0.3, -0.2]], CON);
			}
			// sound walls on the right where houses back onto the freeway, broken at ramps and
			// cross streets
			let run = [];
			const flush = () => {
				if (run.length > 3) {
					G.sweep(run, [[-0.16, -0.6], [-0.16, 4.3], [0.16, 4.3], [0.16, -0.6]], (i) => tint(WALL, Math.floor(i / 2), 0.04));
					G.sweep(run, [[-0.24, 4.3], [-0.24, 4.5], [0.24, 4.5], [0.24, 4.3]], [0.52, 0.49, 0.44]);
				}
				run = [];
			};
			for (const p of path) {
				const off = -(hw + (r.link ? 1.5 : 3.2)), x = p.x + p.nx * off, z = p.z + p.nz * off;
				const L = real.landAt(p.x + p.nx * (off - 22), p.z + p.nz * (off - 22));
				const houses = !!L && L.lu === 1;
				const crossing = houses && lanes.some((q) => q !== r && q.cls !== 'motorway' && Math.abs(q.box[0] + q.box[2] - 2 * x) < (q.box[2] - q.box[0]) + 30 && Math.abs(q.box[1] + q.box[3] - 2 * z) < (q.box[3] - q.box[1]) + 30 && distTo(q, x, z) < q.w / 2 + 9);
				if (houses && !crossing) run.push({ x, z, y: H(x, z), nx: p.nx, nz: p.nz });
				else flush();
			}
			flush();
		}

		// ---- the overpasses ----
		const signs = [];
		for (const r of roads) {
			if (!r.bridge) continue;
			const hw = r.w / 2, W = r.w + 1.2, path = resample(r.pts, 4);
			if (path.length < 2) continue;
			const n = path.length;
			// what passes under each point, and the clearance it needs
			const below = path.map((p) => {
				let need = -1e9, over = null;
				for (const q of lanes) {
					if (q === r || p.x < q.box[0] - 30 || p.x > q.box[2] + 30 || p.z < q.box[1] - 30 || p.z > q.box[3] + 30) continue;
					const d = distTo(q, p.x, p.z);
					if (d < q.w / 2 + 3) { const c = H(p.x, p.z) + (q.cls === 'motorway' || q.cls === 'trunk' ? 6.9 : 5.6); if (c > need) { need = c; over = q; } }
				}
				return { need, over };
			});
			// the deck: from the ground at its ends, lifted over what it crosses, ramped at 6%
			const y0 = H(path[0].x, path[0].z), y1 = H(path[n - 1].x, path[n - 1].z);
			let L = 0;
			const s = path.map((p, i) => (i ? (L += Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z)) : 0));
			const ys = path.map((p, i) => {
				let y = y0 + (y1 - y0) * s[i] / (L || 1);
				for (let j = 0; j < n; j++) if (below[j].over) y = Math.max(y, below[j].need - Math.abs(s[i] - s[j]) * 0.06);
				return Math.max(y, H(p.x, p.z) + 0.25);
			});
			const deck = path.map((p, i) => ({ x: p.x, z: p.z, y: ys[i] + 0.2, nx: p.nx, nz: p.nz }));
			// road surface, parapets, the girder under it
			G.sweep(deck, [[-W / 2, 0], [W / 2, 0]], ASPH);
			for (const sd of [-1, 1]) G.sweep(deck, [[sd * W / 2, 0], [sd * W / 2, 0.95], [sd * (W / 2 + 0.38), 1.05], [sd * (W / 2 + 0.38), -0.55], [sd * W / 2, -0.55]], (i) => tint(CON, i, 0.03), false);
			G.sweep(deck, [[-W / 2 - 0.38, -0.55], [-W / 2 + 0.7, -1.75], [W / 2 - 0.7, -1.75], [W / 2 + 0.38, -0.55]], (i) => tint(CON, i, 0.03).map((c) => c * 0.86));
			// the fence along both parapets, where the deck stands clear of the ground
			for (const sd of [-1, 1]) {
				let f = [];
				for (let i = 0; i < n; i++) {
					if (deck[i].y - H(deck[i].x, deck[i].z) > 2.5) f.push({ x: deck[i].x + deck[i].nx * sd * (W / 2 + 0.19), z: deck[i].z + deck[i].nz * sd * (W / 2 + 0.19), y: deck[i].y, nx: deck[i].nx, nz: deck[i].nz });
					else { if (f.length > 1) F.push(f); f = []; }
				}
				if (f.length > 1) F.push(f);
			}
			// columns and bent caps, wherever the deck is high and nothing drives beneath
			let last = -1e9;
			for (let i = 1; i < n - 1; i++) {
				const p = deck[i], gy = H(p.x, p.z), clear = p.y - gy;
				if (clear < 3.2 || s[i] - last < 20) continue;
				let free = true;
				for (const q of lanes) { if (p.x < q.box[0] - 25 || p.x > q.box[2] + 25 || p.z < q.box[1] - 25 || p.z > q.box[3] + 25) continue; if (distTo(q, p.x, p.z) < q.w / 2 + 2.2) { free = false; break; } }
				if (!free) continue;
				last = s[i];
				// (the cap runs across the deck, along its normal)
				const yaw = Math.atan2(p.nz, p.nx), top = p.y - 1.75;
				G.box(p.x, top - 1.0, p.z, W * 0.82, 1.0, 1.4, yaw, tint(CON, i, 0.03));
				const cols = W > 13 ? [-W * 0.26, W * 0.26] : [0];
				for (const o of cols) G.box(p.x + p.nx * o, gy - 0.6, p.z + p.nz * o, 1.3, top - 1.0 - gy + 0.6, 1.3, yaw, tint(CON, i + 7, 0.03));
			}
			// the signs, on the face toward the traffic of each freeway it crosses
			const seen = new Set();
			for (let i = 0; i < n; i++) {
				const q = below[i].over;
				if (!q || q.cls !== 'motorway' || q.link || seen.has(q)) continue;
				seen.add(q);
				const num = (/(\d{1,3})/.exec(q.name || '') || [])[1] || routeOf(deck[i].x, deck[i].z);
				if (!num) continue;
				// the freeway's direction of travel here
				const qp = q.pts; let best = 0, bd = 1e9;
				for (let k = 0; k + 3 < qp.length; k += 2) { const d = Math.hypot((qp[k] + qp[k + 2]) / 2 - deck[i].x, (qp[k + 1] + qp[k + 3]) / 2 - deck[i].z); if (d < bd) { bd = d; best = k; } }
				let tx = qp[best + 2] - qp[best], tz = qp[best + 3] - qp[best + 1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
				const dir = Math.abs(tx) > Math.abs(tz) ? (tx > 0 ? 'E' : 'W') : (tz < 0 ? 'N' : 'S');
				const dest = DEST[+num]?.[dir] || q.name || 'Freeway';
				// the deck's face toward oncoming traffic: the side the traffic comes from
				const sd = Math.sign(deck[i].nx * -tx + deck[i].nz * -tz) || 1;
				const fx = deck[i].x + deck[i].nx * sd * (W / 2 + 0.45), fz = deck[i].z + deck[i].nz * sd * (W / 2 + 0.45);
				signs.push({ x: fx, y: deck[i].y - 0.35, z: fz, yaw: Math.atan2(-tx, -tz), num, dir, dest });
			}
			decks.push({ pts: deck, hw: W / 2 });
		}

		// meshes
		if (G.size()) { const m = G.mesh(concrete); m.castShadow = true; m.receiveShadow = true; group.add(m); }
		if (F.length) {
			const P = [], UV = [];
			for (const f of F) {
				let u = 0;
				for (let i = 0; i + 1 < f.length; i++) {
					const a = f[i], b = f[i + 1], du = Math.hypot(b.x - a.x, b.z - a.z) / 3.0;
					const A0 = [a.x, a.y + 1.05, a.z], A1 = [a.x, a.y + 2.9, a.z], B0 = [b.x, b.y + 1.05, b.z], B1 = [b.x, b.y + 2.9, b.z];
					P.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
					UV.push(u, 0, u + du, 0, u + du, 1, u, 0, u + du, 1, u, 1);
					u += du;
				}
			}
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
			g.computeVertexNormals();
			group.add(new THREE.Mesh(g, fenceMat));
		}
		for (const sg of signs) {
			const m = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.8), new THREE.MeshStandardMaterial({ map: signTexture(sg.num, sg.dir, sg.dest), roughness: 0.5 }));
			m.position.set(sg.x, sg.y, sg.z); m.rotation.y = sg.yaw;
			const back = new THREE.Mesh(new THREE.BoxGeometry(7.3, 2.9, 0.12), concrete);
			back.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(back.geometry.attributes.position.count * 3).fill(0.5), 3));
			back.position.set(0, 0, -0.08); m.add(back);
			m.castShadow = true;
			group.add(m);
		}
		// the decks, indexed for floor()
		decks.forEach((d, di) => { for (let i = 0; i + 1 < d.pts.length; i++) { const a = d.pts[i], b = d.pts[i + 1]; for (const k of new Set([cellKey(a.x, a.z), cellKey(b.x, b.z)])) { let c = grid.get(k); if (!c) grid.set(k, c = []); c.push([di, i]); } } });
	}

	// the deck under (x, z) if you are on it or above it (y: your feet's height less a margin)
	function floor(x, z, y) {
		let best = -1e9;
		for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
			const c = grid.get((Math.floor(x / 25) + gx) + ',' + (Math.floor(z / 25) + gz));
			if (!c) continue;
			for (const [di, i] of c) {
				const d = decks[di], a = d.pts[i], b = d.pts[i + 1];
				const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1, t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
				if (t < -0.02 || t > 1.02) continue;
				const off = Math.abs((x - a.x) * dz - (z - a.z) * dx) / Math.sqrt(l2);
				if (off > d.hw + 0.2) continue;
				const yd = a.y + (b.y - a.y) * Math.max(0, Math.min(1, t));
				if (y > yd - 2.2 && yd > best) best = yd;
			}
		}
		return best;
	}

	function update(camera) {
		if (!real?.loaded()) return;
		const x = camera.position.x, z = camera.position.z;
		const v = real.version ? real.version() : 0;
		if (camera.position.y > 3000) { group.visible = false; return; }
		group.visible = true;
		if (Math.hypot(x - at.x, z - at.z) < R * 0.3 && v === ver) return;
		at = { x, z }; ver = v;
		build(x, z);
	}
	return { group, update, floor, decks: () => decks.length };
}
