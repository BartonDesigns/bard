import test from 'node:test';
import assert from 'node:assert/strict';
import {
	COMMUNITY_FEATURE, PROJECT_DELAY_MS, PROJECT_WORK_MS, PROJECT_LIMITS,
	projectKey, createProjectState, reduceProjects, projectView,
} from '../src/people/community-projects-core.js';

const START = Date.UTC(2026, 9, 14, 12);
const source = (siteId = 'site:coast', extra = {}) => ({
	siteId, name: 'Coastal path', kind: 'path', anchor: { x: 120, y: 10, z: -90 },
	npcId: 'npc:maya', npcName: 'Maya', ...extra,
});
function apply(state, command) {
	const result = reduceProjects(state, { now: state.updatedAt, ...command });
	assert.equal(result.error, undefined, JSON.stringify(command));
	assert.doesNotThrow(() => JSON.parse(JSON.stringify(result.state)));
	return result.state;
}
function setup({ world = 'earth', region = 'coast', project = source() } = {}) {
	return apply(createProjectState({ world, region, now: START }), { type: 'propose', actorId: 'traveller:a', project });
}
const idOf = (state) => Object.keys(state.projects)[0];
function contribute(state, id, kind = 'work', extra = {}) {
	return apply(state, { type: 'contribute', actorId: 'traveller:a', projectId: idOf(state), evidence: { id, kind }, ...extra });
}
function building(initial = setup()) {
	let state = contribute(initial, 'receipt:survey', 'survey');
	for (let i = 0; i < 3; i++) state = contribute(state, `receipt:work:${i}`, 'work', { now: START + (i + 1) * PROJECT_WORK_MS });
	return state;
}
function fails(state, command, expected) {
	const before = JSON.stringify(state);
	const result = reduceProjects(state, { now: state.updatedAt, ...command });
	assert.equal(result.error, expected);
	assert.strictEqual(result.state, state);
	assert.deepEqual(result.events, []);
	assert.equal(JSON.stringify(state), before, 'rejected command does not alter its input');
}

test('stable scope/site keys isolate planets and delimiter-like IDs', () => {
	assert.equal(COMMUNITY_FEATURE, 'world-projects-v1');
	assert.equal(PROJECT_DELAY_MS, 86400000); assert.equal(PROJECT_WORK_MS, 30000);
	assert.notEqual(projectKey('earth:coast', 'north', 'dock'), projectKey('earth', 'coast:north', 'dock'));
	assert.notEqual(projectKey('earth', 'coast', 'dock'), projectKey('moon', 'coast', 'dock'));
	assert.throws(() => createProjectState({ world: '', region: 'coast' }), /required/);
	assert.throws(() => projectKey('earth', 'coast', '__proto__'), /required/);
	assert.throws(() => projectKey('earth', 'coast', '\ud800'), /required/);
	const state = setup();
	fails(state, { type: 'advance', world: 'moon' }, 'scope-mismatch');
	fails(state, { type: 'advance', region: '' }, 'scope-mismatch');
	fails(state, { type: 'contribute', actorId: 'traveller:a', projectId: projectKey('moon', 'coast', 'site:coast'), evidence: { id: 'wrong', kind: 'work' } }, 'unknown-project');
});

test('proposals require real source descriptors and whitelisted construction kinds', () => {
	const state = createProjectState({ world: 'moon', region: 'settlement', now: START });
	for (const project of [
		source('', {}), source('site', { kind: 'give-money' }), source('site', { name: '' }),
		source('site', { anchor: { x: NaN, y: 0, z: 0 } }), source('site', { anchor: { x: 1, y: 0 } }),
		source('site', { anchor: { x: 1, y: 0, z: 2, effect: 'destroy' } }), source('site', { readyAt: START }),
		source('site', { price: 20 }), source('site', { effect: 'repair' }), source('site', { npcId: undefined }),
	]) fails(state, { type: 'propose', actorId: 'traveller:a', project }, 'invalid-project');
	for (const kind of ['path', 'garden', 'gathering', 'resonance']) {
		const next = apply(state, { type: 'propose', actorId: 'traveller:a', project: source(`site:${kind}`, { kind }) });
		assert.equal(next.projects[idOf(next)].kind, kind);
	}
	fails(state, { type: 'propose', actorId: '__proto__', project: source() }, 'invalid-actor');
});

