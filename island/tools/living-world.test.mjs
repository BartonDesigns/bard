import test from 'node:test';
import assert from 'node:assert/strict';
import {
	createLivingWorldState, reduceLivingWorld, livingWorldView, livingWorldKey, LIVING_WORLD_LIMITS,
} from '../src/people/living-world-core.js';

const START = Date.UTC(2026, 9, 14, 8), MIN = 60000, DAY = 24 * 60 * MIN;
const actor = (id, extra = {}) => ({ id, name: id, disposition: { helpful: 1, reliable: 1 }, ...extra });
const request = (id = 'request:coast', extra = {}) => ({
	id, title: 'Check the coastal path', giverId: 'npc:giver', source: 'board:coast', siteId: 'site:coast',
	durationMs: 30 * MIN, choices: [{ id: 'coast', label: 'Keep the coastal path' }, { id: 'inland', label: 'Use the inland path' }], ...extra,
});
function reduce(state, command) {
	const result = reduceLivingWorld(state, { now: state.updatedAt, ...command });
	assert.equal(result.error, undefined, JSON.stringify(command));
	assert.doesNotThrow(() => JSON.parse(JSON.stringify(result.state)));
	return result.state;
}
function setup({ world = 'earth', region = 'coast', helper = {}, req = {}, now = START } = {}) {
	let state = createLivingWorldState({ world, region, now });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:giver', { disposition: { helpful: 0 } }) });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:helper', helper) });
	return reduce(state, { type: 'register-request', request: request('request:coast', req) });
}
function observed(state) {
	return reduce(state, { type: 'observe-start', requestId: 'request:coast', actorId: 'npc:helper' });
}

test('scope keys keep planets and regions separate even with delimiter-like IDs', () => {
	assert.notEqual(livingWorldKey('earth:a', 'b'), livingWorldKey('earth', 'a:b'));
	assert.throws(() => createLivingWorldState({ world: '', region: 'coast' }), /required/);
	assert.throws(() => createLivingWorldState({ world: 'earth', region: 'coast', now: NaN }), /timestamp/);
	const state = setup();
	for (const cmd of [
		{ type: 'register-actor', actor: actor('other', { world: 'moon' }) },
		{ type: 'register-request', request: request('wrong', { region: 'another' }) },
		{ type: 'advance', world: 'moon', now: START + DAY },
	]) {
		const out = reduceLivingWorld(state, cmd);
		assert.equal(out.error, 'scope-mismatch'); assert.strictEqual(out.state, state);
	}
	const moon = setup({ world: 'moon' });
	const earth = reduce(state, { type: 'reserve', requestId: 'request:coast', playerId: 'player:a' });
	assert.equal(moon.requests['request:coast'].playerOwner, null);
	assert.equal(earth.requests['request:coast'].playerOwner, 'player:a');
});

test('advancing residents never invents requests, people or destination sites', () => {
	let state = createLivingWorldState({ world: 'gargantua', region: 'island', now: START });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:one') });
	state = reduce(state, { type: 'advance', now: START + DAY });
	assert.deepEqual(Object.keys(state.requests), []);
	assert.deepEqual(Object.keys(state.actors), ['npc:one']);
	assert.ok(state.events.every((e) => !e.siteId));
	assert.equal(reduceLivingWorld(state, { type: 'register-request', request: request(), now: state.updatedAt }).error, 'unknown-giver');
	assert.equal(reduceLivingWorld(state, { type: 'register-request', request: request('q', { source: '' }), now: state.updatedAt }).error, 'invalid-request');
});

test('daily routines use supplied sites and local time, without changing a scene', () => {
	let state = createLivingWorldState({ world: 'moon', region: 'settlement', now: START });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:one', {
		sites: { home: 'hab:one', work: 'shop:one', social: 'hall:one' }, utcOffsetMinutes: 120,
	}) });
	state = reduce(state, { type: 'advance', now: START + 5 * MIN });
	assert.equal(state.actors['npc:one'].activity, 'working');
	assert.equal(state.actors['npc:one'].locationId, 'shop:one');
	state = reduce(state, { type: 'advance', now: Date.UTC(2026, 9, 14, 21) });
	assert.equal(state.actors['npc:one'].activity, 'resting');
	assert.equal(state.actors['npc:one'].locationId, 'hab:one');
	assert.equal(state.requests && Object.keys(state.requests).length, 0);
});

