// Weather that keeps pace with the clock. A slow, seeded rhythm over the days turns the
// sky from clear to fair-weather cumulus, to passing showers, now and then to a storm;
// cirrus comes and goes on its own. Showers are real places: cells of rain a kilometre
// or two across, born upwind and carried over the land by the wind, darkening the
// clouds above them, trailing curtains of rain beneath, raining on you when they pass
// over. Everything answers to the one wind (main.js stepWind: speed, gusts, veer): the
// clouds drift with it (the cirrus faster, aloft), the rain slants in it, the trees and
// grass bend in it, the birds drift down it. After a shower the ground stays wet a while.
// Where there is sunlit rain opposite the sun there is a rainbow (sky.js, rainbow.js),
// and by the full moon, a faint moonbow. In a storm, lightning: the flash, the bolt in
// the sky toward its cell, the thunder after the distance's delay.
//
// The settings panel sets it: Weather (auto, or pinned to clear / fair / showers /
// storm), and Rain; moving Cloud cover or Wind pins those.

import * as THREE from 'three';
import { BOW, loadBowTexture } from './rainbow.js';

const H_CLOUD = 1500;                  // cumulus base, metres above you
const MODES = { clear: [0.05, 0.0, 0.2, 0], fair: [0.45, 0.0, 0.45, 0], showers: [0.62, 0.55, 0.6, 0.1], storm: [0.9, 1.0, 1.1, 1] };   // cover, showers, wind, storm

// smooth seeded noise over one number (the weather's time, in days)
const hh = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const n1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hh(i) * (1 - u) + hh(i + 1) * u; };
const ease = (v, t, k) => v + (t - v) * Math.min(1, k);

