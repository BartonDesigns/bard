// A humpback that lives in the bay off the village. It cruises a slow loop
// out past the reef, surfaces to blow every minute or so (you hear it through
// its own breathy voice, mixed into the faceplate), rolls its back and shows its
// flukes as it sounds. A strong bass hit from the Bard can bring it up in a
// full breach.

import * as THREE from 'three';
import { waveHeight } from './world/ocean.js';
import { glow } from './world/textures.js';

function whaleGeometry() {
	// a lathe along z: blunt head at -z, tapering to the tail stock at +z
	const prof = [];
	const L = 13;
	for (let i = 0; i <= 24; i++) {
		const t = i / 24;
		const r = Math.pow(Math.sin(Math.min(1, t * 1.25 + 0.04) * Math.PI * 0.5), 0.8) * (1 - Math.pow(t, 2.0)) * 2.15 + 0.12;
		prof.push(new THREE.Vector2(r, t * L - L * 0.4));
	}
	const body = new THREE.LatheGeometry(prof, 20);
	body.rotateX(Math.PI / 2);   // lathe y -> z
	body.scale(1, 0.82, 1);
	// pectoral fins: long, narrow, knobbly-edged
	const finShape = new THREE.Shape();
	finShape.moveTo(0, 0); finShape.quadraticCurveTo(1.6, 0.4, 4.2, 1.6); finShape.lineTo(4.4, 1.2); finShape.quadraticCurveTo(1.8, -0.2, 0, -0.7); finShape.closePath();
	const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false });
	finGeo.rotateX(Math.PI / 2);
	const finL = finGeo.clone().rotateZ(-0.35).translate(1.1, -0.6, -1.2);
	const finR = finGeo.clone().scale(-1, 1, 1).rotateZ(0.35).translate(-1.1, -0.6, -1.2);
	// the flukes
	const fl = new THREE.Shape();
	fl.moveTo(0, 0); fl.quadraticCurveTo(1.4, 0.5, 2.8, 1.6); fl.quadraticCurveTo(1.8, 1.2, 0, 0.9); fl.quadraticCurveTo(-1.8, 1.2, -2.8, 1.6); fl.quadraticCurveTo(-1.4, 0.5, 0, 0);
	const fluke = new THREE.ExtrudeGeometry(fl, { depth: 0.12, bevelEnabled: false });
	fluke.rotateX(Math.PI / 2).translate(0, 0.06, L * 0.6 - 0.2);
	const parts = [body, finL, finR, fluke].map((g) => g.index ? g.toNonIndexed() : g);
	const P = [], N = [], C = [];
	for (const g of parts) {
		g.computeVertexNormals();
		const p = g.attributes.position, n = g.attributes.normal;
		for (let i = 0; i < p.count; i++) {
			P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i));
			// countershaded: dark blue-grey back, pale throat pleats and belly
			const under = THREE.MathUtils.smoothstep(-n.getY(i), 0.1, 0.6);
			C.push(0.16 + under * 0.62, 0.19 + under * 0.62, 0.23 + under * 0.6);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	g.computeBoundingSphere();
	return g;
}

