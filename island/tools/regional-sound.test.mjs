import { test } from 'node:test';
import assert from 'node:assert/strict';
const priorListener = globalThis.addEventListener;
globalThis.addEventListener = () => {};
const { createRegionalSound } = await import('../src/region/sound.js');
if (priorListener) globalThis.addEventListener = priorListener; else delete globalThis.addEventListener;

function audio() {
  const nodes = [], ctx = { currentTime: 100, sampleRate: 8000 };
  const param = () => ({ value: 0, events: [], setValueAtTime(v,t) { assert.ok(t >= 0); this.events.push(t); this.value=v; }, linearRampToValueAtTime(v,t) { this.setValueAtTime(v,t); }, exponentialRampToValueAtTime(v,t) { this.setValueAtTime(v,t); }, setTargetAtTime(v,t) { this.setValueAtTime(v,t); } });
  function node(kind) { const n = {kind, gain:param(), frequency:param(), Q:param(), pan:param(), edges:[], connect(to) { this.edges.push(to); return to; }, disconnect() { this.edges=[]; this.disconnected=true; }, start() { this.started=true; }, stop(t) { this.stopAt=t ?? ctx.currentTime; this.stopped=true; } }; nodes.push(n); return n; }
  for (const [method,kind] of [['createGain','gain'],['createOscillator','osc'],['createBufferSource','buffer'],['createBiquadFilter','filter'],['createStereoPanner','pan']]) ctx[method]=()=>node(kind);
  ctx.createBuffer=(channels,length,rate)=>({duration:length/rate,getChannelData:()=>new Float32Array(length)});
  const amb=node('amb'), send=node('send');
  return {ctx, amb, send, nodes, B:{get:()=>null}};
}
const here = (day=[],night=[]) => ({on:true,kit:{sound:{day,night}},culture:{faith:'mosque'},minaret:[900,0,0]});
const options = (extra={}) => ({hours:12.61,night:0,alt:0,cam:{position:{x:0,z:0},matrixWorld:{elements:[1,0,0]}},...extra});
const active = a => a.nodes.filter(n=>n.started && !n.disconnected);

test('prayer phrases use the audio clock, retain distance gain, and cancel above the ground',()=>{
  const A=audio(), sound=createRegionalSound({getMix:()=>A}), h=here();
  sound.update(.1,h,options()); assert.equal(sound.debug().events.call,1);
  assert.ok(A.nodes.some(n=>n.kind==='gain' && n.gain.value===.015));
  sound.update(100,h,options()); assert.equal(sound.debug().events.call,1,'suspended audio clock cannot enqueue phrases');
  A.ctx.currentTime+=20; sound.update(.1,h,options()); assert.equal(sound.debug().events.call,2);
  sound.update(.1,h,options({alt:200})); assert.equal(active(A).length,0);
  A.ctx.currentTime+=100; sound.update(100,h,options({alt:200})); assert.equal(sound.debug().events.call,2);
  sound.dispose(); assert.ok(A.nodes.filter(n=>!['amb','send'].includes(n.kind)).every(n=>n.disconnected));
});

test('church strikes are frame driven and pause cancels the remaining sequence',()=>{
  const A=audio(), sound=createRegionalSound({getMix:()=>A}), h=here(); h.minaret=null;
  sound.update(.1,h,options({hours:10.01,church:100})); assert.equal(sound.debug().events.churchbell,1);
  sound.update(100,h,options({hours:10.01,church:100})); assert.equal(sound.debug().events.churchbell,1);
  A.ctx.currentTime+=2; sound.update(.1,h,options({hours:10.01,church:100})); assert.equal(sound.debug().events.churchbell,2);
  sound.pause(); sound.pause(); assert.equal(active(A).length,0);
  A.ctx.currentTime+=100; sound.update(100,h,options({hours:10.01,church:100})); assert.equal(sound.debug().events.churchbell,2);
  sound.dispose();
});

test('night beds crossfade, attenuate indoors/rain, retire all nodes, and resume after pause',()=>{
  const A=audio(), sound=createRegionalSound({getMix:()=>A}), h=here(['wind'],['crickets','frogs']); h.minaret=null;
  sound.update(.1,h,options({hours:22,night:1})); assert.equal(sound.debug().beds.crickets,.04); assert.equal(sound.debug().beds.frogs,.06);
  sound.update(.1,h,options({hours:22,night:1,indoor:true,rain:.7})); assert.equal(sound.debug().beds.crickets,.004); assert.equal(sound.debug().beds.frogs,.021);
  const nightNodes=active(A); sound.update(7,h,options({hours:9,night:0})); assert.ok(nightNodes.every(n=>n.disconnected));
  assert.ok(active(A).length>0); sound.pause(); assert.equal(active(A).length,0);
  sound.update(.1,h,options({hours:22,night:1})); assert.ok(active(A).length>0);
  sound.dispose(); sound.dispose(); const count=A.nodes.length; sound.update(100,h,options()); assert.equal(A.nodes.length,count);
  assert.ok(A.nodes.filter(n=>!['amb','send'].includes(n.kind)).every(n=>n.disconnected));
});

test('audio context replacement retires the previous graph and rebuilds on the current bus',()=>{
  const old=audio(), next=audio(); let A=old;
  const sound=createRegionalSound({getMix:()=>A}), h=here(['wind']); h.minaret=null;
  sound.update(.1,h,options()); A=next; sound.update(.1,h,options());
  assert.ok(old.nodes.filter(n=>!['amb','send'].includes(n.kind)).every(n=>n.disconnected)); assert.ok(active(next).length>0);
  A=null; sound.update(.1,h,options()); assert.equal(active(next).length,0); sound.dispose();
});

test('short bird envelopes never schedule a negative sustain time and ended voices disconnect',()=>{
  const A=audio(), sound=createRegionalSound({getMix:()=>A}), h=here(['birdscold']); h.minaret=null; A.ctx.currentTime=0;
  sound.update(100,h,options()); assert.equal(sound.debug().events.birdscold,1);
  for(const n of A.nodes) for(const p of [n.gain,n.frequency]) for(let i=1;i<p.events.length;i++) assert.ok(p.events[i]>=p.events[i-1]);
  const lead=A.nodes.find(n=>n.onended); lead.onended(); assert.equal(active(A).length,0); sound.dispose();
});

test('active prayer dry and reverb paths hush indoors without changing the shared mix',()=>{
  const A=audio(), sound=createRegionalSound({getMix:()=>A}), h=here();
  A.amb.gain.value=.8; A.send.gain.value=1;
  sound.update(.1,h,options());
  const dry=A.nodes.find(n=>n.edges.includes(A.amb)), wet=A.nodes.find(n=>n.edges.includes(A.send));
  assert.equal(dry.gain.value,1); assert.equal(wet.gain.value,1);
  sound.update(.1,h,options({indoor:true})); assert.equal(dry.gain.value,.35); assert.equal(wet.gain.value,.35);
  assert.equal(A.amb.gain.value,.8); assert.equal(A.send.gain.value,1);
  sound.dispose(); assert.equal(A.amb.disconnected,undefined); assert.equal(A.send.disconnected,undefined);
});
