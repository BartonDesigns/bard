// Checks production DOM/CSS and combat HUD without loading the world renderer.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'island/src/main.js'), 'utf8');
const dom = main.slice(main.indexOf('function css('), main.indexOf('function slider('));
const hud = fs.readFileSync(path.join(root, 'island/src/combat/hud.js'), 'utf8').replace('export function', 'function');
(async () => {
 const out = process.env.CONTROLS_OUT || '/tmp/bard-controls'; fs.mkdirSync(out,{recursive:true});
 const browser = await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE, args:['--no-sandbox']});
 const results=[];
 const contractCode=require('../node_modules/esbuild').buildSync({entryPoints:[path.join(root,'island/src/combat/contracts-view.js')],bundle:true,format:'iife',globalName:'ContractModule',write:false}).outputFiles[0].text;
 // the touch skin (icons only, laid out by thumb), as main.js applies it right after buildDom
 // the quest's chip (ui/waypoint.js): HUD text no control may cover
 const questCode=require('../node_modules/esbuild').buildSync({entryPoints:[path.join(root,'island/src/ui/waypoint.js')],bundle:true,format:'iife',globalName:'QuestModule',write:false}).outputFiles[0].text;
 const skinCode=require('../node_modules/esbuild').buildSync({entryPoints:[path.join(root,'island/src/ui/touch-skin.js')],bundle:true,format:'iife',globalName:'SkinModule',write:false}).outputFiles[0].text;
 try {
 for (const [width,height,touch] of [[390,664,true],[844,390,true],[844,320,true],[320,568,true],[1280,800,false]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});
  const p=await context.newPage(); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  await p.setContent('<meta name="viewport" content="width=device-width,initial-scale=1">');
  await p.addScriptTag({content:skinCode}); await p.addScriptTag({content:questCode});
  await p.addScriptTag({content:`const isPhone=${touch};\n${dom}\n${hud}\nwindow.ui=buildDom(); SkinModule.skinTouch(ui.mount); ui.mount.style.display='block'; ui.mount.style.background='#385048';ui.loading.remove();ui.hint.style.display='none';window.hud=createHud({mount:ui.mount,touch:${touch}});hud.update(1,{show:true,health:{hp:100,max:100,armour:30,armourMax:50},weapon:{name:'Aurora Trail Rifle',mag:8,reserve:30,max:30,mode:'auto',modes:2}});const aim=button('◎','Aim','width:52px;height:52px;border-radius:50%;z-index:6;');ui.mount.append(aim);const music=button('♫','Auto music','right:64px;top:12px;');ui.mount.append(music);for(const [i,label] of ['Gear and trade (I)','Teleport to a place','Guide','Games','Drive','Camera'].entries()){const b=button('◇',label,'','rail '+(i===0?55:i===1?60:40+i));b.onclick=()=>window.selected=label;ui.mount.append(b);}window.quest=QuestModule.createWaypoint({scene:{add(){}},camera:{position:{x:0,y:0,z:0},getWorldDirection:v=>v.set(0,0,-1)},mount:ui.mount});quest.set({x:10,y:0,z:-5,title:'Where Andre was robbed',detail:'this morning; the thief may still be about'});quest.update(0.016,1,true);`});
  await p.waitForTimeout(600);
  const more=p.getByRole('button',{name:'All controls',exact:true});
  if(touch){
   assert.equal(await p.getByRole('button',{name:'Fly (F)',exact:true}).isVisible(),true);
   const rects=await p.evaluate(()=>['Fire','Reload','Mode','Aim','Jump','All controls','Fly (F)','Auto music','Sky and world settings','Back to the Bard faceplate'].map(n=>{const r=document.querySelector(`[aria-label="${n}"]`).getBoundingClientRect();return {n,x:r.x,y:r.y,w:r.width,h:r.height};}));
   const chip=await p.evaluate(()=>{const r=document.querySelector('[data-hud-text="quest"]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
   for(const a of rects){if(touch)assert.ok(a.x+a.w<=chip.x||chip.x+chip.w<=a.x||a.y+a.h<=chip.y||chip.y+chip.h<=a.y,`${a.n} covers the quest text at ${width}x${height}`);assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=width&&a.y+a.h<=height,JSON.stringify(a));for(const b of rects){if(a===b)continue;assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,`${a.n} overlaps ${b.n} at ${width}x${height}`);}}
   // no words on the HUD's buttons: each shows a glyph, keeps its name, and is 44 px or more
   const words=await p.evaluate(()=>[...document.querySelectorAll('#l99-island-mount button')].filter(b=>b.offsetParent&&!b.closest('.l99-rail')&&!b.hasAttribute('data-hud-text')).map(b=>({n:b.getAttribute('aria-label'),g:b.dataset.glyph,f:getComputedStyle(b).fontSize,w:b.getBoundingClientRect().width,after:getComputedStyle(b,'::after').content,kids:[...b.children].filter(c=>getComputedStyle(c).display!=='none').length})));
   for(const b of words){assert.ok(b.n,'a button without a name');assert.ok(b.g&&b.f==='0px',`words showing on ${b.n}`);assert.ok((b.after==='none'||b.after==='normal')&&!b.kids,`a caption or label element showing on ${b.n}`);assert.ok(b.w>=44,`${b.n} under 44 px`);}
   await p.screenshot({path:path.join(out,`${width}x${height}.png`)});
   await more.click(); await p.screenshot({path:path.join(out,`${width}x${height}-controls.png`)}); assert.equal(await more.getAttribute('aria-expanded'),'true');
   await p.getByRole('button',{name:'Games',exact:true}).click(); assert.equal(await p.evaluate(()=>window.selected),'Games');assert.equal(await more.getAttribute('aria-expanded'),'false');
   await more.click();await p.keyboard.press('Escape');assert.equal(await more.getAttribute('aria-expanded'),'false');
   await more.click();await p.mouse.click(160,20);assert.equal(await more.getAttribute('aria-expanded'),'false');
   await more.click();await p.getByRole('button',{name:'Camera',exact:true}).scrollIntoViewIfNeeded();await p.getByRole('button',{name:'Camera',exact:true}).click();assert.equal(await p.evaluate(()=>window.selected),'Camera');
   results.push({width,height,touch,rects,menu:'selection, scrolling, outside dismissal and Escape passed'});
  }else{assert.equal(await more.isVisible(),false);assert.equal(await p.getByRole('button',{name:'Gear and trade (I)',exact:true}).isVisible(),true);results.push({width,height,touch,desktopRail:true});}
  await p.addScriptTag({content:contractCode});
  await p.evaluate(()=>{window.contracts=ContractModule.createContracts({mount:ui.mount,group:{add(){}},arms:{},squads:{release(){}},recovery:{},eye:()=>({x:0,y:1.68,z:0}),camera:{getWorldDirection:v=>v.set(0,0,-1)},ground:()=>0,site:()=>({x:30,y:0,z:0}),eligible:()=>true,active:()=>true,down:()=>false,hint(){},audio:{play(){}},store:{get:()=>null,set(){}}});contracts.update(0);});
  // (field contracts keep no window on screen: they are quests, offered and tracked in Quests)
  assert.equal(await p.locator('[data-field-contract]').count(),0);
  assert.equal((await p.evaluate(()=>contracts.accept())).ok,true);
  assert.equal(await p.evaluate(()=>{contracts.update(0);return contracts.mark().title;}),'Reach the supply cache');
  assert.equal(await p.locator('[data-field-contract]').count(),0);
  assert.equal(await p.evaluate(()=>contracts.abandon()),true);
  assert.equal(await p.evaluate(()=>contracts.info().mission),null);
  await p.screenshot({path:path.join(out,`${width}x${height}.png`)});
  assert.deepEqual(errors,[]);await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log('PASS',results.length,'viewport layouts and menu interactions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
