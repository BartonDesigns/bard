// Guilds and the alliances between them, kept for good: one Durable Object (the registry, by
// the name 'registry') holding every guild, so names and tags stay one each and a player is in
// one guild at a time. Players are accounts (account.js): src/index.js asks the player's own
// Account who is signed in (whoami) before anything reaches here, and passes the username in
// x-guild-user. The rules and limits are the game's own (island/src/guild/guild-rules.js).
//
// A guild record: { id, name, tag, colours, founded, members: [{ u, rank, joined }],
// invites: [{ u, by, at }], allies: [guild id], asks: [{ from: guild id, at }] (alliances
// offered to it), npcs: [{ name, role, level }] (its townsfolk, as the founder's game reports
// them) }. Nothing else about anyone: usernames, and what they called their guild.
//
//   POST mine                 -> { guild | null, invites: [summary] }
//   POST found { name, tag, colours, npcs } -> { guild }
//   POST edit  { colours?, npcs? }          (leader, officer)
//   POST invite { to } / uninvite { to }    (leader, officer)
//   POST join { id } / decline { id }       (one invited)
//   POST leave                              (the leader's seat passes to the longest there)
//   POST kick { who }                       (leader; officers over members)
//   POST rank { who, rank }                 (leader; rank 'leader' hands the guild over)
//   POST ally { tag }                       (leader, officer: offered, or accepted if offered to you)
//   POST unally { id }                      (an alliance ended, an offer withdrawn or turned down)
//   POST find { tag }  -> { guild: summary | null }
//   POST list          -> { guilds: [summary] } (the biggest, for finding one)
import { nameOk, cleanName, TAG_RE, cleanTag, cleanColours, ROLES, RANKS, LEVEL_MAX, NPC_MAX, PLAYERS_MAX, ALLIES_MAX, INVITES_MAX } from '../../../island/src/guild/guild-rules.js';
import { usernameOk, cleanUsername } from '../../../island/src/persistence/cloud-save.js';

const json = (v, status = 200) => Response.json(v, { status });
const no = (error, status = 400) => json({ error }, status);
const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';
const newId = () => 'g' + [...crypto.getRandomValues(new Uint8Array(10))].map((b) => ALPHA[b % ALPHA.length]).join('');
const cleanNpcs = (L) => (Array.isArray(L) ? L : []).slice(0, NPC_MAX).filter((m) => m && ROLES[m.role]).map((m) => ({ name: cleanName(m.name).slice(0, 40) || 'A friend', role: m.role, level: Math.max(1, Math.min(LEVEL_MAX, Math.floor(+m.level || 1))) }));
const summary = (g) => g && { id: g.id, name: g.name, tag: g.tag, colours: g.colours, members: g.members.length, npcs: g.npcs.length, founded: g.founded };
const rankOf = (g, u) => g?.members.find((m) => m.u === u)?.rank || null;
const may = (g, u) => ['leader', 'officer'].includes(rankOf(g, u));

