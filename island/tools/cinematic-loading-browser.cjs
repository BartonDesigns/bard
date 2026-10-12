// Production loading UI, real mouse/touch/keyboard input and delayed readiness.
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'docs/verification/cinematic-loading');
const checks = [], errors = [];
const fixture = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/loading-screen.js"></script>
<button id="game">Game input</button><script>window.events=0;window.exits=0;window.enters=0;
addEventListener('keydown',()=>events++);document.getElementById('game').onclick=()=>events++;
window.start=()=>L99Loading.run(()=>new Promise((resolve,reject)=>{window.finish=resolve;window.fail=reject;}),{entry:true,exit:()=>exits++,enter:()=>enters++});</script>`;
(async () => {
	await fs.mkdir(out, { recursive: true });
	const server = http.createServer(async (req, res) => {
		const url = new URL(req.url, 'http://local');
		if (url.pathname === '/fixture') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); return; }
		if (url.pathname === '/engine-fixture') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/loading-screen.js"></script><button id="boot">Open world</button><script>document.getElementById('boot').onclick=()=>L99Loading.run(async()=>{const m=await import('/island/dist/island.js');window.game=m.island();return game.open({earth:false,biome:'MOON',seed:1337});},{exit:()=>window.game?.close()});</script>`); return; }
		try {
			const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
			if (!file.startsWith(root + path.sep)) throw Error('path');
			res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
			res.end(await fs.readFile(file));
		} catch { res.writeHead(404).end(); }
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const base = 'http://127.0.0.1:' + server.address().port;
	let browser;
	try {
		browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
		const page = await browser.newPage({ hasTouch: true }); page.on('pageerror', e => errors.push(e.message));
		const pass = name => { checks.push(name); console.log('PASS', name); };
		for (const [name, width, height] of [['desktop',1440,900], ['phone',390,844], ['small-phone',320,568], ['landscape',844,390], ['short-landscape',844,320]]) {
			await page.setViewportSize({ width, height }); await page.goto(base + '/fixture'); await page.evaluate(() => { start(); });
			await page.waitForFunction(() => typeof finish === 'function');
			await page.waitForFunction(() => document.querySelector('#bard-loading img.loaded')?.naturalWidth > 0);
			const ready = page.getByRole('button', { name: 'Enter world', exact: true }); assert.equal(await ready.isVisible(), false);
			await page.keyboard.press('w'); await page.keyboard.press('Space'); await page.keyboard.press('f');
			assert.equal(await page.evaluate(() => events), 0);
			await page.evaluate(() => document.getElementById('game').click()); assert.equal(await page.evaluate(() => events), 0);
			assert.equal(await page.locator('#bard-loading nav').count(), 0);
			assert.equal(await page.locator('#bard-loading .bl-caption').count(), 0);
			await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.getElementById('bard-loading').contains(document.activeElement)), true);
			await page.evaluate(() => finish(true)); await ready.waitFor({ state: 'visible' });
			const bounds = await page.evaluate(() => {
				const root = document.getElementById('bard-loading');
				return { width: root.scrollWidth, height: root.scrollHeight, buttons: [...root.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}) };
			});
			assert.ok(bounds.width <= width + 1, name + ' no horizontal overflow');
			assert.ok(bounds.buttons.every(b => b.x >= 0 && b.x + b.w <= width + 1 && b.y >= 0 && b.y + b.h <= height + 1 && b.w >= 44 && b.h >= 44), name + ' touch targets');
			await page.waitForFunction(() => [...document.querySelectorAll('#bard-loading img.loaded')].some(img=>getComputedStyle(img).opacity === '1'));
			await page.screenshot({ path: path.join(out, name + '.jpg'), quality:85, fullPage: true });
			if (width < 651) await ready.tap(); else await ready.click(); assert.equal(await page.evaluate(() => L99Loading.active()), false);
			assert.equal(await page.evaluate(() => enters), 1); await page.keyboard.press('w'); assert.equal(await page.evaluate(() => events), 1);
			assert.equal(await page.locator('#game').evaluate(el => el.inert), false); pass(name + ': guarded slideshow artwork, focus, readiness, input restoration');
		}
		const scenes = ['horizon','resonance','settlement','beyond','island','discovery','deep','interior','earth','terran','atmosphere','sun','streets','crew'];
		for (const [name,width,height] of [['desktop',1440,900],['phone',390,844]]) {
			await page.setViewportSize({width,height});
			for (let i=0;i<scenes.length;i++) {
				await page.goto(base+'/fixture');
				await page.evaluate(i=>{sessionStorage.removeItem('bard-loading-last-scene');Math.random=()=> (i+.1)/14;start();},i);
				await page.waitForFunction(id=>document.querySelector('#bard-loading img.loaded')?.src.includes(id+'.webp'),scenes[i]);
				await page.waitForFunction(()=>getComputedStyle(document.querySelector('#bard-loading img')).opacity==='1');
				assert.ok((await page.locator('#bard-loading .bl-tip').innerText()).split(/\s+/).length<=10);
				assert.equal(await page.locator('#bard-loading nav, #bard-loading .bl-caption, #bard-loading h2').count(),0);
				await page.screenshot({path:path.join(out,`${name}-scene-${scenes[i]}.jpg`),quality:80});
			}
		}
		pass('all 14 distinct captures load on desktop and phone with one short hint and no slide numbers/captions');
		const selected=await page.locator('#bard-loading img').getAttribute('src');
		await page.waitForTimeout(11000);
		assert.notEqual(await page.locator('#bard-loading img').getAttribute('src'),selected);
		await page.getByRole('button',{name:'Pause slideshow',exact:true}).click();
		const pausedImage=await page.locator('#bard-loading img').getAttribute('src');
		await page.waitForTimeout(11000);
		assert.equal(await page.locator('#bard-loading img').getAttribute('src'),pausedImage);
		await page.getByRole('button',{name:'Play slideshow',exact:true}).click();
		await page.evaluate(()=>finish(true));await page.getByRole('button',{name:'Enter world',exact:true}).click();
		await page.evaluate(()=>{start();});await page.waitForFunction(()=>L99Loading.pending);
		assert.notEqual(await page.locator('#bard-loading img').getAttribute('src'),pausedImage);
		const next=await page.locator('#bard-loading img').getAttribute('src');
		await page.reload();await page.evaluate(()=>{Math.random=()=>.99;start();});
		assert.notEqual(await page.locator('#bard-loading img').getAttribute('src'),next);
		pass('random slideshow rotates, pauses and avoids immediate repeats on reopen/reload');
		await page.goto(base + '/fixture'); await page.evaluate(() => { window.attempts = 0; L99Loading.run(async () => { if (++attempts === 1) throw Error('offline'); return true; }); });
		await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.getByRole('button', { name: 'Enter world', exact: true }).waitFor();
		assert.equal(await page.evaluate(() => attempts), 2); pass('failed task retries and cannot enable entry early');
		await page.getByRole('button', { name: 'Enter world', exact: true }).click();
		await page.evaluate(() => { start(); }); await page.waitForFunction(() => typeof finish === 'function');
		await page.getByRole('button', { name: 'Back to Bard' }).click(); await page.evaluate(() => finish(true));
		assert.equal(await page.evaluate(() => L99Loading.active()), false); pass('late completion after Back cannot reopen the screen');
		// A new door request waits for cancelled work, including its cleanup, without disappearing.
		for (const rejected of [false, true]) {
			await page.goto(base + '/fixture'); await page.evaluate(() => { start(); });
			await page.waitForFunction(() => typeof finish === 'function');
			await page.getByRole('button', { name: 'Back to Bard' }).click();
			await page.evaluate(() => {
				window.order = []; window.oldExits = exits;
				L99Loading.run(async () => { order.push('new'); return true; }, { entry: true, enter: () => enters++ });
			});
			assert.equal(await page.evaluate(() => L99Loading.active()), true);
			assert.equal(await page.getByRole('button', { name: 'Enter world', exact: true }).isVisible(), false);
			assert.deepEqual(await page.evaluate(() => order), []);
			await page.evaluate(rejected => { if (rejected) fail(Error('cancelled request failed')); else finish(true); }, rejected);
			await page.getByRole('button', { name: 'Enter world', exact: true }).waitFor();
			assert.deepEqual(await page.evaluate(() => order), ['new']);
			assert.equal(await page.evaluate(() => exits === oldExits + 1), true);
			await page.getByRole('button', { name: 'Enter world', exact: true }).click();
			assert.equal(await page.evaluate(() => enters), 1);
		}
		pass('immediate reopen waits for cancelled success or failure and restores guarded entry');
		await page.goto(base + '/fixture'); await page.evaluate(() => { start(); });
		await page.waitForFunction(() => typeof finish === 'function');
		await page.getByRole('button', { name: 'Back to Bard' }).click();
		assert.equal(await page.evaluate(() => L99Loading.run(() => { throw Error('cancelled nested work started'); })), false);
		await page.evaluate(() => { window.reopens = 0; L99Loading.run(() => { reopens++; }, { entry: true }); });
		await page.getByRole('button', { name: 'Back to Bard' }).click();
		await page.evaluate(() => { L99Loading.run(() => { reopens += 10; }, { entry: true }); finish(true); });
		await page.getByRole('button', { name: 'Enter world', exact: true }).waitFor();
		assert.equal(await page.evaluate(() => reopens), 10);
		await page.getByRole('button', { name: 'Enter world', exact: true }).click();
		pass('cancelled nested and queued tasks cannot run or deadlock a later door request');
		await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(base + '/fixture'); await page.evaluate(() => { start(); });
		assert.equal(await page.locator('#bard-loading nav').count(), 0);
		const reducedImage=await page.locator('#bard-loading img').getAttribute('src'); await page.waitForTimeout(11000);
		assert.equal(await page.locator('#bard-loading img').getAttribute('src'),reducedImage);
		assert.equal(await page.locator('.bl-fill').evaluate(el => getComputedStyle(el).animationName), 'none'); pass('reduced motion keeps static artwork and disables progress animation');
		await page.route('**/assets/loading/*.webp', route => route.abort()); await page.reload(); await page.evaluate(() => { start(); }); await page.waitForFunction(() => typeof finish === 'function');
		await page.evaluate(() => finish(true)); await page.getByRole('button', { name: 'Enter world', exact: true }).click(); pass('image failures never block readiness or entry');
		// Real faceplate door, with its actual engine import held at the network boundary.
		await page.unroute('**/assets/loading/*.webp'); await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.route('**/island/dist/island.js*', route => route.fulfill({ status: 503, body: 'temporarily unavailable' }));
		await page.goto(base + '/?offline&safe', { waitUntil: 'domcontentloaded' }); await page.locator('#island-btn').click();
		await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
		assert.equal(await page.getByRole('button', { name: 'Enter world', exact: true }).isVisible(), false); pass('production faceplate import failure reaches the cinematic recovery screen');
		if (process.argv.includes('--engine')) {
			await page.unroute('**/island/dist/island.js*'); await page.setViewportSize({width:640,height:400});
			await page.goto(base + '/engine-fixture?safe'); await page.locator('#boot').click();
			await page.getByRole('button', {name:'Enter world',exact:true}).waitFor({state:'visible',timeout:240000});
			const before = await page.evaluate(() => ({pos:game.world().player.state.pos.toArray(),flying:game.world().player.state.flying}));
			await page.keyboard.press('f'); await page.keyboard.press('w');
			assert.deepEqual(await page.evaluate(()=>({pos:game.world().player.state.pos.toArray(),flying:game.world().player.state.flying})), before);
			assert.equal(await page.evaluate(()=>game.dom.mount.inert),true);
			assert.ok(await page.evaluate(()=>game.renderer().info.render.calls>0));
			await page.getByRole('button',{name:'Enter world',exact:true}).click();
			assert.equal(await page.evaluate(()=>game.dom.mount.inert),false);
			await page.keyboard.press('f');
			assert.equal(await page.evaluate(()=>game.world().player.state.flying),!before.flying);
			await page.screenshot({path:path.join(out,'engine-entry.png'),timeout:120000});
			const problems = await page.evaluate(()=>game.renderer().info.programs.filter(p=>p.diagnostics?.runnable===false).length);
			assert.equal(problems,0); pass('real bundled Moon world renders before readiness; input waits for entry and resumes afterwards');
			await page.evaluate(()=>game.close());
		}
		assert.deepEqual(errors, []);
		await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ method: 'Production loading UI and faceplate entry, Chromium keyboard/mouse, emulated touch and responsive viewport checks; not native Safari.', checks, errors, passed: true }, null, 2));
	} finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
