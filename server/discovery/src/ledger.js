// The ledger: one Durable Object for the whole server. It keeps the day's Neurons (used and
// promised to calls under way) inside the free allowance, the players' rate limits, how many
// town names one spot may have, and which atlas cities are done (for the nightly round).
//
// The day is the allowance's day (it resets at 00:00 UTC). Before a call the worst it could
// cost is reserved; after it the reservation is swapped for what it did cost. A call is only
// made while used + reserved + its worst case stays under DAILY_NEURONS, so the day can never
// pass it. Rate limits are kept in memory only, by a salted hash of the address: no address
// is ever stored.

const today = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });

export class Ledger {
	constructor(ctx, env) {
		this.ctx = ctx;
		this.env = env;
		this.S = null;               // { day: { key, used, reserved, gens, exhausted }, cells: {}, done: [] }
		this.rate = new Map();       // address hash -> { n, t0 }
		this.clock = () => Date.now();
	}
	get cap() { const v = +this.env.DAILY_NEURONS; return Number.isFinite(v) && v >= 0 ? Math.min(v, 9500) : 8000; }
	get perHour() { const v = +this.env.RATE_PER_HOUR; return Number.isFinite(v) && v > 0 ? v : 12; }
	// talking with the townsfolk has its own share of the day (never more than the day's
	// ceiling) and its own, looser, hourly limit
	get talkCap() { const v = +this.env.TALK_NEURONS; return Math.min(this.cap, Number.isFinite(v) && v >= 0 ? v : 3000); }
	get talkPerHour() { const v = +this.env.TALK_PER_HOUR; return Number.isFinite(v) && v > 0 ? v : 60; }

	async load() {
		if (!this.S) {
			const [day, cells, done] = await Promise.all(['day', 'cells', 'done'].map((k) => this.ctx.storage.get(k)));
			if (!this.S) this.S = { day: day || null, cells: cells || {}, done: done || [] };
		}
		const k = today(this.clock());
		if (this.S.day?.key !== k) this.S.day = { key: k, used: 0, reserved: 0, gens: 0, exhausted: false, talkUsed: 0, talkReserved: 0, talks: 0 };
		this.S.day.talkUsed ??= 0; this.S.day.talkReserved ??= 0; this.S.day.talks ??= 0;
		return this.S;
	}
	save(...keys) { return Promise.all(keys.map((k) => this.ctx.storage.put(k, this.S[k]))); }

	async fetch(request) {
		const path = new URL(request.url).pathname;
		const S = await this.load(), D = S.day;
		const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
		if (path === '/state') return json({ day: D.key, used: D.used, reserved: D.reserved, cap: this.cap, left: Math.max(0, this.cap - D.used - D.reserved), gens: D.gens, exhausted: D.exhausted, done: S.done.length, talk: { used: D.talkUsed, cap: this.talkCap, left: Math.max(0, this.talkCap - D.talkUsed - D.talkReserved), talks: D.talks } });
		if (path === '/reserve') {
			// a player's call: their hourly limit first, then the spot's names
			const talk = body.kind === 'talk';
			if (body.who) {
				const key = (talk ? 'talk:' : '') + body.who, lim = talk ? this.talkPerHour : this.perHour;
				const t = this.clock(), r = this.rate.get(key);
				if (r && t - r.t0 < 3600e3 && r.n >= lim) return json({ ok: false, reason: 'rate' });
				if (!r || t - r.t0 >= 3600e3) this.rate.set(key, { n: 1, t0: t }); else r.n++;
				if (this.rate.size > 5000) for (const [k, v] of this.rate) if (t - v.t0 >= 3600e3) this.rate.delete(k);
			}
			if (body.cell) {
				const L = S.cells[body.cell] || [];
				if (!L.includes(body.slug) && L.length >= 2) return json({ ok: false, reason: 'spot' });
			}
			const n = Math.max(0, Math.ceil(+body.neurons || 0));
			if (D.exhausted || D.used + D.reserved + n > this.cap) return json({ ok: false, reason: 'allowance', day: D.key });
			if (talk && D.talkUsed + D.talkReserved + n > this.talkCap) return json({ ok: false, reason: 'allowance', day: D.key });
			D.reserved += n;
			if (talk) D.talkReserved += n;
			if (body.cell && !(S.cells[body.cell] || []).includes(body.slug)) { (S.cells[body.cell] ||= []).push(body.slug); await this.save('cells'); }
			await this.save('day');
			return json({ ok: true, day: D.key, reserved: n });
		}
		if (path === '/settle') {
			// a reservation made on an earlier day was already forgotten at midnight; what the call
			// used still counts against today (a call that ran over midnight is counted twice, never less)
			if (body.day === D.key) D.reserved = Math.max(0, D.reserved - (+body.reserved || 0));
			D.used += Math.max(0, Math.ceil(+body.used || 0));
			if (body.kind === 'talk') {
				if (body.day === D.key) D.talkReserved = Math.max(0, D.talkReserved - (+body.reserved || 0));
				D.talkUsed += Math.max(0, Math.ceil(+body.used || 0));
				D.talks++;
			}
			if (body.made) D.gens++;
			if (body.exhausted) D.exhausted = true;
			await this.save('day');
			return json({ ok: true });
		}
		if (path === '/done') {
			if (typeof body.id === 'string' && !S.done.includes(body.id)) { S.done.push(body.id); await this.save('done'); }
			return json({ ok: true });
		}
		if (path === '/done-list') return json({ done: S.done });
		return json({ error: 'not found' }, 404);
	}
}
