// Persistent resident integration against the actual faceplate, people pool and terrain.
// Run with local server in the same command namespace, under /tmp/bard-browser.lock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const out = process.env.BARD_SOCIAL_OUT || '/tmp/bard-social-qa';
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
		const boot = async () => {
			await page.evaluate(async () => {
				const api = await L99IslandDoor.engine(); await api.open({ seed: 1337, earth: false, biome: 'TROPICAL' });
				Crysis.music.auto(false); window._KEYS_PLAY_ON = false;
				const W = api.world(), p = W.player.state, v = W.island.village;
				p.pos.set(v.x, W.island.heightAt(v.x, v.z) + 1.7, v.z + 7); p.vel.set(0, 0, 0); p.flying = true;
				api.camera().position.copy(p.pos); W.sky.state.speed = 0; W.sky.state.hours = 13;
			});
		};
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await boot();
		await page.waitForFunction(() => L99Island.people.pool.filter(p => p.active && !p.P.dna.child && p.detachForSocial).length >= 3);
		// Pause unrelated crowd streaming; all actions below use the production guide,
		// resident controller, motion, body and collision methods without mock actors.
		await page.evaluate(() => { L99Island.close(); L99Island.dom.mount.style.display = 'block'; });
		const met = await page.evaluate(() => {
			const api = L99Island, W = api.world(), people = api.people, S = Crysis.social();
			window.socialTest = { time: 0 };
			const test = window.socialTest;
			test.floor = (x, z, y = W.island.heightAt(x, z)) => W.player.floorAt(x, z, y);
			test.route = (a, b) => {
				let y = a.y; const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .1);
				for (let i = 1; i <= steps; i++) {
					const x = a.x + (b.x - a.x) * i / steps, z = a.z + (b.z - a.z) * i / steps, next = test.floor(x, z, y);
					if (!Number.isFinite(next) || next < .4 || Math.abs(next - y) > .25) return false;
					const p = new api.T.Vector3(x, next + 1.68, z); W.player.pushOut(p);
					if (Math.hypot(p.x - x, p.z - z) > .015) return false; y = next;
				}
				return true;
			};
			const candidates = people.pool.filter(p => p.active && !p.P.dna.child && p.detachForSocial);
			let actor, destination;
			for (const p of candidates) for (let k = 0; k < 24 && !actor; k++) {
				const a = k / 24 * Math.PI * 2, q = { x: p.M.S.pos.x + Math.cos(a) * 11, z: p.M.S.pos.z + Math.sin(a) * 11 };
				if (test.route(p.M.S.pos, q)) { actor = p; destination = q; }
			}
			if (!actor) throw Error('No clear real-terrain follow route from an actual village NPC');
			const originalBody = actor.P, root = actor.P.root, pos = actor.M.S.pos.clone(), dna = JSON.stringify(actor.P.dna);
			api.camera().position.set(pos.x + 1.5, pos.y + 1.7, pos.z + 1.5);
			api.guide.talkTo(actor);
			const record = S.state.get(actor.residentId);
			if (!record || S.actors.all().find(p => p.residentId === record.id) !== actor || actor.P !== originalBody || actor.P.root !== root || people.pool.includes(actor)) throw Error('Talking did not promote the exact existing body');
			test.id = record.id; test.actor = actor; test.destination = destination; test.originalRoot = root;
			test.step = (seconds) => { for (let i = 0; i < seconds * 60; i++) { test.time += 1 / 60; S.update(1 / 60, test.time, true); } };
			return { id: record.id, dna, home: record.home, bodyKey: record.bodyKey, name: record.persona.name, poolRemaining: people.pool.length, info: S.actors.info() };
		});
		console.log('Exact ambient body promoted', JSON.stringify({ name: met.name, home: met.home, poolRemaining: met.poolRemaining, info: met.info }));
		const follow = await page.evaluate(async () => {
			const api = L99Island, S = Crysis.social(), t = socialTest, p = t.actor, start = p.M.S.pos.clone();
			await api.guide.ask('follow me'); const mode = S.state.get(t.id).mode;
			api.guide.endTalk(); api.guide.show(false);
			const d = t.destination; api.camera().position.set(d.x, t.floor(d.x, d.z, start.y) + 1.7, d.z);
			t.step(8); const moved = p.M.S.pos.distanceTo(start), remaining = Math.hypot(p.M.S.pos.x - d.x, p.M.S.pos.z - d.z);
			api.guide.talkTo(p); await api.guide.ask('wait here'); api.guide.endTalk(); api.guide.show(false);
			const waiting = p.M.S.pos.clone(); api.camera().position.x += 4; t.step(3);
			return { mode, moved, remaining, waiting: S.state.get(t.id).mode, waitDrift: p.M.S.pos.distanceTo(waiting), history: S.state.get(t.id).history };
		});
		assert.equal(follow.mode, 'follow'); assert.ok(follow.moved > 5); assert.ok(follow.remaining < 4);
		assert.equal(follow.waiting, 'wait'); assert.ok(follow.waitDrift < .1);
		assert.ok(follow.history.some(t => t.role === 'user' && t.content === 'follow me'));
		assert.ok(follow.history.some(t => t.role === 'assistant' && /follow you/.test(t.content)));
		console.log('Guide commands moved the real NPC and wait stopped them', JSON.stringify(follow));
		const warning = await page.evaluate(async () => {
			const api = L99Island, S = Crysis.social(), t = socialTest, p = t.actor, source = p.M.S.pos.clone();
			const ambient = api.people.pool.filter(a => !a.P.dna.child && a.detachForSocial);
			if (ambient.length < 2) throw Error('Need two real ambient villagers as localized-warning controls');
			const near = ambient[0], far = ambient[1];
			let q = null;
			for (let k = 0; k < 24 && !q; k++) { const a = k / 24 * Math.PI * 2, at = { x: source.x + Math.cos(a) * 3, z: source.z + Math.sin(a) * 3 }; if (t.route(source, { x: source.x + Math.cos(a) * 6, z: source.z + Math.sin(a) * 6 })) q = at; }
			if (!q) throw Error('No dry warning response route');
			near.M.place(q.x, t.floor(q.x, q.z, source.y), q.z, 0); near.P.root.visible = true; near.active = true;
			far.M.place(source.x + 165, source.y, source.z + 165, 0); far.P.root.visible = true; far.active = true;
			const nearStart = near.M.S.pos.clone(), farStart = far.M.S.pos.clone();
			api.guide.talkTo(p); await api.guide.ask('warn the villagers');
			const alarm = S.state.alarmFor(S.bodyKey(), S.positionFor(api.world(), nearStart)); t.step(2);
			const nearMove = near.M.S.pos.distanceTo(nearStart), farMove = far.M.S.pos.distanceTo(farStart);
			await api.guide.ask('calm the villagers'); const cleared = S.state.alarmFor(S.bodyKey(), S.positionFor(api.world(), near.M.S.pos)).level;
			const calmStart = near.M.S.pos.clone(); t.step(2); const calmDrift = near.M.S.pos.distanceTo(calmStart);
			api.guide.endTalk(); api.guide.show(false);
			return { alarm: alarm.level, nearMove, farMove, cleared, calmDrift };
		});
		assert.ok(warning.alarm > .2 && warning.nearMove > .3); assert.equal(warning.farMove, 0); assert.equal(warning.cleared, 0); assert.equal(warning.calmDrift, 0);
		console.log('Local warning and all clear used actual ambient villagers', JSON.stringify(warning));
		const scout = await page.evaluate(async () => {
			const api = L99Island, S = Crysis.social(), t = socialTest, p = t.actor;
			api.guide.talkTo(p); await api.guide.ask('go home'); api.guide.endTalk(); api.guide.show(false);
			api.camera().position.copy(p.M.S.pos).add(new api.T.Vector3(0, 1.7, 0));
			t.step(30);
			// A named destination may be obstructed; its reply must describe the actual
			// saved outcome instead of claiming an errand completed through a wall.
			api.guide.talkTo(p); await api.guide.ask('scout the village'); api.guide.endTalk(); api.guide.show(false);
			const named = JSON.parse(JSON.stringify(S.state.get(t.id))); let namedClosest = Infinity;
			for (let i = 0; i < 60 * 100 && ['scout', 'home'].includes(S.state.get(t.id).mode); i++) {
				t.time += 1 / 60; S.update(1 / 60, t.time, true);
				if (named.task?.target) namedClosest = Math.min(namedClosest, Math.hypot(p.M.S.pos.x - named.task.target.x, p.M.S.pos.z - named.task.target.z));
			}
			const namedFinal = S.state.get(t.id), namedOutcome = { status: namedFinal.task?.status, report: namedFinal.task?.report, closest: namedClosest };
			if (namedOutcome.status === 'blocked' && /completed|returned home|reached the scouting/i.test(namedOutcome.report)) throw Error('Blocked scouting falsely claimed completion');
			if (namedOutcome.status === 'completed' && namedClosest >= 1.8) throw Error('Named scouting completed without visiting its target');
			if (!['blocked', 'completed'].includes(namedOutcome.status)) throw Error('Named scouting never reached an honest terminal outcome');
			api.guide.talkTo(p); await api.guide.ask('go home'); api.guide.endTalk(); api.guide.show(false); t.step(30);
			api.guide.talkTo(p); await api.guide.ask('scout nearby');
			const requested = JSON.parse(JSON.stringify(S.state.get(t.id))), initial = p.M.S.pos.clone(); api.guide.endTalk(); api.guide.show(false);
			if (requested.mode !== 'scout' || !requested.task?.target) throw Error('Guide did not schedule a real nearby scouting target: ' + JSON.stringify(requested));
			let closest = Infinity, returning = false, maxTravel = 0;
			for (let i = 0; i < 60 * 160; i++) {
				t.time += 1 / 60; S.update(1 / 60, t.time, true);
				closest = Math.min(closest, Math.hypot(p.M.S.pos.x - requested.task.target.x, p.M.S.pos.z - requested.task.target.z));
				maxTravel = Math.max(maxTravel, p.M.S.pos.distanceTo(initial));
				const r = S.state.get(t.id); returning ||= r.task?.status === 'returning';
				if (r.task?.status === 'completed' || r.task?.status === 'blocked') break;
			}
			const final = JSON.parse(JSON.stringify(S.state.get(t.id)));
			if (final.task?.status !== 'completed') throw Error('Actual scout did not complete: ' + JSON.stringify({ closest, maxTravel, target: requested.task.target, mode: final.mode, task: final.task }));
			api.guide.talkTo(p); await api.guide.ask('report'); api.guide.endTalk(); api.guide.show(false); S.flush();
			return { namedOutcome, target: requested.task.target, label: requested.task.label, closest, returning, maxTravel, final, homeDistance: Math.hypot(p.M.S.pos.x - final.home.x, p.M.S.pos.z - final.home.z) };
		});
		assert.ok(scout.closest < 1.8 && scout.returning && scout.maxTravel > 2 && scout.homeDistance < 1.8);
		assert.equal(scout.final.mode, 'wait'); console.log('Scout physically reached its destination and returned', JSON.stringify({ namedOutcome: scout.namedOutcome, target: scout.target, label: scout.label, closest: scout.closest, returning: scout.returning, maxTravel: scout.maxTravel, homeDistance: scout.homeDistance, status: scout.final.task.status }));
		const saved = await page.evaluate(() => { Crysis.social().flush(); return JSON.parse(localStorage.getItem('crysis-social-v1')); });
		assert.deepEqual(saved.residents[met.id].home, met.home); assert.equal(JSON.stringify(saved.residents[met.id].dna), met.dna);
		await page.evaluate(() => {
			const api = L99Island, p = socialTest.actor, pos = p.M.S.pos;
			api.camera().position.set(pos.x + 3, pos.y + 1.7, pos.z + 4); api.camera().lookAt(pos.x, pos.y + 1.1, pos.z); api.camera().updateMatrixWorld(true);
			api.renderer().render(api.scene(), api.camera()); api.renderer().getContext().finish();
		});
		await page.screenshot({ path: `${out}/resident.png` });
		await page.evaluate(() => L99Island.guide.showPeople());
		await page.screenshot({ path: `${out}/remembered-people.png` });
		assert.ok((await page.locator('body').innerText()).includes(met.name));
		await page.reload({ waitUntil: 'domcontentloaded' }); await boot();
		await page.evaluate(id => {
			const api = L99Island, S = Crysis.social(), r = S.state.get(id); if (!r) throw Error('Resident lost after actual page reload');
			api.world().player.state.pos.set(r.position.x, r.position.y + 1.7, r.position.z); api.camera().position.copy(api.world().player.state.pos);
			S.update(.05, 1, true);
		}, met.id);
		await page.waitForFunction(id => Crysis.social().actors.all().some(p => p.residentId === id), met.id);
		await page.evaluate(() => { L99Island.close(); L99Island.dom.mount.style.display = 'block'; });
		const reload = await page.evaluate(id => {
			const S = Crysis.social(), r = S.state.get(id), p = S.actors.all().find(a => a.residentId === id);
			return { id: p.residentId, dna: JSON.stringify(p.P.dna), home: r.home, history: r.history, task: r.task, mode: r.mode, info: S.actors.info() };
		}, met.id);
		assert.equal(reload.id, met.id); assert.equal(reload.dna, met.dna); assert.deepEqual(reload.home, met.home);
		assert.deepEqual(reload.history, saved.residents[met.id].history); assert.equal(reload.task.status, 'completed'); assert.equal(reload.mode, 'wait');
		console.log('Actual page reload restored resident DNA, identity, home, history and task', JSON.stringify({ id: reload.id, home: reload.home, historyTurns: reload.history.length, task: reload.task.status, mode: reload.mode, info: reload.info }));
		const streamed = await page.evaluate(id => {
			const api = L99Island, S = Crysis.social(), p = S.actors.all().find(a => a.residentId === id), root = p.P.root;
			const geometries = new Set(), disposed = new Set(), eyes = new Set((p.P.eyes || []).map(e => e.geometry));
			root.traverse(o => { if (o.geometry && !eyes.has(o.geometry)) { geometries.add(o.geometry); o.geometry.addEventListener('dispose', () => disposed.add(o.geometry)); } });
			window.socialOldRoot = root;
			api.camera().position.x += 400;
			for (let i = 0; i < 90; i++) S.update(1 / 60, i / 60, true);
			if (S.actors.all().some(a => a.residentId === id) || root.parent) throw Error('Resident body did not stream out');
			if ([...geometries].some(g => !disposed.has(g))) throw Error('Resident body leaked streamed geometries');
			const r = S.state.get(id); api.camera().position.set(r.position.x, r.position.y + 1.7, r.position.z);
			for (let i = 0; i < 90; i++) S.update(1 / 60, 2 + i / 60, true);
			return { disposed: disposed.size, total: geometries.size };
		}, met.id);
		await page.waitForFunction(id => Crysis.social().actors.all().some(p => p.residentId === id), met.id);
		const restored = await page.evaluate(id => { const S = Crysis.social(), p = S.actors.all().find(a => a.residentId === id); return { differentBody: p.P.root !== socialOldRoot, dna: JSON.stringify(p.P.dna), info: S.actors.info(), recordCount: S.state.list().filter(r => r.id === id).length }; }, met.id);
		assert.ok(restored.differentBody); assert.equal(restored.dna, met.dna); assert.equal(restored.recordCount, 1); assert.ok(restored.info.active <= restored.info.max);
		const budget = await page.evaluate(async () => {
			const api = L99Island, W = api.world(), S = Crysis.social(), camera = api.camera(), v = W.island.village;
			camera.position.set(v.x, W.island.heightAt(v.x, v.z) + 1.7, v.z);
			for (let i = 0; i < 30 && !api.people.ready(); i++) { api.people.update(.05, i, camera.position, 0, true); await new Promise(r => setTimeout(r, 10)); }
			for (let i = 0; i < 90; i++) api.people.update(.05, i / 20, camera.position, 0, true);
			const candidates = api.people.pool.filter(p => !p.P.dna.child && p.detachForSocial);
			const max = S.actors.info().max, ids = [];
			if (candidates.length < max + 1) throw Error('Could not populate enough actual ambient adult bodies for the resident cap');
			for (const p of candidates.slice(0, max + 1)) { p.active = true; p.P.root.visible = true; const r = S.meet(p, { kind: 'island', name: 'the village' }); if (!r) throw Error('Cap fixture meet failed'); ids.push(r.id); if (S.actors.info().active > max) throw Error('Resident body cap exceeded'); }
			const info = S.actors.info(), savedCount = S.state.list().length;
			S.reset(); const after = S.actors.info();
			if (after.active || S.state.list().length !== savedCount) throw Error('Resident reset leaked bodies or lost records');
			return { attempted: ids.length, max, activeBeforeReset: info.active, activeAfterReset: after.active, savedCount };
		});
		assert.equal(budget.activeBeforeReset, budget.max); assert.equal(budget.attempted, budget.max + 1);
		console.log('Actual ambient residents enforce the body cap and reset retains saved identities', JSON.stringify(budget));
		const gpu = await page.evaluate(() => { const r = L99Island.renderer(); return { lost: r.getContext().isContextLost(), failed: r.info.programs.filter(p => p.diagnostics?.runnable === false).length }; });
		assert.equal(gpu.lost, false); assert.equal(gpu.failed, 0); assert.deepEqual(errors, []);
		fs.writeFileSync(`${out}/report.json`, JSON.stringify({ met, follow, warning, scout, reload, streamed, restored, budget, gpu, errors }, null, 2));
		console.log('Persistent NPC actual-body, social command, page-reload, streaming and GPU checks passed', JSON.stringify({ streamed, restored, out }));
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
