// The guide's screens, moved out of guide/guide.js's createGuide: quests and the cards that
// track them, community projects, living activity, the story, the caves, the archive, settings.
// What it uses from guide.js's createGuide comes from gd: what is set up before it can run, once at
// the top of each call; the rest (archivePage, archiveScope, communityPage, communityPageScope,
// dialogueStyle, livingActivityPage, livingActivityScope, livingContact, pinned,
// projectProgressView, questLive, speechMode, tracked, view, viewEpoch) as gd.name at each use, and
// it sets archivePage, communityPage, communityPageScope, dialogueStyle, livingActivityPage,
// livingActivityScope, livingContact, projectProgressView, speechMode, tracked. A name not yet
// there needs a getter in createGuide's gd.

import { hasWebGPU, WEBLLM_MODELS } from './llm.js';
import { activityScopeText, activityCards } from './living-activity-view.js';
import { projectScopeText, communityProjectCards, projectHistoryLines, projectKindLabel } from './community-project-view.js';
import { worldPosition } from '../people/social-actors.js';
import { formatClock } from '../people/appointments.js';
import { normalizeDialogueStyle } from '../people/dialogue-style.js';
import { rankOf } from '../gameplay/ranks.js';
import { VOICE_MODES, voiceMode } from './preferences.js';
import { DISCOVERY_URL } from '../earth/config.js';

export function guideArchive(gd) {
	const { archive, archiveSearch, btnCss, el, log, renderArchive, say, showArchive } = gd;
	log.replaceChildren();
	const query=archiveSearch.value.trim(), thread=gd.archiveScope && archive.thread(gd.archiveScope);
	const heading=el('div','color:#9fe8d0;font-weight:600;',thread?thread.name+' · conversation':'ALL CONVERSATIONS');log.append(heading);
	if (gd.archiveScope) { const all=el('button',btnCss,'All conversations');all.onclick=()=>showArchive();log.append(all); }
	const rows=thread && !query ? thread.turns.slice(gd.archivePage*30,gd.archivePage*30+31).map((turn,index)=>({threadId:thread.id,name:thread.name,turn,index})) : archive.search(query,{threadId:gd.archiveScope || undefined,offset:gd.archivePage*30,limit:31});
	if (!rows.length) say(query?'No matching messages.':'No saved messages yet. New conversations are kept here.', 'note');
	for (const hit of rows.slice(0,30)) {
		const item=el('div','padding:8px;border:1px solid #455255;border-radius:8px;');
		const label=el('button',btnCss,hit.name+' · '+(hit.turn.role==='user'?'You':hit.name));label.onclick=()=>showArchive('',hit.threadId);
		item.append(label,el('div','white-space:pre-wrap;overflow-wrap:anywhere;padding-top:6px;',hit.turn.content));log.append(item);
	}
	const pages=el('div','display:flex;gap:8px;');
	if (gd.archivePage>0) {const prev=el('button',btnCss,'Previous');prev.onclick=()=>{gd.archivePage--;renderArchive();};pages.append(prev);}
	if (rows.length>30) {const next=el('button',btnCss,'Next');next.onclick=()=>{gd.archivePage++;renderArchive();};pages.append(next);}
	log.append(pages);
	if (archive.status().error) say('The latest messages could not be saved. Export your conversations before leaving this session. '+archive.status().error,'note');
	log.scrollTop=0;
}

export function guideTrackButton(gd, follow, kind, id) {
	const { api, btnCss, qcss, qel, setPinned, setWayPrefs, show, showQuests, waypointMark,
		wayPrefs } = gd;
	const on = gd.pinned && gd.pinned.kind === kind && gd.pinned.id === id;
	const b = qel('button', on ? qcss.primary : btnCss + 'border-color:rgba(1,169,130,.6);color:#9fe8d0;', on ? '◆ Tracking' : '◇ Track');
	b.setAttribute('aria-pressed', String(!!on));
	b.setAttribute('aria-label', on ? 'Stop tracking' : 'Track: show the way');
	b.onclick = () => {
		if (on) { setPinned(null); api.waypoint?.set(waypointMark()); showQuests(); return; }
		setPinned({ kind, id });
		if (kind === 'meeting') gd.tracked = id;
		if (kind === 'crew') follow?.();
		const m = waypointMark(); api.waypoint?.set(m);
		const W = api.world(), P = W?.player?.state;
		if (m && P) { P.yaw = Math.atan2(-(m.x - P.pos.x), -(m.z - P.pos.z)); }
		show(false);
		if (!wayPrefs.waypoint && !wayPrefs.wayfinder) setWayPrefs({ waypoint: true });
		api.hint(m ? `Tracking: ${m.title}. ${wayPrefs.wayfinder ? 'Follow the trail.' : 'Follow the marker.'}` : 'Tracking. The way shows once the place is in reach.', 4000);
	};
	return b;
}

