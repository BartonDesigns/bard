import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { itemModel, ITEM_ICONS, triangles, kitTick } from '../src/crysis/held-items.js';
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
window.review={render,ids,stats,catalog:Object.values(ARMS_CATALOG).map(i=>({id:i.id,name:i.name,modeled:ids.includes(i.id)})),canvas:renderer.domElement};
window.REVIEW_READY=true;
