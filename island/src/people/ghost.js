// The child in the woods. Very rarely (about one chance in a hundred for each minute you
// spend in the forest after dark) a small girl in a pale nightdress is standing among the
// trees, alone, watching you. She is one of the real bodies (body.js), made of cold light:
// translucent, a faint blue glow at her edges that gutters like a candle. She does not move
// while you look at her. Look away and she comes closer. Near enough to touch, she is gone.
// While she is near the woods fall silent, the colour drains out of the night, the edges
// of the screen close in, and a low drone and a music box that is slightly out of tune
// come up out of nowhere.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from './body.js';
import { createMotion } from './motion.js';
import { noise } from '../world/soundbus.js';

const CHANCE = 0.01, EVERY = 60, COOLDOWN = 20 * 60;

export function createGhost(scene, { world, mount, canvas, hush }) {
	let A = null, G = null, state = null, roll = EVERY * Math.random(), cool = 0;
	const ground = (x, z) => world().island.heightAt(x, z);

	// ---------- the look of her ----------
	const rimU = { value: 0 }, fadeU = { value: 0 };
	function ghostMat(base, glow) {
		const m = new THREE.MeshStandardMaterial({ color: base, emissive: glow, emissiveIntensity: 1.1, roughness: 1, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 1 });
		m.onBeforeCompile = (sh) => {
			sh.uniforms.uRim = rimU; sh.uniforms.uFade = fadeU;
			sh.fragmentShader = 'uniform float uRim;\nuniform float uFade;\n' + sh.fragmentShader
				.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\tfloat rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);\n\ttotalEmissiveRadiance += vec3(0.6, 0.78, 1.0) * rim * uRim * 1.8;')
				.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.a *= uFade * (0.45 + rim * 0.5);');
		};
		m.customProgramCacheKey = () => 'ghost-child';
		return m;
	}
	async function make() {
		if (G) return G;
		A = A || await loadPeopleAssets();
		const d = personDNA(0x6e057, { age: 7 });
		d.sex = 0.1; d.male = false; d.hair = 'ponytail01'; d.hairColour = [0.05, 0.04, 0.035];
		d.outfit = { top: [0.9, 0.9, 0.88], bottom: [0.9, 0.9, 0.88], shoes: [0.85, 0.85, 0.85], sleeves: 'long', jacket: null, legs: 'skirt', fabricTop: 'knit' };
		d.gait = { stride: 0.8, bounce: 0.2, armSwing: 0.15, posture: 0.06, pace: 0.7 };
		const P = buildPerson(A, d);
		const skin = ghostMat(new THREE.Color('#c8d2da'), new THREE.Color('#6f8aa6')), cloth = ghostMat(new THREE.Color('#e4e8ea'), new THREE.Color('#8aa2b8'));
		P.root.traverse((o) => {
			if (!o.material) return;
			o.material = o === P.skin ? skin : cloth;
			o.castShadow = false; o.receiveShadow = false; o.renderOrder = 5;
		});
		// (no lashes or brows on a ghost)
		if (P.detail) { P.detail.removeFromParent(); P.detail.geometry.dispose(); P.detail = null; }
		// the eyes: two dark hollows with a pinprick of light
		for (const e of P.eyes || []) e.material = new THREE.MeshBasicMaterial({ color: '#0a0d10', transparent: true, opacity: 0.9 });
		const M = createMotion(P, ground);
		P.root.visible = false;
		scene.add(P.root);
		G = { P, M };
		return G;
	}

	// ---------- the screen ----------
	const veil = document.createElement('div');
	veil.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:multiply;background:radial-gradient(ellipse at 50% 50%, rgba(255,255,255,1) 30%, rgba(90,100,110,1) 72%, rgba(0,0,0,1) 100%)';
	const grain = document.createElement('canvas');
	grain.width = 320; grain.height = 200;
	grain.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;mix-blend-mode:overlay';
	// just over the picture, under the buttons and notes
	(canvas.parentNode || mount).insertBefore(grain, canvas.nextSibling);
	(canvas.parentNode || mount).insertBefore(veil, canvas.nextSibling);
	const gctx = grain.getContext('2d'), gimg = gctx.createImageData(320, 200);
	let grainT = 0;
	function drawGrain() {
		const px = gimg.data;
		for (let i = 0; i < px.length; i += 4) { const v = Math.random() * 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
		gctx.putImageData(gimg, 0, 0);
	}
	function screen(k, t) {
		const breathe = 0.85 + 0.15 * Math.sin(t * 1.3);
		veil.style.opacity = (k * breathe).toFixed(3);
		grain.style.opacity = (k * 0.22).toFixed(3);
		canvas.style.filter = k > 0.01 ? `saturate(${(1 - k * 0.85).toFixed(3)}) contrast(${(1 + k * 0.25).toFixed(3)}) brightness(${(1 - k * 0.2).toFixed(3)}) hue-rotate(${(-k * 12).toFixed(1)}deg)` : '';
	}

	// ---------- the sound ----------
	let ctx = null, S = null;
	function sound() {
		const bus = window._masterClip || window.leadBus227, c = bus && bus.context;
		if (!c || c.state !== 'running') return null;
		if (ctx === c && S) return S;
		ctx = c;
		const out = ctx.createGain(); out.gain.value = 0; out.connect(bus);
		const drone = ctx.createGain(); drone.gain.value = 0.05; drone.connect(out);
		S = { out, drone, osc: null };
		return S;
	}
	// the drone runs only while she is about (four oscillators left running all evening,
	// silent, would cost for nothing); stopped once it has faded out
	function droneOn() {
		if (S.osc) return;
		S.osc = [55, 55.6, 82.4, 110.9].map((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(S.drone); o.start(); return o; });
	}
	// the music box: a child's tune, a little flat, slowing down
	const TUNE = [0, 4, 7, 12, 11, 7, 4, 5, 2, -1, 0];
	let note = 0, noteT = 0;
	function musicBox(level) {
		const t = ctx.currentTime, f = 523.25 * Math.pow(2, (TUNE[note % TUNE.length] - 0.3) / 12);
		for (const [mul, lv] of [[1, 1], [2.01, 0.3], [3.98, 0.12]]) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.value = f * mul; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(level * lv, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
			o.connect(g).connect(S.out); o.start(t); o.stop(t + 1.7);
		}
		note++;
	}
	function breath(level) {
		// a sharp intake of breath, close by: filtered noise swelling and gone in a moment
		const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
		s.buffer = noise(ctx, 'white'); f.type = 'bandpass'; f.frequency.setValueAtTime(1100, t); f.frequency.linearRampToValueAtTime(1700, t + 0.6); f.Q.value = 0.8;
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.4); g.gain.linearRampToValueAtTime(0, t + 0.8);
		s.connect(f).connect(g).connect(S.out); s.start(t, Math.random() * 3); s.stop(t + 0.85);
	}

	// ---------- when and where ----------
	function woods(cam, night) {
		const W = world();
		if (night < 0.7 || !W?.bayArea?.loaded() || !W.city?.treesNear) return false;
		if (cam.y - ground(cam.x, cam.z) > 6 || W.player?.state?.flying) return false;
		const U = W.bayArea.urbanAt(cam.x, cam.z);
		if (U && U.u > 0.15) return false;
		return W.city.treesNear(cam.x, cam.z, 35).filter((t) => !t.shrub && !t.fern).length >= 8;
	}
	async function appear(cam, yaw, at = null) {
		const g = await make();
		// ahead, off to one side, far enough to be unsure what you are seeing
		const a = at ? yaw + 0.08 : yaw + (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.5), d = at || 26 + Math.random() * 10;
		const x = cam.x - Math.sin(a) * d, z = cam.z - Math.cos(a) * d;
		g.M.place(x, ground(x, z), z, Math.atan2(cam.x - x, cam.z - z));
		g.M.setPose('rest');
		if (!g.P.root.parent) scene.add(g.P.root);
		g.P.root.visible = true;
		// (called up on purpose, Crysis.ghost(metres), she is there at once and waits)
		state = { t: 0, phase: 'watch', watch: at ? 1e9 : 4 + Math.random() * 4, fade: at ? 1 : 0, gone: 0, flick: 0, called: !!at };
		note = 0; noteT = 1.5;
		return `at ${x.toFixed(1)},${z.toFixed(1)} ${d.toFixed(0)} m, ground ${ground(x, z).toFixed(1)}`;
	}
	function vanish() { if (state) { state.phase = 'gone'; state.gone = 0; } }
	function end() {
		if (G) G.P.root.visible = false;
		state = null; cool = COOLDOWN; fadeU.value = 0;
		screen(0, 0); hush?.(0);
		if (S) {
			S.out.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
			if (S.osc) { for (const o of S.osc) o.stop(ctx.currentTime + 5); S.osc = null; }
		}
	}

	// camera: the camera (which way you face is which way it looks); night 0..1
	const fwd = new THREE.Vector3();
	function update(dt, t, camera, night) {
		const cam = camera.position;
		camera.getWorldDirection(fwd);
		const yaw = Math.atan2(-fwd.x, -fwd.z);
		if (!state) {
			cool = Math.max(0, cool - dt);
			if (cool > 0) return;
			roll -= dt;
			if (roll > 0) return;
			roll = EVERY;
			if (woods(cam, night) && Math.random() < CHANCE) appear(cam, yaw);
			return;
		}
		const g = G, M = g.M, Sp = M.S.pos;
		state.t += dt;
		const dx = cam.x - Sp.x, dz = cam.z - Sp.z, d = Math.hypot(dx, dz);
		// are you looking at her?
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw), seen = (-dx * fx - dz * fz) / (d || 1) > Math.cos(0.5);
		M.S.look.target = new THREE.Vector3(cam.x, cam.y, cam.z);
		M.want.heading = Math.atan2(dx, dz);
		if (state.phase === 'watch') {
			M.want.speed = 0;
			if (state.t > state.watch) state.phase = 'come';
		} else if (state.phase === 'come') {
			// still while you watch; closer each time you look away
			M.want.speed = seen ? 0 : 1.2;
			if (d < 3.2) { vanish(); if (S) breath(0.12); }
		}
		if (state.phase === 'gone') {
			state.gone += dt;
			M.want.speed = 0;
			if (state.gone > 0.6) { end(); return; }
		}
		// too long, or you left: she is simply not there any more
		if (state.phase !== 'gone' && (state.t > 90 || d > 70 || (night < 0.5 && !state.called) || world().player?.state?.flying)) vanish();
		M.update(dt, t, cam);
		// the light of her: fading in, guttering, gone in a flicker
		state.fade = Math.min(1, state.fade + dt / 3);
		state.flick -= dt;
		const gutter = state.flick < 0 ? (state.flick < -0.12 ? (state.flick = 0.4 + Math.random() * 3, 1) : 0.25) : 1;
		fadeU.value = (state.phase === 'gone' ? Math.max(0, 1 - state.gone / 0.5) * (Math.random() < 0.5 ? 1 : 0.2) : state.fade) * gutter;
		rimU.value = 0.7 + 0.3 * Math.sin(t * 2.1);
		// dread: how near she is
		const k = Math.max(0, Math.min(1, (45 - d) / 40)) * state.fade * (state.phase === 'gone' ? Math.max(0, 1 - state.gone / 0.6) : 1);
		screen(Math.pow(k, 0.8), t);
		grainT -= dt;
		if (grainT < 0 && k > 0.02) { grainT = 0.07; drawGrain(); }
		hush?.(Math.min(1, k * 1.6));
		if (sound()) {
			droneOn();
			S.out.gain.setTargetAtTime(k * 0.9, ctx.currentTime, 0.5);
			noteT -= dt;
			if (noteT < 0 && k > 0.15 && state.phase !== 'gone') { noteT = 0.55 + note * 0.06; musicBox(0.02 + k * 0.03); }
		}
	}
	// for looking into her: where she is and what she is made of
	function inspect() {
		if (!G) return 'not made';
		const P = G.P, w = new THREE.Vector3(), out = [];
		P.root.getWorldPosition(w);
		out.push(`root ${w.x.toFixed(1)},${w.y.toFixed(1)},${w.z.toFixed(1)} vis ${P.root.visible} parent ${!!P.root.parent} inScene ${!!P.root.parent?.isScene}`);
		const b = P.bones[0]; b.getWorldPosition(w); out.push(`bone0 ${w.x.toFixed(1)},${w.y.toFixed(1)},${w.z.toFixed(1)}`);
		P.root.traverse((o) => { if (o.isMesh) out.push(`${o.type} ${o.material.type} op ${o.material.opacity} tr ${o.material.transparent} v ${o.visible}`); });
		out.push(`fade ${fadeU.value.toFixed(2)} state ${state?.phase}`);
		return out.join(' | ');
	}
	return { update, summon: (camera, at) => { cool = 0; camera.getWorldDirection(fwd); return appear(camera.position, Math.atan2(-fwd.x, -fwd.z), at); }, active: () => !!state, inspect };
}
