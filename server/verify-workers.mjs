// Read-only production capability check. Does not deploy or consume model inference.
const services = [
 { name:'discovery', url:'https://l99-discovery.joshbarton1921.workers.dev', key:'planning', required:['social_intent','story_quest','negotiation_intent','community_project_intent'], features:['quest-continuity-v1','negotiation-intent-v1','community-project-intent-v1'] },
 { name:'rooms', url:'https://l99-rooms.joshbarton1921.workers.dev', key:'features', required:['trade-v2','gear-levels-20','combat-v1','combat-guard-v1','pvp-flags-v1','reputation-v1','persistent-reputation-v1','living-world-v1','world-projects-v1','household-life-v1'] }
];
const report = await Promise.all(services.map(async service => {
 try {
  const response = await fetch(service.url+'/status', { headers:{origin:'https://level99bard.com','user-agent':'Mozilla/5.0 Bard-Worker-Verification'}, signal:AbortSignal.timeout(30000) });
  if(!response.ok) throw Error(`HTTP ${response.status}`);
  const status=await response.json(), missing=[...service.required.filter(k=>!status[service.key]?.includes(k)),...(service.features||[]).filter(k=>!status.features?.includes(k))];
  const cors=response.headers.get('access-control-allow-origin')==='https://level99bard.com';
  let preflight=null;
  if(service.name==='rooms') {
   const check=await fetch(service.url+'/souls/me',{method:'OPTIONS',headers:{origin:'https://level99bard.com','access-control-request-method':'POST','access-control-request-headers':'authorization, content-type','user-agent':'Mozilla/5.0 Bard-Worker-Verification'},signal:AbortSignal.timeout(30000)});
   const headers=(check.headers.get('access-control-allow-headers')||'').toLowerCase().split(',').map(s=>s.trim()),methods=(check.headers.get('access-control-allow-methods')||'').split(',').map(s=>s.trim());
   preflight={status:check.status,allowedHeaders:headers,ready:check.ok&&check.headers.get('access-control-allow-origin')==='https://level99bard.com'&&['authorization','content-type'].every(h=>headers.includes(h))&&['GET','POST'].every(m=>methods.includes(m))};
  }
  return { service:service.name, url:service.url, ready:!missing.length&&cors&&preflight?.ready!==false, missing, cors, preflight, status };
 } catch(error) { return {service:service.name,ready:false,error:error.message}; }
}));
console.log(JSON.stringify({checked:new Date().toISOString(),services:report},null,2));
if(report.some(r=>!r.ready))process.exitCode=1;
