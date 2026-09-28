// The sound of places and the people in them, everywhere you go, under the music:
//   beds (loops, started when wanted and stopped a few seconds after they fall silent):
//     the far murmur of a crowd, the chatter of people close by, an office's air and its
//     typing, the surf on the island's and the planets' shores, a planet's own air
//   and now and then, from somewhere round you: a few words from someone talking near you, a
//   child's laugh, a call across the sand; cutlery in a restaurant, the espresso machine,
//   a till, a lift's chime, pins falling in the bowling alley, the arcade's bleeps; on the
//   island and the other worlds, birds by day and insects at night (the Bay Area's own are
//   naturesound.js's), and each world's own: a mystical world's chimes, a toxic one's
//   bubbling, the ice's creaks, the lava's hiss and pops
// How busy it all is follows the people round you (people.js), the hour, and the day.

import { mix } from './acoustics.js';
import { noise } from '../world/soundbus.js';

const MAXV = 6;                                  // one-shots sounding at once, at most
const PENT = [0, 2, 4, 7, 9, 12, 14, 16];         // the chimes' scale

export function createAmbience() {
	const beds = {}, T = {}, D = { beds: {}, events: {}, voices: 0 };
	let voices = 0, clock = 0, swell = 0;

	// ---------- plumbing ----------
	// a one-shot's way out: level, pan, how much into the room, an optional low-pass
	function out(A, gain, pan, send, lp) {
		const ctx = A.ctx, g = ctx.createGain(), p = ctx.createStereoPanner();
		g.gain.value = gain; p.pan.value = Math.max(-1, Math.min(1, pan));
		let head = g;
		if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.connect(g); head = f; }
		g.connect(p).connect(A.amb);
		if (send > 0) { const s = ctx.createGain(); s.gain.value = send; p.connect(s).connect(A.send); }
		return head;
	}
	// start a buffer (or null when not baked yet); counts against the cap
	function shot(A, buf, gain, pan, { send = 0.5, rate = 1, lp = 0, kind = 'shot' } = {}) {
		if (!buf || voices >= MAXV || gain < 1e-4) return false;
		const s = A.ctx.createBufferSource();
		s.buffer = buf; s.playbackRate.value = rate;
		s.connect(out(A, gain, pan, send, lp));
		voices++; s.onended = () => { voices--; };
		s.start();
		D.events[kind] = (D.events[kind] || 0) + 1;
		return true;
	}
	// a struck thing: partials [ratio, level, decay]
	function strike(A, f, partials, gain, pan, send = 0.6, kind = 'strike') {
		if (voices >= MAXV) return;
		const ctx = A.ctx, t = ctx.currentTime, dest = out(A, gain, pan, send);
		let longest = 0;
		for (const [m, lv, dec] of partials) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.frequency.value = f * m;
			g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
			o.connect(g).connect(dest); o.start(t); o.stop(t + dec + 0.02);
			longest = Math.max(longest, dec);
			if (lv === partials[0][1]) { voices++; o.onended = () => { voices--; }; }
		}
		D.events[kind] = (D.events[kind] || 0) + 1;
	}
	// a tone with a pitch path [[at 0..1, Hz]...]
	function glide(A, type, path, len, gain, pan, { send = 0.4, lp = 0, delay = 0, kind = 'tone', vib = 0 } = {}) {
		if (voices >= MAXV) return;
		const ctx = A.ctx, t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
		o.type = type; o.frequency.setValueAtTime(path[0][1], t);
		for (let i = 1; i < path.length; i++) o.frequency.exponentialRampToValueAtTime(Math.max(20, path[i][1]), t + path[i][0] * len);
		if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6 + Math.random() * 3; lg.gain.value = path[0][1] * vib; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + len + 0.05); }
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + Math.min(0.02, len * 0.2)); g.gain.setValueAtTime(1, t + len * 0.7); g.gain.linearRampToValueAtTime(0, t + len);
		o.connect(g).connect(out(A, gain, pan, send, lp)); o.start(t); o.stop(t + len + 0.02);
		voices++; o.onended = () => { voices--; };
		D.events[kind] = (D.events[kind] || 0) + 1;
	}
	// a burst of filtered noise: a hiss, a splash, a crash
	function hiss(A, colour, type, f, q, len, gain, pan, { attack = 0.05, send = 0.5, kind = 'hiss', f1 = 0 } = {}) {
		if (voices >= MAXV) return;
		const ctx = A.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
		s.buffer = noise(ctx, colour); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
		if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + len);
		g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + attack); g.gain.setTargetAtTime(0, t + attack, (len - attack) / 3);
		s.connect(fl).connect(g).connect(out(A, gain, pan, send));
		s.start(t, Math.random() * 3); s.stop(t + len + 0.1);
		voices++; s.onended = () => { voices--; };
		D.events[kind] = (D.events[kind] || 0) + 1;
	}

	// ---------- beds ----------
	// make(A) → { g (its level), stop(), set?(p) } or null while its sound is being baked
	const BEDS = {
		crowd: (A) => {
			const buf = A.B.get('babbleFar');
			if (!buf) return null;
			const ctx = A.ctx, lp = ctx.createBiquadFilter(), g = ctx.createGain(), src = [];
			lp.type = 'lowpass'; lp.frequency.value = 2500; g.gain.value = 0;
			for (const [pan, rate, off] of [[-0.55, 1, 0], [0.55, 0.96, 3.3]]) {
				const s = ctx.createBufferSource(), p = ctx.createStereoPanner();
				s.buffer = buf; s.loop = true; s.playbackRate.value = rate; p.pan.value = pan;
				s.connect(p).connect(lp); s.start(0, off); src.push(s);
			}
			lp.connect(g).connect(A.amb);
			const sg = ctx.createGain(); sg.gain.value = 0.5; g.connect(sg).connect(A.send);
			return { g, src, set: (p) => { lp.frequency.setTargetAtTime(p.lp || 2500, ctx.currentTime, 0.5); for (const s of src) s.playbackRate.setTargetAtTime(p.rate || 1, ctx.currentTime, 0.5); } };
		},
		chatter: (A) => {
			const buf = A.B.get('babbleNear');
			if (!buf) return null;
			const ctx = A.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
			s.buffer = buf; s.loop = true; g.gain.value = 0;
			s.connect(g).connect(p).connect(A.amb); s.start(0, Math.random() * 5);
			const sg = ctx.createGain(); sg.gain.value = 0.7; p.connect(sg).connect(A.send);
			return { g, src: [s], set: (q) => { p.pan.setTargetAtTime(q.pan || 0, ctx.currentTime, 0.8); s.playbackRate.setTargetAtTime(q.rate || 1, ctx.currentTime, 0.5); } };
		},
		// an office's or a shop's air: the vents' rush and the mains' hum
		air: (A) => {
			const ctx = A.ctx, s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), o = ctx.createOscillator(), og = ctx.createGain();
			s.buffer = noise(ctx, 'brown'); s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 240; g.gain.value = 0;
			o.frequency.value = 120; og.gain.value = 0.05;
			s.connect(lp).connect(g); o.connect(og).connect(g); g.connect(A.amb);
			s.start(0, Math.random() * 3); o.start();
			return { g, src: [s, o] };
		},
		typing: (A) => {
			const buf = A.B.get('typing');
			if (!buf) return null;
			const ctx = A.ctx, s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner();
			s.buffer = buf; s.loop = true; p.pan.value = 0.4; g.gain.value = 0;
			s.connect(g).connect(p).connect(A.amb);
			const sg = ctx.createGain(); sg.gain.value = 0.6; p.connect(sg).connect(A.send);
			s.start(0, Math.random() * 5);
			return { g, src: [s] };
		},
		// the island's and the planets' surf: a swell of pink noise, its brightness rising with it
		surf: (A) => {
			const ctx = A.ctx, s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), sw = ctx.createGain();
			s.buffer = noise(ctx, 'pink'); s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 600; g.gain.value = 0; sw.gain.value = 0.5;
			s.connect(lp).connect(sw).connect(g).connect(A.amb); s.start(0, Math.random() * 3);
			return { g, src: [s], set: (p) => { lp.frequency.setTargetAtTime(p.lp, ctx.currentTime, 0.4); sw.gain.setTargetAtTime(p.sw, ctx.currentTime, 0.4); } };
		},
		// another world's own air, by its kind
		world: (A, type) => {
			const ctx = A.ctx, g = ctx.createGain(), src = [];
			g.gain.value = 0; g.connect(A.amb);
			const loop = (colour, ft, f, q) => { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = noise(ctx, colour); s.loop = true; fl.type = ft; fl.frequency.value = f; fl.Q.value = q; s.connect(fl).connect(g); s.start(0, Math.random() * 3); src.push(s); return fl; };
			const tone = (f, lv) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f; og.gain.value = lv; o.connect(og).connect(g); o.start(); src.push(o); return o; };
			let wob = null;
			if (type === 'MAGMA') { loop('brown', 'lowpass', 80, 0.7); wob = loop('brown', 'bandpass', 180, 2); }
			else if (type === 'TOXIC') { loop('brown', 'lowpass', 140, 0.7); wob = loop('white', 'bandpass', 420, 6); }
			else if (type === 'ICE') { wob = loop('pink', 'bandpass', 1700, 9); loop('brown', 'lowpass', 200, 0.5); }
			else if (type === 'GAS') { tone(41, 0.3); tone(61.8, 0.2); loop('brown', 'lowpass', 120, 0.6); }
			else if (type === 'MYSTICAL') { tone(880, 0.02); tone(1318.5, 0.015); wob = loop('pink', 'bandpass', 3200, 4); }
			else if (type === 'ARID') { wob = loop('pink', 'highpass', 3000, 0.5); }
			else return null;
			return { g, src, set: (p) => { if (wob) wob.frequency.setTargetAtTime(p.wob, ctx.currentTime, 1.2); } };
		},
	};
	// bring a bed up or down; a silent one is stopped after a while and made again when wanted
	function bed(A, name, level, dt, p, arg) {
		let b = beds[name];
		if (!b) b = beds[name] = { n: null, idle: 0, level: 0, arg };
		if (b.n && b.arg !== arg) { b.n.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3); stopBed(b, 1); }
		if (level > 3e-4 && !b.n) { b.n = BEDS[name](A, arg); b.arg = arg; }
		b.level = level;
		if (!b.n) return;
		b.n.g.gain.setTargetAtTime(level, A.ctx.currentTime, name === 'chatter' ? 0.6 : 1);
		if (p && b.n.set) b.n.set(p);
		if (level <= 3e-4) { b.idle += dt; if (b.idle > 5) stopBed(b, 0); } else b.idle = 0;
	}
	function stopBed(b, after) {
		const n = b.n;
		b.n = null; b.idle = 0;
		setTimeout(() => { for (const s of n.src) { try { s.stop(); } catch { /* stopped */ } } n.g.disconnect(); }, after * 1000 + 50);
	}

	// ---------- the things that happen ----------
	const every = (key, dt, mean) => { T[key] = (T[key] ?? Math.random() * mean) - dt; if (T[key] > 0) return false; T[key] = mean * (0.4 + Math.random() * 1.2); return true; };
	function nearest(people, cam, test) {
		let best = null, bd = 1e9;
		for (const p of people?.pool || []) {
			if (!p.active || !test(p)) continue;
			const q = p.M.S.pos, d = Math.hypot(q.x - cam.position.x, q.z - cam.position.z);
			if (d < bd) { bd = d; best = q; }
		}
		return best ? { q: best, d: bd } : null;
	}
	// left/right of where you look, -1..1
	function side(cam, x, z) {
		const e = cam.matrixWorld.elements, dx = x - cam.position.x, dz = z - cam.position.z, d = Math.hypot(dx, dz) || 1;
		return (e[0] * dx + e[2] * dz) / (Math.hypot(e[0], e[2]) || 1) / d;
	}
	const rnd = (a) => (Math.random() * 2 - 1) * a;
	const pick = (s, n) => s + Math.floor(Math.random() * n);

	// o: { place, room, cam, people, rain, under, alt, open (0..1 how open to the sky) }
	function update(dt, o) {
		const A = mix();
		if (!A) return D;
		clock += dt;
		const P = o.place || { kind: 'wild' }, cam = o.cam, k = P.kind, night = P.night || 0, h = P.hours ?? 12;
		const hush = o.under ? 0 : Math.max(0, 1 - Math.max(0, (o.alt || 0) - 25) / 90);          // up in the air it all falls away
		const rain = o.rain || 0, day = h > 6 && h < 19.5 ? 1 : 0;
		const planet = P.earth ? null : P.planet;
		// who is about: the people round you, and how busy the place is at this hour
		const near = Math.min(1, (P.near || 0) / 6), talk = Math.min(1, (P.talk || 0) / 2.5);
		const venue = ['cafe', 'restaurant', 'shop', 'arcade', 'bowling', 'cinema', 'lobby', 'office', 'museum', 'caveVillage', 'medieval'].includes(k);
		const outdoorCrowd = { downtown: 0.8, mainstreet: 0.7, boardwalk: 1, beach: 0.55, park: 0.45, village: 0.5, offices: 0.4, suburb: 0.15, industrial: 0.1 }[k] || 0;
		const busy = Math.max(0, Math.min(1, P.busy || 0));
		let far = (venue ? busy * (k === 'office' ? 0.35 : k === 'cinema' ? 0.2 : 0.9) : busy * outdoorCrowd) * (1 - rain * 0.6) + near * 0.25;
		if (P.kind === 'house' || P.kind === 'home' || P.kind === 'cave' || P.kind === 'dungeon') far = 0;
		far = Math.min(1, far) * hush;
		const lpFar = P.indoor ? 3200 : 1800 + busy * 800;
		bed(A, 'crowd', 0.07 * far, dt, { lp: lpFar, rate: k === 'caveVillage' ? 0.84 : 1 });
		// close by: people talking, and the tables round you
		let chat = talk * 0.8 + (['cafe', 'restaurant', 'medieval', 'caveVillage'].includes(k) ? busy * 0.6 : 0) + (k === 'lobby' ? busy * 0.25 : 0);
		// (in a home or a cave the people outside are heard only faintly)
		chat = Math.min(1, chat) * hush * (['house', 'home', 'cave', 'dungeon'].includes(k) ? 0.3 : 1);
		const who = nearest(o.people, cam, (p) => p.role === 'chat' || !!p.partner || p.route?.kind === 'seat');
		bed(A, 'chatter', 0.06 * chat, dt, { pan: who ? side(cam, who.q.x, who.q.z) * 0.5 : 0, rate: k === 'caveVillage' ? 0.86 : 1 });
		// the air in offices, lobbies, shops
		const air = { office: 1, lobby: 0.8, shop: 0.6, cafe: 0.4, restaurant: 0.4, arcade: 0.5, bowling: 0.5, cinema: 0.6, museum: 0.5 }[k] || 0;
		bed(A, 'air', 0.035 * air, dt);
		bed(A, 'typing', k === 'office' ? 0.028 * Math.max(0.15, busy) * (day ? 1 : 0.3) : 0, dt);
		// surf on the island's and the planets' shores (the Bay's own is naturesound.js's)
		const coast = P.coast ?? 1e9;
		const surfK = (P.earth && k !== 'village' && k !== 'beach' && k !== 'wild') ? 0 : 1 / (1 + (coast / 40) ** 2) * (P.indoor ? 0.2 : 1) * hush * (planet === 'OCEAN' ? 1.3 : 1);
		swell += dt;
		const sw = 0.5 + 0.3 * Math.sin(swell * 2 * Math.PI / 9) + 0.2 * Math.sin(swell * 2 * Math.PI / 23 + 1);
		bed(A, 'surf', 0.11 * surfK * (planet === 'MAGMA' ? 0.4 : 1), dt, { lp: 350 + sw * 900, sw: 0.3 + sw * 0.7 });
		// the planet's own air
		const wob = { MAGMA: 160 + 60 * Math.sin(clock / 3), TOXIC: 300 + 180 * Math.abs(Math.sin(clock * 1.7)), ICE: 1500 + 400 * Math.sin(clock / 5), MYSTICAL: 2800 + 800 * Math.sin(clock / 7), ARID: 3000 + 500 * Math.sin(clock / 4) }[planet] || 0;
		bed(A, 'world', planet ? 0.02 * hush * (P.kind === 'cave' || P.kind === 'caveVillage' ? 0.4 : 1) : 0, dt, { wob }, planet);

		// ---- one-shots ----
		const pan = () => rnd(0.8);
		// a few words from someone talking near you
		if (talk > 0.05 && every('phrase', dt, 6 / (0.3 + talk)) && who && who.d < 14) shot(A, A.B.get('phrase' + pick(0, 6)), 0.05 * hush / (1 + (who.d / 5) ** 2), side(cam, who.q.x, who.q.z) * 0.8, { send: 0.6, lp: who.d > 6 ? 2600 : 0, kind: 'phrase', rate: k === 'caveVillage' ? 0.85 : 0.95 + Math.random() * 0.1 });
		// children laughing: where there are children, more at the beach, the park, the boardwalk
		const kidsK = Math.min(1, (P.kids || 0) * 0.8 + ({ beach: 0.35, park: 0.45, boardwalk: 0.6, village: 0.25, museum: 0.5, mainstreet: 0.1, arcade: 0.3, bowling: 0.2 }[k] || 0) * busy * Math.min(1, P.kidsAbout ?? 1));
		if (kidsK > 0.03 && every('laugh', dt, 16 / kidsK)) {
			const kid = nearest(o.people, cam, (p) => p.P?.dna?.child), d = kid ? kid.d : 12 + Math.random() * 25;
			shot(A, A.B.get('laugh' + pick(0, 2)), 0.05 * hush / (1 + (d / 8) ** 2), kid ? side(cam, kid.q.x, kid.q.z) : pan(), { send: 0.5, lp: d > 15 ? 2400 : 0, kind: 'laugh' });
		}
		// grown-ups laughing at the tables
		if (['restaurant', 'cafe', 'medieval', 'boardwalk', 'mainstreet'].includes(k) && busy > 0.2 && every('laughA', dt, 25 / busy)) shot(A, A.B.get('laugh2'), 0.025 * hush, pan(), { send: 0.6, lp: 3000, kind: 'laugh' });
		// someone calling out, far off
		if (['beach', 'park', 'boardwalk', 'village'].includes(k) && busy > 0.1 && every('call', dt, 30 / busy)) shot(A, A.B.get('call' + pick(0, 2)), 0.02 * hush, pan(), { send: 0.3, lp: 1800, kind: 'call', rate: 0.95 + Math.random() * 0.1 });
		// the boardwalk's rides: a far rising shriek of delight
		if (k === 'boardwalk' && busy > 0.2 && every('ride', dt, 22)) shot(A, A.B.get('call' + pick(0, 2)), 0.015 * hush, pan(), { send: 0.3, lp: 2200, kind: 'ride', rate: 1.35 });
		// the restaurant's and the café's things
		if ((k === 'restaurant' || k === 'cafe' || k === 'medieval') && every('clink', dt, (k === 'medieval' ? 12 : 3.5) / (0.2 + busy))) shot(A, A.B.get('clink' + pick(0, 4)), 0.02 * (0.5 + Math.random() * 0.5), pan(), { send: 0.7, kind: 'clink', rate: 0.9 + Math.random() * 0.2 });
		if (k === 'restaurant' && every('kitchen', dt, 9)) shot(A, A.B.get('clink' + pick(0, 4)), 0.02, rnd(0.3) + 0.6, { send: 0.9, lp: 3500, rate: 0.6 + Math.random() * 0.15, kind: 'kitchen' });
		if (k === 'cafe' && busy > 0.1 && every('espresso', dt, 40)) hiss(A, 'white', 'bandpass', 2600, 2.5, 2.4 + Math.random() * 2, 0.012, rnd(0.6), { attack: 0.3, send: 0.6, kind: 'espresso' });
		if (k === 'shop' && busy > 0.1 && every('till', dt, 25)) for (let i = 0; i < 2; i++) glide(A, 'square', [[0, 1850], [1, 1850]], 0.07, 0.004, 0.5, { delay: i * 0.12, send: 0.5, lp: 3500, kind: 'till' });
		if ((k === 'lobby' || k === 'office') && every('ding', dt, k === 'lobby' ? 22 : 45)) strike(A, 1318.5, [[1, 1, 1.4], [2.01, 0.3, 0.6], [3.02, 0.12, 0.3]], 0.008, rnd(0.7), 0.8, 'ding');
		if (k === 'bowling' && every('pins', dt, 11)) { hiss(A, 'pink', 'bandpass', 900, 0.8, 0.9, 0.02, rnd(0.4), { attack: 0.005, send: 0.8, kind: 'pins' }); for (let i = 0; i < 3; i++) shot(A, A.B.get('clink' + pick(0, 4)), 0.015, rnd(0.4), { rate: 0.3 + Math.random() * 0.1, send: 0.8, kind: 'pins' }); }
		if (k === 'arcade' && every('bleep', dt, 3)) { const f = 400 * 2 ** (pick(0, 12) / 12); glide(A, 'square', [[0, f], [0.5, f * 1.5], [1, f * 2]], 0.18, 0.004, rnd(0.7), { lp: 3000, send: 0.5, kind: 'bleep' }); }
		// a medieval village's smithy
		if (k === 'medieval' && day && every('anvil', dt, 9)) { const pn = rnd(0.7); for (let i = 0; i < 3; i++) setTimeout(() => strike(A, 1180, [[1, 1, 0.5], [2.4, 0.5, 0.3], [3.9, 0.3, 0.15]], 0.006, pn, 0.6, 'anvil'), i * 520); }

		// ---- the island's and the planets' wild (the Bay's is naturesound.js's) ----
		const wild = !P.indoor && (planet || (P.earth && (k === 'wild' || k === 'village' || k === 'beach') && coast < 1e8)) ? hush * (1 - rain * 0.8) : 0;
		if (wild > 0) {
			const type = planet || 'TROPICAL';
			if (day && ['TROPICAL', 'TERRAN', 'OCEAN'].includes(type) && every('bird', dt, 2.5)) bird(A, 0.009 * wild);
			if (day && type === 'MYSTICAL' && every('bird', dt, 4)) { const f = 1800 + Math.random() * 1200; glide(A, 'sine', [[0, f], [0.5, f * 1.5], [1, f * 1.2]], 0.5, 0.006 * wild, pan(), { send: 0.7, vib: 0.02, kind: 'bird' }); }
			if (type === 'TOXIC' && every('croak', dt, 5)) { const pn = pan(); for (let i = 0; i < 3; i++) glide(A, 'sawtooth', [[0, 140], [1, 110]], 0.09, 0.006 * wild, pn, { delay: i * 0.16, lp: 700, send: 0.4, kind: 'croak' }); }
			if (day && type === 'ARID' && every('cicada', dt, 12)) hiss(A, 'white', 'bandpass', 5200, 6, 2.5, 0.006 * wild, pan(), { attack: 0.6, send: 0.2, kind: 'cicada' });
			if (night > 0.6 && !['ICE', 'MAGMA', 'GAS'].includes(type) && every('cricket', dt, 0.45)) cricket(A, 0.004 * wild, type === 'MYSTICAL' ? 6200 : type === 'TOXIC' ? 2600 : 4400 + rnd(200));
			if ((type === 'OCEAN' || (type === 'TROPICAL' && coast < 80)) && day && every('gull', dt, 14)) glide(A, 'sawtooth', [[0, 1500], [0.3, 1700], [1, 950]], 0.45, 0.004 * wild, pan(), { lp: 2400, send: 0.3, kind: 'gull' });
		}
		// the planets' own, in their air and down in their caves
		if (planet && hush > 0) {
			const inCave = P.kind === 'cave' || P.kind === 'caveVillage', q = hush * (inCave ? 0.6 : 1);
			if (planet === 'MYSTICAL' && every('chime', dt, 5)) { const f = 880 * 2 ** (PENT[pick(0, PENT.length)] / 12); strike(A, f, [[1, 1, 2.8], [2.76, 0.35, 1.2], [5.4, 0.12, 0.5]], 0.006 * q, pan(), 0.9, 'chime'); }
			if (planet === 'TOXIC' && every('bubble', dt, 1.6)) { const pn = pan(); const n = 2 + pick(0, 5); for (let i = 0; i < n; i++) { const f = 250 + Math.random() * 500; glide(A, 'sine', [[0, f], [1, f * 2.2]], 0.04, 0.006 * q, pn, { delay: i * (0.05 + Math.random() * 0.08), send: 0.4, kind: 'bubble' }); } }
			if (planet === 'ICE' && every('creak', dt, 9)) { const f = 70 + Math.random() * 60; glide(A, 'sawtooth', [[0, f], [0.6, f * 1.4], [1, f * 0.9]], 0.8 + Math.random(), 0.005 * q, pan(), { lp: 900, send: 0.8, kind: 'creak' }); }
			if (planet === 'MAGMA' && every('pop', dt, 4)) { if (Math.random() < 0.5) hiss(A, 'white', 'highpass', 2500, 0.7, 1.2, 0.006 * q, pan(), { attack: 0.1, send: 0.3, kind: 'hiss' }); else glide(A, 'sine', [[0, 120], [1, 45]], 0.12, 0.02 * q, pan(), { send: 0.5, kind: 'pop' }); }
			if (planet === 'GAS' && every('rumble', dt, 20)) hiss(A, 'brown', 'lowpass', 160, 0.7, 4, 0.03 * q, pan(), { attack: 1.5, send: 0.6, kind: 'rumble', f1: 60 });
		}
		// what is up, for Crysis.audio()
		for (const [n, b] of Object.entries(beds)) D.beds[n] = b.n ? +b.level.toFixed(4) : 0;
		D.voices = voices; D.crowd = +far.toFixed(2); D.chat = +chat.toFixed(2);
		A.B.work(2);
		return D;
	}
	// a tropical bird: a run of whistled notes
	function bird(A, lv) {
		const n = 2 + pick(0, 4), f0 = 1600 + Math.random() * 2000, pn = rnd(0.9), up = Math.random() < 0.5;
		for (let i = 0; i < n; i++) { const f = f0 * (1 + (up ? 0.08 : -0.06) * i); glide(A, 'sine', [[0, f], [0.5, f * 1.25], [1, f * 0.9]], 0.09 + Math.random() * 0.05, lv, pn, { delay: i * 0.14, send: 0.3, kind: 'bird' }); }
	}
	function cricket(A, lv, f) {
		if (voices >= MAXV) return;
		const ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
		o.frequency.value = f; g.gain.setValueAtTime(0, t);
		for (let k = 0; k < 3; k++) { g.gain.linearRampToValueAtTime(1, t + k * 0.034 + 0.006); g.gain.linearRampToValueAtTime(0, t + k * 0.034 + 0.02); }
		o.connect(g).connect(out(A, lv, rnd(0.8), 0.2)); o.start(t); o.stop(t + 0.12);
		voices++; o.onended = () => { voices--; };
		D.events.cricket = (D.events.cricket || 0) + 1;
	}
	return { update, info: D };
}
