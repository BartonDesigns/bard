// One durable, shared simulation for a body and region. Clients submit observations,
// never authority to mint rewards or assert a building was repaired. No chat is stored.
import { createLivingWorldState, reduceLivingWorld, livingWorldView } from '../../../island/src/people/living-world-core.js';
import { COMMUNITY_FEATURE, PROJECT_WORK_MS, createProjectState, reduceProjects, projectView } from '../../../island/src/people/community-projects-core.js';

export { COMMUNITY_FEATURE };

export const LIVING_FEATURE = 'living-world-v1';
export const LIVING_MAX_BYTES = 32768;
export const LIVING_TICK_MS = 5 * 60 * 1000;
const IDENTIFIER = /^[A-Za-z0-9:_-]{6,96}$/;
const PLAYER = /^traveller:[a-f0-9]{64}$/;
const ACTIVE = new Set(['open', 'active', 'paused']);
const PROJECT_OPS = new Set(['project-propose', 'project-start', 'project-complete', 'project-service']);
const SOCIAL_KINDS = new Set(['conversation', 'checkin', 'observation']);
export const PROJECT_SURVEY_MS = 5000;
export const PROJECT_CHALLENGE_MS = 10 * 60 * 1000;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
export const livingScope = value => typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value && !/[\u0000-\u001f\u007f/\\]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const text = (value, length = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, length) : '';
const words = (value, count = 16) => Array.isArray(value) ? value.slice(0, count).map(v => text(v, 96)).filter(Boolean) : [];
const safeId = value => typeof value === 'string' && value.length > 0 && value.length <= 96 && !/[\u0000-\u001f\u007f<>]/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const number = (v, lo, hi, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
export async function livingIdentity(soul, world, region) {
	const bytes = new TextEncoder().encode(JSON.stringify(['living-world', soul, world, region]));
	return 'traveller:' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
}
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2, '0')).join('');

