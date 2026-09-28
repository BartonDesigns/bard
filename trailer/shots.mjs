// The trailer's shots, in cut order. Each shot:
//   id      its frames' folder name
//   dur     seconds on screen (at FPS)
//   world   the dev page query for a generated planet ('' or absent: the Bay Area, Earth)
//   warm    engine steps run (undrawn) at the first pose before frame 0, to let the place stream in
//   settle  real-time pause (x100 ms) every 10 warm steps, for loads that finish off the clock
//   setup   (w, C) => ctx: set the scene (time of day, weather, events); evaluated in the page
//   cam     (S, w, C) => keys [{ t, p, l, fov }] or a pose function; S is setup's ctx
//   opts    the rig's options: ease, shake, sway, breathe
// setup and cam are sent to the page as source, so they may use only their arguments.
export const FPS = 60;

// each shot's place caption (trailer/cards.py draws them): a title and a line under it
export const CAPTIONS = {
	gg: ['Golden Gate Bridge', 'San Francisco Bay, true to scale'],
	sf: ['San Francisco', 'Downtown'],
	diablo: ['Mt Diablo', 'The summit at sundown'],
	boardwalk: ['Santa Cruz Beach Boardwalk', 'The Giant Dipper and the Ferris wheel'],
	wharf: ['Santa Cruz Municipal Wharf', 'Shops out over the bay'],
	tropical: ['Worlds beyond', 'A tropical island'],
	volcano: ['A world on fire', 'Eruption'],
	ice: ['An ice world', ''],
	alien: ['An alien city', 'On a mystical world'],
	castle: ['A realm of castles', ''],
	cave: ['The caves below', 'A village in the dark'],
};

