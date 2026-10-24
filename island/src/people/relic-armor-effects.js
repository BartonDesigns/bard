import { LEGENDARY_ARMOR } from '../gameplay/legendary-items.js';
import { createRelicEffect } from '../crysis/relic-effects.js';

// Local-space anchors on the same bones that carry the garment. No floating world-space
// halo and no extra avatar. Both local hero and remote wardrobe use this body pipeline.
const ANCHORS = {
 head: [['head',0,.08,-.105,1]],
 body: [['spine01',0,-.08,-.17,1]],
 legs: [['lowerleg01.L',0,-.13,-.07,.7],['lowerleg01.R',0,-.13,-.07,.7]],
 hands: [['wrist.L',0,-.035,-.035,.6],['wrist.R',0,-.035,-.035,.6]],
 feet: [['foot.L',0,-.02,-.025,.85],['foot.R',0,-.02,-.025,.85]],
};
export function clearArmorEffects(P) { for(const fx of P.relicEffects || [])fx.dispose();P.relicEffects=[]; }
export function dressArmorEffects(P, ids=[]) {
 clearArmorEffects(P);
 for(const id of new Set(ids)) {
  const def=LEGENDARY_ARMOR.find(x=>x.id===id);if(!def)continue;
  for(const [name,x,y,z,scale] of ANCHORS[def.slot]) {
   const bone=P.bones[P.map[name]];if(!bone)continue;
   const fx=createRelicEffect(id,{lod:'low'}),k=(P.height||1.75)/1.75;
   fx.root.position.set(x*k,y*k,z*k);fx.root.rotation.y=Math.PI;fx.root.scale.setScalar(scale*k);
   bone.add(fx.root);P.relicEffects.push(fx);
  }
 }
}
export function updateArmorEffects(P,t) {for(const fx of P.relicEffects || [])if(fx.root.visible)fx.update(t);}
export function armorEffectsLOD(P,dist) {for(const fx of P.relicEffects || [])fx.root.visible=dist<18;}
