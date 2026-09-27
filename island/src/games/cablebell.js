// The Cable Car Bell Ringing Contest: every summer the gripmen and conductors bring their
// best rhythms to Union Square, and now it's your turn on the bell of a Powell Street car.
//   the rings come in along the track toward the bell; tap anywhere as each one reaches it.
//   dead on is Perfect, close is Good; string them together for a combo and the crowd's
//   multiplier climbs.
// The routine is built from the real repertoire: the two-ring "ding ding" of a car pulling
// away, the shave-and-a-haircut, triplets, and a syncopated finish, getting quicker as it
// goes, over a backing beat of the cable humming in its slot. The bell is synthesised the
// way a bell sounds: a strike and a handful of inharmonic partials dying away.

import { makeKit, clamp } from './kit.js';

const BPM = 132, BEAT = 60 / BPM, LEAD = 2.2, SPEED = 260;
// motifs, in beats from the motif's start
const MOTIFS = {
	dingding: [0, 0.5], haircut: [0, 0.75, 1, 1.5, 2, 3, 3.5], trip: [0, 1 / 3, 2 / 3, 1], gallop: [0, 0.75, 1, 1.75, 2], sync: [0, 0.5, 1.5, 2, 2.5, 3.5], roll: [0, 0.25, 0.5, 0.75, 1, 1.5, 2],
};
const ROUTINE = [['dingding', 2], ['dingding', 2], ['haircut', 4], ['gallop', 3], ['dingding', 1], ['trip', 2], ['sync', 4], ['trip', 1.5], ['trip', 2.5], ['haircut', 4], ['roll', 2.5], ['sync', 4], ['roll', 2.5], ['gallop', 3], ['dingding', 1], ['dingding', 2]];

