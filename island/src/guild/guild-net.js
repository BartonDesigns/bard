// Your guild on the rooms server (server/multiplayer/src/guild.js): one call per action, as the
// account you are signed in with (persistence/cloud-save.js credentials()). Without an account, or on
// a server that has no guilds yet, every call says so (notDeployed / needsAccount on the
// error) and the game keeps your guild on this device alone.

// url: the rooms server; auth(): { u, token } or null; request: fetch
export function createGuildNet({ url, auth, request = globalThis.fetch?.bind(globalThis) }) {
	const available = () => !!url && !!request;
	async function call(op, body = {}) {
		const A = auth?.();
		if (!available()) { const e = Error('Guilds are not available here.'); e.notDeployed = true; throw e; }
		if (!A?.u || !A.token) { const e = Error('Make an account first (☁ Save your progress) to share your guild with other players.'); e.needsAccount = true; throw e; }
		const controller = new AbortController(), t = setTimeout(() => controller.abort(), 15000);
		try {
			const r = await request(url.replace(/\/$/, '') + '/guilds/' + op, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + A.token }, body: JSON.stringify({ ...body, u: A.u }), signal: controller.signal });
			const data = await r.json().catch(() => ({}));
			if (!r.ok) {
				const e = Error(data.error || 'The server could not do that.');
				e.status = r.status;
				// (a server from before guilds: the route is not there, or the object is not bound)
				if (r.status === 404 && data.error === 'not found' || r.status === 503) { e.notDeployed = true; e.message = 'Guilds are not on the server yet. Your guild is kept on this device until they are.'; }
				if (r.status === 401) { e.needsAccount = true; e.message = 'Please log in again (☁ in the map pin menu).'; }
				throw e;
			}
			return data;
		} catch (e) {
			if (e.name === 'AbortError') throw Error('The server took too long. Try again.');
			if (e instanceof TypeError) { const x = Error('Could not reach the server. Try again in a moment.'); x.offline = true; throw x; }
			throw e;
		} finally { clearTimeout(t); }
	}
	return { available, call, mine: () => call('mine') };
}
