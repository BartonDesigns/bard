import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGraphicsRenderer, graphicsMode, renderRatio, recentGraphicsLoss, rememberGraphicsLoss, GRAPHICS_UNAVAILABLE } from '../src/world/graphics-startup.js';
import { createGovernor } from '../src/world/governor.js';
import { createShaderWarm } from '../src/world/shaderwarm.js';
import { meterGL } from '../src/world/gpumeter.js';

const store = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k,v) => m.set(k,String(v)) }; };
function canvas(bad = false) {
	const gl = { VERTEX_SHADER:1, FRAGMENT_SHADER:2, HIGH_FLOAT:3, MEDIUM_FLOAT:4, dead:false,
		isContextLost() { return this.dead; }, getShaderPrecisionFormat: () => bad ? null : { precision:23 },
		getExtension: () => ({ loseContext: () => { gl.dead = true; } }) };
	return { gl, listeners:new Set(), addEventListener(k,f) { this.listeners.add(f); }, removeEventListener(k,f) { this.listeners.delete(f); }, getContext() { return gl; } };
}
test('null shader precision is rejected before Three; one fresh low-power canvas recovers', () => {
	const first=canvas(true), second=canvas(), storage=store(), calls=[];
	class Renderer { constructor(o) { calls.push(o); } }
	const r=createGraphicsRenderer({canvas:first,Renderer,replaceCanvas:old=>{assert.equal(old,first);return second;},storage});
	assert.equal(r.canvas,second);assert.equal(r.recovered,true);assert.equal(calls.length,1);
	assert.equal(calls[0].powerPreference,'low-power');assert.equal(calls[0].antialias,false);
	assert.equal(first.gl.dead,true);assert.equal(first.listeners.size,0);assert.equal(second.listeners.size,0);
	assert.equal(recentGraphicsLoss(storage),true);assert.equal(createGovernor({storage}).info().ceiling,'low');
});
test('permanent startup failure is bounded and reports an actionable error', () => {
	let attempts=0, constructed=0;const first=canvas(true),second=canvas(true);
	assert.throws(()=>createGraphicsRenderer({canvas:first,Renderer:class{constructor(){constructed++;}},replaceCanvas:()=>{attempts++;return second;},storage:store()}),(e)=>{assert.equal(e.message,GRAPHICS_UNAVAILABLE);assert.equal(e.detail.tries.length,2,'both tries told in the error');assert.match(e.detail.tries[0].error,/context/);return true;});
	assert.equal(attempts,1);assert.equal(constructed,0);assert.equal(first.gl.dead,true);assert.equal(second.gl.dead,true);
});
test('a renderer constructor failure also releases its context before retry', () => {
	const first=canvas(),second=canvas();let calls=0;
	const r=createGraphicsRenderer({canvas:first,Renderer:class{constructor(){if(++calls===1)throw Error('driver reset');}},replaceCanvas:()=>second,storage:store()});
	assert.equal(r.recovered,true);assert.equal(first.gl.dead,true);assert.equal(calls,2);
});
test('High is the default; Auto, Low or anything else saved comes back on High', () => {
	const storage=store();assert.equal(graphicsMode(storage),'high');
	const g=createGovernor({storage,mode:()=>graphicsMode(storage)});assert.equal(g.info().tier,'high');g.apply();assert.equal(g.info().tier,'high');
	for(const v of ['auto','low','corrupt']){storage.setItem('l99-quality',v);assert.equal(graphicsMode(storage),'high');}
});
test('High starts on the best tier even after visits that crashed or lost the graphics', () => {
	const storage=store();rememberGraphicsLoss(storage);
	storage.setItem('l99-governor',JSON.stringify({ceiling:3,at:Date.now(),crashes:[Date.now()-1000],live:Date.now()-500}));
	const g=createGovernor({phone:true,storage,mode:()=>'high'});assert.equal(g.info().tier,'high');g.update(.1,60);assert.equal(g.info().tier,'high');
});
test('Ultra is a saved choice: High on a phone, with the desktop\'s pixel budget', () => {
	const storage=store();storage.setItem('l99-quality','ultra');assert.equal(graphicsMode(storage),'ultra');
	const g=createGovernor({phone:true,storage,mode:()=>graphicsMode(storage)});g.apply();assert.equal(g.info().tier,'high');
	const w=1170,h=2532,phoneR=renderRatio({width:w,height:h,dpr:3,phone:true}),ultraR=renderRatio({width:w,height:h,dpr:3,mode:'ultra'});
	assert.ok(ultraR>phoneR);assert.equal(ultraR,renderRatio({width:w,height:h,dpr:3,mode:'high'}));
});
test('Retina and 4K render buffers remain within their pixel budgets at every tier', () => {
	for(const [w,h] of [[1920,1080],[3840,2160],[7680,4320]])for(const ratio of [1,.85,.7,.55]) {
		const r=renderRatio({width:w,height:h,dpr:2,ratio});assert.ok(w*h*r*r<=2400000*ratio*ratio+1);
	}
	const w=1920,h=1080,r=renderRatio({width:w,height:h,dpr:2,ratio:.85});
	assert.ok(w*h*r*r/(w*h*1.75**2)<.28,'at least 72% fewer screen pixels than previous desktop default');
});
test('shader warm-up skips hidden branches and wakes them only when visible', async () => {
	const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),hidden=new THREE.Group();hidden.visible=false;
	const a=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()),b=a.clone();b.material=a.material.clone();hidden.add(b);scene.add(a,hidden);
	const batches=[],r={getContext:()=>({isContextLost:()=>false}),compileAsync:async group=>batches.push([...group.children])};
	const w=createShaderWarm(r,scene,camera);await w.all();assert.deepEqual(batches.flat(),[a]);hidden.visible=true;await w.all();assert.deepEqual(batches.flat(),[a,b]);
	b.material.needsUpdate=true;await w.all();assert.deepEqual(batches.flat(),[a,b,b]);
});
test('shader compilation never overlaps and pauses background work on slow frames', async () => {
	const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();for(let i=0;i<4;i++)scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
	let release,calls=0;const r={getContext:()=>({isContextLost:()=>false}),compileAsync:()=>{calls++;return new Promise(ok=>release=ok);}};
	const w=createShaderWarm(r,scene,camera);w.tick(1,{frameMs:80});assert.equal(calls,0);
	w.tick(1);w.tick(1);assert.equal(calls,1);release();await new Promise(setImmediate);w.tick(1);assert.equal(calls,2);release();await new Promise(setImmediate);
});

