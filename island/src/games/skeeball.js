// Skee-ball, the way the old wooden machines at the Musée Mécanique play it: nine wooden
// balls, a ten-foot alley that climbs to the hump, and the board of rings behind it, 10 at
// the bottom up to 50 in the middle and the 100 pockets in the top corners.
//   swipe up the alley to roll. How fast you roll decides how high the ball jumps off the
//     hump and so where it lands on the board; the slant of the swipe steers it left or
//     right. Too soft and it rolls back to you (that one's a zero).
// The ball rolls up the incline losing speed, leaves the hump at an angle and flies a real
// arc until it meets the sloping board; then it drops into the pocket below where it
// landed, with a clunk and the lights.

import { makeKit, clamp } from './kit.js';

const BALLS = 9, R = 0.045, SLOPE = 0.17, ALLEY = 3.0, DECEL = 2.2;
// the board: its foot and top (height, depth), so a point on it is found by its height
const FOOT = [1.2, -3.3], TOP = [2.0, -4.1], BOARD_W = 0.8;
const boardLen = Math.hypot(TOP[0] - FOOT[0], TOP[1] - FOOT[1]);
// the pockets: points, and centre on the board (x, distance up the board)
const RINGS = [[50, 0, 0.62, 0.075], [40, 0, 0.5, 0.14], [30, 0, 0.5, 0.22], [20, 0, 0.5, 0.31]];
const CORNERS = [[-0.3, 0.95], [0.3, 0.95]];

function pocketFor(x, u) {
	for (const [cx, cu] of CORNERS) if (Math.hypot(x - cx, u - cu) < 0.08) return 100;
	for (const [pts, cx, cu, r] of RINGS) if (Math.hypot(x - cx, u - cu) < r) return pts;
	return 10;
}

