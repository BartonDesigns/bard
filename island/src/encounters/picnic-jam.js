import * as THREE from 'three';
import { loadPeopleAssets } from '../people/body.js';
import { picnicProps, disposePicnicProps } from './picnic-props.js';
import { createPicnicPerformer } from './picnic-performers.js';
import { createPicnicAudio } from './picnic-audio.js';
import { PICNIC, CAST, eligiblePicnic, picnicDue, picnicGround, findPicnicSpot, picnicSeats, shotOnBeat } from './picnic-plan.js';

// A small, local ambient encounter. It doesn't join a faction or dispatch combat events.
// All scheduling is driven by the world tick, so hiding/leaving cannot queue a barrage.
export function createPicnicJam({scene,world,camera,profile,mount,isPhone=false,hint=()=>{},busy=()=>false,random=Math.random,loadAssets=loadPeopleAssets}) {
 let active=null, generation=0, scan=0, lastWorld=null, dead=false, memory=new Map();
 const audio=createPicnicAudio(), button=document.createElement('button');
 button.textContent='👏 Join the rhythm';button.hidden=true;button.type='button';
 button.style.cssText='position:absolute;bottom:calc(116px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);z-index:24;padding:11px 18px;border:1px solid #d6b57788;border-radius:22px;background:#192720eb;color:#fff1d5;font:600 14px system-ui;cursor:pointer;touch-action:manipulation;white-space:nowrap';
 mount.append(button);
 button.onclick=e=>{e.stopPropagation();if(!active?.ready)return;active.joined=!active.joined;button.textContent=active.joined?'👏 Leave the rhythm':'👏 Join the rhythm';button.setAttribute('aria-pressed',String(active.joined));hint(active.joined?'You clap along. Misha never misses a note.':'The off-duty orchestra carries on.',3500);};
 const key=W=>`l99-picnic:${W.body?.key||profile()?.type||'island'}`;
 function lastAt(W) {const k=key(W);if(memory.has(k))return memory.get(k);try{return Number(localStorage.getItem(k))||0;}catch{return 0;}}
 function remember(W) {const k=key(W),n=Date.now();memory.set(k,n);try{localStorage.setItem(k,String(n));}catch{}}
 function allowed(W) {
  const s=W?.player?.state;
  return !!s && eligiblePicnic({type:profile()?.type,hours:W.sky?.state.hours??12,flying:s.flying,submerged:camera.position.y<0 || s.diving,underground:(W.underworld?.inside?.()||0)>.1 || W.deep?.active?.(),busy:busy()||!!W.weather?.state.sheltered||(W.weather?.state.rainHere||0)>.45});
 }
 function blocked(W,x,z,y) {
  if((W.bayArea?.urbanAt?.(x,z)?.u||0)>.15)return true;
  const water=W.lake?.waterAt?.(x,z)??W.water?.waterAt?.(x,z);
  if(water!=null && water>y-.2)return true;
  if(W.city?.treesNear?.(x,z,.7).some(t=>!t.fern))return true;
  if(W.island.paths?.some(p=>W.island.distToPath(x,z,p.points)<3))return true;
  const v=new THREE.Vector3(x,y+1.68,z);W.player.pushOut?.(v);
  return Math.hypot(v.x-x,v.z-z)>.08;
 }
 function spot(W,at) {
  const height=(x,z)=>(W.island.drawnAt||W.island.heightAt)(x,z),block=(x,z,y)=>blocked(W,x,z,y);
  return at ? picnicGround(at.x,at.z,height,block) : findPicnicSpot(camera.position,W.player.state.yaw||0,height,block,random);
 }
 function clear() {
  generation++;audio.silence();button.hidden=true;button.textContent='👏 Join the rhythm';button.setAttribute('aria-pressed','false');
  if(active) {for(const a of active.actors)a.dispose();if(active.props)disposePicnicProps(active.props);active=null;}
 }
 async function summon(at) {
  const W=world();if(dead||active||!allowed(W))return false;
  lastWorld=W;
  const place=spot(W,at);if(!place)return false;
  const token=++generation, D={W,at:place,epoch:W.globe?.frame?.epoch,actors:[],props:null,ready:false,elapsed:0,clock:0,beat:-1,joined:false,announced:false,variant:Math.floor(random()*3)};
  active=D;
  try {
   const A=await loadAssets();if(dead||token!==generation||world()!==W)return false;
   const seats=picnicSeats();D.props=picnicProps(seats);D.props.position.set(place.x,place.y,place.z);scene.add(D.props);
   for(let i=0;i<CAST.length;i++) {
    if(dead||token!==generation||world()!==W||D.epoch!==W.globe?.frame?.epoch){if(active===D)clear();return false;}
    const occupied=(p,who)=>D.actors.some((a,j)=>j!==who&&Math.hypot(p.x-a.M.S.pos.x,p.z-a.M.S.pos.z)<1.0)||Math.abs(camera.position.y-p.y)<2.2&&Math.hypot(p.x-camera.position.x,p.z-camera.position.z)<.85;
    D.actors.push(createPicnicPerformer(A,i,seats[i],place,D.variant,scene,scene.environment,isPhone,occupied));
    D.actors[i].update(1/60,0,camera.position,0,0);
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   if(token!==generation||world()!==W){if(active===D)clear();return false;}
   D.ready=true;remember(W);return true;
  } catch(error) {if(active===D)clear();console.warn('Picnic encounter unavailable:',error);return false;}
 }
 function pause() {audio.silence();button.hidden=true;if(active)active.joined=false;button.textContent='👏 Join the rhythm';button.setAttribute('aria-pressed','false');}
 function update(dt,time,enabled=true) {
  if(dead)return;
  const W=world();if(W!==lastWorld){clear();lastWorld=W;scan=0;}
  if(!enabled||!W){pause();return;}
  const D=active;
  if(D) {
   if(D.W!==W||D.epoch!==W.globe?.frame?.epoch||!allowed(W)){clear();return;}
   const distance=Math.hypot(camera.position.x-D.at.x,camera.position.z-D.at.z);
   D.elapsed+=Math.min(dt,.1);
   if(distance>PICNIC.leave||(D.elapsed>PICNIC.duration&&distance>15)){clear();return;}
   if(!D.ready)return;
   const near=distance<8;button.hidden=!near;
   if(!near&&D.joined)pause();
   if(near&&!D.announced){D.announced=true;hint('Off-Duty Orchestra\nThree strings, two very enthusiastic percussionists.',6000);}
   const bpm=Math.max(76,Math.min(116,W.music?.performance?.bpm||96));
   D.clock+=Math.min(dt,.1)*bpm/30;
   for(const actor of D.actors)actor.update(Math.min(dt,.1),time,camera.position,D.clock,D.elapsed);
   const beat=Math.floor(D.clock);
   if(beat!==D.beat) {
    D.beat=beat;
    const level=Math.max(0,1-distance/PICNIC.hear)**2;
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),to=new THREE.Vector3(D.at.x-camera.position.x,0,D.at.z-camera.position.z).normalize();
    audio.beat(beat,level,right.dot(to)*.7,D.joined);
    for(let i=2;i<D.actors.length;i++)if(shotOnBeat(beat,i))D.actors[i].fire(distance,level>0?1:0);
   }
  } else if(allowed(W)) {
   scan+=Math.min(dt,.1);if(scan<PICNIC.scan)return;
   const due=picnicDue(scan,lastAt(W),Date.now(),random);scan=0;
   if(due)void summon();
  }
 }
 function push(p,footY) {
  const D=active;if(!D?.ready||D.W!==world()||Math.abs(footY-D.at.y)>1)return;
  for(const a of D.actors){const q=a.M.S.pos,dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz),r=.57;if(d<r){const k=(r-d)/(d||1);p.x+=d?dx*k:r;p.z+=dz*k;}}
 }
 return {update,summon,clear,pause,push,dispose(){clear();dead=true;button.remove();},inspect:()=>({active:!!active,ready:!!active?.ready,at:active?.at,elapsed:active?.elapsed,joined:!!active?.joined,beat:active?.beat,actors:active?.actors.map(a=>a.inspect())||[],...audio.inspect()})};
}
