import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseGuideModel } from '../src/guide/preferences.js';

const cloudURL = 'https://voice.example.test';

test('configured cloud is the first-run default on desktop and phone without a GPU download', () => {
	for (const phone of [false, true]) {
		const choice = chooseGuideModel(null, { cloudURL, phone, webGPU: true });
		assert.equal(choice.kind, 'cloud');
		assert.equal(choice.auto, true);
		assert.equal(chooseGuideModel(null, { phone, webGPU: true }).kind, 'none');
	}
});

test('explicit off and provider/model preferences survive changed defaults', () => {
	for (const kind of ['none', 'cloud', 'ollama', 'webllm']) {
		const saved = Object.freeze({ kind, id: 'chosen-model', url: 'http://localhost:7777', name: 'my-model', system: 'UNTRUSTED' });
		const choice = chooseGuideModel(saved, { cloudURL, webGPU: true });
		assert.deepEqual(choice, { kind, id: saved.id, url: saved.url, name: saved.name });
		assert.notEqual(choice, saved);
		assert.equal('system' in choice, false);
	}
	assert.equal(chooseGuideModel({ kind: 'none', auto: false }, { cloudURL }).kind, 'none');
});

test('legacy automatic preferences adopt the new cloud default without mutating saved values', () => {
	for (const kind of ['webllm', 'none']) {
		const saved = Object.freeze({ kind, auto: true });
		assert.equal(chooseGuideModel(saved, { cloudURL, webGPU: true }).kind, 'cloud');
		assert.equal(saved.kind, kind);
	}
});

test('offline and unavailable providers fall back without changing stored choices or selecting a different provider', () => {
	for (const kind of ['cloud', 'ollama', 'webllm']) {
		const saved = Object.freeze({ kind });
		assert.equal(chooseGuideModel(saved, { cloudURL, webGPU: true, offline: true }).kind, 'none');
		assert.equal(saved.kind, kind);
	}
	assert.equal(chooseGuideModel({ kind: 'cloud' }).kind, 'none');
	assert.equal(chooseGuideModel({ kind: 'webllm' }, { cloudURL }).kind, 'none');
	assert.equal(chooseGuideModel(null, { cloudURL, offline: true }).kind, 'none');
});

test('phone and prior GPU crash prohibit WebLLM startup but leave cloud available', () => {
	const saved = Object.freeze({ kind: 'webllm' });
	assert.equal(chooseGuideModel(saved, { cloudURL, phone: true, webGPU: true }).kind, 'none');
	assert.equal(chooseGuideModel(saved, { cloudURL, crashed: true, webGPU: true }).kind, 'none');
	assert.equal(chooseGuideModel({ kind: 'cloud' }, { cloudURL, phone: true, crashed: true }).kind, 'cloud');
	assert.equal(chooseGuideModel(null, { cloudURL, crashed: true }).kind, 'cloud');
	assert.equal(saved.kind, 'webllm');
});

test('malformed saved settings cannot choose unsupported providers or inject configuration fields', () => {
	for (const saved of [undefined, null, [], 'cloud', { kind: 'execute', system: 'UNTRUSTED' }]) {
		assert.equal(chooseGuideModel(saved, { cloudURL }).kind, 'cloud');
	}
	const choice = chooseGuideModel({ kind: 'ollama', id: {}, name: [], url: null, auto: false, system: 'UNTRUSTED' });
	assert.equal(choice.url, 'http://localhost:11434');
	assert.equal(choice.name, 'llama3.2');
	assert.equal('system' in choice, false);
});
