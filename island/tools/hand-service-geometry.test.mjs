import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {refineHandSurface} from '../src/people/hand-surface.js';
import {createServiceVehicle,rollServiceWheels} from '../src/services/vehicle-model.js';

test('hand refinement preserves joint identities and normalizes blended influences',()=>{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1],2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute([1,2,0,0,3,4,0,0,5,6,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute([.6,.4,0,0,.8,.2,0,0,.9,.1,0,0],4));g.setIndex([0,1,2]);
 const r=refineHandSurface(g,[0,1,2]);assert.equal(r.index.count,12);assert.equal(r.attributes.position.count,6);
 for(let i=0;i<6;i++){let sum=0;for(let k=0;k<4;k++){const b=r.attributes.skinIndex.getComponent(i,k);assert.ok(Number.isInteger(b));assert.ok(b>=0&&b<=6);sum+=r.attributes.skinWeight.getComponent(i,k);}assert.ok(Math.abs(sum-1)<1e-6);}
 assert.deepEqual(Array.from(g.attributes.position.array),[0,0,0,1,0,0,0,1,0]);
 assert.deepEqual(Array.from(r.attributes.uv.array).slice(0,6),[0,0,1,0,0,1]);
});

test('all service vehicles have finite grounded geometry, shared resources, LOD and rotating wheels',()=>{
 for(const kind of ['ambulance','engine','utility','van']){
  const a=createServiceVehicle(kind),b=createServiceVehicle(kind);assert.equal(a.levels.length,2);
  a.traverse(o=>{if(!o.geometry)return;for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value),kind);});
  const bounds=new T.Box3().setFromObject(a);assert.ok(bounds.min.y>=-.02,kind);assert.ok(bounds.max.y<3.2,kind);
  const first=a.levels[0].object.children[0],second=b.levels[0].object.children[0];assert.equal(first.geometry,second.geometry);assert.equal(first.material,second.material);
  rollServiceWheels(a,.5);assert.ok(a.userData.wheels[0].rotation.x>0);assert.ok(Math.abs(b.userData.wheels[0].rotation.x)<1e-12);
 }
});
