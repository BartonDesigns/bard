// Crysis civilization engine, part three: towns grown as you come near them. Beyond the
// surveyed Bay Area the terrain seeds towns (bay.towns: centre, reach, street angle, style,
// name); from afar they are the ground shader's procedural grid. Come within a couple of
// kilometres of one and civgen.js grows it in full, a few milliseconds a frame, then hands
// it to the real city (realcity.js addRegion), after which it is drawn, furnished, driven
// and walked like the mapped towns. One town is kept at a time (the nearest); leave it and
// it is dropped, and grown again the same way if you come back (the last two are kept).
// Moving on to the next town, the one you leave stands until the next is grown, and the one
// you are well inside is kept even when a neighbour (a big city's next district) is nearer.

import { generateTownSteps, hashStr } from './civgen.js';
import { STYLE } from '../bay/styles.js';
import { industrialEdge } from './civedge.js';

const BUDGET = 6;           // ms of growing a frame
const HASTE = 12;           // ...coming down onto the place, or stood in it with nothing grown yet
const NEAR = 2500;          // start growing this far outside a town's reach
const LEAVE = 4500;         // and drop it this far outside
const KEEP = 0.85;          // the town standing is kept within this share of its reach of its middle

// brief(town): the town's city brief from the director (earth/director.js): its street names and
// shop signs; null while one is on its way (the town waits), undefined for none
export function createCivilization({ real, bay, water = () => null, brief = null }) {
	let active = null, job = null, pending = false;
	const cache = [];        // the last few towns grown, newest last
	const reach = (t) => t.r * 1.3 + 150;
	const key = (t) => Math.round(t.x) + ',' + Math.round(t.z);
	// (the same town, though the list round it was made again)
	const same = (a, b) => !!a && !!b && (a === b || key(a) === key(b));

	function start(t, B) {
		const hit = cache.find((c) => c.key === key(t));
		if (hit) return { town: t, done: hit.region };
		const W = water(), it = generateTownSteps({ seed: hashStr(t.name + key(t)), cx: t.x, cz: t.z, radius: t.r, ang: t.ang, heightAt: bay.heightAt, style: t.style === STYLE.older ? 'older' : 'suburb', name: t.name, water: W ? { near: (x, z) => W.near(x, z), lake: (x, z) => W.inLake(x, z) } : null, brief: B || null });
		return { town: t, it, t0: performance.now(), work: 0 };
	}
	function finish(J, region) {
		const cached = cache.some((c) => c.region === region);
		if (!cached) { cache.push({ key: key(J.town), region }); if (cache.length > 2) cache.shift(); }
		// its warehouses out past the last houses (civedge.js; once, so a cached town keeps its own)
		const W = water();
		industrialEdge(region, bay.heightAt, W ? (x, z) => W.near(x, z) : null);
		// (the town left behind stood until now)
		if (active) real.removeRegion(active.handle);
		active = { town: J.town, handle: real.addRegion(region), region };
		pending = false;
	}

	// arriving: on the way down onto this place (from orbit): grown however high you are, and faster
	function update(camera, { arriving = false } = {}) {
		const towns = bay.towns;
		if (!towns?.length || !real?.addRegion || !bay.loaded()) return;
		const x = camera.position.x, z = camera.position.z;
		// the town whose reach we are nearest
		let best = null, bd = 1e9;
		for (const t of towns) { const d = Math.hypot(t.x - x, t.z - z) - reach(t); if (d < bd) { bd = d; best = t; } }
		const high = !arriving && camera.position.y > 5000;
		let want = !high && bd < NEAR ? best : null;
		const ms = arriving || (!active && bd < 0) ? HASTE : BUDGET;
		const inA = active && !high ? Math.hypot(active.town.x - x, active.town.z - z) : Infinity;
		if (!want && active && inA - reach(active.town) < LEAVE) want = active.town;
		// (well inside the town standing, a neighbour a little nearer does not take its place)
		else if (want && active && inA < active.town.r * KEEP) want = active.town;
		if (same(want, active?.town)) want = active.town;
		else if (same(want, job?.town)) want = job.town;
		// (you stand in a town not yet grown: for the travel veil, which waits on it)
		pending = !!want && want !== active?.town && bd < 0;
		// (a town waits for its creeks and lakes to be known, so it is laid out the same every time)
		const W = water();
		if (want && want !== active?.town && want !== job?.town && W && !W.readyAt(want.x, want.z, reach(want))) { W.pump(want.x, want.z, reach(want), ms); return; }
		// (and for its brief, when the director is making one)
		let B;
		if (want && want !== active?.town && want !== job?.town && brief && (B = brief(want)) === null) return;
		if (want !== (job?.town || active?.town || null)) {
			// (the one standing goes now only when you have left it; else when the next is grown)
			if (active && active.town !== want && (!want || inA - reach(active.town) > LEAVE)) { real.removeRegion(active.handle); active = null; }
			job = want && want !== active?.town ? start(want, B) : null;
		}
		if (!job) return;
		if (job.done) { finish(job, job.done); job = null; return; }
		// a few milliseconds of growing
		const t0 = performance.now();
		while (performance.now() - t0 < ms) {
			const r = job.it.next();
			if (r.done) {
				job.work += performance.now() - t0;
				r.value.info.wall = Math.round(performance.now() - job.t0);
				r.value.info.work = Math.round(job.work);
				finish(job, r.value);
				job = null;
				return;
			}
		}
		job.work += performance.now() - t0;
	}
	// finish the town being grown now, in one go (for tests and teleports)
	function flush() {
		if (!job) return;
		if (job.done) { finish(job, job.done); job = null; return; }
		for (let r = job.it.next(); ; r = job.it.next()) if (r.done) { r.value.info.wall = Math.round(performance.now() - job.t0); finish(job, r.value); job = null; return; }
	}
	return { update, flush, active: () => active, busy: () => !!job, pending: () => pending, job: () => job && { town: job.town.name, work: Math.round(job.work || 0) } };
}
