// Talking with the townsfolk: a person's few lines, made on Workers AI inside the free daily
// allowance, from who they are and what has been said. The player's game sends only the
// person (a name, an age, a job, the place, a handful of short facts) and the last few lines;
// the instructions they speak by are written here, so this can only ever be one of the game's
// people talking, never a general-purpose model.
//
//   POST /talk   { npc: { name, age, job, place, region, lang, temper, facts: [] },
//                  history: [{ role: 'user' | 'assistant', content }] }
//             -> { reply, neurons } or 429 / 503 (the game then answers with its own lines)

const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n) : '');

// the person as the game describes them, cut to size and to plain words
export function npcOf(body) {
	const n = body?.npc;
	if (!n || typeof n !== 'object') return { error: 'no npc' };
	const npc = {
		name: str(n.name, 40), age: Math.max(5, Math.min(100, Math.round(+n.age) || 30)), job: str(n.job, 60),
		place: str(n.place, 80), region: str(n.region, 80), lang: str(n.lang, 40), temper: str(n.temper, 80),
		facts: (Array.isArray(n.facts) ? n.facts : []).slice(0, 10).map((f) => str(f, 160)).filter(Boolean),
		// places they may send the player to (the game's quest tag only takes these)
		places: (Array.isArray(n.places) ? n.places : []).slice(0, 6).map((f) => str(f, 60)).filter(Boolean),
	};
	if (!npc.name) return { error: 'no name' };
	const history = (Array.isArray(body.history) ? body.history : []).slice(-8)
		.filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
		.map((m) => ({ role: m.role, content: str(m.content, 400) })).filter((m) => m.content);
	if (!history.length || history[history.length - 1].role !== 'user') return { error: 'nothing said' };
	return { npc, history };
}

// the instructions: who they are, how to speak, and what never to do
export function talkSystem(npc) {
	const who = `${npc.name}, ${npc.age}${npc.job ? ', ' + npc.job : ''}${npc.place ? ', in ' + npc.place : ''}${npc.region ? ' (' + npc.region + ')' : ''}`;
	return [
		`You are ${who}: a person in the world of a music-and-exploration game, talking face to face with a traveller who has stopped to chat.`,
		npc.temper ? `Your manner: ${npc.temper}.` : '',
		npc.lang ? `You may greet in ${npc.lang} now and then, always making the meaning clear.` : '',
		npc.facts.length ? 'What you know and care about:\n- ' + npc.facts.join('\n- ') : '',
		'Speak as yourself, warmly and plainly, in one to three short sentences. Talk about your life, your work, the place, its weather, food, landmarks and stories, and the road onward.',
		'Never say you are an AI or a character. Keep to what this person would know.',
		'Your words do not execute actions. Only describe a task as accepted, underway or complete when the supplied game facts explicitly say so. Do not invent movement, deliveries, warnings, quest progress, rewards or world changes; unsupported requests receive an honest in-character explanation.',
		'Never give instructions for weapons, drugs or anything that could hurt someone; nothing sexual; nothing about harming children. Do not mock any culture, faith or people, and do not put on an accent.',
		'If asked for something you would not do, say no kindly, in character, and change the subject.',
		'Start every reply with your mood in double brackets, one of: happy, calm, surprised, sad, annoyed, amused, thoughtful; you may add one gesture: wave, nod, shake, shrug, point, laugh, think, open, explain, emphatic, bow. Example: [[mood: amused]] [[gesture: laugh]] Ha, not today.',
		npc.places.length ? `If they ask where to go, you can send them to one of these, by adding [[quest: PLACE]] with its exact name: ${npc.places.join('; ')}.` : '',
	].filter(Boolean).join('\n');
}
