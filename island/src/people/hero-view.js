// A look at your hero (people/hero.js) inside the game itself: the same renderer, scene, sky
// and light, so what is judged here is what is played. Opened with ?heroview in the address,
// or Crysis.heroView.open(); for development, not players. It frames the body from set views
// (front, three-quarter, both profiles, back, the face, the hands), turns it, shows it in a
// flat grey (the silhouette alone) or as its wireframe, under the day's light presets, in a
// pose or an action held at any point (scrubbed), and counts what it costs (triangles,
// meshes, materials, draw calls, the time it took to make). shot() renders one view to an
// image from its own camera, the same framing every time, for before-and-after comparisons:
// in the world, or in the studio (the body alone on mid grey, under soft even light with some
// from the side to show its form, at a fixed exposure, whatever the hour in the world), in
// perspective for how it looks or orthographic for its proportions, with the hair off to see
// the head itself.

import * as THREE from 'three';
import { POSES } from './motion.js';
import { ACTIONS } from './actions.js';

// a view: [turn about the body (0 its front), distance, camera height, aim height] (heights as
// a share of the body's), field of view
export const VIEWS = {
	front: [0, 3.9, 0.72, 0.53, 30], front34: [0.62, 3.9, 0.72, 0.53, 30], left: [Math.PI / 2, 3.9, 0.72, 0.53, 30],
	back: [Math.PI, 3.9, 0.72, 0.53, 30], back34: [Math.PI - 0.62, 3.9, 0.72, 0.53, 30], right: [-Math.PI / 2, 3.9, 0.72, 0.53, 30],
	face: [0.32, 0.78, 0.935, 0.925, 28], profile: [Math.PI / 2, 0.82, 0.935, 0.925, 28], hands: [-0.9, 0.62, 0.6, 0.5, 34],
	head: [0, 0.82, 0.935, 0.93, 26], headL: [Math.PI / 2, 0.82, 0.935, 0.93, 26], headR: [-Math.PI / 2, 0.82, 0.935, 0.93, 26],
	boots: [0.55, 1.15, 0.2, 0.05, 30], bootsL: [Math.PI / 2, 1.15, 0.12, 0.05, 30],
	// (the clothes' making: the chest and its kit, the thighs and knees)
	torso: [0.35, 1.05, 0.74, 0.71, 30], legs: [0.5, 1.6, 0.42, 0.38, 30],
};
// the views drawn orthographic (proportions), and how much of the body each takes in (m)
const ORTHO_SPAN = 2.16;
export const LIGHTS = { day: 11, golden: 18, shade: 7.2, night: 22.5 };

