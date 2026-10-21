// Where a scoped rifle is looking, for anything in the world that wants to know (a building
// showing the room behind the window under the reticle). No imports, so world code can read it
// without pulling in the view.
//
// scopeView: one live object, refreshed every frame a scoped rifle is in hand by
// crysis/scope-optics.js, and let go (active false, aiming 0) the moment it is put away:
//   active    a scoped rifle is in hand
//   aiming    0..1, how far it is up at the eye (over 0.5: looking down the scope)
//   item      the rifle's id
//   mag       the scope's own magnification (on top of zoom)
//   zoom      the main camera's zoom at the sights
//   fov       the scope picture's field of view, in degrees
//   position, direction  the eye and where the scope points (a unit vector), as { x, y, z }
// onScopeCapture(fn) -> an unsubscribe: fn('before' | 'after', camera) round each drawing of the
// scope's own picture, with the camera it is drawn from.

export const scopeView = {
	active: false, aiming: 0, item: null, mag: 1, zoom: 1, fov: 0,
	position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 },
};

const listeners = new Set();
export function onScopeCapture(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}
export function scopeCapture(phase, camera) {
	for (const fn of listeners) { try { fn(phase, camera); } catch (e) { console.warn('scope capture hook', e); } }
}
// (the rifle put away, or no scope on it)
export function scopeGone() {
	scopeView.active = false; scopeView.aiming = 0; scopeView.item = null;
}
