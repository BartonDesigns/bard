// Real HTTP and SQLite Durable Objects, local only: no accounts or live mutations.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { startLocalRooms } from './local-worker.mjs';
const local = await startLocalRooms(), keys = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
const origin = 'http://localhost:8768';
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
async function call(key, data, world = 'earth') {
	const result = await fetch(`${local.url}/living/${world}/${encodeURIComponent('coast:#37.7,-122.4')}`, { method: data ? 'POST' : 'GET', headers: { origin, authorization: 'Bearer ' + key, 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
	return { status: result.status, data: await result.json() };
}
try {
	const status = await (await fetch(local.url + '/status')).json();
	check(status.features.includes('living-world-v1'), 'production Worker advertises its actual binding');
	check((await call('bad')).status === 401, 'malformed capability rejected');
	const register = { id: 'integration-register', op: 'register', actors: [{ id: 'resident:rosa', name: 'Rosa' }], requests: [{ id: 'path-1', title: 'Survey the coastal path', giverId: 'resident:rosa', source: 'known-project:path-1', siteId: 'coastal-path', choices: [{ id: 'coast', label: 'Restore the coastal path' }] }] };
	const posted = await call(keys[0], register); check(posted.status === 200, 'atomic citizen and request persisted in SQLite');
	const other = await call(keys[1]); check(other.data.view.requests.length === 1 && other.data.you !== posted.data.you, 'two identities share the same region');
	const reserve = { id: 'integration-reserve', op: 'reserve', requestId: 'path-1', playerId: other.data.you };
	const responses = await Promise.all([call(keys[0], reserve), call(keys[0], reserve)]);
	check(responses.every(r => r.status === 200) && responses.filter(r => r.data.receipt.duplicate).length === 1, 'concurrent retry commits once');
	check((await call(keys[1], { ...reserve, id: 'integration-other' })).status === 409, 'other visitor cannot seize reservation');
	const seen = await call(keys[1]); check(seen.data.view.requests[0].playerOwner === posted.data.you, 'server supplies actual ownership');
	check(seen.data.history.events.some(e => e.type === 'player-reserved'), 'public durable activity records ownership');
	check((await call(keys[0], null, 'moon')).data.view.requests.length === 0, 'other celestial bodies have isolated state');
	check((await call(keys[0], { id: 'integration-confirm', op: 'confirm', requestId: 'path-1', outcome: 'completed', evidenceId: 'invented' })).status === 400, 'generic client cannot claim a physical outcome');
	const replay = await call(keys[0], register); check(replay.data.receipt.duplicate && replay.data.view.requests[0].playerOwner === posted.data.you, 'reobservation cannot reset work');
	const report = { id: 'integration-source', op: 'report-source', requestId: 'path-1', source: 'known-project:path-1', evidenceId: 'scene-result-1', outcome: 'completed' };
	check((await call(keys[1], report)).status === 403, 'unrelated client cannot report another participant’s source outcome');
	const completed = await call(keys[0], report); check(completed.status === 200 && completed.data.view.requests[0].provenance === 'client-observed' && completed.data.view.counts.archivedRequests === 1, 'source outcome and terminal tombstone persist atomically with honest provenance');
	check((await call(keys[0], { ...register, id: 'integration-reobserve-finished' })).data.view.requests[0].status === 'completed', 'archived source cannot resurrect after reobservation');
	console.log(`living-world real Worker integration: ${checks} passed, 0 failed`);
} finally { await local.dispose(); }
