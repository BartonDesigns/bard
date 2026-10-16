import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivingWorld } from '../src/people/living-world.js';
import { createBoard } from '../src/economy/requests.js';
import { createLivingWorldState, reduceLivingWorld, livingWorldView } from '../src/people/living-world-core.js';

function memory() { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v), m }; }
function stage(options = {}) {
  let now = 1704196800000, body = 'earth', region = 'town', position = { x: 0, z: 0 }, hazard = false;
  const store = options.storage || memory(), paid = [], completed = [];
  const places = [{ id: 'a', name: 'Ada Labs', type: 'tech', locale: 'us', x: 0, z: 0 }, { id: 'b', name: 'Barton Law', type: 'law', locale: 'us', x: 100, z: 0 }];
  const makeBoard = () => createBoard({ near: () => places, clock: () => now, storage: store, payroll: { payFrom: (...args) => { paid.push(args); return args[2]; } } });
  let board = makeBoard(), listener;
  const npcQuests = { onActivity(fn) { listener = fn; return () => {}; }, setLivingAdapter() {}, activities: () => [], actor: () => null };
  const params = { world: () => ({}), worldKey: () => body, region: () => ({ id: region, name: region }), position: () => position,
    requests: () => board, storage: store, clock: () => now, structures: () => ({ cataclysm: () => hazard }), npcQuests,
    onComplete: e => completed.push(e), ...options };
  let L = createLivingWorld(params); L.update(0);
  return { get L() { return L; }, get board() { return board; }, paid, completed, store, places, emit: e => listener(e),
    row: () => L.snapshot().activities.find(a => a.title.includes('prototype')),
    move: at => { position = { ...at }; }, advance: ms => { now += ms; L.update(0); }, hazard: v => { hazard = v; },
    scope: (b, r = 'town') => { body = b; region = r; L.update(0); },
    reload: () => { L.dispose(); board = makeBoard(); L = createLivingWorld(params); L.update(0); },
  };
}
async function deliver(T, id) {
  for (let n = 0; n < 10; n++) {
    const row = T.L.snapshot().activities.find(a => a.id === id);
    if (!row.canProgress) return;
    if (!row.currentStep) { await T.L.action(id, 'progress'); return; }
    T.move(row.currentStep.at); const r = await T.L.action(id, 'progress'); assert.equal(r.ok, true, r.message);
  }
}

test('real board pickup and delivery survive reload; reward and receipt happen only once', async () => {
  const T = stage(), row = T.row(); assert.ok(row);
  assert.equal((await T.L.action(row.id, 'progress')).ok, false);
  assert.equal((await T.L.action(row.id, 'join')).ok, true);
  assert.equal(T.board.take(row.id, 'npc:77'), null, 'NPC cannot steal player claim');
  T.move({ x: 5000, z: 0 }); assert.equal((await T.L.action(row.id, 'progress')).ok, false);
  T.move(row.currentStep.at); assert.equal((await T.L.action(row.id, 'progress')).ok, true);
  T.reload(); const restored = T.L.snapshot().activities.find(a => a.id === row.id); assert.equal(restored.progress.done, 1);
  await deliver(T, row.id); assert.equal(T.paid.length, 1); assert.equal(T.completed.length, 1);
  const evidence = T.L.completionEvidence(row.id); assert.equal(evidence.verified, true); assert.equal(evidence.actorId, 'player'); assert.equal(evidence.beneficiaryId, 'a');
  T.advance(6000); T.reload(); assert.equal(T.paid.length, 1); assert.equal(T.completed.length, 1, 'rescan must not award a second deed');
  assert.equal((await T.L.action(row.id, 'progress')).ok, false);
});

