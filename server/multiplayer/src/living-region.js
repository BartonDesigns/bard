// One durable, shared simulation for a body and region. Clients submit observations,
// never authority to mint rewards or assert a building was repaired. No chat is stored.
import { createLivingWorldState, reduceLivingWorld, livingWorldView } from '../../../island/src/people/living-world-core.js';

export const LIVING_FEATURE = 'living-world-v1';
export const LIVING_MAX_BYTES = 32768;
export const LIVING_TICK_MS = 5 * 60 * 1000;
const IDENTIFIER = /^[A-Za-z0-9:_-]{6,96}$/;
const PLAYER = /^traveller:[a-f0-9]{64}$/;
const ACTIVE = new Set(['open', 'active', 'paused']);
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

export class LivingRegion {
	constructor(state) { this.state = state; this.chain = Promise.resolve(); }
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
		if (Object.values(data.core.requests || {}).some(r => ACTIVE.has(r.status))) await this.state.storage.setAlarm(Date.now() + LIVING_TICK_MS);
		else await this.state.storage.deleteAlarm?.();
	}
	advance(data, now) {
		// A passing danger may subside. A destroyed/inaccessible site or unavailable
		// citizen remains so until a fresh source observation says otherwise.
		const observed = data.situation || { hazard: 0, blockedSites: [], destroyedSites: [], unavailableActors: [] };
		const conditions = { ...observed, hazard: data.situationAt + 30 * 60 * 1000 > now ? observed.hazard : 0 };
		const result = reduceLivingWorld(data.core, { type: 'advance', now, situation: conditions });
		return { data: { ...data, core: result.state }, events: result.events || [] };
	}
	async tick() {
		const saved = await this.load(); if (!saved) return;
		const advanced = this.advance(saved, Date.now());
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
		return { feature: LIVING_FEATURE, world: data.world, region: data.region, you: player, revision: data.revision, now: Date.now(), view, events: events.slice(-50), eventCount: events.length, ...(receipt ? { receipt } : {}), authority: 'Client-observed activity; physical completion and rewards require a verified source.' };
	}
	async handle(req) {
		const url = new URL(req.url), world = url.searchParams.get('world'), region = url.searchParams.get('region'), player = req.headers.get('x-living-player');
		// This class is reached only by the Worker binding. The public Worker creates
		// this header from the private Soul capability, never forwards it from clients.
		if (!livingScope(world) || !livingScope(region) || !PLAYER.test(player || '')) return json({ error: 'Invalid living-world identity or scope.' }, 400);
		if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed.' }, 405);
		let saved = await this.load();
		if (saved && (saved.world !== world || saved.region !== region)) return json({ error: 'Region scope mismatch.' }, 409);
		const now = Date.now();
		if (!saved) saved = { world, region, revision: 0, eventCount: 0, core: createLivingWorldState({ world, region, now }), budgets: {}, situation: null, situationAt: 0, recentTerminal: [], archivedRequests: 0, observers: {} };
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
		if (!['register', 'reserve', 'join', 'release', 'influence', 'report-source'].includes(b.op)) return json({ error: 'Unsupported operation. Use a guarded source report for observed outcomes.' }, 400);
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
		} else {
			if (!safeId(b.requestId)) return json({ error: 'A valid request is required.' }, 400);
			if (await this.state.storage.get(`settled:${b.requestId}`)) return json({ error: 'already-settled' }, 409);
			if (b.op === 'report-source') {
				const q = Object.hasOwn(saved.core.requests, b.requestId) ? saved.core.requests[b.requestId] : null;
				if (!q) return json({ error: 'unknown-request' }, 409);
				if (!safeId(b.source) || b.source !== q.source || !safeId(b.evidenceId) || !['completed', 'failed'].includes(b.outcome)) return json({ error: 'A matching source, evidence id and outcome are required.' }, 400);
				const conditions = saved.core.situation;
				if (b.outcome === 'completed' && (conditions.hazard >= 0.6 || conditions.destroyedSites.includes(q.siteId) || conditions.blockedSites.includes(q.siteId) || conditions.unavailableActors.includes(q.giverId) || (b.actorId && conditions.unavailableActors.includes(b.actorId)))) return json({ error: 'Observed conditions block this result. Refresh the source observations first.' }, 409);
				const participant = q.playerOwner === player || q.participants.includes(player);
				if (!participant && saved.observers?.[b.requestId] !== player) return json({ error: 'Only the observing source or participating player can report this outcome.' }, 403);
				const sourceActor = safeId(b.actorId) && Object.hasOwn(saved.core.actors, b.actorId) ? saved.core.actors[b.actorId] : null;
				const alignObservedStart = !participant && !q.actorId && !q.playerOwner && !q.participants.length && q.allowNpc && sourceActor && q.requiredSkills.every(skill => sourceActor.skills.includes(skill));
				if ((!participant || b.actorId != null) && (!safeId(b.actorId) || (b.actorId !== q.actorId && !alignObservedStart))) return json({ error: 'The reported citizen must match the assigned citizen.' }, 409);
				const evidenceKey = `source-evidence:${await hash(JSON.stringify([b.source, b.evidenceId]))}`;
				if (await this.state.storage.get(evidenceKey)) return json({ error: 'Source evidence was already reported.' }, 409);
				extraWrites[evidenceKey] = { requestId: q.id, actorId: b.actorId || null, source: q.source, evidenceId: b.evidenceId, outcome: b.outcome, reporter: player, provenance: 'client-observed', at: now };
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
			const observed = reduceLivingWorld(data.core, { type: 'situation', now, situation: data.situation || {} });
			data.core = observed.state; events.push(...(observed.events || []));
		}
		budget.count++; budgets[player] = budget; data.budgets = budgets;
		const advanced = this.advance(data, now); data = advanced.data; events.push(...advanced.events);
		data.revision = saved.revision + 1;
		const receipt = { operation: b.id, op: b.op, fingerprint, at: now, revision: data.revision, eventIds: events.slice(-50).map(e => e.id), eventCount: events.length, firstSequence: events.length ? data.eventCount + 1 : null, lastSequence: events.length ? data.eventCount + events.length : null };
		const next = await this.persist(data, events, { key: receiptKey, value: receipt }, extraWrites);
		await this.schedule(next);
		return json(this.response(next, player, events, { ...receipt, fingerprint: undefined }));
	}
}
