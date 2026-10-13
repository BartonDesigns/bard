// The passing-remark channel on the real local voice: warm the model, say a line from a
// spot to your right, check it plays panned from there at the person's pitch, never cuts
// into a conversation, and is dropped if you walked out of earshot while it was being made.
// Run with: node island/tools/chatter-voice-browser.cjs (downloads the voice model once)
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const MOCK = `let current = 0, ack;
self.onmessage = async ({ data }) => {
	if (data.type === 'warm') { setTimeout(() => self.postMessage({ type: 'ready', id: data.id }), 50); return; }
	if (data.type === 'ack') { if (data.id === current) { ack?.(); ack = null; } return; }
	current = data.id; ack?.(); ack = null;
	if (data.type !== 'speak') return;
	const id = data.id;
	for (let index = 0; index < data.chunks.length; index++) {
		await new Promise(r => setTimeout(r, 300));
		if (id !== current) return;
		const samples = new Float32Array(12000).map((v, i) => Math.sin(i * 0.12) * 0.3);
		const played = new Promise(r => { ack = r; });
		self.postMessage({ type: 'audio', id, index, samples, sampleRate: 24000 }, [samples.buffer]);
		await played;
	}
	if (id === current) self.postMessage({ type: 'done', id });
};`;
(async () => {
	const errors = [];
	const server = http.createServer((q, r) => {
		const pathname = new URL(q.url, 'http://local').pathname;
		if (pathname === '/fixture') {
			r.setHeader('content-type', 'text/html');
			r.end(`<button id="go">go</button><script type="module">
				import { createLocalSpeech } from '/island/src/guide/local-speech.js';
				import { voiceShape } from '/island/src/people/chatter-lines.js';
				window.fallbacks = []; window.events = [];
				window.speech = createLocalSpeech({ onStatus: () => {}, fallback: t => fallbacks.push(t) });
				window.shape = voiceShape;
				document.querySelector('#go').onclick = () => { speech.unlock(); speech.warm(); };
			</script>`);
			return;
		}
		// the model hosts are not reachable from every sandbox: REAL=1 uses the real worker,
		// otherwise a stand-in speaks the same protocol with a tone per line
		if (!process.env.REAL && pathname.endsWith('/local-speech-worker.js')) { r.setHeader('content-type', 'text/javascript'); r.end(MOCK); return; }
		const file = path.resolve(root, '.' + pathname);
		if (!file.startsWith(root + '/')) { r.writeHead(403).end(); return; }
		try { r.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); r.end(fs.readFileSync(file)); } catch { r.writeHead(404).end(); }
	});
	await new Promise(r => server.listen(0, '127.0.0.1', r));
	const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, headless: true, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '<-loopback>,127.0.0.1,localhost' } : undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ ignoreHTTPSErrors: true });
		page.on('pageerror', e => errors.push(e.message));
		if (process.env.DEBUG) { page.on('console', m => console.log('console', m.text())); page.on('requestfailed', q => console.log('failed', q.url(), q.failure()?.errorText)); }
		await page.addInitScript(() => {
			window.played = []; window.panners = []; window.speaks = 0;
			const post = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m, t) { if (m?.type === 'speak') speaks++; return post.call(this, m, t); };
			const start = AudioBufferSourceNode.prototype.start;
			AudioBufferSourceNode.prototype.start = function (...a) { const x = this.buffer?.getChannelData(0); played.push({ duration: this.buffer?.duration, rate: this.playbackRate.value, rms: x ? Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length) : 0 }); return start.apply(this, a); };
			const make = BaseAudioContext.prototype.createPanner;
			BaseAudioContext.prototype.createPanner = function () { const p = make.call(this); panners.push(p); return p; };
		});
		await page.goto('http://127.0.0.1:' + server.address().port + '/fixture');
		await page.waitForFunction(() => window.speech);
		await page.click('#go');
		// nothing is said in passing until the voices are loaded
		assert.equal(await page.evaluate(() => speech.remark('Too early.', { seed: 1 }, {})), false);
		await page.waitForFunction(() => speech.ready() || fallbacks.length, {}, { timeout: 300000 });
		assert.ok(await page.evaluate(() => speech.ready()), 'model never became ready');

		// a remark from three metres to your right, by a person whose own pitch is up a little
		const pitch = await page.evaluate(() => {
			const who = { seed: 4, male: false, ...shape({ seed: 4, age: 17, teen: true, male: false }) };
			speech.place({ x: 0, y: 1.6, z: 0 }, { x: 0, y: 0, z: -1 });
			window.started = 0;
			const ok = speech.remark('Morning! Lovely out, huh?', who, { at: () => ({ x: 3, y: 1.6, z: 0 }), audible: () => true, started: s => { started = s; }, done: p => events.push(['done', p]) });
			return ok ? who.pitch : 0;
		});
		assert.ok(pitch > 1, 'remark refused');
		await page.waitForFunction(() => events.length, {}, { timeout: 120000 });
		let r = await page.evaluate(() => ({ played, events, started, pan: panners.map(p => [p.positionX.value, p.panningModel]) }));
		assert.deepEqual(r.events[0], ['done', true]);
		// two sentences, two pieces, both at the person's pitch
		assert.equal(r.played.length, 2);
		assert.ok(r.played.every(x => Math.abs(x.rate - pitch) < 1e-6 && x.rms > 0.001));
		assert.deepEqual(r.pan[0], [3, 'HRTF']);
		assert.ok(r.started > 0.3);

		// the same person's same line again: replayed from memory, the worker never asked
		const before0 = await page.evaluate(() => ({ speaks, played: played.length }));
		await page.evaluate(() => { events.length = 0; const who = { seed: 4, male: false, ...shape({ seed: 4, age: 17, teen: true, male: false }) }; speech.remark('Morning! Lovely out, huh?', who, { at: () => ({ x: -2, y: 1.6, z: 0 }), audible: () => true, done: p => events.push(['again', p]) }); });
		await page.waitForFunction(() => events.length, {}, { timeout: 60000 });
		const after0 = await page.evaluate(() => ({ speaks, played: played.length, ev: events[0], cached: speech.cached() }));
		assert.deepEqual(after0.ev, ['again', true]);
		assert.equal(after0.speaks, before0.speaks, 'a repeated line went to the worker again');
		assert.equal(after0.played, before0.played + 2);
		assert.ok(after0.cached >= 2);
		// a conversation is going: a remark is refused; a conversation line cuts a remark short
		await page.evaluate(() => { events.length = 0; speech.speak('Let me tell you about the harbour, it is a long story.', { seed: 2 }); });
		assert.equal(await page.evaluate(() => speech.remark('Hi!', { seed: 3 }, {})), false);
		await page.waitForFunction(() => played.length >= 2, {}, { timeout: 120000 });
		await page.evaluate(() => { speech.cancel(); speech.remark('This one will be cut.', { seed: 5 }, { audible: () => true, done: p => events.push(['cut', p]) }); speech.speak('Sorry, where was I?', { seed: 2 }); });
		await page.waitForFunction(() => events.some(e => e[0] === 'cut'), {}, { timeout: 60000 });
		r = await page.evaluate(() => events);
		assert.deepEqual(r.find(e => e[0] === 'cut'), ['cut', false]);
		await page.waitForTimeout(4000);
		await page.evaluate(() => speech.cancel());

		// walked off while it was being made: it goes unsaid
		const before = await page.evaluate(() => played.length);
		await page.evaluate(() => { events.length = 0; speech.remark('You will not hear this.', { seed: 6 }, { audible: () => false, done: p => events.push(['gone', p]) }); });
		await page.waitForFunction(() => events.length, {}, { timeout: 120000 });
		assert.deepEqual(await page.evaluate(() => events[0]), ['gone', false]);
		assert.equal(await page.evaluate(() => played.length), before);
		assert.deepEqual(errors, []);
		assert.deepEqual(await page.evaluate(() => fallbacks), []);
		console.log('PASS chatter voice', JSON.stringify({ pitch }));
		await page.evaluate(() => speech.dispose());
	} finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
