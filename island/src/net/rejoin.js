// The room you were in, kept across a crash or a reload (share.js keeps your place the same
// way), so you are back in it with your friends on your own, with nothing to type. Forgotten
// when you leave, when the host ends it, or when it has gone. Pure: the store is handed in
// (localStorage in the game).

import { cleanCode } from './protocol.js';

export const ROOM_KEY = 'l99-mp-room';
// kept this long: a room empty longer than the server's EMPTY_MS is gone anyway, and one with
// friends still in it lives on
export const REJOIN_MS = 12 * 3600 * 1000;

export function keptRoom(store, now = Date.now()) {
	try {
		const k = JSON.parse(store.getItem(ROOM_KEY) || 'null');
		const code = cleanCode(k?.code || '');
		return code && now - (+k.at || 0) < REJOIN_MS && now >= (+k.at || 0) ? code : null;
	} catch { return null; }
}
export function keepRoom(store, code, now = Date.now()) {
	try {
		const c = cleanCode(code || '');
		if (c) store.setItem(ROOM_KEY, JSON.stringify({ code: c, at: now }));
		else store.removeItem(ROOM_KEY);
	} catch { /* storage off */ }
}
// whether to go back in on your own: a kept room, and no ?room= link in the address (that
// link is the join instead)
export function shouldRejoin(store, search = '', now = Date.now()) {
	let linked = '';
	try { linked = new URLSearchParams(search).get('room') || ''; } catch { linked = ''; }
	if (cleanCode(linked)) return null;
	return keptRoom(store, now);
}
