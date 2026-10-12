import * as THREE from 'three';
import {createTowers} from '../src/bay/towers.js';
import {planWorkplace} from '../src/interiors/workplace-plan.js';
import {setFrame,bayFrame} from '../src/earth/globeframe.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#a7c5d5');scene.add(new THREE.HemisphereLight(0xc9e4ff,0x545042,2.2));const sun=new THREE.DirectionalLight(0xffecd5,3);sun.position.set(-20,70,40);scene.add(sun);
const camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.08,1000),p={pos:new THREE.Vector3(),vel:new THREE.Vector3()},bay={heightAt:()=>0};
let o={x:0,z:0,y:-1.2,h:276,w:42,d:38,a:0,kind:2,src:{kind:11}},T;
const city={towersNear:(x,z)=>Math.hypot(x-o.x,z-o.z)<200?[o]:[],setDoor:()=>{}};
T=createTowers(scene,bay,city,{isPhone:innerWidth<600,mount:document.body,player:()=>p});
function frame(){T.update(1,camera,13,0);renderer.render(scene,camera);}
function visit(index=30){const plan=planWorkplace(o,.25),L=plan.levels[index];p.pos.set(o.x,L.y+1.7,o.z+plan.coreZ+1.2);camera.position.copy(p.pos);camera.lookAt(o.x,L.y+1.7,o.z+10);frame();return T.diagnostics();}
function show(index=30,angle='aisle'){const plan=planWorkplace(o,.25),L=plan.levels[index];visit(index);if(angle==='atrium'){camera.position.set(o.x+11,L.y+1.7,o.z+12);camera.lookAt(o.x-5,L.y-1,o.z-8);}else{camera.position.set(o.x-8,L.y+1.72,o.z+13);camera.lookAt(o.x-3,L.y+1.5,o.z-10);}renderer.render(scene,camera);return T.diagnostics();}
function mall(){camera.position.set(1000,10,1000);p.pos.copy(camera.position);frame();o={x:100,z:0,y:-1.2,h:25.5,w:80,d:60,a:0,kind:6,src:{kind:6}};return show(2,'atrium');}
function japan(){camera.position.set(1000,10,1000);p.pos.copy(camera.position);frame();setFrame(35.68,139.76);o={x:-400000,z:0,y:-1.2,h:276,w:42,d:38,a:0,kind:2,src:{kind:11}};return show(24);}
window.workplaceReview={T,scene,renderer,camera,p,visit,show,mall,japan,frame,lot:()=>o,plan:()=>planWorkplace(o,.25),failed:()=>renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).length};show(30);window.WORKPLACE_READY=true;