function actor(raw, world, region) {
	if (!raw || !safeId(raw.id) || raw.id.startsWith('traveller:') || (raw.world && raw.world !== world) || (raw.region && raw.region !== region)) return null;
	const sites = {};
	for (const key of ['home', 'work', 'social']) if (safeId(raw.sites?.[key])) sites[key] = raw.sites[key];
	return { id: raw.id, name: text(raw.name, 80), world, region, disposition: Object.fromEntries(['helpful', 'reliable', 'nerve'].map(k => [k, number(raw.disposition?.[k], 0, 1, 0.5)])), skills: words(raw.skills), sites, utcOffsetMinutes: number(raw.utcOffsetMinutes, -840, 840) };
}
function request(raw) {
	if (!raw || !safeId(raw.id) || !safeId(raw.giverId)) return null;
	const choices = Array.isArray(raw.choices) ? raw.choices.slice(0, 8).filter(v => safeId(v?.id)).map(v => ({ id: v.id, label: text(v.label, 96), ...(['prioritize', 'defer', 'resume'].includes(v.effect) ? { effect: v.effect } : {}) })) : [];
	const kind = text(raw.kind, 48);
	return { id: raw.id, title: text(raw.title), kind, giverId: raw.giverId, source: text(raw.source, 96), siteId: text(raw.siteId, 96), siteName: text(raw.siteName, 96), durationMs: number(raw.durationMs, LIVING_TICK_MS, 24 * 60 * 60 * 1000, 30 * 60 * 1000), requiredSkills: words(raw.requiredSkills), tags: words(raw.tags), choices, allowNpc: raw.allowNpc !== false, completionMode: raw.completionMode === 'social' && ['conversation', 'checkin', 'observation'].includes(kind) ? 'social' : 'physical' };
}
function situation(raw) {
	if (!raw || typeof raw !== 'object') return null;
	return { hazard: number(raw.hazard, 0, 1), blockedSites: words(raw.blockedSites, 32), destroyedSites: words(raw.destroyedSites, 32), unavailableActors: words(raw.unavailableActors, 32) };
}
function conditionsAt(data, now) {
	const observed = data.situation || { hazard: 0, blockedSites: [], destroyedSites: [], unavailableActors: [] };
	return { ...observed, hazard: data.situationAt + 30 * 60 * 1000 > now ? observed.hazard : 0 };
}
const projectConditions = conditions => ({ hazard: conditions.hazard, blockedSites: [...new Set([...(conditions.blockedSites || []), ...(conditions.destroyedSites || [])])] });
function combinedProjectConditions(data, now) {
	const c = projectConditions(conditionsAt(data, now)), blocked = new Set(c.blockedSites);
	for (const value of Object.values(data.projectSituationObservers || {})) {
		if (value.at + 30 * 60 * 1000 > now) c.hazard = Math.max(c.hazard, value.hazard);
		for (const id of value.blockedSites) blocked.add(id);
	}
	return { hazard: c.hazard, blockedSites: [...blocked] };
}
const projectBlocked = (data, project, now) => { const c = combinedProjectConditions(data, now); return c.hazard >= .6 || c.blockedSites.includes(project.siteId); };
const projectById = (data, id) => typeof id === 'string' && data.projects?.projects && Object.hasOwn(data.projects.projects, id) ? data.projects.projects[id] : null;
const validAnchor = a => a && ['x', 'y', 'z'].every(k => Number.isFinite(a[k]) && Math.abs(a[k]) <= 1e9) && ((a.lat === undefined && a.lon === undefined) || Number.isFinite(a.lat) && Math.abs(a.lat) <= 90 && Number.isFinite(a.lon) && Math.abs(a.lon) <= 180);
const sameSiteAnchor = (a, b) => a.lat !== undefined && b.lat !== undefined ? a.lat === b.lat && a.lon === b.lon : ['x', 'y', 'z', 'lat', 'lon'].every(k => a[k] === b[k]);
function anchorsOverlap(a, b) {
	if (Math.abs(a.y - b.y) >= 3) return false;
	if (a.lat === undefined || b.lat === undefined) return Math.hypot(a.x - b.x, a.z - b.z) < 12;
	const rad = Math.PI / 180, lat = (a.lat - b.lat) * rad, lon = (a.lon - b.lon) * rad;
	const h = Math.sin(lat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(lon / 2) ** 2;
	return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))) < 12;
}

