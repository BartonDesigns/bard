// Real local Bay footprints, full faceplate renderer, museum walk surfaces and streaming.
// Run serially: flock /tmp/bard-browser.lock env NODE_PATH=... node this-file.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const out = process.env.BARD_DISCOVERY_OUT || '/tmp/bard-discovery-qa';
(async () => {
	fs.mkdirSync(out, { recursive: true });
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ viewport: { width: 640, height: 400 }, hasTouch: true, deviceScaleFactor: 1,
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' });
		page.setDefaultTimeout(300000);
		const errors = [], warnings = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); if (m.type() === 'warning' && /discovery museum|BufferGeometryUtils|mergeGeometries/.test(m.text())) warnings.push(m.text()); });
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => { const api = await L99IslandDoor.engine(); await api.open({ seed: 1337, earth: true }); Crysis.music.auto(false); window._KEYS_PLAY_ON = false; });
		await page.waitForFunction(() => !!L99Island.world().discovery && L99Island.world().bayArea.loaded());
		await page.evaluate(() => {
			const api = L99Island, W = api.world(), KX = 111320 * Math.cos(37.76 * Math.PI / 180), x = (-122.47660 + 122.57) * KX, z = -(37.83560 - 37.76) * 110996;
			const P = W.player.state; P.pos.set(x, W.island.heightAt(x, z) + 30, z + 60); P.flying = true; P.vel.set(0, 0, 0); P.pitch = -.3; api.camera().position.copy(P.pos);
			W.sky.state.speed = 0; W.sky.state.hours = 13; W.weather.set('clear');
		});
		await page.waitForFunction(() => !!L99Island.world().discovery.built?.main);
		// Freeze unrelated world streaming but keep its actual renderer/canvas on screen.
		await page.evaluate(() => { const api = L99Island; api.close(); api.dom.mount.style.display = 'block'; api.dom.panel.style.display = 'none'; });
		await page.setViewportSize({ width: 960, height: 600 });
		await page.evaluate(() => { const api = L99Island; api.renderer().setPixelRatio(1); api.renderer().setSize(960, 600, false); api.camera().aspect = 960 / 600; api.camera().updateProjectionMatrix(); });
		const info = await page.evaluate(() => {
			const W = L99Island.world(), D = W.discovery, B = D.built, meshes = [], mats = new Set();
			B.group.traverse(o => { if (o.isMesh) { meshes.push(o); for (const m of [].concat(o.material || [])) mats.add(m); } });
			return { main: !!B.main, cafe: !!B.cafe, cove: !!B.cove, faith: !!B.faith, pond: B.main?.pond,
				fronts: B.fronts.length, floors: B.floors.length, colliders: B.col.length, geometryMeshes: meshes.length,
				grove: B.grove?.stats, groveTrees: B.grove?.trees?.length || 0, materials: [...mats].map(m => m.name).filter(Boolean),
				mappedBuildings: W.real.near('boxes', B.main.F.x, B.main.F.z, 100).length, real: W.real.info() };
		});
		assert.ok(info.main && info.cafe && info.cove && info.faith && info.pond);
		assert.ok(info.fronts >= 3 && info.floors > 6 && info.mappedBuildings > 0);
		assert.ok(info.groveTrees > 0, 'The actual campus must contain the authored grove');
		assert.ok(info.materials.includes('discovery-grove-foliage'));
		console.log('Museum built from actual local footprints', JSON.stringify(info));
		const walking = await page.evaluate(() => {
			const api = L99Island, W = api.world(), D = W.discovery, B = D.built;
			if (!B.entrances?.length) throw Error('No museum entrance surfaces');
			const point = (F, x, z) => ({ x: F.x + Math.cos(F.a) * x - Math.sin(F.a) * z, z: F.z + Math.sin(F.a) * x + Math.cos(F.a) * z });
			const doors = [];
			for (const e of B.entrances) {
				let q = point(e.F, e.x, e.toeZ + .13), foot = W.island.heightAt(q.x, q.z), maxRise = 0, maxPush = 0, samples = 0;
				const length = e.toeZ + .13 - (e.doorZ - .45), count = Math.ceil(length / .055);
				if (!Number.isFinite(length) || length <= 0) throw Error('Invalid entrance path');
				for (let i = 0; i <= count; i++) {
					q = point(e.F, e.x, e.toeZ + .13 - length * i / count);
					const floor = Math.max(W.island.heightAt(q.x, q.z), D.floor(q.x, q.z, foot));
					maxRise = Math.max(maxRise, floor - foot);
					if (floor - foot >= .55) throw Error('Entrance exceeds the player step limit: ' + JSON.stringify({ localX: e.x, i, floor, foot }));
					foot = floor;
					const p = new api.T.Vector3(q.x, foot + 1.7, q.z); D.push(p, foot);
					maxPush = Math.max(maxPush, Math.hypot(p.x - q.x, p.z - q.z)); samples++;
				}
				if (maxPush > .025) throw Error('Entrance or porch route blocked: ' + JSON.stringify({ localX: e.x, maxPush }));
				if (Math.abs(foot - e.F.y) > .08) throw Error('Entrance failed to reach interior floor');
				doors.push({ steps: e.steps.length, rise: e.rise, maxRise, maxPush, samples });
			}
			const faithFloors = B.floors.filter(f => f.F === B.faith).length;
			if (!faithFloors || D.where(new api.T.Vector3(B.cove.F.x, B.cove.F.y + 1.7, B.cove.F.z)) !== 'cove') throw Error('Lookout Cove or Faith walk surfaces missing');
			return { doors, faithFloors };
		});
		console.log('Museum entrances, steps and porch routes are walkable', JSON.stringify(walking));
		for (const shot of ['courtyard', 'porch', 'hall', 'cove', 'grove']) {
			await page.evaluate(shot => {
				const api = L99Island, W = api.world(), B = W.discovery.built, camera = api.camera();
				const at = (F, x, y, z) => new api.T.Vector3(F.x + Math.cos(F.a) * x - Math.sin(F.a) * z, F.y + y, F.z + Math.sin(F.a) * x + Math.cos(F.a) * z);
				const F = B.main.F, front = B.fronts.find(f => f.F === F) || B.fronts[0], width = B.main.ix1 - B.main.ix0;
				let p, target;
				if (shot === 'courtyard') { p = at(F, -width * .55, 12, front.z + 27); target = at(F, width * .05, 3.5, front.z - 5); }
				else if (shot === 'porch') { p = at(F, -width * .34, 1.7, front.z + 6); target = at(F, width * .1, 2.3, front.z - 1.5); }
				else if (shot === 'hall') { p = at(F, width * .28, 1.7, B.main.iz1 - .2); target = at(F, -width * .23, 1.9, (B.main.iz0 + B.main.iz1) / 2); }
				else if (shot === 'grove') { const t = B.grove.trees[0]; p = new api.T.Vector3(t.x + 8, t.y + 1.7, t.z + 10); target = new api.T.Vector3(t.x, t.y + 3.5, t.z); }
				else { p = at(B.cove.F, 30, 11, 24); target = at(B.cove.F, 0, 2, 0); }
				camera.position.copy(p); camera.lookAt(target); camera.updateMatrixWorld(true); W.sky.update(0, p);
				api.renderer().render(api.scene(), camera); api.renderer().getContext().finish();
			}, shot);
			await page.screenshot({ path: `${out}/${shot}.png` });
		}
		const stream = await page.evaluate(() => {
			const api = L99Island, D = api.world().discovery, renderer = api.renderer(), scene = api.scene(), camera = api.camera(), center = D.built.main.F;
			const near = { position: new api.T.Vector3(center.x, center.y + 4, center.z) }, far = { position: new api.T.Vector3(center.x + 3000, center.y + 4, center.z) };
			const paint = () => { renderer.render(scene, camera); renderer.getContext().finish(); return { ...renderer.info.memory }; };
			D.update(0, far); if (D.built || D.group.children.length) throw Error('Museum did not stream out');
			const baseline = paint(), cycles = [];
			for (let i = 0; i < 2; i++) {
				D.update(0, near); if (!D.built?.main || !D.built.grove) throw Error('Museum did not rebuild');
				const geometries = new Set(), disposed = new Map();
				D.built.group.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
				for (const g of geometries) g.addEventListener('dispose', () => disposed.set(g, (disposed.get(g) || 0) + 1));
				paint(); D.update(0, far); const memory = paint();
				if ([...geometries].some(g => disposed.get(g) !== 1)) throw Error('Streamed geometry disposal was incomplete or repeated');
				if (memory.geometries !== baseline.geometries || memory.textures !== baseline.textures) throw Error('Museum resource growth after streaming: ' + JSON.stringify({ baseline, memory }));
				cycles.push({ geometriesDisposed: geometries.size, memory });
			}
			D.update(0, near); paint();
			return { baseline, cycles };
		});
		const gpu = await page.evaluate(() => { const r = L99Island.renderer(); return { lost: r.getContext().isContextLost(), failed: r.info.programs.filter(p => p.diagnostics?.runnable === false).length, draw: { ...r.info.render } }; });
		assert.equal(gpu.lost, false); assert.equal(gpu.failed, 0); assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
		const terminal = await page.evaluate(() => {
			const api = L99Island, D = api.world().discovery, materials = new Set(), disposed = new Map();
			for (const child of D.built.group.children) for (const m of [].concat(child.material || [])) materials.add(m);
			for (const m of materials) m.addEventListener('dispose', () => disposed.set(m, (disposed.get(m) || 0) + 1));
			D.dispose(); D.dispose(); D.update(0, api.camera());
			if (D.built || D.group.parent || D.group.children.length) throw Error('Disposed museum rebuilt or stayed mounted');
			if ([...materials].some(m => disposed.get(m) !== 1)) throw Error('Museum-owned material disposal must happen once');
			return { materialsDisposedOnce: materials.size, unmounted: !D.group.parent };
		});
		fs.writeFileSync(`${out}/report.json`, JSON.stringify({ info, walking, stream, terminal, gpu, errors, warnings }, null, 2));
		console.log('Museum real-footprint rendering, preserved exhibit data, grove and streaming passed', JSON.stringify({ stream, gpu, out }));
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
