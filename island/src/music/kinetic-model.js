// Partial FLT-095: sunflower bounce garden and kinematic pendulum wave.
// Authored constants from flight-179 _rgSpawn/_rgTick; bounded phone budget.
export const RIG_SCALES = [[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 5, 7, 9, 10], [0, 2, 4, 6, 8, 10]];
const bound = (n, lo, hi, fallback) => Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
export function createKineticModel(options = {}) {
	const settings = { gravity: 3.5, restitution: 0.88, bpm: 100, drop: 1.6 };
	const kind = options.kind === 'pendulum' ? 'pendulum' : 'garden';
	const count = Math.round(bound(options.count, 1, kind === 'garden' ? 256 : 15, kind === 'garden' ? 192 : 15));
	const bodies = Array.from({ length: count }, (_, i) => {
		const r = 7.2 * Math.sqrt((i + 0.5) / count), a = i * Math.PI * (3 - Math.sqrt(5));
		return { x: kind === 'garden' ? Math.cos(a) * r : (i / Math.max(1, count - 1) - 0.5) * Math.max(6, count * 0.63), z: kind === 'garden' ? Math.sin(a) * r : 0,
			y: 0.71, vy: 0, ring: kind === 'garden' ? Math.min(23, Math.floor(Math.sqrt((i + 0.5) / count) * 24)) : Math.round(i / Math.max(1, count - 1) * 23),
			length: 3.4 * (1 + i * 0.012) ** 2, angle: 0, side: 1, delay: 0, rest: true };
	});
	let running = false, time = 0;
	// BPM/drop set the next replay; gravity/restitution change active ball physics.
	function configure(v = {}) {
		settings.gravity = bound(v.gravity, 0.1, 20, settings.gravity);
		settings.restitution = bound(v.restitution, 0, 0.98, settings.restitution);
		settings.bpm = bound(v.bpm, 30, 240, settings.bpm);
		settings.drop = bound(v.drop, 0.1, 4, settings.drop);
	}
	configure(options);
	function silence() { running = false; for (const b of bodies) { b.rest = true; b.vy = 0; } }
	function replay() {
		time = 0; running = true;
		for (const b of bodies) { b.y = 0.71 + settings.drop * 3; b.vy = 0; b.delay = b.ring * 30 / settings.bpm; b.rest = false; b.side = 1; }
	}
	function update(dt, impact = () => {}) {
		if (!running || !Number.isFinite(dt) || dt <= 0) return;
		// Bound catch-up work after throttled/background frames. Never emit a backlog.
		let remaining = Math.min(0.1, dt);
		while (remaining > 1e-8) {
			const h = Math.min(1 / 120, remaining); remaining -= h; time += h;
			for (const b of bodies) {
				if (b.rest) continue;
				if (kind === 'pendulum') {
					b.angle = 0.62 * Math.cos(Math.sqrt(9.8 / b.length) * time);
					b.y = 5.05 - Math.cos(b.angle) * b.length; b.z = Math.sin(b.angle) * b.length;
					const side = b.angle >= 0 ? 1 : -1;
					if (side !== b.side) { b.side = side; impact(b, 1.6); }
				} else if (b.delay > 0) b.delay -= h;
				else {
					b.vy -= settings.gravity * 3.2 * h; b.y += b.vy * h;
					if (b.y <= 0.71 && b.vy < 0) {
						b.y = 0.71; b.vy = -b.vy * settings.restitution;
						if (b.vy < 0.5) { b.rest = true; b.vy = 0; } else impact(b, b.vy);
					}
				}
			}
		}
		if (bodies.every(b => b.rest)) running = false;
	}
	return { kind, bodies, settings, configure, replay, silence, update, get running() { return running; } };
}

// Timers release notes even if rendering stalls; silence/dispose releases only our IDs.
let rigSerial = 0;
export function createKineticVoices(host, { timers = globalThis, maxVoices = 8 } = {}) {
	const live = new Map(), prefix = `auto:crysis-rig:${++rigSerial}:`;
	let serial = 0, disposed = false;
	const cap = Math.round(bound(maxVoices, 1, 12, 8));
	function stop(id) {
		if (!live.has(id)) return;
		timers.clearTimeout(live.get(id)); live.delete(id);
		try { host.stopLead?.(id, true); } catch { /* host is departing */ }
	}
	function silence() { for (const id of [...live.keys()]) stop(id); }
	function note(ring, velocity, { distance = 0, scale = 'faceplate', root = 0 } = {}) {
		if (disposed || typeof host.playLead !== 'function' || typeof host.stopLead !== 'function') return false;
		while (live.size >= cap) stop(live.keys().next().value);
		const degree = Math.round(bound(ring, 0, 24, 0) / 24 * 13), v = Math.max(0.03, Math.min(0.85, (0.35 + velocity * 0.22) / (1 + Math.max(0, distance) / 18)));
		const table = RIG_SCALES[scale], semi = table ? table[degree % table.length] + 12 * Math.floor(degree / table.length) + Math.round(bound(root, -12, 12, 0)) : degree;
		const id = prefix + ++serial, auto = host._spAuto, floor = host._autoVelFloor;
		host._spAuto = true; host._autoVelFloor = 0.02;
		try { host.playLead(id, semi, 1, !!table, v); }
		catch { try { host.stopLead(id, true); } catch { /* partial voice */ } return false; }
		finally { host._spAuto = auto; host._autoVelFloor = floor; }
		live.set(id, timers.setTimeout(() => stop(id), 90 + v * 240)); return true;
	}
	return { note, silence, get count() { return live.size; }, dispose() { silence(); disposed = true; } };
}