export class LivingRegion {
	// The optional clock is only a constructor dependency for isolated tests. The
	// public Worker never accepts a client clock or a time-override environment flag.
	constructor(state, _env, clock = () => Date.now()) { this.state = state; this.now = clock; this.chain = Promise.resolve(); }
	exclusive(fn) { const result = this.chain.then(fn); this.chain = result.catch(() => {}); return result; }
	fetch(request) { return this.exclusive(() => this.handle(request)); }
	alarm() { return this.exclusive(() => this.tick()); }
	async load() {
		const head = await this.state.storage.get('living');
		if (!head) return null;
		const chunks = await Promise.all(Array.from({ length: head.parts }, (_, i) => this.state.storage.get(`living:${i}`)));
		return JSON.parse(chunks.join(''));
	}
	async persist(data, events = [], receipt = null, extraWrites = {}) {
		const writes = { ...extraWrites }, next = { ...data, eventCount: data.eventCount + events.length };
		// Completed social work frees active capacity without forgetting that it
		// happened. Each terminal record is also its permanent replay tombstone.
		const terminal = Object.values(data.core.requests || {}).filter(r => ['completed', 'failed'].includes(r.status));
		if (terminal.length) {
			next.core = structuredClone(data.core);
			next.observers = { ...(data.observers || {}) };
			next.recentTerminal = [...(data.recentTerminal || []), ...terminal].slice(-16);
			next.archivedRequests = (data.archivedRequests || 0) + terminal.length;
			for (const q of terminal) { writes[`settled:${q.id}`] = q; delete next.core.requests[q.id]; delete next.observers[q.id]; }
		}
		for (let i = 0; i < events.length; i++) writes[`activity:${String(data.eventCount + i + 1).padStart(12, '0')}`] = { ...events[i], sequence: data.eventCount + i + 1 };
		const encoded = JSON.stringify(next), parts = Math.ceil(encoded.length / 24000);
		for (let i = 0; i < parts; i++) writes[`living:${i}`] = encoded.slice(i * 24000, (i + 1) * 24000);
		writes.living = { parts };
		if (receipt) writes[receipt.key] = receipt.value;
		const commit = async storage => {
			const entries = Object.entries(writes);
			for (let i = 0; i < entries.length; i += 64) await storage.put(Object.fromEntries(entries.slice(i, i + 64)));
		};
		if (this.state.storage.transaction) await this.state.storage.transaction(commit); else await commit(this.state.storage);
		return next;
	}
	async schedule(data) {
		const livingActive = Object.values(data.core.requests || {}).some(r => ACTIVE.has(r.status));
		const building = Object.values(data.projects?.projects || {}).filter(p => p.status === 'building');
		// The old citizen scheduler and project publication share one alarm. Never
		// cancel citizen work just because a project finished (or the inverse).
		if (livingActive || building.length) {
			const now = this.now(), due = building.filter(p => !p.blockedReason && p.readyAt > now).map(p => p.readyAt);
			await this.state.storage.setAlarm(Math.min(now + LIVING_TICK_MS, ...due));
		}
		else await this.state.storage.deleteAlarm?.();
	}
	advance(data, now) {
		// A passing danger may subside. A destroyed/inaccessible site or unavailable
		// citizen remains so until a fresh source observation says otherwise.
		const conditions = conditionsAt(data, now);
		const result = reduceLivingWorld(data.core, { type: 'advance', now, situation: conditions });
		const projects = reduceProjects(data.projects || createProjectState({ world: data.world, region: data.region, now }), { type: 'advance', now, situation: combinedProjectConditions(data, now) });
		return { data: { ...data, core: result.state, projects: projects.state }, events: [...(result.events || []), ...(projects.events || [])] };
	}
	async tick() {
		const saved = await this.load(); if (!saved) return;
		const advanced = this.advance(saved, this.now());
		const next = await this.persist({ ...advanced.data, revision: saved.revision + 1 }, advanced.events);
		await this.schedule(next);
	}
	async history(data, url) {
		const rawBefore = Number(url.searchParams.get('before'));
		const before = Number.isSafeInteger(rawBefore) && rawBefore > 0 ? Math.min(rawBefore, data.eventCount + 1) : data.eventCount + 1;
		const limit = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get('limit')) || 30)));
		const start = Math.max(1, before - limit);
		const events = await Promise.all(Array.from({ length: before - start }, (_, i) => this.state.storage.get(`activity:${String(start + i).padStart(12, '0')}`)));
		return { events: events.filter(Boolean).reverse(), before: start > 1 ? start : null, total: data.eventCount };
	}
	response(data, player, events = [], receipt = null) {
		const view = livingWorldView(data.core, { limit: 30 });
		view.requests.push(...(data.recentTerminal || [])); view.counts.archivedRequests = data.archivedRequests || 0;
		return { feature: LIVING_FEATURE, features: [LIVING_FEATURE, COMMUNITY_FEATURE], world: data.world, region: data.region, you: player, revision: data.revision, now: this.now(), view, projects: projectView(data.projects || createProjectState({ world: data.world, region: data.region, now: this.now() })), sites: Object.values(data.sites || {}), events: events.slice(-50), eventCount: events.length, ...(receipt ? { receipt } : {}), authority: 'Server-timed community projects and client-observed activity. Source locations and physical actions are not independently verified.' };
	}
	async registerSites(data, values) {
		if (values === undefined) return null;
		if (!Array.isArray(values) || values.length > 16) return 'Observe up to 16 project sites per batch.';
		data.sites = { ...(data.sites || {}) };
		for (const value of values) {
			if (!value || !safeId(value.id) || !text(value.name, 120) || !['place', 'business', 'living-request'].includes(value.source) || !validAnchor(value.anchor)) return 'Invalid project site observation.';
			const clean = { id: value.id, name: text(value.name, 120), source: value.source, anchor: Object.fromEntries(['x', 'y', 'z', ...(value.anchor.lat === undefined ? [] : ['lat', 'lon'])].map(k => [k, value.anchor[k]])) };
			if (value.source === 'living-request') {
				if (!safeId(value.requestId)) return 'A source request is required for this site.';
				const q = Object.hasOwn(data.core.requests, value.requestId) ? data.core.requests[value.requestId] : await this.state.storage.get(`settled:${value.requestId}`);
				if (!q || q.siteId !== clean.id) return 'The source request does not match this site.';
				clean.requestId = value.requestId;
			}
			if (value.npcId != null) {
				if (!safeId(value.npcId) || !Object.hasOwn(data.core.actors, value.npcId)) return 'The site contact must be an observed citizen.';
				clean.npcId = value.npcId; clean.npcName = data.core.actors[value.npcId].name;
			}
			const prior = Object.hasOwn(data.sites, clean.id) ? data.sites[clean.id] : null;
			if (prior) {
				if (prior.source !== clean.source || !sameSiteAnchor(prior.anchor, clean.anchor)) return 'A known project site cannot be moved or assigned a different source.';
				continue;
			}
			if (Object.keys(data.sites).length >= 64) return 'Project site capacity reached.';
			data.sites[clean.id] = clean;
		}
		return null;
	}
	registerProjectSituation(data, value, player, now) {
		if (value === undefined) return null;
		if (!value || typeof value !== 'object' || typeof value.hazard !== 'number' || !Number.isFinite(value.hazard) || value.hazard < 0 || value.hazard > 1 || !Array.isArray(value.blockedSites) || !Array.isArray(value.observedSites) || value.blockedSites.length > 32 || value.observedSites.length > 32 || ![...value.blockedSites, ...value.observedSites].every(id => safeId(id) && Object.hasOwn(data.sites || {}, id)) || value.blockedSites.some(id => !value.observedSites.includes(id))) return 'Project conditions require known observed sites and a finite hazard.';
		data.projectSituationObservers = { ...(data.projectSituationObservers || {}) };
		for (const [id, observed] of Object.entries(data.projectSituationObservers)) if (!observed.blockedSites.length && observed.at + 30 * 60 * 1000 <= now) delete data.projectSituationObservers[id];
		const prior = data.projectSituationObservers[player], blocked = new Set(prior?.blockedSites || []);
		for (const id of value.observedSites) blocked.delete(id);
		for (const id of value.blockedSites) blocked.add(id);
		if (!blocked.size && value.hazard === 0) delete data.projectSituationObservers[player];
		else {
			if (!prior && Object.keys(data.projectSituationObservers).length >= 64) return 'Project observation capacity reached.';
			data.projectSituationObservers[player] = { at: now, hazard: value.hazard, blockedSites: [...blocked] };
		}
		if (value.hazard >= .6 || value.blockedSites.length) data.emergencyRevision = (data.emergencyRevision || 0) + 1;
		return null;
	}
	async creditService(data, project, requestId, player, now, extraWrites, events, automatic = false) {
		const q = Object.hasOwn(data.core.requests, requestId) ? data.core.requests[requestId] : await this.state.storage.get(`settled:${requestId}`);
		if (!q || q.status !== 'completed' || q.completionMode !== 'physical' || SOCIAL_KINDS.has(q.kind) || q.provenance !== 'client-observed' || !q.evidenceId || q.evidenceId.startsWith('simulation:') || q.siteId !== project.siteId) return 'Only a completed physical source result at this project site can contribute.';
		const evidenceKey = `source-evidence:${await hash(JSON.stringify([q.source, q.evidenceId]))}`;
		const evidence = extraWrites[evidenceKey] || await this.state.storage.get(evidenceKey);
		if (!evidence || evidence.requestId !== q.id || evidence.outcome !== 'completed' || evidence.provenance !== 'client-observed' || evidence.reporter !== player) return 'The source result does not belong to this observer or participant.';
		let actorId;
		if (evidence.actorId) {
			if (evidence.actorId !== q.actorId || (evidence.observer || evidence.reporter) !== player || q.playerOwner || q.participants?.length) return 'Only the original observer can contribute the assigned citizen’s result.';
			actorId = evidence.actorId;
		} else {
			if (q.playerOwner !== player && !q.participants?.includes(player)) return 'The contributor must own or participate in the source request.';
			actorId = player;
		}
		const claimKey = `project-source:${await hash(JSON.stringify([q.source, q.evidenceId]))}`;
		const used = extraWrites[claimKey] || await this.state.storage.get(claimKey);
		if (used) return used.projectId === project.id && used.actorId === actorId ? null : 'This source result already contributed to another project.';
		const result = reduceProjects(data.projects, { type: 'contribute', projectId: project.id, actorId, now, evidence: { id: claimKey, kind: 'service', sourceId: q.id, beneficiaryId: q.giverId }, provenance: evidence.actorId ? 'npc-observed' : 'player-observed' });
		if (result.error) return String(result.error);
		data.projects = result.state; events.push(...(result.events || []));
		extraWrites[claimKey] = { projectId: project.id, requestId: q.id, actorId, at: now, provenance: 'client-observed', automatic };
		return null;
	}
	async projectOperation(data, b, player, now, extraWrites, events) {
		const failure = (error, status = 409) => ({ error, status });
		if (b.op === 'project-propose') {
			const p = b.project, site = p && safeId(p.siteId) && Object.hasOwn(data.sites || {}, p.siteId) ? data.sites[p.siteId] : null;
			if (!site) return failure('Observe the source site before proposing a project.', 400);
			if (p.anchor && (!validAnchor(p.anchor) || !sameSiteAnchor(p.anchor, site.anchor))) return failure('The proposal cannot move its observed site.');
			if (Object.values(data.projects.projects).some(existing => existing.siteId !== site.id && anchorsOverlap(existing.anchor, site.anchor))) return failure('A community project already occupies this nearby site.');
			const result = reduceProjects(data.projects, { type: 'propose', actorId: player, now, project: { siteId: site.id, name: site.name, kind: p.kind, anchor: site.anchor, ...(site.npcId ? { npcId: site.npcId, npcName: site.npcName } : {}) } });
			if (result.error) return failure(String(result.error));
			data.projects = result.state; events.push(...(result.events || [])); return {};
		}
		const project = projectById(data, b.projectId);
		if (!project) return failure('Unknown project in this world and region.', 404);
		if (b.op === 'project-service') {
			if (!safeId(b.requestId)) return failure('A real source request is required.', 400);
			const error = await this.creditService(data, project, b.requestId, player, now, extraWrites, events);
			return error ? failure(error) : {};
		}
		const challengeKey = `project-challenge:${player}`, pending = await this.state.storage.get(challengeKey);
		if (b.op === 'project-start') {
			if (!['survey', 'work'].includes(b.kind)) return failure('Choose survey or work.', 400);
			if (project.status === 'completed' || project.status === 'building') return failure('This project no longer needs contributions.');
			if (b.kind === 'survey' && project.surveyCount >= 1 || b.kind === 'work' && !project.surveyCount) return failure('Survey once before starting work.');
			if (projectBlocked(data, project, now)) return failure('Observed conditions block this project.');
			// A new action replaces this traveller's previous action. Canceling in the
			// UI or switching projects cannot accidentally reuse an earlier timer.
			// Exact operation retries are handled by the durable receipt above.
			const challenge = { id: crypto.randomUUID(), projectId: project.id, kind: b.kind, startedAt: now, readyAt: now + (b.kind === 'survey' ? PROJECT_SURVEY_MS : PROJECT_WORK_MS), expiresAt: now + PROJECT_CHALLENGE_MS, emergencyRevision: data.emergencyRevision || 0 };
			extraWrites[challengeKey] = challenge; return { challenge };
		}
		if (b.op === 'project-complete') {
			if (!pending || b.challengeId !== pending.id || pending.projectId !== project.id) return failure('No matching project action belongs to this traveller.');
			if (pending.completedAt) return { challenge: pending, contributionDuplicate: true };
			if (pending.expiresAt <= now) return failure('The project action expired. Start it again.');
			if (now < pending.readyAt) return failure('The server-timed project action is not ready.');
			if (pending.emergencyRevision !== (data.emergencyRevision || 0) || projectBlocked(data, project, now)) return failure('The project action was interrupted by observed danger. Start again when safe.');
			const result = reduceProjects(data.projects, { type: 'contribute', projectId: project.id, actorId: player, now, evidence: { id: `challenge:${pending.id}`, kind: pending.kind }, provenance: 'player-observed' });
			if (result.error) return failure(String(result.error));
			data.projects = result.state; events.push(...(result.events || []));
			const challenge = { ...pending, completedAt: now }; extraWrites[challengeKey] = challenge; return { challenge };
		}
		return failure('Unsupported project operation.', 400);
	}
	async handle(req) {
		const url = new URL(req.url), world = url.searchParams.get('world'), region = url.searchParams.get('region'), player = req.headers.get('x-living-player');
		// This class is reached only by the Worker binding. The public Worker creates
		// this header from the private Soul capability, never forwards it from clients.
		if (!livingScope(world) || !livingScope(region) || !PLAYER.test(player || '')) return json({ error: 'Invalid living-world identity or scope.' }, 400);
		if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed.' }, 405);
		let saved = await this.load();
		if (saved && (saved.world !== world || saved.region !== region)) return json({ error: 'Region scope mismatch.' }, 409);
		const now = this.now();
		if (!saved) saved = { world, region, revision: 0, eventCount: 0, core: createLivingWorldState({ world, region, now }), projects: createProjectState({ world, region, now }), sites: {}, budgets: {}, situation: null, situationAt: 0, emergencyRevision: 0, recentTerminal: [], archivedRequests: 0, observers: {} };
		if (req.method === 'GET') {
			const advanced = this.advance(saved, now);
			const next = await this.persist({ ...advanced.data, revision: saved.revision + 1 }, advanced.events);
			await this.schedule(next);
			return json({ ...this.response(next, player, advanced.events), history: await this.history(next, url) });
		}
		const raw = await req.text();
		if (new TextEncoder().encode(raw).length > LIVING_MAX_BYTES) return json({ error: 'Observation batch too large.' }, 413);
		let b; try { b = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
		if (!b || typeof b !== 'object' || !IDENTIFIER.test(b.id || '')) return json({ error: 'A stable operation id is required.' }, 400);
		if (!['register', 'reserve', 'join', 'release', 'influence', 'report-source'].includes(b.op) && !PROJECT_OPS.has(b.op)) return json({ error: 'Unsupported operation. Use a guarded source report for observed outcomes.' }, 400);
		const receiptKey = `receipt:${player}:${b.id}`, fingerprint = await hash(raw), previous = await this.state.storage.get(receiptKey);
		if (previous) return previous.fingerprint !== fingerprint ? json({ error: 'Operation id already used for a different request.' }, 409) : json(this.response(saved, player, [], { ...previous, fingerprint: undefined, duplicate: true }));
		const minute = Math.floor(now / 60000), budgets = Object.fromEntries(Object.entries(saved.budgets || {}).filter(([, v]) => v.minute === minute));
		const budget = budgets[player] || { minute, count: 0 };
		if (budget.count >= 30 || Object.values(budgets).reduce((n, v) => n + v.count, 0) >= 120) return json({ error: 'Region is busy. Retry shortly.' }, 429);
		const commands = [], extraWrites = {};
		if (b.op === 'register') {
			if (!Array.isArray(b.actors) || !Array.isArray(b.requests) || b.actors.length > 16 || b.requests.length > 16) return json({ error: 'Register up to 16 citizens and 16 requests per batch.' }, 400);
			for (const value of b.actors) { const clean = actor(value, world, region); if (!clean) return json({ error: 'Invalid citizen observation.' }, 400); commands.push({ type: 'register-actor', actor: clean }); }
			for (const value of b.requests) {
				const clean = request(value); if (!clean) return json({ error: 'Invalid request observation.' }, 400);
				const settled = await this.state.storage.get(`settled:${clean.id}`);
				if (settled) {
					if (settled.giverId !== clean.giverId || settled.source !== clean.source || settled.siteId !== clean.siteId) return json({ error: 'request-identity-conflict' }, 409);
					continue;
				}
				commands.push({ type: 'register-request', request: clean });
			}
		} else if (!PROJECT_OPS.has(b.op)) {
			if (!safeId(b.requestId)) return json({ error: 'A valid request is required.' }, 400);
			if (await this.state.storage.get(`settled:${b.requestId}`)) return json({ error: 'already-settled' }, 409);
			if (b.op === 'report-source') {
				const q = Object.hasOwn(saved.core.requests, b.requestId) ? saved.core.requests[b.requestId] : null;
				if (!q) return json({ error: 'unknown-request' }, 409);
				if (!safeId(b.source) || b.source !== q.source || !safeId(b.evidenceId) || !['completed', 'failed'].includes(b.outcome)) return json({ error: 'A matching source, evidence id and outcome are required.' }, 400);
				const conditions = conditionsAt(saved, now);
				if (b.outcome === 'completed' && (conditions.hazard >= 0.6 || conditions.destroyedSites.includes(q.siteId) || conditions.blockedSites.includes(q.siteId) || conditions.unavailableActors.includes(q.giverId) || (b.actorId && conditions.unavailableActors.includes(b.actorId)))) return json({ error: 'Observed conditions block this result. Refresh the source observations first.' }, 409);
				const participant = q.playerOwner === player || q.participants.includes(player);
				if (!participant && saved.observers?.[b.requestId] !== player) return json({ error: 'Only the observing source or participating player can report this outcome.' }, 403);
				const sourceActor = safeId(b.actorId) && Object.hasOwn(saved.core.actors, b.actorId) ? saved.core.actors[b.actorId] : null;
				const alignObservedStart = !participant && !q.actorId && !q.playerOwner && !q.participants.length && q.allowNpc && sourceActor && q.requiredSkills.every(skill => sourceActor.skills.includes(skill));
				if ((!participant || b.actorId != null) && (!safeId(b.actorId) || (b.actorId !== q.actorId && !alignObservedStart))) return json({ error: 'The reported citizen must match the assigned citizen.' }, 409);
				const evidenceKey = `source-evidence:${await hash(JSON.stringify([b.source, b.evidenceId]))}`;
				if (await this.state.storage.get(evidenceKey)) return json({ error: 'Source evidence was already reported.' }, 409);
				extraWrites[evidenceKey] = { requestId: q.id, actorId: b.actorId || null, source: q.source, evidenceId: b.evidenceId, outcome: b.outcome, reporter: player, observer: saved.observers?.[q.id] || null, provenance: 'client-observed', at: now };
				if (alignObservedStart) commands.push({ type: 'observe-start', requestId: q.id, actorId: b.actorId });
				commands.push({ type: 'confirm', requestId: q.id, actorId: b.actorId, evidenceId: b.evidenceId, outcome: b.outcome, playerId: player });
			} else {
				if (b.op === 'influence' && !safeId(b.choiceId)) return json({ error: 'A valid proposal choice is required.' }, 400);
				commands.push({ type: b.op, requestId: b.requestId, playerId: player, choiceId: b.choiceId, reason: text(b.reason) });
			}
		}
		// Check the full batch on isolated state. An invalid final item never leaves
		// earlier citizens, receipts, or events half-written.
		let data = structuredClone(saved); const events = [];
		data.projects ||= createProjectState({ world, region, now });
		for (const command of commands) {
			const isNewRequest = command.type === 'register-request' && !Object.hasOwn(data.core.requests, command.request.id);
			const result = reduceLivingWorld(data.core, { ...command, now });
			if (result.error) return json({ error: String(result.error) }, 409);
			if (isNewRequest) data.observers = { ...(data.observers || {}), [command.request.id]: player };
			if (b.op === 'report-source') {
				result.state.requests[b.requestId].provenance = 'client-observed';
				for (const event of result.events || []) {
					event.provenance = 'client-observed'; event.source = b.source;
					if (event.type === 'request-confirmed') event.text = `${result.state.requests[b.requestId].title}: ${b.outcome}, reported by its client source; not independently verified.`;
					else if (event.type === 'npc-joined') event.text = `${data.core.actors[b.actorId]?.name || b.actorId} was reported starting ${result.state.requests[b.requestId].title} by its client source.`;
				}
			}
			data.core = result.state; events.push(...(result.events || []));
		}
		if (b.op === 'register' && b.situation) {
			data.situation = situation(b.situation); data.situationAt = now;
			if (data.situation && (data.situation.hazard >= .6 || data.situation.blockedSites.length || data.situation.destroyedSites.length)) data.emergencyRevision = (data.emergencyRevision || 0) + 1;
			const observed = reduceLivingWorld(data.core, { type: 'situation', now, situation: data.situation || {} });
			data.core = observed.state; events.push(...(observed.events || []));
		}
		if (b.op === 'register') {
			const error = await this.registerSites(data, b.sites); if (error) return json({ error }, 409);
			const conditionsError = this.registerProjectSituation(data, b.projectSituation, player, now); if (conditionsError) return json({ error: conditionsError }, 409);
		}
		// Apply fresh danger before checking a due project. Otherwise a report
		// arriving at the deadline could publish a project just before pausing it.
		const projectAdvance = reduceProjects(data.projects, { type: 'advance', now, situation: combinedProjectConditions(data, now) });
		data.projects = projectAdvance.state; events.push(...(projectAdvance.events || []));
		let projectReceipt = {};
		if (PROJECT_OPS.has(b.op)) {
			projectReceipt = await this.projectOperation(data, b, player, now, extraWrites, events);
			if (projectReceipt.error) return json({ error: projectReceipt.error }, projectReceipt.status);
		}
		if (b.op === 'report-source' && b.outcome === 'completed') {
			const q = data.core.requests[b.requestId], project = Object.values(data.projects.projects).find(p => p.siteId === q.siteId);
			if (project) await this.creditService(data, project, b.requestId, player, now, extraWrites, events, true);
		}
		budget.count++; budgets[player] = budget; data.budgets = budgets;
		const advanced = this.advance(data, now); data = advanced.data; events.push(...advanced.events);
		data.revision = saved.revision + 1;
		const receipt = { operation: b.id, op: b.op, fingerprint, at: now, revision: data.revision, eventIds: events.slice(-50).map(e => e.id), eventCount: events.length, firstSequence: events.length ? data.eventCount + 1 : null, lastSequence: events.length ? data.eventCount + events.length : null, ...projectReceipt };
		const next = await this.persist(data, events, { key: receiptKey, value: receipt }, extraWrites);
		await this.schedule(next);
		return json(this.response(next, player, events, { ...receipt, fingerprint: undefined }));
	}
}
