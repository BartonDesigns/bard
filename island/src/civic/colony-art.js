// Colony-local civic details: no dependency on the Earth survey, road database or world origin.
import * as T from 'three';
import {createAtlas,faceKey} from '../signage/atlas.js';
import {createBatch} from '../signage/batch.js';
import {releaseSignMaterials} from '../signage/materials.js';
import {LAYER} from '../signage/layers.js';
import {artRevision} from '../signage/art.js';
import {graffitiGraphic} from './graffiti-catalog.js';
import {colonyArtRecords} from './placement.js';
import {createDiamondPlateMaterial} from './materials.js';
import {qualityNow} from '../world/governor.js';
export function createColonyArt({parent,surfaces=[],decks=[],seed=0,isPhone=false,env=null,dust=true}){
 const group=new T.Group();group.name='colony-civic-art';parent.add(group);
 const atlas=createAtlas({size:isPhone?512:1024,scale:isPhone?.5:1,name:'colony-civic'});
 const cap=isPhone?20:48,paint=createBatch(group,'paint',LAYER.paint,atlas.tex,cap,{phone:isPhone,name:'colony-civic'});
 paint.mesh.material.envMap=env;paint.mesh.material.envMapIntensity=.4;
 const plateMat=createDiamondPlateMaterial({phone:isPhone});plateMat.envMap=env;plateMat.envMapIntensity=.6;
 // Physical-size UVs per instance keep all tread decks in a single draw.
 const plateGeo=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),plateScale=new T.InstancedBufferAttribute(new Float32Array(Math.max(1,decks.length)*2),2);plateGeo.setAttribute('aCivicScale',plateScale);
 plateMat.onBeforeCompile=sh=>{sh.vertexShader='attribute vec2 aCivicScale;\n'+sh.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
 #ifdef USE_MAP
 vMapUv*=aCivicScale;
 #endif
 #ifdef USE_BUMPMAP
 vBumpMapUv*=aCivicScale;
 #endif
 #ifdef USE_ROUGHNESSMAP
 vRoughnessMapUv*=aCivicScale;
 #endif`);};plateMat.customProgramCacheKey=()=> 'colony-civic-deck-1';
 const plateMesh=new T.InstancedMesh(plateGeo,plateMat,Math.max(1,decks.length));plateMesh.name='civic-tread-decks';plateMesh.count=0;plateMesh.frustumCulled=false;plateMesh.receiveShadow=true;group.add(plateMesh);
 const matrix=new T.Matrix4(),pos=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3(),up=new T.Vector3(0,1,0);
 const records=colonyArtRecords(surfaces,{seed,dust});let disposed=false,rev=-1,timer=0,px=Infinity,py=Infinity,pz=Infinity,lastTier='',active=[];
 function update(camera,dt=0){
  if(disposed)return;
  const x=camera.position.x,y=camera.position.y,z=camera.position.z,Q=qualityNow()||{},tier=[Q.far??1,Q.people??1].join(':'),range=(isPhone?85:160)*Math.max(.5,Q.far??1),limit=Math.max(6,Math.floor(cap*Math.min(1,Q.people??1)));
  timer-=dt;if(timer>0&&rev===artRevision()&&tier===lastTier&&Math.hypot(x-px,y-py,z-pz)<18)return;
  timer=.5;rev=artRevision();lastTier=tier;px=x;py=y;pz=z;
  active=records.filter(r=>Math.hypot(x-r.x,z-r.z)<range&&Math.abs(camera.position.y-r.y)<55).sort((a,b)=>Math.hypot(x-a.x,z-a.z)-Math.hypot(x-b.x,z-b.z)).slice(0,limit);
  const want=new Map();for(const r of active){r.key=faceKey(r.face);want.set(r.key,{face:r.face,w:r.w,h:r.h});}atlas.sync(want);paint.clear();
  for(const r of active){const cell=atlas.get(r.key);if(!cell)continue;paint.put(r.x,r.y,r.z,r.nx,0,r.nz,r.nz,0,-r.nx,r.w,r.h,cell,3,seed%997/997,r.wear,graffitiGraphic(r.face.k,r.face.seed)?.gloss?1:0);}paint.commit();
  let plates=0;const nearest=decks.map(d=>({d,range:Math.hypot(d.x-x,d.y-camera.position.y,d.z-z)})).filter(v=>v.range<range).sort((a,b)=>a.range-b.range).slice(0,isPhone?8:18);
  for(const {d}of nearest){matrix.compose(pos.set(d.x,d.y+.006,d.z),quat.setFromAxisAngle(up,d.yaw),scale.set(d.w,1,d.d));plateMesh.setMatrixAt(plates,matrix);plateScale.setXY(plates,d.w/.4,d.d/.4);plates++;}plateMesh.count=plates;plateMesh.visible=plates>0;plateMesh.instanceMatrix.needsUpdate=true;plateScale.needsUpdate=true;

 }
 return {group,update,info:()=>({planned:records.length,visible:paint.n,decks:decks.length,visibleDecks:plateMesh.count,draws:(paint.n?1:0)+(plateMesh.count?1:0),atlas:atlas.info(),art:[...new Set(active.map(r=>graffitiGraphic(r.face.k,r.face.seed)?.id).filter(Boolean))]}),where:()=>active.map(r=>({x:r.x,y:r.y,z:r.z,id:r.id,art:graffitiGraphic(r.face.k,r.face.seed)})),dispose(){if(disposed)return;disposed=true;paint.dispose();releaseSignMaterials(atlas.tex);atlas.dispose();plateGeo.dispose();plateMesh.dispose();plateMat.dispose();group.removeFromParent();}};
}
