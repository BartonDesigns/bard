// The order things sit on a surface, nearest the wall first: the surface itself, the grime
// the years leave on it, paint (tags, pieces, a crew's buff), posters and sign faces, stickers,
// and stickers slapped over stickers. Each layer is lifted a little further off its host and
// biased a little further toward the eye in the depth test, and drawn after the one under it;
// the decals write no depth, so where two overlap the later one is simply on top, at any
// distance and on any depth buffer (a phone's 16-bit one included). The lift is a few
// millimetres, never enough to see a gap; the bias is in the depth buffer's own steps, so it
// holds far off where the lift alone would not.

export const LAYER = Object.freeze({ surface: 0, grime: 1, paint: 2, poster: 3, sticker: 4, overSticker: 5 });
export const LAYER_NAMES = Object.freeze(Object.keys(LAYER));
// renderOrder of the first decal layer: after the opaque world and the glass (renderOrder 0)
export const DECAL_ORDER = 20;

// lift (metres off the host along its normal), polygonOffset factor and units, renderOrder
export function layerBias(layer, { phone = false } = {}) {
	const k = Math.max(0, Math.min(LAYER.overSticker, layer | 0));
	// (a phone's depth steps are coarser: a little more lift and a bigger step between layers)
	const lift = k === 0 ? 0 : (phone ? 0.005 : 0.003) + (k - 1) * (phone ? 0.0025 : 0.0015);
	const units = k === 0 ? 0 : -(phone ? 6 : 3) * (k + 1);
	const factor = k === 0 ? 0 : -1 - k * 0.25;
	return { layer: k, lift, factor, units, renderOrder: DECAL_ORDER + k };
}
