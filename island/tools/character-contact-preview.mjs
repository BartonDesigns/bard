import './weapon-hand-preview.mjs';
import * as THREE from 'three';
import {projectCloth} from '../src/people/cloth-collide.js';
window.contactReview=()=>{
 const P=window.weaponReview.P,mesh=P.cloth,g=mesh.geometry,U=P.clothMat.userData.U;
 mesh.onBeforeRender();const A=U.uClothA.value,B=U.uClothB.value;
 let before=0,after=0,corrected=0,maxCorrection=0,samples=0;
 const v=new THREE.Vector3(),ab=new THREE.Vector3(),delta=new THREE.Vector3();
 function penetration(q,inset){let d=0;for(let i=0;i<A.length;i++){ab.subVectors(B[i],A[i]);const t=THREE.MathUtils.clamp(delta.subVectors(q,A[i]).dot(ab)/Math.max(ab.lengthSq(),1e-7),0,1);d=Math.max(d,A[i].w-inset+.002-delta.subVectors(q,A[i]).addScaledVector(ab,-t).length());}return d;}
 for(let i=0;i<g.attributes.position.count;i+=5){if(g.attributes.slot.getX(i)%10>2.5)continue;v.fromBufferAttribute(g.attributes.position,i);mesh.applyBoneTransform(i,v);const inset=g.attributes.clothInset.getX(i),q=projectCloth(v,A,B,inset),db=penetration(v,inset),da=penetration(q,inset),move=q.distanceTo(v);before=Math.max(before,db);after=Math.max(after,da);maxCorrection=Math.max(maxCorrection,move);if(move>1e-5)corrected++;samples++;}
 return {capsules:mesh.userData.capsules.length,samples,corrected,beforeMm:before*1000,afterMm:after*1000,maxCorrectionMm:maxCorrection*1000};
};
