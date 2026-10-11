import * as T from 'three';

export const HAIR_GUIDES = 4;
export const guideUniform = () => ({ value: Array.from({ length: HAIR_GUIDES }, () => new T.Vector3()) });

// Four damped guide responses share the existing groom's geometry. Translation and
// head rotation drive inertia; each tuft follows a guide at its own stiffness.
// Closed-form critical damping stays stable at varying frame rates. No frame allocations.
export function hairMotion(P, mesh, U) {
 const head=P.bones[P.map.head], now=new T.Vector3(), prior=new T.Vector3(), velocity=new T.Vector3(), dv=new T.Vector3();
 const q=new T.Quaternion(), priorQ=new T.Quaternion(), dq=new T.Quaternion(), inverse=new T.Quaternion();
 const omega=new T.Vector3(), acceleration=new T.Vector3(), localVelocity=new T.Vector3(), target=new T.Vector3(), x=new T.Vector3(), c=new T.Vector3();
 const guides=U.uHairGuides?.value || Array.from({length:HAIR_GUIDES},()=>new T.Vector3());
 const speeds=guides.map(()=>new T.Vector3()), anchors=guides.map((_,i)=>new T.Vector3(Math.sin(i*Math.PI/2)*.075,-.09,Math.cos(i*Math.PI/2)*.075));
 let last=-1;
 return (time=(P.motionTime ?? performance.now()/1000))=>{
  if(!Number.isFinite(time))return;
  head.getWorldPosition(now); head.getWorldQuaternion(q);
  const dt=time-last;
  if(last>=0 && dt<=0)return;
  U.uHairTime.value=time;
  if(last<0 || dt>.2 || now.distanceTo(prior)>.5){
   prior.copy(now);priorQ.copy(q);velocity.set(0,0,0);U.uHairMotion.value.set(0,0,0);
   for(let i=0;i<HAIR_GUIDES;i++){guides[i].set(0,0,0);speeds[i].set(0,0,0);}
   last=time;return;
  }
  inverse.copy(q).invert();
  dv.copy(now).sub(prior).divideScalar(dt);
  acceleration.copy(dv).sub(velocity).divideScalar(dt).applyQuaternion(inverse).clampLength(0,35);
  localVelocity.copy(dv).applyQuaternion(inverse).clampLength(0,8);
  dq.copy(inverse).multiply(priorQ);
  if(dq.w<0){dq.x*=-1;dq.y*=-1;dq.z*=-1;dq.w*=-1;}
  omega.set(dq.x,dq.y,dq.z).multiplyScalar(2/dt).clampLength(0,12);
  U.uHairMotion.value.set(0,0,0);
  for(let i=0;i<HAIR_GUIDES;i++){
   target.crossVectors(omega,anchors[i]).multiplyScalar(.055).addScaledVector(acceleration,-.00045).addScaledVector(localVelocity,-.002).clampLength(0,.026);
   const w=18+i*3, decay=Math.exp(-w*dt);
   x.copy(guides[i]).sub(target);c.copy(speeds[i]).addScaledVector(x,w);
   guides[i].copy(x).addScaledVector(c,dt).multiplyScalar(decay).add(target);
   speeds[i].addScaledVector(c,-w*dt).multiplyScalar(decay);
   guides[i].clampLength(0,.03);U.uHairMotion.value.addScaledVector(guides[i],1/HAIR_GUIDES);
  }
  prior.copy(now);priorQ.copy(q);velocity.copy(dv);last=time;
 };
}
