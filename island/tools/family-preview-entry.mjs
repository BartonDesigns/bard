// Real MakeHuman family staging for lifecycle and visual review. Bundle with esbuild.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createFamilyLife } from '../src/people/family-life.js';
import { peopleAssetsNow } from '../src/people/body.js';
import { isMinor } from '../src/combat/targets.js';
import { F } from '../src/earth/globeframe.js';
const renderer = new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,800); renderer.setPixelRatio(1); renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.style.cssText='margin:0;background:#80918a'; document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background=new THREE.Color(0x80918a);
const pm=new THREE.PMREMGenerator(renderer), env=pm.fromScene(new RoomEnvironment(),.04); scene.environment=env.texture;pm.dispose();
const sun=new THREE.DirectionalLight(0xffedce,2.2);sun.position.set(-4,9,6);scene.add(sun,new THREE.HemisphereLight(0xbac7d1,0x5d5543,1.2));
const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:0x77776b,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=2;scene.add(floor);
const camera=new THREE.PerspectiveCamera(42,1.6,.05,180);camera.position.set(9,5,11);camera.lookAt(0,3,0);
let W={body:{key:'family-review'},island:{heightAt:()=>2,half:100},player:{state:{yaw:0}},sky:{state:{hours:16}}};
let credits=1000,spent=0;const deeds=[];
const options={scene,world:()=>W,camera,mount:document.body,hint:()=>{},wallet:{credits:()=>credits,spend(c){if(c>credits)return false;credits-=c;spent+=c;return true;}},morality:()=>({score:()=>true,record:d=>deeds.push(d)})};
let families=createFamilyLife(options),time=0;
function frame(dt=1/30,render=true){time+=dt;families.update(dt,time,true);if(render)renderer.render(scene,camera);}
async function stage(kind,extra={}){await families.stage(kind,{x:0,z:0,h:0,sidewalk:false,seed:1431,...extra});for(let i=0;i<90;i++)frame(1/30,false);renderer.render(scene,camera);return inspect();}
function inspect(){return {info:families.info(),actors:families.actors().map(a=>({age:a.P.dna.age,male:a.P.dna.male,specMale:a.spec.male,minor:isMinor(a.P),height:a.P.height,x:a.M.S.pos.x,y:a.M.S.pos.y,z:a.M.S.pos.z,role:a.role})),credits,spent,deeds:deeds.length,calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries};}
window.preview={scene,camera,renderer,frame,stage,inspect,png:()=>renderer.domElement.toDataURL('image/png'),families:()=>families,
view(x,y,z,tx=0,ty=3,tz=0){camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);renderer.render(scene,camera);},
async cancelCheck(){let resolve;const promise=new Promise(r=>resolve=r),f=createFamilyLife({...options,mount:null,loadAssets:()=>promise});const task=f.stage('teens',{x:0,z:0});f.clear();resolve(peopleAssetsNow());const result=await task,ok=result==='cancelled'&&f.actors().length===0;f.dispose();return ok;},
async reload(){families.dispose();families=createFamilyLife(options);return families.info();},
replaceWorld(){W={...W,body:{key:'family-other'}};frame();},rebase(){F.epoch++;frame();},dispose(){families.dispose();},world:()=>W};
await stage('lineup');window.FAMILY_READY=true;
