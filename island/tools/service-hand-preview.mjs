import './weapon-hand-preview.mjs';
import * as T from 'three';
import { createFistView } from '../src/combat/melee-view.js';
import { createServiceVehicle } from '../src/services/vehicle-model.js';
import { createResponder, stepResponder } from '../src/services/responders.js';
import { MOVES } from '../src/combat/melee-rules.js';
const w = window.weaponReview, fists = createFistView({camera:w.camera,isPhone:w.phoneTier});
w.scene.add(w.camera);
w.renderer.shadowMap.enabled=true;w.renderer.shadowMap.type=T.PCFSoftShadowMap;
for(const o of w.scene.children){if(o.isDirectionalLight){o.castShadow=true;o.shadow.mapSize.set(1024,1024);o.shadow.camera.left=-10;o.shadow.camera.right=10;o.shadow.camera.top=10;o.shadow.camera.bottom=-10;o.shadow.camera.far=30;o.shadow.normalBias=.025;}if(o.isMesh)o.receiveShadow=true;}
const fleet = new T.Group();w.scene.add(fleet);
let responder;
const state={on:true,item:null,move:null,anim:null,m:null,mt:0,charging:false,charge:0,block:false,take:false,cuffed:false,dodge:0,dodgeSide:0,rock:0,step:0,pace:0};
function setup(){
 w.select('aurora-trail-rifle','first');w.P.root.visible=false;w.hand.hide();w.vm.cancel?.();
 w.camera.zoom=1;w.camera.position.set(0,0,0);w.camera.rotation.set(0,0,0);w.camera.fov=52;w.camera.updateProjectionMatrix();
 fleet.visible=false;fists.hide();
}
function render(){w.scene.updateMatrixWorld(true);w.renderer.render(w.scene,w.camera);return {calls:w.renderer.info.render.calls,tris:w.renderer.info.render.triangles,failed:w.failed()};}
function hand(mode='guard'){
 setup();state.block=mode==='block';state.item=mode==='grip'?'pipe':null;state.take=mode==='open';state.move=mode==='jab'?'jab':null;state.anim=state.move;state.m=state.move?MOVES.jab:null;state.mt=state.move?MOVES.jab.wind+MOVES.jab.active*.7:0;
 for(let i=0;i<100;i++)fists.update(1/60,1,state,{P:w.P,M:w.M});
 const result=render();
 const meshes=[],garments=[];fists.root.traverse(o=>{if(o.name.startsWith('anatomical-hand-'))meshes.push({name:o.name,tris:o.geometry.index.count/3,vertices:o.geometry.attributes.position.count});if(o.name==='garment-arms'&&o.visible)garments.push({tris:o.geometry.index.count/3,layers:o.geometry.attributes.garB.count});});
 return {...result,meshes,garments};
}
function vehicle(kind='ambulance',rear=false,distance=0){
 setup();fleet.visible=true;fleet.clear();responder?.dispose();responder=null;
 let model;
 if(kind==='ambulance'||kind==='engine'){responder=createResponder(kind,{x:0,y:0,z:0,yaw:0},fleet);model=responder.model;responder.lights(true,.1);}else{model=createServiceVehicle(kind);fleet.add(model);}
 w.camera.position.set(distance||7,4.2,rear?-8:9);w.camera.lookAt(0,1.1,0);w.camera.updateMatrixWorld(true);
 const result=render();return {...result,level:model.getCurrentLevel()};
}
function drive(){setup();responder=createResponder('ambulance',{x:0,y:0,z:0,yaw:0},w.scene);responder.drive([{x:0,z:0},{x:0,z:30}],true);for(let i=0;i<120;i++)stepResponder(responder,1/60,()=>0,[]);const rotated=responder.model.userData.wheels[0].rotation.x;responder.dispose();responder=null;return rotated;}
window.serviceReview={hand,vehicle,drive,fists,fleet,render};window.SERVICE_HAND_READY=true;
