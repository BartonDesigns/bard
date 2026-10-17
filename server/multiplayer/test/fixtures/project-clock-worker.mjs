// TEST ENTRY POINT ONLY. This file is never imported by src/ or Wrangler's
// production entry. It injects a clock through the constructor to verify a day
// of absent-player progression in real SQLite without a 24-hour test sleep.
import { handle, Room, Soul } from '../../src/index.js';
import { LivingRegion as ProductionLivingRegion } from '../../src/living-region.js';
export { Room, Soul };
export class LivingRegion extends ProductionLivingRegion {
 constructor(state, env) {const clock={now:Date.now()+60000};super(state,env,()=>clock.now);this.testClock=clock;}
 fetch(request) {
  const u=new URL(request.url);
  if(u.pathname==='/__test_clock') return this.exclusive(async()=>{const now=Number(u.searchParams.get('now'));if(!Number.isSafeInteger(now)||now<this.testClock.now)return Response.json({error:'invalid-test-time'},{status:400});this.testClock.now=now;if(u.searchParams.get('alarm')==='1')await this.tick();return Response.json({now});});
  return super.fetch(request);
 }
}
export default {fetch(request,env) {
 const u=new URL(request.url);
 if(u.pathname==='/__test_clock') {const target=new URL('https://living/__test_clock');target.searchParams.set('now',u.searchParams.get('now'));if(u.searchParams.has('alarm'))target.searchParams.set('alarm',u.searchParams.get('alarm'));const key=JSON.stringify([u.searchParams.get('world'),u.searchParams.get('region')]);return env.LIVING.get(env.LIVING.idFromName(key)).fetch(new Request(target));}
 return handle(request,env);
}};
