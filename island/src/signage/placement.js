// Placement: what sign or decal goes where, decided the way a city's sign shop and its
// street crews decide it, from the streets, the buildings and who uses them. Plain numbers
// (no scene, no canvas), so node tests can check the rules; signage/index.js turns the
// records into instances.
//
// Every record is one flat graphic on a surface:
//   { mat, layer, face, x, z, hy, nx, nz, w, h, back, wear, base }
// mat: the material it is made of (retro sheeting, vinyl, glass vinyl, paper, foil, paint,
// grime); layer: its place in the stack (layers.js); face: what is drawn on it ({ k, ... },
// faces.js); (x, z) the middle of it; hy its middle's height above base (the ground there
// when base is null); (nx, nz) the way it faces (ny for one lying on the ground); w, h its
// size in metres; back: what its back shows (0 a blank metal back, 1 the same face read
// from behind, 2 the face mirrored as seen through glass, 3 nothing).
// Posts and gantries for the signs to stand on come back beside them.

import { hash01, hash32, rng, pick } from './rand.js';
import { LAYER } from './layers.js';
import { RANK } from './systems.js';
import { tradeFor, retailIdentity } from './art.js';

export const BACK = Object.freeze({ blank: 0, readable: 1, mirrored: 2, none: 3 });
export const MAT = Object.freeze({ retro: 'retro', vinyl: 'vinyl', glass: 'glass', paper: 'paper', foil: 'foil', paint: 'paint', grime: 'grime' });
const CROSS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'trunk']);
const rightOf = (dx, dz) => [-dz, dx];

// ---------- the streets' junctions ----------
// Points shared by two or more drive roads (within 1.5 m), with the legs leaving them: each
// leg's heading measured a little way out, its road, its rank, and how far the road runs
// before its next junction or end (so a sign is not put on a stub).
export function junctions(roads) {
	const nodes = new Map(), nk = (x, z) => Math.round(x / 1.5) * 65536 + Math.round(z / 1.5);
	for (const r of roads) {
		if (!r.drive || r.bridge || r.link || !CROSS.has(r.cls)) continue;
		const p = r.pts, m = p.length;
		for (let i = 0; i < m; i += 2) {
			const k = nk(p[i], p[i + 1]);
			let n = nodes.get(k);
			if (!n) nodes.set(k, n = { x: p[i], z: p[i + 1], legs: [], ends: 0 });
			if (i === 0 || i === m - 2) n.ends++;
			if (i + 2 < m) n.legs.push({ r, j: i, d: 1 });
			if (i > 0) n.legs.push({ r, j: i, d: -1 });
		}
	}
	const out = [];
	for (const n of nodes.values()) {
		if (n.legs.length < 3) continue;
		const legs = [];
		for (const g of n.legs) {
			const p = g.r.pts;
			// the heading 8 m out (the first points of a leg are often close together), and its run
			let got = 0, ux = 0, uz = 0;
			for (let i = g.j; i + g.d * 2 >= 0 && i + g.d * 2 < p.length; i += g.d * 2) {
				const l = Math.hypot(p[i + g.d * 2] - p[i], p[i + g.d * 2 + 1] - p[i + 1]);
				got += l;
				if (!ux && got >= 8) { const L = Math.hypot(p[i + g.d * 2] - n.x, p[i + g.d * 2 + 1] - n.z) || 1; ux = (p[i + g.d * 2] - n.x) / L; uz = (p[i + g.d * 2 + 1] - n.z) / L; }
				// (the run stops at the next point another road shares; approximated by the road's next vertex that is a node)
				if (got > 400) break;
			}
			if (!ux) { const i2 = g.j + g.d * 2, L = Math.hypot(p[i2] - n.x, p[i2 + 1] - n.z) || 1; ux = (p[i2] - n.x) / L; uz = (p[i2 + 1] - n.z) / L; }
			legs.push({ r: g.r, d: g.d, ux, uz, hw: g.r.w / 2, rank: RANK[g.r.cls] ?? 1, name: g.r.name || '', run: got, oneway: !!g.r.divided });
		}
		// (two legs of the same road heading the same way are the same leg)
		const uniq = [];
		for (const L of legs) if (!uniq.some((q) => q.r === L.r && q.ux * L.ux + q.uz * L.uz > 0.95)) uniq.push(L);
		if (uniq.length < 3 && new Set(uniq.map((q) => q.name)).size < 2) continue;
		const names = new Set(uniq.map((q) => q.name).filter(Boolean));
		out.push({ x: n.x, z: n.z, legs: uniq.sort((a, b) => Math.atan2(a.uz, a.ux) - Math.atan2(b.uz, b.ux)), names, ends: n.ends });
	}
	return out;
}

// how a junction is controlled: 'signal' where the street life stands its signals (three or
// more mapped ways ending there with a collector among them, bay/streetlife.js; or two
// collectors crossing), 'stop' on the minor legs, 'allway', 'yield', or 'none'
export function controlOf(J, sys, seed = 0) {
	const major = J.legs.filter((L) => L.rank >= 2).length;
	if (major >= 3 || (major >= 1 && (J.ends || 0) >= 3)) return { kind: 'signal', minor: [] };
	const minor = J.legs.filter((L) => L.rank < 2);
	if (major > 0) return { kind: sys.id === 'vienna' || sys.id === 'uk' ? (hash01(J.x, J.z, seed, 'y') < 0.6 ? 'yield' : 'stop') : 'stop', minor };
	// all minor streets: an all-way stop in the American manner, otherwise the street with the
	// shorter run gives way (or, in a Vienna town, often nobody: priority to the right)
	if (sys.allWay && hash01(J.x, J.z, seed, 'a') < 0.55) return { kind: 'allway', minor: J.legs };
	const byName = new Map();
	for (const L of J.legs) byName.set(L.name || L.r, (byName.get(L.name || L.r) || 0) + L.run);
	let weakest = null, wv = 1e9;
	for (const [k, v] of byName) if (v < wv) { wv = v; weakest = k; }
	if (sys.id === 'vienna' && hash01(J.x, J.z, seed, 'r') < 0.4) return { kind: 'none', minor: [] };
	return { kind: sys.id === 'jp' || sys.id === 'us' || sys.id === 'americas' ? 'stop' : 'yield', minor: J.legs.filter((L) => (L.name || L.r) === weakest) };
}

