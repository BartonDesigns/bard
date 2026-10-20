// Talking with the guide and with people, moved out of guide/guide.js's createGuide: turning
// to someone, asking them, and asking the guide.
// What it uses from guide.js's createGuide comes from gd: what is set up before it can run, once at
// the top of each call; the rest (busy, dialogueStyle, partner, view, viewEpoch, voiceOut) as
// gd.name at each use, and it sets busy, partner. A name not yet there needs a getter in
// createGuide's gd.

import { contextualOpening, contextualReply } from '../people/world-awareness.js';
import { offlineSocialIntent, buildSocialIntentMessages, buildSocialIntentContext, decodeSocialIntent } from '../people/social-intent.js';
import { livingScheduleIntent } from './community-project-intent.js';
import { livingActorId } from '../people/living-world.js';
import { parseSocialIntent } from '../people/social-state.js';
import { MEET_TAG_RE } from '../people/appointments.js';
import { dialogueTokenLimit } from '../people/dialogue-style.js';
import { personaFor, TAG_RE, personaPrompt, personaOffline } from '../people/persona.js';

export function guideTalkTo(gd, p) {
	const { api, archive, archiveTurn, btnCss, el, endTalk, gatheringRecap, input, llm, log, offer,
		people, perform, personContext, readyReports, reportStory, resetView, residentKey, say, show,
		showRouteChoice, stories, threadMeta, title, whereKind } = gd;
	if (!p) return;
	gd.busy?.abort();
	if (gd.partner && gd.partner.p !== p) endTalk();
	const resident = api.social?.meet(p, whereKind());
	if (resident) p = api.social.actors.all().find(a => a.residentId === resident.id) || p;
	let rec = people.get(p);
	if (resident) { rec = { persona: resident.persona, history: resident.history, id: resident.id, met: resident.history.length > 0 }; }
	else if (!rec || rec.seed !== p.P.dna.seed) rec = { persona: personaFor(p.P, whereKind()), history: [], seed: p.P.dna.seed };
	people.set(p, rec);
	gd.partner = { p, ...rec, threadId:rec.id || 'npc:'+api.social?.bodyKey()+':'+p.P.dna.seed };
	archive.importHistory(threadMeta(gd.partner),rec.history);
	resetView('npc');
	api.people?.engage(p);
	title.textContent = gd.partner.persona.name.toUpperCase();
	input.placeholder = `Say something to ${gd.partner.persona.first}`;
	show(true);
	for (const turn of archive.thread(threadMeta(gd.partner).id)?.turns.slice(-30) || []) if (turn.role === 'user' || turn.role === 'assistant') say(turn.content, turn.role === 'user' ? 'me' : 'guide');
	if (archive.status().error) say('Conversation archive could not save. Use Conversations → Export before leaving this session.','note');
	if (resident) say((api.social.state.status().error ? 'Memory is available this session, but your browser could not save it. ' : 'Remembered in this browser. ') + 'Tell me what you need in your own words, or ask me for an adventure.', 'note');
	if (resident && llm.kind()==='cloud' && !llm.supportsPlanning?.()) say('This shared voice can chat, but flexible actions are not available yet. Common requests still work; an on-device model in ⚙ can interpret more.', 'note');
	if(resident)for(const q of stories.list(resident.bodyKey).filter(q=>q.status==='complete' && q.offeredBy===residentKey(resident.id)))api.multiplayer?.reportQuest?.(q,resident);
	const awareness=personContext(p,resident), opening=contextualOpening(awareness);
	rec.met=true; perform(opening,true);
	if(resident) api.social.state.remember(resident.id,'assistant',opening);
	if(awareness.afraid) {p.M.feel('surprise',.85);p.M.gesture('shake');}
	else if(awareness.relationship?.trust>=3) {p.M.feel('joy',.45);p.M.gesture('nod');}
	else if(awareness.relationship?.trust<0) {p.M.feel('sad',.25);p.M.gesture('shake');}
	if(resident&&!awareness.afraid) {
		for(const q of readyReports(resident)) {say(`You’re back about “${q.title}”. What stayed with you?`,'guide');const b=el('button',btnCss,'Report back: '+q.title);b.onclick=()=>{
			if(gd.partner?.id!==resident.id)return;gd.busy?.abort();
			const text=`I'm back from ${q.title}.`;say(text,'me');archiveTurn(threadMeta(gd.partner),'user',text);api.social.state.remember(resident.id,'user',text);
			const aware=personContext(gd.partner.p,resident),reply=aware.afraid?contextualOpening(aware):reportStory(text,q.id);
			perform(reply,true);api.social.state.remember(resident.id,'assistant',reply);
		};log.append(b);}
		showRouteChoice(resident);
	}
	const recap = resident && gatheringRecap(resident);
	if (recap) perform(recap, true);
	if(!awareness.afraid) offer(p.talk?.open?.());
}

