// The regional buildings and the things round them, each a few dozen faces from geo.js in
// the lot's frame (the origin at the middle of the lot on the ground, +x along its front, the
// door on -z, the street side). Sizes are the real ones (a log house about 7 x 6 m with a
// 45 degree roof, a ger 6 m across, a souk stall 2.5 m wide...); colours come from the
// place's palette (P: the atlas region's walls and roofs, the kit's woods and stones) so the
// same kind of house is painted as the place paints it.
//
// Each builder: (B, L, P, r) where B = { G, glow, smoke: [], solid: [], lights: [], trees: [] }:
// G the geometry, glow the lit things (windows at night, lanterns, signs), smoke the
// chimneys' tops, solid the boxes you can't walk through ([x, z, w, d, rot] local), lights
// the points that glow, trees the great trees grown with the region's plants ([x, z, word,
// size] local, flora.js); L the lot { w, d }; P the palette; r the lot's random stream.

import { shade, mixc, col } from './geo.js';

const pick = (r, L) => L[Math.floor(r() * L.length)];
const WARM = [1, 0.72, 0.38], GLASS = [0.16, 0.2, 0.24], DARK = [0.08, 0.07, 0.06];

// ---------- the small parts ----------
// a window on the wall at local x = a along a wall facing -z (z = -d/2) or other sides
function windowOn(B, side, a, y, w, h, P, L, { frame = P.trim, lit = 0.7, shutter = null, deep = 0.06 } = {}) {
	const { G, glow } = B, hw = L.w / 2, hd = L.d / 2;
	// (in a dense quarter, a window is its glass and its light only)
	if (B.lite) { frame = null; shutter = null; }
	// the wall's plane: side 0 front (-z), 1 back (+z), 2 right (+x), 3 left (-x)
	const put = (g, x0, x1, y0, y1, out, c) => {
		const pts = side === 0 ? [[x0, y0, -hd - out], [x1, y0, -hd - out], [x1, y1, -hd - out], [x0, y1, -hd - out]]
			: side === 1 ? [[x1, y0, hd + out], [x0, y0, hd + out], [x0, y1, hd + out], [x1, y1, hd + out]]
				: side === 2 ? [[hw + out, y0, x0], [hw + out, y0, x1], [hw + out, y1, x1], [hw + out, y1, x0]]
					: [[-hw - out, y0, x1], [-hw - out, y0, x0], [-hw - out, y1, x0], [-hw - out, y1, x1]];
		g.face(pts, c);
	};
	const f = 0.08;
	if (frame) put(G, a - w / 2 - f, a + w / 2 + f, y - f, y + h + f, 0.02, frame);
	put(G, a - w / 2, a + w / 2, y, y + h, deep, GLASS);
	if (glow && lit > 0) put(glow, a - w / 2 + 0.03, a + w / 2 - 0.03, y + 0.03, y + h - 0.03, deep + 0.01, mixc(WARM, [1, 0.9, 0.7], 0.2).map((v) => v * lit));
	if (shutter) { put(G, a - w / 2 - f - w * 0.5, a - w / 2 - f, y, y + h, 0.04, shutter); put(G, a + w / 2 + f, a + w / 2 + f + w * 0.5, y, y + h, 0.04, shutter); }
}
// a door on the front wall (or side), with its frame
function doorOn(B, a, w, h, P, L, { side = 0, c = P.door, frame = P.trim } = {}) {
	const { G } = B, hd = L.d / 2, hw = L.w / 2;
	const put = (x0, x1, y0, y1, out, cc) => G.face(side === 0 ? [[x0, y0, -hd - out], [x1, y0, -hd - out], [x1, y1, -hd - out], [x0, y1, -hd - out]] : side === 2 ? [[hw + out, y0, x0], [hw + out, y0, x1], [hw + out, y1, x1], [hw + out, y1, x0]] : [[x1, y0, hd + out], [x0, y0, hd + out], [x0, y1, hd + out], [x1, y1, hd + out]], cc);
	put(a - w / 2 - 0.1, a + w / 2 + 0.1, 0, h + 0.1, 0.02, frame);
	put(a - w / 2, a + w / 2, 0.02, h, 0.05, c);
}
// a foundation that reaches into the slope, so a house never floats
const footing = (B, w, d, c, up = 0.25) => B.G.box(0, -1.6, 0, w, 1.6 + up, d, c, { top: true });
const solid = (B, x, z, w, d, rot = 0) => B.solid.push([x, z, w, d, rot]);
const chimney = (B, x, y, z, c, h = 1.2) => { B.G.box(x, y, z, 0.6, h, 0.6, c); B.smoke.push([x, y + h + 0.2, z]); };
const snowK = (P) => P.snow || 0;
// lift the frame (the geometry's and the lit things') by dy: a floor up on posts
const raise = (B, dy) => { B.G.oy += dy; if (B.glow) B.glow.oy += dy; };

// ---------- the north ----------
const S = {};
// a log house: logs laid in courses (alternate courses a shade apart, the ends crossing at
// the corners), a steep roof that sheds snow, a stone chimney, small windows with painted frames
S.log = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 2.9 + r() * 0.5, logs = Math.round(H / 0.26);
	footing(B, w, d, P.stone, 0.35);
	for (let i = 0; i < logs; i++) {
		const y = 0.35 + i * (H / logs), c = shade(P.wood, i % 2 ? 0.92 : 1.05);
		G.box(0, y, 0, w, H / logs, d, c, { top: false });
		// the crossing ends at the corners
		if (i % 2 === 0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(sx * (w / 2 + 0.12), y, sz * (d / 2 + 0.12), 0.28, H / logs * 0.9, 0.28, shade(P.wood, 0.8));
	}
	const pitch = 0.95 + r() * 0.25, rh = d / 2 * pitch;
	G.gable(0, 0.35 + H, 0, w, d, rh, P.roof, { o: 0.55, gc: P.wood, snow: snowK(P) * 0.85 });
	doorOn(B, -w * 0.18, 0.95, 1.95, P, L, { c: shade(P.wood, 0.6) });
	G.box(-w * 0.18, 0, -d / 2 - 0.6, 1.6, 0.35, 1.2, shade(P.wood, 0.85));
	windowOn(B, 0, w * 0.22, 1.35, 0.8, 0.95, P, L, { frame: P.trim });
	windowOn(B, 2, 0, 1.35, 0.8, 0.95, P, L, { frame: P.trim });
	windowOn(B, 1, -w * 0.2, 1.35, 0.8, 0.95, P, L, { frame: P.trim, lit: 0.4 });
	chimney(B, w * 0.25, 0.35 + H + rh * 0.4, d * 0.15, P.stone, rh * 0.75 + 0.5);
	solid(B, 0, 0, w + 0.5, d + 0.5);
};
// an Arctic house: painted boards on steel posts above the permafrost, a low roof, steps
S.arctic = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, lift = 0.9 + r() * 0.5, H = 2.7;
	for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) G.box(sx * (w / 2 - 0.3), -1, sz * (d / 2 - 0.3), 0.18, lift + 1, 0.18, [0.3, 0.3, 0.32]);
	G.box(0, lift, 0, w, H, d, P.wall, { bottom: true });
	// the boards' lines
	for (let k = 1; k < 6; k++) G.box(0, lift + k * H / 6, 0, w + 0.02, 0.03, d + 0.02, shade(P.wall, 0.85), { top: false });
	G.gable(0, lift + H, 0, w, d, d * 0.22, P.roof, { o: 0.35, gc: P.wall, snow: snowK(P) * 0.7 });
	const L2 = { w, d };
	doorOn(B, w * 0.25, 0.9, 1.95, P, L2, { c: P.trim });
	raise(B, lift);
	windowOn(B, 0, -w * 0.15, 1.1, 1.0, 0.9, P, L2, { frame: P.trim });
	windowOn(B, 2, 0, 1.1, 1.0, 0.9, P, L2, { frame: P.trim });
	windowOn(B, 1, 0, 1.1, 1.2, 0.9, P, L2, { frame: P.trim, lit: 0.5 });
	raise(B, -(lift));
	// the steps and a little porch
	for (let k = 0; k < 3; k++) G.box(w * 0.25, k * lift / 3, -d / 2 - 0.9 + k * 0.25, 1.2, lift / 3, 0.3, [0.42, 0.4, 0.38]);
	G.box(w * 0.25, lift - 0.05, -d / 2 - 0.4, 1.6, 0.08, 0.9, [0.42, 0.4, 0.38]);
	// the heating oil tank at the side
	if (r() < 0.7) G.cyl(w / 2 + 0.8, 0.3, d * 0.2, 0.45, 0.45, 1.6, [0.62, 0.62, 0.6], { n: 8 });
	B.smoke.push([w * 0.3, lift + H + d * 0.2, 0]);
	solid(B, 0, 0, w + 0.3, d + 0.3);
};
// a research station module: insulated panels on legs, a row of small windows, a mast
S.station = (B, L, P, r) => {
	const { G } = B, w = Math.max(L.w, 12), d = Math.max(L.d, 6), lift = 2.2, H = 3.2;
	for (let i = -2; i <= 2; i++) for (const sz of [-1, 1]) G.box(i * (w / 4.5), -1, sz * (d / 2 - 0.4), 0.3, lift + 1, 0.3, [0.35, 0.35, 0.36]);
	G.box(0, lift, 0, w, H, d, P.accent, { bottom: true, topc: [0.82, 0.83, 0.84] });
	G.box(0, lift + H - 0.4, 0, w + 0.05, 0.12, d + 0.05, [0.9, 0.9, 0.9], { top: false });
	raise(B, lift);
	for (let i = 0; i < 6; i++) windowOn(B, 0, -w / 2 + 1.5 + i * (w - 3) / 5, 1.3, 0.7, 0.6, P, { w, d }, { frame: [0.85, 0.85, 0.85] });
	raise(B, -(lift));
	// stairs up to the door, a mast and a radome
	for (let k = 0; k < 6; k++) G.box(w / 2 + 0.7, k * lift / 6, -1 + k * 0.3, 1.1, lift / 6, 0.3, [0.4, 0.4, 0.42]);
	G.box(-w / 2 + 1, lift + H, 0, 0.12, 9, 0.12, [0.7, 0.7, 0.72]);
	if (r() < 0.6) G.dome(w / 4, lift + H, 0, 1.2, [0.92, 0.92, 0.9], { k: 1, n: 10, rings: 4 });
	solid(B, 0, 0, w + 0.4, d + 0.4);
};
// a shed: boards and a single-pitch or gable roof
S.shed = (B, L, P, r) => {
	const { G } = B, w = Math.min(L.w, 4), d = Math.min(L.d, 3.2), H = 2.2;
	footing(B, w, d, P.stone, 0.1);
	G.box(0, 0.1, 0, w, H, d, shade(P.wood, 0.95));
	G.gable(0, H + 0.1, 0, w, d, d * 0.35, P.roof, { o: 0.25, gc: P.wood, snow: snowK(P) * 0.85, r: 0 });
	doorOn(B, 0, 1.0, 1.8, P, { w, d }, { c: shade(P.wood, 0.7) });
	solid(B, 0, 0, w, d);
	if (r() < 0.5) S.woodpile(B, { w: 2, d: 0.6 }, P, r, w / 2 + 0.6, 0);
};
// a sauna by the water: a small log hut with a stove's chimney
S.sauna = (B, L, P, r) => { S.log(B, { w: 3.6, d: 3.2 }, P, r); };
// a barn: tall boards, a big door, a gambrel in the farm country, a plain gable elsewhere
S.barn = (B, L, P, r) => {
	const { G } = B, w = Math.max(L.w, 10), d = Math.max(L.d, 8), H = 4 + r() * 1.5, red = P.barn || P.wall;
	footing(B, w, d, P.stone, 0.2);
	G.box(0, 0.2, 0, w, H, d, red);
	if (P.gambrel) {
		const y = H + 0.2, k = d / 2;
		G.gable(0, y, 0, w, d, k * 0.45, P.roof, { o: 0.3, gc: red, snow: snowK(P) * 0.8 });
		G.gable(0, y + k * 0.32, 0, w, d * 0.6, k * 0.45, P.roof, { o: 0.2, gc: red, snow: snowK(P) * 0.8 });
	} else G.gable(0, H + 0.2, 0, w, d, d * 0.45, P.roof, { o: 0.4, gc: red, snow: snowK(P) * 0.85 });
	doorOn(B, 0, 3.2, 3.4, P, { w, d }, { c: shade(red, 0.75), frame: [0.92, 0.9, 0.86] });
	G.face([[-1.6, 0.2, -d / 2 - 0.08], [1.6, 3.6, -d / 2 - 0.08], [1.5, 3.6, -d / 2 - 0.08], [-1.7, 0.2, -d / 2 - 0.08]], [0.92, 0.9, 0.86]);
	solid(B, 0, 0, w, d);
};
// a log pile under a little roof
S.woodpile = (B, L, P, r, x = 0, z = 0) => {
	const { G } = B, w = L.w || 2, d = 0.7;
	G.box(x, 0, z, w, 1.1, d, shade(P.wood, 0.8), { sides: [[0.72, 0.6, 0.44], [0.72, 0.6, 0.44], shade(P.wood, 0.7), shade(P.wood, 0.7)] });
	for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) G.cyl(x - w / 2 + 0.2 + i * (w - 0.4) / 5, 0.15 + j * 0.35, z - d / 2 - 0.02, 0.14, 0.14, 0.02, [0.78, 0.66, 0.48], { n: 6 });
	G.slab(x, 1.15, z, w + 0.3, d + 0.4, 0.06, shade(P.wood, 0.6));
};
// a fish-drying rack: poles and rails, the catch hung in rows
S.fishrack = (B) => {
	const { G } = B, w = 5;
	for (const x of [-w / 2, 0, w / 2]) { G.beam(x - 0.6, 0, 0, x, 2.4, 0, 0.1, [0.42, 0.36, 0.3]); G.beam(x + 0.6, 0, 0, x, 2.4, 0, 0.1, [0.42, 0.36, 0.3]); }
	for (const y of [1.6, 2.2]) G.box(0, y, 0, w + 0.4, 0.08, 0.08, [0.45, 0.4, 0.34]);
	for (let i = 0; i < 14; i++) for (const y of [1.6, 2.2]) G.box(-w / 2 + 0.2 + i * (w - 0.4) / 13, y - 0.55, 0, 0.12, 0.55, 0.03, [0.62, 0.58, 0.5]);
	solid(B, 0, 0, w, 1);
};
// a sledge: two runners turned up at the front, slats across
S.sledge = (B, L, P) => {
	const { G } = B, c = shade(P.wood, 0.85);
	for (const z of [-0.35, 0.35]) { G.box(0, 0, z, 2.4, 0.08, 0.06, c); G.beam(1.2, 0.04, z, 1.45, 0.35, z, 0.06, c); }
	for (let i = 0; i < 7; i++) G.box(-1 + i * 0.33, 0.2, 0, 0.12, 0.05, 0.85, shade(c, 1.1));
	for (let i = 0; i < 4; i++) G.box(-0.9 + i * 0.6, 0.06, 0, 0.06, 0.16, 0.7, c);
};
S.qamutik = S.sledge;
// a skiff pulled up and turned over for the winter
S.skiff = (B, L, P, r) => {
	const { G } = B, c = pick(r, [[0.85, 0.85, 0.82], [0.25, 0.4, 0.6], [0.7, 0.25, 0.2], [0.3, 0.5, 0.35]]);
	for (let i = 0; i < 6; i++) {
		const t0 = i / 6, t1 = (i + 1) / 6, ww = (t) => 0.75 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)), x0 = -2.5 + t0 * 5, x1 = -2.5 + t1 * 5;
		G.face([[x0, 0.05, -ww(t0)], [x1, 0.05, -ww(t1)], [x1, 0.6, -ww(t1) * 0.4], [x0, 0.6, -ww(t0) * 0.4]], c);
		G.face([[x1, 0.05, ww(t1)], [x0, 0.05, ww(t0)], [x0, 0.6, ww(t0) * 0.4], [x1, 0.6, ww(t1) * 0.4]], c);
		G.face([[x0, 0.6, -ww(t0) * 0.4], [x1, 0.6, -ww(t1) * 0.4], [x1, 0.6, ww(t1) * 0.4], [x0, 0.6, ww(t0) * 0.4]], shade(c, 0.9));
	}
	solid(B, 0, 0, 5, 1.4);
};
// a kayak on a rack
S.kayak = (B) => {
	const { G } = B;
	for (const x of [-1.5, 1.5]) G.box(x, 0, 0, 0.1, 1.1, 0.1, [0.4, 0.36, 0.3]);
	G.box(0, 1.05, 0, 3.6, 0.06, 0.08, [0.4, 0.36, 0.3]);
	G.cyl(0, 1.12, 0, 0.01, 0.01, 0.01, DARK, { n: 3 });
	for (const s of [-1, 1]) G.face([[0, 1.12, -0.28], [s * 2.6, 1.15, 0], [0, 1.4, 0]], [0.62, 0.5, 0.36]).face([[0, 1.12, 0.28], [s * 2.6, 1.15, 0], [0, 1.4, 0]], [0.58, 0.46, 0.32]);
};
S.fueltank = (B) => { B.G.box(0, 0, 0, 3.4, 0.4, 1.4, [0.4, 0.4, 0.4]).box(0, 0.4, 0, 3.2, 1.3, 1.3, [0.7, 0.7, 0.68]); solid(B, 0, 0, 3.4, 1.4); };
// a cache on stilts: a store out of reach of animals (the interior of Alaska)
S.cache = (B, L, P) => {
	const { G } = B;
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.cyl(sx * 0.8, 0, sz * 0.7, 0.13, 0.12, 3, [0.5, 0.42, 0.32], { n: 6 });
	G.box(0, 3, 0, 2.2, 1.6, 1.9, shade(P.wood, 0.9));
	G.gable(0, 4.6, 0, 2.2, 1.9, 0.9, P.roof, { o: 0.3, gc: P.wood, snow: snowK(P) * 0.8 });
	G.beam(0.8, 0, -1.9, 0.6, 3.1, -0.95, 0.08, [0.5, 0.42, 0.32]);
	solid(B, 0, 0, 2, 2);
};
// an inuksuk: stones stacked in the shape of a person, the marker of a way or a place
S.inuksuk = (B, L, P, r) => {
	const { G } = B, c = [0.42, 0.42, 0.4], s = 0.8 + r() * 0.6;
	G.box(-0.35 * s, 0, 0, 0.35 * s, 0.9 * s, 0.4 * s, shade(c, 1.05)).box(0.35 * s, 0, 0, 0.35 * s, 0.9 * s, 0.4 * s, shade(c, 0.95));
	G.box(0, 0.9 * s, 0, 1.3 * s, 0.3 * s, 0.45 * s, c).box(0, 1.2 * s, 0, 0.7 * s, 0.6 * s, 0.45 * s, shade(c, 1.1));
	G.box(0, 1.8 * s, 0, 1.6 * s, 0.22 * s, 0.4 * s, shade(c, 0.9)).box(0, 2.02 * s, 0, 0.45 * s, 0.4 * s, 0.4 * s, shade(c, 1.08));
	solid(B, 0, 0, 1.6 * s, 0.6 * s);
};

