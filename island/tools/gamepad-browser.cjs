// Game controllers (ui/gamepad.js) in a real browser with a pretend pad: the sticks walk and look,
// the buttons send the game's keys and hooks, Start opens the controller menu, a panel's buttons
// are walked with the d-pad and pressed with A, B goes back, LB held opens the wheel, a car takes
// the triggers. Shots of the menu (Xbox and PlayStation glyphs) go to BARD_PAD_QA.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = process.env.BARD_PAD_QA || '/tmp/bard-gamepad';
const bundle = require('../node_modules/esbuild').buildSync({ stdin: { contents: "export * from './src/ui/gamepad.js';", resolveDir: root }, bundle: true, format: 'iife', globalName: 'Pad', write: false }).outputFiles[0].text;
(async () => {
	fs.mkdirSync(out, { recursive: true });
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox'] });
	try {
		const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
		const errors = []; page.on('pageerror', (e) => errors.push(e.message));
		await page.setContent(`<body style="margin:0;background:#0a0a0a"><div id="l99-island-mount" style="position:fixed;inset:0;background:linear-gradient(#26393e,#152529)"><canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>
			<div class="l99-prompts" style="position:absolute;left:40%;bottom:20px;display:flex;flex-direction:column;gap:8px"><button id="door" style="display:none;padding:10px 16px">🚪 Open</button></div>
			<div class="mg-bar"><div class="grp"></div><div class="grp"><div class="mg-s"></div><div class="mg-s"></div><div class="mg-s"></div><div class="mg-s"></div><div class="mg-s"></div></div></div></div></body>`);
		await page.addScriptTag({ content: bundle });
		await page.evaluate(() => {
			const mount = document.querySelector('#l99-island-mount'), canvas = mount.querySelector('canvas');
			const btn = () => ({ pressed: false, value: 0 });
			window.pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, connected: true, mapping: 'standard', buttons: [...Array(18)].map(btn), axes: [0, 0, 0, 0], timestamp: 0 };
			navigator.getGamepads = () => [window.pad];
			window.log = [];
			for (const t of ['keydown', 'keyup']) addEventListener(t, (e) => { if (!e.isTrusted) log.push(`${t === 'keydown' ? '+' : '-'}${e.shiftKey ? 'S' : ''}${e.code}`); });
			window.looked = [0, 0];
			window.S = { active: true, pad: { x: 0, y: 0, run: false }, flying: false, padLook: (y, p) => { looked[0] += y; looked[1] += p; } };
			window.calls = [];
			window.armedNow = false; window.driving = false;
			const binds = ['sunspark', 'shadowbolt', 'mend', 'lumen', null];
			const ws = [{ name: 'Aurora trail rifle', held: false }, null, { name: 'Machete', held: false }, null, null];
			window.hooks = {
				combat: { armed: () => armedNow, trigger: (d) => calls.push('trigger:' + d), melee: { block: (d) => calls.push('block:' + d) } },
				gear: { weapon: { aim: (d) => calls.push('aim:' + d) } },
				magic: { state: { binds }, hotbar: { slots: () => ws, press: (i) => { calls.push('slot:' + i); ws.forEach((w, j) => { if (w) w.held = j === i ? !w.held : false; }); } } },
				fishing: { rodOut: () => false, reel: (d) => calls.push('reel:' + d) },
				drive: { active: () => driving },
				chat: { open: () => calls.push('chat') },
			};
			window.hints = [];
			window.gp = Pad.createGamepad({ mount, canvas, world: () => ({ player: { state: S } }), hooks, hint: (t) => hints.push(t), places: () => calls.push('places'), settings: () => calls.push('settings') });
			dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pad }));
			window.set = (i, on) => { pad.buttons[i].pressed = on; pad.buttons[i].value = on ? 1 : 0; };
		});
		const frames = (n = 3) => page.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
		const press = async (i, ms = 0) => { await page.evaluate((b) => set(b, true), i); await frames(); if (ms) await page.waitForTimeout(ms); await frames(); await page.evaluate((b) => set(b, false), i); await frames(); };
		const take = () => page.evaluate(() => { const r = { log: log.splice(0), calls: calls.splice(0) }; return r; });
		await frames(4);
		assert.match((await page.evaluate(() => hints.join())), /Xbox controller ready/);

		// the sticks
		await page.evaluate(() => { pad.axes = [0.7, -0.9, 0.8, 0]; }); await frames(6);
		const st = await page.evaluate(() => ({ x: S.pad.x, y: S.pad.y, yaw: looked[0] }));
		assert.ok(st.x > 0.5 && st.y < -0.7 && st.yaw > 0.01, 'the left stick walks, the right one turns: ' + JSON.stringify(st));
		await page.evaluate(() => { pad.axes = [0.1, 0.1, 0, 0]; }); await frames();
		assert.deepEqual(await page.evaluate(() => [S.pad.x, S.pad.y]), [0, 0], 'the dead zone holds still');

		// A, B: Space and C, held as long as the button
		await press(0); await press(1);
		assert.deepEqual((await take()).log, ['+Space', '-Space', '+KeyC', '-KeyC']);
		// RT: a strike (Q) unarmed, the trigger with a gun; LT: the block, the sights
		await press(7);
		assert.deepEqual((await take()).log, ['+KeyQ', '-KeyQ']);
		await press(6);
		assert.deepEqual((await take()).calls, ['block:true', 'block:false']);
		await page.evaluate(() => { armedNow = true; });
		await press(7); await press(6, 500);
		assert.deepEqual((await take()).calls, ['trigger:true', 'trigger:false', 'aim:true', 'aim:false']);
		// a quick tap of LT leaves the sights up, the next press takes them down
		await press(6); assert.deepEqual((await take()).calls, ['aim:true']);
		await press(6); assert.deepEqual((await take()).calls, ['aim:false']);
		// Y: fire mode with a gun, the heavy blow without
		await press(3); assert.deepEqual((await take()).log, ['+KeyZ', '-KeyZ']);
		await page.evaluate(() => { armedNow = false; });
		await press(3); assert.deepEqual((await take()).log, ['+SKeyQ', '-SKeyQ']);
		// RB casts the chosen spell (6, held), LB picks the next one
		await press(5); assert.deepEqual((await take()).log, ['+Digit6', '-Digit6']);
		await press(4); await press(5); assert.deepEqual((await take()).log, ['+Digit7', '-Digit7']);
		// X: the prompt on screen when there is one, else E (and R with a gun)
		await page.evaluate(() => { const d = document.getElementById('door'); d.style.display = ''; d.onclick = () => calls.push('door'); });
		await frames();
		assert.equal(await page.evaluate(() => document.getElementById('door').getAttribute('data-gp')), 'X', 'the prompt carries the X');
		await press(2); assert.deepEqual((await take()).calls, ['door']);
		await page.evaluate(() => { document.getElementById('door').style.display = 'none'; armedNow = true; });
		await press(2); assert.deepEqual((await take()).log, ['+KeyE', '-KeyE', '+KeyR', '-KeyR']);
		// X held: H (the rod, hands up); R3: lock on, held: the next one
		await press(2, 520); assert.deepEqual((await take()).log, ['+KeyH', '-KeyH']);
		await press(11); await press(11, 520); assert.deepEqual((await take()).log, ['+Backquote', '-Backquote', '+SBackquote', '-SBackquote']);
		await page.evaluate(() => { armedNow = false; });
		// the d-pad: weapons round (empty hands, rifle, machete), grab, use
		await press(15); await press(15); await press(15);
		assert.deepEqual((await take()).calls, ['slot:0', 'slot:2', 'slot:2']);
		await press(12); await press(13);
		assert.deepEqual((await take()).log, ['+KeyJ', '-KeyJ', '+KeyU', '-KeyU']);
		// L3: a sprint until the stick comes to rest
		await page.evaluate(() => { pad.axes = [0, -1, 0, 0]; }); await press(10);
		assert.equal(await page.evaluate(() => S.pad.run), true);
		await page.evaluate(() => { pad.axes = [0, 0, 0, 0]; }); await frames();
		assert.equal(await page.evaluate(() => S.pad.run), false);

		// LB held: the wheel; the right stick up-left picks the first spell, let go chooses it
		await page.evaluate(() => set(4, true)); await page.waitForTimeout(520); await frames();
		assert.equal(await page.evaluate(() => gp.info().wheel), true, 'the wheel is open');
		await page.evaluate(() => { pad.axes = [0, 0, -0.95, -0.3]; }); await frames(4);
		await page.screenshot({ path: path.join(out, 'wheel-xbox.png') });
		const lookBefore = await page.evaluate(() => looked[0]);
		await frames(3);
		assert.equal(await page.evaluate(() => looked[0]), lookBefore, 'the view holds while the wheel is open');
		await page.evaluate(() => { set(4, false); pad.axes = [0, 0, 0, 0]; }); await frames();
		assert.equal(await page.evaluate(() => gp.info().spell), 0, 'Sunspark chosen on the wheel');
		await take();

		// Start: the controller menu; A on its first tile opens the skills (Tab) and is no jump
		await press(9);
		assert.equal(await page.evaluate(() => gp.info().menu), true);
		await frames(3);
		await page.screenshot({ path: path.join(out, 'menu-xbox.png') });
		assert.match(await page.evaluate(() => gp.info().focus), /Skills and magic/);
		await press(15);
		assert.match(await page.evaluate(() => gp.info().focus), /Gear/, 'right: the next tile');
		await press(14);
		await press(0);
		const m = await take();
		assert.deepEqual(m.log, ['+Tab', '-Tab'], 'the tile sent Tab and A sent no Space: ' + JSON.stringify(m));
		assert.equal(await page.evaluate(() => gp.info().menu), false);
		// B closes the menu
		await press(9); await press(1);
		assert.equal(await page.evaluate(() => gp.info().menu), false);
		assert.deepEqual((await take()).log, [], 'B in the menu sent no C');

		// a panel of the game's own: the d-pad walks it, A presses, LB/RB turn tabs, B sends Escape
		await page.evaluate(() => {
			const d = document.createElement('div');
			d.id = 'panel'; d.setAttribute('role', 'dialog');
			d.style.cssText = 'position:absolute;left:300px;top:120px;width:500px;padding:16px;background:#1a1a1a;color:#fff;display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
			d.innerHTML = '<button role="tab" aria-selected="true">One</button><button role="tab" aria-selected="false">Two</button><button role="tab" aria-selected="false">Three</button><button id="a1">Alpha</button><button id="b1">Bravo</button><button id="c1">Charlie</button><input id="r1" type="range" min="0" max="10" value="5">';
			d.querySelectorAll('[role=tab]').forEach((t) => t.onclick = () => d.querySelectorAll('[role=tab]').forEach((u) => u.setAttribute('aria-selected', String(u === t))));
			d.querySelectorAll('button:not([role])').forEach((b) => b.onclick = () => calls.push(b.id));
			d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.remove(); });
			document.querySelector('#l99-island-mount').appendChild(d);
		});
		await frames(3);
		await press(13); await press(15); await press(0);
		assert.deepEqual((await take()).calls, ['b1'], 'down then right then A: Bravo');
		await press(13); await press(15); await press(15);
		assert.equal(await page.evaluate(() => document.getElementById('r1').value), '7', 'right turns a slider');
		await press(5);
		assert.equal(await page.evaluate(() => document.querySelector('[role=tab][aria-selected=true]').textContent), 'Two', 'RB: the next tab');
		await page.screenshot({ path: path.join(out, 'panel-ring.png') });
		await press(1);
		assert.equal(await page.evaluate(() => !!document.getElementById('panel')), false, 'B: Escape closed it');
		await take();

		// a panel that reads the keys itself (the skills menu): arrows, Enter, Escape, pages
		await page.evaluate(() => { const d = document.createElement('div'); d.id = 'sk'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.dataset.pad = 'keys'; d.style.cssText = 'position:absolute;inset:100px;background:#111'; document.querySelector('#l99-island-mount').appendChild(d); });
		await frames(3);
		await press(15); await press(0); await press(5); await press(1);
		assert.deepEqual((await take()).log, ['+ArrowRight', '-ArrowRight', '+Enter', '-Enter', '+PageDown', '-PageDown', '+Escape', '-Escape']);
		await page.evaluate(() => document.getElementById('sk').remove()); await frames(3);

		// View: the ring on the screen's own buttons
		await page.evaluate(() => { const d = document.getElementById('door'); d.style.display = ''; });
		await press(8); await frames(3);
		assert.equal(await page.evaluate(() => gp.info().mode), 'screen');
		await press(0);
		assert.ok((await take()).calls.includes('door'), 'A pressed the button the ring was on');
		assert.equal(await page.evaluate(() => gp.info().mode), 'game', 'and back to the game');
		await page.evaluate(() => { document.getElementById('door').style.display = 'none'; });

		// a car: the triggers drive, the stick steers, Y gets out
		await page.evaluate(() => { driving = true; set(7, true); pad.axes = [-0.8, 0, 0, 0]; }); await frames(4);
		assert.deepEqual(await page.evaluate(() => gp.info().held.sort()), ['ArrowLeft', 'ArrowUp']);
		await page.evaluate(() => { set(7, false); pad.axes = [0, 0, 0, 0]; }); await frames(3);
		await press(3);
		assert.deepEqual((await take()).log, ['+ArrowUp', '+ArrowLeft', '-ArrowUp', '-ArrowLeft', '+Escape', '-Escape']);
		await page.evaluate(() => { driving = false; }); await frames(3);

		// a PlayStation pad: its own glyphs
		await page.evaluate(() => { pad.id = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'; }); await frames(3);
		await press(9); await frames(3);
		assert.match(await page.evaluate(() => document.querySelector('.gp-menu').textContent), /DualSense controller/);
		assert.ok(await page.evaluate(() => document.querySelector('.gp-menu').innerHTML.includes('✕')), 'the cross on the layout');
		await page.screenshot({ path: path.join(out, 'menu-playstation.png') });
		await press(1);

		// unplugged: everything let go
		await page.evaluate(() => { set(0, true); }); await frames(3);
		await page.evaluate(() => { navigator.getGamepads = () => [null]; dispatchEvent(new Event('gamepaddisconnected')); });
		await frames(2);
		assert.deepEqual(await page.evaluate(() => gp.info().held), [], 'nothing left held');
		assert.deepEqual(errors, []);
		console.log('PASS sticks, every face button, triggers, bumpers, d-pad, the wheel, the Start menu, panels by d-pad and by their own keys, the screen ring, a car, PlayStation glyphs, unplugging');
	} finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
