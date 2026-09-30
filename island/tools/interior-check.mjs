// Checks the planned interiors for what no real house has: walls that cross or double up,
// passages too tight to walk down, rooms too narrow to use, slivers and jogs, and doors
// blocked by a wall, the stairs or the furniture. It plans many buildings of every kind:
// the real houses of each mapped region (houseplan.js, and again with other seeds), the
// houses of a few grown towns (crysis/civgen.js), and the city's row houses, flats over
// shops, apartment blocks and halls (interiors/plan.js) over many sizes and seeds.
//   node tools/interior-check.mjs [housesPerRegion] [seedsPerSpec] [--show kind]
// Prints the counts; --show prints the first few failing plans as text.
import fs from 'fs';
import zlib from 'zlib';
import { planHouse, groupBoxes, mainOf, HT, TW } from '../src/bay/houseplan.js';
import { planRow, planApt, planHall, rng, ST } from '../src/interiors/plan.js';
import { furnish } from '../src/interiors/furnish.js';
import { generateTownSteps, hashStr } from '../src/crysis/civgen.js';

// (the Summit Building's plan, where the planner has one)
const planSummit = (await import('../src/interiors/plan.js')).planSummit;
const args = process.argv.slice(2);
const showKind = args.includes('--show') ? args[args.indexOf('--show') + 1] : null;
const nums = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--show').map(Number);
const PER_REGION = nums[0] ?? 250, SEEDS = nums[1] ?? 12;

// the limits: clear widths, face to face, in metres
const PASSAGE = 1.1, ROOM = 2.2, SLIVER = 0.6, DOOR_DEPTH = 0.7;
const HALLS = new Set(['hall', 'entry', 'corridor', 'lobby', 'well', 'loft']);
// the rooms that are small in any real house: a 5 by 8 ft bath, a powder room, a closet
const SMALLER = { bath: 1.5, mbath: 1.5, laundry: 1.5, storage: 1.5, sealed: 1.5, powder: 1.2, closet: 0.9, pantry: 0.9 };
const SOFT = new Set(['rug', 'bathMat', 'art', 'ceilingLight', 'toys', 'crown']);
const RES = 0.1;

// ---------------------------------------------------------------------------------
// a plan of either planner as one shape: levels of rooms (a label raster), walls with
// thickness and openings, and the things that stand in the way (stairs, furniture)

function fromHouse(p) {
	const levels = [];
	for (const L of [0, 1]) {
		if (L && !p.up) continue;
		const rooms = p.rooms.filter((r) => r.level === L && r.cells.length).map((r) => ({ id: r.id, type: r.type }));
		const walls = p.walls.filter((w) => w.level === L).map((w) => {
			const [a0, a1] = w.kind === 'ext' ? (w.inSide > 0 ? [w.pos, w.pos + TW.ext] : [w.pos - TW.ext, w.pos]) : [w.pos - TW.part / 2, w.pos + TW.part / 2];
			return { axis: w.axis, pos: w.pos, a0, a1, s: w.s, e: w.e, ext: w.kind === 'ext', open: w.open.filter((o) => o.type !== 'window').map((o) => ({ s0: o.s0, s1: o.s1, type: o.type, low: o.y0 < (L ? HT.floor1 : 0) + 0.3 })), sides: w.kind === 'ext' ? [w.inSide] : [-1, 1] };
		});
		const stuff = [];
		const S = p.stairs;
		if (S) stuff.push([S.x0, S.zt, S.x1, L ? S.zw ?? S.zb : S.zb]);
		for (const it of p.items) if (it.level === L && it.box && !SOFT.has(it.type) && it.h > 0.05) stuff.push(it.box);
		const label = (x, z) => { const c = p.cellAt(x, z); return c >= 0 && p.X[0] <= x && x <= p.X[p.nx] && p.Z[0] <= z && z <= p.Z[p.nz] ? p.labels[L][c] : -1; };
		levels.push({ L, rooms, walls, stuff, label, box: [p.X[0], p.Z[0], p.X[p.nx], p.Z[p.nz]] });
	}
	return levels;
}
function fromCity(P) {
	return P.levels.map((Lv) => {
		const k = Lv.k, rooms = Lv.rooms.map((id) => P.rooms[id]);
		const walls = P.walls.filter((w) => w.k === k).map((w) => ({ axis: w.axis, pos: w.pos, a0: w.pos - w.t / 2, a1: w.pos + w.t / 2, s: w.s, e: w.e, ext: w.kind === 'ext', open: w.open.filter((o) => o.type !== 'window' && o.type !== 'store' && o.type !== 'bay').map((o) => ({ s0: o.s0, s1: o.s1, type: o.type, low: o.y0 < Lv.y + 0.3 })), sides: w.kind === 'ext' ? [-w.out] : [-1, 1] }));
		const stuff = [];
		for (const f of P.flights) if (f.k === k) stuff.push([f.x0, Math.min(f.zb, f.zt), f.x1, Math.max(f.zb, f.zt)]);
		for (const d of P.landings) if (d.k === k) stuff.push([d.x0, d.z0, d.x1, d.z1]);
		for (const h of Lv.holes) stuff.push(h);
		for (const r of P.rails) if (r.k === k) stuff.push([r.x0, r.z0, r.x1, r.z1]);
		for (const it of P.items) if (it.box && !SOFT.has(it.type) && it.h > 0.05 && Math.abs(it.y - Lv.y) < 0.5) stuff.push(it.box);
		const label = (x, z) => { for (const r of rooms) if (x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1) return r.id; return -1; };
		return { L: k, rooms: rooms.map((r) => ({ id: r.id, type: r.type })), walls, stuff, label, box: [-P.W / 2, -P.D / 2, P.W / 2, P.D / 2 + 1.4] };
	});
}

