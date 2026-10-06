// The local roads out on the globe: everything below the highways (globeroads.js) that ties
// the homes, farms and villages to them, the way the land was settled.
//
//   the survey    where the land was surveyed in squares (the US Midwest and Plains, the
//                 Central Valley), a road on the section lines: every mile north–south and
//                 east–west, gravel mostly, blacktop every few miles; the valley's farm roads
//                 between the orchard blocks every quarter mile. The lines jog at each
//                 correction line (every 34 miles here) as they do on the ground. A line is
//                 left out over water, up a steep slope, and through a town (its own streets)
//   the lanes     elsewhere, lanes between the villages and out to the highway, found on the
//                 ground (A* over a corridor: they keep to the level and round the hills);
//                 each farm and hamlet joins the nearest bigger place or road
//   the places    the settlements' own streets, lanes and drives (region/layout.js), drawn
//                 the same way, and a drive from each door that stands back from them
//   drawn         ribbons laid on the ground vertex by vertex (every 8 m along, two or three
//                 across), a few centimetres up and graded with the berms like the highways;
//                 one small shader for the surfaces: marked asphalt, plain asphalt, gravel, dirt
//   driven        each one a road for the real city (bay/realcity.js addSource), split where
//                 another meets it so the driving (drive.js) can turn there
//
// The survey is a pure function of the latitude and longitude, built a tile (3 miles) at a
// time round you; the lanes are found a few milliseconds a frame.

import * as THREE from 'three';
import { F, toXZ, toLL } from './globeframe.js';
import { BERM_U, BERM_GLSL } from '../bay/berms.js';

const MILE = 1609.344, KZ = 110996, RAD = Math.PI / 180;
const BAND = 34;              // miles between correction lines
const STEP = 8;               // m between a ribbon's stations
const TILE = 3;               // miles a tile (the farm roads' tiles are a mile)
const inBay = (lat, lon) => lat > 36.93 && lat < 38.87 && lon > -123.6 && lon < -121.45;