export class Guilds {
	constructor(state, env = {}) { this.state = state; this.env = env; this.chain = Promise.resolve(); }
	// one request at a time, so two players founding the same name cannot both have it
	fetch(request) { const r = this.chain.then(() => this.handle(request)); this.chain = r.catch(() => {}); return r; }
	get(id) { return typeof id === 'string' && /^g[a-z0-9]{6,20}$/.test(id) ? this.state.storage.get('g:' + id) : Promise.resolve(null); }
	async who(u) { return (await this.state.storage.get('u:' + u)) || { guild: null, invites: [] }; }
	async put(g) { await this.state.storage.put('g:' + g.id, g); }
	async player(u, P) { await this.state.storage.put('u:' + u, P); }
	// what a member sees of their guild: everyone in it, its invites, its allies and the offers made to it
	async view(g) {
		const allies = (await Promise.all(g.allies.map((id) => this.get(id)))).filter(Boolean).map(summary);
		const asks = (await Promise.all(g.asks.map((a) => this.get(a.from)))).filter(Boolean).map(summary);
		const offered = [];
		for (const id of g.offered || []) { const o = await this.get(id); if (o) offered.push(summary(o)); }
		return { ...summary(g), members: g.members, invites: g.invites.map((i) => ({ u: i.u, at: i.at })), npcs: g.npcs, allies, asks, offered };
	}
	async gone(g) {
		const S = this.state.storage;
		for (const id of g.allies) { const o = await this.get(id); if (o) { o.allies = o.allies.filter((x) => x !== g.id); await this.put(o); } }
		for (const id of g.offered || []) { const o = await this.get(id); if (o) { o.asks = o.asks.filter((a) => a.from !== g.id); await this.put(o); } }
		for (const i of g.invites) { const P = await this.who(i.u); P.invites = P.invites.filter((x) => x !== g.id); await this.player(i.u, P); }
		await S.delete('g:' + g.id); await S.delete('n:' + g.name.toLowerCase()); await S.delete('t:' + g.tag);
	}
	async handle(request) {
		const url = new URL(request.url), op = url.pathname.replace(/^\//, ''), S = this.state.storage;
		const u = cleanUsername(request.headers.get('x-guild-user') || '');
		if (!usernameOk(u)) return no('Please log in again.', 401);
		let b;
		try { b = JSON.parse((await request.text()) || '{}') || {}; } catch { return no('Invalid request.'); }
		const P = await this.who(u), g = P.guild ? await this.get(P.guild) : null;
		const now = Date.now();
		if (P.guild && !g) { P.guild = null; await this.player(u, P); }

		if (op === 'mine') {
			const invites = (await Promise.all(P.invites.map((id) => this.get(id)))).filter(Boolean).map(summary);
			return json({ guild: g ? await this.view(g) : null, invites });
		}
		if (op === 'find') {
			const tag = cleanTag(b.tag), id = TAG_RE.test(tag) ? await S.get('t:' + tag) : null;
			return json({ guild: summary(id ? await this.get(id) : null) || null });
		}
		if (op === 'list') {
			const all = await S.list({ prefix: 'g:', limit: 500 });
			return json({ guilds: [...all.values()].sort((a, c) => c.members.length + c.npcs.length - a.members.length - a.npcs.length).slice(0, 50).map(summary) });
		}
		if (op === 'found') {
			if (g) return no('You are in a guild already. Leave it to found another.', 409);
			const name = cleanName(b.name), tag = cleanTag(b.tag);
			if (!nameOk(name)) return no('A guild name is 3 to 24 letters, digits, spaces, \' . or -.');
			if (!TAG_RE.test(tag) || tag !== String(b.tag || '').trim().toUpperCase()) return no('A tag is 2 to 4 letters or digits.');
			if (await S.get('n:' + name.toLowerCase())) return no('A guild already has that name.', 409);
			if (await S.get('t:' + tag)) return no('A guild already has that tag.', 409);
			const ng = { id: newId(), name, tag, colours: cleanColours(b.colours), founded: now, members: [{ u, rank: 'leader', joined: now }], invites: [], allies: [], asks: [], offered: [], npcs: cleanNpcs(b.npcs) };
			await S.put({ ['g:' + ng.id]: ng, ['n:' + name.toLowerCase()]: ng.id, ['t:' + tag]: ng.id });
			P.guild = ng.id; P.invites = P.invites.filter((x) => x !== ng.id); await this.player(u, P);
			return json({ guild: await this.view(ng) });
		}
		if (op === 'join' || op === 'decline') {
			const t = await this.get(b.id);
			if (!t || !P.invites.includes(t.id)) { P.invites = P.invites.filter((x) => x !== b.id); await this.player(u, P); return no('That invitation is no longer open.', 404); }
			P.invites = P.invites.filter((x) => x !== t.id);
			t.invites = t.invites.filter((i) => i.u !== u);
			if (op === 'decline') { await this.put(t); await this.player(u, P); return json({ ok: true }); }
			if (g) return no('Leave your guild first.', 409);
			if (t.members.length >= PLAYERS_MAX) return no('That guild is full.', 409);
			t.members.push({ u, rank: 'member', joined: now });
			P.guild = t.id;
			await this.put(t); await this.player(u, P);
			return json({ guild: await this.view(t) });
		}
		// ---------- the rest: in a guild ----------
		if (!g) return no('You are not in a guild.', 404);
		const mine = rankOf(g, u);
		if (op === 'leave') {
			g.members = g.members.filter((m) => m.u !== u);
			P.guild = null; await this.player(u, P);
			if (!g.members.length) { await this.gone(g); return json({ ok: true, disbanded: true }); }
			if (mine === 'leader') { const next = g.members.find((m) => m.rank === 'officer') || g.members[0]; next.rank = 'leader'; }
			await this.put(g);
			return json({ ok: true });
		}
		if (op === 'edit') {
			if (!may(g, u)) return no('Only the leader and officers can change the guild.', 403);
			if (b.colours) g.colours = cleanColours(b.colours);
			if (b.npcs) g.npcs = cleanNpcs(b.npcs);
			await this.put(g);
			return json({ guild: await this.view(g) });
		}
		if (op === 'invite' || op === 'uninvite') {
			if (!may(g, u)) return no('Only the leader and officers can invite.', 403);
			const to = cleanUsername(b.to);
			if (!usernameOk(to)) return no('That is not a username.');
			const Q = await this.who(to);
			if (op === 'invite') {
				if (g.members.some((m) => m.u === to)) return no(`${to} is in the guild already.`, 409);
				if (g.invites.length >= INVITES_MAX) return no('Too many invitations waiting. Withdraw some first.', 409);
				if (!g.invites.some((i) => i.u === to)) g.invites.push({ u: to, by: u, at: now });
				if (!Q.invites.includes(g.id)) Q.invites = [...Q.invites, g.id].slice(-INVITES_MAX);
			} else { g.invites = g.invites.filter((i) => i.u !== to); Q.invites = Q.invites.filter((x) => x !== g.id); }
			await this.put(g); await this.player(to, Q);
			return json({ guild: await this.view(g) });
		}
		if (op === 'kick' || op === 'rank') {
			const who = cleanUsername(b.who), them = g.members.find((m) => m.u === who);
			if (!them || who === u) return no('They are not in the guild.', 404);
			if (op === 'kick') {
				if (!(mine === 'leader' || (mine === 'officer' && them.rank === 'member'))) return no('You cannot remove them.', 403);
				g.members = g.members.filter((m) => m !== them);
				const Q = await this.who(who); if (Q.guild === g.id) { Q.guild = null; await this.player(who, Q); }
			} else {
				if (mine !== 'leader' || !RANKS.includes(b.rank)) return no('Only the leader can change ranks.', 403);
				if (b.rank === 'leader') g.members.find((m) => m.u === u).rank = 'officer';
				them.rank = b.rank;
			}
			await this.put(g);
			return json({ guild: await this.view(g) });
		}
		if (op === 'ally') {
			if (!may(g, u)) return no('Only the leader and officers can make alliances.', 403);
			const tag = cleanTag(b.tag), id = TAG_RE.test(tag) ? await S.get('t:' + tag) : null, o = id && await this.get(id);
			if (!o) return no('No guild has that tag.', 404);
			if (o.id === g.id) return no('That is your own guild.');
			if (g.allies.includes(o.id)) return no(`You are allied with ${o.name} already.`, 409);
			if (g.allies.length >= ALLIES_MAX || o.allies.length >= ALLIES_MAX) return no(`A guild has at most ${ALLIES_MAX} allies.`, 409);
			g.offered ||= []; o.offered ||= [];
			if (g.asks.some((a) => a.from === o.id)) {
				// they offered first: allied
				g.asks = g.asks.filter((a) => a.from !== o.id); o.offered = o.offered.filter((x) => x !== g.id);
				g.allies.push(o.id); o.allies.push(g.id);
			} else {
				if (!g.offered.includes(o.id)) g.offered.push(o.id);
				if (!o.asks.some((a) => a.from === g.id)) o.asks = [...o.asks, { from: g.id, at: now }].slice(-INVITES_MAX);
			}
			await this.put(o); await this.put(g);
			return json({ guild: await this.view(g) });
		}
		if (op === 'unally') {
			if (!may(g, u)) return no('Only the leader and officers can end alliances.', 403);
			const o = await this.get(b.id);
			g.allies = g.allies.filter((x) => x !== b.id); g.asks = g.asks.filter((a) => a.from !== b.id); g.offered = (g.offered || []).filter((x) => x !== b.id);
			if (o) { o.allies = o.allies.filter((x) => x !== g.id); o.asks = o.asks.filter((a) => a.from !== g.id); o.offered = (o.offered || []).filter((x) => x !== g.id); await this.put(o); }
			await this.put(g);
			return json({ guild: await this.view(g) });
		}
		return no('Unknown action.');
	}
}