// ---------- churches, halls and the faiths' houses ----------
// Greenland's red wooden church: a simple nave and a small tower over the door
S['church-red'] = (B, L, P) => {
	const { G } = B, w = 14, d = 8, c = [0.68, 0.16, 0.12];
	footing(B, w, d, [0.4, 0.4, 0.4], 0.4);
	G.box(0, 0.4, 0, w, 4.5, d, c);
	G.gable(0, 4.9, 0, w, d, 3.2, [0.12, 0.12, 0.13], { o: 0.4, gc: c, snow: snowK(P) * 0.7 });
	G.box(-w / 2 + 1.5, 4.9, 0, 2.2, 3.5, 2.2, c).hip(-w / 2 + 1.5, 8.4, 0, 2.2, 2.2, 2.6, [0.12, 0.12, 0.13], { o: 0.15 });
	G.box(-w / 2 + 1.5, 11, 0, 0.08, 1.2, 0.08, [0.95, 0.95, 0.95]).box(-w / 2 + 1.5, 11.75, 0, 0.6, 0.08, 0.08, [0.95, 0.95, 0.95]);
	const L2 = { w, d };
	for (let i = 0; i < 4; i++) windowOn(B, 0, -3 + i * 2.6, 1.6, 1.0, 1.9, P, L2, { frame: [0.95, 0.95, 0.95], lit: 0.5 });
	doorOn(B, -w / 2 + 1.5, 1.4, 2.4, P, { w, d }, { side: 0, c: [0.95, 0.95, 0.93] });
	solid(B, 0, 0, w, d);
};
// a community hall (the north's): a long low box with a sign board
S.hall = (B, L, P) => {
	const { G } = B, w = 18, d = 10;
	footing(B, w, d, [0.4, 0.4, 0.4], 0.6);
	G.box(0, 0.6, 0, w, 4, d, P.wall2 || P.wall);
	G.gable(0, 4.6, 0, w, d, 1.6, P.roof, { o: 0.4, gc: P.wall2 || P.wall, snow: snowK(P) * 0.7 });
	for (let i = 0; i < 5; i++) windowOn(B, 0, -6 + i * 3, 1.6, 1.4, 1.1, P, { w, d }, { frame: P.trim, lit: 0.8 });
	doorOn(B, 7.5, 1.6, 2.2, P, { w, d });
	solid(B, 0, 0, w, d);
};
// a wooden church: a nave, a bell tower with a pointed spire (the Nordic north), or onion
// domes (the Orthodox north)
S['church-wood'] = (B, L, P) => {
	const { G } = B, w = 13, d = 8, c = P.orthodox ? shade(P.wood, 0.9) : P.churchWall || [0.9, 0.88, 0.82];
	footing(B, w, d, P.stone, 0.5);
	G.box(0, 0.5, 0, w, 5, d, c);
	G.gable(0, 5.5, 0, w, d, 3.6, P.orthodox ? [0.35, 0.4, 0.42] : P.roof, { o: 0.5, gc: c, snow: snowK(P) * 0.8 });
	if (P.orthodox) {
		G.cyl(1, 9, 0, 1.2, 1.2, 2, c, { n: 8 }).dome(1, 11, 0, 1.4, [0.25, 0.42, 0.6], { bulge: 0.6, k: 1, n: 10, rings: 6, tip: 1.4 });
		G.box(-w / 2 - 1.5, 0.5, 0, 3, 7, 3, c).hip(-w / 2 - 1.5, 7.5, 0, 3, 3, 4, [0.35, 0.4, 0.42], { o: 0.2 });
		G.dome(-w / 2 - 1.5, 11.5, 0, 0.6, [0.82, 0.68, 0.3], { bulge: 0.6, n: 8, rings: 5, tip: 1 });
	} else {
		G.box(-w / 2 - 1.6, 0.5, 0, 3.2, 8, 3.2, c);
		G.hip(-w / 2 - 1.6, 8.5, 0, 3.2, 3.2, 7, P.roof, { o: 0.2, snow: snowK(P) * 0.4 });
	}
	for (let i = 0; i < 3; i++) windowOn(B, 0, -2.5 + i * 3.2, 2, 1, 2, P, { w, d }, { frame: P.trim, lit: 0.45 });
	doorOn(B, -w / 2 - 1.6, 1.4, 2.4, P, { w: w + 6.4, d: 3.2 }, { c: shade(P.wood, 0.6) });
	solid(B, -1.6, 0, w + 3.2, d);
};
// a stone church: a nave and a square tower (the old villages)
S['church-stone'] = (B, L, P, r) => {
	const { G } = B, w = 18, d = 8, c = P.stone;
	footing(B, w, d, shade(c, 0.9), 0.3);
	G.box(0, 0.3, 0, w, 6, d, c);
	G.gable(0, 6.3, 0, w, d, 4, P.churchRoof || [0.32, 0.3, 0.3], { o: 0.3, gc: c, snow: snowK(P) * 0.7 });
	G.box(-w / 2 - 2.2, 0.3, 0, 4.4, 13, 4.4, shade(c, 1.03));
	if (r() < 0.5) G.hip(-w / 2 - 2.2, 13.3, 0, 4.4, 4.4, 8, P.churchRoof || [0.3, 0.3, 0.32], { o: 0.1 });
	else for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(-w / 2 - 2.2 + sx * 1.9, 13.3, sz * 1.9, 0.6, 1, 0.6, c);
	for (let i = 0; i < 4; i++) windowOn(B, 0, -6 + i * 4, 2.4, 1, 2.6, P, { w, d }, { frame: shade(c, 0.85), lit: 0.4 });
	doorOn(B, -w / 2 - 2.2, 1.6, 2.8, P, { w: w + 8.8, d: 4.4 }, { c: [0.3, 0.2, 0.14] });
	solid(B, -2.2, 0, w + 4.4, d);
};
// a white wooden church with a steeple (the farm country, the Pacific)
S['church-steeple'] = (B, L, P) => {
	const { G } = B, w = 14, d = 8, c = [0.94, 0.93, 0.9];
	footing(B, w, d, [0.5, 0.5, 0.5], 0.5);
	G.box(0, 0.5, 0, w, 5, d, c).gable(0, 5.5, 0, w, d, 3.5, P.churchRoof || [0.28, 0.28, 0.3], { o: 0.4, gc: c, snow: snowK(P) * 0.7 });
	G.box(-w / 2 - 1.4, 0.5, 0, 2.8, 9, 2.8, c).box(-w / 2 - 1.4, 9.5, 0, 2, 2.4, 2, c).hip(-w / 2 - 1.4, 11.9, 0, 2, 2, 6, P.churchRoof || [0.28, 0.28, 0.3], { o: 0.1 });
	for (let i = 0; i < 3; i++) windowOn(B, 0, -3 + i * 3.4, 1.8, 1, 2.2, P, { w, d }, { frame: c, lit: 0.45 });
	solid(B, -1.4, 0, w + 2.8, d);
};
S['church-white'] = S['church-steeple'];
// a small church of block and tin (the savanna, the rainforest villages)
S['church-small'] = (B, L, P) => {
	const { G } = B, w = 12, d = 7, c = [0.9, 0.88, 0.82];
	footing(B, w, d, [0.5, 0.48, 0.44], 0.3);
	G.box(0, 0.3, 0, w, 4, d, c).gable(0, 4.3, 0, w, d, 2.4, P.tin || [0.55, 0.56, 0.58], { o: 0.5, gc: c });
	G.box(-w / 2 + 0.2, 4.3, 0, 0.12, 3.6, 0.12, [0.95, 0.95, 0.95]).box(-w / 2 + 0.2, 7.1, 0, 0.12, 0.1, 1.4, [0.95, 0.95, 0.95]);
	for (let i = 0; i < 3; i++) windowOn(B, 0, -3 + i * 3, 1.6, 1, 1.4, P, { w, d }, { frame: [0.6, 0.45, 0.3], lit: 0.3 });
	solid(B, 0, 0, w, d);
};
// a school: a long block of classrooms under one roof, a veranda
S.school = (B, L, P) => {
	const { G } = B, w = 20, d = 7, c = P.wall2 || [0.9, 0.86, 0.72];
	footing(B, w, d, [0.5, 0.48, 0.44], 0.4);
	G.box(0, 0.4, 0, w, 3.2, d, c);
	G.box(0, 0.4, 0, w, 1.0, d + 0.02, [0.42, 0.52, 0.62], { top: false });
	G.gable(0, 3.6, 0, w, d + 2.4, 1.6, P.tin || [0.55, 0.56, 0.58], { o: 0.4 });
	for (let i = 0; i < 6; i++) windowOn(B, 0, -8.5 + i * 3.4, 1.4, 1.6, 1.2, P, { w, d }, { frame: [0.3, 0.4, 0.5], lit: 0.3 });
	for (let i = 0; i < 6; i++) G.box(-9.5 + i * 3.8, 0.4, -d / 2 - 1.1, 0.15, 3.1, 0.15, [0.4, 0.4, 0.4]);
	solid(B, 0, 0, w, d);
};
// a village store: a front with a sign board and a lit window
S.store = (B, L, P) => {
	const { G } = B, w = 12, d = 9;
	footing(B, w, d, [0.5, 0.48, 0.44], 0.4);
	G.box(0, 0.4, 0, w, 3.8, d, P.wall2 || P.wall).box(0, 4.2, -d / 2 + 0.1, w, 1.4, 0.3, P.wall2 || P.wall);
	G.gable(0, 4.2, 0, w, d, 1.5, P.roof, { o: 0.3, snow: snowK(P) * 0.7 });
	G.box(0, 4.3, -d / 2 - 0.12, w * 0.7, 0.8, 0.06, [0.9, 0.9, 0.86]);
	for (const x of [-3, 3]) windowOn(B, 0, x, 1, 2.6, 2, P, { w, d }, { frame: P.trim, lit: 1 });
	doorOn(B, 0, 1.2, 2.2, P, { w, d }, { c: [0.55, 0.6, 0.62] });
	G.box(0, 3.3, -d / 2 - 0.9, w, 0.1, 1.8, P.roof);
	solid(B, 0, 0, w, d);
};

// ---------- the mountains ----------
// a chalet: a stone or plastered ground floor, timber above, a wide low roof with deep eaves,
// a balcony along the gable with flowers at its rail
S.chalet = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H1 = 2.7, H2 = 2.6;
	footing(B, w, d, P.stone, 0.2);
	G.box(0, 0.2, 0, w, H1, d, P.plaster || P.stone);
	G.box(0, 0.2 + H1, 0, w, H2, d, P.wood);
	G.gable(0, 0.2 + H1 + H2, 0, d, w, w * 0.22, P.roof, { o: 1.1, r: Math.PI / 2, gc: P.wood, snow: snowK(P) });
	// the balcony across the gable end (the front)
	G.box(0, 0.2 + H1 + 0.2, -d / 2 - 0.6, w - 0.4, 0.12, 1.2, shade(P.wood, 0.85));
	G.box(0, 0.2 + H1 + 0.32, -d / 2 - 1.15, w - 0.4, 1, 0.08, shade(P.wood, 0.75));
	for (let i = 0; i < 6; i++) G.box(-w / 2 + 0.8 + i * (w - 1.6) / 5, 0.2 + H1 + 1.3, -d / 2 - 1.2, 0.5, 0.22, 0.25, pick(r, [[0.8, 0.12, 0.12], [0.85, 0.3, 0.45], [0.9, 0.85, 0.85]]));
	for (const x of [-w * 0.25, w * 0.25]) { windowOn(B, 0, x, 1.0, 0.9, 1.1, P, L, { frame: [0.9, 0.9, 0.86], shutter: P.shutter }); windowOn(B, 0, x, H1 + 1.0, 0.9, 1.1, P, L, { frame: [0.9, 0.9, 0.86], shutter: P.shutter, lit: 0.5 }); }
	windowOn(B, 2, 0, 1.0, 0.9, 1.1, P, L, { frame: [0.9, 0.9, 0.86], shutter: P.shutter });
	doorOn(B, 0, 1, 2.1, P, L, { c: shade(P.wood, 0.7) });
	chimney(B, w * 0.2, 0.2 + H1 + H2 + w * 0.12, d * 0.25, P.stone, 1.4);
	solid(B, 0, 0, w + 0.4, d + 0.4);
};
// a hay barn on stone piers
S.haybarn = (B, L, P) => {
	const { G } = B, w = 6, d = 5;
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(sx * (w / 2 - 0.3), -1, sz * (d / 2 - 0.3), 0.6, 1.8, 0.6, P.stone);
	G.box(0, 0.8, 0, w, 3, d, shade(P.wood, 0.75));
	G.gable(0, 3.8, 0, w, d, 1.6, P.roof, { o: 0.5, gc: shade(P.wood, 0.75), snow: snowK(P) });
	solid(B, 0, 0, w, d);
};
// a chapel: white walls, a pointed spire (the Alps)
S.chapel = (B, L, P) => {
	const { G } = B, w = 9, d = 6, c = [0.94, 0.93, 0.9];
	footing(B, w, d, P.stone, 0.4);
	G.box(0, 0.4, 0, w, 4.5, d, c).gable(0, 4.9, 0, w, d, 2.6, P.roof, { o: 0.4, gc: c, snow: snowK(P) });
	G.box(-w / 2 + 1.2, 4.9, 0, 2, 3, 2, c).hip(-w / 2 + 1.2, 7.9, 0, 2, 2, 5, [0.3, 0.34, 0.36], { o: 0.1 });
	for (let i = 0; i < 2; i++) windowOn(B, 0, 0 + i * 2.5, 2, 0.8, 1.6, P, { w, d }, { frame: c, lit: 0.4 });
	doorOn(B, -w / 2 + 1.2, 1.2, 2.3, P, { w, d }, { c: [0.35, 0.22, 0.14] });
	solid(B, 0, 0, w, d);
};
// a white chapel with a bell gable (the Andes)
S['chapel-white'] = (B, L, P) => {
	const { G } = B, w = 14, d = 7, c = [0.94, 0.92, 0.86];
	footing(B, w, d, P.stone, 0.4);
	G.box(0, 0.4, 0, w, 5, d, c).gable(0, 5.4, 0, w, d, 2.5, [0.68, 0.36, 0.24], { o: 0.4, gc: c });
	// the bell gable over the front, with two bells in their arches
	G.box(-w / 2 + 0.4, 5.4, 0, 0.8, 4.2, 5, c);
	for (const z of [-1.2, 1.2]) { G.cyl(-w / 2 + 0.4, 7.2, z, 0.25, 0.4, 0.6, [0.55, 0.42, 0.22], { n: 8 }); }
	doorOn(B, 0, 1.6, 2.8, P, { w: 0.8, d: 5 }, { side: 2, c: [0.3, 0.2, 0.12] });
	solid(B, 0, 0, w, d);
};
// a Himalayan stone house: thick whitewashed or stone walls narrowing up, windows framed in
// black, a flat roof with a parapet stacked with firewood, a flag on the corner
S.stonehouse = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 5.2 + r() * 1.5, c = r() < 0.6 ? [0.9, 0.88, 0.82] : P.stone;
	footing(B, w, d, P.stone, 0.3);
	G.box(0, 0.3, 0, w, H, d, c);
	G.box(0, 0.3 + H - 0.5, 0, w + 0.06, 0.5, d + 0.06, [0.42, 0.14, 0.1], { top: false });
	G.slab(0, 0.3 + H, 0, w + 0.3, d + 0.3, 0.25, [0.55, 0.45, 0.35]);
	// the parapet and the firewood along it
	for (const s of [-1, 1]) { G.box(0, 0.55 + H, s * d / 2, w, 0.6, 0.3, c); G.box(s * w / 2, 0.55 + H, 0, 0.3, 0.6, d, c); }
	G.box(0, 0.55 + H, d / 2 - 0.6, w - 0.8, 0.8, 0.7, [0.5, 0.4, 0.3]);
	for (const x of [-w * 0.25, w * 0.25]) for (const y of [1.2, H - 1.8]) windowOn(B, 0, x, y, 0.9, 1, P, L, { frame: [0.08, 0.08, 0.08], lit: y > 2 ? 0.5 : 0.3 });
	doorOn(B, 0, 1, 1.9, P, L, { c: [0.45, 0.2, 0.12], frame: [0.08, 0.08, 0.08] });
	S.flagpole(B, L, P, r, w / 2 - 0.3, -d / 2 + 0.3, 0.85 + H);
	B.smoke.push([w * 0.2, H + 1.2, 0]);
	solid(B, 0, 0, w + 0.3, d + 0.3);
};
// prayer flags on a pole: five colours (blue, white, red, green, yellow) in that order
S.flagpole = (B, L, P, r, x = 0, z = 0, y = 0) => {
	const { G } = B, h = 4 + r() * 2;
	G.box(x, y, z, 0.08, h, 0.08, [0.5, 0.42, 0.32]);
	const C5 = [[0.15, 0.35, 0.75], [0.95, 0.95, 0.93], [0.82, 0.18, 0.15], [0.15, 0.6, 0.3], [0.95, 0.8, 0.15]];
	for (let i = 0; i < 5; i++) G.sheet([[x + 0.05, y + h - 0.2 - i * 0.42, z], [x + 0.8, y + h - 0.2 - i * 0.42, z], [x + 0.8, y + h - 0.6 - i * 0.42, z], [x + 0.05, y + h - 0.6 - i * 0.42, z]], C5[i]);
};
// a chorten (stupa): a stepped white base, a dome, a spire of rings and a gilded top
S.chorten = (B, L, P, r, x = 0, z = 0, s = 1) => {
	const { G } = B, c = [0.94, 0.93, 0.9];
	G.box(x, 0, z, 4 * s, 1 * s, 4 * s, c).box(x, 1 * s, z, 3.4 * s, 0.6 * s, 3.4 * s, c).box(x, 1.6 * s, z, 2.8 * s, 0.6 * s, 2.8 * s, c);
	G.dome(x, 2.2 * s, z, 1.3 * s, c, { k: 1.1, n: 10, rings: 4 });
	G.box(x, 3.5 * s, z, 1 * s, 0.6 * s, 1 * s, c);
	G.cyl(x, 4.1 * s, z, 0.45 * s, 0.15 * s, 2.2 * s, [0.75, 0.6, 0.28], { n: 8 });
	G.cyl(x, 6.3 * s, z, 0.22 * s, 0.01, 0.6 * s, [0.85, 0.7, 0.3], { n: 6, top: false });
	solid(B, x, z, 4 * s, 4 * s);
};
// a mani wall: a long low wall of carved prayer stones, walked past keeping it on your right
S.maniwall = (B) => { const { G } = B; G.box(0, 0, 0, 9, 1.2, 1.2, [0.55, 0.53, 0.5]); for (let i = 0; i < 9; i++) G.box(-4 + i, 1.2, 0, 0.8, 0.12, 1, [0.62, 0.6, 0.56]); solid(B, 0, 0, 9, 1.2); };
// a prayer wheel in a small shelter
S.prayerwheel = (B) => { const { G } = B; G.box(0, 0, 0, 1.6, 0.2, 1.6, [0.55, 0.53, 0.5]); for (const sx of [-1, 1]) G.box(sx * 0.7, 0.2, 0, 0.12, 2.2, 0.12, [0.45, 0.15, 0.1]); G.cyl(0, 0.6, 0, 0.35, 0.35, 0.9, [0.78, 0.6, 0.25], { n: 10 }); G.gable(0, 2.4, 0, 1.6, 1.6, 0.5, [0.45, 0.15, 0.1], { o: 0.2 }); solid(B, 0, 0, 1.6, 1.6); };
// a monastery: a broad whitewashed block, a band of deep red below the roof, a gilded roof
S.gompa = (B, L, P) => {
	const { G } = B, w = 22, d = 16, c = [0.93, 0.9, 0.84];
	footing(B, w, d, P.stone, 0.4);
	G.box(0, 0.4, 0, w, 9, d, c, { top: false }).box(0, 9.4, 0, w + 0.1, 1.6, d + 0.1, [0.45, 0.12, 0.1]);
	G.slab(0, 11, 0, w + 0.3, d + 0.3, 0.3, [0.5, 0.4, 0.32]);
	G.box(0, 11.3, 2, 8, 3.5, 6, [0.45, 0.12, 0.1]);
	G.hip(0, 14.8, 2, 8, 6, 2, [0.85, 0.66, 0.25], { o: 0.5, k: 0.3, curl: 0.3 });
	G.cyl(0, 16.8, 2, 0.3, 0.1, 1.2, [0.9, 0.75, 0.3], { n: 6 });
	for (let i = 0; i < 5; i++) for (const y of [2, 5.5]) windowOn(B, 0, -8 + i * 4, y, 1.2, 1.5, P, { w, d }, { frame: [0.08, 0.08, 0.08], lit: 0.5 });
	doorOn(B, 0, 2.4, 3.2, P, { w, d }, { c: [0.6, 0.15, 0.1], frame: [0.85, 0.66, 0.25] });
	for (const s of [-1, 1]) S.flagpole(B, L, P, () => 0.5, s * (w / 2 + 2), -d / 2 - 2, 0);
	solid(B, 0, 0, w, d);
};
// an adobe house with a steep thatch roof (the Andes)
S.adobethatch = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 2.6;
	footing(B, w, d, P.stone, 0.5);
	G.box(0, 0.5, 0, w, H, d, P.mud);
	if (r() < 0.6) G.hip(0, 0.5 + H, 0, w, d, Math.min(w, d) * 0.55, P.thatch, { o: 0.5, k: 0.4 });
	else G.gable(0, 0.5 + H, 0, w, d, d * 0.3, P.tin, { o: 0.4, gc: P.mud });
	doorOn(B, -w * 0.15, 0.9, 1.8, P, L, { c: [0.25, 0.4, 0.55], frame: P.mud });
	windowOn(B, 0, w * 0.25, 1.4, 0.6, 0.6, P, L, { frame: [0.25, 0.4, 0.55], lit: 0.3 });
	B.smoke.push([w * 0.2, 0.5 + H + 1, 0]);
	solid(B, 0, 0, w + 0.3, d + 0.3);
};
// a stone corral for llamas and alpacas
S.corral = (B, L, P) => { const { G } = B, R = 4; for (let i = 0; i < 12; i++) { if (i === 3) continue; const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2; G.beam(Math.cos(a) * R, 0.5, Math.sin(a) * R, Math.cos(b) * R, 0.5, Math.sin(b) * R, 1, P.stone); } };
// a clay oven (a horno or an Andean oven), domed
S.oven = (B, L, P) => { B.G.dome(0, 0, 0, 0.9, P.mud, { k: 1, n: 8, rings: 3 }); B.G.box(0, 0, -0.85, 0.4, 0.4, 0.15, DARK); B.smoke.push([0, 1.1, 0.2]); };

