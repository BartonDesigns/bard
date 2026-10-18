// What kind of device this is, and what it is asked to draw. PHONE_DEVICE is the device itself:
// touch controls, labels, memory safety and the guide's voice follow it. GFX_PHONE is the graphics'
// own idea of a phone: the lighter meshes, textures and shader paths. The Ultra setting
// (l99-quality 'ultra', read once at load) asks a phone for the full desktop graphics, so there
// GFX_PHONE is false while PHONE_DEVICE stays true.
const nav = typeof navigator !== 'undefined' ? navigator : null;
export const PHONE_DEVICE = !!nav && (/iPhone|iPad|iPod|Android|Mobile/i.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
const store = (() => { try { return globalThis.localStorage || null; } catch { return null; } })();
const ultraAsked = (() => { try { return store?.getItem('l99-quality') === 'ultra'; } catch { return false; } })();
// A phone on Ultra whose last visit ended without a goodbye (the browser closed the page, most
// likely for its memory: world/governor.js keeps that mark, and sets it while a world loads too)
// comes back without it, on Auto: the desktop's graphics are more than a phone can always hold,
// and the page closing as the world finished loading left no way to reach the setting again.
export const ULTRA_DROPPED = PHONE_DEVICE && ultraAsked && (() => {
	try { return !!JSON.parse(store?.getItem('l99-governor') || 'null')?.live; } catch { return false; }
})();
if (ULTRA_DROPPED) { try { store.setItem('l99-quality', 'auto'); } catch { /* private mode */ } }
export const ULTRA = ultraAsked && !ULTRA_DROPPED;
export const GFX_PHONE = PHONE_DEVICE && !ULTRA;
// a coarse pointer (most tablets and touch laptops) is drawn as a phone too, unless Ultra is on
export const GFX_COARSE = !ULTRA && (PHONE_DEVICE || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
