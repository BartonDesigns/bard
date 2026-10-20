// The chat hub: one Durable Object everyone online joins by WebSocket, room or no room. It
// carries three channels, everyone (world), everyone in your region of the world (region) and
// your group (group), as text or short voice clips; and it keeps the groups: up to GROUP_MAX
// players, one leading, joined by an invite or by asking. A group's leader can share a room
// code (room.js) so the whole group plays together.
//
// What it keeps: each channel's latest texts (never voice), the groups, open invites and
// requests. Players are the same ids as in rooms (a browser tab's); a signed-in player is
// also known by their account (checked against account.js), which carries their group to a
// new tab or device. It uses the hibernation API: a quiet hub costs nothing.
//
//   GET /chat/ws?id=&name=&r=&rn=    (WebSocket) r/rn: your region's id and name

import { ID_RE, cleanName, cleanCode } from '../../../island/src/net/protocol.js';
import { RANK_TOP } from '../../../island/src/combat/honor.js';
import { CHAT_FEATURE, CHAT_MAX_BYTES, HISTORY_MAX, GROUP_MAX, INVITE_MS, GROUP_IDLE_MS, GROUP_ID_RE, SAY_RATE, SAY_BURST, VOICE_PER_MIN, cleanChannel, cleanText, cleanRegion, cleanVoice, cleanGroupName } from '../../../island/src/net/chat-protocol.js';

export { CHAT_FEATURE };
// messages a second of any kind (and the burst over it); a flood past twice the burst closes
const RATE = 8, BURST = 30;
const STALE_MS = 75000, SWEEP_MS = 60000;
// regions whose latest texts are kept (the least recently used one is let go)
const REGIONS_KEPT = 300;
export const CHAT_CLOSE = { replaced: 4001, tooBig: 4413, tooFast: 4429, stale: 4408 };

