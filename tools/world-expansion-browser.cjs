// Actual full-site WebGL check. Run after the final bundle build under /tmp/bard-browser.lock.
// Fixed-step streaming and software rendering verify correctness, not device frame rate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const out = process.env.BARD_WORLD_OUT || '/tmp/bard-world-expansion';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ headless:true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
 const report = { kind:'automated actual-browser verification; not human playtest or phone performance measurement', places:[], errors:[], failedRequests:[], resourceErrors:[] };
 try {
  const page = await browser.newPage({ viewport:{width:800,height:500}, deviceScaleFactor:1, ignoreHTTPSErrors:true });
  page.setDefaultTimeout(300000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('requestfailed',q=>report.failedRequests.push({url:q.url(),failure:q.failure()}));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text())){if(/Failed to load resource/.test(m.text()))report.resourceErrors.push({text:m.text(),location:m.location()});else {report.errors.push(m.text());console.error(m.text());}}});
  await page.goto((process.env.BARD_URL||'http://127.0.0.1:8766')+'/?offline&safe',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{const a=await L99IslandDoor.engine();await a.open({seed:1337,earth:true});Crysis.music.auto(false);Crysis.month(6);});
  for(const spot of [{name:'Kyoto',lat:35.01,lon:135.77,east:true},{name:'Beijing',lat:39.9,lon:116.4,east:true},{name:'Fresno',lat:36.7378,lon:-119.7871,east:false}].filter(s=>!process.env.BARD_WORLD_PLACES||process.env.BARD_WORLD_PLACES.split(',').includes(s.name))) {
   console.log('Preparing '+spot.name);
   await page.evaluate(async spot=>{
    const a=L99Island,W=a.world(),G=W.globe,c=a.camera(),q=G.place(spot.lat,spot.lon);W.player.state.pos.set(q.x,100,q.z);c.position.copy(W.player.state.pos);await q.ready;
    const P=W.player.state;P.pos.set(q.x,Math.max(0,W.island.heightAt(q.x,q.z))+35,q.z);P.vel.set(0,0,0);P.flying=true;P.pitch=-.32;P.yaw=.8;c.position.copy(P.pos);
    W.sky.state.hours=12;W.sky.state.speed=0;
    for(let i=0;i<40;i++){G.update(.1,c,0);if(i%5===0)await new Promise(r=>setTimeout(r,0));}
    G.settle();
    for(let i=0;i<120;i++){G.regional.settlements.update(.1,c,{night:0,budget:5});G.towns.update(c);if(i%10===0)await new Promise(r=>setTimeout(r,0));}
    G.settle();G.update(.1,c,0);W.berms?.update(c);
   },spot);
   if(!spot.east)await page.waitForFunction(()=>{const a=L99Island,G=a.world().globe;G.towns.update(a.camera());G.towns.civ().flush();return !!G.towns.civ().active();},{},{timeout:60000,polling:250});
   await page.evaluate(()=>{const a=L99Island,W=a.world();W.globe.update(.1,a.camera(),0);W.globe.settle();W.berms?.update(a.camera());});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const result=await page.evaluate(spot=>{
    const a=L99Island,W=a.world(),G=W.globe,c=a.camera(),S=G.regional.settlements;
    const sites=[...S.sites.values()].filter(s=>Math.hypot(s.x-c.position.x,s.z-c.position.z)<5000);
    const geometry={meshes:0,vertices:0,invalid:0};
    for(const s of sites)s.group.traverse(o=>{const p=o.geometry?.attributes?.position;if(!p)return;geometry.meshes++;geometry.vertices+=p.count;for(const x of p.array)if(!Number.isFinite(x))geometry.invalid++;});
    const roads=[];G.roads.near('roads',c.position.x,c.position.z,20000,roads);
    const links=G.roads.links()||[],routed=links.filter(l=>{const r=G.roads.routes.get(l.id);return r&&r!=='none';});
    const roadGeo=G.roads.group.children.find(o=>o.geometry?.attributes?.position)?.geometry;
    let invalidRoad=0;for(const x of roadGeo?.attributes.position.array||[])if(!Number.isFinite(x))invalidRoad++;
    const roadHeights=[],rp=roadGeo?.attributes.position;
    for(let k=0;rp&&k<rp.count;k+=Math.max(1,Math.floor(rp.count/2000))) {
     const x=rp.getX(k),z=rp.getZ(k);
     if(Math.hypot(x-c.position.x,z-c.position.z)<5000)roadHeights.push(rp.getY(k)+(W.berms?.apply(x,z,0)||0)-W.island.heightAt(x,z));
    }
    roadHeights.sort((a,b)=>a-b);
    const clearance={samples:roadHeights.length,min:roadHeights[0]??null,median:roadHeights[Math.floor(roadHeights.length/2)]??null,max:roadHeights.at(-1)??null};
    const regional=sites.map(s=>({name:s.name,key:s.key,kit:s.kit,dense:!!s.planned?.dense,cells:s.cells.size,solids:[...s.cells.values()].reduce((n,x)=>n+x.solids.length,0)}));
    const town=G.towns.civ().active(),local=(S.roadTowns?.()||[]).flatMap(t=>t.roads).concat(town?.region?.roads||[]);
    const connections=roads.filter(r=>r.link).map(r=>{
     const p=r.pts;let gap=Infinity;
     for(const k of [0,p.length-2])for(const l of local)for(let j=0;j+3<l.pts.length;j+=2){
      const q=l.pts,dx=q[j+2]-q[j],dz=q[j+3]-q[j+1],t=Math.max(0,Math.min(1,((p[k]-q[j])*dx+(p[k+1]-q[j+1])*dz)/(dx*dx+dz*dz||1)));
      gap=Math.min(gap,Math.hypot(p[k]-q[j]-t*dx,p[k+1]-q[j+1]-t*dz));
     }return {name:r.name,gap};
    });
    a.renderer().render(a.scene(),c);a.renderer().getContext().finish();
    const vegetation={sampled:0,blocked:0},M=new a.T.Matrix4(),V=new a.T.Vector3();
    a.scene().updateMatrixWorld(true);
    for(const group of [G.trees.group,a.scene().getObjectByName('regional plants')])group?.traverse(o=>{
     if(!o.isInstancedMesh||!o.visible)return;
     for(let k=0;k<o.count;k++){o.getMatrixAt(k,M);V.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld);if(Math.hypot(V.x-c.position.x,V.z-c.position.z)>1200)continue;vegetation.sampled++;if(S.vegetationBlocked(V.x,V.z,0))vegetation.blocked++;}
    });
    const drive=Crysis.drive,state=drive.state,previous={edge:state.edge,dir:state.dir};
    const driveLinks=[];let localTurns=0;
    const probe=(road,dir)=>{let L=0;for(let i=2;i<road.pts.length;i+=2)L+=Math.hypot(road.pts[i]-road.pts[i-2],road.pts[i+1]-road.pts[i-1]);state.edge={...road,real:road,L};state.dir=dir;return drive.options();};
    try{
     for(const road of roads.filter(q=>q.link).slice(0,8))driveLinks.push({name:road.name,forward:probe(road,1).length,reverse:probe(road,-1).length});
     for(const road of local.slice(0,100))localTurns=Math.max(localTurns,probe(road,1).length,probe(road,-1).length);
    }finally{Object.assign(state,previous);}
    const r=a.renderer(),gl=r.getContext();
        const samplerTypes = new Set([gl.SAMPLER_2D, gl.SAMPLER_CUBE, gl.SAMPLER_3D, gl.SAMPLER_2D_SHADOW, gl.SAMPLER_2D_ARRAY, gl.SAMPLER_2D_ARRAY_SHADOW, gl.SAMPLER_CUBE_SHADOW, gl.INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_2D]);
        const programs = r.info.programs.map(p => {
          const active = [];
          for (let i = 0; i < gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS); i++) { const u = gl.getActiveUniform(p.program, i); if (samplerTypes.has(u.type)) active.push({ name: u.name.replace(/\[0\]$/, ''), size: u.size }); }
          const stages = gl.getAttachedShaders(p.program).map(s => {
            const source = gl.getShaderSource(s);
            return { stage: gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.VERTEX_SHADER ? 'vertex' : 'fragment', samplers: active.reduce((n, u) => n + ((source.match(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w*sampler\w*\s+[^;]+;/gi) || []).some(declaration => new RegExp('\\b' + u.name + '\\b').test(declaration)) ? u.size : 0), 0) };
          });
          return { runnable: p.diagnostics?.runnable !== false, activeSamplers: active.reduce((n, u) => n + u.size, 0), stages };
        });
    return {name:spot.name,vegetation,location:G.toLL(c.position.x,c.position.z),programs,driveGraph:{driveLinks,localTurns},frame:{epoch:G.frame.epoch,bay:G.frame.bay,lat:G.frame.lat,lon:G.frame.lon},geometry,regional,town:town?{name:town.town.name,streets:town.region.roads.length}:null,
     roads:{...G.roads.info(),visible:G.roads.group.visible,vertices:roadGeo?.attributes.position.count||0,invalid:invalidRoad,near:roads.length,clearance,localStreets:local.length,connections,connectors:roads.filter(r=>r.link).length,motorways:roads.filter(r=>r.cls==='motorway').length,routeExamples:routed.slice(-5).map(l=>({from:l.a.name,to:l.b.name,km:l.km}))},
     gpu:{lost:a.renderer().getContext().isContextLost(),failed:a.renderer().info.programs.filter(p=>p.diagnostics?.runnable===false).length}};
   },spot);
   report.places.push(result);console.log(JSON.stringify({...result,programs:undefined,samplerMax:Math.max(...result.programs.flatMap(p=>p.stages.map(s=>s.samplers)))}));
   fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
   assert.equal(result.gpu.failed,0,'Shader failure');
   await page.screenshot({path:path.join(out,spot.name.toLowerCase()+'-overview.png'),timeout:60000});
   if(spot.east){
    result.streetPose=await page.evaluate(()=>{
     const a=L99Island,W=a.world(),G=W.globe,c=a.camera(),S=G.regional.settlements;
     const candidates=[];
     for(const town of S.roadTowns())for(const road of town.roads){
      const p=road.pts;for(let k=0;k+3<p.length;k+=2){const x=(p[k]+p[k+2])/2,z=(p[k+1]+p[k+3])/2,d=Math.hypot(x-c.position.x,z-c.position.z);if(d<300)candidates.push({road,k,x,z,d});}
     }
     const chosen=candidates.sort((a,b)=>a.d-b.d)[0];if(!chosen)throw Error('No nearby local street midpoint');
     const {road,k,x,z}=chosen,p=road.pts,dx=p[k+2]-p[k],dz=p[k+3]-p[k+1];
     const P=W.player.state;P.pos.set(x,W.island.heightAt(x,z)+1.75,z);P.pitch=.015;P.yaw=Math.atan2(-dx,-dz);P.flying=true;c.position.copy(P.pos);c.rotation.set(P.pitch,P.yaw,0,'YXZ');
     for(let i=0;i<100;i++)S.update(.1,c,{night:0,budget:5});for(let i=0;i<5;i++)G.update(.5,c,0);G.trees.settle();
     const vegetation={sampled:0,blocked:0},M=new a.T.Matrix4(),V=new a.T.Vector3();a.scene().updateMatrixWorld(true);
     for(const group of [G.trees.group,a.scene().getObjectByName('regional plants')])group?.traverse(o=>{if(!o.isInstancedMesh||!o.visible)return;for(let n=0;n<o.count;n++){o.getMatrixAt(n,M);V.setFromMatrixPosition(M).applyMatrix4(o.matrixWorld);if(Math.hypot(V.x-x,V.z-z)>300)continue;vegetation.sampled++;if(S.vegetationBlocked(V.x,V.z,0))vegetation.blocked++;}});
     return {x,z,y:P.pos.y,yaw:P.yaw,road:road.name,width:road.w,segment:[p[k],p[k+1],p[k+2],p[k+3]],onLane:S.vegetationBlocked(x,z,0),vegetation};
    });
    assert.equal(result.streetPose.onLane,true);assert.equal(result.streetPose.vegetation.blocked,0);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    result.streetPose.afterFrame=await page.evaluate(()=>{const a=L99Island,W=a.world(),c=a.camera(),P=W.player.state;return{camera:c.position.toArray(),player:P.pos.toArray(),yaw:c.rotation.y,onLane:W.globe.regional.settlements.vegetationBlocked(c.position.x,c.position.z,0)};});
    assert.equal(result.streetPose.afterFrame.onLane,true);assert.ok(Math.hypot(result.streetPose.afterFrame.camera[0]-result.streetPose.x,result.streetPose.afterFrame.camera[2]-result.streetPose.z)<.1,'Camera must stay on selected lane');
    await page.screenshot({path:path.join(out,spot.name.toLowerCase()+'-street.png'),timeout:60000});
   }
   for(const p of result.programs){assert.ok(p.runnable);assert.ok(p.activeSamplers<=32);for(const s of p.stages)assert.ok(s.samplers<=16);}
   assert.ok(Math.abs(result.location.lat-spot.lat)<1e-6&&Math.abs(result.location.lon-spot.lon)<1e-6,"Requested geographic place must remain anchored");assert.equal(result.geometry.invalid,0);assert.equal(result.roads.invalid,0);assert.equal(result.gpu.lost,false);assert.equal(result.gpu.failed,0);
   assert.equal(result.vegetation.blocked,0,'Vegetation must clear planned homes and lanes');
   assert.ok(result.driveGraph.localTurns>=2,'Driving must offer local intersection turns');assert.ok(result.driveGraph.driveLinks.some(l=>l.forward>0&&l.reverse>0),'Driving connector must have onward options at both ends');
   assert.ok(result.roads.clearance.samples>0,'Must sample nearby rendered road ground alignment');assert.ok(result.roads.clearance.min>.06&&result.roads.clearance.max<.18,'Roads must follow rendered and playable ground within6cm float tolerance');
   assert.ok(result.roads.localStreets>0,'Local roads must participate in registry');assert.ok(result.roads.connections.some(c=>c.gap<1),'Highway must meet actual localstreet');
   assert.ok(result.roads.near>0&&result.roads.vertices>0,'Generated intercity roads must be queryable and rendered at '+spot.name);
   if(spot.east){assert.ok(result.regional.some(s=>s.dense&&s.solids>0),'Dense regional homes must exist at '+spot.name);assert.ok(result.geometry.vertices>0);}
   else assert.ok(result.town?.streets>0,'Non-Bay town must have local streets');
  }
  assert.deepEqual(report.errors,[]);
  const origin=new URL(process.env.BARD_URL||'http://127.0.0.1:8766').origin;
  assert.deepEqual(report.failedRequests.filter(q=>q.url.startsWith(origin)&&q.failure?.errorText!=='net::ERR_ABORTED'),[],'Unexplained same-origin request failure');
  report.passed=true;
 } finally {fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
