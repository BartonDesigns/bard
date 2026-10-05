import test from 'node:test';
import assert from 'node:assert/strict';
import {
	WORLD_PROJECTS_BACKEND,
	WORLD_PROJECTS_KEY,
	WORLD_PROJECTS_SCOPE,
	createWorldProjects,
	projectForQuest,
} from '../src/guide/world-projects.js';

const storage = () => {
	const values = new Map();
	return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
const quest = (extra = {}) => ({
	id: 'story-abc-1', bodyKey: 'earth', status: 'complete',
	steps: [{ type: 'visit', targetId: 'place-village', targetName: 'Village' }, { type: 'talk', npcId: 'person-ada' }],
	...extra,
});

test('completed exploration quest maps to a bounded private world project', () => {
	const p = projectForQuest(quest(), { name: 'Village', x: 10, y: 2, z: -4, radius: 14 });
	assert.equal(p.bodyKey, 'earth');
	assert.equal(p.targetId, 'place-village');
	assert.equal(p.targetName, 'Village');
	assert.equal(p.kind, 'gathering');
	assert.equal(p.status, 'complete');
	assert.equal(p.stage, 'visible');
	assert.equal(p.scope, WORLD_PROJECTS_SCOPE);
	assert.equal(p.shared, false);
	assert.equal(p.backend, WORLD_PROJECTS_BACKEND);
	assert.deepEqual(p.anchor, { x: 10, y: 2, z: -4, radius: 14 });
	assert.equal(projectForQuest({ ...quest(), status: 'cancelled' }, { name: 'Village' }), null);
	assert.equal(projectForQuest({ ...quest(), steps: [{ type: 'talk', npcId: 'person-ada' }] }), null);
});

test('completion persists across reload and is idempotent on retry', () => {
	const s = storage();
	let clock = 1000;
	const first = createWorldProjects({ storage: s, now: () => clock });
	const applied = first.complete(quest(), { name: 'Village', x: 10, y: 2, z: -4 });
	assert.equal(applied.ok, true);
	assert.equal(applied.idempotent, false);
	assert.equal(applied.persisted, true);
	assert.equal(first.list('earth').length, 1);
	clock = 2000;
	const second = createWorldProjects({ storage: s, now: () => clock });
	assert.equal(second.list('earth').length, 1);
	const retry = second.complete(quest(), { name: 'Village', x: 99, y: 2, z: -99 });
	assert.equal(retry.ok, true);
	assert.equal(retry.idempotent, true);
	assert.equal(retry.project.createdAt, 1000);
	assert.equal(retry.project.anchor.x, 10);
	assert.equal(second.list('earth').length, 1);
});

test('quest cancellation and narrative-only claims never create a project', () => {
	const d = createWorldProjects({ storage: storage() });
	assert.equal(d.complete({ ...quest(), status: 'cancelled' }, { name: 'Village' }).ok, false);
	assert.equal(d.complete({ ...quest(), status: 'active' }, { name: 'Village' }).ok, false);
	assert.equal(d.complete({ ...quest(), steps: [{ type: 'talk', npcId: 'person-ada' }, { type: 'talk', npcId: 'person-bob' }] }, { name: 'Village' }).ok, false);
	assert.equal(d.list('earth').length, 0);
});

test('project state is world-scoped and never advertises universal multiplayer', () => {
	const s = storage();
	const d = createWorldProjects({ storage: s });
	d.complete(quest(), { name: 'Village' });
	d.complete({ ...quest(), id: 'story-other-1', bodyKey: 'mars', steps: [{ type: 'visit', targetId: 'place-garden', targetName: 'Garden' }, { type: 'talk', npcId: 'person-lee' }] }, { name: 'Garden' });
	assert.equal(d.list('earth').length, 1);
	assert.equal(d.list('mars').length, 1);
	assert.equal(d.state('earth').shared, false);
	assert.equal(d.state('earth').scope, WORLD_PROJECTS_SCOPE);
	assert.equal(d.state('earth').backend, WORLD_PROJECTS_BACKEND);
	assert.equal(d.status().projects, 2);
});

test('corrupt saves remain untouched and session state reports the blocker', () => {
	const s = storage();
	s.setItem(WORLD_PROJECTS_KEY, '{not-json');
	const d = createWorldProjects({ storage: s });
	const result = d.complete(quest(), { name: 'Village' });
	assert.equal(result.ok, true);
	assert.equal(result.persisted, false);
	assert.equal(d.status().blocked, true);
	assert.match(d.status().error, /preserved/);
	assert.equal(s.getItem(WORLD_PROJECTS_KEY), '{not-json');
});

test('ledger is bounded without allowing retry to erase an existing project', () => {
	const d = createWorldProjects({ storage: storage() });
	for (let i = 0; i < 100; i++) {
		const q = { ...quest(), id: `story-${i}`, steps: [{ type: 'visit', targetId: `place-${i}`, targetName: `Place ${i}` }, { type: 'talk', npcId: 'person-ada' }] };
		assert.equal(d.complete(q, { name: `Place ${i}` }).ok, true);
	}
	assert.equal(d.list('earth').length, 96);
	const latest = d.list('earth').find((p) => p.targetId === 'place-99');
	assert.ok(latest);
	assert.equal(d.complete({ ...quest(), id: 'story-99', steps: [{ type: 'visit', targetId: 'place-99', targetName: 'Place 99' }, { type: 'talk', npcId: 'person-ada' }] }, { name: 'changed' }).idempotent, true);
});

console.log('World projects: private scope, quest mapping, persistence, idempotent retries, cancellation guards, corruption handling and bounded ledger passed.');