test('reobserving a source preserves its chosen kind, anchor, history and ownership', () => {
	const initial = setup();
	const state = contribute(initial, 'one', 'survey');
	const same = reduceProjects(state, { type: 'propose', now: START + 1000, actorId: 'traveller:b', project: source('site:coast', { name: 'New suggested name', npcId: 'npc:other', npcName: 'Other' }) });
	assert.strictEqual(same.state, state); assert.deepEqual(same.events, []);
	assert.equal(same.project.name, 'Coastal path'); assert.equal(same.project.createdBy, 'traveller:a');
	fails(state, { type: 'propose', actorId: 'traveller:b', project: source('site:coast', { kind: 'garden' }) }, 'project-kind-conflict');
	fails(state, { type: 'propose', actorId: 'traveller:b', project: source('site:coast', { anchor: { x: 200, y: 10, z: -90 } }) }, 'project-location-conflict');
});

test('cooperative survey and three observed work units create a minimum one-day build', () => {
	let state = setup();
	assert.equal(state.projects[idOf(state)].status, 'surveying');
	state = contribute(state, 'survey', 'survey', { actorId: 'traveller:a' });
	assert.equal(state.projects[idOf(state)].status, 'preparing');
	state = contribute(state, 'work:a', 'work', { actorId: 'traveller:b', now: START + PROJECT_WORK_MS });
	state = contribute(state, 'work:b', 'work', { actorId: 'npc:maya', provenance: 'npc-observed', now: START + 2 * PROJECT_WORK_MS });
	state = contribute(state, 'ignored', 'service', {
		actorId: 'traveller:a', now: START + 3 * PROJECT_WORK_MS,
		evidence: { id: 'service:a', kind: 'service', sourceId: 'request:lost-item', beneficiaryId: 'npc:maya' },
	});
	const p = state.projects[idOf(state)];
	assert.equal(p.status, 'building'); assert.equal(p.surveyCount, 1); assert.equal(p.workCount, 3);
	assert.equal(p.readyAt, START + 3 * PROJECT_WORK_MS + PROJECT_DELAY_MS); assert.equal(p.completedAt, null);
	assert.equal(p.contributionCount, 4); assert.equal(p.contributors.length, 3);
	assert.equal(p.contributors.find((c) => c.actorId === 'traveller:a').serviceCount, 1);
	assert.equal(state.events.filter((e) => e.type === 'project-building').length, 1);
	const before = apply(state, { type: 'advance', now: p.readyAt - 1 });
	assert.equal(before.projects[p.id].status, 'building');
	const finished = apply(before, { type: 'advance', now: p.readyAt });
	assert.equal(finished.projects[p.id].status, 'completed');
	assert.equal(finished.projects[p.id].completedAt, p.readyAt);
	assert.equal(finished.events.filter((e) => e.type === 'project-completed').length, 1);
	assert.equal('money' in finished, false); assert.equal('inventory' in finished, false); assert.equal('structures' in finished, false);
});

test('work can be gathered before survey, but missing survey never starts construction', () => {
	let state = setup();
	for (let i = 0; i < 3; i++) state = contribute(state, `work:${i}`);
	state = apply(state, { type: 'advance', now: START + 10 * PROJECT_DELAY_MS });
	assert.equal(state.projects[idOf(state)].status, 'surveying'); assert.equal(state.projects[idOf(state)].readyAt, null);
	state = contribute(state, 'survey', 'survey');
	assert.equal(state.projects[idOf(state)].status, 'building');
	assert.equal(state.projects[idOf(state)].readyAt, state.updatedAt + PROJECT_DELAY_MS);
});

