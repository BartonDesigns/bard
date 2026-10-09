// Trading between two players in a room. Each player's inventory stays their own: a trade is a
// small conversation of messages (net/protocol.js cleanTrade) in which each side builds what
// it gives, both confirm the same version, and then each applies only its own side through
// applyInventoryTransaction, keyed by the trade's id so it lands once.
//
// The one who asked (role 'a') decides: it commits once both have confirmed the same version,
// and keeps saying so until the other answers 'done'. A confirmation (role 'b') is a promise:
// every version b confirmed is kept, so a commit that crosses a change or a cancel still lands
// the same on both sides. If b cannot apply it after all, it says 'fail' and a undoes its own
// side. Lost messages are simply sent again; nothing here touches the screen or the network.

import { cleanTradeSide, TRANSACTION_KINDS } from './arms.js';

// waits: for the rooms server to say it passed the offer on, for the friend's game to answer,
// and between resends
export const ACK_MS = 4000, SEEN_MS = 9000, RESEND_MS = 2500;
// a finished trade is forgotten after this long
export const KEEP_MS = 120000;
// once both have confirmed, a short hold before the asker commits, in which either can still cancel
export const HOLD_MS = 1500;
export const OPEN = ['asking', 'invited', 'open'];

const empty = () => ({ credits: 0, items: [] });
const other = (role) => (role === 'a' ? 'b' : 'a');
export const keyOf = (T) => `${T.v.a}.${T.v.b}`;
const canon = (s) => JSON.stringify({ credits: s?.credits || 0, items: [...(s?.items || [])].sort((a, b) => (a.u < b.u ? -1 : 1)).map((x) => [x.u, x.i, x.l, x.t, x.x]) });
export const sameSides = (x, y) => !!x && !!y && canon(x.a) === canon(y.a) && canon(x.b) === canon(y.b);
const copySide = (x) => ({ credits: x.credits, items: x.items.map((y) => ({ ...y })) });
const copySides = (s) => ({ a: copySide(s.a), b: copySide(s.b) });
const bothOk = (T) => T.ok.a === keyOf(T) && T.ok.b === keyOf(T);
// seconds left of the hold (0 when not holding)
export const holdLeft = (T, now) => (T?.sealAt && T.status === 'open' && bothOk(T) ? Math.max(0, T.sealAt - now) : 0);
const out = (T, send = [], note = '') => ({ T, send, note });

export function newTradeId(rand = Math.random) {
	let s = 't';
	for (let i = 0; i < 12; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(rand() * 32) % 32];
	return s;
}

// the transaction that applies one player's own side (or takes it back)
export function tradeTx(T, sides = T.sides, undo = false) {
	const mine = sides[T.role], theirs = sides[other(T.role)];
	return { id: `trade:${T.id}${undo ? ':undo' : ''}`, kind: TRANSACTION_KINDS.TRADE, give: undo ? theirs : mine, get: undo ? mine : theirs, peer: T.peer };
}

// asking a friend
export function startTrade({ id, peer, peerName = '', now = 0 }) {
	const T = { id, role: 'a', peer, peerName, sides: { a: empty(), b: empty() }, v: { a: 0, b: 0 }, ok: { a: '', b: '' }, prepared: {}, status: 'asking', why: '', at: now, sentAt: now, relayed: false, endedAt: 0 };
	return out(T, [{ op: 'propose', id }]);
}

// the server passed it on (or found no one there)
export function relayed(T, there = true, now = 0) {
	if (!T || T.relayed) return out(T);
	if (!there) return end(T, 'failed', 'gone', now);
	return out({ ...T, relayed: true });
}

function end(T, status, why = '', now = 0) { return out({ ...T, status, why, endedAt: now }, [], why); }

// changing your own side: every confirmation is cleared
export function editSide(T, side, now = 0) {
	if (!T || T.status !== 'open' && !(T.role === 'b' && T.status === 'invited')) return out(T);
	const s = cleanTradeSide(side);
	if (!s) return out(T, [], 'bad');
	if (canon(s) === canon(T.sides[T.role])) return out(T);
	const v = { ...T.v, [T.role]: T.v[T.role] + 1 };
	const N = { ...T, status: 'open', sides: { ...T.sides, [T.role]: s }, v, ok: { a: '', b: '' }, sealAt: 0, sentAt: now };
	return out(N, [{ op: 'update', id: T.id, v: v[T.role], side: s }]);
}

