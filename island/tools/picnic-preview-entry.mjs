// Bundle to island/dist/picnic-preview.js; serve the repository root for real body assets.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPicnicJam } from '../src/encounters/picnic-jam.js';
import { kitLight, kitTick } from '../src/crysis/held-items.js';
import { createPicnicAudio } from '../src/encounters/picnic-audio.js';
import { shotOnBeat } from '../src/encounters/picnic-plan.js';
import { playCue } from '../src/crysis/weapon-sound.js';
import { peopleAssetsNow } from '../src/people/body.js';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(1280,800);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
document.body.style.cssText='margin:0;background:#17231b';
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8c9b8b);scene.fog=new THREE.Fog(0x8c9b8b,16,65);
const pm=new THREE.PMREMGenerator(renderer),env=pm.fromScene(new RoomEnvironment(),.04);scene.environment=env.texture;pm.dispose();kitLight(env.texture,.75);
const sun=new THREE.DirectionalLight(0xffe2b0,2.6);sun.position.set(4,10,-3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-8;sun.shadow.camera.right=sun.shadow.camera.top=8;sun.shadow.normalBias=.025;
scene.add(sun,new THREE.HemisphereLight(0xbdcfd0,0x5f5032,1.1));
const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x566440,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=2;ground.receiveShadow=true;scene.add(ground);
// Neutral review clearing: the characters/props are the production encounter modules.
const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.27,13,9),new THREE.MeshStandardMaterial({color:0x514439}),40);
const crowns=new THREE.InstancedMesh(new THREE.SphereGeometry(2.4,10,8),new THREE.MeshStandardMaterial({color:0x344a30}),40);
const m=new THREE.Matrix4();for(let i=0;i<40;i++){const a=i*2.399,d=11+(i%6)*4,x=Math.cos(a)*d,z=Math.sin(a)*d;trunks.setMatrixAt(i,m.makeTranslation(x,8.5,z));crowns.setMatrixAt(i,m.makeTranslation(x,14,z));}trunks.castShadow=crowns.castShadow=true;scene.add(trunks,crowns);
const camera=new THREE.PerspectiveCamera(44,1.6,.05,150);camera.position.set(7,6,8);camera.lookAt(0,2.8,0);
let W={body:{key:'preview'},island:{heightAt:()=>2,paths:[]},player:{state:{yaw:0,flying:false}},sky:{state:{hours:15}},music:{performance:{bpm:96}},globe:{frame:{epoch:0}}};
const picnic=createPicnicJam({scene,world:()=>W,camera,profile:()=>({type:'EARTH'}),mount:document.body,random:()=>0,hint:console.log});
await picnic.summon({x:0,z:0});
let time=0;
function frame(dt=1/30,render=true){time+=dt;picnic.update(dt,time);kitTick(time);if(render)renderer.render(scene,camera);}
for(let i=0;i<90;i++)frame(1/30,false);renderer.render(scene,camera);
window.preview={picnic,scene,camera,renderer,frame,
 async checkCancellation(){
  let resolve;const wait=new Promise(r=>resolve=r),before=scene.children.length;
  const p=createPicnicJam({scene,world:()=>W,camera,profile:()=>({type:'EARTH'}),mount:document.body,loadAssets:()=>wait});
  const pending=p.summon({x:8,z:0});p.clear();resolve(peopleAssetsNow());const result=await pending;p.dispose();
  return !result&&scene.children.length===before;
 },
 async audioPreview(){
  // Offline export of the SAME synth/cues, aligned with a four-second capture starting at t=3.
  const ctx=new OfflineAudioContext(2,48000*4,48000),out=ctx.createGain();out.connect(ctx.destination);
  const previous=window._masterClip;window._masterClip=out;let t=0;
  Object.defineProperty(ctx,'currentTime',{configurable:true,get:()=>t});Object.defineProperty(ctx,'state',{configurable:true,get:()=> 'running'});
  const music=createPicnicAudio(),distance=Math.hypot(4.9,5.7),level=(1-distance/44)**2;
  try {for(let beat=10;beat<=22;beat++){t=beat*30/96-3;music.beat(beat,level,0,false);if(shotOnBeat(beat,2))playCue('scout',{distance,gain:.6});if(shotOnBeat(beat,3))playCue('pulse',{distance,gain:.6});}}
  finally {delete ctx.currentTime;delete ctx.state;window._masterClip=previous;}
  const b=await ctx.startRendering(),wav=new ArrayBuffer(44+b.length*4),v=new DataView(wav),str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
  str(0,'RIFF');v.setUint32(4,wav.byteLength-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,48000,true);v.setUint32(28,192000,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,wav.byteLength-44,true);
  for(let i=0;i<b.length;i++)for(let ch=0;ch<2;ch++)v.setInt16(44+(i*2+ch)*2,Math.max(-1,Math.min(1,b.getChannelData(ch)[i]))*32767,true);
  let s='';for(const n of new Uint8Array(wav))s+=String.fromCharCode(n);return btoa(s);
 },
 view(x,y,z,tx=0,ty=2.8,tz=0){camera.position.set(x,y,z);camera.lookAt(tx,ty,tz);renderer.render(scene,camera);},
 resize(w,h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);},
 world:()=>W,replaceWorld(){W={...W,body:{key:'preview2'}};},
 png:()=>renderer.domElement.toDataURL('image/png'),stats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...picnic.inspect()}),
};window.PICNIC_READY=true;
