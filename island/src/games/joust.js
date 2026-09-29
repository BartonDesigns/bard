// The joust, on the tourney ground's lists (arenas.js): three passes down the tilt at a
// knight riding the other way. You see it from the saddle, your lance couched across the
// horse's neck; hold a finger on the screen and the lance's point follows it (the gallop
// bobs it about). Where the point is when the knights meet decides it: the middle of his
// shield breaks your lance (3), the shield (2), a glance (1). He aims at you too, and
// better each pass. Unhorse him with a clean strike on the last pass for 5.

import { makeKit, clamp } from './kit.js';
import { fieldStage } from './fieldgame.js';

const PASSES = 3, SPEED = 9, LANE = 1.5, LANCE = 3.6;

export const GAME = {
	id: 'joust',
	title: 'The Joust',
	blurb: 'Three passes down the tilt: hold the lance point on his shield as you meet.',
	where: {
		kind: 'dynamic',
		sites: (W, x, z, R) => (W?.fields?.near?.(x, z, R) || []).filter((f) => f.kind === 'arena' && f.theme === 'tourney').map((f) => ({ ...f.site, spot: joustSpot(f) })),
	},
	create(ctx) {
		// the stage: at the far end of the lists, on your side of the tilt, facing down it
		const F = fieldStage(ctx, 'arena', 'tourney', (f) => [LANE, f.d.L / 2 - 8]);
		const run = F.field.d.L - 34;
		const K = makeKit(ctx, GAME, { accent: '#ffd76a', pose: F.pose, dist: 1, span: [10, run, 4], flat: 3 });
		const { THREE } = ctx;
		let me, foe, lance, S = {};
		// his shield passes on your left: where it is off your line, and how high
		const SX = -2 * LANE + 0.42, SY = 2.6, HAND = [0.35, 2.3, -0.2];
		const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
		const bobs = (t, ph) => Math.sin(t * 11 + ph) * 0.06 + Math.sin(t * 5.5 + ph) * 0.03;

		function horse(color, cloth) {
			const g = K.group(), m = K.mat(color, { rough: 0.8 }), c = K.mat(cloth, { rough: 0.9, side: THREE.DoubleSide });
			K.box(0.55, 0.6, 1.9, m, 0, 1.35, 0, g);
			const neck = K.box(0.35, 0.8, 0.4, m, 0, 1.85, -0.95, g); neck.rotation.x = -0.5;
			K.box(0.3, 0.28, 0.6, m, 0, 2.15, -1.3, g);
			for (const [x, z] of [[-0.2, -0.75], [0.2, -0.75], [-0.2, 0.75], [0.2, 0.75]]) K.cyl(0.07, 0.06, 1.1, m, x, 0.55, z, g, 6);
			// the caparison: a cloth over it, to the knees
			K.mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.8, 12, 1, true).scale(1, 1, 1.9), c, 0, 1.15, 0, g);
			return g;
		}
		function knight(shirt, cloth, arms) {
			const g = K.group();
			const h = horse('#4a3a2c', cloth); g.add(h);
			// the knight: a real person in mail under a surcoat of his colours, a great helm,
			// astride, the lance couched
			const k = K.person({ parent: g, seed: shirt.length * 97 + (shirt === '#2848a0' ? 1 : 2), age: 30, style: () => ({ gen: 'medieval', top: { kind: 'tunic', col: '#8a8e94', pat: 'mail', fit: 'regular', sleeves: 'long', fab: 'metal' }, outer: { kind: 'surcoat', col: shirt, acc: '#f0c828', pat: 'hem', fit: 'oversized', sleeves: 'none', open: false, long: true, fab: 'wool' }, bottom: { kind: 'hose', col: '#6a6e74', pat: 'mail', legs: 'long', fit: 'regular', fab: 'metal' }, shoes: { kind: 'boot', col: '#3a2a1c', sole: '#2a1c12' }, acc: [{ kind: 'helmet', col: '#9a9ca0', visor: '#141418' }] }) });
			k.g.position.set(0, 1.65, 0.1);
			k.sit(0); k.act('joust', 0);
			const sh = K.box(0.08, 0.7, 0.55, K.mat('#ffffff', { map: arms, rough: 0.6 }), -0.42, 2.6, -0.1, g);
			return { g, horse: h, rider: k, shield: sh };
		}
		const heraldry = (a, b) => K.canvas(64, 64, (g) => { g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 0); g.lineTo(32, 64); g.closePath(); g.fill(); g.fillStyle = '#f0c828'; g.beginPath(); g.arc(32, 26, 9, 0, 7); g.fill(); });

		function build() {
			F.lay(K);
			me = knight('#2848a0', '#2848a0', heraldry('#2848a0', '#f0e8d8'));
			foe = knight('#c83030', '#c83030', heraldry('#c83030', '#1c1c1c'));
			foe.g.rotation.y = Math.PI;
			// your lance, couched: from the hand across the horse's neck toward the tilt
			lance = K.group(me.g);
			K.cyl(0.07, 0.03, LANCE, K.mat('#e8e0c8'), 0, LANCE / 2, 0, lance, 8);
			K.cyl(0.05, 0.2, 0.45, K.mat('#2848a0'), 0, 0.45, 0, lance, 10);
			lance.position.set(...HAND);
			// his, aimed at you
			const fl = K.group(foe.g);
			K.cyl(0.035, 0.07, LANCE, K.mat('#e8e0c8'), 0, LANCE / 2, 0, fl, 8);
			fl.rotation.x = -Math.PI / 2; fl.rotation.z = 0.35; fl.position.set(0.3, 2.3, -0.2);
		}
		function reset() { S = { pass: 0, me: 0, foe: 0, log: [] }; ready(); }
		function ready() {
			S.state = 'ride'; S.t = 0; S.z = 0; S.fz = -run; S.aim = { x: 0, y: 0 }; S.done = false;
			K.hud(`Pass ${S.pass + 1} of ${PASSES} · you ${S.me} · him ${S.foe}\nHold a finger on the screen: the lance point follows it`);
			K.noise(0.6, { vol: 0.12, f: 200, type: 'lowpass' });
		}
		function press(down, x, y) { if (down) aimAt(x, y); }
		function move(x, y) { if (K.ptr.down) aimAt(x, y); }
		// the point's aim: the finger's place on the screen, off its middle, in metres at the meeting
		function aimAt(x, y) { const r = K.size(); S.aim.x = clamp((x - r.left - r.width / 2) / r.width * 2.4, -1.2, 1.2); S.aim.y = clamp(-(y - r.top - r.height * 0.55) / r.height * 2, -0.9, 0.9); }
		function update(dt) {
			S.t += dt;
			if (S.state === 'ride') {
				S.z -= SPEED * dt; S.fz += SPEED * dt;
				const bm = bobs(K.time, 0), bf = bobs(K.time, 1.7);
				me.g.position.set(0, K.groundY(0, S.z) + bm, S.z);
				foe.g.position.set(-2 * LANE, K.groundY(-2 * LANE, S.fz) + bf, S.fz);
				for (const k of [me, foe]) for (const [i, leg] of k.horse.children.entries()) if (i >= 3 && i <= 6) leg.rotation.x = Math.sin(K.time * 11 + i * 1.3) * 0.5;
				// the lance's point, where you hold it, shaken by the gallop
				const tx = SX + 0.15 + S.aim.x, ty = SY - 0.1 + S.aim.y + bm * 4 + Math.sin(K.time * 3.1) * 0.08;
				dir.set(tx - HAND[0], ty - HAND[1], 0);
				dir.z = -Math.sqrt(Math.max(0.5, LANCE * LANCE - dir.x * dir.x - dir.y * dir.y));
				lance.quaternion.setFromUnitVectors(up, dir.normalize());
				// meeting: his shield comes level with your point
				if (!S.done && S.fz + 0.1 >= S.z + HAND[2] + dir.z * LANCE) strike(tx, ty, bf);
				if (S.z < -run) settle();
				K.cam(0.1, K.groundY(0, S.z) + 3 + bm, S.z + 0.35, -1.6, K.groundY(0, S.z) + 2.4, S.z - 12, 12);
			} else if (S.state === 'after') {
				if (S.t > 1.6) { if (S.pass >= PASSES) over(); else ready(); }
			}
		}
		function strike(tx, ty, bf) {
			S.done = true;
			const d = Math.hypot(tx - SX, (ty - SY - bf) * 0.8);
			let pts = d < 0.16 ? 3 : d < 0.3 ? 2 : d < 0.45 ? 1 : 0;
			if (pts === 3 && S.pass === PASSES - 1 && Math.random() < 0.5) { pts = 5; K.say('Unhorsed him!', 1400); foe.rider.g.rotation.x = -1.2; }
			else K.say(['A miss', 'A glancing blow', 'Struck his shield', 'Lance broken!'][pts], 1200);
			// and he at you: steadier each pass
			const his = Math.random() < 0.35 + S.pass * 0.15 ? (Math.random() < 0.4 ? 2 : 1) : 0;
			if (his) setTimeout(() => K.on && K.say(his > 1 ? 'He broke a lance on you' : 'He caught your shield', 1000), 700);
			S.me += pts; S.foe += his; S.log.push(`${pts}–${his}`);
			K.noise(0.25, { vol: pts ? 0.4 : 0.1, f: pts > 2 ? 1400 : 500, q: 0.6 });
			if (pts >= 3) K.tone(220, 0.3, { type: 'triangle', vol: 0.1 });
			K.hud(`Pass ${S.pass + 1} of ${PASSES} · you ${S.me} · him ${S.foe}`);
		}
		function settle() { S.pass++; S.state = 'after'; S.t = 0; foe.rider.g.rotation.x = 0; }
		function over() {
			S.state = 'over';
			K.finish(S.me, { unit: 'points', line: S.me > S.foe ? 'You carry the day' : S.me === S.foe ? 'An even tourney' : 'He carries the day', rows: [['Passes (you–him)', S.log.join(' · ')]] });
		}
		return K.wrap({ build, reset, update, press, move, end: F.unlay });
	},
};

// where a joust starts from: the far end of the lists, beside the tilt
function joustSpot(f) {
	const c = Math.cos(f.yaw), s = Math.sin(f.yaw), lx = LANE, lz = f.d.L / 2 - 8;
	return { x: f.x + c * lx + s * lz, z: f.z - s * lx + c * lz, yaw: f.yaw };
}