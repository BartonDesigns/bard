// Walls you break through (structures/walls/): which assembly a wall is given from its building,
// era and region; blows that accumulate cell by cell (a punch dents and cracks drywall before it
// goes through, a stud stops it and hurts, a fist never breaks a stud); rounds that pass through a
// partition and stop in brick, consistent with combat's penetration; the size of a hole a body
// can pass (shoulder width at head height, or a crawl); what is kept and put back; and the
// drawing of a broken wall (its layers, studs, batts and lath, no NaNs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { assemblyFor, layersFor, studsFor, penetrate, ageOf, ASSEMBLY } from '../src/structures/walls/assembly.js';
import { createPiece, strike, cellAt, throughAt, passableAt, breachOf, breachIn, serialise, restore } from '../src/structures/walls/cells.js';
import { createWallMesher } from '../src/structures/walls/mesh.js';

const piece = (asm, o = {}) => {
	const stack = layersFor(asm, 0, o.T ?? 0.16, o.inside ?? -1);
	const cav = stack.layers.find((l) => l.m === 'cavity');
	const u0 = o.u0 ?? 0, u1 = o.u1 ?? 3;
	return createPiece({ u0, u1, y0: 0, y1: o.h ?? 2.6, studs: cav ? studsFor(u0, u1, 0, cav.spacing) : [], cs: o.cs ?? 0.1, stack });
};
// a point between studs, and one on a stud
const bay = (P) => (P.studs[1] + P.studs[2]) / 2;

test('assemblies by building, era and region', () => {
	assert.equal(assemblyFor({ use: 'house', era: 'tract', ext: true }), 'stuccoTract');
	assert.equal(assemblyFor({ use: 'house', era: 'prewar', ext: true }), 'stuccoPrewar');
	assert.equal(assemblyFor({ use: 'house', era: 'prewar', ext: false }), 'partitionPlaster');
	assert.equal(assemblyFor({ use: 'house', era: 'ranch', ext: true }), 'stuccoPostwar');
	assert.equal(assemblyFor({ use: 'house', era: 'modern', ext: true }), 'stuccoNew');
	assert.equal(assemblyFor({ use: 'house', era: 'tract', ext: true, siding: 'lap' }), 'sidingTract');
	assert.equal(assemblyFor({ use: 'house', era: 'tract', ext: true, siding: 'brick' }), 'veneer');
	assert.equal(assemblyFor({ use: 'house', era: 'split', ext: false }), 'partition');
	assert.equal(assemblyFor({ use: 'row', era: 'victorian', ext: true }), 'sidingPrewar', 'a Victorian row house: wood siding over boards');
	assert.equal(assemblyFor({ use: 'apt', era: 'edwardian', ext: true }), 'brick');
	assert.equal(assemblyFor({ use: 'office', era: 'modern', ext: true }), 'concrete');
	assert.equal(assemblyFor({ use: 'office', era: 'modern', ext: false }), 'partitionSteel');
	assert.equal(assemblyFor({ use: 'warehouse', era: 'plain', ext: true }), 'concreteBare');
	assert.equal(assemblyFor({ use: 'store', ext: true }), 'block');
	assert.equal(assemblyFor({ region: 'eu', ext: true }), 'brickRender');
	assert.equal(assemblyFor({ region: 'jp', ext: true }), 'timberJp');
	// (every era name the builders use has an age)
	for (const e of ['historic', 'prewar', 'postwar', 'tract', 'new', 'ranch', 'split', 'modern', 'victorian', 'edwardian', 'sunset', 'mission', 'plain']) assert.ok(['old', 'mid', 'late', 'new'].includes(ageOf(e)), e);
});

