const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const p=await b.newPage({viewport:{width:480,height:320},hasTouch:true});p.setDefaultTimeout(300000);
const r=JSON.parse(fs.readFileSync('/tmp/bard-social-qa/report.json'));const record=r.scout.final;
await p.addInitScript(v=>{localStorage.setItem('crysis-social-v1',JSON.stringify({version:1,revision:1,residents:{[v.id]:v},events:[]}));localStorage.setItem('crysis-guide-model',JSON.stringify({kind:'none'}));},record);
await p.goto('http://127.0.0.1:8790/?offline&safe',{waitUntil:'domcontentloaded'});
await p.evaluate(async()=>{const api=await L99IslandDoor.engine();await api.open({seed:1337,earth:false,biome:'TROPICAL'});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;api.guide.showPeople();});
const bounds=await p.evaluate(()=>{const panel=document.querySelector('[aria-label="The Guide"]'),input=document.querySelector('[aria-label="Message the guide"]');const a=panel.getBoundingClientRect(),b=input.getBoundingClientRect();return{panel:{top:a.top,bottom:a.bottom,left:a.left,right:a.right},input:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},width:innerWidth,height:innerHeight};});
assert(bounds.input.bottom<=bounds.panel.bottom&&bounds.input.bottom<=bounds.height);assert(bounds.input.top>=bounds.panel.top);assert(bounds.panel.left>=0&&bounds.panel.right<=bounds.width);
await p.screenshot({path:'/tmp/bard-social-qa/remembered-people.png',timeout:300000});fs.writeFileSync('/tmp/bard-social-qa/layout.json',JSON.stringify(bounds,null,2));console.log(JSON.stringify(bounds));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