export function createWhale(island, shared, scene) {
	const v = island.village;
	// the loop: out in the bay, where the water is deep
	const cx = v.coast.x + v.seaDir.x * 430, cz = v.coast.z + v.seaDir.z * 430, R = 170;
	const uniforms = { uTime: shared.uTime, uBeat: { value: 0 }, uAmp: { value: 0.25 } };
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 });
	mat.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, uniforms);
		sh.vertexShader = 'uniform float uTime, uBeat, uAmp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
			#include <begin_vertex>
			// the tail beats up and down, more toward the flukes
			float k = smoothstep(-1.0, 7.8, position.z);
			transformed.y += sin(uBeat - position.z * 0.28) * uAmp * k * k * 1.6;`);
	};
	mat.customProgramCacheKey = () => 'island-whale';
	const whale = new THREE.Mesh(whaleGeometry(), mat);
	whale.castShadow = true;
	whale.userData.material175 = 'soft';
	whale.name = 'whale';
	scene.add(whale);

	// blow and splash: mist that rises and spreads
	const M = 90, mist = new Float32Array(M * 3), mistV = [];
	for (let i = 0; i < M; i++) mistV.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, t: 99 });
	const mg = new THREE.BufferGeometry();
	mg.setAttribute('position', new THREE.BufferAttribute(mist, 3));
	const mm = new THREE.PointsMaterial({ map: glow(), color: 0xffffff, size: 2.4, transparent: true, depthWrite: false, opacity: 0.75 });
	const spray = new THREE.Points(mg, mm);
	spray.frustumCulled = false;
	scene.add(spray);
	function puff(x, y, z, n, up, spread) {
		for (let i = 0, k = 0; i < M && k < n; i++) {
			const p = mistV[i];
			if (p.t < 2.5) continue;
			Object.assign(p, { x, y, z, vx: (Math.random() - 0.5) * spread, vy: up * (0.6 + Math.random() * 0.5), vz: (Math.random() - 0.5) * spread, t: 0 });
			k++;
		}
	}
	// its own voice, not the faceplate lead (an oboe an octave down is a ship's horn):
	// a breathy blow of filtered noise and a soft, sliding song, played into the
	// Bard's lead bus so the faceplate's volume and limiter still own the mix
	let noise = null;
	function bus() {
		const b = window.leadBus227, ctx = b && b.context;
		if (!ctx || ctx.state !== 'running') return null;
		if (!noise || noise.sampleRate !== ctx.sampleRate) {
			noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
			const d = noise.getChannelData(0);
			for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		}
		return { ctx, out: b };
	}
	function near(camPos) { return camPos ? 1 / (1 + whale.position.distanceTo(camPos) / 90) : 0.5; }
	function blow(level) {
		const a = bus(); if (!a || level < 0.05) return;
		const { ctx, out } = a, t = ctx.currentTime;
		const src = ctx.createBufferSource(); src.buffer = noise;
		const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
		bp.frequency.setValueAtTime(1400, t); bp.frequency.exponentialRampToValueAtTime(420, t + 1.6);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * level, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
		src.connect(bp).connect(g).connect(out);
		src.start(t); src.stop(t + 1.9);
	}
	function song(level) {
		const a = bus(); if (!a || level < 0.05) return;
		const { ctx, out } = a, t = ctx.currentTime, f0 = 170 + Math.random() * 90, dur = 2.6 + Math.random() * 1.4;
		const o = ctx.createOscillator(); o.type = 'sine';
		o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.45, t + dur * 0.45); o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
		const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.5; vg.gain.value = f0 * 0.012;
		vib.connect(vg).connect(o.frequency);
		// air around the tone makes it a whisper rather than a note
		const air = ctx.createBufferSource(); air.buffer = noise; air.loop = true;
		const af = ctx.createBiquadFilter(); af.type = 'bandpass'; af.Q.value = 6; af.frequency.setValueAtTime(f0 * 2, t); af.frequency.exponentialRampToValueAtTime(f0 * 2.9, t + dur * 0.45);
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
		const g = ctx.createGain(), ga = ctx.createGain();
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045 * level, t + dur * 0.35); g.gain.linearRampToValueAtTime(0, t + dur);
		ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(0.07 * level, t + dur * 0.35); ga.gain.linearRampToValueAtTime(0, t + dur);
		o.connect(lp).connect(g).connect(out);
		air.connect(af).connect(ga).connect(out);
		for (const n of [o, vib, air]) { n.start(t); n.stop(t + dur + 0.05); }
	}
	function splash(level) {
		const a = bus(); if (!a || level < 0.05) return;
		const { ctx, out } = a, t = ctx.currentTime;
		const src = ctx.createBufferSource(); src.buffer = noise;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 1.3);
		const g = ctx.createGain(); g.gain.setValueAtTime(0.22 * level, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
		src.connect(lp).connect(g).connect(out); src.start(t); src.stop(t + 1.6);
	}

	const s = { a: Math.random() * 6.28, depth: -9, phase: 'cruise', t: 0, next: 25 + Math.random() * 20, breach: 0, cool: 30, lastBass: 0, beat: 0 };
	function update(dt, t, bass, camPos) {
		const lvl = near(camPos);
		const wave = shared.uWave.value;
		s.t += dt; s.cool -= dt;
		// a hard low hit from the Bard may bring it up
		if (bass > 0.72 && s.lastBass <= 0.72 && s.cool < 0 && s.phase === 'cruise') { s.phase = 'breach'; s.t = 0; s.cool = 45; }
		s.lastBass = bass;
		if (s.phase === 'cruise' && s.t > s.next) { s.phase = 'surface'; s.t = 0; }
		let target = -9, roll = 0, pitchUp = 0, speed = 3.2;
		if (s.phase === 'surface') {
			// up for three breaths, then an arching dive that lifts the flukes
			target = -0.35;
			if (s.t > 2.5 && Math.floor((s.t - 2.5) / 5) !== Math.floor((s.t - 2.5 - dt) / 5) && s.t < 17) {
				const [hx, hz] = [Math.sin(s.heading) * -4, Math.cos(s.heading) * -4];
				puff(whale.position.x + hx, 1.2, whale.position.z + hz, 36, 9, 1.4);
				blow(lvl);
				if (Math.random() < 0.4) setTimeout(() => song(near(camPos)), 900);
			}
			// sounding: the back arches, the head goes down and the flukes lift clear
			if (s.t > 17) { const k = Math.min(1, (s.t - 17) / 3); target = -1.2 - k * 2.2; pitchUp = -0.55 * k; }
			if (s.t > 21.5) { target = -14; pitchUp = -0.3; }
			if (s.t > 28) { s.phase = 'cruise'; s.t = 0; s.next = 45 + Math.random() * 40; }
		} else if (s.phase === 'breach') {
			// straight up out of the sea, a twist, and down on its back
			const k = s.t / 4.2;
			speed = 5;
			target = k < 0.5 ? -12 + Math.sin(k * Math.PI) * 26 : Math.sin(k * Math.PI) * 14 - 2;
			pitchUp = k < 0.55 ? 1.25 * Math.sin(Math.min(1, k * 2.2) * Math.PI * 0.5) : 1.25 - (k - 0.55) * 3.2;
			roll = k * 2.6;
			if (k > 0.72 && !s.splashed) { s.splashed = true; puff(whale.position.x, 0.5, whale.position.z, 70, 11, 7); splash(lvl); }
			if (k >= 1) { s.phase = 'cruise'; s.t = 0; s.splashed = false; s.next = 35 + Math.random() * 30; }
		}
		s.depth += (target - s.depth) * Math.min(1, dt * (s.phase === 'breach' ? 6 : 0.6));
		s.a += dt * speed / R;
		const x = cx + Math.cos(s.a) * R, z = cz + Math.sin(s.a) * R;
		// head along the tangent of the loop
		const tx = -Math.sin(s.a), tz = Math.cos(s.a);
		s.heading = Math.atan2(-tx, -tz);
		const surf = waveHeight(island, x, z, t, wave);
		whale.position.set(x, surf + s.depth, z);
		whale.rotation.set(0, 0, 0);
		whale.rotateY(s.heading);
		whale.rotateX(pitchUp);
		whale.rotateZ(roll);
		s.beat += dt * (1.1 + speed * 0.15);
		uniforms.uBeat.value = s.beat;
		uniforms.uAmp.value = s.phase === 'surface' && s.t > 17 ? 0.55 : 0.28;
		whale.visible = s.depth > -30;

		for (let i = 0; i < M; i++) {
			const p = mistV[i];
			p.t += dt;
			if (p.t > 2.5) { mist[i * 3 + 1] = -999; continue; }
			p.vy -= 3.5 * dt; p.vx *= 0.98; p.vz *= 0.98;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			mist[i * 3] = p.x; mist[i * 3 + 1] = p.y; mist[i * 3 + 2] = p.z;
		}
		mg.attributes.position.needsUpdate = true;
		mm.opacity = 0.7;
	}
	return { whale, update, state: s };
}
