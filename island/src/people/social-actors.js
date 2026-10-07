// Persistent identities own their bodies; crowd slots are detached, never pinned forever.
import * as THREE from 'three';
import { loadPeopleAssets, buildPerson } from './body.js';
import { createMotion } from './motion.js';
import { addTalkers, talkers } from './people.js';
import { fadePerson } from './fade.js';
import { toLL, toXZ, F } from '../earth/globeframe.js';

export function positionFor(world, p) { return world?.globe ? { ...toLL(p.x, p.z), y: p.y } : { x: p.x, z: p.z, y: p.y }; }
export function worldPosition(world, p) { if (!p) return null; const q = world?.globe && Number.isFinite(p.lat) ? toXZ(p.lat, p.lon) : p; return Number.isFinite(q.x) && Number.isFinite(q.z) ? { x: q.x, y: p.y ?? 0, z: q.z } : null; }

// Testable, conservative movement check. The same extraFloor/extraPush used by the
// player participates; short steps cannot tunnel through a wall or jump a cliff.
export function safeSocialStep(island, from, to, player = null) {
 const ground = island.drawnAt ?? island.heightAt;
 const under = island.underFloor?.(to.x, to.z, from.y);
 const base = ground(to.x, to.z);
 const floor = island.extraFloor?.(to.x, to.z, from.y + 1) ?? -1e9;
 const y = under ?? player?.floorAt?.(to.x,to.z,from.y) ?? Math.max(base, floor);
 if (!Number.isFinite(y) || (under == null && base < .35 && floor < -1e8 && y < .35) || Math.abs(y - from.y) > .6) return null;
 if (under != null && island.underClear && !island.underClear(to.x,y,to.z,1.68,.35)) return null;
 const q = new THREE.Vector3(to.x, y + 1.68, to.z);
 if(player?.pushOut) player.pushOut(q);
 else if(under != null) island.underPush?.(q,y);
 else island.extraPush?.(q, y);
 const overlap = Math.hypot(q.x - to.x, q.z - to.z);
 if (overlap > .04) {
  // A seated/ambient resident may begin slightly inside a prop's safety margin.
  // Permit walking out only while penetration decreases; never snap the body.
  const origin = new THREE.Vector3(from.x,from.y+1.68,from.z);
  if(player?.pushOut) player.pushOut(origin);
  else if(island.underFloor?.(from.x,from.z,from.y)!=null) island.underPush?.(origin,from.y);
  else island.extraPush?.(origin,from.y);
  const previous = Math.hypot(origin.x-from.x,origin.z-from.z);
  if (previous <= .04 || overlap >= previous - 1e-7) return null;
 }
 return { x: to.x, y, z: to.z };
}

function freeBody(P) {
 // Eyes and accessories share materials; textures and eye geometry belong to assets.
 P.hairWant = null; // invalidate deferred hair-kit completion for this released body
 const sharedGeo = new Set((P.eyes || []).map(e => e.geometry));
 const geometry = new Set(); P.root.traverse(o => { if (o.geometry && !sharedGeo.has(o.geometry)) geometry.add(o.geometry); });
 for (const g of geometry) g.dispose();
 const materials = new Set([P.skinMat, P.clothMat, P.cloth?.material, P.hair?.material, P.beard?.material, P.detail?.material].filter(Boolean));
 for (const m of materials) m.dispose();
 P.skeleton?.dispose(); P.root.removeFromParent();
}