test('only qualified willing actors take registered work; giver never hires themself', () => {
	let state = setup({ helper: { skills: ['inspection'] }, req: { requiredSkills: ['inspection'] } });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:unqualified') });
	state = reduce(state, { type: 'advance', now: START + 2 * 60 * MIN });
	assert.equal(state.requests['request:coast'].actorId, 'npc:helper');
	assert.equal(state.requests['request:coast'].status, 'awaiting-confirmation');
	assert.equal(state.actors['npc:unqualified'].taskId, null);
	let unwilling = setup({ helper: { disposition: { helpful: 0, reliable: 1 } } });
	unwilling = reduce(unwilling, { type: 'advance', now: START + DAY });
	assert.equal(unwilling.requests['request:coast'].actorId, null);
	assert.equal(unwilling.requests['request:coast'].status, 'open');
});

test('serialized replay is deterministic; repeated or older advance is a no-op', () => {
	const state = setup(), before = JSON.stringify(state);
	const a = reduceLivingWorld(state, { type: 'advance', now: START + 3 * 60 * MIN });
	const b = reduceLivingWorld(JSON.parse(before), { type: 'advance', now: START + 3 * 60 * MIN });
	assert.deepEqual(a, b); assert.equal(JSON.stringify(state), before, 'the input is not mutated');
	const again = reduceLivingWorld(a.state, { type: 'advance', now: START + 3 * 60 * MIN });
	assert.strictEqual(again.state, a.state); assert.deepEqual(again.events, []);
	const older = reduceLivingWorld(a.state, { type: 'advance', now: START + MIN, situation: { hazard: 1 } });
	assert.strictEqual(older.state, a.state); assert.equal(older.state.situation.hazard, 0);
});

test('many short clock advances equal one bounded catch-up with the same observations', () => {
	const initial = setup();
	const one = reduce(initial, { type: 'advance', now: START + 3 * 60 * MIN });
	let many = initial;
	for (let minutes = 1; minutes <= 180; minutes++) many = reduce(many, { type: 'advance', now: START + minutes * MIN });
	assert.deepEqual(many, one);
});

test('long absence has a bounded catch-up and never invents repairs or paid rewards', () => {
	const initial = setup({ req: { kind: 'repair', requiredSkills: ['construction'], durationMs: MIN }, helper: { skills: ['construction'] } });
	const out = reduceLivingWorld(initial, { type: 'advance', now: START + 3650 * DAY });
	assert.equal(out.error, undefined);
	const q = out.state.requests['request:coast'];
	assert.equal(q.status, 'awaiting-confirmation'); assert.equal(q.completedAt, null); assert.equal(q.evidenceId, null);
	assert.equal(out.events.filter((e) => e.type === 'catch-up-limited').length, 1);
	assert.equal(out.events.find((e) => e.type === 'catch-up-limited').skippedMs, 3649 * DAY);
	assert.ok(out.state.events.length <= LIVING_WORLD_LIMITS.events);
	assert.equal(out.events.some((e) => e.type === 'request-confirmed'), false);
	assert.equal('money' in out.state, false); assert.equal('structures' in out.state, false);
});

test('reserving an active request protects it indefinitely and pauses autonomous progress', () => {
	let state = observed(setup());
	state = reduce(state, { type: 'advance', now: START + 5 * MIN });
	const progress = state.requests['request:coast'].progressMs;
	state = reduce(state, { type: 'reserve', requestId: 'request:coast', playerId: 'player:a' });
	state = reduce(state, { type: 'advance', now: START + 20 * DAY });
	const q = state.requests['request:coast'];
	assert.equal(q.status, 'paused'); assert.equal(q.blockedReason, 'player-reserved'); assert.equal(q.progressMs, progress);
	assert.equal(q.playerOwner, 'player:a');
	assert.equal(reduceLivingWorld(state, { type: 'reserve', requestId: q.id, playerId: 'player:b', now: state.updatedAt }).error, 'reserved-by-another-player');
	assert.equal(reduceLivingWorld(state, { type: 'confirm', requestId: q.id, evidenceId: 'receipt:fake', outcome: 'completed', now: state.updatedAt }).error, 'player-confirmation-required');
	state = reduce(state, { type: 'release', requestId: q.id, playerId: 'player:a' });
	assert.equal(state.requests[q.id].status, 'active');
	state = reduce(state, { type: 'advance', now: state.updatedAt + 2 * 60 * MIN });
	assert.equal(state.requests[q.id].status, 'awaiting-confirmation');
});