// the two survey grids: the Midwest's mile sections, the valley's quarter-mile blocks
const PLSS = { id: 'plss', sub: 1, maxH: 2600 }, VALLEY = { id: 'valley', sub: 4, maxH: 160 };
export function surveyAt(lat, lon) {
	if (inBay(lat, lon)) return null;
	if (lat > 35 && lat < 40.6 && lon > -122.4 && lon < -118.8) return VALLEY;
	if (lat > 36.5 && lat < 49 && lon > -104.5 && lon < -80.6 && !(lon > -88.1 && lat < 37) && !(lon > -84.8 && lat < 38.6)) return PLSS;
	return null;
}
const dLatOf = (G) => MILE / G.sub / KZ;
const bandOf = (a, G) => Math.floor(a / (BAND * G.sub));
const dLonOf = (band, G) => MILE / G.sub / (111320 * Math.cos((band + 0.5) * BAND * MILE / KZ * RAD));
const hash = (a, b, k) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(k, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// a section line's segment: 'n' runs north from line a to a+1 at column b; 'e' runs east
// along line a from column b to b+1 (both in the band of line a)
function segEnds(G, dir, a, b) {
	const dLat = dLatOf(G), dl = dLonOf(bandOf(a, G), G);
	return dir === 'n' ? [a * dLat, b * dl, (a + 1) * dLat, b * dl] : [a * dLat, b * dl, a * dLat, (b + 1) * dl];
}

// Snap a farm to the nearest mile line, along it far enough from the crossroads that its
// strung-out farmsteads keep between them. Pure: the same farm in the same place for everyone.
export function gridSnap(lat, lon, half = 280) {
	const G = surveyAt(lat, lon);
	if (!G) return null;
	const dLat = MILE / KZ, aM = Math.floor(lat / dLat), aR = Math.round(lat / dLat);
	const dlS = dLonOf(bandOf(aM * G.sub, G), G) * G.sub, bM = Math.round(lon / dlS);
	const kx = 111320 * Math.cos(lat * RAD);
	const dNS = Math.abs(lon - bM * dlS) * kx, dEW = Math.abs(lat - aR * dLat) * KZ;
	if (dNS < dEW) {
		const mid = (aM + 0.5) * dLat, lim = half / KZ;
		return { lat: mid + Math.max(-lim, Math.min(lim, lat - mid)), lon: bM * dlS, axis: 0 };
	}
	const dlE = dLonOf(bandOf(aR * G.sub, G), G) * G.sub, bE = Math.floor(lon / dlE), mid = (bE + 0.5) * dlE, lim = half / kx;
	return { lat: aR * dLat, lon: mid + Math.max(-lim, Math.min(lim, lon - mid)), axis: Math.PI / 2 };
}

// the surfaces: 0 marked asphalt, 1 plain asphalt, 2 gravel, 3 dirt
const GRAVEL = [0.5, 0.47, 0.41], DIRT = [0.46, 0.38, 0.28];
// the kits whose lanes are earth, not metalled
const EARTH = /^(steppe|savanna|sahel|desert|outback|jungle|polar|station|himalaya|andes|island|kraal|camp)$/;
const PAVED = /^(village|alpine|mediterranean|eastvillage|snow|eastcity|southcity|bazaar)$/;

export function createGlobeLanes({ scene, height, groundAt, isPhone, highways, settlements }) {
	const group = new THREE.Group();
	group.name = 'globe lanes';
	scene.add(group);
	const LOAD = isPhone ? 3500 : 5500, NEAR = isPhone ? 1500 : 2400, LINK_R = isPhone ? 3000 : 4500;
	const stats = { tiles: 0, links: 0, routed: 0, sites: 0, verts: 0, buildMs: 0, routeMs: 0 };

	// ---------- the drawn ribbons ----------
	const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, BERM_U);
		sh.vertexShader = 'attribute vec3 aRoad; attribute vec4 aKind; varying vec3 vRoad; varying vec4 vKind;\n' + BERM_GLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			vRoad = aRoad; vKind = aKind;
			transformed.y += bermDelta(position.xz);`);
		sh.fragmentShader = 'varying vec3 vRoad; varying vec4 vKind;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
			{
				float a = abs(vRoad.x), fw = fwidth(vRoad.x) * 1.5, k = vKind.w;
				float n = fract(sin(dot(floor(vRoad.xy * vec2(5.0, 0.8)), vec2(12.9898, 78.233))) * 43758.5453);
				vec3 c = vKind.rgb * (0.86 + 0.28 * n);
				if (k < 0.5) {
					// edge lines, a dashed centre line (none in the junctions)
					// (thin lines: faded rather than widened when far off)
					float fade = clamp(0.05 / max(fw, 1e-4), 0.0, 1.0);
					float edge = smoothstep(0.86, 0.88, a) * (1.0 - smoothstep(0.91, 0.93, a)) * fade;
					float mid = (1.0 - smoothstep(0.015, 0.03, a)) * step(0.55, fract(vRoad.y / 12.0)) * step(9.0, min(vRoad.y, vRoad.z)) * fade;
					c = mix(c, vec3(0.62, 0.61, 0.57), edge * 0.85);
					c = mix(c, vec3(0.78, 0.6, 0.12), mid * 0.9);
				} else if (k > 1.5) {
					// the wheel ruts, and on a track the grass between them; a soft verge
					c *= 1.0 - 0.16 * smoothstep(0.2, 0.0, abs(a - 0.5));
					if (k > 2.5) c = mix(c, vec3(0.3, 0.35, 0.2), smoothstep(0.28, 0.1, a) * 0.75);
					c = mix(c, c * 0.8 + vec3(0.03, 0.05, 0.0), smoothstep(0.75, 1.0, a));
				}
				diffuseColor.rgb = c;
			}`);
	};
	mat.customProgramCacheKey = () => 'globelanes1';

	// one road's ribbon added to a builder: stations every STEP metres, each vertex on the ground
	function ribbon(B, pts, w, kind, tint, step = STEP) {
		const n = pts.length / 2;
		if (n < 2) return;
		const S = [];
		for (let k = 0; k + 1 < n; k++) {
			const ax = pts[k * 2], az = pts[k * 2 + 1], bx = pts[k * 2 + 2], bz = pts[k * 2 + 3], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.ceil(L / step));
			for (let q = k ? 1 : 0; q <= m; q++) S.push(ax + (bx - ax) * q / m, az + (bz - az) * q / m);
		}
		const m = S.length / 2, hw = w / 2, across = w >= 6 && step <= STEP ? [-1, 0, 1] : [-1, 1], na = across.length;
		// (the narrower surfaces a little lower, so where two meet the bigger road is on top)
		const lift = 0.04 + (3 - kind) * 0.008;
		const acc = [0];
		for (let i = 1; i < m; i++) acc.push(acc[i - 1] + Math.hypot(S[i * 2] - S[i * 2 - 2], S[i * 2 + 1] - S[i * 2 - 1]));
		const total = acc[m - 1], v0 = B.pos.length / 3;
		for (let i = 0; i < m; i++) {
			const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1);
			let dx = S[b * 2] - S[a * 2], dz = S[b * 2 + 1] - S[a * 2 + 1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
			for (const u of across) {
				const x = S[i * 2] - dz * hw * u, z = S[i * 2 + 1] + dx * hw * u;
				B.pos.push(x, groundAt(x, z) + lift, z);
				B.road.push(u, acc[i], total - acc[i]);
				B.kind.push(tint[0], tint[1], tint[2], kind);
			}
			if (i) for (let c = 0; c + 1 < na; c++) { const p = v0 + (i - 1) * na + c, q = p + na; B.idx.push(p, q, p + 1, p + 1, q, q + 1); }
		}
	}
	const builder = () => ({ pos: [], road: [], kind: [], idx: [] });
	function meshOf(B) {
		if (!B.idx.length) return null;
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
		g.setAttribute('aRoad', new THREE.Float32BufferAttribute(B.road, 3));
		g.setAttribute('aKind', new THREE.Float32BufferAttribute(B.kind, 4));
		g.setIndex(B.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(B.idx, 1) : new THREE.Uint16BufferAttribute(B.idx, 1));
		g.computeVertexNormals();
		g.computeBoundingSphere();
		g.boundingSphere.radius += 4;
		const M = new THREE.Mesh(g, mat);
		M.receiveShadow = true;
		group.add(M);
		stats.verts += B.pos.length / 3;
		return M;
	}
	function freeMesh(M) { if (!M) return; stats.verts -= M.geometry.attributes.position.count; M.geometry.dispose(); group.remove(M); }

	// ---------- the roads for the driving, the berms and the trees ----------
	const CELL = 200, index = new Map();
	let dirty = false, version = 0, bumpT = 0;
	const cellsOf = (r, fn) => { for (let gx = Math.floor(r.box[0] / CELL); gx <= Math.floor(r.box[2] / CELL); gx++) for (let gz = Math.floor(r.box[1] / CELL); gz <= Math.floor(r.box[3] / CELL); gz++) fn(gx + ',' + gz); };
	function publish(r) { cellsOf(r, (k) => { let s = index.get(k); if (!s) index.set(k, s = new Set()); s.add(r); }); dirty = true; }
	function unpublish(r) { cellsOf(r, (k) => { const s = index.get(k); if (s) { s.delete(r); if (!s.size) index.delete(k); } }); dirty = true; }
	function road(pts, sty, name, extra = {}) {
		let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
		for (let k = 0; k < pts.length; k += 2) { x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); z0 = Math.min(z0, pts[k + 1]); z1 = Math.max(z1, pts[k + 1]); }
		return { cls: sty.cls, name, w: sty.w, pts: pts instanceof Float32Array ? pts : new Float32Array(pts), drive: true, walked: false, bridge: false, end0: true, end1: true, link: false, divided: false, oneway: false, rural: true, globe: true, local: true, box: [x0, z0, x1, z1], ...extra };
	}
	function near(kind, x, z, rad, out) {
		if (kind !== 'roads' || !index.size) return;
		const seen = new Set();
		for (let gx = Math.floor((x - rad) / CELL); gx <= Math.floor((x + rad) / CELL); gx++) for (let gz = Math.floor((z - rad) / CELL); gz <= Math.floor((z + rad) / CELL); gz++) {
			const s = index.get(gx + ',' + gz);
			if (s) for (const r of s) if (!seen.has(r)) { seen.add(r); out.push(r); }
		}
	}
	const tmp = [];
	function onRoad(x, z, pad = 3) {
		tmp.length = 0; near('roads', x, z, 12 + pad, tmp);
		for (const r of tmp) {
			const p = r.pts, hw = r.w / 2 + pad;
			for (let k = 0; k + 3 < p.length; k += 2) {
				const ax = p[k], az = p[k + 1], dx = p[k + 2] - ax, dz = p[k + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
				if (Math.hypot(x - ax - dx * t, z - az - dz * t) < hw) return true;
			}
		}
		return false;
	}

	// ---------- the survey ----------
	const segs = new Map();
	// a segment of a section line: whether there is a road, and what kind (from the ground under
	// it and the line's own number, so the same for everyone)
	function segInfo(G, dir, a, b) {
		const key = G.id + ':' + dir + ':' + a + ':' + b;
		let S = segs.get(key);
		if (S) return S;
		if (segs.size > 60000) segs.clear();
		const [la0, lo0, la1, lo1] = segEnds(G, dir, a, b), line = dir === 'n' ? b : a, cross = dir === 'n' ? a : b;
		const mile = line % G.sub === 0, half = line % (G.sub / 2 || 1) === 0, L = Math.floor(line / G.sub), h0 = hash(line, cross, dir === 'n' ? 7 : 11);
		let sty;
		if (G === PLSS) sty = ((L % 6) + 6) % 6 === 3 || hash(line, 0, 5) < 0.08 ? { cls: 'tertiary', w: 7, kind: 0, tint: [0.1, 0.1, 0.105] } : { cls: 'unclassified', w: 6, kind: 2, tint: GRAVEL };
		else sty = mile ? { cls: 'tertiary', w: 7, kind: 0, tint: [0.1, 0.1, 0.105] } : half ? { cls: 'unclassified', w: 5, kind: 2, tint: GRAVEL, minor: true } : { cls: 'track', w: 3.5, kind: 3, tint: DIRT, minor: true };
		const present = G === PLSS ? h0 > 0.05 : mile || (half ? h0 < 0.7 : h0 < 0.45);
		S = { key, G, dir, a, b, ok: false, ...sty, ends: [la0, lo0, la1, lo1] };
		const name = G === PLSS ? (dir === 'n' ? `${((L % 300) + 300) % 300} Avenue` : `${((L % 300) + 300) % 300} Street`) : (dir === 'n' ? `Road ${((L % 200) + 200) % 200}` : `Avenue ${((L % 200) + 200) % 200}`);
		S.name = sty.cls === 'track' ? 'Farm road' : name;
		if (present) {
			// not over water, nor up a steep slope, nor (in the valley) up into the hills
			const len = dir === 'n' ? MILE / G.sub : (lo1 - lo0) * 111320 * Math.cos(la0 * RAD), n = Math.max(3, Math.ceil(len / 60));
			let ok = true, prev = null;
			for (let q = 0; q <= n && ok; q++) {
				const h = height.atLL(la0 + (la1 - la0) * q / n, lo0 + (lo1 - lo0) * q / n);
				if (height.out.land < 0 || h < 0.5 || h > G.maxH || (prev !== null && Math.abs(h - prev) / (len / n) > 0.12)) ok = false;
				prev = h;
			}
			S.ok = ok;
		}
		segs.set(key, S);
		return S;
	}
	// the nearest surveyed road to a point (engine metres): its segment, how far along, how far off
	function gridAt(x, z) {
		const ll = toLL(x, z), G = surveyAt(ll.lat, ll.lon);
		if (!G) return null;
		const dLat = dLatOf(G), a = Math.floor(ll.lat / dLat), dl = dLonOf(bandOf(a, G), G);
		const kx = 111320 * Math.cos(ll.lat * RAD);
		let best = null;
		const consider = (S, t, d) => { if (S.ok && (!best || d < best.d)) best = { S, t, d }; };
		for (const b of [Math.floor(ll.lon / dl), Math.ceil(ll.lon / dl)]) consider(segInfo(G, 'n', a, b), (ll.lat / dLat) - a, Math.abs(ll.lon - b * dl) * kx);
		for (const aa of [Math.floor(ll.lat / dLat), Math.ceil(ll.lat / dLat)]) { const d2 = dLonOf(bandOf(aa, G), G), b = Math.floor(ll.lon / d2); consider(segInfo(G, 'e', aa, b), ll.lon / d2 - b, Math.abs(ll.lat - aa * dLat) * KZ); }
		return best;
	}
	// is a point within m of a road's edge (the survey's and the highways', for the lots)
	function keepOff(x, z, m) {
		const g = gridAt(x, z);
		if (g && g.d < g.S.w / 2 + m && !zoned(x, z)) return true;
		return !!highways?.onRoad(x, z, m);
	}
	let zoneList = [];
	const zoned = (x, z) => zoneList.some((t) => Math.hypot(x - t.x, z - t.z) < t.r);

	// where other roads meet a segment: it is split there for the driving
	const cuts = new Map();
	function cut(S, t) {
		let A = cuts.get(S.key);
		if (!A) cuts.set(S.key, A = []);
		const q = Math.round(t * 1e4) / 1e4;
		if (q <= 0.002 || q >= 0.998 || A.includes(q)) return;
		A.push(q); A.sort((p, r) => p - r);
		for (const T of tiles.values()) if (T.bySeg?.has(S.key)) { pubSeg(T, S); return; }
	}
	function segXZ(S) { const p = toXZ(S.ends[0], S.ends[1]), q = toXZ(S.ends[2], S.ends[3]); return [p.x, p.z, q.x, q.z]; }
	// a segment's roads, split at its cuts
	function pubSeg(T, S) {
		for (const r of T.bySeg.get(S.key) || []) unpublish(r);
		const [x0, z0, x1, z1] = segXZ(S), ts = [0, ...(cuts.get(S.key) || []), 1], out = [];
		for (let k = 0; k + 1 < ts.length; k++) {
			const r = road([x0 + (x1 - x0) * ts[k], z0 + (z1 - z0) * ts[k], x0 + (x1 - x0) * ts[k + 1], z0 + (z1 - z0) * ts[k + 1]], S, S.name);
			publish(r); out.push(r);
		}
		T.bySeg.set(S.key, out);
	}

	const tiles = new Map();
	function* buildTile(T) {
		const t0 = performance.now();
		let s0 = t0, work = 0;
		const G = T.G, dLat = dLatOf(G), B = builder(), list = [];
		for (let a = Math.floor(T.lat0 / dLat) - 1; a <= Math.ceil(T.lat1 / dLat) + 1; a++) {
			const dl = dLonOf(bandOf(a, G), G);
			for (let b = Math.floor(T.lon0 / dl) - 1; b <= Math.ceil(T.lon1 / dl) + 1; b++) {
				for (const dir of ['n', 'e']) {
					const mLat = dir === 'n' ? (a + 0.5) * dLat : a * dLat, mLon = dir === 'n' ? b * dl : (b + 0.5) * dl;
					if (mLat < T.lat0 || mLat >= T.lat1 || mLon < T.lon0 || mLon >= T.lon1) continue;
					const S = segInfo(G, dir, a, b);
					if (!S.ok || !S.minor !== !T.minor) continue;
					list.push(S);
				}
			}
			if (performance.now() - s0 > 3) { work += performance.now() - s0; yield; s0 = performance.now(); }
		}
		T.bySeg = new Map();
		for (const S of list) {
			const [x0, z0, x1, z1] = segXZ(S);
			// (a town's own streets take over inside it)
			let inTown = false;
			for (let q = 0; q <= 4 && !inTown; q++) inTown = zoned(x0 + (x1 - x0) * q / 4, z0 + (z1 - z0) * q / 4);
			if (inTown) continue;
			// (the far tiles more coarsely: made again when you come near)
			ribbon(B, [x0, z0, x1, z1], S.w, S.kind, S.tint, T.near ? STEP : STEP * 2.5);
			pubSeg(T, S);
			if (performance.now() - s0 > 3) { work += performance.now() - s0; yield; s0 = performance.now(); }
		}
		T.mesh = meshOf(B);
		stats.buildMs = Math.max(stats.buildMs, Math.round(work + performance.now() - s0));
	}
	function freeTile(T) { freeMesh(T.mesh); for (const A of T.bySeg?.values() || []) for (const r of A) unpublish(r); T.bySeg = null; T.mesh = null; }
	// the tiles round you, nearest first; one being built at a time
	let tileJob = null;
	function scanTiles(x, z) {
		const ll = toLL(x, z), G = surveyAt(ll.lat, ll.lon) || surveyAt(ll.lat + 0.05, ll.lon) || surveyAt(ll.lat - 0.05, ll.lon) || surveyAt(ll.lat, ll.lon + 0.06) || surveyAt(ll.lat, ll.lon - 0.06);
		const want = [];
		// tiles of n miles out to maxD: the main roads in 3-mile tiles, the valley's farm roads
		// in 1-mile tiles near you only
		const add = (n, minor, maxD) => {
			// (a row of tiles is as wide in longitude as n miles at its own latitude)
			const TL = n * MILE / KZ, ri = Math.ceil(maxD / (n * MILE)) + 1, ti = Math.floor(ll.lat / TL);
			for (let i = ti - ri; i <= ti + ri; i++) {
				const TLon = Math.round(n * MILE / (111320 * Math.cos((i + 0.5) * TL * RAD)) * 1e4) / 1e4, tj = Math.floor(ll.lon / TLon);
				for (let j = tj - ri; j <= tj + ri; j++) {
					const lat0 = i * TL, lon0 = j * TLon, mid = toXZ(lat0 + TL / 2, lon0 + TLon / 2), d = Math.hypot(mid.x - x, mid.z - z) - n * MILE * 0.7;
					if (d > maxD) continue;
					const Gt = surveyAt(lat0 + TL / 2, lon0 + TLon / 2);
					if (!Gt || (minor && Gt.sub === 1)) continue;
					const nearT = d < NEAR, zk = zoneList.filter((t) => Math.abs(t.x - mid.x) < t.r + n * MILE && Math.abs(t.z - mid.z) < t.r + n * MILE).map((t) => Math.round(t.x) + ':' + Math.round(t.r)).join('|');
					want.push({ key: Gt.id + ':' + n + ':' + i + ':' + j + ':' + (nearT ? 1 : 0) + ':' + zk, G: Gt, lat0, lat1: lat0 + TL, lon0, lon1: lon0 + TLon, near: nearT, minor, d });
				}
			}
		};
		if (G) { add(TILE, false, LOAD); add(1, true, NEAR); }
		const keep = new Set(want.map((w) => w.key));
		for (const [k, T] of tiles) if (!keep.has(k)) { freeTile(T); tiles.delete(k); if (tileJob?.T === T) tileJob = null; }
		want.sort((p, q) => p.d - q.d);
		for (const w of want) if (!tiles.has(w.key)) tiles.set(w.key, { ...w, mesh: null, bySeg: null, built: false });
		stats.tiles = tiles.size;
	}
	function stepTiles(budget) {
		const t0 = performance.now();
		while (performance.now() - t0 < budget) {
			if (!tileJob) {
				let T = null;
				for (const U of tiles.values()) if (!U.built && (!T || U.d < T.d)) T = U;
				if (!T) return;
				T.built = true; tileJob = { T, it: buildTile(T) };
			}
			if (tileJob.it.next().done) tileJob = null;
		}
	}

	// ---------- the places' own streets and drives ----------
	const kitOf = (s) => s.kitId || s.kit || '';
	const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
	function earthTint(s, base) {
		const k = s.kitObj || {}, p = k.ground?.path;
		if (!p || /polar|boreal/.test(k.climate || '')) return base;
		const c = hex(p);
		return [base[0] * 0.5 + c[0] * 0.45, base[1] * 0.5 + c[1] * 0.45, base[2] * 0.5 + c[2] * 0.45];
	}
	// how a place's path is made: its width, surface and class
	function pathStyle(s, p) {
		const kid = kitOf(s), earth = EARTH.test(kid) || EARTH.test(s.kitObj?.build?.layout || ''), paved = PAVED.test(kid);
		if (p.drive) return { cls: 'service', w: 3, kind: earth ? 3 : 2, tint: earthTint(s, earth ? DIRT : GRAVEL) };
		if (p.w >= 5) return { cls: 'residential', w: p.w, kind: earth ? 2 : 1, tint: earth ? earthTint(s, GRAVEL) : [0.15, 0.15, 0.155] };
		if (p.w >= 3) return { cls: 'service', w: p.w, kind: earth ? 3 : paved ? 1 : 2, tint: earth ? earthTint(s, DIRT) : paved ? [0.17, 0.17, 0.17] : earthTint(s, GRAVEL) };
		return { cls: 'track', w: Math.max(2.5, p.w), kind: 3, tint: earthTint(s, DIRT) };
	}
	// the ends of a place's lanes and streets (where a lane from outside comes in)
	function gatesOf(s) {
		const out = [];
		if (s.roadTown?.roads?.length) { for (const r of s.roadTown.roads) if (r.drive) { const p = r.pts, n = p.length; out.push([p[0], p[1]], [p[n - 2], p[n - 1]]); } }
		else for (const p of s.planned.paths) if (!p.drive && !p.grid && p.pts.length > 1) { const a = p.pts[0], b = p.pts[p.pts.length - 1]; out.push([s.x + a[0], s.z + a[1]], [s.x + b[0], s.z + b[1]]); }
		if (!out.length) out.push([s.x, s.z]);
		return out;
	}
	const places = new Map();        // site key -> { s, mesh, roads, epoch }
	function* buildPlace(s) {
		const P = s.planned, B = builder(), roads = [], town = s.kind === 'town';
		for (const p of P.paths) {
			if (p.grid || p.pts.length < 2) continue;
			const sty = pathStyle(s, p), pts = [];
			for (const [x, z] of p.pts) pts.push(s.x + x, s.z + z);
			// (a dense town's grid is painted with its blocks; the rest drawn here)
			ribbon(B, pts, sty.w, sty.kind, sty.tint);
			// (a town's streets are the regional source's; the rest are ours to give)
			if (!town) { const r = road(pts, sty, p.drive ? 'Drive' : s.name || (sty.cls === 'track' ? 'Track' : 'Lane')); publish(r); roads.push(r); }
			// a drive that ends on a survey road: the road is split there
			if (p.drive) { const g = gridAt(pts[pts.length - 2], pts[pts.length - 1]); if (g && g.d < 1.5) cut(g.S, g.t); }
			yield;
		}
		const E = places.get(s.key);
		if (E) { freeMesh(E.mesh); for (const r of E.roads) unpublish(r); }
		places.set(s.key, { s, mesh: meshOf(B), roads, epoch: F.epoch, P });
	}
	function freePlace(E) { freeMesh(E.mesh); for (const r of E.roads) unpublish(r); }

	// ---------- the lanes between them ----------
	const RANK = { town: 3, village: 2, farm: 1 };
	const links = new Map();         // key -> { lat, lon (Float64Array) | 'none', sty, mesh, road }
	let linkPlan = [], linkJob = null, planT = 0;
	// where the nearest road in from a point is: the survey's, a highway's (its piece ends
	// preferred, where the driving can turn) or nothing within reach
	function anchorFor(x, z, reach) {
		let best = null;
		const g = gridAt(x, z);
		if (g && g.d < reach) {
			const [x0, z0, x1, z1] = segXZ(g.S);
			// (the foot of the perpendicular on the line, if the line is drawn there)
			const dx = x1 - x0, dz = z1 - z0, t = Math.max(0.02, Math.min(0.98, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
			if (!zoned(x0 + dx * t, z0 + dz * t)) best = { x: x0 + dx * t, z: z0 + dz * t, d: g.d, S: g.S, t };
		}
		tmp.length = 0;
		highways?.near('roads', x, z, reach, tmp);
		let dv = Infinity, V = null, de = Infinity, E = null;
		for (const r of tmp) {
			const p = r.pts, n = p.length;
			for (let k = 0; k < n; k += 2) { const d = Math.hypot(p[k] - x, p[k + 1] - z); if (d < dv) { dv = d; V = [p[k], p[k + 1]]; } }
			for (const k of [0, n - 2]) { const d = Math.hypot(p[k] - x, p[k + 1] - z); if (d < de) { de = d; E = [p[k], p[k + 1]]; } }
		}
		const H = de < dv + 250 ? [E, de] : [V, dv];
		if (H[0] && H[1] < reach && (!best || H[1] < best.d)) best = { x: H[0][0], z: H[0][1], d: H[1] };
		return best;
	}
	function lanesStyle(s, t) {
		const kid = kitOf(s), earth = EARTH.test(kid);
		if (earth) return { cls: 'track', w: 4, kind: 3, tint: earthTint(s, DIRT) };
		if (kid === 'farm') return { cls: 'unclassified', w: 5.5, kind: 2, tint: earthTint(s, GRAVEL) };
		if (s.kind === 'farm' || t?.kind === 'farm') return { cls: 'service', w: 3.5, kind: 2, tint: earthTint(s, GRAVEL) };
		return { cls: 'unclassified', w: 4.6, kind: 1, tint: [0.17, 0.17, 0.175] };
	}
	// which lanes there should be: each place to the nearest bigger place or road (so they all
	// lead out to the highways), and each village to a second neighbour as well
	function planLinks(cx, cz) {
		const nodes = [];
		for (const s of settlements.sites.values()) {
			if (!s.planned || !RANK[s.kind] || Math.hypot(s.x - cx, s.z - cz) > LINK_R) continue;
			if (s.planned.onGrid) continue;
			const gates = gatesOf(s), A = anchorFor(s.x, s.z, 6000);
			nodes.push({ s, gates, A, prio: RANK[s.kind] * 1e5 - (A ? A.d / 10 : 9000) });
		}
		const plan = [];
		const nearestGate = (n, x, z) => { let g = n.gates[0], bd = Infinity; for (const q of n.gates) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; g = q; } } return [g, bd]; };
		for (const n of nodes) {
			let best = null;
			if (n.A) { const [g] = nearestGate(n, n.A.x, n.A.z); best = { from: g, to: [n.A.x, n.A.z], d: Math.hypot(g[0] - n.A.x, g[1] - n.A.z), A: n.A, key: n.s.key + '>road' };}
			const others = [];
			for (const m of nodes) {
				if (m === n) continue;
				const [g, d0] = nearestGate(m, n.s.x, n.s.z), [h] = nearestGate(n, g[0], g[1]), d = Math.hypot(h[0] - g[0], h[1] - g[1]);
				others.push({ m, g, h, d, d0 });
				if (m.prio > n.prio && (!best || d < best.d)) best = { from: h, to: g, d, t: m.s, key: n.s.key + '>' + m.s.key };
			}
			if (best && best.d > 20 && best.d < 6000) plan.push({ ...best, s: n.s });
			// a second way out of a village: to its next neighbour that is a village or town
			if (RANK[n.s.kind] >= 2) {
				const o = others.filter((q) => RANK[q.m.s.kind] >= 2 && q.d < 3200 && q.m.s.key > n.s.key && q.m.s.key !== best?.t?.key).sort((p, q) => p.d - q.d)[0];
				if (o) plan.push({ from: o.h, to: o.g, d: o.d, t: o.m.s, s: n.s, key: n.s.key + '>' + o.m.s.key });
			}
		}
		return plan;
	}
	// a lane's way over the ground: A* over a corridor between its ends, 15–40 m cells, dear on
	// the slopes and through a house, dearer over water
	function* route(ax, az, bx, bz) {
		const ex = bx - ax, ez = bz - az, len = Math.hypot(ex, ez);
		if (len < 40) return [ax, az, bx, bz];
		const ux = ex / len, uz = ez / len, cs = Math.max(15, Math.min(40, len / 120)), pad = 60, half = Math.max(150, len * 0.3);
		const NU = Math.ceil((len + 2 * pad) / cs) + 1, NV = Math.ceil(2 * half / cs) + 1, N = NU * NV;
		const pos = (i, j) => { const u = -pad + i * cs, v = -half + j * cs; return [ax + u * ux - v * uz, az + u * uz + v * ux]; };
		const H = new Float32Array(N).fill(NaN), X = new Float32Array(N);
		const hAt = (k) => {
			if (H[k] === H[k]) return H[k];
			const i = k % NU, j = (k - i) / NU, [x, z] = pos(i, j), h = groundAt(x, z);
			const ll = toLL(x, z); height.atLL(ll.lat, ll.lon);
			X[k] = h < 0.4 || height.out.land < 0 ? 60 : settlements.blocked(x, z, 3) ? 25 : 0;
			return (H[k] = h);
		};
		const cellOf = (x, z) => { const u = (x - ax) * ux + (z - az) * uz, v = -(x - ax) * uz + (z - az) * ux; return Math.round((v + half) / cs) * NU + Math.round((u + pad) / cs); };
		const start = cellOf(ax, az), goal = cellOf(bx, bz), gi = goal % NU, gj = (goal - gi) / NU;
		const g = new Float32Array(N).fill(Infinity), f = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
		const open = [];
		const push = (k) => { open.push(k); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[open[p]] <= f[k]) break; open[i] = open[p]; i = p; } open[i] = k; };
		const pop = () => { const top = open[0], last = open.pop(); if (open.length) { let i = 0; const n = open.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && f[open[c + 1]] < f[open[c]]) c++; if (f[open[c]] >= f[last]) break; open[i] = open[c]; i = c; } open[i] = last; } return top; };
		const hq = (k) => { const i = k % NU, j = (k - i) / NU; return Math.hypot(i - gi, j - gj) * cs; };
		g[start] = 0; f[start] = hq(start); push(start);
		const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
		let found = false, n = 0, s0 = performance.now();
		while (open.length) {
			const k = pop();
			if (shut[k]) continue;
			if (k === goal) { found = true; break; }
			shut[k] = 1;
			const i = k % NU, j = (k - i) / NU, hk = hAt(k);
			for (const [a, b] of D) {
				const ii = i + a, jj = j + b;
				if (ii < 0 || jj < 0 || ii >= NU || jj >= NV) continue;
				const q = jj * NU + ii;
				if (shut[q]) continue;
				const d = Math.hypot(a, b) * cs, gr = Math.abs(hAt(q) - hk) / d;
				const c = d * (1 + (gr / 0.05) ** 2 * 0.8 + X[q]) + (gr > 0.15 ? d * 200 * (gr - 0.15) : 0);
				if (g[k] + c < g[q]) { g[q] = g[k] + c; f[q] = g[q] + hq(q); from[q] = k; push(q); }
			}
			if ((++n & 63) === 0 && performance.now() - s0 > 3) { stats.routeMs += performance.now() - s0; yield; s0 = performance.now(); }
		}
		stats.routeMs += performance.now() - s0;
		if (!found) return null;
		let P = [];
		for (let k = goal; k >= 0; k = from[k]) { const i = k % NU, j = (k - i) / NU; P.push(pos(i, j)); }
		P.reverse(); P[0] = [ax, az]; P[P.length - 1] = [bx, bz];
		// (no long way through the water: no lane)
		let wetRun = 0;
		for (let q = 1; q < P.length; q++) { const k = cellOf(P[q][0], P[q][1]); wetRun = k >= 0 && k < N && X[k] >= 60 ? wetRun + cs : 0; if (wetRun > 80) return null; }
		// smoothed into curves, the ends kept
		for (let pass = 0; pass < 2; pass++) {
			const Q = [P[0]];
			for (let q = 0; q + 1 < P.length; q++) { const [a, b] = [P[q], P[q + 1]]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
			Q.push(P[P.length - 1]); P = Q;
		}
		const out = [];
		for (const p of P) out.push(p[0], p[1]);
		return out;
	}
	function* linkWork(L) {
		const pts = yield* route(L.from[0], L.from[1], L.to[0], L.to[1]);
		if (!pts) { links.set(L.key, { none: true }); return; }
		const lat = new Float64Array(pts.length / 2), lon = new Float64Array(pts.length / 2);
		for (let k = 0; k < lat.length; k++) { const p = toLL(pts[k * 2], pts[k * 2 + 1]); lat[k] = p.lat; lon[k] = p.lon; }
		const E = { lat, lon, sty: lanesStyle(L.s, L.t), name: L.t?.name ? `Road to ${L.t.name}` : 'Lane', A: L.A || null };
		links.set(L.key, E);
		drawLink(E);
		stats.routed++;
	}
	function drawLink(E) {
		const pts = [];
		for (let k = 0; k < E.lat.length; k++) { const p = toXZ(E.lat[k], E.lon[k]); pts.push(p.x, p.z); }
		const B = builder();
		ribbon(B, pts, E.sty.w, E.sty.kind, E.sty.tint);
		E.mesh = meshOf(B); E.epoch = F.epoch;
		E.road = road(pts, E.sty, E.name); publish(E.road);
		// (where it meets a survey road, that road is split for the driving)
		if (E.A?.S) cut(E.A.S, E.A.t);
	}
	function freeLink(E) { freeMesh(E.mesh); if (E.road) unpublish(E.road); E.mesh = null; E.road = null; }

	// ---------- each frame ----------
	let scanAt = null, scanEpoch = -1, scanT = 0, placeJob = null, placeT = 0;
	function update(dt, cam, on, zoneNow) {
		group.visible = on;
		if (!on) return;
		const x = cam.position.x, z = cam.position.z, t0 = performance.now();
		if (scanEpoch !== F.epoch) reframe();
		if (zoneNow) zoneList = zoneNow;
		scanT -= dt;
		if (!scanAt || scanT <= 0 || Math.hypot(x - scanAt[0], z - scanAt[1]) > 400) { scanAt = [x, z]; scanEpoch = F.epoch; scanT = 5; scanTiles(x, z); }
		const budget = isPhone ? 2 : 3.5;
		stepTiles(budget * 0.5);
		// the places: a place planned near you gets its streets drawn; one let go loses them
		placeT -= dt;
		if (placeT <= 0) {
			placeT = 1;
			for (const [k, E] of places) { const s = settlements.sites.get(k); if (!s || s.planned !== E.P || Math.hypot(s.x - x, s.z - z) > LINK_R + 1500 || E.epoch !== F.epoch) { freePlace(E); places.delete(k); } }
		}
		if (!placeJob) {
			let best = null, bd = LINK_R;
			for (const s of settlements.sites.values()) {
				if (!s.planned || !RANK[s.kind] || places.has(s.key)) continue;
				const d = Math.hypot(s.x - x, s.z - z);
				if (d < bd) { bd = d; best = s; }
			}
			if (best) placeJob = buildPlace(best);
		}
		while (placeJob && performance.now() - t0 < budget * 0.75) if (placeJob.next().done) placeJob = null;
		// the lanes: planned again every few seconds; one found at a time
		planT -= dt;
		if (planT <= 0) {
			planT = 3;
			linkPlan = planLinks(x, z);
			stats.links = linkPlan.length;
			const want = new Set(linkPlan.map((L) => L.key));
			for (const [k, E] of links) if (!want.has(k)) { freeLink(E); links.delete(k); }
			for (const L of linkPlan) { const E = links.get(L.key); if (E && !E.none && !E.mesh) drawLink(E); }
		}
		if (!linkJob) { const L = linkPlan.find((q) => !links.has(q.key)); if (L) linkJob = linkWork(L); }
		while (linkJob && performance.now() - t0 < budget) if (linkJob.next().done) linkJob = null;
		// (the trees and the plants make way for what changed, at most every few seconds)
		bumpT -= dt;
		if (dirty && bumpT <= 0 && !tileJob && !linkJob) { dirty = false; version++; bumpT = 3; }
	}
	// the frame moved: what is standing is in the old metres; made again in the new
	function reframe() {
		for (const T of tiles.values()) freeTile(T);
		tiles.clear(); tileJob = null;
		for (const E of places.values()) freePlace(E);
		places.clear(); placeJob = null;
		for (const E of links.values()) freeLink(E);
		linkJob = null; planT = 0; scanAt = null; scanEpoch = F.epoch;
		index.clear(); dirty = true;
	}
	// everything near you finished now (tests, and a jump)
	function settle(cam) {
		if (!cam) return;
		for (let k = 0; k < 400; k++) {
			update(0.6, cam, true);
			while (tileJob && !tileJob.it.next().done);
			tileJob = null;
			while (placeJob && !placeJob.next().done);
			placeJob = null;
			while (linkJob && !linkJob.next().done);
			linkJob = null;
			const tilesLeft = [...tiles.values()].some((T) => !T.built), placesLeft = [...settlements.sites.values()].some((s) => s.planned && RANK[s.kind] && !places.has(s.key) && Math.hypot(s.x - cam.position.x, s.z - cam.position.z) < LINK_R);
			if (!tilesLeft && !placesLeft && !linkPlan.some((L) => !links.has(L.key))) break;
		}
		dirty = false; version++;
	}
	const info = () => ({ ...stats, routeMs: Math.round(stats.routeMs), roads: [...index.values()].reduce((a, s) => a + s.size, 0), places: places.size, lanes: [...links.values()].filter((E) => E.mesh).length, survey: scanAt ? surveyAt(toLL(scanAt[0], scanAt[1]).lat, toLL(scanAt[0], scanAt[1]).lon)?.id || null : null });
	function dispose() { reframe(); scene.remove(group); mat.dispose(); }
	return { update, near, onRoad, keepOff, gridAt, version: () => version, reframe, settle, info, dispose, group };
}
