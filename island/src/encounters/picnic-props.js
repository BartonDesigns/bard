import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Owned geometry/materials only. No game-model cache is disposed by this scene.
export function disposePicnicProps(group) {
 const geometries = new Set(), materials = new Set(), textures = new Set();
 group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [o.material].flat().filter(Boolean)) { materials.add(m); if (m.map) textures.add(m.map); } });
 geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.removeFromParent();
}
const mat = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
function add(g, geo, m, x=0, y=0, z=0) {const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
function cord(g, points, radius, material) { return add(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),24,radius,6,false),material); }
function batch(g) {
 // Props never articulate. Keep one draw per material instead of one per cup or fret.
 g.updateMatrixWorld(true);const buckets=new Map(),old=new Set();
 g.traverse(o=>{if(!o.isMesh)return;const a=buckets.get(o.material)||[];a.push((o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld));buckets.set(o.material,a);old.add(o.geometry);});
 g.clear();for(const [m,geos] of buckets){add(g,mergeGeometries(geos,false),m);geos.forEach(v=>v.dispose());}old.forEach(v=>v.dispose());return g;
}
function rugTexture() {
 const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
 x.fillStyle='#843e30';x.fillRect(0,0,512,512);
 for(let i=0;i<512;i+=3){x.fillStyle=i%2?'#934c36':'#78362e';x.fillRect(i,0,1,512);}
 for(const [inset,col] of [[12,'#dcba77'],[26,'#243e40'],[38,'#c69858'],[48,'#562b26']]) {x.strokeStyle=col;x.lineWidth=7;x.strokeRect(inset,inset,512-2*inset,512-2*inset);}
 for(let j=94;j<450;j+=80)for(let i=94;i<450;i+=80){x.save();x.translate(i,j);x.rotate(Math.PI/4);x.fillStyle='#c89c62';x.fillRect(-17,-17,34,34);x.fillStyle='#364848';x.fillRect(-8,-8,16,16);x.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
export function picnicProps(seats) {
 const g=new THREE.Group();g.name='Off-Duty Orchestra picnic';
 const rug=mat(0xffffff,.98);rug.map=rugTexture();
 add(g,new THREE.BoxGeometry(3.1,.035,2.8),rug,0,.025,0);
 const seam=mat(0xd4b783),wood=mat(0x765337),dark=mat(0x292f29),ceramic=mat(0xe2d9bb,.36),glass=mat(0x326355,.24,.2);
 const cushions=[0x576758,0x7f5c45,0x596b79,0x7f765c].map(c=>mat(c));
 for(let i=0;i<seats.length;i++) {
  const s=seats[i],stool=new THREE.Group();stool.position.set(s.x,0,s.z);stool.rotation.y=s.yaw;g.add(stool);
  const fabric=cushions[i%cushions.length];
  add(stool,new THREE.CylinderGeometry(.26,.27,.075,24),fabric,0,.34,0);
  add(stool,new THREE.TorusGeometry(.253,.004,5,30),seam,0,.378,0).rotation.x=Math.PI/2;
  for(const a of [-1,1])for(const b of [-1,1])add(stool,new THREE.CylinderGeometry(.018,.022,.3,8),wood,a*.16,.15,b*.16);
 }
 // Low serving board, bread, fruit, bowls, cups, thermos and a folded cloth.
 add(g,new THREE.BoxGeometry(1.1,.045,.58),wood,0,.075,0);
 const bread=mat(0xc59a5d),fruit=mat(0x80352c);
 for(let i=0;i<4;i++){const m=add(g,new THREE.SphereGeometry(.09,14,8),bread,-.28+i*.12,.14,-.08);m.scale.set(1,.47,.68);}
 for(let i=0;i<7;i++)add(g,new THREE.SphereGeometry(.034,10,8),fruit,.24+(i%3)*.06,.12+Math.floor(i/3)*.026,.1+(i%2)*.06);
 for(const [x,z] of [[-.67,.28],[.68,.22],[.1,-.5],[-.55,-.48],[-1.1,.55],[.3,.7],[.55,-.8],[-.3,-.9]].slice(0,seats.length)){
  add(g,new THREE.CylinderGeometry(.058,.043,.09,18,1,true),ceramic,x,.12,z);
  add(g,new THREE.CircleGeometry(.045,18),mat(0x502f14,.2),x,.158,z).rotation.x=-Math.PI/2;
 }
 add(g,new THREE.CylinderGeometry(.063,.065,.24,20),glass,.75,.14,-.38);
 add(g,new THREE.CylinderGeometry(.045,.045,.045,16),dark,.75,.28,-.38);
 add(g,new THREE.BoxGeometry(.32,.045,.25),mat(0xc2c7ad),-.9,.07,-.4);
 // Open canvas hamper with handles; all food is decorative, no gameplay currency.
 add(g,new THREE.BoxGeometry(.44,.29,.28),mat(0x826b47),1.03,.17,.55);
 cord(g,[[.91,.29,.55],[.91,.49,.55],[1.14,.49,.55],[1.14,.29,.55]],.014,dark);
 return batch(g);
}
export function folkInstrument(triangle=false) {
 const g=new THREE.Group();g.name=triangle?'triangular folk lute':'round folk lute';
 const wood=mat(triangle?0xb5773e:0x9f6031,.45),edge=mat(0x4b2d19,.55),inlay=mat(0xd3b375,.42),metal=mat(0xbcb5a0,.3,.6);
 const shape=new THREE.Shape();
 if(triangle){shape.moveTo(-.2,-.15);shape.lineTo(.2,-.15);shape.lineTo(.04,.18);shape.quadraticCurveTo(0,.21,-.04,.18);shape.closePath();}
 else {shape.moveTo(0,.2);shape.bezierCurveTo(.09,.19,.2,.04,.16,-.1);shape.bezierCurveTo(.13,-.22,-.13,-.22,-.16,-.1);shape.bezierCurveTo(-.2,.04,-.09,.19,0,.2);}
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelThickness:.006,bevelSize:.005,bevelSegments:2,steps:1,curveSegments:20});geo.translate(0,0,-.035);add(g,geo,wood);
 add(g,new THREE.CircleGeometry(.042,32),edge,0,.02,.038);
 add(g,new THREE.TorusGeometry(.049,.003,6,36),inlay,0,.02,.039);
 add(g,new THREE.BoxGeometry(.042,.39,.03),edge,0,.36,.002);
 add(g,new THREE.BoxGeometry(.07,.12,.04),wood,0,.59,0);
 for(let i=0;i<9;i++)add(g,new THREE.BoxGeometry(.043,.0018,.002),metal,0,.2+i*.033,.02);
 add(g,new THREE.BoxGeometry(.105,.014,.02),edge,0,-.085,.04);
 for(let i=0;i<3;i++){const x=(i-1)*.011;cord(g,[[x,-.085,.052],[x,.17,.042],[x,.62,.028]],.0006,metal);add(g,new THREE.SphereGeometry(.009,10,6),inlay,(i%2?1:-1)*.047,.56+i*.035,0);}
 return batch(g);
}
