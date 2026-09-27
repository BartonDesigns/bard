// Skipping stones, on whatever water is in front of you: the bay, a lake, the sea off a
// beach. Five stones; your score is every skip added up.
//   put your finger down and watch the tilt needle rock: that is the angle of the stone.
//     Swipe up to throw it when the needle is in the sweet spot, near twenty degrees (the
//     angle the physicists found skips best). The faster the swipe, the faster the stone.
// Each time the stone meets the water it skips only if it is coming in flat enough (a
// shallow path) and fast enough; a skip takes speed off it, more so the further its tilt
// is from twenty degrees, and each hop is shorter than the last until it slows, plops and
// sinks. A stone that reaches the far shore clacks on the rocks.

import { makeKit, clamp } from './kit.js';

export const GAME = {
	id: 'stones',
	title: 'Skipping Stones',
	blurb: 'Five flat stones: time the tilt, flick it low and fast, count the skips.',
	where: { kind: 'water' },
	create(ctx) {
		const K = makeKit(ctx, GAME, { accent: '#7fd3e8', dist: 0.3, span: [1, 1], place: 'here' });
		const { THREE } = ctx;
		let stone, needle, rings = [], pond = null, S = {};

		// the water under a stage point: its height in stage coordinates, or null for land
		function waterY(x, z) {
			const W = ctx.getWorld?.(), p = K.world(new THREE.Vector3(x, 0, z));
			if (pond) return z < -3 ? pond : null;
			const lv = W?.lake?.waterAt?.(p.x, p.z);
			if (lv !== null && lv !== undefined) return lv - K.root.position.y;
			const gy = ctx.groundAt?.(p.x, p.z);
			return Number.isFinite(gy) && gy < -0.3 ? -K.root.position.y : null;
		}
		// turn the stage toward the nearest open water; with none (or no world), dig a pond
		function faceWater() {
			let best = null;
			for (let k = 0; k < 16 && !best; k++) {
				const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8;
				K.root.rotation.y = K.yaw + a; K.root.updateMatrixWorld(true);
				let n = 0;
				for (let d = 3; d <= 30; d += 3) if (waterY(0, -d) !== null) n++;
				if (n >= 6) best = a;
			}
			K.root.rotation.y = K.yaw + (best ?? 0); K.root.updateMatrixWorld(true);
			if (best === null) {
				pond = -0.4;
				K.mesh(new THREE.PlaneGeometry(60, 70), K.mat('#2b6a86', { rough: 0.15, metal: 0.3, opacity: 0.9 }), 0, pond, -38).rotation.x = -Math.PI / 2;
			}
		}
		function build() {
			pond = null;
			faceWater();
			stone = K.mesh(new THREE.SphereGeometry(0.035, 12, 6), K.mat('#8a8680', { rough: 0.9 }), 0, 1, 0);
			stone.scale.set(1, 0.35, 1.2);
			rings = [];
			for (let i = 0; i < 16; i++) { const r = K.mesh(new THREE.RingGeometry(0.2, 0.26, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 0, -99, 0); r.rotation.x = -Math.PI / 2; r.userData.k = 0; rings.push(r); }
			needle = K.el('position:absolute;left:50%;bottom:calc(90px + env(safe-area-inset-bottom));transform:translateX(-50%);width:200px;height:110px;pointer-events:none;display:none',
				'<svg viewBox="0 0 200 110" width="200" height="110"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="14"/><path d="M 100 100 m -80 0 A80 80 0 0 1 36 52" fill="none" stroke="#7fd3e8" stroke-width="14" opacity=".35"/><path d="M 44.6 60.2 A80 80 0 0 1 66 29" fill="none" stroke="#6bd66b" stroke-width="14"/><line data-n x1="100" y1="100" x2="20" y2="100" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg><div style="text-align:center;font:12px system-ui;color:#eafaf6;margin-top:-4px">tilt · green is the sweet spot</div>');
		}
		function reset() {
			S = { left: 5, total: 0, best: 0, log: [], state: 'ready', p: new THREE.Vector3(), v: new THREE.Vector3(), skips: 0, t: 0, tilt: 0, hold: 0 };
			ready();
		}
		function ready() {
			S.state = 'ready'; S.skips = 0;
			const gy = K.groundY(0, 0);
			S.p.set(0.35, Math.max(gy, waterY(0, -4) ?? gy) + 0.9, 0.1); S.v.set(0, 0, 0);
			K.hud(`Stone ${6 - S.left} of 5 · ${S.total} skips${K.best() !== null ? ` · best ${K.best()}` : ''}`);
		}
		function press(down) {
			if (S.state !== 'ready') return;
			if (down) { S.hold = 0; needle.style.display = 'block'; return; }
			needle.style.display = 'none';
			const sw = K.swipe();
			if (sw.vy > -200 || sw.dy > -30) return;
			const sp = clamp(-sw.vy / 120, 5, 24), dir = clamp(sw.dx / Math.max(60, -sw.dy), -0.5, 0.5) * 0.3;
			// thrown low: a few degrees of lift, down if the swipe is slow and lazy
			const up = clamp(0.1 - 30 / sp * 0.01, -0.05, 0.12);
			S.v.set(Math.sin(dir) * sp * Math.cos(up), Math.sin(up) * sp, -Math.cos(dir) * sp * Math.cos(up));
			S.state = 'fly'; S.t = 0; S.left--;
			K.noise(0.15, { vol: 0.08, f: 1200 });
		}
		function ripple(x, y, z, k) {
			const r = rings.find((q) => q.userData.k <= 0) || rings[0];
			r.position.set(x, y + 0.02, z); r.userData.k = 1; r.scale.setScalar(k);
		}
		function step(dt) {
			S.v.y -= 9.8 * dt;
			S.p.addScaledVector(S.v, dt);
			const wy = waterY(S.p.x, S.p.z);
			if (wy === null) {
				const gy = K.groundY(S.p.x, S.p.z);
				if (S.p.y < gy + 0.02 && S.t > 0.2) { S.state = 'land'; S.t = 0; K.noise(0.08, { vol: 0.25, f: 2600, q: 3 }); S.p.y = gy + 0.02; }
				return;
			}
			if (S.p.y > wy) return;
			// it meets the water: how steep is it coming in, and how fast?
			const vh = Math.hypot(S.v.x, S.v.z), steep = Math.atan2(-S.v.y, vh) * 180 / Math.PI, tiltOff = Math.abs(S.tilt - 20);
			ripple(S.p.x, wy, S.p.z, 0.6 + vh * 0.05);
			if (steep < 24 && vh > 2.6 && tiltOff < 32) {
				S.skips++;
				const keep = clamp(0.88 - tiltOff * 0.007, 0.5, 0.9);
				S.v.x *= keep; S.v.z *= keep;
				S.v.y = Math.abs(S.v.y) * 0.45 + vh * keep * 0.06;
				S.p.y = wy + 0.001;
				K.noise(0.06, { vol: 0.15, f: 2200 + S.skips * 80, q: 1.5 });
			} else {
				S.state = 'sink'; S.t = 0; S.p.y = wy;
				K.noise(0.3, { vol: 0.2, f: 500, type: 'lowpass' });
				ripple(S.p.x, wy, S.p.z, 1.3);
			}
		}
		function update(dt) {
			S.t += dt;
			if (S.state === 'ready') {
				// the tilt needle rocks from flat to steep and back while your finger is down
				if (K.ptr.down) { S.hold += dt; S.tilt = 22 + Math.sin(S.hold * 3.4 - Math.PI / 2) * 22 + 0.001; }
				const a = Math.PI - S.tilt / 90 * Math.PI / 2 * 1.9;
				const n = needle.querySelector('[data-n]');
				n?.setAttribute('x2', String(100 + Math.cos(a) * 80)); n?.setAttribute('y2', String(100 - Math.sin(a) * 80));
			} else if (S.state === 'fly') {
				for (let i = 0; i < 6 && S.state === 'fly'; i++) step(dt / 6);
				if (S.t > 12) S.state = 'sink';
			} else if (S.state === 'sink' || S.state === 'land') {
				if (S.state === 'sink') S.p.y -= dt * 0.4;
				if (S.t > 1.3) {
					S.total += S.skips; S.best = Math.max(S.best, S.skips); S.log.push(S.skips);
					K.say(S.skips === 0 ? 'Plop.' : `${S.skips} skip${S.skips > 1 ? 's' : ''}${S.state === 'land' ? ', right across!' : ''}`, 1400);
					if (S.left > 0) ready();
					else { S.state = 'over'; K.finish(S.total, { unit: 'skips', line: `Best stone: ${S.best} skips`, rows: [['Stones', S.log.join(' · ')]] }); }
				}
			}
			for (const r of rings) if (r.userData.k > 0) { r.userData.k -= dt * 0.7; r.scale.multiplyScalar(1 + dt * 1.5); r.material.opacity = Math.max(0, r.userData.k * 0.7); if (r.userData.k <= 0) r.position.y = -99; }
			stone.position.copy(S.p);
			stone.rotation.y += dt * (S.state === 'fly' ? 25 : 0);
			stone.rotation.x = -S.tilt * Math.PI / 180;
			const gy = K.groundY(0, 0);
			if (S.state === 'ready') K.cam(0.2, gy + 1.7, 1.6, 0, gy + 0.2, -14, 3);
			else K.cam(S.p.x * 0.5, gy + 2.2, S.p.z + 5, S.p.x, S.p.y, S.p.z - 3, 2.5);
		}
		return K.wrap({ build, reset, update, press });
	},
};
