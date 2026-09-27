// The sound of the wild Bay Area, synthesised live into the Bard's master output (as the
// city's sound is, citysound.js), for the open country the towns don't cover:
//   the Pacific surf: each wave in its own time, the long swell of the season, now and then
//   a set of bigger ones; the thump and roar of the break, the fizz of the foam running up
//   the sand, and the far breakers all along the beach behind it. The Bay's own shores
//   and the lakes only lap
//   crickets on warm nights, fading in the fog and the rain: field crickets each at their
//   own steady rate, snowy tree crickets chirping together, faster the warmer it is
//   (the fieldguide's Dolbear's law); a great horned owl's hoots from the oaks, a barn owl's
//   screech over the fields, coyotes yipping far off now and then
//   Pacific chorus frogs' "rib-bit" by the ponds and lakes after dark in the wet months,
//   bullfrogs' low "jug-o-rum" in summer
//   the dawn chorus, loudest in spring: robins, white-crowned sparrows, song sparrows,
//   mourning doves; through the day fewer, a western meadowlark's falling whistle over the
//   grass, scrub-jays scolding, California quail calling "chi-CA-go" in the mornings
//   western gulls along every shore by day, and sea lions barking at Pier 39 and Año Nuevo
//   indoors, all of it through the walls
// (the naturalist's list: who calls when is from nature/fieldguide.js)

import { toWorld, toLatLon } from './geo.js';
import { soundBus, noise } from '../world/soundbus.js';

const SEA_LIONS = [toWorld(37.8087, -122.4098), toWorld(37.1080, -122.3370)];
// the ridge of the peninsula and the Marin headlands, as longitude by latitude: water west
// of it is the open Pacific (surf), east of it the Bay (it only laps)
const SPINE = [[37.0, -121.9], [37.3, -122.2], [37.45, -122.33], [37.6, -122.42], [37.7, -122.44], [37.8, -122.475], [37.83, -122.52], [38.2, -122.52]];
function oceanSide(x, z) {
	const { lat, lon } = toLatLon(x, z);
	for (let i = 1; i < SPINE.length; i++) {
		const [a, la] = SPINE[i - 1], [b, lb] = SPINE[i];
		if (lat <= b || i === SPINE.length - 1) { const k = Math.max(0, Math.min(1, (lat - a) / (b - a))); return lon < la + (lb - la) * k; }
	}
	return false;
}

