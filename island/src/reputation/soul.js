import { createMorality } from '../combat/morality.js';
import { roomsURL } from '../net/config.js';
import { SOUL_FEATURE } from './sanctuary.js';

const KEY = 'l99-soul-v1', EVENT = 'l99-soul-deed:';
const tokenPattern = /^[a-f0-9]{64}$/;
const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join('');
export function createSoul({ morality, storage = globalThis.localStorage, url = roomsURL(), request = globalThis.fetch?.bind(globalThis), changed = () => {} } = {}) {
	let state, busy = null, due = 0, stopped = false, status = 'local', error = '', saving = true;
	const volatile = new Map();
	try { state = JSON.parse(storage.getItem(KEY)); } catch { /* new soul */ }
	if (!tokenPattern.test(state?.token || '')) state = { token: token(), base: morality.snapshot(), revision: -1 };
	function writeState() { try { storage.setItem(KEY, JSON.stringify(state)); saving = true; } catch { saving = false; error = 'This browser cannot save your soul. Keep this session open and save your recovery key.'; } }
	writeState();
	function pending() {
		const list = new Map(volatile);
		try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k?.startsWith(EVENT)) { const d = JSON.parse(storage.getItem(k)); if (d?.soul === state.token) list.set(d.id, d); } } } catch { saving = false; }
		return [...list.values()].sort((a,b) => a.t - b.t || a.id.localeCompare(b.id));
	}
	function forget(items) { for (const e of items) { volatile.delete(e.id); try { storage.removeItem(EVENT + e.id); } catch { saving = false; } } }
	function paint() {
		const view = createMorality(); view.restore(state.base);
		for (const d of pending()) if (d.epoch === (state.base.epoch || 0)) view.record(d);
		morality.restore(view.snapshot()); changed(info());
	}
	function receive(data, acknowledged = []) {
		if (!data?.ledger?.me || !Number.isSafeInteger(data.revision)) throw Error('The reputation server sent an incomplete save.');
		// An older tab/response must never roll the player back or undo a cleansing.
		try { const other = JSON.parse(storage.getItem(KEY)); if (other?.token === state.token && other.revision > state.revision) state = other; } catch { /* retain ours */ }
		if (data.revision < state.revision) return;
		state.base = data.ledger; state.revision = data.revision; writeState();
		forget(acknowledged);
		forget(pending().filter(e => e.epoch < (state.base.epoch || 0)));
		paint();
	}
	async function call(body, key = state.token) {
		const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
		try {
			const r = await request(url.replace(/\/$/, '') + '/souls/me', { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + key, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
			const data = await r.json();
			if (!r.ok && r.status !== 409) throw Error(r.status === 404 ? 'Cloud reputation is not available yet. Your deeds remain saved on this device.' : data.error || 'Could not save your standing.');
			return { data, conflict: r.status === 409 };
		} finally { clearTimeout(timer); }
	}
	function sync() {
		if (busy) return busy;
		if (!url || !request || stopped) return Promise.resolve(false);
		busy = (async () => {
			const savingSoul = state.token;
			try {
				status = 'saving';
				const batch = pending().filter(e => e.epoch === (state.base.epoch || 0)).slice(0, 25);
				const body = { op: 'sync', epoch: state.base.epoch || 0, deeds: batch.map(({ soul, t, ...d }) => d) };
				if (state.revision < 0) body.legacy = state.base;
				const { data, conflict } = await call(body, savingSoul);
				if (state.token !== savingSoul) return false;
				receive(data, conflict ? [] : batch); status = 'saved'; error = ''; due = Date.now() + (pending().length ? 1000 : 30000); changed(info()); return true;
			} catch (e) { if (state.token === savingSoul) { status = 'local'; error = e.message; due = Date.now() + 30000; changed(info()); } return false; }
			finally { busy = null; }
		})();
		return busy;
	}
	const unsubscribe = morality.on(e => {
		const d = { id: e.id, soul: state.token, epoch: e.epoch || 0, kind: e.kind, target: e.target, place: e.place, world: e.world, region: e.region, ctx: Object.fromEntries(e.ctx.map(k => [k, true])), t: e.t };
		volatile.set(d.id, d);
		try { storage.setItem(EVENT + d.id, JSON.stringify(d)); saving = true; } catch { saving = false; error = 'New deeds could not be saved on this device.'; }
		due = Math.min(due, Date.now() + 750);
	});
	function info() { return { status, savedLocally: saving, pending: pending().length, revision: state.revision, epoch: state.base.epoch || 0, cleansedAt: state.base.cleansedAt || 0, error, feature: SOUL_FEATURE }; }
	async function begin(pose) {
		while (pending().length) { if (!await sync()) throw Error('Save your standing before cleansing. Check your connection.'); }
		if (!await sync()) throw Error('The Quiet Well needs a connection to remember your cleansing.');
		const { data, conflict } = await call({ op: 'begin', epoch: state.base.epoch || 0, pose });
		if (conflict) { receive(data); throw Error('Your standing changed. Start the ritual again.'); }
		return data;
	}
	async function cleanse(challenge, pose) {
		if (pending().length) throw Error('A new deed interrupted the ritual. Begin again.');
		const { data, conflict } = await call({ op: 'cleanse', epoch: challenge.epoch, nonce: challenge.nonce, pose });
		if (conflict && (data.ledger?.epoch || 0) <= challenge.epoch) throw Error('Begin the ritual again.');
		receive(data); status = 'saved'; error = ''; changed(info()); return true;
	}
	async function recover(key) {
		key = String(key || '').trim(); if (!tokenPattern.test(key)) throw Error('That recovery key is not valid.');
		if (busy) await busy; // A prior identity's save must finish before switching souls.
		const { data } = await call(null, key);
		if (!data.ledger) throw Error('No soul was found for that key.');
		// The old soul and its queued deeds remain on the server/device; this switches identity.
		state = { token: key, base: data.ledger, revision: data.revision }; status = 'saved'; error = ''; due = Date.now() + 30000; writeState(); paint(); changed(info());
	}
	paint();
	return { sync, begin, cleanse, recover, info, recoveryKey: () => state.token, credentials: () => state.token,
		update() { if (Date.now() >= due) { due = Date.now() + 30000; void sync(); } },
		dispose() { stopped = true; unsubscribe(); },
	};
}
