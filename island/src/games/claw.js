// The claw machine in the corner of the Musée Mécanique, full of San Francisco plush: sea
// lions, Dungeness crabs, cable cars, Karl the Fog, and one Golden Gate Bridge right at the
// back that nobody ever wins. Five credits.
//   hold to move the claw right; let go to stop. Then hold again to move it back, into the
//     machine; let go and it drops, grabs, and carries whatever it has to the chute.
//   a small shadow under the claw shows where it will come down, and the view swings round
//     while you judge the depth.
// The grab is honest but not generous: a claw centred on a prize grips it well, one off to
// the side barely at all, and on the way back to the chute a weak grip may let it slip.

import { makeKit, rand } from './kit.js';

const W = 0.9, D = 0.7, FLOOR = 0.95, TOP = 1.75, CHUTE = [-0.34, 0.24];
const KINDS = [['sea lion', '#8a6a4a', 1, 0.9], ['crab', '#d1553a', 1, 0.8], ['cable car', '#a02a36', 2, 0.65], ['Karl the Fog', '#e8ecef', 2, 0.7], ['sourdough', '#d8b27a', 1, 0.85]];

// 'the crab', but just 'Karl the Fog'
const the = (p) => (/^Karl/.test(p.name) ? p.name : 'the ' + p.name);

