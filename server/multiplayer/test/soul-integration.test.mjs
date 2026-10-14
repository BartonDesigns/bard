// Run against a local workerd server only. No production incidents are created.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
const base=process.env.SOUL_TEST_URL||'http://127.0.0.1:8790';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Local server required');
const origin='http://127.0.0.1:8766',key=randomBytes(32).toString('hex');
const call=async(body)=>{const r=await fetch(base+'/souls/me',{method:body?'POST':'GET',headers:{origin,authorization:'Bearer '+key,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
const connect=async(code,id)=>{const messages=[],ws=new WebSocket(base.replace('http','ws')+'/rooms/'+code+'/ws?id='+id+'&name='+id+'&seed=1',{headers:{origin}});ws.on('message',b=>{try{messages.push(JSON.parse(b));}catch{}});await new Promise((yes,no)=>{ws.once('open',yes);ws.once('error',no);});return{ws,messages,send:m=>ws.send(JSON.stringify(m)),async wait(fn){for(let i=0;i<100;i++){const v=messages.find(fn);if(v)return v;await new Promise(r=>setTimeout(r,30));}throw Error('Socket message not received');}};};
const make=async id=>{const r=await fetch(base+'/rooms',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({id})});assert.equal(r.status,200);return(await r.json()).code;};
const sockets=[];
try {
 let r=await call({op:'sync',epoch:0,deeds:[{id:'permanent-favour',kind:'favour',world:'earth'}]});assert.equal(r.status,200);assert.equal(r.data.ledger.me.deeds,1);
 const code=await make('soul-host-aaa'),a=await connect(code,'soul-host-aaa'),b=await connect(code,'soul-guest-bbb');sockets.push(a,b);
 assert.ok((await a.wait(m=>m.t==='welcome')).features.includes('persistent-reputation-v1'));
 a.send({t:'soul-bind',key});const known=await b.wait(m=>m.t==='standing'&&m.actor==='soul-host-aaa');assert.equal(known.standing.deeds,1);assert.equal(known.standing.log,undefined);
 a.send({t:'end'});await new Promise(r=>setTimeout(r,1200));
 const second=await make('new-host-ccc'),c=await connect(second,'new-host-ccc');sockets.push(c);await c.wait(m=>m.t==='welcome');c.send({t:'soul-bind',key});assert.equal((await c.wait(m=>m.t==='standing')).standing.deeds,1);
 const pose={w:'w2281969',type:'SINGULARITY',p:[0,7.68,0]};
 const begun=await call({op:'begin',epoch:0,pose});assert.equal(begun.status,200);
 await new Promise(r=>setTimeout(r,8200));
 r=await call({op:'cleanse',epoch:0,pose,nonce:begun.data.nonce});assert.equal(r.status,200);assert.equal(r.data.ledger.epoch,1);assert.equal(r.data.ledger.me.deeds,0);
 c.send({t:'soul-refresh'});assert.equal((await c.wait(m=>m.t==='standing'&&m.standing.epoch===1)).standing.deeds,0);
 assert.equal((await call({op:'sync',epoch:0,deeds:[{id:'old-offline-deed',kind:'robbery'}]})).status,409);
 console.log('PASS: real workerd storage, two sockets, authenticated attribution, new room/new socket identity, eight-second cleansing, shared refresh, stale-epoch rejection.');
} finally { for(const s of sockets)s.ws.close(); }
