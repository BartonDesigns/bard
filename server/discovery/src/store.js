// One Durable Object per place (named by its id): it holds the place's brief, for good, and
// makes it at most once. A Durable Object runs one at a time and everyone asking about a
// place reaches the same one, so a second discovery arriving while the first is being made
// waits on the same promise instead of asking again.
//
// What is kept: { v, id, source: 'llm' | 'mixed' | 'atlas', brief, made: 'YYYY-MM-DD' }, the
// brief compacted (brief.js compactBrief). Nothing about who found it.
//
// When the model cannot be asked for a player (the day's free allowance is spent, or it
// failed twice), the atlas brief is kept instead: once a place is discovered it stays as
// the first player saw it. The nightly round (index.js) never does that: it only makes a
// brief when it can, and otherwise leaves the city for a later night.

import { placeOf, requestFor, briefOf, atlasBriefOf, BRIEF_SCHEMA, BRIEF_JSON_SCHEMA } from './place.js';
import { settings, worstCase, ask } from './ai.js';

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
const today = () => new Date().toISOString().slice(0, 10);
const TRIES = 2;             // failed calls (across requests) before a player's place keeps the atlas brief

export class BriefStore {
	constructor(ctx, env) {
		this.ctx = ctx;
		this.env = env;
		this.rec = undefined;        // the kept record (undefined until read)
		this.pending = null;         // the making under way, shared by everyone waiting
	}
	get waitMs() { const v = +this.env.WAIT_MS; return Number.isFinite(v) && v >= 0 ? v : 25000; }

	async record() {
		if (this.rec === undefined) this.rec = (await this.ctx.storage.get('rec')) || null;
		return this.rec;
	}

	async fetch(request) {
		const rec = await this.record();
		if (request.method === 'GET') return rec ? json(rec) : json({ error: 'not discovered' }, 404);
		const body = await request.json().catch(() => null);
		if (rec) return json(rec);
		if (!body || typeof body.id !== 'string') return json({ error: 'bad request' }, 400);
		const P = placeOf(body.id, body.id.startsWith('gen:') ? body : null);
		if (P.error) return json({ error: P.error }, 400);
		if (!this.pending) this.pending = this.make(P.city, body).finally(() => { this.pending = null; });
		let timer;
		const late = new Promise((ok) => { timer = setTimeout(() => ok({ status: 202, body: { pending: true } }), this.waitMs); });
		const out = await Promise.race([this.pending, late]);
		clearTimeout(timer);
		return json(out.body, out.status);
	}

	// -> { status, body }
	async make(city, { who = null, night = false } = {}) {
		const S = settings(this.env), req = requestFor(city), ledger = this.env.LEDGER.get(this.env.LEDGER.idFromName('ledger'));
		const call = (path, v) => ledger.fetch('https://ledger' + path, { method: 'POST', body: JSON.stringify(v) }).then((r) => r.json());
		const g = city.gen ? { cell: city.lat.toFixed(2) + ',' + city.lon.toFixed(2), slug: city.id.split(':')[1] } : {};
		let tries = (await this.ctx.storage.get('tries')) || 0;
		// two ways of asking: with the JSON schema, then (if that could not be met) without
		for (const asJson of [true, false]) {
			const worst = worstCase(req, S);
			const r = await call('/reserve', { neurons: worst, who: night ? null : who, ...g });
			if (!r.ok) {
				if (r.reason === 'rate') return { status: 429, body: { error: 'slow down', fallback: 'atlas' } };
				if (r.reason === 'spot') return { status: 403, body: { error: 'this spot has its towns', fallback: 'atlas' } };
				return night ? { status: 503, body: { error: 'allowance', fallback: 'atlas' } } : this.keep(city, 'atlas', atlasBriefOf(city));
			}
			const res = await ask(this.env.AI, req, S, { json: asJson, schema: BRIEF_JSON_SCHEMA });
			const brief = res.value ? briefOf(res.value, city) : null;
			await call('/settle', { day: r.day, reserved: r.reserved, used: res.neurons, made: !!brief, exhausted: res.exhausted });
			if (brief) return this.keep(city, brief.source, brief);
			if (res.exhausted) return night ? { status: 503, body: { error: 'allowance', fallback: 'atlas' } } : this.keep(city, 'atlas', atlasBriefOf(city));
			await this.ctx.storage.put('tries', ++tries);
			if (tries >= TRIES) break;
		}
		if (night && tries < TRIES + 2) return { status: 503, body: { error: 'not made', fallback: 'atlas' } };
		return this.keep(city, 'atlas', atlasBriefOf(city));
	}

	async keep(city, source, brief) {
		const rec = { v: BRIEF_SCHEMA, id: city.id, source, brief: { ...brief, source }, made: today() };
		await this.ctx.storage.put('rec', rec);
		await this.ctx.storage.delete('tries');
		this.rec = rec;
		if (!city.gen) {
			const ledger = this.env.LEDGER.get(this.env.LEDGER.idFromName('ledger'));
			await ledger.fetch('https://ledger/done', { method: 'POST', body: JSON.stringify({ id: city.id }) }).catch(() => null);
		}
		return { status: 200, body: rec };
	}
}
