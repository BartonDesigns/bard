// node island/tools/trade.test.mjs: trading between two players (gameplay/trade.js), with two
// inventories of levelled item instances, a wire that can drop, repeat and cross messages, and
// no browser. Also the levels themselves (gameplay/gear-levels.js) and the version 1 migration.
import { applyInventoryTransaction, createInventoryState, cleanTradeSide, deserializeInventory, instancesOf, sellPrice, upgradePrice, ACQUISITION_SOURCES, INVENTORY_VERSION } from '../src/gameplay/arms.js';
import { startTrade, receive, editSide, accept, cancel, tick, relayed, tradeTx, worthKeeping, finished, holdLeft, ACK_MS, SEEN_MS, RESEND_MS, KEEP_MS, HOLD_MS } from '../src/gameplay/trade.js';
import { statsOf, compareStats, trained, valueFactor, xpNeed, canCombine, MAX_LEVEL } from '../src/gameplay/gear-levels.js';
import { cleanTrade, cleanPose } from '../src/net/protocol.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };

// a player: an inventory, a trade, and an outbox
function player(id, credits, items) {
	const P = { id, inv: createInventoryState(id, { credits, initialItems: items, updatedAt: id.length * 7 + id.charCodeAt(0) }), T: null, out: [], now: 1000 };
	P.ctx = (peer) => ({ now: P.now, peer, peerName: peer.toUpperCase(), apply: (tx) => { const r = applyInventoryTransaction(P.inv, tx); if (r.ok) P.inv = r.state; return r; }, applied: (txId) => P.inv.journal.some((e) => e.id === txId) });
	P.take = (res) => { P.T = res.T; for (const m of res.send) P.out.push(cleanTrade({ ...m, to: 'x'.repeat(8) })); return res; };
	P.peer = '';
	return P;
}
// a side from counts: that many of each item from what the player holds
const side = (P, credits, counts = {}) => ({ credits, items: Object.entries(counts).flatMap(([id, n]) => instancesOf(P.inv, id).slice(0, n)) });
const cnt = (s, id) => s.items.filter((x) => x.i === id).length;
// deliver what one has sent to the other (as the server would, cleaned), optionally dropping some
function deliver(from, to, { drop = () => false } = {}) {
	const msgs = from.out.splice(0);
	for (const m of msgs) { if (!m || drop(m)) continue; const { to: addr, ...rest } = m; if (addr) to.take(receive(to.T, rest, to.ctx(from.id))); }
}
const pump = (A, B, n = 6, opts) => { for (let i = 0; i < n; i++) { deliver(A, B, opts); deliver(B, A, opts); } };
// the hold after both confirm runs out, and the asker commits
const seal = (A, B, peer) => { A.now += HOLD_MS + 1; A.take(tick(A.T, A.now, A.ctx(peer))); pump(A, B); };
const lanterns = (P) => P.inv.items['camp-lantern'] || 0;

