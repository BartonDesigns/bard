import './workplace-preview.mjs';
import {loadPeopleAssets,buildPerson,personDNA} from '../src/people/body.js';
import {createMotion} from '../src/people/motion.js';
import {workActor,disposeWorkplaceProps} from '../src/people/workplace-life.js';
import {pauseWorkplaceRoutine} from '../src/people/workplace-routine.js';
const r=window.workplaceReview,people=[];let t=0,seen=new Set(),violations=0,moved=0;
async function populate(kind='office'){
 for(const p of people.splice(0)){disposeWorkplaceProps(p);p.P.root.removeFromParent();p.P.root.traverse(o=>o.geometry?.dispose());}
 if(kind==='mall')r.mall();else r.show(33);
 t=0;seen=new Set();violations=0;moved=0;
 const A=await loadPeopleAssets(),v=r.T.venue(r.camera.position,13),seats=v.areas.flatMap(a=>a.seats),primary=seats.find(s=>s.work?.role===(kind==='mall'?'shopper':'office worker'));
 const chosen=kind==='mall'?seats.filter(s=>s.work?.group===primary.work.group&&!s.work?.routineOnly):[primary,...seats.filter(s=>s.work?.role==='meeting colleague').slice(0,2)];
 for(let i=0;i<chosen.length;i++){
  const s=chosen[i],P=buildPerson(A,personDNA(500+i*17,{age:27+i,ctx:{place:kind==='mall'?'shop':'office',activity:'work'}}));
  const M=createMotion(P,()=>s.y,{constrain:pos=>P.workConstrain?.(pos)});M.place(s.x,s.y,s.z,s.heading);s.taken=true;
  const p={P,M,active:true,workSpot:s,start:{x:s.x,z:s.z}};people.push(p);r.scene.add(P.root);
 }
 const s=primary;r.camera.position.set(s.x+5,s.y+3,s.z+5);r.camera.lookAt(s.x,s.y+1,s.z);
 advance(.05);return snapshot();
}
function advance(seconds){
 for(let i=0;i<Math.round(seconds/.05);i++){
  t+=.05;
  for(const p of people){
   workActor(p,t,.05,r.camera.position,people);p.M.update(.05,t,r.camera.position);
   seen.add(p.workContext?.activity);moved=Math.max(moved,Math.hypot(p.M.S.pos.x-p.start.x,p.M.S.pos.z-p.start.z));
   if(!p.workSpot.navigation.clear(p.M.S.pos))violations++;
  }
 }
 r.renderer.render(r.scene,r.camera);return snapshot();
}
function snapshot(){return {time:t,activities:[...seen],violations,moved,actors:people.map(p=>({role:p.workContext,trips:p.workRoutine?.trip,walking:p.workWalking,position:p.M.S.pos.toArray(),stock:p.workRoutine?.home.commerce?.stock,sales:p.workRoutine?.home.commerce?.sales,budget:p.workBudget,bag:!!p.shoppingBag?.visible,nodes:p.workSpot.navigation.nodes}))};}
function interrupt(){const p=people[0],before=p.workRoutine.elapsed;p.engaged=true;pauseWorkplaceRoutine(p);advance(2);if(p.workRoutine.elapsed!==before)throw Error('Routine advanced during conversation');p.engaged=false;return {before,after:p.workRoutine.elapsed};}
window.routineReview={populate,advance,snapshot,interrupt,people};window.ROUTINE_READY=true;
