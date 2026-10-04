// Run under flock /tmp/bard-browser.lock. Software GL smoke, not device FPS evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const out = process.env.BARD_QA_OUT || 'docs/verification/cave-release-smoke';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const report = { method: 'Chromium SwiftShader, offline/safe, 480x320 touch viewport; rendered world and shader resource smoke. Not physical-device performance or human playtesting.', worlds: [], errors: [], failedRequests: [], resourceErrors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 320 }, hasTouch: true, deviceScaleFactor: 1 });
    page.setDefaultTimeout(300000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('requestfailed', q => report.failedRequests.push({ url: q.url(), failure: q.failure() }));
    page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) { if (/Failed to load resource/.test(m.text())) report.resourceErrors.push({text: m.text(), location: m.location()}); else report.errors.push(m.text()); } });
    await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8797') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
    assert.ok(await page.evaluate(() => typeof L99IslandDoor.engine === 'function'));
    await page.screenshot({ path: `${out}/faceplate.png`, timeout: 300000 });
    const sample = async name => {
      const result = await page.evaluate(() => {
        const a = L99Island, r = a.renderer(), gl = r.getContext();
        r.render(a.scene(), a.camera()); gl.finish();
        const samplerTypes = new Set([gl.SAMPLER_2D, gl.SAMPLER_CUBE, gl.SAMPLER_3D, gl.SAMPLER_2D_SHADOW, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_2D_ARRAY_SHADOW, gl.SAMPLER_CUBE_SHADOW, gl.INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_2D]);
        const programs = r.info.programs.map(p => {
          const active = [];
          for (let i = 0; i < gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); i++) { const u = gl.getActiveUniform(p.program, i); if (samplerTypes.has(u.type)) active.push({ name: u.name.replace(/\[0\]$/, ''), size: u.size }); }
          const stages = gl.getAttachedShaders(p.program).map(s => {
            const source = gl.getShaderSource(s);
            return { stage: gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.VERTEX_SHADER ? 'vertex' : 'fragment', samplers: active.reduce((n, u) => n + ((source.match(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w*sampler\w*\s+[^;]+;/gi) || []).some(declaration => new RegExp('\\b' + u.name + '\\b').test(declaration)) ? u.size : 0), 0) };
          });
          return { runnable: p.diagnostics?.runnable !== false, activeSamplers: active.reduce((n, u) => n + u.size, 0), stages };
        });
        return { lost: gl.isContextLost(), programs, render: { ...r.info.render }, memory: { ...r.info.memory }, cave: a.world().underworld?.stats() };
      });
      assert.equal(result.lost, false);
      for (const p of result.programs) { assert.ok(p.runnable); assert.ok(p.activeSamplers <= 32); for (const s of p.stages) assert.ok(s.samplers <= 16); }
      report.worlds.push({ name, ...result }); console.log('Rendered', name, 'programs', result.programs.length);
    };
    await page.evaluate(async () => { const a = await L99IslandDoor.engine(); await a.open({ seed: 1337, earth: true }); Crysis.music.auto(false); window._KEYS_PLAY_ON = false; });
    await sample('generated-earth-island');
    await page.evaluate(() => L99Island.exploreCaves());
    const ui = await page.getByRole('button', { name: /Look toward/ }).evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, right: r.right, text: n.textContent }; }));
    assert.ok(ui.length > 0); assert.ok(ui.every(r => r.x >= 0 && r.right <= 480 && r.width > 0));
    report.caveDirectionsUi = ui;
    await page.screenshot({ path: `${out}/phone-cave-directions.png`, timeout: 300000 });
    await page.evaluate(() => L99Island.guide.show(false));
    await page.waitForFunction(() => !!L99Island.world().bayArea?.loaded());
    await page.evaluate(() => { const a = L99Island, w = a.world(), p = w.player.state; const x = (-122.4766 + 122.57) * 111320 * Math.cos(37.76 * Math.PI / 180), z = -(37.8356 - 37.76) * 110996; p.pos.set(x, w.island.heightAt(x, z) + 40, z); p.flying = true; p.vel.set(0, 0, 0); a.camera().position.copy(p.pos); w.bayArea.update(a.camera(), 0); });
    await sample('bay-area');
    await page.evaluate(async () => { const a = L99Island, w = a.world(), q = w.globe.place(78.2232, 15.6469); await q.ready; const p = w.player.state; p.pos.set(q.x, Math.max(0, w.island.heightAt(q.x, q.z)) + 20, q.z); p.vel.set(0, 0, 0); p.flying = true; a.camera().position.copy(p.pos); w.globe.update(1 / 60, a.camera(), 0); });
    await sample('globe-svalbard');
    await page.evaluate(async () => { await L99Island.open({ seed: 1337, earth: false, biome: 'MAGMA' }); Crysis.music.auto(false); });
    await sample('magma-planet');
    await page.evaluate(() => { const a = L99Island, w = a.world(), c = w.underworld.plan.chambers[0]; a.close(); a.dom.mount.style.display = 'block'; w.player.state.pos.set(c.x, c.fy + 1.68, c.z); a.camera().position.copy(w.player.state.pos); for (let i = 0; i < 180; i++) w.underworld.update(1 / 60, i / 60); w.underworld.settle(); w.underworld.update(1 / 60, 3); });
    await sample('magma-underground');
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.failedRequests.filter(q => q.url.startsWith(process.env.BARD_URL || 'http://127.0.0.1:8797') && q.failure?.errorText !== 'net::ERR_ABORTED'), []);
    report.networkLimits = 'Optional esm.run browser model may be unavailable; see exact failedRequests. realcity.dispose cancels in-flight Bay chunks on world replacement with ERR_ABORTED. Other required local failures fail this smoke.';
    report.passed = true;
  } finally { fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
