// A small light box for gear (crysis/held-items.js): thumbnails of each item at its tier for the
// gear screen's slots, and the turning model in an item's detail view. One little renderer of
// its own, made when first needed, lit by a soft room so the metals read. Without WebGL the
// slots keep their emoji icons.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { itemModel, spinMotes, disposeItemModel } from '../crysis/held-items.js';
import { armorPickupModel } from '../combat/armor-pickup.js';

const modelFor = (id, level, tier) => armorPickupModel(id) || itemModel(id, { level, tier, lod: 'high', plain: true });
function freeModel(m) {
	disposeItemModel(m);
	if(m?.userData.ownedArmor){const gs=new Set(),ms=new Set();m.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});for(const g of gs)g.dispose();for(const mat of ms)mat.dispose();}
	m?.removeFromParent();
}

export function createStudio() {
	let R = null, scene = null, camera = null, failed = false, spinning = null;
	const calm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
	const thumbs = new Map();
	function ready() {
		if (R || failed) return !!R;
		try {
			R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
			R.setPixelRatio(1);
			R.outputColorSpace = THREE.SRGBColorSpace;
			R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.1;
			scene = new THREE.Scene();
			const pm = new THREE.PMREMGenerator(R);
			scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
			pm.dispose();
			const key = new THREE.DirectionalLight(0xfff2e0, 1.6); key.position.set(1, 2, 2);
			const rim = new THREE.DirectionalLight(0x9fd8ff, 0.8); rim.position.set(-2, 1, -1);
			scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));
			camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
		} catch { failed = true; R = null; }
		return !!R;
	}
	// the camera framing a model, looking a little down, turned by `turn`
	function frame(model, turn) {
		const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
		const d = Math.max(s.x, s.y, s.z) * 2.1 + 0.05;
		camera.position.set(c.x + Math.sin(turn) * d, c.y + d * 0.25, c.z + Math.cos(turn) * d);
		camera.lookAt(c);
	}
	function show(id, level, tier, size, turn) {
		const m = modelFor(id, level, tier);
		if (!m) return null;
		m.scale.setScalar(1);
		// (long items lie across the picture)
		if (m.userData.long) m.rotation.z = -Math.PI / 4;
		scene.add(m);
		R.setSize(size, size, false);
		frame(m, turn);
		try { R.render(scene, camera); } catch(e) { freeModel(m);throw e; }
		return m;
	}
	// a data URL picture of an item at its tier (level bands share one), or '' without WebGL
	function thumb(id, level = 1, tier = 0) {
		const band = level >= 7 ? 7 : level >= 4 ? 4 : 1, k = `${id}:${band}:${tier}`;
		if (thumbs.has(k)) return thumbs.get(k);
		if (!ready()) return '';
		const was = spinning;
		let url = '';
		let m=null;
		try { if(was)was.m.visible=false;m = show(id, band, tier, 96, 0.7); url = m ? R.domElement.toDataURL('image/png') : ''; } catch { url = ''; }
		finally { freeModel(m);if(was)was.m.visible=true; }
		thumbs.set(k, url);
		if (was) R.setSize(was.size, was.size, false);
		return url;
	}
	// the item turning slowly in `box` (a DOM element), until stop()
	function turntable(box, id, level = 1, tier = 0, size = 200) {
		stop();
		if (!ready()) return () => {};
		const m = modelFor(id, level, tier);
		if (!m) return () => {};
		if (m.userData.long) m.rotation.z = -Math.PI / 5;
		scene.add(m);
		R.setSize(size, size, false);
		const cv = R.domElement;
		cv.style.cssText = `width:${size}px;height:${size}px;display:block;margin:0 auto;touch-action:pan-y;`;
		box.appendChild(cv);
		const S = spinning = { m, size, raf: 0, drag: 0, turn: 0.6, t0: performance.now() };
		// a drag turns it by hand
		let lastX = null;
		cv.onpointerdown = (e) => { lastX = e.clientX; S.drag = 2; };
		cv.onpointermove = (e) => { if (lastX == null) return; S.turn += (e.clientX - lastX) * 0.02; lastX = e.clientX; S.drag = 2; };
		cv.onpointerup = cv.onpointercancel = () => { lastX = null; };
		let last = performance.now();
		const loop = (now) => {
			if (spinning !== S) return;
			const dt = Math.min(0.1, (now - last) / 1000); last = now;
			if (S.drag > 0) S.drag -= dt; else if(!calm?.matches) S.turn += dt * 0.6;
			spinMotes(m,(now-S.t0)/1000);
			frame(m, S.turn);
			R.render(scene, camera);
			S.raf = requestAnimationFrame(loop);
		};
		S.raf = requestAnimationFrame(loop);
		return stop;
	}
	function stop() {
		const S = spinning;
		if (!S) return;
		spinning = null;
		cancelAnimationFrame(S.raf);
		freeModel(S.m);
		R?.domElement.remove();
	}
	return { thumb, turntable, stop, ok: () => ready() };
}
