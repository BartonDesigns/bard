import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityProjects } from '../src/people/community-projects.js';
import { COMMUNITY_FEATURE, PROJECT_DELAY_MS, createProjectState, projectView, reduceProjects } from '../src/people/community-projects-core.js';
import { LivingRegion } from '../../server/multiplayer/src/living-region.js';
import { handle } from '../../server/multiplayer/src/index.js';

const START = Date.UTC(2026, 9, 14, 12);
const copy = value => JSON.parse(JSON.stringify(value));
const reply = (data, status = 200) => ({ ok: status < 400, status, json: async () => copy(data) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function memory() {
	const values = new Map();
	return { values, broken: false, getItem(key) { return values.get(key) || null; }, setItem(key, value) { if (this.broken) throw Error('disk full'); values.set(key, value); } };
}
function server(env) {
	const states = new Map(), seen = new Map(), sites = new Map(), challenges = new Map();
	const api = { feature: true, online: true, calls: [], loseNext: null, hold: null, corruptNext: false, situation: {} };
	function get(world, region) {
		const key = `${world}/${region}`;
		if (!states.has(key)) { states.set(key, createProjectState({ world, region, now: env.now })); sites.set(key, []); }
		return { key, state: states.get(key) };
	}
	api.state = (world = env.world, region = env.region) => get(world, region).state;
	api.holdNext = predicate => { const entered = deferred(), release = deferred(); api.hold = { predicate, entered, release }; return { entered: entered.promise, release: release.resolve }; };
	api.request = async (url, options = {}) => {
		const path = new URL(url).pathname, body = options.body ? JSON.parse(options.body) : null;
		const call = { path, body, token: (options.headers?.authorization || '').replace('Bearer ', '') }; api.calls.push(call);
		if (!api.online) throw Error('Service offline');
		if (path === '/status') return reply({ features: api.feature ? [COMMUNITY_FEATURE] : [] });
		const [, , rawWorld, rawRegion] = path.split('/'), world = decodeURIComponent(rawWorld), region = decodeURIComponent(rawRegion);
		const current = get(world, region), actorId = call.token || 'player';
		const advanced = reduceProjects(current.state, { type: 'advance', now: env.now, situation: api.situation });
		assert.equal(advanced.error, undefined); states.set(current.key, advanced.state);
		const opKey = body ? current.key + ':' + actorId + ':' + body.id : null;
		let data = opKey && seen.get(opKey);
		if (!data) {
			let receipt = {}, result = null;
			if (body?.op === 'register') sites.set(current.key, body.sites?.length ? copy(body.sites) : sites.get(current.key));
			if (body?.op === 'project-propose') {
				const site = sites.get(current.key).find(s => s.id === body.project.siteId);
				const project = body.project.anchor ? body.project : { siteId: site.id, name: site.name, anchor: site.anchor, kind: body.project.kind };
				result = reduceProjects(states.get(current.key), { type: 'propose', actorId, project, now: env.now });
			}
			if (body?.op === 'project-start') {
				const challenge = { id: 'challenge:' + body.id, projectId: body.projectId, kind: body.kind, readyAt: env.now + (body.kind === 'survey' ? 5000 : 30000), expiresAt: env.now + 600000 };
				challenges.set(current.key + actorId, challenge); receipt = { challenge };
			}
			if (body?.op === 'project-complete') {
				const challenge = challenges.get(current.key + actorId);
				if (!challenge || challenge.id !== body.challengeId || challenge.readyAt > env.now || challenge.expiresAt < env.now) return reply({ error: 'Invalid or unfinished challenge' }, 409);
				result = reduceProjects(states.get(current.key), { type: 'contribute', actorId, projectId: body.projectId, now: env.now, evidence: { id: challenge.id, kind: challenge.kind } });
			}
			if (body?.op === 'project-service') {
				result = reduceProjects(states.get(current.key), { type: 'contribute', actorId, projectId: body.projectId, now: env.now,
					evidence: { id: 'service:' + body.requestId, kind: 'service', sourceId: body.requestId } });
			}
			if (result?.error) return reply({ error: result.error }, 409);
			if (result) states.set(current.key, result.state);
			data = { world, region, projects: projectView(states.get(current.key)), sites: copy(sites.get(current.key)), receipt };
			if (opKey) seen.set(opKey, copy(data));
		}
		if (api.hold?.predicate(call)) { const hold = api.hold; api.hold = null; hold.entered.resolve(); await hold.release.promise; }
		if (api.loseNext === body?.op) { api.loseNext = null; throw Error('Response lost after server commit'); }
		if (api.corruptNext) { api.corruptNext = false; data = copy(data); data.projects.projects[0].history = null; }
		return reply(data);
	};
	return api;
}
function fixture({ shared = false, storage = memory() } = {}) {
	const env = { now: START, world: 'earth', region: 'coast', token: 'traveller:a', at: { x: 0, y: 0, z: 0 }, danger: {}, eligible: true, activities: [], storage, hints: [], marks: [], livingReads: 0 };
	env.candidates = [{ id: 'site:coast', name: 'Coastal path', anchor: { x: 0, y: 0, z: 0 }, source: 'place', npcId: 'npc:maya', npcName: 'Maya' }];
	env.server = server(env);
	env.make = () => createCommunityProjects({
		worldKey: () => env.world, region: () => ({ id: env.region, name: env.region }), world: () => ({}),
		position: () => env.at, candidates: () => env.candidates, eligible: () => env.eligible,
		situation: () => env.danger, clock: () => env.now, storage: env.storage,
		livingWorld: { snapshot: () => { env.livingReads++; return { activities: env.activities }; }, sync: () => env.livingSync?.() },
		soul: { credentials: () => env.token }, url: shared ? 'https://rooms.test' : '', request: env.server.request,
		hint: text => env.hints.push(text), mark: p => env.marks.push(p), play: () => true,
	});
	env.runtime = env.make();
	return env;
}
async function propose(env, kind = 'path') {
	const result = await env.runtime.action('site:coast', 'propose', { kind });
	assert.equal(result.ok, true, result.message);
	return env.runtime.snapshot().projects[0].id;
}
async function ticks(env, seconds) {
	for (let i = 0; i < seconds * 4; i++) { env.now += 250; env.runtime.update(.25); await Promise.resolve(); }
	await env.runtime.sync();
}
async function work(env, id, kind = 'work') {
	const started = await env.runtime.action(id, 'start', { kind }); assert.equal(started.ok, true, started.message);
	await ticks(env, kind === 'survey' ? 5 : 30);
	const finished = await env.runtime.action(id, 'finish'); assert.equal(finished.ok, true, finished.message);
}

test('local work requires active time, range and explicit confirmation, then a full day to materialize', async () => {
	const env = fixture(), id = await propose(env);
	assert.equal(env.runtime.snapshot().mode, 'local');
	assert.equal((await env.runtime.action(id, 'finish')).ok, false);
	assert.equal((await env.runtime.action(id, 'start', { kind: 'survey' })).ok, true);
	env.now += 60000; env.runtime.update(60);
	assert.equal(env.runtime.snapshot().active.elapsedMs, 250, 'a long/background frame cannot credit a minute of active work');
	assert.equal((await env.runtime.action(id, 'finish')).ok, false);
	await ticks(env, 5);
	assert.equal(env.runtime.snapshot().projects[0].surveyCount, 0, 'elapsed time alone does not submit findings');
	assert.equal((await env.runtime.action(id, 'finish')).ok, true);
	for (let i = 0; i < 3; i++) await work(env, id);
	const p = env.runtime.snapshot().projects[0]; assert.equal(p.status, 'building'); assert.equal(p.readyAt, env.now + PROJECT_DELAY_MS);
	env.now = p.readyAt - 6000; await ticks(env, 5); assert.equal(env.runtime.snapshot().projects[0].status, 'building');
	env.now = p.readyAt; await ticks(env, 5); assert.equal(env.runtime.snapshot().projects[0].status, 'completed');
	assert.equal((await env.runtime.action(id, 'finish')).ok, false);
});

test('walking away, vertical separation, danger or leaving the ground cancels active work', async () => {
	for (const interrupt of [env => { env.at.x = 7; }, env => { env.at.y = 4; }, env => { env.danger = { hazard: 1 }; }, env => { env.eligible = false; }]) {
		const env = fixture(), id = await propose(env);
		assert.equal((await env.runtime.action(id, 'start', { kind: 'survey' })).ok, true);
		await ticks(env, 1); interrupt(env); env.runtime.update(.1);
		assert.equal(env.runtime.snapshot().active, null);
		assert.equal((await env.runtime.action(id, 'finish')).ok, false);
		assert.equal(env.runtime.snapshot().projects[0].surveyCount, 0);
		assert.equal(env.hints.length, 1);
	}
});

test('scope and Soul switches keep separate journals and clear active work', async () => {
	const env = fixture(), earthId = await propose(env);
	await work(env, earthId, 'survey');
	env.world = 'moon'; assert.equal(env.runtime.snapshot().projects.length, 0);
	const moonId = await propose(env); assert.notEqual(moonId, earthId);
	env.world = 'earth'; assert.equal(env.runtime.snapshot().projects[0].surveyCount, 1);
	await env.runtime.action(earthId, 'start', { kind: 'work' });
	env.token = 'traveller:b'; assert.equal(env.runtime.snapshot().projects.length, 0); assert.equal(env.runtime.snapshot().active, null);
	env.token = 'traveller:a'; assert.equal(env.runtime.snapshot().projects[0].surveyCount, 1);
	assert.equal(env.storage.values.size, 3);
});

test('old shared responses cannot overwrite another world or Soul after an asynchronous switch', async () => {
	for (const switchIdentity of [false, true]) {
		const env = fixture({ shared: true }); await env.runtime.sync();
		const hold = env.server.holdNext(call => call.body?.op === 'project-propose');
		const action = env.runtime.action('site:coast', 'propose', { kind: 'path' }); await hold.entered;
		if (switchIdentity) env.token = 'traveller:b'; else env.world = 'moon';
		assert.equal(env.runtime.snapshot().projects.length, 0);
		hold.release(); assert.equal((await action).ok, false);
		assert.equal(env.runtime.snapshot().projects.length, 0);
		assert.equal(env.runtime.snapshot().pending, false);
		assert.equal(Object.keys(env.server.state('earth', 'coast').projects).length, 1, 'the already accepted old-scope action is retained on its server');
	}
});

test('cancel and reset during an awaited server challenge cannot resurrect a session', async () => {
	for (const reset of [false, true]) {
		const env = fixture({ shared: true }), id = await propose(env);
		const hold = env.server.holdNext(call => call.body?.op === 'project-start');
		const action = env.runtime.action(id, 'start', { kind: 'survey' }); await hold.entered;
		if (reset) env.runtime.reset(); else assert.equal((await env.runtime.action(id, 'cancel')).ok, true);
		hold.release(); assert.equal((await action).ok, false);
		assert.equal(env.runtime.snapshot().active, null);
		assert.equal((await env.runtime.action(id, 'finish')).ok, false);
		assert.equal((await env.runtime.action(id, 'start', { kind: 'survey' })).ok, true, 'a fresh challenge can begin immediately');
	}
});

test('a lost completion response is retried with the same durable operation ID and credited once', async () => {
	const env = fixture({ shared: true }), id = await propose(env);
	assert.equal((await env.runtime.action(id, 'start', { kind: 'survey' })).ok, true);
	await ticks(env, 5); env.server.loseNext = 'project-complete';
	assert.equal((await env.runtime.action(id, 'finish')).ok, false);
	assert.equal(env.runtime.snapshot().pending, true);
	assert.equal(env.server.state().projects[id].surveyCount, 1);
	const old = env.runtime; old.dispose(); env.runtime = env.make();
	assert.equal(env.runtime.snapshot().mode, 'offline'); assert.equal(env.runtime.snapshot().pending, true);
	assert.equal(await env.runtime.sync(), true);
	assert.equal(env.runtime.snapshot().pending, false); assert.equal(env.runtime.snapshot().projects[0].surveyCount, 1);
	const calls = env.server.calls.filter(c => c.body?.op === 'project-complete');
	assert.equal(calls.length, 2); assert.equal(calls[0].body.id, calls[1].body.id);
	assert.equal(Object.keys(env.server.state().receipts).length, 1);
});

test('local previews never upload as completed facts when shared support becomes available', async () => {
	const env = fixture({ shared: true }); env.server.feature = false;
	const localId = await propose(env); await work(env, localId, 'survey');
	assert.equal(env.runtime.snapshot().mode, 'local'); assert.equal(env.runtime.snapshot().projects[0].shared, false);
	env.server.feature = true; assert.equal(await env.runtime.sync(), true);
	assert.equal(env.runtime.snapshot().mode, 'shared'); assert.equal(env.runtime.snapshot().projects.length, 0);
	assert.equal(env.server.calls.filter(c => c.body?.op?.startsWith('project-')).length, 0, 'local achievements have not been submitted to the service');
	const saved = [...env.storage.values.values()].map(JSON.parse)[0];
	assert.equal(Object.values(saved.local.projects)[0].surveyCount, 1, 'local history is preserved even while the shared view is shown');
	await propose(env); env.server.online = false; assert.equal(await env.runtime.sync(), false);
	assert.equal((await env.runtime.action(localId, 'start', { kind: 'survey' })).ok, false);
	assert.equal(env.runtime.snapshot().mode, 'offline', 'a known shared ledger never silently becomes local during an outage');
});

test('corrupt local and remote journals stay untouched and reject new mutations', async () => {
	for (const remote of [false, true]) {
		const env = fixture({ shared: remote }); await propose(env); env.runtime.dispose();
		const key = [...env.storage.values.keys()][0];
		if (remote) { const save = JSON.parse(env.storage.values.get(key)); save.remote.projects[0].history = null; env.storage.values.set(key, JSON.stringify(save)); }
		else env.storage.values.set(key, '{broken json');
		const original = env.storage.values.get(key); env.runtime = env.make();
		assert.match(env.runtime.snapshot().error, /could not be read/);
		assert.equal((await env.runtime.action('site:coast', 'propose', { kind: 'garden' })).ok, false);
		env.runtime.update(.25); env.runtime.dispose(); assert.equal(env.storage.values.get(key), original);
	}
});

test('invalid shared responses do not replace the last sound view or save corrupted history', async () => {
	const env = fixture({ shared: true }); await propose(env);
	const previous = copy(env.runtime.snapshot().projects);
	env.server.corruptNext = true; assert.equal(await env.runtime.sync(), false);
	assert.equal(env.runtime.snapshot().mode, 'offline'); assert.deepEqual(env.runtime.snapshot().projects, previous);
	const saved = [...env.storage.values.values()].map(JSON.parse)[0];
	assert.ok(Array.isArray(saved.remote.projects[0].history));
});

test('storage failure blocks an operation before it is sent and rolls local writes back', async () => {
	for (const shared of [false, true]) {
		const env = fixture({ shared }); env.runtime.snapshot(); if (shared) await env.runtime.sync();
		env.storage.broken = true;
		const result = await env.runtime.action('site:coast', 'propose', { kind: 'path' });
		assert.equal(result.ok, false); assert.equal(env.runtime.snapshot().projects.length, 0);
		assert.match(result.message, /could not be saved/);
		assert.equal(env.server.calls.filter(c => c.body?.op === 'project-propose').length, 0);
	}
});

test('only confirmed physical jobs for the actual site are offered and each contributes once', async () => {
	const env = fixture(), id = await propose(env);
	const completed = { id: 'request:actual', siteId: 'site:coast', physicalCompleted: true, completedBy: 'npc:maya', canContributeProject: true, beneficiaryId: 'npc:maya' };
	env.activities = [completed, { ...completed, id: 'request:story', physicalCompleted: false }, { ...completed, id: 'request:elsewhere', siteId: 'site:other' }, { ...completed, id: 'request:no-permission', canContributeProject: false }];
	assert.deepEqual(env.runtime.snapshot().projects[0].serviceSources.map(q => q.id), ['request:actual']);
	assert.equal((await env.runtime.action(id, 'contribute-service', { requestId: 'request:story' })).ok, false);
	assert.equal((await env.runtime.action(id, 'contribute-service', { requestId: 'request:actual' })).ok, true);
	assert.equal(env.runtime.snapshot().projects[0].workCount, 1); assert.deepEqual(env.runtime.snapshot().projects[0].serviceSources, []);
	assert.equal((await env.runtime.action(id, 'contribute-service', { requestId: 'request:actual' })).ok, false);
	const saved = [...env.storage.values.values()].map(JSON.parse)[0];
	assert.equal(saved.local.receipts['service:request:actual'].provenance, 'npc-observed');
	assert.equal(saved.local.receipts['service:request:actual'].beneficiaryId, 'npc:maya');
});

test('a public snapshot reads living activities once regardless of regional project count', async () => {
	const env = fixture(); await propose(env);
	env.candidates.push({ id: 'site:park', name: 'Park', anchor: { x: 3, y: 0, z: 0 } });
	assert.equal((await env.runtime.action('site:park', 'propose', { kind: 'garden' })).ok, true);
	env.livingReads = 0; assert.equal(env.runtime.snapshot().projects.length, 2); assert.equal(env.livingReads, 1);
});

test('cancellation during reconnection also prevents a later challenge from starting', async () => {
	const env = fixture({ shared: true }), id = await propose(env);
	env.server.online = false; await env.runtime.sync(); env.server.online = true;
	const hold = env.server.holdNext(call => !call.body && call.path.startsWith('/living/'));
	const action = env.runtime.action(id, 'start', { kind: 'survey' }); await hold.entered;
	await env.runtime.action(id, 'cancel'); hold.release();
	assert.equal((await action).ok, false); assert.equal(env.runtime.snapshot().active, null);
	assert.equal(env.server.calls.filter(c => c.body?.op === 'project-start').length, 0);
});

test('cheap progress reads avoid activity snapshots and still invalidate changed scopes', async () => {
	const env = fixture(), id = await propose(env); await env.runtime.action(id, 'start', { kind: 'survey' });
	env.livingReads = 0;
	for (let i = 0; i < 60; i++) assert.equal(env.runtime.progress().active.projectId, id);
	assert.equal(env.livingReads, 0);
	env.world = 'moon'; assert.equal(env.runtime.progress().active, null); assert.equal(env.runtime.progress().scope.world, 'moon');
});

test('shared hazard reports describe only nearby registered projects without replacing regional observations', async () => {
	const env = fixture({ shared: true }); await propose(env);
	env.danger = { hazard: 1, blockedSites: ['site:coast', 'site:unseen'] };
	assert.equal(await env.runtime.sync(), true);
	const report = env.server.calls.findLast(c => c.body?.projectSituation)?.body;
	assert.deepEqual(report.projectSituation, { hazard: 1, blockedSites: ['site:coast'], observedSites: ['site:coast'] });
	assert.equal('situation' in report, false, 'project observations cannot erase the living-region reports');
	env.at.x = 1000; env.danger = {};
	assert.equal(await env.runtime.sync(), true);
	const absent = env.server.calls.findLast(c => c.body?.projectSituation)?.body;
	assert.deepEqual(absent.projectSituation, { hazard: 0, blockedSites: [], observedSites: [] }, 'walking away cannot claim the unseen site has been repaired');
});

test('actual runtime and Worker contract cooperate on source registration, challenges, offline alarm completion and restore', async () => {
	const env = fixture({ shared: true }); env.token = 'a'.repeat(64);
	const objects = new Map();
	const binding = { idFromName: id => id, get(id) {
		if (!objects.has(id)) {
			const values = new Map();
			const storage = {
				async get(key) { return structuredClone(values.get(key)); },
				async put(key, value) { for (const [k, v] of typeof key === 'object' ? Object.entries(key) : [[key, value]]) values.set(k, structuredClone(v)); },
				async setAlarm() {}, async deleteAlarm() {}, async transaction(fn) { await fn(this); },
			};
			objects.set(id, new LivingRegion({ storage }, {}, () => env.now));
		}
		return objects.get(id);
	} };
	const request = (url, options = {}) => handle(new Request(url, { ...options, headers: { ...options.headers, origin: 'https://level99bard.com' } }), { LIVING: binding });
	env.server.request = request;
	let observed = 0;
	env.livingSync = async () => {
		const result = await request('https://rooms.test/living/earth/coast', { method: 'POST', headers: { authorization: 'Bearer ' + env.token },
			body: JSON.stringify({ id: 'real-citizen-observation-' + (++observed), op: 'register', actors: [{ id: 'npc:maya', name: 'Maya' }], requests: [] }) });
		assert.equal(result.status, 200, await result.clone().text());
	};
	env.runtime = env.make();
	const id = await propose(env); assert.equal(observed, 1, 'the actual source citizen is synchronized before the canonical site');
	assert.equal(env.runtime.snapshot().mode, 'shared');
	assert.equal(env.runtime.snapshot().projects[0].npcName, 'Maya');
	await work(env, id, 'survey'); for (let i = 0; i < 3; i++) await work(env, id);
	const built = env.runtime.snapshot().projects[0]; assert.equal(built.status, 'building'); assert.equal(built.readyAt, env.now + PROJECT_DELAY_MS);
	env.runtime.dispose(); env.now = built.readyAt;
	for (const object of objects.values()) await object.alarm();
	env.runtime = env.make(); assert.equal(env.runtime.snapshot().mode, 'offline');
	assert.equal(await env.runtime.sync(), true);
	assert.equal(env.runtime.snapshot().projects[0].status, 'completed');
	assert.equal(env.runtime.snapshot().projects[0].contributionCount, 4);
	assert.equal(JSON.stringify(env.runtime.snapshot().projects).includes(env.token), false);
});
