// Surface contracts shared by the procedural city and off-world kit. No scene or DOM.
import {hash32,hash01} from '../signage/rand.js';
export const wreckedHost=o=>!!(o?.wrecked||o?.grp?.wrecked||o?.src?.grp?.wrecked);
export function buildingArtSurfaces(lots,{x=0,z=0,radius=420,ground=()=>0,landAt=()=>null,fronted=()=>false,cap=128}={}){
 const out=[];
 for(const o of lots){
  if(out.length>=cap)break;
  if(!o||!Number.isFinite(o.x+o.z+o.w+o.d+o.h)||o.w<2||o.d<2||o.h<3||Math.hypot(o.x-x,o.z-z)>radius+Math.max(o.w,o.d)/2)continue;
  if(wreckedHost(o)||o.src?.grp?.service||o.src?.kind===7||o.civic||/civic|school|church|hospital/.test(o.use||''))continue;
  const lu=landAt(o.x,o.z)?.lu;
  // City KIND.industry=5; surveyed data uses src.kind=9. Both must be eligible.
  if(o.kind!==5&&o.src?.kind!==9&&lu!==8)continue;
  const base=Math.max(ground(o.x,o.z),Number.isFinite(o.y)?o.y:-Infinity),top=Number.isFinite(o.y)?o.y+o.h:base+o.h,h=top-base;
  if(h<2)continue;
  const ca=Math.cos(o.a||0),sa=Math.sin(o.a||0);
  for(const [lx,lz,len]of [[0,1,o.w],[0,-1,o.w],[1,0,o.d],[-1,0,o.d]]){
   const nx=ca*lx-sa*lz,nz=sa*lx+ca*lz,half=lx?o.w/2:o.d/2,px=o.x+nx*(half+.03),pz=o.z+nz*(half+.03);
   if(Math.hypot(px-x,pz-z)>radius||fronted(px,pz,nx,nz)||out.length>=cap)continue;
   out.push({kind:'industrial',x:px,z:pz,y:base,nx,nz,w:Math.min(len,30),h,lu:8,campaignEligible:o.kind===5,host:o});
  }
 }
 return out;
}
// Builder-local frames are the source of truth, including rotated/raised colony sites.
export function civicWall(target,F,{id,x=0,y=0,z=0,nx=0,nz=1,w,h,tags=true}){
 if(!target)return;const p=F.p(x,y,z);
 target.surfaces.push({id,x:p.x,y:p.y,z:p.z,nx:F.c*nx+F.s*nz,nz:-F.s*nx+F.c*nz,w,h,tags});
}
export function civicDeck(target,F,{id,x=0,y=0,z=0,w,d}){
 if(!target)return;const p=F.p(x,y,z);target.decks.push({id,x:p.x,y:p.y,z:p.z,yaw:F.yaw,w,d});
}
export function colonyArtRecords(surfaces,{seed=0,dust=true}={}){
 const out=[];
 for(const s of surfaces){
  if(!(s.w>.5&&s.h>.5))continue;
  const sid=hash32(seed,s.id),w=Math.min(s.w*.7,2.3),h=Math.min(s.h*.65,1.1);
  if(s.tags){const k=hash01(sid,'mural')<.35?'piece':'tag';let writer=sid%8192;
   if(k==='piece')writer-=writer%2;else if(writer%3===1)writer++;
   out.push({...s,id:s.id+':tag',face:{k,seed:writer},w,h,y:s.y+s.h*.55,wear:.16+hash01(sid,'wear')*.4});}
  if(hash01(sid,'scuff')<.7)out.push({...s,id:s.id+':wear',face:{k:'damage',tile:dust?2:1},w:Math.min(s.w*.55,1.5),h:Math.min(s.h*.3,.6),y:s.y+s.h*.22,wear:.2});
 }
 return out;
}
