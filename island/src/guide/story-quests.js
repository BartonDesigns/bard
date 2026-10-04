// The model writes a proposal. Only observed game events can advance its objectives.
// Persistence is independent of scene objects and of the legacy exploration journal.
export const STORY_QUEST_KEY = 'crysis-story-quests-v1';
const TYPES = new Set(['visit', 'return', 'talk', 'scout']);
const PHASES = new Set(['offered', 'active', 'complete', 'cancelled']);
const copy = value => JSON.parse(JSON.stringify(value));
const label = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const identifier = value => typeof value === 'string' && value.trim() && value.length <= 512 ? value : '';
const finitePosition = p => p && [p.x, p.y, p.z].every(Number.isFinite);
const signature = q => JSON.stringify([q.bodyKey, q.steps.map(s => [s.type, s.targetId || '', s.npcId || ''])]);
const hash = text => { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(36); };
const fail = error => ({ ok: false, error });

export function questContext(input = {}) {
	let { bodyKey, targets = [], npcs = [], speaker } = input || {};
	bodyKey = identifier(bodyKey);
	targets = Array.isArray(targets) ? targets : []; npcs = Array.isArray(npcs) ? npcs : [];
	const seen = new Set();
	const places = targets.filter(t => t && identifier(t.id) && label(t.name) && finitePosition(t) && (!t.bodyKey || t.bodyKey === bodyKey) && t.available !== false && !seen.has(t.id) && seen.add(t.id)).slice(0, 40).map(t => ({ id: identifier(t.id), name: label(t.name), bodyKey, x: t.x, y: t.y, z: t.z, radius: Math.max(3, Math.min(40, Number(t.radius) || 18)), under: !!t.under, scoutable: t.scoutable === true, fact: label(t.fact, 240) }));
	seen.clear();
	const residents = npcs.filter(n => n && identifier(n.id) && label(n.name) && (!n.bodyKey || n.bodyKey === bodyKey) && !seen.has(n.id) && seen.add(n.id)).slice(0, 32).map(n => ({ id: identifier(n.id), name: label(n.name), bodyKey }));
	return { bodyKey, targets: places, npcs: residents, speaker: residents.some(n => n.id === speaker) ? speaker : null };
}

export function questPrompt(context) {
	return `You propose one short, engaging quest inside a playable world. Return ONLY JSON: {"title":"...","premise":"...","steps":[{"type":"visit","targetId":"exact supplied ID"},{"type":"talk","npcId":"exact supplied ID"}]}. Use 2–4 ordered steps, including at least one visit, return, or scout before any final conversation. Supported types: visit or return (targetId), talk (npcId), scout (targetId AND npcId, only a target with scoutable:true). Use supplied IDs only, on this body. A scout objective requires asking that actual NPC to scout the actual place and waiting for a completed report; never invent an automatic dispatch. Prefer a short local story with an intriguing question, an observation at a real place, then a conversation with a real resident. Draw stakes from supplied facts or the resident's stated curiosity, not invented disasters. Vary the route and purpose from previous quests. The player must explicitly accept. No combat, items, deliveries, rewards, unlocks, fabricated discoveries, new NPCs, or claims of world changes. The premise is a motivation, not an assertion that objectives happened. Only game evidence completes steps. Do not include extra fields. Context: ${JSON.stringify(context)}`;
}

