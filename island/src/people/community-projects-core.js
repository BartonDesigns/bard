// Shared, deterministic community-project ledger. This module has no clock,
// renderer, storage, wallet or model. Only trusted adapters submit observations;
// neither prose nor elapsed absence can invent a contribution or a source site.

export const COMMUNITY_FEATURE = 'world-projects-v1';
export const PROJECT_VERSION = 1;
export const PROJECT_DELAY_MS = 24 * 60 * 60 * 1000;
export const PROJECT_WORK_MS = 30 * 1000;
export const PROJECT_LIMITS = Object.freeze({ projects: 64, events: 160, history: 40, work: 3 });
const KINDS = new Set(['path', 'garden', 'gathering', 'resonance']);
const EVIDENCE_KINDS = new Set(['survey', 'work', 'service']);
const PROVENANCE = new Set(['player-observed', 'npc-observed', 'server-verified']);
const STATUS = new Set(['surveying', 'preparing', 'building', 'completed']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) &&
	(Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const copy = (v) => JSON.parse(JSON.stringify(v));
const validTime = (v) => Number.isSafeInteger(v) && v >= 0;
const validClock = (v) => validTime(v) && v <= Number.MAX_SAFE_INTEGER - PROJECT_DELAY_MS;
const fields = (o, allowed) => object(o) && Object.keys(o).every((k) => allowed.includes(k));
function key(v) {
	if (typeof v !== 'string' || !v.length || v.length > 160 || v !== v.trim() ||
		['__proto__', 'constructor', 'prototype'].includes(v) || /[\u0000-\u001f\u007f]/.test(v)) return false;
	try { encodeURIComponent(v); return true; } catch { return false; }
}
const name = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 180 && !/[\u0000-\u001f\u007f]/.test(v);
const anchor = (v) => fields(v, ['x', 'y', 'z', 'lat', 'lon']) && ['x', 'y', 'z'].every((axis) =>
	Number.isFinite(v[axis]) && Math.abs(v[axis]) <= 1e12) &&
	(!own(v, 'lat') && !own(v, 'lon') || Number.isFinite(v.lat) && Math.abs(v.lat) <= 90 && Number.isFinite(v.lon) && Math.abs(v.lon) <= 180);
// On Earth the geographic position is stable while the renderer's local frame
// changes. A repeated observation must not move or duplicate the source site.
const sameAnchor = (a, b) => own(a, 'lat') && own(b, 'lat') ? Math.abs(a.lat - b.lat) <= 1e-7 && Math.abs(a.lon - b.lon) <= 1e-7 :
	!own(a, 'lat') && !own(b, 'lat') && a.x === b.x && a.y === b.y && a.z === b.z;
const scopeKey = (world, region) => `${encodeURIComponent(world)}:${encodeURIComponent(region)}`;

export function projectKey(world, region, siteId) {
	if (!key(world) || !key(region) || !key(siteId)) throw new TypeError('Valid world, region and source site IDs are required.');
	return `project:${scopeKey(world, region)}:${encodeURIComponent(siteId)}`;
}

export function createProjectState({ world, region, now = 0 } = {}) {
	if (!key(world) || !key(region)) throw new TypeError('Valid world and region IDs are required.');
	if (!validClock(now)) throw new TypeError('now must be a nonnegative millisecond timestamp with room for the build delay.');
	return {
		version: PROJECT_VERSION, key: scopeKey(world, region), world, region,
		createdAt: now, updatedAt: now, lastAdvancedAt: now, revision: 0, sequence: 0,
		projects: {}, receipts: {}, events: [], situation: { hazard: 0, blockedSites: [] },
	};
}

function validSituation(v) {
	return fields(v, ['hazard', 'blockedSites']) &&
		(v.hazard === undefined || Number.isFinite(v.hazard) && v.hazard >= 0 && v.hazard <= 1) &&
		(v.blockedSites === undefined || Array.isArray(v.blockedSites) && v.blockedSites.length <= 256 && v.blockedSites.every(key));
}
function situationOf(v) {
	return { hazard: v.hazard ?? 0, blockedSites: [...new Set(v.blockedSites || [])].sort() };
}
function blocked(s, p) {
	if (s.situation.blockedSites.includes(p.siteId)) return 'site-inaccessible';
	if (s.situation.hazard >= 0.6) return 'local-emergency';
	return null;
}
function validProject(p, s, id) {
	return object(p) && key(p.siteId) && id === projectKey(s.world, s.region, p.siteId) && p.id === id &&
		p.world === s.world && p.region === s.region && name(p.name) && KINDS.has(p.kind) && anchor(p.anchor) &&
		key(p.createdBy) && (p.npcId === null || key(p.npcId)) && (p.npcName === null || name(p.npcName) && key(p.npcId)) &&
		STATUS.has(p.status) && Number.isInteger(p.surveyCount) && p.surveyCount >= 0 && p.surveyCount <= 1 &&
		Number.isInteger(p.workCount) && p.workCount >= 0 && p.workCount <= PROJECT_LIMITS.work &&
		p.requiredWork === PROJECT_LIMITS.work && p.contributionCount === p.surveyCount + p.workCount &&
		Array.isArray(p.contributors) && p.contributors.length <= PROJECT_LIMITS.work + 1 &&
		p.contributors.every((c) => object(c) && key(c.actorId) &&
			Number.isInteger(c.surveyCount) && c.surveyCount >= 0 && c.surveyCount <= 1 &&
			Number.isInteger(c.workCount) && c.workCount >= 0 && c.workCount <= PROJECT_LIMITS.work &&
			Number.isInteger(c.serviceCount) && c.serviceCount >= 0 && c.serviceCount <= c.workCount) &&
		new Set(p.contributors.map((c) => c.actorId)).size === p.contributors.length &&
		p.contributors.reduce((n, c) => n + c.surveyCount, 0) === p.surveyCount &&
		p.contributors.reduce((n, c) => n + c.workCount, 0) === p.workCount &&
		Array.isArray(p.history) && p.history.length <= PROJECT_LIMITS.history &&
		[null, 'local-emergency', 'site-inaccessible'].includes(p.blockedReason) &&
		validTime(p.createdAt) && validTime(p.updatedAt) &&
		p.createdAt >= s.createdAt && p.updatedAt >= p.createdAt && p.updatedAt <= s.updatedAt &&
		(p.readyAt === null || validTime(p.readyAt) && p.readyAt >= p.createdAt + PROJECT_DELAY_MS) &&
		(p.completedAt === null || validTime(p.completedAt) && p.completedAt >= p.readyAt && p.completedAt <= p.updatedAt) &&
		(p.status === 'surveying' ? p.surveyCount === 0 && p.readyAt === null && p.completedAt === null :
			p.status === 'preparing' ? p.surveyCount === 1 && p.workCount < PROJECT_LIMITS.work && p.readyAt === null && p.completedAt === null :
			p.surveyCount === 1 && p.workCount === PROJECT_LIMITS.work && p.readyAt !== null &&
				(p.status === 'building' ? p.completedAt === null : p.completedAt !== null && p.blockedReason === null));
}
function validReceipt(r, s, id) {
	return key(id) && object(r) && r.id === id && own(s.projects, r.projectId) && key(r.actorId) &&
		EVIDENCE_KINDS.has(r.kind) && PROVENANCE.has(r.provenance) &&
		(r.sourceId === null ? r.kind !== 'service' : key(r.sourceId)) &&
		(r.beneficiaryId === null || key(r.beneficiaryId)) && validTime(r.at) && r.at >= s.projects[r.projectId].createdAt && r.at <= s.updatedAt;
}
function validState(s) {
	return object(s) && s.version === PROJECT_VERSION && key(s.world) && key(s.region) && s.key === scopeKey(s.world, s.region) &&
		validTime(s.createdAt) && validTime(s.updatedAt) && validTime(s.lastAdvancedAt) &&
		s.createdAt <= s.updatedAt && s.lastAdvancedAt <= s.updatedAt &&
		Number.isSafeInteger(s.revision) && s.revision >= 0 && Number.isSafeInteger(s.sequence) && s.sequence >= 0 &&
		object(s.projects) && Object.keys(s.projects).length <= PROJECT_LIMITS.projects &&
		Object.entries(s.projects).every(([id, p]) => validProject(p, s, id)) &&
		object(s.receipts) && Object.keys(s.receipts).length <= PROJECT_LIMITS.projects * (PROJECT_LIMITS.work + 1) &&
		Object.entries(s.receipts).every(([id, r]) => validReceipt(r, s, id)) &&
		Object.keys(s.receipts).length === Object.values(s.projects).reduce((n, p) => n + p.contributionCount, 0) &&
		Array.isArray(s.events) && s.events.length <= PROJECT_LIMITS.events && validSituation(s.situation);
}

/**
 * propose { actorId, project: { siteId, name, kind, anchor, npcId?, npcName? }, now }
 * contribute { projectId, actorId, evidence: { id, kind, sourceId?, beneficiaryId? }, provenance?, now }
 * advance { now, situation?: { hazard, blockedSites } }
 *
 * world/region may be supplied on all commands and must match the state. The
 * authenticated adapter supplies time and actor identity, validates real sites,
 * and validates/times each observation before calling contribute. Receipt IDs
 * are retained permanently, including after completion. No input amount, price,
 * readyAt, completion time or arbitrary world effect is accepted.
 *
 * One survey and three work/service receipts start a minimum one-day build.
 * Unsafe conditions block contributions, starting, and finalization. A delayed
 * finish remains visible; becoming safe never invents repairs or faster work.
 */
export function reduceProjects(state, command = {}) {
	const fail = (error) => ({ state, events: [], error });
	if (!validState(state)) return fail('invalid-state');
	if (!object(command)) return fail('invalid-command');
	if (own(command, 'world') && command.world !== state.world || own(command, 'region') && command.region !== state.region) return fail('scope-mismatch');
	if (!validClock(command.now)) return fail('invalid-time');
	const now = command.now;
	if (now < state.updatedAt) return fail('stale-command');
	const base = ['type', 'now', 'world', 'region'];
	const allowed = command.type === 'propose' ? [...base, 'actorId', 'project'] :
		command.type === 'contribute' ? [...base, 'actorId', 'projectId', 'evidence', 'provenance'] :
		command.type === 'advance' ? [...base, 'situation'] : null;
	if (!allowed) return fail('unknown-command');
	if (!fields(command, allowed)) return fail('invalid-command');
	if (command.type !== 'advance' && !key(command.actorId)) return fail('invalid-actor');
	const s = copy(state), events = [];
	const emit = (type, p, extra = {}) => {
		const event = {
			id: `${s.key}:project-event:${++s.sequence}`, at: now, type,
			world: s.world, region: s.region, projectId: p.id, siteId: p.siteId, ...extra,
		};
		events.push(event); s.events.push(event); p.history.push(event);
		if (s.events.length > PROJECT_LIMITS.events) s.events.splice(0, s.events.length - PROJECT_LIMITS.events);
		if (p.history.length > PROJECT_LIMITS.history) p.history.splice(0, p.history.length - PROJECT_LIMITS.history);
		p.updatedAt = now;
	};
	const result = (p) => {
		s.updatedAt = now; s.revision++;
		return { state: s, events, ...(p ? { project: p } : {}) };
	};
	const reconcile = (p, canComplete = false) => {
		if (p.status === 'completed') return;
		const reason = blocked(s, p);
		if (reason !== p.blockedReason) {
			p.blockedReason = reason;
			emit(reason ? 'project-paused' : 'project-resumed', p, { reason });
		}
		if (reason) return;
		if (p.surveyCount === 1 && p.workCount === PROJECT_LIMITS.work && p.status !== 'building') {
			p.status = 'building'; p.readyAt = now + PROJECT_DELAY_MS;
			emit('project-building', p, { readyAt: p.readyAt });
		}
		if (canComplete && p.status === 'building' && now >= p.readyAt) {
			p.status = 'completed'; p.completedAt = now;
			emit('project-completed', p);
		}
	};
	if (command.type === 'propose') {
		const d = command.project;
		if (!fields(d, ['siteId', 'name', 'kind', 'anchor', 'npcId', 'npcName']) || !key(d.siteId) || !name(d.name) ||
			!KINDS.has(d.kind) || !anchor(d.anchor) || (d.npcId !== undefined && !key(d.npcId)) ||
			(d.npcName !== undefined && (!name(d.npcName) || !key(d.npcId)))) return fail('invalid-project');
		const id = projectKey(s.world, s.region, d.siteId);
		if (own(s.projects, id)) {
			const old = s.projects[id];
			if (old.kind !== d.kind) return fail('project-kind-conflict');
			if (!sameAnchor(old.anchor, d.anchor)) return fail('project-location-conflict');
			return { state, events: [], project: state.projects[id] };
		}
		if (Object.keys(s.projects).length >= PROJECT_LIMITS.projects) return fail('project-capacity');
		const p = s.projects[id] = {
			id, world: s.world, region: s.region, siteId: d.siteId, name: d.name.trim(), kind: d.kind, anchor: copy(d.anchor),
			npcId: d.npcId || null, npcName: d.npcName?.trim() || null, createdBy: command.actorId,
			createdAt: now, updatedAt: now, status: 'surveying', surveyCount: 0, workCount: 0, requiredWork: PROJECT_LIMITS.work,
			readyAt: null, completedAt: null, blockedReason: null, contributors: [], contributionCount: 0, history: [],
		};
		emit('project-proposed', p, { actorId: command.actorId }); reconcile(p);
		return result(p);
	}
	if (command.type === 'contribute') {
		if (typeof command.projectId !== 'string' || !own(s.projects, command.projectId)) return fail('unknown-project');
		const p = s.projects[command.projectId], e = command.evidence;
		const provenance = command.provenance ?? 'player-observed';
		if (!fields(e, ['id', 'kind', 'sourceId', 'beneficiaryId']) || !key(e.id) || !EVIDENCE_KINDS.has(e.kind) ||
			(e.sourceId !== undefined && !key(e.sourceId)) || (e.beneficiaryId !== undefined && !key(e.beneficiaryId)) ||
			(e.kind === 'service' && !key(e.sourceId)) || !PROVENANCE.has(provenance)) return fail('invalid-evidence');
		const receipt = {
			id: e.id, projectId: p.id, actorId: command.actorId, kind: e.kind,
			sourceId: e.sourceId || null, beneficiaryId: e.beneficiaryId || null, provenance,
		};
		if (own(s.receipts, e.id)) {
			const previous = s.receipts[e.id];
			if (Object.keys(receipt).some((k) => receipt[k] !== previous[k])) return fail('evidence-conflict');
			return { state, events: [], project: state.projects[p.id] };
		}
		if (e.kind === 'service' && Object.values(s.receipts).some((r) => r.kind === 'service' && r.sourceId === e.sourceId)) return fail('service-already-contributed');
		if (p.status === 'completed') return fail('project-completed');
		if (blocked(s, p)) return fail(blocked(s, p));
		if (e.kind === 'survey' ? p.surveyCount >= 1 : p.workCount >= PROJECT_LIMITS.work) return fail('contribution-not-needed');
		let contributor = p.contributors.find((c) => c.actorId === command.actorId);
		if (!contributor) p.contributors.push(contributor = { actorId: command.actorId, surveyCount: 0, workCount: 0, serviceCount: 0 });
		if (e.kind === 'survey') { p.surveyCount++; contributor.surveyCount++; }
		else { p.workCount++; contributor.workCount++; if (e.kind === 'service') contributor.serviceCount++; }
		p.contributionCount++; p.status = p.surveyCount ? 'preparing' : 'surveying';
		s.receipts[e.id] = { ...receipt, at: now };
		emit('project-contribution', p, { actorId: command.actorId, kind: e.kind, provenance }); reconcile(p);
		return result(p);
	}
	if (command.situation !== undefined && !validSituation(command.situation)) return fail('invalid-situation');
	if (command.situation !== undefined) s.situation = situationOf(command.situation);
	for (const id of Object.keys(s.projects).sort()) reconcile(s.projects[id], true);
	s.lastAdvancedAt = now;
	if (now === state.updatedAt && events.length === 0 && JSON.stringify(s.situation) === JSON.stringify(state.situation)) return { state, events: [] };
	return result();
}

// Public read model. Permanent dedupe receipts stay inside the ledger; callers
// receive cloned counts and recent activity, never mutable state or chat text.
export function projectView(state) {
	if (!validState(state)) throw new TypeError('Invalid community project state.');
	return copy({
		version: PROJECT_VERSION, world: state.world, region: state.region,
		revision: state.revision, updatedAt: state.updatedAt,
		projects: Object.values(state.projects).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)).map(p => ({
			...p, contributedServiceIds: Object.values(state.receipts).filter(r => r.projectId === p.id && r.kind === 'service').map(r => r.sourceId),
		})),
		events: state.events,
	});
}