test('layers fill the wall exactly, room side first, the core taking up the difference', () => {
	for (const id of Object.keys(ASSEMBLY)) for (const inside of [-1, 1]) {
		const S = layersFor(id, 2, 2.18, inside), L = S.layers;
		const lo = Math.min(...L.map((l) => l.lo)), hi = Math.max(...L.map((l) => l.hi));
		assert.ok(Math.abs(lo - 2) < 1e-9 && Math.abs(hi - 2.18) < 1e-9, id);
		// (the room side: the first layer at a0 when the room is at a0, at a1 when it is at a1)
		assert.ok(inside < 0 ? Math.abs(L[0].lo - 2) < 1e-9 : Math.abs(L[0].hi - 2.18) < 1e-9, id);
	}
	const T = layersFor('stuccoTract', 0, 0.16, -1);
	assert.deepEqual(T.layers.map((l) => l.m), ['drywall', 'cavity', 'paper', 'stucco']);
	assert.ok(T.layers[0].t < 0.02 && T.layers[3].lath === 'wire');
	// studs at 16 inch centres, one at each end
	const s = studsFor(0, 3, 0);
	assert.ok(Math.abs(s[0] - 0.019) < 1e-9 && Math.abs(s.at(-1) - (3 - 0.019)) < 1e-9);
	for (let i = 2; i < s.length - 1; i++) assert.ok(Math.abs(s[i] - s[i - 1] - 0.406) < 1e-6);
});

test('a fist on drywall between studs: dents, cracks, then through the one face; insulation behind', () => {
	const P = piece('stuccoTract'), u = bay(P), v = 1.3, c = cellAt(P, u, v);
	const jab = { u, v, side: 0, kind: 'blunt', energy: 8, r: 0.07 };
	const r1 = strike(P, jab);
	assert.equal(r1.hard, false, 'drywall between studs gives');
	assert.ok(P.dmg[0][c] > 0 && P.dmg[0][c] < 1, 'a dent, not a hole');
	let n = 1;
	while (P.dmg[0][c] < 1 && n < 40) { strike(P, { ...jab, energy: n % 3 === 0 ? 14 : 11 }); n++; }
	assert.ok(n >= 3 && n <= 8, `several solid punches to go through (took ${n})`);
	assert.ok(P.dmg[1][c] < 1 || P.stack.layers[1].fill === 'air', 'behind it, the batt');
	assert.equal(P.dmg[3][c], 0, 'the stucco outside untouched by fists from inside');
	assert.equal(throughAt(P, c), false, 'not a hole to see through yet');
});

test('the room on either side: a blow from the room meets the drywall, from the street the stucco', () => {
	for (const inside of [-1, 1]) {
		const P = piece('stuccoTract', { inside }), room = inside > 0 ? 1 : 0, u = bay(P);
		assert.equal(strike(P, { u, v: 1.2, side: room, kind: 'blunt', energy: 11, r: 0.07 }).surface, 'drywall', `room at ${inside}`);
		assert.equal(strike(P, { u, v: 1.2, side: 1 - room, kind: 'blunt', energy: 11, r: 0.07 }).surface, 'stucco', `street at ${-inside}`);
		const pr = penetrate(P.stack, 58, room), j = P.stack.layers.findIndex((l) => l.m === 'drywall');
		assert.ok(pr.spent[j] > 0 && pr.out > 0);
	}
});

test('a fist on a stud: hard, it hurts, and a fist never breaks the stud', () => {
	const P = piece('partition', { T: 0.11 }), u = P.studs[2], v = 1.2;
	const r = strike(P, { u, v, side: 0, kind: 'blunt', energy: 24, r: 0.085 });
	assert.ok(r.hard && r.stud, 'a stud behind the board');
	for (let i = 0; i < 60; i++) strike(P, { u, v, side: 0, kind: 'blunt', energy: 24, r: 0.085 });
	const c = cellAt(P, u, v);
	assert.ok(P.dmg[1][c] < 1, 'still standing after sixty haymakers');
	// a bat's heavy swings do break it in time
	for (let i = 0; i < 60 && P.dmg[1][c] < 1; i++) strike(P, { u, v, side: 0, kind: 'blunt', energy: 34 * 1.6, r: 0.08 });
	assert.ok(P.dmg[1][c] >= 1, 'a bat splits the stud');
	// masonry and stucco are hard to the fist
	assert.ok(strike(piece('brick', { T: 0.24 }), { u: 1, v: 1, kind: 'blunt', energy: 10 }).hard);
	assert.ok(strike(piece('stuccoTract'), { u: 1.2, v: 1, side: 1, kind: 'blunt', energy: 10 }).hard, 'stucco from outside');
});

