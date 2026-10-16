// The quality governor: four tiers of graphics, best first, and the rules for stepping between
// them while the world runs. A phone that cannot hold its frames, or whose memory climbs, is
// stepped down a tier at a time, smoothly and with room between the steps; one that runs easily
// for a good while is let back up. A graphics loss, or a page that went without saying goodbye
// (the white flash and back to the faceplate), lowers the best tier this device is let have, for
// a few days, so the next load starts somewhere it can hold instead of going round the same way.
//
// The rules are plain functions over plain state (island/tools/governor.test.mjs). The current
// tier is kept here too, for any system to read (qualityNow) or be told of (onQuality), so the
// engine's systems scale themselves without anything handed through their constructors.

// what each tier asks of the world:
//   ratio: of the device's best pixel ratio; shadows, their map's size (a fraction of the sun's
//   own) and how often they are drawn (every frame, or every other: the shadow pass draws the
//   city a second time); people: of the crowd the place calls for; far: of the view's reach (and
//   how near the cars hand over to their coarser shapes); reflect: the clouds in the water; fx:
//   the sunbeams' and spray's own setting ('auto' is their phone or desktop default)
export const TIERS = [
	{ name: 'high', ratio: 1, shadows: true, shadowSize: 1, shadowEvery: 1, people: 1, far: 1, reflect: true, fx: 'auto' },
	{ name: 'medium', ratio: 0.85, shadows: true, shadowSize: 0.5, shadowEvery: 2, people: 0.75, far: 0.8, reflect: true, fx: 'auto' },
	{ name: 'low', ratio: 0.7, shadows: false, shadowSize: 0.5, shadowEvery: 2, people: 0.5, far: 0.6, reflect: false, fx: 'low' },
	{ name: 'minimal', ratio: 0.55, shadows: false, shadowSize: 0.5, shadowEvery: 2, people: 0.3, far: 0.45, reflect: false, fx: 'low' },
];
export const LOWEST = TIERS.length - 1;

// the rules' numbers (a phone's: 60 Hz screens, a few hundred MB for the page)
export const RULES = {
	slowMs: 28,          // frames slower than this, on average...
	slowFor: 4,          // ...for this many seconds: a tier down
	fastMs: 18,          // frames quicker than this...
	fastFor: 25,         // ...for this long: a tier up (if the ceiling allows)
	settle: 6,           // seconds after any step before the next is considered
	upAfterDown: 45,     // and before going back up after a step down
	memHigh: 0.8,        // memory past this share of its budget: a tier down now
	memOk: 0.6,          // and below this before a tier up is allowed
};

// A governor's state: the tier now, the best allowed, and its clocks.
export function governorState({ tier = 0, ceiling = 0 } = {}) {
	const c = clampTier(ceiling);
	return { tier: Math.max(clampTier(tier), c), ceiling: c, slow: 0, fast: 0, since: 1e9, sinceDown: 1e9, avg: 0 };
}
export const clampTier = (t) => Math.max(0, Math.min(LOWEST, Math.round(Number(t) || 0)));

// One step of the rules. sample: { dt (s), frameMs (smoothed), mem (0..1 of budget, or null) }.
// Returns the change: 'down', 'up' or '' (state.tier already moved).
export function govern(state, { dt = 0, frameMs = 16, mem = null } = {}, rules = RULES) {
	state.since += dt; state.sinceDown += dt;
	state.avg = frameMs;
	// the ceiling may have been lowered from outside (a graphics loss)
	if (state.tier < state.ceiling) { state.tier = state.ceiling; state.since = state.sinceDown = 0; return 'down'; }
	const memHigh = mem != null && mem > rules.memHigh;
	state.slow = frameMs > rules.slowMs ? state.slow + dt : Math.max(0, state.slow - dt * 2);
	state.fast = frameMs < rules.fastMs && (mem == null || mem < rules.memOk) ? state.fast + dt : 0;
	if (state.since < rules.settle) return '';
	if ((memHigh || state.slow >= rules.slowFor) && state.tier < LOWEST) {
		state.tier++; state.slow = 0; state.fast = 0; state.since = state.sinceDown = 0;
		return 'down';
	}
	if (state.fast >= rules.fastFor && state.sinceDown >= rules.upAfterDown && state.tier > state.ceiling) {
		state.tier--; state.fast = 0; state.slow = 0; state.since = 0;
		return 'up';
	}
	return '';
}

