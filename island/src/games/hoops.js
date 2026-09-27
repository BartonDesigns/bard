// Hoops: sixty seconds on an outdoor court with a rack of balls, pop-a-shot style.
//   swipe up to shoot. The speed of the swipe is the strength of the shot (too soft falls
//     short, too hard clanks off the back of the rim or the glass); the slant of the swipe
//     aims left or right. There is a little help from your muscle memory: every shot is
//     nudged toward a good one, less so the farther out you are.
// The ball flies a true arc and bounces off the rim (a ring of steel), the backboard and
// the ground. A basket counts when the ball drops down through the hoop. Make three in a
// row and you move back a step: 2 points from the line, 3 from the arc. A swish is worth
// one more.

import { makeKit, clamp } from './kit.js';

const RIM_H = 3.05, RIM_R = 0.2286, BR = 0.12, BOARD_Z = -0.15, RIM_Z = BOARD_Z + 0.15 + RIM_R, TIME = 60;
const SPOTS = [[0, 4.2, 2], [-1.6, 4.4, 2], [1.6, 4.4, 2], [0, 6.75, 3], [-3.5, 5.8, 3], [3.5, 5.8, 3]];

export const GAME = {
	id: 'hoops',
	title: 'Hoops',
	blurb: 'Sixty seconds, a rack of balls, and a hoop: swipe up to shoot.',
	where: { kind: 'site', sites: [{ name: 'Panhandle basketball court', lat: 37.7722, lon: -122.4455, r: 60 }, { name: 'Mission Playground courts', lat: 37.7594, lon: -122.4229, r: 50 }, { name: 'Potrero Hill Rec Center courts', lat: 37.7572, lon: -122.3980, r: 60 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ff8a3d', dist: 8, span: [9, 1, 9], flat: 0.8, backdrop: 'meadow', dome: 40 });
		const { THREE } = ctx;
		let ball, net, S = {};
		const rimPts = [];
		for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rimPts.push([Math.cos(a) * RIM_R, RIM_Z + Math.sin(a) * RIM_R]); }

		function build() {
			// the court is laid out with the hoop at the stage's origin, facing the player
			const court = K.canvas(512, 512, (g, w, h) => {
				g.fillStyle = '#3d6b8c'; g.fillRect(0, 0, w, h);
				g.fillStyle = '#b0503a'; g.fillRect(w / 2 - 49, 0, 98, 150);
				g.strokeStyle = '#fff'; g.lineWidth = 3;
				g.strokeRect(w / 2 - 49, 0, 98, 150);
				g.beginPath(); g.arc(w / 2, 150, 46, 0, Math.PI); g.stroke();
				g.beginPath(); g.arc(w / 2, 12, 216, 0.08, Math.PI - 0.08); g.stroke();
			});
			K.decal(16, 16, court, 0, 0.02, 8 - 1.2);
			K.cyl(0.08, 0.08, RIM_H + 0.5, '#555a60', 0, (RIM_H + 0.5) / 2, BOARD_Z - 1.1);
			K.box(0.12, 0.12, 1.1, '#555a60', 0, RIM_H + 0.4, BOARD_Z - 0.55);
			const glass = K.canvas(256, 150, (g) => { g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 150); g.strokeStyle = '#d1323a'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 142); g.strokeRect(88, 70, 80, 60); });
			K.box(1.83, 1.07, 0.04, K.mat('#ffffff', { map: glass }), 0, RIM_H + 0.4, BOARD_Z - 0.02);
			const rim = K.mesh(new THREE.TorusGeometry(RIM_R, 0.01, 8, 32), K.mat('#e2552a', { metal: 0.5 }), 0, RIM_H, RIM_Z);
			rim.rotation.x = Math.PI / 2;
			net = K.mesh(new THREE.CylinderGeometry(RIM_R, RIM_R * 0.6, 0.4, 12, 3, true), K.mat('#ffffff', { opacity: 0.55, side: THREE.DoubleSide, rough: 1 }), 0, RIM_H - 0.2, RIM_Z);
			net.material.wireframe = true;
			const skin = K.canvas(128, 64, (g) => { g.fillStyle = '#d8672a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#2a140a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); for (const x of [32, 64, 96]) { g.moveTo(x, 0); g.lineTo(x, 64); } g.stroke(); });
			ball = K.ball(BR, K.mat('#ffffff', { map: skin, rough: 0.8 }), 0, 1, 4);
		}
		function reset() {
			S = { time: TIME, score: 0, made: 0, shots: 0, streak: 0, spot: 0, state: 'ready', p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, swish: true, started: false, swishes: 0 };
			ready();
		}
		function spot() { return SPOTS[S.spot]; }
		function ready() {
			const [x, z] = spot();
			S.state = 'ready'; S.p.set(x, 2.0, z); S.v.set(0, 0, 0); S.swish = true; S.counted = false;
		}
		function press(down) {
			if (down || S.state !== 'ready' || S.time <= 0) return;
			const sw = K.swipe();
			if (sw.vy > -300 || sw.dy > -40) return;
			S.started = true;
			// the perfect shot from here: 52 degrees, straight at the rim
			const [x, z] = spot(), dx = -x, dz = RIM_Z - z, d = Math.hypot(dx, dz), h = RIM_H - 2.0, th = 0.9;
			const ideal = 1.025 * Math.sqrt(9.8 * d * d / (2 * Math.cos(th) ** 2 * (d * Math.tan(th) - h)));
			const raw = 3 + -sw.vy / 550, help = d < 5 ? 0.15 : 0.22;
			const v = ideal + (raw - ideal) * help;
			// the slant of the swipe turns the shot off the straight line (right is right)
			const dir = Math.atan2(dx, dz) - clamp(sw.dx / Math.max(60, -sw.dy), -0.6, 0.6) * 0.12 * help;
			S.v.set(Math.sin(dir) * Math.cos(th) * v, Math.sin(th) * v, Math.cos(dir) * Math.cos(th) * v);
			S.p.y = 2.0; S.state = 'fly'; S.t = 0; S.shots++;
			K.noise(0.12, { vol: 0.08, f: 600 });
		}
		function bounce(nx, ny, nz, e) {
			const vn = S.v.x * nx + S.v.y * ny + S.v.z * nz;
			if (vn < 0) { S.v.x -= (1 + e) * vn * nx; S.v.y -= (1 + e) * vn * ny; S.v.z -= (1 + e) * vn * nz; S.v.multiplyScalar(0.92); return true; }
			return false;
		}
		function step(dt) {
			S.v.y -= 9.8 * dt;
			const y0 = S.p.y;
			S.p.addScaledVector(S.v, dt);
			// the rim: the nearest point of the steel ring
			for (const [rx, rz] of rimPts) {
				const dx = S.p.x - rx, dy = S.p.y - RIM_H, dz = S.p.z - rz, d = Math.hypot(dx, dy, dz);
				if (d < BR + 0.01 && d > 1e-6) {
					S.p.set(rx + dx / d * (BR + 0.01), RIM_H + dy / d * (BR + 0.01), rz + dz / d * (BR + 0.01));
					if (bounce(dx / d, dy / d, dz / d, 0.6)) { S.swish = false; K.tone(190, 0.18, { type: 'triangle', vol: 0.12 }); }
				}
			}
			// the backboard
			if (S.p.z - BR < BOARD_Z && S.p.z > BOARD_Z - 0.3 && Math.abs(S.p.x) < 0.92 && Math.abs(S.p.y - RIM_H - 0.4) < 0.54) { S.p.z = BOARD_Z + BR; if (bounce(0, 0, 1, 0.55)) { S.swish = false; K.noise(0.08, { vol: 0.2, f: 500 }); } }
			// the ground
			if (S.p.y < BR) { S.p.y = BR; if (bounce(0, 1, 0, 0.7)) K.noise(0.1, { vol: 0.15, f: 160, type: 'lowpass' }); S.v.x *= 0.98; S.v.z *= 0.98; }
			// through the hoop, downwards
			if (!S.counted && y0 >= RIM_H && S.p.y < RIM_H && Math.hypot(S.p.x, S.p.z - RIM_Z) < RIM_R - 0.02) {
				S.counted = true;
				const pts = spot()[2] + (S.swish ? 1 : 0);
				S.score += pts; S.made++; S.streak++; if (S.swish) S.swishes++;
				S.net = 1;
				K.say(S.swish ? `Swish! +${pts}` : `+${pts}`, 900);
				K.noise(0.25, { vol: 0.12, f: 3000, q: 0.5 });
			}
		}
		function update(dt) {
			if (S.started && S.state !== 'over') S.time -= dt;
			S.t += dt;
			if (S.state === 'fly') {
				for (let i = 0; i < 8; i++) step(dt / 8);
				if (S.t > 2.2 || (S.t > 0.8 && S.p.y < 0.3 && Math.abs(S.v.y) < 0.8)) {
					if (!S.counted) { S.streak = 0; }
					else if (S.streak >= 3) { S.streak = 0; S.spot = (S.spot + 1) % SPOTS.length; K.say(SPOTS[S.spot][2] === 3 ? 'Step back: for three' : 'New spot', 1000); }
					if (S.time > 0) ready(); else S.state = 'wait';
				}
			} else if (S.state === 'ready') {
				S.p.y = 1.9 + Math.sin(K.time * 3) * 0.02;
			}
			if (S.time <= 0 && S.state !== 'over' && S.state !== 'fly') {
				S.state = 'over';
				K.finish(S.score, { line: `${S.made} of ${S.shots} (${S.shots ? Math.round(S.made / S.shots * 100) : 0}%)`, rows: [['Swishes', S.swishes], ['Farthest spot', SPOTS[S.spot][2] === 3 ? 'the arc' : 'the line']], unit: 'pts' });
			}
			S.net = Math.max(0, (S.net || 0) - dt * 2);
			net.scale.set(1 - S.net * 0.15, 1 + S.net * 0.3, 1 - S.net * 0.15);
			ball.position.copy(S.p);
			ball.rotation.x -= dt * 8 * (S.state === 'fly' ? 1 : 0);
			K.hud(`${Math.max(0, Math.ceil(S.time))} s · ${S.score} pts · ${spot()[2] === 3 ? 'three-point spot' : 'two-point spot'}${S.streak ? ` · ${S.streak} in a row` : ''}`);
			const [x, z] = spot();
			K.cam(x * 1.1, 2.2, z + 2.2, 0, RIM_H - 0.3, RIM_Z, 3);
		}
		return K.wrap({ build, reset, update, press });
	},
};
