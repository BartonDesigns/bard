// Read-only production capability check. Does not deploy or consume model inference.
const services = [
 { name:'discovery', url:'https://l99-discovery.joshbarton1921.workers.dev', key:'planning', required:['social_intent','story_quest'] },
 { name:'rooms', url:'https://l99-rooms.joshbarton1921.workers.dev', key:'features', required:['trade-v2','combat-v1','combat-guard-v1','reputation-v1'] }
];
const report = await Promise.all(services.map(async service => {
 try {
  const response = await fetch(service.url+'/status', { headers:{origin:'https://level99bard.com','user-agent':'Mozilla/5.0 Bard-Worker-Verification'}, signal:AbortSignal.timeout(30000) });
  if(!response.ok) throw Error(`HTTP ${response.status}`);
  const status=await response.json(), missing=service.required.filter(k=>!status[service.key]?.includes(k));
  const cors=response.headers.get('access-control-allow-origin')==='https://level99bard.com';
  return { service:service.name, url:service.url, ready:!missing.length&&cors, missing, cors, status };
 } catch(error) { return {service:service.name,ready:false,error:error.message}; }
}));
console.log(JSON.stringify({checked:new Date().toISOString(),services:report},null,2));
if(report.some(r=>!r.ready))process.exitCode=1;