test('joining keeps NPC work visible and lets it progress, but requires player confirmation', () => {
	let state = observed(setup());
	state = reduce(state, { type: 'join', requestId: 'request:coast', playerId: 'player:a' });
	state = reduce(state, { type: 'advance', now: START + 2 * 60 * MIN });
	assert.equal(state.requests['request:coast'].status, 'awaiting-confirmation');
	const command = { type: 'confirm', requestId: 'request:coast', evidenceId: 'board:receipt:1', outcome: 'completed', now: state.updatedAt };
	assert.equal(reduceLivingWorld(state, command).error, 'player-confirmation-required');
	state = reduce(state, { ...command, playerId: 'player:a' });
	assert.equal(state.requests['request:coast'].status, 'completed');
	assert.deepEqual(state.requests['request:coast'].participants, ['player:a']);
});

test('destroyed sites and earthquakes pause work; clearing an observation resumes rather than repairs', () => {
	let state = observed(setup());
	state = reduce(state, { type: 'advance', now: START + 5 * MIN });
	const progress = state.requests['request:coast'].progressMs;
	state = reduce(state, { type: 'situation', situation: { destroyedSites: ['site:coast'] } });
	state = reduce(state, { type: 'advance', now: START + 45 * MIN });
	assert.equal(state.requests['request:coast'].blockedReason, 'site-destroyed');
	assert.equal(state.requests['request:coast'].progressMs, progress);
	state = reduce(state, { type: 'situation', situation: { hazard: 0.9 } });
	state = reduce(state, { type: 'advance', now: START + 60 * MIN });
	assert.equal(state.actors['npc:helper'].activity, 'sheltering');
	assert.equal(state.requests['request:coast'].progressMs, progress);
	state = reduce(state, { type: 'situation', situation: {} });
	assert.equal(state.requests['request:coast'].status, 'active');
	assert.equal(state.requests['request:coast'].completedAt, null);
});

test('unavailable giver and actor, blocked route and personal work schedule stop progress', () => {
	for (const situation of [
		{ unavailableActors: ['npc:giver'] }, { unavailableActors: ['npc:helper'] }, { blockedSites: ['site:coast'] },
	]) {
		let state = observed(setup());
		state = reduce(state, { type: 'advance', now: START + 60 * MIN, situation });
		assert.equal(state.requests['request:coast'].progressMs, 0);
		assert.equal(state.requests['request:coast'].status, 'paused');
	}
	let state = observed(setup({ helper: { sites: { work: 'shop:one' } } }));
	state = reduce(state, { type: 'advance', now: START + 60 * MIN });
	assert.equal(state.requests['request:coast'].progressMs, 0);
	assert.equal(state.actors['npc:helper'].activity, 'working');
});

test('source confirmation is idempotent and cannot be undone by re-observation', () => {
	let state = observed(setup());
	const confirm = { type: 'confirm', requestId: 'request:coast', actorId: 'npc:helper', evidenceId: 'source:receipt:1', outcome: 'completed' };
	state = reduce(state, confirm);
	assert.equal(state.requests['request:coast'].status, 'completed');
	const again = reduceLivingWorld(state, { ...confirm, now: state.updatedAt });
	assert.strictEqual(again.state, state); assert.deepEqual(again.events, []);
	assert.equal(reduceLivingWorld(state, { ...confirm, evidenceId: 'other', now: state.updatedAt }).error, 'already-settled');
	const reobserve = reduceLivingWorld(state, { type: 'register-request', request: request(), now: START + MIN });
	assert.strictEqual(reobserve.state, state);
	assert.equal(reduceLivingWorld(state, { type: 'register-request', request: request('request:coast', { siteId: 'elsewhere' }), now: state.updatedAt }).error, 'request-identity-conflict');
});

test('observed scene claims align a real NPC without bypassing player reservations or assignments', () => {
	let state = setup();
	assert.equal(reduceLivingWorld(state, { type: 'confirm', requestId: 'request:coast', evidenceId: 'narration', outcome: 'completed', now: START }).error, 'not-ready');
	assert.equal(reduceLivingWorld(state, { type: 'observe-start', requestId: 'request:coast', actorId: 'invented', now: START }).error, 'unknown-actor');
	state = observed(state);
	assert.equal(state.requests['request:coast'].actorId, 'npc:helper');
	state = reduce(state, { type: 'register-actor', actor: actor('npc:other') });
	assert.equal(reduceLivingWorld(state, { type: 'observe-start', requestId: 'request:coast', actorId: 'npc:other', now: START }).error, 'assigned-to-another-actor');
	state = reduce(state, { type: 'confirm', requestId: 'request:coast', actorId: 'npc:helper', evidenceId: 'physical:done', outcome: 'completed' });
	assert.equal(state.requests['request:coast'].status, 'completed');
	assert.equal(state.actors['npc:helper'].taskId, null);
});