// ---------- farms and villages ----------
// a farmhouse: two storeys of clapboard, a gable, a porch across the front
S.farmhouse = (B, L, P) => {
	const { G } = B, w = Math.max(L.w, 9), d = Math.max(L.d, 8), H = 5.4;
	footing(B, w, d, [0.5, 0.48, 0.45], 0.6);
	G.box(0, 0.6, 0, w, H, d, P.wall);
	for (let k = 1; k < 14; k++) G.box(0, 0.6 + k * H / 14, 0, w + 0.02, 0.025, d + 0.02, shade(P.wall, 0.9), { top: false });
	G.gable(0, 0.6 + H, 0, w, d, d * 0.42, P.roof, { o: 0.4, gc: P.wall, snow: snowK(P) * 0.8 });
	G.slab(0, 0.6, -d / 2 - 1.2, w, 2.4, 0.15, [0.55, 0.52, 0.48]);
	for (let i = 0; i < 5; i++) G.box(-w / 2 + 0.3 + i * (w - 0.6) / 4, 0.75, -d / 2 - 2.25, 0.15, 2.5, 0.15, [0.92, 0.92, 0.9]);
	G.slab(0, 3.25, -d / 2 - 1.2, w, 2.6, 0.12, P.roof);
	for (const x of [-w * 0.3, w * 0.3]) { windowOn(B, 0, x, 1.6, 0.9, 1.4, P, { w, d }, { frame: [0.95, 0.95, 0.93], shutter: P.shutter }); windowOn(B, 0, x, 4.0, 0.9, 1.2, P, { w, d }, { frame: [0.95, 0.95, 0.93], shutter: P.shutter, lit: 0.5 }); }
	doorOn(B, 0, 1, 2.1, P, { w, d }, { c: P.door });
	chimney(B, w * 0.3, 0.6 + H + 1, d * 0.1, [0.5, 0.25, 0.2], 1.6);
	solid(B, 0, 0, w, d);
};
S.silo = (B) => { B.G.cyl(0, 0, 0, 2.6, 2.6, 14, [0.72, 0.72, 0.7], { n: 14, top: false }).dome(0, 14, 0, 2.6, [0.78, 0.78, 0.76], { k: 0.6, n: 14, rings: 3 }); solid(B, 0, 0, 5, 5); };
// a water-pumping windmill: a lattice tower, a rotor of blades and a tail vane
S.windmill = (B, L, P, r) => {
	const { G } = B, H = 9, c = [0.55, 0.55, 0.56];
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.beam(sx * 1.2, 0, sz * 1.2, sx * 0.25, H, sz * 0.25, 0.08, c);
	for (let k = 1; k < 5; k++) { const y = k * H / 5, s = 1.2 - (0.95 * k / 5); G.box(0, y, 0, s * 2, 0.05, s * 2, c, { top: false }); }
	const a0 = r() * 6;
	for (let i = 0; i < 12; i++) { const a = a0 + i / 12 * Math.PI * 2; G.beam(Math.cos(a) * 0.3, H + 0.5 + Math.sin(a) * 0.3, -0.5, Math.cos(a) * 1.6, H + 0.5 + Math.sin(a) * 1.6, -0.5, 0.18, [0.78, 0.78, 0.78]); }
	G.box(0, H + 0.4, 0.8, 0.06, 0.8, 1.6, [0.75, 0.75, 0.75]);
	solid(B, 0, 0, 2.6, 2.6);
};
S.fence = (B) => { const { G } = B; for (let i = 0; i < 6; i++) G.box(-5 + i * 2, 0, 0, 0.12, 1.2, 0.12, [0.5, 0.42, 0.32]); for (const y of [0.5, 1]) G.box(0, y, 0, 10, 0.08, 0.04, [0.55, 0.47, 0.36]); };
S.bales = (B, L, P, r) => { for (let i = 0; i < 4; i++) B.G.cyl(-3 + i * 2 + r() * 0.3, 0, r() * 1.5, 0.8, 0.8, 1.2, [0.78, 0.68, 0.42], { n: 10 }); };
S.truck = (B, L, P, r) => { const c = pick(r, [[0.6, 0.12, 0.1], [0.85, 0.85, 0.82], [0.2, 0.3, 0.45], [0.3, 0.32, 0.3]]); B.G.box(0, 0.4, 0, 5, 0.9, 1.9, c).box(0.6, 1.3, 0, 1.8, 0.8, 1.8, c).box(-1.3, 1.3, 0, 2.2, 0.2, 1.8, shade(c, 0.8)); for (const x of [-1.6, 1.6]) for (const z of [-0.95, 0.95]) B.G.cyl(x, 0, z, 0.35, 0.35, 0.01, DARK, { n: 8 }); solid(B, 0, 0, 5, 2); };
// a cottage: stone or plaster under a steep tile or slate roof, a chimney at the gable
S.cottage = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = r() < 0.5 ? 2.8 : 5.2;
	footing(B, w, d, P.stone, 0.2);
	G.box(0, 0.2, 0, w, H, d, r() < 0.5 ? P.stone : P.wall);
	G.gable(0, 0.2 + H, 0, w, d, d * 0.55, P.roof, { o: 0.25, gc: r() < 0.5 ? P.stone : P.wall, snow: snowK(P) * 0.85 });
	for (const x of [-w * 0.28, w * 0.28]) windowOn(B, 0, x, 1.2, 0.8, 1.1, P, L, { frame: P.trim, shutter: P.shutter });
	if (H > 4) for (const x of [-w * 0.28, w * 0.28]) windowOn(B, 0, x, 3.7, 0.8, 1, P, L, { frame: P.trim, lit: 0.5 });
	doorOn(B, 0, 0.95, 2, P, L);
	chimney(B, w / 2 - 0.4, 0.2 + H + d * 0.3, 0, P.stone, 1.4);
	solid(B, 0, 0, w, d);
};
// a half-timbered house: plaster panels between dark beams, a steep roof
S.halftimber = (B, L, P) => {
	const { G } = B, w = L.w, d = L.d, beam = [0.24, 0.16, 0.1], wall = [0.93, 0.9, 0.82];
	footing(B, w, d, P.stone, 0.3);
	G.box(0, 0.3, 0, w, 2.6, d, P.stone).box(0, 2.9, 0, w + 0.3, 3, d + 0.3, wall);
	for (let i = 0; i <= 6; i++) { const x = -w / 2 - 0.15 + i * (w + 0.3) / 6; G.box(x, 2.9, -d / 2 - 0.17, 0.18, 3, 0.04, beam); G.box(x, 2.9, d / 2 + 0.17, 0.18, 3, 0.04, beam); }
	for (const y of [2.9, 4.4, 5.8]) G.box(0, y, 0, w + 0.34, 0.16, d + 0.34, beam, { top: false });
	for (let i = 0; i < 3; i++) { const x0 = -w / 2 + i * w / 3; G.face([[x0, 2.95, -d / 2 - 0.2], [x0 + w / 6, 4.35, -d / 2 - 0.2], [x0 + w / 6 + 0.18, 4.35, -d / 2 - 0.2], [x0 + 0.18, 2.95, -d / 2 - 0.2]], beam); }
	G.gable(0, 5.9 + 0.3, 0, w + 0.3, d + 0.3, d * 0.7, P.roof, { o: 0.3, gc: wall, snow: snowK(P) * 0.85 });
	for (const x of [-w * 0.25, w * 0.25]) { windowOn(B, 0, x, 1.0, 0.8, 1, P, L); windowOn(B, 0, x, 3.6, 0.8, 1, { ...P, trim: beam }, { w: w + 0.3, d: d + 0.3 }, { lit: 0.5 }); }
	doorOn(B, 0, 1, 2.1, P, L, { c: [0.32, 0.2, 0.12] });
	solid(B, 0, 0, w + 0.3, d + 0.3);
};
// a cart by a wall
S.cart = (B, L, P) => { const { G } = B, c = shade(P.wood, 0.85); G.box(0, 0.6, 0, 2.2, 0.5, 1.3, c); for (const z of [-0.7, 0.7]) G.cyl(0, 0.55, z, 0.55, 0.55, 0.06, [0.35, 0.28, 0.2], { n: 10 }); G.beam(1.1, 0.8, -0.3, 2.6, 0.3, -0.3, 0.07, c).beam(1.1, 0.8, 0.3, 2.6, 0.3, 0.3, 0.07, c); };
S.well = (B, L, P) => { const { G } = B; G.cyl(0, 0, 0, 1, 1, 0.9, P.stone, { n: 10, topc: DARK }); for (const s of [-1, 1]) G.box(s * 0.9, 0.9, 0, 0.12, 1.4, 0.12, shade(P.wood, 0.8)); G.box(0, 2.2, 0, 2, 0.12, 0.12, shade(P.wood, 0.8)); solid(B, 0, 0, 2, 2); };
S.bench = (B, L, P) => { const { G } = B; G.box(0, 0.42, 0, 1.8, 0.06, 0.4, shade(P.wood, 0.9)); for (const x of [-0.7, 0.7]) G.box(x, 0, 0, 0.08, 0.42, 0.35, shade(P.wood, 0.7)); };
S.trough = (B, L, P) => { const { G } = B; G.box(0, 0, 0, 2.4, 0.7, 0.8, P.stone, { topc: [0.3, 0.4, 0.45] }); G.box(-1.1, 0.7, 0, 0.2, 1, 0.2, P.stone); solid(B, 0, 0, 2.4, 0.8); };
S.hayrack = (B, L, P) => { const { G } = B; for (const x of [-2, 0, 2]) G.box(x, 0, 0, 0.12, 2.2, 0.12, shade(P.wood, 0.7)); for (let k = 0; k < 5; k++) G.box(0, 0.4 + k * 0.4, 0, 4.2, 0.06, 0.06, shade(P.wood, 0.75)); G.box(0, 0.4, 0.05, 3.8, 1.5, 0.25, [0.7, 0.65, 0.4]); };
S.wall = (B, L, P, r) => { const n = 3 + Math.floor(r() * 4); for (let i = 0; i < n; i++) B.G.box(-n + i * 2, 0, 0, 2.05, 0.9 + r() * 0.2, 0.55, shade(P.stone, 0.9 + r() * 0.2)); solid(B, 0, 0, n * 2, 0.6); };
S.oldbarn = S.barn;

// ---------- the Mediterranean ----------
// a whitewashed cube house: thick walls, a flat roof with a low parapet, a blue door and shutters,
// sometimes a second cube on top
S.cube = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 3 + r() * 0.4, c = [0.95, 0.95, 0.93], blue = P.shutter || [0.15, 0.35, 0.6];
	footing(B, w, d, c, 0.2);
	G.box(0, 0.2, 0, w, H, d, c);
	G.box(0, 0.2 + H, 0, w, 0.35, d, c, { top: false });
	if (r() < 0.5) { const w2 = w * 0.55, d2 = d * 0.6; G.box(w * 0.2, 0.2 + H, d * 0.18, w2, 2.6, d2, c); windowOn(B, 0, w * 0.2, H + 1.2, 0.7, 0.9, P, { w: w2, d: -d2 + d * 0.36 * 2 }, { frame: c, shutter: blue, lit: 0.5 }); }
	doorOn(B, -w * 0.2, 0.95, 2, P, L, { c: blue, frame: c });
	windowOn(B, 0, w * 0.22, 1.2, 0.7, 0.9, P, L, { frame: c, shutter: blue });
	windowOn(B, 2, 0, 1.2, 0.7, 0.9, P, L, { frame: c, shutter: blue });
	solid(B, 0, 0, w, d);
};
// a stone house with a low terracotta roof and green shutters
S.stonetile = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = r() < 0.5 ? 3 : 5.6, c = r() < 0.6 ? P.stone : P.wall;
	footing(B, w, d, P.stone, 0.2);
	G.box(0, 0.2, 0, w, H, d, c);
	G.hip(0, 0.2 + H, 0, w, d, Math.min(w, d) * 0.22, P.roof, { o: 0.35, k: 0.5 });
	for (const x of [-w * 0.25, w * 0.25]) { windowOn(B, 0, x, 1.1, 0.8, 1.1, P, L, { frame: shade(c, 0.9), shutter: P.shutter }); if (H > 4) windowOn(B, 0, x, 3.7, 0.8, 1.1, P, L, { frame: shade(c, 0.9), shutter: P.shutter, lit: 0.5 }); }
	doorOn(B, 0, 1, 2.1, P, L, { c: [0.35, 0.22, 0.14], frame: shade(c, 0.85) });
	solid(B, 0, 0, w, d);
};
// a bell tower with its church: a white church with a blue dome (the Greek islands) or a
// stone campanile (Italy, Spain)
S.belltower = (B, L, P) => {
	const { G } = B;
	if (P.blueDome) {
		const c = [0.96, 0.96, 0.94];
		G.box(0, 0, 0, 9, 4.5, 7, c).cyl(0, 4.5, 0, 2.4, 2.4, 1.2, c, { n: 12 }).dome(0, 5.7, 0, 2.4, [0.15, 0.38, 0.72], { k: 0.9, n: 14, rings: 5, tip: 0.8 });
		G.box(-5.5, 0, 0, 2, 7, 2, c).box(-5.5, 7, 0, 2.2, 0.3, 2.2, c).arch(-5.5, 4.5, -1.01, 1.2, 2.2, 0.15, [0.15, 0.38, 0.72]);
		doorOn(B, 0, 1.2, 2.3, P, { w: 9, d: 7 }, { c: [0.15, 0.38, 0.72], frame: c });
		solid(B, -1, 0, 11, 7);
		return;
	}
	const c = P.stone;
	G.box(0, 0, 0, 14, 7, 9, c).gable(0, 7, 0, 14, 9, 2.4, P.roof, { o: 0.3, gc: c });
	G.box(-9, 0, 0, 3.4, 18, 3.4, shade(c, 1.04)).hip(-9, 18, 0, 3.4, 3.4, 2, P.roof, { o: 0.2 });
	for (const s of [-1, 1]) G.arch(-9 + s * 0, 14, -1.72, 1.4, 2.4, 0.2, shade(c, 0.85));
	doorOn(B, 0, 1.6, 3, P, { w: 14, d: 9 }, { c: [0.32, 0.2, 0.12] });
	solid(B, -2, 0, 17, 9);
};
S.pergola = (B, L, P) => { const { G } = B; for (const x of [-1.8, 1.8]) for (const z of [-1.2, 1.2]) G.box(x, 0, z, 0.15, 2.4, 0.15, shade(P.wood, 0.85)); for (let i = 0; i < 6; i++) G.box(-1.9 + i * 0.76, 2.4, 0, 0.1, 0.1, 2.8, shade(P.wood, 0.8)); G.slab(0, 2.5, 0, 4.2, 3, 0.12, [0.35, 0.52, 0.25]); };
S.pots = (B, L, P, r) => { for (let i = 0; i < 4; i++) { const x = -1 + i * 0.7, s = 0.5 + r() * 0.4; B.G.cyl(x, 0, 0, 0.2 * s, 0.32 * s, 0.5 * s, [0.72, 0.38, 0.24], { n: 8 }); B.G.dome(x, 0.5 * s, 0, 0.35 * s, pick(r, [[0.25, 0.5, 0.2], [0.8, 0.2, 0.4], [0.3, 0.55, 0.25]]), { n: 6, rings: 2 }); } };