export function createSocialActors({ scene, world, camera, state, people, bodyKey, isPhone = false, hint = () => {} }) {
 const group = new THREE.Group(); group.name = 'remembered residents'; scene.add(group);
 const actors = new Map(), max = isPhone ? 4 : 8;
 let dead = false, generation = 0, loading = false, scan = 0, saveT = 0, epoch = F.epoch;
 const W = () => typeof world === 'function' ? world() : world;
 const key = () => typeof bodyKey === 'function' ? bodyKey() : bodyKey;
 const unregister = addTalkers(() => group.visible ? [...actors.values()].filter(p => p.active) : []);
 function ground(x, z, y) { const I = W()?.island; if (!I) return y ?? 0; const under=I.underFloor?.(x,z,y); if(under != null) return under; const playerFloor=W()?.player?.floorAt?.(x,z,y); if(Number.isFinite(playerFloor)) return playerFloor; const h = (I.drawnAt ?? I.heightAt)(x, z), f = I.extraFloor?.(x, z, (y ?? h) + 1) ?? -1e9; return Math.max(h, f); }
 function syncFrame() {
  if(epoch===F.epoch) return;
  for(const p of actors.values()) { const q=worldPosition(W(),p.lastPosition||state.get(p.socialId)?.position); if(q) p.M.place(q.x,q.y,q.z,p.M.S.heading); }
  epoch=F.epoch;
 }
 function persist(p) { syncFrame(); state.setPosition(p.socialId, positionFor(W(), p.M.S.pos)); }
 function remove(p) { persist(p); actors.delete(p.socialId); p.active = false; freeBody(p.P); }
 function setup(p, record) {
  if(group.parent!==scene) scene.add(group);
  p.socialOwned=true; p.caveMeta=record.persona?.caveMeta || p.caveMeta; if(p.caveMeta)p.P.caveMeta=p.caveMeta;
  p.socialId = p.residentId = record.id; p.persona = record.persona; p.active = true; p.busy = true;
  p.lastPosition=positionFor(W(),p.M.S.pos);
  p.source = 'resident'; p.detachForSocial = null; p.P.job = record.persona?.job || p.P.job;
  p.M.setGround?.((x,z) => ground(x,z,p.M.S.pos.y));
  p.M.stand(); p.M.setPose('rest'); p.M.S.sitK.v = 0; p.M.want.speed = 0;
  group.add(p.P.root); fadePerson(p.P, 1); actors.set(record.id, p); return p;
 }
 function adopt(p, record) {
  if (dead || !record) return null;
  if (actors.has(record.id)) return actors.get(record.id);
  if (!p?.detachForSocial) return null;
  if (actors.size >= max) { const old = [...actors.values()].filter(a => !a.engaged).sort((a,b) => b.M.S.pos.distanceTo(camera.position)-a.M.S.pos.distanceTo(camera.position))[0]; if (!old) return null; remove(old); }
  if (!p.detachForSocial()) return null;
  return setup(p, record);
 }
 async function restore(record) {
  if (loading || dead || actors.size >= max) return;
  loading = true; const token = generation;
  try {
   const A = await loadPeopleAssets();
   if (dead || token !== generation || actors.has(record.id) || actors.size >= max) return;
   const pos = worldPosition(W(), record.position);
   if (!pos || Math.hypot(pos.x-camera.position.x,pos.z-camera.position.z)>150) return;
   const P = buildPerson(A, JSON.parse(JSON.stringify(record.dna)));
   let M; M = createMotion(P, (x,z) => ground(x,z,M?.S.pos.y));
   M.place(pos.x, ground(pos.x,pos.z,pos.y),pos.z,0);
   setup({P,M,engaged:false},record);
  } catch(e) { console.warn('[social actors]', e); }
  finally { if (token === generation) loading = false; }
 }
 function move(p, target, speed, dt, t) {
  const S = p.M.S, start = S.pos.clone(), dx = target.x-start.x, dz = target.z-start.z, distance = Math.hypot(dx,dz);
  p.M.want.speed = distance > 1.8 ? speed : 0; if (distance > .01) p.M.want.heading = Math.atan2(dx,dz);
  // Damped heading may still point at a wall: validate actual motion afterwards too.
  const probe = {x:start.x+Math.sin(S.heading)*speed*dt,z:start.z+Math.cos(S.heading)*speed*dt};
  let obstructed = p.M.want.speed > 0 && !safeSocialStep(W().island,start,probe,W().player);
  if (obstructed) { p.M.want.speed=0; S.speed.v=0; S.speed.dv=0; }
  p.M.update(dt,t,camera.position);
  const moved = Math.hypot(S.pos.x-start.x,S.pos.z-start.z)>1e-9;
  const accepted = moved ? safeSocialStep(W().island,start,S.pos,W().player) : {y:start.y};
  if (!accepted) {
   // Retain the completed turn when translation is blocked. Resetting motion
   // here would pin a resident inside an existing prop margin forever.
   S.pos.copy(start); p.P.root.position.copy(start); S.speed.v=0; S.speed.dv=0; obstructed=true;
  } else { S.pos.y=accepted.y; p.P.root.position.y=accepted.y; }
  if (obstructed) p.blocked=(p.blocked||0)+dt;
  else if (moved || speed===0) p.blocked=0;
  return distance;
 }
 function update(dt,t,enabled=true) {
  if (dead) return;
  if(group.parent!==scene) scene.add(group);
  group.visible=!!enabled;
  if (!enabled || !W()?.island) return;
  dt=Math.min(.05,Math.max(0,dt));
  syncFrame();
  scan-=dt; saveT+=dt;
  if(scan<=0) {
   scan=1;
   for(const p of [...actors.values()]) if(!p.engaged && p.M.S.pos.distanceTo(camera.position)>180) remove(p);
   const candidates=state.list(key()).filter(r=>!actors.has(r.id)).map(r=>({r,q:worldPosition(W(),r.position)})).filter(v=>v.q && Math.hypot(v.q.x-camera.position.x,v.q.z-camera.position.z)<130).sort((a,b)=>Math.hypot(a.q.x-camera.position.x,a.q.z-camera.position.z)-Math.hypot(b.q.x-camera.position.x,b.q.z-camera.position.z));
   // A fresh crowd pool can repeat a procedural seed after reload. Remove that
   // incarnation: its outfit/position can differ, so restore from saved DNA instead.
   const records=state.list(key());
   for(const ambient of [...(people?.pool||[]),...talkers()].slice(0,60)) {
    if(ambient.socialId || ambient.engaged || !ambient.active || !ambient.detachForSocial) continue;
    const resident=records.find(r=>(ambient.caveMeta?.id && r.persona?.caveMeta?.id===ambient.caveMeta.id) || r.dna?.seed===ambient.P.dna.seed && (()=>{const q=worldPosition(W(),r.position);return q && Math.hypot(q.x-ambient.M.S.pos.x,q.z-ambient.M.S.pos.z)<35;})());
    if(!resident) continue;
    if(ambient.detachForSocial()) { ambient.active=false; freeBody(ambient.P); }
   }
   if(candidates.length && !actors.has(candidates[0].r.id)) void restore(candidates[0].r);
  }
  for(const p of actors.values()) {
   const r=state.get(p.socialId); if(!r) continue;
   const S=p.M.S; let target=S.pos, speed=0;
   const alarm=state.alarmFor(key(),positionFor(W(),S.pos));
   if(p.engaged) { S.look.target=camera.position; S.talk=(p.speakUntil||0)>performance.now()?1:0; p.M.want.heading=Math.atan2(camera.position.x-S.pos.x,camera.position.z-S.pos.z); }
   else {
    S.talk=0; S.look.target=null;
    if(r.mode==='follow'||r.mode==='quest') { target=camera.position; speed=target.distanceTo(S.pos)>7?2.8:1.5; if(Math.abs(target.y-S.pos.y)>5) speed=0; }
    if(r.mode==='home') { target=worldPosition(W(),r.home)||S.pos; speed=1.4; }
    if(r.mode==='scout') { target=worldPosition(W(),r.task?.target)||S.pos; speed=1.8; }
    // on the way to an agreed meeting: walk there, then wait on the spot
    if(r.mode==='meet') { target=worldPosition(W(),r.task?.target)||S.pos; speed=r.task?.status==='waiting'?0:1.7; }
    if(alarm.level>.2 && r.mode!=='follow' && r.mode!=='quest') { const source=worldPosition(W(),alarm.position); const a=source?Math.atan2(S.pos.x-source.x,S.pos.z-source.z):(p.P.dna.seed%628)/100; target={x:S.pos.x+Math.sin(a)*6,z:S.pos.z+Math.cos(a)*6}; speed=1.5+alarm.level; S.look.target=camera.position; }
   }
   const d=move(p,target,speed,dt,t); p.P.lod?.(p.M.S.pos.distanceTo(camera.position));
   if(!p.engaged && !alarm.level && d<1.8 && (r.mode==='home'||r.mode==='scout')) {
    if(r.mode==='scout' && r.task?.target) { state.setMode(r.id,'home',{...r.task,status:'returning',report:'Reached the scouting point; returning home.'}); }
    else { const task=r.task?{...r.task,status:'completed',completedAt:Date.now(),report:'Scouted the destination and returned home.'}:null; state.setMode(r.id,'wait',task); state.remember?.(r.id,'system',task?.report||'Returned home.'); hint(`${r.persona?.name||'Your companion'} arrived.`); }
   }
   if(!p.engaged && r.mode==='meet' && r.task?.status!=='waiting' && d<2.5) state.setMode(r.id,'meet',{...r.task,status:'waiting'});
   // a resident walking to a meeting who meets a wall out of the player's sight goes round it
   if(!p.engaged && r.mode==='meet' && p.blocked>4 && S.pos.distanceTo(camera.position)>45) { const q=worldPosition(W(),r.task?.target); if(q){ p.M.place(q.x,ground(q.x,q.z,q.y),q.z,S.heading); p.blocked=0; state.setMode(r.id,'meet',{...r.task,status:'waiting'}); } }
   if(!p.engaged && p.blocked>8 && speed>0) { state.setMode(r.id,'wait',r.task?{...r.task,status:'blocked',report:'The route is obstructed. Waiting safely.'}:null); hint(`${r.persona?.name||'Your companion'} is waiting at an obstacle.`); p.blocked=0; }
   p.lastPosition=positionFor(W(),S.pos);
   if(saveT>2) persist(p);
  }
  // Ambient villagers react to the same local event without becoming saved residents.
  for(const p of [...(people?.pool||[]),...talkers()].slice(0,60)) {
   if(p.socialId || !p.active || !p.P.root.visible || p.engaged) continue;
   const S=p.M.S, alarm=state.alarmFor(key(),positionFor(W(),S.pos));
   if(alarm.level<=.2) continue;
   const source=worldPosition(W(),alarm.position); const a=source?Math.atan2(S.pos.x-source.x,S.pos.z-source.z):(p.P.dna.seed%628)/100, step=.8*alarm.level*dt;
   const q=safeSocialStep(W().island,S.pos,{x:S.pos.x+Math.sin(a)*step,z:S.pos.z+Math.cos(a)*step},W().player);
   if(q) p.M.place(q.x,q.y,q.z,a);
   S.look.target=camera.position;
  }
  if(saveT>2) { saveT=0; state.flush?.(); }
 }
 function flush() { for(const p of actors.values()) persist(p); state.flush?.(); }
 function reset() { generation++; loading=false; for(const p of [...actors.values()]) remove(p); state.flush?.(); scan=0; epoch=F.epoch; }
 function dispose() { reset(); dead=true; unregister(); group.removeFromParent(); }
 return {adopt,ensure:adopt,all:()=>[...actors.values()],update,flush,reset,dispose,info:()=>({active:actors.size,max,loading,bindings:[...actors.keys()]})};
}
