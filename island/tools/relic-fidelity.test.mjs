import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { LEGENDARIES, LEGENDARY_ARMOR } from '../src/gameplay/legendary-items.js';
import { itemModel, triangles, disposeItemModel } from '../src/crysis/held-items.js';
import { createRelicArmor, disposeRelicArmor } from '../src/crysis/relic-armor-models.js';
import { legendaryFinish } from '../src/crysis/legendary-models.js';
import { dressArmorEffects, clearArmorEffects } from '../src/people/relic-armor-effects.js';
import { LOOKS } from '../src/people/armor-looks.js';

test('twenty finishes retain material identity instead of inheriting the all-gold shop finish',()=>{
 const old={c:new THREE.Color(0xffcc33),r:.2,m:1,tile:1,wear:.2,dens:4,glow:0};
 const F={main:old,trim:old,alt:old,core:old};
 const colors=new Set();
 for(const d of LEGENDARIES){const f=legendaryFinish(F,d);colors.add(f.main.c.getHex());assert.equal(f.core.c.getHex(),d.color);assert.ok(f.core.glow<=1);assert.ok(f.main.r>=.4);assert.equal(f.main.dens,4);}
 assert.equal(colors.size,20);assert.equal(F.main.c.getHex(),0xffcc33,'shared finish is never mutated');
});

test('more detailed weapons stay bounded at both LODs without increasing body draw calls',()=>{
 for(const def of LEGENDARIES){
  const hi=itemModel(def.id,{tier:4,lod:'high',plain:true}),low=itemModel(def.id,{tier:4,lod:'low',plain:true});
  assert.ok(triangles(hi)<12000,def.id);assert.ok(triangles(low)<4000,def.id);
  assert.ok(triangles(low)<triangles(hi)*.65,def.id);
  let bodies=0;
  hi.traverse(o=>{if(o.geometry?.attributes.surf)bodies++;});
  assert.ok(bodies<=3,`${def.id}: static detail is merged into body/cell/charger`);
  disposeItemModel(hi);disposeItemModel(low);
 }
});

test('eight armor sculptures have unique real volumes, three material batches and bounded high/low LODs',()=>{
 for(const worn of [false,true])for(const lod of ['high','low']){
  const fingerprints=new Set();
  for(const def of LEGENDARY_ARMOR){
   const a=createRelicArmor(def.id,{worn,lod}),h=createHash('sha256');
   assert.ok(a.children.length<=3);assert.ok(triangles(a)<5500,def.id);
   if(worn && lod==='low')assert.ok(triangles(a)<1600,def.id);
   const palette=new Set();
   a.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,c=o.geometry.attributes.color;
    assert.ok([...p.array,...c.array].every(Number.isFinite));h.update(Buffer.from(p.array.buffer));
    for(let i=0;i<c.count;i++)palette.add([c.getX(i),c.getY(i),c.getZ(i)].map(x=>x.toFixed(3)).join(','));
    assert.equal(o.material.vertexColors,true);
    if(o.material.map){assert.equal(o.material.map.image.width,128);assert.equal(o.material.bumpMap,o.material.map);assert.ok(o.geometry.attributes.uv);}
   });
   const size=new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3());
   assert.ok(Math.max(...size)<.85,def.id);assert.ok(size.z>.018,`${def.id}: not a flat icon`);assert.ok(palette.size>20,def.id);
   fingerprints.add(h.digest('hex'));disposeRelicArmor(a);
  }
  assert.equal(fingerprints.size,8);
 }
});

test('surface maps are shared and survive releasing an armor copy',()=>{
 const a=createRelicArmor('cinder-core-cuirass'),b=createRelicArmor('cinder-core-cuirass');
 const map=a.children[0].material.map;assert.equal(map,b.children[0].material.map);let disposed=0;
 map.addEventListener('dispose',()=>disposed++);disposeRelicArmor(a);assert.equal(disposed,0);assert.ok(b.children[0].geometry.attributes.position.count>0);disposeRelicArmor(b);
});

test('equipped relief follows its bone and redressing releases owned static resources once',()=>{
 const names=['head','spine01','lowerleg01.L','lowerleg01.R','wrist.L','wrist.R','foot.L','foot.R'];
 const P={bones:names.map(()=>new THREE.Bone()),map:Object.fromEntries(names.map((x,i)=>[x,i])),height:1.75};
 dressArmorEffects(P,LEGENDARY_ARMOR.map(x=>x.id));
 const owned=new Set();let releases=0;
 for(const fx of P.relicEffects){
  const sculpture=fx.root.children.find(c=>c.name.startsWith('relic-sculpture:'));assert.ok(sculpture);
  sculpture.traverse(o=>{if(o.isMesh)for(const r of [o.geometry,o.material]){owned.add(r);r.addEventListener('dispose',()=>releases++);}});
  const before=sculpture.getWorldPosition(new THREE.Vector3());fx.root.parent.position.x+=1;
  assert.ok(sculpture.getWorldPosition(new THREE.Vector3()).x>before.x+.99);
 }
 clearArmorEffects(P);clearArmorEffects(P);assert.equal(releases,owned.size);assert.ok(P.bones.every(b=>b.children.length===0));
 assert.equal(LOOKS['stormwarden-flightcoat'].outer.long,true);
});
