// The Sunday drum circle on Hippie Hill in Golden Gate Park, going since the sixties. Take
// a seat in the circle: a djembe, a conga and a pair of bongos, and half a minute of groove.
//   beats fall down the three lanes toward the drums; tap the lane (left, middle, right third
//     of the screen) as each one lands on the line. Perfect or Good; keep the combo going.
// The grooves start simple (bass, tone, bass, tone) and fill out into sixteenth-note
// patterns as the circle warms up. The rest of the circle keeps the time for you: a bass
// drum on the one and the three, and a shaker going all the way through. Every drum is
// synthesised: a pitched thump that drops as the skin settles, and a slap of noise.

import { makeKit } from './kit.js';

const BPM = 108, STEP = 60 / BPM / 4, LEAD = 2.4, FALL = 1.4;
const LANES = [['Djembe', '#c47a3a', 95], ['Conga', '#b85a2a', 190], ['Bongos', '#d8a45a', 380]];
const BARS = ['B...C...B...C...', 'B...C.C.B...H...', 'B.H.C...B.H.C.C.', 'B...C.C.B.H.C...', 'B..CB.C.B..HC.H.', 'B.HHC.H.B.HHC.C.', 'B..CB.C.B..HC.H.', 'BHCHB.C.BHCHBCC.', 'B.CHB.CHBHCHB...', 'B.HHC.H.B.HHC.C.', 'BHCHB.C.BHCHBCC.', 'B.CHB.CHBHCHBHCH', 'B...C...B...BCHC', 'B.......B.......'];