export function createWeather(scene, shared, { isPhone = false } = {}) {
	const U = {
		uCloudOff: { value: new THREE.Vector2() }, uCirrusOff: { value: new THREE.Vector2() }, uCirrus: { value: 0.3 },
		uShowers: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) }, uRainHere: { value: 0 }, uGloom: { value: 0 },
		uFlash: { value: 0 }, uBolt: { value: new THREE.Vector4(0, 0, 0, 99) },
		uBow: { value: loadBowTexture() }, uBowK: { value: 0 }, uBowDrop: { value: 0.6 }, uMoonBowK: { value: 0 },
	};
	shared.uWet = shared.uWet || { value: 0 };
	const S = {
		mode: 'auto', pin: {}, day: 0, lastHours: null,
		cover: 0.5, showerRate: 0, storm: 0, windT: 0.5, cirrus: 0.3,
		cells: [], rainHere: 0, drop: 0.5, sunVis: 1, moonVis: 1, flash: 0, bolts: [], nextStrike: 5, sheltered: false,
	};

	// ---------------------------------------------------------------------------
	// rain: streaks in a box round you, falling at their own speed (big drops faster),
	// slanting with the wind, as many as the rain is heavy

	const N = isPhone ? 4000 : 12000;
	const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
	const g = new THREE.InstancedBufferGeometry();
	g.index = quad.index; g.attributes.position = quad.attributes.position;
	const seeds = new Float32Array(N * 4);
	for (let i = 0; i < N; i++) { seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random(); seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = i / N; }
	g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
	g.instanceCount = N;
	const rainU = { uRain: { value: 0 }, uWindV: { value: new THREE.Vector3() }, uTime: shared.uTime, uSkyCol: { value: new THREE.Color() }, uFlashR: U.uFlash, uCap: { value: 1 }, uWindOff: { value: new THREE.Vector3() } };
	const rainMat = new THREE.ShaderMaterial({
		uniforms: rainU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
		vertexShader: /* glsl */`
			attribute vec4 aSeed; uniform float uRain, uTime, uCap; uniform vec3 uWindV, uWindOff; varying float vA; varying float vV;
			void main(){
				vV = position.y;
				// the rain falls only as heavily as it rains: the rest of the drops are parked
				if (aSeed.w > uRain * uCap) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
				float big = aSeed.z;
				vec3 v = vec3(uWindV.x, -(4.2 + big * 5.0), uWindV.z) * (0.85 + big * 0.3);
				vec3 box = vec3(36.0, 22.0, 36.0);
				vec3 p0 = vec3(aSeed.x, aSeed.y, fract(aSeed.x * 7.13 + aSeed.y * 3.7)) * box;
				// (the fall at each drop's own speed; the drift is summed on the CPU, so a gust
				// bends the rain without throwing the drops about)
				vec3 travel = vec3(uWindOff.x, -(4.2 + big * 5.0) * uTime, uWindOff.z) * (0.85 + big * 0.3);
				vec3 p = mod(p0 + travel - cameraPosition + box * 0.5, box) - box * 0.5 + cameraPosition;
				// a streak: the drop's path over a frame and a bit, a quad turned to face you
				vec3 dir = normalize(v), toCam = normalize(cameraPosition - p);
				vec3 side = normalize(cross(dir, toCam)) * (0.009 + big * 0.01) * (1.0 + length(p - cameraPosition) * 0.08);
				float len = length(v) * 0.028;
				vec3 w = p - dir * len * position.y + side * position.x;
				float dist = length(p - cameraPosition);
				vA = smoothstep(0.4, 1.5, dist) * (1.0 - smoothstep(10.0, 18.0, dist)) * (0.45 + big * 0.45) / (1.0 + dist * 0.08);
				gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uSkyCol; uniform float uFlashR; varying float vA; varying float vV;
			void main(){
				float a = vA * sin(vV * 3.1416);
				if (a < 0.01) discard;
				gl_FragColor = vec4(mix(uSkyCol * 1.4 + 0.12, vec3(1.0), uFlashR * 0.6), a * 0.7);
				#include <colorspace_fragment>
			}`,
	});
	const rain = new THREE.Mesh(g, rainMat);
	rain.frustumCulled = false;
	rain.renderOrder = 5;
	scene.add(rain);

	// ---------------------------------------------------------------------------
	// birds: a loose flock that wheels about you on the wind (separation, alignment,
	// cohesion, a pull back toward you), drifting downwind, down to shelter in the rain

	const NB = isPhone ? 18 : 32;
	const bg = new THREE.BufferGeometry();
	bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0.04, 0.01, -0.12, -0.04, 0.01, -0.12, 0.03, 0, 0.05, 0.36, 0.02, -0.06, 0.03, 0, -0.07, -0.03, 0, 0.05, -0.03, 0, -0.07, -0.36, 0.02, -0.06], 3));
	bg.setAttribute('aWing', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 1], 1));
	bg.computeVertexNormals();
	const birdMat = new THREE.MeshLambertMaterial({ color: 0x1c1d20, side: THREE.DoubleSide });
	birdMat.onBeforeCompile = (sh) => {
		sh.uniforms.uTime = shared.uTime;
		sh.vertexShader = 'attribute float aWing; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
			float ph = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
			transformed.y += aWing * sin(uTime * 13.0 + ph) * 0.9 * abs(transformed.x) * step(0.5, fract(uTime * 0.21 + ph * 0.1) + 0.35);`);
	};
	birdMat.customProgramCacheKey = () => 'weather-birds';
	const birds = new THREE.InstancedMesh(bg, birdMat, NB);
	birds.frustumCulled = false;
	scene.add(birds);
	const B = [...Array(NB)].map(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6), placed: false }));
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1.4, 1.4, 1.4), tmp = new THREE.Vector3(), acc = new THREE.Vector3();
	let flockC = new THREE.Vector3();
	function stepBirds(dt, cam, wind, groundAt) {
		const show = S.rainHere < 0.45 && cam.position.y - groundAt(cam.position.x, cam.position.z) < 300;
		birds.visible = show;
		if (!show) { for (const b of B) b.placed = false; return; }
		// the flock's home: ahead of you, 40-70 m up, and it slides downwind
		flockC.lerp(tmp.set(cam.position.x, groundAt(cam.position.x, cam.position.z) + 45, cam.position.z), Math.min(1, dt * 0.05));
		let i = 0;
		for (const b of B) {
			if (!b.placed) { b.p.set(flockC.x + (Math.random() - 0.5) * 30, flockC.y + (Math.random() - 0.5) * 8, flockC.z + (Math.random() - 0.5) * 30); b.placed = true; }
			acc.set(0, 0, 0);
			let n = 0; const al = new THREE.Vector3(), co = new THREE.Vector3();
			for (const o of B) {
				if (o === b) continue;
				const d = b.p.distanceTo(o.p);
				if (d < 12) { al.add(o.v); co.add(o.p); n++; }
				if (d < 2.2 && d > 1e-3) acc.addScaledVector(tmp.copy(b.p).sub(o.p), 2.2 / (d * d));          // separation
			}
			if (n) { acc.addScaledVector(al.divideScalar(n).sub(b.v), 0.6); acc.addScaledVector(co.divideScalar(n).sub(b.p), 0.25); }
			// home, and a floor above the ground
			acc.addScaledVector(tmp.copy(flockC).sub(b.p), 0.012);
			const gy = groundAt(b.p.x, b.p.z);
			if (b.p.y < gy + 15) acc.y += (gy + 15 - b.p.y) * 0.4;
			// the wind carries them; they fly on it rather than into it
			acc.x += wind.x * 0.25; acc.z += wind.z * 0.25;
			b.v.addScaledVector(acc, dt);
			const sp = b.v.length(), want = THREE.MathUtils.clamp(sp, 6, 13);
			b.v.multiplyScalar(want / Math.max(sp, 1e-3));
			b.v.y *= 0.9;
			b.p.addScaledVector(b.v, dt);
			if (b.p.distanceTo(cam.position) > 260) b.placed = false;
			e.set(-Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)), Math.atan2(b.v.x, b.v.z), -THREE.MathUtils.clamp(acc.x * 0.02, -0.6, 0.6));
			birds.setMatrixAt(i++, m4.compose(b.p, q.setFromEuler(e), one));
		}
		birds.instanceMatrix.needsUpdate = true;
	}

	// ---------------------------------------------------------------------------
	// sound: rain on everything, and thunder (a context of its own, woken by the
	// first touch or key)

	let ac = null, rainGain = null, rainLP = null;
	const wake = () => {
		if (ac) return;
		try {
			ac = new (window.AudioContext || window.webkitAudioContext)();
			const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
			let b0 = 0, b1 = 0, b2 = 0;
			for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
			const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
			rainLP = ac.createBiquadFilter(); rainLP.type = 'lowpass'; rainLP.frequency.value = 5000;
			const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
			rainGain = ac.createGain(); rainGain.gain.value = 0;
			src.connect(hp).connect(rainLP).connect(rainGain).connect(ac.destination);
			src.start();
		} catch { ac = null; }
	};
	for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { once: true, passive: true });
	function thunder(dist, big) {
		if (!ac || ac.state !== 'running') return;
		const t0 = ac.currentTime + dist / 343, dur = 2.5 + big * 3 + dist / 3000;
		const len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
		let b = 0;
		for (let i = 0; i < len; i++) {
			const t = i / ac.sampleRate, env = Math.min(1, t * 20) * Math.exp(-t / (dur * 0.35)) * (0.6 + 0.4 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 3));
			b = b * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = b * env * (i < ac.sampleRate * 0.08 && dist < 1500 ? 3 : 1);
		}
		const src = ac.createBufferSource(); src.buffer = buf;
		const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 - Math.min(700, dist / 12);
		const gn = ac.createGain(); gn.gain.value = Math.min(1, 1600 / (dist + 400)) * (0.6 + big * 0.4);
		src.connect(lp).connect(gn).connect(ac.destination);
		src.start(t0);
	}

	// ---------------------------------------------------------------------------

	const windV = new THREE.Vector3();
	function update(dt, sky, cam, groundAt, opts = {}) {
		dt = Math.min(dt, 0.1);
		const hours = sky.state.hours;
		if (S.lastHours !== null && hours < S.lastHours - 12) S.day++;
		S.lastHours = hours;
		const wt = S.day + hours / 24;                     // the weather's clock, in days
		// what the day wants: unsettledness wanders over hours; cirrus on its own rhythm
		let tgt;
		if (S.mode === 'auto') {
			const u = n1(wt * 5.3) * 0.7 + n1(wt * 17.1 + 9) * 0.3;
			const cover = THREE.MathUtils.clamp(0.15 + u * 0.9, 0.05, 0.95);
			const show = THREE.MathUtils.smoothstep(u, 0.55, 0.8), storm = THREE.MathUtils.smoothstep(u, 0.8, 0.92);
			tgt = [cover, show, 0.25 + u * 0.8, storm];
		} else tgt = MODES[S.mode];
		const k = dt * 0.05;
		S.cover = ease(S.cover, S.pin.cover ?? tgt[0], k);
		S.showerRate = ease(S.showerRate, tgt[1], k);
		S.storm = ease(S.storm, tgt[3], k);
		S.cirrus = ease(S.cirrus, S.mode === 'auto' ? THREE.MathUtils.smoothstep(n1(wt * 3.1 + 40), 0.35, 0.8) : S.mode === 'fair' ? 0.5 : 0.2, k);
		if (S.pin.wind === undefined) shared.uWind.value = ease(shared.uWind.value, tgt[2], dt * 0.03);
		const W = shared.uWind.value + shared.uGust.value * 0.5, wd = shared.uWindDir.value;
		// the wind at cloud height, in m/s, and the drift of the cloud field (1 unit ~ 940 m)
		const cloudV = 4 + W * 14;
		windV.set(wd.x * cloudV, 0, wd.y * cloudV);
		U.uCloudOff.value.x += windV.x * dt / 940 * 3; U.uCloudOff.value.y += windV.z * dt / 940 * 3;
		U.uCirrusOff.value.x += windV.x * dt / 2600 * 5; U.uCirrusOff.value.y += windV.z * dt / 2600 * 5;
		U.uCirrus.value = S.cirrus;
		sky.uniforms.uCloud.value = S.cover;

		// showers: born upwind, carried over, grown and spent
		const px = cam.position.x, pz = cam.position.z;
		const manual = S.pin.rain;
		if (manual !== undefined) {
			// pinned rain: a shower that stays over you
			let c = S.cells.find((q2) => q2.pinned);
			if (!c && manual > 0.01) S.cells.push(c = { pinned: true, x: px, z: pz, r: 2200, I: 0, peak: manual, age: 0, life: 1e9 });
			if (c) { c.x = px - wd.x * 300; c.z = pz - wd.y * 300; c.peak = manual; if (manual <= 0.01) c.life = c.age + 30; }
		}
		const want = Math.round(S.showerRate * 4);
		if (S.cells.filter((c) => !c.pinned).length < want && Math.random() < dt * 0.05) {
			const up = 7000 + Math.random() * 6000, side = (Math.random() - 0.5) * 9000;
			S.cells.push({ x: px - wd.x * up - wd.y * side, z: pz - wd.y * up + wd.x * side, r: 900 + Math.random() * 1500, I: 0, peak: 0.45 + Math.random() * 0.55 * (0.6 + S.showerRate * 0.4), age: 0, life: 900 + Math.random() * 900 });
		}
		let here = 0, strongest = null;
		for (let i = S.cells.length - 1; i >= 0; i--) {
			const c = S.cells[i];
			c.age += dt;
			c.x += windV.x * dt * 2.2; c.z += windV.z * dt * 2.2;
			const grow = Math.min(1, c.age / (c.pinned ? 8 : 90)), die = Math.max(0, Math.min(1, (c.life - c.age) / 120));
			c.I = c.peak * grow * die * (0.8 + 0.2 * Math.sin(c.age * 0.05));
			const d = Math.hypot(c.x - px, c.z - pz);
			if (c.age > c.life || (!c.pinned && d > 30000)) { S.cells.splice(i, 1); continue; }
			here = Math.max(here, c.I * (1 - THREE.MathUtils.smoothstep(d, c.r * 0.55, c.r)));
			if (!strongest || c.I > strongest.I) strongest = c;
		}
		// the rain eases in and out; it is never on or off at once
		S.rainHere = ease(S.rainHere, here, dt * 0.35);
		U.uRainHere.value = S.rainHere;
		// drop size: heavy rain has big drops, the edges of a shower drizzle
		const rate = Math.max(S.rainHere, strongest?.I || 0);
		S.drop = ease(S.drop, 0.15 + rate * 0.85, dt * 0.2);
		const r0 = BOW.drops[0], r1 = BOW.drops[BOW.drops.length - 1];
		const lr = Math.log(S.drop / r0) / Math.log(r1 / r0);
		U.uBowDrop.value = (THREE.MathUtils.clamp(lr, 0, 1) * (BOW.drops.length - 1) + 0.5) / BOW.drops.length;
		const cells = [...S.cells].sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz)).slice(0, 4);
		U.uShowers.value.forEach((v, i) => { const c = cells[i]; if (c) v.set(c.x - px, c.z - pz, c.r, c.I); else v.set(0, 0, 1, 0); });

		// is the sun (or the moon) on the rain? not through a shower's cloud, nor overcast
		const sd = shared.uSunDir.value;
		const vis = (dir) => {
			if (dir.y <= 0.0) return 0;
			const reach = Math.min(25000, H_CLOUD / Math.max(0.02, dir.y) * Math.hypot(dir.x, dir.z));
			const hx = px + dir.x / Math.hypot(dir.x, dir.z) * reach, hz = pz + dir.z / Math.hypot(dir.x, dir.z) * reach;
			let v = 1 - THREE.MathUtils.smoothstep(S.cover, 0.6, 0.95);
			for (const c of S.cells) v *= 1 - THREE.MathUtils.smoothstep(-Math.hypot(c.x - hx, c.z - hz), -c.r * 1.5, -c.r * 0.9) * Math.min(1, c.I * 1.5);
			return v;
		};
		S.sunVis = ease(S.sunVis, vis(sd), dt * 0.5);
		S.moonVis = ease(S.moonVis, vis(tmp.copy(sd).negate()), dt * 0.5);
		const dayUp = THREE.MathUtils.smoothstep(sd.y, -0.02, 0.06), moonUp = THREE.MathUtils.smoothstep(-sd.y, 0.02, 0.1);
		U.uBowK.value = S.sunVis * dayUp;
		U.uMoonBowK.value = S.moonVis * moonUp;
		// overcast and storm darken the day
		S.gloom = Math.max(THREE.MathUtils.smoothstep(S.cover, 0.6, 1.0) * 0.8, S.storm * 0.85, S.rainHere * 0.6);
		U.uGloom.value = S.gloom;

		// lightning, in a storm or under the heaviest showers
		S.nextStrike -= dt;
		const stormy = opts.lightning !== false && (S.storm > 0.4 || (strongest && strongest.I > 0.85 && S.showerRate > 0.6));
		if (stormy && S.nextStrike <= 0 && strongest) {
			S.nextStrike = 4 + Math.random() * (18 - S.storm * 12);
			const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * strongest.r;
			const bx = strongest.x + Math.cos(a) * rr - px, bz = strongest.z + Math.sin(a) * rr - pz, dist = Math.hypot(bx, bz);
			S.bolts.push({ x: bx, z: bz, age: 0, seed: Math.random() * 100, big: Math.random() });
			thunder(dist, strongest.I);
		}
		let fl = 0;
		for (let i = S.bolts.length - 1; i >= 0; i--) {
			const b = S.bolts[i];
			b.age += b.hold ? 0 : dt;
			if (b.age > 0.9) { S.bolts.splice(i, 1); continue; }
			// the return strokes: a bright flash, then one or two re-strikes
			const f = Math.exp(-b.age * 14) + 0.7 * Math.exp(-Math.pow((b.age - 0.18) * 30, 2)) + 0.4 * Math.exp(-Math.pow((b.age - 0.4) * 30, 2));
			const near = Math.min(1, 3000 / (Math.hypot(b.x, b.z) + 500));
			fl = Math.max(fl, f * near);
			U.uBolt.value.set(Math.atan2(b.z, b.x), Math.hypot(b.x, b.z), b.seed, b.age);
		}
		if (!S.bolts.length) U.uBolt.value.w = 99;
		S.flash = fl;
		U.uFlash.value = fl;

		// the ground wets fast in rain and dries slowly after
		shared.uWet.value = THREE.MathUtils.clamp(shared.uWet.value + (S.rainHere > 0.05 ? S.rainHere * dt * 0.06 : -dt * (0.002 + 0.004 * S.sunVis * dayUp)), 0, 1);

		// the rain round you (not indoors), slanting in the wind at the ground
		const gw = 1.5 + W * 6;
		rainU.uWindV.value.set(wd.x * gw, 0, wd.y * gw);
		rainU.uWindOff.value.addScaledVector(rainU.uWindV.value, dt);
		rainU.uRain.value = S.sheltered ? 0 : S.rainHere;
		rainU.uSkyCol.value.copy(shared.uSkyHor.value);
		rain.visible = S.rainHere > 0.01 && !S.sheltered;
		// shed drops if frames get slow
		if (opts.slow) rainU.uCap.value = Math.max(0.35, rainU.uCap.value - dt * 0.2); else rainU.uCap.value = Math.min(1, rainU.uCap.value + dt * 0.05);
		if (rainGain) { rainGain.gain.value = ease(rainGain.gain.value, S.rainHere * (S.sheltered ? 0.35 : 0.55), dt * 2); rainLP.frequency.value = S.sheltered ? 900 : 5000; }
		stepBirds(dt, cam, windV, groundAt);
		return S;
	}
	const set = (mode) => { S.mode = mode; if (mode === 'auto') S.pin = {}; };
	const pin = (k, v) => { if (v === null) delete S.pin[k]; else S.pin[k] = v; };
	return { update, uniforms: U, state: S, set, pin, windV };
}
