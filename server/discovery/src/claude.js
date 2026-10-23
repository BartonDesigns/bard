// Claude, for the people's realtime conversation (npc-talk.js): the official SDK, streaming,
// the key a Worker secret (ANTHROPIC_API_KEY, never in the repo). Without the key this returns
// null and the people fall back to Workers AI; nothing else changes.
//
//   const C = createClaude(env);           null when no key is set
//   await C.stream({ system, messages, maxTokens }, onText)
//     -> { text, usage: { in, out, cached, written }, model, stop, error }   (error a short kind:
//        'busy', 'key', 'offline', 'api 500', 'declined'...; the detail goes to the Worker's log only)
//
// system is an array of text blocks; the first (the fixed rules, the same for everyone) is
// marked for prompt caching, so a day of conversation reads it from the cache at a twentieth of
// the price. Thinking stays on at low effort (the model's fastest setting); no temperature or
// prefill (not accepted by these models). A safety-classifier decline is retried server-side
// on Anthropic's recommended fallback when the model allows it; a model that refuses the
// fallbacks field is asked again without it, once, and remembered.

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_DEFAULTS = Object.freeze({ model: 'claude-opus-5-5', effort: 'low', maxTokens: 260, turnsPerDay: 3000, fallbacks: true, timeout: 25000 });
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
// list price in dollars per million tokens (input, output, cache read, cache write), by family;
// only used for the running estimate on /status, CLAUDE_USD_* vars override it
const PRICES = [
	[/opus-5-5/, [4, 20, 0.2, 5]], [/opus-5\b/, [5, 25, 0.5, 6.25]], [/sonnet-5-5|sonnet-5\b/, [2, 10, 0.2, 2.5]],
	[/haiku-5-5/, [0.1, 0.5, 0.01, 0.125]], [/fable|mythos/, [10, 50, 0.25, 12.5]], [/opus-4/, [5, 25, 0.5, 6.25]], [/sonnet-4/, [3, 15, 0.3, 3.75]], [/haiku-4/, [1, 5, 0.1, 1.25]],
];

export function claudeSettings(env = {}) {
	const n = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
	const model = typeof env.CLAUDE_MODEL === 'string' && /^claude-[a-z0-9-]+$/.test(env.CLAUDE_MODEL) ? env.CLAUDE_MODEL : CLAUDE_DEFAULTS.model;
	const price = (PRICES.find(([re]) => re.test(model)) || [null, [4, 20, 0.2, 5]])[1];
	return {
		model, effort: EFFORTS.has(env.CLAUDE_EFFORT) ? env.CLAUDE_EFFORT : CLAUDE_DEFAULTS.effort,
		maxTokens: Math.min(600, n(env.CLAUDE_MAX_TOKENS, CLAUDE_DEFAULTS.maxTokens)),
		turnsPerDay: Math.round(n(env.CLAUDE_TURNS_PER_DAY, CLAUDE_DEFAULTS.turnsPerDay)),
		fallbacks: env.CLAUDE_FALLBACKS !== 'false', timeout: Math.min(60000, n(env.CLAUDE_TIMEOUT_MS, CLAUDE_DEFAULTS.timeout)),
		usd: { in: n(env.CLAUDE_USD_IN_PER_M, price[0]), out: n(env.CLAUDE_USD_OUT_PER_M, price[1]), cached: n(env.CLAUDE_USD_CACHED_PER_M, price[2]), written: n(env.CLAUDE_USD_WRITE_PER_M, price[3]) },
	};
}
// dollars for a day's tokens (the /status estimate)
export const usdFor = (S, t) => ((t.in || 0) * S.usd.in + (t.out || 0) * S.usd.out + (t.cached || 0) * S.usd.cached + (t.written || 0) * S.usd.written) / 1e6;

const usageOf = (u) => ({ in: u?.input_tokens || 0, out: u?.output_tokens || 0, cached: u?.cache_read_input_tokens || 0, written: u?.cache_creation_input_tokens || 0 });

export function createClaude(env = {}) {
	if (env.CLAUDE) return env.CLAUDE;                      // a stand-in (tests)
	if (!env.ANTHROPIC_API_KEY) return null;
	const S = claudeSettings(env);
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: S.timeout });
	let noFallbacks = !S.fallbacks;
	const request = ({ system, messages, maxTokens }, withFallbacks) => ({
		model: S.model, max_tokens: Math.min(S.maxTokens, maxTokens || S.maxTokens),
		system: system.map((text, i) => (i === 0 ? { type: 'text', text, cache_control: { type: 'ephemeral' } } : { type: 'text', text })),
		messages, output_config: { effort: S.effort },
		...(withFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
	});
	async function once(req, onText, signal) {
		let text = '';
		const stream = client.beta.messages.stream(request(req, !noFallbacks), { signal });
		stream.on('text', (delta) => { text += delta; onText?.(delta); });
		const msg = await stream.finalMessage();
		if (msg.stop_reason === 'refusal') return { text: '', usage: usageOf(msg.usage), model: msg.model, stop: 'refusal', error: 'declined' };
		return { text, usage: usageOf(msg.usage), model: msg.model, stop: msg.stop_reason, error: text ? '' : 'empty reply' };
	}
	return {
		model: S.model, settings: S,
		async stream(req, onText, signal) {
			try {
				return await once(req, onText, signal);
			} catch (err) {
				// the model took no fallbacks field (400 before any output): ask again plainly, once
				if (err instanceof Anthropic.BadRequestError && !noFallbacks && /fallback/i.test(err.message || '')) {
					noFallbacks = true;
					try { return await once(req, onText, signal); } catch (e2) { return failed(e2); }
				}
				return failed(err);
			}
		},
	};
}
function failed(err) {
	const kind = err instanceof Anthropic.RateLimitError ? 'busy' : err instanceof Anthropic.AuthenticationError ? 'key' : err instanceof Anthropic.APIUserAbortError ? 'aborted' : err instanceof Anthropic.APIConnectionError ? 'offline' : err instanceof Anthropic.APIError ? 'api ' + err.status : 'error';
	console.error('claude', kind, String(err?.message || err).slice(0, 300));
	return { text: '', usage: { in: 0, out: 0, cached: 0, written: 0 }, model: '', stop: 'error', error: kind };
}
