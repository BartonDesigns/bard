import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkplaceNavigation} from '../src/people/workplace-navigation.js';
import {stepWorkplaceRoutine,pauseWorkplaceRoutine,releaseWorkplaceRoutine,settleWorkplaceSale} from '../src/people/workplace-routine.js';
const nav=o=>createWorkplaceNavigation({width:20,depth:20,solids:[],...o});
test('route goes through the doorway, never walls or desk tops',()=>{
 const n=nav({solids:[[-.1,-10,.1,2,0,3],[-.1,4,.1,10,0,3],[2,1,4,3,0,.8]]}),a={x:-5,z:0},b={x:5,z:0},path=n.route(a,b);
 assert.ok(path?.length>1);let p=a;for(const q of path){assert.ok(n.segment(p,q));p=q;}
 assert.ok(path.some(p=>p.z>2));assert.deepEqual(path.at(-1),b);assert.ok(n.nodes<=25000);
});
test('sealed rooms fail safely and atrium voids cannot be crossed',()=>{
 assert.equal(nav({solids:[[-.1,-10,.1,10,0,3]]}).route({x:-2,z:0},{x:2,z:0}),null);
 const n=nav({holes:[{x0:-2,x1:2,z0:-3,z1:3}]}),a={x:-5,z:0},path=n.route(a,{x:5,z:0});assert.ok(path);let p=a;for(const q of path){assert.ok(n.segment(p,q));p=q;}assert.equal(n.clear({x:0,z:0}),false);
});
test('rotated buildings preserve safe world-space paths',()=>{
 const n=nav({solids:[[-1,-1,1,1,0,2]],toLocal:p=>({x:p.z-100,z:20-p.x}),toWorld:p=>({x:20-p.z,z:100+p.x})});
 const a={x:20,z:95},b={x:20,z:105};let p=a;for(const q of n.route(a,b)){assert.ok(n.segment(p,q));p=q;}assert.deepEqual(p,b);
});
function actor(seed=4){
 const n=nav(),home={x:-4,z:0,y:0,heading:0,work:{role:'office worker'},taken:true,navigation:n},target={x:4,z:0,y:0,heading:0,work:{role:'refreshment'},taken:false,navigation:n};n.spots=[home,target];
 const p={P:{dna:{seed}},active:true,workSpot:home,M:{S:{pos:{x:-4,y:0,z:0},sitK:{v:0},look:{target:null},heading:0,speed:{v:0,dv:0}},want:{},stand(){},setPose(){}}};
 return {p,home,target};
}
function tick(p,frames){for(let i=0;i<frames;i++){const moving=stepWorkplaceRoutine(p,.05,[p]);const M=p.M;if(!moving)M.want.speed=0;M.S.heading=M.want.heading||0;M.S.pos.x+=Math.sin(M.S.heading)*(M.want.speed||0)*.05;M.S.pos.z+=Math.cos(M.S.heading)*(M.want.speed||0)*.05;p.P.workConstrain?.(M.S.pos);}}
test('worker walks to break, reserves its station, and returns home',()=>{
 const {p,home,target}=actor();tick(p,1);p.workRoutine.wait=0;tick(p,300);assert.equal(p.workSpot,target);assert.equal(target.taken,true);assert.equal(home.taken,true);tick(p,1400);assert.ok(p.workRoutine.trip>=2);releaseWorkplaceRoutine(p);assert.equal(target.taken,false);assert.equal(p.P.workConstrain,null);
});
test('conversation suspension resumes from the actual displaced position',()=>{
 const {p}=actor();tick(p,1);p.workRoutine.wait=0;tick(p,50);const elapsed=p.workRoutine.elapsed;pauseWorkplaceRoutine(p);p.M.S.pos.z=2;assert.equal(p.workRoutine.elapsed,elapsed);tick(p,400);assert.ok(p.workSpot.work.role==='refreshment');
});
test('two workers cannot reserve the same break station',()=>{
 const {p,home,target}=actor(),{p:q}=actor(8);q.workSpot={...home,x:-3,taken:true};q.M.S.pos.x=-3;tick(p,1);tick(q,1);p.workRoutine.wait=q.workRoutine.wait=0;stepWorkplaceRoutine(p,.05,[p,q]);stepWorkplaceRoutine(q,.05,[p,q]);assert.equal(p.workRoutine.target,target);assert.notEqual(q.workRoutine.target,target);
});
test('transactions conserve stock and customer budget without duplicate payment',()=>{
 const c={stock:2,sales:0},p={P:{dna:{seed:0}}};assert.equal(settleWorkplaceSale(c,p,'one'),true);assert.equal(p.workBudget,24);assert.equal(settleWorkplaceSale(c,p,'one'),false);assert.equal(c.stock,1);assert.equal(settleWorkplaceSale(c,p,'two'),true);assert.equal(settleWorkplaceSale(c,p,'three'),false);assert.equal(c.revenue,24);assert.equal(p.workPurchases,2);
});
test('unaffordable goods leave all ledger values unchanged',()=>{
 const c={stock:4,sales:0},p={P:{dna:{seed:0}},workBudget:3};assert.equal(settleWorkplaceSale(c,p,'one'),false);assert.equal(c.stock,4);assert.equal(c.sales,0);assert.equal(p.workBudget,3);
});
import {workActor} from '../src/people/workplace-life.js';
test('checkout finds the customer despite another worker beside the till, and pauses when engaged',()=>{
 const commerce={stock:3,sales:0,scene:0,sceneTime:0};
 function person(role,x){return {active:true,P:{dna:{seed:1},height:1.8,root:{add(){}}},workSpot:{x,y:0,z:0,heading:0,work:{role,group:'shop'},commerce},M:{S:{pos:{x,y:0,z:0},look:{}},want:{},stand(){},sit(){},setPose(){},gesture(){},feel(){}}};}
 const vendor=person('vendor',0),customer=person('shopper',2),bystander=person('stock check',1),actors=[bystander,vendor,customer],cam={x:100,y:2,z:100};
 customer.engaged=true;for(let i=0;i<800;i++)for(const p of actors)workActor(p,i*.05,.05,cam,actors);assert.equal(commerce.sales,0);
 customer.engaged=false;for(let i=0;i<800;i++)for(const p of actors)workActor(p,i*.05,.05,cam,actors);
 assert.equal(commerce.sales,1);assert.equal(commerce.stock,2);assert.equal(customer.workBudget,36);assert.equal(customer.shoppingBag.visible,true);
});
