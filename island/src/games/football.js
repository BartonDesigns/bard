// Field goals: six kicks from the hash marks, each one further out, from a chip shot at
// twenty yards to a fifty-two yarder, with the wind shifting between them.
//   swipe up through the ball to kick: straight up the screen is straight at the posts, a
//     slanted swipe hooks it or pushes it; the speed of the swipe is the leg you put into
//     it (too little and it dies under the crossbar; there is plenty of help from a
//     kicker's feel for the distance, less the further out you are).
// The wind drifts the ball across as it flies (the flag and the note say which way and how
// hard): aim into it. Through the uprights and over the bar is good for three; off an
// upright it may yet go in.

import { makeKit, clamp, rand } from './kit.js';
import { fieldVenue, fieldStage, figure, trail } from './fieldgame.js';

const YD = 0.9144, PZ = -10 * YD, BAR = 3.05, HW = 5.64 / 2, DIST = [20, 27, 33, 39, 45, 52], HASH = [0, -6.1, 6.1, -6.1, 6.1, 0];

export const GAME = {
	id: 'football',
	title: 'Field Goals',
	blurb: 'Six kicks from 20 to 52 yards through the wind: swipe up to split the uprights.',
	where: fieldVenue('football'),
	create(ctx) {
		// the stage: the goal line's middle, the posts ten yards behind it
		const F = fieldStage(ctx, 'football', 'full', (f) => [0, -f.d.L / 2 + 10 * YD]);
		const K = makeKit(ctx, GAME, { accent: '#ffb347', pose: F.pose, dist: 1, span: [66, 13, 104], flat: 2.5, backdrop: 'meadow', dome: 125 });
		const { THREE } = ctx;
		let ball, holder, flag, tr, S = {};

		function build() {
			F.lay(K);
			const skin = K.canvas(128, 64, (g) => {
				g.fillStyle = '#7a3a1c'; g.fillRect(0, 0, 128, 64);
				g.fillStyle = '#f4f4ee'; g.fillRect(40, 28, 48, 5); for (let x = 44; x < 88; x += 8) g.fillRect(x, 22, 3, 17);
				g.fillRect(8, 0, 6, 64); g.fillRect(114, 0, 6, 64);
			});
			ball = K.mesh(new THREE.SphereGeometry(0.085, 20, 14), K.mat('#ffffff', { map: skin, rough: 0.7 }));
			ball.scale.set(1, 1, 1.65);
			holder = figure(K, { shirt: '#1d3f7a', pants: '#e8e4d8', cap: '#1d3f7a' });
			holder.g.scale.set(1, 0.62, 1);
			// the wind's flag, on the top of the left upright's ribbon's pole
			flag = K.mesh(new THREE.PlaneGeometry(0.9, 0.5), K.mat('#ff6a1a', { side: THREE.DoubleSide, glow: 0.3 }), 0, 0, 0);
			tr = trail(K, '#ffb347');
		}
		function reset() {
			S = { n: 0, pts: 0, made: 0, state: 'aim', t: 0, log: [], p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0, wind: 0, long: 0 };
			ready();
		}
		const spot = () => [HASH[S.n], PZ + DIST[S.n] * YD];
		function ready() {
			const [x, z] = spot();
			S.state = 'aim'; S.t = 0; S.result = null; S.crossed = false;
			S.p.set(x, K.groundY(x, z) + 0.15, z); S.v.set(0, 0, 0); S.spin = 0;
			// the wind: stronger as the round goes on, either way
			S.wind = (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1.5 + S.n * 0.8);
			holder.g.position.set(x + 0.55, K.groundY(x + 0.55, z), z + 0.1);
			holder.g.rotation.y = Math.PI / 2;
			hud();
		}
		function windText() { const mph = Math.round(Math.abs(S.wind) * 2.237); return mph < 2 ? 'no wind' : `wind ${S.wind < 0 ? '←' : '→'} ${mph} mph`; }
		function hud() { K.hud(`Kick ${Math.min(DIST.length, S.n + 1)} of ${DIST.length} · ${DIST[Math.min(S.n, DIST.length - 1)]} yards · ${windText()}\n${S.pts} pts${S.state === 'aim' ? ' · swipe up to kick' : ''}`); }
		function move() { if (K.ptr.down) tr.draw(); }
		function press(down) {
			if (down || S.state !== 'aim') return;
			const sw = K.swipe(), r = K.size();
			if (sw.dy > -40 || sw.vy > -200) return;
			tr.draw();
			const [x, z] = spot(), D = Math.hypot(x, z - PZ), th = 0.66;
			// the kick a kicker's feel says: clearing the bar by a couple of metres at the posts
			const h = BAR + 2 - 0.15, ideal = Math.sqrt(9.8 * D * D / (2 * Math.cos(th) ** 2 * Math.max(1, D * Math.tan(th) - h)));
			const raw = 12 + (-sw.vy / r.height) * 7, help = 0.62 - S.n * 0.05;
			const v = ideal + (raw - ideal) * (1 - help);
			// the line: straight at the posts, turned by the swipe's slant (more when overhit)
			const base = Math.atan2(-x, z - PZ), turn = clamp(sw.dx / Math.max(60, -sw.dy), -0.8, 0.8) * 0.22 + rand(-0.012, 0.012) * (1 + Math.max(0, raw - ideal) * 0.15);
			const dir = base + turn;
			S.v.set(Math.sin(dir) * Math.cos(th) * v, Math.sin(th) * v, -Math.cos(dir) * Math.cos(th) * v);
			S.state = 'fly'; S.t = 0; S.spin = 11;
			K.noise(0.07, { vol: 0.4, f: 240, type: 'lowpass' }); K.noise(0.05, { vol: 0.2, f: 1200 });
			hud();
		}
		function step(dt) {
			const z0 = S.p.z, g = K.groundY(S.p.x, PZ);
			S.v.x += S.wind * 0.14 * dt;
			S.v.y -= 9.8 * dt;
			S.p.addScaledVector(S.v, dt);
			// the plane of the posts: over the bar and between the uprights, or not
			if (!S.crossed && z0 > PZ && S.p.z <= PZ) {
				S.crossed = true;
				const y = S.p.y - g, ax = Math.abs(S.p.x);
				if (Math.abs(ax - HW) < 0.15 && y > BAR - 0.1) {
					// off an upright: in or out
					S.v.x = -S.v.x * 0.5 + (Math.random() < 0.5 ? -1 : 1) * 1.2; S.v.z *= 0.4;
					S.result = Math.abs(S.p.x + S.v.x * 0.05) < HW && Math.random() < 0.5 ? 'doink good' : 'doink';
					K.tone(420, 0.35, { type: 'triangle', vol: 0.14 });
				} else if (ax < HW && Math.abs(y - BAR) < 0.12) { S.result = S.v.y > 0 || Math.random() < 0.4 ? 'bar good' : 'bar'; K.tone(380, 0.3, { type: 'triangle', vol: 0.12 }); if (S.result === 'bar') S.v.set(S.v.x, -1, -S.v.z * 0.3); }
				else S.result = ax < HW && y > BAR ? 'good' : y <= BAR && ax < HW ? 'short' : 'wide';
			}
			if (S.p.y < g + 0.1) { S.p.y = g + 0.1; S.v.y = Math.abs(S.v.y) * 0.35; S.v.x *= 0.7; S.v.z *= 0.7; S.spin *= 0.5; }
		}
		function update(dt) {
			S.t += dt;
			tr.tick(dt);
			const [x, z] = spot();
			if (S.state === 'fly') {
				for (let i = 0; i < 6; i++) step(dt / 6);
				ball.rotation.x -= S.spin * dt;
				if (S.t > 4.5 || (S.crossed && S.t > 1 && S.p.y - K.groundY(S.p.x, S.p.z) < 0.2)) settle();
			} else if (S.state === 'after' && S.t > 1.3) {
				if (S.n >= DIST.length) over(); else ready();
			}
			ball.position.copy(S.p);
			// (the ball stands on its point in the hold, long axis up)
			ball.scale.set(1, 1, 1.65);
			if (S.state === 'aim') ball.rotation.set(-Math.PI / 2 + 0.12, 0, 0);
			// the flag streams with the wind
			const fy = K.groundY(-HW, PZ) + BAR + 9.1;
			flag.position.set(-HW + Math.sign(S.wind) * 0.45, fy - 0.3, PZ);
			flag.scale.set(0.3 + Math.min(1, Math.abs(S.wind) / 4) * 0.7, 1, 1);
			flag.rotation.y = Math.sin(K.time * 6) * 0.15;
			// the view: behind the ball looking up at the posts, then after it
			const g = K.groundY(x, z);
			if (S.state === 'fly' || S.state === 'after') {
				const bz = Math.max(PZ + 6, S.p.z + 7);
				K.cam(x * 0.8 + (S.p.x - x) * 0.4, g + 2.4 + Math.max(0, S.p.y - g - 2) * 0.4, bz, S.p.x * 0.6, Math.max(g + 3, S.p.y), Math.min(S.p.z - 4, PZ), 2.2);
			} else {
				const a = Math.atan2(-x, z - PZ), bx = x - Math.sin(a) * 6, bzz = z + Math.cos(a) * 6;
				K.cam(bx, g + 2.1, bzz, 0, g + BAR + 1.6, PZ, 3);
			}
		}
		function settle() {
			const R = S.result || 'short', good = R === 'good' || R === 'doink good' || R === 'bar good', d = DIST[S.n];
			if (good) { S.pts += 3; S.made++; S.long = Math.max(S.long, d); K.say(R === 'good' ? `It's good! ${d} yards` : `Off the ${R.startsWith('bar') ? 'bar' : 'upright'}... and in! ${d} yards`, 1400); K.tone(523, 0.12, { vol: 0.1 }); K.tone(784, 0.3, { vol: 0.1, at: 0.12 }); }
			else K.say(R === 'short' ? 'No good: short' : R === 'doink' ? 'Off the upright: no good' : R === 'bar' ? 'Off the crossbar: no good' : `No good: wide ${S.p.x < 0 ? 'left' : 'right'}`, 1300);
			S.log.push(`${d}${good ? '✓' : '✗'}`);
			S.n++; S.state = 'after'; S.t = 0;
			if (S.n < DIST.length) hud();
		}
		function over() {
			S.state = 'over';
			K.finish(S.pts, { unit: 'pts', line: `${S.made} of ${DIST.length}${S.long ? `, long of ${S.long} yards` : ''}`, rows: [['Kicks (yards)', S.log.join(' · ')]] });
		}
		return K.wrap({ build, reset, update, press, move, end: F.unlay });
	},
};
