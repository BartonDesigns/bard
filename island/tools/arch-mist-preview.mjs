// Full-world source preview; bundle this entry outside dist so QA never overwrites a release.
import '../src/main.js';
import { mistDensity, mistColumn, mistFractal, mistSmooth } from '../src/planet/arch/cloud-field.js';
const sm = mistSmooth;
function world() {
 const a=window.L99Island,w=a.world(),M=w.arch.plan.mist,g=a.scene().getObjectByName('arch:mist');
 const deck=g.getObjectByName('arch:mistdeck'),veil=g.getObjectByName('arch:veil'),U=deck.material.uniforms;
 const obs=U.uObs.value.filter(o=>o.z>0).map(o=>({x:o.x,z:o.y,r:o.z,light:o.w}));
 const layers=w.arch.info().mist.layers,segments=Math.round(Math.sqrt(deck.geometry.attributes.position.count/layers)-1);
 return {a,w,M,g,deck,veil,U,obs,layers,segments};
}
function options(q,x,z){return {off:q.U.uOff.value,wind:q.U.uWd.value,time:q.U.uTime.value,dusk:q.U.uDusk.value,ground:q.w.island.heightAt(x,z),segments:q.segments};}
function oldOpacity(p,q){
 const {M,U}=q,d=Math.hypot(p.x-M.x,p.z-M.z);let k=0;
 for(const B of M.bands)k=Math.max(k,sm(B.base-2,B.base+5,p.y)*(1-sm(B.top-5,B.top+3,p.y))*(1-sm(M.rad*.55,M.rad*.9,d)));
 if(k<=.01)return 0;
 const cov=sm(M.cover,M.cover+.26,mistFractal((p.x-U.uOff.value.x)*.0055+.85,(p.z-U.uOff.value.y)*.0055+.85)+.08);
 return k*(.25+.6*cov);
}
function pose(p){
 const q=world(),c=q.a.camera(),P=q.w.player.state;
 c.position.set(p.x,p.y,p.z);P.pos.copy(c.position);P.flying=true;P.vel.set(0,0,0);
 c.lookAt(...p.target);c.updateMatrixWorld();P.yaw=c.rotation.y;P.pitch=c.rotation.x;
 q.w.sky.update(0,c.position);q.w.arch.update(0);
 return q;
}
function fixtures(){
 const q=world(),{M}=q,result=[];
 for(let band=0;band<M.bands.length;band++){
  let clear=null,dense=null;
  for(let iz=-18;iz<=18;iz++)for(let ix=-18;ix<=18;ix++){
   const x=M.x+ix*M.rad/30,z=M.z+iz*M.rad/30;if(Math.hypot(x-M.x,z-M.z)>M.rad*.62)continue;
   const C=mistColumn(x,z,M.bands[band],q.obs,q.U.uOff.value,{x:M.x,z:M.z,rad:M.rad,segments:q.segments}),y=(C.base+C.top)/2;
   if(q.w.island.heightAt(x,z)>y-12)continue;
   const p={x,y,z},opacity=mistDensity(p,M,q.obs,options(q,x,z))*.85,old=oldOpacity(p,q);
   const data={...p,target:[M.x,y+9,M.z],band,opacity,old};
   if(opacity<.0085&&old>.2&&(!clear||old>clear.old))clear=data;
   if(!dense||opacity>dense.opacity)dense=data;
  }
  if(!clear||!dense||dense.opacity<.15)throw Error(`No useful clear/dense fixture for band ${band}: ${JSON.stringify({clear,dense})}`);
  result.push({name:`band-${band+1}-clear`,...clear},{name:`band-${band+1}-cloud`,...dense});
 }
 result.push({name:'overview',x:M.x+M.rad*.94,y:M.bands.at(-1).top+M.rad*.48,z:M.z+M.rad*.82,target:[M.x,M.top+25,M.z],opacity:0,old:0});
 return result;
}
function render(p,before=false){
 const q=pose(p),{a,veil}=q,c=a.camera(),r=a.renderer();
 const production={opacity:veil.material.opacity,visible:veil.visible};
 if(before){veil.material.opacity=oldOpacity(c.position,q);veil.visible=veil.material.opacity>0;}
 // Reconstruct the original colour too when the fixed clear-air branch skipped it.
 if(before&&veil.visible){
  const U=q.U,night=U.uNight.value,hor=U.uHor.value,sun=U.uSunC.value;
  const tc=sun.clone().multiplyScalar(.9).add(hor.clone().multiplyScalar(.3)),cc=hor.clone().multiplyScalar(.72).lerp(tc,.6*U.uLit.value);
  cc.lerp(hor.clone().multiplyScalar(.1),night*.88);const sk=U.uSkyDusk.value;
  cc.lerp(new a.T.Color(.42,.28,.5).multiplyScalar(sk.y),sk.x*.85);veil.material.color.copy(cc);
 }
 r.render(a.scene(),c);q.w.arch.post(r,a.scene(),c);const gl=r.getContext();gl.finish();
 const bytes=new Uint8Array(24*24*4);gl.readPixels(Math.floor(r.domElement.width/2)-12,Math.floor(r.domElement.height/2)-12,24,24,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
 let meshes=0,vertices=0;q.g.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;}});
 return {position:c.position.toArray(),opacity:veil.material.opacity,visible:veil.visible,production,mesh:{meshes,vertices,layers:q.layers,segments:q.segments,deckVertices:q.deck.geometry.attributes.position.count},draw:{...r.info.render},lost:gl.isContextLost(),glError:gl.getError(),shaderErrors:r.info.programs.filter(p=>p.diagnostics?.runnable===false).length,lit:bytes.some((v,i)=>i%4!==3&&v>5)};
}
window.archMistReview={async open(biome){const a=await L99IslandDoor.engine();await a.open({seed:4242,biome,earth:false});Crysis.music.auto(false);window._KEYS_PLAY_ON=false;Crysis.combat.ambient(false);a.world().sky.state.hours=18.5;Crysis.archGo(0);a.close();a.dom.mount.style.display='block';a.world().sky.update(0,a.camera().position);a.world().arch.update(0);return {plan:a.world().arch.plan.mist,arch:a.world().arch.info(),fixtures:fixtures(),userAgent:navigator.userAgent};},render};
