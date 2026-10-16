import test from 'node:test';
import assert from 'node:assert/strict';
import { LivingRegion, LIVING_FEATURE, LIVING_TICK_MS } from '../src/living-region.js';
import { handle } from '../src/index.js';

const memory = () => {
	const map = new Map();
	return { map, alarm: null, async get(k) { return structuredClone(map.get(k)); }, async put(k, v) { if (typeof k === 'object') for (const [key, value] of Object.entries(k)) map.set(key, structuredClone(value)); else map.set(k, structuredClone(v)); }, async setAlarm(at) { this.alarm = at; }, async deleteAlarm() { this.alarm = null; }, async transaction(fn) { const old = structuredClone(map); try { await fn(this); } catch (e) { map.clear(); for (const [k, v] of old) map.set(k, v); throw e; } } };
};
const A = 'a'.repeat(64), B = 'b'.repeat(64), origin = 'https://level99bard.com';
function fixture() {
	const stores = new Map(), instances = new Map();
	const env = { ALLOW_LOCALHOST: 'false', LIVING: { idFromName: id => id, get(id) { if (!stores.has(id)) stores.set(id, memory()); if (!instances.has(id)) instances.set(id, new LivingRegion({ storage: stores.get(id) })); return instances.get(id); } } };
	const call = (body, { token = A, world = 'earth', region = 'coast:#1.2', headers = {}, query = '' } = {}) => handle(new Request(`https://rooms/living/${encodeURIComponent(world)}/${encodeURIComponent(region)}${query}`, { method: body ? 'POST' : 'GET', headers: { origin, authorization: `Bearer ${token}`, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
	const store = (world = 'earth', region = 'coast:#1.2') => stores.get(JSON.stringify([world, region]));
	const object = (world = 'earth', region = 'coast:#1.2') => env.LIVING.get(JSON.stringify([world, region]));
	return { env, call, store, object, instances };
}
const batch = (id = 'observe-0001') => ({ id, op: 'register', actors: [
	{ id: 'resident:rosa', name: 'Rosa', disposition: { helpful: 1, reliable: 1 }, sites: { home: 'rosa-home' } },
	{ id: 'resident:lee', name: 'Lee', disposition: { helpful: 1, reliable: 1 }, skills: ['repair'], sites: { home: 'lee-home' } },
], requests: [{ id: 'path-request', title: 'Survey the coastal path', kind: 'survey', giverId: 'resident:rosa', source: 'observed-project:path', siteId: 'coastal-path', durationMs: 300000, choices: [{ id: 'coast', label: 'Restore the coastal path' }, { id: 'inland', label: 'Preserve the quiet inland route' }] }] });
const body = async response => { assert.equal(response.status, 200, await response.clone().text()); return response.json(); };

test('scope and capability auth gate all access; arbitrary identity headers are discarded', async () => {
	const f = fixture();
	assert.equal((await f.call(null, { token: 'not-a-key' })).status, 401);
	assert.equal((await f.call(null, { headers: { origin: '' } })).status, 403);
	assert.equal((await f.call(null, { headers: { origin: 'https://other.example' } })).status, 403);
	assert.equal((await f.call(null, { region: '__proto__' })).status, 400);
	assert.equal((await f.call(null, { region: 'region/other' })).status, 400);
	const own = await body(await f.call(batch(), { headers: { 'x-living-player': 'traveller:' + B } }));
	assert.notEqual(own.you, 'traveller:' + B);
	assert.equal(own.region, 'coast:#1.2');
	assert.equal(JSON.stringify(own).includes(A), false, 'the private capability never appears in the response');
	const status = await body(await handle(new Request('https://rooms/status'), f.env));
	assert.ok(status.features.includes(LIVING_FEATURE));
	const absent = await body(await handle(new Request('https://rooms/status'), {}));
	assert.ok(!absent.features.includes(LIVING_FEATURE));
	assert.equal((await handle(new Request('https://rooms/living/earth/place', { headers: { origin, authorization: `Bearer ${A}` } }), {})).status, 503);
});

test('different authenticated visitors see shared activity but cannot take or release each other’s reservation', async () => {
	const f = fixture(), first = await body(await f.call(batch()));
	const second = await body(await f.call(null, { token: B }));
	assert.equal(second.view.requests.length, 1); assert.notEqual(first.you, second.you);
	const reserved = await body(await f.call({ id: 'reserve-001', op: 'reserve', requestId: 'path-request', playerId: second.you }));
	assert.equal(reserved.view.requests[0].playerOwner, first.you, 'client identity is ignored');
	assert.equal((await f.call({ id: 'reserve-002', op: 'reserve', requestId: 'path-request' }, { token: B })).status, 409);
	assert.equal((await f.call({ id: 'join-00002', op: 'join', requestId: 'path-request' }, { token: B })).status, 409);
	const triedRelease = await body(await f.call({ id: 'release-002', op: 'release', requestId: 'path-request' }, { token: B }));
	assert.equal(triedRelease.view.requests[0].playerOwner, first.you);
	const other = await body(await f.call(null, { token: A, world: 'moon' }));
	assert.equal(other.view.requests.length, 0); assert.notEqual(other.you, first.you);
});

test('receipts survive reconstruction; concurrent retries are idempotent and reused ids reject new intent', async () => {
	const f = fixture(); await body(await f.call(batch()));
	const command = { id: 'reserve-once', op: 'reserve', requestId: 'path-request' };
	const [a, b] = await Promise.all([f.call(command).then(body), f.call(command).then(body)]);
	assert.equal([a, b].filter(x => x.receipt.duplicate).length, 1);
	const total = a.history?.total || (await body(await f.call(null))).history.total;
	f.instances.clear();
	const replay = await body(await f.call(command));
	assert.equal(replay.receipt.duplicate, true);
	assert.equal((await body(await f.call(null))).history.total, total);
	assert.equal((await f.call({ ...command, op: 'release' })).status, 409);
});

test('bad final observation rolls the whole batch back and leaves no receipt', async () => {
	const f = fixture(), b = batch(); b.requests.push({ ...b.requests[0], id: 'bad-request', giverId: 'does-not-exist' });
	assert.equal((await f.call(b)).status, 409);
	const after = await body(await f.call(null)); assert.equal(after.view.actors.length, 0); assert.equal(after.view.requests.length, 0); assert.equal(after.history.total, 0);
	assert.equal([...f.store().map.keys()].filter(k => k.startsWith('receipt:')).length, 0);
});

test('offline alarms persist NPC work without inventing verified outcomes, rewards, or consuming player quests', async () => {
	const real = Date.now, base = Date.UTC(2026, 9, 14, 10); let now = base; Date.now = () => now;
	try {
		const f = fixture(); await body(await f.call(batch())); assert.equal(f.store().alarm, now + LIVING_TICK_MS);
		f.instances.clear(); now += 2 * 60 * 60 * 1000; await f.object().alarm();
		const after = await body(await f.call(null));
		assert.equal(after.view.requests[0].status, 'awaiting-confirmation');
		assert.ok(after.history.events.some(e => e.type === 'work-reported'));
		assert.equal(after.view.requests[0].evidenceId, null); assert.equal(after.view.requests[0].completedAt, null); assert.equal(f.store().alarm, null);
		await body(await f.call({ id: 'join-after', op: 'join', requestId: 'path-request' }));
		assert.equal((await f.call({ id: 'confirm-bad', op: 'confirm', requestId: 'path-request', evidenceId: 'made-up', outcome: 'completed' })).status, 400);
		assert.equal((await f.call({ id: 'start-bad', op: 'observe-start', requestId: 'path-request', actorId: 'resident:lee' })).status, 400);
	} finally { Date.now = real; }
});

test('a player reservation outlives absence and bounded catchup without NPC theft', async () => {
	const real = Date.now; let now = Date.UTC(2026, 9, 14, 10); Date.now = () => now;
	try {
		const f = fixture(); await body(await f.call(batch()));
		const reserved = await body(await f.call({ id: 'reserve-away', op: 'reserve', requestId: 'path-request' }));
		now += 10 * 24 * 60 * 60 * 1000; f.instances.clear(); await f.object().alarm();
		const after = await body(await f.call(null)); const request = after.view.requests[0];
		assert.equal(request.playerOwner, reserved.you); assert.equal(request.progressMs, 0); assert.equal(request.status, 'paused');
		assert.ok(after.history.events.some(e => e.type === 'catch-up-limited'));
	} finally { Date.now = real; }
});

test('proposal persistence retains disagreement without claiming consent or transferring currency', async () => {
	const f = fixture(); await body(await f.call(batch()));
	const proposal = await body(await f.call({ id: 'proposal-one', op: 'influence', requestId: 'path-request', choiceId: 'coast', reason: 'Keep the shore accessible.', money: 999999, outcome: 'completed' }));
	const q = proposal.view.requests[0]; assert.equal(q.proposals[0].status, 'proposed'); assert.equal(q.status, 'open');
	assert.equal(q.proposals[0].money, undefined); assert.equal(proposal.view.balance, undefined);
	assert.equal((await f.call({ id: 'proposal-bad', op: 'influence', requestId: 'path-request', choiceId: 'invent-a-road' })).status, 409);
});

test('durable paginated history survives the rolling event window and reconstruction', async () => {
	const real = Date.now; let now = Date.UTC(2026, 9, 14, 10); Date.now = () => now;
	try {
		const f = fixture(), initial = batch(); initial.requests[0].allowNpc = false; await body(await f.call(initial));
		for (let i = 0; i < 90; i++) {
			now += 60000;
			await body(await f.call({ id: `reserve-log-${i}`, op: 'reserve', requestId: 'path-request' }));
			await body(await f.call({ id: `release-log-${i}`, op: 'release', requestId: 'path-request' }));
		}
		f.instances.clear(); const latest = await body(await f.call(null, { query: '?limit=50' }));
		assert.ok(latest.history.total > 160); assert.equal(latest.history.events.length, 50); assert.equal(latest.view.events.length, 30);
		const firstPage = await body(await f.call(null, { query: '?before=4&limit=50' }));
		assert.equal(firstPage.history.events.at(-1).type, 'resident-registered'); assert.equal(firstPage.history.before, null);
		assert.equal(firstPage.history.events.at(-1).sequence, 1);
	} finally { Date.now = real; }
});

test('persistent operation budget rejects floods but still permits retries', async () => {
	const f = fixture(); await body(await f.call(batch()));
	for (let i = 0; i < 29; i++) await body(await f.call({ id: `readwrite-${i}`, op: 'release', requestId: 'path-request' }));
	f.instances.clear(); assert.equal((await f.call({ id: 'over-budget', op: 'release', requestId: 'path-request' })).status, 429);
	assert.equal((await body(await f.call(batch()))).receipt.duplicate, true);
	const tooBig = batch('large-body'); tooBig.noise = 'x'.repeat(40000); assert.equal((await f.call(tooBig)).status, 413);
});

test('observed emergency pauses work immediately and stale observations do not assert repair', async () => {
	const real = Date.now; let now = Date.UTC(2026, 9, 14, 10); Date.now = () => now;
	try {
		const f = fixture(), b = batch(); b.situation = { hazard: 0.9, destroyedSites: ['coastal-path'] };
		const paused = await body(await f.call(b)); assert.equal(paused.view.requests[0].status, 'paused'); assert.equal(paused.view.requests[0].blockedReason, 'site-destroyed');
		now += 31 * 60000; await f.object().alarm();
		const after = await body(await f.call(null));
		assert.equal(after.view.situation.hazard, 0); assert.equal(after.view.requests[0].completedAt, null);
		assert.deepEqual(after.view.situation.destroyedSites, ['coastal-path']); assert.equal(after.view.requests[0].status, 'paused');
		assert.ok(!after.history.events.some(e => e.type === 'request-confirmed'));
	} finally { Date.now = real; }
});

test('social-only work can conclude while absent, archives durably and cannot be replayed into active capacity', async () => {
	const real = Date.now; let now = Date.UTC(2026, 9, 14, 10); Date.now = () => now;
	try {
		const f = fixture(), b = batch(); Object.assign(b.requests[0], { kind: 'checkin', completionMode: 'social' });
		await body(await f.call(b)); now += 2 * 60 * 60 * 1000; await f.object().alarm();
		const after = await body(await f.call(null)); assert.equal(after.view.requests[0].status, 'completed'); assert.equal(after.view.requests[0].completionMode, 'social');
		assert.equal(after.view.counts.archivedRequests, 1); assert.ok(after.history.events.some(e => e.type === 'social-completed' && e.simulated));
		assert.equal(Object.keys((await f.object().load()).core.requests).length, 0); assert.ok(f.store().map.has('settled:path-request'));
		f.instances.clear(); const replay = await body(await f.call({ ...b, id: 'repeat-social-source' })); assert.equal(replay.view.counts.archivedRequests, 1); assert.equal(replay.view.requests[0].status, 'completed');
		assert.equal((await f.call({ id: 'reserve-finished', op: 'reserve', requestId: 'path-request' })).status, 409);
		const conflict = structuredClone(b); conflict.id = 'conflict-social'; conflict.requests[0].source = 'other-source'; assert.equal((await f.call(conflict)).status, 409);
		for (let n = 0; n < 128; n += 16) await body(await f.call({ id: `new-work-${n}`, op: 'register', actors: [], requests: Array.from({ length: 16 }, (_, i) => ({ ...batch().requests[0], id: `new-physical-${n+i}`, completionMode: 'social', allowNpc: false })) }));
		const full = await body(await f.call(null)); assert.equal(full.view.counts.requests, 128); assert.ok(full.view.requests.filter(q => q.id.startsWith('new-')).every(q => q.completionMode === 'physical'), 'physical tasks cannot select social mode');
		assert.equal(full.view.counts.archivedRequests, 1);
	} finally { Date.now = real; }
});

test('source reports require original observer, exact source and actual eligible actor; retries cannot resettle', async () => {
	const f = fixture(); await body(await f.call(batch()));
	const report = { id: 'source-result', op: 'report-source', requestId: 'path-request', source: 'observed-project:path', evidenceId: 'physical-outcome-1', actorId: 'resident:lee', outcome: 'completed' };
	await body(await f.call({ ...batch(), id: 'other-observation' }, { token: B }));
	assert.equal((await f.call(report, { token: B })).status, 403, 'reobserving does not gain the original source capability');
	assert.equal((await f.call({ ...report, source: 'made-up' })).status, 400);
	assert.equal((await f.call({ ...report, actorId: 'invented-actor' })).status, 409);
	assert.equal((await f.call({ ...report, actorId: 'toString' })).status, 409, 'inherited object properties are never citizens');
	assert.equal((await f.call({ ...report, actorId: 'resident:rosa' })).status, 409, 'giver cannot claim own request');
	const settled = await body(await f.call(report)); assert.equal(settled.view.requests[0].status, 'completed'); assert.equal(settled.view.requests[0].provenance, 'client-observed');
	const event = settled.events.find(e => e.type === 'request-confirmed'); assert.equal(event.provenance, 'client-observed'); assert.match(event.text, /not independently verified/);
	assert.ok(settled.events.find(e => e.type === 'npc-joined').provenance === 'client-observed');
	assert.equal((await body(await f.call(report))).receipt.duplicate, true);
	assert.equal((await f.call({ ...report, id: 'source-result-again' })).status, 409);
	assert.equal([...f.store().map.keys()].filter(k => k.startsWith('source-evidence:')).length, 1);
});

test('participating player can report own source outcome, not grant assets or resolve another reservation', async () => {
	const f = fixture(); await body(await f.call(batch()));
	await body(await f.call({ id: 'player-reserves', op: 'reserve', requestId: 'path-request' }, { token: B }));
	const report = { id: 'player-result', op: 'report-source', requestId: 'path-request', source: 'observed-project:path', evidenceId: 'player-scene-1', outcome: 'completed', money: 50000, inventory: ['sword'] };
	assert.equal((await f.call(report)).status, 409, 'original observer cannot complete another player’s reservation');
	const completed = await body(await f.call(report, { token: B })); assert.equal(completed.view.requests[0].status, 'completed'); assert.equal(completed.view.requests[0].provenance, 'client-observed');
	assert.equal(completed.view.inventory, undefined); assert.equal(completed.view.requests[0].money, undefined);
});

test('source reports cannot override an observed disaster or a different NPC assignment', async () => {
	const real = Date.now; let now = Date.UTC(2026, 9, 14, 10); Date.now = () => now;
	try {
		const f = fixture(), b = batch(); b.situation = { hazard: 1, destroyedSites: ['coastal-path'] }; await body(await f.call(b));
		const report = { id: 'hazard-report', op: 'report-source', requestId: 'path-request', source: 'observed-project:path', evidenceId: 'hazard-outcome', actorId: 'resident:lee', outcome: 'completed' };
		assert.equal((await f.call(report)).status, 409);
		assert.equal([...f.store().map.keys()].filter(k => k.startsWith('source-evidence:')).length, 0);
		const fresh = batch('fresh-observation'); fresh.requests[0].durationMs = 24*60*60*1000; fresh.situation = { hazard: 0, destroyedSites: [] }; await body(await f.call(fresh));
		now += 2*60*60*1000; await f.object().alarm();
		await body(await f.call({ id: 'third-citizen', op: 'register', actors: [{ id: 'resident:third', name: 'Third citizen' }], requests: [] }));
		assert.equal((await f.call({ ...report, actorId: 'resident:third' })).status, 409);
		await body(await f.call({ id: 'new-disaster', op: 'register', actors: [], requests: [], situation: { hazard: 1 } }));
		assert.equal((await f.call(report)).status, 409, 'already-assigned work cannot bypass a newly observed emergency');
	} finally { Date.now = real; }
});

test('large catchup preserves every event without oversized receipt values or unbounded responses', async () => {
	const real = Date.now; let now = Date.UTC(2026, 9, 14, 1); Date.now = () => now;
	try {
		const f = fixture();
		for (let n = 0; n < 128; n += 16) {
			await body(await f.call({ id: `seed-citizens-${n}`, op: 'register', actors: Array.from({ length: 16 }, (_, i) => ({ id: `citizen:${n+i}`, name: `Citizen ${n+i}`, sites: { home: 'home', work: 'work', social: 'square' } })), requests: [] }));
		}
		now += 24 * 60 * 60 * 1000;
		const next = await body(await f.call({ id: 'trigger-catchup', op: 'register', actors: [], requests: [] }));
		assert.ok(next.eventCount > 500); assert.equal(next.events.length, 50); assert.equal(next.receipt.eventIds.length, 50);
		for (const [key, value] of f.store().map) assert.ok(Buffer.byteLength(JSON.stringify(value)) < 128 * 1024, `storage value ${key} fits the Durable Object value limit`);
		const history = await body(await f.call(null)); assert.equal(history.history.total, next.receipt.lastSequence);
	} finally { Date.now = real; }
});