// ---------- the dry lands ----------
// an adobe house: mud-brick walls rendered smooth and rounded at the top, a flat roof with
// a parapet, the roof beams' ends showing, small windows, a heavy wooden door
S.adobe = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 3 + r() * 1.2, c = P.mud;
	footing(B, w, d, shade(c, 0.9), 0.1);
	G.box(0, 0.1, 0, w, H, d, c);
	G.box(0, 0.1 + H, 0, w, 0.5, d, c, { top: false });
	for (let i = 0; i < Math.floor(w / 0.9); i++) G.cyl(-w / 2 + 0.5 + i * 0.9, H - 0.4, -d / 2 - 0.15, 0.08, 0.08, 0.01, [0.4, 0.3, 0.2], { n: 5 });
	for (let i = 0; i < Math.floor(w / 0.9); i++) G.box(-w / 2 + 0.5 + i * 0.9, H - 0.45, -d / 2 - 0.25, 0.16, 0.16, 0.5, [0.42, 0.32, 0.22]);
	if (r() < 0.4) G.box(w * 0.2, 0.1 + H, d * 0.15, w * 0.45, 2.4, d * 0.5, c);
	doorOn(B, -w * 0.18, 1, 2, P, L, { c: P.door || [0.42, 0.3, 0.2], frame: shade(c, 0.85) });
	windowOn(B, 0, w * 0.25, 1.5, 0.5, 0.6, P, L, { frame: shade(c, 0.85), lit: 0.4, deep: 0.15 });
	windowOn(B, 2, 0, 1.5, 0.5, 0.6, P, L, { frame: shade(c, 0.85), lit: 0.3, deep: 0.15 });
	if (P.pueblo && r() < 0.6) S.ladder(B, L, P, r, w / 2 + 0.3, 0, H);
	solid(B, 0, 0, w, d);
};
// a courtyard house: rooms on four sides of an open court, one door to the lane
S.courtyard = (B, L, P, r) => {
	const { G } = B, w = Math.max(L.w, 12), d = Math.max(L.d, 12), H = 3.6 + r() * 2.4, t = 3.2, c = P.mud || P.wall;
	footing(B, w, d, shade(c, 0.9), 0.1);
	G.box(0, 0.1, -d / 2 + t / 2, w, H, t, c).box(0, 0.1, d / 2 - t / 2, w, H, t, c);
	G.box(-w / 2 + t / 2, 0.1, 0, t, H, d - 2 * t, c).box(w / 2 - t / 2, 0.1, 0, t, H, d - 2 * t, c);
	for (const s of [-1, 1]) { G.box(0, 0.1 + H, s * (d / 2 - 0.15), w, 0.5, 0.3, c); G.box(s * (w / 2 - 0.15), 0.1 + H, 0, 0.3, 0.5, d, c); }
	// the court: a tree or a fountain in the middle, arches round it
	if (r() < 0.6) G.cyl(0, 0.1, 0, 0.7, 0.7, 0.5, [0.85, 0.82, 0.75], { n: 8, topc: [0.3, 0.45, 0.55] });
	doorOn(B, 0, 1.3, 2.4, P, { w, d }, { c: P.door || [0.42, 0.3, 0.2], frame: shade(c, 0.85) });
	for (const x of [-w * 0.3, w * 0.3]) windowOn(B, 0, x, 2.2, 0.6, 0.8, P, { w, d }, { frame: shade(c, 0.85), lit: 0.4, deep: 0.15 });
	solid(B, 0, -d / 2 + t / 2, w, t); solid(B, 0, d / 2 - t / 2, w, t); solid(B, -w / 2 + t / 2, 0, t, d); solid(B, w / 2 - t / 2, 0, t, d);
};
// shade cloth on poles
S.shade = (B, L, P, r) => { const { G } = B, c = pick(r, [[0.85, 0.8, 0.68], [0.7, 0.35, 0.2], [0.4, 0.45, 0.55], [0.85, 0.85, 0.82]]); for (const x of [-2, 2]) for (const z of [-1.5, 1.5]) G.box(x, 0, z, 0.08, 2.6, 0.08, [0.45, 0.38, 0.3]); G.sheet([[-2.2, 2.65, -1.7], [2.2, 2.55, -1.7], [2.2, 2.55, 1.7], [-2.2, 2.65, 1.7]], c); };
S.jars = (B, L, P, r) => { for (let i = 0; i < 3; i++) { const x = -0.6 + i * 0.6; B.G.cyl(x, 0, 0, 0.18, 0.3, 0.35, [0.68, 0.42, 0.28], { n: 8, top: false }).cyl(x, 0.35, 0, 0.3, 0.12, 0.35, [0.68, 0.42, 0.28], { n: 8 }); } void r; };
S.oldwell = S.well;
// a palm grove's water channel and its low walls (the trees themselves are flora)
S.palmgrove = (B, L, P) => { B.G.box(0, 0, 0, 8, 0.25, 0.5, shade(P.mud, 0.9), { topc: [0.3, 0.4, 0.42] }); };
// a nomad's tent: a low wide roof of cloth or leather on poles, the sides rolled up in the heat
S.nomadtent = (B, L, P, r) => {
	const { G } = B, w = 8, d = 5, c = r() < 0.5 ? [0.18, 0.16, 0.15] : [0.62, 0.45, 0.32];
	for (const x of [-3, 0, 3]) G.box(x, 0, 0, 0.1, 2.1, 0.1, [0.45, 0.36, 0.26]);
	for (const x of [-3.8, 3.8]) for (const z of [-2.4, 2.4]) G.box(x, 0, z, 0.08, 1.2, 0.08, [0.45, 0.36, 0.26]);
	G.sheet([[-4, 1.2, -2.5], [4, 1.2, -2.5], [4, 2.1, 0], [-4, 2.1, 0]], c).sheet([[4, 1.2, 2.5], [-4, 1.2, 2.5], [-4, 2.1, 0], [4, 2.1, 0]], c);
	G.sheet([[-4, 0, 2.5], [4, 0, 2.5], [4, 1.2, 2.5], [-4, 1.2, 2.5]], shade(c, 1.1));
	G.slab(0, 0.02, 0, w - 1, d - 1, 0.03, [0.6, 0.2, 0.15]);
	solid(B, 0, 0.6, w, 3);
};
// a ladder up to a roof
S.ladder = (B, L, P, r, x = 0, z = 0, h = 3.5) => { const { G } = B; for (const s of [-0.25, 0.25]) G.beam(x, 0, z + s, x + 0.4, h + 1.2, z + s, 0.08, [0.5, 0.4, 0.28]); for (let k = 0; k < 7; k++) G.box(x + k * 0.06, 0.3 + k * 0.6, z, 0.06, 0.06, 0.55, [0.5, 0.4, 0.28]); };
// a pueblo: rooms stepped back as they rise, ladders to the upper terraces
S.pueblo = (B, L, P, r) => {
	const { G } = B, w = Math.max(L.w, 10), d = Math.max(L.d, 8), c = P.mud;
	footing(B, w, d, shade(c, 0.9), 0.1);
	G.box(0, 0.1, 0, w, 3, d, c).box(-w * 0.15, 3.1, d * 0.12, w * 0.7, 3, d * 0.75, c).box(-w * 0.25, 6.1, d * 0.2, w * 0.4, 2.8, d * 0.5, c);
	for (const [y, ww, dd, zz] of [[2.6, w, d, 0], [5.6, w * 0.7, d * 0.75, d * 0.12]]) for (let i = 0; i < Math.floor(ww / 1); i++) G.box(-ww / 2 + 0.5 + i, y, zz - dd / 2 - 0.2, 0.14, 0.14, 0.4, [0.42, 0.32, 0.22]);
	for (const x of [-w * 0.3, w * 0.1]) doorOn(B, x, 0.8, 1.7, P, { w, d }, { c: [0.25, 0.42, 0.55], frame: shade(c, 0.85) });
	S.ladder(B, L, P, r, w * 0.3, -d / 2 + 0.6, 3);
	solid(B, 0, 0, w, d);
};
// a mission church of adobe with two bell towers
S.mission = (B, L, P) => {
	const { G } = B, w = 22, d = 9, c = P.mud;
	G.box(0, 0, 0, w, 7, d, c).box(0, 7, 0, w, 0.6, d, c, { top: false });
	for (const s of [-1, 1]) { G.box(-w / 2 + 1.5, 0, s * (d / 2 - 1), 3, 10, 2.6, c); G.arch(-w / 2 - 0.01, 7.5, s * (d / 2 - 1), 1.2, 2, 0.2, shade(c, 0.85), { r: Math.PI / 2 }); G.box(-w / 2 + 1.5, 10, s * (d / 2 - 1), 0.1, 1.4, 0.1, [0.4, 0.3, 0.2]); }
	doorOn(B, 0, 2, 3.4, P, { w: 0.01, d }, { side: 2, c: [0.35, 0.22, 0.14] });
	solid(B, 0, 0, w, d);
};
S.ristra = (B) => { B.G.box(0, 0, 0, 0.1, 2, 0.1, [0.45, 0.36, 0.26]).box(0, 0.8, -0.12, 0.25, 1.1, 0.25, [0.7, 0.12, 0.08]); };
// an outback homestead: an iron roof over a verandah all round, a rainwater tank
S.homestead = (B, L, P) => {
	const { G } = B, w = Math.max(L.w, 12), d = Math.max(L.d, 10);
	G.box(0, -0.6, 0, w + 4, 1.2, d + 4, [0.55, 0.5, 0.45]);
	G.box(0, 0.6, 0, w, 3, d, P.wall);
	G.hip(0, 3.6, 0, w + 4, d + 4, 2.6, [0.62, 0.64, 0.66], { o: 0.1, k: 0.5 });
	for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { G.box(-w / 2 - 1.8 + i * (w + 3.6) / 4, 0.6, s * (d / 2 + 1.8), 0.12, 3, 0.12, [0.9, 0.9, 0.88]); }
	for (const x of [-w * 0.3, 0, w * 0.3]) windowOn(B, 0, x, 1.6, 1, 1.2, P, { w, d }, { frame: [0.9, 0.9, 0.88] });
	doorOn(B, w * 0.15, 0.95, 2.1, P, { w, d });
	S.tank(B, L, P, null, w / 2 + 3.5, 0);
	solid(B, 0, 0, w, d);
};
S.tank = (B, L, P, r, x = 0, z = 0) => { B.G.cyl(x, 0, z, 1.6, 1.6, 2.4, [0.66, 0.68, 0.7], { n: 14, top: false }); for (let k = 0; k < 8; k++) B.G.cyl(x, 0.15 + k * 0.3, z, 1.62, 1.62, 0.02, [0.55, 0.57, 0.6], { n: 14, top: false }); B.G.cone(x, 2.4, z, 1.7, 0.4, [0.62, 0.64, 0.66], 14); solid(B, x, z, 3.2, 3.2); };

// ---------- the bazaar ----------
// a town house of the old quarters: two or three storeys, a flat roof, arches below, a
// wooden screened window above the lane
S.townhouse = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, n = 2 + Math.floor(r() * 2), H = n * 3.2, c = pick(r, P.walls || [P.wall]);
	footing(B, w, d, shade(c, 0.9), 0.1);
	G.box(0, 0.1, 0, w, H, d, c).box(0, 0.1 + H, 0, w, 0.6, d, c, { top: false });
	for (let i = 0; i < Math.max(1, Math.floor(w / 3.2)); i++) { const x = -w / 2 + 1.6 + i * 3.2; G.arch(x, 0.1, -d / 2 - 0.02, 2.2, 3, 0.25, shade(c, 0.85)); G.face([[x - 1.1, 0.1, -d / 2 - 0.03], [x + 1.1, 0.1, -d / 2 - 0.03], [x + 1.1, 2.0, -d / 2 - 0.03], [x - 1.1, 2.0, -d / 2 - 0.03]], [0.18, 0.15, 0.12]); }
	if (r() < 0.6) {
		const x = (r() - 0.5) * w * 0.4;
		G.box(x, 3.6, -d / 2 - 0.5, 2.4, 2.2, 1, [0.4, 0.28, 0.18]);
		for (let k = 0; k < 8; k++) G.box(x - 1.05 + k * 0.3, 3.8, -d / 2 - 1.02, 0.05, 1.8, 0.04, [0.3, 0.2, 0.12]);
		B.glow?.face([[x - 1.1, 3.8, -d / 2 - 1.01], [x + 1.1, 3.8, -d / 2 - 1.01], [x + 1.1, 5.6, -d / 2 - 1.01], [x - 1.1, 5.6, -d / 2 - 1.01]], WARM.map((v) => v * 0.5));
	}
	for (let k = 1; k < n; k++) for (const x of [-w * 0.3, w * 0.3]) windowOn(B, 0, x, k * 3.2 + 1, 0.8, 1.2, P, L, { frame: shade(c, 0.8), lit: 0.6, shutter: r() < 0.4 ? [0.2, 0.4, 0.45] : null });
	if (r() < 0.3) G.dome(w * 0.25, 0.1 + H, d * 0.2, 1.4, shade(c, 1.05), { k: 0.8, n: 10, rings: 4 });
	solid(B, 0, 0, w, d);
};
// a souk stall: a counter under an awning, its goods laid out (spices in heaps, cloth in
// bolts, brass and copper, carpets hung, fruit in crates); a lamp over it
S.stall = (B, L, P, r) => {
	const { G, glow } = B, w = 2.6, d = 1.8, kind = Math.floor(r() * 6);
	const awn = pick(r, [[0.75, 0.2, 0.15], [0.2, 0.35, 0.55], [0.85, 0.7, 0.35], [0.3, 0.5, 0.3], [0.88, 0.85, 0.78]]);
	for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) G.box(x, 0, z, 0.08, 2.4, 0.08, [0.35, 0.28, 0.2]);
	G.sheet([[-w / 2 - 0.1, 2.5, -d / 2 - 0.6], [w / 2 + 0.1, 2.5, -d / 2 - 0.6], [w / 2 + 0.1, 2.3, d / 2], [-w / 2 - 0.1, 2.3, d / 2]], awn);
	G.box(0, 0, -d / 2 + 0.35, w, 0.85, 0.7, [0.45, 0.34, 0.24]);
	const top = 0.85, gz = -d / 2 + 0.35;
	if (kind === 0) { // spices
		for (let i = 0; i < 6; i++) G.cone(-w / 2 + 0.25 + i * 0.42, top, gz, 0.17, 0.22, pick(r, [[0.8, 0.35, 0.1], [0.85, 0.65, 0.15], [0.55, 0.2, 0.1], [0.5, 0.35, 0.2], [0.7, 0.5, 0.25], [0.35, 0.45, 0.2]]), 7);
	} else if (kind === 1) { // cloth
		for (let i = 0; i < 7; i++) G.box(-w / 2 + 0.2 + i * 0.36, top, gz, 0.3, 0.25, 0.6, pick(r, [[0.7, 0.1, 0.2], [0.15, 0.3, 0.6], [0.9, 0.75, 0.2], [0.2, 0.55, 0.45], [0.55, 0.2, 0.5], [0.95, 0.95, 0.9]]));
		for (let i = 0; i < 4; i++) G.sheet([[-w / 2 + 0.2 + i * 0.6, 2.2, d / 2 - 0.05], [-w / 2 + 0.7 + i * 0.6, 2.2, d / 2 - 0.05], [-w / 2 + 0.7 + i * 0.6, 0.6, d / 2 - 0.05], [-w / 2 + 0.2 + i * 0.6, 0.6, d / 2 - 0.05]], pick(r, [[0.7, 0.15, 0.15], [0.2, 0.35, 0.6], [0.85, 0.6, 0.2]]));
	} else if (kind === 2) { // brass and copper
		for (let i = 0; i < 6; i++) G.cyl(-w / 2 + 0.25 + i * 0.42, top, gz, 0.12, 0.08, 0.3, i % 2 ? [0.78, 0.6, 0.3] : [0.72, 0.42, 0.25], { n: 8 });
		for (let i = 0; i < 5; i++) G.dome(-w / 2 + 0.3 + i * 0.5, 1.6, d / 2 - 0.1, 0.2, [0.8, 0.62, 0.3], { n: 6, rings: 2 });
	} else if (kind === 3) { // carpets
		for (let i = 0; i < 3; i++) { const c = pick(r, [[0.55, 0.12, 0.12], [0.2, 0.22, 0.45], [0.6, 0.35, 0.18]]); G.sheet([[-w / 2 + 0.1 + i * 0.85, 2.3, d / 2 - 0.05], [-w / 2 + 0.9 + i * 0.85, 2.3, d / 2 - 0.05], [-w / 2 + 0.9 + i * 0.85, 0.2, d / 2 - 0.05], [-w / 2 + 0.1 + i * 0.85, 0.2, d / 2 - 0.05]], c); G.box(-w / 2 + 0.5 + i * 0.85, 1.2, d / 2 - 0.08, 0.5, 0.9, 0.02, shade(c, 1.5)); }
		G.box(0, top, gz, w - 0.2, 0.3, 0.6, [0.55, 0.15, 0.12]);
	} else if (kind === 4) { // fruit and vegetables
		for (let i = 0; i < 5; i++) { G.box(-w / 2 + 0.3 + i * 0.5, top, gz, 0.45, 0.12, 0.6, [0.55, 0.42, 0.28]); G.box(-w / 2 + 0.3 + i * 0.5, top + 0.12, gz, 0.4, 0.12, 0.55, pick(r, [[0.85, 0.2, 0.12], [0.95, 0.55, 0.1], [0.4, 0.65, 0.2], [0.85, 0.75, 0.2], [0.45, 0.15, 0.35]])); }
	} else { // bread, sweets, tea glasses
		for (let i = 0; i < 8; i++) G.cyl(-w / 2 + 0.2 + i * 0.3, top, gz + (i % 2) * 0.2, 0.12, 0.12, 0.05, [0.82, 0.62, 0.35], { n: 8 });
	}
	if (glow) { glow.box(0, 2.0, -d / 2 + 0.2, 0.18, 0.22, 0.18, [1, 0.75, 0.4]); B.lights.push([0, 2.1, -d / 2 + 0.2]); }
	solid(B, 0, -d / 2 + 0.35, w, 0.7);
	B.seat = [0, d / 2 - 0.4, Math.PI];
};
// a covered souk lane: stalls each side, a vault of beams and cloth or a run of masonry over it
S.souk = (B, L, P, r) => {
	const n = Math.max(2, Math.floor(L.w / 3));
	const sub = (x, z, rot, fn) => { const G = B.G, ox = G.ox, oy = G.oy, oz = G.oz, cs = G.cs, sn = G.sn; G.frame(ox + x * cs + z * sn, oy, oz - x * sn + z * cs, Math.atan2(sn, cs) + rot); B.glow?.frame(G.ox, G.oy, G.oz, Math.atan2(G.sn, G.cs)); const s0 = B.solid.length; fn(); for (let k = s0; k < B.solid.length; k++) { const [a, b, w, d, rr] = B.solid[k]; const c2 = Math.cos(rot), s2 = Math.sin(rot); B.solid[k] = [x + a * c2 + b * s2, z - a * s2 + b * c2, w, d, rr + rot]; } G.frame(ox, oy, oz, Math.atan2(sn, cs)); B.glow?.frame(ox, oy, oz, Math.atan2(sn, cs)); };
	const seats = [];
	for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
		const x = -L.w / 2 + 1.5 + i * 3, z = s * 2.6;
		sub(x, z, s < 0 ? 0 : Math.PI, () => { B.seat = null; S.stall(B, L, P, r); if (B.seat) seats.push([x, z + s * 0.5, s < 0 ? Math.PI : 0]); });
	}
	const { G } = B;
	if (r() < 0.5) {
		for (let i = 0; i <= n; i++) G.box(-L.w / 2 + i * 3, 3.6, 0, 0.12, 0.12, 8, [0.35, 0.28, 0.2]);
		for (let i = 0; i < n; i++) G.sheet([[-L.w / 2 + i * 3, 3.7, -4], [-L.w / 2 + (i + 1) * 3, 3.7, -4], [-L.w / 2 + (i + 1) * 3, 4.3, 0], [-L.w / 2 + i * 3, 4.3, 0]], i % 2 ? [0.85, 0.8, 0.68] : [0.75, 0.6, 0.45]).sheet([[-L.w / 2 + (i + 1) * 3, 3.7, 4], [-L.w / 2 + i * 3, 3.7, 4], [-L.w / 2 + i * 3, 4.3, 0], [-L.w / 2 + (i + 1) * 3, 4.3, 0]], i % 2 ? [0.85, 0.8, 0.68] : [0.75, 0.6, 0.45]);
	} else {
		const c = shade(P.wall, 0.95);
		for (const s of [-1, 1]) G.box(0, 0, s * 4.3, L.w, 4.4, 0.6, c);
		for (let i = 0; i <= n; i++) { G.arch(-L.w / 2 + i * 3, 0, 0, 7.6, 4.8, 0.4, c, { r: Math.PI / 2 }); }
		for (let i = 0; i < n; i++) { const x0 = -L.w / 2 + i * 3; for (let k = 0; k < 5; k++) { const a0 = k / 5 * Math.PI, a1 = (k + 1) / 5 * Math.PI; G.face([[x0, 1 + Math.sin(a0) * 4, -Math.cos(a0) * 4.1], [x0 + 3, 1 + Math.sin(a0) * 4, -Math.cos(a0) * 4.1], [x0 + 3, 1 + Math.sin(a1) * 4, -Math.cos(a1) * 4.1], [x0, 1 + Math.sin(a1) * 4, -Math.cos(a1) * 4.1]], k === 2 && i % 2 ? [1, 0.95, 0.8] : c); } }
		for (const s of [-1, 1]) solid(B, 0, s * 4.3, L.w, 0.6);
	}
	B.seats = seats;
};
// a mosque: a prayer hall, a dome over it, its minarets; in the manner of the place
// (P.mosque: 'ottoman' pencil minarets and grey domes; 'maghreb' a square tower; 'persian' a
// tiled dome and a gateway; 'sahel' see mudmosque; else a dome and a slender minaret)
S.mosque = (B, L, P, r, scale = 1) => {
	const { G, glow } = B, s = scale, style = P.mosque || 'arab', c = style === 'ottoman' ? [0.88, 0.86, 0.8] : P.wall;
	const w = 20 * s, d = 18 * s, H = 7 * s;
	footing(B, w, d, shade(c, 0.9), 0.4);
	G.box(0, 0.4, 0, w, H, d, c).box(0, 0.4 + H, 0, w + 0.2, 0.5 * s, d + 0.2, shade(c, 0.95), { top: true });
	const dc = style === 'ottoman' ? [0.5, 0.52, 0.55] : style === 'persian' ? [0.15, 0.48, 0.62] : style === 'central' ? [0.12, 0.45, 0.65] : [0.88, 0.86, 0.8];
	G.cyl(0, 0.9 + H, 0, 6.5 * s, 6.5 * s, 2 * s, c, { n: 16 }).dome(0, 2.9 * s + H, 0, 6.5 * s, dc, { k: style === 'persian' || style === 'central' ? 1.2 : 0.85, n: 18, rings: 6, tip: 2 * s });
	if (style === 'ottoman') for (const sx of [-1, 1]) G.cyl(sx * 6.2 * s, 0.9 + H, -6 * s, 2.2 * s, 2.2 * s, 1 * s, c, { n: 10 }).dome(sx * 6.2 * s, 1.9 * s + H, -6 * s, 2.2 * s, dc, { k: 0.8, n: 10, rings: 4 });
	// the minarets
	const mins = style === 'ottoman' ? (scale > 1.3 ? 4 : 2) : style === 'maghreb' ? 1 : style === 'persian' ? 2 : 1;
	const spots = [[w / 2 + 1.5 * s, -d / 2 - 1.5 * s], [-w / 2 - 1.5 * s, -d / 2 - 1.5 * s], [w / 2 + 1.5 * s, d / 2 + 1.5 * s], [-w / 2 - 1.5 * s, d / 2 + 1.5 * s]];
	for (let i = 0; i < mins; i++) {
		const [x, z] = spots[i];
		if (style === 'maghreb') {
			G.box(x, 0, z, 5 * s, 24 * s, 5 * s, shade(c, 1.02)).box(x, 24 * s, z, 2.4 * s, 4 * s, 2.4 * s, c).dome(x, 28 * s, z, 1.2 * s, [0.2, 0.5, 0.35], { k: 1, n: 8, rings: 3, tip: 1.5 * s });
			for (let k = 0; k < 3; k++) G.box(x, (6 + k * 6) * s, z - 2.52 * s, 1 * s, 2.4 * s, 0.05, [0.2, 0.45, 0.35]);
		} else if (style === 'ottoman') {
			G.cyl(x, 0, z, 1.4 * s, 1.2 * s, 30 * s, c, { n: 12 }).cyl(x, 22 * s, z, 1.9 * s, 1.9 * s, 0.6 * s, c, { n: 12 }).cyl(x, 30 * s, z, 1.2 * s, 0.01, 7 * s, dc, { n: 12, top: false });
			if (glow) glow.cyl(x, 22.6 * s, z, 1.95 * s, 1.95 * s, 0.2 * s, [0.9, 0.75, 0.45], { n: 12, top: false });
		} else {
			G.cyl(x, 0, z, 1.8 * s, 1.5 * s, 18 * s, c, { n: 8 }).cyl(x, 18 * s, z, 2.3 * s, 2.3 * s, 0.6 * s, c, { n: 8 }).cyl(x, 18.6 * s, z, 1.1 * s, 1.0 * s, 5 * s, c, { n: 8 }).dome(x, 23.6 * s, z, 1.2 * s, dc, { k: 1.2, n: 8, rings: 3, tip: 1.6 * s });
			if (glow) glow.cyl(x, 18.6 * s, z, 2.35 * s, 2.35 * s, 0.2 * s, [0.9, 0.85, 0.6], { n: 8, top: false });
		}
		B.minaret = [x, (style === 'ottoman' ? 22 : style === 'maghreb' ? 24 : 18) * s, z];
	}
	if (style === 'persian') { G.box(0, 0.4, -d / 2 - 2 * s, 12 * s, 16 * s, 4 * s, c); G.arch(0, 0.4, -d / 2 - 4.02 * s, 7 * s, 13 * s, 0.6 * s, [0.15, 0.48, 0.62]); }
	for (let i = 0; i < 5; i++) G.arch(-w / 2 + 2 * s + i * (w - 4 * s) / 4, 0.4, -d / 2 - 0.02, 2.4 * s, 4.4 * s, 0.3 * s, shade(c, 0.85));
	doorOn(B, 0, 2.6 * s, 4 * s, P, { w, d }, { c: [0.35, 0.24, 0.15], frame: shade(c, 0.85) });
	solid(B, 0, 0, w, d);
	for (let i = 0; i < mins; i++) solid(B, spots[i][0], spots[i][1], 5 * s, 5 * s);
};
S['mosque-small'] = (B, L, P, r) => S.mosque(B, L, P, r, 0.55);
// a tea house: an open front under an awning, low tables and stools outside
S.teahouse = (B, L, P, r) => {
	const { G, glow } = B, w = 10, d = 8, c = pick(r, P.walls || [P.wall]);
	footing(B, w, d, shade(c, 0.9), 0.1);
	G.box(0, 0.1, d * 0.1, w, 3.6, d * 0.8, c).box(0, 3.7, 0, w, 0.5, d, c, { top: false });
	G.face([[-w / 2 + 0.5, 0.1, -d * 0.3 - 0.01], [w / 2 - 0.5, 0.1, -d * 0.3 - 0.01], [w / 2 - 0.5, 3, -d * 0.3 - 0.01], [-w / 2 + 0.5, 3, -d * 0.3 - 0.01]], [0.16, 0.12, 0.1]);
	if (glow) glow.face([[-w / 2 + 0.6, 0.3, -d * 0.3 - 0.02], [w / 2 - 0.6, 0.3, -d * 0.3 - 0.02], [w / 2 - 0.6, 2.9, -d * 0.3 - 0.02], [-w / 2 + 0.6, 2.9, -d * 0.3 - 0.02]], WARM.map((v) => v * 0.55));
	G.sheet([[-w / 2, 3.2, -d * 0.3], [w / 2, 3.2, -d * 0.3], [w / 2, 2.6, -d * 0.3 - 3], [-w / 2, 2.6, -d * 0.3 - 3]], [0.72, 0.25, 0.18]);
	for (let i = 0; i < 3; i++) { const x = -3 + i * 3; G.cyl(x, 0, -d * 0.3 - 1.8, 0.4, 0.4, 0.5, [0.4, 0.3, 0.2], { n: 8 }); for (const s of [-1, 1]) G.box(x + s * 0.8, 0, -d * 0.3 - 1.8, 0.4, 0.4, 0.4, [0.5, 0.36, 0.24]); }
	solid(B, 0, d * 0.1, w, d * 0.8);
	B.seat = [-3.8, -d * 0.3 - 1.8, Math.PI / 2];
};
S.fountain = (B, L, P) => { const { G } = B; G.cyl(0, 0, 0, 2, 2, 0.6, P.stone, { n: 8, topc: [0.3, 0.45, 0.55] }).cyl(0, 0.6, 0, 0.3, 0.25, 1.2, P.stone, { n: 8 }).cyl(0, 1.8, 0, 0.7, 0.2, 0.25, P.stone, { n: 8 }); solid(B, 0, 0, 4, 4); };
// a caravanserai: a square of walls round a court, one great gateway, arcades within
S.caravanserai = (B, L, P) => {
	const { G } = B, w = 50, H = 8, c = P.mud || P.wall;
	for (const s of [-1, 1]) { G.box(0, 0, s * w / 2, w, H, 2, c); if (s > 0) G.box(s * w / 2, 0, 0, 2, H, w, c); }
	G.box(-w / 2, 0, -w / 4 - 3, 2, H, w / 2 - 6, c).box(-w / 2, 0, w / 4 + 3, 2, H, w / 2 - 6, c);
	G.box(-w / 2, 0, 0, 4, 12, 12, shade(c, 1.05)).arch(-w / 2 - 2.01, 0, 0, 6, 9, 0.6, shade(c, 0.85), { r: Math.PI / 2 });
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.cyl(sx * w / 2, 0, sz * w / 2, 2.6, 2.4, H + 1.5, c, { n: 10 });
	for (let i = 0; i < 7; i++) G.arch(-w / 2 + 6 + i * 6, 0, w / 2 - 1.02, 4, 5, 0.5, shade(c, 0.85));
	G.cyl(0, 0, 0, 3, 3, 0.8, c, { n: 8, topc: [0.25, 0.32, 0.35] });
	for (const s of [-1, 1]) { B.solid.push([0, s * w / 2, w, 2, 0]); B.solid.push([w / 2, 0, 2, w, 0]); }
	B.solid.push([-w / 2, -w / 4 - 3, 2, w / 2 - 6, 0], [-w / 2, w / 4 + 3, 2, w / 2 - 6, 0]);
};

