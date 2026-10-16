// Real colony builders/materials, photographed at their registered surfaces.
import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {civicColonyFixture} from './procedural-civic-fixture.js';
import {createColonyArt} from '../src/civic/colony-art.js';
import {civicImage} from '../src/civic/materials.js';
import {shellMaterial,glassMaterial,colonyUniforms} from '../src/planet/colony/mats.js';
import {signMesh} from '../src/planet/colony/signs.js';
const phone=location.search.includes('phone'),ids=['damage','graffiti','graffiti-names','graffiti-revolt','graffiti-characters','graffiti-devotional'];
document.body.style='margin:0;background:#192025;color:white;font:16px sans-serif';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(phone?390:1280,phone?500:720);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color('#526174');scene.add(new T.HemisphereLight(0xc4d9fa,0x4b4231,2));
const sun=new T.DirectionalLight(0xffecce,3);sun.position.set(30,80,50);scene.add(sun);
const pm=new T.PMREMGenerator(renderer),env=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();scene.environment=env;
const camera=new T.PerspectiveCamera(50,(phone?390:1280)/(phone?500:720),.05,1000),X=civicColonyFixture(phone),group=new T.Group();scene.add(group);
X.K.build({shell:shellMaterial(colonyUniforms({uTime:{value:0}},X.S),{env}),glass:glassMaterial({env}),air:new T.MeshBasicMaterial({color:0x80ffbb})},group,true);
const signs=signMesh(X.sg);if(signs)group.add(signs);
const floor=new T.Mesh(new T.PlaneGeometry(500,500).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x6a6863,roughness:1}));floor.position.y=10;scene.add(floor);
const art=createColonyArt({parent:group,...X.civic,isPhone:phone,seed:421,env});
function render(){art.update(camera,1);renderer.render(scene,camera);}
function snapshot(label){const h=document.createElement('p');h.textContent=label;document.body.append(h);const img=document.createElement('img');img.src=renderer.domElement.toDataURL();img.style='display:block;max-width:100%;height:auto';document.body.append(img);}
function look(s,d=6){camera.position.set(s.x+s.nx*d,s.y+2.3,s.z+s.nz*d);camera.lookAt(s.x,s.y+1.3,s.z);render();}
// Render once before assets finish; atlas must invalidate when decoded images arrive.
const wall=X.civic.surfaces.find(s=>s.tags&&s.id.startsWith('airlock'));look(wall);
await Promise.all(ids.map(id=>civicImage(id,phone).promise));look(wall);snapshot('Procedural airlock side wall');
const start=art.where(),info=art.info();
const station=X.civic.surfaces.find(s=>s.id.startsWith('station'));look(station,10);snapshot('Transit station lower wall');
const deck=X.civic.decks.find(s=>s.id.startsWith('station'));camera.position.set(deck.x+7,deck.y+6,deck.z+8);camera.lookAt(deck.x,deck.y,deck.z);render();snapshot('Instanced tread-plate platform');
const plate=art.group.getObjectByName('civic-tread-decks'),shade=plate.material;
const gl=renderer.getContext(),pixels=()=>{const a=new Uint8Array(renderer.domElement.width*renderer.domElement.height*4);gl.readPixels(0,0,renderer.domElement.width,renderer.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
const lit=pixels();sun.position.set(-60,20,-30);render();const relit=pixels();let changed=0;for(let i=0;i<lit.length;i+=4)if(Math.abs(lit[i]-relit[i])>3)changed++;
camera.position.set(99999,99999,99999);render();const gone=art.info();look(wall);const returned=JSON.stringify(start)===JSON.stringify(art.where());
const geoErrors=[];scene.traverse(o=>{if(o.geometry)for(const n of ['position','normal','uv'])if(o.geometry.attributes[n]&&!Array.from(o.geometry.attributes[n].array).every(Number.isFinite))geoErrors.push(o.name+":"+n);});
const result={phone,info,gone,returned,lightChangedPixels:changed,geoErrors,glError:gl.getError(),plateMaps:!!(shade.map&&shade.bumpMap&&shade.roughnessMap),loaded:Object.fromEntries(ids.map(id=>[id,civicImage(id,phone).ready]))};
art.dispose();art.dispose();result.removed=!group.children.some(o=>o.name==='colony-civic-art');window.__review=result;window.__ready=true;
