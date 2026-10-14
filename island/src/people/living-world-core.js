// Persistent, region-scoped NPC activity. Shared by the browser and the room Worker.
// No renderer, storage, network, random source, or clock lives in this module. Callers
// register real people and requests; elapsed time never invents a place, quest, repaired
// building, transferred item, or player achievement. Physical outcomes need confirmation
// from the authoritative source adapter, not an LLM's account of what happened.

export const LIVING_WORLD_VERSION = 1;
export const LIVING_WORLD_LIMITS = Object.freeze({
	actors: 128, requests: 128, events: 160, participants: 8, proposals: 24,
	stepMs: 5 * 60 * 1000, catchUpMs: 24 * 60 * 60 * 1000,
});
const DAY = 24 * 60 * 60 * 1000;
const TERMINAL = new Set(['completed', 'failed']);
// Only abstract records can settle by elapsed time. Construction, delivery, trade,
// theft, combat and every unfamiliar future kind always need their real source.
const SOCIAL_KINDS = new Set(['conversation', 'checkin', 'observation']);
const SCHEDULE_EFFECTS = new Set(['prioritize', 'defer', 'resume']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, finite(v)));
const clean = (s, max = 160) => typeof s === 'string' ? s.trim().slice(0, max) : '';
const key = (s) => typeof s === 'string' && s.length > 0 && s.length <= 160 && s === s.trim() &&
	!['__proto__', 'constructor', 'prototype'].includes(s) && !/[\u0000-\u001f]/.test(s) ? s : '';
const strings = (a, max = 24) => [...new Set((Array.isArray(a) ? a : []).map(key).filter(Boolean))].sort().slice(0, max);
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const roll = (...v) => hash(v.join('|')) / 4294967296;
const copy = (v) => JSON.parse(JSON.stringify(v));
const quantize = (t) => Math.floor(t / LIVING_WORLD_LIMITS.stepMs) * LIVING_WORLD_LIMITS.stepMs;
const validTime = (t) => Number.isSafeInteger(t) && t >= 0;
const sorted = (o) => Object.keys(o).sort().map((id) => o[id]);
const scopeMatches = (s, d) => (!d.world || d.world === s.world) && (!d.region || d.region === s.region);

export function livingWorldKey(world, region) {
	if (!key(world) || !key(region)) throw new TypeError('A world and region ID are required.');
	return `${encodeURIComponent(world)}:${encodeURIComponent(region)}`;
}

export function createLivingWorldState({ world, region, now = 0 } = {}) {
	if (!validTime(now)) throw new TypeError('now must be a nonnegative millisecond timestamp.');
	return {
		version: LIVING_WORLD_VERSION, key: livingWorldKey(world, region), world, region,
		createdAt: now, lastAdvancedAt: quantize(now), updatedAt: now, sequence: 0,
		actors: {}, requests: {}, events: [],
		situation: { hazard: 0, blockedSites: [], destroyedSites: [], unavailableActors: [] },
	};
}

function situationOf(d = {}) {
	return {
		hazard: clamp(d.hazard), blockedSites: strings(d.blockedSites, 128),
		destroyedSites: strings(d.destroyedSites, 128), unavailableActors: strings(d.unavailableActors, 128),
	};
}

function actorOf(d, previous, now) {
	const disposition = d.disposition || {};
	return {
		id: key(d.id), name: clean(d.name, 80) || key(d.id),
		disposition: {
			helpful: clamp(disposition.helpful ?? ((finite(disposition.protect) + finite(disposition.mercy)) / 4 + 0.5)),
			reliable: clamp(disposition.reliable ?? 0.6), nerve: clamp(disposition.nerve ?? 0.5),
		},
		skills: strings(d.skills),
		sites: { home: key(d.sites?.home) || null, work: key(d.sites?.work) || null, social: key(d.sites?.social) || null },
		utcOffsetMinutes: Math.round(clamp(d.utcOffsetMinutes || 0, -840, 840)),
		registeredAt: previous?.registeredAt ?? now,
		activity: previous?.activity || 'daily-life', locationId: previous?.locationId || null,
		taskId: previous?.taskId || null, activitySince: previous?.activitySince ?? now,
		updatedAt: now,
	};
}

