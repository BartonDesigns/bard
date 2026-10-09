import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { itemModel, ITEM_ICONS, HOLDS, triangles, kitTick, kitMaterial } from '../src/crysis/held-items.js';
import { ARMS_CATALOG } from '../src/gameplay/arms.js';

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
document.body.append(renderer.domElement);
const scene=new THREE.Scene();
const pm=new THREE.PMREMGenerator(renderer), env=pm.fromScene(new RoomEnvironment(),.04);
scene.environment=env.texture;pm.dispose();
const key=new THREE.DirectionalLight(0xfff2e0,1.6);key.position.set(1,2,2);
const rim=new THREE.DirectionalLight(0x9fd8ff,.8);rim.position.set(-2,1,-1);
scene.add(key,rim,new THREE.AmbientLight(0xffffff,.25));
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.001,100);
const ids=Object.keys(ITEM_ICONS);let current=null;
function stats(id,lod='high'){
 const m=itemModel(id,{lod,plain:true}),box=new THREE.Box3().setFromObject(m),size=box.getSize(new THREE.Vector3());
 let meshes=0,verts=0;m.traverse(o=>{if(o.isMesh){meshes++;verts+=o.geometry.attributes.position.count;}});
 return {id,name:ARMS_CATALOG[id].name,triangles:triangles(m),meshes,vertices:verts,dimensionsMetres:size.toArray()};
}
function render({id=ids[0],view='three-quarter',tier=0,level=1,lod='high',width=1200,height=800,background=null,wireframe=false,turn=null}={}){
 if(current)scene.remove(current);
 const model=current=itemModel(id,{tier,level,lod,plain:true});scene.add(model);
 model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
 const directions={side:[0,0,1],'three-quarter':[.58,.34,1],reverse:[-.65,.3,-1],top:[0,1,.001]};
 const dir=new THREE.Vector3(...(directions[view]||directions['three-quarter'])).normalize();
 if(turn!==null)dir.set(Math.sin(turn),.25,Math.cos(turn)).normalize();
 camera.up.set(0,1,0); if(view==='top')camera.up.set(0,0,-1);
 camera.position.copy(center).addScaledVector(dir,5);camera.lookAt(center);camera.updateMatrixWorld(true);
 const pts=[];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])pts.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
 const w=Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)),h=Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y));
 const aspect=width/height,span=Math.max(h,w/aspect)*1.2;
 camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();
 renderer.setSize(width,height,false); renderer.setClearColor(background===null?0:background,background===null?0:1);
 model.traverse(o=>{if(o.isMesh)o.material.wireframe=wireframe;});
 kitTick(0);renderer.render(scene,camera);
 return {png:renderer.domElement.toDataURL('image/png'),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
}
function validate(){
 const check=(ok,message)=>{if(!ok)throw new Error(message);},checks=[];
 for(const id of Object.keys(ARMS_CATALOG)){
  check(!!HOLDS[id]&&!!ITEM_ICONS[id],id+' has an explicit grip and icon');
  const hi=itemModel(id,{plain:true}),lo=itemModel(id,{lod:'low',plain:true});
  check(!!hi&&!!lo,id+' has both detail levels');
  check(triangles(lo)<=triangles(hi),id+' low detail budget');
  for(const m of [hi,lo])m.traverse(o=>{if(o.isMesh)for(const a of Object.values(o.geometry.attributes))check(a.array.every(Number.isFinite),id+' finite geometry');});
  for(const h of [HOLDS[id].R,HOLDS[id].L].filter(Boolean))check(h.m.elements.every(Number.isFinite)&&Math.abs(h.m.determinant())>.9,id+' grip frame');
 }
 checks.push('All 20 catalog items have finite high/low geometry, explicit grips and icons');
 const net=itemModel('hunting-net'),ray=new THREE.Raycaster();let hits=0,total=0;net.updateMatrixWorld(true);
 for(let x=-.1;x<=.1;x+=.01)for(let z=-.1;z<=.1;z+=.01){ray.set(new THREE.Vector3(x,1,z),new THREE.Vector3(0,-1,0));total++;if(ray.intersectObject(net,true).length)hits++;}
 check(hits/total<.6&&hits>0,'Net has real openings');checks.push('Net leaves '+Math.round(100*(1-hits/total))+'% of sampled bag area open');
 // Read the production shader's decoded tile and wear at oblique angles.
 const material=kitMaterial(true).clone(),compile=kitMaterial(true).onBeforeCompile;
 material.onBeforeCompile=sh=>{compile(sh);sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>','gl_FragColor = vec4(kTile / 15.0, kWear, 0.0, 1.0);');};
 material.customProgramCacheKey=()=> 'kit-surface-probe';
 const geo=new THREE.BoxGeometry(1,1,1),n=geo.attributes.position.count;
 geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(n*3).fill(1),3));
 const surf=new Float32Array(n*4);geo.setAttribute('surf',new THREE.BufferAttribute(surf,4));
 const mesh=new THREE.Mesh(geo,material),probe=new THREE.Scene(),cam=new THREE.PerspectiveCamera(45,1,.01,20);probe.add(mesh);cam.position.z=3;
 const target=new THREE.WebGLRenderTarget(96,96),pixels=new Uint8Array(96*96*4),prior=renderer.getRenderTarget();
 renderer.setRenderTarget(target);renderer.setClearColor(0,0);
 try{for(let tile=0;tile<16;tile++)for(const wear of [0,.98])for(const angle of [.13,.61,1.17]){
  for(let v=0;v<n;v++)surf.set([.7,0,tile+wear/2,0],v*4);geo.attributes.surf.needsUpdate=true;
  mesh.rotation.set(angle*.7,angle,angle*.23);renderer.render(probe,cam);renderer.readRenderTargetPixels(target,0,0,96,96,pixels);let samples=0;
  for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]===255){samples++;check(Math.abs(pixels[p]-tile*17)<=1&&Math.abs(pixels[p+1]-wear*255)<=1,'Surface tile '+tile+' wear '+wear+' remains stable');}
  check(samples>100,'Surface probe rendered');
 }}finally{renderer.setRenderTarget(prior);target.dispose();geo.dispose();material.dispose();}
 checks.push('All 16 surface tiles and both wear endpoints remain stable across three oblique angles');
 return checks;
}
window.review={render,validate,ids,stats,catalog:Object.values(ARMS_CATALOG).map(i=>({id:i.id,name:i.name,modeled:ids.includes(i.id)})),canvas:renderer.domElement};
window.REVIEW_READY=true;
