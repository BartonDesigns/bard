// Full-faceplate integration: real voice holds/releases, instance motion and save identity.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ viewport: { width: 480, height: 320 }, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15' });
		page.setDefaultTimeout(300000);
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => {
			const api = await L99IslandDoor.engine();
			await api.open({ seed: 1337, earth: false, biome: 'TROPICAL', origin: { id: 'test-body', seed: 1337.125, type: 'TERRAN', name: 'Test world' } });
			Crysis.music.auto(false);
		});
		console.log('Full faceplate and procedural world ready');
		const result = await page.evaluate(async () => {
			initAudio(); await ctx.resume();
			const api = L99Island, W = api.world(), T = api.T;
			// Find a generated boulder, then use the normal streamer at that location.
			let rock;
			for (const c of W.vegetation.cells.values()) if (c.items.boulder?.length) { rock = c.items.boulder[0]; break; }
			if (!rock) throw Error('No boulder in generated cells');
			const P = W.player.state; P.pos.set(rock.x + 5, rock.y + 2, rock.z); P.vel.set(0,0,0); P.flying = true;
			api.camera().position.copy(P.pos); W.vegetation.stream(api.camera(), true);
			window._leadLatch = false;
			playLead('kbd:resonance-check', 7, 1, false, .8);
			const voice = L99Continuity.performance().notes.find(n => n.id === 'kbd:resonance-check');
			if (!voice) throw Error('Real synth voice missing from performance snapshot');
			// The analyser gate is controlled here; the note lifecycle remains the real synth's.
			const sample = L99Continuity.sample;
			try {
				L99Continuity.sample = () => ({ bass: .02, mid: .3, high: .15 });
				for (let i = 0; i < 240; i++) { W.music.update(1/60); W.vegetation.react(1/60, P.pos); }
				const lifted = rock.resonance?.y || 0;
				const blocked = W.vegetation.obstacles(rock.x, rock.z, .35, rock.y + 1.7).some(o => o.x === rock.x && o.z === rock.z);
				// Locate the rendered instance and confirm its actual matrix moved.
				let matrixLift = 0;
				const m = new T.Matrix4();
				for (const sp of W.vegetation.species.filter(s => s.key === 'boulder')) for (const b of sp.meshes) for (let i = 0; i < b.im.count; i++) {
					b.im.getMatrixAt(i, m); if (Math.hypot(m.elements[12] - rock.x, m.elements[14] - rock.z) < .01) matrixLift = Math.max(matrixLift, m.elements[13] - rock.y);
				}
				stopLead('kbd:resonance-check', true);
				for (let i = 0; i < 600; i++) { W.music.update(1/60); W.vegetation.react(1/60, P.pos); }
				const settled = rock.resonance.y;
				const blocksAgain = W.vegetation.obstacles(rock.x, rock.z, .35, rock.y + 1.7).some(o => o.x === rock.x && o.z === rock.z);
				Crysis.homes.add('Resonance test');
				const spot = Crysis.homes.list().find(h => h.name === 'Resonance test')?.s;
				return { lifted, matrixLift, blocked, settled, blocksAgain, held: W.music.performance.held, notes: L99Continuity.performance().notes.length, body: W.body, spot: spot?.body || null };
			} finally { L99Continuity.sample = sample; stopLead('kbd:resonance-check', true); }
		});
		assert.ok(result.lifted > 3, JSON.stringify(result)); assert.ok(Math.abs(result.lifted-result.matrixLift) < .01);
		assert.equal(result.blocked, false); assert.equal(result.settled, 0); assert.equal(result.blocksAgain, true); assert.equal(result.held, 0);
		assert.equal(result.spot.rawSeed, 1337.125); assert.equal(result.spot.key, result.body.key);
		assert.equal(result.body.rawSeed, 1337.125); assert.equal(result.body.terrainSeed, 1337);
		console.log(JSON.stringify(result));
		await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
		assert.deepEqual(errors, []);
		console.log('Music/instance/collision integration passed without page or shader errors');
	} finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
