// Metres on the ground and in orbit. Only the rendered positions use kilometres.
// A return rotates the orbital frame above the atmosphere, preserving every view ray,
// then lays the retained ground patch under the arrival at its original coordinates.
import * as THREE from 'three';
import { flightMultiplier } from '../flight-speed.js';

export const ORBIT = Object.freeze({ start: 12000, end: 60000, entry: 95000, radius: 6371000 });
// A fixed, authored lunar ephemeris in the same inertial frame as the orbital globe.
// The real radius at about 150,000 km (the real Moon is 384,000 km out), so it
// reads at 1.3 degrees from Earth orbit instead of a half-degree dot.
export const MOON = Object.freeze({ x: -1.013e8, y: 0.701e8, z: -0.857e8, radius: 1737000 });
// The Sun sits one astronomical unit along the sky's sun direction at departure;
// Gargantua at a fixed authored bearing. Both are world positions, never view-locked.
export const SUN = Object.freeze({ distance: 1.496e11, radius: 6.96e8, safe: 6.96e8 * 8, heat: 6.96e8 * 40 });
export const GARGANTUA = Object.freeze({ x: -.54, y: .22, z: -.81, distance: 6e9, rs: 1.8e7, safe: 1.8e7 * 8 });
const GARG_DIR = new THREE.Vector3(GARGANTUA.x, GARGANTUA.y, GARGANTUA.z).normalize();
// What hangs beside each world: Earth's Moon, the Moon's Earth, a gas giant over its moon.
export function companionOf(type, earth) {
	if (earth) return { kind: 'moon', name: 'The Moon', radius: MOON.radius, land: 'MOON' };
	if (type === 'MOON') return { kind: 'earth', name: 'Earth', radius: ORBIT.radius, land: 'EARTH' };
	if (type === 'GAS' || type === 'GAS_GIANT' || type === 'BARREN') return { kind: 'giant', name: 'Gas giant', radius: 48000000, land: null };
	return { kind: 'moon', name: 'Moon', radius: MOON.radius, land: 'MOON' };
}
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function musicThrust(bass = 0, pulse = 0) {
	// Notes shape commanded thrust; silence has no thrust and never changes direction.
	return 1 + Math.max(0, Math.min(1, bass)) * .08 + Math.max(0, Math.min(1, pulse)) * .04;
}

