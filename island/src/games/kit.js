// The shared kit every minigame is built on, so that each game file can be about its game
// and not about plumbing. It gives a game:
//   a stage: a group set down on a clear, flat patch of ground near the player (stage.js
//     finds it: no trees, houses or roads in it), so a game builds in its own coordinates
//     (-z ahead, +x right, y up, metres) and everything it adds is disposed of when it stops;
//   its venue: a closed room round an indoor game, or a painted backdrop round an outdoor
//     game that found nowhere clear (rooms.js);
//   a camera it can point, eased from shot to shot, and handed back as it was at the end;
//   the HUD in the fishing card's style: a title strip with the score, a close (×) button,
//     big buttons, and the result card with the stats and your best;
//   bests and play counts kept on this device under 'crysis-games';
//   little synthesised sounds (a tone, a burst of filtered noise) through the host's audio;
//   the pointer: where a tap lands on a plane in the stage, and the flick at the end of a
//     swipe (for rolls, tosses and throws).
// Nothing here imports three: the host hands it over as ctx.THREE.

import { findSpot, waterLevel } from './stage.js';
import { buildRoom, buildBackdrop } from './rooms.js';

const STORE = 'crysis-games';
export function readStore() {
	try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; }
}
function writeStore(s) {
	try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* private mode */ }
}

