// Pinball: a Bay-themed table ("Fog City") in the spirit of the Musée Mécanique's
// machines. Three balls.
//   hold anywhere, then let go, to pull and fire the plunger (longer hold, harder shot);
//   then tap and hold the left or right half of the screen for that flipper.
// The ball is a real ball on a real tilted table: gravity down the slope, bounces off the
// walls, the three pop bumpers kick it away, the slingshots above the flippers flick it
// across, and the flippers hit it with the speed of the flipper where it touches. Roll over
// all three top lanes (F-O-G) to double the bumpers' worth. Down the middle and it's gone.

import { makeKit, clamp } from './kit.js';

const R = 0.03, G = 4.2, TILT = 0.12, W = 0.46, LEN = 2.0, FL = 0.17;
const BUMPERS = [[-0.15, 1.38, 0.065], [0.15, 1.38, 0.065], [0, 1.12, 0.065]];
const LANES = [-0.16, 0, 0.16];

// the table's walls as segments (x, y up the table): outer walls, the top arch, the shooter
// lane's inner wall, the inlane guides, and the slingshots (which kick)
function tableWalls() {
	const w = [];
	w.push([-W, 0, -W, 1.55], [W + 0.08, 0, W + 0.08, 1.55]);
	for (let i = 0; i < 12; i++) {
		const a0 = Math.PI - i / 12 * Math.PI, a1 = Math.PI - (i + 1) / 12 * Math.PI;
		w.push([0.04 + Math.cos(a0) * 0.5, 1.55 + Math.sin(a0) * 0.45, 0.04 + Math.cos(a1) * 0.5, 1.55 + Math.sin(a1) * 0.45]);
	}
	w.push([W, 0, W, 1.3]);
	w.push([-W, 0.5, -0.21, 0.3], [W, 0.5, 0.21, 0.3]);
	for (const s of [-1, 1]) w.push([s * 0.34, 0.72, s * 0.34, 0.5], [s * 0.34, 0.5, s * 0.25, 0.42], [s * 0.34, 0.72, s * 0.25, 0.42, 'sling']);
	return w.map(([ax, ay, bx, by, k]) => ({ ax, ay, bx, by, kick: k === 'sling' }));
}

// the closest point on segment ab to p
function closest(px, py, ax, ay, bx, by) {
	const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
	const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
	return [ax + dx * t, ay + dy * t];
}

