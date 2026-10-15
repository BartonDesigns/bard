// The damage a wall has taken, cell by cell. Each run of wall between its openings (a piece)
// is divided into cells of 10 to 15 cm, and every layer of its assembly keeps, for every cell,
// how far it is broken (0 whole, 1 and over broken through), with a second channel for what
// is embedded in a layer (the stucco's wire, the plaster's wooden lath, the bars in concrete).
// A blow spreads over the cells round where it landed and goes from the struck face inward,
// each layer taking what it can and passing on what is left: a fist dents drywall, cracks it
// and goes through between the studs but stops on one (and hurts); a round makes a small hole
// going in, tears a bigger one coming out, and goes on weaker or stops in brick; a blast
// tears whole bays out, studs and all. From the cells: where you can see through, and where a
// body can pass (shoulder width at head height, or at a crawl).
//
// Plain numbers (no three.js); tested in island/tools/destruction-walls.test.mjs.

import { MAT, strength, hardAt, solidTo } from './assembly.js';

const W_STUD = 0.038;

// a piece: u0..u1 along the wall, y0..y1 up it (the builder's coordinates), its studs (u),
// the cell size and the layers (assembly.js layersFor)
export function createPiece({ u0, u1, y0, y1, studs = [], cs = 0.1, stack }) {
	const nu = Math.max(1, Math.round((u1 - u0) / cs)), nv = Math.max(1, Math.round((y1 - y0) / cs));
	const P = { u0, u1, y0, y1, nu, nv, csu: (u1 - u0) / nu, csv: (y1 - y0) / nv, stack, studs, n: nu * nv };
	P.dmg = stack.layers.map(() => new Float32Array(P.n));
	P.aux = stack.layers.map((l) => (l.lath || l.rebar ? new Float32Array(P.n) : null));
	// (which columns stand over a stud, and the rows over the plates at the foot and the head)
	P.stud = new Uint8Array(nu);
	const hasStuds = stack.layers.some((l) => l.m === 'cavity');
	if (hasStuds) for (const s of studs) { const i = Math.floor((s - u0) / P.csu); if (i >= 0 && i < nu) P.stud[i] = 1; }
	P.plate = (k) => hasStuds && (k === 0 || k === nv - 1);
	P.any = false;
	return P;
}
export const cellAt = (P, u, v) => {
	const i = Math.floor((u - P.u0) / P.csu), k = Math.floor((v - P.y0) / P.csv);
	return i < 0 || k < 0 || i >= P.nu || k >= P.nv ? -1 : i + k * P.nu;
};
export const onStudCell = (P, c) => P.stud[c % P.nu] === 1 || P.plate(Math.floor(c / P.nu));
export const broken = (P, j, c) => P.dmg[j][c] >= 1;

// is layer j open at cell c for the eye (light and sight go through)
function clearAt(P, j, c) {
	const l = P.stack.layers[j];
	if (l.m === 'gap' || l.m === 'air') return true;
	if (l.m === 'cavity') return onStudCell(P, c) ? P.dmg[j][c] >= 1 : l.fill === 'air' || P.dmg[j][c] >= 2.5;
	if (P.dmg[j][c] < 1) return false;
	// (the stucco's wire lets light through its mesh; bars do too)
	return true;
}
// can a body push through layer j at cell c
function passAt(P, j, c) {
	const l = P.stack.layers[j], st = onStudCell(P, c);
	if (solidTo(l, st) && P.dmg[j][c] < 1) return false;
	if (l.lath === 'wire' && P.aux[j][c] < 0.6) return false;
	if (l.rebar && P.aux[j][c] < 1) return false;
	return true;
}
export function throughAt(P, c) {
	if (c < 0 || !P.any) return false;
	for (let j = 0; j < P.dmg.length; j++) if (!clearAt(P, j, c)) return false;
	return true;
}
export function passableAt(P, c) {
	if (c < 0 || !P.any) return false;
	for (let j = 0; j < P.dmg.length; j++) if (!passAt(P, j, c)) return false;
	return true;
}

