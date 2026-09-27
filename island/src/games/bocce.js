// Bocce on a clay court against Sal, who has played at Aquatic Park every morning since
// before you were born. Three frames; four balls each a frame.
//   swipe up to roll a ball: the speed of the swipe is how far it goes, the slant is its
//     line. Roll it soft to settle next to the pallino, or hard to knock Sal's ball away
//     (a spock, as he calls it). The side boards are in play: bank shots count.
// Rules as played: the pallino goes out first; then whichever side is not closest to it
// throws until it is closest or out of balls. When all eight are down, the closest side
// scores a point for every ball nearer than the other side's best.
// The balls are real: they roll and slow on the clay, knock each other about (the pallino
// too, which moves the target), and bounce off the boards.

import { makeKit, clamp, rand } from './kit.js';

const CW = 2.6, CL = 16, BR = 0.054, PR = 0.02, DECEL = 1.1, FRAMES = 3;

export const GAME = {
	id: 'bocce',
	title: 'Bocce',
	blurb: 'Three frames against Sal on the Aquatic Park courts: roll close, or knock him away.',
	where: { kind: 'site', sites: [{ name: 'Aquatic Park bocce courts', lat: 37.8063, lon: -122.4229, r: 60 }, { name: 'Washington Square, North Beach', lat: 37.8008, lon: -122.4101, r: 70 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#e8a64a', dist: 1.5, span: [3, 17] });
		let S = {}, balls = [], pallino, ring;

		function build() {
			const clay = K.canvas(128, 512, (g, w, h) => {
				g.fillStyle = '#c69a6b'; g.fillRect(0, 0, w, h);
				for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,.18)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
				g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
				for (const y of [h * 0.06, h * 0.5]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
			});
			K.decal(CW, CL, clay, 0, 0.01, -CL / 2);
			for (const s of [-1, 1]) K.box(0.08, 0.2, CL + 0.16, '#6b4a2e', s * (CW / 2 + 0.04), 0.1, -CL / 2);
			K.box(CW + 0.16, 0.2, 0.08, '#6b4a2e', 0, 0.1, -CL - 0.04);
			// a bench, and Sal's hat on it
			K.box(1.4, 0.06, 0.35, '#8a6a4a', CW / 2 + 0.8, 0.45, -1.5);
			for (const x of [-0.6, 0.6]) K.box(0.06, 0.45, 0.3, '#3a3a3a', CW / 2 + 0.8 + x, 0.22, -1.5);
			K.cyl(0.12, 0.14, 0.1, '#2a2a33', CW / 2 + 0.6, 0.53, -1.5);
			pallino = K.ball(PR, K.mat('#f2f2ea', { rough: 0.3 }), 0, PR, -8);
			balls = [];
			for (let i = 0; i < 8; i++) balls.push(K.ball(BR, K.mat(i < 4 ? '#2a6fd1' : '#d1323a', { rough: 0.25, metal: 0.1 }), 0, -1, 0));
			ring = K.mesh(new ctx.THREE.RingGeometry(0.1, 0.12, 24), K.mat('#ffe066', { basic: true, opacity: 0.8 }), 0, 0.02, 0);
			ring.rotation.x = -Math.PI / 2;
		}
		function reset() {
			S = { frame: 0, me: 0, sal: 0, frames: [], state: 'idle', t: 0 };
			newFrame();
		}
		function newFrame() {
			S.objs = [{ x: 0, z: -rand(8, 12), vx: 0, vz: 0, r: PR, m: 0.3, on: true }];
			S.left = { me: 4, sal: 4 };
			balls.forEach((b) => { b.visible = false; });
			S.turn = 'me'; S.state = 'aim'; S.t = 0;
			hud();
		}
		function hud() { K.hud(`Frame ${S.frame + 1} of ${FRAMES} · you ${S.me} – ${S.sal} Sal · ${S.turn === 'me' ? `your ball (${S.left.me} left)` : 'Sal to throw'}`); }
		const pal = () => S.objs[0];
		function nearest(side) {
			let best = Infinity;
			for (const o of S.objs) if (o.side === side && o.on) best = Math.min(best, Math.hypot(o.x - pal().x, o.z - pal().z));
			return best;
		}
		// who throws next: the side that isn't closest, while it has balls
		function nextTurn() {
			const m = nearest('me'), s = nearest('sal');
			let t = m <= s ? 'sal' : 'me';
			if (S.left[t] === 0) t = t === 'me' ? 'sal' : 'me';
			if (S.left.me + S.left.sal === 0) return null;
			return t;
		}
		function roll(side, speed, ang) {
			const b = { x: side === 'me' ? -0.3 : 0.3, z: -0.3, vx: Math.sin(ang) * speed, vz: -Math.cos(ang) * speed, r: BR, m: 1, side, on: true, mesh: balls[(side === 'me' ? 0 : 4) + (4 - S.left[side])] };
			b.mesh.visible = true;
			S.left[side]--;
			S.objs.push(b);
			S.state = 'roll'; S.t = 0;
			K.noise(0.3, { vol: 0.08, f: 250, type: 'lowpass' });
		}
		function press(down) {
			if (down || S.state !== 'aim' || S.turn !== 'me') return;
			const sw = K.swipe();
			if (sw.vy > -150 || sw.dy > -30) return;
			const speed = clamp(-sw.vy / 480, 0.8, 7.5);
			const ang = clamp(sw.dx / Math.max(60, -sw.dy), -0.6, 0.6) * 0.25;
			roll('me', speed, ang);
		}
		// Sal: rolls for the pallino with an old man's touch; if you are close and he has balls
		// to spare, he hits your ball out instead
		function salThrows() {
			const p = pal(), mine = S.objs.filter((o) => o.side === 'me' && o.on).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
			let tx = p.x, tz = p.z + 0.12, extra = 0;
			if (mine && Math.hypot(mine.x - p.x, mine.z - p.z) < 0.25 && S.left.sal >= 2 && Math.random() < 0.55) { tx = mine.x; tz = mine.z; extra = 1.6; }
			const d = Math.hypot(tx - 0.3, tz + 0.3), speed = Math.sqrt(2 * DECEL * d) * rand(0.94, 1.05) + extra;
			roll('sal', speed, Math.atan2(tx - 0.3, -(tz + 0.3)) + rand(-0.02, 0.02));
		}
		function step(dt) {
			const os = S.objs.filter((o) => o.on);
			for (const o of os) {
				o.x += o.vx * dt; o.z += o.vz * dt;
				const sp = Math.hypot(o.vx, o.vz);
				if (sp > 0) { const k = Math.max(0, sp - DECEL * dt) / sp; o.vx *= k; o.vz *= k; }
				if (Math.abs(o.x) > CW / 2 - o.r) { o.x = Math.sign(o.x) * (CW / 2 - o.r); o.vx = -o.vx * 0.5; }
				if (o.z < -CL + o.r) { o.z = -CL + o.r; o.vz = -o.vz * 0.5; }
				if (o.z > 0.2) o.on = false;
			}
			for (let i = 0; i < os.length; i++) for (let k = i + 1; k < os.length; k++) {
				const a = os[i], b = os[k], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), r = a.r + b.r;
				if (d >= r || d < 1e-6) continue;
				const nx = dx / d, nz = dz / d, rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
				if (rel > 0) {
					const j = 1.85 * rel / (1 / a.m + 1 / b.m);
					a.vx -= j / a.m * nx; a.vz -= j / a.m * nz; b.vx += j / b.m * nx; b.vz += j / b.m * nz;
					K.noise(0.05, { vol: clamp(rel * 0.1, 0.05, 0.35), f: 3200, q: 5 });
				}
				const push = (r - d) / 2; a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
			}
		}
		function score() {
			const m = nearest('me'), s = nearest('sal'), win = m < s ? 'me' : 'sal', beat = Math.min(m, s) === m ? s : m;
			const pts = S.objs.filter((o) => o.side === win && o.on && Math.hypot(o.x - pal().x, o.z - pal().z) < beat).length;
			S[win === 'me' ? 'me' : 'sal'] += pts;
			S.frames.push(`${win === 'me' ? 'you' : 'Sal'} +${pts}`);
			K.say(win === 'me' ? `Your frame: +${pts}` : `Sal's frame: +${pts}${pts > 1 ? ' (he is insufferable)' : ''}`, 2000);
			S.frame++;
			if (S.frame < FRAMES) { S.state = 'between'; S.t = 0; return; }
			S.state = 'over';
			const won = S.me > S.sal;
			K.finish(S.me, { unit: 'pts', line: won ? `You beat Sal ${S.me}–${S.sal}. He wants a rematch.` : S.me === S.sal ? `A draw, ${S.me}–${S.sal}.` : `Sal wins ${S.sal}–${S.me}, as he does.`, rows: S.frames.map((f, i) => [`Frame ${i + 1}`, f]) });
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'roll') {
				for (let i = 0; i < 6; i++) step(dt / 6);
				if (S.t > 0.5 && S.objs.every((o) => !o.on || Math.hypot(o.vx, o.vz) < 0.01)) {
					if (!pal().on) { K.say('The pallino went out: frame replayed.', 1800); newFrame(); return; }
					const t = nextTurn();
					if (!t) { S.state = 'counting'; S.t = 0; }
					else { S.turn = t; S.state = 'aim'; S.t = 0; hud(); }
				}
			} else if (S.state === 'aim' && S.turn === 'sal' && S.t > 1.1) salThrows();
			else if (S.state === 'counting' && S.t > 1) score();
			else if (S.state === 'between' && S.t > 2) newFrame();
			for (const o of S.objs) if (o.mesh) { o.mesh.visible = o.on; o.mesh.position.set(o.x, BR, o.z); o.mesh.rotation.x -= o.vz * dt / BR; o.mesh.rotation.z += o.vx * dt / BR; }
			pallino.position.set(pal().x, PR, pal().z); pallino.visible = pal().on;
			ring.position.set(pal().x, 0.015, pal().z);
			const live = S.objs[S.objs.length - 1];
			if (S.state === 'roll' && live.mesh) K.cam(live.x * 0.5, 1.4, live.z + 2.4, pal().x, 0, pal().z, 2.5);
			else if (S.state === 'counting' || S.state === 'between') K.cam(pal().x + 0.8, 1.6, pal().z + 1.2, pal().x, 0, pal().z, 2.5);
			else K.cam(0, 1.7, 1.6, 0, 0, pal().z + 1, 2.5);
		}
		return K.wrap({ build, reset, update, press });
	},
};
