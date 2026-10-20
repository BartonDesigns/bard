// The connection to the chat hub (server/multiplayer/src/chat.js): one WebSocket for world,
// region and group chat and the group itself, a ping every 25 s, and a reconnect with backoff
// when the line drops. It keeps what was said in each channel (the latest LOG_MAX), the group,
// and the invites waiting for you. Callers get events: status, welcome, said, voice, group,
// invites, who, note, acct, region.

import { cleanText, cleanVoice, cleanWho, cleanGroup, cleanRegion, CHANNELS } from './chat-protocol.js';

export const LOG_MAX = 120;
const FINAL = new Set([4001, 1008]);
export const CHAT_REASONS = { 4001: 'Chat was opened in another window.', 4413: 'A chat message was too big.', 4429: 'Too many chat messages.', 4408: 'Chat timed out.', 1008: 'Chat refused this player.' };

// url: the rooms server; id: this tab's player id (net/multiplayer.js); name(), region() {id,
// name}, rank(): read when connecting
export function createChatClient({ url, id, name, region = () => null, rank = () => 0, WS = globalThis.WebSocket, on = () => {} }) {
	let ws = null, tries = 0, timer = null, ping = null, want = false;
	const C = { status: 'off', me: null, group: null, invites: [], online: 0, region: null, log: Object.fromEntries(CHANNELS.map((c) => [c, []])), sent: { r: '', k: -1 } };
	const emit = (t, v) => { try { on(t, v); } catch (e) { console.warn('[chat]', t, e); } };
	const status = (s, why = '') => { if (C.status !== s) { C.status = s; emit('status', { status: s, why }); } };

	function start() { if (want) return; want = true; tries = 0; open(); }
	function open() {
		clearTimeout(timer);
		if (!want) return;
		status(tries ? 'reconnecting' : 'connecting');
		const base = url.replace(/^http/, 'ws').replace(/\/$/, ''), r = region();
		const q = new URLSearchParams({ id, name: name(), k: String(rank() | 0) });
		if (r?.id) { q.set('r', r.id); q.set('rn', r.name || r.id); }
		C.sent.r = r?.id || ''; C.sent.k = rank() | 0;
		let s;
		try { s = new WS(`${base}/chat/ws?${q}`); } catch { retry(); return; }
		ws = s;
		s.onmessage = (e) => { if (s === ws) handle(e.data); };
		s.onclose = (e) => {
			if (s !== ws) return;
			ws = null; clearInterval(ping);
			if (FINAL.has(e.code) || !want) { want = false; status('off', CHAT_REASONS[e.code] || ''); return; }
			retry();
		};
		s.onerror = () => {};
	}
	function retry() {
		tries++;
		status('reconnecting');
		timer = setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(5, tries - 1)) * (0.8 + Math.random() * 0.4));
	}
	// a line into a channel's log (each once: history comes again on a reconnect)
	function keep(ch, m) {
		const L = C.log[ch];
		if (!L || L.some((x) => x.mid === m.mid)) return false;
		L.push(m);
		L.sort((a, b) => a.at - b.at);
		while (L.length > LOG_MAX) L.shift();
		return true;
	}
	const line = (m, ch) => {
		if (typeof m?.mid !== 'string' || !Number.isFinite(m.at)) return null;
		const text = cleanText(m.text);
		if (!text) return null;
		const from = m.from === null ? null : cleanWho(m.from);
		if (m.from !== null && !from) return null;
		return { mid: m.mid.slice(0, 24), at: m.at, ch, from, text, ...(typeof m.r === 'string' ? { r: m.r.slice(0, 48) } : {}) };
	};
	function history(ch, list) { let n = 0; for (const m of Array.isArray(list) ? list.slice(-60) : []) { const l = line(m, ch); if (l && keep(ch, l)) n++; } return n; }
	function handle(raw) {
		if (raw === 'pong') return;
		let m;
		try { m = JSON.parse(raw); } catch { return; }
		switch (m.t) {
			case 'welcome':
				tries = 0;
				C.online = m.online | 0;
				C.group = cleanGroup(m.group);
				C.invites = Array.isArray(m.invites) ? m.invites : [];
				// (a new region's texts replace the last one's)
				C.log.region.length = 0;
				for (const ch of CHANNELS) history(ch, m.history?.[ch]);
				status('on');
				clearInterval(ping);
				ping = setInterval(() => { if (ws?.readyState === 1) ws.send('ping'); }, 25000);
				emit('welcome', m);
				break;
			case 'said': { const ch = CHANNELS.includes(m.ch) ? m.ch : '', l = ch && line(m, ch); if (l && keep(ch, l)) emit('said', l); break; }
			case 'voice': {
				const v = cleanVoice(m), from = cleanWho(m.from);
				if (!v || !from || typeof m.mid !== 'string') break;
				const l = { mid: m.mid.slice(0, 24), at: +m.at || Date.now(), ch: v.ch, from, voice: { mime: v.mime, ms: v.ms, data: v.data }, ...(typeof m.r === 'string' ? { r: m.r.slice(0, 48) } : {}) };
				if (keep(v.ch, l)) emit('voice', l);
				break;
			}
			case 'history': {
				if (m.ch === 'region') { C.log.region.length = 0; C.region = cleanRegion(m.region?.id, m.region?.name); emit('region', C.region); }
				if (CHANNELS.includes(m.ch)) { history(m.ch, m.list); emit('history', { ch: m.ch }); }
				break;
			}
			case 'group': {
				const was = C.group?.gid || '';
				C.group = cleanGroup(m.g);
				if (!C.group) C.log.group.length = 0;
				else if (C.group.gid !== was) C.log.group.length = 0;
				emit('group', C.group);
				break;
			}
			case 'invites': C.invites = Array.isArray(m.list) ? m.list.slice(0, 8) : []; emit('invites', C.invites); break;
			case 'who': C.online = m.online | 0; emit('who', { q: m.q || '', players: (Array.isArray(m.players) ? m.players : []).map((p) => { const w = cleanWho(p); return w && { ...w, r: typeof p.r === 'string' ? p.r.slice(0, 48) : '', near: !!p.near, g: !!p.g }; }).filter(Boolean) }); break;
			case 'note': if (typeof m.text === 'string') emit('note', m.text.slice(0, 200)); break;
			case 'acct': C.me = m.ok ? cleanWho(m.me) : null; emit('acct', { ok: !!m.ok, me: C.me }); break;
		}
	}
	const send = (m) => { if (ws?.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; };
	// the game's region and rank, as they change
	function track() {
		if (C.status !== 'on') return;
		const r = region();
		if (r?.id && r.id !== C.sent.r) { C.sent.r = r.id; send({ t: 'where', r: r.id, rn: r.name || r.id }); }
		const k = rank() | 0;
		if (k !== C.sent.k) { C.sent.k = k; send({ t: 'rank', k }); }
	}
	function stop() {
		want = false; clearTimeout(timer); clearInterval(ping);
		const s = ws; ws = null;
		try { s?.close(1000, 'bye'); } catch { /* gone */ }
		status('off');
	}
	return Object.assign(C, {
		start, stop, send, track, me: () => id,
		say: (ch, text) => send({ t: 'say', ch, text: cleanText(text) }),
		voice: (ch, clip) => send({ t: 'voice', ch, ...clip }),
		who: (q = '') => send({ t: 'who', q }),
		rename: (n) => send({ t: 'name', name: n }),
		account: (cred) => (cred ? send({ t: 'acct', u: cred.u, token: cred.token }) : false),
		makeGroup: (n) => send({ t: 'g-make', name: n }),
		nameGroup: (n) => send({ t: 'g-name', name: n }),
		invite: (to) => send({ t: 'g-invite', to }),
		accept: (gid) => send({ t: 'g-accept', gid }),
		decline: (gid) => send({ t: 'g-decline', gid }),
		ask: (to) => send({ t: 'g-ask', to }),
		letIn: (who) => send({ t: 'g-let', id: who }),
		refuse: (who) => send({ t: 'g-refuse', id: who }),
		leaveGroup: () => send({ t: 'g-leave' }),
		kick: (who) => send({ t: 'g-kick', id: who }),
		lead: (who) => send({ t: 'g-lead', id: who }),
		shareRoom: (code) => send({ t: 'g-room', code }),
		leads: () => !!C.group && C.group.leader === id,
	});
}