function requestOf(d, now) {
	const choices = (Array.isArray(d.choices) ? d.choices : []).filter((c) => c && key(c.id) && clean(c.label, 160));
	return {
		id: key(d.id), title: clean(d.title, 180), kind: clean(d.kind, 60) || 'request',
		giverId: key(d.giverId), source: key(d.source), siteId: key(d.siteId), siteName: clean(d.siteName, 120),
		durationMs: Math.round(clamp(d.durationMs ?? 30 * 60000, LIVING_WORLD_LIMITS.stepMs, DAY)),
		requiredSkills: strings(d.requiredSkills), tags: strings(d.tags),
		choices: [...new Map(choices.map((c) => [c.id, {
			id: key(c.id), label: clean(c.label, 160), ...(SCHEDULE_EFFECTS.has(c.effect) ? { effect: c.effect } : {}),
		}])).values()].slice(0, 12),
		allowNpc: d.allowNpc !== false, createdAt: now, updatedAt: now,
		completionMode: d.completionMode === 'social' && SOCIAL_KINDS.has(d.kind) ? 'social' : 'physical',
		status: 'open', actorId: null, assignedAt: null, progressMs: 0,
		playerOwner: null, participants: [], proposals: [], blockedReason: null,
		priority: 0, deferredUntil: null,
		completedAt: null, evidenceId: null,
	};
}

function routine(actor, at, situation) {
	if (situation.unavailableActors.includes(actor.id)) return { activity: 'unavailable', locationId: null };
	if (situation.hazard >= 0.6) return { activity: 'sheltering', locationId: actor.sites.home };
	const hour = ((at + actor.utcOffsetMinutes * 60000) % DAY + DAY) % DAY / 3600000;
	if (hour < 6 || hour >= 22) return { activity: 'resting', locationId: actor.sites.home };
	if (hour >= 8 && hour < 17 && actor.sites.work) return { activity: 'working', locationId: actor.sites.work };
	if ((hour >= 7 && hour < 8) || (hour >= 18 && hour < 19)) return { activity: 'eating', locationId: actor.sites.home };
	if (hour >= 17 && actor.sites.social) return { activity: 'socializing', locationId: actor.sites.social };
	return { activity: 'daily-life', locationId: actor.sites.home };
}

function blocked(s, q, actor, at = s.updatedAt) {
	if (q.playerOwner) return 'player-reserved';
	if (s.situation.destroyedSites.includes(q.siteId)) return 'site-destroyed';
	if (s.situation.blockedSites.includes(q.siteId)) return 'site-inaccessible';
	if (s.situation.hazard >= 0.6) return 'local-emergency';
	if (s.situation.unavailableActors.includes(q.giverId)) return 'giver-unavailable';
	if (actor && s.situation.unavailableActors.includes(actor.id)) return 'actor-unavailable';
	if (q.deferredUntil > at) return 'agreed-delay';
	return null;
}

/**
 * Pure reducer; error returns the original state, without partial writes.
 *
 * register-actor { actor: { id, name, disposition?, skills?, sites?, utcOffsetMinutes? } }
 * register-request { request: { id, title, giverId, source, siteId, durationMs?, ... } }
 * advance { now, situation? } -- known current conditions conservatively govern catch-up
 * situation { now, situation } -- observe an immediate change without advancing time
 * reserve | join | release { requestId, playerId, now }
 * influence { requestId, playerId, choiceId, reason?, now } -- a proposal, not a world edit
 * observe-start { requestId, actorId, now } -- TRUSTED physical source claim, not narration
 * confirm { requestId, evidenceId, outcome, playerId?, now } -- TRUSTED SOURCE ADAPTER ONLY
 *
 * The Worker must supply time and authenticated player IDs, and must never expose confirm
 * as an arbitrary client operation. This reducer cannot authenticate physical evidence.
 */