test('influence is recorded against registered choices without inventing consent, money or terrain', () => {
	let state = setup();
	const before = JSON.stringify(state);
	assert.equal(reduceLivingWorld(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'build-castle', now: START }).error, 'unknown-choice');
	assert.equal(JSON.stringify(state), before);
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'coast', reason: 'I can help keep it safe.' });
	assert.equal(state.requests['request:coast'].proposals[0].status, 'proposed');
	assert.equal(state.requests['request:coast'].status, 'open');
	assert.equal(state.events.at(-1).type, 'proposal');
	assert.match(state.events.at(-1).text, /Consent.*cost.*agreement/);
	assert.equal(reduceLivingWorld(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'coast', reason: 'I can help keep it safe.', now: START }).events.length, 0);
});

test('shared participation cannot be silently converted to an exclusive reservation', () => {
	let state = setup();
	for (let i = 0; i < LIVING_WORLD_LIMITS.participants; i++) state = reduce(state, { type: 'join', requestId: 'request:coast', playerId: `player:${i}` });
	assert.equal(reduceLivingWorld(state, { type: 'join', requestId: 'request:coast', playerId: 'one-too-many', now: START }).error, 'participant-capacity');
	assert.equal(reduceLivingWorld(state, { type: 'reserve', requestId: 'request:coast', playerId: 'player:0', now: START }).error, 'already-cooperative');
	state = reduce(state, { type: 'release', requestId: 'request:coast', playerId: 'player:0' });
	assert.equal(state.requests['request:coast'].participants.length, 7);
});

test('late observations cannot acquire retroactive progress', () => {
	let state = createLivingWorldState({ world: 'earth', region: 'coast', now: START });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:giver'), now: START + 55 * MIN });
	state = reduce(state, { type: 'register-actor', actor: actor('npc:helper'), now: START + 55 * MIN });
	state = reduce(state, { type: 'register-request', request: request(), now: START + 55 * MIN });
	state = reduce(state, { type: 'advance', now: START + 60 * MIN });
	assert.ok(state.requests['request:coast'].progressMs <= 5 * MIN);
	assert.ok(state.events.filter((e) => e.type === 'npc-joined').every((e) => e.at >= START + 55 * MIN));
});

test('capacity fails explicitly without silently losing histories, claims or IDs', () => {
	let state = setup();
	for (let i = Object.keys(state.actors).length; i < LIVING_WORLD_LIMITS.actors; i++) state = reduce(state, { type: 'register-actor', actor: actor(`npc:${i}`) });
	const before = JSON.stringify(state);
	assert.equal(reduceLivingWorld(state, { type: 'register-actor', actor: actor('overflow'), now: START }).error, 'actor-capacity');
	assert.equal(JSON.stringify(state), before);
	for (let i = 1; i < LIVING_WORLD_LIMITS.requests; i++) state = reduce(state, { type: 'register-request', request: request(`request:${i}`) });
	assert.equal(reduceLivingWorld(state, { type: 'register-request', request: request('overflow'), now: START }).error, 'request-capacity');
	assert.ok(state.events.length <= LIVING_WORLD_LIMITS.events);
	assert.equal(Object.keys(state.requests).length, 128);
});

test('invalid IDs, stale commands and nonfinite times cannot corrupt persisted JSON state', () => {
	const state = setup();
	for (const id of ['__proto__', 'constructor', 'prototype', 'x'.repeat(161), ' npc:one', '\0']) {
		assert.equal(reduceLivingWorld(state, { type: 'register-actor', actor: actor(id), now: START }).error, 'invalid-actor');
	}
	assert.equal(reduceLivingWorld(state, { type: 'advance', now: Infinity }).error, 'invalid-time');
	assert.equal(reduceLivingWorld(state, { type: 'reserve', now: START - 1, requestId: 'request:coast', playerId: 'player:a' }).error, 'stale-command');
	assert.equal({}.polluted, undefined);
});

