// Public gameplay facts only. Dialogue, prompts and quest prose never cross this wire.
export const REPUTATION_FEATURE = 'reputation-v1';
export const REPUTATION_MAX = 96;
export const REPUTATION_ACTOR_MAX = 16;
export const REPUTATION_TTL = 10 * 60 * 1000;
export const SERVICE_TTL = 24 * 60 * 60 * 1000;
export const REPUTATION_KINDS = ['shots', 'assault', 'vehicle-impact', 'robbery', 'arson', 'quest-complete'];
export const INCIDENT_LINES = { shots:'fired a weapon nearby', assault:'attacked a person', 'vehicle-impact':'drove a vehicle into a person', robbery:'held someone up at gunpoint', arson:'set a fire' };
const id = v => typeof v === 'string' && /^[A-Za-z0-9_:-]{6,96}$/.test(v);
const playerId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(v);
const number = (v, limit) => Number.isFinite(v) && Math.abs(v) <= limit;
const round = v => Math.round(v * 100) / 100;

export function cleanReputation(e) {
 if (!e || !id(e.id) || !REPUTATION_KINDS.includes(e.kind) || typeof e.w !== 'string' || !/^[A-Za-z0-9_:-]{1,48}$/.test(e.w)) return null;
 if (!Array.isArray(e.p) || e.p.length !== 3 || !e.p.every(v => number(v, 5e7))) return null;
 const out = {id:e.id, kind:e.kind, w:e.w, p:e.p.map(round)};
 if (e.w === 'earth') {
  if (!Array.isArray(e.g) || e.g.length !== 2 || !number(e.g[0],90) || !number(e.g[1],180)) return null;
  out.g=e.g.map(v=>Math.round(v*1e7)/1e7);
 }
 if (e.kind === 'quest-complete') { if (!id(e.npc)) return null; out.npc=e.npc; }
 return out;
}
export function cleanReputationRecord(e) {
 const out=cleanReputation(e);
 if (!out || !playerId(e.actor) || !Number.isSafeInteger(e.at) || e.at<=0) return null;
 return {...out, actor:e.actor, name:typeof e.name==='string'?e.name.replace(/[\u0000-\u001f\u007f<>]/g,'').slice(0,24):'another player', at:e.at};
}
export function reputationDistance(a,b) {
 if (!a || !b || a.w!==b.w || !a.p || !b.p) return Infinity;
 if (a.w==='earth') {
  if (!a.g || !b.g) return Infinity;
  const r=Math.PI/180, dlat=(b.g[0]-a.g[0])*r, dlon=(b.g[1]-a.g[1])*r;
  const h=Math.sin(dlat/2)**2+Math.cos(a.g[0]*r)*Math.cos(b.g[0]*r)*Math.sin(dlon/2)**2;
  return 12742000*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
 }
 return Math.hypot(a.p[0]-b.p[0],a.p[2]-b.p[2]);
}
export const reputationAlive = (e,now) => now>=e.at && now-e.at<(e.kind==='quest-complete'?SERVICE_TTL:REPUTATION_TTL);
export function npcMemoryKey(actor) {
 const seed=actor?.P?.dna?.seed ?? actor?.dna?.seed;
 return Number.isFinite(seed) ? 'npc-'+(seed>>>0).toString(36).padStart(6,'0') : null;
}

// Room-scoped cache. The server's clock prevents device clock skew from changing guilt.
export function createReputationMemory({me, now=Date.now}={}) {
 let supported=false, offset=0, records=[];
 const alive=(e,time)=>e.at<=time+5000 && reputationAlive(e,Math.max(time,e.at));
 function reset(welcome=null) {
  records=[]; supported=!!welcome?.features?.includes(REPUTATION_FEATURE);
  offset=Number.isFinite(welcome?.now)?now()-welcome.now:0;
 }
 function receive(raw) {
  if(!supported)return null;
  const e=cleanReputationRecord(raw), time=now()-offset;
  if(!e || !alive(e,time) || records.some(q=>q.actor===e.actor && q.id===e.id))return null;
  records=records.filter(q=>alive(q,time));records.push(e);records=records.slice(-REPUTATION_MAX);return e;
 }
 function context(at, npc=null) {
  if(!supported || !at)return {reports:[],sharedCompleted:0};
  const time=now()-offset;
  records=records.filter(e=>alive(e,time));
  const near=records.filter(e=>e.w===at.w && Math.abs(e.p[1]-at.p[1])<2.5 && reputationDistance(e,at)<120);
  const reports=near.filter(e=>e.kind!=='quest-complete' && (e.actor===me || time-e.at<90000)).map(e=>({...e,actorId:e.actor===me?'player':e.actor,actorName:e.name,line:INCIDENT_LINES[e.kind],age:time-e.at}));
  // A stranger can know that you helped locally without pretending to be the issuer.
  const completed=near.filter(e=>e.kind==='quest-complete' && e.actor===me);
  return {reports,sharedCompleted:completed.length,sharedIssuer:!!npc && completed.some(e=>e.npc===npc)};
 }
 return {reset,receive,context,supported:()=>supported,has:(id)=>records.some(e=>e.actor===me&&e.id===id),info:()=>({supported,records:records.length})};
}