export const SHOTS = [
	// 1. the Golden Gate at golden hour: a glide in over the water toward the towers
	{ id: 'gg', dur: 5, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.15 },
		setup: (w) => { w.sky.state.hours = 18.2; w.weather.set('fair'); const B = w.bridge; return { B: [B.centre.x, B.centre.z], info: 'bridge ' + B.centre.x.toFixed(0) + ',' + B.centre.z.toFixed(0) }; },
		cam: (S, w, C) => {
			const [ax, az] = C.LL(37.8105, -122.4990), [bx, bz] = C.LL(37.8140, -122.4905);
			return [{ t: 0, p: [ax, 45, az], l: [S.B[0], 95, S.B[1]], fov: 42 }, { t: 5, p: [bx, 62, bz], l: [S.B[0], 110, S.B[1]], fov: 40 }];
		} },
	// 2. over Battery Spencer: the north tower close, the city across the strait
	{ id: 'gg2', dur: 3.5, warm: 90, settle: 1, opts: { ease: 'inOut', shake: 0.08 },
		setup: (w) => { w.sky.state.hours = 18.4; const B = w.bridge; return { B: [B.centre.x, B.centre.z] }; },
		cam: (S, w, C) => {
			const [ax, az] = C.LL(37.8262, -122.4858), [bx, bz] = C.LL(37.8270, -122.4838), [tx, tz] = C.LL(37.8235, -122.4790);
			const g = C.ground(ax, az);
			return [{ t: 0, p: [ax, g + 30, az], l: [tx, 120, tz], fov: 45 }, { t: 3.5, p: [bx, g + 48, bz], l: [tx, 110, tz], fov: 45 }];
		} },
	// 3. downtown San Francisco: along Market Street toward the Ferry Building
	{ id: 'sf', dur: 4, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.05 },
		setup: (w) => { w.sky.state.hours = 17.4; return {}; },
		cam: (S, w, C) => {
			const [ax, az] = C.LL(37.7905, -122.4005), [bx, bz] = C.LL(37.7918, -122.3988), [tx, tz] = C.LL(37.7955, -122.3937);
			const g = C.ground(ax, az);
			return [{ t: 0, p: [ax, g + 14, az], l: [tx, g + 20, tz], fov: 50 }, { t: 4, p: [bx, g + 9, bz], l: [tx, g + 18, tz], fov: 50 }];
		} },
	// 4. Mt Diablo: a crane up off the summit, the valleys going gold
	{ id: 'diablo', dur: 4, warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.1 },
		setup: (w) => { w.sky.state.hours = 18.5; window.Crysis.season(0.8); return {}; },
		cam: (S, w, C) => {
			const [sx, sz] = C.LL(37.8816, -121.9142), [ax, az] = C.LL(37.8806, -121.9180), [tx, tz] = C.LL(37.84, -122.06);
			const g = C.ground(sx, sz);
			return [{ t: 0, p: [ax, C.ground(ax, az) + 6, az], l: [tx, g - 350, tz], fov: 55 }, { t: 4, p: [ax - 60, g + 60, az], l: [tx, g - 300, tz], fov: 55 }];
		} },
	// 5. the Santa Cruz Beach Boardwalk from the beach: the Giant Dipper and the wheel
	{ id: 'boardwalk', dur: 4.5, warm: 240, settle: 3, opts: { ease: 'inOut', shake: 0.06 },
		setup: (w) => { w.sky.state.hours = 18.6; return {}; },
		cam: (S, w, C) => {
			const a = C.BW(-20, 95), b = C.BW(110, 80), t = C.BW(130, -35);
			return [{ t: 0, p: [a[0], 6, a[1]], l: [t[0], 16, t[1]], fov: 50 }, { t: 4.5, p: [b[0], 20, b[1]], l: [t[0], 14, t[1]], fov: 48 }];
		} },
	// 6. the Municipal Wharf: along the deck past the shops
	{ id: 'wharf', dur: 3.5, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.05 },
		setup: (w) => { w.sky.state.hours = 18.7; return {}; },
		cam: (S, w, C) => {
			const [ax, az] = C.LL(36.9600, -122.0240), [bx, bz] = C.LL(36.9588, -122.0238), [tx, tz] = C.LL(36.9575, -122.0226);
			return [{ t: 0, p: [ax, 12, az], l: [tx, 5, tz], fov: 50 }, { t: 3.5, p: [bx, 10, bz], l: [tx, 5, tz], fov: 50 }];
		} },
	// 7. a tropical island from the air
	{ id: 'tropical', world: '?planet=TROPICAL&seed=1', dur: 4, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.2 },
		setup: (w, C) => {
			w.sky.state.hours = 17.6;
			// in from the sea over the beach, toward the peak
			const pk = C.peak(900), a = Math.atan2(pk[0], pk[2]) + 0.6;
			let d = 50;
			while (d < 1500 && C.land(Math.sin(a) * d, Math.cos(a) * d) > 0) d += 10;
			return { pk, a, d, info: 'coast at ' + d + ' peak ' + pk.map((q) => q.toFixed(0)) };
		},
		cam: (S) => {
			const P = (r, h) => [Math.sin(S.a) * r, h, Math.cos(S.a) * r];
			return [{ t: 0, p: P(S.d + 220, 40), l: [S.pk[0], S.pk[1] * 0.55, S.pk[2]], fov: 50 }, { t: 4, p: P(S.d + 10, 55), l: [S.pk[0], S.pk[1] * 0.6, S.pk[2]], fov: 50 }];
		} },
	// 8. a volcano erupting, magma glowing at dusk
	{ id: 'volcano', world: '?planet=MAGMA&seed=1', dur: 5, warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.25 },
		setup: (w) => {
			w.sky.state.hours = 19.3;
			const V = w.volcano, v = V?.vent;
			window.Crysis.erupt(22);
			return { v: v ? [v.x, v.y, v.z] : [0, 100, 0], info: 'vent ' + (v ? v.toArray().map((q) => q.toFixed(0)) : 'none') + ' ' + JSON.stringify(window.Crysis.volcano()) };
		},
		cam: (S, w, C) => C.orbit([S.v[0], S.v[1], S.v[2]], 520, 40, 2.2, 2.6, 5, 60, 4, 50) },
	// 9. a snowbound ice world, over its highest peak
	{ id: 'ice', world: '?planet=ICE&seed=1', dur: 4, warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.2 },
		setup: (w, C) => { w.sky.state.hours = 15.5; const pk = C.peak(900); return { pk, info: 'peak ' + pk.map((q) => q.toFixed(0)) }; },
		cam: (S, w, C) => C.orbit(S.pk, 380, 50, 0.3, 0.8, 4, -20, 4, 50) },
	// 10. a mystical world, its alien city
	{ id: 'alien', world: '?planet=MYSTICAL&seed=1', dur: 4.5, warm: 180, settle: 2, opts: { ease: 'inOut', shake: 0.15 },
		setup: (w) => {
			w.sky.state.hours = 18.9;
			const sites = window.Crysis.alien(), S = sites.find((s) => s.type === 'complex') || sites[0];
			return { c: [S.x, S.y, S.z], r: S.r, info: S.name + ' ' + S.type + ' r' + S.r };
		},
		cam: (S, w, C) => C.orbit(S.c, S.r + 110, 55, 0.2, 0.75, 4.5, 15, 4, 50) },
	// 11. a medieval castle on its hill
	{ id: 'castle', world: '?planet=MEDIEVAL&seed=1', dur: 4.5, warm: 180, settle: 2, opts: { ease: 'inOut', shake: 0.12 },
		setup: (w, C) => {
			w.sky.state.hours = 17.8;
			window.Crysis.medieval('castle');
			const A = C.anchor(), fx = -Math.sin(A.yaw), fz = -Math.cos(A.yaw);
			const x = A.p[0] + fx * 150, z = A.p[2] + fz * 150;
			return { c: [x, C.ground(x, z), z], a: Math.atan2(A.p[0] - x, A.p[2] - z) };
		},
		cam: (S, w, C) => C.orbit(S.c, 170, 55, S.a - 0.35, S.a + 0.2, 4.5, 12, 4, 50) },
	// 12. the town under the castle
	{ id: 'town', world: '?planet=MEDIEVAL&seed=1', dur: 3.5, warm: 150, settle: 2, opts: { ease: 'glide', shake: 0.04 },
		setup: (w, C) => { w.sky.state.hours = 17.9; window.Crysis.medieval('town'); return { A: C.anchor() }; },
		cam: (S) => {
			const p = S.A.p, f = S.A.f, L = 30;
			return [{ t: 0, p: [p[0], p[1] + 1.5, p[2]], l: [p[0] + f[0] * L, p[1] + 1, p[2] + f[2] * L], fov: 55 }, { t: 3.5, p: [p[0] + f[0] * 9, p[1] + 1.2, p[2] + f[2] * 9], l: [p[0] + f[0] * (L + 9), p[1] + 1.5, p[2] + f[2] * (L + 9)], fov: 55 }];
		} },
	// 13. a village deep in the caves
	{ id: 'cave', world: '?planet=MEDIEVAL&seed=1', dur: 4, warm: 150, settle: 2, opts: { ease: 'inOut', shake: 0.03 },
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
];
