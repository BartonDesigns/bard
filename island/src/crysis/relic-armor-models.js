// Eight authored armor sculptures. Pickup = complete display form; worn = only the
// articulated bone-local relief over the existing skinned garment, never a rigid avatar.
// Three merged material batches, deterministic weathering, no texture downloads.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEGENDARY_ARMOR } from '../gameplay/legendary-items.js';

// Two tiny, shared procedural surface maps. Mesh ownership never includes these cached
// maps: disposing one inspected or worn copy cannot invalidate another copy's surface.
const surfaces=[];
function surfaceMap(kind){
 if(surfaces[kind])return surfaces[kind];
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const hash=Math.sin(x*127.1+y*311.7)*43758.5453,noise=hash-Math.floor(hash);
  const grain=kind===0?Math.sin(y*Math.PI/2)*.018+noise*.06:
   Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)*.065+noise*.025;
  const value=Math.round(255*Math.min(1,.90+grain));
  const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
 }
 const t=new THREE.DataTexture(data,size,size);t.name=kind===0?'relic-brushed-grain':'relic-woven-fiber';
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
 return surfaces[kind]=t;
}

export function createRelicArmor(id,{lod='high',worn=false}={}) {
 const def=LEGENDARY_ARMOR.find(x=>x.id===id);if(!def)return null;
 const hi=lod!=='low',N=hi?16:8,root=new THREE.Group(),batches=[[],[],[]];
 root.name=`relic-sculpture:${id}`;
 const C={steel:0x7c949e,iron:0x303138,bronze:0x92724a,gold:0xb8a16a,cloth:0x273442,leather:0x35302b,ash:0x484245,salt:0x8c9290};
 const add=(g,color,kind=0,x=0,y=0,z=0,rx=0,ry=0,rz=0,scale=null)=>{
  if(g.index){const raw=g;g=g.toNonIndexed();raw.dispose();}
  g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);if(scale)g.scale(...scale);g.translate(x,y,z);
  for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
  const p=g.attributes.position,n=g.attributes.normal,colors=new Float32Array(p.count*3),uv=new Float32Array(p.count*2),base=new THREE.Color(color);
  for(let i=0;i<p.count;i++){
   const px=p.getX(i),py=p.getY(i),pz=p.getZ(i);
   const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
   uv.set((ax>ay&&ax>az?[pz,py]:ay>az?[px,pz]:[px,py]).map(v=>v*12),i*2);
   // Spatial, not random-per-triangle: continuous discoloration across shared edges.
   const wear=.88+.07*Math.sin(px*91+py*43+pz*31)+.045*Math.sin(px*221-py*137);
   const edge=kind===0?Math.abs(n.getX(i))*.07:0;
   colors.set([base.r*wear+edge*.12,base.g*wear+edge*.11,base.b*wear+edge*.1],i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));batches[kind].push(g);
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 };
 const box=(w,h,d,x,y,z,c=C.iron,kind=0)=>add(new THREE.BoxGeometry(w,h,d),c,kind,x,y,z);
 const plate=(p,d,z,c=C.iron,kind=0,bend=0)=>{
  const g=new THREE.ExtrudeGeometry(new THREE.Shape(p.map(a=>new THREE.Vector2(...a))),{depth:d,bevelEnabled:true,bevelSize:.002,bevelThickness:.002,bevelSegments:1,steps:1});
  if(bend){const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setZ(i,a.getZ(i)-a.getX(i)**2*bend);g.computeVertexNormals();}
  add(g,c,kind,0,0,z-d/2);
 };
 const path=(points,r=.003,c=C.bronze,kind=0)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),points.length===2?1:hi?16:8,r,hi?6:4,false),c,kind);
 const ring=(r,t,x,y,z,c=C.gold,rx=0)=>add(new THREE.TorusGeometry(r,t,hi?6:4,N),c,0,x,y,z,rx);
 const gem=(r,x,y,z,c=def.color,scale=null)=>add(new THREE.OctahedronGeometry(r,0),c,2,x,y,z,0,0,0,scale);
 const rivet=(x,y,z)=>add(new THREE.SphereGeometry(.004,hi?8:4,4),C.bronze,0,x,y,z);
 const scalePlate=(x,y,z,w=.04,h=.05,c=C.steel)=>{
  plate([[x-w/2,y+h/2],[x-w*.46,y-h*.08],[x,y-h/2],[x+w*.46,y-h*.08],[x+w/2,y+h/2]],.009,z,c,0,.8);
 };
 const shell=(top,bottom,h,z=0,c=C.cloth,kind=1)=>add(new THREE.CylinderGeometry(top,bottom,h,N,hi?6:3,true),c,kind,0,0,z,0,0,0,[1,1,.63]);
 const belt=(y,r=.16)=>{
  add(new THREE.CylinderGeometry(r,r,.023,N,1,true),C.leather,1,0,y,0,0,0,0,[1,1,.68]);
  box(.032,.027,.012,.04,y,r*.68+.006,C.bronze);box(.019,.015,.015,.04,y,r*.68+.012,C.leather,1);
 };
 const chest=(c)=>{
  if(!worn){shell(.18,.145,.39,0,C.cloth);belt(-.13);}
  const z=worn?.012:.126;
  plate([[-.145,.15],[-.072,.18],[0,.135],[.072,.18],[.145,.15],[.13,-.13],[0,-.195],[-.13,-.13]],.022,z,c,0,1.6);
  return z;
 };
 switch(id){
 case 'lumencrest-circlet':{
  const z=worn?.012:.14;
  if(!worn){ring(.143,.009,0,0,0,C.steel,Math.PI/2);ring(.144,.003,0,-.017,0,C.gold,Math.PI/2);}
  for(let j=-3;j<=3;j++){
   const x=j*.031,v=.025+(3-Math.abs(j))*.009;
   plate([[x-.018,0],[x-.02,v],[x,v+.025],[x+.012,v],[x+.017,0]],.007,z-x*x*2,C.steel);
   path([[x,-.004,z+.007],[x+.004,v+.016,z+.012]],.002,C.gold);
  }
  ring(.027,.003,0,.035,z+.015);gem(.032,0,.045,z+.023,def.color,[.6,1.6,.5]);
  for(const s of [-1,1]){path([[s*.08,0,z],[s*.09,-.035,z+.007]],.002);gem(.011,s*.09,-.04,z+.01);}
  break;}
 case 'gallery-scale-mail':{
  const z=chest(C.steel);
  for(let row=0;row<(hi?7:5);row++)for(let col=0;col<6;col++){
   const x=(col-2.5)*.044+(row%2)*.008,v=.13-row*(hi?.043:.06);
   scalePlate(x,v,z+.018+row*.001,.046,.06,row%2?0x698793:0x9babb2);
  }
  path([[-.13,.15,z],[0,.115,z+.018],[.13,.15,z]],.005,C.gold);
  gem(.026,0,.12,z+.039,def.color,[.8,1.2,.5]);
  if(!worn)for(const s of [-1,1]){
   for(let n=0;n<3;n++)add(new THREE.SphereGeometry(.075-n*.009,N,6,0,Math.PI*2,0,Math.PI*.65),C.steel,0,s*(.18+n*.018),.13-n*.025,0,0,0,-s*.5,[1,.5,1]);
   gem(.036,s*.19,.19,.01,def.color,[.8,1.4,.65]);
  }break;}
 case 'cinder-core-cuirass':{
  const z=chest(C.iron);
  for(const s of [-1,1])for(let n=0;n<4;n++){
   const v=.13-n*.073;
   plate([[s*.025,v],[s*.105,v+.026],[s*.145,v],[s*.12,v-.052],[s*.025,v-.067]],.018,z+.018+n*.002,n%2?0x454047:0x302f34,0,1.3);
   path([[s*.025,v+.003,z+.033],[s*.10,v+.025,z+.02],[s*.14,v,z+.006]],.003,C.bronze);
   path([[s*.055,v-.01,z+.034],[s*.075,v-.022,z+.03],[s*.065,v-.042,z+.03]],.0017,def.color,2);
   if(hi)rivet(s*.115,v+.008,z+.02);
  }
  // Recessed furnace, with raised metal bars in front of the ember lens.
  plate([[-.023,.08],[0,.105],[.023,.08],[.025,-.05],[0,-.09],[-.025,-.05]],.015,z+.026,C.bronze);
  gem(.055,0,.005,z+.04,def.color,[.32,1.55,.25]);
  for(const x of [-.012,0,.012])path([[x,-.062,z+.06],[x,.076,z+.06]],.003,C.iron);
  if(!worn)for(const s of [-1,1])for(let n=0;n<3;n++){
   const x=s*(.17+n*.024),v=.15-n*.034;
   plate([[x-s*.055,v+.03],[x+s*.025,v+.017],[x+s*.05,v-.054],[x,v-.04],[x-s*.035,v-.02]],.035,.035,0x3d373b);
  }break;}
 case 'stormwarden-flightcoat':{
  const z=worn?.015:.125;
  if(!worn){
   shell(.18,.16,.36);belt(-.10);
   for(const s of [-1,1])plate([[s*.015,-.07],[s*.15,-.07],[s*.20,-.43],[s*.045,-.39]],.023,.065,C.cloth,1,1.2);
   for(const s of [-1,1])for(let n=0;n<3;n++)plate([[s*.135,.19],[s*(.21+n*.02),.19-n*.035],[s*(.25+n*.012),.11-n*.04],[s*.16,.10-n*.018]],.025,.025,C.iron);
  }
  for(const s of [-1,1]){
   plate([[s*.015,.17],[s*.11,.16],[s*.14,.11],[s*.08,-.07],[s*.015,-.13]],.012,z,C.iron,0,1);
   path([[s*.025,.15,z+.014],[s*.075,.07,z+.014],[s*.045,-.10,z+.014]],.0025,def.color,2);
   if(hi)for(let j=0;j<3;j++)path([[s*.08,.04-j*.035,z+.017],[s*.12,.055-j*.035,z+.01]],.002,C.gold);
  }
  ring(.025,.003,0,.05,z+.022);gem(.014,0,.05,z+.025);break;}
 case 'ashwalker-greaves':{
  for(const x of worn?[0]:[-.092,.092]){
   const z=worn?.01:.055;
   if(!worn){add(new THREE.CylinderGeometry(.066,.045,.34,N,4,true),C.leather,1,x,0,0);for(const v of [-.11,.10])add(new THREE.CylinderGeometry(.067,.067,.018,N,1,true),C.bronze,0,x,v,0);}
   for(let n=0;n<5;n++){
    const v=.13-n*.06,w=.057-n*.004;
    plate([[x-w,v+.03],[x,v+.048],[x+w,v+.03],[x+w*.8,v-.022],[x,v-.05],[x-w*.8,v-.022]],.018,z+n*.002,n%2?0x444045:C.iron);
    path([[x-w,v+.03,z+.012],[x,v+.048,z+.014],[x+w,v+.03,z+.012]],.002,C.bronze);
    path([[x+.005,v+.02,z+.014],[x-.008,v,z+.014],[x+.007,v-.022,z+.014]],.002,def.color,2);
   }
  }break;}
 case 'stormwarden-gauntlets':{
  for(const x of worn?[0]:[-.085,.085]){
   const z=worn?.01:.034;
   if(!worn){box(.095,.12,.06,x,0,0,C.leather,1);add(new THREE.CylinderGeometry(.057,.05,.055,N,1,true),C.cloth,1,x,.083,0);}
   for(let n=0;n<3;n++)plate([[x-.047,.065-n*.032],[x+.047,.065-n*.032],[x+.04,.035-n*.032],[x,.024-n*.032],[x-.04,.035-n*.032]],.012,z+n*.003,C.iron);
   for(let j=0;j<4;j++){
    const a=x+(j-1.5)*.024;
    box(.019,.024,.012,a,-.056,z,C.steel);gem(.006,a,-.056,z+.009);
    if(!worn)for(let n=0;n<3;n++)box(.018,.022,.021,a,-.081-n*.023,.017,C.iron);
   }
   path([[x-.034,.053,z+.014],[x,.036,z+.014],[x+.034,.053,z+.014]],.0025,def.color,2);
  }break;}
 case 'fogmothers-veil':{
  const z=worn?.008:.125;
  if(!worn){
   add(new THREE.SphereGeometry(.16,N,hi?12:6,Math.PI*.82,Math.PI*1.36,0,Math.PI*.65),C.ash,1,0,.02,0,0,0,0,[1,1.15,1]);
   for(const s of [-1,1]){
    const p=[[s*.095,.09],[s*.15,.03],[s*.19,-.21],[s*.15,-.18],[s*.13,-.23],[s*.09,-.19],[s*.08,-.09]];
    plate(p,.007,.09,C.ash,1,.7);
    for(let j=0;j<3;j++)path([[s*(.105+j*.012),.015,.11],[s*(.12+j*.016),-.17,.10]],.002,C.salt,1);
   }
  }
  for(const s of [-1,1]){
   path([[s*.01,.10,z],[s*.075,.065,z+.015],[s*.11,-.075,z]],.0025,0x7e3534,1);
   for(let j=0;j<3;j++){const x=s*(.07+j*.017),v=-.03-j*.026;path([[x,v,z],[x,v-.026,z]],.0015,C.salt);gem(.009,x,v-.032,z+.006);}
  }break;}
 case 'drowned-procession-boots':{
  for(const x of worn?[0]:[-.095,.095]){
   const z=worn?.012:.065;
   if(!worn){
    add(new THREE.CylinderGeometry(.057,.049,.22,N,4,true),C.leather,1,x,.025,0);
    add(new THREE.SphereGeometry(1,N,hi?8:5),C.leather,1,x,-.09,.04,0,0,0,[.06,.055,.105]);
    box(.12,.019,.20,x,-.13,.035,C.iron,1);
    if(hi)for(let n=0;n<5;n++)box(.124,.008,.008,x,-.142,-.04+n*.035,C.leather,1);
   }
   for(let n=0;n<6;n++){
    const v=.11-n*.029;
    for(const s of [-1,1]){rivet(x+s*.028,v,z);path([[x+s*.026,v,z+.003],[x-s*.026,v-.025,z+.006]],.0025,0x7e3534,1);}
   }
   ring(.018,.003,x,.09,z+.01,C.salt);gem(.008,x,.09,z+.014);
   if(hi)for(let n=0;n<5;n++)box(.006,.004,.002,x-.03+n*.015,-.105,z+.012,C.salt,1);
  }break;}
 }
 const specs=[{roughness:.48,metalness:.76},{roughness:.92,metalness:0},{roughness:.25,metalness:.2,emissive:def.color,emissiveIntensity:.28}];
 for(let i=0;i<batches.length;i++)if(batches[i].length){
  const geometry=mergeGeometries(batches[i]);for(const g of batches[i])g.dispose();
  const texture=i<2?surfaceMap(i):null;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,...specs[i],map:texture,roughnessMap:texture,bumpMap:texture,bumpScale:i===0?.0006:.001,side:THREE.DoubleSide}));
  mesh.name=['relief-metal','cloth-leather','set-crystals'][i];root.add(mesh);
 }
 return root;
}

export function disposeRelicArmor(root){
 if(!root || root.userData.released)return;
 root.userData.released=true;root.removeFromParent();
 root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
}
