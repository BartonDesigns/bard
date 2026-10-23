// Landmarks, real and of the place's own stories.
//
// REAL: famous places at their true latitude and longitude, built simplified but
// recognisable from their own proportions (a pyramid's 52 degree faces, a pagoda's five
// roofs, a lattice tower's taper, a dome between minarets). Each has one plain line people
// nearby might say about it. Places of worship are shown as they are, whole, quiet and
// solid; nothing here can be damaged. Some of the most sacred places are left out on
// purpose: they are not ours to model.
//
// LORE: landmarks the world grows for itself, a few in each region and always the same
// ones in the same places: a ruined watchtower on a hill, a shrine on a pass, a wreck in
// the ice, a caravanserai a day from the last well, a stone circle, a great old tree. Each
// has a name and a short local legend that the people nearby know and tell (talk.js), in
// the place's own manner: kind stories of keepers, travellers, storms and promises.

import { STRUCTURES as S } from './structures.js';

const pick = (r, L) => L[Math.floor(r() * L.length)];
const DARK = [0.08, 0.07, 0.06];

// ---------- the builders for the real ones (B as structures.js; s: the scale) ----------
const R = {};
R.pyramid = (B, s = 1, c = [0.82, 0.72, 0.52]) => {
	const { G } = B, h = 139 * s, w = 230 * s;
	G.face([[-w / 2, 0, -w / 2], [w / 2, 0, -w / 2], [0, h, 0]], c).face([[w / 2, 0, -w / 2], [w / 2, 0, w / 2], [0, h, 0]], [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92]);
	G.face([[w / 2, 0, w / 2], [-w / 2, 0, w / 2], [0, h, 0]], [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85]).face([[-w / 2, 0, w / 2], [-w / 2, 0, -w / 2], [0, h, 0]], [c[0] * 0.95, c[1] * 0.95, c[2] * 0.95]);
	B.solid.push([0, 0, w * 0.9, w * 0.9, 0]);
};
R.steppyramid = (B, s = 1, c = [0.66, 0.62, 0.55]) => {
	const { G } = B, n = 9, w = 55 * s, h = 24 * s;
	for (let i = 0; i < n; i++) { const t = 1 - i / n * 0.6; G.box(0, i * h / n, 0, w * t, h / n, w * t, i % 2 ? c : [c[0] * 0.94, c[1] * 0.94, c[2] * 0.94]); }
	G.box(0, 0, -w / 2 + 2, 9 * s, h, w * 0.35, [c[0] * 0.9, c[1] * 0.9, c[2] * 0.9]);
	G.box(0, h, 0, 14 * s, 6 * s, 12 * s, c);
	B.solid.push([0, 0, w, w, 0]);
};
// a lattice tower tapering up from four legs, two platforms, a mast (red and white, or iron)
R.lattice = (B, s = 1, a = {}) => {
	const { G } = B, H = 300 * s, base = 62 * s, c = a?.c || [0.45, 0.32, 0.22], c2 = a?.c2 || null;
	const at = (t) => base / 2 * Math.pow(1 - t, 1.6) + 2 * s;
	for (let k = 0; k < 12; k++) {
		const t0 = k / 12, t1 = (k + 1) / 12, a0 = at(t0), a1 = at(t1), cc = c2 && k % 2 ? c2 : c;
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.beam(sx * a0, t0 * H, sz * a0, sx * a1, t1 * H, sz * a1, 2.2 * s * (1 - t0 * 0.7), cc);
		for (const [ax, az, bx, bz] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { G.beam(ax * a0, t0 * H, az * a0, bx * a1, t1 * H, bz * a1, 0.8 * s, cc); G.beam(bx * a0, t0 * H, bz * a0, ax * a1, t1 * H, az * a1, 0.8 * s, cc); }
	}
	for (const t of [0.19, 0.38]) G.box(0, t * H, 0, at(t) * 2 + 6 * s, 3 * s, at(t) * 2 + 6 * s, c);
	G.box(0, H, 0, 3 * s, 30 * s, 3 * s, c2 || c);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.solid.push([sx * base / 2.3, sz * base / 2.3, 8 * s, 8 * s, 0]);
};
R.colosseum = (B, s = 1, c = [0.78, 0.68, 0.52]) => {
	const { G } = B, a = 94 * s, b = 78 * s, H = 48 * s, n = 40;
	for (let i = 0; i < n; i++) {
		const t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2, broken = i > 28 && i < 36;
		const p = (t, k) => [Math.cos(t) * a * k, Math.sin(t) * b * k];
		const [x0, z0] = p(t0, 1), [x1, z1] = p(t1, 1);
		const hh = broken ? H * 0.55 : H;
		G.face([[x1, 0, z1], [x0, 0, z0], [x0, hh, z0], [x1, hh, z1]], c);
		for (let f = 0; f < (broken ? 2 : 4); f++) G.arch((x0 + x1) / 2, f * H / 4 + 1, (z0 + z1) / 2 * 1.002, Math.hypot(x1 - x0, z1 - z0) * 0.6, H / 4 * 0.75, 0.6 * s, DARK, { r: -(t0 + t1) / 2 + Math.PI / 2 });
		const [u0, w0] = p(t0, 0.72), [u1, w1] = p(t1, 0.72);
		G.face([[x0, hh * 0.9, z0], [x1, hh * 0.9, z1], [u1, 6 * s, w1], [u0, 6 * s, w0]], [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8]);
		B.solid.push([(x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) + 1, 3, -Math.atan2(z1 - z0, x1 - x0)]);
	}
};
R.greektemple = (B, s = 1, c = [0.9, 0.86, 0.76]) => {
	const { G } = B, w = 31 * s, d = 70 * s, H = 10.4 * s;
	for (let k = 0; k < 3; k++) G.box(0, k * 0.5 * s, 0, w + (3 - k) * 1.4 * s, 0.5 * s, d + (3 - k) * 1.4 * s, c);
	for (let i = 0; i < 8; i++) for (const sz of [-1, 1]) G.cyl(-w / 2 + 1.2 * s + i * (w - 2.4 * s) / 7, 1.5 * s, sz * (d / 2 - 1.2 * s), 0.95 * s, 0.8 * s, H, c, { n: 10 });
	for (let i = 1; i < 16; i++) for (const sx of [-1, 1]) if (i % 3) G.cyl(sx * (w / 2 - 1.2 * s), 1.5 * s, -d / 2 + 1.2 * s + i * (d - 2.4 * s) / 16, 0.95 * s, 0.8 * s, H * (i % 4 ? 1 : 0.6), c, { n: 10 });
	G.box(0, 1.5 * s + H, -d / 2 + 4 * s, w, 3.2 * s, 6 * s, c).gable(0, 4.7 * s + H, -d / 2 + 4 * s, 6 * s, w, 3.5 * s, c, { r: Math.PI / 2, o: 0.2, gc: c });
	G.box(0, 1.5 * s + H, d / 2 - 4 * s, w, 3.2 * s, 6 * s, c);
	B.solid.push([0, 0, w + 4, d + 4, 0]);
};
R.castle = (B, s = 1, wall = [0.88, 0.86, 0.8], roof = [0.3, 0.38, 0.48]) => {
	const { G } = B;
	G.box(0, 0, 0, 40 * s, 22 * s, 16 * s, wall).gable(0, 22 * s, 0, 40 * s, 16 * s, 8 * s, roof, { o: 0.5, gc: wall });
	for (const [x, z, r, h] of [[-22, -6, 4, 42], [22, 6, 3.4, 36], [-8, 10, 3, 30], [16, -9, 5, 52]]) { G.cyl(x * s, 0, z * s, r * s, r * s, h * s, wall, { n: 12 }).cone(x * s, h * s, z * s, r * 1.2 * s, r * 3 * s, roof, 12); B.solid.push([x * s, z * s, r * 2 * s, r * 2 * s, 0]); }
	for (let i = 0; i < 6; i++) for (let f = 0; f < 3; f++) G.box(-17 * s + i * 7 * s, 5 * s + f * 6 * s, -8.05 * s, 1.4 * s, 2.6 * s, 0.1, DARK);
	B.solid.push([0, 0, 40 * s, 16 * s, 0]);
};
R.cathedral = (B, s = 1, c = [0.78, 0.7, 0.58]) => {
	const { G } = B;
	G.box(0, 0, 0, 90 * s, 45 * s, 60 * s, c);
	for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = (i % 2 ? 26 : 18) * s, h = (i % 2 ? 100 : 80) * s; G.cyl(Math.cos(a) * rr, 40 * s, Math.sin(a) * rr, 4 * s, 1 * s, h, c, { n: 10 }); }
	G.cyl(0, 40 * s, 0, 10 * s, 1.5 * s, 130 * s, c, { n: 12 }).cyl(0, 170 * s, 0, 2 * s, 0.2, 10 * s, [0.9, 0.85, 0.7], { n: 6 });
	for (let i = 0; i < 4; i++) G.cyl(-30 * s + i * 20 * s, 0, -30 * s, 3.5 * s, 1 * s, 105 * s, c, { n: 10 });
	B.solid.push([0, 0, 90 * s, 60 * s, 0]);
};
// onion-domed church: a cluster of drums, each with its own bright onion
R.onion = (B, s = 1) => {
	const { G } = B, base = [0.68, 0.2, 0.16], CS = [[0.15, 0.5, 0.35], [0.85, 0.65, 0.2], [0.2, 0.4, 0.75], [0.8, 0.25, 0.2], [0.9, 0.9, 0.85], [0.35, 0.6, 0.3], [0.85, 0.45, 0.2], [0.2, 0.55, 0.6]];
	G.box(0, 0, 0, 40 * s, 12 * s, 40 * s, base);
	G.cyl(0, 12 * s, 0, 7 * s, 5 * s, 34 * s, base, { n: 8 }).cone(0, 46 * s, 0, 5.5 * s, 10 * s, [0.85, 0.75, 0.35], 8);
	for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = 14 * s, h = (i % 2 ? 18 : 24) * s; G.cyl(Math.cos(a) * rr, 12 * s, Math.sin(a) * rr, 3.4 * s, 3 * s, h, base, { n: 8 }).dome(Math.cos(a) * rr, (12 + h / s) * s, Math.sin(a) * rr, 4 * s, CS[i], { bulge: 0.6, n: 10, rings: 6, tip: 3 * s }); }
	B.solid.push([0, 0, 40 * s, 40 * s, 0]);
};
// a white marble mausoleum on its plinth: the great dome, four chhatris, four minarets
R.mausoleum = (B, s = 1) => {
	const { G } = B, c = [0.95, 0.94, 0.9];
	G.box(0, 0, 0, 95 * s, 7 * s, 95 * s, c);
	G.box(0, 7 * s, 0, 57 * s, 30 * s, 57 * s, c);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(sx * 22 * s, 7 * s, sz * 22 * s, 13 * s, 30 * s, 13 * s, [0.93, 0.92, 0.88]);
	for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; G.arch(Math.sin(a) * 28.6 * s, 9 * s, Math.cos(a) * 28.6 * s, 16 * s, 24 * s, 1 * s, [0.75, 0.72, 0.66], { r: a }); }
	G.cyl(0, 37 * s, 0, 15 * s, 15 * s, 8 * s, c, { n: 16 }).dome(0, 45 * s, 0, 17 * s, c, { bulge: 0.35, n: 18, rings: 7, tip: 8 * s });
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) { G.cyl(sx * 18 * s, 37 * s, sz * 18 * s, 4 * s, 4 * s, 5 * s, c, { n: 8 }).dome(sx * 18 * s, 42 * s, sz * 18 * s, 4.5 * s, c, { k: 1, n: 8, rings: 3 }); G.cyl(sx * 44 * s, 7 * s, sz * 44 * s, 2.6 * s, 2 * s, 40 * s, c, { n: 10 }).dome(sx * 44 * s, 47 * s, sz * 44 * s, 2.8 * s, c, { n: 8, rings: 3 }); }
	B.solid.push([0, 0, 95 * s, 95 * s, 0]);
};
// a round hall of three blue roofs on three white terraces
R.roundtemple = (B, s = 1) => {
	const { G } = B, white = [0.94, 0.93, 0.9], blue = [0.15, 0.3, 0.55], red = [0.62, 0.12, 0.1];
	for (let k = 0; k < 3; k++) G.cyl(0, k * 2 * s, 0, (45 - k * 7) * s, (45 - k * 7) * s, 2 * s, white, { n: 24 });
	let y = 6 * s;
	for (let k = 0; k < 3; k++) { const r = (16 - k * 4) * s; G.cyl(0, y, 0, r, r, 5 * s, red, { n: 16 }); G.cyl(0, y + 5 * s, 0, r + 4 * s, r * 0.7, 3.5 * s, blue, { n: 16 }); y += 8.5 * s; }
	G.dome(0, y, 0, 3 * s, [0.85, 0.7, 0.3], { k: 1.4, n: 10, rings: 4 });
	B.solid.push([0, 0, 50 * s, 50 * s, 0]);
};
// a palace hall on a white marble terrace, red walls, a yellow glazed double roof
R.palace = (B, s = 1, roof = [0.88, 0.68, 0.2], wall = [0.62, 0.12, 0.1]) => {
	const { G } = B;
	for (let k = 0; k < 3; k++) G.box(0, k * 2.5 * s, 0, (130 - k * 12) * s, 2.5 * s, (80 - k * 10) * s, [0.92, 0.91, 0.88]);
	G.box(0, 7.5 * s, 0, 64 * s, 16 * s, 34 * s, wall);
	G.hip(0, 23.5 * s, 0, 66 * s, 36 * s, 4 * s, roof, { o: 4 * s, k: 0.2, curl: 1.5 * s });
	G.box(0, 27.5 * s, 0, 56 * s, 5 * s, 28 * s, wall).hip(0, 32.5 * s, 0, 58 * s, 30 * s, 10 * s, roof, { o: 4 * s, k: 0.25, curl: 1.5 * s });
	for (const sx of [-1, 1]) G.box(sx * 120 * s, 0, 0, 6 * s, 10 * s, 260 * s, wall);
	B.solid.push([0, 0, 130 * s, 80 * s, 0]);
};
// a stretch of a great wall over the ridges, its watchtowers
R.greatwall = (B, s = 1, a, r, ground) => {
	const { G } = B, c = [0.6, 0.58, 0.52];
	let px = -400, pz = 0, py = ground(px, pz);
	for (let k = 1; k <= 40; k++) {
		const x = -400 + k * 20, z = Math.sin(k * 0.3) * 40 + Math.sin(k * 0.11) * 60, y = ground(x, z);
		const a = Math.atan2(z - pz, x - px), L = Math.hypot(x - px, z - pz);
		G.beam(px, py + 3, pz, x, y + 3, z, 6.5 * s, c);
		for (const sd of [-1, 1]) G.beam(px - Math.sin(a) * 3 * sd, py + 6.8, pz + Math.cos(a) * 3 * sd, x - Math.sin(a) * 3 * sd, y + 6.8, z + Math.cos(a) * 3 * sd, 0.9, [0.56, 0.54, 0.48]);
		B.solid.push([(px + x) / 2, (pz + z) / 2, L + 1, 7, -a, Math.min(py, y) - 2]);
		if (k % 8 === 0) { G.box(x, y - 2, z, 11, 14, 11, c).box(x, y + 12, z, 7, 4, 7, [0.55, 0.52, 0.46]); B.solid.push([x, z, 11, 11, 0, y - 2]); }
		px = x; pz = z; py = y;
	}
};
R.goldpavilion = (B, s = 1) => {
	const { G } = B, gold = [0.92, 0.74, 0.3];
	G.box(0, 0, 0, 18 * s, 4.5 * s, 14 * s, [0.85, 0.82, 0.74]);
	G.hip(0, 4.5 * s, 0, 18 * s, 14 * s, 0.6 * s, [0.3, 0.24, 0.2], { o: 1.2 * s, k: 0.3, curl: 0.3 });
	G.box(0, 5.4 * s, 0, 17 * s, 4 * s, 13 * s, gold).hip(0, 9.4 * s, 0, 17 * s, 13 * s, 0.6 * s, [0.3, 0.24, 0.2], { o: 1 * s, k: 0.3, curl: 0.3 });
	G.box(0, 10.3 * s, 0, 10 * s, 3.6 * s, 10 * s, gold).hip(0, 13.9 * s, 0, 10 * s, 10 * s, 3 * s, [0.3, 0.24, 0.2], { o: 1.2 * s, k: 0.5, curl: 0.4 });
	G.box(0, 17 * s, 0, 0.6 * s, 1.4 * s, 0.6 * s, gold);
	G.slab(0, -0.3, 0, 120 * s, 70 * s, 0.25, [0.22, 0.32, 0.34]);
	B.solid.push([0, 0, 18 * s, 14 * s, 0]);
};
// an avenue of vermilion gates up the hill
R.torii = (B, s = 1, a, r, ground) => { for (let k = 0; k < 18; k++) { const z = -k * 3.2; const y = ground(0, z) - ground(0, 0); B.G.oy += y; S.torii(B, {}, {}, () => 0.5, 0, z, 0.9 * s); B.G.oy -= y; } };
R.pagoda5 = (B, s = 1) => { S.pagoda(B, {}, { stone: [0.55, 0.54, 0.52], roof: [0.3, 0.32, 0.34], templeRoof: [0.3, 0.32, 0.34], japan: true }, () => 0.1); B.G.box(0, 0, 0, 0.01, 0.01, 0.01, DARK); void s; };
R.japancastle = (B, s = 1) => {
	const { G } = B, white = [0.95, 0.95, 0.93], roof = [0.32, 0.36, 0.4];
	G.box(0, 0, 0, 40 * s, 14 * s, 32 * s, [0.55, 0.53, 0.5]);
	let y = 14 * s, w = 30 * s, d = 22 * s;
	for (let k = 0; k < 5; k++) { G.box(0, y, 0, w, 5.5 * s, d, white); G.hip(0, y + 5.5 * s, 0, w + 2 * s, d + 2 * s, 2.4 * s, roof, { o: 1.4 * s, k: 0.4, curl: 0.8 * s }); y += 7.5 * s; w *= 0.84; d *= 0.84; }
	B.solid.push([0, 0, 40 * s, 32 * s, 0]);
};
// a Khmer temple: three rising terraces, five lotus-bud towers in a quincunx
R.khmer = (B, s = 1) => {
	const { G } = B, c = [0.55, 0.52, 0.45];
	for (let k = 0; k < 3; k++) G.box(0, k * 9 * s, 0, (190 - k * 50) * s, 9 * s, (180 - k * 48) * s, k % 2 ? c : [0.6, 0.57, 0.5]);
	const tower = (x, z, h) => { for (let k = 0; k < 8; k++) { const r = (9 - k * 1.05) * s; G.cyl(x, 27 * s + k * h / 8, z, r, r * 0.92, h / 8, c, { n: 8 }); } G.cone(x, 27 * s + h, z, 1.4 * s, 4 * s, c, 8); };
	tower(0, 0, 38 * s);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * 30 * s, sz * 28 * s, 26 * s);
	B.solid.push([0, 0, 190 * s, 180 * s, 0]);
	G.slab(0, -0.2, 0, 300 * s, 300 * s, 0.1, [0.25, 0.35, 0.35]);
};
// a great stupa mound: square terraces stepping up, rings of small stupas, the great stupa on top
R.stupamound = (B, s = 1) => {
	const { G } = B, c = [0.5, 0.48, 0.44];
	for (let k = 0; k < 6; k++) G.box(0, k * 3.5 * s, 0, (118 - k * 14) * s, 3.5 * s, (118 - k * 14) * s, k % 2 ? c : [0.55, 0.53, 0.48]);
	for (let k = 0; k < 3; k++) { const rr = (24 - k * 7) * s, n = [32, 24, 16][k]; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; G.dome(Math.cos(a) * rr, 21 * s + k * 2.4 * s, Math.sin(a) * rr, 1.8 * s, c, { k: 1.3, n: 6, rings: 3, tip: 1.2 * s }); } }
	G.dome(0, 28 * s, 0, 8 * s, c, { k: 1, n: 12, rings: 4 }).cyl(0, 36 * s, 0, 1.2 * s, 0.3 * s, 6 * s, c, { n: 6 });
	B.solid.push([0, 0, 118 * s, 118 * s, 0]);
};
// a golden zedi: a bell-shaped stupa tapering to a spire, gilded, on terraces
R.zedi = (B, s = 1) => {
	const { G } = B, gold = [0.9, 0.72, 0.3];
	for (let k = 0; k < 3; k++) G.box(0, k * 3 * s, 0, (70 - k * 14) * s, 3 * s, (70 - k * 14) * s, k === 0 ? [0.92, 0.9, 0.85] : gold);
	G.dome(0, 9 * s, 0, 22 * s, gold, { k: 1.25, n: 16, rings: 6 });
	for (let k = 0; k < 12; k++) G.cyl(0, (36 + k * 5) * s, 0, (8 - k * 0.6) * s, (7.4 - k * 0.6) * s, 5 * s, gold, { n: 12 });
	G.cyl(0, 96 * s, 0, 1 * s, 0.1, 10 * s, gold, { n: 6, top: false });
	B.solid.push([0, 0, 70 * s, 70 * s, 0]);
};
R.prang = (B, s = 1) => { const { G } = B, c = [0.88, 0.85, 0.78]; G.box(0, 0, 0, 40 * s, 8 * s, 40 * s, c); for (let k = 0; k < 10; k++) { const r = (12 - k * 1.1) * s; G.cyl(0, 8 * s + k * 6 * s, 0, r, r * 0.92, 6 * s, k % 2 ? c : [0.82, 0.78, 0.7], { n: 8 }); } G.cone(0, 68 * s, 0, 1.5 * s, 10 * s, [0.8, 0.7, 0.4], 8); B.solid.push([0, 0, 40 * s, 40 * s, 0]); };
R.potala = (B, s = 1) => {
	const { G } = B, white = [0.94, 0.92, 0.86], red = [0.55, 0.12, 0.1], gold = [0.88, 0.7, 0.28];
	G.box(0, -20, 0, 360 * s, 40 * s + 20, 60 * s, white, { r: 0 });
	G.box(-40 * s, 20 * s, 0, 150 * s, 40 * s, 50 * s, white).box(10 * s, 20 * s, 0, 90 * s, 60 * s, 45 * s, red);
	for (let i = 0; i < 12; i++) for (let f = 0; f < 8; f++) G.box(-150 * s + i * 25 * s, 4 * s + f * 9 * s, -30.1 * s, 3 * s, 4 * s, 0.2, DARK);
	for (let i = 0; i < 4; i++) G.hip(-20 * s + i * 18 * s, 80 * s, 0, 10 * s, 10 * s, 4 * s, gold, { o: 1.5 * s, k: 0.3, curl: 0.6 * s });
	B.solid.push([0, 0, 360 * s, 60 * s, 0]);
};
// three madrasas round a square: tall gateways (iwans) with tiled arches, blue ribbed domes
R.registan = (B, s = 1) => {
	const { G } = B, c = [0.82, 0.72, 0.56], blue = [0.12, 0.42, 0.62];
	G.slab(0, 0, 0, 120 * s, 120 * s, 0.3, [0.75, 0.68, 0.56]);
	for (const [x, z, rot] of [[-50, 0, Math.PI / 2], [50, 0, -Math.PI / 2], [0, -50, 0]]) {
		const cs = Math.cos(rot), sn = Math.sin(rot), q = (a, b) => [x * s + a * cs + b * sn, z * s - a * sn + b * cs];
		const [px, pz] = q(0, -14 * s);
		G.box(px, 0, pz, Math.abs(cs) > 0.5 ? 70 * s : 30 * s, 18 * s, Math.abs(cs) > 0.5 ? 30 * s : 70 * s, c);
		const [gx, gz] = q(0, 0);
		G.box(gx, 0, gz, Math.abs(cs) > 0.5 ? 30 * s : 6 * s, 35 * s, Math.abs(cs) > 0.5 ? 6 * s : 30 * s, c);
		G.arch(gx + sn * -3.1 * s, 2 * s, gz + cs * -3.1 * s, 16 * s, 26 * s, 1.5 * s, blue, { r: rot });
		for (const sd of [-1, 1]) { const [mx, mz] = q(sd * 34 * s, 0); G.cyl(mx, 0, mz, 3 * s, 2.6 * s, 34 * s, c, { n: 10 }); }
		const [dx, dz] = q(18 * s, -20 * s); G.cyl(dx, 18 * s, dz, 7 * s, 7 * s, 6 * s, c, { n: 14 }).dome(dx, 24 * s, dz, 8 * s, blue, { bulge: 0.3, n: 14, rings: 5 });
		B.solid.push([px, pz, Math.abs(cs) > 0.5 ? 70 * s : 30 * s, Math.abs(cs) > 0.5 ? 30 * s : 70 * s, 0]);
	}
};
R.minaret = (B, s = 1, c = [0.78, 0.66, 0.5]) => { const { G } = B; G.cyl(0, 0, 0, 4.5 * s, 3 * s, 45 * s, c, { n: 14 }); for (let k = 0; k < 5; k++) G.cyl(0, (6 + k * 8) * s, 0, 4.4 * s - k * 0.28 * s, 4.3 * s - k * 0.28 * s, 1.2 * s, [0.6, 0.5, 0.38], { n: 14, top: false }); G.cyl(0, 45 * s, 0, 4 * s, 4 * s, 4 * s, c, { n: 14 }).dome(0, 49 * s, 0, 3 * s, c, { n: 10, rings: 3 }); B.solid.push([0, 0, 9 * s, 9 * s, 0]); };
R.rockfacade = (B, s = 1) => {
	const { G } = B, c = [0.78, 0.45, 0.36];
	G.box(0, -2, 10 * s, 80 * s, 70 * s, 20 * s, [0.72, 0.4, 0.32]);
	G.box(0, 0, -0.5 * s, 25 * s, 40 * s, 1 * s, c);
	for (let i = 0; i < 6; i++) G.cyl(-10 * s + i * 4 * s, 0, -1.5 * s, 0.7 * s, 0.7 * s, 12 * s, c, { n: 8 });
	G.box(0, 12 * s, -1.4 * s, 25 * s, 3 * s, 2 * s, c);
	G.gable(0, 15 * s, -1.4 * s, 25 * s, 2 * s, 3 * s, c, { o: 0.2 });
	G.cyl(0, 20 * s, -1.5 * s, 3 * s, 3 * s, 10 * s, c, { n: 10 }).cone(0, 30 * s, -1.5 * s, 3 * s, 3 * s, c, 10);
	G.face([[-1.8 * s, 0, -2.1 * s], [1.8 * s, 0, -2.1 * s], [1.8 * s, 8 * s, -2.1 * s], [-1.8 * s, 8 * s, -2.1 * s]], DARK);
	B.solid.push([0, 10 * s, 80 * s, 20 * s, 0]);
};
// a church cut down into the rock in the shape of a cross, in its trench
R.rockchurch = (B, s = 1) => {
	const { G } = B, c = [0.62, 0.42, 0.3];
	for (const [w, d] of [[25, 8], [8, 25]]) G.box(0, -12 * s, 0, w * s, 12 * s, d * s, c);
	for (let k = 0; k < 3; k++) G.box(0, -0.3, 0, (8 - k * 2) * s, 0.3 + k * 0.1, (25 - k * 3) * s, [0.66, 0.46, 0.33]);
	for (const sd of [-1, 1]) { G.box(sd * 20 * s, -12 * s, 0, 2 * s, 12 * s, 40 * s, [0.55, 0.38, 0.28]); G.box(0, -12 * s, sd * 20 * s, 40 * s, 12 * s, 2 * s, [0.55, 0.38, 0.28]); }
	G.slab(0, -12 * s, 0, 40 * s, 40 * s, 0.1, [0.4, 0.3, 0.22]);
	for (const sd of [-1, 1]) { B.solid.push([0, sd * 20 * s, 40 * s, 2 * s, 0]); B.solid.push([sd * 20 * s, 0, 2 * s, 40 * s, 0]); }
};
R.stonewalls = (B, s = 1) => { const { G } = B, c = [0.58, 0.55, 0.5], n = 36; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; const p0 = [Math.cos(a0) * 50 * s, Math.sin(a0) * 40 * s], p1 = [Math.cos(a1) * 50 * s, Math.sin(a1) * 40 * s]; if (i === 5) continue; G.beam(p0[0], 5 * s, p0[1], p1[0], 5 * s, p1[1], 10 * s, c); B.solid.push([(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), 5 * s, -Math.atan2(p1[1] - p0[1], p1[0] - p0[0])]); } G.cone(20 * s, 0, 10 * s, 3 * s, 10 * s, c, 10); };
// a monolith rising sheer from the plain: an elliptical dome, its sides steep, its top rounded
R.monolith = (B, s = 1) => {
	const { G } = B, n = 32, rings = [[1, 0], [0.98, 0.25], [0.93, 0.55], [0.84, 0.8], [0.66, 0.95], [0.36, 1]], A = 1800 * s, C = 950 * s, H = 348 * s;
	for (let k = 0; k + 1 < rings.length; k++) {
		const [ra, ya] = rings[k], [rb, yb] = rings[k + 1];
		for (let i = 0; i < n; i++) {
			const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2, c = [0.74 - k * 0.02, 0.34 - k * 0.01, 0.2];
			G.face([[Math.cos(b) * A * ra, ya * H - 5, Math.sin(b) * C * ra], [Math.cos(a) * A * ra, ya * H - 5, Math.sin(a) * C * ra], [Math.cos(a) * A * rb, yb * H - 5, Math.sin(a) * C * rb], [Math.cos(b) * A * rb, yb * H - 5, Math.sin(b) * C * rb]], c);
		}
	}
	B.solid.push([0, 0, A * 1.8, C * 1.8, 0]);
};
// sails: the shell vaults of the opera house over its podium
R.sails = (B, s = 1) => {
	const { G } = B, white = [0.95, 0.94, 0.9];
	G.box(0, 0, 0, 180 * s, 6 * s, 120 * s, [0.72, 0.62, 0.5]);
	for (const [x, z, h, rot] of [[-50, -25, 60, 0], [-20, -25, 50, 0], [10, -25, 40, 0], [-50, 25, 55, 0], [-22, 25, 45, 0], [8, 25, 35, 0], [60, 0, 25, Math.PI]]) {
		for (let k = 0; k < 8; k++) { const t0 = k / 8, t1 = (k + 1) / 8, w0 = (14 - t0 * 14) * s, w1 = (14 - t1 * 14) * s, x0 = x * s + Math.sin(t0 * 1.3) * 30 * s * Math.cos(rot), x1 = x * s + Math.sin(t1 * 1.3) * 30 * s * Math.cos(rot), y0 = 6 * s + Math.sin(t0 * Math.PI * 0.55) * h * s, y1 = 6 * s + Math.sin(t1 * Math.PI * 0.55) * h * s; G.face([[x0, y0, z * s - w0], [x1, y1, z * s - w1], [x1, y1, z * s + w1], [x0, y0, z * s + w0]], white); }
	}
	B.solid.push([0, 0, 180 * s, 120 * s, 0]);
};
// a figure on a pedestal: arms out (a statue of welcome), or a single raised arm with a torch
R.statue = (B, s = 1, a = {}) => {
	const { G } = B, c = a?.c || [0.9, 0.9, 0.86], pose = a?.pose || 'open';
	G.box(0, 0, 0, 10 * s, 8 * s, 10 * s, [0.6, 0.58, 0.54]);
	G.cyl(0, 8 * s, 0, 3.2 * s, 1.8 * s, 22 * s, c, { n: 10 });
	G.dome(0, 30 * s, 0, 1.6 * s, c, { k: 1.3, n: 8, rings: 4 });
	if (pose === 'open') G.box(0, 26 * s, 0, 28 * s, 2 * s, 1.6 * s, c);
	else { G.beam(1.6 * s, 26 * s, 0, 3 * s, 36 * s, 0, 1.2 * s, c); G.cyl(3 * s, 36 * s, 0, 0.8 * s, 1 * s, 2 * s, [0.85, 0.7, 0.3], { n: 8 }); G.cone(0, 31.5 * s, 0, 2.2 * s, 1.4 * s, c, 9); }
	B.solid.push([0, 0, 10 * s, 10 * s, 0]);
};
R.moai = (B, s = 1) => { const { G } = B; G.box(0, -0.5, 0, 98 * s, 3 * s, 8 * s, [0.42, 0.4, 0.38]); for (let i = 0; i < 15; i++) { const x = -45 * s + i * 6.4 * s, h = (6 + (i * 7 % 5)) * s; G.box(x, 2.5 * s, 0, 3 * s, h, 2.4 * s, [0.38, 0.33, 0.3]).box(x, 2.5 * s + h * 0.62, -1.3 * s, 1 * s, h * 0.3, 0.6 * s, [0.34, 0.3, 0.27]); if (i % 4 === 0) G.cyl(x, 2.5 * s + h, 0, 1.3 * s, 1.3 * s, 1.6 * s, [0.6, 0.3, 0.22], { n: 8 }); } B.solid.push([0, 0, 98 * s, 8 * s, 0]); };
R.clocktower = (B, s = 1) => { const { G } = B, c = [0.82, 0.74, 0.55]; G.box(0, 0, 0, 12 * s, 60 * s, 12 * s, c); G.box(0, 60 * s, 0, 13 * s, 12 * s, 13 * s, c); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; G.cyl(Math.sin(a) * 6.6 * s, 66 * s, Math.cos(a) * 6.6 * s, 3.4 * s, 3.4 * s, 0.1, [0.95, 0.93, 0.85], { n: 14 }); } B.glow?.box(0, 63 * s, 0, 13.4 * s, 6 * s, 13.4 * s, [0.9, 0.8, 0.5]); G.hip(0, 72 * s, 0, 13 * s, 13 * s, 22 * s, [0.3, 0.32, 0.34], { o: 0.5 }); B.solid.push([0, 0, 12 * s, 12 * s, 0]); };
R.needle = (B, s = 1) => { const { G } = B, c = [0.7, 0.75, 0.8]; let y = 0; for (let k = 0; k < 9; k++) { const w = (40 - k * 4.2) * s, h = (k < 8 ? 70 : 200) * s; for (let p = 0; p < 3; p++) { const a = p / 3 * Math.PI * 2; G.box(Math.cos(a) * w * 0.4, y, Math.sin(a) * w * 0.4, w * (k < 8 ? 0.6 : 0.15), h, w * (k < 8 ? 0.6 : 0.15), c, { r: a }); } y += h * 0.8; } G.box(0, 0, 0, 30 * s, y * 0.9, 30 * s, [0.62, 0.68, 0.74]); B.solid.push([0, 0, 50 * s, 50 * s, 0]); };
R.leaning = (B, s = 1) => { const { G } = B, c = [0.92, 0.9, 0.84], tilt = 0.07; for (let k = 0; k < 8; k++) { const y = k * 7 * s, dx = Math.sin(tilt) * y; G.cyl(dx, y, 0, 8 * s, 8 * s, 7 * s, c, { n: 18 }); G.cyl(dx, y + 6.2 * s, 0, 8.6 * s, 8.6 * s, 0.6 * s, [0.85, 0.83, 0.76], { n: 18, top: false }); } B.solid.push([0, 0, 16 * s, 16 * s, 0]); };
R.roundtower = (B, s = 1) => { const { G } = B, c = [0.62, 0.55, 0.45]; G.cyl(0, 0, 0, 8 * s, 8 * s, 52 * s, c, { n: 16 }).cyl(0, 52 * s, 0, 9 * s, 9 * s, 2 * s, [0.5, 0.45, 0.38], { n: 16 }).cone(0, 54 * s, 0, 8.5 * s, 13 * s, [0.3, 0.3, 0.32], 16); B.solid.push([0, 0, 16 * s, 16 * s, 0]); };
R.vault = (B, s = 1) => { const { G } = B; G.box(0, -2, 10 * s, 60 * s, 30 * s, 40 * s, [0.42, 0.42, 0.4]); G.face([[-4 * s, 0, -10 * s], [4 * s, 0, -10 * s], [4 * s, 12 * s, 0], [-4 * s, 12 * s, 0]], [0.75, 0.75, 0.74]); G.box(0, 0, -5 * s, 8 * s, 12 * s, 10 * s, [0.6, 0.6, 0.6]); B.glow?.face([[-3.6 * s, 2 * s, -10.2 * s], [3.6 * s, 2 * s, -10.2 * s], [3.6 * s, 6 * s, -6 * s], [-3.6 * s, 6 * s, -6 * s]], [0.3, 0.75, 0.9]); B.solid.push([0, 0, 8 * s, 10 * s, 0]); };
R.mast = (B, s = 1) => { const { G } = B; for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.beam(sx * (3 - k * 0.5), k * 7, sz * (3 - k * 0.5), sx * (2.5 - k * 0.5), (k + 1) * 7, sz * (2.5 - k * 0.5), 0.3, [0.35, 0.32, 0.3]); G.box(0, 35, 0, 1.2, 3, 1.2, [0.35, 0.32, 0.3]); B.solid.push([0, 0, 6, 6, 0]); void s; };
R.igloochurch = (B, s = 1) => { const { G } = B; G.dome(0, 0, 0, 14 * s, [0.95, 0.95, 0.94], { k: 1.1, n: 18, rings: 6 }); G.box(0, 15 * s, 0, 0.5, 4 * s, 0.5, [0.85, 0.85, 0.85]).box(0, 17.5 * s, 0, 2 * s, 0.5, 0.5, [0.85, 0.85, 0.85]); B.solid.push([0, 0, 26 * s, 26 * s, 0]); };
R.stepchurch = (B, s = 1) => { const { G } = B, c = [0.82, 0.82, 0.8]; for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) G.box(sd * (4 + k * 2.2) * s, 0, 0, 2.2 * s, (70 - k * 9) * s, 8 * s, c); G.box(0, 0, 0, 8 * s, 74 * s, 8 * s, c).hip(0, 74 * s, 0, 8 * s, 8 * s, 6 * s, c, { o: 0.2 }); G.box(0, 0, 25 * s, 20 * s, 22 * s, 40 * s, c).gable(0, 22 * s, 25 * s, 40 * s, 20 * s, 10 * s, c, { r: Math.PI / 2, gc: c }); B.solid.push([0, 10 * s, 36 * s, 60 * s, 0]); };
R.arcticcathedral = (B, s = 1) => { const { G } = B, c = [0.95, 0.95, 0.94]; for (let k = 0; k < 11; k++) { const z = -18 * s + k * 3.6 * s, h = (35 - k * 2.2) * s, w = (24 - k * 1.2) * s; G.face([[-w / 2, 0, z], [w / 2, 0, z], [0, h, z + 0.4]], c).face([[w / 2, 0, z + 3.6 * s], [-w / 2, 0, z + 3.6 * s], [0, h, z + 3.2 * s]], c).face([[-w / 2, 0, z], [0, h, z + 0.4], [0, h, z + 3.2 * s], [-w / 2, 0, z + 3.6 * s]], c).face([[w / 2, 0, z + 3.6 * s], [0, h, z + 3.2 * s], [0, h, z + 0.4], [w / 2, 0, z]], c); } B.glow?.face([[-8 * s, 2 * s, -18.2 * s], [8 * s, 2 * s, -18.2 * s], [0, 30 * s, -17.8 * s]], [0.5, 0.65, 0.9]); B.solid.push([0, 0, 26 * s, 40 * s, 0]); };

