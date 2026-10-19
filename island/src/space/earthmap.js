// The orbital Earth's real imagery: Sentinel-2 over NASA's Blue Marble (island/tools/bake-earth-imagery.md).
// A base texture for the whole globe, and a patch of sharp tiles kept round the point under the
// ship: 6° tiles at about 1.9 km a pixel when high, 2° tiles at about 600 m when low. The patch is
// one canvas, drawn from cached tiles, re-centred as you fly, so the GPU holds one texture for it.
//
//   createEarthMap({ phone })   -> { base(), night(), patch, box, on(), update(lat, lon, altitude), sleep(), dispose() }
import * as THREE from 'three';

export const EARTH_MAP_VERSION = 1;
const url = (p) => new URL(`../assets/earth/${p}?v=${EARTH_MAP_VERSION}`, import.meta.url).href;
const wrap = (d) => ((d + 540) % 360 + 360) % 360 - 180;

export function createEarthMap({ phone = false } = {}) {
	// (a 2° tile decodes to half a megabyte, so the cache is kept to what one patch needs and a little over)
	const SIZE = phone ? 1024 : 2048, KEEP = phone ? 50 : 160, FINE = phone ? 8 : 12;
	let base = null, baseLoading = false, night = null, nightLoading = false, index = null, indexLoading = false, disposed = false, asleep = true;
	// two canvases: a re-centre copies the old picture across, so nothing blinks while tiles come in
	const make = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; };
	let canvas = make(), spare = make();
	const patch = new THREE.CanvasTexture(canvas);
	patch.colorSpace = THREE.SRGBColorSpace; patch.anisotropy = 4; patch.premultiplyAlpha = true;
	patch.minFilter = THREE.LinearMipmapLinearFilter; patch.generateMipmaps = true;
	// the patch: centre and spans in degrees, and the tile level it is drawn from
	const box = { lat: 0, lon: 0, latSpan: 0, lonSpan: 0, level: 0, ready: false };
	const tiles = new Map();   // 'level/r/c' -> { img, ok, used }
	let dirty = false, lastUpload = 0;

	function wake() {
		asleep = false;
		if (!base && !baseLoading) {
			baseLoading = true;
			new THREE.TextureLoader().load(url(phone ? 'earth-2k.webp' : 'earth-4k.webp'), (t) => {
				baseLoading = false;
				if (disposed || asleep) { t.dispose(); return; }
				t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
				base = t;
			}, undefined, () => { baseLoading = false; });
		}
		// the night side's city lights (NASA, by way of three.js's examples)
		if (!night && !nightLoading) {
			nightLoading = true;
			new THREE.TextureLoader().load(url('night-2k.webp'), (t) => {
				nightLoading = false;
				if (disposed || asleep) { t.dispose(); return; }
				t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
				night = t;
			}, undefined, () => { nightLoading = false; });
		}
		if (!index && !indexLoading) {
			indexLoading = true;
			fetch(url('tiles.json')).then((r) => r.json()).then((j) => { index = j; }).catch(() => {}).finally(() => { indexLoading = false; });
		}
	}
	const has = (level, r, c) => index?.[`l${level}`]?.[r]?.[c] === '1';
	function want(level, r, c) {
		const key = `${level}/${r}/${c}`;
		let t = tiles.get(key);
		if (t) { t.used = performance.now(); return t; }
		t = { img: new Image(), ok: false, used: performance.now(), level, r, c };
		t.img.decoding = 'async';
		t.img.onload = () => { if (disposed) return; t.ok = true; if (inBox(t)) { draw(canvas.getContext('2d'), t); dirty = true; } };
		t.img.onerror = () => { t.failed = true; };
		t.img.src = url(`l${level}/${r}/${c}.webp`);
		tiles.set(key, t);
		if (tiles.size > KEEP) {
			// the least recently wanted, outside the patch, go first
			const old = [...tiles.values()].filter((q) => !inBox(q)).sort((a, b) => a.used - b.used);
			for (const q of old.slice(0, tiles.size - KEEP)) { q.img.src = ''; tiles.delete(`${q.level}/${q.r}/${q.c}`); }
		}
		return t;
	}
	const tileDeg = (level) => level === 1 ? 6 : 2;
	function inBox(t) {
		if (!box.ready || t.level !== box.level) return false;
		const d = tileDeg(t.level), lat = 90 - (t.r + .5) * d, lon = -180 + (t.c + .5) * d;
		return Math.abs(lat - box.lat) < box.latSpan / 2 + d && Math.abs(wrap(lon - box.lon)) < box.lonSpan / 2 + d;
	}
	// a tile's rectangle on the canvas (north at the top, as the shader reads it)
	function draw(ctx, t) {
		const d = tileDeg(t.level), north = 90 - t.r * d, west = -180 + t.c * d;
		const x = (wrap(west - box.lon) / box.lonSpan + .5) * SIZE, y = ((box.lat - north) / box.latSpan + .5) * SIZE;
		const w = d / box.lonSpan * SIZE, h = d / box.latSpan * SIZE;
		// (a pixel of overlap hides the seams between tiles)
		ctx.drawImage(t.img, x - .5, y - .5, w + 1, h + 1);
	}
	// re-centre and re-level the patch when the ship has moved or climbed enough
	function update(lat, lon, altitude) {
		if (disposed) return;
		wake();
		if (!index || !Number.isFinite(lat)) return;
		const latSpan = Math.max(2.5, Math.min(24, altitude / 1000 * .02));
		const lonSpan = Math.min(latSpan * 2.5, latSpan / Math.max(.1, Math.cos(lat * Math.PI / 180)));
		// the 2° tiles while the patch is small enough to show their detail, the 6° tiles above that
		const level = latSpan <= FINE ? 2 : 1;
		const moved = !box.ready || Math.abs(lat - box.lat) > box.latSpan / 5 || Math.abs(wrap(lon - box.lon)) > box.lonSpan / 5;
		const rescale = !box.ready || latSpan / box.latSpan > 1.35 || box.latSpan / latSpan > 1.35 || level !== box.level;
		if (moved || rescale) recentre(Math.max(-88, Math.min(88, lat)), lon, latSpan, lonSpan, level);
		const now = performance.now();
		if (dirty && now - lastUpload > (phone ? 400 : 200)) { dirty = false; lastUpload = now; patch.needsUpdate = true; }
	}
	function recentre(lat, lon, latSpan, lonSpan, level) {
		const ctx = spare.getContext('2d');
		ctx.clearRect(0, 0, SIZE, SIZE);
		// the old picture, where it lands in the new box (same level only: another level is another sharpness)
		if (box.ready && level === box.level) {
			const x = (wrap(box.lon - box.lonSpan / 2 - (lon - lonSpan / 2))) / lonSpan * SIZE, y = ((lat + latSpan / 2) - (box.lat + box.latSpan / 2)) / latSpan * SIZE;
			ctx.drawImage(canvas, x, y, box.lonSpan / lonSpan * SIZE, box.latSpan / latSpan * SIZE);
		}
		Object.assign(box, { lat, lon, latSpan, lonSpan, level, ready: true });
		[canvas, spare] = [spare, canvas];
		patch.image = canvas;
		const d = tileDeg(level), rows = 180 / d, cols = 360 / d;
		const r0 = Math.max(0, Math.floor((90 - (lat + latSpan / 2)) / d)), r1 = Math.min(rows - 1, Math.floor((90 - (lat - latSpan / 2)) / d));
		const half = Math.ceil(lonSpan / 2 / d) + 1, cc = Math.floor((lon + 180) / d);
		// nearest first, so the ground under the ship sharpens before the edges
		const list = [];
		for (let r = r0; r <= r1; r++) for (let k = -half; k <= half; k++) {
			const c = ((cc + k) % cols + cols) % cols;
			if (!has(level, r, c)) continue;
			const t = { level, r, c };
			if (!inBox(t)) continue;
			list.push([Math.abs(90 - (r + .5) * d - lat) + Math.abs(k * d), r, c]);
		}
		list.sort((a, b) => a[0] - b[0]);
		const cx = canvas.getContext('2d');
		for (const [, r, c] of list) { const t = want(level, r, c); if (t.ok) draw(cx, t); }
		dirty = true;
	}
	function sleep() {
		asleep = true;
		base?.dispose(); base = null; night?.dispose(); night = null;
		box.ready = false;
		for (const t of tiles.values()) t.img.src = '';
		tiles.clear();
		patch.dispose();
		canvas.getContext('2d').clearRect(0, 0, SIZE, SIZE);
	}
	return {
		patch, box, update, sleep,
		base: () => base,
		night: () => night,
		on: () => box.ready && !asleep,
		info: () => ({ base: !!base, index: !!index, tiles: tiles.size, loaded: [...tiles.values()].filter((t) => t.ok).length, box: { ...box }, size: SIZE, centre: box.ready ? [...canvas.getContext('2d').getImageData(SIZE / 2, SIZE / 2, 1, 1).data] : null, version: patch.version }),
		dispose() { disposed = true; sleep(); },
	};
}
