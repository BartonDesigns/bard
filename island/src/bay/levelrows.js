// Rows of a survey level's heights changed after it loaded (a lake let down, a river carved):
// only those rows go up to the graphics card again, but only once the level has been sent
// there whole. A level first sent with its rows marked was sent as just those rows (three.js
// allocates the texture and uploads only the marked ranges), the rest of it left empty: the
// ground there was drawn at sea level, under the ground walked on. Levels in use when the
// lakes were dug (round the island) had been sent already, so it showed only once you went
// out to the others (San Ramon, the East Bay, the South Bay).
//
//   trackUpload(tex)            on a new level's texture: notes when it has been sent whole
//   updateRows(tex, rows, W)    rows: the changed rows (a Set), W: the level's width

export function trackUpload(tex) {
	tex.userData.sent = false;
	tex.onUpdate = () => { tex.userData.sent = true; };
	tex.addEventListener('dispose', () => { tex.userData.sent = false; tex.clearUpdateRanges(); });
	return tex;
}

export function updateRows(tex, rows, W) {
	if (!tex || !rows.size) return;
	// (three.js counts a range in fours, as if RGBA: a row is W * 4)
	if (tex.userData.sent) for (const j of rows) tex.addUpdateRange(j * W * 4, W * 4);
	else tex.clearUpdateRanges();
	tex.needsUpdate = true;
}