// ---------- the real landmarks ----------
// [name, lat, lon, builder, scale, bearing of its front (deg), what people say of it, extra args]
export const REAL = [
	['Hagia Sophia', 41.0086, 28.9802, 'mosque', 2.0, 0, 'Fifteen centuries old: a church, then a mosque, then a museum, and a mosque again. The dome looks like it floats.', { mosque: 'ottoman' }],
	['the Blue Mosque', 41.0054, 28.9768, 'mosque', 1.9, 0, 'Six minarets and blue tiles inside. Shoes off, quiet voices, and it\'s closed to visitors at prayer times.', { mosque: 'ottoman' }],
	['the Galata Tower', 41.0256, 28.9741, 'roundtower', 1, 0, 'The old stone tower over Karaköy. Everyone climbs it once for the view across the Golden Horn.'],
	['the Great Pyramid of Giza', 29.9792, 31.1342, 'pyramid', 1, 0, 'Four and a half thousand years old, and still the one everyone comes to see.'],
	['the Pyramid of Khafre', 29.9761, 31.1308, 'pyramid', 0.97, 0, 'You can still see the old casing stones at its top.'],
	['the Pyramid of Menkaure', 29.9725, 31.1281, 'pyramid', 0.47, 0, 'The smallest of the three, and the quietest.'],
	['the Treasury at Petra', 30.3222, 35.4516, 'rockfacade', 1, 0, 'Carved straight out of the rose-red cliff by the Nabataeans. Come down the Siq in the early morning.'],
	['the Taj Mahal', 27.1751, 78.0421, 'mausoleum', 1, 180, 'Built by an emperor for his wife. At sunrise the marble goes pink, then gold.'],
	['the Golden Temple', 31.62, 74.8765, 'goldtemple', 1, 0, 'Everyone is welcome to eat at the langar, the free kitchen, whoever you are. Cover your head inside.'],
	['the Forbidden City', 39.9163, 116.3972, 'palace', 1, 180, 'The emperors\' palace. Nine thousand rooms, they say, and yellow roofs only the emperor could have.'],
	['the Temple of Heaven', 39.8822, 116.4066, 'roundtemple', 1, 180, 'Where the emperors prayed for good harvests. In the mornings the park is full of tai chi and singing.'],
	['the Great Wall at Badaling', 40.3587, 116.0204, 'greatwall', 1, 0, 'It runs over the ridges as far as you can see. Go early, it gets crowded.'],
	['the Great Wall at Mutianyu', 40.4319, 116.5704, 'greatwall', 1, 0, 'Quieter than Badaling, with watchtowers every few hundred metres.'],
	['Kinkaku-ji', 35.0394, 135.7292, 'goldpavilion', 1, 180, 'The Golden Pavilion, reflected in its pond. It\'s even better in the snow.'],
	['Fushimi Inari', 34.9671, 135.7727, 'torii', 1, 180, 'Thousands of vermilion gates up the mountain, each given by someone in thanks.'],
	['Sensō-ji', 35.7148, 139.7967, 'pagoda5', 1.1, 180, 'Tokyo\'s oldest temple. Waft the incense smoke over you for good health.'],
	['Tokyo Tower', 35.6586, 139.7454, 'lattice', 1.1, 0, 'Red and white, and lit up orange at night.', { c: [0.85, 0.25, 0.12], c2: [0.95, 0.95, 0.93] }],
	['Himeji Castle', 34.8394, 134.6939, 'japancastle', 1, 180, 'The White Heron castle. It survived the wars and the earthquakes.'],
	['the Eiffel Tower', 48.8584, 2.2945, 'lattice', 1, 0, 'They wanted to pull it down after the fair. Now it sparkles every hour at night.'],
	['the Colosseum', 41.8902, 12.4922, 'colosseum', 1, 0, 'Fifty thousand people once sat here. The cats have it now.'],
	['the Parthenon', 37.9715, 23.7267, 'greektemple', 1, 0, 'On the Acropolis for two and a half thousand years. The marble glows at sunset.'],
	['Neuschwanstein', 47.5576, 10.7498, 'castle', 1, 0, 'The fairy-tale castle of a king who loved the mountains and Wagner.'],
	['the Sagrada Família', 41.4036, 2.1744, 'cathedral', 1, 0, 'Gaudí\'s basilica, still being built after more than a century. The light inside is like a forest.'],
	['St Basil\'s Cathedral', 55.7525, 37.6231, 'onion', 1, 0, 'Every dome a different pattern and colour, on the edge of Red Square.'],
	['the Elizabeth Tower', 51.5007, -0.1246, 'clocktower', 1, 0, 'People call it Big Ben, but that\'s the bell.'],
	['the Leaning Tower of Pisa', 43.723, 10.3966, 'leaning', 1, 0, 'They have straightened it a little. Only a little.'],
	['Stonehenge', 51.1789, -1.8262, 'stonecircle', 2.2, 0, 'On midsummer morning the sun rises over the Heel Stone.'],
	['the Registan', 39.6547, 66.9758, 'registan', 1, 0, 'Three madrasas round the square, covered in blue tiles. At night they light it up.'],
	['the Kalyan Minaret', 39.7758, 64.415, 'minaret', 1, 0, 'Nearly nine hundred years old. Genghis Khan spared it, the story goes, because it made him look up.'],
	['the Shah Mosque in Isfahan', 32.6546, 51.6773, 'mosque', 1.6, 0, 'On the great square. Stand under the dome and clap: it echoes seven times.', { mosque: 'persian' }],
	['the Koutoubia', 31.6237, -7.9936, 'mosque', 1.3, 0, 'Its minaret is the landmark of Marrakesh; no building in the old city may be taller than a palm.', { mosque: 'maghreb' }],
	['the Great Mosque of Djenné', 13.9053, -4.5552, 'mudmosque', 1.5, 0, 'The biggest mud-brick building in the world. Every year the whole town replasters it together.'],
	['the Djinguereyber Mosque', 16.7706, -3.0102, 'mudmosque', 1.0, 0, 'Seven hundred years old, built of mud and wood in Timbuktu.'],
	['the Church of St George, Lalibela', 12.0317, 39.0411, 'rockchurch', 1, 0, 'Carved down into the rock in the shape of a cross, eight hundred years ago. Still a living church.'],
	['Great Zimbabwe', -20.2674, 30.9338, 'stonewalls', 1, 0, 'Stone walls built without mortar, the old capital the country is named for.'],
	['Angkor Wat', 13.4125, 103.867, 'khmer', 1, 270, 'Watch the sun come up behind the five towers, reflected in the pool.'],
	['Borobudur', -7.6079, 110.2038, 'stupamound', 1, 0, 'Walk round the terraces clockwise up to the top; the carvings tell the story as you go.'],
	['the Shwedagon Pagoda', 16.7983, 96.1497, 'zedi', 1, 0, 'Covered in gold and topped with diamonds. Walk round it clockwise, barefoot.'],
	['Wat Arun', 13.7437, 100.4889, 'prang', 1, 90, 'The Temple of Dawn on the river, covered in bits of porcelain that glitter.'],
	['the Potala Palace', 29.6578, 91.117, 'potala', 1, 180, 'The Dalai Lamas\' winter palace, a thousand rooms up the Red Hill. Walk slowly, it\'s high.'],
	['Boudhanath', 27.7215, 85.362, 'stupa', 3.2, 0, 'One of the biggest stupas in the world. People walk round it clockwise, spinning the prayer wheels.'],
	['Machu Picchu', -13.1631, -72.545, 'incaruin', 2.5, 0, 'The Inca city on the ridge. The stones fit so well a knife won\'t go between them.'],
	['Christ the Redeemer', -22.9519, -43.2105, 'statue', 1, 0, 'Arms open over the whole city. When the clouds come in you can\'t see him, then suddenly there he is.'],
	['Chichén Itzá', 20.6843, -88.5678, 'steppyramid', 1, 0, 'At the equinox the shadow of a serpent comes down the steps of El Castillo.'],
	['the Pyramid of the Sun', 19.6925, -98.8438, 'steppyramid', 2.6, 0, 'Teotihuacan\'s great pyramid. The Avenue of the Dead runs past it.'],
	['Ahu Tongariki', -27.1258, -109.2769, 'moai', 1, 0, 'Fifteen moai stand with their backs to the sea, watching over the island.'],
	['the Sydney Opera House', -33.8568, 151.2153, 'sails', 1, 0, 'Its roofs are like sails on the harbour. Tiles from Sweden, every one of them.'],
	['Uluru', -25.3444, 131.0369, 'monolith', 1, 0, 'A sacred place for the Anangu. The climb was closed in 2019; people walk round its base instead.'],
	['the Statue of Liberty', 40.6892, -74.0445, 'statue', 1.2, 0, 'Copper gone green, with her torch up over the harbour.', { c: [0.45, 0.65, 0.58], pose: 'torch' }],
	['the Burj Khalifa', 25.1972, 55.2744, 'needle', 1, 0, 'The tallest building in the world. At the top the sun sets a few minutes later than down here.'],
	['Hallgrímskirkja', 64.1417, -21.9266, 'stepchurch', 1, 180, 'Its front is shaped like the basalt columns of the coast.'],
	['the Arctic Cathedral', 69.6481, 18.9874, 'arcticcathedral', 1, 0, 'Like stacked ice. In the midnight sun the big window glows.'],
	['Zion Church', 69.2205, -51.0945, 'church-red', 1, 0, 'The red church by the icefjord, where the icebergs drift past the graves.'],
	['the Svalbard Global Seed Vault', 78.2357, 15.4913, 'vault', 1, 0, 'Seeds from the whole world kept frozen in the mountain, just in case.'],
	['Amundsen\'s airship mast', 78.9277, 11.9214, 'mast', 1, 0, 'The Norge left from this mast in 1926 and flew over the North Pole.'],
	['St Jude\'s Cathedral', 63.7483, -68.517, 'igloochurch', 1, 0, 'The igloo-shaped cathedral; the altar is a sled and the cross is made of narwhal tusks.'],
	['Ilulissat Icefjord', 69.165, -50.04, 'icefjord', 1, 0, 'The icebergs here come from the fastest glacier in the world. You can hear them crack.'],
	// the Las Vegas Strip, south to north, its resorts facing the boulevard; the Strat; Fremont Street
	['the Welcome to Fabulous Las Vegas sign', 36.082, -115.1728, 'vegassign', 1, 0, 'Everyone stops for a picture with it. The back has said Drive Carefully, Come Back Soon since 1959.'],
	['Mandalay Bay', 36.0919, -115.1762, 'casino', 1, 90, 'Gold glass all the way up, and a beach with a wave pool out the back.', { form: 'y', h: 145, c: [0.86, 0.68, 0.36], g: [0.55, 0.42, 0.2], neon: 'gold', neon2: 'red' }],
	['the Luxor', 36.0955, -115.1761, 'luxor', 1, 90, 'The beam off the top of the pyramid is the brightest light in Las Vegas. The moths love it.'],
	['the Excalibur', 36.0987, -115.1754, 'excalibur', 1, 90, 'The castle with the coloured turrets. Families come for the jousting dinner.'],
	['New York-New York', 36.1022, -115.1745, 'nyny', 1, 90, 'A whole Manhattan skyline, a roller coaster round it, and the Statue of Liberty out front.'],
	['the MGM Grand', 36.1024, -115.1696, 'casino', 1, 270, 'Emerald green glass. It was the biggest hotel in the world when it opened.', { form: 'tri', h: 90, w: 200, c: [0.3, 0.58, 0.42], g: [0.12, 0.3, 0.22], neon: 'green', neon2: 'gold' }],
	['Aria', 36.1073, -115.1766, 'casino', 1, 90, 'Silver glass curves in the middle of CityCenter.', { form: 'curve', h: 180, c: [0.62, 0.66, 0.7], g: [0.2, 0.24, 0.28], neon: 'white', neon2: 'blue' }],
	['the Bellagio', 36.1129, -115.1765, 'bellagio', 1, 90, 'After dark the fountains dance to music every fifteen minutes. Get a spot on the rail.', { form: 'curve', h: 150, c: [0.9, 0.84, 0.72], g: [0.4, 0.38, 0.34], neon: 'gold', neon2: 'white', lake: true }],
	['Paris Las Vegas', 36.1125, -115.1707, 'parislv', 1, 270, 'A half-size Eiffel Tower, with a full-size view of the Bellagio fountains from the top.'],
	['the Cosmopolitan', 36.1097, -115.1748, 'casino', 1, 90, 'Two dark glass towers, and a bar inside a three-storey chandelier.', { form: 'twin', h: 184, w: 160, c: [0.24, 0.26, 0.3], g: [0.1, 0.11, 0.14], neon: 'purple', neon2: 'pink' }],
	['Planet Hollywood', 36.11, -115.1696, 'casino', 1, 270, 'Its whole front is a wall of screens, and the Miracle Mile shops wrap round behind it.', { form: 'slab', h: 120, w: 190, c: [0.3, 0.3, 0.36], g: [0.14, 0.14, 0.2], neon: 'blue', neon2: 'white' }],
	['the Flamingo', 36.1162, -115.1697, 'casino', 1, 270, 'Pink neon feathers all down its front, and real flamingos in the garden out the back.', { form: 'slab', h: 90, w: 190, c: [0.95, 0.86, 0.86], g: [0.45, 0.32, 0.36], neon: 'pink', neon2: 'pink' }],
	['Caesars Palace', 36.1162, -115.1745, 'casino', 1, 90, 'Marble, columns and fountains. Everyone gets lost in the Forum Shops.', { form: 'slab', h: 120, w: 200, c: [0.94, 0.92, 0.88], g: [0.4, 0.44, 0.5], neon: 'white', neon2: 'blue' }],
	['the High Roller', 36.1176, -115.1681, 'wheel', 1, 270, 'Half an hour to go round. At night the whole rim lights up.'],
	['the Venetian', 36.1212, -115.1697, 'venetian', 1, 270, 'Canals indoors, gondoliers singing, and a painted sky that never gets dark.'],
	['the Sphere', 36.1208, -115.1622, 'sphere', 1, 270, 'The whole outside is a screen. Some nights it\'s a giant eyeball looking back at you.'],
	['the Wynn', 36.1265, -115.1657, 'casino', 1, 270, 'A bronze curve of a tower, quieter inside than the rest of the Strip.', { form: 'curve', h: 185, c: [0.55, 0.4, 0.26], g: [0.32, 0.22, 0.14], neon: 'gold', neon2: 'gold' }],
	['Treasure Island', 36.1247, -115.1747, 'casino', 1, 90, 'Gold glass in a Y, and the cove out front where the pirate ships used to fight.', { form: 'y', h: 110, c: [0.86, 0.7, 0.46], g: [0.42, 0.32, 0.2], neon: 'red', neon2: 'gold' }],
	['Encore', 36.1291, -115.165, 'casino', 1, 250, 'The Wynn\'s bronze twin, a little taller and a little quieter.', { form: 'curve', h: 190, c: [0.55, 0.4, 0.26], g: [0.32, 0.22, 0.14], neon: 'gold', neon2: 'gold' }],
	['Resorts World', 36.1333, -115.166, 'casino', 1, 60, 'Red towers, and a screen down the side bigger than any billboard on the Strip.', { form: 'twin', h: 200, w: 180, c: [0.55, 0.16, 0.14], g: [0.25, 0.08, 0.08], neon: 'red', neon2: 'white' }],
	['the Fontainebleau', 36.1366, -115.1612, 'casino', 1, 240, 'The tallest building in Nevada: a blue glass curve that stood half-finished for fifteen years.', { form: 'curve', h: 225, c: [0.4, 0.55, 0.7], g: [0.15, 0.25, 0.35], neon: 'blue', neon2: 'white' }],
	['the Sahara', 36.1424, -115.1574, 'casino', 1, 240, 'At the north end of the Strip since 1952, when all of this was sand.', { form: 'slab', h: 85, w: 160, c: [0.92, 0.88, 0.8], g: [0.3, 0.32, 0.36], neon: 'blue', neon2: 'white' }],
	['the Strat', 36.1475, -115.1566, 'strat', 1, 0, 'Three hundred and fifty metres up, and people pay to jump off the top on a wire.'],
	['Fremont Street', 36.1706, -115.1441, 'canopy', 1, 151.5, 'The whole ceiling of the canopy is a screen. Some of these casinos have been here since the forties.'],
];
// a few more builders by name (the shared structures where they serve)
R.mosque = (B, s, a) => S.mosque(B, {}, { wall: a?.mosque === 'ottoman' ? [0.88, 0.86, 0.8] : a?.mosque === 'persian' ? [0.82, 0.72, 0.56] : [0.82, 0.68, 0.5], stone: [0.6, 0.55, 0.48], mosque: a?.mosque, trim: [0.9, 0.9, 0.86], door: [0.35, 0.24, 0.16] }, () => 0.5, s);
R.mudmosque = (B, s) => S.mudmosque(B, {}, { mud: [0.72, 0.52, 0.34], stone: [0.55, 0.5, 0.45] }, () => 0.5, s);
R.stupa = (B, s) => { S.chorten(B, {}, {}, () => 0.5, 0, 0, s); B.G.box(0, 0, 0, 0.01, 0.01, 0.01, DARK); };
R.incaruin = (B, s) => { S.incaruin(B, {}, {}, () => 0.5); void s; };
const PAL = { trim: [0.92, 0.9, 0.86], door: [0.35, 0.24, 0.16], stone: [0.55, 0.53, 0.5], roof: [0.2, 0.2, 0.22], wood: [0.5, 0.36, 0.24], snow: 0 };
R['church-red'] = (B) => S['church-red'](B, {}, PAL, () => 0.5);
R.stonecircle = (B, s, a, r) => S.stonecircle(B, {}, PAL, r);
R.goldtemple = (B, s = 1) => { const { G } = B, gold = [0.9, 0.72, 0.3]; G.slab(0, -0.4, 0, 150 * s, 150 * s, 0.3, [0.92, 0.9, 0.86]); G.slab(0, -0.2, 0, 120 * s, 120 * s, 0.2, [0.25, 0.38, 0.42]); G.box(0, 0, 0, 3 * s, 0.6, 60 * s, [0.92, 0.9, 0.86]); G.box(0, 0, 0, 20 * s, 10 * s, 20 * s, [0.92, 0.9, 0.86]).box(0, 10 * s, 0, 18 * s, 8 * s, 18 * s, gold).dome(0, 18 * s, 0, 7 * s, gold, { bulge: 0.4, n: 14, rings: 5, tip: 3 * s }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.dome(sx * 8 * s, 18 * s, sz * 8 * s, 1.6 * s, gold, { bulge: 0.4, n: 8, rings: 3 }); B.solid.push([0, 0, 20 * s, 20 * s, 0]); };
R.icefjord = (B, s = 1, a, r) => { const { G } = B; for (let i = 0; i < 12; i++) { const x = (r() - 0.5) * 900, z = (r() - 0.5) * 900, w = 30 + r() * 80, h = 15 + r() * 45; G.box(x, -h * 0.5, z, w, h, w * (0.6 + r() * 0.6), [0.9, 0.95, 1], { r: r() * 3, topc: [0.96, 0.98, 1] }); } void s; };
// ---------- Las Vegas: the Strip's resorts, its wheel and tower, the sign and Fremont Street ----------
// Built as the others are, from their own proportions, and lit as they are lit: the glow
// (B.glow: unlit, untouched by the tone curve) is their neon, their LED crowns and marquees; the
// night's own layer (B.night: dark by day) the lit rooms of their towers and the Luxor's beam.
// Their fronts face the boulevard.
const NEON = { pink: [1, 0.22, 0.62], gold: [1, 0.74, 0.28], blue: [0.25, 0.6, 1], red: [1, 0.18, 0.12], green: [0.3, 1, 0.55], white: [0.95, 0.95, 1], purple: [0.7, 0.3, 1] };
const WIN = [1, 0.8, 0.52];
// (a part of a landmark built about (x, z) of its own frame, turned by r: its faces, its lights and its solids)
function part(B, x, z, r, fn) {
	const G = B.G, L = B.glow, N = B.night, f = [G.ox, G.oy, G.oz, Math.atan2(G.sn, G.cs)], [ax, , az] = G.at(x, 0, z);
	G.frame(ax, f[1], az, f[3] + r); L?.frame(ax, f[1], az, f[3] + r); N?.frame(ax, f[1], az, f[3] + r);
	const s0 = B.solid.length;
	fn();
	const c = Math.cos(r), s = Math.sin(r);
	for (let k = s0; k < B.solid.length; k++) { const [a, b, w, d, rr] = B.solid[k]; B.solid[k] = [x + a * c + b * s, z - a * s + b * c, w, d, rr + r]; }
	G.frame(...f); L?.frame(...f); N?.frame(...f);
}
// a hotel tower w x d from y0 up h: banded with glass a storey apart, and by night its rooms lit, a
// stretch of window here and there on every floor (built a tower a frame where settle.js lets it: B.later)
function tower(B, x, z, w, d, y0, h, c, g, r = 0, lit = 0.34) {
	B.solid.push([x, z, w, d, r]);
	if (B.later) B.later.push(() => towerNow(B, x, z, w, d, y0, h, c, g, r, lit));
	else towerNow(B, x, z, w, d, y0, h, c, g, r, lit);
}
function towerNow(B, x, z, w, d, y0, h, c, g, r, lit) {
	const { G } = B, L = B.night || B.glow, n = Math.floor(h / 3.3);
	G.box(x, y0, z, w, h, d, c, { r });
	const cs = Math.cos(r), sn = Math.sin(r), q = (a, b) => [x + a * cs + b * sn, z - a * sn + b * cs];
	for (let k = 1; k < n; k++) {
		const y = y0 + k * 3.3 - 1.7;
		G.box(x, y, z, w + 0.3, 1.5, d + 0.3, g, { r, top: false });
		if (!L) continue;
		// (each face in stretches of about 12 m, some of them lit)
		for (const [len, u, v, nx, nz] of [[w, 1, 0, 0, -1], [w, -1, 0, 0, 1], [d, 0, 1, 1, 0], [d, 0, -1, -1, 0]]) {
			const m = Math.max(1, Math.round(len / 12)), seg = len / m, out = (nx ? w : d) / 2 + 0.3;
			for (let i = 0; i < m; i++) {
				if (G.rand() > 0.55) continue;
				const t0 = -len / 2 + i * seg + 1, t1 = t0 + seg - 2, k2 = lit * (0.55 + 0.45 * G.rand());
				const p0 = q(u * t0 + nx * out, v * t0 + nz * out), p1 = q(u * t1 + nx * out, v * t1 + nz * out);
				L.face([[p0[0], y + 0.15, p0[1]], [p1[0], y + 0.15, p1[1]], [p1[0], y + 1.35, p1[1]], [p0[0], y + 1.35, p0[1]]], WIN.map((v2) => v2 * k2));
			}
		}
	}
}
// a resort's grounds: paved from the boulevard's kerb (local z0, to the front) back to z1, following
// the ground, the drive to its door darker, and a row of palms down the kerb (flora.js grows them)
function grounds(B, ground, w, z0, z1, { palms = z0 + 4, skip = () => false, drive = 0 } = {}) {
	const { G } = B, gr = ground || (() => 0), step = 16, pave = [0.64, 0.61, 0.56], up = (x, z) => gr(x, z) + 0.12;
	for (let x = -w / 2; x < w / 2 - 0.01; x += step) for (let z = z0; z < z1 - 0.01; z += step) {
		const x1 = Math.min(x + step, w / 2), z2 = Math.min(z + step, z1);
		G.face([[x, up(x, z), z], [x, up(x, z2), z2], [x1, up(x1, z2), z2], [x1, up(x1, z), z]], pave);
	}
	if (drive) for (let z = z0; z < -8; z += step) { const z2 = Math.min(z + step, -8), h = drive / 2; G.face([[-h, up(-h, z) + 0.03, z], [-h, up(-h, z2) + 0.03, z2], [h, up(h, z2) + 0.03, z2], [h, up(h, z) + 0.03, z]], [0.3, 0.3, 0.31]); }
	for (let x = -w / 2 + 6; x < w / 2 - 4; x += 13) if (!(drive && Math.abs(x) < drive / 2 + 3) && !skip(x)) B.trees.push([x, palms, 'datepalm', 11 + ((x * 7.3) % 4 + 4) % 4]);
}
// the casino floor under it all: a long low block, its marquee and porte-cochère to the front (-z)
// and a pylon sign at the kerb; the tower or towers rise behind; a crown of neon on top
R.casino = (B, s = 1, a = {}, r, ground) => {
	const { G } = B, L = B.glow, c = a.c || [0.86, 0.8, 0.7], g = a.g || [0.22, 0.26, 0.3], neon = NEON[a.neon] || NEON.gold, neon2 = NEON[a.neon2] || NEON.pink;
	const W = (a.w || 170) * s, D = (a.d || 120) * s, H = (a.h || 120) * s, P = 14 * s;
	const px = W / 2 - 18, pz = -40, front = a.lake ? -60 - 190 * s : -56;
	grounds(B, ground, W + 50 * s, front, D + 30 * s, { palms: front + 4, drive: a.lake ? 0 : 24, skip: (x) => Math.abs(x - px) < 8 });
	G.box(0, -3, D / 2, W, P + 3, D, a.pc || [0.9, 0.86, 0.78]);
	L?.box(0, P - 1.6, -0.5, W, 1.2, 0.4, neon2);
	G.box(0, 7, -9, 46 * s, 1.4, 18, [0.92, 0.9, 0.86]);
	L?.box(0, 6.6, -18.2, 46 * s, 0.5, 0.3, neon);
	for (const x of [-21, -7, 7, 21]) G.cyl(x * s, 0, -16, 0.8, 0.8, 7, [0.9, 0.88, 0.84], { n: 8 });
	// the pylon at the kerb, its sign lit both sides, bulbs round its edge
	G.box(px, 0, pz, 4, 34, 4, [0.3, 0.3, 0.32]).box(px, 34, pz, 18, 24, 3, [0.12, 0.1, 0.14]);
	if (L) { L.box(px, 36, pz, 16, 20, 3.3, neon); for (const y of [34.2, 57.6]) L.box(px, y, pz, 18.4, 0.4, 3.5, NEON.white); L.box(px, 26, pz, 4.4, 6, 4.4, neon2); }
	B.solid.push([px, pz, 4, 4, 0]);
	const ty = P - 1, tz = D * 0.55, form = a.form || 'slab';
	let crown = [];
	if (form === 'slab') { tower(B, 0, tz, W * 0.62, 24 * s, ty, H, c, g); crown = [[0, tz - 12 * s - 0.4, W * 0.4, 0]]; }
	else if (form === 'twin') for (const sx of [-1, 1]) { const h = H * (sx > 0 ? 1 : 0.93); tower(B, sx * W * 0.22, tz, W * 0.3, 26 * s, ty, h, c, g); crown.push([sx * W * 0.22, tz - 13 * s - 0.4, W * 0.24, 0, h]); }
	else if (form === 'curve') {
		// a crescent, its hollow to the front (its ends come forward round the middle)
		const R2 = 150 * s, n = 9, span = 1.25, wseg = 2 * R2 * Math.sin(span / (n - 1) / 2) + 1;
		for (let i = 0; i < n; i++) {
			const t = (i / (n - 1) - 0.5) * span, x = Math.sin(t) * R2, z = tz - R2 * (1 - Math.cos(t)), h = H * (1 - Math.abs(i - (n - 1) / 2) / n * 0.5);
			tower(B, x, z, wseg, 24 * s, ty, h, c, g, t);
			if (i === (n - 1) / 2) crown = [[x, z - 12 * s - 0.4, 22 * s, 0, h]];
		}
	} else {
		// three wings from a core (a Y), or a long one and two short (a T: 'tri')
		const wl = (form === 'tri' ? 70 : 58) * s, ww = 20 * s;
		G.cyl(0, ty, tz, ww * 0.7, ww * 0.7, H + 6 * s, c, { n: 12 });
		for (let k = 0; k < 3; k++) {
			const th = -Math.PI / 2 + k * Math.PI * 2 / 3 + Math.PI, ux = Math.cos(th), uz = Math.sin(th), len = form === 'tri' && k ? wl * 0.8 : wl;
			tower(B, ux * len / 2, tz + uz * len / 2, len, ww, ty, H * (k ? 0.92 : 1), c, g, -th);
			crown.push([ux * (len + 0.5), tz + uz * (len + 0.5), ww * 0.8, -th + Math.PI / 2, H * (k ? 0.92 : 1)]);
		}
	}
	// the crown: the name in neon up top, its edges strung with light
	if (L) for (const [x, z, w, r, h] of crown) { const hh = h ?? H; L.box(x, ty + hh - 9 * s, z, w, 6 * s, 0.6, neon, { r }); L.box(x, ty + hh - 0.3, z, w * 1.15, 0.5, 1.2, neon2, { r }); }
	// (the Bellagio's lake in front, its fountains standing up out of it)
	if (a.lake) {
		const lw = W * 1.6, ld = 190 * s, z0 = -60 - ld / 2, gr = ground || (() => 0);
		for (let i = 0; i < 6; i++) { const z = z0 - ld / 2 + (i + 0.5) * ld / 6; G.box(0, gr(0, z) - 1.2, z, lw, 1.5, ld / 6 + 0.2, [0.05, 0.14, 0.2]); }
		G.box(0, -1, z0 - ld / 2 - 2, lw + 6, 2, 4, [0.85, 0.82, 0.76]);
		if (L) for (let i = 0; i < 26; i++) { const x = (i / 25 - 0.5) * lw * 0.85, z = z0 + Math.sin(i * 0.7) * ld * 0.25, h = 18 + 40 * Math.abs(Math.sin(i * 1.3)); L.box(x, gr(x, z), z, 1.2, h, 1.2, [0.62, 0.78, 0.9]); }
	}
	B.solid.push([0, D / 2, W, D, 0]);
};
// the Bellagio: a casino behind its lake, the fountains out on the water to the boulevard
R.bellagio = (B, s, a, r, ground) => R.casino(B, s, { ...a, lake: true }, r, ground);
// the Luxor: a dark glass pyramid, its edges lit, and the beam from its point up into the night
R.luxor = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow, h = 107 * s, w = 180 * s;
	grounds(B, ground, 250 * s, -w / 2 - 75 * s, w / 2 + 20 * s, { drive: 22 * s });
	R.pyramid(B, h / 139, [0.1, 0.11, 0.13]);
	if (L) {
		for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.beam(x * w / 2, 0.5, z * w / 2, 0, h, 0, 0.9, [0.9, 0.8, 0.55]);
		(B.night || L).box(0, h - 2, 0, 5, 4000, 5, [0.85, 0.92, 1]);
	}
	// the sphinx at its door, to the front
	G.box(0, 0, -w / 2 - 40, 16 * s, 12 * s, 50 * s, [0.78, 0.68, 0.5]).box(0, 12 * s, -w / 2 - 60, 10 * s, 12 * s, 10 * s, [0.78, 0.68, 0.5]);
	B.solid.push([0, -w / 2 - 40, 16 * s, 50 * s, 0]);
};
// the Excalibur: two white towers in an L behind a cluster of turrets roofed red, blue and gold
R.excalibur = (B, s = 1, a, r, ground) => {
	const { G } = B, white = [0.92, 0.9, 0.86], g = [0.55, 0.5, 0.42];
	grounds(B, ground, 240 * s, -55 * s, 100 * s);
	tower(B, -30 * s, 70 * s, 120 * s, 20 * s, 0, 82 * s, white, g);
	tower(B, 50 * s, 30 * s, 20 * s, 100 * s, 0, 82 * s, white, g);
	for (const [x, z] of [[-90, 70], [30, 70], [50, -20]]) { G.cone(x * s, 82 * s, z * s, 14 * s, 18 * s, [0.75, 0.12, 0.1], 10); }
	const roofs = [[0.75, 0.12, 0.1], [0.15, 0.3, 0.7], [0.85, 0.65, 0.2]];
	for (let i = 0; i < 9; i++) {
		const x = (-60 + i * 15) * s, z = (i % 2 ? -20 : -5) * s, r = (5 + (i % 3) * 2) * s, h = (28 + (i * 7) % 18) * s;
		G.cyl(x, 0, z, r, r, h, white, { n: 12 }).cone(x, h, z, r * 1.25, r * 2.6, roofs[i % 3], 12);
		B.glow?.box(x, h - 3 * s, z - r - 0.2, r, 1.2, 0.3, NEON.gold);
		B.solid.push([x, z, r * 2, r * 2, 0]);
	}
	G.box(0, 0, -10 * s, 150 * s, 18 * s, 30 * s, white);
};
// New York-New York: its own Manhattan, the Empire State and the Chrysler among them, the Statue
// of Liberty out front
R.nyny = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow, g = [0.24, 0.26, 0.3];
	grounds(B, ground, 190 * s, -80 * s, 80 * s, { skip: (x) => Math.abs(x - 40 * s) < 10 * s });
	G.box(0, -2, 20 * s, 150 * s, 16 * s, 90 * s, [0.72, 0.62, 0.5]);
	const T = [[-55, 40, 26, 26, 95, [0.62, 0.5, 0.4]], [-30, 55, 22, 30, 120, [0.7, 0.66, 0.6]], [30, 50, 26, 22, 105, [0.55, 0.45, 0.38]], [55, 30, 22, 24, 80, [0.66, 0.6, 0.52]], [-60, 0, 20, 20, 70, [0.6, 0.56, 0.5]], [60, -5, 18, 22, 65, [0.5, 0.42, 0.36]]];
	for (const [x, z, w, d, h, c] of T) tower(B, x * s, z * s, w * s, d * s, 14 * s, h * s, c, g);
	// the Empire State: its setbacks and mast
	tower(B, 0, 30 * s, 34 * s, 28 * s, 14 * s, 100 * s, [0.74, 0.7, 0.64], g);
	G.box(0, 114 * s, 30 * s, 24 * s, 22 * s, 20 * s, [0.74, 0.7, 0.64]).box(0, 136 * s, 30 * s, 12 * s, 10 * s, 10 * s, [0.74, 0.7, 0.64]).cyl(0, 146 * s, 30 * s, 2.5 * s, 0.6 * s, 18 * s, [0.7, 0.7, 0.72], { n: 8 });
	L?.box(0, 133 * s, 30 * s, 24.6 * s, 3 * s, 20.6 * s, NEON.white);
	// the Chrysler: its crown in arcs of light
	tower(B, -12 * s, 75 * s, 22 * s, 22 * s, 14 * s, 108 * s, [0.68, 0.68, 0.7], g);
	for (let k = 0; k < 5; k++) { const r = (11 - k * 2) * s, y = (122 + k * 6) * s; G.cyl(-12 * s, y, 75 * s, r, r * 0.8, 6 * s, [0.82, 0.82, 0.86], { n: 12 }); L?.cyl(-12 * s, y + 4 * s, 75 * s, r * 0.82, r * 0.8, 0.6, NEON.white, { n: 12, top: false }); }
	G.cyl(-12 * s, 152 * s, 75 * s, 1.2 * s, 0.1, 16 * s, [0.85, 0.85, 0.88], { n: 6 });
	part(B, 40 * s, -55 * s, 0, () => R.statue(B, 0.45 * s, { c: [0.45, 0.65, 0.58], pose: 'torch' }));
	B.solid.push([0, 20 * s, 150 * s, 90 * s, 0]);
};
// Paris Las Vegas: the Eiffel Tower at half its size, lit gold, the hotel behind, the balloon sign out front
R.parislv = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow;
	grounds(B, ground, 200 * s, -64 * s, 92 * s, { skip: (x) => Math.abs(x - 60 * s) < 14 * s || Math.abs(x + 40 * s) < 34 * s });
	part(B, -40 * s, -10 * s, 0, () => R.lattice(B, 0.5 * s, { c: [0.52, 0.42, 0.3] }));
	if (L) for (const [y, w] of [[28, 22], [57, 12], [148, 3]]) L.box(-40 * s, y * s, -10 * s, w * s, 1.4, w * s, NEON.gold);
	tower(B, 50 * s, 70 * s, 110 * s, 22 * s, 0, 105 * s, [0.9, 0.84, 0.72], [0.3, 0.3, 0.32]);
	G.hip(50 * s, 105 * s, 70 * s, 110 * s, 22 * s, 8 * s, [0.28, 0.32, 0.36], { o: 0 });
	G.box(20 * s, -2, 40 * s, 150 * s, 15 * s, 70 * s, [0.88, 0.82, 0.7]);
	// the balloon: a ball of light on its basket
	G.box(60 * s, 0, -45 * s, 6 * s, 14 * s, 6 * s, [0.5, 0.4, 0.3]);
	if (L) { L.dome(60 * s, 26 * s, -45 * s, 11 * s, NEON.blue, { k: 1.2, n: 12, rings: 4 }); L.dome(60 * s, 26 * s, -45 * s, 11 * s, NEON.pink, { k: -1, n: 12, rings: 4 }); }
	B.solid.push([60 * s, -45 * s, 6 * s, 6 * s, 0]);
};
// the High Roller: the wheel, 168 m, its rim strung with light, cabins round it
R.wheel = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow, R2 = 76 * s, hy = 90 * s, n = 40, steel = [0.85, 0.86, 0.88];
	grounds(B, ground, 130 * s, -34 * s, 50 * s, { skip: (x) => Math.abs(Math.abs(x) - 30 * s) < 8 * s });
	const at = (k, r = R2) => { const t = k / n * Math.PI * 2; return [Math.cos(t) * r, hy + Math.sin(t) * r]; };
	for (let k = 0; k < n; k++) {
		const [x0, y0] = at(k), [x1, y1] = at(k + 1);
		G.beam(x0, y0, 0, x1, y1, 0, 1.6 * s, steel);
		if (k % 2 === 0) { G.beam(0, hy, 0, x0, y0, -3 * s, 0.25 * s, steel); G.beam(0, hy, 0, x0, y0, 3 * s, 0.25 * s, steel); }
		if (k % 2 === 0) { const [cx, cy] = at(k, R2 + 5 * s); G.box(cx, cy - 3.5 * s, 0, 7 * s, 7 * s, 9 * s, [0.75, 0.85, 0.9]); }
		if (L) { const [a0, b0] = at(k, R2 - 1.4 * s), [a1, b1] = at(k + 1, R2 - 1.4 * s); L.beam(a0, b0, 0, a1, b1, 0, 0.8 * s, k % 4 < 2 ? NEON.pink : NEON.blue); }
	}
	G.cyl(0, hy - 3 * s, -6 * s, 4 * s, 4 * s, 6 * s, steel, { n: 12 });
	for (const sx of [-1, 1]) { G.beam(sx * 30 * s, 0, -8 * s, 0, hy, -2 * s, 3.5 * s, steel); G.beam(sx * 30 * s, 0, 8 * s, 0, hy, 2 * s, 3.5 * s, steel); }
	G.box(0, -2, 30 * s, 60 * s, 12 * s, 30 * s, [0.3, 0.32, 0.36]);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.solid.push([sx * 30 * s, sz * 8 * s, 6 * s, 6 * s, 0]);
	B.solid.push([0, 30 * s, 60 * s, 30 * s, 0]);
};
// the Strat: a 350 m tower on three legs, its pod ringed with light, a mast and its beacon
R.strat = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow, c = [0.86, 0.85, 0.82];
	grounds(B, ground, 110 * s, -42 * s, 70 * s, { skip: (x) => Math.abs(x) < 34 * s });
	G.cyl(0, 0, 0, 9 * s, 7 * s, 255 * s, c, { n: 12 });
	for (let k = 0; k < 3; k++) { const t = k * Math.PI * 2 / 3; G.beam(Math.cos(t) * 26 * s, 0, Math.sin(t) * 26 * s, Math.cos(t) * 8 * s, 230 * s, Math.sin(t) * 8 * s, 6 * s, c); B.solid.push([Math.cos(t) * 26 * s, Math.sin(t) * 26 * s, 7 * s, 7 * s, 0]); }
	for (const [y, r0, r1, h] of [[250, 14, 26, 8], [258, 26, 27, 14], [272, 27, 22, 10], [282, 22, 16, 8]]) G.cyl(0, y * s, 0, r0 * s, r1 * s, h * s, [0.8, 0.8, 0.82], { n: 18 });
	if (L) { for (const y of [262, 268]) L.cyl(0, y * s, 0, 27.3 * s, 27.3 * s, 1.2, NEON.blue, { n: 18, top: false }); L.cyl(0, 276 * s, 0, 25.5 * s, 25.5 * s, 1, NEON.purple, { n: 18, top: false }); L.box(0, 348 * s, 0, 1.6, 2, 1.6, NEON.red); }
	G.cyl(0, 290 * s, 0, 3 * s, 1 * s, 60 * s, [0.75, 0.75, 0.78], { n: 8 });
	G.box(0, -2, 40 * s, 90 * s, 14 * s, 50 * s, [0.84, 0.8, 0.72]);
	B.solid.push([0, 0, 18 * s, 18 * s, 0], [0, 40 * s, 90 * s, 50 * s, 0]);
};
// the Venetian: its campanile and a Y of a tower behind
R.venetian = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow, brick = [0.66, 0.32, 0.24], stone = [0.9, 0.86, 0.76];
	R.casino(B, s, { form: 'y', h: 140, c: [0.88, 0.8, 0.66], neon: 'gold', neon2: 'gold', w: 190 }, r, ground);
	const cx = -70 * s, cz = -50 * s;
	G.box(cx, 0, cz, 12 * s, 70 * s, 12 * s, brick).box(cx, 70 * s, cz, 13 * s, 12 * s, 13 * s, stone).hip(cx, 82 * s, cz, 12 * s, 12 * s, 14 * s, [0.3, 0.45, 0.4], { o: 0 }).cone(cx, 96 * s, cz, 1.2 * s, 6 * s, [0.85, 0.7, 0.3], 6);
	L?.box(cx, 72 * s, cz, 13.4 * s, 8 * s, 13.4 * s, NEON.gold.map((v) => v * 0.7));
	B.solid.push([cx, cz, 12 * s, 12 * s, 0]);
};
// the Sphere: a ball of light 112 m across, its whole skin a screen, tonight an eye looking down the Strip
R.sphere = (B, s = 1, a, rr, ground) => {
	const { G } = B, L = B.glow, r = 56 * s, y0 = 50 * s, n = 14;
	grounds(B, ground, 150 * s, -80 * s, 75 * s, { drive: 20 * s });
	G.box(0, -1, 0, 70 * s, 4 * s, 70 * s, [0.2, 0.2, 0.22]);
	G.cyl(0, 0, 0, 30 * s, 20 * s, y0 - r * 0.7, [0.18, 0.18, 0.2], { n: 16 });
	for (let j = 0; j < n; j++) {
		const a0 = -Math.PI / 2 + j / n * Math.PI, a1 = -Math.PI / 2 + (j + 1) / n * Math.PI, t = j / (n - 1);
		const c = [0.25 + 0.75 * t * t, 0.3 + 0.4 * Math.sin(t * Math.PI), 1 - 0.6 * t];
		(L || G).cyl(0, y0 + Math.sin(a0) * r, 0, Math.cos(a0) * r, Math.cos(a1) * r, (Math.sin(a1) - Math.sin(a0)) * r, c, { n: 24, top: false });
	}
	// (the eye: its white, its iris and its pupil, to the front)
	if (L) { L.box(0, y0 - 14 * s, -r - 0.4, 46 * s, 28 * s, 0.3, [1, 1, 1]); L.box(0, y0 - 9 * s, -r - 0.8, 18 * s, 18 * s, 0.3, [0.2, 0.55, 1]); L.box(0, y0 - 4 * s, -r - 1.2, 8 * s, 8 * s, 0.3, [0.02, 0.02, 0.04]); }
	B.solid.push([0, 0, 2 * r, 2 * r, 0]);
};
// the sign at the Strip's south end: on its two posts, the diamond, the silver dollars of WELCOME, the red star
R.vegassign = (B, s = 1) => {
	const { G } = B, L = B.glow, w = 7.6 * s, y0 = 5 * s, h = 6.2 * s;
	for (const x of [-w * 0.32, w * 0.32]) G.box(x, 0, 0, 0.5 * s, y0 + 1, 0.5 * s, [0.85, 0.85, 0.82]);
	// (the diamond: a hexagon wider at the middle, white both sides)
	const P = [[-w / 2, y0 + h * 0.5], [-w * 0.3, y0], [w * 0.3, y0], [w / 2, y0 + h * 0.5], [w * 0.3, y0 + h], [-w * 0.3, y0 + h]];
	for (const z of [-0.2, 0.2]) { const q = (i) => [P[i][0], P[i][1], z], quad = z < 0 ? [[0, 1, 2, 3], [0, 3, 4, 5]] : [[3, 2, 1, 0], [5, 4, 3, 0]]; for (const f of quad) G.face(f.map(q), [0.95, 0.94, 0.9]); }
	if (L) {
		for (let i = 0; i < 6; i++) { const [x0, y1] = P[i], [x1, y2] = P[(i + 1) % 6]; for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6; L.box(x0 + (x1 - x0) * t, y1 + (y2 - y1) * t - 0.08, -0.32, 0.16, 0.16, 0.64, NEON.gold); } }
		for (let i = 0; i < 7; i++) { const x = (i / 6 - 0.5) * w * 0.7; G.box(x, y0 + h * 0.62, -0.3, 0.84 * s, 0.84 * s, 0.1, [0.92, 0.92, 0.94]); L.box(x, y0 + h * 0.66, -0.37, 0.36 * s, 0.5 * s, 0.05, NEON.red); }
		L.box(0, y0 + h * 0.25, -0.32, w * 0.5, 0.9 * s, 0.05, NEON.blue).box(0, y0 + h * 0.43, -0.32, w * 0.42, 0.8 * s, 0.05, NEON.red);
		L.cone(-w * 0.18, y0 + h + 0.2, -0.1, 0.9 * s, 1.6 * s, NEON.red, 5);
	}
	B.solid.push([0, 0, w, 1, 0]);
};
// Fremont Street: the canopy over five blocks of the old downtown, its underside a screen of light,
// the old casinos' neon down both sides
R.canopy = (B, s = 1, a, r, ground) => {
	const { G } = B, L = B.glow, len = 420 * s, half = 15 * s, top = 27 * s, n = 8;
	const gr = ground || (() => 0), cols = [NEON.blue, NEON.purple, NEON.pink, NEON.gold, NEON.green];
	for (let x = -len / 2; x <= len / 2; x += 30 * s) for (const z of [-half, half]) { const y = gr(x, z); G.box(x, y - 1, z, 1.6, gr(x, 0) + top - 4 - y + 1, 1.6, [0.3, 0.3, 0.32]); B.solid.push([x, z, 1.6, 1.6, 0]); }
	const seg = 20 * s;
	for (let x = -len / 2; x < len / 2; x += seg) {
		const y = gr(x + seg / 2, 0);
		for (let k = 0; k < n; k++) {
			const t0 = Math.PI * k / n, t1 = Math.PI * (k + 1) / n, z0 = -Math.cos(t0) * half, z1 = -Math.cos(t1) * half, y0 = y + top - 4 + Math.sin(t0) * 5 * s, y1 = y + top - 4 + Math.sin(t1) * 5 * s;
			G.face([[x, y0, z0], [x, y1, z1], [x + seg, y1, z1], [x + seg, y0, z0]], [0.35, 0.36, 0.4]);
			L?.face([[x, y1 - 0.25, z1], [x, y0 - 0.25, z0], [x + seg, y0 - 0.25, z0], [x + seg, y1 - 0.25, z1]], cols[((Math.floor(x / seg) + k) % cols.length + cols.length) % cols.length].map((v) => v * 0.8));
		}
	}
	// the casinos along it: their fronts, and a blade of neon on each
	for (let i = 0; i < 10; i++) {
		const x = -len / 2 + 25 + i * len / 10, side = i % 2 ? 1 : -1, z = side * (half + 14 * s), y = gr(x, z), h = (16 + (i * 5) % 14) * s;
		G.box(x, y - 1, z, 34 * s, h, 22 * s, [0.6 + (i % 3) * 0.1, 0.5, 0.42]);
		L?.box(x, y + 8 * s, z - side * (11 * s + 0.3), 30 * s, 2 * s, 0.4, cols[i % cols.length]);
		L?.box(x + 12 * s, y + h, z - side * 9 * s, 1.2, 18 * s, 5 * s, cols[(i + 2) % cols.length]);
		B.solid.push([x, z, 34 * s, 22 * s, 0]);
	}
};
export const REAL_BUILD = R;

