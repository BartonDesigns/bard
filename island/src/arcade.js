// The arcade: every minigame (games/*.js) offered where it fits. A games button opens the
// list; a game with real venues (the lanes at the Presidio, the Musée Mécanique's machines,
// the courts, the beaches) takes you to the nearest one and starts; the rest start where you
// stand. Walk into a venue and a Play button comes up. While a game runs it has the screen:
// the host stops the walking and looking, routes every touch to the game, and gives the
// camera over to it until it is closed.

import * as THREE from 'three';
import { GAMES } from './games/index.js';
import { toWorld } from './bay/geo.js';

const ICON = { bowling: '🎳', skeeball: '🎯', pinball: '🕹️', airhockey: '🏒', hoops: '🏀', minigolf: '⛳', bocce: '⚪', discgolf: '🥏', stones: '🪨', kite: '🪁', surf: '🏄', skate: '🛹', cablebell: '🔔', sealions: '🦭', claw: '🧸', drums: '🥁', darts: '🎯', cornhole: '🌽', paperplane: '✈️', sandcastle: '🏰', tidepool: '🦀', stargaze: '✨', morse: '💡', batting: '⚾' };

export function createArcade({ scene, camera, mount, getWorld, hint, isPhone, teleportTo }) {
	// the venues, in world coordinates
	const SITES = [];
	for (const G of GAMES) for (const s of G.where?.sites || []) SITES.push({ G, ...s, ...toWorld(s.lat, s.lon) });
	let cur = null, curG = null, nearSite = null, scanT = 0, bus = null;
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
	btn.title = 'Games';
	btn.textContent = '🎮';
	btn.style.cssText = style + 'right:calc(12px + env(safe-area-inset-right));top:calc(376px + env(safe-area-inset-top));width:44px;height:44px;font-size:20px;display:none;';
	const menu = document.createElement('div');
	menu.style.cssText = 'position:absolute;right:calc(64px + env(safe-area-inset-right));top:calc(116px + env(safe-area-inset-top));max-height:calc(100dvh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;display:none;flex-direction:column;gap:4px;padding:8px;width:min(300px,78vw);border-radius:12px;background:rgba(8,20,26,.88);border:1px solid rgba(255,255,255,.18);z-index:6;';
	const play = document.createElement('button');
	play.style.cssText = style + 'left:50%;transform:translateX(-50%);bottom:calc(128px + env(safe-area-inset-bottom));padding:12px 22px;border-radius:24px;display:none;';
	for (const el of [btn, menu, play]) { for (const ev of ['pointerdown', 'touchstart', 'keydown']) el.addEventListener(ev, (e) => e.stopPropagation()); mount.appendChild(el); }
	const head = document.createElement('div');
	head.style.cssText = 'font:700 13px system-ui;color:#eafaf6;opacity:.8;padding:2px 4px 6px;';
	head.textContent = `Games · ${GAMES.length}`;
	menu.appendChild(head);
	for (const G of GAMES) {
		const b = document.createElement('button');
		b.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#eafaf6;font:13px system-ui;min-height:44px;cursor:pointer;';
		const where = G.where?.kind === 'site' ? (G.where.sites || []).map((s) => s.name).slice(0, 2).join(' · ') : G.where?.kind === 'water' ? 'by any water' : 'anywhere';
		b.innerHTML = `<div style="font-weight:600">${ICON[G.id] || '🎲'} ${G.title}</div><div style="opacity:.65;font-size:11px;margin-top:2px">${G.blurb || ''}</div><div style="opacity:.5;font-size:11px;margin-top:1px">${where}</div>`;
		b.onclick = (e) => { e.stopPropagation(); menu.style.display = 'none'; choose(G); };
		menu.appendChild(b);
	}
	btn.onclick = (e) => { e.stopPropagation(); menu.style.display = menu.style.display === 'none' ? 'flex' : 'none'; };
	play.onclick = (e) => { e.stopPropagation(); if (nearSite) start(nearSite.G); };

	// a venue game: to the nearest venue, then play (a moment to let the ground there load)
	function choose(G) {
		const P = getWorld()?.player.state;
		if (!P) return;
		if (G.where?.kind === 'site' && G.where.sites?.length) {
			const S = SITES.filter((s) => s.G === G).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0];
			if (Math.hypot(S.x - P.pos.x, S.z - P.pos.z) > S.r) {
				teleportTo(S.name, S.lat, S.lon);
				setTimeout(() => start(G), 1500);
				return;
			}
		}
		start(G);
	}
	function start(G) {
		stop();
		const W = getWorld();
		if (!W || W.player.state.flying) { hint('Land first, then play', 2000); return; }
		try {
			const before = new Set(scene.children);
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
		cur = null; curG = null; down = false;
		layer.style.display = 'none';
		if (stage.length || lit.length) { camera.layers.set(0); for (const o of lit) o.layers.disable(ROOM); stage = []; lit = []; }
	}

	function update(dt, t, enabled) {
		btn.style.display = enabled || cur ? 'block' : 'none';
		if (!enabled && menu.style.display !== 'none') menu.style.display = 'none';
		if (cur) {
			try { cur.update(dt, t); } catch (err) { console.error('[arcade]', curG?.id, err); stop(); return; }
			// (whatever the game has added since, balls and pins and all, onto the room's layer)
			for (const o of stage) o.traverse((q) => q.layers.enable(ROOM));
			// closed from its own × or Done
			if (!cur.active()) stop();
			return;
		}
		// a venue near you: its Play button
		scanT -= dt;
		if (scanT < 0) {
			scanT = 0.5;
			const P = getWorld()?.player.state;
			nearSite = enabled && P && !P.flying ? SITES.find((s) => Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < s.r) || null : null;
			if (nearSite) play.textContent = `${ICON[nearSite.G.id] || '🎲'} Play ${nearSite.G.title}`;
			play.style.display = nearSite ? 'block' : 'none';
		}
	}
	return { update, active: () => !!cur, start: (id) => { const G = GAMES.find((g) => g.id === id); if (G) start(G); return !!G; }, stop, games: () => GAMES.map((g) => g.id) };
}
