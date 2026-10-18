// What magic looks and sounds like: glowing motes of light drawn as additive points from one
// fixed pool (nothing is made while you cast, no lights are added), and a short voice for each
// school, made on the world's sound bus (world/soundbus.js). The aether in the world
// (magic/aether.js) and the spells (magic/caster.js) both draw through this.

import * as THREE from 'three';
import { soundBus } from '../world/soundbus.js';
import { CHARGE } from './beam.js';

// colours (linear-ish, for the additive glow) by school, and the two strands
export const GLOW = {
	light: [1.0, 0.82, 0.42], dark: [0.55, 0.32, 1.0],
	radiance: [1.0, 0.78, 0.35], restoration: [0.45, 1.0, 0.62], warding: [0.55, 0.85, 1.0], dawn: [1.0, 0.9, 0.62],
	shadow: [0.6, 0.38, 1.0], void: [0.42, 0.34, 1.0], blight: [0.62, 0.95, 0.22], umbral: [0.78, 0.48, 1.0],
	storm: [0.5, 0.88, 1.0], chrono: [0.9, 0.82, 1.0], primal: [1.0, 0.5, 0.22], frost: [0.6, 0.9, 1.0],
};

export function createMagicFx(scene, { isPhone = false } = {}) {
	const N = isPhone ? 1400 : 3200;
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(N * 3), col = new Float32Array(N * 4), size = new Float32Array(N);
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
	g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
	const mat = new THREE.ShaderMaterial({
		uniforms: { scale: { value: 600 }, uXray: { value: 0 } },
		vertexShader: 'attribute float size; attribute vec4 color; varying vec4 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(256.0, size * scale / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }',
		fragmentShader: 'varying vec4 vC; void main(){ vec2 q = gl_PointCoord * 2.0 - 1.0; float r = dot(q, q); if (r > 1.0) discard; float a = 1.0 - r; a *= a; gl_FragColor = vec4(vC.rgb * (a + 0.6 * a * a) * vC.a, 1.0); }',
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
	});
	const pts = new THREE.Points(g, mat);
	pts.frustumCulled = false; pts.renderOrder = 4; pts.name = 'magic-fx';
	scene.add(pts);
	// what is seen through walls (the sight spells): the same, drawn over everything
	const xray = new THREE.Points(g, mat.clone());
	xray.material.depthTest = false; xray.frustumCulled = false; xray.renderOrder = 5; xray.visible = false;
	const P = [];
	for (let i = 0; i < N; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 0.1, s1: 0.1, r: 1, gC: 1, b: 1, a: 1 });
	let next = 0;
	// one point: where, its velocity, its life (s), its size from s0 to s1 (m), colour, alpha,
	// gravity (m/s²) and drag
	function emit(x, y, z, vx, vy, vz, life, s0, s1, c, a = 1, grav = 0, drag = 1) {
		const p = P[next]; next = (next + 1) % N;
		p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.r = c[0]; p.gC = c[1]; p.b = c[2]; p.a = a; p.g = grav; p.drag = drag;
		return p;
	}
	// a puff of n points out from a place, at speed v
	function burst(at, c, n = 12, v = 3, life = 0.6, s = 0.18, up = 0.5) {
		for (let k = 0; k < n; k++) {
			const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.6, sp = v * (0.4 + Math.random() * 0.8);
			emit(at.x, at.y, at.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + up, Math.sin(a) * Math.cos(e) * sp, life * (0.6 + Math.random() * 0.6), s, s * 0.2, c, 1, 0, 2);
		}
	}
	// a ring of points on the ground spreading to r
	function ring(at, r, c, n = 40, life = 0.7, s = 0.3) {
		for (let k = 0; k < n; k++) {
			const a = k / n * 6.283, v = r / life;
			emit(at.x, at.y + 0.15, at.z, Math.cos(a) * v, 0.2, Math.sin(a) * v, life, s, s * 0.4, c, 0.9, 0, 0.6);
		}
	}
	// a line of points from a to b (a beam's sheath, a bolt of lightning), jagged if j > 0
	function line(a, b, c, step = 0.6, life = 0.12, s = 0.22, j = 0) {
		const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz), n = Math.max(2, Math.min(160, Math.ceil(L / step)));
		for (let k = 0; k <= n; k++) {
			const u = k / n, w = j * Math.sin(u * Math.PI);
			emit(a.x + dx * u + (Math.random() - 0.5) * w, a.y + dy * u + (Math.random() - 0.5) * w, a.z + dz * u + (Math.random() - 0.5) * w, 0, 0, 0, life * (0.7 + Math.random() * 0.6), s, s * 0.5, c, 1, 0, 0);
		}
	}
	// a column of light falling or rising at a place
	function pillar(at, h, c, n = 50, life = 0.8, s = 0.5, up = true) {
		for (let k = 0; k < n; k++) {
			const a = Math.random() * 6.283, r = Math.random() * 0.8;
			emit(at.x + Math.cos(a) * r, at.y + (up ? 0 : h) + Math.random() * 0.5, at.z + Math.sin(a) * r, 0, (up ? 1 : -1) * h / life * (0.6 + Math.random() * 0.6), 0, life, s, s * 0.3, c, 1, 0, 0);
		}
	}
	function update(dt, xrayOn = false) {
		for (let i = 0; i < N; i++) {
			const p = P[i];
			if (p.life <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
			p.life -= dt;
			const k = Math.exp(-p.drag * dt);
			p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			const u = 1 - Math.max(0, p.life) / p.max;
			pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
			size[i] = p.life > 0 ? p.s0 + (p.s1 - p.s0) * u : 0;
			col[i * 4] = p.r; col[i * 4 + 1] = p.gC; col[i * 4 + 2] = p.b; col[i * 4 + 3] = p.a * (1 - u * u);
		}
		g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = true;
		if (xrayOn && !xray.parent) scene.add(xray);
		xray.visible = xrayOn;
	}
	function resize(h, fov) { mat.uniforms.scale.value = xray.material.uniforms.scale.value = h / 2 / Math.tan((fov * Math.PI) / 360); }
	function clear() { for (const p of P) p.life = 0; }
	function dispose() { scene.remove(pts); scene.remove(xray); g.dispose(); mat.dispose(); xray.material.dispose(); }
	return { emit, burst, ring, line, pillar, update, resize, clear, dispose, points: pts };
}