// ---------- the steppe ----------
// a ger: a lattice wall wrapped in white felt, a low roof of poles to a crown ring, a painted
// door to the south, the stove pipe through the roof
S.ger = (B, L, P, r, scale = 1) => {
	const { G } = B, R = 3.1 * scale, H = 1.6 * scale, felt = [0.93, 0.92, 0.88];
	G.cyl(0, 0, 0, R + 0.2, R + 0.2, 0.15, [0.5, 0.4, 0.3], { n: 16 });
	G.cyl(0, 0.15, 0, R, R, H, felt, { n: 16, top: false });
	for (let k = 0; k < 3; k++) G.cyl(0, 0.4 + k * 0.5 * scale, 0, R + 0.02, R + 0.02, 0.06, [0.25, 0.35, 0.6], { n: 16, top: false });
	G.cyl(0, 0.15 + H, 0, R + 0.15, 0.6 * scale, 1.25 * scale, shade(felt, 0.97), { n: 16, top: false });
	G.cyl(0, 1.4 * scale + H, 0, 0.62 * scale, 0.62 * scale, 0.12, [0.8, 0.4, 0.15], { n: 10 });
	doorOn(B, 0, 0.8 * scale, 1.35 * scale, P, { w: 1, d: 2 * R - 0.05 }, { c: [0.85, 0.35, 0.12], frame: [0.2, 0.45, 0.7] });
	G.cyl(0.5 * scale, 0.15 + H, 0.5 * scale, 0.08, 0.08, 1.8 * scale, [0.3, 0.3, 0.3], { n: 6 });
	B.smoke.push([0.5 * scale, 2 * scale + H, 0.5 * scale]);
	solid(B, 0, 0, R * 1.8, R * 1.8);
	void r;
};
S['ger-large'] = (B, L, P, r) => S.ger(B, L, P, r, 1.35);
S.pen = (B) => { const { G } = B, R = 6; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, b = (i + 1) / 14 * Math.PI * 2; G.box(Math.cos(a) * R, 0, Math.sin(a) * R, 0.1, 1.1, 0.1, [0.45, 0.36, 0.26]); if (i !== 0) for (const y of [0.4, 0.9]) G.beam(Math.cos(a) * R, y, Math.sin(a) * R, Math.cos(b) * R, y, Math.sin(b) * R, 0.06, [0.5, 0.4, 0.3]); } };
S.hitch = (B) => { const { G } = B; for (const x of [-3, 3]) G.box(x, 0, 0, 0.14, 1.4, 0.14, [0.45, 0.36, 0.26]); G.beam(-3, 1.3, 0, 3, 1.25, 0, 0.03, [0.3, 0.25, 0.2]); };
S.solar = (B) => { const { G } = B; G.box(0, 0, 0, 0.08, 0.9, 0.08, [0.4, 0.4, 0.4]); G.face([[-0.6, 0.8, -0.3], [0.6, 0.8, -0.3], [0.6, 1.3, 0.4], [-0.6, 1.3, 0.4]], [0.12, 0.16, 0.3]); };
// an ovoo: a cairn of stones with a pole and blue silk scarves, walked round three times
S.ovoo = (B, L, P, r) => { const { G } = B; G.cone(0, 0, 0, 2.2, 2.2, [0.45, 0.44, 0.4], 9); G.box(0, 1.8, 0, 0.12, 3.5, 0.12, [0.5, 0.4, 0.3]); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + r(); G.beam(0, 4.8, 0, Math.cos(a) * 2.4, 1.6, Math.sin(a) * 2.4, 0.05, [0.3, 0.5, 0.85]); } solid(B, 0, 0, 3.4, 3.4); };
// a deer stone: a standing stone carved long ago with deer flying toward the sun
S.deerstone = (B) => { B.G.box(0, 0, 0, 0.7, 3, 0.35, [0.5, 0.5, 0.48]); for (let k = 0; k < 4; k++) B.G.face([[-0.3, 0.8 + k * 0.5, -0.18], [0.3, 1.0 + k * 0.5, -0.18], [0.1, 1.15 + k * 0.5, -0.18]], [0.4, 0.4, 0.38]); solid(B, 0, 0, 0.8, 0.5); };

// ---------- the savanna and the Sahel ----------
// a rondavel: a round mud-walled house under a cone of thatch
S.rondavel = (B, L, P, r) => {
	const { G } = B, R = 2.4 + r() * 0.6, H = 2.1;
	G.cyl(0, -0.4, 0, R + 0.15, R + 0.15, 0.6, shade(P.mud, 0.85), { n: 12 });
	G.cyl(0, 0.2, 0, R, R, H, P.mud, { n: 12, top: false });
	if (r() < 0.4) G.cyl(0, 0.2, 0, R + 0.01, R + 0.01, 0.6, shade(P.mud, 0.6), { n: 12, top: false });
	G.cyl(0, 0.2 + H - 0.3, 0, R + 0.6, 0, R * 0.95 + 0.6, P.thatch, { n: 12, top: false });
	doorOn(B, 0, 0.85, 1.75, P, { w: 1, d: 2 * R - 0.1 }, { c: [0.35, 0.25, 0.18], frame: shade(P.mud, 0.8) });
	solid(B, 0, 0, R * 1.8, R * 1.8);
};
// a house with a tin roof: block or mud walls, a bright door, the commonest new house
S.tinroof = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 2.6, c = r() < 0.5 ? P.mud : pick(r, P.walls || [P.wall]);
	footing(B, w, d, shade(c, 0.85), 0.25);
	G.box(0, 0.25, 0, w, H, d, c);
	G.gable(0, 0.25 + H, 0, w, d, d * 0.2, P.tin, { o: 0.4, gc: c });
	doorOn(B, 0, 0.9, 2, P, L, { c: pick(r, [[0.2, 0.45, 0.65], [0.65, 0.2, 0.15], [0.2, 0.5, 0.3]]), frame: shade(c, 0.85) });
	for (const x of [-w * 0.3, w * 0.3]) windowOn(B, 0, x, 1.2, 0.8, 0.9, P, L, { frame: [0.25, 0.3, 0.35], lit: 0.4 });
	solid(B, 0, 0, w, d);
};
// a granary: a round store of mud on a stone base under a thatch hat
S.granary = (B, L, P, r) => {
	const { G } = B, R = 1.2 + r() * 0.3;
	for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; G.box(Math.cos(a) * R * 0.6, 0, Math.sin(a) * R * 0.6, 0.35, 0.6, 0.35, P.stone); }
	G.cyl(0, 0.6, 0, R * 0.85, R, 2.1, P.mud, { n: 10, top: false });
	G.cyl(0, 2.5, 0, R + 0.4, 0, R + 0.6, P.thatch, { n: 10, top: false });
	solid(B, 0, 0, R * 2, R * 2);
};
// a kraal: a ring fence of thorn branches for the cattle at night
S.kraal = (B, L, P, r) => { const { G } = B, R = 7; for (let i = 0; i < 20; i++) { if (i === 0) continue; const a = i / 20 * Math.PI * 2, b = (i + 1) / 20 * Math.PI * 2; G.beam(Math.cos(a) * R, 0.5, Math.sin(a) * R, Math.cos(b) * R, 0.55, Math.sin(b) * R, 0.9, [0.38, 0.3, 0.22]); } void r; };
S.fireplace = (B) => { const { G } = B; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; G.box(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, 0.25, 0.25, 0.25, [0.3, 0.28, 0.25]); } G.cyl(0, 0.25, 0, 0.35, 0.25, 0.4, [0.15, 0.14, 0.13], { n: 8 }); B.smoke.push([0, 0.7, 0]); };
S.bicycle = (B) => { const { G } = B; for (const x of [-0.5, 0.5]) G.cyl(x, 0.33, 0, 0.33, 0.33, 0.03, DARK, { n: 10 }); G.beam(-0.5, 0.35, 0, 0.3, 0.8, 0, 0.04, [0.1, 0.1, 0.12]).beam(0.5, 0.35, 0, 0.35, 0.95, 0, 0.04, [0.1, 0.1, 0.12]); };
// a flat-roofed mud house of the Sahel, a wall round its yard
S.mudhouse = (B, L, P, r) => {
	S.adobe(B, { w: L.w * 0.7, d: L.d * 0.7 }, P, r);
	const { G } = B, w = L.w, d = L.d;
	for (const s of [-1, 1]) G.box(0, 0, s * d / 2, w, 1.8, 0.35, shade(P.mud, 0.96));
	G.box(w / 2, 0, 0, 0.35, 1.8, d, shade(P.mud, 0.96)).box(-w / 2, 0, d / 4, 0.35, 1.8, d / 2, shade(P.mud, 0.96));
	for (const s of [-1, 1]) solid(B, 0, s * d / 2, w, 0.4);
	solid(B, w / 2, 0, 0.4, d);
};
// a Sudano-Sahelian mosque of mud: buttresses rising into pinnacles, wooden beams bristling
// from the walls (the scaffolding for the yearly replastering)
S.mudmosque = (B, L, P, r, scale = 1) => {
	const { G } = B, s = scale, w = 26 * s, d = 18 * s, H = 9 * s, c = P.mud;
	footing(B, w, d, shade(c, 0.9), 0.8);
	G.box(0, 0.8, 0, w, H, d, c);
	for (let i = 0; i < 9; i++) {
		const x = -w / 2 + i * w / 8;
		G.box(x, 0.8, -d / 2 - 0.4 * s, 1.1 * s, H + 2.4 * s, 0.8 * s, shade(c, 1.04)).cone(x, H + 3.2 * s, -d / 2 - 0.4 * s, 0.55 * s, 1.4 * s, c, 6);
		for (let k = 0; k < 3; k++) G.box(x + 0.6 * s, 2.5 * s + k * 2.6 * s, -d / 2 - 0.4 * s, 0.9 * s, 0.12 * s, 0.12 * s, [0.42, 0.32, 0.22]);
	}
	for (let i = 0; i < 3; i++) { const x = -w / 4 + i * w / 4; G.box(x, 0.8, -d / 2 - 1.2 * s, 3 * s, H + 6 * s, 2.4 * s, shade(c, 1.06)).cone(x, H + 6.8 * s, -d / 2 - 1.2 * s, 1.4 * s, 2.4 * s, c, 6); G.cone(x, H + 9.2 * s, -d / 2 - 1.2 * s, 0.3 * s, 0.8 * s, [0.95, 0.92, 0.85], 6); for (let k = 0; k < 6; k++) G.box(x, 2 * s + k * 2.2 * s, -d / 2 - 2.45 * s, 2.6 * s, 0.14 * s, 0.6 * s, [0.42, 0.32, 0.22]); }
	B.minaret = [0, H + 6 * s, -d / 2 - 1.2 * s];
	solid(B, 0, 0, w + 2, d + 3);
	void r;
};

