const text=(v,n=160)=>typeof v==='string'?v.trim().slice(0,n):'';
export const projectKindLabel = kind => ({path:'Marked path',garden:'Community garden',gathering:'Gathering place',resonance:'Musical stones'}[kind] || 'Community project');
const publicActor = (id,project={}) => id==='player'?'You':id && id===project.npcId && project.npcName?text(project.npcName,80):String(id||'').startsWith('npc:') || String(id||'').startsWith('colony:')?'A resident':'A traveller';
export function projectScopeText(snapshot={}) {
	const name=typeof snapshot.scope==='string'?snapshot.scope:snapshot.scope?.name;
	return [text(name),snapshot.mode==='shared'?'Shared with other players':snapshot.mode==='offline'?'Shared record offline. Reconnect to contribute.':snapshot.savedLocally===false?'Progress is not safely saved yet.':'Saved on this device'].filter(Boolean).join(' · ');
}
export function projectEta(readyAt,now=Date.now()) {
	if(!Number.isFinite(readyAt))return '';
	if(readyAt<=now)return 'Ready for the next world update.';
	const minutes=Math.ceil((readyAt-now)/60000);
	return `Expected in ${minutes>=60?Math.ceil(minutes/60)+' hours':minutes+' minutes'}.`;
}
export function communityProjectCards(snapshot={},now=Date.now(),offset=0) {
	const priority=p=>snapshot.active?.projectId===p.id?0:p.status==='completed'?2:1;
	return (snapshot.projects || []).filter(p=>p&&typeof p.id==='string').slice().sort((a,b)=>priority(a)-priority(b)).slice(Math.max(0,offset),Math.max(0,offset)+12).map(p=>{
		const stage=p.stage || p.status || 'proposed', active=snapshot.active?.projectId===p.id?snapshot.active:null;
		const survey=Number(p.surveyCount ?? p.progress?.survey ?? p.survey ?? 0), work=Number(p.workCount ?? p.progress?.work ?? p.work ?? 0);
		const contributors=Array.isArray(p.contributors)?p.contributors:Object.values(p.contributors || {});
		const names=contributors.map(c=>text(typeof c==='string'?publicActor(c,p):c.name || c.displayName || publicActor(c.actorId || c.id,p),60)).filter(Boolean);
		const reason=typeof p.danger==='string'?p.danger:p.danger?.message || p.blockedReason;
		const danger=({'local-emergency':'Work is paused until the local danger passes.','site-inaccessible':'The site needs to become safe and accessible before work can continue.'}[reason] || text(reason,240));
		const done=['active','complete','completed','built'].includes(stage), paused=!!danger || ['blocked','paused'].includes(stage);
		const stageName=({proposed:'Ready to survey',surveying:'Ready to survey',surveyed:'Ready for work',preparing:'Ready for work',working:'Work under way',building:'Taking shape',ready:'Taking shape',queued:'Taking shape',scheduled:'Taking shape',active:'Part of the world',complete:'Part of the world',completed:'Part of the world',built:'Part of the world',blocked:'Work paused',paused:'Work paused'}[stage] || text(stage).replaceAll('-',' '));
		return {...p,stage,active,done,paused,survey,work,names,danger,line:[`${projectKindLabel(p.kind)} · ${stageName}`,text(p.siteName || p.site?.name || p.name || p.title),`Survey ${Math.min(1,Math.max(0,survey))}/1 · Work ${Math.min(3,Math.max(0,work))}/3`,contributors.length?`${contributors.length} contributor${contributors.length===1?'':'s'}${names.length?' · '+names.slice(0,3).join(', '):''}`:'Be the first to help.',danger,!done && projectEta(p.readyAt,now)].filter(Boolean).join('\n')};
	});
}
export function projectHistoryLines(project={}) {
	return (Array.isArray(project.history)?project.history:[]).slice(-40).map(e=>{
		if(typeof e==='string')return text(e,240);
		if(!e || typeof e!=='object')return '';
		const actor=publicActor(e.actorId,project);
		const action=({'project-proposed':`${actor} proposed this improvement.`,'project-contribution':e.kind==='survey'?`${actor} surveyed the site.`:e.kind==='service'?`${actor} contributed a completed local job.`:`${actor} contributed a work session.`,'project-building':'All contributions accepted. The improvement is taking shape.','project-completed':'The improvement is now part of the world.','project-paused':e.reason==='local-emergency'?'Work paused during a local emergency.':'Work paused because the site is inaccessible.','project-resumed':'The site is available for work again.'}[e.type] || text(e.message || e.text,240));
		if(!action)return '';
		const date=Number.isFinite(e.at)?new Date(e.at):null;
		return `${date && Number.isFinite(date.getTime())?date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' · ':''}${action}`;
	}).filter(Boolean);
}
export function communityProjectFacts(snapshot={}) {
	const source=snapshot.mode==='shared'?'Shared regional record':snapshot.mode==='offline'?'Last saved shared record; currently offline':'Local record on this device';
	const projects=(Array.isArray(snapshot.projects)?snapshot.projects:[]).slice().sort((a,b)=>(b.status==='completed')-(a.status==='completed')).slice(0,3);
	return projects.map(p=>`${source}: ${projectKindLabel(p.kind)} at ${text(p.name || p.siteName,100)}. ${p.status==='completed'?'Completed and present in the world':p.status==='building'?'Work accepted; still taking shape, not yet complete':`Still needs work: survey ${Math.min(1,p.surveyCount||0)}/1, work ${Math.min(3,p.workCount||0)}/3`}. ${Array.isArray(p.contributors)?p.contributors.length:0} recorded contributors.${p.blockedReason?' Work is paused because the site is unsafe or inaccessible.':''} Do not invent payments, repairs, ownership changes or additional effects.`);
}