test('view is a detached public activity record with identifiers and no private dialogue', () => {
	const state = reduce(setup(), { type: 'advance', now: START + 60 * MIN });
	const view = livingWorldView(state, { limit: 3 });
	assert.equal(view.events.length, 3); assert.equal(view.requests[0].source, 'board:coast');
	assert.equal(view.world, 'earth'); assert.equal(view.region, 'coast');
	view.requests[0].title = 'changed'; view.actors.length = 0;
	assert.equal(state.requests['request:coast'].title, 'Check the coastal path');
	assert.equal(Object.keys(state.actors).length, 2);
	assert.equal('transcripts' in view, false);
});

test('only explicitly registered abstract social kinds complete without a physical receipt', () => {
	for (const kind of ['conversation', 'checkin', 'observation']) {
		let state = observed(setup({ req: { kind, completionMode: 'social' } }));
		state = reduce(state, { type: 'advance', now: START + 60 * MIN });
		assert.equal(state.requests['request:coast'].status, 'completed');
		const done = state.events.find((e) => e.type === 'social-completed');
		assert.equal(done.simulated, true);
		assert.match(done.evidenceId, /^simulation:/);
		assert.equal('credits' in done, false); assert.equal('items' in done, false);
	}
	for (const kind of ['repair', 'construction', 'delivery', 'trade', 'combat', 'new-unknown-kind']) {
		let state = observed(setup({ req: { kind, completionMode: 'social' } }));
		assert.equal(state.requests['request:coast'].completionMode, 'physical');
		state = reduce(state, { type: 'advance', now: START + 60 * MIN });
		assert.equal(state.requests['request:coast'].status, 'awaiting-confirmation');
	}
});

test('re-observation cannot convert an existing physical request into a simulated completion', () => {
	let state = observed(setup({ req: { kind: 'repair' } }));
	state = reduce(state, { type: 'register-request', request: request('request:coast', { kind: 'conversation', completionMode: 'social' }) });
	assert.equal(state.requests['request:coast'].kind, 'repair');
	assert.equal(state.requests['request:coast'].completionMode, 'physical');
	state = reduce(state, { type: 'advance', now: START + 60 * MIN });
	assert.equal(state.requests['request:coast'].status, 'awaiting-confirmation');
});

test('social simulation cannot finish a player reservation or joined player quest', () => {
	for (const action of ['reserve', 'join']) {
		let state = observed(setup({ req: { kind: 'checkin', completionMode: 'social' } }));
		state = reduce(state, { type: action, requestId: 'request:coast', playerId: 'player:a' });
		state = reduce(state, { type: 'advance', now: START + DAY });
		assert.notEqual(state.requests['request:coast'].status, 'completed');
		assert.equal(state.events.some((e) => e.type === 'social-completed'), false);
	}
});

test('an extreme future timestamp has bounded work and subsequent backward clocks do not replay it', () => {
	const state = setup();
	const far = reduceLivingWorld(state, { type: 'advance', now: Number.MAX_SAFE_INTEGER });
	assert.equal(far.error, undefined);
	assert.ok(far.events.length < 100, 'single-region catch-up still covers at most one day');
	assert.ok(far.state.events.length <= LIVING_WORLD_LIMITS.events);
	assert.equal(reduceLivingWorld(far.state, { type: 'advance', now: START + DAY }).state, far.state);
	assert.equal(reduceLivingWorld(far.state, { type: 'advance', now: Number.MAX_SAFE_INTEGER + 1 }).error, 'invalid-time');
});

test('unknown and malformed source representations are rejected instead of inventing an adapter', () => {
	const state = setup();
	for (const source of [null, {}, [], 42, '', '__proto__']) {
		assert.equal(reduceLivingWorld(state, { type: 'register-request', request: request('other', { source }), now: START }).error, 'invalid-request');
	}
	// Named source IDs belong to the real adapter registry at the trust boundary, not a
	// hardcoded Earth-only catalog in this cross-planet pure reducer.
	assert.equal(reduceLivingWorld(state, { type: 'register-request', request: request('other', { source: 'moon:registered-board' }), now: START }).error, undefined);
});

const SCHEDULE_CHOICES = [
	{ id: 'priority', label: 'Please make this a priority', effect: 'prioritize' },
	{ id: 'later', label: 'Give us an hour', effect: 'defer' },
	{ id: 'continue', label: 'Let us continue', effect: 'resume' },
];
function scheduled() {
	return reduce(setup({ req: { choices: SCHEDULE_CHOICES } }), {
		type: 'register-actor', actor: actor('npc:giver', { disposition: { helpful: 1, reliable: 1 } }),
	});
}

