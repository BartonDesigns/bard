// The city director. As you come towards a city (within about 20 km) it asks the on-device
// model (guide/llm.js) what should be in it: its districts and landmarks, street names, shop
// signs, what people say, the music, clothes, food, vehicles and plants. The answer is a city
// brief (brief.js), kept in this browser (IndexedDB) so a place is the same every visit and
// is made once per device. Without a model (most players) the brief comes from the atlas
// alone, the same every time: the world never waits on the model, it is only richer for it.
//
// The model is asked only when it is loaded and idle (the Guide and the people come first;
// the chat queue in llm.js is shared), never on a phone's in-browser model, never after it
// ran the page out of memory (crashedBefore), and only while frames are coming quickly. It is
// asked three small questions (brief.js briefPrompts), each a short JSON object, each read
// leniently (json.js) with one retry, and whatever it gets wrong is taken from the atlas.
//
//   const D = createDirector({ llm, toLatLon })
//   D.update(lat, lon, dt)    each frame: finds the cities ahead and the one you are in
//   D.briefFor(city)          -> Promise<brief>; a city is an atlas city, its name, or { name, lat, lon }
//   D.townBrief(town)         for civ.js: a generated town's brief now, or null while one is coming
//   D.on(fn)                  fn(brief, city) whenever a brief is made or found; also the
//                             window event 'crysis:brief' ({ detail: { brief, city } })
// and hub.js holds the brief of where you are, for the people and the ambience.

import { loadAtlas, atlasReady, citiesNear, cityByName, city as atlasCity, regionAt, slug, describeAt } from './atlas.js';
import { fallbackBrief, validateBrief, briefPrompts, BRIEF_SCHEMA } from './brief.js';
import { looseJSON } from './json.js';
import { setBrief } from './hub.js';
import { crashedBefore, onPhone } from '../guide/llm.js';

const APPROACH = 20;       // km: start on a city this far out
const HERE = 5;            // km (plus 2 per size class): the city you are in
const SCAN_MS = 1000;      // how often to look round (the frame only keeps a tally)
const LOAD_AFTER = 6000;   // ms after the world starts before the atlas is fetched
const WAIT_MS = 15000;     // a town waits this long for its model-made brief, then grows from the atlas
const PART_MS = 90000;     // one question may take this long before it is given up
const MIN_FPS = 30;        // below this the model is not asked (it shares the GPU)
const DB = 'crysis-earth', STORE = 'briefs';