export function createHeroView({ scene, renderer, avatar, self, world, setCine }) {
	const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 2000);
	const grey = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.82, metalness: 0 });
	const saved = new Map();
	const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 50);
	let studio = null, key = null, fill = null, rim = null;
	const S = { open: false, view: 'front34', turn: 0, spin: false, grey: false, wire: false, bald: false, ortho: false, still: null, pose: 'ready', action: null, u: 0.5, paused: true };
	let panel = null, statsEl = null;
	const body = () => avatar.me;

	// the camera on a view of the body as it stands now (feet, heading, height)
	function frame(c, view = S.view, turn = S.turn, aspect = 1) {
		const me = body(); if (!me) return false;
		const V = VIEWS[view] || VIEWS.front, St = me.M.S, h = me.P.dna.height || 1.75, a = St.heading + V[0] + turn;
		const feet = St.pos;
		c.fov = V[4]; c.aspect = aspect; c.updateProjectionMatrix();
		let cx = feet.x + Math.sin(a) * V[1], cz = feet.z + Math.cos(a) * V[1], ay = feet.y + V[3] * h, tx = feet.x, tz = feet.z;
		// (the hands: the right one's wrist)
		// (the hands: the right one, a little out from the side and in front, the whole hand in view)
		if (view === 'hands') { const w = me.P.bones[me.P.map['wrist.R']]?.getWorldPosition(new THREE.Vector3()); if (w) { tx = w.x; tz = w.z; ay = w.y - 0.07; cx = w.x + Math.sin(a) * V[1]; cz = w.z + Math.cos(a) * V[1]; c.position.set(cx, w.y + 0.08, cz); c.lookAt(tx, ay, tz); c.updateMatrixWorld(); return true; } }
		c.position.set(cx, feet.y + V[2] * h, cz);
		c.lookAt(tx, ay, tz);
		c.updateMatrixWorld();
		return true;
	}
	// the flat grey (and its wireframe) over every part of the body, or its own materials back.
	// Each part its own grey, carrying its own material's data: the body reads uniforms off
	// some of them every frame (the hair's capsules, people/hair-collide.js)
	function setLook(g = S.grey, wire = S.wire) {
		const me = body(); if (!me) return;
		me.P.root.traverse((o) => {
			if (!o.isMesh) return;
			if (g || wire) {
				if (!saved.has(o)) { saved.set(o, o.material); const m = grey.clone(); m.userData = o.material.userData; o.material = m; }
				o.material.wireframe = !!wire;
			} else if (saved.has(o)) { o.material.dispose(); o.material = saved.get(o); }
		});
		if (!g && !wire) saved.clear();
	}
	// a way of standing (people/motion.js POSES) or an action held at u (people/actions.js)
	function pose(name = S.pose, action = S.action, u = S.u) {
		const me = body(); if (!me) return;
		S.pose = POSES[name] ? name : 'ready'; S.action = ACTIONS[action] ? action : null; S.u = u;
		if (self?.state) self.state.posePin = S.pose;
		me.M.setPose(S.pose);
		if (S.action) me.M.act(S.action, S.paused ? S.u : undefined); else me.M.act(null);
	}
	function stats() {
		const me = body(); if (!me) return null;
		let tris = 0, meshes = 0, bytes = 0;
		const mats = new Set(), geos = new Set();
		me.P.root.traverse((o) => {
			if (!o.isMesh || !o.visible) return;
			meshes++;
			const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count;
			tris += (n / 3) * (o.isInstancedMesh ? o.count : 1);
			(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
			// (the geometry's own memory, decoded: shared pieces counted once)
			if (!geos.has(g)) { geos.add(g); for (const a of Object.values(g.attributes)) bytes += a.array.byteLength; if (g.index) bytes += g.index.array.byteLength; }
		});
		return { hero: avatar.hero, tris: Math.round(tris), meshes, materials: mats.size, bones: me.P.bones.length, geoKB: Math.round(bytes / 1024), buildMs: Math.round(me.P.buildMs || 0), calls: renderer.info.render.calls, height: +(me.P.dna.height || 0).toFixed(2) };
	}
	// the same view drawn orthographic: the whole body, nothing nearer drawn bigger
	function frameOrtho(view, aspect) {
		const me = body(); if (!me) return null;
		const V = VIEWS[view] || VIEWS.front, St = me.M.S, h = me.P.dna.height || 1.75, a = St.heading + V[0];
		const half = ORTHO_SPAN / 2, my = St.pos.y + h * 0.5;
		ortho.left = -half * aspect; ortho.right = half * aspect; ortho.top = half; ortho.bottom = -half; ortho.updateProjectionMatrix();
		ortho.position.set(St.pos.x + Math.sin(a) * 8, my, St.pos.z + Math.cos(a) * 8);
		ortho.lookAt(St.pos.x, my, St.pos.z);
		ortho.updateMatrixWorld();
		return ortho;
	}
	// the studio: mid grey all round, a soft sky and ground, a key light high from the front left,
	// a low fill from the right, a rim from behind; set about the body each time
	function inStudio(draw) {
		const me = body();
		if (!studio) {
			studio = new THREE.Scene();
			studio.background = new THREE.Color(0x7a7a7a);
			studio.add(new THREE.HemisphereLight(0xf2f4f6, 0x5c5a58, 0.9));
			key = new THREE.DirectionalLight(0xfffaf2, 2.4); fill = new THREE.DirectionalLight(0xf0f4ff, 0.55); rim = new THREE.DirectionalLight(0xffffff, 1.3);
			for (const l of [key, fill, rim]) studio.add(l, l.target);
		}
		const St = me.M.S, c = St.pos.clone().add(new THREE.Vector3(0, (me.P.dna.height || 1.75) * 0.55, 0));
		const at = (l, turn, up) => { const a = St.heading + turn; l.position.set(c.x + Math.sin(a) * Math.cos(up) * 6, c.y + Math.sin(up) * 6, c.z + Math.cos(a) * Math.cos(up) * 6); l.target.position.copy(c); l.target.updateMatrixWorld(); };
		at(key, 0.7, 0.7); at(fill, -1.0, 0.15); at(rim, Math.PI - 0.8, 0.5);
		const parent = me.P.root.parent, exposure = renderer.toneMappingExposure;
		studio.add(me.P.root);
		renderer.toneMappingExposure = 1;
		try { return draw(studio); } finally { renderer.toneMappingExposure = exposure; if (parent) parent.add(me.P.root); }
	}
	// one view rendered to an image (the same framing every time). o: { view, turn, grey, wire,
	// studio: on grey under the studio's light, ortho: orthographic, bald: the hair off }
	function shot(o = {}) {
		const me = body(); if (!me) return null;
		const looked = o.grey !== undefined || o.wire !== undefined;
		if (looked) setLook(o.grey ?? S.grey, o.wire ?? S.wire);
		const hid = o.bald ? [me.P.hair, me.P.beard].filter((m) => m && m.visible) : [];
		for (const m of hid) m.visible = false;
		const el = renderer.domElement, aspect = el.width / el.height;
		const c = o.ortho ? frameOrtho(o.view || S.view, aspect) : frame(cam, o.view || S.view, o.turn ?? 0, aspect) ? cam : null;
		let url = null;
		if (c) {
			const draw = (sc) => { renderer.render(sc, c); return el.toDataURL('image/jpeg', 0.9); };
			url = o.studio ? inStudio(draw) : draw(scene);
		}
		for (const m of hid) m.visible = true;
		if (looked) setLook(S.grey, S.wire);
		return url;
	}

	// ---------- the panel ----------
	const BTN = 'min-height:32px;padding:0 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:12px var(--bard-body,system-ui,sans-serif);cursor:pointer;';
	function button(row, label, on, fn) {
		const b = document.createElement('button');
		b.style.cssText = BTN + (on ? 'background:#01a982;border-color:#01a982;' : '');
		b.textContent = label; b.setAttribute('aria-pressed', String(!!on));
		b.onclick = (e) => { e.stopPropagation(); fn(); draw(); };
		row.appendChild(b);
	}
	function row(label) {
		const r = document.createElement('div');
		r.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:4px 0;';
		if (label) { const s = document.createElement('span'); s.textContent = label; s.style.cssText = 'width:54px;opacity:.75;'; r.appendChild(s); }
		panel.appendChild(r);
		return r;
	}
	function draw() {
		if (!panel) return;
		panel.replaceChildren();
		const t = document.createElement('div'); t.textContent = 'HERO VIEW'; t.style.cssText = 'font-weight:700;letter-spacing:.06em;margin-bottom:4px;';
		panel.appendChild(t);
		let r = row('Hero');
		for (const h of ['male', 'female']) button(r, h, avatar.hero === h, () => { avatar.setHero(h).then(() => { setLook(); pose(); draw(); }); });
		r = row('View');
		for (const v of Object.keys(VIEWS)) button(r, v, S.view === v, () => { S.view = v; S.turn = 0; });
		r = row('Turn');
		button(r, '⟲', false, () => { S.turn -= Math.PI / 8; });
		button(r, S.spin ? 'Stop' : 'Spin', S.spin, () => { S.spin = !S.spin; });
		button(r, '⟳', false, () => { S.turn += Math.PI / 8; });
		r = row('Look');
		button(r, 'Grey', S.grey, () => { S.grey = !S.grey; setLook(); });
		button(r, 'Wire', S.wire, () => { S.wire = !S.wire; setLook(); });
		button(r, 'Bald', S.bald, () => { S.bald = !S.bald; });
		button(r, 'Ortho', S.ortho, () => { S.ortho = !S.ortho; });
		// (the studio: the body alone on grey, shown here as a still)
		button(r, 'Studio still', false, () => { S.still = shot({ view: S.view, turn: S.turn, studio: true, ortho: S.ortho, bald: S.bald }); });
		r = row('Light');
		for (const [k, h] of Object.entries(LIGHTS)) button(r, k, false, () => { const sky = world()?.sky; if (sky?.state) sky.state.hours = h; });
		r = row('Pose');
		for (const p of ['rest', 'ready', 'hip', 'crossed']) button(r, p, S.pose === p && !S.action, () => pose(p, null));
		r = row('Action');
		for (const a of ['sprint', 'leap', 'scout', 'stance', 'climb', 'guard', 'stride']) button(r, a, S.action === a, () => pose(S.pose, a, S.u));
		button(r, S.paused ? 'Play' : 'Pause', !S.paused, () => { S.paused = !S.paused; pose(); });
		const sc = document.createElement('input'); sc.type = 'range'; sc.min = '0'; sc.max = '1'; sc.step = '0.01'; sc.value = String(S.u); sc.setAttribute('aria-label', 'Scrub the action');
		sc.style.cssText = 'width:100%;min-height:32px;';
		sc.oninput = () => { S.u = +sc.value; S.paused = true; pose(); };
		panel.appendChild(sc);
		if (S.still) { const im = document.createElement('img'); im.src = S.still; im.alt = 'The hero in the studio'; im.style.cssText = 'width:100%;border-radius:8px;margin-top:4px;'; panel.appendChild(im); }
		statsEl = document.createElement('pre'); statsEl.style.cssText = 'margin:4px 0 0;font:11px ui-monospace,monospace;opacity:.85;white-space:pre-wrap;';
		panel.appendChild(statsEl);
		r = row();
		button(r, 'Close', false, close);
	}
	function open() {
		if (S.open) return true;
		S.open = true;
		if (self && !self.state.third) self.toggle();
		avatar.ready().then(() => { setLook(); pose(); });
		panel = document.createElement('div');
		panel.style.cssText = 'position:fixed;left:8px;top:8px;z-index:60;width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 16px);overflow:auto;padding:10px;border-radius:12px;background:rgba(10,16,20,.82);color:#eafaf6;font:12px var(--bard-body,system-ui,sans-serif);';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation());
		document.body.appendChild(panel);
		draw();
		// (the game's camera framed on the body while open: main.js's director hook)
		setCine((c, dt) => { if (S.spin) S.turn += dt * 0.5; if (!frame(c, S.view, S.turn, c.aspect)) return; if (statsEl) { const s = stats(); statsEl.textContent = s ? Object.entries(s).map(([k, v]) => `${k}: ${v}`).join('  ') : ''; } });
		return true;
	}
	function close() {
		S.open = false; S.grey = S.wire = false; setLook(false, false);
		if (self?.state) self.state.posePin = null;
		body()?.M.act(null);
		setCine(null);
		panel?.remove(); panel = null;
	}
	// (a variant of the hero tried: its hair or face changed, the body made again; null: as made)
	async function variant(look = null) { await avatar.setHero(avatar.hero, look); await avatar.ready(); setLook(); pose(); return !!body(); }
	return { open, close, shot, stats, pose, setLook, frame, variant, state: S, views: VIEWS, lights: LIGHTS };
}
