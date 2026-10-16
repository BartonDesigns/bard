import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ART_FAMILIES, artFamily, retailIdentity, loadSignArt } from '../src/signage/art.js';
import { realmSignRecords, caveSignRecords, colonySignRecords } from '../src/signage/world-art.js';
import { storefrontDecals } from '../src/signage/placement.js';
import { BRAND_COLLECTIONS, BRAND_COUNT, brandIdentity, brandCategory, productBrand } from '../src/signage/brand-catalog.js';
import { SYSTEMS } from '../src/signage/systems.js';

const shop = {x:20,z:30,id:'phone-1',name:'Ada Phone Repair',type:'phonefix',use:'shop',label:'Phone repair'};
const front = {x:20,z:34,nx:0,nz:1,g:2,run:8,door:1,height:3.4};
test('actual tenant identity; tall banner clears entrance and fits facade',()=>{
 const a=storefrontDecals(shop,front,SYSTEMS.us), b=a.find(r=>r.face.k==='banner');
 assert.equal(b.face.name,shop.name); assert.equal(b.face.family,'brands-mobile'); assert.equal(b.face.trade,brandIdentity('mobile',shop.id).trade);
 assert.equal(b.face.request,false); assert.ok(b.h>3); assert.ok(b.hy-b.h/2>=.149); assert.ok(b.hy+b.h/2<front.height);
 assert.ok(Math.abs(b.x-(front.x+front.door)) > 1+b.w/2);
 assert.deepEqual(a,storefrontDecals(shop,front,SYSTEMS.us));
 assert.equal(storefrontDecals({...shop,request:true},front,SYSTEMS.us).find(r=>r.face.k==='banner').face.request,true);
 assert.ok(!storefrontDecals(shop,{...front,run:3},SYSTEMS.us).some(r=>r.face.k==='banner'));
});
test('world families reflect materials and preserve trade semantics',()=>{
 assert.equal(artFamily({type:'MEDIEVAL'}),'heritage'); assert.equal(artFamily({type:'MYSTICAL'}),'mystic');
 assert.equal(artFamily({civ:{village:'fae'}}),'mystic'); assert.equal(artFamily({airless:true}),'orbital');
 assert.equal(retailIdentity('cafe').family,'brands-coffee'); assert.equal(retailIdentity('grocer').family,'brands-pantry');
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

test('200 unique brands remain stable and category-specific',()=>{
 assert.equal(BRAND_COUNT,200);assert.equal(new Set(Object.values(BRAND_COLLECTIONS).flatMap(c=>c.names)).size,200);
 for(const [id,c] of Object.entries(BRAND_COLLECTIONS)){
  assert.equal(c.names.length,8);const variants=new Set();
  for(let i=0;i<200;i++){const a=brandIdentity(id,'shop-'+i);assert.deepEqual(a,brandIdentity(id,'shop-'+i));variants.add(a.trade);assert.equal(a.brand,c.names[a.trade]);}
  assert.equal(variants.size,8);
 }
 assert.equal(brandCategory('apartment'),null);assert.equal(brandCategory('fishmonger'),null);
 assert.equal(brandCategory('phonefix'),'mobile');assert.equal(brandCategory('hardware'),'hardware');
 assert.equal(productBrand(3,'shelf').family,'brands-dairy');assert.equal(productBrand(7,'shelf').family,'brands-cleaning');assert.equal(productBrand(-1),null);
});

test('campaign formats stay on suitable surfaces, deterministic and outside door clearance',async()=>{
 const {shopCampaigns,wallCampaign}=await import('../src/signage/campaigns.js');
 const formats=new Set();
 for(let i=0;i<100;i++){
  const b={...shop,id:'shop-'+i},f={...front,run:12,height:9,door:0};
  const c=shopCampaigns(b,f);assert.deepEqual(c,shopCampaigns(b,f));
  for(const r of c.signs){formats.add(r.face.format);assert.ok(Number.isFinite(r.x+r.z+r.hy+r.w+r.h));assert.equal(r.face.family,'brands-mobile');
   if(r.face.format==='poster')assert.ok(Math.abs((r.x-f.x)*f.nz-(r.z-f.z)*f.nx)>1+r.w/2);
   if(r.face.format==='flag')assert.ok(r.hy-r.h/2>2.5);
   if(r.face.format==='billboard')assert.ok(r.hy+r.h/2<f.height);
  }
  assert.ok(shopCampaigns(b,f,{phone:true}).signs.filter(s=>s.ny===1).length<=1);
 }
 for(const format of ['poster','pamphlet','flag','billboard'])assert.ok(formats.has(format));
 assert.equal(shopCampaigns({...shop,use:'home'},front).signs.length,0);
 assert.equal(wallCampaign({kind:'industrial',w:12,h:20,civic:true}),null);
 assert.equal(wallCampaign({kind:'side',w:12,h:20,storefront:true}),null);
 const walls=Array.from({length:100},(_,x)=>wallCampaign({kind:'industrial',x,z:4,y:3,nx:0,nz:1,w:14,h:24})).filter(Boolean);
 assert.ok(walls.length>0);for(const w of walls){assert.equal(w.h,23.5);assert.equal(w.hy-w.h/2,.25);assert.ok(w.hy+w.h/2<24);}
});