// ---------- signs for the streets ----------
const SUFFIX = [[/\bStreet$/i, 'St'], [/\bAvenue$/i, 'Ave'], [/\bBoulevard$/i, 'Blvd'], [/\bRoad$/i, 'Rd'], [/\bDrive$/i, 'Dr'], [/\bLane$/i, 'Ln'], [/\bCourt$/i, 'Ct'], [/\bPlace$/i, 'Pl'], [/\bTerrace$/i, 'Ter'], [/\bHighway$/i, 'Hwy'], [/\bParkway$/i, 'Pkwy'], [/\bCircle$/i, 'Cir'], [/\bExpressway$/i, 'Expy']];
// the name as a blade carries it: the suffix abbreviated, the direction prefix kept short
export function bladeName(name, sys) {
	let s = String(name || '').trim();
	if (!s) return '';
	if (sys.id === 'us' || sys.id === 'americas' || sys.id === 'au') {
		for (const [re, ab] of SUFFIX) if (re.test(s)) { s = s.replace(re, ab); break; }
		s = s.replace(/^North /, 'N ').replace(/^South /, 'S ').replace(/^East /, 'E ').replace(/^West /, 'W ');
	}
	return s.length > 26 ? s.slice(0, 25) + '.' : s;
}
// a sign on a post: its face record and the post under it
function postSign(out, posts, face, x, z, nx, nz, w, h, hy, mat = MAT.retro, back = BACK.blank, wear = 0) {
	out.push({ mat, layer: LAYER.poster, face, x, z, hy, nx, nz, w, h, back, wear, base: null, post: true });
	posts.push({ x: x - nx * 0.04, z: z - nz * 0.04, h: hy + h / 2 + 0.05, kind: 'post' });
}
// all the signs a set of streets wants: junction control, street-name blades, speed limits,
// one-way and do-not-enter, no parking downtown, school zones. landAt(x, z) gives the map's
// land use (7 commercial and 8 industrial count as the city); schools: [{ x, z }]
export function streetSigns(roads, sys, { landAt = null, schools = [], seed = 0, phone = false } = {}) {
	const out = [], posts = [];
	const J = junctions(roads);
	const left = sys.side === 'left';
	const cityAt = (x, z) => { const L = landAt?.(x, z); return !!L && (L.lu === 7 || L.lu === 8); };
	const nearSchool = (x, z, r) => schools.some((s) => Math.hypot(s.x - x, s.z - z) < r);
	for (const j of J) {
		const ctl = controlOf(j, sys, seed);
		const reach = Math.max(...j.legs.map((L) => L.hw)) + 1.7;
		const city = cityAt(j.x, j.z);
		// the stop bar's distance out: past the cross street's sidewalk and crosswalk
		const c1 = reach + 0.8 + 3;
		for (const L of j.legs) {
			const [rx, rz] = rightOf(-L.ux, -L.uz);                     // the right of traffic coming in
			const sd = left ? -1 : 1, off = L.hw + 0.75;
			// control: on the incoming lane's curb, facing the traffic
			if (ctl.minor.includes(L) && L.run > 12) {
				const x = j.x + L.ux * (c1 + 1.4) + rx * off * sd, z = j.z + L.uz * (c1 + 1.4) + rz * off * sd;
				const k = ctl.kind === 'yield' ? 'yield' : 'stop';
				const size = k === 'yield' ? (sys.id === 'us' ? 0.91 : 0.9) : 0.76;
				postSign(out, posts, { k, sys: sys.id, word: sys.stop }, x, z, L.ux, L.uz, size, size * (k === 'yield' ? 0.88 : 1), 2.45);
				if (ctl.kind === 'allway') out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'allway', sys: sys.id }, x, z, hy: 1.93, nx: L.ux, nz: L.uz, w: 0.46, h: 0.15, back: BACK.blank, wear: 0, base: null });
			}
			// one-way: a carriageway mapped one way; its mouth (traffic leaving the junction) gets
			// ONE WAY facing the cross street both sides, the other end DO NOT ENTER facing the corner
			if (L.oneway && L.rank < 4) {
				const outbound = L.d > 0;
				if (outbound && hash01(j.x, j.z, L.ux, 'ow') < 0.8) {
					const [nx, nz] = rightOf(L.ux, L.uz);
					const bx = j.x + L.ux * (reach + 1.2) + nx * (L.hw + 0.8), bz = j.z + L.uz * (reach + 1.2) + nz * (L.hw + 0.8);
					for (const s of [1, -1]) {
						const fx = nx * s, fz = nz * s, [vx, vz] = [fz, -fx];      // (the viewer's right, looking at the face)
						out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'oneway', sys: sys.id, dir: L.ux * vx + L.uz * vz > 0 ? 'R' : 'L' }, x: bx + fx * 0.02, z: bz + fz * 0.02, hy: 2.25, nx: fx, nz: fz, w: 0.91, h: 0.3, back: BACK.blank, wear: 0, base: null });
					}
					posts.push({ x: bx, z: bz, h: 2.45, kind: 'post' });
				} else if (!outbound && L.run > 20) {
					const [rx2, rz2] = rightOf(L.ux, L.uz);
					const x = j.x + L.ux * (reach + 2) + rx2 * (L.hw + 0.7), z = j.z + L.uz * (reach + 2) + rz2 * (L.hw + 0.7);
					postSign(out, posts, { k: 'noentry', sys: sys.id }, x, z, -L.ux, -L.uz, 0.76, 0.76, 2.3);
				}
			}
			// the speed limit: leaving the junction, on the outbound right, now and then
			const school = nearSchool(j.x + L.ux * 40, j.z + L.uz * 40, 160);
			const want = L.rank >= 2 ? 0.32 : L.rank === 1 ? 0.1 : 0;
			if (L.run > 90 && hash01(j.x, j.z, L.ux, L.uz, seed, 'spd') < (school ? 0.7 : want)) {
				const [ox, oz] = rightOf(L.ux, L.uz);
				const x = j.x + L.ux * (c1 + 22) + ox * off * sd, z = j.z + L.uz * (c1 + 22) + oz * off * sd;
				const n = school ? sys.speeds.school : sys.speeds[L.r.cls] ?? 30;
				if (school) postSign(out, posts, { k: 'school', sys: sys.id }, x, z, -L.ux, -L.uz, 0.76, 0.76, 3.1);
				postSign(out, posts, { k: 'speed', sys: sys.id, n, unit: sys.unit, school }, x, z, -L.ux, -L.uz, sys.ring ? 0.6 : 0.61, sys.ring ? 0.6 : 0.76, school ? 2.05 : 2.45);
			}
			// no parking downtown, on the curb a little way along
			if (city && L.rank <= 3 && L.run > 40 && hash01(j.x, j.z, L.uz, 'np') < 0.18) {
				const [ox, oz] = rightOf(L.ux, L.uz);
				const x = j.x + L.ux * (c1 + 9) + ox * off * sd, z = j.z + L.uz * (c1 + 9) + oz * off * sd;
				const tow = hash01(x, z, 'tow') < 0.4;
				postSign(out, posts, { k: 'noparking', sys: sys.id, tow, hours: hash01(x, z, 'h') < 0.5 }, x, z, -L.ux, -L.uz, sys.ring ? 0.6 : 0.3, sys.ring ? 0.6 : 0.46, 2.35);
			}
		}
		// the street-name blades: one corner, two blades crossed on one post
		const named = j.legs.filter((L) => L.name);
		if (j.names.size >= 2 && named.length >= 2) {
			const r0 = rng(hash32(Math.round(j.x), Math.round(j.z), seed, 'blade'));
			const a = named[Math.floor(r0() * named.length)];
			// the next leg round with a different name
			const i0 = j.legs.indexOf(a), b = [...j.legs.slice(i0 + 1), ...j.legs.slice(0, i0)].find((L) => L.name && L.name !== a.name);
			if (b) {
				// (the corner between them: clear of each street's curb by its sidewalk)
				const sin = Math.max(0.35, Math.abs(a.ux * b.uz - a.uz * b.ux));
				const px = j.x + (a.ux * (b.hw + 1.3) + b.ux * (a.hw + 1.3)) / sin, pz = j.z + (a.uz * (b.hw + 1.3) + b.uz * (a.hw + 1.3)) / sin;
				const block = (L) => (Math.floor(hash01(Math.round(j.x / 50), Math.round(j.z / 50), L.name) * 40) + 1) * 100;
				for (const [L, hy] of [[a, 2.95], [b, 3.13]]) {
					const txt = bladeName(L.name, sys);
					const [nx, nz] = rightOf(L.ux, L.uz);
					const len = Math.min(1.6, Math.max(0.75, 0.24 + txt.length * 0.072));
					out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'blade', sys: sys.id, name: txt, block: sys.id === 'us' ? block(L) : 0 }, x: px, z: pz, hy, nx, nz, w: len, h: sys.id === 'us' ? 0.2 : 0.22, back: BACK.readable, wear: hash01(px, pz, 'bw') * 0.4, base: null, blade: true });
				}
				posts.push({ x: px, z: pz, h: 3.25, kind: 'post' });
			}
		}
	}
	// (a phone keeps the nearer half of the small signs; the caller sorts by distance)
	return { signs: out, posts, junctions: J, phone };
}