// confirming the offer as it stands
export function accept(T, ctx) {
	if (!T || (T.status !== 'open' && !(T.role === 'b' && T.status === 'invited'))) return out(T);
	const key = keyOf(T);
	let N = { ...T, status: 'open', ok: { ...T.ok, [T.role]: key }, sentAt: ctx.now || 0 };
	if (T.role === 'b') N.prepared = { ...T.prepared, [key]: copySides(T.sides) };
	const send = [{ op: 'accept', id: T.id, key, sides: copySides(T.sides) }];
	if (bothOk(N)) N.sealAt = (ctx.now || 0) + HOLD_MS;
	return out(N, send, bothOk(N) ? 'sealing' : '');
}

// both confirmed one version: the asker applies its side and tells the other
function commit(T, ctx) {
	const r = ctx.apply(tradeTx(T));
	if (!r?.ok) {
		const N = { ...T, status: 'cancelled', why: 'changed', endedAt: ctx.now || 0 };
		return out(N, [{ op: 'cancel', id: T.id, why: 'changed' }], 'changed');
	}
	const N = { ...T, status: 'committing', committed: { key: keyOf(T), sides: copySides(T.sides) }, sentAt: ctx.now || 0 };
	return out(N, [{ op: 'commit', id: T.id, key: N.committed.key, sides: N.committed.sides }], 'committed');
}

export function cancel(T, why = 'cancelled', now = 0) {
	if (!T || !OPEN.includes(T.status)) return out(T);
	// (b keeps what it confirmed: a commit already on its way still lands)
	return out({ ...T, status: 'cancelled', why, endedAt: now }, [{ op: 'cancel', id: T.id, why }]);
}

// a message from the friend. ctx: { now, apply(tx) -> { ok }, applied(txId) -> bool, peer, peerName }
export function receive(T, m, ctx) {
	const now = ctx.now || 0;
	if (m.op === 'propose') {
		if (T && T.id === m.id) return out(T, [{ op: 'seen', id: m.id }]);
		const N = { id: m.id, role: 'b', peer: ctx.peer, peerName: ctx.peerName || '', sides: { a: empty(), b: empty() }, v: { a: 0, b: 0 }, ok: { a: '', b: '' }, prepared: {}, status: 'invited', why: '', at: now, sentAt: now, relayed: true, endedAt: 0 };
		return out(N, [{ op: 'seen', id: m.id }], 'invited');
	}
	if (!T || T.id !== m.id) {
		// a commit for a trade no longer held here: done if it was applied, else refused
		if (m.op === 'commit') return out(T, [ctx.applied?.(`trade:${m.id}`) ? { op: 'done', id: m.id } : { op: 'fail', id: m.id, why: 'unknown' }]);
		return out(T);
	}
	const them = other(T.role);
	switch (m.op) {
		case 'seen':
			if (T.status === 'asking') return out({ ...T, status: 'open', relayed: true }, [], 'open');
			return out(T);
		case 'update': {
			if (!OPEN.includes(T.status) || !(m.v > T.v[them])) return out(T);
			const s = cleanTradeSide(m.side);
			if (!s) return out(T);
			return out({ ...T, status: T.status === 'asking' ? 'open' : T.status, sides: { ...T.sides, [them]: s }, v: { ...T.v, [them]: m.v }, ok: { a: '', b: '' }, sealAt: 0 }, [], 'changed');
		}
		case 'accept': {
			if (!OPEN.includes(T.status) || m.key !== keyOf(T) || !sameSides(m.sides, T.sides)) return out(T);
			const N = { ...T, status: T.status === 'asking' ? 'open' : T.status, ok: { ...T.ok, [them]: m.key } };
			if (bothOk(N)) { N.sealAt = now + HOLD_MS; return out(N, [], 'sealing'); }
			return out(N, [], 'accepted');
		}
		case 'commit': {
			if (T.role !== 'b') return out(T);
			if (T.status === 'done') return out(T, [{ op: 'done', id: T.id }]);
			const p = T.prepared[m.key];
			if (!p || !sameSides(p, m.sides)) return out({ ...T, status: 'failed', why: 'unknown', endedAt: now }, [{ op: 'fail', id: T.id, why: 'unknown' }], 'failed');
			const r = ctx.apply(tradeTx(T, p));
			if (!r?.ok) return out({ ...T, status: 'failed', why: 'short', endedAt: now }, [{ op: 'fail', id: T.id, why: 'short' }], 'failed');
			return out({ ...T, status: 'done', sides: copySides(p), why: T.status === 'cancelled' ? 'late' : '', endedAt: now }, [{ op: 'done', id: T.id }], 'done');
		}
		case 'done':
			if (T.role === 'a' && T.status === 'committing') return out({ ...T, status: 'done', endedAt: now }, [], 'done');
			return out(T);
		case 'fail': {
			if (T.role !== 'a' || T.status !== 'committing') return out(T);
			// the friend could not take it after all: take back our side
			ctx.apply(tradeTx(T, T.committed.sides, true));
			return out({ ...T, status: 'failed', why: m.why || 'short', endedAt: now }, [], 'failed');
		}
		case 'cancel':
			if (T.role === 'a') {
				// the asker's word is final: once committed, the commit stands
				if (T.status === 'committing') return out(T, [{ op: 'commit', id: T.id, key: T.committed.key, sides: T.committed.sides }]);
				if (!OPEN.includes(T.status)) return out(T);
				return out({ ...T, status: 'cancelled', why: m.why || 'cancelled', endedAt: now }, [{ op: 'cancel', id: T.id, why: 'ok' }], 'cancelled');
			}
			// (the asker never commits after a cancel, so what was confirmed can go)
			if (!OPEN.includes(T.status)) return out(T.status === 'cancelled' ? { ...T, prepared: {} } : T);
			return out({ ...T, status: 'cancelled', why: m.why || 'cancelled', prepared: {}, endedAt: now }, [], 'cancelled');
	}
	return out(T);
}

