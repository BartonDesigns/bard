// A damaged wall drawn as what it is: every layer of its assembly with the holes cut through
// it. The faces either side keep the builder's own materials and colours (the room's paint or
// paper, the stucco or siding outside) with ragged holes in them, the edge of each hole cut
// through the layer's thickness (white gypsum, plaster, grey stucco base coats under the
// finish, OSB, brick, concrete), and inside: the studs (split and splintered where they broke),
// the batts bulging out of the hole in their kraft facing, the brown back of the far board, the
// stucco's wire lath across its hole, the old plaster's wooden lath strips, a cable or a pipe,
// bricks knocked out along their mortar lines with the loose ones round them, the bars in
// concrete showing where it spalled.
//
// Holes are traced with marching squares over the wall's damage cells (cells.js), each layer
// with its own field (its damage, a little noise of its own and some shared, so a hole through
// several layers steps and narrows like a real one), the solid parts merged into long quads
// away from any damage. Built on demand when a wall changes, merged into a few meshes per
// wall (the builder's materials, one atlas material for every section, one for the wire).
//
// How fine it is drawn (the opts of build, one of DETAIL): the trace's grid against the cells
// (fine: 2 is twice as fine), how often a bulging batt is split for its lumps (batt), and
// whether the small bits are drawn (bits: the paper's torn flaps, a broken stud's splinters,
// the old plaster's wooden lath strips). index.js picks the level by the quality tier and
// steps down a level when a wall would run past its vertex cap.

import * as THREE from 'three';
import { TILE, TILE_M, BRICK_TILE } from './textures.js';
import { MAT } from './assembly.js';
import { slotOf } from '../../bay/housekit.js';

const ISO = 1;
// the levels of detail, best first (index.js wallQuality picks one, and steps down when over a cap)
export const DETAIL = [{ fine: 2, batt: 2, bits: true }, { fine: 1, batt: 1, bits: true }, { fine: 1, batt: 0, bits: false }];
const lin3 = (r, g, b) => { const c = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };
const TINT = {
	white: lin3(0.95, 0.95, 0.94), gypsum: lin3(0.96, 0.95, 0.92), back: lin3(0.9, 0.88, 0.84), wood: lin3(1, 0.97, 0.92), end: lin3(1, 0.96, 0.9),
	pink: lin3(1, 0.62, 0.66), yellow: lin3(1, 0.86, 0.48), wool: lin3(0.62, 0.6, 0.5), kraft: lin3(0.95, 0.9, 0.85), tar: lin3(0.9, 0.9, 0.9),
	stucco: lin3(0.95, 0.94, 0.92), brick: lin3(1, 1, 1), brickIn: lin3(0.9, 0.86, 0.84), concrete: lin3(0.95, 0.95, 0.94), plaster: lin3(0.98, 0.97, 0.95),
	rust: lin3(1, 1, 1), wrap: lin3(0.92, 0.94, 0.97), steel: lin3(0.66, 0.68, 0.7), copper: lin3(0.85, 0.5, 0.3), cable: lin3(0.95, 0.8, 0.2), cable2: lin3(0.93, 0.93, 0.9), block: lin3(0.72, 0.71, 0.68), loose: lin3(0.8, 0.78, 0.76),
};
// what each material's cut edge, and its back seen inside the wall, is drawn with
const SECTION = {
	drywall: [TILE.gypsum, 'gypsum'], plaster: [TILE.plaster, 'plaster'], render: [TILE.stucco, 'stucco'], paper: [TILE.tar, 'tar'],
	osb: [TILE.osb, 'wood'], plywood: [TILE.ply, 'wood'], boards: [TILE.ply, 'wood'], siding: [TILE.ply, 'wood'],
	stucco: [TILE.stucco, 'stucco'], gap: [TILE.back, 'back'], brick: [TILE.brickIn, 'brickIn'], block: [TILE.concrete, 'block'], concrete: [TILE.concrete, 'concrete'],
};
const BACK = { drywall: [TILE.back, 'back'], plaster: [TILE.plaster, 'plaster'], osb: [TILE.osb, 'wood'], plywood: [TILE.ply, 'wood'], boards: [TILE.ply, 'wood'], siding: [TILE.ply, 'wood'], paper: [TILE.tar, 'tar'], stucco: [TILE.stucco, 'stucco'] };
// the face coat that spalls off round a hole, and how deep
const SPALL = { stucco: 0.006, render: 0.005, concrete: 0.03, plaster: 0.004, drywall: 0.0035 };

const hash3 = (a, b, c) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- the buffers ----------
class Acc {
	constructor() { this.b = new Map(); }
	buf(k) { let b = this.b.get(k); if (!b) this.b.set(k, b = { p: [], n: [], u: [], c: [], t: [], vo: 0 }); return b; }
}

