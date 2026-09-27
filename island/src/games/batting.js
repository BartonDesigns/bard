// Batting practice: a pitching machine, ten pitches, and a fence at a hundred metres.
//   tap to swing. The swing takes a moment to come round, so start it as the ball is on
//     its way: dead on time and you square it up; early and you pull it (to the left),
//     late and it goes the other way. Tap high on the screen to get under it and lift it,
//     low to hit it on the ground.
// The machine mixes its pitches: fastballs, change-ups that make you swing early, and
// curveballs that drop late. A hit leaves the bat at up to a hundred miles an hour and
// flies a real arc with air drag. Fair balls count their distance; over the fence is a home
// run. Outside the lines is foul.

import { makeKit, clamp, rand } from './kit.js';

const MOUND = 16, SWING = 0.16, PITCHES = 10, FENCE = 100;
const TYPES = [['Fastball', 33, 0, 0], ['Fastball', 31, 0, 0], ['Change-up', 24, 0, 0], ['Curveball', 26, -0.9, 0.5], ['Slider', 28, -0.3, -0.6]];

export const GAME = {
	id: 'batting',
	title: 'Batting Practice',
	blurb: 'Ten pitches from the machine: time the swing, square it up, clear the fence.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#6bd66b', dist: 1.5, span: [6, 20] });
		const { THREE } = ctx;
		let ball, bat, S = {};

		function build() {
			// the plate and the box, the machine behind its screen, the foul lines and the fence
			K.mesh(new THREE.CircleGeometry(4, 24), K.mat('#a8744a', { rough: 1 }), 0, 0.01, 0).rotation.x = -Math.PI / 2;
			const plate = K.mesh(new THREE.CircleGeometry(0.3, 5), K.mat('#f4f4f0'), 0, 0.02, 0);
			plate.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
			K.box(0.9, 0.012, 1.8, K.mat('#e8dcc8', { opacity: 0.5 }), -0.9, 0.015, 0);
			K.box(0.9, 1.1, 0.6, '#2a4a8a', 0, 0.55, -MOUND - 0.4);
			for (const x of [-0.25, 0.25]) K.cyl(0.18, 0.18, 0.1, '#222', x, 1.25, -MOUND - 0.2).rotation.x = Math.PI / 2;
			K.box(1.8, 1.8, 0.05, K.mat('#2a2a2a', { opacity: 0.5 }), 0, 0.9, -MOUND + 0.9);
			for (const s of [-1, 1]) {
				const line = K.box(0.1, 0.01, FENCE * 1.2, '#f4f4f0', s * FENCE * 1.2 / 2 * Math.SQRT1_2, 0.02, -FENCE * 1.2 / 2 * Math.SQRT1_2);
				line.rotation.y = s * Math.PI / 4;
			}
			for (let i = 0; i <= 12; i++) {
				const a = -Math.PI / 4 + i / 12 * Math.PI / 2, x = Math.sin(a) * FENCE, z = -Math.cos(a) * FENCE;
				const f = K.box(FENCE * Math.PI / 2 / 12 + 0.5, 3, 0.3, i % 2 ? '#1f5a3a' : '#23663f', x, K.groundY(x, z) + 1.5, z);
				f.rotation.y = -a;
			}
			const sign = K.canvas(128, 64, (g) => { g.fillStyle = '#1f5a3a'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.font = 'bold 36px system-ui'; g.textAlign = 'center'; g.fillText(`${FENCE} m`, 64, 46); });
			K.box(6, 3, 0.05, K.mat('#ffffff', { map: sign, glow: 0.4 }), 0, K.groundY(0, -FENCE) + 4.5, -FENCE - 0.2);
			ball = K.ball(0.037, K.mat('#f7f4ee', { rough: 0.5 }), 0, 1, -MOUND);
			bat = K.group(); bat.position.set(-0.55, 1.0, 0.1);
			K.cyl(0.03, 0.018, 0.85, K.mat('#c8a060', { rough: 0.4 }), 0, 0.42, 0, bat, 10);
			bat.rotation.set(0, 0, 0.9);
		}
		function reset() {
			S = { n: 0, state: 'wait', t: 0, total: 0, hr: 0, fair: 0, longest: 0, log: [], p: new THREE.Vector3(), v: new THREE.Vector3(), swingT: -1, pitch: null };
			wait();
		}
		function wait() { S.state = 'wait'; S.t = 0; S.swingT = -1; ball.visible = false; hud(); }
		function hud() { K.hud(`Pitch ${Math.min(PITCHES, S.n + 1)} of ${PITCHES} · ${Math.round(S.total)} m${S.hr ? ` · ${S.hr} HR` : ''}`); }
		function throwPitch() {
			const [name, sp, drop, sweep] = TYPES[Math.floor(Math.random() * TYPES.length)];
			const speed = sp * rand(0.95, 1.04), time = MOUND / speed;
			S.pitch = { name, speed, drop, sweep, time };
			// aimed to cross the plate about belt high, with the break still to come
			S.p.set(0, 1.35, -MOUND);
			S.v.set(-sweep * 0.5 / time, (0.85 - 1.35 + 0.5 * 9.8 * time * time - drop * 0.5) / time, speed);
			S.state = 'pitch'; S.t = 0; ball.visible = true;
			K.noise(0.15, { vol: 0.15, f: 400 });
		}
		function press(down, x, y) {
			if (!down || S.swingT >= 0 || (S.state !== 'pitch' && S.state !== 'wait')) return;
			const r = K.size();
			S.swingT = 0; S.lift = clamp(0.5 - (y - r.top) / r.height, -0.4, 0.4);
			K.noise(0.15, { vol: 0.06, f: 800 });
		}
		function update(dt) {
			S.t += dt;
			if (S.swingT >= 0) S.swingT += dt;
			if (S.state === 'wait') {
				if (S.swingT > 0.6) S.swingT = -1;
				if (S.t > 1.6) throwPitch();
			} else if (S.state === 'pitch') {
				// the break: curveballs drop and sliders sweep, mostly late
				const k = S.t / S.pitch.time;
				S.v.y -= (9.8 + S.pitch.drop * 2.2 * k) * dt; S.v.x += S.pitch.sweep * 1.6 * k * dt;
				S.p.addScaledVector(S.v, dt);
				// contact: the bat reaches the zone SWING seconds after the tap
				if (S.swingT >= SWING - 0.1 && S.swingT <= SWING + 0.1 && !S.contact && Math.abs(S.p.z) < 0.6) {
					// e: how much sooner the bat got there than the ball (early is positive)
					const e = (S.swingT - SWING) - S.p.z / S.pitch.speed, q = 1 - Math.abs(e) / 0.1;
					if (q > 0) hit(e, q);
				}
				if (S.state === 'pitch' && S.p.z > 2) {
					K.say(S.swingT >= 0 ? `Swing and a miss: ${S.pitch.name.toLowerCase()}` : `Strike: ${S.pitch.name.toLowerCase()}, ${Math.round(S.pitch.speed * 2.237)} mph`, 1200);
					S.log.push('miss'); next();
				}
			} else if (S.state === 'fly') {
				S.v.addScaledVector(S.v, -0.0045 * S.v.length() * dt);
				S.v.y -= 9.8 * dt;
				S.p.addScaledVector(S.v, dt);
				const gy = K.groundY(S.p.x, S.p.z), d = Math.hypot(S.p.x, S.p.z);
				if (S.p.y <= gy + 0.04 || S.t > 8) {
					const ang = Math.atan2(S.p.x, -S.p.z), foul = Math.abs(ang) > Math.PI / 4;
					if (foul) { K.say('Foul ball', 1000); S.log.push('foul'); }
					else {
						const hr = d >= FENCE;
						S.total += d; S.fair++; S.longest = Math.max(S.longest, d);
						if (hr) S.hr++;
						S.log.push(`${Math.round(d)} m`);
						K.say(hr ? `Home run! ${Math.round(d)} m` : `${Math.round(d)} m`, 1500);
						if (hr) { K.tone(523, 0.15, { vol: 0.1 }); K.tone(659, 0.15, { vol: 0.1, at: 0.15 }); K.tone(784, 0.4, { vol: 0.1, at: 0.3 }); }
					}
					next();
				}
			}
			// the bat comes round over SWING seconds and follows through
			const sw = S.swingT < 0 ? 0 : clamp(S.swingT / (SWING * 1.6), 0, 1);
			bat.rotation.set(0, -sw * 3.4, 0.9 - sw * 0.75);
			ball.position.copy(S.p);
			if (S.state === 'fly') { const d = Math.max(4, Math.hypot(S.p.x, S.p.z)); K.cam(S.p.x * 0.2, 2 + d * 0.06, 3 + d * 0.05, S.p.x, S.p.y * 0.6, S.p.z, 2); }
			else K.cam(0.55, 1.65, 2.3, -0.1, 1.1, -MOUND, 4);
		}
		function hit(e, q) {
			// early pulls it left, late pushes it right; the lift from where you tapped
			const exit = 22 + q * 22, dir = -clamp(e / 0.1, -1, 1) * 0.95 + rand(-0.08, 0.08), up = clamp(0.2 + S.lift * 0.9 + (1 - q) * rand(-0.3, 0.3), -0.25, 1.2);
			S.v.set(Math.sin(dir) * Math.cos(up) * exit, Math.sin(up) * exit, -Math.cos(dir) * Math.cos(up) * exit);
			S.state = 'fly'; S.t = 0; S.contact = true;
			K.noise(0.08, { vol: 0.2 + q * 0.2, f: 1800 + q * 1500, q: 2 });
			if (q > 0.85) K.say('Crack! Squared up.', 700);
		}
		function next() {
			S.n++; S.contact = false;
			if (S.n >= PITCHES) {
				S.state = 'over'; ball.visible = false;
				K.finish(Math.round(S.total), { unit: 'm', line: `${S.hr} home run${S.hr === 1 ? '' : 's'}, ${S.fair} fair, longest ${Math.round(S.longest)} m`, rows: [['Pitches', S.log.join(' · ')]] });
			} else wait();
		}
		return K.wrap({ build, reset, update, press });
	},
};
