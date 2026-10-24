import { LEGENDARY_ARMOR } from '../gameplay/legendary-items.js';
import { createRelicEffect } from '../crysis/relic-effects.js';
import { createRelicArmor, disposeRelicArmor } from '../crysis/relic-armor-models.js';
import * as THREE from 'three';

// Local-space anchors on the same bones that carry the garment. No floating world-space
// halo and no extra avatar. Both local hero and remote wardrobe use this body pipeline.
const ANCHORS = {
 head: [['head',0,.08,.105,1]],
 body: [['spine01',0,-.08,.17,1]],
 legs: [['lowerleg01.L',0,-.13,.07,.7],['lowerleg01.R',0,-.13,.07,.7]],
 hands: [['wrist.L',0,-.035,-.035,.6],['wrist.R',0,-.035,-.035,.6]],
 feet: [['foot.L',0,-.02,.025,.85],['foot.R',0,-.02,.025,.85]],
};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const measured=(v)=>Number.isFinite(v)&&Math.abs(v)<10;
// Character/garment rest space is +Z forward. The root may face any world heading;
// applying a second PI turn here puts a breastplate on the back of the character.
export function armorAttachmentFit(P,slot,anchor){
 const [name,x,y,z,s]=anchor,k=(P.height||1.75)/1.75;
 const out={position:[x*k,y*k,z*k],scale:[s*k,s*k,s*k],quaternion:slot==='hands'?[0,1,0,0]:[0,0,0,1]};
 const cut=P.cut,head=P.rest?.heads?.[P.map[name]];
 if(!head)return out;
 if(slot==='hands'){
  const finger=P.rest.heads[P.map['finger3-1.'+name.split('.').pop()]];
  if(finger){
   const direction=new THREE.Vector3().subVectors(finger,head),length=direction.length();
   if(length>.005){
    direction.normalize();const up=direction.clone().negate();
    // As in garmentGloveShell, the knuckle/dorsal face is -Z in rest space.
    const front=new THREE.Vector3(0,0,-1).projectOnPlane(up);
    if(front.lengthSq()>.01){
     front.normalize();const right=new THREE.Vector3().crossVectors(up,front).normalize();
     out.quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,front)).toArray();
     out.position=direction.clone().multiplyScalar(.035*k).addScaledVector(front,.025*k).toArray();
     out.scale[1]=clamp(length/.12,.4*k,.9*k);
    }
   }
  }
 }
 if(!cut)return out;
 if(slot==='body'&&[cut.frontZ,cut.backZ,cut.chestX].every(measured)&&cut.frontZ>cut.backZ&&cut.chestX>0){
  out.position[2]=cut.frontZ+.035*k-head.z;
  out.scale[0]=clamp((cut.chestX+.008*k)/.145,.8*k,1.6*k);
  // The authored rear relief is .29m behind the front attachment. Fit both faces,
  // not merely the front crest, to this body's measured torso depth.
  out.scale[2]=clamp((cut.frontZ-cut.backZ+.065*k)/.29,.65*k,1.65*k);
 }
 if(slot==='head'){
  const sk=cut.skull;
  if(sk&&[sk.x0,sk.x1,sk.y1,sk.z0,sk.z1].every(measured)&&sk.x1>sk.x0&&sk.z1>sk.z0){
   out.position=[(sk.x0+sk.x1)/2-head.x,sk.y1-.075*k-head.y,sk.z1+.012*k-head.z];
   out.scale[0]=clamp((sk.x1-sk.x0+.016*k)/.286,.6*k,1.3*k);
   out.scale[2]=clamp((sk.z1-sk.z0+.024*k)/.265,.6*k,1.3*k);
  }
 }
 return out;
}
export function clearArmorEffects(P) { for(const fx of P.relicEffects || [])fx.dispose();P.relicEffects=[]; }
export function dressArmorEffects(P, ids=[]) {
 clearArmorEffects(P);
 for(const id of new Set(ids)) {
  const def=LEGENDARY_ARMOR.find(x=>x.id===id);if(!def)continue;
  for(const anchor of ANCHORS[def.slot]) {
   const [name]=anchor;
   const bone=P.bones[P.map[name]];if(!bone)continue;
   const fx=createRelicEffect(id,{lod:'low'}),fit=armorAttachmentFit(P,def.slot,anchor);
   const relief=createRelicArmor(id,{lod:'low',worn:true}),release=fx.dispose;
   fx.root.add(relief);
   fx.dispose=()=>{disposeRelicArmor(relief);release();};
   fx.root.position.set(...fit.position);fx.root.scale.set(...fit.scale);fx.root.quaternion.fromArray(fit.quaternion);
   bone.add(fx.root);P.relicEffects.push(fx);
  }
 }
}
export function updateArmorEffects(P,t) {for(const fx of P.relicEffects || [])if(fx.root.visible)fx.update(t);}
export function armorEffectsLOD(P,dist) {for(const fx of P.relicEffects || [])fx.root.visible=dist<18;}
