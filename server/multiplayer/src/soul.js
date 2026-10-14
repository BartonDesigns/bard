// A player's ledger outlives every room. The bearer key is never a public player id.
import { createMorality, AXES, RULES, MODIFIERS } from '../../../island/src/combat/morality.js';
import { SOUL_SITE, atSoulWell } from '../../../island/src/reputation/sanctuary.js';
export const SOUL_TOKEN = /^[a-f0-9]{64}$/;
export async function soulId(token) {
	return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(v => v.toString(16).padStart(2, '0')).join('');
}
const word = v => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 96) : '';
const safeKey = v => typeof v === 'string' && /^[A-Za-z0-9_ .,:-]{1,96}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
function deed(raw) {
	if (!raw || !/^[A-Za-z0-9:_-]{6,96}$/.test(raw.id || '') || !Object.hasOwn(RULES, raw.kind)) return null;
	return { id: raw.id, kind: raw.kind, target: word(raw.target), place: ['__proto__','constructor','prototype'].includes(raw.place) ? '' : word(raw.place), world: safeKey(raw.world) ? raw.world : 'here', region: word(raw.region), ctx: Object.fromEntries(Object.keys(MODIFIERS).filter(k => raw.ctx?.[k] === true).map(k => [k, true])) };
}
function migration(raw) {
	if (!raw?.me) return null;
	const axes = a => ({ ...Object.fromEntries(AXES.map(k => [k, Math.max(-100, Math.min(100, Number(a?.[k]) || 0))])), deeds: Math.max(0, Math.min(1e9, Math.trunc(Number(a?.deeds) || 0))) });
	const me = axes(raw.me), worlds = {}, places = {};
	for (const [k, v] of Object.entries(raw.worlds || {})) if (safeKey(k)) worlds[k] = axes(v);
	for (const [k, v] of Object.entries(raw.places || {})) if (safeKey(k)) places[k] = { good: Math.max(0, Math.min(1e12, Number(v.good) || 0)), harm: Math.max(0, Math.min(1e12, Number(v.harm) || 0)), last: word(v.last) };
	const log = (Array.isArray(raw.log) ? raw.log : []).slice(-200).flatMap(e => { const d = deed({ ...e, id: e.id || `legacy:${e.t}`, ctx: Object.fromEntries((Array.isArray(e.ctx) ? e.ctx : []).map(k => [k, true])) }); return d ? [{ ...d, t: Math.max(0, Number(e.t) || 0), epoch: 0, line: word(e.line), delta: Object.fromEntries(AXES.map(k => [k, Math.max(-200, Math.min(200, Number(e.delta?.[k]) || 0))])) }] : []; });
	return { me, worlds, places, log, epoch: 0, cleansedAt: 0, lifetime: me.deeds };
}
export class Soul {
	constructor(state) { this.state = state; this.chain = Promise.resolve(); }
	fetch(request) {
		const result = this.chain.then(() => this.handle(request));
		this.chain = result.catch(() => {}); return result;
	}
	async handle(request) {
		const url = new URL(request.url), store = this.state.storage;
		let saved = await store.get('ledger');
		if (saved?.format === 'chunks-v1') saved = JSON.parse((await Promise.all(Array.from({length:saved.parts},(_,i)=>store.get('ledger:'+i)))).join(''));
		const ledger = createMorality(); if (saved) ledger.restore(saved);
		const snapshot = () => ({ ledger: ledger.snapshot(), revision: revision });
		let revision = await store.get('revision') || 0;
		if (url.pathname === '/public') return Response.json({ ...ledger.me(), ...ledger.reactions(), epoch: ledger.info().epoch, cleansedAt: ledger.info().cleansedAt, revision });
		if (request.method === 'GET') return saved ? Response.json(snapshot()) : Response.json({ error: 'No saved soul yet.' }, { status: 404 });
		const text = await request.text();
		if (text.length > 524288) return Response.json({ error: 'Ledger too large.' }, { status: 413 });
		let b; try { b = JSON.parse(text); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
		if (!saved) {
			if (b.op !== 'sync') return Response.json({ error: 'Save your standing first.' }, { status: 409 });
			const initial = migration(b.legacy); if (initial) ledger.restore(initial);
		}
		if (b.epoch !== ledger.info().epoch) return Response.json({ ...snapshot(), error: 'Standing changed in another session.' }, { status: 409 });
		const writes = {};
		const budget = await store.get('budget') || { minute: -1, deeds: 0 };
		const minute = Math.floor(Date.now()/60000); if (budget.minute !== minute) { budget.minute = minute; budget.deeds = 0; }
		if (b.op === 'sync') {
			if (!Array.isArray(b.deeds) || b.deeds.length > 25) return Response.json({ error: 'Invalid batch.' }, { status: 400 });
			const deeds = b.deeds.map(deed); if (deeds.some(d => !d)) return Response.json({ error: 'Invalid deed.' }, { status: 400 });
			for (const d of deeds) {
				const key = `deed:${d.id}`;
				if (writes[key] || await store.get(key)) continue;
				writes[key] = ledger.record(d); revision++; budget.deeds++;
				if (budget.deeds > 600) return Response.json({ error: 'Your deeds are queued. Try saving again shortly.' }, { status: 429 });
			}
		} else if (b.op === 'begin') {
			if (!atSoulWell(b.pose)) return Response.json({ error: 'Enter the Quiet Well beneath Gargantua’s island.' }, { status: 403 });
			const challenge = { nonce: crypto.randomUUID(), at: Date.now(), epoch: b.epoch };
			await store.put('ritual', challenge);
			return Response.json({ ...challenge, seconds: SOUL_SITE.seconds });
		} else if (b.op === 'cleanse') {
			const receipt = await store.get(`cleansing:${b.nonce}`);
			if (receipt) return Response.json({ ...snapshot(), receipt });
			const challenge = await store.get('ritual'), now = Date.now();
			if (!atSoulWell(b.pose) || !challenge || b.nonce !== challenge.nonce || challenge.epoch !== b.epoch || now - challenge.at < SOUL_SITE.seconds * 1000 || now - challenge.at > 45000) return Response.json({ error: 'Remain at the well and complete the ritual.' }, { status: 403 });
			const next = { epoch: b.epoch + 1, at: now, nonce: b.nonce };
			ledger.cleanse(next); writes[`cleansing:${b.nonce}`] = next; revision++;
		} else return Response.json({ error: 'Unknown action.' }, { status: 400 });
		const json = JSON.stringify(ledger.snapshot());
		// Split large world/place ledgers below the KV value limit without dropping history.
		const parts = Math.ceil(json.length / 24000);
		for (let i=0;i<parts;i++) writes['ledger:'+i] = json.slice(i*24000,(i+1)*24000);
		writes.ledger = { format:'chunks-v1', parts }; writes.revision = revision; writes.budget = budget;
		const commit = async target => { const entries=Object.entries(writes); for(let i=0;i<entries.length;i+=64) await target.put(Object.fromEntries(entries.slice(i,i+64))); };
		if (store.transaction) await store.transaction(commit); else await commit(store);
		return Response.json(snapshot());
	}
}
