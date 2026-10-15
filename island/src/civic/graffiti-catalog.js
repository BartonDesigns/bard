// Stable art choices: revisiting a wall never rerolls its writer or material.
export const GRAFFITI_SHEETS=Object.freeze(['graffiti','graffiti-names','graffiti-revolt','graffiti-characters','graffiti-devotional']);
export function graffitiGraphic(kind,seed){
 const s=seed>>>0;
 if(kind==='tag'){
  if(s%3===1)return null; // retain the existing procedural writers
  const n=Math.floor(s/3),id=GRAFFITI_SHEETS[n%3],tile=Math.floor(n/3)%8;
  return {id,tile,gloss:id==='graffiti-names'&&(tile===0||tile===5)};
 }
 if(kind==='piece'&&s%2===0)return {id:GRAFFITI_SHEETS[3+Math.floor(s/2)%2],tile:Math.floor(s/4)%4,gloss:false};
 return null;
}
