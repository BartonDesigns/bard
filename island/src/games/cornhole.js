// Cornhole, the tailgate game, set up on the grass: two boards 27 feet apart, eight bags.
//   swipe up to toss a bag: the speed of the swipe is how far it flies, the slant its line.
//   in the hole is 3 points, on the board is 1; a bag that slides off scores nothing.
// The bag flies a real lob and lands with a thud; on the board it slides up the slope
// (slowing with the friction of the duck cloth, and with gravity pulling it back), and if
// it slides over the hole it drops through. Bags already on the board block and get
// knocked along by the next one. Aim for the hole, or slide one in off the front.

import { makeKit, clamp, rand } from './kit.js';

const BOARD_Z = -8.23, BW = 0.61, BL = 1.22, FRONT_H = 0.1, BACK_H = 0.3, HOLE = [0, BOARD_Z - BL + 0.23], HOLE_R = 0.076, BAGS = 8;
const SLOPE = Math.atan2(BACK_H - FRONT_H, BL);

export const GAME = {
	id: 'cornhole',
	title: 'Cornhole',
	blurb: 'Eight bags at a board 27 feet away: lob it on for one, drop it in for three.',
	where: { kind: 'anywhere' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffcc33', dist: 0.5, span: [3, 10] });
		const { THREE } = ctx;
		let bagM = [], S = {};

		// the board's surface height at a point along it
		const boardH = (z) => FRONT_H + (BOARD_Z - z) / BL * (BACK_H - FRONT_H);
		const onBoard = (x, z) => Math.abs(x) < BW / 2 && z < BOARD_Z && z > BOARD_Z - BL;
		function build() {
			K.mesh(new THREE.PlaneGeometry(6, 14), K.mat('#5a8a3a', { rough: 1 }), 0, 0.005, -5).rotation.x = -Math.PI / 2;
			const top = K.canvas(128, 256, (g) => {
				g.fillStyle = '#1c3f7a'; g.fillRect(0, 0, 128, 256);
				g.fillStyle = '#ffcc33'; g.fillRect(0, 0, 128, 14); g.fillRect(0, 242, 128, 14);
				g.fillStyle = '#fff'; g.font = 'bold 20px system-ui'; g.textAlign = 'center'; g.fillText('SF', 64, 190);
				g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(64, 256 * 0.23 / BL, HOLE_R / BW * 128, 0, 7); g.fill();
			});
			const deck = K.mesh(new THREE.PlaneGeometry(BW, BL / Math.cos(SLOPE)), K.mat('#ffffff', { map: top, rough: 0.9 }), 0, (FRONT_H + BACK_H) / 2 + 0.002, BOARD_Z - BL / 2);
			deck.rotation.x = -Math.PI / 2 + SLOPE;
			for (const s of [-1, 1]) {
				const side = K.box(0.03, 0.2, BL, '#d8b27a', s * (BW / 2 + 0.015), (FRONT_H + BACK_H) / 2 - 0.08, BOARD_Z - BL / 2);
				side.rotation.x = SLOPE;
			}
			K.box(BW, BACK_H, 0.03, '#d8b27a', 0, BACK_H / 2, BOARD_Z - BL);
			// the other board, back where you throw from
			K.box(BW, 0.1, BL, '#1c3f7a', 1.2, 0.1, 0.8);
			bagM = [];
			for (let i = 0; i < BAGS; i++) {
				const b = K.box(0.15, 0.04, 0.15, i < 4 ? '#d1323a' : '#e8e0c8', 0, -1, 0);
				b.visible = false; bagM.push(b);
			}
		}
		function reset() {
			S = { n: 0, score: 0, bags: [], state: 'aim', t: 0, log: [] };
			for (const b of bagM) b.visible = false;
			hud();
		}
		function hud() { K.hud(`Bag ${Math.min(BAGS, S.n + 1)} of ${BAGS} · ${S.score} pts${K.best() !== null ? ` · best ${K.best()}` : ''}`); }
		function press(down) {
			if (down || S.state !== 'aim') return;
			const sw = K.swipe();
			if (sw.vy > -200 || sw.dy > -30) return;
			// the lob: launched at 35 degrees from hand height; the slant turns it. Your arm knows
			// roughly how far 27 feet is, so the swipe's speed is halfway to a good toss already
			const raw = clamp(4 + -sw.vy / 420, 4, 14), v = 8.75 + (raw - 8.75) * 0.5, ang = clamp(sw.dx / Math.max(60, -sw.dy), -0.6, 0.6) * 0.12, up = 0.61;
			const b = { x: 0.2, y: 1.0, z: -0.3, vx: Math.sin(ang) * v * Math.cos(up), vy: Math.sin(up) * v, vz: -Math.cos(ang) * v * Math.cos(up), state: 'air', m: bagM[S.n], spin: rand(-6, 6), rot: 0 };
			b.m.visible = true;
			S.bags.push(b); S.n++; S.state = 'fly'; S.t = 0;
			K.noise(0.2, { vol: 0.06, f: 900 });
		}
		function step(b, dt) {
			if (b.state === 'air') {
				b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.rot += b.spin * dt;
				// through the hole on the fly (rare, lovely)
				if (Math.hypot(b.x - HOLE[0], b.z - HOLE[1]) < HOLE_R && b.y < boardH(b.z) + 0.02 && b.y > boardH(b.z) - 0.1) { b.state = 'hole'; return; }
				if (onBoard(b.x, b.z) && b.y <= boardH(b.z) + 0.02) {
					// it lands on the deck and keeps some of its speed along it
					b.state = 'slide'; b.y = boardH(b.z) + 0.02; b.vx *= 0.3; b.vz *= 0.3; b.vy = 0;
					K.noise(0.1, { vol: 0.25, f: 180, type: 'lowpass' });
				} else if (b.y <= 0.02) { b.state = 'rest'; b.y = 0.02; K.noise(0.1, { vol: 0.12, f: 140, type: 'lowpass' }); }
			} else if (b.state === 'slide') {
				// friction along its motion, gravity back down the slope
				const sp = Math.hypot(b.vx, b.vz);
				if (sp > 0) { const k = Math.max(0, sp - 4.5 * dt) / sp; b.vx *= k; b.vz *= k; }
				if (sp > 0.05) b.vz += 9.8 * Math.sin(SLOPE) * dt * 0.3;
				b.x += b.vx * dt; b.z += b.vz * dt;
				for (const o of S.bags) {
					if (o === b || o.state !== 'rest' || !onBoard(o.x, o.z)) continue;
					const dx = o.x - b.x, dz = o.z - b.z, d = Math.hypot(dx, dz);
					if (d < 0.14 && d > 1e-4) { o.state = 'slide'; o.vx = b.vx * 0.6; o.vz = b.vz * 0.6; b.vx *= 0.4; b.vz *= 0.4; }
				}
				if (Math.hypot(b.x - HOLE[0], b.z - HOLE[1]) < HOLE_R) { b.state = 'hole'; K.noise(0.15, { vol: 0.2, f: 120, type: 'lowpass' }); return; }
				if (!onBoard(b.x, b.z)) { b.state = 'air'; b.vy = 0; return; }
				b.y = boardH(b.z) + 0.02;
				if (sp < 0.04) { b.state = 'rest'; b.vx = b.vz = 0; }
			} else if (b.state === 'hole') {
				b.y -= dt * 1.2;
				if (b.y < 0.05) { b.state = 'gone'; b.m.visible = false; }
			}
		}
		const moving = () => S.bags.some((b) => b.state === 'air' || b.state === 'slide' || b.state === 'hole');
		function tally() {
			let on = 0, inn = 0;
			for (const b of S.bags) { if (b.state === 'gone') inn++; else if (b.state === 'rest' && onBoard(b.x, b.z)) on++; }
			return [inn * 3 + on, inn, on];
		}
		function update(dt) {
			S.t += dt;
			for (const b of S.bags) for (let i = 0; i < 4; i++) step(b, dt / 4);
			if (S.state === 'fly' && S.t > 0.4 && !moving()) {
				const [sc, inn, on] = tally(), gained = sc - S.score;
				S.score = sc; S.log.push(gained);
				const last = S.bags[S.bags.length - 1];
				K.say(last.state === 'gone' ? 'Cornhole! +3' : last.state === 'rest' && onBoard(last.x, last.z) ? 'On the board: +1' : gained > 0 ? `+${gained}` : 'Off.', 1100);
				if (last.state === 'gone') { K.tone(660, 0.1, { vol: 0.1 }); K.tone(990, 0.2, { vol: 0.1, at: 0.1 }); }
				if (S.n >= BAGS) { S.state = 'over'; K.finish(S.score, { unit: 'pts', line: `${inn} in the hole, ${on} on the board`, rows: [['Most you can get', BAGS * 3]] }); }
				else { S.state = 'aim'; hud(); }
			}
			for (const b of S.bags) if (b.state !== 'gone') { b.m.position.set(b.x, b.y, b.z); b.m.rotation.set(b.state === 'slide' || (b.state === 'rest' && onBoard(b.x, b.z)) ? SLOPE : 0, b.rot, 0); }
			const f = S.bags[S.bags.length - 1];
			if (S.state === 'fly' && f && f.z < -3) K.cam(0.4, 1.8, f.z + 3.4, 0, 0.1, BOARD_Z - 0.6, 2.5);
			else K.cam(0.3, 1.7, 1.2, 0, 0.2, BOARD_Z, 3);
		}
		return K.wrap({ build, reset, update, press });
	},
};
