// Your hero as a picture, for the gear sheet and its Character view (ui/gear.js) and the loading
// screen's Character tab (ui/loading-tabs.js): the body you play (people/avatar.js), dressed in
// what you wear, drawn once in a small studio (people/hero-view.js's light: a soft sky and ground,
// a key from the front left, a fill and a rim) and kept as an image, on this device too, until
// what you wear or your hero changes. Drawn with the game's own renderer into a corner of the
// frame just before the frame itself is drawn over it: no second WebGL context, no render target.
// The studio's light is its own, so the body's materials need programs for it: built once, a
// mesh a frame (compileAsync), before the first picture. Never while the loading screen is up.

import * as THREE from 'three';
import { gearKey } from '../people/armor-looks.js';

const KEY = 'l99-hero-portrait';
// the picture's size (px) and the look: the view [turn from the body's front, distance, camera
// height, aim height] (heights as a share of the body's), field of view; low, so the hero stands
// over you; and the stance held for it (people/actions.js, at progress u): squared up, fists up
const W = 300, H = 400;
const LOOK = { view: [0.42, 3.5, 0.4, 0.55, 30], act: 'squared', u: 0, sculpt: true };
// and the build drawn for it, a hero's: the bones scaled while the picture is taken (the body and
// what it wears are skinned to them, so all of it follows), [bone, scale x, y, z] in the bone's
// own frame: the collarbones longer (the shoulders out), the arms fuller, the hips and the waist
// drawn in (the legs with them), the legs leaner. The bone just past one (one not listed) is scaled back, so it ends there
const SCULPT = [[/^clavicle\./, 1.3, 1, 1], [/^upperarm01\./, 1.16, 1, 1.16], [/^pelvis$/, 0.86, 1, 0.94], [/^spine0[0-9]$/, 0.86, 1, 0.9, 'lowest'], [/^upperleg01\./, 0.9, 1, 0.9, 'keep']];
const BG = 0x111a1f;
const store = {
	get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } },
	put(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* full, or private mode */ } },
};
// the look's version: a picture kept from an older look is drawn again
const VER = 'v2';
// the picture kept on this device (null: none yet, or of an older look), for the loading screen
// before the world is up
export const keptPortrait = () => { const v = store.get(); return v?.k?.startsWith(`${VER}|`) ? v.url : null; };