export function reduceLivingWorld(state, command = {}) {
	const fail = (error) => ({ state, events: [], error });
	if (!state || state.version !== LIVING_WORLD_VERSION || !state.actors || !state.requests || !Array.isArray(state.events)) return fail('invalid-state');
	if (command.world && command.world !== state.world || command.region && command.region !== state.region) return fail('scope-mismatch');
	const now = command.now ?? state.updatedAt;
	if (!validTime(now)) return fail('invalid-time');
	if (now < state.updatedAt && command.type !== 'advance') return fail('stale-command');
	// A new observation or agreement applies from its timestamp. In particular, clearing
	// an earthquake/delay must not grant work during the earlier blocked interval.
	if (['situation', 'release', 'influence'].includes(command.type) && now > state.updatedAt) {
		const advanced = reduceLivingWorld(state, { type: 'advance', now });
		const applied = reduceLivingWorld(advanced.state, { ...command, now });
		return applied.error ? fail(applied.error) : { state: applied.state, events: [...advanced.events, ...applied.events] };
	}
	const s = copy(state), events = [];
	const emit = (type, fields = {}, at = now) => {
		const e = { id: `${s.key}:${++s.sequence}`, at, type, world: s.world, region: s.region, ...fields };
		events.push(e); s.events.push(e);
		if (s.events.length > LIVING_WORLD_LIMITS.events) s.events.splice(0, s.events.length - LIVING_WORLD_LIMITS.events);
		return e;
	};
	const result = () => {
		s.updatedAt = Math.max(s.updatedAt, now);
		return { state: s, events };
	};
	const setActivity = (a, activity, locationId, at) => {
		if (a.activity === activity && a.locationId === locationId) return;
		a.activity = activity; a.locationId = locationId; a.activitySince = at; a.updatedAt = at;
		emit('routine', { actorId: a.id, activity, siteId: locationId, text: `${a.name} is ${activity.replaceAll('-', ' ')}.` }, at);
	};
	const applyBlock = (q, reason, at) => {
		if (TERMINAL.has(q.status) || q.status === 'awaiting-confirmation') return;
		if (reason) {
			if (q.status !== 'paused' || q.blockedReason !== reason) {
				q.status = 'paused'; q.blockedReason = reason; q.updatedAt = at;
				emit('paused', { requestId: q.id, actorId: q.actorId, reason, text: `${q.title} is paused: ${reason.replaceAll('-', ' ')}.` }, at);
			}
		} else if (q.status === 'paused') {
			q.status = q.actorId ? 'active' : 'open'; q.blockedReason = null; q.updatedAt = at;
			emit('resumed', { requestId: q.id, actorId: q.actorId, text: `${q.title} can continue.` }, at);
		}
	};

	if (command.type === 'register-actor') {
		const d = command.actor;
		if (!d || !key(d.id)) return fail('invalid-actor');
		if (!scopeMatches(s, d)) return fail('scope-mismatch');
		const previous = own(s.actors, d.id) ? s.actors[d.id] : null;
		if (!previous && Object.keys(s.actors).length >= LIVING_WORLD_LIMITS.actors) return fail('actor-capacity');
		const a = actorOf(d, previous, now);
		if (previous && JSON.stringify({ ...previous, updatedAt: now }) === JSON.stringify(a)) return { state, events: [] };
		s.actors[a.id] = a;
		if (!previous) emit('resident-registered', { actorId: a.id, text: `${a.name} is known in this region.` });
		return result();
	}
	if (command.type === 'register-request') {
		const d = command.request;
		if (!d || !key(d.id) || !clean(d.title) || !key(d.source) || !key(d.siteId) || !key(d.giverId) ||
			(d.completionMode !== undefined && !['social', 'physical'].includes(d.completionMode))) return fail('invalid-request');
		if (!scopeMatches(s, d)) return fail('scope-mismatch');
		if (!own(s.actors, d.giverId)) return fail('unknown-giver');
		if (own(s.requests, d.id)) {
			const old = s.requests[d.id];
			if (old.giverId !== d.giverId || old.source !== d.source || old.siteId !== d.siteId) return fail('request-identity-conflict');
			return { state, events: [] }; // Re-observation cannot reset progress or reopen a completed job.
		}
		if (Object.keys(s.requests).length >= LIVING_WORLD_LIMITS.requests) return fail('request-capacity');
		const q = requestOf(d, now); s.requests[q.id] = q;
		emit('request-posted', { requestId: q.id, actorId: q.giverId, siteId: q.siteId, text: `${s.actors[q.giverId].name} needs help: ${q.title}.` });
		applyBlock(q, blocked(s, q), now);
		return result();
	}
	if (command.type === 'situation') {
		const next = situationOf(command.situation);
		if (JSON.stringify(next) === JSON.stringify(s.situation)) return { state, events: [] };
		s.situation = next;
		emit('situation', { text: 'Local conditions changed; registered work was reassessed.', situation: copy(next) });
		for (const q of sorted(s.requests)) applyBlock(q, blocked(s, q, s.actors[q.actorId]), now);
		return result();
	}
	if (command.type === 'advance') {
		if (now <= s.lastAdvancedAt || now < s.updatedAt) return { state, events: [] };
		if (command.situation) s.situation = situationOf(command.situation);
		const end = quantize(now), from = Math.max(s.lastAdvancedAt, end - LIVING_WORLD_LIMITS.catchUpMs);
		if (from > s.lastAdvancedAt) emit('catch-up-limited', {
			skippedMs: from - s.lastAdvancedAt,
			text: 'Only the most recent day was simulated. Earlier unobserved outcomes were left unchanged.',
		}, from);
		for (let at = from + LIVING_WORLD_LIMITS.stepMs; at <= end; at += LIVING_WORLD_LIMITS.stepMs) {
			const actors = sorted(s.actors).filter((a) => a.registeredAt <= at);
			for (const q of sorted(s.requests)) {
				if (q.createdAt > at || TERMINAL.has(q.status) || q.status === 'awaiting-confirmation') continue;
				const a = q.actorId ? s.actors[q.actorId] : null;
				const reason = blocked(s, q, a, at);
				applyBlock(q, reason, at);
				if (reason || !a) continue;
				const r = routine(a, at, s.situation);
				if (r.activity === 'resting' || r.activity === 'eating' || (r.activity === 'working' && !q.tags.includes('work'))) {
					setActivity(a, r.activity, r.locationId, at); continue;
				}
				setActivity(a, 'helping', q.siteId, at);
				// A person who has started may take longer, but does not lose a player's job.
				const available = Math.max(0, at - Math.max(at - LIVING_WORLD_LIMITS.stepMs, q.createdAt, q.assignedAt));
				q.progressMs = Math.min(q.durationMs, q.progressMs + Math.round(available * (0.5 + a.disposition.reliable * 0.5)));
				q.updatedAt = at;
				if (q.progressMs >= q.durationMs) {
					a.taskId = null;
					if (q.completionMode === 'social' && !q.participants.length) {
						q.status = 'completed'; q.completedAt = at;
						q.evidenceId = `simulation:${s.key}:${q.id}:${q.assignedAt}`;
						emit('social-completed', { requestId: q.id, actorId: a.id, siteId: q.siteId,
							evidenceId: q.evidenceId, simulated: true,
							text: `${a.name} completed ${q.title} in the social simulation. No items, money or structures changed.` }, at);
					} else {
						q.status = 'awaiting-confirmation';
						emit('work-reported', { requestId: q.id, actorId: a.id, siteId: q.siteId,
							text: `${a.name} reports progress on ${q.title}; the result still needs to be verified.` }, at);
					}
				}
			}
			for (const a of actors) {
				if (a.taskId) {
					const q = s.requests[a.taskId];
					if (q?.status === 'paused') {
						const r = routine(a, at, s.situation); setActivity(a, r.activity, r.locationId, at);
					}
					continue;
				}
				const r = routine(a, at, s.situation);
				setActivity(a, r.activity, r.locationId, at);
				if (['resting', 'eating', 'sheltering', 'unavailable'].includes(r.activity)) continue;
				const candidates = sorted(s.requests).filter((q) => q.status === 'open' && q.createdAt <= at && q.allowNpc &&
					q.giverId !== a.id && !q.playerOwner && !blocked(s, q, a, at) &&
					q.requiredSkills.every((skill) => a.skills.includes(skill)) && (r.activity !== 'working' || q.tags.includes('work')));
				if (!candidates.length) continue;
				// Stable actors, requests and clock slots make reloads/replays deterministic.
				const q = candidates.sort((x, y) => (y.priority || 0) - (x.priority || 0) ||
					hash(`${a.id}|${x.id}`) - hash(`${a.id}|${y.id}`) || x.id.localeCompare(y.id))[0];
				if (roll(s.key, a.id, q.id, at) >= a.disposition.helpful * 0.8) continue;
				q.actorId = a.id; q.assignedAt = at; q.status = 'active'; q.updatedAt = at; a.taskId = q.id;
				setActivity(a, 'helping', q.siteId, at);
				emit('npc-joined', { requestId: q.id, actorId: a.id, siteId: q.siteId,
					text: `${a.name} offered to help with ${q.title}. Players can still join or reserve this request.` }, at);
			}
		}
		s.lastAdvancedAt = end;
		return result();
	}

	const requestId = key(command.requestId);
	if (!requestId || !own(s.requests, requestId)) return fail('unknown-request');
	const q = s.requests[requestId];
	if (command.type === 'observe-start') {
		const actorId = key(command.actorId), a = s.actors[actorId];
		if (!actorId || !own(s.actors, actorId)) return fail('unknown-actor');
		if (TERMINAL.has(q.status)) return fail('already-settled');
		if (!q.allowNpc) return fail('npc-not-allowed');
		if (!q.requiredSkills.every((skill) => a.skills.includes(skill))) return fail('missing-skill');
		if (q.giverId === actorId) return fail('giver-cannot-take');
		if (q.actorId && q.actorId !== actorId) return fail('assigned-to-another-actor');
		if (a.taskId && a.taskId !== q.id) return fail('actor-busy');
		if (blocked(s, q, a)) return fail('request-blocked');
		if (q.actorId === actorId) return { state, events: [] };
		q.actorId = actorId; q.assignedAt = now; q.status = 'active'; q.updatedAt = now; a.taskId = q.id;
		setActivity(a, 'helping', q.siteId, now);
		emit('npc-joined', { requestId, actorId, siteId: q.siteId, observed: true,
			text: `${a.name} started ${q.title} in the world.` });
		return result();
	}
	if (command.type === 'confirm') {
		const evidenceId = key(command.evidenceId);
		if (!evidenceId || !['completed', 'failed'].includes(command.outcome)) return fail('invalid-evidence');
		if (TERMINAL.has(q.status)) return q.evidenceId === evidenceId && q.status === command.outcome ? { state, events: [] } : fail('already-settled');
		if (q.playerOwner && q.playerOwner !== command.playerId || q.participants.length && !q.participants.includes(command.playerId)) return fail('player-confirmation-required');
		const observedActor = key(command.actorId) && q.actorId === command.actorId;
		if (q.status !== 'awaiting-confirmation' && !q.playerOwner && !q.participants.length && !(q.status === 'active' && observedActor)) return fail('not-ready');
		q.status = command.outcome; q.evidenceId = evidenceId; q.completedAt = now; q.updatedAt = now; q.blockedReason = null;
		if (q.actorId && s.actors[q.actorId]?.taskId === q.id) s.actors[q.actorId].taskId = null;
		emit('request-confirmed', { requestId: q.id, actorId: q.actorId, playerId: command.playerId || null, evidenceId,
			outcome: q.status, text: `${q.title}: ${q.status}, confirmed by its source.` });
		return result();
	}
	const playerId = key(command.playerId);
	if (!playerId) return fail('invalid-player');
	if (TERMINAL.has(q.status)) return fail('already-settled');
	if (command.type === 'reserve') {
		if (q.playerOwner && q.playerOwner !== playerId) return fail('reserved-by-another-player');
		if (q.playerOwner === playerId) return { state, events: [] };
		if (q.participants.some((id) => id !== playerId)) return fail('already-cooperative');
		q.playerOwner = playerId; q.updatedAt = now;
		emit('player-reserved', { requestId, playerId, actorId: q.actorId, text: `${q.title} is reserved for a player; NPCs will not finish it for them.` });
		applyBlock(q, 'player-reserved', now);
		return result();
	}
	if (command.type === 'join') {
		if (q.playerOwner && q.playerOwner !== playerId) return fail('reserved-by-another-player');
		if (q.participants.includes(playerId)) return { state, events: [] };
		if (q.participants.length >= LIVING_WORLD_LIMITS.participants) return fail('participant-capacity');
		q.participants.push(playerId); q.participants.sort(); q.updatedAt = now;
		emit('player-joined', { requestId, playerId, actorId: q.actorId, text: `A player joined ${q.title}; its outcome now needs player confirmation.` });
		return result();
	}
	if (command.type === 'release') {
		if (q.playerOwner !== playerId && !q.participants.includes(playerId)) return { state, events: [] };
		if (q.playerOwner === playerId) q.playerOwner = null;
		q.participants = q.participants.filter((id) => id !== playerId); q.updatedAt = now;
		emit('player-released', { requestId, playerId, text: `A player left ${q.title} available to others.` });
		applyBlock(q, blocked(s, q, s.actors[q.actorId]), now);
		return result();
	}
	if (command.type === 'influence') {
		const choiceId = key(command.choiceId), choice = q.choices.find((c) => c.id === choiceId);
		if (!choice) return fail('unknown-choice');
		if (q.playerOwner && q.playerOwner !== playerId) return fail('reserved-by-another-player');
		const previous = q.proposals.find((p) => p.playerId === playerId);
		if (previous?.choiceId === choiceId && previous.reason === clean(command.reason, 300)) return { state, events: [] };
		if (!previous && q.proposals.length >= LIVING_WORLD_LIMITS.proposals) return fail('proposal-capacity');
		const proposal = { playerId, choiceId, reason: clean(command.reason, 300), at: now, status: 'proposed' };
		if (choice.effect) {
			proposal.effect = choice.effect;
			const giver = s.actors[q.giverId], effect = choice.effect;
			const physicalBlock = blocked(s, { ...q, deferredUntil: null, playerOwner: null }, s.actors[q.actorId], now);
			let refusal = q.status === 'awaiting-confirmation' ? 'The reported result needs verification first.' :
				!giver || s.situation.unavailableActors.includes(q.giverId) ? 'The request owner is unavailable to agree.' :
				effect !== 'defer' && physicalBlock ? 'Current local conditions prevent that schedule.' : null;
			const willing = giver && roll(s.key, q.id, playerId, choice.id, 'consent') <
				0.25 + giver.disposition.helpful * 0.5 + giver.disposition.reliable * 0.2;
			if (!refusal && !willing) refusal = 'The request owner prefers to keep the current schedule.';
			proposal.status = refusal ? 'rejected' : 'accepted';
			proposal.decisionReason = refusal || (effect === 'prioritize' ? 'The owner agreed to consider this request first.' :
				effect === 'defer' ? 'The owner agreed to pause this request for at most one hour.' : 'The owner agreed to end the requested delay.');
			if (!refusal) {
				if (effect === 'prioritize') q.priority = 1;
				if (effect === 'defer' && !(q.deferredUntil > now)) q.deferredUntil = Math.min(Number.MAX_SAFE_INTEGER, now + 60 * 60000);
				if (effect === 'resume') q.deferredUntil = null;
				applyBlock(q, blocked(s, q, s.actors[q.actorId], now), now);
			}
		}
		q.proposals = q.proposals.filter((p) => p.playerId !== playerId).concat(proposal); q.updatedAt = now;
		emit('proposal', { requestId, playerId, choiceId, actorId: q.giverId, status: proposal.status,
			...(proposal.effect ? { effect: proposal.effect, decisionReason: proposal.decisionReason } : {}),
			text: proposal.status === 'proposed' ? `A player proposed “${choice.label}” for ${q.title}. Consent and any cost still need agreement.` :
				`${s.actors[q.giverId]?.name || 'The request owner'} ${proposal.status} “${choice.label}” for ${q.title}. ${proposal.decisionReason}` });
		return result();
	}
	return fail('unknown-command');
}

// A bounded view with the request/source IDs intact for UI, dialogue and source adapters.
// Public activity belongs here; private conversation transcripts do not.
export function livingWorldView(state, { limit = 30 } = {}) {
	const n = Math.round(clamp(limit, 1, LIVING_WORLD_LIMITS.events));
	return copy({
		version: state.version, world: state.world, region: state.region, updatedAt: state.updatedAt,
		lastAdvancedAt: state.lastAdvancedAt, situation: state.situation,
		actors: sorted(state.actors), requests: sorted(state.requests), events: state.events.slice(-n),
		counts: { actors: Object.keys(state.actors).length, requests: Object.keys(state.requests).length, events: state.sequence },
	});
}