// ---------- a plain trade ----------
{
	const A = player('ann', 500, { 'camp-lantern': 3 }), B = player('ben', 200, { 'field-medkit': 2 });
	A.take(startTrade({ id: 'trade-0001', peer: 'ben', peerName: 'Ben', now: A.now }));
	ok(A.T.status === 'asking' && A.out[0].op === 'propose', 'asking sends a propose');
	pump(A, B);
	ok(B.T?.status === 'invited' && A.T.status === 'open', 'the friend is invited, and the asker hears they saw it');
	A.take(editSide(A.T, side(A, 50, { 'camp-lantern': 2 })));
	B.take(editSide(B.T, side(B, 0, { 'field-medkit': 1 })));
	pump(A, B);
	ok(cnt(A.T.sides.b, 'field-medkit') === 1 && cnt(B.T.sides.a, 'camp-lantern') === 2, 'both see the live offer, item by item');
	A.take(accept(A.T, A.ctx('ben')));
	pump(A, B);
	ok(A.T.status === 'open' && B.T.ok.a === '1.1', 'one confirmation is not enough');
	B.take(editSide(B.T, side(B, 10, { 'field-medkit': 1 })));
	pump(A, B);
	ok(!A.T.ok.a && !A.T.ok.b && !B.T.ok.a, 'changing the offer clears both confirmations');
	A.take(accept(A.T, A.ctx('ben')));
	B.take(accept(B.T, B.ctx('ann')));
	pump(A, B);
	ok(A.T.status === 'open' && holdLeft(A.T, A.now) > 0 && holdLeft(B.T, B.now) > 0, 'both confirmed: a short hold first, shown on both');
	A.take(tick(A.T, A.now + HOLD_MS - 10, A.ctx('ben')));
	ok(A.T.status === 'open', 'not before the hold is over');
	seal(A, B, 'ben');
	ok(A.T.status === 'done' && B.T.status === 'done', 'then done on both sides');
	ok(A.inv.credits === 500 - 50 + 10 && lanterns(A) === 1 && A.inv.items['field-medkit'] === 1, 'the asker gave 50 and 2 lanterns, got 10 and a medkit');
	ok(B.inv.credits === 200 + 50 - 10 && lanterns(B) === 2 && B.inv.items['field-medkit'] === 1, 'the friend the other way round');
	const given = A.T.sides.a.items.map((x) => x.u).sort().join();
	ok(instancesOf(B.inv, 'camp-lantern').map((x) => x.u).sort().join() === given, 'the very same instances changed hands');
	const before = JSON.stringify([A.inv.instances, A.inv.credits, B.inv.instances, B.inv.credits]);
	B.take(receive(B.T, { op: 'commit', id: 'trade-0001', key: A.T.committed.key, sides: A.T.committed.sides }, B.ctx('ann')));
	A.take(receive(A.T, { op: 'done', id: 'trade-0001' }, A.ctx('ben')));
	pump(A, B);
	ok(JSON.stringify([A.inv.instances, A.inv.credits, B.inv.instances, B.inv.credits]) === before, 'a repeated commit changes nothing');
	ok(applyInventoryTransaction(A.inv, tradeTx(A.T)).duplicate, 'the trade id lands once');
}

