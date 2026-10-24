import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { landmarks } from '../src/people/garment.js';
import { armorAttachmentFit, dressArmorEffects, clearArmorEffects } from '../src/people/relic-armor-effects.js';
import { createRelicArmor, disposeRelicArmor } from '../src/crysis/relic-armor-models.js';
import { LEGENDARY_ARMOR } from '../src/gameplay/legendary-items.js';

// The shipped MakeHuman mesh/rig, not a hand-placed stand-in. No GPU or texture loader.
const D=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../textures/human-base-dd84ad3d07.json.gz',import.meta.url))));
const rig=JSON.parse(fs.readFileSync(new URL('../assets/people/rig150.json',import.meta.url)));
const decode=(s,T)=>{const b=Buffer.from(s,'base64');return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const ids=decode(D.indices,Uint8Array),weightBytes=new Uint8Array(decode(D.weights,Uint16Array).buffer),patch=Buffer.from(rig.patch,'base64');
for(let i=0;i<patch.length;i+=14){const v=patch.readUInt16LE(i);ids.set(patch.subarray(i+2,i+6),v*4);weightBytes.set(patch.subarray(i+6,i+14),v*8);}
const A={bones:rig.bones,ids,weights:new Uint16Array(weightBytes.buffer)},raw=decode(D.position,Int16Array);
function person(height=1.75,width=1,depth=1){
 const p=Float32Array.from(raw,v=>v*D.unit);let lo=Infinity,hi=-Infinity;
 for(let i=1;i<p.length;i+=3){lo=Math.min(lo,p[i]);hi=Math.max(hi,p[i]);}
 const s=height/(hi-lo);for(let i=0;i<p.length;i+=3){p[i]*=s*width;p[i+1]=(p[i+1]-lo)*s;p[i+2]*=s*depth;}
 const at=indices=>indices.reduce((v,i)=>v.add(new THREE.Vector3(p[i*3],p[i*3+1],p[i*3+2])),new THREE.Vector3()).multiplyScalar(1/indices.length);
 const heads=rig.bones.map(b=>at(b.ids)),map=Object.fromEntries(rig.bones.map((b,i)=>[b.name,i])),bones=rig.bones.map(()=>new THREE.Bone()),root=new THREE.Group();
 rig.bones.forEach((b,i)=>{bones[i].position.copy(heads[i]);if(b.parent>=0){bones[i].position.sub(heads[b.parent]);bones[b.parent].add(bones[i]);}else root.add(bones[i]);});
 return {root,bones,map,rest:{heads},cut:landmarks(A,p,heads,map,height),height,eye:at(D.eyes.L)};
}

test('actual rig places eyes and the relic front on +Z, with fitted front AND rear torso clearance',()=>{
 for(const [h,w,d] of [[1.55,.85,.85],[1.75,1,1],[1.95,1.2,1.25]]){
  const P=person(h,w,d),head=P.rest.heads[P.map.head];
  assert.ok(P.eye.z>head.z,'actual eye sockets establish the front direction');
  for(const id of ['gallery-scale-mail','cinder-core-cuirass','stormwarden-flightcoat']){
   dressArmorEffects(P,[id]);const fx=P.relicEffects[0];
   assert.ok(fx.root.position.z+P.rest.heads[P.map.spine01].z>P.cut.frontZ);
   assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(fx.root.quaternion).z>.99);
   const sculpt=fx.root.children.find(c=>c.name.startsWith('relic-sculpture:'));
   P.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(sculpt);
   assert.ok(b.max.z>P.cut.frontZ+.01,'front relief outside torso');
   assert.ok(b.min.z<P.cut.backZ-.005,'rear relief outside torso');
   clearArmorEffects(P);
  }
 }
});

test('circlet fits measured skull and gauntlets point along real left/right fingers',()=>{
 const P=person();
 dressArmorEffects(P,['lumencrest-circlet']);
 const crown=P.relicEffects[0],h=P.rest.heads[P.map.head];
 assert.ok(crown.root.position.z+h.z>P.cut.skull.z1);
 assert.ok(Math.abs(crown.root.position.y+h.y-(P.cut.skull.y1-.075))<1e-6);
 clearArmorEffects(P);
 dressArmorEffects(P,['stormwarden-gauntlets']);
 for(let i=0;i<2;i++){
  const side=i?'R':'L',dir=P.rest.heads[P.map['finger3-1.'+side]].clone().sub(P.rest.heads[P.map['wrist.'+side]]).normalize();
  const axis=new THREE.Vector3(0,-1,0).applyQuaternion(P.relicEffects[i].root.quaternion);
  assert.ok(axis.dot(dir)>.999,'long axis follows fingers, not global down');
  const dorsal=new THREE.Vector3(0,0,-1).projectOnPlane(dir).normalize();
  assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(P.relicEffects[i].root.quaternion).dot(dorsal)>.999,'plates on knuckles, not the palm');
 }
 for(const side of ['L','R']){P.bones[P.map['upperarm01.'+side]].rotation.z=side==='L'?-.9:.9;P.bones[P.map['wrist.'+side]].rotation.x=.35;}
 P.root.rotation.y=1.1;P.root.updateMatrixWorld(true);
 for(let i=0;i<2;i++){
  const side=i?'R':'L',w=P.bones[P.map['wrist.'+side]].getWorldPosition(new THREE.Vector3());
  const dir=P.bones[P.map['finger3-1.'+side]].getWorldPosition(new THREE.Vector3()).sub(w).normalize();
  const axis=new THREE.Vector3(0,-1,0).applyQuaternion(P.relicEffects[i].root.getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(axis.dot(dir)>.999,'bone-local fit survives an arm/wrist pose and whole-body turn');
 }
 clearArmorEffects(P);
});

test('all eight sculptures carry rear geometry in pickup and equipped forms',()=>{
 for(const def of LEGENDARY_ARMOR)for(const worn of [false,true]){
  const model=createRelicArmor(def.id,{worn,lod:'low'});let rear=0;
  model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)if(p.getZ(i)<(worn?-.06:-.03))rear++;});
  assert.ok(rear>40,`${def.id} has constructed reverse-side detail`);disposeRelicArmor(model);
 }
});

test('missing or invalid measurements use finite front-facing fallback anchors',()=>{
 const anchor=['spine01',0,-.08,.17,1];
 for(const P of [{height:1.75,map:{}},{height:1.75,map:{spine01:0},rest:{heads:[new THREE.Vector3()]},cut:{frontZ:1e9,backZ:-1e9,chestX:NaN}}]){
  const f=armorAttachmentFit(P,'body',anchor);assert.deepEqual(f.position,[0,-.08,.17]);assert.deepEqual(f.quaternion,[0,0,0,1]);
 }
});
