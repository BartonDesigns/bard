// The page's own copy of a picture, let go once the graphics hold it. three keeps every
// texture's image (a canvas, an ImageBitmap, an <img>) for as long as the texture lives, so a
// phone holds each picture twice: in the graphics' memory and again as the canvas or bitmap it
// came from. A picture nothing on the page reads again (a car model's paint, a head kit's
// atlas) can be let go the moment it has been uploaded; the graphics card keeps drawing it
// exactly as before.
// The one time the page would need it back is when the graphics are lost: three rebuilds its
// buffers from the images on restore. So a shed picture comes with a way to get it again
// (reload(): the file is in the browser's cache), called for every shed texture as soon as the
// loss is known (main.js, webglcontextlost), before the first restored frame asks. Until the
// picture is back the texture shows its average colour (a 1x1 pixel), a moment in a frame
// that is already being rebuilt; once back it is uploaded and shed again.

const shed = new Map();   // texture -> { reload, busy }
let placeholderCanvas = null;

// a 1x1 picture of the image's average colour (the browser scales it down for us)
function averagePixel(image) {
	try {
		if (!placeholderCanvas) { placeholderCanvas = document.createElement('canvas'); placeholderCanvas.width = placeholderCanvas.height = 1; }
		const g = placeholderCanvas.getContext('2d', { willReadFrequently: true });
		g.clearRect(0, 0, 1, 1);
		g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
		g.drawImage(image, 0, 0, 1, 1);
		const px = g.getImageData(0, 0, 1, 1).data;
		const cv = document.createElement('canvas');
		cv.width = cv.height = 1;
		const c = cv.getContext('2d');
		c.fillStyle = `rgba(${px[0]},${px[1]},${px[2]},${(px[3] / 255).toFixed(3)})`;
		c.fillRect(0, 0, 1, 1);
		return cv;
	} catch { return null; }
}

// Lets texture's image go after its next upload; reload() returns (a promise of) the image
// again. A texture whose image is read by the page (drawn from, measured) must not be shed.
// on: false leaves the texture as it is (a laptop has the memory, and keeps the simpler path).
export function shedImage(texture, reload, { on = true } = {}) {
	if (!on || !texture || !texture.isTexture || shed.has(texture)) return texture;
	shed.set(texture, { reload, busy: null });
	const before = texture.onUpdate;
	texture.onUpdate = (t) => {
		before?.(t);
		const image = t.image;
		if (!image || (image.width === 1 && image.height === 1)) return;
		const small = averagePixel(image);
		if (!small) return;
		// (the Source's version stays: three sees nothing to upload until the picture is asked back)
		t.image = small;
		// (a bitmap closed, a canvas emptied: the memory goes now, not when the collector gets to it)
		if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
		else if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) image.width = image.height = 0;
	};
	return texture;
}

// The graphics were lost: every shed picture asked back, so the restored context finds it
// (needsUpdate marks it for upload; the upload sheds it again). Returns a promise of them all.
export function refillShed() {
	const jobs = [];
	for (const [tex, e] of shed) {
		if (e.busy) { jobs.push(e.busy); continue; }
		const img = tex.image;
		if (img && !(img.width === 1 && img.height === 1)) continue;   // still held
		e.busy = Promise.resolve().then(() => e.reload()).then((image) => {
			if (image && shed.has(tex)) { tex.image = image; tex.needsUpdate = true; }
		}).catch((err) => { console.warn('[cpucopy] picture not reloaded', tex.name || '', err); }).finally(() => { e.busy = null; });
		jobs.push(e.busy);
	}
	return Promise.all(jobs);
}

// a texture disposed, or one that must keep its picture after all
export function keepImage(texture) { shed.delete(texture); }

export const shedInfo = () => ({ shed: shed.size, held: [...shed.keys()].filter((t) => t.image && !(t.image.width === 1 && t.image.height === 1)).length });
