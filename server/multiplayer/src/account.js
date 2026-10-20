// One player's account: a Durable Object per username ('user:<name>'), holding a hash of their
// password and of their recovery code, the hashes of their signed-in sessions, and their saved
// progress (island/src/persistence/cloud-save.js), in pieces under the storage value limit.
// No email and nothing else about the person: a username, and what they did in the game.
//
//   POST signup { u, p, summary }       -> { token, recovery, rev: 0, at: 0 }
//   POST login  { u, p }                -> { token, rev, at, summary }
//   POST reset  { u, code, p }          -> { token, recovery, rev, at, summary } (old sessions end)
//   POST save   { data, base, at, summary } (session) -> { rev, at }, or 409 { rev, at } when
//               another device saved since `base` (base -1: save over it anyway)
//   POST load   (session) -> { data, rev, at }
//   POST peek   (session) -> { rev, at, summary }
//   POST logout (session) -> {}
//   POST whoami (session) -> { u, name }   (only from src/index.js, for the guilds: not a public route)
import { usernameOk, passwordOk, cleanUsername, RECOVERY_RE, SAVE_MAX } from '../../../island/src/persistence/cloud-save.js';

// PBKDF2 rounds (kept per account, so it can rise later): the Workers Free plan's CPU budget
// allows only a few; the lockout below is what stops guessing
export const ROUNDS = 20000;
export const FAILS_MAX = 8, LOCK_MS = 15 * 60 * 1000, SESSIONS_MAX = 8, SESSION_MS = 400 * 24 * 3600 * 1000;
const PART = 60000;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const hex = (b) => [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
const random = (n) => crypto.getRandomValues(new Uint8Array(n));
export const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
export async function pbkdf2(secret, salt, rounds = ROUNDS, pepper = '') {
	const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper + '|' + secret), 'PBKDF2', false, ['deriveBits']);
	return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: rounds }, k, 256));
}
// (compared without stopping at the first difference)
function same(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
	let d = 0;
	for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return d === 0;
}
export function newRecovery() {
	const b = random(16);
	return [...b].map((v) => ALPHA[v % ALPHA.length]).join('').match(/.{4}/g).join('-');
}
const summaryOf = (s) => ({ level: Math.max(0, Math.min(9999, Math.floor(+s?.level || 0))), honor: Math.max(0, Math.min(1e9, Math.floor(+s?.honor || 0))), keys: Math.max(0, Math.min(1e5, Math.floor(+s?.keys || 0))) });
const json = (v, status = 200) => Response.json(v, { status });