// ---------- the freeways ----------
// Exits: a link leaving the mainline gets an EXIT sign in its gore and, about 400 m before,
// a gantry across the carriageway with the exit's guide sign over the right lanes and the
// route carried on over the others. Every bridge over a road gets its clearance on the face
// toward the traffic (faces: [{ x, y, z, nx, nz, clear }] from bay/freeways.js).
// route(x, z) -> number, dest(num, dir) -> place names
export function freewaySigns(roads, sys, { faces = [], decks = [], route = () => null, dest = () => null, seed = 0 } = {}) {
	const out = [], gantries = [], posts = [];
	const main = roads.filter((r) => r.cls === 'motorway' && !r.link && !r.bridge && r.drive !== false);
	const links = roads.filter((r) => r.cls === 'motorway' && r.link);
	const streets = roads.filter((r) => r.drive !== false && r.cls !== 'motorway' && r.name);
	const nearest = (list, x, z, maxD) => {
		let best = null, bd = maxD, bi = 0, bt = 0;
		for (const r of list) {
			const p = r.pts;
			if (r.box && (x < r.box[0] - maxD || x > r.box[2] + maxD || z < r.box[1] - maxD || z > r.box[3] + maxD)) continue;
			for (let i = 0; i + 3 < p.length; i += 2) {
				const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1;
				const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
				if (d < bd) { bd = d; best = r; bi = i; bt = t; }
			}
		}
		return best ? { r: best, i: bi, t: bt, d: bd } : null;
	};
	// a point s metres back up a road from segment i at t (against its direction of travel)
	const back = (r, i, t, s) => {
		const p = r.pts;
		let x = p[i] + (p[i + 2] - p[i]) * t, z = p[i + 1] + (p[i + 3] - p[i + 1]) * t;
		for (let k = i; k >= 0 && s > 0; k -= 2) {
			const ax = p[k], az = p[k + 1], l = Math.hypot(x - ax, z - az);
			if (l >= s) { const f = s / (l || 1); return { x: x + (ax - x) * f, z: z + (az - z) * f, ux: (x - ax) / (l || 1), uz: (z - az) / (l || 1) }; }
			s -= l; x = ax; z = az;
		}
		return null;
	};
	const nearDeck = (x, z) => decks.some((q) => Math.hypot(q.x - x, q.z - z) < 70);
	const used = [];
	for (const L of links) {
		const p = L.pts, m = p.length;
		if (m < 4) continue;
		const M = nearest(main, p[0], p[1], L.w / 2 + 12);
		if (!M) continue;                                      // (an on-ramp: it starts on a street)
		// (its direction of travel, from its first stretch)
		let ux = p[2] - p[0], uz = p[3] - p[1];
		const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
		const num = route(p[0], p[1]) || (/(\d{1,3})/.exec(M.r.name || '') || [])[1] || '';
		const exitNo = String(1 + hash32(num, Math.round(p[0] / 400), Math.round(p[1] / 400), seed) % 89) + (hash01(p[0], p[1], 'ab') < 0.15 ? 'B' : '');
		const end = nearest(streets, p[m - 2], p[m - 1], 45);
		const onto = end ? bladeName(end.r.name, sys) : 'Local Traffic';
		// the gore: where the ramp leaves, on the left of the ramp
		{
			let s = 0, i = 0;
			while (i + 3 < m && s + Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) < 45) { s += Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]); i += 2; }
			if (i + 3 < m) {
				const f = Math.min(1, (45 - s) / (Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) || 1));
				const gx = p[i] + (p[i + 2] - p[i]) * f, gz = p[i + 1] + (p[i + 3] - p[i + 1]) * f;
				// (the gore is between the ramp and the mainline: on the ramp's left where traffic
				// keeps right, its right where it keeps left)
				const [rx, rz] = rightOf(ux, uz);
				const s2 = sys.side === 'left' ? 1 : -1;
				const x = gx + rx * s2 * (L.w / 2 + 2.2), z = gz + rz * s2 * (L.w / 2 + 2.2);
				postSign(out, posts, { k: 'exitgore', sys: sys.id, n: exitNo }, x, z, -ux, -uz, 1.6, 1.15, 2.6);
			}
		}
		// the advance gantry, 400 m back up the mainline
		const B = back(M.r, M.i, M.t, 400);
		if (!B || nearDeck(B.x, B.z) || used.some((u) => Math.hypot(u.x - B.x, u.z - B.z) < 250)) continue;
		used.push(B);
		const hw = M.r.w / 2, [rx, rz] = rightOf(B.ux, B.uz), sd = sys.side === 'left' ? -1 : 1;
		const a = { x: B.x - rx * sd * (hw + 1.6), z: B.z - rz * sd * (hw + 1.6) }, b = { x: B.x + rx * sd * (hw + 1.6), z: B.z + rz * sd * (hw + 1.6) };
		gantries.push({ x0: a.x, z0: a.z, x1: b.x, z1: b.z, h: 6.6, ux: B.ux, uz: B.uz });
		const dir = Math.abs(B.ux) > Math.abs(B.uz) ? (B.ux > 0 ? 'E' : 'W') : (B.uz < 0 ? 'N' : 'S');
		const panel = (face, along, w, h) => out.push({ mat: MAT.retro, layer: LAYER.poster, face, x: B.x + rx * sd * along - B.ux * 0.35, z: B.z + rz * sd * along - B.uz * 0.35, hy: 6.6 + 0.45 + h / 2 - 0.4, nx: -B.ux, nz: -B.uz, w, h, back: BACK.blank, wear: 0, base: null, gantry: true });
		panel({ k: 'guide', sys: sys.id, exit: exitNo, lines: [onto], dist: sys.unit === 'mph' ? '1/4 MILE' : '400 m', arrow: 'down' }, hw * 0.45, Math.min(5.4, hw * 0.95), 2.6);
		if (num) panel({ k: 'guide', sys: sys.id, route: String(num), dir, lines: [dest(num, dir) || M.r.dest || 'Thru Traffic'], arrow: 'down' }, -hw * 0.4, Math.min(5.0, hw * 0.9), 2.6);
	}
	// clearance on the bridges' faces
	for (const F of faces) {
		if (!(F.clear > 2) || F.clear > 7.5) continue;
		out.push({ mat: MAT.retro, layer: LAYER.poster, face: { k: 'clearance', sys: sys.id, txt: sys.clearance(Math.floor(F.clear * 10) / 10 - 0.1) }, x: F.x, z: F.z, hy: 0, abs: F.y, nx: F.nx, nz: F.nz, w: 1.25, h: 0.5, back: BACK.blank, wear: 0, base: null });
	}
	return { signs: out, gantries, posts };
}

