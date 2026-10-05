// A deliberately small seam for authoritative, shared world development.
//
// This module does not make localStorage multiplayer. Browser storage is only
// an outbox/cursor cache; a remote provider must acknowledge an event with a
// server version before the client exposes it as shared progress. Dialogue,
// memories and other private NPC records are rejected at the public-event
// boundary and never belong in this protocol.

export const WORLD_PROGRESS_SCHEMA = 1;
export const WORLD_PROGRESS_KEY = 'crysis-world-progress-v1';

const EVENT_KINDS = new Set(['contribution', 'stage', 'effect']);
const PRIVATE_KEY = /(?:dialog|conversation|transcript|history|memory|prompt|token|secret|password|email|phone|address|private|mature|chat|utterance|message)/i;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
const MAX_PAYLOAD_BYTES = 4096;
const MAX_PENDING = 128;
const MAX_RECEIVED = 256;

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const text = (value, max = 160) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
const id = (value, label) => {
	if (!text(value, 160) || !ID.test(value)) throw Error(`Invalid ${label}`);
	return value;
};
const cursor = value => {
	if (value === undefined || value === null) return '0';
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
	if (typeof value === 'string' && /^[0-9A-Za-z._:-]{1,160}$/.test(value)) return value;
	throw Error('Invalid world progress cursor');
};
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;

function checkPublicValue(value, depth = 0) {
	if (depth > 4) throw Error('World event payload is too deeply nested');
	if (value === null || typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		if (value.length > 320 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw Error('World event payload contains invalid text');
		return value;
	}
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || Math.abs(value) > 1e9) throw Error('World event payload contains an invalid number');
		return value;
	}
	if (Array.isArray(value)) {
		if (value.length > 32) throw Error('World event payload array is too large');
		return value.map(item => checkPublicValue(item, depth + 1));
	}
	if (typeof value !== 'object') throw Error('World event payload contains an unsupported value');
	const out = {};
	for (const [key, item] of Object.entries(value)) {
		if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/.test(key) || PRIVATE_KEY.test(key)) throw Error(`Private or invalid world event field: ${key}`);
		out[key] = checkPublicValue(item, depth + 1);
	}
	return out;
}

function publicPayload(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('World event payload must be an object');
	const clean = checkPublicValue(value);
	if (bytes(clean) > MAX_PAYLOAD_BYTES) throw Error('World event payload is too large');
	return clean;
}

function clientEvent(input = {}) {
	const worldId = id(input.worldId, 'world id');
	const projectId = id(input.projectId, 'project id');
	const actorId = id(input.actorId, 'actor id');
	const eventId = id(input.eventId, 'event id');
	const kind = text(input.kind, 40);
	if (!EVENT_KINDS.has(kind)) throw Error('Unsupported world event kind');
	if (!Number.isSafeInteger(input.clientSequence) || input.clientSequence < 1) throw Error('Invalid client event sequence');
	const out = {
		schema: WORLD_PROGRESS_SCHEMA,
		eventId,
		worldId,
		projectId,
		actorId,
		kind,
		clientSequence: input.clientSequence,
		payload: publicPayload(input.payload),
	};
	if (input.clientAt !== undefined) {
		if (!Number.isSafeInteger(input.clientAt) || input.clientAt < 0) throw Error('Invalid client event time');
		out.clientAt = input.clientAt;
	}
	return out;
}

function serverEvent(input, expected = {}) {
	const event = clientEvent(input);
	if (expected.worldId && event.worldId !== expected.worldId) throw Error('Server event belongs to another world');
	if (!Number.isSafeInteger(input.serverVersion) || input.serverVersion < 1) throw Error('Missing server event version');
	if (!Number.isSafeInteger(input.serverAt) || input.serverAt < 0) throw Error('Missing server event time');
	return { ...event, serverVersion: input.serverVersion, serverAt: input.serverAt };
}

function responseShape(response, worldId) {
	if (!response || typeof response !== 'object' || response.schema !== WORLD_PROGRESS_SCHEMA || response.worldId !== worldId) throw Error('Invalid world progress provider response');
	const accepted = Array.isArray(response.accepted) ? response.accepted.map(event => serverEvent(event, { worldId })) : [];
	const events = Array.isArray(response.events) ? response.events.map(event => serverEvent(event, { worldId })) : [];
	const rejected = Array.isArray(response.rejected) ? response.rejected.map(item => {
		if (!item || !text(item.eventId, 160) || !text(item.code, 80)) throw Error('Invalid world progress rejection');
		return { eventId: item.eventId, code: item.code };
	}) : [];
	return { schema: WORLD_PROGRESS_SCHEMA, worldId, cursor: cursor(response.cursor), accepted, events, rejected };
}

