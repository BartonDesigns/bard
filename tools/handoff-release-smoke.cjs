// Run under flock /tmp/bard-browser.lock. Software GL, not physical-device timing.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
	const root=path.resolve(__dirname,'..'),out=process.env.BARD_QA_OUT||'/tmp/bard-handoff-smoke';await fs.mkdir(out,{recursive:true});
	const server=http.createServer(async(req,res)=>{try{
		const p=new URL(req.url,'http://local').pathname,f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep))throw Error('path');
		res.setHeader('Content-Type',f.endsWith('.js')||f.endsWith('.mjs')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(await fs.readFile(f));
	}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
	let browser;const report={worlds:[],errors:[],requests:[],method:'Chromium software WebGL, 640x420 touch viewport; real production bundle and assets'};
	try{
		browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]')});
		const page=await browser.newPage({viewport:{width:640,height:420},hasTouch:true});page.setDefaultTimeout(300000);
		page.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/.test(m.text())){report.errors.push(m.text());console.log('CONSOLE ERROR',m.text().slice(0,300));}});
		page.on('response',r=>{if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:'))report.requests.push({url:r.url(),status:r.status()});});
		const sample=async (name,keepRunning=false)=>{
			const result=await page.evaluate(keepRunning=>{const a=L99Island,r=a.renderer(),s=a.scene(),c=a.camera(),w=a.world();if(!keepRunning)a.close();a.dom.mount.style.display='block';r.render(s,c);w.arch?.post?.(r,s,c);w.beyond?.render?.();const gl=r.getContext();gl.finish();
				const samplerTypes=new Set([gl.SAMPLER_2D,gl.SAMPLER_CUBE,gl.SAMPLER_3D,gl.SAMPLER_2D_SHADOW,gl.SAMPLER_2D_ARRAY]);
				const programs=r.info.programs.map(p=>{const active=[];for(let i=0;i<gl.getProgramParameter(p.program,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(p.program,i);if(samplerTypes.has(u.type))active.push({name:u.name.replace(/\[0\]$/,''),size:u.size});}const stages=gl.getAttachedShaders(p.program).map(s=>{const source=gl.getShaderSource(s),decl=source.match(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w*sampler\w*\s+[^;]+;/gi)||[];return active.reduce((n,u)=>n+(decl.some(d=>new RegExp('\\b'+u.name+'\\b').test(d))?u.size:0),0);});return {runnable:p.diagnostics?.runnable!==false,samplers:active.reduce((n,u)=>n+u.size,0),stages};});
				const pixels=new Uint8Array(32*32*4);gl.readPixels(Math.floor(r.domElement.width/2)-16,Math.floor(r.domElement.height/2)-16,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
				return {lost:gl.isContextLost(),programs,render:{...r.info.render},memory:{...r.info.memory},lit:pixels.some((v,i)=>i%4!==3&&v>5),combat:Crysis.combat.info()};},keepRunning);
			assert.equal(result.lost,false);assert.ok(result.lit,name+' is not black');assert.ok(result.programs.every(p=>p.runnable&&p.samplers<=32&&p.stages.every(n=>n<=16)));report.worlds.push({name,...result});await page.screenshot({path:out+'/'+name+'.png',timeout:300000});console.log('RENDERED',name,JSON.stringify(result.render));
		};
		await page.goto('http://127.0.0.1:'+server.address().port+'/?offline&safe',{waitUntil:'domcontentloaded'});console.log('Faceplate loaded');
		await page.evaluate(async()=>{const a=await L99IslandDoor.engine();await a.open({seed:1337,earth:true});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;Crysis.combat.ambient(false);});
		await sample('earth-island');
		await page.waitForFunction(()=>L99Island.world().bayArea?.loaded());
		await page.evaluate(()=>{const a=L99Island,w=a.world(),p=w.player.state,x=(-122.4766+122.57)*111320*Math.cos(37.76*Math.PI/180),z=-(37.8356-37.76)*110996;p.pos.set(x,w.island.heightAt(x,z)+40,z);p.flying=true;a.camera().position.copy(p.pos);w.bayArea.update(a.camera(),0);});await sample('bay-area');
		await page.evaluate(async()=>{const a=L99Island,w=a.world(),q=w.globe.place(44.0582,-121.3153);await q.ready;const p=w.player.state;p.pos.set(q.x,Math.max(0,w.island.heightAt(q.x,q.z))+80,q.z);a.camera().position.copy(p.pos);w.globe.update(1/60,a.camera(),0);});await sample('globe-bend');
		await page.evaluate(async()=>{await L99Island.open({seed:4242,biome:'TERRAN',earth:false});Crysis.music.auto(false);L99Island.world().sky.state.hours=18.5;Crysis.archGo(0);});await sample('terran-architecture');
		await page.evaluate(()=>Crysis.archGo('0:0'));await sample('terran-interior');
		await page.evaluate(async()=>{await L99Island.open({seed:4242,biome:'MOON',earth:false});Crysis.music.auto(false);Crysis.colonyGo();});await sample('moon-colony');
		report.moonCrew=await page.evaluate(async()=>{const a=L99Island,w=a.world(),c=w.colony,crew=c.crew.people,f=crew.byId.medic,p=w.player.state,q={...f.pos};p.pos.set(q.x,q.y+1.68,q.z+2.3);p.yaw=0;p.pitch=-.05;a.camera().position.copy(p.pos);a.camera().rotation.set(p.pitch,p.yaw,0,'YXZ');
			for(let i=0;i<180&&!f.built;i++){c.update(.1,i*.1);await new Promise(r=>setTimeout(r,10));}if(!f.built)throw Error('Moon medic failed to load');crew.look('medic','work',{...q,yaw:0});for(let i=0;i<40;i++)c.update(.1,20+i*.1);return {built:f.built,name:f.name,place:f.place,position:f.M.S.pos.toArray(),crew:crew.info()};});await sample('moon-crew-room');
		await page.evaluate(async()=>{await L99Island.open({seed:4242,biome:'MAGMA',earth:false});Crysis.music.auto(false);});await sample('magma');
		await page.evaluate(async()=>{await L99Island.open({seed:1337,biome:'TROPICAL',earth:false});Crysis.music.auto(false);if(!L99Island.world().deep)throw Error('Known gate fixture missing');Crysis.deepGo('gate');await new Promise(requestAnimationFrame);});await sample('deep-gate',true);
		await page.evaluate(()=>L99Island.world().deep.strikeStone(0));await page.waitForTimeout(3300);
		await page.evaluate(()=>{const d=L99Island.world().deep;d.call().forEach(i=>d.strikeStone(i));for(let i=0;i<100;i++)d.update(.05,i*.05);});
		report.deep=await page.evaluate(()=>Crysis.deep());assert.ok(report.deep.open,'Deep phrase opens gate');
		report.descent=await page.evaluate(()=>{const d=L99Island.world().deep,r=d.go('down');for(let i=0;i<66;i++)d.update(.1,10+i*.1);return {result:r,...d.info()};});assert.ok(report.descent.active&&!report.descent.climbing);await sample('deep-bottom',true);
		report.ascent=await page.evaluate(()=>{const d=L99Island.world().deep,r=d.go('up');for(let i=0;i<66;i++)d.update(.1,20+i*.1);return {result:r,...d.info(),locked:L99Island.world().player.state.locked};});assert.ok(!report.ascent.active&&!report.ascent.locked);await sample('deep-return',true);
		report.horizonStart=await page.evaluate(()=>{const a=L99Island,w=a.world(),P=w.player.state,o=w.orbit;P.flying=true;P.pos.y=14000;o.before();const b=o.bodies().find(b=>b.id==='gargantua'),n=Math.hypot(.15,.3,1);P.pos.copy(b.pos);P.pos.x+=b.size*1.75*.15/n;P.pos.y+=b.size*1.75*.3/n;P.pos.z+=b.size*1.75/n;P.vel.set(0,0,0);o.face('gargantua');o.after(.016);const info=o.info();for(let i=0;i<40;i++)o.after(.1);return info;});assert.ok(report.horizonStart.horizon,'Native Gargantua passage starts');
		await page.waitForFunction(()=>L99Island.world()?.beyond?.state().mode==='in',null,{timeout:300000});await page.waitForTimeout(2000);report.beyond=await page.evaluate(()=>({type:L99Island.world().orbit.info().type,...L99Island.world().beyond.state()}));assert.equal(report.beyond.type,'SINGULARITY');await sample('gargantua-held-note',true);
		await page.getByRole('button',{name:/Leave.*horizon/i}).click();await page.evaluate(()=>{const b=L99Island.world().beyond;for(let i=0;i<65;i++)b.update(.1,40+i*.1);});report.beyondReturn=await page.evaluate(()=>L99Island.world().beyond.state());assert.equal(report.beyondReturn.mode,'out');await sample('gargantua-event-ring',true);
		assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests.filter(r=>!r.url.endsWith('/favicon.ico')),[]);report.passed=true;
	}finally{await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
