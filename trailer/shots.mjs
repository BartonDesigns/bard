// The trailer's shots, in cut order, cut to the soundtrack (trailer/soundtrack.mjs: the
// Bard's own Studio, 100 BPM, a bar is 2.4 s). Each shot:
//   id      its frames' folder name
//   bars    bars on screen; its length (dur, s) and where it sits in the song (song, s) follow
//   dom     captured from the faceplate page by trailer/faceplate.mjs, not the world
//   world   the dev page query for a generated planet ('' or absent: the Bay Area, Earth)
//   warm    engine steps run (undrawn) at the first pose before frame 0, to let the place stream in
//   settle  real-time pause (x100 ms) every 10 warm steps, for loads that finish off the clock
//   setup   (w, C) => ctx: set the scene (time of day, weather, events); evaluated in the page
//   cam     (S, w, C) => keys [{ t, p, l, fov }] or a pose function; S is setup's ctx. Keys are
//           stretched to the shot's length (opts.fit: false keeps their own times)
//   taps    screen points [x, y, scatter] (-1..1) the lead notes strike, in turn, through the
//           world's own tap (trailer/cine-music.js); kind: the tone when the object has none
//   opts    the rig's options: ease, shake, sway, breathe
// setup and cam are sent to the page as source, so they may use only their arguments.
export const FPS = 60;
export const BPM = 100;
export const BAR = 240 / BPM;
// the song's first downbeat (soundtrack.mjs renders from 50 ms in)
export const START = 0.05;
// the end card holds the last two bars and the ring-out
export const END_BARS = 2;

// each shot's caption (trailer/cards.py draws them): a title and a line under it
export const CAPTIONS = {
	gg: ['Golden Gate Bridge', 'San Francisco Bay, true to scale'],
	wood: ['Play the world', 'Every surface is an instrument'],
	stone: ['Strike stone', 'Each material its own voice'],
	mystic: ['Other worlds', 'Other voices'],
	soft: ['The world listens', 'Your bass moves the wind'],
	volcano: ['A world on fire', ''],
	cave: ['The caves below', ''],
	castle: ['A realm of castles', ''],
	alien: ['Alien works', ''],
	ice: ['An ice world', ''],
	boardwalk: ['Santa Cruz Beach Boardwalk', ''],
	sf: ['San Francisco', ''],
	diablo: ['Mt Diablo', 'At sundown'],
};

// a tap shot: somewhere near `center` to stand, a plant or stone of `kind` 6-20 m ahead, a
// slow push toward it while the lead notes strike it
const tapSetup = (kind, hours, center) => `async (w, C) => {
	w.sky.state.hours = ${hours};
	if (w.alien?.group) w.alien.group.visible = false;
	const f = await C.find('${kind}', { center: ${JSON.stringify(center)}, R: 260, dmin: 6, dmax: 20 });
	if (!f) return { info: 'nothing to strike' };
	return { f, info: '${kind}: ' + f.species + ' at ' + f.d.toFixed(1) + ' m' };
}`;
const tapCam = (S) => {
	if (!S.f) return [{ t: 0, p: [0, 300, 0], l: [0, 0, -100] }, { t: 1, p: [0, 300, 0], l: [0, 0, -100] }];
	const p = S.f.p, l = S.f.l, k = 0.22;
	// from a little to one side, easing in along the line of sight
	const q = [p[0] + (l[0] - p[0]) * k, p[1] + (l[1] - p[1]) * k, p[2] + (l[2] - p[2]) * k];
	return [{ t: 0, p: [p[0], p[1] + 0.3, p[2]], l, fov: 50 }, { t: 1, p: q, l, fov: 46 }];
};
const TAPS = [[0, -0.02, 0.1], [0.05, 0.1, 0.1], [-0.05, -0.12, 0.1], [0.02, 0.04, 0.1]];

