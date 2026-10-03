// Run under flock /tmp/bard-browser.lock alongside the other browser regressions.
// Exercises real surface placement and actual selected-faceplate collision voices.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
	const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
	try {
		const page = await browser.newPage({ viewport: { width: 480, height: 320 }, hasTouch: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
		page.setDefaultTimeout(300000);
		const errors = [];
		page.on('pageerror', e => errors.push(e.message));
		page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
		await page.goto((process.env.BARD_URL || 'http://127.0.0.1:8766') + '/?offline&safe', { waitUntil: 'domcontentloaded' });
		await page.evaluate(async () => {
			const api = await L99IslandDoor.engine();
			await api.open({ seed: 1337, earth: false, biome: 'TROPICAL' });
			Crysis.music.auto(false); initAudio(); await ctx.resume();
		});
		const result = await page.evaluate(() => {
			const api=L99Island,W=api.world(),P=W.player.state, camera=api.camera();
			if (Crysis.kinetic.state().kind) throw Error('Unexpected rig on entry');
			const initial=P.pos.clone();let attempts=0,placed=false;
			// Search genuine generated terrain with normal placement guard/obstacles.
			for(let radius=0;radius<=300&&!placed;radius+=30) for(let k=0;k<(radius?12:1)&&!placed;k++) {
				const a=k/12*Math.PI*2,x=initial.x+Math.cos(a)*radius,z=initial.z+Math.sin(a)*radius,h=W.island.heightAt(x,z);
				if(!Number.isFinite(h)||h<1)continue;
				P.pos.set(x,h+1.7,z);P.vel.set(0,0,0);P.flying=false;camera.position.copy(P.pos);W.vegetation.stream(camera,true);
				attempts++;placed=Crysis.kinetic.place('garden');
			}
			if(!placed)throw Error('No normal surface placement after '+attempts+' candidates');
			const calls=[], stopIds=[], originalPlay=window.playLead,originalStop=window.stopLead;
			window.playLead=function(...a){calls.push(a);return originalPlay.apply(this,a);};
			window.stopLead=function(...a){stopIds.push(a[0]);return originalStop.apply(this,a);};
			try {
				let peak=0, realVoice=false;
				for(let i=0;i<120*12;i++) {
					W.kinetic.update(1/120,{listener:camera.position});peak=Math.max(peak,W.kinetic.state().voices);
					if(L99Continuity.performance().notes.some(n=>n.id.startsWith('auto:crysis-rig:')))realVoice=true;
				}
				const notes=calls.length;
				if(!notes||!realVoice)throw Error('Rig collisions did not create actual faceplate voices');
				if(calls.some(a=>!a[0].startsWith('auto:crysis-rig:')||a[3]!==false))throw Error('Wrong note ownership or default scale');
				Crysis.kinetic.stop();const stopped=Crysis.kinetic.state();
				for(let i=0;i<120;i++)W.kinetic.update(1/60,{listener:camera.position});
				if(calls.length!==notes)throw Error('Stopped rig continued playing');
				Crysis.kinetic.replay();for(let i=0;i<360;i++)W.kinetic.update(1/60,{listener:camera.position});
				const replayNotes=calls.length-notes;
				if(!Crysis.kinetic.place('pendulum'))throw Error('Pendulum replacement failed on same clear terrain');
				const beforePendulum=calls.length;for(let i=0;i<480;i++)W.kinetic.update(1/120,{listener:camera.position});
				const pendulumNotes=calls.length-beforePendulum;
				api.close();const hidden=Crysis.kinetic.state();
				const leaked=L99Continuity.performance().notes.filter(n=>n.id.startsWith('auto:crysis-rig:')).length;
				Crysis.kinetic.clear();const cleared=Crysis.kinetic.state();
				return {attempts,notes,peak,realVoice,replayNotes,pendulumNotes,stopped,hidden,leaked,cleared,stopCount:stopIds.length};
			}finally{window.playLead=originalPlay;window.stopLead=originalStop;Crysis.kinetic.clear();}
		});
		assert.ok(result.peak<=8);assert.ok(result.notes<=4+24*12);assert.ok(result.replayNotes>0);assert.ok(result.pendulumNotes>0);
		assert.equal(result.stopped.running,false);assert.equal(result.stopped.voices,0);assert.equal(result.hidden.running,false);assert.equal(result.hidden.voices,0);assert.equal(result.leaked,0);assert.equal(result.cleared.kind,null);
		await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
		assert.deepEqual(errors,[]);console.log(JSON.stringify(result));console.log('Native rig placement, actual faceplate collision notes, stop/replay/hide/clear passed');
	}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
