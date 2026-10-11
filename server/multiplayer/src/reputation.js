import { cleanReputation, reputationAlive, reputationDistance, REPUTATION_MAX, REPUTATION_ACTOR_MAX } from '../../../island/src/net/reputation.js';

// Reports can only concern the socket's own actor. These facts cannot award items/money.
export function acceptReputation(meta, raw, actor, pose, now=Date.now()) {
 const e=cleanReputation(raw);
 if(!e || !pose || pose.w!==e.w)return {ok:false};
 const distance=reputationDistance(e,pose), limit=e.kind==='quest-complete'?12:e.kind==='assault'?160:e.kind==='arson'?55:25;
 if(distance>limit || Math.abs(e.p[1]-pose.p[1])>(e.kind==='assault'?50:8))return {ok:false};
 if(e.kind==='quest-complete' && Math.abs(e.p[1]-(pose.p[1]-1.68))>1.5)return {ok:false};
 if(e.kind==='vehicle-impact' && (pose.v!=='car' || pose.a!=='drive'))return {ok:false};
 if(e.kind==='shots' && !pose.h)return {ok:false};
 const records=(meta.reputation||[]).filter(e=>reputationAlive(e,now));
 const duplicate=records.find(q=>q.actor===actor.id && q.id===e.id);
 if(duplicate)return {ok:true,duplicate:true,record:duplicate};
 const prior=records.filter(q=>q.actor===actor.id && q.kind===e.kind).at(-1);
 if(prior && now-prior.at<(e.kind==='shots'?4000:1500))return {ok:false};
 const record={...e,actor:actor.id,name:actor.name,at:now};
 // One player's stream must not evict the entire room's history.
 while(records.filter(q=>q.actor===actor.id).length>=REPUTATION_ACTOR_MAX)records.splice(records.findIndex(q=>q.actor===actor.id),1);
 meta.reputation=[...records,record].slice(-REPUTATION_MAX);
 return {ok:true,record};
}
