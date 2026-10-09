import * as THREE from 'three';
import { buildPerson, personDNA } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { freeBody } from '../people/social-actors.js';
import { itemModel, weaponOf, holdOf, handFrame, reach } from '../crysis/held-items.js';
import { createFlash } from '../crysis/weapon-fx.js';
import { playCue } from '../crysis/weapon-sound.js';
import { folkInstrument, disposePicnicProps } from './picnic-props.js';
import { CAST, PICNIC_ARMS, FLOOR_HEIGHT, FLOOR_POSES, picnicActivity } from './picnic-plan.js';

const UP = new THREE.Vector3(0,1,0);
// Item x is the muzzle direction. Always above 70 degrees, even through recoil.
export function skywardFrame(heading, origin, kick = 0, out = new THREE.Matrix4()) {
 const f = new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
 const x = f.clone().multiplyScalar(.22).addScaledVector(UP,1).normalize();
 const y = f.clone().negate().addScaledVector(x,x.dot(f)).normalize();
 return out.makeBasis(x,y,new THREE.Vector3().crossVectors(x,y)).setPosition(origin.clone().addScaledVector(x,-Math.max(0,kick)*.045));
}
export function createPicnicPerformer(A, i, seat, at, variant, scene, environment, low = false, occupied = () => false) {
 const cast = CAST[i];let d, seed = 0x715c + i * 391;
 // Eight adult friends, using the existing body/wardrobe system on every device.
 do {d = personDNA(seed++,{age:cast.age});} while(!d.male);
 d.outfit = {...d.outfit,top:cast.color,bottom:[.13,.16,.18],shoes:[.12,.095,.075],sleeves:i===1?'short':'long',jacket:null,legs:'long',fabricTop:'knit'};
 const home=new THREE.Vector3(at.x+seat.x,at.y+.028,at.z+seat.z), previous=home.clone();
 const away=home.clone().add(new THREE.Vector3(seat.x,0,seat.z).normalize().multiplyScalar(.55));
 away.x+=Math.cos(seat.yaw)*.16;away.z-=Math.sin(seat.yaw)*.16;
 const ground=(x,z)=>at.y+(Math.abs(x-at.x)<3.1&&Math.abs(z-at.z)<3.1?.028:0);
 const P = buildPerson(A,d), M = createMotion(P,ground,{sitFrequency:.65,constrain(p){
  if(Math.abs(p.x-at.x)>3.15||Math.abs(p.z-at.z)>3.15||occupied(p,i))p.copy(previous);
  previous.copy(p);
 }});
 const light = o => {for(const m of [o.material].flat().filter(Boolean)) if ('envMap' in m) {m.envMap=environment;m.envMapIntensity=.75;m.needsUpdate=true;}};
 P.root.traverse(light);P.relit=light;scene.add(P.root);
 M.place(home.x,home.y,home.z,seat.yaw);M.S.floorPose=FLOOR_POSES[i];M.sit(FLOOR_HEIGHT,true);M.setPose('lap');M.feel('joy',.65);
 M.S.look.target = new THREE.Vector3(at.x,at.y+.8,at.z);
 const gun = cast.role==='sky-shot', strings = cast.role==='strings', id = gun ? PICNIC_ARMS[(variant+i-2)%PICNIC_ARMS.length] : null;
 const held = gun ? itemModel(id,{lod:low?'low':'high'}) : strings ? folkInstrument(i===1) : null;
 if(held){held.matrixAutoUpdate=false;scene.add(held);}
 const flash = gun ? createFlash(held) : null, W=weaponOf(id), H=gun?holdOf(id):null;
 if(flash)flash.sprite.position.set(W.muzzle[0],W.muzzle[1],0);
 M.grip('R',gun?1:strings?.25:0);M.grip('L',gun?1:strings?.65:0);
 if(cast.role==='listen')M.setPose('listen');
 let recoil=0, shots=0, lift=0, phrase=-1, activity='seated';
 const frame=new THREE.Matrix4(),target=new THREE.Matrix4(),pole=new THREE.Vector3(),org=new THREE.Vector3(),q=new THREE.Quaternion(),scl=new THREE.Vector3(1,1,1);
 function walkTo(target) {
  const dx=target.x-M.S.pos.x,dz=target.z-M.S.pos.z,distance=Math.hypot(dx,dz);
  if(distance<.045){M.want.speed=0;return true;}
  M.want.heading=Math.atan2(dx,dz);
  M.want.speed=Math.cos(M.want.heading-M.S.heading)>.8?Math.min(.38,distance*2):0;
  return false;
 }
 function update(dt,time,cam,halfBeat=0,elapsed=0) {
  activity=picnicActivity(elapsed,i);M.want.speed=0;
  const homeDistance=Math.hypot(M.S.pos.x-home.x,M.S.pos.z-home.z);
  if(activity==='seated'||activity==='settle'){
   if(homeDistance>.065){activity='shuffle-back';M.stand();walkTo(home);}
   else {M.want.heading=seat.yaw;M.sit(FLOOR_HEIGHT);}
  }else {
   M.stand();
   if(activity==='shuffle-out')walkTo(away);
   else if(activity==='shuffle-back')walkTo(home);
   else if(activity==='turn')M.want.heading=seat.yaw;
  }
  if(cast.role==='clap'){if(activity==='seated')M.act('clap',halfBeat/4+.5);else M.act(null);}
  const nextPhrase=Math.floor(halfBeat/16);
  if(nextPhrase!==phrase){phrase=nextPhrase;M.feel('joy',.6);if(cast.role==='laugh')M.gesture('laugh');else if(cast.role==='listen')M.gesture('nod');}
  for(let remaining=dt;remaining>1e-6;){const step=Math.min(.05,remaining);M.update(step,time,cam);remaining-=step;}
  P.lod?.(cam.distanceTo(P.root.position));P.root.updateMatrixWorld(true);
  const k=P.height/1.75, heading=M.S.heading, f=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading)),l=new THREE.Vector3(Math.cos(heading),0,-Math.sin(heading));
  if(!held){
   const support=FLOOR_POSES[i].support, seated=M.S.sitK.v;
   if(support&&seated>.01){
    const side=support==='L'?1:-1, palm=M.S.pos.clone().addScaledVector(l,side*.44*k).addScaledVector(f,-.08*k);palm.y=ground(palm.x,palm.z)+.035;
    handFrame(P,support,target);org.setFromMatrixPosition(target).lerp(palm,seated);target.makeBasis(f,l.clone().multiplyScalar(side),UP).setPosition(org);
    reach(P,support,target,l.clone().multiplyScalar(side).addScaledVector(UP,-.3));
   }
   return;
  }
  const chest=P.bones[P.map.spine01];chest.getWorldPosition(org);org.addScaledVector(f,.25*k).addScaledVector(UP,-.12*k);
  if(gun) {
   const n=((halfBeat%32)+32)%32,beats=i===2?[10,26]:[15,30];
   const preparing=beats.some(b=>n>=b-2&&n<b+1.2);
   lift+=(Number(preparing)-lift)*(1-Math.exp(-dt*5));
   org.addScaledVector(l,-.24*k).addScaledVector(UP,(-.08+.32*lift)*k);
   skywardFrame(heading,org,recoil,frame);recoil*=Math.exp(-dt*14);
  }
  else {
   org.addScaledVector(UP,-.02*k);
   chest.getWorldQuaternion(q);q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.95));
   frame.compose(org,q,scl);
  }
  held.matrix.copy(frame);held.updateMatrixWorld(true);
  for(const side of ['R','L']) {
   pole.copy(l).multiplyScalar(side==='R'?-1:1).addScaledVector(UP,-.35).addScaledVector(f,.3);
   if(gun)target.multiplyMatrices(frame,H[side].m);
   else {
    handFrame(P,side,target);
    // A continuous strum, and a fretting hand at the neck. Keep wrist orientation from the seated pose.
    const strum=M.S.speed.v<.05?Math.sin(time*12+i*.77)*.035:0;
    const p=new THREE.Vector3(side==='L'?0:.03,side==='L'?.4:-.025+strum,.075).applyMatrix4(frame);
    target.setPosition(p);
   }
   reach(P,side,target,pole);
  }
  flash?.update(dt);
 }
 function fire(distance, gain=1) {
  if(!gun || !['seated','stand'].includes(activity) || M.S.speed.v>.05 || new THREE.Vector3().setFromMatrixColumn(held.matrixWorld,0).normalize().y < .9)return false;
  // This is an ambient performance cue. It never dispatches a combat fire/hit event.
  recoil=1;shots++;flash.fire(W.flash,W.tint,W.size*1.6);flash.update(.001);
  if(gain>0)playCue(W.sounds.fire,{distance,gain:.6*gain});
  return true;
 }
 return {P,M,held,update,fire,inspect:()=>({name:cast.name,age:cast.age,role:cast.role,item:id,shots,activity,pose:FLOOR_POSES[i].name,seated:M.S.sitK.v,position:M.S.pos.toArray(),hipY:P.bones[P.map['upperleg01.L']].getWorldPosition(new THREE.Vector3()).y-at.y,feet:['L','R'].map(s=>P.bones[P.map['foot.'+s]].getWorldPosition(new THREE.Vector3()).y-at.y),muzzleY:gun?new THREE.Vector3().setFromMatrixColumn(held.matrixWorld,0).normalize().y:null}),
  dispose(){freeBody(P);if(gun){flash.sprite.material.dispose();held.removeFromParent();}else if(held)disposePicnicProps(held);},
 };
}
