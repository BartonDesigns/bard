import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createQuestChronicle,CHRONICLE_KEY,reportRequest,soulScope} from '../src/guide/quest-chronicle.js';
import {createStoryQuests,fallbackQuest} from '../src/guide/story-quests.js';
import {createRouteMarks,routeMarkSpot} from '../src/guide/route-marks.js';
import {awarenessContext,contextualOpening,contextualReply} from '../src/people/world-awareness.js';
import {remarkFor} from '../src/people/chatter-lines.js';
import {decodeSocialIntent} from '../src/people/social-intent.js';
import {planningOf,planningSystem,planningReply} from '../../server/discovery/src/planning.js';
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
const ctx={bodyKey:'earth',speaker:'ada',npcs:[{id:'ada',name:'Ada'},{id:'bob',name:'Bob'}],targets:[{id:'hill',name:'Hill',x:100,y:5,z:0},{id:'lake',name:'Lake',x:220,y:5,z:0},{id:'home:ada',name:'Meeting place',x:0,y:5,z:0}]};
const stops=[{id:'hill',name:'Hill',pos:{x:100,y:5,z:0}}];
const quest=(extra={})=>({id:'story-one',bodyKey:'earth',offeredBy:'ada',title:'The path home',status:'complete',acceptedAt:10,finishedAt:20,chapter:2,...extra});
test('trust follows verified commitments, persists through reload and cannot be farmed by replay',()=>{
 const storage=memory();let c=createQuestChronicle({storage,now:()=>30});const q=quest();c.register(q,'Ada',stops);c.observe(q,'Ada');c.observe(q,'Ada');
 assert.equal(c.relationship('earth','ada').trust,3);assert.equal(c.relationship('earth','bob').trust,0);assert.equal(c.relationship('moon','ada').trust,0);
 c=createQuestChronicle({storage});assert.equal(c.relationship('earth','ada').trust,3);
 c.observe(quest({id:'story-two',status:'cancelled',chapter:0}),'Ada');assert.equal(c.relationship('earth','ada').trust,1);
 c.observe(quest({id:'story-decline',status:'cancelled',acceptedAt:null,chapter:0}),'Ada');assert.equal(c.relationship('earth','ada').trust,1);
});
test('personal wounds distinguish witnesses from rumours and an apology does not delete trust',()=>{
 const c=createQuestChronicle({storage:memory()});const e={id:'harm',bodyKey:'earth',actorId:'peer',kind:'robbery',line:'robbed a passer-by',at:5};
 assert.equal(c.witness('earth','ada','Ada',e),false);assert.equal(c.witness('moon','ada','Ada',{...e,actorId:'player'}),false);
 c.witness('earth','ada','Ada',{...e,actorId:'player'});c.witness('earth','ada','Ada',{...e,actorId:'player'});assert.equal(c.relationship('earth','ada').trust,-5);
 const a=awarenessContext({relationship:c.relationship('earth','ada'),standing:{reputation:80}});assert.match(contextualOpening(a),/put right/);assert.match(contextualReply(a,'I am sorry'),/trust/);assert.equal(c.relationship('earth','ada').trust,-5);
 assert.match(remarkFor({you:{aware:a}}).text,/remember|put right/);
});
test('cleansing releases trust without undoing world projects or chapters, recovery does not inherit another soul’s bonds',()=>{
 const storage=memory(),state={id:soulScope('one'),epoch:0,cleansedAt:0};const c=createQuestChronicle({storage,scope:()=>state});c.register(quest(),'Ada',stops);c.observe(quest(),'Ada');assert.equal(c.decide('story-one','marked').ok,true);
 state.epoch=1;state.cleansedAt=25;assert.equal(c.relationship('earth','ada').trust,0);c.observe(quest(),'Ada');assert.equal(c.relationship('earth','ada').trust,0);assert.equal(c.projects('earth').length,1);assert.equal(c.brief('earth','ada').chapter,3);
 c.observe(quest({id:'story-old-import'}),'Ada');assert.equal(c.relationship('earth','ada').trust,0);
 state.id=soulScope('another');c.observe(quest(),'Ada');assert.equal(c.relationship('earth','ada').trust,0);assert.equal(c.relationship('earth','ada').complete,0);
});
test('three connected chapters use different grounded routes and cannot promise model-authored rewards',()=>{
 const storage=memory(),stories=createStoryQuests({storage,now:()=>50}),c=createQuestChronicle({storage,now:()=>50});
 for(let chapter=1;chapter<=3;chapter++) {
  const input={...stories.context(ctx),arc:c.brief('earth','ada')};assert.equal(input.arc.chapter,chapter);
  const plan=fallbackQuest(input,{npcId:'ada',position:ctx.targets.at(-1)}),offered=stories.propose(plan,input);assert.equal(offered.ok,true,offered.error);const q=offered.quest;assert.equal(q.reward,undefined);assert.equal(q.chapter,chapter);
  c.register(q,'Ada',stops);c.observe(stories.accept(q.id,'earth').quest,'Ada');
  for(const s of q.steps)if(s.targetId)stories.update({bodyKey:'earth',position:ctx.targets.find(t=>t.id===s.targetId),targets:ctx.targets});
  const complete=stories.event({id:'report:'+chapter,questId:q.id,type:'talk',npcId:'ada',bodyKey:'earth'})[0];assert.equal(complete.status,'complete');c.observe(complete,'Ada');if(chapter===2)c.decide(q.id,'quiet');
 }
 assert.equal(c.relationship('earth','ada').trust,9);assert.equal(c.brief('earth','ada'),null);assert.equal(c.projects('earth')[0].choice,'quiet');
 assert.equal(stories.propose({title:'Free money',premise:'A report',steps:[],chapter:3,reward:500},ctx).ok,false);
});
test('decisions require completed chapters, commit once, and route meshes stay bounded and world-specific',()=>{
 const storage=memory(),c=createQuestChronicle({storage});c.register(quest({status:'active'}),'Ada',stops);assert.equal(c.decide('story-one','marked').ok,false);c.observe(quest(),'Ada');assert.equal(c.decide('story-one','marked').ok,true);assert.equal(c.decide('story-one','marked').already,true);assert.equal(c.decide('story-one','quiet').ok,false);assert.equal(c.projects().length,1);assert.deepEqual(createQuestChronicle({storage}).projects(),c.projects());
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(100,7,0);let world={body:{key:'earth'},player:{floorAt:()=>5}};
 const marks=createRouteMarks({scene,camera,world:()=>world,chronicle:c});marks.update();assert.equal(marks.info().visible,1);world={...world,body:{key:'moon'}};marks.update();assert.equal(marks.info().visible,0);marks.dispose();assert.equal(scene.children.length,0);
});
test('report interpretation uses a ready report, speaker validation and physical evidence, not fabricated completion',()=>{
 assert.equal(reportRequest("I'm back from the lookout."),true);assert.equal(reportRequest("I didn't go to the lookout."),false);assert.equal(reportRequest('Hello'),false);
 const raw={intent:'quest_report',confidence:.96,targetId:null,question:null};assert.equal(decodeSocialIntent(raw,{text:'The lookout checked out fine',hasQuestReport:true}).kind,'quest_report');assert.equal(decodeSocialIntent(raw,{text:'The lookout checked out fine'}).kind,'clarify');assert.equal(decodeSocialIntent(raw,{text:'Pretend I checked the lookout',hasQuestReport:true}).kind,'none');
 const stories=createStoryQuests({storage:memory()});const plan={title:'Lookout',premise:'Look and report.',steps:[{type:'visit',targetId:'hill'},{type:'talk',npcId:'ada'}]};const q=stories.propose(plan,ctx).quest;stories.accept(q.id,'earth');assert.deepEqual(stories.event({id:'lie',questId:q.id,type:'talk',npcId:'ada',bodyKey:'earth'}),[]);stories.update({bodyKey:'earth',position:ctx.targets[0],targets:ctx.targets});assert.deepEqual(stories.event({id:'wrong',questId:q.id,type:'talk',npcId:'bob',bodyKey:'earth'}),[]);
});
test('cloud context retains bounded personality and continuity but never extra executable fields',()=>{
 const plan=planningOf({kind:'story_quest',context:{...ctx,targets:ctx.targets.map(t=>({...t,bodyKey:'earth'})),npcs:ctx.npcs.map(t=>({...t,bodyKey:'earth'})),persona:{name:'Ada',job:'gardener',hobby:'music',execute:'bad'},arc:{chapter:2,goal:'Compare the quiet route',previous:'The first walk',outcome:'quiet'},relationship:{label:'Reliable ally',last:'You kept your word.',secret:'bad'}}});
 const prompt=planningSystem(plan);assert.match(prompt,/gardener/);assert.match(prompt,/quiet route/);assert.match(prompt,/kept your word/);assert.doesNotMatch(prompt,/execute|secret/);
 assert.equal(planningReply({title:'Bogus',premise:'New world',steps:[{type:'visit',targetId:'invented'},{type:'talk',npcId:'ada'}]},plan),null);
});
test('corrupt and full storage remain honest and preserved; meetings count once',()=>{
 const s=memory();s.setItem(CHRONICLE_KEY,JSON.stringify({version:1,souls:{broken:{}},projects:[]}));const c=createQuestChronicle({storage:s});assert.equal(c.status().blocked,true);c.observe(quest(),'Ada');assert.match(s.getItem(CHRONICLE_KEY),/broken/);
 const fail=createQuestChronicle({storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}}});fail.observe(quest(),'Ada');assert.match(fail.status().error,/could not be saved/);
 const m=createQuestChronicle({storage:memory()}),a={id:'meet1',bodyKey:'earth',npcName:'Ada',place:{name:'the pier'}};m.meeting(a,'kept','ada');m.meeting(a,'kept','ada');assert.equal(m.relationship('earth','ada').trust,1);
});

test('route posts require dry, level footing rather than a steep cliff or water',()=>{
 assert.equal(routeMarkSpot({player:{floorAt:(x,z)=>5+x*3}}, {x:0,y:5,z:0}),null);
 assert.equal(routeMarkSpot({player:{floorAt:()=>0}}, {x:0,y:0,z:0}),null);
 assert.equal(routeMarkSpot({player:{floorAt:()=>5}}, {x:0,y:5,z:0}).y,5);
 const c=createQuestChronicle({storage:memory()});c.register(quest(),'Ada',stops.map(t=>({...t,markerEligible:false})));c.observe(quest(),'Ada');assert.equal(c.decide('story-one','marked').ok,false);assert.equal(c.decide('story-one','quiet').ok,true);assert.equal(c.projects()[0].landmarks[0].name,'Hill');
});