export const GAME = {
	id: 'claw',
	title: 'Claw Machine',
	blurb: 'Five credits at the Musée Mécanique claw: sea lions, crabs, and the bridge nobody wins.',
	where: { kind: 'site', sites: [{ name: 'Musée Mécanique, Pier 45', lat: 37.8094, lon: -122.4169, r: 50 }, { name: 'Pier 39 arcade', lat: 37.8087, lon: -122.4098, r: 70 }] },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#ff5ab4', dist: 1.3, span: [1.4, 1.4] });
		const { THREE } = ctx;
		let claw, fingers = [], shadow, cable, prizes = [], S = {};

		function plush(kind, x, z) {
			const [name, col, value, grip] = kind, g = K.group();
			if (name === 'cable car') { K.box(0.16, 0.08, 0.09, col, 0, 0.04, 0, g); K.box(0.16, 0.05, 0.085, '#efe3c2', 0, 0.105, 0, g); }
			else if (name === 'Karl the Fog') { for (const [dx, dy, r] of [[0, 0.05, 0.06], [-0.06, 0.035, 0.045], [0.06, 0.035, 0.045], [0.02, 0.09, 0.04]]) K.ball(r, col, dx, dy, 0, g); K.ball(0.01, '#222', -0.02, 0.07, 0.055, g); K.ball(0.01, '#222', 0.02, 0.07, 0.055, g); }
			else if (name === 'crab') { K.mesh(new THREE.SphereGeometry(0.07, 12, 8), col, 0, 0.04, 0, g).scale.set(1.3, 0.55, 1); for (const s of [-1, 1]) K.ball(0.03, col, s * 0.1, 0.05, 0.05, g); }
			else if (name === 'sourdough') { K.mesh(new THREE.SphereGeometry(0.07, 12, 8), col, 0, 0.045, 0, g).scale.set(1.4, 0.7, 1); }
			else if (name === 'bridge') { for (const s of [-1, 1]) K.box(0.025, 0.2, 0.025, col, s * 0.07, 0.1, 0, g); K.box(0.2, 0.02, 0.05, col, 0, 0.06, 0, g); }
			else { K.mesh(new THREE.SphereGeometry(0.06, 12, 8), col, 0, 0.06, 0, g).scale.set(0.9, 1, 1.5); K.ball(0.04, col, 0, 0.12, -0.07, g); }
			g.position.set(x, FLOOR, z);
			g.rotation.y = rand(-0.6, 0.6);
			return { g, name, value, grip, x, z, won: false };
		}
		function build() {
			// the cabinet: base, glass, the lit header, the chute at front left
			K.box(W + 0.12, FLOOR, D + 0.12, '#2a1a3a', 0, FLOOR / 2, 0);
			K.box(W + 0.12, 0.3, D + 0.12, '#2a1a3a', 0, TOP + 0.15, 0);
			const glass = K.mat('#bfe6ff', { opacity: 0.12, rough: 0.05 });
			K.box(W, TOP - FLOOR, 0.01, glass, 0, (TOP + FLOOR) / 2, D / 2 + 0.06);
			for (const s of [-1, 1]) K.box(0.01, TOP - FLOOR, D, glass, s * (W / 2 + 0.06), (TOP + FLOOR) / 2, 0);
			K.box(W, TOP - FLOOR, 0.01, '#3a2a5a', 0, (TOP + FLOOR) / 2, -D / 2 - 0.06);
			for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(0.04, TOP - FLOOR, 0.04, '#ff5ab4', x * (W / 2 + 0.06), (TOP + FLOOR) / 2, z * (D / 2 + 0.06));
			const head = K.canvas(256, 64, (g) => { g.fillStyle = '#ff5ab4'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#fff'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; g.fillText('SUPER CLAW', 128, 45); });
			K.box(W + 0.1, 0.22, 0.02, K.mat('#ffffff', { map: head, glow: 0.7 }), 0, TOP + 0.15, D / 2 + 0.08);
			K.box(0.2, 0.01, 0.2, '#0a0a0a', CHUTE[0], FLOOR + 0.001, CHUTE[1]);
			for (const s of [-1, 1]) K.box(0.01, 0.12, 0.2, '#bfe6ff', CHUTE[0] + s * 0.1, FLOOR + 0.06, CHUTE[1]);
			// the claw: a hub, a cable up to the gantry, three fingers
			claw = K.group();
			K.cyl(0.035, 0.035, 0.06, K.mat('#d8dce4', { metal: 0.9, rough: 0.2 }), 0, 0, 0, claw);
			for (let i = 0; i < 3; i++) {
				const piv = K.group(claw); piv.rotation.y = i * Math.PI * 2 / 3;
				const f = K.group(piv); f.position.set(0.03, -0.02, 0);
				K.box(0.012, 0.12, 0.012, K.mat('#d8dce4', { metal: 0.9, rough: 0.2 }), 0.02, -0.06, 0, f);
				fingers.push(f);
			}
			const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
			cable = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x999999 }));
			K.root.add(cable);
			shadow = K.mesh(new THREE.CircleGeometry(0.035, 16), K.mat('#000000', { basic: true, opacity: 0.45 }), 0, FLOOR + 0.2, 0);
			shadow.rotation.x = -Math.PI / 2;
		}
		function reset() {
			for (const p of prizes) K.drop(p.g);
			prizes = [];
			for (let i = 0; i < 17; i++) {
				const x = -W / 2 + 0.1 + (i % 6) * 0.14 + rand(-0.02, 0.02), z = -D / 2 + 0.1 + Math.floor(i / 6) * 0.17 + rand(-0.02, 0.02);
				if (Math.hypot(x - CHUTE[0], z - CHUTE[1]) < 0.18) continue;
				prizes.push(plush(KINDS[i % KINDS.length], x, z));
			}
			prizes.push(plush(['bridge', '#c0362c', 5, 0.35], 0.3, -D / 2 + 0.08));
			S = { credits: 5, won: [], state: 'right', x: CHUTE[0], z: CHUTE[1], y: TOP - 0.1, open: 1, held: null, t: 0, moving: false };
			hud();
		}
		function hud() {
			const tip = { right: 'Hold to move right ▶', back: 'Hold to move back ▲', drop: 'Dropping…', lift: '…', home: '…' }[S.state] || '';
			K.hud(`Credits ${S.credits} · prizes ${S.won.length} · ${tip}`);
		}
		function press(down) {
			if (S.state === 'right' || S.state === 'back') {
				if (down) S.moving = true;
				else if (S.moving) {
					S.moving = false;
					if (S.state === 'right') { S.state = 'back'; }
					else { S.state = 'drop'; S.t = 0; K.tone(300, 0.4, { type: 'square', vol: 0.03, to: 180 }); }
					hud();
				}
			}
		}
		// the top of the pile under a point (prizes are about 0.12 tall)
		function pileAt(x, z) {
			let h = FLOOR;
			for (const p of prizes) if (!p.won && p !== S.held && Math.hypot(p.x - x, p.z - z) < 0.08) h = Math.max(h, FLOOR + 0.1);
			return h;
		}
		function update(dt) {
			S.t += dt;
			const sp = 0.22 * dt;
			if (S.state === 'right' && S.moving) S.x = Math.min(W / 2 - 0.06, S.x + sp);
			if (S.state === 'back' && S.moving) S.z = Math.max(-D / 2 + 0.05, S.z - sp);
			if ((S.state === 'right' || S.state === 'back') && S.moving && Math.floor(S.t * 8) % 2) K.noise(0.02, { vol: 0.02, f: 200 });
			if (S.state === 'drop') {
				S.y -= dt * 0.35;
				if (S.y <= pileAt(S.x, S.z) + 0.1) { S.state = 'close'; S.t = 0; }
			} else if (S.state === 'close') {
				S.open = Math.max(0, 1 - S.t / 0.6);
				if (S.t > 0.7) {
					// the grab: the nearest prize under the claw, gripped by how centred it is
					let best = null, bd = 0.09;
					for (const p of prizes) { const d = Math.hypot(p.x - S.x, p.z - S.z); if (!p.won && d < bd) { bd = d; best = p; } }
					if (best) {
						S.grip = best.grip * (1 - bd / 0.09 * 0.75);
						if (Math.random() < S.grip + 0.1) { S.held = best; K.tone(520, 0.1, { vol: 0.06 }); }
					}
					S.state = 'lift'; S.t = 0;
				}
			} else if (S.state === 'lift') {
				S.y = Math.min(TOP - 0.1, S.y + dt * 0.3);
				if (S.y >= TOP - 0.1) { S.state = 'home'; S.t = 0; }
			} else if (S.state === 'home') {
				// back over the chute; a weak grip may give on the way
				const dx = CHUTE[0] - S.x, dz = CHUTE[1] - S.z, d = Math.hypot(dx, dz);
				if (d > 0.005) { const k = Math.min(1, 0.22 * dt / d); S.x += dx * k; S.z += dz * k; }
				if (S.held && Math.random() < dt * (1 - S.grip) * 0.9) { const p = S.held; S.held = null; p.x = S.x; p.z = S.z; K.say(`Oh no, ${the(p)} slipped!`, 1000); K.noise(0.1, { vol: 0.1, f: 300 }); }
				if (d <= 0.005) { S.state = 'release'; S.t = 0; }
			} else if (S.state === 'release') {
				S.open = Math.min(1, S.t / 0.3);
				if (S.held) {
					const p = S.held; S.held = null; p.won = true; p.g.visible = false; S.won.push(p);
					K.say(`You won ${the(p)}!`, 1500); K.tone(660, 0.1, { vol: 0.12 }); K.tone(880, 0.1, { vol: 0.12, at: 0.1 }); K.tone(1320, 0.25, { vol: 0.12, at: 0.2 });
				}
				if (S.t > 0.8) {
					S.credits--;
					if (S.credits > 0) { S.state = 'right'; hud(); }
					else {
						S.state = 'over';
						const pts = S.won.reduce((a, p) => a + p.value, 0);
						K.finish(pts, { unit: 'pts', line: S.won.length ? `You won: ${S.won.map((p) => p.name).join(', ')}` : 'Nothing this time. It\'s always rigged. Probably.', rows: [['Prizes', S.won.length], ['Credits', 5]] });
					}
				}
			}
			// prizes that were held ride under the claw; dropped ones fall back to the pile
			for (const p of prizes) {
				if (p.won) continue;
				if (p === S.held) p.g.position.set(S.x, S.y - 0.19, S.z);
				else { p.g.position.x = p.x; p.g.position.z = p.z; p.g.position.y += (FLOOR - p.g.position.y) * Math.min(1, dt * 8); }
			}
			claw.position.set(S.x, S.y, S.z);
			fingers.forEach((f) => { f.rotation.z = 0.2 + S.open * 0.5; });
			const cp = cable.geometry.attributes.position;
			cp.setXYZ(0, S.x, TOP + 0.02, S.z); cp.setXYZ(1, S.x, S.y, S.z); cp.needsUpdate = true;
			shadow.position.set(S.x, pileAt(S.x, S.z) + 0.125, S.z);
			shadow.visible = S.state === 'right' || S.state === 'back';
			hud();
			if (S.state === 'back') K.cam(0.9, 1.75, 0.95, 0, 1.2, -0.1, 2.5);
			else K.cam(0, 1.7, 1.35, 0, 1.3, -0.2, 2.5);
		}
		return K.wrap({ build, reset, update, press });
	},
};