export function createNatureSound(bay, groundAt) {
	let ctx = null, A = null;
	let hush = 0;                     // 0..1: the night falling silent (people/ghost.js)
	let tOwl = 8, tBarn = 60, tCoyote = 40, tFrog = 0, tBird = 3, tQuail = 10, tLion = 2, tGull = 4, tLap = 1, tWave = 1, tScan = 0;
	let waveN = 0, setLeft = 0;
	// the shore round you, found a few times a second: how near the ocean and the Bay's
	// edge are (0..1), and which way the ocean lies
	const shore = { ocean: 0, bay: 0, ang: 0, oceanT: 0, bayT: 0 };
	// the crickets: a few field crickets, each on its own clock, and the tree crickets' one
	const field = [0, 1, 2].map(() => ({ f: 4500 + Math.random() * 500, pan: (Math.random() - 0.5) * 1.6, rate: 2 + Math.random() * 0.8, t: Math.random(), on: Math.random() }));
	const tree = { t: 0, pans: [-0.6, 0.1, 0.55].map((p) => p + (Math.random() - 0.5) * 0.2) };

	function setup() {
		const B = soundBus();
		if (!B) return false;
		if (ctx === B.ctx && A) return true;
		ctx = B.ctx;
		// everything goes through the walls when you are indoors: a low-pass, open outside
		const room = ctx.createBiquadFilter(); room.type = 'lowpass'; room.frequency.value = 18000; room.Q.value = 0.5; room.connect(B.out);
		const master = ctx.createGain(); master.gain.value = 0; master.connect(room);
		// the far breakers all along the beach: brown noise, low-passed, a steady roar
		const s = ctx.createBufferSource(); s.buffer = noise(ctx, 'brown'); s.loop = true;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450;
		const sg = ctx.createGain(); sg.gain.value = 0;
		s.connect(lp).connect(sg).connect(master); s.start(0, Math.random() * 3);
		// the surf's own panner: the waves come from the side the sea is on
		const surfPan = ctx.createStereoPanner(); surfPan.connect(master);
		A = { master, room, surfPan, bed: { lp, g: sg } };
		return true;
	}
	const pan = (v) => { const p = ctx.createStereoPanner(); p.pan.value = v; p.connect(A.master); return p; };
	// one note: a tone gliding through the given frequencies, [at (0..1 of len), Hz]
	function glide(type, fs, t0, len, level, dest, attack = 0.02) {
		if (!(level > 1e-4)) return;                  // (an exponential ramp to 0 throws)
		const o = ctx.createOscillator(), g = ctx.createGain();
		o.type = type; o.frequency.setValueAtTime(fs[0][1], t0);
		for (let i = 1; i < fs.length; i++) o.frequency.exponentialRampToValueAtTime(Math.max(20, fs[i][1]), t0 + fs[i][0] * len);
		g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
		o.connect(g).connect(dest); o.start(t0); o.stop(t0 + len + 0.05);
	}
	const tone = (type, f0, f1, t0, len, level, dest, attack) => glide(type, [[0, f0], [1, f1]], t0, len, level, dest, attack);
	// a burst of noise through a filter, with an envelope: [[at, gain], ...], at in seconds
	function hiss(colour, type, f, q, env, dest, t0, fEnd) {
		const s = ctx.createBufferSource(); s.buffer = noise(ctx, colour);
		const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f, t0);
		const end = env[env.length - 1][0];
		if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t0 + end);
		const g = ctx.createGain(); g.gain.setValueAtTime(0, t0);
		for (const [at, v] of env) g.gain.linearRampToValueAtTime(v, t0 + at);
		s.connect(fl).connect(g).connect(dest); s.start(t0, Math.random() * 3); s.stop(t0 + end + 0.05);
	}

	// ---------- the sea ----------
	// one wave breaking: the curl's thump, the roar of the white water, the foam's fizz
	// running up the beach and hissing back
	function wave(size, near) {
		const t = ctx.currentTime, L = 0.06 * size * near, bright = 500 + near * near * 3500;
		hiss('white', 'lowpass', bright, 0.3, [[0.25, L], [0.7, L * 0.7], [2.2, L * 0.25], [3.6, 0]], A.surfPan, t, 350);
		if (near > 0.35) hiss('brown', 'lowpass', 160, 0.7, [[0.18, L * 2.2], [0.6, L * 0.8], [1.6, 0]], A.surfPan, t);
		hiss('pink', 'bandpass', 2800, 0.5, [[0.9, 0], [1.8, L * 0.9 * near], [3.5, L * 0.5 * near], [6.5, 0]], A.surfPan, t, 5200);
	}
	// a small wave slapping at the edge of the Bay or a lake
	function lap(level) {
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.2);
		hiss('brown', 'bandpass', 380 + Math.random() * 300, 1.2, [[0.05, level * 2.5], [0.18, level], [0.5, 0]], p, t);
		hiss('white', 'bandpass', 1800 + Math.random() * 1500, 2, [[0.08, 0], [0.12, level * 0.3], [0.35, 0]], p, t);
		if (Math.random() < 0.25) tone('sine', 900, 420, t + 0.15, 0.06, level * 0.8, p, 0.005);
	}
	function scanShore(x, z, e) {
		// eight bearings, out to about a kilometre for the ocean (surf carries), close in for the Bay
		let ocean = 0, bayEdge = 0, ang = shore.ang;
		for (let k = 0; k < 8; k++) {
			const a = k / 8 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
			for (const r of [30, 90, 200, 420, 800]) {
				const wx = x + c * r, wz = z + s * r;
				if (groundAt(wx, wz) >= -1.5) continue;
				if (oceanSide(wx, wz)) { const v = 1 - r / 1000; if (v > ocean) { ocean = v; ang = a; } } else bayEdge = Math.max(bayEdge, 1 - r / 150);
				break;
			}
		}
		shore.oceanT = ocean; shore.bayT = bayEdge; shore.ang = ang;
		// the side the sea is on, for the panner (never hard over: surf fills the ear)
		const side = Math.cos(ang) * e[0] + Math.sin(ang) * e[2];
		A.surfPan.pan.setTargetAtTime(side * 0.6, ctx.currentTime, 0.5);
	}

	// ---------- the night ----------
	function fieldChirp(c, level) {
		// three or four pulses at ~30 a second, a pure tone near 4.7 kHz
		const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), n = 3 + (c.f > 4750 ? 1 : 0);
		o.frequency.value = c.f;
		g.gain.setValueAtTime(0, t);
		for (let k = 0; k < n; k++) { g.gain.linearRampToValueAtTime(level, t + k * 0.034 + 0.006); g.gain.linearRampToValueAtTime(0, t + k * 0.034 + 0.02); }
		const p = pan(c.pan);
		o.connect(g).connect(p); o.start(t); o.stop(t + n * 0.034 + 0.02);
	}
	function treeChirp(level) {
		// the snowy tree crickets, all together: a soft, rounded chirp near 2.9 kHz each
		const t = ctx.currentTime;
		tree.pans.forEach((pn, i) => {
			const t0 = t + Math.random() * 0.015, o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.value = 2850 + i * 45;
			g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(level, t0 + 0.012); g.gain.setValueAtTime(level, t0 + 0.04); g.gain.linearRampToValueAtTime(0, t0 + 0.06);
			o.connect(g).connect(pan(pn)); o.start(t0); o.stop(t0 + 0.07);
		});
	}
	function owl(level) {
		// the great horned owl's "hoo, h'HOO, hoo, hoo": soft and low, each hoot sliding down
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.4), f = 285 + Math.random() * 30;
		[[0, 0.32], [0.5, 0.1], [0.62, 0.38], [1.25, 0.3], [1.75, 0.34]].forEach(([at, len]) => {
			tone('sine', f * 1.03, f * 0.94, t + at, len, level, p, 0.06);
			tone('sine', f * 2.06, f * 1.88, t + at, len, level * 0.12, p, 0.06);
		});
		// now and then its mate answers, higher
		if (Math.random() < 0.35) [[2.6, 0.25], [3.0, 0.1], [3.12, 0.3], [3.6, 0.28]].forEach(([at, len]) => tone('sine', f * 1.25, f * 1.15, t + at, len, level * 0.7, p, 0.06));
	}
	function barnOwl(level) {
		// a long, harsh screech: breathy noise in a high band, rising and trailing off
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6);
		hiss('white', 'bandpass', 2600, 3, [[0.1, level], [1.1, level * 0.8], [1.6, 0]], p, t, 3400);
		hiss('white', 'bandpass', 5200, 4, [[0.1, level * 0.4], [1.1, level * 0.3], [1.6, 0]], p, t, 6600);
	}
	function coyote(level) {
		// yips from a few throats, then a long wavering howl
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.8);
		for (let k = 0; k < 7; k++) { const f = 650 + Math.random() * 500; tone('triangle', f, f * (k % 2 ? 1.5 : 0.7), t + k * 0.18 + Math.random() * 0.1, 0.2, level, p, 0.03); }
		glide('triangle', [[0, 650], [0.3, 1100], [0.6, 1000], [0.8, 1150], [1, 800]], t + 1.4, 1.6, level * 0.8, p, 0.2);
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

	// ---------- the day ----------
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
	function robin(level) {
		// "cheerily, cheer-up, cheerio": short rising-and-falling carols in twos and threes
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6), n = 3 + Math.floor(Math.random() * 4);
		for (let k = 0; k < n; k++) {
			const f = 2100 + Math.random() * 900, at = k * 0.3 + (k > 2 ? 0.25 : 0);
			glide('sine', [[0, f * 0.85], [0.4, f * 1.15], [1, f * 0.9]], t + at, 0.16 + Math.random() * 0.06, level, p, 0.015);
		}
	}
	function whiteCrown(level) {
		// the white-crowned sparrow, San Francisco's own: a clear whistle, a lower one, then
		// a buzzy trill
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6), f = 3300 + Math.random() * 400;
		tone('sine', f, f, t, 0.45, level, p, 0.03);
		tone('sine', f * 0.82, f * 0.8, t + 0.5, 0.25, level * 0.9, p, 0.02);
		for (let k = 0; k < 7; k++) tone('triangle', f * 1.25, f * 1.05, t + 0.8 + k * 0.055, 0.045, level * 0.6, p, 0.005);
	}
	function songSparrow(level) {
		// three sharp notes, then a jumble and a trill
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6);
		for (let k = 0; k < 3; k++) tone('sine', 2600, 2400, t + k * 0.14, 0.07, level, p, 0.005);
		tone('sine', 4000, 2200, t + 0.5, 0.3, level * 0.8, p, 0.01);
		for (let k = 0; k < 6; k++) tone('triangle', 3600, 3300, t + 0.85 + k * 0.06, 0.04, level * 0.6, p, 0.004);
	}
	function dove(level) {
		// the mourning dove's "ooo-AH, coo, coo, coo": low and hollow
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.4);
		glide('sine', [[0, 480], [0.4, 560], [1, 470]], t, 0.6, level, p, 0.08);
		for (let k = 0; k < 3; k++) tone('sine', 470, 440, t + 0.9 + k * 0.6, 0.45, level * 0.9, p, 0.07);
	}
	function jay(level) {
		// the scrub-jay's harsh rising "shreep", twice or three times
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.6), n = 2 + Math.floor(Math.random() * 2);
		for (let k = 0; k < n; k++) {
			const s = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), t0 = t + k * 0.32;
			s.type = 'sawtooth'; s.frequency.setValueAtTime(1100, t0); s.frequency.exponentialRampToValueAtTime(1700, t0 + 0.2);
			bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.5;
			g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
			s.connect(bp).connect(g).connect(p); s.start(t0); s.stop(t0 + 0.25);
		}
	}
	function gull(level) {
		// the western gull: a nasal "kyow" or two, then a run of shorter "kyow-kyow-kyow"
		const t = ctx.currentTime, p = pan((Math.random() - 0.5) * 1.8), f = 850 + Math.random() * 250, n = 2 + Math.floor(Math.random() * 5);
		for (let k = 0; k < n; k++) {
			const len = k < 1 ? 0.42 : 0.26 - Math.min(0.1, k * 0.02), t0 = t + (k < 1 ? 0 : 0.5 + (k - 1) * 0.3);
			const s = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
			s.type = 'sawtooth';
			s.frequency.setValueAtTime(f * 0.8, t0); s.frequency.exponentialRampToValueAtTime(f * 1.3, t0 + 0.05); s.frequency.exponentialRampToValueAtTime(f * 0.85, t0 + len);
			bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 1.3;
			g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + 0.03); g.gain.setValueAtTime(level, t0 + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
			s.connect(bp).connect(g).connect(p); s.start(t0); s.stop(t0 + len + 0.02);
		}
	}
	function seaLion(level, pn) {
		// a bout of hoarse barks: two detuned saws beat into a rasp, through the throat's band
		const t = ctx.currentTime, p = pan(pn), f = 260 + Math.random() * 90, n = 3 + Math.floor(Math.random() * 5);
		for (let k = 0; k < n; k++) {
			const t0 = t + k * (0.28 + Math.random() * 0.1), len = 0.18 + Math.random() * 0.08;
			const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
			for (const [o, m] of [[o1, 1], [o2, 1.13]]) { o.type = 'sawtooth'; o.frequency.setValueAtTime(f * m * 0.9, t0); o.frequency.exponentialRampToValueAtTime(f * m * 1.1, t0 + 0.05); o.frequency.exponentialRampToValueAtTime(f * m * 0.8, t0 + len); o.connect(bp); }
			bp.type = 'bandpass'; bp.frequency.value = 750; bp.Q.value = 1.4;
			g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
			bp.connect(g).connect(p);
			for (const o of [o1, o2]) { o.start(t0); o.stop(t0 + len + 0.02); }
		}
	}
	const ease = (param, v, tc = 0.4) => param.setTargetAtTime(v, ctx.currentTime, tc);
	const bump = (h, a, b, c) => (h <= a || h >= c ? 0 : h < b ? (h - a) / (b - a) : (c - h) / (c - b));

	// o: { night, hours, month, fog, under, islandHalf, pond (distance to still water, m),
	//      town (0..1), and if main passes them, indoors (true/false) and rain (0..1) }
	function update(dt, cam, o) {
		if (!setup() || !bay.loaded()) return;
		const x = cam.position.x, z = cam.position.z, alt = cam.position.y - groundAt(x, z);
		const onIsland = Math.max(Math.abs(x), Math.abs(z)) < (o.islandHalf || 0);
		const near = Math.max(0, 1 - Math.max(0, alt - 3) / 150) * (o.under || onIsland ? 0 : 1);
		const inside = !!o.indoors;
		ease(A.master.gain, near > 0.01 ? (1 - hush * 0.95) * (inside ? 0.6 : 1) : 0, hush > 0 ? 0.3 : 0.8);
		ease(A.room.frequency, inside ? 600 : 18000, 0.3);
		if (near <= 0.01) return;
		const town = Math.min(1, o.town || 0), wild = near * (1 - town * 0.8), h = o.hours, m = o.month, night = o.night;
		const rain = o.rain || 0, dry = 1 - Math.min(1, rain * 1.5), fog = o.fog || 0;
		const winter = [1, 1, 0.8, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.6, 0.9, 1][m - 1];
		// the shore, a few times a second (the height lookups are not free)
		const e = cam.matrixWorld.elements;
		tScan -= dt;
		if (tScan < 0) { tScan = 0.3; scanShore(x, z, e); }
		shore.ocean += (shore.oceanT - shore.ocean) * Math.min(1, dt * 1.5);
		shore.bay += (shore.bayT - shore.bay) * Math.min(1, dt * 1.5);
		// the surf: waves on the season's swell (longer and bigger in winter), in sets
		const oc = shore.ocean * near;
		ease(A.bed.g.gain, 0.05 * oc, 0.6);
		ease(A.bed.lp.frequency, 250 + oc * oc * 500, 0.6);
		tWave -= dt;
		if (tWave < 0) {
			tWave = (9 + winter * 5) * (0.8 + Math.random() * 0.4);
			if (setLeft <= 0 && ++waveN % (6 + Math.floor(Math.random() * 4)) === 0) setLeft = 3;
			const size = (0.7 + winter * 0.4) * (setLeft > 0 ? 1.4 : 0.75 + Math.random() * 0.35);
			if (setLeft > 0) setLeft--;
			if (oc > 0.02) wave(size, oc);
		}
		// the Bay's edge and the lakes lap
		const edge = Math.max(shore.bay, Math.max(0, 1 - (o.pond ?? 1e9) / 80)) * near * (1 - shore.ocean);
		tLap -= dt;
		if (tLap < 0) { tLap = 1.2 + Math.random() * 2.4; if (edge > 0.05) lap(0.03 * edge); }
		// crickets on warm nights, each on its own clock; the warmer, the faster they chirp
		const warm = [0, 0, 0.1, 0.3, 0.6, 0.9, 1, 1, 1, 0.8, 0.3, 0][m - 1];
		const tempF = 50 + warm * 20 - fog * 8 - (h < 6 ? 4 : 0);
		const crick = night > 0.6 ? 0.012 * wild * warm * (1 - fog * 0.7) * dry : 0;
		if (crick > 1e-4) {
			for (const c of field) {
				c.t -= dt;
				if (c.t > 0) continue;
				c.t = 1 / (c.rate * (0.7 + (tempF - 55) / 40)) * (0.96 + Math.random() * 0.08);
				// (each one rests now and then, and takes it up again)
				c.on += (Math.random() - 0.5) * 0.2;
				if (c.on > 1 || c.on < 0) c.on = Math.random();
				if (c.on > 0.25) fieldChirp(c, crick);
			}
			// Dolbear: chirps in 14 seconds, plus 40, is the temperature in Fahrenheit
			tree.t -= dt;
			if (tree.t < 0) { tree.t = 14 / Math.max(6, tempF - 40); if (warm > 0.5) treeChirp(crick * 0.7); }
		}
		tOwl -= dt;
		if (tOwl < 0) { tOwl = 14 + Math.random() * 30; if (night > 0.7) owl(0.035 * wild * dry); }
		tBarn -= dt;
		if (tBarn < 0) { tBarn = 50 + Math.random() * 90; if (night > 0.8 && town < 0.3) barnOwl(0.01 * wild * dry); }
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
		// the birds: the dawn chorus (strongest in spring, and in town gardens too), then the
		// day's odd song; the rain quiets them
		const spring = [0.35, 0.5, 0.9, 1, 1, 0.8, 0.5, 0.4, 0.35, 0.35, 0.3, 0.3][m - 1];
		const dawn = bump(h, 4.8, 6.4, 8.8) * spring, day = night < 0.3 && h > 6 && h < 19 ? 1 : 0;
		const birds = near * (1 - town * 0.4) * dry * (1 - fog * 0.3);
		tBird -= dt;
		if (tBird < 0) {
			tBird = dawn > 0.2 ? (0.35 + Math.random() * 0.9) / dawn : 3 + Math.random() * 8;
			const pick = Math.random(), lv = 0.016 * birds * Math.max(dawn, day * 0.6);
			if (lv > 1e-4) {
				if (pick < 0.3) robin(lv);
				else if (pick < 0.5) whiteCrown(lv);
				else if (pick < 0.65) songSparrow(lv);
				else if (pick < 0.75) dove(lv * 1.4);
				else if (pick < 0.87) { if (day && town < 0.5) meadowlark(0.018 * wild * dry); }
				else if (day) jay(lv * 1.2);
			}
		}
		tQuail -= dt;
		if (tQuail < 0) { tQuail = 12 + Math.random() * 25; if (h > 6 && h < 10.5) quail(0.02 * wild * dry); }
		// gulls along every shore by day, most of all where the sea lions are
		let lions = 0, lionPan = 0;
		for (const L of SEA_LIONS) { const d = Math.hypot(L.x - x, L.z - z); if (d < 900 && 1 - d / 900 > lions) { lions = 1 - d / 900; lionPan = Math.max(-0.8, Math.min(0.8, ((L.x - x) * e[0] + (L.z - z) * e[2]) / (d + 30))); } }
		const coast = Math.max(shore.ocean, shore.bay, lions);
		tGull -= dt;
		if (tGull < 0) { tGull = (4 + Math.random() * 12) / (0.4 + coast); if (night < 0.4 && coast > 0.1) gull(0.02 * coast * near); }
		// sea lions, day and night
		tLion -= dt;
		if (tLion < 0) { tLion = 1.2 + Math.random() * 2.5; if (lions > 0) seaLion(0.05 * lions * near, lionPan + (Math.random() - 0.5) * 0.3); }
	}
	return { update, hush: (k) => { hush = k; } };
}
