// Native models of flight-179's _rgSpawn* / _rgTick instruments. These preserve
// the authored kinematic sculptures (including the staircase's return to its top),
// rather than pretending that they are general rigid-body collision simulations.
export const RIG_LIMITS = Object.freeze({
	garden: { minCount: 1, defaultCount: 192, maxCount: 256 },
	pendulum: { minCount: 1, defaultCount: 15, maxCount: 15 },
	dominoes: { minCount: 1, defaultCount: 60, maxCount: 80 },
	chimes: { minCount: 1, defaultCount: 7, maxCount: 12 },
	cradle: { minCount: 5, defaultCount: 5, maxCount: 5 },
	droplets: { minCount: 1, defaultCount: 10, maxCount: 24 },
	harp: { minCount: 1, defaultCount: 3, maxCount: 6 },
	stairs: { minCount: 2, defaultCount: 16, maxCount: 16 },
	fountain: { minCount: 2, defaultCount: 8, maxCount: 16 },
	wavebars: { minCount: 1, defaultCount: 20, maxCount: 32 }
});
export const RIG_KINDS = Object.freeze(Object.keys(RIG_LIMITS));
const TAU = Math.PI * 2;
const degree = (i, count) => Math.round(i / Math.max(1, count - 1) * 23);
const body = (values = {}) => ({ x: 0, y: 0, z: 0, ring: 0, rest: true, visible: true, angle: 0, ...values });

