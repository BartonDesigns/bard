// Asking Workers AI (the env.AI binding) for a brief, and what it cost in Neurons, the unit the
// free daily allowance is counted in. One call per attempt; the ledger is told before and after.

// the default model and its price in Neurons per million tokens (Workers AI pricing page);
// both can be set in wrangler.toml, and must be changed together
export const DEFAULTS = { model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', inPerM: 26668, outPerM: 204805, maxTokens: 2000 };

export function settings(env = {}) {
	const n = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
	return { model: env.MODEL || DEFAULTS.model, inPerM: n(env.NEURONS_IN_PER_M, DEFAULTS.inPerM), outPerM: n(env.NEURONS_OUT_PER_M, DEFAULTS.outPerM), maxTokens: Math.min(4000, n(env.MAX_TOKENS, DEFAULTS.maxTokens)) };
}
// the townsfolk's voice: a smaller, cheaper model and short replies (wrangler.toml TALK_*)
export const TALK_DEFAULTS = { model: '@cf/meta/llama-3.2-3b-instruct', inPerM: 4625, outPerM: 30475, maxTokens: 160 };
export function talkSettings(env = {}) {
	const n = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
	return { model: env.TALK_MODEL || TALK_DEFAULTS.model, inPerM: n(env.TALK_IN_PER_M, TALK_DEFAULTS.inPerM), outPerM: n(env.TALK_OUT_PER_M, TALK_DEFAULTS.outPerM), maxTokens: Math.min(300, n(env.TALK_MAX_TOKENS, TALK_DEFAULTS.maxTokens)) };
}
// the most one attempt can cost: the prompt (counted generously, 3 characters a token) and
// every token it may write
export const worstCase = (req, S) => Math.ceil(((req.system.length + req.user.length) / 3 + 50) * S.inPerM / 1e6 + S.maxTokens * S.outPerM / 1e6);

// -> { value, neurons, exhausted, error }; value is the parsed object or text, when there is one
export async function ask(ai, req, S, { json = true, schema = null, messages = null, temperature = 0.6 } = {}) {
	// (a conversation passes its own lines after the system's; a brief, one request)
	const input = { messages: [{ role: 'system', content: req.system }, ...(messages || [{ role: 'user', content: req.user }])], max_tokens: S.maxTokens, temperature };
	if (json && schema) input.response_format = { type: 'json_schema', json_schema: schema };
	const worst = worstCase(req, S);
	let out;
	try {
		out = await ai.run(S.model, input);
	} catch (err) {
		const msg = String(err?.message || err);
		// the day's free Neurons are gone (4006: that stops the day), or the model had no room
		// for it (3040, 429): neither ran; anything else may have, so it is charged in full
		const notRun = /\b(4006|3040|429)\b|daily free allocation|capacity/i.test(msg);
		return { value: null, neurons: notRun ? 0 : worst, exhausted: /\b4006\b|daily free allocation/i.test(msg), error: msg.slice(0, 200) };
	}
	const u = out?.usage;
	const neurons = u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens) ? Math.ceil(u.prompt_tokens * S.inPerM / 1e6 + u.completion_tokens * S.outPerM / 1e6) : worst;
	const r = out?.response;
	return { value: r && (typeof r === 'object' || typeof r === 'string') ? r : null, neurons, exhausted: false, error: r ? '' : 'empty reply' };
}
