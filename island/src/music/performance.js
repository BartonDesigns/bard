// A world-facing snapshot: real held synth voices and audible spectral attacks.
// Sampled decks/microphones have bands, never invented note-on/off events.
const unit = (v) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
export function createPerformance() {
	const state = { bass: 0, mid: 0, high: 0, held: 0, bpm: 120, beat: 0, kick: 0, sequence: 0, notes: [], on: [], off: [] };
	let previous = new Map(), floor = 0, cooldown = 0;
	function update(dt, bands = {}, snapshot = {}) {
		dt = Math.max(0, Math.min(.2, dt || 0));
		for (const key of ['bass', 'mid', 'high']) state[key] = unit(bands[key]);
		state.musicMode = snapshot.musicMode === true;
		state.bpm = Number.isFinite(snapshot.bpm) ? Math.max(30, Math.min(300, snapshot.bpm)) : state.bpm;
		state.beat = (state.beat + dt * state.bpm / 60) % 4096;
		const audible = Math.max(state.bass, state.mid, state.high) > .015;
		const next = new Map();
		for (const n of (snapshot.notes || []).slice(0, 64)) if (n && typeof n.id === 'string' && Number.isFinite(n.frequency) && n.frequency > 0) next.set(n.id, n);
		state.on = [...next.values()].filter((n) => !previous.has(n.id) || previous.get(n.id).started !== n.started);
		state.off = [...previous.values()].filter((n) => !next.has(n.id) || next.get(n.id).started !== n.started);
		state.notes = [...next.values()]; previous = next;
		state.held = audible ? state.notes.reduce((v, n) => Math.max(v, n.frequency >= 130 ? unit(n.velocity) : 0), 0) : 0;
		cooldown = Math.max(0, cooldown - dt);
		state.kick = 0;
		if (audible && cooldown === 0 && state.bass > .16 && state.bass - floor > .11) {
			state.kick = unit((state.bass - floor) * 2); state.sequence++; cooldown = .16;
		}
		floor += (state.bass - floor) * (1 - Math.exp(-dt * 8));
		return state;
	}
	return { state, update };
}

// Vertical rigid translation, with bounded spring lift and ballistic release/bounce.
// No horizontal drift: the procedural placement and saved world remain unchanged.
export function stepResonance(body, dt, held, impulse = 0) {
	body.y ||= 0; body.v ||= 0;
	body.v += Math.max(0, Math.min(1, impulse)) * 2.4;
	let left = Math.max(0, Math.min(.2, dt));
	while (left > 1e-8) {
		const h = Math.min(left, 1 / 120); left -= h;
		const lift = unit(held);
		body.v += (lift > 0 ? ((2 + lift * 3) - body.y) * 18 - body.v * 8 : -9.81) * h;
		body.y += body.v * h;
		if (body.y < 0) { body.y = 0; body.v = body.v < -.6 ? -body.v * .32 : 0; }
		if (body.y > 6) { body.y = 6; body.v = Math.min(0, body.v); }
	}
	return body;
}
