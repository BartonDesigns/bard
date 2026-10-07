// Residents outlive their rendered bodies. Coordinates here never use a rebased Earth frame.
const KEY = 'crysis-social-v1', BACKUP = KEY + '-backup';
const MODES = new Set(['idle', 'follow', 'wait', 'home', 'scout', 'quest', 'meet']);
const finite = Number.isFinite;
const copy = value => JSON.parse(JSON.stringify(value));
const position = p => p && (finite(p.lat) && finite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 ? { lat: p.lat, lon: p.lon, y: finite(p.y) ? p.y : 0 } : finite(p.x) && finite(p.z) ? { x: p.x, z: p.z, y: finite(p.y) ? p.y : 0 } : null);
export function socialDistance(a, b) {
	if (!a || !b) return Infinity;
	if (finite(a.lat) && finite(b.lat)) {
		const r = Math.PI / 180, dy = (b.lat - a.lat) * r, dx = (b.lon - a.lon) * r;
		const h = Math.sin(dy / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dx / 2) ** 2;
		return 12742000 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
	}
	return finite(a.x) && finite(b.x) ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;
}
// Deliberately narrow: dialogue can discuss an order without issuing it.
export function parseSocialIntent(text) {
	const q = String(text || '').toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
	if (!q || /["“”‘’]/.test(q) || /\b(don't|dont|do not|never|not|if|would|could|should|said|says|say|told|tell me|what if)\b/.test(q)) return null;
	const s = q.replace(/^(please |can you |will you )/, '').replace(/ please$/, '');
	if (/^(warn|alert) (the other |the |other |all (the )?)?(villagers|village|town|people|everyone|others)( about (danger|the danger))?$/.test(s)) return 'warn';
	if (/^(calm (the |other )?(villagers|village|town|people|everyone|others)( down)?|give the all clear|all clear|reassure (everyone|the villagers))$/.test(s)) return 'calm';
	if (/^(follow me|come with me|join me)$/.test(s)) return 'follow';
	if (/^(wait( here)?|stay( here)?)$/.test(s)) return 'wait';
	if (/^(go|head|return)( back)? home$/.test(s)) return 'home';
	if (/^(scout( ahead| nearby| the area)?|look around|check the area|run an errand)$/.test(s)) return 'scout';
	const scout = s.match(/^(?:scout|check out|investigate) ([\p{L}\p{N}][\p{L}\p{N} '.-]{0,79})$/u);
	if (scout && !/\b(and|then|or|but|because|is|was|were|means|mean|saying|said|says|talking|about|who|what|how|why|when|whether)\b/.test(scout[1])) return 'scout';
	if (/^(join my quest|help me (with (my|the) quest|in the dungeon)|join me in the dungeon|come to the dungeon with me)$/.test(s)) return 'quest';
	if (/^(cancel( your task| the task| your order)?|stop( following me| your task)?|never mind|nevermind)$/.test(s)) return 'cancel';
	if (/^(report( your progress| back)?|status|what is your status|how is (your|the) task( going)?|what are you doing)$/.test(s)) return 'status';
	return null;
}
export function createSocialState(options = {}) {
	let storage = options.storage;
	if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
	const now = options.now || Date.now;
	let state = { version: 1, revision: 0, residents: {}, events: [] }, dirty = false, error = null, savedAt = null, recovered = false, lastGood = null, readBlocked = false;
	function decode(raw) {
		if (!raw) return null;
		const s = JSON.parse(raw);
		if (s?.version !== 1 || !s.residents || typeof s.residents !== 'object' || Array.isArray(s.residents) || !Array.isArray(s.events)) throw Error('Unrecognized social save');
		for (const [id, p] of Object.entries(s.residents)) {
			if (!p || p.id !== id || typeof p.bodyKey !== 'string' || !position(p.home) || !position(p.position) || !Array.isArray(p.history) || !MODES.has(p.mode)) throw Error('Invalid resident record');
		}
		for (const e of s.events) if (!e || typeof e.id !== 'string' || typeof e.bodyKey !== 'string' || !position(e.position) || !finite(e.at) || !finite(e.expires) || !finite(e.radius) || e.radius <= 0 || e.radius > 120 || !finite(e.severity) || e.severity < 0 || e.severity > 1 || !Array.isArray(e.recipients)) throw Error('Invalid warning record');
		return s;
	}
	try {
		const raw = storage?.getItem(KEY), loaded = decode(raw);
		if (loaded) { state = loaded; lastGood = raw; savedAt = loaded.savedAt || null; }
	} catch (e) {
		error = String(e.message || e); readBlocked = true;
		try { const raw = storage?.getItem(BACKUP), loaded = decode(raw); if (loaded) { state = loaded; lastGood = raw; recovered = true; readBlocked = false; } } catch { /* Keep both failed records for recovery. */ }
	}
	function save() {
		if (!dirty) return !error;
		try {
			if (!storage) throw Error('Browser storage unavailable');
			if (readBlocked) throw Error('Existing social save could not be read; it was preserved for recovery');
			const next = { ...state, revision: state.revision + 1, savedAt: now() }, raw = JSON.stringify(next);
			if (raw.length > 2000000) throw Error('Social save is full; no remembered residents were deleted');
			if (lastGood) storage.setItem(BACKUP, lastGood);
			storage.setItem(KEY, raw);
			state.revision = next.revision; state.savedAt = next.savedAt; savedAt = next.savedAt; lastGood = raw; dirty = false; error = null;
			return true;
		} catch (e) { error = String(e.message || e); return false; }
	}
	const changed = () => { dirty = true; save(); };
	const get = id => Object.hasOwn(state.residents, id) ? state.residents[id] : null;
	const list = bodyKey => Object.values(state.residents).filter(p => bodyKey === undefined || p.bodyKey === bodyKey);
	function meet(spec) {
		const known = spec.id && get(spec.id), bodyKey = spec.bodyKey;
		const prior = known?.bodyKey === bodyKey ? known : null;
		const home = position(spec.home || prior?.home), pos = position(spec.position || prior?.position || spec.home);
		if (typeof bodyKey !== 'string' || !bodyKey || !home || !pos || finite(home.lat) !== finite(pos.lat)) throw Error('Resident requires body identity and valid home/position');
		const id = known?.bodyKey === bodyKey ? spec.id : JSON.stringify([bodyKey, spec.source || 'resident', spec.id || [home, spec.dna?.seed ?? 0]]);
		let p = get(id);
		if (!p) {
			p = { id, version: 1, bodyKey, source: spec.source || 'resident', dna: copy(spec.dna || {}), persona: copy(spec.persona || {}), home, position: pos, history: [], memories: [], mode: 'idle', task: null, firstMet: now(), lastMet: now(), metCount: 0 };
			state.residents[id] = p;
		}
		p.lastMet = now(); p.metCount++; changed(); return p;
	}
	function remember(id, role, text) {
		const p = get(id); if (role === 'system') role = 'event';
		if (!p || !['user', 'assistant', 'event'].includes(role)) return false;
		const line = { role, content: String(text).slice(0, 1200), at: now() };
		// Conversation stays on this device. Event summaries also survive the short chat window.
		p.history.push(line); p.history = p.history.slice(-16);
		if (role === 'event') { p.memories = [...(p.memories || []), line].slice(-32); }
		changed(); return true;
	}
	function setPosition(id, pos) {
		const p = get(id), q = position(pos); if (!p || !q || finite(q.lat) !== finite(p.home.lat)) return false;
		p.position = q; dirty = true; return true;
	}
	function setMode(id, mode, task = null) {
		const p = get(id); if (!p || !MODES.has(mode)) return false;
		p.mode = mode; p.task = task ? copy(task) : null; changed(); return true;
	}
	function tick() {
		const t = now(), n = state.events.length;
		state.events = state.events.filter(e => e.expires > t);
		if (n !== state.events.length) changed();
	}
	function warn(id, { radius = 120, severity = 0.65 } = {}) {
		const p = get(id); if (!p) return { ok: false, reason: 'Unknown resident' };
		const t = now(); tick();
		if (finite(p.lastWarning) && t - p.lastWarning < 30000) return { ok: false, reason: 'I am already passing on that warning. Give people a moment.' };
		if (state.events.some(e => e.bodyKey === p.bodyKey && socialDistance(e.position, p.position) <= e.radius)) return { ok: false, reason: 'People nearby are already responding to a warning.' };
		radius = finite(radius) ? Math.max(1, Math.min(120, radius)) : 120;
		severity = finite(severity) ? Math.max(0, Math.min(1, severity)) : 0.65;
		const recipients = list(p.bodyKey).filter(q => q.id !== id && socialDistance(q.position, p.position) <= radius).sort((a, b) => socialDistance(a.position, p.position) - socialDistance(b.position, p.position)).slice(0, 8).map(q => q.id);
		const event = { id: JSON.stringify([id, t, state.revision]), bodyKey: p.bodyKey, sourceId: id, position: copy(p.position), radius, severity, at: t, expires: t + 120000, recipients };
		state.events.push(event); p.lastWarning = t;
		remember(id, 'event', 'You agreed to warn the nearby residents.'); changed();
		return { ok: true, event };
	}
	function calm(id) {
		const p = get(id); if (!p) return { ok: false, reason: 'Unknown resident' };
		const events = state.events.filter(e => e.bodyKey === p.bodyKey && socialDistance(e.position, p.position) <= e.radius);
		if (!events.length) return { ok: false, reason: 'There is no active warning here.' };
		const ids = new Set(events.map(e => e.id)); state.events = state.events.filter(e => !ids.has(e.id));
		remember(id, 'event', 'You gave the local all clear.'); changed(); return { ok: true };
	}
	function alarmFor(bodyKey, pos) {
		let result = { level: 0, recipients: [] };
		const t = now();
		for (const e of state.events) {
			if (e.bodyKey !== bodyKey || e.expires <= t || t < e.at) continue;
			const elapsed = (t - e.at) / 1000, reach = Math.min(e.radius, 8 + elapsed * 8);
			if (socialDistance(e.position, pos) > reach) continue;
			const level = e.severity * Math.max(0, Math.min(1, (e.expires - t) / 120000));
			if (level > result.level) result = { level, eventId: e.id, sourceId: e.sourceId, recipients: e.recipients.slice(0, Math.floor(elapsed)), position: copy(e.position), radius: e.radius };
		}
		return result;
	}
	return { meet, get, list, remember, setPosition, setMode, save, flush: save, warn, calm, alarmFor, tick, status: () => ({ dirty, error, savedAt, recovered, residents: list().length, revision: state.revision }) };
}
