import * as THREE from 'three';
import {buildingMaterial} from '../src/bay/city.js';
import {createHouses} from '../src/bay/houses.js';
import {createCommercial} from '../src/bay/commercial.js';
import {houseFloor,wallTop} from '../src/bay/houseplan.js';
import {detailClock,buildingBand} from '../src/world/lodfade.js';
const phone=innerWidth<600,renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb8d1e0);scene.add(new THREE.HemisphereLight(0xffffff,0x666050,2.3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(30,60,40);scene.add(sun);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,1000),bay={heightAt:(x,z)=>2+x*.015};
const house={x:-30,z:0,w:15,d:12,a:.18,wallH:5.75,roofH:1.6,kind:0,door:.5,hip:1,look:{wall:[.74,.67,.56],roof:[.29,.3,.31]}},shop={x:30,z:0,w:20,d:16,a:-.16,wallH:5.1,roofH:0,kind:6,look:{wall:[.65,.69,.73]}};house.grp=[house];shop.grp=[shop];shop.grp.biz=true;
const band=buildingBand(phone),mat=buildingMaterial({}, {value:0},{value:new THREE.Vector2(band[2],band[3])});
const geo=new THREE.BoxGeometry(1,1,1).translate(0,.5,0);for(const [key,size]of [['aKind',1],['aAge',1],['aNear',3],['aDetailBirth',1]])geo.setAttribute(key,new THREE.InstancedBufferAttribute(new Float32Array(2*size),size));
const coarse=new THREE.InstancedMesh(geo,mat,2);coarse.frustumCulled=false;scene.add(coarse);
const boxes=[house,shop],matrix=new THREE.Matrix4(),color=new THREE.Color();
for(let i=0;i<2;i++){const b=boxes[i],f=houseFloor(b.grp,bay.heightAt),y=bay.heightAt(b.x,b.z)-1.2,top=b===house?f+wallTop(b):bay.heightAt(b.x,b.z)+b.wallH;matrix.compose(new THREE.Vector3(b.x,y,b.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-b.a),new THREE.Vector3(b.w,top-y,b.d));coarse.setMatrixAt(i,matrix);coarse.setColorAt(i,color.setRGB(...b.look.wall,THREE.SRGBColorSpace));geo.attributes.aKind.setX(i,i?6:1.2);}
const city={houseLook:b=>b.look,setNearBand:(a,b)=>mat.userData.band=[a,b],procHomes:()=>[],procBiz:()=>[],setNear(grp,c){grp.near=c;const i=boxes.findIndex(b=>b.grp===grp);geo.attributes.aNear.setXYZ(i,c?.[0]||0,c?.[1]||0,c?(grp.detailRadius?-1-grp.detailRadius:1):0);geo.attributes.aDetailBirth.setX(i,grp.nearBorn||0);geo.attributes.aNear.needsUpdate=geo.attributes.aDetailBirth.needsUpdate=true;}};
const real={loaded:()=>true,near:(kind)=>kind==='boxes'?boxes:[]};
const houses=createHouses(scene,bay,real,city,{isPhone:phone}),commercial=createCommercial(scene,bay,real,city,{isPhone:phone});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,200),new THREE.MeshStandardMaterial({color:0x777b66}));ground.rotation.x=-Math.PI/2;ground.position.y=1.8;scene.add(ground);
function frame(){houses.update(camera,.016,0);commercial.update(camera,.3,13,0);}
function show(which=0,distance=20,settled=true){const b=boxes[which];camera.position.set(b.x+8,8,b.z+distance);camera.lookAt(b.x,4,b.z);for(let i=0;i<40;i++)frame();if(settled)detailClock.value=Math.max(detailClock.value,...boxes.map(b=>(b.grp.nearBorn||0)+1));renderer.render(scene,camera);return info();}
function info(){const anchors=[];for(const root of [houses.group,commercial.group])root.traverse(o=>{if(o.isMesh&&o.geometry.attributes.aLodAnchor) anchors.push(Array.from(o.geometry.attributes.aLodAnchor.array.slice(0,4)));});return {houseCount:houses.count(),shopCount:commercial.count(),anchors,proxy:Array.from(geo.attributes.aNear.array),births:Array.from(geo.attributes.aDetailBirth.array),shaders:renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).length};}
show(0);show(1);window.buildingReview={show,info,houses,commercial,camera,renderer,scene};window.WORKPLACE_READY=true;