export const GAME = {
	id: 'drums',
	title: 'Drum Circle',
	blurb: 'Sit in with the Hippie Hill drum circle: tap the djembe, conga and bongos in time.',
	where: { kind: 'site', sites: [{ name: 'Hippie Hill, Golden Gate Park', lat: 37.7700, lon: -122.4585, r: 90 }, { name: 'Dolores Park', lat: 37.7596, lon: -122.4269, r: 120 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffb347', dist: 2, span: [10, 7, 2], flat: 1, backdrop: 'meadow', dome: 30 });
		const { THREE } = ctx;
		let drums = [], lanes, pads = [], dots = [], judge, S = {};
		const notes = [];
		BARS.forEach((bar, b) => { for (let i = 0; i < 16; i++) { const c = 'BCH'.indexOf(bar[i]); if (c >= 0) notes.push({ t: LEAD + (b * 16 + i) * STEP, lane: c }); } });
		const songEnd = LEAD + BARS.length * 16 * STEP + 1;

		function build() {
			// the grass, the circle of drummers, and your three drums
			K.mesh(new THREE.CircleGeometry(9, 32), K.mat('#4f7a3a', { rough: 1 }), 0, 0.01, -2).rotation.x = -Math.PI / 2;
			for (let i = 0; i < 9; i++) {
				const a = Math.PI * 0.15 + i / 8 * Math.PI * 0.7, x = Math.cos(a) * 4, z = -2 - Math.sin(a) * 4;
				const p = K.group(); p.position.set(x, 0, z); p.lookAt(K.world(new THREE.Vector3(0, 0, -2)));
				K.cyl(0.18, 0.22, 0.6, ['#2a6fd1', '#d1323a', '#6bd66b', '#ffd23f', '#b56cff'][i % 5], 0, 0.55, 0, p);
				K.ball(0.13, ['#8a5a3a', '#e0b894', '#5a3a2a'][i % 3], 0, 0.98, 0, p);
				K.cyl(0.14, 0.12, 0.55, '#9a6a3a', 0, 0.28, 0.3, p);
				p.userData.bob = i;
				drums.push(p);
			}
			pads = LANES.map(([, col], i) => {
				const d = K.group(); d.position.set((i - 1) * 0.55, 0, -0.2);
				K.cyl(0.2 - i * 0.03, 0.12, 0.6 - i * 0.15, col, 0, (0.6 - i * 0.15) / 2, 0, d);
				K.cyl(0.21 - i * 0.03, 0.21 - i * 0.03, 0.01, '#efe3c2', 0, 0.6 - i * 0.15, 0, d);
				return d;
			});
			// the lanes on screen: three columns with a hit line near the bottom
			lanes = K.el('position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none',
				LANES.map(([name], i) => `<div style="position:absolute;left:${i * 33.33}%;width:33.33%;top:0;bottom:0;border-left:${i ? '1px solid rgba(255,255,255,.12)' : 'none'}"><div style="position:absolute;left:50%;bottom:calc(110px + env(safe-area-inset-bottom));width:62px;height:62px;margin-left:-31px;border-radius:50%;border:3px solid ${LANES[i][1]};background:rgba(8,20,26,.45);color:#eafaf6;font:600 11px/56px system-ui;text-align:center">${name}</div></div>`).join(''));
			dots = [];
			for (let i = 0; i < 30; i++) {
				const d = document.createElement('div');
				d.style.cssText = 'position:absolute;top:0;width:46px;height:46px;margin-left:-23px;margin-top:-23px;border-radius:50%;display:none;box-shadow:0 0 10px rgba(255,200,120,.7)';
				lanes.appendChild(d); dots.push(d);
			}
			judge = K.el('position:absolute;left:50%;top:40%;transform:translateX(-50%);font:800 24px system-ui;color:#ffb347;text-shadow:0 2px 6px #000;pointer-events:none;opacity:0;transition:opacity .3s');
		}
		function reset() {
			S = { t: 0, next: 0, score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, step: -1, state: 'play', hitAt: [0, 0, 0] };
			for (const n of notes) n.hit = false;
		}
		function drum(i, k = 1) {
			const f = LANES[i][2];
			K.tone(f * 1.5, 0.35, { vol: 0.28 * k, to: f });
			K.noise(0.08, { vol: 0.12 * k, f: f * 6, q: 1 });
			S.hitAt[i] = 1;
		}
		function say(text, col) { judge.textContent = text; judge.style.color = col; judge.style.opacity = '1'; clearTimeout(S.jt); S.jt = setTimeout(() => { if (judge) judge.style.opacity = '0'; }, 350); }
		function press(down, x) {
			if (!down || S.state !== 'play') return;
			const r = K.size(), lane = Math.min(2, Math.max(0, Math.floor((x - r.left) / r.width * 3)));
			drum(lane);
			let best = null, bd = 0.15;
			for (let i = S.next; i < notes.length && notes[i].t < S.t + 0.2; i++) { const n = notes[i], d = Math.abs(n.t - S.t); if (!n.hit && n.lane === lane && d < bd) { bd = d; best = n; } }
			if (!best) { S.combo = 0; return; }
			best.hit = true; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
			const mult = 1 + Math.min(3, Math.floor(S.combo / 10));
			if (bd < 0.05) { S.perfect++; S.score += 100 * mult; say('Perfect', '#ffd23f'); }
			else { S.good++; S.score += 50 * mult; say('Good', '#9fe0ff'); }
		}
		function update(dt) {
			S.t += dt;
			// the circle keeps time: bass on one and three, a shaker on every sixteenth
			const st = Math.floor((S.t - LEAD) / STEP);
			if (st > S.step && S.t < songEnd - 1) {
				S.step = st;
				if (st >= 0 && st % 8 === 0) K.tone(70, 0.25, { vol: 0.2, to: 45 });
				K.noise(0.03, { vol: st % 4 === 0 ? 0.05 : 0.025, f: 8000, type: 'highpass' });
			}
			while (S.next < notes.length && notes[S.next].t < S.t - 0.15) { if (!notes[S.next].hit) { S.miss++; S.combo = 0; say('Miss', '#ff6a6a'); } S.next++; }
			const r = K.size(), hitY = r.height - 141;
			let di = 0;
			for (let i = S.next; i < notes.length && di < dots.length; i++) {
				const n = notes[i], k = 1 - (n.t - S.t) / FALL;
				if (k < 0) break;
				const d = dots[di++];
				d.style.display = n.hit ? 'none' : 'block';
				d.style.background = LANES[n.lane][1];
				d.style.transform = `translate(${(n.lane + 0.5) / 3 * r.width}px,${k * hitY}px)`;
			}
			for (; di < dots.length; di++) dots[di].style.display = 'none';
			pads.forEach((p, i) => { S.hitAt[i] = Math.max(0, S.hitAt[i] - dt * 6); p.scale.set(1 + S.hitAt[i] * 0.08, 1 - S.hitAt[i] * 0.06, 1 + S.hitAt[i] * 0.08); });
			for (const p of drums) p.children[1].position.y = 0.98 + Math.abs(Math.sin((S.t / (STEP * 4)) * Math.PI + p.userData.bob)) * 0.04;
			K.hud(`${S.score.toLocaleString()} · combo ${S.combo}${S.combo >= 10 ? ` ×${1 + Math.min(3, Math.floor(S.combo / 10))}` : ''}`);
			if (S.state === 'play' && S.t > songEnd) {
				S.state = 'over';
				const acc = Math.round((S.perfect + S.good * 0.5) / notes.length * 100);
				K.finish(S.score, { unit: 'pts', line: acc > 85 ? 'The circle nods: you can come back next Sunday.' : acc > 60 ? 'Somebody passes you a tambourine.' : 'The circle is very forgiving.', rows: [['Perfect', `${S.perfect} of ${notes.length}`], ['Good', S.good], ['Missed', S.miss], ['Longest combo', S.maxCombo]] });
			}
			K.cam(0, 1.7, 1.5, 0, 0.5, -2.5, 3);
		}
		function end() { clearTimeout(S.jt); judge = null; drums = []; }
		return K.wrap({ build, reset, update, press, end });
	},
};