test('rounds: through a partition a little weaker, through stucco walls weaker still, stopped by brick and concrete', () => {
	const part = layersFor('partition', 0, 0.11), pr = penetrate(part, 58);
	assert.ok(pr.out > 45 && pr.out < 58, `a partition costs a round little (${pr.out.toFixed(1)})`);
	const ext = layersFor('stuccoTract', 0, 0.16), er = penetrate(ext, 58);
	assert.ok(er.out > 15 && er.out < 40, `a stucco wall costs it half or so (${er.out.toFixed(1)})`);
	assert.ok(penetrate(ext, 58, 0, () => false, true).out < er.out, 'a stud in the way costs more');
	assert.equal(penetrate(layersFor('brick', 0, 0.24), 82).out, 0, 'brick stops a rifle round');
	assert.equal(penetrate(layersFor('concrete', 0, 0.24), 82).out, 0, 'concrete stops it');
	// in the cells: entry small, exit torn bigger, and on through
	const P = piece('partition', { T: 0.11 }), u = bay(P), v = 1.4;
	const r = strike(P, { u, v, side: 0, kind: 'ball', energy: 58 });
	assert.ok(r.out > 40 && r.exitCell >= 0);
	const around = (j) => { let s = 0; for (let k = -2; k <= 2; k++) for (let i = -2; i <= 2; i++) { const c = cellAt(P, u + i * P.csu, v + k * P.csv); if (c >= 0) s += P.dmg[j][c]; } return s; };
	assert.ok(around(2) > around(0), 'the far face torn more than the near one');
	// stopped in brick, the face spalls round it
	const B = piece('brick', { T: 0.24 }), rb = strike(B, { u: 1, v: 1, side: 1, kind: 'ball', energy: 58 });
	assert.equal(rb.out, 0);
	assert.ok(rb.stoppedIn >= 0);
});

test('concentrated fire chews a hole; a single round does not', () => {
	const P = piece('stuccoTract', { inside: -1 }), u = bay(P), v = 1.5, c = cellAt(P, u, v);
	strike(P, { u, v, side: 1, kind: 'ball', energy: 58 });
	assert.ok(P.dmg[3][c] < 1, 'one round only pocks the stucco');
	for (let i = 0; i < 6; i++) strike(P, { u: u + (i % 3 - 1) * 0.03, v: v + (i % 2) * 0.03, side: 1, kind: 'ball', energy: 58 });
	assert.ok(P.dmg[3][c] >= 1, 'a burst into one spot breaks through the stucco');
	assert.ok(P.aux[3][c] < 1, 'the wire lath bends but holds');
});

test('a blast tears out bays, studs and all; the breach is big enough to walk through', () => {
	const P = piece('stuccoTract');
	for (const v of [0.5, 1.1, 1.7]) strike(P, { u: 1.5, v, side: 0, kind: 'blast', energy: 1400, r: 0.7 });
	const br = breachOf(P, 0);
	assert.ok(br, 'a way through');
	assert.equal(br.kind, 'stand');
	assert.ok(br.u1 - br.u0 >= 0.5 && br.y1 - br.y0 >= 1.75 && br.y0 <= 0.32);
	assert.ok(throughAt(P, cellAt(P, 1.5, 1.1)) && passableAt(P, cellAt(P, 1.5, 1.1)));
});

test('the size of a way through: shoulder width at head height, a crawl, a hole between studs is neither', () => {
	const nu = 20, nv = 26, cs = 0.1;
	const grid = (f) => { const g = new Uint8Array(nu * nv); for (let k = 0; k < nv; k++) for (let i = 0; i < nu; i++) g[i + k * nu] = f(i, k) ? 1 : 0; return g; };
	assert.equal(breachIn(grid((i, k) => i >= 5 && i < 11 && k < 19), nu, nv, 0, 0, cs, cs, 0)?.kind, 'stand');
	assert.equal(breachIn(grid((i, k) => i >= 5 && i < 11 && k < 9), nu, nv, 0, 0, cs, cs, 0)?.kind, 'crawl');
	assert.equal(breachIn(grid((i, k) => i >= 5 && i < 9 && k < 19), nu, nv, 0, 0, cs, cs, 0), null, '0.4 m: a stud bay is too narrow');
	assert.equal(breachIn(grid((i, k) => i >= 5 && i < 11 && k >= 6 && k < 25), nu, nv, 0, 0, cs, cs, 0), null, 'a hole up the wall is no doorway');
	assert.equal(breachIn(grid((i, k) => i >= 5 && i < 11 && k >= 1 && k < 20), nu, nv, 0, 0, cs, cs, 0)?.kind, 'stand', 'a plate at the foot is stepped over');
	// fists alone never open a way through a framed wall: the studs hold
	const P = piece('partition', { T: 0.11 });
	for (let n = 0; n < 400; n++) strike(P, { u: 0.6 + (n % 9) * 0.1, v: 0.2 + Math.floor(n / 9) % 18 * 0.1, side: n % 2, kind: 'blunt', energy: 24, r: 0.085 });
	assert.equal(breachOf(P, 0), null);
});

