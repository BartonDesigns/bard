// Chat's wire format, shared by the game (net/chat.js) and the rooms server's chat hub
// (server/multiplayer/src/chat.js). Three channels: everyone online (world), everyone in the
// same region of the world as you (region), and your group (group). A message is text or a
// short voice clip (push to talk). Groups are up to GROUP_MAX players: one leads, anyone can
// invite or ask to join, and the leader can share a room code so the group plays together.
//
// Everything a client sends is cleaned here on both sides, like net/protocol.js: only these
// fields, bounded, ever travel.

import { cleanName, cleanCode, ID_RE } from './protocol.js';
import { RANK_TOP, titleOf } from '../combat/honor.js';

export { titleOf };

// the server's /status word for all of this
export const CHAT_FEATURE = 'chat-v1';
export const CHANNELS = ['world', 'region', 'group'];
export const TEXT_MAX = 240;
// a voice clip: at most this long, this many base64 characters, in one of these formats
export const VOICE_MS = 15000, VOICE_B64_MAX = 96000;
export const VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/mpeg'];
// one chat message's size (a voice clip and its wrapper fit)
export const CHAT_MAX_BYTES = VOICE_B64_MAX + 1024;
// texts a second (and the burst over it); voice clips a minute
export const SAY_RATE = 1, SAY_BURST = 5, VOICE_PER_MIN = 8;
// how many of each channel's latest texts are kept for someone arriving
export const HISTORY_MAX = 40;
export const GROUP_MAX = 8;
// an invite or a request to join waits this long for an answer
export const INVITE_MS = 10 * 60 * 1000;
// a group none of whose players has been here for this long is forgotten
export const GROUP_IDLE_MS = 3 * 24 * 3600 * 1000;
export const GROUP_ID_RE = /^g[a-z0-9]{8,16}$/;

const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

export const cleanChannel = (c) => (CHANNELS.includes(c) ? c : '');
export const cleanText = (t) => str(t, TEXT_MAX);
export const cleanGroupName = (n) => str(n, 28).replace(/[<>]/g, '');
// a region: its id (people/npc-quests.js regionNow) and its name, as the player's game sees it
export function cleanRegion(r, n) {
	const id = typeof r === 'string' ? r.replace(/[^A-Za-z0-9:#._@ -]/g, '').slice(0, 64) : '';
	return id ? { id, name: str(n, 48) || id } : null;
}
export function cleanVoice(m) {
	if (!m || typeof m !== 'object') return null;
	const ch = cleanChannel(m.ch), mime = typeof m.mime === 'string' ? m.mime.toLowerCase().slice(0, 48) : '';
	if (!ch || !VOICE_TYPES.some((t) => mime === t || mime.startsWith(t + ';'))) return null;
	if (!/^[a-z0-9/;=,. -]+$/.test(mime)) return null;
	const ms = Math.round(+m.ms);
	if (!Number.isFinite(ms) || ms < 200 || ms > VOICE_MS + 500) return null;
	if (typeof m.data !== 'string' || m.data.length < 64 || m.data.length > VOICE_B64_MAX || !/^[A-Za-z0-9+/]+=*$/.test(m.data)) return null;
	return { ch, mime, ms, data: m.data };
}
// someone as everyone sees them: their id, their name, a three-digit number of their own (set
// beside the name when two of the same name meet), v when signed in (the name is their
// account's, checked by the server, so it cannot be borrowed) and k their honor's rank
export function cleanWho(w) {
	if (!w || typeof w !== 'object' || !ID_RE.test(w.id || '')) return null;
	const n = Math.floor(+w.n);
	const o = { id: w.id, name: cleanName(w.name), n: n >= 100 && n <= 999 ? n : 100 };
	if (w.v) o.v = 1;
	const k = Math.floor(+w.k);
	if (k > 0 && k <= RANK_TOP) o.k = k;
	return o;
}
// a group as its players see it
export function cleanGroup(g) {
	if (!g || typeof g !== 'object' || !GROUP_ID_RE.test(g.gid || '') || !Array.isArray(g.members)) return null;
	const members = g.members.slice(0, GROUP_MAX).map((m) => { const w = cleanWho(m); return w ? { ...w, on: !!m.on, ...(m.r ? { r: str(m.r, 48) } : {}) } : null; }).filter(Boolean);
	if (!members.length) return null;
	const leader = members.some((m) => m.id === g.leader) ? g.leader : members[0].id;
	return { gid: g.gid, name: cleanGroupName(g.name) || 'Group', leader, members, room: cleanCode(g.room) || '', asks: Array.isArray(g.asks) ? g.asks.slice(0, 16).map(cleanWho).filter(Boolean) : [] };
}
// one person, over tabs and devices: a signed-in player by their number, a guest by their id
export const personKey = (w) => (w?.v ? 'v' + w.n + ':' + w.name.toLowerCase() : w?.id || '');
// honor in a name: bold from Vanguard (combat/honor.js rank 3), gold dust at Exalted (the top)
export const BOLD_RANK = 3;
export const nameStyle = (w) => ((w?.k || 0) >= RANK_TOP ? 'exalted' : (w?.k || 0) >= BOLD_RANK ? 'bold' : '');
// the names to tell apart: those two or more different people share among `people`
export function clashes(people) {
	const by = new Map();
	for (const w of people) { if (!w?.name) continue; const k = w.name.toLowerCase(), S = by.get(k) || new Set(); S.add(personKey(w)); by.set(k, S); }
	return new Set([...by].filter(([, S]) => S.size > 1).map(([k]) => k));
}
// how a name reads: with its number when it clashes
export const whoLabel = (w, clash = null) => (w ? (clash?.has(w.name.toLowerCase()) ? `${w.name}#${w.n}` : w.name) : 'Someone');