test('discount work has a bound receipt and suppresses ordinary cash; cancellation restores cash once', async () => {
  const T = stage(), id = T.row().id;
  assert.equal((await T.L.action(id, 'join', { rewardMode: 'discount', agreementId: 'offer:one' })).ok, true);
  assert.equal((await T.L.action(id, 'join', { rewardMode: 'discount', agreementId: 'offer:two' })).ok, false);
  await deliver(T, id); assert.equal(T.paid.length, 0);
  const evidence = T.L.completionEvidence(id); assert.equal(evidence.agreementId, 'offer:one'); assert.equal(evidence.rewardMode, 'discount');
  const service = T.L.servicesFor('a').find(s => s.id === id); assert.equal(service.status, 'completed'); assert.equal(service.revision, evidence.revision);
  assert.equal((await T.L.clearAgreement(id, 'offer:one')).ok, true); assert.equal(T.paid.length, 1);
  assert.equal((await T.L.clearAgreement(id, 'offer:one')).ok, true); assert.equal(T.paid.length, 1);
  T.reload(); assert.equal((await T.L.clearAgreement(id, 'offer:one')).ok, true); assert.equal(T.paid.length, 1);
});

test('same source IDs on different bodies or regions never reuse player steps or receipts', async () => {
  const T = stage(), id = T.row().id; await T.L.action(id, 'join'); await deliver(T, id);
  T.scope('gargantua'); assert.equal(T.L.completionEvidence(id), null); assert.equal(T.L.snapshot().scope.world, 'gargantua');
  assert.equal(T.L.snapshot().activities.find(a => a.id === id).canProgress, false);
  T.scope('earth', 'other-town'); assert.equal(T.L.completionEvidence(id), null);
  T.scope('earth', 'town'); assert.equal(T.L.completionEvidence(id).verified, true); assert.equal(T.paid.length, 1);
});

test('cataclysm pauses physical objectives and resume retains prior carried goods', async () => {
  const T = stage(), id = T.row().id; await T.L.action(id, 'join');
  T.move(T.row().currentStep.at); await T.L.action(id, 'progress');
  T.hazard(true); T.advance(6000); T.move(T.row().currentStep.at);
  assert.equal((await T.L.action(id, 'progress')).ok, false); assert.equal(T.paid.length, 0);
  T.hazard(false); T.advance(6000); assert.equal((await T.L.action(id, 'progress')).ok, true); assert.equal(T.paid.length, 1);
});

test('bounded offline intentions do not grant physical completions or player service evidence', () => {
  const T = stage({ actors: () => [{ id: 'npc:10', name: 'Lena', disposition: { helpful: 1, reliable: 1, nerve: 1 } }] });
  T.advance(7 * 86400000);
  const snap = T.L.snapshot(); assert.ok(snap.catchup); assert.equal(T.paid.length, 0);
  assert.ok(snap.activities.every(a => a.state !== 'completed')); assert.equal(T.L.completionEvidence(T.row().id), null);
});

test('save failure blocks payment and explicit unsupported physical work stays unconfirmed', async () => {
  const store = memory(), T = stage({ storage: store }), row = T.row(); await T.L.action(row.id, 'join');
  T.move(row.currentStep.at); await T.L.action(row.id, 'progress');
  const target = T.row().currentStep.at; T.move(target); store.setItem = () => { throw Error('quota'); };
  assert.equal((await T.L.action(row.id, 'progress')).ok, false); assert.equal(T.paid.length, 0);
});

function network() {
  let core = createLivingWorldState({ world: 'earth', region: 'town', now: 1704196800000 });
  const calls = [], you = 'traveller:test';
  const request = async (url, options = {}) => {
    const b = options.body ? JSON.parse(options.body) : null; calls.push({ url, options, b });
    if (url.endsWith('/status')) return { ok: true, json: async () => ({ features: ['living-world-v1'] }) };
    let error;
    function apply(c) { const r = reduceLivingWorld(core, { ...c, now: 1704196800000 }); core = r.state; error ||= r.error; }
    if (b?.op === 'register') { for (const actor of b.actors) apply({ type: 'register-actor', actor }); for (const req of b.requests) apply({ type: 'register-request', request: req }); }
    else if (b?.op === 'report-source') apply({ type: 'confirm', requestId: b.requestId, evidenceId: b.evidenceId, outcome: b.outcome, playerId: you });
    else if (b) apply({ type: b.op, requestId: b.requestId, playerId: you });
    return { ok: !error, json: async () => error ? { error } : { world: 'earth', region: 'town', you, view: livingWorldView(core) } };
  };
  return { request, calls, core: () => core };
}

