// First-run voices use the configured shared service. Saved, deliberate choices
// remain the player's choices; unavailable providers only fall back for this run.
const MODEL_KINDS = new Set(['none', 'cloud', 'ollama', 'webllm']);
const text = (value, fallback, limit = 128) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback;

export function chooseGuideModel(saved, { cloudURL = '', phone = false, webGPU = false, crashed = false, offline = false } = {}) {
	const base = {
		kind: 'none',
		id: phone ? 'SmolLM2-360M-Instruct-q4f16_1-MLC' : 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
		url: 'http://localhost:11434',
		name: 'llama3.2',
	};
	const valid = saved && typeof saved === 'object' && !Array.isArray(saved) && MODEL_KINDS.has(saved.kind);
	// Old auto choices were defaults, not an explicit request to download a model.
	const explicit = valid && saved.auto !== true;
	const choice = explicit ? {
		...base,
		kind: saved.kind,
		id: text(saved.id, base.id),
		url: text(saved.url, base.url, 2048),
		name: text(saved.name, base.name),
	} : { ...base, kind: cloudURL ? 'cloud' : 'none', auto: true };
	// Do not write these temporary restrictions back over the player's preference.
	if (offline || (choice.kind === 'cloud' && !cloudURL) || (choice.kind === 'webllm' && (phone || !webGPU || crashed))) choice.kind = 'none';
	return choice;
}
