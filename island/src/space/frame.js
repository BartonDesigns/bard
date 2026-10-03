// Metres on the ground and in orbit. Only the rendered positions use kilometres.
// A return rotates the orbital frame above the atmosphere, preserving every view ray,
// then lays the retained ground patch under the arrival at its original coordinates.
import * as THREE from 'three';
import { flightMultiplier } from '../flight-speed.js';

export const ORBIT = Object.freeze({ start: 12000, end: 60000, entry: 95000, radius: 6371000 });
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function musicThrust(bass = 0, pulse = 0) {
	// Notes shape commanded thrust; silence has no thrust and never changes direction.
	return 1 + Math.max(0, Math.min(1, bass)) * .08 + Math.max(0, Math.min(1, pulse)) * .04;
}

export function createOrbitFrame({ earth = true, radius = ORBIT.radius } = {}) {
	const center = new THREE.Vector3(), rotation = new THREE.Quaternion();
	let anchor = null, outward = false, entries = 0, lastAltitude = 0;
	const offset = new THREE.Vector3(), turn = new THREE.Quaternion(), euler = new THREE.Euler(0, 0, 0, 'YXZ');
	function capture(P, location = {}) {
		anchor = { x: P.pos.x, z: P.pos.z, yaw: P.yaw, ...location };
		center.set(anchor.x, -radius, anchor.z);
		rotation.identity(); outward = false; lastAltitude = P.pos.y;
	}
	function altitude(pos) { return anchor ? pos.distanceTo(center) - radius : pos.y; }
	function blend(pos) { return smooth(ORBIT.start, ORBIT.end, altitude(pos)); }
	function up(pos, out) { return anchor ? out.copy(pos).sub(center).normalize() : out.copy(UP); }
	function speed(pos, run, boost, agl = pos.y) {
		const h = Math.max(0, anchor ? altitude(pos) : agl);
		// Smooth through the old ceiling, gentle through the atmosphere, fast far from it.
		const ground = 16 * (1 + Math.max(0, h - 40) / 120 + Math.max(0, h - 250) / 140);
		const base = Math.min(1800, ground) + Math.max(0, h - ORBIT.end) * 0.085;
		return Math.min(3e7, base * (run ? 2.375 : 1) * flightMultiplier(boost));
	}
	function update(P) {
		if (!anchor) return false;
		const h = altitude(P.pos);
		if (h > ORBIT.entry + 5000) outward = true;
		let rebased = false;
		if (outward && h < ORBIT.entry && h < lastAltitude) {
			up(P.pos, offset);
			turn.setFromUnitVectors(offset, UP);
			rotation.premultiply(turn);
			P.pos.set(anchor.x, h, anchor.z);
			P.vel.applyQuaternion(turn);
			const q = new THREE.Quaternion().setFromEuler(euler.set(P.pitch, P.yaw, P.roll || 0));
			q.premultiply(turn); euler.setFromQuaternion(q, 'YXZ');
			P.pitch = euler.x; P.yaw = euler.y; P.roll = euler.z;
			outward = false; entries++; rebased = true;
		}
		lastAltitude = h;
		return rebased;
	}
	function reset() { anchor = null; rotation.identity(); outward = false; }
	return { center, rotation, capture, altitude, blend, up, speed, update, reset,
		get anchor() { return anchor; },
		info: (pos) => ({ earth, altitude: altitude(pos), blend: blend(pos), anchor: anchor && { ...anchor }, entries, returning: outward }),
	};
}
