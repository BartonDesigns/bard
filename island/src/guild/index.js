// Your guild: founding one, the townsfolk you ask into it and who walk with you
// (guild/companions.js), the players and alliances kept for it on the rooms server
// (guild/guild-net.js), and its panel (guild/guild-ui.js). The rules: guild/guild-rules.js.
//
// The guild lives on this device (GUILD_KEY, so the cloud save carries it too). With an
// account on a server that keeps guilds, its name, tag, colours, players and alliances are the
// server's, and its townsfolk are reported there by name, calling and level for others to see.

import { isMinor } from '../combat/targets.js';
import { createCompanions } from './companions.js';
import { createGuildNet } from './guild-net.js';
import { createGuildPanel } from './guild-ui.js';
import { GUILD_KEY, COLOURS, NPC_MAX, REFUSE_MS, readGuild, newGuild, newMember, recruitOdds, npcSummary, giveXp } from './guild-rules.js';

const YES = ['I\'m in. Lead the way.', 'Count me in!', 'Honestly? I\'ve been waiting for someone to ask.', 'Alright. I\'ll watch your back.', 'Yes. When do we start?'];
const NO = ['Not today, sorry.', 'I don\'t really know you yet.', 'I\'ve got too much going on right now.', 'Maybe once I\'ve seen what you stand for.'];
const LAW = ['With the police after you? No thanks.', 'Not while the law is looking for you.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// combat, guide (guide/guide.js api), social (people/social.js, residents), nearby(): the people
// about you ([p] with p.P, p.M); cloud: createCloudSave's; url: the rooms server; onFoot(),
// yaw(): as companions.js; menu: the places menu; mount, hint, isPhone
export function createGuild({ combat, guide = null, social = null, nearby = () => [], cloud = null, url = '', mount, menu = null, onFoot, yaw, hint = () => {}, isPhone = false, storage = globalThis.localStorage }) {
	let g = null;
	try { g = readGuild(storage?.getItem(GUILD_KEY)); } catch { g = null; }
	const refused = new Map();
	let server = { known: false, deployed: true, invites: [], error: '' }, pushT = null;
	const net = createGuildNet({ url, auth: () => cloud?.credentials?.() || null });
	const listeners = new Set();
	const changed = () => { for (const f of listeners) f(); };
	function save() {
		try { if (g) storage.setItem(GUILD_KEY, JSON.stringify(g)); else storage.removeItem(GUILD_KEY); } catch { /* private mode */ }
		changed();
		// (its townsfolk, reported to the server a little after they change)
		if (g?.id && ['leader', 'officer'].includes(g.rank)) { clearTimeout(pushT); pushT = setTimeout(() => net.call('edit', { npcs: npcSummary(g) }).catch(() => {}), 4000); }
	}
	const companions = createCompanions({ combat, guild: () => g, save, onFoot, yaw, hint, isPhone });
	const signedIn = () => !!cloud?.credentials?.();

	// ---------- the server's side of it ----------
	// what the server says of your guild, laid over this device's (its townsfolk stay yours)
	function adopt(sg) {
		const npcs = g?.npcs || [];
		if (!sg) {
			// left, removed, or disbanded elsewhere: your townsfolk keep a guild of their own here
			if (g?.id) { g = { ...g, id: '', rank: 'leader', players: [], allies: [], asks: [], offered: [], invites: [] }; save(); }
			return;
		}
		g = { ...(g || {}), v: 1, id: sg.id, name: sg.name, tag: sg.tag, colours: sg.colours, founded: sg.founded, npcs, rank: sg.members.find((m) => m.me)?.rank || 'member', players: sg.members, allies: sg.allies, asks: sg.asks, offered: sg.offered, invites: sg.invites, others: sg.npcs };
		save();
	}
	async function sync() {
		if (!signedIn()) { server = { ...server, known: false, error: '' }; changed(); return; }
		try {
			const r = await net.mine();
			server = { known: true, deployed: true, invites: r.invites || [], error: '' };
			adopt(r.guild);
			// a guild founded on this device before the account: shared now
			if (!r.guild && g && !g.id) await share().catch(() => {});
		} catch (e) {
			server = { ...server, known: false, deployed: !e.notDeployed, error: e.notDeployed ? '' : e.message };
		}
		changed();
	}
	async function share() {
		if (!g || g.id) return;
		const r = await net.call('found', { name: g.name, tag: g.tag, colours: g.colours, npcs: npcSummary(g) });
		adopt(r.guild);
	}
	// one action on the server, then what it says of your guild now
	async function act(op, body = {}) {
		const r = await net.call(op, body);
		if (r.guild !== undefined && op !== 'find') adopt(r.guild);
		if (op === 'leave') adopt(null);
		if (op === 'join' || op === 'decline' || op === 'leave') await sync();
		else changed();
		return r;
	}

	// ---------- founding, and asking people in ----------
	async function found({ name, tag, colours }) {
		if (g) throw Error('You have a guild already.');
		g = newGuild({ name, tag, colours });
		save();
		if (signedIn()) {
			try { await share(); } catch (e) {
				// (the name or tag taken on the server: chosen again)
				if (e.status === 409 || e.status === 400) { g = null; save(); throw e; }
				if (!e.notDeployed) hint(e.message, 4000);
			}
		}
		hint(`You founded ${g.name} [${g.tag}]. Talk to people to ask them in.`, 4000);
		return g;
	}
	// the banner (0) or lettering (1) in another of the colours
	async function colour(i, c) {
		if (!g || !COLOURS.includes(c)) return;
		g.colours = i ? [g.colours[0], c] : [c, g.colours[1]];
		save();
		if (g.id) await act('edit', { colours: g.colours });
	}
	function disband() {
		for (const m of g?.npcs || []) home(m);
		companions.hold(false);
		g = null; save();
	}
	const personaOf = (p) => p?.persona || guide?.personaOf?.(p) || null;
	const residentOf = (p) => (p?.residentId ? social?.state?.get?.(p.residentId) : null);
	// a resident who joined you goes with you (people/social-state.js mode 'guild'); back home when they leave
	function home(m) { if (m.residentId) social?.state?.setMode?.(m.residentId, 'home'); }
	// whether they will join, and if they do, them out at your side where they stood
	function ask(p) {
		const who = personaOf(p);
		if (!p?.P || !who) return { ok: false, text: 'There is nobody to ask.' };
		const first = who.first || who.name?.split(' ')[0] || 'They';
		if (isMinor(p.P)) return { ok: false, text: `${first} is too young to join a guild.` };
		if (!g) return { ok: false, needGuild: true, text: 'Found a guild first (⚑ Your guild, in the map pin menu).' };
		if (g.npcs.length >= NPC_MAX) return { ok: false, text: `Your guild has room for ${NPC_MAX} townsfolk.` };
		const seed = p.P.dna?.seed >>> 0;
		if (g.npcs.some((m) => m.seed === seed)) return { ok: false, text: `${first} is in your guild already.` };
		if (refused.get(seed) > Date.now()) return { ok: false, text: `${first}: "I said not today."` };
		const wanted = combat.wantedLevel?.() || 0, trust = guide?.relationshipFor?.(p)?.trust ?? 0;
		const odds = recruitOdds({ honorRank: combat.hooks.honorRank?.() ?? 0, trust, wanted, members: g.npcs.length, afraid: !!p.afraid });
		if (Math.random() >= odds) {
			refused.set(seed, Date.now() + REFUSE_MS);
			p.M?.gesture?.('shake');
			return { ok: false, text: `${first}: "${pick(wanted > 0 ? LAW : NO)}"` };
		}
		const m = newMember({ name: who.name || first, first, seed, dna: JSON.parse(JSON.stringify(p.P.dna)), job: who.job || p.P.job || '' });
		const R = residentOf(p);
		if (R) { m.residentId = R.id; social.state.setMode(R.id, 'guild'); }
		g.npcs.push(m);
		save();
		// (they leave the street as themselves, and come out at your side as one of yours)
		const q = p.M?.S?.pos, at = q ? { x: q.x, z: q.z, yaw: p.M.S.heading } : null;
		p.M?.gesture?.('nod');
		if (p.P.root) p.P.root.visible = false;
		p.leaving = true; p.leaveT = 99; p.fade = 0;
		companions.joinAt(m, at);
		return { ok: true, member: m, text: `${first}: "${pick(YES)}" ${first} joins ${g.name} as a ${m.role}.` };
	}
	function dismiss(id) {
		const i = g?.npcs.findIndex((m) => m.id === id) ?? -1;
		if (i < 0) return;
		const [m] = g.npcs.splice(i, 1);
		companions.dismiss(id); home(m); save();
	}
	function setFollow(id, on) {
		const m = g?.npcs.find((x) => x.id === id);
		if (!m) return;
		m.follow = !!on;
		// (no more than walk with you at once: the longest at rest makes way)
		const out = g.npcs.filter((x) => x.follow);
		if (on && companions.max && out.length > companions.max) { const k = out.find((x) => x !== m); if (k) k.follow = false; }
		save();
	}
	// the people near you who could be asked: grown, awake, not already yours
	function candidates() {
		const e = combat.eye(), seen = new Set(), out = [];
		for (const p of nearby()) {
			const q = p?.M?.S?.pos;
			if (!p?.P || !q || p.P.ragdoll || p.leaving || p.active === false || !p.P.root?.visible || isMinor(p.P)) continue;
			const d = Math.hypot(q.x - e.x, q.z - e.z), seed = p.P.dna?.seed >>> 0;
			if (d > 22 || seen.has(seed) || g?.npcs.some((m) => m.seed === seed)) continue;
			seen.add(seed);
			const who = personaOf(p);
			if (who) out.push({ p, d, name: who.name, job: who.job || '' });
		}
		return out.sort((a, b) => a.d - b.d).slice(0, 6);
	}

	const panel = createGuildPanel({ mount, menu, hint, isPhone, api: null });
	const api = {
		get: () => g, server: () => server, signedIn, found, colour, disband, ask, dismiss, setFollow, candidates, act, sync, share, companions,
		subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
		hold: (on) => { companions.hold(on); changed(); },
		open: (tab) => panel.open(tab),
		update: (dt) => companions.update(dt),
		// the talk panel's offer (guide/guide-ask.js): asking the one you talk with
		talkOffer(p) {
			if (!p?.P || isMinor(p.P) || g?.npcs.some((m) => m.seed === (p.P.dna?.seed >>> 0))) return null;
			return { label: g ? `⚑ Ask to join ${g.name}` : '⚑ Ask to join your guild', line: g ? `Would you join ${g.name}?` : 'Would you join my guild?', run: () => { const r = ask(p); if (r.needGuild) panel.open('guild'); return r; } };
		},
		// for the tests: a member made up as if asked ({ name, job, seed }), and experience given
		test: {
			add(spec = {}) { if (!g) return null; const m = newMember({ name: spec.name || 'Test Person', seed: spec.seed ?? (Math.random() * 1e9) >>> 0, job: spec.job || '' }); g.npcs.push(m); save(); return m.id; },
			xp(id, n) { const m = g?.npcs.find((x) => x.id === id); if (!m) return null; const r = giveXp(m, n); save(); return { level: m.level, learned: r.learned }; },
		},
		// for the tests: Crysis.guild
		info: () => ({ guild: g && { name: g.name, tag: g.tag, id: g.id, rank: g.rank, npcs: g.npcs.map((m) => ({ id: m.id, name: m.name, role: m.role, level: m.level, xp: m.xp, spells: m.spells, follow: m.follow, down: m.downUntil > Date.now() })) }, out: companions.present(), server }),
		dispose() { clearTimeout(pushT); companions.dispose(); panel.dispose(); listeners.clear(); },
	};
	panel.bind(api);
	sync();
	return api;
}
