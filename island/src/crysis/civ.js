// Crysis civilization engine, part three: towns grown as you come near them. Beyond the
// surveyed Bay Area the terrain seeds towns (bay.towns: centre, reach, street angle, style,
// name); from afar they are the ground shader's procedural grid. Come within a couple of
// kilometres of one and civgen.js grows it in full, a few milliseconds a frame, then hands
// it to the real city (realcity.js addRegion), after which it is drawn, furnished, driven
// and walked like the mapped towns. One town is kept at a time (the nearest); leave it and
// it is dropped, and grown again the same way if you come back (the last two are kept).
// Moving on to the next town, the one you leave stands until the next is grown, and the one
// you are well inside is kept even when a neighbour (a big city's next district) is nearer.

import { generateTownSteps, arterialSpacing, hashStr, LU } from './civgen.js';
import { STYLE } from '../bay/styles.js';
import { industrialEdge } from './civedge.js';

const BUDGET = 6;           // ms of growing a frame
const HASTE = 12;           // ...coming down onto the place, or stood in it with nothing grown yet
const NEAR = 2500;          // start growing this far outside a town's reach
const LEAVE = 4500;         // and drop it this far outside
const KEEP = 0.85;          // the town standing is kept within this share of its reach of its middle

// brief(town): the town's city brief from the director (earth/director.js): its street names and
// shop signs; null while one is on its way (the town waits), undefined for none. keep(x, z, r): the
// ground kept for landmarks round a town ([{ x, z, r }]); palms(town): its street trees are palms.
// A town with a spine ({ x, name, z0, z1, hw }, its grid square to north) has a real boulevard down
// it, a Strip of resorts hw either side of it from z0 to z1
export function createCivilization({ real, bay, water = () => null, brief = null, keep = () => [], palms = () => false }) {
	let active = null, job = null, pending = false;
	const cache = [];        // the last few towns grown, newest last
	const reach = (t) => t.r * 1.3 + 150;
	const key = (t) => Math.round(t.x) + ',' + Math.round(t.z);
	// (the same town, though the list round it was made again)
	const same = (a, b) => !!a && !!b && (a === b || key(a) === key(b));

	function start(t, B) {
		const hit = cache.find((c) => c.key === key(t));
		if (hit) return { town: t, done: hit.region };
		// (the ground a landmark stands on is kept as the water is: no street through it, no house on it)
		const W = water(), K = keep(t.x, t.z, reach(t));
		const near = (x, z) => { let d = W ? W.near(x, z) : Infinity; for (const k of K) d = Math.min(d, Math.max(0, Math.hypot(x - k.x, z - k.z) - k.r)); return d; };
		const kept = (x, z, m = 0) => K.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + m);
		const lake = (x, z) => !!W?.inLake(x, z) || kept(x, z);
		// (a town on a real boulevard, t.spine { x, name }: its grid moved, by up to half its arterial
		// spacing, to put one of its north-south arterials on it)
		const style = t.style === STYLE.older ? 'older' : 'suburb', SP = arterialSpacing(t.r, style);
		const k = t.spine ? Math.round((t.spine.x - t.x) / SP) : 0, cx = t.spine ? t.spine.x - k * SP : t.x;
		const it = generateTownSteps({ seed: hashStr(t.name + key(t)), cx, cz: t.z, radius: t.r, ang: t.ang, heightAt: bay.heightAt, style, name: t.name, water: W || K.length ? { near, lake, kept } : null, brief: B || null, spine: t.spine ? { k, name: t.spine.name, v0: t.spine.z0 - t.z, v1: t.spine.z1 - t.z, hw: t.spine.hw } : null, look: t.look || null, citySites: t.sites || [] });
		return { town: t, it, t0: performance.now(), work: 0, near: W || K.length ? near : null, keep: K };
	}
	function finish(J, region) {
		const cached = cache.some((c) => c.region === region);
		if (!cached) { cache.push({ key: key(J.town), region }); if (cache.length > 2) cache.shift(); }
		// its warehouses out past the last houses (civedge.js; once, so a cached town keeps its own)
		const W = water();
		industrialEdge(region, bay.heightAt, J.near || (W ? (x, z) => W.near(x, z) : null));
		// (a warm desert town's street trees are palms, and the odd mesquite: civgen.js plants for greener places)
		// (the pines it plants stay pines: the Aleppo pine is the desert's other street tree)
		if (!cached && palms(J.town)) for (const tr of region.trees || []) {
			if (tr.cone || tr.sp) continue;
			const k = hashStr(Math.round(tr.x) + ':' + Math.round(tr.z)) % 20;
			tr.sp = k < 14 ? 3 : 1;
			if (k < 14) tr.h = Math.max(tr.h || 0, 9 + k * 0.6);
		}
		// (a paved landmark's clearing, a resort's drives and lots, is the town's paved ground on its map, not
		// wild land: no scrub or wild tree comes up in it, landAt() says so)
		const M = region.map;
		for (const k of J.keep || []) {
			if (!k.paved || !M) continue;
			for (let j = Math.max(0, Math.floor((k.z - k.r - M.z0) / M.step)); j <= Math.min(M.h - 1, Math.floor((k.z + k.r - M.z0) / M.step)); j++) for (let i = Math.max(0, Math.floor((k.x - k.r - M.x0) / M.step)); i <= Math.min(M.w - 1, Math.floor((k.x + k.r - M.x0) / M.step)); i++) {
				const q = (j * M.w + i) * 4 + 1;
				if (!M.px[q] && Math.hypot(M.x0 + (i + 0.5) * M.step - k.x, M.z0 + (j + 0.5) * M.step - k.z) < k.r) M.px[q] = LU.commercial * 16;
			}
		}
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
