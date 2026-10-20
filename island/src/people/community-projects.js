// Scene observations become bounded project commands. Shared records use the
// existing living-region authority; local previews are never uploaded as facts.
import { COMMUNITY_FEATURE, PROJECT_WORK_MS, createProjectState, reduceProjects, projectView, projectKey } from './community-projects-core.js';
import { jsonCopy as clone } from '../persistence/json-copy.js';

const kinds = ['path', 'garden', 'gathering', 'resonance'];
const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
const storageDefault = () => { try { return globalThis.localStorage; } catch { return null; } };
const coord = p => p && ['x', 'y', 'z'].every(k => Number.isFinite(p[k]));
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value && !/[\u0000-\u001f]/.test(value);
const timestamp = value => Number.isSafeInteger(value) && value >= 0;
const geographic = p => !Object.hasOwn(p, 'lat') && !Object.hasOwn(p, 'lon') || Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lon) && Math.abs(p.lon) <= 180;
const fail = message => ({ ok: false, message });

export function createCommunityProjects({
	worldKey = () => 'here', region = () => ({ id: 'here', name: 'here' }), world = () => null,
	position = () => null, candidates = () => [], toPosition = p => p, eligible = () => true,
	situation = () => ({ hazard: 0, blockedSites: [] }), livingWorld = null, soul = null,
	url = '', request = globalThis.fetch?.bind(globalThis), storage = storageDefault(), clock = () => Date.now(),
	mark = () => {}, play = () => false, hint = () => {}, onChange = () => {},
} = {}) {
	let scope = null, identity = '', local = null, remote = null, sites = [], pending = null, active = null, marked = null;
	let mode = 'local', capability = null, error = '', readBlocked = false, savedLocally = !!storage, nextSync = 0, nextAdvance = 0;
	let flight = null, actionFlight = null, generation = 0, workGeneration = 0, stopped = false, sequence = 0;
	let lastObservation = null, observationAt = 0;
	const nonce = Math.round(clock()).toString(36) + '-' + Math.random().toString(36).slice(2, 12);
	const credential = () => { try { return soul?.credentials?.() || ''; } catch { return ''; } };
	const key = () => 'l99-community-projects-v1:' + scope.key;
	const opId = () => 'project-' + nonce + '-' + (++sequence);
	const hasService = () => !!(url && request && identity);
	const view = () => remote || projectView(local);
	function save() {
		if (!scope || readBlocked) return false;
		try {
			if (!storage) throw Error('unavailable');
			storage.setItem(key(), JSON.stringify({ version: 1, local, remote, sites, pending, shared: !!remote }));
			savedLocally = true; return true;
		} catch { savedLocally = false; error = 'Project progress could not be saved on this device. New contributions are paused.'; return false; }
	}
	function ensure() {
		if (stopped || !world()) return false;
		const r = region() || {}, token = credential();
		const body = String(worldKey() || 'here'), area = String(r.id || r || 'here');
		const id = [body, area, token ? 'soul-' + hash(token) : 'device'].map(encodeURIComponent).join(':');
		if (scope?.key === id && identity === token) return true;
		if (scope) save();
		generation++; workGeneration++; identity = token; scope = { key: id, world: body, region: area, name: r.name || area };
		local = createProjectState({ world: body, region: area, now: Math.round(clock()) }); remote = null; sites = []; pending = null;
		active = null; marked = null; mode = 'local'; capability = null; readBlocked = false; error = ''; nextSync = nextAdvance = 0; lastObservation = null; observationAt = 0;
		try {
			const old = JSON.parse(storage?.getItem(key()) || 'null');
			if (old !== null) {
				if (old.version !== 1 || old.local?.world !== body || old.local?.region !== area || !validSites(old.sites) ||
					reduceProjects(old.local, { type: 'advance', now: Math.max(old.local.updatedAt, Math.round(clock())) }).error ||
					old.remote && !validView(old.remote) || old.pending && !validPending(old.pending)) throw Error('Invalid project save');
				local = old.local; remote = old.remote; sites = old.sites; pending = old.pending;
				if (remote) { mode = 'offline'; capability = true; }
			}
		} catch { readBlocked = true; savedLocally = false; error = 'The saved project journal could not be read. Its original data is retained; project changes are paused.'; }
		return true;
	}
	function validView(v) {
		try {
			return v?.version === 1 && v.world === scope.world && v.region === scope.region && Number.isSafeInteger(v.revision) && v.revision >= 0 && timestamp(v.updatedAt) &&
				Array.isArray(v.projects) && v.projects.length <= 64 && new Set(v.projects.map(p => p?.id)).size === v.projects.length && v.projects.every(p =>
					p && identifier(p.siteId) && p.id === projectKey(scope.world, scope.region, p.siteId) && p.world === scope.world && p.region === scope.region &&
					typeof p.name === 'string' && p.name.length > 0 && kinds.includes(p.kind) && coord(p.anchor) && geographic(p.anchor) &&
					['surveying','preparing','building','completed'].includes(p.status) && [0,1].includes(p.surveyCount) &&
					Number.isInteger(p.workCount) && p.workCount >= 0 && p.workCount <= 3 && p.requiredWork === 3 &&
					Array.isArray(p.history) && p.history.length <= 40 && p.history.every(e => e && typeof e.type === 'string' && timestamp(e.at)) &&
					Array.isArray(p.contributors) && p.contributors.length <= 4 && p.contributors.every(c => c && identifier(c.actorId)) &&
					(p.contributedServiceIds === undefined || Array.isArray(p.contributedServiceIds) && p.contributedServiceIds.length <= 3 && p.contributedServiceIds.every(identifier)) &&
					[null,'local-emergency','site-inaccessible'].includes(p.blockedReason) &&
					(p.readyAt === null || timestamp(p.readyAt)) && (p.completedAt === null || timestamp(p.completedAt))) &&
				Array.isArray(v.events) && v.events.length <= 160 && v.events.every(e => e && typeof e.type === 'string' && timestamp(e.at));
		} catch { return false; }
	}
	function validSites(v) {
		return Array.isArray(v) && v.length <= 64 && v.every(s => s && identifier(s.id) && typeof s.name === 'string' && coord(s.anchor) && geographic(s.anchor));
	}
	function validPending(p) {
		if (!p || !identifier(p.id)) return false;
		if (p.op === 'project-propose') return p.project && identifier(p.project.siteId) && kinds.includes(p.project.kind);
		if (typeof p.projectId !== 'string' || !p.projectId.startsWith('project:')) return false;
		if (p.op === 'project-start') return ['survey','work'].includes(p.kind);
		if (p.op === 'project-complete') return identifier(p.challengeId);
		return p.op === 'project-service' && identifier(p.requestId);
	}
	const current = context => ensure() && generation === context.generation && identity === context.identity;
	const contextNow = () => ({ ...scope, generation, identity });
	const path = s => '/living/' + encodeURIComponent(s.world) + '/' + encodeURIComponent(s.region);
	function receive(data, context) {
		if (!current(context)) return false;
		if (data.world !== scope.world || data.region !== scope.region || !validView(data.projects) || data.sites !== undefined && !validSites(data.sites)) throw Error('The shared project response is incomplete.');
		if (!remote || data.projects.revision >= remote.revision) { remote = clone(data.projects); sites = Array.isArray(data.sites) ? clone(data.sites) : sites; }
		mode = 'shared'; capability = true; error = ''; save(); onChange(); return true;
	}
	async function http(route, body, context) {
		const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12000);
		try {
			const response = await request(url.replace(/\/$/, '') + route, { method: body ? 'POST' : 'GET', signal: abort.signal,
				headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(route !== '/status' ? { authorization: 'Bearer ' + context.identity } : {}) },
				...(body ? { body: JSON.stringify(body) } : {}) });
			const data = await response.json();
			if (!response.ok) { const e = Error(data.error || 'The project service could not accept this action.'); e.status = response.status; throw e; }
			return data;
		} finally { clearTimeout(timer); }
	}
	function choices() {
		const known = new Map(sites.map(s => [s.id, s]));
		const out = [], seen = new Set();
		for (const raw of candidates() || []) {
			if (!raw || typeof raw.id !== 'string' || seen.has(raw.id) || !coord(raw.anchor)) continue;
			const site = known.get(raw.siteId || raw.id);
			const c = { ...raw, ...(site ? { anchor: site.anchor, name: site.name, source: site.source, npcId: site.npcId, npcName: site.npcName } : {}), siteId: raw.siteId || raw.id,
				kinds: (raw.kinds || kinds).filter(k => kinds.includes(k)) };
			if (!c.kinds.length) continue;
			const at = position(), spot = toPosition(c.anchor);
			c.inRange = coord(at) && coord(spot) && Math.hypot(at.x-spot.x,at.z-spot.z)<=120;
			c.canPropose = c.inRange;
			seen.add(raw.id); out.push(c); if (out.length >= 12) break;
		}
		return out;
	}
	function safe(p) {
		const danger = situation() || {}, target = toPosition(p.anchor), at = position();
		return eligible() && !danger.hazard && !danger.blockedSites?.includes(p.siteId) && !p.blockedReason && coord(target) && coord(at) &&
			Math.hypot(at.x - target.x, at.z - target.z) <= 6 && Math.abs(at.y - target.y) <= 3;
	}
	function projectObservation(extraSites = []) {
		const danger = situation() || {}, at = position(), observedSites = [];
		const known = new Map([...sites, ...extraSites].map(s => [s.id, s]));
		if (coord(at)) for (const s of known.values()) {
			const target = toPosition(s.anchor);
			if (coord(target) && Math.hypot(at.x - target.x, at.z - target.z) <= 120) observedSites.push(s.id);
			if (observedSites.length >= 32) break;
		}
		observedSites.sort();
		return { hazard: Number.isFinite(danger.hazard) ? Math.max(0, Math.min(1, danger.hazard)) : 0,
			blockedSites: observedSites.filter(id => danger.blockedSites?.includes(id)), observedSites };
	}
	const observationNeeded = observed => (observed.observedSites.length || observed.hazard || lastObservation !== null) &&
		(JSON.stringify(observed) !== lastObservation || Math.round(clock()) - observationAt >= 15 * 60 * 1000);
	async function transmit(command, context) {
		const data = await http(path(context), command, context);
		if (!receive(data, context)) return fail('Your location or identity changed. Open the project again here.');
		if (pending?.id === command.id) { pending = null; save(); }
		return { ok: true, data, receipt: data.receipt, message: 'Project progress saved.' };
	}
	async function sync() {
		if (!ensure() || readBlocked || !hasService()) return false;
		if (flight) return flight;
		const context = contextNow();
		const task = (async () => {
			try {
				if (capability !== true) {
					const status = await http('/status', null, context);
					if (!current(context)) return false;
					capability = status.features?.includes(COMMUNITY_FEATURE) === true;
					if (!capability) { mode = remote ? 'offline' : 'local'; error = 'Shared projects are not deployed yet. New projects stay on this device.'; return false; }
				}
				if (pending) {
					const command = clone(pending);
					try { if (!(await transmit(command, context)).ok) return false; }
					catch (e) { if (current(context) && e.status >= 400 && e.status < 500 && ![408,429].includes(e.status)) { pending = null; save(); } throw e; }
				}
				if (!current(context)) return false;
				const observed = projectObservation();
				if (observationNeeded(observed)) {
					// This records only this observer's nearby project sites. It cannot
					// clear a different player's report or unrelated living-region hazards.
					const data = await http(path(context), { id: opId(), op: 'register', actors: [], requests: [], projectSituation: observed }, context);
					if (!receive(data, context)) return false;
					lastObservation = JSON.stringify(observed); observationAt = Math.round(clock());
					return true;
				}
				const data = await http(path(context), null, context);
				return receive(data, context);
			} catch (e) { if (current(context)) { mode = 'offline'; error = e.message || 'Shared projects are offline. Reconnect to contribute.'; } return false; }
		})();
		flight = task; try { return await task; } finally { if (flight === task) flight = null; }
	}
	async function send(command, context) {
		if (!current(context)) return fail('Your location or identity changed.');
		if (pending) return fail('A previous contribution is awaiting confirmation. Reconnect before adding another.');
		pending = { id: opId(), ...command }; if (!save()) { pending = null; return fail(error); }
		try { return await transmit(clone(pending), context); }
		catch (e) {
			if (current(context)) {
				if (e.status >= 400 && e.status < 500 && ![408,429].includes(e.status)) pending = null;
				else mode = 'offline';
				error = e.message; save();
			}
			return fail(e.message);
		}
	}
	function apply(command) {
		const result = reduceProjects(local, { ...command, now: Math.max(local.updatedAt, Math.round(clock())) });
		if (result.error) return fail(result.error);
		const previous = local; local = result.state;
		if (!save()) { local = previous; return fail(error); }
		onChange();
		return { ok: true, project: result.project, message: 'Saved on this device.' };
	}
	async function perform(id, operation, args) {
		if (!ensure()) return fail('Enter a world first.');
		if (operation === 'cancel') { workGeneration++; active = null; return { ok: true, message: 'Work paused. Start a fresh observation when you return.' }; }
		if (readBlocked) return fail(error);
		const context = contextNow();
		const requestedWorkGeneration = workGeneration;
		if (operation === 'mark') {
			const p = view().projects.find(p => p.id === id) || choices().find(c => c.id === id);
			if (!p) return fail('That project is not known here.');
			marked = clone(p); mark({ ...toPosition(p.anchor), title: p.name, detail: 'Community project', radius: 6, projectId:p.id, initial:true });
			return { ok: true, message: 'The project site is marked.' };
		}
		if (operation === 'play') {
			const p = view().projects.find(p => p.id === id);
			return p?.status === 'completed' && p.kind === 'resonance' && safe(p) && play(id) ? { ok: true, message: 'The stones answer your touch.' } : fail('Approach the completed musical stones to play.');
		}
		if (hasService() && (capability === null || mode === 'offline' || pending)) await sync();
		if (!current(context)) return fail('Your location or identity changed.');
		if (operation === 'start' && requestedWorkGeneration !== workGeneration) return fail('Work was cancelled. Start again when ready.');
		if (hasService() && capability !== false && mode !== 'shared' || pending || remote && mode !== 'shared') return fail(error || 'Reconnect to the shared project service first.');
		if (!save()) return fail(error);
		if (operation === 'propose') {
			const c = choices().find(c => c.id === id);
			if (!c || !c.kinds.includes(args.kind)) return fail('Choose a suitable, discovered site and improvement.');
			const anchor = toPosition(c.anchor), at = position();
			if (!coord(anchor) || !coord(at) || Math.hypot(anchor.x-at.x,anchor.z-at.z) > 120) return fail('Visit this project site before proposing its improvement.');
			const project = { siteId: c.siteId, name: c.name, kind: args.kind, anchor: c.anchor, ...(c.npcId ? { npcId: c.npcId, npcName: c.npcName || 'A resident' } : {}) };
			if (mode !== 'shared') return apply({ type: 'propose', project, actorId: 'player' });
			if (c.npcId || c.requestId) {
				await livingWorld?.sync?.();
				if (!current(context)) return fail('Your location or identity changed.');
			}
			const site = { id: c.siteId, name: c.name, anchor: c.anchor, source: c.source || 'place', ...(c.requestId ? { requestId: c.requestId } : {}), ...(c.npcId ? { npcId: c.npcId, npcName: c.npcName || 'A resident' } : {}) };
			try {
				const projectSituation = projectObservation([site]);
				const observed = await http(path(context), { id: opId(), op: 'register', actors: [], requests: [], sites: [site], projectSituation }, context);
				if (!receive(observed, context)) return fail('Your location changed.');
				lastObservation = JSON.stringify(projectSituation); observationAt = Math.round(clock());
			} catch (e) { return fail(e.message); }
			return send({ op: 'project-propose', project }, context);
		}
		const p = view().projects.find(p => p.id === id);
		if (!p) return fail('That project is not known here.');
		if (operation === 'start') {
			const kind = args.kind;
			if (!['survey','work'].includes(kind) || p.status === 'building' || p.status === 'completed' || kind === 'survey' && p.surveyCount || kind === 'work' && (!p.surveyCount || p.workCount >= 3)) return fail('Choose the next unfinished project step.');
			if (!safe(p)) return fail('Stand within six metres of the site, on the ground and clear of danger.');
			const session = ++workGeneration; active = null;
			let challenge = null;
			if (mode === 'shared') {
				const result = await send({ op: 'project-start', projectId: id, kind }, context);
				if (!result.ok) return result;
				challenge = result.receipt?.challenge;
				if (!challenge?.id || !current(context) || session !== workGeneration || !safe(p)) return fail('The site changed or work was cancelled. Start again when safe.');
			}
			active = { projectId: id, kind, elapsedMs: 0, durationMs: kind === 'survey' ? 5000 : PROJECT_WORK_MS, challenge, context };
			return { ok: true, message: kind === 'survey' ? 'Surveying the site. Stay nearby, then confirm your findings.' : 'Work has begun. Stay nearby, then confirm this work session.' };
		}
		if (operation === 'finish') {
			if (!active || active.projectId !== id || !safe(p) || active.elapsedMs < active.durationMs) return fail('Finish the active observation at this site first.');
			const work = active;
			if (mode === 'shared' && !work.challenge) { active = null; return fail('Shared support became available. Start a new shared work session.'); }
			let result;
			if (mode === 'shared') result = await send({ op: 'project-complete', projectId: id, challengeId: work.challenge.id }, context);
			else result = apply({ type: 'contribute', projectId: id, actorId: 'player', evidence: { id: opId(), kind: work.kind } });
			if (result.ok && active === work) active = null;
			return result;
		}
		if (operation === 'contribute-service') {
			const q = serviceSources(p).find(q => q.id === args.requestId);
			if (!q) return fail('This site needs a confirmed physical job from its actual requester.');
			if (mode === 'shared') return send({ op: 'project-service', projectId: id, requestId: q.id }, context);
			return apply({ type: 'contribute', projectId: id, actorId: q.completedBy === 'player' ? 'player' : q.completedBy,
				evidence: { id: 'service:' + q.id, kind: 'service', sourceId: q.id, beneficiaryId: q.beneficiaryId }, provenance: q.completedBy === 'player' ? 'player-observed' : 'npc-observed' });
		}
		return fail('That project action is not supported.');
	}
	function serviceSources(p, activities = livingWorld?.snapshot?.().activities || []) {
		return activities.filter(q => q.siteId === p.siteId && q.physicalCompleted && q.completedBy && q.canContributeProject &&
			!(p.contributedServiceIds || []).includes(q.id));
	}
	function snapshot() {
		if (!ensure()) return { mode, scope: null, projects: [], candidates: [], active: null, error };
		const currentView = view(), activities = livingWorld?.snapshot?.().activities || [];
		return { mode, scope: { ...scope }, projects: currentView.projects.map(p => ({ ...p, shared: !!remote, serviceSources: serviceSources(p, activities) })), history: currentView.events,
			candidates: choices(), active: active ? { projectId: active.projectId, kind: active.kind, elapsedMs: active.elapsedMs, durationMs: active.durationMs } : null,
			pending: !!pending, error, savedLocally };
	}
	function progress() {
		if (!ensure()) return { scope: null, active: null };
		return { scope: { key: scope.key, world: scope.world, region: scope.region },
			active: active ? { projectId: active.projectId, kind: active.kind, elapsedMs: active.elapsedMs, durationMs: active.durationMs } : null };
	}
	function update(dt) {
		if (!ensure() || readBlocked) return;
		const elapsed = Math.max(0, Math.min(.25, Number(dt) || 0));
		if (active) {
			const p = view().projects.find(p => p.id === active.projectId);
			if (!p || !current(active.context) || !safe(p) || ['building','completed'].includes(p.status) || active.kind === 'survey' && p.surveyCount) { workGeneration++; active = null; hint('Project work paused. Return to the site to begin again.'); }
			else active.elapsedMs = Math.min(active.durationMs, active.elapsedMs + elapsed * 1000);
		}
		if (marked) mark({ ...toPosition(marked.anchor), title: marked.name, detail: 'Community project', radius: 6, projectId:marked.id, initial:false });
		nextAdvance -= elapsed; nextSync -= elapsed;
		if (nextAdvance <= 0) {
			nextAdvance = 5;
			if (!remote) apply({ type: 'advance', situation: situation() });
			else if (observationNeeded(projectObservation())) nextSync = 0;
		}
		if (nextSync <= 0) { nextSync = 30; void sync(); }
	}
	return {
		snapshot, progress, sync, update,
		action(id, operation, args = {}) {
			if (operation === 'cancel' || operation === 'mark' || operation === 'play') return perform(id, operation, args);
			if (actionFlight) return Promise.resolve(fail('Wait for the current project action to finish.'));
			const task = perform(id, operation, args); actionFlight = task;
			return task.finally(() => { if (actionFlight === task) actionFlight = null; });
		},
		reset() { workGeneration++; active = null; marked = null; },
		dispose() { save(); stopped = true; generation++; workGeneration++; active = null; },
	};
}