export const SHOTS = [
	// bars 1-4: the faceplate, played; the world button at the end (trailer/faceplate.mjs)
	{ id: 'face', bars: 4, dom: true },
	// bars 5-6: into the world on the downbeat
	// the Golden Gate at golden hour: a glide in over the water toward the towers
	{ id: 'gg', bars: 2, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.15 },
		setup: (w) => { w.sky.state.hours = 18.9; w.weather.set('fair'); const B = w.bridge; return { B: [B.centre.x, B.centre.z], info: 'bridge ' + B.centre.x.toFixed(0) + ',' + B.centre.z.toFixed(0) }; },
		cam: (S, w, C) => {
			const [ax, az] = C.LL(37.8132, -122.4930), [bx, bz] = C.LL(37.8158, -122.4855);
			return [{ t: 0, p: [ax, 28, az], l: [S.B[0], 125, S.B[1] + 150], fov: 50 }, { t: 5, p: [bx, 46, bz], l: [S.B[0], 140, S.B[1] + 120], fov: 50 }];
		} },
	// bars 7-14: striking the world on the lead line, one material to a pair of bars
	{ id: 'wood', bars: 2, world: '?planet=TROPICAL&seed=1', warm: 120, settle: 2, kind: 'wood', taps: TAPS, opts: { ease: 'inOut', shake: 0.03 },
		setup: tapSetup('wood', 17.4, [0, 0]), cam: tapCam },
	{ id: 'stone', bars: 2, world: '?planet=TERRAN&seed=3', warm: 120, settle: 2, kind: 'stone', taps: TAPS, opts: { ease: 'inOut', shake: 0.03 },
		setup: tapSetup('stone', 17.8, [0, 0]), cam: tapCam },
	{ id: 'mystic', bars: 2, world: '?planet=MYSTICAL&seed=1', warm: 120, settle: 2, kind: 'crystal', taps: TAPS, opts: { ease: 'inOut', shake: 0.03 },
		setup: tapSetup('wood', 17.2, [0, 0]), cam: tapCam },
	{ id: 'soft', bars: 2, world: '?planet=TERRAN&seed=3', warm: 120, settle: 2, kind: 'soft', taps: TAPS, opts: { ease: 'inOut', shake: 0.03 },
		setup: tapSetup('soft', 18.0, [0, 0]), cam: tapCam },
	// bars 15-26: the worlds, a bar each, cut on the downbeat, the bands moving them
	// a volcano erupting, magma glowing at dusk
	{ id: 'volcano', bars: 2, world: '?planet=MAGMA&seed=1', warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.25 },
		setup: (w) => {
			w.sky.state.hours = 19.3;
			const V = w.volcano, v = V?.vent;
			window.Crysis.erupt(22);
			return { v: v ? [v.x, v.y, v.z] : [0, 100, 0], info: 'vent ' + (v ? v.toArray().map((q) => q.toFixed(0)) : 'none') + ' ' + JSON.stringify(window.Crysis.volcano()) };
		},
		cam: (S, w, C) => C.orbit([S.v[0], S.v[1], S.v[2]], 520, 40, 2.2, 2.6, 5, 60, 4, 50) },
	// a village deep in the caves
	{ id: 'cave', bars: 1, world: '?planet=MEDIEVAL&seed=1', warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.03 },
		setup: async (w, C) => {
			const U = w.underworld, ch = U.plan.chambers, v = ch.find((c) => c.kind === 'village') || ch.find((c) => c.kind === 'ruins') || ch[0];
			const P = w.player.state;
			P.flying = true; P.pos.set(v.x, v.fy + 2, v.z);
			await C.settle(240, 30);
			return { v: [v.x, v.fy, v.z], rx: v.rx, rz: v.rz, h: v.h, info: 'chamber ' + v.kind + ' ' + [v.x, v.fy, v.z, v.rx, v.rz, v.h].map((q) => q.toFixed(0)) };
		},
		cam: (S) => {
			const r = Math.min(S.rx, S.rz) * 0.8, y = S.v[1] + Math.min(S.h * 0.45, 7);
			return [{ t: 0, p: [S.v[0] + r, y, S.v[2]], l: [S.v[0], S.v[1] + 2, S.v[2]], fov: 60 }, { t: 4, p: [S.v[0] + r * 0.55, y - 1.5, S.v[2] + r * 0.35], l: [S.v[0] - 3, S.v[1] + 2, S.v[2]], fov: 60 }];
		} },
	// a medieval castle on its hill
	{ id: 'castle', bars: 1, world: '?planet=MEDIEVAL&seed=1', warm: 180, settle: 2, opts: { ease: 'inOut', shake: 0.12 },
		setup: (w, C) => {
			w.sky.state.hours = 17.8;
			window.Crysis.medieval('castle');
			const A = C.anchor(), fx = -Math.sin(A.yaw), fz = -Math.cos(A.yaw);
			const x = A.p[0] + fx * 150, z = A.p[2] + fz * 150;
			return { c: [x, C.ground(x, z), z], a: Math.atan2(A.p[0] - x, A.p[2] - z) };
		},
		cam: (S, w, C) => C.orbit(S.c, 105, 32, S.a - 0.45, S.a + 0.1, 4.5, 10, 4, 46) },
	// the town under the castle
	{ id: 'town', bars: 1, world: '?planet=MEDIEVAL&seed=1', warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.04 },
		setup: (w, C) => { w.sky.state.hours = 17.9; window.Crysis.medieval('town'); return { A: C.anchor() }; },
		cam: (S) => {
			const p = S.A.p, f = S.A.f, L = 30;
			return [{ t: 0, p: [p[0], p[1] + 1.5, p[2]], l: [p[0] + f[0] * L, p[1] + 1, p[2] + f[2] * L], fov: 55 }, { t: 3.5, p: [p[0] + f[0] * 9, p[1] + 1.2, p[2] + f[2] * 9], l: [p[0] + f[0] * (L + 9), p[1] + 1.5, p[2] + f[2] * (L + 9)], fov: 55 }];
		} },
	// a mystical world, its alien city
	{ id: 'alien', bars: 1, world: '?planet=MYSTICAL&seed=1', warm: 180, settle: 2, opts: { ease: 'inOut', shake: 0.15 },
		setup: (w) => {
			w.sky.state.hours = 16.6;
			// the landmark: the tallest of the works, with the rest round it
			const sites = window.Crysis.alien(), S = sites.find((q) => q.type === 'landmark') || sites[0];
			return { c: [S.x, S.y, S.z], r: S.r, h: S.h || 80, info: S.name + ' ' + S.type + ' r' + S.r + ' h' + S.h };
		},
		cam: (S, w, C) => C.orbit(S.c, S.r + 140 + S.h * 0.5, S.h * 0.3, 0.2, 0.85, 4.5, S.h * 0.45, 4, 52) },
	// a snowbound ice world, over its highest peak
	{ id: 'ice', bars: 1, world: '?planet=ICE&seed=1', warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.2 },
		setup: (w, C) => { w.sky.state.hours = 15.5; if (w.alien?.group) w.alien.group.visible = false; const pk = C.peak(900); return { pk, info: 'peak ' + pk.map((q) => q.toFixed(0)) }; },
		cam: (S, w, C) => C.orbit(S.pk, 380, 50, 0.3, 0.8, 4, -20, 4, 50) },
	// the Santa Cruz Beach Boardwalk from the beach: the Giant Dipper and the wheel
	{ id: 'boardwalk', bars: 1, warm: 240, settle: 3, opts: { ease: 'inOut', shake: 0.06 },
		setup: (w) => { w.sky.state.hours = 18.6; return {}; },
		cam: (S, w, C) => {
			const a = C.BW(-45, 32), b = C.BW(85, 24), t = C.BW(110, -40);
			return [{ t: 0, p: [a[0], 9, a[1]], l: [t[0], 15, t[1]], fov: 52 }, { t: 4.5, p: [b[0], 26, b[1]], l: [t[0], 12, t[1]], fov: 52 }];
		} },
	// downtown San Francisco at street level: a slow dolly down a street, over the traffic
	{ id: 'sf', bars: 1, warm: 180, settle: 3, opts: { ease: 'glide', shake: 0.04 },
		setup: (w, C) => {
			w.sky.state.hours = 18.3;
			const [x, z] = C.LL(37.7890, -122.4010), S = C.street(x, z, 300, 140);
			if (!S) return { info: 'no street' };
			// start a third of the way along, heading whichever way looks at more of the run
			const s0 = S.L * 0.3;
			return { a: [S.a[0] + S.d[0] * s0, S.a[1] + S.d[1] * s0], d: S.d, L: S.L - s0, info: 'street ' + S.cls + ' L' + S.L.toFixed(0) };
		},
		cam: (S, w, C) => {
			if (!S.a) return [{ t: 0, p: [0, 500, 0], l: [0, 0, -100] }, { t: 4, p: [0, 500, 0], l: [0, 0, -100] }];
			const P = (s, h) => { const x = S.a[0] + S.d[0] * s, z = S.a[1] + S.d[1] * s; return [x, C.ground(x, z) + h, z]; };
			const far = Math.min(S.L, 220);
			return [{ t: 0, p: P(0, 9), l: P(far, 14), fov: 55 }, { t: 4, p: P(45, 6), l: P(far + 45, 12), fov: 55 }];
		} },
	// Mt Diablo: in toward the summit at sundown, the valley falling away below
	{ id: 'diablo', bars: 2, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.12 },
		setup: (w) => { w.sky.state.hours = 18.7; window.Crysis.season(0.85); return {}; },
		cam: (S, w, C) => {
			const [sx, sz] = C.LL(37.8816, -121.9142), [ax, az] = C.LL(37.8690, -121.9480), [bx, bz] = C.LL(37.8730, -121.9380);
			const g = C.ground(sx, sz);
			return [{ t: 0, p: [ax, g - 60, az], l: [sx, g - 40, sz], fov: 48 }, { t: 4, p: [bx, g - 20, bz], l: [sx, g - 10, sz], fov: 46 }];
		} },
	// over Battery Spencer: the north tower close, the city across the strait
	{ id: 'gg2', bars: 1, warm: 90, settle: 1, opts: { ease: 'inOut', shake: 0.08 },
		setup: (w) => { w.sky.state.hours = 19.0; const B = w.bridge; return { B: [B.centre.x, B.centre.z] }; },
		cam: (S, w, C) => {
			// low over the water off the Marin shore, craning up as the north tower looms
			const [ax, az] = C.LL(37.8262, -122.4858), [bx, bz] = C.LL(37.8258, -122.4861), [tx, tz] = C.LL(37.8235, -122.4790);
			return [{ t: 0, p: [ax, 30, az], l: [tx, 120, tz], fov: 45 }, { t: 3.5, p: [bx, 78, bz], l: [tx, 105, tz], fov: 45 }];
		} },
];

// lengths and song positions from the bars
{
	let bar = 0;
	for (const s of SHOTS) { s.dur = s.bars * BAR; s.song = START + bar * BAR; bar += s.bars; }
}