// ---------------------------------------------------------------------------------
// the checks, one level at a time

function checkLevel(Lv, out) {
	const [bx0, bz0, bx1, bz1] = Lv.box, nx = Math.ceil((bx1 - bx0) / RES) + 1, nz = Math.ceil((bz1 - bz0) / RES) + 1;
	const X = (i) => bx0 + (i + 0.5) * RES, Z = (j) => bz0 + (j + 0.5) * RES;
	const lab = new Int32Array(nx * nz), wallAt = new Uint8Array(nx * nz), stuffAt = new Uint8Array(nx * nz), gapAt = new Uint8Array(nx * nz);
	for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) lab[i + j * nx] = Lv.label(X(i), Z(j));
	const fill = (arr, x0, z0, x1, z1, v = 1) => {
		const i0 = Math.max(0, Math.ceil((x0 - bx0) / RES - 0.5)), i1 = Math.min(nx - 1, Math.floor((x1 - bx0) / RES - 0.5)), j0 = Math.max(0, Math.ceil((z0 - bz0) / RES - 0.5)), j1 = Math.min(nz - 1, Math.floor((z1 - bz0) / RES - 0.5));
		for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) arr[i + j * nx] = v;
	};
	const wbox = (w, s, e) => (w.axis === 'x' ? [s, w.a0, e, w.a1] : [w.a0, s, w.a1, e]);
	for (const w of Lv.walls) {
		const cuts = [[w.s, w.e]];
		for (const o of w.open) if (o.low) { const next = []; for (const [a, b] of cuts) { if (o.s1 <= a || o.s0 >= b) next.push([a, b]); else { if (o.s0 > a) next.push([a, o.s0]); if (o.s1 < b) next.push([o.s1, b]); } } cuts.splice(0, cuts.length, ...next); }
		for (const [a, b] of cuts) fill(wallAt, ...wbox(w, a, b));
		// (the doorways themselves, in the thickness of the wall, are no part of either room)
		for (const o of w.open) if (o.low) fill(gapAt, ...wbox(w, o.s0, o.s1));
	}
	for (const b of Lv.stuff) fill(stuffAt, b[0], b[1], b[2], b[3]);

	// ---- walls crossing or doubled up
	const W = Lv.walls;
	for (let a = 0; a < W.length; a++) for (let b = a + 1; b < W.length; b++) {
		const p = W[a], q = W[b];
		if (p.axis !== q.axis) {
			// an X: each runs on past the other
			const m = 0.12;
			if (q.pos > p.s + m && q.pos < p.e - m && p.pos > q.s + m && p.pos < q.e - m) out.cross++;
		} else if (Math.min(p.a1, q.a1) - Math.max(p.a0, q.a0) > 0.005 && Math.min(p.e, q.e) - Math.max(p.s, q.s) > 0.05) out.overlap++;
	}
	// ---- walls with the same room on both sides (a wall run out into a room)
	for (const w of W) {
		if (w.ext) continue;
		let stray = 0;
		for (let u = w.s + 0.15; u < w.e - 0.15; u += RES) {
			if (w.open.some((o) => u > o.s0 - 0.05 && u < o.s1 + 0.05)) continue;
			const at = (d) => (w.axis === 'x' ? Lv.label(u, w.pos + d) : Lv.label(w.pos + d, u));
			const A = at(-(w.pos - w.a0) - 0.08), B = at(w.a1 - w.pos + 0.08);
			if (A >= 0 && A === B) stray += RES;
		}
		if (stray > 0.25) out.stray++;
	}
	// ---- slivers: collinear partition runs that are short, the jogs of a stepped wall
	const runs = new Map();
	for (const w of W) {
		if (w.ext) continue;
		const k = w.axis + ':' + w.pos.toFixed(3);
		let l = runs.get(k); if (!l) runs.set(k, l = []);
		l.push([w.s, w.e]);
	}
	for (const [k, l] of runs) {
		l.sort((a, b) => a[0] - b[0]);
		let cur = null;
		const done = (r) => { if (r && r[1] - r[0] < SLIVER) { out.sliver++; out.why.push('sliver ' + (r[1] - r[0]).toFixed(2)); if (showKind) out.marks.push(k.startsWith('x') ? [Lv.L, (r[0] + r[1]) / 2, +k.slice(2)] : [Lv.L, +k.slice(2), (r[0] + r[1]) / 2]); } };
		for (const r of l) { if (cur && r[0] <= cur[1] + 0.02) cur[1] = Math.max(cur[1], r[1]); else { done(cur); cur = [...r]; } }
		done(cur);
	}
	// ---- non-orthogonal walls (every planner here lays walls on the two axes)
	for (const w of W) if (w.axis !== 'x' && w.axis !== 'z') out.angle++;

	// ---- clear widths: each room's floor (less its walls and the stairs) opened by squares
	for (const r of Lv.rooms) {
		const free = new Uint8Array(nx * nz);
		let n = 0;
		for (let c = 0; c < nx * nz; c++) if (lab[c] === r.id && !wallAt[c] && !gapAt[c] && !(stuffAt[c] && isStair(Lv, c, nx, X, Z))) { free[c] = 1; n++; }
		if (n < 4) continue;
		const th = thickness(free, nx, nz);
		const lim = HALLS.has(r.type) ? PASSAGE : SMALLER[r.type] ?? ROOM;
		let bad = 0;
		// (a gap of a hand's width between the stairs and a wall is no passage: not counted)
		for (let c = 0; c < nx * nz; c++) if (free[c] && th[c] * RES < lim - RES * 1.01 && th[c] * RES > 0.25) bad++;
		if (bad * RES * RES >= 0.3 && showKind) for (let c = 0; c < nx * nz; c++) if (free[c] && th[c] * RES < lim - RES * 1.01 && th[c] * RES > 0.25) out.marks.push([Lv.L, X(c % nx), Z(Math.floor(c / nx))]);
		if (bad * RES * RES >= 0.3) { if (HALLS.has(r.type)) out.passage++; else out.narrow++; out.why.push(r.type + (HALLS.has(r.type) ? ' passage' : ' narrow') + ' ' + (bad * RES * RES).toFixed(1) + 'm2'); }
	}

	// ---- doors: the floor in front of each, both sides, clear of walls, stairs and furniture
	for (const w of W) for (const o of w.open) {
		if (!o.low || o.type === 'garage' || o.type === 'slider' || o.type === 'open') continue;
		for (const sd of w.sides) {
			const f = sd > 0 ? w.a1 : w.a0, g = f + sd * DOOR_DEPTH;
			const b = w.axis === 'x' ? [o.s0 + 0.08, Math.min(f, g), o.s1 - 0.08, Math.max(f, g)] : [Math.min(f, g), o.s0 + 0.08, Math.max(f, g), o.s1 - 0.08];
			let blocked = 0, outside = 0, cells = 0, byWall = 0;
			for (let x = b[0] + RES / 2; x < b[2]; x += RES) for (let z = b[1] + RES / 2; z < b[3]; z += RES) {
				const i = Math.floor((x - bx0) / RES), j = Math.floor((z - bz0) / RES);
				if (i < 0 || j < 0 || i >= nx || j >= nz) { outside++; cells++; continue; }
				const c = i + j * nx;
				cells++;
				if (wallAt[c] || stuffAt[c]) blocked++;
				if (wallAt[c]) byWall++;
				else if (lab[c] < 0) outside++;
			}
			if (blocked > cells * 0.04) { out.door++; out.why.push('door ' + o.type + ' blocked by ' + (byWall ? 'a wall' : 'stairs or furniture')); if (showKind) out.marks.push([Lv.L, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2]); break; }
			if (!w.ext && outside > cells * 0.3) { out.door++; out.why.push('door ' + o.type + ' onto nothing'); break; }
		}
	}
}
// (the stairs are in the way; furniture is not counted against a room's width)
function isStair(Lv, c, nx, X, Z) {
	const x = X(c % nx), z = Z(Math.floor(c / nx));
	return Lv.stairs ? Lv.stairs.some((b) => x > b[0] && x < b[2] && z > b[1] && z < b[3]) : false;
}
// the side of the largest square of free floor over each cell (in cells)
function thickness(free, nx, nz) {
	const N = nx * nz, d = new Int32Array(N);
	for (let c = 0; c < N; c++) d[c] = free[c] ? 1e6 : 0;
	const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? 0 : d[i + j * nx]);
	for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = i + j * nx; if (d[c]) d[c] = Math.min(d[c], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1, at(i + 1, j - 1) + 1); }
	for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const c = i + j * nx; if (d[c]) d[c] = Math.min(d[c], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1, at(i - 1, j + 1) + 1); }
	const th = new Int32Array(N);
	for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
		const c = i + j * nx, r = d[c];
		if (!r) continue;
		// (a neighbour's larger square holds this one)
		if (at(i - 1, j) > r || at(i + 1, j) > r || at(i, j - 1) > r || at(i, j + 1) > r) continue;
		const s = 2 * r - 1;
		for (let jj = Math.max(0, j - r + 1); jj <= Math.min(nz - 1, j + r - 1); jj++) for (let ii = Math.max(0, i - r + 1); ii <= Math.min(nx - 1, i + r - 1); ii++) if (th[ii + jj * nx] < s) th[ii + jj * nx] = s;
	}
	return th;
}

