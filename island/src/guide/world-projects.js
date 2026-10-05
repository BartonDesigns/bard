// Persistent world-development rewards for story quests.
//
// This is deliberately a local preview ledger. It gives the renderer, Guide and
// NPCs one stable, idempotent seam for visible world projects while BR-006's
// authoritative shared backend is still pending. Do not describe this storage as
// universal multiplayer progress: it belongs to the current browser/player.

export const WORLD_PROJECTS_KEY = 'crysis-world-projects-v1';
export const WORLD_PROJECTS_SCOPE = 'private-preview';
export const WORLD_PROJECTS_BACKEND = 'br-006-shared-backend-pending';

const VERSION = 1;
const PROJECT_KINDS = Object.freeze({
	path: Object.freeze({
		kind: 'path',
		label: 'A safer path takes shape',
		benefit: 'A worn route is marked and easier to follow when you return.',
		verb: 'repair the route',
	}),
	garden: Object.freeze({
		kind: 'garden',
		label: 'The garden comes back to life',
		benefit: 'A neglected patch is restored for residents and small wildlife.',
		verb: 'restore the garden',
	}),
	gathering: Object.freeze({
		kind: 'gathering',
		label: 'A gathering place opens up',
		benefit: 'A useful meeting point is made ready for the people who live nearby.',
		verb: 'open the gathering place',
	}),
	resonance: Object.freeze({
		kind: 'resonance',
		label: 'The place begins to answer in music',
		benefit: 'A faint reactive glow and musical response now mark the site.',
		verb: 'awaken the resonance',
	}),
});

const PROJECT_ORDER = Object.freeze(Object.keys(PROJECT_KINDS));
const copy = (v) => JSON.parse(JSON.stringify(v));
const text = (v, max = 512) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '';
const id = (v) => text(v, 512);
const finite = (v) => Number.isFinite(v);
const cleanBody = (v) => id(v);
const cleanScope = (v) => v === WORLD_PROJECTS_SCOPE ? v : WORLD_PROJECTS_SCOPE;
const fail = (error) => ({ ok: false, error });

function hash(value) {
	let h = 2166136261;
	for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return (h >>> 0).toString(36);
}

function projectId(bodyKey, targetId) {
	return `world-project:${hash(`${bodyKey}\u0000${targetId}`)}`;
}

function blueprintFor(targetId) {
	const n = String(targetId).toLowerCase();
	// Stable target hints make the same place feel authored without allowing an
	// LLM to choose arbitrary effects or inject a new world capability.
	if (/cave|reson|music|stone|echo|song|shrine|chapel/.test(n)) return PROJECT_KINDS.resonance;
	if (/garden|park|grove|forest|meadow|field|farm|orchard/.test(n)) return PROJECT_KINDS.garden;
	if (/village|square|market|plaza|home|town|gather/.test(n)) return PROJECT_KINDS.gathering;
	return PROJECT_KINDS[PROJECT_ORDER[parseInt(hash(targetId), 36) % PROJECT_ORDER.length]];
}

function targetFromQuest(quest, target = {}) {
	const step = (quest?.steps || []).find((s) => s && ['visit', 'return', 'scout'].includes(s.type) && id(s.targetId));
	if (!step) return null;
	const targetId = id(step.targetId);
	const name = text(target.name, 160) || text(step.targetName, 160) || targetId;
	const anchor = {};
	for (const k of ['x', 'y', 'z', 'radius']) if (finite(target[k])) anchor[k] = target[k];
	return { targetId, name, anchor };
}

function validProject(p) {
	return !!p && id(p.id) && id(p.bodyKey) && id(p.targetId) && id(p.kind) && id(p.label) && id(p.benefit)
		&& p.scope === WORLD_PROJECTS_SCOPE && p.shared === false && p.backend === WORLD_PROJECTS_BACKEND
		&& p.status === 'complete' && p.stage === 'visible'
		&& Number.isFinite(p.createdAt) && Number.isFinite(p.updatedAt)
		&& (!p.questId || id(p.questId)) && (!p.targetName || text(p.targetName, 160))
		&& (!p.anchor || typeof p.anchor === 'object')
		&& Object.values(p.anchor || {}).every(finite);
}

