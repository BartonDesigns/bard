// Your progress in the cloud: a username and password on the rooms server (server/multiplayer
// src/account.js), and everything this site keeps about your play (skills, honor, gear, quests,
// your home, your standing) saved there while you play, so clearing the browser, or a new
// phone, loses nothing. Logging in on another device brings it back.
//
// What is saved is every key the site keeps in this browser's storage, less what belongs to
// the device alone (graphics settings, caches, this browser's room id) and this file's own.
// A restore is staged (RESTORE_KEY) and applied at the very top of the page on its next load
// (index.html), before anything else reads storage, so nothing running now can write over it.
//
// Password reset: a recovery code shown once at sign-up (and again after each reset) sets a
// new password. The server keeps only hashes of passwords, codes and session keys.

// a rooms server that keeps accounts (its /status features)
export const ACCOUNT_FEATURE = 'accounts-v1';
export const ACCOUNT_KEY = 'l99-account-v1';
export const RESTORE_KEY = 'l99-account-restore';
export const USERNAME_RE = /^[a-z0-9_-]{3,20}$/;
export const PASSWORD_MIN = 8, PASSWORD_MAX = 128;
export const RECOVERY_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
// the most a save may hold (characters of JSON), and the most one key may (a bigger one is a cache)
export const SAVE_MAX = 3_000_000, KEY_MAX = 512_000;
// how often a changed save goes up while you play
export const AUTOSAVE_MS = 60_000;

export const cleanUsername = (u) => (typeof u === 'string' ? u.trim().toLowerCase() : '');
export const usernameOk = (u) => USERNAME_RE.test(cleanUsername(u));
export const passwordOk = (p) => typeof p === 'string' && p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX;
// a recovery code as typed: upper case, dashes where they belong
export function cleanRecovery(c) {
	const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
	return s.length === 16 ? s.match(/.{4}/g).join('-') : '';
}

// keys that belong to this device, not to you
const DEVICE = [
	ACCOUNT_KEY, RESTORE_KEY, 'l99-mp-id',
	/^l99-(quality|gpu|gl-lost|governor|frame-errors|hq-only|floor-gpu|floor-wide|signage-lite|touch|tools-open|still|big|island-mount)/,
	/^island-(terrain|grass)/, /^crysis-(guide-model|guide-loaded|llm-working|voice-loading|voice-unable|local-voice-slow|ledger-url)/,
];
export const isProgressKey = (k) => typeof k === 'string' && !!k && !DEVICE.some((d) => (typeof d === 'string' ? d === k : d.test(k)));

// everything worth saving in `storage`: { keys: { key: value }, skipped: [too big] }
export function collect(storage) {
	const keys = {}, skipped = [];
	for (let i = 0; i < storage.length; i++) {
		const k = storage.key(i);
		if (!isProgressKey(k)) continue;
		const v = storage.getItem(k);
		if (typeof v !== 'string') continue;
		if (v.length > KEY_MAX) { skipped.push(k); continue; }
		keys[k] = v;
	}
	return { keys, skipped };
}
// a short fingerprint of a save, to tell when it changed
export function fingerprint(text) {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
	return (h >>> 0).toString(36) + ':' + text.length;
}
// a few words on what a save holds, for "load this?" (your level, when)
export function describe(keys) {
	let level = 0, honor = 0;
	try { const m = JSON.parse(keys?.['l99-magic'] || 'null'); level = m?.level || 0; honor = m?.honor?.pts || 0; } catch { /* not magic */ }
	return { level, honor, keys: Object.keys(keys || {}).length };
}

// a restore, staged for the next load: the keys to set and the progress keys to remove
export function stageRestore(storage, keys) {
	const remove = [];
	for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (isProgressKey(k) && !(k in keys)) remove.push(k); }
	storage.setItem(RESTORE_KEY, JSON.stringify({ set: keys, remove }));
}
// the staged restore applied (index.html runs the same few lines inline, first thing). Returns
// whether there was one.
export function applyRestore(storage) {
	const raw = storage.getItem(RESTORE_KEY);
	if (!raw) return false;
	storage.removeItem(RESTORE_KEY);
	let r;
	try { r = JSON.parse(raw); } catch { return false; }
	for (const k of r.remove || []) storage.removeItem(k);
	for (const [k, v] of Object.entries(r.set || {})) storage.setItem(k, v);
	return true;
}

