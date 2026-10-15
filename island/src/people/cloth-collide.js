import * as THREE from 'three';

// Body collision, after skinning, in the garment mesh's bind space. Conservative
// per-person capsules cover the torso, neck and articulated limbs. This is a bounded
// contact correction, not a replacement for a full cloth/self-collision solver.
export const CLOTH_CAPS = 12;
export function clothCapsules(P) {
 const {cut:c,map,rest}=P,s=P.height/1.75,out=[];
 const head=n=>rest.heads[map[n]], cap=(bone,a,b,r)=>{if(map[bone]!==undefined&&a&&b)out.push({bone:map[bone],a:a.clone(),b:b.clone(),r});};
 const hz=(c.frontZ-c.backZ)/2,zc=(c.frontZ+c.backZ)/2;
 for(const side of [-1,0,1])cap('spine01',new THREE.Vector3(side*c.waistX*.52,c.waist+.06,zc),new THREE.Vector3(side*c.shoulderX*.48,c.shoulder-.09,zc),Math.min(hz*.84,.095*s));
 cap('neck01',head('neck01'),head('head'),.043*s);
 for(const side of ['L','R'])for(const [bone,end,r]of [['upperarm01','lowerarm01',.046],['lowerarm01','wrist',.034],['upperleg01','lowerleg01',.072],['lowerleg01','foot',.049]]){
  const a=head(bone+'.'+side),b=head(end+'.'+side);if(a&&b)cap(bone+'.'+side,a.clone().lerp(b,.16),a.clone().lerp(b,.86),r*s);
 }
 return out.slice(0,CLOTH_CAPS);
}
export const clothUniforms=()=>({uClothA:{value:Array.from({length:CLOTH_CAPS},()=>new THREE.Vector4())},uClothB:{value:Array.from({length:CLOTH_CAPS},()=>new THREE.Vector3())}});
// A capsule is an approximation of the skin. Preserve the tailored rest silhouette:
// each vertex records any existing overlap, so contact only corrects new penetration
// introduced by the pose. Without this, wide bodies inflate at the underarms.
// A layer over a top (garment slot 1) meets the capsules a little further out than the top
// does, so where a pose presses both against the body they land one over the other instead of
// on the same surface (where the top would show through the jacket or vest in slivers).
export const LAYER_GAP = 0.004;
export function calibrateCloth(geometry,caps){
 const p=geometry.attributes.position,slot=geometry.attributes.slot,inset=new Float32Array(p.count),v=new THREE.Vector3(),ab=new THREE.Vector3(),d=new THREE.Vector3();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);
  const gap=slot&&Math.round(slot.getX(i))%10===1?LAYER_GAP:0;
  for(const c of caps){ab.subVectors(c.b,c.a);const t=THREE.MathUtils.clamp(d.subVectors(v,c.a).dot(ab)/Math.max(ab.lengthSq(),1e-7),0,1);inset[i]=Math.max(inset[i],c.r+gap+.002-d.subVectors(v,c.a).addScaledVector(ab,-t).length());}
 }
 geometry.setAttribute('clothInset',new THREE.BufferAttribute(inset,1));
}
const m=new THREE.Matrix4(),a=new THREE.Vector3(),b=new THREE.Vector3();
export function poseCloth(P,caps,U,mesh){
 for(let i=0;i<CLOTH_CAPS;i++){
  const c=caps[i];if(!c){U.uClothA.value[i].set(0,0,0,0);continue;}
  m.multiplyMatrices(P.skeleton.bones[c.bone].matrixWorld,P.skeleton.boneInverses[c.bone]).premultiply(mesh.bindMatrixInverse);
  a.copy(c.a).applyMatrix4(m);b.copy(c.b).applyMatrix4(m);U.uClothA.value[i].set(a.x,a.y,a.z,c.r);U.uClothB.value[i].copy(b);
 }
}
export const CLOTH_CONTACT_GLSL=`
vec3 clothStart = transformed;
for(int pass=0;pass<2;pass++) for(int i=0;i<${CLOTH_CAPS};i++) {
 float r=uClothA[i].w-clothInset+(abs(mod(slot,10.0)-1.0)<0.5?${LAYER_GAP.toFixed(4)}:0.0);
 if(r<=0.0 || mod(slot,10.0)>2.5) continue;
 vec3 a=uClothA[i].xyz,ab=uClothB[i]-a;
 vec3 delta=transformed-(a+ab*clamp(dot(transformed-a,ab)/max(dot(ab,ab),1e-7),0.0,1.0));
 float d=length(delta);
 if(d<r+.002) transformed+=(d>1e-5?delta/d:vec3(0.,0.,1.))*min(r+.002-d,.018);
}
vec3 correction=transformed-clothStart;
transformed=clothStart+correction*min(1.0,.035/max(length(correction),1e-6));
`;

// CPU reference for pose verification of the exact shader contact rule.
export function projectCloth(point,A,B,inset=0){
 const start=point.clone(),q=point.clone(),ab=new THREE.Vector3(),delta=new THREE.Vector3();
 for(let pass=0;pass<2;pass++)for(let i=0;i<A.length;i++){
  const r=A[i].w-inset;if(r<=0)continue;ab.subVectors(B[i],A[i]);
  const t=THREE.MathUtils.clamp(delta.subVectors(q,A[i]).dot(ab)/Math.max(ab.lengthSq(),1e-7),0,1);
  delta.subVectors(q,A[i]).addScaledVector(ab,-t);const d=delta.length();
  if(d<r+.002)q.addScaledVector(d>1e-5?delta.multiplyScalar(1/d):delta.set(0,0,1),Math.min(r+.002-d,.018));
 }
 return q.sub(start).clampLength(0,.035).add(start);
}
