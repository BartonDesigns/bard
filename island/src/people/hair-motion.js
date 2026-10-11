import * as T from 'three';
// Small clump-level inertial response. Rest curls are retained, roots pinned, the
// existing capsule projection runs after deformation. No per-strand CPU simulation.
export function hairMotion(P, mesh, U) {
 const head=P.bones[P.map.head], now=new T.Vector3(), prior=new T.Vector3(), velocity=new T.Vector3(), dv=new T.Vector3(), q=new T.Quaternion();
 let last=-1;
 return (time=(P.motionTime ?? performance.now()/1000))=>{
  head.getWorldPosition(now); head.getWorldQuaternion(q);
  const dt=time-last;
  if(last>=0 && dt<=0)return;
  if(last<0 || dt>.2 || now.distanceTo(prior)>.5){prior.copy(now);velocity.set(0,0,0);last=time;return;}
  dv.copy(now).sub(prior).divideScalar(dt);
  const target=dv.clone().sub(velocity).multiplyScalar(-.0012).addScaledVector(dv,-.0015).applyQuaternion(q.invert()).clampLength(0,.018);
  U.uHairMotion.value.lerp(target,1-Math.exp(-dt*8)); U.uHairTime.value=time;
  prior.copy(now);velocity.lerp(dv,1-Math.exp(-dt*12));last=time;
 };
}
