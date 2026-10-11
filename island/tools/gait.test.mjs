import test from 'node:test';
import assert from 'node:assert/strict';
import { gaitSignature, gaitDrift } from '../src/people/gait.js';
test('gait identity survives respawn and does not depend on population order',()=>{
 const first=gaitSignature(1921);for(let i=0;i<1000;i++)gaitSignature(i);assert.deepEqual(first,gaitSignature(1921));
 assert.equal(new Set(Array.from({length:1000},(_,i)=>JSON.stringify(gaitSignature(i)))).size,1000);
});
test('drift is continuous, bounded and independent of frame sampling',()=>{
 for(let seed=0;seed<100;seed++){
  const g=gaitSignature(seed);for(let t=0;t<120;t+=.1){assert.ok(Math.abs(gaitDrift(g,t))<=.027);assert.ok(Math.abs(gaitDrift(g,t+.001)-gaitDrift(g,t))<.00003);}
  assert.equal(gaitDrift(g,60),gaitDrift(g,3600/60));
 }
});
