// Real renderer, project geometry and placement adapter; controlled ground/projects.
// This is visual regression evidence, not a live shared-world or physical-phone test.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright');
const { build } = require('../node_modules/esbuild');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const fixture = String.raw`
import * as THREE from 'three';
import {createCommunityProjectMarks} from './src/guide/community-project-marks.js';
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9eafa8);scene.fog=new THREE.Fog(0x9eafa8,35,110);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,250);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;document.body.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe0e4,0x75664c,2));const sun=new THREE.DirectionalLight(0xffeed0,3.2);sun.position.set(-14,22,14);scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160,1,1),new THREE.MeshStandardMaterial({color:0x6e7758,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=2;scene.add(ground);
const kinds=['path','garden','gathering','resonance'];let phase='completed';
const rows=kinds.map((kind,i)=>({id:'fixture:'+kind,siteId:'fixture-site:'+i,world:'earth',kind,stage:phase,name:kind,shared:false,anchor:{x:(i-1.5)*12,y:2,z:0,heading:0}}));
const W={body:{key:'earth'},island:{heightAt:()=>2,hasOcean:true},music:{performance:{held:0,mid:0,high:0,kick:0}}};
const marks=createCommunityProjectMarks({scene,world:()=>W,camera,projects:()=>rows});
function render(){marks.update(.25);renderer.render(scene,camera);}
function set(stage,phone=false){for(const row of rows)row.stage=stage;camera.position.set(phone?-4.5:8,phone?8:18,phone?12:40);camera.lookAt(phone?-6:0,2,0);for(let i=0;i<8;i++)render();return {marks:marks.info(),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
window.qa={set,render,renderer,marks};set('completed',innerWidth<500);
`;
(async () => {
	const root = path.resolve(__dirname, '../..'), out = process.env.BARD_PROJECT_VISUAL_OUT || path.join(root, 'docs/verification/community-projects');
	await fs.mkdir(out, { recursive: true });
	const report = { method: 'Actual Three.js renderer and community project marks with controlled flat terrain and supplied lifecycle states. Touch-emulated phone viewport; not physical-device, live-network, or production terrain verification.', errors: [], captures: [] };
	let server, browser;
	try {
		const bundle = await build({ stdin: { contents: fixture, resolveDir: path.join(root, 'island'), sourcefile: 'project-visual-fixture.js' }, bundle: true, format: 'esm', write: false, logLevel: 'silent' });
		server = http.createServer((req, res) => { const js = req.url.startsWith('/fixture.js'); res.setHeader('Content-Type', js ? 'text/javascript' : 'text/html'); res.end(js ? bundle.outputFiles[0].text : '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Community project visual fixture</title><style>html,body{margin:0;overflow:hidden}canvas{display:block}</style><script type="module" src="/fixture.js"></script>'); });
		await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
		browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || '/tmp/bard-chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
		for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
			const page = await browser.newPage({ viewport, hasTouch: label === 'phone' }); page.on('pageerror', error => report.errors.push(error.message));
			await page.goto('http://127.0.0.1:' + server.address().port, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.qa);
			for (const phase of label === 'phone' ? ['completed'] : ['surveying', 'preparing', 'building', 'completed']) {
				const result = await page.evaluate(({ phase, phone }) => qa.set(phase, phone), { phase, phone: label === 'phone' });
				assert.equal(result.marks.visible, 4); assert.ok(result.calls < 80, JSON.stringify(result)); assert.ok(result.triangles > 50);
				const file = `world-projects-${label}-${phase}.png`; await page.screenshot({ path: path.join(out, file) }); report.captures.push({ file, phase, viewport, ...result });
			}
			await page.close();
		}
		assert.deepEqual(report.errors, []); report.passed = true;
	} catch (error) { report.failure = error.message; throw error; }
	finally { await fs.writeFile(path.join(out, 'project-visual-report.json'), JSON.stringify(report, null, 2)); await browser?.close(); server?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
