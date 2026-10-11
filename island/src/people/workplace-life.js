import * as THREE from 'three';
const hash=s=>{let h=0;for(const c of String(s))h=Math.imul(h,31)+c.charCodeAt(0)|0;return h>>>0;};
// Shared scene clock synchronizes the two sides of a negotiation or project review.
export function workplaceActivity(meta,t,hasPartner=true) {
 const h=hash(meta.group || meta.program), cycle=Math.floor((t+h%31)/64), phase=(t+h%31)%64, side=meta.side||0;
 if(meta.role==='vendor'||meta.role==='shopper') {
  if(!hasPartner) return {activity:meta.role==='vendor'?'checking stock':'browsing',pose:meta.role==='vendor'?'read':'rest',talk:false};
  if(phase<13) return {activity:'browsing',pose:'rest',talk:false};
  if(phase<35){const talk=(Math.floor(phase/4)%2)===(meta.role==='vendor'?1:0);return {activity:'negotiating a price',pose:talk?'rest':'listen',gesture:talk?'explain':'shake',talk,line:meta.role==='vendor'?['That is the marked price. I can do a small bundle discount.','For two, I can make a better offer.'][cycle%2]:['Could you do a better price for the pair?','I saw a similar one for less. What can you offer?'][cycle%2]};}
  if(phase<45)return {activity:'buying',pose:'table',gesture:'nod',talk:meta.role==='shopper',line:'All right, we have a deal. Thank you.',sale:cycle,bag:meta.role==='shopper'};
  return {activity:'purchase complete',pose:'rest',talk:false,bag:meta.role==='shopper'};
 }
 if(meta.role==='meeting colleague') {
  const dispute=cycle%4===1 && phase>8 && phase<32;
  const talk=hasPartner && Math.floor(phase/4)%2===side;
  return {activity:dispute?'dispute':'project review',pose:talk?'table':'listen',talk,gesture:dispute?(talk?'emphatic':'shake'):(talk?'explain':'nod'),anger:dispute?.7:0,line:dispute?(side?'WE CANNOT PROMISE THAT DEADLINE!':'Then let’s agree on a schedule we can actually meet.'):(side?'Let’s check the figures before the client call.':'I’ll take the next action. Who is checking the estimate?')};
 }
 if(meta.role==='office worker') return phase<40?{activity:'typing at a workstation',pose:'type',talk:false}:phase<50?{activity:'reviewing documents',pose:'read',talk:false}:{activity:'taking a short break',pose:'lap',talk:false};
 return {activity:'taking a break',pose:meta.sit?'lap':'rest',talk:false};
}
export function disposeWorkplaceProps(p) {
 for(const key of ['workBubble','shoppingBag']){const o=p[key];if(o){o.removeFromParent();o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();p[key]=null;}}
}
function bubble(p,text) {
 if(p.workBubble?.userData.text===text) return;
 if(!p.workBubble){const cv=document.createElement('canvas');cv.width=768;cv.height=160;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});const o=p.workBubble=new THREE.Sprite(mat);o.scale.set(3.2,.67,1);o.position.set(0,p.P.height+.45,0);p.P.root.add(o);}
 const o=p.workBubble,cv=o.material.map.image,g=cv.getContext('2d');g.clearRect(0,0,768,160);g.fillStyle='rgba(12,23,29,.88)';g.fillRect(4,4,760,152);g.font='28px sans-serif';g.fillStyle='#f5f0e3';g.textAlign='center';const words=text.split(' ');let rows=[],line='';for(const w of words){if(g.measureText(line+w).width>710){rows.push(line);line='';}line+=w+' ';}rows.push(line);rows.slice(0,3).forEach((r,i)=>g.fillText(r,384,45+i*38));o.material.map.needsUpdate=true;o.userData.text=text;
}
export function workActor(p,t,dt,cam,actors=[]) {
 const st=p.workSpot, meta=st?.work;
 if(!meta || p.engaged || p.P.ragdoll) {if(p.workBubble)p.workBubble.visible=false;return false;}
 const partner=actors.some(a=>a!==p && a.active && !a.engaged && !a.P.ragdoll && a.workSpot?.work?.group===meta.group && Math.abs(a.M.S.pos.y-p.M.S.pos.y)<2);
 let a=workplaceActivity(meta,t,partner); const M=p.M;
 if(st.commerce?.stock===0 && st.commerce.lastSale!==a.sale) a={activity:'checking sold-out stock',pose:'listen',talk:meta.role==='vendor',line:'That one has sold out. Let me check the next delivery.'};
 p.workContext={role:meta.role,program:meta.program,floor:meta.floor,activity:a.activity};
 M.want.speed=0;M.want.heading=st.heading;M.setPose(a.pose);M.S.talk=a.talk?1:0;
 if(st.sit)M.sit(st.h);else M.stand();
 p.workGestureT=(p.workGestureT||0)-dt;if(p.workGestureT<=0){p.workGestureT=3.2+(p.P.dna.seed%9)*.1;if(a.gesture)M.gesture(a.gesture);M.feel('anger',a.anger||0);}
 if(a.sale!==undefined && st.commerce && st.commerce.lastSale!==a.sale && st.commerce.stock>0){st.commerce.lastSale=a.sale;st.commerce.stock--;st.commerce.sales++;}
 if(a.bag && !p.shoppingBag){const geo=new THREE.BoxGeometry(.23,.3,.12,2,2,2),mat=new THREE.MeshStandardMaterial({color:0xb9976d,roughness:.9});const bag=p.shoppingBag=new THREE.Mesh(geo,mat);bag.position.set(-.32,.48,.1);p.P.root.add(bag);}
 if(p.shoppingBag)p.shoppingBag.visible=!!a.bag;
 const audible=actors.filter(q=>q.active && q.workSpot?.work && Math.abs(q.M.S.pos.y-cam.y)<4).sort((a,b)=>Math.hypot(a.M.S.pos.x-cam.x,a.M.S.pos.z-cam.z)-Math.hypot(b.M.S.pos.x-cam.x,b.M.S.pos.z-cam.z)).slice(0,2).includes(p);
 if(audible && a.talk && a.line && Math.hypot(cam.x-M.S.pos.x,cam.z-M.S.pos.z)<9 && Math.abs(cam.y-M.S.pos.y)<4){bubble(p,a.line);p.workBubble.visible=true;}else if(p.workBubble)p.workBubble.visible=false;
 return true;
}