test('feature-gated shared reservation uses Soul auth and reports actual source receipt without server rewards', async () => {
  const N = network(), T = stage({ request: N.request, url: 'https://rooms.test', soul: { credentials: () => 'private-test-key' } });
  await T.L.sync(); const id = T.row().id;
  assert.equal((await T.L.action(id, 'join')).ok, true); assert.equal(N.core().requests[id].playerOwner, 'traveller:test');
  await deliver(T, id); await T.L.sync();
  assert.equal(N.core().requests[id].status, 'completed'); assert.equal(T.paid.length, 1);
  const report = N.calls.find(c => c.b?.op === 'report-source'); assert.ok(report); assert.equal(report.b.source, 'economy');
  assert.equal(report.options.headers.authorization, 'Bearer private-test-key');
  assert.ok(!JSON.stringify(T.L.snapshot()).includes('private-test-key'));
});

test('old Worker falls back to labelled local mode, without posting unsupported operations', async () => {
  const calls = [], T = stage({ url: 'https://old.test', soul: { credentials: () => 'key' }, request: async (url, opts) => { calls.push({ url, opts }); return { ok: true, json: async () => ({ features: ['trade-v2'] }) }; } });
  await T.L.sync(); assert.equal(T.L.status().mode, 'local'); assert.match(T.L.status().error, /not deployed/);
  assert.equal((await T.L.action(T.row().id, 'join')).ok, true); assert.ok(calls.every(c => c.url.endsWith('/status')));
});

test('an Earth claim waiting on a network read cannot claim the same source ID on another planet', async () => {
  const N = network(); let heldResolve, hold = false;
  const T = stage({ request: async (url, opts) => { if (hold && url.includes('/living/') && !opts.body) { hold = false; await new Promise(resolve => { heldResolve = resolve; }); } return N.request(url, opts); }, url: 'https://rooms.test', soul: { credentials: () => 'same-key' } });
  await T.L.sync(); const id = T.row().id;
  hold = true; const pending = T.L.sync(); const clicked = T.L.action(id, 'join');
  T.scope('gargantua'); heldResolve(); await pending;
  const result = await clicked; assert.equal(result.ok, false); assert.match(result.message, /location or identity changed/i);
  assert.equal(T.board.get(id).status, 'open'); assert.equal(T.L.snapshot().activities.find(a => a.id === id).canProgress, false);
});

test('changing Souls does not adopt the previous Soul’s local task or reward evidence', async () => {
  let identity = 'one';
  const T = stage({ soul: { credentials: () => identity } }), id = T.row().id;
  assert.equal((await T.L.action(id, 'join')).ok, true);
  identity = 'two'; T.advance(1);
  assert.equal((await T.L.action(id, 'join')).ok, false); assert.equal(T.L.completionEvidence(id), null);
});

test('a corrupt activity save is retained and claims are blocked rather than overwriting history', async () => {
  const store = memory(), key = 'l99-living-world-v1:earth:town'; store.setItem(key, '{broken');
  const T = stage({ storage: store }); T.advance(12000);
  assert.equal(store.getItem(key), '{broken'); assert.match(T.L.status().error, /could not be read/);
  assert.equal((await T.L.action(T.row().id, 'join')).ok, false); assert.equal(T.paid.length, 0);
});

