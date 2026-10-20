// Guilds and alliances, and the townsfolk you bring into yours, as game rules. Pure: no three,
// no DOM (island/tools/guild.test.mjs checks it all; the rooms server's guild record,
// server/multiplayer/src/guild.js, cleans its fields with the same helpers).
//
// A guild has a name, a short tag (shown in brackets beside its people's names) and two
// colours. You found one on your own; with an account (persistence/cloud-save.js) it is kept
// on the rooms server, where other players can be invited into it and other guilds can ally
// with it. Its people are players and townsfolk alike: anyone grown up you get to know can be
// asked to join (people talked to, guide/guide-ask.js, or anyone near you from the guild
// panel). Whether they say yes rests on your honor, how well they know you and whether the
// law is after you. Children and teenagers are never asked.
//
// A townsperson in your guild fights beside you (guild/companions.js puts them in the world
// as fighters on your side: combat/ai-squads.js). They have a calling (a warrior with a rifle,
// a mage who fights with spells, a healer who keeps you standing) and a strand of the aether.
// What they fight teaches them: they level up from 1 to 30, tougher, harder hitting and surer
// of their aim each level, and learn the spells of their calling's path as they go. Struck
// down, they are carried off and rest a while before they can come out again: never lost.

export const GUILD_FEATURE = 'guilds-v1';
export const GUILD_KEY = 'l99-guild-v1';
export const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 '.-]{1,22}[A-Za-z0-9.]$/;
export const TAG_RE = /^[A-Z0-9]{2,4}$/;
export const ID_RE = /^g[a-z0-9]{6,20}$/;
// the colours a guild may wear (its banner, its tag)
export const COLOURS = Object.freeze(['#01a982', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#e8e0cc', '#c8733a', '#2fb5a8', '#d9c46a', '#ec4899', '#6b7280']);
// how many townsfolk a guild keeps, and how many walk with you at once
export const NPC_MAX = 12;
// (on a phone they share the fighter cap: combat/ai-squads.js spawn)
export const FOLLOW_MAX = Object.freeze({ desktop: 3, phone: 2 });
// players in a guild, guilds in an alliance with one guild, invites waiting
export const PLAYERS_MAX = 50, ALLIES_MAX = 5, INVITES_MAX = 20;
// a townsperson struck down rests this long before they can be called again
export const REST_MS = 2 * 60 * 1000;
// asked and refused: not asked again for a while
export const REFUSE_MS = 10 * 60 * 1000;
export const LEVEL_MAX = 30;
export const RANKS = Object.freeze(['leader', 'officer', 'member']);

export const ROLES = Object.freeze({
	warrior: { name: 'Warrior', glyph: '⚔', line: 'Rifle first, a spell when it counts. Holds the line beside you.', gun: 'mossback-scout-rifle', hp: 1.2, castGap: 7 },
	mage: { name: 'Mage', glyph: '✦', line: 'Fights with spells alone, and learns them fastest.', gun: null, hp: 0.9, castGap: 2.4 },
	healer: { name: 'Healer', glyph: '✚', line: 'Keeps you standing: mends your wounds in a fight, and fights with a carbine.', gun: 'warden-spark-carbine', hp: 1, castGap: 4 },
});
// each calling's path through the spells: at which level each is learned
export const PATHS = Object.freeze({
	warrior: {
		light: [[3, 'sunspark'], [7, 'mend'], [12, 'lance-of-dawn'], [18, 'thunderclap'], [25, 'judgement']],
		dark: [[3, 'shadowbolt'], [7, 'hex-of-decay'], [12, 'repulse'], [18, 'chain-lightning'], [25, 'eclipse']],
	},
	mage: {
		light: [[1, 'sunspark'], [4, 'lance-of-dawn'], [8, 'chain-lightning'], [13, 'solar-flare'], [20, 'judgement']],
		dark: [[1, 'shadowbolt'], [4, 'void-shard'], [8, 'chain-lightning'], [13, 'gravity-well'], [20, 'eclipse']],
	},
	healer: {
		light: [[1, 'mend'], [4, 'sunspark'], [8, 'renewal'], [13, 'frost-nova'], [20, 'sanctuary']],
		dark: [[1, 'mend'], [4, 'shadowbolt'], [8, 'renewal'], [13, 'frost-nova'], [20, 'sanctuary']],
	},
});
// how a townsperson's spell works in their hands (guild/companions.js): at their target, at
// the target and those about it, chained through a few, round themselves, or mending
export const SPELL_ACTS = Object.freeze({
	sunspark: { act: 'bolt', dmg: 22, cd: 1.2 }, shadowbolt: { act: 'bolt', dmg: 26, cd: 1.4 }, 'void-shard': { act: 'bolt', dmg: 30, cd: 1.6 },
	'hex-of-decay': { act: 'bolt', dmg: 28, cd: 3 }, 'lance-of-dawn': { act: 'strike', dmg: 38, r: 2.6, cd: 5 }, 'solar-flare': { act: 'strike', dmg: 70, r: 5, cd: 10 },
	judgement: { act: 'strike', dmg: 150, r: 6, cd: 30 }, eclipse: { act: 'strike', dmg: 120, r: 7, cd: 35 }, 'gravity-well': { act: 'strike', dmg: 80, r: 8, cd: 22 },
	'chain-lightning': { act: 'chain', dmg: 40, n: 3, cd: 8 }, thunderclap: { act: 'nova', dmg: 35, r: 7, cd: 12 }, repulse: { act: 'nova', dmg: 20, r: 6, cd: 10 },
	'frost-nova': { act: 'nova', dmg: 30, r: 7, cd: 14 }, mend: { act: 'heal', heal: 30, cd: 8 }, renewal: { act: 'heal', heal: 60, cd: 16 }, sanctuary: { act: 'heal', heal: 90, cd: 40, all: true },
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- names, tags, colours ----------
export const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const nameOk = (s) => NAME_RE.test(cleanName(s));
export const cleanTag = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
export const cleanColours = (c) => { const L = Array.isArray(c) ? c.filter((x) => COLOURS.includes(x)) : []; return [L[0] || COLOURS[0], L[1] || COLOURS[6]]; };
// a tag from a name: the first letters of its words (or its first three)
export function tagFrom(name) {
	const w = cleanName(name).split(' ').map((x) => x.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean);
	const t = w.length > 1 ? w.map((x) => x[0]).join('') : (w[0] || '');
	return cleanTag(t.length >= 2 ? t : (w[0] || 'GLD')).slice(0, w.length > 1 ? 4 : 3) || 'GLD';
}

// ---------- levels ----------
// experience from one level to the next
export const xpToNext = (L) => (L >= LEVEL_MAX ? Infinity : Math.round(60 * Math.pow(L, 1.5)));
// a townsperson's numbers at their level, in their calling
export function statsFor(m) {
	const L = clamp(Math.floor(m?.level || 1), 1, LEVEL_MAX), R = ROLES[m?.role] || ROLES.warrior;
	return {
		level: L,
		hpK: R.hp * (1 + 0.06 * (L - 1)),
		dmgK: 1 + 0.05 * (L - 1),
		acc: Math.min(0.72, 0.4 + 0.011 * (L - 1)),
		armour: 10 + 2 * (L - 1),
		// (spells are cast harder as they grow: half at first, full strength by 13, more after)
		spellK: 0.5 + 0.04 * (L - 1),
		castGap: R.castGap * (1 - 0.01 * (L - 1)),
	};
}
// the spells a townsperson knows at their level
export const spellsAt = (role, strand, L) => (PATHS[role]?.[strand] || PATHS.warrior.light).filter(([l]) => l <= L).map(([, id]) => id);
// the next spell on their path: { level, id } or null
export function nextSpell(m) {
	const p = (PATHS[m?.role]?.[m?.strand] || []).find(([l]) => l > (m?.level || 1));
	return p ? { level: p[0], id: p[1] } : null;
}
// experience earned: { levels: how many gained, learned: [spell ids] }; m is changed
export function giveXp(m, n) {
	const out = { levels: 0, learned: [] };
	if (!m || !(n > 0) || m.level >= LEVEL_MAX) return out;
	m.xp = (m.xp || 0) + Math.round(n);
	while (m.level < LEVEL_MAX && m.xp >= xpToNext(m.level)) { m.xp -= xpToNext(m.level); m.level++; out.levels++; }
	if (m.level >= LEVEL_MAX) m.xp = 0;
	const known = new Set(m.spells || []);
	m.spells = spellsAt(m.role, m.strand, m.level);
	out.learned = m.spells.filter((s) => !known.has(s));
	return out;
}
// what a fallen foe teaches: by how much life it had, and what it was
export function xpForKill({ max = 100, kind = 'person' } = {}) {
	const k = kind === 'creature' ? 1.5 : kind === 'drone' ? 0.8 : 1;
	return Math.round((10 + clamp(max, 0, 2000) * 0.25) * k);
}
// those walking with you when you fell a foe learn a share of it
export const SHARE = 0.4;

// ---------- asking someone to join ----------
// the calling a townsperson takes, from what they do for a living (or, failing that, by lot)
const CALLING = [
	[/nurse|doctor|medic|paramedic|pharmac|therap|vet\b|veterinar|caregiver|midwife|dentist/i, 'healer'],
	[/professor|teacher|student|librar|scien|research|engineer|programmer|developer|artist|musician|writer|poet|astronom|geolog|chemist|physic/i, 'mage'],
	[/firefight|police|guard|security|soldier|veteran|marine|army|construction|carpenter|welder|ranger|trainer|coach|boxer|mechanic|labor|crew|roofer|plumber|electrician/i, 'warrior'],
];
export function callingFor(job, seed = 1) {
	for (const [re, role] of CALLING) if (re.test(job || '')) return role;
	const u = (hash(String(seed)) % 1000) / 1000;
	return u < 0.45 ? 'warrior' : u < 0.75 ? 'mage' : 'healer';
}
export const strandFor = (role, seed = 1) => (role === 'healer' ? 'light' : hash('s' + seed) % 2 ? 'dark' : 'light');
// the chance they say yes: honorRank 0..9 (combat/honor.js), trust in you (-5..10, the
// people they remember, guide/), the law's stars on you, a fight about, their age
export function recruitOdds({ honorRank = 0, trust = 0, wanted = 0, minor = false, afraid = false, members = 0 } = {}) {
	if (minor || members >= NPC_MAX) return 0;
	const p = 0.45 + clamp(honorRank, 0, 9) * 0.04 + clamp(trust, -5, 10) * 0.06 - clamp(wanted, 0, 5) * 0.12 - (afraid ? 0.3 : 0);
	return clamp(p, 0.05, 0.95);
}
// a new member from the person asked: { name, first, seed, dna, job }
export function newMember({ name, first, seed, dna = null, job = '' }, now = Date.now()) {
	const role = callingFor(job, seed), strand = strandFor(role, seed);
	return { id: 'n' + (seed >>> 0).toString(36) + (now % 46656).toString(36), name: cleanName(name).slice(0, 40) || 'A friend', first: cleanName(first || name).split(' ')[0].slice(0, 20) || 'Friend', seed: seed >>> 0, dna, job: String(job || '').slice(0, 80), role, strand, level: 1, xp: 0, spells: spellsAt(role, strand, 1), kills: 0, joined: now, downUntil: 0, follow: true };
}

// ---------- your guild, as this device keeps it ----------
export function newGuild({ name, tag, colours }, now = Date.now()) {
	if (!nameOk(name)) throw Error('A guild name is 3 to 24 letters, digits, spaces, \' . or -.');
	const t = cleanTag(tag || tagFrom(name));
	if (!TAG_RE.test(t)) throw Error('A tag is 2 to 4 letters or digits.');
	return { v: 1, id: '', name: cleanName(name), tag: t, colours: cleanColours(colours), founded: now, rank: 'leader', npcs: [], allies: [], players: [] };
}
// a saved guild read back, cleaned (anything odd dropped rather than trusted)
export function readGuild(raw) {
	let g;
	try { g = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
	if (!g || typeof g !== 'object' || !nameOk(g.name) || !TAG_RE.test(g.tag || '')) return null;
	const npcs = (Array.isArray(g.npcs) ? g.npcs : []).filter((m) => m && typeof m.id === 'string' && ROLES[m.role]).slice(0, NPC_MAX).map((m) => {
		const level = clamp(Math.floor(+m.level || 1), 1, LEVEL_MAX), strand = m.strand === 'dark' ? 'dark' : 'light';
		return { ...m, level, strand, xp: Math.max(0, +m.xp || 0), kills: Math.max(0, Math.floor(+m.kills || 0)), spells: spellsAt(m.role, strand, level), downUntil: +m.downUntil || 0, follow: m.follow !== false };
	});
	return { v: 1, id: ID_RE.test(g.id || '') ? g.id : '', name: cleanName(g.name), tag: g.tag, colours: cleanColours(g.colours), founded: +g.founded || 0, rank: RANKS.includes(g.rank) ? g.rank : 'leader', npcs, allies: Array.isArray(g.allies) ? g.allies.slice(0, ALLIES_MAX) : [], players: Array.isArray(g.players) ? g.players.slice(0, PLAYERS_MAX) : [] };
}
// who walks with you now: those set to follow and not resting, up to the most at once
export function followers(g, now = Date.now(), max = FOLLOW_MAX.desktop) {
	return (g?.npcs || []).filter((m) => m.follow && !(m.downUntil > now)).slice(0, max);
}
// what others see of your townsfolk (the server's record keeps only this)
export const npcSummary = (g) => (g?.npcs || []).map((m) => ({ name: m.name.slice(0, 40), role: m.role, level: m.level }));
// a guild's line, in a few words, for a card: "12 members · 3 allies"
export function guildLine(g) {
	const n = (g?.players?.length || 1) + (g?.npcs?.length || 0), a = g?.allies?.length || 0;
	return `${n} member${n === 1 ? '' : 's'}${a ? ` · ${a} all${a === 1 ? 'y' : 'ies'}` : ''}`;
}
