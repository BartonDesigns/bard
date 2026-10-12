// Production orbital controller/renderers and the existing Held Note realm in isolation.
import * as THREE from 'three';
import { createOrbitalFlight } from '../src/space/flight.js';
import { createBeyond } from '../src/planet/beyond.js';
import { planetProfile } from '../src/planet/profile.js';
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setSize(640,400);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.style.cssText='margin:0;background:#000';document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(60,1.6,.1,1e12),scene=new THREE.Scene();scene.background=new THREE.Color(0x171026);
const shared=Object.fromEntries(['uBass','uMid','uHigh','uPulse','uTime'].map(k=>[k,{value:0}]));shared.performance={};
let P,world,orbit,realm,time=0,mode='real',pending=null,visits=[];
function reset(next='real') {
 orbit?.dispose();realm?.dispose();realm=null;mode=next;pending=null;visits=[];
 P={pos:new THREE.Vector3(0,14000,0),vel:new THREE.Vector3(),yaw:0,pitch:0,roll:0,flying:true,locked:false,boost:1,gait:{count:0}};
 world={player:{state:P},island:{seed:2281969,gravity:1},body:{key:'stellar-test'}};
 camera.position.copy(P.pos);
 orbit=createOrbitalFlight({renderer,camera,dom:{mount:document.body},world,earth:false,seed:1969,profile:planetProfile('MOON'),shared,location:()=>({lat:0,lon:0}),sun:()=>new THREE.Vector3(0,1,-1).normalize(),hint:()=>{},voyage(dest){
  visits.push(dest); if(mode==='pending')return new Promise((resolve,reject)=>pending={resolve,reject});
  orbit.dispose();P.pos.set(0,3,40);P.locked=false;P.flying=false;
  realm=createBeyond({renderer,scene,camera,island:world.island,shared,site:{x:0,y:2,z:0,h:120,r:50,yaw:0},player:world.player,hint:()=>{},mount:document.body,isPhone:true});
  realm.enter(true);return true;
 }});
 orbit.before();P.pos.y=200000;frame(.016);return state();
}
function frame(dt=1/30,render=true){time+=dt;shared.uTime.value=time;
 if(realm){camera.position.copy(P.pos);camera.rotation.set(P.pitch,P.yaw,P.roll||0,'YXZ');realm.update(dt,time);if(render){if(!realm.render())renderer.render(scene,camera);}}
 else {orbit.after(dt);orbit.updateHud();if(render)orbit.render(time);}
}
function advance(seconds){for(let t=0;t<seconds;t+=1/30)frame(1/30,false);frame(0);return state();}
function go(id,radii){const b=orbit.bodies().find(b=>b.id===id),n=new THREE.Vector3(.15,.3,1).normalize();P.pos.copy(b.pos).addScaledVector(n,b.size*radii);P.vel.set(0,0,0);orbit.face(id);camera.position.copy(P.pos);camera.rotation.set(P.pitch,P.yaw,P.roll||0,'YXZ');frame(.016);return state();}
function state(){return {orbit:orbit.info(),realm:realm?.state(),visits:visits.map(v=>({...v})),locked:P.locked,flying:P.flying,position:P.pos.toArray(),errors:renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};}
window.stellar={reset,frame,advance,go,state,renderer,camera,orbit:()=>orbit,realm:()=>realm,png:()=>renderer.domElement.toDataURL('image/png'),exit:()=>orbit.exitStellar(),async rejectDisposed(){orbit.dispose();pending?.reject(Error('cancelled build'));await Promise.resolve();await Promise.resolve();return state();}};
reset();window.STELLAR_READY=true;
