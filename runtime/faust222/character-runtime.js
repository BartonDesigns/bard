/* Bard Character 222. MIT. Local compiled Faust DSP; compiler is not shipped. */
(function(global){
'use strict';
const script=document.currentScript;
const base=new URL('./',script&&script.src?script.src:new URL('runtime/faust222/character-runtime.js',document.baseURI));
const PRESETS=Object.freeze({
 SYNTHWAVE:Object.freeze({mix:.55,drive:1.25,tone:11200,rate:.38,depth:3.8,chorus:.34,level:.99}),
 DNB:Object.freeze({mix:.48,drive:2.4,tone:13800,rate:.18,depth:.45,chorus:.08,level:.99}),
 BREW:Object.freeze({mix:.32,drive:1.65,tone:7600,rate:.65,depth:1.0,chorus:.13,level:.99}),
 DANCEHALL:Object.freeze({mix:.22,drive:1.4,tone:12500,rate:.24,depth:.25,chorus:.04,level:1}),
 BARD:Object.freeze({mix:.12,drive:1.05,tone:14500,rate:.25,depth:.35,chorus:.06,level:1})
});
const contexts=new WeakMap(),states=new Set();
let factoryPromise=null;
function presetName(face){const key=String(face||'').toUpperCase();return key==='REGGAETON'?'DANCEHALL':key;}
function getFactory(){
 if(factoryPromise)return factoryPromise;
 factoryPromise=Promise.all(['character222.wasm','character222.json'].map(async(name)=>{
  const res=await fetch(new URL(name,base));if(!res.ok)throw Error('Faust asset '+name+' ('+res.status+')');
  return name.endsWith('.wasm')?res.arrayBuffer():res.json();
 })).then(async([bytes,meta])=>({module:await WebAssembly.compile(bytes),meta})).catch(error=>{factoryPromise=null;throw error;});
 return factoryPromise;
}
function contextState(context){
 let state=contexts.get(context);
 if(!state){state={context,modulePromise:null,routes:new WeakMap(),handles:new Set()};contexts.set(context,state);states.add(state);}
 return state;
}
async function create(context,face,options){
 const key=presetName(face),preset=PRESETS[key];
 if(!preset)throw Error('Unknown Faust faceplate: '+face);
 if(!context.audioWorklet || typeof AudioWorkletNode==='undefined')throw Error('AudioWorklet requires HTTPS or localhost');
 const state=contextState(context);
 if(!state.modulePromise)state.modulePromise=context.audioWorklet.addModule(new URL('character-worklet.js',base)).catch(error=>{state.modulePromise=null;throw error;});
 const [factory]=await Promise.all([getFactory(),state.modulePromise]);
 if(context.state==='closed')throw Error('Audio context is closed');
 const values=Object.assign({},preset,options||{});
 const node=new AudioWorkletNode(context,'bard-character-222',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],channelCount:2,channelCountMode:'explicit',processorOptions:{...factory,values}});
 node.setPreset=function(next){const p=typeof next==='string'?PRESETS[presetName(next)]:next;if(p)node.port.postMessage({type:'params',values:p});};
 node.dispose=function(){node.port.postMessage({type:'dispose'});node.disconnect();node.port.close();};
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Faust processor initialization timed out')),10000);
  node.port.onmessage=event=>{
   if(event.data.type==='ready'){clearTimeout(timer);resolve();}
   if(event.data.type==='failed'){clearTimeout(timer);reject(Error(event.data.message));if(node.onFaustFailure)node.onFaustFailure(event.data.message);}
  };
  node.onprocessorerror=()=>{clearTimeout(timer);reject(Error('Faust processor failed'));if(node.onFaustFailure)node.onFaustFailure('Faust processor failed');};
 }).catch(error=>{node.dispose();throw error;});
 return node;
}
function route(context,face,destination){
 const key=presetName(face);
 if(!PRESETS[key]||!destination)return destination;
 const state=contextState(context);
 let map=state.routes.get(destination);
 if(!map){map=new Map();state.routes.set(destination,map);}
 if(map.has(key))return map.get(key).input;
 const input=context.createGain(),dry=context.createGain(),wet=context.createGain();
 input.connect(dry);dry.connect(destination);wet.connect(destination);wet.gain.value=0;
 const handle={input,dry,wet,node:null,face:key,status:'loading',error:null,disposed:false};
 map.set(key,handle);state.handles.add(handle);
 function fail(error){
  handle.status='bypassed';handle.error=String(error&&error.message||error);
  if(!handle.disposed&&context.state!=='closed'){
   const t=context.currentTime;dry.gain.cancelScheduledValues(t);wet.gain.cancelScheduledValues(t);
   dry.gain.setTargetAtTime(1,t,.01);wet.gain.setTargetAtTime(0,t,.01);
  }
 }
 handle.ready=create(context,key).then(node=>{
  if(handle.disposed){node.dispose();return null;}
  handle.node=node;node.onFaustFailure=fail;input.connect(node);node.connect(wet);
  const t=context.currentTime;dry.gain.setValueAtTime(1,t);wet.gain.setValueAtTime(0,t);
  dry.gain.linearRampToValueAtTime(0,t+.045);wet.gain.linearRampToValueAtTime(1,t+.045);
  handle.status='ready';return node;
 }).catch(error=>{fail(error);return null;});
 input.faust222=handle;
 return input;
}
function dispose(context){
 const state=contexts.get(context);if(!state)return;
 for(const h of state.handles){h.disposed=true;h.input.disconnect();h.dry.disconnect();h.wet.disconnect();if(h.node)h.node.dispose();}
 state.handles.clear();contexts.delete(context);states.delete(state);
}
function snapshot(){return{engine:'Faust WASM',build:222,presets:Object.keys(PRESETS),routes:[...states].flatMap(s=>[...s.handles].map(h=>({face:h.face,status:h.status,error:h.error}))) };}
global.L99Faust222={create,route,dispose,snapshot,presets:PRESETS,prepare:getFactory};
})(window);