function memoryState(storage, now, identity) {
	let state = { schema: WORLD_PROGRESS_SCHEMA, cursor: '0', nextSequence: 1, pending: [], received: [], rejected: [] };
	let blocked = false;
	if (storage) {
		try {
			const raw = storage.getItem(WORLD_PROGRESS_KEY);
			if (raw) {
				const loaded = JSON.parse(raw);
				if (loaded?.schema !== WORLD_PROGRESS_SCHEMA || !Array.isArray(loaded.pending) || !Array.isArray(loaded.received) || !Number.isSafeInteger(loaded.nextSequence) || loaded.nextSequence < 1) throw Error('Invalid world progress cache');
				const pending = loaded.pending.slice(-MAX_PENDING).map(event => clientEvent(event));
				if (pending.some(event => event.worldId !== identity.worldId || event.actorId !== identity.actorId)) throw Error('World progress cache belongs to another actor or world');
				const received = loaded.received.slice(-MAX_RECEIVED).map(event => serverEvent(event, { worldId: identity.worldId }));
				state = { ...state, ...loaded, pending, received, rejected: Array.isArray(loaded.rejected) ? loaded.rejected.slice(-MAX_PENDING) : [] };
			}
		} catch {
			// Never discard a corrupt cache. Keeping the new session in memory is
			// safer than overwriting evidence that may be exported by the owner.
			blocked = true;
		}
	}
	function save() {
		if (!storage || blocked) return false;
		try { storage.setItem(WORLD_PROGRESS_KEY, JSON.stringify({ ...state, savedAt: now() })); return true; } catch { return false; }
	}
	return { state, save, blocked };
}

/**
 * A provider that intentionally never claims to synchronize. It is useful as
 * the default in offline play and in tests, but its mode is always `offline`.
 */
export function createOfflineWorldProgressProvider() {
	return {
		mode: 'offline',
		async append({ worldId }) { return { schema: WORLD_PROGRESS_SCHEMA, worldId, cursor: '0', accepted: [], events: [], rejected: [] }; },
		async catchUp({ worldId, cursor: after = '0' }) { return { schema: WORLD_PROGRESS_SCHEMA, worldId, cursor: after, accepted: [], events: [], rejected: [] }; },
	};
}

/**
 * HTTP adapter for the future authoritative Worker endpoint. The current
 * discovery Worker does not implement this route. No credentials are read or
 * invented here; callers may provide a header factory when the backend has an
 * authenticated deployment.
 */
export function createWorldProgressHttpProvider({ baseURL, fetch: fetcher = globalThis.fetch?.bind(globalThis), headers = {}, appendPath = '/v1/world-progress/events', catchUpPath = '/v1/world-progress/events' } = {}) {
	if (typeof baseURL !== 'string' || !baseURL.trim()) throw Error('World progress provider needs an explicit base URL');
	if (typeof fetcher !== 'function') throw Error('World progress provider needs fetch');
	const root = baseURL.replace(/\/$/, '');
	async function authHeaders() {
		const extra = typeof headers === 'function' ? await headers() : headers;
		if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw Error('Invalid world progress headers');
		return { ...extra };
	}
	async function request(path, init = {}) {
		const response = await fetcher(root + path, { ...init, headers: { 'content-type': 'application/json', ...(await authHeaders()), ...(init.headers || {}) } });
		const body = await response.json().catch(() => null);
		if (!response.ok) throw Error(`World progress provider returned HTTP ${response.status}`);
		return body;
	}
	return {
		mode: 'remote',
		append: async ({ worldId, cursor: after = '0', events }) => responseShape(await request(appendPath, { method: 'POST', body: JSON.stringify({ schema: WORLD_PROGRESS_SCHEMA, worldId, cursor: after, events }) }), worldId),
		catchUp: async ({ worldId, cursor: after = '0' }) => {
			const query = `?worldId=${encodeURIComponent(worldId)}&after=${encodeURIComponent(after)}`;
			return responseShape(await request(catchUpPath + query), worldId);
		},
	};
}