// the blow's reach over the cells: a list of [cell, weight], reused
const KERNEL = [];
function kernel(P, u, v, r, normalise, pw = 1.5) {
	KERNEL.length = 0;
	const R = r + Math.max(P.csu, P.csv) * 0.5;
	const i0 = Math.max(0, Math.floor((u - R - P.u0) / P.csu)), i1 = Math.min(P.nu - 1, Math.floor((u + R - P.u0) / P.csu));
	const k0 = Math.max(0, Math.floor((v - R - P.y0) / P.csv)), k1 = Math.min(P.nv - 1, Math.floor((v + R - P.y0) / P.csv));
	let sum = 0;
	for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
		const cu = P.u0 + (i + 0.5) * P.csu, cv = P.y0 + (k + 0.5) * P.csv, d = Math.hypot(cu - u, cv - v);
		if (d > R) continue;
		const w = Math.pow(1 - d / R, pw);
		if (w <= 0) continue;
		KERNEL.push(i + k * P.nu, w);
		sum += w;
	}
	if (normalise && sum > 0) for (let q = 1; q < KERNEL.length; q += 2) KERNEL[q] /= sum;
	return KERNEL;
}
// a cell's layer next to one already broken gives way more easily (the edge of a hole crumbles)
function edgeOf(P, j, c) {
	const i = c % P.nu, k = (c - i) / P.nu, D = P.dmg[j];
	return (i > 0 && D[c - 1] >= 1) || (i < P.nu - 1 && D[c + 1] >= 1) || (k > 0 && D[c - P.nu] >= 1) || (k < P.nv - 1 && D[c + P.nu] >= 1);
}

// one layer at one cell takes energy e of a kind; returns what it passes on
function take(P, j, c, e, kind, front) {
	const l = P.stack.layers[j], st = onStudCell(P, c), D = P.dmg[j];
	if (l.lath || l.rebar) {
		const A = MAT[l.rebar ? 'rebar' : l.lath];
		P.aux[j][c] = Math.min(4, P.aux[j][c] + e * (kind === 'blast' ? 1 : 0.5) / (kind === 'ball' ? A.ball : A.blunt));
	}
	if (D[c] >= 1) return e;
	let hp = strength(l, kind === 'ball' ? 'ball' : 'blunt', st);
	if (!(hp > 0)) { D[c] = 1; return e; }
	// (a board backed by a stud only cracks; the edge of a hole crumbles)
	if (kind === 'blunt' && front && st && l.m !== 'cavity' && j === front.backed) hp *= 3;
	// (a stud shrugs off light blows: a fist barely marks it, a bat's swing splits it in time)
	if (kind === 'blunt' && l.m === 'cavity' && st) e *= Math.min(1.6, Math.max(0, (e - 14) / 12));
	if (edgeOf(P, j, c)) hp *= 0.6;
	const before = D[c], raw = before + e / hp;
	D[c] = Math.min(4, raw);
	if (raw < 1) return 0;
	// (what was left once it gave way goes on, less what the breaking took)
	const left = (raw - Math.max(1, before)) * hp;
	return left * (kind === 'blunt' ? 0.55 : 0.8);
}