// ---------- the rainforest and the islands ----------
// a stilt house: a floor on posts above the floods, plank or woven walls, a steep roof of
// thatch or tin that throws off the rain, a ladder up to the door
S.stilt = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, lift = 1.8 + r() * 0.8, H = 2.4, wall = r() < 0.5 ? P.wood : P.bamboo || P.wood;
	for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) G.cyl(sx * (w / 2 - 0.3), -0.8, sz * (d / 2 - 0.3), 0.12, 0.12, lift + 0.8, [0.38, 0.3, 0.22], { n: 6 });
	G.slab(0, lift, 0, w + 1.2, d + 0.4, 0.15, shade(P.wood, 0.8));
	G.box(0.3, lift + 0.15, 0, w - 0.6, H, d, wall);
	const roofc = r() < 0.55 ? P.thatch : P.tin;
	G.gable(0.3, lift + 0.15 + H, 0, w - 0.6, d, d * 0.62, roofc, { o: 0.8, gc: wall });
	raise(B, lift + 0.15);
	doorOn(B, -w * 0.15, 0.85, 1.85, P, { w: w - 0.6, d }, { c: shade(P.wood, 0.6) });
	windowOn(B, 0, w * 0.2, 0.9, 0.9, 0.8, P, { w: w - 0.6, d }, { frame: shade(P.wood, 0.7), lit: 0.4 });
	windowOn(B, 1, 0, 0.9, 0.9, 0.8, P, { w: w - 0.6, d }, { frame: shade(P.wood, 0.7), lit: 0.3 });
	raise(B, -(lift + 0.15));
	for (const s of [-0.25, 0.25]) G.beam(-w * 0.15 + s, 0, -d / 2 - 1.3, -w * 0.15 + s, lift + 0.1, -d / 2 - 0.2, 0.07, [0.45, 0.36, 0.26]);
	for (let k = 0; k < 6; k++) G.box(-w * 0.15, 0.25 + k * lift / 6, -d / 2 - 1.3 + k * 1.1 / 6, 0.55, 0.05, 0.06, [0.45, 0.36, 0.26]);
	solid(B, 0, 0, w, d);
};
// a hut on the ground: walls of planks or palm, a thatched gable
S.hut = (B, L, P, r) => {
	const { G } = B, w = Math.min(L.w, 6), d = Math.min(L.d, 5), H = 2.2;
	G.box(0, 0, 0, w, H, d, r() < 0.5 ? P.wood : P.bamboo || P.wood);
	G.gable(0, H, 0, w, d, d * 0.6, P.thatch, { o: 0.6 });
	doorOn(B, 0, 0.9, 1.8, P, { w, d }, { c: [0.25, 0.2, 0.15] });
	solid(B, 0, 0, w, d);
};
// a tarp house: a frame of cut poles, a tarp roof pulled tight over a ridge pole, its sides
// of tarp or palm, a raised sleeping platform, a cooking place: a home made with what there is
S.tarp = (B, L, P, r) => {
	const { G } = B, w = 5, d = 4, H = 2.4, c = pick(r, [[0.18, 0.4, 0.7], [0.85, 0.45, 0.15], [0.25, 0.5, 0.3], [0.2, 0.22, 0.55], [0.75, 0.75, 0.72]]);
	for (const x of [-w / 2, 0, w / 2]) G.box(x, 0, 0, 0.1, H, 0.1, [0.45, 0.36, 0.26]);
	for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) G.box(x, 0, z, 0.09, 1.2, 0.09, [0.45, 0.36, 0.26]);
	G.box(0, H, 0, w + 0.6, 0.08, 0.08, [0.45, 0.36, 0.26]);
	G.sheet([[-w / 2 - 0.3, 1.1, -d / 2 - 0.3], [w / 2 + 0.3, 1.1, -d / 2 - 0.3], [w / 2 + 0.3, H + 0.05, 0], [-w / 2 - 0.3, H + 0.05, 0]], c);
	G.sheet([[w / 2 + 0.3, 1.1, d / 2 + 0.3], [-w / 2 - 0.3, 1.1, d / 2 + 0.3], [-w / 2 - 0.3, H + 0.05, 0], [w / 2 + 0.3, H + 0.05, 0]], c);
	G.sheet([[w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, 1.1, d / 2], [w / 2, 1.1, d / 2]], shade(P.thatch, 0.9));
	G.slab(-0.6, 0.5, 0.6, 2.4, 1.6, 0.1, shade(P.wood, 0.9));
	for (const x of [-1.6, 0.4]) for (const z of [0, 1.2]) G.box(x, 0, z, 0.08, 0.5, 0.08, [0.45, 0.36, 0.26]);
	solid(B, 0, 0.8, w, d * 0.5);
};
// a longhouse: one long house on stilts for many families, each door off a shared veranda
S.longhouse = (B, L, P, r) => {
	const { G } = B, w = 40 + Math.floor(r() * 3) * 10, d = 10, lift = 2.4, H = 2.6;
	for (let i = 0; i <= w / 4; i++) for (const z of [-d / 2, -d / 2 + 3.5, d / 2]) G.cyl(-w / 2 + i * 4, -0.8, z, 0.15, 0.15, lift + 0.8, [0.38, 0.3, 0.22], { n: 6 });
	G.slab(0, lift, 0, w, d + 0.4, 0.15, shade(P.wood, 0.8));
	G.box(0, lift + 0.15, 1.75, w, H, d - 3.5, P.bamboo || P.wood);
	G.gable(0, lift + 0.15 + H, 0, w, d, d * 0.45, P.thatch, { o: 0.6 });
	for (let i = 0; i < w / 5; i++) { const x = -w / 2 + 2.5 + i * 5; G.face([[x - 0.45, lift + 0.15, -d / 2 + 3.48], [x + 0.45, lift + 0.15, -d / 2 + 3.48], [x + 0.45, lift + 2, -d / 2 + 3.48], [x - 0.45, lift + 2, -d / 2 + 3.48]], shade(P.wood, 0.55)); B.glow?.box(x + 1.4, lift + 1, -d / 2 + 3.4, 0.6, 0.5, 0.05, WARM.map((v) => v * 0.4)); }
	for (let k = 0; k < 7; k++) G.box(0, k * lift / 7, -d / 2 - 1.2 + k * 0.17, 0.6, 0.06, 0.25, [0.45, 0.36, 0.26]);
	solid(B, 0, 0, w, d);
	B.seat = [w * 0.2, -d / 2 + 1.6, 0];
	B.seatY = lift + 0.15;
};
// a dugout canoe drawn up at the bank
S.canoe = (B, L, P, r) => {
	const { G } = B, len = 6 + r() * 3, c = shade(P.wood, 0.75);
	for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8, ww = (t) => 0.42 * Math.sin(Math.PI * Math.min(1, 0.06 + t * 0.9)), x0 = -len / 2 + t0 * len, x1 = -len / 2 + t1 * len; G.face([[x0, 0.5, -ww(t0)], [x1, 0.5, -ww(t1)], [x1, 0.05, -ww(t1) * 0.3], [x0, 0.05, -ww(t0) * 0.3]], c).face([[x1, 0.5, ww(t1)], [x0, 0.5, ww(t0)], [x0, 0.05, ww(t0) * 0.3], [x1, 0.05, ww(t1) * 0.3]], c).face([[x0, 0.48, -ww(t0) * 0.9], [x1, 0.48, -ww(t1) * 0.9], [x1, 0.48, ww(t1) * 0.9], [x0, 0.48, ww(t0) * 0.9]], [0.3, 0.22, 0.16]); }
	G.box(len * 0.2, 0.5, 0, 0.1, 0.05, 1.6, c);
};
// a jetty at the river's edge: planks on posts, out over the water
S.landing = (B, L, P) => { const { G } = B, len = 14; for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) G.cyl(s * 1.1, -2.5, -len / 2 + i * len / 4, 0.12, 0.12, 3.3, [0.38, 0.3, 0.22], { n: 6 }); G.slab(0, 0.6, 0, 2.6, len, 0.12, shade(P.wood, 0.85)); };
S.garden = (B, L, P, r) => { const { G } = B; for (let i = 0; i < 4; i++) G.box(-3 + i * 2, 0, 0, 1.4, 0.25, 6, [0.32, 0.22, 0.14], { topc: [0.28, 0.42, 0.18] }); for (let i = 0; i < 9; i++) B.trees.push([-3 + (i % 4) * 2, -2.4 + Math.floor(i / 4) * 2.2, 'greens', 0.7 + r() * 0.4]); };
S.line = (B, L, P, r) => { const { G } = B; for (const x of [-3, 3]) G.box(x, 0, 0, 0.08, 1.9, 0.08, [0.45, 0.36, 0.26]); G.beam(-3, 1.85, 0, 3, 1.85, 0, 0.02, [0.3, 0.3, 0.3]); for (let i = 0; i < 6; i++) G.sheet([[-2.5 + i * 0.9, 1.84, 0], [-1.9 + i * 0.9, 1.84, 0], [-1.9 + i * 0.9, 1.2 - r() * 0.3, 0], [-2.5 + i * 0.9, 1.2, 0]], pick(r, [[0.85, 0.2, 0.2], [0.95, 0.95, 0.92], [0.2, 0.4, 0.7], [0.95, 0.75, 0.2], [0.3, 0.6, 0.35], [0.8, 0.45, 0.65]])); };
S.hammock = (B, L, P, r) => { const { G } = B, c = pick(r, [[0.85, 0.3, 0.2], [0.3, 0.5, 0.7], [0.9, 0.75, 0.3]]); for (const x of [-1.6, 1.6]) G.box(x, 0, 0, 0.12, 1.8, 0.12, [0.45, 0.36, 0.26]); G.sheet([[-1.5, 1.5, -0.4], [0, 0.7, -0.45], [0, 0.7, 0.45], [-1.5, 1.5, 0.4]], c).sheet([[0, 0.7, -0.45], [1.5, 1.5, -0.4], [1.5, 1.5, 0.4], [0, 0.7, 0.45]], c); };
// a fale: a round-ended house open on all sides, posts round a raised stone floor, a high
// domed thatch roof; blinds of woven palm rolled up under the eaves
S.fale = (B, L, P) => {
	const { G } = B, w = 8, d = 6, H = 2.2;
	G.box(0, -0.6, 0, w + 1, 1.0, d + 1, [0.5, 0.48, 0.45]);
	for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; G.cyl(Math.cos(a) * w / 2, 0.4, Math.sin(a) * d / 2, 0.12, 0.12, H, [0.4, 0.32, 0.24], { n: 6 }); }
	G.cyl(0, 0.4 + H, 0, 0.01, 0.01, 0.01, P.thatch, { n: 3 });
	for (let j = 0; j < 4; j++) { const t0 = j / 4, t1 = (j + 1) / 4, r0 = 1.25 - t0 * 1.25, r1 = 1.25 - t1 * 1.25; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, b = (i + 1) / 14 * Math.PI * 2, y0 = 0.4 + H - 0.4 + Math.sin(t0 * Math.PI / 2) * 3.4, y1 = 0.4 + H - 0.4 + Math.sin(t1 * Math.PI / 2) * 3.4; G.face([[Math.cos(b) * (w / 2 + 0.6) * r0 / 1.25, y0, Math.sin(b) * (d / 2 + 0.6) * r0 / 1.25], [Math.cos(a) * (w / 2 + 0.6) * r0 / 1.25, y0, Math.sin(a) * (d / 2 + 0.6) * r0 / 1.25], [Math.cos(a) * (w / 2 + 0.6) * r1 / 1.25, y1, Math.sin(a) * (d / 2 + 0.6) * r1 / 1.25], [Math.cos(b) * (w / 2 + 0.6) * r1 / 1.25, y1, Math.sin(b) * (d / 2 + 0.6) * r1 / 1.25]], P.thatch); } }
	G.slab(0, 0.4, 0, w - 0.4, d - 0.4, 0.05, [0.72, 0.62, 0.42]);
	B.seat = [1.5, 0.5, -Math.PI / 2]; B.seatY = 0.4;
};
// a small timber cottage on low piers, painted, a tin roof
S.tincottage = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, lift = 0.7, H = 2.6, c = pick(r, P.walls || [P.wall]);
	for (const sx of [-1, 1]) for (const sz of [-1, 1]) G.box(sx * (w / 2 - 0.2), -1, sz * (d / 2 - 0.2), 0.3, lift + 1, 0.3, [0.5, 0.48, 0.45]);
	G.box(0, lift, 0, w, H, d, c, { bottom: true });
	G.hip(0, lift + H, 0, w, d, Math.min(w, d) * 0.3, P.tin, { o: 0.5, k: 0.5 });
	raise(B, lift);
	doorOn(B, 0, 0.9, 2, P, L, { c: [0.95, 0.95, 0.92] });
	for (const x of [-w * 0.3, w * 0.3]) windowOn(B, 0, x, 1, 0.9, 0.9, P, L, { frame: [0.95, 0.95, 0.92], lit: 0.4 });
	raise(B, -(lift));
	for (let k = 0; k < 3; k++) G.box(0, k * lift / 3, -d / 2 - 0.8 + k * 0.25, 1.2, lift / 3, 0.3, [0.5, 0.48, 0.45]);
	solid(B, 0, 0, w, d);
};
// an outrigger canoe on the sand
S.outrigger = (B, L, P, r) => { S.canoe(B, L, P, r); const { G } = B; for (const x of [-1, 1]) G.beam(x, 0.5, 0, x, 0.45, -2, 0.07, [0.45, 0.36, 0.26]); G.box(0, 0.15, -2, 3.2, 0.2, 0.22, [0.5, 0.42, 0.32]); };