// ---------- the businesses' doors and windows ----------
// What the trade and the law put on a shop's glass: the hours, push or pull, the cards it
// takes, the access symbol, the street number over the door, the alarm company's sticker in
// the corner, the name in gold leaf on the window, a sale poster; an office's suite number and
// no-soliciting card. biz: { name, type, use, x, z } and front: { x, z, nx, nz, run, g, door }
// (the face's middle, outward normal, its length, the ground, the door's distance along it).
export const ALARM_CO = ['Halberd Alarm', 'Vigilon Security', 'Keystone Watch', 'Ironleaf Protection', 'Sentrel Systems', 'Bastion Monitoring', 'Northgate Alarm Co.', 'Copperline Security'];
export const CARD_MARKS = ['Tally', 'Kestrel Pay', 'Orbit Card', 'Lumen', 'Quay', 'Fernpay'];
const HOURS = {
	cafe: [6.5, 15], bakery: [6, 14], diner: [6, 22], grocer: [7, 22], general: [7, 21], pharmacy: [8, 21], bar: [16, 26], pub: [11, 24], restaurant: [11, 22], pizza: [11, 23],
	books: [10, 20], boutique: [10, 19], hardware: [7, 19], barber: [9, 18], salon: [9, 19], florist: [9, 18], laundromat: [6, 23], office: [8, 18], tech: [9, 18], bank: [9, 17],
};
export function hoursOf(type, sys, seed = 0) {
	const [a, b] = HOURS[type] || HOURS[Object.keys(HOURS).find((k) => String(type).includes(k))] || [10, 19];
	const jit = Math.floor(hash01(type, seed) * 3) * 0.5;
	const o = a + (jit > 0.5 ? 0.5 : 0), c = b - (jit > 1 ? 1 : 0);
	const h24 = sys.id !== 'us' && sys.id !== 'americas' && sys.id !== 'au';
	const f = (t) => { const hh = Math.floor(t) % 24, mm = Math.round((t % 1) * 60); if (h24) return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; const ap = hh < 12 ? 'am' : 'pm', h12 = hh % 12 || 12; return mm ? `${h12}:${String(mm).padStart(2, '0')}${ap}` : `${h12}${ap}`; };
	const closedSun = hash01(type, seed, 'sun') < 0.3 && !/bar|pub|grocer|cafe|restaurant|pizza/.test(type);
	return { open: o, close: c, line: `${f(o)}–${f(c)}`, closedSun, days: closedSun ? 'MON–SAT' : 'DAILY' };
}
export function storefrontDecals(biz, front, sys, { seed = 0, glass = true, number = null } = {}) {
	const out = [];
	const { nx, nz, g } = front, tx = nz, tz = -nx;
	const r = rng(hash32(Math.round(biz.x * 2), Math.round(biz.z * 2), seed, 'front'));
	const at = (along, hy, w, h, face, mat, layer, back = BACK.mirrored, wear = 0) => out.push({ mat, layer, face, x: front.x + tx * along, z: front.z + tz * along, hy, nx, nz, w, h, back, wear, base: g });
	const door = front.door ?? 0, run = front.run ?? 6, half = run / 2;
	const gl = glass ? MAT.glass : MAT.vinyl;
	const handle = r() < 0.5 ? -1 : 1;
	const type = biz.type || biz.use || 'shop';
	const office = biz.use === 'office' || biz.use === 'tower' || /office|tech|bank|law|clinic/.test(type);
	// the door: push or pull at the handle, the hours beside it at eye height
	at(door + handle * 0.28, 1.12, 0.17, 0.065, { k: 'pushpull', word: sys.id === 'jp' ? '押' : sys.id === 'vienna' ? (biz.locale === 'de' ? 'ZIEHEN' : biz.locale === 'fr' ? 'TIREZ' : biz.locale === 'es' ? 'TIRE' : biz.locale === 'it' ? 'TIRARE' : 'PULL') : 'PULL' }, gl, LAYER.sticker, BACK.none);
	const H = hoursOf(type, sys, hash32(biz.name || '', seed));
	at(door - handle * 0.2, 1.48, 0.3, 0.34, { k: 'hours', sys: sys.id, days: H.days, line: H.line, closedSun: H.closedSun }, gl, LAYER.sticker);
	// the street number over the door, on the transom
	const num = number ?? (2 + Math.floor(hash01(Math.round(biz.x), Math.round(biz.z), 'addr') * 48) * 2 + (hash01(biz.x, 'odd') < 0.5 ? 1 : 0)) * (r() < 0.6 ? 10 : 1);
	at(door, 2.6, 0.48, 0.18, { k: 'address', n: String(num), gold: r() < 0.25 }, r() < 0.25 ? MAT.foil : gl, LAYER.poster);
	// the cards it takes, the access symbol, no smoking; the alarm sticker low in a corner
	if (!office || r() < 0.4) at(door + handle * 0.62, 1.3, 0.24, 0.12, { k: 'payment', marks: [0, 1, 2, 3].map(() => Math.floor(r() * CARD_MARKS.length)) }, gl, LAYER.sticker);
	if (r() < 0.75) at(door - handle * 0.24, 1.0, 0.13, 0.13, { k: 'access' }, gl, LAYER.sticker);
	if (r() < 0.45) at(door + handle * 0.62, 1.55, 0.1, 0.1, { k: 'nosmoking', sys: sys.id }, gl, LAYER.sticker);
	if (run > 3.2 && r() < 0.6) {
		const side = door + (door > 0 ? -1 : 1) * Math.min(half - 0.3, 1.6);
		at(side, 0.42, 0.12, 0.14, { k: 'alarm', co: pick(r, ALARM_CO) }, r() < 0.5 ? MAT.foil : gl, LAYER.sticker);
		// (and sometimes an older one under its corner: the last company's)
		if (r() < 0.25) at(side + 0.06, 0.37, 0.12, 0.14, { k: 'alarm', co: pick(r, ALARM_CO) }, gl, LAYER.sticker, BACK.mirrored, 0.6);
	}
	// the display window: the name in gold leaf or cut vinyl, a sale poster inside the glass
	if (run > 4 && !office) {
		const win = door + (door > 0 ? -1 : 1) * Math.min(half - 1.0, 2.2);
		if (r() < 0.45) at(win, 1.75, Math.min(1.5, run * 0.3), 0.36, { k: 'window', name: biz.name || '', tag: biz.tag || '' }, r() < 0.5 ? MAT.foil : gl, LAYER.sticker);
		if (/grocer|general|pharmacy|market|shop|hardware|boutique|books/.test(type) && r() < 0.7) at(win + (r() - 0.5) * 0.6, 1.15, 0.45, 0.62, { k: 'sale', sys: sys.id, pct: pick(r, [10, 20, 25, 30, 40, 50]), what: type }, MAT.paper, LAYER.poster, BACK.mirrored, r() * 0.4);
		if (r() < 0.35) at(win - 0.7, 1.05, 0.28, 0.18, { k: 'open', sys: sys.id }, gl, LAYER.sticker);
	}
	// Tall facade graphics identify the real tenant and leave the entrance clear.
	const identity = retailIdentity(type, biz.id || biz.name || `${biz.x}:${biz.z}`);
	if (!office && run >= 5 && identity.trade >= 0) {
		const side = door > 0 ? -1 : 1, along = side * (half - .65);
		const height = Math.min(3.7, Math.max(0, (front.height ?? 3.5) - .3));
		if (height >= 2 && Math.abs(along - door) > 1.3) at(along, .15 + height/2, .78, height,
			{ k: 'banner', ...identity, name: biz.name, label: biz.label || identity.label, request: !!biz.request }, MAT.vinyl, LAYER.poster, BACK.mirrored, .03);
	}
	if (office) {
		at(door + handle * 0.55, 1.55, 0.2, 0.14, { k: 'suite', n: String(100 + Math.floor(r() * 9) * 100 + Math.floor(r() * 20)) }, MAT.foil, LAYER.poster, BACK.blank);
		if (r() < 0.5) at(door - handle * 0.25, 1.3, 0.16, 0.09, { k: 'nosolicit', sys: sys.id }, gl, LAYER.sticker);
	}
	return out;
}
// the back door on the alley: staff only, deliveries, its number, no parking against the wall
export function backDoorDecals(door, sys, { seed = 0, name = '' } = {}) {
	const [x, z, yaw] = door, nx = Math.sin(yaw), nz = Math.cos(yaw), tx = nz, tz = -nx;
	const r = rng(hash32(Math.round(x * 2), Math.round(z * 2), seed, 'back'));
	const out = [];
	const at = (along, hy, w, h, face, mat = MAT.vinyl, layer = LAYER.poster) => out.push({ mat, layer, face, x: x + tx * along + nx * 0.02, z: z + tz * along + nz * 0.02, hy, nx, nz, w, h, back: BACK.none, wear: r() * 0.6, base: null });
	at(0, 1.6, 0.3, 0.1, { k: 'staff', sys: sys.id });
	if (r() < 0.55) at(0.75, 1.45, 0.3, 0.2, { k: 'deliveries', sys: sys.id, name });
	if (r() < 0.5) at(-0.8, 1.8, 0.3, 0.42, { k: 'noparking', sys: sys.id, tow: true, hours: false }, MAT.retro);
	at(0, 2.35, 0.24, 0.1, { k: 'address', n: String(10 + Math.floor(r() * 90)), gold: false });
	return out;
}