test('kept and put back, by place on the wall (not by cell), at another cell size', () => {
	const P = piece('stuccoTract');
	const u = bay(P);
	for (let i = 0; i < 8; i++) strike(P, { u, v: 1.25, side: 0, kind: 'blunt', energy: 24, r: 0.08 });
	assert.ok(P.dmg[0][cellAt(P, u, 1.25)] >= 1);
	const list = serialise(P);
	assert.ok(list.length > 0);
	const Q = piece('stuccoTract', { cs: 0.15 });
	restore(Q, JSON.parse(JSON.stringify(list)));
	let worst = 0;
	for (const du of [-0.08, 0, 0.08]) for (const dv of [-0.08, 0, 0.08]) worst = Math.max(worst, Q.dmg[0][cellAt(Q, u + du, 1.25 + dv)]);
	assert.ok(worst >= 1, 'the hole is there again');
	assert.ok(Q.any);
});

test('a broken wall is drawn: its faces in the builder\'s materials, the section, the wire, studs and batts, no NaN', () => {
	const M = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? new THREE.MeshStandardMaterial({ vertexColors: true }) : undefined) });
	const mesher = createWallMesher({ atlas: new THREE.Texture(), lath: new THREE.Texture() });
	for (const asm of ['stuccoTract', 'stuccoPrewar', 'partition', 'brick', 'concrete', 'block', 'partitionSteel']) {
		const T = asm === 'brick' || asm === 'concrete' ? 0.24 : 0.16;
		const stack = layersFor(asm, 1, 1 + T, -1), cav = stack.layers.find((l) => l.m === 'cavity');
		const pc = { u0: 0, u1: 3, y0: 0, y1: 2.6, keys: ['paint', 'stucco'], cols: [[0.9, 0.9, 0.9], [0.8, 0.7, 0.6]], trims: [{ key: 'trim', col: [1, 1, 1], y: 0, h: 0.1, t: 0.013 }, null], studs: cav ? studsFor(0, 3, 0, cav.spacing) : [], top: true, floor: 0 };
		const P = createPiece({ u0: 0, u1: 3, y0: 0, y1: 2.6, studs: pc.studs, cs: 0.1, stack });
		for (const v of [0.6, 1.2]) strike(P, { u: 1.3, v, side: 0, kind: 'blast', energy: asm === 'concrete' ? 4000 : 1200, r: 0.5 });
		for (let i = 0; i < 6; i++) strike(P, { u: 2.3, v: 1.4, side: 1, kind: 'ball', energy: 58 });
		const Wl = { axis: 'x', a0: 1, a1: 1 + T, s: 0, e: 3, y1: 2.6, floor: 0, stack, pieces: [pc], cells: [P], seed: 7, wired: true, wet: true, capCol: [1, 1, 1] };
		const meshes = mesher.build(Wl, M);
		const names = meshes.map((m) => m.name);
		assert.ok(names.includes('wall-section'), `${asm}: a section`);
		assert.ok(names.includes('paint') && names.includes('stucco'), `${asm}: both faces`);
		if (asm.startsWith('stucco')) assert.ok(names.includes('wall-lath'), `${asm}: the wire across the stucco's hole`);
		for (const m of meshes) {
			const p = m.geometry.attributes.position.array;
			assert.ok(p.length > 0 && p.length % 9 === 0);
			for (let i = 0; i < p.length; i++) assert.ok(Number.isFinite(p[i]), `${asm} ${m.name} finite`);
			if (m.name === 'wall-section') assert.equal(m.geometry.attributes.aTile.count, m.geometry.attributes.position.count);
		}
		const sec = meshes.find((m) => m.name === 'wall-section').geometry.attributes.position.count;
		assert.ok(sec > 60 && sec < 400000, `${asm}: ${sec} section vertices`);
	}
});