const PANEL = 'background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);color:#eafaf6;border-radius:16px;font:13px system-ui,sans-serif;';
const stopEv = (el) => { for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click']) el.addEventListener(ev, (e) => e.stopPropagation()); };

export function makeKit(ctx, GAME, { accent = '#5ad1c8', dist = 4, span = [4, 4, 1], place = 'clear', flat = 1.2, room = null, backdrop = null, dome = 60, hole = 0, lift = 0 } = {}) {
	const { THREE, scene, camera } = ctx;
	const K = { on: false, time: 0, last: null, cardOpen: false, accent, THREE };
	let layer = null, hudText = null, card = null, api = null, g = null;
	const saved = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 50 };
	const camWant = { pos: new THREE.Vector3(), look: new THREE.Vector3(), k: 0, snap: true, ready: false };
	// the camera's own eased pose (world): kept here, not read back from the camera, so that
	// nothing else moving the camera between frames can drag the shot back to the player
	const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
	const tv = new THREE.Vector3(), tm = new THREE.Matrix4(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

	// ---- the stage ----
	function begin() {
		const p = ctx.player.pos;
		// where: a clear, flat spot near the player that the game's footprint fits (stage.js);
		// an indoor game's footprint is its room
		const foot = room ? [room.w, -room.z0, room.z1] : span;
		const spot = findSpot(ctx, { mode: place, dist, span: foot, flat: room ? 4 : flat });
		K.clear = spot.clear; K.wet = spot.water;
		const { x, z, yaw } = spot;
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
		// the stage sits on the highest ground under its footprint, so that uneven terrain
		// never pokes up through a lane or a table; a water game sits at the water's level
		let gy = -Infinity;
		if (spot.water) gy = waterLevel(ctx, x, z) ?? 0;
		else for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
			const back = foot[2] ?? 1, u = (i / 4 - 0.5) * foot[0], v = j / 4 * (foot[1] + back) - back;
			const h = ctx.groundAt?.(x + fx * v - fz * u, z + fz * v + fx * u);
			if (Number.isFinite(h)) gy = Math.max(gy, h);
		}
		K.root = new THREE.Group();
		// (lift: a game sunk into the ground, like a rock pool, is raised to clear it)
		K.root.position.set(x, (Number.isFinite(gy) ? gy : p.y - 1.7) + lift, z);
		K.root.rotation.y = yaw;
		K.yaw = yaw;
		scene.add(K.root);
		K.root.updateMatrixWorld(true);
		// the venue: a room around an indoor game; a painted backdrop round an outdoor one
		// that found nowhere clear (or a water game that found no water)
		if (room) buildRoom(K, room);
		else if (backdrop && (place === 'water' ? !spot.water : !spot.clear)) {
			const hr = ctx.getWorld?.()?.sky?.state?.hours ?? 12;
			buildBackdrop(K, { kind: backdrop, r: dome, hole, night: hr < 6.5 || hr > 19.5 });
		}
		saved.pos.copy(camera.position); saved.quat.copy(camera.quaternion); saved.fov = camera.fov;
		// the first shot a game asks for is cut to, not eased into (until then the camera stays
		// where it was: easing from the stage's origin would start the shot inside the floor)
		camWant.snap = true; camWant.ready = false;
		layer = document.createElement('div');
		layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:8;user-select:none;-webkit-user-select:none;';
		const top = document.createElement('div');
		top.style.cssText = PANEL + `position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);max-width:min(460px,calc(100vw - 90px));padding:8px 16px;text-align:center;border-color:${accent}55;`;
		top.innerHTML = `<div style="font:700 14px system-ui;color:${accent}">${GAME.title}</div><div data-h style="margin-top:2px;white-space:pre-line"></div>`;
		hudText = top.querySelector('[data-h]');
		const x0 = document.createElement('button');
		x0.textContent = '×'; x0.setAttribute('aria-label', 'Close ' + GAME.title);
		x0.style.cssText = PANEL + 'position:absolute;right:calc(10px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));width:44px;height:44px;border-radius:22px;font:600 24px system-ui;line-height:1;pointer-events:auto;cursor:pointer;';
		stopEv(x0);
		x0.addEventListener('click', () => api?.stop());
		layer.append(top, x0);
		ctx.mount?.appendChild(layer);
		K.on = true; K.time = 0; K.cardOpen = false;
	}
	function end() {
		K.on = false;
		if (K.root) {
			const seen = new Set();
			K.root.traverse((o) => {
				// (a sprite's geometry is three's own, shared by every sprite: leave it be)
				if (o.geometry && !o.isSprite && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
				for (const m of [].concat(o.material || [])) if (!seen.has(m)) { seen.add(m); m.map?.dispose(); m.dispose(); }
			});
			K.root.removeFromParent();
			K.root = null;
		}
		layer?.remove(); layer = null; card = null;
		camera.position.copy(saved.pos); camera.quaternion.copy(saved.quat);
		if (camera.fov !== saved.fov) { camera.fov = saved.fov; camera.updateProjectionMatrix(); }
		matCache.clear();
		for (const t of texs) t.dispose();
		texs.length = 0;
	}

	// materials, shared by colour within a game, with a little glow so games read at night
	const matCache = new Map(), texs = [];
	K.mat = (color, o = {}) => {
		const key = o.map ? null : color + JSON.stringify(o);
		if (key && matCache.has(key)) return matCache.get(key);
		const c = new THREE.Color(color);
		const m = o.basic ? new THREE.MeshBasicMaterial({ color: c, transparent: !!o.opacity, opacity: o.opacity ?? 1, map: o.map || null, side: o.side ?? THREE.FrontSide, depthWrite: !o.opacity })
			: new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, map: o.map || null, emissive: c.clone().multiplyScalar(o.glow ?? 0.18), transparent: !!o.opacity, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
		if (key) matCache.set(key, m);
		return m;
	};
	// a mesh in the stage (or in a parent group), at a local position
	K.mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => {
		const m = new THREE.Mesh(geo, typeof mat === 'string' || typeof mat === 'number' ? K.mat(mat) : mat);
		m.position.set(x, y, z);
		(parent || K.root).add(m);
		return m;
	};
	K.box = (w, h, d, color, x, y, z, parent) => K.mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
	K.ball = (r, color, x, y, z, parent) => K.mesh(new THREE.SphereGeometry(r, 18, 12), color, x, y, z, parent);
	K.cyl = (r0, r1, h, color, x, y, z, parent, seg = 18) => K.mesh(new THREE.CylinderGeometry(r0, r1, h, seg), color, x, y, z, parent);
	// take something out of the stage part-way through a game: its shapes are freed, and its
	// own materials (shared materials and the painted textures go when the game stops)
	K.drop = (o) => {
		const shared = new Set(matCache.values());
		o.traverse((q) => { if (!q.isSprite) q.geometry?.dispose(); for (const m of [].concat(q.material || [])) if (!shared.has(m)) m.dispose(); });
		o.removeFromParent();
	};
	K.group = (parent) => { const g0 = new THREE.Group(); (parent || K.root).add(g0); return g0; };
	// a flat painted surface: a canvas drawn once, laid on the ground (or stood up)
	K.canvas = (w, h, draw) => {
		const c = document.createElement('canvas'); c.width = w; c.height = h;
		draw(c.getContext('2d'), w, h);
		const t = new THREE.CanvasTexture(c);
		texs.push(t);
		t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
		return t;
	};
	K.decal = (w, d, tex, x = 0, y = 0.01, z = 0, o = {}) => {
		const m = K.mesh(new THREE.PlaneGeometry(w, d), K.mat('#ffffff', { map: tex, rough: 0.8, ...o }), x, y, z, o.parent);
		m.rotation.x = -Math.PI / 2;
		return m;
	};
	// stage coordinates to world and back
	K.world = (v, out = new THREE.Vector3()) => K.root.localToWorld(out.copy(v));
	K.local = (v, out = new THREE.Vector3()) => K.root.worldToLocal(out.copy(v));
	// the ground under a stage point, in stage height (the terrain may not be flat)
	K.groundY = (x, z) => {
		K.world(tv.set(x, 0, z), tv);
		const gy = ctx.groundAt?.(tv.x, tv.z);
		return Number.isFinite(gy) ? gy - K.root.position.y : 0;
	};

	// the water at a stage point, in stage height, or null for land
	K.waterY = (x, z) => { K.world(tv.set(x, 0, z), tv); const lv = waterLevel(ctx, tv.x, tv.z); return lv === null ? null : lv - K.root.position.y; };

	// ---- the camera: where it wants to be (stage coordinates), eased there each frame ----
	K.cam = (px, py, pz, lx, ly, lz, k = 4) => { camWant.pos.set(px, py, pz); camWant.look.set(lx, ly, lz); camWant.k = k; camWant.ready = true; };
	// a framed shot: a subject (centre, apparent width and height in metres) seen from the
	// direction (dx, dy, dz), backed off until it fills `fill` of the screen whichever way the
	// phone is held (portrait squeezes the width, so it's the width that usually decides)
	K.frame = (cx, cy, cz, w, h, dx, dy, dz, fill = 0.68, k = 4, maxD = Infinity) => {
		const l = Math.hypot(dx, dy, dz) || 1, half = (camera.fov || 60) * Math.PI / 360;
		const hw = Math.atan(Math.tan(half) * (camera.aspect || 1));
		const d = Math.min(maxD, Math.max(h / 2 / Math.tan(half), w / 2 / Math.tan(hw)) / fill);
		K.cam(cx + dx / l * d, cy + dy / l * d, cz + dz / l * d, cx, cy, cz, k);
		return d;
	};
	K.fov = (f) => { if (camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); } };
	function camTick(dt) {
		if (!K.root || !camWant.ready) return;
		const p = K.world(camWant.pos, tv);
		if (camWant.snap) camPos.copy(p); else camPos.lerp(p, 1 - Math.exp(-dt * camWant.k));
		const l = K.world(camWant.look);
		if (camWant.snap) camLook.copy(l); else camLook.lerp(l, 1 - Math.exp(-dt * camWant.k));
		camera.position.copy(camPos);
		camera.lookAt(camLook);
		camera.updateMatrixWorld();
		camWant.snap = false;
	}

	// ---- the pointer ----
	const ptr = { down: false, x: 0, y: 0, x0: 0, y0: 0, t0: 0, hist: [] };
	K.ptr = ptr;
	function track(down, x, y) {
		const now = performance.now() / 1000;
		if (down === true) { ptr.down = true; ptr.x0 = x; ptr.y0 = y; ptr.t0 = now; ptr.hist = []; }
		if (down === false) ptr.down = false;
		if (Number.isFinite(x)) { ptr.x = x; ptr.y = y; ptr.hist.push([x, y, now]); if (ptr.hist.length > 40) ptr.hist.shift(); }
	}
	// the flick: velocity (px/s) over the last tenth of a second, and the whole drag
	K.swipe = () => {
		const h = ptr.hist, n = h.length, now = n ? h[n - 1][2] : 0;
		let i = n - 1;
		while (i > 0 && now - h[i - 1][2] < 0.12) i--;
		const a = h[Math.max(0, i - 1)] || [ptr.x, ptr.y, now], b = h[n - 1] || a, dt = Math.max(0.016, b[2] - a[2]);
		return { vx: (b[0] - a[0]) / dt, vy: (b[1] - a[1]) / dt, dx: ptr.x - ptr.x0, dy: ptr.y - ptr.y0, time: now - ptr.t0, hist: h };
	};
	K.size = () => { const r = ctx.mount?.getBoundingClientRect?.(); return r && r.width ? r : { left: 0, top: 0, width: window.innerWidth || 800, height: window.innerHeight || 600 }; };
	// a screen point to the stage plane y = h (null if the ray misses it)
	K.onPlane = (x, y, h = 0) => {
		const r = K.size();
		ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
		camera.updateMatrixWorld();
		ray.setFromCamera(ndc, camera);
		tm.copy(K.root.matrixWorld).invert();
		ray.ray.applyMatrix4(tm);
		const d = ray.ray.direction.y;
		if (Math.abs(d) < 1e-6) return null;
		const s = (h - ray.ray.origin.y) / d;
		return s > 0 ? ray.ray.origin.clone().addScaledVector(ray.ray.direction, s) : null;
	};
	// a stage point to screen pixels
	K.toScreen = (v) => {
		const r = K.size();
		const p = K.world(v).project(camera);
		return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, front: p.z < 1 };
	};
	// the pick: the first stage object in a list under a screen point
	K.pick = (x, y, objs) => {
		const r = K.size();
		ndc.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
		camera.updateMatrixWorld();
		K.root.updateMatrixWorld(true);
		ray.setFromCamera(ndc, camera);
		return ray.intersectObjects(objs, true)[0] || null;
	};

	// ---- the HUD ----
	K.hud = (text) => { if (hudText && hudText.textContent !== text) hudText.textContent = text; };
	K.el = (css, html = '') => {
		const e = document.createElement('div');
		e.style.cssText = css; e.innerHTML = html;
		layer?.appendChild(e);
		return e;
	};
	K.button = (label, fn, css = '') => {
		const b = document.createElement('button');
		b.innerHTML = label;
		b.style.cssText = PANEL + `position:absolute;min-width:56px;min-height:48px;padding:10px 18px;border-radius:24px;font:600 15px system-ui;pointer-events:auto;cursor:pointer;touch-action:none;${css}`;
		stopEv(b);
		b.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(true); });
		for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => fn(false));
		layer?.appendChild(b);
		return b;
	};
	// a meter: a bar with a marker, for power and tension
	K.meter = (label, grad = `linear-gradient(90deg,#2b5f8a,${accent} 60%,#d9a21c 85%,#c8321c)`) => {
		const e = K.el('position:absolute;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(280px,70vw);display:none;font:12px system-ui;color:#eafaf6;text-align:center;',
			`<div data-t style="margin-bottom:4px">${label}</div><div style="position:relative;height:12px;border-radius:6px;background:${grad}"><div data-k style="position:absolute;top:-3px;width:4px;height:18px;border-radius:2px;background:#fff;left:0"></div></div>`);
		return {
			set(v, text) { e.style.display = 'block'; e.querySelector('[data-k]').style.left = `calc(${Math.max(0, Math.min(1, v)) * 100}% - 2px)`; if (text !== undefined) e.querySelector('[data-t]').textContent = text; },
			hide() { e.style.display = 'none'; },
		};
	};
	K.say = (text, ms = 1600) => ctx.hint?.(text, ms);

	// ---- bests, and the result card ----
	K.best = () => readStore()[GAME.id]?.best ?? null;
	// a round is over: keep the best (lower is better for strokes and times), show the card
	K.finish = (score, { line = '', rows = [], lower = false, unit = '' } = {}) => {
		const s = readStore(), rec = s[GAME.id] || { best: null, plays: 0 };
		const isBest = rec.best === null || (lower ? score < rec.best : score > rec.best);
		rec.plays = (rec.plays || 0) + 1;
		if (isBest) rec.best = score;
		rec.last = score; rec.t = Date.now();
		s[GAME.id] = rec; writeStore(s);
		K.last = { score, best: rec.best, line };
		if (!layer) return K.last;
		card?.remove();
		card = K.el(PANEL + `position:absolute;left:50%;top:18%;transform:translateX(-50%);width:min(320px,84vw);padding:16px;text-align:center;pointer-events:auto;background:rgba(8,20,26,.92);z-index:2;`,
			`<div style="font:700 17px system-ui;color:${accent}">${GAME.title}</div>
			<div style="font:800 40px system-ui;margin:6px 0 2px">${score}${unit ? `<span style="font-size:16px;font-weight:600"> ${unit}</span>` : ''}</div>
			<div style="opacity:.9;margin-bottom:8px">${isBest && rec.plays > 1 ? 'A new best!' : rec.plays === 1 ? 'Your first round' : `Best ${rec.best}${unit ? ' ' + unit : ''}`}</div>
			${line ? `<div style="margin-bottom:8px">${line}</div>` : ''}
			${rows.map(([a, b]) => `<div style="display:flex;justify-content:space-between;opacity:.8;font-size:12px;padding:2px 8px"><span>${a}</span><span>${b}</span></div>`).join('')}
			<div style="opacity:.55;font-size:12px;margin:6px 0 10px">${rec.plays} round${rec.plays > 1 ? 's' : ''} played on this device</div>
			<div style="display:flex;gap:10px;justify-content:center"><button data-a style="${PANEL}min-height:44px;padding:10px 18px;border-radius:22px;font:600 14px system-ui;background:${accent};color:#08141a;cursor:pointer">Play again</button><button data-d style="${PANEL}min-height:44px;padding:10px 18px;border-radius:22px;font:600 14px system-ui;cursor:pointer">Done</button></div>`);
		stopEv(card);
		card.querySelector('[data-a]').addEventListener('click', () => { card?.remove(); card = null; K.cardOpen = false; g?.reset(); });
		card.querySelector('[data-d]').addEventListener('click', () => api?.stop());
		K.cardOpen = true;
		K.tone(660, 0.12, { vol: 0.12 }); K.tone(880, 0.2, { vol: 0.12, at: 0.12 });
		return K.last;
	};

	// ---- sound ----
	const dest = () => { try { return ctx.audio?.() || null; } catch { return null; } };
	// a tone: frequency (sliding to `to`), length, wave shape
	K.tone = (f, d = 0.15, { type = 'sine', vol = 0.15, to = 0, at = 0 } = {}) => {
		const out = dest();
		if (!out) return;
		const ac = out.context, t0 = ac.currentTime + at;
		const o = ac.createOscillator(), gn = ac.createGain();
		o.type = type; o.frequency.setValueAtTime(f, t0);
		if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + d);
		gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
		o.connect(gn); gn.connect(out); o.start(t0); o.stop(t0 + d + 0.05);
	};
	// a held tone, for as long as a key is down: returns the function that lets it go
	K.hum = (f, vol = 0.08, type = 'sine') => {
		const out = dest();
		if (!out) return () => {};
		const ac = out.context, t0 = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
		o.type = type; o.frequency.value = f;
		gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
		o.connect(gn); gn.connect(out); o.start(t0);
		return () => { const t1 = ac.currentTime; gn.gain.cancelScheduledValues(t1); gn.gain.setValueAtTime(gn.gain.value, t1); gn.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.02); o.stop(t1 + 0.05); };
	};
	// a burst of filtered noise: clatter, splash, whoosh, thud
	K.noise = (d = 0.2, { vol = 0.2, f = 1200, q = 0.8, type = 'bandpass', at = 0 } = {}) => {
		const out = dest();
		if (!out) return;
		const ac = out.context, t0 = ac.currentTime + at, n = Math.max(1, Math.floor(ac.sampleRate * d));
		const buf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0);
		for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
		const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
		s.buffer = buf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; gn.gain.value = vol;
		s.connect(fl); fl.connect(gn); gn.connect(out); s.start(t0);
	};

	// ---- the game's face to the host ----
	// g: { build(), reset(), update(dt, t), press(down, x, y), move(x, y), end() }
	K.wrap = (game) => {
		g = game;
		api = {
			start() { if (K.on) return; begin(); g.build(); g.reset(); g.update(0.001, 0); camTick(1); },
			stop() { if (!K.on) return; g.end?.(); end(); },
			update(dt, t) { if (!K.on) return; K.time += dt; g.update(dt, t); if (K.on) camTick(dt); },
			press(down, x, y) { if (!K.on || K.cardOpen) return; track(down, x, y); g.press?.(down, x, y); },
			move(x, y) { if (!K.on || K.cardOpen) return; track(null, x, y); g.move?.(x, y); },
			active: () => K.on,
			result: () => K.last,
		};
		return api;
	};
	return K;
}

// small shared maths
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