// ---------- graffiti, posters, stickers and grime ----------
// A believable model of who paints where. Surfaces: { kind, x, z, y, nx, nz, w, h, lu?,
// civic?, storefront? } where kind is soundwall, pier, abutment, alley (a back wall),
// dumpster, side (a building's blank side), industrial, signback, post or ground. Writers go
// for what is seen and safe to paint: the walls along the freeway, the overpasses' piers, the
// alleys, the rail cuts, the sides and backs of buildings, an empty lot; never a business's
// front or a civic building. More where the region's morality is low (trouble: 0 calm .. 1
// rough, from people/moral-regions.js), less where the neighbourhood is well off and the city
// buffs often. day: whole days, for the crews' buffing (a week at a time).
const SURF = { soundwall: 0.85, pier: 0.75, abutment: 0.8, alley: 0.6, dumpster: 0.5, side: 0.3, industrial: 0.55, signback: 0.35, post: 0.3, rail: 0.9 };
export function writerPressure({ trouble = 0.3, means = 0.5, law = 0 } = {}) {
	return Math.max(0.15, Math.min(2.4, 0.45 + trouble * 1.7 - (means - 0.5) * 0.7 - Math.max(-1, Math.min(1, law)) * 0.12));
}
export function graffitiFor(surfaces, { morality = {}, seed = 0, day = 0, phone = false } = {}) {
	const out = [];
	const P = writerPressure(morality) * (phone ? 0.6 : 1);
	const week = Math.floor(day / 7);
	for (const S of surfaces) {
		if (S.civic || S.storefront) continue;
		const base = SURF[S.kind] ?? 0;
		if (!base) continue;
		const r = rng(hash32(Math.round(S.x * 4), Math.round(S.z * 4), Math.round((S.y || 0) * 4), seed, S.kind));
		const lu = S.lu ?? 7, luK = lu === 8 ? 1.4 : lu === 7 ? 1.1 : lu === 1 ? 0.45 : lu === 2 || lu === 6 ? 0.25 : 0.8;
		const chance = Math.min(0.95, base * P * luK);
		const tx = S.nz, tz = -S.nx;
		const put = (along, hy, w, h, face, mat, layer, wear = 0) => out.push({ mat, layer, face, x: S.x + tx * along, z: S.z + tz * along, hy, nx: S.nx, nz: S.nz, w, h, back: BACK.none, wear, base: S.y ?? null, surf: S.kind });
		const span = S.w || 3, tall = S.h || 3;
		if (S.kind === 'signback' || S.kind === 'post') {
			// a cluster of stickers, slapped one over another
			if (r() > chance) continue;
			const n = 1 + Math.floor(r() * (S.kind === 'post' ? 3 : 5));
			for (let i = 0; i < n; i++) put((r() - 0.5) * span * 0.7, (S.hy ?? 1.6) + (r() - 0.5) * Math.min(tall, 0.5), 0.07 + r() * 0.08, 0.05 + r() * 0.07, { k: 'sticker', seed: hash32(S.x, S.z, i, seed) % 4096 }, MAT.vinyl, i > 1 && r() < 0.5 ? LAYER.overSticker : LAYER.sticker, r() * 0.7);
			if (S.kind === 'post' && r() < 0.35 * P) put(0, 1.55, 0.21, 0.28, { k: 'flyer', seed: hash32(S.x, S.z, 'fl') % 4096 }, MAT.paper, LAYER.poster, r() * 0.8);
			continue;
		}
		// tags along the run, a throw-up, now and then a full piece on a long wall
		const slots = Math.max(1, Math.floor(span / 4.5));
		for (let i = 0; i < slots; i++) {
			if (r() > chance) continue;
			const along = (i + 0.5) / slots * span - span / 2 + (r() - 0.5) * 1.5;
			const roll = r(), sid = hash32(S.x, S.z, i, seed) % 8192;
			let face, w, h, hy;
			if (roll < 0.08 && span > 9 && tall > 2.4 && (S.kind === 'soundwall' || S.kind === 'abutment' || S.kind === 'rail' || S.kind === 'industrial')) { face = { k: 'piece', seed: sid }; w = Math.min(span * 0.6, 7 + r() * 3); h = Math.min(tall * 0.75, w * 0.38); hy = 0.4 + h / 2; }
			else if (roll < 0.33) { face = { k: 'throwup', seed: sid }; w = 1.8 + r() * 1.6; h = w * 0.45; hy = 0.5 + h / 2 + r() * 0.3; }
			else { face = { k: 'tag', seed: sid }; w = 0.7 + r() * 1.1; h = w * 0.42; hy = 0.9 + r() * 1.2; }
			if (S.kind === 'dumpster') { w *= 0.6; h *= 0.6; hy = 0.75; }
			if (S.kind === 'pier') { w = Math.min(w, span * 0.9); h = Math.min(h, w * 0.5); }
			hy = Math.min(hy, tall - h / 2 - 0.1);
			// the crews: some get buffed out in a block of grey that does not quite match the wall;
			// a few weeks on, someone writes over the buff again
			const buffRate = 0.22 + (morality.means ?? 0.5) * 0.25;
			const buffed = hash01(sid, week, 'buff') < buffRate;
			if (buffed) {
				put(along, hy, w * 1.15, h * 1.3, { k: 'buff', tone: Math.floor(hash01(sid, 'tone') * 4) }, MAT.paint, LAYER.paint, 0);
				// (the new tag is pushed after its buff, and a batch draws in order: it lands on top)
				if (hash01(sid, week, 'again') < 0.35 * P) put(along + (r() - 0.5) * 0.4, hy + (r() - 0.5) * 0.3, 0.8 + r() * 0.6, 0.35 + r() * 0.2, { k: 'tag', seed: (sid + 101) % 8192 }, MAT.paint, LAYER.paint, 0);
				continue;
			}
			put(along, hy, w, h, face, MAT.paint, LAYER.paint, r() * 0.5);
		}
		// a wheatpasted poster or two in the alleys and on the industrial walls
		if ((S.kind === 'alley' || S.kind === 'industrial' || S.kind === 'abutment') && r() < 0.45 * P) {
			const along = (r() - 0.5) * span * 0.7;
			for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) put(along + k * 0.62, 1.7 + (r() - 0.5) * 0.2, 0.58, 0.82, { k: 'wheatpaste', seed: hash32(S.x, S.z, k, 'wp') % 4096 }, MAT.paper, LAYER.poster, 0.2 + r() * 0.8);
		}
	}
	return out;
}
// grime the years leave: rust run down from a fixture, soot over a kitchen's vent, water
// streaks off a parapet, gum trodden into the sidewalk, oil where cars stand
export function grimeFor(surfaces, { seed = 0, phone = false } = {}) {
	const out = [];
	for (const S of surfaces) {
		const r = rng(hash32(Math.round(S.x * 3), Math.round(S.z * 3), seed, 'grime', S.kind));
		const tx = S.nz, tz = -S.nx, span = S.w || 3, tall = S.h || 3;
		const put = (along, hy, w, h, type, ground = false) => out.push({ mat: MAT.grime, layer: LAYER.grime, face: { k: 'grime', type }, x: S.x + tx * along, z: S.z + tz * along, hy, nx: ground ? 0 : S.nx, nz: ground ? 0 : S.nz, ny: ground ? 1 : 0, w, h, back: BACK.none, wear: r(), base: S.y ?? null, seed: r() });
		if (S.kind === 'ground') {
			if (phone) continue;
			const n = S.gum ?? 1;
			for (let i = 0; i < n; i++) if (r() < 0.8) put((r() - 0.5) * span, 0.012, 1.2 + r(), 1.2 + r(), 'gum', true);
			if (S.oil && r() < 0.7) put(0, 0.012, 1.4 + r(), 2.2 + r(), 'oil', true);
			continue;
		}
		if (S.kind === 'soundwall' || S.kind === 'pier' || S.kind === 'abutment') {
			for (let a = -span / 2 + 1; a < span / 2 - 1; a += 2.5 + r() * 3) if (r() < 0.55) put(a, tall - 0.9, 0.5 + r() * 0.6, 1.8, 'streak');
			continue;
		}
		if (S.kind === 'alley' || S.kind === 'industrial' || S.kind === 'side') {
			if (r() < 0.6) put((r() - 0.5) * span * 0.8, Math.min(tall - 0.7, 2.4 + r()) - 0.5, 0.22, 1.2, 'rust');
			if (S.kitchen && r() < 0.85) put((r() - 0.5) * span * 0.6, Math.min(tall - 1.2, 2.9), 0.9, 1.6, 'soot');
			if (r() < 0.5) put((r() - 0.5) * span * 0.8, tall - 1, 0.6, 2, 'streak');
		}
	}
	return out;
}

