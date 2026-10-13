// Coplanar overlap census: walks every drawn mesh round the player, finds triangles that lie
// in the same plane (within a few centimetres), face the same way and overlap, from different
// draws or instances, with nothing (polygonOffset) to separate them. Those are the surfaces
// that flicker through each other. Prints the worst pairs by overlapping area.
// Run with: node island/tools/zfight-browser.cjs [query] [radius]  e.g. '?planet=TERRAN&seed=77'
// For the Bay Area: GOTO=37.7936,-122.3965 node island/tools/zfight-browser.cjs '' 160
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const query = process.argv[2] || '?planet=TERRAN&seed=77', radius = +(process.argv[3] || 220);

function census([R, far]) {
	const T = window.L99Island?.T || window.L99IslandModule?.island?.().T;
	const scene = window.Crysis.scene(), P = window.Crysis.world().player.state.pos;
	const at = window.ZF_AT || P;
	scene.updateMatrixWorld(true);
	const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
	const label = (o, m) => {
		const names = []; for (let q = o; q && names.length < 3; q = q.parent) if (q.name) names.push(q.name);
		const mt = Array.isArray(m) ? m[0] : m;
		const ud = Object.keys(o.userData || {}).slice(0, 3).join('/');
		return (names.join('<') || o.type) + (ud ? ' {' + ud + '}' : '') + ' [' + (mt?.name || mt?.type || '?') + (mt?.color ? ' #' + mt.color.getHexString() : '') + (mt?.map ? ' map' : '') + ']';
	};
	const tris = new Map(), owners = [];
	const S = far ? 0.3 : 0.035, Q = 0.04, cam = window.Crysis.world()?.player && window.L99Island?.camera || null, eye = window.ZF_EYE || null;
	let counted = 0;
	function addTri(owner, a, b, c) {
		const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const area2 = Math.hypot(nx, ny, nz); if (area2 < 0.02) return;
		nx /= area2; ny /= area2; nz /= area2;
		const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
		if (Math.hypot(cx - at.x, cz - at.z) > R) return;
		const d = nx * a[0] + ny * a[1] + nz * a[2];
		const key = Math.round(nx / Q) + ',' + Math.round(ny / Q) + ',' + Math.round(nz / Q) + ',' + Math.round(d / S);
		// a plane basis to compare outlines in
		const tx = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
		let px = tx[1] * nz - tx[2] * ny, py = tx[2] * nx - tx[0] * nz, pz = tx[0] * ny - tx[1] * nx; const pl = Math.hypot(px, py, pz); px /= pl; py /= pl; pz /= pl;
		const qx = ny * pz - nz * py, qy = nz * px - nx * pz, qz = nx * py - ny * px;
		const two = [a, b, c].map(v => [v[0] * px + v[1] * py + v[2] * pz, v[0] * qx + v[1] * qy + v[2] * qz]);
		let L = tris.get(key); if (!L) tris.set(key, L = []);
		L.push({ owner, d, n: [nx, ny, nz], two, area: area2 / 2, c: [cx, (a[1] + b[1] + c[1]) / 3, cz] });
		counted++;
	}
	const mi = new T.Matrix4(), mw = new T.Matrix4(), v = new T.Vector3();
	scene.traverse((o) => {
		if (!(o.isMesh) || o.isSkinnedMesh || !o.geometry?.attributes?.position || !shown(o)) return;
		const g = o.geometry, pos = g.attributes.position, idx = g.index;
		if (!g.boundingSphere) g.computeBoundingSphere();
		const mats = Array.isArray(o.material) ? o.material : [o.material];
		if (mats.every(m => !m || m.visible === false || m.colorWrite === false)) return;
		const offset = mats.some(m => m?.polygonOffset);
		const n = o.isInstancedMesh ? Math.min(o.count, 4000) : 1;
		for (let k = 0; k < n; k++) {
			mw.copy(o.matrixWorld);
			if (o.isInstancedMesh) { o.getMatrixAt(k, mi); mw.multiply(mi); }
			const cs = g.boundingSphere.center.clone().applyMatrix4(mw);
			if (Math.hypot(cs.x - at.x, cs.z - at.z) > R + g.boundingSphere.radius * 1.5) continue;
			const owner = owners.length; owners.push({ where: o.parent ? [o.parent.type, +o.parent.rotation.y.toFixed(3), o.parent.position.toArray().map(x => +x.toFixed(2))] : null, label: label(o, o.material), offset, inst: o.isInstancedMesh ? k : -1, uuid: o.uuid, depthWrite: mats.some(m => m?.depthWrite !== false), transparent: mats.some(m => m?.transparent) });
			const triCount = (idx ? idx.count : pos.count) / 3;
			if (triCount > 400000) continue;
			const vert = (i) => { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(mw); return [v.x, v.y, v.z]; };
			for (let t = 0; t < triCount; t++) addTri(owner, vert(t * 3), vert(t * 3 + 1), vert(t * 3 + 2));
		}
	});
	// overlap of two triangles in their shared plane (Sutherland-Hodgman)
	function clip(poly, a, b) {
		const out = [], side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
		for (let i = 0; i < poly.length; i++) {
			const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
			if (sp >= 0) out.push(p);
			if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
		}
		return out;
	}
	const polyArea = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
	function overlap(A, B) {
		let poly = A.two.slice();
		const ccw = ((B.two[1][0] - B.two[0][0]) * (B.two[2][1] - B.two[0][1]) - (B.two[1][1] - B.two[0][1]) * (B.two[2][0] - B.two[0][0])) > 0;
		const b = ccw ? B.two : [B.two[0], B.two[2], B.two[1]];
		for (let i = 0; i < 3 && poly.length; i++) poly = clip(poly, b[i], b[(i + 1) % 3]);
		return poly.length >= 3 ? polyArea(poly) : 0;
	}
	const pairs = new Map(); let fights = 0, area = 0;
	for (const L of tris.values()) {
		if (L.length < 2 || L.length > 6000) continue;
		for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
			const A = L[i], B = L[j];
			if (A.owner === B.owner) continue;
			if (Math.abs(A.d - B.d) > S || A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2] < 0.995) continue;
			// far mode: only what the depth buffer cannot tell apart from where you stand
			// (24-bit depth, near plane 0.25: resolution grows with the square of distance)
			if (far) { const e = eye || P, dist = Math.hypot(A.c[0] - e.x, A.c[1] - (e.y ?? 0), A.c[2] - e.z), dz = dist * dist / (0.25 * 16777216); if (Math.abs(A.d - B.d) > Math.max(0.004, 3 * dz)) continue; }
			const oa = owners[A.owner], ob = owners[B.owner];
			if (!oa.depthWrite && !ob.depthWrite) continue;
			if (oa.offset !== ob.offset) continue;
			const s = overlap(A, B); if (s < 0.01) continue;
			const k = [oa.label, ob.label].sort().join('  ~  ') + (oa.uuid === ob.uuid ? '  (same mesh, instances)' : '');
			const r = pairs.get(k) || { pair: k, area: 0, tris: 0, gap: 0, at: A.c.map(Math.round), normal: A.n.map(x => +x.toFixed(2)), whereA: oa.where, whereB: ob.where, samples: [] };
			if (r.samples.length < 4) r.samples.push({ a: A.c.map(x => +x.toFixed(2)), b: B.c.map(x => +x.toFixed(2)), s: +s.toFixed(2) });
			r.area += s; r.tris++; r.gap = Math.max(r.gap, Math.abs(A.d - B.d)); pairs.set(k, r);
			fights++; area += s;
		}
	}
	return { triangles: counted, meshes: owners.length, fights, area: +area.toFixed(1), top: [...pairs.values()].sort((a, b) => b.area - a.area).slice(0, 25).map(r => ({ ...r, area: +r.area.toFixed(2), gap: +r.gap.toFixed(3) })) };
}

