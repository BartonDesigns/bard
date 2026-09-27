// Sandcastle: build the tallest tower you can on the beach before the tide comes in.
//   a slab of packed sand slides back and forth over the tower; tap to drop it. Whatever
//     hangs over the edge crumbles away, and the next slab is only as big as what stayed,
//     so the tower narrows as you go. Drop one dead on (a Perfect) and it stays full size;
//     three Perfects in a row and the sand packs out a little wider again.
//   miss the tower completely and that's your castle: the flag goes on top, and the tide
//     rolls in to take it.
// The slabs come in alternately from the side and from the front, a little faster each
// time.

import { makeKit } from './kit.js';

const LAYER = 0.16, START = 0.9;

export const GAME = {
	id: 'sandcastle',
	title: 'Sandcastle',
	blurb: 'Stack slabs of sand into a tower before the tide: tap to drop, don\'t let it overhang.',
	where: { kind: 'site', sites: [{ name: 'Ocean Beach', lat: 37.7594, lon: -122.5107, r: 400 }, { name: 'Baker Beach', lat: 37.7936, lon: -122.4836, r: 200 }, { name: 'Stinson Beach', lat: 37.9005, lon: -122.6445, r: 300 }, { name: 'Crissy Field beach', lat: 37.8055, lon: -122.4570, r: 200 }, { name: 'Half Moon Bay State Beach', lat: 37.4636, lon: -122.4460, r: 300 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#f2c46a', dist: 2.5, span: [3, 3] });
		const { THREE } = ctx;
		let sandTex, tide, flag, S = {};
		const pieces = [];

		function build() {
			sandTex = K.canvas(64, 64, (g) => { g.fillStyle = '#e2c48e'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${120 + Math.random() * 60},${90 + Math.random() * 50},50,.2)`; g.fillRect(Math.random() * 64, Math.random() * 64, 1.5, 1.5); } });
			K.mesh(new THREE.CircleGeometry(12, 32), K.mat('#dcc08a', { rough: 1 }), 0, 0.005, 0).rotation.x = -Math.PI / 2;
			// a bucket and spade lying by, and the sea out beyond
			K.cyl(0.14, 0.1, 0.22, '#e8403a', 1.1, 0.11, 0.6);
			K.box(0.06, 0.02, 0.4, '#2a6fd1', -1.0, 0.02, 0.7).rotation.y = 0.5;
			K.mesh(new THREE.PlaneGeometry(40, 20), K.mat('#2f7e96', { rough: 0.2, metal: 0.3 }), 0, -0.05, -18).rotation.x = -Math.PI / 2;
			tide = K.mesh(new THREE.BoxGeometry(12, 0.25, 1.5), K.mat('#e8f4f6', { opacity: 0.8, glow: 0.3 }), 0, -1, -9);
			flag = K.group();
			K.cyl(0.008, 0.008, 0.35, '#6b4a2e', 0, 0.175, 0, flag);
			K.box(0.14, 0.09, 0.004, '#d1323a', 0.07, 0.3, 0, flag);
			flag.visible = false;
		}
		function slab(w, d, y, x, z, col) {
			const m = K.mesh(new THREE.BoxGeometry(w, LAYER, d), K.mat('#ffffff', { map: sandTex, rough: 1, glow: col }), x, y + LAYER / 2, z);
			m.material.color.set(col ? '#f0d49e' : '#e0c088');
			return m;
		}
		function reset() {
			for (const p of pieces) K.drop(p.m);
			pieces.length = 0;
			S = { n: 0, w: START, d: START, cx: 0, cz: 0, state: 'build', t: 0, streak: 0, perfects: 0, speed: 0.9, moving: null, turrets: [] };
			flag.visible = false; tide.position.set(0, -1, -9);
			pieces.push({ m: slab(START, START, 0, 0, 0, 0), fall: false });
			next();
		}
		// a new slab starts off to one side (or in front) and slides across
		function next() {
			const axis = S.n % 2 ? 'z' : 'x', y = (S.n + 1) * LAYER;
			const m = slab(S.w, S.d, y, S.cx, S.cz, S.n % 2 ? 0.2 : 0.14);
			S.moving = { m, axis, s: -1.3, dir: 1 };
			m.position[axis] = (axis === 'x' ? S.cx : S.cz) - 1.3;
			hud();
		}
		function hud() { K.hud(`Height ${S.n} slab${S.n === 1 ? '' : 's'} · ${(S.n * LAYER * 100).toFixed(0)} cm${S.streak > 1 ? ` · ${S.streak} perfect in a row` : ''}`); }
		function press(down) {
			if (!down || S.state !== 'build' || !S.moving) return;
			const mv = S.moving, ax = mv.axis, size = ax === 'x' ? S.w : S.d, centre = ax === 'x' ? S.cx : S.cz;
			let off = mv.m.position[ax] - centre;
			if (Math.abs(off) < 0.025) {
				// dead on: snap it, keep the size, and after three the sand packs out wider
				off = 0; S.streak++; S.perfects++;
				mv.m.position[ax] = centre;
				K.say(S.streak >= 3 ? 'Perfect! It packs out wider.' : 'Perfect!', 700);
				K.tone(700 + S.streak * 80, 0.12, { vol: 0.1 });
				if (S.streak >= 3) { if (ax === 'x') S.w = Math.min(START, S.w + 0.05); else S.d = Math.min(START, S.d + 0.05); }
			} else {
				S.streak = 0;
				const keep = size - Math.abs(off);
				if (keep <= 0) { crumble(mv.m, Math.sign(off)); S.moving = null; finish(); return; }
				// what stayed on, and what crumbles off the side it overhung
				const newC = centre + off / 2, gone = Math.abs(off), side = Math.sign(off);
				const y = mv.m.position.y;
				K.drop(mv.m);
				const w = ax === 'x' ? keep : S.w, d = ax === 'z' ? keep : S.d;
				const kept = slab(w, d, y - LAYER / 2, ax === 'x' ? newC : S.cx, ax === 'z' ? newC : S.cz, S.n % 2 ? 0.2 : 0.14);
				pieces.push({ m: kept });
				const cw = ax === 'x' ? gone : S.w, cd = ax === 'z' ? gone : S.d;
				const edge = centre + side * (size / 2 + gone / 2);
				const bit = slab(cw, cd, y - LAYER / 2, ax === 'x' ? edge : S.cx, ax === 'z' ? edge : S.cz, 0.1);
				crumble(bit, side);
				if (ax === 'x') { S.w = keep; S.cx = newC; } else { S.d = keep; S.cz = newC; }
				K.noise(0.25, { vol: 0.12, f: 900, q: 0.5 });
				S.moving = null;
				S.n++; S.speed += 0.05;
				next();
				return;
			}
			pieces.push({ m: mv.m });
			S.moving = null; S.n++; S.speed += 0.05;
			K.noise(0.1, { vol: 0.12, f: 300, type: 'lowpass' });
			next();
		}
		function crumble(m, side) { pieces.push({ m, fall: true, vy: 0, vx: side * 0.4, spin: side * 2 }); }
		function finish() {
			S.state = 'tide'; S.t = 0;
			flag.visible = true;
			flag.position.set(S.cx, (S.n + 1) * LAYER, S.cz);
			K.say(`${S.n} slabs high. Here comes the tide…`, 2000);
		}
		function update(dt) {
			S.t += dt;
			const mv = S.moving;
			if (mv && S.state === 'build') {
				const c = mv.axis === 'x' ? S.cx : S.cz;
				mv.s += mv.dir * S.speed * dt;
				if (mv.s > 1.3) { mv.s = 1.3; mv.dir = -1; } else if (mv.s < -1.3) { mv.s = -1.3; mv.dir = 1; }
				mv.m.position[mv.axis] = c + mv.s;
			}
			for (const p of pieces) if (p.fall) {
				p.vy -= 9.8 * dt;
				p.m.position.y += p.vy * dt; p.m.position.x += p.vx * dt;
				p.m.rotation.z -= p.spin * dt;
				if (p.m.position.y < -0.3) { p.fall = false; p.m.visible = false; }
			}
			if (S.state === 'tide') {
				// the wave runs up the beach, over the castle, and slumps it
				const k = Math.min(1, S.t / 3);
				tide.position.set(0, 0.1, -9 + k * 11);
				if (tide.position.z > -0.5) for (const p of pieces) if (!p.fall && p.m.visible) p.m.scale.y = Math.max(0.2, p.m.scale.y - dt * 0.6);
				if (S.t > 3.5) {
					S.state = 'over';
					const cm = Math.round(S.n * LAYER * 100);
					K.finish(S.n, { unit: 'slabs', line: `${cm} cm of castle${S.perfects ? `, ${S.perfects} perfect drops` : ''}`, rows: [['Tide', 'coming in, as it does']] });
				}
			}
			flag.rotation.y = Math.sin(K.time * 2) * 0.4;
			const h = (S.n + 1) * LAYER;
			K.cam(1.6, h + 1.3, 2.4, 0, h - 0.2, 0, 2.5);
		}
		function end() { pieces.length = 0; }
		return K.wrap({ build, reset, update, press, end });
	},
};
