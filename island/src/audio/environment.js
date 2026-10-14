// The places' own air, layered over the city's and the wild's sound (citysound.js,
// naturesound.js) and the weather's (world/weather.js):
//   the air rushing past as you go fast: a broad rush and a thin whistle that rise with your
//     speed (dull and low inside a car); none in space (soundbus.js's air)
//   a freeway's roar from its side, swelling as the traffic passes, louder by day
//   a downtown's air handling (the faceplate's city hum, palette.js); a mower or a leaf blower
//     far off in the suburbs on a fine day
//   a desert's thin high wind and its low gusts; the dark hush of wind over snow; the canopy's
//     rustle in the woods
//   the rain on what is round you: leaves, the street, the car's roof, a roof over you, the
//     water, sand and grass (each a texture of drops baked once, cross-faded as you move)
//   now and then a raven over the snow and the high ground, a dove's coo at dusk in the desert
// Each bed is made when wanted and let go a few seconds after it falls silent.

import { soundBus, noise } from '../world/soundbus.js';
import { cityHum } from './palette.js';
import { PHONE } from './engines.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAXV = PHONE ? 2 : 4;          // one-shots at once

// ---------- the rain's textures: a loop of drops for each kind of surface ----------
// density (drops/s), and how one drop sounds
const DROPS = {
	leaves: { n: 150, f: [1500, 5000], dec: [0.006, 0.014], noise: 0.6, lp: 0.5, lv: 0.5 },
	street: { n: 230, f: [800, 4000], dec: [0.003, 0.008], noise: 0.9, lp: 0.2, lv: 0.6 },
	metal: { n: 95, f: [2500, 6000], dec: [0.02, 0.035], noise: 0.25, lp: 0, lv: 0.55, thump: 0.3 },
	roof: { n: 70, f: [120, 400], dec: [0.02, 0.04], noise: 0.1, lp: 0.85, lv: 0.9 },
	water: { n: 60, f: [700, 1700], dec: [0.012, 0.025], noise: 0.15, lp: 0, lv: 0.45, chirp: true },
	soft: { n: 170, f: [400, 1500], dec: [0.002, 0.005], noise: 1, lp: 0.7, lv: 0.35 },
};
const textures = new WeakMap();
function bake(ctx, kind) {
	let m = textures.get(ctx);
	if (!m) textures.set(ctx, m = {});
	if (m[kind]) return m[kind];
	const D = DROPS[kind], sr = ctx.sampleRate, secs = PHONE ? 1 : 2, len = Math.floor(sr * secs), d = new Float32Array(len);
	let seed = 7 + kind.length * 31;
	const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) | 0, (seed >>> 0) / 4294967296);
	const count = Math.floor(D.n * secs * (PHONE ? 0.7 : 1));
	for (let k = 0; k < count; k++) {
		const at = Math.floor(rnd() * len), f = D.f[0] + rnd() * (D.f[1] - D.f[0]), dec = D.dec[0] + rnd() * (D.dec[1] - D.dec[0]), a = (0.3 + rnd() * 0.7) * D.lv;
		const n = Math.floor(dec * 5 * sr);
		let lp = 0;
		for (let i = 0; i < n; i++) {
			const t = i / sr, env = Math.exp(-t / dec), w = D.chirp ? 2 * Math.PI * f * t * (1 + t / dec * 0.6) : 2 * Math.PI * f * t;
			let s = Math.sin(w) * (1 - D.noise) + (rnd() * 2 - 1) * D.noise;
			if (D.thump && k % 3 === 0) s += Math.sin(2 * Math.PI * 150 * t) * D.thump;
			lp += (s - lp) * (1 - D.lp);
			d[(at + i) % len] += lp * env * a;       // (wrapped round: the loop has no seam)
		}
	}
	let pk = 0;
	for (const v of d) pk = Math.max(pk, Math.abs(v));
	const b = ctx.createBuffer(1, len, sr);
	b.getChannelData(0).set(pk > 0 ? d.map((v) => v / pk * 0.8) : d);
	return (m[kind] = b);
}