test('permanent receipts survive serialization, completion, reobservation and long absences', () => {
	let state = building();
	state = apply(state, { type: 'advance', now: state.projects[idOf(state)].readyAt + 1000 * PROJECT_DELAY_MS });
	state = JSON.parse(JSON.stringify(state));
	const before = JSON.stringify(state);
	const replay = reduceProjects(state, { type: 'contribute', actorId: 'traveller:a', projectId: idOf(state), evidence: { id: 'receipt:work:0', kind: 'work' }, now: state.updatedAt });
	assert.strictEqual(replay.state, state); assert.deepEqual(replay.events, []);
	assert.equal(JSON.stringify(state), before);
	assert.equal(Object.keys(state.receipts).length, 4);
	fails(state, { type: 'contribute', actorId: 'traveller:b', projectId: idOf(state), evidence: { id: 'receipt:work:0', kind: 'work' } }, 'evidence-conflict');
	fails(state, { type: 'contribute', actorId: 'traveller:a', projectId: idOf(state), evidence: { id: 'new', kind: 'work' } }, 'project-completed');
});

test('a receipt or completed service cannot be spent on another project or renamed for credit', () => {
	let state = setup();
	state = apply(state, { type: 'propose', actorId: 'traveller:b', project: source('site:park', { kind: 'garden' }) });
	const first = projectKey('earth', 'coast', 'site:coast'), second = projectKey('earth', 'coast', 'site:park');
	const evidence = { id: 'service:receipt', kind: 'service', sourceId: 'request:delivery', beneficiaryId: 'npc:maya' };
	state = apply(state, { type: 'contribute', actorId: 'traveller:a', projectId: first, evidence });
	fails(state, { type: 'contribute', actorId: 'traveller:a', projectId: second, evidence }, 'evidence-conflict');
	fails(state, { type: 'contribute', actorId: 'traveller:b', projectId: second, evidence: { ...evidence, id: 'renamed' } }, 'service-already-contributed');
	fails(state, { type: 'contribute', actorId: 'traveller:a', projectId: first, evidence: { ...evidence, beneficiaryId: 'npc:other' } }, 'evidence-conflict');
});

test('evidence is typed, bounded, and cannot carry arbitrary rewards, effects or times', () => {
	const state = setup();
	const base = { type: 'contribute', actorId: 'traveller:a', projectId: idOf(state) };
	for (const evidence of [
		{ id: '', kind: 'work' }, { id: 'x', kind: 'completed' }, { id: 'x', kind: 'service' },
		{ id: 'x', kind: 'work', amount: 999 }, { id: 'x', kind: 'work', now: START },
		{ id: 'x', kind: 'work', readyAt: START }, { id: 'x', kind: 'work', money: 20 },
		{ id: 'x', kind: 'work', sourceId: {} }, { id: 'x', kind: 'work', beneficiaryId: '__proto__' },
		{ id: 'x', kind: 'work', effects: ['repair'] }, { id: 'x'.repeat(161), kind: 'work' },
	]) fails(state, { ...base, evidence }, 'invalid-evidence');
	fails(state, { ...base, evidence: { id: 'x', kind: 'work' }, provenance: 'LLM-said-so' }, 'invalid-evidence');
	fails(state, { ...base, evidence: { id: 'x', kind: 'work' }, amount: 999 }, 'invalid-command');
	fails(state, { type: 'finish', projectId: idOf(state) }, 'unknown-command');
});

test('extra contributions are rejected rather than growing receipts or minting later credit', () => {
	let state = contribute(setup(), 'survey', 'survey');
	fails(state, { type: 'contribute', actorId: 'traveller:b', projectId: idOf(state), evidence: { id: 'survey2', kind: 'survey' } }, 'contribution-not-needed');
	for (let i = 0; i < 3; i++) state = contribute(state, `work:${i}`);
	fails(state, { type: 'contribute', actorId: 'traveller:b', projectId: idOf(state), evidence: { id: 'work4', kind: 'work' } }, 'contribution-not-needed');
	assert.equal(Object.keys(state.receipts).length, 4);
});

