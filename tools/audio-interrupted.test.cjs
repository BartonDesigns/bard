const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = html.slice(html.indexOf('function unlockAudio() {'), html.indexOf('// Hide the visual "TAP TO ENABLE SOUND"'));
test('a user tap resumes interrupted audio even after a previous successful unlock', () => {
 for (const state of ['interrupted', 'suspended', 'running']) {
  let resumes = 0; const ctx = { state, currentTime: 10, resume() { resumes++; return Promise.resolve(); } };
  const box = { ctx, _audioUnlocked: true, initAudio() {}, window: {}, clearTimeout() {}, setTimeout() { return 1; }, _audioVerify() {} };
  vm.runInNewContext(code + '\nunlockAudio();', box);
  assert.equal(resumes, state === 'running' ? 0 : 1);
  assert.equal(box._audioUnlocked, state === 'running');
 }
});