export function guideTrackingCard(gd) {
	const { api, bearing, log, QC, qcss, qel, questPill, setPinned, setWayPrefs, showQuests, toggle,
		waypointMark, wayPrefs } = gd;
	const m = api.waypoint?.mark?.() || waypointMark(), mine = !!gd.pinned && !!m && m.key === gd.pinned.kind + ':' + gd.pinned.id;
	const card = qel('div', qcss.card + 'border-color:rgba(1,169,130,.45);background:linear-gradient(135deg,rgba(1,169,130,.16),rgba(1,169,130,.04));');
	const top = qel('div', qcss.row + 'flex-wrap:nowrap;');
	top.append(questPill(mine ? 'Tracking' : m ? 'Next up' : 'Nothing tracked', m ? QC.teal : QC.grey));
	if (gd.pinned) {
		const stop = qel('button', qcss.ghost + 'margin-left:auto;min-height:32px;padding:4px 10px;font-size:12px;', 'Stop tracking');
		stop.onclick = () => { setPinned(null); api.waypoint?.set(waypointMark()); showQuests(); };
		top.append(stop);
	}
	card.append(top);
	if (m) {
		const t = qel('div', qcss.title, m.title);
		card.append(t);
		const line = qel('div', qcss.row + 'row-gap:4px;');
		line.append(bearing({ x: m.x, z: m.z, radius: m.radius, live: true }, true));
		if (m.detail) line.append(qel('span', qcss.meta, m.detail));
		card.append(line);
		gd.questLive.at(-1).title = t;
	} else card.append(qel('div', qcss.body, 'Pick a quest or a place below and tap Track. A pin, a marker and a trail show the way.'));
	const toggles = qel('div', qcss.row + 'margin-top:2px;');
	toggles.append(
		toggle('Waypoint', 'A pin at the place and a marker over it on the screen', wayPrefs.waypoint, v => setWayPrefs({ waypoint: v })),
		toggle('Wayfinder', 'A trail on the ground from your feet toward the place', wayPrefs.wayfinder, v => setWayPrefs({ wayfinder: v })),
	);
	card.append(toggles);
	log.append(card);
}

export function guideQuestCard(gd, q, bodyKey, context) {
	const { progressBar, QC, qcss, qel, questChanged, questNotice, questPill, say, showQuests, stepPlace,
		stepRow, stepWords, stories, trackButton } = gd;
	const color = q.status === 'active' ? QC.teal : q.status === 'offered' ? QC.amber : q.status === 'complete' ? QC.green : QC.grey;
	const card = qel('div', qcss.card + `border-left:3px solid ${color};`);
	const top = qel('div', qcss.row);
	top.append(questPill(q.status === 'complete' ? 'Complete' : q.status, color));
	const reward = q.chapter ? `Chapter ${q.chapter} of 3` : q.reward ? `${q.reward.credits} credits${q.rewardPaid ? ' · paid' : ''}` : '';
	if (reward) top.append(qel('span', qcss.meta + 'margin-left:auto;', reward));
	card.append(top, qel('div', qcss.title, q.title));
	if (q.status !== 'complete') card.append(qel('div', qcss.body, q.premise));
	card.append(progressBar(q.cursor, q.steps.length, color));
	const steps = qel('div', 'display:flex;flex-direction:column;gap:4px;');
	q.steps.forEach((step, i) => {
		const state = i < q.cursor ? 'done' : i === q.cursor && q.status === 'active' ? 'now' : 'next';
		steps.append(stepRow(state, stepWords(step, context), state === 'now' ? stepPlace(step, context) : null));
	});
	card.append(steps);
	if (q.status === 'offered' || q.status === 'active') {
		const row = qel('div', qcss.row + 'margin-top:2px;');
		if (q.status === 'offered') {
			const accept = qel('button', qcss.primary, 'Accept quest');
			accept.onclick = () => { const result = stories.accept(q.id, bodyKey); if (result.ok) questChanged(result.quest, false); showQuests(); if (questNotice(result)) say(questNotice(result), 'note'); };
			row.append(accept);
		} else if (stepPlace(q.steps[q.cursor], context)) row.append(trackButton(null, 'story', q.id));
		const cancel = qel('button', qcss.ghost + 'margin-left:auto;', q.status === 'offered' ? 'Decline' : 'Cancel quest');
		cancel.onclick = () => { const result = stories.cancel(q.id, bodyKey); if (result.ok) questChanged(result.quest, false); showQuests(); if (questNotice(result)) say(questNotice(result), 'note'); };
		row.append(cancel);
		card.append(row);
	}
	return card;
}