// ---------- the client ----------
// url: the rooms server; request: fetch; reload(): the page loaded again (a restore applied)
export function createCloudSave({ url, storage = globalThis.localStorage, request = globalThis.fetch?.bind(globalThis), reload = () => location.reload(), now = () => Date.now(), changed = () => {} } = {}) {
	let me = null, timer = null, busy = false, lastError = '', lastSig = '';
	try { me = JSON.parse(storage.getItem(ACCOUNT_KEY) || 'null'); } catch { me = null; }
	if (!me || !usernameOk(me.u) || typeof me.token !== 'string') me = null;
	const keep = () => { try { if (me) storage.setItem(ACCOUNT_KEY, JSON.stringify(me)); else storage.removeItem(ACCOUNT_KEY); } catch { /* private mode */ } changed(info()); };
	const available = () => !!url && !!request;

	async function call(path, body, auth = true) {
		if (!available()) throw Error('Accounts are not available yet.');
		const controller = new AbortController(), t = setTimeout(() => controller.abort(), 20000);
		try {
			const r = await request(url.replace(/\/$/, '') + '/account/' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth && me ? { authorization: 'Bearer ' + me.token } : {}) }, body: JSON.stringify({ u: me?.u, ...body }), signal: controller.signal, keepalive: path === 'save' && JSON.stringify(body).length < 60000 });
			const data = await r.json().catch(() => ({}));
			if (r.status === 401 && auth) { me = null; keep(); }
			if (!r.ok) { const e = Error(data.error || (r.status === 404 ? 'Accounts are not on the server yet.' : 'The server could not do that.')); e.status = r.status; e.data = data; throw e; }
			return data;
		} catch (e) {
			if (e.name === 'AbortError') throw Error('The server took too long. Try again.');
			if (e instanceof TypeError) throw Error('Could not reach the server. Your progress is still saved on this device.');
			throw e;
		} finally { clearTimeout(t); }
	}
	// this device's progress, up to the cloud. force: even unchanged; over: past a newer save
	async function save({ force = false, over = false } = {}) {
		if (!me || busy) return { skipped: true };
		if (me.conflict && !over) return { conflict: true, at: me.conflict };
		const { keys, skipped } = collect(storage), text = JSON.stringify(keys), sig = fingerprint(text);
		if (!force && sig === lastSig) return { unchanged: true };
		if (text.length > SAVE_MAX) { lastError = 'Your progress is too big to save to the cloud.'; changed(info()); return { error: lastError }; }
		busy = true;
		try {
			const r = await call('save', { data: text, base: over ? -1 : me.rev ?? 0, at: now(), summary: describe(keys) });
			me.rev = r.rev; me.savedAt = r.at; delete me.conflict; lastSig = sig; lastError = ''; keep();
			return { ok: true, rev: r.rev, skipped };
		} catch (e) {
			// saved from another device since: that one is newer
			if (e.status === 409) { lastError = 'Newer progress was saved from another device.'; me.conflict = e.data?.at || now(); keep(); return { conflict: true, at: e.data?.at }; }
			lastError = e.message; changed(info());
			return { error: e.message };
		} finally { busy = false; }
	}
	// the cloud's progress, staged for this device, and the page loaded again
	async function load() {
		const r = await call('load', {});
		if (!r.data) return { empty: true };
		let keys;
		try { keys = JSON.parse(r.data); } catch { throw Error('The saved progress could not be read.'); }
		stageRestore(storage, keys);
		me.rev = r.rev; me.savedAt = r.at; delete me.conflict; keep();
		reload();
		return { ok: true };
	}
	// what the cloud holds, without loading it: { at, rev, level, honor } or null
	async function peek() { const r = await call('peek', {}); return r.at ? r : null; }
	// signed in. Progress already in the cloud waits for your choice (load it, or keep this
	// device's): until then nothing from this device is saved over it
	function begin(u, r) { me = { u: cleanUsername(u), token: r.token, rev: r.rev ?? 0, savedAt: r.at || 0, ...(r.at ? { conflict: r.at } : {}) }; lastSig = ''; keep(); }
	const api = {
		available, info,
		// a new account, this device's progress its first save. Returns { recovery }.
		async signup(u, p) {
			if (!usernameOk(u)) throw Error('A username is 3 to 20 letters, digits, - or _.');
			if (!passwordOk(p)) throw Error(`A password is at least ${PASSWORD_MIN} characters.`);
			const { keys } = collect(storage);
			const r = await call('signup', { u: cleanUsername(u), p, summary: describe(keys) }, false);
			begin(u, r);
			await save({ force: true });
			return { recovery: r.recovery };
		},
		// logged in: { saved: { at, level, honor } | null }, for the choice of which progress to keep
		async login(u, p) {
			if (!usernameOk(u) || !passwordOk(p)) throw Error('That username and password do not match.');
			const r = await call('login', { u: cleanUsername(u), p }, false);
			begin(u, r);
			return { saved: r.at ? { at: r.at, rev: r.rev, ...r.summary } : null };
		},
		// a new password with the recovery code: logged in, and a new code to keep
		async reset(u, code, p) {
			const c = cleanRecovery(code);
			if (!usernameOk(u) || !c) throw Error('Type your username and the 16-character recovery code.');
			if (!passwordOk(p)) throw Error(`A password is at least ${PASSWORD_MIN} characters.`);
			const r = await call('reset', { u: cleanUsername(u), code: c, p }, false);
			begin(u, r);
			return { recovery: r.recovery, saved: r.at ? { at: r.at, rev: r.rev, ...r.summary } : null };
		},
		async logout() { if (me) { await save().catch(() => {}); await call('logout', {}).catch(() => {}); } me = null; lastSig = ''; keep(); },
		save, load, peek,
		// keep it saved while you play: every AUTOSAVE_MS when it changed, and as the page hides
		start() {
			if (timer) return;
			timer = setInterval(() => { if (me && !me.conflict) save(); }, AUTOSAVE_MS);
			try { addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && me && !me.conflict) save(); }); } catch { /* no page */ }
		},
		stop() { clearInterval(timer); timer = null; },
	};
	function info() { return { available: available(), user: me?.u || '', savedAt: me?.savedAt || 0, rev: me?.rev ?? 0, conflict: me?.conflict || 0, error: lastError, busy }; }
	return api;
}