// a blow on the piece. side: 0 struck from the a0 side, 1 from a1. kind: 'blunt' (fists,
// bats, a car's nose: energy spread over radius r), 'ball' (a round: energy is its damage),
// 'blast' (energy is what the middle cell takes, falling off to r)
export function strike(P, { u, v, side = 0, kind = 'blunt', energy = 10, r = 0.08 }) {
	// (the layers in the order the blow meets them: from the low-a face for side 0, the high-a face for side 1)
	const L = P.stack.layers, asc = L.map((_, j) => j).sort((a, b) => L[a].lo - L[b].lo), order = side ? asc.reverse() : asc;
	const c0 = cellAt(P, Math.min(P.u1 - 1e-4, Math.max(P.u0, u)), Math.min(P.y1 - 1e-4, Math.max(P.y0, v)));
	const res = { cell: c0, hard: false, stud: false, broke: [], first: -1, stoppedIn: -1, out: 0, exitCell: -1, surface: null, depth: 0 };
	if (c0 < 0) return res;
	P.any = true;
	const st0 = onStudCell(P, c0);
	res.stud = st0;
	// what the struck face is now (the first layer not yet broken at the middle cell)
	for (const j of order) { if (P.dmg[j][c0] < 1 || L[j].m === 'cavity') { res.first = j; break; } }
	if (res.first < 0) res.first = order[order.length - 1];
	res.surface = L[res.first].m === 'cavity' ? (st0 ? L[res.first].stud : L[res.first].fill) : L[res.first].m;
	// (a fist on board over a stud, or on masonry, stucco, concrete: hard)
	{
		let k = order.indexOf(res.first);
		const l0 = L[order[k]];
		if (hardAt(l0, st0)) res.hard = true;
		else if (l0.t < 0.03) for (k++; k < order.length; k++) { const l = L[order[k]]; if (l.m === 'cavity') { res.hard = st0; break; } if (MAT[l.m].hard) { res.hard = true; break; } if (l.t > 0.03) break; }
	}
	const front = { backed: res.first };
	const before = L.map((_, j) => P.dmg[j][c0] >= 1);
	if (kind === 'ball') {
		// a round: through the cell it strikes, each layer taking its share; the way out tears a
		// bigger hole than the way in (the far face blown out round it)
		let d = energy, exitJ = -1;
		for (const j of order) {
			if (d <= 0) break;
			const l = L[j];
			const pass = P.dmg[j][c0] >= 1 ? 1 : l.m === 'cavity' ? (st0 ? MAT[l.stud].pass : MAT[l.fill].pass) : MAT[l.m].pass;
			const spent = d * (1 - pass);
			take(P, j, c0, spent * 0.9 + d * 0.12, 'ball', null);
			// (brittle faces chip away round where a round goes in)
			if (P.dmg[j][c0] < 4 && (l.m === 'stucco' || l.m === 'render' || l.m === 'plaster' || l.m === 'concrete' || l.m === 'brick' || l.m === 'block')) { const K = kernel(P, u, v, 0.07, false); for (let q = 0; q < K.length; q += 2) if (K[q] !== c0) take(P, j, K[q], d * 0.14 * K[q + 1], 'ball', null); }
			if (l.m !== 'cavity' && l.m !== 'gap' && l.m !== 'paper') exitJ = j;
			d *= pass;
			if (d < 4) { res.stoppedIn = j; d = 0; }
		}
		res.out = d;
		// (the exit's blow-out: the last solid face it left, round the cell it left by)
		if (d > 0 && exitJ >= 0) {
			const K = kernel(P, u, v, 0.05, false);
			for (let q = 0; q < K.length; q += 2) take(P, exitJ, K[q], energy * 0.22 * K[q + 1], 'ball', null);
			res.exitCell = c0;
		}
		// (a stopped round spalls the face it stopped in)
		if (res.stoppedIn >= 0 && L[res.stoppedIn].t > 0.05) {
			const K = kernel(P, u, v, 0.06, false);
			for (let q = 0; q < K.length; q += 2) if (K[q] !== c0) take(P, res.stoppedIn, K[q], energy * 0.08 * K[q + 1], 'ball', null);
		}
	} else {
		const K = kernel(P, u, v, r, kind === 'blunt', kind === 'blast' ? 1 : 2.5);
		for (let q = 0; q < K.length; q += 2) {
			const c = K[q];
			const e0 = energy * K[q + 1];
			let e = e0;
			for (const j of order) {
				if (e <= 1e-4) break;
				e = take(P, j, c, e, kind, front);
			}
			// (a blast's push tears the wire across the studs too, not only between them)
			if (kind === 'blast') for (let j = 0; j < L.length; j++) if (L[j].lath === 'wire') P.aux[j][c] = Math.min(4, P.aux[j][c] + e0 * 0.35 / MAT.wire.blunt);
		}
	}
	for (let j = 0; j < L.length; j++) if (!before[j] && P.dmg[j][c0] >= 1) res.broke.push(j);
	for (const j of order) { if (P.dmg[j][c0] >= 1) res.depth++; else break; }
	return res;
}

