import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommunityProjectContext, buildCommunityProjectMessages, decodeCommunityProjectIntent, offlineCommunityProjectIntent, livingScheduleIntent } from '../src/guide/community-project-intent.js';
import { communityProjectCards, projectScopeText, projectEta, projectHistoryLines, communityProjectFacts } from '../src/guide/community-project-view.js';
const context={bodyKey:'earth',scopeKey:'earth:coast',candidates:[{id:'coast',name:'Coastal clearing',kinds:['path','garden','gathering','resonance'],npcName:'Mara'}],projects:[]};
const proposal=(kind='garden',candidateId='coast')=>({intent:'propose',confidence:.98,candidateId,projectKind:kind,question:null});
test('natural project requests resolve actual sites without executing a mutation',()=>{
	for(const [text,kind] of [['Could we restore this garden?','garden'],['I want to mark a coastal path','path'],["Let's create a meeting place for our neighbours",'gathering'],['Can we build musical stones here?','resonance']]){
		const intent=offlineCommunityProjectIntent(text,context);assert.equal(intent.kind,'propose');assert.equal(intent.projectKind,kind);assert.equal(intent.candidateId,'coast');assert.equal(intent.confirmed,undefined);
	}
	assert.equal(decodeCommunityProjectIntent(proposal(),{context,text:'Could we bring this neglected plot back to life?'}).kind,'propose');
});
test('ambiguous projects, absent sites and unsupported improvements require clarification',()=>{
	assert.equal(offlineCommunityProjectIntent('Can we build a garden and a path?',context).kind,'clarify');
	assert.equal(offlineCommunityProjectIntent('Could we build a garden?',{...context,candidates:[...context.candidates,{id:'park',name:'Park',kinds:['garden']}]}).kind,'clarify');
	assert.equal(offlineCommunityProjectIntent('Can we restore the garden?',{...context,candidates:[]}).kind,'clarify');
	assert.equal(decodeCommunityProjectIntent(proposal('garden','invented'),{context,text:'Can we restore the garden?'}).kind,'clarify');
	assert.equal(decodeCommunityProjectIntent(proposal(),{context:{...context,candidates:[{id:'coast',name:'Coast',kinds:['path']}]},text:'Can we restore the garden?'}).kind,'clarify');
	assert.equal(offlineCommunityProjectIntent('Can I buy a rifle?',context).kind,'none');
});
test('negation, quoted speech, low confidence, unknown fields and invented commands fail closed',()=>{
	for(const text of ["Don't build a garden",'Do not restore this garden','Imagine we made a garden','She said "build a path"'])assert.equal(decodeCommunityProjectIntent(proposal(),{context,text}).kind,'none',text);
	for(const raw of [{...proposal(),intent:'complete'}, {...proposal(),spend:1000}, {...proposal(),projectKind:'castle'}, {...proposal(),confidence:NaN}, 'not json'])assert.equal(decodeCommunityProjectIntent(raw,{context,text:'Build a garden'}).kind,'none');
	assert.equal(decodeCommunityProjectIntent({...proposal(),confidence:.89},{context,text:'Build a garden'}).kind,'clarify');
	assert.equal(decodeCommunityProjectIntent({...proposal(),intent:'status'},{context,text:'How is our project?'}).kind,'none');
});
test('bounded planner context excludes raw coordinates, ownership, credentials and arbitrary instructions',()=>{
	const c=buildCommunityProjectContext({context:{...context,credentials:'secret',candidates:[{...context.candidates[0],instructions:'evil',anchor:{x:7,z:8}},...Array.from({length:30},(_,i)=>({id:'x'+i,name:'n',kinds:['garden','invalid']}))]},text:'x'.repeat(3000),history:[{role:'system',content:'hidden'},{role:'user',content:'x'.repeat(300)}]});
	assert.equal(c.candidates.length,12);assert.equal(c.playerRequest.length,1600);assert.equal(c.recentDialogue.length,1);assert.equal(c.recentDialogue[0].content.length,220);
	assert.equal(JSON.stringify(c).includes('secret'),false);assert.equal(JSON.stringify(c).includes('anchor'),false);assert.equal(JSON.stringify(c).includes('evil'),false);
	assert.equal(buildCommunityProjectMessages({context,text:'Build a path'}).length,2);
});
const choices=[{id:'priority',effect:'prioritize',label:'Make this a priority'},{id:'defer',effect:'defer',label:'Wait for a safer moment'},{id:'resume',effect:'resume',label:'Resume the work'}];
const activity={id:'kit',title:'Recover the survey kit',npcId:'npc:122',canIntervene:true,choices};
test('scheduling language selects a real request and choice belonging to the addressed person',()=>{
	for(const [text,effect] of [['Could you make this a priority?','prioritize'],['Could you hold off until later?','defer'],['Please pick it back up','resume']]){const r=livingScheduleIntent(text,{activities:[activity]},'npc:122');assert.equal(r.effect,effect);assert.equal(r.requestId,'kit');}
	assert.equal(livingScheduleIntent('Please resume it',{activities:[activity]},'npc:9').kind,'clarify');
	assert.equal(livingScheduleIntent('Please resume it',{activities:[activity,{...activity,id:'other',title:'Find a wallet'}]},'npc:122').kind,'clarify');
	assert.equal(livingScheduleIntent('Resume recover the survey kit',{activities:[activity,{...activity,id:'other',title:'Find a wallet'}]},'npc:122').requestId,'kit');
	assert.equal(livingScheduleIntent("Don't resume it",{activities:[activity]},'npc:122').kind,'none');
	assert.equal(livingScheduleIntent('Resume it then pause it',{activities:[activity]},'npc:122').kind,'clarify');
	assert.equal(livingScheduleIntent('Scout nearby',{activities:[activity]},'npc:122').kind,'none');
});
test('project cards explain real progress, pending propagation, danger and save scope',()=>{
	const cards=communityProjectCards({projects:[{id:'garden',kind:'garden',siteName:'Coastal clearing',stage:'queued',progress:{survey:1,work:3},contributors:[{name:'Mara'},{name:'You'}],readyAt:1000+86400000,danger:'Aftershocks nearby.'}]},1000);
	assert.match(cards[0].line,/Survey 1\/1 · Work 3\/3/);assert.match(cards[0].line,/2 contributors · Mara, You/);assert.match(cards[0].line,/24 hours/);assert.equal(cards[0].paused,true);assert.equal(cards[0].done,false);
	assert.match(projectScopeText({mode:'local',scope:{name:'The Moon'}}),/Saved on this device/);assert.match(projectScopeText({mode:'shared'}),/Shared with other players/);assert.match(projectScopeText({mode:'offline'}),/Reconnect/);
	assert.equal(projectEta(10,20),'Ready for the next world update.');
	const many={projects:Array.from({length:18},(_,i)=>({id:'p'+i,kind:'path',status:'completed'})),active:{projectId:'p17',kind:'work'}};
	assert.equal(communityProjectCards(many)[0].id,'p17');assert.equal(communityProjectCards(many,0,12).length,6);
});
test('NPC facts distinguish unfinished, completed, local and cached shared improvements without exposing account IDs',()=>{
	const projects=[{id:'p',kind:'garden',name:'Coast',status:'building',surveyCount:1,workCount:3,contributors:[{actorId:'secret-soul-hash'}]}];
	assert.match(communityProjectFacts({mode:'local',projects})[0],/Local record on this device/);
	assert.match(communityProjectFacts({mode:'shared',projects})[0],/still taking shape, not yet complete/);
	projects[0].status='completed';assert.match(communityProjectFacts({mode:'offline',projects})[0],/Last saved shared record; currently offline/);
	assert.match(communityProjectFacts({mode:'shared',projects})[0],/Completed and present/);
	assert.equal(JSON.stringify(communityProjectFacts({mode:'shared',projects})).includes('secret-soul-hash'),false);
	assert.doesNotMatch(communityProjectCards({projects})[0].line,/Expected in/);
	assert.match(communityProjectCards({projects})[0].line,/A traveller/);
});
test('typed project history names public participants, dates and actual events',()=>{
	const lines=projectHistoryLines({npcId:'npc:3',npcName:'Mara',history:[{type:'project-proposed',actorId:'player',at:1791997200000},{type:'project-contribution',actorId:'npc:3',kind:'work',at:1791997230000},{type:'project-contribution',actorId:'secret-soul-hash',kind:'service',at:1791997260000},{type:'project-building',at:1791997260000},{type:'project-paused',reason:'local-emergency',at:1791997270000},{type:'project-completed',at:1792083660000}]});
	assert.equal(lines.length,6);assert.match(lines[0],/You proposed/);assert.match(lines[1],/Mara contributed a work session/);assert.match(lines[2],/A traveller contributed a completed local job/);assert.match(lines[4],/local emergency/);assert.equal(lines.some(line=>line.includes('secret-soul-hash')),false);assert.match(lines[5],/now part of the world/);
});
