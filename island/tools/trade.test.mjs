// node island/tools/trade.test.mjs: trading between two players (gameplay/trade.js), with two
// inventories, a wire that can drop, repeat and cross messages, and no browser
import { applyInventoryTransaction, createInventoryState, cleanTradeSide, sellPrice, ACQUISITION_SOURCES } from '../src/gameplay/arms.js';
import { startTrade, receive, editSide, accept, cancel, tick, relayed, tradeTx, worthKeeping, finished, ACK_MS, SEEN_MS, RESEND_MS, KEEP_MS } from '../src/gameplay/trade.js';
import { cleanTrade, cleanPose } from '../src/net/protocol.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };

// a player: an inventory, a trade, and an outbox
function player(id, credits, items) {
	const P = { id, inv: createInventoryState(id, { credits, initialItems: items }), T: null, out: [], now: 1000 };
	P.ctx = (peer) => ({ now: P.now, peer, peerName: peer.toUpperCase(), apply: (tx) => { const r = applyInventoryTransaction(P.inv, tx); if (r.ok) P.inv = r.state; return r; }, applied: (txId) => P.inv.journal.some((e) => e.id === txId) });
	P.take = (res) => { P.T = res.T; for (const m of res.send) P.out.push(cleanTrade({ ...m, to: 'x'.repeat(8) })); return res; };
	return P;
}
// deliver what one has sent to the other (as the server would, cleaned), optionally dropping some
function deliver(from, to, { drop = () => false } = {}) {
	const msgs = from.out.splice(0);
	for (const m of msgs) { if (!m || drop(m)) continue; const { to: addr, ...rest } = m; if (addr) to.take(receive(to.T, rest, to.ctx(from.id))); }
}
const pump = (A, B, n = 6, opts) => { for (let i = 0; i < n; i++) { deliver(A, B, opts); deliver(B, A, opts); } };
const lanterns = (P) => P.inv.items['camp-lantern'] || 0;

// ---------- a plain trade ----------
{
	const A = player('ann', 500, { 'camp-lantern': 3 }), B = player('ben', 200, { 'field-medkit': 2 });
	A.take(startTrade({ id: 'trade-0001', peer: 'ben', peerName: 'Ben', now: A.now }));
	ok(A.T.status === 'asking' && A.out[0].op === 'propose', 'asking sends a propose');
	pump(A, B);
	ok(B.T?.status === 'invited' && A.T.status === 'open', 'the friend is invited, and the asker hears they saw it');
	A.take(editSide(A.T, { credits: 50, items: { 'camp-lantern': 2 } }));
	B.take(editSide(B.T, { credits: 0, items: { 'field-medkit': 1 } }));
	pump(A, B);
	ok(A.T.sides.b.items['field-medkit'] === 1 && B.T.sides.a.items['camp-lantern'] === 2, 'both see the live offer');
	A.take(accept(A.T, A.ctx('ben')));
	pump(A, B);
	ok(A.T.status === 'open' && B.T.ok.a === '1.1', 'one confirmation is not enough');
	// a change clears both confirmations
	B.take(editSide(B.T, { credits: 10, items: { 'field-medkit': 1 } }));
	pump(A, B);
	ok(!A.T.ok.a && !A.T.ok.b && !B.T.ok.a, 'changing the offer clears both confirmations');
	A.take(accept(A.T, A.ctx('ben')));
	B.take(accept(B.T, B.ctx('ann')));
	pump(A, B);
	ok(A.T.status === 'done' && B.T.status === 'done', 'both confirmed: done on both sides');
	ok(A.inv.credits === 500 - 50 + 10 && lanterns(A) === 1 && A.inv.items['field-medkit'] === 1, 'the asker gave 50 and 2 lanterns, got 10 and a medkit');
	ok(B.inv.credits === 200 + 50 - 10 && lanterns(B) === 2 && B.inv.items['field-medkit'] === 1, 'the friend the other way round');
	// every message again: nothing lands twice
	const before = JSON.stringify([A.inv.items, A.inv.credits, B.inv.items, B.inv.credits]);
	B.take(receive(B.T, { op: 'commit', id: 'trade-0001', key: A.T.committed.key, sides: A.T.committed.sides }, B.ctx('ann')));
	A.take(receive(A.T, { op: 'done', id: 'trade-0001' }, A.ctx('ben')));
	pump(A, B);
	ok(JSON.stringify([A.inv.items, A.inv.credits, B.inv.items, B.inv.credits]) === before, 'a repeated commit changes nothing');
	ok(applyInventoryTransaction(A.inv, tradeTx(A.T)).duplicate, 'the trade id lands once');
}

