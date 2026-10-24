// Small, local vector assets: readable on phones without texture uploads or GPU effects.
const PATHS = Object.freeze({
	mastery: '<path d="M7 24V10l9 3 9-3v14l-9 3zM16 13v14M9 7l7 3 7-3"/>',
	twilight: '<path d="M20 5a11 11 0 1 0 7 18A11 11 0 0 1 20 5Z"/><path d="m16 11-5 8h5l-1 6 7-10h-6z"/>',
	giants: '<path d="m5 26 5-16 6-5 6 5 5 16zM10 10l6 7 6-7M12 23h8M16 17v6"/>',
	wells: '<path d="M5 20c0-5 22-5 22 0s-22 5-22 0Zm0 0v6c0 5 22 5 22 0v-6M16 3c0 5-5 7-5 10a5 5 0 0 0 10 0c0-3-5-5-5-10Z"/>',
	mercy: '<path d="M9 18V9a2 2 0 0 1 4 0v8-12a2 2 0 0 1 4 0v12-10a2 2 0 0 1 4 0v11-7a2 2 0 0 1 4 0v9c0 6-4 10-9 10-4 0-7-3-9-6l-4-6a2 2 0 0 1 3-3l5 5"/>',
	heirloom: '<path d="m16 3 4 5-2 13h-4L12 8zM9 21h14M16 21v7M13 29h6"/>',
	regalia: '<path d="m5 9 6 5 5-9 5 9 6-5-3 15H8zM8 28h16M11 20h.1M16 20h.1M21 20h.1"/>',
});
export const TRIAL_EMBLEM_IDS = Object.freeze(Object.keys(PATHS));
export function trialEmblem(id, done = false) {
	const path = PATHS[id];
	if (!path) return '';
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false" fill="none" stroke="${done ? '#ffd27a' : '#b8a885'}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${path}</svg>`;
}