// ---------- the voices ----------
// a short sound for a school's casting, a hit, gathering fabric, a fizzle; quiet, synthesised
const VOICE = {
	radiance: { f: 880, f2: 1320, type: 'triangle' }, restoration: { f: 660, f2: 990, type: 'sine' }, warding: { f: 520, f2: 780, type: 'sine' }, dawn: { f: 990, f2: 1480, type: 'sine' },
	shadow: { f: 220, f2: 140, type: 'sawtooth' }, void: { f: 160, f2: 60, type: 'sawtooth' }, blight: { f: 190, f2: 240, type: 'square' }, umbral: { f: 260, f2: 130, type: 'triangle' },
	storm: { f: 120, f2: 2400, type: 'sawtooth' }, chrono: { f: 740, f2: 370, type: 'sine' }, primal: { f: 300, f2: 180, type: 'square' },
};
export function magicSound(kind, gain = 0.12) {
	try {
		const bus = soundBus(); if (!bus) return;
		const C = bus.ctx, t = C.currentTime, o = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), f = C.createBiquadFilter();
		const V = VOICE[kind] || (kind === 'gather' ? { f: 1175, f2: 1568, type: 'sine' } : kind === 'fizzle' ? { f: 300, f2: 200, type: 'triangle' } : VOICE.radiance);
		o.type = V.type; o2.type = 'sine';
		o.frequency.setValueAtTime(V.f, t); o.frequency.exponentialRampToValueAtTime(V.f2, t + 0.25);
		o2.frequency.setValueAtTime(V.f * 1.5, t); o2.frequency.exponentialRampToValueAtTime(V.f2 * 1.5, t + 0.3);
		f.type = 'lowpass'; f.frequency.value = kind === 'storm' ? 5000 : 2600;
		g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'gather' ? 0.7 : 0.45));
		o.connect(f); o2.connect(f); f.connect(g); g.connect(bus.out);
		o.start(t); o2.start(t); o.stop(t + 0.8); o2.stop(t + 0.8);
		o.onended = () => { o.disconnect(); o2.disconnect(); f.disconnect(); g.disconnect(); };
	} catch { /* no sound here */ }
}

// a beam's voice: a whine rising as it gathers (CHARGE), then a roar, rushing air and a low hum,
// for as long as it pours. returns { stop() } (it dies away), or null where there is no sound
const noises = new WeakMap();
function noiseOf(C) {
	let b = noises.get(C);
	if (!b) { b = C.createBuffer(1, C.sampleRate, C.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noises.set(C, b); }
	return b;
}
export function beamVoice(kind) {
	try {
		const bus = soundBus(); if (!bus) return null;
		const C = bus.ctx, t = C.currentTime, V = VOICE[kind] || VOICE.radiance, go = t + CHARGE;
		const w = C.createOscillator(), wg = C.createGain();
		w.type = 'sine';
		w.frequency.setValueAtTime(V.f * 0.35, t); w.frequency.exponentialRampToValueAtTime(V.f * 1.6, go);
		wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.06, go - 0.03); wg.gain.exponentialRampToValueAtTime(0.0001, go + 0.08);
		w.connect(wg); wg.connect(bus.out); w.start(t); w.stop(go + 0.1);
		w.onended = () => { w.disconnect(); wg.disconnect(); };
		const n = C.createBufferSource(), bp = C.createBiquadFilter(), hum = C.createOscillator(), lp = C.createBiquadFilter(), out = C.createGain();
		n.buffer = noiseOf(C); n.loop = true;
		bp.type = 'bandpass'; bp.frequency.value = Math.max(300, Math.min(1400, V.f)); bp.Q.value = 0.7;
		hum.type = 'sawtooth'; hum.frequency.value = Math.max(40, Math.min(110, V.f / 4));
		lp.type = 'lowpass'; lp.frequency.value = 650;
		n.connect(bp); bp.connect(out); hum.connect(lp); lp.connect(out); out.connect(bus.out);
		// (silent while it gathers; a crack as it lets go, settling to a roar)
		out.gain.setValueAtTime(0.0001, t); out.gain.setValueAtTime(0.0001, go);
		out.gain.exponentialRampToValueAtTime(0.22, go + 0.03); out.gain.exponentialRampToValueAtTime(0.11, go + 0.45);
		n.start(t); hum.start(t);
		let done = false;
		return {
			stop() {
				if (done) return;
				done = true;
				const s = C.currentTime;
				out.gain.cancelScheduledValues(s); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), s); out.gain.exponentialRampToValueAtTime(0.0001, s + 0.25);
				n.stop(s + 0.3); hum.stop(s + 0.3);
				hum.onended = () => { n.disconnect(); bp.disconnect(); hum.disconnect(); lp.disconnect(); out.disconnect(); };
			},
		};
	} catch { return null; }
}
