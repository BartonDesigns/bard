// Realtime conversation with the world's people, the parts that need no page: reading the
// discovery server's streamed reply (server/discovery/src/npc-talk.js), cutting it into
// sentences so the first can be spoken while the rest is still on its way, and the character
// sheet the server is sent. guide.js and guide-ask.js put these to work; talk-live.js draws it.

const TAG = /\[\[\s*(mood|gesture)\s*:\s*([a-z ]+)\]\]/gi;
export const MOODS = ['happy', 'calm', 'surprised', 'sad', 'annoyed', 'amused', 'thoughtful', 'afraid', 'angry', 'warm'];
// what an act asks of the people's own controller (people/social.js command)
export const SOCIAL_ACTS = Object.freeze({ follow: 'follow me', wait: 'wait here', home: 'go home', warn: 'warn the villagers', calm: 'calm the villagers', cancel: 'cancel your task', status: 'status' });
// acts after which the person has somewhere to be: the conversation closes once they have spoken
export const LEAVING_ACTS = new Set(['follow', 'home', 'scout', 'goodbye']);

const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n) : '');
const list = (v, n, f) => (Array.isArray(v) ? v : []).slice(0, n).map(f).filter(Boolean);

// the words to show and say, without the mood and gesture tags
export const plainLine = (text) => String(text || '').replace(TAG, '').replace(/\[\[[^\]]*\]?\]?$/, '').replace(/\s{2,}/g, ' ').trim();
// the mood a reply starts in, if it names one
export function moodOf(text) {
	TAG.lastIndex = 0;
	let m;
	while ((m = TAG.exec(String(text || '')))) if (m[1].toLowerCase() === 'mood' && MOODS.includes(m[2].trim().toLowerCase())) return m[2].trim().toLowerCase();
	return null;
}

// One JSON object per line from a fetch body: onLine for each, until the stream ends or the
// signal stops it. A line cut across two reads waits for the rest; a broken line is skipped.
export async function readLines(body, onLine, signal) {
	const reader = body.getReader(), dec = new TextDecoder();
	let buf = '';
	const stop = () => { try { reader.cancel(); } catch { /* already closed */ } };
	signal?.addEventListener('abort', stop, { once: true });
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			buf += dec.decode(value, { stream: true });
			let i;
			while ((i = buf.indexOf('\n')) >= 0) {
				const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
				if (!line) continue;
				let o;
				try { o = JSON.parse(line); } catch { continue; }
				onLine(o);
			}
		}
		const rest = buf.trim();
		if (rest) { try { onLine(JSON.parse(rest)); } catch { /* a broken tail */ } }
	} finally { signal?.removeEventListener('abort', stop); }
}

// Sentences as soon as they are finished: push(the plain text so far) calls onSentence for
// each new one; a long run with no full stop is let go at a comma so the voice never waits
// long; flush() says whatever is left.
export function createSentenceStream(onSentence, { long = 140 } = {}) {
	let at = 0, text = '';
	const emit = (s) => { const t = s.trim(); if (/[\p{L}\p{N}]/u.test(t)) onSentence(t); };
	function push(next) {
		text = String(next || '');
		if (text.length < at) at = 0;
		for (;;) {
			const rest = text.slice(at);
			const m = rest.match(/^[\s\S]*?[.!?…]+["'”’)\]]*(?=\s)/);
			if (m) { emit(m[0]); at += m[0].length; continue; }
			if (rest.length > long) {
				const c = rest.slice(0, long).lastIndexOf(', ');
				if (c > 40) { emit(rest.slice(0, c + 1)); at += c + 1; continue; }
			}
			return;
		}
	}
	return { push, flush() { emit(text.slice(at)); at = text.length; }, said: () => at };
}

// The character sheet as the server takes it (npc-talk.js sheetOf): cut to the same sizes here
// so nothing is lost to a request too big to send.
export function buildSheet(s = {}) {
	const can = s.can || {}, q = s.quests || {};
	return {
		name: str(s.name, 40), age: Math.max(5, Math.min(100, Math.round(+s.age) || 30)), job: str(s.job, 60), place: str(s.place, 80), region: str(s.region, 80), lang: str(s.lang, 40), temper: str(s.temper, 120),
		facts: list(s.facts, 12, (f) => str(f, 200)), places: list(s.places, 8, (f) => str(f, 60)),
		dialogueStyle: s.dialogueStyle || null,
		mood: MOODS.includes(s.mood) ? s.mood : 'calm',
		relationship: s.relationship ? { label: str(s.relationship.label, 60), trust: Math.max(-3, Math.min(3, Math.round(+s.relationship.trust) || 0)), last: str(s.relationship.last, 240) } : null,
		memories: list(s.memories, 8, (m) => str(typeof m === 'string' ? m : m?.content, 200)),
		player: s.player ? { name: str(s.player.name, 40), honor: str(s.player.honor, 40), guild: str(s.player.guild, 60) } : null,
		now: s.now ? { time: str(s.now.time, 40), weather: str(s.now.weather, 40), scene: str(s.now.scene, 160) } : null,
		task: s.task ? { type: str(s.task.type, 24), status: str(s.task.status, 24), label: str(s.task.label || s.task.title, 100) } : null,
		quests: {
			offered: q.offered ? { title: str(q.offered.title, 160) } : null,
			active: q.active ? { title: str(q.active.title, 160), step: str(q.active.step, 200), reportReady: q.active.reportReady === true } : null,
			done: list(q.done, 4, (d) => (d ? { title: str(d.title, 160), outcome: str(d.outcome, 40) } : null)),
		},
		can: {
			follow: can.follow === true, wait: can.wait === true, home: can.home === true, shop: can.shop === true, join: can.join === true,
			warn: can.warn === true, calm: can.calm === true, fight: can.fight === true, waypoint: can.waypoint === true,
			scout: list(can.scout, 12, (d) => (d && typeof d.id === 'string' && d.id.length <= 512 ? { id: d.id, name: str(d.name, 80) } : null)),
			quest: can.quest && typeof can.quest.bodyKey === 'string' ? {
				bodyKey: can.quest.bodyKey,
				targets: list(can.quest.targets, 16, (t) => (t?.id ? { id: t.id, name: str(t.name, 80), bodyKey: can.quest.bodyKey, scoutable: t.scoutable === true, fact: str(t.fact, 200) } : null)),
				npcs: list(can.quest.npcs, 12, (n) => (n?.id ? { id: n.id, name: str(n.name, 40), bodyKey: can.quest.bodyKey } : null)),
				arc: can.quest.arc ? { chapter: Math.max(1, Math.min(3, Number(can.quest.arc.chapter) || 1)), goal: str(can.quest.arc.goal, 240), previous: str(can.quest.arc.previous, 160), outcome: str(can.quest.arc.outcome, 40) } : null,
			} : null,
		},
	};
}
// the conversation so far, as the server takes it: people's words only, the last dozen
export const historyFor = (lines) => (Array.isArray(lines) ? lines : []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content).slice(-12).map((m) => ({ role: m.role, content: String(m.content).slice(0, 600) }));