test('observed adults at an actual workplace can have explicitly simulated check-ins without rewards', () => {
  const people = [{ id: 'npc:10', name: 'Lena', position: { x: 0, z: 0 }, workSpot: { x: 0, z: 0, name: 'Ada Labs' }, disposition: { helpful: 1, reliable: 1, nerve: 1 } },
    { id: 'npc:11', name: 'Drew', position: { x: 5, z: 0 }, disposition: { helpful: 1, reliable: 1, nerve: 1 } }];
  const T = stage({ actors: () => people });
  assert.ok(T.L.snapshot().activities.some(a => a.source === 'resident-checkin'));
  T.advance(12 * 3600000);
  const events = T.L.snapshot().history.filter(e => e.type === 'social-completed');
  assert.ok(events.length); assert.ok(events.every(e => e.simulated)); assert.equal(T.paid.length, 0);
});

test('cooperative source completion waits for player acknowledgement and never becomes their service', async () => {
  const T = stage(), row = T.row(), source = T.board.get(row.id);
  assert.ok(T.board.take(row.id, 'npc:77'));
  T.emit({ type: 'started', request: { ...source, source: 'economy' }, npcId: 'npc:77', npcName: 'Nara', step: 0 });
  assert.equal((await T.L.action(row.id, 'join')).ok, true);
  assert.equal(T.board.complete(row.id, 'npc:77', 'done').ok, true);
  assert.equal(T.L.snapshot().activities.find(a => a.id === row.id).state, 'awaiting your acknowledgement');
  assert.equal(T.L.completionEvidence(row.id), null);
  assert.equal((await T.L.action(row.id, 'progress')).ok, true);
  assert.equal(T.L.snapshot().activities.find(a => a.id === row.id).state, 'completed');
  assert.equal(T.L.completionEvidence(row.id), null); assert.equal(T.paid.length, 1); assert.equal(T.paid[0][1], 'npc:77');
});

test('structurally invalid JSON state is retained without crashing the game loop', () => {
  const store = memory(), key = 'l99-living-world-v1:earth:town';
  const state = createLivingWorldState({ world: 'earth', region: 'town', now: 1704196800000 }); state.actors.bad = { id: 'bad' };
  const data = JSON.stringify({ version: 1, state, records: {} }); store.setItem(key, data);
  const T = stage({ storage: store }); assert.doesNotThrow(() => T.advance(86400000)); assert.equal(store.getItem(key), data); assert.match(T.L.status().error, /could not be read/);
});

test('completed source records archive durably before capacity is reused and archived IDs never reopen', () => {
  const store = memory(), now = 1704196800000;
  let state = createLivingWorldState({ world: 'earth', region: 'town', now });
  const apply = command => { const r = reduceLivingWorld(state, { now, ...command }); assert.ok(!r.error, r.error); state = r.state; };
  apply({ type: 'register-actor', actor: { id: 'giver', name: 'Ada' } });
  const records = {};
  for (let i = 0; i < 100; i++) {
    const id = 'past:' + i, raw = { id, title: 'Delivered ' + i, source: 'economy', giver: { id: 'giver', name: 'Ada', type: 'business', x: 0, z: 0 }, steps: [{ do: 'deliver', at: { x: 10, z: 0 } }] };
    apply({ type: 'register-request', request: { id, title: raw.title, giverId: 'giver', source: 'economy', siteId: 'site' } });
    apply({ type: 'reserve', requestId: id, playerId: 'player' });
    apply({ type: 'confirm', requestId: id, playerId: 'player', evidenceId: 'receipt:' + i, outcome: 'completed' });
    records[id] = { q: raw, finished: true, sourceFinished: true, receiptId: 'receipt:' + i, step: 1 };
  }
  store.setItem('l99-living-world-v1:earth:town', JSON.stringify({ version: 1, state, records }));
  const T = stage({ storage: store }); const archived = T.L.archiveIndex(); assert.ok(Object.keys(archived).length >= 76);
  const id = Object.keys(archived)[0], old = T.L.archived(id); assert.ok(old.record.receiptId); assert.equal(old.request.status, 'completed');
  T.emit({ type: 'offered', request: old.record.q }); assert.equal(T.L.snapshot().activities.some(a => a.id === id), false);
  assert.ok(T.row(), 'new real requests still enter this region');
});
