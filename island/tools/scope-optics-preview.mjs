import * as THREE from 'three';
import { itemModel, triangles } from '../src/crysis/held-items.js';
import { createScopeOptics } from '../src/crysis/scope-optics.js';
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(900, 650); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
document.body.style.margin = 0; document.body.appendChild(renderer.domElement);
const world = new THREE.Scene(); world.background = new THREE.Color(0x556577);
world.add(new THREE.HemisphereLight(0xdcecff, 0x544634, 2));
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(2, 8, 3); world.add(sun);
const camera = new THREE.PerspectiveCamera(60, 900 / 650, 0.1, 1000); camera.position.set(0, 1.5, 0);
const front = new THREE.Group(); world.add(front);
for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(.65,.65,.15), new THREE.MeshStandardMaterial({color:(row+col)%2 ? 0xfdf5d0 : 0x233f54,roughness:.7}));
 mesh.position.set((col-2)*.7, 1.5+(row-2)*.7,-20);front.add(mesh);
}
const rear = new THREE.Mesh(new THREE.PlaneGeometry(18,18), new THREE.MeshBasicMaterial({color:0xff0022,side:THREE.DoubleSide})); rear.position.set(0,1.5,7);world.add(rear);
const vm = new THREE.Scene(); vm.add(new THREE.HemisphereLight(0xddeeff,0x594a30,2)); const key=sun.clone();vm.add(key);
const vc = new THREE.PerspectiveCamera(52,900/650,.01,5);
let model, optics;
function select(id, phone=false, aim=true) {
 optics?.dispose(); if(model)vm.remove(model);
 model=itemModel(id,{level:7,tier:0,lod:phone?'low':'high',optics:true});
 model.rotation.y=Math.PI/2;
 const h=model.userData.hold;
 model.position.set(0,-h.sight[1],-h.sight[2]+h.sight[0]);
 vm.add(model); optics=createScopeOptics({renderer,scene:world,camera,phone});
 return draw(aim);
}
let clock=0;
function draw(aim=true){
 clock+=1;
 const oldViewport=new THREE.Vector4(3,4,895,644);renderer.setViewport(oldViewport);renderer.setScissor(2,3,890,640);renderer.setScissorTest(true);
 optics.update({item:model,aiming:aim?1:0,active:true,time:clock});
 const viewport=new THREE.Vector4(),scissor=new THREE.Vector4();renderer.getViewport(viewport);renderer.getScissor(scissor);
 const restored=viewport.equals(oldViewport)&&renderer.getScissorTest()&&scissor.equals(new THREE.Vector4(2,3,890,640))&&renderer.getRenderTarget()===null&&renderer.toneMapping===THREE.ACESFilmicToneMapping&&renderer.autoClear===true;
 renderer.setViewport(0,0,900,650);renderer.setScissorTest(false);renderer.render(world,camera);renderer.autoClear=false;renderer.clearDepth();renderer.render(vm,vc);renderer.autoClear=true;
 const gl=renderer.getContext(), pixels=new Uint8Array(4);gl.readPixels(460,320,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 return {restored,glError:gl.getError(),pixels:[...pixels],triangles:triangles(model),...optics.diagnostics()};
}
window.opticReview={select,draw,behind(hex){rear.material.color.setHex(hex);return draw(true);},light(k){key.intensity=k;return draw(true);},reset(){optics.reset();return optics.diagnostics();},png(){return renderer.domElement.toDataURL('image/png');}};
window.OPTICS_READY=true;