// time passing: give up on a silent server or friend, send again what may have been lost, and
// (the asker) commit once the hold after both confirmed is over. ctx as for receive.
export function tick(T, now, ctx = null) {
	if (!T) return out(T);
	if (T.role === 'a' && T.status === 'open' && T.sealAt && now >= T.sealAt && bothOk(T) && ctx) return commit(T, { ...ctx, now });
	if (T.status === 'asking') {
		if (!T.relayed && now - T.at > ACK_MS) return end(T, 'failed', 'server', now);
		if (T.relayed && now - T.at > SEEN_MS) return end(T, 'failed', 'peer', now);
		return out(T);
	}
	if (now - T.sentAt < RESEND_MS) return out(T);
	const N = { ...T, sentAt: now }, send = [];
	if (T.status === 'committing') send.push({ op: 'commit', id: T.id, key: T.committed.key, sides: T.committed.sides });
	else if (T.status === 'open') {
		if (T.v[T.role] > 0) send.push({ op: 'update', id: T.id, v: T.v[T.role], side: T.sides[T.role] });
		if (T.ok[T.role] === keyOf(T)) send.push({ op: 'accept', id: T.id, key: keyOf(T), sides: copySides(T.sides) });
	}
	return send.length ? out(N, send) : out(T);
}

// what a trade still needs kept over a reload: the asker's commit until it is answered, and
// the versions the other confirmed
export const worthKeeping = (T, now) => !!T && (T.status === 'committing' || (T.role === 'b' && Object.keys(T.prepared || {}).length && T.status !== 'done' && T.status !== 'failed' && now - T.at < 86400e3));
export const finished = (T, now) => !!T && T.endedAt > 0 && now - T.endedAt > KEEP_MS && !worthKeeping(T, now);

// words for why a trade ended
export function tradeWhy(T) {
	const who = T?.peerName || 'Your friend';
	return {
		server: 'Trading needs the rooms server update.',
		peer: `${who}'s game did not answer: they may need to reload to trade.`,
		gone: `${who} is not in the room any more.`,
		busy: `${who} is already trading.`,
		changed: 'The trade was cancelled: what was offered changed.',
		short: 'The trade could not be completed: something offered was no longer there. Nothing changed.',
		unknown: 'The trade could not be completed. Nothing changed.',
		late: 'It had already gone through before the cancel.',
		ok: 'Trade cancelled.',
		cancelled: `${who} cancelled the trade.`,
		far: `${who} is on another world.`,
	}[T?.why] || '';
}
