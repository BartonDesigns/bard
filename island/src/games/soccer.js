// Penalty kicks on the pitch: eight shots from the spot at a keeper who gets sharper each time.
//   swipe from the ball to where you want it in the goal: the end of the swipe is the spot
//     you're aiming at (a short swipe keeps it low, a long one lifts it), its speed is how
//     hard you strike it, and a swipe that bends curls the ball the same way.
// The keeper waits for the kick, then dives: sometimes they read it, sometimes they guess.
// A hard shot gets there before a dive does, but strike it too hard and it rises over the
// bar. Into the top corners is out of anyone's reach. The ball flies with gravity and a
// curl, bounces off the posts and the bar, and bulges the net.

import { makeKit, clamp, rand } from './kit.js';
import { fieldVenue, fieldStage, figure, trail, onWall } from './fieldgame.js';

const GZ = -11, GW = 7.32, GH = 2.44, BR = 0.11, KICKS = 8, KZ = GZ + 0.45;

export const GAME = {
	id: 'soccer',
	title: 'Penalty Kicks',
	blurb: 'Eight penalties at a keeper: swipe to your spot, beat the dive.',
	where: fieldVenue('soccer'),
	create(ctx) {
		const F = fieldStage(ctx, 'soccer', 'youth');
		const K = makeKit(ctx, GAME, { accent: '#4fd1ff', pose: F.pose, dist: 1, span: [56, 17, F.field.d.L - 6], flat: 2, backdrop: 'meadow', dome: 115 });
		const { THREE } = ctx;
		let ball, keeper, tr, S = {};

		function build() {
			F.lay(K);
			const skin = K.canvas(128, 64, (g) => {
				g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#1a1a1a';
				for (const [x, y] of [[16, 16], [48, 40], [80, 16], [112, 40], [0, 48], [64, 60]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); } g.fill(); }
			});
			ball = K.ball(BR, K.mat('#ffffff', { map: skin, rough: 0.5 }), 0, BR, 0);
			keeper = figure(K, { shirt: '#d8f03a', pants: '#1a1a1a', skin: '#b0764a' });
			for (const a of keeper.arms) K.ball(0.08, K.mat('#f4f4f0'), 0, -0.64, 0, a);
			// the kicker's own shadow of a run-up: a mark where the ball sits
			K.decal(0.5, 0.5, K.canvas(32, 32, (g) => { g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(16, 16, 6, 0, 7); g.fill(); }), 0, K.groundY(0, 0) + 0.075, 0, { opacity: 0.9 });
			tr = trail(K, '#4fd1ff');
		}
		function reset() {
			S = { n: 0, goals: 0, saves: 0, wide: 0, bins: 0, state: 'aim', t: 0, log: [], p: new THREE.Vector3(0, BR, 0), v: new THREE.Vector3(), side: 0, kp: { bx: 0, phi: 0, jy: 0 }, dive: null };
			ready();
		}
		const gy = () => K.groundY(0, GZ);
		function ready() {
			S.state = 'aim'; S.t = 0; S.p.set(0, K.groundY(0, 0) + BR, 0); S.v.set(0, 0, 0); S.dive = null; S.crossed = false; S.result = null;
			S.kp = { bx: 0, phi: 0, jy: 0 };
			hud();
		}
		function hud() { K.hud(`Kick ${Math.min(KICKS, S.n + 1)} of ${KICKS} · ${S.goals} goal${S.goals === 1 ? '' : 's'}${S.state === 'aim' ? '\nSwipe from the ball to your spot in the goal' : ''}`); }
		function move() { if (K.ptr.down) tr.draw(); }
		function press(down) {
			if (down || S.state !== 'aim') return;
			const sw = K.swipe(), r = K.size();
			if (sw.dy > -30 || sw.time > 1.5) return;
			tr.draw();
			// the aim: the swipe laid from the ball's place on the screen, onto the goal's plane
			const b = K.toScreen(S.p), gain = 1.15;
			const aim = aimAt(b.x + sw.dx * gain, b.y + sw.dy * gain);
			if (!aim) return;
			// how hard: the flick's speed in screen heights a second
			const k = Math.hypot(sw.vx, sw.vy) / r.height, speed = clamp(15 + k * 4, 15, 34);
			// struck too hard it rises; a little scatter always
			const over = Math.max(0, speed - 28) * 0.16;
			let tx = aim.x + rand(-0.12, 0.12) * (1 + over * 2), ty = Math.max(BR, aim.y + over + rand(-0.08, 0.08));
			// the bend: how far the swipe bowed off its straight line
			const h = sw.hist, a0 = h[0], a1 = h[h.length - 1];
			let bow = 0;
			if (a0 && a1) {
				const cx = a1[0] - a0[0], cy = a1[1] - a0[1], L = Math.hypot(cx, cy) || 1;
				for (const q of h) { const d = ((q[0] - a0[0]) * cy - (q[1] - a0[1]) * cx) / L; if (Math.abs(d) > Math.abs(bow)) bow = d; }
				bow = clamp(bow / L, -0.35, 0.35);
			}
			tx = clamp(tx, -9, 9); ty = clamp(ty, BR, 7);
			const dist = Math.hypot(tx, GZ), T = dist / speed, side = -bow * 22;
			S.side = side;
			S.v.set((tx - 0.5 * side * T * T) / T, (gy() + ty - S.p.y + 0.5 * 9.8 * T * T) / T, GZ / T);
			S.state = 'fly'; S.t = 0; S.n++;
			S.top = Math.abs(tx) > GW / 2 - 1.1 && ty > GH - 0.9;
			// the keeper: reads it (more often as the round goes on), or guesses a side
			const read = Math.random() < 0.28 + S.n * 0.06;
			const guess = read ? { x: tx + rand(-0.5, 0.5), y: ty + rand(-0.3, 0.3) } : { x: [-2.6, -1.4, 0, 1.4, 2.6][Math.floor(Math.random() * 5)], y: rand(0.3, 1.8) };
			S.dive = { x: clamp(guess.x, -3.4, 3.4), y: clamp(guess.y, 0.2, 2.3), wait: Math.max(0.12, 0.24 - S.n * 0.012), dur: 0.42 };
			K.noise(0.08, { vol: 0.35, f: 260, type: 'lowpass' }); K.noise(0.05, { vol: 0.15, f: 1400 });
			hud();
		}
		// a screen point on the goal's plane, its height above the goalmouth's ground
		function aimAt(x, y) { const p = onWall(K, x, y, GZ); if (p) p.y -= gy(); return p; }
		function keeperAt(dt) {
			const D = S.dive, P = S.kp;
			if (!D || S.t < D.wait) return;
			const u = clamp((S.t - D.wait) / D.dur, 0, 1), e = 1 - (1 - u) * (1 - u);
			const bx = clamp(D.x * 0.35, -1.3, 1.3), phi = clamp(Math.atan2(D.x - bx, Math.max(0.35, D.y - 0.1)), -1.45, 1.45), jy = clamp((D.y - 1.7) * 0.6, 0, 0.55);
			P.bx += (bx * e - P.bx) * Math.min(1, dt * 20); P.phi = phi * e; P.jy = jy * Math.sin(Math.PI * Math.min(1, u * 1.2));
		}
		// the keeper's reach: a line from the feet to the gloves
		function reach() {
			const P = S.kp, g = gy();
			return [P.bx, g + 0.1 + P.jy, P.bx + Math.sin(P.phi) * 2.35, g + 0.1 + P.jy + Math.cos(P.phi) * 2.35];
		}
		function segD(px, py, [ax, ay, bx, by]) { const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
		function step(dt) {
			const z0 = S.p.z, g = gy();
			S.v.x += S.side * dt * (S.p.z > GZ ? 1 : 0);
			S.v.y -= 9.8 * dt;
			S.p.addScaledVector(S.v, dt);
			const y = S.p.y - g;
			// the keeper's line
			if (!S.result && z0 > KZ && S.p.z <= KZ && segD(S.p.x, S.p.y, reach()) < 0.36 + BR) {
				S.result = 'save'; S.v.set(S.v.x * 0.3 + rand(-2, 2), Math.abs(S.v.y) * 0.4 + 3, -S.v.z * 0.35);
				K.noise(0.1, { vol: 0.3, f: 300, type: 'lowpass' });
			}
			// the goal line: in, off the woodwork, or wide
			if (!S.crossed && z0 > GZ && S.p.z <= GZ) {
				S.crossed = true;
				const ax = Math.abs(S.p.x);
				if (!S.result && Math.abs(ax - GW / 2) < BR + 0.06 && y < GH + 0.06) { S.result = 'post'; S.v.set(-S.v.x * 0.6 + Math.sign(S.p.x) * 1.5, S.v.y * 0.5, -S.v.z * 0.4); S.p.z = GZ + 0.1; S.crossed = false; K.tone(520, 0.3, { type: 'triangle', vol: 0.12 }); }
				else if (!S.result && Math.abs(y - GH) < BR + 0.06 && ax < GW / 2) { S.result = 'bar'; S.v.set(S.v.x * 0.6, -Math.abs(S.v.y) * 0.4 - 1, -S.v.z * 0.4); S.p.z = GZ + 0.1; S.crossed = false; K.tone(480, 0.3, { type: 'triangle', vol: 0.12 }); }
				else if (!S.result || S.result === 'post' || S.result === 'bar') S.result = ax < GW / 2 - BR && y < GH - BR ? 'goal' : S.result === 'post' || S.result === 'bar' ? S.result : 'wide';
			}
			// the net takes it
			if (S.result === 'goal' && S.p.z < GZ - 0.4) { S.v.multiplyScalar(Math.exp(-dt * 9)); if (S.p.z < GZ - 1.7) { S.p.z = GZ - 1.7; S.v.z = Math.abs(S.v.z) * 0.1; } }
			// the ground
			if (S.p.y < g + BR) { S.p.y = g + BR; if (S.v.y < -0.5) S.v.y = -S.v.y * 0.45; else S.v.y = 0; S.v.x *= 0.985; S.v.z *= 0.985; }
		}
		function update(dt) {
			S.t += dt;
			tr.tick(dt);
			if (S.state === 'fly') {
				keeperAt(dt);
				for (let i = 0; i < 6; i++) step(dt / 6);
				ball.rotation.x -= dt * S.v.z * 3; ball.rotation.z -= dt * S.side;
				if (S.t > 2.4 || (S.t > 1 && S.v.length() < 0.3)) settle();
			} else if (S.state === 'after') {
				if (S.t > 1.1) { if (S.n >= KICKS) over(); else ready(); }
			}
			// the keeper: bouncing on the line while you line up, diving after the kick
			const P = S.kp, g = gy(), hop = S.state === 'aim' ? Math.abs(Math.sin(K.time * 5)) * 0.08 : 0;
			keeper.g.position.set(P.bx + (S.state === 'aim' ? Math.sin(K.time * 1.7) * 0.4 : 0), g + P.jy + hop, KZ - 0.1);
			keeper.g.rotation.set(0, Math.PI, P.phi);
			const up = S.dive && S.t > S.dive.wait ? Math.min(1, (S.t - S.dive.wait) * 5) : 0;
			keeper.arms[0].rotation.z = -0.5 - up * 2.4; keeper.arms[1].rotation.z = 0.5 + up * 2.4;
			ball.position.copy(S.p);
			// the shot: from behind the spot, the goal filling the screen's width, the ball in view below it
			const bz = S.state === 'fly' ? clamp(S.p.z, GZ + 1, 0) : 0;
			const cam = K.camera, hw = Math.atan(Math.tan((cam.fov || 50) * Math.PI / 360) * (cam.aspect || 1));
			const D = clamp((GW + 1.6) / 2 / Math.tan(hw) / 0.93, 16, 32), cz = GZ + D + bz * 0.15;
			K.cam(0, g + 1.6 + D * 0.12, cz, 0, g + 0.9, GZ * 0.55, 3);
		}
		function settle() {
			const R = S.result || 'wide';
			if (R === 'goal') { S.goals++; if (S.top) S.bins++; K.say(S.top ? 'Top corner! Goal!' : 'Goal!', 1200); K.noise(0.5, { vol: 0.12, f: 900, q: 0.4 }); K.tone(660, 0.12, { vol: 0.1 }); K.tone(880, 0.25, { vol: 0.1, at: 0.12 }); }
			else if (R === 'save') { S.saves++; K.say('Saved!', 1100); }
			else if (R === 'post' || R === 'bar') { S.wide++; K.say(R === 'post' ? 'Off the post!' : 'Off the bar!', 1100); }
			else { S.wide++; K.say(S.p.y - gy() > GH ? 'Over the bar' : 'Wide', 1000); }
			S.log.push(R === 'goal' ? (S.top ? 'top' : 'goal') : R);
			S.state = 'after'; S.t = 0; hud();
		}
		function over() {
			S.state = 'over';
			K.finish(S.goals, { unit: `of ${KICKS}`, line: `${S.saves} saved, ${S.wide} off target${S.bins ? `, ${S.bins} in the top corner` : ''}`, rows: [['Kicks', S.log.join(' · ')]] });
		}
		return K.wrap({ build, reset, update, press, move, end: F.unlay });
	},
};