export const GAME = {
	id: 'cablebell',
	title: 'Cable Car Bell',
	blurb: 'Ring the Powell Street car\'s bell in time: the Union Square bell-ringing contest.',
	where: { kind: 'site', sites: [{ name: 'Union Square', lat: 37.7880, lon: -122.4075, r: 90 }, { name: 'Powell & Market turntable', lat: 37.7848, lon: -122.4077, r: 50 }, { name: 'Cable Car Museum', lat: 37.7946, lon: -122.4115, r: 50 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffcc33', dist: 3, span: [11, 4, 7], flat: 1, backdrop: 'meadow', dome: 32 });
		let bell, track, dots = [], judge, S = {};
		const notes = [];
		{
			let b = 0;
			// the routine twice through, the second time with shorter rests between the phrases
			for (const [m, len] of [...ROUTINE, ...ROUTINE.map(([q, l]) => [q, l - 0.5])]) {
				for (const o of MOTIFS[m]) notes.push(LEAD + (b + o) * BEAT);
				b += Math.max(len, MOTIFS[m][MOTIFS[m].length - 1] + 1);
			}
		}
		const songEnd = notes[notes.length - 1] + 1.5;

		function build() {
			// a Powell Street car, side on: maroon and cream, the open end, the roof, the bell
			const car = K.group();
			car.position.set(0, 0, -1.5);
			K.box(8, 1.1, 2.4, '#7a1f2b', 0, 1.0, 0, car);
			K.box(8, 1.0, 2.3, '#efe3c2', 0, 2.05, 0, car);
			for (let i = 0; i < 7; i++) K.box(0.8, 0.7, 2.32, '#2a3440', -3 + i * 1.0, 2.1, 0, car);
			K.box(8.4, 0.18, 2.6, '#5a1a22', 0, 2.65, 0, car);
			K.box(5, 0.35, 1.4, '#efe3c2', 0, 2.9, 0, car);
			const sign = K.canvas(256, 64, (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillText('POWELL & MASON', 128, 44); });
			K.box(1.6, 0.4, 0.05, K.mat('#ffffff', { map: sign, glow: 0.5 }), 0, 2.95, 0.72, car);
			for (const x of [-2.8, 2.8]) for (const z of [-0.9, 0.9]) { const w = K.cyl(0.35, 0.35, 0.1, '#222', x, 0.4, z, car); w.rotation.x = Math.PI / 2; }
			bell = K.group(car);
			bell.position.set(3.4, 2.62, 1.3);
			K.mesh(new ctx.THREE.CylinderGeometry(0.06, 0.2, 0.26, 18, 1, true), K.mat('#e2b33a', { metal: 0.9, rough: 0.25, side: ctx.THREE.DoubleSide }), 0, -0.13, 0, bell);
			K.ball(0.04, '#8a6a2a', 0, -0.27, 0, bell);
			// the track the rings ride in on, with the bell at its left end
			track = K.el('position:absolute;left:0;right:0;bottom:calc(120px + env(safe-area-inset-bottom));height:64px;background:rgba(8,20,26,.55);border-top:1px solid rgba(255,255,255,.15);border-bottom:1px solid rgba(255,255,255,.15);pointer-events:none;overflow:hidden',
				'<div style="position:absolute;left:18%;top:6px;width:52px;height:52px;margin-left:-26px;border-radius:50%;border:3px solid #ffcc33;box-shadow:0 0 12px #ffcc33aa;text-align:center;font:26px/48px system-ui">🔔</div>');
			dots = [];
			for (let i = 0; i < 24; i++) {
				const d = document.createElement('div');
				d.style.cssText = 'position:absolute;left:0;top:14px;width:36px;height:36px;margin-left:-18px;border-radius:50%;background:#ffcc33;box-shadow:0 0 8px #ffcc33;display:none';
				track.appendChild(d); dots.push(d);
			}
			judge = K.el('position:absolute;left:18%;bottom:calc(196px + env(safe-area-inset-bottom));transform:translateX(-50%);font:800 22px system-ui;color:#ffcc33;text-shadow:0 2px 6px #000;pointer-events:none;opacity:0;transition:opacity .3s');
		}
		function reset() {
			S = { t: 0, next: 0, hit: new Array(notes.length).fill(0), score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, beat: -1, swing: 0, state: 'play' };
		}
		// the bell: a strike, then partials at the ratios a small bronze bell rings at
		function ring(k = 1) {
			for (const [r, v, d] of [[1, 0.14, 1.2], [2.76, 0.07, 0.8], [5.4, 0.04, 0.5], [8.93, 0.025, 0.3]]) K.tone(880 * r, d, { vol: v * k });
			K.noise(0.03, { vol: 0.12 * k, f: 5000, q: 1 });
			S.swing = 1;
		}
		function say(text, col) { judge.textContent = text; judge.style.color = col; judge.style.opacity = '1'; clearTimeout(S.jt); S.jt = setTimeout(() => { if (judge) judge.style.opacity = '0'; }, 380); }
		function press(down) {
			if (!down || S.state !== 'play') return;
			// the nearest unhit ring within reach of the tap
			let best = -1, bd = 1;
			for (let i = S.next; i < notes.length && notes[i] < S.t + 0.3; i++) { const d = Math.abs(notes[i] - S.t); if (!S.hit[i] && d < bd) { bd = d; best = i; } }
			if (best < 0 || bd > 0.16) { ring(0.4); S.combo = 0; say('–', '#aab'); return; }
			S.hit[best] = bd < 0.06 ? 2 : 1;
			S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
			const mult = 1 + Math.min(4, Math.floor(S.combo / 8)) * 0.5;
			if (bd < 0.06) { S.perfect++; S.score += Math.round(100 * mult); say('Perfect', '#ffcc33'); }
			else { S.good++; S.score += Math.round(50 * mult); say('Good', '#9fe0ff'); }
			ring(1);
		}
		function update(dt) {
			S.t += dt;
			// the backing: the cable humming in its slot, a click on every beat
			const b = Math.floor((S.t - LEAD) / BEAT);
			if (b > S.beat && S.t < songEnd) { S.beat = b; K.noise(0.04, { vol: b % 4 === 0 ? 0.08 : 0.04, f: b % 4 === 0 ? 180 : 7000, type: b % 4 === 0 ? 'lowpass' : 'highpass' }); }
			// rings that went past unrung are misses
			while (S.next < notes.length && notes[S.next] < S.t - 0.16) { if (!S.hit[S.next]) { S.miss++; S.combo = 0; say('Miss', '#ff6a6a'); } S.next++; }
			const r = K.size();
			let di = 0;
			for (let i = S.next; i < notes.length && di < dots.length; i++) {
				const x = r.width * 0.18 + (notes[i] - S.t) * SPEED;
				if (x > r.width + 40) break;
				const d = dots[di++];
				d.style.display = S.hit[i] ? 'none' : 'block';
				d.style.transform = `translateX(${x}px)`;
			}
			for (; di < dots.length; di++) dots[di].style.display = 'none';
			S.swing = Math.max(0, S.swing - dt * 3);
			bell.rotation.z = Math.sin(S.t * 30) * S.swing * 0.35;
			const total = notes.length;
			K.hud(`${S.score.toLocaleString()} · combo ${S.combo}${S.combo >= 8 ? ` ×${1 + Math.min(4, Math.floor(S.combo / 8)) * 0.5}` : ''} · ${Math.round(clamp(S.t / songEnd, 0, 1) * 100)}%`);
			if (S.state === 'play' && S.t > songEnd) {
				S.state = 'over';
				const acc = Math.round((S.perfect + S.good * 0.5) / total * 100);
				K.finish(S.score, { unit: 'pts', line: acc > 90 ? 'The judges are on their feet: a champion ringer.' : acc > 70 ? 'The crowd on Powell Street cheers.' : 'A polite round of applause from the tourists.', rows: [['Perfect', `${S.perfect} of ${total}`], ['Good', S.good], ['Missed', S.miss], ['Longest combo', S.maxCombo], ['Accuracy', acc + '%']] });
			}
			// the car's open front end at three-quarters, the bell in the middle of the shot
			if ((ctx.camera.aspect || 1) < 1) K.frame(3.4, 2.0, -0.5, 1.4, 3.4, 0.85, 0.05, 0.5, 0.62, 3); // a tall phone: closer and lower, the car running off the sides
			else K.frame(2.6, 2.0, -1.3, 4.6, 3.6, 0.8, 0.15, 0.6, 0.68, 3);
		}
		function end() { clearTimeout(S.jt); judge = null; }
		return K.wrap({ build, reset, update, press, end });
	},
};
