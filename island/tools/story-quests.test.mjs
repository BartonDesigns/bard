import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryQuests, validateQuestPlan, fallbackQuest, STORY_QUEST_KEY } from '../src/guide/story-quests.js';
const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };
const ctx = { bodyKey: 'earth', targets: [{ id: 'hill', name: 'Hill', x: 100, y: 10, z: 100, scoutable: true }, { id: 'lake', name: 'Lake', x: 300, y: 2, z: 100 }, { id: 'home:ada', name: 'Village', x: 0, y: 2, z: 0 }], npcs: [{ id: 'ada', name: 'Ada' }] };
const plan = { title: 'Views and voices', premise: 'Compare the hill and lake, then share your impression.', steps: [{ type: 'visit', targetId: 'hill' }, { type: 'visit', targetId: 'lake' }, { type: 'return', targetId: 'home:ada' }, { type: 'talk', npcId: 'ada' }] };
const setup = () => { const s = storage(), director = createStoryQuests({ storage: s, now: () => 1000 }); const q = director.propose(plan, ctx).quest; return { s, director, q }; };
test('strict proposals reject malformed, invented, unimplemented, repeated and foreign objectives', () => {
	assert.equal(validateQuestPlan(plan, ctx).ok, true);
	for (const raw of ['broken', {}, { ...plan, reward: 'gold' }, { ...plan, steps: [{ type: 'fight', npcId: 'ada' }, plan.steps[0]] }, { ...plan, steps: [{ type: 'visit', targetId: 'moon' }, plan.steps[0]] }, { ...plan, steps: [plan.steps[0], plan.steps[0]] }, { ...plan, steps: [{ type: 'talk', npcId: 'ghost' }, plan.steps[0]] }]) assert.equal(validateQuestPlan(raw, ctx).ok, false);
	assert.equal(validateQuestPlan(plan, { ...ctx, targets: ctx.targets.map(t => ({ ...t, bodyKey: 'mars' })) }).ok, false);
});
test('offer requires explicit acceptance, correct body, and real ordered evidence', () => {
	const { director: d, q } = setup();
	assert.deepEqual(d.update({ bodyKey: 'earth', position: ctx.targets[0], targets: ctx.targets }), []);
	assert.equal(d.accept(q.id, 'mars').ok, false); assert.equal(d.accept(q.id, 'earth').ok, true);
	assert.deepEqual(d.event({ id: 'premature', type: 'talk', bodyKey: 'earth', npcId: 'ada' }), []);
	assert.deepEqual(d.update({ bodyKey: 'mars', position: ctx.targets[0], targets: ctx.targets }), []);
	assert.deepEqual(d.update({ bodyKey: 'earth', position: { ...ctx.targets[0], y: 1000 }, targets: ctx.targets }), []);
	for (const target of ctx.targets) d.update({ bodyKey: 'earth', position: target, targets: ctx.targets });
	assert.equal(d.list()[0].status, 'active'); assert.equal(d.list()[0].cursor, 3);
	assert.deepEqual(d.event({ id: 'wrong-person', type: 'talk', bodyKey: 'earth', npcId: 'other' }), []);
	assert.equal(d.event({ id: 'real-talk', type: 'talk', bodyKey: 'earth', npcId: 'ada' })[0].status, 'complete');
	assert.deepEqual(d.event({ id: 'real-talk', type: 'talk', bodyKey: 'earth', npcId: 'ada' }), []);
});
test('reload preserves accepted progress and resolves current coordinates after rebase', () => {
	const { director: d, s, q } = setup(); d.accept(q.id, 'earth');
	d.update({ bodyKey: 'earth', position: ctx.targets[0], targets: ctx.targets });
	const restored = createStoryQuests({ storage: s, now: () => 2000 });
	assert.equal(restored.list()[0].cursor, 1);
	const moved = ctx.targets.map(t => ({ ...t, x: t.x + 10000 }));
	assert.deepEqual(restored.update({ bodyKey: 'earth', position: ctx.targets[1], targets: moved }), []);
	assert.equal(restored.update({ bodyKey: 'earth', position: moved[1], targets: moved })[0].cursor, 2);
	assert.equal(restored.propose(plan, ctx).ok, false);
});
test('cancel closes offers and active quests, never completes via narrative claims', () => {
	const { director: d, q } = setup();
	assert.equal(d.event({ id: 'lie', type: 'complete', bodyKey: 'earth', npcId: 'ada' }).length, 0);
	assert.equal(d.cancel(q.id, 'earth').quest.status, 'cancelled'); assert.equal(d.accept(q.id, 'earth').ok, false);
	assert.equal(d.cancel(q.id, 'earth').ok, false);
});
test('scout objective requires actual new completed task report for the right place', () => {
	const d = createStoryQuests({ storage: storage(), now: () => 1000 });
	const p = { title: 'A scout report', premise: 'Ask Ada to inspect the hill and report back.', steps: [{ type: 'scout', targetId: 'hill', npcId: 'ada' }, { type: 'talk', npcId: 'ada' }] };
	const q = d.propose(p, ctx).quest; d.accept(q.id, 'earth');
	const event = { id: 'report1', type: 'scout', bodyKey: 'earth', npcId: 'ada', targetId: 'hill', taskId: 'task1', status: 'completed', completedAt: 1100 };
	for (const changes of [{ status: 'outbound' }, { completedAt: 999 }, { targetId: 'lake' }, { npcId: 'other' }, { taskId: null }]) assert.deepEqual(d.event({ ...event, ...changes }), []);
	assert.equal(d.event(event)[0].cursor, 1);
	assert.equal(validateQuestPlan({ ...p, steps: [{ ...p.steps[0], targetId: 'lake' }, p.steps[1]] }, ctx).ok, false);
});
test('offline offers use available facts, vary routes, and are validated', () => {
	const input = { ...ctx, previous: [] }, position = { x: 0, y: 2, z: 0 };
	const first = fallbackQuest(input, { npcId: 'ada', position });
	assert.equal(validateQuestPlan(first, ctx).ok, true);
	const next = fallbackQuest({ ...input, previous: [first] }, { npcId: 'ada', position });
	assert.equal(validateQuestPlan(next, ctx).ok, true);
	assert.notDeepEqual(first.steps, next.steps);
	assert.equal(fallbackQuest({ bodyKey: 'earth', targets: [], npcs: [] }), null);
});
test('bad saves are preserved, storage failures remain visible', () => {
	const s = storage(); s.setItem(STORY_QUEST_KEY, '{bad');
	const d = createStoryQuests({ storage: s }); d.propose(plan, ctx);
	assert.equal(d.status().blocked, true); assert.equal(s.getItem(STORY_QUEST_KEY), '{bad');
	const unavailable = createStoryQuests({ storage: { getItem: () => null, setItem: () => { throw Error('quota'); } } });
	assert.equal(unavailable.propose(plan, ctx).ok, true); assert.ok(unavailable.status().error);
});
test('unsupported narrative promises and offer limits cannot sneak through valid step types', () => {
	for (const premise of ['Kill the dragon.', 'Deliver the artifact.', 'Earn gold pieces as a reward.', 'Unlock a new dungeon.']) assert.equal(validateQuestPlan({ ...plan, premise }, ctx).ok, false);
	const d = createStoryQuests({ storage: storage() });
	const choices = [
		[{ type: 'visit', targetId: 'hill' }, { type: 'talk', npcId: 'ada' }],
		[{ type: 'visit', targetId: 'lake' }, { type: 'talk', npcId: 'ada' }],
		[{ type: 'visit', targetId: 'home:ada' }, { type: 'talk', npcId: 'ada' }],
		plan.steps,
	];
	for (const steps of choices.slice(0, 3)) assert.equal(d.propose({ ...plan, steps }, ctx).ok, true);
	assert.equal(d.propose(plan, ctx).ok, false);
	for (const q of d.list()) assert.equal(d.accept(q.id, 'earth').ok, true);
	const fourth = d.propose(plan, ctx).quest;
	assert.equal(d.accept(fourth.id, 'earth').ok, false);
	assert.equal(d.cancel(d.list()[0].id, 'earth').ok, true);
	assert.equal(d.accept(fourth.id, 'earth').ok, true);
});
test('private-browser localStorage getter failures do not prevent quests this session', () => {
	const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
	try {
		Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Storage denied'); } });
		const d = createStoryQuests();
		assert.equal(d.propose(plan, ctx).ok, true); assert.ok(d.status().error);
	} finally { if (old) Object.defineProperty(globalThis, 'localStorage', old); else delete globalThis.localStorage; }
});
test('long valid body IDs remain exact and overlong IDs are rejected without aliasing', () => {
	const bodyKey = `earth:${'x'.repeat(450)}`, context = { ...ctx, bodyKey };
	const d = createStoryQuests({ storage: storage() });
	const q = d.propose(plan, context).quest;
	assert.equal(q.bodyKey, bodyKey); assert.equal(d.accept(q.id, bodyKey).ok, true);
	assert.equal(d.update({ bodyKey, position: ctx.targets[0], targets: ctx.targets })[0].cursor, 1);
	assert.equal(validateQuestPlan(plan, { ...ctx, bodyKey: 'x'.repeat(513) }).ok, false);
});
test('conversation-only instant quests are rejected', () => {
	assert.equal(validateQuestPlan({ ...plan, steps: [{ type: 'talk', npcId: 'ada' }, { type: 'talk', npcId: 'bob' }] }, { ...ctx, npcs: [...ctx.npcs, { id: 'bob', name: 'Bob' }] }).ok, false);
});
test('null and inconsistent restored fields are preserved and cannot crash event handling', () => {
	const { s } = setup(), good = JSON.parse(s.getItem(STORY_QUEST_KEY));
	const variants = [null, { ...good, quests: [null] }, { ...good, quests: [{ ...good.quests[0], status: 'active', cursor: 4 }] }, { ...good, quests: [{ ...good.quests[0], evidence: [null] }] }, { ...good, quests: [{ ...good.quests[0], steps: [null, null] }] }];
	for (const value of variants) {
		const mem = storage(), raw = JSON.stringify(value); mem.setItem(STORY_QUEST_KEY, raw);
		const d = createStoryQuests({ storage: mem });
		assert.equal(d.status().blocked, true); assert.deepEqual(d.event(null), []);
		assert.deepEqual(d.update({ bodyKey: 'earth', position: ctx.targets[0], targets: ctx.targets }), []);
		assert.equal(mem.getItem(STORY_QUEST_KEY), raw);
	}
});
test('old scout reports cannot complete a later objective after reload', () => {
	let clock = 1000; const mem = storage();
	const d = createStoryQuests({ storage: mem, now: () => clock });
	const p = { ...plan, steps: [{ type: 'visit', targetId: 'lake' }, { type: 'scout', targetId: 'hill', npcId: 'ada' }, { type: 'talk', npcId: 'ada' }] };
	const q = d.propose(p, ctx).quest; d.accept(q.id, 'earth');
	clock = 2000; d.update({ bodyKey: 'earth', position: ctx.targets[1], targets: ctx.targets });
	const loaded = createStoryQuests({ storage: mem, now: () => 3000 });
	const event = { id: 'report', type: 'scout', bodyKey: 'earth', npcId: 'ada', targetId: 'hill', taskId: 'actual-task', status: 'completed', completedAt: 1500 };
	assert.deepEqual(loaded.event(event), []);
	assert.equal(loaded.event({ ...event, completedAt: 2500 })[0].cursor, 2);
});
test('quest ownership comes only from a whitelisted speaker and survives reload', () => {
	const mem = storage(), d = createStoryQuests({ storage: mem });
	const context = d.context({ ...ctx, speaker: 'ada' });
	assert.equal(context.speaker, 'ada');
	const q = d.propose(plan, context).quest;
	assert.equal(q.offeredBy, 'ada');
	assert.equal(createStoryQuests({ storage: mem }).list()[0].offeredBy, 'ada');
	assert.equal(validateQuestPlan({ ...plan, offeredBy: 'ada' }, context).ok, false);
	const unknown = createStoryQuests({ storage: storage() });
	assert.equal(unknown.propose(plan, { ...ctx, speaker: 'ghost' }).quest.offeredBy, null);
	const absent = createStoryQuests({ storage: storage() });
	assert.equal(absent.propose(plan, ctx).quest.offeredBy, null);
});