const rankIn = (k) => Math.max(0, Math.min(RANK_TOP, Math.floor(+k) || 0));
const mid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const gidNew = () => 'g' + [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join('') + Date.now().toString(36).slice(-4);
// someone as everyone sees them (never their account's username: that is how they log in)
const whoOf = (a) => ({ id: a.id, name: a.name, n: a.tag || 100, ...(a.acct ? { v: 1 } : {}), ...(a.k ? { k: a.k } : {}) });
// a three-digit number of their own, set beside their name when two of the same name meet
function tagOf(key) { let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return 100 + ((h >>> 0) % 900); }

export class ChatHub {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		// in memory only: rate buckets and the last message time, per player
		this.bucket = new Map();
		this.seen = new Map();
		this.wokeAt = Date.now();
		try { state.setWebSocketAutoResponse?.(new globalThis.WebSocketRequestResponsePair('ping', 'pong')); } catch { /* not in tests */ }
	}
	get store() { return this.state.storage; }
	info(ws) { try { return ws.deserializeAttachment(); } catch { return null; } }
	sockets() { return this.state.getWebSockets().filter((ws) => { const a = this.info(ws); return a && !a.gone; }); }
	send(ws, msg) { try { ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch { /* closed */ } }
	// everyone online, by id (one socket each: a newer one replaces an older)
	online() { const M = new Map(); for (const ws of this.sockets()) M.set(this.info(ws).id, ws); return M; }
	to(id, msg) { const ws = this.online().get(id); if (ws) this.send(ws, msg); return !!ws; }

	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname !== '/ws') return new Response('not found', { status: 404 });
		if (request.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
		const pair = new WebSocketPair(), [client, server] = Object.values(pair);
		await this.connect(server, Object.fromEntries(url.searchParams));
		return new Response(null, { status: 101, webSocket: client });
	}

	async connect(ws, q) {
		this.state.acceptWebSocket(ws);
		if (!ID_RE.test(q.id || '')) { ws.serializeAttachment({ gone: true }); ws.close(1008, 'bad id'); return; }
		for (const old of this.sockets()) if (old !== ws && this.info(old).id === q.id) { old.serializeAttachment({ ...this.info(old), gone: true }); try { old.close(CHAT_CLOSE.replaced, 'replaced'); } catch { /* gone */ } }
		const a = { id: q.id, name: cleanName(q.name), acct: '', tag: tagOf(q.id), k: rankIn(q.k), r: cleanRegion(q.r, q.rn), joined: Date.now() };
		ws.serializeAttachment(a);
		this.seen.set(a.id, Date.now());
		const gid = await this.store.get('pg:' + a.id);
		const g = gid && await this.group(gid);
		this.send(ws, {
			t: 'welcome', you: a.id, features: [CHAT_FEATURE], online: this.sockets().length, now: Date.now(), region: a.r,
			history: { world: (await this.store.get('h:world')) || [], region: a.r ? (await this.store.get('h:r:' + a.r.id)) || [] : [], group: g ? (await this.store.get('h:g:' + g.gid)) || [] : [] },
			group: g ? this.view(g) : null, invites: await this.invites(a.id),
		});
		if (g) { g.seen = Date.now(); await this.putGroup(g); this.tellGroup(g); }
		await this.state.storage.setAlarm(Date.now() + SWEEP_MS);
	}

	// ---------- the rate ----------
	allow(id, key = '', rate = RATE, burst = BURST) {
		const k = id + key, now = Date.now(), b = this.bucket.get(k) || { n: burst, t: now, over: 0 };
		b.n = Math.min(burst, b.n + (now - b.t) / 1000 * rate); b.t = now;
		this.bucket.set(k, b);
		if (this.bucket.size > 4000) this.bucket.delete(this.bucket.keys().next().value);
		if (b.n < 1) { b.over++; return b.over > burst * 2 ? 'close' : false; }
		b.n -= 1; b.over = Math.max(0, b.over - 0.1);
		return true;
	}

	// ---------- the groups ----------
	async group(gid) { return GROUP_ID_RE.test(gid || '') ? (await this.store.get('g:' + gid)) || null : null; }
	async putGroup(g) { await this.store.put('g:' + g.gid, g); }
	async index(fn) { const L = (await this.store.get('groups')) || []; const next = fn(L); await this.store.put('groups', next); }
	// the group as its players see it: who is online, and where
	view(g) {
		const on = this.online();
		return { gid: g.gid, name: g.name, leader: g.leader, room: g.room || '', members: g.members.map((m) => { const s = on.get(m.id), a = s && this.info(s); return { ...(a ? whoOf(a) : m), on: !!s, ...(a?.r ? { r: a.r.name } : {}) }; }), asks: (g.asks || []).filter((x) => Date.now() - x.at < INVITE_MS).map(({ at: _at, ...w }) => w) };
	}
	tellGroup(g) { const v = this.view(g), on = this.online(); for (const m of g.members) { const s = on.get(m.id); if (s) this.send(s, { t: 'group', g: v }); } }
	async invites(id) {
		const L = ((await this.store.get('inv:' + id)) || []).filter((x) => Date.now() - x.at < INVITE_MS);
		const out = [];
		for (const x of L) { const g = await this.group(x.gid); if (g && g.members.length < GROUP_MAX && !g.members.some((m) => m.id === id)) out.push({ gid: g.gid, name: g.name, from: x.from, n: g.members.length }); }
		return out;
	}
	async sendInvites(id) { this.to(id, { t: 'invites', list: await this.invites(id) }); }
	async make(a, name) {
		const gid = gidNew();
		const g = { gid, name: cleanGroupName(name) || `${a.name}'s group`, leader: a.id, members: [whoOf(a)], made: Date.now(), seen: Date.now(), room: '', asks: [] };
		await this.putGroup(g);
		await this.store.put('pg:' + a.id, gid);
		await this.index((L) => [...L, gid]);
		return g;
	}
	async add(g, w) {
		if (g.members.some((m) => m.id === w.id)) return true;
		if (g.members.length >= GROUP_MAX) return false;
		const was = await this.store.get('pg:' + w.id);
		if (was && was !== g.gid) await this.remove(was, w.id, `${w.name} joined another group.`);
		g.members.push(whoOf(w));
		g.asks = (g.asks || []).filter((x) => x.id !== w.id);
		g.seen = Date.now();
		await this.putGroup(g);
		await this.store.put('pg:' + w.id, g.gid);
		await this.store.delete('inv:' + w.id);
		this.say(g, `${w.name} joined the group.`);
		this.tellGroup(g);
		// (they arrive to the group's latest texts)
		this.to(w.id, { t: 'history', ch: 'group', list: (await this.store.get('h:g:' + g.gid)) || [] });
		return true;
	}
	// someone out of a group (they left, or were asked to): the group told, emptied groups gone
	async remove(gid, id, why = '') {
		const g = await this.group(gid);
		await this.store.delete('pg:' + id);
		this.to(id, { t: 'group', g: null });
		if (!g) return;
		g.members = g.members.filter((m) => m.id !== id);
		if (!g.members.length) { await this.drop(g.gid); return; }
		if (g.leader === id) g.leader = g.members[0].id;
		await this.putGroup(g);
		if (why) this.say(g, why);
		this.tellGroup(g);
	}
	async drop(gid) {
		const g = await this.group(gid);
		for (const m of g?.members || []) { await this.store.delete('pg:' + m.id); this.to(m.id, { t: 'group', g: null }); }
		await this.store.delete('g:' + gid);
		await this.store.delete('h:g:' + gid);
		await this.index((L) => L.filter((x) => x !== gid));
	}
	// a line from the group itself (who joined, who leads now), kept with its texts
	say(g, text) {
		const m = { t: 'said', ch: 'group', mid: mid(), at: Date.now(), from: null, text };
		this.keep('h:g:' + g.gid, m);
		const on = this.online();
		for (const x of g.members) { const s = on.get(x.id); if (s) this.send(s, m); }
	}

	// ---------- the channels ----------
	keep(key, m) {
		return this.store.get(key).then((L = []) => { L = L || []; L.push(m); while (L.length > HISTORY_MAX) L.shift(); return this.store.put(key, L); });
	}
	async keepRegion(rid, m) {
		await this.keep('h:r:' + rid, m);
		const R = ((await this.store.get('regions')) || []).filter((x) => x !== rid);
		R.push(rid);
		while (R.length > REGIONS_KEPT) await this.store.delete('h:r:' + R.shift());
		await this.store.put('regions', R);
	}
	// who gets a message on a channel from this player: [sockets] (or null: nowhere to say it)
	async audience(a, ch) {
		const all = this.sockets();
		if (ch === 'world') return all;
		if (ch === 'region') return a.r ? all.filter((s) => this.info(s).r?.id === a.r.id) : null;
		const gid = await this.store.get('pg:' + a.id), g = gid && await this.group(gid);
		if (!g) return null;
		const ids = new Set(g.members.map((m) => m.id));
		return all.filter((s) => ids.has(this.info(s).id));
	}

	async webSocketMessage(ws, raw) {
		const a = this.info(ws);
		if (!a || a.gone) return;
		this.seen.set(a.id, Date.now());
		if (typeof raw !== 'string' || raw.length > CHAT_MAX_BYTES) { this.send(ws, { t: 'error', code: 'too-big' }); ws.close(CHAT_CLOSE.tooBig, 'message too big'); return; }
		if (raw === 'ping') { this.send(ws, 'pong'); return; }
		const ok = this.allow(a.id);
		if (ok === 'close') { ws.close(CHAT_CLOSE.tooFast, 'too many messages'); return; }
		if (!ok) return;
		let m;
		try { m = JSON.parse(raw); } catch { return; }
		if (!m || typeof m !== 'object') return;
		const note = (text) => this.send(ws, { t: 'note', text });
		const gid = await this.store.get('pg:' + a.id);
		switch (m.t) {
			case 'acct': {
				// a signed-in player: checked with their account, then known by it
				if (!this.env.ACCOUNTS || typeof m.u !== 'string' || !/^[a-z0-9_-]{3,20}$/.test(m.u) || typeof m.token !== 'string' || !/^[a-f0-9]{64}$/.test(m.token)) return;
				if (!this.allow(a.id, ':acct', 0.05, 3)) return;
				const r = await this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName('user:' + m.u)).fetch(new Request('https://account/peek', { method: 'POST', headers: { authorization: 'Bearer ' + m.token }, body: JSON.stringify({ u: m.u }) })).catch(() => null);
				if (!r?.ok) { this.send(ws, { t: 'acct', ok: false }); return; }
				// known by the player name their account holds (account.js 'name': changed once in
				// 30 days), and by a number that stays theirs on any device
				const held = await r.json().catch(() => ({}));
				const me = { ...this.info(ws), acct: m.u, tag: tagOf('acct:' + m.u), name: held?.name ? cleanName(held.name) : this.info(ws).name };
				ws.serializeAttachment(me);
				// your group follows your account to this tab or device
				const before = await this.store.get('pa:' + m.u);
				await this.store.put('pa:' + m.u, a.id);
				if (before && before !== a.id && !gid && !this.online().has(before)) {
					const old = await this.store.get('pg:' + before), g = old && await this.group(old);
					if (g) {
						g.members = g.members.map((x) => (x.id === before ? whoOf(me) : x));
						if (g.leader === before) g.leader = a.id;
						await this.store.delete('pg:' + before);
						await this.store.put('pg:' + a.id, g.gid);
						await this.putGroup(g);
						this.send(ws, { t: 'history', ch: 'group', list: (await this.store.get('h:g:' + g.gid)) || [] });
					}
				}
				this.send(ws, { t: 'acct', ok: true, me: whoOf(me) });
				const g = await this.group(await this.store.get('pg:' + a.id));
				if (g) { g.members = g.members.map((x) => (x.id === a.id ? whoOf(me) : x)); await this.putGroup(g); this.tellGroup(g); }
				return;
			}
			case 'name': {
				// (a signed-in player's name is their account's: changed there, then 'acct' again)
				if (a.acct) return;
				const me = { ...this.info(ws), name: cleanName(m.name) };
				ws.serializeAttachment(me);
				const g = await this.group(gid);
				if (g) { g.members = g.members.map((x) => (x.id === a.id ? whoOf(me) : x)); await this.putGroup(g); this.tellGroup(g); }
				return;
			}
			case 'rank': {
				// your honor's rank (combat/honor.js): bold names from Vanguard, gold for Exalted
				const k = rankIn(m.k);
				if (k === (a.k || 0)) return;
				ws.serializeAttachment({ ...a, k });
				const g = await this.group(gid);
				if (g) this.tellGroup(g);
				return;
			}
			case 'where': {
				// a new region: its latest texts come with it
				const r = cleanRegion(m.r, m.rn);
				if (!r || r.id === a.r?.id) return;
				ws.serializeAttachment({ ...a, r });
				this.send(ws, { t: 'history', ch: 'region', region: r, list: (await this.store.get('h:r:' + r.id)) || [] });
				const g = await this.group(gid);
				if (g) this.tellGroup(g);
				return;
			}
			case 'say': {
				const ch = cleanChannel(m.ch), text = cleanText(m.text);
				if (!ch || !text) return;
				if (!this.allow(a.id, ':say', SAY_RATE, SAY_BURST)) { note('Slow down a little: one message a second.'); return; }
				const to = await this.audience(a, ch);
				if (!to) { note(ch === 'group' ? 'You are not in a group yet.' : 'Your region is not known yet.'); return; }
				const out = { t: 'said', ch, mid: mid(), at: Date.now(), from: whoOf(a), text, ...(ch === 'region' ? { r: a.r.name } : {}) };
				const s = JSON.stringify(out);
				for (const x of to) this.send(x, s);
				await (ch === 'world' ? this.keep('h:world', out) : ch === 'region' ? this.keepRegion(a.r.id, out) : this.keep('h:g:' + gid, out));
				return;
			}
			case 'voice': {
				const v = cleanVoice(m);
				if (!v) return;
				if (!this.allow(a.id, ':voice', VOICE_PER_MIN / 60, 3)) { note('That is a lot of talking: wait a moment.'); return; }
				const to = await this.audience(a, v.ch);
				if (!to) { note(v.ch === 'group' ? 'You are not in a group yet.' : 'Your region is not known yet.'); return; }
				// (voice is passed on, never kept)
				const s = JSON.stringify({ t: 'voice', mid: mid(), at: Date.now(), from: whoOf(a), ...v, ...(v.ch === 'region' ? { r: a.r.name } : {}) });
				for (const x of to) this.send(x, s);
				return;
			}
			case 'who': {
				// who is online: by name when asked, else your region's first
				const q = typeof m.q === 'string' ? m.q.trim().toLowerCase().slice(0, 24) : '';
				const L = [];
				for (const s of this.sockets()) {
					const b = this.info(s);
					if (b.id === a.id) continue;
					if (L.length >= 120) break;
					if (q && !b.name.toLowerCase().includes(q)) continue;
					L.push({ ...whoOf(b), ...(b.r ? { r: b.r.name } : {}), near: !!(a.r && b.r?.id === a.r.id), g: !!(await this.store.get('pg:' + b.id)) });
				}
				L.sort((x, y) => (y.near - x.near) || x.name.localeCompare(y.name));
				this.send(ws, { t: 'who', q, online: this.sockets().length, players: L.slice(0, 40) });
				return;
			}
			case 'g-make': {
				if (gid) { note('Leave your group first.'); return; }
				const g = await this.make(a, m.name);
				this.tellGroup(g);
				return;
			}
			case 'g-name': {
				const g = await this.group(gid), n = cleanGroupName(m.name);
				if (!g || g.leader !== a.id || !n) return;
				g.name = n; await this.putGroup(g);
				this.say(g, `The group is called ${n} now.`);
				this.tellGroup(g);
				return;
			}
			case 'g-invite': {
				// you invite someone: into your group (made for you if you have none)
				const s = this.online().get(m.to), b = s && this.info(s);
				if (!b || b.id === a.id) { note('They are not online.'); return; }
				let g = await this.group(gid);
				if (!g) { g = await this.make(a); this.tellGroup(g); }
				if (g.members.some((x) => x.id === b.id)) { note(`${b.name} is in your group already.`); return; }
				if (g.members.length >= GROUP_MAX) { note(`The group is full (${GROUP_MAX}).`); return; }
				const L = ((await this.store.get('inv:' + b.id)) || []).filter((x) => x.gid !== g.gid && Date.now() - x.at < INVITE_MS).slice(-7);
				L.push({ gid: g.gid, from: whoOf(a), at: Date.now() });
				await this.store.put('inv:' + b.id, L);
				await this.sendInvites(b.id);
				note(`Invited ${b.name}.`);
				return;
			}
			case 'g-accept': case 'g-decline': {
				const L = (await this.store.get('inv:' + a.id)) || [], x = L.find((i) => i.gid === m.gid && Date.now() - i.at < INVITE_MS);
				await this.store.put('inv:' + a.id, L.filter((i) => i.gid !== m.gid));
				if (!x) { await this.sendInvites(a.id); return; }
				if (m.t === 'g-decline') { this.to(x.from.id, { t: 'note', text: `${a.name} said no thanks to your group.` }); await this.sendInvites(a.id); return; }
				const g = await this.group(x.gid);
				if (!g) { note('That group has broken up.'); await this.sendInvites(a.id); return; }
				if (!(await this.add(g, a))) note('That group is full.');
				await this.sendInvites(a.id);
				return;
			}
			case 'g-ask': {
				// you ask to join someone's group: their leader decides
				if (typeof m.to !== 'string') return;
				const g = await this.group(await this.store.get('pg:' + m.to));
				if (!g) { note('They are not in a group. Invite them to yours instead.'); return; }
				if (g.members.some((x) => x.id === a.id)) return;
				if (g.members.length >= GROUP_MAX) { note('That group is full.'); return; }
				g.asks = (g.asks || []).filter((x) => x.id !== a.id && Date.now() - x.at < INVITE_MS).slice(-15);
				g.asks.push({ ...whoOf(a), at: Date.now() });
				await this.putGroup(g);
				this.tellGroup(g);
				note(`Asked to join ${g.name}. Its leader decides.`);
				return;
			}
			case 'g-let': case 'g-refuse': {
				const g = await this.group(gid);
				if (!g || g.leader !== a.id) return;
				const x = (g.asks || []).find((w) => w.id === m.id && Date.now() - w.at < INVITE_MS);
				g.asks = (g.asks || []).filter((w) => w.id !== m.id);
				await this.putGroup(g);
				if (!x) { this.tellGroup(g); return; }
				if (m.t === 'g-refuse') { this.to(x.id, { t: 'note', text: `${g.name} cannot take you right now.` }); this.tellGroup(g); return; }
				if (!this.online().has(x.id)) { note(`${x.name} is not online any more.`); this.tellGroup(g); return; }
				if (!(await this.add(g, x))) { note('The group is full.'); this.tellGroup(g); }
				return;
			}
			case 'g-leave': {
				if (!gid) return;
				await this.remove(gid, a.id, `${a.name} left the group.`);
				return;
			}
			case 'g-kick': {
				const g = await this.group(gid);
				if (!g || g.leader !== a.id || m.id === a.id || !g.members.some((x) => x.id === m.id)) return;
				const w = g.members.find((x) => x.id === m.id);
				this.to(m.id, { t: 'note', text: `You are no longer in ${g.name}.` });
				await this.remove(gid, m.id, `${w.name} is out of the group.`);
				return;
			}
			case 'g-lead': {
				const g = await this.group(gid);
				if (!g || g.leader !== a.id || !g.members.some((x) => x.id === m.id)) return;
				g.leader = m.id; await this.putGroup(g);
				const w = g.members.find((x) => x.id === m.id);
				this.say(g, `${w.name} leads the group now.`);
				this.tellGroup(g);
				return;
			}
			case 'g-room': {
				// the leader's room (room.js), for the group to play together; '' when it closes
				const g = await this.group(gid);
				if (!g || g.leader !== a.id) return;
				const code = cleanCode(m.code);
				if (code === (g.room || '')) return;
				g.room = code; await this.putGroup(g);
				if (code) this.say(g, `${a.name} opened a room for the group. Tap Play together to join.`);
				this.tellGroup(g);
				return;
			}
		}
	}
	async webSocketClose(ws) { await this.leave(ws); }
	async webSocketError(ws) { await this.leave(ws); }
	async leave(ws) {
		const a = this.info(ws);
		if (!a || a.gone) return;
		ws.serializeAttachment({ ...a, gone: true });
		try { ws.close(1000, 'bye'); } catch { /* already */ }
		this.seen.delete(a.id);
		const g = await this.group(await this.store.get('pg:' + a.id));
		if (g) { g.seen = Date.now(); await this.putGroup(g); this.tellGroup(g); }
	}
	// every minute while anyone is here: drop the silent; and now and then forget idle groups
	async alarm() {
		const now = Date.now();
		for (const ws of this.sockets()) {
			const a = this.info(ws);
			const pinged = this.state.getWebSocketAutoResponseTimestamp?.(ws)?.getTime?.() || 0;
			if (now - Math.max(this.seen.get(a.id) || this.wokeAt, pinged) > STALE_MS) { try { ws.close(CHAT_CLOSE.stale, 'timed out'); } catch { /* gone */ } await this.leave(ws); }
		}
		const swept = (await this.store.get('swept')) || 0;
		if (now - swept > 6 * 3600e3) {
			await this.store.put('swept', now);
			const on = this.online();
			for (const gid of (await this.store.get('groups')) || []) {
				const g = await this.group(gid);
				if (!g) { await this.index((L) => L.filter((x) => x !== gid)); continue; }
				if (!g.members.some((m) => on.has(m.id)) && now - (g.seen || g.made) > GROUP_IDLE_MS) await this.drop(gid);
			}
		}
		if (this.sockets().length) await this.state.storage.setAlarm(now + SWEEP_MS);
	}
}