// ---------- East Asia ----------
// a house of the East Asian countryside: plastered walls between dark timber posts on a
// stone base, a grey tile roof with eaves that sweep up at the corners and a ridge with ends
S.easthouse = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 2.9 + (r() < 0.3 ? 2.6 : 0), wall = P.plaster || [0.92, 0.9, 0.85], post = P.darkwood || [0.28, 0.2, 0.14];
	G.box(0, -1, 0, w + 0.4, 1.45, d + 0.4, P.stone);
	G.box(0, 0.45, 0, w, H, d, wall);
	for (let i = 0; i <= 4; i++) { const x = -w / 2 + i * w / 4; G.box(x, 0.45, -d / 2 - 0.03, 0.18, H, 0.05, post); G.box(x, 0.45, d / 2 + 0.03, 0.18, H, 0.05, post); }
	G.box(0, 0.45 + H - 0.2, 0, w + 0.06, 0.2, d + 0.06, post, { top: false });
	G.hip(0, 0.45 + H, 0, w + 0.4, d + 0.4, Math.min(w, d) * 0.38, P.roof, { o: 1, k: 0.32, curl: 0.45, snow: snowK(P) * 0.8 });
	G.box(0, 0.45 + H + Math.min(w, d) * 0.38 - 0.1, 0, w * 0.6, 0.25, 0.3, shade(P.roof, 0.8));
	for (const s of [-1, 1]) G.box(s * w * 0.31, 0.45 + H + Math.min(w, d) * 0.38, 0, 0.3, 0.45, 0.32, shade(P.roof, 0.7));
	// sliding paper screens or lattice windows, lit warm at night
	for (const x of [-w * 0.25, w * 0.25]) windowOn(B, 0, x, 0.9, 1.4, 1.3, P, L, { frame: post, lit: 0.7 });
	doorOn(B, 0, 1.2, 2.1, P, L, { c: shade(post, 1.3), frame: post });
	if (P.lanterns && r() < 0.6) for (const s of [-1, 1]) S.lantern(B, s * 0.9, 2.5, -d / 2 - 0.6);
	solid(B, 0, 0, w, d);
};
// a red paper lantern hung by a door
S.lantern = (B, x, y, z) => { B.G.cyl(x, y + 0.45, z, 0.02, 0.02, 0.3, [0.1, 0.1, 0.1], { n: 4 }); if (B.glow) B.glow.dome(x, y, z, 0.24, [1, 0.25, 0.12], { k: 1.6, n: 8, rings: 3 }); B.lights.push([x, y + 0.2, z]); };
// a temple hall: on a raised platform, red columns, a double roof of glazed tile
S.templehall = (B, L, P, r) => {
	const { G } = B, w = 20, d = 14, red = P.japan ? [0.42, 0.24, 0.16] : [0.65, 0.12, 0.1], roof = P.templeRoof || P.roof;
	G.box(0, -1, 0, w + 4, 2.2, d + 4, P.stone);
	for (let k = 0; k < 4; k++) G.box(0, 1.2 - (k + 1) * 0.3, -d / 2 - 2.4 - k * 0.4, 6, 0.3, 0.4, P.stone);
	G.box(0, 1.2, 0, w - 2, 5, d - 2, P.japan ? [0.88, 0.84, 0.75] : red);
	for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) G.cyl(-w / 2 + 0.5 + i * (w - 1) / 6, 1.2, s * (d / 2 - 0.4), 0.28, 0.28, 5, red, { n: 8 });
	G.hip(0, 6.2, 0, w + 0.5, d + 0.5, 1.4, roof, { o: 1.4, k: 0.2, curl: 0.5, snow: snowK(P) * 0.7 });
	G.box(0, 7.4, 0, w * 0.75, 2, d * 0.65, red);
	G.hip(0, 9.4, 0, w * 0.75, d * 0.65, 3.2, roof, { o: 1.2, k: 0.3, curl: 0.6, snow: snowK(P) * 0.7 });
	G.box(0, 12.5, 0, w * 0.4, 0.4, 0.4, shade(roof, 0.75));
	doorOn(B, 0, 3, 3.6, P, { w: w - 2, d: d - 2 }, { c: [0.55, 0.15, 0.1], frame: [0.85, 0.65, 0.25] });
	S.lantern(B, -4, 4.6, -d / 2 - 0.2); S.lantern(B, 4, 4.6, -d / 2 - 0.2);
	G.cyl(0, 1.2, -d / 2 - 6, 0.8, 0.9, 1, [0.35, 0.3, 0.25], { n: 8 });
	solid(B, 0, 0, w + 4, d + 4);
	void r;
};
// a wat: an ordination hall on a white base, its roofs in tiers, steep, in red and green
// tile with gilded edges and the curling finials at the gables; a bell-shaped chedi beside it
S.wat = (B, L, P) => {
	const { G } = B, w = 12, d = 22, white = [0.95, 0.94, 0.9], gold = [0.85, 0.66, 0.25], red = [0.68, 0.18, 0.12], green = [0.2, 0.45, 0.3];
	G.box(0, -1, 0, w + 4, 2.2, d + 4, white);
	G.box(0, 1.2, 0, w, 5.5, d, white);
	for (let k = 0; k < 3; k++) {
		const y = 6.7 + k * 2.2, ww = w + 2.4 - k * 2.2, dd = d + 1.6 - k * 4;
		G.gable(0, y, 0, dd, ww, 3.2 - k * 0.3, k % 2 ? green : red, { o: 0.6, r: Math.PI / 2, gc: gold });
		for (const s of [-1, 1]) G.beam(0, y + 3.2 - k * 0.3, s * (dd / 2 + 0.6), 0, y + 4.6 - k * 0.3, s * (dd / 2 + 1.1), 0.18, gold);
	}
	doorOn(B, 0, 2.2, 3.6, P, { w, d }, { c: [0.55, 0.12, 0.08], frame: gold });
	G.box(w / 2 + 7, -0.5, d / 4, 5, 2, 5, white).dome(w / 2 + 7, 1.5, d / 4, 2.2, white, { k: 1.4, n: 12, rings: 5 }).cyl(w / 2 + 7, 4.5, d / 4, 0.7, 0.05, 7, gold, { n: 10, top: false });
	solid(B, 0, 0, w + 4, d + 4); solid(B, w / 2 + 7, d / 4, 5, 5);
};
// a pagoda: tiers stacked and stepping in, each with its own upswept eaves, a spire of rings
S.pagoda = (B, L, P, r) => {
	const { G } = B, n = P.japan ? 5 : 5 + 2 * Math.floor(r() * 2), red = P.japan ? [0.68, 0.2, 0.12] : [0.62, 0.14, 0.1], roof = P.templeRoof || P.roof;
	G.box(0, -1, 0, 9, 1.8, 9, P.stone);
	let y = 0.8, s = 7;
	for (let i = 0; i < n; i++) {
		const h = i === 0 ? 3.6 : 2.6;
		G.box(0, y, 0, s, h, s, i % 2 ? shade(red, 0.95) : red);
		G.hip(0, y + h, 0, s, s, 0.9, roof, { o: 1.3, k: 0.5, curl: 0.45, snow: snowK(P) * 0.7 });
		y += h + 0.7; s *= 0.86;
	}
	G.cyl(0, y, 0, 0.35, 0.12, 5, [0.75, 0.6, 0.28], { n: 8 });
	for (let k = 0; k < 7; k++) G.cyl(0, y + 0.6 + k * 0.55, 0, 0.42 - k * 0.03, 0.42 - k * 0.03, 0.1, [0.78, 0.62, 0.3], { n: 8 });
	solid(B, 0, 0, 9, 9);
};
// a torii: the gate of a shrine, two pillars and two crossbeams, the upper curving up
S.torii = (B, L, P, r, x = 0, z = 0, s = 1) => {
	const { G } = B, c = [0.82, 0.2, 0.1];
	for (const sx of [-1, 1]) G.cyl(x + sx * 1.8 * s, 0, z, 0.2 * s, 0.17 * s, 4.4 * s, c, { n: 10 });
	G.box(x, 3.6 * s, z, 4.6 * s, 0.3 * s, 0.3 * s, c);
	G.face([[x - 3 * s, 4.75 * s, z - 0.25 * s], [x + 3 * s, 4.75 * s, z - 0.25 * s], [x + 2.6 * s, 4.45 * s, z - 0.25 * s], [x - 2.6 * s, 4.45 * s, z - 0.25 * s]], c);
	G.box(x, 4.4 * s, z, 5.4 * s, 0.35 * s, 0.5 * s, [0.12, 0.1, 0.1]);
	void r;
};
S.stonelantern = (B) => { const { G } = B, c = [0.58, 0.57, 0.54]; G.box(0, 0, 0, 0.7, 0.2, 0.7, c).cyl(0, 0.2, 0, 0.14, 0.14, 0.9, c, { n: 6 }).box(0, 1.1, 0, 0.6, 0.15, 0.6, c).box(0, 1.25, 0, 0.45, 0.45, 0.45, c).hip(0, 1.7, 0, 0.7, 0.7, 0.35, c, { o: 0.05 }); B.glow?.box(0, 1.35, -0.231, 0.25, 0.22, 0.01, WARM.map((v) => v * 0.6)); };
S.lanternpost = (B) => { B.G.box(0, 0, 0, 0.1, 2.8, 0.1, [0.25, 0.2, 0.16]).box(0.35, 2.75, 0, 0.8, 0.06, 0.06, [0.25, 0.2, 0.16]); S.lantern(B, 0.7, 2.3, 0); };
// a string of lanterns across a lane
S.lanternstring = (B, L) => { const len = L.w || 10; B.G.beam(-len / 2, 4.2, 0, len / 2, 4.2, 0, 0.03, [0.15, 0.15, 0.15]); for (let i = 0; i < Math.floor(len / 1.4); i++) S.lantern(B, -len / 2 + 0.7 + i * 1.4, 3.6, 0); };
// a block of the dense city: storeys of flats with balconies and air-conditioners, a lit
// shopfront at the street, signs hung down the front that glow at night
S.neonblock = (B, L, P, r) => {
	const { G, glow } = B, w = L.w, d = L.d, n = 6 + Math.floor(r() * 12), H = n * 3, c = pick(r, [[0.78, 0.76, 0.72], [0.62, 0.6, 0.58], [0.85, 0.82, 0.74], [0.55, 0.58, 0.6], [0.7, 0.62, 0.55]]);
	G.box(0, -1, 0, w, H + 1, d, c);
	G.box(0, 0, -d / 2 - 0.02, w, 3.2, 0.05, [0.12, 0.12, 0.13], { top: false });
	if (glow) glow.face([[-w / 2 + 0.3, 0.3, -d / 2 - 0.05], [w / 2 - 0.3, 0.3, -d / 2 - 0.05], [w / 2 - 0.3, 2.9, -d / 2 - 0.05], [-w / 2 + 0.3, 2.9, -d / 2 - 0.05]], [0.95, 0.88, 0.75]);
	for (let k = 1; k < n; k++) {
		G.box(0, k * 3, -d / 2 - 0.5, w - 0.4, 0.12, 1, shade(c, 0.85));
		if (B.lite) { windowOn(B, 0, 0, k * 3 + 0.8, w - 1.5, 1.5, P, L, { lit: r() < 0.55 ? 0.6 : 0 }); if (r() < 0.4) G.box((r() - 0.5) * (w - 3), k * 3 + 0.2, -d / 2 - 0.7, 0.8, 0.55, 0.45, [0.85, 0.85, 0.83]); }
		else for (let i = 0; i < Math.max(1, Math.floor(w / 4)); i++) { const x = -w / 2 + 2 + i * 4; windowOn(B, 0, x, k * 3 + 0.8, 1.6, 1.5, P, L, { frame: shade(c, 0.8), lit: r() < 0.55 ? 0.7 : 0 }); if (r() < 0.35) G.box(x + 1.2, k * 3 + 0.2, -d / 2 - 0.7, 0.8, 0.55, 0.45, [0.85, 0.85, 0.83]); }
	}
	// the signs: vertical boards down the front corner, a wide one over the shop
	const NEON = [[1, 0.2, 0.35], [0.2, 0.75, 1], [1, 0.75, 0.2], [0.4, 1, 0.5], [0.9, 0.35, 1], [1, 0.45, 0.2]];
	const ns = 1 + Math.floor(r() * 3);
	for (let i = 0; i < ns; i++) {
		const x = -w / 2 + 1 + r() * (w - 2), h = 4 + r() * 8, y0 = 3.5 + r() * Math.max(0, H - h - 6), cc = pick(r, NEON);
		G.box(x, y0, -d / 2 - 1.3, 0.25, h, 1.1, [0.15, 0.15, 0.16]);
		if (glow) for (const s of [-1, 1]) glow.face(s < 0 ? [[x - 0.14, y0 + 0.2, -d / 2 - 1.8], [x - 0.14, y0 + 0.2, -d / 2 - 0.8], [x - 0.14, y0 + h - 0.2, -d / 2 - 0.8], [x - 0.14, y0 + h - 0.2, -d / 2 - 1.8]] : [[x + 0.14, y0 + 0.2, -d / 2 - 0.8], [x + 0.14, y0 + 0.2, -d / 2 - 1.8], [x + 0.14, y0 + h - 0.2, -d / 2 - 1.8], [x + 0.14, y0 + h - 0.2, -d / 2 - 0.8]], cc);
		else G.box(x, y0, -d / 2 - 1.3, 0.3, h, 1.0, cc);
	}
	if (glow) glow.face([[-w / 2 + 0.5, 3.2, -d / 2 - 0.12], [w / 2 - 0.5, 3.2, -d / 2 - 0.12], [w / 2 - 0.5, 4.1, -d / 2 - 0.12], [-w / 2 + 0.5, 4.1, -d / 2 - 0.12]], pick(r, NEON));
	G.box(0, H, 0, w, 0.8, d, shade(c, 0.9), { top: false }).box(w * 0.2, H, d * 0.1, 2.4, 2.2, 2.4, [0.6, 0.6, 0.6]);
	solid(B, 0, 0, w, d);
};
// a shophouse: a narrow front three or four storeys high, the shop open to the street, a
// sign board across it, shutters and plants on the floors above
S.shophouse = (B, L, P, r) => {
	const { G, glow } = B, w = L.w, d = L.d, n = 2 + Math.floor(r() * 3), H = n * 3.1, c = pick(r, P.walls || [[0.9, 0.86, 0.75]]);
	G.box(0, -1, 0, w, H + 1, d, c);
	G.face([[-w / 2 + 0.3, 0, -d / 2 - 0.02], [w / 2 - 0.3, 0, -d / 2 - 0.02], [w / 2 - 0.3, 2.8, -d / 2 - 0.02], [-w / 2 + 0.3, 2.8, -d / 2 - 0.02]], [0.2, 0.18, 0.16]);
	if (glow) glow.face([[-w / 2 + 0.4, 0.2, -d / 2 - 0.04], [w / 2 - 0.4, 0.2, -d / 2 - 0.04], [w / 2 - 0.4, 2.7, -d / 2 - 0.04], [-w / 2 + 0.4, 2.7, -d / 2 - 0.04]], [0.9, 0.8, 0.6].map((v) => v * 0.8));
	const sign = pick(r, [[0.7, 0.1, 0.1], [0.15, 0.3, 0.55], [0.95, 0.8, 0.2], [0.2, 0.5, 0.3], [0.9, 0.9, 0.88]]);
	G.box(0, 2.9, -d / 2 - 0.15, w - 0.2, 0.9, 0.12, sign);
	if (glow && r() < 0.6) glow.face([[-w / 2 + 0.3, 3.0, -d / 2 - 0.22], [w / 2 - 0.3, 3.0, -d / 2 - 0.22], [w / 2 - 0.3, 3.7, -d / 2 - 0.22], [-w / 2 + 0.3, 3.7, -d / 2 - 0.22]], sign.map((v) => Math.min(1, v * 1.3)));
	for (let k = 1; k < n; k++) for (const x of w > 5 ? [-w * 0.25, w * 0.25] : [0]) windowOn(B, 0, x, k * 3.1 + 0.9, 1.2, 1.4, P, L, { frame: shade(c, 0.8), lit: r() < 0.5 ? 0.6 : 0, shutter: r() < 0.4 ? [0.3, 0.45, 0.4] : null });
	if (P.curved) G.hip(0, H, 0, w, d, 1.2, P.roof, { o: 0.4, k: 0.5, curl: 0.3 });
	else G.box(0, H, 0, w, 0.5, d, shade(c, 0.9), { top: false });
	solid(B, 0, 0, w, d);
};
S.bikes = (B) => { for (let i = 0; i < 4; i++) { const G = B.G, x = -1.5 + i; G.cyl(x, 0.33, -0.5, 0.33, 0.33, 0.03, DARK, { n: 8 }).cyl(x, 0.33, 0.5, 0.33, 0.33, 0.03, DARK, { n: 8 }).beam(x, 0.4, -0.5, x, 0.9, 0.3, 0.04, [0.2, 0.3, 0.5]); } };
S.vending = (B) => { B.G.box(0, 0, 0, 1, 1.8, 0.7, [0.85, 0.85, 0.88]); B.glow?.face([[-0.4, 0.8, -0.36], [0.4, 0.8, -0.36], [0.4, 1.7, -0.36], [-0.4, 1.7, -0.36]], [0.8, 0.9, 1]); solid(B, 0, 0, 1, 0.7); };

// ---------- South Asia ----------
// a flat-roofed house of brick and plaster painted in a light colour, stairs up the side to
// the roof, a black water tank on top, a small shrine niche by the door
S.flatbrick = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, n = 1 + Math.floor(r() * 2.2), H = n * 3, c = pick(r, P.walls || [P.wall]);
	footing(B, w, d, shade(c, 0.85), 0.3);
	G.box(0, 0.3, 0, w, H, d, c).box(0, 0.3 + H, 0, w, 0.9, d, c, { top: false });
	G.slab(0, 0.3 + H, 0, w, d, 0.12, [0.55, 0.52, 0.48]);
	G.cyl(w * 0.25, 0.42 + H, d * 0.2, 0.6, 0.6, 1.1, [0.1, 0.1, 0.11], { n: 10 });
	for (let k = 0; k < n; k++) for (const x of [-w * 0.28, w * 0.28]) windowOn(B, 0, x, 1 + k * 3, 0.9, 1.2, P, L, { frame: shade(c, 0.8), lit: 0.5, shutter: r() < 0.4 ? [0.2, 0.45, 0.5] : null });
	doorOn(B, 0, 1, 2.1, P, L, { c: pick(r, [[0.2, 0.4, 0.55], [0.55, 0.2, 0.15], [0.25, 0.45, 0.3]]), frame: shade(c, 0.8) });
	for (let k = 0; k < 10; k++) G.box(w / 2 + 0.45, 0.3 + k * H / 10, -d / 2 + 0.5 + k * (d - 1) / 10, 0.9, H / 10, 0.3, shade(c, 0.9));
	solid(B, 0, 0, w + 1, d);
};
// a village house of mud with a roof of clay tiles
S.mudtile = (B, L, P, r) => {
	const { G } = B, w = L.w, d = L.d, H = 2.6;
	footing(B, w, d, shade(P.mud, 0.85), 0.35);
	G.box(0, 0.35, 0, w, H, d, P.mud);
	G.box(0, 0.35, 0, w + 0.02, 0.4, d + 0.02, [0.85, 0.82, 0.75], { top: false });
	G.gable(0, 0.35 + H, 0, w, d, d * 0.3, [0.68, 0.36, 0.25], { o: 0.5, gc: P.mud });
	doorOn(B, 0, 0.9, 1.9, P, L, { c: [0.35, 0.25, 0.18], frame: shade(P.mud, 0.8) });
	windowOn(B, 0, w * 0.3, 1.3, 0.6, 0.6, P, L, { frame: shade(P.mud, 0.8), lit: 0.3 });
	B.smoke.push([-w * 0.3, 0.35 + H + d * 0.2, 0]);
	solid(B, 0, 0, w, d);
	void r;
};
// a temple of the north Indian manner: a sanctum under a tall curving spire (the shikhara),
// a porch before it, a saffron flag on the top
S.mandir = (B, L, P, r) => {
	const { G } = B, c = P.templeStone || [0.9, 0.82, 0.68];
	G.box(0, -0.8, 0, 12, 1.8, 16, shade(c, 0.9));
	G.box(0, 1, 3, 7, 4.5, 7, c);
	for (let k = 0; k < 8; k++) { const t = k / 8, s = 7 * (1 - t * t * 0.85); G.box(0, 5.5 + k * 1.3, 3, s, 1.3, s, shade(c, k % 2 ? 0.95 : 1.03)); }
	G.cyl(0, 15.9, 3, 1.1, 1.1, 0.5, [0.85, 0.78, 0.6], { n: 12 }).cyl(0, 16.4, 3, 0.25, 0.05, 1.4, [0.85, 0.68, 0.28], { n: 6 });
	G.box(0.3, 16.4, 3, 0.05, 2.6, 0.05, [0.4, 0.3, 0.2]); G.sheet([[0.3, 18.9, 3], [1.6, 18.5, 3], [0.3, 18.1, 3], [0.3, 18.1, 3]], [0.98, 0.55, 0.12]);
	G.box(0, 1, -3, 6, 3.5, 5, c, { top: false });
	for (const sx of [-1, 1]) for (const sz of [-5.3, -0.8]) G.cyl(sx * 2.6, 1, sz, 0.25, 0.25, 3.5, shade(c, 0.95), { n: 8 });
	G.dome(0, 4.5, -3, 2.6, c, { k: 0.8, n: 10, rings: 4 });
	for (let k = 0; k < 4; k++) G.box(0, 1 - (k + 1) * 0.25, -7.2 - k * 0.35, 4, 0.25, 0.35, shade(c, 0.9));
	solid(B, 0, 0, 12, 16);
	void r;
};
// a banyan's platform (the tree itself is flora): a raised round seat where the village meets
S.banyan = (B) => { B.G.cyl(0, 0, 0, 5, 5, 0.7, [0.75, 0.68, 0.58], { n: 14 }); B.trees.push([0, 0, 'sacredfig', 18]); solid(B, 0, 0, 2.4, 2.4); B.seat = [3.5, 0, Math.PI / 2]; B.seatY = 0.7; };
// a tea stall: a cart or a kiosk, a kettle on the stove, benches
S.chai = (B, L, P, r) => {
	const { G } = B, c = pick(r, [[0.2, 0.45, 0.6], [0.75, 0.25, 0.15], [0.85, 0.7, 0.25]]);
	G.box(0, 0, 0, 2.2, 1, 1.2, c).box(0, 1, 0.5, 2.2, 1.2, 0.2, c).slab(0, 2.2, 0, 2.6, 1.8, 0.08, [0.55, 0.56, 0.58]);
	for (const x of [-1.1, 1.1]) G.box(x, 1, -0.55, 0.08, 1.2, 0.08, [0.4, 0.4, 0.4]);
	G.cyl(-0.5, 1, -0.2, 0.18, 0.15, 0.3, [0.75, 0.7, 0.6], { n: 8 });
	B.smoke.push([-0.5, 1.4, -0.2]);
	S.bench(B, L, P, r);
	solid(B, 0, 0, 2.2, 1.2);
	B.seat = [0, 0.9, Math.PI];
};
S.charpai = (B) => { const { G } = B; for (const x of [-0.9, 0.9]) for (const z of [-0.45, 0.45]) G.box(x, 0, z, 0.08, 0.45, 0.08, [0.45, 0.32, 0.2]); G.slab(0, 0.42, 0, 1.9, 0.95, 0.06, [0.85, 0.78, 0.6]); };
S.handpump = (B) => { B.G.box(0, 0, 0, 1.2, 0.15, 1.2, [0.6, 0.58, 0.55]).cyl(0, 0.15, 0, 0.1, 0.1, 1.1, [0.25, 0.4, 0.3], { n: 6 }).beam(0, 1.2, 0, 0.7, 1.4, 0, 0.05, [0.25, 0.4, 0.3]); };
S.haystack = (B, L, P, r) => { B.G.cyl(0, 0, 0, 1.6, 1.4, 1.8, [0.78, 0.68, 0.4], { n: 10, top: false }).cone(0, 1.8, 0, 1.45, 1.5 + r() * 0.5, [0.76, 0.66, 0.38], 10); solid(B, 0, 0, 3, 3); };
// a stepwell: a deep stone tank, flights of steps down its sides
S.stepwell = (B, L, P) => { const { G } = B, c = P.templeStone || [0.78, 0.68, 0.52]; for (let k = 0; k < 7; k++) { const s = 18 - k * 2.2; for (const sd of [-1, 1]) { G.box(0, -k * 0.9, sd * s / 2, s, 0.9, 1.1, shade(c, k % 2 ? 0.95 : 1.02)); G.box(sd * s / 2, -k * 0.9, 0, 1.1, 0.9, s, shade(c, k % 2 ? 0.95 : 1.02)); } } G.slab(0, -6.6, 0, 4, 4, 0.05, [0.25, 0.35, 0.33]); for (const sd of [-1, 1]) { solid(B, 0, sd * 9.5, 20, 1); solid(B, sd * 9.5, 0, 1, 20); } };

