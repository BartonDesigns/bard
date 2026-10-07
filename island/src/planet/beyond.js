// Beyond the horizon: the Held Note. On the world by the dark star, the Event Ring's black
// sphere is a way through. Coming near it, space lenses round it, the music wavers and drags;
// step into the light beneath it and you are drawn up into the sphere, and out the other side
// of the horizon: a realm where time has stopped, so sound never ends.
//
//   the ground is a stave: black glass ruled with rings of five lines round where you fell in
//   the sky is the whole universe at once: its light in one ring round the zenith, the stars
//     outside racing round it (out there aeons pass in seconds)
//   every note the Bard plays stands up as a pillar of light (height the pitch, colour the
//     note) and stays; a long echo is fed into the master, so phrases linger
//   your echo walks where you were ten seconds ago; gravity is a third; space is folded, so
//     walking out one side brings you in at the other
//   seven held voices hang over the stave: reach one, or play its note near it, and it rises
//     to the Chord of Return above the centre
//   the white fountain at the centre (a white hole) throws you back out onto the Ring
//
// Found once, it is kept (localStorage 'l99-beyond'): the journal reads it, and space flight
// offers it as a warp.

import * as THREE from 'three';
import { mulberry32 } from '../noise.js';
import { soundBus } from '../world/soundbus.js';

const KEY = 'l99-beyond';
const Y0 = 2400;          // the realm's floor, far above the world it hangs over
const FOLD = 380;         // how far out before space folds you back in
const SCALE = [0, 2, 4, 6, 7, 9, 11];   // the voices: a Lydian scale on A
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: not kept */ } };
export const beyondFound = () => !!load()?.found;
export const beyondSeed = () => load()?.seed;

