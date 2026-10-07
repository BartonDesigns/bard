// Where the rooms server is (server/multiplayer), e.g. 'https://l99-rooms.<account>.workers.dev'.
// Empty until it is deployed: then there is no Invite or Join, and nothing connects.
export const ROOMS_URL = '';

// on a page served from this computer, ?rooms=http://localhost:8790 points at a local server
// (only there: a link can never send a player's moves somewhere else)
export function roomsURL() {
	try {
		const q = new URLSearchParams(location.search).get('rooms');
		if (q && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?\/?$/.test(q)) return q;
		if (new URLSearchParams(location.search).has('offline')) return '';
	} catch { /* no page */ }
	return ROOMS_URL;
}
