// Observed facts, never a guess at the player's thoughts. Witness memories are bounded
// and stay with a resident when their rendered body is replaced.
const HARM = new Set(['assault','vehicle-impact','robbery','arson','ward']);
export function rememberIncident(actor, event) {
 if(!actor || !event?.bodyKey || !Number.isFinite(event.at)) return;
 const prior=actor.awarenessEvents || [];
 if(prior.some(e=>e.id===event.id)) return;
 actor.awarenessEvents=[...prior,event].slice(-8);
}
export function awarenessContext({events=[],reports=[],sharedCompleted=0,sharedIssuer=false,bodyKey,now=Date.now(),aimedAt=false,wanted=0,injured=false,running=false,work=null,completed=[],known=false,visit=0,seed=0}={}) {
 const recent=(Array.isArray(events)?events:[]).filter(e=>e && e.bodyKey===bodyKey && now>=e.at && now-e.at<600000);
 const local=recent.filter(e=>e.actorId==='player'), harmful=local.filter(e=>HARM.has(e.kind)).at(-1);
 const danger=recent.filter(e=>now-e.at<90000).at(-1);
 const reported=reports.filter(e=>e.actorId==='player' && HARM.has(e.kind)).at(-1), reportedDanger=reports.filter(e=>e.age<90000).at(-1);
 const afraid=aimedAt || wanted>=2 || !!harmful || !!danger || !!reported || !!reportedDanger;
 const facts=[];
 if(harmful) facts.push(`Witnessed the player: ${harmful.line}. Still frightened; does not treat this as a friendly first meeting.`);
 else if(danger) facts.push(`Witnessed ${danger.actorId==='player'?'the player':danger.actorName || 'another player'}: ${danger.line}. Frightened by this nearby danger; do not blame the local player for someone else's act.`);
 if(reported && !harmful) facts.push(`Local reports identify the player: ${reported.line}. Afraid of the reported behavior; has NOT personally witnessed it. Never claim 'I saw you'.`);
 else if(reportedDanger && !danger) facts.push(`Local reports describe ${reportedDanger.actorId==='player'?'the player':reportedDanger.actorName || 'another player'}: ${reportedDanger.line}. Uneasy about nearby danger; this is a report, not an eyewitness memory. Do not blame an innocent player.`);
 if(sharedCompleted && !completed.length) facts.push(sharedIssuer?'Remembers this player finishing work for this resident in this room.':'Has heard this player completed work for people in this area. Does not know the private quest details.');
 if(aimedAt) facts.unshift('The player is aiming a weapon toward this person right now; frightened and wants the weapon lowered.');
 if(wanted>=2 && !harmful) facts.push('The player is wanted by the local patrol. Cautious and afraid, but must not claim to have witnessed an unseen crime.');
 if(injured) facts.push('The player visibly needs medical help.');
 if(running) facts.push('The player has just been moving quickly. Their private thoughts are unknown.');
 if(work) facts.push(`Here: ${work.program || work.place || 'workplace'}, floor ${work.floor ?? 'ground'}. Role: ${work.role}. Activity: ${work.activity || work.role}.`);
 if(completed.length) facts.push(`This person remembers helping complete: ${completed.slice(-2).join('; ')}.`);
 if(known) facts.push('Has spoken with this traveller before; skip introductions and vary the opening.');
 return {recent,harmful,danger,reported,reportedDanger,sharedCompleted,sharedIssuer,afraid,aimedAt,wanted,injured,running,work,completed,known,visit,seed,facts:facts.slice(0,6)};
}
export function contextualOpening(c={}) {
 const pick=xs=>xs[(Math.abs(c.seed|0)+(c.visit||0))%xs.length];
 if(c.aimedAt) return pick(["Lower that weapon. I’m scared. What do you want?","Please stop aiming at me! I can’t talk like this.","Back up. Put it away first."]);
 if(c.harmful) {
  const action=c.harmful.kind==='vehicle-impact'?'drove into someone':c.harmful.kind==='robbery'?'robbed someone':c.harmful.kind==='arson'?'started that fire':'hurt someone';
  return pick([`WHAT? You just ${action}! I’m frightened. Stay back.`,`I saw you ${action}. Don’t come any closer.`,`After what you did? People are scared. Give us space.`]);
 }
 if(c.reported) return pick([`People are saying you ${c.reported.kind==='vehicle-impact'?'drove into someone':c.reported.kind==='robbery'?'robbed someone':c.reported.kind==='arson'?'started that fire':'hurt someone'} here. I’m scared. Please keep your distance.`,"I’ve heard what happened. I don’t want any trouble. Stay back.","There are reports about you. Give us some space, please."]);
 if(c.wanted>=2) return pick(['You’re the person the patrol is looking for. Please keep your distance.','I don’t want trouble. You should deal with the patrol first.']);
 if(c.danger) return pick(["Did you see that? I’m scared. We need to get somewhere safe.","Keep your voice down. Someone was attacking people nearby.","What is happening out there? Please, watch the exits."]);
 if(c.reportedDanger) return pick(["Have you heard what happened nearby? People are frightened.","I’ve heard reports of trouble. Let’s stay somewhere safe."]);
 if(c.completed?.length) return pick([`You came back. Thanks for finishing ${c.completed.at(-1)}.`,`That work you helped with made a difference. What’s next?`,`Good to see you again. We got ${c.completed.at(-1)} done.`]);
 if(c.sharedCompleted) return c.sharedIssuer ? pick(['Good to see you. Thanks for helping with the work here.','We got that job done together. What brings you back?']) : pick(['I heard you have been helping people around here. Thank you.','Word is you have been getting things done for people here. Need something?']);
 if(c.injured) return 'You look hurt. Are you able to get somewhere safe?';
 const w=c.work;
 if(w?.role==='vendor') return pick(["Looking for something specific, or comparing prices?","What’s your budget? Let’s see what we can do.","Take your time. I can explain what’s in stock."]);
 if(w?.role==='shopper') return pick(["I’m comparing the offers. Have you found a better price?","One moment. I’m trying to work out whether this is a good deal.","I only came in for one thing. You know how that goes."]);
 if(w?.activity==='dispute') return pick(["WHAT? Sorry, this deadline discussion is getting heated.","Give me a second. We’re trying to settle a disagreement."]);
 if(w) return pick([`We’re in the middle of ${w.program || 'work'}. What do you need?`,"Have you come about the project, or something else?","I can spare a minute. What’s happening?","You caught me between tasks. What can I do for you?"]);
 return c.known ? pick(["What’s changed since we last spoke?","Back again. How did it go?","I’ve got a moment. What’s on your mind?","Something new?"]) : pick(["You seem to be looking for something. Can I help?","How’s your day going?","Everything all right?","What brings you through here?","Taking a break too?"]);
}
export function contextualReply(c,text) {
 if(c.afraid) {
  if(/\b(sorry|apologi[sz]e|my fault)\b/i.test(text) && !c.aimedAt) return c.harmful || c.reported || c.wanted>=2 ? 'I hear you, but I’m still shaken. Give people some space. Words don’t undo what happened.' : 'Thanks. I’m still shaken by what happened nearby. Let’s give people some space.';
  return contextualOpening(c);
 }
 if(/\b(what are you doing|your work|what.s happening|what is happening)\b/i.test(text) && c.work) return `I’m ${c.work.activity || c.work.role} in ${c.work.program || 'this workplace'}. Ask if there’s work you can help with.`;
 return null;
}