const QUAD_VS = 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
// the lens: light from behind the sphere bent round it, its shadow, the photon ring
const LENS_FS = `
uniform sampler2D tScene; uniform vec2 uC; uniform float uR, uK, uAsp;
varying vec2 vUv;
vec3 tap(vec2 q) { q.x /= uAsp; return texture2D(tScene, clamp(uC + q, 0.002, 0.998)).rgb; }
void main() {
	vec2 q = vUv - uC; q.x *= uAsp;
	float r = max(length(q), 1e-4), e = uR * 1.45;
	vec2 n = q / r;
	float a = uK * e * e / r;
	vec3 c = vec3(tap(q - n * a * 1.05).r, tap(q - n * a).g, tap(q - n * a * 0.95).b);
	float sh = smoothstep(uR, uR * 0.88, r) * min(1.0, uK * 2.5);
	float ring = exp(-pow((r - uR * 1.05) / (uR * 0.06 + 0.002), 2.0)) * uK;
	c = mix(c, vec3(0.0), sh) + ring * vec3(1.0, 0.72, 0.45) * 1.6;
	c *= 1.0 - uK * 0.55 * smoothstep(0.25, 0.85, length(vUv - 0.5));
	gl_FragColor = vec4(c, 1.0);
}`;
// the stave: rings of five lines, ripples running out from steps and notes
const FLOOR_VS = 'varying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const FLOOR_FS = `
uniform vec3 uO, uFog; uniform float uTime, uMid, uBass, uGold; uniform vec4 uRip[6];
varying vec3 vW;
void main() {
	vec2 p = vW.xz - uO.xz;
	float r = length(p), dist = distance(vW, cameraPosition);
	float j = (mod(r, 30.0) - 3.0) / 2.2, inS = step(-0.3, j) * step(j, 4.3);
	float d = abs(fract(j + 0.5) - 0.5) * 2.2, w = fwidth(d);
	float line = (1.0 - smoothstep(0.05, 0.05 + w * 1.5, d)) * inS * exp(-dist * 0.005);
	float wave = 0.0;
	for (int i = 0; i < 6; i++) {
		float age = uTime - uRip[i].z, rd = distance(vW.xz, uRip[i].xy), front = age * 11.0;
		wave += uRip[i].w * exp(-abs(rd - front) * 0.35) * exp(-age * 0.35) * (0.6 + 0.4 * sin(rd * 1.3 - age * 10.0));
	}
	vec3 ink = mix(vec3(0.55, 0.62, 1.0), vec3(1.0, 0.82, 0.45), uGold);
	vec3 c = vec3(0.012, 0.010, 0.022) + ink * line * (0.8 + uMid * 1.2) + ink * max(wave, 0.0) * 0.45;
	c += vec3(0.25, 0.2, 0.5) * exp(-r * 0.03) * (0.4 + uBass);
	gl_FragColor = vec4(mix(c, uFog, 1.0 - exp(-dist * 0.0065)), 1.0);
}`;
// the sky from inside: the universe's light squeezed into a ring, the stars racing round it
const SKY_VS = 'varying vec3 vD;\nvoid main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }';
const SKY_FS = `
uniform float uTime, uGold, uHigh; uniform vec3 uFog;
varying vec3 vD;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
	vec3 d = normalize(vD);
	float az = atan(d.z, d.x), el = d.y;
	float ring = exp(-pow((el - 0.8) / 0.035, 2.0)) * (0.75 + 0.25 * sin(az * 37.0 + uTime * 7.0));
	float halo = exp(-pow((el - 0.8) / 0.16, 2.0)) * 0.35;
	vec2 g = vec2((az + uTime * 0.6 * (1.2 - el)) * 90.0, el * 90.0);
	float st = step(0.992, h21(floor(g))) * smoothstep(0.0, 0.4, el) * smoothstep(0.5, 0.0, abs(fract(g.y) - 0.5));
	vec3 hot = mix(vec3(0.75, 0.6, 1.0), vec3(1.0, 0.85, 0.5), uGold);
	vec3 c = mix(uFog, vec3(0.0), smoothstep(-0.05, 0.4, el)) + hot * (ring * (1.4 + uHigh) + halo) + vec3(0.8, 0.85, 1.0) * st * 0.8;
	c += vec3(1.0) * exp(-pow((el - 1.0) / 0.03, 2.0)) * 0.6;
	gl_FragColor = vec4(c, 1.0);
}`;

export function createBeyond({ renderer, scene: worldScene, camera, island, shared, site, player, hint, mount, isPhone }) {
	const S = site, Rc = 0.42 * S.h, cy = Rc + 3, rS = 0.12 * Rc;
	const cp = new THREE.Vector3(S.x, S.y + cy, S.z);
	const O = new THREE.Vector3(S.x, Y0, S.z);
	const P = player.state;
	const rnd = mulberry32((island.seed ^ 0xbe90d) >>> 0);
	let kept = load();
	const voicesKept = () => (kept?.voices && kept.seed === island.seed ? kept.voices : []);

	// ---------- the realm ----------
	const realm = new THREE.Scene();
	const fogC = new THREE.Color(0.035, 0.025, 0.07);
	realm.fog = new THREE.FogExp2(fogC, 0.0055);
	realm.background = fogC;
	const rip = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -99, 0));
	let ripN = 0;
	const FU = { uO: { value: O }, uFog: { value: fogC }, uTime: { value: 0 }, uMid: { value: 0 }, uBass: { value: 0 }, uGold: { value: 0 }, uRip: { value: rip } };
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(FOLD * 4, FOLD * 4).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: FU, vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS }));
	floor.position.copy(O);
	realm.add(floor);
	const SU = { uTime: FU.uTime, uGold: FU.uGold, uHigh: { value: 0 }, uFog: FU.uFog };
	const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({ uniforms: SU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false }));
	sky.frustumCulled = false; sky.renderOrder = -10;
	realm.add(sky);
	const add = (o) => { realm.add(o); return o; };
	const glowMat = (c, op) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
	// the white fountain: the way back
	const fg = new THREE.CylinderGeometry(2.6, 3.4, 500, 24, 1, true).translate(0, 250, 0);
	const fc = new Float32Array(fg.attributes.position.count * 3);
	for (let i = 0; i < fg.attributes.position.count; i++) { const k = 1 - Math.min(1, fg.attributes.position.getY(i) / 500); fc.set([k, k, k], i * 3); }
	fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
	const fountain = add(new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
	fountain.position.copy(O);
	add(new THREE.Mesh(new THREE.RingGeometry(3.6, 4.4, 48).rotateX(-Math.PI / 2), glowMat(0xffffff, 0.8))).position.set(O.x, Y0 + 0.05, O.z);
	// the notes you play: pillars of light that stay
	const MAXN = isPhone ? 96 : 160;
	const pillars = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.14, 1, 6, 1, true).translate(0, 0.5, 0), glowMat(0xffffff, 0.85), MAXN));
	pillars.count = 0; pillars.frustumCulled = false;
	pillars.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXN * 3), 3);
	let noteN = 0;
	const m4 = new THREE.Matrix4(), col = new THREE.Color();
	// your echo
	const echo = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 4, 8), glowMat(0x9fd8ff, 0.32)));
	const trail = [];
	// the seven held voices, and the Chord of Return they rise to
	const voices = SCALE.map((semi, k) => {
		const a = k / 7 * Math.PI * 2 + rnd() * 0.5, d = 95 + k * 38 + rnd() * 20;
		const g = new THREE.Group(), c = new THREE.Color().setHSL(semi / 12, 0.7, 0.6);
		for (let i = 0; i < 3; i++) {
			const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 + i * 0.25), glowMat(c, 0.75));
			m.position.set(Math.cos(i * 2.1) * 0.9, i * 0.8, Math.sin(i * 2.1) * 0.9);
			m.scale.y = 1.8;
			g.add(m);
		}
		const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.5, 70, 6, 1, true).translate(0, 35, 0), glowMat(c, 0.16));
		g.add(beam);
		const home = new THREE.Vector3(O.x + Math.cos(a) * d, Y0 + 3.2, O.z + Math.sin(a) * d);
		const slot = new THREE.Vector3(O.x + Math.cos(k / 7 * Math.PI * 2) * 11, Y0 + 46, O.z + Math.sin(k / 7 * Math.PI * 2) * 11);
		g.position.copy(home);
		add(g);
		return { k, semi, f: 220 * Math.pow(2, semi / 12), g, beam, home, slot, woke: false, rise: 0, hum: null };
	});
	for (const k of voicesKept()) if (voices[k]) { voices[k].woke = true; voices[k].rise = 1; voices[k].beam.visible = false; }

	// ---------- the passes on the world side: the lens ----------
	const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const LU = { tScene: { value: null }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uR: { value: 0.01 }, uK: { value: 0 }, uAsp: { value: 1 } };
	const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: LU, vertexShader: QUAD_VS, fragmentShader: LENS_FS, depthTest: false, depthWrite: false, toneMapped: false }));
	quad.frustumCulled = false;
	quadScene.add(quad);
	let rt = null;
	const size = new THREE.Vector2();
	function target() {
		renderer.getDrawingBufferSize(size);
		const w = Math.max(1, size.x | 0), h = Math.max(1, size.y | 0);
		if (rt && rt.width === w && rt.height === h) return;
		rt?.dispose();
		// (drawn as the canvas is: tone mapped and encoded, stored as plain bytes)
		rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, samples: isPhone ? 0 : 4, depthBuffer: true });
		rt.texture.internalFormat = 'RGBA8';
		rt.isXRRenderTarget = true;
	}

	// ---------- the veil and the way out ----------
	const veil = document.createElement('div');
	veil.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:40;transition:none';
	mount.appendChild(veil);
	const leaveBtn = document.createElement('button');
	leaveBtn.textContent = '⟲ Leave the horizon';
	leaveBtn.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:41;display:none;padding:8px 14px;border-radius:18px;border:1px solid rgba(255,255,255,.35);background:rgba(20,12,40,.6);color:#f2eaff;font:14px system-ui,sans-serif';
	for (const ev of ['pointerdown', 'touchstart']) leaveBtn.addEventListener(ev, (e) => e.stopPropagation());
	leaveBtn.onclick = () => leave();
	mount.appendChild(leaveBtn);

	// ---------- sound ----------
	// a send from the Bard's master: a wavering delay (the stretch) and a long held echo
	let fx = null;
	function fxNodes() {
		const out = window._masterClip, ctx = out?.context;
		if (!ctx || ctx.state !== 'running') return null;
		if (fx && fx.ctx === ctx) return fx;
		try {
			const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
			const inp = g(1), stretch = g(0), held = g(0);
			const dl = ctx.createDelay(1); dl.delayTime.value = 0.03;
			const lfo = ctx.createOscillator(), depth = g(0);
			lfo.frequency.value = 0.35; lfo.connect(depth); depth.connect(dl.delayTime); lfo.start();
			const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
			inp.connect(dl); dl.connect(lp); lp.connect(stretch); stretch.connect(ctx.destination);
			const d1 = ctx.createDelay(2), d2 = ctx.createDelay(2), fb1 = g(0.74), fb2 = g(0.7), hl = ctx.createBiquadFilter();
			d1.delayTime.value = 0.41; d2.delayTime.value = 0.67; hl.type = 'lowpass'; hl.frequency.value = 2600;
			inp.connect(hl); hl.connect(d1); hl.connect(d2); d1.connect(fb1); fb1.connect(d2); d2.connect(fb2); fb2.connect(d1);
			d1.connect(held); d2.connect(held); held.connect(ctx.destination);
			out.connect(inp);
			fx = { ctx, out, inp, stretch, held, dl, depth, lfo };
		} catch { fx = null; }
		return fx;
	}
	function fxSet(stretchK, heldK) {
		const F = (stretchK > 0.001 || heldK > 0.001 || fx) ? fxNodes() : null;
		if (!F) return;
		const t = F.ctx.currentTime;
		F.stretch.gain.setTargetAtTime(stretchK * 0.7, t, 0.3);
		F.depth.gain.setTargetAtTime(stretchK * 0.012, t, 0.3);
		F.dl.delayTime.setTargetAtTime(0.03 + stretchK * 0.12, t, 1.5);
		F.held.gain.setTargetAtTime(heldK * 0.45, t, 0.5);
	}
	function fxStop() {
		if (!fx) return;
		try { fx.out.disconnect(fx.inp); fx.lfo.stop(); fx.stretch.disconnect(); fx.held.disconnect(); } catch { /* already gone */ }
		fx = null;
	}
	// a bell: a voice waking, a note ringing
	function bell(f, gain = 0.08, dur = 5) {
		const B = soundBus();
		if (!B) return;
		const { ctx, out } = B, t = ctx.currentTime;
		try {
			const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
			o.frequency.value = f; m.frequency.value = f * 3.5;
			mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 0.6);
			m.connect(mg); mg.connect(o.frequency);
			g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
			o.connect(g); g.connect(out);
			o.start(t); m.start(t); o.stop(t + dur + 0.1); m.stop(t + dur + 0.1);
		} catch { /* no sound */ }
	}
	// each voice still singing, heard as you come near it
	function humVoice(V, k) {
		const B = soundBus();
		if (!B) return;
		if (!V.hum && k > 0.01) {
			try {
				const o = B.ctx.createOscillator(), v = B.ctx.createOscillator(), vg = B.ctx.createGain(), g = B.ctx.createGain();
				o.type = 'triangle'; o.frequency.value = V.f; v.frequency.value = 5 + V.k * 0.3; vg.gain.value = V.f * 0.006;
				v.connect(vg); vg.connect(o.frequency); g.gain.value = 0; o.connect(g); g.connect(B.out); o.start(); v.start();
				V.hum = { o, v, g, ctx: B.ctx };
			} catch { return; }
		}
		if (!V.hum) return;
		V.hum.g.gain.setTargetAtTime(k * 0.035, V.hum.ctx.currentTime, 0.3);
		if (k < 0.005) { try { V.hum.o.stop(); V.hum.v.stop(); V.hum.g.disconnect(); } catch { /* gone */ } V.hum = null; }
	}

	// ---------- going through ----------
	let mode = 'out', T = 0, lensK = 0, approach = 0, inT = 0, flashT = 0;
	const saved = {};
	const camFrom = new THREE.Vector3();
	function enter(direct) {
		if (mode !== 'out') return false;
		mode = 'enter'; T = direct ? 2.6 : 0;
		P.locked = true; P.flying = false; P.vel.set(0, 0, 0);
		camFrom.copy(camera.position);
		return true;
	}
	function inside() {
		saved.underFloor = island.underFloor; saved.underPush = island.underPush; saved.gravity = island.gravity; saved.flyCeiling = island.flyCeiling;
		const uf = saved.underFloor, up = saved.underPush;
		island.underFloor = (x, z, y) => y > Y0 - 60 ? Y0 : uf?.(x, z, y);
		island.underPush = (p, fy) => { if (fy < Y0 - 60) up?.(p, fy); };
		island.gravity = (saved.gravity || 1) * 0.34;
		island.flyCeiling = () => 300;
		const v0 = voices.find((v) => !v.woke) || voices[0];
		const a = Math.atan2(v0.home.z - O.z, v0.home.x - O.x);
		P.pos.set(O.x + Math.cos(a) * 26, Y0 + 1.7 + 6, O.z + Math.sin(a) * 26);
		P.vel.set(0, 0, 0);
		P.yaw = Math.atan2(-(v0.home.x - P.pos.x), -(v0.home.z - P.pos.z)); P.pitch = 0.05;
		P.locked = false; P.flying = false;
		trail.length = 0; inT = 0;
		mode = 'in';
		leaveBtn.style.display = '';
		kept = load() || {};
		const first = !kept.found;
		kept.found ||= Date.now(); kept.seed = island.seed;
		save(kept);
		hint(first ? 'Beyond the horizon.\nHere time has stopped, and sound never ends: play, and it stays.\nSeven held voices hang in the dark. The white fountain is the way back.' : 'Beyond the horizon, again. The held voices are where you left them.', 9000);
	}
	function leave() {
		if (mode !== 'in') return;
		mode = 'leave'; T = 0;
		leaveBtn.style.display = 'none';
	}
	function outside() {
		island.underFloor = saved.underFloor; island.underPush = saved.underPush; island.gravity = saved.gravity; island.flyCeiling = saved.flyCeiling;
		// thrown out onto the Ring's platform, facing it
		const a = S.yaw + Math.PI;
		P.pos.set(S.x + Math.sin(a) * S.r * 0.75, S.y + 1.7 + 0.5, S.z + Math.cos(a) * S.r * 0.75);
		P.vel.set(0, 0, 0); P.flying = false; P.locked = false;
		P.yaw = Math.atan2(-(S.x - P.pos.x), -(S.z - P.pos.z)); P.pitch = 0.35;
		for (const V of voices) humVoice(V, 0);
		mode = 'cool'; T = 0;
	}

	// ---------- in the realm ----------
	let lastSteps = P.gait?.count || 0;
	function ripple(x, z, k, t) { rip[ripN].set(x, z, t, k); ripN = (ripN + 1) % rip.length; }
	function playNote(f, t) {
		const midi = 69 + 12 * Math.log2(f / 440), pc = ((Math.round(midi) % 12) + 12) % 12;
		const fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw), j = noteN * 2.399;
		const x = P.pos.x + fx0 * 7 + Math.cos(j) * 2, z = P.pos.z + fz0 * 7 + Math.sin(j) * 2;
		const h = Math.max(1.5, 2 + (midi - 36) * 0.32);
		m4.makeScale(1, h, 1).setPosition(x, Y0, z);
		const i = noteN % MAXN;
		pillars.setMatrixAt(i, m4);
		pillars.setColorAt(i, col.setHSL(pc / 12, 0.75, 0.6));
		pillars.count = Math.min(MAXN, noteN + 1);
		pillars.instanceMatrix.needsUpdate = true; pillars.instanceColor.needsUpdate = true;
		noteN++;
		ripple(x, z, 1, t);
		// a voice of the same note near you hears it, and wakes
		for (const V of voices) if (!V.woke && (9 + V.semi) % 12 === pc && V.g.position.distanceTo(P.pos) < 60) wake(V);
	}
	function wake(V) {
		V.woke = true;
		bell(V.f, 0.09, 7);
		bell(V.f * 2, 0.03, 5);
		kept = load() || {};
		const list = new Set(kept.seed === island.seed ? kept.voices || [] : []);
		list.add(V.k);
		kept.voices = [...list]; kept.seed = island.seed;
		const n = kept.voices.length;
		if (n >= 7 && !kept.chord) {
			kept.chord = Date.now();
			for (const W of voices) setTimeout(() => bell(W.f, 0.05, 9), W.k * 140);
			hint('The Chord of Return sounds in full.\nAll seven held voices, gathered.', 7000);
		} else hint(`A held voice wakes and rises: ${n} of 7.`, 3500);
		save(kept);
	}
	function realmUpdate(dt, t) {
		inT += dt;
		const perf = shared.performance || {};
		FU.uTime.value = t;
		FU.uMid.value = shared.uMid?.value || 0; FU.uBass.value = shared.uBass?.value || 0; SU.uHigh.value = shared.uHigh?.value || 0;
		const gathered = voices.filter((v) => v.woke).length;
		FU.uGold.value += ((gathered >= 7 ? 1 : gathered / 14) - FU.uGold.value) * Math.min(1, dt * 0.5);
		sky.position.copy(camera.position);
		// your music stays
		for (const n of perf.on || []) if (n.frequency > 0) playNote(n.frequency, t);
		if (!(perf.notes || []).length && perf.kick > 0) ripple(P.pos.x, P.pos.z, 0.6 + perf.kick, t);
		// steps ring on the stave
		const sc = P.gait?.count || 0;
		if (sc !== lastSteps) { lastSteps = sc; ripple(P.pos.x, P.pos.z, 0.35, t); }
		// your echo, ten seconds behind
		trail.push({ x: P.pos.x, y: P.pos.y, z: P.pos.z, t: inT });
		while (trail.length > 2 && trail[1].t < inT - 10) trail.shift();
		const e = trail[0];
		echo.visible = inT > 10;
		if (e) echo.position.set(e.x, e.y - 0.9, e.z);
		// space folds: out one side, in at the other
		const dx = P.pos.x - O.x, dz = P.pos.z - O.z, r = Math.hypot(dx, dz);
		if (r > FOLD) {
			P.pos.x = O.x - dx / r * (FOLD - 15); P.pos.z = O.z - dz / r * (FOLD - 15);
			veil.style.opacity = '0.5'; flashT = 0.6;
		}
		// the voices: turning, singing, rising when woken
		for (const V of voices) {
			V.g.rotation.y += dt * (0.3 + V.k * 0.04);
			const d = V.g.position.distanceTo(P.pos);
			if (!V.woke && d < 6) wake(V);
			if (V.woke) {
				V.rise = Math.min(1, V.rise + dt * 0.25);
				V.g.position.lerpVectors(V.home, V.slot, smooth(0, 1, V.rise));
				V.beam.visible = V.rise < 0.3;
			} else V.g.position.y = V.home.y + Math.sin(t * 0.8 + V.k) * 0.6;
			humVoice(V, V.woke ? 0 : Math.max(0, 1 - d / 70));
		}
		fountain.material.opacity = 0.55 + 0.2 * Math.sin(t * 2) + FU.uGold.value * 0.2;
		// the white fountain: the way back
		if (inT > 4 && r < 3.6) leave();
	}

	// ---------- per frame ----------
	const v3 = new THREE.Vector3();
	function update(dt, t) {
		const cam = camera.position;
		const dH = Math.hypot(cam.x - cp.x, cam.z - cp.z), d3 = cam.distanceTo(cp);
		approach = mode === 'out' || mode === 'cool' ? smooth(420, 30, d3) : approach;
		if (mode === 'out' && P.pos.y < Y0 - 100) {
			lensK = approach;
			// into the light under the sphere, or into the sphere itself
			if ((dH < 8 && cam.y < cp.y && cam.y > S.y - 2) || d3 < rS + 5) enter(false);
		}
		if (mode === 'cool') { T += dt; lensK = approach * smooth(0, 4, T); if (T > 4) mode = 'out'; }
		if (mode === 'enter') {
			T += dt;
			// drawn up the beam into the sphere, looking up into it
			const k = smooth(0.2, 3.2, T);
			camera.position.lerpVectors(camFrom, cp, k * k);
			camera.position.y = Math.min(camera.position.y, cp.y - rS * (1 - k) - 0.5);
			camera.lookAt(cp);
			lensK = Math.max(approach, smooth(0, 2.6, T)) * 1.6;
			veil.style.opacity = String(smooth(2.6, 3.2, T));
			if (T > 3.4) inside();
		}
		if (mode === 'in') {
			realmUpdate(dt, t);
			veil.style.opacity = String(Math.max(flashT > 0 ? flashT : 0, 1 - smooth(0, 1.6, inT)));
		}
		if (mode === 'leave') {
			T += dt;
			realmUpdate(dt, t);
			veil.style.opacity = String(smooth(0, 0.8, T));
			if (T > 1) outside();
		}
		if (mode === 'cool') veil.style.opacity = String(1 - smooth(0, 1.4, T));
		if (mode === 'out' && veil.style.opacity !== '0') veil.style.opacity = '0';
		flashT = Math.max(0, flashT - dt);
		const isIn = mode === 'in' || mode === 'leave';
		fxSet(isIn ? 0 : mode === 'enter' ? 1 : approach, isIn ? 1 : 0);
		if (!isIn && fx && approach < 0.001 && mode === 'out') fxStop();
		// the lens follows the sphere on screen
		if (!isIn && lensK > 0.005) {
			v3.copy(cp).project(camera);
			const facing = v3.z < 1 ? 1 : 0;
			LU.uC.value.set(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5);
			const ang = Math.asin(Math.min(1, rS / Math.max(d3, rS + 0.01)));
			LU.uR.value = Math.min(0.45, Math.tan(ang) / Math.tan(camera.fov * Math.PI / 360) * 0.5 * 1.3 + lensK * lensK * 0.03);
			LU.uK.value = Math.min(1.6, lensK) * facing;
		}
	}
	function render() {
		if (mode === 'in' || mode === 'leave') {
			renderer.render(realm, camera);
			return true;
		}
		if (lensK < 0.005 || LU.uK.value <= 0) return false;
		target();
		const prev = renderer.getRenderTarget();
		renderer.setRenderTarget(rt);
		renderer.render(worldScene, camera);
		LU.tScene.value = rt.texture;
		LU.uAsp.value = rt.width / rt.height;
		renderer.setRenderTarget(prev);
		renderer.render(quadScene, quadCam);
		return true;
	}
	function dispose() {
		if (mode === 'in' || mode === 'leave') { island.underFloor = saved.underFloor; island.underPush = saved.underPush; island.gravity = saved.gravity; island.flyCeiling = saved.flyCeiling; P.locked = false; }
		for (const V of voices) humVoice(V, 0);
		fxStop();
		rt?.dispose();
		veil.remove(); leaveBtn.remove();
		realm.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
		quad.geometry.dispose(); quad.material.dispose();
	}
	const state = () => {
		const k = load();
		return { mode, found: !!k?.found, chord: !!k?.chord, voices: voices.filter((v) => v.woke).length, approach, lensK };
	};
	return { update, render, enter, leave, state, dispose, note: (f) => { if (mode === 'in') playNote(f, shared.uTime.value); }, voices: () => voices.map((v) => ({ x: v.home.x, y: v.home.y, z: v.home.z, woke: v.woke })), inside: () => mode === 'in' || mode === 'leave', site: { x: cp.x, y: cp.y, z: cp.z, base: S.y } };
}