// where a body can pass: the widest run of passable columns, standing (head height) or at a
// crawl, from no more than a step above the floor. floor: the floor's y. Returns
// { kind: 'stand' | 'crawl', u0, u1, y0, y1 } or null
export const BREACH = { width: 0.5, stand: 1.75, crawl: 0.75, step: 0.42 };
export function breachOf(P, floor) {
	if (!P.any) return null;
	const pass = new Uint8Array(P.n);
	for (let c = 0; c < P.n; c++) pass[c] = passableAt(P, c) ? 1 : 0;
	return breachIn(pass, P.nu, P.nv, P.u0, P.y0, P.csu, P.csv, floor);
}
export function breachIn(pass, nu, nv, u0, y0, csu, csv, floor) {
	let best = null;
	const need = Math.ceil(BREACH.width / csu - 1e-6);
	for (let kb = 0; kb < nv; kb++) {
		const yb = y0 + kb * csv;
		if (yb > floor + BREACH.step) break;
		// (a row under the start that is still whole but no higher than a step: stepped over)
		const h = new Array(nu).fill(0);
		for (let i = 0; i < nu; i++) { let k = kb; while (k < nv && pass[i + k * nu]) k++; h[i] = (k - kb) * csv; }
		for (const [kind, H] of [['stand', BREACH.stand], ['crawl', BREACH.crawl]]) {
			let run = 0, minH = Infinity;
			for (let i = 0; i <= nu; i++) {
				const ok = i < nu && h[i] >= H;
				if (ok) { run++; minH = Math.min(minH, h[i]); continue; }
				if (run >= need) {
					const cand = { kind, u0: u0 + (i - run) * csu, u1: u0 + i * csu, y0: yb, y1: yb + minH };
					if (!best || (best.kind === 'crawl' && kind === 'stand') || (best.kind === kind && cand.u1 - cand.u0 > best.u1 - best.u0)) best = cand;
				}
				run = 0; minH = Infinity;
			}
			if (best?.kind === 'stand') break;
		}
	}
	return best;
}

// kept compactly: [layer, u (cm), v (cm), ratio x 16] for each damaged cell, aux channels as
// layer + 100
export function serialise(P) {
	const out = [];
	for (let j = 0; j < P.dmg.length; j++) for (const [D, off] of [[P.dmg[j], 0], [P.aux[j], 100]]) {
		if (!D) continue;
		for (let c = 0; c < P.n; c++) {
			if (D[c] < 0.04) continue;
			const i = c % P.nu, k = (c - i) / P.nu;
			out.push([j + off, Math.round((P.u0 + (i + 0.5) * P.csu) * 100), Math.round((P.y0 + (k + 0.5) * P.csv) * 100), Math.min(64, Math.round(D[c] * 16))]);
		}
	}
	return out;
}
export function restore(P, list) {
	for (const [jj, uc, vc, q] of list || []) {
		const aux = jj >= 100, j = aux ? jj - 100 : jj, D = aux ? P.aux[j] : P.dmg[j];
		if (!D) continue;
		const c = cellAt(P, uc / 100, vc / 100);
		if (c < 0) continue;
		D[c] = Math.max(D[c], q / 16);
		P.any = true;
	}
}
export const studWidth = W_STUD;