test('offscreen world materials wait until the camera can see them', async () => {
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, .1, 100);
	const front = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); front.position.z = -5;
	const behind = front.clone(); behind.material = front.material.clone(); behind.position.z = 5; scene.add(front, behind);
	const batches = [], warm = createShaderWarm({ getContext: () => ({ isContextLost: () => false }), compileAsync: async group => batches.push(...group.children) }, scene, camera);
	await warm.all(); assert.deepEqual(batches, [front]);
	camera.lookAt(0, 0, 5); await warm.all(); assert.deepEqual(batches, [front, behind]);
});
test('reset cancels stale async shader bookkeeping', async () => {
	const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
	let release;const w=createShaderWarm({getContext:()=>({isContextLost:()=>false}),compileAsync:()=>new Promise(ok=>release=ok)},scene,camera);
	const job=w.all();w.reset();scene.clear();release();await job;assert.equal(w.info().compiled,0);assert.equal(w.info().pending,0);
});
test('GPU accounting cannot subtract retired context resources after restoration', () => {
	const gl={drawingBufferWidth:10,drawingBufferHeight:10,SAMPLES:1,getParameter:()=>4,getContextAttributes:()=>({antialias:true}),bindBuffer(){},bufferData(){},deleteBuffer(){}};
	const meter=meterGL(gl),old={};gl.bindBuffer(1,old);gl.bufferData(1,1000);assert.equal(meter.bytes(),5400);
	meter.reset();gl.deleteBuffer(old);assert.equal(meter.bytes(),4400);
	const fresh={};gl.bindBuffer(1,fresh);gl.bufferData(1,500);gl.deleteBuffer(fresh);assert.equal(meter.bytes(),4400);
});

test('a context reset releases loading even when its shader compiler never completes', async () => {
	const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
	const warm = createShaderWarm({ getContext: () => ({ isContextLost: () => false }), compileAsync: () => new Promise(() => {}) }, scene, new THREE.PerspectiveCamera());
	const job = warm.all(); warm.reset();
	await job;
	assert.equal(warm.info().busy, false); assert.equal(warm.info().compiled, 0);
});
