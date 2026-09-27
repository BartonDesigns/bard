// Darts: a proper bristle board at regulation height (bull at 1.73 m) from the oche at
// 2.37 m. Three visits of three darts; the most you can score is 540 (nine treble twenties).
//   put your finger down below the board: the aim ring appears just above your finger, so
//     you can see where you're pointing; slide to aim. Let go to throw.
//   your hand is steady for a second or so, then it starts to wander: the longer you hold,
//     the more it sways, so settle and let fly.
// The board is the real one: the twenty at the top, sectors going round 1, 18, 4, 13, …,
// trebles and doubles on their true rings, 25 for the outer bull and 50 for the bullseye.

import { makeKit, clamp, rand } from './kit.js';

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const BY = 1.73, BZ = -2.37, PX = 1024;

// what a dart at (x, y) from the bull (metres, y up) scores, and what it's called
function scoreAt(x, y) {
	const r = Math.hypot(x, y) * 1000;
	if (r <= 6.35) return [50, 'Bullseye'];
	if (r <= 15.9) return [25, 'Outer bull'];
	if (r > 170) return [0, 'Off the board'];
	const a = (Math.atan2(x, y) * 180 / Math.PI + 9 + 360) % 360, n = ORDER[Math.floor(a / 18)];
	if (r >= 99 && r <= 107) return [n * 3, `Treble ${n}`];
	if (r >= 162) return [n * 2, `Double ${n}`];
	return [n, `${n}`];
}