export function createOrbitFrame({ earth = true, radius = ORBIT.radius, companion = companionOf('', earth) } = {}) {
	const center = new THREE.Vector3(), rotation = new THREE.Quaternion();
	let anchor = null, outward = false, entries = 0, lastAltitude = 0;
	const offset = new THREE.Vector3(), turn = new THREE.Quaternion(), euler = new THREE.Euler(0, 0, 0, 'YXZ');
	const moon = new THREE.Vector3(), moonNormal = new THREE.Vector3(), sunDir = new THREE.Vector3(.3, .8, -.4).normalize(), spot = new THREE.Vector3();
	function capture(P, location = {}) {
		anchor = { x: P.pos.x, z: P.pos.z, yaw: P.yaw, ...location };
		center.set(anchor.x, -radius, anchor.z);
		rotation.identity(); outward = false; lastAltitude = P.pos.y;
	}
	function altitude(pos) { return anchor ? pos.distanceTo(center) - radius : pos.y; }
	function blend(pos) { return smooth(ORBIT.start, ORBIT.end, altitude(pos)); }
	function moonCenter(out = moon) { return out.set(MOON.x, MOON.y, MOON.z).applyQuaternion(rotation).add(center); }
	function moonAltitude(pos) { return pos.distanceTo(moonCenter()) - companion.radius; }
	// World positions of the far bodies, in the same metres as the player.
	function sunCenter(out = new THREE.Vector3()) { return out.copy(sunDir).multiplyScalar(SUN.distance).applyQuaternion(rotation).add(center); }
	function gargCenter(out = new THREE.Vector3()) { return out.copy(GARG_DIR).multiplyScalar(GARGANTUA.distance).applyQuaternion(rotation).add(center); }
	// Only solid ground blocks flight. The Sun and Gargantua remain traversable; their
	// approach speed below resolves the corona and photon ring without adding a wall.
	// With a heading, only what lies along that course counts, so leaving a planet
	// is fast and only an approach slows.
	const oc = new THREE.Vector3();
	function clearance(pos, dir) {
		if (!anchor) return Infinity;
		const shells = [[center, radius], [moonCenter(), companion.radius]];
		let free = Infinity;
		for (const [c, r] of shells) {
			oc.copy(c).sub(pos);
			const d = oc.length();
			if (d <= r) return 0;
			if (!dir) { free = Math.min(free, d - r); continue; }
			const t = oc.dot(dir), miss = d * d - t * t;
			if (t > 0 && miss < r * r * 1.21) free = Math.min(free, t - Math.sqrt(Math.max(0, r * r - miss)));
		}
		return Math.max(0, free);
	}
	function stellarSpeed(pos, dir) {
		if (!anchor) return Infinity;
		let cap = Infinity;
		for (const [c, r, edge] of [[sunCenter(), SUN.radius, 2], [gargCenter(), GARGANTUA.rs, 1.12]]) {
			oc.copy(c).sub(pos); const d = oc.length();
			// Full speed when heading away outside the visible entry region.
			if (dir && oc.dot(dir) < 0 && d > r * edge) continue;
			cap = Math.min(cap, r * .04 + Math.max(0, d - r * edge) * .9);
		}
		return cap;
	}
	function up(pos, out) {
		if (anchor && moonAltitude(pos) < 220000 * companion.radius / MOON.radius) return out.copy(pos).sub(moonCenter()).normalize();
		return anchor ? out.copy(pos).sub(center).normalize() : out.copy(UP);
	}
	function speed(pos, run, boost, agl = pos.y, dir) {
		// A number is the eased booster gear; true and false are the old boolean boost.
		const mult = typeof boost === 'number' && boost > 0 ? boost : flightMultiplier(boost);
		const mh = anchor ? moonAltitude(pos) : Infinity;
		if (mh < 220000) {
			// Approach and surface speeds stay bounded so a descent cannot tunnel
			// through the lunar collider in a single frame.
			const local = 22 + Math.max(0, mh) * 0.012;
			return Math.min(42000, local * (run ? 2.375 : 1) * Math.min(9, mult));
		}
		const h = Math.max(0, anchor ? altitude(pos) : agl);
		// Smooth through the old ceiling, gentle through the atmosphere, fast far from it.
		const ground = 16 * (1 + Math.max(0, h - 40) / 120 + Math.max(0, h - 250) / 140);
		const base = (Math.min(1800, ground) + Math.max(0, h - ORBIT.end) * 0.085) * (run ? 2.375 : 1);
		const low = Math.min(3e7, base * Math.min(9, mult));
		// Up to ×9 the guard only bites on a close approach, so a descent onto the Moon cannot skip through it.
		if (mult <= 9) return Math.min(low, Math.max(1000, clearance(pos, dir) * 3), stellarSpeed(pos, dir));
		// The deep-space gears: at most three times the free space ahead each second, so
		// an approach slows exponentially instead of tunnelling through a planet or the Sun.
		return Math.min(stellarSpeed(pos, dir), Math.max(low, Math.min(base * mult, 3e7 * mult / 9, clearance(pos, dir) * 3)));
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
	function setSun(dir) { if (dir) sunDir.copy(dir).normalize(); }
	function surface(pos, vel) {
		if (!anchor) return false;
		moonCenter(moon); const d = pos.distanceTo(moon), min = companion.radius + 1.8;
		if (d >= min) return false;
		moonNormal.copy(pos).sub(moon).normalize(); pos.copy(moon).addScaledVector(moonNormal, min);
		const inward = vel.dot(moonNormal);
		if (inward < 0) vel.addScaledVector(moonNormal, -inward);
		return true;
	}
	return { center, rotation, companion, capture, altitude, blend, up, speed, update, reset, setSun, sunCenter, gargCenter, clearance, stellarSpeed, moonCenter, moonAltitude, surface,
		get anchor() { return anchor; },
		info: (pos) => ({ earth, altitude: altitude(pos), blend: blend(pos), anchor: anchor && { ...anchor }, entries, returning: outward, moon: { altitude: moonAltitude(pos), landed: moonAltitude(pos) < 8 }, sun: anchor ? pos.distanceTo(sunCenter(spot)) : Infinity, gargantua: anchor ? pos.distanceTo(gargCenter(spot)) : Infinity }),
	};
}
