// Realtime conversation in the real game: walk up, they speak first, you speak, they answer
// sentence by sentence with subtitles and act on it (follow, a quest of their own, squaring up),
// and the M key opens a conversation listening. The discovery server's stream is stood in for
// in the page (llm.npcTalk), everything else is the game's own.
//   node island/tools/npc-live-browser.cjs [desktop|phone]   (BARD_LIVE_OUT for screenshots)
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..'), profile = process.argv[2] || 'desktop';
const out = process.env.BARD_LIVE_OUT || '/tmp/bard-live-qa';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ktx2': 'image/ktx2', '.onnx': 'application/octet-stream' };
const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://local');
	const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
	if (!file.startsWith(root)) return res.writeHead(403).end();
	fs.readFile(file, (err, buf) => { if (err) return res.writeHead(404).end(); res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream'); res.end(buf); });
});
(async () => {
	fs.mkdirSync(out, { recursive: true });
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'] });
	try {
		const phone = profile === 'phone';
		const page = await browser.newPage(phone ? { viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : { viewport: { width: 800, height: 450 } });
		page.setDefaultTimeout(600000);
		const errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|l99-rooms|discovery/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
		await page.goto(`http://127.0.0.1:${server.address().port}/?offline&safe`, { waitUntil: 'domcontentloaded' });
		await page.waitForFunction(() => window.L99IslandDoor);
		await page.evaluate(async () => {
			const api = await L99IslandDoor.engine(); await api.open({ seed: 1337, earth: false, biome: 'TROPICAL' });
			Crysis.music.auto(false); window._KEYS_PLAY_ON = false;
			const W = api.world(), v = W.island.village, p = W.player.state;
			p.pos.set(v.x, W.island.heightAt(v.x, v.z) + 1.7, v.z + 7); p.vel.set(0, 0, 0); p.flying = true; api.camera().position.copy(p.pos);
			W.sky.state.speed = 0; W.sky.state.hours = 13;
		});
		const enter = page.getByRole('button', { name: 'Enter world', exact: true });
		await enter.waitFor({ state: 'visible', timeout: 600000 }).catch(() => {});
		if (await enter.isVisible()) { if (phone) await enter.tap(); else await enter.click(); }
		await page.waitForFunction(() => !window.L99Loading?.active?.(), null, { timeout: 900000 });
		console.log(profile + ': in the world');
		for (let k = 0; ; k++) {
			const n = await page.evaluate(() => L99Island.people.pool.filter((p) => p.active && !p.P.dna.child && p.detachForSocial).length);
			if (n >= 3) break;
			if (k >= 60) throw new Error('nobody came out in fifteen minutes');
			if (k % 4 === 0) console.log(profile + ': waiting for people (' + n + ')');
			await page.waitForTimeout(15000);
		}
		console.log(profile + ': people are out');
		// the stand-in server: replies streamed in small pieces, with what the game sent kept
		await page.evaluate(() => {
			const a = L99Island, g = a.guide, llm = g.llm;
			window.qa = { sheets: [], spoken: [], replies: [] };
			const said = speechSynthesis.speak.bind(speechSynthesis);
			speechSynthesis.speak = (u) => { qa.spoken.push(u.text); said(u); };
			llm.canStream = () => true; llm.status.ready = true; llm.kind = () => 'cloud';
			llm.npcTalk = async (sheet, lines, { open, signal, onText } = {}) => {
				qa.sheets.push({ sheet, lines: JSON.parse(JSON.stringify(lines || [])), open });
				const r = qa.replies.length ? qa.replies.shift() : { reply: '[[mood: warm]] Oh, hello there! Nice day for it, isn\'t it?', act: null };
				const reply = typeof r.reply === 'function' ? r.reply(sheet) : r.reply, act = typeof r.act === 'function' ? r.act(sheet) : r.act;
				let text = '';
				for (let i = 0; i < reply.length; i += 6) { if (signal?.aborted) throw new DOMException('cancelled', 'AbortError'); text += reply.slice(i, i + 6); onText?.(text); await new Promise((res) => setTimeout(res, 15)); }
				return { reply, act, note: r.note || null, provider: 'claude' };
			};
			// walk up to them, as a player would (the game ends a talk once the camera is 7 m off)
			qa.walkUp = (who) => { const P = a.world().player.state, q = who.M.S.pos; P.pos.set(q.x + 1.2, q.y + 1.7, q.z + 1.2); P.vel.set(0, 0, 0); a.camera().position.set(q.x + 1.6, q.y + 1.7, q.z + 1.6); };
			qa.actors = a.people.pool.filter((p) => p.active && !p.P.dna.child && p.detachForSocial && (p.P.dna.age ?? 30) >= 18).slice(0, 3);
		});
		const live = () => page.evaluate(() => { const w = document.querySelector('.l99-live'); return { on: w?.classList.contains('on'), text: w?.innerText || '', panel: document.querySelector('[role=dialog][aria-label="The Guide"]').style.display, rect: w?.getBoundingClientRect().toJSON() }; });

		// 1. walk up: they speak first, live, the panel closed
		await page.evaluate(() => { qa.walkUp(qa.actors[0]); L99Island.guide.talkTo(qa.actors[0]); });
		await page.waitForFunction(() => qa.sheets.length === 1 && /Nice day/.test(document.querySelector('.l99-live')?.innerText || ''));
		let L = await live();
		assert.equal(L.on, true, 'the live subtitles are up');
		assert.equal(L.panel, 'none', 'the chat panel stays closed');
		const first = await page.evaluate(() => qa.actors[0].P ? L99Island.guide.partner().persona.first : '');
		assert.ok(L.text.includes(first + ':') && !/\[\[/.test(L.text), 'their name and words, no tags: ' + L.text);
		const s0 = await page.evaluate(() => qa.sheets[0]);
		assert.equal(s0.open, true);
		assert.ok(s0.sheet.name && s0.sheet.can.follow === true && s0.sheet.can.fight === true, 'the sheet says who they are and what they can do');
		await page.screenshot({ path: `${out}/${profile}-opening.png` });

		// 2. ask them along: they answer in sentences (said one by one) and follow
		await page.evaluate(() => { qa.replies.push({ reply: '[[mood: happy]] [[gesture: nod]] Sure, why not. Lead the way, I\'m right behind you.', act: { act: 'follow' }, note: 'Asked me to come along on a walk.' }); });
		await page.evaluate(() => L99Island.guide.ask('Want to come with me for a walk?'));
		const followed = await page.evaluate(() => { const r = Crysis.social().state.list().find((x) => x.persona.first === qa.actors[0].P && false) || Crysis.social().state.get(qa.sheets[1] && L99Island.guide.partner()?.id); return { partner: !!L99Island.guide.partner(), modes: Crysis.social().state.list().map((x) => [x.persona.name, x.mode, (x.memories || []).map((m) => m.content)]) }; });
		assert.equal(followed.partner, false, 'the conversation lets them go');
		assert.ok(followed.modes.some(([, mode, mem]) => mode === 'follow' && mem.some((m) => /come along on a walk/.test(m))), 'they follow and remember: ' + JSON.stringify(followed.modes));
		L = await live();
		assert.ok(/following you/i.test(L.text) || L.on === false, 'a note says they follow');
		const sheet1 = await page.evaluate(() => qa.sheets[1]);
		assert.equal(sheet1.lines.at(-1).content, 'Want to come with me for a walk?');

		// 3. a second person, asked for work: a quest of their own from the places the sheet gave
		await page.evaluate(() => { qa.walkUp(qa.actors[1]); L99Island.guide.talkTo(qa.actors[1]); });
		await page.waitForFunction(() => qa.sheets.length === 3);
		const quest = await page.evaluate(async () => {
			const sh = qa.sheets[2].sheet, Q = sh.can.quest;
			if (!Q) return { none: true, can: sh.can };
			const t = Q.targets.find((x) => !x.id.startsWith('home:')) || Q.targets[0], me = Q.npcs[0];
			qa.replies.push({ reply: `[[mood: thoughtful]] Funny you ask. Go and see ${t.name} for me, then come back and tell me how it looks.`, act: { act: 'quest', quest: { title: 'A look at ' + t.name, premise: 'They want to know how it looks these days.', steps: [{ type: 'visit', targetId: t.id }, { type: 'talk', npcId: me.id }] } } });
			await L99Island.guide.ask('Got any work for me?');
			return { offered: L99Island.guide.stories.list().filter((q) => q.status === 'offered').map((q) => q.title), text: document.querySelector('.l99-live').innerText };
		});
		if (!quest.none) {
			assert.ok(quest.offered.some((t) => t.startsWith('A look at')), 'the quest is offered: ' + JSON.stringify(quest));
			assert.match(quest.text, /Quest offered/);
			await page.evaluate(async () => { qa.replies.push({ reply: '[[mood: happy]] Great. I\'ll be here.', act: { act: 'quest_accept' } }); await L99Island.guide.ask('Sure, I will do it.'); });
			const accepted = await page.evaluate(() => L99Island.guide.stories.list().filter((q) => q.status === 'active').map((q) => q.title));
			assert.ok(accepted.some((t) => t.startsWith('A look at')), 'accepted by saying so');
		} else console.log(profile + ': no quest places on this island spot', JSON.stringify(quest.can));
		await page.screenshot({ path: `${out}/${profile}-quest.png` });

		// 4. an act the game doesn't allow is never carried out (the server checks; so does the game)
		await page.evaluate(async () => { qa.replies.push({ reply: '[[mood: calm]] Sure, I\'ll go home.', act: { act: 'teleport' } }); await L99Island.guide.ask('Go teleport somewhere'); });
		assert.equal(await page.evaluate(() => !!L99Island.guide.partner()), true, 'nothing done, still talking');

		// 5. pushed too far: a third person squares up
		await page.evaluate(() => { qa.walkUp(qa.actors[2]); L99Island.guide.talkTo(qa.actors[2]); });
		await page.waitForFunction(() => qa.sheets.length >= 6);
		const fight = await page.evaluate(async () => {
			qa.replies.push({ reply: '[[mood: angry]] What did you just say to me? Come on then!', act: { act: 'fight' } });
			await L99Island.guide.ask('You are an idiot and I will knock you out.');
			const p = qa.actors[2];
			return { partner: !!L99Island.guide.partner(), foe: Crysis.combat?.melee?.foes?.has?.(p.P) ?? null, brawl: !!p.override };
		});
		assert.equal(fight.partner, false);
		assert.ok(fight.foe || fight.brawl, 'they square up: ' + JSON.stringify(fight));

		// 6. M facing someone opens a conversation listening (the microphone is the browser's)
		await page.evaluate(() => { const g = L99Island.guide; if (g.partner()) g.endTalk(); Crysis.combat?.melee?.clear?.(); });
		const mkey = await page.evaluate(async () => {
			const p = qa.actors[1], cam = L99Island.camera(), W = L99Island.world(), P = W.player.state;
			P.flying = false; cam.position.set(p.M.S.pos.x, p.M.S.pos.y + 1.6, p.M.S.pos.z + 1.6); P.pos.copy(cam.position); P.yaw = 0;
			await new Promise((r) => setTimeout(r, 1500));
			dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
			await new Promise((r) => setTimeout(r, 800));
			return { live: L99Island.guide.live(), mic: document.querySelector('.l99-live button[aria-label=Microphone]')?.textContent };
		});
		console.log(profile + ': M key', JSON.stringify(mkey));
		const spoken = await page.evaluate(() => qa.spoken.slice());
		console.log(profile + ': said aloud', JSON.stringify(spoken.slice(0, 8)));
		assert.ok(!spoken.some((t) => /\[\[/.test(t)), 'no tags are spoken');
		L = await live();
		if (L.rect) assert.ok(L.rect.left >= 0 && L.rect.right <= (phone ? 390.5 : 800.5), 'the subtitles fit the screen');
		await page.screenshot({ path: `${out}/${profile}-end.png` });
		assert.deepEqual(errors, []);
		fs.writeFileSync(`${out}/${profile}-report.json`, JSON.stringify({ opening: s0.sheet, followed, quest, fight, mkey, spoken, errors }, null, 2));
		console.log(profile + ': live conversation passed', out);
	} finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });
