// Run the production module in workerd without Wrangler's LAN discovery/dev UI.
import * as runtime from 'miniflare';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function startLocalRooms({ entryPoint = new URL('../src/index.js', import.meta.url) } = {}) {
 const temp=await mkdtemp(join(tmpdir(),'bard-room-runtime-'));
 const bundle=await build({entryPoints:[fileURLToPath(entryPoint)],bundle:true,format:'esm',platform:'neutral',write:false});
 const options={host:'127.0.0.1',port:0,script:bundle.outputFiles[0].text,modules:true,compatibilityDate:'2026-09-01',durableObjects:{ROOMS:{className:'Room',useSQLite:true},SOULS:{className:'Soul',useSQLite:true},LIVING:{className:'LivingRegion',useSQLite:true},ACCOUNTS:{className:'Account',useSQLite:true},CHAT:{className:'ChatHub',useSQLite:true}},bindings:{ALLOW_LOCALHOST:'true'},cf:false,logRequests:false,resourcePersistencePath:temp};
 const worker=new runtime.Miniflare(runtime.convertV4MiniflareOptions?runtime.convertV4MiniflareOptions(options):options);
 const dispose=async()=>{await worker.dispose();await rm(temp,{recursive:true,force:true});};
 try{return {url:String(await worker.ready).replace(/\/$/,''),worker,dispose};}catch(e){await dispose();throw e;}
}