export async function guideAskPerson(gd, text) {
	const { ACTION_RE, api, archive, archiveTurn, bodySync, btnCss, el, endTalk, find, gatheringReply,
		giveQuest, llm, log, meetingFromReply, meetingReply, negotiate, norm, npcFor, offer, offerStory,
		personContext, planChat, projectConversation, QUEST_RE, quests, readyReports, reportStory,
		residentKey, say, scroll, show, showAgreement, showProjectReview, showScheduleReview, showStory,
		snapshot, speak, stories, storyContext, storyReply, targets, threadMeta } = gd;
	const P2 = gd.partner, p = P2.p;
	archiveTurn(threadMeta(P2),'user',text);
	gd.busy?.abort();
	say(text, 'me');
	if (P2.id) api.social.state.remember(P2.id, 'user', text);
	else { P2.history.push({ role: 'user', content: text }); while (P2.history.length > 10) P2.history.shift(); }
	const bubble = say('…', 'guide');
	const ctrl = new AbortController(); gd.busy = ctrl;
	let reply = null, from = 0;
	const world = snapshot();
	const resident = P2.id && api.social?.state.get(P2.id);
	// Gear requests are resolved by the authoritative world adapter before social
	// intent or the language model. This lets “could you find us a hunting rifle?”
	// work conversationally while ordinary dialogue remains non-mutating.
	// a world's own people answer their own errands first (planet/colony/errands.js)
	const awareness=personContext(p,resident);
	if(awareness.afraid) reply=contextualReply(awareness,text);
	const schedule=reply ? null : livingScheduleIntent(text,api.livingWorld?.snapshot?.(),livingActorId(p));
	if(schedule?.kind==='clarify')reply=schedule.question;
	else if(schedule?.kind==='schedule')reply=`You mean “${schedule.title}”? We can discuss ${schedule.effect==='prioritize'?'making it a priority':schedule.effect==='defer'?'putting it off for a safer moment':'picking it back up'}.`;
	const community=reply ? null : await projectConversation(text,P2,ctrl.signal);
	if(ctrl.signal.aborted || gd.partner!==P2){if(gd.busy===ctrl)gd.busy=null;return;}
	if(community)reply=community.message;
	const negotiation = reply ? null : await negotiate(text,P2,ctrl.signal);
	if (ctrl.signal.aborted || gd.partner !== P2) { if(gd.busy===ctrl)gd.busy=null;return; }
	if (negotiation) reply=negotiation.message || negotiation.error || 'No exchange was made.';
	const own = reply ? null : p.talk?.reply?.(text);
	// asked whether they need a hand: a favour of their own (people/errands.js), said yes to here
	let favour = null;
	if (!reply && !own && /\b(need (?:any )?help|can i help|any favou?rs?|anything i can do|help you with|do you need anything|need a hand)\b/i.test(text)) {
		const o = api.errands?.offerTo?.(p);
		if (o) { reply = o.text; favour = { choices: [{ label: "I'll do it", fn: () => { api.errands.accept(); return { say: '[[mood: happy]] [[gesture: nod]] Thank you! Really.' }; } }, { label: 'Not now', fn: () => { api.errands.cancel(); return { say: '[[mood: calm]] No problem. Thanks for asking.' }; } }] }; }
	}
	if (own?.say) reply = own.say;
	const gearRequest=api.arms?.parse?.(text);
	if(!reply&&gearRequest?.kind==='purchase'&&gearRequest.item)reply='Ask a shopkeeper for a quote and review their terms before buying. Nothing has been purchased.';
	const armsResult = reply || gearRequest?.kind==='purchase' ? null : api.arms?.command?.(text, { position: p.M.S.pos, speaker: P2.persona });
	if (armsResult?.ok && armsResult.kind && armsResult.kind !== 'none') reply = armsResult.message;
	if (resident) {
		api.social.state.setPosition(resident.id, api.social.positionFor(api.world(), p.M.S.pos));
		const named = text.match(/(?:scout|check out|investigate)\s+(.+?)[.!?]*$/i)?.[1]?.trim().replace(/[, ]*please$/i, '').trim();
		let target = named && !/^(nearby|ahead|around here|the area)$/i.test(named.trim()) ? find(named) : null;
		if (!named || /^(nearby|ahead|around here|the area)$/i.test(named.trim())) {
			target = api.social.scoutNearby(p, targets());
		}
		// A gear action has already been validated by the arms adapter. Keep that
		// response instead of letting the social intent layer reinterpret it as a
		// generic order for the resident.
		if (!reply) reply = api.social.command(resident, text, { relationship:awareness.relationship, target, quest: quests.find(q => !q.done) });
		if (reply && parseSocialIntent(text)==='scout' && resident.mode==='scout' && resident.task && target?.name) api.social.state.setMode(resident.id,'scout',{...resident.task,targetId:'place-'+norm(target.name).replace(/ /g,'-')});
	}
	let meetNoteText = null, meetHandled = false;
	if (resident && !reply) {
		const meet = gatheringReply(text, resident, p) || meetingReply(text, resident, p);
		if (meet) { reply = meet.reply; meetNoteText = meet.note || null; meetHandled = true; }
	}
	if (resident && !reply) {
		reply = storyReply(text);
		if (!reply) {
			const context=storyContext(resident), destinations=context.targets.slice(0,8).map(t=>({...t,distance:Math.hypot(t.x-p.M.S.pos.x,t.z-p.M.S.pos.z)}));
			const currentOffer=stories.list(context.bodyKey).filter(q=>q.status==='offered' && q.offeredBy===residentKey(resident.id)).at(-1);
			const ready=readyReports(resident);
			const options={text:text.slice(0,600),resident,destinations,history:resident.history.slice(-3).map(m=>({role:m.role,content:m.content.slice(0,180)})),questContext:(currentOffer?'Current offer from this person: '+currentOffer.title+'. ':'No current quest offer. ')+(ready.length?'Report ready for: '+ready.map(q=>q.title).join('; ')+'. ':'No report ready. ')+stories.list(context.bodyKey).filter(q=>q.status==='active').map(q=>q.title).join('; ')};
			let intention=offlineSocialIntent(text,{destinations,hasQuestOffer:!!currentOffer});
			if (intention.reason!=='not-an-order') {
				const raw=await planChat(buildSocialIntentMessages(options),ctrl.signal,{kind:'social_intent',context:buildSocialIntentContext(options)});
				if (raw) { intention=decodeSocialIntent(raw,{text,destinations,hasQuestOffer:!!currentOffer,hasQuestReport:ready.length>0}); if(intention.kind==='none' && !['conversation','not-an-order'].includes(intention.reason)) reply='I could not work out a supported action from that. Could you clarify what you want me to do?'; }
			}
			if (ctrl.signal.aborted || gd.partner!==P2 || api.social.bodyKey()!==context.bodyKey) { if(gd.busy===ctrl) gd.busy=null; return; }
			if (intention.kind==='clarify') reply=intention.question;
			if (intention.kind==='quest_report') reply=reportStory(text);
			if (intention.kind==='quest_request') reply=await offerStory(resident,text,ctrl.signal);
			if (['quest_accept','quest_decline'].includes(intention.kind)) reply=currentOffer?storyReply(intention.kind==='quest_accept'?"I'm in":'no thanks'):'Which quest would you like to discuss?';
			if (intention.kind==='action') {
				const target=intention.targetId==='nearby'?api.social.scoutNearby(p,targets()):destinations.find(t=>t.id===intention.targetId);
				reply=api.social.command(resident,intention.command,{relationship:awareness.relationship,target,quest:stories.list(context.bodyKey).find(q=>q.status==='active') || quests.find(q=>!q.done)});
				if (intention.intent==='scout' && resident.mode==='scout' && resident.task && target?.id) api.social.state.setMode(resident.id,'scout',{...resident.task,targetId:target.id});
			}
		}
	}

	try {
		if (!reply && llm.kind() !== 'none' && llm.status.ready) {
			reply = await llm.chat([{ role: 'system', content: personaPrompt(P2.persona, { dialogueStyle: gd.dialogueStyle, place: world?.place, time: world?.time, near: world?.near?.slice(0, 4), rememberedStatus: resident ? api.social.describe(resident) : null, memories: [...awareness.facts,...(resident?.memories?.slice(-3).map(m => m.content)||[])] }) + '\nOnly describe your current saved status as fact. Physical requests and structured quest offers are handled by the game. If a request could not be interpreted, ask one short clarifying question instead of agreeing to do it. Do not invent a quest or emit quest tags in ordinary dialogue. If you suggest meeting up later, name one place from the list (or here, or your place) and a clock time, and end with [[meet: PLACE @ TIME]], for example [[meet: the pier @ 6 pm]]; the player must still agree. Never promise to meet without a place and time. Never claim to have performed a delivery, fight, purchase or other action that is not in that status. Price negotiations, task discounts, ownership and agreements are governed by the game ledger; never invent stock or an offer, or treat ordinary conversation as purchase consent.' }, ...(resident ? api.social.state.get(P2.id).history : P2.history).filter(turn => turn.role === 'user' || turn.role === 'assistant')], (t) => {
				if (ctrl.signal.aborted || gd.partner !== P2) return;
				bubble.textContent = t.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').replace(MEET_TAG_RE, '').replace(/\[\[\s*meet[^\]]*$/i, '').trim(); scroll();
				from = bodySync(p, t, from);
			}, ctrl.signal, { npc: npcFor(P2.persona, world), maxTokens:dialogueTokenLimit(gd.dialogueStyle,P2.persona.age) });
		}
	} catch { reply = null; }
	if (ctrl.signal.aborted || gd.partner !== P2) { if (gd.busy === ctrl) gd.busy = null; return; }
	if (!reply) { reply = contextualReply(awareness,text) || personaOffline(P2.persona, text, world); from = 0; }
	bodySync(p, reply + (/[.!?]$/.test(reply.trim()) ? '' : '.'), from);
	if (!resident) reply.replace(QUEST_RE, (_, pl) => { giveQuest(pl.trim(), P2.persona.first); return ''; });
	if (resident && !meetHandled) meetNoteText = meetingFromReply(reply, text, resident, p);
	const clean = reply.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').replace(MEET_TAG_RE, '').trim();
	bubble.textContent = clean || '…';
	if (meetNoteText) { say(meetNoteText, 'note'); if (meetNoteText.startsWith('📍')) api.hint(meetNoteText.replace(/ A pin marks the place\.$/, ''), 5000); }
	if (own && (own.note || own.choices)) offer({ ...own, say: null });
	if (favour) offer({ ...favour, say: null });
	if (negotiation?.offer) showAgreement(negotiation.offer,P2);
	if(community?.review)showProjectReview(community.review,P2);
	if(community?.open){const open=el('button',btnCss,'Open community projects');open.onclick=showStory;log.append(open);}
	if(schedule?.kind==='schedule')showScheduleReview(schedule,P2);
	archiveTurn(threadMeta(P2),'assistant',clean);
	if (archive.status().error) say('Conversation archive could not save. Use Conversations → Export before leaving this session.','note');
	if (P2.id) api.social.state.remember(P2.id, 'assistant', clean); else P2.history.push({ role: 'assistant', content: clean });
	// A joined check-in can observe a real exchange here. Sending a prompt,
	// previewing a task or receiving an unvalidated model proposal cannot finish it.
	try{const observed=api.livingWorld?.conversationObserved?.(p);observed?.catch?.(()=>{});}catch{/* the activity journal reports its own save errors */}
	if (gd.voiceOut) speak(clean, P2.persona);
	if (gd.busy === ctrl) gd.busy = null;
	scroll();
	if (/\b(bye|goodbye|take care|see you)\b/i.test(text)) setTimeout(() => { if (gd.partner === P2) { endTalk(); show(false); } }, meetNoteText ? 4000 : 1800);
}