// ---------- the generated landmarks and their ruins ----------
// a watchtower fallen to ruin: a round or square tower, its top broken, stones at its foot
S.watchtower = (B, L, P, r) => {
	const { G } = B, c = P.stone, round = r() < 0.5, H = 9 + r() * 6;
	if (round) { G.cyl(0, -1, 0, 3.2, 2.8, H * 0.7, c, { n: 12 }); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; G.box(Math.cos(a) * 2.6, H * 0.7 - 1, Math.sin(a) * 2.6, 1.4, (Math.sin(i * 7.3) * 0.5 + 0.5) * H * 0.35, 0.6, c, { r: -a }); } }
	else { G.box(0, -1, 0, 5.5, H * 0.75, 5.5, c); for (let i = 0; i < 4; i++) G.box(-2.2 + i * 1.5, H * 0.75 - 1, -2.5, 1.1, (i % 2 ? 0.5 : 1.6) + r() * 2, 0.6, c); }
	for (let i = 0; i < 9; i++) G.box((r() - 0.5) * 12, -0.2, (r() - 0.5) * 12, 0.6 + r(), 0.5 + r() * 0.5, 0.6 + r(), shade(c, 0.9 + r() * 0.2), { r: r() * 3 });
	G.face([[-0.7, 0, -2.81], [0.7, 0, -2.81], [0.7, 2.2, -2.81], [-0.7, 2.2, -2.81]], DARK);
	solid(B, 0, 0, 5.6, 5.6);
};
S.ruin = (B, L, P, r) => { const { G } = B, c = P.stone || P.mud; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; G.box(Math.cos(a) * 6, -0.5, Math.sin(a) * 6, 6, 1 + r() * 2.6, 0.7, shade(c, 0.9 + r() * 0.15), { r: -a + Math.PI / 2 }); } G.box(0, -0.5, 0, 1, 3 + r() * 2, 1, c); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B.solid.push([Math.cos(a) * 6, Math.sin(a) * 6, 6, 0.8, -a + Math.PI / 2]); } };
// a shrine on a pass: in the manner of the place (P.shrine: a cairn with flags, a wayside
// chapel, a small shrine behind a torii, an apacheta of stones)
S.passshrine = (B, L, P, r) => {
	const k = P.shrine || 'cairn';
	if (k === 'chorten') { S.chorten(B, L, P, r, 0, 0, 0.7); for (const s of [-1, 1]) S.flagpole(B, L, P, r, s * 4, 2, 0); return; }
	if (k === 'torii') { S.torii(B, L, P, r, 0, -4, 0.8); const { G } = B; G.box(0, 0, 2, 1.6, 0.5, 1.4, [0.55, 0.53, 0.5]).box(0, 0.5, 2, 1.2, 1.3, 1, [0.45, 0.32, 0.2]).gable(0, 1.8, 2, 1.2, 1, 0.5, [0.3, 0.3, 0.3], { o: 0.3 }); solid(B, 0, 2, 1.6, 1.4); return; }
	if (k === 'chapel') { const { G } = B, c = [0.94, 0.93, 0.9]; G.box(0, 0, 0, 3, 3, 4, c).gable(0, 3, 0, 4, 3, 1.4, P.roof, { o: 0.3, r: Math.PI / 2, gc: c }); G.face([[-0.5, 0.1, -2.01], [0.5, 0.1, -2.01], [0.5, 2, -2.01], [-0.5, 2, -2.01]], DARK); solid(B, 0, 0, 3, 4); return; }
	if (k === 'ovoo') return S.ovoo(B, L, P, r);
	const { G } = B; G.cone(0, 0, 0, 1.8, 1.8, [0.48, 0.47, 0.43], 8); for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 1.8 + r() * 2; G.box(Math.cos(a) * d, 0, Math.sin(a) * d, 0.3 + r() * 0.3, 0.2 + r() * 0.3, 0.3 + r() * 0.3, [0.5, 0.48, 0.44]); } G.box(0, 1.4, 0, 0.1, 2.4, 0.1, [0.45, 0.36, 0.26]); solid(B, 0, 0, 2.6, 2.6);
};
// a ship long wrecked: a wooden hull heeled over on the ice or the shore, ribs showing through
S.shipwreck = (B, L, P, r) => {
	const { G } = B, len = 28, wood = [0.32, 0.26, 0.2], tilt = 0.35;
	const q = (x, y, z) => [x, y * Math.cos(tilt) - z * Math.sin(tilt) - 0.8, y * Math.sin(tilt) + z * Math.cos(tilt)];
	for (let i = 0; i < 14; i++) {
		const t = i / 13, x = -len / 2 + t * len, bw = 3.6 * Math.sin(Math.PI * (0.08 + t * 0.84)), keep = i < 5 || r() < 0.5;
		for (const s of [-1, 1]) { const a = q(x, 0, 0), b = q(x, 2.2, s * bw), c2 = q(x, 4.6, s * bw * 1.05); G.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.25, wood).beam(b[0], b[1], b[2], c2[0], c2[1], c2[2], 0.22, wood); }
		if (keep && i < 13) { const x2 = x + len / 13, bw2 = 3.6 * Math.sin(Math.PI * (0.08 + (i + 1) / 13 * 0.84)); for (const s of [-1]) G.face([q(x, 0.2, 0), q(x2, 0.2, 0), q(x2, 2.4, s * bw2), q(x, 2.4, s * bw)].map((p) => p), shade(wood, 1.1)).face([q(x, 2.4, s * bw), q(x2, 2.4, s * bw2), q(x2, 4.4, s * bw2 * 1.05), q(x, 4.4, s * bw * 1.05)], shade(wood, 0.95)); }
	}
	const m0 = q(-3, 3, 0), m1 = q(-3, 15, 0); G.beam(m0[0], m0[1], m0[2], m1[0], m1[1], m1[2], 0.35, wood);
	const k0 = q(-len / 2, 0, 0), k1 = q(len / 2, 0, 0); G.beam(k0[0], k0[1], k0[2], k1[0], k1[1], k1[2], 0.4, shade(wood, 0.8));
	solid(B, 0, 0, len, 6);
};
// an old whaling station: try-pots on a stone hearth, the stumps of a shed, a bleached rib
S.whalers = (B, L, P, r) => { const { G } = B; G.box(0, -0.3, 0, 6, 1, 2.4, [0.42, 0.4, 0.38]); for (const x of [-1.5, 1.5]) G.cyl(x, 0.7, 0, 0.9, 0.7, 0.9, [0.18, 0.17, 0.16], { n: 10, topc: DARK }); for (let i = 0; i < 5; i++) G.box(-8 + i * 2.5, 0, 6, 0.3, 0.5 + r(), 0.3, [0.35, 0.3, 0.25]); G.beam(4, 0, 4, 6, 3.5, 6.5, 0.3, [0.85, 0.83, 0.76]); solid(B, 0, 0, 6, 2.4); };
S.lighthouse = (B) => { const { G, glow } = B; G.cyl(0, -0.5, 0, 2.6, 1.8, 18, [0.95, 0.95, 0.93], { n: 14 }); for (let k = 0; k < 3; k++) G.cyl(0, 2 + k * 6, 0, 2.5 - k * 0.27, 2.4 - k * 0.27, 2, [0.75, 0.15, 0.12], { n: 14, top: false }); G.cyl(0, 17.5, 0, 2.4, 2.4, 0.3, [0.2, 0.2, 0.2], { n: 14 }).cyl(0, 17.8, 0, 1.2, 1.2, 2, [0.4, 0.45, 0.48], { n: 10 }).cone(0, 19.8, 0, 1.5, 1.4, [0.2, 0.2, 0.2], 10); glow?.cyl(0, 18, 0, 1.15, 1.15, 1.6, [1, 0.9, 0.6], { n: 10 }); B.lights.push([0, 18.8, 0]); solid(B, 0, 0, 5, 5); };
S.stonecircle = (B, L, P, r) => { const { G } = B, n = 12; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; G.box(Math.cos(a) * 12, -0.3, Math.sin(a) * 12, 1.2 + r() * 0.5, 2.2 + r() * 1.6, 0.7, shade([0.55, 0.55, 0.52], 0.9 + r() * 0.2), { r: -a }); B.solid.push([Math.cos(a) * 12, Math.sin(a) * 12, 1.4, 0.8, -a]); } };
S.stonecross = (B) => { B.G.box(0, 0, 0, 0.9, 0.5, 0.9, [0.5, 0.5, 0.48]).box(0, 0.5, 0, 0.3, 2.4, 0.25, [0.55, 0.55, 0.52]).box(0, 2.1, 0, 1.2, 0.28, 0.25, [0.55, 0.55, 0.52]); solid(B, 0, 0, 0.9, 0.9); };
S.chapelrock = (B, L, P, r) => { S.passshrine(B, L, { ...P, shrine: 'chapel' }, r); };
S.oldmine = (B) => { const { G } = B, w = [0.35, 0.28, 0.2]; G.box(0, 0, 3, 8, 5, 4, [0.45, 0.43, 0.4]); G.face([[-1.2, 0, 0.99], [1.2, 0, 0.99], [1.2, 2.4, 0.99], [-1.2, 2.4, 0.99]], DARK); for (const s of [-1, 1]) G.box(s * 1.35, 0, 0.8, 0.3, 2.6, 0.3, w); G.box(0, 2.6, 0.8, 3, 0.3, 0.3, w); for (let i = 0; i < 6; i++) G.box(0, 0.02, -1 - i * 1.2, 1.6, 0.08, 0.2, w); solid(B, 0, 3, 8, 4); };
S.hermitage = (B, L, P, r) => { const { G } = B; G.box(0, -1, 0, 12, 6, 6, [0.5, 0.48, 0.45]); G.box(0, 0, -3.1, 4, 3, 0.4, [0.9, 0.88, 0.82]); G.face([[-0.6, 0, -3.31], [0.6, 0, -3.31], [0.6, 1.8, -3.31], [-0.6, 1.8, -3.31]], [0.55, 0.15, 0.1]); S.flagpole(B, L, P, r, 3, -4, 0); solid(B, 0, 0, 12, 6); };
S.incaruin = (B, L, P, r) => { const { G } = B, c = [0.6, 0.58, 0.52]; for (let i = 0; i < 3; i++) G.box(0, -0.5 + i * 1.5, i * 3.5, 22, 1.6, 3.5, shade(c, 0.95)); for (let j = 0; j < 4; j++) { const x = -8 + j * 5.5; G.box(x, 4, 8, 4, 2.6, 0.8, c).box(x - 1.6, 4, 9.6, 0.8, 2.6, 3.2, c).box(x + 1.6, 4, 9.6, 0.8, 2.6, 3.2, c); G.face([[x - 0.45, 4.6, 7.59], [x + 0.45, 4.6, 7.59], [x + 0.35, 6, 7.59], [x - 0.35, 6, 7.59]], DARK); } solid(B, 0, 3.5, 22, 10.5); void r; };
S.sacredtree = (B, L, P, r) => { const { G } = B; B.trees.push([0, 0, 'sacredfig', 22]); for (let i = 0; i < 10; i++) { const a = r() * 6.28; G.sheet([[Math.cos(a) * 1.1, 2.4, Math.sin(a) * 1.1], [Math.cos(a) * 1.2, 2.4, Math.sin(a) * 1.2 + 0.1], [Math.cos(a) * 1.2, 1.6, Math.sin(a) * 1.2 + 0.1], [Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1]], pick(r, [[0.85, 0.15, 0.12], [0.95, 0.8, 0.2], [0.95, 0.95, 0.92]])); } solid(B, 0, 0, 4, 4); };
S.baobab = (B) => { B.trees.push([0, 0, 'oldbaobab', 18]); solid(B, 0, 0, 6, 6); };
S.oldbore = (B, L, P, r) => { S.windmill(B, L, P, r); S.tank(B, L, P, r, 4, 0); };
S.oldbridge = (B, L, P) => { const { G } = B, c = P.stone; G.box(0, -1, 0, 4, 1.2, 24, c); for (let i = 0; i < 3; i++) G.arch(0, -1, -8 + i * 8, 6, 4, 0.8, c, { r: Math.PI / 2 }); for (const s of [-1, 1]) G.box(s * 1.9, 0.2, 0, 0.3, 0.8, 24, c); };
S.inuksukx = S.inuksuk;
S.reefwreck = (B, L, P, r) => S.shipwreck(B, L, P, r);
// an explorers' hut kept as it was: weathered boards, a low roof, crates stacked by the wall
S.oldhut = (B) => { const { G } = B, w = [0.42, 0.36, 0.28]; G.box(0, -0.2, 0, 10, 2.8, 7, w).gable(0, 2.6, 0, 10, 7, 1.6, [0.3, 0.28, 0.26], { o: 0.3, gc: w, snow: 0.6 }); for (let k = 0; k < 6; k++) G.box(5.6, 0, -2.5 + k * 0.9, 0.8, 0.5 + (k % 3) * 0.5, 0.8, [0.55, 0.45, 0.32]); G.face([[-0.5, 0, -3.51], [0.5, 0, -3.51], [0.5, 1.8, -3.51], [-0.5, 1.8, -3.51]], [0.25, 0.2, 0.15]); solid(B, 0, 0, 10, 7); };

export const STRUCTURES = S;
// a palette's defaults (atlas colours fill walls and roofs; these give the rest)
export function basePalette(atlasPal, kit, r, opts = {}) {
	const walls = (atlasPal?.walls?.length ? atlasPal.walls : ['#e8e0d0']).map(col);
	const roofs = (atlasPal?.roofs?.length ? atlasPal.roofs : ['#6a5a50']).map(col);
	const P = {
		walls, wall: pick(r, walls), wall2: pick(r, walls), roof: pick(r, roofs), trim: [0.92, 0.9, 0.86], door: [0.35, 0.24, 0.16], wood: [0.5, 0.36, 0.24], darkwood: [0.3, 0.22, 0.15],
		stone: [0.55, 0.53, 0.5], plaster: [0.92, 0.9, 0.85], mud: [0.72, 0.55, 0.38], thatch: [0.62, 0.52, 0.32], tin: [0.6, 0.61, 0.62], bamboo: [0.72, 0.62, 0.42], accent: [0.78, 0.2, 0.14],
		shutter: null, snow: opts.snow || 0,
	};
	const k = kit.id;
	if (k === 'snow' || k === 'polar') { P.wood = pick(r, [[0.42, 0.28, 0.18], [0.36, 0.26, 0.18], [0.5, 0.36, 0.24], [0.6, 0.22, 0.14]]); P.trim = pick(r, [[0.92, 0.9, 0.86], [0.3, 0.45, 0.65], [0.86, 0.85, 0.8]]); P.roof = pick(r, [[0.25, 0.25, 0.27], [0.45, 0.18, 0.14], [0.32, 0.35, 0.38]]); }
	if (k === 'polar') { P.wall = pick(r, [[0.78, 0.18, 0.14], [0.16, 0.36, 0.66], [0.9, 0.72, 0.18], [0.16, 0.54, 0.36], [0.94, 0.93, 0.9]]); P.roof = [0.12, 0.12, 0.13]; P.accent = pick(r, [[0.85, 0.25, 0.12], [0.92, 0.55, 0.1], [0.2, 0.42, 0.66]]); }
	if (k === 'alpine') { P.wood = [0.38, 0.24, 0.14]; P.roof = pick(r, [[0.32, 0.3, 0.3], [0.45, 0.3, 0.22]]); P.shutter = pick(r, [[0.15, 0.4, 0.25], [0.6, 0.15, 0.12], null]); P.plaster = [0.94, 0.92, 0.88]; }
	if (k === 'himalaya') { P.stone = [0.52, 0.48, 0.44]; }
	if (k === 'andes') { P.mud = [0.62, 0.45, 0.32]; P.thatch = [0.72, 0.62, 0.38]; P.stone = [0.5, 0.48, 0.44]; }
	if (k === 'village') { P.stone = pick(r, [[0.72, 0.64, 0.5], [0.52, 0.5, 0.48], [0.62, 0.55, 0.45]]); P.shutter = pick(r, [null, [0.2, 0.35, 0.25], [0.3, 0.4, 0.55]]); }
	if (k === 'farm') { P.wall = pick(r, [[0.94, 0.93, 0.9], [0.92, 0.88, 0.75], [0.7, 0.75, 0.78]]); P.barn = [0.6, 0.15, 0.12]; P.gambrel = true; P.shutter = pick(r, [null, [0.15, 0.2, 0.15], [0.12, 0.15, 0.25]]); }
	if (k === 'mediterranean') { P.stone = pick(r, [[0.78, 0.7, 0.56], [0.72, 0.62, 0.48]]); P.shutter = pick(r, [[0.15, 0.35, 0.6], [0.2, 0.4, 0.3], [0.45, 0.6, 0.6]]); P.roof = [0.7, 0.38, 0.25]; }
	if (k === 'desert' || k === 'sahel' || k === 'pueblo') { P.mud = pick(r, [[0.76, 0.58, 0.4], [0.7, 0.5, 0.34], [0.8, 0.64, 0.45], [0.66, 0.46, 0.32]]); P.door = pick(r, [[0.42, 0.3, 0.2], [0.2, 0.42, 0.55], [0.6, 0.35, 0.18]]); }
	if (k === 'pueblo') P.pueblo = true;
	if (k === 'savanna') { P.mud = pick(r, [[0.62, 0.42, 0.28], [0.7, 0.5, 0.34], [0.55, 0.38, 0.26]]); P.thatch = [0.66, 0.56, 0.36]; }
	if (k === 'jungle' || k === 'island') { P.wood = pick(r, [[0.48, 0.36, 0.24], [0.56, 0.44, 0.3]]); P.thatch = [0.58, 0.48, 0.3]; }
	if (k === 'island') P.walls = [[0.95, 0.95, 0.92], [0.4, 0.7, 0.85], [0.95, 0.8, 0.35], [0.5, 0.75, 0.55], [0.9, 0.55, 0.5]];
	if (k === 'eastvillage' || k === 'eastcity') { P.roof = pick(r, [[0.32, 0.33, 0.36], [0.28, 0.3, 0.32], [0.38, 0.36, 0.34]]); P.lanterns = !opts.japan; P.japan = opts.japan; P.stone = [0.55, 0.54, 0.52]; P.templeRoof = opts.japan ? [0.25, 0.27, 0.3] : pick(r, [[0.85, 0.62, 0.15], [0.2, 0.42, 0.3], [0.3, 0.3, 0.32]]); P.curved = !opts.city && r() < 0.5; }
	if (k === 'southasia') P.walls = [[0.95, 0.8, 0.6], [0.6, 0.78, 0.85], [0.92, 0.65, 0.65], [0.9, 0.88, 0.78], [0.75, 0.88, 0.7], [0.95, 0.9, 0.55]];
	if (k === 'bazaar') { P.walls = walls.length > 1 ? walls : [[0.88, 0.8, 0.66], [0.82, 0.72, 0.56], [0.92, 0.88, 0.8]]; P.wall = pick(r, P.walls); }
	P.mosque = opts.mosque;
	P.orthodox = opts.faith === 'orthodox';
	P.blueDome = opts.blueDome;
	P.shrine = opts.shrine;
	return P;
}
