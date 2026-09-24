// The village boat, now yours to take out. Walk up to it and board; the left
// thumb (or W/S) is the throttle, sideways steers, the right thumb still looks
// around. It rides the same swell the swimmer does, leans into turns, leaves
// a foam wake, and will not run up onto the sand: shallows stop it. Leave it
// anywhere; it waits where you left it.

import * as THREE from 'three';
import { waveHeight } from './world/ocean.js';
import { glow } from './world/textures.js';

const DRAFT = 0.9;   // metres of water the hull needs

export function createBoat(island, village, player, camera, shared, scene) {
	const boat = village.boat;
	const s = {
		boarded: false, x: boat.position.x, z: boat.position.z, heading: boat.rotation.y,
		speed: 0, turn: 0, lean: 0, wakeT: 0,
	};
	// make sure the mooring floats: ease it seaward until there is water under the keel
	for (let i = 0; i < 60 && island.heightAt(s.x, s.z) > -DRAFT - 0.9; i++) { s.x += island.village.seaDir.x * 2; s.z += island.village.seaDir.z * 2; }
	// forward is the bow: local -z
	const fwd = () => [-Math.sin(s.heading), -Math.cos(s.heading)];

	// wake: soft foam puffs left at the stern, spreading and fading
	const W = 64, wakeTex = glow(), puffs = [];
	const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, color: 0xf4fbff, transparent: true, depthWrite: false, opacity: 0.8 });
	const wakeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
	const wake = new THREE.InstancedMesh(wakeGeo, wakeMat, W);
	wake.frustumCulled = false;
	wake.count = 0;
	wake.renderOrder = 2;
	wake.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(W * 3), 3);
	scene.add(wake);
	const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();

	function near() {
		const p = player.state.pos;
		return Math.hypot(p.x - s.x, p.z - s.z) < 7.5 && Math.abs(p.y - 1.6 - waveHeight(island, s.x, s.z, shared.uTime.value)) < 4;
	}
	function board() {
		if (s.boarded) return;
		s.boarded = true;
		player.state.locked = true;
		player.state.diving = false;
		player.state.yaw = s.heading;
		player.state.pitch = -0.08;
		player.clearInput();
	}
	function leave() {
		if (!s.boarded) return;
		s.boarded = false;
		s.speed = 0;
		player.state.locked = false;
		// step off onto the pier if it is alongside, otherwise over the side
		const [fx, fz] = fwd(), sx = -fz, sz = fx;
		const P = player.state.pos, pier = village.pier;
		let best = null;
		for (const side of [1, -1]) {
			const x = s.x + sx * side * 3.2, z = s.z + sz * side * 3.2;
			const floor = player.floorAt(x, z, 3);
			if (!best || floor > best.floor) best = { x, z, floor };
		}
		void pier;
		P.set(best.x, Math.max(best.floor, waveHeight(island, best.x, best.z, shared.uTime.value)) + 1.7, best.z);
		player.state.vel.set(0, 0, 0);
		player.clearInput();
	}

	function update(dt, t) {
		const wave = shared.uWave.value;
		if (s.boarded) {
			const { mx, mz } = player.input();
			const throttle = -mz;
			const target = throttle > 0 ? throttle * 11 : throttle * 3.5;
			s.speed += (target - s.speed) * Math.min(1, dt * (Math.abs(target) > Math.abs(s.speed) ? 0.55 : 0.9));
			s.turn += (-mx - s.turn) * Math.min(1, dt * 3);
			s.heading += s.turn * dt * (0.25 + Math.min(1, Math.abs(s.speed) / 5) * 0.55) * Math.sign(s.speed || 1);
		} else {
			s.speed *= Math.exp(-dt * 0.8);
			s.turn *= Math.exp(-dt * 2);
		}
		const [fx, fz] = fwd();
		const nx = s.x + fx * s.speed * dt, nz = s.z + fz * s.speed * dt;
		// the bow feels the bottom before the hull does
		const probe = island.heightAt(nx + fx * 4 * Math.sign(s.speed || 1), nz + fz * 4 * Math.sign(s.speed || 1));
		if (probe < -DRAFT) { s.x = nx; s.z = nz; }
		else s.speed *= -0.25;
		// ride the swell: height, pitch and roll from the water under bow, stern and beam
		const hc = waveHeight(island, s.x, s.z, t, wave);
		const hb = waveHeight(island, s.x + fx * 3, s.z + fz * 3, t, wave), hs = waveHeight(island, s.x - fx * 3, s.z - fz * 3, t, wave);
		const hl = waveHeight(island, s.x - fz * 1.5, s.z + fx * 1.5, t, wave), hr = waveHeight(island, s.x + fz * 1.5, s.z - fx * 1.5, t, wave);
		s.lean += ((s.boarded ? -s.turn * Math.min(1, Math.abs(s.speed) / 6) * 0.12 : 0) - s.lean) * Math.min(1, dt * 2);
		const pitch = Math.atan2(hb - hs, 6) + Math.min(0.08, Math.max(0, s.speed) * 0.007);
		boat.position.set(s.x, hc - 0.35, s.z);
		boat.rotation.set(0, 0, 0);
		boat.rotateY(s.heading);
		boat.rotateX(pitch);
		boat.rotateZ(Math.atan2(hr - hl, 3) * 0.8 + s.lean);

		// wake puffs at the stern
		s.wakeT -= dt;
		if (Math.abs(s.speed) > 1.2 && s.wakeT <= 0) {
			s.wakeT = 0.07;
			const i = puffs.length < W ? puffs.length : puffs.findIndex((p) => p.t > p.life) ;
			const p = { x: s.x - fx * 3.4 + (Math.random() - 0.5) * 0.6, z: s.z - fz * 3.4 + (Math.random() - 0.5) * 0.6, t: 0, life: 3 + Math.random(), size: 1.4 + Math.abs(s.speed) * 0.12 };
			if (i >= 0) puffs[i] = p;
		}
		let n = 0;
		for (const p of puffs) {
			p.t += dt;
			if (p.t > p.life) continue;
			const k = p.t / p.life;
			p3.set(p.x, waveHeight(island, p.x, p.z, t, wave) + 0.05, p.z);
			sc.set(p.size * (1 + k * 2.5), 1, p.size * (1 + k * 2.5));
			q.identity();
			m4.compose(p3, q, sc);
			wake.setMatrixAt(n, m4);
			col.setScalar((1 - k) * (1 - k));
			wake.setColorAt(n, col);
			n++;
		}
		wake.count = n;
		wake.instanceMatrix.needsUpdate = true;
		wake.instanceColor.needsUpdate = true;

		if (s.boarded) {
			// sit at the helm, behind the cabin, and look where you like
			const P = player.state;
			const eye = new THREE.Vector3(0.35, 4.05, 2.9).applyQuaternion(boat.quaternion).add(boat.position);
			camera.position.copy(eye);
			P.pos.copy(eye);
			camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
		}
	}
	return { state: s, update, board, leave, near, boarded: () => s.boarded };
}
