import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ART_FAMILIES, artFamily, retailIdentity, loadSignArt } from '../src/signage/art.js';
import { realmSignRecords, caveSignRecords, colonySignRecords } from '../src/signage/world-art.js';
import { storefrontDecals } from '../src/signage/placement.js';
import { SYSTEMS } from '../src/signage/systems.js';

const shop = {x:20,z:30,id:'phone-1',name:'Ada Phone Repair',type:'phonefix',use:'shop',label:'Phone repair'};
const front = {x:20,z:34,nx:0,nz:1,g:2,run:8,door:1,height:3.4};
test('actual tenant identity; tall banner clears entrance and fits facade',()=>{
 const a=storefrontDecals(shop,front,SYSTEMS.us), b=a.find(r=>r.face.k==='banner');
 assert.equal(b.face.name,shop.name); assert.equal(b.face.family,'consumer'); assert.equal(b.face.trade,0);
 assert.equal(b.face.request,false); assert.ok(b.h>3); assert.ok(b.hy-b.h/2>=.149); assert.ok(b.hy+b.h/2<front.height);
 assert.ok(Math.abs(b.x-(front.x+front.door)) > 1+b.w/2);
 assert.deepEqual(a,storefrontDecals(shop,front,SYSTEMS.us));
 assert.equal(storefrontDecals({...shop,request:true},front,SYSTEMS.us).find(r=>r.face.k==='banner').face.request,true);
 assert.ok(!storefrontDecals(shop,{...front,run:3},SYSTEMS.us).some(r=>r.face.k==='banner'));
});
test('world families reflect materials and preserve trade semantics',()=>{
 assert.equal(artFamily({type:'MEDIEVAL'}),'heritage'); assert.equal(artFamily({type:'MYSTICAL'}),'mystic');
 assert.equal(artFamily({civ:{village:'fae'}}),'mystic'); assert.equal(artFamily({airless:true}),'orbital');
 assert.equal(retailIdentity('cafe').trade,2); assert.equal(retailIdentity('grocer').trade,7);
 assert.equal(retailIdentity('apartment').trade,-1);
});
test('realm and cave art is attached to real shops, market counters and posts',()=>{
 const b={x:10,z:20,y:4,yaw:Math.PI/2,w:7,d:8};
 const records=realmSignRecords({inn:b,smithy:null,stalls:[]});
 assert.equal(records.length,2); assert.ok(records.some(r=>r.format==='banner'&&r.height>2.5));
 for(const r of records){assert.equal(r.name,"Bess's Inn"); assert.equal(r.family,'heritage'); assert.ok(r.x>14);}
 const cave=caveSignRecords([{x:1,z:2,y:-10,face:0}],{village:'fae'});
 assert.equal(cave.length,2); assert.ok(cave.every(r=>r.family==='mystic')); assert.equal(cave[1].format,'banner');
 assert.deepEqual(realmSignRecords({stalls:[]}),[]);
});
test('orbital signs use real site names and sampled ground, not assumed elevations',()=>{
 const a=colonySignRecords({name:'Test Station',hub:{x:0,z:0,r:30},outposts:[{x:20,z:40,r:10,name:'Copper Mine',kind:'mine'}]},(x,z)=>x+z);
 assert.equal(a[0].name,'Test Station'); assert.equal(a[1].name,'Copper Mine'); assert.equal(a[1].trade,1);
 for(const r of a){assert.equal(r.y,r.x+r.z); assert.equal(r.family,'orbital'); assert.ok(r.height>=3);}
});
test('all image families ship alpha-preserving desktop and smaller phone sheets',async()=>{
 for(const f of ART_FAMILIES) {
  const a=await sharp(new URL(`../assets/signage/${f}-v1.webp`,import.meta.url).pathname).metadata();
  const b=await sharp(new URL(`../assets/signage/${f}-v1-mobile.webp`,import.meta.url).pathname).metadata();
  assert.equal(a.width,1536); assert.equal(b.width,768); assert.equal(a.width/a.height,2); assert.equal(b.width/b.height,2); assert.equal(a.hasAlpha,true); assert.equal(b.hasAlpha,true);
 }
 assert.equal(await loadSignArt('not-a-family'),false);
});