export async function guideAsk(gd, text) {
	const { act, ACTION_RE, api, archiveTurn, askPerson, btnCss, el, giveQuest, guideMeta, history, llm,
		localSpeech, log, offline, projectConversation, QUEST_RE, renderGuide, say, scroll, showProjectReview,
		showStory, speak, systemPrompt } = gd;
	if (!text.trim()) return;
	localSpeech.cancel();
	if ('speechSynthesis' in window) speechSynthesis.cancel();
	if (gd.partner) return askPerson(text);
	if (gd.view!=='guide') renderGuide();
	const requestEpoch=gd.viewEpoch;
	archiveTurn(guideMeta,'user',text);
	say(text, 'me');
	const bubble = say('…', 'guide');
	// the world's secrets answer for themselves (surprises.js)
	const secret = api.secret?.(text);
	if (secret) { bubble.textContent = secret; archiveTurn(guideMeta,'assistant',secret); scroll(); return; }
	if (gd.busy) gd.busy.abort();
	const ctrl = new AbortController(); gd.busy = ctrl;
	let reply = null;
	const community=await projectConversation(text,null,ctrl.signal);
	if(ctrl.signal.aborted || requestEpoch!==gd.viewEpoch || gd.partner){if(gd.busy===ctrl)gd.busy=null;return;}
	if(community)reply=community.message;
	try {
		if (!reply && llm.kind() !== 'none' && llm.status.ready) {
			history.push({ role: 'user', content: text });
			while (history.length > 12) history.shift();
			reply = await llm.chat([{ role: 'system', content: systemPrompt() }, ...history], (t) => { if(ctrl.signal.aborted || requestEpoch!==gd.viewEpoch || gd.partner) return; bubble.textContent = t.replace(ACTION_RE, '').trim(); scroll(); }, ctrl.signal);
			if (reply && !ctrl.signal.aborted && requestEpoch===gd.viewEpoch && !gd.partner) history.push({ role: 'assistant', content: reply });
		}
	} catch (e) { if(ctrl.signal.aborted || requestEpoch!==gd.viewEpoch || gd.partner) return; reply = null; say('(The model did not answer: ' + e.message + '. The built-in guide answers instead.)', 'note'); }
	if(ctrl.signal.aborted || requestEpoch!==gd.viewEpoch || gd.partner) { if(gd.busy===ctrl)gd.busy=null;return; }
	if (!reply) reply = offline(text);
	const acts = [];
	reply.replace(ACTION_RE, (_, c, a) => { acts.push([c, a.trim()]); return ''; });
	reply.replace(QUEST_RE, (_, pl) => { giveQuest(pl.trim(), null); return ''; });
	const clean = reply.replace(ACTION_RE, '').replace(QUEST_RE, '').trim();
	bubble.textContent = clean || '…';
	archiveTurn(guideMeta,'assistant',clean);
	if(community?.review)showProjectReview(community.review,null);
	if(community?.open){const open=el('button',btnCss,'Open community projects');open.onclick=showStory;log.append(open);}
	for (const [c, a] of acts) { const r = act(c, a); if (r) say(r, 'note'); }
	if (gd.voiceOut) speak(clean);
	if (gd.busy === ctrl) gd.busy = null;
	scroll();
}
