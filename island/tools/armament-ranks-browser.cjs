// Actual merged geometry and materials, every armament quality at both detail levels.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const out=process.env.RANKS_OUT||'/tmp/bard-ranks/results';await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={states:[],errors:[],method:'Production itemModel, Chromium software WebGL. Not a physical-device performance benchmark.'};
 try{
  const p=await browser.newPage();p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await p.setContent('<body style="margin:0"></body>');await p.addScriptTag({content:await fs.readFile(process.env.HELD_BUNDLE,'utf8')});
  const allChecks=await p.evaluate(()=>review.validate());report.checks=allChecks;
  for(const id of ['aurora-trail-rifle','mossback-scout-rifle','warden-spark-carbine','reedline-hunting-bow']){
   for(const lod of ['high','low']){
    let prior=0;
    for(let tier=0;tier<5;tier++){
     const r=await p.evaluate(c=>review.render(c),{id,lod,tier,level:7,width:900,height:380,background:0x20272c});
     assert.equal(r.shaderOK,true);assert.equal(r.glError,0);assert.equal(r.variant.rank,tier);
     assert.ok(r.vertices>prior,'rank must change geometry, not only colour');prior=r.vertices;
     assert.ok(r.triangles<(lod==='high'?45000:14000),'bounded mesh budget');
     assert.ok(r.calls<=12,'parts must remain merged');
     const {png,...data}=r;report.states.push({id,lod,tier,...data});
     if(lod==='high')await fs.writeFile(path.join(out,`${id}-${tier}.png`),Buffer.from(png.split(',')[1],'base64'));
     console.log('PASS',id,lod,tier,r.triangles);
    }
   }
  }
  assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
