// The trailer's camera rig, evaluated inside the page (added after the engine loads).
//
// A shot's camera is a list of keys { t, p: [x,y,z], l: [x,y,z], fov, roll } in shot
// seconds. Positions and look-at targets run on centripetal Catmull-Rom splines, FOV and
// roll on smooth cubic curves; the shot's clock can be eased as a whole (a slow push that
// settles, a crane that lands), and a "handheld" layer adds a few centimetres of breathing
// drift and the faintest roll. window.CINE.sample(t) gives the pose; CINE.attach() hands
// it to the engine (Crysis.cine), which applies it after the player moves every frame.
(() => {
	const lerp = (a, b, k) => a + (b - a) * k;
	const EASE = {
		linear: (x) => x,
		inOut: (x) => x * x * (3 - 2 * x),
		inOut2: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
		out: (x) => 1 - Math.pow(1 - x, 3),
		outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -9 * x)),
		in: (x) => x * x * x,
		// a steady move that is already moving at the cut and settles at the end
		glide: (x) => x * (1.35 - 0.35 * x * x),
	};
	// centripetal Catmull-Rom through p0..p3, at u in [0,1] between p1 and p2
	function cr(p0, p1, p2, p3, u) {
		const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-4, 0.5);
		const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
		const t = lerp(t1, t2, u), out = [0, 0, 0];
		for (let i = 0; i < 3; i++) {
			const A1 = (t1 - t) / (t1 - t0) * p0[i] + (t - t0) / (t1 - t0) * p1[i];
			const A2 = (t2 - t) / (t2 - t1) * p1[i] + (t - t1) / (t2 - t1) * p2[i];
			const A3 = (t3 - t) / (t3 - t2) * p2[i] + (t - t2) / (t3 - t2) * p3[i];
			const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
			const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
			out[i] = (t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2;
		}
		return out;
	}
	const ext = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1], 2 * a[2] - b[2]];
	function along(keys, field, i, u) {
		const n = keys.length, P = (j) => keys[j][field];
		const p1 = P(i), p2 = P(Math.min(n - 1, i + 1));
		if (p1 === p2 || n < 2) return p1.slice();
		const p0 = i > 0 ? P(i - 1) : ext(p1, p2), p3 = i + 2 < n ? P(i + 2) : ext(p2, p1);
		return cr(p0, p1, p2, p3, u);
	}
	// smooth noise: a few incommensurate sines per channel
	function wob(t, s) {
		return Math.sin(t * 0.73 + s) * 0.5 + Math.sin(t * 1.37 + s * 2.1) * 0.3 + Math.sin(t * 2.91 + s * 3.7) * 0.2;
	}
	function path(keys, opts = {}) {
		keys = keys.map((k) => ({ fov: 50, roll: 0, ...k }));
		for (let i = 1; i < keys.length; i++) { keys[i].fov ??= keys[i - 1].fov; }
		const T0 = keys[0].t, T1 = keys[keys.length - 1].t, ease = EASE[opts.ease || 'inOut'] || EASE.inOut;
		const shake = opts.shake ?? 0.04, sway = opts.sway ?? 0.0025, dur = opts.dur ?? T1;
		return (t) => {
			// the shot's clock, eased across the whole move
			const x = Math.min(1, Math.max(0, (t - T0) / Math.max(1e-6, (Math.min(dur, T1) - T0))));
			const tt = T0 + ease(x) * (T1 - T0);
			let i = 0;
			while (i < keys.length - 2 && tt > keys[i + 1].t) i++;
			const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)];
			const u = b.t > a.t ? Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t))) : 0;
			const su = u * u * (3 - 2 * u);
			const p = along(keys, 'p', i, u), l = along(keys, 'l', i, u);
			const fov = lerp(a.fov, b.fov, su) + (opts.breathe || 0) * Math.sin(t * 0.9);
			const roll = lerp(a.roll, b.roll, su);
			// handheld: position drift in metres, a hair of look drift and roll
			const d = Math.hypot(l[0] - p[0], l[1] - p[1], l[2] - p[2]);
			p[0] += wob(t, 1) * shake; p[1] += wob(t, 2) * shake * 0.6; p[2] += wob(t, 3) * shake;
			l[0] += wob(t * 0.8, 4) * sway * d; l[1] += wob(t * 0.8, 5) * sway * d * 0.7; l[2] += wob(t * 0.8, 6) * sway * d;
			return { p, l, fov, roll: roll + wob(t * 0.6, 7) * sway * 0.6 };
		};
	}
	const CINE = window.CINE = {
		t: 0, pose: null, EASE, path, hold: false,
		W: () => window.L99Island.world(),
		ground: (x, z) => Math.max(0, window.L99Island.world().island.heightAt(x, z)),
		land: (x, z) => window.L99Island.world().island.heightAt(x, z),
		LL: (lat, lon) => [(lon + 122.57) * 111320 * Math.cos(37.76 * Math.PI / 180), -(lat - 37.76) * 110996],
		// the Boardwalk's own frame (bay/rides/kit.js): u along the promenade, v out to sea
		BW: (u, v) => {
			const [ox, oz] = CINE.LL(36.96354, -122.01674), a = 16 * Math.PI / 180;
			return [ox + u * Math.cos(a) + v * Math.sin(a), oz - u * Math.sin(a) + v * Math.cos(a)];
		},
		// where the player stands and looks (after a Crysis go(): a cave, a castle, a site)
		anchor() {
			const P = window.L99Island.world().player.state, cp = Math.cos(P.pitch);
			return { p: P.pos.toArray(), yaw: P.yaw, pitch: P.pitch, f: [-Math.sin(P.yaw) * cp, Math.sin(P.pitch), -Math.cos(P.yaw) * cp] };
		},
		// the highest ground within R of the centre (a coarse scan), as [x, y, z]
		peak(R = 900, step = 20) {
			let best = [0, -1e9, 0];
			for (let x = -R; x <= R; x += step) for (let z = -R; z <= R; z += step) { const y = CINE.land(x, z); if (y > best[1]) best = [x, y, z]; }
			return best;
		},
		// run the engine on without drawing (inside a shot's setup, to let a place build)
		async settle(n = 60, pauseMs = 0) {
			for (let i = 0; i < n; i++) {
				window.__cine.noRender = true; window.__cine.step(1 / 60);
				if (pauseMs && i % 10 === 9) await new Promise((r) => setTimeout(r, pauseMs));
			}
		},
		// the longest straight run of mapped street within R of (x, z) that is at least minL long:
		// { a: start, d: unit direction, L: length, cls } (the real map's roads; else the town grid)
		street(x, z, R = 250, minL = 80) {
			const w = CINE.W(), ok = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk']);
			let best = null;
			if (w.real?.loaded?.()) {
				for (const r of w.real.near('roads', x, z, R)) {
					if (!r.pts || r.pts.length < 4 || (r.cls && !ok.has(r.cls))) continue;
					const p = r.pts;
					// runs of segments that keep within ~6 degrees of the first
					for (let i = 0; i + 3 < p.length; i += 2) {
						let dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1];
						const l0 = Math.hypot(dx, dz);
						if (l0 < 1) continue;
						dx /= l0; dz /= l0;
						let j = i + 2, L = l0;
						while (j + 3 < p.length) {
							const ex = p[j + 2] - p[j], ez = p[j + 3] - p[j + 1], le = Math.hypot(ex, ez);
							if (le < 1 || (ex * dx + ez * dz) / le < 0.994) break;
							L += le; j += 2;
						}
						const mx = p[i] + dx * L / 2, mz = p[i + 1] + dz * L / 2, off = Math.hypot(mx - x, mz - z);
						const score = Math.min(L, 400) - off * 0.5;
						if (L >= minL && (!best || score > best.score)) best = { a: [p[i], p[i + 1]], d: [dx, dz], L, cls: r.cls, score };
					}
				}
			}
			if (!best) {
				const U = w.bayArea?.urbanAt?.(x, z), G = window.Crysis.grid;
				if (U && G) {
					const a = Math.round(U.a / (Math.PI / 2) * 255) / 255 * Math.PI / 2, [BX, , ST] = G.BLOCKS[U.s];
					const [gx, gz] = G.toGrid(x, z, a, U.s), i = Math.round((gx - ST / 2) / BX), sx = i * BX + ST / 2;
					const [ax, az] = G.fromGrid(sx, gz - 150, a, U.s), [bx, bz] = G.fromGrid(sx, gz + 150, a, U.s), L = Math.hypot(bx - ax, bz - az);
					best = { a: [ax, az], d: [(bx - ax) / L, (bz - az) / L], L, cls: 'grid' };
				}
			}
			return best;
		},
		// somewhere to strike: walks the player (the engine's camera with it) to spots round
		// `center`, looks about, and casts the world's own tap ray (music.hitAt) through the
		// middle of the view until it meets a plant or stone of the wanted kind (its
		// material175: wood, stone, soft) between dmin and dmax metres off.
		// Gives { p: the eye, l: the struck point, d, species } or null.
		async find(kind, { center = [0, 0], R = 300, tries = 30, dmin = 5, dmax = 22, eye = 1.7, minLand = 1 } = {}) {
			const w = CINE.W(), P = w.player.state;
			CINE.hold = true;
			let found = null;
			for (let k = 0; k < tries && !found; k++) {
				const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
				const x = center[0] + Math.sin(a) * r, z = center[1] + Math.cos(a) * r;
				if (CINE.land(x, z) < minLand) continue;
				P.flying = true; P.vel.set(0, 0, 0); P.pos.set(x, CINE.land(x, z) + eye, z); P.pitch = -0.04;
				await CINE.settle(24, 10);
				for (let q = 0; q < 16 && !found; q++) {
					P.yaw = q / 16 * Math.PI * 2; P.pos.set(x, CINE.land(x, z) + eye, z);
					await CINE.settle(1);
					const cam = CINE.camera;
					if (!cam) continue;
					cam.updateMatrixWorld();
					for (const y of [-0.05, -0.2, 0.1]) {
						const hit = w.music.hitAt(0, y);
						if (hit && hit.object?.userData?.material175 === kind && hit.distance >= dmin && hit.distance <= dmax) {
							found = { p: cam.position.toArray(), l: hit.point.toArray(), d: hit.distance, species: hit.object.userData.species };
							break;
						}
					}
				}
			}
			CINE.hold = false;
			return found;
		},
		// keys on an arc round c (radius r, height h over c) from angle a0 to a1, looking at c + [0, lookH, 0]
		orbit(c, r, h, a0, a1, T, lookH = 0, n = 4, fov = 50) {
			const keys = [];
			for (let i = 0; i < n; i++) {
				const k = i / (n - 1), a = a0 + (a1 - a0) * k;
				keys.push({ t: T * k, p: [c[0] + Math.sin(a) * r, c[1] + h, c[2] + Math.cos(a) * r], l: [c[0], c[1] + lookH, c[2]], fov });
			}
			return keys;
		},
		sample(t) { return CINE.pose ? CINE.pose(t) : null; },
		attach() {
			const T = window.L99Island.T;
			const look = new T.Vector3();
			window.Crysis.cine((camera) => {
				CINE.camera = camera;
				if (CINE.hold || !CINE.pose) return;
				const s = CINE.pose(CINE.t);
				if (!s) return;
				camera.position.set(s.p[0], s.p[1], s.p[2]);
				camera.up.set(0, 1, 0);
				camera.lookAt(look.set(s.l[0], s.l[1], s.l[2]));
				if (s.roll) camera.rotateZ(s.roll);
				if (Math.abs(camera.fov - s.fov) > 1e-4) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
				// the player stays with the camera, so everything that streams round "you" is here
				const P = window.L99Island.world().player.state;
				P.flying = true; P.pos.copy(camera.position); P.vel.set(0, 0, 0);
				const e = new T.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
				P.yaw = e.y; P.pitch = e.x;
			});
		},
	};
})();
