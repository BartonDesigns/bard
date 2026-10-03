// Run under flock /tmp/bard-browser.lock against the full faceplate site.
// Software WebGL at a phone-sized viewport is regression evidence, not device FPS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const KINDS = ['garden', 'pendulum', 'dominoes', 'chimes', 'cradle', 'droplets', 'harp', 'stairs', 'fountain', 'wavebars'];
const out = process.env.BARD_QA_OUT || '/tmp/bard-completion-qa';
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];
(async () => {
	fs.mkdirSync(out, { recursive: true });
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ viewport: { width: 480, height: 320 }, hasTouch: true, deviceScaleFactor: 1,
			userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' });
		page.setDefaultTimeout(300000);
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => {
			const api = await L99IslandDoor.engine();
			await api.open({ seed: 1337, earth: false, biome: 'TROPICAL' });
			Crysis.music.auto(false); initAudio(); await ctx.resume();
			window._KEYS_PLAY_ON = false;
		});
		const placement = await page.evaluate(() => {
			const api = L99Island, W = api.world(), P = W.player.state, camera = api.camera(), initial = P.pos.clone();
			window.completionPlace = kind => {
				for (let radius = 0; radius <= 360; radius += 30) for (let k = 0; k < (radius ? 12 : 1); k++) {
					const a = k / 12 * Math.PI * 2, x = initial.x + Math.cos(a) * radius, z = initial.z + Math.sin(a) * radius, h = W.island.heightAt(x, z);
					if (!Number.isFinite(h) || h < 1) continue;
					P.pos.set(x, h + 1.7, z); P.vel.set(0, 0, 0); P.flying = false; camera.position.copy(P.pos); W.vegetation.stream(camera, true);
					if (Crysis.kinetic.place(kind)) return true;
				}
				return false;
			};
			let attempts = 0, placed = false;
			for (let radius = 0; radius <= 360 && !placed; radius += 30) for (let k = 0; k < (radius ? 12 : 1) && !placed; k++) {
				const a = k / 12 * Math.PI * 2, x = initial.x + Math.cos(a) * radius, z = initial.z + Math.sin(a) * radius, h = W.island.heightAt(x, z);
				if (!Number.isFinite(h) || h < 1) continue;
				P.pos.set(x, h + 1.7, z); P.vel.set(0, 0, 0); P.flying = false; camera.position.copy(P.pos); W.vegetation.stream(camera, true);
				attempts++; placed = Crysis.kinetic.place('garden');
			}
			if (!placed) throw Error('No normal clear surface placement after ' + attempts + ' candidates');
			Crysis.kinetic.clear();
			return { attempts, player: P.pos.toArray() };
		});
		console.log('Generated surface placement', placement);
		// The accessible menu must expose every retained legacy rig, with working controls.
		await page.evaluate(() => { L99Island.dom.panel.setAttribute('data-completion-panel', ''); L99Island.dom.gear.click(); });
		const panel = page.locator('[data-completion-panel]');
		const options = await page.locator('[aria-label="Kinetic instrument"] option').evaluateAll(nodes => nodes.map(n => n.value));
		assert.deepEqual(options, KINDS);
		await page.locator('[aria-label="Kinetic instrument"]').selectOption('garden');
		await panel.getByRole('button', { name: 'Place instrument', exact: true }).click();
		assert.equal(await page.evaluate(() => Crysis.kinetic.state().kind), 'garden');
		await panel.getByRole('button', { name: 'Stop', exact: true }).click();
		assert.equal(await page.evaluate(() => Crysis.kinetic.state().running), false);
		await panel.getByRole('button', { name: 'Replay', exact: true }).click();
		assert.equal(await page.evaluate(() => Crysis.kinetic.state().running), true);
		await panel.getByRole('button', { name: 'Clear', exact: true }).first().click();
		await page.evaluate(() => { L99Island.dom.gear.click(); });
		const rigs = [];
		for (const kind of KINDS) {
			const result = await page.evaluate(kind => {
				const api = L99Island, W = api.world(), camera = api.camera(), scene = api.scene(), renderer = api.renderer();
				const originalPlay = window.playLead, originalStop = window.stopLead, calls = [];
				window.playLead = function (...args) { calls.push(args); return originalPlay.apply(this, args); };
				window.stopLead = function (...args) { return originalStop.apply(this, args); };
				try {
					if (!window.completionPlace(kind)) throw Error('Normal placement failed: ' + kind);
					if (W.kinetic.state().kind !== kind) throw Error('Wrong native rig: ' + kind);
					const group = scene.getObjectByName('kinetic-' + kind);
					if (!group) throw Error('Rig group missing: ' + kind);
					const resources = new Set(), disposal = new Map();
					group.traverse(o => { if (o.geometry) resources.add(o.geometry); for (const m of [].concat(o.material || [])) resources.add(m); if (o.isInstancedMesh) resources.add(o); });
					for (const resource of resources) resource.addEventListener('dispose', () => disposal.set(resource, (disposal.get(resource) || 0) + 1));
					let peakVoices = 0, audible = false, moved = false; const firstMatrices = [];
					group.traverse(o => { if (o.isInstancedMesh) firstMatrices.push({ mesh: o, matrix: Array.from(o.instanceMatrix.array) }); });
					const started = performance.now();
					for (let i = 0; i < 120 * 12; i++) {
						W.kinetic.update(1 / 120, { listener: camera.position }); peakVoices = Math.max(peakVoices, W.kinetic.state().voices);
						if (L99Continuity.performance().notes.some(n => n.id.startsWith('auto:crysis-rig:'))) audible = true;
						if (!moved && firstMatrices.some(q => q.matrix.some((v, j) => Math.abs(v - q.mesh.instanceMatrix.array[j]) > .0001))) moved = true;
					}
					const cpuMs = performance.now() - started, notes = calls.length;
					if (!notes || !audible || !moved) throw Error(kind + ': missing actual notes or visible model motion');
					if (calls.some(a => !a[0].startsWith('auto:crysis-rig:') || a[3] !== false)) throw Error('Faceplate routing changed: ' + kind);
					camera.position.copy(group.position).add(new api.T.Vector3(13, 10, 17)); camera.lookAt(group.position.clone().add(new api.T.Vector3(0, 3, 0))); camera.updateMatrixWorld(true);
					renderer.render(scene, camera); renderer.getContext().finish();
					const render = { ...renderer.info.render }, memory = { ...renderer.info.memory };
					Crysis.kinetic.stop(); for (let i = 0; i < 120; i++) W.kinetic.update(1 / 60, { listener: camera.position });
					if (calls.length !== notes || W.kinetic.state().voices !== 0) throw Error('Stopped instrument kept sounding: ' + kind);
					Crysis.kinetic.replay(); for (let i = 0; i < 120 * 12; i++) W.kinetic.update(1 / 120, { listener: camera.position });
					const replayNotes = calls.length - notes; if (!replayNotes) throw Error('Replay silent: ' + kind);
					Crysis.kinetic.clear(); Crysis.kinetic.clear();
					if (group.parent || [...resources].some(r => disposal.get(r) !== 1)) throw Error('Owned resource disposal failed: ' + kind);
					if (L99Continuity.performance().notes.some(n => n.id.startsWith('auto:crysis-rig:'))) throw Error('Owned synth voice leaked: ' + kind);
					return { kind, notes, replayNotes, peakVoices, audible, moved, resources: resources.size, cpuMs, render, memory };
				} finally { window.playLead = originalPlay; window.stopLead = originalStop; Crysis.kinetic.clear(); }
			}, kind);
			assert.ok(result.peakVoices <= 8); assert.ok(result.notes <= 4 + 24 * 12);
			rigs.push(result); console.log('Native rig checked', JSON.stringify(result));
		}
		// Resource churn happens in a single event-loop turn, so regional streaming cannot
		// obscure whether a rendered rig's geometry/texture allocations return to baseline.
		const churn = await page.evaluate(kinds => {
			const api = L99Island, W = api.world(), renderer = api.renderer(), scene = api.scene(), camera = api.camera(), p = W.player.state.pos;
			Crysis.kinetic.clear(); renderer.render(scene, camera); renderer.getContext().finish();
			const baseline = { ...renderer.info.memory }, samples = [];
			for (let cycle = 0; cycle < 2; cycle++) for (const kind of kinds) {
				W.kinetic.spawn({ kind, x: p.x, y: p.y + 2, z: p.z - 18 }); W.kinetic.update(.1, { listener: camera.position });
				renderer.render(scene, camera); renderer.getContext().finish();
				W.kinetic.clear(); renderer.render(scene, camera); renderer.getContext().finish();
				const memory = { ...renderer.info.memory }; samples.push({ cycle, kind, ...memory });
				if (memory.geometries !== baseline.geometries || memory.textures !== baseline.textures) throw Error('GPU resources did not return after ' + kind + ': ' + JSON.stringify({ baseline, memory }));
			}
			return { baseline, samples };
		}, KINDS);
		console.log('Twenty rendered replacement/clear cycles returned to GPU baseline', churn.baseline);
		// Keep the true main loop active for timing: includes streaming and the faceplate.
		await page.evaluate(() => { if (!window.completionPlace('garden')) throw Error('Soak rig placement failed'); });
		const timing = await page.evaluate(async () => {
			const frames = [], start = performance.now(); let previous = start;
			for (let i = 0; i < 24; i++) { const now = await new Promise(resolve => requestAnimationFrame(resolve)); if (i) frames.push(now - previous); previous = now; }
			const r = L99Island.renderer(), gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
			return { intervalsMs: frames, elapsedMs: performance.now() - start, memory: { ...r.info.memory }, render: { ...r.info.render }, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
		});
		timing.p50Ms = percentile(timing.intervalsMs, .5); timing.p95Ms = percentile(timing.intervalsMs, .95);
		console.log('Actual 480x320 SwiftShader main-loop timing; not a physical-device FPS result', JSON.stringify(timing));
		const hidden = await page.evaluate(() => { L99Island.close(); return Crysis.kinetic.state(); });
		assert.equal(hidden.running, false); assert.equal(hidden.voices, 0);
		await page.evaluate(async () => { Crysis.kinetic.clear(); await L99Island.open({ seed: 1337, earth: true }); Crysis.music.auto(false); });
		const polar = [];
		for (const spot of [{ name: 'Svalbard', lat: 78.2232, lon: 15.6469 }, { name: 'Antarctic', lat: -77.85, lon: 166.67 }]) {
			await page.evaluate(async spot => {
				const W = L99Island.world(), q = W.globe.place(spot.lat, spot.lon); await q.ready;
				const P = W.player.state; P.pos.set(q.x, Math.max(0, W.island.heightAt(q.x, q.z)) + 16, q.z); P.vel.set(0, 0, 0); P.flying = true; P.pitch = -.1;
				L99Island.camera().position.copy(P.pos);
			}, spot);
			for (const month of [1, 7]) {
				const sample = await page.evaluate(({ month, spot }) => {
					const api = L99Island, W = api.world(), camera = api.camera(); Crysis.month(month); W.sky.state.speed = 0; W.sky.update(0, camera.position);
					const sun = { ...W.sky.state.sun }; W.sky.state.hours = sun.noon; W.sky.update(0, camera.position); const noonY = api.shared.uSunDir.value.y;
					W.sky.state.hours = (sun.noon + 12) % 24; W.sky.update(0, camera.position); const midnightY = api.shared.uSunDir.value.y;
					W.globe.regional.update(.1, camera, { night: W.sky.uniforms.uNight.value, out: true, wind: { x: .3, y: 0 } });
					api.renderer().render(api.scene(), camera); api.renderer().getContext().finish();
					return { name: spot.name, month, sun, noonY, midnightY, region: Crysis.region(), location: { lat: W.globe.regional.here.lat, lon: W.globe.regional.here.lon }, gpu: { lost: api.renderer().getContext().isContextLost(), failed: api.renderer().info.programs.filter(p => p.diagnostics?.runnable === false).length } };
				}, { month, spot });
				const summer = spot.lat > 0 ? month === 7 : month === 1;
				assert.ok(summer ? sample.midnightY > 0 : sample.noonY < 0, JSON.stringify(sample));
				assert.equal(sample.sun.polar, sample.region.climate.polar);
				assert.ok(Math.abs(sample.location.lat - sample.sun.lat) < 1e-6);
				// The active player may move between teleport and this sampled frame.
				assert.ok(Math.abs(sample.location.lat - spot.lat) < .1); assert.ok(Math.abs(sample.location.lon - spot.lon) < .1);
				assert.equal(sample.gpu.lost, false); assert.equal(sample.gpu.failed, 0);
				polar.push(sample); console.log('Actual polar sun path', JSON.stringify({ name: sample.name, month, noonY: sample.noonY, midnightY: sample.midnightY, polar: sample.sun.polar }));
				await page.screenshot({ path: `${out}/${spot.name.toLowerCase()}-${month}.png` });
			}
		}
		const orbitFrame = await page.evaluate(() => {
			const api = L99Island, W = api.world(), P = W.player.state, camera = api.camera(), position = P.pos.clone(), epoch = W.globe.frame.epoch;
			P.flying = true; P.pos.y = 25000; W.orbit.before(); W.orbit.after(1 / 60);
			if (!W.orbit.active()) throw Error('Atmospheric orbit boundary did not capture departure');
			P.pos.x += 121000; camera.position.copy(P.pos); W.globe.update(1 / 60, camera, 0);
			const heldEpoch = W.globe.frame.epoch, active = W.orbit.active(), anchor = W.orbit.info().anchor;
			P.pos.copy(position); camera.position.copy(position); W.orbit.cancel();
			if (heldEpoch !== epoch) throw Error('Globe reframed during the retained 12–60 km orbital blend');
			return { epoch, heldEpoch, active, anchor };
		});
		console.log('Atmospheric lateral travel retains the departure coordinate frame', orbitFrame);
		const finalGpu = await page.evaluate(() => { const r = L99Island.renderer(); return { memory: { ...r.info.memory }, lost: r.getContext().isContextLost(), failed: r.info.programs.filter(p => p.diagnostics?.runnable === false).length }; });
		assert.equal(finalGpu.lost, false); assert.equal(finalGpu.failed, 0); assert.deepEqual(errors, []);
		const report = { method: 'Chromium SwiftShader software WebGL, 480x320 touch viewport, full faceplate with offline/safe flags. Twenty-four real main-loop RAF timestamps; 12-second fixed-step actual faceplate simulations per rig; rendered GPU allocation churn.', placement, rigs, churn, timing, polar, orbitFrame, finalGpu, errors };
		fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
		console.log(`All ten native kinetic rigs, actual faceplate voices, menu controls, resource churn, polar sky and GPU checks passed. Report: ${out}/report.json`);
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
