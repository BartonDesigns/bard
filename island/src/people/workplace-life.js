import {stepWorkplaceRoutine,releaseWorkplaceRoutine,settleWorkplaceSale} from './workplace-routine.js';
import * as THREE from 'three';
import {attachBag} from './bags.js';
import {payroll} from '../economy/payroll.js';
// who someone is to the payroll (economy/payroll.js): their seed, as the rest of the town knows them
export const npcIdOf=p=>'npc:'+(p.P.dna.seed>>>0);
const hash=s=>{let h=0;for(const c of String(s))h=Math.imul(h,31)+c.charCodeAt(0)|0;return h>>>0;};
// Shared scene clock synchronizes the two sides of a negotiation or project review.
// other workplaces' roles (services/roles.js: doctors, nurses, officers, firefighters):
// role -> (meta, phase 0..64, cycle, partnered) -> { activity, pose, talk, gesture, line }
export const WORK_ROLES={};
export function workplaceActivity(meta,t,hasPartner=true) {
 const h=hash(meta.group || meta.program), clock=t+(meta.sceneClock?0:h%31), cycle=meta.sceneNumber??Math.floor(clock/64), phase=clock%64, side=meta.side||0;
 if(WORK_ROLES[meta.role])return WORK_ROLES[meta.role](meta,phase,cycle,hasPartner);
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
 if(meta.role==='refreshment')return {activity:'taking a refreshment break',pose:'rest',talk:false};
 if(meta.role==='browse')return {activity:'comparing items on display',pose:'read',talk:false};
 if(meta.role==='stock check')return {activity:'checking shelf stock',pose:'read',talk:false};
 if(meta.role==='office worker') return phase<40?{activity:'typing at a workstation',pose:'type',talk:false}:phase<50?{activity:'reviewing documents',pose:'read',talk:false}:{activity:'taking a short break',pose:'lap',talk:false};
 return {activity:'taking a break',pose:meta.sit?'lap':'rest',talk:false};
}
export function disposeWorkplaceProps(p) {
 releaseWorkplaceRoutine(p);p.workBudget=null;p.workPurchases=0;
 for(const key of ['workBubble','shoppingBag']){const o=p[key];if(o){o.removeFromParent();if(!o.geometry?.userData.shared)o.geometry?.dispose();if(!o.material?.userData.shared){o.material?.map?.dispose();o.material?.dispose();}p[key]=null;}}
}
function bubble(p,text) {
 if(p.workBubble?.userData.text===text) return;
 if(!p.workBubble){const cv=document.createElement('canvas');cv.width=768;cv.height=160;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});const o=p.workBubble=new THREE.Sprite(mat);o.scale.set(3.2,.67,1);o.position.set(0,p.P.height+.45,0);p.P.root.add(o);}
 const o=p.workBubble,cv=o.material.map.image,g=cv.getContext('2d');g.clearRect(0,0,768,160);g.fillStyle='rgba(12,23,29,.88)';g.fillRect(4,4,760,152);g.font='28px sans-serif';g.fillStyle='#f5f0e3';g.textAlign='center';const words=text.split(' ');let rows=[],line='';for(const w of words){if(g.measureText(line+w).width>710){rows.push(line);line='';}line+=w+' ';}rows.push(line);rows.slice(0,3).forEach((r,i)=>g.fillText(r,384,45+i*38));o.material.map.needsUpdate=true;o.userData.text=text;
}
export function workActor(p,t,dt,cam,actors=[]) {
 if(!p.engaged && !p.P.ragdoll && stepWorkplaceRoutine(p,dt,actors,cam))return true;
 const st=p.workSpot, meta=st?.work;
 if(!meta || p.engaged || p.P.ragdoll) {if(p.workBubble)p.workBubble.visible=false;return false;}
 const partner=actors.find(a=>a!==p && a.active && !a.engaged && !a.override && !a.workWalking && !a.P.ragdoll && a.workSpot?.work?.group===meta.group && (!['vendor','shopper'].includes(meta.role)||a.workSpot.work.role===(meta.role==='vendor'?'shopper':'vendor')) && Math.abs(a.M.S.pos.y-p.M.S.pos.y)<2 && Math.hypot(a.M.S.pos.x-p.M.S.pos.x,a.M.S.pos.z-p.M.S.pos.z)<4 && Math.hypot(a.M.S.pos.x-a.workSpot.x,a.M.S.pos.z-a.workSpot.z)<.3);
 let clock=meta.role==='meeting colleague'?t:p.workRoutine?.elapsed??t;
 const retail=meta.role==='vendor'||meta.role==='shopper',customer=meta.role==='shopper'?p:partner?.workSpot?.work?.role==='shopper'?partner:null;
 const paired=!!partner && (!retail || (customer && (meta.role==='vendor'||partner.workSpot.work.role==='vendor')));
 if(retail && st.commerce){
  const c=st.commerce;
  if(meta.role==='shopper' && paired){
   if(c.customer!==p){c.customer=p;c.sceneTime=0;c.scene=(c.scene||0)+1;}
   c.sceneTime=Math.min(63,(c.sceneTime||0)+Math.max(0,Math.min(.05,dt)));
  }
  clock=c.sceneTime||0;
 }
 let a=workplaceActivity(retail?{...meta,sceneClock:true,sceneNumber:st.commerce?.scene||0}:meta,clock,paired); const M=p.M;
 if(retail && st.commerce && (a.sale!==undefined || a.activity==='purchase complete')){
  const receipt=st.work.group+':'+st.commerce.scene;
  if(st.commerce.lastReceipt!==receipt && meta.role==='shopper' && paired && settleWorkplaceSale(st.commerce,p,receipt))payroll.sale(st,12,partner?npcIdOf(partner):null);
  if(st.commerce.lastReceipt!==receipt)a={activity:st.commerce.stock<=0?'checking sold-out stock':'declining a purchase',pose:'listen',talk:meta.role==='vendor',line:st.commerce.stock<=0?'That one has sold out. Let me check the next delivery.':'No problem. Take your time and have a look around.'};
 }
 if(meta.role==='vendor' && paired && st.commerce?.sceneTime<45 && p.workRoutine)p.workRoutine.wait=Math.max(2,p.workRoutine.wait);
 if(retail && st.commerce?.sceneTime>=45 && p.workRoutine){p.workRoutine.wait=Math.min(p.workRoutine.wait,2);}
 p.workContext={role:meta.role,program:meta.program,floor:meta.floor,activity:a.activity};
 // paid for turning up, and a little for each stretch of station work (economy/payroll.js)
 if(meta.role!=='shopper'&&meta.role!=='browse'){const id=npcIdOf(p);payroll.clockIn(id,st,meta.role);if(p.lastWorkAct==='typing at a workstation'&&a.activity!==p.lastWorkAct)payroll.taskDone(id,'station',st);p.lastWorkAct=a.activity;}
 M.want.speed=0;M.want.heading=st.heading;M.S.look.target=null;M.setPose(a.pose);M.S.talk=a.talk?1:0;
 if(st.sit)M.sit(st.h);else M.stand();
 p.workGestureT=(p.workGestureT||0)-dt;if(p.workGestureT<=0){p.workGestureT=3.2+(p.P.dna.seed%9)*.1;if(a.gesture)M.gesture(a.gesture);M.feel('anger',a.anger||0);}
 if((a.bag && p.workPurchases>0) && !p.shoppingBag)p.shoppingBag=attachBag(p.P,{q:{kind:'shopper',paper:true,col:'#b08a5e'},bag:{kind:'paper',v:(p.P.dna.seed>>>0)%3},hand:'R',k:1,straps:[]}).mesh; // a paper bag of what they bought, in the other hand (bags.js)
 if(p.shoppingBag)p.shoppingBag.visible=p.workPurchases>0;
 const audible=actors.filter(q=>q.active && q.workSpot?.work && Math.abs(q.M.S.pos.y-cam.y)<4).sort((a,b)=>Math.hypot(a.M.S.pos.x-cam.x,a.M.S.pos.z-cam.z)-Math.hypot(b.M.S.pos.x-cam.x,b.M.S.pos.z-cam.z)).slice(0,2).includes(p);
 if(audible && a.talk && a.line && Math.hypot(cam.x-M.S.pos.x,cam.z-M.S.pos.z)<9 && Math.abs(cam.y-M.S.pos.y)<4){bubble(p,a.line);p.workBubble.visible=true;}else if(p.workBubble)p.workBubble.visible=false;
 return true;
}
