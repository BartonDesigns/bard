// What has happened to the buildings, kept in this browser: each damaged building by its
// stable id (structures/ids.js) with its holes, how much of it came down, its broken panes,
// and where its rebuild stands; and the game's own clock in hours (the sky's hour of the day
// only goes round, this one goes on), so a rebuild begun before you left carries on from there.
// Small and compact (numbers rounded, short keys), written a few seconds after a change.

const KEY = 'l99.structures.v1';
const CAP = 320;

export function createStore() {
	let data = { t: 0, b: {} };
	try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d && typeof d === 'object' && d.b) data = { t: +d.t || 0, b: d.b }; } } catch { /* private mode, blocked storage: start clean */ }
	let dirty = false, wait = 0, lastH = null;
	// the clock: the sky's hours, unwrapped (a skip of more than six hours is a jump, not time passing)
	function tick(hours, dt) {
		if (Number.isFinite(hours)) {
			if (lastH !== null) { let d = hours - lastH; if (d < -12) d += 24; if (d > 0 && d < 6) data.t += d; }
			lastH = hours;
		}
		if (dirty && (wait -= dt) <= 0) save();
	}
	function save() {
		dirty = false;
		const ids = Object.keys(data.b);
		// (too many: the oldest finished first, then the oldest)
		if (ids.length > CAP) ids.sort((p, q) => (data.b[p].t0 || 0) - (data.b[q].t0 || 0)).slice(0, ids.length - CAP).forEach((k) => delete data.b[k]);
		try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* full or blocked: kept for this visit */ }
	}
	const touch = () => { dirty = true; wait = 3; };
	return {
		now: () => data.t,
		advance: (h) => { data.t += h; touch(); },
		tick,
		get: (id) => data.b[id] || null,
		put: (id, rec) => { data.b[id] = rec; touch(); return rec; },
		drop: (id) => { if (data.b[id]) { delete data.b[id]; touch(); } },
		each: (f) => { for (const k in data.b) f(k, data.b[k]); },
		records: (f) => { for (const k in data.b) f(data.b[k]); },
		size: () => Object.keys(data.b).length,
		touch,
		save,
		clear: () => { data.b = {}; touch(); },
	};
}