// ---------------------------------------------------------------------------------
// the buildings

function regionBoxes(name) {
	const H = JSON.parse(fs.readFileSync(new URL(`../assets/bayarea/real/${name}.json`, import.meta.url)));
	const bin = zlib.gunzipSync(fs.readFileSync(new URL(`../assets/bayarea/real/${name}.bin.gz`, import.meta.url)));
	const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
	const LAT0 = 37.76, LON0 = -122.57, KX = 111320 * Math.cos(LAT0 * Math.PI / 180);
	const OX = H.origin[0] + ((H.geo ? H.geo[1] : -122.78) - LON0) * KX, OZ = H.origin[1], U = H.unit;
	const boxes = [];
	let o = H.sections.boxes[0];
	for (let n = 0; n < H.sections.boxes[1]; n++, o += 18) {
		const kh = dv.getInt16(o + 14, true);
		boxes.push({ x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 1e4, wallH: dv.getInt16(o + 10, true) / 20, roofH: dv.getInt16(o + 12, true) / 20, kind: kh & 255, hip: kh >> 8, door: dv.getInt16(o + 16, true) / 1000 });
	}
	return boxes;
}
function houseGroups(boxes, max) {
	groupBoxes(boxes);
	const seen = new Set(), out = [];
	// spread through the region, not just its first streets
	const step = Math.max(1, Math.floor(boxes.length / (max * 3)));
	for (let i = 0; i < boxes.length && out.length < max; i += step) {
		const b = boxes[i];
		if (!b.grp || b.grp.biz || seen.has(b.grp)) continue;
		seen.add(b.grp);
		if (mainOf(b.grp)) out.push(b.grp);
	}
	return out;
}
function townGroups(seed, max) {
	const it = generateTownSteps({ seed: hashStr('check' + seed), cx: 0, cz: 0, radius: 700, ang: seed * 0.37, heightAt: () => 0, style: seed % 2 ? 'older' : 'suburb', name: 'Check ' + seed, water: null, brief: null });
	let r = it.next();
	while (!r.done) r = it.next();
	return houseGroups(r.value.boxes, max);
}

