// Mini golf: three holes of crazy golf with a San Francisco theme.
//   put your finger down and pull back, away from where you want the ball to go (a line
//     shows the aim and the power), then let go to putt.
//   1 Alcatraz: an island in the middle of the fairway; go round it or bank off the wall.
//   2 The Cable Car: a dog-leg, with a cable car shuttling back and forth across the turn.
//   3 Lombard Street: a switchback of walls to wind through down to the cup.
// The ball rolls on felt: it slows steadily, bounces off the boards losing a little speed,
// and drops in the cup only when it isn't going too fast (a hard putt lips out and runs on).
// Strokes are counted against par; your total is your score, and lower is better.

import { makeKit, clamp } from './kit.js';

const BR = 0.025, CUP = 0.06, FRICTION = 0.65, MAXV = 4.2;
// each hole: floor rectangles [x0, z0, x1, z1], wall segments, blocks (rectangles sliding
// side to side: [cx, cz, half width, half depth, swing, period]), round rocks [x, z, r], the tee and the cup
const HOLES = [
	{ name: 'Alcatraz', par: 2, floor: [[-0.7, -6, 0.7, 0]], walls: [[-0.7, 0, 0.7, 0], [0.7, 0, 0.7, -6], [0.7, -6, -0.7, -6], [-0.7, -6, -0.7, 0]], blocks: [], rocks: [[0, -3, 0.38]], tee: [0, -0.4], cup: [0, -5.4] },
	{ name: 'The Cable Car', par: 3, floor: [[-0.6, -4.4, 0.6, 0], [-0.6, -5.6, 3.6, -4.4]], walls: [[-0.6, 0, 0.6, 0], [0.6, 0, 0.6, -4.4], [0.6, -4.4, 3.6, -4.4], [3.6, -4.4, 3.6, -5.6], [3.6, -5.6, -0.6, -5.6], [-0.6, -5.6, -0.6, 0]], blocks: [[0, -2.6, 0.22, 0.16, 0.3, 3.2]], rocks: [[2.0, -4.75, 0.14]], tee: [0, -0.4], cup: [3.15, -5.0] },
	{ name: 'Lombard Street', par: 3, floor: [[-1.2, -6, 1.2, 0]], walls: [[-1.2, 0, 1.2, 0], [1.2, 0, 1.2, -6], [1.2, -6, -1.2, -6], [-1.2, -6, -1.2, 0], [-1.2, -1.6, 0.6, -1.6], [1.2, -3.0, -0.6, -3.0], [-1.2, -4.4, 0.6, -4.4]], blocks: [], rocks: [[0.3, -0.95, 0.12], [-0.9, -2.3, 0.12], [0.9, -3.7, 0.12]], tee: [0.8, -0.4], cup: [-0.2, -5.4] },
];

