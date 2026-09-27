// Air hockey against the arcade's house player: first to five.
//   put your finger on the table and your mallet follows it round your half; hit the puck
//     by moving through it, so the faster you swipe the harder the shot. Bank it off the
//     rails. Keep your mallet in front of your own goal when it comes back.
// The puck floats on the air: next to no friction, lively bounces off the rails, and a hit
// takes the mallet's speed into it. The house player tracks the puck, attacks it when it is
// slow on its side and falls back to guard its goal, and gets a little quicker every time
// you score.

import { makeKit, clamp } from './kit.js';

const TW = 1.0, TL = 2.0, H = 0.8, PR = 0.04, MR = 0.055, GOAL = 0.34, TO = 5;

export const GAME = {
	id: 'airhockey',
	title: 'Air Hockey',
	// played in a closed room the kit builds (the host may hide the city while it runs)
	indoor: true,
	blurb: 'First to five against the house player: slide your mallet, bank it off the rails.',
	where: { kind: 'site', sites: [{ name: 'Musée Mécanique, Pier 45', lat: 37.8094, lon: -122.4169, r: 50 }, { name: 'Pier 39 arcade', lat: 37.8087, lon: -122.4098, r: 70 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#39d0ff', dist: 1.3, room: { w: 5.5, z0: -3.6, z1: 2.4, h: 4, style: 'arcade' } });
		let puck, mine, theirs, S = {};

		function build() {
			const top = K.canvas(256, 512, (g, w, h) => {
				g.fillStyle = '#e9f3f8'; g.fillRect(0, 0, w, h);
				g.fillStyle = 'rgba(40,80,120,.18)';
				for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) g.fillRect(x, y, 2, 2);
				g.strokeStyle = '#d1323a'; g.lineWidth = 4;
				g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
				g.beginPath(); g.arc(w / 2, h / 2, 40, 0, 7); g.stroke();
				g.strokeStyle = '#2a6fd1';
				for (const y of [0, h]) { g.beginPath(); g.arc(w / 2, y, 60, 0, 7); g.stroke(); }
			});
			K.decal(TW, TL, top, 0, H + 0.001, -TL / 2, { glow: 0.3 });
			K.box(TW + 0.12, H, TL + 0.12, '#1d3b66', 0, H / 2, -TL / 2);
			for (const s of [-1, 1]) K.box(0.05, 0.05, TL + 0.12, '#f4f4f0', s * (TW / 2 + 0.03), H + 0.025, -TL / 2);
			for (const z of [0.03, -TL - 0.03]) for (const s of [-1, 1]) K.box((TW - GOAL) / 2, 0.05, 0.05, '#f4f4f0', s * (TW + GOAL) / 4, H + 0.025, z);
			for (const z of [0.02, -TL - 0.02]) K.box(GOAL, 0.02, 0.04, '#111', 0, H + 0.005, z);
			puck = K.cyl(PR, PR, 0.012, '#d1323a', 0, H + 0.006, -1);
			const mallet = (c) => { const m = K.cyl(MR, MR, 0.025, c, 0, H + 0.012, 0); K.cyl(0.02, 0.025, 0.05, c, 0, 0.035, 0, m); return m; };
			mine = mallet('#2a6fd1');
			theirs = mallet('#f2b33d');
			// the scoreboard over the far end
			S.board = K.el('position:absolute;left:50%;top:calc(66px + env(safe-area-inset-top));transform:translateX(-50%);font:800 28px system-ui;color:#eafaf6;text-shadow:0 2px 6px #000;pointer-events:none');
		}
		function reset() {
			S = { ...S, me: 0, them: 0, px: 0, pz: -0.5, vx: 0, vz: 0, mx: 0, mz: -0.15, mvx: 0, mvz: 0, ax: 0, az: -TL + 0.15, speed: 1.6, state: 'play', t: 0 };
			faceoff(1);
		}
		function faceoff(toMe) {
			S.px = 0; S.pz = toMe ? -0.7 : -TL + 0.7; S.vx = (Math.random() - 0.5) * 0.3; S.vz = 0; S.state = 'play'; S.t = 0;
			S.board.textContent = `${S.me} – ${S.them}`;
			K.hud(`First to ${TO} · you are blue`);
		}
		let want = null;
		function aim(x, y) { want = K.onPlane(x, y, H); }
		function press(down, x, y) { if (down) aim(x, y); else want = null; }
		function move(x, y) { if (K.ptr.down) aim(x, y); }

		// a round thing against the puck: push it out, and take the mover's speed into it
		function strike(cx, cz, cvx, cvz) {
			const dx = S.px - cx, dz = S.pz - cz, d = Math.hypot(dx, dz);
			if (d >= PR + MR || d < 1e-6) return false;
			const nx = dx / d, nz = dz / d;
			S.px = cx + nx * (PR + MR); S.pz = cz + nz * (PR + MR);
			const rel = (S.vx - cvx) * nx + (S.vz - cvz) * nz;
			if (rel < 0) { S.vx -= 1.9 * rel * nx; S.vz -= 1.9 * rel * nz; K.noise(0.05, { vol: clamp(-rel * 0.05, 0.05, 0.3), f: 1400, q: 2 }); return true; }
			return false;
		}
		function step(dt) {
			S.px += S.vx * dt; S.pz += S.vz * dt;
			S.vx *= 1 - 0.08 * dt; S.vz *= 1 - 0.08 * dt;
			if (Math.abs(S.px) > TW / 2 - PR) { S.px = Math.sign(S.px) * (TW / 2 - PR); S.vx = -S.vx * 0.9; K.noise(0.04, { vol: 0.1, f: 900 }); }
			for (const [end, who] of [[0, 'them'], [-TL, 'me']]) {
				const past = end === 0 ? S.pz > -PR : S.pz < -TL + PR;
				if (!past) continue;
				if (Math.abs(S.px) < GOAL / 2) { goal(who); return; }
				S.pz = end === 0 ? -PR : -TL + PR; S.vz = -S.vz * 0.9;
			}
			strike(S.mx, S.mz, S.mvx, S.mvz);
			strike(S.ax, S.az, S.avx || 0, S.avz || 0);
			const sp = Math.hypot(S.vx, S.vz);
			if (sp > 5.5) { S.vx *= 5.5 / sp; S.vz *= 5.5 / sp; }
		}
		function goal(who) {
			S[who]++;
			S.state = 'goal'; S.t = 0; S.lastBy = who;
			K.say(who === 'me' ? 'Goal!' : 'They score.', 1200);
			if (who === 'me') { K.tone(660, 0.1, { vol: 0.12 }); K.tone(990, 0.2, { vol: 0.12, at: 0.1 }); S.speed += 0.25; }
			else K.tone(220, 0.3, { type: 'sawtooth', vol: 0.06 });
			S.board.textContent = `${S.me} – ${S.them}`;
		}
		function update(dt) {
			S.t += dt;
			// your mallet chases your finger (it has weight: it can't teleport)
			if (want) {
				const tx = clamp(want.x, -TW / 2 + MR, TW / 2 - MR), tz = clamp(want.z, -TL / 2 + MR, -MR);
				const nx = S.mx + clamp(tx - S.mx, -7 * dt, 7 * dt), nz = S.mz + clamp(tz - S.mz, -7 * dt, 7 * dt);
				S.mvx = (nx - S.mx) / dt; S.mvz = (nz - S.mz) / dt; S.mx = nx; S.mz = nz;
			} else { S.mvx = S.mvz = 0; }
			// the house: attack a slow puck on its side, otherwise guard the goal mouth
			const onTheirs = S.pz < -TL / 2, slow = Math.hypot(S.vx, S.vz) < 1.2;
			let gx = clamp(S.px * 0.6, -GOAL / 2, GOAL / 2), gz = -TL + 0.14;
			if (onTheirs && (slow || S.vz > 0)) { gx = S.px; gz = S.pz - 0.06; }
			else if (onTheirs && S.vz < 0) { gx = S.px + S.vx * 0.15; gz = Math.max(-TL + 0.1, S.pz - 0.25); }
			gz = clamp(gz, -TL + MR, -TL / 2 - MR); gx = clamp(gx, -TW / 2 + MR, TW / 2 - MR);
			const ms = S.speed * dt, ox = S.ax, oz = S.az;
			S.ax += clamp(gx - S.ax, -ms, ms); S.az += clamp(gz - S.az, -ms, ms);
			S.avx = (S.ax - ox) / dt; S.avz = (S.az - oz) / dt;
			if (S.state === 'play') for (let i = 0; i < 6; i++) { step(dt / 6); if (S.state !== 'play') break; }
			else if (S.state === 'goal' && S.t > 1.2) {
				if (S.me >= TO || S.them >= TO) {
					S.state = 'over';
					const won = S.me > S.them;
					K.finish(S.me - S.them, { line: won ? `You win ${S.me}–${S.them}!` : `The house wins ${S.them}–${S.me}.`, rows: [['Your goals', S.me], ['Their goals', S.them]], unit: 'goal diff' });
				} else faceoff(S.lastBy === 'them');
			}
			puck.visible = S.state !== 'goal';
			puck.position.set(S.px, H + 0.006, S.pz);
			mine.position.set(S.mx, H + 0.012, S.mz);
			theirs.position.set(S.ax, H + 0.012, S.az);
			// from over your end, the whole table in view
			K.frame(0, H, -1.0, 1.2, 1.75, 0, 0.8, 0.55, 0.74, 4);
		}
		return K.wrap({ build, reset, update, press, move });
	},
};
