// The city director. As you come towards a place (within about 20 km) it finds what should be
// in it: its districts and landmarks, street names, shop signs, what people say, the music,
// clothes, food, vehicles and plants, as a city brief (brief.js). A place's brief is the same
// for every player: it is made once, on the discovery server (server/discovery), by the first
// player to come to it, and everyone after gets that one. So for a place it looks for:
//
//   1. the brief kept in this browser from the server before (IndexedDB), which never changes
//   2. the server's (GET /brief/:id), and if no one has been there yet, asks for it to be made
//      (POST /discover: a real city's id, or a generated town's id, place and size)
//   3. otherwise (no server set, no network, too slow, or still being made) the atlas brief,
//      made here from the atlas alone and the same on every device. It is not kept, so the
//      server's is taken as soon as there is one.
//
// All of it is plain fetch, so it works the same on a phone. The Guide's own model (guide/
// llm.js) only talks: it no longer writes places, so no two players' worlds can differ. For
// development it can still be let write them (config.js LOCAL_MODEL_WORLD); it is then asked
// only when loaded and idle, three small questions (brief.js briefPrompts), read leniently.
//
//   const D = createDirector({ llm, toLatLon })
//   D.update(lat, lon, dt)    each frame: finds the cities ahead and the one you are in
//   D.briefFor(city)          -> Promise<brief>; a city is an atlas city, its name, or { name, lat, lon }
//   D.townBrief(town)         for civ.js: a generated town's brief now, or null while one is coming
//   D.on(fn)                  fn(brief, city) whenever a brief is found; also the window
//                             event 'crysis:brief' ({ detail: { brief, city } })
// and hub.js holds the brief of where you are, for the people and the ambience.

import { loadAtlas, atlasReady, citiesNear, cityByName, city as atlasCity, describeAt } from './atlas.js';
import { fallbackBrief, validateBrief, briefPrompts, canonicalBrief, genCity, BRIEF_SCHEMA } from './brief.js';
import { looseJSON } from './json.js';
import { setBrief } from './hub.js';
import { crashedBefore, onPhone } from '../guide/llm.js';
import { DISCOVERY_URL, GET_MS, MAKE_MS, LOCAL_MODEL_WORLD } from './config.js';

const APPROACH = 20;       // km: start on a city this far out
const HERE = 5;            // km (plus 2 per size class): the city you are in
const SCAN_MS = 1000;      // how often to look round (the frame only keeps a tally)
const LOAD_AFTER = 6000;   // ms after the world starts before the atlas is fetched
const WAIT_MS = 15000;     // a town waits this long for the device's model, then grows from the atlas
const RECHECK = [30000, 90000];  // ms: when to look again for a brief the server was still making
const PART_MS = 90000;     // one question to the device's model may take this long
const MIN_FPS = 30;        // below this the device's model is not asked (it shares the GPU)
const DB = 'crysis-earth', STORE = 'briefs';

