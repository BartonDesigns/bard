import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { refineGarmentSurface, sleeveDistance, finishGarmentEdges } from '../src/people/garment-tailoring.js';
import { fittedHairFrame } from '../src/people/hair-frame.js';

test('rounded garment samples preserve shared edges and interpolate bone identities',()=>{
 const g=new T.BufferGeometry();
 const attributes={position:[[0,1,0],[-.2,.8,0],[0,.6,0],[.2,.8,0]],normal:[[0,1,1],[-1,0,1],[0,-1,1],[1,0,1]],uv:[[0,0],[0,1],[1,1],[1,0]],skinIndex:[[5,0,0,0],[8,0,0,0],[5,0,0,0],[8,0,0,0]],skinWeight:Array(4).fill([1,0,0,0]),slot:Array(4).fill([0]),drape:Array(4).fill([0]),cuff:Array(4).fill([1])};
 for(const [key,rows]of Object.entries(attributes))g.setAttribute(key,new T.BufferAttribute(new (key==='skinIndex'?Uint16Array:Float32Array)(rows.flat()),rows[0].length));
 g.setIndex([0,1,2,0,2,3]);const out=refineGarmentSurface(g),p=out.attributes.position;
 assert.equal(p.count,9);assert.equal(out.index.count,24);
 assert.ok(out.userData.refinement.maxOffset>0&&out.userData.refinement.maxOffset<=.004001);
 for(let i=0;i<p.count;i++){
  let sum=0;for(let j=0;j<4;j++){const w=out.attributes.skinWeight.array[i*4+j];sum+=w;if(w>0)assert.ok([5,8].includes(out.attributes.skinIndex.array[i*4+j]));}
  assert.ok(Math.abs(sum-1)<1e-6);
  assert.ok(p.getZ(i)>=0&&p.getZ(i)<=.004001);
 }
 out.dispose();
});

test('cuff clipping follows the arm plane with normalized cut-edge weights',()=>{
 const g=new T.BufferGeometry(),n=new T.Vector3(1,-1,0).normalize(),d=.6;
 const rows={position:[[.2,1,0],[.9,.5,0],[.9,.5,.15]],normal:Array(3).fill([0,0,1]),skinIndex:[[2,0,0,0],[3,0,0,0],[3,0,0,0]],skinWeight:Array(3).fill([1,0,0,0]),slot:Array(3).fill([10]),drape:Array(3).fill([0]),cuff:Array(3).fill([0])};
 for(const [key,v]of Object.entries(rows))g.setAttribute(key,new T.BufferAttribute(new (key==='skinIndex'?Uint16Array:Float32Array)(v.flat()),v[0].length));g.setIndex([0,1,2]);
 const plane=[n.x,n.y,n.z,d],cut={sleevePlanes:{L:{short:plane},R:{short:plane}}};
 assert.ok(sleeveDistance([.2,1,0],'short',cut)>0);
 // Move the end past the cuff: the old horizontal-y clip would miss this angled cut.
 g.attributes.position.setXYZ(1,1.2,.2,0);g.attributes.position.setXYZ(2,1.2,.2,.15);
 const out=finishGarmentEdges(g,{top:{sleeves:'short'}},cut,{});
 assert.ok(out.userData.tailoring.edgeSegments>0);
 const p=out.attributes.position;
 for(let i=0;i<p.count;i++){
  assert.ok(sleeveDistance([p.getX(i),p.getY(i),p.getZ(i)],'short',cut)>=-1e-6);
  assert.ok(Math.abs([...out.attributes.skinWeight.array.slice(i*4,i*4+4)].reduce((a,b)=>a+b,0)-1)<1e-6);
 }
 out.dispose();
});

test('fitted hair frames follow the new surface, stay orthogonal and do not mutate cached grooms',()=>{
 const V=new Float32Array([0,1,0,1,1,0,0,0,1,2,2,2]);
 const F={I:[0,1,2,3,3,3],UV:new Float32Array([0,0,1,0,0,1,0,0]),N:new Float32Array(Array(4).fill([0,0,1]).flat()),T:new Float32Array(Array(4).fill([1,0,0]).flat())};
 const before=JSON.stringify(F),result=fittedHairFrame(V,F,1,{c:new T.Vector3(0,0,-1)});
 assert.equal(JSON.stringify(F),before);
 for(let i=0;i<4;i++){
  const n=new T.Vector3().fromArray(result.N,i*3),t=new T.Vector3().fromArray(result.T,i*3);
  assert.ok(Math.abs(n.length()-1)<1e-6&&Math.abs(t.length()-1)<1e-6);
  assert.ok(Math.abs(n.dot(t))<1e-6);
 }
 assert.ok(Math.abs(result.T[2])>.2);
});