test('cataclysms and blocked sites stop contributions and due completion until safe', () => {
	for (const situation of [{ hazard: 0.9 }, { blockedSites: ['site:coast'] }]) {
		let state = setup();
		state = apply(state, { type: 'advance', situation });
		const reason = situation.hazard ? 'local-emergency' : 'site-inaccessible';
		assert.equal(state.projects[idOf(state)].blockedReason, reason);
		fails(state, { type: 'contribute', actorId: 'traveller:a', projectId: idOf(state), evidence: { id: 'unsafe', kind: 'work' } }, reason);
		state = apply(state, { type: 'advance', situation: {} });
		state = building(state);
		const readyAt = state.projects[idOf(state)].readyAt;
		state = apply(state, { type: 'advance', now: readyAt, situation });
		assert.equal(state.projects[idOf(state)].status, 'building'); assert.equal(state.projects[idOf(state)].completedAt, null);
		state = apply(state, { type: 'advance', now: readyAt + PROJECT_DELAY_MS });
		assert.equal(state.projects[idOf(state)].status, 'building', 'absence does not erase a known hazard');
		state = apply(state, { type: 'advance', now: readyAt + 2 * PROJECT_DELAY_MS, situation: { hazard: 0, blockedSites: [] } });
		assert.equal(state.projects[idOf(state)].status, 'completed');
		assert.equal(state.projects[idOf(state)].completedAt, readyAt + 2 * PROJECT_DELAY_MS);
		assert.equal(state.projects[idOf(state)].readyAt, readyAt, 'history retains the original minimum due time');
	}
});

test('completed development is not undone or repaired by later emergency observations', () => {
	let state = building();
	const readyAt = state.projects[idOf(state)].readyAt;
	state = apply(state, { type: 'advance', now: readyAt });
	const p = JSON.stringify(state.projects[idOf(state)]);
	state = apply(state, { type: 'advance', now: readyAt + 100, situation: { hazard: 1, blockedSites: ['site:coast'] } });
	assert.equal(JSON.stringify(state.projects[idOf(state)]), p);
	assert.equal(state.events.filter((e) => e.type === 'project-completed').length, 1);
});

test('rollback and invalid clock/situation observations fail without erasing newer safety state', () => {
	let state = building();
	state = apply(state, { type: 'advance', now: state.updatedAt + 100, situation: { hazard: 1 } });
	fails(state, { type: 'advance', now: START, situation: {} }, 'stale-command');
	for (const now of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) fails(state, { type: 'advance', now }, 'invalid-time');
	for (const situation of [{ hazard: 2 }, { hazard: 'safe' }, { blockedSites: [null] }, { hazard: 0, repairEverything: true }, null]) {
		fails(state, { type: 'advance', situation }, 'invalid-situation');
	}
	assert.equal(state.situation.hazard, 1);
});

test('regional capacity is explicit and keeps completed projects and permanent history', () => {
	let state = building();
	state = apply(state, { type: 'advance', now: state.projects[idOf(state)].readyAt });
	const finishedId = idOf(state), receiptCount = Object.keys(state.receipts).length;
	for (let i = 1; i < PROJECT_LIMITS.projects; i++) state = apply(state, { type: 'propose', actorId: 'traveller:a', project: source(`site:${i}`) });
	fails(state, { type: 'propose', actorId: 'traveller:a', project: source('site:overflow') }, 'project-capacity');
	assert.equal(state.projects[finishedId].status, 'completed');
	assert.equal(Object.keys(state.receipts).length, receiptCount);
	assert.equal(Object.keys(state.projects).length, 64);
});

