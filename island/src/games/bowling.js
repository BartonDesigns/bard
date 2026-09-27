// Bowling: a real-size lane (60 ft to the head pin, 41½ in wide, gutters either side) and
// ten maple pins racked in their triangle. Five frames, scored the proper way: strikes and
// spares carry the next balls, and the fifth frame gives the bonus balls.
//   where your finger comes down (left or right of middle) is where you stand on the
//     approach; swipe up to roll. A faster swipe is a faster ball; the swipe's slant aims
//     it, and a swipe that curls at the end puts hook on it, so it breaks into the pocket.
// The pins are pucks on the deck: the ball knocks them, they knock each other, a pin that is
// struck hard enough topples and goes on sliding, bigger now it is on its side, into the
// others and off into the pit. After the roll the sweep clears the deadwood.
// It belongs at the Presidio Bowling Center, but a lane can go down anywhere flat.

import { makeKit, clamp } from './kit.js';

const LANE = 18.29, HALF = 0.533, BALL_R = 0.108, PIN_R = 0.06, LYING_R = 0.11, FRAMES = 5;
const RACK = [[0, 0], [-0.1524, 1], [0.1524, 1], [-0.3048, 2], [0, 2], [0.3048, 2], [-0.4572, 3], [-0.1524, 3], [0.1524, 3], [0.4572, 3]];

// the score of a list of rolls, frame by frame (null while a frame's bonus is still to come)
function frameScores(rolls) {
	const out = [];
	let i = 0, total = 0;
	for (let f = 0; f < FRAMES && i < rolls.length; f++) {
		const a = rolls[i], b = rolls[i + 1], c = rolls[i + 2];
		if (a === 10) { if (c === undefined) { out.push(null); break; } total += 10 + b + c; i += 1; }
		else if (b === undefined) { out.push(null); break; }
		else if (a + b === 10) { if (c === undefined) { out.push(null); break; } total += 10 + c; i += 2; }
		else { total += a + b; i += 2; }
		out.push(total);
	}
	return out;
}