export const GAME = {
	id: 'minigolf',
	title: 'Mini Golf',
	blurb: 'Three holes of San Francisco crazy golf: pull back and putt.',
	where: { kind: 'site', sites: [{ name: 'Urban Putt, Mission District', lat: 37.7547, lon: -122.4167, r: 50 }, { name: 'Golfland, Milpitas', lat: 37.4302, lon: -121.9097, r: 80 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#6bd66b', dist: 1.5, span: [5, 7] });
		const { THREE } = ctx;
		let ball, holeG = null, aimLine, blockM = [], S = {};

		function build() {
			ball = K.ball(BR, K.mat('#ffffff', { rough: 0.3 }), 0, BR, 0);
			const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
			aimLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe066 }));
			aimLine.visible = false;
			K.root.add(aimLine);
		}
		function layHole(h) {
			// clear the last hole, then lay this one: felt, boards, rocks, blocks, the cup
			if (holeG) K.drop(holeG);
			holeG = K.group();
			const felt = K.mat('#2f8f46', { rough: 0.95 });
			for (const [x0, z0, x1, z1] of h.floor) K.box(x1 - x0, 0.06, z1 - z0, felt, (x0 + x1) / 2, -0.03, (z0 + z1) / 2, holeG);
			for (const [ax, az, bx, bz] of h.walls) {
				const len = Math.hypot(bx - ax, bz - az);
				const w = K.box(0.06, 0.1, len + 0.06, '#a8733f', (ax + bx) / 2, 0.05, (az + bz) / 2, holeG);
				w.rotation.y = Math.atan2(bx - ax, bz - az);
			}
			for (const [x, z, r] of h.rocks) {
				const rock = K.cyl(r, r * 1.1, 0.16, '#6b6660', x, 0.08, z, holeG);
				if (r > 0.3) { K.cyl(0.05, 0.06, 0.4, '#ecebe4', x + 0.1, 0.36, z, holeG); K.box(0.4, 0.14, 0.2, '#c9b89a', x - 0.05, 0.23, z, holeG); }
				rock.userData.rock = true;
			}
			blockM = h.blocks.map(([x, z, hw, hd]) => {
				const car = K.box(hw * 2, 0.2, hd * 2, '#c62828', x, 0.1, z, holeG);
				K.box(hw * 2 - 0.04, 0.08, hd * 2 + 0.01, '#f2e3b3', 0, 0.02, 0, car);
				return car;
			});
			const cup = K.cyl(CUP, CUP, 0.002, '#0c0c0c', h.cup[0], 0.001, h.cup[1], holeG);
			cup.renderOrder = 1;
			K.cyl(0.006, 0.006, 0.5, '#eeeeee', h.cup[0], 0.25, h.cup[1], holeG);
			const flag = K.box(0.14, 0.09, 0.005, '#ffcc33', h.cup[0] + 0.07, 0.45, h.cup[1], holeG);
			flag.userData.flag = true;
			S.flag = flag;
		}
		function reset() {
			S = { hole: 0, strokes: [], n: 0, state: 'aim', x: 0, z: 0, vx: 0, vz: 0, t: 0 };
			startHole();
		}
		function startHole() {
			const h = HOLES[S.hole];
			layHole(h);
			S.n = 0; S.x = h.tee[0]; S.z = h.tee[1]; S.vx = S.vz = 0; S.state = 'aim';
			hud();
			K.say(`Hole ${S.hole + 1}: ${h.name} · par ${h.par}`, 1800);
		}
		function hud() {
			const tot = S.strokes.reduce((a, b) => a + b, 0), par = HOLES.slice(0, S.hole).reduce((a, h) => a + h.par, 0);
			K.hud(`Hole ${S.hole + 1} of ${HOLES.length} · ${HOLES[S.hole].name} · stroke ${S.n + 1}${S.hole ? ` · ${tot - par >= 0 ? '+' : ''}${tot - par}` : ''}`);
		}

		// the pull-back: from where the finger went down to where it is now, reversed
		function pull() {
			const a = K.onPlane(K.ptr.x0, K.ptr.y0, 0), b = K.onPlane(K.ptr.x, K.ptr.y, 0);
			if (!a || !b) return null;
			const dx = a.x - b.x, dz = a.z - b.z, len = Math.hypot(dx, dz);
			if (len < 0.03) return null;
			return { dx: dx / len, dz: dz / len, power: clamp(len / 1.2, 0, 1) };
		}
		function press(down) {
			if (S.state !== 'aim') return;
			if (down) return;
			aimLine.visible = false;
			const p = pull();
			if (!p) return;
			const v = 0.25 + p.power * MAXV;
			S.vx = p.dx * v; S.vz = p.dz * v; S.n++; S.state = 'roll'; S.t = 0;
			K.noise(0.05, { vol: 0.2, f: 2500, q: 3 });
		}
		function move() {
			if (S.state !== 'aim' || !K.ptr.down) return;
			const p = pull();
			aimLine.visible = !!p;
			if (!p) return;
			const pos = aimLine.geometry.attributes.position;
			pos.setXYZ(0, S.x, 0.03, S.z); pos.setXYZ(1, S.x + p.dx * (0.3 + p.power * 1.6), 0.03, S.z + p.dz * (0.3 + p.power * 1.6));
			pos.needsUpdate = true;
			aimLine.material.color.setHSL(0.33 - p.power * 0.33, 0.9, 0.55);
		}

		// bounce off the nearest point (cx, cz) of something, which may itself be moving
		function bounce(cx, cz, e, mvx = 0) {
			const dx = S.x - cx, dz = S.z - cz, d = Math.hypot(dx, dz);
			if (d >= BR || d < 1e-6) return;
			const nx = dx / d, nz = dz / d;
			S.x = cx + nx * BR; S.z = cz + nz * BR;
			const rel = (S.vx - mvx) * nx + S.vz * nz;
			if (rel < 0) { S.vx -= (1 + e) * rel * nx; S.vz -= (1 + e) * rel * nz; if (rel < -0.3) K.noise(0.04, { vol: clamp(-rel * 0.06, 0.03, 0.2), f: 700 }); }
		}
		const blockAt = (b, t) => b[0] + Math.sin(t / b[5] * Math.PI * 2) * b[4];
		function step(dt) {
			const h = HOLES[S.hole];
			S.x += S.vx * dt; S.z += S.vz * dt;
			for (const [ax, az, bx, bz] of h.walls) {
				const wx = bx - ax, wz = bz - az, l2 = wx * wx + wz * wz, t = clamp(((S.x - ax) * wx + (S.z - az) * wz) / l2, 0, 1);
				bounce(ax + wx * t, az + wz * t, 0.72);
			}
			for (const [x, z, r] of h.rocks) {
				const dx = S.x - x, dz = S.z - z, d = Math.hypot(dx, dz) || 1;
				if (d < r + BR) bounce(x + dx / d * r, z + dz / d * r, 0.6);
			}
			h.blocks.forEach((b) => {
				// the cable cars shuttle across; a car's rectangle pushes the ball with its speed
				const cx = blockAt(b, K.time), mv = (blockAt(b, K.time + 0.01) - cx) / 0.01;
				bounce(clamp(S.x, cx - b[2], cx + b[2]), clamp(S.z, b[1] - b[3], b[1] + b[3]), 0.5, mv);
			});
			const sp = Math.hypot(S.vx, S.vz);
			if (sp > 0) { const k = Math.max(0, sp - FRICTION * dt) / sp; S.vx *= k; S.vz *= k; }
			// the cup: in if slow enough over it; a fast ball is deflected (lips out)
			const cd = Math.hypot(S.x - h.cup[0], S.z - h.cup[1]);
			if (cd < CUP) {
				if (sp < 1.3) { S.state = 'in'; S.t = 0; }
				else { const k = 0.9; S.vx = S.vx * k + (S.x - h.cup[0]) * 2; S.vz = S.vz * k + (S.z - h.cup[1]) * 2; }
			}
		}
		function update(dt) {
			S.t += dt;
			const h = HOLES[S.hole];
			blockM.forEach((m, i) => { m.position.x = blockAt(h.blocks[i], K.time); });
			if (S.flag) S.flag.rotation.y = Math.sin(K.time * 3) * 0.25;
			if (S.state === 'roll') {
				for (let i = 0; i < 8; i++) { step(dt / 8); if (S.state !== 'roll') break; }
				if (S.state === 'roll' && Math.hypot(S.vx, S.vz) < 0.02) { S.vx = S.vz = 0; S.state = 'aim'; if (S.n >= 8) { K.say('Picked up: 8 strokes max.', 1400); holeOut(); } else hud(); }
			} else if (S.state === 'in') {
				S.x += (h.cup[0] - S.x) * Math.min(1, dt * 10); S.z += (h.cup[1] - S.z) * Math.min(1, dt * 10);
				if (S.t > 0.05 && !S.sunk) { S.sunk = true; K.tone(1320, 0.08, { vol: 0.12 }); K.tone(990, 0.12, { vol: 0.1, at: 0.08 }); }
				if (S.t > 1.1) { S.sunk = false; holeOut(); }
			}
			ball.position.set(S.x, S.state === 'in' ? BR - Math.min(0.06, S.t * 0.2) : BR, S.z);
			// the camera: behind the ball on the line to the cup, high enough to see the hole
			const dx = h.cup[0] - S.x, dz = h.cup[1] - S.z, d = Math.hypot(dx, dz) || 1;
			K.cam(S.x - dx / d * 1.6, 2.3, S.z - dz / d * 1.6, S.x + dx / d * 1.2, 0, S.z + dz / d * 1.2, 2.5);
		}
		function holeOut() {
			const h = HOLES[S.hole];
			S.strokes.push(S.n);
			const diff = S.n - h.par;
			K.say(S.n === 1 ? 'Hole in one!' : diff <= -1 ? 'Birdie!' : diff === 0 ? 'Par' : diff === 1 ? 'Bogey' : `${S.n} strokes`, 1500);
			if (S.hole < HOLES.length - 1) { S.hole++; startHole(); return; }
			S.state = 'done';
			const tot = S.strokes.reduce((a, b) => a + b, 0), par = HOLES.reduce((a, q) => a + q.par, 0);
			K.finish(tot, { lower: true, unit: 'strokes', line: `${tot - par === 0 ? 'Level par' : tot - par < 0 ? `${par - tot} under par` : `${tot - par} over par`} (par ${par})`, rows: HOLES.map((q, i) => [`${i + 1}. ${q.name}`, `${S.strokes[i]} (par ${q.par})`]) });
		}
		function end() { holeG = null; }
		return K.wrap({ build, reset, update, press, move, end });
	},
};