export function createAuthoredRig(kind, count, settings, seed = 1) {
	let randomState = (Number.isFinite(seed) ? Math.floor(seed * 0x100000) : 1) >>> 0;
	const initialRandomState = randomState;
	function random() {
		randomState = (randomState + 0x6D2B79F5) >>> 0;
		let n = randomState;
		n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61);
		return ((n ^ n >>> 14) >>> 0) / 4294967296;
	}
	let bodies = [], steps = [], pads = [], ripples = [];
	let time = 0, running = false, interval = 0, next = 0, stepIndex = 0, segmentTime = 0, lastSide = 0;
	let segmentY = 0, segmentVelocity = 0, stairReset = false;
	if (kind === 'dominoes') {
		bodies = Array.from({ length: count }, (_, i) => {
			const a = i * 0.31, r = 1.4 + i * 0.115;
			return body({ x: Math.cos(a) * r, y: 0.5, z: Math.sin(a) * r, yaw: a + Math.PI / 2, ring: degree(i, count), state: 0 });
		});
	} else if (kind === 'chimes') {
		bodies = Array.from({ length: count }, (_, i) => {
			const a = i / count * TAU, length = 1.5 - i / count * 0.9, x = Math.cos(a) * 1.15, z = Math.sin(a) * 1.15;
			return body({ x, y: 3.35 - length / 2, z, anchorX: x, anchorY: 3.35, anchorZ: z, length,
				ring: Math.round(i / 6 * 23), phase: random() * 6.28, speed: 0.35 + random() * 0.3, last: 0, gust: 0 });
		});
	} else if (kind === 'cradle') {
		bodies = Array.from({ length: 5 }, (_, i) => body({ x: (i - 2) * 0.43, y: 0.65, anchorX: (i - 2) * 0.43, anchorY: 2.55, anchorZ: 0, length: 1.9 }));
	} else if (kind === 'droplets') {
		bodies = Array.from({ length: count }, () => body({ y: 0.36, visible: false, age: 0 }));
		ripples = Array.from({ length: 6 }, () => ({ x: 0, y: 0.38, z: 0, age: 2, visible: false, size: 0.2, opacity: 0 }));
	} else if (kind === 'harp') {
		bodies = Array.from({ length: count }, (_, i) => {
			const semiMajor = 1.5 + i * 0.75, eccentricity = 0.45 + i % 4 * 0.12, phase = i * 2.1;
			const radius = semiMajor * (1 - eccentricity * Math.cos(phase));
			return body({ x: Math.cos(phase) * radius, y: 2.6 + Math.sin(phase * 0.5) * 0.4, z: Math.sin(phase) * radius,
				semiMajor, eccentricity, period: 3 + i * 2.1, phase, lastRadius: radius, falling: false, ring: 4 + i * 7 });
		});
	} else if (kind === 'stairs') {
		steps = Array.from({ length: count }, (_, i) => {
			// Authored platforms; place the .17-radius ball on their actual top.
			const a = i * 0.55, surfaceY = 3.49 - i * 0.21;
			return { x: Math.cos(a) * 1.7, y: surfaceY + 0.17, z: Math.sin(a) * 1.7, yaw: -a + Math.PI / 2, surfaceY };
		});
		bodies = [body({ ...steps[0], vy: 0 })];
	} else if (kind === 'fountain') {
		pads = Array.from({ length: count }, (_, i) => {
			const a = i / count * TAU;
			return { x: Math.cos(a) * (2.4 + count * 0.1), y: 0.29, z: Math.sin(a) * (2.4 + count * 0.1), surfaceY: 0.18 };
		});
		bodies = Array.from({ length: 6 }, () => body({ y: 0.95, visible: false, age: 0, pad: 0 }));
	} else if (kind === 'wavebars') {
		bodies = Array.from({ length: count }, (_, i) => {
			const phase = Math.sin(-i * 0.55), height = 0.7 + (phase * 0.5 + 0.5) * 1.6;
			return body({ x: (i - count / 2) * 0.42, y: height / 2, height, ring: degree(i, count), last: phase });
		});
	}
	function replay() {
		// The authored chime trigger is a gust, retaining its ambient sway phase.
		if (kind !== 'chimes') { time = 0; randomState = initialRandomState; }
		running = true; interval = 15 / settings.bpm; next = kind === 'droplets' ? 0.4 : 0;
		stepIndex = 0; segmentTime = 0; lastSide = 0; stairReset = false;
		for (let i = 0; i < bodies.length; i++) {
			const b = bodies[i]; b.rest = false;
			if (kind === 'dominoes') { b.state = 0; b.angle = 0; b.y = 0.5; }
			else if (kind === 'chimes') b.gust = 0.9 + i * 0.12;
			else if (kind === 'cradle') { b.x = b.anchorX; b.y = 0.65; b.z = 0; b.angle = 0; }
			else if (kind === 'droplets' || kind === 'fountain') { b.visible = false; b.age = 0; }
			else if (kind === 'harp') {
				const r = b.semiMajor * (1 - b.eccentricity * Math.cos(b.phase));
				b.x = Math.cos(b.phase) * r; b.y = 2.6 + Math.sin(b.phase * 0.5) * 0.4; b.z = Math.sin(b.phase) * r;
				b.lastRadius = r; b.falling = false;
			} else if (kind === 'stairs') { b.x = steps[0].x; b.y = segmentY = steps[0].y; b.z = steps[0].z; b.vy = segmentVelocity = 0; }
			else if (kind === 'wavebars') {
				b.last = Math.sin(-i * 0.55); b.height = 0.7 + (b.last * 0.5 + 0.5) * 1.6; b.y = b.height / 2;
			}
		}
		for (const r of ripples) { r.age = 2; r.visible = false; r.opacity = 0; }
	}
	function silence() { running = false; for (const b of bodies) b.rest = true; }
	function tick(h, impact) {
		time += h;
		if (kind === 'dominoes') {
			for (let i = 0; i < bodies.length; i++) {
				const b = bodies[i];
				if (b.state === 0 && time >= i * interval) { b.state = 1; impact(b, 2); }
				if (b.state === 1) {
					b.angle = Math.min(Math.PI * 0.45, b.angle + h * 6.5); b.y = 0.5 * Math.cos(b.angle) + 0.07 * Math.sin(b.angle);
					if (b.angle >= Math.PI * 0.45) { b.state = 2; b.rest = true; }
				}
			}
			if (bodies.every(b => b.rest)) running = false;
		} else if (kind === 'chimes') {
			for (const b of bodies) {
				if (b.gust > 0) { const before = b.gust; b.gust -= h; if (b.gust <= 0.85 && before > 0.85) impact(b, 2.2); }
				const sway = Math.sin(time * b.speed + b.phase) * 0.10 + Math.sin(time * b.speed * 2.7 + b.phase * 2) * 0.05 + (b.gust > 0 ? Math.sin(time * 6) * 0.14 : 0);
				b.angle = sway; b.x = b.anchorX + Math.sin(sway) * b.length * 0.5; b.y = b.anchorY - Math.cos(sway) * b.length * 0.5;
				if (sway > 0.128 && b.last <= 0.128) impact(b, 0.9);
				b.last = sway;
			}
		} else if (kind === 'cradle') {
			const phase = Math.sin(Math.sqrt(9.8 / 1.9) * time), angle = phase * 0.5;
			for (let i = 0; i < bodies.length; i++) {
				const b = bodies[i]; b.angle = angle > 0 && i === bodies.length - 1 || angle < 0 && i === 0 ? angle : 0;
				b.x = b.anchorX + Math.sin(b.angle) * b.length; b.y = b.anchorY - Math.cos(b.angle) * b.length;
			}
			const side = phase >= 0 ? 1 : -1;
			if (side !== lastSide && lastSide !== 0) { const b = bodies[2]; b.ring = side > 0 ? 7 : 12; impact(b, 2.4); }
			lastSide = side;
		} else if (kind === 'droplets') {
			next -= h;
			if (next <= 0) {
				next = (0.25 + random() * 0.9) / settings.rain;
				const b = bodies.find(b => !b.visible);
				if (b) { const a = random() * TAU, r = random() * 1.8; b.visible = true; b.age = 0; b.x = Math.cos(a) * r; b.z = Math.sin(a) * r; b.y = 4.2; }
			}
			for (const b of bodies) {
				if (!b.visible) continue;
				b.age += h; b.y = Math.max(0.36, b.y - 6.5 * b.age * h * 9);
				if (b.y <= 0.36) {
					b.visible = false; b.ring = Math.floor(random() * 24); impact(b, 0.8 + random() * 0.8);
					const r = ripples.find(r => r.age > 1);
					if (r) { r.age = 0; r.x = b.x; r.z = b.z; r.visible = true; }
				}
			}
			for (const r of ripples) {
				if (r.age > 1) continue;
				r.age += h * 1.4; r.size = 0.2 + r.age * 1.6; r.opacity = Math.max(0, 0.5 * (1 - r.age)); r.visible = r.age <= 1;
			}
		} else if (kind === 'harp') {
			for (const b of bodies) {
				const angle = TAU / b.period * time + b.phase, r = b.semiMajor * (1 - b.eccentricity * Math.cos(angle));
				b.x = Math.cos(angle) * r; b.y = 2.6 + Math.sin(angle * 0.5) * 0.4; b.z = Math.sin(angle) * r;
				if (r < b.lastRadius && !b.falling) b.falling = true;
				if (r > b.lastRadius && b.falling) { b.falling = false; impact(b, 2); }
				b.lastRadius = r;
			}
		} else if (kind === 'stairs') {
			const b = bodies[0], step = steps[stepIndex], nextIndex = stairReset ? 0 : (stepIndex + 1) % steps.length, nextStep = steps[nextIndex];
			// Keep the authored gravity/bounce, but synchronize horizontal arrival
			// with the ballistic contact instead of ringing halfway between steps.
			const duration = (segmentVelocity + Math.sqrt(segmentVelocity ** 2 + 19 * Math.max(0, segmentY - nextStep.y))) / 9.5;
			segmentTime += h;
			const t = Math.min(segmentTime, duration), blend = duration > 0 ? t / duration : 1;
			b.vy = segmentVelocity - 9.5 * t; b.y = segmentY + segmentVelocity * t - 4.75 * t * t;
			b.x = step.x + (nextStep.x - step.x) * blend; b.z = step.z + (nextStep.z - step.z) * blend;
			if (segmentTime >= duration) {
				b.x = nextStep.x; b.z = nextStep.z; b.y = nextStep.y; b.vy = 1.7; segmentTime = 0; stepIndex = nextIndex; stairReset = false;
				b.ring = 23 - Math.round(stepIndex / steps.length * 23); impact(b, 1.8);
				// The authored endless stair returns to its top. Drop onto that top
				// before its next note, rather than sonifying a mid-air teleport.
				if (stepIndex === steps.length - 1) {
					stepIndex = 0; stairReset = true; b.x = steps[0].x; b.y = steps[0].y + 0.3; b.z = steps[0].z; b.vy = 0;
				}
				segmentY = b.y; segmentVelocity = b.vy;
			}
		} else if (kind === 'fountain') {
			next -= h;
			if (next <= 0) {
				next = 0.5;
				const b = bodies.find(b => !b.visible);
				if (b) { b.visible = true; b.age = 0; b.pad = stepIndex; stepIndex = (stepIndex + 1) % pads.length; }
			}
			for (const b of bodies) {
				if (!b.visible) continue;
				b.age += h; const blend = Math.min(1, b.age / 1.15), p = pads[b.pad];
				b.x = p.x * blend; b.z = p.z * blend; b.y = 0.95 + (p.y - 0.95) * blend + Math.sin(blend * Math.PI) * 2.4;
				if (blend >= 1) { b.visible = false; b.ring = Math.round(b.pad / 7 * 23); impact(b, 2); }
			}
		} else if (kind === 'wavebars') {
			for (let i = 0; i < bodies.length; i++) {
				const b = bodies[i], phase = Math.sin(time * 1.6 - i * 0.55);
				b.height = 0.7 + (phase * 0.5 + 0.5) * 1.6; b.y = b.height / 2;
				if (phase > 0.985 && b.last <= 0.985) impact(b, 1.1);
				b.last = phase;
			}
		}
	}
	function update(dt, impact = () => {}) {
		if (!running || !Number.isFinite(dt) || dt <= 0) return;
		let remaining = Math.min(0.1, dt);
		while (remaining > 1e-8 && running) { const h = Math.min(1 / 120, remaining); remaining -= h; tick(h, impact); }
	}
	return { bodies, steps, pads, ripples, replay, trigger: replay, silence, update, get running() { return running; } };
}