// ---------- what this device has been through (kept in storage) ----------
// { ceiling, at (when last lowered), crashes: [times], live (a world open, not yet said goodbye) }
export const STORE_KEY = 'l99-governor';
const DAY = 86400000;
export function readRecord(raw) {
	let r = null;
	try { r = raw ? JSON.parse(raw) : null; } catch { r = null; }
	if (!r || typeof r !== 'object') r = {};
	return { ceiling: clampTier(r.ceiling), at: Number(r.at) || 0, crashes: Array.isArray(r.crashes) ? r.crashes.filter(Number.isFinite).slice(-6) : [], live: Number(r.live) || 0 };
}
// the ceiling, a day at a time back towards the best: a tier for each whole day since it was lowered
export function ceilingNow(rec, now = Date.now()) {
	if (!rec.ceiling) return 0;
	const days = Math.floor(Math.max(0, now - rec.at) / DAY);
	return clampTier(rec.ceiling - days);
}
// loading: if the last world open never said goodbye, the page went (most likely its memory);
// one such end lowers the ceiling a tier, two within ten minutes start this one at the lowest
export function bootRecord(rec, now = Date.now()) {
	const r = { ...rec, crashes: rec.crashes.slice() };
	r.ceiling = ceilingNow(r, now);
	let crashed = false;
	if (r.live) {
		crashed = true;
		r.crashes.push(now);
		const recent = r.crashes.filter((t) => now - t < 10 * 60000).length;
		r.ceiling = recent >= 2 ? LOWEST : clampTier(r.ceiling + 1);
		r.at = now;
	}
	r.crashes = r.crashes.filter((t) => now - t < 3 * DAY).slice(-6);
	r.live = 0;
	return { rec: r, crashed };
}
// the graphics were lost: a tier lower from now on (for a few days)
export function lossRecord(rec, now = Date.now(), tierNow = 0) {
	return { ...rec, ceiling: clampTier(Math.max(ceilingNow(rec, now), tierNow) + 1), at: now };
}

// ---------- the tier now, for every system ----------
let current = 0;
const listeners = new Set();
export const qualityNow = () => TIERS[current];
// how many of n people a system may build on this tier (its people share), never fewer than least
export const peopleCap = (n, least = 1) => Math.max(Math.min(n, least), Math.round(n * TIERS[current].people));
export const tierNow = () => current;
export function onQuality(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function setTier(t) {
	const n = clampTier(t);
	if (n === current) return false;
	current = n;
	for (const fn of listeners) { try { fn(TIERS[n], n); } catch (e) { console.warn('[governor]', e); } }
	return true;
}

// ---------- the governor at work (main.js) ----------
// mode(): 'auto' (governed), 'high' or 'low' (chosen; a crash or graphics loss still caps them).
// meter: gpumeter.js's; budgetMB: what the graphics and the script heap together may hold
// before the governor steps down (a phone's is small: Safari closes the page well before the
// device runs out). All devices start a tier down and earn the best by running easily.
export function createGovernor({ phone = false, mode = () => 'auto', meter = null, budgetMB = phone ? 700 : 2500, storage = null, now = () => Date.now() } = {}) {
	const get = () => { try { return storage?.getItem(STORE_KEY) ?? null; } catch { return null; } };
	const put = (r) => { try { storage?.setItem(STORE_KEY, JSON.stringify(r)); } catch { /* private mode */ } };
	const booted = bootRecord(readRecord(get()), now());
	let rec = booted.rec;
	put(rec);
	const state = governorState({ tier: 1, ceiling: rec.ceiling });
	const fixed = (m) => Math.max(rec.ceiling, m === 'low' ? 2 : 0);
	let memK = null, memT = 0, lastMode = mode();
	// the heap over the last ten seconds, its lowest taken: the figure counts garbage not yet
	// collected, and the lowest is near what is really held (or the governor chases the collector)
	const heaps = [];
	// the share of the budget in use: the graphics' estimate, and the script heap where the browser tells it
	function memory() {
		const now = globalThis.performance?.memory?.usedJSHeapSize || 0;
		if (now) { heaps.push(now); if (heaps.length > 10) heaps.shift(); }
		const heap = heaps.length ? Math.min(...heaps) : 0;
		const gpu = meter?.bytes() || 0;
		if (!gpu && !heap) return null;
		// (no heap figure, as on Safari: the graphics' share stands for both, a phone's heap
		// running at about the size of its graphics in the harness)
		return (gpu + (heap || gpu)) / (budgetMB * 1048576);
	}
	const api = {
		crashedLastTime: booted.crashed,
		// one frame: dt (s), the smoothed frame time; true when the tier changed
		update(dt, frameMs) {
			const m = mode();
			if ((memT -= dt) <= 0) { memT = 1; memK = memory(); }
			if (m === 'auto') {
				if (lastMode !== 'auto') { state.since = 0; state.slow = state.fast = 0; }
				govern(state, { dt, frameMs, mem: memK });
			} else state.tier = fixed(m);
			lastMode = m;
			return setTier(state.tier);
		},
		// the mode was chosen in the settings: its tier at once
		apply() { state.tier = mode() !== 'auto' ? fixed(mode()) : Math.max(state.tier, rec.ceiling); return setTier(state.tier); },
		// the graphics were lost: a tier lower for a few days, and at once
		lost() { rec = lossRecord(rec, now(), state.tier); put(rec); state.ceiling = rec.ceiling; state.tier = Math.max(state.tier, rec.ceiling); return setTier(state.tier); },
		// a world on screen (or not): a page that goes while this is set went without a goodbye
		live(on) { const v = on ? now() : 0; if (!!rec.live === !!v) return; rec = { ...rec, live: v }; put(rec); },
		info: () => ({ tier: TIERS[state.tier].name, ceiling: TIERS[state.ceiling].name, mode: mode(), frameMs: Math.round(state.avg * 10) / 10, memory: memK == null ? null : Math.round(memK * 100) + '% of ' + budgetMB + ' MB', gpuMB: meter ? Math.round(meter.bytes() / 1048576) : null, crashedLastTime: booted.crashed, crashes: rec.crashes.length }),
		state,
	};
	setTier(state.tier);
	return api;
}