export const GAME = {
	id: 'darts',
	title: 'Darts',
	// played in a closed room the kit builds (the host may hide the city while it runs)
	indoor: true,
	blurb: 'Nine darts at a regulation board: aim, settle your hand, and go for the treble twenty.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#e8403a', dist: 0.3, room: { w: 4.5, z0: -2.45, z1: 1.6, h: 2.9, style: 'pub' } });
		const { THREE } = ctx;
		let board, ring, darts = [], S = {};

		function build() {
			const face = K.canvas(512, 512, (g) => {
				const c = 256, s = PX / 1000;
				g.fillStyle = '#111'; g.beginPath(); g.arc(c, c, 230, 0, 7); g.fill();
				// the segments, ring by ring: double, outer single, treble, inner single
				const rings = [[170, 162, true], [162, 107, false], [107, 99, true], [99, 15.9, false]];
				for (let i = 0; i < 20; i++) {
					const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180;
					for (const [ro, ri, col] of rings) {
						g.fillStyle = col ? (i % 2 ? '#1f8a3a' : '#d1323a') : (i % 2 ? '#f1e6c8' : '#161616');
						g.beginPath(); g.arc(c, c, ro * s, a0, a1); g.arc(c, c, ri * s, a1, a0, true); g.closePath(); g.fill();
					}
					g.fillStyle = '#fff'; g.font = 'bold 22px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
					const am = (a0 + a1) / 2; g.fillText(String(ORDER[i]), c + Math.cos(am) * 205, c + Math.sin(am) * 205);
				}
				g.fillStyle = '#1f8a3a'; g.beginPath(); g.arc(c, c, 15.9 * s, 0, 7); g.fill();
				g.fillStyle = '#d1323a'; g.beginPath(); g.arc(c, c, 6.35 * s, 0, 7); g.fill();
				g.strokeStyle = '#bbb'; g.lineWidth = 1;
				for (const r of [170, 162, 107, 99, 15.9]) { g.beginPath(); g.arc(c, c, r * s, 0, 7); g.stroke(); }
			});
			// the wall, the cabinet doors open either side, the board, the oche line on the floor
			K.box(2.4, 2.6, 0.05, '#3a2a22', 0, 1.3, BZ - 0.05);
			K.box(0.7, 0.7, 0.06, '#5a3a22', 0, BY, BZ - 0.02);
			for (const s of [-1, 1]) K.box(0.35, 0.7, 0.03, '#6a4a2a', s * 0.52, BY, BZ + 0.12).rotation.y = s * 0.9;
			board = K.mesh(new THREE.PlaneGeometry(0.5, 0.5), K.mat('#ffffff', { map: face, glow: 0.3, rough: 0.9 }), 0, BY, BZ + 0.012);
			K.box(0.6, 0.01, 0.04, '#d8d8d8', 0, 0.005, 0);
			ring = K.mesh(new THREE.RingGeometry(0.008, 0.012, 20), K.mat('#39ff88', { basic: true, opacity: 0.9 }), 0, BY, BZ + 0.02);
			ring.visible = false;
			for (let i = 0; i < 3; i++) {
				const d = K.group();
				K.cyl(0.004, 0.001, 0.05, '#c0c4cc', 0, 0, -0.025, d).rotation.x = Math.PI / 2;
				K.cyl(0.006, 0.006, 0.06, '#2a2a33', 0, 0, 0.03, d).rotation.x = Math.PI / 2;
				for (const r of [0, Math.PI / 2]) K.box(0.03, 0.001, 0.035, '#e8403a', 0, 0, 0.07, d).rotation.z = r;
				d.visible = false; darts.push(d);
			}
			// a narrow view: your eyes are on the board, not the room
			K.fov(32);
		}
		function reset() {
			S = { visit: 0, dart: 0, total: 0, visits: [[]], state: 'aim', aim: null, hold: 0, t: 0, flight: null };
			for (const d of darts) d.visible = false;
			hud();
		}
		function hud() {
			const v = S.visits[S.visit] || [];
			K.hud(`Visit ${Math.min(3, S.visit + 1)} of 3 · dart ${Math.min(3, S.dart + 1)} · ${S.total}${v.length ? ` · this visit ${v.reduce((a, b) => a + b[0], 0)}` : ''}`);
		}
		// the point on the board the aim ring sits over: a finger's height above the finger
		function aimAt(x, y) {
			const h = K.pick(x, y - 80, [board]);
			if (h) { const p = K.local(h.point); S.aim = [p.x, p.y - BY]; }
		}
		function press(down, x, y) {
			if (S.state !== 'aim') return;
			if (down) { S.hold = 0; aimAt(x, y); return; }
			if (!S.aim) return;
			// the throw: where you aimed, plus the sway of the moment, plus a little scatter
			const [wx, wy] = wobble();
			const tx = S.aim[0] + wx + rand(-1, 1) * 0.006, ty = S.aim[1] + wy + rand(-1, 1) * 0.006;
			S.flight = { tx, ty, t: 0, d: darts[S.dart] };
			S.state = 'fly'; ring.visible = false; S.aim = null;
			K.noise(0.1, { vol: 0.06, f: 2500 });
		}
		function move(x, y) { if (S.state === 'aim' && K.ptr.down) aimAt(x, y); }
		function wobble() {
			const a = 0.004 + Math.max(0, S.hold - 1.1) * 0.03;
			return [Math.sin(S.hold * 2.3) * a + Math.sin(S.hold * 5.1) * a * 0.4, Math.cos(S.hold * 1.9) * a + Math.sin(S.hold * 4.3) * a * 0.4];
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'aim' && K.ptr.down && S.aim) {
				S.hold += dt;
				const [wx, wy] = wobble();
				ring.visible = true;
				ring.position.set(clamp(S.aim[0] + wx, -0.3, 0.3), BY + clamp(S.aim[1] + wy, -0.3, 0.3), BZ + 0.02);
			} else if (S.state === 'fly') {
				const f = S.flight;
				f.t += dt / 0.3;
				const k = Math.min(1, f.t);
				f.d.visible = true;
				f.d.position.set(0.18 + (f.tx - 0.18) * k, 1.55 + (BY + f.ty - 1.55) * k + Math.sin(k * Math.PI) * 0.12, -0.2 + (BZ + 0.05 + 0.2) * k);
				f.d.rotation.x = 0.15 - k * 0.3;
				if (k >= 1) {
					const [pts, name] = scoreAt(f.tx, f.ty);
					if (pts === 0) f.d.visible = false;
					S.total += pts; S.visits[S.visit].push([pts, name]);
					K.say(pts ? `${name} · ${pts}` : name, 1000);
					K.noise(0.05, { vol: pts ? 0.25 : 0.1, f: pts ? 900 : 300 });
					S.dart++;
					S.state = 'aim'; S.t = 0;
					if (S.dart >= 3) { S.state = 'collect'; S.t = 0; }
					hud();
				}
			} else if (S.state === 'collect' && S.t > 1.4) {
				const v = S.visits[S.visit], sum = v.reduce((a, b) => a + b[0], 0);
				if (sum === 180) K.say('ONE HUNDRED AND EIGHTY!', 2000);
				S.visit++; S.dart = 0;
				for (const d of darts) d.visible = false;
				if (S.visit >= 3) {
					S.state = 'over';
					K.finish(S.total, { unit: 'pts', line: S.total >= 300 ? 'Pub champion.' : S.total >= 150 ? 'Respectable arrows.' : 'The wall has a few new holes.', rows: S.visits.map((q, i) => [`Visit ${i + 1}`, `${q.map((b) => b[1]).join(', ')} = ${q.reduce((a, b) => a + b[0], 0)}`]) });
				} else { S.visits.push([]); S.state = 'aim'; hud(); }
			}
			K.cam(0.05, 1.62, 0.1, 0, BY - 0.05, BZ, 3);
		}
		return K.wrap({ build, reset, update, press, move });
	},
};
