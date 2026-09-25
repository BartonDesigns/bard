// Crysis civilization engine, part three: towns grown as you come near them. Beyond the
// surveyed Bay Area the terrain seeds towns (bay.towns: centre, reach, street angle, style,
// name); from afar they are the ground shader's procedural grid. Come within a couple of
// kilometres of one and civgen.js grows it in full, a few milliseconds a frame, then hands
// it to the real city (realcity.js addRegion), after which it is drawn, furnished, driven
// and walked like the mapped towns. One town is kept at a time (the nearest); leave it and
// it is dropped, and grown again the same way if you come back (the last two are kept).

import { generateTownSteps, hashStr } from './civgen.js';
import { STYLE } from '../bay/styles.js';

const BUDGET = 6;           // ms of growing a frame
const NEAR = 2500;          // start growing this far outside a town's reach
const LEAVE = 4500;         // and drop it this far outside

export function createCivilization({ real, bay }) {
	let active = null, job = null;
	const cache = [];        // the last few towns grown, newest last
	const reach = (t) => t.r * 1.3 + 150;
	const key = (t) => Math.round(t.x) + ',' + Math.round(t.z);

	function start(t) {
		const hit = cache.find((c) => c.key === key(t));
		if (hit) return { town: t, done: hit.region };
		const it = generateTownSteps({ seed: hashStr(t.name + key(t)), cx: t.x, cz: t.z, radius: t.r, ang: t.ang, heightAt: bay.heightAt, style: t.style === STYLE.older ? 'older' : 'suburb', name: t.name });
		return { town: t, it, t0: performance.now(), work: 0 };
	}
	function finish(J, region) {
		if (!cache.find((c) => c.region === region)) { cache.push({ key: key(J.town), region }); if (cache.length > 2) cache.shift(); }
		active = { town: J.town, handle: real.addRegion(region), region };
	}

	function update(camera) {
		const towns = bay.towns;
		if (!towns?.length || !real?.addRegion || !bay.loaded()) return;
		const x = camera.position.x, z = camera.position.z;
		// the town whose reach we are nearest
		let best = null, bd = 1e9;
		for (const t of towns) { const d = Math.hypot(t.x - x, t.z - z) - reach(t); if (d < bd) { bd = d; best = t; } }
		const high = camera.position.y > 5000;
		let want = !high && bd < NEAR ? best : null;
		if (!want && active && !high && Math.hypot(active.town.x - x, active.town.z - z) - reach(active.town) < LEAVE) want = active.town;
		if (want !== (job?.town || active?.town || null)) {
			if (active && active.town !== want) { real.removeRegion(active.handle); active = null; }
			job = want && want !== active?.town ? start(want) : null;
		}
		if (!job) return;
		if (job.done) { finish(job, job.done); job = null; return; }
		// a few milliseconds of growing
		const t0 = performance.now();
		while (performance.now() - t0 < BUDGET) {
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
	return { update, flush, active: () => active, busy: () => !!job, job: () => job && { town: job.town.name, work: Math.round(job.work || 0) } };
}
