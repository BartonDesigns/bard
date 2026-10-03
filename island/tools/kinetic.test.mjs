import test from 'node:test';
import assert from 'node:assert/strict';
import { createKineticModel, createKineticVoices } from '../src/music/kinetic-model.js';
import { createKinetic } from '../src/music/kinetic.js';
import * as THREE from 'three';

test('garden is silent until triggered; gravity impacts settle and replay restores cascade', () => {
	const m = createKineticModel({count:32}); let hits=0;
	m.update(1,()=>hits++); assert.equal(hits,0); assert.equal(m.running,false);
	m.replay(); const start=m.bodies.map(b=>b.delay);
	for(let i=0;i<120*90;i++)m.update(1/120,()=>hits++);
	assert.ok(hits>32); assert.equal(m.running,false); assert.ok(m.bodies.every(b=>b.y===0.71&&b.vy===0));
	m.replay(); assert.deepEqual(m.bodies.map(b=>b.delay),start); assert.ok(m.bodies.every(b=>!b.rest));
});
test('pendulum crossing plays increasing authored degrees, silence stops, timestep stays bounded',()=>{
	const m=createKineticModel({kind:'pendulum'}), notes=[]; m.replay();
	for(let i=0;i<240;i++)m.update(1/120,b=>notes.push(b.ring));
	assert.equal(m.bodies.length,15); assert.equal(notes.length,15); assert.deepEqual(notes,[...notes].sort((a,b)=>a-b));
	assert.ok(m.bodies.every(b=>b.y>0)); m.silence(); const y=m.bodies[0].y; m.update(100,()=>assert.fail('silent')); assert.equal(m.bodies[0].y,y);
});
test('gravity and restitution govern real bounce; BPM governs authored ring release',()=>{
	const a=createKineticModel({count:1,bpm:60,gravity:1}), b=createKineticModel({count:1,bpm:120,gravity:10}); a.replay();b.replay();
	assert.equal(a.bodies[0].delay,2*b.bodies[0].delay);
	a.bodies[0].delay=b.bodies[0].delay=0; a.update(.1);b.update(.1);assert.ok(a.bodies[0].y>b.bodies[0].y);
	b.configure({restitution:0,bpm:Infinity,gravity:NaN}); for(let i=0;i<500;i++)b.update(1/120);
	assert.equal(b.running,false);assert.equal(b.settings.bpm,120);assert.equal(b.settings.gravity,10);
});
function fixture(){
	const pending=new Map(), calls=[], stops=[];let serial=0;
	const timers={setTimeout(fn){pending.set(++serial,fn);return serial;},clearTimeout(id){pending.delete(id);}};
	const host={_spAuto:'preserved',playLead(...a){calls.push(a);},stopLead(id){stops.push(id);}};
	return {pending,calls,stops,host,timers};
}
test('faceplate IDs, scale routing, bounded voices and all pending note-offs cleaned',()=>{
	const f=fixture(),v=createKineticVoices(f.host,{timers:f.timers,maxVoices:3});
	for(let i=0;i<8;i++)v.note(i,2);
	assert.equal(v.count,3);assert.equal(f.pending.size,3);assert.equal(f.stops.length,5);assert.equal(new Set(f.calls.map(a=>a[0])).size,8);
	assert.equal(f.calls[0][3],false);assert.equal(f.host._spAuto,'preserved');
	v.note(24,1,{scale:0,root:2}); assert.equal(f.calls.at(-1)[1],33);assert.equal(f.calls.at(-1)[3],true);
	v.dispose();v.dispose();assert.equal(v.count,0);assert.equal(f.pending.size,0);assert.equal(f.stops.length,9);assert.equal(v.note(1,1),false);
});
test('failed host voices cleaned; timed release does not stop manual IDs',()=>{
	const f=fixture(),v=createKineticVoices(f.host,{timers:f.timers});v.note(0,1);
	[...f.pending.values()][0]();assert.equal(v.count,0);assert.equal(f.stops.length,1);assert.ok(f.stops[0].startsWith('auto:crysis-rig:'));
	f.host.playLead=()=>{throw Error('host failed');};assert.equal(v.note(0,1),false);assert.equal(v.count,0);assert.equal(f.host._spAuto,'preserved');
});
test('scene rigs replace cleanly, resources dispose once and creation itself is silent',()=>{
	const scene=new THREE.Scene(), f=fixture(), rig=createKinetic({scene,host:f.host});
	assert.equal(scene.children.length,0);assert.equal(f.calls.length,0);
	for(const kind of ['garden','pendulum','garden']){
		rig.spawn({kind});assert.equal(scene.children.length,1);assert.equal(f.calls.length,0);
		const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);if(o.isInstancedMesh)resources.add(o);});
		const counts=new Map();for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)||0)+1));
		rig.silence();rig.silence();rig.update(1);rig.clear();rig.clear();assert.equal(scene.children.length,0);
		for(const r of resources)assert.equal(counts.get(r),1);
	}
	rig.dispose();assert.equal(rig.spawn(),false);
});
