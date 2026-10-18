// What kind of device this is, and what it is asked to draw. PHONE_DEVICE is the device itself:
// touch controls, labels, memory safety and the guide's voice follow it. GFX_PHONE is the graphics'
// own idea of a phone: the lighter meshes, textures and shader paths. The Ultra setting
// (l99-quality 'ultra', read once at load) asks a phone for the full desktop graphics, so there
// GFX_PHONE is false while PHONE_DEVICE stays true.
const nav = typeof navigator !== 'undefined' ? navigator : null;
export const PHONE_DEVICE = !!nav && (/iPhone|iPad|iPod|Android|Mobile/i.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
export const ULTRA = (() => { try { return globalThis.localStorage?.getItem('l99-quality') === 'ultra'; } catch { return false; } })();
export const GFX_PHONE = PHONE_DEVICE && !ULTRA;
// a coarse pointer (most tablets and touch laptops) is drawn as a phone too, unless Ultra is on
export const GFX_COARSE = !ULTRA && (PHONE_DEVICE || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
