// Shared service fleet. Detailed local geometry near the player; a cheap silhouette at
// distance. Geometry/materials live for the scene lifetime and are shared across units.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createDiamondPlateMaterial, projectPlateUV, applyCivicWear } from '../civic/materials.js';
import { withCarSky } from '../bay/cars.js';

const cache = new Map();
const SPEC = {
 ambulance: { w: 2.1, rear: -3.1, front: 2.65, cabBack: .78, axle: [1.75, -2.0], r: .43, roof: 2.78, paint: 0xf1f1e9, stripe: 0xc52329, label: 'PARAMEDIC', sub: 'EMERGENCY MEDICAL SERVICES', unit: 'EMS  911' },
 engine: { w: 2.5, rear: -4.7, front: 4.35, cabBack: 1.4, axle: [3.15, -2.6, -3.7], r: .51, roof: 2.9, paint: 0xa81920, stripe: 0xebcf72, label: 'FIRE RESCUE', sub: 'FIRE DEPARTMENT', unit: 'ENGINE  04' },
 utility: { w: 2.35, rear: -4.0, front: 3.55, cabBack: 1.65, axle: [2.6, -.5, -2.7], r: .49, roof: 2.5, paint: 0xe6a72b, stripe: 0xf4da78, label: 'PUBLIC WORKS', sub: 'STREET & BUILDING SERVICES', unit: 'SERVICE  27' },
 van: { w: 2.0, rear: -2.6, front: 2.6, cabBack: .5, axle: [1.65, -1.65], r: .41, roof: 2.5, paint: 0xe8ede9, stripe: 0x327385, label: 'GLASS SERVICE', sub: 'REPAIR & RESTORATION', unit: 'SERVICE  12' },
};
function materials(s) {
 const standard = (color, roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
 const out = {
  paint: new THREE.MeshPhysicalMaterial({ color: s.paint, roughness: .29, metalness: .16, clearcoat: .7, clearcoatRoughness: .25 }),
  stripe: standard(s.stripe, .38, .18), black: standard(0x14191d, .72), tyre: standard(0x202124, .89),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x547581, roughness: .13, metalness: .12, clearcoat: 1, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }),
  metal: standard(0xabb4b9, .27, .86), plate: createDiamondPlateMaterial(),
  rubber: standard(0x343a3c, .85), seat: standard(0x3b4246, .95),
  whiteLamp: new THREE.MeshStandardMaterial({ color: 0xf1f3e5, roughness: .18, emissive: 0xe9f2ff, emissiveIntensity: .45 }),
  redLamp: new THREE.MeshStandardMaterial({ color: 0xb51a16, roughness: .22, emissive: 0xd81709, emissiveIntensity: .3 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xf6a31c, roughness: .2, emissive: 0xff8b00, emissiveIntensity: .45 }),
 };
 // Match the existing car fleet's live sky/cloud reflection uniforms, including
 // night and weather changes, even when the world Scene has no environment map.
 for(const key of ['paint','glass','metal','plate']) {
  out[key].onBeforeCompile=withCarSky;out[key].customProgramCacheKey=()=> 'service-live-sky-1';
 }
 applyCivicWear(out.paint,{amount:.22,tile:0});applyCivicWear(out.metal,{amount:.16,tile:2,blend:'darken'});
 return out;
}
function labelMap(s, kind) {
 if (typeof document === 'undefined') return null;
 const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
 const x = c.getContext('2d');
 x.clearRect(0, 0, 1024, 256); x.fillStyle = kind === 'engine' ? '#fff4ca' : '#153e59';
 x.textAlign = 'center'; x.font = 'bold 86px sans-serif'; x.fillText(s.label, 512, 95);
 x.font = 'bold 27px sans-serif'; x.fillText(s.sub, 512, 150);
 x.font = 'bold 42px sans-serif'; x.fillText(s.unit, 512, 218);
 const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
 return new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: .6, polygonOffset: true, polygonOffsetFactor: -1 });
}
function template(kind, detailed) {
 const key = kind + (detailed ? ':near' : ':far');
 if (cache.has(key)) return cache.get(key);
 const s = SPEC[kind] || SPEC.ambulance, m = materials(s), parts = new Map(), wheels = [];
 if (!detailed) { m.glass.dispose(); m.glass = new THREE.MeshStandardMaterial({ color: 0x344d59, roughness: .25, metalness: .25, side: THREE.DoubleSide }); }
 const add = (key, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
  if(key==='plate')projectPlateUV(g);
  if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
  if (!parts.has(key)) parts.set(key, []); parts.get(key).push(g);
 };
 const box = (key, w, h, d, x, y, z, radius = .035) => add(key, detailed && radius ? new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w / 4, h / 4, d / 4)) : new THREE.BoxGeometry(w, h, d), x, y, z);
 const rod = (key, a, b, radius = .02) => {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), v = end.clone().sub(start);
  const g = new THREE.CylinderGeometry(radius, radius, v.length(), detailed ? 10 : 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
  add(key, g, ...start.add(end).multiplyScalar(.5).toArray());
 };
 const quad = (key, points) => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1], 2)); g.setIndex([0,1,2,0,2,3]); g.computeVertexNormals(); add(key, g);
 };
 const hw = s.w / 2, nose = s.front, back = s.cabBack, frontAxle = s.axle[0];
 // Lower cab profile has a genuine wheel opening, a shaped hood and a sloping windscreen.
 const hoodY = kind === 'engine' ? 1.65 : 1.38, glassTop = (kind === 'ambulance' ? 2.33 : kind === 'utility' ? 2.32 : s.roof) - .13, screenZ = kind === 'engine' ? nose - .10 : nose - .78;
 const shape = new THREE.Shape();
 shape.moveTo(back, .62); shape.lineTo(frontAxle - s.r - .13, .62);
 for (let i = 0; i <= 16; i++) { const a = Math.PI - i / 16 * Math.PI; shape.lineTo(frontAxle + Math.cos(a) * (s.r + .13), s.r + Math.sin(a) * (s.r + .13)); }
 shape.lineTo(nose, .62); shape.lineTo(nose, hoodY - .12); shape.lineTo(screenZ + .32, hoodY);
 shape.lineTo(screenZ - .22, glassTop); shape.lineTo(back, glassTop + .03); shape.closePath();
 const cab = new THREE.ExtrudeGeometry(shape, { depth: s.w - .12, bevelEnabled: detailed, bevelThickness: .035, bevelSize: .035, bevelSegments: 2, steps: 1, curveSegments: 12 });
 cab.rotateY(-Math.PI / 2); cab.translate((s.w - .12) / 2, 0, 0);
 // Remove the solid upper cab, replace it with pillars and visible cabin glazing.
 // The shaped extrusion is only the lower body: clip points above the belt line.
 const cp = cab.attributes.position;
 for (let i = 0; i < cp.count; i++) if (cp.getY(i) > hoodY) cp.setY(i, hoodY + Math.min(.035, cp.getY(i) - hoodY));
 cab.computeVertexNormals(); add('paint', cab);
 box('paint', s.w - .15, .12, screenZ - back + .12, 0, glassTop + .045, (screenZ + back) / 2 - .1, .045);
 box('paint', s.w - .16, glassTop - hoodY, .10, 0, (glassTop + hoodY) / 2, back);
 box('black', s.w - .10, .18, nose - s.rear, 0, .48, (nose + s.rear) / 2);
 box('metal', s.w + .06, .23, .25, 0, .62, nose + .05, .055);
 if (kind === 'utility') {
  box('plate', s.w, .18, back - s.rear, 0, .91, (back + s.rear) / 2);
  for (const side of [-1, 1]) {
   box('metal', .09, .46, back - s.rear, side * (hw - .04), 1.19, (back + s.rear) / 2);
   if (detailed) for (let z = s.rear + .2; z < back; z += 1.2) box('black', .13, .5, .08, side * hw, 1.18, z);
  }
  box('metal', s.w, .55, .1, 0, 1.22, s.rear);
  box('black', s.w - .15, .9, .11, 0, 1.4, back - .08);
  if (detailed) {
   for (let i = 0; i < 5; i++) box('rubber', .18, .14, 3.8, -.55 + i * .24, 1.08, -.9);
   box('paint', .8, .55, .65, .58, 1.3, -2.9);
  }
 } else {
  const top = kind === 'engine' ? 2.57 : s.roof - .06;
  box('paint', s.w, top - 1.04, back - s.rear, 0, (top + 1.04) / 2, (back + s.rear) / 2, .075);
  // Skirts stop at the wheel openings, leaving dark wells behind the tyres.
  const spans = [s.rear, ...s.axle.slice(1).flatMap(z => [z - s.r - .14, z + s.r + .14]).sort((a,b)=>a-b), back];
  for (let i = 0; i + 1 < spans.length; i += 2) if (spans[i+1] > spans[i]) box('paint', s.w, .47, spans[i+1] - spans[i], 0, .82, (spans[i]+spans[i+1])/2);
  for (const side of [-1, 1]) box('stripe', .014, kind === 'engine' ? .12 : .22, back - s.rear - .1, side * (hw + .006), 1.36, (back + s.rear) / 2, 0);
 }
 // Glazing is made of separate panes, with pillars, seals, a dash and seats behind it.
 quad('glass', [[-hw+.1,hoodY+.05,screenZ+.25],[hw-.1,hoodY+.05,screenZ+.25],[hw-.14,glassTop,screenZ-.22],[-hw+.14,glassTop,screenZ-.22]]);
 for (const side of [-1, 1]) {
  const x = side * (hw - .07);
  quad('glass', [[x,hoodY+.06,back+.1],[x,hoodY+.06,screenZ+.22],[x,glassTop-.04,screenZ-.22],[x,glassTop-.04,back+.1]]);
  rod('paint', [x,hoodY,screenZ+.3],[x,glassTop+.04,screenZ-.22],.055);
  rod('black', [x,hoodY+.04,back+.07],[x,glassTop,back+.07],.03);
  box('stripe', .015,.10,screenZ-back+.2,side*hw,1.04,(back+screenZ)/2,0);
  if (detailed) {
   box('black', .017,.65,.016,side*(hw+.008),1.0,back+.13,0);
   box('metal', .045,.045,.22,side*(hw+.036),1.29,back+.28,.012);
   rod('black',[x,hoodY+.12,screenZ],[side*(hw+.25),hoodY+.2,screenZ+.06],.022);
   box('black',.13,.32,.19,side*(hw+.27),hoodY+.26,screenZ+.08,.035);
   box('metal',.014,.25,.15,side*(hw+.34),hoodY+.27,screenZ+.08,.012);
   const stepEnd=frontAxle-s.r-.12;
   box('plate',.2,.11,Math.max(.25,stepEnd-back),side*(hw+.03),.51,(back+stepEnd)/2,.02);
   box('seat',.52,.12,.52,side*.5,1.17,back+.5,.06);
   box('seat',.52,.62,.12,side*.5,1.52,back+.22,.06);
  }
 }
 box('black',s.w-.25,.20,.32,0,hoodY+.01,screenZ-.06,.05);
 if (detailed) {
  for (const side of [-1,1]) {
   box('black',.49,.28,.04,side*(hw-.34),1.12,nose+.015,.025);
   for (let j=0;j<2;j++) box('whiteLamp',.18,.15,.055,side*(hw-.34)+j*.21-.105,1.13,nose+.045,.026);
   box('amber',.12,.11,.055,side*(hw-.11),.94,nose+.04,.018);
   box('redLamp',.18,.36,.035,side*(hw-.16),1.12,s.rear-.045,.025);
   box('whiteLamp',.16,.09,.037,side*(hw-.16),.98,s.rear-.05,.012);
   for (let z=s.rear+.25;z<back;z+=1.15) box('amber',.024,.075,.13,side*(hw+.015),.79,z,.01);
   rod('black',[side*.1,hoodY+.09,screenZ+.25],[side*.7,hoodY+.24,screenZ+.12],.015);
  }
  box('black',s.w*.48,.36,.04,0,1.03,nose+.025,.02);
  for (let y=.9;y<1.2;y+=.065) box('metal',s.w*.44,.021,.045,0,y,nose+.05,.008);
  box('metal',.36,.11,.045,0,.66,nose+.19,.012);
  box('metal',s.w,.12,.28,0,.55,s.rear-.08,.018);
  if(kind==='ambulance'||kind==='engine') {
   for(const side of [-1,1]) for(let x=0;x<hw-.38;x+=.24) {
    const marks=[[side*x,.78,s.rear-.071],[side*(x+.16),.78,s.rear-.071],[side*(x+.38),1.15,s.rear-.071],[side*(x+.22),1.15,s.rear-.071]];
    if(side>0)marks.reverse();quad('stripe',marks);
   }
  }
  if (kind === 'ambulance' || kind === 'van') {
   box('black',.018,1.55,.016,0,1.85,s.rear-.044,0);
   for (const side of [-1,1]) {
    box('glass',.58,.43,.026,side*.46,2.22,s.rear-.055,.035);
    box('metal',.045,.23,.055,side*.13,1.67,s.rear-.065,.012);
    box('metal',.042,.075,.042,side*(hw-.1),2.1,s.rear-.05,.01);
    box('metal',.042,.075,.042,side*(hw-.1),1.2,s.rear-.05,.01);
   }
   box('rubber',.9,.10,.72,0,s.roof,.0,.04); // roof ventilation
   for(let z=-.3;z<.31;z+=.09) box('metal',.7,.015,.018,0,s.roof+.06,z,0);
  }
  if (kind === 'engine') {
   for (const side of [-1,1]) for (let z=s.rear+.12;z<back-.5;z+=1.3) {
    box('black',.025,1.18,1.19,side*(hw+.012),1.83,z+.57,.012);
    box('plate',.03,1.08,1.09,side*(hw+.028),1.83,z+.57,.018);
    for (let y=1.34;y<2.3;y+=.1) box('metal',.035,.015,1.04,side*(hw+.046),y,z+.57,0);
    box('black',.05,.045,.28,side*(hw+.06),1.44,z+.57,.012);
   }
   for(const side of [-1,1]) rod('metal',[side*.6,2.73,s.rear+.05],[side*.6,2.73,back-.1],.045);
   for(let z=s.rear+.2;z<back;z+=.35) rod('metal',[-.6,2.73,z],[.6,2.73,z],.024);
   for(let x=-.32;x<.4;x+=.14) box('rubber',.10,.15,3.6,x,2.65,-1.3,.035);
  }
  if(kind==='van') {
   for(let z=-2.2;z<.1;z+=.65) rod('metal',[hw+.22,.6,z],[hw+.04,2.5,z],.032);
   box('glass',.035,1.5,2.45,hw+.15,1.56,-1.12,.01);
   rod('metal',[hw+.25,.65,-2.4],[hw+.25,.65,.15],.04);
  }
  if(kind==='utility'||kind==='van') box('amber',1.12,.14,.3,0,s.roof+.12,back+.5,.05);
  const decal = labelMap(s,kind);
  if(decal) {
   m.label=decal;const cabLabel=kind==='utility'||kind==='engine';
   for(const side of [-1,1]) add('label',new THREE.PlaneGeometry(cabLabel?1.3:Math.min(3,back-s.rear-.3),cabLabel?.38:.72),side*(hw+.024),cabLabel?1.14:2.03,cabLabel?(back+screenZ)/2:(back+s.rear)/2,0,side*Math.PI/2);
  }
 }
 // Wheels have tyre shoulders, deep rims, lug nuts and brake hubs. Each wheel is
 // a reusable two-material mesh, rotated only when an active responder moves.
 for(const z of s.axle) for(const side of [-1,1]) {
  const g = new THREE.Group(); g.position.set(side*(hw-.045),s.r,z);
  const tire = new THREE.Mesh(new THREE.TorusGeometry(s.r*.76,s.r*.24,detailed?8:5,detailed?32:12),m.tyre); tire.rotation.y=Math.PI/2; g.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(s.r*.57,s.r*.57,.18,detailed?24:10),m.metal); rim.rotation.z=Math.PI/2; rim.position.x=side*.045; g.add(rim);
  if(detailed) {
   const hub = new THREE.Mesh(new THREE.CylinderGeometry(s.r*.24,s.r*.24,.2,16),m.black); hub.rotation.z=Math.PI/2; hub.position.x=side*.07; g.add(hub);
   for(let j=0;j<8;j++) { const a=j*Math.PI/4; const bolt=new THREE.SphereGeometry(.022,6,4); bolt.translate(side*.18,Math.cos(a)*s.r*.37,Math.sin(a)*s.r*.37); const mesh=new THREE.Mesh(bolt,m.metal);g.add(mesh); }
  }
  // Merge wheel parts by material once, preserving its x-axis rotation pivot.
  const byMat = new Map();
  g.updateMatrixWorld(true);
  for(const child of g.children) { child.updateMatrix(); const geo=child.geometry.clone().applyMatrix4(child.matrix); const flat=geo.index?geo.toNonIndexed():geo; if(flat!==geo)geo.dispose(); if(!byMat.has(child.material))byMat.set(child.material,[]);byMat.get(child.material).push(flat); child.geometry.dispose(); }
  g.clear(); for(const [mat,geos] of byMat) { const geo=mergeGeometries(geos);geos.forEach(x=>x.dispose());geo.userData.shared=true;g.add(new THREE.Mesh(geo,mat)); }
  if (detailed) wheels.push(g);
  else {
   // At this distance the wheel silhouette matters; individual spinning rims do
   // not. Batch them into the body materials instead of keeping 8-12 extra draws.
   g.updateMatrix();
   for (const child of g.children) { add(child.material === m.tyre ? 'black' : 'metal', child.geometry.clone().applyMatrix4(g.matrix)); child.geometry.dispose(); }
  }
  if(detailed) {
   const arch = new THREE.TorusGeometry(s.r+.12,.035,6,24,Math.PI); arch.rotateY(Math.PI/2);
   add('black',arch,side*(hw+.015),s.r,z);
  }
 }
 const meshes=[];
 for(const [key,geos] of parts) { const geometry=mergeGeometries(geos);geos.forEach(g=>g.dispose()); geometry.userData.shared=true; const mesh=new THREE.Mesh(geometry,m[key]); mesh.name=kind+'-'+key;mesh.castShadow=detailed&&key!=='glass'&&key!=='label';mesh.receiveShadow=true; meshes.push(mesh); }
 const result={ meshes,wheels,r:s.r }; cache.set(key,result); return result;
}
export function createServiceVehicle(kind='ambulance') {
 const root=new THREE.LOD();root.name='service-vehicle-'+kind; const moving=[];
 for(const detailed of [true,false]) {
  const t=template(kind,detailed),group=new THREE.Group();group.name=detailed?'detailed':'distant';
  for(const mesh of t.meshes)group.add(mesh.clone());
  for(const wheel of t.wheels){const w=wheel.clone(true);group.add(w);moving.push(w);}
  root.addLevel(group,detailed?0:55,.12);
 }
 root.userData.wheels=moving;root.userData.radius=SPEC[kind]?.r||.43;
 root.userData.sharedServiceVehicle=true;
 return root;
}
export function rollServiceWheels(root,distance) {
 for(const wheel of root.userData.wheels||[])wheel.rotation.x+=distance/root.userData.radius;
}
