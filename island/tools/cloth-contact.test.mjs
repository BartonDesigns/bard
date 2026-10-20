import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {poseCloth,clothUniforms,projectCloth,calibrateCloth} from '../src/people/cloth-collide.js';
import {groomChunk,LONG_GROOMS} from '../src/people/long-groom.js';

test('cloth contact follows bone rotation and translation in mesh space',()=>{
 const bone=new THREE.Bone();bone.position.set(1,2,3);bone.rotation.z=Math.PI/2;bone.updateMatrixWorld();
 const P={skeleton:{bones:[bone],boneInverses:[new THREE.Matrix4()]}};
 const caps=[{bone:0,a:new THREE.Vector3(),b:new THREE.Vector3(0,1,0),r:.1}],U=clothUniforms();
 poseCloth(P,caps,U,{bindMatrixInverse:new THREE.Matrix4().makeTranslation(-1,-2,-3)});
 assert.ok(U.uClothB.value[0].distanceTo(new THREE.Vector3(-1,0,0))<1e-6);
 const q=new THREE.Vector3(-.5,.09,0),corrected=projectCloth(q,U.uClothA.value,U.uClothB.value);
 assert.ok(Math.abs(corrected.y-.102)<1e-6);assert.ok(q.y===.09);
 const untouched=new THREE.Vector3(3,3,3);assert.equal(projectCloth(untouched,U.uClothA.value,U.uClothB.value).distanceTo(untouched),0);
 const deep=new THREE.Vector3(-.5,0,0);assert.ok(projectCloth(deep,U.uClothA.value,U.uClothB.value).distanceTo(deep)<=.035001);
});
test('long-groom recipes have smooth bounded geometry and normalized deformation weights',()=>{
 const P={height:1.75,map:{head:5,neck01:4,spine01:3},skull:{c:new THREE.Vector3(0,1.62,0),radius:()=>.095}};
 for(const recipe of Object.values(LONG_GROOMS)){
  const g=groomChunk(P,recipe);assert.ok(g.n>12000&&g.n<16000);assert.ok(g.I.length/3<25000);assert.ok(g.V.every(Number.isFinite));
  for(let i=0;i<g.n;i++){assert.ok(Math.abs(g.SW.slice(i*4,i*4+4).reduce((a,b)=>a+b)-1)<1e-6);assert.ok(Math.abs(Math.hypot(...g.N.slice(i*3,i*3+3))-1)<1e-5);}
  assert.equal(Math.max(...g.I),g.n-1);
 }
});

test('contact calibration preserves the fitted rest silhouette',()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([.08,.5,0,.3,.5,0],3));const cap={a:new THREE.Vector3(),b:new THREE.Vector3(0,1,0),r:.1};calibrateCloth(g,[cap]);const inset=g.attributes.clothInset;assert.ok(Math.abs(inset.getX(0)-.022)<1e-6);assert.equal(inset.getX(1),0);const p=new THREE.Vector3(.08,.5,0),A=[new THREE.Vector4(0,0,0,.1)],B=[cap.b];assert.ok(projectCloth(p,A,B,inset.getX(0)).distanceTo(p)<1e-6);A[0].x=.015;B[0]=new THREE.Vector3(.015,1,0);assert.ok(Math.abs(projectCloth(p,A,B,inset.getX(0)).x-.095)<1e-6);});
