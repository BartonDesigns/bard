// The world's mix and the space you are in. Every world sound of ours goes through here into
// the Bard's master output (soundbus.js):
//   feet: your footsteps and the people's near you
//   amb:  the ambience (people talking, rooms, places, the planets' own sounds), and the
//         city's and the wild's sound (citysound.js, naturesound.js); its level is the
//         ambience master, well under the music
//   send: into the room: a reverberation the size of the space you are in, cross-faded when
//         you move from one to another (two convolvers, only one working at a time), and a
//         slap-back echo off a cliff or the buildings across the street

import { soundBus } from '../world/soundbus.js';
import { bank } from './bank.js';

// decay (s), tone (Hz: how bright the tail starts), size (m: early reflections), wet
export const ROOMS = {
	open: { decay: 0.5, tone: 5000, size: 40, wet: 0.05 },
	forest: { decay: 0.9, tone: 3500, size: 12, wet: 0.08 },
	street: { decay: 1.1, tone: 4500, size: 14, wet: 0.14 },
	underpass: { decay: 1.5, tone: 3500, size: 8, wet: 0.3 },
	room: { decay: 0.45, tone: 6000, size: 3.5, wet: 0.22 },
	office: { decay: 0.6, tone: 4000, size: 8, wet: 0.16 },
	shop: { decay: 0.8, tone: 5000, size: 8, wet: 0.2 },
	hall: { decay: 1.7, tone: 5000, size: 16, wet: 0.3 },
	lobby: { decay: 2.3, tone: 5500, size: 14, wet: 0.36 },
	dungeon: { decay: 2.6, tone: 3000, size: 6, wet: 0.4 },
	cave: { decay: 3.4, tone: 2800, size: 12, wet: 0.45 },
};

let M = null;
// the mix for the running context, made once; null while there is no sound
export function mix() {
	const S = soundBus();
	if (!S) return null;
	if (M && M.ctx === S.ctx && M.dest === S.out) return M;
	const ctx = S.ctx, g = (v, to) => { const n = ctx.createGain(); n.gain.value = v; if (to) n.connect(to); return n; };
	const amb = g(0.8, S.out), feet = g(1, S.out), ret = g(0, S.out);
	// into the room: no rumble, and never the whole of the highs
	const send = g(1), hp = ctx.createBiquadFilter();
	hp.type = 'highpass'; hp.frequency.value = 160;
	send.connect(hp);
	const conv = [0, 1].map(() => { const c = ctx.createConvolver(); c.normalize = false; const o = g(0, ret); c.connect(o); return { c, o, name: null, on: false }; });
	// the slap: one echo and a faint second off something big and near
	const dl = ctx.createDelay(1), dlp = ctx.createBiquadFilter(), fb = g(0.18), slap = g(0, S.out);
	dl.delayTime.value = 0.12; dlp.type = 'lowpass'; dlp.frequency.value = 2600;
	hp.connect(dl); dl.connect(dlp); dlp.connect(slap); dlp.connect(fb); fb.connect(dl);
	M = { ctx, dest: S.out, amb, feet, send, hp, ret, conv, dl, slap, cur: 0, room: null, want: null, since: 0, B: bank(ctx) };
	return M;
}

// follow the room: r = { name, k (0..1 how much of it), slap: { d (s), k } }
export function acoustics(dt, r) {
	const A = mix();
	if (!A) return null;
	const t = A.ctx.currentTime, P = ROOMS[r.name] || ROOMS.open;
	// a new room: wait till it has held a moment, make its tail, then cross-fade to it
	if (r.name !== A.want) { A.want = r.name; A.since = 0; }
	A.since += dt;
	const C = A.conv[A.cur];
	if (C.name !== A.want && A.since > 0.25) {
		const buf = A.B.room(A.want, P.decay, P.tone, P.size);
		if (buf) {
			// (a fresh convolver each time: a node's buffer is best set once)
			const N = C.name === null ? C : A.conv[1 - A.cur];
			if (N.on) { A.hp.disconnect(N.c); N.on = false; }
			N.c.disconnect();
			N.c = A.ctx.createConvolver(); N.c.normalize = false; N.c.buffer = buf; N.c.connect(N.o);
			A.hp.connect(N.c); N.on = true; N.name = A.want; N.off = 0;
			N.o.gain.setTargetAtTime(1, t, 0.25);
			if (N !== C) {
				C.o.gain.setTargetAtTime(0, t, 0.25);
				C.off = t + 2;
				A.cur = 1 - A.cur;
			}
		}
	}
	for (const c of A.conv) if (c.off && t > c.off && c !== A.conv[A.cur]) { if (c.on) { A.hp.disconnect(c.c); c.on = false; } c.off = 0; }
	const wet = (ROOMS[A.conv[A.cur].name] || P).wet * (0.4 + 0.6 * (r.k ?? 1));
	A.ret.gain.setTargetAtTime(wet, t, 0.4);
	// the slap-back: its time glides slowly (no warble), its level follows the wall
	const s = r.slap || { d: 0.12, k: 0 };
	A.dl.delayTime.setTargetAtTime(Math.min(0.9, Math.max(0.03, s.d)), t, 0.8);
	A.slap.gain.setTargetAtTime(0.35 * s.k, t, 0.5);
	A.B.work(3);
	return { room: A.conv[A.cur].name, wet: +wet.toFixed(3), slap: +(0.35 * s.k).toFixed(3), slapMs: Math.round(s.d * 1000) };
}
