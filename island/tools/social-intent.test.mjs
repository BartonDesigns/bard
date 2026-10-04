import test from 'node:test';
import assert from 'node:assert/strict';
import { offlineSocialIntent, decodeSocialIntent, buildSocialIntentMessages, buildSocialIntentContext } from '../src/people/social-intent.js';
const destinations = [{ id: 'lake:1', name: 'Lake Annabel', distance: 72 }, { id: 'village', name: 'The Village', distance: 80 }];
const proposal = (intent, confidence = 0.97, targetId = null, question = null) => ({ intent, confidence, targetId, question });

test('offline polite paraphrases map to canonical commands', () => {
	const cases = { 'Could you take a look around?':'scout', 'Would you stick with me?':'follow', 'Can you wait for me here?':'wait', 'Please return to where we met':'home', 'Raise the alarm here!':'warn', "Tell the villagers it's safe now":'calm', 'Forget that task':'cancel', 'Any updates?':'status', 'Come adventuring with me':'quest' };
	for (const [text, intent] of Object.entries(cases)) assert.equal(offlineSocialIntent(text).intent, intent, text);
});
test('quest requests differ from companion requests', () => {
	for (const text of ['Got any work for me?', 'What can I do to help?', "I'm looking for adventure"]) assert.equal(offlineSocialIntent(text).kind, 'quest_request', text);
	assert.equal(offlineSocialIntent('Join my quest').intent, 'quest');
});
test('known scout IDs are bound to provided snapshot; unknown places clarify', () => {
	assert.equal(offlineSocialIntent('Check out Lake Annabel', { destinations }).targetId, 'lake:1');
	assert.equal(offlineSocialIntent('Scout Atlantis', { destinations }).kind, 'clarify');
	assert.equal(decodeSocialIntent(proposal('scout', .98, 'lake:1'), { text:'Could you inspect that lake?', destinations }).targetId, 'lake:1');
	assert.equal(decodeSocialIntent(proposal('scout', .98, 'invented'), { text:'Inspect that place', destinations }).kind, 'clarify');
});
test('negation, quotations and hypothetical conversation never become action', () => {
	for (const text of ["Don't follow me", 'Never warn the villagers', 'What if you follow me?', 'She said follow me', 'Imagine you scout nearby', 'What does scout nearby mean?', 'Say "follow me"', 'I would not warn them']) {
		assert.equal(offlineSocialIntent(text).kind, 'none', text);
		assert.equal(decodeSocialIntent(proposal('warn'), { text }).kind, 'none', text);
	}
});
test('malformed, extra-field and code proposals cannot execute', () => {
	for (const raw of ['```json\n{}\n```', '{} bad', '[]', null, {intent:'follow'}, {...proposal('follow'), code:'eval(1)'}, {...proposal('follow'), position:{x:4,z:5}}, proposal('teleport'), proposal('follow', NaN), proposal('follow',1.1), {...proposal('follow'), confidence:'1'}, proposal('follow',1,'lake:1')]) assert.equal(decodeSocialIntent(raw,{text:'Follow me'}).kind, 'none');
});
test('low certainty and ambiguity clarify without a command', () => {
	for (const p of [proposal('follow',.81),proposal('warn',.89),proposal('clarify',.99,null,'Which place?'),proposal('follow',.99,null,'Do you mean follow?')]) {
		const out = decodeSocialIntent(p,{text:'Maybe come over here'}); assert.equal(out.kind,'clarify'); assert.equal(out.command,undefined);
	}
	assert.equal(decodeSocialIntent(proposal('none'),{text:'Nice weather'}).kind,'none');
});
test('model-supported arbitrary paraphrase produces only canonical validated action', () => {
	const out = decodeSocialIntent(JSON.stringify(proposal('scout',.96,'nearby')), {text:'Could you nose around a little and bring back what you learn?'});
	assert.deepEqual(out, {kind:'action',intent:'scout',command:'scout nearby',targetId:'nearby',confidence:.96});
});
test('prompt context is bounded, data-only and excludes arbitrary actor internals', () => {
	const opts = {text:'x'.repeat(5000),resident:{name:'Ana',mode:'wait',secret:'hidden',task:{status:'active',script:'bad'}},destinations:[...destinations,...Array.from({length:80},(_,i)=>({id:'id'+i,name:'y'.repeat(999)}))],history:Array.from({length:50},()=>({role:'user',content:'z'.repeat(5000)})),questContext:'q'.repeat(5000)};
	const context = buildSocialIntentContext(opts), messages = buildSocialIntentMessages(opts);
	assert.equal(context.playerRequest.length,1600);assert.equal(context.destinations.length,48);assert.equal(context.recentDialogue.length,6);assert.equal(context.questContext.length,1600);
	assert.equal(JSON.stringify(context).includes('hidden'),false);assert.equal(context.resident.task.script,undefined);assert.equal(messages.length,2);assert.deepEqual(JSON.parse(messages[1].content),context);
});
test('conversational acceptance and decline require actual current offer', () => {
	for (const text of ['That sounds like a plan, count me in', "I'm in", "I'll take that quest", 'Yes']) {
		assert.equal(offlineSocialIntent(text, {hasQuestOffer:true}).kind, 'quest_accept', text);
		assert.equal(offlineSocialIntent(text).kind, 'clarify', text);
	}
	for (const text of ['No thanks', "I'll pass", 'Maybe another time', 'Cancel that quest']) assert.equal(offlineSocialIntent(text, {hasQuestOffer:true}).kind, 'quest_decline', text);
	assert.equal(decodeSocialIntent(proposal('quest_accept',.89), {text:'Count me in',hasQuestOffer:true}).kind,'clarify');
	assert.equal(decodeSocialIntent(proposal('quest_accept',.99), {text:'Count me in'}).kind,'clarify');
	assert.equal(decodeSocialIntent(proposal('quest_decline',.96), {text:'I prefer to pass on this one',hasQuestOffer:true}).kind,'quest_decline');
	assert.equal(offlineSocialIntent('Cancel your task',{hasQuestOffer:true}).intent,'cancel');
	assert.equal(decodeSocialIntent(proposal('quest_accept',.99), {text:"I don't accept",hasQuestOffer:true}).kind,'none');
});
test('long grounded world IDs remain exact', () => {
	const id='world:'.repeat(80), destinations=[{id,name:'A distant landmark'}];
	assert.equal(decodeSocialIntent(proposal('scout',1,id),{text:'Inspect the landmark',destinations}).targetId,id);
});
