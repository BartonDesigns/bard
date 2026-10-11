import * as THREE from 'three';

// Fitting changes a groom's shape. Rebuild its lighting frame on that fitted surface,
// instead of using the directions baked on a different head. Kept per person: cached
// source normals/tangents are never mutated. No extra geometry or per-frame work.
export function fittedHairFrame(V, F, grain, skull) {
 const N=new Float32Array(V.length),T=new Float32Array(V.length);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 const e1=new THREE.Vector3(),e2=new THREE.Vector3(),n=new THREE.Vector3(),t=new THREE.Vector3(),ref=new THREE.Vector3(),radial=new THREE.Vector3();
 for(let i=0;i<F.I.length;i+=3){
  const ia=F.I[i],ib=F.I[i+1],ic=F.I[i+2];
  a.fromArray(V,ia*3);b.fromArray(V,ib*3);c.fromArray(V,ic*3);
  e1.subVectors(b,a);e2.subVectors(c,a);n.crossVectors(e1,e2);
  const area=n.length();if(area<1e-12)continue;
  const du1=F.UV[ib*2]-F.UV[ia*2],du2=F.UV[ic*2]-F.UV[ia*2];
  const dv1=F.UV[ib*2+1]-F.UV[ia*2+1],dv2=F.UV[ic*2+1]-F.UV[ia*2+1],det=du1*dv2-du2*dv1;
  ref.fromArray(F.T,ia*3);
  if(grain>=0 && Math.abs(det)>1e-10){
   if(grain===1)t.copy(e1).multiplyScalar(-du2).addScaledVector(e2,du1);
   else t.copy(e1).multiplyScalar(dv2).addScaledVector(e2,-dv1);
   t.multiplyScalar(1/det).normalize();if(t.dot(ref)<0)t.negate();
  }else t.copy(ref);
  for(const v of [ia,ib,ic])for(let k=0;k<3;k++){N[v*3+k]+=n.getComponent(k);T[v*3+k]+=t.getComponent(k)*area;}
 }
 for(let v=0;v<V.length/3;v++){
  radial.fromArray(V,v*3).sub(skull.c);
  // Below the jaw, lighting wraps around a hanging lock, not towards the floor.
  radial.y=Math.max(radial.y,.015);radial.normalize();
  n.fromArray(N,v*3);if(n.lengthSq()<1e-12)n.fromArray(F.N,v*3);n.normalize();
  if(n.dot(radial)<0)n.negate();n.multiplyScalar(.35).addScaledVector(radial,.65).normalize();
  t.fromArray(T,v*3);t.addScaledVector(n,-t.dot(n));
  if(t.lengthSq()<1e-12){t.fromArray(F.T,v*3);t.addScaledVector(n,-t.dot(n));}
  if(t.lengthSq()<1e-12){t.set(Math.abs(n.y)<.9?0:1,Math.abs(n.y)<.9?1:0,0);t.addScaledVector(n,-t.dot(n));}
  n.toArray(N,v*3);t.normalize().toArray(T,v*3);
 }
 return {N,T};
}
