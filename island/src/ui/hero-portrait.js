// Your hero as a picture, for the gear sheet and its Character view (ui/gear.js) and the loading
// screen's Character tab (ui/loading-tabs.js): the body you play (people/avatar.js), dressed in
// what you wear, drawn once in a small studio (people/hero-view.js's light: a soft sky and ground,
// a key from the front left, a fill and a rim) and kept as an image, on this device too, until
// what you wear or your hero changes. Drawn with the game's own renderer into a corner of the
// frame just before the frame itself is drawn over it: no second WebGL context, no render target.
// The studio's light is its own, so the body's materials need programs for it: built once, off
// the frame (compileAsync), before the first picture. Never while the loading screen is up.

import * as THREE from 'three';
import { gearKey } from '../people/armor-looks.js';

const KEY = 'l99-hero-portrait';
// the picture's size (px) and the view: [turn from the body's front, distance, camera height,
// aim height] (heights as a share of the body's), field of view
const W = 300, H = 400, VIEW = [0.5, 3.6, 0.66, 0.5, 32];
const BG = 0x111a1f;
const store = {
	get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
	put(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* full, or private mode */ } },
};
// the picture kept on this device (null: none yet), for the loading screen before the world is up
export const keptPortrait = () => store.get()?.url || null;

export function createHeroPortrait({ renderer, avatar, camera }) {
	let studio = null, cam = null, want = false, building = false, ready = false, kept = store.get(), missed = 0, why = '';
	const listeners = new Set();
	const keyNow = () => `${avatar.hero}|${gearKey(avatar.worn)}`;
	function setup() {
		if (studio) return;
		studio = new THREE.Scene();
		studio.background = new THREE.Color(BG);
		studio.add(new THREE.HemisphereLight(0xf2f4f6, 0x4a4844, 0.9));
		const key = new THREE.DirectionalLight(0xfff4e6, 2.4), fill = new THREE.DirectionalLight(0xe8f0ff, 0.5), rim = new THREE.DirectionalLight(0xffe2b0, 1.6);
		studio.userData.lights = [[key, 0.7, 0.7], [fill, -1.0, 0.15], [rim, Math.PI - 0.8, 0.5]];
		for (const [l] of studio.userData.lights) studio.add(l, l.target);
		cam = new THREE.PerspectiveCamera(VIEW[4], W / H, 0.05, 50);
	}
	// the camera and the lights set about the body where it stands
	function aim(me) {
		const St = me.M.S, h = me.P.dna.height || 1.75, a = St.heading + VIEW[0], feet = St.pos;
		cam.position.set(feet.x + Math.sin(a) * VIEW[1], feet.y + VIEW[2] * h, feet.z + Math.cos(a) * VIEW[1]);
		cam.lookAt(feet.x, feet.y + VIEW[3] * h, feet.z); cam.updateMatrixWorld();
		const c = feet.clone().add(new THREE.Vector3(0, h * 0.55, 0));
		for (const [l, turn, up] of studio.userData.lights) {
			const b = St.heading + turn;
			l.position.set(c.x + Math.sin(b) * Math.cos(up) * 6, c.y + Math.sin(up) * 6, c.z + Math.cos(b) * Math.cos(up) * 6);
			l.target.position.copy(c); l.target.updateMatrixWorld(); l.updateMatrixWorld();
		}
	}
	// a hidden body (first person) stood up where you are, in its ready stance, settled
	function stage(me) {
		if (me.P.root.visible) return null;
		const P = camera.position;
		me.M.place(P.x, P.y - 1.6, P.z, 0); me.M.stand(); me.M.setPose(me.P.dna.hero ? 'ready' : 'rest'); me.M.act(null);
		const t = performance.now() / 1000;
		for (let i = 0; i < 24; i++) me.M.update(0.05, t + i * 0.05, camera.position);
		return true;
	}
	// the studio's programs for this body, built off the frame; then the picture is taken
	async function build(me) {
		building = true;
		setup(); aim(me);
		const root = me.P.root, was = root.visible;
		try {
			root.visible = true;
			const job = renderer.compileAsync ? renderer.compileAsync(root, cam, studio) : null;
			root.visible = was;
			await job;
			ready = true;
		} catch (e) { console.warn('[hero portrait]', e); ready = true; } finally { root.visible = was; building = false; }
	}
	function take(me) {
		const el = renderer.domElement, pr = renderer.getPixelRatio();
		const size = new THREE.Vector2(); renderer.getSize(size);
		const h = Math.min(size.y, H), w = Math.round(h * W / H);
		if (w > size.x || h < 60) { why = `frame ${size.x}x${size.y}`; return null; }
		const hidden = stage(me), root = me.P.root, parent = root.parent, wasVisible = root.visible;
		aim(me);
		const exposure = renderer.toneMappingExposure, shadows = renderer.shadowMap.needsUpdate;
		let url = null;
		try {
			studio.add(root); root.visible = true;
			renderer.toneMappingExposure = 1;
			renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setScissorTest(true);
			renderer.render(studio, cam);
			// (the corner just drawn, copied out before the frame is drawn over it)
			const c2 = document.createElement('canvas'); c2.width = W; c2.height = H;
			c2.getContext('2d').drawImage(el, 0, el.height - Math.round(h * pr), Math.round(w * pr), Math.round(h * pr), 0, 0, W, H);
			url = c2.toDataURL('image/jpeg', 0.86);
		} finally {
			renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y); renderer.setScissor(0, 0, size.x, size.y);
			renderer.toneMappingExposure = exposure; renderer.shadowMap.needsUpdate = shadows;
			if (parent) parent.add(root); else studio.remove(root);
			root.visible = hidden ? false : wasVisible;
		}
		return url;
	}
	// each frame, just before the world is drawn over the whole frame (island-frame.js; never on a
	// frame that is not drawn, or the corner would show): a picture when one is wanted
	function tick() {
		if (!want || building || window.L99Loading?.active?.()) return;
		const me = avatar.me;
		if (!me) { avatar.ready?.().catch(() => {}); return; }
		if (!ready) { build(me); return; }
		const k = keyNow();
		let url = null;
		try { url = take(me); } catch (e) { why = String(e?.message || e); console.warn('[hero portrait]', e); }
		// (none this time: tried again on a later frame, a few times)
		if (!url) { if (++missed >= 5) want = false; return; }
		want = false; missed = 0; why = '';
		kept = { k, url, at: Date.now() };
		if (url.length < 200000) store.put(kept);
		for (const f of listeners) f(url);
	}
	return {
		tick,
		// the picture now (perhaps of what you wore before: then a new one is on its way)
		url: () => kept?.url || null,
		// asked for when shown: drawn again only when what you wear or your hero changed
		want() { if (kept?.k !== keyNow() || !kept?.url) want = true; return kept?.url || null; },
		redraw() { want = true; },
		on(f) { listeners.add(f); return () => listeners.delete(f); },
		info: () => ({ want, building, ready, why, key: keyNow(), kept: kept?.k || null, bytes: kept?.url?.length || 0 }),
	};
}
