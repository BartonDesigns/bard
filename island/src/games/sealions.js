// Feeding time at Pier 39's K-Dock, where the sea lions have hauled out on the floats since
// the 1989 earthquake. Forty-five seconds, a bucket of herring.
//   sea lions heave themselves up onto the floats and bark for a fish: tap one to toss it a
//     herring. The quicker you feed it, the more it's worth; wait too long and it slides
//     back into the bay in a huff.
//   the big bull (the one with the thick neck) wants two fish and is worth three times as
//     much.
//   gulls land on the floats too: don't feed the gulls, they'll take the fish and your points.
// A thrown fish flies a real arc from the rail to the float, and the sea lion catches it.

import { makeKit, clamp, rand } from './kit.js';

const TIME = 45;
const SLOTS = [[-3.2, -6], [0, -6.5], [3.2, -6], [-3.8, -10], [0, -10.5], [3.8, -10]];

export const GAME = {
	id: 'sealions',
	title: 'Sea Lion Feeding',
	blurb: 'Pier 39\'s K-Dock: toss herring to the barking sea lions, fast; don\'t feed the gulls.',
	where: { kind: 'site', sites: [{ name: 'Pier 39, K-Dock', lat: 37.8087, lon: -122.4103, r: 70 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ffb347', dist: 1, span: [10, 13, 1], place: 'water' });
		const { THREE } = ctx;
		let S = {}, lions = [], fish, WL = 0;

		function makeLion(bull, pool) {
			const g = K.group(pool);
			const brown = bull ? '#4a3524' : '#7a5a3a';
			const body = K.mesh(new THREE.SphereGeometry(0.45, 14, 10), brown, 0, 0.35, 0, g);
			body.scale.set(0.8, 0.7, 1.9);
			const neck = K.group(g); neck.position.set(0, 0.45, -0.55);
			K.mesh(new THREE.SphereGeometry(bull ? 0.34 : 0.25, 12, 8), brown, 0, 0.25, -0.05, neck).scale.set(1, 1.3, 1);
			const head = K.group(neck); head.position.set(0, 0.62, -0.1);
			K.mesh(new THREE.SphereGeometry(0.2, 12, 8), brown, 0, 0, 0, head).scale.set(0.9, 0.9, 1.3);
			K.ball(0.06, '#2a2018', 0, -0.04, -0.26, head);
			for (const s of [-1, 1]) { K.ball(0.035, '#0a0a0a', s * 0.1, 0.07, -0.16, head); const f = K.box(0.35, 0.05, 0.25, brown, s * 0.42, 0.12, -0.35, g); f.rotation.z = s * 0.4; }
			g.userData = { neck, head };
			return g;
		}
		function makeGull(pool) {
			const g = K.group(pool);
			K.mesh(new THREE.SphereGeometry(0.14, 10, 8), '#f4f4f0', 0, 0.2, 0, g).scale.set(0.8, 0.8, 1.6);
			K.ball(0.08, '#f4f4f0', 0, 0.33, -0.18, g);
			K.mesh(new THREE.ConeGeometry(0.025, 0.1, 6), '#f2c200', 0, 0.32, -0.3, g).rotation.x = -Math.PI / 2;
			for (const s of [-1, 1]) K.box(0.04, 0.05, 0.32, '#8a9098', s * 0.12, 0.24, 0.05, g);
			return g;
		}
		function build() {
			// at the pier the floats ride on the bay itself; anywhere else they're in a
			// concrete tank, like an aquarium's, its water raised to the level of the rim
			WL = K.wet ? 0 : 0.8;
			const pool = K.group(); pool.position.y = WL;
			if (!K.wet) {
				K.box(13.4, 0.2, 10.4, '#8a8f94', 0, 0.1, -7.9);
				for (const s of [-1, 1]) {
					K.box(0.4, 1.0, 10.4, '#b8bcc0', s * 6.7, 0.5, -7.9);
					K.box(13.8, 1.0, 0.4, '#b8bcc0', 0, 0.5, s < 0 ? -13.1 : -2.7);
				}
				K.mesh(new THREE.PlaneGeometry(13, 10), K.mat('#2a5a6a', { rough: 0.2, metal: 0.3 }), 0, -0.02, -7.9, pool).rotation.x = -Math.PI / 2;
				for (let i = 0; i < 5; i++) K.mesh(new THREE.DodecahedronGeometry(0.6 + i * 0.1, 0), K.mat('#6a6660', { rough: 1 }), -5 + i * 2.5, 0.1, -12.3, pool).scale.y = 0.6;
			}
			for (const [x, z] of SLOTS) K.box(2.6, 0.25, 2.6, '#8a7a62', x, -0.1, z, pool);
			// the viewing deck you stand on, on its piles
			for (const x of [-5.5, 0, 5.5]) for (const z of [-0.5, 1.1]) K.box(0.3, 1.9, 0.3, '#5a4a3a', x, 0.95, z);
			// the pier rail in front of you
			K.box(12, 0.08, 0.1, '#6b4a2e', 0, 3.1, -0.6);
			for (let i = -5; i <= 5; i++) K.box(0.08, 1.1, 0.08, '#6b4a2e', i * 1.1, 2.55, -0.6);
			K.box(12, 0.2, 2, '#7a6a52', 0, 1.9, 0.3);
			lions = SLOTS.map(([x, z], i) => {
				const l = makeLion(i === 4, pool), gull = makeGull(pool);
				l.position.set(x, -1.2, z); gull.position.set(x, -9, z);
				return { l, gull, x, z, state: 'away', t: rand(0.2, 3), kind: 'lion', bull: i === 4, fed: 0, patience: 0, bark: 0 };
			});
			fish = K.mesh(new THREE.SphereGeometry(0.08, 8, 6), K.mat('#c0c8d0', { metal: 0.6, rough: 0.3 }), 0, -9, 0);
			fish.scale.set(0.5, 0.5, 2);
		}
		function reset() {
			S = { time: TIME, score: 0, fed: 0, missed: 0, gulls: 0, state: 'play', flights: [] };
			for (const s of lions) { s.state = 'away'; s.t = rand(0.2, 2.5); s.l.position.y = -1.2; s.gull.position.y = -9; }
		}
		function bark() {
			K.noise(0.18, { vol: 0.18, f: 520, q: 3 });
			K.tone(330, 0.16, { type: 'sawtooth', vol: 0.05, to: 200 });
		}
		function press(down, x, y) {
			if (!down || S.state !== 'play') return;
			// which float did the tap land on? (its sea lion or gull)
			const targets = lions.filter((s) => s.state === 'up').map((s) => (s.kind === 'gull' ? s.gull : s.l));
			const hit = K.pick(x, y, targets);
			let slot = null;
			if (hit) slot = lions.find((s) => { let o = hit.object; while (o && o !== s.l && o !== s.gull) o = o.parent; return !!o; });
			if (!slot) {
				// a near miss on screen still counts, within a finger's width
				let bd = 60;
				for (const s of lions) if (s.state === 'up') { const p = K.toScreen(new THREE.Vector3(s.x, WL + 0.6, s.z)); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; slot = s; } }
			}
			if (!slot) return;
			S.flights.push({ s: slot, t: 0 });
			K.noise(0.1, { vol: 0.08, f: 1200 });
		}
		function feed(s) {
			if (s.state !== 'up') return;
			if (s.kind === 'gull') {
				S.score = Math.max(0, S.score - 50); S.gulls++;
				K.say('The gull took it! -50', 1100);
				K.tone(1400, 0.1, { type: 'square', vol: 0.05 }); K.tone(1100, 0.12, { type: 'square', vol: 0.05, at: 0.1 });
				s.state = 'leaving'; s.t = 0; return;
			}
			s.fed++;
			if (s.bull && s.fed < 2) { K.say('The bull wants another!', 900); bark(); return; }
			const quick = clamp(1 - s.up / s.patience, 0, 1), pts = Math.round((40 + 60 * quick) * (s.bull ? 3 : 1));
			S.score += pts; S.fed++;
			K.say(`+${pts}${quick > 0.75 ? ' · quick!' : ''}`, 700);
			s.state = 'happy'; s.t = 0;
		}
		function update(dt) {
			if (S.state === 'play') S.time -= dt;
			for (const s of lions) {
				s.t -= dt;
				if (s.state === 'away' && s.t <= 0 && S.time > 1) {
					// something hauls out: mostly sea lions, sometimes a gull
					s.kind = Math.random() < 0.18 ? 'gull' : 'lion'; s.state = 'rising'; s.t = 0.5; s.fed = 0; s.up = 0;
					s.patience = s.kind === 'gull' ? rand(1.5, 2.5) : rand(2.4, 3.6) - Math.min(1, (TIME - S.time) / TIME);
				} else if (s.state === 'rising') {
					if (s.kind === 'lion') s.l.position.y = -1.2 + (1 - Math.max(0, s.t) / 0.5) * 1.2;
					else s.gull.position.y = 0.03 + Math.max(0, s.t) * 3;
					if (s.t <= 0) { s.state = 'up'; s.bark = 0; }
				} else if (s.state === 'up') {
					s.up += dt;
					s.bark -= dt;
					if (s.kind === 'lion' && s.bark <= 0) { s.bark = rand(0.7, 1.3); bark(); s.barkT = 0.3; }
					if (s.up > s.patience) {
						if (s.kind === 'lion') { S.missed++; K.say('It slid off in a huff.', 800); }
						s.state = 'leaving'; s.t = 0.5;
					}
				} else if (s.state === 'happy') {
					if (s.t < -0.9) { s.state = 'leaving'; s.t = 0.5; }
				} else if (s.state === 'leaving') {
					if (s.kind === 'lion') s.l.position.y = -1.2 * (1 - Math.max(0, s.t) / 0.5);
					else s.gull.position.y += dt * 3;
					if (s.t <= 0) { s.state = 'away'; s.t = rand(0.4, 2.2); s.l.position.y = -1.2; s.gull.position.y = -9; }
				}
				// the head: up and barking, or down with a fish
				s.barkT = Math.max(0, (s.barkT || 0) - dt);
				const { neck, head } = s.l.userData;
				neck.rotation.x = s.state === 'happy' ? 0.3 : -0.25 - s.barkT * 1.2;
				head.rotation.x = s.state === 'happy' ? 0.4 : Math.sin(K.time * 3 + s.x) * 0.1 - s.barkT;
			}
			// fish in the air: from the rail to the float in half a second
			for (const f of S.flights) f.t += dt / 0.5;
			const flying = S.flights.find((f) => f.t < 1);
			fish.visible = !!flying;
			if (flying) { const k = flying.t; fish.position.set(flying.s.x * k, 2.6 + (WL + 0.9 - 2.6) * k + Math.sin(k * Math.PI) * 1.6, -0.5 + (flying.s.z + 0.4 + 0.5) * k); fish.rotation.x = k * 6; }
			for (const f of S.flights) if (f.t >= 1) feed(f.s);
			S.flights = S.flights.filter((f) => f.t < 1);
			K.hud(`${Math.max(0, Math.ceil(S.time))} s · ${S.score} pts · fed ${S.fed}`);
			if (S.state === 'play' && S.time <= 0) {
				S.state = 'over';
				K.finish(S.score, { unit: 'pts', line: S.missed === 0 ? 'Not one went hungry.' : `${S.missed} slid off hungry.`, rows: [['Sea lions fed', S.fed], ['Gulls fed (oops)', S.gulls]] });
			}
			// the floats from the deck; a tall phone backs off (but no further than the deck's end)
			K.frame(0, WL + 0.3, -8.2, 11.5, 5, 0, 0.5, 1, 0.9, 3, 12);
		}
		return K.wrap({ build, reset, update, press });
	},
};