export const GAME = {
	id: 'bowling',
	title: 'Bowling',
	// played in a closed room the kit builds (the host may hide the city while it runs)
	indoor: true,
	blurb: 'Five frames on a real 60-foot lane: swipe to roll, curl it for hook.',
	where: { kind: 'site', sites: [{ name: 'Presidio Bowling Center', lat: 37.7989, lon: -122.4583, r: 80 }, { name: 'Mission Bowling Club', lat: 37.7634, lon: -122.4157, r: 60 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#f2b33d', dist: 1.5, room: { w: 8, z0: -21, z1: 6, h: 4.5, style: 'alley' } });
		const { THREE } = ctx;
		let ball, pins = [], S = {};

		function pinGeometry() {
			// the pin's profile, base to crown (metres): belly, neck, head
			const pr = [[0.0, 0], [0.026, 0], [0.04, 0.03], [0.058, 0.1], [0.06, 0.14], [0.05, 0.2], [0.03, 0.25], [0.023, 0.27], [0.026, 0.3], [0.032, 0.34], [0.03, 0.365], [0.018, 0.378], [0, 0.381]];
			return new THREE.LatheGeometry(pr.map(([r, y]) => new THREE.Vector2(r, y)), 18);
		}
		function build() {
			// the lane: maple boards with the arrows and the approach dots, gutters, the pit
			const wood = K.canvas(128, 2048, (g, w, h) => {
				for (let i = 0; i < 39; i++) { g.fillStyle = `hsl(35,${48 + (i % 3) * 6}%,${70 - (i % 4) * 3}%)`; g.fillRect(i * w / 39, 0, w / 39 + 1, h); }
				g.fillStyle = '#6b3a1c';
				for (let k = 0; k < 7; k++) { const x = w * (0.5 + (k - 3) * 5 / 39), y = h * (1 - 4.6 / (LANE + 1)); g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x - 5, y); g.lineTo(x + 5, y); g.fill(); }
				for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(w * (0.5 + (k - 3) * 5 / 39), h * (1 - 0.6 / (LANE + 1)), 3, 0, 7); g.fill(); }
				g.fillStyle = '#3a2412'; g.fillRect(0, h * (1 - 1 / (LANE + 1)) - 2, w, 4);
			});
			K.decal(HALF * 2, LANE + 1.5, wood, 0, 0.121, -(LANE + 1.5) / 2 + 1.0);
			K.box(HALF * 2, 0.12, LANE + 1.5, '#b08a5a', 0, 0.06, -(LANE + 1.5) / 2 + 1.0);
			K.box(HALF * 2 + 0.9, 0.02, LANE + 3, '#2a2522', 0, 0.01, -(LANE + 3) / 2 + 1.5);
			for (const s of [-1, 1]) {
				K.box(0.23, 0.02, LANE + 1, K.mat('#8a9096', { metal: 0.6, rough: 0.3 }), s * (HALF + 0.12), 0.03, -(LANE + 1) / 2 + 0.5);
				K.box(0.08, 0.3, LANE + 2.5, '#3b3f55', s * (HALF + 0.3), 0.15, -(LANE + 2.5) / 2 + 1.2);
			}
			// the approach, the pit and the masking unit over the pins
			K.box(HALF * 2 + 0.9, 0.12, 4, '#c9a676', 0, 0.06, 3.3);
			K.box(HALF * 2 + 0.9, 0.9, 0.1, '#15161a', 0, 0.45, -LANE - 1.3);
			const sign = K.canvas(256, 96, (g) => { g.fillStyle = '#1c2c4a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#f2b33d'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.fillText('★ STRIKE ★', 128, 60); });
			K.box(HALF * 2 + 0.9, 0.6, 0.1, K.mat('#ffffff', { map: sign }), 0, 1.3, -LANE - 0.6);
			const pg = pinGeometry();
			const pinTex = K.canvas(64, 128, (g) => { g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#c62828'; g.fillRect(0, 36, 64, 7); g.fillRect(0, 49, 64, 7); });
			const pinMat = K.mat('#ffffff', { map: pinTex, rough: 0.35 });
			pins = RACK.map(() => ({ mesh: K.mesh(pg, pinMat) }));
			ball = K.ball(BALL_R, K.mat('#1f4fa8', { rough: 0.15, metal: 0.2 }), 0, 0.12 + BALL_R, 0);
			for (const [dx, dy] of [[0.03, 0.05], [-0.02, 0.06], [0, 0.03]]) K.ball(0.012, '#0b0b10', dx, dy + 0.02, -BALL_R + 0.005, ball);
		}
		function rack(all) {
			pins.forEach((p, i) => {
				if (!all && p.down) { p.gone = true; p.mesh.visible = false; return; }
				p.x = RACK[i][0]; p.z = -LANE - RACK[i][1] * 0.264;
				p.vx = p.vz = 0; p.down = false; p.counted = false; p.gone = false; p.tilt = 0; p.dir = 0;
				p.mesh.visible = true; p.mesh.position.set(p.x, 0.12, p.z); p.mesh.rotation.set(0, 0, 0);
			});
		}
		function reset() {
			S = { rolls: [], frame: 0, ball: 0, state: 'aim', t: 0, bx: 0, bz: 0.4, vx: 0, vz: 0, hook: 0, gutter: false, first: 0 };
			rack(true); placeBall(); hud();
		}
		function placeBall() { S.bx = S.bx0 || 0; S.bz = 0.4; ball.position.set(S.bx, 0.12 + BALL_R, S.bz); ball.visible = true; S.gutter = false; }
		function hud() {
			const fs = frameScores(S.rolls), tot = fs.filter((v) => v !== null).pop() || 0;
			K.hud(`Frame ${Math.min(FRAMES, S.frame + 1)} of ${FRAMES} · ball ${S.ball + 1} · score ${tot}${K.best() !== null ? ` · best ${K.best()}` : ''}`);
		}

		function press(down, x) {
			if (S.state !== 'aim') return;
			const r = K.size();
			if (down) { S.bx0 = clamp((x - r.left - r.width / 2) / r.width * 1.4, -0.4, 0.4); placeBall(); return; }
			const sw = K.swipe();
			if (sw.vy > -250 || sw.dy > -40) return; // not a roll: a tap just moves you on the approach
			// the slant of the swipe aims; the curl between the first and last half hooks
			const h = sw.hist, mid = h[Math.floor(h.length / 2)] || h[0], a = h[0], b = h[h.length - 1];
			const ang1 = Math.atan2(mid[0] - a[0], a[1] - mid[1] || 1), ang2 = Math.atan2(b[0] - mid[0], mid[1] - b[1] || 1);
			S.vz = -clamp(-sw.vy / 260, 4.5, 9.5);
			S.vx = clamp((b[0] - a[0]) / Math.max(40, a[1] - b[1]), -0.6, 0.6) * 0.12 * -S.vz * 0.35;
			S.hook = clamp(ang2 - ang1, -0.8, 0.8) * 0.9;
			S.state = 'roll'; S.t = 0;
			K.noise(0.5, { vol: 0.12, f: 180, type: 'lowpass' });
		}

		function physics(dt) {
			// the ball: straight down the oil, hooking on the dry back end, or in the gutter
			if (!S.gutter) {
				if (S.bz < -LANE * 0.55) S.vx += S.hook * dt;
				S.bx += S.vx * dt; S.bz += S.vz * dt;
				if (Math.abs(S.bx) > HALF - 0.02 && S.bz > -LANE + 0.2) { S.gutter = true; S.bx = Math.sign(S.bx) * (HALF + 0.12); S.vx = 0; K.noise(0.6, { vol: 0.1, f: 300 }); }
			} else S.bz += S.vz * dt;
			if (S.bz < -LANE - 1.2) { ball.visible = false; S.vz = 0; S.vx = 0; }
			if (!S.gutter && ball.visible) for (const p of pins) {
				if (p.gone) continue;
				const r = BALL_R + (p.down ? LYING_R : PIN_R), dx = p.x - S.bx, dz = p.z - S.bz, d = Math.hypot(dx, dz);
				if (d < r && d > 1e-4) {
					const nx = dx / d, nz = dz / d, rel = (S.vx - p.vx) * nx + (S.vz - p.vz) * nz;
					if (rel > 0) {
						// elastic-ish: a 7 kg ball into a 1.5 kg pin
						const j = (1 + 0.7) * rel / (1 / 7 + 1 / 1.5);
						S.vx -= j / 7 * nx; S.vz -= j / 7 * nz; p.vx += j / 1.5 * nx; p.vz += j / 1.5 * nz;
						knock(p, rel);
					}
					p.x = S.bx + nx * r; p.z = S.bz + nz * r;
				}
			}
			// pins into pins
			for (let i = 0; i < pins.length; i++) for (let k = i + 1; k < pins.length; k++) {
				const a = pins[i], b = pins[k];
				if (a.gone || b.gone) continue;
				const r = (a.down ? LYING_R : PIN_R) + (b.down ? LYING_R : PIN_R), dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
				if (d < r && d > 1e-4) {
					const nx = dx / d, nz = dz / d, rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
					if (rel > 0) {
						const j = (1 + 0.6) * rel / 2;
						a.vx -= j * nx; a.vz -= j * nz; b.vx += j * nx; b.vz += j * nz;
						knock(a, rel); knock(b, rel);
					}
					const push = (r - d) / 2;
					a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
				}
			}
			for (const p of pins) {
				if (p.gone) continue;
				const sp = Math.hypot(p.vx, p.vz);
				if (sp > 0) { const k = Math.max(0, sp - (p.down ? 2.2 : 3.5) * dt) / sp; p.vx *= k; p.vz *= k; }
				p.x += p.vx * dt; p.z += p.vz * dt;
				// off the deck: into the pit or the gutter, gone
				if (p.z < -LANE - 1.1 || Math.abs(p.x) > HALF + 0.1) { if (!p.down) knock(p, 1); p.gone = true; p.mesh.visible = false; }
			}
		}
		function knock(p, rel) {
			if (p.down || rel < 0.35) return;
			p.down = true; p.dir = Math.atan2(p.vx, p.vz) || 0;
			K.noise(0.12, { vol: clamp(rel * 0.08, 0.05, 0.3), f: 1800 + Math.random() * 1500, q: 2 });
		}

		function settle() {
			const downNow = pins.filter((p) => p.down && !p.counted).length;
			for (const p of pins) if (p.down) p.counted = true;
			S.rolls.push(downNow);
			const standing = pins.filter((p) => !p.down).length, last = S.frame === FRAMES - 1;
			let msg = '';
			if (S.ball === 0 && standing === 0) msg = 'Strike!';
			else if (S.ball === 1 && standing === 0 && S.first < 10) msg = 'Spare!';
			else if (downNow === 0) msg = S.gutter ? 'Gutter ball' : 'Missed them all';
			else msg = `${downNow} pin${downNow > 1 ? 's' : ''}`;
			K.say(msg, 1400);
			if (standing === 0) { K.tone(523, 0.15, { vol: 0.12 }); K.tone(784, 0.3, { vol: 0.12, at: 0.12 }); }
			if (S.ball === 0) S.first = downNow;
			// next ball, or next frame; the last frame gives bonus balls after a strike or spare
			let nextFrame = false;
			if (!last) nextFrame = S.ball === 1 || standing === 0;
			else {
				const f = S.rolls.slice(frameStart()), sum2 = (f[0] || 0) + (f[1] || 0);
				if (f.length === 3 || (f.length === 2 && f[0] < 10 && sum2 < 10)) { S.state = 'done'; hud(); endGame(); return; }
			}
			if (nextFrame) { S.frame++; S.ball = 0; rack(true); }
			else { S.ball++; if (standing === 0) { rack(true); } else rack(false); }
			S.state = 'aim'; placeBall(); hud();
		}
		function frameStart() {
			let i = 0;
			for (let f = 0; f < FRAMES - 1; f++) i += S.rolls[i] === 10 ? 1 : 2;
			return i;
		}
		function endGame() {
			const fs = frameScores(S.rolls), total = fs[fs.length - 1] || 0;
			const strikes = S.rolls.filter((r) => r === 10).length;
			K.finish(total, { line: total >= 120 ? 'That would be a 240 game over ten frames.' : total >= 75 ? 'Lovely bowling.' : 'Keep it out of the gutters.', rows: [['Frames', fs.map((v) => v ?? '–').join(' · ')], ['Strikes', strikes]] });
		}

		function update(dt) {
			S.t += dt;
			if (S.state === 'roll') {
				for (let k = 0; k < 4; k++) physics(dt / 4);
				ball.position.set(S.bx, S.gutter ? 0.09 + BALL_R * 0.6 : 0.12 + BALL_R, S.bz);
				ball.rotation.x -= S.vz * dt / BALL_R;
				const moving = pins.some((p) => !p.gone && Math.hypot(p.vx, p.vz) > 0.05);
				if ((!ball.visible || S.t > 7) && !moving && S.t > 1) { S.state = 'sweep'; S.t = 0; }
			}
			for (const p of pins) {
				if (p.gone) continue;
				if (p.down) p.tilt = Math.min(Math.PI / 2, p.tilt + dt * 7);
				p.mesh.position.set(p.x, 0.12 + (p.down ? Math.sin(p.tilt) * PIN_R : 0), p.z);
				p.mesh.rotation.set(0, p.dir, 0); p.mesh.rotateX(p.tilt);
			}
			if (S.state === 'sweep' && S.t > 0.9) settle();
			// the camera: behind the bowler, then down the lane with the ball, then at the pins
			if (S.state === 'aim') K.cam(S.bx0 * 0.5 || 0, 1.55, 2.4, 0, 0.2, -LANE, 5);
			else if (S.bz > -LANE + 6) K.cam(S.bx * 0.6, 0.9, S.bz + 2.4, 0, 0.1, S.bz - 8, 3);
			else K.cam(0, 1.1, -LANE + 4, 0, 0.1, -LANE - 0.4, 3);
		}
		return K.wrap({ build, reset, update, press });
	},
};