function validData(data) {
	if (!data || data.version !== VERSION || data.scope !== WORLD_PROJECTS_SCOPE || data.shared !== false || data.backend !== WORLD_PROJECTS_BACKEND || !data.worlds || typeof data.worlds !== 'object') return false;
	for (const [bodyKey, world] of Object.entries(data.worlds)) {
		if (!id(bodyKey) || !world || !Array.isArray(world.projects) || world.projects.length > 96) return false;
		const seen = new Set();
		for (const p of world.projects) {
			if (!validProject(p) || p.bodyKey !== bodyKey || seen.has(p.id)) return false;
			seen.add(p.id);
		}
	}
	return true;
}

export function projectForQuest(quest, target = {}) {
	if (!quest || quest.status !== 'complete' || !id(quest.id) || !id(quest.bodyKey)) return null;
	const place = targetFromQuest(quest, target);
	if (!place) return null;
	const blueprint = blueprintFor(place.targetId);
	return {
		id: projectId(quest.bodyKey, place.targetId),
		bodyKey: quest.bodyKey,
		targetId: place.targetId,
		targetName: place.name,
		kind: blueprint.kind,
		label: blueprint.label,
		benefit: blueprint.benefit,
		status: 'complete',
		stage: 'visible',
		scope: WORLD_PROJECTS_SCOPE,
		shared: false,
		backend: WORLD_PROJECTS_BACKEND,
		questId: id(quest.id),
		anchor: place.anchor,
	};
}

export function createWorldProjects({ storage, now = Date.now } = {}) {
	if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
	let data = { version: VERSION, scope: WORLD_PROJECTS_SCOPE, shared: false, backend: WORLD_PROJECTS_BACKEND, worlds: {} };
	let error = null;
	let blocked = false;
	try {
		const raw = storage?.getItem(WORLD_PROJECTS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (raw.length > 1000000 || !validData(parsed)) throw Error('Invalid world project save');
			data = parsed;
		}
	} catch {
		error = 'Saved world development could not be read; it has been preserved.';
		blocked = true;
	}
	function save() {
		if (blocked) return false;
		try {
			if (!storage) throw Error('No storage');
			storage.setItem(WORLD_PROJECTS_KEY, JSON.stringify(data));
			error = null;
			return true;
		} catch {
			error = 'World development is available this session, but this browser could not save it.';
			return false;
		}
	}
	function bucket(bodyKey, create = false) {
		bodyKey = cleanBody(bodyKey);
		if (!bodyKey) return null;
		if (!data.worlds[bodyKey] && create) data.worlds[bodyKey] = { projects: [] };
		return data.worlds[bodyKey] || null;
	}
	function list(bodyKey) {
		const world = bucket(bodyKey);
		return copy(world?.projects || []);
	}
	function complete(quest, target = {}) {
		const proposed = projectForQuest(quest, target);
		if (!proposed) return fail('This quest has no supported world-development target.');
		const world = bucket(proposed.bodyKey, true);
		const existing = world.projects.find((p) => p.id === proposed.id);
		if (existing) return { ok: true, idempotent: true, persisted: true, project: copy(existing), scope: WORLD_PROJECTS_SCOPE, shared: false };
		const at = Number.isFinite(now()) ? now() : Date.now();
		const project = { ...proposed, createdAt: at, updatedAt: at };
		world.projects.push(project);
		// Bounded local ledger: completed projects remain visible; the oldest are
		// discarded only after the hard cap, never on quest cancellation/retry.
		if (world.projects.length > 96) world.projects.splice(0, world.projects.length - 96);
		const persisted = save();
		return { ok: true, idempotent: false, persisted, project: copy(project), scope: WORLD_PROJECTS_SCOPE, shared: false };
	}
	function state(bodyKey) {
		return { scope: WORLD_PROJECTS_SCOPE, shared: false, backend: WORLD_PROJECTS_BACKEND, projects: list(bodyKey), error, blocked };
	}
	function status() {
		const worlds = Object.values(data.worlds);
		return { scope: WORLD_PROJECTS_SCOPE, shared: false, backend: WORLD_PROJECTS_BACKEND, worlds: worlds.length, projects: worlds.reduce((n, w) => n + w.projects.length, 0), error, blocked };
	}
	return { complete, list, state, status, save, scope: WORLD_PROJECTS_SCOPE, shared: false, backend: WORLD_PROJECTS_BACKEND };
}

export const worldProjectBlueprints = () => copy(PROJECT_KINDS);