export function createDirector({ llm = null, toLatLon = null, store = idbStore(), idleMs = 4000, clock = () => performance.now() } = {}) {
	const mem = new Map();          // key -> a brief made by the model (or stored before)
	const fbs = new Map();          // key -> the atlas brief (made on demand, never stored)
	const looks = new Map();        // key -> the stored-brief lookup
	const looked = new Set();       // keys whose lookup has answered
	const queue = [];               // { city, key, urgent, waiters }
	const waits = new Map();        // town key -> { t0, brief }
	const towns = new WeakMap();    // bay town -> its city record
	const listeners = new Set();
	const stats = { asked: 0, made: 0, mixed: 0, failed: 0, parts: 0, repaired: 0, retries: 0, error: '' };
	let working = null, timer = null, idleAt = clock(), fps = 60, lastScan = -1e9, t0 = null, loading = null, hereKey = null, town = null;

	const keyOf = (c) => BRIEF_SCHEMA + ':' + c.id;
	const thinkable = () => !!llm && llm.kind?.() !== 'none' && llm.status?.ready && !crashedBefore() && !(onPhone() && llm.kind?.() === 'webllm');
	const idle = () => !llm?.busy?.() && clock() - idleAt > idleMs && fps >= MIN_FPS;
	const later = (ms) => { if (!timer) timer = setTimeout(() => { timer = null; pump(); }, ms); };
	const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
	const fallbackFor = (c) => { const k = keyOf(c); let b = fbs.get(k); if (!b) fbs.set(k, b = fallbackBrief(c)); return b; };
	const known = (c) => mem.get(keyOf(c)) || null;

	// a city from anything: an atlas city, its id or name, or a place { name, lat, lon, pop?, char? }
	function cityOf(x) {
		if (!x) return null;
		if (typeof x === 'string') return atlasCity(x) || cityByName(x);
		if (x.id && atlasCity(x.id) === x) return x;
		if (!Number.isFinite(x.lat) || !Number.isFinite(x.lon)) return x.name ? cityByName(x.name) : null;
		const at = regionAt(x.lat, x.lon);
		return { id: x.id || 'gen:' + slug(x.name || 'town') + ':' + x.lat.toFixed(2) + ',' + x.lon.toFixed(2), name: x.name || 'Town', lat: x.lat, lon: x.lon, pop: x.pop ?? 1, char: x.char || `A ${x.pop >= 2 ? 'city' : 'town'} in ${at.name}`, landmarks: x.landmarks || [], region: at.id, regionName: at.name, country: at.profile.country || '', gen: true };
	}

	function lookup(k) {
		if (mem.has(k)) return Promise.resolve(mem.get(k));
		if (!looks.has(k)) looks.set(k, Promise.resolve().then(() => store.get(k)).catch(() => null).then((b) => { looked.add(k); if (b && b.v === BRIEF_SCHEMA && b.id) { mem.set(k, b); return b; } return null; }));
		return looks.get(k);
	}

	function emit(b, c) {
		for (const f of listeners) { try { f(b, c); } catch (e) { console.warn('earth director listener', e); } }
		if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('crysis:brief', { detail: { brief: b, city: c } }));
		if (keyOf(c) === hereKey) setBrief(b);
	}
	function settle(e, b) {
		const i = queue.indexOf(e);
		if (i >= 0) queue.splice(i, 1);
		const W = e.waiters.splice(0);
		for (const f of W) f(b);
		emit(b, e.city);
	}

	// ask for a city's brief: the stored one, else the model's (queued), else the atlas's
	function request(c, urgent = false) {
		const k = keyOf(c);
		if (mem.has(k)) return Promise.resolve(mem.get(k));
		let e = working?.key === k ? working : queue.find((q) => q.key === k);
		if (e) { if (urgent && !e.urgent) { e.urgent = true; queue.sort((a, b) => b.urgent - a.urgent); } return new Promise((ok) => e.waiters.push(ok)); }
		e = { city: c, key: k, urgent, waiters: [] };
		const p = new Promise((ok) => e.waiters.push(ok));
		queue.push(e);
		queue.sort((a, b) => b.urgent - a.urgent);
		lookup(k).then((b) => { if (b) settle(e, b); else pump(); });
		return p;
	}

	function pump() {
		if (working) return;
		const ready = queue.filter((e) => looked.has(e.key) && !mem.has(e.key));
		if (!ready.length) return;
		// no model to ask: each waiting city gets its atlas brief (not stored, so a model loaded
		// later can still make it richer)
		if (!thinkable()) { for (const e of ready) settle(e, fallbackFor(e.city)); return; }
		if (!idle()) { later(1000); return; }
		working = ready[0];
		think(working).then((b) => { const e = working; working = null; settle(e, b); pump(); }, (err) => { const e = working; working = null; stats.error = String(err?.message || err); settle(e, fallbackFor(e.city)); pump(); });
	}

	async function think(e) {
		const base = fallbackFor(e.city), parts = briefPrompts(e.city, base), got = {};
		let ok = 0;
		stats.asked++;
		for (const P of parts) {
			if (!(await waitIdle())) break;
			const v = await ask(P);
			if (v) { Object.assign(got, v); ok++; }
		}
		const b = validateBrief(got, base);
		b.source = !ok || !b.took ? 'atlas' : ok === parts.length ? 'llm' : 'mixed';
		delete b.took;
		if (b.source === 'atlas') { stats.failed++; return base; }
		stats[b.source === 'llm' ? 'made' : 'mixed']++;
		mem.set(e.key, b);
		try { await store.put(e.key, b); } catch { /* kept for this session only */ }
		return b;
	}
	async function waitIdle() {
		const t = clock();
		while (!idle()) { if (!thinkable() || clock() - t > 30000) return false; await sleep(400); }
		return thinkable();
	}
	// one question, read leniently; one retry, a little stricter and cooler
	async function ask(P) {
		for (let n = 0; n < 2; n++) {
			if (n) stats.retries++;
			const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
			const cut = setTimeout(() => ctrl?.abort(), PART_MS);
			let text = null;
			try { text = await llm.chat(n ? P.retry : P.messages, () => {}, ctrl?.signal, { maxTokens: P.maxTokens, temperature: n ? 0.3 : 0.55, json: n === 0 }); } catch (err) { stats.error = String(err?.message || err); } finally { clearTimeout(cut); }
			const J = looseJSON(text || '');
			const v = J && P.accept(J.value);
			if (v) { stats.parts++; if (J.repaired) stats.repaired++; return v; }
		}
		return null;
	}

	// ---------- each frame ----------
	function update(lat, lon, dt = 1 / 60) {
		fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
		if (llm?.busy?.()) idleAt = clock();
		const t = clock();
		if (t - lastScan < SCAN_MS) return;
		lastScan = t;
		if (!atlasReady()) {
			if (t0 === null) t0 = t;
			if (!loading && t - t0 > LOAD_AFTER) loading = loadAtlas().catch((err) => { stats.error = 'atlas: ' + (err?.message || err); });
			return;
		}
		const near = citiesNear(lat, lon, APPROACH, 8);
		for (const c of near) lookup(keyOf(c));
		// the city you are in (the nearest whose reach you are within), else the town being grown
		const here = near.find((c) => c.km <= HERE + c.pop * 2);
		if (here) { hereKey = keyOf(here); setBrief(known(here) || fallbackFor(here)); } else if (town) { hereKey = town.key; setBrief(mem.get(town.key) || town.brief || null); } else { hereKey = null; setBrief(null); }
		// and the ones ahead: asked about while there is time
		if (thinkable()) for (const c of near.slice(0, 4)) { const k = keyOf(c); if (!mem.has(k) && looked.has(k)) request(c); }
		pump();
	}

	// ---------- the generated towns (crysis/civ.js) ----------
	// a town's brief now; null while the atlas loads or the model is making it (for up to
	// WAIT_MS); undefined when there will be none (the town grows as it always did)
	function townBrief(t) {
		if (!toLatLon) return undefined;
		if (!atlasReady()) { if (!loading) loading = loadAtlas().catch((err) => { stats.error = 'atlas: ' + (err?.message || err); }); return stats.error.startsWith('atlas') ? undefined : null; }
		let c = towns.get(t);
		if (!c) { const ll = toLatLon(t.x, t.z); c = cityOf({ name: t.name, lat: ll.lat, lon: ll.lon, pop: t.pop > 250000 ? 3 : t.pop > 60000 ? 2 : t.pop > 5000 ? 1 : 0 }); towns.set(t, c); }
		const k = keyOf(c);
		town = { key: k, city: c, brief: null };
		if (mem.has(k)) return (town.brief = mem.get(k));
		let W = waits.get(k);
		if (!W) { W = { t0: clock(), brief: null }; waits.set(k, W); request(c, true).then((b) => { W.brief = b; }); }
		if (W.brief) return (town.brief = W.brief);
		if (clock() - W.t0 > WAIT_MS) return (town.brief = fallbackFor(c));
		return null;
	}

	// ---------- asked by name (the console, other systems) ----------
	async function briefFor(x) {
		await loadAtlas();
		const c = cityOf(x);
		if (!c) return null;
		const b = await lookup(keyOf(c));
		return b || request(c, true);
	}
	async function forget(x) {
		await loadAtlas();
		const c = cityOf(x);
		if (!c) return false;
		const k = keyOf(c);
		mem.delete(k); looks.delete(k); looked.delete(k); fbs.delete(k);
		try { await store.del(k); } catch { /* not stored */ }
		return true;
	}
	async function describe(lat, lon) { await loadAtlas(); return describeAt(lat, lon); }

	return {
		update, townBrief, briefFor, forget, describe, request: (x, urgent) => loadAtlas().then(() => request(cityOf(x), urgent)),
		fallback: (x) => (atlasReady() && cityOf(x) ? fallbackFor(cityOf(x)) : null), cityOf,
		on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
		info: () => ({ ...stats, cached: mem.size, queued: queue.length, working: working?.city.name || null, thinking: thinkable(), idle: idle(), fps: Math.round(fps), atlas: atlasReady(), here: hereKey }),
	};
}

// the briefs kept in this browser (IndexedDB); nothing where there is none
export function idbStore() {
	if (typeof indexedDB === 'undefined') { const M = new Map(); return { get: async (k) => M.get(k) ?? null, put: async (k, v) => { M.set(k, v); }, del: async (k) => { M.delete(k); } }; }
	let db = null;
	const open = () => (db ||= new Promise((ok, no) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE);
		r.onsuccess = () => ok(r.result);
		r.onerror = () => no(r.error);
	}).catch(() => null));
	const run = async (mode, f) => {
		const d = await open();
		if (!d) return null;
		return new Promise((ok) => { try { const q = f(d.transaction(STORE, mode).objectStore(STORE)); q.onsuccess = () => ok(q.result ?? null); q.onerror = () => ok(null); } catch { ok(null); } });
	};
	return { get: (k) => run('readonly', (s) => s.get(k)), put: (k, v) => run('readwrite', (s) => s.put(v, k)), del: (k) => run('readwrite', (s) => s.delete(k)) };
}
