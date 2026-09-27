// The sound of the wild Bay Area, synthesised live into the Bard's master output (as the
// city's sound is, citysound.js), for the open country the towns don't cover:
//   crickets on warm nights, fading in the fog; a great horned owl's soft hoots from the
//   oaks; coyotes yipping far off now and then
//   Pacific chorus frogs' "rib-bit" by the ponds and lakes after dark in the wet months,
//   bullfrogs' low "jug-o-rum" in summer
//   a western meadowlark's falling whistle over the grass by day, California quail calling
//   "chi-CA-go" in the mornings
//   the surf's roar and hiss along the ocean shore, and sea lions barking at Pier 39 and
//   Año Nuevo
// (the naturalist's list: who calls when is from nature/fieldguide.js)

import { toWorld } from './geo.js';

const SEA_LIONS = [toWorld(37.8087, -122.4098), toWorld(37.1080, -122.3370)];

export function createNatureSound(bay, groundAt) {
	let ctx = null, A = null;
	let hush = 0;                     // 0..1: the night falling silent (people/ghost.js)
	let tCricket = 0, tOwl = 8, tCoyote = 40, tFrog = 0, tBird = 3, tQuail = 10, tLion = 2;

	function setup() {
		const bus = window._masterClip || window.leadBus227;
		const c = bus && bus.context;
		if (!c || c.state !== 'running') return false;
		if (ctx === c && A) return true;
		ctx = c;
		const master = ctx.createGain(); master.gain.value = 0; master.connect(bus);
		// the surf: brown noise, low-passed, swelling with each wave
		const b = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), d = b.getChannelData(0);
		let last = 0;
		for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
		const s = ctx.createBufferSource(); s.buffer = b; s.loop = true;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
		const sg = ctx.createGain(); sg.gain.value = 0;
		s.connect(lp).connect(sg).connect(master); s.start();
		A = { master, surf: { lp, g: sg } };
		return true;
	}
	const pan = (v) => { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(A.master); return p; };
	function tone(type, f0, f1, t0, len, level, dest, attack = 0.02) {
		const o = ctx.createOscillator(), g = ctx.createGain();
		o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + len);
		g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
		o.connect(g).connect(dest); o.start(t0); o.stop(t0 + len + 0.05);
	}
	function cricket(level) {
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6), f = 4200 + Math.random() * 500;
		for (let k = 0; k < 3; k++) tone('sine', f, f, t + k * 0.05, 0.03, level, p, 0.008);
	}
	function owl(level) {
		// who, who-who, whooo: soft low hoots
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.4);
		[[0, 0.35], [0.55, 0.16], [0.75, 0.16], [1.0, 0.5]].forEach(([at, len]) => tone('sine', 370, 330, t + at, len, level, p, 0.05));
	}
	function coyote(level) {
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.8);
		for (let k = 0; k < 5; k++) { const f = 650 + Math.random() * 500; tone('triangle', f, f * (k % 2 ? 1.5 : 0.7), t + k * 0.22 + Math.random() * 0.1, 0.25, level, p, 0.03); }
		tone('triangle', 700, 1100, t + 1.3, 1.1, level * 0.8, p, 0.2);
	}
	function chorusFrog(level) {
		// "rib-bit": two short buzzy notes, the second rising
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6), f = 1500 + Math.random() * 300;
		tone('sawtooth', f, f * 0.95, t, 0.08, level, p, 0.01); tone('sawtooth', f * 0.95, f * 1.15, t + 0.13, 0.1, level, p, 0.01);
	}
	function bullfrog(level) {
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.4);
		tone('sawtooth', 120, 95, t, 0.5, level, p, 0.05); tone('sawtooth', 110, 90, t + 0.6, 0.6, level * 0.9, p, 0.05);
	}
	function meadowlark(level) {
		// a flute-like tumble of falling whistles
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6);
		[[0, 2600, 2300, 0.18], [0.22, 3000, 2500, 0.12], [0.38, 2400, 2000, 0.1], [0.52, 2800, 2200, 0.1], [0.66, 2200, 1700, 0.22]].forEach(([at, a, b, len]) => tone('sine', a, b, t + at, len, level, p, 0.02));
	}
	function quail(level) {
		// "chi-CA-go"
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6);
		tone('sine', 1700, 1900, t, 0.12, level * 0.8, p, 0.02); tone('sine', 2300, 2600, t + 0.16, 0.18, level, p, 0.02); tone('sine', 2100, 1600, t + 0.38, 0.2, level * 0.8, p, 0.02);
	}
	function seaLion(level, pn) {
		const t = ctx.currentTime, p = pan(pn);
		for (let k = 0; k < 3; k++) tone('sawtooth', 320 + Math.random() * 80, 240, t + k * 0.35, 0.22, level, p, 0.02);
	}
	const ease = (param, v, tc = 0.4) => param.setTargetAtTime(v, ctx.currentTime, tc);

	// o: { night, hours, month, fog, under, islandHalf, pond (distance to still water, m), town (0..1) }
	function update(dt, cam, o) {
		if (!setup() || !bay.loaded()) return;
		const x = cam.position.x, z = cam.position.z, alt = cam.position.y - groundAt(x, z);
		const onIsland = Math.max(Math.abs(x), Math.abs(z)) < (o.islandHalf || 0);
		const near = Math.max(0, 1 - Math.max(0, alt - 3) / 150) * (o.under || onIsland ? 0 : 1);
		ease(A.master.gain, near > 0.01 ? 1 - hush * 0.95 : 0, hush > 0 ? 0.3 : 0.8);
		if (near <= 0.01) return;
		const wild = near * (1 - Math.min(1, o.town || 0) * 0.8), h = o.hours, m = o.month, night = o.night;
		// the surf: how close the open ocean's shore is (sampled in a ring)
		let shore = 0;
		for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; for (const r of [40, 120, 260]) if (groundAt(x + Math.cos(a) * r, z + Math.sin(a) * r) < -1.5 && x < 26000) { shore = Math.max(shore, 1 - r / 320); break; } }
		const swell = 0.6 + 0.4 * Math.sin(performance.now() / 1000 * 0.55) ** 2;
		ease(A.surf.g.gain, 0.09 * shore * swell * near, 0.3);
		ease(A.surf.lp.frequency, 380 + swell * 700, 0.3);
		// crickets on warm nights (fewer in the fog, none in the cold wet months)
		const warm = [0, 0, 0.1, 0.3, 0.6, 0.9, 1, 1, 1, 0.8, 0.3, 0][m - 1];
		tCricket -= dt;
		if (tCricket < 0) { tCricket = 0.25 + Math.random() * 0.7; if (night > 0.6) cricket(0.006 * wild * warm * (1 - (o.fog || 0) * 0.7)); }
		tOwl -= dt;
		if (tOwl < 0) { tOwl = 14 + Math.random() * 30; if (night > 0.7) owl(0.03 * wild); }
		tCoyote -= dt;
		if (tCoyote < 0) { tCoyote = 70 + Math.random() * 120; if (night > 0.7 && Math.random() < 0.6) coyote(0.012 * wild); }
		// frogs by still water after dark: chorus frogs in the wet months, bullfrogs in summer
		const byPond = Math.max(0, 1 - (o.pond ?? 1e9) / 120);
		tFrog -= dt;
		if (tFrog < 0) {
			tFrog = 0.3 + Math.random() * 0.8;
			if (night > 0.5 && byPond > 0) {
				if ([11, 12, 1, 2, 3, 4].includes(m)) chorusFrog(0.02 * byPond * near);
				else if ([5, 6, 7, 8, 9].includes(m) && Math.random() < 0.25) bullfrog(0.035 * byPond * near);
			}
		}
		// birdsong over the open grass by day
		tBird -= dt;
		if (tBird < 0) { tBird = 5 + Math.random() * 12; if (night < 0.3 && h > 6 && h < 18) meadowlark(0.018 * wild); }
		tQuail -= dt;
		if (tQuail < 0) { tQuail = 12 + Math.random() * 25; if (h > 6 && h < 10.5) quail(0.02 * wild); }
		// sea lions
		tLion -= dt;
		if (tLion < 0) {
			tLion = 1.5 + Math.random() * 3;
			for (const L of SEA_LIONS) { const d = Math.hypot(L.x - x, L.z - z); if (d < 700) seaLion(0.05 * (1 - d / 700) * near, Math.max(-0.8, Math.min(0.8, (L.x - x) / (d + 30)))); }
		}
	}
	return { update, hush: (k) => { hush = k; } };
}