const tally = () => ({ marks: [], plans: 0, levels: 0, rooms: 0, cross: 0, overlap: 0, stray: 0, sliver: 0, angle: 0, passage: 0, narrow: 0, door: 0, why: [] });
const T = {};
const shown = {};
function run(kind, levels, show) {
	const t = T[kind] || (T[kind] = tally()), o = tally();
	for (const Lv of levels) { checkLevel(Lv, o); o.levels++; o.rooms += Lv.rooms.length; }
	t.plans++;
	for (const k of Object.keys(o)) if (k !== 'why' && k !== 'plans' && k !== 'marks') t[k] += o[k];
	for (const w of o.why) t.why.push(w);
	const bad = o.cross + o.overlap + o.stray + o.sliver + o.angle + o.passage + o.narrow + o.door;
	if (bad && showKind === kind && (!process.env.WHY || o.why.some((w) => w.includes(process.env.WHY))) && (shown[kind] = (shown[kind] || 0) + 1) <= 4) { console.log(`\n[${kind}]`, o.why.join('; '), `cross ${o.cross} overlap ${o.overlap} stray ${o.stray} sliver ${o.sliver}`); show?.(o.marks); }
	if (bad) t.badPlans = (t.badPlans || 0) + 1;
}

// the real houses of each region, then the same with other seeds
const CH = { garage: 'G', entry: 'E', hall: 'H', living: 'L', dining: 'D', kitchen: 'K', family: 'F', powder: 'p', laundry: 'u', master: 'M', bed: 'B', bath: 'b', mbath: 'm', closet: 'c', office: 'O', loft: 'l' };
const drawHouse = (p) => (marks = []) => {
	const S = p.stairs;
	for (const L of [0, 1]) {
		if (L && !p.up) continue;
		for (let z = p.Z[0] + 0.25; z < p.Z[p.nz]; z += 0.5) {
			let row = '';
			for (let x = p.X[0] + 0.25; x < p.X[p.nx]; x += 0.5) {
				const c = p.cellAt(x, z), id = c >= 0 ? p.labels[L][c] : -1;
				let ch = id >= 0 ? CH[p.rooms[id].type] || '?' : ' ';
				if (S && x > S.x0 && x < S.x1 && z > S.zt && z < (L ? S.zw : S.zb)) ch = '=';
				if (marks.some((m) => m[0] === L && Math.abs(m[1] - x) < 0.25 && Math.abs(m[2] - z) < 0.25)) ch = '!';
				row += ch;
			}
			console.log('   ' + row);
		}
		console.log('');
	}
};
for (const reg of ['eastbay', 'sanjose', 'cupertino', 'missionpeak', 'tam', 'sausalito', 'bolinas', 'coast', 'southcoast']) {
	for (const grp of houseGroups(regionBoxes(reg), PER_REGION)) {
		for (let s = 0; s < 3; s++) {
			const p = planHouse(grp, { salt: s * 0x9e37 });
			if (p) run('house', withStairs(fromHouse(p), p), drawHouse(p));
		}
	}
}
for (let s = 1; s <= 4; s++) for (const grp of townGroups(s, PER_REGION)) { const p = planHouse(grp); if (p) run('town house', withStairs(fromHouse(p), p), drawHouse(p)); }
function withStairs(levels, p) {
	const S = p.stairs;
	for (const Lv of levels) Lv.stairs = S ? [[S.x0, S.zt, S.x1, Lv.L ? S.zw ?? S.zb : S.zb]] : [];
	return levels;
}

