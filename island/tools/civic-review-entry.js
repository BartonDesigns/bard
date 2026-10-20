import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createServiceVehicle} from '../src/services/vehicle-model.js';
import {civicImage,createDiamondPlateMaterial,projectPlateUV,drawCivicDecal} from '../src/civic/materials.js';
import {signMaterial} from '../src/signage/materials.js';
const phone=location.search.includes('phone');
const artIds=['galvanized','enamel','damage','graffiti','graffiti-names','graffiti-revolt','graffiti-characters','graffiti-devotional'];
await Promise.all(artIds.map(id=>civicImage(id,phone).promise));
document.body.style='margin:0;background:#242c31;color:white;font:16px sans-serif';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(phone?390:1200,phone?470:780);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.outputColorSpace=T.SRGBColorSpace;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#89979e');scene.add(new T.HemisphereLight(0xe5f2ff,0x4a4338,2));
const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
const sun=new T.DirectionalLight(0xffedd5,3);sun.position.set(4,7,5);scene.add(sun);
const camera=new T.PerspectiveCamera(44,(phone?390:1200)/(phone?470:780),.05,100);camera.position.set(9,5,11);camera.lookAt(0,1.3,0);
const car=createServiceVehicle('ambulance');scene.add(car);
const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:0x737575,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
const plate=new T.Mesh(projectPlateUV(new T.BoxGeometry(1.8,1.3,.1)),createDiamondPlateMaterial({phone}));plate.position.set(-3,1.3,2);scene.add(plate);
// Exercise the exact instanced-sign shader on front and back, with real material maps.
const face=document.createElement('canvas');face.width=face.height=128;const f=face.getContext('2d');f.fillStyle='white';f.fillRect(0,0,128,128);f.fillStyle='black';f.font='bold 35px sans-serif';f.fillText('25',38,77);
const texture=new T.CanvasTexture(face);texture.colorSpace=T.SRGBColorSpace;
for(let i=0;i<2;i++){const g=new T.PlaneGeometry(1,1.4);g.setAttribute('aCell',new T.Float32BufferAttribute(Array.from({length:4},()=>[0,0,1,1]).flat(),4));g.setAttribute('aFx',new T.Float32BufferAttribute(Array.from({length:4},()=>[0,.3,.4,0]).flat(),4));const s=new T.Mesh(g,signMaterial('retro',2,texture,{phone}));s.position.set(-3+i*1.4,3,0);s.rotation.y=i?Math.PI:0;scene.add(s);}
const compiled=[],seen=new Set();scene.traverse(o=>{if(o.material&&!seen.has(o.material)){const m=o.material,old=m.onBeforeCompile;seen.add(m);m.onBeforeCompile=function(sh,r){old.call(this,sh,r);compiled.push({name:m.name,civic:sh.fragmentShader.includes('uCivic'),wear:sh.fragmentShader.includes('float cw='),plate:!!m.bumpMap});};}});
const chromeCanvas=document.createElement('canvas');chromeCanvas.width=chromeCanvas.height=256;drawCivicDecal(chromeCanvas.getContext('2d'),0,0,256,256,{id:'graffiti-names',tile:0,phone});const chromeTex=new T.CanvasTexture(chromeCanvas);chromeTex.colorSpace=T.SRGBColorSpace;const chromeGeo=new T.PlaneGeometry(1.6,1);chromeGeo.setAttribute('aCell',new T.Float32BufferAttribute([0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1],4));chromeGeo.setAttribute('aFx',new T.Float32BufferAttribute([3,.2,.15,1,3,.2,.15,1,3,.2,.15,1,3,.2,.15,1],4));const chrome=new T.Mesh(chromeGeo,signMaterial('paint',2,chromeTex,{phone}));chrome.position.set(-2,1,3);scene.add(chrome);
function render(){scene.updateMatrixWorld(true);renderer.render(scene,camera);return renderer.domElement.toDataURL();}
function pixels(){const gl=renderer.getContext(),a=new Uint8Array(renderer.domElement.width*renderer.domElement.height*4);gl.readPixels(0,0,renderer.domElement.width,renderer.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
render();await new Promise(r=>setTimeout(r,100));const a=pixels();sun.position.set(-6,2,3);render();const b=pixels();let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>3)changed++;sun.position.set(4,7,5);render();
const swatches=document.createElement('canvas');swatches.width=1200;swatches.height=520;swatches.style='width:100%;height:auto';document.body.append(swatches);const g=swatches.getContext('2d');g.fillStyle='#d5c9ae';g.fillRect(0,0,1200,520);
for(let i=0;i<4;i++){drawCivicDecal(g,i*300,20,290,220,{tile:i,phone,blend:i%2?'darken':'multiply'});g.fillStyle='#27343c';g.font='18px sans-serif';g.fillText(['Road grime / multiply','Rust / darken','Scrapes / multiply','Soot / darken'][i],i*300+8,260);}
for(let i=0;i<8;i++)drawCivicDecal(g,i*150,300,150,170,{id:'graffiti',tile:i,phone});
const before=[210,180,140];g.fillStyle='rgb('+before+')';g.fillRect(0,500,1200,20);drawCivicDecal(g,0,500,600,20,{tile:1,phone,blend:'multiply'});drawCivicDecal(g,600,500,600,20,{tile:2,phone,blend:'darken'});const strip=g.getImageData(0,500,1200,20).data;let brightened=0;for(let i=0;i<strip.length;i+=4)for(let j=0;j<3;j++)if(strip[i+j]>before[j]+1)brightened++;
const geoErrors=[];scene.traverse(o=>{if(o.geometry)for(const n of ['position','normal','uv'])if(o.geometry.attributes[n]&&!Array.from(o.geometry.attributes[n].array).every(Number.isFinite))geoErrors.push(n);});
for(const id of artIds.filter(id=>id.startsWith('graffiti-'))){const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=id==='graffiti-characters'||id==='graffiti-devotional'?330:360;sheet.style='width:100%;height:auto';document.body.append(sheet);const ctx=sheet.getContext('2d');ctx.fillStyle='#d2c9b9';ctx.fillRect(0,0,sheet.width,sheet.height);const chars=id==='graffiti-characters'||id==='graffiti-devotional',cols=4,n=chars?4:8,cw=300,ch=chars?300:170;for(let i=0;i<n;i++)drawCivicDecal(ctx,i%cols*cw,Math.floor(i/cols)*ch,cw,ch,{id,tile:i,phone});}
let surfaceHash=2166136261;for(const v of pixels())surfaceHash=Math.imul(surfaceHash^v,16777619)>>>0;
camera.position.set(-3,1.3,3.7);camera.lookAt(-3,1.3,2);render();const detail=document.createElement('img');detail.src=renderer.domElement.toDataURL();detail.style='width:100%;height:auto';document.body.append(detail);camera.position.set(9,5,11);camera.lookAt(0,1.3,0);render();
window.__review={compiled:compiled.filter(x=>x.civic||x.plate),surfaceHash,phone,glError:renderer.getContext().getError(),lightChangedPixels:changed,brightened,geoErrors,loaded:Object.fromEntries(artIds.map(id=>[id,civicImage(id,phone).ready])),draws:renderer.info.render.calls};window.__ready=true;