// ---------- the construction sites ----------
// Round a building going back up (structures/rebuild.js): the road-work warning back up the
// street, the site's own boards on its hoarding, hard hats, the entrance for its trucks.
export function constructionSigns(site, sys, { seed = 0 } = {}) {
	const out = [], posts = [];
	const { x, z, w, d, a } = site, ca = Math.cos(a), sa = Math.sin(a);
	const r = rng(hash32(Math.round(x), Math.round(z), seed, 'site'));
	// the front, toward local +z, a little out from the wall: the hoarding's boards
	const nx = -sa, nz = ca, tx = nz, tz = -nx;
	const fx = x + nx * (d / 2 + 1.6), fz = z + nz * (d / 2 + 1.6);
	const board = (along, face, ww, hh, hy) => out.push({ mat: MAT.vinyl, layer: LAYER.poster, face, x: fx + tx * along, z: fz + tz * along, hy, nx, nz, w: ww, h: hh, back: BACK.blank, wear: r() * 0.3, base: null });
	board(-Math.min(w * 0.25, 3), { k: 'site', sys: sys.id, line: pick(r, ['HARD HAT AREA', 'AUTHORIZED PERSONNEL ONLY', 'SAFETY FIRST']) }, 1.2, 0.8, 1.4);
	board(Math.min(w * 0.25, 3), { k: 'permit', sys: sys.id, no: String(10000 + Math.floor(r() * 89999)) }, 0.45, 0.6, 1.35);
	posts.push({ x: fx + tx * -Math.min(w * 0.25, 3) - nx * 0.05, z: fz + tz * -Math.min(w * 0.25, 3) - nz * 0.05, h: 1.85, kind: 'post' }, { x: fx + tx * Math.min(w * 0.25, 3) - nx * 0.05, z: fz + tz * Math.min(w * 0.25, 3) - nz * 0.05, h: 1.7, kind: 'post' });
	// the warning up the street: an orange diamond (or the Vienna triangle with its workman)
	const wx = fx + nx * 5 + tx * (w / 2 + 6), wz = fz + nz * 5 + tz * (w / 2 + 6);
	postSign(out, posts, { k: 'work', sys: sys.id }, wx, wz, tx, tz, sys.warn === 'triangle' ? 0.9 : 0.91, sys.warn === 'triangle' ? 0.8 : 0.91, 1.6);
	return { signs: out, posts };
}

// ---------- the cars ----------
// What a car carries: its plates from the pool the region's plates are drawn into, a dealer's
// frame on some, bumper stickers on a third, a parking permit or a region's windscreen
// sticker, a rear-window sticker now and then. Liveries for the services' cars. Indexes into
// the pools (signage/cars.js draws them); the same car is the same every time.
export const POOLS = { plate: 48, bumper: 24, window: 12, permit: 8 };
export function carDecalSet(seed, { sys, livery = null, phone = false } = {}) {
	const r = rng(seed >>> 0 || 1);
	const S = { plate: Math.floor(r() * POOLS.plate), front: !!sys.frontPlate, bumper: [], window: -1, permit: -1, livery };
	if (livery) return S;
	const nb = r() < 0.33 ? 1 + Math.floor(r() * (phone ? 1 : 3)) : 0;
	for (let i = 0; i < nb; i++) S.bumper.push(Math.floor(r() * POOLS.bumper));
	if (r() < 0.18) S.window = Math.floor(r() * POOLS.window);
	if (r() < (sys.id === 'jp' || sys.id === 'vienna' ? 0.55 : 0.2)) S.permit = Math.floor(r() * POOLS.permit);
	return S;
}
