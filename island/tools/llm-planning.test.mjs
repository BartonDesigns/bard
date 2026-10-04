import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLM, planningFitsContext } from '../src/guide/llm.js';

const messages = [{ role: 'system', content: 'Client-only planning instructions' }, { role: 'user', content: 'Would you have a look around?' }];
const planning = { kind: 'social_intent', context: { resident: { name: 'Rae' }, playerRequest: messages[1].content, destinations: [] } };
const npc = { name: 'Rae' };
const response = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('old cloud server never receives planner calls or automatic opt-in', async () => {
	const previous = globalThis.fetch, calls = [];
	globalThis.fetch = async (url) => { calls.push(url); return response({ talk: { left: 100 } }); };
	try {
		const llm = createLLM();
		assert.equal(llm.kind(), 'none');
		assert.equal(llm.supportsPlanning(), false);
		await llm.useCloud('https://example.test');
		assert.equal(llm.supportsPlanning(), false);
		assert.equal(await llm.chat(messages, () => {}, undefined, { planning, npc }), null);
		assert.deepEqual(calls, ['https://example.test/status']);
	} finally { globalThis.fetch = previous; }
});

test('capable cloud gets bounded structured data without client system instructions', async () => {
	const previous = globalThis.fetch, bodies = [];
	globalThis.fetch = async (url, opts) => {
		if (url.endsWith('/status')) return response({ planning: ['social_intent', 'story_quest'], talk: { left: 100 } });
		bodies.push(JSON.parse(opts.body)); return response({ reply: '{"intent":"scout"}' });
	};
	try {
		const llm = createLLM(); await llm.useCloud('https://example.test');
		assert.equal(llm.supportsPlanning('story_quest'), true);
		let rendered;
		assert.equal(await llm.chat(messages, s => { rendered = s; }, undefined, { planning, npc }), '{"intent":"scout"}');
		assert.equal(rendered, '{"intent":"scout"}');
		assert.deepEqual(bodies[0].planning, planning);
		assert.equal(JSON.stringify(bodies).includes('Client-only'), false);
		assert.equal(await llm.chat(messages, () => {}, undefined, { planning: { ...planning, context: { huge: 'a'.repeat(7000) } }, npc }), null);
		assert.equal(bodies.length, 1);
	} finally { globalThis.fetch = previous; }
});

test('queued cancelled conversation never makes a second request', async () => {
	const previous = globalThis.fetch; let release, calls = 0;
	globalThis.fetch = async (url) => {
		if (url.endsWith('/status')) return response({ planning: ['social_intent'] });
		calls++; await new Promise(resolve => { release = resolve; }); return response({ reply: 'hello' });
	};
	try {
		const llm = createLLM(); await llm.useCloud('https://example.test');
		const first = llm.chat(messages, () => {}, undefined, { npc });
		await new Promise(resolve => setTimeout(resolve, 0));
		const ctrl = new AbortController();
		const second = llm.chat(messages, () => {}, ctrl.signal, { planning, npc });
		ctrl.abort(); release(); await first;
		await assert.rejects(second, { name: 'AbortError' }); assert.equal(calls, 1);
	} finally { globalThis.fetch = previous; }
});

test('local model planning keeps a bounded useful JSON token budget', async () => {
	const previous = globalThis.fetch; let sent;
	globalThis.fetch = async (url, opts) => {
		if (url.endsWith('/api/tags')) return response({ models: [] });
		sent = JSON.parse(opts.body);
		return new Response('{"message":{"content":"{}"}}\n');
	};
	try {
		const llm = createLLM(); await llm.useOllama('http://localhost:11434');
		assert.equal(llm.supportsPlanning(), true);
		await llm.chat(messages, () => {}, undefined, { planning: { kind: 'story_quest', context: {} }, json: true, maxTokens: 9000 });
		assert.equal(sent.options.num_predict, 900); assert.equal(sent.format, 'json');
	} finally { globalThis.fetch = previous; }
});

test('phone planning reserves complete output and refuses oversized context without truncating JSON', () => {
	assert.equal(planningFitsContext([{ role: 'system', content: 'x'.repeat(2000) }], 700), true);
	assert.equal(planningFitsContext([{ role: 'system', content: 'x'.repeat(4000) }], 700), false);
	assert.equal(planningFitsContext([{ role: 'user', content: 'x'.repeat(3000) }], 900), false);
	assert.equal(planningFitsContext([], 2048), false);
});
