import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommunityProjectSites } from '../src/people/community-project-sites.js';
import { communityProjectSpot } from '../src/guide/community-project-marks.js';
import { F, toLL, toXZ, setFrame, bayFrame } from '../src/earth/globeframe.js';

function fixture(extra={}) {
	let time=1000, W={body:{key:'earth',type:'TERRAN'},island:{heightAt:()=>2,hasOcean:true}}, at={x:100,y:3.68,z:100};
	let targets=[{id:'place-the-park',name:'The Old Park',x:100,y:2,z:100}], activities=[], projects=[];
	const adapter=createCommunityProjectSites({world:()=>W,position:()=>at,targets:()=>targets,activities:()=>activities,projects:()=>projects,clock:()=>time,...extra});
	return {adapter,get world(){return W},set world(v){W=v},get at(){return at},set at(v){at=v},set targets(v){targets=v},set activities(v){activities=v},set projects(v){projects=v},advance:()=>{time+=6000}};
}
test('observed named places offer only safe authored project kinds',()=>{
	const f=fixture(), sites=f.adapter.list(); assert.equal(sites.length,1);const s=sites[0];
	assert.equal(s.name,'The Old Park');assert.deepEqual(s.kinds,['path','garden','gathering','resonance']);assert.equal(s.source,'place');
	for(const kind of s.kinds) assert.ok(communityProjectSpot(f.world,{id:s.id,siteId:s.id,world:'earth',kind,status:'surveying',anchor:s.anchor},{exact:s.anchor}));
});
test('missing names/coordinates, homes, caves, virtual shops and distant places are not construction targets',()=>{
	const f=fixture();f.targets=[{id:'bad',x:100,z:100},{id:'empty',name:'Empty'},{id:'far',name:'Far',x:2000,z:2000},{id:'home:resident',name:'My house',x:100,z:100},{id:'cave',name:'Cave',x:100,z:100,under:true},{id:'entrance',name:'Entrance',x:100,z:100,caveEntrance:true}];
	f.world.worldSites=()=>[{id:'imaginary-shop',name:'Virtual',x:100,z:100,virtual:true}];assert.deepEqual(f.adapter.list(),[]);
});
test('registered requests and real businesses preserve provenance while excluding input geometry',()=>{
	const f=fixture();f.targets=[];f.activities=[{id:'request-a',siteId:'market',siteAnchor:{x:100,y:2,z:100},place:'Local market',beneficiaryId:'npc:123',requesterName:'Mara'}];
	f.world.worldSites=()=>[{id:'forge',name:'Village Forge',x:130,z:100,geometry:'do not use',kind:'palace'}];
	const rows=f.adapter.list();assert.equal(rows.length,2);assert.equal(rows[0].source,'living-request');assert.equal(rows[0].requestId,'request-a');assert.equal(rows[0].npcId,'npc:123');
	assert.equal(rows[1].source,'business');assert.equal(rows[1].geometry,undefined);assert.equal(rows[1].kind,undefined);assert.ok(!rows[1].kinds.includes('palace'));
});
test('dry moon sites omit fertile gardens and allow ground below zero',()=>{
	const f=fixture();f.world={body:{key:'moon',type:'LUNAR'},island:{heightAt:()=>-20,hasOcean:false}};f.at={x:100,y:-18.32,z:100};
	const rows=f.adapter.list();assert.equal(rows.length,1);assert.equal(rows[0].anchor.y,-20);assert.deepEqual(rows[0].kinds,['path','gathering','resonance']);
});
test('fully wet or obstructed observed places never become offered geometry',()=>{
	const f=fixture();f.world.island.waterAt=()=>3;assert.deepEqual(f.adapter.list(),[]);delete f.world.island.waterAt;f.world.player={pushOut:p=>{p.x+=2}};f.advance();assert.deepEqual(f.adapter.list(),[]);
});
test('nearby projects invalidate cached proposals immediately while same site keeps its canonical anchor',()=>{
	const f=fixture();const site=f.adapter.list()[0];
	f.projects=[{world:'earth',siteId:'neighbour',kind:'garden',anchor:{x:105,y:2,z:100}}];assert.deepEqual(f.adapter.list(),[]);
	f.projects=[{world:'earth',siteId:site.id,kind:'gathering',anchor:{x:113,y:2,z:100}}];
	const same=f.adapter.list()[0];assert.equal(same.anchor.x,113);assert.deepEqual(same.kinds,['gathering']);
	f.projects=[{world:'moon',siteId:'neighbour',kind:'garden',anchor:{x:100,y:2,z:100}}];assert.equal(f.adapter.list().length,1);
});
test('Earth canonical geographic anchors survive rebasing and are offered at their real location',()=>{
	bayFrame();const f=fixture();f.world.globe={frame:F};const original=f.adapter.list()[0];assert.ok(Number.isFinite(original.anchor.lat));const ll=toLL(100,100);
	f.projects=[{world:'earth',siteId:original.id,kind:'garden',anchor:original.anchor}];setFrame(ll.lat,ll.lon);const here=toXZ(ll.lat,ll.lon);f.at={...here,y:3.68};f.targets=[{id:'place-the-park',name:'The Old Park',...here}];
	const next=f.adapter.list()[0];assert.ok(next);assert.equal(next.anchor.x,here.x);assert.equal(next.anchor.z,here.z);assert.equal(next.anchor.lat,original.anchor.lat);assert.equal(next.anchor.lon,original.anchor.lon);bayFrame();
});
test('local damage and cataclysm signal block only relevant project sites',()=>{
	const f=fixture();f.world.structures={cataclysm:()=>true,store:{each:callback=>callback('building',{x:100,z:100,c:1})}};
	assert.deepEqual(f.adapter.situation([{siteId:'near',anchor:{x:105,y:2,z:100}},{siteId:'far',anchor:{x:500,y:2,z:100}}]),{hazard:1,blockedSites:['near']});
});
