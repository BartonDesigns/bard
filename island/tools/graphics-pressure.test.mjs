import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGraphicsRecovery } from '../src/world/graphics-recovery.js';
import { createGovernor, setTier } from '../src/world/governor.js';
import { renderRatio } from '../src/world/graphics-startup.js';
import { createSeaMirror } from '../src/world/seamirror.js';
import { createSeaDepth } from '../src/world/seadepth.js';

function recoveryClock() {
	let clock = 0, serial = 0; const tasks = new Map(), timeouts = [];
	const recovery = createGraphicsRecovery({ now: () => clock, onTimeout: () => timeouts.push(clock),
		setTimer: (fn, ms) => { const id = ++serial; tasks.set(id, { fn, at: clock + ms }); return id; }, clearTimer: id => tasks.delete(id) });
	return { recovery, timeouts, advance(ms) { clock += ms; for (const [id,t] of tasks) if (t.at <= clock) { tasks.delete(id); t.fn(); } } };
}
test('a non-restoring context rejects pending work and offers one terminal recovery, including late restores', async () => {
	const c = recoveryClock(); assert.equal(c.recovery.lost(), false);
	const failed = assert.rejects(c.recovery.wait(), { code: 'GRAPHICS_RELOAD_REQUIRED' });
	c.advance(7999); assert.equal(c.recovery.blocked(), false);
	c.advance(1); await failed; assert.equal(c.recovery.blocked(), true); assert.equal(c.timeouts.length, 1);
	assert.equal(c.recovery.restored(), false); c.advance(30000); assert.equal(c.timeouts.length, 1);
});
test('successful restoration releases build work and cancels the old timeout', async () => {
	const c = recoveryClock(); c.recovery.lost(); let ready = false;
	const waiting = c.recovery.wait().then(() => { ready = true; }); await Promise.resolve(); assert.equal(ready, false);
	c.advance(3000); assert.equal(c.recovery.restored(), true); await waiting;
	c.advance(60001); c.recovery.lost(); c.advance(5000); assert.equal(c.recovery.blocked(), false);
	c.recovery.restored(); c.advance(20000); assert.deepEqual(c.timeouts, []);
});
test('a second reset rejects queued work immediately without a stale timeout', async () => {
	const c = recoveryClock(); c.recovery.lost(); c.recovery.restored(); c.advance(1000);
	assert.equal(c.recovery.lost(), true); await assert.rejects(c.recovery.wait(), { code: 'GRAPHICS_RELOAD_REQUIRED' });
	c.advance(10000); assert.deepEqual(c.timeouts, []);
});
test('saved High cannot bypass measured memory pressure, including reapplying settings', () => {
	let bytes = 0, mode = 'high';
	const g = createGovernor({ mode: () => mode, meter: { bytes: () => bytes }, budgetMB: 100 });
	g.apply(); assert.equal(g.info().tier, 'high'); g.update(.1, 80); assert.equal(g.info().tier, 'high');
	bytes = 100 * 1048576;
	for (let i=0;i<140;i++) g.update(.1, 16);
	assert.equal(g.info().tier, 'minimal'); g.apply(); assert.equal(g.info().tier, 'minimal');
	mode = 'auto'; g.apply(); assert.equal(g.info().tier, 'minimal'); setTier(0);
});
test('a recovery can require shadow-free Low and the safe pixel cap still follows tiers', () => {
	const g = createGovernor({ mode: () => 'high' }); g.apply(); g.lost(2); g.apply(); assert.equal(g.info().tier, 'low');
	const options = { width: 390, height: 844, dpr: 3, phone: true, safe: true };
	assert.equal(renderRatio({ ...options, ratio: 1 }), 1);
	assert.equal(renderRatio({ ...options, ratio: .55 }), .55); setTier(0);
});

function fakeRenderer() {
	let target = null; const batches = [], draws = [];
	return { batches, draws, extensions: { has: () => false }, shadowMap: { autoUpdate: true, needsUpdate: false },
		getContext: () => ({ isContextLost: () => false }), getDrawingBufferSize: v => v.set(800,600),
		getRenderTarget: () => target, setRenderTarget: t => { target = t; }, getClearAlpha: () => 1,
		getClearColor: c => c.set(0), setClearColor() {}, clear() {},
		compileAsync: async group => { const list = []; group.traverse(o => { if(o.material) list.push(o); }); batches.push(list); },
		render: (scene, camera) => draws.push({ scene, camera }) };
}
test('water warms only visible reflected objects in bounded batches and admits streamed materials', async () => {
	setTier(0); const r=fakeRenderer(), m=createSeaMirror(r), scene=new THREE.Scene(), land=new THREE.Group(), hidden=new THREE.Group(); hidden.visible=false;
	scene.add(land,hidden); const camera=new THREE.PerspectiveCamera(70,4/3,.1,100); camera.position.set(0,3,6); camera.lookAt(0,0,0);
	for(let i=0;i<7;i++){const o=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());o.position.set((i-3)*.4,1,0);land.add(o);}
	const behind=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());behind.position.z=1000;land.add(behind);
	for(let i=0;i<50;i++) hidden.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
	for(let i=0;i<12;i++){m.render(scene,camera,[land]);await new Promise(setImmediate);}
	assert.ok(r.draws.length>0); assert.equal(m.uniforms.uReflOn.value,1); assert.equal(m.uniforms.uRefl.value,m.target.texture);
	assert.ok(r.batches.every(b=>b.length<=2)); assert.equal(new Set(r.batches.flat()).size,7);
	assert.ok(!r.batches.flat().includes(behind)); assert.equal(hidden.visible,false); assert.equal(land.visible,true);
	const extra=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());extra.position.y=1;land.add(extra);
	m.render(scene,camera,[land]);assert.equal(m.uniforms.uReflOn.value,0); await new Promise(setImmediate);
	m.render(scene,camera,[land]);assert.ok(r.batches.flat().includes(extra)); assert.equal(m.uniforms.uReflOn.value,1);
	setTier(2);m.render(scene,camera,[land]); assert.equal(m.target.width,1);assert.equal(m.uniforms.uRefl.value,null);
	m.dispose();setTier(0);
});
test('disabling depth/reflection releases targets and stale warm-up cannot restore old-world bindings', async () => {
	setTier(0);const r=fakeRenderer(),depth=createSeaDepth(r),mirror=createSeaMirror(r),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.1,100);
	camera.position.set(0,3,6);camera.lookAt(0,0,0);
	const land=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());land.position.y=1;scene.add(land);
	let finish;r.compileAsync=()=>new Promise(resolve=>finish=resolve);
	mirror.render(scene,camera,[land]); depth.render(scene,camera);
	assert.ok(depth.target.width>1);assert.equal(depth.uniforms.uSeaDepth.value,depth.target.depthTexture);
	mirror.reset();depth.reset();finish();await new Promise(setImmediate);
	assert.equal(mirror.uniforms.uRefl.value,null);assert.equal(depth.uniforms.uSeaDepth.value,null);
	assert.equal(mirror.target.width,1);assert.equal(depth.target.width,1);
	depth.dispose();mirror.dispose();setTier(0);
});