export function createDirector({ llm = null, toLatLon = null, store = idbStore(), idleMs = 4000, clock = () => performance.now(), server = DISCOVERY_URL, fetch: fetcher = typeof fetch === 'function' ? fetch.bind(globalThis) : null, localModel = LOCAL_MODEL_WORLD, getMs = GET_MS, makeMs = MAKE_MS, recheck = RECHECK } = {}) {
	const base = String(server || '').replace(/\/+$/, '');
	const mem = new Map();          // key -> the place's brief (the shared one, or the device model's in dev)
	const fbs = new Map();          // key -> the atlas brief (made on demand, never kept)
	const looks = new Map();        // key -> the search for a place's brief (a promise)
	const queue = [];               // dev: { city, key, urgent, waiters } for the device's model
	const waits = new Map();        // town key -> { t0, brief }
	const towns = new WeakMap();    // bay town -> its city record
	const listeners = new Set();
	const stats = { shared: 0, stored: 0, made: 0, pending: 0, atlas: 0, offline: 0, asked: 0, mixed: 0, failed: 0, parts: 0, repaired: 0, retries: 0, error: '' };
	let working = null, timer = null, idleAt = clock(), fps = 60, lastScan = -1e9, t0 = null, loading = null, hereKey = null, town = null;

	const keyOf = (c) => BRIEF_SCHEMA + ':' + c.id;
	const thinkable = () => localModel && !!llm && llm.kind?.() !== 'none' && llm.status?.ready && !crashedBefore() && !(onPhone() && llm.kind?.() === 'webllm');
	const idle = () => !llm?.busy?.() && clock() - idleAt > idleMs && fps >= MIN_FPS;
	const later = (ms) => { if (!timer) timer = setTimeout(() => { timer = null; pump(); }, ms); };
	const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
	const fallbackFor = (c) => { const k = keyOf(c); let b = fbs.get(k); if (!b) fbs.set(k, b = fallbackBrief(c)); return b; };
	const known = (c) => mem.get(keyOf(c)) || null;
	const shared = () => !!(base && fetcher);

	// a city from anything: an atlas city, its id or name, or a place { name, lat, lon, pop?, char? }
	function cityOf(x) {
		if (!x) return null;
		if (typeof x === 'string') return atlasCity(x) || cityByName(x);
		if (x.id && atlasCity(x.id) === x) return x;
		if (!Number.isFinite(x.lat) || !Number.isFinite(x.lon)) return x.name ? cityByName(x.name) : null;
		return genCity({ id: x.id, name: x.name || 'Town', lat: x.lat, lon: x.lon, pop: x.pop ?? 1, char: x.char, landmarks: x.landmarks });
	}

	function emit(b, c) {
		for (const f of listeners) { try { f(b, c); } catch (e) { console.warn('earth director listener', e); } }
		if (typeof window !== 'undefined' && window.dispatchEvent && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('crysis:brief', { detail: { brief: b, city: c } }));
		if (keyOf(c) === hereKey) setBrief(b);
	}

	// ---------- the shared brief: kept here, else the server's ----------
	const fromRec = (rec, c) => (rec && rec.v === BRIEF_SCHEMA && rec.id === c.id ? canonicalBrief(rec.brief, c) : null);
	async function http(path, init, ms) {
		const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
		const cut = setTimeout(() => ctrl?.abort(), ms);
		try {
			const r = await fetcher(base + path, { ...init, signal: ctrl?.signal, credentials: 'omit' });
			let body = null;
			try { body = await r.json(); } catch { /* no body */ }
			return { status: r.status, body };
		} catch (err) {
			stats.offline++; stats.error = 'server: ' + String(err?.message || err);
			return null;
		} finally { clearTimeout(cut); }
	}
	const getRec = async (c) => { const r = await http('/brief/' + encodeURIComponent(c.id), { method: 'GET' }, getMs); return !r ? undefined : r.status === 200 ? r.body : r.status === 404 ? null : undefined; };
	async function keep(c, rec) {
		const b = fromRec(rec, c);
		if (!b) return null;
		try { await store.put('canon:' + keyOf(c), rec); } catch { /* kept for this session only */ }
		return b;
	}
	async function canonical(c) {
		const k = keyOf(c);
		let rec = null;
		try { rec = await store.get('canon:' + k); } catch { /* none kept */ }
		let b = fromRec(rec, c);
		if (b) { stats.stored++; return b; }
		if (!shared()) return null;
		rec = await getRec(c);
		if (rec === undefined) return null;           // the server is not answering: the atlas for now
		if (rec) { stats.shared++; return keep(c, rec); }
		// no one has been here: have it made (the server builds the words from its own atlas;
		// only the place goes)
		const body = c.gen ? { id: c.id, lat: c.lat, lon: c.lon, name: c.name, pop: Math.max(0, Math.min(3, c.pop | 0)) } : { id: c.id };
		const r = await http('/discover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, makeMs);
		if (r?.status === 200) { b = await keep(c, r.body); if (b) { stats.made++; return b; } }
		if (r?.status === 202 || !r) { stats.pending++; lookAgain(c, 0); }
		return null;
	}
	// a brief still being made (or a request cut short): look again a little later, and take it
	// then (the atlas brief it replaces was never kept)
	function lookAgain(c, n) {
		if (n >= recheck.length) return;
		setTimeout(async () => {
			const k = keyOf(c);
			if (mem.has(k)) return;
			const rec = await getRec(c);
			const b = rec ? await keep(c, rec) : null;
			if (b) { if (!mem.has(k)) { mem.set(k, b); emit(b, c); } } else lookAgain(c, n + 1);
		}, recheck[n]);
	}

	// ---------- a place's brief: the shared one, else (dev) the device's model's, else the atlas's ----------
	function request(c, urgent = false) {
		const k = keyOf(c);
		if (mem.has(k)) return Promise.resolve(mem.get(k));
		if (!looks.has(k)) looks.set(k, find(c, urgent).catch((err) => { stats.error = String(err?.message || err); return fallbackFor(c); }));
		const L = looks.get(k);
		if (urgent) { const e = queue.find((q) => q.key === k); if (e && !e.urgent) { e.urgent = true; queue.sort((a, b) => b.urgent - a.urgent); } }
		return L;
	}
	async function find(c, urgent) {
		const k = keyOf(c);
		let b = await canonical(c).catch(() => null);
		if (!b && localModel) b = await local(c, urgent);
		if (b) { if (!mem.has(k)) mem.set(k, b); b = mem.get(k); } else { b = fallbackFor(c); stats.atlas++; }
		emit(b, c);
		return b;
	}

	// ---------- dev only: the device's own model ----------
	async function local(c, urgent) {
		const k = 'llm:' + keyOf(c);
		try { const b = await store.get(k); if (b && b.v === BRIEF_SCHEMA && b.id === c.id) return b; } catch { /* none kept */ }
		if (!thinkable()) return null;
		const e = { city: c, key: keyOf(c), urgent, waiters: [] };
		const p = new Promise((ok) => e.waiters.push(ok));
		queue.push(e);
		queue.sort((a, b) => b.urgent - a.urgent);
		pump();
		return p;
	}
	function settle(e, b) {
		const i = queue.indexOf(e);
		if (i >= 0) queue.splice(i, 1);
		for (const f of e.waiters.splice(0)) f(b);
	}
	function pump() {
		if (working || !queue.length) return;
		if (!thinkable()) { for (const e of queue.slice()) settle(e, null); return; }
		if (!idle()) { later(1000); return; }
		working = queue[0];
		think(working).then((b) => { const e = working; working = null; settle(e, b); pump(); }, (err) => { const e = working; working = null; stats.error = String(err?.message || err); settle(e, null); pump(); });
	}
	async function think(e) {
		const atlasB = fallbackFor(e.city), parts = briefPrompts(e.city, atlasB), got = {};
		let ok = 0;
		stats.asked++;
		for (const P of parts) {
			if (!(await waitIdle())) break;
			const v = await ask(P);
			if (v) { Object.assign(got, v); ok++; }
		}
		const b = validateBrief(got, atlasB);
		b.source = !ok || !b.took ? 'atlas' : ok === parts.length ? 'llm' : 'mixed';
		delete b.took;
		if (b.source === 'atlas') { stats.failed++; return null; }
		if (b.source === 'mixed') stats.mixed++;
		try { await store.put('llm:' + e.key, b); } catch { /* kept for this session only */ }
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
		// the city you are in (the nearest whose reach you are within), else the town being grown
		const here = near.find((c) => c.km <= HERE + c.pop * 2);
		if (here) { hereKey = keyOf(here); setBrief(known(here) || fallbackFor(here)); } else if (town) { hereKey = town.key; setBrief(mem.get(town.key) || town.brief || null); } else { hereKey = null; setBrief(null); }
		// and the ones ahead: found (or discovered) while there is time
		if (shared() || thinkable()) for (const c of near.slice(0, 4)) { const k = keyOf(c); if (!mem.has(k) && !looks.has(k)) request(atlasCity(c.id) || c); }
	}

	// ---------- the generated towns (crysis/civ.js) ----------
	// a town's brief now; null while the atlas loads or its brief is on the way (up to the
	// server's time, or WAIT_MS for the device's model); undefined when there will be none
	function townBrief(t) {
		if (!toLatLon) return undefined;
		if (!atlasReady()) { if (!loading) loading = loadAtlas().catch((err) => { stats.error = 'atlas: ' + (err?.message || err); }); return stats.error.startsWith('atlas') ? undefined : null; }
		let c = towns.get(t);
		if (!c) { const ll = toLatLon(t.x, t.z); c = cityOf({ name: t.name, lat: ll.lat, lon: ll.lon, pop: t.pop > 250000 ? 3 : t.pop > 60000 ? 2 : t.pop > 5000 ? 1 : 0 }); towns.set(t, c); }
		const k = keyOf(c);
		town = { key: k, city: c, brief: null };
		if (mem.has(k)) return (town.brief = mem.get(k));
		// nowhere to ask: the atlas brief now (the same on every device)
		if (!shared() && !thinkable()) return (town.brief = fallbackFor(c));
		let W = waits.get(k);
		if (!W) { W = { t0: clock(), brief: null }; waits.set(k, W); request(c, true).then((b) => { W.brief = b; }); }
		if (W.brief) return (town.brief = W.brief);
		if (clock() - W.t0 > (shared() ? makeMs + getMs : WAIT_MS)) return (town.brief = fallbackFor(c));
		return null;
	}

	// ---------- asked by name (the console, other systems) ----------
	async function briefFor(x) {
		await loadAtlas();
		const c = cityOf(x);
		return c ? request(c, true) : null;
	}
	async function forget(x) {
		await loadAtlas();
		const c = cityOf(x);
		if (!c) return false;
		const k = keyOf(c);
		mem.delete(k); looks.delete(k); fbs.delete(k);
		for (const p of ['canon:', 'llm:']) { try { await store.del(p + k); } catch { /* not kept */ } }
		return true;
	}
	async function describe(lat, lon) { await loadAtlas(); return describeAt(lat, lon); }

	return {
		update, townBrief, briefFor, forget, describe, request: (x, urgent) => loadAtlas().then(() => request(cityOf(x), urgent)),
		fallback: (x) => (atlasReady() && cityOf(x) ? fallbackFor(cityOf(x)) : null), cityOf,
		on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
		info: () => ({ ...stats, server: base || null, localModel, cached: mem.size, queued: queue.length, working: working?.city.name || null, thinking: thinkable(), idle: idle(), fps: Math.round(fps), atlas: atlasReady(), here: hereKey }),
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