export const GAME = {
	id: 'pinball',
	title: 'Pinball',
	// played in a closed room the kit builds (the host may hide the city while it runs)
	indoor: true,
	blurb: 'Fog City: three balls, two flippers, pop bumpers and the F-O-G lanes.',
	where: { kind: 'site', sites: [{ name: 'Musée Mécanique, Pier 45', lat: 37.8094, lon: -122.4169, r: 50 }, { name: 'Pacific Pinball Museum, Alameda', lat: 37.7719, lon: -122.2769, r: 50 }, { name: 'Casino Fun Center, Santa Cruz Beach Boardwalk', lat: 36.96312, lon: -122.01984, r: 40 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#b56cff', dist: 1.2, room: { w: 5.5, z0: -3.6, z1: 2.4, h: 4, style: 'arcade' } });
		const { THREE } = ctx;
		const walls = tableWalls();
		let table, ballM, flipM = [], bumpM = [], laneM = [], S = {}, meter;
		const flips = [{ px: -0.21, py: 0.3, side: -1 }, { px: 0.21, py: 0.3, side: 1 }];

		// a table point (x across, y up the slope) to the stage
		const at = (x, y, h = 0) => [x, h, -y];
		function build() {
			table = K.group();
			table.position.set(0, 0.9, -0.2);
			table.rotation.x = TILT;
			const play = K.canvas(256, 512, (g, w, h) => {
				const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#1b2a55'); grad.addColorStop(1, '#0d1330');
				g.fillStyle = grad; g.fillRect(0, 0, w, h);
				g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 2;
				for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 300 + i * 25); g.bezierCurveTo(w * 0.3, 280 + i * 25, w * 0.7, 330 + i * 25, w, 300 + i * 25); g.stroke(); }
				// the bridge, painted on the playfield
				g.strokeStyle = '#d5553a'; g.lineWidth = 5;
				g.beginPath(); g.moveTo(20, 230); g.quadraticCurveTo(128, 330, 236, 230); g.stroke();
				g.fillStyle = '#d5553a'; g.fillRect(70, 150, 10, 110); g.fillRect(176, 150, 10, 110);
				g.fillStyle = '#ffd35a'; g.font = 'bold 26px Georgia,serif'; g.textAlign = 'center'; g.fillText('FOG CITY', 128, 420);
			});
			const pf = K.mesh(new THREE.PlaneGeometry(1.06, LEN + 0.1), K.mat('#ffffff', { map: play, glow: 0.4 }), 0.04, 0, -LEN / 2 + 0.05, table);
			pf.rotation.x = -Math.PI / 2;
			K.box(1.12, 0.12, LEN + 0.2, '#3a1d4a', 0.04, -0.07, -LEN / 2, table);
			for (const s of walls) {
				const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
				const m = K.box(0.02, 0.05, len, s.kick ? '#ff5aa0' : '#c0c8d8', ...at((s.ax + s.bx) / 2, (s.ay + s.by) / 2, 0.025), table);
				m.rotation.y = Math.atan2(s.bx - s.ax, s.ay - s.by);
			}
			bumpM = BUMPERS.map(([x, y, r]) => { const m = K.cyl(r, r, 0.05, '#ff9a3c', ...at(x, y, 0.025), table); K.cyl(r * 0.7, r * 0.7, 0.052, '#fff3c4', 0, 0.001, 0, m); return m; });
			laneM = LANES.map((x) => K.ball(0.018, K.mat('#555566'), ...at(x, 1.72, 0.01), table));
			flipM = flips.map((f) => {
				const piv = K.group(table); piv.position.set(...at(f.px, f.py, 0.02));
				const bar = K.box(FL, 0.04, 0.035, '#f4f4f0', f.side * -FL / 2, 0, 0, piv);
				K.box(FL, 0.042, 0.012, '#d1323a', f.side * -FL / 2, 0, 0.012, piv);
				bar.userData.side = f.side;
				return piv;
			});
			ballM = K.ball(R, K.mat('#dfe6ee', { metal: 0.9, rough: 0.2 }), 0, 0, 0, table);
			// the backbox, for the look of it
			const back = K.canvas(256, 160, (g) => { g.fillStyle = '#2a1238'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#ffd35a'; g.font = 'bold 40px Georgia,serif'; g.textAlign = 'center'; g.fillText('FOG CITY', 128, 70); g.fillStyle = '#ff9a3c'; g.font = '20px system-ui'; g.fillText('★ pinball ★', 128, 110); });
			K.box(1.12, 0.7, 0.1, K.mat('#ffffff', { map: back, glow: 0.5 }), 0.04, 1.75, -2.45);
			K.box(1.12, 0.9, 0.12, '#1a0d24', 0.04, 0.45, -0.1);
			meter = K.meter('Hold, then let go to launch');
		}
		function reset() {
			S = { balls: 3, score: 0, state: 'plunge', x: 0, y: 0, vx: 0, vy: 0, charge: 0, charging: false, lit: [false, false, false], mult: 1, t: 0 };
			for (const f of flips) { f.a = 0; f.w = 0; f.held = false; }
			serve();
		}
		function serve() {
			S.state = 'plunge'; S.x = W + 0.04; S.y = 0.12; S.vx = S.vy = 0; S.charge = 0; S.inPlay = false;
			meter.set(0, 'Hold, then let go to launch');
			hud();
		}
		function hud() { K.hud(`Ball ${4 - S.balls} of 3 · ${S.score.toLocaleString()}${S.mult > 1 ? ' · bumpers ×2' : ''}`); }
		function add(p) { S.score += p * S.mult; hud(); }

		function press(down, x) {
			if (S.state === 'plunge') {
				if (down) S.charging = true;
				else if (S.charging) {
					S.charging = false; S.state = 'play'; S.vy = 3.8 + S.charge * 1.9; meter.hide();
					K.noise(0.15, { vol: 0.25, f: 400 });
				}
				return;
			}
			const r = K.size(), f = flips[x - r.left < r.width / 2 ? 0 : 1];
			if (down && !f.held) K.noise(0.06, { vol: 0.2, f: 900, q: 3 });
			f.held = down;
			if (!down) { flips[0].held = false; flips[1].held = false; }
		}

		// bounce off a surface point (cx, cy) moving at (svx, svy), with restitution e
		function hit(cx, cy, e, svx = 0, svy = 0, kick = 0) {
			let nx = S.x - cx, ny = S.y - cy;
			const d = Math.hypot(nx, ny);
			if (d >= R || d < 1e-6) return false;
			nx /= d; ny /= d;
			S.x = cx + nx * R; S.y = cy + ny * R;
			const rel = (S.vx - svx) * nx + (S.vy - svy) * ny;
			if (rel < 0) { S.vx -= (1 + e) * rel * nx; S.vy -= (1 + e) * rel * ny; }
			if (kick) { S.vx += nx * kick; S.vy += ny * kick; }
			return rel < -0.2 || kick > 0;
		}
		function step(dt) {
			S.vy -= G * dt;
			S.x += S.vx * dt; S.y += S.vy * dt;
			for (const s of walls) {
				// the shooter lane's wall and the gate: the ball can't come back into the lane
				const [cx, cy] = closest(S.x, S.y, s.ax, s.ay, s.bx, s.by);
				if (hit(cx, cy, s.kick ? 0.6 : 0.45, 0, 0, s.kick ? 1.6 : 0) && s.kick) { add(10); K.noise(0.05, { vol: 0.2, f: 2400, q: 4 }); }
			}
			if (S.inPlay && S.x > W - R && S.y > 1.3 && S.y < 1.6) { S.x = W - R; S.vx = -Math.abs(S.vx) * 0.5; }
			if (!S.inPlay && S.x < W - 0.05) S.inPlay = true;
			BUMPERS.forEach(([bx, by, br], i) => {
				const d = Math.hypot(S.x - bx, S.y - by);
				if (d < br + R) {
					const nx = (S.x - bx) / d, ny = (S.y - by) / d;
					if (hit(bx + nx * br, by + ny * br, 0.5, 0, 0, 1.4)) { add(100); bumpM[i].userData.flash = 1; K.tone(420 + i * 90, 0.08, { type: 'square', vol: 0.08 }); }
				}
			});
			LANES.forEach((lx, i) => { if (!S.lit[i] && Math.abs(S.x - lx) < 0.04 && Math.abs(S.y - 1.72) < 0.04) { S.lit[i] = true; add(250); K.tone(880, 0.1, { vol: 0.08 }); if (S.lit.every(Boolean)) { S.mult = 2; S.lit = [false, false, false]; K.say('F-O-G! Bumpers ×2', 1500); } } });
			for (const f of flips) {
				// the flipper: a bar from the pivot, swung between rest (down) and up
				const ang = f.side < 0 ? -0.5 + f.a : Math.PI + 0.5 - f.a;
				const tx = f.px + Math.cos(ang) * FL, ty = f.py + Math.sin(ang) * FL;
				const [cx, cy] = closest(S.x, S.y, f.px, f.py, tx, ty);
				const rx = cx - f.px, ry = cy - f.py, om = f.w * (f.side < 0 ? 1 : -1);
				hit(cx, cy, 0.35, -om * ry, om * rx);
			}
			const sp = Math.hypot(S.vx, S.vy);
			if (sp > 7) { S.vx *= 7 / sp; S.vy *= 7 / sp; }
			S.x = clamp(S.x, -W + R, W + 0.08 - R);
			if (S.y > 1.99) { S.y = 1.99; S.vy = -Math.abs(S.vy) * 0.5; }
		}
		function update(dt) {
			S.t += dt;
			for (const f of flips) {
				const want = f.held ? 1 : 0, prev = f.a;
				f.a = want > f.a ? Math.min(1, f.a + dt * 22) : Math.max(0, f.a - dt * 12);
				f.w = (f.a - prev) / dt;
			}
			if (S.state === 'plunge') {
				if (S.charging) { S.charge = Math.min(1, S.charge + dt * 0.9); meter.set(S.charge, 'Let go to launch'); }
			} else if (S.state === 'play') {
				for (let i = 0; i < 10; i++) step(dt / 10);
				// fell back down the shooter lane: plunge again, no harm done
				if (!S.inPlay && S.y < 0.12) serve();
				else if (S.y < -0.05) {
					S.balls--; S.mult = 1;
					K.noise(0.5, { vol: 0.15, f: 200, type: 'lowpass' });
					if (S.balls > 0) { K.say('Drained!', 1200); serve(); }
					else { S.state = 'over'; hud(); K.finish(S.score, { line: S.score > 5000 ? 'Replay!' : 'The ball goes down the middle; it always does.', rows: [['Balls', 3]] }); }
				}
			}
			flipM.forEach((m, i) => { m.rotation.y = flips[i].side < 0 ? -0.5 + flips[i].a : 0.5 - flips[i].a; });
			bumpM.forEach((m) => { m.userData.flash = Math.max(0, (m.userData.flash || 0) - dt * 4); m.scale.setScalar(1 + m.userData.flash * 0.12); });
			laneM.forEach((m, i) => { m.material = K.mat(S.lit[i] ? '#ffd35a' : '#555566', { glow: S.lit[i] ? 0.8 : 0.18 }); });
			ballM.position.set(...at(S.x, S.y, R));
			// looking down the table from over the flippers, as far back as it takes to fit
			K.frame(0.04, 1.05, -1.2, 1.25, 1.7, 0, 0.8, 0.6, 0.72, 4);
		}
		return K.wrap({ build, reset, update, press });
	},
};
