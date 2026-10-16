import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNegotiationContext, buildNegotiationMessages, decodeNegotiationIntent, offlineNegotiationIntent } from '../src/guide/negotiation-intent.js';
import { activityCards, activityScopeText, agreementTerms } from '../src/guide/living-activity-view.js';

const context = {sellerId:'rae',bodyKey:'earth',stock:[{id:'knife-1',name:'Knife',price:1000},{id:'shell-1',name:'Shell',price:12}],services:[{id:'lost-kit',label:'Bring back the missing survey kit'}]};
const raw = (intent, itemId = 'knife-1', amount = null, confidence = .97) => ({intent,itemId,amount,confidence,question:null});
const pending = {...context,pendingOffer:{id:'offer-1',itemId:'knife-1',itemName:'Knife',price:20,kind:'service',status:'quoted',condition:{label:'Bring back the missing survey kit'}}};

test('negotiation parses affordable counteroffers and real work requests without purchasing', () => {
	const lower=offlineNegotiationIntent("I don't want to pay $1000 for the knife. What can I do to pay $20?",context);
	assert.equal(lower.kind,'service');assert.equal(lower.amount,20);assert.equal(lower.itemId,'knife-1');assert.equal(lower.confirmed,undefined);
	assert.equal(offlineNegotiationIntent('Could you sell the knife cheaper?',context).kind,'bargain');
	assert.equal(offlineNegotiationIntent('Would my reputation earn a discount on the knife?',context).kind,'reputation');
	assert.equal(offlineNegotiationIntent('What does the shell cost?',context).kind,'quote');
});
test('model can resolve indirect economic language but only grounded items and stated amounts', () => {
	assert.equal(decodeNegotiationIntent(raw('bargain'),{context,text:'Could you go a little easier on my purse for that blade?'}).kind,'bargain');
	assert.equal(decodeNegotiationIntent(raw('service','knife-1',20),{context,text:'I can spare twenty if there is something I could do for you.'}).amount,20);
	assert.equal(decodeNegotiationIntent(raw('bargain','invented',20),{context,text:'Let me offer 20'}).kind,'clarify');
	assert.equal(decodeNegotiationIntent(raw('bargain','knife-1',20),{context,text:'Could you make it a bit cheaper?'}).reason,'invented-amount');
});
test('conversation agreement only reviews current terms; no existing offer cannot become consent', () => {
	assert.equal(offlineNegotiationIntent('Sounds good',pending).kind,'review');
	assert.equal(offlineNegotiationIntent('I accept',pending).kind,'review');
	assert.equal(offlineNegotiationIntent('Sounds good',context).kind,'none');
	assert.equal(decodeNegotiationIntent(raw('review',null),{context,text:'I accept'}).kind,'clarify');
	assert.equal(offlineNegotiationIntent('No thanks',pending).kind,'decline');
});
test('schema, uncertainty, refusal and quoted/hypothetical proposals cannot produce an exchange', () => {
	for(const bad of [null,[],{},'not json',{...raw('bargain'),execute:'transfer'},raw('buy'),raw('bargain','knife-1',Infinity),raw('bargain','knife-1',-20),{...raw('bargain'),confidence:'1'}])assert.equal(decodeNegotiationIntent(bad,{context,text:'Pay 20 for the knife'}).kind,'none');
	assert.equal(decodeNegotiationIntent(raw('bargain','knife-1',null,.85),{context,text:'A better deal?'}).kind,'clarify');
	for(const text of ['Imagine you sold me that knife for 20','He said "buy the knife"',"Don't buy the knife",'No deal'])assert.equal(decodeNegotiationIntent(raw('bargain','knife-1'),{context,text}).kind,'none',text);
	assert.equal(offlineNegotiationIntent('Could you follow me?',context).kind,'none');
});
test('ambiguous item selection asks rather than choosing a more expensive item', () => {
	assert.equal(offlineNegotiationIntent('What is the price?',context).kind,'clarify');
	assert.equal(offlineNegotiationIntent('Can I pay 20 for the knife and shell?',context).kind,'clarify');
	assert.equal(offlineNegotiationIntent('Can I pay 20 for it?',pending).itemId,'knife-1');
	assert.equal(offlineNegotiationIntent('Can I buy that spaceship?',{...context,stock:[context.stock[0]]}).kind,'clarify');
	assert.equal(offlineNegotiationIntent('Can I buy that spaceship?',pending).kind,'clarify');
	assert.equal(offlineNegotiationIntent('Could I pay 20 for the knife?',{...context,stock:[{id:'knife-1',name:'Field knife',price:1000}]}).itemId,'knife-1');
});
test('planner receives a bounded data snapshot and strips arbitrary seller instructions', () => {
	const c=buildNegotiationContext({context:{...context,secret:'not sent',stock:[...context.stock,...Array.from({length:40},(_,i)=>({id:'x'+i,name:'n'.repeat(500),price:12,code:'not sent'}))]},text:'a'.repeat(6000),history:Array.from({length:20},()=>({role:'user',content:'b'.repeat(1000)}))});
	assert.equal(c.stock.length,12);assert.equal(c.playerRequest.length,1600);assert.equal(c.recentDialogue.length,3);assert.equal(c.recentDialogue[0].content.length,220);assert.equal(JSON.stringify(c).includes('not sent'),false);
	assert.equal(buildNegotiationMessages({context,text:'Hi'}).length,2);
});
test('journal bounds visible activity and preserves concrete reason and history', () => {
	const cards=activityCards({activities:Array.from({length:20},(_,i)=>({id:'task'+i,title:'Survey the coastal path',state:'working',reason:'The high tide cut off the village',npcName:'Rae',history:['Found a blockage','Asked for assistance']}))});
	assert.equal(cards.length,6);assert.ok(cards[0].line.includes('The high tide'));assert.deepEqual(cards[0].history,['Found a blockage','Asked for assistance']);
	const reserved=activityCards({activities:[{id:'a',state:'paused',reason:'player-reserved'}]})[0];assert.ok(reserved.line.includes('Reserved for your help.'));assert.equal(reserved.line.includes('player-reserved'),false);
	assert.equal(activityScopeText({scope:{name:'Kyoto',world:'earth'},mode:'shared'}),'Kyoto · Shared local activity');
	assert.ok(activityScopeText({scope:{name:'The Moon'},mode:'local',savedLocally:true}).includes('saved on this device'));
	const many={activities:[...Array.from({length:7},(_,i)=>({id:'old'+i,state:'completed'})),{id:'mine',state:'active',canProgress:true}]};
	assert.equal(activityCards(many)[0].id,'mine');assert.equal(activityCards(many,6).length,2);
});
test('agreement UI exposes exact terms and requires explicit confirmation before exchange', () => {
	const offer={...pending.pendingOffer,askingPrice:1000};
	assert.equal(agreementTerms(offer).action,'confirm');assert.ok(agreementTerms(offer).line.includes('20 credits'));assert.ok(agreementTerms(offer).line.includes('missing survey kit'));
	assert.equal(agreementTerms({...offer,status:'accepted'}).action,'redeem');assert.equal(agreementTerms({...offer,status:'redeemed'}).action,null);
	assert.equal(agreementTerms({...offer,price:NaN}),null);
});