test('JSON restore and deterministic replay preserve progress; view is isolated and excludes receipts', () => {
	const initial = building(), before = JSON.stringify(initial);
	const command = { type: 'advance', now: initial.projects[idOf(initial)].readyAt };
	const first = reduceProjects(initial, command), replay = reduceProjects(JSON.parse(before), command);
	assert.deepEqual(first, replay); assert.equal(JSON.stringify(initial), before);
	const same = reduceProjects(first.state, command);
	assert.strictEqual(same.state, first.state); assert.deepEqual(same.events, []);
	const view = projectView(first.state);
	assert.equal(view.world, 'earth'); assert.equal(view.region, 'coast'); assert.ok(view.revision > 0);
	assert.equal('receipts' in view, false); assert.equal('chat' in view.projects[0], false);
	view.projects[0].anchor.x = 500; view.events.length = 0;
	assert.equal(first.state.projects[idOf(first.state)].anchor.x, 120); assert.ok(first.state.events.length > 0);
	assert.equal(reduceProjects({ version: 999 }, command).error, 'invalid-state');
	assert.throws(() => projectView({}), /Invalid/);
});

test('recent history is bounded while safety changes cannot prune accepted receipt identities', () => {
	let state = contribute(setup(), 'permanent', 'survey');
	for (let i = 1; i <= 220; i++) state = apply(state, { type: 'advance', now: START + i, situation: { hazard: i % 2 } });
	assert.equal(state.events.length, PROJECT_LIMITS.events);
	assert.equal(state.projects[idOf(state)].history.length, PROJECT_LIMITS.history);
	assert.ok(state.receipts.permanent);
	const same = reduceProjects(state, { type: 'contribute', projectId: idOf(state), actorId: 'traveller:a', evidence: { id: 'permanent', kind: 'survey' }, now: state.updatedAt });
	assert.strictEqual(same.state, state);
});

test('geographic anchors survive frame rebasing without relocating an established site', () => {
	const geographic = { x: 120, y: 10, z: -90, lat: 37.807, lon: -122.477 };
	const state = setup({ project: source('site:coast', { anchor: geographic }) });
	const rebased = reduceProjects(state, {
		type: 'propose', now: state.updatedAt, actorId: 'traveller:b',
		project: source('site:coast', { anchor: { x: -100000, y: 12, z: 800000, lat: 37.807 + 1e-9, lon: -122.477 } }),
	});
	assert.strictEqual(rebased.state, state);
	assert.deepEqual(projectView(state).projects[0].anchor, geographic);
	fails(state, {
		type: 'propose', actorId: 'traveller:b',
		project: source('site:coast', { anchor: { ...geographic, lat: 37.9 } }),
	}, 'project-location-conflict');
	for (const anchor of [{ ...geographic, lat: 91 }, { ...geographic, lon: -181 }, { x: 0, y: 0, z: 0, lat: 37 }]) {
		fails(state, { type: 'propose', actorId: 'traveller:b', project: source('site:new', { anchor }) }, 'invalid-project');
	}
});

test('corrupt saved progress is rejected without clearing or partly repairing its history', () => {
	const initial = building();
	for (const corrupt of [
		(s) => { s.projects[idOf(s)].contributors = [null]; },
		(s) => { s.projects[idOf(s)].workCount = 900; },
		(s) => { s.projects[idOf(s)].readyAt = START; },
		(s) => { s.projects[idOf(s)].completedAt = START; },
		(s) => { s.projects[idOf(s)].contributionCount = 0; },
		(s) => { s.projects[idOf(s)].anchor.lat = 40; },
		(s) => { delete s.receipts['receipt:work:0']; },
		(s) => { s.receipts['receipt:work:0'] = null; },
		(s) => { s.receipts['receipt:work:0'].projectId = 'other-world'; },
	]) {
		const state = JSON.parse(JSON.stringify(initial)); corrupt(state);
		fails(state, { type: 'advance', now: START + 2 * PROJECT_DELAY_MS }, 'invalid-state');
		assert.throws(() => projectView(state), /Invalid/);
	}
});
