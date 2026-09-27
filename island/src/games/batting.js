// Batting practice in a batting cage: a pitching machine, ten pitches, and an imaginary
// fence at a hundred metres (the net stops the ball; the board works out where it would
// have landed).
//   tap to swing. The swing takes a moment to come round, so start it as the ball is on
//     its way: dead on time and you square it up; early and you pull it (to the left),
//     late and it goes the other way. Tap high on the screen to get under it and lift it,
//     low to hit it on the ground.
// The machine mixes its pitches: fastballs, change-ups that make you swing early, and
// curveballs that drop late. A hit leaves the bat at up to a hundred miles an hour and
// flies a real arc with air drag into the netting; its carry on an open field is run on to
// the ground. Fair balls count their distance; over the fence is a home run. Outside the
// lines is foul.

import { makeKit, clamp, rand } from './kit.js';

const MOUND = 16, SWING = 0.16, PITCHES = 10, FENCE = 100;
const TYPES = [['Fastball', 33, 0, 0], ['Fastball', 31, 0, 0], ['Change-up', 24, 0, 0], ['Curveball', 26, -0.9, 0.5], ['Slider', 28, -0.3, -0.6]];

export const GAME = {
	id: 'batting',
	title: 'Batting Practice',
	blurb: 'Ten pitches from the machine: time the swing, square it up, clear the fence.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#6bd66b', dist: 1.5, room: { w: 6, z0: -19, z1: 4, h: 5, style: 'cage' } });
		const { THREE } = ctx;
		let ball, bat, S = {};

		function build() {
			// the plate and the box, the machine behind its screen
			K.mesh(new THREE.CircleGeometry(4, 24), K.mat('#a8744a', { rough: 1 }), 0, 0.01, 0).rotation.x = -Math.PI / 2;
			const plate = K.mesh(new THREE.CircleGeometry(0.3, 5), K.mat('#f4f4f0'), 0, 0.02, 0);
			plate.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
			K.box(0.9, 0.012, 1.8, K.mat('#e8dcc8', { opacity: 0.5 }), -0.9, 0.015, 0);
			K.box(0.9, 1.1, 0.6, '#2a4a8a', 0, 0.55, -MOUND - 0.4);
			for (const x of [-0.25, 0.25]) K.cyl(0.18, 0.18, 0.1, '#222', x, 1.25, -MOUND - 0.2).rotation.x = Math.PI / 2;
			K.box(1.8, 1.8, 0.05, K.mat('#2a2a2a', { opacity: 0.5 }), 0, 0.9, -MOUND + 0.9);
			// the scoreboard at the back of the cage: how far each hit would have carried
			const board = K.canvas(256, 96, (g) => { g.fillStyle = '#10301c'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#ffd23f'; g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillText(`FENCE ${FENCE} m`, 128, 58); });
			K.box(2.4, 0.9, 0.05, K.mat('#ffffff', { map: board, glow: 0.6 }), 0, 3.6, -18.9);
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
				// the ball flies until the netting stops it; where it would have landed on an open
				// field was worked out at contact (carry)
				S.v.addScaledVector(S.v, -0.0045 * S.v.length() * dt);
				S.v.y -= 9.8 * dt;
				S.p.addScaledVector(S.v, dt);
				if (!S.netted && (Math.abs(S.p.x) > 2.55 || S.p.z < -18.6 || S.p.y > 4.6)) { S.netted = true; S.v.multiplyScalar(-0.08); K.noise(0.2, { vol: 0.08, f: 300 }); }
				if (S.p.y < 0.04) { S.p.y = 0.04; S.v.set(S.v.x * 0.5, Math.abs(S.v.y) * 0.3, S.v.z * 0.5); }
				if (S.t > 1.6) {
					const { d, x, z } = S.carry, foul = Math.abs(Math.atan2(x, -z)) > Math.PI / 4;
					if (foul) { K.say('Foul ball', 1000); S.log.push('foul'); }
					else {
						const hr = d >= FENCE;
						S.total += d; S.fair++; S.longest = Math.max(S.longest, d);
						if (hr) S.hr++;
						S.log.push(`${Math.round(d)} m`);
						K.say(hr ? `Home run! It would have carried ${Math.round(d)} m` : `That would have carried ${Math.round(d)} m`, 1600);
						if (hr) { K.tone(523, 0.15, { vol: 0.1 }); K.tone(659, 0.15, { vol: 0.1, at: 0.15 }); K.tone(784, 0.4, { vol: 0.1, at: 0.3 }); }
					}
					next();
				}
			}
			// the bat comes round over SWING seconds and follows through
			const sw = S.swingT < 0 ? 0 : clamp(S.swingT / (SWING * 1.6), 0, 1);
			bat.rotation.set(0, -sw * 3.4, 0.9 - sw * 0.75);
			ball.position.copy(S.p);
			K.cam(0.55, 1.65, 2.3, -0.1, 1.1, -MOUND, 4);
		}
		function hit(e, q) {
			// early pulls it left, late pushes it right; the lift from where you tapped
			const exit = 22 + q * 22, dir = -clamp(e / 0.1, -1, 1) * 0.95 + rand(-0.08, 0.08), up = clamp(0.2 + S.lift * 0.9 + (1 - q) * rand(-0.3, 0.3), -0.25, 1.2);
			S.v.set(Math.sin(dir) * Math.cos(up) * exit, Math.sin(up) * exit, -Math.cos(dir) * Math.cos(up) * exit);
			S.state = 'fly'; S.t = 0; S.contact = true; S.netted = false;
			// the carry on an open field: the same flight, run on to the ground
			const p = S.p.clone(), v = S.v.clone();
			for (let i = 0; i < 1200 && (p.y > 0 || v.y > 0); i++) { v.addScaledVector(v, -0.0045 * v.length() / 120); v.y -= 9.8 / 120; p.addScaledVector(v, 1 / 120); }
			S.carry = { d: Math.hypot(p.x, p.z), x: p.x, z: p.z };
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
