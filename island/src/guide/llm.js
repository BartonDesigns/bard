// The Guide's voice: a conversational model that runs on your own device.
//
//   webllm  - runs entirely in the browser on the GPU (WebGPU) with WebLLM. The model
//             downloads once (0.4-1.6 GB) and is cached; nothing leaves the device.
//   ollama  - a model served by Ollama on this computer (http://localhost:11434).
//             Start it with OLLAMA_ORIGINS=https://level99bard.com ollama serve
//   cloud   - the townsfolk's shared voice on the discovery server (server/discovery POST /talk,
//             Workers AI inside the free daily allowance). Only people talk this way: the
//             server writes their instructions, and when the day's share is spent (or the
//             server is not deployed) they answer with their own built-in lines.
//   none    - no model: the built-in guide answers from the world itself.
//
// All three share one call: chat(messages, onToken) -> full reply text.

const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.85';
export const WEBLLM_MODELS = [
	{ id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 1.5B (best, 1.6 GB)' },
	{ id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 1B (0.9 GB)' },
	{ id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 · 3B (2.3 GB, desktop)' },
	{ id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 · 0.5B (0.9 GB)' },
	{ id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', label: 'SmolLM2 · 360M (phones, 0.35 GB)' },
];
const PHONE = typeof navigator !== 'undefined' && /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
// a phone gives the page little memory, shared with the world's own: the model runs with
// a short memory of the conversation, and if the page died while the model was working
// last time, it is not started again by itself (crashedBefore)
const GUARD = 'crysis-llm-working';
let crashed = false;
try { crashed = !!localStorage.getItem(GUARD); localStorage.removeItem(GUARD); } catch { /* private mode */ }
const guard = (on) => { try { if (on) localStorage.setItem(GUARD, String(Date.now())); else localStorage.removeItem(GUARD); } catch { /* private mode */ } };
export const crashedBefore = () => crashed;
export const onPhone = () => PHONE;

// A conservative estimate leaves room for the chat template and complete JSON output.
export function planningFitsContext(messages, maxTokens, contextSize = 2048) {
	const input = messages.reduce((n, m) => n + Math.ceil(String(m.content || '').length / 2.5) + 16, 64);
	return input + maxTokens <= contextSize;
}

export function hasWebGPU() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

export function createLLM() {
	let busy = false, kind = 'none', engine = null, loading = null, model = '', ollama = { url: 'http://localhost:11434', model: 'llama3.2' }, cloud = '', cloudPlanning = [];
	const status = { text: 'Guide only (no model)', ready: true, progress: 1 };
	const listeners = new Set();
	const emit = () => { for (const f of listeners) f(status); };

	async function useWebLLM(id) {
		kind = 'webllm'; model = id;
		if (!hasWebGPU()) { status.text = 'This browser has no WebGPU; try Chrome or Edge, or use Ollama.'; status.ready = false; emit(); throw Error('no webgpu'); }
		status.ready = false; status.progress = 0; status.text = 'Loading the model runtime…'; emit();
		loading = (async () => {
			const webllm = await import(/* @vite-ignore */ WEBLLM_URL);
			if (engine) { try { await engine.unload(); } catch { /* the old engine is gone either way */ } }
			guard(true);
			engine = await webllm.CreateMLCEngine(id, {
				initProgressCallback: (p) => { status.progress = p.progress ?? 0; status.text = p.text || 'Loading…'; emit(); },
			}, { context_window_size: 2048 });
			guard(false);
			status.ready = true; status.progress = 1; status.text = `On this device: ${id.split('-q4')[0]}`; emit();
		})();
		try { await loading; } catch (e) { guard(false); status.ready = false; status.text = 'The model could not load: ' + e.message; emit(); throw e; } finally { loading = null; }
	}
	async function useOllama(url, name) {
		kind = 'ollama'; ollama = { url: (url || ollama.url).replace(/\/$/, ''), model: name || ollama.model };
		status.ready = false; status.text = 'Looking for Ollama…'; emit();
		try {
			const r = await fetch(ollama.url + '/api/tags');
			const j = await r.json();
			const names = (j.models || []).map((m) => m.name);
			if (names.length && !names.some((n) => n === ollama.model || n.startsWith(ollama.model + ':'))) ollama.model = names[0];
			status.ready = true; status.text = `Ollama: ${ollama.model}`; emit();
			return names;
		} catch (e) {
			status.text = 'Ollama is not reachable. Run: OLLAMA_ORIGINS=' + location.origin + ' ollama serve'; emit();
			throw e;
		}
	}
	async function useCloud(url) {
		kind = 'cloud'; cloud = String(url || '').replace(/\/$/, ''); cloudPlanning = [];
		status.ready = false; status.text = 'Reaching the shared voice…'; emit();
		try {
			const r = await fetch(cloud + '/status');
			if (!r.ok) throw Error('status ' + r.status);
			const j = await r.json();
			cloudPlanning = Array.isArray(j.planning) ? j.planning.filter((k) => k === 'social_intent' || k === 'story_quest') : [];
			status.ready = true; status.progress = 1; status.text = j.talk && j.talk.left <= 0 ? 'Shared voice: resting until tomorrow (people use their own lines)' : 'Shared voice (free, in the cloud)'; emit();
		} catch (e) {
			status.text = 'The shared voice is not reachable; people use their own lines.'; emit();
			throw e;
		}
	}
	function useNone() { kind = 'none'; status.ready = true; status.progress = 1; status.text = 'Guide only (no model)'; emit(); }

	// one conversation at a time on the one engine: later calls wait their turn. opts (the city
	// director's): { maxTokens, temperature, json } where json asks for a JSON object
	let queue = Promise.resolve();
	function chat(messages, onToken, signal, opts) {
		const run = queue.then(() => chatNow(messages, onToken, signal, opts));
		queue = run.catch(() => null);
		return run;
	}
	async function chatNow(messages, onToken, signal, opts = {}) {
		if (signal?.aborted) throw new DOMException('Conversation cancelled', 'AbortError');
		const planning = opts.planning && ['social_intent', 'story_quest'].includes(opts.planning.kind) ? opts.planning : null;
		const temperature = opts.temperature ?? 0.6, cap = Math.min(opts.maxTokens ?? (planning ? 700 : 320), planning ? 900 : 512);
		if (kind === 'webllm') {
			if (loading) await loading;
			if (signal?.aborted) throw new DOMException('Conversation cancelled', 'AbortError');
			if (!engine) throw Error('The model is not loaded.');
			busy = true; guard(true);
			try {
				// (on a phone the conversation is trimmed to fit the short memory)
				const msgs = PHONE && messages.length > 5 ? [messages[0], ...messages.slice(-4)] : messages;
				if (PHONE && planning && !planningFitsContext(msgs, cap)) return null;
				const stream = await engine.chat.completions.create({ messages: msgs, stream: true, temperature, max_tokens: PHONE && !planning ? Math.min(cap, 160) : cap, ...(opts.json ? { response_format: { type: 'json_object' } } : {}) });
				let text = '';
				for await (const c of stream) { if (signal?.aborted) { engine.interruptGenerate?.(); break; } const d = c.choices?.[0]?.delta?.content || ''; if (d) { text += d; onToken(text); } }
				return text;
			} finally { busy = false; guard(false); }
		}
		if (kind === 'cloud') {
			// people only (opts.npc: who they are, from guide.js); anything else answers built in
			if (!opts.npc || (planning && !cloudPlanning.includes(planning.kind))) return null;
			const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-8).map((m) => ({ role: m.role, content: String(m.content).slice(0, 400) }));
			const body = JSON.stringify({ npc: opts.npc, history, ...(planning ? { planning: { kind: planning.kind, context: planning.context } } : {}) });
			if (body.length > 6144) return null;
			const r = await fetch(cloud + '/talk', { method: 'POST', signal, headers: { 'content-type': 'application/json' }, body });
			if (!r.ok) return null;
			const j = await r.json();
			if (!j.reply) return null;
			onToken(j.reply);
			return j.reply;
		}
		if (kind === 'ollama') {
			const r = await fetch(ollama.url + '/api/chat', { method: 'POST', signal, body: JSON.stringify({ model: ollama.model, messages, stream: true, ...(opts.json ? { format: 'json' } : {}), options: { temperature, num_predict: cap } }) });
			const rd = r.body.getReader(), dec = new TextDecoder();
			let text = '', buf = '';
			for (;;) {
				const { value, done } = await rd.read();
				if (done) break;
				buf += dec.decode(value, { stream: true });
				let i;
				while ((i = buf.indexOf('\n')) >= 0) {
					const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
					if (!line) continue;
					try { const j = JSON.parse(line); if (j.message?.content) { text += j.message.content; onToken(text); } } catch { /* a partial line; the rest comes next read */ }
				}
			}
			return text;
		}
		return null;
	}
	return { useWebLLM, useOllama, useCloud, useNone, chat, status, busy: () => busy, kind: () => kind, supportsPlanning: (mode = 'social_intent') => kind === 'webllm' || kind === 'ollama' || (kind === 'cloud' && cloudPlanning.includes(mode)), model: () => model, ollama: () => ({ ...ollama }), onStatus: (f) => { listeners.add(f); f(status); return () => listeners.delete(f); } };
}
