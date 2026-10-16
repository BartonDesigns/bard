// The planet floor harness: loads each world in headless Chromium (software GL), then walks,
// flies, teleports, changes the governor's tier, loses and restores the graphics and comes down
// from orbit, and at each step compares the ground as drawn under the player (Crysis.groundProbe:
// the scene drawn from above, its depth read back) with the ground the player stands on
// (player.floorAt). A gap over 5 m is flagged. Logs and captures go to OUT.
// throw and cavethrow make one step of the frame fail every frame (the bug's trigger); soak goes
// round a world's places; scan and nan look for geometry out of all reason; rays the sunbeams.
//
// ROOT=<repo> OUT=<dir> [PLANETS=MAGMA:4242,TERRAN:77 or EARTH:1337] [PHONE=1] [NOSHOT=1]
// [STEPS=walk,grid,tier,lost,far,orbit,throw,cavethrow,soak,scan,nan,rays]
// node island/tools/planet-floor-browser.cjs
/* global window, document, Crysis, localStorage, requestAnimationFrame */
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = process.env.ROOT || path.resolve(__dirname, '../..');
const out = process.env.OUT || '/tmp/planet-floor';
const planets = (process.env.PLANETS || 'MAGMA:4242,TERRAN:77').split(',').map((s) => { const [p, seed] = s.split(':'); return { p, seed: +seed || 4242 }; });
const steps = (process.env.STEPS || 'walk,grid,tier,lost,far,orbit').split(',');
const phone = !!process.env.PHONE;
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
fs.mkdirSync(out, { recursive: true });
const log = (...a) => { const t = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(t); fs.appendFileSync(path.join(out, 'log.txt'), t + '\n'); };

// in the page: one sample of the drawn ground against the walked one at the player
const SAMPLE = `(() => {
	const W = Crysis.world(), P = W.player.state, I = W.island, EYE = 1.68;
	const x = P.pos.x, z = P.pos.z, foot = P.pos.y - EYE;
	const walk = W.player.floorAt(x, z, foot + 0.5);
	const scene = Crysis.scene();
	const terrainOnly = (o) => o === W.terrain;
	const ground = new Set([W.terrain, W.underworld && Crysis.scene().getObjectByName('underworld'), W.alien?.group, W.colony?.group, W.volcano?.group, W.floaters?.group, W.arch?.group, W.medieval?.group, W.fields?.group, W.village?.group].filter(Boolean));
	const drawnTerrain = Crysis.groundProbe(x, z, { keep: terrainOnly, top: foot + 3000, span: 6000 });
	// where the terrain would be drawn were it shown (its visibility apart)
	const vis = W.terrain.visible; W.terrain.visible = true;
	const shapeTerrain = Crysis.groundProbe(x, z, { keep: terrainOnly, top: foot + 3000, span: 6000 });
	W.terrain.visible = vis;
	const drawnAll = Crysis.groundProbe(x, z, { keep: (o) => !o.isLight && o !== W.ocean && o !== W.vegetation?.group && o !== W.sky?.mesh && o.name !== 'sky', top: foot + 0.4, span: 6000 });
	const u = W.terrain.material.userData, hTex = W.terrain.material;
	return {
		pos: [x, P.pos.y, z].map((v) => Math.round(v * 10) / 10), flying: !!P.flying, walk: walk == null ? null : Math.round(walk * 100) / 100,
		heightAt: Math.round(I.heightAt(x, z) * 100) / 100, under: W.underworld?.floor?.(x, z, foot + 0.5) ?? null,
		extra: I.extraFloor ? Math.round(I.extraFloor(x, z, foot + 0.5) * 100) / 100 : null,
		drawnTerrain: drawnTerrain == null ? null : Math.round(drawnTerrain * 100) / 100,
		shapeTerrain: shapeTerrain == null ? null : Math.round(shapeTerrain * 100) / 100,
		drawnAll: drawnAll == null ? null : Math.round(drawnAll * 100) / 100,
		terrainVisible: W.terrain.visible, terrainInScene: W.terrain.parent === scene,
		caveK: Math.round((W.underworld?.inside?.() || 0) * 100) / 100, deep: !!W.deep?.active?.(),
		orbit: W.orbit?.info?.() ? { active: W.orbit.active(), blend: Math.round(W.orbit.blend() * 100) / 100, alt: Math.round(W.orbit.info().altitude) } : null,
		governor: Crysis.governor().tier, half: I.half,
		guard: Crysis.floorGuard ? Crysis.floorGuard() : null, center: W.terrain.userData.center ? [W.terrain.userData.center.x, W.terrain.userData.center.y] : null,
	};
})()`;