export class Account {
	constructor(state, env = {}) { this.state = state; this.env = env; this.chain = Promise.resolve(); }
	// one request at a time, so two saves cannot cross
	fetch(request) { const r = this.chain.then(() => this.handle(request)); this.chain = r.catch(() => {}); return r; }
	async session(user, token) {
		const S = (await this.state.storage.get('sessions')) || [], now = Date.now();
		const live = S.filter((x) => now - x.at < SESSION_MS);
		const h = typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? await sha256(token) : '';
		const s = h && live.find((x) => same(x.h, h));
		if (!s) return null;
		s.used = now;
		await this.state.storage.put('sessions', live);
		return s;
	}
	async open() {
		const token = hex(random(32)), S = ((await this.state.storage.get('sessions')) || []).filter((x) => Date.now() - x.at < SESSION_MS);
		S.push({ h: await sha256(token), at: Date.now(), used: Date.now() });
		while (S.length > SESSIONS_MAX) S.shift();
		await this.state.storage.put('sessions', S);
		return token;
	}
	async meta() { return (await this.state.storage.get('save')) || { rev: 0, at: 0, parts: 0, summary: summaryOf(null) }; }
	async handle(request) {
		const url = new URL(request.url), op = url.pathname.replace(/^\//, ''), store = this.state.storage, pepper = this.env.ACCOUNT_PEPPER || '';
		let b;
		try { b = JSON.parse(await request.text()); } catch { return json({ error: 'Invalid request.' }, 400); }
		const u = cleanUsername(b?.u);
		if (!usernameOk(u)) return json({ error: 'A username is 3 to 20 letters, digits, - or _.' }, 400);
		const user = await store.get('user');
		const now = Date.now();
		if (op === 'signup') {
			if (user) return json({ error: 'That username is taken.' }, 409);
			if (!passwordOk(b.p)) return json({ error: 'A password is at least 8 characters.' }, 400);
			const salt = hex(random(16)), rsalt = hex(random(16)), recovery = newRecovery();
			await store.put('user', { u, salt, hash: await pbkdf2(b.p, salt, ROUNDS, pepper), rounds: ROUNDS, rsalt, rhash: await sha256(rsalt + '|' + recovery), created: now, fails: 0, lockUntil: 0 });
			return json({ token: await this.open(), recovery, rev: 0, at: 0 });
		}
		if (!user) return json({ error: op === 'login' || op === 'reset' ? 'That username and password do not match.' : 'Please log in again.' }, op === 'login' || op === 'reset' ? 403 : 401);
		if (op === 'login' || op === 'reset') {
			if (user.lockUntil > now) return json({ error: `Too many tries. Try again in ${Math.ceil((user.lockUntil - now) / 60000)} minutes.` }, 429);
			let good;
			if (op === 'login') good = passwordOk(b.p) && same(await pbkdf2(b.p, user.salt, user.rounds || ROUNDS, pepper), user.hash);
			else good = RECOVERY_RE.test(b.code || '') && same(await sha256(user.rsalt + '|' + b.code), user.rhash);
			if (!good) {
				user.fails = (user.fails || 0) + 1;
				if (user.fails >= FAILS_MAX) { user.fails = 0; user.lockUntil = now + LOCK_MS; }
				await store.put('user', user);
				return json({ error: op === 'login' ? 'That username and password do not match.' : 'That recovery code does not match.' }, 403);
			}
			user.fails = 0; user.lockUntil = 0;
			let recovery;
			if (op === 'reset') {
				if (!passwordOk(b.p)) return json({ error: 'A password is at least 8 characters.' }, 400);
				user.salt = hex(random(16)); user.hash = await pbkdf2(b.p, user.salt, ROUNDS, pepper); user.rounds = ROUNDS;
				recovery = newRecovery(); user.rsalt = hex(random(16)); user.rhash = await sha256(user.rsalt + '|' + recovery);
				// (a reset signs everyone else out)
				await store.put('sessions', []);
			}
			await store.put('user', user);
			const M = await this.meta();
			return json({ token: await this.open(), ...(recovery ? { recovery } : {}), rev: M.rev, at: M.at, summary: M.summary });
		}
		// ---------- signed in ----------
		const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
		if (!(await this.session(user, token))) return json({ error: 'Please log in again.' }, 401);
		const M = await this.meta();
		if (op === 'peek') return json({ rev: M.rev, at: M.at, summary: M.summary });
		// (who this session is: the guilds ask, src/index.js)
		if (op === 'whoami') return json({ u: user.u, name: user.name || '' });
		if (op === 'logout') {
			const h = await sha256(token);
			await store.put('sessions', ((await store.get('sessions')) || []).filter((x) => !same(x.h, h)));
			return json({});
		}
		if (op === 'load') {
			if (!M.parts) return json({ data: null, rev: M.rev, at: M.at });
			const parts = await Promise.all(Array.from({ length: M.parts }, (_, i) => store.get('save:' + i)));
			return json({ data: parts.join(''), rev: M.rev, at: M.at });
		}
		if (op === 'save') {
			if (typeof b.data !== 'string' || b.data.length > SAVE_MAX) return json({ error: 'That save is too big.' }, 413);
			try { const o = JSON.parse(b.data); if (!o || typeof o !== 'object' || Array.isArray(o) || Object.values(o).some((v) => typeof v !== 'string')) throw 0; } catch { return json({ error: 'That save could not be read.' }, 400); }
			if (b.base !== -1 && b.base !== M.rev) return json({ error: 'Newer progress was saved from another device.', rev: M.rev, at: M.at }, 409);
			const parts = Math.ceil(b.data.length / PART), writes = {};
			for (let i = 0; i < parts; i++) writes['save:' + i] = b.data.slice(i * PART, (i + 1) * PART);
			const next = { rev: M.rev + 1, at: now, parts, summary: summaryOf(b.summary) };
			writes.save = next;
			const commit = async (t) => { const E = Object.entries(writes); for (let i = 0; i < E.length; i += 64) await t.put(Object.fromEntries(E.slice(i, i + 64))); };
			if (store.transaction) await store.transaction(commit); else await commit(store);
			for (let i = parts; i < M.parts; i++) await store.delete('save:' + i);
			return json({ rev: next.rev, at: next.at });
		}
		return json({ error: 'Unknown action.' }, 400);
	}
}