export function validateQuestPlan(raw, supplied) {
	const ctx = questContext(supplied);
	let plan = raw;
	if (typeof raw === 'string') {
		if (raw.length > 6000) return fail('The quest proposal is too long.');
		try { plan = JSON.parse(raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')); } catch { return fail('The quest proposal was not valid JSON.'); }
	}
	if (!plan || typeof plan !== 'object' || Array.isArray(plan) || !ctx.bodyKey) return fail('Missing quest or world.');
	if (Object.keys(plan).some(k => !['title', 'premise', 'steps'].includes(k))) return fail('The quest requests unsupported effects.');
	if (!label(plan.title) || !label(plan.premise, 500) || !Array.isArray(plan.steps) || plan.steps.length < 2 || plan.steps.length > 4) return fail('A quest needs a title, purpose, and two to four steps.');
	if (/\b(?:kill|slay|defeat|fight|attack|rescue|escort|deliver|retrieve|steal|craft|buy|sell|unlock|reward|rewards|coins|gold pieces|experience points)\b/i.test(`${plan.title} ${plan.premise}`)) return fail('The quest promises an unsupported activity or reward.');
	const steps = [];
	for (const step of plan.steps) {
		if (!step || !TYPES.has(step.type) || Object.keys(step).some(k => !['type', 'targetId', 'npcId'].includes(k))) return fail('Unsupported quest objective.');
		const target = ctx.targets.find(t => t.id === step.targetId), npc = ctx.npcs.find(n => n.id === step.npcId);
		if (['visit', 'return', 'scout'].includes(step.type) && !target) return fail('The quest names an unavailable place.');
		if (['talk', 'scout'].includes(step.type) && !npc) return fail('The quest names an unavailable resident.');
		if (step.type === 'scout' && !target.scoutable) return fail('That place cannot be scouted by a resident.');
		if (step.type === 'talk' && step.targetId || ['visit', 'return'].includes(step.type) && step.npcId) return fail('Ambiguous quest objective.');
		const clean = { type: step.type };
		if (target) { clean.targetId = target.id; clean.targetName = target.name; }
		if (npc) { clean.npcId = npc.id; clean.npcName = npc.name; }
		if (steps.some(s => JSON.stringify(s) === JSON.stringify(clean))) return fail('The quest repeats an objective.');
		const prev = steps.at(-1);
		if (prev && ['visit', 'return'].includes(prev.type) && ['visit', 'return'].includes(clean.type) && prev.targetId === clean.targetId) return fail('The route repeats the same stop without another objective.');
		steps.push(clean);
	}
	if (!steps.some(step => ['visit', 'return', 'scout'].includes(step.type))) return fail('A quest needs a real exploration or scouting objective.');
	return { ok: true, plan: { title: label(plan.title), premise: label(plan.premise, 500), bodyKey: ctx.bodyKey, steps } };
}

function validSave(data) {
	if (!data || data.version !== 1 || !Array.isArray(data.quests) || data.quests.length > 24 || !Array.isArray(data.seen) || data.seen.length > 256 || data.seen.some(s => typeof s !== 'string' || s.length > 10000) || !Number.isSafeInteger(data.sequence) || data.sequence < 0) return false;
	const ids = new Set();
	return data.quests.every(q => {
		if (!q || !identifier(q.id) || ids.has(q.id) || !identifier(q.bodyKey) || !label(q.title) || !label(q.premise) || !PHASES.has(q.status) || !Number.isFinite(q.offeredAt) || !Array.isArray(q.steps) || q.steps.length < 2 || q.steps.length > 4 || !Number.isInteger(q.cursor) || q.cursor < 0 || q.cursor > q.steps.length) return false;
		ids.add(q.id);
		if (q.offeredBy !== undefined && q.offeredBy !== null && !identifier(q.offeredBy)) return false;
		if (q.status === 'active' && (q.cursor >= q.steps.length || !Number.isFinite(q.acceptedAt)) || q.status === 'offered' && (q.cursor !== 0 || q.acceptedAt !== null) || q.status === 'complete' && (q.cursor !== q.steps.length || !Number.isFinite(q.finishedAt) || !Number.isFinite(q.acceptedAt))) return false;
		if (!Array.isArray(q.evidence) || q.evidence.length > 16 || q.evidence.some(e => !e || typeof e !== 'object' || !['presence', 'talk', 'scout'].includes(e.type) || !Number.isFinite(e.at))) return false;
		return q.steps.every((s, index) => s && TYPES.has(s.type) && (!['visit', 'return', 'scout'].includes(s.type) || identifier(s.targetId)) && (!['talk', 'scout'].includes(s.type) || identifier(s.npcId)) && (index >= q.cursor || Number.isFinite(s.completedAt)));
	});
}

export function createStoryQuests({ storage, now = Date.now } = {}) {
	if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
	let data = { version: 1, quests: [], seen: [], sequence: 0 }, error = null, blocked = false;
	try {
		const raw = storage?.getItem(STORY_QUEST_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (raw.length > 2000000 || !validSave(parsed)) throw Error('Invalid quest save');
			data = parsed;
		}
	} catch { error = 'Saved quest data could not be read; it has been preserved.'; blocked = true; }
	function save() {
		if (blocked) return false;
		try { if (!storage) throw Error('No storage'); storage.setItem(STORY_QUEST_KEY, JSON.stringify(data)); error = null; return true; }
		catch { error = 'Quest progress is available this session, but this browser could not save it.'; return false; }
	}
	function list(bodyKey) { return copy(data.quests.filter(q => !bodyKey || q.bodyKey === bodyKey)); }
	function context(input) { return { ...questContext(input), previous: list(input?.bodyKey).map(q => ({ title: q.title, status: q.status, steps: q.steps })) }; }
	function propose(raw, input) {
		const validated = validateQuestPlan(raw, input);
		if (!validated.ok) return validated;
		const plan = validated.plan, fingerprint = signature(plan);
		if (data.seen.includes(fingerprint) || data.quests.some(q => signature(q) === fingerprint)) return fail('That route is already in your journal. Ask for a different adventure.');
		if (data.quests.filter(q => q.status === 'offered').length >= 3) return fail('Accept or decline an existing quest before adding another offer.');
		if (data.quests.length >= 24) {
			const index = data.quests.findIndex(q => q.status === 'complete' || q.status === 'cancelled');
			if (index < 0) return fail('Your quest journal is full.');
			data.quests.splice(index, 1);
		}
		const offeredBy = questContext(input).speaker;
		const quest = { ...plan, offeredBy, id: `story-${hash(fingerprint)}-${++data.sequence}`, status: 'offered', cursor: 0, offeredAt: now(), acceptedAt: null, finishedAt: null, evidence: [] };
		data.quests.push(quest); data.seen.push(fingerprint); data.seen = data.seen.slice(-256); save();
		return { ok: true, quest: copy(quest) };
	}
	function change(id, bodyKey, status) {
		const q = data.quests.find(q => q.id === id && q.bodyKey === bodyKey);
		if (!q) return fail('That quest belongs to another world or is unavailable.');
		if (status === 'active') {
			if (q.status !== 'offered') return fail('Only an offered quest can be accepted.');
			if (data.quests.filter(q => q.status === 'active').length >= 3) return fail('Finish or cancel an active quest first.');
			q.acceptedAt = now();
		} else {
			if (!['offered', 'active'].includes(q.status)) return fail('That quest has already ended.');
			q.finishedAt = now();
		}
		q.status = status; save(); return { ok: true, quest: copy(q) };
	}
	function advance(q, evidence) {
		q.steps[q.cursor].completedAt = now(); q.evidence.push(evidence); q.evidence = q.evidence.slice(-16); q.cursor++;
		if (q.cursor === q.steps.length) { q.status = 'complete'; q.finishedAt = now(); }
		return copy(q);
	}
	function update({ bodyKey, position, targets = [] } = {}) {
		if (!finitePosition(position)) return [];
		const ctx = questContext({ bodyKey, targets }), changed = [];
		for (const q of data.quests) {
			if (q.status !== 'active' || q.bodyKey !== bodyKey) continue;
			const step = q.steps[q.cursor];
			if (!['visit', 'return'].includes(step.type)) continue;
			const t = ctx.targets.find(t => t.id === step.targetId);
			if (!t || Math.hypot(position.x - t.x, position.z - t.z) > t.radius || Math.abs(position.y - t.y) > Math.min(t.radius, 12)) continue;
			changed.push(advance(q, { type: 'presence', targetId: t.id, at: now() }));
		}
		if (changed.length) save(); return changed;
	}
	function event(e = {}) {
		if (!e || !['talk', 'scout'].includes(e.type) || !label(e.id) || !e.bodyKey || !e.npcId) return [];
		if (e.type === 'scout' && (!e.taskId || e.status !== 'completed' || !Number.isFinite(e.completedAt))) return [];
		const changed = [];
		for (const q of data.quests) {
			if (q.status !== 'active' || q.bodyKey !== e.bodyKey || q.evidence.some(prior => prior.id === e.id)) continue;
			const s = q.steps[q.cursor];
			if (s.type !== e.type || s.npcId !== e.npcId) continue;
			if (s.type === 'scout' && (s.targetId !== e.targetId || e.completedAt < (q.cursor ? q.steps[q.cursor - 1].completedAt : q.acceptedAt) || q.evidence.some(prior => prior.taskId === e.taskId))) continue;
			changed.push(advance(q, { id: label(e.id), type: e.type, npcId: e.npcId, ...(e.taskId ? { taskId: e.taskId } : {}), at: now() }));
		}
		if (changed.length) save(); return changed;
	}
	return { context, propose, accept: (id, bodyKey) => change(id, bodyKey, 'active'), cancel: (id, bodyKey) => change(id, bodyKey, 'cancelled'), update, event, list, status: () => ({ error, blocked, quests: data.quests.length }), save };
}

// A grounded offer still exists when the model is unavailable. It goes through
// exactly the same validator and evidence rules as a model-authored proposal.
export function fallbackQuest(input, { npcId, position } = {}) {
	const ctx = questContext(input), npc = ctx.npcs.find(n => n.id === npcId) || ctx.npcs[0];
	const prior = input?.previous || [];
	const distance = t => finitePosition(position) ? Math.hypot(t.x - position.x, t.z - position.z) : 0;
	const stops = ctx.targets.filter(t => !t.id.startsWith('home:') && !t.under && distance(t) >= (finitePosition(position) ? t.radius * 1.5 : 0) && distance(t) <= 5000).sort((a, b) => distance(a) - distance(b)).slice(0, 8);
	const home = npc && ctx.targets.find(t => t.id === `home:${npc.id}`);
	for (let offset = 0; offset < stops.length; offset++) {
		const first = stops[(prior.length + offset) % stops.length];
		const second = stops.find(t => t.id !== first.id && Math.hypot(t.x - first.x, t.z - first.z) > Math.max(t.radius, first.radius) * 2 && Math.hypot(t.x - first.x, t.z - first.z) < 2000);
		const steps = [{ type: 'visit', targetId: first.id }];
		if (second) steps.push({ type: 'visit', targetId: second.id });
		if (home && steps.length < 3) steps.push({ type: 'return', targetId: home.id });
		if (npc) steps.push({ type: 'talk', npcId: npc.id });
		if (steps.length < 2) continue;
		const themes = [
			{ title: `A different view of ${first.name}`, purpose: `${npc?.name || 'Your journal'} has a question: what makes ${first.name} feel different from ${second?.name || 'home'}? Walk the route and bring back your own impression.` },
			{ title: `The long way to ${first.name}`, purpose: `Take a deliberate detour through ${first.name}${second ? ` and ${second.name}` : ''}. ${npc ? `${npc.name} would like to hear which place you would show a new arrival first.` : 'Decide which place you would show a new arrival first.'}` },
			{ title: `Two sides of this place`, purpose: `Look closely at ${first.name}${second ? `, then compare it with ${second.name}` : ''}. ${first.fact ? `Your starting clue: ${first.fact}. ` : ''}${npc ? `Return with a question for ${npc.name}, rather than a perfect answer.` : 'Keep one detail from each stop in mind.'}` },
		];
		const theme = themes[(prior.length + offset) % themes.length];
		const plan = { title: theme.title, premise: theme.purpose, steps };
		if (prior.some(q => JSON.stringify(q.steps.map(s => [s.type, s.targetId || '', s.npcId || ''])) === JSON.stringify(steps.map(s => [s.type, s.targetId || '', s.npcId || ''])))) continue;
		if (validateQuestPlan(plan, ctx).ok) return plan;
	}
	return null;
}