export function createWallMesher({ atlas, lath }) {
	const secMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: atlas, roughness: 0.92, metalness: 0 });
	secMat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aTile;\nvarying vec2 vTile;').replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvTile = aTile;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vTile;').replace('#include <map_fragment>', '#ifdef USE_MAP\n\tvec4 sampledDiffuseColor = texture2D( map, vTile + fract( vMapUv ) * 0.2344 + 0.0078 );\n\tdiffuseColor *= sampledDiffuseColor;\n#endif');
	};
	secMat.customProgramCacheKey = () => 'wall-section';
	const lathMat = new THREE.MeshStandardMaterial({ map: lath, alphaTest: 0.45, side: THREE.DoubleSide, color: 0x8d9093, roughness: 0.5, metalness: 0.55 });

	// build one wall: W (the record walls.js keeps), M (the builder's materials). Returns the meshes
	function build(W, M, { fine: FINE = 2, batt: BATT = 2, bits: BITS = true } = {}) {
		const faces = new Acc(), sec = new Acc().buf('sec'), lat = new Acc().buf('lath');
		const X = W.axis === 'x';
		// (wall-local u along, y up, a across, to the building's frame)
		const P3 = (u, y, a) => (X ? [u, y, a] : [a, y, u]);
		const N3 = (nu, ny, na) => (X ? [nu, ny, na] : [na, ny, nu]);
		function tri(B, A, Bp, C, N, col, ua, ub, uc, tile = -1) {
			const pa = P3(A[0], A[1], A[2]);
			let pb = P3(Bp[0], Bp[1], Bp[2]), pc = P3(C[0], C[1], C[2]);
			const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
			const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
			let n;
			if (N) {
				n = N3(N[0], N[1], N[2]);
				// (wound to face along its normal)
				if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0) { const t = pb; pb = pc; pc = t; const tu = ub; ub = uc; uc = tu; }
			} else { const l = Math.hypot(cr[0], cr[1], cr[2]) || 1; n = [cr[0] / l, cr[1] / l, cr[2] / l]; }
			B.p.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pc[0], pc[1], pc[2]);
			B.u.push(ua[0], ua[1] + B.vo, ub[0], ub[1] + B.vo, uc[0], uc[1] + B.vo);
			for (let i = 0; i < 3; i++) { B.n.push(n[0], n[1], n[2]); B.c.push(col[0], col[1], col[2]); if (tile >= 0) B.t.push((tile % 4) * 0.25, 0.75 - Math.floor(tile / 4) * 0.25); }
		}
		const quad = (B, a, b, c, d, N, col, uv, tile = -1) => { tri(B, a, b, c, N, col, uv[0], uv[1], uv[2], tile); tri(B, a, c, d, N, col, uv[0], uv[2], uv[3], tile); };
		// a face buffer for one of the builder's keys (its patterned slot lifted as the builder does)
		const faceBuf = (key) => { const sl = slotOf(key); const B = faces.buf(sl ? sl[0] : key); B.vo = sl ? sl[1] : 0; return B; };
		// a section quad in metres for its tile
		const sq = (tile, tint, a, b, c, d, N, su, sv) => { const m = TILE_M[tile]; quad(sec, a, b, c, d, N, TINT[tint] || tint, [[su[0] / m, sv[0] / m], [su[1] / m, sv[1] / m], [su[2] / m, sv[2] / m], [su[3] / m, sv[3] / m]], tile); };
		const box = (tile, tint, u0, u1, y0, y1, a0, a1, skip = 0) => {
			// skip: bit 1 the -u side, 2 +u, 4 bottom, 8 top, 16 -a, 32 +a
			if (!(skip & 16)) sq(tile, tint, [u0, y0, a0], [u1, y0, a0], [u1, y1, a0], [u0, y1, a0], [0, 0, -1], [u0, u1, u1, u0], [y0, y0, y1, y1]);
			if (!(skip & 32)) sq(tile, tint, [u0, y0, a1], [u1, y0, a1], [u1, y1, a1], [u0, y1, a1], [0, 0, 1], [u0, u1, u1, u0], [y0, y0, y1, y1]);
			if (!(skip & 1)) sq(tile, tint, [u0, y0, a0], [u0, y0, a1], [u0, y1, a1], [u0, y1, a0], [-1, 0, 0], [a0, a1, a1, a0], [y0, y0, y1, y1]);
			if (!(skip & 2)) sq(tile, tint, [u1, y0, a0], [u1, y0, a1], [u1, y1, a1], [u1, y1, a0], [1, 0, 0], [a0, a1, a1, a0], [y0, y0, y1, y1]);
			if (!(skip & 4)) sq(tile, tint, [u0, y0, a0], [u1, y0, a0], [u1, y0, a1], [u0, y0, a1], [0, -1, 0], [u0, u1, u1, u0], [a0, a0, a1, a1]);
			if (!(skip & 8)) sq(tile, tint, [u0, y1, a0], [u1, y1, a0], [u1, y1, a1], [u0, y1, a1], [0, 1, 0], [u0, u1, u1, u0], [a0, a0, a1, a1]);
		};
		const amin = Math.min(W.a0, W.a1), amax = Math.max(W.a0, W.a1);
		for (let pi = 0; pi < W.pieces.length; pi++) piece(W.pieces[pi], W.cells?.[pi] || null, pi);
		const out = [];
		for (const [k, b] of faces.b) {
			if (!b.p.length || !M[k]) continue;
			out.push(meshOf(b, M[k], k, false));
		}
		if (sec.p.length) out.push(meshOf(sec, secMat, 'wall-section', true));
		if (lat.p.length) out.push(meshOf(lat, lathMat, 'wall-lath', false));
		return out;

		// ---------- one piece ----------
		function piece(pc, P, pi) {
			const plainFace = (side) => {
				const a = side ? amax : amin, key = pc.keys[side], col = pc.cols[side];
				if (!key) return;
				const B = faceBuf(key);
				quad(B, [pc.u0, pc.y0, a], [pc.u1, pc.y0, a], [pc.u1, pc.y1, a], [pc.u0, pc.y1, a], [0, 0, side ? 1 : -1], col, [[pc.u0, pc.y0], [pc.u1, pc.y0], [pc.u1, pc.y1], [pc.u0, pc.y1]]);
			};
			caps(pc);
			if (!P || !P.any) {
				plainFace(0); plainFace(1);
				trims(pc, null, null);
				return;
			}
			// (traced on a grid twice as fine as the damage cells, so a small hole is ragged, not a
			// diamond; on the cells' own grid at the lower levels)
			const L = W.stack.layers, nu = P.nu * FINE, nv = P.nv * FINE, NU = nu + 2, NV = nv + 2, fcu = P.csu / FINE, fcv = P.csv / FINE;
			const su = new Float32Array(NU), sv = new Float32Array(NV);
			su[0] = P.u0; su[NU - 1] = P.u1; sv[0] = P.y0; sv[NV - 1] = P.y1;
			for (let i = 1; i <= nu; i++) su[i] = P.u0 + (i - 0.5) * fcu;
			for (let k = 1; k <= nv; k++) sv[k] = P.y0 + (k - 0.5) * fcv;
			// a fine sample's value: its own cell's, leaned toward its neighbours'
			const fine = (val, i, k) => {
				const ci = Math.floor((i - 1) / FINE), ck = Math.floor((k - 1) / FINE), own = val(ci, ck);
				const fu = (su[i] - P.u0) / P.csu - 0.5, fv = (sv[k] - P.y0) / P.csv - 0.5;
				const i0 = Math.max(0, Math.min(P.nu - 1, Math.floor(fu))), k0 = Math.max(0, Math.min(P.nv - 1, Math.floor(fv))), i1 = Math.min(P.nu - 1, i0 + 1), k1 = Math.min(P.nv - 1, k0 + 1);
				const tu = Math.max(0, Math.min(1, fu - i0)), tv = Math.max(0, Math.min(1, fv - k0));
				const bl = (val(i0, k0) * (1 - tu) + val(i1, k0) * tu) * (1 - tv) + (val(i0, k1) * (1 - tu) + val(i1, k1) * tu) * tv;
				return own * 0.45 + bl * 0.55;
			};
			const seed = W.seed + pi * 131;
			// the layers by where they lie across the wall, low a first
			const seq = [...L].sort((p, q) => p.lo - q.lo);
			const vis = (r) => (r < 1 ? r * 0.7 : 1.3 + Math.min(r - 1, 2) * 0.5);
			const common = new Float32Array(NU * NV);
			for (let k = 0; k < NV; k++) for (let i = 0; i < NU; i++) common[i + k * NU] = hash3(i, k, seed) - 0.5;
			// each layer's field (a cavity's is its fill's, stud columns left whole)
			const F = L.map((l, j) => {
				const G = new Float32Array(NU * NV), D = P.dmg[j];
				const val = (ci, ck) => {
					let r = D[ci + ck * P.nu];
					// (a batt is torn out only well after the board in front of it gave way)
					if (l.m === 'cavity') { if (P.stud[ci] || P.plate(ck)) r = 0; else if (l.fill === 'air') r = 9; else r *= 0.4; }
					else if (l.m === 'gap') r = 9;
					// (paper tears, but less than what it lies on)
					else if (l.m === 'paper' && !l.paint) r *= 0.35;
					return vis(r);
				};
				for (let k = 1; k <= nv; k++) for (let i = 1; i <= nu; i++) G[i + k * NU] = fine(val, i, k) + common[i + k * NU] * 0.3 + (hash3(i, k, seed + j * 17) - 0.5) * 0.22;
				return G;
			});
			const AUX = L.map((l, j) => {
				if (!P.aux[j]) return null;
				const G = new Float32Array(NU * NV), D = P.aux[j];
				const val = (ci, ck) => vis(D[ci + ck * P.nu]);
				for (let k = 1; k <= nv; k++) for (let i = 1; i <= nu; i++) G[i + k * NU] = fine(val, i, k) + (hash3(i, k, seed + 91 + j) - 0.5) * 0.2;
				return G;
			});
			const at = (G, i, k) => G[i + k * NU];
			const sqMax = (G, i, k) => Math.max(G[i + k * NU], G[i + 1 + k * NU], G[i + 1 + (k + 1) * NU], G[i + (k + 1) * NU]);
			// (the squares near any damage: drawn in detail; the rest merged)
			const near = new Uint8Array((nu + 1) * (nv + 1));
			for (let k = 0; k <= nv; k++) for (let i = 0; i <= nu; i++) {
				let m = 0;
				for (let j = 0; j < L.length; j++) { if (L[j].m === 'gap' || (L[j].m === 'cavity' && L[j].fill === 'air')) continue; m = Math.max(m, sqMax(F[j], i, k)); }
				if (m > 0.55) for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) { const ii = i + di, kk = k + dk; if (ii >= 0 && kk >= 0 && ii <= nu && kk <= nv) near[ii + kk * (nu + 1)] = 1; }
			}
			const nearSq = (i, k) => near[i + k * (nu + 1)] === 1;
			// a hole's edge for a layer: any square of it that is near
			const holeNear = (G) => (i, k) => nearSq(i, k) && sqMax(G, i, k) >= 0.75;
			// the spalled face coat: the hole wider at the face
			const spallOf = (G, paper = false) => {
				const S = new Float32Array(NU * NV);
				for (let k = 1; k < NV - 1; k++) for (let i = 1; i < NU - 1; i++) {
					const nz = hash3(i, k, seed + 777) - 0.5;
					// (board: the paper torn back a little way round the hole, the white gypsum showing)
					if (paper) { S[i + k * NU] = G[i + k * NU] > 0.3 ? G[i + k * NU] + 0.2 + nz * 0.2 : G[i + k * NU]; continue; }
					let m = 0;
					for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) m = Math.max(m, G[i + di + (k + dk) * NU] * (di && dk ? 0.62 : 0.78));
					S[i + k * NU] = Math.max(G[i + k * NU], m + nz * 0.3);
				}
				return S;
			};
			// marching squares over field G in the squares want() picks: solid polygons to onPoly,
			// cut segments (with the normal into the hole) to onSeg; whole squares merged by row
			function march(G, want, onPoly, onSeg, onRun) {
				const pts = [], tr = [];
				for (let k = 0; k <= nv; k++) {
					let run0 = -1;
					for (let i = 0; i <= nu + 1; i++) {
						const ok = i <= nu && want(i, k);
						const whole = ok && onRun && sqMax(G, i, k) < ISO;
						if (whole) { if (run0 < 0) run0 = i; continue; }
						if (run0 >= 0) { onRun(su[run0], su[i], sv[k], sv[k + 1]); run0 = -1; }
						if (!ok || (onRun && whole)) continue;
						const c = [[i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1]];
						const v = c.map(([a, b]) => G[a + b * NU]);
						if (v.every((x) => x >= ISO)) continue;
						pts.length = 0; tr.length = 0;
						for (let e = 0; e < 4; e++) {
							const A = c[e], Bc = c[(e + 1) % 4], va = v[e], vb = v[(e + 1) % 4];
							const pa = [su[A[0]], sv[A[1]]];
							if (va < ISO) pts.push(pa);
							if ((va < ISO) !== (vb < ISO)) {
								const t = Math.min(0.97, Math.max(0.03, (ISO - va) / (vb - va))), pb = [su[Bc[0]], sv[Bc[1]]];
								const p = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
								pts.push(p); tr.push([p, va < ISO ? 1 : 0]);
							}
						}
						if (pts.length >= 3 && onPoly) onPoly(pts);
						if (onSeg && tr.length >= 2) {
							let s = tr.findIndex((q) => q[1] === 1);
							for (let q = 0; q < tr.length; q += 2) {
								const ex = tr[(s + q) % tr.length][0], en = tr[(s + q + 1) % tr.length][0];
								const dx = en[0] - ex[0], dy = en[1] - ex[1], l = Math.hypot(dx, dy);
								if (l > 1e-5) onSeg(ex, en, [dy / l, -dx / l]);
							}
						}
					}
				}
			}
			const fan = (pts, a, N, emit) => { for (let q = 1; q + 1 < pts.length; q++) emit([pts[0][0], pts[0][1], a], [pts[q][0], pts[q][1], a], [pts[q + 1][0], pts[q + 1][1], a], N); };
			// a layer's face at plane a, facing s (-1 low a, +1 high a); with the builder's key or a section tile
			function face(G, a, s, want, key, col, tile, tint, uvm = 0) {
				const N = [0, 0, s];
				if (key) {
					const B = faceBuf(key);
					march(G, want, (pts) => fan(pts, a, N, (p, q, r) => tri(B, p, q, r, N, col, [p[0], p[1]], [q[0], q[1]], [r[0], r[1]])),
						null, (u0, u1, y0, y1) => quad(B, [u0, y0, a], [u1, y0, a], [u1, y1, a], [u0, y1, a], N, col, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]));
					return;
				}
				const m = uvm || TILE_M[tile], mv = uvm ? (tile === TILE.brick ? BRICK_TILE[1] : uvm) : m, ou = tile === TILE.brick ? -W.s : 0;
				march(G, want, (pts) => fan(pts, a, N, (p, q, r) => tri(sec, p, q, r, N, TINT[tint] || tint, [(p[0] + ou) / m, p[1] / mv], [(q[0] + ou) / m, q[1] / mv], [(r[0] + ou) / m, r[1] / mv], tile)), null,
					(u0, u1, y0, y1) => quad(sec, [u0, y0, a], [u1, y0, a], [u1, y1, a], [u0, y1, a], N, TINT[tint] || tint, [[(u0 + ou) / m, y0 / mv], [(u1 + ou) / m, y0 / mv], [(u1 + ou) / m, y1 / mv], [(u0 + ou) / m, y1 / mv]], tile));
			}
			// the cut edges of a layer's holes from a = lo to hi
			function cuts(G, lo, hi, tile, tint, want, flaps = null) {
				let run = 0;
				march(G, want, null, (p, q, n) => {
					const N = [n[0], n[1], 0], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
					sq(tile, tint, [p[0], p[1], lo], [q[0], q[1], lo], [q[0], q[1], hi], [p[0], p[1], hi], N, [run, run + d, run + d, run], [lo, lo, hi, hi]);
					run += d;
					if (flaps) flaps(p, q, n);
				}, null);
			}
			const studSq = (i) => { const u0s = su[i], u1s = su[i + 1]; for (const s0 of pc.studs) if (s0 + 0.02 > u0s && s0 - 0.02 < u1s) return true; return false; };
			// ---- the layers, low a to high
			const first = seq[0], last = seq[seq.length - 1];
			const allSq = () => true;
			for (let s = 0; s < seq.length; s++) {
				const l = seq[s], j = l.i, G = F[j];
				if (l.m === 'cavity') { cavity(l, j, s); continue; }
				if (l.m === 'gap') continue;
				if (l.m === 'brick' || l.m === 'block') { masonry(l, j, s); continue; }
				const wrap = l.m === 'paper' && (W.asm === 'stuccoNew' || W.asm === 'sidingNew' || W.asm === 'veneer' || W.asm === 'timberJp');
				const sec0 = wrap ? [TILE.flat, 'wrap'] : SECTION[l.m] || [TILE.gypsum, 'gypsum'], back = wrap ? sec0 : BACK[l.m] || sec0;
				const spall = SPALL[l.m] || 0;
				let cutLo = l.lo, cutHi = l.hi, flapped = false;
				const flap = BITS && l.m === 'drywall' && (l === first || l === last) ? (p, q, n) => paperFlap(p, q, n, l, l === first ? l.lo : l.hi, l === first ? 1 : -1, pc.cols[l === first ? 0 : 1]) : null;
				for (const side of [0, 1]) {
					const outer = side ? l === last : l === first, a = side ? l.hi : l.lo, sgn = side ? 1 : -1;
					if (outer) {
						const key = pc.keys[side], col = pc.cols[side];
						if (spall && l.t > spall * 1.5) {
							const S = spallOf(G, l.m === 'drywall');
							if (key) face(S, a, sgn, allSq, key, col); else face(S, a, sgn, allSq, null, null, sec0[0], sec0[1]);
							const ar = a - sgn * spall;
							face(G, ar, sgn, holeNear(S), null, null, sec0[0], sec0[1]);
							cuts(S, Math.min(a, ar), Math.max(a, ar), sec0[0], l.m === 'stucco' || l.m === 'render' ? col || sec0[1] : sec0[1], holeNear(S), flap);
							if (flap) flapped = true;
							if (side) cutHi = ar; else cutLo = ar;
						} else if (key) face(G, a, sgn, allSq, key, col);
						else face(G, a, sgn, allSq, null, null, sec0[0], sec0[1]);
					} else {
						// (inside the wall: seen only through a hole in the layer beyond)
						const nb = seq[s + (side ? 1 : -1)];
						if (!nb) continue;
						const NG = nb.m === 'cavity' || nb.m === 'gap' ? null : F[nb.i];
						const want = NG ? holeNear(NG) : nearSq;
						face(G, a, sgn, want, null, null, back[0], back[1]);
					}
				}
				// the cut edge (white gypsum, grey plaster or stucco, wood, black paper)
				cuts(G, cutLo, cutHi, sec0[0], sec0[1], holeNear(G), flapped ? null : flap);
				// the stucco's wire across its hole; the old plaster's wooden strips behind it
				if (l.lath === 'wire' && AUX[j]) wire(l, j, G);
				if (l.lath === 'lath' && AUX[j] && BITS) strips(l, j, G, s);
				if (l.rebar && AUX[j]) bars(l, j, G);
			}
			trims(pc, (u) => bil(F[first.i], u, P.y0 + 0.04), (u) => bil(F[last.i], u, P.y0 + 0.04));
			wiring(pc, P);

			// a torn flap of the board's paper at a hole's edge, bent into the hole
			function paperFlap(p, q, n, l, a, inward, col) {
				const h = hash3(Math.round(p[0] * 997), Math.round(p[1] * 991), seed + 5);
				if (h > 0.42) return;
				const m = [(p[0] + q[0]) / 2 + n[0] * (0.012 + h * 0.05), (p[1] + q[1]) / 2 + n[1] * (0.012 + h * 0.05), a + inward * (0.004 + h * 0.03)];
				const A = [p[0], p[1], a], Bq = [q[0], q[1], a];
				// (its painted face toward the room, its brown back into the wall)
				tri(sec, A, Bq, m, [n[0] * 0.3, n[1] * 0.3, -inward], col || TINT.white, [0, 0], [0.5, 0], [0.25, 0.5], TILE.flat);
				tri(sec, A, Bq, m, [-n[0] * 0.3, -n[1] * 0.3, inward], TINT.back, [0, 0], [0.5, 0], [0.25, 0.5], TILE.back);
			}
			// ---- the cavity: studs, plates, the batts, the far board's back
			function cavity(l, j, s) {
				const prev = seq[s - 1], next = seq[s + 1];
				const FA = prev ? F[prev.i] : null, FB = next ? F[next.i] : null;
				const lo = l.lo, hi = l.hi;
				// where either side is open
				const openA = (i, k) => FA && sqMax(FA, i, k) >= 0.75, openB = (i, k) => FB && sqMax(FB, i, k) >= 0.75;
				// the batts, bulging out of the hole on each side that is open
				if (l.fill !== 'air') {
					const tint = l.fill === 'rockwool' ? TINT.wool : W.asm === 'sidingTract' ? TINT.yellow : TINT.pink;
					for (const [FS, side] of [[FA, 0], [FB, 1]]) {
						if (!FS) continue;
						const want = (i, k) => nearSq(i, k) && sqMax(FS, i, k) >= 0.6 && !studSq(i);
						const base = side ? hi : lo, out = side ? 1 : -1;
						// (out through a hole in the board in front of it; behind sheathing or paper it stays put)
						const nbM = (side ? next : prev)?.m, soft = nbM === 'drywall' || nbM === 'plaster';
						const reach = soft ? 0.026 : 0.002;
						const lump = (u, y) => (hash3(Math.round(u * 70), Math.round(y * 70), seed + 3) - 0.5) * 0.7 + (hash3(Math.round(u * 23), Math.round(y * 23), seed + 9) - 0.5);
						const bulge = (u, y) => {
							const f = bil(FS, u, y), g = Math.max(0, Math.min(1, (f - 1.05) / 1.1));
							return base - out * 0.004 + out * (g * g * (3 - 2 * g) * reach + lump(u, y) * (0.004 + g * 0.01) * (soft ? 1 : 0.2));
						};
						march(F[j], want, (pts) => {
							const fx = pts.reduce((m2, p) => Math.max(m2, bil(FS, p[0], p[1])), 0);
							const tile = l.facing === 'kraft' && side === 0 && fx < 1.15 ? TILE.kraft : TILE.fibre, tn = tile === TILE.kraft ? TINT.kraft : tint, m = TILE_M[tile];
							// (each triangle split in four, twice: the batt's lumps)
							const emit = (A, Bq, C, d) => {
								if (d > 0) {
									const ab = [(A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2], bc = [(Bq[0] + C[0]) / 2, (Bq[1] + C[1]) / 2], ca = [(C[0] + A[0]) / 2, (C[1] + A[1]) / 2];
									emit(A, ab, ca, d - 1); emit(ab, Bq, bc, d - 1); emit(ca, bc, C, d - 1); emit(ab, bc, ca, d - 1);
									return;
								}
								const a3 = [A[0], A[1], bulge(A[0], A[1])], b3 = [Bq[0], Bq[1], bulge(Bq[0], Bq[1])], c3 = [C[0], C[1], bulge(C[0], C[1])];
								triOut(a3, b3, c3, out, tn, [A[0] / m, A[1] / m], [Bq[0] / m, Bq[1] / m], [C[0] / m, C[1] / m], tile);
							};
							for (let q = 1; q + 1 < pts.length; q++) emit(pts[0], pts[q], pts[q + 1], fx > 0.9 ? BATT : 0);
						}, (p, q, n) => {
							// (torn: the batt's own edge into the bay)
							const a0 = bulge(p[0], p[1]), a1 = bulge(q[0], q[1]);
							sq(TILE.fibre, tint, [p[0], p[1], a0], [q[0], q[1], a1], [q[0], q[1], (lo + hi) / 2], [p[0], p[1], (lo + hi) / 2], [n[0], n[1], 0], [0, 0.1, 0.1, 0], [0, 0, 0.05, 0.05]);
						}, null);
					}
				}
				// studs and plates where anything near is open
				const span = Math.max(P.csu, 0.12);
				const D = P.dmg[j], steel = l.stud === 'steel', sw = MAT[l.stud].w;
				let uMin = Infinity, uMax = -Infinity, yMin = Infinity, yMax = -Infinity;
				for (let k = 0; k <= nv; k++) for (let i = 0; i <= nu; i++) if (nearSq(i, k) && (openA(i, k) || openB(i, k))) { uMin = Math.min(uMin, su[i]); uMax = Math.max(uMax, su[i + 1]); yMin = Math.min(yMin, sv[k]); yMax = Math.max(yMax, sv[k + 1]); }
				if (uMin === Infinity) return;
				for (const s0 of pc.studs) {
					if (s0 < uMin - span * 2 || s0 > uMax + span * 2) continue;
					const i = Math.min(P.nu - 1, Math.max(0, Math.floor((s0 - P.u0) / P.csu))), nu = P.nu, nv = P.nv;
					// unbroken runs up the stud
					let k0 = 0;
					for (let k = 0; k <= nv; k++) {
						const gone = k < nv && D[i + k * nu] >= 1;
						if (k < nv && !gone) continue;
						const ya = k0 === 0 ? P.y0 : P.y0 + k0 * P.csv, yb = k === nv ? P.y1 : P.y0 + k * P.csv;
						if (yb - ya > 0.02) {
							if (steel) {
								box(TILE.flat, 'steel', s0 - sw / 2, s0 + sw / 2, ya, yb, lo + 0.001, lo + 0.002);
								box(TILE.flat, 'steel', s0 - sw / 2, s0 + sw / 2, ya, yb, hi - 0.002, hi - 0.001);
								box(TILE.flat, 'steel', s0 - sw / 2, s0 - sw / 2 + 0.001, ya, yb, lo + 0.002, hi - 0.002);
							} else {
								box(TILE.wood, 'wood', s0 - sw / 2, s0 + sw / 2, ya, yb, lo + 0.001, hi - 0.001, (k0 === 0 ? 4 : 0) | (k === nv ? 8 : 0));
								if (k0 > 0 && BITS) splinters(s0, ya, sw, lo, hi, -1);
								if (k < nv && BITS) splinters(s0, yb, sw, lo, hi, 1);
							}
							// (a cracked stud shows its split)
							let worst = 0;
							for (let kk = k0; kk < k; kk++) worst = Math.max(worst, D[i + kk * nu]);
							if (!steel && worst > 0.45) {
								const kk = [...Array(k - k0).keys()].map((q) => q + k0).reduce((b, q) => (D[i + q * nu] > D[i + b * nu] ? q : b), k0), yc = P.y0 + (kk + 0.5) * P.csv;
								for (const a of [lo + 0.0005, hi - 0.0005]) sq(TILE.end, 'end', [s0 - 0.004, yc - 0.18 * worst, a], [s0 + 0.004, yc - 0.18 * worst, a], [s0 + 0.004, yc + 0.18 * worst, a], [s0 - 0.004, yc + 0.18 * worst, a], [0, 0, a < (lo + hi) / 2 ? -1 : 1], [0, 0.01, 0.01, 0], [0, 0, 0.3, 0.3]);
							}
						}
						k0 = k + 1;
					}
				}
				// the plates at the foot and the head, where the hole comes near them
				const uL = Math.max(P.u0, uMin - 0.3), uR = Math.min(P.u1, uMax + 0.3);
				if (!steel && yMin < P.y0 + 0.4) box(TILE.wood, 'wood', uL, uR, P.y0, P.y0 + 0.038, lo + 0.001, hi - 0.001, 3);
				if (!steel && yMax > P.y1 - 0.4 && pc.top) box(TILE.wood, 'wood', uL, uR, P.y1 - 0.076, P.y1, lo + 0.001, hi - 0.001, 3);
			}
			function bil(G, u, y) {
				let i = 0, k = 0;
				while (i < NU - 2 && su[i + 1] < u) i++;
				while (k < NV - 2 && sv[k + 1] < y) k++;
				const tu = Math.min(1, Math.max(0, (u - su[i]) / (su[i + 1] - su[i] || 1))), tv = Math.min(1, Math.max(0, (y - sv[k]) / (sv[k + 1] - sv[k] || 1)));
				const a = at(G, i, k) * (1 - tu) + at(G, i + 1, k) * tu, b = at(G, i, k + 1) * (1 - tu) + at(G, i + 1, k + 1) * tu;
				return a * (1 - tv) + b * tv;
			}
			function triOut(A, Bq, C, out, tint, ua, ub, uc, tile) {
				// (facing out of the wall on its side, whatever the winding)
				const e1 = [Bq[0] - A[0], Bq[1] - A[1], Bq[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
				const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n) || 1;
				const N = n[2] * out < 0 ? [-n[0] / l, -n[1] / l, -n[2] / l] : [n[0] / l, n[1] / l, n[2] / l];
				tri(sec, A, Bq, C, N, tint, ua, ub, uc, tile);
			}
			// the torn ends of a broken stud: slivers standing out of the break
			function splinters(s0, y, w, lo, hi, dir) {
				for (let q = 0; q < 5; q++) {
					const h = (z) => hash3(Math.round(s0 * 300) + q * 7 + z, Math.round(y * 300), seed + 41);
					const u0 = s0 - w / 2 + h(1) * w * 0.7, u1 = u0 + w * (0.15 + h(2) * 0.3), a0 = lo + h(3) * (hi - lo) * 0.7, a1 = a0 + (hi - lo) * (0.12 + h(4) * 0.3);
					const tip = [u0 + (u1 - u0) * h(5) + (h(6) - 0.5) * 0.02, y + dir * (0.025 + h(7) * 0.08), (a0 + a1) / 2 + (h(8) - 0.5) * 0.02];
					const b0 = [u0, y, a0], b1 = [u1, y, a0], b2 = [u1, y, a1], b3 = [u0, y, a1];
					for (const [p, q2] of [[b0, b1], [b1, b2], [b2, b3], [b3, b0]]) tri(sec, p, q2, tip, null, TINT.end, [0, 0], [0.4, 0], [0.2, 1], q % 2 ? TILE.end : TILE.wood);
				}
				// the end grain across the break
				sq(TILE.end, 'end', [s0 - w / 2, y, lo], [s0 + w / 2, y, lo], [s0 + w / 2, y, hi], [s0 - w / 2, y, hi], [0, dir, 0], [0, w, w, 0], [0, 0, hi - lo, hi - lo]);
			}
			// ---- the stucco's wire lath: across the hole in the stucco, torn where it was hit hardest
			function wire(l, j, G) {
				const A = AUX[j], a = (l.lo + l.hi) / 2, side = l === last ? 1 : -1;
				const want = (i, k) => nearSq(i, k) && sqMax(G, i, k) >= 0.85;
				march(A, want, (pts) => {
					for (let q = 1; q + 1 < pts.length; q++) {
						const P0 = pts[0], P1 = pts[q], P2 = pts[q + 1];
						const bend = (p) => a + side * Math.max(0, bil(G, p[0], p[1]) - 1) * 0.012;
						tri(lat, [P0[0], P0[1], bend(P0)], [P1[0], P1[1], bend(P1)], [P2[0], P2[1], bend(P2)], [0, 0, side], [1, 1, 1], [P0[0] / 0.07, P0[1] / 0.07], [P1[0] / 0.07, P1[1] / 0.07], [P2[0] / 0.07, P2[1] / 0.07]);
					}
				}, null, null);
			}
			// ---- the old plaster's wooden lath: strips with gaps, across the plaster's hole
			function strips(l, j, G, s) {
				const A = AUX[j], toCav = seq[s + 1]?.m === 'cavity' ? 1 : -1, a1 = toCav > 0 ? l.hi : l.lo, a0 = a1 - toCav * 0.008;
				const H = 0.035, gapH = 0.01;
				for (let y = Math.floor(P.y0 / (H + gapH)) * (H + gapH); y < P.y1; y += H + gapH) {
					const ya = Math.max(P.y0, y), yb = Math.min(P.y1, y + H);
					if (yb - ya < 0.005) continue;
					let run0 = null;
					for (let i = 0; i <= nu; i++) {
						const show = i < nu && bil(G, su[i + 1], (ya + yb) / 2) >= 0.8 && bil(A, su[i + 1], (ya + yb) / 2) < ISO;
						if (show) { if (run0 === null) run0 = i; continue; }
						if (run0 !== null) { const u0 = su[run0 + 1] - fcu / 2, u1 = su[i] + fcu / 2; box(TILE.wood, 'wood', Math.max(P.u0, u0), Math.min(P.u1, u1), ya, yb, Math.min(a0, a1), Math.max(a0, a1)); run0 = null; }
					}
				}
			}
			// ---- bars in concrete, where the cover is off, bent the way the blow went
			function bars(l, j, G) {
				const A = AUX[j], cover = 0.045, sp = 0.2, r = 0.006;
				const depths = l.t > 0.12 ? [l.lo + cover, l.hi - cover] : [(l.lo + l.hi) / 2];
				const S = spallOf(G);
				const exposed = (u, y) => Math.max(bil(G, u, y), bil(S, u, y) * 0.9) >= 0.95;
				for (const d of depths) {
					const side = d < (l.lo + l.hi) / 2 ? -1 : 1;
					// along u at each bar height, and up at each bar position
					for (let y = Math.ceil((P.y0 - 0.1) / sp) * sp + 0.1; y < P.y1; y += sp) bar(true, y, d, side);
					for (let u = W.s + 0.1 + Math.ceil((P.u0 - W.s - 0.1) / sp) * sp; u < P.u1; u += sp) bar(false, u, d, side);
				}
				function bar(horiz, c, d, side) {
					// (sampled at half the cells, whatever the trace's grain)
					const n = (horiz ? P.nu : P.nv) * 2, pts = [];
					for (let q = 0; q <= n * 2; q++) {
						const t = (horiz ? P.u0 : P.y0) + (horiz ? P.csu : P.csv) * q / 2, u = horiz ? t : c, y = horiz ? c : t;
						const show = exposed(u, y) && bil(A, u, y) < 1.3;
						if (show) pts.push([u, y, d + side * Math.max(0, bil(A, u, y) - 0.3) * 0.03]);
						else if (pts.length) { seg(pts, horiz); pts.length = 0; }
					}
					if (pts.length) seg(pts, horiz);
				}
				function seg(pts, horiz) {
					if (pts.length < 2) return;
					for (let q = 0; q + 1 < pts.length; q++) {
						const p = pts[q], s2 = pts[q + 1];
						for (const [du, dy, da] of horiz ? [[0, r, 0], [0, 0, r], [0, -r, 0], [0, 0, -r]] : [[r, 0, 0], [0, 0, r], [-r, 0, 0], [0, 0, -r]]) {
							const nx = [du / r, dy / r, da / r];
							const side2 = horiz ? (dy !== 0 ? [0, 0, r] : [0, r, 0]) : (du !== 0 ? [0, 0, r] : [r, 0, 0]);
							const a = [p[0] + du - side2[0], p[1] + dy - side2[1], p[2] + da - side2[2]], b = [s2[0] + du - side2[0], s2[1] + dy - side2[1], s2[2] + da - side2[2]];
							const c2 = [s2[0] + du + side2[0], s2[1] + dy + side2[1], s2[2] + da + side2[2]], dd = [p[0] + du + side2[0], p[1] + dy + side2[1], p[2] + da + side2[2]];
							sq(TILE.rust, 'rust', a, b, c2, dd, nx, [0, 0.05, 0.05, 0], [0, 0, 0.012, 0.012]);
						}
					}
				}
			}
			// ---- masonry: whole bricks (or blocks) out along their mortar lines
			function masonry(l, j, s) {
				const U = MAT[l.m].unit, BL = U[0] + U[2], BH = U[1] + U[2], D = P.dmg[j];
				const off0 = (l.i % 2) * BL / 4;
				const inTile = l.m === 'brick' ? TILE.brickIn : TILE.concrete;
				const cellR = (u, y) => { const i = Math.floor((u - P.u0) / P.csu), k = Math.floor((y - P.y0) / P.csv); return i < 0 || k < 0 || i >= P.nu || k >= P.nv ? 0 : D[i + k * P.nu]; };
				// each unit: 0 whole, 1 loose, 2 out
				const units = [];
				const k0 = Math.floor(P.y0 / BH), k1 = Math.ceil(P.y1 / BH);
				for (let kc = k0; kc < k1; kc++) {
					const yb0 = kc * BH, ya = Math.max(P.y0, yb0), yb = Math.min(P.y1, yb0 + BH);
					if (yb - ya < 0.004) continue;
					const off = off0 + ((kc % 2 + 2) % 2 === 0 ? BL / 2 : 0), base = W.s - off;
					const i0 = Math.floor((P.u0 - base) / BL), i1 = Math.ceil((P.u1 - base) / BL);
					const row = [];
					for (let ic = i0; ic < i1; ic++) {
						const ua = Math.max(P.u0, base + ic * BL), ub = Math.min(P.u1, base + (ic + 1) * BL);
						if (ub - ua < 0.004) continue;
						const um = (ua + ub) / 2, ym = (ya + yb) / 2;
						const r = Math.max(cellR(um, ym), (cellR(um - BL / 4, ym) + cellR(um + BL / 4, ym)) / 2) + (hash3(ic, kc, seed + j * 7) - 0.5) * 0.4;
						const edge = ua <= P.u0 + 0.001 || ub >= P.u1 - 0.001 || ya <= P.y0 + 0.001 || yb >= P.y1 - 0.001;
						row.push({ ua, ub, ya, yb, st: edge ? 0 : r > 1.05 ? 2 : r > 0.6 ? 1 : 0, ic, kc });
					}
					units.push(row);
				}
				const outAt = (u, y) => { for (const row of units) { if (!row.length || y < row[0].ya - 1e-4 || y > row[0].yb + 1e-4) continue; for (const b of row) if (u >= b.ua - 1e-4 && u <= b.ub + 1e-4) return b.st === 2; } return false; };
				const anyOut = units.some((row) => row.some((b) => b.st > 0));
				const outer0 = l === first, outer1 = l === last;
				for (const side of [0, 1]) {
					const outer = side ? outer1 : outer0, a = side ? l.hi : l.lo, sgn = side ? 1 : -1;
					const nb = seq[s + (side ? 1 : -1)];
					if (!outer && !anyOut && !(nb && nb.m !== 'gap' && P.dmg[nb.i].some((x) => x >= 1))) continue;
					const key = outer ? pc.keys[side] : null;
					for (const row of units) {
						let r0 = null;
						for (let q = 0; q <= row.length; q++) {
							const b = row[q], whole = b && b.st === 0;
							if (whole) { if (!r0) r0 = b; continue; }
							if (r0) {
								const u0 = r0.ua, u1 = row[q - 1].ub, y0 = r0.ya, y1 = r0.yb;
								if (key && outer) { const B = faceBuf(key); quad(B, [u0, y0, a], [u1, y0, a], [u1, y1, a], [u0, y1, a], [0, 0, sgn], pc.cols[side], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]); }
								else if (l.m === 'brick') { const bu = (u) => (u - W.s + off0) / BRICK_TILE[0], bv = (y) => y / BRICK_TILE[1]; quad(sec, [u0, y0, a], [u1, y0, a], [u1, y1, a], [u0, y1, a], [0, 0, sgn], outer ? TINT.brick : TINT.brickIn, [[bu(u0), bv(y0)], [bu(u1), bv(y0)], [bu(u1), bv(y1)], [bu(u0), bv(y1)]], TILE.brick); }
								else sq(TILE.concrete, 'block', [u0, y0, a], [u1, y0, a], [u1, y1, a], [u0, y1, a], [0, 0, sgn], [u0, u1, u1, u0], [y0, y0, y1, y1]);
								r0 = null;
							}
						}
					}
				}
				// loose units a little out of line, and the sides of every unit next to one knocked out
				for (const row of units) for (let q = 0; q < row.length; q++) {
					const b = row[q];
					if (b.st === 2) continue;
					const m = 0.004;
					if (b.st === 1) {
						const h = hash3(b.ic, b.kc, seed + 61), da = (h - 0.5) * 0.03, du = (hash3(b.kc, b.ic, seed) - 0.5) * 0.012;
						box(inTile, 'loose', b.ua + m + du, b.ub - m + du, b.ya + m, b.yb - m, l.lo + Math.max(0, da), l.hi + Math.min(0, da));
						for (const s1 of [0, 1]) { const a = s1 ? l.hi + Math.min(0, da) + 0.0005 : l.lo + Math.max(0, da) - 0.0005, bu = (u) => (u - W.s + off0) / BRICK_TILE[0], bv = (y) => y / BRICK_TILE[1]; if (l.m === 'brick') quad(sec, [b.ua + m + du, b.ya + m, a], [b.ub - m + du, b.ya + m, a], [b.ub - m + du, b.yb - m, a], [b.ua + m + du, b.yb - m, a], [0, 0, s1 ? 1 : -1], TINT.loose, [[bu(b.ua), bv(b.ya)], [bu(b.ub), bv(b.ya)], [bu(b.ub), bv(b.yb)], [bu(b.ua), bv(b.yb)]], TILE.brick); }
						continue;
					}
					const L2 = row[q - 1], R2 = row[q + 1], um = (b.ua + b.ub) / 2;
					if (L2 && L2.st === 2) sq(inTile, 'brickIn', [b.ua, b.ya, l.lo], [b.ua, b.yb, l.lo], [b.ua, b.yb, l.hi], [b.ua, b.ya, l.hi], [-1, 0, 0], [0, BH, BH, 0], [0, 0, l.t, l.t]);
					if (R2 && R2.st === 2) sq(inTile, 'brickIn', [b.ub, b.ya, l.lo], [b.ub, b.yb, l.lo], [b.ub, b.yb, l.hi], [b.ub, b.ya, l.hi], [1, 0, 0], [0, BH, BH, 0], [0, 0, l.t, l.t]);
					if (outAt(um, b.yb + BH / 2) || outAt(b.ua + 0.02, b.yb + BH / 2) || outAt(b.ub - 0.02, b.yb + BH / 2)) sq(inTile, 'brickIn', [b.ua, b.yb, l.lo], [b.ub, b.yb, l.lo], [b.ub, b.yb, l.hi], [b.ua, b.yb, l.hi], [0, 1, 0], [b.ua, b.ub, b.ub, b.ua], [0, 0, l.t, l.t]);
					if (outAt(um, b.ya - BH / 2) || outAt(b.ua + 0.02, b.ya - BH / 2) || outAt(b.ub - 0.02, b.ya - BH / 2)) sq(inTile, 'brickIn', [b.ua, b.ya, l.lo], [b.ub, b.ya, l.lo], [b.ub, b.ya, l.hi], [b.ua, b.ya, l.hi], [0, -1, 0], [b.ua, b.ub, b.ub, b.ua], [0, 0, l.t, l.t]);
				}
			}
			// ---- a cable along the wall at outlet height, a pair of pipes in a wet wall
			function wiring() {
				const cav = L.find((q) => q.m === 'cavity');
				if (!cav) return;
				let uMin = Infinity, uMax = -Infinity;
				const j = cav.i, prevF = F[seq[seq.indexOf(cav) - 1]?.i], nextF = F[seq[seq.indexOf(cav) + 1]?.i];
				for (let k = 0; k <= nv; k++) for (let i = 0; i <= nu; i++) if (nearSq(i, k) && ((prevF && sqMax(prevF, i, k) >= 0.75) || (nextF && sqMax(nextF, i, k) >= 0.75))) { uMin = Math.min(uMin, su[i]); uMax = Math.max(uMax, su[i + 1]); }
				if (uMin === Infinity) return;
				const a = (cav.lo + cav.hi) / 2;
				if (W.wired && pc.floor !== undefined && pc.y0 <= pc.floor + 0.32 && pc.y1 > pc.floor + 0.32) {
					const y = pc.floor + 0.32, r = 0.0065, u0 = Math.max(P.u0, uMin - 0.2), u1 = Math.min(P.u1, uMax + 0.2);
					const D = P.dmg[j], k = Math.floor((y - P.y0) / P.csv);
					// (cut where the cavity was torn right through there)
					let s0 = u0;
					for (let u = u0; u <= u1 + 1e-6; u += P.csu) {
						const i = Math.floor((u - P.u0) / P.csu), cut = i >= 0 && i < P.nu && k >= 0 && k < P.nv && !P.stud[i] && D[i + k * P.nu] >= 2.5;
						if (cut || u + P.csu > u1) { const e = cut ? u : u1; if (e - s0 > 0.03) box(TILE.flat, W.seed % 2 ? 'cable' : 'cable2', s0, e, y - r, y + r, a - r, a + r, 3); s0 = u + P.csu; }
					}
				}
				if (W.wet && pc.y1 - pc.y0 > 1.5) {
					const bay = pc.studs.find((s0, q) => pc.studs[q + 1] && (s0 + pc.studs[q + 1]) / 2 > uMin && (s0 + pc.studs[q + 1]) / 2 < uMax);
					if (bay !== undefined) {
						const nx = pc.studs[pc.studs.indexOf(bay) + 1], um = (bay + nx) / 2;
						for (const du of [-0.04, 0.04]) box(TILE.flat, 'copper', um + du - 0.008, um + du + 0.008, P.y0, P.y1, a - 0.008, a + 0.008, 12);
					}
				}
			}
		}
		// ---------- the piece's ends and top (the builder's paint), and its baseboards ----------
		function caps(pc) {
			const B = faceBuf('paint'), col = W.capCol;
			if (pc.capL !== false) quad(B, [pc.u0, pc.y0, amin], [pc.u0, pc.y0, amax], [pc.u0, pc.y1, amax], [pc.u0, pc.y1, amin], [-1, 0, 0], col, [[amin, pc.y0], [amax, pc.y0], [amax, pc.y1], [amin, pc.y1]]);
			if (pc.capR !== false) quad(B, [pc.u1, pc.y0, amin], [pc.u1, pc.y0, amax], [pc.u1, pc.y1, amax], [pc.u1, pc.y1, amin], [1, 0, 0], col, [[amin, pc.y0], [amax, pc.y0], [amax, pc.y1], [amin, pc.y1]]);
			quad(B, [pc.u0, pc.y1, amin], [pc.u1, pc.y1, amin], [pc.u1, pc.y1, amax], [pc.u0, pc.y1, amax], [0, 1, 0], col, [[pc.u0, amin], [pc.u1, amin], [pc.u1, amax], [pc.u0, amax]]);
		}
		function trims(pc, GA, GB) {
			for (const side of [0, 1]) {
				const T = pc.trims?.[side];
				if (!T || pc.y0 > T.y + 0.01) continue;
				const a = side ? amax : amin, sgn = side ? 1 : -1, a2 = a + sgn * T.t, y0 = T.y, y1 = T.y + T.h;
				const B = faceBuf(T.key);
				const G = side ? GB : GA;
				// (broken off where the hole reaches the floor)
				const runs = [];
				if (!G) runs.push([pc.u0, pc.u1]);
				else {
					let s0 = pc.u0;
					for (let u = pc.u0; u < pc.u1; u += 0.025) {
						if (G(u + 0.0125) >= ISO) { if (u - s0 > 0.02) runs.push([s0, u]); s0 = u + 0.025; }
					}
					if (pc.u1 - s0 > 0.02) runs.push([s0, pc.u1]);
				}
				for (const [u0, u1] of runs) {
					quad(B, [u0, y0, a2], [u1, y0, a2], [u1, y1, a2], [u0, y1, a2], [0, 0, sgn], T.col, [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]);
					quad(B, [u0, y1, a], [u1, y1, a], [u1, y1, a2], [u0, y1, a2], [0, 1, 0], T.col, [[u0, 0], [u1, 0], [u1, T.t], [u0, T.t]]);
					quad(B, [u0, y0, a], [u0, y0, a2], [u0, y1, a2], [u0, y1, a], [-1, 0, 0], T.col, [[0, y0], [T.t, y0], [T.t, y1], [0, y1]]);
					quad(B, [u1, y0, a], [u1, y0, a2], [u1, y1, a2], [u1, y1, a], [1, 0, 0], T.col, [[0, y0], [T.t, y0], [T.t, y1], [0, y1]]);
				}
			}
		}
	}
	return { build, secMat, lathMat };
}

function meshOf(b, mat, name, tiles) {
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
	if (tiles) g.setAttribute('aTile', new THREE.Float32BufferAttribute(b.t, 2));
	if (mat.vertexColors) {
		if (mat.vertexAlphas) { const n = b.c.length / 3, c4 = new Float32Array(n * 4); for (let i = 0; i < n; i++) { c4[i * 4] = b.c[i * 3]; c4[i * 4 + 1] = b.c[i * 3 + 1]; c4[i * 4 + 2] = b.c[i * 3 + 2]; c4[i * 4 + 3] = 1; } g.setAttribute('color', new THREE.BufferAttribute(c4, 4)); }
		else g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
	}
	g.computeBoundingSphere();
	const m = new THREE.Mesh(g, mat);
	m.name = name; m.castShadow = !mat.transparent; m.receiveShadow = true;
	m.userData.wallDamage = true;
	return m;
}