// ---------- the lore ----------
// tales by kind: a name (from the place's own names when it has a {name}) and a legend
const LORE = {
	watchtower: { names: ['the Old Watchtower', 'the Signal Tower', '{name}\'s Tower', 'the Lookout'], tales: [
		'In the old days a fire lit on this tower carried word from valley to valley in a single night. The last time it was lit was for a wedding.',
		'A keeper here lit the beacon every night for forty years, waiting for a ship that never came home. People still leave a stone on the wall when they pass.',
		'They say {name} climbed it in a storm to light the fire and bring the herders home off the hill; the path up is named for her.',
	] },
	passshrine: { names: ['the Shrine on the Pass', 'the Travellers\' Shrine', 'the Cairn of {name}'], tales: [
		'Everyone who crosses stops here to give thanks for a safe road: a stone on the pile, a word, a little tea poured out.',
		'A traveller lost in the snow up here followed a light to this spot and was found alive in the morning. Since then nobody crosses without stopping.',
		'{name}, who carried the post over the pass for thirty winters, built the first cairn. Add a stone and the weather holds, they say.',
	] },
	shipwreck: { names: ['the Wreck in the Ice', 'the Old Whaler', 'the Ship of {name}'], tales: [
		'She was a whaler. The ice closed round her one autumn a hundred and fifty years ago; the crew walked ashore and the families here took them in for the winter. Some never left.',
		'The ice brought her in and the ice keeps her. The old people say on still nights you can hear her timbers talking to the floes.',
		'When she broke up, the people here used her timbers for the first church. The bell came from her too.',
	] },
	reefwreck: { names: ['the Wreck on the Reef', 'the Old Schooner', 'the Ship of {name}'], tales: [
		'She ran onto the reef in a cyclone a hundred years ago. The village went out in the canoes and brought every sailor ashore; one of them married here, and his great-grandchildren still fish this lagoon.',
		'The reef took her one night in the big storm. Her bell rings now in the church, and the children dive for the old copper nails.',
	] },
	inuksuk: { names: ['the Inuksuk on the Ridge', 'the Marker'], tales: [
		'An inuksuk shows the way. This one has pointed to the place where the char run every summer for longer than anyone can remember. Nobody ever knocks one down.',
		'Inuksuit stand for the people who came before. When you see one you know someone was here, and found their way.',
	] },
	oldhut: { names: ['the Explorers\' Hut', 'the Old Hut'], tales: ['Explorers wintered in that hut more than a century ago. It is kept just as they left it: the stove, the bunks, tins on the shelves. We visit, quietly, and close the door behind us.'] },
	whalers: { names: ['the Old Whaling Station'], tales: ['The try-pots are from the whaling days. The old people say the bay was once so full of whales you could hear them breathing at night. Now the whales are coming back.'] },
	caravanserai: { names: ['the Old Caravanserai', 'the Inn of {name}', 'the Last Well Inn'], tales: [
		'Caravans stopped here, a day\'s march from the next well. A merchant who lost everything to a sandstorm was fed here for a month for nothing; he became the richest man on the road, and paid for the great gate.',
		'Silk went west and silver came east through that gate. They say the stones of the court still keep the heat of a thousand cooking fires.',
		'Travellers of every faith slept side by side here. The rule of the house was simple: no one is turned away at night.',
	] },
	stonecircle: { names: ['the Standing Stones', 'the Old Circle', 'the Dancers'], tales: [
		'Nobody knows who raised them. On midsummer morning the sun comes up between the tallest two.',
		'They say the stones were dancers who kept on through the night of a feast and were caught by the dawn. Count them twice and you will get two answers.',
	] },
	stonecross: { names: ['the Peace Cross', 'the Wayside Cross'], tales: ['This cross marks where two villages made peace after a long quarrel over the river. They hold a picnic here together every spring.'] },
	oldmine: { names: ['the Old Mine', 'the {name} Adit'], tales: ['The mine closed a long time ago. The miners\' bell hangs in the church now, and rings on the day the mine first opened.'] },
	hermitage: { names: ['the Hermitage', 'the Cave of {name}'], tales: ['A hermit lived in the cave above the village for thirty years. On the day he died people still bring butter lamps up the path and light them in the dark.'] },
	incaruin: { names: ['the Old Terraces', 'the Stone Houses'], tales: ['The old people built these walls so well that the earthquakes have never moved them. The terraces still grow potatoes.'] },
	sacredtree: { names: ['the Great Tree', 'the Grandmother Tree'], tales: ['The great tree has stood longer than anyone can remember. People tie a cloth to it for a wish, and nobody cuts so much as a branch.', 'When the village was founded the first family slept under this tree. Every naming feast still ends here.'] },
	baobab: { names: ['the Old Baobab', 'the Elders\' Tree'], tales: ['The elders meet under the old baobab. They say the first rains planted it upside down, which is why its roots are in the sky.', 'In the dry season the baobab keeps water in its trunk. In the great drought it kept the village.'] },
	oldwell: { names: ['the Old Well', 'the Well of {name}'], tales: ['The old well never ran dry, even in the great drought. The village grew up round it, and still the first water of the year is drawn here.', '{name} dug this well by hand for seven years. When the water came the whole village sang.'] },
	stepwell: { names: ['the Stepwell', 'the Queen\'s Stepwell'], tales: ['A queen built the stepwell in memory of her husband. In the hottest months the air at the bottom is cool and people still go down to sit.'] },
	ruin: { names: ['the Old Fort', 'the Ruins', 'the Old Walls'], tales: ['These walls were a fort once. Now the goats keep it, and the children play at kings there after school.', 'Nobody remembers who lived here. Every spring the wild flowers come up through the floor in the shape of the old rooms.'] },
	ovoo: { names: ['the Ovoo on the Hill'], tales: ['Walk round the ovoo three times clockwise and add a stone, and the road ahead will be kind. The blue scarves are for the sky.'] },
	deerstone: { names: ['the Deer Stone'], tales: ['The deer stones are older than anyone\'s stories. The deer carved on them fly toward the sun.'] },
	lighthouse: { names: ['the Old Light', 'the {name} Light'], tales: ['Three generations of one family kept the light. One night the lamp failed and the keeper\'s daughter held a lantern in the window till dawn; every boat came home.'] },
	oldbridge: { names: ['the Old Bridge', 'the Bridge of Two Villages'], tales: ['The two villages on either side built the bridge from their own ends. They met in the middle a hand\'s width apart, and laughed, and put one more stone in.'] },
	chapelrock: { names: ['the Fishermen\'s Chapel'], tales: ['Fishermen built the chapel after they were saved from a storm. They still bring the first catch of the year up the steps.'] },
	oldbarn: { names: ['the Old Barn'], tales: ['The old barn was raised by the whole valley in one day, the year of the flood. The dance afterward is still held every autumn.'] },
	oldbore: { names: ['the Old Bore'], tales: ['The old bore has pumped water since the station began. In the dry the roos and the emus come in to drink at dusk.'] },
};
// a generated landmark's name and legend, from its kind and the place's names
export function loreFor(kind, culture, seed, shrine = null) {
	let s = seed >>> 0 || 1;
	const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	const L = LORE[kind] || LORE.ruin, N = culture?.names, who = N ? pick(r, r() < 0.5 ? N.f : N.m) : 'the keeper';
	const fill = (t) => t.replace(/\{name\}/g, who);
	const names = kind === 'passshrine' && shrine ? { chorten: ['the Chorten on the Pass', 'the Pass Chorten'], torii: ['the Mountain Shrine', 'the Shrine on the Pass'], chapel: ['the Chapel on the Pass', 'the Wayside Chapel'], ovoo: ['the Ovoo on the Pass'] }[shrine] || L.names : L.names;
	return { name: fill(pick(r, names)), tale: fill(pick(r, L.tales)) };
}
// the shrine of a pass, in the manner of the place
export function shrineOf(kitId, culture) {
	if (kitId === 'himalaya') return 'chorten';
	if (culture?.key === 'japanese') return 'torii';
	if (kitId === 'alpine' || kitId === 'village') return 'chapel';
	if (kitId === 'steppe') return 'ovoo';
	return 'cairn';
}