// ---------- a cancel during the hold ----------
{
	const A = player('amy', 100, {}), B = player('bob', 0, { 'door-brace': 1 });
	A.take(startTrade({ id: 'trade-0010', peer: 'bob', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, side(A, 40)));
	B.take(editSide(B.T, side(B, 0, { 'door-brace': 1 })));
	pump(A, B);
	A.take(accept(A.T, A.ctx('bob'))); B.take(accept(B.T, B.ctx('amy')));
	pump(A, B);
	B.take(cancel(B.T, 'cancelled', B.now));
	pump(A, B);
	seal(A, B, 'bob');
	ok(A.T.status === 'cancelled' && B.T.status === 'cancelled' && A.inv.credits === 100 && B.inv.items['door-brace'] === 1, 'cancelled during the hold: nothing moves');
}

// ---------- dropped messages ----------
{
	const A = player('ann', 300, {}), B = player('ben', 0, { 'camp-lantern': 1 });
	A.take(startTrade({ id: 'trade-0002', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, side(A, 100)));
	B.take(editSide(B.T, side(B, 0, { 'camp-lantern': 1 })));
	deliver(A, B, { drop: () => true }); deliver(B, A, { drop: () => true });
	ok(!cnt(A.T.sides.b, 'camp-lantern'), 'a lost update is not seen');
	A.now = B.now = 1000 + RESEND_MS + 1;
	A.take(tick(A.T, A.now)); B.take(tick(B.T, B.now));
	pump(A, B);
	ok(cnt(A.T.sides.b, 'camp-lantern') === 1 && B.T.sides.a.credits === 100, 'resent updates arrive');
	A.take(accept(A.T, A.ctx('ben')));
	B.take(accept(B.T, B.ctx('ann')));
	deliver(B, A);
	A.now += HOLD_MS + 1; A.take(tick(A.T, A.now, A.ctx('ben')));
	ok(A.T.status === 'committing' && A.inv.credits === 200, 'the asker commits and applies its side');
	deliver(A, B, { drop: (m) => m.op === 'commit' });
	ok(B.T.status === 'open' && B.inv.credits === 0, 'the friend has not heard yet');
	A.now += RESEND_MS + 1; A.take(tick(A.T, A.now));
	deliver(A, B);
	ok(B.T.status === 'done' && B.inv.credits === 100, 'the resent commit lands');
	deliver(B, A, { drop: () => true });
	A.now += RESEND_MS + 1; A.take(tick(A.T, A.now));
	pump(A, B);
	ok(A.T.status === 'done' && B.inv.credits === 100 && lanterns(A) === 1 && lanterns(B) === 0, 'a lost done: the commit again, answered done, nothing twice');
	A.take(receive({ ...A.T, status: 'committing' }, { op: 'cancel', id: 'trade-0002' }, A.ctx('ben')));
	B.T = null;
	pump(A, B);
	ok(A.T.status === 'done' && B.inv.credits === 100, 'a commit for a forgotten but applied trade is answered done');
}

// ---------- cancels and crossings ----------
{
	const A = player('ann', 300, {}), B = player('ben', 0, { 'camp-lantern': 2 });
	A.take(startTrade({ id: 'trade-0003', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, side(A, 30)));
	pump(A, B);
	B.take(cancel(B.T, 'cancelled', B.now));
	pump(A, B);
	ok(A.T.status === 'cancelled' && B.T.status === 'cancelled' && A.inv.credits === 300, 'either side can cancel; nothing moves');
	ok(accept(A.T, A.ctx('ben')).T.status === 'cancelled', 'a cancelled trade cannot be confirmed');
	// a cancel crossing the commit: the commit stands, on both sides
	const C = player('cat', 300, {}), D = player('dan', 0, { 'camp-lantern': 2 });
	C.take(startTrade({ id: 'trade-0004', peer: 'dan', now: C.now }));
	pump(C, D);
	C.take(editSide(C.T, side(C, 30)));
	D.take(editSide(D.T, side(D, 0, { 'camp-lantern': 1 })));
	pump(C, D);
	C.take(accept(C.T, C.ctx('dan')));
	pump(C, D);
	D.take(accept(D.T, D.ctx('cat')));
	deliver(D, C);
	C.now += HOLD_MS + 1; C.take(tick(C.T, C.now, C.ctx('dan')));
	D.take(cancel(D.T, 'cancelled', D.now));
	pump(C, D);
	ok(C.T.status === 'done' && D.T.status === 'done' && D.T.why === 'late', 'the commit had gone: both complete, and dan is told');
	ok(C.inv.credits === 270 && lanterns(C) === 1 && D.inv.credits === 30 && lanterns(D) === 1, 'the same trade on both sides');
	// a change crossing the commit: the confirmed version lands
	const E = player('eve', 300, {}), F = player('fay', 0, { 'camp-lantern': 2 });
	E.take(startTrade({ id: 'trade-0005', peer: 'fay', now: E.now }));
	pump(E, F);
	E.take(editSide(E.T, side(E, 40)));
	F.take(editSide(F.T, side(F, 0, { 'camp-lantern': 1 })));
	pump(E, F);
	E.take(accept(E.T, E.ctx('fay')));
	pump(E, F);
	F.take(accept(F.T, F.ctx('eve')));
	deliver(F, E);
	E.now += HOLD_MS + 1; E.take(tick(E.T, E.now, E.ctx('fay')));
	F.take(editSide(F.T, side(F, 0, { 'camp-lantern': 2 })));
	pump(E, F);
	ok(E.T.status === 'done' && F.T.status === 'done' && lanterns(E) === 1 && lanterns(F) === 1 && F.inv.credits === 40, 'a change crossing the commit: the confirmed version lands on both');
}

// ---------- the friend can no longer pay ----------
{
	const A = player('ann', 300, { 'door-brace': 1 }), B = player('ben', 100, {});
	A.take(startTrade({ id: 'trade-0006', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, side(A, 0, { 'door-brace': 1 })));
	B.take(editSide(B.T, side(B, 80)));
	pump(A, B);
	B.take(accept(B.T, B.ctx('ann')));
	pump(A, B);
	B.inv = { ...B.inv, credits: 10 };
	A.take(accept(A.T, A.ctx('ben')));
	A.now += HOLD_MS + 1; A.take(tick(A.T, A.now, A.ctx('ben')));
	ok(A.T.status === 'committing' && !A.inv.items['door-brace'], 'the asker applied its side');
	pump(A, B);
	ok(B.T.status === 'failed' && A.T.status === 'failed', 'the friend could not pay: failed on both');
	ok(A.inv.items['door-brace'] === 1 && A.inv.credits === 300 && B.inv.credits === 10, 'the asker took its side back; nothing lost or made');
	const C = player('cat', 0, { 'door-brace': 1 }), D = player('dan', 100, {});
	C.take(startTrade({ id: 'trade-0007', peer: 'dan', now: C.now }));
	pump(C, D);
	C.take(editSide(C.T, side(C, 0, { 'door-brace': 1 })));
	pump(C, D);
	D.take(accept(D.T, D.ctx('cat')));
	pump(C, D);
	C.inv = { ...C.inv, instances: {}, items: {} };
	C.take(accept(C.T, C.ctx('dan')));
	seal(C, D, 'dan');
	ok(C.T.status === 'cancelled' && C.T.why === 'changed' && D.T.status === 'cancelled' && D.inv.credits === 100, 'the asker short at commit: cancelled, nothing moves');
}

// ---------- a levelled item ----------
{
	const A = player('ann', 0, { 'reedline-hunting-bow': 1 }), B = player('ben', 900, {});
	const bow = instancesOf(A.inv, 'reedline-hunting-bow')[0];
	A.inv.instances[bow.u] = { ...bow, l: 7, t: 3, x: 12 };
	A.take(startTrade({ id: 'trade-0011', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, side(A, 0, { 'reedline-hunting-bow': 1 })));
	B.take(editSide(B.T, side(B, 800)));
	pump(A, B);
	ok(B.T.sides.a.items[0].l === 7 && B.T.sides.a.items[0].t === 3, 'the friend sees its level and tier');
	A.take(accept(A.T, A.ctx('ben'))); B.take(accept(B.T, B.ctx('ann')));
	pump(A, B); seal(A, B, 'ben');
	const got = B.inv.instances[bow.u];
	ok(got && got.l === 7 && got.t === 3 && got.x === 12 && !A.inv.instances[bow.u], 'it arrives as it was, under its id, and leaves the giver');
	// an offer whose item changed meanwhile (levelled up) is refused rather than half-applied
	const C = player('cat', 0, { 'camp-lantern': 1 });
	const lamp = instancesOf(C.inv, 'camp-lantern')[0];
	const T = { id: 'trade-0012', role: 'a', peer: 'dan', sides: { a: { credits: 0, items: [lamp] }, b: { credits: 0, items: [] } } };
	C.inv.instances[lamp.u] = { ...lamp, l: 2 };
	ok(!applyInventoryTransaction(C.inv, tradeTx(T)).ok, 'a changed instance cannot be given as it was');
	// an incoming id that clashes with one already here gets a new id instead of being lost
	const E = player('eve', 0, { 'camp-lantern': 1 });
	const own = instancesOf(E.inv, 'camp-lantern')[0];
	const r = applyInventoryTransaction(E.inv, { id: 'trade:clash', kind: 'trade', give: { credits: 0, items: [] }, get: { credits: 0, items: [{ ...own, l: 5 }] } });
	ok(r.ok && r.state.items['camp-lantern'] === 2, 'a clashing id is renamed, never lost');
}

// ---------- an old server, a silent friend, a stranger ----------
{
	const A = player('ann', 100, {});
	A.take(startTrade({ id: 'trade-0008', peer: 'ben', now: 0 }));
	ok(tick(A.T, ACK_MS - 1).T.status === 'asking', 'waiting for the server');
	const old = tick(A.T, ACK_MS + 1);
	ok(old.T.status === 'failed' && old.T.why === 'server' && old.note === 'server', 'no word from the server: it needs the update');
	const acked = relayed(A.T, true, 10).T;
	ok(tick(acked, ACK_MS + 1).T.status === 'asking', 'the server passed it on: wait for the friend');
	ok(tick(acked, SEEN_MS + 1).T.why === 'peer', 'a friend whose game never answers');
	ok(relayed(A.T, false, 10).T.why === 'gone', 'a friend no longer in the room');
	const B = player('ben', 0, {});
	const r = receive(null, { op: 'commit', id: 'trade-9999', key: '1.1', sides: { a: { credits: 5, items: [] }, b: { credits: 0, items: [] } } }, B.ctx('ann'));
	ok(r.send[0]?.op === 'fail' && B.inv.credits === 0, 'a commit for an unknown trade is refused');
	ok(!receive(acked, { op: 'update', id: 'trade-0008', v: 1, side: { credits: 5, items: [{ u: 'abcdef', i: 'not-an-item', l: 1, t: 0 }] } }, A.ctx('ben')).T.sides.b.credits, 'an offer with an unknown item is ignored');
}

// ---------- keeping over a reload ----------
{
	const T = { id: 't1', role: 'a', status: 'committing', endedAt: 0, at: 0 };
	ok(worthKeeping(T, 10) && !finished(T, 1e12), 'an unanswered commit is kept');
	ok(!worthKeeping({ ...T, status: 'done', endedAt: 5 }, 10) && finished({ ...T, status: 'done', endedAt: 5 }, 5 + KEEP_MS + 1), 'a finished trade is let go');
	ok(worthKeeping({ id: 't2', role: 'b', status: 'cancelled', prepared: { '1.1': {} }, at: 0, endedAt: 1 }, 10), 'what a friend confirmed is kept until the asker says');
}

// ---------- levels, upgrades, combining ----------
{
	const lamp = { u: 'lamp01', i: 'camp-lantern', l: 1, t: 0, x: 0 };
	const s1 = statsOf(lamp), s5 = statsOf({ ...lamp, l: 5, t: 4 });
	ok(s1[0].label === 'Light radius' && s5[0].value > s1[0].value * 1.9, 'stats grow with level and tier');
	ok(statsOf({ u: 'bow001', i: 'reedline-hunting-bow', l: 10, t: 4, x: 0 })[0].value <= 99, 'percentages stay below 100');
	ok(compareStats(lamp, { ...lamp, t: 2 })[0].delta > 0, 'a compare shows the gain');
	const up = trained(lamp, xpNeed(1) + xpNeed(2) + 5);
	ok(up.l === 3 && up.x === 5, 'experience raises the level');
	ok(trained({ ...lamp, l: MAX_LEVEL }, 9999).l === MAX_LEVEL, 'never past the top level');
	ok(valueFactor({ l: 10, t: 4 }) > valueFactor({ l: 1, t: 0 }) * 10, 'levelled, Legendary gear is worth far more');
	ok(sellPrice('camp-lantern', ACQUISITION_SOURCES.SUPERMARKET) === 15 && sellPrice('camp-lantern', ACQUISITION_SOURCES.SUPERMARKET, { l: 3, t: 2 }) > 15 * 2.5, 'sell-back by level and tier');
	ok(sellPrice('warden-spark-carbine', ACQUISITION_SOURCES.SUPERMARKET) === null, 'a shop buys back only what it sells');
	let inv = createInventoryState('me', { credits: 1000, initialItems: { 'camp-lantern': 2, 'repair-roll': 2 } });
	const [l1, l2] = instancesOf(inv, 'camp-lantern');
	const cost = upgradePrice(l1);
	const ug = applyInventoryTransaction(inv, { id: 'up1', kind: 'upgrade', uid: l1.u, sourceId: ACQUISITION_SOURCES.NPC_TRADER, cost });
	ok(ug.ok && ug.state.instances[l1.u].l === 2 && ug.state.credits === 1000 - cost && ug.state.items['repair-roll'] === 1, 'an upgrade costs credits and a Repair Roll');
	ok(!applyInventoryTransaction(inv, { id: 'up2', kind: 'upgrade', uid: l1.u, sourceId: ACQUISITION_SOURCES.SUPERMARKET }).ok, 'only at an outfitter');
	ok(!applyInventoryTransaction(createInventoryState('x', { credits: 999, initialItems: { 'camp-lantern': 1 } }), { id: 'up3', kind: 'upgrade', uid: instancesOf(createInventoryState('x', { credits: 999, initialItems: { 'camp-lantern': 1 } }), 'camp-lantern')[0].u, sourceId: ACQUISITION_SOURCES.NPC_TRADER }).ok, 'not without the material');
	inv = ug.state;
	ok(!canCombine(inv.instances[l1.u], inv.instances[l2.u]) || inv.instances[l1.u].t === inv.instances[l2.u].t, 'combining needs the same tier');
	const cb = applyInventoryTransaction(inv, { id: 'cb1', kind: 'combine', uid: l1.u, with: l2.u });
	ok(cb.ok && cb.state.items['camp-lantern'] === 1 && cb.state.instances[l1.u].t === 1 && cb.state.instances[l1.u].l === 2, 'two Common lanterns make one Fine, keeping the better level');
	ok(!applyInventoryTransaction(cb.state, { id: 'cb2', kind: 'combine', uid: l1.u, with: l1.u }).ok, 'not with itself');
	const tr = applyInventoryTransaction(cb.state, { id: 'tr1', kind: 'train', uid: l1.u, xp: xpNeed(2) });
	ok(tr.ok && tr.state.instances[l1.u].l === 3 && tr.state.journal.length === cb.state.journal.length, 'experience is counted without filling the journal');
	const eq = applyInventoryTransaction(tr.state, { id: 'eq1', kind: 'equip', uid: l1.u, slot: 'hand' });
	const sold = applyInventoryTransaction(eq.state, { id: 's1', kind: 'sell', sourceId: ACQUISITION_SOURCES.SUPERMARKET, itemId: 'camp-lantern', uid: l1.u, quantity: 1 });
	ok(eq.state.hand === l1.u && sold.ok && !sold.state.hand && !sold.state.items['camp-lantern'] && sold.state.credits > eq.state.credits + 30, 'selling a held, levelled item: out of the hand, for more');
}

// ---------- the version 1 save ----------
{
	const v1 = JSON.stringify({ version: 1, ownerId: 'player', revision: 4, credits: 70, heat: 0, items: { 'camp-lantern': 2, 'door-brace': 1 }, equipped: { hand: 'camp-lantern' }, journal: [{ id: 'old', accepted: true }], updatedAt: 99 });
	const m = deserializeInventory(v1);
	const lamps = instancesOf(m, 'camp-lantern');
	ok(m.version === INVENTORY_VERSION && INVENTORY_VERSION === 2 && lamps.length === 2 && lamps.every((x) => x.l === 1 && x.t === 0), 'a version 1 save becomes instances, Common, level 1');
	ok(m.hand === lamps[0].u && m.credits === 70 && m.journal.length === 1, 'what was in hand stays in hand; credits and journal kept');
	ok(JSON.stringify(deserializeInventory(v1).instances) === JSON.stringify(m.instances), 'the migration is stable until saved');
	ok(JSON.stringify(deserializeInventory(JSON.stringify(m)).instances) === JSON.stringify(m.instances), 'a version 2 save round-trips');
}

// ---------- the wire ----------
{
	const lamp = { u: 'lamp01', i: 'camp-lantern', l: 3, t: 2, x: 4 };
	ok(cleanTradeSide({ credits: 5, items: [lamp] })?.items[0].t === 2, 'a good side');
	ok(cleanTradeSide({ credits: -1 }) === null && cleanTradeSide({ items: [{ ...lamp, i: 'made-up' }] }) === null && cleanTradeSide({ credits: 1.5 }) === null, 'bad credits and unknown items refused');
	ok(cleanTradeSide({ items: [lamp, lamp] }) === null && cleanTradeSide({ items: [{ ...lamp, l: 11 }] }) === null && cleanTradeSide({ items: [{ ...lamp, t: 5 }] }) === null, 'an id twice, or a level or tier out of range, refused');
	ok(cleanPose({ p: [0, 0, 0], h: 'camp-lantern', hl: 4, ht: 3 }).ht === 3 && !('h' in cleanPose({ p: [0, 0, 0], h: '<b>' })), 'the held item, its level and tier travel in the pose, cleaned');
	ok(cleanTrade({ op: 'commit', id: 'trade-0001', key: '3.4', sides: { a: { credits: 1, items: [] }, b: { credits: 0, items: [lamp] } } })?.sides.b.items[0].u === 'lamp01', 'a commit survives the cleaner');
	ok(cleanTrade({ op: 'commit', id: 'trade-0001', key: '3.4', sides: { a: { credits: 1 } } }) === null, 'a commit missing a side is refused');
}

console.log(`trade: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
