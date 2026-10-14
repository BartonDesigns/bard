// Law and order in the real game: enters Earth, goes downtown, and stages five scenes one
// after another, each run on for a minute or two of game time by stepping the fight and the
// military directly (a software renderer is far too slow to wait for in real time):
//   gang     two gangs shooting it out on a downtown street, reported as the director does
//   crime    you punch a passer-by with another standing by to see it
//   shootout you trade fire with a gang crew at thirty metres
//   boss     a boss loose on the land (the military's business)
//   invasion an Ironvale column over the border (the military's business)
// Every game second it records what each side does (the wanted level, the cruisers, the
// convoys, the squads and their targets) and looks for the faults: units stuck in place, units
// inside buildings, units made or let go in plain view, police ignoring a crime, the military
// sent for a small one, nobody going home. Pictures of the scenes are saved as it goes.
//   GOTO=37.7880,-122.4075 node island/tools/law-scenarios-browser.cjs [outdir] [tag]
// Needs a built island/dist/island.js. Writes <outdir>/<tag>.json.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright');
const root = process.env.ROOT || path.resolve(__dirname, '../..');
const OUT = process.argv[2] || '/tmp/law-shots';
const TAG = process.argv[3] || 'run';
const ONLY = (process.env.SCENES || 'gang,crime,shootout,boss,invasion').split(',');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// the probe, installed in the page: steps the game and samples what everyone is doing
function install() {
	const C = window.Crysis.combat, M = window.Crysis.military.api, W = () => window.Crysis.world(), cam = () => window.L99Island.camera();
	// the page's own frames slowed right down: the scenes are stepped here, and a software
	// renderer drawing every frame would hold the page up between steps
	const raf = window.requestAnimationFrame.bind(window);
	window.requestAnimationFrame = (f) => setTimeout(() => raf(f), 1500);
	const V = cam().position.constructor;
	const seen = new Map(), track = new Map();
	const S = { t: 0, samples: [], faults: { spawnInView: [], vanishInView: [], insideBuilding: [], stuck: [] }, events: [], perf: { combat: 0, military: 0, steps: 0 } };
	const boxIn = (b, x, z) => { const c = Math.cos(b.a || 0), s = Math.sin(b.a || 0), dx = x - b.x, dz = z - b.z, lx = c * dx + s * dz, lz = -s * dx + c * dz; return Math.abs(lx) < b.w / 2 - 0.4 && Math.abs(lz) < b.d / 2 - 0.4; };
	const inside = (x, z) => { const w = W(); if (!w?.real?.loaded?.()) return false; return w.real.near('boxes', x, z, 30).some((b) => b.w > 2 && boxIn(b, x, z)); };
	// in plain view: in front of the camera, near enough, nothing in the way
	function inView(x, y, z) {
		const c = cam(), d = new V(); c.getWorldDirection(d);
		const to = new V(x - c.position.x, y + 1 - c.position.y, z - c.position.z), L = to.length();
		if (L > 160 || L < 0.5) return false;
		if (to.clone().normalize().dot(d) < Math.cos(0.75)) return false;
		const h = C.firstHit(c.position.clone(), to.clone().normalize(), L - 1);
		return !(h && h.wall);
	}
	function sample() {
		const list = C.squads.list, now = new Set();
		for (const h of list) {
			now.add(h.id);
			if (!seen.has(h.id)) {
				seen.set(h.id, { fid: h.fid, t: S.t });
				if (S.t > 0.5 && !h.dead && inView(h.pos.x, h.pos.y, h.pos.z)) S.faults.spawnInView.push({ t: +S.t.toFixed(1), id: h.id, fid: h.fid, d: Math.round(Math.hypot(h.pos.x - cam().position.x, h.pos.z - cam().position.z)) });
			}
			if (h.dead) continue;
			if (inside(h.pos.x, h.pos.z)) S.faults.insideBuilding.push({ t: +S.t.toFixed(1), id: h.id, fid: h.fid });
			const k = track.get(h.id);
			const wants = h.body?.M?.want?.speed > 0.3;
			if (!k || !wants) track.set(h.id, { x: h.pos.x, z: h.pos.z, t: S.t });
			else if (Math.hypot(h.pos.x - k.x, h.pos.z - k.z) > 0.6) track.set(h.id, { x: h.pos.x, z: h.pos.z, t: S.t });
			else if (S.t - k.t > 8 && !k.flagged) { k.flagged = true; S.faults.stuck.push({ t: +S.t.toFixed(1), id: h.id, fid: h.fid, role: h.role }); }
			seen.get(h.id).last = { x: h.pos.x, y: h.pos.y, z: h.pos.z, dead: h.dead };
		}
		for (const [id, q] of seen) if (!now.has(id) && !q.gone) {
			q.gone = true;
			if (q.last && !q.last.dead && inView(q.last.x, q.last.y, q.last.z)) S.faults.vanishInView.push({ t: +S.t.toFixed(1), id, fid: q.fid });
		}
		const fac = {};
		for (const h of list) { if (h.dead) continue; const f = (fac[h.fid] ||= { n: 0, alert: 0, onYou: 0, cover: 0, roles: {} }); f.n++; if (h.alert) f.alert++; if (h.target?.id === 'me') f.onYou++; if (h.inCover) f.cover++; f.roles[h.role] = (f.roles[h.role] || 0) + 1; }
		const law = window.Crysis.law?.() || null;
		const pol = M.police.info(), pat = M.dispatch.info();
		S.samples.push({ t: +S.t.toFixed(1), stars: C.wantedLevel(), fac, police: pol.map((c) => `${c.why}:${c.state}`), patrols: pat.map((p) => `${p.side}/${p.why}:${p.state}:${p.units.join('+')}`), law: law && { level: law.level, stage: law.stage, reports: law.reports?.length, blocks: law.roadblocks?.length } });
	}
	window.__law = {
		S,
		step(seconds, dt = 0.1) {
			const n = Math.round(seconds / dt);
			for (let i = 0; i < n; i++) {
				const t0 = performance.now();
				C.update(dt);
				const t1 = performance.now();
				M.update(dt, 0); window.Crysis.lawStep?.(dt);
				const t2 = performance.now();
				S.perf.combat += t1 - t0; S.perf.military += t2 - t1; S.perf.steps++;
				S.t += dt;
				if (Math.floor(S.t) !== Math.floor(S.t - dt)) sample();
			}
			return S.t;
		},
		reset() { C.clear(); C.wanted(0); M.police.clear(); M.dispatch.clear(); window.Crysis.law?.reset?.(); seen.clear(); track.clear(); S.t = 0; S.samples = []; S.events = []; for (const k of Object.keys(S.faults)) S.faults[k] = []; },
		look(x, z) { const p = W().player.state, dx = x - p.pos.x, dz = z - p.pos.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = -0.08; const c = cam(); c.position.copy(p.pos); c.rotation.set(p.pitch, p.yaw, 0, 'YXZ'); },
		shot() { const I = window.L99Island, r = I.renderer(); r.render(I.scene(), I.camera()); return r.domElement.toDataURL('image/png'); },
	};
	return true;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const server = http.createServer((q, r) => {
		const f = path.join(root, decodeURIComponent(new URL(q.url, 'http://x').pathname));
		if (!f.startsWith(root)) { r.writeHead(403).end(); return; }
		try { r.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); r.end(fs.readFileSync(f)); } catch { r.writeHead(404).end(); }
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const errors = [], report = { tag: TAG, scenes: {} };
	try {
		const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
		page.on('pageerror', (e) => errors.push('page: ' + e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/island/dev.html`, { waitUntil: 'commit', timeout: 0 });
		for (let i = 0; i < 300; i++) { await page.waitForTimeout(1000); if (await page.evaluate(() => !!window.Crysis?.world?.()?.player).catch(() => false)) break; }
		for (let i = 0; i < 240; i++) {
			const entered = await page.evaluate(() => { if (!window.L99Loading?.active()) return true; const b = [...document.querySelectorAll('button')].find((x) => !x.hidden && /^Enter world$/.test(x.textContent.trim())); b?.click(); return false; }).catch(() => false);
			if (entered) break;
			await page.waitForTimeout(1000);
		}
		log('entered');
		const [lat, lon] = (process.env.GOTO || '37.7880,-122.4075').split(',').map(Number);
		await page.evaluate(([a, b]) => window.Crysis.goTo(a, b, 2), [lat, lon]);
		await page.evaluate(() => { window.Crysis.world().sky.state.hours = 13; window.Crysis.combat.ambient(false); });
		for (let i = 0; i < +(process.env.SETTLE || 90); i++) {
			await page.waitForTimeout(1000);
			const s = await page.evaluate(() => ({ real: !!window.Crysis.world().real?.loaded?.(), people: (window.Crysis.world().people?.pool || []).filter((p) => p.active).length, zone: window.Crysis.combat.zone() })).catch((e) => ({ err: String(e) }));
			if (i % 15 === 0) log('settle', JSON.stringify(s));
			if (i > 40 && s.real && s.zone === 'earth-urban') break;
		}
		await page.evaluate(install);
		const shot = async (name) => { try { const d = await page.evaluate(() => window.__law.shot()); const f = path.join(OUT, `${TAG}-${name}.png`); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); log('shot', f); return f; } catch (e) { log('shot failed', String(e)); return null; } };

		const scenes = {
			// two gangs and the director's report of it
			async gang() {
				return page.evaluate(() => { const C = window.Crysis.combat, r = C.fight('copperline', 'glasshouse', 3, 70); const e = C.eye(); C.hooks.event?.({ kind: 'gang', x: e.x, z: e.z - 70, severity: 1 }); window.Crysis.law?.incident?.({ kind: 'gang', x: e.x, z: e.z - 70, severity: 1 }); return r; });
			},
			// you hit someone in the street with a witness near
			async crime() {
				return page.evaluate(() => {
					const C = window.Crysis.combat, e = C.eye();
					const civ = C.targets().filter((t) => t.kind === 'person' && !t.child && t.faction === 'civ').sort((a, b) => a.d - b.d);
					const T = civ[0] && C.layer.get(civ[0].id);
					if (!T) return 'nobody near';
					for (let i = 0; i < 2; i++) C.deal(T, { amount: 9, type: 'impact', part: 'torso', src: e.clone(), dir: { x: T.bound.x - e.x, y: 0, z: T.bound.z - e.z }, by: C.me }, true);
					return { victim: civ[0].d, witnesses: civ.length - 1 };
				});
			},
			// a gang crew at thirty metres, and you shooting at them
			async shootout() {
				await page.evaluate(() => { const C = window.Crysis.combat; C.arm('warden-spark-carbine'); C.ammo(300); return C.spawn('copperline', 3, { d: 30, alert: true }); });
				for (let k = 0; k < 20; k++) {
					await page.evaluate(() => { const C = window.Crysis.combat; const t = C.squads.alive().find((h) => h.fid === 'copperline'); if (t) { C.aimAt(t.id); C.shoot(30); } window.__law.step(0.6); });
				}
				return 'fired';
			},
			async boss() { return page.evaluate(() => { const r = window.Crysis.combat.boss('walker'); return r?.name || r; }); },
			async invasion() { return page.evaluate(() => window.Crysis.military.api.invade()); },
		};
		const RUN = { gang: 90, crime: 100, shootout: 110, boss: 90, invasion: 150 };
		// pictures staged on purpose (SCENES=corner,roadblock,response,convoy): each steps until
		// there is something to see, turns to it, and saves the frame
		const step = (s) => page.evaluate((n) => window.__law.step(n), s);
		// (walked up to about 24 m from it first, so it fills the frame)
		const lookShot = async (name, at, d = 24) => {
			if (!at) return null;
			await page.evaluate(([x, z, d]) => { const p = window.Crysis.world().player.state, C = window.Crysis.combat; const dx = p.pos.x - x, dz = p.pos.z - z, l = Math.hypot(dx, dz) || 1; if (l > d) { const nx = x + dx / l * d, nz = z + dz / l * d; p.pos.set(nx, C.ground(nx, nz, 1e4) + 1.68, nz); } window.__law.look(x, z); }, [at.x, at.z, d]);
			await page.waitForTimeout(4000);
			await page.evaluate(([x, z]) => window.__law.look(x, z), [at.x, at.z]);
			return shot(name);
		};
		const until = async (secs, probe) => { for (let t = 0; t < secs; t += 2) { await step(2); const r = await page.evaluate(probe); if (r) return r; } return null; };
		const PICS = {
			async corner() { await page.evaluate(() => window.Crysis.law.corner()); const at = await until(30, () => { const h = window.Crysis.combat.squads.alive().find((q) => q.corner); return h && h.body?.P.root.visible ? { x: h.pos.x, z: h.pos.z } : null; }); await step(4); return lookShot('gang-corner', at); },
			async roadblock() {
				await page.evaluate(() => { const C = window.Crysis.combat; C.wanted(3); C.sighted(C.eye()); });
				let at = await until(12, () => { const c = window.Crysis.military.api.police.cruisers.find((q) => q.why === 'block'); return c ? { x: c.pos.x, z: c.pos.z } : null; });
				if (!at) { await page.evaluate(() => { const p = window.Crysis.world().player.state; p.yaw += Math.PI; }); at = await until(12, () => { const c = window.Crysis.military.api.police.cruisers.find((q) => q.why === 'block'); return c ? { x: c.pos.x, z: c.pos.z } : null; }); }
				await step(6);
				return lookShot('roadblock', at);
			},
			async response() {
				await page.evaluate(() => { const C = window.Crysis.combat; C.wanted(1); C.sighted(C.eye()); });
				const at = await until(150, () => { const c = window.Crysis.military.api.police.cruisers.find((q) => q.state === 'arrived'); return c ? { x: c.pos.x, z: c.pos.z } : null; });
				await step(4);
				return lookShot('police-response', at);
			},
			async convoy() {
				await page.evaluate(() => window.Crysis.military.api.invade());
				const at = await until(900, () => { for (const p of window.Crysis.military.api.dispatch.patrols) if (p.side === 'guard') for (const u of p.units) if (u.mesh && !u.air) return { x: u.pos.x, z: u.pos.z }; return null; });
				return lookShot('military-convoy', at);
			},
		};
		for (const name of ONLY) {
			if (PICS[name]) { await page.evaluate(() => window.__law.reset()); const f = await PICS[name]().catch((e) => 'ERR ' + e); log('pic', name, f); (report.pics ||= {})[name] = f; continue; }
			if (!scenes[name]) continue;
			await page.evaluate(() => window.__law.reset());
			const start = await scenes[name]().catch((e) => 'ERR ' + e);
			log(name, 'start', JSON.stringify(start));
			const pics = [];
			for (let t = 0; t < RUN[name]; t += 10) {
				for (let k = 0; k < 5; k++) await page.evaluate(() => window.__law.step(2)).catch((e) => log('step', String(e)));
				log(name, 't', t + 10, JSON.stringify(await page.evaluate(() => { const S = window.__law.S, p = S.perf; return { ms: Math.round((p.combat + p.military) / Math.max(1, p.steps)), c: Math.round(p.combat / Math.max(1, p.steps)), last: S.samples[S.samples.length - 1] }; })));
				// a picture when there is something to see: a cruiser, a roadblock, a convoy in sight
				if (pics.length < 2 && (t === 30 || t === 70)) {
					const at = await page.evaluate(() => { const M = window.Crysis.military.api, e = window.Crysis.combat.eye(); const c = M.police.cruisers.find((q) => q.state !== 'leaving'); if (c) return { x: c.pos.x, z: c.pos.z, what: 'cruiser' }; const p = M.dispatch.patrols.find((q) => q.units.some((u) => u.mesh)); const u = p && p.units.find((q) => q.mesh); if (u) return { x: u.pos.x, z: u.pos.z, what: 'convoy' }; const h = window.Crysis.combat.squads.alive()[0]; return h ? { x: h.pos.x, z: h.pos.z, what: h.fid } : { x: e.x, z: e.z - 10, what: 'street' }; });
					await page.evaluate(([x, z]) => window.__law.look(x, z), [at.x, at.z]);
					pics.push({ t, what: at.what, file: await shot(`${name}-${t}-${at.what}`) });
				}
			}
			const S = await page.evaluate(() => JSON.parse(JSON.stringify(window.__law.S)));
			const firstPolice = S.samples.find((s) => s.police.some((p) => /arrived/.test(p)));
			const anyPolice = S.samples.find((s) => s.police.length);
			const military = S.samples.find((s) => s.patrols.some((p) => p.startsWith('guard')));
			const peak = Math.max(0, ...S.samples.map((s) => s.stars));
			const last = S.samples[S.samples.length - 1];
			report.scenes[name] = {
				start, pics, peakStars: peak, starsAt5s: S.samples[4]?.stars ?? null,
				policeSentAt: anyPolice?.t ?? null, policeOnSceneAt: firstPolice?.t ?? null, militarySentAt: military?.t ?? null,
				end: last, faults: Object.fromEntries(Object.entries(S.faults).map(([k, v]) => [k, { n: v.length, first: v.slice(0, 4) }])),
				timeline: S.samples.filter((s, i) => i % 5 === 0),
			};
			log(name, JSON.stringify({ peak, police: anyPolice?.t, onScene: firstPolice?.t, military: military?.t, faults: Object.fromEntries(Object.entries(S.faults).map(([k, v]) => [k, v.length])) }));
		}
	} catch (e) { errors.push('harness: ' + (e.stack || e)); }
	report.errors = errors.slice(0, 20);
	fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(report, null, 1));
	log('wrote', path.join(OUT, `${TAG}.json`), 'errors', errors.length);
	await browser.close(); server.close();
})();
