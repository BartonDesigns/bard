// Skateboarding at the SoMa West skatepark, under the freeway: a sixty-second line through
// cones, rails, stair gaps and kickers, as many tricks as you can land.
//   tap to ollie (over cones, across gaps, up onto rails and ledges);
//   in the air, swipe left for a kickflip, right for a heelflip, down for a pop shove-it,
//     up for a 360 flip; the board has to come round before you land or you bail.
//   land on a rail to grind it; tap to pop off the end.
// Tricks string into a combo: each one raises the multiplier until you roll along on the
// ground for a moment, which banks it. Three bails and the session is over.

import { makeKit, clamp, rand } from './kit.js';

const TIME = 60, GRAV = 22, POP = 6.2, RAIL_H = 0.42;
const TRICKS = { left: ['Kickflip', 100, 'z'], right: ['Heelflip', 100, 'z'], down: ['Pop shove-it', 80, 'y'], up: ['360 flip', 180, 'zy'] };

export const GAME = {
	id: 'skate',
	title: 'Skateboarding',
	blurb: 'A sixty-second line under the freeway: ollie, flip, grind, and hold the combo.',
	where: { kind: 'site', sites: [{ name: 'SoMa West Skatepark', lat: 37.7704, lon: -122.4196, r: 90 }, { name: 'Potrero del Sol Skatepark', lat: 37.7524, lon: -122.4079, r: 70 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#c6ff3d', dist: 0.5, span: [10, 34, 6], flat: 2, backdrop: 'meadow', dome: 90 });
		const { THREE } = ctx;
		let rider, deck, floorTex, pillars = [], S = {};

		function build() {
			floorTex = K.canvas(128, 128, (g) => { g.fillStyle = '#9a9a96'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } g.fillStyle = '#6a6a66'; g.fillRect(0, 0, 128, 2); });
			floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(3, 40);
			K.decal(6, 120, floorTex, 0, 0.01, -50);
			// the freeway overhead and its pillars, graffiti on them
			K.box(14, 0.8, 120, '#7a7a76', 0, 7, -50);
			for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
				const p = K.box(0.9, 7, 0.9, i % 2 ? '#8a8680' : '#848078', s * 5, 3.5, -i * 15);
				pillars.push(p);
			}
			rider = K.group();
			deck = K.group(rider);
			K.box(0.2, 0.03, 0.8, '#1a1a1a', 0, 0.09, 0, deck);
			for (const z of [-0.26, 0.26]) for (const x of [-0.08, 0.08]) K.cyl(0.028, 0.028, 0.03, '#f4f4f0', x, 0.035, z, deck, 10).rotation.z = Math.PI / 2;
			const body = K.group(rider);
			K.cyl(0.11, 0.13, 0.62, '#d1323a', 0, 0.95, 0, body);
			K.cyl(0.07, 0.07, 0.6, '#27324a', -0.07, 0.4, 0.06, body);
			K.cyl(0.07, 0.07, 0.6, '#27324a', 0.07, 0.4, -0.06, body);
			K.ball(0.11, '#8a5a3a', 0, 1.38, 0, body);
			body.rotation.y = Math.PI / 2;
			S.body = body;
		}
		function reset() {
			for (const o of S.obs || []) K.drop(o.g);
			S = { body: S.body, time: TIME, score: 0, combo: 0, mult: 1, bails: 0, speed: 7, y: 0, vy: 0, state: 'roll', ground: 0, trick: null, trickT: 0, obs: [], nextZ: -18, grind: null, bailT: 0, log: [], tricks: 0 };
			for (let i = 0; i < 5; i++) spawn();
		}
		// the line ahead: cones, rails, gaps and kickers, far enough apart to set up for each
		function spawn() {
			const type = ['cone', 'rail', 'gap', 'kicker', 'cone', 'rail'][Math.floor(Math.random() * 6)];
			const len = type === 'rail' ? rand(4, 7) : type === 'gap' ? rand(2.2, 3.2) : type === 'kicker' ? 1.6 : 0.4;
			const g = K.group();
			g.position.z = S.nextZ;
			if (type === 'cone') K.mesh(new THREE.ConeGeometry(0.16, 0.45, 12), '#ff7a1a', 0, 0.225, 0, g);
			if (type === 'rail') {
				const r = K.cyl(0.03, 0.03, len, K.mat('#c9ced6', { metal: 0.8, rough: 0.2 }), 0, RAIL_H, -len / 2, g, 10); r.rotation.x = Math.PI / 2;
				for (const z of [-0.2, -len + 0.2]) K.cyl(0.025, 0.025, RAIL_H, '#9aa0a8', 0, RAIL_H / 2, z, g, 8);
			}
			if (type === 'gap') { K.box(3, 0.02, len, '#141414', 0, 0.012, -len / 2, g); K.box(3, 0.3, 0.3, '#b8b4ac', 0, -0.1, 0.1, g); }
			if (type === 'kicker') { const k = K.box(1.2, 0.05, 1.7, '#8a6a4a', 0, 0.3, -len / 2, g); k.rotation.x = 0.36; }
			S.obs.push({ type, z: S.nextZ, len, g, done: false });
			S.nextZ -= len + rand(9, 15);
		}
		function hud() { K.hud(`${Math.max(0, Math.ceil(S.time))} s · ${Math.round(S.score)}${S.combo ? ` · combo ${S.combo} ×${S.mult}` : ''} · bails ${S.bails}/3`); }
		function press(down) {
			if (down || S.state === 'bail' || S.state === 'over') return;
			const sw = K.swipe(), big = Math.hypot(sw.dx, sw.dy) > 40;
			const air = S.state === 'air';
			if (!big || (!air && sw.dy < 0)) { if (!air) ollie(POP); return; }
			if (!air || S.trick) return;
			const dir = Math.abs(sw.dx) > Math.abs(sw.dy) ? (sw.dx < 0 ? 'left' : 'right') : (sw.dy > 0 ? 'down' : 'up');
			S.trick = dir; S.trickT = 0;
			K.noise(0.05, { vol: 0.12, f: 3000, q: 2 });
		}
		function ollie(v) {
			if (S.state === 'grind') { S.grind = null; bank(40, 'Grind'); }
			S.state = 'air'; S.vy = v; S.ground = 0;
			K.noise(0.07, { vol: 0.2, f: 1800, q: 3 });
		}
		function bank(pts, name) { S.combo++; S.mult = Math.min(8, S.combo); S.score += pts * S.mult; S.tricks++; S.log.push(name); K.say(`${name} +${pts * S.mult}`, 800); }
		function bail(why) {
			S.state = 'bail'; S.bailT = 0; S.bails++; S.combo = 0; S.mult = 1; S.trick = null; S.y = 0; S.vy = 0;
			K.say(`Bail! ${why}`, 1200); K.noise(0.4, { vol: 0.25, f: 400 });
		}
		// what is under the rider now: the obstacle spanning z = 0, if any
		const under = () => S.obs.find((o) => o.z >= 0 && o.z - o.len <= 0);
		function update(dt) {
			S.t = (S.t || 0) + dt;
			if (S.state !== 'over') S.time -= dt;
			const mv = S.state === 'bail' ? S.speed * 0.3 : S.speed;
			S.speed = Math.min(11, S.speed + dt * 0.05);
			for (const o of S.obs) { o.z += mv * dt; o.g.position.z = o.z; }
			floorTex.offset.y += mv * dt / 3;
			for (const p of pillars) { p.position.z += mv * dt; if (p.position.z > 10) p.position.z -= 120; }
			while (S.obs.length && S.obs[0].z - S.obs[0].len > 8) { K.drop(S.obs.shift().g); spawn(); }
			const o = under();
			if (S.state === 'bail') { S.bailT += dt; if (S.bailT > 1.1) { S.state = S.bails >= 3 ? 'end' : 'roll'; } }
			else if (S.state === 'roll') {
				S.ground += dt;
				if (S.ground > 1.2 && S.combo) { S.combo = 0; S.mult = 1; }
				if (o && !o.done) {
					if (o.type === 'cone' && o.z > 0.15) { o.done = true; bail('Clipped the cone'); }
					else if (o.type === 'rail' && o.z < 0.4) { o.done = true; bail('Rolled into the rail'); }
					else if (o.type === 'gap' && o.z > 0.4) { o.done = true; bail('Ate the stairs'); }
					else if (o.type === 'kicker' && o.z > 0.3) { o.done = true; ollie(9); K.say('Kicker: big air!', 700); }
				}
			} else if (S.state === 'air') {
				S.vy -= GRAV * dt; S.y += S.vy * dt;
				if (S.trick) S.trickT += dt;
				// a cone or a gap passing under you in the air is cleared
				if (o && !o.done && (o.type === 'cone' || o.type === 'gap')) { if (o.type === 'cone') o.done = true; S.cleared = true; }
				if (o && o.type === 'rail' && S.vy < 0 && S.y <= RAIL_H && S.y > RAIL_H - 0.25 && o.z > 0.3 && o.z - o.len < -0.5) {
					// a clean landing on the rail: grind (a trick still turning is a bail)
					if (S.trick && S.trickT < 0.4) bail('Landed mid-flip');
					else { if (S.trick) bank(TRICKS[S.trick][1], TRICKS[S.trick][0]); S.trick = null; S.state = 'grind'; S.grind = o; S.y = RAIL_H; o.done = true; K.noise(0.8, { vol: 0.1, f: 3500, q: 6 }); }
				} else if (S.y <= 0) {
					S.y = 0;
					if (o && o.type === 'gap' && o.z - o.len < -0.2 && o.z > 0.2) bail('Came up short on the gap');
					else if (S.trick && S.trickT < 0.4) bail('Landed mid-flip');
					else {
						if (S.trick) bank(TRICKS[S.trick][1], TRICKS[S.trick][0]);
						else if (S.cleared) bank(20, 'Ollie');
						S.cleared = false;
						S.trick = null; S.state = 'roll'; S.ground = 0; K.noise(0.08, { vol: 0.2, f: 300 });
					}
					if (o) o.done = true;
				}
			} else if (S.state === 'grind') {
				S.score += dt * 30 * S.mult;
				if (!S.grind || S.grind.z - S.grind.len > 0) { S.grind = null; S.state = 'air'; S.vy = 1; bank(40, 'Grind'); }
			}
			if (S.state === 'end' || (S.time <= 0 && S.state !== 'over')) {
				S.state = 'over';
				K.finish(Math.round(S.score), { unit: 'pts', line: `${S.tricks} tricks landed${S.bails >= 3 ? ', then three bails' : ''}`, rows: [['Last tricks', S.log.slice(-4).join(', ') || '–']] });
			}
			// the rider: board flipping through the trick, crouched on landing, sliding on a bail
			rider.position.set(0, S.y, 0);
			const k = S.trick ? clamp(S.trickT / 0.4, 0, 1) : 0, axes = S.trick ? TRICKS[S.trick][2] : '';
			deck.rotation.set(0, axes.includes('y') ? k * Math.PI * 2 * (S.trick === 'up' ? 1 : 0.5) : 0, axes.includes('z') ? k * Math.PI * 2 * (S.trick === 'right' ? -1 : 1) : 0);
			S.body.rotation.z = S.state === 'bail' ? 1.3 : 0;
			S.body.position.y = S.state === 'air' ? 0.1 : 0;
			hud();
			K.cam(1.9, 2.1, 3.6, 0, 0.8, -6, 5);
		}
		function end() { pillars = []; }
		return K.wrap({ build, reset, update, press, end });
	},
};