export function guideQuests(gd) {
	const { api, bearing, book, btnCss, endTalk, explorePlace, find, folded, gatherTitle, journal, log,
		meetWhen, progressBar, QC, qcss, qel, questCard, questPill, QUESTS, resetView, say, section, show,
		showCaves, showQuests, stepRow, store, stories, storyContext, trackButton, trackingCard } = gd;
	endTalk(); resetView('quests'); show(true);
	const bodyKey = api.social?.bodyKey(), list = stories.list(bodyKey), context = storyContext();
	trackingCard();

	// ----- story quests: what you are on, then offers, then (folded) the finished ones
	const live = list.filter(q => q.status === 'active').reverse(), offers = list.filter(q => q.status === 'offered').reverse(), done = list.filter(q => q.status === 'complete').reverse();
	section('Story quests', list.length ? `${live.length} active${offers.length ? ` · ${offers.length} offered` : ''}` : '');
	if (!live.length && !offers.length) {
		const empty = qel('div', qcss.card + 'border-style:dashed;');
		empty.append(qel('div', 'font:600 14px var(--bard-display,system-ui,sans-serif);color:#fff;', 'No story quest under way'), qel('div', qcss.body, 'Talk to someone nearby and ask for an adventure. They suggest a story rooted in this world.'));
		log.append(empty);
	}
	for (const q of [...live, ...offers]) log.append(questCard(q, bodyKey, context));
	if (done.length) { const inner = folded('Completed', done.length); for (const q of done) inner.append(questCard(q, bodyKey, context)); }
	if (stories.status().error) say(stories.status().error, 'note');

	// ----- meetings you agreed or were offered
	const meetings = (book()?.list(bodyKey) || []).filter(a => a.status !== 'cancelled').sort((a, b) => b.due - a.due).slice(0, 8);
	if (meetings.length) {
		const now = meetings.filter(a => a.status === 'agreed' || a.status === 'proposed'), past = meetings.filter(a => !now.includes(a));
		section('Meetings', now.length ? `${now.length} upcoming` : '');
		const W = api.world();
		const meetCard = (a) => {
			const color = a.status === 'agreed' ? QC.teal : a.status === 'proposed' ? QC.amber : a.status === 'kept' ? QC.green : QC.grey;
			const card = qel('div', qcss.card + `border-left:3px solid ${color};${now.includes(a) ? '' : 'opacity:.7;'}`);
			const top = qel('div', qcss.row);
			top.append(questPill(a.status === 'agreed' ? 'Agreed' : a.status === 'proposed' ? 'Suggested' : a.status === 'kept' ? (a.gathering ? 'Attended' : 'Kept') : 'Missed', color));
			top.append(qel('span', qcss.meta + 'margin-left:auto;', now.includes(a) ? meetWhen(a).replace(/ \((.*)\)$/, ' · $1') : formatClock(a.due % 24)));
			card.append(top, qel('div', qcss.title, a.gathering ? gatherTitle(a) : `Meet ${a.npcName} at ${a.place.name}`));
			if (a.gathering) card.append(qel('div', qcss.meta, `Hosted by ${a.npcName} · ${a.place.name}`));
			const at = now.includes(a) && worldPosition(W, a.place.pos);
			if (at) { const line = qel('div', ''); line.append(bearing({ x: at.x, z: at.z, radius: a.place.radius })); card.append(line); }
			if (now.includes(a)) {
				const row = qel('div', qcss.row);
				if (a.status === 'proposed') { const ok = qel('button', qcss.primary, 'Agree'); ok.onclick = () => { if (book().agree(a.id).ok) { gd.tracked = a.id; api.social.state.remember(a.npcId, 'event', `You agreed to meet the traveller at ${a.place.name} at ${formatClock(a.due % 24)}.`); } showQuests(); }; row.append(ok); }
				else row.append(trackButton(null, 'meeting', a.id));
				const no = qel('button', qcss.ghost + 'margin-left:auto;', a.status === 'proposed' ? 'Decline' : 'Cancel');
				no.onclick = () => { book().cancel(a.id); if (a.status === 'agreed') api.social.state.remember(a.npcId, 'event', `The traveller called off your meeting at ${a.place.name}.`); showQuests(); };
				row.append(no); card.append(row);
			}
			return card;
		};
		for (const a of now) log.append(meetCard(a));
		if (past.length) { const inner = folded('Past meetings', past.length); for (const a of past) inner.append(meetCard(a)); }
		if (book().status().error) say(book().status().error, 'note');
	}

	// ----- a world's own errands (an off-world colony's crew, planet/colony/)
	const own = api.world()?.colony?.crew?.journal?.();
	if (own) {
		section(own.title);
		for (const e of own.list) {
			const card = qel('div', qcss.card + (e.active ? `border-left:3px solid ${QC.teal};` : 'opacity:.75;'));
			card.append(qel('div', e.active ? qcss.title + 'font-size:14px;' : qcss.body, e.text));
			if (e.track) card.append(trackButton(e.track, 'crew', e.text));
			log.append(card);
		}
		if (own.log.length) { const inner = folded('Crew log', own.log.length); for (const l of own.log) inner.append(qel('div', qcss.meta, l)); }
	}

	// ----- exploration: the things there are to find, open ones first with the way there
	const goals = QUESTS.filter(q => (q[0] !== 'home' || store.get('crysis-home', null)) && (!q[2] || find(q[2]))), found = goals.filter(q => journal[q[0]]), open = goals.filter(q => !journal[q[0]]);
	section('Exploration', `${found.length} of ${goals.length} found`);
	const card = qel('div', qcss.card + 'gap:6px;');
	card.append(progressBar(found.length, goals.length, QC.green));
	const goalRow = (q) => {
		const at = !journal[q[0]] && q[2] ? explorePlace(q[0]) : null;
		const row = qel('div', 'display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid rgba(255,255,255,.06);');
		row.append(stepRow(journal[q[0]] ? 'done' : 'next', q[1], at));
		row.firstChild.style.flex = '1'; row.firstChild.style.padding = '2px 0';
		if (at) { const b = trackButton(null, 'explore', q[0]); b.style.flexShrink = '0'; row.append(b); }
		return row;
	};
	for (const q of open) card.append(goalRow(q));
	log.append(card);
	if (found.length) { const inner = folded('Found', found.length); const box = qel('div', qcss.card + 'gap:2px;'); for (const q of found) box.append(goalRow(q)); inner.append(box); }
	const caves = qel('button', btnCss + 'align-self:flex-start;', 'Cave entrances and discoveries'); caves.onclick = showCaves; log.append(caves);
	log.scrollTop = 0;
}

