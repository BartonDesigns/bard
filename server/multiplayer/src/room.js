// One room: a Durable Object holding who is in it, the host's world (the hour and the
// weather) and the host's meetings and gatherings, and passing each player's pose to the
// others. It uses the hibernation API, so a room whose players are standing still (their
// pings answered without waking it) costs nothing while it waits.

import { MAX_PLAYERS, MAX_BYTES, RATE, BURST, STALE_MS, EMPTY_MS, EVENTS_MAX, cleanPose, cleanSpot, cleanState, cleanEvent, cleanName, cleanLook, cleanTrade, cleanFx, cleanHit, cleanCombatState, cleanRules, ID_RE } from '../../../island/src/net/protocol.js';

const SWEEP_MS = 15000;
// close codes the game understands
export const CLOSE = { ended: 4000, replaced: 4001, noRoom: 4404, stale: 4408, full: 4409, tooBig: 4413, tooFast: 4429 };

export class Room {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.meta = null;
		// kept in memory only (lost when the room sleeps, which is fine): last message time,
		// rate buckets, latest poses and spots
		this.seen = new Map();
		this.bucket = new Map();
		this.poses = new Map();
		this.spots = new Map();
		this.wokeAt = Date.now();
		try { state.setWebSocketAutoResponse?.(new globalThis.WebSocketRequestResponsePair('ping', 'pong')); } catch { /* not in tests */ }
	}
	async load() {
		if (!this.meta) this.meta = (await this.state.storage.get('meta')) || null;
		return this.meta;
	}
	save() { return this.state.storage.put('meta', this.meta); }
	sockets() { return this.state.getWebSockets().filter((ws) => { const a = this.info(ws); return a && !a.gone; }); }
	info(ws) { try { return ws.deserializeAttachment(); } catch { return null; } }
	send(ws, msg) { try { ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch { /* closed */ } }
	broadcast(msg, except = null) {
		const s = JSON.stringify(msg);
		for (const ws of this.sockets()) if (ws !== except) this.send(ws, s);
	}
	player(ws) {
		const a = this.info(ws);
		return { id: a.id, name: a.name, look: a.look, joined: a.joined, pose: this.poses.get(a.id) || null, spot: this.spots.get(a.id) || '' };
	}

	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === '/init' && request.method === 'POST') {
			const b = await request.json().catch(() => ({}));
			await this.load();
			if (this.meta && !this.meta.ended) return new Response('taken', { status: 409 });
			if (!ID_RE.test(b.owner || '')) return new Response('bad owner', { status: 400 });
			await this.state.storage.deleteAll?.();
			this.meta = { code: String(b.code || ''), owner: b.owner, host: b.owner, created: Date.now(), emptySince: Date.now(), shared: null, events: [], ended: false, rules: { pvp: false } };
			await this.save();
			await this.state.storage.setAlarm(Date.now() + EMPTY_MS);
			return Response.json({ code: this.meta.code });
		}
		if (url.pathname === '/ws') {
			if (request.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
			const pair = new WebSocketPair(), [client, server] = Object.values(pair);
			await this.connect(server, { id: url.searchParams.get('id'), name: url.searchParams.get('name'), seed: url.searchParams.get('seed') });
			return new Response(null, { status: 101, webSocket: client });
		}
		return new Response('not found', { status: 404 });
	}

	// a player arriving on a new socket
	async connect(ws, q) {
		this.state.acceptWebSocket(ws);
		const meta = await this.load();
		if (!meta || meta.ended) { ws.serializeAttachment({ gone: true }); ws.close(CLOSE.noRoom, 'no such room'); return; }
		if (!ID_RE.test(q.id || '')) { ws.serializeAttachment({ gone: true }); ws.close(1008, 'bad id'); return; }
		// the same player again (a reconnect before the old socket noticed): the new one wins
		for (const old of this.sockets()) if (this.info(old).id === q.id) { old.serializeAttachment({ ...this.info(old), gone: true }); try { old.close(CLOSE.replaced, 'replaced'); } catch { /* gone */ } }
		if (this.sockets().length >= MAX_PLAYERS) { ws.serializeAttachment({ gone: true }); ws.close(CLOSE.full, 'room full'); return; }
		const a = { id: q.id, name: cleanName(q.name), look: cleanLook({ seed: +q.seed }), joined: Date.now() };
		ws.serializeAttachment(a);
		this.seen.set(a.id, Date.now());
		// the room's owner (coming back) takes the host's seat; so does anyone, when no host is here
		const others = this.sockets().filter((s) => s !== ws);
		if (meta.host !== a.id && (a.id === meta.owner || !others.some((s) => this.info(s).id === meta.host))) { meta.host = a.id; this.broadcast({ t: 'host', id: a.id }, ws); }
		meta.emptySince = 0;
		await this.save();
		this.send(ws, { t: 'welcome', you: a.id, host: meta.host, code: meta.code, players: this.sockets().map((s) => this.player(s)), state: meta.shared, events: meta.events, rules: meta.rules || { pvp: false } });
		this.broadcast({ t: 'join', player: this.player(ws) }, ws);
		await this.state.storage.setAlarm(Date.now() + SWEEP_MS);
	}
	// the rate limit: a bucket per player that fills at RATE a second up to BURST
	allow(id) {
		const now = Date.now(), b = this.bucket.get(id) || { n: BURST, t: now, over: 0 };
		b.n = Math.min(BURST, b.n + (now - b.t) / 1000 * RATE); b.t = now;
		this.bucket.set(id, b);
		if (b.n < 1) { b.over++; return b.over > BURST * 2 ? 'close' : false; }
		b.n -= 1; b.over = Math.max(0, b.over - 0.1);
		return true;
	}

	async webSocketMessage(ws, msg) {
		const a = this.info(ws);
		if (!a || a.gone) return;
		this.seen.set(a.id, Date.now());
		if (typeof msg !== 'string' || msg.length > MAX_BYTES) { this.send(ws, { t: 'error', code: 'too-big' }); ws.close(CLOSE.tooBig, 'message too big'); return; }
		if (msg === 'ping') { this.send(ws, 'pong'); return; }
		const ok = this.allow(a.id);
		if (ok === 'close') { ws.close(CLOSE.tooFast, 'too many messages'); return; }
		if (!ok) return;
		let m;
		try { m = JSON.parse(msg); } catch { return; }
		if (!m || typeof m !== 'object') return;
		const meta = await this.load();
		const host = meta.host === a.id;
		switch (m.t) {
			case 'pose': {
				const p = cleanPose(m);
				if (!p) return;
				this.poses.set(a.id, p);
				this.broadcast({ t: 'pose', id: a.id, ...p }, ws);
				return;
			}
			case 'spot': {
				const c = cleanSpot(m.code);
				if (!c) return;
				this.spots.set(a.id, c);
				this.broadcast({ t: 'spot', id: a.id, code: c }, ws);
				return;
			}
			case 'state': {
				if (!host) return;
				const s = cleanState(m.s);
				if (!s) return;
				meta.shared = s;
				await this.save();
				this.broadcast({ t: 'state', s }, ws);
				return;
			}
			case 'event': {
				if (!host) return;
				const e = cleanEvent(m.e);
				if (!e) return;
				const i = meta.events.findIndex((x) => x.id === e.id);
				if (i >= 0) meta.events[i] = e; else meta.events.push(e);
				while (meta.events.length > EVENTS_MAX) meta.events.shift();
				await this.save();
				this.broadcast({ t: 'event', e }, ws);
				return;
			}
			case 'end': {
				if (!host) return;
				meta.ended = true;
				await this.save();
				for (const s of this.sockets()) { s.serializeAttachment({ ...this.info(s), gone: true }); try { s.close(CLOSE.ended, 'the host ended the room'); } catch { /* gone */ } }
				await this.state.storage.setAlarm(Date.now() + 1000);
				return;
			}
			case 'trade': {
				// a trade between two players: passed to the one it is for, and the sender told
				// whether that one was here (so a game can tell an old server, which says nothing)
				const c = cleanTrade(m);
				if (!c || !c.to || c.to === a.id) return;
				const to = this.sockets().find((s) => this.info(s).id === c.to);
				const { to: id, ...rest } = c;
				if (to) this.send(to, { t: 'trade', from: a.id, ...rest });
				this.send(ws, { t: 'trade-ack', id: c.id, op: c.op, to: id, there: !!to });
				return;
			}
			case 'fx': {
				// shots friends see: passed to everyone else
				const f = cleanFx(m);
				if (f) this.broadcast({ t: 'fx', id: a.id, ...f }, ws);
				return;
			}
			case 'hit': {
				const h = cleanHit(m);
				if (!h) return;
				const { to, ...rest } = h;
				if (to) {
					// on another player: only when the room has PvP on
					if (!meta.rules?.pvp || to === a.id) return;
					const s = this.sockets().find((x) => this.info(x).id === to);
					if (s) this.send(s, { t: 'hit', from: a.id, ...rest });
					return;
				}
				// on something shared: the host decides
				if (host) return;
				const hs = this.sockets().find((x) => this.info(x).id === meta.host);
				if (hs) this.send(hs, { t: 'hit', from: a.id, ...rest });
				return;
			}
			case 'cs': {
				// the host's word on bosses and squads
				if (!host) return;
				const c = cleanCombatState(m);
				if (c) this.broadcast({ t: 'cs', ...c }, ws);
				return;
			}
			case 'rules': {
				if (!host) return;
				meta.rules = cleanRules(m.r);
				await this.save();
				this.broadcast({ t: 'rules', r: meta.rules });
				return;
			}
			case 'host': {
				// the host hands the seat to someone else
				if (!host) return;
				const to = this.sockets().find((s) => this.info(s).id === m.id);
				if (!to) return;
				meta.host = m.id;
				await this.save();
				this.broadcast({ t: 'host', id: m.id });
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
		this.poses.delete(a.id); this.spots.delete(a.id); this.seen.delete(a.id); this.bucket.delete(a.id);
		const meta = await this.load();
		if (!meta || meta.ended) return;
		this.broadcast({ t: 'leave', id: a.id });
		const rest = this.sockets();
		if (meta.host === a.id && rest.length) {
			// the host left: the longest here takes over (the owner gets it back on return)
			const next = rest.map((s) => this.info(s)).sort((x, y) => x.joined - y.joined)[0];
			meta.host = next.id;
			this.broadcast({ t: 'host', id: next.id });
		}
		if (!rest.length) meta.emptySince = Date.now();
		await this.save();
		await this.state.storage.setAlarm(Date.now() + (rest.length ? SWEEP_MS : EMPTY_MS));
	}

	// every so often: drop the silent, and forget a room left empty
	async alarm() {
		const meta = await this.load();
		if (!meta) return;
		const now = Date.now();
		if (meta.ended) { await this.state.storage.deleteAll(); this.meta = null; return; }
		for (const ws of this.sockets()) {
			const a = this.info(ws);
			const pinged = this.state.getWebSocketAutoResponseTimestamp?.(ws)?.getTime?.() || 0;
			const last = Math.max(this.seen.get(a.id) || this.wokeAt, pinged);
			if (now - last > STALE_MS) { try { ws.close(CLOSE.stale, 'timed out'); } catch { /* gone */ } await this.leave(ws); }
		}
		const rest = this.sockets();
		if (!rest.length) {
			if (!meta.emptySince) { meta.emptySince = now; await this.save(); }
			if (now - meta.emptySince >= EMPTY_MS) { await this.state.storage.deleteAll(); this.meta = null; return; }
			await this.state.storage.setAlarm(meta.emptySince + EMPTY_MS);
		} else await this.state.storage.setAlarm(now + SWEEP_MS);
	}
}
