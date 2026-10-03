// The arcade: every minigame (games/*.js) offered where it fits. The games button comes up
// only when a venue is within two kilometres (the lanes at the Presidio, the Musée
// Mécanique's machines, the courts, the beaches, a ball field in the park, the water's
// edge), and its list holds what can be played from here: the venues nearest first with
// how far they are, then the games that set up anywhere. Picking a venue game takes you to
// it and starts; walk into a venue and a Play button comes up. While a game runs it has
// the screen: the host stops the walking and looking, routes every touch to the game, and
// gives the camera over to it until it is closed.
// A game's `where` is a list of real places (kind 'site'), any water ('water'), anywhere,
// or 'dynamic': a function that finds its venues round a point as the world is built
// (the ball fields: see sportsfields.js).

import * as THREE from 'three';
import { GAMES } from './games/index.js';
import { icon } from './games/icons.js';
import { waterLevel } from './games/stage.js';
import { toWorld, toLatLon } from './bay/geo.js';
import { scrollable } from './ui/scroll.js';

// how near a venue has to be for the games to be offered
const NEAR = 2000;

export function createArcade({ scene, camera, mount, getWorld, hint, isPhone, teleportTo }) {
	// the venues, in world coordinates
	const SITES = [];
	for (const G of GAMES) if (G.where?.kind === 'site') for (const s of G.where.sites || []) SITES.push({ G, ...s, ...toWorld(s.lat, s.lon) });
	const DYN = GAMES.filter((G) => G.where?.kind === 'dynamic' && typeof G.where.sites === 'function');
	const WET = GAMES.filter((G) => G.where?.kind === 'water');
	const ANY = GAMES.filter((G) => !G.where || G.where.kind === 'anywhere' || !G.where.kind);
	let cur = null, curG = null, nearSite = null, scanT = 0, bus = null, near = [], water = null, waterT = 0;
	// an indoor game (a closed room) sees only itself: the camera draws one layer, the game's
	// objects and the lights are put on it, and the world outside is simply not drawn
	const ROOM = 5;
	let stage = [], lit = [];

	const ctx = {
		THREE, scene, camera, mount, getWorld, isPhone,
		hint: (t, ms) => hint(t, ms),
		groundAt: (x, z) => getWorld()?.island.heightAt(x, z),
		audio: () => {
			const b = window._masterClip || window.leadBus227, c = b?.context;
			if (!c || c.state !== 'running') return null;
			if (!bus || bus.context !== c) { bus = c.createGain(); bus.gain.value = 0.8; bus.connect(b); }
			return bus;
		},
		// (read when a game starts: where you stand and which way you look)
		player: {
			get pos() { return getWorld()?.player.state.pos; },
			get yaw() { return getWorld()?.player.state.yaw || 0; },
		},
		// the venue the game was started at (a field's own layout rides on it), or null
		site: null,
	};

	// ---- the touch layer: everything goes to the game while it runs ----
	const layer = document.createElement('div');
	layer.style.cssText = 'position:absolute;inset:0;z-index:7;display:none;touch-action:none;';
	mount.appendChild(layer);
	let down = false;
	const at = (e) => [e.clientX, e.clientY];
	layer.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); down = true; layer.setPointerCapture?.(e.pointerId); cur?.press(true, ...at(e)); });
	layer.addEventListener('pointermove', (e) => { e.stopPropagation(); cur?.move(...at(e)); });
	for (const ev of ['pointerup', 'pointercancel']) layer.addEventListener(ev, (e) => { e.stopPropagation(); if (down) { down = false; cur?.press(false, ...at(e)); } });
	for (const ev of ['touchstart', 'touchmove', 'touchend', 'wheel', 'click', 'mousedown']) layer.addEventListener(ev, (e) => e.stopPropagation());
	addEventListener('keydown', (e) => { if (cur && e.key === 'Escape') stop(); });

	// ---- the button, the list, the Play prompt ----
	const style = 'position:absolute;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(8,20,26,.78);color:#eafaf6;font:600 14px system-ui;cursor:pointer;z-index:5;';
	const btn = document.createElement('button');
	btn.title = 'Games'; btn.setAttribute('aria-label', 'Games');
	btn.innerHTML = icon('games', 24);
	btn.style.cssText = style + 'width:44px;height:44px;padding:0;display:none;align-items:center;justify-content:center;';
	btn.dataset.hud = 'rail 50';
	const menu = document.createElement('div');
	menu.style.cssText = 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));max-height:calc(100% - 64px - var(--l99-low, 88px) - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;display:none;flex-direction:column;gap:4px;padding:8px;width:min(300px,78vw);border-radius:12px;background:rgba(8,20,26,.88);border:1px solid rgba(255,255,255,.18);z-index:6;';
	const play = document.createElement('button');
	play.style.cssText = style + 'padding:10px 22px 10px 16px;border-radius:24px;display:none;align-items:center;gap:8px;white-space:nowrap;';
	play.dataset.hud = 'prompt 40';
	for (const el of [btn, menu, play]) { for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation()); mount.appendChild(el); }
	scrollable(menu);
	const far = (d) => d < 1 ? 'here' : d < 950 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`;
	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
	function row(G, where, fn) {
		const b = document.createElement('button');
		b.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#eafaf6;font:13px system-ui;min-height:44px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;';
		b.innerHTML = `<span style="color:#5ad1c8;margin-top:1px">${icon(G.id, 22)}</span><span style="min-width:0"><span style="display:block;font-weight:600">${esc(G.title)}</span><span style="display:block;opacity:.65;font-size:11px;margin-top:2px">${esc(G.blurb || '')}</span><span style="display:block;opacity:.55;font-size:11px;margin-top:1px">${esc(where)}</span></span>`;
		b.onclick = (e) => { e.stopPropagation(); menu.style.display = 'none'; fn(); };
		menu.appendChild(b);
	}
	const heading = (t) => { const h = document.createElement('div'); h.style.cssText = 'font:700 12px system-ui;color:#eafaf6;opacity:.7;padding:6px 4px 2px;'; h.textContent = t; menu.appendChild(h); };
	// the list, as it stands from here: each venue game once, at its nearest venue
	let shownSig = '';
	function nearest() {
		const best = new Map();
		for (const v of near) if (!best.has(v.G) || v.d < best.get(v.G).d) best.set(v.G, v);
		return [...best.values()].sort((a, b) => a.d - b.d);
	}
	const sig = (list) => list.map((v) => v.G.id + (v.site?.name || '') + far(v.d)).join('|');
	function fill() {
		menu.replaceChildren();
		const list = nearest();
		shownSig = sig(list);
		heading(`Games near you · ${list.length}`);
		for (const v of list) row(v.G, v.water ? `Water · ${far(v.d)}` : `${v.site.name} · ${far(v.d)}`, () => choose(v));
		if (ANY.length) { heading('Anywhere'); for (const G of ANY) row(G, 'right where you stand', () => start(G)); }
	}
	btn.onclick = (e) => { e.stopPropagation(); if (menu.style.display === 'none') { fill(); menu.style.display = 'flex'; } else menu.style.display = 'none'; };
	play.onclick = (e) => { e.stopPropagation(); if (nearSite) start(nearSite.G, nearSite.site); };

	// the nearest water, looked for in rings out to the limit (every couple of seconds)
	function findWater(P) {
		if (!WET.length) return null;
		const c = { getWorld, groundAt: ctx.groundAt };
		for (const r of [0, 25, 60, 120, 220, 360, 540, 780, 1080, 1440, 1800, NEAR]) {
			const n = r ? Math.max(8, Math.min(28, Math.round(r / 60))) : 1;
			for (let k = 0; k < n; k++) {
				const a = k / n * Math.PI * 2, x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
				if (waterLevel(c, x, z) !== null) return { x, z, d: r };
			}
		}
		return null;
	}
	// every venue within reach: the real places, the ones found round you, the water
	function venues(P) {
		const W = getWorld(), out = [], x = P.pos.x, z = P.pos.z;
		for (const s of SITES) { const d = Math.hypot(s.x - x, s.z - z); if (d < NEAR + s.r) out.push({ G: s.G, site: s, d: Math.max(0, d - s.r) }); }
		for (const G of DYN) {
			let list = [];
			try { list = G.where.sites(W, x, z, NEAR) || []; } catch (err) { console.warn('[arcade]', G.id, err); }
			for (const s of list) { const d = s.dist ? s.dist(x, z) : Math.max(0, Math.hypot(s.x - x, s.z - z) - s.r); if (d < NEAR) out.push({ G, site: s, d }); }
		}
		const now = performance.now();
		if (now > waterT) { waterT = now + 2000; water = findWater(P); }
		if (water) for (const G of WET) out.push({ G, site: null, water, d: water.d });
		return out;
	}

	// a venue game: to the venue, then play (a moment to let the ground there load)
	function choose(v) {
		const P = getWorld()?.player.state;
		if (!P) return;
		const S = v.site;
		if (S && v.d > 0) {
			// (a field is walked on at its own spot: the plate, the penalty spot, the tee)
			const sp = S.spot || S, ll = S.lat !== undefined ? S : toLatLon(sp.x, sp.z);
			teleportTo(S.name, ll.lat, ll.lon);
			if (S.spot) { P.pos.set(sp.x, (getWorld().island.heightAt(sp.x, sp.z) || 0) + 1.7, sp.z); P.yaw = sp.yaw ?? P.yaw; }
			setTimeout(() => start(v.G, S), 1500);
			return;
		}
		start(v.G, S);
	}
	function start(G, site = null) {
		stop();
		const W = getWorld();
		if (!W || W.player.state.flying) { hint('Land first, then play', 2000); return; }
		try {
			const before = new Set(scene.children);
			ctx.site = site;
			curG = G; cur = G.create(ctx); cur.start();
			stage = G.indoor ? scene.children.filter((o) => !before.has(o)) : [];
			if (G.indoor) {
				lit = [];
				scene.traverse((o) => { if (o.isLight) { o.layers.enable(ROOM); lit.push(o); } });
				camera.layers.set(ROOM);
			}
			layer.style.display = 'block'; play.style.display = 'none'; menu.style.display = 'none';
		} catch (err) { console.error('[arcade]', G.id, err); cur = null; curG = null; layer.style.display = 'none'; }
	}
	function stop() {
		if (!cur) return;
		try { if (cur.active()) cur.stop(); } catch (err) { console.error('[arcade]', err); }
		cur = null; curG = null; down = false; ctx.site = null;
		layer.style.display = 'none';
		if (stage.length || lit.length) { camera.layers.set(0); for (const o of lit) o.layers.disable(ROOM); stage = []; lit = []; }
	}

	function update(dt, t, enabled) {
		if (cur) {
			btn.style.display = 'none'; play.style.display = 'none';
			try { cur.update(dt, t); } catch (err) { console.error('[arcade]', curG?.id, err); stop(); return; }
			// (whatever the game has added since, balls and pins and all, onto the room's layer)
			for (const o of stage) o.traverse((q) => q.layers.enable(ROOM));
			// closed from its own × or Done
			if (!cur.active()) stop();
			return;
		}
		// the venues round you, and the one you stand in: its Play button
		// (checked twice a second of real time, however slow the frames)
		const now = performance.now();
		if (now > scanT) {
			scanT = now + 500;
			const P = getWorld()?.player.state;
			near = enabled && P ? venues(P) : [];
			const inside = P && !P.flying ? near.filter((v) => v.site && v.d === 0).sort((a, b) => Math.hypot(a.site.x - P.pos.x, a.site.z - P.pos.z) - Math.hypot(b.site.x - P.pos.x, b.site.z - P.pos.z))[0] : null;
			if (inside?.G !== nearSite?.G || inside?.site !== nearSite?.site) {
				nearSite = inside || null;
				if (nearSite) play.innerHTML = `${icon(nearSite.G.id, 20)}<span>Play ${esc(nearSite.G.title)}</span>`;
			}
			play.style.display = nearSite ? 'flex' : 'none';
			btn.style.display = near.length ? 'flex' : 'none';
			if (!near.length) menu.style.display = 'none';
			// (the open list follows you as you walk; standing still, it holds still under a finger)
			else if (menu.style.display !== 'none' && sig(nearest()) !== shownSig) fill();
		}
	}
	// a game by name: at the venue you stand in if it has one here, else wherever it sets up
	function startId(id) {
		const G = GAMES.find((g) => g.id === id);
		if (!G) return false;
		const P = getWorld()?.player.state;
		const v = P ? venues(P).filter((q) => q.G === G && q.site).sort((a, b) => a.d - b.d)[0] : null;
		start(G, v && v.d === 0 ? v.site : null);
		return true;
	}
	// (run the game on by some seconds without drawing: for trying a game out from the console)
	const step = (sec) => { for (let t = 0; t < sec && cur; t += 1 / 30) update(1 / 30, 0, true); };
	return { update, active: () => !!cur, start: startId, stop, step, games: () => GAMES.map((g) => g.id), near: () => near.map((v) => ({ id: v.G.id, name: v.site?.name || 'water', d: Math.round(v.d) })), shown: () => btn.style.display !== 'none' };
}