(async () => {
	const server = http.createServer((q, r) => {
		let f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
		if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
		try { r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); } catch { r.writeHead(404).end(); }
	});
	await new Promise(r => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	try {
		const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
		const errors = []; page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html${query}`);
		for (let i = 0; i < 180; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => !!window.Crysis?.world?.()?.player).catch(() => false)) break; }
		// the loading card waits for a tap on Enter world; the world stands still until then
		for (let i = 0; i < 240; i++) {
			const entered = await page.evaluate(() => { if (!window.L99Loading?.active()) return true; const b = [...document.querySelectorAll('button')].find(x => !x.hidden && /^Enter world$/.test(x.textContent.trim())); b?.click(); return false; }).catch(() => false);
			if (entered) break;
			await page.waitForTimeout(1000);
		}
		if (process.env.GOTO) {
			const [lat, lon] = process.env.GOTO.split(',').map(Number);
			await page.evaluate(([a, b]) => window.Crysis.goTo(a, b, 2), [lat, lon]);
		}
		if (process.env.EVAL) console.log('eval', await page.evaluate(process.env.EVAL));
		if (process.env.AT) await page.evaluate((xz) => { const [x, z] = xz.split(',').map(Number); window.ZF_AT = { x, z }; }, process.env.AT);
		// settle: towns grow a few ms a frame, tiles stream in
		await page.waitForTimeout(+(process.env.SETTLE || 40000));
		await page.evaluate(() => window.Crysis.world()?.crysis?.civ?.()?.flush?.()).catch(() => {});
		if (process.env.EVAL2) console.log('eval2', await page.evaluate(process.env.EVAL2));
		if (process.env.EYE) await page.evaluate((xyz) => { const [x, y, z] = xyz.split(',').map(Number); window.ZF_EYE = { x, y, z }; }, process.env.EYE);
		const result = await page.evaluate(census, [radius, !!process.env.FAR]);
		result.at = await page.evaluate(() => { const p = window.ZF_AT || window.Crysis.world().player.state.pos; return [Math.round(p.x), Math.round(p.z)]; });
		result.errors = errors;
		const out = process.env.ZF_OUT; if (out) fs.writeFileSync(out, JSON.stringify(result, null, 2));
		console.log(JSON.stringify(result, null, 1));
	} finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
