// Baseball at the diamond: one inning at the plate against a live pitcher, with a defence
// behind him. Score what runs you can before three outs.
//   tap to swing, timed as in the batting cage (batting.js, whose pitching and hitting this
//     shares): on time squares it up, early pulls it, late pushes it the other way; tap
//     high on the screen to lift it, low to hit it on the ground.
//   or don't: a pitch out of the strike zone (the faint box over the plate) is a ball if
//     you let it go, four of them a walk; one in the zone is a strike, three an out.
// A ball you hit flies out over the real field. Over the fence is a home run. A fly ball a
// fielder can run under is caught; a grounder at an infielder is thrown out at first;
// anything else is a hit, a single, a double down the line or into the gap, a triple to
// the wall. Runners move up as far as the batter does, and walks push them along.

import { makeKit, clamp, rand } from './kit.js';
import { fieldVenue, fieldStage, figure } from './fieldgame.js';
import { SWING, TYPES, fly, carry, pitchVelocity, breakStep, offTheBat } from './batting.js';

const MAX_PITCHES = 30;

export const GAME = {
	id: 'baseball',
	title: 'Baseball',
	blurb: 'An inning at the plate against a live pitcher: swing or take, score before three outs.',
	where: fieldVenue('baseball'),
	create(ctx) {
		const F = fieldStage(ctx, 'baseball', 'youth');
		const { base, mound, fence } = F.field.d, s = base / 27.43, q = base / Math.SQRT2, big = fence > 80;
		const K = makeKit(ctx, GAME, { accent: '#ff6b6b', pose: F.pose, dist: 1, span: [fence * 1.5, fence + 4, 12], flat: 2.5, backdrop: 'meadow', dome: fence + 40 });
		const { THREE } = ctx;
		let ball, bat, pitcher, catcher, zone, marker, board, S = {};
		const fielders = [], runners = [];
		// where the defence stands (the frame's metres: the plate at the origin, the mound at -z)
		const POS = [[18 * s, -24 * s], [8 * s, -36 * s], [-8 * s, -36 * s], [-18 * s, -24 * s], [-fence * 0.42, -fence * 0.68], [0, -fence * 0.8], [fence * 0.42, -fence * 0.68]];
		const BASES = [[q, -q], [0, -2 * q], [-q, -q], [0, 0]];

		function build() {
			F.lay(K);
			ball = K.ball(0.037, K.mat('#f7f4ee', { rough: 0.5, glow: 0.3 }), 0, 1, -mound);
			bat = K.group(); bat.position.set(-0.55, K.groundY(0, 0) + 1.0, 0.1);
			K.cyl(0.03, 0.018, 0.85, K.mat('#c8a060', { rough: 0.4 }), 0, 0.42, 0, bat, 10);
			const home = { shirt: '#1d3f7a', pants: '#e8e4d8', cap: '#1d3f7a' };
			pitcher = figure(K, home);
			pitcher.g.position.set(0, K.groundY(0, -mound) + 0.25 * s, -mound);
			pitcher.g.rotation.y = Math.PI;
			catcher = figure(K, { shirt: '#2a2a2a', pants: '#e8e4d8', cap: '#1d3f7a' });
			catcher.g.position.set(0, K.groundY(0, 1.2), 1.2); catcher.g.scale.set(1, 0.6, 1);
			// you, at the plate: a right-handed batter, side on to the pitcher
			const batter = figure(K, { shirt: '#c8322c', pants: '#e8e4d8', cap: '#c8322c' });
			batter.g.position.set(-0.8, K.groundY(-0.8, 0), 0.05); batter.g.rotation.y = -Math.PI / 2;
			for (const [x, z] of POS) { const f = figure(K, home); f.g.position.set(x, K.groundY(x, z), z); f.g.rotation.y = Math.PI; f.home = [x, z]; fielders.push(f); }
			for (let i = 0; i < 3; i++) { const r = figure(K, { shirt: '#c8322c', pants: '#e8e4d8', cap: '#c8322c' }); r.g.visible = false; runners.push(r); }
			// the strike zone, faint over the plate, and where the last pitch crossed it
			const zy = K.groundY(0, 0);
			zone = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.44, 0.55)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
			zone.position.set(0, zy + 0.8, 0); K.root.add(zone);
			marker = K.ball(0.04, K.mat('#ff6b6b', { basic: true, opacity: 0.8 }), 0, -5, 0);
			// the scoreboard: the count, the outs, the bases
			board = K.el('position:absolute;left:calc(12px + env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom));padding:8px 12px;border-radius:14px;background:rgba(8,20,26,.82);border:1px solid rgba(255,255,255,.18);color:#eafaf6;font:600 13px system-ui;display:flex;gap:12px;align-items:center;');
		}
		function reset() {
			S = { n: 0, runs: 0, outs: 0, balls: 0, strikes: 0, hits: 0, hr: 0, walks: 0, longest: 0, bases: [false, false, false], state: 'wait', t: 0, log: [], p: new THREE.Vector3(), v: new THREE.Vector3(), swingT: -1, pitch: null };
			for (const f of fielders) { f.g.position.set(f.home[0], K.groundY(...f.home), f.home[1]); }
			wait();
		}
		function wait() { S.state = 'wait'; S.t = 0; S.swingT = -1; S.contact = false; ball.visible = false; S.chaser = null; hud(); }
		const dots = (n, of, on) => Array.from({ length: of }, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;margin-left:3px;background:${i < n ? on : 'rgba(255,255,255,.2)'}"></span>`).join('');
		function hud() {
			K.hud(`Runs ${S.runs} · ${S.outs} out${S.outs === 1 ? '' : 's'}${S.state === 'wait' || S.state === 'pitch' ? '\nTap to swing · let a ball go by' : ''}`);
			const b = S.bases, sq = (x, y, on) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" transform="rotate(45 ${x} ${y})" fill="${on ? '#ff6b6b' : 'none'}" stroke="currentColor" stroke-width="1.5"/>`;
			board.innerHTML = `<svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true">${sq(22, 8, b[1])}${sq(36, 20, b[0])}${sq(8, 20, b[2])}</svg><div><div>B${dots(S.balls, 3, '#6bd66b')}</div><div>S${dots(S.strikes, 2, '#ffd23f')}</div><div>O${dots(S.outs, 2, '#ff6b6b')}</div></div>`;
		}
		function throwPitch() {
			const [name, sp, drop, sweep] = TYPES[Math.floor(Math.random() * TYPES.length)];
			// the same time to the plate as the machine's, from this mound
			const speed = sp * rand(0.95, 1.04) * mound / 16, time = mound / speed;
			S.pitch = { name, speed, drop, sweep, time };
			// in the zone, or just off it (up, down, in, away)
			const zy = K.groundY(0, 0);
			const inZone = Math.random() < 0.6;
			let tx = rand(-0.2, 0.2), ty = rand(0.58, 1.02);
			if (!inZone) { if (Math.random() < 0.5) tx = (Math.random() < 0.5 ? -1 : 1) * rand(0.32, 0.55); else ty = Math.random() < 0.5 ? rand(0.15, 0.42) : rand(1.18, 1.45); }
			S.p.set(0.2, K.groundY(0, -mound) + 0.25 * s + 1.8, -mound + 1);
			pitchVelocity(S.p, S.pitch, tx, zy + ty, S.v);
			S.cross = null;
			S.state = 'pitch'; S.t = 0; ball.visible = true;
			K.noise(0.12, { vol: 0.12, f: 500 });
		}
		function press(down, x, y) {
			if (!down || S.swingT >= 0 || (S.state !== 'pitch' && S.state !== 'wait')) return;
			const r = K.size();
			S.swingT = 0; S.lift = clamp(0.5 - (y - r.top) / r.height, -0.4, 0.4);
			K.noise(0.15, { vol: 0.06, f: 800 });
		}
		function pitchDone(called) {
			const P = S.pitch;
			if (called === 'strike') { S.strikes++; K.say(S.swingT >= 0 ? `Swing and a miss: ${P.name.toLowerCase()}` : `Strike ${S.strikes}: ${P.name.toLowerCase()}`, 1100); }
			else { S.balls++; K.say(`Ball ${S.balls}`, 900); }
			S.log.push(called === 'strike' ? 'K' : 'B');
			if (S.strikes >= 3) out('Strike three!');
			else if (S.balls >= 4) { K.say('Ball four: take your base', 1200); S.walks++; walk(); S.balls = 0; S.strikes = 0; }
			next();
		}
		// (the count starts again for the next batter)
		function out(msg) { S.outs++; S.balls = 0; S.strikes = 0; K.say(`${msg}${S.outs < 3 ? ` ${S.outs} out${S.outs > 1 ? 's' : ''}` : ''}`, 1400); }
		function walk() {
			// forced along: only the runners behind someone move
			const b = S.bases;
			if (b[0] && b[1] && b[2]) S.runs++;
			if (b[0] && b[1]) b[2] = true;
			if (b[0]) b[1] = true;
			b[0] = true;
		}
		function advance(n) {
			const b = S.bases, nb = [false, false, false];
			let scored = 0;
			for (let i = 2; i >= 0; i--) if (b[i]) { if (i + n >= 3) scored++; else nb[i + n] = true; }
			if (n >= 4) scored++; else nb[n - 1] = true;
			S.bases = nb; S.runs += scored;
			return scored;
		}
		function next() {
			S.n++; S.contact = false;
			for (const f of fielders) f.g.position.set(f.home[0], K.groundY(...f.home), f.home[1]);
			if (S.outs >= 3 || S.n >= MAX_PITCHES) {
				S.state = 'over'; ball.visible = false; hud();
				K.finish(S.runs, { unit: S.runs === 1 ? 'run' : 'runs', line: `${S.hits} hit${S.hits === 1 ? '' : 's'}${S.hr ? `, ${S.hr} home run${S.hr > 1 ? 's' : ''}` : ''}${S.walks ? `, ${S.walks} walk${S.walks > 1 ? 's' : ''}` : ''}`, rows: [['Longest hit', S.longest ? `${Math.round(S.longest)} m` : '—'], ['Pitches seen', S.n]] });
			} else wait();
		}
		function update(dt) {
			S.t += dt;
			if (S.swingT >= 0) S.swingT += dt;
			const zy = K.groundY(0, 0);
			if (S.state === 'wait') {
				if (S.swingT > 0.6) S.swingT = -1;
				if (S.t > 1.8) throwPitch();
			} else if (S.state === 'pitch') {
				breakStep(S.v, S.pitch, S.t, dt);
				const z0 = S.p.z;
				S.p.addScaledVector(S.v, dt);
				if (z0 < 0 && S.p.z >= 0) { S.cross = [S.p.x, S.p.y - zy]; marker.position.set(S.p.x, S.p.y, 0.02); }
				// contact: the bat comes through SWING seconds after the tap, over the plate
				if (S.swingT >= SWING - 0.1 && S.swingT <= SWING + 0.1 && !S.contact && Math.abs(S.p.z) < 0.6) {
					const e = (S.swingT - SWING) - S.p.z / S.pitch.speed, reachX = Math.abs(S.p.x) < 0.55, reachY = S.p.y - zy > 0.2 && S.p.y - zy < 1.45;
					// (chasing one out of the zone is weaker contact)
					const off = Math.max(0, Math.abs(S.p.x) - 0.22) + Math.max(0, 0.55 - (S.p.y - zy), S.p.y - zy - 1.08);
					const qq = (1 - Math.abs(e) / 0.1) * clamp(1 - off * 2.2, 0.15, 1);
					if (qq > 0 && reachX && reachY) hit(e, qq);
				}
				if (S.state === 'pitch' && S.p.z > 2) {
					const c = S.cross || [9, 9];
					pitchDone(S.swingT >= 0 || (Math.abs(c[0]) < 0.25 && c[1] > 0.52 && c[1] < 1.1) ? 'strike' : 'ball');
				}
			} else if (S.state === 'fly') {
				for (let i = 0; i < 4; i++) {
					fly(S.p, S.v, dt / 4);
					const g = K.groundY(S.p.x, S.p.z);
					if (S.p.y < g + 0.04) { S.p.y = g + 0.04; S.v.set(S.v.x * 0.55, Math.abs(S.v.y) * 0.3, S.v.z * 0.55); S.landed = true; }
					// over the fence and gone
					if (S.p.x * S.p.x + S.p.z * S.p.z > (fence + 3) ** 2) S.v.multiplyScalar(0.9);
				}
				// the fielder who has it runs to it
				const C = S.chaser;
				if (C) { const dx = C.to[0] - C.f.g.position.x, dz = C.to[1] - C.f.g.position.z, d = Math.hypot(dx, dz), st = Math.min(d, 7.2 * dt * (S.t > 0.4 ? 1 : 0)); if (d > 0.1) { C.f.g.position.x += dx / d * st; C.f.g.position.z += dz / d * st; C.f.g.position.y = K.groundY(C.f.g.position.x, C.f.g.position.z); C.f.g.rotation.y = Math.atan2(-dx, -dz); } }
				if (S.t > Math.min(4.5, S.call.hang + 1.2)) called();
			} else if (S.state === 'after') {
				if (S.t > 1.2) next();
			}
			// the runners on their bases
			for (let i = 0; i < 3; i++) { const r = runners[i], [x, z] = BASES[i]; r.g.visible = S.bases[i]; r.g.position.set(x + (i === 1 ? 0 : Math.sign(x) * -1.2), K.groundY(x, z), z + 0.8); }
			// the pitcher's windup and delivery
			const wind = S.state === 'wait' ? clamp((S.t - 1.1) / 0.7, 0, 1) : S.state === 'pitch' ? 1 : 0;
			pitcher.arms[1].rotation.x = S.state === 'pitch' ? clamp(1 - S.t * 4, -1, 1) * -2.8 + 1.2 : -wind * 2.8;
			// the bat comes round over SWING seconds and follows through
			const sw = S.swingT < 0 ? 0 : clamp(S.swingT / (SWING * 1.6), 0, 1);
			bat.rotation.set(0, -sw * 3.4, 0.9 - sw * 0.75);
			ball.position.copy(S.p);
			marker.visible = !!S.cross && S.state !== 'fly';
			// the view: from behind the plate, over the catcher, then up and after a ball in the air
			if (S.state === 'fly' || (S.state === 'after' && S.contact)) {
				const d = Math.hypot(S.p.x, S.p.z);
				K.cam(S.p.x * 0.25, zy + 4 + d * 0.12, 7 + d * 0.08, S.p.x, Math.max(zy + 1, S.p.y * 0.7), S.p.z, 2.2);
			} else K.cam(0.3, zy + 2.2, 4.6, 0, zy + 0.9, -mound, 4);
		}
		function hit(e, qq) {
			offTheBat(e, qq, S.lift, S.v, big ? 1 : 0.78);
			S.state = 'fly'; S.t = 0; S.contact = true; S.landed = false;
			const zy = K.groundY(0, 0), c = carry(S.p, S.v, zy), ang = Math.atan2(c.x, -c.z), up = Math.asin(clamp(S.v.y / S.v.length(), -1, 1));
			S.call = { ...c, ang, up, foul: Math.abs(ang) > Math.PI / 4 + 0.01 };
			// who goes for it: the fielder nearest where it comes down
			let best = null;
			for (const f of fielders) { const d = Math.hypot(f.home[0] - c.x, f.home[1] - c.z); if (!best || d < best.d) best = { f, d }; }
			S.chaser = !S.call.foul && best ? { f: best.f, to: [c.x, c.z], d: best.d } : null;
			K.noise(0.08, { vol: 0.2 + qq * 0.2, f: 1800 + qq * 1500, q: 2 });
			if (qq > 0.85) K.say('Crack! Squared up.', 700);
		}
		// the play's outcome, once the ball has come down
		function called() {
			const c = S.call;
			S.state = 'after'; S.t = 0;
			if (c.foul) { if (S.strikes < 2) S.strikes++; K.say('Foul ball', 900); S.log.push('F'); hud(); return; }
			if (c.d >= fence) { S.hits++; S.hr++; S.longest = Math.max(S.longest, c.d); const r = advance(4); K.say(r > 1 ? `Home run! ${r} runs score` : 'Home run!', 1600); K.tone(523, 0.15, { vol: 0.1 }); K.tone(659, 0.15, { vol: 0.1, at: 0.15 }); K.tone(784, 0.4, { vol: 0.1, at: 0.3 }); S.log.push('HR'); newBatterSoon(); return; }
			// a fly ball a fielder can run under is caught; a grounder at an infielder is an out
			const reach = (f) => Math.hypot(f.home[0] - c.x, f.home[1] - c.z);
			const flyBall = c.up > 0.18 && c.hang > 1.2, runner = Math.max(...fielders.map((f) => 7.2 * (c.hang - 0.6) - reach(f)));
			if (flyBall && runner > 0) { S.log.push('FO'); out('Caught!'); hud(); return; }
			if (!flyBall) {
				// along the ground: from the plate out through the infield
				const ex = S.v.length(), path = (f) => { const L = Math.hypot(c.x, c.z) || 1, t = clamp((f.home[0] * c.x + f.home[1] * c.z) / (L * L), 0, 1.4); return Math.hypot(f.home[0] - c.x * t, f.home[1] - c.z * t); };
				const fielded = fielders.slice(0, 4).some((f) => path(f) < 3.5 * s + 1.5) || Math.hypot(c.x, c.z + mound) < 3;
				if (fielded && ex < 34) { S.log.push('GO'); out('Grounded out.'); hud(); return; }
			}
			const n = c.d > fence * 0.88 && Math.abs(c.ang) > 0.25 && Math.abs(c.ang) < 0.6 ? 3 : c.d > fence * 0.62 || (Math.abs(Math.abs(c.ang) - Math.PI / 4) < 0.08 && c.d > fence * 0.45) ? 2 : 1;
			S.hits++; S.longest = Math.max(S.longest, c.d);
			const r = advance(n);
			K.say(`${['Single', 'Double', 'Triple'][n - 1]}!${r ? ` ${r} run${r > 1 ? 's' : ''} in` : ''}`, 1400);
			S.log.push(['1B', '2B', '3B'][n - 1]);
			newBatterSoon();
		}
		function newBatterSoon() { S.balls = 0; S.strikes = 0; hud(); }
		return K.wrap({ build, reset, update, press, end: F.unlay });
	},
};