// the city's buildings over sizes and seeds
const cityStairs = (P) => (levels) => { for (const Lv of levels) Lv.stairs = [...P.flights.filter((f) => f.k === Lv.L).map((f) => [f.x0, Math.min(f.zb, f.zt), f.x1, Math.max(f.zb, f.zt)]), ...P.landings.filter((d) => d.k === Lv.L).map((d) => [d.x0, d.z0, d.x1, d.z1]), ...P.levels[Lv.L].holes]; return levels; };
const drawCity = (P) => (marks = []) => {
	for (const Lv of P.levels) {
		const st = [...P.flights.filter((f) => f.k === Lv.k).map((f) => [f.x0, Math.min(f.zb, f.zt), f.x1, Math.max(f.zb, f.zt)]), ...Lv.holes];
		for (let z = -P.D / 2 + 0.25; z < P.D / 2; z += 0.5) {
			let row = '';
			for (let x = -P.W / 2 + 0.25; x < P.W / 2; x += 0.5) {
				const r = Lv.rooms.map((id) => P.rooms[id]).find((q) => x >= q.x0 && x < q.x1 && z >= q.z0 && z < q.z1);
				let ch = r ? r.type[0] : ' ';
				if (st.some((b) => x > b[0] && x < b[2] && z > b[1] && z < b[3])) ch = '=';
				if (marks.some((m) => m[0] === Lv.k && Math.abs(m[1] - x) < 0.25 && Math.abs(m[2] - z) < 0.25)) ch = '!';
				row += ch;
			}
			console.log('   ' + row);
		}
		console.log('');
	}
};
const cityRun = (kind, P) => { P.style = P.style || 'edwardian'; for (let k = 0; k < P.levels.length; k++) furnish(P, k); run(kind, cityStairs(P)(fromCity(P)), drawCity(P)); };
for (let s = 0; s < SEEDS; s++) {
	const r = rng(1000 + s);
	for (const W of [5.5, 6.5, 7.6, 8.5, 10]) for (const D of [12, 16, 20, 26, 32]) {
		const n = 2 + Math.floor(r() * 3), winCols = [];
		for (let i = 0; i < Math.floor(W / 2.54); i++) winCols.push((i + 0.5) * 2.54 - W / 2);
		const base = { W, D, levels: n, reach: 3, doorX: r() < 0.5 ? W / 2 - 1.1 : -W / 2 + 1.1, winCols, winRows: [], bay: null, rnd: rng(s * 97 + W * 13 + D), style: 'edwardian' };
		cityRun('row', planRow({ ...base, use: 'row', garage: r() < 0.5 }));
		const side = r() < 0.5 ? 1 : -1;
		cityRun('shop', planRow({ ...base, use: 'shop', stairSide: side, doorX: -side * Math.min(1.2, W * 0.12), shopType: 'cafe', rnd: rng(s * 31 + W + D) }));
	}
	for (const W of [14, 18, 24, 30]) for (const D of [16, 22, 30, 40]) cityRun('apt', planApt({ W, D, levels: 3 + (s % 4), doorX: 0, winCols: null, winRows: [], party: s % 2 === 0, rnd: rng(s * 7 + W * D), style: 'modern' }));
	for (const use of ['school', 'warehouse', 'store', 'office', 'shed', 'garage2']) for (const [W, D] of [[12, 10], [24, 20], [30, 36], [40, 30]]) cityRun('hall', planHall({ use, W, D, h: 4 + (s % 3), doorX: 0, rnd: rng(s * 13 + W), style: 'modern' }));
	if (planSummit) cityRun('summit', planSummit({ rnd: rng(s + 5), roofY: 6.9 + (s % 4) * 0.4 }));
}

console.log('\nkind          plans  failing  rooms  cross  overlap  stray  sliver  angle  passage<1.1  room<2.2  door');
let all = null;
for (const [k, t] of Object.entries(T)) {
	console.log(k.padEnd(13), String(t.plans).padStart(6), String(t.badPlans || 0).padStart(8), String(t.rooms).padStart(6), String(t.cross).padStart(6), String(t.overlap).padStart(8), String(t.stray).padStart(6), String(t.sliver).padStart(7), String(t.angle).padStart(6), String(t.passage).padStart(12), String(t.narrow).padStart(9), String(t.door).padStart(5));
	if (!all) all = tally();
	for (const q of Object.keys(all)) if (q !== 'why') all[q] += t[q] || 0;
	all.badPlans = (all.badPlans || 0) + (t.badPlans || 0);
}
const kinds = {};
for (const t of Object.values(T)) for (const w of t.why) { const k = w.replace(/ [\d.]+m2$/, ''); kinds[k] = (kinds[k] || 0) + 1; }
console.log('\nmost common:', Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ' ' + v).join(', '));
