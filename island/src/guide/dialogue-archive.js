// Full, player-local dialogue history. Model context is deliberately managed elsewhere.
const KEY = 'crysis-dialogue-archive-v1';
const BACKUP = KEY + '-backup';
const roles = new Set(['user', 'assistant', 'event']);
const clone = value => JSON.parse(JSON.stringify(value));
export function createDialogueArchive(options = {}) {
	let storage = options.storage;
	if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
	const now = options.now || Date.now;
	let state = { version: 1, sequence: 0, threads: {} }, dirty = false, error = null, recovered = false, blocked = false, lastGood = null;
	function decode(raw) {
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (data?.version !== 1 || !Number.isSafeInteger(data.sequence) || data.sequence < 0 || !data.threads || typeof data.threads !== 'object' || Array.isArray(data.threads)) throw Error('Unrecognized dialogue archive');
		for (const [id, thread] of Object.entries(data.threads)) {
			if (!thread || thread.id !== id || typeof thread.name !== 'string' || !Array.isArray(thread.turns)) throw Error('Invalid dialogue thread');
			for (const turn of thread.turns) if (!turn || typeof turn.id !== 'string' || !roles.has(turn.role) || typeof turn.content !== 'string' || !Number.isFinite(turn.at)) throw Error('Invalid archived dialogue');
		}
		return data;
	}
	try {
		const raw = storage?.getItem(KEY), loaded = decode(raw);
		if (loaded) { state = loaded; lastGood = raw; }
	} catch (e) {
		error = String(e.message || e); blocked = true;
		try {
			const raw = storage?.getItem(BACKUP), loaded = decode(raw);
			if (loaded) { state = loaded; lastGood = raw; recovered = true; blocked = false; }
		} catch { /* Preserve original bytes for recovery. */ }
	}
	function save() {
		if (!dirty) return !error;
		try {
			if (!storage) throw Error('Browser storage unavailable; new dialogue is only in memory. Export it before leaving.');
			if (blocked) throw Error('Existing dialogue archive could not be read and was preserved. New dialogue is only in memory; export it before leaving.');
			const next = { ...state, savedAt: now() }, raw = JSON.stringify(next);
			if (lastGood) storage.setItem(BACKUP, lastGood);
			storage.setItem(KEY, raw);
			state.savedAt = next.savedAt; lastGood = raw; dirty = false; error = null;
			return true;
		} catch (e) {
			error = `Dialogue could not be saved: ${String(e.message || e)} No turns were deleted. Export your history before leaving.`;
			return false;
		}
	}
	function ensure(meta) {
		if (!meta || typeof meta.id !== 'string' || !meta.id) throw Error('Dialogue requires a stable thread id');
		let thread = Object.hasOwn(state.threads, meta.id) ? state.threads[meta.id] : null;
		if (!thread) {
			thread = { id: meta.id, name: String(meta.name || 'Unknown person'), bodyKey: String(meta.bodyKey || ''), kind: meta.kind === 'guide' ? 'guide' : 'npc', createdAt: now(), updatedAt: now(), turns: [] };
			Object.defineProperty(state.threads, meta.id, { value: thread, enumerable: true, writable: true, configurable: true });
		}
		if (meta.name) thread.name = String(meta.name);
		if (meta.bodyKey !== undefined) thread.bodyKey = String(meta.bodyKey);
		return thread;
	}
	function line(role, content, at) {
		if (role === 'system') role = 'event';
		if (!roles.has(role)) throw Error('Invalid dialogue role');
		return { id: String(++state.sequence), role, content: String(content), at: Number.isFinite(at) ? at : now() };
	}
	function append(meta, role, content, detail = {}) {
		// Validate first so invalid input cannot create an empty thread.
		if (!roles.has(role) && role !== 'system') throw Error('Invalid dialogue role');
		const thread = ensure(meta), turn = line(role, content, detail.at);
		thread.turns.push(turn); thread.updatedAt = now(); dirty = true; save();
		return clone(turn);
	}
	function importHistory(meta, history = []) {
		const thread = ensure(meta);
		if (thread.importedHistory) return 0;
		const imported = history.filter(turn => turn && (roles.has(turn.role) || turn.role === 'system') && typeof turn.content === 'string').map(turn => line(turn.role, turn.content, turn.at));
		// Migration happens once per identity. Previously discarded old context cannot be recovered.
		thread.turns = [...imported, ...thread.turns]; thread.importedHistory = true;
		thread.updatedAt = now(); dirty = true; save(); return imported.length;
	}
	const get = id => Object.hasOwn(state.threads, id) ? state.threads[id] : null;
	const threads = () => Object.values(state.threads).sort((a, b) => b.updatedAt - a.updatedAt).map(thread => ({ ...clone(thread), turns: clone(thread.turns) }));
	function search(query = '', { threadId, limit = 200, offset = 0 } = {}) {
		const needle = String(query).trim().toLocaleLowerCase();
		const hits = [];
		for (const thread of Object.values(state.threads)) {
			if (threadId !== undefined && thread.id !== threadId) continue;
			const nameMatches = thread.name.toLocaleLowerCase().includes(needle);
			thread.turns.forEach((turn, index) => {
				if (nameMatches || turn.content.toLocaleLowerCase().includes(needle)) hits.push({ threadId: thread.id, name: thread.name, bodyKey: thread.bodyKey, kind: thread.kind, turn: clone(turn), index });
			});
		}
		hits.sort((a, b) => b.turn.at - a.turn.at || Number(b.turn.id) - Number(a.turn.id));
		return hits.slice(Math.max(0, offset), Math.max(0, offset) + Math.max(0, limit));
	}
	return {
		append, importHistory, threads, search, save,
		thread: id => get(id) ? clone(get(id)) : null,
		status: () => ({ dirty, error, recovered, savedAt: state.savedAt || null, threads: Object.keys(state.threads).length, turns: Object.values(state.threads).reduce((sum, thread) => sum + thread.turns.length, 0) }),
		exportJSON: () => JSON.stringify(state, null, 2),
	};
}