/**
 * Create a client-side outbox/catch-up seam. Only server-acknowledged events
 * are emitted to subscribers. The local cache is private to this browser and
 * is never a substitute for the provider's authoritative state.
 */
export function createWorldProgressClient({ worldId, actorId, provider = createOfflineWorldProgressProvider(), storage, now = Date.now, onEvent = null } = {}) {
	worldId = id(worldId, 'world id'); actorId = id(actorId, 'actor id');
	if (!provider || typeof provider.append !== 'function' || typeof provider.catchUp !== 'function') throw Error('World progress provider must implement append and catchUp');
	const cache = memoryState(storage, now, { worldId, actorId }), state = cache.state, listeners = new Set(), seen = new Set(state.received.map(event => event.eventId));
	if (typeof onEvent === 'function') listeners.add(onEvent);
	let busy = Promise.resolve();
	const emit = event => { if (seen.has(event.eventId)) return false; seen.add(event.eventId); state.received.push(clone(event)); state.received = state.received.slice(-MAX_RECEIVED); for (const listener of listeners) { try { listener(clone(event)); } catch { /* A listener cannot break synchronization. */ } } return true; };
	const applyResponse = response => {
		const clean = responseShape(response, worldId);
		for (const event of clean.accepted) if (event.actorId !== actorId) throw Error('Provider acknowledged another actor event');
		for (const event of [...clean.events, ...clean.accepted]) emit(event);
		const accepted = new Set(clean.accepted.map(event => event.eventId));
		const rejected = new Map(clean.rejected.map(item => [item.eventId, item.code]));
		if (accepted.size || rejected.size) {
			state.pending = state.pending.filter(event => !accepted.has(event.eventId) && !rejected.has(event.eventId));
			for (const [eventId, code] of rejected) state.rejected.push({ eventId, code, at: now() });
			state.rejected = state.rejected.slice(-MAX_PENDING);
		}
		state.cursor = clean.cursor; cache.save();
		return clean;
	};
	function queue(input = {}) {
		const sequence = input.clientSequence ?? state.nextSequence;
		const event = clientEvent({ ...input, worldId, actorId, clientSequence: sequence, eventId: input.eventId || `${worldId}:${actorId}:${sequence}` });
		if (state.pending.some(item => item.eventId === event.eventId) || seen.has(event.eventId)) return { ok: true, duplicate: true, event: clone(event), pending: state.pending.length };
		state.nextSequence = Math.max(state.nextSequence + 1, event.clientSequence + 1);
		if (state.pending.length >= MAX_PENDING) return { ok: false, error: 'The offline world-progress outbox is full; reconnect before adding more.', event: clone(event), pending: state.pending.length };
		state.pending.push(event); cache.save();
		return { ok: true, duplicate: false, event: clone(event), pending: state.pending.length };
	}
	async function sync() {
		const run = async () => {
			const result = await provider.catchUp({ worldId, cursor: state.cursor });
			return applyResponse(result);
		};
		busy = busy.then(run, run); return busy;
	}
	async function flush() {
		const run = async () => {
			if (provider.mode === 'offline') return { ok: false, status: 'offline', pending: state.pending.length, cursor: state.cursor };
			const result = await provider.append({ worldId, actorId, cursor: state.cursor, events: state.pending.map(clone) });
			const clean = applyResponse(result);
			return { ok: true, status: 'synced', accepted: clean.accepted.length, rejected: clean.rejected.length, pending: state.pending.length, cursor: state.cursor };
		};
		busy = busy.then(run, run); return busy;
	}
	return {
		queue, sync, flush,
		subscribe(listener) { if (typeof listener !== 'function') throw Error('World progress subscriber must be a function'); listeners.add(listener); return () => listeners.delete(listener); },
		pending: () => state.pending.map(clone),
		received: () => state.received.map(clone),
		status: () => ({ mode: provider.mode || 'custom', authoritative: provider.mode === 'remote', cursor: state.cursor, pending: state.pending.length, received: state.received.length, rejected: state.rejected.length, storageBlocked: cache.blocked }),
		privateData: () => ({ pending: state.pending.length, received: state.received.length }),
	};
}

export function validateWorldProgressEvent(event, { worldId, server = false } = {}) {
	return server ? serverEvent(event, { worldId }) : clientEvent(event);
}

export const worldProgressKinds = () => [...EVENT_KINDS];