export function createEnvironment() {
	const beds = {}, T = {}, info = { beds: {}, rain: null, shots: 0, live: 0 };
	let ctx = null, out = null, shots = 0, swell = 0, roads = { t: 9, d: 1e9, pan: 0 };

	// ---------- beds ----------
	// a bed: { g, nodes, set(p) }; made in its own gain, into the world's bus
	function loopOf(nodes, colour, type, f, q, to) {
		const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
		s.buffer = noise(ctx, colour); s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
		s.connect(fl).connect(to); s.start(0, Math.random() * 3);
		nodes.push(s, fl);
		return { s, fl };
	}
	const MAKE = {
		air() {
			const g = ctx.createGain(), nodes = [g], rush = loopOf(nodes, 'pink', 'bandpass', 400, 0.5, g);
			const wg = ctx.createGain(); wg.gain.value = 0; wg.connect(g); nodes.push(wg);
			const wh = loopOf(nodes, 'pink', 'bandpass', 2000, 4, wg);
			return { g, nodes, set: (p, t) => { rush.fl.frequency.setTargetAtTime(p.f, t, 0.3); wh.fl.frequency.setTargetAtTime(p.f * 4.5, t, 0.5); wg.gain.setTargetAtTime(p.whistle, t, 0.4); } };
		},
		freeway() {
			const g = ctx.createGain(), p = ctx.createStereoPanner(), sw = ctx.createGain(), nodes = [g, p, sw];
			sw.gain.value = 0.7; sw.connect(p).connect(g);
			loopOf(nodes, 'brown', 'lowpass', 500, 0.6, sw);
			const tg = ctx.createGain(); tg.gain.value = 0.5; tg.connect(sw); nodes.push(tg);
			loopOf(nodes, 'pink', 'bandpass', 1100, 0.6, tg);
			return { g, nodes, set: (q, t) => { p.pan.setTargetAtTime(q.pan, t, 0.6); sw.gain.setTargetAtTime(q.sw, t, 0.8); } };
		},
		desert() {
			const g = ctx.createGain(), nodes = [g], gust = ctx.createGain();
			loopOf(nodes, 'pink', 'highpass', 2800, 0.5, g);
			gust.gain.value = 0; gust.connect(g); nodes.push(gust);
			loopOf(nodes, 'brown', 'lowpass', 220, 0.6, gust);
			return { g, nodes, set: (q, t) => gust.gain.setTargetAtTime(q.gust, t, 0.8) };
		},
		snow() {
			const g = ctx.createGain(), nodes = [g];
			loopOf(nodes, 'pink', 'lowpass', 450, 0.5, g);
			return { g, nodes };
		},
		canopy() {
			const g = ctx.createGain(), nodes = [g], l = loopOf(nodes, 'pink', 'bandpass', 2200, 0.4, g);
			return { g, nodes, set: (q, t) => l.fl.frequency.setTargetAtTime(q.f, t, 1.5) };
		},
		hum() {
			const g = ctx.createGain(), h = cityHum(ctx, g);
			h.g.gain.value = 1;
			return { g, nodes: [g], stopAlso: h };
		},
	};
	function bed(name, level, dt, p) {
		let b = beds[name];
		if (!b) b = beds[name] = { n: null, idle: 0, level: 0 };
		if (level > 3e-4 && !b.n) {
			b.n = MAKE[name]();
			b.n.g.gain.value = 0; b.n.g.connect(out);
			info.live += b.n.nodes.length;
		}
		b.level = level;
		if (!b.n) return;
		const t = ctx.currentTime;
		b.n.g.gain.setTargetAtTime(level, t, 0.8);
		if (p && b.n.set) b.n.set(p, t);
		if (level <= 3e-4) { b.idle += dt; if (b.idle > 5) drop(b); } else b.idle = 0;
	}
	function drop(b) {
		const n = b.n;
		b.n = null; b.idle = 0;
		info.live -= n.nodes.length;
		n.stopAlso?.stop(0.1);
		setTimeout(() => { for (const x of n.nodes) { try { x.stop?.(); } catch { /* stopped */ } try { x.disconnect(); } catch { /* gone */ } } }, 100);
	}

	// ---------- the rain on surfaces: two players, cross-faded ----------
	const rain = { kind: null, cur: null, idle: 0 };
	function rainOn(kind, level, dt) {
		const t = ctx.currentTime;
		if (level < 1e-3) {
			if (rain.cur) { rain.cur.g.gain.setTargetAtTime(0, t, 0.6); rain.idle += dt; if (rain.idle > 6) { stopPlayer(rain.cur, 0); rain.cur = null; rain.kind = null; } }
			return;
		}
		rain.idle = 0;
		if (kind !== rain.kind) {
			if (rain.cur) { rain.cur.g.gain.setTargetAtTime(0, t, 0.4); stopPlayer(rain.cur, 1.6); }
			const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
			s.buffer = bake(ctx, kind); s.loop = true; s.playbackRate.value = 0.94 + Math.random() * 0.12;
			g.gain.value = 0; p.pan.value = Math.random() * 0.3 - 0.15;
			s.connect(g).connect(p).connect(out); s.start(0, Math.random() * s.buffer.duration);
			rain.cur = { s, g, p }; rain.kind = kind;
			info.live += 3;
		}
		rain.cur.g.gain.setTargetAtTime(level, t, 0.5);
	}
	function stopPlayer(P, after) {
		info.live -= 3;
		setTimeout(() => { try { P.s.stop(); } catch { /* stopped */ } for (const x of [P.s, P.g, P.p]) try { x.disconnect(); } catch { /* gone */ } }, after * 1000 + 50);
	}

	// ---------- one-offs ----------
	function call(path, len, lv, pan, type = 'sine', lp = 0, delay = 0) {
		if (shots >= MAXV) return;
		const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(), list = [o, g, p];
		o.type = type; o.frequency.setValueAtTime(path[0][1], t);
		for (let i = 1; i < path.length; i++) o.frequency.exponentialRampToValueAtTime(path[i][1], t + path[i][0] * len);
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + Math.min(0.03, len * 0.2)); g.gain.setValueAtTime(lv, t + len * 0.6); g.gain.linearRampToValueAtTime(0, t + len);
		p.pan.value = pan;
		let head = o;
		if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); head = f; list.push(f); }
		head.connect(g).connect(p).connect(out); o.start(t); o.stop(t + len + 0.02);
		shots++;
		o.onended = () => { shots--; for (const x of list) try { x.disconnect(); } catch { /* gone */ } };
	}
	// a mower or a blower, far off: a buzz and its noise, coming and going over several seconds
	function machine(lv, pan) {
		if (shots >= MAXV) return;
		const t = ctx.currentTime, len = 6 + Math.random() * 8, o = ctx.createOscillator(), wob = ctx.createOscillator(), wd = ctx.createGain();
		const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
		const blower = Math.random() < 0.4;
		o.type = 'sawtooth'; o.frequency.value = blower ? 190 : 95; wob.frequency.value = 0.4 + Math.random() * 0.5; wd.gain.value = blower ? 12 : 4;
		wob.connect(wd).connect(o.frequency);
		n.buffer = noise(ctx, 'pink'); n.loop = true; bp.type = 'bandpass'; bp.frequency.value = blower ? 2200 : 1100; bp.Q.value = 0.8; ng.gain.value = blower ? 1.4 : 0.5;
		lp.type = 'lowpass'; lp.frequency.value = 900; p.pan.value = pan;
		o.connect(lp); n.connect(bp).connect(ng).connect(lp); lp.connect(g).connect(p).connect(out);
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + len * 0.3); g.gain.setValueAtTime(lv, t + len * 0.7); g.gain.linearRampToValueAtTime(0, t + len);
		o.start(t); wob.start(t); n.start(t, Math.random() * 3);
		for (const x of [o, wob, n]) x.stop(t + len + 0.05);
		shots++;
		o.onended = () => { shots--; for (const x of [o, wob, wd, n, bp, ng, lp, g, p]) try { x.disconnect(); } catch { /* gone */ } };
	}
	const every = (key, dt, mean) => { T[key] = (T[key] ?? Math.random() * mean) - dt; if (T[key] > 0) return false; T[key] = mean * (0.4 + Math.random() * 1.2); return true; };
	const rnd = (a) => (Math.random() * 2 - 1) * a;

	// o: { W, cam, sense (sensing's state), planet, rain, hours, under, indoor, cabin
	// (in a vehicle's seat), speed (how fast the ears move), alt (above the ground) }
	function update(dt, o) {
		const B = soundBus();
		if (!B) return info;
		if (ctx !== B.ctx || out !== B.out) {
			// a new context: everything made again in it
			for (const b of Object.values(beds)) if (b.n) drop(b);
			if (rain.cur) { stopPlayer(rain.cur, 0); rain.cur = null; rain.kind = null; }
			ctx = B.ctx; out = B.out;
		}
		const S = o.sense || {}, P = S.place || { kind: 'wild' }, k = P.kind, surf = S.surface;
		const planet = o.planet, under = o.under ? 0 : 1, inside = !!o.indoor, h = o.hours ?? 12;
		const day = h > 6.5 && h < 19.5, high = Math.max(0, 1 - Math.max(0, (o.alt || 0) - 40) / 120);
		// the air rushing past
		const v = o.speed || 0, rush = Math.pow(clamp((v - 6) / 60, 0, 1.4), 1.5);
		bed('air', 0.16 * rush * under * (o.cabin ? 0.3 : 1), dt, { f: o.cabin ? 260 + v * 3 : 320 + v * 10, whistle: o.cabin ? 0 : 0.12 * clamp((v - 25) / 60, 0, 1) });
		// a freeway near: looked for once a second and a half
		roads.t += dt;
		if (roads.t > 1.5) {
			roads.t = 0; roads.d = 1e9;
			const R = o.W?.real, c = o.cam.position;
			if (R?.loaded?.() && high > 0) {
				try {
					for (const r of R.near('roads', c.x, c.z, 450)) {
						if (r.cls !== 'motorway' && r.cls !== 'trunk') continue;
						const p = r.pts;
						for (let i = 0; i + 3 < p.length; i += 2) {
							const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L2 = dx * dx + dz * dz || 1;
							const u = clamp(((c.x - ax) * dx + (c.z - az) * dz) / L2, 0, 1), qx = ax + dx * u - c.x, qz = az + dz * u - c.z, d = Math.hypot(qx, qz);
							if (d < roads.d) { roads.d = d; const e = o.cam.matrixWorld.elements, rl = Math.hypot(e[0], e[2]) || 1; roads.pan = d > 1 ? clamp((qx * e[0] + qz * e[2]) / rl / d, -0.8, 0.8) : 0; }
						}
					}
				} catch { roads.d = 1e9; }
			}
		}
		swell += dt;
		const sw = 0.55 + 0.25 * Math.sin(swell * 0.8) + 0.2 * Math.sin(swell * 2.3 + 1);
		bed('freeway', 0.1 * (day ? 1 : 0.45) / (1 + (roads.d / 70) ** 2) * high * under * (inside ? 0.35 : 1), dt, { pan: roads.pan, sw });
		// a downtown's air handling
		bed('hum', (k === 'downtown' ? 0.025 : k === 'offices' || k === 'mainstreet' ? 0.012 : 0) * (0.5 + 0.5 * (P.busy || 0)) * under * high * (inside ? 0.4 : 1), dt);
		// the desert, the snow, the woods
		const desert = planet === 'ARID' || S.why === 'desert';
		const snow = !inside && (surf === 'snow' || planet === 'ICE');
		const woods = !inside && !planet && k === 'wild' && (surf === 'grass' || surf === 'dirt') && !desert && !snow;
		bed('desert', desert && !inside ? 0.02 * (day ? 1 : 0.5) * under : 0, dt, { gust: 0.4 + 0.4 * Math.sin(swell * 0.21) * Math.sin(swell * 0.13 + 2) });
		bed('snow', snow ? 0.028 * under * high : 0, dt);
		bed('canopy', woods && (o.rain || 0) < 0.3 ? 0.009 * under * high : 0, dt, { f: 1800 + 600 * Math.sin(swell * 0.17) });
		// the rain on what is round you
		const r = (o.rain || 0) * under;
		const kind = o.cabin ? 'metal' : inside ? 'roof' : surf === 'water' ? 'water' : surf === 'road' || surf === 'concrete' || surf === 'stone' || surf === 'metal' || surf === 'wood' ? 'street' : woods || surf === 'grass' ? 'leaves' : 'soft';
		rainOn(kind, r * (o.cabin ? 0.16 : inside ? 0.1 : kind === 'soft' ? 0.05 : 0.08), dt);
		info.rain = r > 0.001 ? kind : null;
		// the suburbs' machines, the high ground's ravens, the desert's doves
		if (k === 'suburb' && day && h > 9 && h < 18 && r < 0.05 && !inside && every('machine', dt, 70)) machine(0.006 * under, rnd(0.9));
		if ((snow || S.why === 'summit') && day && every('raven', dt, 28)) { const pn = rnd(0.9), n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) call([[0, 420], [0.4, 380], [1, 300]], 0.22, 0.008 * under, pn, 'sawtooth', 1200, i * 0.42); }
		if (desert && (Math.abs(h - 7) < 1.2 || Math.abs(h - 19) < 1.2) && every('dove', dt, 20)) { const pn = rnd(0.8); call([[0, 520], [0.5, 610], [1, 480]], 0.35, 0.007 * under, pn, 'sine', 0, 0); call([[0, 480], [1, 440]], 0.5, 0.006 * under, pn, 'sine', 0, 0.55); call([[0, 470], [1, 430]], 0.45, 0.005 * under, pn, 'sine', 0, 1.2); }
		for (const [n, b] of Object.entries(beds)) info.beds[n] = b.n ? +b.level.toFixed(4) : 0;
		info.shots = shots;
		return info;
	}
	return { update, info };
}
