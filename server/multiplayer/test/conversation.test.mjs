// One real game client, one remote socket, production Worker and actual NPC dialogue.
import { startLocalRooms } from './local-worker.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.wasm':'application/wasm'};
const site=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root.replace(/\/$/,'')+sep))throw Error();res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
const local=await startLocalRooms();
try{
 await new Promise(r=>site.listen(0,'127.0.0.1',r));
 const child=spawn(process.execPath,['island/tools/conversational-browser.cjs'],{cwd:root,stdio:'inherit',env:{...process.env,BARD_URL:'http://127.0.0.1:'+site.address().port,BARD_ROOMS_URL:local.url}});
 process.exitCode=await new Promise((resolve,reject)=>{child.on('exit',code=>resolve(code??1));child.on('error',reject);});
}finally{site.close();await local.dispose();}
