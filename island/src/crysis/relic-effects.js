// Owned, bounded animation rigs. No lights, texture downloads, particle emitters, timers or
// per-frame geometry creation. All instances have private state/materials and dispose safely.
import * as THREE from 'three';
import { RELICS } from '../gameplay/legendary-items.js';
import { RELIC_MOTION, eyeOpenness, eyeGaze } from './relic-motion.js';

const TAU = Math.PI * 2;
const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const vortex = `varying vec2 vUv; uniform float time; uniform float energy;
 void main(){ vec2 p=vUv*2.-1.; float r=length(p), a=atan(p.y,p.x);
 float arm=pow(.5+.5*sin(a*5.+r*24.-time*1.3),5.);
 float band=smoothstep(.22,.43,r)*(1.-smoothstep(.82,1.,r));
 vec3 c=mix(vec3(.003,.002,.008),vec3(.34,.14,.66),band*(.23+arm*.65));
 c+=vec3(.39,.28,.59)*pow(max(0.,1.-abs(r-.78)*9.),3.)*.3;
 gl_FragColor=vec4(c*(1.+energy*.4),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
const eye = `varying vec2 vUv; uniform vec2 gaze; uniform float openEye;
 void main(){ vec2 p=vUv*2.-1.; float r=length(p); if(r>1.)discard;
 vec3 c=vec3(.50,.36,.14); float aperture=max(.014,openEye*.83);
 if(openEye>.02 && abs(p.y)<aperture*sqrt(max(0.,1.-p.x*p.x))){
  c=vec3(.76,.69,.45); vec2 q=p-gaze; float ir=length(q);
  if(ir<.57){float grain=.5+.5*sin(atan(q.y,q.x)*43.+ir*22.); c=mix(vec3(.30,.13,.025),vec3(.98,.65,.18),grain*.45+.35);}
  if(abs(q.x)<.105*(1.-min(1.,abs(q.y)/.5)))c=vec3(.015,.009,.003);
  c+=vec3(.32)*(1.-smoothstep(0.,.12,length(q-vec2(-.16,.2))));
 } gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;

export function createRelicEffect(id, { lod = 'high', length = .5, y = 0, reducedMotion } = {}) {
 const def = RELICS[id]; if (!def || !RELIC_MOTION[id]) return null;
 const root = new THREE.Group(); root.name = 'relic-effect:' + id; root.position.y = y;
 const low = lod === 'low', seg = low ? 12 : 24, motions = [], geos = new Set(), mats = new Set();
 const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
 let dead = false, last = null, energy = 0;
 const mat = (color, glow = 0) => { const m = new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:glow,roughness:.46,metalness:.52,side:THREE.DoubleSide}); mats.add(m); return m; };
 const metal = mat(0xb79a64), light = mat(def.color,.65), dark = mat(0x28222c);
 const mesh = (g,m=light,x=0,v=0,z=0,parent=root) => {
  geos.add(g); const o=new THREE.Mesh(g,m); o.position.set(x,v,z);o.frustumCulled=false;parent.add(o);return o;
 };
 const group = (x=0,v=0,z=0) => { const g=new THREE.Group();g.position.set(x,v,z);root.add(g);return g; };
 const ring = (r,x,v,z=0,m=light) => mesh(new THREE.TorusGeometry(r,.003,4,seg),m,x,v,z);
 const gem = (r,x,v,z=0,m=light) => mesh(new THREE.OctahedronGeometry(r,0),m,x,v,z);
 const bar = (w,h,d,x,v,z=0,m=light,parent=root) => mesh(new THREE.BoxGeometry(w,h,d),m,x,v,z,parent);
 const tube = (points,r=.003,m=light,parent=root) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),low?12:24,r,4,false),m,0,0,0,parent);
 const pendulum = (x,v,z,r=.017) => {
  const g=group(x,v,z);mesh(new THREE.CylinderGeometry(.004,r,.04,low?6:10,1,true),metal,0,-.055,0,g);
  bar(.003,.045,.003,0,-.022,0,metal,g);return g;
 };
 const shader = (fragment,uniforms,r,x,v,z) => {
  const m=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide}); mats.add(m);
  return mesh(new THREE.CircleGeometry(r,seg),m,x,v,z);
 };
 const L=length;
 switch(id) {
 case 'event-horizon': {
  const U={time:{value:0},energy:{value:0}};
  // Two faces keep the void visible from either side without z fighting against the spine.
  for(const s of [-1,1])shader(vortex,U,.122,L*.75,.025,s*.027);
  const a=ring(.141,L*.75,.025,0,metal),b=ring(.157,L*.75,.025,0,light);
  a.rotation.x=.45;b.rotation.y=.5;
  motions.push((t,e)=>{U.time.value=t;U.energy.value=e;a.rotation.z=-t*.23;b.rotation.z=t*.17;});break;
 }
 case 'first-morning': {
  const U={gaze:{value:new THREE.Vector2()},openEye:{value:1}};
  for(const s of [-1,1]) { shader(eye,U,.064,L*.52,0,s*.079);ring(.066,L*.52,0,s*.079,metal); }
  motions.push((t)=>{eyeGaze(t,U.gaze.value);U.openEye.value=eyeOpenness(t);});break;
 }
 case 'sunbreak-testament':
  for(let n=0;n<3;n++){const g=group(.157+n*L*.23,.09+n*.02);bar(.064,.013,.009,0,0,0,light,g);motions.push(t=>{g.rotation.y=t*.8+n*TAU/3;});}break;
 case 'stormglass-repeater': {
  const arc=tube([[.05,-.07,.028],[L*.32,.035,.028],[L*.48,-.025,.028],[L*.65,.08,.028]],.004);
  motions.push((t,e)=>{arc.scale.y=.65+.28*Math.sin(t*2.6)+e*.12;arc.position.z=.03*Math.sin(t*1.1);});break;
 }
 case 'orchard-of-ashes':
  for(let n=0;n<(low?3:5);n++){const g=group(L*.7,0);g.rotation.x=n*TAU/(low?3:5);const p=mesh(new THREE.ConeGeometry(.022,.11,5),dark,0,.04,0,g);motions.push((t,e)=>{p.rotation.z=.35+.32*(1+Math.sin(t*.8))+e*.2;});}break;
 case 'pilgrims-last-light': {
  const p=pendulum(L*.35,.18,.02,.025);const flame=gem(.015,L*.35,.115,.02);motions.push(t=>{p.rotation.z=.18*Math.sin(t*1.4);flame.position.x=L*.35+.055*Math.sin(p.rotation.z);flame.position.y=.18-.065*Math.cos(p.rotation.z);});break;
 }
 case 'copper-saint':
  for(const s of [-1,1]) {const g=group(L*.6,0,s*.04);tube([[-.08,.1,0],[.04,.13,0],[.13,0,0],[.04,-.13,0],[-.08,-.1,0],[-.08,.1,0]],.003,light,g);motions.push((t,e)=>{g.scale.setScalar(1+.07*(1+Math.sin(t*.9))+e*.12);});}break;
 case 'moth-kings-lantern': {
  const g=group(L*.55,0,.06); const wings=[];
  for(const s of [-1,1]){const a=mesh(new THREE.CircleGeometry(.025,5),light,s*.02,0,0,g);a.scale.y=1.5;wings.push(a);}
  motions.push(t=>{g.position.set(L*.55+.09*Math.cos(t*.7),.1*Math.sin(t*.7),.08);wings[0].rotation.y=Math.sin(t*5)*.7;wings[1].rotation.y=-Math.sin(t*5)*.7;});break;
 }
 case 'black-tide':
  for(let n=0;n<3;n++){const p=group(.07+n*L*.3,-.015,.036);tube([[0,0,0],[.009,-.045,0],[-.005,-.11,.005],[.015,-.15,0]],.007,dark,p);motions.push(t=>{p.rotation.x=.23*Math.sin(t*.7+n);p.rotation.z=.15*Math.sin(t*.9+n*.8);});}break;
 case 'widows-meridian':
  for(let n=0;n<3;n++){const g=group(.07+n*L*.32,0,.02),r=.09-n*.02;bar(.005,r*.75,.009,0,r*.3,0,metal,g);motions.push(t=>{g.rotation.z=-t*(.3+n*.19)+.7*Math.sin(t*(.7+n*.2));});}break;
 case 'choir-of-thorns':
  for(let n=0;n<3;n++){const g=pendulum(.08+n*L*.3,-(.055+n*.025),.025,.012);motions.push(t=>{g.rotation.z=.3*Math.sin(t*2-n*1.3);});}break;
 case 'dawn-engine': {
  const g=group(L*.55,0,.022);
  for(let n=0;n<4;n++){const b=bar(.008,.24,.008,0,0,0,metal,g);b.rotation.z=n*Math.PI/4;}
  motions.push((t,e)=>{g.rotation.z=t*.43+e*.13;});break;
 }
 case 'winter-debt':
  for(let n=0;n<(low?2:4);n++){const p=gem(.014,0,0);motions.push(t=>{const a=1.6*Math.sin(t*.4)+n*Math.PI/2;p.position.set(L*.4+.085*Math.cos(a),.085*Math.sin(a),.035);p.rotation.z=-a;});}break;
 case 'cathedral-of-sparks':
  for(let n=0;n<5;n++){const h=.12+.08*Math.sin(n*1.2),p=bar(.009,h,.008,.04+n*L*.2,h/2,.023);p.geometry.translate(0,h/2,0);p.position.y=0;motions.push((t,e)=>{p.scale.y=.15+.85*Math.pow(.5+.5*Math.sin(t*1.5-n*.7),2)+e*.08;});}break;
 case 'gravesong-resonator':
  for(let n=0;n<3;n++){const p=pendulum(L*.4+n*.055,.045-n*.02,.03,.019-n*.002);motions.push(t=>{p.rotation.x=.3*Math.sin(t*(1.35+n*.25)+n*Math.PI);});}break;
 case 'hearth-of-the-exile':
  for(let n=0;n<3;n++){const p=mesh(new THREE.ConeGeometry(.015,.06,low?5:8),light,.07+n*.05,.15,0);motions.push(t=>{p.scale.y=.7+.3*Math.sin(t*1.7+n);p.rotation.z=.16*Math.sin(t*1.2+n);});}break;
 case 'gargantuas-whisper':
  for(let n=0;n<(low?3:5);n++){const p=gem(.013+n*.002,0,0,0,n%2?dark:metal);motions.push(t=>{const a=t*(.3+n*.04)+n*TAU/5;p.position.set(L*.55+.115*Math.cos(a),.045+.115*Math.sin(a),.035*Math.sin(a*2));p.rotation.set(a*.3,a,-a);});}break;
 case 'wildfire-canticle': {
  const g=group(.03,0);const pts=Array.from({length:33},(_,n)=>{const u=n/32,a=u*TAU*2;return [u*L,.055*Math.sin(a),.055*Math.cos(a)];});tube(pts,.003,light,g);
  motions.push((t,e)=>{g.rotation.x=-t*.9;g.scale.y=g.scale.z=1+e*.2;});break;
 }
 case 'oathkeeper-lattice':
  for(let n=0;n<3;n++){const p=mesh(new THREE.CircleGeometry(.048,4),light,L*(.25+n*.24),0,.027);p.rotation.z=Math.PI/4;motions.push(t=>{p.rotation.y=.9*Math.pow(.5+.5*Math.sin(t*.85-n*1.1),3);});}break;
 case 'hollow-crown':
  for(let n=0;n<5;n++){const p=gem(.027,n*L*.22+.015,.24+(n%2)*.045,0,metal);p.scale.y=1.7;motions.push(t=>{p.position.y=.24+(n%2)*.045+.018*Math.sin(t*.6+n*1.7);p.rotation.y=t*.17+n;});}break;
 // Armour is built around a local origin: the same motif is used by ground loot and bone
 // attachments. Independent parts are intentionally small enough not to obscure faces.
 case 'lumencrest-circlet': {
  const crest=gem(.037,0,.05,.025);crest.scale.y=1.5;
  const halo=ring(.063,0,.045,.02,metal);halo.scale.y=.55;
  motions.push(t=>{halo.rotation.y=t*.2;crest.rotation.y=.2*Math.sin(t*.4);});break;
 }
 case 'gallery-scale-mail':
  for(let n=0;n<5;n++){const p=gem(.03,(n%2?-.035:.035),.1-n*.045,.025);p.scale.set(1,.75,.3);motions.push(t=>{p.rotation.x=.15+.22*Math.sin(t*.7-n*.8);});}break;
 case 'cinder-core-cuirass': {
  const core=gem(.045,0,0,.02);core.scale.y=1.7;
  for(const s of [-1,1]){const p=bar(.032,.14,.016,s*.027,0,.055,dark);motions.push((t,e)=>{p.position.x=s*(.023+.012*(1+Math.sin(t*.9))+e*.01);p.rotation.y=s*.15*(1+Math.sin(t*.9));});}break;
 }
 case 'ashwalker-greaves':
  for(let n=0;n<3;n++){const p=bar(.055,.006,.008,0,.05-n*.055,.02);motions.push(t=>{p.scale.x=.35+.65*Math.pow(.5+.5*Math.sin(t*1.1+n*1.4),2);});}break;
 case 'stormwarden-flightcoat':
  for(const s of [-1,1])for(let n=0;n<2;n++){const p=bar(.075,.025,.012,s*(.095+n*.03),.09-n*.03,.02,dark);motions.push(t=>{p.rotation.z=s*(.35+.12*Math.sin(t*.75+n));p.position.z=.02+.008*Math.sin(t*.75+n);});}break;
 case 'stormwarden-gauntlets':
  for(let n=0;n<3;n++){const p=bar(.012,.02,.005,(n-1)*.019,0,.015);motions.push(t=>{p.scale.y=.3+.7*Math.pow(.5+.5*Math.sin(t*1.6-n*1.5),2);});}break;
 case 'fogmothers-veil':
  for(let n=0;n<3;n++){const g=group((n-1)*.06,0,.015);tube([[0,0,0],[.015,-.04,.02],[-.01,-.09,.03],[.01,-.16,.01]],.003,light,g);motions.push(t=>{g.rotation.x=.15*Math.sin(t*.45+n);g.rotation.z=.07*Math.sin(t*.7+n);});}break;
 case 'drowned-procession-boots':
  for(let n=0;n<2;n++){const p=ring(.07,0,-.045,.025);p.rotation.x=Math.PI/2;motions.push(t=>{const u=.5+.5*Math.sin(t*1.1+n*Math.PI);p.scale.set(.6+u*.4,.65+u*.6,1);p.position.y=-.045+u*.008;});}break;
 default: break;
 }
 root.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
 function update(time, options={}) {
  if(dead || !Number.isFinite(time))return;
  const dt=last===null?0:Math.max(0,Math.min(.1,time-last));last=time;energy*=Math.exp(-dt*4);
  const calm=options.reducedMotion ?? reducedMotion ?? media?.matches ?? false;
  const t=calm?0:time;
  for(const f of motions)f(t,calm?0:energy);
  light.emissiveIntensity=.65+(calm?0:energy*.3);
 }
 function dispose(){if(dead)return;dead=true;root.removeFromParent();for(const g of geos)g.dispose();for(const m of mats)m.dispose();motions.length=0;}
 const fx={id,root,update,trigger(){if(!dead)energy=1;},dispose,get disposed(){return dead;},get channels(){return motions.length;}};
 root.userData.relicFX=fx;update(0);return fx;
}

export function disposeRelicEffect(model){model?.userData.relicFX?.dispose();}
