// Bundle held-review-entry.mjs to dist/held-review.js, then run under the shared browser lock.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
	const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]')});
	try{
		const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
		await page.setContent('<!doctype html><body></body>');await page.addScriptTag({content:await fs.readFile(process.env.HELD_BUNDLE||path.resolve(__dirname,'../dist/held-review.js'),'utf8')});
		const checks=await page.evaluate(()=>review.validate());
		const models=await page.evaluate(()=>review.ids.map(id=>({...review.stats(id),low:review.stats(id,'low')})));
		for(const item of models)for(const lod of ['low','high'])for(const tier of [0,4])await page.evaluate(o=>review.render(o),{id:item.id,lod,tier,level:7,width:240,height:180});
		assert.equal(models.length,20);assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,models,errors},null,2));
	}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
