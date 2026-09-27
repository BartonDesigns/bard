// Kite flying at the Berkeley Marina, where the wind comes off the bay every afternoon and
// the sky over Cesar Chavez Park is full of kites. A two-line stunt kite, ninety seconds.
//   hold the left side of the screen to pull the left line (the kite turns left), the
//     right side to turn right; let go and it flies straight on.
//   fly it through the gold rings for points; loop it for more; don't dive it into the grass.
// The kite lives on the wind window, a quarter-sphere of sky downwind of you at the length
// of its lines. It flies where its nose points, fastest in the power zone low in the middle
// of the window and slowest out at the edges and overhead, where it stalls and sinks. The
// wind gusts; a strong gust makes it fly faster and harder to hold.

import { makeKit, clamp, rand } from './kit.js';

const L = 28, TIME = 90;

export const GAME = {
	id: 'kite',
	title: 'Kite Flying',
	blurb: 'A stunt kite over the Berkeley Marina: steer through the rings, loop it, keep it up.',
	where: { kind: 'site', sites: [{ name: 'Cesar Chavez Park, Berkeley Marina', lat: 37.8699, lon: -122.3197, r: 250 }, { name: 'Crissy Field', lat: 37.8039, lon: -122.4636, r: 250 }, { name: 'Ocean Beach', lat: 37.7594, lon: -122.5107, r: 300 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ff5a7a', dist: 0.5, span: [2, 2] });
		const { THREE } = ctx;
		let kite, lines, ring, tails = [], S = {};
		const hand = new THREE.Vector3(0, 1.3, 0);

		// a point on the wind window: elevation e and azimuth a (0 = straight downwind, ahead)
		const onWindow = (e, a, out = new THREE.Vector3(), r = L) => out.set(Math.sin(a) * Math.cos(e) * r, hand.y + Math.sin(e) * r, -Math.cos(a) * Math.cos(e) * r);
		function build() {
			kite = K.group();
			const sail = K.canvas(256, 128, (g) => {
				const cols = ['#ff5a7a', '#ffd23f', '#39d0ff', '#6bd66b'];
				for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.beginPath(); g.moveTo(128, 0); g.lineTo(i * 64, 128); g.lineTo(i * 64 + 64, 128); g.fill(); }
			});
			const shape = new THREE.Shape();
			shape.moveTo(0, 0.55); shape.lineTo(-1.2, -0.25); shape.lineTo(0, -0.05); shape.lineTo(1.2, -0.25); shape.closePath();
			const geo = new THREE.ShapeGeometry(shape);
			// map the shape's x/y onto the canvas
			const uv = geo.attributes.uv, pos = geo.attributes.position;
			for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 1.2) / 2.4, (pos.getY(i) + 0.25) / 0.8);
			K.mesh(geo, K.mat('#ffffff', { map: sail, side: THREE.DoubleSide, glow: 0.35 }), 0, 0, 0, kite);
			K.box(0.02, 0.8, 0.02, '#222', 0, 0.15, 0.01, kite);
			for (let i = 0; i < 2; i++) { const t = K.box(0.04, 0.9, 0.005, i ? '#ffd23f' : '#ff5a7a', (i ? 0.5 : -0.5), -0.6, 0, kite); tails.push(t); }
			const g = new THREE.BufferGeometry().setFromPoints([hand, hand, hand, hand]);
			lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xeeeeee, transparent: true, opacity: 0.6 }));
			lines.frustumCulled = false;
			K.root.add(lines);
			ring = K.mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 32), K.mat('#ffd23f', { glow: 0.6, metal: 0.4 }), 0, 10, -20);
			// the flyer, and a windsock to show the wind
			K.cyl(0.2, 0.18, 1.1, '#2a6fd1', 0, 0.85, 0.3);
			K.ball(0.13, '#e0b894', 0, 1.55, 0.3);
			K.cyl(0.03, 0.03, 3, '#dddddd', 2.5, 1.5, 1);
			const sock = K.cyl(0.18, 0.08, 0.9, '#ff7a45', 2.5, 2.9, 0.55);
			sock.rotation.x = Math.PI / 2;
		}
		function reset() {
			S = { e: 0.5, a: 0, psi: 0, time: TIME, score: 0, rings: 0, loops: 0, turned: 0, gust: 1, gustT: 0, state: 'fly', t: 0, crashes: 0, steer: 0 };
			placeRing();
		}
		function placeRing() { S.re = rand(0.25, 0.95); S.ra = rand(-0.9, 0.9); onWindow(S.re, S.ra, ring.position, L); ring.lookAt(K.world(hand)); }
		function press(down, x) {
			const r = K.size();
			S.steer = down ? (x - r.left < r.width / 2 ? -1 : 1) : 0;
		}
		function update(dt) {
			S.t += dt;
			if (S.state !== 'over') S.time -= dt;
			// gusts come and go
			S.gustT -= dt;
			if (S.gustT <= 0) { S.gustT = rand(2, 6); S.gustTo = rand(0.8, 1.45); }
			S.gust += ((S.gustTo || 1) - S.gust) * dt * 0.8;
			if (S.state === 'fly') {
				// steering turns the nose; the kite flies along its nose at the window's speed
				S.psi += S.steer * 3.2 * dt;
				S.turned += S.steer * 3.2 * dt;
				const power = Math.cos(S.e) * Math.cos(S.a);
				const v = (5 + 17 * Math.max(0, power)) * S.gust;
				S.e += Math.cos(S.psi) * v / L * dt;
				S.a += Math.sin(S.psi) * v / L * dt / Math.max(0.2, Math.cos(S.e));
				// overhead and at the edges it runs out of wind and sinks
				if (power < 0.25) S.e -= (0.25 - power) * 0.6 * dt;
				if (S.e > 1.45) { S.e = 1.45; S.psi = Math.PI - S.psi; }
				S.a = clamp(S.a, -1.35, 1.35);
				S.score += dt * 2;
				if (Math.abs(S.turned) > Math.PI * 2) { S.turned = 0; S.loops++; S.score += 50; K.say('Loop! +50', 900); K.tone(700, 0.15, { vol: 0.08, to: 1100 }); }
				if (S.e < 0.03) {
					S.state = 'crash'; S.t = 0; S.crashes++; S.score = Math.max(0, S.score - 40);
					K.say('Into the grass! -40', 1300); K.noise(0.3, { vol: 0.2, f: 300 });
				}
				const kp = onWindow(S.e, S.a);
				if (kp.distanceTo(ring.position) < 2.6) { S.rings++; S.score += 100; K.say('Through the ring! +100', 900); K.tone(880, 0.12, { vol: 0.1 }); K.tone(1320, 0.2, { vol: 0.1, at: 0.1 }); placeRing(); }
			} else if (S.state === 'crash' && S.t > 1.5) {
				// you walk out and relaunch it
				S.state = 'fly'; S.e = 0.35; S.a = 0; S.psi = 0; S.turned = 0;
			}
			if (S.time <= 0 && S.state !== 'over') {
				S.state = 'over';
				const sc = Math.round(S.score);
				K.finish(sc, { unit: 'pts', line: `${S.rings} ring${S.rings === 1 ? '' : 's'}, ${S.loops} loop${S.loops === 1 ? '' : 's'}`, rows: [['Crashes', S.crashes], ['Wind', 'westerly off the Golden Gate']] });
			}
			// the kite faces back along the lines, its nose where it flies
			const kp = onWindow(S.e, S.a);
			kite.position.copy(kp);
			kite.lookAt(K.world(hand));
			kite.rotateZ(-S.psi);
			tails.forEach((t, i) => { t.rotation.z = Math.sin(K.time * 9 + i) * 0.35; });
			const pos = lines.geometry.attributes.position, side = new THREE.Vector3(Math.cos(S.a), 0, Math.sin(S.a)).multiplyScalar(0.25);
			pos.setXYZ(0, hand.x - 0.25, hand.y, hand.z); pos.setXYZ(1, kp.x - side.x, kp.y, kp.z - side.z);
			pos.setXYZ(2, hand.x + 0.25, hand.y, hand.z); pos.setXYZ(3, kp.x + side.x, kp.y, kp.z + side.z);
			pos.needsUpdate = true;
			ring.rotation.z += dt * 0.8;
			K.hud(`${Math.max(0, Math.ceil(S.time))} s · ${Math.round(S.score)} pts · wind ${S.gust > 1.2 ? 'gusting' : S.gust < 0.9 ? 'light' : 'steady'}${S.steer ? S.steer < 0 ? ' · ◀ left' : ' · right ▶' : ''}`);
			K.cam(0, 1.8, 4.5, kp.x * 0.35, 6 + kp.y * 0.4, -L * 0.6, 2);
		}
		return K.wrap({ build, reset, update, press });
	},
};