export function guideCommunityProjects(gd) {
	const { api, btnCss, communityScope, el, log, say, showProjectReview, showStory,
		updateProjectProgress } = gd;
	const snapshot=api.communityProjects?.snapshot?.();
	if(!snapshot)return;
	say('COMMUNITY PROJECTS','note');say(projectScopeText(snapshot),'note');
	if(snapshot.error)say(snapshot.error,'note');
	const epoch=gd.viewEpoch, scope=communityScope(snapshot);
	if(scope!==gd.communityPageScope){gd.communityPageScope=scope;gd.communityPage=0;}
	const pages=Math.max(1,Math.ceil(snapshot.projects.length/12));gd.communityPage=Math.min(gd.communityPage,pages-1);
	const cards=communityProjectCards(snapshot,Date.now(),gd.communityPage*12);
	const valid=()=>gd.view==='story' && gd.viewEpoch===epoch && communityScope(api.communityProjects?.snapshot?.())===scope;
	async function actProject(id,operation,args={},row=null) {
		if(!valid())return;
		if(row)for(const b of row.querySelectorAll('button'))b.disabled=true;
		if(gd.projectProgressView)gd.projectProgressView.pending=true;
		try{const result=await api.communityProjects.action(id,operation,args);if(!valid())return;const scrollTop=log.scrollTop;if(operation==='start' && result?.ok)gd.communityPage=0;showStory();log.scrollTop=scrollTop;if(result?.message || result?.error)say(result.message || result.error,'note');}
		catch{if(valid()){say('This project could not be checked. Please try again.','note');if(row)for(const b of row.querySelectorAll('button'))b.disabled=false;if(gd.projectProgressView)gd.projectProgressView.pending=false;}}
	}
	if(!cards.length)say('A little work here can leave something lasting. Choose a nearby site, survey it, and help bring it to life.','note');
	for(const card of cards) {
		say(card.line,'guide');
		const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
		function button(label,operation,args){const b=el('button',btnCss,label);b.onclick=()=>actProject(card.id,operation,args,row);row.append(b);return b;}
		button('Show project site','mark');
		if(card.active) {
			const line=el('div','color:#b8d8ce;'),progress=el('progress','width:100%;height:8px;flex-shrink:0;accent-color:#5bd8ad;');progress.max=1;progress.setAttribute('aria-label',card.active.kind==='survey'?'Survey progress':'Work progress');log.append(line,progress);
			const finish=button('Record '+(card.active.kind==='survey'?'survey':'work'),'finish');finish.disabled=true;
			button('Pause work','cancel');const resume=el('button',btnCss,'Review current work');resume.hidden=true;resume.onclick=showStory;row.append(resume);
			gd.projectProgressView={epoch,scope,projectId:card.id,kind:card.active.kind,line,progress,finish,resume,pending:false};
		}else if(!card.done && !card.paused && !card.readyAt && snapshot.mode!=='offline') {
			const kind=card.survey<1?'survey':'work';
			if(kind==='survey' || card.work<3) { const start=button(kind==='survey'?'Survey site · 5 sec':'Help build · 30 sec','start',{kind});start.disabled=!!snapshot.active; }
			for(const service of (card.serviceSources||[]).slice(0,3)) {
				const requestId=typeof service==='string'?service:service.requestId || service.id;
				if(requestId)button('Contribute '+(service.title || service.label || 'completed local work'),'contribute-service',{requestId});
			}
		}
		if(card.done && card.kind==='resonance')button('Play the stones','play');
		log.append(row);
		const history=projectHistoryLines(card),events=history.slice(-2);
		for(const event of events)say(event,'note');
		if(history.length>2){const more=el('button',btnCss,'Read project history'),section=el('div','display:none;');for(const line of history)section.append(el('div','margin:8px 0;color:#b8c7c2;font-size:12px;white-space:pre-wrap;',line));more.onclick=()=>{const open=section.style.display==='none';section.style.display=open?'block':'none';more.textContent=open?'Close project history':'Read project history';};log.append(more,section);}
	}
	if(pages>1){const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');if(gd.communityPage>0){const b=el('button',btnCss,'Earlier community projects');b.onclick=()=>{gd.communityPage--;showStory();};row.append(b);}if(gd.communityPage<pages-1){const b=el('button',btnCss,'More community projects');b.onclick=()=>{gd.communityPage++;showStory();};row.append(b);}log.append(row);}
	const availableSites=(snapshot.candidates || []).filter(c=>!snapshot.projects.some(p=>p.siteId===(c.siteId || c.id)));
	if(availableSites.length) {
		say('PLACES TO IMPROVE','note');
		for(const candidate of availableSites.slice(0,4)) {
			say(candidate.name,'note');const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
			const at=candidate.anchor, distance=at?Math.hypot(api.camera.position.x-at.x,api.camera.position.z-at.z):Infinity;
			const near=candidate.canPropose ?? candidate.inRange ?? distance<=6;
			if(near && snapshot.mode!=='offline')for(const kind of candidate.kinds) {
				const b=el('button',btnCss,'Review '+projectKindLabel(kind).toLowerCase());
				b.onclick=()=>{if(valid())showProjectReview({candidateId:candidate.id,kind,scope},null);};row.append(b);
			}else {const b=el('button',btnCss,'Visit this site');b.onclick=()=>actProject(candidate.id,'mark',{},row);row.append(b);}
			log.append(row);
		}
	}
	updateProjectProgress();
}

export function guideLivingActivity(gd) {
	const { api, btnCss, el, log, say, showStory, talkTo, waypointMark } = gd;
	const snapshot=api.livingWorld?.snapshot?.();
	if (!snapshot) return;
	say('LIFE AROUND YOU','note');
	if(snapshot.scope)say(activityScopeText(snapshot),'note');
	if(snapshot.catchup?.text||snapshot.catchup?.message)say(snapshot.catchup.text||snapshot.catchup.message,'note');
	if(snapshot.error)say(snapshot.error,'note');
	for(const resident of (snapshot.residents || []).slice(0,4))say(resident.line+' Currently '+resident.activity.replaceAll('-', ' ')+'.','note');
	const scope=snapshot.scope?.key||snapshot.scope?.name||snapshot.scope;
	if(scope!==gd.livingActivityScope){gd.livingActivityScope=scope;gd.livingActivityPage=0;}
	const count=snapshot.activities?.length||0,pages=Math.max(1,Math.ceil(count/6));gd.livingActivityPage=Math.min(gd.livingActivityPage,pages-1);
	const cards=activityCards(snapshot,gd.livingActivityPage*6), epoch=gd.viewEpoch;
	if(!cards.length)say('No local activity has been recorded here yet. Meet residents and explore to discover what they are working on.','note');
	for(const card of cards){
		say(card.line,'guide'); for(const line of card.history)say(line,'note');
		const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
		async function actLiving(action,options={}) {
			if(gd.view!=='story'||gd.viewEpoch!==epoch)return;
			for(const b of row.children)b.disabled=true;
			try{
				const result=await api.livingWorld.action(card.id,action,options);
				if(gd.view!=='story'||gd.viewEpoch!==epoch)return;
				if(result?.actor){talkTo(result.actor);return;}
				if(result?.at && Number.isFinite(result.at.x) && Number.isFinite(result.at.z)){
					gd.livingContact={...result.at,y:Number.isFinite(result.at.y)?result.at.y:api.world().island.heightAt(result.at.x,result.at.z),bodyKey:api.social?.bodyKey(),radius:4,title:'Find '+(card.npcName||'the resident'),detail:card.title};
					api.waypoint?.set(waypointMark());
				}
				if(result?.choices?.length){
					say(result.message||'What would you like to propose?','note');
					for(const c of result.choices.slice(0,4)){const b=el('button',btnCss,c.label);b.onclick=()=>actLiving('intervene',{choiceId:c.id});row.append(b);}
				}else{showStory();if(result?.message||result?.error)say(result.message||result.error,'note');}
			}catch{if(gd.view==='story'&&gd.viewEpoch===epoch)say('That activity could not be checked. Please try again.','note');}
			finally{for(const b of row.children)b.disabled=false;}
		}
		function button(label,action,options){const b=el('button',btnCss,label);b.onclick=()=>actLiving(action,options);row.append(b);}
		if(card.canJoin)button('Lend a hand','join');
		if(card.canContact)button('Find '+(card.npcName||'the resident'),'contact');
		if(card.pendingAck)button('Acknowledge result','acknowledge');
		else if(card.canProgress)button('Continue task','progress');
		if(card.canLeave||card.canRelease)button('Leave activity','release');
		if(card.canIntervene){
			if(card.choices.length)for(const c of card.choices)button(c.label,'intervene',{choiceId:c.id});
			else button('Discuss alternatives','intervene');
		}
		log.append(row);
	}
	if(pages>1){
		const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
		if(gd.livingActivityPage>0){const b=el('button',btnCss,'Earlier activities');b.onclick=()=>{gd.livingActivityPage--;showStory();};row.append(b);}
		if(gd.livingActivityPage<pages-1){const b=el('button',btnCss,'More local activity');b.onclick=()=>{gd.livingActivityPage++;showStory();};row.append(b);}
		log.append(row);
	}
	const shown=new Set(cards.flatMap(c=>c.history));
	const recent=(snapshot.history||[]).slice(-5).map(e=>typeof e==='string'?e:e.text||e.message).filter(t=>t&&!shown.has(t));
	if(recent.length){say('RECENT LOCAL EVENTS','note');for(const line of recent)say(String(line).slice(0,320),'note');}
	const routines=(snapshot.routines||[]).slice(0,4);
	if(routines.length)say(routines.map(a=>`${a.name||'A resident'} · ${String(a.activity||'daily life').replaceAll('-',' ')}`).join('\n'),'note');
}

export function guideStory(gd) {
	const { api, btnCss, chronicle, el, endTalk, log, resetView, say, show, showCommunityProjects,
		showLivingActivity, showStory } = gd;
	endTalk(); resetView('story'); show(true);
	const M = api.combat?.morality, R = M?.reactions?.(), me = M?.me?.() || {}, E = api.errands?.info?.() || {}, F = api.fares?.info?.() || {};
	const bar = (k) => '▰'.repeat(Math.round(k * 10)) + '▱'.repeat(10 - Math.round(k * 10));
	const rung = (ladder, count, what) => { const r = rankOf(ladder, count); return `${r.title} · ${count} ${what}${r.next ? `\n${bar(r.k)} ${r.next.at - count} more to ${r.next.title}` : '\nThe top of the ladder.'}`; };
	const bonds=chronicle.bonds(api.social?.bodyKey()).filter(b=>b.last);
	if(bonds.length){say('PEOPLE WHO KNOW YOU','note');for(const b of bonds.slice(-8))say(`${b.name} · ${b.label}\n${b.last}`,'guide');}
	const projects=chronicle.projects(api.social?.bodyKey());
	if(projects.length){say('WHAT WE LEFT BEHIND','note');for(const p of projects.slice(-8))say(`${p.name} · ${p.npc}\n${p.choice==='marked'?'Marked route: small signs remain at your surveyed stops.':'Quiet route: saved in your journal; the landscape stays untouched.'}\n${p.landmarks.map(t=>t.name).join(' → ')}`,'guide');}
	showLivingActivity();
	showCommunityProjects();
	if(chronicle.status().error)say(chronicle.status().error,'note');
	const D = api.daily?.list?.();
	if (D) {
		say(`TODAY · ${D.goals.filter((g) => g.done).length} of ${D.goals.length} done${D.bonus ? ' · bonus paid' : ''}`, 'note');
		say(D.goals.map((g) => `${g.done ? '✓' : '○'} ${g.text}${g.need > 1 && !g.done ? ` (${g.got}/${g.need})` : ''} · ${g.credits} credits`).join('\n') + (D.bonus ? '' : '\nAll three: a bonus of 150 credits'), 'guide');
	}
	say('WHO THEY SAY YOU ARE', 'note');
	say(`${R?.title && R.title !== 'Unknown' ? R.title : 'Your wider reputation is still taking shape'}${R ? ` · standing ${R.reputation > 0 ? '+' : ''}${R.reputation}` : ''}${R?.bounty ? ` · wanted (${R.bounty})` : ''}\nMerciful ${Math.round(me.mercy || 0)} · Lawful ${Math.round(me.law || 0)} · Protector ${Math.round(me.protect || 0)} · Honest ${Math.round(me.honest || 0)}`, 'guide');
	if (R?.song) say(R.song, 'note');
	const soul = api.soul, saved = soul?.info();
	if (saved) {
		say(saved.status === 'saved' && !saved.pending ? 'Reputation saved across visits and rooms.' : saved.savedLocally ? (saved.cloudAvailable === false ? 'Reputation saved on this device.' : 'Reputation saved on this device. Cloud save pending.') : 'Reputation is not safely saved yet. Save your recovery key.', 'note');
		if (saved.error) say(saved.error, 'note');
		say('Your standing does not fade with time. To release it, fly to Gargantua’s island and walk into the soul tunnel to the Quiet Well.', 'note');
		const copy = el('button', btnCss, 'Save soul recovery key');
		copy.onclick = async () => { try { await navigator.clipboard.writeText(soul.recoveryKey()); say('Recovery key copied. Keep it private and safe. It restores this soul on another device.', 'note'); } catch { say('Clipboard unavailable. Use a browser with clipboard access to save your recovery key.', 'note'); } };
		const restore = el('button', btnCss, 'Restore a saved soul');
		restore.onclick = () => {
			const input = el('input', 'padding:10px;color:#fff;background:#10252d;border:1px solid #777;border-radius:8px;'); input.type = 'password'; input.name = 'soul-recovery-key'; input.autocomplete = 'off'; input.placeholder = 'Private recovery key'; input.setAttribute('aria-label','Private soul recovery key');
			const use = el('button', btnCss, 'Restore'); use.onclick = async () => { use.disabled = true; try { await soul.recover(input.value); input.value = ''; api.multiplayer?.linkSoul?.(soul); showStory(); } catch(e) { say(e.message, 'note'); use.disabled = false; } }; log.append(input, use);
		};
		log.append(copy, restore);
	}

	say('FAVOURS', 'note');
	say(rung('favours', E.done || 0, 'done') + (E.kept ? `\nWallets kept: ${E.kept}` : ''), 'guide');
	if (E.errand) {
		say(`Under way: ${E.errand.title} (${E.errand.stage})`, 'guide');
		const give = el('button', btnCss, 'Give up on it'); give.onclick = () => { api.errands.cancel(); showStory(); }; log.append(give);
	}
	const leads = api.npcQuests?.leads?.() || [];
	if (leads.length) { say('LEADS', 'note'); for (const L of leads.slice(0, 4)) say(L.note + (L.here ? ' (round here: follow the marker)' : ''), 'guide'); }
	say('FARES', 'note');
	say(rung('fares', F.rides || 0, 'rides') + `\nEarned ${F.earned || 0} credits · ${F.five || 0} five-star rides`, 'guide');
	if (F.fare) say(`In the car now: ${F.fare.name}${F.fare.place ? ' to ' + F.fare.place : ''} · fare ${F.fare.fare}`, 'guide');
	const recent = M?.log?.(5) || [];
	if (recent.length) { say('LATELY', 'note'); for (const e of recent.slice().reverse()) say(e.line + (e.place ? ` · ${e.place}` : ''), 'note'); }
	log.scrollTop = 0;
}

export function guideCaves(gd) {
	const { api, btnCss, caveVisits, dirTo, el, endTalk, fmtDist, log, resetView, say, show,
		targets } = gd;
	endTalk(); resetView('journal'); show(true);
	const W = api.world(), cam = api.camera.position;
	say('CAVE EXPLORATION', 'note');
	say('Walk through a hillside mouth into the underground. Strike the three resonant stones in an alcove (look at one and press E, or tap it) to restore guiding lights. You can walk back to the surface at any time.', 'guide');
	const caves = targets().filter(t => t.caveEntrance !== undefined).sort((a,b) => Math.hypot(a.x-cam.x,a.z-cam.z)-Math.hypot(b.x-cam.x,b.z-cam.z));
	if (!caves.length) say('There are no mapped land-cave entrances on this surface.', 'note');
	for (const t of caves) {
		say(`${t.name} · ${fmtDist(Math.hypot(t.x-cam.x,t.z-cam.z))} ${dirTo(t.x-cam.x,t.z-cam.z)}`, 'guide');
		const face = el('button', btnCss, 'Look toward '+t.name);
		face.onclick = () => { const P = W.player.state; P.yaw = Math.atan2(-(t.x-P.pos.x),-(t.z-P.pos.z)); P.pitch = -.08; show(false); api.hint(`${t.name}: follow this bearing to the hillside mouth.`, 5000); };
		log.append(face);
	}
	if (caveVisits[api.social?.bodyKey()]) say('✓ You have explored this world’s underground.', 'note');
	const stats = W?.underworld?.elements?.stats();
	if (stats) say(`${stats.completed} of ${stats.sites} resonance alcoves restored. ${stats.saveError || 'Progress is saved on this device.'}`, 'note');
	const deep = W?.deep?.info();
	if (deep) say(deep.open ? `The Deep Gate is open. Deepest reached: ${deep.deepest} m; ${deep.waystones} waystone${deep.waystones === 1 ? '' : 's'} touched; ${deep.alcoves} deep alcove${deep.alcoves === 1 ? '' : 's'} restored.` : `The Deep Gate is sealed. It lies at the end of the caves beneath the summit${W.deep.gate.via ? ', in from ' + W.deep.gate.via.name : ''}: strike one of its five stones, listen, and play the phrase back.`, 'note');
}

export function guideSettings(gd) {
	const { btnCss, choice, connect, drawSettings, el, localSpeech, phone, settings, speechStatusEl,
		store } = gd;
	settings.innerHTML = '';
	const row = (label, node) => { const r = el('label', 'display:flex;align-items:center;gap:8px;margin:6px 0;'); r.append(el('span', 'width:74px;color:rgba(255,255,255,.6);', label), node); settings.append(r); return r; };
	const styleSelect=(label,key,options)=>{const control=el('select','flex:1;min-width:0;padding:8px;background:#1a1a1a;color:#fff;border:1px solid #555;border-radius:8px;');control.name='dialogue-'+key;control.setAttribute('aria-label',label);for(const [value,text] of options){const o=el('option',null,text);o.value=value;control.append(o);}control.value=gd.dialogueStyle[key];control.onchange=()=>{gd.dialogueStyle=normalizeDialogueStyle({...gd.dialogueStyle,[key]:control.value});store.set('crysis-dialogue-style',gd.dialogueStyle);};row(label,control);};
	styleSelect('Language','tone',[['clean','Clean'],['mature','Mature · natural profanity and adult themes']]);
	styleSelect('Personality','vividness',[['restrained','Understated'],['bold','Bold · strong opinions and vivid storytelling']]);
	styleSelect('Replies','response',[['brief','Brief'],['balanced','Balanced'],['rich','Rich · more detail']]);
	settings.append(el('div','color:rgba(255,255,255,.65);margin:6px 0;','Tone follows each character. Mature themes apply to adult NPCs; model and provider limits still apply.'));
	const speechSelect = el('select', 'flex:1;min-width:0;padding:8px;background:#1a1a1a;color:#fff;border:1px solid #555;border-radius:8px;'); speechSelect.name = 'guide-voice';
	speechSelect.setAttribute('aria-label', 'Voices');
	for (const [value, text] of VOICE_MODES) { const o = el('option', null, text); o.value = value; speechSelect.append(o); }
	speechSelect.value = gd.speechMode;
	// choosing again is also how a phone that could not hold the local voices tries once more
	speechSelect.onchange = () => { localSpeech.cancel(); if ('speechSynthesis' in window) speechSynthesis.cancel(); gd.speechMode = voiceMode(speechSelect.value); if (gd.speechMode !== 'device') localSpeech.retry(); store.set('crysis-voices', gd.speechMode); speechStatusEl.textContent = ''; };
	row('Voices', speechSelect);
	settings.append(el('div', 'color:rgba(255,255,255,.6);margin:6px 0;', 'Best available: common lines play from voices made ahead of time, other lines from the local voices (about 100 MB once; on a phone only after a few calm minutes) or the device voice. Local always loads the local voices on any device.'));
	const sel = el('select', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);');
	const opts = phone ? [['none', 'Built-in guide (models are off on phones)']] : [['none', 'Built-in guide (no model)'], ['webllm', 'On this device (WebGPU)'], ['ollama', 'Ollama on this computer']];
	// the shared voice, once the discovery server is deployed (earth/config.js): phones too
	if (DISCOVERY_URL) opts.push(['cloud', 'Free cloud voice (people only)']);
	for (const [v, t] of opts) { const o = el('option', null, t); o.value = v; sel.append(o); }
	sel.name = 'dialogue-source'; sel.value = choice.kind;
	row('Dialogue', sel);
	if (choice.kind === 'webllm') {
		const m = el('select', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);');
		for (const x of WEBLLM_MODELS) { const o = el('option', null, x.label); o.value = x.id; m.append(o); }
		m.name = 'dialogue-model'; m.value = choice.id; m.onchange = () => { choice.id = m.value; };
		row('Model', m);
		settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', hasWebGPU() ? 'Downloads once, then runs offline. Nothing you say leaves this device.' : 'This browser has no WebGPU (try Chrome or Edge on desktop or Android), or use Ollama.'));
	}
	if (choice.kind === 'cloud') settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', 'People answer from a small model on the game\'s own server, inside a free daily allowance. What you say to them is sent there to answer and is not kept. When the day\'s share is used, they use their own lines.'));
	if (choice.kind === 'ollama') {
		const u = el('input', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);'); u.name = 'ollama-address'; u.value = choice.url; u.onchange = () => { choice.url = u.value; };
		const n = el('input', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);'); n.name = 'ollama-model'; n.value = choice.name; n.onchange = () => { choice.name = n.value; };
		row('Address', u); row('Model', n);
		settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', `Install Ollama, "ollama pull ${choice.name}", then start it with OLLAMA_ORIGINS=${location.origin} ollama serve`));
	}
	const go = el('button', btnCss + 'width:100%;margin-top:4px;background:linear-gradient(135deg,#01a982,#10b981);border:none;', choice.kind === 'none' ? 'Use the built-in guide' : 'Load and use');
	go.onclick = () => connect(true);
	settings.append(go);
	sel.onchange = () => { choice.kind = sel.value; drawSettings(); };
}
