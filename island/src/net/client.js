// The connection to a room (server/multiplayer): one WebSocket, its hello in the address,
// a ping every 10 s so a still player is not timed out, and a reconnect with backoff when the
// line drops. Callers get events: status, welcome, join, leave, pose, spot, state, event,
// host, closed.

import { cleanCode } from './protocol.js';

const FINAL = new Set([4000, 4404, 4409, 1008]);
export const REASONS = { 4000: 'The host ended the room.', 4404: 'That room is not open (or has ended).', 4409: 'That room is full.', 4413: 'A message was too big.', 4429: 'Too many messages.', 4408: 'Timed out.', 1008: 'The room refused this player.' };

export function createRoomClient({ url, id, name, seed, WS = globalThis.WebSocket, on = () => {} }) {
	let ws = null, code = '', tries = 0, timer = null, ping = null, want = false;
	const C = { status: 'off', host: '', you: id, players: new Map() };
	const emit = (t, v) => { try { on(t, v); } catch (e) { console.warn('[room]', t, e); } };
	const status = (s, why = '') => { if (C.status !== s) { C.status = s; emit('status', { status: s, why }); } };

	async function create() {
		const r = await fetch(url.replace(/\/$/, '') + '/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
		if (!r.ok) throw new Error(r.status === 429 ? 'Too many rooms made from here; try again later.' : `The rooms server said ${r.status}.`);
		return (await r.json()).code;
	}
	function join(c) {
		code = cleanCode(c);
		if (!code) { status('off', 'That is not a room code.'); return false; }
		want = true; tries = 0;
		open();
		return true;
	}
	function open() {
		clearTimeout(timer);
		if (!want) return;
		status(tries ? 'reconnecting' : 'connecting');
		const base = url.replace(/^http/, 'ws').replace(/\/$/, '');
		const q = new URLSearchParams({ id, name: name(), seed: String(seed) });
		let s;
		try { s = new WS(`${base}/rooms/${code}/ws?${q}`); } catch { retry(); return; }
		ws = s;
		s.onmessage = (e) => { if (s === ws) handle(e.data); };
		s.onclose = (e) => {
			if (s !== ws) return;
			ws = null; clearInterval(ping);
			if (FINAL.has(e.code) || !want) { want = false; C.players.clear(); status('off', REASONS[e.code] || ''); emit('closed', { code: e.code, why: REASONS[e.code] || '' }); return; }
			retry();
		};
		s.onerror = () => {};
	}
	function retry() {
		// 1 s, 2 s, 4 s ... up to 30 s, with a little jitter
		tries++;
		status('reconnecting');
		timer = setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(5, tries - 1)) * (0.8 + Math.random() * 0.4));
	}
	function handle(raw) {
		if (raw === 'pong') return;
		let m;
		try { m = JSON.parse(raw); } catch { return; }
		switch (m.t) {
			case 'welcome':
				tries = 0;
				C.host = m.host; C.code = m.code;
				C.players.clear();
				for (const p of m.players) if (p.id !== id) C.players.set(p.id, p);
				status('on');
				clearInterval(ping);
				ping = setInterval(() => { if (ws?.readyState === 1) ws.send('ping'); }, 10000);
				emit('welcome', m);
				break;
			case 'join': C.players.set(m.player.id, m.player); emit('join', m.player); break;
			case 'leave': C.players.delete(m.id); emit('leave', m); break;
			case 'host': C.host = m.id; emit('host', m); break;
			case 'pose': { const p = C.players.get(m.id); if (p) p.pose = m; emit('pose', m); break; }
			case 'spot': { const p = C.players.get(m.id); if (p) p.spot = m.code; emit('spot', m); break; }
			case 'state': emit('state', m.s); break;
			case 'event': emit('event', m.e); break;
		}
	}
	const send = (m) => { if (ws?.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; };
	function leave() {
		want = false; clearTimeout(timer); clearInterval(ping);
		const s = ws; ws = null;
		try { s?.close(1000, 'bye'); } catch { /* gone */ }
		C.players.clear();
		status('off');
	}
	return Object.assign(C, { create, join, send, leave, room: () => code, isHost: () => C.host === id && C.status === 'on' });
}