(async () => {
	const server = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const flags = [];
	for (const { p, seed } of planets) {
		const ctx = await browser.newContext(phone
			? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }
			: { viewport: { width: 800, height: 450 } });
		await ctx.addInitScript(() => { try { localStorage.setItem('l99-quality', 'auto'); } catch { /* private mode */ } });
		const page = await ctx.newPage();
		page.setDefaultTimeout(600000);
		const errs = [];
		page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
		page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t)) errs.push('CONSOLE ' + t.slice(0, 300)); if (/floor guard/.test(t)) log(p, 'console:', t.slice(0, 300)); });
		const tag = `${p}-${seed}${phone ? '-phone' : ''}`;
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html${p === 'EARTH' ? '?seed=' + seed : `?planet=${p}&seed=${seed}`}`, { timeout: 600000 });
		for (let i = 0; i < 600; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => !!window.Crysis?.world?.()?.player).catch(() => false)) break; }
		for (let i = 0; i < 240; i++) { const entered = await page.evaluate(() => { if (!window.L99Loading?.active()) return true; const b = [...document.querySelectorAll('button')].find((x) => !x.hidden && /^Enter world$/.test(x.textContent.trim())); b?.click(); return false; }).catch(() => false); if (entered) break; await page.waitForTimeout(1000); }
		await page.evaluate(() => { const W = Crysis.world(); W.sky.state.hours = 12.5; });
		// frames go by slowly here: wait for a count of them, not a time
		const frames = async (n) => { await page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n); };
		await frames(3);
		const sample = async (label) => {
			const s = await page.evaluate(SAMPLE).catch((e) => ({ err: String(e) }));
			const ref = s.walk;
			const gapT = ref != null && s.drawnTerrain != null ? ref - s.drawnTerrain : null;
			const gapA = ref != null && s.drawnAll != null ? ref - s.drawnAll : null;
			// a void: the walked floor stands more than 5 m over everything drawn under it
			const bad = ref != null && !s.flying && (s.drawnAll == null || gapA > 5);
			s.label = label; s.gapTerrain = gapT == null ? null : Math.round(gapT * 100) / 100; s.gapAll = gapA == null ? null : Math.round(gapA * 100) / 100; s.flag = bad;
			log(tag, label, s);
			fs.appendFileSync(path.join(out, `${tag}.jsonl`), JSON.stringify(s) + '\n');
			if (bad) flags.push({ tag, label, s });
			return s;
		};
		const shot = async (name) => { if (process.env.NOSHOT) return; await frames(2); await page.screenshot({ path: path.join(out, `${tag}-${name}.png`), timeout: 600000, scale: 'css' }).catch((e) => log(tag, 'screenshot failed', String(e).slice(0, 120))); };
		const tp = async (x, z, opts = {}) => {
			await page.evaluate(({ x, z, fly, y }) => { const W = Crysis.world(), P = W.player.state; P.flying = !!fly; P.vel.set(0, 0, 0); P.pos.set(x, y ?? (W.player.floorAt(x, z, W.island.heightAt(x, z) + 0.5) + 1.68), z); }, { x, z, fly: opts.fly, y: opts.y });
			await frames(opts.frames || 3);
		};
		await sample('spawn');
		await shot('spawn');
		const info = await page.evaluate(() => { const W = Crysis.world(), I = W.island; return { half: I.half, spawn: I.spawn, peak: I.peak, caves: (W.underworld?.entrances || []).map((e) => [Math.round(e.x), Math.round(e.z)]), alien: (W.alien?.sites || []).map((s) => [Math.round(s.x), Math.round(s.z)]), colony: !!W.colony, volcano: !!W.volcano, arch: !!W.arch, medieval: !!W.medieval, floaters: !!W.floaters }; });
		log(tag, 'world', info);
		if (steps.includes('scan')) {
			// everything drawn with a vertex out of all reason: instances and geometry far taller than
			// anything built, or not finite, near the player (what spikes on screen would be)
			const odd = await page.evaluate(() => {
				const scene = Crysis.scene(), W = Crysis.world(), P = W.player.state.pos, out = [];
				const name = (o) => { const n = []; for (let q = o; q && q !== scene; q = q.parent) n.unshift(q.name || q.type); return n.join('/'); };
				scene.traverse((o) => {
					if (!o.visible || !(o.isMesh || o.isPoints || o.isLine)) return;
					const g = o.geometry; if (!g?.attributes?.position) return;
					if (!g.boundingBox) try { g.computeBoundingBox(); } catch { return; }
					const bb = g.boundingBox; if (!bb) return;
					const h = bb.max.y - bb.min.y;
					const bad = (v) => !Number.isFinite(v);
					if ([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].some(bad)) { out.push({ what: 'geometry not finite', name: name(o) }); return; }
					if (o.isInstancedMesh) {
						const a = o.instanceMatrix.array; let worst = 0, nan = 0;
						for (let i = 0; i < o.count; i++) {
							const k = i * 16, sy = Math.hypot(a[k + 4], a[k + 5], a[k + 6]), ty = a[k + 13];
							if (![sy, a[k + 12], ty, a[k + 14]].every(Number.isFinite)) { nan++; continue; }
							if (Math.hypot(a[k + 12] - P.x, a[k + 14] - P.z) > 3000) continue;
							worst = Math.max(worst, sy * h, Math.abs(ty - P.y) > 3000 ? Math.abs(ty - P.y) : 0);
						}
						if (nan || worst > 150) out.push({ what: 'instances', name: name(o), count: o.count, nan, tallest: Math.round(worst), geomH: Math.round(h) });
					} else {
						o.updateWorldMatrix(true, false);
						const sy = Math.hypot(o.matrixWorld.elements[4], o.matrixWorld.elements[5], o.matrixWorld.elements[6]);
						if (h * sy > 400 && !o.userData.update && o.name !== 'sky') out.push({ what: 'tall mesh', name: name(o), height: Math.round(h * sy) });
					}
				});
				return out.slice(0, 60);
			});
			log(tag, 'scan', odd);
			await shot('scan');
		}
		if (steps.includes('soak')) {
			// round the world's places (land, cave mouths, the alien works, a chamber below), a few
			// frames at each, sampling: then what failed in the frame and what the guard saw
			const spots = await page.evaluate(() => {
				const W = Crysis.world(), I = W.island, out = [];
				const r = (() => { let s = 99; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
				for (let k = 0; out.length < 8 && k < 400; k++) { const x = (r() * 2 - 1) * (I.half - 80), z = (r() * 2 - 1) * (I.half - 80); if (I.heightAt(x, z) > 2) out.push([Math.round(x), Math.round(z), 'land']); }
				for (const e of (W.underworld?.entrances || []).slice(0, 3)) out.push([Math.round(e.x), Math.round(e.z), 'cave mouth']);
				for (const s of (W.alien?.sites || []).slice(0, 3)) out.push([s.x + s.r + 8, s.z, 'alien ' + s.type]);
				const ch = W.underworld?.plan?.chambers?.[0]; if (ch) out.push([Math.round(ch.x), Math.round(ch.z), 'chamber', ch.fy]);
				return out;
			});
			for (const [x, z, what, fy] of spots) {
				if (fy != null) await page.evaluate(({ x, z, fy }) => { const W = Crysis.world(), P = W.player.state; P.flying = false; P.pos.set(x, (W.player.floorAt(x, z, fy + 1) ?? fy) + 1.68, z); }, { x, z, fy });
				else await tp(x, z);
				await frames(6);
				await sample(`soak ${what} ${x},${z}`);
			}
			log(tag, 'frame errors kept', await page.evaluate(() => Crysis.frameErrors?.() ?? null));
			log(tag, 'floor guard', await page.evaluate(() => Crysis.floorGuard?.() ?? null));
		}
		if (steps.includes('nan')) {
			// every drawable whose vertices are not all finite numbers, in detail: on Apple's graphics
			// a vertex at infinity is drawn as a triangle out to the edge of the view, fully fogged
			const bad = await page.evaluate(() => {
				const scene = Crysis.scene(), out = [];
				const path = (o) => { const n = []; for (let q = o; q && q !== scene; q = q.parent) n.unshift(q.name || q.type); return n.join('/'); };
				scene.traverse((o) => {
					const g = o.geometry; if (!g?.attributes) return;
					const rep = {};
					for (const [k, a] of Object.entries(g.attributes)) {
						const arr = a.array; if (!arr || !(arr instanceof Float32Array || arr instanceof Float64Array)) continue;
						let n = 0, first = -1;
						for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { n++; if (first < 0) first = i; }
						if (n) rep[k] = { bad: n, of: arr.length, firstIndex: first, itemSize: a.itemSize, instanced: !!a.isInstancedBufferAttribute };
					}
					let inst = 0;
					if (o.isInstancedMesh) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count * 16; i++) if (!Number.isFinite(a[i])) inst++; }
					if (Object.keys(rep).length || inst) {
						const m = Array.isArray(o.material) ? o.material[0] : o.material;
						out.push({ path: path(o), type: o.type, visible: o.visible, inScene: true, count: o.count ?? null, verts: g.attributes.position?.count, attrs: rep, instanceMatrixBad: inst, material: m && { type: m.type, name: m.name, key: (() => { try { return String(m.customProgramCacheKey?.()).slice(0, 80); } catch { return null; } })(), color: m.color?.getHexString?.() }, userData: Object.keys(o.userData || {}).slice(0, 12), geomUserData: Object.keys(g.userData || {}).slice(0, 12), position: o.position.toArray().map(Math.round), parentType: o.parent?.type, siblings: o.parent?.children?.length });
					}
				});
				return out;
			});
			log(tag, 'non-finite geometry', bad);
		}
		if (steps.includes('rays')) {
			// the sunbeams in mist (world/sunrays.js) under trees on a misty morning, looking toward
			// the sun: what they look like on a phone tier, and with them off, for the same view
			const look = async (label, mode) => {
				await page.evaluate((mode) => {
					const W = Crysis.world(), P = W.player.state, s = W.sky.state;
					s.hours = 7.6; Crysis.rays(mode);
					const sd = Crysis.world().sky.sun.position.clone().sub(W.sky.sun.target?.position || P.pos).normalize();
					P.yaw = Math.atan2(-sd.x, -sd.z); P.pitch = 0.12;
				}, mode);
				await frames(4);
				const info = await page.evaluate(() => ({ rays: Crysis.rays(), shown: Crysis.scene().getObjectByName('sunrays')?.visible ?? null, governor: Crysis.governor().tier }));
				log(tag, label, info);
				await shot(label.replace(/\s+/g, '-'));
			};
			await look('rays forced', 'force');
			await look('rays off', 'off');
			await page.evaluate(() => Crysis.rays('on'));
		}
		if (steps.includes('cavethrow')) {
			// down in a cave, one step of the frame starts failing; then back up on the surface
			const ch = await page.evaluate(() => {
				const W = Crysis.world(), U = W.underworld?.plan; if (!U) return null;
				const far = (c) => Math.min(...U.holes.map((h) => Math.hypot(h.x - c.x, h.z - c.z) - h.r));
				const c = [...U.chambers].sort((a, b) => far(b) - far(a))[0];
				return { x: c.x, z: c.z, fy: c.fy, fromHole: Math.round(far(c)) };
			});
			log(tag, 'cave chamber', ch);
			if (ch) {
				await page.evaluate((c) => { const W = Crysis.world(), P = W.player.state; P.flying = false; P.vel.set(0, 0, 0); P.pos.set(c.x, (W.player.floorAt(c.x, c.z, c.fy + 1) ?? c.fy) + 1.68, c.z); }, ch);
				for (let k = 0; k < 8; k++) { await frames(2); if (await page.evaluate(() => Crysis.world().underworld.inside() > 0.95)) break; }
				await sample('in the cave');
				await page.evaluate(() => { const W = Crysis.world(); W.__whale = W.whale.update; W.whale.update = () => { throw new Error('harness: a step of the frame failing every frame'); }; });
				await frames(2);
				await page.evaluate((c) => { const W = Crysis.world(), P = W.player.state; P.vel.set(0, 0, 0); P.pos.set(c.x, W.island.heightAt(c.x, c.z) + 1.68, c.z); P.pitch = -0.5; }, ch);
				await frames(4);
				await sample('back on the surface, the frame failing');
				await shot('cave-throw-surface');
				await page.evaluate(() => { const W = Crysis.world(); W.whale.update = W.__whale; });
				await frames(3);
				await sample('cave throw cleared');
			}
		}
		if (steps.includes('throw')) {
			// one step of the frame failing every frame, after the player has moved (the whale's
			// update stands for any of them): then travel across the land and look at the ground
			// (from one end of the land to the other: the longest walk the world has)
			const route = await page.evaluate(() => {
				const W = Crysis.world(), I = W.island, land = [];
				for (let z = -I.half + 60; z < I.half - 60; z += 30) for (let x = -I.half + 60; x < I.half - 60; x += 30) if (I.heightAt(x, z) > 3) land.push([x, z]);
				const far = (p) => land.reduce((b, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) > Math.hypot(b[0] - p[0], b[1] - p[1]) ? q : b), p);
				const a = far([0, 0]), b = far(a), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
				const pts = []; const n = Math.max(2, Math.ceil(d / 350));
				for (let k = 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; if (I.heightAt(x, z) > 1) pts.push([Math.round(x), Math.round(z), Math.round(Math.hypot(x - a[0], z - a[1]))]); }
				return { from: a, to: b, pts };
			});
			log(tag, 'throw route', route);
			await tp(route.from[0], route.from[1]);
			await page.evaluate(() => { const W = Crysis.world(); W.__whale = W.whale.update; W.whale.update = () => { throw new Error('harness: a step of the frame failing every frame'); }; });
			await frames(2);
			for (const [x, z, d] of route.pts) { await tp(x, z); await sample(`throw ${d} m on`); }
			await page.evaluate(() => { const P = Crysis.world().player.state; P.pitch = -0.45; });
			await shot('throw-far');
			await page.evaluate(() => { const W = Crysis.world(); W.whale.update = W.__whale; });
			await frames(3);
			await sample('throw cleared');
		}
		if (steps.includes('grid')) {
			// the walked floor against the height map over the whole land, on the CPU (fast): every
			// place something other than the land holds the player up, to probe on the GPU after
			const raised = await page.evaluate(() => {
				const W = Crysis.world(), I = W.island, outp = [];
				for (let z = -I.half + 20; z < I.half; z += 20) for (let x = -I.half + 20; x < I.half; x += 20) {
					const h = I.heightAt(x, z); if (h < 0.5) continue;
					const f = W.player.floorAt(x, z, h + 0.5);
					if (f != null && Math.abs(f - h) > 5) outp.push([x, z, Math.round(h), Math.round(f)]);
				}
				return outp;
			});
			log(tag, 'grid raised floors', raised.length, raised.slice(0, 40));
			for (const [x, z] of raised.filter((_, i) => i % Math.max(1, Math.ceil(raised.length / 8)) === 0)) { await tp(x, z); await sample(`raised ${x},${z}`); }
		}
		if (steps.includes('walk')) {
			// walk (run) across the land from the spawn toward the peak and on, sampling as it goes
			await page.evaluate(() => { const W = Crysis.world(), P = W.player.state, I = W.island, s = I.spawn || { x: 0, z: 0 }; P.flying = false; P.pos.set(s.x, W.player.floorAt(s.x, s.z, I.heightAt(s.x, s.z) + .5) + 1.68, s.z); const dx = (I.peak?.x ?? 0) - s.x, dz = (I.peak?.z ?? 0) - s.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = -0.35; P.auto = { x: 0, z: -1, run: true }; });
			for (let i = 0; i < 12; i++) { await frames(4); await sample(`walk ${i}`); }
			await page.evaluate(() => { Crysis.world().player.state.auto = null; });
		}
		if (steps.includes('tier')) {
			for (const t of [3, 2, 1, 0]) {
				await page.evaluate((t) => Crysis.governorTier(t), t);
				await frames(3);
				await sample(`tier ${t}`);
			}
		}
		if (steps.includes('lost')) {
			await page.evaluate(() => { const gl = window.L99Island.renderer().getContext(); window.__lose = gl.getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
			await page.waitForTimeout(3000);
			await page.evaluate(() => window.__lose.restoreContext());
			await frames(4);
			await sample('after context restore');
			await shot('after-restore');
		}
		if (steps.includes('far')) {
			const half = info.half;
			for (const d of [half - 60, half + 40, half + 400, half + 1500, half + 3600]) { await tp(d, 0); await sample(`far x=${Math.round(d)}`); }
			await shot('far');
			const s = info.spawn || { x: 0, z: 0 };
			await tp(s.x, s.z);
			await sample('back at spawn');
		}
		if (steps.includes('orbit')) {
			// up to orbit and down again over the same ground
			const s = info.spawn || { x: 0, z: 0 };
			for (const y of [3000, 13000, 70000, 30000, 9000, 2000]) { await tp(s.x, s.z, { fly: true, y, frames: 3 }); await sample(`orbit y=${y}`); }
			await page.evaluate(() => { const W = Crysis.world(), P = W.player.state; P.flying = false; });
			await tp(s.x + 30, s.z + 30, { frames: 4 });
			await sample('landed from orbit');
			await shot('landed');
		}
		log(tag, 'errors', errs.slice(0, 8));
		await ctx.close();
	}
	await browser.close(); server.close();
	fs.writeFileSync(path.join(out, 'flags.json'), JSON.stringify(flags, null, 2));
	log('FLAGS', flags.length);
	process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