export function createHeroPortrait({ renderer, avatar, camera }) {
	let studio = null, cam = null, want = false, building = false, ready = false, kept = store.get(), missed = 0, why = '';
	const listeners = new Set();
	const keyNow = () => `${VER}|${avatar.hero}|${gearKey(avatar.worn)}`;
	function setup() {
		if (studio) return;
		studio = new THREE.Scene();
		studio.background = new THREE.Color(BG);
		studio.add(new THREE.HemisphereLight(0xf2f4f6, 0x4a4844, 0.9));
		const key = new THREE.DirectionalLight(0xfff4e6, 2.4), fill = new THREE.DirectionalLight(0xe8f0ff, 0.5), rim = new THREE.DirectionalLight(0xffe2b0, 1.6);
		studio.userData.lights = [[key, 0.7, 0.7], [fill, -1.0, 0.15], [rim, Math.PI - 0.8, 0.5]];
		for (const [l] of studio.userData.lights) studio.add(l, l.target);
		cam = new THREE.PerspectiveCamera(LOOK.view[4], W / H, 0.05, 50);
	}
	// the camera and the lights set about the body where it stands
	function aim(me) {
		const St = me.M.S, h = me.P.dna.height || 1.75, V = LOOK.view, a = St.heading + V[0], feet = St.pos;
		if (cam.fov !== V[4]) { cam.fov = V[4]; cam.updateProjectionMatrix(); }
		cam.position.set(feet.x + Math.sin(a) * V[1], feet.y + V[2] * h, feet.z + Math.cos(a) * V[1]);
		cam.lookAt(feet.x, feet.y + V[3] * h, feet.z); cam.updateMatrixWorld();
		const c = feet.clone().add(new THREE.Vector3(0, h * 0.55, 0));
		for (const [l, turn, up] of studio.userData.lights) {
			const b = St.heading + turn;
			l.position.set(c.x + Math.sin(b) * Math.cos(up) * 6, c.y + Math.sin(up) * 6, c.z + Math.cos(b) * Math.cos(up) * 6);
			l.target.position.copy(c); l.target.updateMatrixWorld(); l.updateMatrixWorld();
		}
	}
	// the body in its stance for the picture, settled: a hidden one (first person) stood up where
	// you are; a shown one where it stands. What it was doing is kept, to go back to after
	function stage(me) {
		const M = me.M, X = M.S.act, was = { hidden: !me.P.root.visible, pose: M.S.pose, act: X.name, u: X.u, auto: X.auto, speed: M.want.speed };
		if (was.hidden) { const P = camera.position; M.place(P.x, P.y - 1.6, P.z, 0); M.stand(); }
		M.want.speed = 0; M.setPose(me.P.dna.hero ? 'ready' : 'rest'); M.act(LOOK.act, LOOK.u); M.feel('anger', 1);
		const t = performance.now() / 1000;
		for (let i = 0; i < 24; i++) M.update(0.05, t + i * 0.05, camera.position);
		return was;
	}
	// the hero's build on the bones (SCULPT), and the bones as they were after: each bone's own
	// scale over its parent's, so a bone ends its part ('keep': the limb below it goes with it)
	function sculpt(me) {
		if (!LOOK.sculpt) return [];
		const B = me.P.bones || [], on = new Map(), touched = [], ONE = [1, 1, 1];
		for (const [re, x, y, z, how] of SCULPT) {
			// (the spine: only its lowest bone, the waist)
			for (const b of B) if (re.test(b.name) && !(how === 'lowest' && re.test(b.parent?.name || ''))) on.set(b, [[x, y, z], how === 'keep']);
		}
		const walk = (b, up, carry) => {
			const o = on.get(b), want = o ? o[0] : carry;
			if (want[0] !== up[0] || want[1] !== up[1] || want[2] !== up[2]) { b.scale.set(want[0] / up[0], want[1] / up[1], want[2] / up[2]); touched.push(b); }
			for (const c of b.children) if (c.isBone) walk(c, want, o ? (o[1] ? want : ONE) : carry);
		};
		for (const b of B) if (!b.parent?.isBone) walk(b, ONE, ONE);
		return touched;
	}
	const unsculpt = (touched) => { for (const b of touched) b.scale.set(1, 1, 1); };
	// and back to what it was doing (people/self.js drives it on from there next frame)
	function unstage(me, was) {
		const M = me.M;
		M.setPose(was.pose); M.want.speed = was.speed;
		if (was.act) M.act(was.act, was.auto ? undefined : was.u); else M.act(null);
	}
	// the studio's programs for this body, built off the frame a mesh at a time with a frame
	// between (a phone without parallel shader compiling links each one as it is asked for, so
	// asking for them all at once would stall a frame); the picture is taken on a later frame
	async function build(me) {
		building = true;
		setup(); aim(me);
		const meshes = [], frame = () => new Promise((r) => requestAnimationFrame(r));
		me.P.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) meshes.push(o); });
		try {
			for (const m of meshes) {
				if (renderer.compileAsync) await renderer.compileAsync(m, cam, studio);
				await frame();
			}
		} catch (e) { console.warn('[hero portrait]', e); } finally { ready = true; building = false; }
	}
	function take(me) {
		const el = renderer.domElement, pr = renderer.getPixelRatio();
		const size = new THREE.Vector2(); renderer.getSize(size);
		const h = Math.min(size.y, H), w = Math.round(h * W / H);
		if (w > size.x || h < 60) { why = `frame ${size.x}x${size.y}`; return null; }
		const was = stage(me), root = me.P.root, parent = root.parent;
		aim(me);
		let touched = [];
		const exposure = renderer.toneMappingExposure, shadows = renderer.shadowMap.needsUpdate;
		let url = null;
		try {
			studio.add(root); root.visible = true;
			touched = sculpt(me);
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
			unsculpt(touched);
			root.visible = !was.hidden;
			unstage(me, was);
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
		// another look to try (for tuning, Crysis.portrait): { view, act, u }, drawn again
		look(o) { Object.assign(LOOK, o); want = true; },
		on(f) { listeners.add(f); return () => listeners.delete(f); },
		info: () => ({ want, building, ready, why, key: keyNow(), kept: kept?.k || null, bytes: kept?.url?.length || 0, look: { ...LOOK } }),
	};
}
