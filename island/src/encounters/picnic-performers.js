import * as THREE from 'three';
import { buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { freeBody } from '../people/social-actors.js';
import { itemModel, weaponOf, holdOf, handFrame, reach } from '../crysis/held-items.js';
import { createFlash } from '../crysis/weapon-fx.js';
import { playCue } from '../crysis/weapon-sound.js';
import { folkInstrument, disposePicnicProps } from './picnic-props.js';
import { CAST, PICNIC_ARMS } from './picnic-plan.js';

const UP = new THREE.Vector3(0,1,0);
// Item x is the muzzle direction. Always above 70 degrees, even through recoil.
export function skywardFrame(heading, origin, kick = 0, out = new THREE.Matrix4()) {
 const f = new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
 const x = f.clone().multiplyScalar(.22).addScaledVector(UP,1).normalize();
 const y = f.clone().negate().addScaledVector(x,x.dot(f)).normalize();
 return out.makeBasis(x,y,new THREE.Vector3().crossVectors(x,y)).setPosition(origin.clone().addScaledVector(x,-Math.max(0,kick)*.045));
}
export function createPicnicPerformer(A, i, seat, at, variant, scene, environment, low = false) {
 const cast = CAST[i];let d, seed = 0x715c + i * 391;
 // Eight adult friends, using the existing body/wardrobe system on every device.
 do {d = personDNA(seed++,{age:cast.age});} while(!d.male);
 d.outfit = {...d.outfit,top:cast.color,bottom:[.13,.16,.18],shoes:[.12,.095,.075],sleeves:i===1?'short':'long',jacket:null,legs:'long',fabricTop:'knit'};
 const P = buildPerson(A,d), M = createMotion(P,()=>at.y);
 const light = o => {for(const m of [o.material].flat().filter(Boolean)) if ('envMap' in m) {m.envMap=environment;m.envMapIntensity=.75;m.needsUpdate=true;}};
 P.root.traverse(light);P.relit=light;scene.add(P.root);
 M.place(at.x+seat.x,at.y,at.z+seat.z,seat.yaw);M.sit(.38,true);M.setPose('lap');M.feel('joy',.65);
 M.S.look.target = new THREE.Vector3(at.x,at.y+.9,at.z);
 const gun = cast.role==='sky-shot', strings = cast.role==='strings', id = gun ? PICNIC_ARMS[(variant+i-2)%PICNIC_ARMS.length] : null;
 const held = gun ? itemModel(id,{lod:low?'low':'high'}) : strings ? folkInstrument(i===1) : null;
 if(held){held.matrixAutoUpdate=false;scene.add(held);}
 const flash = gun ? createFlash(held) : null, W=weaponOf(id), H=gun?holdOf(id):null;
 if(flash)flash.sprite.position.set(W.muzzle[0],W.muzzle[1],0);
 M.grip('R',gun?1:strings?.25:0);M.grip('L',gun?1:strings?.65:0);
 if(cast.role==='listen')M.setPose('listen');
 let recoil=0, shots=0, lift=0, phrase=-1;
 const frame=new THREE.Matrix4(),target=new THREE.Matrix4(),pole=new THREE.Vector3(),org=new THREE.Vector3(),q=new THREE.Quaternion(),scl=new THREE.Vector3(1,1,1);
 function update(dt,time,cam,halfBeat=0) {
  if(cast.role==='clap')M.act('clap',halfBeat/4+.5);
  const nextPhrase=Math.floor(halfBeat/16);
  if(nextPhrase!==phrase){phrase=nextPhrase;M.feel('joy',.6);if(cast.role==='laugh')M.gesture('laugh');else if(cast.role==='listen')M.gesture('nod');}
  M.update(dt,time,cam);P.lod?.(cam.distanceTo(P.root.position));P.root.updateMatrixWorld(true);
  if(!held)return;
  const k=P.height/1.75, heading=seat.yaw, f=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading)),l=new THREE.Vector3(Math.cos(heading),0,-Math.sin(heading));
  org.copy(M.S.pos).addScaledVector(UP,.86*k).addScaledVector(f,.27*k);
  if(gun) {
   const n=((halfBeat%32)+32)%32,beats=i===2?[10,26]:[15,30];
   const preparing=beats.some(b=>n>=b-2&&n<b+1.2);
   lift+=(Number(preparing)-lift)*(1-Math.exp(-dt*5));
   org.addScaledVector(l,-.24*k).addScaledVector(UP,(-.17+.24*lift)*k);
   skywardFrame(heading,org,recoil,frame);recoil*=Math.exp(-dt*14);
  }
  else {
   org.addScaledVector(UP,-.08*k);
   q.setFromEuler(new THREE.Euler(0,heading,0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.95));
   frame.compose(org,q,scl);
  }
  held.matrix.copy(frame);held.updateMatrixWorld(true);
  for(const side of ['R','L']) {
   pole.copy(l).multiplyScalar(side==='R'?-1:1).addScaledVector(UP,-.35).addScaledVector(f,.3);
   if(gun)target.multiplyMatrices(frame,H[side].m);
   else {
    handFrame(P,side,target);
    // A continuous strum, and a fretting hand at the neck. Keep wrist orientation from the seated pose.
    const p=new THREE.Vector3(side==='L'?0:.03,side==='L'?.4:-.025+Math.sin(time*12+i*.77)*.035,.075).applyMatrix4(frame);
    target.setPosition(p);
   }
   reach(P,side,target,pole);
  }
  flash?.update(dt);
 }
 function fire(distance, gain=1) {
  if(!gun || new THREE.Vector3().setFromMatrixColumn(held.matrixWorld,0).normalize().y < .9)return false;
  // This is an ambient performance cue. It never dispatches a combat fire/hit event.
  recoil=1;shots++;flash.fire(W.flash,W.tint,W.size*1.6);flash.update(.001);
  if(gain>0)playCue(W.sounds.fire,{distance,gain:.6*gain});
  return true;
 }
 return {P,M,held,update,fire,inspect:()=>({name:cast.name,age:cast.age,role:cast.role,item:id,shots,muzzleY:gun?new THREE.Vector3().setFromMatrixColumn(held.matrixWorld,0).normalize().y:null}),
  dispose(){freeBody(P);if(gun){flash.sprite.material.dispose();held.removeFromParent();}else if(held)disposePicnicProps(held);},
 };
}