// ---------- dropped messages ----------
{
	const A = player('ann', 300, {}), B = player('ben', 0, { 'camp-lantern': 1 });
	A.take(startTrade({ id: 'trade-0002', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, { credits: 100, items: {} }));
	B.take(editSide(B.T, { credits: 0, items: { 'camp-lantern': 1 } }));
	// every update is lost: the resends carry them
	deliver(A, B, { drop: () => true }); deliver(B, A, { drop: () => true });
	ok(!A.T.sides.b.items['camp-lantern'], 'a lost update is not seen');
	A.now = B.now = 1000 + RESEND_MS + 1;
	A.take(tick(A.T, A.now)); B.take(tick(B.T, B.now));
	pump(A, B);
	ok(A.T.sides.b.items['camp-lantern'] === 1 && B.T.sides.a.credits === 100, 'resent updates arrive');
	A.take(accept(A.T, A.ctx('ben')));
	B.take(accept(B.T, B.ctx('ann')));
	// the commit is lost, and then the done
	deliver(B, A);
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
	// the friend reloaded and forgot the trade, but its inventory remembers
	A.take(receive({ ...A.T, status: 'committing' }, { op: 'cancel', id: 'trade-0002' }, A.ctx('ben')));
	B.T = null;
	pump(A, B);
	ok(A.T.status === 'done' && B.inv.credits === 100, 'a commit for a forgotten but applied trade is answered done');
}

// ---------- cancels ----------
{
	const A = player('ann', 300, {}), B = player('ben', 0, { 'camp-lantern': 2 });
	A.take(startTrade({ id: 'trade-0003', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, { credits: 30, items: {} }));
	pump(A, B);
	B.take(cancel(B.T, 'cancelled', B.now));
	pump(A, B);
	ok(A.T.status === 'cancelled' && B.T.status === 'cancelled' && A.inv.credits === 300, 'either side can cancel; nothing moves');
	ok(accept(A.T, A.ctx('ben')).T.status === 'cancelled', 'a cancelled trade cannot be confirmed');
	// a cancel crossing a commit: the commit stands, on both sides
	const C = player('cat', 300, {}), D = player('dan', 0, { 'camp-lantern': 2 });
	C.take(startTrade({ id: 'trade-0004', peer: 'dan', now: C.now }));
	pump(C, D);
	C.take(editSide(C.T, { credits: 30, items: {} }));
	D.take(editSide(D.T, { credits: 0, items: { 'camp-lantern': 1 } }));
	pump(C, D);
	C.take(accept(C.T, C.ctx('dan')));
	pump(C, D);
	D.take(accept(D.T, D.ctx('cat')));
	D.take(cancel(D.T, 'cancelled', D.now));
	ok(D.T.status === 'cancelled', 'dan cancels right after confirming');
	pump(C, D);
	ok(C.T.status === 'done' && D.T.status === 'done' && D.T.why === 'late', 'the commit had gone: both complete, and dan is told');
	ok(C.inv.credits === 270 && lanterns(C) === 1 && D.inv.credits === 30 && lanterns(D) === 1, 'the same trade on both sides');
	// changing after confirming, while the commit crosses: the confirmed version lands
	const E = player('eve', 300, {}), F = player('fay', 0, { 'camp-lantern': 2 });
	E.take(startTrade({ id: 'trade-0005', peer: 'fay', now: E.now }));
	pump(E, F);
	E.take(editSide(E.T, { credits: 40, items: {} }));
	F.take(editSide(F.T, { credits: 0, items: { 'camp-lantern': 1 } }));
	pump(E, F);
	E.take(accept(E.T, E.ctx('fay')));
	pump(E, F);
	F.take(accept(F.T, F.ctx('eve')));
	F.take(editSide(F.T, { credits: 0, items: { 'camp-lantern': 2 } }));
	pump(E, F);
	ok(E.T.status === 'done' && F.T.status === 'done' && lanterns(E) === 1 && lanterns(F) === 1 && F.inv.credits === 40, 'a change crossing the commit: the confirmed version lands on both');
}

// ---------- the friend can no longer pay ----------
{
	const A = player('ann', 300, { 'door-brace': 1 }), B = player('ben', 100, {});
	A.take(startTrade({ id: 'trade-0006', peer: 'ben', now: A.now }));
	pump(A, B);
	A.take(editSide(A.T, { credits: 0, items: { 'door-brace': 1 } }));
	B.take(editSide(B.T, { credits: 80, items: {} }));
	pump(A, B);
	B.take(accept(B.T, B.ctx('ann')));
	pump(A, B);
	B.inv = { ...B.inv, credits: 10 };
	A.take(accept(A.T, A.ctx('ben')));
	ok(A.T.status === 'committing' && !A.inv.items['door-brace'], 'the asker applied its side');
	pump(A, B);
	ok(B.T.status === 'failed' && A.T.status === 'failed', 'the friend could not pay: failed on both');
	ok(A.inv.items['door-brace'] === 1 && A.inv.credits === 300 && B.inv.credits === 10, 'the asker took its side back; nothing lost or made');
	// and the asker who no longer has what it offered cancels instead of committing
	const C = player('cat', 0, { 'door-brace': 1 }), D = player('dan', 100, {});
	C.take(startTrade({ id: 'trade-0007', peer: 'dan', now: C.now }));
	pump(C, D);
	C.take(editSide(C.T, { credits: 0, items: { 'door-brace': 1 } }));
	pump(C, D);
	D.take(accept(D.T, D.ctx('cat')));
	pump(C, D);
	C.inv = { ...C.inv, items: {} };
	C.take(accept(C.T, C.ctx('dan')));
	pump(C, D);
	ok(C.T.status === 'cancelled' && C.T.why === 'changed' && D.T.status === 'cancelled' && D.inv.credits === 100, 'the asker short at commit: cancelled, nothing moves');
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
	// the friend's messages for another trade, or a commit for one never made
	const B = player('ben', 0, {});
	const r = receive(null, { op: 'commit', id: 'trade-9999', key: '1.1', sides: { a: { credits: 5, items: {} }, b: { credits: 0, items: {} } } }, B.ctx('ann'));
	ok(r.send[0]?.op === 'fail' && B.inv.credits === 0, 'a commit for an unknown trade is refused');
	ok(!receive(acked, { op: 'update', id: 'trade-0008', v: 1, side: { credits: 5, items: { 'not-an-item': 1 } } }, A.ctx('ben')).T.sides.b.credits, 'an offer with an unknown item is ignored');
}

// ---------- keeping over a reload ----------
{
	const T = { id: 't1', role: 'a', status: 'committing', endedAt: 0, at: 0 };
	ok(worthKeeping(T, 10) && !finished(T, 1e12), 'an unanswered commit is kept');
	ok(!worthKeeping({ ...T, status: 'done', endedAt: 5 }, 10) && finished({ ...T, status: 'done', endedAt: 5 }, 5 + KEEP_MS + 1), 'a finished trade is let go');
	ok(worthKeeping({ id: 't2', role: 'b', status: 'cancelled', prepared: { '1.1': {} }, at: 0, endedAt: 1 }, 10), 'what a friend confirmed is kept until the asker says');
}

// ---------- the core and the wire ----------
{
	ok(cleanTradeSide({ credits: 5, items: { 'camp-lantern': 2 } })?.items['camp-lantern'] === 2, 'a good side');
	ok(cleanTradeSide({ credits: -1 }) === null && cleanTradeSide({ items: { 'made-up': 1 } }) === null && cleanTradeSide({ credits: 1.5 }) === null, 'bad credits and unknown items refused');
	ok(sellPrice('camp-lantern', ACQUISITION_SOURCES.SUPERMARKET) === 15 && sellPrice('warden-spark-carbine', ACQUISITION_SOURCES.SUPERMARKET) === null, 'a shop buys back at half its price, only what it sells');
	let inv = createInventoryState('me', { credits: 0, initialItems: { 'camp-lantern': 2 } });
	inv = applyInventoryTransaction(inv, { id: 'eq', kind: 'equip', itemId: 'camp-lantern', slot: 'hand' }).state;
	const sold = applyInventoryTransaction(inv, { id: 's1', kind: 'sell', sourceId: ACQUISITION_SOURCES.SUPERMARKET, itemId: 'camp-lantern', quantity: 2 });
	ok(sold.ok && sold.state.credits === 30 && !sold.state.items['camp-lantern'] && !sold.state.equipped.hand, 'selling: credits in, item out, out of the hand');
	ok(!applyInventoryTransaction(inv, { id: 's2', kind: 'sell', sourceId: ACQUISITION_SOURCES.SUPERMARKET, itemId: 'camp-lantern', quantity: 3 }).ok, 'cannot sell what you do not have');
	ok(cleanPose({ p: [0, 0, 0], h: 'camp-lantern' }).h === 'camp-lantern' && !('h' in cleanPose({ p: [0, 0, 0], h: '<b>' })), 'the held item travels in the pose, cleaned');
	ok(cleanTrade({ op: 'commit', id: 'trade-0001', key: '3.4', sides: { a: { credits: 1, items: {} }, b: { credits: 0, items: { 'door-brace': 1 } } } })?.sides.b.items['door-brace'] === 1, 'a commit survives the cleaner');
	ok(cleanTrade({ op: 'commit', id: 'trade-0001', key: '3.4', sides: { a: { credits: 1 } } }) === null, 'a commit missing a side is refused');
}

console.log(`trade: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
