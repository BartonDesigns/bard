// Production character, fit-out, and activity render fixture. No substitute meshes.
import './workplace-preview.mjs';
import * as THREE from 'three';
import {loadPeopleAssets,buildPerson,personDNA} from '../src/people/body.js';
import {createMotion} from '../src/people/motion.js';
import {workActor,disposeWorkplaceProps,workplaceActivity} from '../src/people/workplace-life.js';
const r=window.workplaceReview, people=[];let t=0;
async function populate(kind='office'){
 for(const p of people.splice(0)){disposeWorkplaceProps(p);p.P.root.removeFromParent();p.P.root.traverse(o=>o.geometry?.dispose());}
 if(kind==='mall')r.mall();else r.show(33);
 const A=await loadPeopleAssets(),v=r.T.venue(r.camera.position,13),seats=v?.areas.flatMap(a=>a.seats).filter(s=>s.work)||[];
 const roles=kind==='mall'?['vendor','shopper']:['office worker','meeting colleague'];
 const primary=seats.find(s=>s.work.role===roles.at(-1));
 const chosen=kind==='mall'?seats.filter(s=>s.work.group===primary?.work.group):[...seats.filter(s=>s.work.role==='meeting colleague').slice(0,4),...seats.filter(s=>s.work.role==='office worker').slice(0,5)];
 for(let i=0;i<chosen.length;i++){const s=chosen[i],d=personDNA(500+i*17,{age:27+i,ctx:{place:kind==='mall'?'shop':'office',activity:'work'}}),P=buildPerson(A,d),M=createMotion(P,()=>s.y);M.place(s.x,s.y,s.z,s.heading);const p={P,M,active:true,workSpot:s};people.push(p);r.scene.add(P.root);}
 const a=chosen[0];if(a){r.camera.position.set(a.x+4.2,a.y+2.15,a.z+4.5);r.camera.lookAt(a.x,a.y+1.05,a.z);}
 tick(0,120);return {roles:people.map(p=>p.workContext),targets:r.T.questTargets(),venue:v.zone};
}
function tick(time=0,frames=1){t=time;for(let i=0;i<frames;i++){for(const p of people){workActor(p,t,.016,r.camera.position,people);p.M.update(.016,t,r.camera.position);}}r.renderer.render(r.scene,r.camera);return people.map(p=>({role:p.workContext,pose:p.M.S.pose,bag:!!p.shoppingBag?.visible,sales:p.workSpot.commerce?.sales,stock:p.workSpot.commerce?.stock}));}
function state(wanted){for(let i=0;i<400;i++)if(people.some(p=>workplaceActivity(p.workSpot.work,i).activity===wanted))return tick(i,160);throw Error('Missing activity '+wanted);}
window.cityLifeReview={populate,tick,state,people};window.CITY_LIFE_READY=true;