test('grounded schedule persuasion has deterministic consent and an actionable recorded result', () => {
	const initial = scheduled();
	const command = { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'priority', now: START };
	const a = reduceLivingWorld(initial, command), b = reduceLivingWorld(JSON.parse(JSON.stringify(initial)), command);
	assert.deepEqual(a, b);
	const q = a.state.requests['request:coast'];
	assert.equal(q.proposals[0].status, 'accepted');
	assert.equal(q.priority, 1);
	assert.match(q.proposals[0].decisionReason, /consider this request first/);
	assert.equal(a.events.at(-1).status, 'accepted');
	assert.equal(reduceLivingWorld(a.state, command).events.length, 0, 'same agreement cannot apply twice');
});

test('an agreed delay pauses work for one hour without extending on repeated proposals', () => {
	let state = observed(scheduled());
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'later' });
	assert.equal(state.requests['request:coast'].proposals[0].status, 'accepted');
	assert.equal(state.requests['request:coast'].deferredUntil, START + 60 * MIN);
	state = reduce(state, { type: 'advance', now: START + 30 * MIN });
	assert.equal(state.requests['request:coast'].progressMs, 0);
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'later', reason: 'Still waiting.' });
	assert.equal(state.requests['request:coast'].deferredUntil, START + 60 * MIN, 'repeating with another explanation cannot extend the active delay');
	state = reduce(state, { type: 'advance', now: START + 65 * MIN });
	assert.equal(state.requests['request:coast'].status, 'active');
	assert.ok(state.requests['request:coast'].progressMs > 0);
});

test('resume agreement is bounded by consent and actual local conditions', () => {
	let state = observed(scheduled());
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'later' });
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'continue', now: START + 30 * MIN });
	assert.equal(state.requests['request:coast'].proposals[0].status, 'accepted');
	assert.equal(state.requests['request:coast'].deferredUntil, null);
	assert.equal(state.requests['request:coast'].progressMs, 0, 'ending a delay does not backdate progress');
	state = reduce(state, { type: 'situation', situation: { destroyedSites: ['site:coast'] } });
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'priority' });
	assert.equal(state.requests['request:coast'].proposals[0].status, 'rejected');
	assert.match(state.requests['request:coast'].proposals[0].decisionReason, /local conditions/);
	assert.equal(state.requests['request:coast'].priority, 0);
	assert.equal(state.requests['request:coast'].blockedReason, 'site-destroyed');
});

test('agreed priority changes which available request an NPC considers first', () => {
	let state = scheduled();
	state = reduce(state, { type: 'register-request', request: request('request:other', { choices: SCHEDULE_CHOICES }) });
	state = reduce(state, { type: 'influence', requestId: 'request:other', playerId: 'player:a', choiceId: 'priority' });
	assert.equal(state.requests['request:other'].priority, 1);
	state = reduce(state, { type: 'advance', now: START + 60 * MIN });
	assert.equal(state.events.find((e) => e.type === 'npc-joined').requestId, 'request:other');
});

test('unavailable owners and player reservations cannot be bypassed by schedule persuasion', () => {
	let state = scheduled();
	state = reduce(state, { type: 'situation', situation: { unavailableActors: ['npc:giver'] } });
	state = reduce(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:a', choiceId: 'later' });
	assert.equal(state.requests['request:coast'].proposals[0].status, 'rejected');
	assert.equal(state.requests['request:coast'].deferredUntil, null);
	state = reduce(state, { type: 'reserve', requestId: 'request:coast', playerId: 'player:a' });
	assert.equal(reduceLivingWorld(state, { type: 'influence', requestId: 'request:coast', playerId: 'player:b', choiceId: 'continue', now: START }).error, 'reserved-by-another-player');
});

test('clearing a past disaster observation does not retroactively simulate blocked work', () => {
	let state = observed(setup());
	state = reduce(state, { type: 'situation', situation: { hazard: 1 } });
	state = reduce(state, { type: 'situation', situation: {}, now: START + 30 * MIN });
	assert.equal(state.requests['request:coast'].progressMs, 0);
	state = reduce(state, { type: 'advance', now: START + 35 * MIN });
	assert.equal(state.requests['request:coast'].progressMs, 5 * MIN);
});

test('observed source claims still respect NPC eligibility and skill requirements', () => {
	const command = { type: 'observe-start', requestId: 'request:coast', actorId: 'npc:helper', now: START };
	assert.equal(reduceLivingWorld(setup({ req: { allowNpc: false } }), command).error, 'npc-not-allowed');
	assert.equal(reduceLivingWorld(setup({ req: { requiredSkills: ['structural-engineering'] } }), command).error, 'missing-skill');
});