export const GAME = {
	id: 'skeeball',
	title: 'Skee-Ball',
	blurb: 'Nine wooden balls up the alley: land them in the 50, or the 100 corners.',
	where: { kind: 'site', sites: [{ name: 'Musée Mécanique, Pier 45', lat: 37.8094, lon: -122.4169, r: 50 }, { name: 'Santa Cruz Beach Boardwalk arcade', lat: 36.9643, lon: -122.0177, r: 80 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ff7a45', dist: 1.5, span: [2, 5] });
		const { THREE } = ctx;
		let ball, S = {}, lights = [];

		function build() {
			// the cabinet: the alley, glass-free rails, the hump, the ring board, the marquee
			const alleyLen = Math.hypot(ALLEY, ALLEY * SLOPE);
			const lane = K.box(0.56, 0.04, alleyLen, '#b88a52', 0, 0.8 + ALLEY * SLOPE / 2 - 0.02, -ALLEY / 2);
			lane.rotation.x = Math.atan(SLOPE);
			for (const s of [-1, 1]) {
				const rail = K.box(0.05, 0.14, alleyLen, '#7a1f2b', s * 0.3, 0.86 + ALLEY * SLOPE / 2, -ALLEY / 2);
				rail.rotation.x = Math.atan(SLOPE);
				K.box(0.06, 2.2, 1.3, '#7a1f2b', s * 0.45, 1.1, -3.7);
			}
			K.box(0.56, 0.8, ALLEY, '#5a1620', 0, 0.4, -ALLEY / 2);
			const hump = K.cyl(0.09, 0.09, 0.56, '#c89a5a', 0, 0.8 + ALLEY * SLOPE - 0.05, -ALLEY);
			hump.rotation.z = Math.PI / 2;
			const face = K.canvas(256, 384, (g, w, h) => {
				g.fillStyle = '#23304a'; g.fillRect(0, 0, w, h);
				const px = (x) => w / 2 + x / BOARD_W * w, py = (u) => h - u / boardLen * h;
				const cols = { 10: '#2e6fb7', 20: '#3fa34d', 30: '#e0b12a', 40: '#e2702a', 50: '#d1323a', 100: '#b04fd1' };
				for (const [pts, cx, cu, r] of RINGS.slice().reverse()) { g.fillStyle = cols[pts]; g.beginPath(); g.arc(px(cx), py(cu), r / BOARD_W * w, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
				for (const [cx, cu] of CORNERS) { g.fillStyle = cols[100]; g.beginPath(); g.arc(px(cx), py(cu), 0.08 / BOARD_W * w, 0, 7); g.fill(); g.stroke(); }
				g.fillStyle = '#fff'; g.font = 'bold 18px system-ui'; g.textAlign = 'center';
				g.fillText('50', px(0), py(0.6)); g.fillText('40', px(0), py(0.41)); g.fillText('30', px(0), py(0.33)); g.fillText('20', px(0), py(0.24)); g.fillText('10', px(0), py(0.08));
				for (const [cx, cu] of CORNERS) g.fillText('100', px(cx), py(cu) + 6);
			});
			const board = K.mesh(new THREE.PlaneGeometry(BOARD_W, boardLen), K.mat('#ffffff', { map: face, glow: 0.35 }), 0, (FOOT[0] + TOP[0]) / 2, (FOOT[1] + TOP[1]) / 2);
			board.rotation.x = -Math.atan2(TOP[0] - FOOT[0], FOOT[1] - TOP[1]);
			K.box(BOARD_W, 1.2, 0.05, '#1a2233', 0, 0.6, -3.3);
			const marquee = K.canvas(512, 128, (g) => { g.fillStyle = '#7a1f2b'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#ffd35a'; g.font = 'bold 66px Georgia,serif'; g.textAlign = 'center'; g.fillText('SKEE-BALL', 256, 88); });
			K.box(1.0, 0.36, 0.08, K.mat('#ffffff', { map: marquee, glow: 0.5 }), 0, 2.4, -3.1);
			lights = [];
			for (let i = 0; i < 12; i++) lights.push(K.ball(0.025, K.mat(i % 2 ? '#ffd35a' : '#ff5a5a', { glow: 0.2 }), -0.48 + i * 0.087, 2.62, -3.08));
			ball = K.ball(R, K.mat('#8a5a2b', { rough: 0.5 }), 0, 0.85, 0.1);
		}
		function reset() {
			S = { left: BALLS, score: 0, state: 'ready', pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, flash: 0, log: [] };
			ready();
		}
		function ready() {
			S.state = 'ready'; S.pos.set(0, 0.8 + R, 0.15); ball.visible = true;
			K.hud(`Balls ${S.left} · score ${S.score}${K.best() !== null ? ` · best ${K.best()}` : ''}`);
		}
		function press(down) {
			if (down || S.state !== 'ready') return;
			const sw = K.swipe();
			if (sw.vy > -200 || sw.dy > -30) return;
			const v = clamp(-sw.vy / 330, 2.5, 8.5);
			const dir = clamp(sw.dx / Math.max(60, -sw.dy), -0.5, 0.5) * 0.18;
			S.vel.set(Math.sin(dir) * v, 0, -Math.cos(dir) * v);
			S.state = 'alley'; S.left--; S.t = 0;
			K.noise(0.8, { vol: 0.1, f: 220, type: 'lowpass' });
		}
		function score(pts) {
			S.score += pts; S.log.push(pts); S.flash = 1;
			K.say(pts === 100 ? '100!' : `${pts}`, 900);
			K.noise(0.1, { vol: 0.25, f: 300, type: 'lowpass' });
			if (pts >= 40) { K.tone(784, 0.12, { vol: 0.1 }); K.tone(1046, 0.25, { vol: 0.1, at: 0.1 }); }
		}
		function next() {
			if (S.left > 0) { ready(); return; }
			S.state = 'done'; ball.visible = false;
			K.hud(`Score ${S.score}`);
			const tickets = Math.floor(S.score / 30);
			K.finish(S.score, { line: `${tickets} ticket${tickets === 1 ? '' : 's'} from the machine.`, rows: [['Balls', S.log.join(' · ')], ['Best ball', Math.max(0, ...S.log)]] });
		}
		// the height of the board at a depth z, and how far up it a point is
		const boardY = (z) => FOOT[0] + (FOOT[1] - z) / (FOOT[1] - TOP[1]) * (TOP[0] - FOOT[0]);
		function update(dt) {
			S.t += dt;
			if (S.state === 'alley') {
				// up the incline: slowing under gravity and rolling friction
				const sp = Math.hypot(S.vel.x, S.vel.z), ns = sp - DECEL * dt;
				if (ns <= 0) { S.state = 'back'; S.t = 0; K.say('Too soft: it rolled back.', 1200); S.log.push(0); }
				else {
					S.vel.x *= ns / sp; S.vel.z *= ns / sp;
					S.pos.x += S.vel.x * dt; S.pos.z += S.vel.z * dt;
					if (Math.abs(S.pos.x) > 0.26) { S.pos.x = Math.sign(S.pos.x) * 0.26; S.vel.x *= -0.5; }
					S.pos.y = 0.8 + R + (-S.pos.z) * SLOPE;
					if (S.pos.z <= -ALLEY) {
						// off the hump: the ball leaves at 35 degrees
						const a = 0.61;
						S.vel.set(S.vel.x, ns * Math.sin(a), -ns * Math.cos(a));
						S.state = 'fly'; K.noise(0.08, { vol: 0.15, f: 500 });
					}
				}
			} else if (S.state === 'back') {
				S.pos.z = Math.min(0.15, S.pos.z + dt * 1.2); S.pos.y = 0.8 + R + Math.max(0, -S.pos.z) * SLOPE;
				if (S.pos.z >= 0.15) next();
			} else if (S.state === 'fly') {
				S.vel.y -= 9.8 * dt;
				S.pos.addScaledVector(S.vel, dt);
				S.pos.x = clamp(S.pos.x, -BOARD_W / 2 + R, BOARD_W / 2 - R);
				if (S.pos.z < TOP[1]) { S.pos.z = TOP[1]; S.vel.z = Math.abs(S.vel.z) * 0.3; }
				// it meets the board: into the pocket below where it landed
				if (S.pos.z < FOOT[1] && S.pos.y - R < boardY(S.pos.z)) {
					const u = clamp((FOOT[1] - S.pos.z) / (FOOT[1] - TOP[1]) * boardLen, 0, boardLen);
					S.pts = pocketFor(S.pos.x, u);
					S.state = 'drop'; S.t = 0;
				} else if (S.pos.y < 0.5) { S.pts = 10; S.state = 'drop'; S.t = 0; }
			} else if (S.state === 'drop') {
				S.pos.y -= dt * 0.6; S.pos.z += dt * 0.2;
				if (S.t > 0.35) { ball.visible = false; score(S.pts); S.state = 'wait'; S.t = 0; }
			} else if (S.state === 'wait' && S.t > 0.8) next();
			ball.position.copy(S.pos);
			ball.rotation.x -= (S.vel.z || 0) * dt / R;
			// the marquee lights chase, and flash on a good ball
			S.flash = Math.max(0, S.flash - dt * 0.8);
			lights.forEach((l, i) => { l.visible = S.flash > 0 ? Math.floor(S.t * 12) % 2 === 0 : (Math.floor(K.time * 4) + i) % 3 !== 0; });
			if (S.state === 'fly' || S.state === 'drop') K.cam(0, 1.9, -1.2, 0, 1.4, -3.8, 3);
			else K.cam(0, 1.65, 1.3, 0, 1.2, -3.2, 3);
		}
		return K.wrap({ build, reset, update, press });
	},
};
